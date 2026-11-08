# Instructions for Claude Code

This repo is a local study app (Next.js + Prisma/SQLite). The user (Sem, Dutch-speaking student) asks you to create and manage flashcards. **Manage content through the agent CLI, never by editing the database file or writing SQL.**

- CLI reference: `agent/README.md`. Import format: `agent/IMPORT_FORMAT.md`.
- Run `npm install` once if `node_modules` is missing. The CLI applies to `prisma/dev.db` (same DB as the running app); run `npx prisma migrate deploy` first if the DB doesn't exist yet.
- Start every content task with `npm run agent -- overview` to see existing subjects/decks.
- To add a deck of cards: write a JSON file in the import format (e.g. under `imports/`), then `npm run agent -- import imports/<file>.json --dry-run`, check the report, then run it without `--dry-run`. Imports are idempotent (duplicate fronts are skipped).
- Deletions and merges require `--yes`. Only delete when the user explicitly asks.
- Write card content in the language of the user's course material (usually Dutch). Keep fronts short and unambiguous; put one fact per card. For typed answers in Learn mode, keep the expected answer short and list accepted alternatives with `;`.
- Use tags for chapters/topics (`h3`, `ir`, `1h-nmr`) so the user can filter.
- Code layout: services in `src/server/` (single data-access layer), validation in `src/lib/schemas.ts`, SM-2 in `src/lib/srs.ts`. Run `npm test` and `npm run typecheck` after code changes.
