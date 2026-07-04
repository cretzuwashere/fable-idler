// selectors.ts — ALL derived values, single source of truth for formulas.
// Multiplier composition order is EXACTLY 03 §2 extended by 11 §7:
//   per generator: base → qty milestones → per-gen upgrade → synergy
//                  → 3½: gossipBonanza ×5 on tiers 1–3 while active   [v2]
//   global (on the sum): Golden Inkwell → achievements
//                  → 6½a: Bookshelf (1 + 0.02 × min(uniqueFables, 25)) [v2]
//                  → 6½b: Ink That Remembers (1 + 0.01 × tomes, ≥15)   [v2]
//                  → quills (1 + 0.30 × LIFETIME quills — GOLDEN RULE) [v2]
//                  → buff ×2
// Click (03 §3 + 11 §7):
//   base = CLICK_BASE ×nib ×resonance(lifetime) ×buff(×5) ×quillFrenzy(×7)
//   echo = InkEcho 1% × effectiveProd  (untouched by ×5/×7 — v1 rule)
//   click = (base + echo) × crit(×10 on the WHOLE click — 11 RUN F)

import {
  ACHIEVEMENT_BONUS,
  ACHIEVEMENT_BONUS_ANTHOLOGY,
  BOOKSHELF,
  BUFF,
  CLICK_BASE,
  GENERATORS,
  GENERATOR_INDEX,
  GOLDEN_INKWELL_MULT,
  INK_ECHO_RATE,
  INK_REMEMBERS_RATE,
  MUSES_CHORUS_MULT,
  NIGHT_OWL_EXTRA_CAP_MS,
  OFFLINE,
  QTY_MILESTONE_MULT,
  QTY_MILESTONE_THRESHOLDS,
  QUILL_BONUS,
  RAVENS_GOSSIP_RATE,
  READERS_LETTER_OFFLINE_BONUS,
  SHARPENED_NIB_MULT,
  SPARK,
  STROKE_OF_GENIUS,
  WEAVERS_RHYTHM_RATE,
} from './config';
import { atelierLevel, hasRelic } from './atelier';
import { uniqueFableCount } from './fables';
import { isGeneratorRevealed } from './generators';
import { hasUpgrade } from './upgrades';
import type { GameState, GeneratorId } from './types';

/** Moment of Inspiration active at `now`? (inlined here to avoid a buff↔selectors cycle) */
function momentActiveAt(state: GameState, now: number): boolean {
  return now < state.run.buff.activeUntil;
}

/** Is a given spark buff kind active at `now`? */
export function isSparkBuffActive(
  state: GameState,
  kind: 'quillFrenzy' | 'gossipBonanza',
  now: number,
): boolean {
  const sb = state.run.sparkBuff;
  return sb !== null && sb.kind === kind && now < sb.activeUntil;
}

/** ×2 per quantity threshold reached (25/50/100 → ×2/×4/×8). */
export function qtyMilestoneMultiplier(state: GameState, id: GeneratorId): number {
  const owned = state.run.generators[id];
  let reached = 0;
  for (const t of QTY_MILESTONE_THRESHOLDS) if (owned >= t) reached++;
  return Math.pow(QTY_MILESTONE_MULT, reached);
}

/**
 * Production/sec of one generator type, including its local multipliers
 * (03 §2 steps 1–3 + v2 step 3½). `gossipActive` = Gossip Bonanza spark buff
 * (×5 on tiers 1–3); default false keeps every v1 call site intact.
 */
export function generatorProduction(
  state: GameState,
  id: GeneratorId,
  gossipActive = false,
): number {
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
  if (gossipActive && SPARK.gossip.tiers.includes(id)) {
    prod *= SPARK.gossip.prodMult; // v2 step 3½
  }
  return prod;
}

/** Sum of generator production before global multipliers (03 §2 step 4). */
export function rawProduction(state: GameState, gossipActive = false): number {
  let sum = 0;
  for (const g of GENERATORS) sum += generatorProduction(state, g.id, gossipActive);
  return sum;
}

/** 1 + bonus × achievements (bonus doubled by Bound Anthology). Additive within category. */
export function achievementMultiplier(state: GameState): number {
  const bonus = hasUpgrade(state, 'boundAnthology')
    ? ACHIEVEMENT_BONUS_ANTHOLOGY
    : ACHIEVEMENT_BONUS;
  return 1 + bonus * state.meta.achievements.length;
}

/** v2 step 6½a — 1 + 0.02 × min(unique fable titles, 25). */
export function bookshelfMultiplier(state: GameState): number {
  const counted = Math.min(uniqueFableCount(state.meta.fables), BOOKSHELF.countedCap);
  return 1 + BOOKSHELF.bonusPerUniqueFable * counted;
}

/** v2 step 6½b — 1 + 0.01 × tomesPublished, only once the relic is unlocked (≥15). */
export function inkRemembersMultiplier(state: GameState): number {
  return hasRelic(state, 'inkThatRemembers')
    ? 1 + INK_REMEMBERS_RATE * state.meta.tomesPublished
    : 1;
}

/**
 * 1 + 0.30 × LIFETIME quills earned — THE GOLDEN RULE (09 §1.1 / 11 §1.1).
 * This is the ONLY place that implements it: the wallet (meta.goldenQuills)
 * must never appear in any production/click formula.
 */
export function quillMultiplier(state: GameState): number {
  return 1 + QUILL_BONUS * state.meta.stats.lifetimeQuillsEarned;
}

/** Global multiplier (03 §2 steps 5–8, extended per 11 §7). */
export function globalMultiplier(state: GameState, buffActive: boolean): number {
  return (
    (hasUpgrade(state, 'goldenInkwell') ? GOLDEN_INKWELL_MULT : 1) *
    achievementMultiplier(state) *
    bookshelfMultiplier(state) *
    inkRemembersMultiplier(state) *
    quillMultiplier(state) *
    (buffActive ? BUFF.prodMult : 1)
  );
}

/** Effective production/sec WITHOUT the buff and WITHOUT spark buffs —
 *  used by offline progress (spark buffs never pay out offline). */
export function perSecondNoBuff(state: GameState): number {
  return rawProduction(state, false) * globalMultiplier(state, false);
}

/** Effective production/sec at `now` — the "X/sec" shown in the UI
 *  (includes Moment of Inspiration AND the Gossip Bonanza spark buff). */
export function perSecond(state: GameState, now: number): number {
  return (
    rawProduction(state, isSparkBuffActive(state, 'gossipBonanza', now)) *
    globalMultiplier(state, momentActiveAt(state, now))
  );
}

/**
 * Inspiration granted by one click at `now` (03 §3 + v2 quillFrenzy).
 * Crit is NOT included here — see clickValue (the crit multiplies the whole click).
 */
export function clickPower(state: GameState, now: number): number {
  const buffActive = momentActiveAt(state, now);
  const gossipActive = isSparkBuffActive(state, 'gossipBonanza', now);
  const base =
    CLICK_BASE *
    (hasUpgrade(state, 'sharpenedNib') ? SHARPENED_NIB_MULT : 1) *
    (state.meta.quillResonance ? quillMultiplier(state) : 1) *
    (buffActive ? BUFF.clickMult : 1) *
    (isSparkBuffActive(state, 'quillFrenzy', now) ? SPARK.frenzy.clickMult : 1);
  const echo = hasUpgrade(state, 'inkEcho')
    ? INK_ECHO_RATE * rawProduction(state, gossipActive) * globalMultiplier(state, buffActive)
    : 0;
  return base + echo;
}

/** Crit chance from Stroke of Genius (0 / 0.05 / 0.10). */
export function critChance(state: GameState): number {
  const level = atelierLevel(state, 'strokeOfGenius');
  return level > 0 ? STROKE_OF_GENIUS.critChance[level - 1] : 0;
}

/** Did this roll crit? The shell passes the SAME roll it uses for visual feedback. */
export function isCritRoll(state: GameState, critRoll: number | undefined): boolean {
  return (
    typeof critRoll === 'number' &&
    Number.isFinite(critRoll) &&
    critRoll >= 0 &&
    critRoll < critChance(state)
  );
}

/**
 * Full click value including the Stroke of Genius crit (×10 on the WHOLE click,
 * Ink Echo included — 11 RUN F). `critRoll` absent/invalid = never crits.
 */
export function clickValue(state: GameState, now: number, critRoll?: number): number {
  const value = clickPower(state, now);
  return isCritRoll(state, critRoll) ? value * STROKE_OF_GENIUS.critMult : value;
}

// ---------------------------------------------------------------------------
// v2 — offline / spark / shop selectors
// ---------------------------------------------------------------------------

/** Offline cap: 8h base, 12h with Lucid Dreaming, +12h with Night Owl Pact. */
export function offlineCapMs(state: GameState): number {
  const base = state.run.upgrades.lucidDreaming ? OFFLINE.capMsUpgraded : OFFLINE.capMsBase;
  return base + (atelierLevel(state, 'nightOwlPact') >= 1 ? NIGHT_OWL_EXTRA_CAP_MS : 0);
}

/** Offline efficiency: 0.5 base, 0.75 with Lucid Dreaming, +0.10 with The Reader's Letter. */
export function offlineEfficiency(state: GameState): number {
  const base = state.run.upgrades.lucidDreaming
    ? OFFLINE.upgradedEfficiency
    : OFFLINE.baseEfficiency;
  return base + (hasRelic(state, 'readersLetter') ? READERS_LETTER_OFFLINE_BONUS : 0);
}

/** Spawn interval range for the Stray Spark (halved by Sparkcatcher's Net L1).
 *  Read by the UI shell — the spawn timer itself lives outside the engine. */
export function sparkIntervalRange(state: GameState): { minMs: number; maxMs: number } {
  const div = atelierLevel(state, 'sparkcatchersNet') >= 1 ? SPARK.netIntervalDiv : 1;
  return { minMs: SPARK.intervalMinMs / div, maxMs: SPARK.intervalMaxMs / div };
}

/**
 * Shop visibility. mythEngine renders ONLY with Blueprint of Myths owned (and
 * its normal revealAt); every other generator follows the v1 reveal rule.
 * No teaser for mythEngine — without the Blueprint the row must not exist.
 */
export function isGeneratorVisibleInShop(state: GameState, id: GeneratorId): boolean {
  if (id === 'mythEngine' && atelierLevel(state, 'blueprintOfMyths') < 1) return false;
  return isGeneratorRevealed(state, id);
}
