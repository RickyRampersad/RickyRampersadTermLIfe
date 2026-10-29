// The Branch Manager's drive on the Branch Intelligence wall (28 October 2026): "Driving the campaign" (orphans-driver.html),
// in a real browser, fed the way the campaign script feeds it (GET action=board&who=wall), at the branch television, two
// laptops and a phone.
// Pinned here:
//   - nothing below the fold and nothing cut through on the television and the laptops; no sideways scroll anywhere;
//   - his prompts since 25 September, by kind, with this week and today; what his automation sent, by who it went to;
//   - the ring: every prompt answered the same day, the next working day, later or not yet, and the share of the team's
//     notes after a prompt; the ten working days, his prompts beside the team's notes; each member of the team;
//   - Javid and Aleema nowhere on the page;
//   - a script older than the drive says what to paste; a dead feed after a good one paints the last good answer;
//   - the shield, the narration (six lines), the views beacon, and the stop on the wall after the cup.
// Run: node tests/e2e-orphan-driver.js   (SHOTS=<dir> to keep screenshots)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || undefined;
const PORT = 8873;
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

const DAYS = ['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28'];
const LBL = ['Thu 15', 'Fri 16', 'Mon 19', 'Tue 20', 'Wed 21', 'Thu 22', 'Fri 23', 'Mon 26', 'Tue 27', 'Wed 28'];
const team = (name, notes, after, closes, waiting, read) => ({ name, notes, after, own: notes - after, answered: after + 4, same: Math.round(after * 0.6), waiting, closes,
  themes: { r: 20, t: 30, p: 8, q: 5, m: 4, d: 6, n: 9, v: 7 }, read, week: { notes: 20, after: 16 } });
const FEED = {
  ok: true, wall: 1, at: '28 Oct, 3:10 PM', today: '2026-10-28', sf: { on: true },
  agents: { clients: 72, week: 41, today: 30, people: [{ name: 'Neil R.', clients: 12, week: 2, today: 0, feedback: 0 }] },
  charge: { agents: [], namers: [{ name: 'Branch Manager', n: 7 }, { name: 'In Salesforce', n: 17 }], support: [] },
  drive: {
    mail: { total: 4321, kinds: [
      { key: 'letters', label: 'Letters to clients', n: 1477, to: 'clients' }, { key: 'reminders', label: 'Reminders to clients', n: 1199, to: 'clients' },
      { key: 'again', label: 'Letters sent again', n: 38, to: 'clients' }, { key: 'receipts', label: 'Thank-you receipts', n: 278, to: 'clients' },
      { key: 'still', label: '"Still on it" notes', n: 87, to: 'clients' }, { key: 'notes', label: 'Notes in his name', n: 41, to: 'clients' },
      { key: 'intros', label: 'Introductions to their agent', n: 9, to: 'clients' }, { key: 'briefs', label: 'Briefs to agents', n: 72, to: 'agents' },
      { key: 'clock', label: 'Reminders on clients waiting', n: 14, to: 'agents' }, { key: 'late', label: 'Late alerts to the branch', n: 653, to: 'branch' },
      { key: 'chasing', label: 'Alerts when a client chases', n: 6, to: 'branch' }, { key: 'replies', label: 'Client replies read and filed', n: 447, to: 'branch' }] },
    since: '2026-09-25', periods: { week: '2026-10-28' },
    posts: { all: { own: 214, chase: 160, list: 612, intel: 88, follow: 41, move: 63, hold: 105, name: 72, auto: 30 },
      week: { own: 12, chase: 10, list: 45, intel: 6, follow: 3, move: 0, name: 2, auto: 1 }, today: { own: 12, chase: 10, list: 45, intel: 6, follow: 3, move: 0, name: 2, auto: 1 },
      hand: { all: 214, week: 12, today: 12 }, auto: { all: 964, week: 64, today: 64 }, tasks: 388 },
    answer: { prompts: 1178, answered: 846, same: 512, next: 201, later: 133, open: 332, hand: { prompts: 214, answered: 170, same: 120 } },
    notes: 1310, after: 1052,
    team: [team('Liz', 420, 330, 61, 120, { drive: 60, record: 250, park: 40, status: 70 }), team('Sasha', 470, 400, 80, 90, { drive: 110, record: 280, park: 30, status: 50 }),
      team('Azariah', 360, 290, 52, 102, { drive: 50, record: 210, park: 60, status: 40 }), team('Kamla', 60, 32, 4, 20, { drive: 10, record: 30, park: 5, status: 15 })],
    days: DAYS.map((d, i) => ({ d, label: LBL[i], hand: 5 + (i % 4) * 3, auto: 40 + (i % 3) * 12, notes: 30 + (i % 5) * 9, after: 24 + (i % 5) * 7 })),
    named: { board: 7, salesforce: 17 } } };

let mode = 'good', feed = FEED;
async function open(b, vp) {
  const ctx = await b.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://script.google.com/**', r => {
    const u = r.request().url();
    if (mode === 'good' && /action=board/.test(u) && /who=wall/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feed) });
    if (mode === 'old') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, refused: true, error: 'That name or number was not found.' }) });
    return r.abort();
  });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  return { ctx, page, errs };
}
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const fit = page => page.evaluate(() => {
  const H = innerHeight, W = innerWidth, out = [], cut = [];
  document.querySelectorAll('.card, .kr, .mr, .tp, .col, .lg, .ticker, header, .named, .share, .keys, .tkeys').forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.right > W + 1) out.push(el.className + ' ' + Math.round(r.bottom) + '/' + H); });
  /* nothing spills out of its card */
  document.querySelectorAll('.card').forEach(c => { const cr = c.getBoundingClientRect(); c.querySelectorAll('.kr, .mr, .tp, .lg, .named, .share, .keys, .tkeys, .col').forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > cr.bottom + 1) out.push('spills: ' + el.className + ' ' + el.textContent.trim().slice(0, 30)); }); });
  document.querySelectorAll('.kr .l, .mr .l, .tp .nm, .tp .nm small, .lg span, .bm b, .bm small, .named').forEach(el => { if (el.scrollWidth > el.clientWidth + 2) cut.push(el.className + ': ' + el.textContent.trim().slice(0, 40)); });
  return { out, cut, sx: document.documentElement.scrollWidth > W + 1, mark: document.querySelectorAll('header .mark img[src$="logo-mark.png"]').length };
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const BASE = 'http://127.0.0.1:' + PORT + '/intelligence/wall/';

  for (const [label, vp] of [['the branch television, 1920x1080', { width: 1920, height: 1080 }], ['a laptop, 1366x768', { width: 1366, height: 768 }], ['a small laptop, 1280x720', { width: 1280, height: 720 }]]) {
    console.log('\nDriving the campaign, ' + label + ':');
    mode = 'good'; feed = FEED;
    const { ctx, page, errs } = await open(b, vp);
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(3500);
    const f = await fit(page);
    ok('nothing below the fold, past the right edge or out of its card', !f.out.length, f.out.join(' | '));
    ok('nothing cut through', !f.cut.length, f.cut.join(' | '));
    ok('no sideways scroll', !f.sx);
    ok('the gold shield', f.mark === 1);
    const m = await page.evaluate(() => ({
      all: document.querySelector('#pAll').textContent, mini: document.querySelector('#pMini').textContent,
      kinds: [...document.querySelectorAll('.kr')].map(r => r.querySelector('.l').textContent + '=' + r.querySelector('span').textContent),
      named: document.querySelector('#named').textContent, mtot: document.querySelector('#mTot').textContent,
      grp: [...document.querySelectorAll('.grp h4')].map(x => x.textContent), mr: document.querySelectorAll('.mr').length,
      pct: document.querySelector('#aPct').textContent, segs: [...document.querySelectorAll('#segs .seg')].map(s => s.style.strokeDasharray),
      leg: document.querySelector('#leg').textContent, sh: document.querySelector('#shK').textContent, shP: document.querySelector('#shP').textContent,
      cols: document.querySelectorAll('.col').length, today: (document.querySelector('.col.today .d') || {}).textContent,
      barH: [...document.querySelectorAll('.col .bar')].map(x => x.style.height),
      team: [...document.querySelectorAll('.tp .nm')].map(x => x.firstChild.textContent), waiting: [...document.querySelectorAll('.tp .w b')].map(x => x.textContent),
      tk: document.querySelector('#tk').textContent, body: document.body.innerText }));
    ok('his prompts since 25 September: by hand and by automation', m.all === '1,178', m.all);
    ok('this week, today, and the tasks he touched', /This week 76/.test(m.mini) && /Today 76/.test(m.mini) && /388/.test(m.mini), m.mini);
    ok('six kinds of prompt, each with its count', m.kinds.length === 6 && m.kinds[0] === 'In his own words=214' && m.kinds.some(k => /daily list/.test(k) && /612/.test(k)), m.kinds.join(' | '));
    ok('the clients he named, and the hold notices', /7/.test(m.named) && /17/.test(m.named) && /105 hold notices/.test(m.named), m.named);
    ok('what his automation sent: the total, grouped by who it went to', m.mtot === '4,321' && m.grp.join(',') === 'To clients,To agents,To the branch and staff' && m.mr === 12, m.mtot + ' ' + m.grp.join(','));
    ok('the ring: 72% answered, four segments drawn', m.pct === '72%' && m.segs.length === 4 && m.segs.every(s => /^\d/.test(s)), m.pct + ' ' + m.segs.join(','));
    ok('the legend: the same day, the next working day, later, not yet', /The same day512/.test(m.leg) && /Later133/.test(m.leg) && /Not yet332/.test(m.leg), m.leg);
    ok('80% of the team\'s notes came after one of his prompts', m.sh === '80%' && /1,310/.test(m.shP) && /258/.test(m.shP), m.sh + ' ' + m.shP);
    ok('ten working days, today last, every bar drawn', m.cols === 10 && m.today === 'Wed 28' && m.barH.length === 20 && m.barH.every(h => /%$/.test(h)), m.cols + ' ' + m.today);
    ok('the team, most notes first, with the prompts waiting on their tasks', m.team.join(',') === 'Sasha,Liz,Azariah,Kamla' && m.waiting.join(',') === '90,120,102,20', m.team.join(',') + ' ' + m.waiting.join(','));
    ok('the ticker carries his drive', /1,178/.test(m.tk) && /80%/.test(m.tk), m.tk.slice(0, 200));
    ok('no Javid, no Aleema', !/Javid|Aleema/.test(m.body));
    ok('no script error', !errs.length, errs.join(' | '));
    await shot(page, 'driver-' + vp.width + 'x' + vp.height);
    await ctx.close();
  }

  console.log('\na phone, 390x844:');
  {
    mode = 'good'; feed = FEED;
    const { ctx, page, errs } = await open(b, { width: 390, height: 844 });
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(3000);
    const m = await page.evaluate(() => {
      const small = [...document.querySelectorAll('body *')].filter(el => el.children.length === 0 && el.textContent.trim() && el.getClientRects().length
        && parseFloat(getComputedStyle(el).fontSize) < 8.5).map(el => el.textContent.trim().slice(0, 30));
      return { sx: document.documentElement.scrollWidth > innerWidth + 1, small, team: document.querySelectorAll('.tp').length, cols: document.querySelectorAll('.col').length };
    });
    ok('no sideways scroll', !m.sx);
    ok('nothing under 8.5px', !m.small.length, m.small.slice(0, 5).join(' | '));
    ok('the whole team and the ten days', m.team === 4 && m.cols === 10);
    ok('no script error', !errs.length, errs.join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'driver-phone.png'), fullPage: true });
    await ctx.close();
  }

  console.log('\nOld script, dead feed, no Salesforce:');
  {
    mode = 'old'; feed = FEED;
    const { ctx, page } = await open(b, { width: 1920, height: 1080 });
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(1500);
    let t = await page.locator('#kinds').innerText();
    ok('a script older than the stop says what to paste', /Transition\.gs/.test(t) && /New version/.test(t), t);
    mode = 'good'; await page.reload(); await page.waitForTimeout(2500);
    mode = 'dead'; await page.reload(); await page.waitForTimeout(1500);
    t = await page.locator('#pAll').innerText();
    ok('a dead feed after a good one paints the last good answer', t === '1,178', t);
    await ctx.close();
  }
  {
    mode = 'good';
    feed = Object.assign({}, FEED); delete feed.drive;
    const { ctx, page, errs } = await open(b, { width: 1366, height: 768 });
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(1800);
    const t = await page.locator('#kinds').innerText();
    ok('an answer from a script without the drive says what to paste, with no error', /Transition\.gs/.test(t) && !errs.length, t + ' / ' + errs.join(','));
    await ctx.close();
  }
  {
    mode = 'good';
    feed = JSON.parse(JSON.stringify(FEED)); feed.drive = { mail: FEED.drive.mail, error: 'Salesforce did not answer: timeout' };
    const { ctx, page, errs } = await open(b, { width: 1366, height: 768 });
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(1800);
    const t = await page.locator('#kinds').innerText(), mt = await page.locator('#mTot').innerText();
    ok('without Salesforce: what his automation sent still shows, and why the rest waits', /Salesforce did not answer/.test(t) && mt === '4,321' && !errs.length, t + ' / ' + mt);
    await ctx.close();
  }

  console.log('\nThe page itself:');
  const html = fs.readFileSync(path.join(ROOT, 'intelligence/wall/orphans-driver.html'), 'utf8');
  const nar = (/var NARRATION = \[([\s\S]*?)\n\];/.exec(html) || [])[1] || '';
  ok('six narration lines', (nar.match(/\{t:"/g) || []).length === 6);
  ok('the views beacon', html.indexOf('<!-- rrb-views -->') > 0);
  ok('asks the campaign script with no code', /action=board&who=wall/.test(html) && !/code=/.test(html));
  ok('no colleague\'s surname, no client, no Javid in the page', !/Lalla|Jagassar|Griffith|Dookran|Probhu|Kerwyn|Ramroach|Javid|Aleema/i.test(html));
  const all = fs.readFileSync(path.join(ROOT, 'intelligence/wall/all.html'), 'utf8');
  ok('the wall plays it after the cup and before the dues', all.indexOf("file:'orphans-driver.html'") > all.indexOf("file:'orphans-cup.html'") && all.indexOf("file:'orphans-driver.html'") < all.indexOf("file:'index.html'"));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
