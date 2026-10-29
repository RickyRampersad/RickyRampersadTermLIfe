// Slides 5 and 6 rebuilt, and the new Issued this month stop (28 October 2026), in a real browser with full feeds.
//
// Ricky, 11:45 and 11:46am: the increases, group and health slide "is incorrect", slide 6 "is far down and does this make any
// sense"; 11:56am: "and what about the policies issued this month by agent and unit?". Each screen fed the way the tracker
// feeds it (the increases feed through wallGroupsTidy_ and the scrub, the issued feed through wallIssued_ and the scrub), at
// the branch television, a laptop and a phone. Pinned here:
//   - nothing below the fold and nothing cut through it, on the television and on a laptop;
//   - the lists that outrun the screen are dealt into pages that turn, and every case, code and agent is on one of them;
//   - the records past a year are at the foot, out of the counts; nobody who has left is named; no client anywhere;
//   - Issued: agents in name order, each against their own usual, green past it and never red; units named for a manager
//     only while the manager is here.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { makeEnv } = require('./harness');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || undefined;
const PORT = 8866;
const SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  — ' + x : '')); if (!c) fails++; };
const env = makeEnv();
env.todayISO_ = () => '2026-10-28';

/* ── The feeds ─────────────────────────────────────────────────────────── */
// Increases, group and health: the shape Salesforce gave at 11:49 on 28 October, names invented, run through the tracker.
const agents = ['Ravi Persad', 'Nadia Khan', 'Omar Ali', 'Kavita Singh', 'Ricky Rampersad', 'Fawwaz Mohamed', 'Aidan Eugene', 'Gary Sookdeo'];
const gRaw = {
  asOf: '2026-10-28 11:49', held: 0, notes: [],
  types: [{ key: 'HEALTH', label: 'Individual health', policies: 1278, pending: 15, paying: 280, closed: 182, none: 801, oldest: 2066, states: { reqts: 4, uw: 11 } },
          { key: 'HEALTH (GROUP)', label: 'Group health', policies: 524, pending: 2, paying: 123, closed: 3, none: 396, oldest: 21, states: { uw: 2 } },
          { key: 'LIFE(GROUP)', label: 'Group life', policies: 222, pending: 2, paying: 185, closed: 2, none: 33, oldest: 21, states: { uw: 2 } }],
  totals: { policies: 2024, pending: 19, paying: 588, closed: 187, none: 1230 },
  rows: [[2066, 'HEALTH', 'Ravi Persad', 'reqts'], [2056, 'HEALTH', 'Aidan Eugene', 'reqts'], [55, 'HEALTH', 'Fawwaz Mohamed', 'uw'], [54, 'HEALTH', 'Ricky Rampersad', 'uw'],
         [48, 'HEALTH', 'Nadia Khan', 'uw'], [21, 'LIFE(GROUP)', 'Ricky Rampersad', 'uw'], [21, 'HEALTH (GROUP)', 'Ricky Rampersad', 'uw'], [16, 'HEALTH', 'Omar Ali', 'uw'],
         [16, 'HEALTH', 'Kavita Singh', 'uw'], [14, 'HEALTH', 'Ravi Persad', 'uw'], [13, 'LIFE(GROUP)', 'Ricky Rampersad', 'uw'], [13, 'HEALTH (GROUP)', 'Ricky Rampersad', 'uw'],
         [12, 'HEALTH', 'Ricky Rampersad', 'reqts'], [9, 'HEALTH', 'Omar Ali', 'uw'], [5, 'HEALTH', 'Nadia Khan', 'uw'], [3, 'HEALTH', 'Kavita Singh', 'uw'], [2, 'HEALTH', 'Fawwaz Mohamed', 'uw']]
    .map(([days, type, who, state]) => ({ type, label: { HEALTH: 'Individual health', 'HEALTH (GROUP)': 'Group health', 'LIFE(GROUP)': 'Group life' }[type], who, state, days,
                                          status: state === 'reqts' ? 'Underwriting incomplete, Missing Reqts' : type === 'HEALTH' ? 'Underwriting incomplete' : 'Pending' })),
  increases: { book: { rows: 1126, paying: 1069, payingApi: 1916612.25, npw: 17, blank: 38 }, year: { n: 62, api: 414363.23 },
    pending: { n: 11, api: 4522.52, prem: 0, oldest: 728, noDocs: 11, reqts: 0 },
    rows: [[728, 'Gary Sookdeo', 'Jenny', 'settle', 4473], [684, 'Omar Ali', 'Azariah', 'reqts', 0], [212, 'Omar Ali', 'Azariah', 'reqts', 0], [96, 'Aidan Eugene', 'Azariah', 'uw', 0],
           [61, 'Nadia Khan', 'Elizabeth', 'uw', 18], [40, 'Gary Sookdeo', 'Azariah', 'uw', 12], [33, 'Kavita Singh', 'Elizabeth', 'uw', 9.6], [21, 'Ravi Persad', 'Azariah', 'uw', 6],
           [9, 'Ricky Rampersad', 'Elizabeth', 'uw', 3.9], [4, 'Fawwaz Mohamed', 'Azariah', 'uw', 0], [1, 'Nadia Khan', 'Elizabeth', 'uw', 0]]
      .map(([days, who, support, state, api]) => ({ who, support, state, days, api, prem: 0, reqt: '', docs: false, years: 3,
                                                   status: { settle: 'Underwriting complete, Missing Settlement Reqts', reqts: 'Underwriting incomplete, Missing Reqts', uw: 'Pending' }[state] })) } };
const GROUPS = { ok: true, data: env.wallScrub_(env.wallGroupsTidy_(JSON.parse(JSON.stringify(gRaw)), '2026-10-28 11:49')) };

// Code by code: forty-four requirements, as many as the report of 27 October carried, with the report's own who-acts-next words.
const WHO = ['Agent', 'Client (attend exam)', 'Client / Agent', 'Client / Doctor', 'Doctor / Third Party', 'Client (sign acceptance)', 'Underwriter / Reinsurer'];
const REQS = ['Future Premium Payment', 'Declaration Form - Life', 'Fact Find Form', 'Individual FATCA and CRS Form', 'Proof of Identity', 'Proof of Address', 'Full Doctors Examination',
  'PCAF - Life Evolution Series', 'Oral Fluids Test', 'OFT Authorization Form', 'Other Correspondence', 'Full Blood Profile', 'Attending Physician Statement', 'Resting ECG',
  'Urinalysis', 'Beneficiary Nomination', 'Source of Funds Declaration', 'Bank Mandate', 'Signed Amendment', 'Acceptance of Rating'];
const codes = Array.from({ length: 44 }, (_, i) => { const n = Math.max(1, 36 - i);
  return { k: REQS[i % REQS.length] + (i >= REQS.length ? ' (' + (Math.floor(i / REQS.length) + 1) + ')' : ''), code: 'RQ' + String(100 + i), n, red: i % 3 ? Math.floor(n / 4) : 0, amber: 1, nw: i % 4 ? 0 : 2,
           kind: i === 0 ? 'First premium' : i % 5 === 3 ? 'Medical' : 'Documents', policies: Math.max(1, n - 3), who: WHO[i % WHO.length],
           agents: [{ k: agents[i % 6], n: Math.ceil(n / 2) }, { k: i % 4 ? agents[(i + 1) % 6] : env.WALL_ORPHANS, n: Math.ceil(n / 4) }, { k: agents[(i + 2) % 6], n: 1 }] }; });
const PENDING = { ok: true, data: { live: { asOf: 'Wednesday 28 October, 8:12am', policies: 75, reqs: 406, agents: 24, newWeek: 19, rag: { Red: 61, Amber: 88, Green: 257 },
  who: WHO.map((k, i) => ({ k, n: [227, 74, 73, 15, 14, 2, 1][i], p: [52, 21, 19, 6, 5, 2, 1][i] })), codes, codeCount: 44, byReq: [] } } };

// Issued this month: a production report with twenty agents, run through wallIssued_ and the scrub.
const H = ['POLICY_ID', 'ISSUE_DATE', 'SETTLED_MONTH', 'SETTLED_LAST_7_DAYS', 'MONTHLY_PREMIUM', 'ANNUAL_PREMIUM', 'BILLING_MODE', 'WRITING_AGENT_ID', 'WRITING_AGENT_NAME', 'BRANCH_ID', 'FIRST_NAME', 'LAST_NAME'];
const PEOPLE = [['Akaash Kalladeen', '26002', 8, 1.2], ['Aleema Persad', '26000', 2, 6], ['Daniel Ross', '26002', 1, 1.5], ['Darryl Ward', '26002', 0, 1.5], ['Fawwaz Mohamed', '26002', 1, 2.5],
  ['Felicia Rampersad', '26003', 2, 3], ['Joy Sammah', '26000', 0, 1.3], ['Malcolm Seeram', '26002', 2, 0.3], ['Narissa Baptiste', '26000', 0, 1.5], ['Neil Ramnanan', '26000', 2, 2.3],
  ['Premchand Dookie', '26000', 2, 1.2], ['Rajiv Soodoo', '26002', 3, 0.3], ['Randolph Gonzales', '26000', 0, 1], ['Ricky Rampersad', '26000', 0, 1.5], ['Stephanie Rajkumar', '26002', 0, 0.7],
  ['Varun Seegolam', '26000', 2, 5.3], ['Neil Bhagwan', '26002', 1, 0.8], ['', '26000', 2, 0.7], ['Gary Sookdeo', '26003', 1, 5.8], ['Aidan Eugene', '26001', 0, 7]];
let pid = 1000000000; const prow = (iss, name, unit, i) => [String(pid++), iss, iss.slice(0, 7), iss >= '2026-10-21' ? 'Yes' : 'No', 300 + (i % 7) * 120, 0, '01', name ? 'A' + i : 'A08413', name, unit, 'Client', 'Name'];
const sheet = [H];
PEOPLE.forEach(([name, unit, n, usual], i) => {
  for (let k = 0; k < n; k++) sheet.push(prow('2026-10-' + String(2 + ((k * 5 + i) % 25)).padStart(2, '0'), name, unit, i));
  for (let k = 0; k < Math.round(usual * 6); k++) sheet.push(prow('2026-' + String(4 + (k % 6)).padStart(2, '0') + '-' + String(3 + ((k * 3 + i) % 24)).padStart(2, '0'), name, unit, i));
});
env.iSs_ = () => ({ getSheets: () => [{ getName: () => 'Branch Production_2026-10-27-1358', getDataRange: () => ({ getValues: () => sheet }) }] });
const ISSUED = { ok: true, data: env.wallScrub_(env.wallIssued_('2026-10-28')) };

const FEEDS = { 'intel.groups': GROUPS, 'intel.pending': PENDING, 'wall.issued': ISSUED };
const MEASURE = `(() => {
  const leaves = [...document.querySelectorAll('body *')].filter(el => {
    if (el.children.length) return false;
    const t = (el.textContent || '').trim(); if (t.length < 2) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    if (el.closest('.page.out') || el.closest('.ticker')) return false;
    return true;
  });
  const words = el => (el.textContent || '').trim().slice(0, 40);
  return { overflow: document.documentElement.scrollHeight - innerHeight, sideways: document.documentElement.scrollWidth - innerWidth,
           below: leaves.filter(el => el.getBoundingClientRect().top >= innerHeight).map(words),
           through: leaves.filter(el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > innerHeight + 2; }).map(words),
           small: [...new Set(leaves.filter(el => parseFloat(getComputedStyle(el).fontSize) < 9).map(words))].slice(0, 4) };
})()`;
async function open(b, file, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route(u => u.hostname !== 'localhost', r => {
    const url = new URL(r.request().url());
    if (/script\.google\.com$/.test(url.hostname)) { let a = ''; try { a = JSON.parse(r.request().postData() || '{}').action; } catch (e) {}
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEEDS[a] || { ok: false }) }); }
    return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  await page.goto(`http://localhost:${PORT}/intelligence/wall/${file}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  return { ctx, page, errors };
}
const allText = page => page.evaluate(() => [...document.querySelectorAll('.page')].map(p => p.textContent).join(' ') + ' ' + document.body.innerText);

(async () => {
  server.listen(PORT);
  const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  for (const [w, h, tag] of [[1920, 1080, 'television'], [1366, 768, 'laptop']]) {
    console.log('\nAt the ' + tag + ' (' + w + ' x ' + h + '):\n');
    // Slide 5
    let s = await open(b, 'increases.html', w, h);
    let m = await s.page.evaluate(MEASURE);
    ok('increases: nothing below the fold, nothing cut through it', m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length, JSON.stringify(m));
    let t = await s.page.evaluate(() => ({ n: document.getElementById('iN').textContent, pages: document.querySelectorAll('#rows .page').length, rows: document.querySelectorAll('#rows .cr').length,
      old: document.getElementById('oN').textContent, foot: document.getElementById('oT').textContent, kinds: document.querySelectorAll('#kinds .kind').length, sub: document.getElementById('sub').textContent }));
    ok('increases: nine pending once the two past a year are counted apart', t.n === '9', t.n);
    ok('increases: every case on a page (nine increases, fifteen group and health), the pages turning', t.rows === 24 && (h > 900 || t.pages > 1), JSON.stringify(t));
    ok('increases: four records past a year at the foot, to close in Salesforce', t.old === '4' && /Close them in Salesforce/.test(t.foot) && /2,066/.test(t.foot), t.foot);
    ok('increases: one card for each kind, and when Salesforce was read', t.kinds === 3 && /11:49am/.test(t.sub), t.sub);
    let txt = await allText(s.page);
    ok('increases: nobody who has left is named, and they read Orphans on their own rows', !/Gary|Aidan/.test(txt) && (txt.match(/Orphans/g) || []).length >= 2);
    ok('increases: no page errors', !s.errors.length, s.errors.join(' | '));
    if (SHOTS) await s.page.screenshot({ path: path.join(SHOTS, 'slide5-' + tag + '.png') });
    await s.ctx.close();
    // Slide 6
    s = await open(b, 'codes.html', w, h);
    m = await s.page.evaluate(MEASURE);
    ok('codes: nothing below the fold, nothing cut through it', m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length, JSON.stringify(m));
    t = await s.page.evaluate(() => ({ rows: document.querySelectorAll('#rows .cr').length, pages: document.querySelectorAll('#rows .page').length, who: document.querySelectorAll('#who .wr').length,
      hint: (document.querySelector('#who .wr em') || {}).textContent, ags: document.querySelectorAll('#rows .cr .ag').length, onPage: document.querySelectorAll('#rows .page:not(.out) .cr').length }));
    ok('codes: all forty-four codes on the wall, dealt into pages', t.rows === 44 && t.pages >= 2 && t.onPage * t.pages >= 44, JSON.stringify(t));
    ok('codes: whose move it is, seven ways, each saying what moves it', t.who === 7 && /first call/.test(t.hint || ''), JSON.stringify(t));
    ok('codes: the agents holding each code under its name', t.ags === 44 * 3);
    if (SHOTS) await s.page.screenshot({ path: path.join(SHOTS, 'slide6-' + tag + '.png') });
    const firstPage = await s.page.evaluate(() => document.querySelector('#rows .page:not(.out) .cr .nm b').textContent);
    await s.page.waitForTimeout(8400);
    const turned = await s.page.evaluate(() => document.querySelector('#rows .page:not(.out) .cr .nm b').textContent);
    ok('codes: the page turns on its own', firstPage !== turned, firstPage + ' / ' + turned);
    ok('codes: no page errors', !s.errors.length, s.errors.join(' | '));
    await s.ctx.close();
    // Issued
    s = await open(b, 'issued.html', w, h);
    m = await s.page.evaluate(MEASURE);
    ok('issued: nothing below the fold, nothing cut through it', m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length, JSON.stringify(m));
    t = await s.page.evaluate(() => ({ n: document.getElementById('hN').textContent, tiles: [...document.querySelectorAll('#agents .ag')].map(a => a.querySelector('.nm b').textContent),
      past: [...document.querySelectorAll('#agents .ag.past .nm b')].map(e => e.textContent), units: [...document.querySelectorAll('#units h3')].map(e => e.textContent),
      title: document.getElementById('title').textContent, red: [...document.querySelectorAll('*')].some(e => /232, 98, 90/.test(getComputedStyle(e).color) && e.textContent.trim()) }));
    ok('issued: the month\'s policies, and the title says which month', t.n === String(ISSUED.data.policies) && /October/.test(t.title), JSON.stringify([t.n, ISSUED.data.policies, t.title]));
    const order = t.tiles.filter(x => x !== 'Orphans');
    ok('issued: every agent on the wall, in name order, by first name', t.tiles.length === ISSUED.data.agents.length && order.join() === [...order].sort((a, c) => a.toLowerCase() < c.toLowerCase() ? -1 : 1).join(), JSON.stringify(t.tiles));
    ok('issued: a first name two agents share carries an initial', t.tiles.includes('Neil R.') && t.tiles.includes('Neil B.'), JSON.stringify(t.tiles));
    ok('issued: green for the agents past their own usual month, and nothing red', t.past.includes('Akaash') && t.past.includes('Rajiv') && !t.past.includes('Varun') && !t.red, JSON.stringify(t.past));
    ok('issued: the branch and Akaash\'s unit by name, a former unit by number, a unit with nobody left gone', t.units.join('|') === 'The branch|Akaash Kalladeen’s unit|Unit 26003', t.units.join('|'));
    txt = await allText(s.page);
    ok('issued: nobody who has left is named, no client', !/Gary|Aidan|Client|Kerwyn/.test(txt));
    ok('issued: no page errors', !s.errors.length, s.errors.join(' | '));
    if (SHOTS) await s.page.screenshot({ path: path.join(SHOTS, 'issued-' + tag + '.png') });
    await s.ctx.close();
  }
  console.log('\nOn a phone:\n');
  for (const f of ['increases.html', 'codes.html', 'issued.html']) {
    const s = await open(b, f, 390, 844);
    const m = await s.page.evaluate(MEASURE);
    ok(f.padEnd(16) + ' no sideways scroll, nothing under nine pixels', m.sideways <= 2 && !m.small.length, JSON.stringify({ sideways: m.sideways, small: m.small }));
    ok(f.padEnd(16) + ' no page errors', !s.errors.length, s.errors.join(' | '));
    if (SHOTS) await s.page.screenshot({ path: path.join(SHOTS, f.replace('.html', '') + '-phone.png'), fullPage: true });
    await s.ctx.close();
  }
  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
