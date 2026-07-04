// achievements.ts — condition evaluation + checkAchievements(state, now).
// Achievements are PERMANENT (meta state): they persist through prestige.
// Each grants +1% global production (+2% with Bound Anthology) via selectors.ts.

import { ACHIEVEMENTS, WELL_ROUNDED_GENERATOR_IDS } from './config';
import { hasAnyAtelierUpgrade, isAtelierComplete } from './atelier';
import { uniqueFableCount } from './fables';
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
      // The 7 base generators only — mythEngine is Atelier-gated and must not
      // retroactively lock Well-Rounded Library for v1-style players.
      return WELL_ROUNDED_GENERATOR_IDS.every((id) => state.run.generators[id] >= 1);
    case 'perSecond':
      return perSecond(state, now) >= condition.amount;
    case 'bestOfflineGain':
      return state.meta.stats.bestSingleOfflineGain >= condition.amount;
    case 'buffActivations':
      return state.meta.stats.buffActivations >= condition.count;
    case 'tomesPublished':
      return state.meta.tomesPublished >= condition.count;
    // --- v2 (10 §3.5) ---
    case 'sparksCaught':
      return state.meta.stats.sparksCaught >= condition.count;
    case 'quillsFromFragments':
      return state.meta.stats.quillsFromFragments >= condition.count;
    case 'fableCount':
      return state.meta.fables.length >= condition.count;
    case 'uniqueFableCount':
      return uniqueFableCount(state.meta.fables) >= condition.count;
    case 'atelierAny':
      return hasAnyAtelierUpgrade(state);
    case 'atelierComplete':
      return isAtelierComplete(state);
    case 'fastestPublishBelow':
      return (
        state.meta.stats.fastestPublishMs !== null &&
        state.meta.stats.fastestPublishMs < condition.ms
      );
    case 'leaderboardJoined':
      return typeof state.meta.settings.leaderboard?.token === 'string' &&
        state.meta.settings.leaderboard.token.length > 0;
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
