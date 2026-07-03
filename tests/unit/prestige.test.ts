// prestige.test.ts — quill formula breakpoints + the exact reset/persist split
// from 01 §7 / 03 §6, verified field by field.
// Agent 6 additions: boundary publishes, per-run (not lifetime) quill gain,
// production/click scaling with quills, store-level save→prestige→load
// round-trip, Quill Resonance persistence, crafted-save integrity.
import { describe, expect, it } from 'vitest';
import {
  buyUpgrade,
  canPrestige,
  checkAchievements,
  checkMilestones,
  clickPower,
  createGameStore,
  createInitialRunState,
  createMemoryStorage,
  loadSave,
  parseSave,
  perSecond,
  prestigePreview,
  publishTheTome,
  quillsForTotalEarned,
  serializeState,
} from '../../src/engine';
import { makeState } from './helpers';

describe('quillsForTotalEarned = floor(sqrt(totalEarned / 1e5))', () => {
  it('matches the 03 §6 breakpoints exactly', () => {
    expect(quillsForTotalEarned(0)).toBe(0);
    expect(quillsForTotalEarned(99_999)).toBe(0);
    expect(quillsForTotalEarned(100_000)).toBe(1);
    expect(quillsForTotalEarned(399_999)).toBe(1);
    expect(quillsForTotalEarned(400_000)).toBe(2);
    expect(quillsForTotalEarned(899_999)).toBe(2);
    expect(quillsForTotalEarned(900_000)).toBe(3);
    expect(quillsForTotalEarned(1_600_000)).toBe(4);
    expect(quillsForTotalEarned(2_500_000)).toBe(5);
    expect(quillsForTotalEarned(10_000_000)).toBe(10);
    expect(quillsForTotalEarned(1e9)).toBe(100);
  });

  it('is defensive about negatives', () => {
    expect(quillsForTotalEarned(-5)).toBe(0);
  });
});

describe('canPrestige', () => {
  it('activates exactly at 100,000 run totalEarned', () => {
    expect(canPrestige(makeState((s) => void (s.run.totalEarned = 99_999)))).toBe(false);
    expect(canPrestige(makeState((s) => void (s.run.totalEarned = 100_000)))).toBe(true);
  });

  it('below the threshold publishTheTome is a no-op (same reference)', () => {
    const s = makeState((x) => void (x.run.totalEarned = 99_999));
    expect(publishTheTome(s, 0)).toBe(s);
  });
});

describe('publishTheTome — reset vs. persist, field by field', () => {
  const richState = () =>
    makeState((s) => {
      // run — everything here must reset
      s.run.inspiration = 123_456;
      s.run.totalEarned = 450_000; // → floor(sqrt(4.5)) = 2 quills
      s.run.generators.wanderingMuse = 50;
      s.run.generators.inkSprite = 30;
      s.run.generators.talkingRaven = 12;
      s.run.upgrades.sharpenedNib = true;
      s.run.upgrades.goldenInkwell = true;
      s.run.upgrades.lucidDreaming = true;
      s.run.milestones = ['theFirstSpark', 'craftsmansTools', 'qty:wanderingMuse:25'];
      s.run.buff = { activeUntil: 5_000, cooldownUntil: 80_000 };
      // meta — everything here must persist
      s.meta.goldenQuills = 3;
      s.meta.tomesPublished = 1;
      s.meta.achievements = ['firstWords', 'publishedAuthor'];
      s.meta.quillResonance = true;
      s.meta.stats = {
        totalClicks: 2_345,
        lifetimeInspiration: 1_234_567,
        buffActivations: 19,
        offlineSessionsOver30Min: 2,
        bestSingleOfflineGain: 55_000,
      };
      s.meta.settings = { buyQty: 'max', reduceMotion: true };
    });

  it('prestigePreview shows the exact quills to be earned', () => {
    expect(prestigePreview(richState())).toBe(2);
  });

  it('resets the entire run state to a fresh run', () => {
    const after = publishTheTome(richState(), 777);
    expect(after.run).toEqual(createInitialRunState());
    expect(after.run.buff).toEqual({ activeUntil: 0, cooldownUntil: 0 });
    expect(after.lastTickAt).toBe(777);
  });

  it('adds the earned quills to the existing balance and counts the tome', () => {
    const after = publishTheTome(richState(), 0);
    expect(after.meta.goldenQuills).toBe(5); // 3 + 2
    expect(after.meta.tomesPublished).toBe(2);
  });

  it('leaves achievements, quillResonance, stats and settings untouched', () => {
    const before = richState();
    const after = publishTheTome(before, 0);
    expect(after.meta.achievements).toEqual(before.meta.achievements);
    expect(after.meta.quillResonance).toBe(true);
    expect(after.meta.stats).toEqual(before.meta.stats);
    expect(after.meta.settings).toEqual(before.meta.settings);
  });

  it('two consecutive runs keep accumulating quills', () => {
    const first = publishTheTome(richState(), 0);
    const secondRun = {
      ...first,
      run: { ...first.run, totalEarned: 900_000 },
    };
    const second = publishTheTome(secondRun, 0);
    expect(second.meta.goldenQuills).toBe(8); // 5 + 3
    expect(second.meta.tomesPublished).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Agent 6 — adversarial hardening
// ---------------------------------------------------------------------------

describe('publish boundaries (exact thresholds through publishTheTome)', () => {
  it('publishing at exactly 100,000 grants exactly 1 quill', () => {
    const after = publishTheTome(
      makeState((s) => void (s.run.totalEarned = 100_000)),
      0,
    );
    expect(after.meta.goldenQuills).toBe(1);
    expect(after.meta.tomesPublished).toBe(1);
    expect(after.run.totalEarned).toBe(0);
  });

  it('publishing at 900,000 grants exactly 3 quills', () => {
    const after = publishTheTome(
      makeState((s) => void (s.run.totalEarned = 900_000)),
      0,
    );
    expect(after.meta.goldenQuills).toBe(3);
  });

  it('a dispatched prestige below the threshold leaves the state reference untouched', () => {
    // Normalize pending milestone/achievement unlocks first, so the ONLY
    // possible change left is the prestige itself.
    let initial = makeState((s) => {
      s.run.totalEarned = 99_999;
      s.run.inspiration = 99_999;
    });
    initial = checkAchievements(checkMilestones(initial), 0);
    const store = createGameStore(initial, { now: () => 0, storage: createMemoryStorage() });
    const before = store.getState();
    store.dispatch({ type: 'prestige' });
    expect(store.getState()).toBe(before);
    expect(store.getState().meta.goldenQuills).toBe(0);
    expect(store.getState().meta.tomesPublished).toBe(0);
    expect(store.getState().run.inspiration).toBe(99_999);
  });
});

describe('quill gain uses the CURRENT run totalEarned, never lifetime', () => {
  it('run 1: 450k (+2) then run 2: 100k (+1) → 3 quills, not the lifetime-550k answer (4)', () => {
    // Wrong implementation on lifetime would give floor(sqrt(5.5)) = 2 on the
    // second publish → 4 total. Correct per-run gain is 1 → 3 total.
    let s = makeState((x) => {
      x.run.totalEarned = 450_000;
      x.meta.stats.lifetimeInspiration = 450_000;
    });
    s = publishTheTome(s, 0);
    expect(s.meta.goldenQuills).toBe(2);
    expect(s.run.totalEarned).toBe(0); // the run counter itself resets
    s = {
      ...s,
      run: { ...s.run, totalEarned: 100_000 },
      meta: {
        ...s.meta,
        stats: { ...s.meta.stats, lifetimeInspiration: 550_000 },
      },
    };
    s = publishTheTome(s, 0);
    expect(s.meta.goldenQuills).toBe(3);
    expect(s.meta.tomesPublished).toBe(2);
    expect(s.meta.stats.lifetimeInspiration).toBe(550_000); // lifetime stat untouched
  });
});

describe('quill effect on production and click (03 §2 pas 7 / §3)', () => {
  const baseline = () =>
    makeState((s) => {
      s.run.generators.wanderingMuse = 30; // includes a 25-qty milestone ×2
      s.run.generators.inkSprite = 10;
      s.run.upgrades.goldenInkwell = true;
      s.meta.achievements = ['firstWords', 'storytellerAwakens'];
    });

  it('production with q quills is exactly (1 + 0.3q)× the identical baseline', () => {
    const base = baseline();
    const q1 = { ...base, meta: { ...base.meta, goldenQuills: 1 } };
    const q3 = { ...base, meta: { ...base.meta, goldenQuills: 3 } };
    expect(perSecond(base, 0)).toBeGreaterThan(0);
    expect(perSecond(q1, 0)).toBeCloseTo(perSecond(base, 0) * 1.3, 10);
    expect(perSecond(q3, 0)).toBeCloseTo(perSecond(base, 0) * 1.9, 10);
  });

  it('quills do NOT touch the click without Quill Resonance', () => {
    const q0 = makeState();
    const q5 = makeState((s) => void (s.meta.goldenQuills = 5));
    expect(clickPower(q5, 0)).toBe(clickPower(q0, 0));
  });

  it('with Quill Resonance the click scales by exactly (1 + 0.3q)', () => {
    const s = makeState((x) => {
      x.meta.goldenQuills = 4;
      x.meta.quillResonance = true;
    });
    expect(clickPower(s, 0)).toBeCloseTo(1 + 0.3 * 4, 12);
  });
});

describe('Quill Resonance — post-prestige purchase, persists forever', () => {
  it('cannot be bought before the first publish', () => {
    const s = makeState((x) => void (x.run.inspiration = 10_000));
    expect(buyUpgrade(s, 'quillResonance')).toBe(s);
  });

  it('bought after the first publish, it survives every later publish', () => {
    let s = makeState((x) => void (x.run.totalEarned = 100_000));
    s = publishTheTome(s, 0); // tome 1 → purchasable now
    s = { ...s, run: { ...s.run, inspiration: 2_500 } };
    s = buyUpgrade(s, 'quillResonance');
    expect(s.meta.quillResonance).toBe(true);
    expect(s.run.inspiration).toBe(0); // cost 2,500 per 03 §4

    s = { ...s, run: { ...s.run, totalEarned: 400_000 } };
    s = publishTheTome(s, 0); // tome 2
    s = { ...s, run: { ...s.run, totalEarned: 100_000 } };
    s = publishTheTome(s, 0); // tome 3
    expect(s.meta.quillResonance).toBe(true);
    expect(s.meta.goldenQuills).toBe(1 + 2 + 1);
    expect(s.meta.tomesPublished).toBe(3);
  });
});

describe('save → prestige → load round-trip (store level)', () => {
  it('prestige persists immediately and the loaded save carries the quills, uncorrupted', () => {
    const storage = createMemoryStorage();
    const initial = makeState((s) => {
      s.run.inspiration = 3_000;
      s.run.totalEarned = 450_000;
      s.run.generators.wanderingMuse = 30;
      s.run.upgrades.sharpenedNib = true;
      s.meta.goldenQuills = 2;
      s.meta.tomesPublished = 1;
      s.meta.quillResonance = true;
      s.meta.achievements = ['firstWords', 'publishedAuthor'];
    });
    const store = createGameStore(initial, { now: () => 1_000, storage });
    store.dispatch({ type: 'prestige' });

    const after = store.getState();
    expect(after.meta.goldenQuills).toBe(4); // 2 + floor(sqrt(4.5))
    expect(after.meta.tomesPublished).toBe(2);
    expect(after.run.inspiration).toBe(0);
    expect(after.run.generators.wanderingMuse).toBe(0);
    expect(after.run.upgrades.sharpenedNib).toBeUndefined();
    // Achievements persist → the hallOfDeeds reveal re-triggers instantly
    // (intended: the Achievements tab stays visible after a publish).
    expect(after.run.milestones).toEqual(['hallOfDeeds']);

    // Prestige is a critical action → already persisted, and loads back intact.
    const loaded = loadSave(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.run).toEqual(after.run);
    expect(loaded!.state.meta).toEqual(after.meta);
    expect(loaded!.state.meta.goldenQuills).toBe(4);
    expect(loaded!.state.meta.quillResonance).toBe(true);
  });

  it('dispatching prestige grants Published Author automatically', () => {
    const store = createGameStore(
      makeState((s) => void (s.run.totalEarned = 150_000)),
      { now: () => 0, storage: createMemoryStorage() },
    );
    store.dispatch({ type: 'prestige' });
    expect(store.getState().meta.achievements).toContain('publishedAuthor');
    expect(store.getState().meta.goldenQuills).toBe(1);
  });

  it('a crafted save cannot smuggle quillResonance into run upgrades', () => {
    const json = serializeState(makeState(), 1);
    const tampered = json.replace('"upgrades":{}', '"upgrades":{"quillResonance":true}');
    expect(tampered).not.toBe(json); // the marker was really there
    const parsed = parseSave(tampered);
    expect(parsed).not.toBeNull();
    expect(
      (parsed!.run.upgrades as Record<string, unknown>).quillResonance,
    ).toBeUndefined();
    expect(parsed!.meta.quillResonance).toBe(false);
  });
});
