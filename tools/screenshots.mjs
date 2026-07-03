// Visual QA helper: captures the game at three viewports, fresh and progressed.
// Run inside the Playwright container:
//   docker compose run --rm test-e2e sh -c "npm install --no-audit --no-fund && node tools/screenshots.mjs"
// Screenshots land in test-results/.
import { chromium } from '@playwright/test'

const base = process.env.PW_BASE_URL ?? 'http://localhost:8080'
const viewports = [
  ['desktop', { width: 1280, height: 800 }],
  ['tablet', { width: 900, height: 800 }],
  ['mobile', { width: 375, height: 812 }],
]

const browser = await chromium.launch()
for (const [name, viewport] of viewports) {
  // Fresh save: empty/solo-mode layout.
  let ctx = await browser.newContext({ viewport })
  let page = await ctx.newPage()
  await page.goto(base + '/')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `test-results/shot-${name}-fresh.png` })
  await ctx.close()

  // Progressed save: all panels revealed via the test hook.
  ctx = await browser.newContext({ viewport })
  page = await ctx.newPage()
  await page.goto(base + '/?test=1')
  await page.waitForFunction(() => !!window.__FABLE_TEST__)
  await page.evaluate(() => {
    const t = window.__FABLE_TEST__
    t.addInspiration(20_000_000)
    t.dispatch({ type: 'buyGenerator', id: 'wanderingMuse', qty: 10 })
    t.dispatch({ type: 'buyGenerator', id: 'inkSprite', qty: 10 })
    t.dispatch({ type: 'buyGenerator', id: 'talkingRaven', qty: 10 })
    t.dispatch({ type: 'buyUpgrade', id: 'sharpenedNib' })
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `test-results/shot-${name}-progressed.png` })
  await ctx.close()
}
await browser.close()
console.log('Screenshots written to test-results/')
