// The day handed out, the reasons tapped rather than typed, and the picture
// at the top of the day.
//
// Run: node tests/e2e-assign.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png' };
const PORT = 8841;

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0', unit:'Support',
            grade:'Sales Support Assistant', role:'ssa', tier:'support', tierLabel:'Sales Support',
            tierOrder:4, reportsTo:'demo', manager:false };
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm', blocks: {
  KPI1:{ time:'8 – 10am', focus:'Premium Dues', kpi:'Renewa/PDl/Bill' },
  KPI2:{ time:'10 – 12pm', focus:'Billing recon', kpi:'Renewa/PDl/Bill' },
  PM1:{ time:'1 – 3pm', focus:'Orphans', kpi:'' } } } };
const LIST = [{ value:'Renewa/PDl/Bill', label:'Renewals / Premium Dues / Billing', salesforce:true },
              { value:'Reporting', label:'Reporting', salesforce:false }];
const KPIS = { ssa:LIST, bm:LIST, bma:LIST, abm:LIST, um:LIST };
const METRICS = { ok:true, date:'2026-09-18', staff:{ demo:{ closed:3, open:11, overdue:4, needs:2, aged60:0, noDate:0,
  byType:{ 'Renewa/PDl/Bill':{ open:11, overdue:4, needs:2 } }, rateAll:{ closed:120, days:60, enough:true, perDay:2, perHour:0.25 } } }, branch:{ byType:{} } };
const span = (s,e,st,et) => ({ start:s, end:e, startText:st, endText:et });
const SPANS = { KPI1:span(480,600,'08:00','10:00'), KPI2:span(600,720,'10:00','12:00'), PM1:span(780,900,'13:00','15:00') };
const ASSIGN = { ok:true, date:'2026-09-18', staffId:'demo', rate:0.25, blocks: [
  { block:'KPI1', time:'8 – 10am', focus:'Premium Dues', kpi:'Renewa/PDl/Bill', room:2, planned:0, closed:false, items:[
    { k:'sf', id:'00T000000000001AAA', subject:'Premium dues - one client', type:'Renewa/PDl/Bill', age:42, late:true, touched:30,
      why:'Overdue since 7 Aug with no reason on it — every report reads that as untouched.' },
    { k:'sf', id:'00T000000000002AAA', subject:'Stop payment - one client', type:'Renewa/PDl/Bill', age:20, late:false, touched:21,
      why:'Nothing has happened to it in 21 days.' }], note:'' },
  { block:'KPI2', time:'10 – 12pm', focus:'Billing recon', kpi:'Renewa/PDl/Bill', room:2, planned:0, closed:false, items:[
    { k:'sf', id:'00T000000000003AAA', subject:'Group billing - one account', type:'Renewa/PDl/Bill', age:9, late:false, touched:3,
      why:'9 days open.' }], note:'' },
  { block:'PM1', time:'1 – 3pm', focus:'Orphans', kpi:'', room:1, planned:0, closed:false, items:[],
    note:'Salesforce holds no tasks for this block — say in a line what you will get done.' } ] };
const PLANS = {};
const posted = { acceptDay:[] };

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-18T08:20:00'));
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action==='login' || body.action==='me') return j({ ok:true, token:'t', profile:P, roster:[P], schedule:SCH, kpis:KPIS });
    if (body.action==='rows') return j({ ok:true, rows:[], metrics:METRICS, needsReason:{}, openBook:{}, schedule:SCH, kpis:KPIS });
    if (body.action==='assign') return j(ASSIGN);
    if (body.action==='plan') return j({ ok:true, staffId:'demo', date:body.date, plans:PLANS, spans:SPANS, now:'08:20' });
    if (body.action==='acceptDay') {
      posted.acceptDay.push(body);
      Object.keys(body.blocks).forEach(col => {
        PLANS[col] = { block:col, items:body.blocks[col], closedAt:'', achieved:null, of:null, pct:null,
                       filed:'', emailed:false, note:'', span:SPANS[col] };
      });
      return j({ ok:true, wrote:Object.keys(body.blocks).length, skipped:[], plans:PLANS });
    }
    return j({ ok:true });
  });

  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('demo@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2400);

  console.log('\nThe day arrives filled in:\n');
  const card = page.locator('[data-assign]');
  ok('the plan opens on work already handed out', await card.count() === 1);
  const t = await card.innerText();
  ok('it says how much it is handing you', /3 of 3 taken/.test(t), (t.match(/\d of \d taken/) || [''])[0]);
  ok('and that it came from the book, worst first', /from your own book, worst first/.test(t));
  ok('every line says why it was chosen',
     /Overdue since 7 Aug with no reason on it/.test(t) && /Nothing has happened to it in 21 days/.test(t), t.slice(0, 200));
  ok('a block Salesforce holds nothing for says so instead of sitting empty',
     /Salesforce holds no tasks for this block/.test(t));
  ok('and it says what it sized the day on', /Sized on your own pace: 0.25 an hour/.test(t));

  console.log('\nArguing with it is one untick:\n');
  await card.locator('[data-assign-block="KPI1"] input[type="checkbox"]').first().uncheck();
  await page.waitForTimeout(150);
  ok('the count follows', /2 of 3 taken/.test(await card.innerText()));
  await card.locator('button:has-text("Accept the day")').click();
  await page.waitForTimeout(700);
  const sent = posted.acceptDay[0];
  ok('accepting writes every block at once',
     !!sent && Object.keys(sent.blocks).sort().join(',') === 'KPI1,KPI2', JSON.stringify(sent && Object.keys(sent.blocks)));
  ok('and only what was left ticked', !!sent && sent.blocks.KPI1.length === 1 &&
     sent.blocks.KPI1[0].id === '00T000000000002AAA', JSON.stringify(sent && sent.blocks.KPI1));
  ok('the card says the day is set', /Your day is set/.test(await page.locator('body').innerText()));

  console.log('\nThe day, at a glance:\n');
  await page.click('button:has-text("Start the day")');
  await page.waitForTimeout(900);
  const glance = page.locator('[data-glance]');
  ok('there is a picture at the top of the day', await glance.count() === 1);
  const g = await glance.innerText();
  ok('with the ring, the blocks and the three numbers',
     /%/.test(g) && /of 5/.test(g) && /closed today/.test(g) && /open now/.test(g) && /overdue/.test(g), g.replace(/\n/g, ' / '));
  ok('a bar for every block', await glance.locator('div[title]').count() === 5,
     String(await glance.locator('div[title]').count()));
  ok('no javascript errors', !errors.length, errors.join(' | '));

  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
