// The ten-minute run: the staff's own mail first, the heavy work after (20 October 2026).
//
// Ricky, 20 Oct 2:40pm: "Elizabeth is saying she did not get her mail at 2:30."
// Nor her 11:30 progress check; on 19 October the close-outs only went when
// sent by hand at 6:07pm. The progress check and the close-out sat at the end
// of the run, after the inbox, the game, the agents and the cover, and a run
// that ran out of time stopped before reaching them.
//
// Pinned here: the progress check and the close-out go before the inbox, the
// game and the ratings; past the budget the catch-up work is left to the next
// run; and the run's length is kept for showRunLog.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-20';
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = new Date(DAY + 'T14:31:00').getTime();
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW); },
                                 get(t, k) { return k === 'now' ? () => NOW : t[k]; } });
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
env.__mkSheet('Attendance', 2, env.ATT.head, [[DAY, 'elizabeth', 'Elizabeth Lee', '06:55', '', '', 'in', '', 'elizabeth', ''],
                                             [DAY, 'azariah', 'Azariah Griffith', '07:58', '', '', 'in', '', 'azariah', '']]);
const P = env.PropertiesService.getScriptProperties();
let order = [], slow = 0;
const mark = (name, ret) => (...a) => { order.push(name); NOW += slow; return ret; };
env.hkSend_ = p => { order.push('closeout:' + p.staffId); return true; };
env.sendMidday_ = p => { order.push('progress:' + p.staffId); return true; };
env.inboxOn_ = () => true;
env.inboxScrub_ = mark('inbox'); env.dayLogSalesforce_ = mark('daylog'); env.bmdWarm_ = mark('bmd');
env.gameTick_ = mark('game', []); env.rateTick_ = mark('rate', []);
['agentTick_', 'ffChaseTick_', 'autoAbsentTick_', 'coverTick_'].forEach(f => { env[f] = () => []; });
['sendDayStart_', 'sendBranchManagerDay_', 'sendMeNudge_', 'sendBranchManagerProgress_', 'sdPrune_', 'notClosedReminder_', 'markNotClosed_', 'sendMailbagCall_',
 'sendBmaReport_', 'sendAttendanceReport_', 'sendInnovationBoard_', 'sendTeamBoard_', 'sendUnitManagerProgress_', 'sendUnitManagerMorning_', 'sendUnitManagerEvening_'].forEach(f => { env[f] = () => false; });
env.rebalanceTick_ = () => ''; env.chaseOn_ = () => false; env.meNudgeTimes_ = () => [];

// A slow run: the inbox takes five minutes.
slow = 5 * 60000;
env.housekeepingTick_();
const iClose = order.indexOf('closeout:elizabeth'), iInbox = order.indexOf('inbox');
ok('2:31pm: Elizabeth\'s close-out goes', iClose > -1, order.join(', '));
ok('and before the inbox, the game and the ratings', iClose > -1 && iInbox > -1 && iClose < iInbox);
ok('Azariah\'s is not due until 3:30', order.indexOf('closeout:azariah') === -1);
ok('marked sent, so the next run does not send it again', !!P.getProperty('hkv2_elizabeth_' + DAY));
ok('past the budget the game and the ratings wait for the next run', order.indexOf('game') === -1 && order.indexOf('rate') === -1, order.join(', '));
ok('the run\'s length is kept', /over budget/.test(P.getProperty('tick_last') || '') && /s at 14:31/.test(P.getProperty('tick_long_' + DAY) || ''), P.getProperty('tick_last') + ' | ' + P.getProperty('tick_long_' + DAY));
ok('showRunLog says so', /Last run: 14:31 \d+s \(over budget/.test(env.showRunLog()) && /Longest run today/.test(env.showRunLog()));

// A quick run ten minutes later: nothing twice, and the catch-up work runs.
NOW = new Date(DAY + 'T14:41:00').getTime(); slow = 0; order = [];
env.resetRequestMemo_ && env.resetRequestMemo_(); env.forgetHr_(env.ATT);
env.housekeepingTick_();
ok('2:41pm: no second close-out', order.indexOf('closeout:elizabeth') === -1, order.join(', '));
ok('and the game and the ratings run', order.indexOf('game') > -1 && order.indexOf('rate') > -1);

// The progress check, half an hour before her lunch, also ahead of the heavy work.
NOW = new Date(DAY + 'T11:31:00').getTime(); slow = 5 * 60000; order = [];
P.deleteProperty ? P.deleteProperty('inbox_hr') : P.setProperty('inbox_hr', '');
env.resetRequestMemo_ && env.resetRequestMemo_(); env.forgetHr_(env.ATT);
env.housekeepingTick_();
ok('11:31am: her progress check goes, before the inbox', order.indexOf('progress:elizabeth') > -1 && order.indexOf('progress:elizabeth') < order.indexOf('inbox'), order.join(', '));

// The innovation board goes before the branch meeting, which is Wednesday 9:00 since 21 Oct 2026 (2026-10-21h), not Friday.
let boards = [];
env.sendInnovationBoard_ = d => { boards.push(d); return true; };
const boardAt = (day, hm) => {
  env.todayISO_ = () => day; NOW = new Date(day + 'T' + hm + ':00').getTime(); slow = 0; order = [];
  env.resetRequestMemo_ && env.resetRequestMemo_(); env.forgetHr_(env.ATT);
  env.housekeepingTick_();
};
boardAt('2026-10-23', '07:31');
ok('Friday 7:31: no innovation board (there is no Friday meeting)', boards.length === 0, boards.join());
boardAt('2026-10-21', '07:21');
ok('Wednesday 7:21: not yet', boards.length === 0, boards.join());
boardAt('2026-10-21', '07:31');
ok('Wednesday 7:31: the innovation board, before the 9:00 meeting', boards.join() === '2026-10-21', boards.join());
boardAt('2026-10-21', '07:41');
ok('once', boards.length === 1);
env.todayISO_ = () => DAY;

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
