// 11 — Stray Spark (10 §4.3). forceSpark from __FABLE_TEST__ (after the
// aLightAtTheWindow milestone, 1,000 totalEarned) → the stray-spark button
// appears → pointerdown catches it → toast data-toast-kind=spark + the exact
// reward is credited (inkBurst floor: 50 × click value = 50 ✨ with zero
// production). A refresh never resurrects a spark: the caught reward is
// persisted, an un-caught spark evaporates without granting anything
// (nothing spark-related is ever saved — anti save-scumming, 09 §2.3).
//
// Toast queue note (05 §E2E v2 #4): the milestone burst from addInspiration
// fills the queue (max 3 visible), so the spark is caught only after the
// queue drains — its toast is then immediate and unambiguous.

import { expect, test, waitForHook, addInspiration, hookState, saveNow } from './fixtures';

test.describe('11 — Stray Spark', () => {
  test('forceSpark → catch → spark toast + exact reward; refresh never re-spawns or re-grants', async ({
    page,
  }) => {
    test.slow(); // the milestone toast queue must drain before the catch
    await page.goto('/?test=1');
    await waitForHook(page);

    // Unlock the spark system (milestone aLightAtTheWindow at 1,000).
    await addInspiration(page, 1_000);
    const state0 = await hookState(page);
    expect(state0.run.milestones).toContain('aLightAtTheWindow');
    expect(state0.meta.stats.sparksCaught).toBe(0);

    // No spark before forceSpark (the natural timer needs 150–330s).
    await expect(page.getByTestId('stray-spark')).toHaveCount(0);

    // Let the milestone/achievement/tutorial toast queue drain completely so
    // the spark toast below is the ONLY toast on screen.
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 45_000 });

    // Deterministic reward: inkBurst. With zero generators the floor applies:
    // 50 × click value (1) = 50 Inspiration.
    await page.evaluate(() => (window as any).__FABLE_TEST__.forceSpark('inkBurst'));
    const spark = page.getByTestId('stray-spark');
    await expect(spark).toBeVisible();

    // pointerdown, not click() — the spark is mid-flight (05 §E2E v2 #3).
    await spark.dispatchEvent('pointerdown');
    await expect(spark).toHaveCount(0);

    const sparkToast = page.locator('[data-toast-kind="spark"]');
    await expect(sparkToast).toBeVisible();
    await expect(sparkToast).toContainText('A stray spark!');
    await expect(sparkToast).toContainText('+50 Inspiration');

    const caught = await hookState(page);
    expect(caught.run.inspiration).toBe(1_050); // 1,000 + the 50 ✨ floor
    expect(caught.run.totalEarned).toBe(1_050);
    expect(caught.meta.stats.sparksCaught).toBe(1);

    // Spawn a second spark and do NOT catch it: a refresh must lose it
    // without any reward (nothing pending is ever persisted).
    await saveNow(page);
    await page.evaluate(() => (window as any).__FABLE_TEST__.forceSpark());
    await expect(page.getByTestId('stray-spark')).toBeVisible();

    await page.reload();
    await waitForHook(page);

    // No spark survives a reload — and none spawns for minutes.
    await expect(page.getByTestId('stray-spark')).toHaveCount(0);
    await page.waitForTimeout(1_000);
    await expect(page.getByTestId('stray-spark')).toHaveCount(0);

    // The caught reward persisted; the un-caught spark granted nothing.
    const reloaded = await hookState(page);
    expect(reloaded.meta.stats.sparksCaught).toBe(1);
    expect(reloaded.run.inspiration).toBe(1_050);
  });
});
