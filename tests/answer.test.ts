import { describe, expect, it } from "vitest";
import { checkAnswer, editDistance, normalizeAnswer } from "@/lib/answer";

describe("answer checking", () => {
  it("is case and whitespace insensitive", () => {
    expect(checkAnswer("  Carbonyl  ", "carbonyl").verdict).toBe("correct");
  });

  it("ignores accents and trailing punctuation", () => {
    expect(checkAnswer("creme brulee", "Crème brûlée.").verdict).toBe("correct");
  });

  it("normalises superscripts and dashes (cm⁻¹ == cm-1, 1650–1750 == 1650-1750)", () => {
    expect(normalizeAnswer("1700 cm⁻¹")).toBe(normalizeAnswer("1700 cm-1"));
    expect(checkAnswer("1650 - 1750", "1650–1750").verdict).toBe("correct");
    expect(checkAnswer("H2O", "H₂O").verdict).toBe("correct");
  });

  it("accepts small typos in longer words but not in short ones", () => {
    expect(checkAnswer("mitochondira", "mitochondria").verdict).toBe("typo");
    expect(checkAnswer("mitochondria", "mitochondria").verdict).toBe("correct");
    expect(checkAnswer("cat", "car").verdict).toBe("incorrect");
    expect(checkAnswer("photosyntesis", "photosynthesis", { allowTypos: false }).verdict).toBe("incorrect");
  });

  it("requires numbers to be exact", () => {
    expect(checkAnswer("1710", "1700").verdict).toBe("incorrect");
    expect(checkAnswer("7.26", "7,26").accepted).toBe(false);
  });

  it("accepts any alternative separated by ; or |", () => {
    expect(checkAnswer("ketone", "ketone; aldehyde").verdict).toBe("correct");
    expect(checkAnswer("aldehyde", "ketone | aldehyde").verdict).toBe("correct");
    expect(checkAnswer("ester", "ketone; aldehyde").verdict).toBe("incorrect");
  });

  it("empty input is incorrect", () => {
    expect(checkAnswer("   ", "x").accepted).toBe(false);
  });

  it("edit distance counts transpositions as one edit", () => {
    expect(editDistance("abcd", "abdc")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });
});
