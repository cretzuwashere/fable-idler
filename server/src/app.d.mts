// app.d.mts — hand-written type declarations for app.mjs so the Vitest
// server tests (tests/server/leaderboard-api.test.ts) are typed WITHOUT
// adding @types/node or any dependency. Contract: 10-v2-architecture.md §1.2.

/** The four reported metrics — literal ids shared with the client. */
export type LeaderboardMetric =
  | 'lifetimeInspiration'
  | 'tomesPublished'
  | 'lifetimeQuillsEarned'
  | 'fastestPublishMs';

export interface ScoreSet {
  lifetimeInspiration: number;
  tomesPublished: number;
  lifetimeQuillsEarned: number;
  /** null = no timed publish yet (excluded from that leaderboard). */
  fastestPublishMs: number | null;
}

/** Persisted shape of one leaderboard entry (token stored as SHA-256 hex). */
export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  nicknameLower: string;
  tokenHash: string;
  scores: ScoreSet;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAppOptions {
  /** Path of the JSON snapshot (atomic tmp+rename writes). */
  dataFile: string;
  /** Injectable clock (epoch ms) — rate-limit/GC tests need it. */
  now?: () => number;
  /** Days of inactivity before GC removes an entry; 0 disables GC. */
  ttlDays?: number;
  /** Hard ceiling on distinct entries; new CLAIMs past it get 503. */
  maxEntries?: number;
  rateLimits?: { submitPerMin?: number; readPerMin?: number };
}

/**
 * Minimal structural view of the returned node:http.Server — enough for the
 * tests to listen on an ephemeral port, read it back and shut down cleanly,
 * without pulling in @types/node.
 */
export interface LeaderboardServer {
  listen(port: number, callback?: () => void): LeaderboardServer;
  close(callback?: (err?: unknown) => void): LeaderboardServer;
  /** Node >= 18.2 — drops keep-alive sockets so close() completes. */
  closeAllConnections?(): void;
  address(): { port: number } | string | null;
  /** Test/shutdown helper: synchronous flush of the dirty snapshot. */
  flushNow(): void;
}

/** Builds the full API server, NOT yet listening. */
export function createApp(options: CreateAppOptions): LeaderboardServer;
