// Hours for a run of days (27 October 2026).
//
// Kamla, for the week of 26 October: "Sasha 8 to 4 this week and resumes back
// next week, 7 to 3 ... Liz 12-1, Azariah 1-2, Sasha 2-3, Pawan and Kamla
// flexible". Pinned here: on a day in the week every clock follows the week's
// hours and lunch (the morning e-mail at start - 30, the lunch e-mail five
// minutes before lunch, the close-out 45 minutes before the finish, late
// against the start); Kamla and Pawan get no lunch e-mail that week; before the
// week late is judged on her 7am start as it always was; from
// Monday 2 November she is 7 to 3, close-out 2:15; SCHEDULE itself is untouched.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
let TODAY = '2026-10-27';
env.todayISO_ = () => TODAY;
const t = m => m == null ? null : env.twelve_(env.mmText_(m));
const span = s => env.parseSpan_(env.scheduleFor_(s).hours || '');

// The week of 26 October.
ok('Sasha 8 to 4 this week', env.scheduleFor_('sasha').hours === '8am – 4pm', env.scheduleFor_('sasha').hours);
ok('and her day block spans it', env.scheduleFor_('sasha').blocks.KPI1.time === '8am – 4pm');
ok('her morning e-mail at 7:30 (start - 30)', span('sasha').start - 30 === 7 * 60 + 30);
ok('lunch e-mail: Liz 11:55, Azariah 12:55, Sasha 1:55',
  t(env.lunchOffAt_('elizabeth')) === '11:55am' && t(env.lunchOffAt_('azariah')) === '12:55pm' && t(env.lunchOffAt_('sasha')) === '1:55pm',
  ['elizabeth', 'azariah', 'sasha'].map(s => t(env.lunchOffAt_(s))).join(' '));
ok('Kamla and Pawan: lunch flexible, no lunch e-mail', env.lunchOffAt_('kamla') === null && env.lunchOffAt_('pawan') === null && env.scheduleFor_('kamla').lunch === 'Flexible');
ok('close-out: Sasha 3:15, Liz 3:15, Azariah 3:15, Kamla 4:15',
  ['sasha', 'elizabeth', 'azariah', 'kamla'].map(s => t(env.closeoutAt_(s))).join(' ') === '3:15pm 3:15pm 3:15pm 4:15pm',
  ['sasha', 'elizabeth', 'azariah', 'kamla'].map(s => t(env.closeoutAt_(s))).join(' '));
ok('Sasha at 7:58 is not late this week', env.lateBy_('sasha', '07:58', TODAY) === 0);
ok('everyone in the week is 8 to 4 or 8 to 5', ['sasha', 'elizabeth', 'azariah'].every(s => env.scheduleFor_(s).hours === '8am – 4pm') && env.scheduleFor_('kamla').hours === '8am – 5pm');
ok('Liz and Azariah unchanged', env.scheduleFor_('elizabeth') === env.SCHEDULE.elizabeth && env.scheduleFor_('azariah') === env.SCHEDULE.azariah);

// A day outside the week reads her standing hours; late is judged on the start, 7am before and after.
ok('Tuesday 20 October reads 7am, not the week', env.scheduleFor_('sasha', '2026-10-20').hours === '7am – 3pm' && env.startFor_('sasha', '2026-10-20') === 7 * 60);
ok('so 7:20 that day stays late', env.lateBy_('sasha', '07:20', '2026-10-20') > 0);
ok('and the week judges by 8am', env.startFor_('sasha', '2026-10-28') === 8 * 60);

// From Monday 2 November.
TODAY = '2026-11-02';
ok('Sasha 7 to 3 from 2 November', env.scheduleFor_('sasha').hours === '7am – 3pm' && span('sasha').start - 30 === 6 * 60 + 30);
ok('close-out 2:15', t(env.closeoutAt_('sasha')) === '2:15pm', t(env.closeoutAt_('sasha')));
ok('lunch back to 12:00, e-mail 11:55', t(env.lunchOffAt_('sasha')) === '11:55am');
ok('Kamla and Pawan back to 12 to 1', t(env.lunchOffAt_('kamla')) === '11:55am' && t(env.lunchOffAt_('pawan')) === '11:55am');
ok('the week left SCHEDULE as it was', env.SCHEDULE.sasha.hours === '7am – 3pm' && env.SCHEDULE.kamla.lunch === '12:00 – 1:00pm');

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
