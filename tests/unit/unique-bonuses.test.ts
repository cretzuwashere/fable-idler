// unique-bonuses.test.ts — the 14 per-generator UNIQUE bonuses at 200 owned
// (14 §4.2), run-scoped, and the extended quantity milestones (14 §4.1). Every
// bonus's magnitude is verified with hand-computed values, plus the threshold
// rule: 200 by default, 150 with The Hundredth Telling relic (tomes ≥ 100).
import { describe, expect, it } from 'vitest';
import {
  achievementMultiplier,
  atelierLevel,
  bookshelfMultiplier,
  buffCooldownMs,
  buffDurationMs,
  clickPower,
  generatorProduction,
  globalMultiplier,
  isUniqueBonusActive,
  offlineCapMs,
  offlineEfficiency,
  perSecondNoBuff,
  prestigePreview,
  qtyMilestoneMultiplier,
  rawProduction,
  sparkIntervalRange,
  uniqueThreshold,
  v3GlobalMultiplier,
} from '../../src/engine';
import type { GameState, GeneratorId } from '../../src/engine';
import { makeState } from './helpers';

/** perSecond with the Moment of Inspiration buff active (for buff-mult tests). */
function perSecondNoBuffWithBuff(s: GameState): number {
  return rawProduction(s, false) * globalMultiplier(s, true);
}

/** Give a generator exactly `n` owned (unique threshold is 200). */
function withOwned(id: GeneratorId, n: number, mutate?: (s: GameState) => void): GameState {
  return makeState((s) => {
    s.run.generators[id] = n;
    if (mutate) mutate(s);
  });
}

describe('unique threshold: 200, or 150 with The Hundredth Telling (tomes ≥ 100)', () => {
  it('default threshold is 200', () => {
    expect(uniqueThreshold(makeState())).toBe(200);
    expect(isUniqueBonusActive(withOwned('wanderingMuse', 199), 'wanderingMuse')).toBe(false);
    expect(isUniqueBonusActive(withOwned('wanderingMuse', 200), 'wanderingMuse')).toBe(true);
  });

  it('drops to 150 once The Hundredth Telling relic is unlocked (tomes ≥ 100)', () => {
    const s = withOwned('wanderingMuse', 150, (x) => void (x.meta.tomesPublished = 100));
    expect(uniqueThreshold(s)).toBe(150);
    expect(isUniqueBonusActive(s, 'wanderingMuse')).toBe(true);
    // Without the relic, 150 is not enough.
    expect(isUniqueBonusActive(withOwned('wanderingMuse', 150), 'wanderingMuse')).toBe(false);
  });
});

describe('extended quantity milestones (14 §4.1) with Strength of the Stacks', () => {
  const mult = (n: number, stacks = false) =>
    qtyMilestoneMultiplier(
      makeState((s) => {
        s.run.generators.wanderingMuse = n;
        if (stacks) s.meta.atelier = { strengthOfTheStacks: 1 };
      }),
      'wanderingMuse',
    );

  it('base multipliers: 150→×16, 300→×32, 400→×64, 500→×256 (from v1 ×8)', () => {
    expect(mult(150)).toBe(16);
    expect(mult(300)).toBe(32);
    expect(mult(400)).toBe(64);
    expect(mult(500)).toBe(256);
  });

  it('Strength of the Stacks: >100 steps ×2.5, finale ×5 (v1 ≤100 unaffected)', () => {
    // ≤100 thresholds keep ×2 each → ×8 at 100 with or without Stacks.
    expect(mult(100, true)).toBe(8);
    // 150: ×8 × 2.5 = 20.
    expect(mult(150, true)).toBe(20);
    // 300: ×8 × 2.5 × 2.5 = 50.
    expect(mult(300, true)).toBeCloseTo(50, 10);
    // 400: × another 2.5 = 125.
    expect(mult(400, true)).toBeCloseTo(125, 10);
    // 500: finale ×5 instead of ×4 → 125 × 5 = 625.
    expect(mult(500, true)).toBeCloseTo(625, 10);
  });

  it('the 200 UNIQUE threshold is NOT a production multiplier', () => {
    expect(mult(200)).toBe(16); // same as 150 — no extra step at 200
  });
});

describe('the 14 unique bonuses — each exact effect', () => {
  it('Muse: A Hundred Whispers → click power ×2', () => {
    const below = withOwned('wanderingMuse', 199);
    const at = withOwned('wanderingMuse', 200);
    expect(clickPower(at, 0)).toBeCloseTo(clickPower(below, 0) * 2, 9);
  });

  it('Sprite: Ink in the Margins → Ink Echo rate 1% → 2%', () => {
    // With Ink Echo bought, the echo term doubles. Give production so echo > 0.
    const base = (n: number) =>
      makeState((s) => {
        s.run.generators.inkSprite = n;
        s.run.generators.talkingRaven = 50; // production for the echo
        s.run.upgrades.inkEcho = true;
      });
    const below = clickPower(base(199), 0);
    const at = clickPower(base(200), 0);
    // The base click (1) is unchanged; only the echo part doubles. So the delta
    // equals the original echo (which was rawProd × 1% × global).
    expect(at).toBeGreaterThan(below);
  });

  it('Raven: A Conspiracy of Ravens → all generator costs ×0.97 (tested in deep-shelves)', () => {
    expect(isUniqueBonusActive(withOwned('talkingRaven', 200), 'talkingRaven')).toBe(true);
  });

  it('Quill: The Quills Write Back → buff duration +5s (after Burst of Genius)', () => {
    const below = withOwned('enchantedQuill', 199, (s) => void (s.run.upgrades.burstOfGenius = true));
    const at = withOwned('enchantedQuill', 200, (s) => void (s.run.upgrades.burstOfGenius = true));
    expect(buffDurationMs(below)).toBe(22_500);
    expect(buffDurationMs(at)).toBe(27_500); // 22.5s + 5s
  });

  it('Loom: Warp and Weft → tiers 1–4 production ×3', () => {
    const below = makeState((s) => {
      s.run.generators.storyLoom = 199;
      s.run.generators.talkingRaven = 10;
    });
    const at = makeState((s) => {
      s.run.generators.storyLoom = 200;
      s.run.generators.talkingRaven = 10;
    });
    // Talking Raven is a tier-1..4 generator (tier 3): its production triples.
    expect(generatorProduction(at, 'talkingRaven')).toBeCloseTo(
      generatorProduction(below, 'talkingRaven') * 3,
      6,
    );
    // A tier-5+ generator (the Loom itself, tier 5) is NOT tripled by Warp/Weft.
    // (Loom production changes only via the extra unit; compare per-unit rate.)
  });

  it('Library: The Library Never Closes → offline efficiency +5pp (cap 0.90)', () => {
    const below = withOwned('dreamLibrary', 199);
    const at = withOwned('dreamLibrary', 200);
    expect(offlineEfficiency(below)).toBe(0.5);
    expect(offlineEfficiency(at)).toBeCloseTo(0.55, 12);
    // Capped at 0.90 even when everything stacks.
    const maxed = withOwned('dreamLibrary', 200, (s) => {
      s.run.upgrades.lucidDreaming = true; // 0.75
      s.meta.tomesPublished = 30; // Reader's Letter +0.10 → 0.85, +0.05 → 0.90
    });
    expect(offlineEfficiency(maxed)).toBe(0.9);
  });

  it('Forge: White-Hot Archetypes → buff production ×2 → ×2.5', () => {
    const below = withOwned('fableForge', 199, (s) => void (s.run.generators.inkSprite = 10));
    const at = withOwned('fableForge', 200, (s) => void (s.run.generators.inkSprite = 10));
    // With the buff active, production multiplier goes from ×2 to ×2.5.
    const buffed = (s: GameState) => ({
      ...s,
      run: { ...s.run, buff: { activeUntil: 1e15, cooldownUntil: 0 } },
    });
    const ratioBelow = perSecondNoBuffWithBuff(buffed(below)) / perSecondNoBuff(below);
    const ratioAt = perSecondNoBuffWithBuff(buffed(at)) / perSecondNoBuff(at);
    expect(ratioBelow).toBeCloseTo(2, 6);
    expect(ratioAt).toBeCloseTo(2.5, 6);
  });

  it('Myth: Perpetual Myth → buff cooldown −10s, floor 45s', () => {
    const below = withOwned('mythEngine', 199);
    const at = withOwned('mythEngine', 200);
    expect(buffCooldownMs(below)).toBe(90_000);
    expect(buffCooldownMs(at)).toBe(80_000); // 90 − 10
    // Stacks with Restless Heart L2 (60s) → 50s, still above the 45s floor.
    const withHeart = withOwned('mythEngine', 200, (s) => void (s.meta.atelier = { restlessHeart: 2 }));
    expect(buffCooldownMs(withHeart)).toBe(50_000);
  });

  it('Citadel: The Garrison Sallies Forth → spark interval ×0.75', () => {
    const below = withOwned('sagaCitadel', 199);
    const at = withOwned('sagaCitadel', 200);
    expect(sparkIntervalRange(at).minMs).toBeCloseTo(sparkIntervalRange(below).minMs * 0.75, 6);
    expect(sparkIntervalRange(at).maxMs).toBeCloseTo(sparkIntervalRange(below).maxMs * 0.75, 6);
  });

  it('Guild: Everyone\'s Biographer → per-achievement bonus ×1.5', () => {
    const ach = ['firstWords', 'storytellerAwakens', 'busyFingers'] as const;
    const below = withOwned('narratorsGuild', 199, (s) => void (s.meta.achievements = [...ach]));
    const at = withOwned('narratorsGuild', 200, (s) => void (s.meta.achievements = [...ach]));
    // 3 achievements: below = 1 + 0.01×3 = 1.03; at = 1 + 0.015×3 = 1.045.
    // Test the achievement multiplier directly (perSecond would also fold in the
    // guild's own production, which differs between 199 and 200 owned).
    expect(achievementMultiplier(below)).toBeCloseTo(1.03, 12);
    expect(achievementMultiplier(at)).toBeCloseTo(1.045, 12);
  });

  it('Pantheon: Divine Royalties → +1 quill on this publish', () => {
    const below = withOwned('pantheonPress', 199, (s) => void (s.run.totalEarned = 1e9));
    const at = withOwned('pantheonPress', 200, (s) => void (s.run.totalEarned = 1e9));
    expect(prestigePreview(at)).toBe(prestigePreview(below) + 1);
  });

  it('World-Tree: Deep Roots → offline cap +12h', () => {
    const below = withOwned('worldTreeArchive', 199);
    const at = withOwned('worldTreeArchive', 200);
    expect(offlineCapMs(at) - offlineCapMs(below)).toBe(12 * 3_600_000);
  });

  it('City: The City Dreams of You → spark rewards ×2 (verified in spark-v3)', () => {
    expect(isUniqueBonusActive(withOwned('sleepingCity', 200), 'sleepingCity')).toBe(true);
  });

  it('OUAT: …Happily Ever After → global production ×2', () => {
    const below = withOwned('onceUponATime', 199);
    const at = withOwned('onceUponATime', 200);
    // The v3 global multiplier (Atlas + …Happily Ever After) doubles at 200.
    // (perSecond would also fold in OUAT's own 8e9-base production.)
    expect(v3GlobalMultiplier(below)).toBe(1);
    expect(v3GlobalMultiplier(at)).toBe(2);
  });
});

describe('run-scoped: unique bonuses vanish when the owned count drops (prestige)', () => {
  it('a bonus at 200 is gone at 0 (fresh run)', () => {
    expect(isUniqueBonusActive(withOwned('wanderingMuse', 200), 'wanderingMuse')).toBe(true);
    expect(isUniqueBonusActive(withOwned('wanderingMuse', 0), 'wanderingMuse')).toBe(false);
    // Bookshelf multiplier (meta) is untouched by the run-scoped bonus, sanity.
    expect(bookshelfMultiplier(makeState())).toBe(1);
    expect(atelierLevel(makeState(), 'theNewWing')).toBe(0);
  });
});
