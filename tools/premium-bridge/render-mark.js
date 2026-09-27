// Rasterise premium-finance/logo.svg to logo.png (256×256, transparent
// corners), the copy the Premium Bridge e-mails link to — Gmail strips SVG.
// Needs Playwright with Chromium (the film pipeline's install is enough):
//   node tools/premium-bridge/render-mark.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const dir = path.resolve(__dirname, '..', '..', 'premium-finance');
  const svg = fs.readFileSync(path.join(dir, 'logo.svg'), 'utf8')
    .replace('<svg ', '<svg width="256" height="256" ');
  const local = '/opt/pw-browsers/chromium';   // the pre-installed Chromium on the cloud container
  const browser = await chromium.launch(fs.existsSync(local) ? { executablePath: local } : {});
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  const out = path.join(dir, 'logo.png');
  await page.screenshot({ path: out, omitBackground: true });
  await browser.close();
  console.log('wrote', out);
})();
