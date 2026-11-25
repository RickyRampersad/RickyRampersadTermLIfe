// The billings door's speed (25 November 2026): a big group's Salesforce read and member list kept in the cache (they
// were over the 100 KB a cache value holds, so every screen read Salesforce again), the group's e-mails to support@ asked
// for on request and searched for by the group's own addresses (never the whole inbox), and the upload's tasks opened in
// one Salesforce call with one sheet write. GroupBilling.gs runs in a
// sandbox; Salesforce, the cache and Microsoft are made of nothing, and every group, member and policy is invented.
// Run: node tests/test-billing-speed.js
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };

/* CacheService as Apps Script keeps it: a value over 100 KB is refused with a throw */
const store = {}, LIMIT = 100 * 1024;
const cache = {
  get: k => (k in store ? store[k] : null),
  put: (k, v) => { if (Buffer.byteLength(String(v), 'utf8') > LIMIT) throw new Error('Argument too large: value'); store[k] = String(v); },
  putAll: o => Object.keys(o).forEach(k => cache.put(k, o[k])),
  getAll: keys => { const o = {}; keys.forEach(k => { if (k in store) o[k] = store[k]; }); return o; },
  remove: k => { delete store[k]; }
};
const blob = (bytes, type) => ({ bytes, getBytes: () => bytes, getDataAsString: () => Buffer.from(bytes).toString('utf8'), type });
const Utilities = {
  newBlob: (s, type) => blob(Buffer.isBuffer(s) || s instanceof Uint8Array ? Buffer.from(s) : Buffer.from(String(s), 'utf8'), type),
  gzip: b => blob(zlib.gzipSync(Buffer.from(b.getBytes())), 'application/x-gzip'),
  ungzip: b => blob(zlib.gunzipSync(Buffer.from(b.getBytes())), 'application/json'),
  base64Encode: bytes => Buffer.from(bytes).toString('base64'),
  base64Decode: s => Buffer.from(s, 'base64')
};
const LOG = { queries: 0, mail: 0, sends: [], rows: [] };
const many = n => Array.from({ length: n }, (_, i) => ({ Id: 'a0P0000000' + String(i).padStart(8, '0'), POLICY__c: 'TQQ0001-' + String(i).padStart(5, '0') + '-00', RecordType: { Name: i % 2 ? 'LIFE(GROUP)' : 'HEALTH (GROUP)' },
  Policy_Status_Description__c: 'In Force', Contact__r: { Name: 'Member Number ' + i + ' Invented-Surname' }, INSURED__c: '', ISSUE_DATE__c: '2020-01-01', Total_Premiums__c: 266, Life_Premium__c: 0, Pension_Premiums__c: 0,
  Paid_To_Date__c: '2026-11-30', List_Bill__c: 'TQQ 0001', Account__c: '0010000000000HPAAA', Account__r: { Name: 'HARBOUR POINT LOGISTICS LIMITED (an invented group)' }, Status_Change_Date__c: '2026-01-01' }));
let POLS = many(340);
const sb = {
  console, Date, Math, JSON, String, Number, Object, Array, RegExp, Error, Buffer, parseInt, encodeURIComponent, Utilities,
  CacheService: { getScriptCache: () => cache },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
  tSfOn_: () => true,
  gcmQuery_: q => { LOG.queries++; return /FROM CLIENT_PORTFOLIO__c/.test(q) ? POLS : []; },
  gcmIn_: a => a.map(x => "'" + x + "'").join(', '),
  gcmName_: (o, k) => (o && o[k] && o[k].Name) || '',
  gcmYmd_: v => (String(v || '').match(/^\d{4}-\d{2}-\d{2}/) || [''])[0],
  gcmToday_: () => '2026-11-25', gcmId15_: s => String(s || '').slice(0, 15), gcmMoney_: n => 'TT$' + Number(n).toFixed(2), tDmy_: s => s,
  gcmYes_: v => /^(y|yes|true|1)$/i.test(String(v || '')),
  gcmMailIn_: () => { LOG.mail++; return { ok: true, error: '', by: { harbour: [{ ts: 1, at: '20 Nov', from: 'hr@harbour.example', subject: 'Payment for November premium', auto: false }], other: [{ ts: 2, at: '21 Nov', from: 'x@other.example', subject: 'Invoice query', auto: false }] } }; },
  tSfSend_: (m, p, body) => {
    LOG.sends.push({ p, body });
    if (p === '/composite/sobjects') {
      if (sb.__compositeRefused) throw new Error('Salesforce did not take it: NOT_FOUND');
      return body.records.map((r, i) => sb.__typeRefused && r.Task_Type__c ? { success: false, errors: [{ statusCode: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST', message: 'bad value' }] } : { success: true, id: '00T00000000' + String(LOG.sends.length).padStart(2, '0') + i });
    }
    if (p === '/sobjects/Task') return { id: '00T0000000ONE' + LOG.sends.length };
    return {};
  }
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/GroupBilling.gs'), 'utf8'), sb, { filename: 'GroupBilling.gs' });
Object.assign(sb, { gblAppend_: (n, rows) => { LOG.rows.push(rows.length); }, gblOwnerId_: () => '005000000000OWN', gblSfwDue_: () => '2026-11-27' });
const G = { key: 'harbour', name: 'Harbour Point Logistics Ltd', bills: ['TQQ 0001'], accts: ['0010000000000HP'], acctsFull: ['0010000000000HPAAA'], tasks: [], ownerEmail: '' };

console.log('\nA big group\'s Salesforce read, kept:\n');
const first = sb.gblSf_(G, false), q1 = LOG.queries;
ok('read from Salesforce once', q1 >= 1 && first.health.length + first.life.length === 340);
ok('it is over what one cache value holds', Buffer.byteLength(JSON.stringify(first)) > LIMIT, String(Buffer.byteLength(JSON.stringify(first))));
ok('and it was kept all the same, gzipped in pieces', /^gz:\d+:\d+$/.test(cache.get('gbl-sf-harbour') || ''), cache.get('gbl-sf-harbour'));
const second = sb.gblSf_(G, false);
ok('the next screen reads the cache, not Salesforce', LOG.queries === q1);
ok('and gets the same answer back', JSON.stringify(second) === JSON.stringify(first));
sb.gblSf_(G, true);
ok('"Read Salesforce again" still reads Salesforce', LOG.queries > q1);
const ptr = cache.get('gbl-sf-harbour'), m = /^gz:(\d+):(\d+)$/.exec(ptr);
delete store['gbl-sf-harbour.' + m[1] + '.0'];
ok('a piece gone is a miss, never a wrong answer', sb.gblCacheGet_('gbl-sf-harbour') === null);
ok('a small value is kept whole, as before', sb.gblCachePut_('gbl-small', { a: 1 }, 60) && store['gbl-small'] === '{"a":1}' && sb.gblCacheGet_('gbl-small').a === 1);

console.log('\nThe member list, kept the same way:\n');
POLS = many(340).map(p => Object.assign(p, { FIRST_NAME__c: 'Member', LAST_NAME__c: 'Invented', Email__c: 'member@home.example', Address_1__c: '12 Invented Road, Some Long Street Name', City__c: 'Somewhere' }));
const qm = LOG.queries, mem1 = sb.gblMembers_(G, false), qm1 = LOG.queries;
ok('read once', qm1 > qm && mem1.members.length === 340);
const mem2 = sb.gblMembers_(G, false);
ok('the next read is the cache', LOG.queries === qm1 && mem2.members.length === 340);

console.log('\nThe group\'s e-mails to support@: asked for, and only the group\'s:\n');
const FETCH = [];
const msg = (from, subject, daysAgo) => ({ id: 'm' + FETCH.length + subject.length, subject, from: { emailAddress: { address: from } }, receivedDateTime: new Date(Date.now() - daysAgo * 86400000).toISOString() });
Object.assign(sb, {
  tMsCreds_: () => true, tMsToken_: () => 'token', TRANSITION: { MS_FROM: 'support@rickyrampersadbranch.com' },
  GCM_PUBLIC_MAIL: /@(gmail|yahoo|hotmail|outlook|live|icloud|aol|msn|ymail|me)\./i, GCM_RATE: { AUTO_REPLY: /automatic reply|out of office/i }, gcmWhen_: d => d.toISOString().slice(0, 10),
  UrlFetchApp: { fetch: u => { FETCH.push(decodeURIComponent(u)); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ value: [
    msg('hr@harbour.example', 'Payment for November premium', 3), msg('accounts@harbour.example', 'Health bill query', 10), msg('hr@harbour.example', 'Christmas lunch', 2),
    msg('hr@harbour.example', 'Old invoice', 90), msg('someone@elsewhere.example', 'Payment', 1)] }) }; } }
});
const GI = Object.assign({}, G, { to: ['hr@harbour.example'], cc: ['boss@gmail.com', 'ricky@rickyrampersadbranch.com'] });
const mail0 = LOG.mail;
let ib = sb.gblInbox_({ reg: [] }, GI, false);
ok('one search, not a read of the whole inbox', FETCH.length === 1 && LOG.mail === mail0, FETCH.length + ' / ' + (LOG.mail - mail0));
ok('it asks Microsoft for the company domain and the personal address, nothing of ours', /\$search="from:harbour\.example OR from:boss@gmail\.com"/.test(FETCH[0]) && !/rickyrampersadbranch\.com OR|from:ricky/.test(FETCH[0]), FETCH[0]);
ok('only the group\'s, about money, in the last 60 days, newest first', ib.ok && ib.mails.length === 2 && ib.mails[0].subject === 'Payment for November premium' && ib.mails[1].from === 'accounts@harbour.example', JSON.stringify(ib.mails));
sb.gblInbox_({ reg: [] }, GI, false);
ok('kept: asked again, no second search', FETCH.length === 1);
sb.gblInbox_({ reg: [] }, GI, true);
ok('"Read Salesforce again" searches again', FETCH.length === 2);
ib = sb.gblInbox_({ reg: [] }, Object.assign({}, G, { key: 'noaddr', to: [], cc: [] }), false);
ok('a group with no address is told so, with no search', ib.ok && !ib.mails.length && /No e-mail address/.test(ib.said) && FETCH.length === 2);
const src = fs.readFileSync(path.join(ROOT, 'apps-script/GroupBilling.gs'), 'utf8'), view = src.slice(src.indexOf('function gblView_('), src.indexOf('function gblBillOut_('));
ok('the page\'s first read never reads the inbox', (view.match(/gblInbox_\(/g) || []).length === 1 && /if \(gcmYes_\(p\.inbox\)\) return \{ ok: true, inbox: gblInbox_/.test(view));

console.log('\nThe upload\'s tasks, in one call:\n');
const recs = [1, 2, 3].map(i => ({ Subject: 'Group Health Termination – Invented Person ' + i, WhatId: '0010000000000HPAAA', ActivityDate: '2026-11-27', Status: 'Not Started', Priority: 'Normal', Description: 'x' }));
LOG.sends = [];
let r = sb.gblSfInsertTasks_(recs);
ok('three tasks, one Salesforce call', LOG.sends.length === 1 && LOG.sends[0].p === '/composite/sobjects' && r.every(x => x.id));
ok('each as Servicing', LOG.sends[0].body.records.every(x => x.Task_Type__c === 'Servicing' && x.attributes.type === 'Task'));
LOG.sends = []; sb.__typeRefused = true;
r = sb.gblSfInsertTasks_(recs);
ok('a type the org refuses goes again without it, in one more call', LOG.sends.length === 2 && !LOG.sends[1].body.records[0].Task_Type__c && r.every(x => x.id));
sb.__typeRefused = false; LOG.sends = []; sb.__compositeRefused = true;
r = sb.gblSfInsertTasks_(recs);
ok('when the batch is refused, a task at a time as before', r.every(x => x.id) && LOG.sends.filter(x => x.p === '/sobjects/Task').length === 3);
sb.__compositeRefused = false;

console.log('\nThe upload opens its tasks with one sheet write:\n');
LOG.sends = []; LOG.rows = [];
const f = { members: [{ name: 'STAYS, SAM' }], credits: [{ kind: 'cancel', name: 'GONE, GARY', month: '2026-11', premium: -266 }, { kind: 'cancel', name: 'LEFT, LEE', month: '2026-11', premium: -266 }], left: [], adjTotal: -532, adjInvoices: [] };
const out = sb.gblSfwTasks_(G, { name: 'Kerry Sample', email: '' }, 'health', '2026-12', f, 'a03000000000REC', { health: [], life: [] });
const composite = LOG.sends.filter(x => x.p === '/composite/sobjects').length, single = LOG.sends.filter(x => x.p === '/sobjects/Task').length;
ok('two terminations and the adjustments query opened', out.tasks.length === 3 && !out.errors.length, JSON.stringify(out.errors));
ok('in one Salesforce call', composite === 1 && single === 0, composite + ' / ' + single);
ok('logged on Group Changes in one write', LOG.rows.length === 1 && LOG.rows[0] === 3, JSON.stringify(LOG.rows));

console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
