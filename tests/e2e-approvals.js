// RR Operations → Approvals, on a phone, end to end, against the real
// backend (DeliveryBook.gs + Approvals.gs run in the harness).
//
// An agent types a client's name, reads the history, is made to explain what
// is different, and sends it. The Branch Manager opens the review from the
// e-mail's link, sees the history beside the reason, previews the GL e-mail
// and approves. Then a first-time client gets the first-time template.
//
// Invented names throughout. Fonts and every other outside request are cut.
// Run: node tests/e2e-approvals.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const API = 'https://script.google.com/macros/s/';

const both = path.join(os.tmpdir(), 'rrops-approvals-e2e.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/DeliveryBook.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Approvals.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
const env = makeEnv({ props: { APR_TEST_INBOX: 'test@example.com', APR_HISTORY_TAB: 'History' } });
const _fd = env.Utilities.formatDate;
env.Utilities.formatDate = (d, tz, f) => f === 'yyMMdd' ? '261015' : _fd(d, tz, f);
env.__mail = [];
env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 50 };
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'], [
  ['Pat Agent', 'pat@example.com', 'PAT1', 'Agent', '', 'Yes', 'approvals'],
  ['Mo Manager', 'mo@example.com', 'MGR9', 'Branch Manager', '', 'Yes', ''],
]);
const H = ['Submission Date', 'Approval Type', 'Agent Name', 'Agent Email', 'Client Name - First Name', 'Client Name - Last Name',
  'Reason For Cheque/Cash Collection', 'Cash Amount', 'Policy Number', 'BM Cash Approval ', 'Submission ID'];
env.__mkSheet('History', 2, H, [
  [day(300), 'Cash Collection', 'Pat', 'pat@example.com', 'Anika', 'Pretend', 'Card Problem', '', '5009990001', '', '1'],
  [day(70), 'Cash Collection', 'Pat', 'pat@example.com', 'Anika', 'Pretend', 'Card Problem', '700', '5009990001', '', '2'],
  [day(30), 'Cash Collection', 'Lee', 'lee@example.com', 'ANIKA', 'PRETEND', 'MPOS Device Not Working', '700', '5009990001', '', '3'],
]);

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true }); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
  const errors = [];
  async function phone(code) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(base)) return route.continue();
      if (u.startsWith(API)) {
        const out = env.doPost({ postData: { contents: route.request().postData() } });
        return route.fulfill({ status: 200, contentType: 'application/json', body: out.getContent(), headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.goto(base + '/rroperations/');
    await page.fill('#code', code); await page.click('#lockBtn');
    await page.waitForSelector('.app');
    return page;
  }
  const noSideScroll = async page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  /* the agent */
  let page = await phone('PAT1');
  ok('the launcher shows the Approvals tile', await page.isVisible('a.app[href="/rroperations/approvals/"]'));
  await page.click('a.app[href="/rroperations/approvals/"]');
  await page.waitForSelector('#typeSeg button');
  ok('the agent has no Review tab', await page.isHidden('#reviewTab'));
  ok('the request is closed until the history is read', await page.evaluate(() => document.getElementById('c3').classList.contains('dim')));
  await page.fill('#first', 'anika'); await page.fill('#last', 'pretend');
  await page.click('#histBtn');
  await page.waitForSelector('#c2:not([hidden]) .stat');
  const stats = await page.$$eval('.stat b', b => b.map(x => x.textContent));
  ok('history first: 3 on record, 2 in 90 days', stats[0] === '3' && stats[1] === '2', JSON.stringify(stats));
  ok('the "3rd in 90 days" warning shows', /request 3 in 90 days/.test(await page.textContent('#hist')));
  ok('every request listed, newest first', (await page.$$('#hist .h')).length === 3 && /Lee/.test(await page.textContent('#hist .h')));
  ok('the tick and "what is different" are asked', await page.isVisible('#historyAsk'));
  await shot(page, 'a1-history');
  await page.fill('#amount', '700'); await page.selectOption('#cat', 'Card problem');
  await page.fill('#policy', '5009990001');
  await page.fill('#reason', 'Card declined again');
  await page.click('#sendBtn');
  await page.waitForFunction(() => document.getElementById('sErr').textContent.length > 0);
  ok('refused without a full reason, the tick and what is different',
     /own words/.test(await page.textContent('#sErr')) && /history/.test(await page.textContent('#sErr')));
  await page.fill('#reason', 'Her card was declined at the bank twice this week and she has no cheque book.');
  await page.check('#seen');
  await page.fill('#different', 'The bank has issued a new card that arrives on Friday; this is the last cash collection.');
  await page.click('#sendBtn');
  await page.waitForSelector('#result:not([hidden]) .ref');
  const ref = (await page.textContent('#result .ref')).trim();
  ok('sent, with a reference', /^APR-/.test(ref), ref);
  ok('the flags are shown to the agent', /requests in 90 days/.test(await page.textContent('#result')));
  ok('no sideways scroll on a phone (agent)', await noSideScroll(page));
  await shot(page, 'a2-sent');
  await page.click('#again');
  await page.fill('#first', 'Brand'); await page.fill('#last', 'Newclient'); await page.click('#histBtn');
  await page.waitForSelector('#c2:not([hidden]) .first');
  ok('a new client shows "No requests on record"', /This would be the first/.test(await page.textContent('#hist')));
  ok('and needs no second answer', await page.isHidden('#historyAsk'));
  await page.fill('#policy', '5001112223'); await page.fill('#amount', '250'); await page.selectOption('#cat', 'No bank account');
  await page.fill('#reason', 'New client to the branch; he has not opened a bank account yet.');
  await page.click('#sendBtn'); await page.waitForSelector('#result:not([hidden]) .ref');
  const ref2 = (await page.textContent('#result .ref')).trim();
  await page.context().close();

  /* the manager, from the e-mail's link */
  const link = env.__mail.find(m => /Approval request/.test(m.subject)).htmlBody.match(/href="([^"]+)"/)[1];
  ok('the manager\'s e-mail links straight to the review', /approvals\/\?review=APR-/.test(link), link);
  page = await phone('MGR9');
  await page.goto(base + '/approvals/?review=' + encodeURIComponent(ref));
  await page.waitForSelector('#r-' + ref);
  ok('the short /approvals link opens the Review tab', await page.isVisible('#tab-review') && page.url().includes('/rroperations/approvals/'));
  ok('the review shows the reason, what is different and the history',
     /no cheque book/.test(await page.textContent('#r-' + ref)) && /arrives on Friday/.test(await page.textContent('#r-' + ref)) &&
     (await page.$$('#h-' + ref + ' .h')).length === 3);
  await page.fill('#n-' + ref, 'Approved once more; no further cash after the new card.');
  await page.click('[data-prev="' + ref + '"]');
  await page.waitForSelector('#p-' + ref + ' iframe');
  const prev = await page.$eval('#p-' + ref + ' iframe', f => f.srcdoc);
  ok('preview: the history template with the table and the note', /Approval history/.test(prev) && /no further cash/.test(prev));
  await shot(page, 'm1-review');
  await page.click('[data-dec="approve"][data-ref="' + ref + '"]');
  await page.waitForFunction(r => /Approved/.test(document.getElementById('r-' + r).textContent), ref);
  ok('approved: GL e-mail sent (test inbox)', /History e-mail to GL Customer Service: Test copy sent/.test(await page.textContent('#r-' + ref)));
  const gl = env.__mail.filter(m => /^\[TEST\] Approved:/.test(m.subject));
  ok('exactly one GL e-mail, to the test inbox', gl.length === 1 && gl[0].to === 'test@example.com');
  await page.click('[data-dec="approve"][data-ref="' + ref2 + '"]');
  await page.waitForFunction(r => /Approved/.test(document.getElementById('r-' + r).textContent), ref2);
  ok('the new client gets the first-time template', /First-time e-mail/.test(await page.textContent('#r-' + ref2)));
  ok('no sideways scroll on a phone (manager)', await noSideScroll(page));
  await page.waitForTimeout(1800);
  await shot(page, 'm2-decided');
  if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'gl-history.html'), gl[0].htmlBody);
  ok('no script errors', !errors.length, errors.join(' | '));

  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall approvals e2e checks pass');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
