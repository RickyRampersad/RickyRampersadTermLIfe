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
ok('the excluded agent is dropped, and counted', D.excluded === 1, String(D.excluded));
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
ok('each agent carries their own count', byAgent['Anand Pretend'].cases === 3, JSON.stringify(D.agents));
ok('and the age of their oldest', byAgent['Beena Pretend'].oldest > 180, JSON.stringify(D.agents));
ok('the busiest is first', (D.agents || [])[0].cases >= (D.agents || [])[1].cases);
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

console.log('\nA workbook with no pending list anywhere:\n');
const bare = makeEnv();
bare.__mkSheet('Something Else', 1, ['a', 'b'], [['1', '2']]);
const none = bare.iPendingWall_();
ok('it does not pretend', none.configured === false);
ok('and says what a list needs to look like',
   /Agent, Client and App Received Date/.test(none.error || '') &&
   /insured_requirement_id/.test(none.error || ''), none.error);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
