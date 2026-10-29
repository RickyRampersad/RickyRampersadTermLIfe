// Every e-mail button opens My workday at its place (29 October 2026, 2026-10-29d).
//
// Ricky, 9:21am, on a white page opened from a reminder: "on all the reminder emails, should this not open up the same way as the
// morning to show the progress and back on track with all the AI built into it?" Pinned here: the link carries the place
// (go) and a task (t); Pawan's and the unit managers' buttons keep their own pages; the full page stays a tap below for the
// staff; and each reminder that used to open a white page now opens the one screen: the close-out notice, the check after it and
// the finish reminder at Close my day, the midday update at the coach, work moved to you at New for you today, his replies at
// what waits on him, the late plan nudge at check-in.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
const DAY = '2026-10-29';
env.todayISO_ = () => DAY;
console.log('\nThe links:\n');
const u = env.workGoUrl_('sasha', 'close');
ok('My workday, her own signed link, at Close my day', u.indexOf(env.workUrl_('sasha')) === 0 && /&go=close$/.test(u), u);
ok('a task\'s card too', /&go=news&t=00T123$/.test(env.workGoUrl_('sasha', 'news', '00T123')));
ok('Pawan and Akaash keep their own pages', /f=hk/.test(env.wdGoUrl_('pawan', DAY, 'close', 'hk')) && /f=um/.test(env.wdGoUrl_('akaash', DAY, 'list', 'um')) && /myworkday/.test(env.wdGoUrl_('azariah', DAY, 'close', 'hk')));
ok('the full page a tap below for the staff, not for Pawan', /the same on the full page/.test(env.wdOldLine_('sasha', 'X')) && env.wdOldLine_('pawan', 'X') === '');
console.log('\nEach reminder:\n');
const src = f => env[f].toString();
ok('the close-out notice: Close my day on My workday', /wdGoUrl_\(sid, day, 'close', 'hk'\), 'Close my day and sign out'/.test(src('sendHousekeeping_')) && !/replyButton_\(replyUrl_\(sid, day, 'hk'\)/.test(src('sendHousekeeping_')));
ok('the check after it', /wdGoUrl_\(sid, day, 'close', 'hk'\), 'Answer them now'/.test(src('closeoutCheck_')) && !/replyButton_\(replyUrl_\(sid, day, 'hk'\)/.test(src('closeoutCheck_')));
ok('the finish reminder (Pawan: his errands)', /workGoUrl_\(sid, 'close'\)/.test(src('notClosedReminder_')) && /'errand'/.test(src('notClosedReminder_')));
ok('the midday update: the coach, the progress page a tap below', /wdGoUrl_\(sid, day, 'update', 'prog'\), 'Update on My workday'/.test(src('sendMidday_')) && /the progress page/.test(src('sendMidday_')));
ok('work moved to you: New for you today', /wdGoUrl_\(sid, day, 'news', 'plan'\)/.test(src('coverMail_')) && /wdGoUrl_\(sid, day, 'news', 'plan'\)/.test(src('rebalanceMail_')));
ok('his replies: what waits on him, morning, evening and 3:45', /workGoUrl_\('ricky', 'waiting'\)/.test(src('sendBranchManagerDay_')) && /workGoUrl_\('ricky', 'waiting'\)/.test(src('sendBranchManagerProgress_')) && /workGoUrl_\('ricky', 'waiting'\)/.test(src('bmCloseoutCheck_')));
ok('the late plan nudge: check in on My workday', /wdGoUrl_\(sid, day, '', 'plan'\), 'Check in and start my day'/.test(src('nudgeReplySave_')));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
