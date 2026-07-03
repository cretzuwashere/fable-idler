// 05 — Persistence (02 §6.2.5). Play (click, buy a generator and an upgrade),
// reload the page, and verify the state survived: balance (± the production
// earned in the interval), generator count, purchased upgrade. Covers the
// "no data loss on refresh" acceptance criterion.

import { addInspiration, expect, hookState, saveNow, test, waitForHook } from './fixtures';

test.describe('05 — persistence', () => {
  test('balance, generator count and upgrades survive a reload', async ({ page }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    // Play: a few real clicks + funding, then buy through the real UI.
    const clickArea = page.getByTestId('click-area');
    for (let i = 0; i < 5; i++) {
      await clickArea.click();
    }
    await addInspiration(page, 300);

    await page.getByTestId('buy-wanderingMuse').click(); // -15
    await page.getByTestId('tab-upgrades').click();
    await page.getByTestId('upgrade-sharpenedNib').click(); // -100

    await saveNow(page);
    const before = await hookState(page);
    expect(before.run.generators.wanderingMuse).toBe(1);
    expect(before.run.upgrades.sharpenedNib).toBe(true);

    await page.reload();
    await waitForHook(page);

    const after = await hookState(page);

    // Generator count and upgrade survived exactly.
    expect(after.run.generators.wanderingMuse).toBe(1);
    expect(after.run.upgrades.sharpenedNib).toBe(true);
    expect(after.run.totalEarned).toBeGreaterThanOrEqual(before.run.totalEarned);

    // Balance: never lower than what we saved, and only higher by the small
    // production earned across the reload (0.1/sec, offline at 50%) — a
    // generous 30-second budget still catches real data loss.
    expect(after.run.inspiration).toBeGreaterThanOrEqual(before.run.inspiration - 1e-6);
    expect(after.run.inspiration).toBeLessThan(before.run.inspiration + 3);

    // The UI reflects the restored state too.
    await expect(page.getByTestId('generator-wanderingMuse')).toContainText('×1 owned');
    await page.getByTestId('tab-upgrades').click();
    await expect(page.getByTestId('upgrades-purchased-toggle')).toContainText('Purchased (1)');
    // No "While you were away" modal for a sub-minute gap.
    await expect(page.getByTestId('offline-modal')).toHaveCount(0);
  });
});
