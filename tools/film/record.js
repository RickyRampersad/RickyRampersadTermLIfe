// Record one film page with Playwright, alone on the machine.
//
//   node record.js <page.html> <capture-dir> <seconds> [poster.jpg] [WxH]
//
// The capture writes at a nominal frame rate it never reaches; mixany.py
// measures that from the film's own cuts and undoes it. Run nothing else while
// this runs — CPU contention corrupts the timeline and the mixer will refuse
// the recording.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [page, cap, secs, poster, size] = process.argv.slice(2);
  const [W, H] = (size || '1280x720').split('x').map(Number);
  fs.rmSync(cap, { recursive: true, force: true }); fs.mkdirSync(cap, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H },
    recordVideo: { dir: cap, size: { width: W, height: H } } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await p.goto('file://' + require('path').resolve(page));
  await p.waitForTimeout(1500);
  await p.click('#playBtn');
  await p.addStyleTag({ content: '#ctrl{display:none!important}#poster{display:none!important}' });
  const DUR = Math.round(parseFloat(secs) * 1000) + 6000, t0 = Date.now();
  await p.waitForTimeout(2400);
  if (poster) await p.screenshot({ path: poster, type: 'jpeg', quality: 92 });
  await p.waitForTimeout(Math.max(0, DUR - (Date.now() - t0)));
  await ctx.close(); await b.close();
  console.log('recorded', page, ((Date.now() - t0) / 1000).toFixed(1), 's · errors:', errs.length ? errs : 'none');
})();
