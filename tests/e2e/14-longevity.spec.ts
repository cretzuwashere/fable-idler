// 14 — The Long Road (v3 longevity, 13/14). The full New-Wing gate flow, all
// through the shipped UI:
//   1. Bank enough quills with one big Publish, then buy The New Wing L1 from the
//      Atelier (atelier-buy-theNewWing) via its real ≥10🪶 confirmation dialog.
//   2. Saga Citadel (tier 9) is wing-gated: assert its row is ABSENT before the
//      wing (even past its 3e9 reveal) and PRESENT after — the row does not
//      render at all without the level (pattern blueprintOfMyths, 13 §1.1/§0.2).
//   3. Buy Saga Citadels with real inspiration → the owned count climbs.
//   4. Deep-buy to the unique-bonus threshold (200 owned, dispatch buyGenerator
//      qty:'max' against a huge balance — 150→200 through real ticks would take
//      hours) and assert the new violet/gold UNIQUE badge lights up on the card:
//      "✦ The Garrison Sallies Forth" (sagaCitadel's bonus, UNIQUE_BONUSES).
//
// The shared fixture fails the test on any app console/page error.

import {
  GENERATOR_INDEX,
  PRESTIGE_V3,
  UNIQUE_THRESHOLD,
  isUniqueBonusActive,
  newWingLevel,
} from '../../src/engine';
import { addInspiration, expect, hookState, test, waitForHook } from './fixtures';

/** Publish the Tome through the real UI dialog and wait for the fade to clear. */
async function publishViaUI(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('prestige-button').click();
  await expect(page.getByTestId('prestige-confirm-dialog')).toBeVisible();
  await page.getByTestId('prestige-checkbox').check();
  await page.getByTestId('prestige-confirm').click();
  const overlay = page.getByTestId('prestige-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveCount(0, { timeout: 10_000 });
}

test.describe('14 — The Long Road (New Wing → Saga Citadel → unique bonus)', () => {
  test('New Wing L1 unlocks tier 9 in the shop; deep-buying lights the unique badge', async ({
    page,
  }) => {
    await page.goto('/?test=1');
    await waitForHook(page);

    // ---- Bank the quills for The New Wing L1 (25 🪶) -----------------------
    // Prestige is EXACT sqrt at/below the 1e9 knee (PRESTIGE_V3), so 1e9
    // totalEarned → floor(sqrt(1e9/1e5)) = floor(sqrt(1e4)) = 100 🪶 — plenty for
    // the 25🪶 L1, one Publish, and a clean integer preview ("+100").
    expect(PRESTIGE_V3.knee1).toBe(1e9);
    await addInspiration(page, 1e9);
    await expect(page.getByTestId('prestige-preview')).toContainText('+100');
    await publishViaUI(page);

    let state = await hookState(page);
    expect(state.meta.goldenQuills).toBe(100);
    expect(state.meta.tomesPublished).toBe(1);
    expect(newWingLevel(state)).toBe(0);

    // Post-prestige the center column waits for the run milestones — re-earn a
    // few so the Atelier tab returns (05 §E2E v2 #5).
    await addInspiration(page, 100_000);
    const atelierTab = page.getByTestId('tab-atelier');
    await expect(atelierTab).toBeVisible();
    await atelierTab.click();
    await expect(page.getByTestId('atelier-panel')).toBeVisible();

    // ---- Saga Citadel is ABSENT before the wing, even past its reveal --------
    // Give the run enough totalEarned to clear Saga Citadel's 3e9 reveal. Without
    // The New Wing the row must still NOT render (wing gate, not just reveal).
    const sagaReveal = GENERATOR_INDEX.sagaCitadel.revealAt;
    expect(sagaReveal).toBe(3e9);
    await addInspiration(page, 1e10); // > 3e9 reveal, still no wing
    state = await hookState(page);
    expect(state.run.totalEarned).toBeGreaterThan(sagaReveal);
    expect(newWingLevel(state)).toBe(0);
    await expect(page.getByTestId('generator-sagaCitadel')).toHaveCount(0);

    // ---- Buy The New Wing L1 from the Atelier (real ≥10🪶 confirm dialog) ----
    const wingCard = page.getByTestId('atelier-upgrade-theNewWing');
    await expect(wingCard).toBeVisible();
    await expect(wingCard.getByLabel('Level 0 of 3')).toBeVisible();

    await page.getByTestId('atelier-buy-theNewWing').click();
    // 25 🪶 ≥ 10 → the confirmation dialog gates the purchase.
    const confirmDialog = page.getByTestId('atelier-confirm-dialog');
    await expect(confirmDialog).toBeVisible();
    await page.getByTestId('atelier-confirm').click();
    await expect(confirmDialog).toHaveCount(0);

    state = await hookState(page);
    expect(newWingLevel(state)).toBe(1);
    expect(state.meta.goldenQuills).toBe(100 - 25); // wallet spent, only 25
    await expect(wingCard.getByLabel('Level 1 of 3')).toBeVisible();

    // ---- Saga Citadel now APPEARS in the shop -------------------------------
    // Back to the Generators tab (desktop keeps the shop mounted; click the tab
    // if it exists to be layout-agnostic).
    const genTab = page.getByTestId('tab-generators');
    if (await genTab.count()) await genTab.click();

    const sagaRow = page.getByTestId('generator-sagaCitadel');
    await expect(sagaRow).toBeVisible();
    await expect(sagaRow).toContainText('Saga Citadel');

    // ---- Buy Saga Citadels with real inspiration → the count climbs ---------
    // One Saga Citadel costs 6e9; fund a handful and buy via the real buy button.
    await addInspiration(page, 5e10);
    const buyBtn = page.getByTestId('buy-sagaCitadel');
    await expect(buyBtn).toBeEnabled();
    await buyBtn.click();
    await expect(sagaRow).toContainText('owned');
    state = await hookState(page);
    expect(state.run.generators.sagaCitadel).toBeGreaterThanOrEqual(1);
    const ownedAfterOne = state.run.generators.sagaCitadel;

    await buyBtn.click();
    state = await hookState(page);
    expect(state.run.generators.sagaCitadel).toBeGreaterThan(ownedAfterOne);

    // ---- Deep-buy to the unique-bonus threshold (200 owned) -----------------
    // Reaching 200 through real ticks is hours of play; a huge balance + a real
    // 'max' buyGenerator dispatch gets there in one deterministic step. This is
    // the same engine path the shop's "Max" button drives.
    expect(UNIQUE_THRESHOLD).toBe(200);
    await addInspiration(page, 1e30); // dwarfs even 200 Deep-Shelves-tapered units
    await page.evaluate(() =>
      (window as any).__FABLE_TEST__.dispatch({
        type: 'buyGenerator',
        id: 'sagaCitadel',
        qty: 'max',
      }),
    );

    state = await hookState(page);
    expect(state.run.generators.sagaCitadel).toBeGreaterThanOrEqual(UNIQUE_THRESHOLD);
    expect(isUniqueBonusActive(state, 'sagaCitadel')).toBe(true);

    // The card shows the ×N milestone badge AND the new violet/gold UNIQUE badge.
    await expect(sagaRow.locator('.generator-row__badge--unique')).toBeVisible();
    await expect(sagaRow).toContainText('✦ The Garrison Sallies Forth');
    // The generic milestone multiplier badge is there too (owning 200+ ⇒ ×N).
    await expect(sagaRow.locator('.generator-row__badge').first()).toBeVisible();
  });
});
