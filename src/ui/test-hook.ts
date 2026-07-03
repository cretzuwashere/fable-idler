// test-hook.ts — window.__FABLE_TEST__, installed ONLY with ?test=1 (02 §6.3).
// Works on the production nginx build (that is the point: E2E tests the shipped
// artifact). The function names are contract: Agent 8 uses them verbatim.
// addInspiration / fastForward map onto the engine's debug actions (05 decision #12).

import type { Action, GameState, GameStore } from '../engine';

export interface FableTestHook {
  getState(): GameState;
  dispatch(action: Action): void;
  /** Credits balance AND run totalEarned (+ lifetime stats), then re-checks unlocks. */
  addInspiration(n: number): void;
  /** Simulates the interval [now - ms, now] through real ticks (≤60s chunks). */
  fastForward(ms: number): void;
  saveNow(): void;
}

declare global {
  interface Window {
    __FABLE_TEST__?: FableTestHook;
  }
}

export function installTestHook(store: GameStore): void {
  if (typeof window === 'undefined') return;
  if (new URLSearchParams(window.location.search).get('test') !== '1') return;
  window.__FABLE_TEST__ = {
    getState: () => store.getState(),
    dispatch: (action: Action) => store.dispatch(action),
    addInspiration: (n: number) => store.dispatch({ type: 'debugAddInspiration', amount: n }),
    fastForward: (ms: number) => store.dispatch({ type: 'debugFastForward', ms }),
    saveNow: () => store.save(),
  };
}
