// 04 — Progressive unlocks (02 §6.2.4).
// - milestone toast for "The First Spark" (10 totalEarned, from real clicks)
// - the Achievements section (data-testid="tab-achievements", per the Agent UI
//   contract it is the AchievementGrid root on every layout) appears after the
//   first achievement (First Words — very first click)
// - the Upgrades tab appears at 100 totalEarned (Craftsman's Tools)

import { ACHIEVEMENTS } from '../../src/engine';
import { addInspiration, expect, test, waitForHook } from './fixtures';

test.describe('04 — unlocks', () => {
  test('toast at The First Spark; Achievements after first achievement; Upgrades at 100', async ({
    page,
  }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    // Nothing unlocked on a fresh save.
    await expect(page.getByTestId('tab-upgrades')).toHaveCount(0);
    await expect(page.getByTestId('tab-achievements')).toHaveCount(0);

    // 10 real clicks → totalEarned 10 → The First Spark.
    const clickArea = page.getByTestId('click-area');
    for (let i = 0; i < 10; i++) {
      await clickArea.click();
    }

    // Milestone toast (max 3 visible, auto-dismiss 4s — assert promptly).
    const sparkToast = page.getByTestId('toast').filter({ hasText: 'The First Spark' });
    await expect(sparkToast).toBeVisible();
    await expect(sparkToast).toHaveAttribute('data-toast-kind', 'milestone');

    // First click unlocked the "First Words" achievement → Hall of Deeds →
    // the Achievements section is now on screen, with 1/N unlocked. N comes
    // from the engine config (14 in v1, 24 in v2) — the UI header is dynamic
    // ({unlocked}/{ACHIEVEMENTS.length}), so the assert is too.
    await expect(page.getByTestId('tab-achievements')).toBeVisible();
    await expect(page.getByTestId('achievements-count')).toContainText(
      `1/${ACHIEVEMENTS.length}`,
    );
    await expect(page.getByTestId('achievement-firstWords')).toBeVisible();

    // Still under 100 totalEarned → no Upgrades tab yet.
    await expect(page.getByTestId('tab-upgrades')).toHaveCount(0);

    // Top up to exactly 100 totalEarned (10 + 90) → Craftsman's Tools.
    await addInspiration(page, 90);
    await expect(page.getByTestId('tab-upgrades')).toBeVisible();
  });
});
