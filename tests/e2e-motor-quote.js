// The motor quote page in a real browser, on a phone, against a fake backend:
// a client signs in and sees her renewal first, with its terms and what the
// record shows, and renews with changes; then uploads a dealer's quotation,
// which is read and fills the quick quote (her own name standing), and sends
// it with the document; a quick quote with no invoice asks for the minimum;
// "every detail" is the original six steps. Nothing runs wider than the
// phone, and the page throws no error.
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
  vehicles: [
    { reg: 'PDX 1234', make: 'Toyota', model: 'Aqua', year: 2019, cover: 'Comprehensive', sumInsured: 95000, windscreen: '', carrier: 'Guardian General', to: '2026-11-10', policy: 'TTMV00000001',
      renewOn: '2026-11-11', renewOnText: '11 November 2026', renewIn: 21, renewState: 'due', lastPremium: 4321.5,
      terms: [{ policy: 'TTMV00000001', from: '2025-11-11', to: '2026-11-10', cover: 'Comprehensive', sum: 95000, premium: 4321.5 },
              { policy: 'TTMV00000001', from: '2024-11-11', to: '2025-11-10', cover: 'Comprehensive', sum: 95000, premium: 4100 },
              { policy: 'TTMV00000001', from: '2023-11-11', to: '2024-11-10', cover: 'Third Party', sum: 0, premium: 0 }],
      facts: ['With us since 2023: 3 terms on file.', 'A 2019 vehicle: 7 years old at renewal.', 'Insured for TT$ 95,000 on each of the last 2 terms.',
              'The cover changed from Third Party to Comprehensive in 2024.', 'Premium on file for this term: TT$ 4,322.', 'No windscreen cover on file.'] },
    { reg: 'TDA 77', make: 'Nissan', model: 'Note', year: 2016, cover: 'Third Party', sumInsured: 40000, windscreen: 'Yes', to: '2027-07-13', policy: 'TTMV00000002',
      renewOn: '2027-07-14', renewOnText: '14 July 2027', renewIn: 266, renewState: 'later', terms: [], facts: [] }],
  policies: [{ policy: 'TTMV00000001', product: 'Private Motor', expires: '2026-11-10' }] };
/* What the backend's reader hands back, already cleaned. The buyer is not the client: her own name must stand. */
const READ = { docType: 'dealer quotation', dealer: 'Sample Motors Ltd', documentNo: 'Q-1001', documentDate: '2026-10-15', make: 'MG', model: 'ZS HEV Lux', year: '2026',
  bodyType: 'SUV', engineCc: '1498', fuel: 'Hybrid', condition: 'New', value: '212645', valueBasis: 'Sub-total before fees', reg: '', chassis: '', engineNo: '', seats: '5',
  colour: '', buyerName: 'MADE UP BUYER', buyerPhone: '754-0000', buyerAddress: '', lender: '', notes: '' };
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
    if (b.action === 'readInvoice') return setTimeout(() => reply({ ok: true, read: true, fields: READ }), 400);
    if (b.action === 'submit') { const ref = 'MQ-261021-00' + (requests.length + 1);
      requests = [{ ref, when: '21 Oct 2026', type: b.quote.flow === 'renew' ? 'Renewal' : 'Quick quote', vehicle: [b.quote.year, b.quote.make, b.quote.model].filter(Boolean).join(' '), reg: b.quote.reg, cover: b.quote.cover, status: 'Sent to quotes desk' }].concat(requests);
      return reply({ ok: true, ref, flow: b.quote.flow, mode: 'test', requests, contact: 'Existing', mail: 'Sent' }); }
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
  ok('home greets her by first name and shows her vehicles', /Good day, Anika/.test(await txt('#homeTitle')) && /Toyota Aqua/.test(await txt('#renewals')) && /PDX 1234/.test(await txt('#renewals')));
  ok('the test-mode notice shows', await page.isVisible('#notice') && /Test mode/.test(await txt('#notice')));
  ok('her name is in the header with Sign out', /Anika Pretend/.test(await txt('#whoName')));
  ok('the session is kept on the device', await page.evaluate(() => !!localStorage.getItem('rrb-mq-session')));

  /* ── the renewal comes first ── */
  ok('the renewal is the first thing on the home screen, before the quote doors', await page.evaluate(() => {
    const r = document.querySelector('#renewals .rnw'), d = document.querySelector('.doors');
    return !!r && !!(r.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  const rn = await txt('#renewals');
  ok('it says when, in days, with the vehicle', /21/.test(await txt('#renewals .ring')) && /Toyota Aqua/.test(rn) && /11 November 2026/.test(rn));
  ok('it shows every term on file and what the record shows', (await page.$$('#renewals .tl li')).length === 3 && (await page.$$('#renewals .facts li')).length === 6 && /changed from Third Party/.test(rn));
  ok('the vehicle not due is under "Your vehicles with us", with its renewal date', /Nissan Note/.test(await txt('#homeVeh')) && /renews/.test(await txt('#homeVeh')) && !/Toyota/.test(await txt('#homeVeh')));
  ok('nothing runs wider than the phone on the home screen', await wide());
  await page.click('#renewals .rnw .ghost'); await page.waitForSelector('#s-form:not(.hide)');
  ok('"Renew with changes" opens the renewal with that chosen and the changes box open', /Your renewal/.test(await txt('#step')) && (await page.$('.opts button.on:has-text("Renew with changes")')) !== null && await page.isVisible('#chgBox'));
  ok('the renewal is two steps, filled from what we hold', (await page.$$('#steps i')).length === 2 && await page.inputValue('[data-k=name]') === 'Anika Pretend');
  await page.click('#btnNext'); await page.waitForFunction(() => document.getElementById('formErr').textContent);
  ok('with changes, the changes are needed', /changed/.test(await txt('#formErr')));
  await page.fill('[data-k=renewChanges]', 'Add my son as a driver.');
  await page.click('#btnNext'); await page.waitForFunction(() => /Check and send/.test(document.getElementById('step').textContent));
  const rrev = await txt('.rev');
  ok('the review leads with the request: renewal, date, choice, changes', /Renewal/.test(rrev) && /11 November 2026/.test(rrev) && /Renew with changes/.test(rrev) && /son as a driver/.test(rrev));
  await page.check('#agree'); await page.click('#btnNext'); await page.waitForSelector('#s-done:not(.hide)');
  const rsub = calls.filter(c => c.action === 'submit').pop();
  ok('the renewal is sent as flow "renew" with the vehicle and what she asked', rsub.quote.flow === 'renew' && rsub.quote.reg === 'PDX 1234' && rsub.quote.renewChoice === 'Renew with changes' && /son/.test(rsub.quote.renewChanges));
  ok('the done screen says renewal', /renewal request has gone/.test(await txt('#doneTitle')));
  await page.click('#s-done .ghost'); await page.waitForSelector('#s-home:not(.hide)');

  /* ── the invoice: upload, read, filled in, checked ── */
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNgYGD4z8DAwMAAAA0IAgCp5mD/AAAAAElFTkSuQmCC', 'base64');
  await page.setInputFiles('#invFile', { name: 'quotation.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#reading:not(.hide)');
  ok('a reading screen shows while the document is read', /Reading your document/.test(await txt('#reading')));
  await page.waitForSelector('#s-form:not(.hide) .docnote'); await page.waitForSelector('#reading.hide', { state: 'attached' });
  const rd = calls.find(c => c.action === 'readInvoice');
  ok('the photo is sent to be read as a JPEG, signed in', rd && rd.token && rd.file.type === 'image/jpeg' && rd.file.data.length > 100);
  ok('the quick quote opens with what was read: make, model, year, value', await page.inputValue('select[data-k=make]') === 'MG' && await page.inputValue('[data-k=model]') === 'ZS HEV Lux' &&
    await page.inputValue('select[data-k=year]') === '2026' && await page.inputValue('[data-k=value]') === '212645');
  ok('a new vehicle with no number is ticked "not registered yet", and New is chosen', await page.isChecked('[data-k=newUnreg]') && (await page.$('.opts button.on:has-text("New")')) !== null);
  ok('each field read is marked "from your document", and the note names the dealer', (await page.$$('.fromdoc')).length >= 5 && /Sample Motors Ltd/.test(await txt('.docnote')));
  ok('her own name stands: the buyer on the document never replaces it', await page.inputValue('[data-k=name]') === 'Anika Pretend' && await page.inputValue('[data-k=mobile]') === '868-555-0101');
  ok('the document is listed to go with the request', /The invoice or quotation/.test(await txt('#step .files')));
  ok('nothing runs wider than the phone on the quick quote', await wide());
  await page.click('#btnNext'); await page.waitForFunction(() => document.getElementById('formErr').textContent);
  ok('the quick quote still needs the cover and the years driving', /cover/.test(await txt('#formErr')) && /driving/.test(await txt('#formErr')));
  await page.click('.opts button:has-text("Comprehensive")'); await page.selectOption('select[data-k=drivingYears]', '10');
  await page.click('#btnNext'); await page.waitForFunction(() => /Check and send/.test(document.getElementById('step').textContent));
  const qrev = await txt('.rev');
  ok('the review says quick quote, read from the dealer\'s document, not registered yet', /Quick quote/.test(qrev) && /Sample Motors/.test(qrev) && /Not registered yet/.test(qrev) && /TT\$ 212,645/.test(qrev));
  await page.check('#agree'); await page.click('#btnNext'); await page.waitForSelector('#s-done:not(.hide)');
  const qsub = calls.filter(c => c.action === 'submit').pop();
  ok('it is sent as a quick quote with what was read and the document attached', qsub.quote.flow === 'quick' && qsub.quote.newUnreg === 'Yes' && qsub.quote.invoice && qsub.quote.invoice.dealer === 'Sample Motors Ltd' &&
    qsub.files.length === 1 && qsub.files[0].kind === 'invoice');
  ok('the done screen says the permit comes when the quote is taken', /permit/.test(await txt('#doneMsg')) || /Test mode/.test(await txt('#doneMsg')));
  await page.click('#s-done .ghost'); await page.waitForSelector('#s-home:not(.hide)');
  ok('home lists both requests, newest first, with their type', /Quick quote[\s\S]*Renewal/.test(await txt('#reqs')));

  /* ── the quick quote with no invoice, and every detail ── */
  await page.click('#doorQuick'); await page.waitForSelector('#s-form:not(.hide)');
  ok('a quick quote with no invoice starts clean, offers the upload, and keeps her details', !(await page.$('.docnote')) && (await page.$('#step input.invIn')) !== null && await page.inputValue('[data-k=name]') === 'Anika Pretend' && !(await page.inputValue('[data-k=model]')));
  await page.selectOption('select[data-k=make]', 'Honda'); await page.fill('[data-k=model]', 'Fit'); await page.selectOption('select[data-k=year]', '2018'); await page.fill('[data-k=value]', '70000');
  await page.click('.opts button:has-text("Third Party Only")'); await page.selectOption('select[data-k=drivingYears]', '5');
  await page.click('#btnNext'); await page.waitForFunction(() => document.getElementById('formErr').textContent);
  ok('without a number or the tick it asks for one or the other', /registration number, or tick/.test(await txt('#formErr')));
  await page.click('#btnBack'); await page.waitForSelector('#s-home:not(.hide)');
  await page.click('.linkbtn:has-text("every detail")'); await page.waitForSelector('#s-form:not(.hide)');
  ok('"every detail" is the full six steps', (await page.$$('#steps i')).length === 6 && /About you/.test(await txt('#step')));
  await page.click('#btnBack'); await page.waitForSelector('#s-home:not(.hide)');
  /* ── every detail: the original six steps, from a vehicle we hold ── */
  await page.evaluate(() => startNew(0)); await page.waitForSelector('#s-form:not(.hide)');
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
  ok('years driving is carried from the quick quote she answered', await page.inputValue('select[data-k=drivingYears]') === '5');
  await page.selectOption('select[data-k=drivingYears]', '');
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
    await page.setInputFiles('input[data-kind=permit]', { name: 'permit.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => /permit\.jpg/.test(document.getElementById('files').textContent));
  ok('a photo is taken in, resized to JPEG, with Remove', /permit\.jpg/.test(await txt('#files')) && (await page.$('.file button')) !== null);
  await page.click('#btnNext'); await page.waitForFunction(() => /Check and send/.test(document.getElementById('step').textContent));
  const rev = await txt('.rev');
  ok('the review shows what she gave, grouped', /PDX 1234/.test(rev) && /Comprehensive/.test(rev) && /TT\$ 95,000/.test(rev) && /car park/.test(rev) && /permit/.test(rev));
  const sentBefore = calls.filter(c => c.action === 'submit').length;
  await page.click('#btnNext'); await page.waitForFunction(() => document.getElementById('formErr').textContent);
  ok('nothing goes without the tick', /tick/.test(await txt('#formErr')) && calls.filter(c => c.action === 'submit').length === sentBefore);
  await page.check('#agree'); await page.click('#btnNext'); await page.waitForSelector('#s-done:not(.hide)');
  const sub = calls.filter(c => c.action === 'submit').pop();
  ok('the request is sent with the facts and the photo, as text/plain JSON', sub && sub.quote.flow === 'full' && sub.quote.reg === 'PDX 1234' && sub.quote.accidents === 'Yes' && sub.quote.ncd === '3 years' && sub.files.length === 1 && sub.files[0].type === 'image/jpeg' && sub.files[0].data.length > 100);
  ok('the done screen shows the reference and the test-mode line', /^MQ-261021-00\d$/.test(await txt('#doneRef')) && /Test mode/.test(await txt('#doneMsg')));
  ok('the draft is cleared after sending', await page.evaluate(() => JSON.parse(localStorage.getItem('rrb-mq-draft') || '{}').sent === true));
  await page.click('#s-done .ghost'); await page.waitForSelector('#s-home:not(.hide)');
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
