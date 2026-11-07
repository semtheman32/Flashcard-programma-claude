/**
 * Service layer — the single, documented data interface of the app.
 * Used by the web UI (server actions / server components), the agent CLI (agent/cli.ts)
 * and the tests. See agent/README.md for the full reference.
 */
export * from "./subjects";
export * from "./decks";
export * from "./cards";
export * from "./study";
export * from "./stats";
export * from "./io";
export * from "./settings";
export { NotFoundError } from "./errors";
export type { CardDTO, DeckSummary, StatusCounts } from "./mappers";
