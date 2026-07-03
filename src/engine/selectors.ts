// selectors.ts — ALL derived values, single source of truth for formulas.
// Multiplier composition order is EXACTLY 03 §2:
//   per generator: base → qty milestones → per-gen upgrade → synergy
//   global (on the sum): Golden Inkwell → achievements → quills → buff
// Click (03 §3): CLICK_BASE ×nib ×resonance ×buff + InkEcho·effectiveProd
//   (the Ink Echo part is NOT multiplied by the buff ×5 — production already
//    carries the buff ×2).

import {
  ACHIEVEMENT_BONUS,
  ACHIEVEMENT_BONUS_ANTHOLOGY,
  BUFF,
  CLICK_BASE,
  GENERATORS,
  GENERATOR_INDEX,
  GOLDEN_INKWELL_MULT,
  INK_ECHO_RATE,
  MUSES_CHORUS_MULT,
  QTY_MILESTONE_MULT,
  QTY_MILESTONE_THRESHOLDS,
  QUILL_BONUS,
  RAVENS_GOSSIP_RATE,
  SHARPENED_NIB_MULT,
  WEAVERS_RHYTHM_RATE,
} from './config';
import { isBuffActive } from './buff';
import { hasUpgrade } from './upgrades';
import type { GameState, GeneratorId } from './types';

/** ×2 per quantity threshold reached (25/50/100 → ×2/×4/×8). */
export function qtyMilestoneMultiplier(state: GameState, id: GeneratorId): number {
  const owned = state.run.generators[id];
  let reached = 0;
  for (const t of QTY_MILESTONE_THRESHOLDS) if (owned >= t) reached++;
  return Math.pow(QTY_MILESTONE_MULT, reached);
}

/** Production/sec of one generator type, including its local multipliers (03 §2 steps 1–3). */
export function generatorProduction(state: GameState, id: GeneratorId): number {
  const owned = state.run.generators[id];
  if (owned === 0) return 0;
  let prod = owned * GENERATOR_INDEX[id].baseProd * qtyMilestoneMultiplier(state, id);
  if (id === 'wanderingMuse' && hasUpgrade(state, 'musesChorus')) {
    prod *= MUSES_CHORUS_MULT;
  }
  if (id === 'inkSprite' && hasUpgrade(state, 'ravensGossip')) {
    prod *= 1 + RAVENS_GOSSIP_RATE * state.run.generators.talkingRaven;
  }
  if (id === 'enchantedQuill' && hasUpgrade(state, 'weaversRhythm')) {
    prod *= 1 + WEAVERS_RHYTHM_RATE * state.run.generators.storyLoom;
  }
  return prod;
}

/** Sum of generator production before global multipliers (03 §2 step 4). */
export function rawProduction(state: GameState): number {
  let sum = 0;
  for (const g of GENERATORS) sum += generatorProduction(state, g.id);
  return sum;
}

/** 1 + bonus × achievements (bonus doubled by Bound Anthology). Additive within category. */
export function achievementMultiplier(state: GameState): number {
  const bonus = hasUpgrade(state, 'boundAnthology')
    ? ACHIEVEMENT_BONUS_ANTHOLOGY
    : ACHIEVEMENT_BONUS;
  return 1 + bonus * state.meta.achievements.length;
}

/** 1 + 0.30 × goldenQuills — additive per quill (03 §6). */
export function quillMultiplier(state: GameState): number {
  return 1 + QUILL_BONUS * state.meta.goldenQuills;
}

/** Global multiplier (03 §2 steps 5–8). Buff participation is explicit. */
export function globalMultiplier(state: GameState, buffActive: boolean): number {
  return (
    (hasUpgrade(state, 'goldenInkwell') ? GOLDEN_INKWELL_MULT : 1) *
    achievementMultiplier(state) *
    quillMultiplier(state) *
    (buffActive ? BUFF.prodMult : 1)
  );
}

/** Effective production/sec WITHOUT the buff — used by offline progress and by tick integration. */
export function perSecondNoBuff(state: GameState): number {
  return rawProduction(state) * globalMultiplier(state, false);
}

/** Effective production/sec at `now` — the "X/sec" shown in the UI. */
export function perSecond(state: GameState, now: number): number {
  return rawProduction(state) * globalMultiplier(state, isBuffActive(state, now));
}

/**
 * Inspiration granted by one click at `now` (03 §3).
 * clickValue = CLICK_BASE ×2(nib) ×(1+0.30q)(resonance) ×5(buff) + 1%·effectiveProd(inkEcho)
 */
export function clickPower(state: GameState, now: number): number {
  const buffActive = isBuffActive(state, now);
  const base =
    CLICK_BASE *
    (hasUpgrade(state, 'sharpenedNib') ? SHARPENED_NIB_MULT : 1) *
    (state.meta.quillResonance ? quillMultiplier(state) : 1) *
    (buffActive ? BUFF.clickMult : 1);
  const echo = hasUpgrade(state, 'inkEcho')
    ? INK_ECHO_RATE * rawProduction(state) * globalMultiplier(state, buffActive)
    : 0;
  return base + echo;
}
