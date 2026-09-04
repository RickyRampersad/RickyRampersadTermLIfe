// The blank box was the problem. "What did you do today" gets "3 tasks" back.
//
// Picking a KPI now changes the question: the placeholders name what that type
// of work is measured in, and a worked example sits above them so the standard
// is visible rather than described. Where Salesforce is reachable it also shows
// the person's real position in that type, so the number they are about to
// write has something to be checked against.
//
// Run: node tests/e2e-guide.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
const PORT = 8797;

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
  blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues / Surveys'},
            KPI2:{time:'10 – 12pm', focus:'Ind. Health Billing Recon'},
            PM1: {time:'1 – 3pm',   focus:'Adopt an Orphan'},
            PM2: {time:'3 – 4pm',   focus:'Task Mgmt / Branch Meeting Reports'} } } };
// Shaped like the real thing: sfkMetrics_ returns byType per person.
const METRICS = { demo: { closed:0, open:23, overdue:1, aged60:0, noDate:0,
                          byType: { 'Renewa/PDl/Bill': { open:17, overdue:1 },
                                    'Servicing': { open:3, overdue:0 } } } };

// The same shape allKpiChoices_ serves: the Salesforce task types first, then
// the job-document responsibilities that carry no live numbers.
const SF = { 'Pendings':'Pendings · pending, lapse and follow-ups',
             'Renewa/PDl/Bill':'Renewals / Premium Dues / Billing',
             'Servicing':'Servicing lines', 'Claims/ Mat':'Claims / Maturities',
             'Scripts/CB':'Scripts / Clawbacks', 'Opportunity':'Opportunity',
             'Lic/Staffing/SA/HR':'Licensing / Staffing / Sales Admin / HR',
             'RR Operations':'RR Operations', 'Training':'Training delivered',
             'Innovation&Creativity':'Innovation & Creativity' };
const WORDS = ['New Application Process', 'Reporting', 'Task Management'];
const LIST = Object.keys(SF).map(v => ({ value:v, label:SF[v], salesforce:true }))
  .concat(WORDS.map(v => ({ value:v, label:v, salesforce:false })));
const KPIS = { ssa:LIST, bma:LIST, bm:LIST, abm:LIST, um:LIST };

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 430, height: 900 } });

  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action==='login' || body.action==='me')
      return j({ ok:true, token:'t', profile:P, roster:[P], schedule:SCH, kpis:KPIS });
    if (body.action==='rows')    return j({ ok:true, rows:[], metrics:METRICS });
    if (body.action==='metrics') return j({ ok:true, metrics:METRICS });
    return j({ ok:true });
  });

  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('demo@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2200);

  await page.locator('text=KPI 1').first().click();
  await page.waitForTimeout(500);

  console.log('\nBefore a KPI is picked:\n');
  ok('no example is shown yet', await page.locator('text=A good entry reads like').count() === 0);

  console.log('\nRenewals / Premium Dues / Billing:\n');
  await page.locator('select:visible').first().selectOption('Renewa/PDl/Bill');
  await page.waitForTimeout(400);
  ok('the worked example appears', await page.locator('text=A good entry reads like').count() > 0);
  ok('and it is the one for this type',
     await page.locator('text=/direct debits sent/').count() > 0);

  const t = await page.locator('textarea:visible').all();
  const ph = await t[0].getAttribute('placeholder');
  ok('Actioned asks how many and for whom', /How many, and for whom/.test(ph), ph);
  const ph2 = await t[1].getAttribute('placeholder');
  ok('Resolved asks what actually cleared', /actually cleared/.test(ph2), ph2);

  console.log('\nThe live position for that type:\n');
  ok('it says what Salesforce has them at',
     await page.locator('text=/17 open here/').count() > 0);
  ok('and names the overdue one', await page.locator('text=/1 overdue/').count() > 0);

  console.log('\nChanging the KPI changes the question:\n');
  await page.locator('select:visible').first().selectOption('Claims/ Mat');
  await page.waitForTimeout(400);
  ok('the example follows the type',
     await page.locator('text=/medical report received/').count() > 0);
  ok('the old one is gone', await page.locator('text=/direct debits sent/').count() === 0);
  const t2 = await page.locator('textarea:visible').all();
  ok('and so does the placeholder',
     /Which claim/.test(await t2[0].getAttribute('placeholder')));
  ok('no live figure is invented for a type with none',
     await page.locator('text=/open here/').count() === 0);

  console.log('\nA type with no line of its own still gets asked properly:\n');
  await page.locator('select:visible').first().selectOption('Reporting');
  await page.waitForTimeout(400);
  const t3 = await page.locator('textarea:visible').all();
  ok('the fallback question is used',
     /What you did, for whom, and how many/.test(await t3[0].getAttribute('placeholder')));

  if (process.env.SHOT) {
    await page.locator('select:visible').first().selectOption('Renewa/PDl/Bill');
    await page.waitForTimeout(500);
    await page.screenshot({ path: process.env.SHOT, fullPage: false });
  }

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
