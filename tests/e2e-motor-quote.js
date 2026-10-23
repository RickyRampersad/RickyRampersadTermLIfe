// The motor quote page in a real browser, on a phone, against a fake backend:
// a client signs in, sees her vehicle, starts from it (what we hold is filled
// in), walks the six steps, adds a photo, reads the review and sends; the done
// screen shows the reference and the home screen lists the request. Nothing
// runs wider than the phone, and the page throws no error.
// Run: node tests/e2e-motor-quote.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const API = 'https://fake.api/exec';
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  let body = fs.readFileSync(f);
  if (f.endsWith('motor-quote/index.html')) body = Buffer.from(body.toString().replace(/API_URL: "[^"]*"/, 'API_URL: "' + API + '"'));
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(body);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const ME = { found: true, email: 'anika@example.com', contactId: '003000000000001AAA', name: 'Anika Pretend', first: 'Anika', last: 'Pretend',
  mobile: '868-555-0101', occupation: 'Teacher', dob: '1988-04-12', salesforce: true,
  vehicles: [{ reg: 'PDX 1234', make: 'Toyota', model: 'Aqua', year: 2019, cover: 'Comprehensive', sumInsured: 95000, windscreen: 'Yes', carrier: 'Guardian General', to: '2027-01-31' }],
  policies: [{ policy: 'TTMV00000001', product: 'Private Motor', expires: '2027-01-31' }] };
const calls = []; let requests = [];
(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.indexOf(API) !== 0) return route.continue();
    const b = JSON.parse(route.request().postData() || '{}'); calls.push(b);
    const reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (b.siteKey !== 'rrb-motor-quote-1') return reply({ ok: false, error: 'out of date' });
    if (b.action === 'requestCode') return reply({ ok: true, sent: true, message: 'Your sign-in code is on its way to ' + b.email + '.' });
    if (b.action === 'verifyCode') return b.code === '211110' ? reply({ ok: true, token: 'T'.repeat(40), me: ME, requests, mode: 'test' }) : reply({ ok: false, error: 'That code did not match.' });
    if (b.action === 'me') return reply({ ok: true, me: ME, requests, mode: 'test' });
    if (b.action === 'submit') { requests = [{ ref: 'MQ-261021-001', when: '21 Oct 2026', vehicle: '2019 Toyota Aqua', reg: b.quote.reg, cover: b.quote.cover, status: 'Sent to quotes desk' }];
      return reply({ ok: true, ref: 'MQ-261021-001', mode: 'test', requests, contact: 'Existing', mail: 'Sent' }); }
    if (b.action === 'signOut') return reply({ ok: true });
    reply({ ok: false, error: 'Unknown action ' + b.action });
  });
  const wide = async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const txt = async sel => (await page.textContent(sel)) || '';

  await page.goto(base + '/motor-quote/', { waitUntil: 'domcontentloaded' });
  ok('opens on the sign-in, no "being connected" notice once wired', await page.isVisible('#s-signin') && !(await page.isVisible('#notice')));
  await page.fill('#email', 'Anika@Example.com'); await page.click('#btnCode');
  await page.waitForSelector('#codeBox:not(.hide)');
  ok('asks for the code and names the inbox', /anika@example.com/.test(await txt('#codeMsg')));
  await page.fill('#code', '000000'); await page.click('#btnVerify'); await page.waitForFunction(() => document.getElementById('signinErr').textContent);
  ok('a wrong code is refused on the page', /did not match/.test(await txt('#signinErr')));
  await page.fill('#code', '211110'); await page.click('#btnVerify'); await page.waitForSelector('#s-home:not(.hide)');
  ok('home greets her by first name and shows her vehicle', /Good day, Anika/.test(await txt('#homeTitle')) && /Toyota Aqua/.test(await txt('#homeVeh')) && /PDX 1234/.test(await txt('#homeVeh')));
  ok('the test-mode notice shows', await page.isVisible('#notice') && /Test mode/.test(await txt('#notice')));
  ok('her name is in the header with Sign out', /Anika Pretend/.test(await txt('#whoName')));
  ok('the session is kept on the device', await page.evaluate(() => !!localStorage.getItem('rrb-mq-session')));

  await page.click('.veh'); await page.waitForSelector('#s-form:not(.hide)');
  ok('step 1 opens, filled from what we hold', await page.inputValue('[data-k=name]') === 'Anika Pretend' && await page.inputValue('[data-k=mobile]') === '868-555-0101' &&
    await page.inputValue('[data-k=occupation]') === 'Teacher' && await page.inputValue('[data-k=dob]') === '1988-04-12');
  ok('gender is a tap, not typed', (await page.$$('.opts button')).length >= 4);
  await page.click('.opts button:has-text("Female")');
  await page.click('#btnNext'); await page.waitForFunction(() => /Your vehicle/.test(document.getElementById('step').textContent));
  ok('step 2: the vehicle picked is filled in', await page.inputValue('[data-k=reg]') === 'PDX 1234' && await page.inputValue('[data-k=make]') === 'Toyota' && await page.inputValue('[data-k=year]') === '2019' && await page.inputValue('[data-k=value]') === '95000');
  ok('make, year, body, seats and engine are drop-downs', (await page.$$('select.fld')).length >= 5 && (await page.$$('select[data-k=make] option')).length > 20);
  await page.selectOption('select[data-k=body]', 'Hatchback'); await page.selectOption('select[data-k=seating]', '5'); await page.selectOption('select[data-k=cc]', '1500');
  await page.click('.opts button:has-text("Used")'); await page.click('.opts button:has-text("Yes")');
  await page.click('#btnNext'); await page.waitForFunction(() => document.getElementById('formErr').textContent);
  ok('on a loan needs the institution', /institution/.test(await txt('#formErr')) && await page.isVisible('#instBox'));
  await page.selectOption('select[data-k=institution]', 'Other'); await page.fill('#instBox .other input', 'Sample Credit Union');
  await page.click('#btnNext'); await page.waitForFunction(() => /The cover/.test(document.getElementById('step').textContent));
  ok('step 3: cover and windscreen come filled from the record, previous insurer too', (await page.$('.opts button.on:has-text("Comprehensive")')) !== null && await page.inputValue('select[data-k=prevInsurer]') === 'Guardian General' && await page.inputValue('[data-k=existingPolicy]') === 'TTMV00000001');
  await page.click('#btnNext'); await page.waitForFunction(() => document.getElementById('formErr').textContent);
  ok('years driving is required', /driving/.test(await txt('#formErr')));
  await page.selectOption('select[data-k=drivingYears]', '10'); await page.selectOption('select[data-k=ncd]', '3 years');
  ok('"Other" on a drop-down took the typed institution', await page.evaluate(() => JSON.parse(localStorage.getItem('rrb-mq-draft')).institution === 'Sample Credit Union'));
  await page.click('#btnNext'); await page.waitForFunction(() => /The driver/.test(document.getElementById('step').textContent));
  await page.fill('[data-k=permit]', 'DP-000000'); await page.click('.opts button:has-text("Yes")');
  await page.click('#btnNext'); await page.waitForFunction(() => document.getElementById('formErr').textContent);
  ok('an accident needs its details', /accident/.test(await txt('#formErr')));
  await page.fill('[data-k=accidentDetails]', 'A small bump in a car park, 2024, no claim made.');
  await page.click('#btnNext'); await page.waitForFunction(() => /Your documents/.test(document.getElementById('step').textContent));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNgYGD4z8DAwMAAAA0IAgCp5mD/AAAAAElFTkSuQmCC', 'base64');
  await page.setInputFiles('input[data-kind=permit]', { name: 'permit.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => /permit\.jpg/.test(document.getElementById('files').textContent));
  ok('a photo is taken in, resized to JPEG, with Remove', /permit\.jpg/.test(await txt('#files')) && (await page.$('.file button')) !== null);
  await page.click('#btnNext'); await page.waitForFunction(() => /Check and send/.test(document.getElementById('step').textContent));
  const rev = await txt('.rev');
  ok('the review shows what she gave, grouped', /PDX 1234/.test(rev) && /Comprehensive/.test(rev) && /TT\$ 95,000/.test(rev) && /car park/.test(rev) && /permit/.test(rev));
  await page.click('#btnNext'); await page.waitForFunction(() => document.getElementById('formErr').textContent);
  ok('nothing goes without the tick', /tick/.test(await txt('#formErr')) && !calls.some(c => c.action === 'submit'));
  await page.check('#agree'); await page.click('#btnNext'); await page.waitForSelector('#s-done:not(.hide)');
  const sub = calls.find(c => c.action === 'submit');
  ok('the request is sent with the facts and the photo, as text/plain JSON', sub && sub.quote.reg === 'PDX 1234' && sub.quote.accidents === 'Yes' && sub.quote.ncd === '3 years' && sub.files.length === 1 && sub.files[0].type === 'image/jpeg' && sub.files[0].data.length > 100);
  ok('the done screen shows the reference and the test-mode line', (await txt('#doneRef')) === 'MQ-261021-001' && /Test mode/.test(await txt('#doneMsg')));
  ok('the draft is cleared after sending', await page.evaluate(() => JSON.parse(localStorage.getItem('rrb-mq-draft') || '{}').sent === true));
  await page.click('#s-done .ghost'); await page.waitForSelector('#s-home:not(.hide)');
  ok('home lists the request with its status', /MQ-261021-001/.test(await txt('#reqs')) && /Sent to quotes desk/.test(await txt('#reqs')));
  ok('nothing runs wider than the phone', await wide());
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#s-home:not(.hide)');
  ok('a reload keeps her signed in (me is asked)', calls.some(c => c.action === 'me'));
  await page.click('#who button'); await page.waitForSelector('#s-signin:not(.hide)');
  ok('sign out returns to the sign-in and forgets the device', await page.evaluate(() => !localStorage.getItem('rrb-mq-session')));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
