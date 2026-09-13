// The five intelligence screens, on a phone.
//
// They are built for a 1920 television and every layout above assumes it. On
// 7 September the delivery screen was opened on an iPhone and the standard and
// the ten-day line were drawn straight over the two cards below them: the wide
// row kept its wall layout at every width, so its three parts overflowed and
// the page scrolled sideways.
//
// This checks each screen at 390 x 844 for the two faults a person actually
// sees: text drawn on top of other text, and a page wider than the phone.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8809;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.mp4':'video/mp4', '.json':'application/json' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

const SCREENS = [
  ['The day so far',     '/intelligence/wall/day.html'],
  ['The day in blocks',  '/intelligence/wall/blocks.html'],
  ['The 45-day line',    '/intelligence/wall/'],
  ['Whose hands',        '/intelligence/wall/possession.html'],
  ['Contract delivery',  '/intelligence/wall/delivery.html'],
  ['The licence year',   '/intelligence/wall/licence.html'],
  ['Birthdays today',    '/intelligence/wall/book.html'],
];

/* Two blocks of text drawn over each other. Only leaf elements that actually
   carry words are compared, and only where the overlap is more than a couple
   of pixels each way — a border meeting a border is not a fault. */
const OVERLAPS = `(() => {
  const boxes = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.children.length) return;                       // leaves only
    const txt = (el.textContent || '').trim();
    if (txt.length < 4) return;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return;
    // Nothing is exempt. The source line under each wall is pinned to the
    // bottom of a screen that never scrolls, and on a phone it sat over the
    // rows; excusing fixed elements here is what let that through.
    if (el.classList.contains('hint')) return;            // the keyboard hint, hidden on a phone anyway
    // Line boxes, not the bounding box. A wrapped inline element's bounding
    // box is the union of its lines, so two chips sitting side by side on
    // different lines read as overlapping when they plainly do not.
    Array.from(el.getClientRects()).forEach(r => {
      if (r.width < 6 || r.height < 6) return;
      boxes.push({ t: txt.slice(0, 40), r, el });
    });
  });
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (boxes[i].el === boxes[j].el) continue;
    const a = boxes[i].r, b = boxes[j].r;
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (x > 3 && y > 3) hits.push(boxes[i].t + '  ×  ' + boxes[j].t);
  }
  return hits;
})()`;

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  for (const [name, url] of SCREENS) {
    console.log('\n' + name + ', on a phone:\n');
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message)));
    // No feed: every screen must lay out on what it ships with.
    await page.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    ok('it does not scroll sideways', wide <= 391, wide + 'px wide on a 390px screen');

    const hits = await page.evaluate(OVERLAPS);
    ok('no text is drawn over other text', hits.length === 0, hits.slice(0, 3).join('   |   '));

    const readable = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el.children.length) return;
        if ((el.textContent || '').trim().length < 4) return;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return;
        if (parseFloat(s.fontSize) < 9) bad.push(el.textContent.trim().slice(0, 30) + ' @ ' + s.fontSize);
      });
      return bad;
    });
    ok('nothing is smaller than nine pixels', readable.length === 0, readable.slice(0, 3).join(' | '));

    const t = await page.locator('body').innerText();
    ok('the branch mark is on it', await page.locator('header .mark img').count() === 1);
    ok('and it says whether the figures are live', /live|snapshot|no feed/i.test(t), t.slice(0, 80));
    ok('no javascript errors', errors.length === 0, errors.join(' | '));

    await page.screenshot({ path: '/tmp/wall-phone-' + url.replace(/[^a-z]+/gi, '-') + '.png', fullPage: false });
    await ctx.close();
  }

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
