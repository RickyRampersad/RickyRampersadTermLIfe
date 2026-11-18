// Building a Wednesday from a spec (MeetingSeed.gs): found by Ref or by the branch meeting already on that date, the agenda
// rebuilt, presenters resolved by first name from the People tab, published, the register on the day. (10 Nov 2026)
const path = require('path'), ROOT = path.join(__dirname, '..');
process.env.GS_PATH = [path.join(ROOT, 'apps-script/Meetings.gs'), path.join(ROOT, 'apps-script/MeetingSeed.gs')].join(',');
const { makeEnv } = require('./harness');
const M = makeEnv(); let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
M.DriveApp = { createFolder: n => ({ getId: () => 'f1', getName: () => n, setSharing() { return this; } }), getFolderById: id => ({ getId: () => id, getName: () => 'x' }), Access: {}, Permission: {} };
M.setupMeetings && M.setupMeetings();
[['A00427 - Ricky Rampersad', 'ricky@example.com', 'manager'], ['Kamla Dookran', 'kamla@example.com', 'staff'], ['A00999 - Akaash Kalladeen', 'akaash@example.com', 'unitmgr'],
 ['Sasha Lalla-Jagassar', 'sasha@example.com', 'staff'], ['A14158 - Rajiv Soodoo', 'rajiv@example.com', 'agent']]
  .forEach(([n, e, r]) => M.appendRow_(M.MEET.TAB_PEOPLE, { 'Name': n, 'Email': e, 'Role': r, 'Active': 'Y' }));
// a standing meeting already built for that Wednesday, with an old agenda
M.appendRow_(M.MEET.TAB_MEETINGS, { 'ID': 'MTG-OLD', 'Ref': 'W46', 'Type': 'Branch Meeting', 'Title': 'old', 'Date': new Date(2026, 10, 11), 'Status': 'draft', 'Scope': 'branch' });
M.appendRow_(M.MEET.TAB_AGENDA, { 'ID': 'AG-X', 'Meeting ID': 'MTG-OLD', 'Order': 10, 'Title': 'Old item' });
const spec = { REF: 'BM-2026-11-11', TITLE: 'Branch meeting: the orphan portfolio', DATE: '2026-11-11', START: '9:00 AM', END: '10:30 AM', CHECKIN_OPENS: '8:30 AM', CHECKIN_CLOSES: '10:30 AM',
  PURPOSE: 'p', PRE_READ: 'r', AGENDA: [
    { section: 'Opening', by: 'chair', mins: 2, title: 'Open', detail: 'x' },
    { section: 'Accountability', by: 'kamla', mins: 6, title: 'Actions', detail: 'Question: done?' },
    { section: 'Orphan portfolio', by: 'room', label: 'Every agent named on orphans', mins: 18, title: 'Agent round', detail: 'Question: one household' },
    { section: 'Orphan portfolio', by: 'akaash', mins: 7, title: 'Stuck', detail: 'q' },
    { section: 'People', by: 'rajiv', mins: 6, title: 'What worked', detail: 'q' },
    { section: 'People', by: 'nobody', mins: 5, title: 'Unknown owner', detail: 'q' } ] };
const msg = M.seedMeetingFrom_(spec);
const ms = M.readTab_(M.MEET.TAB_MEETINGS);
ok('the meeting already on that Wednesday is taken over, not doubled', ms.length === 1 && ms[0]['Ref'] === 'BM-2026-11-11' && ms[0]['ID'] === 'MTG-OLD', JSON.stringify(ms.map(m => m['Ref'])));
ok('published, branch, chaired', ms[0]['Status'] === 'published' && ms[0]['Scope'] === 'branch');
const ag = M.readTab_(M.MEET.TAB_AGENDA).filter(a => a['Meeting ID'] === 'MTG-OLD');
ok('the old agenda replaced by six items', ag.length === 6 && !ag.some(a => a['Title'] === 'Old item'));
ok('presenters by first name: Kamla, Akaash Kalladeen (number taken off), Rajiv', ag[1]['Presenter Email'] === 'kamla@example.com' && ag[3]['Presenter Name'] === 'Akaash Kalladeen' && ag[4]['Presenter Email'] === 'rajiv@example.com');
ok('the room item carries its label and no e-mail', ag[2]['Presenter Name'] === 'Every agent named on orphans' && !ag[2]['Presenter Email']);
ok('an owner not on the People tab is named, and the run says so', ag[5]['Presenter Name'] === 'Nobody' && /Not on the People tab[^\n]*nobody/.test(msg), msg);
ok('the time split is reported', /Who holds the time:/.test(msg) && /the room 18/.test(msg), msg);
M.seedMeetingFrom_(spec);
ok('run again: still one meeting, still six items', M.readTab_(M.MEET.TAB_MEETINGS).length === 1 && M.readTab_(M.MEET.TAB_AGENDA).filter(a => a['Meeting ID'] === 'MTG-OLD').length === 6);
// the real private spec, if it is beside the test (it is never in the repository)
const priv = process.env.WED_SPEC;
if (priv) {
  const fs = require('fs'); require('vm').runInContext(fs.readFileSync(priv, 'utf8'), M);
  const m2 = M.seedWednesday11Nov(); console.log('\n' + m2 + '\n');
  const a2 = M.readTab_(M.MEET.TAB_AGENDA).filter(a => a['Meeting ID'] === 'MTG-OLD');
  ok('the private spec: 14 items, 90 minutes', a2.length === 14 && a2.reduce((s, a) => s + Number(a['Allotted (min)']), 0) === 90);
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nall green'); process.exit(fails ? 1 : 0);
