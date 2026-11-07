# Agent interface

The app has one data-access layer, `src/server/` (exported from `src/server/index.ts`). The web UI, the CLI and the tests all go through it. All input is validated with Zod (`src/lib/schemas.ts`).

Claude Code uses it through the **CLI**:

```bash
npm run agent -- <command> [args] [--flags]
npm run -s agent -- <command>     # -s hides npm's banner, so stdout is pure JSON
```

- Output: JSON on stdout. Errors: `{"error": "..."}` on stderr and exit code 1.
- JSON input: `--data '<json>'`, `--file <path>` or `--stdin`. Prefer `--file` for anything non-trivial (quoting is fragile, especially on Windows).
- Destructive commands (`*:delete`, `decks:merge`) refuse to run without `--yes`.
- The CLI talks to the same SQLite file as the app (`DATABASE_URL` in `.env`, default `prisma/dev.db`). The running app picks up changes on the next page load.

## Commands

### Overview & search

| Command | Service function | Notes |
| --- | --- | --- |
| `overview` | `listDecks`, `listSubjects`, `getStudyStatistics` | Start here: all decks with ids, counts, due cards, progress |
| `search <query> [--limit n]` | `search(query)` | Decks by name/description, cards by front/back/tag |

### Subjects

| Command | Service function |
| --- | --- |
| `subjects:list` | `listSubjects()` |
| `subjects:create --data '{"name":"…","color":"#hex"}'` | `createSubject(data)` |
| `subjects:update <id> --data '{…}'` | `updateSubject(id, data)` |
| `subjects:delete <id> --yes` | `deleteSubject(id)` — decks are kept, without subject |

### Decks

| Command | Service function |
| --- | --- |
| `decks:list [--subject <id>]` | `listDecks(filters)` |
| `decks:get <id> [--cards]` | `getDeck(deckId)` (+ `listCards`) |
| `decks:create --data '{"name":"…","subjectName":"…","description":"…","color":"#hex"}'` | `createDeck(data)` — `subjectName` creates the subject if needed; or pass `subjectId` |
| `decks:update <id> --data '{…}'` | `updateDeck(deckId, data)` |
| `decks:delete <id> --yes` | `deleteDeck(deckId)` — deletes cards and their history |
| `decks:duplicate <id> [--name "…"]` | `duplicateDeck(deckId)` — copy starts with fresh progress |
| `decks:merge <targetId> <sourceId>… --yes` | `mergeDecks(target, sources)` — cards keep progress; source decks are deleted |

Deck summaries include `cardCount`, `statusCounts {new, learning, review, mastered}`, `dueCount`, `progress` (0–100 = (mastered + ½·review + ¼·learning) / total), `lastStudiedAt`.

### Cards

| Command | Service function |
| --- | --- |
| `cards:list [--deck] [--subject] [--tag] [--status] [--type] [--search] [--sort] [--limit]` | `listCards(filters)` |
| `cards:get <id>` | `getCard(cardId)` |
| `cards:create --data '{"deckId":"…","front":"…","back":"…","tags":["…"]}'` | `createCard(data)` |
| `cards:update <id> --data '{"back":"…"}'` | `updateCard(cardId, data)` — only the given fields change |
| `cards:delete <id> --yes` | `deleteCard(cardId)` |
| `cards:move <id> <targetDeckId>` | `moveCard(cardId, targetDeckId)` — progress moves with it |
| `cards:bulk-create --file cards.json` | `bulkCreateCards(cards)` — JSON array, each with `deckId`; all-or-nothing |
| `cards:reset-progress <id>` | `resetCardProgress(cardId)` |
| `tags:list [--deck <id>]` | `listTags(deckId)` |

Card fields: `id, deckId, type, front, back, description, imageUrl, hints[], tags[], difficulty (1–5), position, createdAt, updatedAt` plus spaced-repetition state `status, easeFactor, interval (days), repetitions, lapses, dueAt, lastReviewedAt`.

Sort values: `position` (default), `created`, `updated`, `front`, `due`, `difficulty`. Statuses: `new`, `learning`, `review`, `mastered`.

### Import / export

| Command | Service function |
| --- | --- |
| `import <file.json> [--on-existing merge\|new] [--on-duplicate skip\|update\|add] [--dry-run]` | `importDeck(data, options)` |
| `export <deckId> [--out file.json] [--progress]` | `exportDeck(deckId)` |

Format: [`IMPORT_FORMAT.md`](IMPORT_FORMAT.md). The import report lists per deck: `deckId`, `action` (`created`/`merged`), `cardsCreated`, `cardsUpdated`, `cardsSkipped`.

### Progress & analysis

| Command | Service function | Returns |
| --- | --- | --- |
| `stats [--deck] [--subject] [--days 14]` | `getStudyStatistics(filters)` | totals, today, week, streak, correct vs incorrect, per-day activity, recent sessions |
| `due [--deck] [--no-new]` | `getDueCards(deckId)` | cards due now + new cards allowed today |
| `weak [--deck] [--limit 20]` | `getWeakCards(deckId)` | cards ranked by `weakness` (see below) |
| `settings:get` / `settings:set --data '{"newCardsPerDay":50}'` | `getSettings`, `updateSettings` | `newCardsPerDay`, `maxReviewsPerSession`, `allowTypos` |

All statistics are computed from stored `Review` and `StudySession` rows.

`weakness = 2·lapses + 4·max(0, 2.5 − easeFactor) + 6·(wrong share of the last 20 answers)`. Only cards with at least one answer are included.

## Spaced repetition (SM-2)

Implemented in `src/lib/srs.ts` (documented at the top of the file, tested in `tests/srs.test.ts`).

- Buttons map to SM-2 quality: Again 1, Hard 3, Good 4, Easy 5.
- Ease: `EF' = EF + (0.1 − (5−q)(0.08 + (5−q)·0.02))`, min 1.3 (Again capped at −0.2).
- Intervals: 1st success 1 d (Easy 4 d), 2nd 6 d (Hard 3, Easy 8), then `I × EF` (Hard `I × 1.2`, Easy `I × EF × 1.3`).
- Again: repetitions → 0, lapses + 1, due again in 10 minutes.
- Status: `new` (never reviewed) → `learning` (< 2 successful repetitions) → `review` → `mastered` (interval ≥ 21 days).
- Only the **Herhalen** mode changes the schedule. Flashcards and Learn answers are logged (`Review.mode`) for statistics and weak-card analysis.

## Recipes

Create a deck from course material:

```bash
npm run -s agent -- overview
# write imports/ir-banden.json in the import format
npm run -s agent -- import imports/ir-banden.json --dry-run
npm run -s agent -- import imports/ir-banden.json
```

Fix a card:

```bash
npm run -s agent -- search "C=O"
npm run -s agent -- cards:update <cardId> --data '{"back":"1715 cm⁻¹; 1715 cm-1"}'
```

Find what to study:

```bash
npm run -s agent -- weak --limit 10
npm run -s agent -- stats --days 7
```

## Data model

`prisma/schema.prisma`: `Subject` 1–n `Deck` 1–n `Card` 1–n `Review`; `StudySession` 1–n `Review`; `Setting` (key/value). Deleting a deck cascades to its cards and reviews; deleting a subject keeps its decks.
