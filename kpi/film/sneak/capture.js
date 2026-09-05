// Plates for the sneak-peek film: what the tracker was, what it is now.
//
// Every "after" screen is the real tracker on this branch, driven by a real
// browser against a stubbed backend. Every "before" screen is the real tracker
// as it stood before the redesign — the file at commit b96c928, served from a
// scratch directory — so the contrast is two versions of the same thing, not
// a drawing of one.
//
// The person signed in is a demo account and every agent and client is a
// placeholder. The film goes out on WhatsApp and the repository is public, so
// no colleague's name and no client's name is baked into a frame.
//
//   BEFORE_DIR=/path/holding/kpi/index.html node kpi/film/sneak/capture.js
//
// Writes shots/*.png at phone size. compose.js turns them into 1080x1920.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT   = path.join(__dirname, '..', '..', '..');
const BEFORE = process.env.BEFORE_DIR || '';
const OUT    = path.join(__dirname, 'shots');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT   = 8802;
const TYPES  = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                 '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.mp4':'video/mp4' };

// /kpi-before/ is the old tracker out of the scratch directory; everything else
// is this branch.
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  let f;
  if (url.startsWith('/kpi-before/')) f = path.join(BEFORE, 'kpi', url.slice('/kpi-before/'.length));
  else f = path.join(ROOT, url);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// ---- the stub -------------------------------------------------------------
// The same shapes tests/e2e-plan.js asserts against, so a frame in the film
// and a line in the test cannot disagree about what the server sends.

const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0',
            unit:'Support', grade:'Sales Support Assistant · G3', role:'ssa',
            tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'demo', manager:false };
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm',
  blocks: { KPI1:{time:'8 – 10am',  focus:'Premium Dues / Surveys',      kpi:'Renewa/PDl/Bill'},
            KPI2:{time:'10 – 12pm', focus:'Ind. Health Billing Recon',   kpi:'Pendings'},
            PM1: {time:'1 – 3pm',   focus:'Adopt an Orphan',             kpi:'Servicing'},
            PM2: {time:'3 – 4pm',   focus:'Task Mgmt / Branch Meeting Reports', kpi:'Reporting'} } } };
const SF = { 'Pendings':'Pendings · pending, lapse and follow-ups',
             'Renewa/PDl/Bill':'Renewals / Premium Dues / Billing',
             'Servicing':'Servicing lines', 'Claims/ Mat':'Claims / Maturities',
             'Scripts/CB':'Scripts / Clawbacks', 'Opportunity':'Opportunity',
             'Lic/Staffing/SA/HR':'Licensing / Staffing / Sales Admin / HR' };
const LIST = Object.keys(SF).map(v => ({ value:v, label:SF[v], salesforce:true }))
  .concat(['New Application Process', 'Reporting', 'Administrative Support', 'Surveys / Query Pal']
    .map(v => ({ value:v, label:v, salesforce:false })));
const KPIS = { ssa:LIST, bma:LIST, bm:LIST, abm:LIST, um:LIST, pa:LIST };

const METRICS = { ok:true, date:'2026-09-07', staff: {
  demo: { closed:6, open:23, overdue:4, aged60:1, noDate:1, needs:7, byType: {
    'Renewa/PDl/Bill':    { open:17, overdue:1, needs:4, closed:4 },
    'Servicing':          { open:3,  overdue:0, needs:1, closed:1 },
    'Pendings':           { open:0,  overdue:0, needs:0, closed:1 },
    'Lic/Staffing/SA/HR': { open:3,  overdue:0, needs:1 } },
    rate: { 'Renewa/PDl/Bill':{ closed:120, days:60 }, 'Lic/Staffing/SA/HR':{ closed:26, days:60 },
            'Servicing':{ closed:3, days:60 } },
    rateAll: { closed:150, days:60, enough:true, perDay:14, perHour:2 } } },
  branch: { byType: { 'Renewa/PDl/Bill': { open:52, overdue:18, needs:9 },
                      'Pendings':        { open:25, overdue:2,  needs:3 },
                      'Servicing':       { open:24, overdue:3,  needs:5 },
                      'Claims/ Mat':     { open:8,  overdue:0,  needs:0 },
                      'Lic/Staffing/SA/HR': { open:17, overdue:9, needs:6 } } } };

const BOOK = { demo: {
  'Renewa/PDl/Bill': [
    { id:'00B1', subject:'T- PENSIONS GROUP - a group client', status:'In Progress',
      due:'2026-09-07', late:false, age:40, agent:'A. Advisor', touched:21, needs:true },
    { id:'00B2', subject:'Confirm funds in DISB & SUSP - one client', status:'In Progress',
      due:'2026-09-07', late:false, age:22, agent:'A. Advisor', touched:2, needs:false },
    { id:'00B3', subject:'Review of smoker rates - another client', status:'In Progress',
      due:'2026-09-08', late:false, age:12, agent:'A. Advisor', touched:1, needs:false },
    { id:'00B4', subject:'Group renewal - a third client', status:'In Progress',
      due:'2026-09-09', late:false, age:5, agent:'C. Advisor', touched:3, needs:false } ],
  'Lic/Staffing/SA/HR': [
    { id:'00B5', subject:'Licence renewal - one agent', status:'Not Started',
      due:'2026-08-30', late:true, age:6, agent:'', touched:9, needs:true } ] } };

const NEEDS = { demo: [
  { id:'00T1', subject:'Premium — one client, policy ending 3177', status:'In Progress',
    type:'Renewa/PDl/Bill', due:'2026-09-03', age:4, agent:'A. Advisor' },
  { id:'00T2', subject:'Stop payment form — one client', status:'Waiting on someone else',
    type:'Renewa/PDl/Bill', due:'2026-08-21', age:17, agent:'A. Advisor' },
  { id:'00T3', subject:'Increment — another client', status:'In Progress',
    type:'Pendings', due:'2026-09-02', age:5, agent:'B. Advisor' },
  { id:'00T4', subject:'An inbound email nobody tagged', status:'In Progress',
    type:'No type', due:'2026-09-01', age:6, agent:'' } ] };

// ---- shot helpers ---------------------------------------------------------

const ensure = () => fs.mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  ensure();
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name);
};

// The thing being talked about, with a little air around it.
const shotOf = async (page, name, sel, pad = 14) => {
  ensure();
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const b = await el.boundingBox();
  if (!b) { console.log('  ' + name + '  (no box — full page)'); return shot(page, name); }
  const vp = page.viewportSize();
  const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad),
                 width:  Math.min(vp.width,  b.width  + pad * 2),
                 height: Math.min(vp.height, b.height + pad * 2) };
  clip.width  = Math.min(clip.width,  vp.width  - clip.x);
  clip.height = Math.min(clip.height, vp.height - clip.y);
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip });
  console.log('  ' + name);
};

// From one element down to another — a heading and the list beneath it.
const shotBetween = async (page, name, selTop, selBot, pad = 24) => {
  ensure();
  const top = page.locator(selTop).first(), bot = page.locator(selBot).first();
  // To the TOP of the viewport, not merely into it. scrollIntoViewIfNeeded
  // scrolls the minimum, which parks a heading on the bottom edge with the
  // list it introduces below the fold — and the clip is bounded to the
  // viewport, so the first cut of the "book" plate was two lines of heading.
  await top.evaluate(e => e.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(350);
  const a = await top.boundingBox(), z = await bot.boundingBox();
  if (!a || !z) return shotOf(page, name, selTop, pad * 3);
  const vp = page.viewportSize();
  const y = Math.max(0, a.y - pad);
  const clip = { x: 0, y, width: vp.width, height: Math.min(vp.height - y, (z.y + z.height + pad) - y) };
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip });
  console.log('  ' + name);
};

// One missing element must not cost the whole run. Say which frame, keep going.
const attempt = async (name, fn) => {
  try { await fn(); } catch (e) { console.log('  ' + name + '  SKIPPED — ' + String(e.message).split('\n')[0]); }
};

// ---- the run ---------------------------------------------------------------

(async () => {
  if (!BEFORE || !fs.existsSync(path.join(BEFORE, 'kpi', 'index.html'))) {
    console.error('BEFORE_DIR must hold kpi/index.html from before the redesign (git show b96c928:kpi/index.html)');
    process.exit(2);
  }
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:3,
                                   isMobile:true, hasTouch:true });
  const page = await ctx.newPage();

  // One route, two moods. `before` answers the way the old tracker was
  // answered on the day it was photographed: Salesforce not reachable, so the
  // numbers had to be typed.
  let mode = 'before';
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action === 'login' || body.action === 'me')
      return j({ ok:true, token:'t', profile:P, roster:[P], schedule:SCH, kpis:KPIS });
    if (body.action === 'rows') {
      if (mode === 'before') return j({ ok:true, rows:[], metrics:{ ok:false, reason:'error' } });
      return j({ ok:true, rows:[], metrics:METRICS, needsReason:NEEDS, openBook:BOOK, billing:{} });
    }
    if (body.action === 'training') return j({ ok:true, training:[] });
    if (body.action === 'saveBlock')
      return j({ ok:true, block:body.block, at:'10:02', blocksDone:1, submitted:[body.block] });
    return j({ ok:true });
  });

  const signIn = async () => {
    const inputs = await page.$$('input');
    await inputs[0].fill('demo@example.com'); await inputs[1].fill('1');
    await page.click('button:has-text("Sign in")');
    await page.waitForTimeout(2200);
  };

  // ---- BEFORE ------------------------------------------------------------
  console.log('Before');
  await page.goto(`http://localhost:${PORT}/kpi-before/`, { waitUntil:'networkidle' });
  await page.waitForTimeout(500);
  await signIn();
  await page.waitForTimeout(600);
  await shot(page, 'before-day');
  await attempt('before-typed', () => shotOf(page, 'before-typed', 'text=/type them for now/', 34));
  await attempt('before-block', async () => {
    await page.locator('text=KPI 1').first().click();
    await page.waitForTimeout(600);
    await shotOf(page, 'before-block', 'text=/KPI worked/', 150);
  });

  // ---- AFTER -------------------------------------------------------------
  // Half past eight on a Monday. Before ten the tracker opens on the plan.
  console.log('After');
  mode = 'after';
  await ctx.clearCookies();
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await page.clock.setFixedTime(new Date('2026-09-07T08:30:00'));
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  await page.waitForTimeout(500);
  await signIn();
  await page.waitForTimeout(900);
  await shot(page, 'plan');

  const renew = 'button:has-text("Renewals / Premium Dues")';
  const lic   = 'button:has-text("Licensing / Staffing")';
  await attempt('needs',    () => shotOf(page, 'needs', renew, 26));
  await attempt('chips',    () => shotOf(page, 'chips', renew, 120));
  await attempt('estimate', () => shotOf(page, 'estimate', 'text=/About 2 hours at your rate/', 30));
  await attempt('book',     () => shotBetween(page, 'book', 'text=/What is in it/i', 'text=/Group renewal - a third client/', 26));
  await attempt('together', () => shotOf(page, 'together', 'text=/3 of them for A\\. Advisor/', 40));
  await attempt('late',     () => shotBetween(page, 'late', 'text=/Late, and no reason on it yet/', 'text=/No agent on the task/', 26));

  // Licensing on its own is half an hour, and the screen has to say so.
  await attempt('small', async () => {
    await page.locator(lic).first().click();
    await page.waitForTimeout(350);
    await page.locator(renew).first().click();
    await page.waitForTimeout(450);
    await shotOf(page, 'small', 'text=/not a two-hour block on its own/', 30);
    await page.locator(renew).first().click();
    await page.waitForTimeout(300);
    await page.locator(lic).first().click();
    await page.waitForTimeout(350);
  });

  await attempt('start', () => shotOf(page, 'start', 'button:has-text("Start the day")', 40));

  // Into the day: the live position, the reason box, and the close-out.
  await attempt('day', async () => {
    await page.click('button:has-text("Start the day")');
    await page.waitForTimeout(1200);
    await shotOf(page, 'live', 'text=/live from Salesforce/', 60);
    await shotBetween(page, 'reason', 'text=/Overdue with no reason given/', 'button:has-text("Save")', 24);
    await page.locator('text=KPI 1').first().click();
    await page.waitForTimeout(700);
    await shotOf(page, 'met', 'text=/objective/i', 44);
  });

  await b.close(); server.close();
  console.log('\nshots/ written\n');
})().catch(e => { console.error(e); process.exit(1); });
