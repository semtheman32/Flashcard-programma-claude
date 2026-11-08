import { describe, expect, it } from "vitest";
import { checkAnswer } from "@/lib/answer";

const ok = (given: string, answer: string) => expect(checkAnswer(given, answer).accepted, `"${given}" vs "${answer}"`).toBe(true);
const no = (given: string, answer: string) => expect(checkAnswer(given, answer).accepted, `"${given}" vs "${answer}"`).toBe(false);

describe("lenient key-term matching (IR cards)", () => {
  it("accepts the key word without filler or parentheses", () => {
    ok("carbonzuur", "C=O van een carbonzuur");
    ok("c=o carbonzuur", "C=O van een carbonzuur");
    ok("keton", "C=O van een keton");
    ok("alcohol", "O–H (alcohol, fenol)");
    ok("OH", "O–H (alcohol, fenol)");
    ok("alkyn", "C≡C (alkyn)");
    ok("C=C (alkyn)", "C≡C (alkyn)");
    ok("C#C", "C≡C (alkyn)");
    ok("nitril", "C≡N (nitril)");
    ok("NH2", "N–H van NH₂ (primair amine/amide)");
    ok("primair amine", "N–H van NH₂ (primair amine/amide)");
    ok("sp3", "sp³ C–H (alkyl)");
    ok("geconjugeerd", "geconjugeerde C=O (aan ring of C=C), ongeveer 30 lager");
    ok("aromatisch", "aromatische C=C (benzeenring)");
    ok("terminaal alkeen", "terminaal alkeen (RCH=CH₂)");
    ok("nitro", "NO₂ (nitrogroep)");
  });

  it("still rejects wrong answers", () => {
    no("keton", "C=O van een carbonzuur");
    no("C=O", "C=O van een carbonzuur");
    no("C=C", "C≡C (alkyn)");
    no("alkeen", "C≡C (alkyn)");
    no("NH", "N–H van NH₂ (primair amine/amide)");
    no("sp2", "sp³ C–H (alkyl)");
    no("ester", "C–O van een ether");
    no("para", "monogesubstitueerde benzeen");
    no("trans", "terminaal alkeen (RCH=CH₂)");
  });

  it("marks lenient matches as partial", () => {
    expect(checkAnswer("carbonzuur", "C=O van een carbonzuur").verdict).toBe("partial");
  });
});
