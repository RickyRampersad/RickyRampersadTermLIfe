// The Delivery Book — apps-script/DeliveryBook.gs.
//
// What it promises, held here:
//   - a client is picked from Salesforce, by a policy number typed any way
//     (the org stores "TT FCP 0100001" and "TTFHO0100002" side by side), or
//     by name;
//   - once picked, every policy they hold comes back grouped by record type;
//   - nothing is half-recorded: a delivery missing a signature, a collector's
//     full name, a cheque photo or a location is refused whole;
//   - the client's e-mail carries no GPS, and in test mode goes only to the
//     test inbox;
//   - a contact is created only on an explicit "not in Salesforce";
//   - the star links are signed, one delivery holds one rating, and a
//     client's comment is for the manager.
//
// Invented names and numbers throughout. The repository is public.
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/DeliveryBook.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

/* ── a fake Salesforce ─────────────────────────────────────────────── */
const SF = {
  contacts: [
    { Id: '003000000000001AAA', Name: 'Anika Pretend', FirstName: 'Anika', LastName: 'Pretend', Email: 'anika@example.com',
      Preferred_Email__c: null, MobilePhone: '868-555-0101', Contact_Type__c: 'Client', Account: { Name: 'PRETEND, ANIKA HH' } },
    { Id: '003000000000002AAA', Name: 'Dev Madeup', FirstName: 'Dev', LastName: 'Madeup', Email: 'dev@example.com',
      Preferred_Email__c: null, MobilePhone: '', Contact_Type__c: null, Account: { Name: '' } },
    { Id: '003000000000003AAA', Name: 'Dev Madeup-Sample', FirstName: 'Dev', LastName: 'Madeup-Sample', Email: 'dev@example.com',
      Preferred_Email__c: null, MobilePhone: '', Contact_Type__c: null, Account: { Name: '' } },
    { Id: '003000000000004AAA', Name: 'Noemail Person', FirstName: 'Noemail', LastName: 'Person', Email: null,
      Preferred_Email__c: null, MobilePhone: '', Contact_Type__c: null, Account: { Name: '' } },
  ],
  portfolios: [
    { Id: 'a02000000000001AAA', Name: 'CLIENT-1', POLICY__c: 'TT FCP 0700001', RecordType: { Name: 'PROPERTY' },
      PLAN_NAME__c: 'Home', Contact__c: '003000000000001AAA', City__c: 'Chaguanas', Street__c: '1 Pretend Street' },
    { Id: 'a02000000000002AAA', Name: 'CLIENT-2', POLICY__c: '9000000001', RecordType: { Name: 'LIFE' },
      PLAN_NAME__c: 'Term', Contact__c: '003000000000001AAA', City__c: 'Chaguanas', Street__c: '1 Pretend Street' },
    { Id: 'a02000000000003AAA', Name: 'CLIENT-3', POLICY__c: 'TTMV00000001', RecordType: { Name: 'MOTOR' },
      PLAN_NAME__c: null, Contact__c: '003000000000001AAA', City__c: 'Chaguanas', Street__c: '1 Pretend Street' },
    { Id: 'a02000000000004AAA', Name: 'CLIENT-4', POLICY__c: '8000000001', RecordType: { Name: 'PENSION' },
      PLAN_NAME__c: 'Pension', Contact__c: '003000000000003AAA', City__c: null },
  ],
  queries: [], created: [], patched: [],
};
const ids = s => (String(s).match(/'([^']+)'/g) || []).map(x => x.slice(1, -1));

function sfRoute(url, opts) {
  const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) });
  if (/oauth2\/token/.test(url)) return res(200, { access_token: 'tok', instance_url: 'https://sf.example' });
  const m = url.match(/\/services\/data\/v[\d.]+(\/.*)$/);
  const p = m[1];
  if (p.startsWith('/query?q=')) {
    const q = decodeURIComponent(p.slice(9));
    SF.queries.push(q);
    if (/FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN/.test(q)) {
      const want = ids(q.split(' IN ')[1]);
      return res(200, { records: SF.portfolios.filter(r => want.includes(r.POLICY__c)) });
    }
    if (/FROM CLIENT_PORTFOLIO__c WHERE Contact__c IN/.test(q)) {
      const want = ids(q.split('WHERE')[1].split(') OR')[0]);
      return res(200, { records: SF.portfolios.filter(r => want.includes(r.Contact__c)) });
    }
    if (/FROM CLIENT_PORTFOLIO__c WHERE Contact__c =/.test(q)) {
      const want = ids(q)[0];
      return res(200, { records: SF.portfolios.filter(r => r.Contact__c === want && r.City__c) });
    }
    if (/FROM Contact WHERE Id/.test(q)) {
      const want = ids(q);
      return res(200, { records: SF.contacts.filter(c => want.includes(c.Id)) });
    }
    if (/FROM Contact WHERE Email =/.test(q)) {
      const want = ids(q)[0];
      return res(200, { records: SF.contacts.filter(c => c.Email === want) });
    }
    return res(200, { records: [] });
  }
  if (p.startsWith('/search?q=')) {
    const q = decodeURIComponent(p.slice(10));
    const words = (q.match(/\{([^}]+)\}/) || [])[1].split(' AND ').map(w => w.replace('*', '').toLowerCase());
    return res(200, { searchRecords: SF.contacts.filter(c => words.every(w => c.Name.toLowerCase().includes(w))) });
  }
  if (/^\/sobjects\/(Contact|Task)$/.test(p) && opts.method === 'post') {
    const body = JSON.parse(opts.payload);
    const id = (p.includes('Task') ? '00T' : '003') + '0000000000NEW' + SF.created.length;
    SF.created.push({ type: p.split('/')[2], body, id });
    return res(201, { id, success: true });
  }
  if (/^\/sobjects\/Contact\//.test(p) && opts.method === 'patch') {
    SF.patched.push({ p, body: JSON.parse(opts.payload) });
    return { getResponseCode: () => 204, getContentText: () => '' };
  }
  return res(404, [{ message: 'not found ' + p }]);
}

function world(props) {
  const env = makeEnv({ props: Object.assign({ SF_KEY: 'k', SF_SECRET: 's', DB_TEST_INBOX: 'test@example.com' }, props || {}) });
  env.UrlFetchApp = { fetch: (u, o) => sfRoute(u, o || {}) };
  env.__mail = [];
  env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 50 };
  env.__files = [];
  env.DriveApp = {
    getFolderById: () => ({ createFile: b => { env.__files.push(b); return { getUrl: () => 'https://drive.example/f' + env.__files.length }; } }),
    createFolder: () => ({ getId: () => 'folder1', createFile: b => { env.__files.push(b); return { getUrl: () => 'https://drive.example/f' + env.__files.length }; } }),
  };
  env.Utilities.newBlob = (bytes, type, name) => ({ bytes, type, name });
  env.Utilities.base64Decode = s => Array.from(Buffer.from(s, 'base64'));
  env.Maps = { newGeocoder: () => ({
    setRegion() { return this; },
    reverseGeocode: () => ({ results: [{ formatted_address: '2 Sample Road, Chaguanas' }] }),
    geocode: () => ({ results: [{ geometry: { location: { lat: 10.5170, lng: -61.4110 } } }] }),
  }) };
  env.Session = { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) };
  env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'], [
    ['Pat Courier', 'pat@example.com', 'PAT1', 'Staff', '005000000000001AAA', 'Yes', 'delivery-book, gas-receipts'],
    ['Mo Manager', 'mo@example.com', 'MGR9', 'Branch Manager', '', 'Yes', ''],
    ['Old Hand', 'old@example.com', 'GONE', 'Staff', '', 'No', ''],
    ['Cash Only', 'cash@example.com', 'CASH', 'Staff', '', 'Yes', 'petty-cash'],
  ]);
  return env;
}

const SIG = 'data:image/png;base64,' + Buffer.from('signature').toString('base64');
const PHOTO = 'data:image/jpeg;base64,' + Buffer.from('photo').toString('base64');
const deliveryBase = () => ({
  method: 'In person', contactId: '003000000000001AAA',
  items: [
    { document: 'Certificate', policy: 'TT FCP 0700001', type: 'PROPERTY', portfolioId: 'a02000000000001AAA', quantity: 1 },
    { document: 'Policy Contract', policy: '9000000001', type: 'LIFE', portfolioId: 'a02000000000002AAA', quantity: 1 },
  ],
  collectorFirst: 'Anika', collectorLast: 'Pretend', relationship: 'Self', signature: SIG,
  lat: 10.5176, lng: -61.4138, accuracy: 12,
});

/* ── sign-in ───────────────────────────────────────────────────────── */
console.log('sign-in');
{
  const env = world();
  ok('a wrong code is refused', throws(() => env.dbLogin_({ code: 'nope' }), /not on the Delivery Book access list/));
  ok('an inactive code is refused', throws(() => env.dbLogin_({ code: 'gone' })));
  const s = env.dbLogin_({ code: ' pat1 ' });
  ok('a code is case- and space-blind', s.ok && s.name === 'Pat Courier');
  ok('the session resolves', env.dbSession_(s.token).sfUser === '005000000000001AAA');
  ok('no token, no session', env.dbSession_('') === null && env.dbSession_('made-up') === null);
  const post = JSON.parse(env.doPost({ postData: { contents: JSON.stringify({ action: 'lookup', token: 'bad', name: 'x' }) } }).getContent());
  ok('a request without a session is signed-out', post.error === 'signed-out');
}

/* ── RR Operations: who sees which app ─────────────────────────────── */
console.log('apps');
{
  const env = world();
  const post = b => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(b) } }).getContent());
  const pat = env.dbLogin_({ code: 'PAT1' });
  ok('Pat sees the apps on his row', pat.apps.map(a => a.id).join(',') === 'delivery-book,gas-receipts');
  ok('an app not built yet comes back as soon', pat.apps.find(a => a.id === 'gas-receipts').status === 'soon');
  const mo = env.dbLogin_({ code: 'MGR9' });
  ok('a blank Apps cell means every app', mo.apps.length === 3);
  const again = post({ action: 'apps', token: pat.token });
  ok('the launcher can ask again with the token', again.ok && again.apps.length === 2);
  const cash = env.dbLogin_({ code: 'CASH' });
  ok('someone without the Delivery Book does not see it', !cash.apps.some(a => a.id === 'delivery-book'));
  const refused = post({ action: 'lookup', token: cash.token, name: 'anika' });
  ok('and is refused by the server, not just hidden', !refused.ok && /not on your access/.test(refused.error));
}

/* ── finding the client ────────────────────────────────────────────── */
console.log('lookup');
{
  const env = world();
  const v = env.dbPolicyVariants_('ttfcp0700001');
  ok('a compact policy number also asks for the spaced form', v.includes('TT FCP 0700001'), v.join(' | '));
  const who = { name: 'Pat Courier', role: 'Staff', sfUser: '' };
  const byPol = env.dbLookup_({ policy: 'ttfcp0700001' }, who);
  ok('policy typed compact finds the spaced record', byPol.via === 'policy' && byPol.clients.length === 1 &&
     byPol.clients[0].id === '003000000000001AAA');
  const none = env.dbLookup_({ policy: 'TT XXX 0000000' }, who);
  ok('an unknown policy says so and suggests the name', none.clients.length === 0 && /name/.test(none.note));
  const byName = env.dbLookup_({ name: 'dev madeup' }, who);
  ok('a name finds both spellings', byName.clients.length === 2);
  ok('two contacts sharing an e-mail are flagged, not merged',
     byName.clients.every(c => c.sameEmailAs.length === 1));
  ok('a quote in a name cannot break the search', !throws(() => env.dbLookup_({ name: "O'Pretend" }, who)));
}

/* ── the client's policies ─────────────────────────────────────────── */
console.log('policies');
{
  const env = world();
  const who = { name: 'Pat Courier', role: 'Staff', sfUser: '' };
  const out = env.dbPolicies_({ contactIds: ['003000000000001AAA'] }, who);
  const types = out.groups.map(g => g.type);
  ok('grouped by record type, Life first', types.join(',') === 'LIFE,MOTOR,PROPERTY', types.join(','));
  ok('each policy carries its portfolio id', out.groups[0].policies[0].portfolioId === 'a02000000000002AAA');
  ok('the client comes back with them', out.client && out.client.name === 'Anika Pretend');
  const dup = env.dbPolicies_({ contactIds: ['003000000000002AAA', '003000000000003AAA'] }, who);
  ok('a duplicate record\'s policies are listed too', dup.groups.some(g => g.type === 'PENSION') && dup.alsoFiled.length === 1);
  ok('an id that is not a Salesforce id is refused',
     throws(() => env.dbPolicies_({ contactIds: ["x' OR Id != '"] }, who), /Pick the client/));
}

/* ── nothing half-recorded ─────────────────────────────────────────── */
console.log('validation');
{
  const env = world();
  const who = { name: 'Pat Courier', role: 'Staff', sfUser: '' };
  const tryIt = (patch) => { const d = Object.assign(deliveryBase(), patch); return () => env.dbSubmit_({ delivery: d }, who); };
  ok('no signature, refused', throws(tryIt({ signature: '' }), /sign/));
  ok('collector without a last name, refused', throws(tryIt({ collectorLast: '' }), /first and last name/));
  ok('no relationship, refused', throws(tryIt({ relationship: '' }), /related/));
  ok('a cheque without a photo, refused',
     throws(tryIt({ items: [{ document: 'Cheque', policy: '', quantity: 1 }] }), /photo/));
  ok('no GPS and no reason, refused', throws(tryIt({ lat: null, lng: null }), /location/));
  ok('a certificate without a policy number, refused',
     throws(tryIt({ items: [{ document: 'Certificate', policy: '' }] }), /policy number/));
  ok('no client, refused', throws(tryIt({ contactId: '' }), /Pick the client/));
  ok('nothing was written by any of those', !env.__sheets['Deliveries'] || env.__sheets['Deliveries']._grid.length === 1);
}

/* ── test mode ─────────────────────────────────────────────────────── */
console.log('submit, test mode');
{
  const env = world();
  const who = env.dbSession_(env.dbLogin_({ code: 'PAT1' }).token);
  const r = env.dbSubmit_({ delivery: deliveryBase() }, who);
  ok('accepted with a reference', r.ok && /^DB-\d{6}-[A-Z0-9]{4}$/.test(r.ref), r.ref);
  const grid = env.__sheets['Deliveries']._grid;
  ok('one row per item', grid.length === 3);
  const h = grid[0];
  const col = n => grid[1][h.indexOf(n)];
  ok('the pin and address are on the row', /google\.com\/maps\?q=10\.5176/.test(col('Pin')) && /Chaguanas/.test(col('Address')));
  ok('distance from the address on file is measured', typeof col('Distance From Client (km)') === 'number');
  ok('no Salesforce write in test mode', SF.created.length === 0 && col('Salesforce Task') === 'Skipped (test mode)');
  ok('the e-mail went only to the test inbox', env.__mail.length === 1 && env.__mail[0].to === 'test@example.com');
  ok('it names the client it was for', /would have gone to <b>anika@example\.com/.test(env.__mail[0].htmlBody));
  ok('the client e-mail carries no GPS', !/10\.517|maps\?q=|Sample Road/.test(env.__mail[0].htmlBody));
  ok('it carries five signed star links', (env.__mail[0].htmlBody.match(/\?rate=DB-[^"]+&amp;s=\d&amp;k=/g) || []).length === 5);
  ok('replies go to Sales Support by default', /salessupport/.test(env.__mail[0].replyTo));
  ok('signature saved to Drive', env.__files.length === 1 && /signature/.test(env.__files[0].name));
}

/* ── live ──────────────────────────────────────────────────────────── */
console.log('submit, live');
{
  SF.created.length = 0; SF.patched.length = 0;
  const env = world({ DB_MODE: 'live', DB_SF_OWNER: '005000000000009AAA' });
  const who = { name: 'Pat Courier', role: 'Staff', sfUser: '005000000000001AAA' };
  const r = env.dbSubmit_({ delivery: deliveryBase() }, who);
  const task = SF.created.find(c => c.type === 'Task');
  ok('a completed Servicing task is filed', task && task.body.Status === 'Completed' && task.body.Task_Type__c === 'Servicing');
  ok('on the client and the first policy', task.body.WhoId === '003000000000001AAA' && task.body.WhatId === 'a02000000000001AAA');
  ok('owned by the person who delivered', task.body.OwnerId === '005000000000001AAA');
  ok('the e-mail went to the client', env.__mail[0].to === 'anika@example.com' && r.emailStatus === 'Sent');

  const d2 = Object.assign(deliveryBase(), { contactId: '', newContact: { first: 'New', last: 'Client', email: 'anika@example.com' } });
  ok('a new client without "not in Salesforce" is refused',
     throws(() => env.dbSubmit_({ delivery: d2 }, who), /Not in Salesforce/));
  const before = SF.created.filter(c => c.type === 'Contact').length;
  const r2 = env.dbSubmit_({ delivery: Object.assign(d2, { notInSalesforce: true }) }, who);
  ok('an e-mail already on file is matched, not created',
     SF.created.filter(c => c.type === 'Contact').length === before && /Matched by e-mail/.test(r2.contactAction));
  const d3 = Object.assign(deliveryBase(), { contactId: '', notInSalesforce: true,
    newContact: { first: 'Brand', last: 'Newperson', email: 'brand@example.com' } });
  const r3 = env.dbSubmit_({ delivery: d3 }, who);
  const made = SF.created.find(c => c.type === 'Contact');
  ok('a genuinely new client is created, as a Client, owned by the person', made && made.body.Contact_Type__c === 'Client' &&
     made.body.OwnerId === '005000000000001AAA' && r3.contactAction === 'Created');

  const d4 = Object.assign(deliveryBase(), { contactId: '003000000000004AAA', email: 'typed@example.com' });
  env.dbSubmit_({ delivery: d4 }, who);
  ok('an e-mail typed for a client with none is saved to Salesforce',
     SF.patched.some(x => x.body.Email === 'typed@example.com'));
  const d5 = Object.assign(deliveryBase(), { email: 'other@example.com' });
  const r5 = env.dbSubmit_({ delivery: d5 }, who);
  ok('an e-mail typed over one on file is flagged, never used',
     r5.flags.some(f => /differs/.test(f)) && env.__mail[env.__mail.length - 1].to === 'anika@example.com');

  const d6 = Object.assign(deliveryBase(), { lat: null, lng: null, locationNote: 'Phone location off' });
  const r6 = env.dbSubmit_({ delivery: d6 }, who);
  ok('no GPS with a reason is accepted and flagged', r6.ok && r6.flags.some(f => /No GPS/.test(f)) && !r6.pin);
}

/* ── stars ─────────────────────────────────────────────────────────── */
console.log('rating');
{
  const env = world({ DB_MODE: 'live' });
  const who = { name: 'Pat Courier', role: 'Staff', sfUser: '' };
  const r = env.dbSubmit_({ delivery: deliveryBase() }, who);
  const k = env.dbSign_(r.ref);
  const page = env.doGet({ parameter: { rate: r.ref, s: '4', k } }).getContent();
  ok('a signed tap is thanked', /Thank you for rating Pat/.test(page));
  const tab = () => env.__sheets['Ratings']._grid;
  ok('and recorded against the delivery and the person', tab().length === 2 && tab()[1][1] === 4 && tab()[1][3] === 'Pat Courier');
  const forged = env.doGet({ parameter: { rate: r.ref, s: '1', k: 'forged' } }).getContent();
  ok('an edited link is refused', /expired/.test(forged) && tab()[1][1] === 4);
  env.doGet({ parameter: { rate: r.ref, s: '5', k } });
  ok('a second tap changes it, one row per delivery', tab().length === 2 && tab()[1][1] === 5);
  env.doGet({ parameter: { rate: r.ref, s: '5', k, c: 'Very polite and on time' } });
  ok('a comment is kept', tab()[1][2] === 'Very polite and on time');

  const staff = env.dbBook_({ days: 30 }, { name: 'Pat Courier', role: 'Staff' });
  const mine = staff.deliveries.find(x => x.ref === r.ref);
  ok('the book shows the stars', mine.stars === 5);
  ok('staff do not see the comment', !('comment' in mine));
  const mgr = env.dbBook_({ days: 30 }, { name: 'Mo Manager', role: 'Branch Manager' });
  ok('the manager does', mgr.deliveries.find(x => x.ref === r.ref).comment === 'Very polite and on time');
  ok('each person\'s average', mgr.team.length === 1 && mgr.team[0].average === 5 && mgr.team[0].ratings === 1);

  const envT = world();
  const rt = envT.dbSubmit_({ delivery: deliveryBase() }, who);
  envT.doGet({ parameter: { rate: rt.ref, s: '1', k: envT.dbSign_(rt.ref) } });
  ok('a test-mode rating never counts in an average', envT.dbBook_({}, { role: 'Branch Manager' }).team.length === 0);
}

/* ── the Jotform history ───────────────────────────────────────────── */
console.log('history');
{
  const env = world();
  env.__mkSheet('Form responses', 2, ['Submission Date', 'Delivery Date & Time', 'Delivered by ', 'Client Name - First Name',
    'Client Name - Last Name', "Client's Email", 'Configurable list', 'Person Collected the Documents - First Name',
    'Person Collected the Documents - Last Name', 'File Upload', 'Signature of Person Recieving', 'Document Delivered by RRB',
    'Geo Stamp', 'Geo Stamp', 'Submission IP', 'Submission URL', 'Submission Edit URL', 'Last Update Date', 'Submission ID'], [
    ['2026-08-18 11:55:10', '08-18-2026 11:53 AM', 'Pat', 'Anika', 'Pretend', '',
     'Client Name: Anika Pretnd , Policy #: TT APU 0000001, Document: Certificate', 'Anika', 'Pretend', '',
     'https://example.com/sig.png', '',
     '2026-08-18 11:55AM -0400\nStreet: Sample Street\nCity: Port of Spain\nLatitude: 10.66\nLongitude: -61.51', '', '', '', '', '', '111'],
    ['2026-08-25 11:06:50', '08-25-2026 2:04 PM', 'Pat', 'Dev', 'Madeup', '',
     'Client Name: Dev, Policy #: 8000000001, Document: Policy Contract', 'Someone', '', '', '', '',
     '2026-08-25 11:06AM -0400', '', '', '', '', '', '222'],
  ]);
  ok('imports both', /Imported 2/.test(env.importJotformHistory()));
  const g = env.__sheets['Deliveries']._grid, h = g[0];
  const at = (r, n) => g[r][h.indexOf(n)];
  ok('policy and document split out of the one text field', at(1, 'Policy #') === 'TT APU 0000001' && at(1, 'Document') === 'Certificate');
  ok('GPS read out of the geo stamp', at(1, 'Latitude') === 10.66 && /maps\?q=10\.66/.test(at(1, 'Pin')));
  ok('the afternoon time is read as afternoon', at(2, 'Delivered At').getHours() === 14);
  ok('the gaps are flagged', /No signature/.test(at(2, 'Flags')) && /Collector name incomplete/.test(at(2, 'Flags')) && /No GPS/.test(at(2, 'Flags')));
  ok('running it again copies nothing', /Imported 0/.test(env.importJotformHistory()));
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
