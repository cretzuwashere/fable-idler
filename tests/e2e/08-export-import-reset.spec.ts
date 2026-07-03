// 08 — BONUS (02 §6.2 "scenariul 8"): export → hard reset (double
// confirmation, typed RESET) → import → state restored. Also verifies the
// inline error for an unreadable import string.

import { SAVE_KEY } from '../../src/engine';
import { addInspiration, expect, hookState, saveNow, test, waitForHook } from './fixtures';

test.describe('08 — export / hard reset / import', () => {
  test('exported save survives a hard reset via import', async ({ page }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    await addInspiration(page, 1_234);
    await saveNow(page);

    // --- Export ---
    await page.getByTestId('settings-open').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();
    const exported = await page.getByTestId('settings-export').inputValue();
    expect(exported.length).toBeGreaterThan(0);
    expect(exported).toMatch(/^[A-Za-z0-9+/=]+$/); // base64

    // --- Hard reset: double confirmation, final button armed by typing RESET ---
    await page.getByTestId('settings-reset').click();
    await expect(page.getByTestId('reset-dialog-1')).toBeVisible();
    await page.getByTestId('settings-reset-continue').click();
    await expect(page.getByTestId('reset-dialog-2')).toBeVisible();

    const confirmReset = page.getByTestId('settings-reset-confirm');
    await expect(confirmReset).toBeDisabled();
    await page.getByTestId('settings-reset-input').fill('WRONG');
    await expect(confirmReset).toBeDisabled();
    await page.getByTestId('settings-reset-input').fill('RESET');
    await expect(confirmReset).toBeEnabled();
    await confirmReset.click();

    // Everything is gone: fresh solo state; the save key was deleted (the
    // next ~10s autosave may legitimately re-write a fresh state, so accept
    // "absent" OR "present but pristine").
    await expect(page.getByTestId('click-guide')).toBeVisible();
    const reset = await hookState(page);
    expect(reset.run.totalEarned).toBe(0);
    expect(reset.run.inspiration).toBe(0);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      expect(parsed.run.totalEarned).toBe(0);
      expect(parsed.meta.goldenQuills).toBe(0);
    }

    // --- Import: invalid string → inline error, no state change ---
    await page.getByTestId('settings-open').click();
    await page.getByTestId('settings-import').fill('this is not a save @@@');
    await page.getByTestId('settings-import-load').click();
    await expect(page.getByTestId('settings-import-error')).toBeVisible();
    expect((await hookState(page)).run.inspiration).toBe(0);

    // --- Import: the exported string restores the state ---
    await page.getByTestId('settings-import').fill(exported);
    await page.getByTestId('settings-import-load').click();
    await expect(page.getByTestId('settings-import-ok')).toBeVisible();

    const restored = await hookState(page);
    expect(restored.run.inspiration).toBe(1_234);
    expect(restored.run.totalEarned).toBe(1_234);

    await page.getByTestId('settings-panel-close').click();
    await expect(page.getByTestId('settings-panel')).toHaveCount(0);
    await expect(page.getByTestId('inspiration-amount')).toHaveText('1.23K');
  });
});
