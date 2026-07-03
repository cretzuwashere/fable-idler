// save.ts — versioned serialization (v1), migration chain, corruption guard,
// base64 export/import. The ONLY engine module allowed to touch storage —
// and even that is injectable (StorageLike) so tests never need a DOM.
//
// Key decisions (02 §5, orchestrator task):
// - localStorage key: "fable-idler-save-v1" (version also lives IN the payload).
// - corrupted payloads are MOVED to "fable-idler-save-v1:corrupt" (recoverable
//   manually) and the game falls back to a fresh state — load NEVER crashes.

import { BUFF, GENERATOR_IDS, ACHIEVEMENT_IDS, UPGRADES } from './config';
import { createInitialMetaState, createInitialRunState } from './state';
import type {
  AchievementId,
  BuyQty,
  GameState,
  MetaState,
  RunState,
  RunUpgradeId,
  Settings,
} from './types';

export const SAVE_KEY = 'fable-idler-save-v1';
export const SAVE_BACKUP_KEY = 'fable-idler-save-v1:corrupt';
export const CURRENT_SAVE_VERSION = 1;

export interface SaveDataV1 {
  version: 1;
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

/** Migration chain: MIGRATIONS[n] converts a version-n payload to version n+1.
 *  v1 is the first schema — the mechanism exists from day one (02 §5). */
export const MIGRATIONS: Record<number, Migration> = {};

// ---------------------------------------------------------------------------
// Validation / sanitization (manual shape check — zero deps, strict TS)
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

const RUN_UPGRADE_IDS: readonly RunUpgradeId[] = UPGRADES.filter(
  (u) => u.id !== 'quillResonance',
).map((u) => u.id as RunUpgradeId);

const ACHIEVEMENT_ID_SET = new Set<string>(ACHIEVEMENT_IDS);

function sanitizeRun(x: unknown, savedAt: number): RunState | null {
  if (!isRecord(x)) return null;
  const inspiration = nonNegativeNumber(x.inspiration, null);
  const totalEarned = nonNegativeNumber(x.totalEarned, null);
  if (inspiration === null || totalEarned === null) return null;
  if (!isRecord(x.generators)) return null;

  const run = createInitialRunState();
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
        savedAt + BUFF.durationUpgradedMs,
      ),
      cooldownUntil: Math.min(
        nonNegativeNumber(x.buff.cooldownUntil, 0) ?? 0,
        savedAt + BUFF.cooldownMs,
      ),
    };
  }
  return run;
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
  return settings;
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
    // (+1%/entry) and the "N/14" counters — a state the engine cannot produce.
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
    meta.stats = {
      totalClicks: nonNegativeNumber(x.stats.totalClicks, 0) ?? 0,
      lifetimeInspiration: nonNegativeNumber(x.stats.lifetimeInspiration, 0) ?? 0,
      buffActivations: nonNegativeNumber(x.stats.buffActivations, 0) ?? 0,
      offlineSessionsOver30Min: nonNegativeNumber(x.stats.offlineSessionsOver30Min, 0) ?? 0,
      bestSingleOfflineGain: nonNegativeNumber(x.stats.bestSingleOfflineGain, 0) ?? 0,
    };
  }

  meta.settings = sanitizeSettings(x.settings);
  return meta;
}

/** Shape-validate an already-parsed (and migrated) payload. Null = invalid. */
export function sanitizeSaveData(data: unknown): SaveDataV1 | null {
  if (!isRecord(data)) return null;
  if (data.version !== CURRENT_SAVE_VERSION) return null;
  if (!isFiniteNumber(data.savedAt) || data.savedAt < 0) return null;
  const run = sanitizeRun(data.run, data.savedAt);
  if (!run) return null;
  const meta = sanitizeMeta(data.meta);
  if (!meta) return null;
  return { version: 1, savedAt: data.savedAt, run, meta };
}

// ---------------------------------------------------------------------------
// Migration
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
  const data: SaveDataV1 = {
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
): SaveDataV1 | null {
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

function toLoadedSave(data: SaveDataV1): LoadedSave {
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
