// tick.test.ts — the delta-time determinism invariant (02 §2.2) + buff timing.
// v2 additions: the Self-Writing Contract auto-buy is evaluated only at
// ABSOLUTE whole seconds inside tick, so the invariant holds with it active;
// Restless Heart / Thunderous Applause / Standing Ovation on the buff.
import { describe, expect, it } from 'vitest';
import {
  activateBuff,
  applyAction,
  BUFF,
  canActivateBuff,
  isBuffActive,
  perSecond,
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

  it('stays deterministic when a Gossip Bonanza spark buff expires mid-window (v2)', () => {
    const s = steadyState((x) => {
      x.run.sparkBuff = { kind: 'gossipBonanza', activeUntil: 500 };
    });
    const big = tick(s, 1_000, 1_000);
    let small = s;
    for (let i = 1; i <= 10; i++) small = tick(small, i * 100, 100);
    // 500ms at ×5 (muses are tier 1) + 500ms normal → base·(0.5·5 + 0.5) = base·3
    expect(big.run.inspiration - s.run.inspiration).toBeCloseTo(perSecondNoBuff(s) * 3, 9);
    expect(small.run.inspiration).toBeCloseTo(big.run.inspiration, 9);
    expect(big.run.sparkBuff).toBeNull(); // expired buffs are cleared by tick
    expect(small.run.sparkBuff).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// v2 — Self-Writing Contract: deterministic auto-buy inside tick
// ---------------------------------------------------------------------------

describe('v2 auto-buy (Self-Writing Contract)', () => {
  /** Contract owned, steady production, everything crossable pre-unlocked —
   *  including patronOfTheArts (the contract itself is an Atelier upgrade,
   *  so the achievement would otherwise unlock mid-window and shift ×1.03→×1.04
   *  at different times in the two integration paths). */
  const contractState = (mutate?: (s: GameState) => void) =>
    makeState((s) => {
      s.meta.atelier = { selfWritingContract: 1 };
      s.run.generators.inkSprite = 10; // 10/s
      s.run.inspiration = 10_000;
      s.run.totalEarned = 10_000;
      s.meta.stats.lifetimeInspiration = 10_000;
      s.meta.stats.totalClicks = 1;
      s.meta.achievements = [
        'firstWords', 'storytellerAwakens', 'whisperedLegends', 'patronOfTheArts',
      ];
      s.run.milestones = [
        'theFirstSpark', 'whispersInInk', 'craftsmansTools', 'racingHeart',
        'aFeatheredFriend', 'hallOfDeeds', 'theQuillStirs', 'aLightAtTheWindow',
      ];
      if (mutate) mutate(s);
    });

  it('DETERMINISM: 10 × tick(100ms) ≡ 1 × tick(1000ms) with auto-buy active', () => {
    const s = contractState();
    const big = tick(s, 1_000, 1_000);
    let small = s;
    for (let i = 1; i <= 10; i++) small = tick(small, i * 100, 100);

    expect(big.run.generators.wanderingMuse).toBe(1); // bought at the 1s boundary
    expect(small.run.generators.wanderingMuse).toBe(big.run.generators.wanderingMuse);
    expect(small.run.lastAutoBuyAt).toBe(big.run.lastAutoBuyAt);
    expect(small.run.inspiration).toBeCloseTo(big.run.inspiration, 9);
    expect(small.run.totalEarned).toBeCloseTo(big.run.totalEarned, 9);
  });

  it('buys at most 1 muse per second (10 purchases over a 10s window)', () => {
    const s = contractState((x) => void (x.run.inspiration = 1_000_000));
    const after = tick(s, 10_000, 10_000);
    expect(after.run.generators.wanderingMuse).toBe(10);
    expect(after.run.lastAutoBuyAt).toBe(10_000);
    // and the schedule carries across ticks: the next boundary respects the 1s spacing
    const later = tick(after, 10_500, 500);
    expect(later.run.generators.wanderingMuse).toBe(10); // 10.5s — no whole second passed
    const evenLater = tick(later, 11_000, 500);
    expect(evenLater.run.generators.wanderingMuse).toBe(11);
  });

  it('respects the 1% threshold exactly (cost ≤ 1% × balance) — never drains the purse', () => {
    // No production → the balance only moves by the purchase itself.
    const yes = makeState((s) => {
      s.meta.atelier = { selfWritingContract: 1 };
      s.run.inspiration = 1_500; // 1% = 15 = the first muse cost → buys
      s.run.totalEarned = 1_500;
    });
    const afterYes = tick(yes, 1_000, 1_000);
    expect(afterYes.run.generators.wanderingMuse).toBe(1);
    expect(afterYes.run.inspiration).toBeCloseTo(1_485, 9);
    expect(afterYes.run.totalEarned).toBeCloseTo(1_500, 9); // spending ≠ earnings

    const no = makeState((s) => {
      s.meta.atelier = { selfWritingContract: 1 };
      s.run.inspiration = 1_499; // 1% = 14.99 < 15 → skip
      s.run.totalEarned = 1_499;
    });
    expect(tick(no, 1_000, 1_000).run.generators.wanderingMuse).toBe(0);
  });

  it('does nothing without the upgrade, and spending never touches totalEarned/lifetime', () => {
    const s = makeState((x) => {
      x.run.inspiration = 1e9;
      x.run.totalEarned = 1e9;
      x.meta.stats.lifetimeInspiration = 1e9;
      x.meta.achievements = ['firstWords', 'storytellerAwakens', 'whisperedLegends',
        'aThousandTales', 'hoarderOfIdeas'];
    });
    const after = tick(s, 5_000, 5_000);
    expect(after.run.generators.wanderingMuse).toBe(0);

    const contract = contractState((x) => void (x.run.inspiration = 1_000_000));
    const bought = tick(contract, 3_000, 3_000);
    // 3 muses bought; earnings grew only by production (≈10.4/s × 3s ≈ 31.2
    // plus the tiny output of the newly hired muses) — NOT by the ~50 spent.
    expect(bought.run.generators.wanderingMuse).toBe(3);
    expect(bought.run.totalEarned).toBeLessThan(contract.run.totalEarned + 32);
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

// ---------------------------------------------------------------------------
// v2 — buff extensions: Restless Heart, Thunderous Applause, Standing Ovation
// ---------------------------------------------------------------------------

describe('v2 buff extensions', () => {
  const unlocked = (mutate?: (s: GameState) => void) =>
    makeState((s) => {
      s.run.totalEarned = 1_000; // past Racing Heart (500)
      if (mutate) mutate(s);
    });

  it('Restless Heart shortens the cooldown: 90s → 75s → 60s (duration untouched)', () => {
    const l1 = activateBuff(unlocked((s) => void (s.meta.atelier = { restlessHeart: 1 })), 0);
    expect(l1.run.buff.cooldownUntil).toBe(75_000);
    expect(l1.run.buff.activeUntil).toBe(15_000);
    const l2 = activateBuff(unlocked((s) => void (s.meta.atelier = { restlessHeart: 2 })), 0);
    expect(l2.run.buff.cooldownUntil).toBe(60_000);
  });

  it('Thunderous Applause grants exactly 20 × pre-activation production (no double-dip)', () => {
    const s = unlocked((x) => {
      x.run.generators.inkSprite = 10; // 10/s without the buff
      x.meta.atelier = { thunderousApplause: 1 };
    });
    const after = activateBuff(s, 0);
    // 20 × 10 = 200 — NOT 20 × 20 (the just-started ×2 must not count)
    expect(after.run.inspiration).toBeCloseTo(200, 9);
    expect(after.run.totalEarned).toBeCloseTo(1_200, 9);
    expect(after.meta.stats.lifetimeInspiration).toBeCloseTo(200, 9);
    expect(isBuffActive(after, 1)).toBe(true);
    expect(perSecond(after, 1)).toBeCloseTo(20, 9); // the buff itself still applies after
  });

  it('Applause snapshot includes an active Gossip Bonanza (legit combo, 11 §5)', () => {
    const s = unlocked((x) => {
      x.run.generators.inkSprite = 10; // tier 2 → ×5 under gossip
      x.meta.atelier = { thunderousApplause: 1 };
      x.run.sparkBuff = { kind: 'gossipBonanza', activeUntil: 60_000 };
    });
    expect(activateBuff(s, 0).run.inspiration).toBeCloseTo(20 * 50, 9);
  });

  it('Standing Ovation doubles ONLY the first manual activation of the run (≥7 tomes)', () => {
    const s = unlocked((x) => void (x.meta.tomesPublished = 7));
    const first = activateBuff(s, 0);
    expect(first.run.buff.activeUntil).toBe(30_000); // 15s × 2
    expect(first.run.buffActivationsThisRun).toBe(1);
    const second = activateBuff(first, 90_000);
    expect(second.run.buff.activeUntil).toBe(90_000 + BUFF.durationMs); // plain 15s
    expect(second.run.buffActivationsThisRun).toBe(2);
  });

  it('Ovation × Burst of Genius = 45s; without the relic (6 tomes) nothing changes', () => {
    const both = unlocked((x) => {
      x.meta.tomesPublished = 7;
      x.run.upgrades.burstOfGenius = true;
    });
    expect(activateBuff(both, 0).run.buff.activeUntil).toBe(45_000);
    const six = unlocked((x) => void (x.meta.tomesPublished = 6));
    expect(activateBuff(six, 0).run.buff.activeUntil).toBe(15_000);
  });
});
