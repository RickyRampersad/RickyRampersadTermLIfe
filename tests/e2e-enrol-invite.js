// The joined group enrolment in a browser (17 November 2026): the group page's "Send them their own link", the New
// members panel with a ready invite checked and approved, and the employee's own page (benefits/enroll.html?inv=) from
// the link to "Your part is done". The Apps Script backend is mocked; every name and code is invented. A phone and a
// laptop; no sideways scroll, no page errors. Run: node tests/e2e-enrol-invite.js
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = 8871, U = 'http://localhost:' + PORT + '/';
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.SHOTS || '';   // a folder: screenshots of each step, for the eye
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
const up = () => new Promise(res => http.get(U, r => { r.resume(); res(true); }).on('error', () => res(false)));
const GIO = fs.readFileSync(path.join(ROOT, 'groupclientmanagement/forms/GIO001.pdf')).toString('base64');
const CODE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

function world() {
  return {
    posts: [], gets: [],
    invites: [
      { ref: 'EN-261116-001', employee: 'Dana Sample', first: 'Dana', email: 'dana@home.example', mobile: '', cover: { health: true, life: true, words: 'Group Health and Group Life' }, effective: '2026-12-01', status: 'ready', words: 'Ready for you to check', reminders: 1, created: '2026-11-16 09:00', completed: '2026-11-17 08:40', sentBy: 'Pat Admin', approvedBy: '', approvedAt: '', test: true },
      { ref: 'EN-261115-001', employee: 'Chris Sample', first: 'Chris', email: 'chris@home.example', mobile: '', cover: { health: true, life: false, words: 'Group Health' }, effective: '2026-12-01', status: 'waiting', words: 'Waiting on Chris · reminded 2 times', reminders: 2, created: '2026-11-15 09:00', completed: '', sentBy: 'Pat Admin', approvedBy: '', approvedAt: '', test: true }]
  };
}
const CLIENT = { ok: true, group: 'Harbour Point Logistics Ltd', staff: 'Kerry Sample', asAt: '17 Nov 2026, 9:00 AM', today: '2026-11-17', respondBy: '2026-11-20',
  pending: null, coming: null, items: [], record: [], year: null, doneWeek: 0, nextLetter: 'Monday 23 Nov, 10:00',
  billing: { lines: [{ line: 'health', label: 'Group Health', bill: { month: '2026-11', label: 'November 2026', due: 1840.00, dueBy: '2026-11-30', members: 6, arrears: 0, sentAt: '', divisions: null, joined: 0, left: 0 }, history: [], owed: 0, openItems: 0, changes: [] }],
    contact: '', nextBill: { day: '2026-11-26', label: '26 Nov 2026', dayOfMonth: 26 }, statement: null } };

async function mock(page, W) {
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, r => r.abort());
  await page.route(/script\.google(usercontent)?\.com/, async route => {
    const req = route.request(), u = new URL(req.url()), q = Object.fromEntries(u.searchParams.entries());
    let b = q, a = q.action;
    if (req.method() === 'POST') { try { b = JSON.parse(req.postData() || '{}'); a = b.action; } catch (e) { b = {}; } W.posts.push(b); } else W.gets.push(q);
    if (!a) return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    if (a === 'gcm.enrolGet') return json(route, b.inv === CODE ? { ok: true, invite: { ref: 'EN-261117-001', company: 'Harbour Point Logistics Ltd', admin: 'Pat Admin', adminFirst: 'Pat', effective: '2026-12-01', first: 'Marcus', last: 'Sample', employee: 'Marcus Sample', email: 'marcus@home.example', mobile: '868-555-0101', cover: { health: true, life: true }, submitted: '' } }
      : { ok: false, error: 'This link is not recognised. Please use the link in your e-mail, or ask your employer to send it again.' });
    if (a === 'gcm.enrolSubmit') return json(route, { ok: true, ref: 'EN-261117-001', company: 'Harbour Point Logistics Ltd', hr: 'Pat', said: 'Your part is done. Pat at Harbour Point Logistics Ltd will check it and send it to Guardian Life.' });
    if (b.lb !== 'TQQ 0001' || b.code !== 'HPL123') return json(route, { ok: false, error: 'That list bill and access code do not match.' });
    if (a === 'gcm.client') return json(route, CLIENT);
    if (a === 'gcm.renGroup') return json(route, { ok: true, renewals: [] });
    if (a === 'gcm.clientPeople') return json(route, { ok: true, people: [], counts: {} });
    if (a === 'gcm.clientForm' && b.form === 'invite') {
      if (b.act === 'preview') { const full = b.tier && b.employed && b.salary; return json(route, { ok: true, invite: W.invites[0], pdf: GIO, pdfError: '', missing: ['a telephone number'], blocking: full ? [] : ['the coverage tier (Section F)'], policies: { health: 'HP', life: 'LP' }, tiers: ['SINGLE', 'EMPLOYEE + ONE', 'EMPLOYEE + FAMILY'], sectionF: { effective: '2026-12-01' } }); }
      const c = { waiting: W.invites.filter(x => x.status === 'waiting').length, ready: W.invites.filter(x => x.status === 'ready').length, sent: W.invites.filter(x => x.status === 'sent').length };
      return json(route, { ok: true, invites: W.invites, live: false, counts: c, tiers: [] });
    }
    if (a === 'gcm.clientFormSend' && b.form === 'invite') {
      if (b.act === 'create') { const x = { ref: 'EN-261117-002', employee: b.first + ' ' + b.last, first: b.first, email: b.email, mobile: b.mobile || '', cover: { health: !!b.covHealth, life: !!b.covLife, words: b.covHealth && b.covLife ? 'Group Health and Group Life' : b.covLife ? 'Group Life' : 'Group Health' }, effective: b.effective, status: 'waiting', words: 'Waiting on ' + b.first, reminders: 0, created: '2026-11-17 10:00', completed: '', sentBy: b.name, approvedBy: '', approvedAt: '', test: true }; W.invites.unshift(x); return json(route, { ok: true, ref: x.ref, test: true, invite: x, said: 'Test: ' + b.first + '’s link went to your account manager, not to ' + b.first + ' (reference ' + x.ref + ').' }); }
      if (b.act === 'approve') { const x = W.invites.find(i => i.ref === b.ref); x.status = 'sent'; x.words = 'Sent to Guardian Life 17/11/2026 (test copy)'; return json(route, { ok: true, test: true, said: 'Test: the application for Dana Sample went to your account manager, not to Guardian Life.' }); }
      if (b.act === 'resend') return json(route, { ok: true, test: true, said: 'Test: the link went to your account manager again, not to Chris.' });
    }
    return json(route, { ok: false, error: 'Unknown action (mock): ' + a });
  });
}
async function noSideways(page) { return page.evaluate(() => { window.scrollTo(400, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0; }); }

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
  const browser = await chromium.launch();
  for (const vp of [{ name: 'phone', width: 390, height: 844, mobile: true }, { name: 'laptop', width: 1366, height: 900, mobile: false }]) {
    console.log('\nThe group page on a ' + vp.name + ':\n');
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('rrb-gcm-client', JSON.stringify({ lb: 'TQQ 0001', code: 'HPL123' })); } catch (e) {} });
    const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
    const W = world(); await mock(page, W);
    await page.goto(U + 'groupclientmanagement/client.html?tab=billing&form=enrol', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#invp .invl', { timeout: 15000 }).catch(() => {});
    ok('the forms open on Enrol a new member, with the New members panel', await page.$('#invp .invl') !== null && await page.$eval('.cfpb.on', el => /Enrol a new member/.test(el.textContent)));
    ok('the pill counts the one ready to check', (await page.$eval('.cfpb[data-cform="enrol"] .cnt', el => el.textContent + '|' + el.className).catch(() => '')) === '1|cnt ready');
    ok('each new member and where they stand', /Dana Sample/.test(await page.textContent('#invp')) && /Ready for you to check/.test(await page.textContent('#invp')) && /Waiting on Chris · reminded 2 times/.test(await page.textContent('#invp')));
    ok('test mode is said plainly', /TEST/.test(await page.textContent('#invp')));
    ok('"Send them their own link" is the first choice, and chosen', await page.$eval('[data-emode="link"]', el => el.getAttribute('aria-pressed')) === 'true');
    ok('the link form asks name, e-mail, cover, date', await page.$('#ifirst') && await page.$('#iemail') && await page.$('#ihealth') && await page.$('#ieff') && await page.$('#cauth'));
    await page.click('#cgo');
    ok('nothing sent without the details', /first name and surname/.test(await page.textContent('#cerr')) && !W.posts.some(p => p.act === 'create'));
    await page.fill('#ifirst', 'Marcus'); await page.fill('#ilast', 'Sample'); await page.fill('#iemail', 'marcus@home.example');
    await page.check('#ilife'); await page.fill('#ieff', '2026-12-01'); await page.fill('#cname', 'Pat Admin'); await page.check('#cauth');
    await page.click('#cgo'); await sleep(600);
    const cr = W.posts.find(p => p.act === 'create');
    ok('sent: the employee, the cover, the date, the sender, authorised', cr && cr.first === 'Marcus' && cr.email === 'marcus@home.example' && cr.covHealth === 'Y' && cr.covLife === 'Y' && cr.effective === '2026-12-01' && cr.name === 'Pat Admin' && cr.authorised === 'Y' && cr.lb === 'TQQ 0001', JSON.stringify(cr));
    ok('the group is told where it went, and the new member is listed', /went to your account manager/.test(await page.textContent('#invp')) && /Marcus Sample/.test(await page.textContent('#invp')));
    ok('the link form is empty again', (await page.inputValue('#ifirst')) === '');
    await shot(page, vp.name + '-1-sent');
    await page.click('[data-invck="EN-261116-001"]'); await sleep(800);
    ok('Check and approve opens Section F and the form', await page.$('#invck') !== null && await page.$('#if_tier') && await page.$('#if_salary') && W.gets.some(q => q.act === 'preview' && q.ref === 'EN-261116-001'));
    ok('it says the health answers are not shown', /not shown here/.test(await page.textContent('#invck')));
    ok('approve waits on Section F', await page.$eval('#invgo', el => el.disabled) && /coverage tier/.test(await page.textContent('#invck')));
    const drawn = await page.waitForFunction(() => { const d = document.getElementById('invpdf'); return d && (d.querySelector('canvas') || /Download the PDF|download the PDF/.test(d.textContent)); }, null, { timeout: 8000 }).then(() => true, () => false);
    ok('Guardian’s GIO001 is drawn, or offered to download', drawn);
    await page.fill('#if_employed', '2017-01-03'); await page.selectOption('#if_tier', 'EMPLOYEE + FAMILY'); await page.fill('#if_salary', '240000'); await page.fill('#if_admin', 'Pat Admin'); await page.check('#invauth');
    await page.click('#invprev'); await sleep(700);
    ok('with Section F the approve button opens', !(await page.$eval('#invgo', el => el.disabled)));
    await shot(page, vp.name + '-2-check');
    await page.click('#invgo'); await sleep(800);
    const ap = W.posts.find(p => p.act === 'approve');
    ok('approved with Section F', ap && ap.ref === 'EN-261116-001' && ap.tier === 'EMPLOYEE + FAMILY' && ap.employed === '2017-01-03' && ap.salary === '240000' && ap.admin === 'Pat Admin' && ap.authorised === 'Y', JSON.stringify(ap));
    ok('the group sees it sent', /went to your account manager, not to Guardian Life/.test(await page.textContent('#invp')) && /Sent to Guardian Life/.test(await page.textContent('#invp')));
    await page.click('[data-invre="EN-261115-001"]'); await sleep(600);
    ok('the link can be sent again', W.posts.some(p => p.act === 'resend' && p.ref === 'EN-261115-001') && /again/.test(await page.textContent('#invp')));
    await page.click('[data-emode="fill"]'); await sleep(200);
    ok('"Fill it in for them" still gives the full GIO001 form', await page.$('#en_first') !== null && await page.$('#invp') !== null);
    ok('no sideways scroll', await noSideways(page));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  for (const vp of [{ name: 'phone', width: 390, height: 844, mobile: true }, { name: 'laptop', width: 1366, height: 900, mobile: false }]) {
    console.log('\nThe employee’s own page on a ' + vp.name + ':\n');
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
    const W = world(); await mock(page, W);
    await page.goto(U + 'benefits/enroll.html?inv=' + CODE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Hello Marcus/.test((document.getElementById('invcard') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    await shot(page, vp.name + '-3-employee');
    ok('greets them by name, from their employer', /Hello Marcus/.test(await page.textContent('#invcard')) && /Pat Admin at Harbour Point Logistics Ltd/.test(await page.textContent('#invcard')));
    ok('the employer’s "send this to your staff" card is gone', !/Copy enrollment link/.test(await page.textContent('#formview')));
    ok('company, name, e-mail and cover filled in; the cover locked', (await page.inputValue('#company')) === 'Harbour Point Logistics Ltd' && (await page.inputValue('#empname')) === 'Marcus Sample' && (await page.inputValue('#email')) === 'marcus@home.example' && await page.$eval('#covHealth', el => el.checked && el.disabled) && await page.$eval('#covLife', el => el.checked && el.disabled));
    await page.fill('#dob', '1984-08-22'); await page.selectOption('#gender', 'Male'); await page.selectOption('#marital', 'Married'); await page.fill('#occupation', 'Operations Manager');
    await page.click('#nextbtn'); await sleep(150);
    await page.fill('#deps tr:nth-child(1) [data-d="name"]', 'Renee Sample'); await page.selectOption('#deps tr:nth-child(1) [data-d="g"]', 'F'); await page.fill('#deps tr:nth-child(1) [data-d="dob"]', '1986-03-04');
    await page.click('#nextbtn'); await sleep(150);
    await page.fill('#bens tr:nth-child(1) [data-b="rel"]', 'Spouse'); await page.fill('#bens tr:nth-child(1) [data-b="name"]', 'Renee Sample'); await page.fill('#bens tr:nth-child(1) [data-b="pct"]', '100');
    await page.click('#nextbtn'); await sleep(200);
    ok('the health note says it goes to Guardian, never to the employer', /never shown to your employer/.test(await page.textContent('#healthnote')));
    await page.check('#allwell'); await sleep(100);
    for (const id of ['#sig_emp', '#sig_spouse']) {
      const c = await page.$(id); await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox();
      await page.mouse.move(bb.x + 30, bb.y + 80); await page.mouse.down(); for (let i = 1; i <= 15; i++) await page.mouse.move(bb.x + 30 + i * 14, bb.y + 80 - Math.sin(i / 2) * 25); await page.mouse.up();
    }
    ok('the signature note fits the online part', /goes on your Guardian application/.test(await page.textContent('#healthhost')));
    await page.click('#nextbtn'); await sleep(200);
    ok('Section F is the employer’s: nothing to do', /completes this part/.test(await page.textContent('.card[data-step="5"]')) && !(await page.isVisible('#tier')));
    await page.click('#nextbtn'); await sleep(300);
    ok('the review shows the Guardian pack, footed with the branch site', /GROUP HEALTH AND LIFE APPLICATION FORM/.test(await page.textContent('#previewbox')) && /rickyrampersadbranch\.com/.test(await page.textContent('#previewbox')) && !/employeebenefitstt/.test(await page.content()));
    await page.click('#submitbtn'); await sleep(800);
    const sub = W.posts.find(p => p.action === 'gcm.enrolSubmit');
    ok('their part goes to the branch with the code', sub && sub.inv === CODE && sub.answers.employee === 'Marcus Sample' && sub.answers.dob === '1984-08-22' && sub.answers.marital === 'MARRIED', JSON.stringify(sub && sub.answers));
    ok('with the spouse as a dependant and the beneficiary', sub && sub.answers.deps.length === 1 && sub.answers.deps[0].rel === 'SPOUSE' && sub.answers.deps[0].key === 'd0' && sub.answers.bens[0].name === 'Renee Sample');
    ok('the health answers (all No) and both signatures', sub && sub.health.answers.emp.a === 'N' && sub.health.answers.d0.bc === 'N' && sub.health.medUse === 'N' && /^data:image\/png;base64,/.test(sub.sig) && /^data:image\/png;base64,/.test(sub.sigSpouse));
    ok('nothing went to the old portal webhook', !W.posts.some(p => p.kind === 'enrollment'));
    await shot(page, vp.name + '-4-done');
    ok('"Your part is done", with who checks it next', /Your part is done/.test(await page.textContent('#invdone')) && /Pat at Harbour Point Logistics Ltd will check it/.test(await page.textContent('#invdone')) && await page.isVisible('#printview'));
    ok('no "enroll another employee" for the employee', !(await page.isVisible('#another')));
    ok('no sideways scroll', await noSideways(page));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\nA wrong link, and the page without one:\n');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
    const W = world(); await mock(page, W);
    await page.goto(U + 'benefits/enroll.html?inv=' + 'f'.repeat(32), { waitUntil: 'domcontentloaded' }); await sleep(800);
    ok('a wrong link says so, and the form is hidden', /not recognised/.test(await page.textContent('#invcard')) && !(await page.isVisible('#f')));
    await page.goto(U + 'benefits/enroll.html', { waitUntil: 'domcontentloaded' }); await sleep(300);
    ok('without a link the page is as it was: the employer’s share card, the cover free to tick', /Copy enrollment link/.test(await page.textContent('#formview')) && !(await page.$eval('#covHealth', el => el.disabled)) && await page.$('#invcard') === null);
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await browser.close(); srv.kill();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
