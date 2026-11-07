"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { studyPair } from "@/lib/cards";
import { RATINGS, formatInterval, schedule, type Rating } from "@/lib/srs";
import type { CardDTO } from "@/server/mappers";
import { cn } from "@/lib/cn";
import { Button, Kbd, LinkButton, Panel } from "../ui";
import { CardFace } from "../card-face";
import { StudyHeader } from "./study-header";
import { isTyping, useStudySession } from "./use-session";

const RATING_UI: Record<Rating, { label: string; className: string }> = {
  again: { label: "Opnieuw", className: "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-500/10" },
  hard: { label: "Moeilijk", className: "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-500/10" },
  good: { label: "Goed", className: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-500/10" },
  easy: { label: "Makkelijk", className: "border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-400 dark:hover:bg-sky-500/10" },
};

/** Cards rated "Opnieuw" come back within this session (Anki-style relearning step). */
const RELEARN_WITHIN_SESSION = true;

export function ReviewSession({
  cards,
  deckId,
  title,
  backHref,
  newCount,
  dueLaterToday,
}: {
  cards: CardDTO[];
  deckId: string | null;
  title: string;
  backHref: string;
  newCount: number;
  dueLaterToday: number;
}) {
  const { record, error } = useStudySession("review", deckId);
  const [queue, setQueue] = useState<CardDTO[]>(cards);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const card = queue[0];
  const pair = card ? studyPair(card) : null;
  const previews = useMemo(() => {
    if (!card) return null;
    const now = new Date();
    return Object.fromEntries(RATINGS.map((r) => [r, formatInterval(schedule(card, r, now), now)])) as Record<Rating, string>;
  }, [card]);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card || !revealed || busy) return;
      setBusy(true);
      const result = await record(card.id, rating);
      setBusy(false);
      setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
      setRevealed(false);
      setShowHint(false);
      const rest = queue.slice(1);
      if (rating === "again" && RELEARN_WITHIN_SESSION && result) {
        const pos = Math.min(rest.length, 3 + Math.floor(Math.random() * 3));
        setQueue([...rest.slice(0, pos), result.card, ...rest.slice(pos)]);
      } else {
        setDoneIds((s) => new Set(s).add(card.id));
        setQueue(rest);
      }
    },
    [card, revealed, busy, record, queue],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || !card) return;
      if ((e.key === " " || e.key === "Enter") && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        void rate(RATINGS[Number(e.key) - 1]);
      } else if (e.key === " " && revealed) {
        e.preventDefault();
        void rate("good");
      } else if (e.key.toLowerCase() === "h") setShowHint(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, revealed, rate]);

  const total = cards.length;
  const reviewed = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <StudyHeader title={title} backHref={backHref} progress={100} label="0 due" />
        <Panel className="p-8 text-center">
          <h2 className="text-xl font-semibold">Niets te herhalen</h2>
          <p className="mt-2 text-zinc-500">
            Alle kaarten zijn bijgewerkt{dueLaterToday > 0 ? `; later vandaag worden er nog ${dueLaterToday} due` : ""}. Het dagelijkse maximum voor
            nieuwe kaarten stel je in bij Instellingen.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {deckId && <LinkButton href={`/study/${deckId}/learn`}>Leren</LinkButton>}
            <LinkButton href={backHref} variant="secondary">Terug</LinkButton>
          </div>
        </Panel>
      </div>
    );
  }

  if (!card || !pair) {
    return (
      <div className="mx-auto max-w-3xl">
        <StudyHeader title={title} backHref={backHref} progress={100} label={`${doneIds.size}/${total}`} />
        <Panel className="p-8 text-center">
          <h2 className="text-xl font-semibold">Sessie klaar</h2>
          <p className="mt-2 text-zinc-500">
            {reviewed} beoordelingen: {counts.again}× opnieuw · {counts.hard}× moeilijk · {counts.good}× goed · {counts.easy}× makkelijk
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <LinkButton href={backHref}>Klaar</LinkButton>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <StudyHeader
        title={title}
        backHref={backHref}
        progress={(doneIds.size / total) * 100}
        label={`${doneIds.size}/${total}`}
        right={newCount > 0 ? <span className="text-xs">{newCount} nieuw</span> : undefined}
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-2 flex justify-center gap-2 text-xs text-zinc-500">
        {card.status === "new" ? (
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">Nieuwe kaart</span>
        ) : (
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            {card.repetitions}× goed op rij · interval {card.interval} d{card.lapses ? ` · ${card.lapses}× vergeten` : ""}
          </span>
        )}
      </div>

      <button onClick={() => setRevealed(true)} className="block w-full text-left" disabled={revealed}>
        <CardFace
          text={pair.prompt}
          imageUrl={card.imageUrl ?? undefined}
          hint={showHint && card.hints.length ? card.hints.join(" · ") : undefined}
          className={cn(revealed && "rounded-b-none border-b-0")}
        />
      </button>
      {revealed && (
        <div className="rounded-b-2xl border border-t-dashed border-zinc-200 bg-zinc-50/50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="card-text text-xl font-medium">{pair.answer}</div>
          {(pair.extra || card.description) && <div className="card-text mt-3 text-sm text-zinc-500">{pair.extra ?? card.description}</div>}
        </div>
      )}

      <div className="mt-6">
        {revealed ? (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r, i) => (
              <button
                key={r}
                disabled={busy}
                onClick={() => void rate(r)}
                className={cn("flex flex-col items-center rounded-xl border bg-white py-3 transition-colors dark:bg-zinc-900", RATING_UI[r].className)}
              >
                <span className="text-sm font-medium">{RATING_UI[r].label}</span>
                <span className="mt-0.5 text-xs opacity-70">{previews?.[r]}</span>
                <span className="mt-1 hidden sm:block"><Kbd>{i + 1}</Kbd></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex justify-center">
            <Button size="lg" onClick={() => setRevealed(true)}>
              Toon antwoord <Kbd>Spatie</Kbd>
            </Button>
          </div>
        )}
      </div>
      {!revealed && card.hints.length > 0 && (
        <div className="mt-4 text-center">
          <button onClick={() => setShowHint(true)} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:underline">
            <Lightbulb size={12} /> Hint (<Kbd>H</Kbd>)
          </button>
        </div>
      )}
    </div>
  );
}
