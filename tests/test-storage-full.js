// The tracker's storage, kept from filling (26 October 2026).
//
// Ricky, 7:57am: "please see kamla message - Not seeing my day's email to check in"; 8:02, Azariah the same.
// Script Properties were full (about 500 KB): the AI reviews and drafts (bm_deep_, ix_deep_) were kept three weeks.
// The morning e-mail's "being built" mark could not be saved, the run's try/catch swallowed it, and nothing was logged.
// Pinned here:
//   - with the store full of old AI reviews, the morning e-mails still go (the save clears them and tries again)
//   - a failure the loop catches is logged by desk
//   - sdPrune_ drops the AI reviews after their own day and the big day caches after three; small marks keep 21 days
//   - bigPut_ on a full store clears and saves
//   - ten minutes after a start with no morning e-mail, Mr Rampersad is told once
//   - showRunLog says how full the store is
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-26';
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = new Date(DAY + 'T07:32:00').getTime();
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW); }, get(t, k) { return k === 'now' ? () => NOW : t[k]; } });
const at = hm => { NOW = new Date(DAY + 'T' + hm + ':00').getTime(); env.resetRequestMemo_ && env.resetRequestMemo_(); env.forgetHr_(env.ATT); };
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], [
  ['ricky@example.com', 'A00427 - Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
  ['azariah@example.com', 'AG-003 - Azariah Griffith', 'AG003', '3', 'Staff', 'Azariah Griffith', 'Active'],
  ['liz@example.com', 'EL -004 - Elizabeth lee', 'EL004', '4', 'Staff', 'Elizabeth lee', 'Active'],
  ['kamla@example.com', 'KD001 - KAMLA DOOKRAN', 'KD001', '1', 'Staff', 'KAMLA DOOKRAN', 'Active'],
  ['sasha@example.com', 'SL002 - SASHA LALLA', 'SL002', '2', 'Staff', 'SASHA LALLA', 'Active'],
  ['support@example.com', 'PB001-Pawan Prabhu', 'PB001', '1', 'Staff', 'PAWAN PRABHU', 'Active']]);
env.__mkSheet('Attendance', 2, env.ATT.head, []);
const P = env.PropertiesService.getScriptProperties();

// Google's limit, as the store sees it.
const CAP = 500 * 1024, realSet = P.setProperty.bind(P);
const used = () => { const o = P.getProperties(); return Object.keys(o).reduce((n, k) => n + k.length + String(o[k]).length, 0); };
P.setProperty = (k, v) => { const cur = P.getProperty(k); const after = used() - (cur != null ? k.length + String(cur).length : 0) + k.length + String(v).length;
  if (after > CAP) throw new Error('You have exceeded the property storage quota. Please remove some properties and try again.'); return realSet(k, v); };
const piece = 'x'.repeat(7990);
const fill = () => {
  for (let i = 0; i < 30; i++) realSet('bm_deep_2026-10-23' + (i ? '_' + i : ''), piece);
  realSet('bm_deep_2026-10-23_n', '30');
  for (let i = 0; i < 25; i++) realSet('ix_deep_2026-10-22' + (i ? '_' + i : ''), piece);
  for (let i = 0; i < 6; i++) realSet('bm_deep_2026-10-26' + (i ? '_' + i : ''), piece);
  for (let a = 0; a < 3; a++) realSet('ag_items_a' + a + '_2026-10-16', piece.slice(0, 2000));
  realSet('ag_items_a9_2026-10-24', 'keep');
  realSet('daystart_first_kamla_2026-10-16', '07:31');
  realSet('cover_back_sasha', '{}');
  // To the brim, the way the live store was at 6:30.
  let i = 30; while (used() < CAP - 9000) realSet('bm_deep_2026-10-23_' + (i++), piece);
  realSet('ix_deep_2026-10-23_brim', 'z'.repeat(Math.max(1, CAP - used() - 2)));
};
fill();
ok('the store starts full', (() => { try { P.setProperty('zz', '1'); P.deleteProperty('zz'); return false; } catch (e) { return true; } })(), Math.round(used() / 1024) + ' KB');

let built = [], mails = [];
env.dayStartBuildSend_ = (sid) => { built.push(sid); return true; };
env.mailSend_ = o => { mails.push(o); return 'relay'; };
env.hkSend_ = () => true; env.sendMidday_ = () => true; env.inboxOn_ = () => false;
['agentTick_', 'ffChaseTick_', 'coverTick_', 'gameTick_', 'rateTick_', 'autoAbsentTick_'].forEach(f => { env[f] = () => []; });
['sendBranchManagerDay_', 'sendMeNudge_', 'sendBranchManagerProgress_', 'notClosedReminder_', 'markNotClosed_', 'sendMailbagCall_', 'sendBmaReport_',
 'sendAttendanceReport_', 'sendInnovationBoard_', 'sendTeamBoard_', 'sendUnitManagerProgress_', 'sendUnitManagerMorning_', 'sendUnitManagerEvening_',
 'closeoutCheck_', 'bmCloseoutCheck_', 'sendLunchOff_'].forEach(f => { env[f] = () => false; });
env.rebalanceTick_ = () => ''; env.chaseOn_ = () => false; env.meNudgeTimes_ = () => [];
P.setProperty = ((set) => set)(P.setProperty);
realSet('sd_prune', DAY);   // the day's prune has run: the save itself has to cope

console.log('\nA full store does not stop the morning e-mails:\n');
at('07:32'); env.housekeepingTick_();
ok('7:32: Kamla, Azariah, Liz built', ['kamla', 'azariah', 'elizabeth'].every(s => built.indexOf(s) > -1), built.join(', '));
ok('their marks say sent', ['kamla', 'azariah', 'elizabeth'].every(s => /^\d\d:\d\d$/.test(P.getProperty('daystart_first_' + s + '_' + DAY) || '')));
ok('Friday\'s AI drafts are gone', !P.getProperty('bm_deep_2026-10-23') && !P.getProperty('bm_deep_2026-10-23_5') && !P.getProperty('bm_deep_2026-10-23_n'));
ok('Thursday\'s inbox review is gone', !P.getProperty('ix_deep_2026-10-22'));
ok('today\'s AI drafts are kept', !!P.getProperty('bm_deep_2026-10-26') && !!P.getProperty('bm_deep_2026-10-26_5'));
ok('the run log says why', /storage[^\n]*\d+ old values cleared/.test(P.getProperty('RUNLOG') || ''), (P.getProperty('RUNLOG') || '').split('\n').filter(l => /storage/.test(l))[0] || '');
at('07:42'); built = []; env.housekeepingTick_();
ok('7:42: Pawan built', built.indexOf('pawan') > -1, built.join(', '));

console.log('\nThe clean-up rules:\n');
realSet('ix_deep_2026-10-25', 'old'); realSet('lead_2026-10-21', 'old'); realSet('intel_model_kamla_2026-10-22', 'old'); realSet('intel_model_kamla_2026-10-23', 'keep');
realSet('um_items_ricky_2026-10-20_eve_ai', 'old'); realSet('hkv2_kamla_2026-10-20', '16:22'); realSet('daystart_first_sasha_2026-09-30', '06:31');
env.sdPrune_(DAY);
ok('an AI review from yesterday goes', !P.getProperty('ix_deep_2026-10-25'));
ok('big day caches older than three days go', !P.getProperty('lead_2026-10-21') && !P.getProperty('intel_model_kamla_2026-10-22') && !P.getProperty('um_items_ricky_2026-10-20_eve_ai') && !P.getProperty('ag_items_a0_2026-10-16'));
ok('big day caches inside three days stay', P.getProperty('intel_model_kamla_2026-10-23') === 'keep' && P.getProperty('ag_items_a9_2026-10-24') === 'keep');
ok('small marks keep three weeks', P.getProperty('hkv2_kamla_2026-10-20') === '16:22' && P.getProperty('daystart_first_kamla_2026-10-16') === '07:31');
ok('marks past three weeks go', !P.getProperty('daystart_first_sasha_2026-09-30'));
ok('keys without a date are never touched', P.getProperty('cover_back_sasha') === '{}');

console.log('\nbigPut_ on a full store:\n');
for (let i = 0; i < 60; i++) realSet('ix_deep_2026-10-23' + (i ? '_' + i : ''), piece);
let threw = '';
try { env.bigPut_('ix_deep_' + DAY, { big: 'y'.repeat(20000) }); } catch (e) { threw = e.message; }
ok('saved after clearing', !threw && !!P.getProperty('ix_deep_' + DAY + '_2'), threw);

console.log('\nA timed send on a full store: no throw, and marked:\n');
for (let i = 0; i < 70; i++) realSet('bm_deep_2026-10-22_' + i, piece);
realSet('ix_deep_2026-10-22_brim', 'z'.repeat(Math.max(1, CAP - used() - 2)));
let sends = 0, tErr = '';
try { env.timedSend_(P, 'mbcall_' + DAY, new Date(), () => { sends++; return true; }); env.timedSend_(P, 'mbcall_' + DAY, new Date(), () => { sends++; return true; }); } catch (e) { tErr = e.message; }
ok('no throw, the mark saved', !tErr && /^\d\d:\d\d$/.test(P.getProperty('mbcall_' + DAY) || ''), tErr);

console.log('\nA morning e-mail that cannot go: he is told, once:\n');
const NOW0 = NOW;
P.deleteProperty('daystart_first_pawan_' + DAY); P.deleteProperty('daystart_pawan_' + DAY);
env.dayStartBuildSend_ = (sid) => { throw new Error('Salesforce did not answer'); };
mails = [];
at('08:05'); env.housekeepingTick_();
ok('8:05: the failure is logged by desk', /morning pawan FAILED 08:05: Salesforce did not answer/.test(P.getProperty('RUNLOG') || ''));
ok('8:05: nobody told yet (inside ten minutes)', !mails.some(m => /morning e-mail not gone/.test(m.subject)));
at('08:12'); env.housekeepingTick_();
const alert = mails.filter(m => /morning e-mail not gone/.test(m.subject));
ok('8:12: Mr Rampersad told', alert.length === 1 && /Pawan/.test(alert[0].subject), alert.map(m => m.subject).join(' | '));
ok('the alert carries the reason', alert[0] && /Salesforce did not answer/.test(alert[0].htmlBody));
ok('the alert goes to him alone', alert[0] && alert[0].to === 'ricky@example.com', alert[0] && alert[0].to);
at('08:22'); env.housekeepingTick_();
ok('8:22: not told twice', mails.filter(m => /morning e-mail not gone/.test(m.subject)).length === 1);
ok('a desk whose e-mail went is not in it', alert[0] && !/Kamla|Azariah/.test(alert[0].subject));

console.log('\nshowRunLog:\n');
ok('says how full the store is', /Storage: \d+ KB of about 500/.test(env.showRunLog()));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
