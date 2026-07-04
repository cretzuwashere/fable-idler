// offline.ts — pure offline progress computation (03 §8, extended by v2).
// gain = perSecondNoBuff(at save time) × min(elapsed, cap) × efficiency
// efficiency 0.5 / cap 8h; Lucid Dreaming → 0.75 / 12h;
// v2: Night Owl Pact adds +12h to the cap (8h→20h / 12h→24h) and The Reader's
// Letter relic adds +10pp efficiency (0.5→0.6 / 0.75→0.85) — both via selectors.
// Neither the buff NOR spark buffs ever contribute offline (perSecondNoBuff).
// Both savedAt and now are explicit parameters — no Date.now() in here.

import { OFFLINE } from './config';
import { checkAchievements } from './achievements';
import { checkMilestones } from './milestones';
import { offlineCapMs, offlineEfficiency, perSecondNoBuff } from './selectors';
import type { GameState } from './types';

export interface OfflineReport {
  /** Real elapsed ms since save, clamped to >= 0 (clock-rollback protection). */
  elapsedMs: number;
  /** Elapsed ms actually paid out (after the 8h/12h cap). */
  cappedMs: number;
  /** 0.5, or 0.75 with Lucid Dreaming. */
  efficiency: number;
  /** Inspiration gained. */
  gained: number;
}

export function computeOfflineReport(
  state: GameState,
  savedAt: number,
  now: number,
): OfflineReport {
  const elapsedMs = Math.max(0, now - savedAt);
  const capMs = offlineCapMs(state);
  const efficiency = offlineEfficiency(state);
  const cappedMs = Math.min(elapsedMs, capMs);
  const gained = perSecondNoBuff(state) * (cappedMs / 1000) * efficiency;
  return { elapsedMs, cappedMs, efficiency, gained };
}

/**
 * Apply an offline report to the state: credit the gain (balance, run totalEarned
 * and lifetime stats), update offline stats (Night Shift / Lucid Dreaming unlock),
 * anchor lastTickAt at `now`, then re-check milestones and achievements.
 */
export function applyOfflineReport(
  state: GameState,
  report: OfflineReport,
  now: number,
): GameState {
  const longSession = report.elapsedMs >= OFFLINE.longSessionMs;
  let next: GameState = {
    ...state,
    lastTickAt: now,
    run: {
      ...state.run,
      inspiration: state.run.inspiration + report.gained,
      totalEarned: state.run.totalEarned + report.gained,
    },
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        lifetimeInspiration: state.meta.stats.lifetimeInspiration + report.gained,
        offlineSessionsOver30Min:
          state.meta.stats.offlineSessionsOver30Min + (longSession ? 1 : 0),
        bestSingleOfflineGain: Math.max(
          state.meta.stats.bestSingleOfflineGain,
          report.gained,
        ),
      },
    },
  };
  next = checkMilestones(next);
  next = checkAchievements(next, now);
  return next;
}
