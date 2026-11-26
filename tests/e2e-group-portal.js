// The group's page as a portal (26 November 2026): one menu with each thing in its own place, Home first, the
// "What would you like to do?" drop-down, Your people in three parts, Help with HELP 868, and the branch teal in place
// of the corporate blue. The backend is mocked; the group, the people and every figure are invented.
// Phone, tablet (both ways) and laptop; no sideways scroll, no page errors.  Run: node tests/e2e-group-portal.js
const { chromium } = require('playwright'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = 8873, U = 'http://localhost:' + PORT + '/groupclientmanagement/client.html';
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(res => http.get(U, r => { r.resume(); res(true); }).on('error', () => res(false)));

const item = (id, cat, title, extra) => Object.assign({ id, cat, title, type: 'Servicing', who: '', owner: 'Kerry Sample', opened: '2026-11-02', age: 24, due: '2026-11-30', late: false,
  ref: '', status: 'In progress with us', done: 'With our team.', story: null, comments: [], answer: null }, extra || {});
const CLIENT = { ok: true, group: 'Sample Freight Ltd', staff: 'Kerry Sample', asAt: '26 Nov 2026, 9:00 AM', today: '2026-11-26', respondBy: '2026-11-27',
  items: [item('t1', 'Group Health', 'Claim payment account for an employee'), item('t2', 'Group Health', 'Tier change for an employee', { late: true, due: '2026-11-20' }),
    item('t3', 'Group Pensions', 'Contribution schedule correction')],
  record: [{ type: 'Group Health', done: 9, onTimePct: 89, avgDays: 4, open: 2 }], doneWeek: 2, nextLetter: 'Monday 30 Nov, 10:00',
  year: { year: '2026', done: 9, member: 3, onTimePct: 89, avgDays: 4, months: [{ m: '2026-10', done: 4, member: 1 }, { m: '2026-11', done: 5, member: 2 }], trend: [] },
  pending: [{ applicant: 'An employee', lines: ['Group Life'], days: 20, late: false, applied: '2026-11-06', since: '2026-11-06', apps: 1, incs: 0, last: null,
    items: [{ kind: 'requirement', what: 'Evidence of insurability', owner: 'Kerry Sample', with: 'Guardian Life', status: 'Waiting on Guardian Life', due: '2026-12-04', late: false, last: '' }] }],
  coming: { count: 1, convertAge: 65, depAge: 21, retireYears: 5, convert: [{ person: 'Sam Sample', line: 'Group Life', date: '2027-03-01', inDays: 95 }], deps: [], retire: [], nodob: [] },
  billing: { lines: [{ line: 'health', label: 'Group Health', owed: 420, bill: { month: '2026-11', label: 'November 2026', due: 2100, dueBy: '2026-11-30', members: 7, joined: 1, left: 0, arrears: 0, sentAt: '' },
    history: [{ label: 'October 2026', billed: 2100, paid: 1680, paidOn: '2026-10-28', status: 'Part paid' }], changes: [], openItems: 0, claims: null }],
    contact: '', nextBill: { day: '2026-12-26', label: '26 Dec 2026' },
    statement: { month: '2026-11', label: 'November 2026', total: 2100, dueBy: '2026-11-30', lines: [{ label: 'Group Health', members: 7, due: 2100 }], owed: [], owedTotal: 420, grand: 2520, changes: { joined: 1, left: 0 } } } };

async function mock(page, W) {
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, r => r.abort());
  await page.route(/script\.google(usercontent)?\.com/, async route => {
    const req = route.request(), q = Object.fromEntries(new URL(req.url()).searchParams.entries());
    let b = q, a = q.action;
    if (req.method() === 'POST') { try { b = JSON.parse(req.postData() || '{}'); a = b.action; } catch (e) { b = {}; } W.posts.push(b); }
    if (!a) return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    if (b.lb !== 'SFL 0001' || b.code !== 'ABC123') return json(route, { ok: false, error: 'That list bill and access code do not match.' });
    if (a === 'gcm.client') return json(route, JSON.parse(JSON.stringify(CLIENT)));
    if (a === 'gcm.renGroup') return json(route, { ok: true, renewals: [] });
    if (a === 'gcm.clientPeople') return json(route, { ok: true, year: '2026', bills: [], counts: { pending: 0, active: 1, off: 0, all: 1 },
      people: [{ key: 'p1', name: 'Sam Sample', first: 'Sam', active: true, offYear: false, pendingNow: false, pending: null, lines: [{ label: 'Group Health', tier: 'Single', since: '2020-01-01', onBill: 'November 2026' }], off: [], leaving: [], joining: [], items: [], posts: [] }] });
    if (a === 'gcm.clientForm' && b.form === 'invite') return json(route, { ok: true, invites: [], live: false, counts: { waiting: 0, ready: 0, sent: 0 }, tiers: [] });
    if (a === 'gcm.review') return json(route, { ok: true, saved: (b.items || []).length + 1 });
    if (a === 'gcm.clientTell') return json(route, { ok: true, said: 'Thank you. Our team has it.' });
    return json(route, { ok: false, error: 'Unknown action (mock): ' + a });
  });
}
const noSideways = page => page.evaluate(() => { window.scrollTo(600, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0; });
const isBlue = rgb => /rgb\(\s*(19,\s*64,\s*143|29,\s*91,\s*196|42,\s*111,\s*216)\b/.test(rgb);

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await sleep(100);
  const browser = await chromium.launch();
  const sizes = [{ name: 'phone', width: 390, height: 844, mobile: true }, { name: 'tablet upright', width: 820, height: 1180, mobile: true },
    { name: 'tablet on its side', width: 1024, height: 768, mobile: false }, { name: 'laptop', width: 1440, height: 900, mobile: false }];
  for (const vp of sizes) {
    console.log('\nThe group portal on a ' + vp.name + ':\n');
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage(), errs = [], W = { posts: [] };
    page.on('pageerror', e => errs.push(e.message));
    await mock(page, W);
    await page.goto(U, { waitUntil: 'domcontentloaded' });
    ok('the sign-in is the split screen, with no blue', await page.$('.gatewrap .gl') !== null && !isBlue(await page.$eval('.mast', el => getComputedStyle(el).backgroundImage)));
    await page.fill('#lb', 'SFL 0001'); await page.fill('#code', 'ABC123'); await page.click('#go');
    await page.waitForSelector('#side .nv', { timeout: 10000 }).catch(() => {});
    ok('it opens on Home', (await page.$eval('#app', el => el.className)) === 'ct-home' && /Good (morning|afternoon|evening)/.test(await page.textContent('#app .phd h1')));
    const nav = await page.$$eval('#side .nv', els => els.map(e => e.dataset.ct || 'more'));
    ok('one menu, grouped: Home, items, billing, people, then Join & leave and Help', ['home', 'items', 'billing', 'people', 'forms', 'help'].every(k => nav.indexOf(k) >= 0), nav.join(','));
    ok('the header names the group and who looks after it', /Sample Freight Ltd/.test(await page.textContent('#h1')) && /Kerry Sample/.test(await page.textContent('#hsub')));
    const heads = await page.$$eval('#app .pnl > .h h2', els => els.map(e => e.textContent));
    ok('what needs them comes before what they can do', heads.indexOf('Needs your attention') >= 0 && heads.indexOf('Needs your attention') < heads.indexOf('What would you like to do?'), heads.join(' | '));
    const acts = await page.textContent('#app');
    ok('needs your attention: the items, the amount open, the pending application', /3 still to answer/.test(acts) && /TT\$420\.00 still open on Group Health/.test(acts) && /application or increase pending/.test(acts));
    ok('the figures open their page', (await page.$$('#app .kpi[data-go]')).length === 4);
    // the drop-down
    const opts = await page.$$eval('#todo option', els => els.map(e => e.textContent));
    ok('the drop-down lists what they can do, in plain words', ['Check this week’s items', 'Tell us about a payment', 'Add a new employee', 'Someone has left, or a change', 'See my bill', 'Get help, or ask us on WhatsApp'].every(t => opts.indexOf(t) >= 0), opts.join(' | '));
    await page.click('#todogo');
    ok('Go with nothing chosen goes nowhere', (await page.$eval('#app', el => el.className)) === 'ct-home');
    await page.selectOption('#todo', { label: 'Tell us about a payment' }); await page.click('#todogo'); await sleep(250);
    ok('"Tell us about a payment" opens Billing on the payment box', (await page.$eval('#app', el => el.className)) === 'ct-billing' && (await page.inputValue('#tkind')) === 'payment' && await page.isVisible('#tpay'));
    ok('the change form is no longer inside Billing', await page.$('#chg') === null);
    await page.click(vp.width <= 640 ? '#side [data-ct="home"]' : '#side [data-ct="home"]'); await sleep(150);
    await page.selectOption('#todo', { label: 'Add a new employee' }); await page.click('#todogo'); await sleep(400);
    ok('"Add a new employee" opens Join & leave on Enrol a new member', (await page.$eval('#app', el => el.className)) === 'ct-forms' && /Enrol a new member/.test(await page.$eval('.cfpb.on', el => el.textContent)));
    if (vp.width <= 640) ok('on a phone, More is lit while Join & leave is open', await page.$eval('#side .nv.more', el => el.classList.contains('on')));
    // your people in three parts
    if (vp.width <= 640) { await page.click('#side [data-more]'); await sleep(150); ok('More opens the rest of the menu', await page.isVisible('#side .xs [data-ct="help"]')); await page.click('#side [data-more]'); }
    await page.click('#side [data-ct="people"]'); await sleep(300);
    const segs = await page.$$eval('#app .sg', els => els.map(e => e.textContent));
    ok('Your people: pending, coming up, everyone', segs.length === 3 && /Pending applications/.test(segs[0]) && /Coming up/.test(segs[1]) && /Everyone/.test(segs[2]), segs.join(' | '));
    ok('it opens on the pending applications', await page.$('#app .pend') !== null);
    await page.click('#app .sg[data-pv="coming"]'); await sleep(200);
    ok('Coming up shows who turns 65', /Sam Sample/.test(await page.textContent('#app .coming')));
    await page.click('#app .sg[data-pv="list"]'); await sleep(600);
    ok('Everyone lists the people, with the Show drop-down', await page.$('#pf') !== null && /Sam Sample/.test(await page.textContent('#plist')));
    // help
    if (vp.width <= 640) { await page.click('#side [data-more]'); await sleep(150); }
    await page.click('#side [data-ct="help"]'); await sleep(200);
    ok('Help leads with HELP 868 on WhatsApp', /HELP 868 on WhatsApp/.test(await page.textContent('#app')) && /wa\.me\/18684357868/.test(await page.$eval('#app a.btn.wa', el => el.href)));
    ok('no telephone number on the page', !/tel:|\(868\)/.test(await page.content()));
    // the weekly answers still go
    await page.click('#side [data-ct="items"]'); await sleep(250);
    ok('Your items groups the items by kind of work', (await page.$$eval('#app .cat', els => els.map(e => e.textContent))).join('|') === 'Group Health|Group Pensions');
    for (const id of ['t1', 't2', 't3']) await page.click('.ch.correct[data-i="' + id + '"]');
    await page.click('.star[data-s="5"]'); await page.fill('#nm', 'Pat Sample');
    await page.click('#send'); await sleep(500);
    const rv = W.posts.find(p => p.action === 'gcm.review');
    ok('the answers, the rating and the name are sent', rv && rv.items.length === 3 && rv.rating === 5 && rv.name === 'Pat Sample', JSON.stringify(rv || {}).slice(0, 200));
    ok('and they are thanked', /Thank you, Pat/.test(await page.textContent('#app')));
    // the look
    const colours = await page.evaluate(() => [...document.querySelectorAll('.mast, .nv, .btn, .kpi, .progress')].map(e => { const c = getComputedStyle(e); return c.backgroundColor + ' ' + c.backgroundImage + ' ' + c.color; }).join(' '));
    ok('no corporate blue left on the page', !isBlue(colours));
    ok('no sideways scroll', await noSideways(page));
    await page.click('#so'); await sleep(500);
    ok('Sign out goes back to the sign-in', await page.$('#gate') !== null && await page.isHidden('#side'));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // the letter's link opens on the items, the bill's on Billing
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('rrb-gcm-client', JSON.stringify({ lb: 'SFL 0001', code: 'ABC123' })); } catch (e) {} });
  const page = await ctx.newPage(); await mock(page, { posts: [] });
  console.log('\nWhere each e-mail’s link opens:\n');
  for (const [q, ct] of [['?from=letter', 'ct-items'], ['?from=reminder&rate=4', 'ct-items'], ['?tab=billing&from=bill', 'ct-billing'], ['?tab=billing&form=enrol', 'ct-forms'], ['?from=welcome', 'ct-home'], ['', 'ct-home']]) {
    await page.goto(U + q, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#side .nv', { timeout: 10000 }).catch(() => {}); await sleep(250);
    ok((q || 'no address') + ' opens ' + ct.slice(3), (await page.$eval('#app', el => el.className)) === ct);
  }
  await ctx.close();
  await browser.close(); srv.kill();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
