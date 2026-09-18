// The load review, as the Branch Manager sees it: what each desk is holding,
// what has stopped moving, and a move he can make with one press.
//
// Run: node tests/e2e-load.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png' };
const PORT = 8833;

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const P = { staffId:'ricky', name:'Ricky Rampersad', email:'ricky@example.com', agentNumber:'R0',
            unit:'Branch', grade:'Branch Manager', role:'bm', tier:'bm', tierLabel:'Branch Manager',
            tierOrder:1, reportsTo:'', manager:true };
const ROSTER = [P,
  { staffId:'ada', name:'Ada Quill', email:'ada@example.com', role:'ssa', unit:'Support', grade:'Sales Support Assistant', tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'ricky', manager:false },
  { staffId:'bram', name:'Bram Quill', email:'bram@example.com', role:'ssa', unit:'Support', grade:'Sales Support Assistant', tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'ricky', manager:false }];
const SCH = {}; ROSTER.forEach(p => { SCH[p.staffId] = { hours:'8am – 4pm', blocks:{ KPI1:{ time:'8 – 10am', focus:'Desk', kpi:'' } } }; });
const LIST = [{ value:'Renewa/PDl/Bill', label:'Renewals / Premium Dues / Billing', salesforce:true },
              { value:'Servicing', label:'Servicing lines', salesforce:true },
              { value:'Reporting', label:'Reporting', salesforce:false }];
const KPIS = { ssa:LIST, bm:LIST, bma:LIST, abm:LIST, um:LIST };
const LOAD = { ok:true, asOf:'2026-09-18', window:60, quietAfter:14,
  people:[
    { staffId:'ada', name:'Ada Quill', open:120, overdue:30, quiet:12, aged60:8, closed:120, perDay:2, days:60 },
    { staffId:'bram', name:'Bram Quill', open:12, overdue:1, quiet:0, aged60:0, closed:48, perDay:0.8, days:15 },
    { staffId:'cleo', name:'Cleo Quill', open:9, overdue:4, quiet:3, aged60:1, closed:0, perDay:0, days:null }],
  stalled:[
    { id:'00T000000000001AAA', subject:'Premium dues - one client', type:'Renewa/PDl/Bill', owner:'ada', ownerName:'Ada Quill', due:'2026-08-01', quiet:31 },
    { id:'00T000000000002AAA', subject:'Portfolio to review - another client', type:'Servicing', owner:'ada', ownerName:'Ada Quill', due:'', quiet:48 }],
  moves:[
    { id:'00T000000000001AAA', subject:'Premium dues - one client', type:'Renewa/PDl/Bill', quiet:31,
      from:'ada', fromName:'Ada Quill', to:'bram', toName:'Bram Quill',
      why:'Nothing has happened to it in 31 days. Ada Quill is holding 60 days of work; Bram Quill is holding 15 and has closed 40 of this type in the last 60 days.' }] };
const posted = [];

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-18T12:30:00'));
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action==='login' || body.action==='me') return j({ ok:true, token:'t', profile:P, roster:ROSTER, schedule:SCH, kpis:KPIS });
    if (body.action==='rows') return j({ ok:true, rows:[], metrics:{ ok:true, staff:{}, branch:{ byType:{} } }, needsReason:{}, openBook:{}, schedule:SCH, kpis:KPIS });
    if (body.action==='load') return j(LOAD);
    if (body.action==='reassign') { posted.push(body); return j({ ok:true, taskId:body.taskId, to:body.to, toName:'Bram Quill', posted:true }); }
    return j({ ok:true });
  });

  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('ricky@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2200);

  console.log('\nThe Branch Manager can ask who is carrying what:\n');
  const door = page.locator('button:has-text("Load review")').first();
  ok('the door is on his home', await door.count() === 1);
  await door.click();
  await page.waitForTimeout(900);
  const t = await page.locator('body').innerText();
  ok('it opens on the load', /Load review/.test(t) && /What each desk is holding/.test(t));
  ok('and says what days in hand means', /open tasks divided by what that person actually closes/.test(t));

  console.log('\nEach desk, in its own currency:\n');
  const ada = await page.locator('[data-desk="ada"]').innerText();
  ok('the buried desk leads', /Ada Quill/.test(ada) && /120 open/.test(ada), ada.replace(/\n/g, ' / '));
  ok('with what is late and what has stopped', /30 late/.test(ada) && /12 not moving/.test(ada));
  ok('and sixty days of work in hand at two a day', /60 days in hand · 2 a day/.test(ada), ada.replace(/\n/g, ' / '));
  const cleo = await page.locator('[data-desk="cleo"]').innerText();
  ok('somebody with no rate is not given a number', /no rate yet/.test(cleo), cleo.replace(/\n/g, ' / '));
  ok('the heaviest desk is first on the page',
     (await page.locator('[data-desk]').first().getAttribute('data-desk')) === 'ada');

  console.log('\nThe move it proposes, and what it says:\n');
  const mv = page.locator('[data-move="00T000000000001AAA"]');
  ok('one move is offered', await mv.count() === 1);
  const mt = await mv.innerText();
  ok('naming the task, the two desks and the numbers',
     /Premium dues - one client/.test(mt) && /Ada Quill/.test(mt) && /Bram Quill/.test(mt) &&
     /holding 60 days of work/.test(mt) && /closed 40 of this type/.test(mt), mt.slice(0, 160));
  ok('the reason is offered as words he can change',
     (await mv.locator('textarea').inputValue()).indexOf('Nothing has happened to it in 31 days') === 0);
  ok('and it says the new owner will be told', /new owner is told on the task/.test(mt));

  await mv.locator('textarea').fill('Quiet a month. Bram has room this week and closes these.');
  await mv.locator('button:has-text("Move it to Bram Quill")').click();
  await page.waitForTimeout(600);
  const sent = posted[0];
  ok('the move names the task, the person and the line',
     !!sent && sent.taskId === '00T000000000001AAA' && sent.to === 'bram' &&
     /Bram has room this week/.test(sent.note), JSON.stringify(sent));
  const after = await page.locator('body').innerText();
  ok('it says where it went and that they were told', /Moved to Bram Quill, and told on the task/.test(after),
     (after.match(/Moved to[^\n]{0,60}/) || [''])[0]);
  ok('and the move is off the list', await mv.count() === 0);

  console.log('\nWhat has stopped moving, whether or not it can be moved:\n');
  ok('both quiet tasks are listed', /Portfolio to review - another client/.test(after) && /48d quiet/.test(after));
  ok('a task with no due date says so', /no due date/.test(after));
  ok('no javascript errors', !errors.length, errors.join(' | '));

  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
