// node tools/letters/film-card.js   → orphan-video/film-card.jpg (Playwright with Chromium)
// Renders film-card.html at 1200×480 and writes the JPEG the branded letters link to.
// Run it after changing the card; the letters reference the hosted copy at
// https://rickyrampersadbranch.com/orphan-video/film-card.jpg, so the file is committed.
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const opts = process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {};   // the fonts load from Google
  const browser = await chromium.launch(opts).catch(() => chromium.launch({ ...opts, executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }));
  const page = await browser.newPage({ viewport: { width: 1200, height: 480 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'film-card.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const out = path.join(ROOT, 'orphan-video', 'film-card.jpg');
  await page.screenshot({ path: out, type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1200, height: 480 } });
  await browser.close();
  console.log('wrote', out, require('fs').statSync(out).size, 'bytes');
})();
