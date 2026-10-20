// The strategic meeting page in a real browser against a mocked backend: the gate, a branch
// sign-in, the two days drawn with the branch manager's slot open, a contribution logged and
// counted, the Step-Back notes, the brief, a phone width with no sideways scroll, and the
// device-only fallback when the backend does not carry sm.* yet.
//
// Run: node tests/e2e-strategic-meeting.js   (needs playwright and a chromium on disk)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };
(async () => {
  const { chromium } = require('playwright');
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(0);
  const port = srv.address().port, base = 'http://127.0.0.1:' + port;
  const page = fs.readFileSync(path.join(ROOT, 'strategic-meeting/index.html'), 'utf8');
  const SVC = page.match(/const SVC = '([^']+)'/)[1];
  const browser = await chromium.launch(), items = [];
  let linked = true;
  const mock = async route => {
    const req = route.request(), u = new URL(req.url());
    let p = Object.fromEntries(u.searchParams.entries());
    if (req.method() === 'POST') p = JSON.parse(req.postData() || '{}');
    const me = p.code === 'BRANCH' ? { name: 'Branch', role: 'branch', canWrite: true } : p.code === 'AK' ? { name: 'Akaash Kalladeen', role: 'unit', canWrite: true } : null;
    const reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (!linked) return reply({ ok: false, error: 'Unknown action' });
    if (!me) return reply({ ok: false, refused: true, error: 'That agent number and password do not match.' });
    switch (p.action) {
      case 'sm.me': return reply({ ok: true, me, ai: false });
      case 'sm.list': return reply({ ok: true, items, me, ai: false });
      case 'sm.facts': return reply({ ok: true, facts: { at: 'now', campaign: { households: 2168, householdsAnswered: 410, letters: 1477, reminders: 1199, afterReminder: 128, outcomesWeek: 57 }, claims: { found: 3, sent: 2, paid: 1 }, team: { agents: 28, unitManagers: 1, staff: 4, unitList: [{ unit: 'A', agents: 20 }, { unit: 'B', agents: 8 }] }, lines: [] } });
      case 'sm.add': { const it = { id: 'SM-' + items.length, when: '20 Oct 10:00', day: p.day, session: p.session, title: p.title, kind: p.kind, point: p.point, evidence: p.evidence, ask: p.ask, by: me.name, role: me.role }; items.push(it); return reply({ ok: true, id: it.id, item: it }); }
      case 'sm.remove': { const i = items.findIndex(x => x.id === p.id); if (i >= 0) items.splice(i, 1); return reply({ ok: true }); }
    }
    return reply({ ok: false, error: 'Unknown action' });
  };

  console.log('\nA laptop, the branch manager:\n');
  let ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } }), pg = await ctx.newPage();
  await pg.route(u => String(u).startsWith(SVC), mock);
  await pg.goto(base + '/strategic-meeting/');
  await pg.waitForSelector('#gate:not(.hide)');
  ok('the gate shows first', await pg.isVisible('#gate'));
  await pg.fill('#code', 'wrong'); await pg.click('#gbtn');
  await pg.waitForFunction(() => document.getElementById('gerr').textContent.length > 0);
  ok('a wrong code is refused with the backend\'s words', /do not match/.test(await pg.textContent('#gerr')));
  await pg.fill('#code', 'BRANCH'); await pg.click('#gbtn');
  await pg.waitForSelector('#app:not(.hide)');
  ok('the branch opens', /Branch · Branch manager/.test(await pg.textContent('#whoami')));
  ok('the tiles carry the countdown and the live counts', /410 \/ 2168/.test(await pg.textContent('#tiles')) && /1 \/ 3/.test(await pg.textContent('#tiles')));
  const d1 = await pg.$$('#p-d1 article.sess'), d2 = await pg.$$('#p-d2 article.sess');
  ok('Day 1 has nine sessions and Day 2 seven', d1.length === 9 && d2.length === 7, d1.length + '/' + d2.length);
  ok('a Day 1 session is closed until tapped', !(await pg.isVisible('#s-d1-protect .bd')));
  await pg.click('#s-d1-protect .hd');
  ok('tapping opens it with the question, the record and the live counts', await pg.isVisible('#s-d1-protect .bd') && /Should the business we preserve/.test(await pg.textContent('#s-d1-protect .q')) && /Households answered 410/.test(await pg.textContent('#s-d1-protect .live')));
  await pg.click('[data-tab="d2"]');
  ok('the branch manager\'s slot opens by itself, marked', await pg.isVisible('#s-d2-recruit .bd') && /Your slot/.test(await pg.textContent('#s-d2-recruit .cnt')));
  await pg.selectOption('#k-d2-recruit', 'position'); await pg.fill('#p-d2-recruit', 'Reward the output, not the input.'); await pg.fill('#e-d2-recruit', 'The tracker counts names and interviews.');
  await pg.click('#s-d2-recruit .add .btn.gold');
  await pg.waitForFunction(() => document.querySelectorAll('#s-d2-recruit .item').length === 1);
  ok('a contribution is logged and shown with its kind and evidence', /Position/.test(await pg.textContent('#s-d2-recruit .item .k')) && /The tracker counts/.test(await pg.textContent('#s-d2-recruit .item')));
  ok('the tiles count it', /1\s*contributions logged/.test((await pg.textContent('#tiles')).replace(/\s+/g, ' ')) && /1\s*sessions with/.test((await pg.textContent('#tiles')).replace(/\s+/g, ' ')));
  ok('the guide button is off without a key', await pg.isDisabled('#s-d2-recruit .add .btn.ghost'));
  await pg.click('[data-tab="sb"]');
  ok('the Step-Back notes say what the record does not hold', /What the record does not hold/.test(await pg.textContent('#p-sb')) && /no document/i.test(await pg.textContent('#p-sb')));
  await pg.click('#p-sb .btn.gold');
  await pg.waitForFunction(() => document.getElementById('k-d2-recruit') && document.getElementById('k-d2-recruit').value === 'definition');
  ok('"Log the definition" opens the slot with the kind set', await pg.isVisible('#s-d2-recruit .bd'));
  await pg.click('[data-tab="brief"]');
  ok('the brief carries the logged contribution under its session', /Reward the output/.test(await pg.textContent('#p-brief')) && (await pg.$$('#p-brief article.sess')).length >= 11);
  await pg.click('[data-tab="log"]');
  ok('the logistics tab has the memo', /Wrightson Road/.test(await pg.textContent('#p-log')));
  await ctx.close();

  console.log('\nA phone, the unit manager:\n');
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); pg = await ctx.newPage();
  await pg.route(u => String(u).startsWith(SVC), mock);
  await pg.addInitScript(() => { localStorage.setItem('rrb-transition-code', 'AK'); localStorage.setItem('rrb-assign-who', 'Akaash'); });
  await pg.goto(base + '/strategic-meeting/');
  await pg.waitForSelector('#app:not(.hide)');
  ok('a device signed in to the board is signed in here', /Akaash Kalladeen · Unit manager/.test(await pg.textContent('#whoami')));
  ok('the unit manager sees the branch\'s contribution and cannot remove it', (await pg.$$('#s-d2-recruit .item')).length === 1 && !(await pg.$('#s-d2-recruit .item .x')));
  for (const t of ['d1', 'd2', 'sb', 'log', 'brief']) {
    await pg.click('[data-tab="' + t + '"]');
    const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('no sideways scroll on ' + t, over <= 1, over + 'px');
  }
  await pg.click('[data-tab="d2"]');
  await pg.fill('#p-d2-recruit', 'A recruit who leaves inside a year counts against activity.');
  await pg.click('#s-d2-recruit .add .btn.gold');
  await pg.waitForFunction(() => document.querySelectorAll('#s-d2-recruit .item').length === 2);
  ok('the unit manager logs and may remove his own only', (await pg.$$('#s-d2-recruit .item .x')).length === 1);
  await ctx.close();

  console.log('\nBefore the backend is pasted:\n');
  linked = false;
  ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } }); pg = await ctx.newPage();
  await pg.route(u => String(u).startsWith(SVC), mock);
  await pg.goto(base + '/strategic-meeting/');
  await pg.waitForSelector('#gate:not(.hide)');
  await pg.fill('#code', 'BRANCH'); await pg.click('#gbtn');
  await pg.waitForFunction(() => document.getElementById('gerr').textContent.length > 0);
  ok('the gate says to paste Service.gs and StrategicMeeting.gs', /StrategicMeeting\.gs/.test(await pg.textContent('#gerr')));
  await pg.addInitScript(() => { localStorage.setItem('rrb-transition-code', 'BRANCH'); localStorage.setItem('rrb-assign-who', ''); });
  await pg.goto(base + '/strategic-meeting/');
  await pg.waitForSelector('#app:not(.hide)');
  ok('a device already signed in opens with the device-only notice', /kept on this device only/.test(await pg.textContent('#linknote')));
  await pg.click('[data-tab="d2"]');
  await pg.fill('#p-d2-recruit', 'Kept here.'); await pg.click('#s-d2-recruit .add .btn.gold');
  await pg.waitForFunction(() => document.querySelectorAll('#s-d2-recruit .item').length === 1);
  const local = await pg.evaluate(() => JSON.parse(localStorage.getItem('rrb-sm-local') || '[]'));
  ok('the contribution is kept on the device', local.length === 1 && local[0].point === 'Kept here.');
  await pg.screenshot({ path: path.join(process.env.SHOT_DIR || '/tmp', 'sm-desk.png'), fullPage: true }).catch(() => {});
  await ctx.close();
  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall passed\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
