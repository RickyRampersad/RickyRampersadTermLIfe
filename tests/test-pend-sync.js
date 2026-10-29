// The Branch Portal and Salesforce, through the workbook (27 October 2026, 2026-10-27i).
//
// Ricky agreed one place for chasing notes: Salesforce's Pendings tasks, not the Portal's own (empty) Requirements Log.
// Pinned here: a Portal comment with nothing in column I is posted on the policy's open Pendings task (the most recently
// touched one, matched by policy or application number), signed "Branch Portal · <who>", and column I says so; with no
// open task, column I says that and nothing is posted; a marked row is never posted twice; "Pendings Chase" is one row per
// report policy with its task, owner, due, open and overdue counts and its last notes; outside weekday hours nothing runs.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
env.todayISO_ = () => '2026-10-27';

function sheet(name, rows) {
  const s = { name, rows: rows.map(r => r.slice()) };
  const cell = (r, c) => { while (s.rows.length < r) s.rows.push([]); const row = s.rows[r - 1]; while (row.length < c) row.push(''); return row; };
  return Object.assign(s, {
    getName: () => name, getLastRow: () => s.rows.length,
    getDataRange: () => ({ getValues: () => s.rows.map(r => r.slice()) }),
    clearContents: () => { s.rows = []; },
    getRange: (r, c, nr, nc) => ({
      getValue: () => (s.rows[r - 1] || [])[c - 1] || '',
      setValue: v => { cell(r, c)[c - 1] = v; },
      getValues: () => Array.from({ length: nr || 1 }, (_, i) => Array.from({ length: nc || 1 }, (_, j) => { const row = s.rows[r - 1 + i] || []; return row[c - 1 + j] == null ? '' : row[c - 1 + j]; })),
      setValues: vs => vs.forEach((v, i) => v.forEach((x, j) => { cell(r + i, c + j)[c - 1 + j] = x; }))
    })
  });
}
const H = ['POLICY', 'application_number', 'Agent Name', 'REQUIREMENT_STATUS'];
const report = sheet('Branch Pendings_2026-10-27-1336', [H,
  ['5000000001', '1000000001', 'Varun Seegolam', 'Ordered - awaiting receipt'],
  ['5000000001', '1000000001', 'Varun Seegolam', 'Ordered - awaiting receipt'],
  ['5000000002', '', 'Fawwaz Mohamed', 'Ordered - awaiting receipt'],
  ['5000000003', '', 'Joy Sammah', 'Ordered - awaiting receipt']]);
const log = sheet('Requirements Log', [['Timestamp', 'Policy', 'Client No', 'Client', 'Agent', 'Author', 'Comment', 'New Status'],
  ['2026-10-27 10:00', '1000000001', 'C1', 'X', 'Varun Seegolam', 'Kamla Dookran <k@x>', 'Agent bringing the declaration Thursday', ''],
  ['2026-10-27 10:05', '5000000002', 'C2', 'Y', 'Fawwaz Mohamed', 'Neil R <n@x>', 'Client booked for the exam', 'Escalated'],
  ['2026-10-27 10:06', '5000000001', 'C1', 'X', 'Varun Seegolam', 'Sasha <s@x>', 'Already done', '', 'Posted earlier']]);
const tabs = [sheet('Agent Codes', [['x']]), report, log];
env.iSs_ = () => ({ getSheets: () => tabs, getSheetByName: n => tabs.find(t => t.getName() === n) || null, insertSheet: n => { const s = sheet(n, []); tabs.push(s); return s; } });
env.sfkConfigured_ = () => true;
const posts = [];
env.sfkInsert_ = (o, b) => { posts.push([o, b]); return '0D5NEW'; };
env.sfkQuery_ = q => {
  if (/FROM Task/.test(q)) return [
    { Id: '00TB', Subject: 'Settlement- 1000000001 - client', IsClosed: false, ActivityDate: '2026-10-30', LastModifiedDate: '2026-10-27T13:00:00.000+0000', Owner: { Name: 'Sasha Lalla-Jagassar' } },
    { Id: '00TA', Subject: 'Pending 5000000001 forms', IsClosed: false, ActivityDate: '2026-10-20', LastModifiedDate: '2026-10-20T13:00:00.000+0000', Owner: { Name: 'Azariah Griffith' } },
    { Id: '00TC', Subject: 'Pending 5000000002 exam', IsClosed: true, ActivityDate: '2026-10-01', LastModifiedDate: '2026-10-02T13:00:00.000+0000', Owner: { Name: 'Elizabeth Lee' } }];
  if (/FROM FeedItem/.test(q)) return [
    { ParentId: '00TB', CreatedDate: '2026-10-27T14:00:00.000+0000', CreatedBy: { Name: 'Sasha Lalla-Jagassar' }, Body: '<p>Called agent, declaration <b>Thursday</b></p>' },
    { ParentId: '00TA', CreatedDate: '2026-10-21T14:00:00.000+0000', CreatedBy: { Name: 'Azariah Griffith' }, Body: 'Forms requested' },
    { ParentId: '00TC', CreatedDate: '2026-10-02T13:00:00.000+0000', CreatedBy: { Name: 'Elizabeth Lee' }, Body: 'Exam done' }];
  return [];
};
const msg = env.pendSyncTick_(true);
ok('the run says what it did', /3 policies, 1 Portal note to Salesforce/.test(msg), msg);
ok('posted on the open Pendings task touched last, matched by the application number', posts.length === 1 && posts[0][0] === 'FeedItem' && posts[0][1].ParentId === '00TB', JSON.stringify(posts));
ok('signed "Branch Portal · Kamla Dookran", no e-mail address', /^Branch Portal · Kamla Dookran:\nAgent bringing the declaration Thursday$/.test(posts[0][1].Body), posts[0][1].Body);
ok('column I says where it went', /^Posted to "Settlement- 1000000001/.test(log.rows[1][8]) && log.rows[0][8] === 'Salesforce', log.rows[1][8]);
ok('no open task: nothing posted, and column I says so', /^No open Pendings task in Salesforce on 5000000002/.test(log.rows[2][8]), log.rows[2][8]);
ok('a row already marked is not posted again', log.rows[3][8] === 'Posted earlier');
const chase = tabs.find(t => t.getName() === 'Pendings Chase');
ok('"Pendings Chase" is written, one row a policy', chase && chase.rows.length === 4 && chase.rows[0].join('|') === env.PEND_SYNC.HEAD.join('|'), chase && chase.rows.length);
const r1 = chase.rows.find(r => r[0] === '5000000001'), r2 = chase.rows.find(r => r[0] === '5000000002'), r3 = chase.rows.find(r => r[0] === '5000000003');
ok('policy 1: its newest open task, owner, due; two open, one overdue', r1[2] === 'Settlement- 1000000001 - client' && r1[3] === 'Sasha Lalla-Jagassar' && r1[4] === '2026-10-30' && r1[5] === 2 && r1[6] === 1, JSON.stringify(r1));
ok('its last note in plain words, and the one before it kept', r1[8] === 'Sasha Lalla-Jagassar' && r1[9] === 'Called agent, declaration Thursday' && JSON.parse(r1[10])[0].text === 'Forms requested', JSON.stringify(r1.slice(7, 11)));
ok('policy 2: only a closed task, so nothing open and no due date', r2[2] === 'Pending 5000000002 exam' && r2[5] === 0 && r2[4] === '' && r2[9] === 'Exam done', JSON.stringify(r2));
ok('policy 3: never tasked, an empty row that still names the agent', r3[1] === 'Joy Sammah' && r3[2] === '' && r3[5] === 0, JSON.stringify(r3));
posts.length = 0;
env.pendSyncTick_(true);
ok('a second run posts nothing again', posts.length === 0);
// Weekends and evenings it stands down.
const realDate = Date; const sat = new realDate('2026-10-31T15:00:00Z');
global.Date = class extends realDate { constructor(...a) { return a.length ? new realDate(...a) : new realDate(sat); } static now() { return sat.getTime(); } };
env.Date = global.Date;
ok('Saturday: nothing runs', env.pendSyncTick_() === '');
global.Date = realDate;
ok('keepWarm carries it', /pendSyncTick_\(\)/.test(env.keepWarm.toString()));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
