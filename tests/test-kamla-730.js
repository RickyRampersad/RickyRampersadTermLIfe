// Kamla's morning e-mail reaches her by 7:30 (11 November 2026).
// Kamla: "change my time for the start trigger at 7:30am". Her day is 8 to 5, so it was due at 7:30, but four 8am
// desks share the window three a run and it landed about 7:45. It is now sent from 7:00; the others keep start - 30.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-11-11';
const env = makeEnv(); env.todayISO_ = () => DAY;
let NOW = new Date(DAY + 'T06:55:00').getTime(); const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW); }, get(t, k) { return k === 'now' ? () => NOW : t[k]; } });
const at = hm => { NOW = new Date(DAY + 'T' + hm + ':00').getTime(); env.resetRequestMemo_ && env.resetRequestMemo_(); env.forgetHr_(env.ATT); };
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Branch', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
env.__mkSheet('Attendance', 2, env.ATT.head, []);
let built = []; env.dayStartBuildSend_ = sid => { built.push(sid); return true; };
env.hkSend_ = () => true; env.sendMidday_ = () => true; env.inboxOn_ = () => false;
['agentTick_', 'ffChaseTick_', 'coverTick_', 'gameTick_', 'rateTick_', 'autoAbsentTick_'].forEach(f => { env[f] = () => []; });
['sendBranchManagerDay_', 'sendMeNudge_', 'sendBranchManagerProgress_', 'sdPrune_', 'notClosedReminder_', 'markNotClosed_', 'sendMailbagCall_',
 'sendBmaReport_', 'sendAttendanceReport_', 'sendInnovationBoard_', 'sendTeamBoard_', 'sendUnitManagerProgress_', 'sendUnitManagerMorning_', 'sendUnitManagerEvening_',
 'closeoutCheck_', 'bmCloseoutCheck_'].forEach(f => { env[f] = () => false; });
env.rebalanceTick_ = () => ''; env.chaseOn_ = () => false; env.meNudgeTimes_ = () => [];
at('06:55'); env.housekeepingTick_(); ok('6:55: nothing yet', built.length === 0, built.join(','));
at('07:00'); env.housekeepingTick_(); ok('7:00: Kamla\'s goes', built.indexOf('kamla') > -1, built.join(','));
ok('7:00: Azariah (8am) still waits for 7:30', built.indexOf('azariah') < 0);
at('07:30'); env.housekeepingTick_(); ok('7:30: Azariah\'s goes', built.indexOf('azariah') > -1, built.join(','));
ok('Kamla gets one, not two', built.filter(s => s === 'kamla').length === 1);
ok('lead: kamla 60, others 30', env.staffMailLead_('kamla') === 60 && env.staffMailLead_('sasha') === 30);
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
