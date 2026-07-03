// progression-speed.test.ts — Agent 6: proves the prestige loop has REAL
// economic impact, using the engine's own functions end to end (applyAction,
// tick, cost/production selectors — no formulas re-derived here).
//
// Model (mirrors the 03 §9 semi-active player): 2 clicks/sec, buff activated
// as soon as it is available, greedy purchases — any affordable unlocked
// upgrade, plus the generator with the best payback (cost / marginal
// production), saving up for it otherwise. Fully deterministic (no RNG).
//
// The claim under test (01 §10.6 / 03 §6): a round with 3 Golden Quills
// reaches 100k totalEarned at least 20% faster than the 0-quill round 1.
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  canActivateBuff,
  costOf,
  GENERATORS,
  generatorProduction,
  hasUpgrade,
  isGeneratorRevealed,
  isUpgradeUnlocked,
  tick,
  UPGRADES,
} from '../../src/engine';
import type { GameState, GeneratorId } from '../../src/engine';
import { makeState } from './helpers';

const STEP_MS = 1_000;
const CAP_MS = 60 * 60_000; // hard stop so a regression cannot hang the suite
const TARGET = 100_000;

/** Production gained by owning one more unit of `id` (includes qty milestones, synergies). */
function marginalProd(state: GameState, id: GeneratorId): number {
  const plusOne: GameState = {
    ...state,
    run: {
      ...state.run,
      generators: { ...state.run.generators, [id]: state.run.generators[id] + 1 },
    },
  };
  return generatorProduction(plusOne, id) - generatorProduction(state, id);
}

/** Buy affordable unlocked upgrades + the best-payback generator (repeat until nothing bought). */
function greedyBuy(state: GameState, now: number): GameState {
  let s = state;
  for (;;) {
    let bought = false;
    for (const u of UPGRADES) {
      if (!hasUpgrade(s, u.id) && isUpgradeUnlocked(s, u.id) && s.run.inspiration >= u.cost) {
        s = applyAction(s, { type: 'buyUpgrade', id: u.id }, now);
        bought = true;
      }
    }
    // Target ONE generator — the best payback among revealed ones — and only
    // buy that one (otherwise keep saving for it, like a real player).
    let best: GeneratorId | null = null;
    let bestScore = Infinity;
    for (const g of GENERATORS) {
      if (!isGeneratorRevealed(s, g.id)) continue;
      const gain = marginalProd(s, g.id);
      if (gain <= 0) continue;
      const score = costOf(s, g.id) / gain;
      if (score < bestScore) {
        bestScore = score;
        best = g.id;
      }
    }
    if (best !== null && s.run.inspiration >= costOf(s, best)) {
      s = applyAction(s, { type: 'buyGenerator', id: best, qty: 1 }, now);
      bought = true;
    }
    if (!bought) return s;
  }
}

/**
 * Virtual ms until run totalEarned reaches 100k.
 * `tomesPublished` >= 1 also makes Quill Resonance purchasable — exactly the
 * situation of a real post-prestige round.
 */
function timeToTarget(goldenQuills: number, tomesPublished: number): number {
  let s = makeState((x) => {
    x.meta.goldenQuills = goldenQuills;
    x.meta.tomesPublished = tomesPublished;
  });
  let now = 0;
  while (s.run.totalEarned < TARGET && now < CAP_MS) {
    now += STEP_MS;
    if (canActivateBuff(s, now)) s = applyAction(s, { type: 'activateBuff' }, now);
    s = applyAction(s, { type: 'click' }, now);
    s = applyAction(s, { type: 'click' }, now);
    s = tick(s, now, STEP_MS);
    s = greedyBuy(s, now);
  }
  return now;
}

describe('prestige has real economic impact (round 2 vs round 1)', () => {
  // Observed (deterministic, 2026-07-03): t0 = 15.8 min, t3 = 9.8 min → −38%.
  // (Faster than the 03 §9 human model, 24m23s, because this sim never idles.)
  const t0 = timeToTarget(0, 0); // round 1: no quills, resonance locked
  const t3 = timeToTarget(3, 1); // post-prestige round: 3 quills (+90% production)

  it('round 1 reaches 100k totalEarned in a sane window (sim is a bit faster than a human)', () => {
    // 03 §9 clocked a comparable (slightly less efficient) player at 24m23s.
    // This greedy sim activates the buff instantly, so allow a wider band —
    // the point is: not degenerate-fast, not stalled.
    expect(t0).toBeGreaterThanOrEqual(8 * 60_000);
    expect(t0).toBeLessThanOrEqual(40 * 60_000);
  });

  it('with 3 quills the time to 100k drops by at least 20%', () => {
    expect(t3).toBeLessThan(CAP_MS); // actually finished
    expect(t3).toBeLessThanOrEqual(0.8 * t0);
  });
});
