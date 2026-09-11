// Putting the policy status code where it belongs, from the extract that knows it.
//
// CLIENT_PORTFOLIO__c carries a status DESCRIPTION on most pending records
// and no CODE. The description cannot be turned into the code by rule, and
// the reason is worth keeping in a test: the codes are a two-by-two.
//
//     PCCU  no errors, no outstanding reqt   PCRU  no errors, O/S reqt
//     PECU  errors,    no outstanding reqt   PERU  errors,    O/S reqt
//
// "Underwriting incomplete" fixes the last letter and nothing else. Whether a
// case has errors is recorded nowhere in Salesforce, so the code has to come
// from RR_UWPRO_INSURED_Requirement, column A — and anything this writes goes
// onto a live client record, so it is dry by default and refuses anything it
// cannot recognise.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const all = path.join(os.tmpdir(), 'kpi-psc-' + process.pid + '.gs');
fs.writeFileSync(all,
  fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'apps-script/KPI-Write.gs'), 'utf8'));
process.env.GS_PATH = all;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
// Column A has no header worth matching on — the branch names the sheet, so
// the tab is found by name and column A is taken by position, as instructed.
env.__mkSheet('RR_UWPRO_INSURED_Requirement', 1,
  ['STATUS_CODE', 'POLICY_NUMBER', 'REQUIREMENT_CODE'],
  [
    ['PCRU', '1000899080', 'PRADD'],
    ['PCRU', '1000899080', 'MDMED'],     // same policy, same code, twice
    ['PERU', '1000899081', 'MDMED'],
    ['PCCU', '1000899082', 'FUTPY'],
    ['',     '1000899083', 'PRADD'],     // column A empty
    ['PCRU', '1000899084', 'PRADD'],
    ['PERU', '1000899084', 'MDMED'],     // two different codes on one policy
    ['ZZZZ', '1000899085', 'PRADD'],     // not a picklist value
  ]);
env.__mkSheet('Access', 2, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ada Quill', 'ada', 'ada@example.com', '1', 'Branch Manager', 'Branch', 'Yes']]);

console.log('\nThe tab is found by name, and column A is taken by position:\n');
const S = env.pscFromSheet_();
ok('the tab is found', S.tab === 'RR_UWPRO_INSURED_Requirement', JSON.stringify(S.error || S.tab));
ok('and it says what column A is headed, so it can be checked',
   S.colA === 'status_code', S.colA);
ok('every row is counted', S.rows === 8, String(S.rows));
ok('a row with column A empty is counted, not guessed at', S.blank === 1, String(S.blank));

console.log('\nOne code per policy, and never a guess when there are two:\n');
ok('a policy repeated with the same code is one policy', S.map['1000899080'] === 'PCRU', JSON.stringify(S.map));
ok('a policy with two different codes is dropped', S.map['1000899084'] === undefined, JSON.stringify(S.map));
ok('and named, so somebody can fix the sheet',
   S.dropped === 1 && S.conflicts.some(c => /1000899084/.test(c)), JSON.stringify(S.conflicts));
ok('the codes are counted for checking against', S.byCode.PCRU === 3 && S.byCode.PERU === 2, JSON.stringify(S.byCode));

console.log('\nNothing is written on a dry run, and the report is the check:\n');
const asked = [];
env.sfkConfigured_ = () => true;
env.sfkQuery_ = q => {
  asked.push(q);
  return [
    { Id: 'a02Ul00000S27enIAB', POLICY__c: '1000899080', Policy_Status_Cose__c: null },
    { Id: 'a02000000000002AAA', POLICY__c: '1000899081', Policy_Status_Cose__c: 'PERU' },  // already right
    { Id: 'a02000000000003AAA', POLICY__c: '1000899082', Policy_Status_Cose__c: 'PCRU' },  // wrong, to correct
  ];
};
let wrote = 0;
env.UrlFetchApp = { fetch: () => { wrote++; throw new Error('a dry run must not reach Salesforce'); } };
const dry = env.syncPolicyStatusCodes();
ok('it says plainly that it changed nothing', /DRY RUN — nothing has been changed/.test(dry));
ok('nothing was sent to Salesforce', wrote === 0);
ok('it names the field it would write, spelling and all',
   /CLIENT_PORTFOLIO__c\.Policy_Status_Cose__c/.test(dry), (dry.match(/Writing to[^\n]*/) || [''])[0]);
ok('it reports what would change and what is already right',
   /2 record\(s\) would change/.test(dry) && /1 already correct/.test(dry),
   (dry.match(/\d+ record\(s\) would change[^\n]*/) || [''])[0]);
ok('a code that is not in the picklist is refused by name',
   /REFUSED, not in the picklist: ZZZZ/.test(dry), (dry.match(/REFUSED[^\n]*/) || [''])[0]);
ok('and refused in the code list too', /REFUSED ZZZZ/.test(dry), (dry.match(/REFUSED ZZZZ[^\n]*/) || [''])[0]);
ok('a policy the extract has and Salesforce does not is counted',
   /not on CLIENT_PORTFOLIO__c/.test(dry), (dry.match(/\d+ policy number\(s\) not on[^\n]*/) || [''])[0]);
ok('the conflicting policy is named in the report', /1000899084/.test(dry));
ok('it says how to actually do it', /syncPolicyStatusCodesForReal\(\)/.test(dry));
ok('the refused code was never queried for',
   !asked.some(q => /1000899085/.test(q)), asked.join(' | ').slice(0, 120));
ok('nor the conflicted one', !asked.some(q => /1000899084/.test(q)));

console.log('\nAnd when it does write, it writes only what changed:\n');
const sent = [];
env.sfkToken_ = () => ({ instance_url: 'https://example.my.salesforce.com', access_token: 't' });
env.UrlFetchApp = { fetch: (url, opt) => {
  sent.push({ url: url, method: opt.method, body: JSON.parse(opt.payload) });
  return { getResponseCode: () => 200,
           getContentText: () => JSON.stringify(JSON.parse(opt.payload).records.map(() => ({ success: true, errors: [] }))) };
} };
const real = env.syncPolicyStatusCodesForReal();
ok('one call, patched', sent.length === 1 && sent[0].method === 'patch', JSON.stringify(sent.map(s => s.method)));
ok('to the collections endpoint', /composite\/sobjects$/.test(sent[0].url), sent[0].url);
ok('carrying only the two that needed changing', sent[0].body.records.length === 2,
   JSON.stringify(sent[0].body.records));
ok('the blank one gets its code', sent[0].body.records.some(r => r.id === 'a02Ul00000S27enIAB' && r.Policy_Status_Cose__c === 'PCRU'),
   JSON.stringify(sent[0].body.records));
ok('the wrong one is corrected', sent[0].body.records.some(r => r.id === 'a02000000000003AAA' && r.Policy_Status_Cose__c === 'PCCU'),
   JSON.stringify(sent[0].body.records));
ok('the one already right is left alone',
   !sent[0].body.records.some(r => r.id === 'a02000000000002AAA'), JSON.stringify(sent[0].body.records));
ok('one bad record cannot take the batch down with it', sent[0].body.allOrNone === false);
ok('and it reports what it did', /Set 2 of 2 record\(s\)/.test(real), (real.match(/Set \d+[^\n]*/) || [''])[0]);

console.log('\nWithout the intelligence workbook it says so rather than failing oddly:\n');
const bare = makeEnv();
bare.__mkSheet('Something Else', 1, ['a'], [['1']]);
bare.sfkConfigured_ = () => true;
const none = bare.syncPolicyStatusCodes();
ok('it names the tab it wanted', /No tab beginning "RR_UWPRO"/.test(none), none.slice(0, 120));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
