// Marked absent by a manager, before the day starts or during it (29 October 2026, 2026-10-29c).
//
// Ricky, 7:39am: "if a staff is not out or whats app and a staff is saying they are not well and will not be out the BMA or
// Branch Manger should have the ability to mark Absent and triggers follow and auto reassignments before the day starts, also a
// trigger to the employee noting the non attendance for the record copying the staff as to the outstanding workload and the
// redistribution to all as well the BMA on urgent matter also wishing the person well ... azariah said she will not be out today".
// Pinned here:
//   - before her day starts, Kamla's My day can mark Azariah (her cell reads "wait" and is hers to mark);
//   - the mark moves the due and overdue work with no note there and then, to the desks due in today though nobody is in yet,
//     money and claims to the BMA first; what she wrote on stays; what is due on her return gets ACTION REQUIRED;
//   - one notice: to her, for the record (the date, absent, the reason, who marked it and when), with good wishes for a sickness;
//     copied to the staff at work today, the BMA, the Branch Manager and the support inbox; her work in numbers, who now has what,
//     what is urgent for the BMA, what is due on her return; no personal link in it; once a day;
//   - no "Covering for" e-mails and no "While you are out" beside it; the Branch Manager's summary, with Undo, still goes;
//   - the clock does not cover her again at 8:00; marked again, no second notice;
//   - the clock first, the manager after: the notice says what the clock moved;
//   - Pawan (no cover), Kamla away (urgent to Mr Rampersad), leave (its own words), yesterday (no cover, no notice).
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-29';                 // a Thursday
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = new Date(DAY + 'T07:40:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); }, get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const at = hm => { NOW = new realDate(DAY + 'T' + hm + ':00'); env.resetRequestMemo_ && env.resetRequestMemo_(); };
const M = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes'],
   ['Pawan Probhu', 'pawan', 'pawan@example.com', '1', 'Personal Assistant', 'Branch', 'Yes']]);
env.__mkSheet('Attendance', 2, env.ATT.head, []);
env.__mkSheet('Workload Moves', 3, env.MOVES.head, []);
env.__mkSheet('Block Plans', 4, env.BPLAN.head, []);
const P = env.PropertiesService.getScriptProperties();
P.setProperty('MANAGER_EMAIL', 'ricky@example.com');
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, sasha: { id: '005S' }, elizabeth: { id: '005E' }, azariah: { id: '005A' }, kamla: { id: '005K' }, pawan: { id: '005P' } });
env.sfkConfigured_ = () => true;
env.intelFor_ = () => ({ pace: 10 });
const id = (p, n) => '00TABS' + p + String(n).padStart(9, '0');
const task = (p, n, ty, extra) => Object.assign({ id: id(p, n), subject: p + ' client task ' + n, due: '2026-10-27', late: true, ty }, extra || {});
let BOOK = {}, NOTED = [];
env.sfkOpenBook_ = () => JSON.parse(JSON.stringify(BOOK));
env.sfkQuery_ = q => /FROM FeedItem WHERE Type = 'TextPost'/.test(q) ? NOTED.filter(x => q.indexOf(x) > -1).map(x => ({ ParentId: x })) : [];
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'FEED'; };
const applied = [];
env.rebalanceApply_ = (day, moves) => moves.map(m => {
  applied.push(m);
  Object.keys(BOOK[m.from] || {}).forEach(ty => { BOOK[m.from][ty] = BOOK[m.from][ty].filter(t => t.id !== m.t.id); });
  env.moveLog_({ Date: day, At: env.hhmm_(new Date()), TaskId: m.t.id, Subject: m.t.subject, Type: m.t.ty || '', From: m.from, To: m.to, Why: m.why, Result: 'OK' });
  return Object.assign({}, m, { ok: true });
});
env.coverAbsorb_ = () => {};
env.workdayModel_ = (sid, day) => ({ ok: true, sid, day });
let who = 'kamla';
env.wdAuth_ = () => ({ sid: who });
const mark = (by, o) => { who = by; return env.workdayPost_(Object.assign({ wd: by, k: 'K', act: 'absent' }, o)); };
const BOOK0 = () => ({ azariah: {
  'Pendings': [1, 2, 3, 4, 5, 6].map(n => task('A', n, 'Pendings')).concat([task('A', 9, 'Pendings'), task('A', 10, 'Pendings', { late: false, due: '2026-10-30' })]),
  'Renewa/PDl/Bill': [7, 8].map(n => task('A', n, 'Renewa/PDl/Bill', { late: false, due: DAY })) } });

console.log('\nBefore her day starts, Kamla marks Azariah sick:\n');
BOOK = BOOK0(); NOTED = [id('A', 9)];
const cellNow = (sid) => { const A = env.workdayAtt_('kamla', DAY); const i = A.days.findIndex(d => d.d === DAY); const d = A.desks.find(x => x.sid === sid); return { c: d.cells[i], mark: d.mark }; };
ok('7:40, her day starts at 8: her cell waits, and Kamla may mark it', cellNow('azariah').c.st === 'wait' && cellNow('azariah').mark === true, JSON.stringify(cellNow('azariah')));
let r = mark('kamla', { who: 'azariah', date: DAY, why: 'Sick' });
ok('marked, and the page is told what happened', r.ok && r.marked && r.marked.moved === 8 && r.marked.mailed === true && r.marked.asked === 1, JSON.stringify(r.marked));
const row = sid => env.sheetObjects_(env.attSheet_()).find(x => String(x.StaffId) === sid && env.isoDay_(x.Date) === DAY) || {};
ok('the register: absent, Sick, by Kamla', row('azariah').Status === 'absent' && row('azariah').Reason === 'Sick' && row('azariah').MarkedBy === 'kamla');
ok('the work moved now, before anyone is in: to Sasha, Liz and Kamla, the money to Kamla', applied.length === 8 && applied.filter(m => m.t.ty === 'Renewa/PDl/Bill').every(m => m.to === 'kamla') && applied.filter(m => m.t.ty === 'Pendings').every(m => m.to === 'sasha' || m.to === 'elizabeth') && applied.some(m => m.to === 'sasha') && applied.some(m => m.to === 'elizabeth'), applied.map(m => m.t.id.slice(-2) + '>' + m.to).join(' '));
ok('what she wrote on stays with her; what is due tomorrow gets ACTION REQUIRED', !applied.some(m => m.t.id === id('A', 9)) && posts.some(p => p[1].ParentId === id('A', 10) && /^ACTION REQUIRED · Azariah Griffith/.test(p[1].Body)));
ok('so the clock does not cover her again at 8', P.getProperty('cover_azariah_' + DAY) === '07:40');

console.log('\nThe notice:\n');
const note = mails.filter(m => m.to === 'azariah@example.com');
ok('one e-mail to her', note.length === 1, mails.map(m => m.to + ' | ' + m.subject).join(' // '));
const n = note[0], cc = String(n.cc || '').split(',');
ok('copied to the staff at work today, the BMA, the Branch Manager and the support inbox', ['sasha@example.com', 'liz@example.com', 'kamla@example.com', 'pawan@example.com', 'ricky@example.com', env.DAYSTART_CC_DEFAULT].every(e => cc.indexOf(e) > -1) && cc.indexOf('azariah@example.com') < 0, n.cc);
ok('the subject: absent, and how much moved', n.subject === 'Azariah is absent today · 8 tasks moved to cover · Thu 29 Oct', n.subject);
const h = n.htmlBody;
ok('who marked it, and good wishes', /Azariah, Mrs Dookran has marked you absent today/.test(h) && /sorry to hear you are not well/.test(h) && /quick recovery/.test(h));
ok('for the record: the date, absent, the reason, by whom and when', /For the record/i.test(h) && />Absent</.test(h) && />Sick</.test(h) && /Mrs Dookran, 7:40am/.test(h) && /Thursday 29 October/.test(h), h.slice(h.indexOf('For the record'), h.indexOf('For the record') + 600));
ok('her work in numbers: 9 due or overdue, 8 moved, 1 stays, 1 asked', /<div[^>]*>9<\/div><div[^>]*>due or overdue/.test(h) && /<div[^>]*>8<\/div><div[^>]*>moved to colleagues/.test(h) && /<div[^>]*>1<\/div><div[^>]*>stay with Azariah/.test(h) && /<div[^>]*>1<\/div><div[^>]*>due on the return/.test(h));
ok('who now has what, by name', /NOW WITH SASHA \(\d\)|Now with Sasha \(\d\)/.test(h) && /Now with Elizabeth \(\d\)/.test(h) && /Now with Kamla \(2\)/.test(h));
ok('urgent, for the BMA: the money, and who has it', /Urgent, for Mrs Dookran/.test(h) && /Kamla, please see these are done today/.test(h) && (h.match(/Now with Kamla<\/div>/g) || []).length === 2);
ok('due on her return, with its note asked', /Due on Azariah&#39;s return|Due on Azariah's return/.test(h) && /A client task 10/.test(h));
ok('no personal link in it', !/k=|myworkday|f=plan|replyUrl/.test(h) && !/href=/.test(h));
ok('no "Covering for" and no "While you are out" beside it', !mails.some(m => /^Covering for/.test(m.subject)) && !mails.some(m => /^While you are out/.test(m.subject)));
const sum = mails.filter(m => /^Azariah absent · 8 covered/.test(m.subject));
ok('the Branch Manager\'s summary, with Undo, still goes to him', sum.length === 1 && sum[0].to === 'ricky@example.com' && /Undo any of these/.test(sum[0].htmlBody), mails.map(m => m.subject).join(' // '));

console.log('\nAfter:\n');
const m0 = mails.length;
at('08:00'); env.coverTick_(DAY, M('08:00'), {}, { azariah: 1 });
ok('8:00: the clock does not cover her again', applied.length === 8 && mails.length === m0);
at('08:15'); env.coverTick_(DAY, M('08:15'), { sasha: '07:58', elizabeth: '07:59', kamla: '08:01' }, { azariah: 1 });
ok('8:15, the second pass: nothing left to move, and no "While you are out"', applied.length === 8 && !mails.slice(m0).some(m => m.to === 'azariah@example.com'));
r = mark('ricky', { who: 'azariah', date: DAY, why: 'Sick (WhatsApp)' });
ok('marked again: the reason updated, no second notice', r.ok && r.marked.mailed === false && /already sent/.test(r.marked.mailWhy) && row('azariah').Reason === 'Sick (WhatsApp)' && mails.filter(m => m.to === 'azariah@example.com').length === 1);

console.log('\nThe clock first, the manager after:\n');
at('08:05');
BOOK = { elizabeth: { 'Pendings': [1, 2, 3].map(n => task('E', n, 'Pendings')) } }; NOTED = [];
P.setProperty('daystart_first_elizabeth_' + DAY, '07:30');
const abs = {}; env.autoAbsentTick_(DAY, M('08:05'), { sasha: '07:58' }, abs);
at('08:31'); env.coverTick_(DAY, M('08:31'), { sasha: '07:58' }, abs);
ok('the clock marked Liz at 8:05 and moved her work at 8:30', abs.elizabeth === 1 && applied.filter(m => m.from === 'elizabeth').length === 3);
at('08:40');
const before = mails.length;
r = mark('ricky', { who: 'elizabeth', date: DAY, why: 'Sick' });
const ln = mails.slice(before).filter(m => m.to === 'liz@example.com');
ok('Mr Rampersad marks her sick at 8:40: nothing moves twice, and the notice says what the clock moved', r.ok && r.marked.already === true && r.marked.moved === 3 && applied.filter(m => m.from === 'elizabeth').length === 3 && ln.length === 1 && /Mr Rampersad has marked you absent/.test(ln[0].htmlBody) && /Now with Sasha \(3\)/.test(ln[0].htmlBody), JSON.stringify(r.marked));

console.log('\nOthers:\n');
at('07:45');
let b2 = mails.length;
r = mark('ricky', { who: 'pawan', date: DAY, why: 'On leave' });
const pn = mails.slice(b2).filter(m => m.to === 'pawan@example.com');
ok('Pawan on leave: nothing of his moves, the notice goes with its own words', r.ok && r.marked.moved === 0 && pn.length === 1 && /covered while you are away/.test(pn[0].htmlBody) && /Mrs Dookran will arrange what cannot wait/.test(pn[0].htmlBody) && !/not well/.test(pn[0].htmlBody));
b2 = mails.length;
BOOK = { kamla: { 'Claims/ Mat': [task('K', 1, 'Claims/ Mat')], 'Lic/Staffing/SA/HR': [task('K', 2, 'Lic/Staffing/SA/HR')] } };
r = mark('ricky', { who: 'kamla', date: DAY, why: 'Medical appointment' });
const kn = mails.slice(b2).filter(m => m.to === 'kamla@example.com')[0];
ok('Kamla away: the urgent goes to Mr Rampersad, her own licensing work waits for her', kn && /Urgent, for Mr Rampersad/.test(kn.htmlBody) && !applied.some(m => m.t.id === id('K', 2)) && /sorry to hear you are not well/.test(kn.htmlBody), kn ? '' : 'no notice');
b2 = mails.length; const a0 = applied.length;
r = mark('ricky', { who: 'sasha', date: '2026-10-28', why: 'Sick' });
ok('yesterday: the register only, no cover, no notice', r.ok && r.marked.moved == null && mails.length === b2 && applied.length === a0);
ok('kept as a day\'s once-only mark', !!P.getProperty('absnote_azariah_' + DAY) && !!P.getProperty('absnote_kamla_' + DAY));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
