// Whose hands it is in — every state, per person, off the client portfolio.
//
// The possession wall reads CLIENT_PORTFOLIO__c for the three dates the branch
// actually manages: contract received, contract given to the agent, and the
// acknowledgement letter back. Until 16 September 2026 an acknowledged row
// returned before it reached any per-agent key, so the wall could say who was
// holding a contract unsigned but never who had got theirs signed. An agent
// with two out and forty acknowledged read the same as one with two out and
// none. The per-person tally added that day is what this file holds to:
//
//   cabinet        received, given to nobody, signed by nobody — ours
//   given          handed to the agent, whatever happened after
//   outstanding    handed to the agent and not signed for — theirs
//   acknowledged   the client has it and signed
//
// and the branch totals must equal the three lists the ageing bands are built
// from, or the wall's hero number and its agent table disagree.
//
// The SOQL keeps Salesforce's own misspelling — Date_Policy_Contract_Recieved__c
// — and a tidy-up that "fixes" it silently empties the wall.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Intelligence.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
const NOW = new Date('2026-09-16T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* ── The branch: three agents in two units, one excluded, one departed ─────
   Invented names throughout, in the repository's own convention. */
const ACCESS = ['Name', 'Email', 'Access Code', 'Role', 'Unit', 'Agent Name (exactly as in data)', 'Agent Number', 'Active'];
env.__mkSheet('Access', 1, ACCESS, [
  ['Anand Pretend',   'a@example.com', '1111', 'Agent', 'Unit A',          'Anand Pretend',   'A00001', 'Yes'],
  ['Beena Sample',    'b@example.com', '2222', 'Agent', 'Unit A',          'Beena Sample',    'A00002', 'Yes'],
  ['Carl Fictitious', 'c@example.com', '3333', 'Agent', 'Ricky Rampersad', 'Carl Fictitious', 'A00003', 'Yes'],
  ['Gone Away',       'g@example.com', '4444', 'Agent', 'Unit A',          'Gone Away',       'A00004', 'Yes'],
  ['Dora Departed',   'd@example.com', '5555', 'Agent', 'Unit A',          'Dora Departed',   'A00005', 'Yes']
]);
/* The in-force book is where employment status comes from; one agent has
   gone Inactive there and the access list has not caught up. */
const INF = ['Policy Id', 'Policy Maturity Date', 'Plan', 'Fund Value', 'Servicing Agent Id', 'Servicing Agent Status'];
env.__mkSheet('Inforce', 2, INF, [
  ['P1', '2050-01-01', 'ECT65', 0, 'A00001', 'Active'],
  ['P2', '2050-01-01', 'ECT65', 0, 'A00002', 'Active'],
  ['P3', '2050-01-01', 'ECT65', 0, 'A00003', 'Active'],
  ['P4', '2050-01-01', 'ECT65', 0, 'A00004', 'Active'],
  ['P5', '2050-01-01', 'ECT65', 0, 'A00005', 'Inactive']
]);

/* ── The portfolio: thirteen contracts across the four states ────────────── */
const row = (agent, unit, got, gave, ack) => ({
  AgentName__c: agent, Unit__c: unit,
  Date_Policy_Contract_Recieved__c: got,
  Date_Contract_Given_to_Agent__c: gave || null,
  Date_Ack_Letter_Received_from_Agent__c: ack || null
});
const PORTFOLIO = [
  // Anand: one in the cabinet, two out (one past 90 days), one signed
  row('A00001 - Anand Pretend', 'Unit_A', '2026-08-01', null,         null),
  row('A00001 - Anand Pretend', 'Unit_A', '2026-07-01', '2026-07-05', null),          // 73 days out
  row('A00001 - Anand Pretend', 'Unit_A', '2026-05-01', '2026-05-10', null),          // 129 days out
  row('A00001 - Anand Pretend', 'Unit_A', '2026-06-01', '2026-06-03', '2026-06-20'),
  // Beena: one out, one signed with no handover date recorded, one in the cabinet
  row('A00002 - Beena Sample',  'Unit_A', '2026-08-20', '2026-08-25', null),          // 22 days out
  row('A00002 - Beena Sample',  'Unit_A', '2026-08-20', null,         '2026-09-01'),
  row('A00002 - Beena Sample',  'Unit_A', '2026-09-10', null,         null),
  // Carl, named plainly and placed by the unit column: both signed
  row('Carl Fictitious', 'Ricky_Rampersad', '2026-03-01', '2026-03-02', '2026-03-15'),
  row('Carl Fictitious', 'Ricky_Rampersad', '2026-04-01', '2026-04-02', '2026-04-20'),
  // Excluded by INTEL_EXCLUDE_AGENTS: two rows, one name
  row('A00004 - Gone Away', 'Unit_A', '2026-08-01', '2026-08-02', null),
  row('A00004 - Gone Away', 'Unit_A', '2026-08-03', null,         null),
  // Inactive in the in-force book
  row('A00005 - Dora Departed', 'Unit_A', '2026-07-01', '2026-07-02', null),
  // Another branch's book
  row('Zed Elsewhere', 'Other_Branch', '2026-07-01', '2026-07-02', null)
];
let asked = '';
env.sfQuery_ = function (soql) { asked = soql; return PORTFOLIO; };

console.log('\nThe query, letter for letter:\n');
const D = env.iBuildPossession_();
ok('the build is configured', D.configured === true, D.error || '');
ok('it reads the client portfolio', /FROM CLIENT_PORTFOLIO__c/.test(asked), asked);
ok('and keeps Salesforce’s own misspelling of the received date',
   /Date_Policy_Contract_Recieved__c/.test(asked) && !/Date_Policy_Contract_Received__c/.test(asked), asked);

/* ── Per agent ───────────────────────────────────────────────────────────── */
console.log('\nEvery state, per person:\n');
const F = {}; (D.byAgentFull || []).forEach(p => { F[p.k] = p; });
ok('three agents carry a contract this year', Object.keys(F).length === 3, JSON.stringify(Object.keys(F)));
const want = {
  'Anand Pretend':   { total: 4, cabinet: 1, given: 3, outstanding: 2, acknowledged: 1, oldest: 129, over90: 1, unit: 'Unit A' },
  'Beena Sample':    { total: 3, cabinet: 1, given: 1, outstanding: 1, acknowledged: 1, oldest: 22,  over90: 0, unit: 'Unit A' },
  'Carl Fictitious': { total: 2, cabinet: 0, given: 2, outstanding: 0, acknowledged: 2, oldest: 0,   over90: 0, unit: 'Ricky Rampersad' }
};
Object.keys(want).forEach(name => {
  const p = F[name] || {};
  Object.keys(want[name]).forEach(k => {
    ok(name + ' · ' + k + ' = ' + want[name][k], p[k] === want[name][k], String(p[k]));
  });
});
ok('an acknowledgement with no handover date is signed, not in the cabinet',
   F['Beena Sample'].cabinet === 1 && F['Beena Sample'].acknowledged === 1 && F['Beena Sample'].given === 1);
ok('n is an alias of outstanding, so the row reads like every other wall',
   D.byAgentFull.every(p => p.n === p.outstanding));
ok('sorted by outstanding, most first',
   D.byAgentFull.map(p => p.k).join(' · ') === 'Anand Pretend · Beena Sample · Carl Fictitious',
   D.byAgentFull.map(p => p.k).join(' · '));
ok('the agent with nothing outstanding is still on the list', !!F['Carl Fictitious']);
ok('and is not on the unsigned-only list',
   D.byAgent.length === 2 && !D.byAgent.some(a => a.k === 'Carl Fictitious'), JSON.stringify(D.byAgent));

/* ── Branch totals, and that they agree with the ageing lists ───────────── */
console.log('\nThe branch totals:\n');
const S = D.states || {};
ok('2 in the cabinet',  S.cabinet === 2, String(S.cabinet));
ok('6 given',           S.given === 6, String(S.given));
ok('3 outstanding',     S.outstanding === 3, String(S.outstanding));
ok('4 acknowledged',    S.acknowledged === 4, String(S.acknowledged));
ok('9 in all',          S.total === 9 && D.total === 9, S.total + ' / ' + D.total);
ok('the cabinet total is the cabinet list', S.cabinet === D.cabinet.n, String(D.cabinet.n));
ok('the outstanding total is the with-agent list', S.outstanding === D.withAgent.n, String(D.withAgent.n));
ok('the acknowledged total is the hero’s', S.acknowledged === D.acknowledged, String(D.acknowledged));
ok('the oldest outstanding on the wall is the oldest per agent',
   D.withAgent.oldest === 129 && D.withAgent.over90 === 1, D.withAgent.oldest + ' / ' + D.withAgent.over90);

/* ── What was left off, said out loud ───────────────────────────────────── */
console.log('\nWhat the exclusion removed:\n');
const X = D.excluded || {};
ok('two rows from the excluded agent', X.rows === 2, String(X.rows));
ok('one excluded name', X.agents === 1, String(X.agents));
ok('the excluded agent is on no list',
   !F['Gone Away'] && !D.byAgent.some(a => a.k === 'Gone Away') && !D.cabinetBy.some(a => a.k === 'Gone Away'));
ok('the departed agent’s contract is counted, not attributed', X.notActive === 1 && !F['Dora Departed'], String(X.notActive));
ok('the other branch’s row is counted, not attributed', X.offBranch === 1, String(X.offBranch));

/* ── No slices ──────────────────────────────────────────────────────────── */
console.log('\nThe wall is handed the whole list:\n');
const MANY = [];
for (let i = 1; i <= 30; i++) MANY.push(['Sample Person ' + i, 'p' + i + '@example.com', '9' + i, 'Agent', 'Unit A', 'Sample Person ' + i, 'A009' + String(i).padStart(2, '0'), 'Yes']);
const env2 = makeEnv();
env2.Date = env.Date;
env2.__mkSheet('Access', 1, ACCESS, MANY);
env2.sfQuery_ = () => MANY.map((m, i) => row(m[6] + ' - ' + m[0], 'Unit_A', '2026-08-01', '2026-08-02', i % 3 ? null : '2026-08-10'));
const D2 = env2.iBuildPossession_();
ok('30 agents in every state, not 24', (D2.byAgentFull || []).length === 30, String((D2.byAgentFull || []).length));
ok('20 unsigned, not 24 capped', (D2.byAgent || []).length === 20, String((D2.byAgent || []).length));
ok('and nothing removed when nobody is excluded', D2.excluded.rows === 0 && D2.excluded.agents === 0, JSON.stringify(D2.excluded));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nALL PASS\n');
process.exit(fails ? 1 : 0);
