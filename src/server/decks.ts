import { prisma } from "@/lib/db";
import { deckInput, deckUpdate, type DeckInput, type DeckUpdate } from "@/lib/schemas";
import { NotFoundError } from "./errors";
import { emptyCounts, progressFrom, type DeckSummary, type StatusCounts } from "./mappers";
import { findOrCreateSubject } from "./subjects";

async function summaries(where: { id?: string | { in: string[] }; subjectId?: string | null } = {}): Promise<DeckSummary[]> {
  const decks = await prisma.deck.findMany({
    where,
    include: { subject: true },
    orderBy: [{ updatedAt: "desc" }],
  });
  if (!decks.length) return [];
  const ids = decks.map((d) => d.id);
  const [grouped, due] = await Promise.all([
    prisma.card.groupBy({ by: ["deckId", "status"], where: { deckId: { in: ids } }, _count: { _all: true } }),
    prisma.card.groupBy({
      by: ["deckId"],
      where: { deckId: { in: ids }, status: { not: "new" }, dueAt: { lte: new Date() } },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map<string, StatusCounts>();
  for (const g of grouped) {
    const c = counts.get(g.deckId) ?? emptyCounts();
    c[g.status as keyof StatusCounts] += g._count._all;
    counts.set(g.deckId, c);
  }
  const dueMap = new Map(due.map((d) => [d.deckId, d._count._all]));
  return decks.map((d) => {
    const c = counts.get(d.id) ?? emptyCounts();
    return {
      ...d,
      cardCount: c.new + c.learning + c.review + c.mastered,
      statusCounts: c,
      dueCount: dueMap.get(d.id) ?? 0,
      progress: progressFrom(c),
    };
  });
}

export async function listDecks(filters: { subjectId?: string | null } = {}) {
  return summaries(filters.subjectId !== undefined ? { subjectId: filters.subjectId } : {});
}

export async function getDeck(deckId: string) {
  const [deck] = await summaries({ id: deckId });
  if (!deck) throw new NotFoundError("Deck", deckId);
  return deck;
}

async function resolveSubject(data: { subjectId?: string | null; subjectName?: string }) {
  if (data.subjectName) return (await findOrCreateSubject(data.subjectName)).id;
  return data.subjectId;
}

export async function createDeck(data: DeckInput) {
  const parsed = deckInput.parse(data);
  const { subjectName, ...rest } = parsed;
  const subjectId = await resolveSubject(parsed);
  const deck = await prisma.deck.create({ data: { ...rest, subjectId: subjectId ?? null } });
  return getDeck(deck.id);
}

export async function updateDeck(deckId: string, data: DeckUpdate) {
  await getDeck(deckId);
  const parsed = deckUpdate.parse(data);
  const { subjectName, ...rest } = parsed;
  const subjectId = await resolveSubject(parsed);
  await prisma.deck.update({
    where: { id: deckId },
    data: { ...rest, ...(subjectId !== undefined ? { subjectId } : {}) },
  });
  return getDeck(deckId);
}

/** Deletes a deck and all its cards and review history. */
export async function deleteDeck(deckId: string) {
  await getDeck(deckId);
  const cards = await prisma.card.count({ where: { deckId } });
  await prisma.deck.delete({ where: { id: deckId } });
  return { deleted: deckId, cardsDeleted: cards };
}

/** Copies a deck with all cards; the copy starts with fresh learning progress. */
export async function duplicateDeck(deckId: string, newName?: string) {
  const deck = await getDeck(deckId);
  const cards = await prisma.card.findMany({ where: { deckId }, orderBy: { position: "asc" } });
  const copy = await prisma.deck.create({
    data: {
      name: newName ?? `${deck.name} (kopie)`,
      description: deck.description,
      color: deck.color,
      icon: deck.icon,
      subjectId: deck.subjectId,
      cards: {
        create: cards.map((c) => ({
          type: c.type,
          front: c.front,
          back: c.back,
          description: c.description,
          imageUrl: c.imageUrl,
          hints: c.hints,
          tags: c.tags,
          difficulty: c.difficulty,
          position: c.position,
        })),
      },
    },
  });
  return getDeck(copy.id);
}

/** Moves all cards (with their progress) from the source decks into the target, then deletes the sources. */
export async function mergeDecks(targetDeckId: string, sourceDeckIds: string[]) {
  await getDeck(targetDeckId);
  const sources = sourceDeckIds.filter((id) => id !== targetDeckId);
  for (const id of sources) await getDeck(id);
  const max = await prisma.card.aggregate({ where: { deckId: targetDeckId }, _max: { position: true } });
  let pos = (max._max.position ?? -1) + 1;
  let moved = 0;
  await prisma.$transaction(async (tx) => {
    for (const id of sources) {
      const cards = await tx.card.findMany({ where: { deckId: id }, orderBy: { position: "asc" }, select: { id: true } });
      for (const c of cards) {
        await tx.card.update({ where: { id: c.id }, data: { deckId: targetDeckId, position: pos++ } });
        moved++;
      }
      await tx.studySession.updateMany({ where: { deckId: id }, data: { deckId: targetDeckId } });
      await tx.deck.delete({ where: { id } });
    }
  });
  return { deck: await getDeck(targetDeckId), cardsMoved: moved, decksRemoved: sources };
}
