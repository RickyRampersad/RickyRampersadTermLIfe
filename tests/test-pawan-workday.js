// Pawan's morning e-mail carries his My workday link (26 October 2026).
//
// Ricky, 4:39pm, with Pawan's "Close my day" link open in his own Chrome: "See whats happeing to Pawan". Google Drive:
// "Sorry, unable to open the file at this time". The ping (a JSON answer) opened in the same window. A page the tracker
// draws will not open in a browser signed in to more than one Google account; My workday (JSON, on the branch's site) will.
// Pawan's e-mail was the one morning e-mail without the My workday line.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-27';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], [
  ['ricky@example.com', 'A00427 - Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
  ['support@example.com', 'PB001-Pawan Prabhu', 'PB001', '1', 'Staff', 'PAWAN PRABHU', 'Active']]);
env.__mkSheet('Attendance', 2, env.ATT.head, []);
const mails = [];
env.mailSend_ = o => { mails.push(o); return 'relay'; };
env.pawanItems_ = () => ({ events: [], tasks: [] });
env.sfkEventsFor_ = () => [];
env.sfkConfigured_ = () => false;
let threw = '';
try { env.sendPawanDay_(DAY, 'first'); } catch (e) { threw = e.message; }
const m = mails[0] || {};
ok('the morning e-mail goes', !threw && !!m.htmlBody, threw);
const link = h => String(h || '').indexOf(env.WORKDAY.SITE + '?p=pawan&amp;k=') > -1 || String(h || '').indexOf(env.WORKDAY.SITE + '?p=pawan&k=') > -1;
ok('it carries his My workday link', link(m.htmlBody));
// 27 Oct 2026: the morning's big button is My day itself (it checks him in on any phone); the errand page is a small link.
ok('the morning\'s big button is My day, the errands a small link', /Check in and start my day/.test(m.htmlBody || '') && /today&#39;s run, to confirm each errand|today's run, to confirm each errand/.test(m.htmlBody || ''));
mails.length = 0; env.sendPawanDay_(DAY, 'midday');
ok('the midday e-mail keeps the errand button, and says what to do when it will not open', /Mark what is done/.test((mails[0] || {}).htmlBody || '') && /unable to open the file/.test((mails[0] || {}).htmlBody || '') && link((mails[0] || {}).htmlBody));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
