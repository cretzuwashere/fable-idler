// 07 — Prestige (02 §6.2.7). addInspiration(500,000) via the hook → the
// Publish the Tome panel previews +2 Golden Quills (floor(sqrt(5)) = 2).
// Full confirmation flow: dialog → checkbox gates the final button → publish →
// prestigeFade overlay (~1.4s) → quills in the header, run reset (balance and
// generators back to zero), achievements still present.

import { addInspiration, expect, hookState, test, waitForHook } from './fixtures';

test.describe('07 — prestige', () => {
  test('publish the Tome: preview +2 quills, confirm flow, run resets, achievements persist', async ({
    page,
  }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    await addInspiration(page, 500_000);

    // Buy one generator through the UI so the reset is observable.
    await page.getByTestId('buy-wanderingMuse').click();
    expect((await hookState(page)).run.generators.wanderingMuse).toBe(1);

    const panel = page.getByTestId('prestige-panel');
    await expect(panel).toBeVisible();

    // Live preview: totalEarned 500,000 → floor(sqrt(5)) = 2 Golden Quills.
    await expect(page.getByTestId('prestige-preview')).toContainText('+2');

    // Achievements exist before prestige (Whispered Legends, A Thousand
    // Tales, The Storyteller Awakens) — they must survive.
    const before = await hookState(page);
    expect(before.meta.achievements.length).toBeGreaterThan(0);

    // Confirmation flow: dialog opens, final button is gated by the checkbox.
    await page.getByTestId('prestige-button').click();
    await expect(page.getByTestId('prestige-confirm-dialog')).toBeVisible();
    const confirmBtn = page.getByTestId('prestige-confirm');
    await expect(confirmBtn).toBeDisabled();
    await page.getByTestId('prestige-checkbox').check();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // prestigeFade overlay covers the UI, then clears (~1.4s total).
    const overlay = page.getByTestId('prestige-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveCount(0, { timeout: 10_000 });

    // Header chip: 🪶 2 Golden Quills.
    const quillsChip = page.getByTestId('golden-quills');
    await expect(quillsChip).toBeVisible();
    await expect(quillsChip).toContainText('2');

    const after = await hookState(page);
    expect(after.meta.goldenQuills).toBe(2);
    expect(after.meta.tomesPublished).toBe(1);

    // Run reset: balance, totalEarned and every generator back to zero.
    expect(after.run.inspiration).toBe(0);
    expect(after.run.totalEarned).toBe(0);
    for (const count of Object.values(after.run.generators)) {
      expect(count).toBe(0);
    }
    expect(after.run.upgrades).toEqual({});
    await expect(page.getByTestId('generator-wanderingMuse')).toHaveCount(0);
    await expect(page.getByTestId('inspiration-amount')).toHaveText('0');

    // Achievements persist (plus the freshly earned Published Author).
    for (const id of before.meta.achievements) {
      expect(after.meta.achievements).toContain(id);
    }
    expect(after.meta.achievements).toContain('publishedAuthor');
    await expect(page.getByTestId('tab-achievements')).toBeVisible();
  });
});
