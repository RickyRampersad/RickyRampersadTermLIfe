// Pensions and life plans paid through an employer's payroll: someone joining, someone leaving (17 November 2026).
// GroupBilling.gs runs in a sandbox with Salesforce, the sheet and the mail made of nothing. Every name, policy number
// and list bill below is invented.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const LOG = { queries: [], tasks: [], posts: [], rows: [], told: [] };
const POLICIES = [
  { Id: 'a0P000000000001AAA', POLICY__c: '8009000001', PLAN_NAME__c: 'LIFE SECURE', RecordType: { Name: 'PENSION' }, Policy_Status_Description__c: 'Premium Paying', Contact__c: '0030000000000A1', Contact__r: { Name: 'PAT EXAMPLE' }, Total_Premiums__c: 800, Paid_To_Date__c: '2026-11-30', ISSUE_DATE__c: '2021-03-01', List_Bill__c: 'TQQ 0001', Ownership__c: '', Account__r: { RecordType: { Name: 'HOUSEHOLD' } } },
  { Id: 'a0P000000000002AAA', POLICY__c: '8009000002', PLAN_NAME__c: 'IPI', RecordType: { Name: 'PENSION' }, Policy_Status_Description__c: 'Premium Paying', Contact__c: '0030000000000A1', Contact__r: { Name: 'Pat Example' }, Total_Premiums__c: 800, Paid_To_Date__c: '2026-11-30', ISSUE_DATE__c: '2021-03-01', List_Bill__c: 'TQQ0001', Ownership__c: 'Company', Account__r: { RecordType: { Name: 'COMMERCIAL' } } },
  { Id: 'a0P000000000003AAA', POLICY__c: '1009000003', PLAN_NAME__c: 'FAMILY LIFE', RecordType: { Name: 'LIFE' }, Policy_Status_Description__c: 'Premium Paying', Contact__c: '0030000000000B2', Contact__r: { Name: 'Sam Sample' }, Total_Premiums__c: 310, Paid_To_Date__c: '2026-11-30', ISSUE_DATE__c: '2019-06-01', List_Bill__c: 'TQQ 0001', Ownership__c: '', Account__r: { RecordType: { Name: 'HOUSEHOLD' } } },
  { Id: 'a0P000000000004AAA', POLICY__c: '8009000004', PLAN_NAME__c: 'LIFE SECURE', RecordType: { Name: 'PENSION' }, Policy_Status_Description__c: 'Surrendered', Contact__c: '0030000000000C3', Contact__r: { Name: 'Gone Before' }, Total_Premiums__c: 500, Paid_To_Date__c: '2024-01-31', ISSUE_DATE__c: '2015-01-01', List_Bill__c: 'TQQ 0001', Ownership__c: '', Account__r: { RecordType: { Name: 'HOUSEHOLD' } } }
];
const cache = {};
const sb = {
  console, Date, Math, JSON, String, Number, Object, Array, RegExp, Error, parseInt, encodeURIComponent,
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
  tSfOn_: () => true,
  gcmQuery_: q => { LOG.queries.push(q); return /FROM CLIENT_PORTFOLIO__c/.test(q) && /List_Bill__c IN/.test(q) && /'PENSION', 'LIFE'/.test(q) ? POLICIES : []; },
  gcmIn_: a => a.map(x => "'" + x + "'").join(', '),
  gcmName_: (o, k) => (o && o[k] && o[k].Name) || '',
  gcmYmd_: v => (String(v || '').match(/^\d{4}-\d{2}-\d{2}/) || [''])[0],
  gcmToday_: () => '2026-11-17', gcmAddDays_: (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
  gcmDow_: ymd => { const d = new Date(ymd + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; },
  gblHolidays_: () => ({}),
  gcmId15_: s => String(s || '').slice(0, 15), gcmMoney_: n => 'TT$' + Number(n).toFixed(2), tDmy_: s => s,
  tSfSend_: (m, p, rec) => { if (p === '/sobjects/Task') { LOG.tasks.push(rec); return { id: '00T00000000000' + LOG.tasks.length }; } return {}; },
  gblAppend_: (n, rows) => LOG.rows.push(...rows), gblPostBilling_: (g, line, month, text) => { LOG.posts.push({ line, month, text }); return true; },
  gblTellOwner_: (g, name, kind, line, b) => LOG.told.push({ kind, line, b }), gblOwnerId_: () => '005000000000OWN',
  gcmLoad_: () => ({}), gcmClientAuth_: () => ({ ok: true, g: G }), gcmYes_: v => /^(y|yes|true|1)$/i.test(String(v || ''))
};
const G = { key: 'harbour', name: 'Harbour Point Logistics Ltd', bills: ['TQQ 0001'], accts: ['0010000000000HP'], acctsFull: ['0010000000000HPAAA'], ownerEmail: 'owner@example.com', tasks: [] };
vm.createContext(sb);
const src = fs.readFileSync(path.join(ROOT, 'apps-script/GroupBilling.gs'), 'utf8');
vm.runInContext(src, sb, { filename: 'GroupBilling.gs' });
// the stubs win over the file's own definitions of the same names
Object.assign(sb, { gblAppend_: (n, rows) => LOG.rows.push(...rows), gblPostBilling_: (g, line, month, text) => { LOG.posts.push({ line, month, text }); return true; },
  gblTellOwner_: (g, name, kind, line, b) => LOG.told.push({ kind, line, b }), gblOwnerId_: () => '005000000000OWN', gblWorkingDay_: ymd => sb.gcmDow_(ymd) <= 5 });

console.log('\nThe people paying through the group\'s payroll:\n');
const P = sb.gblPayroll_(G, true);
ok('read from Salesforce', P.ok, P.error);
ok('one query, by the list bill, pension and life only', LOG.queries.length === 1 && /List_Bill__c IN \('TQQ 0001', 'TQQ0001'/.test(LOG.queries[0]) && /'PENSION', 'LIFE'/.test(LOG.queries[0]));
ok('two records of one person are one person', P.people.filter(p => /Pat/.test(p.name)).length === 1 && P.people.find(p => /Pat/.test(p.name)).policies.length === 2);
ok('a name in capitals is written properly', P.people.some(p => p.name === 'Pat Example'));
ok('ownership: the IPI on a commercial account is the company\'s', P.people.find(p => /Pat/.test(p.name)).policies.find(q => q.plan === 'IPI').own === 'Company');
ok('a surrendered policy is not live', P.people.find(p => /Gone/.test(p.name)).live === false);
ok('label: pension', sb.gblPayLabel_(P.people.find(p => /Pat/.test(p.name)).policies) === 'Pension through payroll');
ok('label: life plan', sb.gblPayLabel_(P.people.find(p => /Sam/.test(p.name)).policies) === 'Life plan through payroll');

console.log('\nSearching from the group\'s page:\n');
let r = sb.gblClientForm_({ lb: 'x', code: 'y', form: 'payroll', q: 'pat' });
ok('form=payroll searches the payroll people', r.ok && r.payroll && r.members.length === 1 && r.members[0].name === 'Pat Example', JSON.stringify(r).slice(0, 160));
ok('it shows both policy numbers and that it is a company pension', r.members[0].policy === '8009000001, 8009000002' && r.members[0].company === true);
ok('those still paying come first', sb.gblClientForm_({ lb: 'x', code: 'y', form: 'payroll', q: 'e' }).members[0].live === true);
ok('it hands the page the plans and the company note', !!r.plans.ipi && /plan’s own rules/.test(r.companyNote));
ok('an empty search lists nobody', sb.gblClientForm_({ lb: 'x', code: 'y', form: 'payroll', q: '' }).members.length === 0);

console.log('\nSomeone leaving:\n');
const base = { lb: 'x', code: 'y', form: 'payroll', name: 'Hana HR', authorised: 'Y' };
ok('the authorised tick is required', /authorised/.test(sb.gblClientFormSend_(Object.assign({}, base, { authorised: '' , pkind: 'leave' })).error || ''));
ok('the last deduction month is required', /last salary deduction/.test(sb.gblClientFormSend_(Object.assign({}, base, { pkind: 'leave', member: P.people[0].id })).error || ''));
ok('somebody not on the payroll is refused', /not on a plan/.test(sb.gblClientFormSend_(Object.assign({}, base, { pkind: 'leave', member: 'a0P0000000XXXXX', lastDeduction: '2026-12' })).error || ''));
const pat = P.people.find(p => /Pat/.test(p.name));
r = sb.gblClientFormSend_(Object.assign({}, base, { pkind: 'leave', member: pat.id, lastDeduction: '2026-12', leftOn: '2026-12-31', reason: 'Resigned' }));
ok('sent', r.ok, r.error);
let t = LOG.tasks[LOG.tasks.length - 1];
ok('the task subject is the branch\'s pattern', t.Subject === 'Pension Leaver – Pat Example – Harbour Point Logistics Ltd – last deduction December 2026', t.Subject);
ok('it sits on the policy, with the person, owned by the account owner', t.WhatId === pat.policies[0].id && t.WhoId === '0030000000000A1' && t.OwnerId === '005000000000OWN');
ok('Servicing, due in two working days', t.Task_Type__c === 'Servicing' && t.ActivityDate === '2026-11-19', t.ActivityDate);
ok('the description lists the policies and the steps', /8009000001/.test(t.Description) && /8009000002/.test(t.Description) && /What to do:\n1\. Contact the employee/.test(t.Description) && /company-paid pension/.test(t.Description));
let row = LOG.rows[LOG.rows.length - 1];
ok('a Group Changes row on the list bill, a leaver', row.Line === 'listbill' && row.Kind === 'leaver' && row.Member === 'Pat Example' && row.Effective === '2026-12-01' && row['SF Task']);
ok('a line on the list bill\'s billing task', LOG.posts.some(p => p.line === 'listbill' && p.month === '2026-12' && /Leaving/.test(p.text)));
ok('the owner is told', LOG.told.some(x => x.kind === 'leaver' && x.line === 'listbill'));
ok('the group is told the policy stays the employee\'s, and when it leaves the list bill', /their own, so leaving does not end it/.test(r.said) && /January 2027/.test(r.said) && /plan’s own rules/.test(r.said), r.said);

console.log('\nSomeone joining:\n');
const join = Object.assign({}, base, { pkind: 'join', first: 'Kai', last: 'NEWSTART', email: 'kai@example.com', mobile: '', plans: 'personal,ipi', startMonth: '2027-01', employed: '2026-10-05', contribution: '5% of salary' });
ok('a name is required', /first name and surname/.test(sb.gblClientFormSend_(Object.assign({}, join, { first: '' })).error || ''));
ok('a way to reach them is required', /e-mail or a mobile/.test(sb.gblClientFormSend_(Object.assign({}, join, { email: '', mobile: '' })).error || ''));
ok('a bad e-mail is refused', /does not look right/.test(sb.gblClientFormSend_(Object.assign({}, join, { email: 'kai@' })).error || ''));
ok('a plan is required', /Which plan/.test(sb.gblClientFormSend_(Object.assign({}, join, { plans: 'nonsense' })).error || ''));
ok('the first deduction month is required', /first salary deduction/.test(sb.gblClientFormSend_(Object.assign({}, join, { startMonth: '2027-13' })).error || ''));
const before = LOG.tasks.length;
r = sb.gblClientFormSend_(join);
ok('sent', r.ok, r.error);
t = LOG.tasks[LOG.tasks.length - 1];
ok('one task opened', LOG.tasks.length === before + 1);
ok('the task subject', t.Subject === 'Pension Enrolment – Kai Newstart – Harbour Point Logistics Ltd – first deduction January 2027', t.Subject);
ok('it sits on the group\'s account, no person yet', t.WhatId === '0010000000000HPAAA' && !t.WhoId);
ok('the steps are the branch\'s own', /projection from their salary/.test(t.Description) && /latest payslip and the date of employment/.test(t.Description) && /salary deduction form to stamp and sign/.test(t.Description));
ok('what the group gave is on it', /Personal Pension Plan, Company pension \(IPI\)/.test(t.Description) && /5% of salary/.test(t.Description) && /kai@example\.com/.test(t.Description));
row = LOG.rows[LOG.rows.length - 1];
ok('a Group Changes row, a joiner, from the first deduction', row.Kind === 'joiner' && row.Line === 'listbill' && row.Effective === '2027-01-01');
ok('the group is told what happens next', /call Kai within two working days/.test(r.said) && /payslip/.test(r.said), r.said);
r = sb.gblClientFormSend_(Object.assign({}, join, { plans: 'life', first: 'Lee', last: 'Lifeonly' }));
ok('a life plan alone is a payroll life enrolment, with a quote', /^Payroll Life Enrolment – Lee Lifeonly/.test(LOG.tasks[LOG.tasks.length - 1].Subject) && /prepare a quote/.test(r.said));

console.log('\nWhen Salesforce refuses the task type:\n');
const real = sb.tSfSend_;
sb.tSfSend_ = (m, p, rec) => { if (rec && rec.Task_Type__c) throw new Error('bad value for restricted picklist field'); return real(m, p, rec); };
r = sb.gblClientFormSend_(Object.assign({}, join, { first: 'Mo', last: 'Retry' }));
ok('the task still opens, without the type', r.ok && !LOG.tasks[LOG.tasks.length - 1].Task_Type__c && /Mo Retry/.test(LOG.tasks[LOG.tasks.length - 1].Subject));
sb.tSfSend_ = real;

console.log('\nYour people shows who pays through payroll, and who is leaving:\n');
Object.assign(sb, { gblMembers_: () => ({ ok: true, members: [] }), gblBillRows_: () => [], gblRows_: () => [], gcmPending_: () => [], gcmFeed_: () => ({}), gcmShown_: () => true,
  gblChanges_: () => [{ member: 'Pat Example', kind: 'leaver', line: 'listbill', source: 'client', effective: '2026-12-01', when: '2026-11-17', status: 'open' }] });
const R = sb.gblRoster_(G, { today: '2026-11-17', refreshed: '' }, true);
const rp = R.people.find(o => o.name === 'Pat Example'), rs = R.people.find(o => o.name === 'Sam Sample');
ok('Pat is on the list as paying a pension through payroll', rp && rp.active && rp.lines.some(l => l.label === 'Pension through payroll'), JSON.stringify(rp && rp.lines));
ok('Sam is on the list with a life plan through payroll', rs && rs.lines.some(l => l.label === 'Life plan through payroll'));
ok('Pat shows as leaving, in the group\'s words', rp.leaving.length === 1 && rp.leaving[0].label === 'Pension or life plan through payroll', JSON.stringify(rp.leaving));
ok('a surrendered policy puts nobody on the list', !R.people.some(o => /Gone/.test(o.name)));

console.log('\nThe ping says the payroll steps are in:\n');
ok('gblDayInfo_ carries payroll: 1', /payroll: typeof gblPayroll_ === 'function' \? 1 : 0/.test(src));

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
