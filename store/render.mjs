// Renders the Chrome Web Store images into store/: 1280x800 screenshots and the 440x280 tile, 24-bit PNG (no alpha).
// Waits until the extension has actually marked posts in each mock feed, so shots are never half-rendered.
// Usage: python3 -m http.server 5178 (repo root), then npm run shots
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'

const BASE = 'http://localhost:5178'
const out = name => new URL(name, import.meta.url).pathname
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })

for (const v of [1, 2, 3, 4]) {
  await page.goto(`${BASE}/store/shot.html?v=${v}`)
  const [feed, popup] = [page.frameLocator('#f'), page.frameLocator('#pp')]
  await feed.locator('[data-feed-control] .feed-control-pill').nth(2).waitFor() // ≥3 posts hidden
  await popup.locator('#filters li').first().waitFor()
  await page.waitForTimeout(400) // let the popup finish scrolling to its section
  await page.screenshot({ path: out(`screenshot-${v}.png`) })
  console.log(`screenshot-${v}.png`)
}
await page.setViewportSize({ width: 440, height: 280 })
await page.goto(`${BASE}/store/tile.html`)
await page.screenshot({ path: out('promo-tile.png') })
await browser.close()

// Store requires no alpha channel.
execFileSync('python3', ['-c', `from PIL import Image
for f in ${JSON.stringify([1, 2, 3, 4].map(v => out(`screenshot-${v}.png`)).concat(out('promo-tile.png')))}: Image.open(f).convert('RGB').save(f)`])
console.log('promo-tile.png (all flattened to RGB)')
