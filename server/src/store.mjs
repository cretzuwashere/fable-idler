// store.mjs — in-memory Map of leaderboard entries + atomic JSON persistence.
// Contract: ai-memory/10-v2-architecture.md §1.3.
// - Runtime source of truth = the Map (single process, no concurrency).
// - Atomic write: tmp file + rename in the same directory.
// - Dirty flag + debounced flush (the 2s interval lives in app.mjs).
// - Corrupt file at boot -> renamed to a backup, server starts EMPTY (no crash).
// - GC: entries older than ttlDays (0 = disabled) are dropped at load and
//   periodically (the 6h interval lives in app.mjs).

import fs from 'node:fs';
import path from 'node:path';

const DESC_METRICS = new Set(['lifetimeInspiration', 'tomesPublished', 'lifetimeQuillsEarned']);

/**
 * @typedef {{
 *   playerId: string,
 *   nickname: string,
 *   nicknameLower: string,
 *   tokenHash: string,
 *   scores: { lifetimeInspiration: number, tomesPublished: number,
 *             lifetimeQuillsEarned: number, fastestPublishMs: number | null },
 *   createdAt: number,
 *   updatedAt: number,
 * }} Entry
 */

/**
 * @param {{ dataFile: string, now?: () => number, ttlDays?: number }} options
 */
export function createStore({ dataFile, now = Date.now, ttlDays = 90 }) {
  /** @type {Map<string, Entry>} */
  const entries = new Map();
  /** @type {Map<string, string>} nicknameLower -> playerId */
  const byNicknameLower = new Map();
  let dirty = false;

  load();
  gc();

  function load() {
    /** @type {string} */
    let raw;
    try {
      raw = fs.readFileSync(dataFile, 'utf8');
    } catch {
      return; // no file yet -> start empty
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
        throw new Error('unexpected shape');
      }
      for (const e of parsed.entries) {
        if (
          !e || typeof e !== 'object' ||
          typeof e.playerId !== 'string' || typeof e.nickname !== 'string' ||
          typeof e.nicknameLower !== 'string' || typeof e.tokenHash !== 'string' ||
          !e.scores || typeof e.scores !== 'object' ||
          typeof e.createdAt !== 'number' || typeof e.updatedAt !== 'number'
        ) {
          throw new Error('invalid entry');
        }
        entries.set(e.playerId, e);
        byNicknameLower.set(e.nicknameLower, e.playerId);
      }
    } catch (err) {
      // Corrupt file: back it up, start empty, never crash.
      entries.clear();
      byNicknameLower.clear();
      const backup = `${dataFile}.corrupt-${now()}`;
      try {
        fs.renameSync(dataFile, backup);
        console.warn(`[leaderboard] corrupt data file — backed up to ${backup}, starting empty (${err instanceof Error ? err.message : String(err)})`);
      } catch (renameErr) {
        console.warn(`[leaderboard] corrupt data file and backup failed — starting empty (${renameErr instanceof Error ? renameErr.message : String(renameErr)})`);
      }
    }
  }

  /** Flushes to disk only when dirty. Atomic: write tmp, then rename. */
  function flush() {
    if (!dirty) return;
    const payload = JSON.stringify({ version: 1, entries: [...entries.values()] });
    const tmp = `${dataFile}.tmp`;
    try {
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(tmp, payload);
      fs.renameSync(tmp, dataFile);
      dirty = false;
    } catch (err) {
      // Keep dirty=true — the next flush retries. Log, never throw.
      console.error(`[leaderboard] flush failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function markDirty() {
    dirty = true;
  }

  /** Drops entries not updated in the last ttlDays. 0 = GC disabled. */
  function gc() {
    if (!ttlDays) return;
    const cutoff = now() - ttlDays * 86_400_000;
    for (const [id, e] of entries) {
      if (e.updatedAt < cutoff) {
        entries.delete(id);
        byNicknameLower.delete(e.nicknameLower);
        dirty = true;
      }
    }
  }

  /** @param {Entry} entry */
  function add(entry) {
    entries.set(entry.playerId, entry);
    byNicknameLower.set(entry.nicknameLower, entry.playerId);
    dirty = true;
  }

  /**
   * @param {string} nicknameLower
   * @returns {Entry | undefined}
   */
  function findByNickname(nicknameLower) {
    const id = byNicknameLower.get(nicknameLower);
    return id === undefined ? undefined : entries.get(id);
  }

  /**
   * @param {Entry} entry
   * @param {string} newNickname
   */
  function rename(entry, newNickname) {
    byNicknameLower.delete(entry.nicknameLower);
    entry.nickname = newNickname;
    entry.nicknameLower = newNickname.toLowerCase();
    byNicknameLower.set(entry.nicknameLower, entry.playerId);
    dirty = true;
  }

  /**
   * Deterministically sorted leaderboard for one metric.
   * DESC on the three monotone metrics, ASC on fastestPublishMs (nulls
   * excluded). Tie-break: older updatedAt first, then playerId lexicographic.
   * @param {'lifetimeInspiration'|'tomesPublished'|'lifetimeQuillsEarned'|'fastestPublishMs'} by
   * @returns {Entry[]}
   */
  function sorted(by) {
    const asc = !DESC_METRICS.has(by);
    /** @type {Entry[]} */
    const list = [];
    for (const e of entries.values()) {
      if (by === 'fastestPublishMs' && e.scores.fastestPublishMs === null) continue;
      list.push(e);
    }
    list.sort((a, b) => {
      const av = /** @type {number} */ (a.scores[by]);
      const bv = /** @type {number} */ (b.scores[by]);
      if (av !== bv) return (av < bv ? -1 : 1) * (asc ? 1 : -1);
      if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
      return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
    });
    return list;
  }

  /**
   * 1-based rank of a player in one leaderboard; null when absent
   * (e.g. fastestPublishMs still null).
   * @param {'lifetimeInspiration'|'tomesPublished'|'lifetimeQuillsEarned'|'fastestPublishMs'} by
   * @param {string} playerId
   * @returns {number | null}
   */
  function rankOf(by, playerId) {
    const list = sorted(by);
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].playerId === playerId) return i + 1;
    }
    return null;
  }

  return {
    entries,
    add,
    findByNickname,
    rename,
    sorted,
    rankOf,
    flush,
    markDirty,
    gc,
    get size() {
      return entries.size;
    },
  };
}
