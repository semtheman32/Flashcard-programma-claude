import { prisma } from "@/lib/db";
import { importFile, importOptions, type ImportFile, type ImportOptions } from "@/lib/schemas";
import { normalizeAnswer } from "@/lib/answer";
import { NotFoundError } from "./errors";
import { toCardDTO } from "./mappers";
import { findOrCreateSubject } from "./subjects";

export interface ImportReport {
  dryRun: boolean;
  decks: {
    deckId: string | null;
    name: string;
    subject: string | null;
    action: "created" | "merged";
    cardsCreated: number;
    cardsUpdated: number;
    cardsSkipped: number;
  }[];
}

const key = (front: string) => normalizeAnswer(front);

/**
 * Imports one or more decks from the JSON format documented in agent/IMPORT_FORMAT.md.
 * Idempotent by default: re-importing the same file skips cards whose front already exists.
 */
export async function importDeck(data: ImportFile | unknown, options: ImportOptions = {}): Promise<ImportReport> {
  const parsed = importFile.parse(data);
  const opts = importOptions.parse(options);
  const decks = "decks" in parsed ? parsed.decks : [parsed];
  const report: ImportReport = { dryRun: opts.dryRun, decks: [] };

  for (const d of decks) {
    const subject = d.subject
      ? opts.dryRun
        ? await prisma.subject.findFirst({ where: { name: d.subject } })
        : await findOrCreateSubject(d.subject)
      : null;
    const existing =
      opts.onExistingDeck === "merge"
        ? await prisma.deck.findFirst({ where: { name: d.name, subjectId: subject?.id ?? null } })
        : null;
    const existingCards = existing ? await prisma.card.findMany({ where: { deckId: existing.id } }) : [];
    const byFront = new Map(existingCards.map((c) => [key(c.front), c]));

    const entry: ImportReport["decks"][number] = {
      deckId: existing?.id ?? null,
      name: d.name,
      subject: d.subject ?? null,
      action: existing ? "merged" : "created",
      cardsCreated: 0,
      cardsUpdated: 0,
      cardsSkipped: 0,
    };

    const toCreate: typeof d.cards = [];
    const toUpdate: { id: string; card: (typeof d.cards)[number] }[] = [];
    const seen = new Set<string>();
    for (const c of d.cards) {
      const k = key(c.front);
      const match = byFront.get(k);
      if ((match || seen.has(k)) && opts.onDuplicateCard !== "add") {
        if (match && opts.onDuplicateCard === "update") toUpdate.push({ id: match.id, card: c });
        else entry.cardsSkipped++;
        continue;
      }
      seen.add(k);
      toCreate.push(c);
    }
    entry.cardsCreated = toCreate.length;
    entry.cardsUpdated = toUpdate.length;

    if (!opts.dryRun) {
      await prisma.$transaction(async (tx) => {
        const deck =
          existing ??
          (await tx.deck.create({
            data: {
              name: d.name,
              description: d.description ?? null,
              color: d.color,
              icon: d.icon,
              subjectId: subject?.id ?? null,
            },
          }));
        if (existing && (d.description || d.color || d.icon)) {
          await tx.deck.update({
            where: { id: deck.id },
            data: {
              ...(d.description ? { description: d.description } : {}),
              ...(d.color ? { color: d.color } : {}),
              ...(d.icon ? { icon: d.icon } : {}),
            },
          });
        }
        entry.deckId = deck.id;
        const max = await tx.card.aggregate({ where: { deckId: deck.id }, _max: { position: true } });
        let pos = (max._max.position ?? -1) + 1;
        for (const c of toCreate) {
          await tx.card.create({
            data: {
              deckId: deck.id,
              type: c.type,
              front: c.front,
              back: c.back,
              description: c.description ?? null,
              imageUrl: c.imageUrl ?? null,
              hints: JSON.stringify(c.hints),
              tags: JSON.stringify(c.tags),
              difficulty: c.difficulty,
              position: pos++,
            },
          });
        }
        for (const u of toUpdate) {
          await tx.card.update({
            where: { id: u.id },
            data: {
              type: u.card.type,
              back: u.card.back,
              description: u.card.description ?? null,
              imageUrl: u.card.imageUrl ?? null,
              hints: JSON.stringify(u.card.hints),
              tags: JSON.stringify(u.card.tags),
              difficulty: u.card.difficulty,
            },
          });
        }
      });
    }
    report.decks.push(entry);
  }
  return report;
}

/** Exports a deck in the import format (without learning progress), so it can be re-imported. */
export async function exportDeck(deckId: string, opts: { includeProgress?: boolean } = {}) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId }, include: { subject: true } });
  if (!deck) throw new NotFoundError("Deck", deckId);
  const cards = await prisma.card.findMany({ where: { deckId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return {
    version: 1 as const,
    name: deck.name,
    description: deck.description ?? undefined,
    color: deck.color,
    icon: deck.icon,
    subject: deck.subject?.name,
    cards: cards.map((raw) => {
      const c = toCardDTO(raw);
      return {
        type: c.type,
        front: c.front,
        back: c.back,
        ...(c.description ? { description: c.description } : {}),
        ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}),
        ...(c.hints.length ? { hints: c.hints } : {}),
        ...(c.tags.length ? { tags: c.tags } : {}),
        difficulty: c.difficulty,
        ...(opts.includeProgress
          ? {
              progress: {
                status: c.status,
                easeFactor: c.easeFactor,
                interval: c.interval,
                repetitions: c.repetitions,
                lapses: c.lapses,
                dueAt: c.dueAt,
                lastReviewedAt: c.lastReviewedAt,
              },
            }
          : {}),
      };
    }),
  };
}

export async function search(query: string, limit = 20) {
  const q = query.trim();
  if (!q) return { decks: [], cards: [] };
  const [decks, cards] = await Promise.all([
    prisma.deck.findMany({
      where: { OR: [{ name: { contains: q } }, { description: { contains: q } }] },
      take: limit,
      include: { subject: true },
    }),
    prisma.card.findMany({
      where: { OR: [{ front: { contains: q } }, { back: { contains: q } }, { tags: { contains: q.toLowerCase() } }] },
      take: limit,
      include: { deck: { select: { id: true, name: true, color: true } } },
    }),
  ]);
  return { decks, cards: cards.map(({ deck, ...c }) => ({ ...toCardDTO(c), deck })) };
}
