// meta.ts — small UI-side constants that are NOT game balance.

/** Shown in the Settings panel. Keep in sync with package.json. */
export const APP_VERSION = '1.0.0';

/**
 * Minimum absence for the "While you were away" modal.
 * 04 §4.11 (≥ 60s) takes precedence over the 5-minute mention in 02 —
 * confirmed by the orchestrator task for Agent UI.
 */
export const OFFLINE_MODAL_UI_MIN_MS = 60_000;
