// Attendance on the screen.
//
// Signing in is the register. What has to be true in the browser: the first
// sign-in of the day opens on the plan whatever the clock says, and a later
// one opens on the day; the sign-in line says when you started and against
// your own start; "Not in today?" sends the reason and nothing else; and the
// Branch Manager's team list says who is in, who is not and why, and who has
// not signed in at all.
//
// Run: node tests/e2e-attendance.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8790;

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
               grade:'Branch Manager', role:'bm', tier:'management', tierLabel:'Management', tierOrder:1, reportsTo:'', manager:true, leads:['demo','two'] };
const TWO = { staffId:'two', name:'Demo Two', email:'two@example.com', agentNumber:'D2', unit:'Support',
              grade:'Sales Support Assistant · G3', role:'ssa', tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'boss', manager:false, leads:[] };
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm', blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues', kpi:'Renewa/PDl/Bill'}, KPI2:{time:'10 – 12pm', focus:'x'}, PM1:{time:'1 – 3pm', focus:'y'}, PM2:{time:'3 – 4pm', focus:'z'} } },
              boss: { hours:'8am – 5pm', lunch:'Flexible', blocks: { KPI1:{time:'8 – 10am', focus:'a'}, KPI2:{time:'10 – 12pm', focus:'b'}, PM1:{time:'1 – 3pm', focus:'c'}, PM2:{time:'3 – 5pm', focus:'d'} } },
              two: { hours:'9am – 5pm', lunch:'1 – 2pm', blocks: { KPI1:{time:'9 – 11am', focus:'a'}, KPI2:{time:'11 – 1pm', focus:'b'}, PM1:{time:'2 – 3:30pm', focus:'c'}, PM2:{time:'3:30 – 5pm', focus:'d'} } } };

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

const WEEK = { ok:true, from:'2026-09-07', to:'2026-09-14', people:['boss','demo','two'], attendance:[
  { date:'2026-09-07', staffId:'boss', at:'07:52', lastSeen:'07:52', status:'in', reason:'', late:0, markedBy:'boss' },
  { date:'2026-09-07', staffId:'demo', at:'08:31', lastSeen:'11:02', status:'in', reason:'', late:31, markedBy:'demo' },
  { date:'2026-09-07', staffId:'two', at:'', lastSeen:'', status:'absent', reason:'sick', late:0, markedBy:'boss' } ] };

async function session(b, who, attendance, rowsAttendance, absents) {
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action === 'login' || body.action === 'me')
      return j({ ok:true, token:'t', profile: Object.assign({}, who, { attendance }), roster:[P, TWO, BOSS], schedule:SCH, kpis:{ ssa:[], bm:[] } });
    if (body.action === 'rows') return j(Object.assign({ ok:true, rows:[], metrics:{ ok:false, reason:'notConfigured' } }, rowsAttendance ? { attendance: rowsAttendance } : {}));
    if (body.action === 'attendance') return j(WEEK);
    if (body.action === 'absent') { absents.push(body); return j({ ok:true, date:'2026-09-07', staffId: who.staffId, status:'absent', reason: body.reason }); }
    return j({ ok:true });
  });
  await page.clock.setFixedTime(new Date('2026-09-07T11:30:00'));   // well after ten
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
  const absents = [];

  console.log('\nThe first sign-in of the day opens on the plan, at half past eleven:\n');
  let s = await session(b, P, { first:true, at:'11:30', lastSeen:'11:30', status:'in', reason:'', late:200 }, {}, absents);
  let t = await s.page.locator('body').innerText();
  ok('it lands on the plan', /Set the day before it starts/.test(t), t.slice(0, 80));
  ok('and says when they started, against their own start', /In at 11:30 · 200 minutes after your start/.test(t), (t.match(/In at [^\n]{0,60}/) || [''])[0]);
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  console.log('\nA second sign-in opens on the day:\n');
  s = await session(b, P, { first:false, at:'08:04', lastSeen:'11:30', status:'in', reason:'', late:0 }, {}, absents);
  t = await s.page.locator('body').innerText();
  ok('it lands on the day, not the plan', /Submit each block as it ends/.test(t) && !/Set the day before it starts/.test(t));
  await s.page.click('button:has-text("Plan the day")');
  await s.page.waitForTimeout(500);
  t = await s.page.locator('body').innerText();
  ok('the plan says on time', /In at 08:04 · on time/.test(t));

  console.log('\nNot in today:\n');
  await s.page.click('button:has-text("Not in today?")');
  await s.page.waitForTimeout(300);
  await s.page.click('button:has-text("On leave")');
  await s.page.locator('input[placeholder*="Anything to add"]').fill('back Thursday');
  await s.page.click('button:has-text("Record: not in today")');
  await s.page.waitForTimeout(600);
  ok('one record went out', absents.length === 1, String(absents.length));
  ok('with the reason and nothing else', absents[0] && absents[0].reason === 'On leave — back Thursday' && absents[0].staffId === undefined, JSON.stringify(absents[0]));
  t = await s.page.locator('body').innerText();
  ok('and the line now says so', /Not in today · On leave — back Thursday/.test(t));
  ok('a person who leads nobody gets no team register link', !/Team register/.test(t));
  await s.ctx.close();

  console.log('\nThe Branch Manager\'s team list:\n');
  s = await session(b, BOSS, { first:true, at:'07:52', lastSeen:'07:52', status:'in', reason:'', late:0 },
    { boss:{ at:'07:52', status:'in', reason:'', late:0 }, demo:{ at:'08:31', status:'in', reason:'', late:31 }, two:{ at:'', status:'absent', reason:'sick', late:0 } }, absents);
  t = await s.page.locator('body').innerText();
  ok('who is in, and how far after their start', /In at 08:31 · 31 min after start/.test(t), (t.match(/In at [^\n]{0,50}/g) || []).join(' | '));
  ok('who is not, and why', /Not in · sick/.test(t));
  ok('and the register is a tap away', await s.page.locator('button:has-text("Attendance register")').count() === 1);
  await s.page.click('button:has-text("Attendance register")');
  await s.page.waitForTimeout(900);
  t = await s.page.locator('body').innerText();
  ok('the week opens', /Attendance register/.test(t) && /Week of 7 Sept/.test(t), (t.match(/Week of [^\n]*/) || [''])[0]);
  ok('a person a row, a day a column', /Demo Account/.test(t) && /Demo Two/.test(t) && /Mon 7 Sept/i.test(t) && /Fri 11 Sept/i.test(t));
  ok('the time, the minutes over, the reason', /08:31 \(\+31\)/.test(t) && /not in · sick/.test(t) && /07:52/.test(t));
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  console.log('\nAn older server that says nothing about attendance:\n');
  s = await session(b, BOSS, undefined, null, absents);
  t = await s.page.locator('body').innerText();
  ok('the team list does not claim nobody signed in', !/No sign-in yet/.test(t));
  ok('and the branch opens as before', /the team|submit each block/i.test(t), t.slice(0, 120));
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
