/** Local-time day helpers (the app runs on your own computer, so server time = your time). */

export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Consecutive days with activity ending today (or yesterday, if you haven't studied yet today). */
export function computeStreak(activeDays: Set<string>, today: Date = new Date()): number {
  let cursor = startOfDay(today);
  if (!activeDays.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
