// generators.ts — cost formulas (03 §1) + buy x1/x10/xMax.
//
// cost(gen)        = ceil(baseCost * growth^owned * patronDiscount)
// bulkCost(gen, k) = ceil(baseCost * growth^owned * (growth^k - 1)/(growth - 1) * patronDiscount)
//   (geometric sum; a single ceil on the total, per 03 §1)

import { GENERATOR_INDEX, PATRONS_FAVOR_DISCOUNT } from './config';
import type { BuyQty, GameState, GeneratorId } from './types';

function patronDiscount(state: GameState): number {
  return state.run.upgrades.patronsFavor ? PATRONS_FAVOR_DISCOUNT : 1;
}

/** Cost of the NEXT unit of a generator. */
export function costOf(state: GameState, id: GeneratorId): number {
  const cfg = GENERATOR_INDEX[id];
  const owned = state.run.generators[id];
  return Math.ceil(cfg.baseCost * Math.pow(cfg.growth, owned) * patronDiscount(state));
}

/** Total cost of the next k units bought at once (k >= 1). */
export function bulkCost(state: GameState, id: GeneratorId, k: number): number {
  if (k <= 0) return 0;
  const cfg = GENERATOR_INDEX[id];
  const owned = state.run.generators[id];
  const raw =
    cfg.baseCost *
    Math.pow(cfg.growth, owned) *
    ((Math.pow(cfg.growth, k) - 1) / (cfg.growth - 1)) *
    patronDiscount(state);
  return Math.ceil(raw);
}

/** Largest k such that bulkCost(state, id, k) <= current balance. */
export function maxAffordable(state: GameState, id: GeneratorId): number {
  const budget = state.run.inspiration;
  if (budget < costOf(state, id)) return 0;
  const cfg = GENERATOR_INDEX[id];
  const owned = state.run.generators[id];
  const unit = cfg.baseCost * Math.pow(cfg.growth, owned) * patronDiscount(state);
  // Closed-form estimate from the geometric sum, then fix up around ceil().
  let k = Math.floor(Math.log((budget / unit) * (cfg.growth - 1) + 1) / Math.log(cfg.growth));
  if (k < 1) k = 1;
  while (bulkCost(state, id, k + 1) <= budget) k++;
  while (k > 1 && bulkCost(state, id, k) > budget) k--;
  return k;
}

/** Sum of all owned generators, any type. */
export function totalGeneratorCount(state: GameState): number {
  let total = 0;
  for (const count of Object.values(state.run.generators)) total += count;
  return total;
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
