// Rasterise the Premium Bridge files that must be PNG:
//   logo.png          the app tile, 256×256 (apple-touch icon, social image)
//   lockup-light.png  mark + wordmark on white, 2× (the e-mail masthead; Gmail strips SVG)
// Run after build-mark.py:   node tools/premium-bridge/render-mark.js
const path = require('path');
const fs = require('fs');
// Playwright from the project if it has one, else the global install
// (on the cloud container it lives under `npm root -g`).
let pw;
try { pw = require('playwright'); } catch (e) {
  const root = require('child_process').execSync('npm root -g').toString().trim();
  pw = require(path.join(root, 'playwright'));
}
const { chromium } = pw;

const dir = path.resolve(__dirname, '..', '..', 'premium-finance');
const JOBS = [
  { src: 'logo.svg', out: 'logo.png', w: 256, h: 256, bg: 'transparent' },
  { src: 'lockup-light.svg', out: 'lockup-light.png', w: 500, h: 196, bg: '#FFFFFF' },
];

(async () => {
  const local = '/opt/pw-browsers/chromium';   // the pre-installed Chromium on the cloud container
  const browser = await chromium.launch(fs.existsSync(local) ? { executablePath: local } : {});
  for (const j of JOBS) {
    const svg = fs.readFileSync(path.join(dir, j.src), 'utf8')
      .replace('<svg ', `<svg width="${j.w}" height="${j.h}" `);
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
    await page.setContent(`<body style="margin:0;background:${j.bg}">${svg}</body>`);
    await page.screenshot({ path: path.join(dir, j.out), omitBackground: j.bg === 'transparent' });
    await page.close();
    console.log('wrote', path.join(dir, j.out));
  }
  await browser.close();
})();
