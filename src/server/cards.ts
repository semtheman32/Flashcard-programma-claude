import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cardFilters, cardInput, cardUpdate, type CardFilters, type CardInput, type CardUpdate } from "@/lib/schemas";
import { NotFoundError } from "./errors";
import { toCardDTO } from "./mappers";

function serialize<T extends { hints?: string[]; tags?: string[] }>(data: T) {
  const { hints, tags, ...rest } = data;
  return {
    ...rest,
    ...(hints !== undefined ? { hints: JSON.stringify(hints) } : {}),
    ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
  };
}

async function ensureDeck(deckId: string) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId }, select: { id: true } });
  if (!deck) throw new NotFoundError("Deck", deckId);
}

async function nextPosition(deckId: string) {
  const max = await prisma.card.aggregate({ where: { deckId }, _max: { position: true } });
  return (max._max.position ?? -1) + 1;
}

export async function listCards(filters: CardFilters = {}) {
  const f = cardFilters.parse(filters);
  const where: Prisma.CardWhereInput = {};
  if (f.deckId) where.deckId = f.deckId;
  if (f.subjectId) where.deck = { subjectId: f.subjectId };
  if (f.status) where.status = f.status;
  if (f.type) where.type = f.type;
  if (f.tag) where.tags = { contains: JSON.stringify(f.tag.toLowerCase()) };
  if (f.search) {
    const q = f.search.trim();
    where.OR = [{ front: { contains: q } }, { back: { contains: q } }, { description: { contains: q } }];
  }
  const orderBy: Prisma.CardOrderByWithRelationInput[] = {
    position: [{ position: "asc" as const }, { createdAt: "asc" as const }],
    created: [{ createdAt: "desc" as const }],
    updated: [{ updatedAt: "desc" as const }],
    front: [{ front: "asc" as const }],
    due: [{ dueAt: "asc" as const }],
    difficulty: [{ difficulty: "desc" as const }],
  }[f.sort];
  const cards = await prisma.card.findMany({ where, orderBy, take: f.limit });
  return cards.map(toCardDTO);
}

export async function getCard(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new NotFoundError("Card", cardId);
  return toCardDTO(card);
}

export async function createCard(data: CardInput) {
  const parsed = cardInput.parse(data);
  await ensureDeck(parsed.deckId);
  const card = await prisma.card.create({
    data: { ...serialize(parsed), position: await nextPosition(parsed.deckId) },
  });
  await prisma.deck.update({ where: { id: parsed.deckId }, data: { updatedAt: new Date() } });
  return toCardDTO(card);
}

export async function updateCard(cardId: string, data: CardUpdate) {
  await getCard(cardId);
  const parsed = cardUpdate.parse(data);
  // partial() keeps defaults for missing keys in zod 3 — only keep keys that were actually provided
  const provided = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in data)) as typeof parsed;
  if (provided.deckId) await ensureDeck(provided.deckId);
  const card = await prisma.card.update({ where: { id: cardId }, data: serialize(provided) });
  return toCardDTO(card);
}

export async function deleteCard(cardId: string) {
  await getCard(cardId);
  await prisma.card.delete({ where: { id: cardId } });
  return { deleted: cardId };
}

/** Moves a card to another deck. Learning progress and history stay with the card. */
export async function moveCard(cardId: string, targetDeckId: string) {
  await getCard(cardId);
  await ensureDeck(targetDeckId);
  const card = await prisma.card.update({
    where: { id: cardId },
    data: { deckId: targetDeckId, position: await nextPosition(targetDeckId) },
  });
  return toCardDTO(card);
}

/** Creates many cards in one transaction. All cards are validated first; nothing is written if one is invalid. */
export async function bulkCreateCards(cards: CardInput[]) {
  const parsed = cards.map((c, i) => {
    const r = cardInput.safeParse(c);
    if (!r.success) throw new Error(`card ${i}: ${r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join(", ")}`);
    return r.data;
  });
  for (const deckId of new Set(parsed.map((c) => c.deckId))) await ensureDeck(deckId);
  const positions = new Map<string, number>();
  const created = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const c of parsed) {
      if (!positions.has(c.deckId)) {
        const max = await tx.card.aggregate({ where: { deckId: c.deckId }, _max: { position: true } });
        positions.set(c.deckId, (max._max.position ?? -1) + 1);
      }
      const position = positions.get(c.deckId)!;
      positions.set(c.deckId, position + 1);
      out.push(await tx.card.create({ data: { ...serialize(c), position } }));
    }
    return out;
  });
  return created.map(toCardDTO);
}

/** Resets the spaced repetition progress of a card back to "new". */
export async function resetCardProgress(cardId: string) {
  await getCard(cardId);
  const card = await prisma.card.update({
    where: { id: cardId },
    data: { status: "new", easeFactor: 2.5, interval: 0, repetitions: 0, lapses: 0, dueAt: null, lastReviewedAt: null },
  });
  return toCardDTO(card);
}

export async function listTags(deckId?: string) {
  const cards = await prisma.card.findMany({ where: deckId ? { deckId } : {}, select: { tags: true } });
  const counts = new Map<string, number>();
  for (const c of cards) for (const t of JSON.parse(c.tags) as string[]) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

/** Parses pasted text into question/answer pairs. One card per line; separator: tab, " - ", " = ", ";" or ":". */
export function parseBulkText(text: string, separator?: string): { front: string; back: string }[] {
  const seps = separator ? [separator] : ["\t", " - ", " = ", " — ", ";", ":"];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      for (const sep of seps) {
        const i = line.indexOf(sep);
        if (i > 0) return { front: line.slice(0, i).trim(), back: line.slice(i + sep.length).trim() };
      }
      return { front: line, back: "" };
    })
    .filter((p) => p.front);
}
