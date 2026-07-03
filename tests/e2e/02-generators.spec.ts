// 02 — Generators (02 §6.2.2). All ACTIONS are pure (15 real clicks, real buy
// button). The hook is used read-only (getState) so the "balance grows WITHOUT
// clicking" assertion can compare exact floats instead of the floored display
// (0.1/sec would need ~10s to move the formatted counter by a whole digit).

import { addInspiration, expect, hookState, test, waitForHook } from './fixtures';

test.describe('02 — generators', () => {
  test('buy a Wandering Muse from ~15 real clicks; idle production grows the balance', async ({
    page,
  }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    const clickArea = page.getByTestId('click-area');

    // 15 real clicks → totalEarned 15: The First Spark (10) reveals the
    // generator panel and the Wandering Muse costs exactly 15.
    for (let i = 0; i < 15; i++) {
      await clickArea.click();
    }

    const row = page.getByTestId('generator-wanderingMuse');
    await expect(row).toBeVisible();

    const buy = page.getByTestId('buy-wanderingMuse');
    await expect(buy).toBeEnabled(); // balance 15 ≥ cost 15
    await buy.click();

    await expect(row).toContainText('×1 owned');

    // /sec > 0: one muse produces 0.1/sec
    await expect(page.getByTestId('per-second')).toHaveText('+0.1/sec');
    const state = await hookState(page);
    expect(state.run.generators.wanderingMuse).toBe(1);

    // Balance grows WITHOUT clicking over 2–3 seconds.
    const before = (await hookState(page)).run.inspiration;
    await page.waitForTimeout(2500);
    const after = (await hookState(page)).run.inspiration;
    expect(after).toBeGreaterThan(before);
    // Sanity: roughly 0.1/sec × 2.5s, generous bounds against timer jitter.
    expect(after - before).toBeGreaterThan(0.15);
    expect(after - before).toBeLessThan(1);
  });

  test('the buy button is disabled while the generator is unaffordable', async ({ page }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    // Reveal the panel (The First Spark at 10) but stay under the muse's
    // cost of 15 → the row is visible yet the buy button is disabled.
    await addInspiration(page, 10);
    const row = page.getByTestId('generator-wanderingMuse');
    await expect(row).toBeVisible();
    await expect(page.getByTestId('buy-wanderingMuse')).toBeDisabled();
  });
});
