// upgrades.ts — unlock evaluation + buyUpgrade. Effects are applied in selectors.ts.

import { UPGRADE_INDEX } from './config';
import { totalGeneratorCount } from './generators';
import type { GameState, UnlockCondition, UpgradeId } from './types';

export function meetsUnlockCondition(state: GameState, c: UnlockCondition): boolean {
  switch (c.kind) {
    case 'totalEarned':
      return state.run.totalEarned >= c.amount;
    case 'generatorCount':
      return state.run.generators[c.generator] >= c.count;
    case 'totalGeneratorCount':
      return totalGeneratorCount(state) >= c.count;
    case 'buffActivations':
      return state.meta.stats.buffActivations >= c.count;
    case 'offlineSessions':
      return state.meta.stats.offlineSessionsOver30Min >= c.count;
    case 'achievementCount':
      return state.meta.achievements.length >= c.count;
    case 'tomesPublished':
      return state.meta.tomesPublished >= c.count;
  }
}

/** True when the upgrade should be visible/purchasable in the shop. */
export function isUpgradeUnlocked(state: GameState, id: UpgradeId): boolean {
  return UPGRADE_INDEX[id].unlock.every((c) => meetsUnlockCondition(state, c));
}

/** True when the upgrade has been bought (quillResonance lives in meta). */
export function hasUpgrade(state: GameState, id: UpgradeId): boolean {
  if (id === 'quillResonance') return state.meta.quillResonance;
  return state.run.upgrades[id] === true;
}

/**
 * Buy an upgrade if it is unlocked, not yet owned and affordable.
 * Returns the same state reference when the purchase is not possible.
 */
export function buyUpgrade(state: GameState, id: UpgradeId): GameState {
  if (hasUpgrade(state, id)) return state;
  if (!isUpgradeUnlocked(state, id)) return state;
  const cost = UPGRADE_INDEX[id].cost;
  if (state.run.inspiration < cost) return state;

  if (id === 'quillResonance') {
    return {
      ...state,
      run: { ...state.run, inspiration: state.run.inspiration - cost },
      meta: { ...state.meta, quillResonance: true },
    };
  }
  return {
    ...state,
    run: {
      ...state.run,
      inspiration: state.run.inspiration - cost,
      upgrades: { ...state.run.upgrades, [id]: true },
    },
  };
}
