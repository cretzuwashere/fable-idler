import { describe, expect, it } from 'vitest';
import {
  buyGenerator,
  bulkCost,
  costOf,
  isGeneratorRevealed,
  maxAffordable,
  totalGeneratorCount,
} from '../../src/engine';
import { makeState } from './helpers';

describe('cost formula: ceil(baseCost * growth^owned)', () => {
  it('first unit costs the base cost', () => {
    const s = makeState();
    expect(costOf(s, 'wanderingMuse')).toBe(15);
    expect(costOf(s, 'inkSprite')).toBe(100);
    expect(costOf(s, 'talkingRaven')).toBe(1_100);
    expect(costOf(s, 'enchantedQuill')).toBe(12_000);
    expect(costOf(s, 'storyLoom')).toBe(130_000);
    expect(costOf(s, 'dreamLibrary')).toBe(1_400_000);
    expect(costOf(s, 'fableForge')).toBe(20_000_000);
  });

  it('grows by the per-generator growth factor with ceil', () => {
    const s1 = makeState((s) => void (s.run.generators.wanderingMuse = 1));
    const s2 = makeState((s) => void (s.run.generators.wanderingMuse = 2));
    expect(costOf(s1, 'wanderingMuse')).toBe(18); // ceil(15 * 1.15)   = ceil(17.25)
    expect(costOf(s2, 'wanderingMuse')).toBe(20); // ceil(15 * 1.15²)  = ceil(19.84)
  });

  it('matches 03 §1 at unit #25 (owned = 24) for every generator', () => {
    const at24 = (id: Parameters<typeof costOf>[1]) =>
      costOf(makeState((s) => void (s.run.generators[id] = 24)), id);
    expect(at24('wanderingMuse')).toBe(430);
    expect(at24('inkSprite')).toBe(2_863);
    expect(at24('talkingRaven')).toBe(25_534);
    expect(at24('enchantedQuill')).toBe(225_458);
    expect(at24('storyLoom')).toBe(2_442_452);
    expect(at24('dreamLibrary')).toBe(21_250_081);
    expect(at24('fableForge')).toBe(303_572_579);
  });
});

describe("Patron's Favor (−5% on generator costs)", () => {
  it('discounts single-unit cost, ceil applied after discount', () => {
    const s = makeState((x) => void (x.run.upgrades.patronsFavor = true));
    expect(costOf(s, 'inkSprite')).toBe(95); // 100 * 0.95
    expect(costOf(s, 'wanderingMuse')).toBe(15); // ceil(14.25)
  });

  it('discounts bulk cost (single ceil on the discounted total)', () => {
    const plain = makeState();
    const patron = makeState((x) => void (x.run.upgrades.patronsFavor = true));
    expect(bulkCost(plain, 'inkSprite', 10)).toBe(2_031);
    expect(bulkCost(patron, 'inkSprite', 10)).toBe(1_929);
  });
});

describe('buying', () => {
  it('x1 deducts the cost and increments the count', () => {
    const s = makeState((x) => void (x.run.inspiration = 100));
    const after = buyGenerator(s, 'wanderingMuse', 1);
    expect(after.run.inspiration).toBe(85);
    expect(after.run.generators.wanderingMuse).toBe(1);
    expect(after.run.totalEarned).toBe(0); // spending never touches totalEarned
  });

  it('refuses with insufficient balance (same state reference)', () => {
    const s = makeState((x) => void (x.run.inspiration = 14));
    expect(buyGenerator(s, 'wanderingMuse', 1)).toBe(s);
  });

  it('x10 uses the geometric-sum bulk cost (305 for the first 10 Muses)', () => {
    const s = makeState((x) => void (x.run.inspiration = 305));
    expect(bulkCost(s, 'wanderingMuse', 10)).toBe(305);
    const after = buyGenerator(s, 'wanderingMuse', 10);
    expect(after.run.generators.wanderingMuse).toBe(10);
    expect(after.run.inspiration).toBe(0);
  });

  it('x10 is all-or-nothing: one short of the bulk cost buys nothing', () => {
    const s = makeState((x) => void (x.run.inspiration = 304));
    expect(buyGenerator(s, 'wanderingMuse', 10)).toBe(s);
  });

  it('bulk cost starts from the current owned count', () => {
    const s = makeState((x) => void (x.run.generators.wanderingMuse = 3));
    expect(bulkCost(s, 'wanderingMuse', 5)).toBe(154); // ceil(15·1.15³·(1.15⁵−1)/0.15)
  });
});

describe('xMax buys exactly what the budget allows', () => {
  it('budget of exactly bulkCost(k) buys exactly k', () => {
    const base = makeState();
    const budget = bulkCost(base, 'wanderingMuse', 7);
    const s = makeState((x) => void (x.run.inspiration = budget));
    expect(maxAffordable(s, 'wanderingMuse')).toBe(7);
    const after = buyGenerator(s, 'wanderingMuse', 'max');
    expect(after.run.generators.wanderingMuse).toBe(7);
    expect(after.run.inspiration).toBe(budget - bulkCost(base, 'wanderingMuse', 7));
  });

  it('one below bulkCost(k) buys k−1', () => {
    const base = makeState();
    const budget = bulkCost(base, 'wanderingMuse', 7) - 1;
    const s = makeState((x) => void (x.run.inspiration = budget));
    expect(maxAffordable(s, 'wanderingMuse')).toBe(6);
  });

  it('never overshoots: bulkCost(max) <= budget < bulkCost(max+1) across budgets', () => {
    for (const budget of [15, 33, 100, 305, 1_000, 12_345, 999_999]) {
      const s = makeState((x) => void (x.run.inspiration = budget));
      const k = maxAffordable(s, 'wanderingMuse');
      expect(k).toBeGreaterThan(0);
      expect(bulkCost(s, 'wanderingMuse', k)).toBeLessThanOrEqual(budget);
      expect(bulkCost(s, 'wanderingMuse', k + 1)).toBeGreaterThan(budget);
    }
  });

  it('xMax with nothing affordable is a no-op (same reference)', () => {
    const s = makeState((x) => void (x.run.inspiration = 14));
    expect(maxAffordable(s, 'wanderingMuse')).toBe(0);
    expect(buyGenerator(s, 'wanderingMuse', 'max')).toBe(s);
  });

  it('handles a large budget exactly (budget = bulkCost(50))', () => {
    const base = makeState();
    const budget = bulkCost(base, 'inkSprite', 50);
    const s = makeState((x) => void (x.run.inspiration = budget));
    expect(maxAffordable(s, 'inkSprite')).toBe(50);
  });
});

describe('reveal + counting helpers', () => {
  it('generators reveal at their 03 §1 totalEarned thresholds', () => {
    const hidden = makeState((x) => void (x.run.totalEarned = 9));
    expect(isGeneratorRevealed(hidden, 'wanderingMuse')).toBe(false);
    const shown = makeState((x) => void (x.run.totalEarned = 10));
    expect(isGeneratorRevealed(shown, 'wanderingMuse')).toBe(true);
    const mid = makeState((x) => void (x.run.totalEarned = 600));
    expect(isGeneratorRevealed(mid, 'talkingRaven')).toBe(true);
    expect(isGeneratorRevealed(mid, 'enchantedQuill')).toBe(false);
  });

  it('totalGeneratorCount sums across all types', () => {
    const s = makeState((x) => {
      x.run.generators.wanderingMuse = 3;
      x.run.generators.inkSprite = 2;
      x.run.generators.fableForge = 1;
    });
    expect(totalGeneratorCount(s)).toBe(6);
  });
});
