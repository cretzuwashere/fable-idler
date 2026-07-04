// 13 — v1 → v2 save migration (10 §3.3 / §4.3). addInitScript plants a REAL
// v1 payload (the exact schema v1 wrote: version:1, savedAt, run{inspiration,
// totalEarned, generators, upgrades, milestones, buff}, meta{goldenQuills,
// tomesPublished, achievements, quillResonance, stats, settings}) under the
// engine's SAVE_KEY. The game must boot without errors and migrate:
// - GOLDEN RULE: v1 never spent quills ⇒ wallet 3 AND lifetimeQuillsEarned 3,
//   and production includes ×(1 + 0.30 × 3) anchored to the lifetime value;
// - 3 retroactive FADED fables on the shelf (runStats lost, deterministic
//   regenerable titles = generateFadedTitle(n));
// - achievements survive untouched.

import { generateFadedTitle, perSecond, SAVE_KEY } from '../../src/engine';
import { expect, hookState, test, waitForHook } from './fixtures';

test.describe('13 — v1→v2 migration', () => {
  test('a real v1 save loads clean: quills → purse AND lifetime, faded fables, achievements kept', async ({
    page,
  }) => {
    // savedAt 10s ago: below the 60s offline-modal threshold — the migration
    // itself is under test here, not the away report.
    const savedAt = Date.now() - 10_000;
    const v1Save = {
      version: 1,
      savedAt,
      run: {
        inspiration: 500,
        totalEarned: 900,
        generators: { wanderingMuse: 10 },
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
        goldenQuills: 3,
        tomesPublished: 3,
        achievements: ['firstWords', 'publishedAuthor'],
        quillResonance: false,
        stats: {
          totalClicks: 50,
          lifetimeInspiration: 5_000,
          buffActivations: 2,
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
      [SAVE_KEY, JSON.stringify(v1Save)] as const,
    );

    await page.goto('/?test=1');
    await waitForHook(page);

    // No offline modal (10s away) and no crash — the fixture guards errors.
    await expect(page.getByTestId('offline-modal')).toHaveCount(0);
    await expect(page.getByTestId('click-area')).toBeVisible();

    const state = await hookState(page);

    // GOLDEN RULE migration: wallet ≡ lifetime earned (v1 never spent).
    expect(state.meta.goldenQuills).toBe(3);
    expect(state.meta.stats.lifetimeQuillsEarned).toBe(3);
    expect(state.meta.tomesPublished).toBe(3);

    // v1 progress carried over untouched.
    expect(state.run.generators.wanderingMuse).toBe(10);
    expect(state.meta.achievements).toContain('firstWords');
    expect(state.meta.achievements).toContain('publishedAuthor');
    expect(state.meta.stats.totalClicks).toBe(50);
    expect(state.meta.stats.fastestPublishMs).toBeNull();

    // 3 retroactive FADED fables: stats lost, deterministic regenerable titles.
    expect(state.meta.fables).toHaveLength(3);
    for (const [i, fable] of state.meta.fables.entries()) {
      expect(fable.n).toBe(i + 1);
      expect(fable.runStats).toBeNull();
      expect(fable.gilded).toBe(false);
      expect(fable.title).toBe(generateFadedTitle(i + 1));
    }

    // Production includes ×(1 + 0.30 × 3) — anchored to LIFETIME quills:
    // the exact engine selector on the live state vs the same state with the
    // lifetime anchor zeroed must differ by exactly ×1.9.
    const zeroed = JSON.parse(JSON.stringify(state));
    zeroed.meta.stats.lifetimeQuillsEarned = 0;
    const withQuills = perSecond(state, state.lastTickAt);
    const withoutQuills = perSecond(zeroed, zeroed.lastTickAt);
    expect(withoutQuills).toBeGreaterThan(0);
    expect(withQuills / withoutQuills).toBeCloseTo(1.9, 10);

    // The UI reflects the migrated state: purse chip, Act-2 panels, shelf.
    await expect(page.getByTestId('golden-quills')).toContainText('3');

    const shelf = page.getByTestId('bookshelf-panel');
    await expect(shelf).toBeVisible();
    const uniqueTitles = new Set(
      state.meta.fables.map((f: { title: string }) => f.title),
    ).size;
    await expect(page.getByTestId('bookshelf-count')).toContainText('3 fables');
    await expect(page.getByTestId('bookshelf-count')).toContainText(
      `+${uniqueTitles * 2}% production`,
    );
    for (const n of [1, 2, 3]) {
      await expect(page.getByTestId(`fable-spine-${n}`)).toHaveAttribute('data-faded', 'true');
    }

    // The Gilded Atelier opened for the veteran: purse 3 / lifetime 3.
    await page.getByTestId('tab-atelier').click();
    await expect(page.getByTestId('atelier-purse')).toContainText('3');
    await expect(page.getByTestId('atelier-lifetime')).toContainText('3');
  });
});
