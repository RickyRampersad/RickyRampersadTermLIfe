// The Branch Intelligence Wall streams all five screens from one address.
//
// The five stories were built as five standing pages, and on the branch floor
// only ever one of them was seen. /intelligence/wall/all.html mounts all five
// once and turns between them; /intelwall forwards to it. This proves the
// player holds five frames, shows them one at a time in the film's order,
// moves on by itself, answers the keys, skips a story that never loads, and
// that the short link lands on it — against the real story pages, with their
// Salesforce feed stubbed silent.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8808;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
let hung = null, hungAsks = 0;                     // a story made to never answer
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (hung && f.endsWith(hung)) { hungAsks++; return; }   // never answers: the wall must cope
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };
const ORDER = ['index.html', 'possession.html', 'delivery.html', 'licence.html', 'book.html'];

async function open(b, query) {
  const ctx = await b.newContext({ viewport:{ width:1920, height:1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  // Nothing leaves the machine. Every story's feed is silenced so they settle
  // on "no feed" and the wall turns anyway; the fonts come back empty so a
  // slow CDN cannot hold a frame's load event, which is what held the first
  // run of this test for twenty seconds while the wall turned four times.
  await page.route(u => u.hostname !== 'localhost', r => {
    const h = new URL(r.request().url()).hostname;
    if (/script\.google\.com$/.test(h)) return r.fulfill({ status:200, contentType:'application/json', body:'{"ok":false}' });
    return r.fulfill({ status:200, contentType:'text/css', body:'' });
  });
  // The document, not the frames: the player starts turning the moment the
  // script runs, so the clock for these checks starts there too.
  await page.goto(`http://localhost:${PORT}/intelligence/wall/all.html${query || ''}`, { waitUntil:'domcontentloaded' });
  return { page, ctx, errors };
}
const visible = page => page.evaluate(() => [...document.querySelectorAll('iframe.slide')].map((f, i) => f.classList.contains('on') ? i : -1).filter(i => i > -1));
const srcs = page => page.evaluate(() => [...document.querySelectorAll('iframe.slide')].map(f => (f.getAttribute('src') || '').split('/').pop()));

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  console.log('\nFive stories, one at a time:\n');
  let s = await open(b, '?secs=5');
  await s.page.waitForTimeout(1200);
  ok('five frames on the stage', await s.page.locator('iframe.slide').count() === 5);
  ok('the first is showing and only the first', JSON.stringify(await visible(s.page)) === '[0]', JSON.stringify(await visible(s.page)));
  ok('and the boot card has cleared', await s.page.evaluate(() => document.getElementById('boot').classList.contains('gone')));
  const t0 = await s.page.locator('body').innerText();
  ok('five named stops on the rail', /1\. Premium dues/.test(t0) && /5\. Birthdays today/.test(t0));
  await s.page.waitForTimeout(11000);          // stagger is 2.5s apart: all five assigned by 10s
  ok('every story is loaded in its own frame, in the film\'s order', JSON.stringify(await srcs(s.page)) === JSON.stringify(ORDER), JSON.stringify(await srcs(s.page)));
  const first = await s.page.frames().filter(f => f.url().endsWith('/index.html')).length;
  ok('the first story really rendered inside its frame', first === 1);
  ok('it has moved on by itself within the dwell', (await visible(s.page))[0] >= 1, JSON.stringify(await visible(s.page)));
  await s.page.screenshot({ path: '/tmp/intelwall-slide.png' });

  console.log('\nThe first turn comes early:\n');
  const e = await open(b, '');                    // the real dwells: 26s for the first story
  await e.page.waitForTimeout(14000);
  ok('with no dwell given, the wall has moved off the first story inside fifteen seconds', (await visible(e.page))[0] === 1, JSON.stringify(await visible(e.page)));
  ok('no javascript errors', e.errors.length === 0, e.errors.join(' | '));
  await e.ctx.close();

  console.log('\nThe keys:\n');
  await s.page.keyboard.press('5');  await s.page.waitForTimeout(300);
  ok('a number jumps to that story', JSON.stringify(await visible(s.page)) === '[4]');
  await s.page.keyboard.press('ArrowRight'); await s.page.waitForTimeout(300);
  ok('right from the last wraps to the first', JSON.stringify(await visible(s.page)) === '[0]');
  await s.page.keyboard.press('ArrowLeft'); await s.page.waitForTimeout(300);
  ok('left from the first wraps to the last', JSON.stringify(await visible(s.page)) === '[4]');
  await s.page.keyboard.press(' ');
  const before = (await visible(s.page))[0];
  await s.page.waitForTimeout(6500);
  ok('space holds the story past its dwell', (await visible(s.page))[0] === before && /paused/.test(await s.page.locator('#state').innerText()));
  await s.page.keyboard.press(' ');
  await s.page.mouse.move(600, 600);
  await s.page.locator('.dot', { hasText: 'With the agent' }).click(); await s.page.waitForTimeout(300);
  ok('a stop on the rail goes there', JSON.stringify(await visible(s.page)) === '[2]');
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  console.log('\nA story that never loads:\n');
  hung = '/intelligence/wall/licence.html';
  s = await open(b, '?secs=2&grace=1&retry=4');
  await s.page.waitForTimeout(13500);          // past its grace, and a few turns
  // sampled well inside the dwell, or the samples alias to the turning and see the same story every time
  const seen = new Set();
  for (let i = 0; i < 20; i++) { seen.add((await visible(s.page))[0]); await s.page.waitForTimeout(500); }
  ok('the silent one is skipped and the other four keep turning', !seen.has(3) && seen.size === 4, [...seen].join(','));
  ok('and it is struck through on the rail', await s.page.locator('.dot.dead').count() === 1);
  ok('and asked for again rather than given up on for the day', hungAsks >= 2, 'asked ' + hungAsks + ' time(s)');
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();
  hung = null;

  console.log('\nThe short link:\n');
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await page.route(u => u.hostname !== 'localhost', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.goto(`http://localhost:${PORT}/intelwall/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(800);
  ok('/intelwall lands on the player', /\/intelligence\/wall\/all\.html$/.test(page.url()), page.url());
  await ctx.close();

  console.log('\nThe page itself:\n');
  const html = fs.readFileSync(path.join(ROOT, 'intelligence/wall/all.html'), 'utf8');
  ok('carries the view beacon', /<!-- rrb-views -->/.test(html));
  ok('uses the branch mark, not a substitute', /logo-mark\.png/.test(html) && !/RR<\/|>RR</.test(html));
  ok('names no colleague and no client', !/sasha|kamla|elizabeth|azariah|pawan|kerwyn|akaash|gary/i.test(html));
  console.log('\n  screenshot: /tmp/intelwall-slide.png');

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
