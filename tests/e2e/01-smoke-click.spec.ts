// 01 — Smoke + click (02 §6.2.1). Pure scenario: no test hook, plain '/'.
// The page loads, the branding is visible, and clicking the Weave area
// increases the Inspiration counter by the displayed click power (1/click).

import { expect, test } from './fixtures';

test.describe('01 — smoke + click', () => {
  test('page loads with branding and the click area', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Fable Idler/);
    await expect(page.getByRole('heading', { name: 'Fable Idler' })).toBeVisible();

    // Core HUD elements of a fresh save
    await expect(page.getByTestId('click-area')).toBeVisible();
    await expect(page.getByTestId('inspiration-amount')).toHaveText('0');
    await expect(page.getByTestId('per-second')).toContainText('/sec');

    // Fresh save starts in solo mode with the guide text
    await expect(page.getByTestId('click-guide')).toBeVisible();
  });

  test('clicking increases the Inspiration counter', async ({ page }) => {
    await page.goto('/');

    const amount = page.getByTestId('inspiration-amount');
    const clickArea = page.getByTestId('click-area');
    await expect(amount).toHaveText('0');

    // Base click power is 1 → three clicks show exactly 3 (no generators yet,
    // so there is no idle drift to blur the assertion).
    await clickArea.click();
    await expect(amount).toHaveText('1');
    await clickArea.click();
    await clickArea.click();
    await expect(amount).toHaveText('3');
  });
});
