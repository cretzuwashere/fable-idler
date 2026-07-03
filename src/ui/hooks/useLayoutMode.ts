// useLayoutMode.ts — which of the three 04 §3 layouts is active.
// JS-driven (matchMedia) because the three breakpoints render different
// structures (tab sets), not just different CSS arrangements.

import { useSyncExternalStore } from 'react';

export type LayoutMode = 'desktop' | 'tablet' | 'mobile';

const DESKTOP_QUERY = '(min-width: 1100px)';
const TABLET_QUERY = '(min-width: 720px)';

function subscribe(onChange: () => void): () => void {
  const desktop = window.matchMedia(DESKTOP_QUERY);
  const tablet = window.matchMedia(TABLET_QUERY);
  desktop.addEventListener('change', onChange);
  tablet.addEventListener('change', onChange);
  return () => {
    desktop.removeEventListener('change', onChange);
    tablet.removeEventListener('change', onChange);
  };
}

function getSnapshot(): LayoutMode {
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'mobile';
}

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'desktop');
}

/** OS-level prefers-reduced-motion (combined with the Settings toggle in App). */
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
}
