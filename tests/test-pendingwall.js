// What is pending, on a wall that nobody signs in to.
//
// The branch asked for a pending screen. Two things had to be true before it
// could exist.
//
// The first: it had to read the list the branch actually keeps. The builder
// already in this file reads the Guardian extract — Policy, DecisionType,
// ReqtdaysLapsed, suspense. The branch's own working lists are nothing like
// it: Unit, Agent, Number, Client, Days, App Received Date, Comments, and the
// comment is the only place that says what a case is waiting on. There is
// more than one of them, so every tab of that shape is read.
//
// The second, and the one that must never slip: the wall actions carry no
// token, because a screen on a wall has nobody to sign it in. In exchange
// they return aggregates only. Every row of a pending list is a named client
// with a policy number against them. This proves none of that leaves.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'kpi-intel-pend-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

// Everything below is invented. No branch list, and no client of this branch,
// is in this repository or ever may be.
const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
const NOW = new Date('2026-09-11T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

const HEAD = ['Unit', 'Agent', 'Number', 'Client', 'Days', 'App Received Date', 'Comments'];
// Two lists, as the branch keeps them — the point of reading every tab.
env.__mkSheet('Pending AK', 1, HEAD, [
  ['AK', 'Anand Pretend', 'POLICY-AAA', 'CLIENTNAME-AAA', 25, '2026-08-17', 'DD to be amended, agent uploading today'],
  ['AK', 'Anand Pretend', 'POLICY-BBB', 'CLIENTNAME-BBB', 25, '2026-08-18', 'Full med, OFT, POA. POA received'],
  ['AK', 'Anand Pretend', 'POLICY-CCC', 'CLIENTNAME-CCC', 24, '2026-09-04', 'Routine docs'],
  ['AK', 'Beena Pretend', 'POLICY-DDD', 'CLIENTNAME-DDD', 8128, '', '1st premium — client has a death in family'],
  ['AK', 'Gone Away',     'POLICY-EEE', 'CLIENTNAME-EEE', 12, '2026-09-01', 'School details'],
]);
env.__mkSheet('Pending RR', 2, HEAD, [
  ['RR', 'Beena Pretend', 'POLICY-FFF', 'CLIENTNAME-FFF', 0, '2026-01-02', 'Waiting on head office'],
  ['RR', 'Beena Pretend', 'POLICY-GGG', 'CLIENTNAME-GGG', 0, '2026-06-20', ''],
]);

console.log('\nEvery list of that shape is read, not the biggest of them:\n');
const tabs = env.iBranchPendTabs_();
ok('both branch lists are found', tabs.length === 2, String(tabs.length));

let D = env.iPendingWall_();
ok('the feed is configured', D.configured === true, JSON.stringify(D).slice(0, 120));
ok('it says how many lists it read', D.lists === 2, String(D.lists));
// Five rows on the first list, two on the second; one agent is excluded.
ok('every case is counted across both', D.total === 6, String(D.total));
ok('the excluded agent is dropped, and counted', D.excluded && D.excluded.lists === 1 && D.excluded.names === 1, JSON.stringify(D.excluded));
ok('and does not appear anywhere', JSON.stringify(D).indexOf('Gone Away') < 0);

console.log('\nNo client and no policy number reaches the screen:\n');
const blob = JSON.stringify(D);
['CLIENTNAME-AAA', 'CLIENTNAME-BBB', 'CLIENTNAME-CCC', 'CLIENTNAME-DDD', 'CLIENTNAME-FFF', 'CLIENTNAME-GGG']
  .forEach(c => ok('no "' + c + '"', blob.indexOf(c) < 0));
['POLICY-AAA', 'POLICY-BBB', 'POLICY-FFF'].forEach(p => ok('no "' + p + '"', blob.indexOf(p) < 0));
ok('nor the sentence somebody typed about a client',
   blob.indexOf('death in family') < 0 && blob.indexOf('uploading today') < 0, blob.slice(0, 160));
ok('our own agents are named, because they are ours',
   /Anand Pretend/.test(blob) && /Beena Pretend/.test(blob));

console.log('\nAge comes from the date the application was received:\n');
// 17 Aug to 11 Sep is 25 days; the Days column happens to agree. 2 Jan is
// over six months, and its Days column says 0 — the date is the fact.
const band = k => (D.ageing || {})[k] || 0;
ok('a case from January lands in the oldest band, whatever Days says', band('180+') === 1, JSON.stringify(D.ageing));
ok('and the June one at eighty-three days in two to three months', band('61-90') === 1, JSON.stringify(D.ageing));
ok('the August cases are inside a month', band('0-30') >= 2, JSON.stringify(D.ageing));
ok('the oldest is counted in days, from the date', D.oldest === env.iDays_(new env.Date('2026-01-02'), env.iToday_()),
   String(D.oldest));
ok('one has waited more than ninety days', D.stale === 1, String(D.stale));
// 8128 in a Days column is a stale cell, not a case that waited twenty-two years.
ok('an impossible Days figure is refused rather than shown',
   D.oldest < 3650 && band('180+') === 1, String(D.oldest));

console.log('\nWhat is holding them, read out of what the branch wrote:\n');
const why = {}; (D.reasons || []).forEach(r => { why[r.name] = r.n; });
ok('a direct debit is a bank matter', why['Bank or direct debit'] === 1, JSON.stringify(why));
ok('a full med is medical', why['Medical'] === 1, JSON.stringify(why));
ok('routine docs are documents', why['Documents'] >= 1, JSON.stringify(why));
ok('a first premium is its own reason', why['First premium'] === 1, JSON.stringify(why));
ok('a sentence matching none of the branch\'s words is Other, not a guess',
   why['Other'] === 1, JSON.stringify(why));
ok('and a blank comment is named as blank', why['No reason written'] === 1, JSON.stringify(why));
ok('the count of those is on the screen too', D.noReason === 1, String(D.noReason));
ok('every case is in exactly one reason',
   (D.reasons || []).reduce((a, r) => a + r.n, 0) === D.total,
   (D.reasons || []).map(r => r.name + '×' + r.n).join(', '));

console.log('\nWhose they are, and which unit:\n');
const byAgent = {}; (D.agents || []).forEach(a => { byAgent[a.agent] = a; });
ok('each agent carries their own count', byAgent['Anand Pretend'].policies === 3, JSON.stringify(D.agents));
ok('and the age of their oldest', byAgent['Beena Pretend'].oldest > 180, JSON.stringify(D.agents));
ok('the busiest is first', (D.agents || [])[0].policies >= (D.agents || [])[1].policies);
const units = {}; (D.units || []).forEach(u => { units[u.name] = u.n; });
ok('the units are counted', units['AK'] === 4 && units['RR'] === 2, JSON.stringify(units));

console.log('\nWithout the Guardian extract it says so, rather than a bare dash:\n');
ok('suspense is null, not zero — zero would read as "none held"', D.suspense === null, String(D.suspense));
ok('and the missing extract is noted', (D.notes || []).some(n => /pending tab/i.test(n)), JSON.stringify(D.notes));

console.log('\nAnd the wall can ask for it:\n');
const out = env.doPost({ postData: { contents: JSON.stringify({ action: 'intel.pending' }) } });
let got = null;
try { got = JSON.parse(out.getContent()); } catch (e) {}
ok('intel.pending answers', got && got.ok === true, JSON.stringify(got).slice(0, 120));
ok('with the same aggregates', got && got.data && got.data.total === 6, JSON.stringify(got && got.data && got.data.total));
ok('and no client in the reply either',
   JSON.stringify(got).indexOf('CLIENTNAME') < 0 && JSON.stringify(got).indexOf('POLICY-') < 0);

console.log('\nWith the underwriter\u2019s own extract, the codes answer instead of the comments:\n');
// RR_UWPRO_INSURED_Requirement: one row per requirement, repeated once per
// history row — which is why the builder takes each insured_requirement_id
// once. Invented rows; no requirement of this branch is in this repository.
env.__mkSheet('RR_UWPRO_INSURED_Requirement', 3,
  ['INSURED_REQUIREMENT_ID', 'POLICY_NUMBER', 'REQUIREMENT_CODE', 'REQUIREMENTS',
   'REQUIREMENT_COMMENT', 'ADDED_DATE', 'CLOSED_DATE', 'ORDERED_DATE', 'FIRST_NAME', 'LAST_NAME'],
  [
    ['REQ-1', 'POLICY-AAA', 'MDMED', 'Medical',   '', '2026-08-17', '', '', 'INSUREDFIRST-A', 'INSUREDLAST-A'],
    ['REQ-1', 'POLICY-AAA', 'MDMED', 'Medical',   '', '2026-08-17', '', '', 'INSUREDFIRST-A', 'INSUREDLAST-A'],
    ['REQ-2', 'POLICY-AAA', 'PRADD', 'Documents', '', '2026-08-17', '', '', 'INSUREDFIRST-A', 'INSUREDLAST-A'],
    ['REQ-3', 'POLICY-BBB', 'MDMED', 'Medical',   '', '2026-01-05', '', '', 'INSUREDFIRST-B', 'INSUREDLAST-B'],
    ['REQ-4', 'POLICY-CCC', 'FUTPY', 'Premium',   '', '2026-09-01', '2026-09-05', '', 'INSUREDFIRST-C', 'INSUREDLAST-C'],
  ]);
env._intelTabMemo = {};
const R = env.iPendingWall_();
{
  const rq = R.requirements || {};
  ok('the requirements carry their dates, month by month since the cut',
     Array.isArray(rq.byMonth) && rq.byMonth.length > 0 && rq.byMonth.every(m => /^2026-\d\d$/.test(m.ym) && m.n > 0 && m.lab.length === 3),
     JSON.stringify(rq.byMonth));
  ok('and name the oldest and newest', /^2026-\d\d-\d\d$/.test(rq.oldestOn) && /^2026-\d\d-\d\d$/.test(rq.newestOn) && rq.oldestOn <= rq.newestOn, rq.oldestOn + ' .. ' + rq.newestOn);
}
ok('it says it read the requirements extract too', /requirements extract/.test(R.source), R.source);
ok('and the codes answer, not the comments', R.reasonsFrom === 'requirement codes', R.reasonsFrom);
const codes = {}; (R.reasons || []).forEach(x => { codes[x.name] = x.n; });
ok('a code is turned into words', codes['Medical examination'] === 2, JSON.stringify(codes));
ok('and so is the other one', codes['Proof of address'] === 1, JSON.stringify(codes));
ok('a requirement repeated on every history row is counted once',
   (R.requirements || {}).open === 3, JSON.stringify(R.requirements));
ok('one already closed is not open at all', !codes['First / future premium'], JSON.stringify(codes));
ok('but it counts as cleared', (R.requirements || {}).closedThisYear === 1, JSON.stringify(R.requirements));
ok('the cases they sit on are counted, not the requirements',
   (R.requirements || {}).policies === 2, JSON.stringify(R.requirements));
ok('the branch\u2019s own case count still leads the screen', R.total === 6, String(R.total));
const rblob = JSON.stringify(R);
ok('no insured name reaches the screen', rblob.indexOf('INSUREDFIRST') < 0 && rblob.indexOf('INSUREDLAST') < 0);
ok('and still no policy number', rblob.indexOf('POLICY-') < 0);

console.log('\nWhose move is it — the rule that a chase has to earn:\n');
// A pending list that says "sixty-one outstanding" gets every agent rung
// about a blood profile sitting at a lab, and the next call — the one that
// mattered — is ignored. So every case lands in exactly one bucket and only
// two of them are anybody's to work today. Invented throughout.
const PHEAD = ['YR','MTH','POLICY','DECISIONTYPE','CLIENT NAME','STATUS','SUBMITDT','BRANCH',
               'REQT','REQTDT','AGENTID','AGENT NAME','REQTDAYSLAPSED','BRANCHNAME',
               'POL_MISC_SUSP_AMT','CLIENTID','BEING PROCESSED IN','PAYMENT METHOD','POL_MISC_PREM'];
const prow = (policy, agent, reqtDt, susp, prem) =>
  [2026, 9, policy, 'OR', 'CLIENTNAME-' + policy, '3', '2026-08-01', 'CHAG', 'Reqt', reqtDt,
   'A1', agent, 0, 'AK', susp, 'CID-' + policy, 'Branch', 'DD', prem];
env.__mkSheet('URPPBIEX - Reqt', 4, PHEAD, [
  prow('P-READY',   'Anand Pretend', '2026-08-01', 0,   ''),     // clear, nothing paid
  prow('P-ISSUE',   'Anand Pretend', '2026-08-01', 0,   500),    // clear and paid
  prow('P-AGENT',   'Anand Pretend', '2026-07-01', 0,   ''),     // proof of address, not ordered
  prow('P-ROUTINE', 'Beena Pretend', '2026-08-20', 250, 800),    // medical, ordered
  prow('P-CLIENT',  'Beena Pretend', '2026-06-01', 0,   300),    // waiting on the client
  prow('P-SKIP',    'Gone Away',     '2026-06-01', 0,   ''),     // excluded agent
]);
const rsheet = env.__sheets['RR_UWPRO_INSURED_Requirement'];
[['RQ-10','P-AGENT','PRADD','Documents','','2026-07-01','',''],
 ['RQ-11','P-ROUTINE','MDMED','Medical','','2026-08-20','','2026-08-21'],   // ordered
 ['RQ-12','P-CLIENT','PCFEV','Client','','2026-06-01','',''],
 ['RQ-13','P-SKIP','PRADD','Documents','','2026-06-01','','']
].forEach(r => rsheet.appendRow(r.concat(['INSUREDFIRST-X','INSUREDLAST-X'])));
env._intelTabMemo = {}; env._intelHeadMemo = {};

const T = env.iPendingWall_().triage;
const bucket = {}; (T.buckets||[]).forEach(b => { bucket[b.key] = b.n; });
ok('a case with nothing outstanding and no premium is ready to settle', bucket.ready === 1, JSON.stringify(bucket));
ok('the same case with a premium in is head office\u2019s, not ours', bucket.issue === 1, JSON.stringify(bucket));
ok('an un-ordered proof of address is the agent\u2019s move', bucket.agent === 1, JSON.stringify(bucket));
ok('a medical already ordered is in motion, and nobody\u2019s to chase', bucket.routine === 1, JSON.stringify(bucket));
ok('a client confirmation is the client\u2019s move', bucket.client === 1, JSON.stringify(bucket));
ok('the excluded agent\u2019s case is in no bucket at all',
   (T.buckets||[]).reduce((a,b) => a + b.n, 0) === 5, JSON.stringify(bucket));

ok('only ready and the agent\u2019s move can be worked today', T.workable === 2, String(T.workable));
ok('everything else is waiting on somebody who is already on it', T.waiting === 3, String(T.waiting));
ok('every bucket carries how long its worst case has waited',
   (T.buckets||[]).every(b => b.n === 0 || b.oldest > 0), JSON.stringify(T.buckets));

console.log('\nAn ordered requirement is in motion whatever its code says:\n');
ok('ordered beats the code', env.iReqOwner_('PRADD', true, env.iReqOwners_()) === 'routine');
ok('and un-ordered lets the code decide', env.iReqOwner_('PRADD', false, env.iReqOwners_()) === 'agent');
ok('a code nobody mapped is left alone rather than blamed on an agent',
   env.iReqOwner_('WHATISTHIS', false, env.iReqOwners_()) === 'routine');
const owned = makeEnv({ props: { INTEL_REQ_OWNERS: 'MDMED=agent,PRADD=routine' } });
ok('and the branch can overrule every line of the map',
   owned.iReqOwner_('MDMED', false, owned.iReqOwners_()) === 'agent' &&
   owned.iReqOwner_('PRADD', false, owned.iReqOwners_()) === 'routine');

console.log('\nReady to settle is its own screen, because it is the easiest to miss:\n');
ok('it is counted on its own', T.ready.cases === 1, JSON.stringify(T.ready));
ok('with the agent who can collect it named', (T.ready.agents||[])[0].agent === 'Anand Pretend',
   JSON.stringify(T.ready.agents));
ok('and how long it has sat', T.ready.oldest > 0, String(T.ready.oldest));

console.log('\nWho is holding it up — ranked by what is theirs, not by how many they have:\n');
const c = T.culprits || [];
ok('the agent with work to do is first', c[0] && c[0].agent === 'Anand Pretend', JSON.stringify(c));
ok('counted on what is actually theirs', c[0] && c[0].actionable === 2, JSON.stringify(c[0]));
ok('an agent whose cases are all in motion is not a culprit',
   !c.some(x => x.agent === 'Beena Pretend' && x.actionable > 0), JSON.stringify(c));
ok('the excluded agent is nowhere in it', !c.some(x => x.agent === 'Gone Away'));
ok('no client or policy number in any of it',
   JSON.stringify(T).indexOf('CLIENTNAME') < 0 && JSON.stringify(T).indexOf('P-READY') < 0 &&
   JSON.stringify(T).indexOf('CID-') < 0, JSON.stringify(T).slice(0, 200));

console.log('\nAnd the premium column says plainly when nothing has come in:\n');
const M = env.iPendingWall_().money;
ok('policies with a blank premium are counted, the excluded agent\u2019s not among them', M.unpaidPolicies === 2 && M.unpaidCases === 2, JSON.stringify(M));
ok('separately from money already held', M.held === 250, JSON.stringify(M));

console.log('\nThe Salesforce chase log, by the field the KPI list is aligned to:\n');
// SFTASK MGT. The subject carries the policy number and the client's name,
// which is how a task is joined to a case — and why nothing but counts and
// ages ever leaves the builder. Invented rows throughout.
env.__mkSheet('SFTASK MGT', 5,
  ['SUBJECT','TASK TYPE','STATUS','ASSIGNED','DAYS O/S','LAST MODIFIED DATE',
   'DAYS SINCE LAST ACTIVITY','AGENT','CONTACT','CREATED BY','DATE'],
  [
    ['Follow up with UW- 1000894223 CLIENTNAME-T1','Pending','Open','Desk One',   12,'2026-08-30',0,'Anand Pretend','CLIENTNAME-T1','x','2026-08-30'],
    ['Follow up with UW- 1000894224 CLIENTNAME-T2','Pending','Open','Desk One',   64,'2026-07-09',0,'Anand Pretend','CLIENTNAME-T2','x','2026-07-09'],
    ['Premium- 5004278954 CLIENTNAME-T3','Premium','Open','Desk Two',              5,'2026-09-06',0,'Beena Pretend','CLIENTNAME-T3','x','2026-09-06'],
    ['Requirement chase 1000894371 CLIENTNAME-T4','','Open','(unassigned)',       40,'2026-08-02',0,'Beena Pretend','CLIENTNAME-T4','x','2026-08-02'],
    ['Follow up with UW- 1000899306 CLIENTNAME-T5','Pending','Completed','Desk One',3,'2026-09-08',0,'Anand Pretend','CLIENTNAME-T5','x','2026-09-08'],
  ]);
env._intelTabMemo = {}; env._intelHeadMemo = {};
const W = env.iPendingWall_().work;
ok('the chase log is read', !!W, JSON.stringify(W));
ok('open and closed are counted apart', W.open === 4 && W.closed === 1, JSON.stringify(W));
const types = {}; (W.byType||[]).forEach(t => { types[t.name] = t; });
ok('open tasks are grouped by Task Type', types['Pending'].n === 2, JSON.stringify(W.byType));
ok('with the oldest of each', types['Pending'].oldest === 64, JSON.stringify(types['Pending']));
ok('a completed task is not counted as work', !Object.keys(types).some(k => types[k].n > 2));
ok('an open task with no Task Type is named as such, not folded in',
   !!types['(no task type)'] && W.noType === 1, JSON.stringify(W.byType));
ok('and one assigned to nobody is counted', W.unassigned === 1, String(W.unassigned));
ok('the middle age of an open chase is there', W.median > 0, String(W.median));
ok('and how many have been open over a month', W.stale === 2, String(W.stale));
ok('no client, no policy number and no subject line leaves the builder',
   JSON.stringify(W).indexOf('CLIENTNAME') < 0 && JSON.stringify(W).indexOf('1000894') < 0 &&
   JSON.stringify(W).indexOf('Follow up') < 0, JSON.stringify(W));

console.log('\nPolicies, not rows — the tab is one row per requirement:\n');
// 'URPPBIEX - Reqt' repeats a policy once per requirement. Until 16 September
// 2026 the wall counted the rows and called them cases. Same fixture as above
// plus one policy on three rows, and the extract's policy-level columns —
// spelled as the aliases guess them, because the real header row has not been
// seen from here (the manager runs intelHeaders() to print it). Invented.
const PHEAD2 = PHEAD.concat(['STATUS DESCRIPTION', 'APP RECEIVED DATE', 'SUM INSURED',
                             'MONTHLY PREMIUM', 'CASH WITH APP', 'UNDERWRITER ID', 'LAST UNDERWRITING DATE']);
const prow2 = (policy, agent, reqtDt, susp, prem, reqt, desc, app, sum, mprem, cwa, uw, uwd) =>
  [2026, 9, policy, 'OR', 'CLIENTNAME-' + policy, '3', '2026-08-01', 'CHAG', reqt, reqtDt,
   'A1', agent, 0, 'AK', susp, 'CID-' + policy, 'Branch', 'DD', prem,
   desc, app, sum, mprem, cwa, uw, uwd];
const env2 = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
env2.Date = env.Date;
env2.__mkSheet('URPPBIEX - Reqt', 4, PHEAD2, [
  prow2('P-THREE', 'Anand Pretend', '2026-08-01', 250, '',  'MDMED', 'Pending UW',  '2026-07-01', 500000, 400, '',   'UW1', '2026-08-20'),
  prow2('P-THREE', 'Anand Pretend', '2026-07-01', 250, '',  'PRADD', 'Pending UW',  '2026-07-01', 500000, 400, '',   'UW1', '2026-08-20'),
  prow2('P-THREE', 'Anand Pretend', '2026-08-15', 250, '',  'FUTPY', 'Pending UW',  '2026-07-01', 500000, 400, '',   'UW1', '2026-08-20'),
  prow2('P-ONE',   'Beena Pretend', '2026-08-20', 0,   800, 'MDMED', 'Pending Med', '2026-08-10', 250000, 100, 600,  'UW2', '2026-09-01'),
  prow2('P-TWO',   'Beena Pretend', '2026-09-01', 0,   '',  '',      'Pending UW',  '2026-08-30', 100000, 50,  0,    '',    ''),
  prow2('P-MGR',   'Carl Fictitious', '2026-09-01', 0, '',  'FUTPY', 'Pending UW',  '2026-08-30', 100000, 50,  '',   '',    ''),
  prow2('P-SKIP',  'Gone Away',     '2026-06-01', 0,   '',  'MDMED', 'Pending UW',  '2026-05-01', 100000, 50,  '',   '',    ''),
  prow2('P-SKIP',  'Gone Away',     '2026-06-01', 0,   '',  'PRADD', 'Pending UW',  '2026-05-01', 100000, 50,  '',   '',    ''),
]);
env2._intelTabMemo = {}; env2._intelHeadMemo = {};
const P2 = env2.iBuildPending_(env2.iToday_());
ok('three rows on one policy are one policy', P2.total === 4 && P2.policies === 4, JSON.stringify([P2.total, P2.policies]));
ok('and the requirement rows are counted beside them, after the exclusion',
   P2.requirementRows === 6, String(P2.requirementRows));
ok('the excluded agent is out of the extract, and what came out is said',
   P2.excluded.names === 1 && P2.excluded.policies === 1 && P2.excluded.rows === 2, JSON.stringify(P2.excluded));
const a2 = {}; P2.byAgent.forEach(a => { a2[a.agent] = a; });
ok('an agent with one client on three rows has one policy', a2['Anand Pretend'].policies === 1, JSON.stringify(a2['Anand Pretend']));
ok('the same number is still there under the old name, for the readers that use it',
   a2['Anand Pretend'].cases === 1);
ok('suspense repeated on every row of a policy is taken once', P2.suspense === 250 && P2.suspenseCases === 1,
   JSON.stringify([P2.suspense, P2.suspenseCases]));
const three = P2.rows.filter(r => r.policy === 'P-THREE')[0];
ok('the policy keeps every requirement code on it', three.requirements.join(',') === 'MDMED,PRADD,FUTPY', JSON.stringify(three.requirements));
ok('and has waited as long as its oldest requirement',
   three.age === env2.iDays_(new env2.Date('2026-07-01'), env2.iToday_()), String(three.age));

console.log('\nThe policy-level columns, when the extract carries them:\n');
ok('nothing is missing', P2.missing.length === 0, JSON.stringify(P2.missing));
ok('status description is grouped by policy', P2.byStatusDesc['Pending UW'] === 3 && P2.byStatusDesc['Pending Med'] === 1,
   JSON.stringify(P2.byStatusDesc));
ok('annual premium is twelve months of the monthly one', three.api === 4800, String(three.api));
ok('and summed across the policies', P2.api === 4800 + 1200 + 600 + 600, String(P2.api));
ok('days pending runs from the day the application was received',
   three.daysPending === env2.iDays_(new env2.Date('2026-07-01'), env2.iToday_()), String(three.daysPending));
ok('a blank cash-with-app is no cash, and so is a zero', three.noCash === true && P2.noCash === 3, String(P2.noCash));
ok('cash in the file is not no cash', P2.rows.filter(r => r.policy === 'P-ONE')[0].noCash === false);
ok('the underwriter and the last underwriting date ride along',
   three.uwId === 'UW1' && three.uwDate === '2026-08-20', JSON.stringify([three.uwId, three.uwDate]));

console.log('\nAnd when it does not, the screen is told, not handed zeros:\n');
// The first workbook's extract has the nineteen columns and none of these.
const P1 = env.iBuildPending_(env.iToday_());
ok('every absent column is named', P1.missing.length === 7 && P1.missing.indexOf('status description') > -1 &&
   P1.missing.indexOf('cash with app') > -1, JSON.stringify(P1.missing));
ok('and the figures that need them are null, never zero',
   P1.byStatusDesc === null && P1.api === null && P1.noCash === null && P1.rows[0].daysPending === null,
   JSON.stringify([P1.byStatusDesc, P1.api, P1.noCash]));
const W1 = env.iPendingWall_();
ok('the wall carries the missing list', W1.policy && W1.policy.missing.length === 7 && W1.policy.byStatusDesc === null,
   JSON.stringify(W1.policy));
ok('and says how many policies against how many requirement rows',
   W1.policies === W1.total && W1.requirementRows === 5, JSON.stringify([W1.policies, W1.requirementRows]));

console.log('\nThe requirements extract, with the four optional columns:\n');
// ORDERED BY is a system's code or a person's name; ROUTINE is the sheet's own
// flag; and a row ordered last year is history whatever its closed date says.
env2.__mkSheet('RR_UWPRO_INSURED_Requirement', 3,
  ['INSURED_REQUIREMENT_ID', 'POLICY_NUMBER', 'REQUIREMENT_CODE', 'REQUIREMENTS',
   'REQUIREMENT_COMMENT', 'ADDED_DATE', 'CLOSED_DATE', 'ORDERED_DATE', 'FIRST_NAME', 'LAST_NAME',
   'ORDERED BY', 'STATUS', 'RECEIVED', 'ROUTINE'],
  [
    ['RQ-1', 'P-THREE', 'MDMED', 'Medical',   '', '2026-08-01', '', '2026-08-21', 'INSUREDFIRST-A', 'INSUREDLAST-A', 'UWSYS',          'Ordered',  '',           'Y'],
    ['RQ-2', 'P-THREE', 'PRADD', 'Documents', '', '2026-07-01', '', '',           'INSUREDFIRST-A', 'INSUREDLAST-A', 'Carl Fictitious', 'Pending',  '',           'N'],
    ['RQ-3', 'P-THREE', 'FUTPY', 'Premium',   '', '2026-08-15', '', '',           'INSUREDFIRST-A', 'INSUREDLAST-A', '',                'Pending',  '',           ''],
    ['RQ-4', 'P-ONE',   'MDMED', 'Medical',   '', '2026-08-10', '', '2026-09-01', 'INSUREDFIRST-B', 'INSUREDLAST-B', 'UWSYS',          'Ordered',  '2026-09-08', 'Y'],
    ['RQ-5', 'P-OLD',   'MDMED', 'Medical',   '', '2025-11-01', '', '2025-11-02', 'INSUREDFIRST-C', 'INSUREDLAST-C', 'UWSYS',          'Ordered',  '',           'Y'],   // ordered last year: cut
    ['RQ-6', 'P-OLD2',  'PRADD', 'Documents', '', '2025-12-15', '', '',           'INSUREDFIRST-D', 'INSUREDLAST-D', 'Carl Fictitious', 'Pending',  '',           'N'],   // never ordered, added last year: cut
    ['RQ-7', 'P-NEW',   'PRADD', 'Documents', '', '2026-01-02', '', '',           'INSUREDFIRST-E', 'INSUREDLAST-E', 'Carl Fictitious', 'Pending',  '',           'N'],   // never ordered, added this year: kept
    ['RQ-8', 'P-DONE',  'MDMED', 'Medical',   '', '2025-12-01', '2026-01-10', '2025-12-02', 'INSUREDFIRST-F', 'INSUREDLAST-F', 'UWSYS', 'Closed', '2026-01-09', 'Y'],  // closed this year, ordered last: still cleared
  ]);
env2._intelTabMemo = {}; env2._intelHeadMemo = {};
const Q2 = env2.iBuildReqs_(env2.iToday_());
ok('the four optional columns are found', Q2.missing.length === 0, JSON.stringify(Q2.missing));
ok('a requirement ordered last year is cut, and so is one added last year and never ordered',
   Q2.openCount === 5 && Q2.cutByYear === 2, JSON.stringify([Q2.openCount, Q2.cutByYear]));
ok('one added this year and never ordered is kept', Q2.rows.some(r => r.policy === 'P-NEW'));
ok('the cut is dated on the payload', Q2.since === '2026-01-01', Q2.since);
ok('a row closed this year is still cleared this year, whenever it was ordered', Q2.closedThisYear === 1, String(Q2.closedThisYear));
const rq1 = Q2.rows.filter(r => r.code === 'MDMED' && r.policy === 'P-THREE')[0];
ok('days ordered is its own figure', rq1.daysOrdered === env2.iDays_(new env2.Date('2026-08-21'), env2.iToday_()), String(rq1.daysOrdered));
ok('and does not overload age', rq1.age === env2.iDays_(new env2.Date('2026-08-01'), env2.iToday_()), String(rq1.age));
ok('an un-ordered one has no days ordered, not zero', Q2.rows.filter(r => r.code === 'FUTPY')[0].daysOrdered === null);
ok('the days-ordered summary counts the ordered ones apart from the rest',
   Q2.daysOrdered.ordered === 2 && Q2.daysOrdered.notOrdered === 3 && Q2.daysOrdered.oldest === rq1.daysOrdered,
   JSON.stringify(Q2.daysOrdered));
ok('a short upper-case code ordered it by system; a name is a person; blank is nobody',
   Q2.byOrderedBy.system === 2 && Q2.byOrderedBy.manual === 2 && Q2.byOrderedBy.blank === 1, JSON.stringify(Q2.byOrderedBy));
ok('the sheet’s own routine flag wins when it is there',
   Q2.routine.fromSheet === true && Q2.routine.routine === 2 && Q2.routine.nonRoutine === 3, JSON.stringify(Q2.routine));
ok('a blank flag falls back to the owner map', Q2.rows.filter(r => r.code === 'FUTPY')[0].routine === false);
const cats = {}; (Q2.categories || []).forEach(c => { cats[c.name] = c.n; });
ok('by category is published as a list', cats['Medical'] === 2 && cats['Documents'] === 2 && cats['Premium'] === 1, JSON.stringify(Q2.categories));
ok('and so is the requirement status', Q2.byStatus.some(s => s.name === 'Ordered' && s.n === 2), JSON.stringify(Q2.byStatus));
ok('received is counted', Q2.received === 1, String(Q2.received));
ok('the extract is the extract, not a second branch list', env2.iBranchPendTabs_().length === 0);

console.log('\nWithout those columns the requirements say so:\n');
const Q1 = env.iBuildReqs_(env.iToday_());
ok('the four are named as missing', Q1.missing.length === 4 && Q1.missing.indexOf('ordered by') > -1, JSON.stringify(Q1.missing));
ok('ordered-by is null rather than "all manual"', Q1.byOrderedBy === null && Q1.byStatus === null && Q1.received === null);
ok('routine still answers from the owner map', Q1.routine.fromSheet === false && Q1.routine.routine + Q1.routine.nonRoutine === Q1.openCount,
   JSON.stringify(Q1.routine));
ok('and the wall carries the missing list', (W1.requirements || {}).missing.length === 4, JSON.stringify((W1.requirements || {}).missing));

console.log('\nAccountability by agent — cash, routine, medical, and the roster:\n');
const W2 = env2.iPendingWall_();
ok('the headline is policies with the requirement rows beside it',
   W2.policies === 4 && W2.requirementRows === 6, JSON.stringify([W2.policies, W2.requirementRows]));
ok('and what the exclusion removed is on it', W2.excluded.policies === 1 && W2.excluded.requirements === 2, JSON.stringify(W2.excluded));
ok('no insured name and no client reaches the wall', JSON.stringify(W2).indexOf('INSUREDFIRST') < 0 && JSON.stringify(W2).indexOf('CLIENTNAME') < 0);
const T2 = W2.triage, acct = {}; (T2.culprits || []).forEach(a => { acct[a.agent] = a; });
ok('an open first premium is cash to collect', acct['Anand Pretend'].cash === 1, JSON.stringify(acct['Anand Pretend']));
ok('and so is nothing paid with nothing else open', acct['Beena Pretend'].cash === 1, JSON.stringify(acct['Beena Pretend']));
ok('a medical is a medical', acct['Anand Pretend'].medical === 1 && acct['Beena Pretend'].medical === 1);
ok('routine is the underwriter’s own work that is not a medical', acct['Anand Pretend'].routine === 0);
ok('oldest days is the worst of everything with their name on it',
   acct['Anand Pretend'].oldestDays === env2.iDays_(new env2.Date('2026-07-01'), env2.iToday_()), String(acct['Anand Pretend'].oldestDays));
ok('the roster is not cut at ten', T2.roster.length === 3 && T2.culprits.length === 3, JSON.stringify(T2.roster.map(a => a.agent)));
ok('ranked by cash first', T2.culprits[0].cash >= T2.culprits[1].cash && T2.culprits[1].cash >= T2.culprits[2].cash);

console.log('\nA manager off the list and in the total:\n');
const env3 = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away', INTEL_LIST_ONLY_EXCLUDE: 'Carl Fictitious' } });
env3.Date = env.Date;
env3.__mkSheet('URPPBIEX - Reqt', 4, PHEAD2, env2.__sheets['URPPBIEX - Reqt']._grid.slice(1));
env3.__mkSheet('RR_UWPRO_INSURED_Requirement', 3, env2.__sheets['RR_UWPRO_INSURED_Requirement']._grid[0],
               env2.__sheets['RR_UWPRO_INSURED_Requirement']._grid.slice(1));
env3._intelTabMemo = {}; env3._intelHeadMemo = {};
const W3 = env3.iPendingWall_();
ok('the total still counts their book', W3.policies === 4 && W3.total === 4, String(W3.policies));
ok('and the buckets too', (W3.triage.buckets || []).reduce((a, b) => a + b.n, 0) === 4, JSON.stringify(W3.triage.buckets));
ok('but they are off the agents list', !(W3.agents || []).some(a => a.agent === 'Carl Fictitious'), JSON.stringify(W3.agents));
ok('and off the accountability row', !(W3.triage.culprits || []).some(a => a.agent === 'Carl Fictitious') &&
   !(W3.triage.roster || []).some(a => a.agent === 'Carl Fictitious'));
ok('and the screen is told one name is held off the rows', W3.listOnly === 1 && W3.triage.listOnly === 1);
ok('the other agents are untouched', (W3.agents || []).length === 2);

console.log('\nThe per-policy table is held unless the manager says the phrase:\n');
ok('held by default', W2.table.shown === false && !W2.table.rows && /INTEL_PENDING_ROWS_ON_WALL/.test(W2.table.note), JSON.stringify(W2.table));
ok('and no policy number is anywhere in the feed', JSON.stringify(W2).indexOf('P-THREE') < 0 && JSON.stringify(W2).indexOf('CID-') < 0);
const env4 = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away', INTEL_LIST_ONLY_EXCLUDE: 'Carl Fictitious',
                                INTEL_PENDING_ROWS_ON_WALL: 'show policy numbers' } });
env4.Date = env.Date;
env4.__mkSheet('URPPBIEX - Reqt', 4, PHEAD2, env2.__sheets['URPPBIEX - Reqt']._grid.slice(1));
env4.__mkSheet('RR_UWPRO_INSURED_Requirement', 3, env2.__sheets['RR_UWPRO_INSURED_Requirement']._grid[0],
               env2.__sheets['RR_UWPRO_INSURED_Requirement']._grid.slice(1));
env4._intelTabMemo = {}; env4._intelHeadMemo = {};
const W4 = env4.iPendingWall_();
ok('with the exact phrase the rows are there', W4.table.shown === true && W4.table.rows.length === 3, JSON.stringify(W4.table.rows));
const tr = W4.table.rows.filter(r => r.policy === 'P-THREE')[0];
ok('each row is the policy, its agent, and what it is waiting on — never the client',
   tr.agent === 'Anand Pretend' && tr.statusDesc === 'Pending UW' && tr.api === 4800 && tr.noCash === true &&
   tr.codes.slice().sort().join(',') === 'FUTPY,MDMED,PRADD' && tr.daysOrdered === rq1.daysOrdered && tr.daysPending === three.daysPending,
   JSON.stringify(tr));
ok('no client name in the table', JSON.stringify(W4.table).indexOf('CLIENTNAME') < 0 && JSON.stringify(W4.table).indexOf('CID-') < 0);
ok('the list-only manager is off the table too', !W4.table.rows.some(r => r.agent === 'Carl Fictitious'));
ok('and the excluded agent was never in it', !W4.table.rows.some(r => r.policy === 'P-SKIP'));

console.log('\nA workbook with no pending list anywhere:\n');
const bare = makeEnv();
bare.__mkSheet('Something Else', 1, ['a', 'b'], [['1', '2']]);
const none = bare.iPendingWall_();
ok('it does not pretend', none.configured === false);
ok('and says what a list needs to look like',
   /Agent, Client and App Received Date/.test(none.error || '') &&
   /insured_requirement_id/.test(none.error || ''), none.error);

console.log('\nThe book tab is not a branch list, and it lends the pending screen its policy columns:\n');
// 16 September, evening: the wall said 20,392 policies pending — the book tab
// (AGENT, CLIENT, APP RECEIVED DATE and all) had been taken for a branch list.
{
  const env5 = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
  env5.Date = env.Date;
  env5.__mkSheet('URPPBIEX - Reqt', 4, PHEAD, [
    prow('P-READY', 'Anand Pretend', '2026-08-01', 0, ''),
    prow('P-ONE',   'Beena Pretend', '2026-08-20', 0, 800),
  ]);
  env5.__mkSheet('RR_UWPRO_INSURED_Requirement', 3, env.__sheets['RR_UWPRO_INSURED_Requirement']._grid[0], []);
  const BHEAD = ['Agent','Number','Client Number','Client','Premium','Issue Date','Status','Status(2)','Days','Insurance Type',
                 'Paid To Date','App Received Date','Sum Assured','Plan Code','Billing type','Mode','APLamount','Status Description','Projected Lapse Date'];
  const brow = (agent, number, prem, app, sum, mode, desc) =>
    [agent, number, 'C-' + number, 'CLIENTNAME-' + number, prem, '2026-08-01', '0', '116', 2, 2, '', app, sum, 'IHLCP1', 'Salary Deduction', mode, 0, desc, ''];
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push(brow('Carl Fictitious', '90000' + (100 + i), 100, '2026-01-01', 1000, 12, 'Premium Paying'));
  rows.push(brow('Anand Pretend', 'P-READY', 250, '2026-07-15', 500000, 12, 'Pending UW'));
  rows.push(brow('Beena Pretend', 'P-ONE',   300, '2026-08-10', 250000, 4,  'Pending Med'));
  env5.__mkSheet('Dues', 6, BHEAD, rows);
  env5._intelTabMemo = {}; env5._intelHeadMemo = {};
  ok('the book tab is not taken for a branch list', env5.iBranchPendTabs_().length === 0, String(env5.iBranchPendTabs_().length));
  const P5 = env5.iPendingWall_();
  ok('so the pending count is the extract\'s two, not the book\'s forty-two', P5.policies === 2 && P5.total === 2, JSON.stringify([P5.policies, P5.total, P5.lists]));
  const pv = P5.policy || {};
  ok('status description is read from the book by policy number', JSON.stringify(pv.byStatusDesc || '').indexOf('Pending UW') !== -1 && JSON.stringify(pv.byStatusDesc || '').indexOf('Pending Med') !== -1, JSON.stringify(pv.byStatusDesc));
  ok('and the screen is told which columns the book lent', Array.isArray(pv.fromBook) && pv.fromBook.length === 4, JSON.stringify(pv.fromBook));
  ok('only cash with app and the underwriter are still missing', JSON.stringify(pv.missing) === JSON.stringify(['cash with app', 'underwriter id', 'last underwriting date']), JSON.stringify(pv.missing));
  ok('days pending come from the book\'s app received date', pv.daysPending && pv.daysPending.n === 2 && pv.daysPending.oldest > pv.daysPending.median - 1, JSON.stringify(pv.daysPending));
  ok('premium is annualised by the book\'s mode — 250 x 12 and 300 x 4', pv.api === 4200, String(pv.api));
}

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
