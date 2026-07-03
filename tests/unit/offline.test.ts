// offline.test.ts — gain = perSecondNoBuff × min(elapsed, cap) × efficiency (03 §8).
// Base 0.5 / 8h; Lucid Dreaming 0.75 / 12h; elapsed clamped to ≥ 0.
import { describe, expect, it } from 'vitest';
import { applyOfflineReport, computeOfflineReport } from '../../src/engine';
import type { GameState } from '../../src/engine';
import { makeState } from './helpers';

const HOUR = 3_600_000;

/** 10 inkSprites → exactly 10/s with no other multipliers. */
function tenPerSec(mutate?: (s: GameState) => void): GameState {
  return makeState((s) => {
    s.run.generators.inkSprite = 10;
    if (mutate) mutate(s);
  });
}

describe('computeOfflineReport', () => {
  it('1h away at 10/s with base efficiency 0.5 → 18,000', () => {
    const r = computeOfflineReport(tenPerSec(), 0, HOUR);
    expect(r.gained).toBeCloseTo(18_000, 9);
    expect(r.elapsedMs).toBe(HOUR);
    expect(r.cappedMs).toBe(HOUR);
    expect(r.efficiency).toBe(0.5);
  });

  it('caps at 8 hours without Lucid Dreaming', () => {
    const r = computeOfflineReport(tenPerSec(), 0, 24 * HOUR);
    expect(r.elapsedMs).toBe(24 * HOUR);
    expect(r.cappedMs).toBe(8 * HOUR);
    expect(r.gained).toBeCloseTo(10 * 8 * 3_600 * 0.5, 9); // 144,000
  });

  it('Lucid Dreaming raises efficiency to 0.75 AND the cap to 12h', () => {
    const lucid = tenPerSec((s) => void (s.run.upgrades.lucidDreaming = true));
    const oneHour = computeOfflineReport(lucid, 0, HOUR);
    expect(oneHour.efficiency).toBe(0.75);
    expect(oneHour.gained).toBeCloseTo(27_000, 9); // 10 · 3600 · 0.75
    const longAway = computeOfflineReport(lucid, 0, 24 * HOUR);
    expect(longAway.cappedMs).toBe(12 * HOUR);
    expect(longAway.gained).toBeCloseTo(10 * 12 * 3_600 * 0.75, 9); // 324,000
  });

  it('negative elapsed (clock rollback) → 0 gained, 0 elapsed', () => {
    const r = computeOfflineReport(tenPerSec(), 1_000_000, 0);
    expect(r.elapsedMs).toBe(0);
    expect(r.cappedMs).toBe(0);
    expect(r.gained).toBe(0);
  });

  it('an active buff timestamp does NOT inflate offline gains', () => {
    const buffed = tenPerSec((s) => void (s.run.buff.activeUntil = Number.MAX_SAFE_INTEGER));
    const plain = computeOfflineReport(tenPerSec(), 0, HOUR);
    const withBuff = computeOfflineReport(buffed, 0, HOUR);
    expect(withBuff.gained).toBeCloseTo(plain.gained, 9);
  });
});

describe('applyOfflineReport', () => {
  it('credits balance, run totalEarned and lifetime stats', () => {
    const s = tenPerSec((x) => {
      x.run.inspiration = 100;
      x.run.totalEarned = 500;
      x.meta.stats.lifetimeInspiration = 500;
    });
    const r = computeOfflineReport(s, 0, HOUR);
    const after = applyOfflineReport(s, r, HOUR);
    expect(after.run.inspiration).toBeCloseTo(18_100, 9);
    expect(after.run.totalEarned).toBeCloseTo(18_500, 9);
    expect(after.meta.stats.lifetimeInspiration).toBeCloseTo(18_500, 9);
    expect(after.lastTickAt).toBe(HOUR);
  });

  it('counts sessions ≥ 30 min (Lucid Dreaming unlock) and tracks the best gain', () => {
    const s = tenPerSec();
    const long = applyOfflineReport(s, computeOfflineReport(s, 0, 31 * 60_000), 0);
    expect(long.meta.stats.offlineSessionsOver30Min).toBe(1);
    expect(long.meta.stats.bestSingleOfflineGain).toBeCloseTo(9_300, 9); // 10·1860·0.5

    const short = applyOfflineReport(s, computeOfflineReport(s, 0, 29 * 60_000), 0);
    expect(short.meta.stats.offlineSessionsOver30Min).toBe(0);
  });

  it('bestSingleOfflineGain never decreases', () => {
    const s = tenPerSec((x) => void (x.meta.stats.bestSingleOfflineGain = 1e9));
    const after = applyOfflineReport(s, computeOfflineReport(s, 0, HOUR), HOUR);
    expect(after.meta.stats.bestSingleOfflineGain).toBe(1e9);
  });

  it('a 1,000+ gain unlocks the Night Shift achievement on return', () => {
    const s = tenPerSec();
    const after = applyOfflineReport(s, computeOfflineReport(s, 0, HOUR), HOUR);
    expect(after.meta.achievements).toContain('nightShift');
  });

  it('offline gains can trigger totalEarned milestones ("While you were away")', () => {
    const s = tenPerSec();
    const after = applyOfflineReport(s, computeOfflineReport(s, 0, HOUR), HOUR);
    expect(after.run.milestones).toContain('theQuillStirs'); // 6,000 < 18,000
  });
});
