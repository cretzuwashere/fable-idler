// tick.ts — the pure heart of the engine: (state, nowMs, dtMs) => state.
// Production is integrated LINEARLY over the covered interval [nowMs-dt, nowMs],
// splitting it exactly at the buff expiry boundary. This makes the result
// mathematically identical (up to float tolerance) whether the interval is
// processed as 10×100ms or 1×1000ms — the determinism invariant of 02 §2.2.
// Fractional production at small dt accumulates naturally (floats, no flooring).

import { BUFF, MAX_TICK_DT_MS } from './config';
import { checkAchievements } from './achievements';
import { checkMilestones } from './milestones';
import { perSecondNoBuff } from './selectors';
import type { GameState } from './types';

export function tick(state: GameState, nowMs: number, dtMs: number): GameState {
  // Clamp: negative dt (clock rollback) produces nothing; dt above 60s is
  // capped here — longer gaps are routed through the offline path by the shell.
  const dt = Math.min(Math.max(dtMs, 0), MAX_TICK_DT_MS);

  let next = state;
  if (dt > 0 || nowMs !== state.lastTickAt) {
    const intervalStart = nowMs - dt;
    // Portion of the interval during which the buff was active (exact overlap).
    const buffedMs = Math.min(Math.max(state.run.buff.activeUntil - intervalStart, 0), dt);
    const normalMs = dt - buffedMs;
    const base = perSecondNoBuff(state);
    const gained = (base * (normalMs + buffedMs * BUFF.prodMult)) / 1000;

    next = {
      ...state,
      lastTickAt: nowMs,
      run: {
        ...state.run,
        inspiration: state.run.inspiration + gained,
        totalEarned: state.run.totalEarned + gained,
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
