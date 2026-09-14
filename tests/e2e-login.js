// Kamla, 2 September, 3:00pm: "Server returned 404." on the sign-in screen.
//
// Nothing was wrong with her password or the address. Apps Script answers a
// POST with a redirect to a one-shot result page, and at three o'clock — with
// the branch checkpoint and the staff nudge both running on the same script —
// that page is not always ready. The browser sees 404 and the tracker treated
// it as the final word.
//
// Run: node tests/e2e-login.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const KAMLA = { staffId:'kamla', name:'Kamla Dookran', email:'kamla@example.com', agentNumber:'KD001',
                unit:'Branch', grade:"Branch Manager's Assistant · G4", role:'bma',
                tier:'bma', tierLabel:'Branch Manager’s Assistant', tierOrder:2, reportsTo:'ricky', manager:false };
const SCHEDULE = { kamla: { start:'08:00', end:'16:00', lunch:'12:00-13:00',
  blocks: { KPI1:{time:'8 – 10am', focus:'Branch administration'}, KPI2:{time:'10 – 12pm', focus:'Contracts'},
            PM1:{time:'1 – 3pm', focus:'Reporting'}, PM2:{time:'3 – 4pm', focus:'Task management'} } } };

let fails = 0, loginTries = 0, refuseFirst = 2, meDown = 0, meRefuse = false;
/* The register is its own call now, so the test can break it on its own —
   which is the whole point: a sign-in must not depend on it. */
let regTries = 0, regFails = false;
const ATT = { first:false, at:'08:00', lastSeen:'08:00', status:'in', reason:'', late:0 };
const ok = (l,c,x='') => { console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:'')); if(!c) fails++; };

(async () => {
  await new Promise(r => server.listen(8792, r));
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();

  await page.route('**/macros/s/**', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    const reply = j => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(j) });
    if (body.action !== 'login' && body.token !== 'tok') return reply({ ok:false, error:'Session expired. Sign in again.', authRequired:true });
    if (body.action === 'login') {
      loginTries++;
      // the result page is not ready yet — twice, as it was at three o'clock
      if (loginTries <= refuseFirst)
        return route.fulfill({ status:404, contentType:'text/html', body:'Page Not Found' });
      // No attendance in the answer: the register is written afterwards.
      return reply({ ok:true, token:'tok', profile: Object.assign({}, KAMLA, { attendance:null }), roster:[KAMLA], schedule:SCHEDULE, kpis:{} });
    }
    if (body.action === 'me' && meDown > 0) { meDown--; return route.abort('connectionreset'); }
    if (body.action === 'me' && meRefuse) return reply({ ok:false, error:'Session expired. Sign in again.', authRequired:true });
    if (body.action === 'me') return reply({ ok:true, profile: Object.assign({}, KAMLA, { attendance:null }), roster:[KAMLA], schedule:SCHEDULE, kpis:{} });
    if (body.action === 'register') {
      regTries++;
      // What a workbook that cannot recalculate actually does to a write.
      if (regFails) return reply({ ok:false, error:'The register did not take it: timed out' });
      return reply({ ok:true, attendance: ATT });
    }
    if (body.action === 'rows') return reply({ ok:true, rows:[] });
    if (body.action === 'training') return reply({ ok:true, training:[] });
    return reply({ ok:true });
  });

  console.log('\nKamla signs in while the three o\'clock reports are running:\n');
  await page.goto('http://localhost:8792/kpi/', { waitUntil:'networkidle' });
  const inputs = await page.$$('input');
  await inputs[0].fill('KD001');
  await inputs[1].fill('1');
  await page.click('button:has-text("Sign in")');

  await page.waitForTimeout(600);
  const waiting = await page.locator('text=/Signing in/').count();
  ok('the button says the wait is expected', waiting > 0);

  await page.waitForTimeout(7000);
  ok('it tried again instead of stopping at the first 404', loginTries >= 3, loginTries + ' attempts');
  ok('she is signed in, not staring at an error', await page.locator('text=YOUR DAY').count() > 0);
  ok('"Server returned 404." is nowhere on screen', await page.locator('text=Server returned 404').count() === 0);

  console.log('\nThe button has to look busy, not frozen:\n');
  // Sasha pressed Sign in five times on 3 September because one static label
  // sat there for half a minute. Watch the label move through the retries.
  await page.evaluate(() => localStorage.clear());
  refuseFirst = 2; loginTries = 0;
  await page.reload({ waitUntil:'networkidle' });
  const i3 = await page.$$('input');
  await i3[0].fill('KD001'); await i3[1].fill('1');
  const seen = new Set();
  const watch = setInterval(async () => {
    try { seen.add((await page.locator('button[type="submit"]').innerText()).trim()); } catch (e) {}
  }, 250);
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(6500);
  clearInterval(watch);
  const labels = [...seen];
  ok('it says it is still trying', labels.some(l => /Still trying/.test(l)), labels.join(' | '));
  ok('and counts the attempt', labels.some(l => /\(\d of \d\)/.test(l)), labels.join(' | '));
  ok('the button was never left blank', !labels.some(l => l === ''));

  console.log('\nAnd when the sheet really is unreachable, she is told plainly:\n');
  await page.evaluate(() => localStorage.clear());
  refuseFirst = 99; loginTries = 0;
  await page.reload({ waitUntil:'networkidle' });
  const i2 = await page.$$('input');
  await i2[0].fill('KD001');
  await i2[1].fill('1');
  await page.click('button:has-text("Sign in")');
  // Four tries, 1.5s / 3s / 4.5s apart — a slow sheet is given longer than it
  // was, because on 10 September three was not enough and the branch was
  // locked out at a quarter past seven.
  for (let w = 0; w < 30 && !(await page.locator('text=/busy, not broken/').count()); w++) await page.waitForTimeout(500);
  const msg = await page.locator('text=/busy, not broken/').count();
  ok('the message says busy, not broken', msg > 0);
  ok('and it stopped after four tries', loginTries === 4, loginTries + ' attempts');

  console.log('\nA dropped request while the page starts must not cost her the session:\n');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('rrb_kpi_token', 'tok'); });
  meDown = 99; refuseFirst = 0; loginTries = 0;
  await page.reload({ waitUntil: 'networkidle' });
  // four tries, 1.5s / 3s / 4.5s apart
  for (let w = 0; w < 30 && !(await page.locator('button:has-text("Sign in")').count()); w++) await page.waitForTimeout(500);
  await page.waitForTimeout(500);
  const kept = await page.evaluate(() => localStorage.getItem('rrb_kpi_token'));
  ok('the sign-in screen shows', await page.locator('button:has-text("Sign in")').count() === 1);
  ok('and says the sheet did not answer, not that she was signed out', await page.locator('text=/did not answer/').count() > 0);
  ok('and says a reload carries on', await page.locator('text=/reload the page to carry on/').count() > 0);
  ok('the session is still on the device', kept === 'tok', String(kept));
  meDown = 0;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok('when the sheet answers again, a reload resumes the day without a sign-in', await page.locator('text=YOUR DAY').count() > 0 && await page.locator('button:has-text("Sign in")').count() === 0);

  console.log('\nThe register is written after she is in, never before:\n');
  // 14 September: a formula in the portfolio tab exceeded Google's own limits,
  // the workbook stopped recalculating, and sign-in — the one action nobody can
  // work around — was the only thing on the tracker that WROTE to it. Two
  // people lost a morning to "the sheet did not answer". The register is now a
  // separate call, and this is the assertion that keeps it that way.
  await page.evaluate(() => localStorage.clear());
  refuseFirst = 0; loginTries = 0; regTries = 0; regFails = true;
  await page.reload({ waitUntil:'networkidle' });
  const i4 = await page.$$('input');
  await i4[0].fill('KD001'); await i4[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2500);
  ok('she is signed in even though the register would not take it',
     await page.locator('text=YOUR DAY').count() > 0);
  ok('the sign-in itself was one attempt, not four', loginTries === 1, loginTries + ' attempts');
  ok('and nothing about a sheet that did not answer is on her screen',
     await page.locator('text=/did not answer|busy, not broken/').count() === 0);
  ok('the register was tried, and its failure was survivable', regTries >= 1, regTries + ' tries');

  console.log('\nAnd when the register does take it, the line fills in:\n');
  await page.evaluate(() => localStorage.clear());
  regTries = 0; regFails = false; loginTries = 0;
  await page.reload({ waitUntil:'networkidle' });
  const i5 = await page.$$('input');
  await i5[0].fill('KD001'); await i5[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2500);
  // The register's own line lives on the plan view, which is where somebody
  // checks what time they were marked in.
  await page.click('text=← Plan the day');
  for (let w = 0; w < 20 && !(await page.locator('text=/In at 08:00/').count()); w++) await page.waitForTimeout(300);
  ok('her sign-in time reached the screen', await page.locator('text=/In at 08:00/').count() > 0);
  ok('and it was written exactly once', regTries === 1, regTries + ' writes');

  console.log('\nWhereas a session the sheet refuses is cleared, as before:\n');
  await page.evaluate(() => localStorage.setItem('rrb_kpi_token', 'stale'));
  meRefuse = true;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok('the sign-in screen shows with the session-ended note', await page.locator('button:has-text("Sign in")').count() === 1 && await page.locator('text=/Your session ended/').count() > 0);
  ok('and the stale session is gone from the device', (await page.evaluate(() => localStorage.getItem('rrb_kpi_token') || '')) === '');
  meRefuse = false;

  await browser.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
