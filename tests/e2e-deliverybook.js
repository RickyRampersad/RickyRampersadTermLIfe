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
      if (/[?&]action=ping/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, service: 'delivery-book', mode: 'test', docTypes: SESSION.docTypes, relationships: SESSION.relationships, methods: SESSION.methods }) });
      const b = JSON.parse(route.request().postData() || '{}');
      seen.push(b);
      const reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      switch (b.action) {
        case 'lb.login':
          if (String(b.agentNo).toUpperCase() === 'A00999' && b.code === 'ag1') return reply(Object.assign({}, SESSION, { token: 'TA', name: 'Ann Agent', role: 'Agent', agentNo: 'A00999' }));
          if (String(b.agentNo).toUpperCase() === 'A00777' && b.code === 'um1') return reply(Object.assign({}, SESSION, { token: 'TU', name: 'Uma Lead', role: 'Unit Manager', agentNo: 'A00777' }));
          /* As the deployed LogBook.gs answered on 20 October 2026: no lists, and for S002 no Delivery Book. */
          if (String(b.agentNo).toUpperCase() === 'S002' && b.code === 'old1') return reply({ ok: true, token: 'TO', name: 'Liz Staff', role: 'Staff', mode: 'test', agentNo: 'S002',
            apps: [{ id: 'logbook', name: 'Log Book', path: '/rroperations/logbook/', status: 'live' }] });
          if (String(b.agentNo).toUpperCase() === 'S001' && b.code === 'pat1') { const x = Object.assign({}, SESSION); delete x.docTypes; delete x.relationships; delete x.methods; return reply(x); }
          return reply({ ok: false, error: 'That agent number and password do not match.' });
        case 'login':
          return reply(b.code === 'CODE1' ? Object.assign({}, SESSION, { token: 'TC', name: 'Liz Staff' }) : { ok: false, error: 'That code is not on the Delivery Book access list.' });
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

  /* ── the branch app: one sign-in, tiles by role ── */
  const signIn = async (no, pw) => { await page.fill('#no', no); await page.fill('#pw', pw); await page.click('#lockBtn'); };
  const tileNames = () => page.$$eval('.app b', els => els.map(e => e.textContent));
  await page.goto(base + '/rroperations/?api=' + encodeURIComponent(API));
  await signIn('S001', 'nope');
  await page.waitForFunction(() => document.getElementById('lockErr').textContent.length > 0);
  ok('a wrong password is told so', /do not match/.test(await page.textContent('#lockErr')));

  await signIn('A00999', 'ag1');
  await page.waitForSelector('#home:not([hidden])');
  let names = await tileNames();
  ok('an agent sees the Log Book, the clients board and the fact find', ['Log Book', 'My clients board', 'Fact Find'].every(n => names.includes(n)), names.join(', '));
  ok('an agent sees no Delivery Book and no branch screens', !names.includes('Delivery Book') && !names.includes('Clients dashboard'));
  ok('an agent is told they see their own work', /your own/.test(await page.textContent('#scope')));
  await page.click('#signOut');
  ok('signing out clears the phone', await page.evaluate(() => !localStorage.getItem('rrb-ops-session')));

  await signIn('A00777', 'um1');
  await page.waitForSelector('#home:not([hidden])');
  ok('a unit manager is told he sees his team', /team/.test(await page.textContent('#scope')));
  ok('a unit manager has no Delivery Book', !(await tileNames()).includes('Delivery Book'));
  await page.click('#signOut');

  await signIn('S001', 'pat1');
  await page.waitForSelector('#home:not([hidden])');
  names = await tileNames();
  ok('staff see the Delivery Book, group clients and the Premium Due Desk', ['Delivery Book', 'Group clients', 'Premium Due Desk'].every(n => names.includes(n)), names.join(', '));
  // The desk app (21 Oct 2026): petty cash and the gas log are under Forms until they move into the app; Find a tool knows the old names.
  ok('petty cash and the gas log are under Forms', (await page.$$eval('.form-row b', els => els.map(e => e.textContent))).filter(n => /Petty Cash|Gas Log/.test(n)).length === 2);
  await page.fill('#find', 'transmittal');
  ok('Find a tool: "transmittal" finds it', (await tileNames()).join() === 'Transmittal', (await tileNames()).join());
  await page.fill('#find', 'orphan');
  ok('and "orphan" finds the clients board', (await tileNames()).includes('My clients board'));
  await page.fill('#find', '');
  ok('the old names are shown with where they went', /JotForm Delivery Book → Delivery Book/.test(await page.textContent('#moved')));
  ok('test mode is shown', /Test mode/.test(await page.textContent('#who')));
  ok('greets him by name', /Pat/.test(await page.textContent('#hello')));
  ok('nothing runs off a phone', await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  if (SHOTS) await page.screenshot({ path: SHOTS + '/1-launcher.png', fullPage: true });

  /* ── the Delivery Book ── */
  await page.click('a.app[href="/rroperations/delivery-book/"]');
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
  const docOpts = await page.$$eval('.pol.on select option', o => o.map(x => x.textContent));
  ok('staff signed in by agent number can choose a cheque or a contract', docOpts.includes('Cheque') && docOpts.includes('Policy Contract'), docOpts.join(', '));
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
  ok('the Delivery Book refuses someone without it', /does not open the Delivery Book/.test(await p2.textContent('#lockMsg')));
  await p2.evaluate(() => localStorage.removeItem('rrb-ops-session'));
  const p3 = await ctx.newPage();
  await p3.goto(base + '/rroperations/delivery-book/');
  await p3.waitForURL(/rroperations\/\?next=delivery-book/);
  ok('signed out, the Delivery Book sends you to the launcher', true);

  /* Staff whose agent-number sign-in does not carry the Delivery Book: the access code opens it there and then. */
  await page.goto(base + '/rroperations/?api=' + encodeURIComponent(API));
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await signIn('S002', 'old1');
  await page.waitForSelector('#home:not([hidden])');
  await page.goto(base + '/rroperations/delivery-book/?api=' + encodeURIComponent(API));
  await page.waitForSelector('#codeForm:not([hidden])');
  ok('without the Delivery Book on their sign-in, staff are offered their access code', /access code/.test(await page.textContent('#lockMsg')));
  await page.fill('#code', 'CODE1'); await page.click('#codeBtn');
  await page.waitForSelector('#lock', { state: 'hidden' });
  ok('the access code opens the Delivery Book on the spot', await page.$eval('#me', e => /Liz Staff/.test(e.textContent)));
  await page.goto(base + '/rroperations/?api=' + encodeURIComponent(API));
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.click('#useCode'); await page.fill('#code', 'CODE1'); await page.click('#codeBtn');
  await page.waitForSelector('#home:not([hidden])');
  ok('the branch app also takes a staff access code', (await tileNames()).includes('Delivery Book'));

  ok('no script errors', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
