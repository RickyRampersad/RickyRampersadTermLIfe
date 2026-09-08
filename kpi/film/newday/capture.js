// Plates for "The new day": every screen is the real tracker on this branch,
// driven by a real browser against a stubbed backend. The person signed in is
// a demo account and every agent and client is a placeholder — the film goes
// out on WhatsApp and the repository is public, so no colleague's name and no
// client's name is baked into a frame.
//
//   node kpi/film/newday/capture.js
//
// Writes shots/*.png at phone size. compose.js turns them into 1080x1920.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT   = path.join(__dirname, '..', '..', '..');
const OUT    = path.join(__dirname, 'shots');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT   = 8806;
const TYPES  = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg' };

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// ---- the stub: the same shapes the browser tests assert against -----------
const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0', unit:'Support',
            grade:'Sales Support Assistant · G3', role:'ssa', tier:'support', tierLabel:'Sales Support', tierOrder:4,
            reportsTo:'boss', manager:false, leads:[] };
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm',
  blocks: { KPI1:{time:'8 – 10am',  focus:'Premium Dues / Surveys',      kpi:'Renewa/PDl/Bill'},
            KPI2:{time:'10 – 12pm', focus:'Ind. Health Billing Recon',   kpi:'Pendings'},
            PM1: {time:'1 – 3pm',   focus:'Adopt an Orphan',             kpi:'Servicing'},
            PM2: {time:'3 – 4pm',   focus:'Task Mgmt / Branch Meeting Reports', kpi:'Reporting'} } } };
const SF = { 'Pendings':'Pendings · pending, lapse and follow-ups', 'Renewa/PDl/Bill':'Renewals / Premium Dues / Billing',
             'Servicing':'Servicing lines', 'Claims/ Mat':'Claims / Maturities', 'Scripts/CB':'Scripts / Clawbacks',
             'Opportunity':'Opportunity', 'Lic/Staffing/SA/HR':'Licensing / Staffing / Sales Admin / HR' };
const LIST = Object.keys(SF).map(v => ({ value:v, label:SF[v], salesforce:true }))
  .concat(['New Application Process', 'Reporting', 'Administrative Support', 'Surveys / Query Pal'].map(v => ({ value:v, label:v, salesforce:false })));
const KPIS = { ssa:LIST, bma:LIST, bm:LIST, abm:LIST, um:LIST, pa:LIST };
const METRICS = { ok:true, date:'2026-09-07', staff: { demo: { closed:6, open:23, overdue:4, aged60:1, noDate:1, needs:7, byType: {
    'Renewa/PDl/Bill': { open:17, overdue:1, needs:4, closed:4 }, 'Servicing': { open:3, overdue:0, needs:1, closed:1 },
    'Pendings': { open:0, overdue:0, needs:0, closed:1 }, 'Lic/Staffing/SA/HR': { open:3, overdue:0, needs:1 } },
    rateAll: { closed:150, days:60, enough:true, perDay:14, perHour:2 } } },
  branch: { byType: { 'Renewa/PDl/Bill': { open:52, overdue:18, needs:9 }, 'Pendings': { open:25, overdue:2, needs:3 },
                      'Servicing': { open:24, overdue:3, needs:5 }, 'Lic/Staffing/SA/HR': { open:17, overdue:9, needs:6 } } } };
const BOOK = { demo: { 'Renewa/PDl/Bill': [
    { id:'00B1', subject:'Group renewal - the branch account', status:'In Progress', due:'2026-09-07', late:false, age:40, agent:'The Branch Manager', rank:0, 'for':'Branch Manager', touched:21, needs:true },
    { id:'00B2', subject:'Premium dues - a unit client', status:'In Progress', due:'2026-09-07', late:false, age:22, agent:'A Unit Manager', rank:2, 'for':'Unit Manager', touched:9, needs:true },
    { id:'00B3', subject:'Review of smoker rates - one client', status:'In Progress', due:'2026-09-08', late:false, age:12, agent:'An Executive Agent', rank:3, 'for':'Executive Agent', touched:8, needs:true },
    { id:'00B4', subject:'Confirm funds in DISB & SUSP - one client', status:'In Progress', due:'2026-09-09', late:false, age:5, agent:'A. Advisor', rank:4, 'for':'', touched:3, needs:false } ] } };
const NEEDS = { demo: [ { id:'00T2', subject:'Stop payment form — one client', status:'Waiting on someone else', type:'Renewa/PDl/Bill', due:'2026-08-21', age:17, agent:'A. Advisor', rank:4, 'for':'' } ] };
const ev = (blocks, met, partly, no, closed) => ({ blocks, planned: blocks * 90, met: { met, partly, no }, lines: [], closed, open: 4, needs: 1, late: 0 });
const STANDING = { ok:true, staffId:'demo', role:'ssa', quarter:'2026-Q3', from:'2026-07-01', to:'2026-09-08', today:'2026-09-07', daysIn:49, daysLeft:17,
  goals:[{ goal:'Premium Dues / Lapse Management', weight:15, target:0.95, kpiTypes:['Renewa/PDl/Bill'], evidence: ev(27, 24, 2, 1, 401), landed: 0.89 },
         { goal:'New Applications & Increase Applications Processing', weight:15, target:0.9, kpiTypes:['New Application Process'], evidence: ev(18, 17, 1, 0, 96), landed: 0.94 },
         { goal:'Reporting', weight:10, target:0.95, kpiTypes:['Reporting'], evidence: ev(12, 12, 0, 0, 30), landed: 1 }],
  competencies:[{ competency:'Reliability', definition:'', behaviours:[], signals:[{ label:'Days in', value:47, tone:'' }, { label:'Not in', value:2, tone:'amber' }], lines:[], moments:[] },
                { competency:'Responsiveness', definition:'', behaviours:[], signals:[{ label:'Morning mail sweep', value:'44 of 47 days', tone:'green' }], lines:[], moments:[] },
                { competency:'Customer Service', definition:'', behaviours:[], signals:[{ label:'Value-added lines', value:6, tone:'' }], lines:[], moments:[{ id:'m1', date:'2026-08-20', competency:'Customer Service', what:'Calmed a client who had been told three different things', by:'demo' }] }],
  training:{ covered:[{ date:'2026-08-12', topic:'AS400 screens', trainer:'The People Leader', achieved:'', result:'Confident' }], taught:[],
             planned:[{ activity:'Ingenium end to end', objective:'', dates:'Sept – Oct', facilitator:'' }], signedOff:1, planTotal:2,
             actions:[{ action:'Run the dues list alone', source:'Experiential', why:'' }], actionsDone:0 },
  jobDoc:true, salesforce:true, setup:{ goals:true, competencies:true }, side:'self' };

// ---- shot helpers ---------------------------------------------------------
const ensure = () => fs.mkdirSync(OUT, { recursive: true });
const shot = async (page, name) => { ensure(); await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('  ' + name); };
const shotOf = async (page, name, sel, pad = 14) => {
  ensure();
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(350);
  const b = await el.boundingBox();
  if (!b) { console.log('  ' + name + '  (no box — full page)'); return shot(page, name); }
  const vp = page.viewportSize();
  const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(vp.width, b.width + pad * 2), height: Math.min(vp.height, b.height + pad * 2) };
  clip.width = Math.min(clip.width, vp.width - clip.x); clip.height = Math.min(clip.height, vp.height - clip.y);
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip }); console.log('  ' + name);
};
const shotBetween = async (page, name, selTop, selBot, pad = 24) => {
  ensure();
  const top = page.locator(selTop).first(), bot = page.locator(selBot).first();
  await top.evaluate(e => e.scrollIntoView({ block: 'start' })); await page.waitForTimeout(350);
  const a = await top.boundingBox(), z = await bot.boundingBox();
  if (!a || !z) return shotOf(page, name, selTop, pad * 3);
  const vp = page.viewportSize(); const y = Math.max(0, a.y - pad);
  const clip = { x: 0, y, width: vp.width, height: Math.min(vp.height - y, (z.y + z.height + pad) - y) };
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip }); console.log('  ' + name);
};
const attempt = async (name, fn) => { try { await fn(); } catch (e) { console.log('  ' + name + '  SKIPPED — ' + String(e.message).split('\n')[0]); } };

// ---- the run ---------------------------------------------------------------
(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action === 'login' || body.action === 'me')
      return j({ ok:true, token:'t', profile: Object.assign({}, P, { attendance: { first:true, at:'08:02', lastSeen:'08:02', status:'in', reason:'', late:0 } }), roster:[P], schedule:SCH, kpis:KPIS });
    if (body.action === 'rows') return j({ ok:true, rows:[], metrics:METRICS, needsReason:NEEDS, openBook:BOOK, billing:{}, attendance:{ demo:{ at:'08:02', status:'in', reason:'', late:0 } }, mail:{}, ranks:['Branch Manager','Assistant Branch Manager','Unit Manager','Executive Agent','Agent'] });
    if (body.action === 'standing') return j(STANDING);
    if (body.action === 'saveMail') return j({ ok:true, when: body.when, at:'08:19', ranks: body.ranks, date:'2026-09-07' });
    if (body.action === 'updateTask') return j({ ok:true, field: body.field, label:'Closed', value: body.value });
    if (body.action === 'saveBlock') return j({ ok:true, block:body.block, at:'10:02', blocksDone:1, submitted:[body.block] });
    return j({ ok:true });
  });

  await page.clock.setFixedTime(new Date('2026-09-07T08:30:00'));
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const inputs = await page.$$('input');
  await inputs[0].fill('demo@example.com'); await inputs[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2400);

  console.log('The plan');
  await shot(page, 'plan');
  await attempt('signin', () => shotOf(page, 'signin', 'text=/In at 08:02/', 60));
  await attempt('sweep',  () => shotOf(page, 'sweep', 'text=/Morning mail — in this order/', 24));
  await attempt('order',  () => shotBetween(page, 'order', 'text=/What is in it/i', 'text=/Confirm funds in DISB/', 26));

  console.log('The day');
  await attempt('day', async () => {
    await page.click('button:has-text("Start the day")');
    await page.waitForTimeout(1400);
    await page.locator('text=KPI 1').first().click();
    await page.waitForTimeout(700);
    await shotOf(page, 'met', 'text=/objective/i', 44);
  });
  await attempt('close', async () => {
    await page.locator('button:has-text("Close ✓")').first().click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder*="What was done"]').fill('Reconciled and sent the corrected statement');
    await page.waitForTimeout(200);
    await shotOf(page, 'close', 'button:has-text("Close in Salesforce")', 150);
  });
  await attempt('quarter',  () => shotBetween(page, 'quarter', 'text=/Your quarter ·/', 'text=/landed 100%/', 26));
  await attempt('training', () => shotBetween(page, 'training', 'text=/Trained on this quarter/', 'button:has-text("Where you stand")', 26));

  await b.close(); server.close();
  console.log('\nshots/ written\n');
})().catch(e => { console.error(e); process.exit(1); });
