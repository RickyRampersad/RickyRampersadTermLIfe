// RR Operations → Delivery Book, on a phone, end to end against a fake backend.
//
// Pawan signs in on the launcher, sees his apps (one live, two coming), opens
// the Delivery Book, finds a client by a policy typed without spaces, gets
// their policies grouped by record type with that policy already ticked,
// ticks a second, signs, and records it. Then the book shows the stars.
//
// Invented names throughout. External requests (fonts, map tiles, Leaflet)
// are cut off, so the page must cope without the map library.
//
// Run: node tests/e2e-deliverybook.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const API = 'https://fake.api/exec';

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const APPS = [
  { id: 'delivery-book', name: 'Delivery Book', path: '/rroperations/delivery-book/', status: 'live', blurb: 'Log a handover' },
  { id: 'gas-receipts', name: 'Gas Receipt Tracker', path: '/rroperations/gas-receipts/', status: 'soon', blurb: 'Fuel receipts' },
  { id: 'petty-cash', name: 'Petty Cash Tracker', path: '/rroperations/petty-cash/', status: 'soon', blurb: 'The float' },
];
const SESSION = { ok: true, token: 'T1', name: 'Pat Courier', role: 'Staff', mode: 'test', apps: APPS,
  docTypes: ['Policy Contract', 'Certificate', 'Cheque', 'Renewal Notice', 'Cover Note', 'Claim Payment', 'Endorsement', 'Other'],
  relationships: ['Self', 'Spouse', 'Family', 'Employee', 'Other'], methods: ['In person', 'Left at office', 'Courier'] };
const CLIENT = { id: '003000000000001AAA', name: 'Anika Pretend', first: 'Anika', last: 'Pretend', email: 'anika@example.com',
                 mobile: '868-555-0101', type: 'Client', account: 'PRETEND, ANIKA HH', sameEmailAs: [] };
const POLICIES = { ok: true, client: CLIENT, alsoFiled: [], groups: [
  { type: 'LIFE', policies: [{ portfolioId: 'a02000000000002AAA', policy: '9000000001', type: 'LIFE', plan: 'Term', status: 'In force', issued: '2024-03-01' }] },
  { type: 'MOTOR', policies: [{ portfolioId: 'a02000000000003AAA', policy: 'TTMV00000001', type: 'MOTOR', plan: '', status: '', issued: '' }] },
  { type: 'PROPERTY', policies: [{ portfolioId: 'a02000000000001AAA', policy: 'TT FCP 0700001', type: 'PROPERTY', plan: 'Home', status: '', issued: '' }] },
] };
const seen = [];

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    geolocation: { latitude: 10.5176, longitude: -61.4138, accuracy: 15 }, permissions: ['geolocation'], hasTouch: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (u.startsWith(API)) {
      const b = JSON.parse(route.request().postData() || '{}');
      seen.push(b);
      const reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      switch (b.action) {
        case 'login': return reply(b.code.toUpperCase() === 'PAT1' ? SESSION : { ok: false, error: 'That code is not on the Delivery Book access list.' });
        case 'apps': return reply({ ok: true, apps: APPS, mode: 'test' });
        case 'lookup': return reply({ ok: true, via: 'policy', policy: 'TT FCP 0700001', clients: [CLIENT] });
        case 'policies': return reply(POLICIES);
        case 'submit': return reply({ ok: true, ref: 'DB-261015-AB12', mode: 'test', client: 'Anika Pretend', emailStatus: 'Test copy sent',
          task: 'Skipped (test mode)', pin: 'https://www.google.com/maps?q=10.517600,-61.413800', address: '2 Sample Road, Chaguanas',
          distanceKm: 0.3, flags: [], contactAction: 'Existing' });
        case 'book': return reply({ ok: true, team: [{ name: 'Pat Courier', ratings: 3, average: 4.7 }], deliveries: [
          { ref: 'DB-261015-AB12', deliveredAt: new Date().toISOString(), by: 'Pat Courier', client: 'Anika Pretend', collector: 'Anika Pretend',
            relationship: 'Self', lat: 10.5176, lng: -61.4138, pin: 'https://www.google.com/maps?q=10.5176,-61.4138', address: '2 Sample Road, Chaguanas',
            email: 'Test copy sent', source: 'App (test)', signed: true, stars: 5,
            items: [{ document: 'Certificate', policy: 'TT FCP 0700001' }, { document: 'Policy Contract', policy: '9000000001' }] },
          { ref: 'JF-1', deliveredAt: new Date(Date.now() - 86400000 * 30).toISOString(), by: 'Pat', client: 'Dev Madeup', collector: 'Someone',
            relationship: '', lat: null, lng: null, pin: '', email: 'Not sent (imported)', source: 'Jotform', signed: false,
            items: [{ document: 'Certificate', policy: 'TT APU 0000001' }] }] });
        case 'signOut': return reply({ ok: true });
      }
      return reply({ ok: false, error: 'unknown' });
    }
    return route.abort();
  });

  /* ── the launcher ── */
  await page.goto(base + '/rroperations/?api=' + encodeURIComponent(API));
  await page.fill('#code', 'nope'); await page.click('#lockBtn');
  await page.waitForFunction(() => document.getElementById('lockErr').textContent.length > 0);
  ok('a wrong code is told so', /not on the Delivery Book access list/.test(await page.textContent('#lockErr')));
  await page.fill('#code', 'pat1'); await page.click('#lockBtn');
  await page.waitForSelector('#home:not([hidden])');
  const tiles = await page.$$eval('.app', els => els.map(e => ({ t: e.querySelector('b').textContent, live: e.tagName === 'A' })));
  ok('three apps on the launcher', tiles.length === 3, JSON.stringify(tiles));
  ok('the Delivery Book opens; the two trackers are coming soon',
     tiles[0].live && !tiles[1].live && !tiles[2].live && (await page.$$('.badge')).length === 2);
  ok('greets him by name', /Pat/.test(await page.textContent('#hello')));
  if (SHOTS) await page.screenshot({ path: SHOTS + '/1-launcher.png', fullPage: true });

  /* ── the Delivery Book ── */
  await page.click('a.app');
  await page.waitForURL(/delivery-book/);
  await page.waitForSelector('#lock[hidden]', { state: 'attached' });
  ok('signed in already, no second code', await page.$eval('#lock', e => e.hidden));
  ok('test mode is shown', (await page.textContent('#modePill')).trim() === 'TEST');
  await page.fill('#q', 'ttfcp0700001'); await page.click('#findBtn');
  await page.waitForSelector('.pol');
  const lookup = seen.find(s => s.action === 'lookup');
  ok('a number is looked up as a policy', lookup && lookup.policy === 'ttfcp0700001' && !lookup.name);
  const groups = await page.$$eval('.grp h3 span:first-child', e => e.map(x => x.textContent));
  ok('policies grouped by record type', groups.join(',') === 'LIFE,MOTOR,PROPERTY', groups.join(','));
  const ticked = await page.$$eval('.pol.on .num', e => e.map(x => x.textContent));
  ok('the policy that found her is already ticked', ticked.length === 1 && ticked[0] === 'TT FCP 0700001', ticked.join());
  const docOfHit = await page.$eval('.pol.on select', s => s.value);
  ok('a property policy defaults to a certificate', docOfHit === 'Certificate');
  await page.click('.grp:first-child .pol .head');     // tick the LIFE policy
  ok('a life policy defaults to a policy contract', (await page.$eval('.grp:first-child .pol select', s => s.value)) === 'Policy Contract');
  ok('her e-mail on file is shown and locked', await page.$eval('#email', e => e.readOnly && e.value === 'anika@example.com'));
  ok('the collector starts as the client', (await page.inputValue('#cFirst')) === 'Anika');
  await page.waitForFunction(() => /captured/.test(document.getElementById('locText').textContent));
  ok('location captured on reaching the handover', /±15 m/.test(await page.textContent('#locSub')));

  await page.click('#submitBtn');
  ok('no relationship, refused on the page', /who collected/.test(await page.textContent('#subErr')));
  await page.selectOption('#rel', 'Self');
  await page.click('#submitBtn');
  ok('no signature, refused on the page', /sign/.test(await page.textContent('#subErr')));
  const box = await (await page.$('#sig')).boundingBox();
  await page.mouse.move(box.x + 30, box.y + 100); await page.mouse.down();
  for (let i = 0; i < 12; i++) await page.mouse.move(box.x + 40 + i * 20, box.y + 80 + (i % 2) * 40);
  await page.mouse.up();
  if (SHOTS) await page.screenshot({ path: SHOTS + '/2-delivery-form.png', fullPage: true });
  await page.click('#submitBtn');
  await page.waitForSelector('#result:not([hidden])');
  const sub = seen.find(s => s.action === 'submit');
  ok('two items sent, each with its portfolio', sub.delivery.items.length === 2 && sub.delivery.items.every(i => /^a02/.test(i.portfolioId)));
  ok('signature sent as a PNG', /^data:image\/png;base64,/.test(sub.delivery.signature));
  ok('GPS sent', sub.delivery.lat === 10.5176 && sub.delivery.accuracy === 15);
  ok('the client was picked, not typed', sub.delivery.contactId === CLIENT.id && !sub.delivery.notInSalesforce);
  ok('the reference is shown', /DB-261015-AB12/.test(await page.textContent('#result')));
  if (SHOTS) await page.screenshot({ path: SHOTS + '/3-recorded.png', fullPage: true });

  /* ── the book ── */
  await page.click('[data-tab=book]');
  await page.waitForSelector('.entry');
  ok('team average shown', /4\.7 from 3 ratings/.test(await page.textContent('#team')));
  ok('stars on the delivery', (await page.$$eval('.entry:first-child .stars .off', e => e.length)) === 0 &&
     /★★★★★/.test(await page.textContent('.entry:first-child .stars')));
  ok('the imported Jotform row shows its gaps', /No signature/.test(await page.textContent('.entry:nth-child(2)')) &&
     /No GPS/.test(await page.textContent('.entry:nth-child(2)')));
  if (SHOTS) await page.screenshot({ path: SHOTS + '/4-book.png', fullPage: true });
  await page.click('[data-tab=map]');
  await page.waitForTimeout(150);
  ok('without the map library the map says so, not a blank', /could not load/.test(await page.textContent('#mapNote')));

  /* ── an app not on someone's access ── */
  const p2 = await ctx.newPage();
  await p2.goto(base + '/rroperations/');
  await p2.evaluate(() => localStorage.setItem('rrb-ops-session', JSON.stringify({ token: 'T2', name: 'Cash Only', apps: [
    { id: 'petty-cash', name: 'Petty Cash Tracker', path: '/rroperations/petty-cash/', status: 'soon' }] })));
  await p2.goto(base + '/rroperations/delivery-book/');
  await p2.waitForTimeout(200);
  ok('the Delivery Book refuses someone without it', /not on your access/.test(await p2.textContent('#lockMsg')));
  await p2.evaluate(() => localStorage.removeItem('rrb-ops-session'));
  const p3 = await ctx.newPage();
  await p3.goto(base + '/rroperations/delivery-book/');
  await p3.waitForURL(/rroperations\/\?next=delivery-book/);
  ok('signed out, the Delivery Book sends you to the launcher', true);

  ok('no script errors', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
