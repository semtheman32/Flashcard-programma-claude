import Link from "next/link";
import { Layers } from "lucide-react";
import type { DeckSummary } from "@/server";
import { Badge, Panel, Progress } from "./ui";

export function DeckCard({ deck }: { deck: DeckSummary }) {
  return (
    <Link href={`/decks/${deck.id}`} className="group block">
      <Panel className="h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-zinc-300 group-hover:shadow-sm dark:group-hover:border-zinc-700">
        <div className="flex items-start justify-between gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${deck.color}1f`, color: deck.color }}
          >
            <Layers size={18} />
          </span>
          {deck.dueCount > 0 && <Badge color="#ea580c">{deck.dueCount} te herhalen</Badge>}
        </div>
        <h3 className="mt-4 font-medium leading-snug">{deck.name}</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {deck.cardCount} {deck.cardCount === 1 ? "kaart" : "kaarten"}
          {deck.subject && <> · {deck.subject.name}</>}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={deck.progress} color={deck.color} />
          <span className="text-xs tabular-nums text-zinc-500">{deck.progress}%</span>
        </div>
      </Panel>
    </Link>
  );
}
