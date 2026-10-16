// RR Operations → Petty Cash, on a phone, end to end. The page talks to the
// real backend (DeliveryBook.gs + PettyCash.gs, run in Node on the fake
// Sheets in tests/harness.js), so the page and the script cannot drift.
//
// Pat receives a float (counting first), records a spend whose category is
// suggested from what was typed, with a receipt photo, records one with no
// receipt, counts the cash and comes up short. The manager then sees the
// shortage, approves an over-limit spend, queries one, and reads the
// insights. Invented names and figures throughout.
//
// Run: node tests/e2e-pettycash.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/DeliveryBook.gs');
const { makeEnv } = require('./harness');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* The backend. */
const env = makeEnv({ props: { PC_FLOAT: '500', PC_SPEND_LIMIT: '300' } });
new vm.Script(fs.readFileSync(path.join(ROOT, 'apps-script/PettyCash.gs'), 'utf8')).runInContext(env);
env.__mail = []; env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 50 };
const folder = { getId: () => 'f', createFile: () => ({ getUrl: () => 'https://drive.example/receipt' }) };
env.DriveApp = { getFolderById: () => folder, createFolder: () => folder };
env.Utilities.newBlob = (b, t, n) => ({ b, t, n });
env.Utilities.base64Decode = s => Array.from(Buffer.from(s, 'base64'));
env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'], [
  ['Pat Runner', 'pat@example.com', 'PAT1', 'Staff', '', 'Yes', 'delivery-book, petty-cash'],
  ['Mo Manager', 'mo@example.com', 'MGR9', 'Branch Manager', '', 'Yes', ''],
]);
const post = b => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(b) } }).getContent());

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });

  async function as(code) {
    const s = post({ action: 'login', code });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); }, ['rrb-ops-session', JSON.stringify(s)]);
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(base)) return route.continue();
      if (/script\.google\.com/.test(u)) {
        const out = env.doPost({ postData: { contents: route.request().postData() } }).getContent();
        return route.fulfill({ status: 200, contentType: 'application/json', body: out });
      }
      return route.abort();
    });
    const page = await ctx.newPage();
    page.__errors = [];
    page.on('pageerror', e => page.__errors.push(e.message));
    page.on('dialog', d => d.accept(page.__answer || 'ok'));
    await page.goto(base + '/rroperations/petty-cash/');
    await page.waitForSelector('#lock', { state: 'hidden', timeout: 8000 });
    return page;
  }
  const noOverflow = async (page, label) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(label + ': nothing wider than the phone', w <= 390, String(w));
  };
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); };

  /* ── Pat ─────────────────────────────────────────────── */
  const pat = await as('PAT1');
  ok('Pat is in, as staff', /Pat Runner · Staff/.test(await pat.textContent('#me')));
  ok('staff do not choose whose float', await pat.isHidden('#holderBox'));
  ok('five things to record', (await pat.$$('.type')).length === 5);
  await shot(pat, '01-record');

  // Received: counted first.
  await pat.click('[data-type=topup]');
  ok('a top-up asks for the count first', /Count first/.test(await pat.textContent('#countedLabel')));
  await pat.fill('#amount', '500');
  await pat.fill('#from', 'Mo Manager');
  await pat.click('#saveBtn');
  await pat.waitForTimeout(150);
  ok('without the count it is refused', /Count the cash/.test(await pat.textContent('#formErr')));
  await pat.fill('#counted', '0');
  await pat.click('#saveBtn');
  await pat.waitForSelector('#done:not([hidden])');
  ok('recorded, and the float is TT$500', /TT\$500\.00/.test(await pat.textContent('#done')));

  // Spent, with the category suggested from the words.
  await pat.click('#again');
  await pat.click('[data-type=spend]');
  await pat.fill('#amount', '65');
  await pat.fill('#purpose', 'Bucket and cleaning supplies for the meeting room');
  ok('a category is suggested from what was typed', /Office supplies/.test(await pat.textContent('#suggest')));
  await pat.click('#suggest');
  ok('tapping the suggestion picks it', await pat.getAttribute('.cat[aria-pressed=true]', 'class') !== null);
  await pat.selectOption('#sub', 'Cleaning supplies');
  await pat.fill('#paidTo', 'Corner Hardware');
  await pat.setInputFiles('#receipt', { name: 'r.png', mimeType: 'image/png', buffer: PNG });
  await pat.waitForFunction(() => document.getElementById('prev').style.display === 'block');
  await pat.fill('#receiptNo', 'CH-16');
  await shot(pat, '02-spend');
  await noOverflow(pat, 'the spend form');
  await pat.click('#saveBtn');
  await pat.waitForSelector('#done:not([hidden])');
  ok('the spend is recorded and the float shows TT$435', /TT\$435\.00/.test(await pat.textContent('#done')));
  const row = env.__sheets['Petty Cash Ledger']._grid.slice(-1)[0].join('|');
  ok('the receipt photo went with it', /drive\.example\/receipt/.test(row));

  // Spent, no receipt, personal.
  await pat.click('#again');
  await pat.click('[data-type=spend]');
  await pat.fill('#amount', '200');
  await pat.fill('#purpose', 'Tuition paid to the teacher');
  await pat.fill('#paidTo', 'A teacher');
  await pat.click('.cat.personal');
  ok('a personal spend is charged personal and locked', (await pat.inputValue('#charged')) === 'Branch Manager (personal)' && await pat.isDisabled('#charged'));
  await pat.selectOption('#sub', 'School & tuition');
  await pat.check('#noRec');
  await pat.selectOption('#noReceipt', 'Paid to a person');
  await pat.click('#saveBtn');
  await pat.waitForSelector('#done:not([hidden])');
  ok('no receipt is flagged on the receipt card', /No receipt/.test(await pat.textContent('#done')));

  // Count, by note and coin, comes up short.
  await pat.click('#again');
  await pat.click('[data-type=count]');
  await pat.click('summary');
  await pat.fill('[data-d="100"]', '2');
  await pat.fill('[data-d="20"]', '1');
  ok('the notes add up to the count', (await pat.inputValue('#counted')) === '220.00');
  ok('the count is read against the book as it is typed', /book says TT\$235\.00/.test(await pat.textContent('#recon')) && /Short TT\$15\.00/.test(await pat.textContent('#recon')));
  await shot(pat, '03-count');
  await pat.click('#saveBtn');
  await pat.waitForSelector('#done:not([hidden])');
  ok('the shortage is on the result', /Short TT\$15\.00 against the book/.test(await pat.textContent('#done')));

  // Float and ledger.
  await pat.click('[data-tab=float]');
  await pat.waitForTimeout(200);
  ok('the float card shows the book, the top-up and the count', /TT\$220\.00/.test(await pat.textContent('#floats')) && /TT\$280\.00/.test(await pat.textContent('#floats')));
  await shot(pat, '04-float');
  await pat.click('[data-tab=ledger]');
  ok('the ledger has the four entries', (await pat.$$('#ledger .entry')).length === 4);
  await pat.click('#ledger .entry');
  ok('an entry opens to its detail', /Reference/.test(await pat.textContent('#ledger .entry.open')));
  ok('staff get no review buttons', !(await pat.$('#ledger [data-act=void]')));
  await pat.click('[data-tab=insights]');
  ok('insights: spent, personal, short', /TT\$265\.00/.test(await pat.textContent('#tiles')) && /TT\$200\.00/.test(await pat.textContent('#tiles')) && /TT\$15\.00/.test(await pat.textContent('#tiles')));
  ok('what stands out leads with the shortage', /short/.test(await pat.textContent('#stand li')));
  ok('one shortage is one red flag', /Short at a count\s*TT\$15\.00\s*1 entry/.test(await pat.textContent('#flags')), await pat.textContent('#flags'));
  await shot(pat, '05-insights');
  await noOverflow(pat, 'insights');
  ok('no script errors on Pat\'s phone', !pat.__errors.length, pat.__errors.join(' | '));

  // An over-limit spend to approve.
  post({ action: 'pc.submit', token: post({ action: 'login', code: 'PAT1' }).token, entry: { type: 'spend', amount: 350, category: 'Repairs & maintenance',
    sub: 'Building', paidTo: 'Lock Shop', purpose: 'New lock for the back door', noReceipt: 'Receipt lost' } });

  /* ── the manager ─────────────────────────────────────── */
  const mo = await as('MGR9');
  ok('the manager chooses whose float', await mo.evaluate(() => !document.getElementById('holderBox').hidden));
  ok('the Float tab counts what waits for him', (await mo.textContent('#todoN')) === '1');
  await mo.click('[data-tab=float]');
  await mo.waitForTimeout(150);
  ok('waiting for you lists the over-limit spend', /Lock Shop/.test(await mo.textContent('#todo')));
  await shot(mo, '06-manager-float');
  await mo.click('#todo [data-act=approve]');
  await mo.waitForTimeout(400);
  ok('approved, and nothing waits now', (await mo.isHidden('#todoN')) && /Approved/.test(env.__sheets['Petty Cash Ledger']._grid.map(r => r.join('|')).join('\n')));
  await mo.click('[data-tab=ledger]');
  await mo.selectOption('#fShow', 'norec');
  ok('the no-receipt filter', (await mo.$$('#ledger .entry')).length === 2);
  await mo.selectOption('#fShow', '');
  mo.__answer = 'Who was this for?';
  const first = await mo.$('#ledger .entry');
  await first.click();
  await (await first.$('[data-act=query]')).click();
  await mo.waitForTimeout(400);
  ok('a query is sent and shows', /Queried/.test(await mo.textContent('#ledger')));
  ok('the holder hears by e-mail', env.__mail.some(m => m.to === 'pat@example.com' && /queried/.test(m.subject)));
  await mo.click('[data-tab=insights]');
  ok('the manager sees each person', /Pat Runner/.test(await mo.textContent('#byHolder')));
  await shot(mo, '07-manager-insights');
  await noOverflow(mo, 'the manager\'s insights');
  ok('no script errors on the manager\'s phone', !mo.__errors.length, mo.__errors.join(' | '));

  /* ── the launcher ────────────────────────────────────── */
  const lp = pat.context().pages()[0];
  await lp.goto(base + '/rroperations/');
  await lp.waitForSelector('#home:not([hidden])');
  ok('the launcher opens Petty Cash', !!(await lp.$('a.app[href="/rroperations/petty-cash/"]')));

  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
