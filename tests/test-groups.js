// The increases-and-group slide, against the Salesforce this branch has.
//
// Three of this feed's five queries were written as aggregates grouped by
// Unit__c, every unit test was green, and on 17 September 2026 the live org
// refused all three — "field 'Unit__c' can not be grouped in a query call".
// Unit__c and AgentName__c are formula fields on both portfolio objects, and
// Salesforce will not group by a formula. The slide came up with an empty
// book and zero increases, under a note at the foot that nobody read.
//
// So the fake Salesforce here refuses what the real one refuses, and the feed
// has to come back full through it. Every name and figure below is invented.
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Intelligence.gs');
const { makeEnv, refuseUngroupable } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const ACCESS = ['Name', 'Email', 'Access Code', 'Role', 'Unit', 'Agent Name (exactly as in data)', 'Agent Number', 'Active'];
const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away', INTEL_LIST_ONLY_EXCLUDE: 'Anand Pretend' } });
env.__mkSheet('Access', 1, ACCESS, [
  ['Anand Pretend',   'anand@example.com', 'x', 'Unit Manager', 'Anand Pretend', 'Anand Pretend',   'A00010', 'Yes'],
  ['Beena Sample',    'beena@example.com', 'x', 'Agent',        'Anand Pretend', 'Beena Sample',    'A00011', 'Yes'],
  ['Carl Fictitious', 'carl@example.com',  'x', 'Agent',        'Anand Pretend', 'Carl Fictitious', 'A00012', 'Yes'],
  ['Gone Away',       'gone@example.com',  'x', 'Agent',        'Anand Pretend', 'Gone Away',       'A00013', 'Yes']
]);
const NOW = new Date('2026-09-17T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* ── 0. The fake refuses what the org refuses ───────────────────────────── */
console.log('\nThe fake Salesforce refuses a GROUP BY on a formula field:\n');
const throws = q => { try { refuseUngroupable(q); return false; } catch (e) { return /can not be grouped/.test(e.message); } };
ok('GROUP BY RecordType.Name, Unit__c, Status is refused', throws('SELECT RecordType.Name, Unit__c, COUNT(Id) n FROM X GROUP BY RecordType.Name, Unit__c, Policy_Status_Description__c'));
ok('GROUP BY Unit__c alone is refused',            throws('SELECT Unit__c, COUNT(Id) n FROM X WHERE a = 1 GROUP BY Unit__c'));
ok('GROUP BY AgentName__c is refused',             throws('SELECT AgentName__c, COUNT(Id) n FROM X GROUP BY AgentName__c ORDER BY COUNT(Id) DESC LIMIT 3'));
ok('GROUP BY RecordType.Name alone is allowed',    !throws('SELECT RecordType.Name, COUNT(Id) n FROM X GROUP BY RecordType.Name'));
ok('a row-level read is allowed',                  !throws('SELECT Unit__c, AgentName__c FROM X WHERE a = 1'));

/* ── 1. The feed, through it ────────────────────────────────────────────── */
const RT = n => ({ Name: n });
const U = 'Anand_Pretend';                        // Salesforce writes the unit underscored
const book = [
  // Beena: one paying, one pending on a missing requirement, one with no status
  { RecordType: RT('HEALTH (GROUP)'), Unit__c: U, AgentName__c: 'A00011 - Beena Sample', Policy_Status_Description__c: 'Premium Paying',         CreatedDate: '2026-01-05T12:00:00.000+0000' },
  { RecordType: RT('HEALTH (GROUP)'), Unit__c: U, AgentName__c: 'A00011 - Beena Sample', Policy_Status_Description__c: 'Pending, Missing Reqts', CreatedDate: '2026-08-18T12:00:00.000+0000' },
  { RecordType: RT('HEALTH (GROUP)'), Unit__c: U, AgentName__c: 'A00011 - Beena Sample', Policy_Status_Description__c: '',                       CreatedDate: '2026-03-01T12:00:00.000+0000' },
  // Carl: one awaiting settlement, one lapsed
  { RecordType: RT('LIFE(GROUP)'),    Unit__c: U, AgentName__c: 'A00012 - Carl Fictitious', Policy_Status_Description__c: 'Awaiting Settlement', CreatedDate: '2026-06-01T12:00:00.000+0000' },
  { RecordType: RT('LIFE(GROUP)'),    Unit__c: U, AgentName__c: 'A00012 - Carl Fictitious', Policy_Status_Description__c: 'Lapsed',              CreatedDate: '2024-06-01T12:00:00.000+0000' },
  // the unit manager's own case: counted, name held off the wall
  { RecordType: RT('HEALTH'),         Unit__c: U, AgentName__c: 'A00010 - Anand Pretend', Policy_Status_Description__c: 'Pending, Errors, UW Incomplete', CreatedDate: '2026-09-01T12:00:00.000+0000' },
  // an excluded agent: in the book's count, off the rows
  { RecordType: RT('HEALTH'),         Unit__c: U, AgentName__c: 'A00013 - Gone Away',     Policy_Status_Description__c: 'Pending',              CreatedDate: '2026-07-01T12:00:00.000+0000' },
  // another branch entirely
  { RecordType: RT('HEALTH'),         Unit__c: 'Some_Other_Unit', AgentName__c: 'A00099 - Not Ours', Policy_Status_Description__c: 'Pending', CreatedDate: '2026-07-01T12:00:00.000+0000' }
];
const incBook = [
  { Unit__c: U, Policy_Description_Status__c: 'Premium Paying', Increase_API__c: 1200, Submitted_Date__c: '2026-02-10' },
  { Unit__c: U, Policy_Description_Status__c: 'Premium Paying', Increase_API__c: 600,  Submitted_Date__c: '2025-11-03' },
  { Unit__c: U, Policy_Description_Status__c: 'NPW',            Increase_API__c: 300,  Submitted_Date__c: '2026-04-01' },
  { Unit__c: U, Policy_Description_Status__c: '',               Increase_API__c: 0,    Submitted_Date__c: '' },
  { Unit__c: U, Policy_Description_Status__c: 'Pending',        Increase_API__c: 900,  Submitted_Date__c: '2026-09-01' },
  { Unit__c: 'Some_Other_Unit', Policy_Description_Status__c: 'Premium Paying', Increase_API__c: 5000, Submitted_Date__c: '2026-05-05' }
];
const incPend = [
  { Agent__c: 'Beena', Unit__c: U, Support__c: 'Desk', Policy_Description_Status__c: 'Pending', Policy_Status_Description_R__c: 'Underwriting incomplete, Missing Reqts',
    Submitted_Date__c: '2026-09-01', Days_O_S__c: 0, Increase_API__c: 900, Increase_Premium__c: 75, Policy_Requirements__c: 'Proof of address',
    Client_Requirement__c: '', Di_you_collect_the_Documents__c: false, Years_In_Force__c: 3.4 },
  { Agent__c: 'Anand', Unit__c: U, Support__c: '', Policy_Description_Status__c: 'Premium Paying', Policy_Status_Description_R__c: 'Awaiting Settlement',
    Submitted_Date__c: '2026-08-20', Days_O_S__c: 12, Increase_API__c: 400, Increase_Premium__c: 33, Policy_Requirements__c: '',
    Client_Requirement__c: '', Di_you_collect_the_Documents__c: true, Years_In_Force__c: 1 },
  { Agent__c: 'Gone', Unit__c: U, Support__c: '', Policy_Description_Status__c: 'Pending', Policy_Status_Description_R__c: '',
    Submitted_Date__c: '2026-08-01', Days_O_S__c: 0, Increase_API__c: 5000, Increase_Premium__c: 400, Policy_Requirements__c: '',
    Client_Requirement__c: '', Di_you_collect_the_Documents__c: false, Years_In_Force__c: 2 },
  { Agent__c: 'Beena', Unit__c: 'Some_Other_Unit', Support__c: '', Policy_Description_Status__c: 'Pending', Policy_Status_Description_R__c: '',
    Submitted_Date__c: '2026-08-01', Days_O_S__c: 0, Increase_API__c: 7000, Increase_Premium__c: 500, Policy_Requirements__c: '',
    Client_Requirement__c: '', Di_you_collect_the_Documents__c: false, Years_In_Force__c: 2 }
];
const asked = [];
env.sfQuery_ = function (soql) {
  asked.push(soql);
  refuseUngroupable(soql);
  if (/FROM CLIENT_PORTFOLIO__c/.test(soql)) return book;
  if (/SELECT Agent__c/.test(soql))          return incPend;
  if (/FROM Policy_Increases__c/.test(soql)) return incBook;
  throw new Error('unexpected SOQL: ' + soql);
};
const out = env.iGroupsWall_();

console.log('\nThe feed comes back full through a Salesforce that refuses GROUP BY Unit__c:\n');
ok('three reads, none of them grouped by a formula field', asked.length === 3 &&
   asked.every(s => !/GROUP BY[^\n]*\b(Unit__c|AgentName__c)\b/i.test(s)), asked.length + ' asked');
ok('and Salesforce said nothing back', !(out.notes || []).length, JSON.stringify(out.notes));
ok('no client field is asked for', !/POLICY__c|Contact|Client_Name|Date_Of_Birth|Name__c FROM/i.test(asked.join(' ')));

const by = {}; (out.types || []).forEach(t => { by[t.key] = t; });
ok('the three record types are on the slide', Object.keys(by).sort().join('|') === 'HEALTH|HEALTH (GROUP)|LIFE(GROUP)', Object.keys(by).join('|'));
const gh = by['HEALTH (GROUP)'] || {}, gl = by['LIFE(GROUP)'] || {}, h = by['HEALTH'] || {};
ok('group health: 3 policies, 1 paying, 1 pending, 1 with no status', gh.policies === 3 && gh.paying === 1 && gh.pending === 1 && gh.none === 1, JSON.stringify(gh));
ok('  the pending one is a missing requirement, 30 days old', (gh.states || {}).reqts === 1 && gh.oldest === 30, JSON.stringify(gh));
ok('group life: 2 policies, 1 awaiting settlement, 1 lapsed', gl.policies === 2 && gl.pending === 1 && gl.closed === 1 && (gl.states || {}).settle === 1, JSON.stringify(gl));
ok('health: the manager\'s case and the excluded agent\'s both count', h.policies === 2 && h.pending === 2, JSON.stringify(h));
ok('  but only the manager\'s case sets its age — the excluded row is off the list', h.oldest === 16, String(h.oldest));
ok('the other branch\'s row is nowhere', out.totals.policies === 7, JSON.stringify(out.totals));
ok('totals: 4 pending, 1 paying, 1 closed, 1 none', out.totals.pending === 4 && out.totals.paying === 1 && out.totals.closed === 1 && out.totals.none === 1, JSON.stringify(out.totals));

const rows = out.rows || [];
ok('three pending rows, oldest first', rows.length === 3 && rows.map(r => r.days).join(',') === '108,30,16', rows.map(r => r.days).join(','));
ok('the excluded agent has no row', !rows.some(r => /Gone/.test(r.who)));
ok('the unit manager\'s row is there with the name held back', rows.some(r => r.state === 'errors' && r.who === ''), JSON.stringify(rows[2]));
ok('the roster\'s spelling wins over the record\'s', rows.some(r => r.who === 'Beena Sample') && rows.some(r => r.who === 'Carl Fictitious'));

const inc = out.increases || {};
ok('increases book: 5 rows, 2 paying for 1,800, 1 NPW, 1 blank', inc.book.rows === 5 && inc.book.paying === 2 && inc.book.payingApi === 1800 && inc.book.npw === 1 && inc.book.blank === 1, JSON.stringify(inc.book));
ok('this year: 3 increases for 2,400', inc.year.n === 3 && inc.year.api === 2400, JSON.stringify(inc.year));
ok('pending increases: 2 for 1,300, oldest 28 days, one with no documents', inc.pending.n === 2 && inc.pending.api === 1300 && inc.pending.oldest === 28 && inc.pending.noDocs === 1 && inc.pending.reqts === 1, JSON.stringify(inc.pending));
ok('  first names are mapped to the roster', (inc.rows || []).some(r => r.who === 'Beena Sample'), JSON.stringify((inc.rows || []).map(r => r.who)));
ok('  the manager\'s is held, the excluded and the other branch\'s are gone', inc.rows.length === 2 && inc.rows.some(r => r.who === '') && !inc.rows.some(r => /Gone/.test(r.who)), JSON.stringify(inc.rows.map(r => r.who)));
ok('held names counted once per row, across both lists', out.held === 2, String(out.held));

/* ── 2. And what the wall would have shown on 17 September ─────────────── */
console.log('\nWith the old aggregates the slide is empty and the note says why:\n');
const asked2 = [];
env.sfQuery_ = function (soql) { asked2.push(soql); refuseUngroupable(soql); return []; };
const dead = env.iGroupsWall_();
ok('a refused read leaves the book empty rather than throwing', Array.isArray(dead.types) && !dead.types.length && dead.totals.policies === 0);
ok('and nothing in the fixed feed is grouped, so nothing is refused', !(dead.notes || []).length, JSON.stringify(dead.notes));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
process.exitCode = fails ? 1 : 0;
