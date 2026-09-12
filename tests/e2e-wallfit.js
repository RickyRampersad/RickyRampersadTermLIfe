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
  ['Conversions',       '/intelligence/wall/conversion.html']
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
  head: { cases: 21, cover: 49900000, prem: 27400, unnamed: 1, ahead: { n: 13, cover: 26300000 } },
  state: { ready: { n: 13, cover: 31200000, prem: 16900 },
           collect: { n: 8, cover: 18700000, prem: 10500 },
           gone: { n: 5, cover: 24100000, prem: 9800 } },
  agentCount: 14,
  agents: 'Ada Bram Cleo Dev Esme Finn Gale Hana Iris Jude Kit Lena Mo Nell'.split(' ')
    .map((nm, i) => ({ name: nm + ' Quill', n: 14 - i, cover: (14 - i) * 1000000,
                       prem: (14 - i) * 300, top: (14 - i) * 400000, collect: i % 3 ? 1 : 0 })),
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
    await s.ctx.close();
  }

  /* ── The rail ─────────────────────────────────────────────────────────────
     Two rows of stops at most, the controls beside them and not underneath,
     and the timer clear of both. */
  console.log('\nThe rail, with twelve stops on it:\n');
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
    ok(tag.padEnd(22) + ' twelve stops on at most two rows', m.rows <= 2 && m.stops === 12,
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
