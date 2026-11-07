// One frame per scene, at a moment where everything has landed: the quick look
// before committing to a full render.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const [page, out, fracArg] = process.argv.slice(2);
  const FR = +(fracArg || 0.82);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-device-scale-factor=1'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { window.__RENDER = true; });
  await p.goto('file://' + path.resolve(page));
  await p.waitForTimeout(800);
  await p.addStyleTag({ content: '#ctrl{display:none!important}#poster{display:none!important}' });
  await p.evaluate(() => { document.body.classList.add('rolling'); paused = true; });
  const D = await p.evaluate(() => SC.map(s => +s.dataset.d));
  for (let n = 0; n < D.length; n++) {
    const t = D[n] * FR;
    await p.evaluate((n) => { paused = true; clearTimeout(timer); go(n); clearTimeout(timer); }, n);
    await p.evaluate(({ n, t }) => {
      const sc = SC[n], prev = n > 0 ? SC[n - 1] : null;
      if (prev) { prev.classList.remove('act'); prev.classList.remove('out'); }
      document.getAnimations().forEach(a => {
        const el = a.effect && a.effect.target; if (!el) return;
        if (sc.contains(el)) { a.pause(); a.currentTime = t; }
      });
      sc.querySelectorAll('.cnt').forEach(el => {
        const at = +(el.dataset.at || 0), to = +el.dataset.to, k = Math.max(0, Math.min(1, (t - at) / 1000));
        el.textContent = (el.dataset.pre || '') + Math.round(to * (1 - Math.pow(1 - k, 3))) + (el.dataset.suf || '');
      });
    }, { n, t });
    await p.waitForTimeout(60);
    await p.screenshot({ path: path.join(out, String(n + 1).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 88 });
  }
  console.log('errors:', errs.length ? errs.slice(0, 6) : 'none');
  await b.close();
})();
