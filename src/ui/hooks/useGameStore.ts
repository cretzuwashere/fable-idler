// useGameStore.ts — React ↔ engine integration (02 §3).
// A single StoreProvider (the store is created once in main.tsx) + a single
// useGameStore() hook built on React 18's native useSyncExternalStore.
// No state-management libraries, no per-component selector subscriptions (v1).

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import { useSyncExternalStore } from 'react';
import type { Action, GameEvent, GameState, GameStore } from '../../engine';

const StoreContext = createContext<GameStore | null>(null);

export function StoreProvider(props: { store: GameStore; children: ReactNode }) {
  return createElement(StoreContext.Provider, { value: props.store }, props.children);
}

/** The raw store — for event subscriptions and imperative saves. */
export function useStore(): GameStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used inside <StoreProvider>');
  }
  return store;
}

/** The whole GameState, re-rendered on every store notification (~10fps). */
export function useGameStore(): GameState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** Stable dispatch function. */
export function useDispatch(): (action: Action) => void {
  const store = useStore();
  return useCallback((action: Action) => store.dispatch(action), [store]);
}

/** Subscribe to consumable unlock events (milestones/achievements) for toasts. */
export function useGameEvents(handler: (event: GameEvent) => void): void {
  const store = useStore();
  useEffect(() => store.subscribeToEvents(handler), [store, handler]);
}
