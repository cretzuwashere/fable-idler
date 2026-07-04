// 09 — The Gilded Atelier (10 §4.3). Real post-prestige flow, all through the
// UI: addInspiration(500k) → Publish the Tome via the real dialog → the
// Atelier tab appears (milestone theGildedDoor) → buy Apprentice Muse L1 for
// 1 🪶 → the purse decreases while the LIFETIME balance never moves (the
// golden rule, visible in the UI) and per-second production does NOT drop
// (the +30%/quill bonus anchors to lifetime, not to the wallet). The four
// relic slots are always visible with their progress. A second Publish then
// proves Apprentice Muse L1: the new run starts with 5 Wandering Muses.
//
// Note (05 §E2E v2 #5): after a prestige the center column disappears until
// the run milestones are re-earned — addInspiration() brings the tabs back.

import { formatRate, perSecond } from '../../src/engine';
import { addInspiration, expect, hookState, test, waitForHook } from './fixtures';

/** Publish the Tome through the real UI dialog and wait for the fade. */
async function publishViaUI(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('prestige-button').click();
  await expect(page.getByTestId('prestige-confirm-dialog')).toBeVisible();
  await page.getByTestId('prestige-checkbox').check();
  await page.getByTestId('prestige-confirm').click();
  const overlay = page.getByTestId('prestige-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveCount(0, { timeout: 10_000 });
}

test.describe('09 — Gilded Atelier', () => {
  test('purse spends, lifetime never moves, production never drops; Apprentice Muse seeds the next run', async ({
    page,
  }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    // No Atelier before the first Publish (milestone theGildedDoor).
    await expect(page.getByTestId('tab-atelier')).toHaveCount(0);

    // 500,000 totalEarned → Publish preview +2 🪶 (floor(sqrt(5)) = 2).
    await addInspiration(page, 500_000);
    await publishViaUI(page);

    // Post-prestige: re-earn the run milestones so the center tabs return.
    await addInspiration(page, 100_000);
    const atelierTab = page.getByTestId('tab-atelier');
    await expect(atelierTab).toBeVisible();

    // A generator so per-second is non-trivial before the Atelier purchase.
    await page.getByTestId('buy-wanderingMuse').click();

    await atelierTab.click();
    await expect(page.getByTestId('atelier-panel')).toBeVisible();

    // Double balance: Purse 2 🪶 / Lifetime earned 2 🪶.
    await expect(page.getByTestId('atelier-purse')).toContainText('2');
    await expect(page.getByTestId('atelier-lifetime')).toContainText('2');

    // The golden rule, permanently visible (not a tooltip).
    await expect(page.getByTestId('atelier-panel')).toContainText(
      'Spending from your purse never touches your renown.',
    );

    const before = await hookState(page);

    // Apprentice Muse L1 costs 1 🪶 (< 10 → no confirmation dialog).
    await page.getByTestId('atelier-buy-apprenticeMuse').click();
    await expect(page.getByTestId('atelier-confirm-dialog')).toHaveCount(0);

    // Purse 2 → 1; lifetime UNTOUCHED at 2 (golden rule).
    await expect(page.getByTestId('atelier-purse')).toContainText('1');
    await expect(page.getByTestId('atelier-lifetime')).toContainText('2');

    const after = await hookState(page);
    expect(after.meta.goldenQuills).toBe(1);
    expect(after.meta.stats.lifetimeQuillsEarned).toBe(2);
    expect(after.meta.atelier.apprenticeMuse).toBe(1);

    // Production NEVER decreases when the purse is spent (the +30%/quill
    // bonus reads lifetime, not the wallet). It may even inch UP: the first
    // Atelier commission unlocks the patronOfTheArts achievement (+1%) — so
    // the invariant is ≥, and the displayed rate must match the engine.
    const rateBefore = perSecond(before, before.lastTickAt);
    const rateAfter = perSecond(after, after.lastTickAt);
    expect(rateAfter).toBeGreaterThanOrEqual(rateBefore);
    await expect(page.getByTestId('per-second')).toHaveText(`+${formatRate(rateAfter)}/sec`);

    // Relics of the Published: all 4 slots visible, locked, with progress.
    for (const id of ['dogEaredPage', 'standingOvation', 'inkThatRemembers', 'readersLetter']) {
      await expect(page.getByTestId(`relic-${id}`)).toBeVisible();
      await expect(page.getByTestId(`relic-${id}`)).toHaveAttribute('data-state', 'locked');
    }
    await expect(page.getByTestId('relic-progress-dogEaredPage')).toContainText('1/3 tomes');

    // Second Publish (100k in this run → +1 🪶): Apprentice Muse L1 kicks in.
    await expect(page.getByTestId('prestige-preview')).toContainText('+1');
    await publishViaUI(page);

    const rebooted = await hookState(page);
    expect(rebooted.meta.tomesPublished).toBe(2);
    expect(rebooted.meta.goldenQuills).toBe(2); // 1 in the purse + 1 fresh
    expect(rebooted.meta.stats.lifetimeQuillsEarned).toBe(3);
    expect(rebooted.meta.atelier.apprenticeMuse).toBe(1); // survives the reset
    expect(rebooted.run.generators.wanderingMuse).toBe(5); // "Start each run with 5"
  });
});
