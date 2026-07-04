// leaderboard-api.test.ts — REAL HTTP tests for the zero-deps Hall of Fables
// server: createApp() on an ephemeral port (listen(0)), hit with global fetch.
// No Docker involved, no @types/node — the server API is typed via
// server/src/app.d.mts and the tests only use globalThis.fetch + a few
// runtime-only node: imports (transpiled by Vitest, never type-checked by tsc:
// tests/server is deliberately NOT in tsconfig include).
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/src/app.mjs';
import type { LeaderboardServer } from '../../server/src/app.d.mts';
// Runtime-only imports (Vitest runs in node env; no type declarations needed).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- no node types on purpose
import * as fs from 'node:fs';
// @ts-ignore -- no node types on purpose
import * as os from 'node:os';
// @ts-ignore -- no node types on purpose
import * as path from 'node:path';

const T0 = 1_780_000_000_000; // fixed epoch base for the injectable clock

interface TestApp {
  app: LeaderboardServer;
  base: string;
  dataFile: string;
  dir: string;
  /** Advance the injected clock. */
  tick: (ms: number) => void;
}

const running: LeaderboardServer[] = [];
const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'fable-lb-'));
  tmpDirs.push(dir);
  return dir;
}

async function startApp(options?: {
  dataFile?: string;
  rateLimits?: { submitPerMin?: number; readPerMin?: number };
  ttlDays?: number;
  maxEntries?: number;
  startNow?: number;
}): Promise<TestApp> {
  const dir = options?.dataFile ? path.dirname(options.dataFile) : makeTmpDir();
  const dataFile: string = options?.dataFile ?? path.join(dir, 'leaderboard.json');
  let fakeNow = options?.startNow ?? T0;
  const app = createApp({
    dataFile,
    now: () => fakeNow,
    rateLimits: options?.rateLimits,
    ttlDays: options?.ttlDays,
    maxEntries: options?.maxEntries,
  });
  await new Promise<void>((resolve) => {
    app.listen(0, resolve);
  });
  const addr = app.address();
  if (addr === null || typeof addr === 'string') throw new Error('no ephemeral port');
  running.push(app);
  return {
    app,
    base: `http://127.0.0.1:${addr.port}`,
    dataFile,
    dir,
    tick: (ms) => {
      fakeNow += ms;
    },
  };
}

async function stopApp(app: LeaderboardServer): Promise<void> {
  app.closeAllConnections?.();
  await new Promise<void>((resolve) => {
    app.close(() => resolve());
  });
  const i = running.indexOf(app);
  if (i !== -1) running.splice(i, 1);
}

afterEach(async () => {
  while (running.length > 0) {
    await stopApp(running[running.length - 1]);
  }
});

function scores(overrides?: Partial<Record<string, number | null>>) {
  return {
    lifetimeInspiration: 1000,
    tomesPublished: 3,
    lifetimeQuillsEarned: 5,
    fastestPublishMs: null,
    ...overrides,
  };
}

async function submit(base: string, body: unknown): Promise<{ status: number; json: any; res: Response }> {
  const res = await fetch(`${base}/api/leaderboard/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json(), res };
}

async function getTop(base: string, query = ''): Promise<{ status: number; json: any; res: Response }> {
  const res = await fetch(`${base}/api/leaderboard/top${query}`);
  return { status: res.status, json: await res.json(), res };
}

describe('POST /api/leaderboard/submit — claim', () => {
  it('claims a nickname: 200 with playerId, 32-hex token (shown once), nickname, ranks', async () => {
    const { base } = await startApp();
    const { status, json, res } = await submit(base, { nickname: 'Ink Wizard', scores: scores() });
    expect(status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(typeof json.playerId).toBe('string');
    expect(json.token).toMatch(/^[0-9a-f]{32}$/);
    expect(json.nickname).toBe('Ink Wizard');
    expect(json.ranks).toEqual({
      lifetimeInspiration: 1,
      tomesPublished: 1,
      lifetimeQuillsEarned: 1,
      fastestPublishMs: null, // no timed publish yet
    });
  });

  it('rejects a duplicate nickname case-insensitively: 409 nickname_taken', async () => {
    const { base } = await startApp();
    await submit(base, { nickname: 'Ink Wizard', scores: scores() });
    const dup = await submit(base, { nickname: 'ink wizard', scores: scores() });
    expect(dup.status).toBe(409);
    expect(dup.json).toEqual({ error: 'nickname_taken' });
  });

  it('floors tomes/quills server-side', async () => {
    const { base } = await startApp();
    const claim = await submit(base, {
      nickname: 'Floored',
      scores: scores({ tomesPublished: 14.9, lifetimeQuillsEarned: 41.2 }),
    });
    expect(claim.status).toBe(200);
    const tomes = await getTop(base, `?by=tomesPublished&playerId=${claim.json.playerId}`);
    expect(tomes.json.me).toEqual({ rank: 1, value: 14 });
    const quills = await getTop(base, `?by=lifetimeQuillsEarned&playerId=${claim.json.playerId}`);
    expect(quills.json.me).toEqual({ rank: 1, value: 41 });
  });
});

describe('POST /api/leaderboard/submit — entry cap (DoS ceiling)', () => {
  it('refuses NEW claims past maxEntries with 503 leaderboard_full + Retry-After', async () => {
    const { base } = await startApp({ maxEntries: 2, rateLimits: { submitPerMin: 100 } });
    expect((await submit(base, { nickname: 'One', scores: scores() })).status).toBe(200);
    expect((await submit(base, { nickname: 'Two', scores: scores() })).status).toBe(200);
    const third = await submit(base, { nickname: 'Three', scores: scores() });
    expect(third.status).toBe(503);
    expect(third.json.error).toBe('leaderboard_full');
    expect(third.res.headers.get('retry-after')).toBe('3600');
  });

  it('existing players can still UPDATE (token) even when the store is full', async () => {
    const { base } = await startApp({ maxEntries: 1, rateLimits: { submitPerMin: 100 } });
    const claim = await submit(base, { nickname: 'Solo', scores: scores() });
    expect(claim.status).toBe(200);
    // Store is full for NEW claims…
    expect((await submit(base, { nickname: 'Nope', scores: scores() })).status).toBe(503);
    // …but the existing player's token update goes through.
    const upd = await submit(base, {
      nickname: 'Solo',
      token: claim.json.token,
      scores: scores({ lifetimeInspiration: 9999 }),
    });
    expect(upd.status).toBe(200);
  });

  it('a TTL-GC pass frees a slot before rejecting (stale entries do not permanently block)', async () => {
    const { base, tick } = await startApp({
      maxEntries: 1,
      ttlDays: 90,
      rateLimits: { submitPerMin: 100 },
    });
    expect((await submit(base, { nickname: 'Old', scores: scores() })).status).toBe(200);
    // Full: a new claim is rejected while 'Old' is fresh.
    expect((await submit(base, { nickname: 'FreshOne', scores: scores() })).status).toBe(503);
    // Age 'Old' past the TTL → the claim path's GC pass evicts it, freeing a slot.
    tick(91 * 86_400_000);
    expect((await submit(base, { nickname: 'FreshTwo', scores: scores() })).status).toBe(200);
  });
});

describe('POST /api/leaderboard/submit — update with token', () => {
  it('updates with the correct token: 200 WITHOUT token in the response', async () => {
    const { base } = await startApp();
    const claim = await submit(base, { nickname: 'Ink Wizard', scores: scores() });
    const upd = await submit(base, {
      nickname: 'Ink Wizard',
      token: claim.json.token,
      scores: scores({ lifetimeInspiration: 2000 }),
    });
    expect(upd.status).toBe(200);
    expect('token' in upd.json).toBe(false);
    expect(upd.json.playerId).toBe(claim.json.playerId);
    expect(upd.json.ranks.lifetimeInspiration).toBe(1);
  });

  it('rejects a wrong token with 401 and does NOT modify the entry', async () => {
    const { base } = await startApp();
    const claim = await submit(base, { nickname: 'Ink Wizard', scores: scores() });
    const bad = await submit(base, {
      nickname: 'Ink Wizard',
      token: 'f'.repeat(32),
      scores: scores({ lifetimeInspiration: 999_999 }),
    });
    expect(bad.status).toBe(401);
    expect(bad.json).toEqual({ error: 'invalid_token' });
    const top = await getTop(base, `?by=lifetimeInspiration&playerId=${claim.json.playerId}`);
    expect(top.json.me.value).toBe(1000); // unchanged
  });

  it('renames with a valid token onto a free nickname (200) and onto a taken one (409, case-insensitive)', async () => {
    const { base } = await startApp();
    const a = await submit(base, { nickname: 'Alpha', scores: scores() });
    await submit(base, { nickname: 'Beta', scores: scores() });

    const renamed = await submit(base, { nickname: 'Gamma', token: a.json.token, scores: scores() });
    expect(renamed.status).toBe(200);
    expect(renamed.json.nickname).toBe('Gamma');
    const top = await getTop(base, '?by=lifetimeInspiration&limit=10');
    const nicknames = top.json.entries.map((e: any) => e.nickname);
    expect(nicknames).toContain('Gamma');
    expect(nicknames).not.toContain('Alpha');

    const conflict = await submit(base, { nickname: 'beta', token: a.json.token, scores: scores() });
    expect(conflict.status).toBe(409);
    expect(conflict.json).toEqual({ error: 'nickname_taken' });
    // rename to a different casing of one's OWN nickname is allowed
    const recase = await submit(base, { nickname: 'GAMMA', token: a.json.token, scores: scores() });
    expect(recase.status).toBe(200);
    expect(recase.json.nickname).toBe('GAMMA');
  });
});

describe('POST /api/leaderboard/submit — 422 invalid_payload', () => {
  it('rejects each class of invalid payload with the offending field', async () => {
    const { base } = await startApp();
    const cases: Array<{ body: unknown; field: string }> = [
      { body: { nickname: 'ab', scores: scores() }, field: 'nickname' }, // too short
      { body: { nickname: ' padded ', scores: scores() }, field: 'nickname' }, // not trim-equal
      { body: { nickname: 'Ink<Wizard>', scores: scores() }, field: 'nickname' }, // outside whitelist
      { body: { nickname: '- _-', scores: scores() }, field: 'nickname' }, // no alphanumeric
      { body: { nickname: 'Valid Name', scores: scores({ lifetimeInspiration: -1 }) }, field: 'lifetimeInspiration' },
      { body: { nickname: 'Valid Name', scores: scores({ tomesPublished: 1e301 }) }, field: 'tomesPublished' },
      { body: { nickname: 'Valid Name', scores: scores({ lifetimeQuillsEarned: 'NaN' as unknown as number }) }, field: 'lifetimeQuillsEarned' },
      { body: { nickname: 'Valid Name', scores: scores({ fastestPublishMs: 0 }) }, field: 'fastestPublishMs' }, // must be >= 1 or null
      { body: { nickname: 'Valid Name' }, field: 'scores' }, // missing scores
      { body: { nickname: 'Valid Name', token: 123, scores: scores() }, field: 'token' }, // wrong type
    ];
    for (const c of cases) {
      const r = await submit(base, c.body);
      expect(r.status, `field ${c.field}`).toBe(422);
      expect(r.json).toEqual({ error: 'invalid_payload', field: c.field });
    }
  });

  it('rejects NaN encoded as raw JSON (parse error) and bodies over 4KB', async () => {
    const { base } = await startApp();
    const badJson = await submit(base, '{"nickname":"Valid Name","scores":{"lifetimeInspiration":NaN}}');
    expect(badJson.status).toBe(422);
    expect(badJson.json).toEqual({ error: 'invalid_payload', field: 'body' });

    const big = await submit(base, {
      nickname: 'Valid Name',
      scores: scores(),
      padding: 'x'.repeat(5000),
    });
    expect(big.status).toBe(422);
    expect(big.json).toEqual({ error: 'invalid_payload', field: 'body' });
  });
});

describe('best-keeping (server keeps BEST per metric)', () => {
  it('a lower score does NOT overwrite; a higher fastestPublishMs does NOT overwrite; null keeps stored', async () => {
    const { base } = await startApp();
    const claim = await submit(base, {
      nickname: 'Keeper',
      scores: scores({ lifetimeInspiration: 1000, tomesPublished: 5, lifetimeQuillsEarned: 10, fastestPublishMs: 60_000 }),
    });
    const worse = await submit(base, {
      nickname: 'Keeper',
      token: claim.json.token,
      scores: scores({ lifetimeInspiration: 500, tomesPublished: 3, lifetimeQuillsEarned: 4, fastestPublishMs: 90_000 }),
    });
    expect(worse.status).toBe(200);
    const id = claim.json.playerId;
    expect((await getTop(base, `?by=lifetimeInspiration&playerId=${id}`)).json.me.value).toBe(1000);
    expect((await getTop(base, `?by=tomesPublished&playerId=${id}`)).json.me.value).toBe(5);
    expect((await getTop(base, `?by=lifetimeQuillsEarned&playerId=${id}`)).json.me.value).toBe(10);
    expect((await getTop(base, `?by=fastestPublishMs&playerId=${id}`)).json.me.value).toBe(60_000);

    // a genuinely better fastest DOES improve; a later null does not erase it
    await submit(base, { nickname: 'Keeper', token: claim.json.token, scores: scores({ fastestPublishMs: 30_000 }) });
    expect((await getTop(base, `?by=fastestPublishMs&playerId=${id}`)).json.me.value).toBe(30_000);
    await submit(base, { nickname: 'Keeper', token: claim.json.token, scores: scores({ fastestPublishMs: null }) });
    expect((await getTop(base, `?by=fastestPublishMs&playerId=${id}`)).json.me.value).toBe(30_000);
  });
});

describe('GET /api/leaderboard/top — sorting, tie-breaks, me', () => {
  it('sorts DESC on the three monotone metrics and ASC on fastestPublishMs with nulls excluded', async () => {
    const { base, tick } = await startApp();
    const alice = await submit(base, {
      nickname: 'Alice',
      scores: scores({ lifetimeInspiration: 100, tomesPublished: 9, lifetimeQuillsEarned: 1, fastestPublishMs: 5000 }),
    });
    tick(1000);
    await submit(base, {
      nickname: 'Bob',
      scores: scores({ lifetimeInspiration: 300, tomesPublished: 7, lifetimeQuillsEarned: 2, fastestPublishMs: null }),
    });
    tick(1000);
    await submit(base, {
      nickname: 'Carol',
      scores: scores({ lifetimeInspiration: 200, tomesPublished: 8, lifetimeQuillsEarned: 3, fastestPublishMs: 3000 }),
    });

    const insp = await getTop(base, '?by=lifetimeInspiration');
    expect(insp.json.entries.map((e: any) => e.nickname)).toEqual(['Bob', 'Carol', 'Alice']);
    expect(insp.json.entries.map((e: any) => e.rank)).toEqual([1, 2, 3]);
    expect(insp.json.total).toBe(3);
    expect(insp.json.by).toBe('lifetimeInspiration');
    expect(typeof insp.json.generatedAt).toBe('number');

    const tomes = await getTop(base, '?by=tomesPublished');
    expect(tomes.json.entries.map((e: any) => e.nickname)).toEqual(['Alice', 'Carol', 'Bob']);

    const fastest = await getTop(base, '?by=fastestPublishMs');
    expect(fastest.json.entries.map((e: any) => e.nickname)).toEqual(['Carol', 'Alice']); // ASC, Bob (null) excluded
    expect(fastest.json.total).toBe(2);

    // me for a player absent from that leaderboard (null fastest) -> null
    const bobId = (await getTop(base, '?by=lifetimeInspiration')).json.entries[0].playerId;
    const meNull = await getTop(base, `?by=fastestPublishMs&playerId=${bobId}`);
    expect(meNull.json.me).toBeNull();
    // me omitted entirely when playerId is not requested
    expect('me' in fastest.json).toBe(false);
    // me present with rank+value when requested
    const meAlice = await getTop(base, `?by=lifetimeInspiration&playerId=${alice.json.playerId}`);
    expect(meAlice.json.me).toEqual({ rank: 3, value: 100 });
  });

  it('tie-breaks deterministically: older updatedAt first, then playerId lexicographic', async () => {
    const { base, tick } = await startApp();
    // same value, different updatedAt -> older first
    const first = await submit(base, { nickname: 'Older', scores: scores({ lifetimeInspiration: 777 }) });
    tick(5000);
    const second = await submit(base, { nickname: 'Newer', scores: scores({ lifetimeInspiration: 777 }) });
    const byTime = await getTop(base, '?by=lifetimeInspiration');
    expect(byTime.json.entries.map((e: any) => e.nickname)).toEqual(['Older', 'Newer']);

    // same value AND same updatedAt -> playerId lexicographic
    const twinA = await submit(base, { nickname: 'Twin A', scores: scores({ lifetimeInspiration: 42 }) });
    const twinB = await submit(base, { nickname: 'Twin B', scores: scores({ lifetimeInspiration: 42 }) });
    const twins = await getTop(base, '?by=lifetimeInspiration&limit=10');
    const twinRows = twins.json.entries.filter((e: any) => e.value === 42);
    const expected = [twinA.json.playerId, twinB.json.playerId].sort();
    expect(twinRows.map((e: any) => e.playerId)).toEqual(expected);
    void first;
    void second;
  });

  it('respects limit and validates by/limit with 422', async () => {
    const { base, tick } = await startApp();
    for (let i = 0; i < 5; i += 1) {
      await submit(base, { nickname: `Writer ${i}`, scores: scores({ lifetimeInspiration: i * 100 }) });
      tick(100);
    }
    const limited = await getTop(base, '?by=lifetimeInspiration&limit=2');
    expect(limited.json.entries).toHaveLength(2);
    expect(limited.json.total).toBe(5);
    // default by = lifetimeInspiration, default limit = 20
    const dflt = await getTop(base);
    expect(dflt.json.by).toBe('lifetimeInspiration');
    expect(dflt.json.entries).toHaveLength(5);

    expect((await getTop(base, '?by=bogus')).status).toBe(422);
    expect((await getTop(base, '?by=bogus')).json).toEqual({ error: 'invalid_payload', field: 'by' });
    expect((await getTop(base, '?limit=0')).status).toBe(422);
    expect((await getTop(base, '?limit=101')).status).toBe(422);
    expect((await getTop(base, '?limit=abc')).json).toEqual({ error: 'invalid_payload', field: 'limit' });
  });
});

describe('rate limiting (fixed window per IP, injected clock)', () => {
  it('returns 429 + Retry-After after 10 submits/min and recovers after the window', async () => {
    const { base, tick } = await startApp();
    const claim = await submit(base, { nickname: 'Speedy', scores: scores() });
    expect(claim.status).toBe(200);
    for (let i = 0; i < 9; i += 1) {
      const r = await submit(base, { nickname: 'Speedy', token: claim.json.token, scores: scores() });
      expect(r.status).toBe(200);
    }
    // 11th request in the same 60s window
    const blocked = await submit(base, { nickname: 'Speedy', token: claim.json.token, scores: scores() });
    expect(blocked.status).toBe(429);
    expect(blocked.json.error).toBe('rate_limited');
    expect(blocked.json.retryAfterSec).toBeGreaterThan(0);
    expect(Number(blocked.res.headers.get('retry-after'))).toBe(blocked.json.retryAfterSec);

    tick(61_000); // window expired
    const again = await submit(base, { nickname: 'Speedy', token: claim.json.token, scores: scores() });
    expect(again.status).toBe(200);
  });

  it('health is never rate limited', async () => {
    const { base } = await startApp({ rateLimits: { submitPerMin: 1, readPerMin: 1 } });
    for (let i = 0; i < 5; i += 1) {
      const res = await fetch(`${base}/api/health`);
      expect(res.status).toBe(200);
    }
  });
});

describe('GET /api/health + unknown routes', () => {
  it('reports ok, entry count and uptime', async () => {
    const { base, tick } = await startApp();
    await submit(base, { nickname: 'Solo', scores: scores() });
    tick(3_600_000);
    const res = await fetch(`${base}/api/health`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, entries: 1, uptimeSec: 3600 });
  });

  it('404 on unknown routes, 405 on wrong methods', async () => {
    const { base } = await startApp();
    const notFound = await fetch(`${base}/api/nope`);
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: 'not_found' });
    const wrongMethod = await fetch(`${base}/api/leaderboard/submit`);
    expect(wrongMethod.status).toBe(405);
    expect(await wrongMethod.json()).toEqual({ error: 'method_not_allowed' });
  });
});

describe('persistence', () => {
  it('round-trips: flush to disk, recreate the app on the same file, data and token survive', async () => {
    const first = await startApp();
    const claim = await submit(first.base, {
      nickname: 'Persistent One',
      scores: scores({ lifetimeInspiration: 12_345, fastestPublishMs: 84_300 }),
    });
    expect(claim.status).toBe(200);
    first.app.flushNow();
    expect(fs.existsSync(first.dataFile)).toBe(true);
    await stopApp(first.app);

    const second = await startApp({ dataFile: first.dataFile });
    const health = await (await fetch(`${second.base}/api/health`)).json();
    expect(health.entries).toBe(1);
    const top = await getTop(second.base, `?by=lifetimeInspiration&playerId=${claim.json.playerId}`);
    expect(top.json.entries[0].nickname).toBe('Persistent One');
    expect(top.json.me).toEqual({ rank: 1, value: 12_345 });
    // the token from the first process still authenticates in the second
    const upd = await submit(second.base, {
      nickname: 'Persistent One',
      token: claim.json.token,
      scores: scores({ lifetimeInspiration: 99_999 }),
    });
    expect(upd.status).toBe(200);
    // and the nickname stays reserved (case-insensitive) across restarts
    const dup = await submit(second.base, { nickname: 'PERSISTENT ONE', scores: scores() });
    expect(dup.status).toBe(409);
  });

  it('flushes on server close as well (no explicit flushNow)', async () => {
    const first = await startApp();
    await submit(first.base, { nickname: 'Close Flush', scores: scores() });
    await stopApp(first.app); // close handler flushes
    expect(fs.existsSync(first.dataFile)).toBe(true);
    const second = await startApp({ dataFile: first.dataFile });
    const health = await (await fetch(`${second.base}/api/health`)).json();
    expect(health.entries).toBe(1);
  });

  it('a corrupt data file at boot is backed up and the server starts EMPTY without crashing', async () => {
    const dir = makeTmpDir();
    const dataFile: string = path.join(dir, 'leaderboard.json');
    fs.writeFileSync(dataFile, 'this is {{{ not json');
    const { base } = await startApp({ dataFile });
    const health = await (await fetch(`${base}/api/health`)).json();
    expect(health).toMatchObject({ ok: true, entries: 0 });
    const backups: string[] = fs
      .readdirSync(dir)
      .filter((f: string) => f.startsWith('leaderboard.json.corrupt-'));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, backups[0]), 'utf8')).toBe('this is {{{ not json');
    // and the fresh (empty) server accepts new claims
    const claim = await submit(base, { nickname: 'Phoenix', scores: scores() });
    expect(claim.status).toBe(200);
  });

  it('rejects an entry whose tokenHash is not a 64-hex SHA-256 digest (load-time hygiene)', async () => {
    const dir = makeTmpDir();
    const dataFile: string = path.join(dir, 'leaderboard.json');
    // A structurally-valid entry but with a non-hex tokenHash: the loader must
    // treat the file as corrupt (back it up, start empty) rather than admit it.
    fs.writeFileSync(
      dataFile,
      JSON.stringify({
        version: 1,
        entries: [
          {
            playerId: 'p1',
            nickname: 'Tampered',
            nicknameLower: 'tampered',
            tokenHash: 'not-a-hex-digest',
            scores: { lifetimeInspiration: 1, tomesPublished: 0, lifetimeQuillsEarned: 0, fastestPublishMs: null },
            createdAt: T0,
            updatedAt: T0,
          },
        ],
      }),
    );
    const { base } = await startApp({ dataFile });
    const health = await (await fetch(`${base}/api/health`)).json();
    expect(health.entries).toBe(0);
    const backups: string[] = fs
      .readdirSync(dir)
      .filter((f: string) => f.startsWith('leaderboard.json.corrupt-'));
    expect(backups).toHaveLength(1);
    // The nickname is free again (the tampered entry never loaded).
    expect((await submit(base, { nickname: 'Tampered', scores: scores() })).status).toBe(200);
  });
});
