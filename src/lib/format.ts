export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} u ${min % 60} min`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relativeDue(d: Date | string | null | undefined, now = new Date()): string {
  if (!d) return "—";
  const ms = new Date(d).getTime() - now.getTime();
  if (ms <= 0) return "nu";
  const min = Math.round(ms / 60000);
  if (min < 60) return `over ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `over ${h} u`;
  const days = Math.round(h / 24);
  return `over ${days} ${days === 1 ? "dag" : "dagen"}`;
}

export const MODE_LABELS: Record<string, string> = {
  flashcards: "Flashcards",
  learn: "Leren",
  review: "Herhalen (SRS)",
};
