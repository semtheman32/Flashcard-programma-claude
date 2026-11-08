import Link from "next/link";
import { BookOpenCheck, GraduationCap, Layers, Zap } from "lucide-react";
import { countDueLaterToday, getDueCards, listDecks } from "@/server";
import { EmptyState, LinkButton, PageHeader, Panel, Progress, buttonClass } from "@/components/ui";

export default async function StudyPage() {
  const [decks, due, later] = await Promise.all([listDecks(), getDueCards(), countDueLaterToday()]);
  const totalDue = due.due.length;
  return (
    <>
      <PageHeader
        title="Studeren"
        description="Kies een deck en een studiemodus, of herhaal alles wat due is."
      />
      <Panel className="mb-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Herhalen met spaced repetition</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {totalDue} te herhalen · {due.new.length} nieuwe kaarten voor vandaag
            {later > 0 && ` · later vandaag nog ${later}`}
          </p>
        </div>
        <LinkButton href="/study/all/review" size="lg" variant={totalDue + due.new.length ? "primary" : "secondary"}>
          <GraduationCap size={18} /> Alles herhalen
        </LinkButton>
      </Panel>

      {decks.length === 0 ? (
        <EmptyState icon={<Layers size={28} />} title="Nog geen decks" action={<LinkButton href="/create">Deck maken</LinkButton>} />
      ) : (
        <div className="space-y-2">
          {decks.map((d) => (
            <Panel key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Link href={`/decks/${d.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.name}</span>
                  <span className="text-xs text-zinc-500">
                    {d.cardCount} kaarten · {d.statusCounts.new} nieuw · {d.statusCounts.mastered} beheerst
                  </span>
                </span>
              </Link>
              <div className="flex items-center gap-3 sm:w-40">
                <Progress value={d.progress} color={d.color} />
                <span className="text-xs tabular-nums text-zinc-500">{d.progress}%</span>
              </div>
              <div className="flex gap-1.5">
                <Link href={`/study/${d.id}/flashcards`} className={buttonClass("ghost", "sm")} title="Flashcards">
                  <BookOpenCheck size={15} /> Kaarten
                </Link>
                <Link href={`/study/${d.id}/learn`} className={buttonClass("ghost", "sm")} title="Leren">
                  <Zap size={15} /> Leren
                </Link>
                <Link href={`/study/${d.id}/review`} className={buttonClass(d.dueCount ? "primary" : "secondary", "sm")}>
                  <GraduationCap size={15} /> {d.dueCount ? `${d.dueCount} herhalen` : "Herhalen"}
                </Link>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
