// The morning e-mail tries again, and the absence clock waits for it (21 October 2026).
//
// Ricky, 21 Oct 7:06am: "liz is asking as she has not seen her day, did it go out".
// The record said "elizabeth: marked sent at 06:32" and nothing had gone: the
// mark was written before the e-mail was built, the 6:32 run was stopped by
// Google's six-minute limit part-way through hers, and nothing tried again.
// Sasha's went from the next run, at 6:42. The clock then marked Liz absent at
// 7:05, with no check-in link in her hands, and her work was due to move at 7:30.
// Then: "ensure this does not happen to any other staff" and "ensure the
// attendance rule is built in for task reassignment".
//
// Pinned here, for every desk:
//   - a build that throws clears the mark and is logged; the next run sends it
//   - a run stopped part-way (the "try" mark left behind) is taken up by a later run
//   - past the run's budget a second build waits for the next run
//   - nobody is marked absent before their morning e-mail has gone, nor sooner
//     than fifteen minutes after it; the work moves 25 minutes after a late mark
//   - showRunLog lists each desk's morning e-mail; resendMorningLiz sends hers again
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-21';
const env = makeEnv();
env.todayISO_ = () => DAY;
// The incident was on Liz's old 7 to 3 day, so her hours are pinned to it here.
// (She is 8 to 4 from 23 October 2026; that is tested in test-attendance.js and test-closeout-times.js.)
env.SCHEDULE.elizabeth = Object.assign({}, env.SCHEDULE.elizabeth, { hours: '7am – 3pm' });
env.CLOSEOUT.AT.elizabeth = 14 * 60 + 15;
let NOW = new Date(DAY + 'T06:31:00').getTime();
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW); },
                                 get(t, k) { return k === 'now' ? () => NOW : t[k]; } });
const at = hm => { NOW = new Date(DAY + 'T' + hm + ':00').getTime(); env.resetRequestMemo_ && env.resetRequestMemo_(); env.forgetHr_(env.ATT); };
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
const attSh = env.__mkSheet('Attendance', 2, env.ATT.head, []);
const P = env.PropertiesService.getScriptProperties();
const mark = sid => P.getProperty('daystart_first_' + sid + '_' + DAY);
const runlog = () => P.getProperty('RUNLOG') || '';

const realAbsent = env.autoAbsentTick_, realCover = env.coverTick_;
// Everything after the morning e-mail is stubbed out; the build itself is ours to break.
let built = [], breakFor = {}, slow = 0;
env.dayStartBuildSend_ = (sid) => { built.push(sid); NOW += slow; if (breakFor[sid]) { const why = breakFor[sid]; delete breakFor[sid]; throw new Error(why); } return true; };
env.hkSend_ = () => true; env.sendMidday_ = () => true; env.inboxOn_ = () => false;
['agentTick_', 'ffChaseTick_', 'coverTick_', 'gameTick_', 'rateTick_'].forEach(f => { env[f] = () => []; });
['sendBranchManagerDay_', 'sendMeNudge_', 'sendBranchManagerProgress_', 'sdPrune_', 'notClosedReminder_', 'markNotClosed_', 'sendMailbagCall_',
 'sendBmaReport_', 'sendAttendanceReport_', 'sendInnovationBoard_', 'sendTeamBoard_', 'sendUnitManagerProgress_', 'sendUnitManagerMorning_', 'sendUnitManagerEvening_',
 'closeoutCheck_', 'bmCloseoutCheck_'].forEach(f => { env[f] = () => false; });
env.rebalanceTick_ = () => ''; env.chaseOn_ = () => false; env.meNudgeTimes_ = () => [];
env.autoAbsentTick_ = () => [];   // the clock is tested on its own below

console.log('\nA build that fails is cleared, logged, and sent by the next run:\n');
breakFor.elizabeth = 'Exceeded maximum execution time';
env.housekeepingTick_();
ok('6:31: Liz\'s build fails', built.indexOf('elizabeth') > -1, built.join(', '));
ok('her mark is cleared, not left saying "sent"', !mark('elizabeth'), String(mark('elizabeth')));
ok('and the failure is in the run log', /morning elizabeth FAILED 06:31: Exceeded maximum execution time/.test(runlog()), runlog());
ok('Sasha\'s goes in the same run, and is marked with the time', mark('sasha') === '06:31', String(mark('sasha')));
ok('and is in the run log as sent', /morning sasha sent 06:31/.test(runlog()));
at('06:41'); built = [];
env.housekeepingTick_();
ok('6:41: the next run sends Liz\'s', built.join(',') === 'elizabeth', built.join(', '));
ok('now marked sent at the time it went', mark('elizabeth') === '06:41', String(mark('elizabeth')));
ok('Sasha\'s is not sent twice', built.indexOf('sasha') === -1);

console.log('\nA run stopped part-way leaves "try"; a later run takes it up:\n');
P.deleteProperty('daystart_first_elizabeth_' + DAY);
P.setProperty('daystart_first_elizabeth_' + DAY, 'try ' + new realDate(DAY + 'T06:32:00').getTime());
at('06:36'); built = [];
env.housekeepingTick_();
ok('6:36: four minutes on, the try may still be running: left alone', built.indexOf('elizabeth') === -1, built.join(', '));
at('06:42'); built = [];
env.housekeepingTick_();
ok('6:42: ten minutes on, it did not finish: built again', built.indexOf('elizabeth') > -1, built.join(', '));
ok('logged as a try that did not finish', /morning elizabeth: the 06:32 try did not finish, trying again/.test(runlog()), runlog());
ok('and marked sent', mark('elizabeth') === '06:42', String(mark('elizabeth')));

console.log('\nPast the budget, the second build waits for the next run:\n');
P.deleteProperty('daystart_first_sasha_' + DAY); P.deleteProperty('daystart_first_elizabeth_' + DAY);
at('06:31'); built = []; slow = 5 * 60000;
env.housekeepingTick_();
ok('6:31: one slow build, then no second in the same run', built.length === 1, built.join(', '));
const first = built[0], second = first === 'sasha' ? 'elizabeth' : 'sasha';
ok('the other is not marked', !mark(second), String(mark(second)));
at('06:41'); built = []; slow = 0;
env.housekeepingTick_();
ok('6:41: the next run sends it', built.join(',') === second, built.join(', '));

console.log('\nThe absence clock waits for the morning e-mail (every desk):\n');
env.autoAbsentTick_ = realAbsent;
const minsNow = () => env.minutesOf_(env.hhmm_(new env.Date()));
const tick = () => env.autoAbsentTick_(DAY, minsNow(), {}, {});
P.setProperty('AUTO_ABSENT_FROM', '2026-10-01');
P.deleteProperty('daystart_first_elizabeth_' + DAY);
P.setProperty('daystart_first_sasha_' + DAY, '06:42');
at('07:06');
let marked = tick();
ok('7:06: Sasha had hers at 6:42 and has not signed in: absent', marked.indexOf('sasha') > -1, JSON.stringify(marked));
ok('Liz has had no e-mail: not absent', marked.indexOf('elizabeth') === -1);
ok('Azariah starts at 8: not yet', marked.indexOf('azariah') === -1);
P.setProperty('daystart_first_elizabeth_' + DAY, 'try ' + NOW);
at('07:12');
ok('7:12: hers is still being built: not absent', tick().indexOf('elizabeth') === -1);
P.setProperty('daystart_first_elizabeth_' + DAY, '07:14');
at('07:20');
ok('7:20: hers went at 7:14: fifteen minutes to check in, not absent yet', tick().indexOf('elizabeth') === -1);
at('07:29');
marked = tick();
ok('7:29: absent', marked.indexOf('elizabeth') > -1, JSON.stringify(marked));
const lizRow = attSh._grid.filter(r => r[1] === 'elizabeth')[0] || [];
ok('the register gives the real deadline', /No sign-in by 7:29am \(automatic\)/.test(String(lizRow[7])), String(lizRow[7]));
ok('the due time for a desk without the morning e-mail is the start + 5', env.absentDueAt_('ashley', DAY, 9 * 60, P) === 9 * 60 + 5);

console.log('\nThe work moves 25 minutes after a late mark, not at start + 30:\n');
let planned = [];
env.sfkConfigured_ = () => true;
env.coverPlan_ = (day, sid) => { planned.push(sid); return null; };
env.coverTick_ = realCover;
at('07:31'); planned = [];
env.coverTick_(DAY, 7 * 60 + 31, {}, { elizabeth: 1 });
ok('7:31: marked at 7:29, the work does not move yet', planned.indexOf('elizabeth') === -1, planned.join(','));
at('07:55'); planned = [];
env.coverTick_(DAY, 7 * 60 + 55, {}, { elizabeth: 1 });
ok('7:55: it moves', planned.indexOf('elizabeth') > -1, planned.join(','));

console.log('\nThe run log lists each desk; one press sends Liz hers again:\n');
const log = env.showRunLog();
ok('showRunLog: Morning e-mail today, desk by desk', /Morning e-mail today:/.test(log) && /Elizabeth Lee: sent at 07:14/.test(log) && /Azariah Griffith: not sent/.test(log), log.split('Morning e-mail today:')[1]);
built = [];
const r = env.resendMorningLiz();
ok('resendMorningLiz sends hers whatever the record says', built.join(',') === 'elizabeth' && /^Elizabeth Lee \(the record said: 07:14\)\. Sent to liz@example\.com, from Gmail$/.test(r), r);
breakFor.elizabeth = 'Salesforce did not answer';
const r2 = env.resendMorningLiz();
ok('a failure says so and leaves her unmarked for the next run', /FAILED: Salesforce did not answer/.test(r2) && !mark('elizabeth'), r2 + ' | ' + mark('elizabeth'));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
