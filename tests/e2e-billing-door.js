// The Billings door in a browser (25 November 2026): the six steps down the side on a laptop and down the page on a phone,
// "What was found" with its questions, a task from a finding in one short screen with no [blanks], the panel closing at once
// and only that finding changing, and the members step. The Apps Script backend is mocked; the group, every member and
// every figure are invented. Run: node tests/e2e-billing-door.js   (SHOTS=<folder> saves screenshots)
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = 8873, U = 'http://localhost:' + PORT + '/';
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.SHOTS || '';
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
const up = () => new Promise(res => http.get(U, r => { r.resume(); res(true); }).on('error', () => res(false)));

const G = { key: 'harbour', name: 'Harbour Point Logistics Ltd' };
const TIER = { id: 'h3', level: 'check', who: 'salesforce', kind: 'tier', text: '3 member premiums differ from Salesforce: Pat One TT$266.00 (SF TT$226.00); Sam Two TT$558.00 (SF TT$806.00); Lee Three TT$806.00 (SF TT$558.00). A tier change, or a rate Salesforce never got.',
  members: [{ id: 'E1', name: 'ONE, PAT', bill: 266, sf: 226 }, { id: 'E2', name: 'TWO, SAM', bill: 558, sf: 806 }, { id: 'E3', name: 'THREE, LEE', bill: 806, sf: 558 }] };
const NOTIN = { id: 'h1', level: 'fix', who: 'salesforce', kind: 'notInSf', text: '1 on the bill is not in Salesforce as a member of this group: Nora New. Add the record, or they will never be chased, serviced or seen on the page.',
  members: [{ id: 'E9', name: 'NEW, NORA', start: '2026-11-01', tier: 'Employee Only', premium: 266 }] };
const CREDIT = { id: 'h4', level: 'check', who: 'us', kind: 'credit', action: 'task', member: 'GONE, GARY', data: { name: 'GONE, GARY', kind: 'leaver', month: '2026-11', amount: -266 },
  text: 'Gary Gone is taken off from November 2026 (TT$-266.00) and no Salesforce task records that change. Open one, or confirm the group asked for it.' };
const OKF = { id: 'h2', level: 'ok', who: 'salesforce', kind: 'amount', text: 'Salesforce has the month at TT$5,000.00 billed, the same as the bill.' };
const LIFEF = { id: 'l1', level: 'note', who: 'us', kind: 'letter', text: 'The covering letter gives 31 days to report changes.' };
const bill = (line, findings) => ({ month: '2026-12', line, due: line === 'health' ? 5000 : 1200, dueBy: '2026-12-31', members: 3, arrears: 0, variance: 0, sfRecord: 'T-0001', sfBilled: line === 'health' ? 5000 : 1200, current: line === 'health' ? 5000 : 1200,
  ref: 'TQQ 0001', dated: '2026-11-24', by: 'Kerry Sample', checkedAt: '25 Nov 2026, 9:10', files: line + '.pdf', reconciledAt: '', sentAt: '', findings, resolved: {}, sfWrite: { action: 'same', changed: [], tasks: [], errors: [] } });
function billing() {
  return { ok: true, role: 'staff', title: 'Support team', me: 'Kerry Sample', today: '2026-11-25', month: '2026-12', monthLabel: 'December 2026', canAct: true, live: false, ai: false, salesforce: true,
    group: { key: G.key, name: G.name, assigned: 'Kerry Sample', bills: ['TQQ 0001'], to: ['hr@harbour.example'], contact: 'Pat Admin' },
    lines: [
      { line: 'health', label: 'Group Health', rt: 'T-HEALTH GROUP', bill: bill('health', [NOTIN, OKF, TIER, CREDIT]), steps: { upload: true, verify: true, fixed: false, open: 3, fixes: 1, checks: 2, status: 'to fix' }, sf: { rec: { name: 'T-0001', billed: 5000, paid: 0 }, pays: [], history: [] }, stored: [], claims: null },
      { line: 'life', label: 'Group Life', rt: 'T-LIFE GROUP', bill: bill('life', [LIFEF]), steps: { upload: true, verify: true, fixed: true, open: 0, status: 'checked' }, sf: { rec: { name: 'T-0002', billed: 1200, paid: 0 }, pays: [], history: [] }, stored: [], claims: null }],
    tasks: [{ id: '00T000000000001', title: 'Group Health billing December', subject: 'Group Health billing', line: 'health', status: 'Not Started', owner: 'Kerry Sample', opened: '2026-11-20', age: 5, due: '2026-11-30', late: false, posts: [], shown: false }],
    inbox: { ok: false, onAsk: true, mails: [], error: 'not read when the page opens' }, people: [{ id: '005000000000OWN', name: 'Kerry Sample', owner: true, me: true }, { id: '005000000000SUP', name: 'Sam Support' }],
    changes: [], day: { date: '2026-11-26', label: 'Thu 26 Nov', hour: 10, isDay: false, daysTo: 1 }, guide: [] };
}
const BOARD = { ok: true, me: 'Kerry Sample', role: 'staff', title: 'Support team', today: '2026-11-25', refreshed: '25 Nov 2026, 8:00',
  groups: [{ key: G.key, name: G.name, own: true, canAct: true, assigned: 'Kerry Sample', bills: ['TQQ 0001'] }],
  billing: { harbour: { month: '2026-12', lines: 2, fixes: 1, checks: 2, reconciled: 0, approved: 0, held: 0, sent: 0 } }, billingDay: { label: 'Thu 26 Nov, 10:00', isDay: false, hour: 10, daysTo: 1 }, billingLive: false };
const ASK = { ok: true, total: 2, answered: 0, questions: [
  { id: 'h3', line: 'health', label: 'Group Health', kind: 'tier', level: 'check', who: 'salesforce', text: 'The premium differs from Salesforce for 3 members. A tier change?', why: TIER.text, members: [],
    options: [{ v: 'tier', label: 'Yes: record the tier change' }, { v: 'rate', label: 'No: a rate error, query Head Office' }, { v: 'unsure', label: 'Not sure yet' }] },
  { id: 'h1', line: 'health', label: 'Group Health', kind: 'notInSf', level: 'fix', who: 'salesforce', text: 'Nora New is on the bill and not in Salesforce. Add the record?', why: NOTIN.text, members: [], options: [{ v: 'add', label: 'Yes: open a task to add it' }, { v: 'unsure', label: 'Not sure yet' }] }] };
const PEOPLE = { ok: true, salesforce: true, convertAge: 65, depAge: 21, counts: { members: 3, matched: 3, convert: 0, depAge: 0, retire: 0, over65: 0, depOver: 0, tierDeps: 0, tierSingle: 0, nodob: 0, nosf: 0 }, people: [], onRecord: [] };

async function mock(page, W) {
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, r => r.abort());
  await page.route(/script\.google(usercontent)?\.com/, async route => {
    const req = route.request(), u = new URL(req.url()), q = Object.fromEntries(u.searchParams.entries());
    let b = q, a = q.action;
    if (req.method() === 'POST') { try { b = JSON.parse(req.postData() || '{}'); a = b.action; } catch (e) { b = {}; } W.posts.push(b); } else W.gets.push(q);
    if (!a) return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    if (a === 'gcm.board') return json(route, BOARD);
    if (a === 'gcm.billing' && q.inbox === 'Y') return json(route, { ok: true, inbox: { ok: true, mails: [{ ts: 1, at: '22 Nov 2026', from: 'hr@harbour.example', subject: 'Payment for November premium', auto: false }] } });
    if (a === 'gcm.billing') return json(route, W.bill);
    if (a === 'gcm.billAsk') return json(route, W.ask);
    if (a === 'gcm.billTaskUpdates') return json(route, { ok: true, tasks: [] });
    if (a === 'gcm.billPeople') return json(route, PEOPLE);
    if (a === 'gcm.billStatement') return json(route, { ok: true, data: null, said: 'The statement is written once a bill is reconciled.' });
    if (a === 'gcm.billAi') return json(route, { ok: false, error: 'off' });
    if (a === 'gcm.billAct' && b.act === 'answer') return json(route, { ok: true, answered: { label: b.label, by: 'Kerry Sample', at: 'just now' }, said: 'Answered.', next: b.v === 'tier' ? { kind: 'task', task: 'tier', line: 'health' } : null });
    if (a === 'gcm.billAct' && b.act === 'task') {
      await sleep(W.taskDelay || 1200);
      if (W.taskFail) return json(route, { ok: false, error: 'Salesforce would not open the task: a made-up refusal' });
      const f = W.bill.lines[0].bill;
      if (b.finding) f.resolved[b.finding] = { by: 'Kerry Sample', at: '25 Nov 2026, 9:20', note: 'Task opened for Kerry Sample, due 27 Nov 2026' };
      return json(route, { ok: true, task: '00T000000000NEW', to: 'Kerry Sample', resolved: !!b.finding, said: 'Task opened for Kerry Sample, due 27 Nov 2026; noted on the billing task.' });
    }
    if (a === 'gcm.billAct' && b.act === 'note') return json(route, { ok: true, said: 'Posted to the task’s Chatter.' });
    return json(route, { ok: false, error: 'not mocked: ' + a });
  });
}
const openLine = async (page, line) => { if (!(await page.$eval('#line-' + line, e => e.open))) await page.click('details#line-' + line + ' > summary'); };
const noSideways = page => page.evaluate(() => { window.scrollTo(400, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0; });

async function openDoor(browser, opt, W) {
  const ctx = await browser.newContext(opt), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('rrb-gcm-code', 'TESTCODE'); localStorage.setItem('rrb-gcm-who', 'Kerry Sample'); } catch (e) {} });
  await mock(page, W);
  await page.goto(U + 'groupclientmanagement/billing.html?g=harbour&m=2026-12', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dstrip .dstep', { timeout: 15000 });
  await sleep(600);
  return { ctx, page, errs };
}

(async () => {
  let srv = null;
  if (!(await up())) { srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); for (let i = 0; i < 40 && !(await up()); i++) await sleep(150); }
  const browser = await chromium.launch();
  try {
    console.log('\nOn a laptop: the steps down the side\n');
    let W = { posts: [], gets: [], bill: billing(), ask: JSON.parse(JSON.stringify(ASK)) };
    let { ctx, page, errs } = await openDoor(browser, { viewport: { width: 1366, height: 860 } }, W);
    const steps = await page.$$eval('#dstrip .dstep .l', els => els.map(e => e.textContent));
    ok('six steps', steps.length === 6, steps.join(' | '));
    ok('in the order of the work', steps.join('|') === 'The bills|What was found|Last month’s tasks|The members|The statement|Approve and send', steps.join('|'));
    const geo = await page.evaluate(() => { const r = document.querySelector('#dstrip').getBoundingClientRect(), p = document.querySelector('#dpanel').getBoundingClientRect(), s = [...document.querySelectorAll('#dstrip .dstep')].map(e => e.getBoundingClientRect()); return { rail: { x: r.x, w: r.width }, panel: { x: p.x }, ys: s.map(x => x.y), xs: s.map(x => x.x) }; });
    ok('the rail is at the side of the open step', geo.rail.x + geo.rail.w <= geo.panel.x && geo.rail.w < 320, JSON.stringify(geo.rail));
    ok('the steps come down, one under another', geo.ys.every((y, i) => !i || y > geo.ys[i - 1]) && new Set(geo.xs.map(Math.round)).size === 1);
    ok('it opens on What was found (something to fix)', await page.$eval('#dstrip [aria-current="step"] .l', e => e.textContent) === 'What was found');
    ok('the questions come first in it', /The questions/.test(await page.$eval('#dpanel', e => e.textContent)) && (await page.$$('#dpanel .qcard')).length === 2);
    ok('every check is under them, folded by line', (await page.$$('#dpanel details.lchk')).length === 2);
    ok('no sideways scroll', await noSideways(page));
    const early = W.gets.map(g => g.action);
    ok('the door opens with one read ahead, the questions, not four', early.includes('gcm.billAsk') && !early.some(a => /billPeople|billStatement|billTaskUpdates/.test(a)), early.join(','));
    ok('and never reads the inbox when it opens', !W.gets.some(g => g.inbox === 'Y'));
    await shot(page, '1-laptop-found');

    console.log('\nA task from a finding: one short screen\n');
    await openLine(page, 'health');
    const before = W.gets.filter(g => g.action === 'gcm.billing').length;
    await page.click('[data-task="health"][data-f="h3"]');
    await page.waitForSelector('dialog[open] #tkText');
    const T = await page.$eval('#tkText', e => e.value), S = await page.$eval('#tkSubject', e => e.value);
    ok('no [blank] to fill in the note', !/\[[^\]]{1,40}\]/.test(T), T);
    ok('no [blank] in the subject', !/\[[^\]]{1,40}\]/.test(S), S);
    ok('the note names each member with the bill and Salesforce figures', /Pat One: the bill TT\$266\.00, Salesforce TT\$226\.00/.test(T) && /Lee Three/.test(T), T);
    ok('it says what to do', /Please check each against the member’s tier on the bill/.test(T));
    ok('it says the finding once, not twice', (T.match(/premiums differ/g) || []).length === 1 && !/What the check found/.test(T) && !/From the check/.test(await page.$eval('#dlgB', e => e.textContent)));
    ok('the subject is the branch’s pattern', S === 'Group Health Billing – Harbour Point Logistics Ltd – December 2026 – 3 member premiums differ from Salesforce', S);
    ok('the kinds and the rest are folded away', !(await page.isVisible('#tkKinds')) && await page.isVisible('#tkTo') && await page.isVisible('#tkDue'));
    ok('it goes to the account owner unless changed', await page.$eval('#tkTo', e => e.value) === '005000000000OWN');
    if (SHOTS) await (await page.$('dialog[open]')).screenshot({ path: path.join(SHOTS, '2-laptop-task.png') });
    W.taskDelay = 1500;
    const t0 = Date.now();
    await page.click('#tkGo');
    await sleep(250);
    ok('the panel closes at once, before Salesforce answers', !(await page.$('dialog[open]')) && Date.now() - t0 < 1200);
    ok('the finding says the task is on its way', /Opening the task for Kerry Sample/.test(await page.$eval('#dpanel', e => e.textContent)));
    await sleep(1800);
    const task = W.posts.find(p => p.act === 'task');
    ok('the task went with the finding and the note', task && task.finding === 'h3' && task.kind === 'data' && task.text === T, task && task.kind);
    ok('the finding reads as resolved', /Task opened for Kerry Sample/.test(await page.$eval('#line-health', e => e.textContent)));
    ok('the page was not emptied and read again in front of the user', !/Opening the billing/.test(await page.$eval('#app', e => e.textContent)));
    const after = W.gets.filter(g => g.action === 'gcm.billing').length;
    ok('one quiet read of the month afterwards, at most', after - before <= 1, String(after - before));
    ok('the line the user opened stays open', await page.$eval('#line-health', e => e.open));

    console.log('\nA one-person finding: the branch’s own termination subject\n');
    await page.click('[data-task="health"][data-f="h4"]');
    await page.waitForSelector('dialog[open] #tkText');
    const T4 = await page.$eval('#tkText', e => e.value), S4 = await page.$eval('#tkSubject', e => e.value);
    ok('a termination for the member, effective the month', S4 === 'Group Health Termination – Gary Gone – Harbour Point Logistics Ltd – effective 1 Nov 2026', S4);
    ok('no [blank]', !/\[[^\]]{1,40}\]/.test(T4 + S4), T4);
    ok('it is a leaver task with the member', await page.$eval('#tkMember', e => e.value) === 'Gary Gone' && await page.$eval('#tkKinds .chip.on', e => e.dataset.kind) === 'leaver');
    console.log('\nA send that fails keeps what was typed\n');
    W.taskFail = true; W.taskDelay = 300;
    await page.fill('#tkText', T4 + '\nTyped by hand.');
    await page.click('#tkGo');
    await page.waitForSelector('dialog[open] #tkText', { timeout: 5000 });
    ok('the panel opens again with the words', /Typed by hand\./.test(await page.$eval('#tkText', e => e.value)));
    ok('and says why', /made-up refusal/.test(await page.$eval('#toast', e => e.textContent)));
    W.taskFail = false;
    await page.click('#tkCancel');

    console.log('\nAn answer that opens a task\n');
    await page.click('[data-ans="h3"][data-v="tier"]');
    await page.waitForSelector('dialog[open] #tkText');
    const T3 = await page.$eval('#tkText', e => e.value);
    ok('the answer’s kind shapes the note, still with no blanks', /These are tier changes/.test(T3) && !/\[[^\]]{1,40}\]/.test(T3), T3);
    ok('and the kind is the one the answer chose', await page.$eval('#tkKinds .chip.on', e => e.dataset.kind) === 'tier');
    await page.click('#tkCancel');

    console.log('\nLast month\'s tasks: the inbox only when asked\n');
    await page.click('#dstrip [data-go="tasks"]');
    await sleep(400);
    ok('a button, not an inbox read', await page.isVisible('#dInbox') && !W.gets.some(g => g.inbox === 'Y'));
    ok('the step\'s own read starts when it opens', W.gets.some(g => g.action === 'gcm.billTaskUpdates'));
    await page.click('#dInbox');
    await page.waitForFunction(() => !document.querySelector('#dInbox'), null, { timeout: 5000 });
    ok('asked for on its own, for this group', W.gets.some(g => g.action === 'gcm.billing' && g.inbox === 'Y' && g.group === 'harbour'));
    ok('the group\'s e-mail is listed', /Payment for November premium/.test(await page.$eval('#dpanel', e => e.textContent)));

    console.log('\nThe members, in one step\n');
    await page.click('#dstrip [data-go="members"]');
    await sleep(500);
    const M = await page.$eval('#dpanel', e => e.textContent);
    ok('the changes and the people together', /Terminations, enrolments and changes/.test(M) && /The people on the bills/.test(M));
    ok('one Next button at the foot, not two', (await page.$$('#dpanel .dnav')).length === 1);
    await page.evaluate(() => dGo('findings'));
    ok('an old step name still opens its step', await page.$eval('#dstrip [aria-current="step"] .l', e => e.textContent) === 'What was found');
    ok('no page errors on the laptop', !errs.length, errs.join(' | '));
    await ctx.close();

    console.log('\nOn a phone: the steps come down the page\n');
    W = { posts: [], gets: [], bill: billing(), ask: JSON.parse(JSON.stringify(ASK)) };
    ({ ctx, page, errs } = await openDoor(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, W));
    const pg = await page.evaluate(() => { const cur = document.querySelector('#dstrip [aria-current="step"]'), li = cur.closest('li'), p = document.querySelector('#dpanel'); const rows = [...document.querySelectorAll('#dstrip .dstep')].map(e => e.getBoundingClientRect()); return { inside: li.contains(p), below: p.getBoundingClientRect().y > cur.getBoundingClientRect().y, next: rows[2].y > p.getBoundingClientRect().bottom - 2, full: rows.every(r => r.width > 300) }; });
    ok('the open step opens under its own row', pg.inside && pg.below);
    ok('the steps after it come below it', pg.next);
    ok('each step is a full-width row', pg.full);
    ok('no sideways scroll', await noSideways(page));
    await shot(page, '3-phone-found');
    await page.click('#dstrip [data-go="upload"]');
    await sleep(400);
    ok('another step moves the open panel under that row', await page.evaluate(() => document.querySelector('#dstrip [data-go="upload"]').closest('li').contains(document.querySelector('#dpanel'))));
    await page.click('#dstrip [data-go="check"]');
    await sleep(400);
    await openLine(page, 'health');
    await page.click('[data-task="health"][data-f="h3"]');
    await page.waitForSelector('dialog[open] #tkText');
    ok('the task panel fits the phone', await page.evaluate(() => { const d = document.querySelector('dialog[open]'); return d.scrollWidth <= d.clientWidth + 1; }));
    if (SHOTS) await (await page.$('dialog[open]')).screenshot({ path: path.join(SHOTS, '4-phone-task.png') });
    await page.click('#tkCancel');
    ok('no page errors on the phone', !errs.length, errs.join(' | '));
    await ctx.close();
  } finally {
    await browser.close();
    if (srv) srv.kill();
  }
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
