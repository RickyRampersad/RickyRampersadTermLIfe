// His leadership day, who wrote what in his name, posting from My workday, and closing off for lunch (23 October 2026).
//
// Ricky, 11:11: "i have opened mines and seeing 0% but i chattered a lot so how can this be framed?"; 11:14: "task has to be moved as
// staff waiting to be told what to do? so lets ensure we push a lot and advanced use of AI to guide and update, send also a trigger to
// close off to have lunch at 5 minutes before lunch". Pinned here:
//   - postWho_: a desk's note from her day page is hers, the tracker's notes are the system's, his own words are his, a run of his words
//     within minutes is the chase;
//   - bmWaiting_: a desk asking him on her day page reaches his list; the tracker's notes and the chase do not answer it; his words do;
//   - his bar: everything that waited on him, kept so the number does not shrink; cleared by him and by the team; the system apart;
//   - one tap posts his answer (only on what waits on him), or an inbox item's note;
//   - the day log keeps only his own notes;
//   - five minutes before lunch: one e-mail each, with the morning, the notes missing, what to do next, and the button.
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
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
const ME = '005R';
env.bmSfId_ = () => ME;
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ ricky: { id: ME }, sasha: { id: '005S' }, kamla: { id: '005K' }, elizabeth: { id: '005L' } });
env.managerEmails_ = () => ['ricky@example.com'];
const P = env.PropertiesService.getScriptProperties();
const T = hm => DAY + 'T' + hm + ':00.000+0000';

console.log('\nWho wrote it:\n');
const post = (body, at, by = ME, parent = '00TX') => ({ Id: '0D5' + Math.random().toString(36).slice(2, 8), ParentId: parent, CreatedById: by, CreatedDate: T(at), Body: body });
const W = env.postWho_, D = { '005S': 'sasha', '005K': 'kamla' };
ok('a desk\'s note from her day page is hers', W(post('<p>Sales Support · Sasha Lalla · Fri 23 Oct 7:06am</p><p>Mr Rampersad, which agent for Radicia?</p>', '11:06'), ME, D) === 'sasha');
ok('the tracker\'s own notes are the system\'s', ['Branch Intelligence · Fri 23 Oct 9:23am Sasha, the date moved', 'ACTION REQUIRED · Azariah Griffith. Posted', 'MOVED Fri 23 Oct. Elizabeth Lee is absent', 'FOLLOW-UP — Elizabeth Lee.', 'Moved from Kamla Dookran to Sasha', 'SERVICE RATING · 1 of 5', 'Sasha, this one is yours: Trishell'].every(b => W(post(b, '13:00'), ME, D) === 'system'));
ok('his own words, typed in Salesforce or from his page, are his', W(post('Kamla, send the CDD form today.', '13:00'), ME, D) === 'ricky' && W(post('Branch Manager · Ricky Rampersad · Fri 23 Oct 11:41am\n\nSasha, assign Fawwaz.', '15:41'), ME, D) === 'ricky');
ok('a desk on her own login is hers', W(post('Done, sent.', '13:00', '005K'), ME, D) === 'kamla');
const burst = ['11:05', '11:05', '11:05', '11:06', '11:06'].map(t => post('Liz, I asked you on Tuesday.', t)).concat([post('Kamla, thank you.', '14:30')]);
env.postWhoAll_(burst, ME, D);
ok('five of his within a minute or two is the chase; one alone later is his', burst.slice(0, 5).every(p => p.who === 'chase') && burst[5].who === 'ricky', burst.map(p => p.who).join(','));
const kinds = env.postSysKinds_(env.postWhoAll_([post('Branch Intelligence · Fri 23 Oct 9:23am x', '13:23'), post('MOVED Fri 23 Oct.', '12:42'), post('MOVED Fri 23 Oct.', '12:42')].concat(burst), ME, D));
ok('what the system did for him, by kind', kinds['questions from Branch Intelligence'] === 1 && kinds['absence handovers'] === 2 && kinds['chases in your voice'] === 5, JSON.stringify(kinds));

console.log('\nStaff waiting to be told what to do:\n');
let FEED = [];
env.sfkQuery_ = q => {
  if (/FROM Task WHERE OwnerId = '005R' AND IsClosed = false/.test(q)) return [{ Id: '00TM1', Subject: 'Investment Discussions', ActivityDate: DAY, Task_Type__c: 'Opportunity' }];
  if (/FROM FeedItem WHERE Type = 'TextPost' AND CreatedDate >=/.test(q)) return FEED;
  if (/SELECT Id, Subject, IsClosed FROM Task WHERE Id IN/.test(q)) return [{ Id: '00TA', Subject: 'Orphan response - Radicia Julal', IsClosed: false }, { Id: '00TB', Subject: 'Bond letter', IsClosed: false }];
  return [];
};
FEED = [post('<p>Sales Support · Sasha Lalla · Fri 23 Oct 10:54am</p><p>Mr Rampersad, which agent should take Radicia Julal?</p>', '14:54', ME, '00TA'),
        post('ACTION REQUIRED · Sasha Lalla. Posted Fri 23 Oct.', '15:00', ME, '00TA'),
        post('Kamla, please, Mr Rampersad needs this.', '11:05', ME, '00TB')].concat(['11:05', '11:05', '11:05', '11:06'].map(t => post('Sasha, on Tuesday I asked.', t, ME, '00TA')));
let w = env.bmWaiting_(DAY);
ok('Sasha asking him on her day page reaches his list, from her', w.ask.length === 1 && w.ask[0].id === '00TA' && w.ask[0].by === 'Sasha Lalla-Jagassar' && /which agent/.test(w.ask[0].said), JSON.stringify(w.ask));
ok('the tracker\'s note and the chase on it do not answer her', w.ask[0].id === '00TA');
FEED.push(post('Sasha, assign Fawwaz. Please send the introduction today.', '15:20', ME, '00TA'));
w = env.bmWaiting_(DAY);
ok('his own words do', w.ask.length === 0, JSON.stringify(w.ask));

console.log('\nHis bar:\n');
let WAIT = { ask: [{ id: '00TA', subject: 'Orphan response - Radicia Julal', by: 'Sasha Lalla-Jagassar', said: 'which agent?', at: T('14:54') }, { id: '00TB', subject: 'Bond letter', by: 'Kamla Dookran', said: 'send it?', at: T('13:00') }],
  mine: [{ id: '00TM1', subject: 'Investment Discussions', due: DAY, late: false }].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({ id: '00TL' + i, subject: 'Old ' + i, due: '2026-09-1' + (i % 9), late: true }))), ignored: [], byOwner: {} };
let VIEW = { items: [], open: [{ k: 'kA', u: 'now', subject: 'Orphan premium due', from: 'Kamla' }, { k: 'kB', u: 'today', subject: 'Dear Mr Bisnath', from: 'Kamla' }, { k: 'kC', u: 'later', subject: 'FYI', from: 'X' }] };
env.bmWaiting_ = () => WAIT; env.inboxView_ = () => VIEW;
env.hhmm_ = () => '11:15';
FEED = [post('Kamla, send the CDD form today.', '13:10'), post('MOVED Fri 23 Oct.', '12:42')];
env.sfkQuery_ = q => /FROM FeedItem/.test(q) ? FEED : [];
let g = env.leadProgress_(DAY, new Date());
ok('today\'s number: the staff asking, the inbox to act on, his due today and a fifth of his overdue', g.target === 2 + 2 + 1 + 2 && g.cleared === 0 && g.waiting === 7, g.target + '/' + g.waiting);
ok('his own notes counted, the system\'s apart', g.yourNotes === 1 && g.sys['absence handovers'] === 1, JSON.stringify(g.sys));
WAIT = Object.assign({}, WAIT, { ask: WAIT.ask.slice(1), mine: WAIT.mine.slice(1) });
VIEW = { items: [{ k: 'kA', status: 'replied', by: 'you replied' }, { k: 'kB', status: 'replied', by: 'Kamla replied' }], open: [{ k: 'kC', u: 'later', subject: 'FYI', from: 'X' }] };
g = env.leadProgress_(DAY, new Date());
ok('cleared: the number stays, by him and by the team', g.target === 7 && g.cleared === 4 && g.you === 3 && g.team === 1 && g.waiting === 3, JSON.stringify({ t: g.target, c: g.cleared, y: g.you, tm: g.team, w: g.waiting }));
WAIT = Object.assign({}, WAIT, { ask: WAIT.ask.concat([{ id: '00TC', subject: 'New question', by: 'Elizabeth Lee', said: '?', at: T('15:30') }]) });
g = env.leadProgress_(DAY, new Date());
ok('a new question joins the number', g.target === 8 && g.waiting === 4);

console.log('\nOne tap posts it:\n');
P.setProperty('ANTHROPIC_API_KEY', 'k');
env.bigPut_('bm_deep_' + DAY, { '00TB': { read: 'Kamla has the revised letter ready.', reply: 'Kamla, yes: send it today and copy me.', next: 'Kamla sends it today', add: [], action: 'chase' } });
const wt = env.leadWaiting_(DAY, env.leadItems_(DAY).now);
ok('what waits on him comes with Claude\'s words', wt[0] && wt[0].k === 'ask' && wt[0].id === '00TB' && /send it today/.test(wt[0].draft) && /revised letter/.test(wt[0].read), JSON.stringify(wt[0]));
const posts = []; env.mgrPost_ = (o, sid) => { posts.push({ o, sid }); return 'F1'; };
env.dayLogMany_ = () => 1;
let r = env.workdayPost_({ wd: 'ricky', k: env.workSig_('ricky'), act: 'post', kind: 'ask', id: '00TB', text: 'Kamla, yes: send it today and copy me.' });
ok('his answer goes on her task, headed from his page, so she is mentioned', r.ok && posts[0].o.ParentId === '00TB' && /^Branch Manager · Ricky Rampersad · Fri 23 Oct/.test(posts[0].o.Body) && /send it today/.test(posts[0].o.Body) && posts[0].sid === 'ricky', JSON.stringify(r));
ok('only on what waits on him', env.workdayPost_({ wd: 'ricky', k: env.workSig_('ricky'), act: 'post', kind: 'ask', id: '00TZZ', text: 'x' }).ok === false && posts.length === 1);
ok('only from his link', env.workdayPost_({ wd: 'sasha', k: env.workSig_('sasha'), act: 'post', kind: 'ask', id: '00TB', text: 'x' }).ok === false && env.workdayPost_({ wd: 'ricky', k: 'bad', act: 'post', kind: 'ask', id: '00TB', text: 'x' }).ok === false);
ok('an empty box posts nothing', env.workdayPost_({ wd: 'ricky', k: env.workSig_('ricky'), act: 'post', kind: 'ask', id: '00TB', text: '  ' }).ok === false && posts.length === 1);

console.log('\nThe day log keeps only his own notes:\n');
env.dayLogMany_ = undefined; delete env.dayLogMany_;
const env2 = makeEnv(); env2.todayISO_ = () => DAY; env2.runlog_ = () => {}; env2.bmSfId_ = () => ME;
env2.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'], [['Sasha Lalla-Jagassar', 'sasha', 's@x', '1', 'SSA', 'S', 'Yes']]);
const sysPost = post('ACTION REQUIRED · Sasha. Posted', '12:43'), deskPost = post('Sales Support · Sasha Lalla · Fri 23 Oct 7:06am\nNot done.', '11:06'), his = post('Kamla, send the CDD form today.', '15:41');
env2.__mkSheet('My Day Log', 3, env2.DAYLOG.head, [[DAY, '08:43', 'note', 'Other', 'Note on X', 'fi:' + sysPost.Id], [DAY, '07:06', 'note', 'Other', 'Note on Y', 'fi:' + deskPost.Id], [DAY, '09:00', 'email', 'Other', 'Replied: Z', 'em:1']]);
env2.sfkQuery_ = q => /FROM FeedItem/.test(q) ? [sysPost, deskPost, his] : /SELECT Id, Subject, Task_Type__c FROM Task WHERE Id IN/.test(q) ? [{ Id: '00TX', Subject: 'CDD form', Task_Type__c: 'Servicing' }] : [];
env2.dayLogSalesforce_(DAY);
const log = env2.dayLogRows_(DAY);
ok('the system\'s and the desk\'s posts come off; his note and his e-mail stay', log.length === 2 && log.some(r => r.Ref === 'fi:' + his.Id) && log.some(r => r.Kind === 'email') && !log.some(r => r.Ref === 'fi:' + sysPost.Id), log.map(r => r.Kind + ':' + r.Ref).join(' | '));

console.log('\nClose off for lunch:\n');
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
env.mailSend_ = m => { mails.push(m); return true; };
env.workdayProgress_ = () => ({ sf: true, closed: 2, target: 8, pct: 25, dayPct: 60, proj: 3, noted: 1, unnoted: 1, overdue: 2, dueToday: 1,
  _closed: [{ id: '00T1', subject: 'Premium due - JOHN DOE', noted: true }, { id: '00T2', subject: 'Orphan response - JANE ROE', noted: false }],
  _all: [{ t: { id: '00T9', subject: 'Change of address', due: '2026-10-12', late: true }, ty: 'Servicing' }] });
env.playbookFor_ = () => ({ todo: 'Confirm the new address with the client and update the record' });
ok('five minutes before lunch', env.lunchOffAt_('sasha') === 11 * 60 + 55 && env.lunchOffAt_('elizabeth') === 11 * 60 + 55, env.lunchOffAt_('sasha') + '');
env.sendLunchOff_({ staffId: 'sasha', name: 'Sasha Lalla-Jagassar' }, DAY, new Date());
let m = mails[mails.length - 1];
ok('her subject: lunch, close off, the morning\'s number', /^Lunch at 12:00pm · close off your morning · 2 of 8 closed \(25%\)$/.test(m.subject), m.subject);
ok('the close with no note, flagged', /Closed with no note \(1\): add one before lunch/.test(m.htmlBody) && /JANE ROE/.test(m.htmlBody));
ok('what is still open, with what to do', /Still open today/.test(m.htmlBody) && /Change of address/.test(m.htmlBody) && /What to do:<\/b> Confirm the new address/.test(m.htmlBody));
ok('the button to My workday, to her alone (and sales support copied, as every day mail)', /myworkday\/\?p=sasha/.test(m.htmlBody) && m.to === 'sasha@example.com', m.to + ' cc ' + m.cc);
env.sendLunchOff_({ staffId: 'ricky', name: 'Ricky Rampersad' }, DAY, new Date());
m = mails[mails.length - 1];
ok('his: what is cleared, who still waits, Claude\'s words, the button', /^Lunch at 12:00pm · \d+ of \d+ cleared/.test(m.subject) && /Still waiting on you/.test(m.htmlBody) && /Claude:<\/b> Kamla, yes: send it today/.test(m.htmlBody) && /myworkday\/\?p=ricky/.test(m.htmlBody) && m.to === 'ricky@example.com' && !m.cc, m.subject);

const dow = Number(env.Utilities.formatDate(new Date(), 'x', 'u'));
if (dow <= 5) {
  const sentTo = []; env.sendLunchOff_ = (p) => { sentTo.push(p.staffId); return true; };
  env.__mkSheet('Attendance', 2, env.ATT.head, [[DAY, 'sasha', 'Sasha Lalla-Jagassar', '07:02', '', '', 'in', '', 'sasha', ''], [DAY, 'kamla', 'Kamla Dookran', '', '', '', 'absent', 'sick', 'ricky', '']]);
  ['hkSend_', 'sendMidday_', 'inboxOn_', 'agentTick_', 'ffChaseTick_', 'coverTick_', 'gameTick_', 'rateTick_', 'autoAbsentTick_', 'sendDayStart_', 'sendBranchManagerDay_', 'sendMeNudge_', 'sendBranchManagerProgress_', 'sdPrune_',
   'notClosedReminder_', 'markNotClosed_', 'sendMailbagCall_', 'sendBmaReport_', 'sendAttendanceReport_', 'sendInnovationBoard_', 'sendTeamBoard_', 'sendUnitManagerProgress_', 'sendUnitManagerMorning_', 'sendUnitManagerEvening_',
   'closeoutCheck_', 'bmCloseoutCheck_', 'dayStartBuildSend_'].forEach(f => { env[f] = () => f === 'inboxOn_' ? false : []; });
  env.rebalanceTick_ = () => ''; env.chaseOn_ = () => false; env.meNudgeTimes_ = () => [];
  env.hhmm_ = () => '11:56'; env.housekeepingTick_(); env.housekeepingTick_();
  ok('the tick at 11:56: Sasha (in) and him, once each; not Kamla (absent)', sentTo.filter(s => s === 'sasha').length === 1 && sentTo.filter(s => s === 'ricky').length === 1 && sentTo.indexOf('kamla') < 0, sentTo.join(','));
} else ok('the tick (weekday only; skipped today)', true);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
