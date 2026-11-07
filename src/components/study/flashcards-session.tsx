"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lightbulb, Repeat, RotateCcw, Shuffle, X } from "lucide-react";
import { studyPair } from "@/lib/cards";
import type { CardDTO } from "@/server/mappers";
import { cn } from "@/lib/cn";
import { Button, Kbd, LinkButton, Panel } from "../ui";
import { CardFace } from "../card-face";
import { StudyHeader } from "./study-header";
import { isTyping, shuffle, useStudySession } from "./use-session";

export function FlashcardsSession({ cards, deckId, deckName }: { cards: CardDTO[]; deckId: string; deckName: string }) {
  const { record, restart, error } = useStudySession("flashcards", deckId);
  const [order, setOrder] = useState(() => cards.map((c) => c.id));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [marks, setMarks] = useState<Record<string, "known" | "unknown">>({});
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const finished = idx >= order.length;
  const card = !finished ? byId.get(order[idx])! : null;
  const pair = card ? studyPair(card, reverse) : null;

  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setShowHint(false);
      setIdx((i) => Math.max(0, Math.min(order.length, i + delta)));
    },
    [order.length],
  );

  const mark = useCallback(
    (rating: "known" | "unknown") => {
      if (!card) return;
      setMarks((m) => ({ ...m, [card.id]: rating }));
      void record(card.id, rating);
      go(1);
    },
    [card, record, go],
  );

  const reset = (ids: string[]) => {
    setOrder(ids);
    setIdx(0);
    setFlipped(false);
    setMarks({});
    restart();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!finished) setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "1" || e.key.toLowerCase() === "j") mark("unknown");
      else if (e.key === "2" || e.key.toLowerCase() === "k") mark("known");
      else if (e.key.toLowerCase() === "h") setShowHint(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, mark, finished]);

  const known = Object.values(marks).filter((m) => m === "known").length;
  const unknownIds = order.filter((id) => marks[id] === "unknown");

  return (
    <div className="mx-auto max-w-3xl">
      <StudyHeader
        title={`${deckName} · Flashcards`}
        backHref={`/decks/${deckId}`}
        progress={(Math.min(idx, order.length) / order.length) * 100}
        label={`${Math.min(idx + 1, order.length)} / ${order.length}`}
        right={
          <>
            <Button variant="ghost" size="sm" onClick={() => reset(shuffle(order))} title="Schudden">
              <Shuffle size={15} />
            </Button>
            <Button variant={reverse ? "primary" : "ghost"} size="sm" onClick={() => { setReverse(!reverse); setFlipped(false); }} title="Omgekeerd: antwoord eerst">
              <Repeat size={15} />
            </Button>
          </>
        }
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {finished ? (
        <Panel className="p-8 text-center">
          <h2 className="text-xl font-semibold">Ronde klaar</h2>
          <p className="mt-2 text-zinc-500">
            {known} gekend · {unknownIds.length} nog niet · {order.length - known - unknownIds.length} overgeslagen
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {unknownIds.length > 0 && (
              <Button onClick={() => reset(unknownIds)}>
                <RotateCcw size={16} /> Oefen de {unknownIds.length} onbekende
              </Button>
            )}
            <Button variant="secondary" onClick={() => reset(cards.map((c) => c.id))}>
              Opnieuw beginnen
            </Button>
            <LinkButton href={`/study/${deckId}/learn`} variant="secondary">Verder met Leren</LinkButton>
          </div>
        </Panel>
      ) : (
        card &&
        pair && (
          <>
            <div className="flip-scene">
              <button
                onClick={() => setFlipped(!flipped)}
                onMouseDown={(e) => e.preventDefault()}
                tabIndex={-1}
                className={cn("flip-card grid w-full text-left", flipped && "flipped")}
                aria-label={flipped ? "Toon voorkant" : "Toon achterkant"}
              >
                <div className="flip-face [grid-area:1/1]">
                  <CardFace
                    label={reverse ? "Antwoord" : "Voorkant"}
                    text={pair.prompt}
                    imageUrl={!reverse ? card.imageUrl ?? undefined : undefined}
                    hint={showHint && card.hints.length ? card.hints.join(" · ") : undefined}
                  />
                </div>
                <div className="flip-face flip-back [grid-area:1/1]">
                  <CardFace label={reverse ? "Vraag" : "Achterkant"} text={pair.answer} extra={pair.extra ?? card.description ?? undefined} imageUrl={reverse ? card.imageUrl ?? undefined : undefined} />
                </div>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => go(-1)} disabled={idx === 0} aria-label="Vorige">
                <ArrowLeft size={18} />
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="lg" onClick={() => mark("unknown")} className={cn(marks[card.id] === "unknown" && "border-red-300 text-red-600")}>
                  <X size={18} /> Nog niet
                </Button>
                <Button variant="secondary" size="lg" onClick={() => mark("known")} className={cn(marks[card.id] === "known" && "border-emerald-300 text-emerald-600")}>
                  <Check size={18} /> Ken ik
                </Button>
              </div>
              <Button variant="ghost" onClick={() => go(1)} aria-label="Volgende">
                <ArrowRight size={18} />
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span><Kbd>Spatie</Kbd> omdraaien</span>
              <span><Kbd>←</Kbd> <Kbd>→</Kbd> navigeren</span>
              <span><Kbd>1</Kbd> nog niet</span>
              <span><Kbd>2</Kbd> ken ik</span>
              {card.hints.length > 0 && (
                <button onClick={() => setShowHint(true)} className="flex items-center gap-1 hover:underline">
                  <Lightbulb size={12} /> <Kbd>H</Kbd> hint
                </button>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
