// "Build Wednesday's agenda now", pressed on a Tuesday.
//
// 10 November 2026, the branch manager, the evening before the meeting:
// "build wednesday agenda now".
//
// He could not. buildWednesday() is the 6:00 Wednesday trigger and the menu
// item both, and its first line refused on any other day — so the button
// answered "Not the meeting day" and tomorrow's agenda could not exist until
// tomorrow. Nobody could bring anything to it beforehand either: the
// contribution box only opens for a meeting that is already there.
//
// What this holds the script to:
//   the trigger   still builds nothing on a day that is not the meeting day,
//                 so a trigger left behind on an old day cannot write a
//                 meeting for the wrong date.
//   the press     builds the UPCOMING meeting day, and dates every field on
//                 the row from that day rather than from today.
//   twice         is not two meetings.
//
// Run: node tests/test-build-ahead.js
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Meetings.gs');
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
env.setupMeetings();

/*  The harness has no clock, so the meeting day is moved instead of the date:
    whatever today really is, the meeting day is set to TOMORROW. That is the
    Tuesday-evening case exactly. */
const today = new Date();
env.MEET.MEETING_DAY = (today.getDay() + 1) % 7;
const wantDay = env.MEET.MEETING_DAY;

console.log('\nthe day it builds for');
(() => {
  const when = env.nextMeetingDay_(today);
  ok('is the next meeting day, not today', when.getDay() === wantDay, when.toString());
  ok('and it is midnight, so every date on the row comes off it',
    when.getHours() === 0 && when.getMinutes() === 0 && when.getSeconds() === 0);
  ok('is today when today IS the meeting day', (() => {
    const keep = env.MEET.MEETING_DAY;
    env.MEET.MEETING_DAY = today.getDay();
    const d = env.nextMeetingDay_(today);
    env.MEET.MEETING_DAY = keep;
    return d.getDate() === today.getDate();
  })());
})();

console.log('\nthe trigger keeps its guard');
(() => {
  const said = env.buildWednesday();
  ok('a run on any other day builds nothing', /not the meeting day/i.test(said), said);
  ok('and writes no meeting row', env.meetingRows_().length === 0,
    env.meetingRows_().length);
})();

console.log('\na person’s press builds the upcoming meeting');
(() => {
  env.appendRow_(env.MEET.TAB_ACTIONS, {
    'ID': 'ACT-9', 'Meeting ID': 'MTG-LAST', 'Item': 'Still open from last week',
    'Owner': 'Support Two', 'Status': 'Open', 'Origin Meeting': 'MTG-LAST'
  });
  const said = env.buildWednesday({ ahead: true });
  ok('the meeting is written', /meeting created/.test(said), said);
  ok('the agenda is seeded from the rota in the same run',
    /items written from the rota/.test(said), said);
  ok('last week’s open actions are carried over in the same run',
    /1 open action carried forward/.test(said), said);
  ok('and the message names the day it built for, not just "created"',
    said.indexOf('for ' + env.dayName_(wantDay)) === 0, said);

  const rows = env.meetingRows_();
  ok('exactly one meeting', rows.length === 1, rows.length);
  /*  No row means every check below is about undefined, and a crash here
      reads as a broken test rather than a broken build. */
  const m = rows[0] || {};
  const d = env.asDate_(m['Date']);
  ok('dated the meeting day, never today', !!d && d.getDay() === wantDay, String(m['Date']));
  ok('the Ref carries that date too',
    !!d && String(m['Ref']).indexOf(env.Utilities.formatDate(d, 'tz', 'yyyy-MM-dd')) > -1,
    String(m['Ref']));
  ok('and the week is that day’s week', !!d && String(m['Week']) === env.weekOf_(d),
    String(m['Week']) + ' vs ' + (d ? env.weekOf_(d) : '—'));
  ok('it has an agenda', env.readTab_(env.MEET.TAB_AGENDA)
    .filter(a => String(a['Meeting ID']) === String(m['ID'])).length > 0);
})();

console.log('\npressed twice');
(() => {
  const said = env.buildWednesday({ ahead: true });
  ok('the second press finds the meeting rather than making another',
    /meeting already there/.test(said), said);
  ok('still one meeting', env.meetingRows_().length === 1, env.meetingRows_().length);
  ok('and the actions are not carried twice',
    /0 open actions carried forward/.test(said), said);
})();

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passing');
process.exit(fails ? 1 : 0);
