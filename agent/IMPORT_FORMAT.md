# Import / export format (version 1)

A JSON file with **one deck**, or `{ "decks": [ ... ] }` with several. Validated by `importFile` in `src/lib/schemas.ts`. `exportDeck` produces exactly this format, so exports can be re-imported.

```jsonc
{
  "version": 1,                         // optional
  "name": "IR-spectroscopie",           // required — deck name
  "subject": "Organische chemie",       // optional — subject name, created if missing
  "description": "Karakteristieke IR-banden",  // optional
  "color": "#0ea5e9",                   // optional — hex color
  "icon": "flask-conical",              // optional — lucide icon name
  "cards": [
    {
      "type": "term",                   // term | qa | concept | formula | image | cloze (default: term)
      "front": "C=O-strekking (keton)", // required
      "back": "1715 cm⁻¹",              // optional for cloze, otherwise the answer
      "description": "Sterk, scherp",   // optional — shown after flipping
      "hints": ["Carbonylgebied"],      // optional — max 10
      "tags": ["ir", "carbonyl"],       // optional — lowercased, deduplicated
      "difficulty": 3,                  // optional — 1 (easy) … 5 (hard), default 3
      "imageUrl": "https://…"           // optional
    }
  ]
}
```

## Card types

| type | front | back |
| --- | --- | --- |
| `term` | term | definition |
| `qa` | question | answer |
| `concept` | concept | explanation |
| `formula` | formula | when/how it is used |
| `image` | prompt (+ `imageUrl`) | identification |
| `cloze` | sentence with `{{hidden}}` parts | optional extra explanation |

Cloze example: `"front": "Aromatische protonen liggen rond {{7-8}} ppm"`. The hidden parts are the expected answer; several `{{…}}` in one sentence are asked together (answer joined with `; `).

## Answers that are typed (Learn mode)

- Matching ignores case, accents, extra spaces, trailing punctuation, and spacing around `-`, `/`, `,`.
- Superscripts/subscripts are normalised: `cm⁻¹` = `cm-1`, `H₂O` = `H2O`; `–` and `—` = `-`.
- Separate acceptable alternatives with `;` or `|`: `"back": "keton; ketone"`.
- Answers that are mostly digits must match exactly (no typo tolerance).
- `≡` can be typed as `#`.
- Key terms are enough: text in (parentheses) and after the first comma is optional. If the rest contains real words ("C=O van een carbonzuur"), typing those words is enough ("carbonzuur"); otherwise the most specific formula ("NH₂") or any word from the parentheses ("amine") is enough. Formulas and numbers must still be exact. See `keyTermsMatch` in `src/lib/answer.ts`.

## Import behaviour

| option (CLI flag) | values | default |
| --- | --- | --- |
| `--on-existing` | `merge` (add to the deck with the same name in the same subject) · `new` (always create a new deck) | `merge` |
| `--on-duplicate` | `skip` · `update` (overwrite back/tags/etc. of the card with the same front) · `add` | `skip` |
| `--dry-run` | report what would happen, write nothing | off |

Duplicates are detected by the normalised front text. The whole deck import runs in one transaction.

Example: [`examples/format-example.json`](examples/format-example.json) (format demo only — not study material).
