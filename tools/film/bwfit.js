// The mixer crops the picture to 1280x616 and burns the captions into the band
// beneath, so anything a scene draws below 616 is simply gone. Measure it
// instead of looking at it.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const [page] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-device-scale-factor=1'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(() => { window.__RENDER = true; });
  await p.goto('file://' + path.resolve(page));
  await p.waitForTimeout(800);
  await p.addStyleTag({ content: '#ctrl{display:none!important}#poster{display:none!important}' });
  await p.evaluate(() => { document.body.classList.add('rolling'); paused = true; });
  const D = await p.evaluate(() => SC.map(s => +s.dataset.d));
  let bad = 0;
  for (let n = 0; n < D.length; n++) {
    await p.evaluate((n) => { paused = true; clearTimeout(timer); go(n); clearTimeout(timer); }, n);
    // every entrance finished: measure the scene at rest, not mid-animation
    await p.evaluate((n) => {
      const sc = SC[n];
      document.getAnimations().forEach(a => { const el = a.effect && a.effect.target; if (el && sc.contains(el)) { a.pause(); a.currentTime = 1e6; } });
    }, n);
    const r = await p.evaluate((n) => {
      const sc = SC[n]; let top = 1e9, bot = -1e9, who = '';
      // the aurora, the rays and the blobs bleed past the frame on purpose:
      // they are the ground, not content
      sc.querySelectorAll('.inner *').forEach(el => {
        if (el.closest('.conf') || el.classList.contains('conf') || el.tagName === 'CANVAS') return;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return;
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) return;
        if (b.bottom > bot) { bot = b.bottom; who = el.className.toString().slice(0, 34); }
        if (b.top < top) top = b.top;
      });
      return { top: Math.round(top), bot: Math.round(bot), who };
    }, n);
    const over = r.bot > 616;
    if (over) bad++;
    console.log(`${String(n + 1).padStart(2, '0')}  top ${String(r.top).padStart(4)}  bottom ${String(r.bot).padStart(4)}  ${over ? 'PAST 616 — ' + r.who : 'ok'}`);
  }
  console.log(bad ? `\n${bad} scene(s) draw below the crop` : '\nevery scene fits the picture');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
