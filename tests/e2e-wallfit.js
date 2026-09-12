// The wall is one screen, and nothing may fall off the bottom of it.
//
// Every wall page is body{overflow:hidden}, which is right — a television is
// not scrolled. The consequence is that anything past the fold is not "below,
// scroll down", it is gone, and nothing on screen says so. The conversions
// slide shipped with five rows of tiles and six paragraphs of instruction in
// one column; at 1366x768 half of it was simply missing, and at 1920x1080 the
// last line of the call was cut through the middle.
//
// And the rail: eleven stops fitted on one row, the twelfth wrapped it to two
// and pushed Pause and Narrate onto a third, over the foot of the story. The
// branch's word for that was "jumbled". Then the fix put the controls into the
// timer instead, because the gutter reserved for the timer was a fixed width
// against a timer as wide as its own text.
//
// So this file measures, at the sizes a branch actually has: nothing below the
// fold, nothing cut through it, no sideways scroll, and a rail of at most two
// rows that never lands on the timer.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8861;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

// Every story in the rotation. index.html is served from the directory.
const PAGES = [
  ['The day so far',    '/intelligence/wall/day.html'],
  ['The day in blocks', '/intelligence/wall/blocks.html'],
  ['What is pending',   '/intelligence/wall/pending.html'],
  ['Ready to settle',   '/intelligence/wall/ready.html'],
  ['Whose move is it',  '/intelligence/wall/triage.html'],
  ['Who is holding it up', '/intelligence/wall/culprits.html'],
  ['Premium dues',      '/intelligence/wall/'],
  ['In our possession', '/intelligence/wall/possession.html'],
  ['With the agent',    '/intelligence/wall/delivery.html'],
  ['The licence year',  '/intelligence/wall/licence.html'],
  ['Birthdays today',   '/intelligence/wall/book.html'],
  ['Conversions',       '/intelligence/wall/conversion.html'],
  ['The permanent book', '/intelligence/wall/permanent.html'],
  ['Riders on a clock', '/intelligence/wall/riders.html']
];

// What a leaf element that carries words looks like, and where it sits. The
// feeds answer {ok:false} throughout, so this measures the empty state — which
// is the state a wall is in when the sheet is slow, and the one nobody checks.
const MEASURE = `(() => {
  const leaves = [...document.querySelectorAll('body *')].filter(el => {
    if (el.children.length) return false;
    const t = (el.textContent || '').trim();
    if (t.length < 4) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    return true;
  });
  const words = el => (el.textContent || '').trim().slice(0, 44);
  return {
    overflow: document.documentElement.scrollHeight - innerHeight,
    sideways: document.documentElement.scrollWidth - innerWidth,
    below: leaves.filter(el => el.getBoundingClientRect().top >= innerHeight).map(words),
    through: leaves.filter(el => {
      const r = el.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > innerHeight + 2;
    }).map(words)
  };
})()`;

/* A month's worth of conversions, invented. Fourteen agents is what the feed
   caps at, which is more than fits on a 720-high screen — so this is the
   fixture that proves the trimming, and an empty feed would prove nothing. */
const CONV = { ok: true, data: {
  configured: true, generatedAt: '2026-09-12', month: 'September', day: 12, years: 10, duesRead: true,
  head: { cases: 21, cover: 49900000, prem: 27400, unnamed: 1,
          ahead: { n: 13, cover: 26300000 }, passed: { n: 8, cover: 23600000 },
          expSoon: { n: 2, cover: 1900000 }, noDate: 1 },
  /* A month with birthdays on both sides of today, so the strip has gold
     cells, struck-through grey ones, and a ring on the 12th. */
  days: [{ day: 3, n: 2, cover: 4100000, past: true },
         { day: 8, n: 3, cover: 9200000, past: true },
         { day: 11, n: 3, cover: 10300000, past: true },
         { day: 12, n: 1, cover: 2400000, past: false },
         { day: 15, n: 4, cover: 8800000, past: false },
         { day: 19, n: 2, cover: 3600000, past: false },
         { day: 23, n: 3, cover: 6200000, past: false },
         { day: 30, n: 3, cover: 5300000, past: false }],
  daysInMonth: 30,
  state: { ready: { n: 13, cover: 31200000, prem: 16900 },
           collect: { n: 8, cover: 18700000, prem: 10500 },
           gone: { n: 5, cover: 24100000, prem: 9800 } },
  agentCount: 14,
  /* Ordered the way the feed orders them: soonest birthday first, the days
     already gone at the foot. The ages are what the client turns on the day. */
  agents: 'Ada Bram Cleo Dev Esme Finn Gale Hana Iris Jude Kit Lena Mo Nell'.split(' ')
    .map((nm, i) => {
      const day = [12, 15, 15, 19, 19, 23, 23, 23, 30, 30, 30, 3, 8, 11][i];
      const past = i >= 11;
      return { name: nm + ' Quill', n: 14 - i, cover: (14 - i) * 1000000,
               prem: (14 - i) * 300, top: (14 - i) * 400000, collect: i % 3 ? 1 : 0,
               day: day, past: past, turning: 34 + i * 2,
               rank: past ? day + 100 : day };
    }),
  mix: [{ code: 'FCT', label: 'Revised Flexi Term (convertible)', n: 20, cover: 49400000 }],
  pool: { conv: { n: 304, cover: 493437000, prem: 229284 },
          nonconv: { n: 237, cover: 158053000, prem: 207000 },
          unsettled: { n: 1221, cover: 1194000000 },
          live: { ready: { n: 263, cover: 343092500, prem: 323227 },
                  collect: { n: 335, cover: 451412000, prem: 402000 },
                  gone: { n: 840, cover: 0, prem: 0 } } },
  soon: [2029, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040]
    .map((y, i) => ({ yr: y, n: i + 1, cover: (i + 1) * 500000 })),
  soonTotal: { n: 55, cover: 27500000 },
  notes: ['5 of this month\u2019s birthdays are on policies the dues tab says have lapsed.']
} };

/* A rider month, invented. Two days with something on them — one gone, one
   still to come — plus the two piles that are never empty, because it is
   those the screen has to hold when the month is thin. */
const RID = { ok: true, data: {
  configured: true, generatedAt: '2026-09-12', month: 'September', day: 12,
  daysInMonth: 30, window: 12, duesRead: true,
  head: { n: 1306, cover: 642083002, prem: 497952 },
  book: { n: 5924, dated: 2644, blank: 3280, cover: 1540686000, prem: 1586000 },
  gone: { n: 74, cover: 26125856, prem: 24040 },
  thisMonth: { n: 3, cover: 350000, prem: 200 },
  ahead: { n: 9, cover: 2100000, prem: 1400 },
  days: [{ day: 5, n: 1, cover: 250000, past: true, kinds: { ci: 1 } },
         { day: 24, n: 2, cover: 100000, past: false, kinds: { ad: 1, wp: 1 } }],
  months: [{ ym: '2026-09', lab: 'September 2026', n: 3, cover: 350000 },
           { ym: '2026-11', lab: 'November 2026', n: 2, cover: 750000 },
           { ym: '2027-02', lab: 'February 2027', n: 4, cover: 1000000 }],
  kinds: [
    { key: 'ci', lab: 'Critical illness', does: 'pays on diagnosis', have: 2958, dated: 1615,
      blank: 1343, cover: 1277983100, prem: 1370913, gone: { n: 51, cover: 23166342, prem: 23457 },
      month: { n: 1 }, ahead: { n: 5 }, forever: { n: 1092, cover: 601071002, prem: 488772 } },
    { key: 'ad', lab: 'Accidental death', does: 'accident only', have: 1320, dated: 517,
      blank: 803, cover: 262587454, prem: 36254, gone: { n: 15, cover: 2955514, prem: 30 },
      month: { n: 1 }, ahead: { n: 1 }, forever: { n: 210, cover: 41000000, prem: 9000 } },
    { key: 'wp', lab: 'Waiver of premium', does: 'pays the premium if they cannot', have: 1616,
      dated: 483, blank: 1133, cover: null, prem: 177222, gone: { n: 7, cover: 0, prem: 508 },
      month: { n: 1 }, ahead: { n: 2 }, forever: { n: 0, cover: 0, prem: 0 } },
    { key: 'di', lab: 'Disability income', does: 'a monthly benefit', have: 30, dated: 29,
      blank: 1, cover: 115429, prem: 1802, gone: { n: 1, cover: 3000, prem: 45 },
      month: { n: 0 }, ahead: { n: 1 }, forever: { n: 4, cover: 12000, prem: 180 } }
  ],
  agents: 'Ada Bram Cleo Dev Esme Finn Gale Hana Iris Jude Kit Lena'.split(' ')
    .map((nm, i) => ({ name: nm + ' Quill', n: 12 - i, collect: i % 3 ? 1 : 0,
                       oldest: 2015 + i, cover: (12 - i) * 400000, prem: (12 - i) * 300 })),
  agentCount: 18,
  notes: ['3,280 of the 5,924 riders in force carry no expiry date at all, so no screen can tell you when they end.']
} };

async function fresh(b, w, h, feed) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route(u => u.hostname !== 'localhost', r => {
    const host = new URL(r.request().url()).hostname;
    if (/script\.google\.com$/.test(host))
      return r.fulfill({ status: 200, contentType: 'application/json',
                         body: JSON.stringify(feed || { ok: false }) });
    return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  return { ctx, page, errors };
}

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  /* ── Every story, at the branch's own screen ──────────────────────────────
     1080 is the television on the wall in Chaguanas. Two of the older stories
     — premium dues and birthdays — only fit at this height and not below it,
     so this asserts the height the branch has rather than a height it does
     not, and says which two would need the same treatment if that changes. */
  console.log('\nEvery story fits the television, with nothing past the fold:\n');
  for (const [name, url] of PAGES) {
    const s = await fresh(b, 1920, 1080);
    await s.page.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1200);
    const m = await s.page.evaluate(MEASURE);
    ok(name.padEnd(21) + ' fits, and nothing is cut off',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, sideways ' + m.sideways +
       ', below: ' + JSON.stringify(m.below.slice(0, 2)) +
       ', cut through: ' + JSON.stringify(m.through.slice(0, 2)));
    await s.ctx.close();
  }

  /* ── The conversions slide, at every size a branch might use ──────────────
     This is the one that broke, and it is the one that scales: the hero, the
     tiles and the rows are all clamped to the viewport, and both lists are
     trimmed to the rows that actually fit. */
  console.log('\nAnd conversions scales, from a laptop to a 4K panel:\n');
  for (const [w, h, tag] of [[3840,2160,'4K panel'],[1920,1080,'the branch television'],
                             [1600,900,'1600 x 900'],[1366,768,'a laptop'],[1280,720,'720p']]) {
    const s = await fresh(b, w, h, CONV);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/conversion.html`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1300);
    const m = await s.page.evaluate(MEASURE);
    ok(tag.padEnd(22) + ' nothing below the fold, nothing cut through it',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, below ' + JSON.stringify(m.below.slice(0, 2)) +
       ', through ' + JSON.stringify(m.through.slice(0, 2)));
    /* A trimmed list has to SAY it is trimmed. A wall that quietly drops the
       last agent is worse than one that shows nine and admits to three more. */
    const t = await s.page.evaluate(() => ({
      rows: document.querySelectorAll('#cList .crow').length,
      owns: /more agents below the fold/.test(document.getElementById('cMix').textContent || '')
    }));
    ok(tag.padEnd(22) + ' draws ' + t.rows + ' of fourteen agent rows' +
       (t.owns ? ', and owns up to the rest' : ''),
       t.rows >= 3 && (t.rows === 14 || t.owns),
       t.rows + ' rows, admits to the remainder: ' + t.owns);
    /* The day strip is the whole point of the screen: a cell for every day of
       the month, gold for a birthday still to come, grey for one already gone,
       and a ring on today. It must survive every one of these sizes intact —
       there is nothing to trim here, and a month missing its last week would
       send an agent past a client without a call. */
    const c = await s.page.evaluate(() => {
      const cells = [...document.querySelectorAll('#cCal b')];
      return {
        cells: cells.length,
        marked: cells.filter(el => el.classList.contains('has')).length,
        gone: cells.filter(el => el.classList.contains('past')).length,
        today: cells.filter(el => el.classList.contains('today')).length,
        square: cells.length ? Math.abs(cells[0].getBoundingClientRect().width -
                                        cells[0].getBoundingClientRect().height) : 99,
        first: (document.querySelector('#cList .crow .v') || {}).textContent || ''
      };
    });
    ok(tag.padEnd(22) + ' the month is whole: thirty cells, eight with a birthday, three gone, today ringed',
       c.cells === 30 && c.marked === 8 && c.gone === 3 && c.today === 1 && c.square < 2,
       JSON.stringify(c));
    ok(tag.padEnd(22) + ' the agent at the top is the one whose birthday is soonest',
       /12th/.test(c.first), 'top row reads ' + JSON.stringify(c.first));
    await s.ctx.close();
  }

  /* ── The riders screen, at every size ────────────────────────────────────
     The month is the thin part of this screen and the two piles are the thick
     part, so what has to survive a short screen is the strip and the four
     riders — not the agent list, which is the one allowed to give way. */
  console.log('\nAnd riders on a clock holds at every size:\n');
  for (const [w, h, tag] of [[3840,2160,'4K panel'],[1920,1080,'the branch television'],
                             [1600,900,'1600 x 900'],[1366,768,'a laptop'],[1280,720,'720p']]) {
    const s = await fresh(b, w, h, RID);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/riders.html`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1300);
    const m = await s.page.evaluate(MEASURE);
    ok(tag.padEnd(22) + ' nothing below the fold, nothing cut through it',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, below ' + JSON.stringify(m.below.slice(0, 2)) +
       ', through ' + JSON.stringify(m.through.slice(0, 2)));
    const r = await s.page.evaluate(() => ({
      cells: document.querySelectorAll('#rCalCells b').length,
      marked: document.querySelectorAll('#rCalCells b.has').length,
      today: document.querySelectorAll('#rCalCells b.today').length,
      days: document.querySelectorAll('#rDays div').length,
      kinds: document.querySelectorAll('#rKinds .crow').length,
      agents: document.querySelectorAll('#rList .crow').length,
      owns: /more agents below the fold/.test(document.getElementById('rNote').textContent || ''),
      named: (document.getElementById('rDays').textContent || '')
    }));
    /* All four riders, always. A screen that exists to show the four of them
       and quietly drops one is worse than no screen. */
    ok(tag.padEnd(22) + ' all four riders are drawn, and the month is whole',
       r.kinds === 4 && r.cells === 30 && r.marked === 2 && r.today === 1,
       JSON.stringify(r));
    /* And each day says WHICH rider, because "something expires on the 24th"
       is not a call anybody can make. */
    ok(tag.padEnd(22) + ' each day names the rider that ends on it',
       r.days === 2 && /Critical illness/.test(r.named) && /Accidental death/.test(r.named),
       JSON.stringify(r.named.slice(0, 80)));
    ok(tag.padEnd(22) + ' draws ' + r.agents + ' of twelve agent rows' +
       (r.owns ? ', and owns up to the rest' : ''),
       r.agents >= 3 && (r.agents === 12 || r.owns),
       r.agents + ' rows, admits to the remainder: ' + r.owns);
    await s.ctx.close();
  }

  /* ── The rail ─────────────────────────────────────────────────────────────
     Two rows of stops at most, the controls beside them and not underneath,
     and the timer clear of both. */
  console.log('\nThe rail, with fourteen stops on it:\n');
  for (const [w, h, tag] of [[3840,2160,'4K panel'],[1920,1080,'the branch television'],
                             [1600,900,'1600 x 900'],[1366,768,'a laptop'],[1280,720,'720p']]) {
    const s = await fresh(b, w, h);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/all.html?secs=600`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(2500);
    await s.page.mouse.move(w / 2, h - 40);
    await s.page.waitForTimeout(700);
    const m = await s.page.evaluate(() => {
      const box = el => el.getBoundingClientRect();
      const hits = (a, t) => !(a.right < t.left || a.left > t.right || a.bottom < t.top || a.top > t.bottom);
      const hud = box(document.getElementById('hud'));
      const dots = [...document.querySelectorAll('#dots .dot')];
      return {
        stops: dots.length,
        rows: new Set(dots.map(d => Math.round(box(d).top))).size,
        onTimer: dots.filter(d => hits(box(d), hud)).map(d => d.textContent.trim()),
        ctlOnTimer: hits(box(document.querySelector('.ctl')), hud),
        ctlLeftOfDots: box(document.querySelector('.ctl')).left < box(dots[0]).left,
        lifted: document.body.classList.contains('railup')
      };
    });
    ok(tag.padEnd(22) + ' fourteen stops on at most two rows', m.rows <= 2 && m.stops === 14,
       m.stops + ' stops on ' + m.rows + ' rows');
    ok(tag.padEnd(22) + ' no stop lands on the timer', !m.onTimer.length, JSON.stringify(m.onTimer));
    ok(tag.padEnd(22) + ' nor do Pause and Narrate', !m.ctlOnTimer);
    ok(tag.padEnd(22) + ' the controls lead the rail rather than trail it', m.ctlLeftOfDots);
    ok(tag.padEnd(22) + ' and the timer has stepped up out of the way', m.lifted);
    ok(tag.padEnd(22) + ' no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  await b.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED\n' : '\n  all good\n');
  process.exit(fails ? 1 : 0);
})();
