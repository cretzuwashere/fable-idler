// tick.test.ts — the delta-time determinism invariant (02 §2.2) + buff timing.
import { describe, expect, it } from 'vitest';
import {
  activateBuff,
  applyAction,
  canActivateBuff,
  isBuffActive,
  perSecondNoBuff,
  tick,
} from '../../src/engine';
import type { GameState } from '../../src/engine';
import { makeState } from './helpers';

/** State whose unlockables that COULD fire during the window are pre-unlocked,
 *  so both integration paths cross no production-changing thresholds. */
function steadyState(mutate?: (s: GameState) => void): GameState {
  return makeState((s) => {
    s.run.generators.wanderingMuse = 3; // 0.3/s
    s.run.inspiration = 2_000;
    s.run.totalEarned = 2_000;
    s.meta.stats.lifetimeInspiration = 2_000;
    s.meta.stats.totalClicks = 1;
    s.meta.achievements = ['firstWords', 'storytellerAwakens', 'whisperedLegends'];
    if (mutate) mutate(s);
  });
}

describe('delta-time determinism', () => {
  it('10 × tick(100ms) ≅ 1 × tick(1000ms) within 1e-9', () => {
    const s = steadyState();

    const big = tick(s, 1_000, 1_000);

    let small = s;
    for (let i = 1; i <= 10; i++) small = tick(small, i * 100, 100);

    expect(small.run.inspiration).toBeCloseTo(big.run.inspiration, 9);
    expect(small.run.totalEarned).toBeCloseTo(big.run.totalEarned, 9);
    expect(small.meta.stats.lifetimeInspiration).toBeCloseTo(
      big.meta.stats.lifetimeInspiration,
      9,
    );
    expect(small.lastTickAt).toBe(big.lastTickAt);
    expect([...small.run.milestones].sort()).toEqual([...big.run.milestones].sort());
  });

  it('stays deterministic when the buff expires mid-window', () => {
    const s = steadyState((x) => void (x.run.buff.activeUntil = 500));

    const big = tick(s, 1_000, 1_000);
    let small = s;
    for (let i = 1; i <= 10; i++) small = tick(small, i * 100, 100);

    // 500ms buffed (×2) + 500ms normal → base·(0.5·2 + 0.5) = base·1.5
    expect(big.run.inspiration - s.run.inspiration).toBeCloseTo(perSecondNoBuff(s) * 1.5, 9);
    expect(small.run.inspiration).toBeCloseTo(big.run.inspiration, 9);
  });

  it('accumulates fractional production at small dt (no flooring)', () => {
    const s = makeState((x) => {
      x.run.generators.wanderingMuse = 1; // 0.1/s ×1.01 (achievement below)
      // pre-unlocked so the +1% achievement bonus does not appear mid-window
      x.meta.achievements = ['storytellerAwakens'];
    });
    let cur = s;
    for (let i = 1; i <= 10; i++) cur = tick(cur, i * 100, 100);
    expect(cur.run.inspiration).toBeCloseTo(0.101, 9); // 1s × 0.1/s × 1.01
  });
});

describe('dt edge cases', () => {
  it('dt = 0 with nothing pending returns the same reference', () => {
    const s = makeState();
    expect(tick(s, 0, 0)).toBe(s);
  });

  it('negative dt (clock rollback) produces nothing', () => {
    const s = steadyState();
    const after = tick(s, -500, -500);
    expect(after.run.inspiration).toBe(s.run.inspiration);
    expect(after.lastTickAt).toBe(-500); // re-anchored, no retro-production
  });

  it('clamps dt to 60s per tick (longer gaps go through the offline path)', () => {
    const s = makeState((x) => void (x.run.generators.inkSprite = 1)); // 1/s
    const after = tick(s, 200_000, 200_000);
    expect(after.run.inspiration).toBeCloseTo(60, 9);
  });
});

describe('debug actions backing the E2E test hook (02 §6.3)', () => {
  it('debugAddInspiration credits balance, run totalEarned and lifetime, then re-checks', () => {
    const after = applyAction(makeState(), { type: 'debugAddInspiration', amount: 500_000 }, 0);
    expect(after.run.inspiration).toBe(500_000);
    expect(after.run.totalEarned).toBe(500_000);
    expect(after.meta.stats.lifetimeInspiration).toBe(500_000);
    expect(after.run.milestones).toContain('thePublishersLetter'); // checks ran
  });

  it('debugFastForward simulates long stretches beyond the 60s tick clamp', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 1; // 1/s
      x.meta.achievements = ['storytellerAwakens', 'whisperedLegends']; // pre-unlock crossables
      x.meta.stats.lifetimeInspiration = 2_000;
      x.run.totalEarned = 2_000;
    });
    const after = applyAction(s, { type: 'debugFastForward', ms: 3_600_000 }, 3_600_000);
    expect(after.run.inspiration).toBeCloseTo(3_600 * 1.02, 6); // 1h at 1/s ×1.02
    expect(after.lastTickAt).toBe(3_600_000);
  });
});

describe('Moment of Inspiration timing', () => {
  const unlocked = (mutate?: (s: GameState) => void) =>
    makeState((s) => {
      s.run.totalEarned = 1_000; // past Racing Heart (500)
      if (mutate) mutate(s);
    });

  it('activation sets duration 15s and cooldown 90s from activation', () => {
    const s = unlocked();
    const after = activateBuff(s, 10_000);
    expect(after.run.buff.activeUntil).toBe(25_000);
    expect(after.run.buff.cooldownUntil).toBe(100_000);
    expect(after.meta.stats.buffActivations).toBe(1);
  });

  it('cannot activate while locked (below 500 totalEarned) or on cooldown', () => {
    const locked = makeState((s) => void (s.run.totalEarned = 499));
    expect(canActivateBuff(locked, 0)).toBe(false);
    expect(activateBuff(locked, 0)).toBe(locked);

    const s = activateBuff(unlocked(), 0);
    expect(canActivateBuff(s, 89_999)).toBe(false);
    expect(activateBuff(s, 89_999)).toBe(s);
    expect(canActivateBuff(s, 90_000)).toBe(true);
  });

  it('Burst of Genius extends the duration to 22.5s', () => {
    const s = unlocked((x) => void (x.run.upgrades.burstOfGenius = true));
    const after = activateBuff(s, 0);
    expect(after.run.buff.activeUntil).toBe(22_500);
    expect(after.run.buff.cooldownUntil).toBe(90_000); // cooldown unchanged
  });

  it('buff expires exactly at activeUntil', () => {
    const s = activateBuff(unlocked(), 0);
    expect(isBuffActive(s, 14_999)).toBe(true);
    expect(isBuffActive(s, 15_000)).toBe(false);
  });

  it('production reflects buff expiry inside the tick window', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 1; // 1/s
      x.run.buff.activeUntil = 400;
    });
    const after = tick(s, 1_000, 1_000);
    // 400ms ×2 + 600ms ×1 at 1/s → 0.8 + 0.6 = 1.4
    expect(after.run.inspiration).toBeCloseTo(1.4, 9);
  });
});
