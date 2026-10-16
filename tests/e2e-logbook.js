// The Log Book, on a phone and on a desk, against the real LogBook.gs and
// DeliveryBook.gs running in the harness (the page's requests are answered by
// doPost itself, so the page and the script are tested together).
//
// An agent signs in with their number and code, finds a client by e-mail,
// adds surrender documents (the department comes from the history) and the
// documents that usually go with them, and logs it. Staff sign in with their
// access code, receive and sign, build the transmittal for the department and
// see the printed page with the date collected and the date sent. Then the
// insights.
//
// Invented names throughout. Fonts and anything off the local server are cut off.
// Run: node tests/e2e-logbook.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = ['DeliveryBook.gs', 'LogBook.gs'].map(f => path.join(ROOT, 'apps-script', f)).join(',');
const { makeEnv } = require('./harness');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const API = 'https://fake.api/exec';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

/* ── the backend, for real ─────────────────────────────────────────── */
const SFC = { Id: '003000000000001AAA', Name: 'Anika Pretend', FirstName: 'Anika', LastName: 'Pretend', Email: 'anika@example.com',
              Preferred_Email__c: null, MobilePhone: '868-555-0101', Contact_Type__c: 'Client', Account: { Name: '' } };
const SFP = [
  { Id: 'a02000000000002AAA', Name: 'CLIENT-2', POLICY__c: '9000000001', RecordType: { Name: 'LIFE' }, PLAN_NAME__c: 'Term', Contact__c: SFC.Id },
];
const env = makeEnv({ props: { SF_KEY: 'k', SF_SECRET: 's', DB_TEST_INBOX: 'test@example.com' } });
env.UrlFetchApp = { fetch: u => {
  const res = b => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(b) });
  if (/oauth2/.test(u)) return res({ access_token: 't', instance_url: 'https://sf.example' });
  const q = decodeURIComponent(u);
  if (/FROM Contact WHERE Email =/.test(q)) return res({ records: /anika@example\.com/.test(q) ? [SFC] : [] });
  if (/FROM Contact WHERE Id/.test(q)) return res({ records: [SFC] });
  if (/FROM CLIENT_PORTFOLIO__c WHERE Contact__c IN/.test(q)) return res({ records: SFP });
  if (/\/search\?q=/.test(u)) return res({ searchRecords: [SFC] });
  return res({ records: [] });
} };
env.__mail = [];
env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 90 };
const folder = { getId: () => 'f', createFile: () => ({ getUrl: () => 'https://drive.example/sig' }) };
env.DriveApp = { getFolderById: () => folder, createFolder: () => folder };
env.Utilities.newBlob = (b, t, n) => ({ b, t, n });
env.Utilities.base64Decode = s => Array.from(Buffer.from(s, 'base64'));
env.Session = { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) };
env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'], [
  ['Sam Support', 'sam@example.com', 'SAM1', 'Sales Support', '', 'Yes', ''],
]);
env.__mkSheet('Agents', 2, ['Agent No', 'Name', 'Email', 'Unit', 'Code', 'Active'], [
  ['A10001', 'Ana Agent', 'ana@example.com', 'Unit One', '4821', 'Yes'],
]);
const seen = [];

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

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
      env.LB_READ_ = null;
      const out = env.doPost({ postData: { contents: JSON.stringify(b) } }).getContent();
      return r.fulfill({ status: 200, contentType: 'application/json', body: out });
    }
    return r.abort();
  });

  /* ── the agent, on a phone ── */
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await route(phone);
  const page = await phone.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(base + '/logbook/?api=' + encodeURIComponent(API));
  await page.waitForURL(/rroperations\/logbook/);
  ok('/logbook opens the Log Book', true);
  await page.fill('#gNo', 'A10001'); await page.fill('#gCode', '0000'); await page.click('#gBtn');
  await page.waitForFunction(() => document.getElementById('gErr').textContent.length > 0);
  ok('a wrong code is refused', /do not match/.test(await page.textContent('#gErr')));
  await page.fill('#gCode', '4821'); await page.click('#gBtn');
  await page.waitForSelector('#main:not([hidden])');
  ok('the agent is in, on the log form', /Agent A10001/.test(await page.textContent('#me')) && !(await page.$eval('#tab-log', e => e.hidden)));
  ok('the agent has two tabs', (await page.$$('#tabs [data-tab]')).length === 2);
  ok('test mode is shown', (await page.textContent('#modePill')).trim() === 'TEST');
  if (SHOTS) await page.screenshot({ path: SHOTS + '/lb-1-agent.png', fullPage: true });

  await page.fill('#q', 'anika@example.com'); await page.click('#findBtn');
  await page.waitForSelector('#results .client');
  ok('found by e-mail', seen.some(s => s.action === 'lb.lookup' && s.q === 'anika@example.com'));
  await page.click('#results .client');
  await page.waitForFunction(() => /1 policy on record/.test((document.getElementById('polLine') || {}).textContent || ''));
  ok('her policy comes from Salesforce', true);
  await page.selectOption('#docSel', 'Surrender Documents');
  await page.waitForSelector('.item');
  ok('the department is suggested from the history', (await page.$eval('.item [data-f=department]', s => s.value)) === 'GLOC CS RSC - CHAGUANAS');
  ok('and says how sure', /Usually goes here: \d+% of/.test(await page.textContent('.item .sugg')));
  ok('the one policy is filled in', (await page.$eval('.item [data-f=policy]', s => s.value)) === '9000000001');
  const withs = await page.$$eval('.item .with button', b => b.map(x => x.textContent));
  ok('what usually goes with it is offered', withs.some(w => /Proof of ID/.test(w)), withs.join());
  await page.click('.item .with button:has-text("Proof of ID")');
  ok('one tap adds it', (await page.$$('.item')).length === 2);
  await page.selectOption('#deptFilter', 'MAIL TEAM QUERY');
  const firstGroup = await page.$eval('#docSel optgroup', g => g.label + ':' + g.querySelector('option').textContent);
  ok('choosing a department lists its documents first', /MAIL TEAM QUERY:PMAR/.test(firstGroup), firstGroup);
  await page.selectOption('#deptFilter', '');
  await page.click('#submitBtn');
  ok('no declaration, refused', /declaration/.test(await page.textContent('#subErr')));
  await page.check('#declare');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  ok('nothing runs off the phone', wide <= 390, wide);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/lb-2-form.png', fullPage: true });
  await page.click('#submitBtn');
  await page.waitForSelector('#result:not([hidden])');
  const ref = (await page.textContent('#result .ref')).trim();
  ok('logged with a reference', /^LB-\d{6}-[A-Z0-9]{4}$/.test(ref), ref);
  const sub = seen.find(s => s.action === 'lb.submit');
  ok('two lines, each with its department and portfolio', sub.entry.items.length === 2 &&
     sub.entry.items.every(i => i.department === 'GLOC CS RSC - CHAGUANAS' && i.portfolioId === 'a02000000000002AAA'));
  await page.click('#seeMine');
  await page.waitForSelector('#mine .grp');
  ok('My log shows it waiting to be handed in', /Logged · hand it in/.test(await page.textContent('#mine')));

  /* ── staff, on a desk ── */
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await route(desk);
  const sp = await desk.newPage();
  sp.on('pageerror', e => errors.push(e.message));
  sp.on('dialog', d => d.accept());
  await sp.goto(base + '/rroperations/logbook/?api=' + encodeURIComponent(API));
  await sp.click('[data-who=staff]');
  await sp.fill('#gAccess', 'sam1'); await sp.click('#gBtn');
  await sp.waitForSelector('#qRecv .grp');
  ok('staff open on the queue, four tabs', (await sp.$$('#tabs [data-tab]')).length === 4);
  ok('the agent\'s lines wait to be received', /Anika Pretend/.test(await sp.textContent('#qRecv')) && (await sp.$$('#qRecv .ln')).length === 2);
  if (SHOTS) await sp.screenshot({ path: SHOTS + '/lb-3-queue.png', fullPage: true });
  await sp.click('#qRecv [data-recv]');
  await sp.click('#mYes');
  ok('no signature, refused', /Sign/.test(await sp.textContent('#mErr')));
  const box = await (await sp.$('#sigC')).boundingBox();
  await sp.mouse.move(box.x + 30, box.y + 80); await sp.mouse.down();
  for (let i = 0; i < 10; i++) await sp.mouse.move(box.x + 40 + i * 25, box.y + 60 + (i % 2) * 40);
  await sp.mouse.up();
  await sp.click('#mYes');
  await sp.waitForSelector('#qSend .grp');
  ok('received: now to send, under its department', /GLOC CS RSC - CHAGUANAS/.test(await sp.textContent('#qSend .gh')));
  ok('the signature went as a PNG', /^data:image\/png/.test(seen.find(s => s.action === 'lb.receive').signature));
  await sp.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await sp.click('#qSend [data-build]');
  // After the cut-off on the day received (whatever the clock running this
  // says), the page asks for the reasons first.
  await sp.waitForSelector('#print:not([hidden]), [data-nr]');
  if (await sp.$('[data-nr]')) {
    for (const i of await sp.$$('[data-nr]')) await i.fill('Received after the bag left');
    await sp.click('#mYes');
    await sp.waitForSelector('#print:not([hidden])');
  }
  const paper = await sp.textContent('#paper');
  ok('the transmittal: department, number, both dates', /GLOC CS RSC - CHAGUANAS/.test(paper) && /TR-\d{6}-01/.test(paper) &&
     /DATE COLLECTED/.test(paper) && /DATE SENT/.test(paper) && /Surrender Documents/.test(paper) && /Proof of ID/.test(paper));
  ok('signature lines for both ends', /Dispatched by: Sam Support/.test(paper) && /Received by \(GLOC CS RSC - CHAGUANAS\)/.test(paper));
  await sp.waitForTimeout(400);
  ok('it goes to the printer', await sp.evaluate(() => window.__printed === 1));
  if (SHOTS) await sp.screenshot({ path: SHOTS + '/lb-4-transmittal.png', fullPage: true });
  await sp.click('#pClose');
  await sp.waitForFunction(() => /TR-/.test(document.getElementById('qToday').textContent));
  ok('it is on "Sent today", to reprint or take back', (await sp.$$('#qToday [data-back]')).length === 1);
  await sp.click('[data-tab=stats]');
  await sp.waitForSelector('#stats .kp');
  ok('the insights open', /sent the day collected/.test(await sp.textContent('#stats')) && /By department/.test(await sp.textContent('#stats')));
  if (SHOTS) await sp.screenshot({ path: SHOTS + '/lb-5-insights.png', fullPage: true });
  await sp.click('[data-tab=log]');
  ok('staff log for an agent: the agent list is there', (await sp.$$eval('#agentSel option', o => o.length)) === 2 && !(await sp.$eval('#agentPick', e => e.hidden)));

  /* back on the phone: the agent sees it sent */
  await page.reload();
  await page.waitForSelector('#main:not([hidden])');
  await page.click('[data-tab=mine]');
  await page.waitForSelector('#mine .grp');
  ok('the agent sees it sent, with the transmittal', /Sent/.test(await page.textContent('#mine')) && /TR-/.test(await page.textContent('#mine')));

  ok('no script errors', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
