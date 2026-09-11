// The wall on a phone.
//
// /intelwall would not open on an iPhone. The address was fine and the server
// answered 200; the page was the problem. The player mounts all seven stories
// at once and never reloads them — right for a television, which runs all day
// and must not re-read the branch's whole position every twenty seconds, and
// badly wrong for a phone. Seven documents is two megabytes, of which one and
// three-quarters is narration folded in as base64: seven quarter-megabyte
// strings, seven sets of timers, seven feeds, all live together. Mobile
// Safari drops a tab that does that and the person sees nothing.
//
// So below the wall breakpoint there is one frame and its src changes. The
// television keeps exactly what it had. This proves both, and that the
// choice can be forced either way from the address.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = 8816;
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (w, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + w + (x && !c ? '  — ' + x : '')); if (!c) fails++; };

const PHONE = { width: 390, height: 844 }, WALL = { width: 1920, height: 1080 };

async function open(b, size, query) {
  const ctx = await b.newContext({ viewport: size, isMobile: size === PHONE, hasTouch: size === PHONE });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route(u => u.hostname !== 'localhost', r => {
    const h = new URL(r.request().url()).hostname;
    if (/script\.google\.com$/.test(h)) return r.fulfill({ status:200, contentType:'application/json', body:'{"ok":false}' });
    return r.fulfill({ status:200, contentType:'text/css', body:'' });
  });
  await page.goto(`http://localhost:${PORT}/intelligence/wall/all.html${query || ''}`, { waitUntil:'domcontentloaded' });
  return { page, ctx, errors };
}
const frames = page => page.locator('iframe.slide').count();
// Every document the browser is actually holding: the player plus whatever
// is mounted under it.
const live = page => page.frames().length;
const srcOf = page => page.evaluate(() => {
  const f = document.querySelector('iframe.slide');
  return ((f && f.getAttribute('src')) || '').split('?')[0];
});

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  console.log('\nOn a phone, one story is held at a time:\n');
  {
    const s = await open(b, PHONE, '?secs=4');
    await s.page.waitForTimeout(2500);
    ok('one frame on the stage, not seven', await frames(s.page) === 1, String(await frames(s.page)));
    ok('and one document under the player', live(s.page) === 2, String(live(s.page)));
    ok('it is showing the first story', (await srcOf(s.page)) === 'day.html', await srcOf(s.page));
    ok('the boot card says how it is running',
       /one at a time on a phone/i.test(await s.page.locator('#boot').innerText()),
       await s.page.locator('#boot').innerText());

    console.log('\nAnd it still turns, by swapping that one frame:\n');
    const seen = new Set([await srcOf(s.page)]);
    const until = Date.now() + 30000;
    while (Date.now() < until && seen.size < 3) {
      await s.page.waitForTimeout(600);
      seen.add(await srcOf(s.page));
    }
    ok('it moves through the stories on its own', seen.size >= 3, [...seen].join(' → '));
    ok('in the order the rail lists them',
       [...seen].slice(0, 3).join() === 'day.html,blocks.html,index.html', [...seen].join(' → '));
    ok('and never holds more than one at a time', live(s.page) === 2, String(live(s.page)));
    ok('the timer is still counting', /next in \d+s|fetching/.test(await s.page.locator('#state').innerText()),
       await s.page.locator('#state').innerText());

    console.log('\nThe rail still drives it:\n');
    await s.page.locator('#hud').tap();
    await s.page.waitForTimeout(400);
    await s.page.locator('.dot', { hasText: 'Birthdays today' }).tap();
    await s.page.waitForTimeout(2500);
    ok('a stop on the rail goes there', (await srcOf(s.page)) === 'book.html', await srcOf(s.page));
    ok('still one document', live(s.page) === 2, String(live(s.page)));
    ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  console.log('\nOn the television, nothing changed:\n');
  {
    const s = await open(b, WALL, '?secs=5');
    await s.page.waitForTimeout(18000);          // the stagger asks the last at 15s
    ok('all seven are mounted', await frames(s.page) === 7, String(await frames(s.page)));
    ok('and all seven documents are live', live(s.page) === 8, String(live(s.page)));
    ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  console.log('\nAnd the choice can be forced either way from the address:\n');
  {
    const a = await open(b, PHONE, '?mount=all&secs=5');
    await a.page.waitForTimeout(2000);
    ok('?mount=all gives a phone the television\'s seven', await frames(a.page) === 7, String(await frames(a.page)));
    await a.ctx.close();
    const o = await open(b, WALL, '?mount=one&secs=5');
    await o.page.waitForTimeout(2000);
    ok('?mount=one gives a television the phone\'s one', await frames(o.page) === 1, String(await frames(o.page)));
    ok('no javascript errors', o.errors.length === 0, o.errors.join(' | '));
    await o.ctx.close();
  }

  await b.close();
  server.close();
  console.log();
  console.log(fails ? `  ${fails} FAILED` : '  all good');
  process.exit(fails ? 1 : 0);
})();
