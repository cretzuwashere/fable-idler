// Shared test helpers (not a test file — no .test.ts suffix).
import { createInitialState } from '../../src/engine';
import type { GameState } from '../../src/engine';

/**
 * Build a state anchored at t=0 and apply setup mutations.
 * Mutation is safe here: createInitialState returns freshly built objects
 * and the engine itself never mutates state.
 */
export function makeState(mutate?: (s: GameState) => void): GameState {
  const s = createInitialState(0);
  if (mutate) mutate(s);
  return s;
}
