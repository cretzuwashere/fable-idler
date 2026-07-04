// 10 — Hall of Fables (10 §4.3). Two faces of the leaderboard:
// (a) the REAL compose stack (web → nginx /api/ proxy → api service): claim a
//     nickname through the UI → data-state=active → own row in the table;
//     claiming an already-taken nickname → inline 409 error; the identity
//     survives a reload (it lives in the save).
// (b) graceful degradation: page.route aborts every /api/ request → the panel
//     shows data-state=offline with the courier message while the game stays
//     fully playable and the console stays clean (the fixture only ignores
//     the browser's own failed-resource log for /api/ URLs — nothing else).
//
// The leaderboard_data volume persists between runs, so nicknames are unique
// per attempt (timestamp suffix). The Hall tab exists on desktop only (the
// default 1280×720 viewport) after milestone wordTravelsFast (1 Publish).

import { addInspiration, expect, hookState, test, waitForHook } from './fixtures';

/** Hook-driven prestige + milestone re-earn (05 §E2E v2 #5): fast setup for
 *  specs whose subject is NOT the prestige dialog itself. */
async function publishAndRestore(page: import('@playwright/test').Page): Promise<void> {
  await addInspiration(page, 500_000);
  await page.evaluate(() => (window as any).__FABLE_TEST__.dispatch({ type: 'prestige' }));
  await addInspiration(page, 100_000);
}

test.describe('10 — Hall of Fables', () => {
  test('real API: claim → active with own row; taken nickname → inline 409; identity survives reload', async ({
    page,
  }) => {
    const suffix = Date.now().toString(36);
    const takenNick = `taken-${suffix}`;
    const myNick = `e2e-${suffix}`;

    // Reserve `takenNick` as a different, anonymous player (real POST to the
    // compose api through nginx) so the UI claim below hits a genuine 409.
    const reserve = await page.request.post('/api/leaderboard/submit', {
      data: {
        nickname: takenNick,
        scores: {
          lifetimeInspiration: 1,
          tomesPublished: 0,
          lifetimeQuillsEarned: 0,
          fastestPublishMs: null,
        },
      },
    });
    expect(reserve.ok()).toBe(true);

    await page.goto('/?test=1');
    await waitForHook(page);
    await publishAndRestore(page);

    // Desktop-only Hall tab appears after the first Publish.
    await page.getByTestId('tab-hall').click();
    const panel = page.getByTestId('leaderboard-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-state', 'opt-in');

    // Claiming a nickname that is already inked → inline 409, input kept.
    const input = page.getByTestId('leaderboard-nickname-input');
    await input.fill(takenNick);
    await page.getByTestId('leaderboard-join').click();
    const inlineError = page.getByTestId('leaderboard-error');
    await expect(inlineError).toBeVisible();
    await expect(inlineError).toContainText('already inked');
    await expect(panel).toHaveAttribute('data-state', 'opt-in');
    await expect(input).toHaveValue(takenNick);

    // Claim a free nickname → active board with our own highlighted row.
    await input.fill(myNick);
    await page.getByTestId('leaderboard-join').click();
    await expect(panel).toHaveAttribute('data-state', 'active', { timeout: 10_000 });
    await expect(page.getByTestId('leaderboard-table')).toBeVisible();
    await expect(page.getByTestId('leaderboard-row-self')).toContainText(myNick);

    // The identity was persisted immediately (setSettings is a critical
    // action) and lives in the save.
    const state = await hookState(page);
    expect(state.meta.settings.leaderboard.nickname).toBe(myNick);
    expect(typeof state.meta.settings.leaderboard.token).toBe('string');
    expect(state.meta.achievements).toContain('nameInLights');

    // Reload: no second opt-in — straight back to the active board.
    await page.reload();
    await waitForHook(page);
    await page.getByTestId('tab-hall').click();
    await expect(panel).toHaveAttribute('data-state', 'active', { timeout: 10_000 });
    await expect(page.getByTestId('leaderboard-row-self')).toContainText(myNick);
  });

  test('degradation: /api/ unreachable → offline courier badge, game fully playable, console clean', async ({
    page,
  }) => {
    // Kill the API from the client side BEFORE the page loads.
    await page.route('**/api/**', (route) => route.abort());

    await page.goto('/?test=1');
    await waitForHook(page);
    await publishAndRestore(page);

    // An identity must exist for the panel to fetch (and fail): inject one —
    // the exact shape a previous successful claim would have stored.
    await page.evaluate(() => {
      (window as any).__FABLE_TEST__.dispatch({
        type: 'setSettings',
        settings: {
          leaderboard: {
            playerId: 'e2e-ghost',
            token: '0123456789abcdef0123456789abcdef',
            nickname: 'Ghost Writer',
            lastSubmittedAt: Date.now(),
          },
        },
      });
    });

    await page.getByTestId('tab-hall').click();
    const panel = page.getByTestId('leaderboard-panel');
    await expect(panel).toBeVisible();

    // The refresh fails silently → offline state with the courier message.
    await expect(panel).toHaveAttribute('data-state', 'offline', { timeout: 10_000 });
    await expect(page.getByTestId('leaderboard-offline')).toContainText(
      'The courier seems lost between libraries.',
    );

    // The game does not care: clicking still earns Inspiration.
    const before = await hookState(page);
    await page.getByTestId('click-area').click();
    await page.getByTestId('click-area').click();
    const after = await hookState(page);
    expect(after.run.inspiration).toBeGreaterThan(before.run.inspiration);
    expect(after.meta.stats.totalClicks).toBe(before.meta.stats.totalClicks + 2);

    // Console cleanliness is enforced by the fixture at teardown (only the
    // browser's own /api/ failed-resource logs are exempt).
  });
});
