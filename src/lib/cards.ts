/** Card type definitions and helpers shared by UI, services and CLI. */

export const CARD_TYPES = ["term", "qa", "concept", "formula", "image", "cloze"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const CARD_TYPE_LABELS: Record<CardType, { label: string; front: string; back: string }> = {
  term: { label: "Begrip → Definitie", front: "Begrip", back: "Definitie" },
  qa: { label: "Vraag → Antwoord", front: "Vraag", back: "Antwoord" },
  concept: { label: "Concept → Uitleg", front: "Concept", back: "Uitleg" },
  formula: { label: "Formule → Toepassing", front: "Formule", back: "Toepassing" },
  image: { label: "Afbeelding → Identificatie", front: "Afbeelding / omschrijving", back: "Identificatie" },
  cloze: { label: "Cloze (invullen)", front: "Zin met {{ontbrekend woord}}", back: "Extra uitleg (optioneel)" },
};

export const STATUSES = ["new", "learning", "review", "mastered"] as const;
export const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  new: "Nieuw",
  learning: "Aan het leren",
  review: "Herhalen",
  mastered: "Beheerst",
};

const CLOZE_RE = /\{\{(.+?)\}\}/g;

/** For cloze cards: the hidden parts, e.g. "De {{C=O}} band" → ["C=O"]. */
export function clozeAnswers(front: string): string[] {
  return [...front.matchAll(CLOZE_RE)].map((m) => m[1].trim());
}

/** Front with blanks: "De {{C=O}} band" → "De ____ band". */
export function clozePrompt(front: string): string {
  return front.replace(CLOZE_RE, "_____");
}

/** Front with answers filled in (for the back of a cloze card). */
export function clozeFilled(front: string): string {
  return front.replace(CLOZE_RE, (_, a: string) => a.trim());
}

/** Question text and expected answer as studied, honouring card type and reverse mode. */
export function studyPair(
  card: { type: string; front: string; back: string },
  reverse = false,
): { prompt: string; answer: string; extra?: string } {
  if (card.type === "cloze") {
    const answers = clozeAnswers(card.front);
    return {
      prompt: clozePrompt(card.front),
      answer: answers.join("; ") || card.back,
      extra: card.back || undefined,
    };
  }
  return reverse ? { prompt: card.back, answer: card.front } : { prompt: card.front, answer: card.back };
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
