import Link from "next/link";
import { CalendarClock, Flame, GraduationCap, Layers, Plus, Sparkles, Target, Timer } from "lucide-react";
import { getStudyStatistics, listDecks, listSubjects } from "@/server";
import { DeckCard } from "@/components/deck-card";
import { EmptyState, LinkButton, PageHeader, Panel, Progress, Stat } from "@/components/ui";
import { ActivityBars } from "@/components/activity-bars";
import { MODE_LABELS, formatDateTime, formatDuration } from "@/lib/format";

export default async function Dashboard() {
  const [stats, decks, subjects] = await Promise.all([getStudyStatistics({ days: 14 }), listDecks(), listSubjects()]);
  const { totals } = stats;

  if (!decks.length) {
    return (
      <>
        <PageHeader title="Dashboard" description="Welkom! Begin met je eerste deck." />
        <EmptyState
          icon={<Sparkles size={28} />}
          title="Nog geen decks"
          description="Maak een deck en voeg kaarten toe, plak een lijst met vraag/antwoord-paren, of laat Claude Code een deck vullen via de agent-CLI."
          action={
            <LinkButton href="/create">
              <Plus size={16} /> Eerste deck maken
            </LinkButton>
          }
        />
      </>
    );
  }

  const dueDecks = decks.filter((d) => d.dueCount > 0).sort((a, b) => b.dueCount - a.dueCount);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          totals.dueNow > 0
            ? `${totals.dueNow} ${totals.dueNow === 1 ? "kaart is" : "kaarten zijn"} klaar om te herhalen.`
            : "Alles herhaald voor nu. Goed bezig!"
        }
        actions={
          <LinkButton href="/study/all/review" variant={totals.dueNow > 0 ? "primary" : "secondary"}>
            <GraduationCap size={16} /> Herhalen starten
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Te herhalen" value={totals.dueNow} icon={<CalendarClock size={16} />} hint={`${totals.new} nieuwe kaarten`} />
        <Stat label="Studiereeks" value={`${stats.streak} ${stats.streak === 1 ? "dag" : "dagen"}`} icon={<Flame size={16} />} hint={`${stats.week.activeDays}/7 dagen deze week`} />
        <Stat label="Vandaag" value={formatDuration(stats.today.minutes * 60)} icon={<Timer size={16} />} hint={`${stats.today.reviews} antwoorden${stats.today.accuracy !== null ? ` · ${stats.today.accuracy}% goed` : ""}`} />
        <Stat label="Beheerst" value={`${totals.mastered}/${totals.cards}`} icon={<Target size={16} />} hint={`${totals.learning} aan het leren · ${totals.decks} decks`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-medium">Activiteit (14 dagen)</h2>
            <span className="text-xs text-zinc-500">{stats.week.reviews} antwoorden · {stats.week.minutes} min deze week</span>
          </div>
          <ActivityBars activity={stats.activity} />
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-4 font-medium">Nu herhalen</h2>
          {dueDecks.length === 0 ? (
            <p className="text-sm text-zinc-500">Geen kaarten due. Nieuwe kaarten leer je via een deck of de studiepagina.</p>
          ) : (
            <ul className="space-y-2">
              {dueDecks.slice(0, 6).map((d) => (
                <li key={d.id}>
                  <Link href={`/study/${d.id}/review`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <span className="flex items-center gap-2 truncate">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="tabular-nums text-orange-600">{d.dueCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="mb-4 font-medium">Voortgang per vak</h2>
          {subjects.length === 0 ? (
            <p className="text-sm text-zinc-500">Nog geen vakken. Koppel decks aan een vak om hier voortgang te zien.</p>
          ) : (
            <ul className="space-y-4">
              {subjects.map((s) => (
                <li key={s.id}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span>{s.name}</span>
                    <span className="tabular-nums text-zinc-500">{s.progress}%</span>
                  </div>
                  <Progress value={s.progress} color={s.color} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-medium">Recente sessies</h2>
          {stats.recentSessions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nog geen studiesessies.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="pb-2 font-medium">Wanneer</th>
                    <th className="pb-2 font-medium">Deck</th>
                    <th className="hidden pb-2 font-medium sm:table-cell">Modus</th>
                    <th className="pb-2 text-right font-medium">Kaarten</th>
                    <th className="pb-2 pl-3 text-right font-medium">Goed</th>
                    <th className="pb-2 pl-3 text-right font-medium">Tijd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {stats.recentSessions.slice(0, 6).map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 text-zinc-500">{formatDateTime(s.startedAt)}</td>
                      <td className="py-2">{s.deck?.name ?? "Alle decks"}</td>
                      <td className="hidden py-2 sm:table-cell">{MODE_LABELS[s.mode] ?? s.mode}</td>
                      <td className="py-2 text-right tabular-nums">{s.cardsStudied}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">
                        {s.cardsStudied ? Math.round((s.correct / s.cardsStudied) * 100) : 0}%
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums">{formatDuration(s.durationSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium">Recente decks</h2>
          <Link href="/library" className="text-sm text-accent hover:underline">
            Alle decks
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.slice(0, 6).map((d) => (
            <DeckCard key={d.id} deck={d} />
          ))}
        </div>
      </div>
      <p className="mt-8 flex items-center gap-2 text-xs text-zinc-400">
        <Layers size={12} /> {totals.cards} kaarten in {totals.decks} decks · alle cijfers komen uit je opgeslagen studiesessies
      </p>
    </>
  );
}
