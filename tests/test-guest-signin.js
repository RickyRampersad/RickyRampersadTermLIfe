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

/* ── 0000 signs in ── */
console.log('\n0000 looks in');
const g1 = env.apiLogin_({ who: '0000', email: '0000' });
ok('signed in', g1.ok === true, g1.error);
ok('as a guest', g1.ok && g1.user && g1.user.role === 'guest',
   g1.ok && g1.user ? g1.user.role : '-');
ok('with a token', !!(g1.ok && g1.token));
ok('one Visitor row was written', visitors().length === 1, visitors().length);

/* ── again, and it must NOT pile up another Visitor ── */
console.log('\n0000 looks in again');
const g2 = env.apiLogin_({ who: '0000', email: '0000' });
ok('signed in again', g2.ok === true, g2.error);
ok('still exactly one Visitor row', visitors().length === 1, visitors().length);
ok('the same row, so the same token', g1.token && g2.token === g1.token);

/* ── a row written before the fix reads back as 0, and still works ── */
console.log('\nA Visitor row left behind by the old build');
const env2 = (() => {
  const e = makeEnv();
  e.DriveApp = env.DriveApp;
  e.setupMeetings && e.setupMeetings();
  // What the old build left: Agent No parsed to 0, over and over.
  for (let i = 0; i < 3; i++) {
    e.appendRow_(e.MEET.TAB_PEOPLE, {
      'Agent No': '0000', 'Email': '0000@guest.invalid', 'Name': e.MEET.GUEST_NAME,
      'Role': 'guest', 'Active': 'Yes', 'Added': new Date() });
  }
  return e;
})();
const g3 = env2.apiLogin_({ who: '0000', email: '0000' });
ok('signs in on the stale rows', g3.ok === true, g3.error);
ok('adds no fourth row',
   env2.readTab_(env2.MEET.TAB_PEOPLE)
       .filter(r => String(r['Name']) === env2.MEET.GUEST_NAME).length === 3);

/* ── the guest is never on the roll ── */
console.log('\nThe register');
const roll = env.roster_();
ok('the guest is not counted on the roll',
   roll.every(p => !env.isGuestNo_(p.agentNo)), JSON.stringify(roll.map(p => p.agentNo)));
ok('the two real people are', roll.length === 2 + 1 || roll.length === 2,
   'roll is ' + roll.length);   // +1 for the manager setupMeetings seeds

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
const a1 = env.apiLogin_({ who: '10024' });
ok('the digits alone find the agent the bank writes A10024', a1.ok === true, a1.error);
ok('and it is the right agent', a1.ok && a1.user && a1.user.name === 'Agent One',
   a1.ok && a1.user ? a1.user.name : '-');
const a2 = env.apiLogin_({ who: 'A10024' });
ok('the bank form works too', a2.ok === true, a2.error);
const a3 = env.apiLogin_({ who: '99999' });
ok('a number on nobody is refused', a3.ok === false);
ok('and the refusal points at the guest number',
   a3.ok === false && /0000/.test(String(a3.error)), a3.error);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
