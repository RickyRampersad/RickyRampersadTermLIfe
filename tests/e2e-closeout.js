// Before you leave, on the screen.
//
// The register said a person was here; it never said what they left behind.
// The branch asked for the other half on 10 September — gauge what was
// actually done, and ask while the person is still at the desk.
//
// What has to be true in the browser: the list is on the close-the-day card
// with the count still open; a line the sheet already answered shows as read,
// with the evidence it read, and cannot be asked again; a line it cannot see
// is a question with a tap; the "written to" line offers the screen that
// answers it as well as the honest "nothing today"; ticking sends only the
// line's own id; and a server that has never heard of a close-out — an older
// deployment behind a newer page — breaks nothing and falls back to the
// sentence the card carried before.
//
// Run: node tests/e2e-closeout.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8814;

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
  KPI1:{ time:'8 – 10am', focus:'Premium Dues', kpi:'Renewa/PDl/Bill' },
  KPI2:{ time:'10 – 12pm', focus:'Premium Dues', kpi:'Renewa/PDl/Bill' },
  PM1:{ time:'1 – 3pm', focus:'Reporting', kpi:'Reporting' },
  PM2:{ time:'3 – 4pm', focus:'Reporting', kpi:'Reporting' } } } };

const OPEN = { ok:true, date:'2026-09-10', staffId:'demo', name:'Demo Account', of:3, left:1, complete:false,
  items:[
    { id:'blocks',  item:'Every block reported', auto:'blocks', done:true,  detail:'4 of 4 reported', by:'checked', at:'', reason:'' },
    { id:'mail',    item:'Afternoon mail sweep cleared', auto:'mail', done:true, detail:'swept at 14:10', by:'checked', at:'', reason:'' },
    { id:'written', item:'Anything you were written to about, or fell short on, noted', auto:'written',
      done:false, detail:'nothing noted today', by:'', at:'', reason:'' } ] };
const DONE = { ok:true, date:'2026-09-10', staffId:'demo', name:'Demo Account', of:3, left:0, complete:true,
  items: OPEN.items.map(i => Object.assign({}, i, { done:true,
    detail: i.id === 'written' ? 'said done at 15:47' : i.detail })) };

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

async function session(b, knowsCloseout, sent) {
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  let ticked = false;
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action !== 'login' && body.token !== 't') return j({ ok:false, error:'Session expired. Sign in again.', authRequired:true });
    if (body.action === 'login' || body.action === 'me')
      return j({ ok:true, token:'t',
                 profile: Object.assign({}, P, { attendance:{ first:false, at:'08:02', lastSeen:'15:40', status:'in', reason:'', late:0 } }),
                 roster:[P], schedule:SCH, kpis:[{ value:'Renewa/PDl/Bill', label:'Premium Dues' }, { value:'Reporting', label:'Reporting' }] });
    if (body.action === 'rows') return j({ ok:true, rows:[], metrics:{ ok:false, reason:'notConfigured' },
                                           attendance:{ demo:{ at:'08:02', lastSeen:'15:40', out:'', status:'in', reason:'', late:0 } } });
    if (body.action === 'standing') return j({ ok:true });
    if (body.action === 'closeout') {
      // An older deployment answers every unknown action with a bare ok.
      if (!knowsCloseout) return j({ ok:true });
      return j(ticked ? DONE : OPEN);
    }
    if (body.action === 'tickCloseout') { sent.push(body); ticked = true; return j(DONE); }
    return j({ ok:true });
  });
  await page.clock.setFixedTime(new Date('2026-09-10T15:47:00'));
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('demo@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2200);
  return { page, ctx, errors };
}

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  console.log('\nThe list is on the card that closes the day:\n');
  const sent = [];
  let s = await session(b, true, sent);
  const card = s.page.locator('div', { hasText: /^Close the day/ }).last();
  await s.page.locator('text=Before you leave').first().scrollIntoViewIfNeeded();
  let t = await s.page.locator('body').innerText();
  ok('it is headed for what it is', /before you leave/i.test(t));
  ok('and says how much is still open', /1 thing of 3 still open/.test(t), (t.match(/\d+ thing[^\n]*/) || ['not found'])[0]);
  ok('a line the sheet answered shows the evidence it read',
     /4 of 4 reported/.test(t) && /swept at 14:10/.test(t));
  ok('the one it cannot see says so', /nothing noted today/.test(t));
  ok('and the sign-out button is still there — it is a question, not a gate',
     await s.page.locator('button:has-text("Sign out and close the day")').count() === 1);

  console.log('\nOnly the open line is asked, and the written one twice over:\n');
  ok('nothing is offered against a line already in',
     (t.match(/Mark it done/g) || []).length === 0, String((t.match(/Mark it done/g) || []).length));
  ok('the written line offers the screen that answers it',
     await s.page.locator('button:has-text("Note it")').count() === 1);
  ok('and the honest answer beside it',
     await s.page.locator('button:has-text("Nothing today")').count() === 1);

  console.log('\nTicking it records that line and nothing else:\n');
  await s.page.locator('button:has-text("Nothing today")').click();
  await s.page.waitForTimeout(900);
  ok('one call went out', sent.length === 1, JSON.stringify(sent));
  ok('carrying the line\'s own id and no more',
     sent.length === 1 && sent[0].action === 'tickCloseout' && sent[0].itemId === 'written' &&
     sent[0].status === undefined, JSON.stringify(sent[0]));
  t = await s.page.locator('body').innerText();
  ok('and the card says the day is closed out', /Everything on your list is in/.test(t), (t.match(/Everything[^\n]*/) || ['not found'])[0]);
  ok('with the tick reading as the person\'s word', /said done at 15:47/.test(t));
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  console.log('\nAn older deployment behind a newer page breaks nothing:\n');
  const none = [];
  s = await session(b, false, none);
  t = await s.page.locator('body').innerText();
  ok('no list is drawn', !/before you leave/i.test(t));
  ok('and the card falls back to what it always said',
     /Still open:|Everything is in/.test(t), (t.match(/Still open:[^\n]*/) || ['not found'])[0]);
  ok('the day can still be closed',
     await s.page.locator('button:has-text("Sign out and close the day")').count() === 1);
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  await b.close();
  server.close();
  console.log();
  console.log(fails ? `  ${fails} FAILED` : '  all good');
  process.exit(fails ? 1 : 0);
})();
