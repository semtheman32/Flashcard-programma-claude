#!/usr/bin/env tsx
/**
 * Agent CLI — lets Claude Code (or you) manage decks and cards directly in the database.
 * Every command prints JSON to stdout. Errors print {"error": "..."} to stderr and exit 1.
 *
 *   npm run agent -- <command> [args] [--flags]
 *
 * Full reference: agent/README.md
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ZodError } from "zod";
import * as api from "../src/server";
import { prisma } from "../src/lib/db";

type Flags = Record<string, string | boolean>;

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split(/=(.*)/s, 2);
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/** JSON payload from --data '<json>', --file <path>, or stdin (when --stdin is passed). */
function payload(flags: Flags): unknown {
  if (typeof flags.data === "string") return JSON.parse(flags.data);
  if (typeof flags.file === "string") return JSON.parse(readFileSync(flags.file, "utf8"));
  if (flags.stdin) return JSON.parse(readStdin());
  throw new Error("missing input: pass --data '<json>', --file <path> or --stdin");
}

function need(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing argument: <${name}>`);
  return value;
}

function str(flags: Flags, k: string): string | undefined {
  return typeof flags[k] === "string" ? (flags[k] as string) : undefined;
}

function int(flags: Flags, k: string): number | undefined {
  const v = str(flags, k);
  return v === undefined ? undefined : Number.parseInt(v, 10);
}

function requireYes(flags: Flags, what: string) {
  if (!flags.yes) throw new Error(`refusing to ${what} without --yes (deletions are permanent)`);
}

const HELP = `Agent CLI — usage: npm run agent -- <command> [args] [--flags]

Overview
  overview                                  decks, subjects, totals and due counts in one call
  search <query>                            search decks and cards

Subjects
  subjects:list
  subjects:create --data '{"name":"Organische chemie"}'
  subjects:update <subjectId> --data '{...}'
  subjects:delete <subjectId> --yes         (decks are kept, without subject)

Decks
  decks:list [--subject <subjectId>]
  decks:get <deckId> [--cards]
  decks:create --data '{"name":"...","subjectName":"...","description":"..."}'
  decks:update <deckId> --data '{...}'
  decks:delete <deckId> --yes
  decks:duplicate <deckId> [--name "..."]
  decks:merge <targetDeckId> <sourceDeckId>... --yes

Cards
  cards:list [--deck <id>] [--subject <id>] [--tag <t>] [--status new|learning|review|mastered]
             [--type <t>] [--search <q>] [--sort position|created|updated|front|due|difficulty] [--limit n]
  cards:get <cardId>
  cards:create --data '{"deckId":"...","front":"...","back":"..."}'
  cards:update <cardId> --data '{"back":"..."}'
  cards:delete <cardId> --yes
  cards:move <cardId> <targetDeckId>
  cards:bulk-create --file cards.json        (JSON array of cards, each with deckId)
  cards:reset-progress <cardId>
  tags:list [--deck <id>]

Import / export
  import <file.json> [--on-existing merge|new] [--on-duplicate skip|update|add] [--dry-run]
  export <deckId> [--out file.json] [--progress]

Study analytics
  stats [--deck <id>] [--subject <id>] [--days 14]
  due [--deck <id>] [--no-new]
  weak [--deck <id>] [--limit 20]
  settings:get
  settings:set --data '{"newCardsPerDay":30}'
`;

async function run(cmd: string | undefined, args: string[], flags: Flags): Promise<unknown> {
  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
      process.stdout.write(HELP);
      return undefined;

    case "overview": {
      const [decks, subjects, stats] = await Promise.all([
        api.listDecks(),
        api.listSubjects(),
        api.getStudyStatistics({ days: 7 }),
      ]);
      return {
        totals: stats.totals,
        streak: stats.streak,
        subjects: subjects.map((s) => ({ id: s.id, name: s.name, deckCount: s.deckCount, cardCount: s.cardCount, progress: s.progress })),
        decks: decks.map((d) => ({
          id: d.id,
          name: d.name,
          subject: d.subject?.name ?? null,
          cardCount: d.cardCount,
          dueCount: d.dueCount,
          progress: d.progress,
          statusCounts: d.statusCounts,
          lastStudiedAt: d.lastStudiedAt,
        })),
      };
    }
    case "search":
      return api.search(need(args.join(" "), "query"), int(flags, "limit"));

    case "subjects:list":
      return api.listSubjects();
    case "subjects:create":
      return api.createSubject(payload(flags) as never);
    case "subjects:update":
      return api.updateSubject(need(args[0], "subjectId"), payload(flags) as never);
    case "subjects:delete":
      requireYes(flags, "delete a subject");
      return api.deleteSubject(need(args[0], "subjectId"));

    case "decks:list":
      return api.listDecks(str(flags, "subject") ? { subjectId: str(flags, "subject") } : {});
    case "decks:get": {
      const deck = await api.getDeck(need(args[0], "deckId"));
      return flags.cards ? { ...deck, cards: await api.listCards({ deckId: deck.id }) } : deck;
    }
    case "decks:create":
      return api.createDeck(payload(flags) as never);
    case "decks:update":
      return api.updateDeck(need(args[0], "deckId"), payload(flags) as never);
    case "decks:delete":
      requireYes(flags, "delete a deck");
      return api.deleteDeck(need(args[0], "deckId"));
    case "decks:duplicate":
      return api.duplicateDeck(need(args[0], "deckId"), str(flags, "name"));
    case "decks:merge":
      requireYes(flags, "merge decks (source decks are deleted)");
      if (args.length < 2) throw new Error("usage: decks:merge <targetDeckId> <sourceDeckId>... --yes");
      return api.mergeDecks(args[0], args.slice(1));

    case "cards:list":
      return api.listCards({
        deckId: str(flags, "deck"),
        subjectId: str(flags, "subject"),
        tag: str(flags, "tag"),
        status: str(flags, "status") as "new" | undefined,
        type: str(flags, "type") as "term" | undefined,
        search: str(flags, "search"),
        sort: str(flags, "sort") as "position" | undefined,
        limit: int(flags, "limit"),
      });
    case "cards:get":
      return api.getCard(need(args[0], "cardId"));
    case "cards:create":
      return api.createCard(payload(flags) as never);
    case "cards:update":
      return api.updateCard(need(args[0], "cardId"), payload(flags) as never);
    case "cards:delete":
      requireYes(flags, "delete a card");
      return api.deleteCard(need(args[0], "cardId"));
    case "cards:move":
      return api.moveCard(need(args[0], "cardId"), need(args[1], "targetDeckId"));
    case "cards:bulk-create": {
      const data = payload(flags);
      if (!Array.isArray(data)) throw new Error("cards:bulk-create expects a JSON array");
      const created = await api.bulkCreateCards(data);
      return { created: created.length, cards: created };
    }
    case "cards:reset-progress":
      return api.resetCardProgress(need(args[0], "cardId"));
    case "tags:list":
      return api.listTags(str(flags, "deck"));

    case "import": {
      const file = args[0] ?? str(flags, "file");
      const data = file ? JSON.parse(readFileSync(file, "utf8")) : payload(flags);
      return api.importDeck(data, {
        onExistingDeck: str(flags, "on-existing") as "merge" | undefined,
        onDuplicateCard: str(flags, "on-duplicate") as "skip" | undefined,
        dryRun: Boolean(flags["dry-run"]),
      });
    }
    case "export": {
      const data = await api.exportDeck(need(args[0], "deckId"), { includeProgress: Boolean(flags.progress) });
      const out = str(flags, "out");
      if (out) {
        writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
        return { written: out, cards: data.cards.length };
      }
      return data;
    }

    case "stats":
      return api.getStudyStatistics({ deckId: str(flags, "deck"), subjectId: str(flags, "subject"), days: int(flags, "days") });
    case "due": {
      const r = await api.getDueCards(str(flags, "deck"), { includeNew: !flags["no-new"] });
      return { dueCount: r.due.length, newCount: r.new.length, cards: r.cards };
    }
    case "weak":
      return api.getWeakCards(str(flags, "deck"), int(flags, "limit"));
    case "settings:get":
      return api.getSettings();
    case "settings:set":
      return api.updateSettings(payload(flags) as never);

    default:
      throw new Error(`unknown command: ${cmd}. Run "npm run agent -- help".`);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  try {
    const result = await run(cmd, positional, flags);
    if (result !== undefined) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (err) {
    const message =
      err instanceof ZodError
        ? err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")
        : err instanceof Error
          ? err.message
          : String(err);
    process.stderr.write(JSON.stringify({ error: message }) + "\n");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
