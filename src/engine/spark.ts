// spark.ts — Stray Spark rewards (v2, 11 §5).
// The engine holds NO RNG and NO spawn timer: the UI shell owns the timer
// (visibility-gated), rolls `rand01` itself, maps it through the pure
// rollSparkKind(), and dispatches { type: 'collectSpark', kind }. The reducer
// then computes the magnitude DETERMINISTICALLY from the current state —
// nothing pending is ever persisted (anti save-scumming, 09 §2.3).

import { SPARK } from './config';
import { atelierLevel } from './atelier';
import { buffDurationMs } from './buff';
import { clickPower, perSecond } from './selectors';
import type { GameState, SparkBuffState, SparkRewardKind } from './types';

/** Fixed roll order — the cumulative thresholds below follow this order. */
export const SPARK_KINDS: readonly SparkRewardKind[] = [
  'inkBurst',
  'quillFrenzy',
  'gossipBonanza',
  'timeSlip',
  'storyFragment',
  'goldenQuillDrop',
];

/** Sum of the weight table (kept explicit so a config edit that breaks the
 *  100 total fails a unit test, not silently skews the odds). */
export function sparkWeightTotal(): number {
  let total = 0;
  for (const kind of SPARK_KINDS) total += SPARK.weights[kind];
  return total;
}

/**
 * Map a uniform roll ∈ [0,1) to a reward kind via cumulative weights.
 * Pure and boundary-exact: rand01 = 0.45 is the first quillFrenzy, etc.
 * Out-of-range/invalid input clamps into [0, 1).
 */
export function rollSparkKind(rand01: number): SparkRewardKind {
  const total = sparkWeightTotal();
  const clamped = Number.isFinite(rand01) ? Math.min(Math.max(rand01, 0), 1) : 0;
  const r = Math.min(clamped, 1 - Number.EPSILON) * total;
  let cumulative = 0;
  for (const kind of SPARK_KINDS) {
    cumulative += SPARK.weights[kind];
    if (r < cumulative) return kind;
  }
  return SPARK_KINDS[SPARK_KINDS.length - 1];
}

/** Resolved reward of one catch — also carried on the sparkCollected event
 *  so the UI can toast the concrete numbers. */
export interface SparkRewardSummary {
  kind: SparkRewardKind;
  /** Inspiration credited instantly (inkBurst only; 0 otherwise). */
  inspiration: number;
  /** Golden Quills granted (goldenQuillDrop, or fragments binding into one). */
  quills: number;
  /** Story fragments added by this catch (before binding). */
  fragments: number;
  /** True when this catch bound 5 fragments into a Golden Quill. */
  boundQuill: boolean;
  /** Spark buff started (quillFrenzy / gossipBonanza), with its end time. */
  buff: SparkBuffState | null;
}

/**
 * Compute the reward of a catch at `now` WITHOUT applying it (pure).
 * Sparkcatcher's Net L2 doubles sums/durations/fragments/quills — never timeSlip.
 */
export function sparkRewardSummary(
  state: GameState,
  kind: SparkRewardKind,
  now: number,
): SparkRewardSummary {
  const netL2 = atelierLevel(state, 'sparkcatchersNet') >= 2;
  const mult = netL2 ? SPARK.netRewardMult : 1;
  const none: Omit<SparkRewardSummary, 'kind'> = {
    inspiration: 0,
    quills: 0,
    fragments: 0,
    boundQuill: false,
    buff: null,
  };
  switch (kind) {
    case 'inkBurst': {
      // 45 × effectiveProd (snapshot at click, ACTIVE BUFFS INCLUDED — the
      // "catch a spark mid-buff" combo is legitimate skill play), with a floor
      // of 50 × current click value for the production≈0 early game.
      const burst = SPARK.inkBurstSeconds * perSecond(state, now);
      const floor = SPARK.inkBurstFloorClicks * clickPower(state, now);
      return { kind, ...none, inspiration: Math.max(burst, floor) * mult };
    }
    case 'quillFrenzy':
      return {
        kind,
        ...none,
        buff: { kind: 'quillFrenzy', activeUntil: now + SPARK.frenzy.durationMs * mult },
      };
    case 'gossipBonanza':
      return {
        kind,
        ...none,
        buff: { kind: 'gossipBonanza', activeUntil: now + SPARK.gossip.durationMs * mult },
      };
    case 'timeSlip':
      // No magnitude — cooldown reset + free buff, handled in applySparkReward.
      return { kind, ...none };
    case 'storyFragment': {
      const fragments = 1 * mult;
      const bound = Math.floor(
        (state.meta.storyFragments + fragments) / SPARK.fragmentsPerQuill,
      );
      return { kind, ...none, fragments, quills: bound, boundQuill: bound > 0 };
    }
    case 'goldenQuillDrop':
      return { kind, ...none, quills: 1 * mult };
  }
}

/**
 * Apply a collected spark to the state (pure — called by the reducer).
 * Every catch increments stats.sparksCaught. Inspiration rewards flow through
 * totalEarned/lifetime like any earnings (they do NOT bypass milestones).
 * Quills always land in BOTH the wallet and lifetimeQuillsEarned.
 */
export function applySparkReward(
  state: GameState,
  kind: SparkRewardKind,
  now: number,
): GameState {
  const reward = sparkRewardSummary(state, kind, now);

  const stats = {
    ...state.meta.stats,
    sparksCaught: state.meta.stats.sparksCaught + 1,
  };
  const run = { ...state.run };
  const meta = { ...state.meta, stats };

  if (reward.inspiration > 0) {
    run.inspiration += reward.inspiration;
    run.totalEarned += reward.inspiration;
    stats.lifetimeInspiration += reward.inspiration;
  }

  if (reward.buff) {
    // A new spark buff replaces the old one (max 1 active — 09 §2.2).
    run.sparkBuff = reward.buff;
  }

  if (kind === 'timeSlip') {
    // Cooldown reset + the buff starts FREE: plain duration (no Standing
    // Ovation — it does not consume the "first manual activation"), no
    // Thunderous Applause (it is not an activation), no activation counters.
    run.buff = { activeUntil: now + buffDurationMs(state), cooldownUntil: now };
  }

  if (kind === 'storyFragment') {
    meta.storyFragments =
      (state.meta.storyFragments + reward.fragments) % SPARK.fragmentsPerQuill;
    stats.quillsFromFragments += reward.quills;
  }

  if (reward.quills > 0) {
    // GOLDEN RULE: every quill source raises the wallet AND the lifetime total.
    meta.goldenQuills += reward.quills;
    stats.lifetimeQuillsEarned += reward.quills;
  }

  return { ...state, run, meta };
}
