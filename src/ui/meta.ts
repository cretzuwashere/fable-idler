// meta.ts — small UI-side constants that are NOT game balance.

/** Shown in the Settings panel. Keep in sync with package.json. */
export const APP_VERSION = '1.0.0';

/**
 * Minimum absence for the "While you were away" modal.
 * 04 §4.11 (≥ 60s) takes precedence over the 5-minute mention in 02 —
 * confirmed by the orchestrator task for Agent UI.
 */
export const OFFLINE_MODAL_UI_MIN_MS = 60_000;

// ---------------------------------------------------------------------------
// v2 (12-v2-ui-ux.md). UI-layer constants only — game balance stays in the
// engine config. These are the knobs 12 says must NOT be hardcoded in
// components (confirm threshold, top-N, reveal stagger).
// ---------------------------------------------------------------------------

/** Atelier purchases at or above this cost open a confirmation dialog (12 §2.2). */
export const ATELIER_CONFIRM_THRESHOLD_QUILLS = 10;

/** Hall of Fables shows top 20 (12 §6.2 — documented divergence from 09's top 50). */
export const LEADERBOARD_TOP_LIMIT = 20;

/** Auto-refresh interval for the leaderboard while the panel is visible. */
export const LEADERBOARD_REFRESH_MS = 60_000;

/** "Update now" button cooldown after a click (12 §6.1). */
export const LEADERBOARD_MANUAL_COOLDOWN_MS = 5_000;

/**
 * "Act 2" reveal at the first Publish (12 §1.4): Bookshelf → Atelier → Hall,
 * 250ms apart, starting as the 1400ms prestigeFade overlay clears (the
 * milestone events arrive ~500ms into the overlay, so base = 900ms).
 */
export const ACT2_REVEAL_BASE_MS = 900;
export const ACT2_REVEAL_STAGGER_MS = 250;

/** Lifetime one-shot flag for the spark tutorial toast (UI-only, not gameplay). */
export const SPARK_TUTORIAL_KEY = 'fable-idler-spark-tutorial-v1';
