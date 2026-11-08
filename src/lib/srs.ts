/**
 * Spaced repetition: SM-2 (Wozniak, 1987) with four answer buttons.
 *
 * Button → SM-2 quality (q):  again = 1, hard = 3, good = 4, easy = 5
 *
 * Ease factor update (standard SM-2):
 *   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),  minimum 1.3
 *   → again −0.54 (we cap the penalty at −0.20), hard −0.14, good ±0, easy +0.10
 *
 * Interval (days):
 *   again            → repetitions = 0, lapses + 1, card is shown again in 10 minutes
 *   1st success      → hard 1, good 1, easy 4
 *   2nd success      → hard 3, good 6, easy 8
 *   later successes  → hard: I × 1.2, good: I × EF', easy: I × EF' × 1.3
 *   (always at least previous interval + 1, so a success never shrinks the interval)
 *
 * Status (derived, never set by "answered correctly once"):
 *   new       never reviewed in review mode
 *   learning  repetitions < 2 (still in the first steps or just lapsed)
 *   review    repetitions ≥ 2 and interval < 21 days
 *   mastered  interval ≥ 21 days (mature card, Anki-style threshold)
 */

export const RATINGS = ["again", "hard", "good", "easy"] as const;
export type Rating = (typeof RATINGS)[number];
export type CardStatus = "new" | "learning" | "review" | "mastered";

export const MASTERED_INTERVAL_DAYS = 21;
export const RELEARN_MINUTES = 10;
export const MIN_EASE = 1.3;

export interface SrsState {
  easeFactor: number;
  interval: number; // days
  repetitions: number;
  lapses: number;
}

export interface SrsResult extends SrsState {
  status: CardStatus;
  dueAt: Date;
  lastReviewedAt: Date;
}

const QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function statusFor(state: Pick<SrsState, "interval" | "repetitions">, reviewed = true): CardStatus {
  if (!reviewed) return "new";
  if (state.repetitions < 2) return "learning";
  if (state.interval >= MASTERED_INTERVAL_DAYS) return "mastered";
  return "review";
}

export function schedule(state: SrsState, rating: Rating, now: Date = new Date()): SrsResult {
  const q = QUALITY[rating];
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  let easeFactor = Math.max(MIN_EASE, state.easeFactor + Math.max(efDelta, -0.2));
  easeFactor = Math.round(easeFactor * 100) / 100;

  if (rating === "again") {
    const next = { easeFactor, interval: 0, repetitions: 0, lapses: state.lapses + 1 };
    return {
      ...next,
      status: "learning",
      dueAt: new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000),
      lastReviewedAt: now,
    };
  }

  let interval: number;
  if (state.repetitions === 0) {
    interval = rating === "easy" ? 4 : 1;
  } else if (state.repetitions === 1) {
    interval = rating === "hard" ? 3 : rating === "good" ? 6 : 8;
  } else {
    const base = Math.max(1, state.interval);
    const factor = rating === "hard" ? 1.2 : rating === "good" ? easeFactor : easeFactor * 1.3;
    interval = Math.max(base + 1, Math.round(base * factor));
  }

  const next = { easeFactor, interval, repetitions: state.repetitions + 1, lapses: state.lapses };
  return {
    ...next,
    status: statusFor(next),
    dueAt: new Date(now.getTime() + interval * DAY_MS),
    lastReviewedAt: now,
  };
}

/** Human readable preview of the next interval for a button ("10 min", "6 d", "2 mnd"). */
export function formatInterval(result: SrsResult, now: Date = new Date()): string {
  const ms = result.dueAt.getTime() - now.getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const days = Math.round(ms / DAY_MS);
  if (days < 31) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mnd`;
  return `${(days / 365).toFixed(1)} jr`;
}
