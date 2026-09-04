// The morning half of the day.
//
// The tracker used to be a diary: four write-ups at four o'clock, from memory.
// This is the other side — at eight the book is already known, so the day can
// be laid against it. The thing being tested is that the size of the work is
// on screen while the choice is made, because the complaint that started this
// was two hours going into a block that held three tasks.
//
// Run: node tests/e2e-plan.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
const PORT = 8798;

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0',
            unit:'Support', grade:'Sales Support Assistant · G3', role:'ssa',
            tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'demo', manager:false };
const SCH = { demo: { start:'08:00', end:'16:00', lunch:'12:30-13:30',
  blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues / Surveys', kpi:'Renewa/PDl/Bill'},
            KPI2:{time:'10 – 12pm', focus:'Ind. Health Billing Recon'},
            PM1: {time:'1 – 3pm',   focus:'Adopt an Orphan'},
            PM2: {time:'3 – 4pm',   focus:'Task Mgmt / Branch Meeting Reports'} } } };
const SF = { 'Pendings':'Pendings · pending, lapse and follow-ups',
             'Renewa/PDl/Bill':'Renewals / Premium Dues / Billing',
             'Servicing':'Servicing lines', 'Claims/ Mat':'Claims / Maturities',
             'Lic/Staffing/SA/HR':'Licensing / Staffing / Sales Admin / HR' };
const LIST = Object.keys(SF).map(v => ({ value:v, label:SF[v], salesforce:true }))
  .concat([{ value:'Reporting', label:'Reporting', salesforce:false }]);
const KPIS = { ssa:LIST, bma:LIST, bm:LIST, abm:LIST, um:LIST };

const METRICS = { ok:true, date:'2026-09-04', staff: {
  demo: { closed:0, open:23, overdue:1, byType: {
    'Renewa/PDl/Bill': { open:17, overdue:1 },
    'Servicing':       { open:3,  overdue:0 },
    'Lic/Staffing/SA/HR': { open:3, overdue:0 } } } },
  branch: { byType: { 'Renewa/PDl/Bill': { open:52, overdue:18 },
                      'Lic/Staffing/SA/HR': { open:17, overdue:9 } } } };

// The overdue-with-no-reason list sfkNeedsReason_ already returns.
const NEEDS = { demo: [
  { id:'00T1', subject:'Premium — one client, 8004023177', status:'In Progress',
    type:'Renewa/PDl/Bill', due:'2026-09-03', age:1 },
  { id:'00T2', subject:'Stop payment form — one client', status:'Waiting on someone else',
    type:'Renewa/PDl/Bill', due:'2026-08-21', age:14 } ] };

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 430, height: 940 } });
  page.on('pageerror', e => console.log('  PAGE ERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('  CONSOLE: ' + m.text()); });

  // Half past eight: the plan is the useful screen.
  await page.clock.setFixedTime(new Date('2026-09-04T08:30:00'));

  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action==='login' || body.action==='me')
      return j({ ok:true, token:'t', profile:P, roster:[P], schedule:SCH, kpis:KPIS });
    if (body.action==='rows')
      return j({ ok:true, rows:[], metrics:METRICS, needsReason:NEEDS });
    return j({ ok:true });
  });

  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('demo@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2400);

  console.log('\nSigning in before ten lands on the plan:\n');
  ok('the plan is what opens', await page.locator('text=Set the day before it starts').count() > 0);
  ok('all four blocks are laid out', await page.locator('text=/8 . 10am/').count() > 0);

  console.log('\nThe size of the work is on screen while the day is set:\n');
  const renew = await page.locator('button:has-text("Renewals / Premium Dues")').first().textContent();
  ok('the scheduled type is already ticked', /\u2713/.test(renew), renew);
  ok('with its size beside it', /17 open/.test(renew), renew);
  ok('the day total adds up what is picked',
     await page.locator('text=/17 open . 1 already late/').count() > 0);

  console.log('\nA thin block says so before two hours go into it:\n');
  const lic = await page.locator('button:has-text("Licensing / Staffing")').first();
  ok('licensing shows three of their own', /3 open/.test(await lic.textContent()));
  ok('and seventeen across the branch', /17 in the branch/.test(await lic.textContent()));

  console.log('\nOnly the exceptions are asked about:\n');
  ok('the late ones are listed', await page.locator('text=Late, and no reason on it yet').count() > 0);
  ok('with how far over each is', await page.locator('text=/14 days over/').count() > 0);
  ok('and nothing is asked about the rest',
     await page.locator('text=/17 questions|reason for each/').count() === 0);

  console.log('\nPicking a second type moves the total:\n');
  await lic.click();
  await page.waitForTimeout(400);
  ok('the day total follows the picking',
     await page.locator('text=/20 open . 1 already late/').count() > 0);

  console.log('\nAnd the day starts from here:\n');
  await page.click('button:has-text("Start the day")');
  await page.waitForTimeout(900);
  ok('it opens the blocks', await page.locator('text=Submit each block as it ends').count() > 0);

  // Blocks are an accordion on the day screen, so open one before looking.
  await page.locator('text=KPI 1').first().click();
  await page.waitForTimeout(500);
  const carried = await page.locator('button:has-text("Licensing / Staffing")').first().textContent();
  ok('the morning plan is carried into the block', /\u2713/.test(carried), carried);

  console.log('\nAnd the plan is reachable again at two o’clock:\n');
  await page.click('button:has-text("Plan the day")');
  await page.waitForTimeout(600);
  ok('the way back works', await page.locator('text=Set the day before it starts').count() > 0);

  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
