import { prisma } from "@/lib/db";
import { addDays, computeStreak, dayKey, startOfDay } from "@/lib/dates";
import { emptyCounts, progressFrom, type StatusCounts } from "./mappers";

export interface StatsFilters {
  deckId?: string;
  subjectId?: string;
  /** Number of days for the activity series (default 14). */
  days?: number;
}

export interface DayActivity {
  date: string;
  reviews: number;
  correct: number;
  incorrect: number;
  minutes: number;
  newCardsLearned: number;
}

/** All numbers are computed from stored cards, study sessions and review records. */
export async function getStudyStatistics(filters: StatsFilters = {}) {
  const days = filters.days ?? 14;
  const now = new Date();
  const today = startOfDay(now);
  const from = addDays(today, -(days - 1));

  const cardWhere = {
    ...(filters.deckId ? { deckId: filters.deckId } : {}),
    ...(filters.subjectId ? { deck: { subjectId: filters.subjectId } } : {}),
  };
  const deckWhere = {
    ...(filters.deckId ? { id: filters.deckId } : {}),
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
  };
  const sessionWhere = {
    ...(filters.deckId ? { deckId: filters.deckId } : {}),
    ...(filters.subjectId ? { deck: { subjectId: filters.subjectId } } : {}),
  };

  const [statusGroups, totalDecks, dueNow, reviewsInRange, sessionsInRange, allReviewDays, recentSessions] =
    await Promise.all([
      prisma.card.groupBy({ by: ["status"], where: cardWhere, _count: { _all: true } }),
      prisma.deck.count({ where: deckWhere }),
      prisma.card.count({ where: { ...cardWhere, status: { not: "new" }, dueAt: { lte: now } } }),
      prisma.review.findMany({
        where: { reviewedAt: { gte: from }, card: cardWhere },
        select: { reviewedAt: true, correct: true, wasNew: true },
      }),
      prisma.studySession.findMany({
        where: { ...sessionWhere, startedAt: { gte: addDays(from, -1) } },
        select: { startedAt: true, durationSec: true },
      }),
      prisma.review.findMany({
        where: { card: cardWhere, reviewedAt: { gte: addDays(today, -400) } },
        select: { reviewedAt: true },
      }),
      prisma.studySession.findMany({
        where: { ...sessionWhere, cardsStudied: { gt: 0 } },
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { deck: { select: { id: true, name: true, color: true } } },
      }),
    ]);

  const counts: StatusCounts = emptyCounts();
  for (const g of statusGroups) counts[g.status as keyof StatusCounts] += g._count._all;
  const totalCards = counts.new + counts.learning + counts.review + counts.mastered;

  const series = new Map<string, DayActivity>();
  for (let i = 0; i < days; i++) {
    const key = dayKey(addDays(from, i));
    series.set(key, { date: key, reviews: 0, correct: 0, incorrect: 0, minutes: 0, newCardsLearned: 0 });
  }
  for (const r of reviewsInRange) {
    const d = series.get(dayKey(r.reviewedAt));
    if (!d) continue;
    d.reviews++;
    if (r.correct) d.correct++;
    else d.incorrect++;
    if (r.wasNew) d.newCardsLearned++;
  }
  for (const s of sessionsInRange) {
    const d = series.get(dayKey(s.startedAt));
    if (d) d.minutes += s.durationSec / 60;
  }
  const activity = [...series.values()].map((d) => ({ ...d, minutes: Math.round(d.minutes * 10) / 10 }));
  const todayStats = activity[activity.length - 1];
  const last7 = activity.slice(-7);
  const totalCorrect = activity.reduce((a, d) => a + d.correct, 0);
  const totalIncorrect = activity.reduce((a, d) => a + d.incorrect, 0);

  const streak = computeStreak(new Set(allReviewDays.map((r) => dayKey(r.reviewedAt))), now);

  return {
    totals: {
      cards: totalCards,
      decks: totalDecks,
      statusCounts: counts,
      mastered: counts.mastered,
      learning: counts.learning + counts.review,
      new: counts.new,
      dueNow,
      progress: progressFrom(counts),
    },
    today: {
      reviews: todayStats?.reviews ?? 0,
      minutes: todayStats?.minutes ?? 0,
      accuracy: todayStats && todayStats.reviews ? Math.round((todayStats.correct / todayStats.reviews) * 100) : null,
    },
    week: {
      reviews: last7.reduce((a, d) => a + d.reviews, 0),
      minutes: Math.round(last7.reduce((a, d) => a + d.minutes, 0)),
      activeDays: last7.filter((d) => d.reviews > 0).length,
    },
    streak,
    correctVsIncorrect: {
      correct: totalCorrect,
      incorrect: totalIncorrect,
      accuracy: totalCorrect + totalIncorrect ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100) : null,
    },
    activity,
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      mode: s.mode,
      deck: s.deck,
      startedAt: s.startedAt,
      durationSec: s.durationSec,
      cardsStudied: s.cardsStudied,
      correct: s.correct,
      incorrect: s.incorrect,
    })),
  };
}
