// The bills in support@ (26 November 2026): the door finds each group's Health and Life billing e-mails in support@ and
// reads them on the page, so nobody uploads a file, and the approval keeps a reference to the e-mail instead of a copy in
// Drive. GroupBilling.gs runs in a sandbox; Microsoft Graph, the cache and Drive are made of nothing, and every group,
// e-mail and file is invented. Run: node tests/test-billing-mail.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };

const store = {};
const cache = { get: k => (k in store ? store[k] : null), put: (k, v) => { store[k] = String(v); }, putAll: o => Object.assign(store, o), getAll: ks => { const o = {}; ks.forEach(k => { if (k in store) o[k] = store[k]; }); return o; }, remove: k => { delete store[k]; } };
const blob = (bytes, type, name) => ({ bytes, type, name, getBytes: () => bytes, getName: () => name, setName: n => { name = n; } });
const Utilities = { newBlob: (b, type, name) => blob(Buffer.from(b), type, name), base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b).toString('base64') };

/* the mailbox: support@ as the branch has it on 26 November, with invented groups */
const PDF = Buffer.from('%PDF-1.4 invented bill').toString('base64');
const MAILS = [
  { id: 'M1', subject: 'HARBOUR POINT LOGISTICS LIMITED - December 2026 Health Billing', from: { emailAddress: { address: 'easiconnect@myguardiangroup.com' } }, receivedDateTime: '2026-11-25T12:15:00Z', hasAttachments: true,
    att: [{ id: 'A1', name: 'HARBOUR_DEC2026.pdf', contentType: 'application/pdf', size: 98000, isInline: false }, { id: 'A1b', name: 'logo.png', contentType: 'image/png', size: 900, isInline: true }] },
  { id: 'M2', subject: 'Fw: HARBOUR POINT LOGISTICS LIMITED - December 2026 Health Billing', from: { emailAddress: { address: 'support@rickyrampersadbranch.com' } }, receivedDateTime: '2026-11-26T12:04:00Z', hasAttachments: true,
    att: [{ id: 'A2', name: 'HARBOUR_DEC2026.pdf', contentType: 'application/pdf', size: 98000, isInline: false }] },
  { id: 'M3', subject: 'HARBOUR POINT LOGISTICS LIMITED - December 2026 Life Billing', from: { emailAddress: { address: 'premiumsapplicationunit@myguardiangroup.com' } }, receivedDateTime: '2026-11-25T14:00:00Z', hasAttachments: true,
    att: [{ id: 'A3', name: 'Member bill.pdf', contentType: 'application/pdf', size: 120000, isInline: false }, { id: 'A4', name: 'Statement of adjustment.pdf', contentType: 'application/pdf', size: 40000, isInline: false }, { id: 'A5', name: 'Letter.pdf', contentType: 'application/pdf', size: 30000, isInline: false }] },
  { id: 'M4', subject: 'HARBOUR POINT LOGISTICS LIMITED - November 2026 Health Billing', from: { emailAddress: { address: 'easiconnect@myguardiangroup.com' } }, receivedDateTime: '2026-10-26T12:00:00Z', hasAttachments: true,
    att: [{ id: 'A6', name: 'HARBOUR_NOV2026.pdf', contentType: 'application/pdf', size: 97000, isInline: false }] },
  /* ours, about the bill, with no PDF of a bill: never listed */
  { id: 'M5', subject: 'HARBOUR POINT LOGISTICS LIMITED – December 2026 Group Health bill: 3 points to confirm', from: { emailAddress: { address: 'support@rickyrampersadbranch.com' } }, receivedDateTime: '2026-11-26T13:29:00Z', hasAttachments: false, att: [] },
  /* another group's bill that the search also turned up: never listed for Harbour */
  { id: 'M6', subject: 'CORAL BAY TRADERS - December 2026 Health Billing', from: { emailAddress: { address: 'easiconnect@myguardiangroup.com' } }, receivedDateTime: '2026-11-25T12:16:00Z', hasAttachments: true,
    att: [{ id: 'A7', name: 'CORAL_DEC2026.pdf', contentType: 'application/pdf', size: 90000, isInline: false }] },
  /* a payment notice that names the group and has a PDF, but is not a bill */
  { id: 'M7', subject: 'HARBOUR POINT LOGISTICS LIMITED - payment receipt', from: { emailAddress: { address: 'hr@harbour.example' } }, receivedDateTime: '2026-11-20T10:00:00Z', hasAttachments: true,
    att: [{ id: 'A8', name: 'receipt.pdf', contentType: 'application/pdf', size: 20000, isInline: false }] },
  /* too old */
  { id: 'M8', subject: 'HARBOUR POINT LOGISTICS LIMITED - April 2026 Health Billing', from: { emailAddress: { address: 'easiconnect@myguardiangroup.com' } }, receivedDateTime: '2026-04-25T12:00:00Z', hasAttachments: true,
    att: [{ id: 'A9', name: 'HARBOUR_APR2026.pdf', contentType: 'application/pdf', size: 95000, isInline: false }] }
];
const LOG = { searches: [], fetched: [], graph: 0, prefer: 0 };
const UrlFetchApp = {
  fetch: (url, o) => {
    LOG.graph++;
    if (o && o.headers && /ImmutableId/.test(o.headers.Prefer || '')) LOG.prefer++;
    const u = decodeURIComponent(url);
    const reply = (code, body) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) });
    if (sb.__graphDown) return reply(503, {});
    let m;
    if ((m = /\/messages\?.*\$search="([^"]+)"/.exec(u))) { if (sb.__noKql && /subject:/.test(m[1])) return reply(400, {}); LOG.searches.push(m[1]); return reply(200, { value: MAILS.map(x => ({ id: x.id, subject: x.subject, from: x.from, receivedDateTime: x.receivedDateTime, hasAttachments: x.hasAttachments })) }); }
    if ((m = /\/messages\/([^/?]+)\/attachments\?/.exec(u))) { const x = MAILS.find(y => y.id === m[1]); return reply(200, { value: x ? x.att : [] }); }
    if ((m = /\/messages\/([^/?]+)\/attachments\/([^/?]+)$/.exec(u))) { LOG.fetched.push(m[1] + '|' + m[2]); const x = MAILS.find(y => y.id === m[1]), a = x && x.att.find(y => y.id === m[2]); return a ? reply(200, Object.assign({ contentBytes: PDF }, a)) : reply(404, {}); }
    return reply(404, {});
  }
};
const DRIVE = { kept: [] };
const sb = {
  console, Date, Math, JSON, String, Number, Object, Array, RegExp, Error, Buffer, parseInt, encodeURIComponent, decodeURIComponent, Utilities, UrlFetchApp,
  CacheService: { getScriptCache: () => cache },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
  DriveApp: { getFileById: id => { if (/^mail:/.test(id)) throw new Error('Invalid argument: id'); return { getBlob: () => blob(Buffer.from('drive'), 'application/pdf', 'old.pdf'), getName: () => 'old.pdf' }; } },
  TRANSITION: { MS_FROM: 'support@rickyrampersadbranch.com', CC: [] },
  tMsCreds_: () => ({ tenant: 't' }), tMsToken_: () => 'TOKEN',
  gcmWhen_: d => d.toISOString().slice(0, 16).replace('T', ' '),
  gcmYes_: v => /^(y|yes|true|1)$/i.test(String(v || ''))
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/GroupBilling.gs'), 'utf8'), sb, { filename: 'GroupBilling.gs' });
const realNow = Date.now; Date.now = () => new Date('2026-11-26T15:00:00Z').getTime();

const G = { key: 'harbour', name: 'HARBOUR POINT LOGISTICS LTD', match: ['HARBOUR POINT'], to: ['hr@harbour.example'] };
const AMP = { key: 'rc', name: 'R&C ENTERPRISES LIMITED', match: ['R&C ENTERPRISES'] };

console.log('\nReading a subject:\n');
ok('the month a subject names', sb.gblMailMonth_('X - December 2026 Health Billing') === '2026-12' && sb.gblMailMonth_('DECEMBER 2026 GROUP LIFE BILLINGS - X') === '2026-12' && sb.gblMailMonth_('no month here') === '');
ok('Health Billing is health', sb.gblMailLine_('X - December 2026 Health Billing') === 'health');
ok('Life Billing and GROUP LIFE BILLINGS are life', sb.gblMailLine_('X - November 2026 Life Billing') === 'life' && sb.gblMailLine_('DECEMBER 2026 GROUP LIFE BILLINGS - X') === 'life');
ok('a subject without "billing" is no bill', sb.gblMailLine_('X – December 2026 Group Health bill: 3 points to confirm') === '');
ok('the group by its match words', sb.gblMailNames_('HARBOUR POINT LOGISTICS LIMITED - December 2026 Health Billing', G));
ok('"R & C" and "R&C" read alike', sb.gblMailNames_('Fw: R & C ENTERPRISES LIMITED - December 2026 Health Billing', AMP));
ok('another group is not this one', !sb.gblMailNames_('CORAL BAY TRADERS - December 2026 Health Billing', G));
ok('Microsoft is asked for the group\'s longest words, never "limited"', JSON.stringify(sb.gblMailTerms_(AMP)) === '["ENTERPRISES"]', JSON.stringify(sb.gblMailTerms_(AMP)));

console.log('\nThe group\'s bills in support@:\n');
const r = sb.gblMailBills_(G, true);
ok('read through Graph, with immutable ids', r.ok && LOG.prefer === LOG.graph, JSON.stringify(r).slice(0, 200));
ok('asked by the group\'s own words and "billing", in the subject only', LOG.searches.every(s => /^subject:\S+ AND subject:billing$/.test(s)) && LOG.searches.some(s => /HARBOUR/.test(s)), LOG.searches.join(' / '));
const ids = r.mails.map(m => m.id);
ok('December health and life, and November, are found', ids.includes('M1') && ids.includes('M3') && ids.includes('M4'), ids.join(','));
ok('the forward of the same December file is not listed twice', !ids.includes('M2'), ids.join(','));
ok('our own e-mail about the bill, another group\'s bill, a receipt and April are left out', !['M5', 'M6', 'M7', 'M8'].some(x => ids.includes(x)), ids.join(','));
const m1 = r.mails.find(m => m.id === 'M1'), m3 = r.mails.find(m => m.id === 'M3');
ok('each with its line and month', m1.line === 'health' && m1.month === '2026-12' && m3.line === 'life' && m3.month === '2026-12');
ok('only the PDFs, never an inline logo', m1.files.length === 1 && m1.files[0].name === 'HARBOUR_DEC2026.pdf');
ok('the life pack with all three PDFs', m3.files.length === 3);
ok('newest first', r.mails[0].ts >= r.mails[r.mails.length - 1].ts);
const n0 = LOG.graph; sb.gblMailBills_(G); ok('kept a quarter of an hour: the next screen does not ask Microsoft', LOG.graph === n0);

console.log('\nOne file, fetched for the page:\n');
const f = sb.gblMailFile_(G, 'M1', 'A1');
ok('a bill the scan found comes back as base64', f.ok && f.b64 === PDF && f.name === 'HARBOUR_DEC2026.pdf');
const bad = sb.gblMailFile_(G, 'M6', 'A7');
ok('another group\'s file is refused, even by its real ids', !bad.ok && !LOG.fetched.includes('M6|A7'), JSON.stringify(bad));
ok('so is a made-up id', !sb.gblMailFile_(G, 'M1', 'NOPE').ok);

console.log('\nWhat the approval keeps, and the send reads back:\n');
const pf = sb.gblPageFiles_(G, [{ name: 'HARBOUR_DEC2026.pdf', type: 'application/pdf', mail: 'M1', att: 'A1' }]);
ok('a file read from support@ is kept as a reference, no bytes', pf.refs.length === 1 && pf.refs[0] === 'mail:M1|A1' && pf.blobs.length === 0 && pf.bad === 0);
const pf2 = sb.gblPageFiles_(G, [{ name: 'x.pdf', mail: 'M6', att: 'A7' }]);
ok('a reference to another group\'s e-mail is counted as bad', pf2.bad === 1 && !pf2.refs.length);
const pf3 = sb.gblPageFiles_(G, [{ name: 'mine.pdf', type: 'application/pdf', b64: PDF }]);
ok('a file chosen from the device still comes as bytes', pf3.blobs.length === 1 && !pf3.refs.length);
ok('the one e-mail for a line and month gives its references', JSON.stringify(sb.gblMailRefsFor_(G, 'life', '2026-12')) === '["mail:M3|A3","mail:M3|A4","mail:M3|A5"]');
ok('no e-mail for a line and month gives none', sb.gblMailRefsFor_(G, 'listbill', '2026-12').length === 0);
const kr = sb.gblKeptRead_({ line: 'health', kept: 'mail:M1|A1' });
ok('a kept reference is read back from support@ as the PDF', kr.blobs.length === 1 && !kr.missing && Buffer.from(kr.blobs[0].getBytes()).toString() === '%PDF-1.4 invented bill');
const old = sb.gblKeptRead_({ line: 'health', kept: '1AbcDriveFileId' });
ok('a Drive copy from before still reads back', old.blobs.length === 1 && !old.missing);
const gone = sb.gblKeptRead_({ line: 'health', kept: 'mail:M1|GONE' });
ok('an e-mail gone from support@ is named, not sent empty', gone.blobs.length === 0 && /support@/.test(gone.missing), gone.missing);

console.log('\nA mailbox that refuses the subject-only form:\n');
sb.__noKql = true; LOG.searches = [];
const plain = sb.gblMailBills_(G, true);
ok('is asked the plain way, and finds the same bills', plain.ok && LOG.searches.length && LOG.searches.every(s => /^\S+ billing$/.test(s)) && plain.mails.map(m => m.id).sort().join() === r.mails.map(m => m.id).sort().join(), LOG.searches.join(' / '));
sb.__noKql = false;

console.log('\nWhen Microsoft does not answer:\n');
sb.__graphDown = true; delete store['gbl-mailbills-harbour'];
const down = sb.gblMailBills_(G, true);
ok('the door says so, and nothing throws', !down.ok && /HTTP 503/.test(down.error) && Array.isArray(down.mails));
sb.__graphDown = false;
sb.tMsCreds_ = () => null;
ok('without Microsoft 365 set up, the door says what is missing', /Microsoft 365 is not set up/.test(sb.gblMailBills_(G, true).error));

Date.now = realNow;
console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
