// rate-limit.mjs — fixed-window per-key (per-IP) rate limiter, in memory.
// Contract: ai-memory/10-v2-architecture.md §1.5 — 60s window, lazy cleanup,
// hard cap on tracked keys (expired windows are evicted when the cap is hit).

/**
 * @param {{ now?: () => number, windowMs?: number, maxKeys?: number }} [options]
 */
export function createRateLimiter({ now = Date.now, windowMs = 60_000, maxKeys = 10_000 } = {}) {
  /** @type {Map<string, { start: number, count: number }>} */
  const windows = new Map();

  /**
   * Registers one hit for `key` and checks it against `limit` hits / window.
   * @param {string} key
   * @param {number} limit
   * @returns {{ allowed: boolean, retryAfterSec: number }}
   */
  function check(key, limit) {
    const t = now();
    if (windows.size >= maxKeys) {
      for (const [k, w] of windows) {
        if (t - w.start >= windowMs) windows.delete(k);
      }
    }
    let w = windows.get(key);
    if (!w || t - w.start >= windowMs) {
      w = { start: t, count: 0 };
      windows.set(key, w);
    }
    w.count += 1;
    if (w.count > limit) {
      const retryAfterSec = Math.max(1, Math.ceil((w.start + windowMs - t) / 1000));
      return { allowed: false, retryAfterSec };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  return { check };
}
