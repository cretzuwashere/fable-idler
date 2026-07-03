// main.tsx — bootstrap, exactly as specified in 05-implementation-log.md:
// load save → compute + apply offline report → createGameStore → render <App/>
// in StrictMode → installTestHook(store) → store.start().

// Self-hosted fonts (04 §2 — bundled by Vite, zero external requests)
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource-variable/inter';
// Global styles: tokens first, then the animation library
import './ui/styles/tokens.css';
import './ui/styles/animations.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  applyOfflineReport,
  computeOfflineReport,
  createGameStore,
  createInitialState,
  loadSave,
} from './engine';
import type { GameState, OfflineReport } from './engine';
import { App } from './ui/App';
import { StoreProvider } from './ui/hooks/useGameStore';
import { OFFLINE_MODAL_UI_MIN_MS } from './ui/meta';
import { installTestHook } from './ui/test-hook';

const now = Date.now();
const loaded = loadSave(localStorage);

let initialState: GameState;
let offlineReport: OfflineReport | null = null;

if (loaded) {
  const report = computeOfflineReport(loaded.state, loaded.savedAt, now);
  initialState = applyOfflineReport(loaded.state, report, now);
  // "While you were away" from ≥60s absence (04 §4.11 takes precedence over
  // the 5-minute mention in 02) and only when there is something to celebrate.
  if (report.elapsedMs >= OFFLINE_MODAL_UI_MIN_MS && report.gained > 0) {
    offlineReport = report;
  }
} else {
  initialState = createInitialState(now);
}

const store = createGameStore(initialState);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Fable Idler: #root element is missing from index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App offlineReport={offlineReport} />
    </StoreProvider>
  </StrictMode>,
);

installTestHook(store);
store.start();

// Persist on the reliable exit signals (02 §5): visibilitychange → hidden is
// the primary channel (mobile-safe), beforeunload the desktop backup.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.save();
});
window.addEventListener('beforeunload', () => {
  store.save();
});
