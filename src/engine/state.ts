// state.ts — initial state factories + shared invariants.

import { GENERATORS } from './config';
import type { GameState, GeneratorId, MetaState, RunState } from './types';

export function createInitialGeneratorCounts(): Record<GeneratorId, number> {
  const counts = {} as Record<GeneratorId, number>;
  for (const g of GENERATORS) counts[g.id] = 0;
  return counts;
}

/** Fresh run state — also what a run looks like right after Publish the Tome.
 *  `now` anchors run.startedAt (0 = unknown, the v1→v2 migration sentinel). */
export function createInitialRunState(now: number = 0): RunState {
  return {
    inspiration: 0,
    totalEarned: 0,
    generators: createInitialGeneratorCounts(),
    upgrades: {},
    milestones: [],
    buff: { activeUntil: 0, cooldownUntil: 0 },
    // v2
    startedAt: now,
    sparkBuff: null,
    buffActivationsThisRun: 0,
    lastAutoBuyAt: 0,
  };
}

export function createInitialMetaState(): MetaState {
  return {
    goldenQuills: 0,
    tomesPublished: 0,
    achievements: [],
    quillResonance: false,
    stats: {
      totalClicks: 0,
      lifetimeInspiration: 0,
      buffActivations: 0,
      offlineSessionsOver30Min: 0,
      bestSingleOfflineGain: 0,
      // v2
      lifetimeQuillsEarned: 0,
      sparksCaught: 0,
      quillsFromFragments: 0,
      fastestPublishMs: null,
    },
    settings: {},
    // v2
    atelier: {},
    storyFragments: 0,
    fables: [],
  };
}

export function createInitialState(now: number = Date.now()): GameState {
  return {
    run: createInitialRunState(now),
    meta: createInitialMetaState(),
    lastTickAt: now,
  };
}
