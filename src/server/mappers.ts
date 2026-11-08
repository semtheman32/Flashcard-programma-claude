import type { Card, Deck, Subject } from "@prisma/client";
import { parseJsonArray } from "@/lib/cards";

export type CardDTO = Omit<Card, "hints" | "tags"> & { hints: string[]; tags: string[] };

export function toCardDTO(card: Card): CardDTO {
  return { ...card, hints: parseJsonArray(card.hints), tags: parseJsonArray(card.tags) };
}

export interface StatusCounts {
  new: number;
  learning: number;
  review: number;
  mastered: number;
}

export interface DeckSummary extends Deck {
  subject: Subject | null;
  cardCount: number;
  statusCounts: StatusCounts;
  dueCount: number;
  /** 0..100, (mastered + 0.5·review + 0.25·learning) / total */
  progress: number;
}

export function emptyCounts(): StatusCounts {
  return { new: 0, learning: 0, review: 0, mastered: 0 };
}

export function progressFrom(c: StatusCounts): number {
  const total = c.new + c.learning + c.review + c.mastered;
  if (!total) return 0;
  return Math.round(((c.mastered + 0.5 * c.review + 0.25 * c.learning) / total) * 100);
}
