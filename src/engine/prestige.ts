// prestige.ts — Publish the Tome (03 §6, extended by v2 per 10 §3.5).
// quills = floor(sqrt(totalEarnedThisRun / 1e5)) + Editor's Due bonus; threshold 100k.
// RESETS:  the whole run state (inspiration, totalEarned, generators,
//          upgrades 1–10 minus the Second Bookmark keepers, milestones,
//          buff timers, spark buff, per-run counters).
// PERSISTS: goldenQuills wallet (added to) AND lifetimeQuillsEarned (added to —
//          GOLDEN RULE), tomesPublished (+1), fables (+1), achievements,
//          quillResonance, atelier, storyFragments, lifetime stats, settings.
// v2 run construction: Second Bookmark keepers, Apprentice Muse head-start,
// Dog-Eared Page 300 Inspiration (into balance AND totalEarned), startedAt = now.

import {
  DOG_EARED_PAGE_START_INSPIRATION,
  EDITORS_DUE_BONUS_QUILLS,
  PRESTIGE_DIVISOR,
  PRESTIGE_MIN_TOTAL_EARNED,
  RELIC_INDEX,
} from './config';
import { apprenticeStartMuses, atelierLevel, bookmarkedUpgrades } from './atelier';
import { createFable } from './fables';
import { createInitialRunState } from './state';
import type { GameState } from './types';

/** Golden Quills granted for a given run totalEarned (base formula, no bonuses). */
export function quillsForTotalEarned(totalEarned: number): number {
  if (!(totalEarned > 0)) return 0;
  return Math.floor(Math.sqrt(totalEarned / PRESTIGE_DIVISOR));
}

/** Quills the player would receive by publishing right now (incl. Editor's Due). */
export function prestigePreview(state: GameState): number {
  const bonus = atelierLevel(state, 'editorsDue') >= 1 ? EDITORS_DUE_BONUS_QUILLS : 0;
  return quillsForTotalEarned(state.run.totalEarned) + bonus;
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

  const earned = prestigePreview(state);
  // Fastest Publish: only runs with a known start count (startedAt = 0 is the
  // v1→v2 migration sentinel — deviation A5 in 10 §0).
  const durationMs = state.run.startedAt > 0 ? Math.max(0, now - state.run.startedAt) : null;
  const prevFastest = state.meta.stats.fastestPublishMs;
  const fastestPublishMs =
    durationMs === null
      ? prevFastest
      : prevFastest === null
        ? durationMs
        : Math.min(prevFastest, durationMs);

  const tomeNumber = state.meta.tomesPublished + 1;
  const fable = createFable(tomeNumber, state.run.totalEarned, durationMs, earned, now);

  // Fresh run + the permanent head-starts (evaluated on the NEW tome count for
  // relics — publishing tome #3 unlocks Dog-Eared Page for the run it opens).
  const run = createInitialRunState(now);
  run.upgrades = bookmarkedUpgrades(state); // Second Bookmark (cheapest K by config cost)
  run.generators = {
    ...run.generators,
    wanderingMuse: apprenticeStartMuses(state), // Apprentice Muse (free, not earnings)
  };
  if (tomeNumber >= RELIC_INDEX.dogEaredPage.tomes) {
    // Both balance AND totalEarned — keeps the balance ≤ totalEarned invariant;
    // reveal milestones under 300 re-add at the first checkMilestones (intended).
    run.inspiration = DOG_EARED_PAGE_START_INSPIRATION;
    run.totalEarned = DOG_EARED_PAGE_START_INSPIRATION;
  }

  return {
    run,
    meta: {
      ...state.meta,
      // GOLDEN RULE: the publish pays into the wallet AND the lifetime total.
      goldenQuills: state.meta.goldenQuills + earned,
      tomesPublished: tomeNumber,
      fables: [...state.meta.fables, fable],
      stats: {
        ...state.meta.stats,
        lifetimeQuillsEarned: state.meta.stats.lifetimeQuillsEarned + earned,
        fastestPublishMs,
      },
    },
    lastTickAt: now,
  };
}
