// app.mjs — createApp(deps) -> an UNSTARTED node:http.Server with the full
// Hall of Fables API. Zero external dependencies (node:http/crypto only).
// Contract: ai-memory/10-v2-architecture.md §1.4 (exact JSON shapes).
//
// Routes (served WITH the /api prefix — nginx/Vite pass the URI unchanged):
//   POST /api/leaderboard/submit   claim (no token) / update+rename (token)
//   GET  /api/leaderboard/top      ?by=&limit=&playerId=
//   GET  /api/health
//
// All responses: application/json + Cache-Control: no-store.
// `now` and `dataFile` are injectable for tests; listen() is the caller's job.

import http from 'node:http';
import crypto from 'node:crypto';
import { createStore } from './store.mjs';
import { validateSubmitBody, METRICS } from './validate.mjs';
import { createRateLimiter } from './rate-limit.mjs';

const MAX_BODY_BYTES = 4096;
const FLUSH_INTERVAL_MS = 2_000;
const GC_INTERVAL_MS = 6 * 3_600_000;
/** Hard ceiling on distinct entries. Per-IP rate limits do NOT bound the store
 *  (each CLAIM from a fresh IP adds a PERMANENT entry for ttlDays), so a modest
 *  botnet could otherwise exhaust disk/RAM. New CLAIMs past the cap get 503;
 *  existing players (token UPDATEs) are never blocked. 100k entries ≈ 26 MB. */
const DEFAULT_MAX_ENTRIES = 100_000;

/**
 * @param {{
 *   dataFile: string,
 *   now?: () => number,
 *   ttlDays?: number,
 *   maxEntries?: number,
 *   rateLimits?: { submitPerMin?: number, readPerMin?: number },
 * }} options
 */
export function createApp({ dataFile, now = Date.now, ttlDays = 90, maxEntries = DEFAULT_MAX_ENTRIES, rateLimits = {} }) {
  const submitPerMin = rateLimits.submitPerMin ?? 10;
  const readPerMin = rateLimits.readPerMin ?? 60;
  const store = createStore({ dataFile, now, ttlDays });
  const limiter = createRateLimiter({ now });
  const startedAt = now();

  /**
   * @param {import('node:http').ServerResponse} res
   * @param {number} status
   * @param {unknown} body
   * @param {Record<string, string>} [extraHeaders]
   */
  function sendJson(res, status, body, extraHeaders = {}) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(payload),
      ...extraHeaders,
    });
    res.end(payload);
  }

  /** @param {import('node:http').IncomingMessage} req */
  function clientIp(req) {
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real.length > 0) return real;
    return req.socket.remoteAddress ?? 'unknown';
  }

  /**
   * Reads the request body, capped at MAX_BODY_BYTES. Oversized bodies are
   * drained (not buffered) so the client gets a clean 422 instead of a reset.
   * @param {import('node:http').IncomingMessage} req
   * @returns {Promise<{ tooLarge: boolean, raw: string }>}
   */
  function readBody(req) {
    return new Promise((resolve, reject) => {
      /** @type {Buffer[]} */
      const chunks = [];
      let total = 0;
      let tooLarge = false;
      req.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_BODY_BYTES) {
          tooLarge = true;
          chunks.length = 0; // stop buffering, keep draining
        } else {
          chunks.push(chunk);
        }
      });
      req.on('end', () => resolve({ tooLarge, raw: Buffer.concat(chunks).toString('utf8') }));
      req.on('error', reject);
    });
  }

  /** @param {string} token */
  function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest();
  }

  /**
   * Constant-time token lookup: hash the presented token, timingSafeEqual
   * against every stored hash. O(n) is fine at this scale (§1.1).
   * @param {string} token
   */
  function findByToken(token) {
    const presented = hashToken(token);
    let found = null;
    for (const entry of store.entries.values()) {
      const stored = Buffer.from(entry.tokenHash, 'hex');
      if (stored.length === presented.length && crypto.timingSafeEqual(stored, presented)) {
        found = entry;
      }
    }
    return found;
  }

  /** @param {string} playerId */
  function ranksFor(playerId) {
    /** @type {Record<string, number | null>} */
    const ranks = {};
    for (const metric of METRICS) {
      ranks[metric] = store.rankOf(metric, playerId);
    }
    return ranks;
  }

  /**
   * Best-keeping merge (§0 A4): max on the three monotone metrics,
   * min-ignoring-null on fastestPublishMs. Updates can only improve.
   * @param {{ lifetimeInspiration: number, tomesPublished: number,
   *           lifetimeQuillsEarned: number, fastestPublishMs: number | null }} stored
   * @param {{ lifetimeInspiration: number, tomesPublished: number,
   *           lifetimeQuillsEarned: number, fastestPublishMs: number | null }} incoming
   */
  function mergeBest(stored, incoming) {
    return {
      lifetimeInspiration: Math.max(stored.lifetimeInspiration, incoming.lifetimeInspiration),
      tomesPublished: Math.max(stored.tomesPublished, incoming.tomesPublished),
      lifetimeQuillsEarned: Math.max(stored.lifetimeQuillsEarned, incoming.lifetimeQuillsEarned),
      fastestPublishMs:
        incoming.fastestPublishMs === null
          ? stored.fastestPublishMs
          : stored.fastestPublishMs === null
            ? incoming.fastestPublishMs
            : Math.min(stored.fastestPublishMs, incoming.fastestPublishMs),
    };
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async function handleSubmit(req, res) {
    const limit = limiter.check(`submit:${clientIp(req)}`, submitPerMin);
    if (!limit.allowed) {
      sendJson(res, 429, { error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, {
        'Retry-After': String(limit.retryAfterSec),
      });
      return;
    }

    const { tooLarge, raw } = await readBody(req);
    if (tooLarge) {
      sendJson(res, 422, { error: 'invalid_payload', field: 'body' });
      return;
    }
    /** @type {unknown} */
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendJson(res, 422, { error: 'invalid_payload', field: 'body' });
      return;
    }
    const validated = validateSubmitBody(parsed);
    if (!validated.ok) {
      sendJson(res, 422, { error: 'invalid_payload', field: validated.field });
      return;
    }
    const { nickname, token, scores } = validated.value;
    const nicknameLower = nickname.toLowerCase();

    if (token !== undefined) {
      // UPDATE (and possibly rename)
      const entry = findByToken(token);
      if (!entry) {
        sendJson(res, 401, { error: 'invalid_token' });
        return;
      }
      if (nickname !== entry.nickname) {
        const holder = store.findByNickname(nicknameLower);
        if (holder && holder.playerId !== entry.playerId) {
          sendJson(res, 409, { error: 'nickname_taken' });
          return;
        }
        store.rename(entry, nickname);
      }
      entry.scores = mergeBest(entry.scores, scores);
      entry.updatedAt = now();
      store.markDirty();
      sendJson(res, 200, {
        playerId: entry.playerId,
        nickname: entry.nickname,
        ranks: ranksFor(entry.playerId),
      });
      return;
    }

    // CLAIM
    if (store.findByNickname(nicknameLower)) {
      sendJson(res, 409, { error: 'nickname_taken' });
      return;
    }
    // Hard cap: refuse NEW identities once the store is full (token UPDATEs above
    // are unaffected). Run a GC pass first so TTL-expired slots free up before we
    // reject — a legitimate player should only be turned away when the board is
    // genuinely at capacity, not merely holding stale entries.
    if (store.size >= maxEntries) {
      store.gc();
      if (store.size >= maxEntries) {
        sendJson(res, 503, { error: 'leaderboard_full', retryAfterSec: 3600 }, {
          'Retry-After': '3600',
        });
        return;
      }
    }
    const playerId = crypto.randomUUID();
    const newToken = crypto.randomBytes(16).toString('hex'); // 128-bit, 32 hex chars
    const timestamp = now();
    store.add({
      playerId,
      nickname,
      nicknameLower,
      tokenHash: hashToken(newToken).toString('hex'),
      scores,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    // The token appears in a response exactly ONCE — here.
    sendJson(res, 200, {
      playerId,
      token: newToken,
      nickname,
      ranks: ranksFor(playerId),
    });
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {URL} url
   */
  function handleTop(req, res, url) {
    const limit = limiter.check(`read:${clientIp(req)}`, readPerMin);
    if (!limit.allowed) {
      sendJson(res, 429, { error: 'rate_limited', retryAfterSec: limit.retryAfterSec }, {
        'Retry-After': String(limit.retryAfterSec),
      });
      return;
    }

    const byParam = url.searchParams.get('by') ?? 'lifetimeInspiration';
    if (!METRICS.includes(/** @type {any} */ (byParam))) {
      sendJson(res, 422, { error: 'invalid_payload', field: 'by' });
      return;
    }
    const by = /** @type {typeof METRICS[number]} */ (byParam);

    const limitParam = url.searchParams.get('limit');
    let count = 20;
    if (limitParam !== null) {
      const n = Number(limitParam);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        sendJson(res, 422, { error: 'invalid_payload', field: 'limit' });
        return;
      }
      count = n;
    }

    const playerId = url.searchParams.get('playerId');
    const list = store.sorted(by);
    /** @type {Record<string, unknown>} */
    const body = {
      by,
      total: list.length,
      generatedAt: now(),
      entries: list.slice(0, count).map((e, i) => ({
        rank: i + 1,
        playerId: e.playerId,
        nickname: e.nickname,
        value: e.scores[by],
      })),
    };
    if (playerId !== null) {
      const idx = list.findIndex((e) => e.playerId === playerId);
      body.me = idx === -1 ? null : { rank: idx + 1, value: list[idx].scores[by] };
    }
    sendJson(res, 200, body);
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function handleHealth(req, res) {
    sendJson(res, 200, {
      ok: true,
      entries: store.size,
      uptimeSec: Math.max(0, Math.floor((now() - startedAt) / 1000)),
    });
  }

  const server = http.createServer((req, res) => {
    Promise.resolve()
      .then(() => {
        const url = new URL(req.url ?? '/', 'http://internal');
        switch (url.pathname) {
          case '/api/leaderboard/submit':
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
            return handleSubmit(req, res);
          case '/api/leaderboard/top':
            if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
            return handleTop(req, res, url);
          case '/api/health':
            if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
            return handleHealth(req, res);
          default:
            return sendJson(res, 404, { error: 'not_found' });
        }
      })
      .catch((err) => {
        console.error('[leaderboard] internal error:', err);
        if (!res.headersSent) {
          sendJson(res, 500, { error: 'internal' });
        } else {
          res.end();
        }
      });
  });

  // Debounced persistence: dirty flag + 2s interval; plus flush on close.
  const flushTimer = setInterval(() => store.flush(), FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
  const gcTimer = setInterval(() => {
    store.gc();
  }, GC_INTERVAL_MS);
  gcTimer.unref?.();
  server.on('close', () => {
    clearInterval(flushTimer);
    clearInterval(gcTimer);
    store.flush();
  });

  // Deterministic flush for tests and for the SIGTERM path in server.mjs.
  /** @type {any} */ (server).flushNow = () => store.flush();

  return server;
}
