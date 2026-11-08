import { describe, expect, it } from "vitest";
import { clozeAnswers, clozeFilled, clozePrompt, studyPair } from "@/lib/cards";
import { parseBulkText } from "@/server/cards";

describe("cloze cards", () => {
  const front = "De {{C=O}}-strekking ligt rond {{1700}} cm⁻¹";
  it("extracts answers and builds prompt", () => {
    expect(clozeAnswers(front)).toEqual(["C=O", "1700"]);
    expect(clozePrompt(front)).toBe("De _____-strekking ligt rond _____ cm⁻¹");
    expect(clozeFilled(front)).toBe("De C=O-strekking ligt rond 1700 cm⁻¹");
  });
  it("studyPair uses the hidden words as answer", () => {
    expect(studyPair({ type: "cloze", front, back: "" }).answer).toBe("C=O; 1700");
  });
  it("studyPair reverse swaps question and answer", () => {
    expect(studyPair({ type: "term", front: "a", back: "b" }, true)).toEqual({ prompt: "b", answer: "a" });
  });
});

describe("bulk text parsing", () => {
  it("splits on tab, dash, semicolon and colon", () => {
    expect(parseBulkText("a\tb\nc - d\ne;f\ng: h\n\nlonely")).toEqual([
      { front: "a", back: "b" },
      { front: "c", back: "d" },
      { front: "e", back: "f" },
      { front: "g", back: "h" },
      { front: "lonely", back: "" },
    ]);
  });
  it("respects an explicit separator", () => {
    expect(parseBulkText("C=O - 1700 cm-1 | sterk", " | ")).toEqual([{ front: "C=O - 1700 cm-1", back: "sterk" }]);
  });
});
