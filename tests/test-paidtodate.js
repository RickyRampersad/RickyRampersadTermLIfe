// Paid to date, from the sheet that knows it into the system that does not.
//
// Salesforce cannot drive a forty-five day letter because Salesforce does not
// know what has been paid. Of 9,933 premium-paying policies carrying a
// paid-to date, 3,349 say 2024 and 1,919 say 2025 — more than half the book
// marked premium paying with a date over a year old. Another 381 carry none,
// and a few are simply wrong: 2029, 2035, 2040, 2051, and one that says 2065.
//
// The branch's dues extract is right and already in the workbook, so it is
// the input and Salesforce is the output — the same machine as the policy
// status code sync, pointed at one more field.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: A PAID-TO DATE ONLY MOVES FORWARD.
// The extract is only as fresh as its last download. A blanket overwrite
// would push dates backwards for everybody who has paid since, and the branch
// would then chase people who are up to date — in writing, on the strength of
// its own screen. A stale sheet must be able to fail to help. It must not be
// able to do harm.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const all = path.join(os.tmpdir(), 'kpi-ptd-' + process.pid + '.gs');
fs.writeFileSync(all,
  fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'apps-script/KPI-Write.gs'), 'utf8'));
process.env.GS_PATH = all;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
const NOW = new Date('2026-09-15T09:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* The dues tab as the branch's extract writes it. Invented rows, real shape —
   and the dates in the three spellings the extract actually carries. */
const DUESH = ['Agent', 'Number', 'Client Number', 'Client', 'Premium', 'Issue Date', 'Status',
               'Status(2)', 'Days', 'Insurance Type', 'Paid To Date', 'Sum Assured', 'Plan Code',
               'Billing type', 'Mode', 'Status Description', 'Projected Lapse Date', 'Phone', 'email'];
const due = (num, paid, desc) =>
  ['Anand Pretend', num, '1', 'CLIENTNAME', 1000, '2024-01-01', '0', '', 45, '2',
   paid, 500000, 'ECT65 1', 'Direct Bill', '', desc || 'Premium Paying', '', '', ''];
env.__mkSheet('RR_DUES_45', 3, DUESH, [
  due('POL-FORWARD',  '2026-08-01'),     // Salesforce says 2024 — this is the point of the job
  due('POL-BLANK',    '2026-07-15'),     // Salesforce has nothing at all
  due('POL-SAME',     '2026-06-30'),     // already right
  due('POL-BEHIND',   '2025-01-31'),     // Salesforce is AHEAD: the client has paid since
  due('POL-DDMMM',    '7-Aug-2026'),     // the extract's other date spelling
  due('POL-EMPTY',    ''),               // no date in the sheet
  due('POL-JUNK',     'Not Available'),  // nothing could read this
  due('POL-SILLY',    '2065-01-21'),     // the typo already sitting in Salesforce
  due('POL-DUPE',     '2026-03-01'),     // the same policy twice, earlier row first
  due('POL-DUPE',     '2026-09-01'),     // the later payment must win
  due('POL-GHOST',    '2026-05-05')      // not on CLIENT_PORTFOLIO__c at all
]);
env.__mkSheet('Access', 2, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ada Quill', 'ada', 'ada@example.com', '1', 'Branch Manager', 'Branch', 'Yes']]);

console.log('\nWhat the sheet offers, before Salesforce is asked anything:\n');
const S = env.ptdFromSheet_();
ok('the dues tab is found', S.tab === 'RR_DUES_45', S.error || S.tab);
ok('a date written 7-Aug-2026 is read as a date',
   S.map['POL-DDMMM'] && env.iIso_(S.map['POL-DDMMM']) === '2026-08-07',
   S.map['POL-DDMMM'] ? env.iIso_(S.map['POL-DDMMM']) : 'unread');
ok('a row with no date is counted, not guessed at', S.blank === 1, String(S.blank));
ok('a date nothing can read is counted', S.unreadable === 1, String(S.unreadable));
ok('a date forty years out is REFUSED as a typo, not written',
   S.silly === 1 && S.map['POL-SILLY'] === undefined, String(S.silly));
ok('the same policy twice keeps the LATER payment',
   env.iIso_(S.map['POL-DUPE']) === '2026-09-01', env.iIso_(S.map['POL-DUPE'] || new Date(0)));
ok('and says it folded one', S.dupes === 1, String(S.dupes));

console.log('\nThe dry run writes nothing, and the report is the check:\n');
const asked = [];
env.sfkConfigured_ = () => true;
env.sfkQuery_ = q => {
  asked.push(q);
  return [
    { Id: 'a020000000000F1AAA', POLICY__c: 'POL-FORWARD', Paid_To_Date__c: '2024-11-30' },
    { Id: 'a020000000000B2AAA', POLICY__c: 'POL-BLANK',   Paid_To_Date__c: null },
    { Id: 'a020000000000S3AAA', POLICY__c: 'POL-SAME',    Paid_To_Date__c: '2026-06-30' },
    { Id: 'a020000000000H4AAA', POLICY__c: 'POL-BEHIND',  Paid_To_Date__c: '2026-08-31' },
    { Id: 'a020000000000D5AAA', POLICY__c: 'POL-DDMMM',   Paid_To_Date__c: '2025-05-05' },
    { Id: 'a020000000000U6AAA', POLICY__c: 'POL-DUPE',    Paid_To_Date__c: '2026-01-01' }
  ];
};
let reached = 0;
env.UrlFetchApp = { fetch: () => { reached++; throw new Error('a dry run must not reach Salesforce'); } };
const dry = env.syncPaidToDate();
ok('it says plainly that it changed nothing', /DRY RUN — nothing has been changed/.test(dry));
ok('nothing was sent to Salesforce', reached === 0);
ok('it names the one field it would write',
   /CLIENT_PORTFOLIO__c\.Paid_To_Date__c/.test(dry), (dry.match(/-> CLIENT[^\n]*/) || [''])[0]);
ok('four would move forward — and one of those from blank',
   /4 record\(s\) would move FORWARD \(1 of them from blank\)/.test(dry),
   (dry.match(/\d+ record\(s\) would move FORWARD[^\n]*/) || [''])[0]);
ok('one already matches', /^1 already match/m.test(dry), (dry.match(/\d+ already match[^\n]*/) || [''])[0]);
ok('a policy the sheet does not have is not on the list',
   /1 policy number\(s\) are not on CLIENT_PORTFOLIO__c/.test(dry),
   (dry.match(/\d+ policy number\(s\) are not on[^\n]*/) || [''])[0]);
ok('it says how to actually do it', /syncPaidToDateForReal\(\)/.test(dry));

console.log('\nAnd the rule the whole file exists for:\n');
ok('a sheet date EARLIER than Salesforce is left alone',
   /1 left alone — the sheet is BEHIND Salesforce/.test(dry),
   (dry.match(/\d+ left alone[^\n]*/) || [''])[0]);
ok('and the policy it left alone is named, with both dates',
   /POL-BEHIND: sheet says 2025-01-31, Salesforce has 2026-08-31/.test(dry),
   (dry.match(/POL-BEHIND[^\n]*/) || [''])[0]);

console.log('\nWhen it does write, it writes one field and only what moved:\n');
const sent = [];
env.sfkToken_ = () => ({ instance_url: 'https://example.my.salesforce.com', access_token: 't' });
env.UrlFetchApp = { fetch: (url, opt) => {
  sent.push({ url: url, method: opt.method, body: JSON.parse(opt.payload) });
  return { getResponseCode: () => 200,
           getContentText: () => JSON.stringify(JSON.parse(opt.payload).records.map(() => ({ success: true, errors: [] }))) };
} };
const real = env.syncPaidToDateForReal();
const recs = sent.length ? sent[0].body.records : [];
ok('one call, patched to the collections endpoint',
   sent.length === 1 && sent[0].method === 'patch' && /composite\/sobjects$/.test(sent[0].url),
   JSON.stringify(sent.map(s => s.method + ' ' + s.url)));
ok('carrying the four that moved forward', recs.length === 4, JSON.stringify(recs));
ok('the stale one is brought up to date',
   recs.some(r => r.id === 'a020000000000F1AAA' && r.Paid_To_Date__c === '2026-08-01'), JSON.stringify(recs));
ok('the blank one is filled', recs.some(r => r.id === 'a020000000000B2AAA' && r.Paid_To_Date__c === '2026-07-15'));
ok('the later of two rows is what lands', recs.some(r => r.id === 'a020000000000U6AAA' && r.Paid_To_Date__c === '2026-09-01'));
ok('THE ONE THAT WOULD GO BACKWARDS IS NOT IN THE BATCH',
   !recs.some(r => r.id === 'a020000000000H4AAA'), JSON.stringify(recs));
ok('the one already right is left alone', !recs.some(r => r.id === 'a020000000000S3AAA'));
ok('nothing but the paid-to date is sent',
   recs.every(r => Object.keys(r).sort().join() === 'Paid_To_Date__c,attributes,id'),
   JSON.stringify(Object.keys(recs[0] || {})));
ok('one bad record cannot take the batch down with it', sent[0].body.allOrNone === false);
ok('and it reports what it did', /Set 4 of 4 record\(s\)/.test(real), (real.match(/Set \d+[^\n]*/) || [''])[0]);

console.log('\nWithout Salesforce, or without the workbook, it says which:\n');
const bare = makeEnv();
bare.__mkSheet('Something Else', 1, ['a'], [['1']]);
bare.sfkConfigured_ = () => false;
ok('no Salesforce, said plainly', /Salesforce is not connected/.test(bare.syncPaidToDate()));
bare.sfkConfigured_ = () => true;
ok('no dues tab, said plainly', /No dues tab found/.test(bare.syncPaidToDate()), bare.syncPaidToDate().slice(0, 90));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
