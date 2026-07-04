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
 */
export function bookmarkedUpgrades(state: GameState): Partial<Record<RunUpgradeId, true>> {
  const level = atelierLevel(state, 'secondBookmark');
  if (level === 0) return {};
  const keptCount = SECOND_BOOKMARK_KEPT[level - 1];
  const owned = UPGRADES.filter(
    (u) => u.id !== 'quillResonance' && state.run.upgrades[u.id as RunUpgradeId] === true,
  );
  const cheapest = [...owned].sort((a, b) => a.cost - b.cost).slice(0, keptCount);
  const kept: Partial<Record<RunUpgradeId, true>> = {};
  for (const u of cheapest) kept[u.id as RunUpgradeId] = true;
  return kept;
}
