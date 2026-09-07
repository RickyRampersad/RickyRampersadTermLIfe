// The order of service, the mail sweep and the Branch Manager's landing, on
// the screen.
//
// What has to be true in the browser: the plan carries the morning sweep in
// the mandated order and marking it sends the five answers and nothing else;
// an open list says who each item is for, Branch Manager first; the Branch
// Manager lands on his own register, sweep, quarter and job document before
// the branch; and the job document renders its sections in the paper's order.
//
// Run: node tests/e2e-flow.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8804;

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0', unit:'Support',
            grade:'Sales Support Assistant · G3', role:'ssa', tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'boss', manager:false, leads:[] };
const BOSS = { staffId:'boss', name:'Demo Manager', email:'boss@example.com', agentNumber:'D1', unit:'Branch',
               grade:'Branch Manager', role:'bm', tier:'management', tierLabel:'Management', tierOrder:1, reportsTo:'', manager:true, leads:['demo'] };
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm', blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues', kpi:'Renewa/PDl/Bill'}, KPI2:{time:'10 – 12pm', focus:'x'}, PM1:{time:'1 – 3pm', focus:'y'}, PM2:{time:'3 – 4pm', focus:'z'} } },
              boss: { hours:'8am – 5pm', lunch:'Flexible', blocks: { KPI1:{time:'8 – 10am', focus:'a'}, KPI2:{time:'10 – 12pm', focus:'b'}, PM1:{time:'1 – 3pm', focus:'c'}, PM2:{time:'3 – 5pm', focus:'d'} } } };
const BOOK = { demo: { 'Renewa/PDl/Bill': [
  { id:'t1', subject:'Premium dues — Demo Manager desk', status:'Not Started', due:'2026-09-10', late:false, age:2, touched:9, needs:true, agent:'Demo Manager', rank:0, 'for':'Branch Manager', account:'', hasReason:false },
  { id:'t2', subject:'Premium dues — an executive agent', status:'Not Started', due:'2026-09-02', late:true, age:5, touched:9, needs:true, agent:'Exec Person', rank:3, 'for':'Executive Agent', account:'', hasReason:false },
  { id:'t3', subject:'Premium dues — an agent', status:'In Progress', due:'2026-09-01', late:true, age:6, touched:9, needs:true, agent:'Some Agent', rank:4, 'for':'', account:'', hasReason:true } ] } };
const METRICS = { ok:true, date:'2026-09-07', staff:{ demo:{ closed:1, open:3, overdue:2, aged60:0, noDate:0, needs:3, byType:{ 'Renewa/PDl/Bill': { closed:1, open:3, overdue:2, needs:3 } }, rateAll:{ closed:40, days:60, enough:true, perDay:0.93, perHour:0.13 } } }, branch:{ byType:{} } };
const DOC = { ok:true, role:'bm', doc:{ 'Performance expectation':[{ item:'Production', detail:'Branch target met each quarter' }], Header:[{ item:'Branch Manager', detail:'Reports to the Regional Manager' }], Overview:[{ item:'Purpose', detail:'Build and run a salesforce' }] } };
const STANDING = { ok:true, staffId:'boss', role:'bm', quarter:'2026-Q3', from:'2026-07-01', to:'2026-09-08', today:'2026-09-07', daysIn:49, daysLeft:17,
  goals:[{ goal:'Production & Pipeline Management', weight:20, target:0.9, kpiTypes:['Opportunity'], evidence:{ blocks:10, planned:900, met:{ met:8, partly:1, no:1 }, lines:[], closed:12, open:4, needs:0, late:0 }, landed:0.8 }],
  competencies:[{ competency:'Responsiveness', definition:'', behaviours:[], signals:[{ label:'Morning mail sweep', value:'40 of 49 days', tone:'green' }], lines:[], moments:[] }],
  salesforce:true, setup:{ goals:true, competencies:true }, side:'self' };

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

const closedTasks = [];

async function session(b, who, first, mail, sent) {
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action === 'login' || body.action === 'me')
      return j({ ok:true, token:'t', profile: Object.assign({}, who, { attendance: { first, at:'08:02', lastSeen:'08:02', status:'in', reason:'', late:0 } }), roster:[P, BOSS], schedule:SCH, kpis:{ ssa:[{ value:'Renewa/PDl/Bill', label:'Renewals / Premium Dues / Billing', salesforce:true }], bm:[] } });
    if (body.action === 'rows') return j({ ok:true, rows:[], metrics:METRICS, openBook:BOOK, needsReason:{}, billing:{}, attendance:{ [who.staffId]: { at:'08:02', status:'in', reason:'', late:0 } }, mail: mail || {}, ranks:['Branch Manager','Assistant Branch Manager','Unit Manager','Executive Agent','Agent'] });
    if (body.action === 'saveMail') { sent.push(body); return j({ ok:true, when: body.when, at:'08:31', ranks: body.ranks, date:'2026-09-07' }); }
    if (body.action === 'updateTask') { closedTasks.push(body); return j({ ok:true, field: body.field, label:'Closed', value: body.value, subject:'Premium dues — Demo Manager desk' }); }
    if (body.action === 'standing') return j(STANDING);
    if (body.action === 'jobDoc') return j(DOC);
    if (body.action === 'hr') return j({ ok:true, me:{ staffId: who.staffId, role: who.role, goals:[], competencies:[], reviews:[], development:[], training:[] }, reports:[], types:[], sources:[], setup:{ goals:true, competencies:true }, standard:0.72 });
    return j({ ok:true });
  });
  await page.clock.setFixedTime(new Date('2026-09-07T08:30:00'));
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill(who.email); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2200);
  return { page, ctx, errors };
}

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const sent = [];

  console.log('\nThe morning sweep, on the plan, in the mandated order:\n');
  let s = await session(b, P, true, {}, sent);
  let t = await s.page.locator('body').innerText();
  ok('it lands on the plan', /Set the day before it starts/.test(t), t.slice(0, 80));
  ok('the sweep is there, in this order', /Morning mail — in this order/i.test(t), (t.match(/Morning mail[^\n]*/) || [''])[0]);
  const order = ['1. Branch Manager', '2. Assistant Branch Manager', '3. Unit Managers', '4. Executive Agents', '5. Agents'];
  ok('Branch Manager, ABM, Unit Managers, Executive Agents, Agents', order.every((o, i) => t.indexOf(o) > -1 && (i === 0 || t.indexOf(o) > t.indexOf(order[i - 1]))));
  const btn = s.page.locator('button:has-text("Answer all five to mark it")');
  ok('it cannot be marked until every rank has an answer', await btn.count() === 1 && await btn.isDisabled());
  const answered = s.page.locator('button:has-text("Answered")');
  const nothing = s.page.locator('button:has-text("Nothing waiting")');
  await answered.nth(0).click(); await nothing.nth(1).click(); await answered.nth(2).click(); await nothing.nth(3).click(); await answered.nth(4).click();
  await s.page.click('button:has-text("Mark the morning sweep done")');
  await s.page.waitForTimeout(700);
  ok('one record went out', sent.length === 1, String(sent.length));
  ok('with the five answers, the half of the day, and nothing else', sent[0] && sent[0].when === 'am' && sent[0].staffId === 'demo' && JSON.stringify(sent[0].ranks) === JSON.stringify({ bm:'done', abm:'none', um:'done', ea:'none', ag:'done' }), JSON.stringify(sent[0]));
  t = await s.page.locator('body').innerText();
  ok('and the plan says it was swept, with the time', /Morning mail swept at 08:31/.test(t) && /Branch ✓/.test(t) && /Assistant –/.test(t));

  console.log('\nThe open list says who each item is for:\n');
  // KPI 1 is pre-picked from the schedule, so its list is already on the plan.
  await s.page.waitForTimeout(400);
  t = await s.page.locator('body').innerText();
  const a = t.indexOf('for the Branch Manager'), e = t.indexOf('for the Executive Agent'), g = t.indexOf('Premium dues — an agent');
  ok('the Branch Manager\'s item first, then the Executive Agent\'s, then the agent\'s', a > -1 && e > a && g > e, [a, e, g].join(','));
  ok('and an agent\'s item carries no rank', !/for the Agent\b/.test(t));
  ok('the person\'s own screens are named at the top', /Your quarter/.test(t) && /My performance/.test(t) && /Job document/.test(t));

  console.log('\nClosing a task from the list:\n');
  await s.page.locator('button:has-text("Close ✓")').first().click();
  await s.page.waitForTimeout(200);
  const closeBtn = s.page.locator('button:has-text("Close in Salesforce")');
  ok('it asks for a line first', await closeBtn.count() === 1 && await closeBtn.isDisabled());
  await s.page.locator('input[placeholder*="What was done"]').fill('Reconciled and sent the corrected statement');
  ok('four words make it ready', !(await closeBtn.isDisabled()));
  await closeBtn.click();
  await s.page.waitForTimeout(700);
  ok('one close went out', closedTasks.length === 1, String(closedTasks.length));
  ok('for that task, as a close, with the line', closedTasks[0] && closedTasks[0].taskId === 't1' && closedTasks[0].field === 'close' && closedTasks[0].value === 'Reconciled and sent the corrected statement', JSON.stringify(closedTasks[0]));
  t = await s.page.locator('body').innerText();
  ok('and the task is gone from the list', !/Demo Manager desk/.test(t) && /an executive agent/.test(t));
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  console.log('\nThe Branch Manager\'s landing:\n');
  s = await session(b, BOSS, true, { boss: { am: { at:'07:58', ranks:{ bm:'none', abm:'done', um:'done', ea:'done', ag:'done' } }, pm: null } }, sent);
  t = await s.page.locator('body').innerText();
  ok('a You section before the branch', /\bYOU\b/.test(t) && t.indexOf('YOU') < t.indexOf('Your branch, as it stands'), t.slice(0, 200));
  ok('with his sign-in', /In at 08:02 · on time/.test(t));
  ok('his morning sweep, already done', /Morning mail swept at 07:58/.test(t));
  ok('his quarter, against his own goals', /Production & Pipeline Management/.test(t) && /landed 80% · target 90%/.test(t));
  ok('and the door to his job document', await s.page.locator('button:has-text("Your job document")').count() === 1);
  await s.page.click('button:has-text("Your job document")');
  await s.page.waitForTimeout(900);
  t = await s.page.locator('body').innerText();
  ok('the document renders, sections in the paper\'s order', /Your job document/i.test(t) && t.indexOf('Reports to the Regional Manager') < t.indexOf('Build and run a salesforce') && t.indexOf('Build and run a salesforce') < t.indexOf('Branch target met each quarter'));
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  const html = fs.readFileSync(path.join(ROOT, 'kpi/index.html'), 'utf8');
  ok('no colleague is named in the new code', !/sasha|kamla|elizabeth|azariah|pawan|kerwyn|akaash|ashley|gary/i.test(html.slice(html.indexOf('const RANK_ROWS'), html.indexOf('// ---- the quarter so far'))));

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
