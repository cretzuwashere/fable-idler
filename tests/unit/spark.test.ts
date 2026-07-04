// spark.test.ts — Stray Spark rewards (11 §5). All magnitudes hand-computed.
// RNG never lives in the engine: rollSparkKind maps an injected roll through
// cumulative weights; collectSpark computes magnitudes from the CURRENT state.
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applySparkReward,
  BUFF,
  clickPower,
  createGameStore,
  createMemoryStorage,
  perSecond,
  rollSparkKind,
  SAVE_KEY,
  SPARK,
  SPARK_KINDS,
  sparkIntervalRange,
  sparkRewardSummary,
  sparkWeightTotal,
  tick,
} from '../../src/engine';
import type { GameEvent, GameState } from '../../src/engine';
import { makeState } from './helpers';

/** 10 inkSprites → exactly 10/s with no other multipliers. */
function tenPerSec(mutate?: (s: GameState) => void): GameState {
  return makeState((s) => {
    s.run.generators.inkSprite = 10;
    if (mutate) mutate(s);
  });
}

describe('weights + rollSparkKind boundaries', () => {
  it('the weight table sums to exactly 100', () => {
    expect(sparkWeightTotal()).toBe(100);
  });

  it('maps rolls to kinds at the exact cumulative boundaries (45/20/15/10/8/2)', () => {
    expect(rollSparkKind(0)).toBe('inkBurst');
    expect(rollSparkKind(0.4499)).toBe('inkBurst');
    expect(rollSparkKind(0.45)).toBe('quillFrenzy');
    expect(rollSparkKind(0.6499)).toBe('quillFrenzy');
    expect(rollSparkKind(0.65)).toBe('gossipBonanza');
    expect(rollSparkKind(0.7999)).toBe('gossipBonanza');
    expect(rollSparkKind(0.8)).toBe('timeSlip');
    expect(rollSparkKind(0.8999)).toBe('timeSlip');
    expect(rollSparkKind(0.9)).toBe('storyFragment');
    expect(rollSparkKind(0.9799)).toBe('storyFragment');
    expect(rollSparkKind(0.98)).toBe('goldenQuillDrop');
    expect(rollSparkKind(0.999999)).toBe('goldenQuillDrop');
  });

  it('is defensive: out-of-range / non-finite rolls still return a valid kind', () => {
    expect(rollSparkKind(1)).toBe('goldenQuillDrop'); // clamped just under 1
    expect(rollSparkKind(-3)).toBe('inkBurst');
    expect(rollSparkKind(Number.NaN)).toBe('inkBurst');
    expect(SPARK_KINDS).toHaveLength(6);
  });
});

describe('inkBurst — 45 × effectiveProd, floor 50 × clickValue', () => {
  it('grants exactly 45 × production at 10/s → 450, into balance/totalEarned/lifetime', () => {
    const s = tenPerSec((x) => void (x.run.totalEarned = 2_000));
    const after = applySparkReward(s, 'inkBurst', 0);
    expect(after.run.inspiration).toBeCloseTo(450, 9); // 45 × 10 > floor 50 × 1
    expect(after.run.totalEarned).toBeCloseTo(2_450, 9);
    expect(after.meta.stats.lifetimeInspiration).toBeCloseTo(450, 9);
    expect(after.meta.stats.sparksCaught).toBe(1);
  });

  it('the snapshot INCLUDES active buffs (catch-mid-buff is legitimate skill)', () => {
    const s = tenPerSec((x) => void (x.run.buff.activeUntil = 10_000));
    expect(perSecond(s, 0)).toBeCloseTo(20, 12);
    const after = applySparkReward(s, 'inkBurst', 0);
    expect(after.run.inspiration).toBeCloseTo(45 * 20, 9);
  });

  it('floors at 50 × click value when production is ~0 (unfarmable early game)', () => {
    const s = makeState(); // production 0, clickPower 1
    expect(clickPower(s, 0)).toBe(1);
    const after = applySparkReward(s, 'inkBurst', 0);
    expect(after.run.inspiration).toBeCloseTo(SPARK.inkBurstFloorClicks * 1, 9); // 50
  });

  it("Sparkcatcher's Net L2 doubles the sum (and the floor)", () => {
    const net = tenPerSec((x) => void (x.meta.atelier = { sparkcatchersNet: 2 }));
    expect(applySparkReward(net, 'inkBurst', 0).run.inspiration).toBeCloseTo(900, 9);
    const zeroProd = makeState((x) => void (x.meta.atelier = { sparkcatchersNet: 2 }));
    expect(applySparkReward(zeroProd, 'inkBurst', 0).run.inspiration).toBeCloseTo(100, 9);
  });
});

describe('quillFrenzy / gossipBonanza — spark buffs', () => {
  it('quillFrenzy: 30s buff, ×7 on the click BASE only (echo untouched)', () => {
    const s = tenPerSec((x) => void (x.run.upgrades.inkEcho = true));
    const after = applySparkReward(s, 'quillFrenzy', 1_000);
    expect(after.run.sparkBuff).toEqual({
      kind: 'quillFrenzy',
      activeUntil: 1_000 + SPARK.frenzy.durationMs,
    });
    // base 1 × 7 + echo 0.01 × 10 = 7.1 (NOT 7 × 1.1 = 7.7)
    expect(clickPower(after, 2_000)).toBeCloseTo(7.1, 12);
    expect(clickPower(after, 1_000 + SPARK.frenzy.durationMs)).toBeCloseTo(1.1, 12); // expired
  });

  it('gossipBonanza: 60s buff, ×5 ONLY on tiers 1–3', () => {
    const s = makeState((x) => {
      x.run.generators.wanderingMuse = 10; // 1/s → ×5
      x.run.generators.inkSprite = 10; // 10/s → ×5
      x.run.generators.enchantedQuill = 1; // 47/s → NOT multiplied
    });
    const after = applySparkReward(s, 'gossipBonanza', 0);
    expect(after.run.sparkBuff).toEqual({
      kind: 'gossipBonanza',
      activeUntil: SPARK.gossip.durationMs,
    });
    expect(perSecond(after, 0)).toBeCloseTo((1 + 10) * 5 + 47, 9); // 102
    expect(perSecond(after, SPARK.gossip.durationMs)).toBeCloseTo(58, 9); // expired
  });

  it('a new spark buff replaces the old one (max 1 active)', () => {
    const s = tenPerSec();
    const frenzied = applySparkReward(s, 'quillFrenzy', 0);
    const gossiped = applySparkReward(frenzied, 'gossipBonanza', 5_000);
    expect(gossiped.run.sparkBuff?.kind).toBe('gossipBonanza');
  });

  it('Net L2 doubles the buff durations', () => {
    const net = tenPerSec((x) => void (x.meta.atelier = { sparkcatchersNet: 2 }));
    expect(applySparkReward(net, 'quillFrenzy', 0).run.sparkBuff?.activeUntil).toBe(
      SPARK.frenzy.durationMs * 2,
    );
    expect(applySparkReward(net, 'gossipBonanza', 0).run.sparkBuff?.activeUntil).toBe(
      SPARK.gossip.durationMs * 2,
    );
  });

  it('spark buffs expire (are cleared) in tick', () => {
    const s = applySparkReward(tenPerSec(), 'quillFrenzy', 0);
    const mid = tick(s, 10_000, 1_000);
    expect(mid.run.sparkBuff).not.toBeNull();
    const after = tick(mid, SPARK.frenzy.durationMs + 1_000, 1_000);
    expect(after.run.sparkBuff).toBeNull();
  });
});

describe('timeSlip — cooldown reset + free buff, nothing else', () => {
  it('resets the cooldown and starts a free PLAIN-duration buff without counters', () => {
    const s = makeState((x) => {
      x.run.totalEarned = 2_000; // buff unlocked
      x.run.buff = { activeUntil: 0, cooldownUntil: 80_000 }; // deep in cooldown
      x.meta.stats.buffActivations = 3;
    });
    const after = applySparkReward(s, 'timeSlip', 10_000);
    expect(after.run.buff.activeUntil).toBe(10_000 + BUFF.durationMs); // plain 15s
    expect(after.run.buff.cooldownUntil).toBe(10_000); // reset → can re-activate now
    expect(after.meta.stats.buffActivations).toBe(3); // NOT an activation
    expect(after.run.buffActivationsThisRun).toBe(0); // Standing Ovation NOT consumed
  });

  it('does NOT trigger Thunderous Applause and is NOT doubled by Net L2', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.totalEarned = 2_000;
      x.meta.atelier = { thunderousApplause: 1, sparkcatchersNet: 2 };
    });
    const after = applySparkReward(s, 'timeSlip', 0);
    expect(after.run.inspiration).toBe(0); // no applause payout
    expect(after.run.buff.activeUntil).toBe(BUFF.durationMs); // 15s, not 30s
  });

  it('respects Burst of Genius (22.5s free buff)', () => {
    const s = makeState((x) => {
      x.run.totalEarned = 2_000;
      x.run.upgrades.burstOfGenius = true;
    });
    const after = applySparkReward(s, 'timeSlip', 0);
    expect(after.run.buff.activeUntil).toBe(BUFF.durationUpgradedMs);
  });
});

describe('storyFragment / goldenQuillDrop — quills always wallet AND lifetime', () => {
  it('accumulates fragments; the 5th binds a Golden Quill', () => {
    let s = makeState((x) => {
      x.meta.storyFragments = 3;
      x.meta.goldenQuills = 2;
      x.meta.stats.lifetimeQuillsEarned = 7;
    });
    s = applySparkReward(s, 'storyFragment', 0);
    expect(s.meta.storyFragments).toBe(4);
    expect(s.meta.goldenQuills).toBe(2);
    s = applySparkReward(s, 'storyFragment', 0);
    expect(s.meta.storyFragments).toBe(0);
    expect(s.meta.goldenQuills).toBe(3); // wallet +1
    expect(s.meta.stats.lifetimeQuillsEarned).toBe(8); // lifetime +1
    expect(s.meta.stats.quillsFromFragments).toBe(1); // pieceByPiece counter
  });

  it('Net L2 grants 2 fragments per catch (4 + 2 → 1 quill + 1 fragment left)', () => {
    const s = makeState((x) => {
      x.meta.storyFragments = 4;
      x.meta.atelier = { sparkcatchersNet: 2 };
    });
    const after = applySparkReward(s, 'storyFragment', 0);
    expect(after.meta.storyFragments).toBe(1);
    expect(after.meta.goldenQuills).toBe(1);
    expect(after.meta.stats.lifetimeQuillsEarned).toBe(1);
  });

  it('goldenQuillDrop: +1 (Net L2: +2) into wallet AND lifetime', () => {
    const one = applySparkReward(makeState(), 'goldenQuillDrop', 0);
    expect(one.meta.goldenQuills).toBe(1);
    expect(one.meta.stats.lifetimeQuillsEarned).toBe(1);
    const net = makeState((x) => void (x.meta.atelier = { sparkcatchersNet: 2 }));
    const two = applySparkReward(net, 'goldenQuillDrop', 0);
    expect(two.meta.goldenQuills).toBe(2);
    expect(two.meta.stats.lifetimeQuillsEarned).toBe(2);
  });
});

describe('collectSpark through the reducer / store', () => {
  it('rewards flow through totalEarned — milestones do fire (intended, 09 §2.3.5)', () => {
    const s = tenPerSec((x) => void (x.run.totalEarned = 900)); // below aLightAtTheWindow
    const after = applyAction(s, { type: 'collectSpark', kind: 'inkBurst' }, 0);
    expect(after.run.totalEarned).toBeCloseTo(1_350, 9);
    expect(after.run.milestones).toContain('aLightAtTheWindow');
  });

  it('sparkChaser unlocks on the first catch; dispatch persists immediately (critical)', () => {
    const storage = createMemoryStorage();
    const store = createGameStore(tenPerSec(), { now: () => 0, storage });
    const events: GameEvent[] = [];
    store.subscribeToEvents((e) => events.push(e));

    store.dispatch({ type: 'collectSpark', kind: 'goldenQuillDrop' });

    expect(store.getState().meta.stats.sparksCaught).toBe(1);
    expect(store.getState().meta.achievements).toContain('sparkChaser');
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    const collected = events.filter((e) => e.type === 'sparkCollected');
    expect(collected).toHaveLength(1);
    expect(collected[0].type === 'sparkCollected' && collected[0].reward.quills).toBe(1);
  });

  it('sparkIntervalRange: [150,330]s base, halved by Net L1', () => {
    expect(sparkIntervalRange(makeState())).toEqual({ minMs: 150_000, maxMs: 330_000 });
    const net = makeState((x) => void (x.meta.atelier = { sparkcatchersNet: 1 }));
    expect(sparkIntervalRange(net)).toEqual({ minMs: 75_000, maxMs: 165_000 });
  });

  it('sparkRewardSummary matches what applySparkReward actually applies', () => {
    const s = tenPerSec((x) => void (x.meta.storyFragments = 4));
    const summary = sparkRewardSummary(s, 'storyFragment', 0);
    expect(summary).toEqual({
      kind: 'storyFragment',
      inspiration: 0,
      quills: 1,
      fragments: 1,
      boundQuill: true,
      buff: null,
    });
    const after = applySparkReward(s, 'storyFragment', 0);
    expect(after.meta.goldenQuills).toBe(summary.quills);
  });
});
