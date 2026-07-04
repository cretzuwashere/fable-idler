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
      // v2: spread over the initial stats so the new fields keep their defaults
      s.meta.stats = {
        ...s.meta.stats,
        totalClicks: 2_345,
        lifetimeInspiration: 1_234_567,
        buffActivations: 19,
        offlineSessionsOver30Min: 2,
        bestSingleOfflineGain: 55_000,
        lifetimeQuillsEarned: 3, // wallet ≡ lifetime for a non-spender
      };
      s.meta.settings = { buyQty: 'max', reduceMotion: true };
    });

  it('prestigePreview shows the exact quills to be earned', () => {
    expect(prestigePreview(richState())).toBe(2);
  });

  it('resets the entire run state to a fresh run (v2: startedAt anchored at now)', () => {
    const after = publishTheTome(richState(), 777);
    // v2: the fresh run is anchored at the publish time (startedAt = 777).
    expect(after.run).toEqual(createInitialRunState(777));
    expect(after.run.buff).toEqual({ activeUntil: 0, cooldownUntil: 0 });
    expect(after.run.sparkBuff).toBeNull();
    expect(after.run.buffActivationsThisRun).toBe(0);
    expect(after.lastTickAt).toBe(777);
  });

  it('adds the earned quills to the existing balance and counts the tome', () => {
    const after = publishTheTome(richState(), 0);
    expect(after.meta.goldenQuills).toBe(5); // 3 + 2
    // v2 GOLDEN RULE: the lifetime anchor grows in lockstep with the wallet.
    expect(after.meta.stats.lifetimeQuillsEarned).toBe(5);
    expect(after.meta.tomesPublished).toBe(2);
  });

  it('leaves achievements, quillResonance, stats and settings untouched', () => {
    const before = richState();
    const after = publishTheTome(before, 0);
    expect(after.meta.achievements).toEqual(before.meta.achievements);
    expect(after.meta.quillResonance).toBe(true);
    // v2: ONLY the quill lifetime counter moves (by the publish payout itself);
    // startedAt = 0 in makeState → this run has no duration → fastest untouched.
    expect(after.meta.stats).toEqual({
      ...before.meta.stats,
      lifetimeQuillsEarned: before.meta.stats.lifetimeQuillsEarned + 2,
    });
    expect(after.meta.settings).toEqual(before.meta.settings);
  });

  it('v2: appends exactly one fable with the run stats of the published run', () => {
    const before = richState();
    const after = publishTheTome(before, 12_345);
    expect(after.meta.fables).toHaveLength(1);
    const fable = after.meta.fables[0];
    expect(fable.n).toBe(2); // tome number, 1-based
    expect(fable.publishedAt).toBe(12_345);
    expect(fable.title.length).toBeGreaterThan(0);
    expect(fable.runStats).toEqual({
      totalEarned: 450_000,
      durationMs: null, // startedAt = 0 sentinel → duration unknown
      quillsEarned: 2,
    });
    expect(fable.gilded).toBe(false); // 2 < 5
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
  // v2 GOLDEN RULE UPDATE: the +30%/quill bonus reads stats.lifetimeQuillsEarned
  // (monotonic), not the spendable wallet — these tests now set the lifetime
  // anchor (a non-spender has wallet ≡ lifetime, so the v1 semantics are a
  // strict subset of the v2 ones).
  const baseline = () =>
    makeState((s) => {
      s.run.generators.wanderingMuse = 30; // includes a 25-qty milestone ×2
      s.run.generators.inkSprite = 10;
      s.run.upgrades.goldenInkwell = true;
      s.meta.achievements = ['firstWords', 'storytellerAwakens'];
    });

  const withLifetimeQuills = (base: ReturnType<typeof baseline>, q: number) => ({
    ...base,
    meta: {
      ...base.meta,
      goldenQuills: q,
      stats: { ...base.meta.stats, lifetimeQuillsEarned: q },
    },
  });

  it('production with q quills is exactly (1 + 0.3q)× the identical baseline', () => {
    const base = baseline();
    const q1 = withLifetimeQuills(base, 1);
    const q3 = withLifetimeQuills(base, 3);
    expect(perSecond(base, 0)).toBeGreaterThan(0);
    expect(perSecond(q1, 0)).toBeCloseTo(perSecond(base, 0) * 1.3, 10);
    expect(perSecond(q3, 0)).toBeCloseTo(perSecond(base, 0) * 1.9, 10);
  });

  it('quills do NOT touch the click without Quill Resonance', () => {
    const q0 = makeState();
    const q5 = makeState((s) => {
      s.meta.goldenQuills = 5;
      s.meta.stats.lifetimeQuillsEarned = 5;
    });
    expect(clickPower(q5, 0)).toBe(clickPower(q0, 0));
  });

  it('with Quill Resonance the click scales by exactly (1 + 0.3q)', () => {
    const s = makeState((x) => {
      x.meta.goldenQuills = 4;
      x.meta.stats.lifetimeQuillsEarned = 4;
      x.meta.quillResonance = true;
    });
    expect(clickPower(s, 0)).toBeCloseTo(1 + 0.3 * 4, 12);
  });
});

// ---------------------------------------------------------------------------
// v2 — Fastest Publish (startedAt sentinel) + Speed Reader
// ---------------------------------------------------------------------------

describe('v2 fastest publish (run.startedAt)', () => {
  it('records durationMs and fastestPublishMs when startedAt > 0', () => {
    const s = makeState((x) => {
      x.run.totalEarned = 150_000;
      x.run.startedAt = 60_000; // run began at t=60s
    });
    const after = publishTheTome(s, 500_000); // duration 440,000 ms
    expect(after.meta.stats.fastestPublishMs).toBe(440_000);
    expect(after.meta.fables[0].runStats?.durationMs).toBe(440_000);
    expect(after.run.startedAt).toBe(500_000); // the new run is timed from now
  });

  it('keeps the minimum across publishes and ignores slower runs', () => {
    let s = makeState((x) => {
      x.run.totalEarned = 150_000;
      x.run.startedAt = 1_000;
    });
    s = publishTheTome(s, 301_000); // 300s
    expect(s.meta.stats.fastestPublishMs).toBe(300_000);
    s = { ...s, run: { ...s.run, totalEarned: 150_000 } };
    s = publishTheTome(s, 301_000 + 900_000); // this run took 900s — slower
    expect(s.meta.stats.fastestPublishMs).toBe(300_000); // min kept
  });

  it('startedAt = 0 (v1 migration sentinel) NEVER counts toward fastest (A5)', () => {
    const s = makeState((x) => void (x.run.totalEarned = 150_000)); // startedAt 0
    const after = publishTheTome(s, 999_999);
    expect(after.meta.stats.fastestPublishMs).toBeNull();
    expect(after.meta.fables[0].runStats?.durationMs).toBeNull();
  });

  it('a sub-10-minute publish unlocks Speed Reader through the store', () => {
    const store = createGameStore(
      makeState((s) => {
        s.run.totalEarned = 150_000;
        s.run.startedAt = 1; // ~0s run
      }),
      { now: () => 400_000, storage: createMemoryStorage() }, // < 600,000 ms
    );
    store.dispatch({ type: 'prestige' });
    expect(store.getState().meta.achievements).toContain('speedReader');
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
      s.meta.stats.lifetimeQuillsEarned = 2; // v2: wallet ≡ lifetime for a non-spender
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
    // v2: the three tomesPublished milestones re-add the same way (10 §3.5).
    expect(after.run.milestones).toEqual([
      'hallOfDeeds',
      'theGildedDoor',
      'theFirstSpine',
      'wordTravelsFast',
    ]);

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
