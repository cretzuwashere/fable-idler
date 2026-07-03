// milestones.ts — reveal milestones #1–11 (run totalEarned / first achievement)
// + quantity milestones 25/50/100 per generator (`qty:<generatorId>:<threshold>`).
// Run-scoped: everything here resets at prestige (by design).

import { GENERATORS, QTY_MILESTONE_THRESHOLDS, REVEAL_MILESTONES } from './config';
import type { GameState, GeneratorId, RevealMilestoneConfig } from './types';

export function qtyMilestoneId(generator: GeneratorId, threshold: number): string {
  return `qty:${generator}:${threshold}`;
}

export function isRevealMilestoneReached(state: GameState, cfg: RevealMilestoneConfig): boolean {
  switch (cfg.requirement.kind) {
    case 'totalEarned':
      return state.run.totalEarned >= cfg.requirement.amount;
    case 'firstAchievement':
      return state.meta.achievements.length >= 1;
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
    for (const t of QTY_MILESTONE_THRESHOLDS) {
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
