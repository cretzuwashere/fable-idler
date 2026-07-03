// achievements.ts — condition evaluation + checkAchievements(state, now).
// Achievements are PERMANENT (meta state): they persist through prestige.
// Each grants +1% global production (+2% with Bound Anthology) via selectors.ts.

import { ACHIEVEMENTS, GENERATORS } from './config';
import { totalGeneratorCount } from './generators';
import { perSecond } from './selectors';
import type { AchievementCondition, AchievementConfig, GameState } from './types';

export function isAchievementConditionMet(
  state: GameState,
  condition: AchievementCondition,
  now: number,
): boolean {
  switch (condition.kind) {
    case 'totalClicks':
      return state.meta.stats.totalClicks >= condition.count;
    case 'totalGeneratorCount':
      return totalGeneratorCount(state) >= condition.count;
    case 'lifetimeInspiration':
      return state.meta.stats.lifetimeInspiration >= condition.amount;
    case 'currentBalance':
      return state.run.inspiration >= condition.amount;
    case 'generatorCount':
      return state.run.generators[condition.generator] >= condition.count;
    case 'allGenerators':
      return GENERATORS.every((g) => state.run.generators[g.id] >= 1);
    case 'perSecond':
      return perSecond(state, now) >= condition.amount;
    case 'bestOfflineGain':
      return state.meta.stats.bestSingleOfflineGain >= condition.amount;
    case 'buffActivations':
      return state.meta.stats.buffActivations >= condition.count;
    case 'tomesPublished':
      return state.meta.tomesPublished >= condition.count;
  }
}

export function hasAchievement(state: GameState, id: AchievementConfig['id']): boolean {
  return state.meta.achievements.includes(id);
}

/**
 * Unlock any achievements whose conditions are now met.
 * Returns the SAME state reference when nothing new unlocked.
 * Called after every tick AND after every dispatched action (02 §3).
 */
export function checkAchievements(state: GameState, now: number): GameState {
  let added: AchievementConfig['id'][] | null = null;
  const has = new Set(state.meta.achievements);

  for (const cfg of ACHIEVEMENTS) {
    if (!has.has(cfg.id) && isAchievementConditionMet(state, cfg.condition, now)) {
      (added ??= []).push(cfg.id);
    }
  }

  if (!added) return state;
  return {
    ...state,
    meta: { ...state.meta, achievements: [...state.meta.achievements, ...added] },
  };
}
