// save.ts — versioned serialization (v2), migration chain, corruption guard,
// base64 export/import. The ONLY engine module allowed to touch storage —
// and even that is injectable (StorageLike) so tests never need a DOM.
//
// Key decisions (02 §5 + 10 §3.3):
// - localStorage key stays "fable-idler-save-v1" (historic name; the REAL
//   version lives IN the payload — decided in 02 §5, confirmed for v2).
// - corrupted payloads are MOVED to "fable-idler-save-v1:corrupt" (recoverable
//   manually) and the game falls back to a fresh state — load NEVER crashes.
// - CURRENT_SAVE_VERSION = 2; MIGRATIONS[1] performs the real v1→v2 migration
//   with the exact defaults from 10 §3.3 (lifetimeQuillsEarned = wallet,
//   faded fables, startedAt = 0 sentinel, …).

import {
  ATELIER_UPGRADES,
  BUFF,
  GENERATOR_IDS,
  ACHIEVEMENT_IDS,
  SPARK,
  STANDING_OVATION_DURATION_MULT,
  UPGRADES,
} from './config';
import { createFadedFable } from './fables';
import { createInitialMetaState, createInitialRunState } from './state';
import type {
  AchievementId,
  BuyQty,
  Fable,
  FableRunStats,
  GameState,
  MetaState,
  RunState,
  RunUpgradeId,
  Settings,
  SparkBuffState,
} from './types';

export const SAVE_KEY = 'fable-idler-save-v1';
export const SAVE_BACKUP_KEY = 'fable-idler-save-v1:corrupt';
export const CURRENT_SAVE_VERSION = 3;

/** The legacy v1 payload shape — kept for documentation/tests of the migration. */
export interface SaveDataV1 {
  version: 1;
  savedAt: number;
  run: unknown;
  meta: unknown;
}

/** The v2 payload shape — kept for documentation/tests of the v2→v3 migration. */
export interface SaveDataV2 {
  version: 2;
  savedAt: number;
  run: unknown;
  meta: unknown;
}

export interface SaveDataV3 {
  version: 3;
  savedAt: number;
  run: RunState;
  meta: MetaState;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type Migration = (old: unknown) => unknown;

// ---------------------------------------------------------------------------
// Validation / sanitization helpers (manual shape check — zero deps, strict TS)
// ---------------------------------------------------------------------------

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function nonNegativeNumber(x: unknown, fallback: number | null): number | null {
  if (isFiniteNumber(x) && x >= 0) return x;
  return fallback;
}

function nonNegativeInt(x: unknown, fallback: number): number {
  const v = nonNegativeNumber(x, null);
  return v === null ? fallback : Math.floor(v);
}

// ---------------------------------------------------------------------------
// Migration chain
// ---------------------------------------------------------------------------

/** Hostile v1 payloads can claim absurd tome counts — cap the retroactive
 *  fable generation so a crafted save cannot stall the load. */
const MIGRATION_MAX_FADED_FABLES = 1_000;

/**
 * MIGRATIONS[n] converts a version-n payload to version n+1.
 * MIGRATIONS[1]: the real v1→v2 migration — exact defaults from 10 §3.3.
 * Defensive on hostile shapes: it only fills in the new fields; the v2
 * sanitizers below still validate everything afterwards.
 */
export const MIGRATIONS: Record<number, Migration> = {
  1: (old: unknown): unknown => {
    if (!isRecord(old)) return old;
    const run = isRecord(old.run) ? old.run : {};
    const meta = isRecord(old.meta) ? old.meta : {};
    const stats = isRecord(meta.stats) ? meta.stats : {};
    const savedAt = nonNegativeNumber(old.savedAt, 0) ?? 0;
    // GOLDEN RULE migration: v1 never spent quills ⇒ wallet ≡ lifetime earned.
    const lifetimeQuills = nonNegativeInt(meta.goldenQuills, 0);
    const tomes = nonNegativeInt(meta.tomesPublished, 0);
    const fadedCount = Math.min(tomes, MIGRATION_MAX_FADED_FABLES);
    const fables: Fable[] = [];
    for (let i = 1; i <= fadedCount; i++) fables.push(createFadedFable(i, savedAt));
    return {
      ...old,
      version: 2,
      run: {
        ...run,
        startedAt: 0, // sentinel: unknown run start (deviation A5) — never counts for Fastest Publish
        sparkBuff: null,
        buffActivationsThisRun: 0,
        lastAutoBuyAt: 0,
      },
      meta: {
        ...meta,
        storyFragments: 0,
        atelier: {},
        fables,
        stats: {
          ...stats,
          lifetimeQuillsEarned: lifetimeQuills,
          sparksCaught: 0,
          quillsFromFragments: 0,
          fastestPublishMs: null,
        },
      },
    };
  },
  // MIGRATIONS[2]: the real v2→v3 migration — additive per 14 §8. The generators
  // 9–14 start at 0, the 7 v3 re-scalers uncbought (run.upgrades untouched), the
  // 6 new Atelier upgrades absent (meta.atelier untouched), achievements 25–36
  // locked, and the ONE new run field is set:
  //   run.seededInspiration = 0 — the run in progress at migration never had a
  //   seed larger than Dog-Eared 300, and q(300) = 0, so this is numerically a
  //   no-op. Everything derived (qty thresholds, unique bonuses, taper, relics)
  //   needs no storage. The v3 sanitizers below then validate everything.
  2: (old: unknown): unknown => {
    if (!isRecord(old)) return old;
    const run = isRecord(old.run) ? old.run : {};
    return {
      ...old,
      version: 3,
      run: {
        ...run,
        seededInspiration: 0,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

const RUN_UPGRADE_IDS: readonly RunUpgradeId[] = UPGRADES.filter(
  (u) => u.id !== 'quillResonance',
).map((u) => u.id as RunUpgradeId);

const ACHIEVEMENT_ID_SET = new Set<string>(ACHIEVEMENT_IDS);

/** Longest legitimate buff window: Burst of Genius × Standing Ovation (45s). */
const MAX_BUFF_DURATION_MS = BUFF.durationUpgradedMs * STANDING_OVATION_DURATION_MULT;

const MAX_FABLE_TITLE_LENGTH = 120;
/** Defensive cap on stored fables (uniqueFableCount is O(n) per selector call). */
const MAX_FABLES = 5_000;

function sanitizeSparkBuff(x: unknown, savedAt: number): SparkBuffState | null {
  if (!isRecord(x)) return null;
  const kind = x.kind;
  if (kind !== 'quillFrenzy' && kind !== 'gossipBonanza') return null;
  // The engine can never write an expiry beyond savedAt + duration × Net L2.
  const maxDurationMs =
    (kind === 'gossipBonanza' ? SPARK.gossip.durationMs : SPARK.frenzy.durationMs) *
    SPARK.netRewardMult;
  return {
    kind,
    activeUntil: Math.min(nonNegativeNumber(x.activeUntil, 0) ?? 0, savedAt + maxDurationMs),
  };
}

function sanitizeRun(x: unknown, savedAt: number): RunState | null {
  if (!isRecord(x)) return null;
  const inspiration = nonNegativeNumber(x.inspiration, null);
  const totalEarned = nonNegativeNumber(x.totalEarned, null);
  if (inspiration === null || totalEarned === null) return null;
  if (!isRecord(x.generators)) return null;

  const run = createInitialRunState(0);
  // Invariant the engine always maintains: everything earned flows through
  // totalEarned, so the balance can never exceed it. Repair violating payloads
  // by lifting totalEarned (never by destroying balance — a legacy migration
  // may legitimately know only the balance).
  run.inspiration = inspiration;
  run.totalEarned = Math.max(totalEarned, inspiration);

  for (const id of GENERATOR_IDS) {
    const v = x.generators[id];
    if (v === undefined) continue;
    if (!isFiniteNumber(v) || v < 0) return null;
    run.generators[id] = Math.floor(v);
  }

  if (x.upgrades !== undefined) {
    if (!isRecord(x.upgrades)) return null;
    for (const id of RUN_UPGRADE_IDS) {
      if (x.upgrades[id] === true) run.upgrades[id] = true;
    }
  }

  if (x.milestones !== undefined) {
    if (!Array.isArray(x.milestones)) return null;
    run.milestones = [
      ...new Set(x.milestones.filter((m): m is string => typeof m === 'string')),
    ];
  }

  if (x.buff !== undefined) {
    if (!isRecord(x.buff)) return null;
    // The engine can NEVER produce timestamps beyond activation + duration /
    // + cooldown; a save written at `savedAt` therefore cannot legitimately
    // exceed these bounds. Clamp instead of trusting a hostile import
    // (otherwise: permanent ×2/×5 buff, or a button locked for years).
    run.buff = {
      activeUntil: Math.min(
        nonNegativeNumber(x.buff.activeUntil, 0) ?? 0,
        savedAt + MAX_BUFF_DURATION_MS,
      ),
      cooldownUntil: Math.min(
        nonNegativeNumber(x.buff.cooldownUntil, 0) ?? 0,
        savedAt + BUFF.cooldownMs,
      ),
    };
  }

  // --- v2 fields — tolerant defaults, hostile values clamped ---
  // startedAt in the future would fabricate an impossibly fast publish.
  run.startedAt = Math.min(nonNegativeNumber(x.startedAt, 0) ?? 0, savedAt);
  run.sparkBuff = sanitizeSparkBuff(x.sparkBuff, savedAt);
  run.buffActivationsThisRun = nonNegativeInt(x.buffActivationsThisRun, 0);
  run.lastAutoBuyAt = Math.min(nonNegativeNumber(x.lastAutoBuyAt, 0) ?? 0, savedAt);
  // --- v3 field — seed capital of the run, clamped to [0, totalEarned] (a seed
  // larger than what was earned would let the anti-exploit net-seed subtraction
  // hide legitimate earnings, or go negative). ---
  run.seededInspiration = Math.min(
    nonNegativeNumber(x.seededInspiration, 0) ?? 0,
    run.totalEarned,
  );
  return run;
}

function sanitizeLeaderboard(x: unknown): Settings['leaderboard'] | undefined {
  if (!isRecord(x)) return undefined;
  const { playerId, token, nickname, lastSubmittedAt } = x;
  if (
    typeof playerId === 'string' && playerId.length > 0 && playerId.length <= 64 &&
    typeof token === 'string' && token.length > 0 && token.length <= 128 &&
    typeof nickname === 'string' && nickname.length > 0 && nickname.length <= 20 &&
    isFiniteNumber(lastSubmittedAt) && lastSubmittedAt >= 0
  ) {
    return { playerId, token, nickname, lastSubmittedAt };
  }
  // Invalid identity never blocks the load — it is simply dropped (10 §3.3).
  return undefined;
}

function sanitizeSettings(x: unknown): Settings {
  const settings: Settings = {};
  if (!isRecord(x)) return settings;
  if (x.numberNotation === 'suffix' || x.numberNotation === 'scientific') {
    settings.numberNotation = x.numberNotation;
  }
  if (x.buyQty === 1 || x.buyQty === 10 || x.buyQty === 'max') {
    settings.buyQty = x.buyQty as BuyQty;
  }
  if (typeof x.reduceMotion === 'boolean') settings.reduceMotion = x.reduceMotion;
  const leaderboard = sanitizeLeaderboard(x.leaderboard);
  if (leaderboard) settings.leaderboard = leaderboard;
  return settings;
}

function sanitizeFables(x: unknown): Fable[] {
  if (!Array.isArray(x)) return [];
  const seen = new Set<number>();
  const fables: Fable[] = [];
  for (const f of x) {
    if (fables.length >= MAX_FABLES) break;
    if (!isRecord(f)) continue;
    if (!isFiniteNumber(f.n) || f.n < 1) continue;
    const n = Math.floor(f.n);
    if (seen.has(n)) continue; // dedupe on n — the engine appends exactly one per tome
    if (typeof f.title !== 'string' || f.title.length === 0) continue;
    if (f.title.length > MAX_FABLE_TITLE_LENGTH) continue;
    let runStats: FableRunStats | null = null;
    if (isRecord(f.runStats)) {
      const totalEarned = nonNegativeNumber(f.runStats.totalEarned, null);
      const quillsEarned = nonNegativeNumber(f.runStats.quillsEarned, null);
      if (totalEarned !== null && quillsEarned !== null) {
        const d = f.runStats.durationMs;
        runStats = {
          totalEarned,
          durationMs: isFiniteNumber(d) && d >= 0 ? d : null,
          quillsEarned: Math.floor(quillsEarned),
        };
      }
    }
    seen.add(n);
    fables.push({
      n,
      title: f.title,
      publishedAt: nonNegativeNumber(f.publishedAt, 0) ?? 0,
      runStats,
      gilded: f.gilded === true,
    });
  }
  fables.sort((a, b) => a.n - b.n);
  return fables;
}

function sanitizeMeta(x: unknown): MetaState | null {
  if (!isRecord(x)) return null;
  const goldenQuills = nonNegativeNumber(x.goldenQuills, null);
  const tomesPublished = nonNegativeNumber(x.tomesPublished, null);
  if (goldenQuills === null || tomesPublished === null) return null;

  const meta = createInitialMetaState();
  meta.goldenQuills = Math.floor(goldenQuills);
  meta.tomesPublished = Math.floor(tomesPublished);
  meta.quillResonance = x.quillResonance === true;

  if (x.achievements !== undefined) {
    if (!Array.isArray(x.achievements)) return null;
    // Dedupe: duplicated ids would permanently inflate achievementMultiplier
    // (+1%/entry) and the "N/24" counters — a state the engine cannot produce.
    meta.achievements = [
      ...new Set(
        x.achievements.filter(
          (a): a is AchievementId => typeof a === 'string' && ACHIEVEMENT_ID_SET.has(a),
        ),
      ),
    ];
  }

  if (x.stats !== undefined) {
    if (!isRecord(x.stats)) return null;
    const fastest = x.stats.fastestPublishMs;
    meta.stats = {
      totalClicks: nonNegativeNumber(x.stats.totalClicks, 0) ?? 0,
      lifetimeInspiration: nonNegativeNumber(x.stats.lifetimeInspiration, 0) ?? 0,
      buffActivations: nonNegativeNumber(x.stats.buffActivations, 0) ?? 0,
      offlineSessionsOver30Min: nonNegativeNumber(x.stats.offlineSessionsOver30Min, 0) ?? 0,
      bestSingleOfflineGain: nonNegativeNumber(x.stats.bestSingleOfflineGain, 0) ?? 0,
      // v2
      lifetimeQuillsEarned: nonNegativeInt(x.stats.lifetimeQuillsEarned, 0),
      sparksCaught: nonNegativeInt(x.stats.sparksCaught, 0),
      quillsFromFragments: nonNegativeInt(x.stats.quillsFromFragments, 0),
      fastestPublishMs: isFiniteNumber(fastest) && fastest > 0 ? fastest : null,
    };
  }

  // --- v2 fields ---
  if (isRecord(x.atelier)) {
    for (const cfg of ATELIER_UPGRADES) {
      const level = nonNegativeInt(x.atelier[cfg.id], 0);
      if (level > 0) meta.atelier[cfg.id] = Math.min(level, cfg.costs.length);
    }
  }
  // storyFragments can only ever be 0–4 in engine states (5 binds instantly).
  meta.storyFragments = Math.min(
    nonNegativeInt(x.storyFragments, 0),
    SPARK.fragmentsPerQuill - 1,
  );
  meta.fables = sanitizeFables(x.fables);

  // GOLDEN-RULE INVARIANT (11 §1.2): the spendable wallet can never exceed the
  // lifetime total earned. Repair hostile payloads by LIFTING the lifetime
  // (same repair style as totalEarned = max(totalEarned, inspiration)).
  meta.stats.lifetimeQuillsEarned = Math.max(
    meta.stats.lifetimeQuillsEarned,
    meta.goldenQuills,
  );

  meta.settings = sanitizeSettings(x.settings);
  return meta;
}

/** Shape-validate an already-parsed (and migrated) payload. Null = invalid. */
export function sanitizeSaveData(data: unknown): SaveDataV3 | null {
  if (!isRecord(data)) return null;
  if (data.version !== CURRENT_SAVE_VERSION) return null;
  if (!isFiniteNumber(data.savedAt) || data.savedAt < 0) return null;
  const run = sanitizeRun(data.run, data.savedAt);
  if (!run) return null;
  const meta = sanitizeMeta(data.meta);
  if (!meta) return null;
  return { version: CURRENT_SAVE_VERSION, savedAt: data.savedAt, run, meta };
}

// ---------------------------------------------------------------------------
// Migration application
// ---------------------------------------------------------------------------

/** Apply the migration chain until the payload reaches `targetVersion`. */
export function applyMigrations(
  data: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  targetVersion: number = CURRENT_SAVE_VERSION,
): unknown {
  let current = data;
  let guard = 0;
  while (
    isRecord(current) &&
    typeof current.version === 'number' &&
    current.version < targetVersion &&
    guard++ < 32
  ) {
    const migrate = migrations[current.version];
    if (!migrate) return current; // no path forward → validation will reject it
    current = migrate(current);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Serialize / deserialize
// ---------------------------------------------------------------------------

export function serializeState(state: GameState, savedAt: number): string {
  const data: SaveDataV3 = {
    version: CURRENT_SAVE_VERSION,
    savedAt,
    run: state.run,
    meta: state.meta,
  };
  return JSON.stringify(data);
}

/** Parse + migrate + validate a JSON payload. Null = unusable (never throws). */
export function parseSave(
  json: string,
  migrations: Record<number, Migration> = MIGRATIONS,
): SaveDataV3 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return sanitizeSaveData(applyMigrations(parsed, migrations));
}

export interface LoadedSave {
  state: GameState;
  savedAt: number;
}

function toLoadedSave(data: SaveDataV3): LoadedSave {
  return {
    state: { run: data.run, meta: data.meta, lastTickAt: data.savedAt },
    savedAt: data.savedAt,
  };
}

/**
 * Load from storage. Missing key → null (caller creates a fresh state).
 * Corrupted/invalid payload → raw string moved to SAVE_BACKUP_KEY, null returned.
 * Never throws, never crashes the game at load.
 */
export function loadSave(storage: StorageLike): LoadedSave | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const data = parseSave(raw);
  if (!data) {
    try {
      storage.setItem(SAVE_BACKUP_KEY, raw);
      storage.removeItem(SAVE_KEY);
      // eslint-disable-next-line no-console
      console.warn(
        `[fable-idler] Corrupted save detected — backed up under "${SAVE_BACKUP_KEY}" and starting fresh.`,
      );
    } catch {
      // storage full/unavailable — still fall back to a fresh state
    }
    return null;
  }
  return toLoadedSave(data);
}

/** Persist the state under SAVE_KEY. Swallows storage errors (quota etc.). */
export function persistSave(storage: StorageLike, state: GameState, now: number): void {
  try {
    storage.setItem(SAVE_KEY, serializeState(state, now));
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[fable-idler] Failed to persist save (storage unavailable or full).');
  }
}

// ---------------------------------------------------------------------------
// Export / import (base64 over UTF-8 JSON — 02 §5)
// ---------------------------------------------------------------------------

function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Base64 string for the settings "Export save" textarea. */
export function exportSave(state: GameState, savedAt: number): string {
  return toBase64(serializeState(state, savedAt));
}

/**
 * Parse an imported save string (base64; raw JSON accepted as a fallback).
 * Null = invalid — the caller decides how to surface the error. Never throws.
 */
export function importSaveString(data: string): LoadedSave | null {
  const trimmed = data.trim();
  if (trimmed.length === 0) return null;
  let json: string | null = null;
  try {
    json = fromBase64(trimmed);
  } catch {
    json = null;
  }
  if (json !== null) {
    const parsed = parseSave(json);
    if (parsed) return toLoadedSave(parsed);
  }
  const parsedRaw = parseSave(trimmed);
  return parsedRaw ? toLoadedSave(parsedRaw) : null;
}
