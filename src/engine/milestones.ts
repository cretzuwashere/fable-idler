// milestones.ts — reveal milestones #1–11 (run totalEarned / first achievement)
// + quantity milestones 25/50/100 per generator (`qty:<generatorId>:<threshold>`).
// Run-scoped: everything here resets at prestige (by design).

import {
  GENERATORS,
  QTY_MILESTONE_THRESHOLDS,
  QTY_THRESHOLDS_V3,
  REVEAL_MILESTONES,
  UNIQUE_THRESHOLD,
} from './config';
import { atelierLevel } from './atelier';
import type { GameState, GeneratorId, RevealMilestoneConfig } from './types';

export function qtyMilestoneId(generator: GeneratorId, threshold: number): string {
  return `qty:${generator}:${threshold}`;
}

/** Every quantity threshold that earns a milestone badge (v1 25/50/100 + v3
 *  150/200/300/400/500; 200 is the UNIQUE-bonus threshold — also badged). */
const QTY_BADGE_THRESHOLDS: readonly number[] = [
  ...QTY_MILESTONE_THRESHOLDS,
  UNIQUE_THRESHOLD,
  ...QTY_THRESHOLDS_V3,
].sort((a, b) => a - b);

export function isRevealMilestoneReached(state: GameState, cfg: RevealMilestoneConfig): boolean {
  switch (cfg.requirement.kind) {
    case 'totalEarned':
      return state.run.totalEarned >= cfg.requirement.amount;
    case 'firstAchievement':
      return state.meta.achievements.length >= 1;
    // v2 — theGildedDoor / theFirstSpine / wordTravelsFast: meta-based, so they
    // re-add instantly after every prestige (same mechanism as hallOfDeeds).
    case 'tomesPublished':
      return state.meta.tomesPublished >= cfg.requirement.count;
    // v3 — a tier-9+ reveal: run totalEarned reached AND The New Wing at `wing`
    // (the shop row is separately gated by isGeneratorVisibleInShop).
    case 'totalEarnedAndWing':
      return (
        state.run.totalEarned >= cfg.requirement.amount &&
        atelierLevel(state, 'theNewWing') >= cfg.requirement.wing
      );
  }
}

export function hasMilestone(state: GameState, id: string): boolean {
  return state.run.milestones.includes(id);
}

/**
 * Add any newly reached milestones (reveal + quantity).
 * Returns the SAME state reference when nothing new unlocked.
 */
export function checkMilestones(state: GameState): GameState {
  let added: string[] | null = null;
  const has = new Set(state.run.milestones);

  for (const cfg of REVEAL_MILESTONES) {
    if (!has.has(cfg.id) && isRevealMilestoneReached(state, cfg)) {
      (added ??= []).push(cfg.id);
    }
  }
  for (const g of GENERATORS) {
    const owned = state.run.generators[g.id];
    for (const t of QTY_BADGE_THRESHOLDS) {
      if (owned >= t) {
        const id = qtyMilestoneId(g.id, t);
        if (!has.has(id)) (added ??= []).push(id);
      }
    }
  }

  if (!added) return state;
  return {
    ...state,
    run: { ...state.run, milestones: [...state.run.milestones, ...added] },
  };
}
