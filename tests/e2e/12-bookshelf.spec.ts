// 12 — The Bookshelf (10 §4.3). A real Publish through the UI mints fable #1:
// the bookshelf-panel appears (milestone theFirstSpine) with exactly one
// spine, a non-empty procedural title and a stats tooltip. A second Publish
// adds a second spine and the production bonus in the shelf header grows
// (+2% per UNIQUE title, so the expected % is computed from the state — a
// duplicate title is a legitimate "reprint" that counts once).

import { addInspiration, expect, hookState, test, waitForHook } from './fixtures';

async function publishViaUI(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('prestige-button').click();
  await expect(page.getByTestId('prestige-confirm-dialog')).toBeVisible();
  await page.getByTestId('prestige-checkbox').check();
  await page.getByTestId('prestige-confirm').click();
  const overlay = page.getByTestId('prestige-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveCount(0, { timeout: 10_000 });
}

test.describe('12 — Bookshelf', () => {
  test('first Publish shelves fable #1 with tooltip; the second adds a spine and grows the header bonus', async ({
    page,
  }) => {
    test.slow(); // two full toast-queue drains live inside this scenario
    await page.goto('/?test=1');
    await waitForHook(page);

    // No shelf before the first Publish.
    await expect(page.getByTestId('bookshelf-panel')).toHaveCount(0);

    await addInspiration(page, 500_000);

    // addInspiration bursts ~a dozen milestone/achievement toasts (max 3
    // visible, 4s each). Let the queue drain BEFORE publishing so the fable
    // toast below belongs to the Publish wave, not to a 25s backlog.
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 45_000 });

    await publishViaUI(page);

    // The fable toast fires with the Publish (behind the few re-earned
    // milestone toasts of the new run — give it their drain window).
    await expect(page.locator('[data-toast-kind="fable"]')).toBeVisible({ timeout: 20_000 });

    // The shelf re-appears on its own (tome-derived milestones re-earn
    // instantly) with EXACTLY one spine.
    const shelf = page.getByTestId('bookshelf-panel');
    await expect(shelf).toBeVisible();
    await expect(page.getByTestId('bookshelf-count')).toContainText('1 fable');
    await expect(page.getByTestId('bookshelf-count')).toContainText('+2% production');

    const spine1 = page.getByTestId('fable-spine-1');
    await expect(spine1).toBeVisible();
    await expect(page.getByTestId('fable-spine-2')).toHaveCount(0);

    // A real (non-migrated) fable: full run stats, not faded, title minted.
    const one = await hookState(page);
    expect(one.meta.fables).toHaveLength(1);
    const fable1 = one.meta.fables[0];
    expect(fable1.n).toBe(1);
    expect(fable1.title.length).toBeGreaterThan(0);
    expect(fable1.runStats).not.toBeNull();
    expect(fable1.runStats.totalEarned).toBeGreaterThanOrEqual(500_000);
    await expect(spine1).not.toHaveAttribute('data-faded', 'true');

    // Tooltip on hover: title + "Tome #1" + the run's earnings.
    await spine1.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(fable1.title);
    await expect(tooltip).toContainText('Tome #1');
    await expect(tooltip).toContainText('Earned');
    await page.mouse.move(0, 0); // close the tooltip

    // Second Publish → 2 spines, bigger bonus in the header.
    await addInspiration(page, 100_000);
    await publishViaUI(page);

    const two = await hookState(page);
    expect(two.meta.fables).toHaveLength(2);
    const uniqueTitles = new Set(two.meta.fables.map((f: { title: string }) => f.title)).size;

    await expect(page.getByTestId('bookshelf-count')).toContainText('2 fables');
    await expect(page.getByTestId('bookshelf-count')).toContainText(
      `+${uniqueTitles * 2}% production`,
    );
    await expect(page.getByTestId('fable-spine-1')).toBeVisible();
    await expect(page.getByTestId('fable-spine-2')).toBeVisible();
  });
});
