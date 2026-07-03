// buff.ts — Moment of Inspiration (03 §7).
// duration 15s (22.5s with Burst of Genius), cooldown 90s FROM ACTIVATION,
// ×5 click (base part only) / ×2 production. Times are absolute epoch ms.

import { BUFF, BUFF_UNLOCK_MILESTONE, REVEAL_MILESTONES } from './config';
import type { GameState } from './types';

const buffUnlockThreshold = (() => {
  const m = REVEAL_MILESTONES.find((r) => r.id === BUFF_UNLOCK_MILESTONE);
  return m && m.requirement.kind === 'totalEarned' ? m.requirement.amount : 0;
})();

export function isBuffActive(state: GameState, now: number): boolean {
  return now < state.run.buff.activeUntil;
}

export function buffRemainingMs(state: GameState, now: number): number {
  return Math.max(0, state.run.buff.activeUntil - now);
}

export function buffCooldownRemainingMs(state: GameState, now: number): number {
  return Math.max(0, state.run.buff.cooldownUntil - now);
}

export function buffDurationMs(state: GameState): number {
  return state.run.upgrades.burstOfGenius ? BUFF.durationUpgradedMs : BUFF.durationMs;
}

/** Unlocked by the Racing Heart milestone (500 run totalEarned). */
export function isBuffUnlocked(state: GameState): boolean {
  return (
    state.run.milestones.includes(BUFF_UNLOCK_MILESTONE) ||
    state.run.totalEarned >= buffUnlockThreshold
  );
}

export function canActivateBuff(state: GameState, now: number): boolean {
  return isBuffUnlocked(state) && now >= state.run.buff.cooldownUntil;
}

/**
 * Activate the buff. No-op (same reference) while locked or on cooldown.
 * Increments the lifetime activation counter (Moment Seizer / Burst of Genius unlock).
 */
export function activateBuff(state: GameState, now: number): GameState {
  if (!canActivateBuff(state, now)) return state;
  return {
    ...state,
    run: {
      ...state.run,
      buff: {
        activeUntil: now + buffDurationMs(state),
        cooldownUntil: now + BUFF.cooldownMs,
      },
    },
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        buffActivations: state.meta.stats.buffActivations + 1,
      },
    },
  };
}
