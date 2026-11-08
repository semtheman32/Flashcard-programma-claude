"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CornerDownLeft, Lightbulb, X } from "lucide-react";
import { checkAnswer, normalizeAnswer, type AnswerCheck } from "@/lib/answer";
import { studyPair } from "@/lib/cards";
import type { CardDTO } from "@/server/mappers";
import { cn } from "@/lib/cn";
import { Button, Input, Kbd, LinkButton, Panel } from "../ui";
import { StudyHeader } from "./study-header";
import { isTyping, shuffle, useStudySession } from "./use-session";

/**
 * Learn mode (adaptive):
 * - every card starts as multiple choice (if the deck has enough distinct answers), then written
 * - a card is "learned for this session" after it has been answered correctly `remaining` times
 * - a mistake adds one extra required correct answer (max 3) and the card comes back soon
 * - correct cards come back later, so known material is repeated less and less
 */

interface Item {
  id: string;
  remaining: number;
  stage: "choice" | "written";
  mistakes: number;
}

type Feedback =
  | { kind: "choice"; chosen: string; correct: boolean }
  | { kind: "written"; given: string; check: AnswerCheck; overridden?: boolean };

export function LearnSession({
  cards,
  deckId,
  deckName,
  allowTypos,
}: {
  cards: CardDTO[];
  deckId: string;
  deckName: string;
  allowTypos: boolean;
}) {
  const { record, override, restart, error } = useStudySession("learn", deckId);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const [reverse, setReverse] = useState(false);
  const [writtenOnly, setWrittenOnly] = useState(false);

  const answerOf = useCallback((c: CardDTO) => studyPair(c, reverse).answer, [reverse]);
  const distinctAnswers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of cards) {
      const a = answerOf(c);
      if (a && !seen.has(normalizeAnswer(a))) seen.set(normalizeAnswer(a), a);
    }
    return [...seen.values()];
  }, [cards, answerOf]);
  const canChoice = distinctAnswers.length >= 4 && !writtenOnly;

  const makeQueue = useCallback(
    (ids: string[]): Item[] => shuffle(ids).map((id) => ({ id, remaining: canChoice ? 2 : 1, stage: canChoice ? "choice" : "written", mistakes: 0 })),
    [canChoice],
  );

  const [queue, setQueue] = useState<Item[]>(() => makeQueue(cards.map((c) => c.id)));
  const [done, setDone] = useState<Item[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [typed, setTyped] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  // The queue is shuffled, so render only on the client (avoids a hydration mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = queue[0];
  const card = current ? byId.get(current.id)! : null;
  const pair = card ? studyPair(card, reverse) : null;

  const options = useMemo(() => {
    if (!card || !current || current.stage !== "choice") return [];
    const correct = answerOf(card);
    const others = shuffle(distinctAnswers.filter((a) => normalizeAnswer(a) !== normalizeAnswer(correct))).slice(0, 3);
    return shuffle([correct, ...others]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.stage, current?.remaining, reverse]);

  useEffect(() => {
    if (current?.stage === "written" && !feedback) inputRef.current?.focus();
  }, [current, feedback]);

  const restartWith = (ids: string[]) => {
    setQueue(makeQueue(ids));
    setDone([]);
    setFeedback(null);
    setTyped("");
    setStats({ correct: 0, incorrect: 0 });
    restart();
  };

  // Rebuild the queue when the mode options change before starting
  useEffect(() => {
    if (stats.correct + stats.incorrect === 0) setQueue(makeQueue(cards.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canChoice, reverse]);

  const submitResult = (correct: boolean) => {
    if (!current || !card) return;
    void record(card.id, correct ? "correct" : "incorrect");
    setStats((s) => ({ correct: s.correct + (correct ? 1 : 0), incorrect: s.incorrect + (correct ? 0 : 1) }));
  };

  const advance = (correct: boolean) => {
    if (!current) return;
    const rest = queue.slice(1);
    let item: Item;
    if (correct) {
      item = { ...current, remaining: current.remaining - 1, stage: "written" };
    } else {
      item = { ...current, remaining: Math.min(3, current.remaining + 1), stage: "written", mistakes: current.mistakes + 1 };
    }
    setFeedback(null);
    setTyped("");
    setShowHint(false);
    if (item.remaining <= 0) {
      setDone((d) => [...d, item]);
      setQueue(rest);
      return;
    }
    // wrong → back soon (after 2 cards); right but not done → later (after 4–6 cards)
    const gap = correct ? 4 + Math.floor(Math.random() * 3) : 2;
    const pos = Math.min(gap, rest.length);
    setQueue([...rest.slice(0, pos), item, ...rest.slice(pos)]);
  };

  const choose = (option: string) => {
    if (feedback || !card) return;
    const correct = normalizeAnswer(option) === normalizeAnswer(answerOf(card));
    setFeedback({ kind: "choice", chosen: option, correct });
    submitResult(correct);
    if (correct) setTimeout(() => advance(true), 650);
  };

  const submitWritten = () => {
    if (feedback || !card) return;
    if (!typed.trim()) return;
    const check = checkAnswer(typed, answerOf(card), { allowTypos });
    setFeedback({ kind: "written", given: typed, check });
    submitResult(check.accepted);
  };

  const isCorrect = feedback ? (feedback.kind === "choice" ? feedback.correct : feedback.check.accepted || feedback.overridden) : false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (feedback && (e.key === "Enter" || (e.key === " " && !isTyping(e)))) {
        if (feedback.kind === "choice" && feedback.correct) return;
        e.preventDefault();
        advance(Boolean(isCorrect));
        return;
      }
      if (isTyping(e)) return;
      if (!feedback && current.stage === "choice" && ["1", "2", "3", "4"].includes(e.key)) {
        const o = options[Number(e.key) - 1];
        if (o) choose(o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const total = cards.length;
  const learned = done.length;

  if (!mounted) return null;

  if (!card || !pair) {
    const hard = done.filter((d) => d.mistakes > 0).map((d) => d.id);
    return (
      <div className="mx-auto max-w-3xl">
        <StudyHeader title={`${deckName} · Leren`} backHref={`/decks/${deckId}`} progress={100} label={`${learned}/${total}`} />
        <Panel className="p-8 text-center">
          <h2 className="text-xl font-semibold">Alles geleerd in deze sessie 🎉</h2>
          <p className="mt-2 text-zinc-500">
            {stats.correct} goed · {stats.incorrect} fout ·{" "}
            {stats.correct + stats.incorrect ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100) : 0}% nauwkeurig
          </p>
          {hard.length > 0 && (
            <div className="mx-auto mt-6 max-w-lg text-left">
              <h3 className="mb-2 text-sm font-medium">Hier ging het mis ({hard.length}):</h3>
              <ul className="space-y-1 text-sm">
                {hard.map((id) => {
                  const c = byId.get(id)!;
                  const p = studyPair(c, reverse);
                  return (
                    <li key={id} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                      <span className="font-medium">{p.prompt}</span> <span className="text-zinc-500">→ {p.answer}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {hard.length > 0 && <Button onClick={() => restartWith(hard)}>Oefen de moeilijke opnieuw</Button>}
            <Button variant="secondary" onClick={() => restartWith(cards.map((c) => c.id))}>Opnieuw</Button>
            <LinkButton href={`/study/${deckId}/review`} variant="secondary">Naar herhalen (SRS)</LinkButton>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <StudyHeader
        title={`${deckName} · Leren`}
        backHref={`/decks/${deckId}`}
        progress={(learned / total) * 100}
        label={`${learned}/${total} geleerd`}
        right={
          <>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={writtenOnly} onChange={(e) => setWrittenOnly(e.target.checked)} /> alleen typen
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} /> omgekeerd
            </label>
          </>
        }
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <Panel className="p-6 sm:p-8">
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
          {current.stage === "choice" ? "Kies het juiste antwoord" : "Typ het antwoord"}
          {current.mistakes > 0 && <span className="ml-2 normal-case tracking-normal text-amber-600">· nog eens oefenen</span>}
        </div>
        {card.imageUrl && !reverse && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt="" className="my-3 max-h-48 rounded-lg object-contain" />
        )}
        <div className="card-text mt-2 text-xl font-medium leading-relaxed sm:text-2xl">{pair.prompt}</div>
        {showHint && card.hints.length > 0 && <p className="mt-3 text-sm italic text-amber-600">Hint: {card.hints.join(" · ")}</p>}

        <div className="mt-8">
          {current.stage === "choice" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((o, i) => {
                const isAnswer = normalizeAnswer(o) === normalizeAnswer(pair.answer);
                const chosen = feedback?.kind === "choice" && feedback.chosen === o;
                return (
                  <button
                    key={o + i}
                    onClick={() => choose(o)}
                    disabled={!!feedback}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 text-left text-sm transition-colors",
                      !feedback && "border-zinc-200 hover:border-accent hover:bg-accent/5 dark:border-zinc-800",
                      feedback && isAnswer && "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
                      feedback && chosen && !isAnswer && "border-red-400 bg-red-50 dark:bg-red-500/10",
                      feedback && !isAnswer && !chosen && "border-zinc-200 opacity-50 dark:border-zinc-800",
                    )}
                  >
                    <Kbd>{i + 1}</Kbd>
                    <span className="card-text">{o}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWritten();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={!!feedback}
                placeholder="Typ je antwoord…"
                className="h-11 text-base"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {!feedback && (
                <Button size="lg" disabled={!typed.trim()}>
                  Controleer
                </Button>
              )}
            </form>
          )}
        </div>

        {feedback && !(feedback.kind === "choice" && feedback.correct) && (
          <div
            className={cn(
              "mt-6 rounded-xl p-4",
              isCorrect ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10",
            )}
          >
            {feedback.kind === "written" && feedback.check.verdict === "correct" && (
              <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400"><Check size={18} /> Goed!</p>
            )}
            {feedback.kind === "written" && feedback.check.verdict === "partial" && (
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Goed! Volledig antwoord: <span className="card-text">{feedback.check.expected}</span>
              </p>
            )}
            {feedback.kind === "written" && feedback.check.verdict === "typo" && (
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Bijna goed, let op de spelling: <span className="card-text">{feedback.check.expected}</span>
              </p>
            )}
            {!isCorrect && (
              <>
                <p className="flex items-center gap-2 font-medium text-red-700 dark:text-red-400"><X size={18} /> Niet helemaal.</p>
                {feedback.kind === "written" && <p className="mt-2 text-sm">Jouw antwoord: <span className="card-text text-zinc-600 line-through dark:text-zinc-400">{feedback.given}</span></p>}
                <p className="mt-1 text-sm">Juiste antwoord: <span className="card-text font-medium">{pair.answer}</span></p>
              </>
            )}
            {feedback.kind === "written" && feedback.overridden && <p className="font-medium text-emerald-700">Gemarkeerd als goed.</p>}
            {(pair.extra || card.description) && <p className="card-text mt-2 text-sm text-zinc-600 dark:text-zinc-400">{pair.extra ?? card.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => advance(Boolean(isCorrect))}>
                Doorgaan <CornerDownLeft size={14} />
              </Button>
              {feedback.kind === "written" && !feedback.check.accepted && !feedback.overridden && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    void override(card.id);
                    setStats((s) => ({ correct: s.correct + 1, incorrect: Math.max(0, s.incorrect - 1) }));
                    setFeedback({ ...feedback, overridden: true });
                  }}
                >
                  Ik had het goed
                </Button>
              )}
            </div>
          </div>
        )}

        {!feedback && (
          <div className="mt-6 flex justify-between text-xs text-zinc-500">
            {card.hints.length > 0 ? (
              <button onClick={() => setShowHint(true)} className="flex items-center gap-1 hover:underline">
                <Lightbulb size={12} /> Hint tonen
              </button>
            ) : (
              <span />
            )}
            {current.stage === "written" ? (
              <button
                onClick={() => {
                  setFeedback({ kind: "written", given: "", check: { verdict: "incorrect", accepted: false, expected: pair.answer, distance: Infinity } });
                  submitResult(false);
                }}
                className="hover:underline"
              >
                Weet ik niet
              </button>
            ) : (
              <span>
                <Kbd>1</Kbd>–<Kbd>4</Kbd> kiezen
              </span>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
