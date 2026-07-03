// 06 — Offline progress (02 §6.2.6). page.addInitScript plants a VALID save
// with savedAt = Date.now() - 1h in localStorage BEFORE the page loads, so the
// test exercises the real load → computeOfflineReport → modal code path (no
// hook cheating). Save shape per 05-implementation-log.md (Agent 5 note for
// Agent 8): version/savedAt/run{inspiration,totalEarned,generators}/
// meta{goldenQuills,tomesPublished} are the required core; the key comes from
// the engine's exported SAVE_KEY constant — never hardcoded.

import { SAVE_KEY } from '../../src/engine';
import { expect, test } from './fixtures';

test.describe('06 — offline progress', () => {
  test('"While you were away" modal appears with a gain > 0 after a 1h-old save', async ({
    page,
  }) => {
    // 10 muses (1/sec) + 5 sprites (5/sec) = 6/sec → 1h at 50% = 10,800 ✨.
    const savedAt = Date.now() - 3_600_000;
    const save = {
      version: 1,
      savedAt,
      run: {
        inspiration: 1_000,
        totalEarned: 5_000,
        generators: { wanderingMuse: 10, inkSprite: 5 },
        upgrades: {},
        milestones: [
          'theFirstSpark',
          'whispersInInk',
          'craftsmansTools',
          'racingHeart',
          'aFeatheredFriend',
        ],
        buff: { activeUntil: 0, cooldownUntil: 0 },
      },
      meta: {
        goldenQuills: 0,
        tomesPublished: 0,
        achievements: [],
        quillResonance: false,
        stats: {
          totalClicks: 50,
          lifetimeInspiration: 5_000,
          buffActivations: 0,
          offlineSessionsOver30Min: 0,
          bestSingleOfflineGain: 0,
        },
        settings: {},
      },
    };

    await page.addInitScript(
      ([key, payload]) => {
        window.localStorage.setItem(key, payload);
      },
      [SAVE_KEY, JSON.stringify(save)] as const,
    );

    await page.goto('/?test=1');

    const modal = page.getByTestId('offline-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('While you were away');
    await expect(modal).toContainText('1h'); // absence duration

    // Gained amount > 0: 6/sec × ~3600s × 0.5 ≈ 10,800 → "10.8K" once the
    // 1200ms countUp settles (generous timeout for the tween).
    await expect(page.getByTestId('offline-gained')).toContainText('10.8K', { timeout: 10_000 });
    await expect(modal).toContainText('at 50% efficiency');

    // Collect closes the modal; the reward was already credited at bootstrap:
    // 1,000 + 10,800 = 11,800 → "11.8K".
    await page.getByTestId('offline-collect').click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByTestId('inspiration-amount')).toContainText('11.8K');

    // The restored generators are on screen.
    await expect(page.getByTestId('generator-wanderingMuse')).toContainText('×10 owned');
    await expect(page.getByTestId('generator-inkSprite')).toContainText('×5 owned');
  });

  test('no offline modal on a fresh visit without a save', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.getByTestId('click-area')).toBeVisible();
    await expect(page.getByTestId('offline-modal')).toHaveCount(0);
  });
});
