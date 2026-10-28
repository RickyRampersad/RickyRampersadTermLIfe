// My workday, the tracker's side (23 October 2026).
//
// Ricky, 8:59am: "make my day easy to use ... through a link ... rickyrampersadbranch/myworkday ... open faster and stream motion, charts
// and graphics"; 9:03: "this will apply to all persons"; 9:06: "the top of the page should have a progress bar for effectiveness ... so the
// check in will show what was achieved". Pinned here:
//   - one link per person, signed; a wrong key gets nothing;
//   - the day as JSON: the progress the progress-check e-mail counts (closed against the day's number, the share of the working day gone,
//     the pace), the register, what was achieved (each close with or without a note; his notes and e-mails too), next up oldest first,
//     five days of bars, and the team for him and the BMA;
//   - doGet answers wd= with JSON before any page route; doPost checks in on the same register as the day page;
//   - the morning e-mails carry the link.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-23';
env.todayISO_ = () => DAY;
env.runlog_ = () => {};
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Support', 'Yes']]);
env.__mkSheet('Attendance', 2, env.ATT.head, [[DAY, 'sasha', 'Sasha Lalla-Jagassar', '07:09', '', '', 'in', '', 'sasha', '']]);
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, sasha: { id: '005S' }, kamla: { id: '005K' } });
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
env.sfkDayFor_ = sid => sid === 'sasha' ? { closed: [{ id: '00T1', subject: 'Premium due - 5001 JOHN DOE', noted: true }, { id: '00T2', subject: 'Orphan response - 5002 JANE ROE', noted: false }], created: 1, notes: 3, lastAt: 10 * 60 + 41 }
  : { closed: [], created: 0, notes: 0, lastAt: null };
env.sfkOpenBook_ = () => ({ sasha: { Servicing: [{ id: '00T9', subject: 'Change of address', due: '2026-10-12', late: true }, { id: '00T8', subject: 'Statement request', due: DAY, late: false }],
  Pendings: [{ id: '00T7', subject: 'Medical requirement', due: '2026-10-20', late: true }] } });
const P = env.PropertiesService.getScriptProperties();
P.setProperty(env.intelTargetKey_('sasha', DAY), '8');
P.setProperty('intel_plan_sasha_' + DAY, JSON.stringify(['00T1', '00T5']));
env.sfkQuery_ = q => /LastModifiedDate FROM Task WHERE OwnerId = '005S'/.test(q) ? [{ LastModifiedDate: '2026-10-19T15:00:00.000Z' }, { LastModifiedDate: '2026-10-22T15:00:00.000Z' }, { LastModifiedDate: '2026-10-22T16:00:00.000Z' }] : [];
env.hhmm_ = () => '10:30';

console.log('\nOne link per person:\n');
const url = env.workUrl_('sasha');
ok('on the branch\'s own site, signed', /^https:\/\/rickyrampersadbranch\.com\/myworkday\/\?p=sasha&k=[A-Za-z0-9_-]{22}$/.test(url), url);
ok('a different key for each person', env.workSig_('sasha') !== env.workSig_('kamla') && env.workSig_('sasha') !== env.unitSig_('sasha'));
ok('a wrong key gets nothing', env.workdayGet_({ wd: 'sasha', k: 'nope' }).ok === false);
ok('every person\'s link, from the editor', /Sasha Lalla-Jagassar: https:\/\/rickyrampersadbranch\.com\/myworkday\/\?p=sasha/.test(env.showWorkdayLinks()) && /Ricky Rampersad: /.test(env.showWorkdayLinks()));

console.log('\nThe day as JSON:\n');
const m = env.workdayGet_({ wd: 'sasha', k: env.workSig_('sasha') });
ok('it answers', m.ok === true && m.first === 'Sasha' && m.day === DAY && m.v === env.SCRIPT_VERSION, m.error || '');
ok('the progress bar: closed against the day\'s number, as the progress check counts', m.progress.closed === 2 && m.progress.target === 8 && m.progress.pct === 25, JSON.stringify(m.progress));
ok('and how much of the working day has gone, and the pace', m.progress.dayPct > 0 && m.progress.dayPct < 100 && m.progress.behind === true && m.progress.proj >= 2, m.progress.dayPct + '% · proj ' + m.progress.proj);
ok('with and without a note; overdue, due today; the last entry; the morning\'s plan', m.progress.noted === 1 && m.progress.unnoted === 1 && m.progress.overdue === 2 && m.progress.dueToday === 1 && m.progress.lastAt === '10:41am' && m.progress.plan === 2 && m.progress.planDone === 1, JSON.stringify(m.progress));
ok('nothing private to the server leaks into the progress', !('_closed' in m.progress) && !('_all' in m.progress));
ok('the register: in at 7:09, late after the grace', m.checkin.at === '7:09am' && m.checkin.late === 9 && m.checkin.status === 'in', JSON.stringify(m.checkin));
ok('what was achieved: each close, the newest first, with or without a note', m.achieved.length === 2 && m.achieved[0].noted === false && /JANE ROE/.test(m.achieved[0].s) && m.achieved[1].noted === true);
ok('next up: overdue oldest first, then due today, each to its task', m.next.length === 3 && /Change of address/.test(m.next[0].s) && m.next[0].late && /Medical/.test(m.next[1].s) && !m.next[2].late && m.next[0].url === 'https://sf.example/00T9');
ok('five working days of bars, today last', m.bars.length === 5 && m.bars[4].d === DAY && m.bars.filter(b => b.d === '2026-10-22')[0].n === 2 && m.bars.filter(b => b.d === '2026-10-19')[0].n === 1, JSON.stringify(m.bars));
ok('her full day page behind it', /f=plan/.test(m.full) && /rs=sasha/.test(m.full));
ok('no team for a desk', Array.isArray(m.team) && m.team.length === 0);
const rk = env.workdayGet_({ wd: 'ricky', k: env.workSig_('ricky') });
ok('for him: the team today, and My day behind it', rk.ok && rk.team.length >= 1 && rk.team.filter(t => t.sid === 'sasha')[0].at === '7:09am' && /f=unit/.test(rk.full) && rk.fullLabel === 'Open My day', JSON.stringify(rk.team && rk.team[0]));

console.log('\nThe web app:\n');
const got = env.doGet({ parameter: { wd: 'sasha', k: env.workSig_('sasha') } });
const txt = got && got.getContent ? got.getContent() : String(got);
ok('doGet answers wd= with JSON', /"ok":true/.test(txt) && /"first":"Sasha"/.test(txt), txt.slice(0, 120));
let sd = 0, si = 0;
env.sdCheckin_ = (person, day) => { sd++; return { at: '07:12', first: true }; };
env.signInFromPage_ = person => { si++; return { at: '05:02', first: true }; };
env.dayLogMany_ = () => 1;
const post = env.doPost({ parameter: { wd: 'sasha', k: env.workSig_('sasha'), act: 'checkin' }, postData: { contents: 'wd=sasha' } });
const ptxt = post && post.getContent ? post.getContent() : String(post);
ok('doPost checks a desk in on the day page\'s register, and sends the day back', sd === 1 && /"checkedIn":\{"at":"7:12am","first":true\}/.test(ptxt) && /"progress"/.test(ptxt), ptxt.slice(0, 160));
env.workdayPost_({ wd: 'ricky', k: env.workSig_('ricky'), act: 'checkin' });
ok('and him on his', si === 1 && sd === 1);
ok('a wrong key checks nobody in', env.workdayPost_({ wd: 'sasha', k: 'x', act: 'checkin' }).ok === false && sd === 1);

console.log('\nThe morning e-mails:\n');
ok('carry the link', /rickyrampersadbranch\.com\/myworkday\/\?p=sasha/.test(env.workdayMailLine_('sasha')) && /save it to your home screen/.test(env.workdayMailLine_('sasha')));
const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'KPI.gs'), 'utf8');
// 27 Oct 2026: the big button itself opens My day, in his 5:00 and in each desk's morning e-mail; the Google page is a small link.
ok('in his 5:00 and in each desk\'s morning e-mail, the big button opens My day', /replyButton_\(workUrl_\('ricky'\), 'Check in and start my day'/.test(src) && /sysDay \? replyButton_\(workUrl_\(staffId\)/.test(src) && /workdayMailFull_\(unitUrl_\('ricky'\)/.test(src) && /workdayMailFull_\(replyUrl_\(staffId, date, 'plan'\)/.test(src));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
