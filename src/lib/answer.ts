/**
 * Answer checking for Learn mode.
 * - case-insensitive, accent-insensitive, whitespace/punctuation tolerant
 * - superscripts/subscripts normalised (cm⁻¹ == cm-1, H₂O == H2O)
 * - small typos accepted (Damerau–Levenshtein, threshold depends on length)
 * - alternatives: an answer "a; b" or "a | b" accepts either part
 */

export type AnswerVerdict = "correct" | "typo" | "incorrect";

export interface AnswerCheck {
  verdict: AnswerVerdict;
  /** true for "correct" and "typo" */
  accepted: boolean;
  /** the alternative that matched best */
  expected: string;
  distance: number;
}

const SUPER: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7",
  "₈": "8", "₉": "9", "₊": "+", "₋": "-", "−": "-", "–": "-", "—": "-",
};

export function normalizeAnswer(input: string): string {
  let s = input.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀-₉₊₋−–—]/g, (c) => SUPER[c] ?? c);
  s = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  s = s.toLowerCase();
  s = s.replace(/<[^>]+>/g, " "); // strip simple html
  s = s.replace(/[“”"'`´‘’]/g, "");
  s = s.replace(/\s*([-–,/()^])\s*/g, "$1"); // "1650 - 1750" == "1650-1750"
  s = s.replace(/[.!?;:]+$/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function splitAlternatives(answer: string): string[] {
  const parts = answer
    .split(/\s*(?:;|\|)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? [answer, ...parts] : [answer];
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

/** Allowed typos for an expected answer of this (normalised) length. Numbers must be exact. */
export function typoAllowance(expected: string): number {
  if (/\d/.test(expected) && expected.replace(/[^\d]/g, "").length >= expected.length / 2) return 0;
  const len = expected.length;
  if (len <= 3) return 0;
  if (len <= 7) return 1;
  if (len <= 15) return 2;
  return Math.min(4, Math.floor(len * 0.15));
}

export function checkAnswer(given: string, answer: string, opts: { allowTypos?: boolean } = {}): AnswerCheck {
  const allowTypos = opts.allowTypos ?? true;
  const g = normalizeAnswer(given);
  let best: AnswerCheck = { verdict: "incorrect", accepted: false, expected: answer, distance: Infinity };
  if (!g) return best;
  for (const alt of splitAlternatives(answer)) {
    const e = normalizeAnswer(alt);
    if (!e) continue;
    if (g === e || g.replace(/[\s-]/g, "") === e.replace(/[\s-]/g, "")) {
      return { verdict: "correct", accepted: true, expected: alt, distance: 0 };
    }
    const dist = editDistance(g, e);
    if (allowTypos && dist <= typoAllowance(e) && dist < best.distance) {
      best = { verdict: "typo", accepted: true, expected: alt, distance: dist };
    } else if (!best.accepted && dist < best.distance) {
      best = { ...best, distance: dist };
    }
  }
  return best;
}
