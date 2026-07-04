// buff.ts — Moment of Inspiration (03 §7, extended by v2).
// duration 15s (22.5s with Burst of Genius; ×2 on the FIRST manual activation
// per run with the Standing Ovation relic), cooldown FROM ACTIVATION
// (90s → 75s → 60s with Restless Heart), ×5 click (base part only) / ×2 prod.
// Thunderous Applause: a manual activation instantly grants 20s of current
// production — snapshotted BEFORE the buff starts (no double-dip; 11 §2).
// Times are absolute epoch ms.

import {
  BUFF,
  BUFF_UNLOCK_MILESTONE,
  RESTLESS_HEART_COOLDOWN_MS,
  REVEAL_MILESTONES,
  STANDING_OVATION_DURATION_MULT,
  THUNDEROUS_APPLAUSE_PROD_SECONDS,
} from './config';
import { atelierLevel, hasRelic } from './atelier';
import { globalMultiplier, rawProduction, isSparkBuffActive } from './selectors';
import { activeUniqueBonus } from './unique-bonuses';
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

/** Plain buff duration: 15s, or 22.5s with Burst of Genius; +5s (additive, after
 *  Burst of Genius) with The Quills Write Back (Enchanted Quill unique — 14 §4.2).
 *  No relic effects (Standing Ovation is layered in nextManualBuffDurationMs). */
export function buffDurationMs(state: GameState): number {
  let ms = state.run.upgrades.burstOfGenius ? BUFF.durationUpgradedMs : BUFF.durationMs;
  const quills = activeUniqueBonus(state, 'enchantedQuill');
  if (quills?.buffDurationBonusSec !== undefined) ms += quills.buffDurationBonusSec * 1000;
  return ms;
}

/** Duration the NEXT MANUAL activation would get: plain duration, doubled on
 *  the first activation of the run with the Standing Ovation relic (11 §4). */
export function nextManualBuffDurationMs(state: GameState): number {
  const ovation = hasRelic(state, 'standingOvation') && state.run.buffActivationsThisRun === 0;
  return buffDurationMs(state) * (ovation ? STANDING_OVATION_DURATION_MULT : 1);
}

/** Cooldown from activation: 90s base, 75s/60s with Restless Heart L1/L2; −10s
 *  more with Perpetual Myth (Myth Engine unique), with a global floor of 45s
 *  (14 §4.2). */
export function buffCooldownMs(state: GameState): number {
  const level = atelierLevel(state, 'restlessHeart');
  let ms = level > 0 ? RESTLESS_HEART_COOLDOWN_MS[level - 1] : BUFF.cooldownMs;
  const myth = activeUniqueBonus(state, 'mythEngine');
  if (myth?.buffCooldownReductionSec !== undefined) {
    ms -= myth.buffCooldownReductionSec * 1000;
    const floorSec = myth.cooldownFloorSec ?? 45;
    ms = Math.max(ms, floorSec * 1000);
  }
  return ms;
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
 * Manually activate the buff. No-op (same reference) while locked or on cooldown.
 * Increments the lifetime activation counter AND buffActivationsThisRun (which
 * consumes the Standing Ovation "first activation"). With Thunderous Applause,
 * instantly credits 20 × current production — production WITHOUT the Moment of
 * Inspiration multiplier (pre-activation snapshot; an active Gossip Bonanza
 * spark buff legitimately counts, per 11 "snapshot at click, buffs included").
 */
export function activateBuff(state: GameState, now: number): GameState {
  if (!canActivateBuff(state, now)) return state;
  const applause =
    atelierLevel(state, 'thunderousApplause') >= 1
      ? THUNDEROUS_APPLAUSE_PROD_SECONDS *
        rawProduction(state, isSparkBuffActive(state, 'gossipBonanza', now)) *
        globalMultiplier(state, false)
      : 0;
  return {
    ...state,
    run: {
      ...state.run,
      inspiration: state.run.inspiration + applause,
      totalEarned: state.run.totalEarned + applause,
      buff: {
        activeUntil: now + nextManualBuffDurationMs(state),
        cooldownUntil: now + buffCooldownMs(state),
      },
      buffActivationsThisRun: state.run.buffActivationsThisRun + 1,
    },
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        buffActivations: state.meta.stats.buffActivations + 1,
        lifetimeInspiration: state.meta.stats.lifetimeInspiration + applause,
      },
    },
  };
}
