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
const mins = ag.reduce((n, a) => n + env.num_(a['Allotted (min)']), 0);
ok('seven agenda items', ag.length === 7, ag.length);
ok('ninety minutes in all', mins === 90, mins);

/* McKinsey sorts every meeting into information sharing, discussion or
   decision making, and an item nobody has labelled is how a discussion
   drifts into a briefing. Every item here carries its type as its Section,
   which the page prints as the eyebrow above the title. */
const by = {};
ag.forEach(a => { by[String(a['Section'])] = (by[String(a['Section'])] || 0) + env.num_(a['Allotted (min)']); });
ok('every item is labelled information, discussion or a decision',
  ag.every(a => ['Information', 'Discussion', 'Decision'].indexOf(String(a['Section'])) > -1),
  ag.map(a => a['Section']).join(', '));
ok('it is a DISCUSSION meeting: discussion outweighs information',
  by.Discussion > by.Information, JSON.stringify(by));
ok('and something actually gets decided', by.Decision >= 15, JSON.stringify(by));
ok('what is not working is the longest item on the agenda',
  env.num_(ag.filter(a => /not working/i.test(String(a['Title'])))[0]['Allotted (min)']) ===
  Math.max(...ag.map(a => env.num_(a['Allotted (min)'])))); 
// Every item but the closing announcement asks a question, because a question
// is the only thing a person can answer the day before. The spec marks that
// one item `tell: true`, so a question going missing from any other is a fail.
const asks = env.FRIDAY.AGENDA.filter(it => !it.tell).map(it => it.title);
const ask = ag.filter(a => asks.indexOf(String(a['Title'])) > -1);
ok('five of the seven items ask a question', ask.length === 5, ask.length);
ok('and every one of them really does ask', ask.every(a => /\?/.test(String(a['Detail']))),
  ask.filter(a => !/\?/.test(String(a['Detail']))).map(a => a['Title']).join('; '));
/* "Why" reads as an accusation and gets a defence back, not an answer;
   practitioner guidance on survey wording is consistent on opening with what
   or how. Which is allowed: it is a pick from a set, not an interrogation. */
ok('every question opens with what, how or which',
  ask.every(a => /Question: (what|how|which)\b/i.test(String(a['Detail']))),
  ask.filter(a => !/Question: (what|how|which)\b/i.test(String(a['Detail']))).map(a => a['Title']).join('; '));
ok('and not one of them asks anybody why',
  ask.every(a => !/\bwhy\b/i.test(String(a['Detail']))),
  ask.filter(a => /\bwhy\b/i.test(String(a['Detail']))).map(a => a['Title']).join('; '));
ok('the hard one asks for the process, not the person',
  /not who/i.test(String(ag.filter(a => /not working/i.test(String(a['Title'])))[0]['Detail'])));
ok('people are asked for three answers, not nine', env.FRIDAY.ANSWER_AT_LEAST === 3);
ok('and the pre-read tells them so', /at least three/i.test(String(m['Pre-Read'])));
ok('the pre-read says the meeting opens by reading what came in',
  /ten minutes of silence/i.test(String(m['Pre-Read'])));
ok('every item is for everyone', ag.every(a => String(a['Visibility']) === 'all'));
/* The branch manager does not run the item that asks the room what this
   branch should be known for: the room answers whoever asked it. */
ok('the unit manager leads the culture discussion',
  String(ag.filter(a => /known for/i.test(String(a['Title'])))[0]['Presenter Email']) === 'um@example.com');
ok('the two "what is working / not working" items belong to the room',
  ag.filter(a => /working/i.test(String(a['Title'])))
    .every(a => String(a['Presenter Name']) === 'Everyone' && !String(a['Presenter Email'])));
ok('the meeting opens with reading, not with a presentation',
  /read it/i.test(String(ag[0]['Title'])) && /silence/i.test(String(ag[0]['Detail'])));
ok('the order runs 1..7 with no gap',
  ag.map(a => env.num_(a['Order'])).sort((x, y) => x - y).join() === '1,2,3,4,5,6,7');
ok('the summary says the roster can sign in', /can sign in with the code/.test(summary), summary);

console.log('\nRUN IT AGAIN (an edit must not make a second meeting)');
env.seedFridayMeeting();
mtgs = rows('TAB_MEETINGS').filter(x => String(x['Ref']) === env.FRIDAY.REF);
ag = rows('TAB_AGENDA').filter(a => String(a['Meeting ID']) === String(m['ID']));
ok('still one meeting', mtgs.length === 1, mtgs.length);
ok('still seven agenda items, not fourteen', ag.length === 7, ag.length);
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
const agId = String(ag.filter(a => /not working/i.test(String(a['Title'])))[0]['ID']);
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

console.log('\nTHE REGISTER: PRESENT, LATE, OR ABSENT \u2014 AND NOTHING ELSE');
/* 28 October 2026: "dont give the opportunity to say cannot attend ... if they log
   in after the time it started they are present but late". */
const start = env.atTime_(m['Date'], m['Start']);
const at_ = (ms) => env.statusForNow_(m, new Date(start.getTime() + ms));
ok('on the minute is present', at_(0).status === 'present', JSON.stringify(at_(0)));
ok('half a minute before is present', at_(-30000).status === 'present');
ok('thirty seconds after it starts is LATE, not rounded down to present',
  at_(30000).status === 'late', JSON.stringify(at_(30000)));
ok('and it is never written down as nought minutes late', at_(30000).late >= 1, at_(30000).late);
ok('one minute after is late, by one', at_(60000).status === 'late' && at_(60000).late === 1,
  JSON.stringify(at_(60000)));
ok('twenty minutes after is late, by twenty',
  at_(20 * 60000).status === 'late' && at_(20 * 60000).late === 20, JSON.stringify(at_(20 * 60000)));
ok('the meeting carries no grace', env.num_(m['Late After (min)']) === 0, m['Late After (min)']);
ok('and the branch default is none either', env.MEET.LATE_AFTER_MINUTES === 0,
  env.MEET.LATE_AFTER_MINUTES);

/* An explicit 0 in the cell used to be thrown away by `num_(cell) || DEFAULT`,
   so a meeting set to no grace quietly kept the branch default. */
const withGrace = Object.assign({}, m); withGrace['Late After (min)'] = 15;
ok('a meeting may still carry its own grace',
  env.statusForNow_(withGrace, new Date(start.getTime() + 10 * 60000)).status === 'present');
ok('and ten past is late once that grace runs out',
  env.statusForNow_(withGrace, new Date(start.getTime() + 16 * 60000)).status === 'late');
const noCell = Object.assign({}, m); noCell['Late After (min)'] = '';
ok('an empty cell falls back to the branch default, an explicit 0 does not',
  env.statusForNow_(noCell, new Date(start.getTime() + 60000)).status === 'late');

/*  THE CELL IS NOT A STRING. Google Sheets keeps a time-only cell as a Date
 *  on its own 1899 epoch, so the live sheet hands back
 *  "Sat Dec 30 1899 12:00:00" where this harness had been handing back
 *  "12:00 PM". Every check above would pass on a build where the register
 *  read 1899 and marked the whole branch a century late, so the same
 *  arithmetic is run again against what Sheets really stores. */
const sheetsTime = Object.assign({}, m);
sheetsTime['Start'] = new Date(1899, 11, 30, 12, 0, 0);
const sStart = env.atTime_(sheetsTime['Date'], sheetsTime['Start']);
const mStart = env.asDate_(m['Date']);
ok('a time-only cell is lifted onto the meeting\u2019s own date, not 1899',
  sStart && sStart.getFullYear() === mStart.getFullYear() &&
  sStart.getMonth() === mStart.getMonth() && sStart.getDate() === mStart.getDate(),
  sStart && sStart.toString());
ok('and it keeps the hour and minute off the cell',
  sStart.getHours() === 12 && sStart.getMinutes() === 0, sStart && sStart.toString());
const sAt = (ms) => env.statusForNow_(sheetsTime, new Date(sStart.getTime() + ms));
ok('the register is right on a real Sheets time: on the minute is present',
  sAt(0).status === 'present', JSON.stringify(sAt(0)));
ok('and thirty seconds after is late, by one',
  sAt(30000).status === 'late' && sAt(30000).late === 1, JSON.stringify(sAt(30000)));

/*  And the ping, which is the one thing a person checks a deployment with,
 *  prints the time rather than the 1899 stamp. */
const pingStart = env.fmtTime_(env.atTime_(sheetsTime['Date'], sheetsTime['Start']));
ok('ping prints the start as a time, never the 1899 stamp',
  pingStart.indexOf('1899') === -1 && /\d/.test(pingStart), pingStart);

ok('nobody can excuse themselves any more',
  env.apiExcuse_({ token: tOne, meetingId: MID, reason: 'Client appointment' }).ok === false);
ok('and it says what to do instead',
  /only branch staff can record an apology/i.test(
    String(env.apiExcuse_({ token: tOne, meetingId: MID, reason: 'Client appointment' }).error)));
ok('no excused row was written',
  rows('TAB_ATTENDANCE').filter(a => env.low_(a['Status']) === 'excused').length === 0);
/* Staff recording an apology on somebody's behalf is a different thing, and stays. */
ok('branch staff can still record one on somebody\u2019s behalf',
  typeof env.apiMarkAttendance_ === 'function');

Date.now = REAL_NOW;   // back to the real clock: ping reports today's state
console.log('\nPING ANSWERS "IS IT WORKING?"');
/* 28 October 2026: "can you check and see if it's working?" — and ping said the
   app's name whether or not anything had been pasted, deployed or seeded. */
const png = env.apiPing_();
ok('it answers', png.ok === true);
ok('it says which build is deployed', /^\d{4}-\d{2}-\d{2}$/.test(String(png.version)), png.version);
ok('it says the one-off file is in the project', png.oneOff === true);
ok('it says the meeting is seeded', png.meeting && png.meeting.seeded === true, JSON.stringify(png.meeting));
ok('and published, so an agent can open it',
  png.meeting.openToEveryone === true && png.meeting.status === 'published', png.meeting.status);
ok('with its seven items and ninety minutes',
  png.meeting.agendaItems === 7 && png.meeting.minutes === 90, JSON.stringify(png.meeting));
ok('it says the register carries no grace', png.meeting.lateAfterMinutes === 0 &&
  png.register.lateAfterMinutes === 0, JSON.stringify(png.register));
ok('and that nobody can excuse themselves', png.register.selfExcuse === false);
ok('it says the register is not open yet', png.meeting.checkInOpenNow === false);
ok('it counts who cannot sign in \u2014 the thing that actually goes wrong',
  png.roster && png.roster.cannot === 1 && png.roster.canSignIn === png.roster.onTheRoll - 1,
  JSON.stringify(png.roster));

/* The /exec address is in a public repository, so this answer is public. */
const flat = JSON.stringify(png);
['Agent One', 'Agent Two', 'The Branch Manager', 'The Unit Manager', 'example.com',
 '11111111', '22222222', '99999999', env.FRIDAY.TITLE, 'What is not working']
  .forEach(secret => ok('ping never leaks ' + JSON.stringify(secret),
    flat.indexOf(secret) === -1, flat.slice(0, 300)));

/* A backend with Meetings.gs and nothing else must still answer. */
const seed = env.seedFridayMeeting, FRI = env.FRIDAY;
env.seedFridayMeeting = undefined; env.FRIDAY = undefined;
const bare = env.apiPing_();
ok('it still answers with the one-off file missing', bare.ok === true && bare.oneOff === false);
ok('and says the meeting is not there rather than throwing', bare.meeting === undefined,
  JSON.stringify(bare.meeting));
env.seedFridayMeeting = seed; env.FRIDAY = FRI;

console.log('\n' + (fails ? fails + ' FAILED' : 'all passing'));
process.exit(fails ? 1 : 0);
