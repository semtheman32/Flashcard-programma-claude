import { z } from "zod";
import { prisma } from "@/lib/db";
import { startOfDay } from "@/lib/dates";
import { RATINGS, schedule, type Rating } from "@/lib/srs";
import { NotFoundError } from "./errors";
import { toCardDTO, type CardDTO } from "./mappers";
import { getSettings } from "./settings";

export const STUDY_MODES = ["flashcards", "learn", "review"] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

/** Seconds of inactivity after which time stops counting towards study time. */
const MAX_GAP_SEC = 120;

export async function startSession(mode: StudyMode, deckId?: string | null) {
  if (deckId) {
    const deck = await prisma.deck.findUnique({ where: { id: deckId }, select: { id: true } });
    if (!deck) throw new NotFoundError("Deck", deckId);
  }
  return prisma.studySession.create({ data: { mode, deckId: deckId ?? null } });
}

const reviewInput = z.object({
  sessionId: z.string().optional(),
  cardId: z.string(),
  mode: z.enum(STUDY_MODES),
  /** review: again|hard|good|easy · flashcards: known|unknown · learn: correct|incorrect */
  rating: z.string(),
});

/**
 * Records one answer. In "review" mode this applies SM-2 and reschedules the card.
 * Flashcards and Learn answers are logged (for statistics and weak-card analysis) but do not
 * change the spaced repetition schedule.
 */
export async function recordReview(input: z.input<typeof reviewInput>) {
  const data = reviewInput.parse(input);
  const card = await prisma.card.findUnique({ where: { id: data.cardId } });
  if (!card) throw new NotFoundError("Card", data.cardId);
  const now = new Date();

  let correct: boolean;
  let srsUpdate: Awaited<ReturnType<typeof schedule>> | null = null;
  if (data.mode === "review") {
    if (!RATINGS.includes(data.rating as Rating)) throw new Error(`invalid rating for review mode: ${data.rating}`);
    srsUpdate = schedule(card, data.rating as Rating, now);
    correct = data.rating !== "again";
  } else if (data.mode === "flashcards") {
    if (!["known", "unknown"].includes(data.rating)) throw new Error(`invalid rating for flashcards: ${data.rating}`);
    correct = data.rating === "known";
  } else {
    if (!["correct", "incorrect"].includes(data.rating)) throw new Error(`invalid rating for learn: ${data.rating}`);
    correct = data.rating === "correct";
  }

  const ops = [];
  ops.push(
    prisma.review.create({
      data: {
        cardId: card.id,
        sessionId: data.sessionId,
        mode: data.mode,
        rating: data.rating,
        correct,
        reviewedAt: now,
        intervalBefore: data.mode === "review" ? card.interval : null,
        intervalAfter: srsUpdate?.interval ?? null,
        easeAfter: srsUpdate?.easeFactor ?? null,
        wasNew: data.mode === "review" && card.status === "new",
      },
    }),
  );
  if (srsUpdate) {
    ops.push(prisma.card.update({ where: { id: card.id }, data: srsUpdate }));
  }
  ops.push(prisma.deck.update({ where: { id: card.deckId }, data: { lastStudiedAt: now } }));
  await prisma.$transaction(ops);

  if (data.sessionId) {
    const s = await prisma.studySession.findUnique({ where: { id: data.sessionId } });
    if (s) {
      const last = s.endedAt ?? s.startedAt;
      const gap = Math.min(MAX_GAP_SEC, Math.max(0, Math.round((now.getTime() - last.getTime()) / 1000)));
      await prisma.studySession.update({
        where: { id: s.id },
        data: {
          endedAt: now,
          durationSec: s.durationSec + gap,
          cardsStudied: { increment: 1 },
          correct: { increment: correct ? 1 : 0 },
          incorrect: { increment: correct ? 0 : 1 },
        },
      });
    }
  }

  const updated = srsUpdate ? await prisma.card.findUniqueOrThrow({ where: { id: card.id } }) : card;
  return { card: toCardDTO(updated), correct };
}

/**
 * Cards to study now in spaced repetition: everything due (learning + review),
 * plus new cards up to the daily new-card limit. Due cards first (oldest first), then new.
 */
export async function getDueCards(deckId?: string, opts: { includeNew?: boolean; limit?: number } = {}) {
  const settings = await getSettings();
  const now = new Date();
  const deckWhere = deckId ? { deckId } : {};
  const limit = opts.limit ?? settings.maxReviewsPerSession;
  const due = await prisma.card.findMany({
    where: { ...deckWhere, status: { not: "new" }, dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
  let fresh: typeof due = [];
  if (opts.includeNew !== false) {
    const introducedToday = await prisma.review.count({
      where: { wasNew: true, reviewedAt: { gte: startOfDay(now) }, ...(deckId ? { card: { deckId } } : {}) },
    });
    const room = Math.max(0, Math.min(settings.newCardsPerDay - introducedToday, limit - due.length));
    if (room > 0) {
      fresh = await prisma.card.findMany({
        where: { ...deckWhere, status: "new" },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: room,
      });
    }
  }
  return { due: due.map(toCardDTO), new: fresh.map(toCardDTO), cards: [...due, ...fresh].map(toCardDTO) };
}

/** Number of cards that become due later today (e.g. relearning cards scheduled in 10 minutes). */
export async function countDueLaterToday(deckId?: string) {
  const now = new Date();
  const end = new Date(startOfDay(now).getTime() + 24 * 3600 * 1000);
  return prisma.card.count({
    where: { ...(deckId ? { deckId } : {}), status: { not: "new" }, dueAt: { gt: now, lt: end } },
  });
}

export interface WeakCard extends CardDTO {
  weakness: number;
  attempts: number;
  incorrect: number;
}

/**
 * Cards you struggle with, scored from: SM-2 lapses, a lowered ease factor, and the share of
 * wrong answers over the last 20 attempts in any mode. Only cards with at least one attempt.
 */
export async function getWeakCards(deckId?: string, limit = 20): Promise<WeakCard[]> {
  const cards = await prisma.card.findMany({
    where: { ...(deckId ? { deckId } : {}), reviews: { some: {} } },
    include: { reviews: { orderBy: { reviewedAt: "desc" }, take: 20, select: { correct: true } } },
  });
  return cards
    .map(({ reviews, ...card }) => {
      const incorrect = reviews.filter((r) => !r.correct).length;
      const rate = reviews.length ? incorrect / reviews.length : 0;
      const weakness = Math.round((card.lapses * 2 + Math.max(0, 2.5 - card.easeFactor) * 4 + rate * 6) * 100) / 100;
      return { ...toCardDTO(card), weakness, attempts: reviews.length, incorrect };
    })
    .filter((c) => c.weakness > 0)
    .sort((a, b) => b.weakness - a.weakness)
    .slice(0, limit);
}

/** Learn mode "I was right": turns the most recent incorrect answer for this card into a correct one. */
export async function overrideLastAnswer(cardId: string, sessionId?: string) {
  const last = await prisma.review.findFirst({
    where: { cardId, mode: { in: ["learn", "flashcards"] }, ...(sessionId ? { sessionId } : {}) },
    orderBy: { reviewedAt: "desc" },
  });
  if (!last || last.correct) return { changed: false };
  await prisma.review.update({ where: { id: last.id }, data: { correct: true, rating: last.mode === "learn" ? "correct" : "known" } });
  if (last.sessionId) {
    await prisma.studySession.update({
      where: { id: last.sessionId },
      data: { correct: { increment: 1 }, incorrect: { decrement: 1 } },
    });
  }
  return { changed: true };
}
