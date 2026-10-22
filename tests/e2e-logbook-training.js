// The Log Book training page (/logbook/training), on a phone and on a desk,
// against the real LogBook.gs and DeliveryBook.gs in the harness.
//
// An agent signs in, sees the agent manual (not the staff one), ticks a
// section, takes the agent questions, fails a rule and is told why, takes it
// again and passes. Staff see the staff manual and questions. A unit manager
// sees their team's results; staff see everyone's and the questions most
// answered wrongly. The real question bank is private (the "Log Book
// Questions" tab); this test uses a made-up one.
//
// Run: node tests/e2e-logbook-training.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = ['DeliveryBook.gs', 'LogBook.gs'].map(f => path.join(ROOT, 'apps-script', f)).join(',');
const { makeEnv } = require('./harness');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const API = 'https://fake.api/exec';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv({ props: { DB_TEST_INBOX: 'test@example.com' } });
env.__mail = [];
env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 90 };
env.Session = { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) };
env.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{"records":[]}' }) };
env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'], [
  ['Sam Support', 'sam@example.com', 'SAM1', 'Sales Support', '', 'Yes', ''],
]);
env.__mkSheet('Agents', 1, ['Agent No', 'Name', 'Email', 'Unit', 'Code', 'Active', 'Role'], [
  ['A10001', 'Ana Agent', 'ana@example.com', 'Uma Unit', '4821', 'Yes', 'Agent'],
  ['A20000', 'Uma Unit', 'uma@example.com', '', 'u1', 'Yes', 'Unit Manager'],
  ['A20002', 'Cal Other', 'cal@example.com', 'Gary Else', 'c1', 'Yes', 'Agent'],
]);
// A made-up bank: R1 is everyone's rule, A* the agents', S* the staff's.
env.__mkSheet('Log Book Questions', 1, ['Id', 'Roles', 'Section', 'Question', 'A', 'B', 'C', 'D', 'Answer', 'Why', 'Points', 'Critical'], [
  ['R1', 'all', 'Rule', 'Pretend rule question?', 'Opt a', 'Opt b', 'Opt c', 'Opt d', 'B', 'Because b.', 1, 'Y'],
  ['A1', 'agent', 'Agents', 'Agent question one?', 'Opt a', 'Opt b', 'Opt c', 'Opt d', 'C', 'Because c.', 1, ''],
  ['A2', 'agent', 'Agents', 'Agent question two?', 'Opt a', 'Opt b', 'Opt c', 'Opt d', 'A', 'Because a.', 1, ''],
  ['A3', 'agent', 'Agents', 'Agent question three?', 'Opt a', 'Opt b', 'Opt c', 'Opt d', 'D', 'Because d.', 1, ''],
  ['A4', 'agent', 'Agents', 'Agent question four?', 'Opt a', 'Opt b', 'Opt c', 'Opt d', 'A', 'Because a.', 1, ''],
  ['S1', 'staff', 'Staff', 'Staff question one?', 'Opt a', 'Opt b', 'Opt c', 'Opt d', 'D', 'Because d.', 1, ''],
  ['S2', 'staff', 'Staff', 'Staff question two?', 'Opt a', 'Opt b', 'Opt c', 'Opt d', 'A', 'Because a.', 1, ''],
]);
const seen = [];
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const pick = async (page, id, L) => page.click(`.q[data-q="${id}"] .opt[data-l="${L}"]`);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
  const errors = [];
  const route = async ctx => ctx.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(base)) return r.continue();
    if (u.startsWith(API)) {
      const b = JSON.parse(r.request().postData() || '{}');
      seen.push(b);
      const out = env.doPost({ postData: { contents: JSON.stringify(b) } }).getContent();
      return r.fulfill({ status: 200, contentType: 'application/json', body: out });
    }
    return r.abort();
  });

  /* ── the short addresses ── */
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await route(phone);
  const page = await phone.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/logbook/training/?api=' + encodeURIComponent(API));
  await page.waitForURL(/rroperations\/logbook\/training\.html/);
  ok('/logbook/training opens the training page', true);
  const p2 = await phone.newPage();
  await p2.goto(base + '/logbooktraining/');
  await p2.waitForURL(/rroperations\/logbook\/training\.html/);
  ok('/logbooktraining opens it too', true);
  await p2.close();

  /* ── the agent ── */
  await page.fill('#gNo', 'A10001'); await page.fill('#gCode', '4821'); await page.click('#gBtn');
  await page.waitForSelector('#main:not([hidden])');
  ok('the agent is in', /Ana Agent · agent/.test(await page.textContent('#who')));
  ok('the agent manual shows, the staff manual does not',
     !(await page.$eval('[data-role=agent]', e => e.hidden)) && await page.$eval('[data-role=staff]', e => e.hidden));
  ok('the questions came without their answers', seen.length && !/"ans"|Because/.test(JSON.stringify(env.doPost({ postData: { contents: JSON.stringify({ action: 'lb.train', token: seen[seen.length - 1].token }) } }).getContent())));
  ok('8 sections to read (the rules and seven)', /0 of 8/.test(await page.textContent('#st1s')));
  await page.check('[data-read="R"]');
  ok('ticking a section counts it', /1 of 8/.test(await page.textContent('#st1s')));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  ok('nothing runs off the phone', wide <= 390, wide);

  await page.click('#toTest');
  ok('the agent gets 5 questions: the rule and the agent ones', (await page.$$('#testBody .q')).length === 5);
  ok('send waits until all are answered', await page.$eval('#send', b => b.disabled));
  await pick(page, 'R1', 'A'); await pick(page, 'A1', 'C'); await pick(page, 'A2', 'A'); await pick(page, 'A3', 'D'); await pick(page, 'A4', 'A');
  await page.click('#send');
  await page.waitForSelector('.score');
  ok('80% with the rule wrong is not a pass', /80%/.test(await page.textContent('.score .big')) && /Not yet/.test(await page.textContent('.score .word')));
  ok('the right answer and the reason show', /the answer is B/.test(await page.textContent('.q[data-q="R1"] .why')) && /Because b/.test(await page.textContent('.q[data-q="R1"] .why')));
  ok('the wrong pick is marked', await page.$eval('.q[data-q="R1"] .opt[data-l="A"]', o => o.classList.contains('wrong')));
  await page.click('#again');
  await pick(page, 'R1', 'B'); await pick(page, 'A1', 'C'); await pick(page, 'A2', 'A'); await pick(page, 'A3', 'D'); await pick(page, 'A4', 'B');
  await page.click('#send');
  await page.waitForSelector('.score.pass');
  ok('80% with the rule right passes', /80%/.test(await page.textContent('.score .big')));
  ok('the progress shows passed', /Passed · best 80%/.test(await page.textContent('#st3s')));
  const rows = env.__sheets['Log Book Training'];
  const rv = rows ? rows._grid : [];
  ok('both attempts are on the Log Book Training tab', rv.length === 3 && rv[1][9] === 'No' && rv[2][9] === 'Yes', JSON.stringify(rv.map(r => r[9])));
  const m = env.__mail.filter(x => /Log Book training/.test(x.subject));
  ok('each attempt e-mailed (test mode, to the test inbox)', m.length === 2 && /\[TEST\]/.test(m[0].subject) && /ana@example\.com/.test(m[0].htmlBody));
  await page.click('#toRes');
  await page.waitForSelector('#resBody table');
  ok('the agent sees only their own attempts', /Your attempts/.test(await page.textContent('#resBody')) && !/What the team got wrong/.test(await page.textContent('#resBody')));
  await page.click('#signOut');
  await page.waitForSelector('#lock:not([hidden])');

  /* ── another agent, to fill the team ── */
  const calTok = JSON.parse(env.doPost({ postData: { contents: JSON.stringify({ action: 'lb.login', agentNo: 'A20002', code: 'c1' }) } }).getContent()).token;
  JSON.parse(env.doPost({ postData: { contents: JSON.stringify({ action: 'lb.trainSubmit', token: calTok, answers: { R1: 'B', A1: 'A', A2: 'B', A3: 'D', A4: 'A' } }) } }).getContent());

  /* ── the unit manager: their team only ── */
  await page.fill('#gNo', 'A20000'); await page.fill('#gCode', 'u1'); await page.click('#gBtn');
  await page.waitForSelector('#main:not([hidden])');
  ok('a unit manager gets the agent manual', /unit manager/.test(await page.textContent('#who')) && !(await page.$eval('[data-role=agent]', e => e.hidden)));
  await page.click('[data-tab=results]');
  await page.waitForSelector('#resBody .tiles');
  const um = await page.textContent('#resBody');
  ok('the unit manager sees their team: Ana, not Cal', /Your team/.test(um) && /Ana Agent/.test(um) && !/Cal Other/.test(um));
  ok('and that they have not taken it yet themselves', /Not taken yet \(1\)/.test(um) && /Uma Unit/.test(um));
  await page.click('#signOut');

  /* ── staff, on a desk ── */
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await route(desk);
  const sp = await desk.newPage();
  sp.on('pageerror', e => errors.push(e.message));
  await sp.goto(base + '/rroperations/logbook/training.html?api=' + encodeURIComponent(API));
  await sp.click('[data-who=staff]');
  await sp.fill('#gAccess', 'sam1'); await sp.click('#gBtn');
  await sp.waitForSelector('#main:not([hidden])');
  ok('staff get the staff manual', /staff/.test(await sp.textContent('#who')) && !(await sp.$eval('[data-role=staff]', e => e.hidden)) && await sp.$eval('[data-role=agent]', e => e.hidden));
  ok('and the staff film first', /logbookdemostaff/.test(await sp.$eval('#filmMine', a => a.href)));
  await sp.click('[data-tab=test]');
  ok('staff get 3 questions: the rule and the staff ones', (await sp.$$('#testBody .q')).length === 3);
  await pick(sp, 'R1', 'B'); await pick(sp, 'S1', 'D'); await pick(sp, 'S2', 'A');
  await sp.click('#send');
  await sp.waitForSelector('.score.pass');
  ok('staff pass with 100%', /100%/.test(await sp.textContent('.score .big')));
  await sp.click('#toRes');
  await sp.waitForSelector('#resBody .tiles');
  const st = await sp.textContent('#resBody');
  ok('staff see everyone', /Everyone/.test(st) && /Ana Agent/.test(st) && /Cal Other/.test(st) && /Sam Support/.test(st));
  ok('and what the team got wrong most, A1 at the top', /What the team got wrong most/.test(st) &&
     (await sp.$$eval('#resBody .card:last-child tbody tr td:first-child', t => t[0].textContent)).includes('Agent question'));
  ok('a staff session cannot read the answers either', !/"ans"/.test(env.doPost({ postData: { contents: JSON.stringify({ action: 'lb.train', token: seen.filter(s => s.token).pop().token }) } }).getContent()));
  ok('no page errors', !errors.length, errors.join(' | '));
  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' failed' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
