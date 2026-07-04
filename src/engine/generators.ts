// generators.ts — cost formulas (03 §1 + v3 Deep Shelves 14 §3) + buy x1/x10/xMax.
//
// v1/v2 cost(gen)  = ceil(baseCost * growth^owned * discounts)
// v3 Deep Shelves: the growth flattens on bands of 100 units (14 §3). Units
// 1–101 keep the EXACT v1/v2 price (band 0 growth = g0); only from unit 101 on
// do the reduced band growths kick in — so runs 1's ≤50-unit stacks are untouched
// (invariant §0.1). The price of the unit at 0-based index `owned` is:
//   base * g0^min(owned,100) * g1^clamp(owned-100,0,100)
//        * g2^clamp(owned-200,0,100) * g3^max(owned-300,0)
// Bulk = a geometric sum PER BAND (each band is geometric with its own ratio),
// with a SINGLE ceil on the grand total (03 §1 rule preserved).

import {
  DEEP_SHELVES,
  GENERATOR_IDS,
  GENERATOR_INDEX,
  PATRONS_FAVOR_DISCOUNT,
  UNIQUE_BONUSES,
} from './config';
import { isUniqueBonusActive } from './unique-bonuses';
import type { BuyQty, GameState, GeneratorId } from './types';

/** Effective growth ratio of band b (0..3) for a generator with base growth g0. */
export function bandGrowth(g0: number, b: number): number {
  const rel = DEEP_SHELVES.taperRel[b];
  return Math.max(1 + (g0 - 1) * rel, DEEP_SHELVES.floor);
}

/** Band index (0..3) for the unit at 0-based `owned` (300+ all in band 3). */
function bandOf(owned: number): number {
  const b = Math.floor(owned / DEEP_SHELVES.bandSize);
  return b >= 3 ? 3 : b;
}

/** Units left in the current band starting at `owned` (band 3 is unbounded). */
function unitsLeftInBand(owned: number): number {
  const b = bandOf(owned);
  if (b >= 3) return Infinity;
  return (b + 1) * DEEP_SHELVES.bandSize - owned;
}

/** Raw (pre-discount, pre-ceil) price of the unit at 0-based index `owned`. */
function unitPriceRaw(g0: number, baseCost: number, owned: number): number {
  const band = DEEP_SHELVES.bandSize;
  const e0 = Math.min(owned, band);
  const e1 = Math.min(Math.max(owned - band, 0), band);
  const e2 = Math.min(Math.max(owned - 2 * band, 0), band);
  const e3 = Math.max(owned - 3 * band, 0);
  return (
    baseCost *
    Math.pow(g0, e0) *
    Math.pow(bandGrowth(g0, 1), e1) *
    Math.pow(bandGrowth(g0, 2), e2) *
    Math.pow(bandGrowth(g0, 3), e3)
  );
}

/** Combined non-band cost multiplier: Patron's Favor (×0.95) and the Conspiracy
 *  of Ravens unique bonus (×0.97, multiplicative — 14 §4.2). */
function costMultiplier(state: GameState): number {
  let mult = state.run.upgrades.patronsFavor ? PATRONS_FAVOR_DISCOUNT : 1;
  const ravenBonus = UNIQUE_BONUSES.talkingRaven;
  if (ravenBonus?.costMult !== undefined && isUniqueBonusActive(state, 'talkingRaven')) {
    mult *= ravenBonus.costMult;
  }
  return mult;
}

/** Cost of the NEXT unit of a generator. */
export function costOf(state: GameState, id: GeneratorId): number {
  const cfg = GENERATOR_INDEX[id];
  const owned = state.run.generators[id];
  return Math.ceil(unitPriceRaw(cfg.growth, cfg.baseCost, owned) * costMultiplier(state));
}

/** Total cost of the next k units bought at once (k >= 1) — band-piecewise. */
export function bulkCost(state: GameState, id: GeneratorId, k: number): number {
  if (k <= 0) return 0;
  const cfg = GENERATOR_INDEX[id];
  let owned = state.run.generators[id];
  let remaining = k;
  let total = 0;
  let guard = 0;
  while (remaining > 0 && guard++ < 8) {
    const g = bandGrowth(cfg.growth, bandOf(owned));
    const n = Math.min(remaining, unitsLeftInBand(owned));
    const p0 = unitPriceRaw(cfg.growth, cfg.baseCost, owned); // price of the first unit in this tranche
    // Geometric sum of n terms with ratio g (g > 1 always: floor 1.04).
    total += p0 * ((Math.pow(g, n) - 1) / (g - 1));
    owned += n;
    remaining -= n;
  }
  return Math.ceil(total * costMultiplier(state));
}

/** Largest k such that bulkCost(state, id, k) <= current balance. */
export function maxAffordable(state: GameState, id: GeneratorId): number {
  const budget = state.run.inspiration;
  if (budget < costOf(state, id)) return 0;
  // Bulk cost is monotonically increasing in k; the taper only ever LOWERS
  // prices, so an exponential-then-binary search stays cheap and exact.
  let hi = 1;
  while (bulkCost(state, id, hi) <= budget) hi *= 2;
  let lo = Math.floor(hi / 2);
  // Invariant: bulkCost(lo) <= budget < bulkCost(hi).
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (bulkCost(state, id, mid) <= budget) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Sum of all owned generators, any type. */
export function totalGeneratorCount(state: GameState): number {
  let total = 0;
  for (const count of Object.values(state.run.generators)) total += count;
  return total;
}

/**
 * The best-payback generator to auto-buy right now (Clockwork Understudy, 13
 * §4.1 #12): among generators currently visible in the shop whose next unit costs
 * at most `maxCost`, the one with the LOWEST cost / marginal-production ratio
 * (fastest payback). Deterministic tie-break: config (tier) order. Returns null
 * when nothing qualifies. Imported lazily to avoid a selectors↔generators cycle.
 */
export function bestPaybackGenerator(
  state: GameState,
  maxCost: number,
  isVisible: (state: GameState, id: GeneratorId) => boolean,
  marginalProduction: (state: GameState, id: GeneratorId) => number,
): GeneratorId | null {
  let best: GeneratorId | null = null;
  let bestRatio = Infinity;
  for (const id of GENERATOR_IDS) {
    if (!isVisible(state, id)) continue;
    const cost = costOf(state, id);
    if (cost > maxCost) continue;
    const marginal = marginalProduction(state, id);
    if (!(marginal > 0)) continue;
    const ratio = cost / marginal; // lower = pays for itself faster
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = id;
    }
  }
  return best;
}

/** Generator visible in the shop at revealAt run totalEarned (01 §4). */
export function isGeneratorRevealed(state: GameState, id: GeneratorId): boolean {
  return state.run.totalEarned >= GENERATOR_INDEX[id].revealAt;
}

/**
 * Buy generators. qty 1|10 requires the FULL amount to be affordable (else no-op);
 * qty 'max' buys exactly as many as the budget allows (0 → no-op).
 * Returns the same state reference when nothing was bought.
 */
export function buyGenerator(state: GameState, id: GeneratorId, qty: BuyQty): GameState {
  const count = qty === 'max' ? maxAffordable(state, id) : qty;
  if (count <= 0) return state;
  const cost = bulkCost(state, id, count);
  if (cost > state.run.inspiration) return state;
  return {
    ...state,
    run: {
      ...state.run,
      inspiration: state.run.inspiration - cost,
      generators: { ...state.run.generators, [id]: state.run.generators[id] + count },
    },
  };
}
