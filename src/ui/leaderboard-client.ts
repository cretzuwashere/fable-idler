// leaderboard-client.ts — Hall of Fables service layer (10 §2.5, 12 §6).
// The engine stays 100% network-free: this is a tiny standalone mini-store
// (same subscribe pattern as GameStore) created once in main.tsx and consumed
// by HallOfFablesPanel. EVERY failure path is silent — no console output, no
// thrown errors — because the game must stay fully playable with the API
// absent (09 §6.2.6; the E2E console fixture fails on any console error).
//
// Identity (10 §0 A1) lives in meta.settings.leaderboard and travels through
// the save's export/import. This module reads it from the store and writes it
// via { type: 'setSettings' } — a critical action, so the claim is persisted
// immediately (and the nameInLights achievement check fires for free).
//
// Submit triggers (10 §0 A3): claim · every Publish (tomesPublished increase
// observed via store.subscribe) · 90s interval while dirty · visibilitychange
// → hidden (keepalive, fire-and-forget) · manual "Update now". Automatic
// sends are throttled to one per 60s; claim + manual bypass the throttle.

import type { GameStore, LeaderboardIdentity } from '../engine';

export type LeaderboardMetric =
  | 'lifetimeInspiration'
  | 'tomesPublished'
  | 'lifetimeQuillsEarned'
  | 'fastestPublishMs';

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  nickname: string;
  value: number;
}

export interface LeaderboardTop {
  by: LeaderboardMetric;
  total: number;
  generatedAt: number;
  entries: LeaderboardRow[];
  me: { rank: number; value: number } | null;
}

export type ClaimResult = 'ok' | 'taken' | 'invalid' | 'network';

export interface LeaderboardClientState {
  /** disabled = built without an API (VITE_API_URL='off') — permanent local-only. */
  disabled: boolean;
  /** Last board fetched (session or cache). */
  top: LeaderboardTop | null;
  /** epoch ms of the last SUCCESSFUL fetch this session; null → `top` is cache. */
  fetchedAt: number | null;
  /** A GET is in flight. */
  loading: boolean;
  /** A claim POST is in flight. */
  claiming: boolean;
  /** The last network operation failed — "the courier seems lost". */
  unreachable: boolean;
  /** A 401 dropped the identity — "the Hall no longer knows your seal". */
  sealLost: boolean;
}

export interface LeaderboardClient {
  getState(): LeaderboardClientState;
  subscribe(listener: () => void): () => void;
  /** Same whitelist as the server: ^[A-Za-z0-9 _-]{3,20}$, trimmed, ≥1 alphanumeric. */
  isValidNickname(nickname: string): boolean;
  /** Claim a nickname (no token). On success the identity is saved via setSettings. */
  claim(nickname: string): Promise<ClaimResult>;
  /** GET /top — called by the panel ONLY while it is visible (60s cadence). */
  refresh(by: LeaderboardMetric, manual?: boolean): Promise<void>;
  /** Manual "Update now": submit + refresh, bypassing the auto-throttle. */
  submitNow(by: LeaderboardMetric): void;
  dispose(): void;
}

export interface LeaderboardClientDeps {
  apiBase?: string;
  fetchFn?: typeof fetch;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

/** Non-secret board cache (identity does NOT live here — 10 §0 A1). */
const CACHE_KEY = 'fable-idler-leaderboard-cache-v1';

const NICKNAME_RE = /^[A-Za-z0-9 _-]{3,20}$/;
const GET_TIMEOUT_MS = 4_000;
const POST_TIMEOUT_MS = 5_000;
const AUTO_SUBMIT_THROTTLE_MS = 60_000;
const DIRTY_INTERVAL_MS = 90_000;
/** Backoff for background refreshes while unreachable (30s→60s→120s→300s cap). */
const REFRESH_BACKOFF_MS = [30_000, 60_000, 120_000, 300_000];

function resolveApiBase(explicit?: string): string | null {
  const env =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const raw = explicit ?? env.VITE_API_URL ?? '';
  if (raw === 'off') return null; // permanent local-only build
  if (raw === '') return '/api'; // same-origin (compose / Vite proxy)
  return raw.replace(/\/$/, '');
}

export function createLeaderboardClient(
  store: GameStore,
  deps: LeaderboardClientDeps = {},
): LeaderboardClient {
  const apiBase = resolveApiBase(deps.apiBase);
  const fetchFn = deps.fetchFn ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const now = deps.now ?? (() => Date.now());
  const storage: Pick<Storage, 'getItem' | 'setItem'> | null =
    deps.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const disabled = apiBase === null || fetchFn === null;

  let state: LeaderboardClientState = {
    disabled,
    top: readCache(),
    fetchedAt: null,
    loading: false,
    claiming: false,
    unreachable: false,
    sealLost: false,
  };

  const listeners = new Set<() => void>();
  let dirty = false;
  let lastAutoSubmitAt = 0;
  let refreshFailCount = 0;
  let nextRefreshAllowedAt = 0;
  let prevTomes = store.getState().meta.tomesPublished;
  let disposed = false;

  function setState(patch: Partial<LeaderboardClientState>): void {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  }

  function readCache(): LeaderboardTop | null {
    if (!storage) return null;
    try {
      const raw = storage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { entries?: unknown }).entries)
      ) {
        return parsed as LeaderboardTop;
      }
    } catch {
      /* unreadable cache → start empty */
    }
    return null;
  }

  function writeCache(top: LeaderboardTop): void {
    if (!storage) return;
    try {
      storage.setItem(CACHE_KEY, JSON.stringify(top));
    } catch {
      /* quota/security errors are non-fatal */
    }
  }

  function identity(): LeaderboardIdentity | undefined {
    return store.getState().meta.settings.leaderboard;
  }

  function scores(): Record<string, number | null> {
    const s = store.getState();
    return {
      lifetimeInspiration: s.meta.stats.lifetimeInspiration,
      tomesPublished: s.meta.tomesPublished,
      lifetimeQuillsEarned: s.meta.stats.lifetimeQuillsEarned,
      fastestPublishMs: s.meta.stats.fastestPublishMs,
    };
  }

  /** fetch with a hard timeout; resolves null on ANY failure (never throws). */
  async function request(
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response | null> {
    if (disabled || !fetchFn) return null;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      return await fetchFn(`${apiBase}${path}`, {
        ...init,
        signal: controller?.signal,
      });
    } catch {
      return null; // network error / abort — silent by contract
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  function isValidNickname(nickname: string): boolean {
    return (
      nickname === nickname.trim() &&
      NICKNAME_RE.test(nickname) &&
      /[A-Za-z0-9]/.test(nickname)
    );
  }

  async function claim(nickname: string): Promise<ClaimResult> {
    if (disabled) return 'network';
    if (!isValidNickname(nickname)) return 'invalid';
    setState({ claiming: true });
    const res = await request(
      '/leaderboard/submit',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, scores: scores() }),
      },
      POST_TIMEOUT_MS,
    );
    if (!res) {
      setState({ claiming: false, unreachable: true });
      return 'network';
    }
    if (res.status === 409) {
      setState({ claiming: false, unreachable: false });
      return 'taken';
    }
    if (!res.ok) {
      setState({ claiming: false, unreachable: false });
      return res.status === 422 ? 'invalid' : 'network';
    }
    try {
      const body = (await res.json()) as {
        playerId?: string;
        token?: string;
        nickname?: string;
      };
      if (typeof body.playerId !== 'string' || typeof body.token !== 'string') {
        setState({ claiming: false });
        return 'network';
      }
      const t = now();
      store.dispatch({
        type: 'setSettings',
        settings: {
          leaderboard: {
            playerId: body.playerId,
            token: body.token,
            nickname: typeof body.nickname === 'string' ? body.nickname : nickname,
            lastSubmittedAt: t,
          },
        },
      });
      dirty = false;
      lastAutoSubmitAt = t;
      setState({ claiming: false, unreachable: false, sealLost: false });
      return 'ok';
    } catch {
      setState({ claiming: false });
      return 'network';
    }
  }

  /** POST the current scores with the stored token. Silent on every failure. */
  async function submit(opts: { auto: boolean; keepalive?: boolean }): Promise<void> {
    if (disabled) return;
    const id = identity();
    if (!id) return;
    const t = now();
    if (opts.auto && t - lastAutoSubmitAt < AUTO_SUBMIT_THROTTLE_MS) return; // stays dirty
    lastAutoSubmitAt = t;
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: id.nickname, token: id.token, scores: scores() }),
    };
    if (opts.keepalive) {
      // Fire-and-forget on tab hide — no state updates, the page is going away.
      try {
        void fetchFn?.(`${apiBase}/leaderboard/submit`, { ...init, keepalive: true }).catch(
          () => undefined,
        );
      } catch {
        /* silent */
      }
      return;
    }
    const res = await request('/leaderboard/submit', init, POST_TIMEOUT_MS);
    if (disposed) return;
    if (!res) {
      setState({ unreachable: true });
      return; // dirty stays set; a later trigger retries
    }
    if (res.status === 401) {
      // Token invalid (09 §4.3 — silent): drop the identity, back to opt-in.
      dirty = false;
      store.dispatch({ type: 'setSettings', settings: { leaderboard: undefined } });
      setState({ sealLost: true, unreachable: false });
      return;
    }
    if (res.ok || res.status === 409 || res.status === 422) {
      // 409/422 cannot be fixed by resending the same payload — stop retrying.
      dirty = false;
      setState({ unreachable: false });
      return;
    }
    // 429/5xx: keep dirty, next trigger retries (respecting the throttle).
  }

  async function refresh(by: LeaderboardMetric, manual = false): Promise<void> {
    if (disabled || state.loading) return;
    const t = now();
    if (!manual && t < nextRefreshAllowedAt) return; // silent backoff
    setState({ loading: true });
    const id = identity();
    const me = id ? `&playerId=${encodeURIComponent(id.playerId)}` : '';
    const res = await request(
      `/leaderboard/top?by=${by}&limit=20${me}`,
      { method: 'GET' },
      GET_TIMEOUT_MS,
    );
    if (disposed) return;
    if (!res || !res.ok) {
      refreshFailCount = Math.min(refreshFailCount + 1, REFRESH_BACKOFF_MS.length);
      nextRefreshAllowedAt = t + REFRESH_BACKOFF_MS[refreshFailCount - 1];
      setState({ loading: false, unreachable: true });
      return;
    }
    try {
      const body = (await res.json()) as LeaderboardTop;
      if (!Array.isArray(body.entries)) throw new Error('bad shape');
      const top: LeaderboardTop = {
        by,
        total: typeof body.total === 'number' ? body.total : body.entries.length,
        generatedAt: typeof body.generatedAt === 'number' ? body.generatedAt : t,
        entries: body.entries,
        me: body.me && typeof body.me.rank === 'number' ? body.me : null,
      };
      refreshFailCount = 0;
      nextRefreshAllowedAt = 0;
      writeCache(top);
      setState({ loading: false, unreachable: false, top, fetchedAt: t });
    } catch {
      setState({ loading: false, unreachable: true });
    }
  }

  function submitNow(by: LeaderboardMetric): void {
    dirty = true;
    void submit({ auto: false }).then(() => {
      if (!disposed) void refresh(by, true);
    });
  }

  // ---- automatic triggers (none of them run in a disabled build) ----

  let unsubscribeStore: (() => void) | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const onHidden = (): void => {
    if (document.visibilityState === 'hidden' && dirty) {
      void submit({ auto: true, keepalive: true });
      dirty = false;
    }
  };

  if (!disabled) {
    unsubscribeStore = store.subscribe(() => {
      const tomes = store.getState().meta.tomesPublished;
      if (tomes > prevTomes) {
        prevTomes = tomes;
        dirty = true;
        void submit({ auto: true });
      } else {
        prevTomes = tomes;
      }
    });
    intervalId = setInterval(() => {
      if (dirty) void submit({ auto: true });
    }, DIRTY_INTERVAL_MS);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onHidden);
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isValidNickname,
    claim,
    refresh,
    submitNow,
    dispose() {
      disposed = true;
      unsubscribeStore?.();
      if (intervalId !== null) clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onHidden);
      }
    },
  };
}
