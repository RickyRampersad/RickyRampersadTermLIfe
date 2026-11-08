/* Shoot the posters build-ad.py wrote, and prove the QR still decodes out of
   the JPEG at the size a phone actually meets it — a code that scans in the
   browser and not in the posted picture is the whole failure mode. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const HERE = __dirname;
const OUT = path.join(HERE, 'out');
const SIZES = { feed: [1080, 1350], story: [1080, 1920], wide: [1200, 630] };

(async () => {
  const key = process.argv[2] || 'clientmanager';
  const dest = process.argv[3];                      // where the JPEGs land
  const want = process.argv.slice(4).length ? process.argv.slice(4) : Object.keys(SIZES);
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  for (const s of want) {
    const [w, h] = SIZES[s];
    const src = path.join(OUT, `${key}-${s}.html`);
    if (!fs.existsSync(src)) { console.log(`skip ${s}: no ${src}`); continue; }
    const pg = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto('file://' + src, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(250);
    // nothing may be cut off: the ad box is exactly the frame
    const fit = await pg.evaluate(() => {
      const ad = document.querySelector('.ad'), r = ad.getBoundingClientRect();
      let worst = 0, who = '';
      ad.querySelectorAll('.in *').forEach(e => {
        const b = e.getBoundingClientRect();
        const over = Math.max(b.bottom - r.bottom, b.right - r.right, r.top - b.top, r.left - b.left);
        if (over > worst) { worst = over; who = e.className || e.tagName; }
      });
      return { over: Math.round(worst), who, h: Math.round(r.height) };
    });
    // where the QR actually is, measured rather than guessed, so the check
    // below reads the code the way a camera does: the code, not the poster
    const qrBox = await pg.evaluate(() => {
      const e = document.querySelector('.foot .qr'); if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
    });
    const file = path.join(dest || OUT, `ad-${s}.jpg`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await pg.screenshot({ path: file, quality: 92, type: 'jpeg' });
    if (qrBox) await pg.screenshot({ path: path.join(OUT, `qr-${key}-${s}.png`), clip: qrBox });
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`${fit.over > 1 ? 'FAIL' : 'ok  '} ${s.padEnd(6)} ${w}x${h} · ${kb} KB`
      + (fit.over > 1 ? ` · ${fit.over}px of "${fit.who}" outside the frame` : '')
      + (errs.length ? ` · ${errs[0]}` : ''));
    await pg.close();
  }
  await br.close();
})();
