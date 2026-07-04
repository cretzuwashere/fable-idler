// atelier.ts — The Gilded Atelier (v2): permanent upgrades bought with Golden
// Quills, plus the Relics derived from tomesPublished.
//
// GOLDEN RULE (09 §1.1 / 11 §1.1): buying here spends ONLY the wallet
// (meta.goldenQuills). meta.stats.lifetimeQuillsEarned — the basis of the
// +30%/quill production bonus — is monotonic and is NEVER touched by a
// purchase. Production can therefore never drop from spending, by construction.

import {
  APPRENTICE_MUSE_START_MUSES,
  ATELIER_UPGRADES,
  ATELIER_UPGRADE_INDEX,
  PERPETUAL_MANUSCRIPT_KEPT_IDS,
  RELICS,
  RELIC_INDEX,
  SECOND_BOOKMARK_KEPT,
  UPGRADES,
} from './config';
import type {
  AtelierUpgradeId,
  GameState,
  RelicId,
  RunUpgradeId,
} from './types';

// ---------------------------------------------------------------------------
// Levels / costs / purchase
// ---------------------------------------------------------------------------

/** Current level of an Atelier upgrade (0 = not owned). */
export function atelierLevel(state: GameState, id: AtelierUpgradeId): number {
  return state.meta.atelier[id] ?? 0;
}

export function atelierMaxLevel(id: AtelierUpgradeId): number {
  return ATELIER_UPGRADE_INDEX[id].costs.length;
}

/** Cost (in wallet quills) of the NEXT level; null when already maxed. */
export function atelierNextCost(state: GameState, id: AtelierUpgradeId): number | null {
  const costs = ATELIER_UPGRADE_INDEX[id].costs;
  const level = atelierLevel(state, id);
  return level >= costs.length ? null : costs[level];
}

export function canBuyAtelierUpgrade(state: GameState, id: AtelierUpgradeId): boolean {
  const cost = atelierNextCost(state, id);
  return cost !== null && state.meta.goldenQuills >= cost;
}

/**
 * Buy the next level of an Atelier upgrade. No-op (same reference) when maxed
 * or unaffordable. Decrements ONLY the wallet — lifetimeQuillsEarned untouched.
 */
export function buyAtelierUpgrade(state: GameState, id: AtelierUpgradeId): GameState {
  const cost = atelierNextCost(state, id);
  if (cost === null || state.meta.goldenQuills < cost) return state;
  return {
    ...state,
    meta: {
      ...state.meta,
      goldenQuills: state.meta.goldenQuills - cost,
      atelier: { ...state.meta.atelier, [id]: atelierLevel(state, id) + 1 },
    },
  };
}

/** True once any Atelier upgrade is owned (Patron of the Arts). */
export function hasAnyAtelierUpgrade(state: GameState): boolean {
  return ATELIER_UPGRADES.some((u) => atelierLevel(state, u.id) >= 1);
}

/** True when every Atelier upgrade is at max level (Full Patronage). */
export function isAtelierComplete(state: GameState): boolean {
  return ATELIER_UPGRADES.every((u) => atelierLevel(state, u.id) >= u.costs.length);
}

// ---------------------------------------------------------------------------
// Relics — derived from meta.tomesPublished, never stored (09 §1.4)
// ---------------------------------------------------------------------------

export function hasRelic(state: GameState, id: RelicId): boolean {
  return state.meta.tomesPublished >= RELIC_INDEX[id].tomes;
}

/** Ids of the relics currently unlocked, in config (threshold) order. */
export function unlockedRelics(state: GameState): RelicId[] {
  return RELICS.filter((r) => state.meta.tomesPublished >= r.tomes).map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Effects used at run construction (prestige.ts)
// ---------------------------------------------------------------------------

/** Wandering Muses granted at the start of each run (Apprentice Muse). */
export function apprenticeStartMuses(state: GameState): number {
  const level = atelierLevel(state, 'apprenticeMuse');
  return level > 0 ? APPRENTICE_MUSE_START_MUSES[level - 1] : 0;
}

/**
 * Second Bookmark: the K cheapest OWNED run upgrades (by config cost — 09 §1.2,
 * deterministic; ties broken by config order, which Array.sort keeps stable)
 * survive the reset at Publish the Tome.
 *
 * v3 — Perpetual Manuscript (13 §4.1 #14) is a SUPERSET: it keeps all 10 v1 run
 * upgrades. The 7 v3 re-scalers (§2.4) are NEVER kept by either — they stay the
 * per-run shopping arc of long runs (PERPETUAL_MANUSCRIPT_KEPT_IDS excludes them,
 * and Second Bookmark only ever considers the same 10 v1 ids).
 */
export function bookmarkedUpgrades(state: GameState): Partial<Record<RunUpgradeId, true>> {
  const kept: Partial<Record<RunUpgradeId, true>> = {};

  // Perpetual Manuscript first: keep every OWNED v1 run upgrade.
  if (atelierLevel(state, 'perpetualManuscript') >= 1) {
    for (const id of PERPETUAL_MANUSCRIPT_KEPT_IDS) {
      if (state.run.upgrades[id] === true) kept[id] = true;
    }
  }

  // Second Bookmark: the K cheapest owned v1 run upgrades (union with the above).
  const level = atelierLevel(state, 'secondBookmark');
  if (level > 0) {
    const keptCount = SECOND_BOOKMARK_KEPT[level - 1];
    const owned = UPGRADES.filter(
      (u) =>
        u.id !== 'quillResonance' &&
        // Second Bookmark only considers the 10 v1 run upgrades, never the v3
        // re-scalers (their config cost would otherwise sort them "cheapest"
        // only relative to each other; they must stay per-run regardless).
        PERPETUAL_MANUSCRIPT_KEPT_IDS.includes(u.id as RunUpgradeId) &&
        state.run.upgrades[u.id as RunUpgradeId] === true,
    );
    const cheapest = [...owned].sort((a, b) => a.cost - b.cost).slice(0, keptCount);
    for (const u of cheapest) kept[u.id as RunUpgradeId] = true;
  }

  return kept;
}

// ---------------------------------------------------------------------------
// v3 — New Wing gating + auto-buy gate
// ---------------------------------------------------------------------------

/** Current level of The New Wing (0/1/2/3) — the content gate for tiers 9–14. */
export function newWingLevel(state: GameState): number {
  return atelierLevel(state, 'theNewWing');
}

/** Clockwork Understudy auto-buys EVERY generator (requires Self-Writing Contract
 *  as its prerequisite, 13 §4.1 #12; the reducer/tick own the actual purchases). */
export function hasClockworkUnderstudy(state: GameState): boolean {
  return atelierLevel(state, 'clockworkUnderstudy') >= 1;
}
