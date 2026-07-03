// fixtures.ts — shared Playwright fixture (02 §6.2).
// Wraps the built-in `page` fixture so that EVERY spec automatically collects
// page.on('pageerror') + console messages of type "error" and FAILS the test
// at teardown if any were seen. This covers the "no critical console errors"
// acceptance criterion in every scenario, not just one.
//
// All specs import { test, expect } from './fixtures' — never from
// '@playwright/test' directly.

import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(`pageerror: ${err.message}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    await use(page);

    expect(
      errors,
      `Console/page errors were emitted during the test:\n${errors.join('\n')}`,
    ).toEqual([]);
  },
});

export { expect };

// ---------------------------------------------------------------------------
// window.__FABLE_TEST__ helpers (02 §6.3 contract; installed only with ?test=1)
// ---------------------------------------------------------------------------

/** Wait for the ?test=1 hook to be installed (it lands right after render). */
export async function waitForHook(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__FABLE_TEST__ !== undefined);
}

/** Snapshot of the full GameState via the test hook (JSON-serialized). */
export async function hookState(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).__FABLE_TEST__.getState());
}

/** Credits balance AND run totalEarned (+ lifetime stats), then re-checks unlocks. */
export async function addInspiration(page: Page, amount: number): Promise<void> {
  await page.evaluate((n) => (window as any).__FABLE_TEST__.addInspiration(n), amount);
}

/** Simulates the interval [now - ms, now] through real ticks (≤60s chunks). */
export async function fastForward(page: Page, ms: number): Promise<void> {
  await page.evaluate((n) => (window as any).__FABLE_TEST__.fastForward(n), ms);
}

/** Force-persist the current state right now. */
export async function saveNow(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__FABLE_TEST__.saveNow());
}
