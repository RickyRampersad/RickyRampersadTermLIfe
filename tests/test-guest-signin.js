// The standing guest number, 0000, against a Sheets that parses what it is given.
//
// 30 October 2026, hours before the branch meeting: the script was pasted and
// deployed, the roster was pulled (19 on the roll), and 0000 was still refused —
// "Guest sign-in is not set up yet. Speak to the branch manager." The cause was
// one comparison. guestRow_ writes '0000' to the People tab; Sheets parses it to
// the number 0; guestFind_ compared String(0) === '0000' and never matched the
// row it had just written. So every executive looking in was turned away, and
// every attempt appended one more Visitor row.
//
// Run: SHEETS_PARSE=1 node tests/test-guest-signin.js
// Without SHEETS_PARSE the fake keeps the string and the bug cannot appear,
// which is exactly why nothing caught it.
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = [path.join(ROOT, 'apps-script/Meetings.gs'),
                       path.join(ROOT, 'apps-script/MeetingFriday.gs')].join(',');
if (process.env.SHEETS_PARSE !== '1') {
  console.log('  !! run with SHEETS_PARSE=1, or the fake sheet cannot reproduce this');
  process.exit(2);
}
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra !== undefined && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

env.DriveApp = {
  createFolder: name => ({ getId: () => 'folder-1', getName: () => name,
                           setSharing: function () { return this; } }),
  getFolderById: id => ({ getId: () => id, getName: () => 'Materials' }),
  Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' }
};
env.setupMeetings && env.setupMeetings();

// A branch on the roll, as pullRoster leaves it.
[['A10024', 'one@example.com', 'Agent One', 'agent', 'Unit One', 'Y', '33333333'],
 ['A00002', 'um@example.com',  'The Unit Manager', 'unitmgr', 'Unit One', 'Y', '22222222']]
  .forEach(([no, em, nm, role, unit, active, code]) => env.appendRow_(env.MEET.TAB_PEOPLE, {
    'Agent No': no, 'Email': em, 'Name': nm, 'Role': role,
    'Unit': unit, 'Active': active, 'Access Code': code, 'Added': new Date() }));

const people = () => env.readTab_(env.MEET.TAB_PEOPLE);
const visitors = () => people().filter(r => String(r['Name']) === env.MEET.GUEST_NAME);

/* ── the fake really does parse now, or the rest proves nothing ── */
console.log('\nThe fake sheet behaves like Sheets');
env.appendRow_(env.MEET.TAB_PEOPLE, { 'Agent No': '0000', 'Email': 'probe@example.com',
                                      'Name': 'Probe', 'Role': 'agent', 'Active': 'Y' });
const probe = people().filter(r => String(r['Email']) === 'probe@example.com')[0];
ok("a written '0000' comes back as the number 0", probe['Agent No'] === 0,
   JSON.stringify(probe['Agent No']));
// Take the probe back out so it cannot stand in for the guest row.
(() => {
  const sh = env.tab_(env.MEET.TAB_PEOPLE);
  for (let i = sh._grid.length; i >= 2; i--) {
    if (String(sh._grid[i - 1][1] || '') === 'probe@example.com') sh.deleteRow(i);
  }
})();

/* ── 0000 asks who is at the door, and that is not a refusal ── */
console.log('\n0000 asks who you are');
const a0 = env.apiLogin_({ who: '0000', email: '0000' });
ok('it does not let an anonymous visitor in', a0.ok === false);
ok('it asks, rather than refusing', a0.needGuest === true, JSON.stringify(a0));
ok('and says why it is asking', /name/i.test(String(a0.error)), a0.error);

const a1 = env.apiLogin_({ who: '0000', firstName: 'Gregg', lastName: 'Mannette' });
ok('a name alone is still asked for a role', a1.needGuest === true, JSON.stringify(a1));
ok('and it remembers the name it already has', a1.haveName === 'Gregg Mannette', a1.haveName);

/* ── name and role, and they are in ── */
console.log('\nA named visitor looks in');
const g1 = env.apiLogin_({ who: '0000', firstName: 'Gregg', lastName: 'Mannette',
                           jobTitle: 'Head of Agency' });
ok('signed in', g1.ok === true, g1.error);
ok('as a guest', g1.ok && g1.user && g1.user.role === 'guest',
   g1.ok && g1.user ? g1.user.role : '-');
ok('under their own name, not Visitor',
   g1.ok && g1.user && g1.user.name === 'Gregg Mannette',
   g1.ok && g1.user ? g1.user.name : '-');
ok('with a token', !!(g1.ok && g1.token));

/* ── a second visitor is a second person, not the same one ── */
console.log('\nTwo visitors at once');
const g2 = env.apiLogin_({ who: '0000', firstName: 'Ann', lastName: 'Marie',
                           jobTitle: 'Head Office' });
ok('the second signs in', g2.ok === true, g2.error);
ok('under their own name', g2.ok && g2.user.name === 'Ann Marie', g2.ok && g2.user.name);
ok('with a token of their own, so neither knocks the other out',
   g1.token && g2.token && g1.token !== g2.token);
ok('and the first token still resolves to the first visitor',
   (env.findPersonByToken_(g1.token) || {}).name === 'Gregg Mannette',
   JSON.stringify(env.findPersonByToken_(g1.token) || null));

/* ── the same visitor returning lands on their own row ── */
console.log('\nThe same visitor comes back');
const before = env.readPeople_().filter(p => p.role === 'guest').length;
const g3 = env.apiLogin_({ who: '0000', firstName: 'Gregg', lastName: 'Mannette',
                           jobTitle: 'Head of Agency' });
ok('signed in again', g3.ok === true, g3.error);
ok('no second row for the same person',
   env.readPeople_().filter(p => p.role === 'guest').length === before, 'rows grew');
ok('a fresh token each visit', g3.token !== g1.token);

/* ── a row the old build left behind does not block anyone ── */
console.log('\nThe Visitor rows the old build left');
const env2 = (() => {
  const e = makeEnv();
  e.DriveApp = env.DriveApp;
  e.setupMeetings && e.setupMeetings();
  for (let i = 0; i < 3; i++) {
    e.appendRow_(e.MEET.TAB_PEOPLE, {
      'Agent No': '0000', 'Email': '0000@guest.invalid', 'Name': e.MEET.GUEST_NAME,
      'Role': 'guest', 'Active': 'Yes', 'Added': new Date() });
  }
  return e;
})();
const g4 = env2.apiLogin_({ who: '0000', firstName: 'Gregg', lastName: 'Mannette',
                            jobTitle: 'Head of Agency' });
ok('a visitor still signs in past them', g4.ok === true, g4.error);
ok('and gets their own name', g4.ok && g4.user.name === 'Gregg Mannette',
   g4.ok && g4.user ? g4.user.name : '-');

/* ── the guest is never on the roll ── */
console.log('\nThe register');
const roll = env.roster_();
ok('the guest is not counted on the roll',
   roll.every(p => !env.isGuestNo_(p.agentNo)), JSON.stringify(roll.map(p => p.agentNo)));
ok('no visitor is on the roll, however many looked in',
   roll.filter(p => p.role === 'guest').length === 0);
ok('and there are visitors on the People tab to prove that matters',
   env.readPeople_().filter(p => p.role === 'guest').length >= 2,
   env.readPeople_().filter(p => p.role === 'guest').length);

/* ── what must NOT be read as the guest ── */
console.log('\nWhat is not the guest');
ok('a blank Agent No is not the guest', env.isGuestNo_('') === false);
ok('an undefined Agent No is not the guest', env.isGuestNo_(undefined) === false);
ok("a letters-only row is not the guest", env.isGuestNo_('SASHA') === false);
ok('a real agent number is not the guest', env.isGuestNo_('A10024') === false);
ok("'0' is the guest, because Sheets stores 0000 that way", env.isGuestNo_('0') === true);
ok('the number 0 is the guest', env.isGuestNo_(0) === true);
ok("'00' is the guest", env.isGuestNo_('00') === true);

console.log('\nA blank number opens nothing');
const blank = env.apiLogin_({ who: '', email: '' });
ok('an empty box is refused', blank.ok === false, JSON.stringify(blank));

/* ── the card's number still signs an agent in ── */
console.log('\nThe number on the card');
const c1 = env.apiLogin_({ who: '10024' });
ok('the digits alone find the agent the bank writes A10024', c1.ok === true, c1.error);
ok('and it is the right agent', c1.ok && c1.user && c1.user.name === 'Agent One',
   c1.ok && c1.user ? c1.user.name : '-');
const c2 = env.apiLogin_({ who: 'A10024' });
ok('the bank form works too', c2.ok === true, c2.error);
const c3 = env.apiLogin_({ who: '99999' });
ok('a number on nobody is refused', c3.ok === false);
ok('and the refusal points at the guest number',
   c3.ok === false && /0000/.test(String(c3.error)), c3.error);
ok('and it is not the visitor prompt', !c3.needGuest);

/* ── THE ONE THAT MATTERS: a visitor is never on the register ──
   register_ builds its groups from the attendance rows and takes its
   absents from rosterFor_, which excludes a guest. So an attendance row
   for a visitor would be counted present against a roll that does not
   contain them — three executives looking in would push the branch past
   100%, which is the exact thing the 28 October decision set out to
   prevent when it made the guest anonymous. Naming the guest must not
   bring that back. */
console.log('\nA visitor at a real meeting');
env.seedFridayMeeting();
const meeting = env.readTab_(env.MEET.TAB_MEETINGS)
  .filter(r => String(r['Status']).toLowerCase() === 'published')[0];
ok('there is a published meeting to look in on', !!meeting);
//  The seeder opens check-in at 11:30 on the day, so the window is shut
//  whenever this runs. Open it, because what is under test is what
//  check-in WRITES, not when it is allowed.
(() => {
  const now = Date.now();
  env.setCell_(env.MEET.TAB_MEETINGS, meeting._row, 'Check-In Opens', new Date(now - 36e5));
  env.setCell_(env.MEET.TAB_MEETINGS, meeting._row, 'Check-In Closes', new Date(now + 36e5));
})();
const meetingOpen = env.readTab_(env.MEET.TAB_MEETINGS)
  .filter(r => String(r['ID']) === String(meeting['ID']))[0];

const regBefore = env.register_(meetingOpen);
const vis = env.apiLogin_({ who: '0000', firstName: 'Gregg', lastName: 'Mannette',
                            jobTitle: 'Head of Agency' });
ok('the visitor is signed in', vis.ok === true, vis.error);

const ci = env.apiCheckIn_({ token: vis.token, meetingId: String(meetingOpen['ID']),
                             device: 'iPhone' });
ok('check-in answers', ci.ok === true, ci.error);
ok('and says they are a visitor', ci.visitor === true, JSON.stringify(ci));

const attRows = env.readTab_(env.MEET.TAB_ATTENDANCE)
  .filter(a => String(a['Meeting ID']) === String(meeting['ID']));
ok('NO attendance row was written for them',
   attRows.filter(a => String(a['Email']).indexOf('guest.invalid') > -1).length === 0,
   JSON.stringify(attRows.map(a => a['Email'])));

const regAfter = env.register_(meetingOpen);
ok('the present count did not move',
   regAfter.counts.present === regBefore.counts.present,
   regBefore.counts.present + ' -> ' + regAfter.counts.present);
ok('the roll did not move',
   regAfter.counts.roll === regBefore.counts.roll,
   regBefore.counts.roll + ' -> ' + regAfter.counts.roll);
ok('the rate did not move',
   regAfter.counts.rate === regBefore.counts.rate,
   regBefore.counts.rate + ' -> ' + regAfter.counts.rate);
ok('and the rate can never exceed 100', regAfter.counts.rate <= 100, regAfter.counts.rate);

/* ── but the branch can see who came ── */
console.log("\nThe visitors' book");
ok('the visitor is in it', (regAfter.visitors || []).length === 1,
   JSON.stringify(regAfter.visitors));
const v0 = (regAfter.visitors || [])[0] || {};
ok('by name', v0.name === 'Gregg Mannette', v0.name);
ok('with their role', v0.jobTitle === 'Head of Agency', v0.jobTitle);
ok('and when they looked in', !!v0.when, v0.when);

env.apiCheckIn_({ token: vis.token, meetingId: String(meeting['ID']) });
ok('looking in twice is still one line',
   (env.register_(meetingOpen).visitors || []).length === 1);

const vis2 = env.apiLogin_({ who: '0000', firstName: 'Ann', lastName: 'Marie',
                             jobTitle: 'Head Office' });
env.apiCheckIn_({ token: vis2.token, meetingId: String(meeting['ID']) });
const twoVis = env.register_(meetingOpen);
ok('a second visitor is a second line', (twoVis.visitors || []).length === 2,
   (twoVis.visitors || []).length);
ok('and the register is still untouched',
   twoVis.counts.present === regBefore.counts.present &&
   twoVis.counts.roll === regBefore.counts.roll);

/* ── the log, so a visit is on the record either way ── */
const logged = env.readTab_(env.MEET.TAB_LOG)
  .filter(r => String(r['Role']).toLowerCase() === 'guest');
ok('the visit is on the log too', logged.length > 0, logged.length);
ok('under the visitor\'s own name, never "Visitor"',
   logged.some(r => String(r['Actor']) === 'Gregg Mannette'),
   JSON.stringify(logged.map(r => r['Actor'])));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
