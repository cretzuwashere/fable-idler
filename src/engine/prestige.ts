// prestige.ts — Publish the Tome (03 §6).
// quills = floor(sqrt(totalEarnedThisRun / 1e5)); threshold 100k.
// RESETS:  the whole run state (inspiration, totalEarned, generators,
//          upgrades 1–10, milestones incl. quantity thresholds, buff timers).
// PERSISTS: goldenQuills (added to), tomesPublished (+1), achievements,
//          quillResonance, lifetime stats, settings (01 §7 / 03 §6).

import { PRESTIGE_DIVISOR, PRESTIGE_MIN_TOTAL_EARNED } from './config';
import { createInitialRunState } from './state';
import type { GameState } from './types';

/** Golden Quills granted for a given run totalEarned. */
export function quillsForTotalEarned(totalEarned: number): number {
  if (!(totalEarned > 0)) return 0;
  return Math.floor(Math.sqrt(totalEarned / PRESTIGE_DIVISOR));
}

/** Quills the player would receive by publishing right now. */
export function prestigePreview(state: GameState): number {
  return quillsForTotalEarned(state.run.totalEarned);
}

export function canPrestige(state: GameState): boolean {
  return state.run.totalEarned >= PRESTIGE_MIN_TOTAL_EARNED;
}

/**
 * Perform the prestige. No-op (same reference) below the threshold —
 * the UI owns the confirmation dialog, the engine only validates.
 */
export function publishTheTome(state: GameState, now: number): GameState {
  if (!canPrestige(state)) return state;
  const earned = quillsForTotalEarned(state.run.totalEarned);
  return {
    run: createInitialRunState(),
    meta: {
      ...state.meta,
      goldenQuills: state.meta.goldenQuills + earned,
      tomesPublished: state.meta.tomesPublished + 1,
    },
    lastTickAt: now,
  };
}
