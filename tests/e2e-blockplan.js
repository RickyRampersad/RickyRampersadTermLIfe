// The block that closes itself, as the person sees it.
//
// Two screens carry it. On the plan, each block says what it is for: the
// open tasks of the types picked, as boxes to tick, and a line for anything
// Salesforce cannot see. On the day, a block that has closed shows what the
// closer decided — the score, what Salesforce saw, and a reason box on
// anything it found wanting — so the answer the e-mail asks for can be given
// here as well.
//
// Run: node tests/e2e-blockplan.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
const PORT = 8811;

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
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm',
  blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues / Surveys', kpi:'Renewa/PDl/Bill'},
            KPI2:{time:'10 – 12pm', focus:'Ind. Health Billing Recon', kpi:'Renewa/PDl/Bill'},
            PM1: {time:'1 – 3pm',   focus:'Adopt an Orphan', kpi:''},
            PM2: {time:'3 – 4pm',   focus:'Task Mgmt / Branch Meeting Reports', kpi:'Reporting'} } } };
const SF = { 'Pendings':'Pendings · pending, lapse and follow-ups',
             'Renewa/PDl/Bill':'Renewals / Premium Dues / Billing',
             'Lic/Staffing/SA/HR':'Licensing / Staffing / Sales Admin / HR' };
const LIST = Object.keys(SF).map(v => ({ value:v, label:SF[v], salesforce:true }))
  .concat([{ value:'Reporting', label:'Reporting', salesforce:false },
           { value:'Task Management', label:'Task Management', salesforce:false }]);
const KPIS = { ssa:LIST, bma:LIST, bm:LIST, abm:LIST, um:LIST };
const BOOK = { demo: {
  'Renewa/PDl/Bill': [
    { id:'00T000000000001AAA', subject:'T- PENSIONS GROUP - R&C ENTERPRISES LIMITED', status:'In Progress', due:'2026-09-07', late:false, age:40, agent:'A. Advisor', touched:21, needs:true },
    { id:'00T000000000002AAA', subject:'Confirm funds in DISB & SUSP - one client', status:'In Progress', due:'2026-09-07', late:false, age:22, agent:'A. Advisor' } ],
  'Lic/Staffing/SA/HR': [
    { id:'00T000000000005AAA', subject:'Licence renewal - one agent', status:'Not Started', due:'2026-08-30', late:true, age:6, agent:'' } ] } };
const METRICS = { ok:true, date:'2026-09-17', staff:{ demo:{ closed:0, open:3, overdue:1, needs:1, byType:{ 'Renewa/PDl/Bill':{ open:2, overdue:0, needs:1 }, 'Lic/Staffing/SA/HR':{ open:1, overdue:1, needs:0 } }, rateAll:{ closed:150, days:60, enough:true, perDay:14, perHour:2 } } }, branch:{ byType:{} } };

const span = (s, e, st, et) => ({ start:s, end:e, startText:st, endText:et });
const SPANS = { KPI1:span(480,600,'08:00','10:00'), KPI2:span(600,720,'10:00','12:00'), PM1:span(780,900,'13:00','15:00'), PM2:span(900,960,'15:00','16:00') };
// KPI 2 has closed itself: one task Salesforce says is done, one line of the
// person's own nobody ticked.
const PLANS = { KPI2: { block:'KPI2', closedAt:'12:05', achieved:1, of:2, pct:50, sfClosed:2, sfMoved:1, filed:'auto', emailed:true, note:'', span:SPANS.KPI2,
  items:[ { k:'sf', id:'00T000000000001AAA', subject:'T- PENSIONS GROUP - R&C ENTERPRISES LIMITED', type:'Renewa/PDl/Bill', state:'done' },
          { k:'own', label:'Interview two recruits', done:false, state:'unconfirmed' } ] } };
const posted = { savePlan:[], blockReason:[], createTask:[] };

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 430, height: 940 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-17T08:30:00'));

  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action==='login' || body.action==='me') return j({ ok:true, token:'t', profile:P, roster:[P], schedule:SCH, kpis:KPIS });
    if (body.action==='rows') return j({ ok:true, rows:[], metrics:METRICS, needsReason:{}, openBook:BOOK, schedule:SCH, kpis:KPIS });
    if (body.action==='plan') return j({ ok:true, staffId:'demo', date:body.date, plans:PLANS, spans:SPANS, now:'08:30' });
    if (body.action==='savePlan') {
      posted.savePlan.push(body);
      PLANS[body.block] = { block:body.block, items:body.items, closedAt:'', achieved:null, of:null, pct:null, sfClosed:null, sfMoved:null, filed:'', emailed:false, note:'', span:SPANS[body.block] };
      return j({ ok:true, plan:PLANS[body.block] });
    }
    if (body.action==='createTask') {
      posted.createTask.push(body);
      const pl = PLANS[body.block];
      const it = { k:'sf', id:'00T900000000001AA', subject:body.subject, type:body.type };
      pl.items = pl.items.map(x => (x.k === 'own' && x.label === body.label) ? it : x);
      return j({ ok:true, id:it.id, item:it, due:body.due, type:body.type, subject:body.subject, swapped:true, plan:pl });
    }
    if (body.action==='blockReason') {
      posted.blockReason.push(body);
      const pl = PLANS[body.block], it = pl.items[body.item];
      if (body.done) { it.done = true; it.state = 'done'; pl.achieved = 2; pl.pct = 100; } else { it.reason = body.reason; it.state = 'explained'; }
      return j({ ok:true, plan:pl });
    }
    return j({ ok:true });
  });

  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('demo@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2400);

  console.log('\nOn the plan, each block says what it is for:\n');
  ok('the plan is what opens', await page.locator('text=Set the day before it starts').count() > 0);
  const k1 = page.locator('[data-plan="KPI1"]');
  ok('every block carries the panel', await page.locator('[data-plan]').count() === 4, String(await page.locator('[data-plan]').count()));
  const k1t = await k1.innerText();
  ok('and says when it will close itself', /closes itself at 10:00/.test(k1t), k1t.slice(0, 120));
  ok('the open tasks of the picked type are there to tick', /T- PENSIONS GROUP/.test(k1t) && /Confirm funds in DISB/.test(k1t));
  ok('with how long each has been open', /40 days/.test(k1t));
  ok('the licensing task is not — that type is not picked for this block', !/Licence renewal/.test(k1t));
  // The panel no longer repeats the role's whole KPI list under the picker
  // that already shows it. What it offers is the word-work this block is for,
  // and a line for anything else.
  const ownPart = k1t.split(/in your own words/i)[1] || '';
  ok('it asks for anything in words', ownPart.length > 0, k1t.slice(-160));
  ok('and does not repeat the whole KPI list under it',
     !/Reporting/.test(ownPart) && !/Task Management/.test(ownPart) && !/Licensing/.test(ownPart), ownPart.slice(0, 160));
  const pm2 = page.locator('[data-plan="PM2"]');
  ok('a block whose KPI is word-work offers that as a chip',
     await pm2.locator('button:has-text("Reporting")').count() === 1);

  console.log('\nPicking, and saving:\n');
  await k1.locator('input[type="checkbox"]').first().check();
  await k1.locator('input[placeholder*="Interview"]').fill('Call two recruits about Monday');
  await k1.locator('button:has-text("Add")').click();
  await page.waitForTimeout(150);
  ok('two on the plan, and it says so', /2 on the plan/.test(await k1.innerText()));
  ok('the typed line is listed with a tick box', await k1.locator('text=Call two recruits about Monday').count() > 0);
  await k1.locator('button:has-text("Save plan")').click();
  await page.waitForTimeout(500);
  const sp = posted.savePlan[0];
  ok('the save names the block', !!sp && sp.block === 'KPI1' && sp.staffId === 'demo', JSON.stringify(sp && [sp.block, sp.staffId]));
  ok('the Salesforce task travels with its id, subject and type', !!sp && sp.items[0].k === 'sf' && sp.items[0].id === '00T000000000001AAA' && /PENSIONS/.test(sp.items[0].subject) && sp.items[0].type === 'Renewa/PDl/Bill', JSON.stringify(sp && sp.items[0]));
  ok('and the person\'s own line as words', !!sp && sp.items.some(x => x.k === 'own' && x.label === 'Call two recruits about Monday'), JSON.stringify(sp && sp.items));
  ok('it says saved, and when it closes', /Saved · closes itself at 10:00/.test(await k1.innerText()));

  console.log('\nA line of her own can be made into a real task:\n');
  await k1.locator('button:has-text("Make it a task")').first().click();
  await page.waitForTimeout(200);
  const mkBox = k1.locator('[data-maketask]');
  ok('the maker opens on that line', await mkBox.count() === 1);
  const mkT = await mkBox.innerText();
  ok('and says where it goes and who reads it', /goes into Salesforce as yours/.test(mkT) && /reads it back/.test(mkT), mkT.slice(0, 120));
  ok('the subject is the line they typed',
     await mkBox.locator('input[placeholder="Subject"]').inputValue() === 'Call two recruits about Monday');
  ok('the due date starts on the day being planned',
     await mkBox.locator('input[type="date"]').inputValue() === '2026-09-17');
  const typeOpts = await mkBox.locator('select option').allTextContents();
  ok('only types Salesforce holds are offered', typeOpts.length === 3 && typeOpts.every(t => /Pendings|Renewals|Licensing/.test(t)), typeOpts.join(' | '));
  ok('and the block\'s own type is chosen for them',
     await mkBox.locator('select').inputValue() === 'Renewa/PDl/Bill', await mkBox.locator('select').inputValue());
  await mkBox.locator('input[type="date"]').fill('2026-09-18');
  await mkBox.locator('button:has-text("Create in Salesforce")').click();
  await page.waitForTimeout(600);
  const ct = posted.createTask[0];
  ok('the create names the line, the subject, the type and the date',
     !!ct && ct.label === 'Call two recruits about Monday' && ct.subject === 'Call two recruits about Monday' &&
     ct.type === 'Renewa/PDl/Bill' && ct.due === '2026-09-18' && ct.block === 'KPI1' && ct.staffId === 'demo',
     JSON.stringify(ct));
  const after = await k1.innerText();
  ok('it says so, with the date', /In Salesforce, assigned to you, due 18 Sep/.test(after), (after.match(/In Salesforce[^\n]{0,60}/) || [''])[0]);
  ok('and the maker closes', await mkBox.count() === 0);
  ok('the line is now a task on the plan, with a tick box',
     await k1.locator('input[type="checkbox"]').count() === 3, String(await k1.locator('input[type="checkbox"]').count()));
  ok('nothing of her own is left unticked in words', !/Call two recruits about Monday\s*\n?\s*\u00d7/.test(after));

  console.log('\nOn the day, a closed block shows what the closer decided:\n');
  await page.click('button:has-text("Start the day")');
  await page.waitForTimeout(800);
  const day = await page.locator('body').innerText();
  ok('KPI 1 says two are planned', /2 planned/.test(day));
  ok('KPI 2 says it closed, with the score', /Closed 12:05 · 50%/.test(day));
  await page.locator('button:has-text("KPI 2")').first().click();
  await page.waitForTimeout(400);
  const out = page.locator('[data-outcome="KPI2"]');
  ok('the outcome is on the block', await out.count() === 1);
  const ot = await out.innerText();
  ok('closed itself, one of two, fifty percent', /Closed itself at 12:05/i.test(ot) && /1 of 2 done · 50%/.test(ot), ot.slice(0, 160));
  ok('filed for them, and what Salesforce saw', /Filed for you from Salesforce/.test(ot) && /Salesforce saw 2 closed, 1 moved/.test(ot));
  ok('the done task is ticked; the unticked line says so', /✓\s*T- PENSIONS GROUP[^\n]*done/.test(ot) && /Interview two recruits[^\n]*not ticked/.test(ot));
  ok('the person\'s own line offers Done; the task does not', await out.locator('button:has-text("Done")').count() === 1);
  // Answering is a tap now: the eight reasons a thing does not land, and a
  // line only when none of them is it.
  ok('the reasons are offered as taps', await out.locator('[data-why] button').count() >= 8,
     String(await out.locator('[data-why] button').count()));
  await out.locator('[data-why] button:has-text("Waiting on the client")').first().click();
  await page.waitForTimeout(500);
  let br = posted.blockReason[0];
  ok('one tap files it against the line', !!br && br.block === 'KPI2' && br.item === 1 &&
     br.reason === 'Waiting on the client', JSON.stringify(br));
  const ot2 = await out.innerText();
  ok('and the block now shows it', /reason given/.test(ot2) && /Waiting on the client/.test(ot2));
  ok('with nothing left to ask', await out.locator('button:has-text("Say why")').count() === 0);
  ok('no errors on the page', !errors.length, errors.join(' | '));

  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
