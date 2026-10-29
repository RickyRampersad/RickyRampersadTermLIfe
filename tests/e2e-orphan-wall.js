// The orphan campaign's stop on the Branch Intelligence wall (28 October 2026), in a real browser, fed the way the
// campaign script feeds it (GET action=board&who=wall), at the branch television, a laptop and a phone.
// Pinned here:
//   - nothing below the fold and nothing cut through it on the television and the laptop; no sideways scroll anywhere;
//   - every desk's list is on screen with its marks and its open tasks; every agent is on one of the pages that turn;
//   - a script older than the stop says what to paste; a dead feed after a good one paints the last good answer;
//   - the shield, the narration (six lines) and the views beacon are there.
// Run: node tests/e2e-orphan-wall.js   (SHOTS=<dir> to keep screenshots)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || undefined;
const PORT = 8871;
const SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  — ' + x : '')); if (!c) fails++; };

const AGENTS = ['Neil R.', 'Felicia R.', 'Rajiv S.', 'Malcolm S.', 'Premchand D.', 'Randolph G.', 'Fawwaz M.', 'Meera P.', 'Narissa M.',
  'Daniel B.', 'Joy S.', 'Darryl M.', 'Varun S.', 'Faizal M.', 'Akaash K.'];
const FEED = {
  ok: true, wall: 1, at: '28 Oct, 2:35 PM', today: '2026-10-28',
  campaign: { households: { all: 2168, answered: 470, asked: 300, toReach: 120, stage: { done: 35, named: 80, spoken: 55, waiting: 130 }, agent: { one: 70, split: 5, none: 225 } },
    clients: { all: 2473, answered: 512, asked: 340, wrote: 61, stage: { done: 40, named: 90, spoken: 60, waiting: 150 } },
    auto: { letters: 1477, reminders: 1199, afterReminder: 128, waiting: 900 }, late: 210, lateHh: 190,
    firstTouch: { median: 3, within2: 41, n: 96, waiting: 180 }, at: '28 Oct 2026 14:30' },
  tasks: { open: 193, overdue: 61, closedToday: 14, people: [
    { name: 'Liz', open: 75, overdue: 22, dueToday: 30, closedToday: 4 }, { name: 'Azariah', open: 44, overdue: 12, dueToday: 10, closedToday: 3 },
    { name: 'Sasha', open: 41, overdue: 15, dueToday: 12, closedToday: 5 }, { name: 'Kamla', open: 27, overdue: 9, dueToday: 6, closedToday: 2 },
    { name: 'Branch Manager', open: 6, overdue: 3, dueToday: 0, closedToday: 0 }] },
  lists: [
    { name: 'Sasha', size: 15, posted: 15, done: 5, reached: 3, tried: 2, noted: 1, nothing: 4, first: '7:48 AM', last: '2:12 PM' },
    { name: 'Liz', size: 15, posted: 15, done: 2, reached: 1, tried: 4, noted: 0, nothing: 8, first: '8:30 AM', last: '1:05 PM' },
    { name: 'Azariah', size: 15, posted: 15, done: 0, reached: 0, tried: 0, noted: 0, nothing: 15, first: '', last: '' },
    { name: 'Kamla', size: 10, posted: 10, done: 3, reached: 2, tried: 1, noted: 2, nothing: 2, first: '9:02 AM', last: '9:02 AM' }],
  day: [{ name: 'Sasha', first: '7:48 AM', last: '2:12 PM', entries: 16 }, { name: 'Liz', first: '8:30 AM', last: '1:05 PM', entries: 9 },
        { name: 'Azariah', first: '', last: '', entries: 0 }, { name: 'Kamla', first: '9:02 AM', last: '9:02 AM', entries: 8 }, { name: 'Pawan', first: '', last: '', entries: 0 }],
  agents: { clients: 72, week: 41, today: 30, people: AGENTS.map((name, i) => ({ name, clients: 12 - (i % 9), week: i % 3 ? 2 : 0, today: i % 4 ? 0 : 1, feedback: i % 5 ? 0 : 1 })) },
  sf: { on: true } };

let mode = 'good';
async function open(b, vp) {
  const ctx = await b.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://script.google.com/**', r => {
    const u = r.request().url();
    if (mode === 'good' && /action=board/.test(u) && /who=wall/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) });
    if (mode === 'old') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, refused: true, error: 'That name or number was not found.' }) });
    return r.abort();
  });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  return { ctx, page, errs };
}
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'orphans-' + n + '.png') }); };

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const URL = 'http://127.0.0.1:' + PORT + '/intelligence/wall/orphans.html';

  for (const [label, vp] of [['the branch television, 1920x1080', { width: 1920, height: 1080 }], ['a laptop, 1366x768', { width: 1366, height: 768 }], ['a small laptop, 1280x720', { width: 1280, height: 720 }]]) {
    console.log('\n' + label + ':');
    mode = 'good';
    const { ctx, page, errs } = await open(b, vp);
    await page.goto(URL); await page.waitForTimeout(3500);
    const m = await page.evaluate(() => {
      const H = innerHeight, W = innerWidth, out = [];
      document.querySelectorAll('.card, .ls, .tile, .ticker, header').forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.right > W + 1) out.push(el.className + ' ' + Math.round(r.bottom) + '/' + H); });
      const cut = [];
      document.querySelectorAll('.ls, .tile, .legend div, .ag').forEach(el => { if (el.scrollWidth > el.clientWidth + 2) cut.push(el.className + ': ' + el.textContent.trim().slice(0, 40)); });
      const lists = [...document.querySelectorAll('.ls .who b')].map(x => x.textContent);
      const agents = [...document.querySelectorAll('.ag .nm b')].map(x => x.textContent);
      const pages = document.querySelectorAll('#agents .page').length;
      const bars = [...document.querySelectorAll('.ls .bar')].length;
      return { out, cut, lists, agents, pages, bars, sx: document.documentElement.scrollWidth > W, hN: document.querySelector('#hN').textContent,
        sub: document.querySelector('#sub').textContent, live: document.querySelector('#liveTxt').textContent,
        stack: [...document.querySelectorAll('#stack i')].map(i => i.style.width), mark: document.querySelectorAll('header .mark img').length };
    });
    ok('nothing below the fold or past the right edge', !m.out.length, m.out.join(' | '));
    ok('nothing cut through: no row or tile wider than its box', !m.cut.length, m.cut.join(' | '));
    ok('no sideways scroll', !m.sx);
    ok('the households counted up to the figure', m.hN === '470', m.hN);
    ok('the stage bar drawn in four parts', m.stack.length === 4 && m.stack.every(w => /%$/.test(w)) && parseFloat(m.stack[3]) > 40, m.stack.join(','));
    ok('every desk with a list, or tasks, has a row, the Branch Manager too', ['Sasha', 'Liz', 'Azariah', 'Kamla', 'Branch Manager'].every(n => m.lists.indexOf(n) >= 0) && m.lists.indexOf('Pawan') < 0, m.lists.join(','));
    ok('four lists drawn as bars', m.bars === 4, String(m.bars));
    ok('every agent is on one of the pages', AGENTS.every(a => m.agents.indexOf(a) >= 0), m.agents.length + ' of ' + AGENTS.length);
    ok('the gold shield, as every Intelligence wall stop but the pending four', m.mark === 1);
    ok('when it was read, and live', /28 Oct, 2:35 PM/.test(m.sub) && m.live === 'live', m.sub + ' / ' + m.live);
    ok('no script error', !errs.length, errs.join(' | '));
    await shot(page, vp.width + 'x' + vp.height);
    await ctx.close();
  }

  console.log('\na phone, 390x844:');
  {
    mode = 'good';
    const { ctx, page, errs } = await open(b, { width: 390, height: 844 });
    await page.goto(URL); await page.waitForTimeout(3000);
    const m = await page.evaluate(() => {
      const small = [...document.querySelectorAll('body *')].filter(el => el.children.length === 0 && el.textContent.trim() && el.getClientRects().length
        && parseFloat(getComputedStyle(el).fontSize) < 9).map(el => el.textContent.trim().slice(0, 30));
      return { sx: document.documentElement.scrollWidth > innerWidth + 1, small, agents: document.querySelectorAll('.ag').length, lists: document.querySelectorAll('.ls').length };
    });
    ok('no sideways scroll', !m.sx);
    ok('nothing under 9px', !m.small.length, m.small.slice(0, 5).join(' | '));
    ok('every row and every agent, on one scrolling page', m.lists === 5 && m.agents === AGENTS.length, m.lists + ' rows, ' + m.agents + ' agents');
    ok('no script error', !errs.length, errs.join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'orphans-phone.png'), fullPage: true });
    await ctx.close();
  }

  console.log('\nOld script, dead feed, snapshot:');
  {
    mode = 'old';
    const { ctx, page } = await open(b, { width: 1920, height: 1080 });
    await page.goto(URL); await page.waitForTimeout(1500);
    let t = await page.locator('#hOf').innerText();
    ok('a script older than the stop says what to paste', /Transition\.gs/.test(t) && /New version/.test(t), t);
    ok('and reads no feed', (await page.locator('#liveTxt').textContent()) === 'no feed');
    /* a good answer, then the feed dies: the last good answer stays on the screen */
    mode = 'good'; await page.reload(); await page.waitForTimeout(2500);
    mode = 'dead'; await page.reload(); await page.waitForTimeout(1500);
    t = await page.locator('#hN').innerText();
    ok('a dead feed after a good one paints the last good answer at once', t === '470' && /snapshot|no feed/.test(await page.locator('#liveTxt').textContent()), t);
    await ctx.close();
  }

  console.log('\nThe page itself:');
  const html = fs.readFileSync(path.join(ROOT, 'intelligence/wall/orphans.html'), 'utf8');
  const nar = (/var NARRATION = \[([\s\S]*?)\n\];/.exec(html) || [])[1] || '';
  ok('six narration lines folded in', (nar.match(/\{t:"/g) || []).length === 6);
  ok('the views beacon', html.indexOf('<!-- rrb-views -->') > 0);
  ok('it asks the campaign script with no code', /action=board&who=wall/.test(html) && !/code=/.test(html));
  ok('no colleague\'s surname, no client in the page', !/Lalla|Jagassar|Griffith|Dookran|Probhu|Kerwyn|Ramroach/i.test(html));
  const all = fs.readFileSync(path.join(ROOT, 'intelligence/wall/all.html'), 'utf8');
  ok('the wall plays it, after Issued this month', all.indexOf("file:'orphans.html'") > all.indexOf("file:'issued.html'") && all.indexOf("file:'orphans.html'") < all.indexOf("file:'index.html'"));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
