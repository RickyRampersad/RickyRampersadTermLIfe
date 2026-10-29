// Issued this month, by unit and by agent (28 October 2026).
//
// Ricky, 11:56am: "and what about the policies issued this month by agent and unit?". wallIssued_ reads the newest
// "Branch Production_" tab. Pinned here:
//   - this month is SETTLED_MONTH; a policy on two rows counts once; the newest tab is the one read;
//   - premium is ANNUAL_PREMIUM, or the modal premium times the payments a year;
//   - the last seven days is Guardian's own SETTLED_LAST_7_DAYS; same point last month is by the report's own day;
//   - the usual is the average month before this one, of the people here now: whoever has left is out of every usual;
//   - agents in name order, never ranked; nobody who has left is listed unless they settled this month, and then the scrub
//     folds them into Orphans; a unit is named for its manager only while the manager is here;
//   - doPost answers wall.issued.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
env.todayISO_ = () => '2026-10-28';

const H = ['POLICY_ID', 'ISSUE_DATE', 'SETTLED_MONTH', 'SETTLED_LAST_7_DAYS', 'MONTHLY_PREMIUM', 'ANNUAL_PREMIUM', 'BILLING_MODE', 'WRITING_AGENT_ID', 'WRITING_AGENT_NAME', 'BRANCH_ID', 'FIRST_NAME', 'LAST_NAME'];
const row = (pol, iss, l7, mon, ann, mode, aid, name, unit) => [pol, iss, iss.slice(0, 7), l7, mon, ann, mode, aid, name, unit, 'Client', 'Surname'];
const rows = [
  row('1000000001', '2026-10-27', 'Yes', 500, 0, '01', 'A1', 'Akaash Kalladeen', '26002'),        // 6,000 a year
  row('1000000001', '2026-10-27', 'Yes', 500, 0, '01', 'A1', 'Akaash Kalladeen', '26002'),        // the same policy again: once
  row('1000000002', '2026-10-21', 'Yes', 1000, 0, '03', 'A2', 'Varun Seegolam', '26000'),         // quarterly: 4,000
  row('1000000003', '2026-10-02', 'No', 0, 2400, '12', 'A2', 'Varun Seegolam', '26000'),          // annual premium given: 2,400
  row('1000000004', '2026-10-15', 'No', 100, 0, '01', 'A3', 'Felicia Rampersad', '26003'),        // 1,200
  row('1000000005', '2026-10-08', 'No', 100, 0, '01', 'A9', 'Gary Sookdeo', '26003'),             // left, and settled this month
  row('1000000006', '2026-10-09', 'No', 100, 0, '01', 'A8413', '', '26003'),                      // no name in the report
  // September: by the 27th, and after
  row('1000000010', '2026-09-03', 'No', 100, 0, '01', 'A2', 'Varun Seegolam', '26000'),
  row('1000000011', '2026-09-20', 'No', 100, 0, '01', 'A1', 'Akaash Kalladeen', '26002'),
  row('1000000012', '2026-09-29', 'No', 100, 0, '01', 'A1', 'Akaash Kalladeen', '26002'),
  // the six months before: Varun 12 (2 a month), Joy 6 (1 a month, nothing this month), Aidan 24 (left: out of every usual)
  ...Array.from({ length: 12 }, (_, i) => row('11' + String(i).padStart(8, '0'), '2026-0' + (4 + (i % 6)) + '-10', 'No', 100, 0, '01', 'A2', 'Varun Seegolam', '26000')),
  ...Array.from({ length: 6 }, (_, i) => row('12' + String(i).padStart(8, '0'), '2026-0' + (4 + i) + '-12', 'No', 100, 0, '01', 'A4', 'Joy Sammah', '26000')),
  ...Array.from({ length: 24 }, (_, i) => row('13' + String(i).padStart(8, '0'), '2026-0' + (4 + (i % 6)) + '-14', 'No', 100, 0, '01', 'A5', 'Aidan Eugene', '26001')),
  // older than the usual: not in it
  row('1000000099', '2026-03-10', 'No', 100, 0, '01', 'A4', 'Joy Sammah', '26000'),
];
const tab = (name, vals) => ({ getName: () => name, getDataRange: () => ({ getValues: () => vals }) });
env.iSs_ = () => ({ getSheets: () => [tab('Branch Production_2026-10-20-0900', [H, row('9', '2026-10-01', 'No', 1, 0, '01', 'X', 'Old Report', '26000')]),
                                      tab('Branch Pendings_2026-10-28-0800', [['x']]),
                                      tab('Branch Production_2026-10-27-1358', [H].concat(rows))] });

console.log('\nThis month:\n');
const d = env.wallIssued_('2026-10-28');
ok('the newest production tab is read', d.tab === 'Branch Production_2026-10-27-1358' && /27 October, 1:58pm/.test(d.asOf), d.tab + ' · ' + d.asOf);
ok('six policies settled this month, the one on two rows counted once', d.policies === 6, String(d.policies));
ok('premium: annual, or the modal premium times the payments a year', d.prem === 6000 + 4000 + 2400 + 1200 + 1200 + 1200, String(d.prem));
ok('the last seven days is Guardian\'s own flag', d.last7 === 2, String(d.last7));
ok('same point last month is by the report\'s day (the 27th), the people here now: five of September\'s six', d.prevAtPoint === 5 && d.prevMonth === 6 && d.prevLabel === 'September' && d.monthLabel === 'October' && d.usualFrom === 'April', JSON.stringify([d.prevAtPoint, d.prevMonth, d.prevLabel, d.monthLabel, d.usualFrom]));
ok('week by week', d.weeks.map(w => w.n).join() === '1,2,2,1,0' && d.weeks[0].k === '1–7' && d.weeks[4].k === '29+', JSON.stringify(d.weeks));

console.log('\nAgainst their own usual:\n');
const varun = d.agents.find(a => a.agent === 'Varun Seegolam'), joy = d.agents.find(a => a.agent === 'Joy Sammah');
ok('each agent against their own average month', varun.n === 2 && varun.usual === 2.2 && joy.n === 0 && joy.usual === 1, JSON.stringify([varun, joy]));
ok('agents in name order, never by count', d.agents.map(a => a.agent).join('|') === 'Agent code A8413|Akaash Kalladeen|Felicia Rampersad|Gary Sookdeo|Joy Sammah|Varun Seegolam', d.agents.map(a => a.agent).join('|'));
ok('somebody who has left and settled nothing is not listed', !d.agents.some(a => a.agent === 'Aidan Eugene'));
ok('nor counted in any usual: the branch usual is the people here now', d.usual === 3.5 && !d.units.some(u => u.code === '26001'), JSON.stringify({ usual: d.usual, units: d.units.map(u => u.code) }));
const u0 = d.units.find(u => u.code === '26000'), u2 = d.units.find(u => u.code === '26002'), u3 = d.units.find(u => u.code === '26003');
ok('units: the branch and Akaash\'s named, the former unit by number', u0.k === 'The branch' && u2.k === 'Akaash Kalladeen’s unit' && u3.k === 'Unit 26003', JSON.stringify(d.units.map(u => u.k)));
ok('units against their own usual, with their premium', u0.n === 2 && u0.usual === 3.2 && u0.prem === 6400 && u2.n === 1 && u3.n === 3, JSON.stringify(d.units));
ok('no client and no agent premium in the feed', !/Client|Surname/.test(JSON.stringify(d)) && d.agents.every(a => a.prem == null));

console.log('\nThrough the scrub, and the feed:\n');
const s = env.wallScrub_(d);
ok('Gary\'s one policy reads Orphans; nobody who has left is named', s.agents.some(a => a.agent === env.WALL_ORPHANS && a.n === 1) && !/Gary|Aidan/.test(JSON.stringify(s)), JSON.stringify(s.agents.map(a => a.agent)));
const res = env.doPost({ postData: { contents: JSON.stringify({ action: 'wall.issued' }) }, parameter: {} });
const j = JSON.parse(res.getContent ? res.getContent() : res.content || res);
ok('doPost answers wall.issued', j.ok === true && j.data && j.data.policies === 6, JSON.stringify(j).slice(0, 160));
env.iSs_ = () => ({ getSheets: () => [tab('Branch Pendings_2026-10-28-0800', [['x']])] });
const none = env.wallIssued_('2026-10-29');
ok('with no production tab, it says what to upload', /No "Branch Production" tab/.test(none.error || ''), none.error);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
