// game-loop.test.ts — the imperative shell's time handling (02 §2.2):
// a foreground gap > 60s (laptop sleep with the tab open) must be routed
// through the SAME offline path as the bootstrap load — credited at offline
// efficiency, capped, persisted, surfaced as an 'offline' event — instead of
// being clamp-discarded by tick(). Also: importSave must not re-fire unlock
// events for milestones/achievements that are merely re-hydrated.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGameStore,
  createInitialState,
  createMemoryStorage,
  exportSave,
  loadSave,
  OFFLINE,
  TICK_MS,
} from '../../src/engine';
import type { GameEvent, GameState } from '../../src/engine';
import { makeState } from './helpers';

const HOUR = 3_600_000;

/** 10 inkSprites → exactly 10/s with no other multipliers. */
function tenPerSec(): GameState {
  return makeState((s) => {
    s.run.generators.inkSprite = 10;
  });
}

interface Harness {
  store: ReturnType<typeof createGameStore>;
  storage: ReturnType<typeof createMemoryStorage>;
  events: GameEvent[];
  setNow: (t: number) => void;
}

function startedStore(initial: GameState): Harness {
  let t = 0;
  const storage = createMemoryStorage();
  const store = createGameStore(initial, { now: () => t, storage });
  const events: GameEvent[] = [];
  store.subscribeToEvents((e) => events.push(e));
  store.start();
  return { store, storage, events, setNow: (v) => (t = v) };
}

describe('game loop — foreground gaps > 60s take the offline path', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a 2h sleep gap is credited at offline efficiency, persisted, and emits ONE offline event', () => {
    vi.useFakeTimers();
    const h = startedStore(tenPerSec());

    // The laptop sleeps 2 hours with the tab open; the next interval callback
    // sees dt = 2h and must NOT clamp it down to 60s (that would pay 600 ✨
    // instead of 36,000).
    h.setNow(2 * HOUR);
    vi.advanceTimersByTime(TICK_MS);
    h.store.stop();

    const expected = 10 * (2 * HOUR) * 0.001 * OFFLINE.baseEfficiency; // 36,000
    expect(h.store.getState().run.inspiration).toBeCloseTo(expected, 6);
    expect(h.store.getState().lastTickAt).toBe(2 * HOUR);
    // Long session (≥ 30 min) counted for the Lucid Dreaming unlock.
    expect(h.store.getState().meta.stats.offlineSessionsOver30Min).toBe(1);

    const offline = h.events.filter((e) => e.type === 'offline');
    expect(offline).toHaveLength(1);
    expect(offline[0].type === 'offline' && offline[0].report.elapsedMs).toBe(2 * HOUR);
    expect(offline[0].type === 'offline' && offline[0].report.efficiency).toBe(
      OFFLINE.baseEfficiency,
    );

    // The credited state was persisted immediately (no autosave race that
    // could overwrite a good save with a truncated one).
    const saved = loadSave(h.storage);
    expect(saved).not.toBeNull();
    expect(saved!.state.run.inspiration).toBeCloseTo(expected, 6);
  });

  it('the gap is capped exactly like a closed-tab absence (8h base cap)', () => {
    vi.useFakeTimers();
    const h = startedStore(tenPerSec());

    h.setNow(24 * HOUR);
    vi.advanceTimersByTime(TICK_MS);
    h.store.stop();

    const expected = 10 * 8 * 3_600 * OFFLINE.baseEfficiency; // 144,000
    expect(h.store.getState().run.inspiration).toBeCloseTo(expected, 6);
  });

  it('a normal dt (≤ 60s) still integrates linearly at 100% — no offline event', () => {
    vi.useFakeTimers();
    const h = startedStore(tenPerSec());

    h.setNow(30_000);
    vi.advanceTimersByTime(TICK_MS);
    h.store.stop();

    expect(h.store.getState().run.inspiration).toBeCloseTo(10 * 30, 9); // full rate
    expect(h.events.filter((e) => e.type === 'offline')).toHaveLength(0);
  });
});

describe('game loop — importSave re-hydration is silent', () => {
  it('importing an advanced save emits ZERO milestone/achievement events (no toast flood)', () => {
    const advanced = makeState((s) => {
      s.run.inspiration = 500_000;
      s.run.totalEarned = 500_000;
      s.run.generators.wanderingMuse = 100;
      s.run.generators.inkSprite = 50;
      s.run.milestones = ['theFirstSpark', 'whispersInInk', 'qty:wanderingMuse:25'];
      s.meta.achievements = ['firstWords', 'storytellerAwakens', 'whisperedLegends'];
      s.meta.stats.totalClicks = 2_000;
      s.meta.stats.lifetimeInspiration = 500_000;
    });
    const exported = exportSave(advanced, 100);

    const store = createGameStore(createInitialState(0), {
      now: () => 5_000,
      storage: createMemoryStorage(),
    });
    const events: GameEvent[] = [];
    store.subscribeToEvents((e) => events.push(e));

    store.dispatch({ type: 'importSave', data: exported });

    // The state DID move to the imported (and re-checked) snapshot…
    expect(store.getState().run.totalEarned).toBe(500_000);
    expect(store.getState().meta.achievements.length).toBeGreaterThanOrEqual(3);
    expect(store.getState().run.milestones.length).toBeGreaterThanOrEqual(3);
    // …but none of that produced unlock events: it is a re-hydration.
    expect(events).toHaveLength(0);
  });
});
