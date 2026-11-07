import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as api from "@/server";

beforeEach(async () => {
  await prisma.review.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.card.deleteMany();
  await prisma.deck.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.setting.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe("decks and cards", () => {
  it("creates a deck with a subject by name and adds cards", async () => {
    const deck = await api.createDeck({ name: "IR", subjectName: "Chemie" });
    expect(deck.subject?.name).toBe("Chemie");
    const card = await api.createCard({ deckId: deck.id, front: "C=O", back: "1700", tags: ["IR", "ir"] });
    expect(card.tags).toEqual(["ir"]);
    expect(card.status).toBe("new");
    const again = await api.getDeck(deck.id);
    expect(again.cardCount).toBe(1);
    expect(again.statusCounts.new).toBe(1);
  });

  it("validates input", async () => {
    await expect(api.createDeck({ name: "" })).rejects.toThrow();
    const deck = await api.createDeck({ name: "x" });
    await expect(api.createCard({ deckId: deck.id, front: "" })).rejects.toThrow();
    await expect(api.createCard({ deckId: "nope", front: "a" })).rejects.toThrow(/not found/);
  });

  it("updates only the provided fields", async () => {
    const deck = await api.createDeck({ name: "d" });
    const card = await api.createCard({ deckId: deck.id, front: "f", back: "b", tags: ["t"], difficulty: 5 });
    const updated = await api.updateCard(card.id, { back: "b2" });
    expect(updated.back).toBe("b2");
    expect(updated.tags).toEqual(["t"]);
    expect(updated.difficulty).toBe(5);
  });

  it("bulk creates, filters, moves and deletes cards", async () => {
    const a = await api.createDeck({ name: "A" });
    const b = await api.createDeck({ name: "B" });
    const created = await api.bulkCreateCards([
      { deckId: a.id, front: "one", back: "1", tags: ["x"] },
      { deckId: a.id, front: "two", back: "2" },
      { deckId: a.id, front: "three", back: "3", tags: ["x"] },
    ]);
    expect(created.map((c) => c.position)).toEqual([0, 1, 2]);
    expect(await api.listCards({ deckId: a.id, tag: "x" })).toHaveLength(2);
    expect(await api.listCards({ search: "two" })).toHaveLength(1);
    const moved = await api.moveCard(created[0].id, b.id);
    expect(moved.deckId).toBe(b.id);
    await api.deleteCard(created[1].id);
    expect((await api.getDeck(a.id)).cardCount).toBe(1);
  });

  it("bulk create is all-or-nothing", async () => {
    const a = await api.createDeck({ name: "A" });
    await expect(api.bulkCreateCards([{ deckId: a.id, front: "ok" }, { deckId: a.id, front: "" }])).rejects.toThrow(/card 1/);
    expect(await api.listCards({ deckId: a.id })).toHaveLength(0);
  });

  it("duplicates and merges decks", async () => {
    const a = await api.createDeck({ name: "A" });
    await api.bulkCreateCards([{ deckId: a.id, front: "1" }, { deckId: a.id, front: "2" }]);
    const copy = await api.duplicateDeck(a.id);
    expect(copy.name).toBe("A (kopie)");
    expect(copy.cardCount).toBe(2);
    const merged = await api.mergeDecks(a.id, [copy.id]);
    expect(merged.deck.cardCount).toBe(4);
    await expect(api.getDeck(copy.id)).rejects.toThrow();
  });
});

describe("import / export", () => {
  const file = {
    version: 1 as const,
    subject: "Chemie",
    name: "NMR",
    cards: [
      { front: "CH3", back: "0.9 ppm", tags: ["1h"] },
      { type: "cloze" as const, front: "Aldehyde H rond {{9-10}} ppm" },
    ],
  };

  it("imports, is idempotent, and can update duplicates", async () => {
    const r1 = await api.importDeck(file);
    expect(r1.decks[0]).toMatchObject({ action: "created", cardsCreated: 2 });
    const r2 = await api.importDeck(file);
    expect(r2.decks[0]).toMatchObject({ action: "merged", cardsCreated: 0, cardsSkipped: 2 });
    const r3 = await api.importDeck({ ...file, cards: [{ front: "ch3", back: "0.8-1.0 ppm" }] }, { onDuplicateCard: "update" });
    expect(r3.decks[0].cardsUpdated).toBe(1);
    const cards = await api.listCards({ deckId: r1.decks[0].deckId! });
    expect(cards.find((c) => c.front === "CH3")?.back).toBe("0.8-1.0 ppm");
  });

  it("dry run writes nothing", async () => {
    const r = await api.importDeck(file, { dryRun: true });
    expect(r.decks[0].cardsCreated).toBe(2);
    expect(await prisma.card.count()).toBe(0);
  });

  it("export round-trips through import", async () => {
    const r = await api.importDeck(file);
    const exported = await api.exportDeck(r.decks[0].deckId!);
    expect(exported.cards).toHaveLength(2);
    await api.deleteDeck(r.decks[0].deckId!);
    const again = await api.importDeck(exported);
    expect(again.decks[0].cardsCreated).toBe(2);
  });

  it("rejects malformed files", async () => {
    await expect(api.importDeck({ name: "x", cards: [{ back: "no front" }] })).rejects.toThrow();
  });
});

describe("study, due cards and statistics", () => {
  it("review mode applies SM-2; flashcards/learn only log", async () => {
    const deck = await api.createDeck({ name: "d" });
    const [c1, c2] = await api.bulkCreateCards([{ deckId: deck.id, front: "a", back: "1" }, { deckId: deck.id, front: "b", back: "2" }]);
    const session = await api.startSession("review", deck.id);

    const due = await api.getDueCards(deck.id);
    expect(due.new).toHaveLength(2);

    const r = await api.recordReview({ sessionId: session.id, cardId: c1.id, mode: "review", rating: "good" });
    expect(r.card.status).toBe("learning");
    expect(r.card.interval).toBe(1);

    await api.recordReview({ cardId: c2.id, mode: "learn", rating: "correct" });
    expect((await api.getCard(c2.id)).status).toBe("new");

    const s = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(s.cardsStudied).toBe(1);
    expect(s.correct).toBe(1);

    // c1 is not due until tomorrow; only c2 (new) remains
    const due2 = await api.getDueCards(deck.id);
    expect(due2.due).toHaveLength(0);
    expect(due2.new.map((c) => c.id)).toEqual([c2.id]);
  });

  it("respects the daily new-card limit", async () => {
    await api.updateSettings({ newCardsPerDay: 1 });
    const deck = await api.createDeck({ name: "d" });
    const cards = await api.bulkCreateCards([1, 2, 3].map((i) => ({ deckId: deck.id, front: `q${i}` })));
    expect((await api.getDueCards(deck.id)).new).toHaveLength(1);
    await api.recordReview({ cardId: cards[0].id, mode: "review", rating: "good" });
    expect((await api.getDueCards(deck.id)).new).toHaveLength(0);
  });

  it("rejects ratings that do not belong to the mode", async () => {
    const deck = await api.createDeck({ name: "d" });
    const c = await api.createCard({ deckId: deck.id, front: "a" });
    await expect(api.recordReview({ cardId: c.id, mode: "review", rating: "known" })).rejects.toThrow();
  });

  it("statistics and weak cards come from stored reviews", async () => {
    const deck = await api.createDeck({ name: "d" });
    const [easy, hard] = await api.bulkCreateCards([{ deckId: deck.id, front: "easy" }, { deckId: deck.id, front: "hard" }]);
    await api.recordReview({ cardId: easy.id, mode: "review", rating: "good" });
    await api.recordReview({ cardId: hard.id, mode: "review", rating: "again" });
    await api.recordReview({ cardId: hard.id, mode: "learn", rating: "incorrect" });

    const stats = await api.getStudyStatistics({ deckId: deck.id });
    expect(stats.totals.cards).toBe(2);
    expect(stats.today.reviews).toBe(3);
    expect(stats.correctVsIncorrect).toMatchObject({ correct: 1, incorrect: 2 });
    expect(stats.streak).toBe(1);
    expect(stats.activity.at(-1)?.newCardsLearned).toBe(2);

    const weak = await api.getWeakCards(deck.id);
    expect(weak[0].id).toBe(hard.id);
    expect(weak.find((w) => w.id === easy.id)).toBeUndefined();
  });

  it("override turns the last wrong learn answer into a correct one", async () => {
    const deck = await api.createDeck({ name: "d" });
    const c = await api.createCard({ deckId: deck.id, front: "a" });
    const s = await api.startSession("learn", deck.id);
    await api.recordReview({ sessionId: s.id, cardId: c.id, mode: "learn", rating: "incorrect" });
    await api.overrideLastAnswer(c.id, s.id);
    const session = await prisma.studySession.findUniqueOrThrow({ where: { id: s.id } });
    expect(session).toMatchObject({ correct: 1, incorrect: 0 });
  });
});
