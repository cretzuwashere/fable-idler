// game-loop.ts — the ONLY imperative shell around the pure engine core.
// createGameStore(): getState / dispatch / subscribe / start / stop / save
// - setInterval(TICK_MS=100) with REAL delta time; gaps > 60s (laptop sleep
//   with the tab open) are routed through the SAME offline path as bootstrap
//   (02 §2.2 — one code path for "lost time") and surfaced as an 'offline' event.
// - autosave every AUTOSAVE_TICKS (~10s) + immediately after critical actions
// - deps.now / deps.storage injectable → fully testable without DOM or timers.
// Also emits consumable unlock events (milestones/achievements) for UI toasts.

import { AUTOSAVE_TICKS, MAX_TICK_DT_MS, TICK_MS } from './config';
import { checkAchievements } from './achievements';
import { activateBuff } from './buff';
import { buyGenerator } from './generators';
import { checkMilestones } from './milestones';
import { applyOfflineReport, computeOfflineReport } from './offline';
import type { OfflineReport } from './offline';
import { publishTheTome } from './prestige';
import { importSaveString, loadSave, persistSave, SAVE_KEY } from './save';
import type { StorageLike } from './save';
import { clickPower } from './selectors';
import { createInitialState } from './state';
import { tick } from './tick';
import { buyUpgrade } from './upgrades';
import type { Action, AchievementId, GameState } from './types';

export type { StorageLike };

export type GameEvent =
  | { type: 'milestone'; id: string }
  | { type: 'achievement'; id: AchievementId }
  /** A foreground time gap > 60s was credited through the offline path. */
  | { type: 'offline'; report: OfflineReport };

export interface GameStore {
  /** Referentially stable snapshot between notifications. */
  getState(): GameState;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
  /** Consumable unlock events (for toasts) — fired once per newly unlocked id. */
  subscribeToEvents(listener: (event: GameEvent) => void): () => void;
  /** Starts the 100ms interval loop. Idempotent. */
  start(): void;
  stop(): void;
  /** Force-persist right now (also used by the E2E test hook). */
  save(): void;
}

export interface GameStoreDeps {
  now?: () => number;
  storage?: StorageLike;
}

/** In-memory fallback so the engine also runs where localStorage is absent (tests, SSR). */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function defaultStorage(): StorageLike {
  const g = globalThis as { localStorage?: StorageLike };
  return g.localStorage ?? createMemoryStorage();
}

/** Pure reducer: applies one action, then re-checks milestones + achievements. */
export function applyAction(state: GameState, action: Action, now: number): GameState {
  let next: GameState;
  switch (action.type) {
    case 'click': {
      const value = clickPower(state, now);
      next = {
        ...state,
        run: {
          ...state.run,
          inspiration: state.run.inspiration + value,
          totalEarned: state.run.totalEarned + value,
        },
        meta: {
          ...state.meta,
          stats: {
            ...state.meta.stats,
            totalClicks: state.meta.stats.totalClicks + 1,
            lifetimeInspiration: state.meta.stats.lifetimeInspiration + value,
          },
        },
      };
      break;
    }
    case 'buyGenerator':
      next = buyGenerator(state, action.id, action.qty);
      break;
    case 'buyUpgrade':
      next = buyUpgrade(state, action.id);
      break;
    case 'activateBuff':
      next = activateBuff(state, now);
      break;
    case 'prestige':
      next = publishTheTome(state, now);
      break;
    case 'importSave': {
      const imported = importSaveString(action.data);
      // Invalid import → no-op; the UI validates separately via importSaveString.
      next = imported ? { ...imported.state, lastTickAt: now } : state;
      break;
    }
    case 'hardReset':
      // Defense in depth: the type demands `confirm: true`, but a runtime
      // caller (E2E hook, console) may dispatch anything — verify it really
      // is `true` before destroying meta state (quills included).
      next = action.confirm === true ? createInitialState(now) : state;
      break;
    case 'setSettings':
      next = {
        ...state,
        meta: {
          ...state.meta,
          settings: { ...state.meta.settings, ...action.settings },
        },
      };
      break;
    case 'debugAddInspiration': {
      const amount = Number.isFinite(action.amount) ? Math.max(0, action.amount) : 0;
      next =
        amount === 0
          ? state
          : {
              ...state,
              run: {
                ...state.run,
                inspiration: state.run.inspiration + amount,
                totalEarned: state.run.totalEarned + amount,
              },
              meta: {
                ...state.meta,
                stats: {
                  ...state.meta.stats,
                  lifetimeInspiration: state.meta.stats.lifetimeInspiration + amount,
                },
              },
            };
      break;
    }
    case 'debugFastForward': {
      // Simulate the interval [now - ms, now] in tick-legal chunks (<= 60s each),
      // so the result is exactly what real ticks would have produced.
      const total = Number.isFinite(action.ms) ? Math.max(0, action.ms) : 0;
      let simulated = state;
      let t = now - total;
      let remaining = total;
      while (remaining > 0) {
        const step = Math.min(remaining, MAX_TICK_DT_MS);
        t += step;
        simulated = tick(simulated, t, step);
        remaining -= step;
      }
      next = simulated;
      break;
    }
  }
  if (action.type !== 'hardReset') {
    next = checkMilestones(next);
    next = checkAchievements(next, now);
  }
  return next;
}

/** Actions after which we persist immediately (02 §5).
 *  hardReset is NOT here: it deletes the key and leaves storage empty. */
function isCriticalAction(action: Action): boolean {
  return (
    action.type === 'buyUpgrade' ||
    action.type === 'prestige' ||
    action.type === 'importSave' ||
    action.type === 'setSettings'
  );
}

function diffEvents(prev: GameState, next: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (next.run.milestones !== prev.run.milestones) {
    const seen = new Set(prev.run.milestones);
    for (const id of next.run.milestones) {
      if (!seen.has(id)) events.push({ type: 'milestone', id });
    }
  }
  if (next.meta.achievements !== prev.meta.achievements) {
    const seen = new Set(prev.meta.achievements);
    for (const id of next.meta.achievements) {
      if (!seen.has(id)) events.push({ type: 'achievement', id });
    }
  }
  return events;
}

export function createGameStore(initial: GameState, deps?: GameStoreDeps): GameStore {
  const now = deps?.now ?? (() => Date.now());
  const storage = deps?.storage ?? defaultStorage();

  let state = initial;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let ticksSinceSave = 0;
  const listeners = new Set<() => void>();
  const eventListeners = new Set<(event: GameEvent) => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function emit(events: GameEvent[]): void {
    if (events.length === 0) return;
    for (const event of events) {
      for (const listener of eventListeners) listener(event);
    }
  }

  function setState(next: GameState, silent = false): void {
    if (next === state) return;
    // silent: importSave replaces the whole state — re-earned milestones and
    // achievements are a re-hydration, not fresh unlocks (no toast flood).
    const events = silent ? [] : diffEvents(state, next);
    state = next;
    emit(events);
    notify();
  }

  function save(): void {
    persistSave(storage, state, now());
    ticksSinceSave = 0;
  }

  return {
    getState: () => state,

    dispatch(action: Action): void {
      const t = now();
      if (action.type === 'hardReset' && action.confirm === true) {
        try {
          storage.removeItem(SAVE_KEY);
        } catch {
          // storage unavailable — the in-memory reset still proceeds
        }
      }
      setState(applyAction(state, action, t), action.type === 'importSave');
      if (isCriticalAction(action)) save();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    subscribeToEvents(listener: (event: GameEvent) => void): () => void {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },

    start(): void {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        const t = now();
        const gap = t - state.lastTickAt;
        if (gap > MAX_TICK_DT_MS) {
          // Laptop sleep / suspended tab with the page open (02 §2.2): the
          // whole gap goes through the SAME offline path as the bootstrap
          // load — credited at offline efficiency, capped, persisted — and
          // the UI is told so it can show "While you were away".
          const report = computeOfflineReport(state, state.lastTickAt, t);
          setState(applyOfflineReport(state, report, t));
          for (const listener of eventListeners) listener({ type: 'offline', report });
          save();
          return;
        }
        setState(tick(state, t, gap));
        if (++ticksSinceSave >= AUTOSAVE_TICKS) save();
      }, TICK_MS);
    },

    stop(): void {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    save,
  };
}

export { loadSave };
