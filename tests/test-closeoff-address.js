// A close-off with no address is not a close-off sent (19 October 2026).
//
// Azariah and Liz were on the Acess tab with column A empty. At 4:07 the
// close-off ran, found no address, sent nothing, and still marked the day
// "sent 16:07", so running it again later said "already sent" and nobody,
// sales support included, ever got a copy.
//
// Pinned here: with no address the log says NOT sent and the day stays open;
// once the address is in, the next run sends and marks it; a second run then
// says already sent; resendCloseOffNow sends again even when marked.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-19';
env.todayISO_ = () => DAY;
env.minutesOf_ = () => 16 * 60 + 30;       // 4:30pm, past both finishes
const rows = (azEmail) => [['ricky@example.com', 'A00427 - Ricky Rampersad', 'A00427', 'p1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
  [azEmail, 'AG-003 - Azariah Griffith', 'AG003', 'p5', 'Staff', 'Azariah Griffith', 'Active'],
  ['', 'EL -004 - Elizabeth lee', 'EL004', 'p4', 'Staff', 'Elizabeth lee', 'Active']];
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], rows(''));
env.hrRows_ = () => [{ Date: DAY, StaffId: 'azariah', FirstSignIn: '08:00', Status: 'in' }, { Date: DAY, StaffId: 'elizabeth', FirstSignIn: '07:00', Status: 'in' }];
const sent = [];
const real = env.sendHousekeeping_;
env.sendHousekeeping_ = (p, day, s) => { const to = env.emailFor_(String(p.staffId)); if (!to) return real(p, day, s); sent.push(to); return true; };
const props = env.PropertiesService.getScriptProperties();

console.log('\nNo address on the Acess tab:\n');
let log = env.sendHousekeepingNow();
ok('the log says NOT sent, and why', /azariah: NOT sent, no e-mail address on the Acess tab/.test(log) && /elizabeth: NOT sent/.test(log), log.replace(/\n/g, ' | '));
ok('nothing went out', sent.length === 0);
ok('and the day is not marked sent', !props.getProperty('hkv2_azariah_' + DAY) && !props.getProperty('hkv2_elizabeth_' + DAY));

console.log('\nThe address goes in:\n');
env.resetRequestMemo_ && env.resetRequestMemo_();
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], rows('azariah@example.com'));
if (typeof env._rosterMemo !== 'undefined') env._rosterMemo = null;
log = env.sendHousekeepingNow();
ok('the next run sends it, and names the address', /azariah: sent to azariah@example.com/.test(log) && sent.join() === 'azariah@example.com', log.replace(/\n/g, ' | '));
ok('and only then marks the day', !!props.getProperty('hkv2_azariah_' + DAY) && !props.getProperty('hkv2_elizabeth_' + DAY));
log = env.sendHousekeepingNow();
ok('run again: already sent, nothing doubled', /azariah: already sent/.test(log) && sent.length === 1);

console.log('\nresendCloseOffNow:\n');
log = env.resendCloseOffNow();
ok('sends again even when marked', /azariah: sent to/.test(log) && sent.length === 2, log.replace(/\n/g, ' | '));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
