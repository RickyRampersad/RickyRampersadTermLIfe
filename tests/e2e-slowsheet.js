// Signing in when the sheet is slow.
//
// At 7:15 on the morning of 10 September the branch met "The sheet did not
// answer" on the sign-in screen. Nothing was broken: a ping against the live
// deployment took 28 seconds, then 22, then 3. The project had a
// fifty-four-thousand-row rebuild scheduled at seven and two wall screens
// reading Salesforce live every five minutes, and a request set no limit of
// its own — so the phone's own limit ended it, the fetch threw, and a person
// who had done nothing wrong was told to press the button again.
//
// The rebuilds moved into the small hours and the live feed is held for three
// minutes; that is in the Apps Script. This is the other half: what the
// screen does while the sheet is slow. It must set its own limit, try again
// on its own, say honestly that it is still trying, and get the person in.
//
// Run: node tests/e2e-slowsheet.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8815;

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0', unit:'Support',
            grade:'Sales Support Assistant · G3', role:'ssa', tier:'support', tierLabel:'Sales Support',
            tierOrder:4, reportsTo:'boss', manager:false, leads:[] };
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm', blocks: {
  KPI1:{ time:'8 – 10am', focus:'Premium Dues', kpi:'Renewa/PDl/Bill' } } } };

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

// dropFirst: how many login attempts die before one is answered.
// hang: attempts that never answer at all, so only the page's own limit ends them.
async function session(b, { dropFirst = 0, hang = false } = {}) {
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  const tries = { login: 0 };
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action === 'login') {
      tries.login++;
      if (hang) return;                                  // never answered: the page must end it
      if (tries.login <= dropFirst) return r.abort('connectionreset');
      return j({ ok:true, token:'t', profile: Object.assign({}, P, { attendance:{ first:true, at:'07:15', lastSeen:'07:15', status:'in', reason:'', late:0 } }),
                 roster:[P], schedule:SCH, kpis:[{ value:'Renewa/PDl/Bill', label:'Premium Dues' }] });
    }
    if (body.token !== 't') return j({ ok:false, error:'Session expired. Sign in again.', authRequired:true });
    // Resuming a session answers with the same shape a sign-in does; without
    // it the app has nobody to be and drops straight back to the login.
    if (body.action === 'me')
      return j({ ok:true, profile: Object.assign({}, P, { attendance:{ first:false, at:'07:15', lastSeen:'07:20', status:'in', reason:'', late:0 } }),
                 roster:[P], schedule:SCH, kpis:[{ value:'Renewa/PDl/Bill', label:'Premium Dues' }] });
    if (body.action === 'rows') return j({ ok:true, rows:[], metrics:{ ok:false, reason:'notConfigured' }, attendance:{} });
    return j({ ok:true });
  });
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('EL005'); await i[1].fill('1');
  return { page, ctx, errors, tries };
}

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  console.log('\nTwo dropped requests and the person is still signed in:\n');
  {
    const s = await session(b, { dropFirst: 2 });
    await s.page.click('button:has-text("Sign in")');
    // The first try dies at once and the second is 1.5s behind it, so this is
    // the window in which the button has to be saying what is going on.
    await s.page.waitForTimeout(2000);
    ok('the button says it is still trying, and which try',
       /Still trying/.test(await s.page.locator('button[type=submit]').innerText()),
       await s.page.locator('button[type=submit]').innerText());
    await s.page.waitForTimeout(6000);
    ok('it tried three times without anybody pressing anything', s.tries.login === 3, String(s.tries.login));
    ok('and the person is in', !(await s.page.locator('button:has-text("Sign in")').count()),
       (await s.page.locator('body').innerText()).slice(0, 90));
    ok('nobody was told to press it again', !/press Sign in once more/i.test(await s.page.locator('body').innerText()));
    ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  console.log('\nA request the sheet never answers is ended by the page, not the phone:\n');
  {
    // Nothing here fulfils the route, so the only thing that can end the first
    // attempt is the page's own limit. This is the exact 7:15 failure.
    const s = await session(b, { hang: true });
    await s.page.click('button:has-text("Sign in")');
    await s.page.waitForTimeout(1500);
    ok('one attempt is in flight', s.tries.login === 1, String(s.tries.login));
    const until = Date.now() + 50000;
    while (Date.now() < until && s.tries.login < 2) await s.page.waitForTimeout(1000);
    ok('the page gives up on it and goes again by itself, inside a minute',
       s.tries.login >= 2, 'still on attempt ' + s.tries.login);
    ok('and says so on the button rather than sitting there',
       /Still trying/.test(await s.page.locator('button[type=submit]').innerText()),
       await s.page.locator('button[type=submit]').innerText());
    ok('it counts up to four, not three',
       /of 4/.test(await s.page.locator('button[type=submit]').innerText()),
       await s.page.locator('button[type=submit]').innerText());
    ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  console.log('\nWhen every try is spent, the message is honest:\n');
  {
    const s = await session(b, { dropFirst: 99 });
    await s.page.click('button:has-text("Sign in")');
    const until = Date.now() + 30000;
    let t = '';
    while (Date.now() < until) {
      t = await s.page.locator('body').innerText();
      if (/did not answer, after/.test(t)) break;
      await s.page.waitForTimeout(500);
    }
    ok('it says how many times it tried', /did not answer, after 4 tries/.test(t), (t.match(/did not answer[^\n]*/) || ['not found'])[0]);
    ok('it says busy rather than broken', /busy, not broken/.test(t));
    ok('and it does not blame the person or their phone', !/weak signal|restart/i.test(t));
    ok('four attempts, no more', s.tries.login === 4, String(s.tries.login));
    ok('the button is usable again', await s.page.locator('button:has-text("Sign in")').count() === 1);
    ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  await b.close();
  server.close();
  console.log();
  console.log(fails ? `  ${fails} FAILED` : '  all good');
  process.exit(fails ? 1 : 0);
})();
