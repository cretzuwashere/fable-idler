// unique-bonuses.ts — the 14 per-generator UNIQUE bonuses at 200 owned (14 §4.2).
//
// Each generator gets ONE distinctive, run-scoped bonus the moment its owned
// count reaches the unique threshold in the CURRENT run: 200 by default, or 150
// with The Hundredth Telling relic (tomes ≥ 100). The bonuses are re-earned every
// run (they reset with the run's generator counts) and every effect is chosen to
// be safe on re-earn (no "start of next run" carry — 13 §2.1).
//
// This module is the single source of truth for "is bonus X active"; every call
// site (selectors / buff / spark / offline / prestige / generators cost) reads
// from here so the threshold rule stays in ONE place. It imports only config +
// atelier (no selectors), keeping it cycle-free.

import {
  UNIQUE_BONUSES,
  UNIQUE_THRESHOLD,
  UNIQUE_THRESHOLD_TELLING,
} from './config';
import type { UniqueBonusConfig } from './config';
import { hasRelic } from './atelier';
import type { GameState, GeneratorId } from './types';

/** The owned count at which unique bonuses fire this run: 200, or 150 with the
 *  The Hundredth Telling relic (tomes ≥ 100). */
export function uniqueThreshold(state: GameState): number {
  return hasRelic(state, 'hundredthTelling') ? UNIQUE_THRESHOLD_TELLING : UNIQUE_THRESHOLD;
}

/** Is a given generator's unique bonus active right now (run-scoped)? */
export function isUniqueBonusActive(state: GameState, id: GeneratorId): boolean {
  return state.run.generators[id] >= uniqueThreshold(state);
}

/** The bonus config for a generator IF its unique bonus is active, else null. */
export function activeUniqueBonus(state: GameState, id: GeneratorId): UniqueBonusConfig | null {
  const cfg = UNIQUE_BONUSES[id];
  if (cfg === undefined) return null;
  return isUniqueBonusActive(state, id) ? cfg : null;
}
