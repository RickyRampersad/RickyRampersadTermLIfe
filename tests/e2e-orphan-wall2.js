// Part 2 of the orphan campaign on the Branch Intelligence wall (28 October 2026): "What it has earned" (orphans-results.html)
// and "The First-Contact Cup" (orphans-cup.html), in a real browser, fed the way the campaign script feeds them (GET
// action=board&who=wall), at the branch television, two laptops and a phone.
// Pinned here:
//   - nothing below the fold and nothing cut through on the television and the laptops; no sideways scroll anywhere;
//   - the TT$200 figures are the claims times the amount; every stage, every agent's bar, the one line for those who left;
//   - new business, premiums paid back (a ring of three), back in force, and what clients told us;
//   - the three players ranked by points, with their stats, the AI's stars, this week and last; last week's winner;
//     the points rule; every agent with their support person on one of the pages that turn; who named;
//   - a script older than the stop says what to paste; a dead feed after a good one paints the last good answer;
//   - the shield, the narration (six lines each), the views beacon, and both on the wall after the first orphan stop.
// Run: node tests/e2e-orphan-wall2.js   (SHOTS=<dir> to keep screenshots)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || undefined;
const PORT = 8872;
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
const SUP = { 'Neil R.': 'Liz', 'Felicia R.': 'Liz', 'Rajiv S.': 'Liz', 'Randolph G.': 'Liz', 'Varun S.': 'Sasha', 'Fawwaz M.': 'Sasha', 'Malcolm S.': 'Sasha',
  'Premchand D.': 'Azariah', 'Darryl M.': 'Azariah', 'Meera P.': 'Azariah', 'Narissa M.': 'Azariah', 'Daniel B.': 'Azariah' };
const per = (pts, reached, fast, home, comm, drive) => ({ pts, reached, fast, home, homeFast: Math.floor(home / 2), tried: reached + 3, notes: reached * 2 + 4, clients: reached + 5,
  comm, drive, commGood: Math.floor(reached / 2), driveGood: home, speed: 1.5 });
const FEED = {
  ok: true, wall: 1, at: '28 Oct, 3:10 PM', today: '2026-10-28',
  campaign: { households: { all: 2168, answered: 470, asked: 300, stage: { done: 35, named: 80, spoken: 55, waiting: 130 } }, auto: {}, firstTouch: {} },
  sf: { on: true },
  agents: { clients: 72, week: 41, today: 30, people: AGENTS.map((name, i) => ({ name, clients: 12 - (i % 9), week: 2, today: 0, feedback: 0 })) },
  money: { amount: 200, cur: 'TT$', from: '2026-09-09', clients: 15, stage: { received: 2, csr: 0, processed: 1, retention: 1, scheduled: 6, paid: 5 },
    paid: 5, scheduled: 6, pending: 4, noDate: 1, next: '4 Nov',
    agents: [{ name: 'Felicia R.', sq: 3, paid: 1, scheduled: 2, pending: 0 }, { name: 'Akaash K.', sq: 3, paid: 1, scheduled: 0, pending: 2 },
             { name: 'Varun S.', sq: 1, paid: 0, scheduled: 1, pending: 0 }, { name: 'Malcolm S.', sq: 1, paid: 0, scheduled: 1, pending: 0 },
             { name: 'Rajiv S.', sq: 2, paid: 0, scheduled: 1, pending: 1 }, { name: 'Premchand D.', sq: 1, paid: 1, scheduled: 0, pending: 0 },
             { name: 'Joy S.', sq: 1, paid: 1, scheduled: 0, pending: 0 }],
    left: { sq: 3, paid: 1, scheduled: 1, pending: 1 },
    weeks: [{ week: '7 Sep', sq: 1 }, { week: '21 Sep', sq: 2 }, { week: '28 Sep', sq: 2 }, { week: '5 Oct', sq: 5 }, { week: '12 Oct', sq: 6 }, { week: '19 Oct', sq: 2 }],
    days: { toRetention: 7, toPaid: 14 } },
  results: { apps: { since: '2026-09-25', clients: 1, apps: 1, settled: 1, uw: 0, ntu: 0, lines: { Life: 1 }, agents: [{ name: 'Neil R.', apps: 1, settled: 1 }], branchApps: 55 } },
  back: { ready: true, built: '28 Oct 06:00', I: { letter: 292, caughtUp: 135, behind: 121, none: 36, noBook: 0 }, G: { letter: 578, back: 4, noBook: 4 } },
  said: { wrote: 61, replies: 48, reviews: 12, thanks: 22,
    asks: [{ label: 'Call me', clients: 223 }, { label: 'An agent, once their concerns are read', clients: 71 }, { label: 'The full review', clients: 40 }, { label: 'Wrote to us in their own words', clients: 61 }],
    themes: [{ label: 'A call back', clients: 31 }, { label: 'Who looks after them now', clients: 24 }, { label: 'Premiums and payments', clients: 19 }, { label: 'Waiting, or a delay', clients: 12 }],
    risk: [{ label: 'their former agent has been in touch since leaving', clients: 41 }, { label: 'An agent, once their concerns are read', clients: 71 }] },
  charge: { agents: AGENTS.map((name, i) => ({ name, support: SUP[name] || '', clients: 12 - (i % 9), week: 2, feedback: 0, sq: i % 4 === 0 ? 2 : 0, paid: i % 8 === 0 ? 1 : 0 })),
    namers: [{ name: 'Branch Manager', n: 7 }, { name: 'Azariah', n: 1 }, { name: 'In Salesforce', n: 17 }],
    support: [{ name: 'Azariah', agents: 5, clients: 40, sq: 3 }, { name: 'Liz', agents: 4, clients: 30, sq: 4 }, { name: 'Sasha', agents: 3, clients: 22, sq: 2 }] },
  cup: { points: { reached: 3, fast: 2, home: 10, homeFast: 5, comm: 1, drive: 1 }, fastDays: 2, homeDays: 30, homeFastDays: 7, good: 4,
    periods: { all: 'since 25 Sep', last: '21 Oct to 27 Oct', week: '28 Oct' },
    people: [{ name: 'Liz', all: per(96, 18, 9, 3, 3.4, 2.9), last: per(31, 6, 3, 1, 3.6, 3.1), week: per(4, 1, 0, 0, 3, 3) },
             { name: 'Sasha', all: per(118, 21, 12, 4, 4.1, 3.6), last: per(27, 5, 3, 1, 4.2, 3.5), week: per(6, 2, 0, 0, 4, 4) },
             { name: 'Azariah', all: per(71, 15, 7, 2, 3.0, 2.6), last: per(35, 7, 4, 1, 3.3, 2.8), week: per(0, 0, 0, 0, null, null) }],
    leader: { all: 'Sasha', last: 'Azariah', week: 'Sasha' }, read: { ai: 212, rules: 40, on: true }, clients: 310 } };

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
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const fit = page => page.evaluate(() => {
  const H = innerHeight, W = innerWidth, out = [], cut = [];
  document.querySelectorAll('.card, .st, .ar, .hb, .tr, .sv, .ticker, header').forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.right > W + 1) out.push(el.className + ' ' + Math.round(r.bottom) + '/' + H); });
  document.querySelectorAll('.st, .ar, .sv, .tr, .hb, .money .row > div, .pl .nm, .pl .pts').forEach(el => { if (el.scrollWidth > el.clientWidth + 2) cut.push(el.className + ': ' + el.textContent.trim().slice(0, 40)); });
  return { out, cut, sx: document.documentElement.scrollWidth > W + 1, mark: document.querySelectorAll('header .mark img[src$="logo-mark.png"]').length };
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const BASE = 'http://127.0.0.1:' + PORT + '/intelligence/wall/';

  for (const [label, vp] of [['the branch television, 1920x1080', { width: 1920, height: 1080 }], ['a laptop, 1366x768', { width: 1366, height: 768 }], ['a small laptop, 1280x720', { width: 1280, height: 720 }]]) {
    console.log('\nWhat it has earned, ' + label + ':');
    mode = 'good';
    let { ctx, page, errs } = await open(b, vp);
    await page.goto(BASE + 'orphans-results.html'); await page.waitForTimeout(3500);
    let f = await fit(page);
    ok('nothing below the fold or past the right edge', !f.out.length, f.out.join(' | '));
    ok('nothing cut through', !f.cut.length, f.cut.join(' | '));
    ok('no sideways scroll', !f.sx);
    ok('the gold shield', f.mark === 1);
    let m = await page.evaluate(() => ({
      paid: document.querySelector('#mPaidN').textContent, due: document.querySelector('#mDue').textContent, way: document.querySelector('#mWay').textContent,
      st: [...document.querySelectorAll('.st b')].map(x => x.textContent), ags: [...document.querySelectorAll('.ar .nm')].map(x => x.textContent),
      left: !!document.querySelector('.ar .nm.left'), weeks: document.querySelectorAll('.weeks i').length,
      aN: document.querySelector('#aN').textContent, arcs: document.querySelectorAll('#iRing .arc').length, iLg: document.querySelector('#iLg').textContent,
      gN: document.querySelector('#gN').textContent, ask: document.querySelectorAll('#sAsk .hb').length, theme: document.querySelectorAll('#sTheme .hb').length,
      risk: document.querySelectorAll('#sRisk .hb').length, cap: document.querySelector('#mCap').textContent, tk: document.querySelector('#tk').textContent }));
    ok('TT$1,000 paid (5 × 200), TT$1,200 to be paid, TT$800 on its way', m.paid === '1,000' && m.due === 'TT$1,200' && m.way === 'TT$800', [m.paid, m.due, m.way].join(' '));
    ok('six stages, in order', m.st.join(',') === '2,0,1,1,6,5', m.st.join(','));
    ok('every agent with a claim, and one line for those who left', m.ags.length === 8 && m.left && m.ags.indexOf('Agents who left') === 7, m.ags.join(','));
    ok('questionnaires by week', m.weeks === 6);
    ok('the caption: in all, days to Retention and to paid, the one with no paid date', /TT\$3,000/.test(m.cap) && /7 days/.test(m.cap) && /14 days/.test(m.cap) && /no paid date/.test(m.cap), m.cap);
    ok('new business, from orphan clients', m.aN === '1');
    ok('premiums paid back: a ring of three, with its counts', m.arcs === 3 && /135/.test(m.iLg) && /121/.test(m.iLg) && /36/.test(m.iLg), m.iLg);
    ok('back in force', m.gN === '4');
    ok('what clients told us: asks, subjects, needs a person', m.ask === 4 && m.theme === 4 && m.risk === 2);
    ok('the ticker carries the money', /TT\$1,000/.test(m.tk));
    ok('no script error', !errs.length, errs.join(' | '));
    await shot(page, 'results-' + vp.width + 'x' + vp.height);
    await ctx.close();

    console.log('\nThe First-Contact Cup, ' + label + ':');
    ({ ctx, page, errs } = await open(b, vp));
    await page.goto(BASE + 'orphans-cup.html'); await page.waitForTimeout(3500);
    f = await fit(page);
    ok('nothing below the fold or past the right edge', !f.out.length, f.out.join(' | '));
    ok('nothing cut through', !f.cut.length, f.cut.join(' | '));
    ok('no sideways scroll', !f.sx);
    ok('the gold shield', f.mark === 1);
    m = await page.evaluate(() => ({
      names: [...document.querySelectorAll('.pl .nm')].map(x => x.textContent), medals: [...document.querySelectorAll('.medal')].map(x => x.textContent),
      pts: [...document.querySelectorAll('.pl .pts span')].map(x => x.textContent), stars: [...document.querySelectorAll('.stars i')].map(x => x.style.width),
      win: document.querySelector('#wName').textContent, wsub: document.querySelector('#wSub').textContent, wk: document.querySelectorAll('.wb').length,
      rules: document.querySelector('#rules').textContent + ' ' + document.querySelector('#rnote').textContent, rows: [...document.querySelectorAll('.tr .a')].map(x => x.textContent),
      sup: [...document.querySelectorAll('.tr')].map(r => r.querySelector('.a').textContent + '=' + r.querySelector('.s').textContent),
      namers: document.querySelector('#namers').textContent, pages: document.querySelectorAll('#rows .page').length }));
    ok('the three, ranked by points', m.names.join(',') === 'Sasha,Liz,Azariah' && m.medals.join(',') === '1,2,3', m.names.join(',') + ' ' + m.medals.join(','));
    ok('their points counted up', m.pts.join(',') === '118,96,71', m.pts.join(','));
    ok('six star bars, drawn to the AI\'s score', m.stars.length === 6 && m.stars[0] === '82%', m.stars.join(','));
    ok('last week\'s winner, for the Wednesday meeting', m.win === 'Azariah' && /35/.test(m.wsub) && /Wednesday/.test(m.wsub), m.win + ' / ' + m.wsub);
    ok('this week so far, a bar each', m.wk === 3);
    ok('how the cup is won', /\+3/.test(m.rules) && /\+10/.test(m.rules) && /\+5/.test(m.rules) && /212 timelines/.test(m.rules), m.rules.slice(0, 200));
    ok('every agent on one of the pages, with the support person beside them', AGENTS.every(a => m.rows.indexOf(a) >= 0) && m.sup.indexOf('Neil R.=Liz') >= 0 && m.sup.indexOf('Akaash K.=not set') >= 0, m.rows.length + ' / ' + m.sup.slice(0, 4).join(','));
    ok('who named the clients', /Branch Manager 7/.test(m.namers) && /In Salesforce 17/.test(m.namers), m.namers);
    ok('no script error', !errs.length, errs.join(' | '));
    await shot(page, 'cup-' + vp.width + 'x' + vp.height);
    await ctx.close();
  }

  console.log('\na phone, 390x844:');
  for (const f of ['orphans-results.html', 'orphans-cup.html']) {
    mode = 'good';
    const { ctx, page, errs } = await open(b, { width: 390, height: 844 });
    await page.goto(BASE + f); await page.waitForTimeout(3000);
    const m = await page.evaluate(() => {
      const small = [...document.querySelectorAll('body *')].filter(el => el.children.length === 0 && el.textContent.trim() && el.getClientRects().length
        && parseFloat(getComputedStyle(el).fontSize) < 8.5).map(el => el.textContent.trim().slice(0, 30));
      return { sx: document.documentElement.scrollWidth > innerWidth + 1, small, rows: document.querySelectorAll('.tr').length };
    });
    ok(f + ': no sideways scroll', !m.sx);
    ok(f + ': nothing under 8.5px', !m.small.length, m.small.slice(0, 5).join(' | '));
    if (f === 'orphans-cup.html') ok('every agent, on one scrolling page', m.rows === AGENTS.length, String(m.rows));
    ok(f + ': no script error', !errs.length, errs.join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, f.replace('.html', '') + '-phone.png'), fullPage: true });
    await ctx.close();
  }

  console.log('\nOld script, dead feed, snapshot:');
  for (const f of ['orphans-results.html', 'orphans-cup.html']) {
    mode = 'old';
    const { ctx, page } = await open(b, { width: 1920, height: 1080 });
    await page.goto(BASE + f); await page.waitForTimeout(1500);
    let t = await page.locator(f === 'orphans-cup.html' ? '#players' : '#mCap').innerText();
    ok(f + ': a script older than the stop says what to paste', /Transition\.gs/.test(t) && /New version/.test(t), t);
    mode = 'good'; await page.reload(); await page.waitForTimeout(2500);
    mode = 'dead'; await page.reload(); await page.waitForTimeout(1500);
    t = await page.locator(f === 'orphans-cup.html' ? '#wName' : '#mDue').innerText();
    ok(f + ': a dead feed after a good one paints the last good answer', /Azariah|TT\$1,200/.test(t), t);
    await ctx.close();
  }
  /* an answer from a script with part 1 only: the stops say what is missing, never break */
  {
    mode = 'good';
    const part1 = Object.assign({}, FEED); delete part1.money; delete part1.cup; delete part1.charge; delete part1.results; delete part1.back; delete part1.said;
    const { ctx, page, errs } = await open(b, { width: 1366, height: 768 });
    await page.route('https://script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(part1) }));
    await page.goto(BASE + 'orphans-results.html'); await page.waitForTimeout(1800);
    const a = await page.locator('#mCap').innerText();
    await page.goto(BASE + 'orphans-cup.html'); await page.waitForTimeout(1800);
    const c = await page.locator('#players').innerText();
    ok('an answer without part 2 says so on both stops, with no error', /claims|Salesforce/.test(a) && /cup/i.test(c) && !errs.length, a + ' / ' + c + ' / ' + errs.join(','));
    await ctx.close();
  }

  console.log('\nThe pages themselves:');
  for (const f of ['orphans-results.html', 'orphans-cup.html']) {
    const html = fs.readFileSync(path.join(ROOT, 'intelligence/wall', f), 'utf8');
    const nar = (/var NARRATION = \[([\s\S]*?)\n\];/.exec(html) || [])[1] || '';
    ok(f + ': six narration lines', (nar.match(/\{t:"/g) || []).length === 6);
    ok(f + ': the views beacon', html.indexOf('<!-- rrb-views -->') > 0);
    ok(f + ': asks the campaign script with no code', /action=board&who=wall/.test(html) && !/code=/.test(html));
    ok(f + ': no colleague\'s surname, no client in the page', !/Lalla|Jagassar|Griffith|Dookran|Probhu|Kerwyn|Ramroach/i.test(html));
  }
  const all = fs.readFileSync(path.join(ROOT, 'intelligence/wall/all.html'), 'utf8');
  ok('the wall plays both, after the first orphan stop and before the dues', all.indexOf("file:'orphans-results.html'") > all.indexOf("file:'orphans.html'") &&
    all.indexOf("file:'orphans-cup.html'") > all.indexOf("file:'orphans-results.html'") && all.indexOf("file:'orphans-cup.html'") < all.indexOf("file:'index.html'"));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
