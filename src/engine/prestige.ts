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
  FOREWORD_CAP,
  FOREWORD_START_FRACTION,
  PRESTIGE_DIVISOR,
  PRESTIGE_MIN_TOTAL_EARNED,
  PRESTIGE_V3,
  RELIC_INDEX,
  UNIQUE_BONUSES,
} from './config';
import { apprenticeStartMuses, atelierLevel, bookmarkedUpgrades } from './atelier';
import { createFable } from './fables';
import { createInitialRunState } from './state';
import { isUniqueBonusActive } from './unique-bonuses';
import type { GameState } from './types';

/**
 * Golden Quills for a given (net) run totalEarned — the SEGMENTED v3 formula
 * (14 §5.1). Bit-identical to v1/v2 sqrt for te ≤ 1e9 (same branch), then the
 * 6th root to 1e15, then the 12th root. Continuous and monotonic; the +1e-9
 * guard applies ONLY to segments 2–3 (never segment 1) so q(1e15) = 1000 exactly
 * despite pow(1e6, 1/6) = 9.999999… in IEEE-754.
 */
export function quillsForTotalEarned(totalEarned: number): number {
  if (!(totalEarned > 0)) return 0;
  if (totalEarned <= PRESTIGE_V3.knee1) {
    // EXACT v1/v2 — no epsilon, same branch, same rounding.
    return Math.floor(Math.sqrt(totalEarned / PRESTIGE_DIVISOR));
  }
  if (totalEarned <= PRESTIGE_V3.knee2) {
    return Math.floor(
      PRESTIGE_V3.coef2 * Math.pow(totalEarned / PRESTIGE_V3.knee1, PRESTIGE_V3.exp2) +
        PRESTIGE_V3.epsilon,
    );
  }
  return Math.floor(
    PRESTIGE_V3.coef3 * Math.pow(totalEarned / PRESTIGE_V3.knee2, PRESTIGE_V3.exp3) +
      PRESTIGE_V3.epsilon,
  );
}

/** The totalEarned the prestige formula runs on: run totalEarned MINUS the seed
 *  capital granted at the start of the run (Dog-Eared + Foreword), clamped ≥ 0.
 *  Anti-exploit: a big Foreword head-start must never mint quills (14 §5.4). */
export function prestigeNetTotalEarned(state: GameState): number {
  return Math.max(0, state.run.totalEarned - state.run.seededInspiration);
}

/** Quills the player would receive by publishing right now (incl. Editor's Due
 *  and Divine Royalties, the Pantheon Press unique bonus). */
export function prestigePreview(state: GameState): number {
  let bonus = atelierLevel(state, 'editorsDue') >= 1 ? EDITORS_DUE_BONUS_QUILLS : 0;
  // Divine Royalties: +1 Golden Quill this publish, only if the pantheonPress
  // unique bonus is active in the run being published (14 §4.2).
  const royalties = UNIQUE_BONUSES.pantheonPress?.bonusQuillsPerPublish;
  if (royalties !== undefined && isUniqueBonusActive(state, 'pantheonPress')) bonus += royalties;
  return quillsForTotalEarned(prestigeNetTotalEarned(state)) + bonus;
}

/** Seed Inspiration the NEXT run starts with: Dog-Eared Page (flat 300) plus
 *  Foreword by the Editor (0.1% of THIS run's totalEarned, capped). Both enter
 *  the new run's inspiration + totalEarned AND its seededInspiration (14 §5.4/§6.2). */
export function seedInspirationForNextRun(state: GameState, tomeNumberAfter: number): number {
  let seed = 0;
  if (tomeNumberAfter >= RELIC_INDEX.dogEaredPage.tomes) {
    seed += DOG_EARED_PAGE_START_INSPIRATION;
  }
  if (tomeNumberAfter >= RELIC_INDEX.forewordByTheEditor.tomes) {
    seed += Math.min(state.run.totalEarned * FOREWORD_START_FRACTION, FOREWORD_CAP);
  }
  return seed;
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
  // relics — publishing tome #3 unlocks Dog-Eared Page for the run it opens,
  // tome #50 unlocks Foreword by the Editor).
  const run = createInitialRunState(now);
  run.upgrades = bookmarkedUpgrades(state); // Second Bookmark + Perpetual Manuscript
  run.generators = {
    ...run.generators,
    wanderingMuse: apprenticeStartMuses(state), // Apprentice Muse (free, not earnings)
  };
  // Seed capital: Dog-Eared Page (flat 300) + Foreword (0.1% of prev te, capped).
  // Enters balance AND totalEarned (keeps balance ≤ totalEarned), AND is recorded
  // as run.seededInspiration so the prestige formula runs on te − seed (14 §5.4):
  // an instant re-publish yields q(0) = 0 quills, closing the Foreword farm.
  const seed = seedInspirationForNextRun(state, tomeNumber);
  if (seed > 0) {
    run.inspiration = seed;
    run.totalEarned = seed;
    run.seededInspiration = seed;
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
