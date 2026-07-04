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
  ATLAS_GLOBAL_MULT,
  BOOKSHELF,
  BUFF,
  CLICK_BASE,
  CURATORS_PATIENCE_EXTRA_CAP_MS,
  ENDLESS_SHELF_BOOKSHELF_CAP,
  GENERATORS,
  GENERATOR_INDEX,
  GOLDEN_INKWELL_MULT,
  INK_ECHO_RATE,
  INK_REMEMBERS_RATE,
  MUSES_CHORUS_MULT,
  NIGHT_OWL_EXTRA_CAP_MS,
  OFFLINE,
  OFFLINE_EFFICIENCY_CAP,
  QTY_FINALE_MULT,
  QTY_FINALE_THRESHOLD,
  QTY_MILESTONE_MULT,
  QTY_MILESTONE_THRESHOLDS,
  QTY_STEP_MULT,
  QTY_THRESHOLDS_V3,
  QUILL_BONUS,
  RAVENS_GOSSIP_RATE,
  READERS_LETTER_OFFLINE_BONUS,
  SHARPENED_NIB_MULT,
  SPARK,
  STRENGTH_OF_STACKS,
  STROKE_OF_GENIUS,
  UNIQUE_BONUSES,
  V3_RUN_UPGRADE_BY_GEN,
  WEAVERS_RHYTHM_RATE,
} from './config';
import { atelierLevel, hasRelic } from './atelier';
import { uniqueFableCount } from './fables';
import { isGeneratorRevealed } from './generators';
import { activeUniqueBonus, isUniqueBonusActive } from './unique-bonuses';
import { hasUpgrade } from './upgrades';
import type { GameState, GeneratorId } from './types';

/** The 4 base-game generators re-scaled by Warp and Weft (Loom's unique bonus). */
const TIERS_1_TO_4: readonly GeneratorId[] = [
  'wanderingMuse',
  'inkSprite',
  'talkingRaven',
  'enchantedQuill',
];

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

/**
 * Quantity-milestone production multiplier for one generator (03 §5 + v3 14 §4.1).
 *   v1: 25/50/100 → ×2 each (cumulative ×8) — UNCHANGED.
 *   v3: 150/300/400 → ×2 each; 500 → ×4 (cumulative from v1: ×256).
 *   The UNIQUE bonus at 200 is NOT a production multiplier — handled elsewhere.
 * Strength of the Stacks (Atelier) boosts ONLY the >100 thresholds: the ×2 steps
 * become ×2.5 and the ×4 finale becomes ×5 (14 §4.1 / §6.1).
 */
export function qtyMilestoneMultiplier(state: GameState, id: GeneratorId): number {
  const owned = state.run.generators[id];
  const stacks = atelierLevel(state, 'strengthOfTheStacks') >= 1;
  let mult = 1;
  // v1 thresholds (≤100): always ×2, never affected by Strength of the Stacks.
  for (const t of QTY_MILESTONE_THRESHOLDS) if (owned >= t) mult *= QTY_MILESTONE_MULT;
  // v3 thresholds (>100): ×2 steps (or ×2.5), plus a ×4 (or ×5) finale at 500.
  for (const t of QTY_THRESHOLDS_V3) {
    if (owned < t) continue;
    if (t === QTY_FINALE_THRESHOLD) {
      mult *= stacks ? STRENGTH_OF_STACKS.finaleMult : QTY_FINALE_MULT;
    } else {
      mult *= stacks ? STRENGTH_OF_STACKS.thresholdMult : QTY_STEP_MULT;
    }
  }
  return mult;
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
  // Step 2 — per-generator upgrades (v1 named upgrades + the v3 re-scalers).
  if (id === 'wanderingMuse' && hasUpgrade(state, 'musesChorus')) {
    prod *= MUSES_CHORUS_MULT;
  }
  const rescaler = V3_RUN_UPGRADE_BY_GEN[id];
  if (rescaler !== undefined && hasUpgrade(state, rescaler.id)) {
    prod *= rescaler.mult; // v3 re-scaler (×1000…×200 on tiers 1–7)
  }
  // Step 3 — synergies.
  if (id === 'inkSprite' && hasUpgrade(state, 'ravensGossip')) {
    prod *= 1 + RAVENS_GOSSIP_RATE * state.run.generators.talkingRaven;
  }
  if (id === 'enchantedQuill' && hasUpgrade(state, 'weaversRhythm')) {
    prod *= 1 + WEAVERS_RHYTHM_RATE * state.run.generators.storyLoom;
  }
  // Step 3½ — Gossip Bonanza spark buff (×5 on tiers 1–3 while active).
  if (gossipActive && SPARK.gossip.tiers.includes(id)) {
    prod *= SPARK.gossip.prodMult;
  }
  // Step 3¾ — Warp and Weft (Story Loom's unique bonus): tiers 1–4 ×3 (14 §4.2).
  if (
    TIERS_1_TO_4.includes(id) &&
    isUniqueBonusActive(state, 'storyLoom') &&
    UNIQUE_BONUSES.storyLoom?.tiers1to4Mult !== undefined
  ) {
    prod *= UNIQUE_BONUSES.storyLoom.tiers1to4Mult;
  }
  return prod;
}

/** Sum of generator production before global multipliers (03 §2 step 4). */
export function rawProduction(state: GameState, gossipActive = false): number {
  let sum = 0;
  for (const g of GENERATORS) sum += generatorProduction(state, g.id, gossipActive);
  return sum;
}

/** 1 + bonus × achievements (bonus doubled by Bound Anthology; per-achievement
 *  rate ×1.5 with Everyone's Biographer, the Narrators' Guild unique bonus —
 *  14 §4.2). Additive within category. */
export function achievementMultiplier(state: GameState): number {
  let bonus = hasUpgrade(state, 'boundAnthology')
    ? ACHIEVEMENT_BONUS_ANTHOLOGY
    : ACHIEVEMENT_BONUS;
  const guild = activeUniqueBonus(state, 'narratorsGuild');
  if (guild?.achievementBonusMult !== undefined) bonus *= guild.achievementBonusMult;
  return 1 + bonus * state.meta.achievements.length;
}

/** v2 step 6½a — 1 + 0.02 × min(unique fable titles, cap). Cap 25, raised to 100
 *  by The Endless Shelf relic (14 §6.2 — max +50% → +200%). */
export function bookshelfMultiplier(state: GameState): number {
  const cap = hasRelic(state, 'endlessShelf') ? ENDLESS_SHELF_BOOKSHELF_CAP : BOOKSHELF.countedCap;
  const counted = Math.min(uniqueFableCount(state.meta.fables), cap);
  return 1 + BOOKSHELF.bonusPerUniqueFable * counted;
}

/** v3 step 5½ — global ×2 from Atlas of Untold Lands (Atelier) and/or …Happily
 *  Ever After (Once Upon a Time's unique bonus). Both stack multiplicatively. */
export function v3GlobalMultiplier(state: GameState): number {
  let mult = 1;
  if (atelierLevel(state, 'atlasOfUntoldLands') >= 1) mult *= ATLAS_GLOBAL_MULT;
  const ouat = activeUniqueBonus(state, 'onceUponATime');
  if (ouat?.globalMult !== undefined) mult *= ouat.globalMult;
  return mult;
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

/** Moment of Inspiration production multiplier: ×2, raised to ×2.5 by White-Hot
 *  Archetypes (Fable Forge's unique bonus — 14 §4.2). */
export function buffProdMult(state: GameState): number {
  const forge = activeUniqueBonus(state, 'fableForge');
  return forge?.buffProdMult ?? BUFF.prodMult;
}

/** Global multiplier (03 §2 steps 5–8, extended per 11 §7 and v3 14 §6.1). */
export function globalMultiplier(state: GameState, buffActive: boolean): number {
  return (
    (hasUpgrade(state, 'goldenInkwell') ? GOLDEN_INKWELL_MULT : 1) *
    achievementMultiplier(state) *
    bookshelfMultiplier(state) *
    inkRemembersMultiplier(state) *
    v3GlobalMultiplier(state) * // Atlas + …Happily Ever After
    quillMultiplier(state) *
    (buffActive ? buffProdMult(state) : 1)
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
  // A Hundred Whispers (Wandering Muse's unique bonus): click power ×2 (14 §4.2).
  const whispers = activeUniqueBonus(state, 'wanderingMuse');
  const whispersMult = whispers?.clickMult ?? 1;
  const base =
    CLICK_BASE *
    (hasUpgrade(state, 'sharpenedNib') ? SHARPENED_NIB_MULT : 1) *
    whispersMult *
    (state.meta.quillResonance ? quillMultiplier(state) : 1) *
    (buffActive ? BUFF.clickMult : 1) *
    (isSparkBuffActive(state, 'quillFrenzy', now) ? SPARK.frenzy.clickMult : 1);
  // Ink in the Margins (Ink Sprite's unique bonus): echo rate 1% → 2% (14 §4.2).
  // Latent if Ink Echo is not bought this run (the bonus only raises the RATE).
  const inkBonus = activeUniqueBonus(state, 'inkSprite');
  const echoRate = inkBonus?.inkEchoRate ?? INK_ECHO_RATE;
  const echo = hasUpgrade(state, 'inkEcho')
    ? echoRate * rawProduction(state, gossipActive) * globalMultiplier(state, buffActive)
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

/** Offline cap: 8h base, 12h with Lucid Dreaming, +12h Night Owl Pact,
 *  +24h Curator's Patience (→ 48h), +12h Deep Roots (World-Tree unique). */
export function offlineCapMs(state: GameState): number {
  let cap = state.run.upgrades.lucidDreaming ? OFFLINE.capMsUpgraded : OFFLINE.capMsBase;
  if (atelierLevel(state, 'nightOwlPact') >= 1) cap += NIGHT_OWL_EXTRA_CAP_MS;
  if (atelierLevel(state, 'curatorsPatience') >= 1) cap += CURATORS_PATIENCE_EXTRA_CAP_MS;
  const deepRoots = activeUniqueBonus(state, 'worldTreeArchive');
  if (deepRoots?.extraOfflineCapMs !== undefined) cap += deepRoots.extraOfflineCapMs;
  return cap;
}

/** Offline efficiency: 0.5 base, 0.75 with Lucid Dreaming, +0.10 Reader's Letter,
 *  +0.05 The Library Never Closes (Dream Library unique) — global cap 0.90 (14 §4.2). */
export function offlineEfficiency(state: GameState): number {
  let eff = state.run.upgrades.lucidDreaming
    ? OFFLINE.upgradedEfficiency
    : OFFLINE.baseEfficiency;
  if (hasRelic(state, 'readersLetter')) eff += READERS_LETTER_OFFLINE_BONUS;
  const library = activeUniqueBonus(state, 'dreamLibrary');
  if (library?.offlineEffBonus !== undefined) eff += library.offlineEffBonus;
  return Math.min(eff, OFFLINE_EFFICIENCY_CAP);
}

/** Spawn interval range for the Stray Spark (halved by Sparkcatcher's Net L1,
 *  further ×0.75 by The Garrison Sallies Forth — Saga Citadel unique, 14 §4.2).
 *  Read by the UI shell — the spawn timer itself lives outside the engine. */
export function sparkIntervalRange(state: GameState): { minMs: number; maxMs: number } {
  const div = atelierLevel(state, 'sparkcatchersNet') >= 1 ? SPARK.netIntervalDiv : 1;
  const garrison = activeUniqueBonus(state, 'sagaCitadel');
  const garrisonMult = garrison?.sparkIntervalMult ?? 1;
  return {
    minMs: (SPARK.intervalMinMs / div) * garrisonMult,
    maxMs: (SPARK.intervalMaxMs / div) * garrisonMult,
  };
}

/**
 * Shop visibility. mythEngine renders ONLY with Blueprint of Myths owned; tiers
 * 9–14 render only with the matching New Wing level (cfg.wing); every other
 * generator follows the v1 reveal rule. No teaser for gated rows — without the
 * gate the row must not exist at all (same pattern as blueprintOfMyths).
 */
export function isGeneratorVisibleInShop(state: GameState, id: GeneratorId): boolean {
  if (id === 'mythEngine' && atelierLevel(state, 'blueprintOfMyths') < 1) return false;
  const cfg = GENERATOR_INDEX[id];
  if (cfg.wing !== undefined && atelierLevel(state, 'theNewWing') < cfg.wing) return false;
  return isGeneratorRevealed(state, id);
}
