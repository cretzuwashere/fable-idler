// deep-shelves.test.ts — v3 Deep Shelves cost taper (14 §3).
// The growth flattens on bands of 100 (relative taper ×1/×0.8/×0.6/×0.45, floor
// 1.04). Units 1–101 keep the EXACT v1/v2 price (invariant §0.1). Band boundaries
// (100/101, 200/201, 300/301) are classic off-by-one sites — every literal here
// is INDEPENDENTLY hand-computed in Node (scratchpad), never read back from the
// engine's own output.
import { describe, expect, it } from 'vitest';
import { bandGrowth, bulkCost, costOf, DEEP_SHELVES } from '../../src/engine';
import { makeState } from './helpers';

/** costOf for Wandering Muse at a given owned count (g0=1.15, base=15). */
function museCostAt(owned: number): number {
  return costOf(makeState((s) => void (s.run.generators.wanderingMuse = owned)), 'wanderingMuse');
}
function museBulk(owned: number, k: number): number {
  return bulkCost(makeState((s) => void (s.run.generators.wanderingMuse = owned)), 'wanderingMuse', k);
}

describe('bandGrowth — relative taper on (growth − 1), floor 1.04', () => {
  it('Wandering Muse g0=1.15 → 1.15 / 1.12 / 1.09 / 1.0675', () => {
    expect(bandGrowth(1.15, 0)).toBeCloseTo(1.15, 12);
    expect(bandGrowth(1.15, 1)).toBeCloseTo(1.12, 12);
    expect(bandGrowth(1.15, 2)).toBeCloseTo(1.09, 12);
    expect(bandGrowth(1.15, 3)).toBeCloseTo(1.0675, 12);
  });

  it('World-Tree g0=1.10 → 1.10 / 1.08 / 1.06 / 1.045 (14 §3 table)', () => {
    expect(bandGrowth(1.1, 0)).toBeCloseTo(1.1, 12);
    expect(bandGrowth(1.1, 1)).toBeCloseTo(1.08, 12);
    expect(bandGrowth(1.1, 2)).toBeCloseTo(1.06, 12);
    expect(bandGrowth(1.1, 3)).toBeCloseTo(1.045, 12);
  });

  it('floors at 1.04 (never a flat/free band)', () => {
    // A hypothetically tiny growth would floor; 1.045 for World-Tree band3 is the
    // lowest real value and still > floor, so the floor only bites below it.
    expect(bandGrowth(1.04, 3)).toBe(DEEP_SHELVES.floor); // 1 + 0.04*0.45 = 1.018 < 1.04
    expect(bandGrowth(1.1, 3)).toBeGreaterThan(DEEP_SHELVES.floor);
  });
});

describe('costOf — units 1..101 keep the EXACT v1 price (invariant §0.1)', () => {
  it('index 0..100 identical to ceil(base × g0^owned)', () => {
    const base = 15;
    const g0 = 1.15;
    for (const owned of [0, 1, 24, 49, 50, 99, 100]) {
      const v1 = Math.ceil(base * Math.pow(g0, owned));
      expect(museCostAt(owned)).toBe(v1);
    }
  });

  it('the 101st unit (owned=100) is still full-growth priced', () => {
    // owned=100 is the LAST band-0 unit (band boundary is exclusive at 100 units
    // bought = index 100 is band 1). Hand-computed: ceil(15 × 1.15^100).
    expect(museCostAt(100)).toBe(17614702);
  });
});

describe('costOf — reduced growth from unit 101 (owned index 100) onward', () => {
  it('boundary unit prices match the hand-computed values', () => {
    // Independently computed in Node (scratchpad/deepshelves-calc.mjs):
    expect(museCostAt(99)).toBe(15317132); // last band-0 unit
    expect(museCostAt(100)).toBe(17614702); // first band-1 growth applies going forward
    expect(museCostAt(101)).toBe(19728466); // 15 × 1.15^100 × 1.12^1
    expect(museCostAt(199)).toBe(1313589108156);
    expect(museCostAt(200)).toBe(1471219801135);
    expect(museCostAt(299)).toBe(7462783756159993);
    expect(museCostAt(300)).toBe(8134434294214391);
  });
});

describe('bulkCost — geometric sum PER BAND, one ceil on the total', () => {
  it('a single unit equals costOf at the same owned count', () => {
    expect(museBulk(100, 1)).toBe(museCostAt(100));
    expect(museBulk(200, 1)).toBe(museCostAt(200));
    expect(museBulk(300, 1)).toBe(museCostAt(300));
  });

  it('a bulk fully inside band 0 equals the v1 geometric formula', () => {
    const base = 15;
    const g0 = 1.15;
    const v1geo = Math.ceil(base * ((Math.pow(g0, 5) - 1) / (g0 - 1)));
    expect(museBulk(0, 5)).toBe(v1geo); // 102
    expect(museBulk(0, 5)).toBe(102);
  });

  it('a bulk crossing the 100/101 boundary sums each band correctly', () => {
    // owned=99, k=2 → units at index 99 (band0) and 100 (band1 growth going in).
    expect(museBulk(99, 2)).toBe(32931834); // = ceil(P(99) + P(100))
    // owned=99, k=3 → indexes 99, 100, 101.
    expect(museBulk(99, 3)).toBe(52660300);
  });

  it('a bulk crossing the 200/201 boundary', () => {
    // owned=199, k=3 → indexes 199 (band1), 200, 201 (band2).
    expect(museBulk(199, 3)).toBe(4388438492527);
  });

  it('a bulk crossing the 300/301 boundary', () => {
    // owned=299, k=3 → indexes 299 (band2), 300, 301 (band3).
    expect(museBulk(299, 3)).toBe(24280726659448252);
  });

  it('bulk = sum of individual costOf across a band boundary (no double ceil drift)', () => {
    // Building the SAME 3 units one at a time and buying them in bulk differ only
    // by rounding: the single ceil on the bulk total is ≤ the sum of per-unit ceils.
    const owned = 199;
    const s = makeState((x) => void (x.run.generators.wanderingMuse = owned));
    const perUnitSum =
      costOf(s, 'wanderingMuse') +
      costOf(makeState((x) => void (x.run.generators.wanderingMuse = owned + 1)), 'wanderingMuse') +
      costOf(makeState((x) => void (x.run.generators.wanderingMuse = owned + 2)), 'wanderingMuse');
    expect(museBulk(owned, 3)).toBeLessThanOrEqual(perUnitSum);
    // And it is within (number of units) of the per-unit sum (each ceil ≤ +1).
    expect(perUnitSum - museBulk(owned, 3)).toBeLessThanOrEqual(3);
  });
});

describe('Patron Favor and Conspiracy of Ravens discounts apply after the bands', () => {
  it("Patron's Favor multiplies the whole band-priced cost by 0.95", () => {
    const plain = museCostAt(150);
    const discounted = costOf(
      makeState((s) => {
        s.run.generators.wanderingMuse = 150;
        s.run.upgrades.patronsFavor = true;
      }),
      'wanderingMuse',
    );
    // ceil(rawPrice × 0.95) — recompute against the un-discounted raw.
    expect(discounted).toBeLessThan(plain);
    expect(discounted).toBeGreaterThan(plain * 0.94);
  });

  it('Conspiracy of Ravens (Raven unique at 200) applies ×0.97 to costs', () => {
    // With 200 ravens the Raven unique cost bonus is active; another generator's
    // cost drops by 3% (multiplicative with Patron's Favor). Wandering Muse at
    // owned=10 has raw price 15 × 1.15^10; verify the exact ceil against 0.97.
    const rawMuse10 = 15 * Math.pow(1.15, 10);
    const withRaven = costOf(
      makeState((s) => {
        s.run.generators.wanderingMuse = 10;
        s.run.generators.talkingRaven = 200; // unique bonus active
      }),
      'wanderingMuse',
    );
    expect(withRaven).toBe(Math.ceil(rawMuse10 * 0.97));
  });
});
