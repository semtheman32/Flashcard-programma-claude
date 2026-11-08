/**
 * Answer checking for Learn mode.
 * - case-insensitive, accent-insensitive, whitespace/punctuation tolerant
 * - superscripts/subscripts normalised (cm⁻¹ == cm-1, H₂O == H2O)
 * - small typos accepted (Damerau–Levenshtein, threshold depends on length)
 * - alternatives: an answer "a; b" or "a | b" accepts either part
 * - key-term matching ("partial"): you don't have to type the whole answer, see keyTermsMatch()
 * - "≡" can be typed as "#" (C#C == C≡C)
 */

export type AnswerVerdict = "correct" | "typo" | "partial" | "incorrect";

export interface AnswerCheck {
  verdict: AnswerVerdict;
  /** true for "correct", "typo" and "partial" */
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
  s = s.replace(/≡/g, "#");
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
  if (best.accepted) return best;
  for (const alt of splitAlternatives(answer)) {
    if (keyTermsMatch(given, alt, allowTypos)) {
      return { verdict: "partial", accepted: true, expected: alt, distance: best.distance };
    }
  }
  return best;
}

const STOPWORDS = new Set(["van", "een", "de", "het", "of", "en", "aan", "met", "in", "op", "the", "a", "an", "and", "or"]);

/** Words of an answer: no punctuation, no hyphens inside words ("O–H" → "oh"), no filler words. */
export function answerTokens(text: string): string[] {
  return normalizeAnswer(text)
    .replace(/[()[\],;/|>]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/-/g, "").replace(/^[.:]+|[.:]+$/g, ""))
    .filter((t) => t && !STOPWORDS.has(t));
}

/** A "keyword" is a real word (letters only, 4+ chars). Everything else (C=O, sp3, NH2, 1715) is a formula/number. */
const isKeyword = (t: string) => /^[a-z]{4,}$/.test(t);

function tokenMatches(expected: string, typed: string[], allowTypos: boolean): boolean {
  return typed.some((t) => {
    if (t === expected) return true;
    if (!allowTypos || !isKeyword(expected)) return false;
    if (editDistance(t, expected) <= typoAllowance(expected)) return true;
    // same word stem: "aromaat" ~ "aromatische", "geconjugeerd" ~ "geconjugeerde"
    let p = 0;
    while (p < t.length && p < expected.length && t[p] === expected[p]) p++;
    return p >= 5 && p >= 0.7 * Math.min(t.length, expected.length);
  });
}

/**
 * Lenient check: is the essence of the answer there?
 * The answer is split into a main part and optional parts: text in (parentheses) and text after the
 * first comma are optional. Then:
 *  - if the main part has keywords (e.g. "C=O van een carbonzuur" → "carbonzuur"), all of them must be typed
 *  - otherwise (e.g. "C≡C (alkyn)", "N–H van NH₂ (primair amine)") the most specific formula of the
 *    main part ("c#c", "nh2") must be typed, OR any keyword from the optional part ("alkyn", "amine")
 * Formulas and numbers must match exactly (after normalisation); keywords may contain small typos.
 */
export function keyTermsMatch(given: string, answer: string, allowTypos = true): boolean {
  const typed = answerTokens(given);
  if (!typed.length) return false;
  let main = answer;
  const optionalParts: string[] = [];
  main = main.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    optionalParts.push(inner);
    return " ";
  });
  const comma = main.indexOf(",");
  if (comma > 0) {
    optionalParts.push(main.slice(comma + 1));
    main = main.slice(0, comma);
  }
  const mainTokens = answerTokens(main);
  const mainKeywords = mainTokens.filter(isKeyword);
  const optionalKeywords = optionalParts.flatMap(answerTokens).filter(isKeyword);

  if (mainKeywords.length) return mainKeywords.every((k) => tokenMatches(k, typed, allowTypos));
  if (optionalKeywords.some((k) => tokenMatches(k, typed, allowTypos))) return true;
  const formulas = mainTokens.filter((t) => !isKeyword(t));
  if (!formulas.length) return false;
  const specific = formulas.reduce((a, b) => (b.length >= a.length ? b : a));
  return typed.includes(specific);
}
