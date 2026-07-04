// tick.ts — the pure heart of the engine: (state, nowMs, dtMs) => state.
// Production is integrated piecewise-LINEARLY over the covered interval
// [nowMs-dt, nowMs], splitting it exactly at every rate-changing boundary:
//   - the Moment of Inspiration expiry (v1),
//   - the Gossip Bonanza spark-buff expiry (v2),
//   - each ABSOLUTE whole second when the Self-Writing Contract auto-buy is
//     active (v2) — purchases are evaluated only at epoch-aligned seconds, so
//     the walk is INDEPENDENT of how the interval is chopped into ticks.
// This keeps the v1 determinism invariant (10×100ms ≡ 1×1000ms, 02 §2.2) with
// auto-buy enabled. Fractional production accumulates naturally (no flooring).

import { MAX_TICK_DT_MS, SELF_WRITING_CONTRACT } from './config';
import { atelierLevel } from './atelier';
import { checkAchievements } from './achievements';
import { checkMilestones } from './milestones';
import { costOf } from './generators';
import { globalMultiplier, rawProduction } from './selectors';
import type { GameState } from './types';

export function tick(state: GameState, nowMs: number, dtMs: number): GameState {
  // Clamp: negative dt (clock rollback) produces nothing; dt above 60s is
  // capped here — longer gaps are routed through the offline path by the shell.
  const dt = Math.min(Math.max(dtMs, 0), MAX_TICK_DT_MS);

  let next = state;
  if (dt > 0 || nowMs !== state.lastTickAt) {
    const start = nowMs - dt;
    const buffUntil = state.run.buff.activeUntil;
    const spark = state.run.sparkBuff;
    const gossipUntil = spark !== null && spark.kind === 'gossipBonanza' ? spark.activeUntil : 0;
    const autoBuyOn = atelierLevel(state, 'selfWritingContract') >= 1;

    let generators = state.run.generators;
    let inspiration = state.run.inspiration;
    let lastAutoBuyAt = state.run.lastAutoBuyAt;
    let gained = 0; // production only — auto-buy SPENDING never touches totalEarned
    // Probe state for cost/production selectors; replaced copy-on-write when
    // an auto-buy changes the generator counts (rates react immediately).
    let probe: GameState = state;

    let t = start;
    let guard = 0;
    while (t < nowMs && guard++ < 100_000) {
      // Next boundary after t: buff expiry, gossip expiry, whole second (auto-buy).
      let tNext = nowMs;
      if (buffUntil > t && buffUntil < tNext) tNext = buffUntil;
      if (gossipUntil > t && gossipUntil < tNext) tNext = gossipUntil;
      let autoBuyBoundary = false;
      if (autoBuyOn) {
        const nextSecond = (Math.floor(t / 1000) + 1) * 1000;
        if (nextSecond < tNext) {
          tNext = nextSecond;
          autoBuyBoundary = true;
        } else if (nextSecond === tNext) {
          autoBuyBoundary = true;
        }
      }

      const segMs = tNext - t;
      if (segMs > 0) {
        const rate =
          rawProduction(probe, t < gossipUntil) * globalMultiplier(probe, t < buffUntil);
        const add = (rate * segMs) / 1000;
        gained += add;
        inspiration += add;
      }
      t = tNext;

      // Self-Writing Contract: at most 1 Wandering Muse per second, only while
      // her cost is ≤ 1% of the balance (never drains the purse — 11 §2).
      if (
        autoBuyBoundary &&
        t - lastAutoBuyAt >= SELF_WRITING_CONTRACT.autoBuyIntervalMs
      ) {
        const cost = costOf(probe, 'wanderingMuse');
        if (cost <= SELF_WRITING_CONTRACT.autoBuyMaxCostFraction * inspiration) {
          inspiration -= cost;
          generators = { ...generators, wanderingMuse: generators.wanderingMuse + 1 };
          lastAutoBuyAt = t;
          probe = { ...state, run: { ...state.run, generators } };
        }
      }
    }

    next = {
      ...state,
      lastTickAt: nowMs,
      run: {
        ...state.run,
        inspiration,
        totalEarned: state.run.totalEarned + gained,
        generators,
        lastAutoBuyAt,
        // Spark buffs expire in tick (state hygiene; selectors are time-guarded anyway).
        sparkBuff: spark !== null && nowMs >= spark.activeUntil ? null : spark,
      },
      meta: {
        ...state.meta,
        stats: {
          ...state.meta.stats,
          lifetimeInspiration: state.meta.stats.lifetimeInspiration + gained,
        },
      },
    };
  }

  next = checkMilestones(next);
  next = checkAchievements(next, nowMs);
  return next;
}
