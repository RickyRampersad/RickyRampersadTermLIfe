/* Frame-by-frame: the page is seeked, never played, so the timeline cannot
   drift the way a real-time capture does. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

(async () => {
  const W = +(process.env.W || 1080), H = +(process.env.H || 1920);
  const FPS = +(process.env.FPS || 30);
  const out = process.env.OUT || 'cap';
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await pg.goto('file://' + path.resolve('film.html'));
  await pg.waitForFunction(() => window.SEEK && document.fonts.status === 'loaded');
  // every image decoded before the first frame, or shot 1 renders empty
  await pg.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
  const total = await pg.evaluate(() => window.FILM.total);
  const n = Math.round(total * FPS);
  for (let f = 0; f < n; f++) {
    await pg.evaluate(t => window.SEEK(t), f / FPS);
    await pg.screenshot({
      path: path.join(out, String(f).padStart(5, '0') + '.jpg'),
      type: 'jpeg', quality: 95
    });
    if (f % 60 === 0) process.stdout.write(f + '/' + n + ' ');
  }
  await b.close();
  console.log('\n' + n + ' frames at ' + W + 'x' + H + ' -> ' + out);
})();
