import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { listDecks, listSubjects } from "@/server";
import { DeckCard } from "@/components/deck-card";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ subject?: string; sort?: string }> }) {
  const { subject, sort = "recent" } = await searchParams;
  const [allDecks, subjects] = await Promise.all([listDecks(), listSubjects()]);
  let decks = allDecks;
  if (subject === "none") decks = decks.filter((d) => !d.subjectId);
  else if (subject) decks = decks.filter((d) => d.subjectId === subject);
  if (sort === "name") decks = [...decks].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "due") decks = [...decks].sort((a, b) => b.dueCount - a.dueCount);
  if (sort === "progress") decks = [...decks].sort((a, b) => a.progress - b.progress);

  const qs = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const merged = { subject, sort, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) s.set(k, v);
    return `/library?${s.toString()}`;
  };
  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm transition-colors",
      active
        ? "border-accent bg-accent text-white"
        : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800",
    );

  return (
    <>
      <PageHeader
        title="Mijn bibliotheek"
        description={`${allDecks.length} decks · ${allDecks.reduce((a, d) => a + d.cardCount, 0)} kaarten`}
        actions={
          <LinkButton href="/create">
            <Plus size={16} /> Nieuw deck
          </LinkButton>
        }
      />
      {allDecks.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} />}
          title="Je bibliotheek is leeg"
          description="Maak je eerste deck aan of importeer een JSON-bestand."
          action={<LinkButton href="/create">Deck maken</LinkButton>}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Link href={qs({ subject: undefined })} className={chip(!subject)}>Alles</Link>
              {subjects.map((s) => (
                <Link key={s.id} href={qs({ subject: s.id })} className={chip(subject === s.id)}>
                  {s.name}
                </Link>
              ))}
              <Link href={qs({ subject: "none" })} className={chip(subject === "none")}>Zonder vak</Link>
            </div>
            <div className="flex gap-1 text-sm">
              {[
                ["recent", "Recent"],
                ["name", "Naam"],
                ["due", "Te herhalen"],
                ["progress", "Minste voortgang"],
              ].map(([k, label]) => (
                <Link
                  key={k}
                  href={qs({ sort: k })}
                  className={cn("rounded-md px-2 py-1", sort === k ? "bg-zinc-200/70 font-medium dark:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100")}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          {decks.length === 0 ? (
            <p className="text-sm text-zinc-500">Geen decks in deze selectie.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((d) => (
                <DeckCard key={d.id} deck={d} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
