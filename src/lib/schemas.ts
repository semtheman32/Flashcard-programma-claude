/** Zod schemas: the single source of truth for all input validation (UI, CLI and import). */
import { z } from "zod";
import { CARD_TYPES, STATUSES } from "./cards";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "kleur moet een hex-code zijn, bv. #6366f1");
const tagList = z
  .array(z.string().trim().min(1).max(50))
  .max(30)
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]);

export const subjectInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullish(),
  color: color.optional(),
});
export const subjectUpdate = subjectInput.partial();

export const deckInput = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullish(),
  color: color.optional(),
  icon: z.string().trim().max(40).optional(),
  subjectId: z.string().nullish(),
  /** Convenience for agents: subject by name, created if missing. */
  subjectName: z.string().trim().min(1).max(100).optional(),
});
export const deckUpdate = deckInput.partial();

export const cardInput = z.object({
  deckId: z.string().min(1),
  type: z.enum(CARD_TYPES).default("term"),
  front: z.string().trim().min(1, "voorkant is verplicht").max(5000),
  back: z.string().trim().max(5000).default(""),
  description: z.string().trim().max(5000).nullish(),
  imageUrl: z.string().trim().max(2000).nullish(),
  hints: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  tags: tagList.default([]),
  difficulty: z.number().int().min(1).max(5).default(3),
});
export const cardUpdate = cardInput.partial();

export type SubjectInput = z.input<typeof subjectInput>;
export type DeckInput = z.input<typeof deckInput>;
export type DeckUpdate = z.input<typeof deckUpdate>;
export type CardInput = z.input<typeof cardInput>;
export type CardUpdate = z.input<typeof cardUpdate>;

export const cardFilters = z.object({
  deckId: z.string().optional(),
  subjectId: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  type: z.enum(CARD_TYPES).optional(),
  search: z.string().optional(),
  sort: z.enum(["position", "created", "updated", "front", "due", "difficulty"]).default("position"),
  limit: z.number().int().min(1).max(10000).default(1000),
});
export type CardFilters = z.input<typeof cardFilters>;

/** Card as it appears in the import/export JSON format (see agent/IMPORT_FORMAT.md). */
export const importCard = cardInput.omit({ deckId: true }).extend({
  back: z.string().trim().max(5000).default(""),
});

export const importDeck = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullish(),
  color: color.optional(),
  icon: z.string().trim().max(40).optional(),
  subject: z.string().trim().min(1).max(100).optional(),
  cards: z.array(importCard).max(5000).default([]),
});

export const importFile = z.union([
  importDeck.extend({ version: z.literal(1).optional() }),
  z.object({ version: z.literal(1).optional(), decks: z.array(importDeck).min(1) }),
]);

export const importOptions = z.object({
  /** What to do when a deck with the same name (in the same subject) already exists. */
  onExistingDeck: z.enum(["merge", "new"]).default("merge"),
  /** What to do with a card whose front already exists in the target deck. */
  onDuplicateCard: z.enum(["skip", "update", "add"]).default("skip"),
  dryRun: z.boolean().default(false),
});

export type ImportDeck = z.input<typeof importDeck>;
export type ImportFile = z.input<typeof importFile>;
export type ImportOptions = z.input<typeof importOptions>;
