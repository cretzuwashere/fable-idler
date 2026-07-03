// 03 — Upgrades (02 §6.2.3). Fund the run via the hook (addInspiration), buy
// Sharpened Nib through the real UI, and verify the REAL effect: the per-click
// delta doubles (1 → 2, exact — no generators, so no idle drift). Then check
// the purchased state (card moves into the collapsed "Purchased" section and
// keeps its data-testid, per the Agent UI contract).

import { addInspiration, expect, hookState, test, waitForHook } from './fixtures';

test.describe('03 — upgrades', () => {
  test('Sharpened Nib doubles click power and ends up in the Purchased section', async ({
    page,
  }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    // 200 totalEarned: unlocks Sharpened Nib (50) and the Upgrades tab (100),
    // and comfortably covers the 100 cost.
    await addInspiration(page, 200);

    const tab = page.getByTestId('tab-upgrades');
    await expect(tab).toBeVisible();

    const clickArea = page.getByTestId('click-area');

    // Per-click delta BEFORE the upgrade: exactly +1.
    const before = await hookState(page);
    await clickArea.click();
    const afterOneClick = await hookState(page);
    expect(afterOneClick.run.inspiration - before.run.inspiration).toBe(1);

    // Buy the upgrade through the real UI.
    await tab.click();
    const nib = page.getByTestId('upgrade-sharpenedNib');
    await expect(nib).toBeVisible();
    await expect(nib).toBeEnabled();
    await nib.click();

    const bought = await hookState(page);
    expect(bought.run.upgrades.sharpenedNib).toBe(true);
    // Cost deducted: 201 - 100 = 101.
    expect(bought.run.inspiration).toBe(101);

    // Per-click delta AFTER the upgrade: exactly +2.
    await clickArea.click();
    const afterUpgradedClick = await hookState(page);
    expect(afterUpgradedClick.run.inspiration - bought.run.inspiration).toBe(2);

    // Purchased state: the card left the available grid…
    await expect(page.getByTestId('upgrade-sharpenedNib')).toHaveCount(0);
    // …and lives in the collapsed "Purchased (1)" section, testid intact.
    const toggle = page.getByTestId('upgrades-purchased-toggle');
    await expect(toggle).toContainText('Purchased (1)');
    await toggle.click();
    const purchasedCard = page.getByTestId('upgrade-sharpenedNib');
    await expect(purchasedCard).toBeVisible();
    await expect(purchasedCard).toContainText('✓');
  });
});
