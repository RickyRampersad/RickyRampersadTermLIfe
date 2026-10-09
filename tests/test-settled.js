// Settled today, this week, this month — and the gate on the policy table.
//
// The pending wall counts what is waiting. This is the other end of it: what
// came off, by agent, in three windows. Salesforce is the authority, because a
// policy is settled when CLIENT_PORTFOLIO__c says PREMIUM PAYING against it
// with an issue date — not when somebody in the branch writes it down. One
// aggregate query for the month, bucketed here.
//
// Two rules that have to hold, and that this file exists to hold:
//
//   AN EXCLUSION TAKES A NAME OFF THE LIST, NEVER A POLICY OUT OF THE TOTAL.
//   The branch's month is the branch's month whoever wrote the business.
//
//   THE POLICY TABLE IS HELD UNLESS THE MANAGER SAYS THE PHRASE, EXACTLY.
//   intel.pending is served with no sign-in, and the audit of 15 September
//   2026 found intel.book serving per-client rows to anybody who asked.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'kpi-intel-settled-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

/* Wednesday 16 September 2026. Monday was the 14th, so the week is the 14th
   to the 16th, and the 11th is in the month and not the week. */
function clock(env, iso) {
  const NOW = new Date(iso);
  const realDate = env.Date;
  env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                   get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
}

/* What the aggregate hands back: one row per agent per issue date. Invented
   agents, invented counts. The excluded one and the manager are there on
   purpose. */
const AGG = [
  { nm: 'Anand Pretend',   d: '2026-09-16', n: 2 },
  { nm: 'Anand Pretend',   d: '2026-09-14', n: 1 },
  { nm: 'Anand Pretend',   d: '2026-09-03', n: 3 },
  { nm: 'Beena Sample',    d: '2026-09-16', n: 1 },
  { nm: 'Beena Sample',    d: '2026-09-11', n: 2 },
  { nm: 'Carl Fictitious', d: '2026-09-15', n: 1 },
  { nm: 'Gone Away',       d: '2026-09-16', n: 4 },
  { nm: 'Gone Away',       d: '2026-09-02', n: 1 },
  { nm: null,              d: '2026-09-10', n: 1 }
];

console.log('\nThe three windows, from one query:\n');
const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away', INTEL_LIST_ONLY_EXCLUDE: 'Carl Fictitious' } });
clock(env, '2026-09-16T10:00:00');
const asked = [];
env.sfQuery_ = function (soql) { asked.push(soql); return AGG.slice(); };
const S = env.iSettledWindows_();
ok('one round trip, not three', asked.length === 1, String(asked.length));
ok('it asks for premium paying, issued this month, grouped by agent and day',
   /Policy_Status_Description__c = 'PREMIUM PAYING'/.test(asked[0]) && /ISSUE_DATE__c = THIS_MONTH/.test(asked[0]) &&
   /GROUP BY AGENT__r.Name, ISSUE_DATE__c/.test(asked[0]), asked[0]);
ok('and aliases only in the aggregate', /AGENT__r.Name nm, ISSUE_DATE__c d, COUNT\(Id\) n/.test(asked[0]));
ok('today is the sixteenth', S.today === 2 + 1 + 4, String(S.today));
ok('the week runs Monday to date', S.week === 2 + 1 + 4 + 1 + 1 && S.weekFrom === '2026-09-14', JSON.stringify([S.week, S.weekFrom]));
ok('the month is everything', S.month === 16 && S.month === AGG.reduce((a, r) => a + r.n, 0), String(S.month));
ok('the eleventh is in the month and not the week', S.week < S.month);

console.log('\nAn exclusion takes a name off the list, never a policy out of the total:\n');
const by = {}; S.byAgent.forEach(a => { by[a.agent] = a; });
ok('the excluded agent is not on the list', !by['Gone Away'], JSON.stringify(Object.keys(by)));
ok('but their four today are still in today', S.today === 7, String(S.today));
ok('and the list says what came off it', S.excluded.names === 1 && S.excluded.policies === 5, JSON.stringify(S.excluded));
ok('the list-only manager is off the list too', !by['Carl Fictitious'] && S.listOnly === 1);
ok('and still in the week', S.week === 9, String(S.week));
ok('an agent carries their own three windows', by['Anand Pretend'].today === 2 && by['Anand Pretend'].week === 3 && by['Anand Pretend'].month === 6,
   JSON.stringify(by['Anand Pretend']));
ok('a policy with no agent is in the total and named as such', S.month === 16 && by['(no agent)'] && by['(no agent)'].month === 1);
ok('ranked by today, then the week', S.byAgent[0].agent === 'Anand Pretend' && S.byAgent[1].agent === 'Beena Sample',
   S.byAgent.map(a => a.agent).join(', '));

console.log('\nWhen Salesforce will not answer, it says so:\n');
const down = makeEnv({ props: {} });
clock(down, '2026-09-16T10:00:00');
down.sfQuery_ = function () { throw new Error('INVALID_SESSION_ID'); };
const E = down.iSettledWindows_();
ok('the error is the payload', !!E.error && /INVALID_SESSION_ID/.test(E.error), JSON.stringify(E));
ok('and there is no zero pretending to be a quiet day', E.today === undefined && E.month === undefined);
const nohelper = makeEnv({ props: {} });
clock(nohelper, '2026-09-16T10:00:00');
nohelper.sfQuery_ = undefined; nohelper.sfkQuery_ = undefined;
const H = nohelper.iSettledWindows_();
ok('a project with no Salesforce helper is an error too, not a blank month', !!H.error, JSON.stringify(H));

console.log('\nOn the wall, beside what is pending:\n');
// The pending extract, one row per requirement, as on the other tests.
const PHEAD = ['YR','MTH','POLICY','DECISIONTYPE','CLIENT NAME','STATUS','SUBMITDT','BRANCH',
               'REQT','REQTDT','AGENTID','AGENT NAME','REQTDAYSLAPSED','BRANCHNAME',
               'POL_MISC_SUSP_AMT','CLIENTID','BEING PROCESSED IN','PAYMENT METHOD','POL_MISC_PREM'];
const prow = (policy, agent, reqtDt, susp, prem, reqt) =>
  [2026, 9, policy, 'OR', 'CLIENTNAME-' + policy, '3', '2026-08-01', 'CHAG', reqt, reqtDt,
   'A1', agent, 0, 'AK', susp, 'CID-' + policy, 'Branch', 'DD', prem];
const ROWS = [
  prow('P-AAA', 'Anand Pretend', '2026-08-01', 0, '', 'MDMED'),
  prow('P-AAA', 'Anand Pretend', '2026-08-10', 0, '', 'PRADD'),
  prow('P-BBB', 'Beena Sample',  '2026-08-20', 250, 800, 'FUTPY'),
  prow('P-MGR', 'Carl Fictitious', '2026-09-01', 0, '', ''),
  prow('P-SKIP', 'Gone Away',    '2026-06-01', 0, '', 'MDMED')
];
env.__mkSheet('URPPBIEX - Reqt', 4, PHEAD, ROWS);
env._intelTabMemo = {}; env._intelHeadMemo = {};
const W = env.iPendingWall_();
ok('settled rides on the pending feed', W.settled && W.settled.today === 7 && W.settled.month === 16, JSON.stringify(W.settled));
ok('and a broken Salesforce does not take the pending screen down with it', (() => {
  env.sfQuery_ = function () { throw new Error('INVALID_SESSION_ID'); };
  const w = env.iPendingWall_();
  env.sfQuery_ = function () { return AGG.slice(); };
  return w.configured === true && w.settled && /INVALID_SESSION_ID/.test(w.settled.error) && w.policies === 3;
})());

console.log('\nThe policy table is held unless the manager says the phrase, exactly:\n');
function wallWith(props) {
  const e = makeEnv({ props: Object.assign({ INTEL_EXCLUDE_AGENTS: 'Gone Away', INTEL_LIST_ONLY_EXCLUDE: 'Carl Fictitious' }, props) });
  clock(e, '2026-09-16T10:00:00');
  e.sfQuery_ = function () { return AGG.slice(); };
  e.__mkSheet('URPPBIEX - Reqt', 4, PHEAD, ROWS);
  e._intelTabMemo = {}; e._intelHeadMemo = {};
  return e.iPendingWall_();
}
const held = wallWith({});
ok('nothing set: held', held.table.shown === false && !held.table.rows, JSON.stringify(held.table));
ok('and the screen is told how to open it', /INTEL_PENDING_ROWS_ON_WALL/.test(held.table.note) && /show policy numbers/.test(held.table.note));
ok('and no policy number is in the feed', JSON.stringify(held).indexOf('P-AAA') < 0 && JSON.stringify(held).indexOf('CID-') < 0);
[['yes', 'a yes'], ['true', 'a true'], ['Show Policy Numbers', 'the phrase with capitals'],
 ['show policy numbers ', 'the phrase with a trailing space'], ['show policy number', 'the phrase short a letter']]
  .forEach(([v, what]) => {
    const w = wallWith({ INTEL_PENDING_ROWS_ON_WALL: v });
    ok(what + ' does not open it', w.table.shown === false && JSON.stringify(w).indexOf('P-AAA') < 0, JSON.stringify(w.table));
  });
const open = wallWith({ INTEL_PENDING_ROWS_ON_WALL: 'show policy numbers' });
ok('the exact phrase does', open.table.shown === true && Array.isArray(open.table.rows), JSON.stringify(open.table).slice(0, 200));
ok('one row per policy, not per requirement', open.table.rows.length === 2, JSON.stringify(open.table.rows.map(r => r.policy)));
const row = open.table.rows.filter(r => r.policy === 'P-AAA')[0];
ok('a row is the policy, the agent and what it waits on', row && row.agent === 'Anand Pretend' && row.codes.length === 2, JSON.stringify(row));
ok('never the client', JSON.stringify(open.table).indexOf('CLIENTNAME') < 0 && JSON.stringify(open.table).indexOf('CID-') < 0);
ok('the excluded agent’s policy is not in it', !open.table.rows.some(r => r.policy === 'P-SKIP'));
ok('nor the list-only manager’s', !open.table.rows.some(r => r.agent === 'Carl Fictitious'));
ok('the counts above the table still hold the manager’s policy', open.policies === 3, String(open.policies));
ok('and the columns the extract does not carry are null on the row, not zero',
   row.statusDesc === null && row.api === null && row.noCash === null && row.daysPending === null, JSON.stringify(row));

console.log('\nAnd the feed the wall reads is the same, gate and all:\n');
const out = env.doPost({ postData: { contents: JSON.stringify({ action: 'intel.pending' }) } });
let got = null;
try { got = JSON.parse(out.getContent()); } catch (e) {}
ok('intel.pending answers with settled on it', got && got.ok && got.data.settled && got.data.settled.month === 16,
   JSON.stringify(got && got.data && got.data.settled));
ok('and the table held', got && got.data.table.shown === false && JSON.stringify(got).indexOf('P-AAA') < 0);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
