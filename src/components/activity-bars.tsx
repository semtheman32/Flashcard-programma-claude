import type { DayActivity } from "@/server/stats";

/** Simple stacked bar chart (correct / incorrect per day), no chart library needed. */
export function ActivityBars({ activity }: { activity: DayActivity[] }) {
  const max = Math.max(1, ...activity.map((d) => d.reviews));
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Antwoorden per dag">
        {activity.map((d) => {
          const h = (d.reviews / max) * 100;
          const correctShare = d.reviews ? d.correct / d.reviews : 0;
          return (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="flex w-full flex-col overflow-hidden rounded-md" style={{ height: `${Math.max(h, d.reviews ? 4 : 0)}%` }}>
                <div className="bg-red-400/80 dark:bg-red-500/70" style={{ height: `${(1 - correctShare) * 100}%` }} />
                <div className="flex-1 bg-accent" />
              </div>
              {d.reviews === 0 && <div className="h-1 w-full rounded bg-zinc-100 dark:bg-zinc-800" />}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-zinc-700">
                {new Date(`${d.date}T00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}: {d.reviews} antw. · {d.correct} goed · {d.minutes} min
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 text-[10px] text-zinc-400">
        {activity.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 2 === activity.length % 2 ? new Date(`${d.date}T00:00`).getDate() : ""}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" /> Goed</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-400" /> Fout</span>
      </div>
    </div>
  );
}
