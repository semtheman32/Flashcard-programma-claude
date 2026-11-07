import Link from "next/link";
import { search } from "@/server";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { clozePrompt } from "@/lib/cards";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = await search(q, 50);
  return (
    <>
      <PageHeader title={q ? `Zoeken: “${q}”` : "Zoeken"} description={`${results.decks.length} decks · ${results.cards.length} kaarten`} />
      {results.decks.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-500">Decks</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {results.decks.map((d) => (
              <Link key={d.id} href={`/decks/${d.id}`}>
                <Panel className="flex items-center gap-3 p-4 hover:border-zinc-300 dark:hover:border-zinc-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="font-medium">{d.name}</span>
                  {d.subject && <span className="text-sm text-zinc-500">{d.subject.name}</span>}
                </Panel>
              </Link>
            ))}
          </div>
        </div>
      )}
      {results.cards.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-zinc-500">Kaarten</h2>
          <div className="space-y-2">
            {results.cards.map((c) => (
              <Link key={c.id} href={`/decks/${c.deck.id}`} className="block">
                <Panel className="grid gap-2 p-4 hover:border-zinc-300 sm:grid-cols-[1fr_1fr_auto] dark:hover:border-zinc-700">
                  <span className="card-text text-sm font-medium">{c.type === "cloze" ? clozePrompt(c.front) : c.front}</span>
                  <span className="card-text text-sm text-zinc-500">{c.back}</span>
                  <Badge color={c.deck.color}>{c.deck.name}</Badge>
                </Panel>
              </Link>
            ))}
          </div>
        </div>
      )}
      {q && !results.decks.length && !results.cards.length && <p className="text-sm text-zinc-500">Niets gevonden.</p>}
    </>
  );
}
