import Link from "next/link";
import { getStudyStatistics, getWeakCards, listDecks } from "@/server";
import { ActivityBars } from "@/components/activity-bars";
import { PageHeader, Panel, Progress, Stat } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { clozePrompt } from "@/lib/cards";

export default async function StatsPage() {
  const [stats, decks, weak] = await Promise.all([getStudyStatistics({ days: 30 }), listDecks(), getWeakCards(undefined, 15)]);
  const { totals } = stats;
  const totalMinutes = stats.activity.reduce((a, d) => a + d.minutes, 0);
  return (
    <>
      <PageHeader title="Statistieken" description="Berekend uit je opgeslagen studiesessies en antwoorden (laatste 30 dagen)." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kaarten" value={totals.cards} hint={`${totals.decks} decks`} />
        <Stat label="Beheerst" value={totals.mastered} hint={`interval ≥ 21 dagen`} />
        <Stat label="Aan het leren" value={totals.learning} hint={`${totals.new} nog nieuw`} />
        <Stat label="Nauwkeurigheid" value={stats.correctVsIncorrect.accuracy !== null ? `${stats.correctVsIncorrect.accuracy}%` : "—"} hint={`${stats.correctVsIncorrect.correct} goed · ${stats.correctVsIncorrect.incorrect} fout`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Studiereeks" value={`${stats.streak} d`} />
        <Stat label="Studietijd (30 d)" value={formatDuration(totalMinutes * 60)} />
        <Stat label="Deze week" value={`${stats.week.reviews}`} hint="antwoorden" />
        <Stat label="Nieuwe kaarten geleerd" value={stats.activity.reduce((a, d) => a + d.newCardsLearned, 0)} hint="30 dagen, in herhaalmodus" />
      </div>

      <Panel className="mt-6 p-5">
        <h2 className="mb-4 font-medium">Antwoorden per dag</h2>
        <ActivityBars activity={stats.activity} />
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-4 font-medium">Voortgang per deck</h2>
          {decks.length === 0 ? (
            <p className="text-sm text-zinc-500">Nog geen decks.</p>
          ) : (
            <ul className="space-y-4">
              {decks.map((d) => (
                <li key={d.id}>
                  <div className="mb-1.5 flex justify-between gap-2 text-sm">
                    <Link href={`/decks/${d.id}`} className="truncate hover:underline">{d.name}</Link>
                    <span className="shrink-0 tabular-nums text-zinc-500">
                      {d.statusCounts.mastered}/{d.cardCount} beheerst · {d.progress}%
                    </span>
                  </div>
                  <Progress value={d.progress} color={d.color} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-1 font-medium">Moeilijkste kaarten</h2>
          <p className="mb-4 text-xs text-zinc-500">Op basis van vergeten kaarten, ease-factor en recente foute antwoorden.</p>
          {weak.length === 0 ? (
            <p className="text-sm text-zinc-500">Nog geen moeilijke kaarten gevonden.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {weak.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 py-2">
                  <Link href={`/decks/${c.deckId}`} className="min-w-0 truncate hover:underline">
                    {c.type === "cloze" ? clozePrompt(c.front) : c.front}
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {c.incorrect}/{c.attempts} fout{c.lapses ? ` · ${c.lapses}× vergeten` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="mt-6 text-xs text-zinc-400">Uitgebreide grafieken (studietijd, nauwkeurigheid over tijd) volgen in stap 2.</p>
    </>
  );
}
