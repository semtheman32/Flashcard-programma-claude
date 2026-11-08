import { describe, expect, it } from "vitest";
import { MASTERED_INTERVAL_DAYS, schedule, statusFor, type SrsState } from "@/lib/srs";

const fresh: SrsState = { easeFactor: 2.5, interval: 0, repetitions: 0, lapses: 0 };
const now = new Date("2026-01-01T12:00:00");
const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86400000);

describe("SM-2 scheduling", () => {
  it("first good answer: 1 day, then 6 days, then interval × ease", () => {
    const a = schedule(fresh, "good", now);
    expect(a.interval).toBe(1);
    expect(days(a.dueAt)).toBe(1);
    const b = schedule(a, "good", now);
    expect(b.interval).toBe(6);
    const c = schedule(b, "good", now);
    expect(c.interval).toBe(15); // 6 × 2.5
    expect(c.easeFactor).toBe(2.5);
  });

  it("again resets repetitions, counts a lapse, lowers ease and relearns in 10 minutes", () => {
    const learned = schedule(schedule(fresh, "good", now), "good", now);
    const lapsed = schedule(learned, "again", now);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.interval).toBe(0);
    expect(lapsed.easeFactor).toBe(2.3);
    expect(lapsed.dueAt.getTime() - now.getTime()).toBe(10 * 60 * 1000);
    expect(lapsed.status).toBe("learning");
  });

  it("hard lowers ease, easy raises it, ease never below 1.3", () => {
    expect(schedule(fresh, "hard", now).easeFactor).toBe(2.36);
    expect(schedule(fresh, "easy", now).easeFactor).toBe(2.6);
    let s: SrsState = fresh;
    for (let i = 0; i < 20; i++) s = schedule(s, "again", now);
    expect(s.easeFactor).toBe(1.3);
  });

  it("easy gives longer intervals than good, hard shorter", () => {
    const base = schedule(schedule(fresh, "good", now), "good", now);
    const hard = schedule(base, "hard", now).interval;
    const good = schedule(base, "good", now).interval;
    const easy = schedule(base, "easy", now).interval;
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
  });

  it("a single correct answer never marks a card as mastered", () => {
    expect(schedule(fresh, "easy", now).status).toBe("learning");
    let s = schedule(fresh, "good", now);
    expect(s.status).toBe("learning");
    s = schedule(s, "good", now);
    expect(s.status).toBe("review");
    while (s.interval < MASTERED_INTERVAL_DAYS) s = schedule(s, "good", now);
    expect(s.status).toBe("mastered");
  });

  it("statusFor reports new for unreviewed cards", () => {
    expect(statusFor(fresh, false)).toBe("new");
  });
});
