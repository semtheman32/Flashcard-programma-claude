"use server";

/** Server actions: thin wrappers around the service layer for the web UI. */
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import * as api from "@/server";
import type { CardInput, CardUpdate, DeckInput, DeckUpdate, SubjectInput } from "@/lib/schemas";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function wrap<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    const error =
      err instanceof ZodError
        ? err.issues.map((i) => i.message).join(", ")
        : err instanceof Error
          ? err.message
          : "Onbekende fout";
    return { ok: false, error };
  }
}

export async function createSubjectAction(data: SubjectInput) {
  return wrap(() => api.createSubject(data));
}
export async function updateSubjectAction(id: string, data: Partial<SubjectInput>) {
  return wrap(() => api.updateSubject(id, data));
}
export async function deleteSubjectAction(id: string) {
  return wrap(() => api.deleteSubject(id));
}

export async function createDeckAction(data: DeckInput) {
  return wrap(() => api.createDeck(data));
}
export async function updateDeckAction(id: string, data: DeckUpdate) {
  return wrap(() => api.updateDeck(id, data));
}
export async function deleteDeckAction(id: string) {
  return wrap(() => api.deleteDeck(id));
}
export async function duplicateDeckAction(id: string) {
  return wrap(() => api.duplicateDeck(id));
}
export async function mergeDecksAction(targetId: string, sourceIds: string[]) {
  return wrap(() => api.mergeDecks(targetId, sourceIds));
}

export async function createCardAction(data: CardInput) {
  return wrap(() => api.createCard(data));
}
export async function updateCardAction(id: string, data: CardUpdate) {
  return wrap(() => api.updateCard(id, data));
}
export async function deleteCardAction(id: string) {
  return wrap(() => api.deleteCard(id));
}
export async function moveCardAction(id: string, targetDeckId: string) {
  return wrap(() => api.moveCard(id, targetDeckId));
}
export async function resetCardProgressAction(id: string) {
  return wrap(() => api.resetCardProgress(id));
}
export async function bulkCreateCardsAction(cards: CardInput[]) {
  return wrap(() => api.bulkCreateCards(cards));
}
export async function importJsonAction(json: string, options: Parameters<typeof api.importDeck>[1]) {
  return wrap(async () => api.importDeck(JSON.parse(json), options));
}

export async function startSessionAction(mode: api.StudyMode, deckId: string | null) {
  try {
    const s = await api.startSession(mode, deckId);
    return { ok: true as const, data: { id: s.id } };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Onbekende fout" };
  }
}

/** Not revalidating on every answer keeps study sessions fast; pages refresh when you leave. */
export async function recordReviewAction(input: Parameters<typeof api.recordReview>[0]) {
  try {
    const r = await api.recordReview(input);
    return { ok: true as const, data: r };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Onbekende fout" };
  }
}

export async function overrideLastAnswerAction(cardId: string, sessionId?: string) {
  try {
    return { ok: true as const, data: await api.overrideLastAnswer(cardId, sessionId) };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Onbekende fout" };
  }
}

export async function updateSettingsAction(data: Partial<api.Settings>) {
  return wrap(() => api.updateSettings(data));
}
