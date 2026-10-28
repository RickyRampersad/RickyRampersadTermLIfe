// Friday's meet-and-discuss: the seeder, and the one rule that lets a person say
// something the day before without the register claiming they were in the room.
//
// 28 October 2026: "from memory and the strategy meeting you are to create a framework
// for all to log in from tomorrow to create an experience".
//
// What it holds the two scripts to:
//   the seeder   one meeting found by its Ref however many times it is run; published,
//                never draft, or an agent sees nothing; the register on the day only;
//                the agenda rebuilt rather than doubled; the floor the longest item.
//   contributing before the register opens is taken and stamped -1, with no
//                attendance row and without putting anyone on the register;
//   contributing once the register is open still needs you in the room;
//   the floor     counts only what was said in the room, so a person who wrote in
//                on Thursday and sat silent on Friday is still reported as silent.
//
// Run: node tests/test-friday.js   (needs nothing but node)
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = [path.join(ROOT, 'apps-script/Meetings.gs'),
                       path.join(ROOT, 'apps-script/MeetingFriday.gs')].join(',');
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra !== undefined && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};
const rows = name => env.readTab_(env.MEET[name]);

/* Drive is only touched by the setup routine, to make the materials folder. */
env.DriveApp = {
  createFolder: name => ({ getId: () => 'folder-1', getName: () => name,
                           setSharing: function () { return this; } }),
  getFolderById: id => ({ getId: () => id, getName: () => 'Branch Meeting Materials' }),
  Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' }
};

/* ── a branch on the People tab: a manager, a unit manager, two agents ── */
env.setupMeetings && env.setupMeetings();
/* Setup seeds MEET.ADMIN_EMAIL as manager with no access code, so the real
   branch manager cannot sign in either until the roster pull has run. Give
   him one here, which is what that pull does. */
(() => {
  const r = env.readPeople_().filter(p => p.role === 'manager')[0];
  if (r) env.setCell_(env.MEET.TAB_PEOPLE, r._row, 'Access Code', '99999999');
})();
[['A00001', 'bm@example.com', 'The Branch Manager', 'manager', '', 'Y', '11111111'],
 ['A00002', 'um@example.com', 'The Unit Manager', 'unitmgr', 'Unit One', 'Y', '22222222'],
 ['A00003', 'one@example.com', 'Agent One', 'agent', 'Unit One', 'Y', '33333333'],
 ['A00004', 'two@example.com', 'Agent Two', 'agent', 'Unit One', 'Y', '44444444']]
  .forEach(([no, em, nm, role, unit, active, code]) => env.appendRow_(env.MEET.TAB_PEOPLE, {
    'Agent No': no, 'Email': em, 'Name': nm, 'Role': role, 'Unit': unit,
    'Active': active, 'Access Code': code
  }));

console.log('\nTHE SEEDER');
const summary = env.seedFridayMeeting();
let mtgs = rows('TAB_MEETINGS').filter(m => String(m['Ref']) === env.FRIDAY.REF);
ok('one meeting, found by its Ref', mtgs.length === 1, mtgs.length);
const m = mtgs[0];
ok('published, not draft (a draft is staff-only)', String(m['Status']) === 'published', m['Status']);
ok('the chair is a manager off the People tab',
  env.readPeople_().some(p => p.role === 'manager' && p.name === String(m['Chair'])), m['Chair']);
ok('it carries the purpose', /strategic/i.test(String(m['Purpose'])));
ok('the pre-read carries all five objectives',
  [1, 2, 3, 4, 5].every(n => String(m['Pre-Read']).indexOf(n + '.') > -1));

const open = env.asDate_(m['Check-In Opens']), close = env.asDate_(m['Check-In Closes']);
const day = env.asDate_(m['Date']);
ok('the register opens on the day of the meeting, not before',
  open && day && open.getFullYear() === day.getFullYear() &&
  open.getMonth() === day.getMonth() && open.getDate() === day.getDate(),
  open && String(open));
ok('it opens before the meeting starts', open < env.atTime_(m['Date'], m['Start']));
ok('and closes after it', close > open);

let ag = rows('TAB_AGENDA').filter(a => String(a['Meeting ID']) === String(m['ID']));
ok('eight agenda items', ag.length === 8, ag.length);
ok('ninety minutes in all',
  ag.reduce((n, a) => n + env.num_(a['Allotted (min)']), 0) === 90,
  ag.reduce((n, a) => n + env.num_(a['Allotted (min)']), 0));
const floor = ag.filter(a => String(a['Section']) === 'The floor');
ok('the floor is one item of twenty-five minutes', floor.length === 1 && env.num_(floor[0]['Allotted (min)']) === 25);
ok('and the floor is the longest item on the agenda',
  Math.max(...ag.map(a => env.num_(a['Allotted (min)']))) === env.num_(floor[0]['Allotted (min)'])); 
// Every item but the closing announcement asks a question, because a question
// is the only thing a person can answer the day before. The spec marks that
// one item `tell: true`, so a question going missing from any other is a fail.
const asks = env.FRIDAY.AGENDA.filter(it => !it.tell).map(it => it.title);
const ask = ag.filter(a => asks.indexOf(String(a['Title'])) > -1);
ok('seven of the eight items ask a question', ask.length === 7, ask.length);
ok('and every one of them really does ask', ask.every(a => /\?/.test(String(a['Detail']))),
  ask.filter(a => !/\?/.test(String(a['Detail']))).map(a => a['Title']).join('; '));
ok('every item is for everyone', ag.every(a => String(a['Visibility']) === 'all'));
ok('the unit manager presents the two that are his',
  ag.filter(a => String(a['Presenter Email']) === 'um@example.com').length === 2);
ok('the floor belongs to the room, not a presenter',
  String(floor[0]['Presenter Name']) === 'Everyone' && !String(floor[0]['Presenter Email']));
ok('the order runs 1..8 with no gap',
  ag.map(a => env.num_(a['Order'])).sort((x, y) => x - y).join() === '1,2,3,4,5,6,7,8');
ok('the summary says the roster can sign in', /can sign in with the code/.test(summary), summary);

console.log('\nRUN IT AGAIN (an edit must not make a second meeting)');
env.seedFridayMeeting();
mtgs = rows('TAB_MEETINGS').filter(x => String(x['Ref']) === env.FRIDAY.REF);
ag = rows('TAB_AGENDA').filter(a => String(a['Meeting ID']) === String(m['ID']));
ok('still one meeting', mtgs.length === 1, mtgs.length);
ok('still eight agenda items, not sixteen', ag.length === 8, ag.length);
ok('the ID did not change, so attendance keeps pointing at it',
  String(mtgs[0]['ID']) === String(m['ID']));

console.log('\nA PERSON WITH NO ACCESS CODE IS REPORTED, NOT HIDDEN');
env.appendRow_(env.MEET.TAB_PEOPLE, { 'Agent No': 'A00005', 'Email': 'new@example.com',
  'Name': 'Agent Five', 'Role': 'agent', 'Active': 'Y' });
ok('the summary names how many cannot sign in yet',
  /1 of them cannot sign in yet/.test(env.seedFridayMeeting()),
  'expected exactly the one person with no code');

console.log('\nSAYING SOMETHING THE DAY BEFORE');
const MID = String(m['ID']);
const agId = String(ag.filter(a => env.num_(a['Order']) === 6)[0]['ID']);
const tokenFor = email => {
  const r = env.readPeople_().filter(p => p.email === email)[0];
  env.setCell_(env.MEET.TAB_PEOPLE, r._row, 'Token', 'tok-' + email);
  return 'tok-' + email;
};
const tOne = tokenFor('one@example.com'), tTwo = tokenFor('two@example.com');

// The clock sits two days before the meeting: the register has not opened.
const REAL_NOW = Date.now;
const at = d => { Date.now = () => d.getTime(); };
at(new Date(open.getTime() - 2 * 24 * 60 * 60 * 1000));

let res = env.apiAddContribution_({ token: tOne, meetingId: MID, agendaId: agId,
  kind: 'Point', body: 'One thing to push: get the retention payment counted as production.' });
ok('it is taken, with no attendance row anywhere', res.ok === true, res.error);
let cons = rows('TAB_CONTRIB').filter(c => String(c['Meeting ID']) === MID);
ok('one contribution on the record', cons.length === 1, cons.length);
ok('stamped -1, so the floor can tell it apart', env.num_(cons[0]['Offset (min)']) === -1,
  cons[0]['Offset (min)']);
ok('it lands against the item they picked', String(cons[0]['Agenda ID']) === agId);
ok('and it put nobody on the register',
  rows('TAB_ATTENDANCE').filter(a => String(a['Meeting ID']) === MID).length === 0);

console.log('\nON THE DAY, THE FLOOR NEEDS YOU IN THE ROOM');
at(new Date(open.getTime() + 15 * 60 * 1000));
res = env.apiAddContribution_({ token: tTwo, meetingId: MID, kind: 'Point', body: 'Said from the car park.' });
ok('refused once the register is open and you have not signed in', res.ok === false, JSON.stringify(res));
ok('and it says why, in the branch’s own words', /puts you in the room/.test(String(res.error)), res.error);

env.appendRow_(env.MEET.TAB_ATTENDANCE, { 'ID': 'ATT1', 'Meeting ID': MID,
  'Email': 'two@example.com', 'Name': 'Agent Two', 'Role': 'agent',
  'Status': 'present', 'Signed In': new Date() });
res = env.apiAddContribution_({ token: tTwo, meetingId: MID, kind: 'Point', body: 'Said in the room.' });
ok('taken once the register says they are in', res.ok === true, res.error);
cons = rows('TAB_CONTRIB').filter(c => String(c['Meeting ID']) === MID);
ok('that one is not stamped -1', env.num_(cons[1]['Offset (min)']) >= 0, cons[1]['Offset (min)']);

console.log('\nTHE FLOOR MEASURE STAYS HONEST');
// Agent One wrote in beforehand and then sat silent; Agent Two spoke in the room.
env.appendRow_(env.MEET.TAB_ATTENDANCE, { 'ID': 'ATT2', 'Meeting ID': MID,
  'Email': 'one@example.com', 'Name': 'Agent One', 'Role': 'agent',
  'Status': 'present', 'Signed In': new Date() });
const me = env.readPeople_().filter(p => p.email === 'bm@example.com')[0];
const cards = env.contributionsFor_(m, me);
const reg = env.register_(m, rows('TAB_ATTENDANCE').filter(a => String(a['Meeting ID']) === MID));
const st = env.floorStats_(cards, reg);
ok('the floor counts only what was said in the room', st.total === 1, st.total);
ok('the one who spoke in the room held the floor',
  st.spoke.length === 1 && st.spoke[0].email === 'two@example.com', JSON.stringify(st.spoke));
ok('the one who wrote in beforehand is still reported as silent',
  st.silent.some(p => p.email === 'one@example.com'), JSON.stringify(st.silent));
ok('what was brought in beforehand is reported on its own',
  st.earlyTotal === 1 && st.broughtIn.length === 1 && st.broughtIn[0].email === 'one@example.com',
  JSON.stringify({ earlyTotal: st.earlyTotal, broughtIn: st.broughtIn }));

Date.now = REAL_NOW;
console.log('\n' + (fails ? fails + ' FAILED' : 'all passing'));
process.exit(fails ? 1 : 0);
