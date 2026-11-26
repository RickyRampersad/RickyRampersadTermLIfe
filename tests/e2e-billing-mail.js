// The bills in support@ on the Billings door (26 November 2026): the first step lists the group's billing e-mails found
// in support@ for the month, reads the one bill there is straight away, offers a choice when there are two, keeps a
// reference to the e-mail (never the bytes) for the approval, and folds the device upload away. The Apps Script backend
// and pdf.js are mocked, and the bill reader is told what each invented file holds; the group, the e-mails and every
// figure are invented. Run: node tests/e2e-billing-mail.js   (SHOTS=<folder> saves screenshots)
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = 8874, U = 'http://localhost:' + PORT + '/';
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.SHOTS || '';
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
const up = () => new Promise(res => http.get(U, r => { r.resume(); res(true); }).on('error', () => res(false)));

const G = { key: 'harbour', name: 'Harbour Point Logistics Ltd' };
const line = (l, label, rt) => ({ line: l, label, rt, bill: null, steps: { upload: false }, sf: { rec: { name: 'T-000' + (l === 'health' ? 1 : 2), billed: 5000, paid: 0 }, pays: [], history: [] }, stored: [], claims: null });
const billing = () => ({ ok: true, role: 'staff', title: 'Support team', me: 'Kerry Sample', today: '2026-11-26', month: '2026-12', monthLabel: 'December 2026', canAct: true, live: false, ai: false, salesforce: true,
  group: { key: G.key, name: G.name, assigned: 'Kerry Sample', bills: ['01_HARPO00'], to: ['hr@harbour.example'], contact: 'Pat Admin' },
  lines: [line('health', 'Group Health', 'T-HEALTH GROUP'), line('life', 'Group Life', 'T-LIFE GROUP')],
  tasks: [], inbox: { ok: false, onAsk: true, mails: [] }, people: [], changes: [], day: { date: '2026-11-26', label: 'Thu 26 Nov', hour: 10, isDay: true, daysTo: 0 }, guide: [] });
const BOARD = { ok: true, me: 'Kerry Sample', role: 'staff', title: 'Support team', today: '2026-11-26', refreshed: '26 Nov 2026, 8:00',
  groups: [{ key: G.key, name: G.name, own: true, canAct: true, assigned: 'Kerry Sample', bills: ['01_HARPO00'] }], billing: {}, billingDay: { label: 'Thu 26 Nov, 10:00', isDay: true, hour: 10, daysTo: 0 }, billingLive: false };
const f = (id, name, size) => ({ id, name, type: 'application/pdf', size });
const MAILS = { ok: true, looked: ['HARBOUR'], at: '26 Nov 2026, 9:00', mails: [
  { id: 'M3b', subject: 'HARBOUR POINT LOGISTICS LIMITED - December 2026 Life Billing (corrected)', from: 'premiumsapplicationunit@myguardiangroup.com', ours: false, ts: 3, at: '26 Nov 2026, 8:40', line: 'life', month: '2026-12', files: [f('B1', 'Member bill v2.pdf', 121000)] },
  { id: 'M3', subject: 'HARBOUR POINT LOGISTICS LIMITED - December 2026 Life Billing', from: 'premiumsapplicationunit@myguardiangroup.com', ours: false, ts: 2, at: '25 Nov 2026, 14:00', line: 'life', month: '2026-12', files: [f('A3', 'Member bill.pdf', 120000), f('A4', 'Statement of adjustment.pdf', 40000), f('A5', 'Letter.pdf', 30000)] },
  { id: 'M1', subject: 'HARBOUR POINT LOGISTICS LIMITED - December 2026 Health Billing', from: 'easiconnect@myguardiangroup.com', ours: false, ts: 1, at: '25 Nov 2026, 8:15', line: 'health', month: '2026-12', files: [f('A1', 'HARBOUR_DEC2026.pdf', 98000)] },
  { id: 'M4', subject: 'HARBOUR POINT LOGISTICS LIMITED - November 2026 Health Billing', from: 'easiconnect@myguardiangroup.com', ours: false, ts: 0, at: '26 Oct 2026, 8:00', line: 'health', month: '2026-11', files: [f('A6', 'HARBOUR_NOV2026.pdf', 97000)] }] };
const KIND = { A1: 'health', A3: 'lifeBill', A4: 'lifeAdj', A5: 'lifeLetter', B1: 'lifeBill' };

async function mock(page, W) {
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  /* pdf.js: a stand-in, since the bill reader below is told what each file holds */
  await page.route(/cdnjs\.cloudflare\.com/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.pdfjsLib = { GlobalWorkerOptions: {} };' }));
  await page.route(/script\.google(usercontent)?\.com/, async route => {
    const req = route.request(), u = new URL(req.url()), q = Object.fromEntries(u.searchParams.entries());
    let b = q, a = q.action;
    if (req.method() === 'POST') { try { b = JSON.parse(req.postData() || '{}'); a = b.action; } catch (e) { b = {}; } W.posts.push(b); } else W.gets.push(q);
    if (!a) return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    if (a === 'gcm.board') return json(route, BOARD);
    if (a === 'gcm.billing') return json(route, W.bill);
    if (a === 'gcm.billAsk') return json(route, { ok: true, total: 0, answered: 0, questions: [] });
    if (a === 'gcm.billAct' && b.act === 'mailBills') return json(route, W.mails);
    if (a === 'gcm.billAct' && b.act === 'mailFile') { await sleep(80); return json(route, { ok: true, name: (W.mails.mails.flatMap(m => m.files).find(x => x.id === b.att) || {}).name, type: 'application/pdf', b64: Buffer.from('KIND:' + KIND[b.att]).toString('base64') }); }
    if (a === 'gcm.billUpload') return json(route, { ok: true, said: 'Stored and checked.' });
    return json(route, { ok: false, error: 'not mocked: ' + a });
  });
}
/* the bill reader, told what each invented file holds (the real one is checked on real bills elsewhere) */
const READER = () => {
  BillRead.lines = async buf => [new TextDecoder().decode(new Uint8Array(buf))];
  BillRead.read = lines => {
    const k = String(lines[0]).replace('KIND:', ''), base = { group: 'HARBOUR POINT LOGISTICS LIMITED', ref: '01_HARPO001', month: '2026-12', warnings: [] };
    if (k === 'health') return Object.assign(base, { kind: 'health', due: 5000, count: 3, members: [{ name: 'ONE, PAT' }, { name: 'TWO, SAM' }, { name: 'THREE, LEE' }] });
    if (k === 'lifeBill') return Object.assign(base, { kind: 'lifeBill', total: 1200, members: [{ name: 'ONE, PAT' }], totals: {}, rates: {} });
    if (k === 'lifeAdj') return Object.assign(base, { kind: 'lifeAdj', before: 1200, after: 1150, adjustments: [] });
    if (k === 'lifeLetter') return Object.assign(base, { kind: 'lifeLetter', due: 1150, dated: '2026-11-24', reportDays: 31 });
    return { kind: 'unknown', warnings: ['not a bill'] };
  };
};
const noSideways = page => page.evaluate(() => { window.scrollTo(400, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0; });
async function openDoor(browser, opt, W) {
  const ctx = await browser.newContext(opt), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('rrb-gcm-code', 'TESTCODE'); localStorage.setItem('rrb-gcm-who', 'Kerry Sample'); } catch (e) {} });
  await page.addInitScript(`window.addEventListener('DOMContentLoaded', () => { const t = setInterval(() => { if (window.BillRead) { (${READER.toString()})(); clearInterval(t); } }, 5); });`);
  await mock(page, W);
  await page.goto(U + 'groupclientmanagement/billing.html?g=harbour&m=2026-12', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dstrip .dstep', { timeout: 15000 });
  await sleep(900);
  return { ctx, page, errs };
}
const reads = (W, mail) => W.posts.filter(p => p.act === 'mailFile' && (!mail || p.mail === mail));

(async () => {
  let srv = null;
  if (!(await up())) { srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); for (let i = 0; i < 40 && !(await up()); i++) await sleep(150); }
  const browser = await chromium.launch();
  try {
    console.log('\nOn a laptop: the bills found in support@\n');
    let W = { posts: [], gets: [], bill: billing(), mails: JSON.parse(JSON.stringify(MAILS)) };
    let { ctx, page, errs } = await openDoor(browser, { viewport: { width: 1366, height: 900 } }, W);
    ok('the first step is The bills, and it is open', await page.$eval('#dstrip [aria-current="step"] .l', e => e.textContent) === 'The bills');
    ok('support@ is asked once, for the group', W.posts.filter(p => p.act === 'mailBills').length === 1 && W.posts.find(p => p.act === 'mailBills').group === 'harbour');
    const healthBox = await page.$eval('#mb-health', e => e.textContent), lifeBox = await page.$eval('#mb-life', e => e.textContent);
    ok('health: the December e-mail from easiConnect, with its PDF', /Found in support@/.test(healthBox) && /December 2026 Health Billing/.test(healthBox) && /easiConnect/.test(healthBox) && /HARBOUR_DEC2026\.pdf · 96 KB/.test(healthBox), healthBox);
    ok('November\'s bill is not offered for December', !/November 2026/.test(healthBox));
    ok('life: both December e-mails, to choose from', (await page.$$('#mb-life .mitem')).length === 2 && /2 e-mails, read the one for this bill/.test(lifeBox), lifeBox);
    ok('the one health bill was read straight away', reads(W, 'M1').length === 1 && reads(W, 'M1')[0].att === 'A1');
    ok('the life bills wait for a person to choose', reads(W, 'M3').length === 0 && reads(W, 'M3b').length === 0);
    const pv = await page.$eval('#preview-health', e => e.textContent);
    ok('what was read is shown, with where it came from', /Read from HARBOUR_DEC2026\.pdf/.test(pv) && /support@ e-mail from easiConnect, 25 Nov 2026, 8:15/.test(pv) && /3 members/.test(pv), pv);
    ok('one press stores and checks it', await page.isVisible('[data-store="health"]'));
    ok('the device upload is folded away when the bill was found', !(await page.$eval('#up-health details.upalt', e => e.open)));
    ok('the e-mail read is marked', await page.$eval('#mb-health .mitem', e => e.classList.contains('on')) && /Read it again/.test(await page.$eval('#mb-health .mitem .btn', e => e.textContent)));
    const kept = await page.evaluate(() => BILL_FILES.health);
    ok('what is kept for the approval is the e-mail, never the bytes', Array.isArray(kept) && kept.length === 1 && kept[0].mail === 'M1' && kept[0].att === 'A1' && !kept[0].b64, JSON.stringify(kept));
    await shot(page, '1-laptop-found');

    console.log('\nChoosing the life bill:\n');
    await page.click('#mb-life [data-mread="M3"]');
    await sleep(900);
    ok('all three PDFs of that e-mail are read together', reads(W, 'M3').map(p => p.att).join(',') === 'A3,A4,A5', reads(W, 'M3').map(p => p.att).join(','));
    ok('and not the other e-mail', reads(W, 'M3b').length === 0);
    const lpv = await page.$eval('#preview-life', e => e.textContent);
    ok('the life pack is read as one bill: member bill, statement and letter', /member bill, statement, letter/.test(lpv) && /TT\$1,150\.00/.test(lpv), lpv);
    ok('the health reading is still on screen', /Read from HARBOUR_DEC2026\.pdf/.test(await page.$eval('#preview-health', e => e.textContent)));
    const lk = await page.evaluate(() => BILL_FILES.life);
    ok('life keeps three references to the one e-mail', lk.length === 3 && lk.every(x => x.mail === 'M3' && !x.b64));
    await shot(page, '2-laptop-life');

    console.log('\nStoring it:\n');
    await page.click('[data-store="health"]');
    await sleep(500);
    const st = W.posts.find(p => p.action === 'gcm.billUpload');
    ok('the bill goes to be stored and checked', !!st && st.line === 'health' && st.month === '2026-12' && st.bill && st.bill.due === 5000);
    ok('with where it came from, in the stored record', st && /HARBOUR_DEC2026\.pdf · support@ e-mail from easiConnect/.test(st.files), st && st.files);
    ok('no page errors', !errs.length, errs.join(' | '));
    await ctx.close();

    console.log('\nNothing in support@ yet:\n');
    W = { posts: [], gets: [], bill: billing(), mails: { ok: true, looked: ['HARBOUR'], mails: [] } };
    ({ ctx, page, errs } = await openDoor(browser, { viewport: { width: 1366, height: 900 } }, W));
    const none = await page.$eval('#mb-health', e => e.textContent);
    ok('it says so, and what it looked for', /No group health billing e-mail for December 2026 in support@ yet/.test(none) && /HARBOUR/.test(none), none);
    ok('and the device upload is open', await page.$eval('#up-health details.upalt', e => e.open));
    await page.click('#mb-health [data-mlook]');
    await sleep(500);
    ok('Look again asks support@ afresh', W.posts.filter(p => p.act === 'mailBills').length === 2 && W.posts.filter(p => p.act === 'mailBills')[1].fresh === 'Y');
    await ctx.close();

    console.log('\nsupport@ not readable:\n');
    W = { posts: [], gets: [], bill: billing(), mails: { ok: false, error: 'Microsoft 365 is not set up on this project, so support@ cannot be read.', mails: [] } };
    ({ ctx, page, errs } = await openDoor(browser, { viewport: { width: 1366, height: 900 } }, W));
    ok('the reason is shown, and the device upload is open', /support@ could not be read/.test(await page.$eval('#mb-health', e => e.textContent)) && await page.$eval('#up-health details.upalt', e => e.open));
    await ctx.close();

    console.log('\nOn a phone:\n');
    W = { posts: [], gets: [], bill: billing(), mails: JSON.parse(JSON.stringify(MAILS)) };
    ({ ctx, page, errs } = await openDoor(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, W));
    ok('the bills found sit under the open step', await page.evaluate(() => document.querySelector('#dstrip [aria-current="step"]').closest('li').contains(document.querySelector('#mb-health'))));
    ok('the health bill is read straight away here too', reads(W, 'M1').length === 1);
    ok('no sideways scroll', await noSideways(page));
    ok('a long subject wraps inside its card', await page.evaluate(() => [...document.querySelectorAll('.mitem')].every(e => e.scrollWidth <= e.clientWidth + 1)));
    await shot(page, '3-phone-found');
    ok('no page errors on the phone', !errs.length, errs.join(' | '));
    await ctx.close();
  } finally {
    await browser.close();
    if (srv) srv.kill();
  }
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
