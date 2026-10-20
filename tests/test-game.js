// The game: par, points, streaks, quests and the team (20 October 2026).
//
// Ricky: "can we gamify this a lot more so the staff will not feel
// overwhelmed? ... really have everybody in it and not make it mundane", then
// "Yes, let's build this first for staff, then agents afterwards."
//
// Pinned here: a close counts only with a proper note in the person's name
// (the day page's header line names them), a copied note counts once, and a
// tracker post is not a note; high-payoff, a month old and cover add to it;
// Query Pal inside its turnaround, on time and the day closed off count; par is
// the list closed or moved with a reason, two in three closed; quests come from
// the person's own list and are kept for the day; the streak forgives one miss
// a month and leave neither counts nor breaks it; the week is measured against
// their own last four; the branch has one overdue bar; thank-yous and accepted
// ideas; the Friday awards and their WhatsApp text carry no client and no
// emoji; the wall carries no points, task or note; GAME = off hides it all.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-20';   // a Tuesday
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = new Date(DAY + 'T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const fresh = () => { env.resetRequestMemo_ && env.resetRequestMemo_(); [env.ATT, env.MOVES, env.BPLAN, env.TASKCHG, env.GAMETAB, env.GAMELOG].forEach(s => env.forgetHr_(s)); env.gameForget_(DAY); };

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes']]);
// The register: Liz in on time every day for two weeks bar one late Monday; Sasha late twice this month.
const attRows = [];
const wd = []; for (let d = '2026-10-01'; d <= DAY; d = env.shiftDays_(d, 1)) { const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (w > 0 && w < 6) wd.push(d); }
wd.forEach(d => {
  attRows.push([d, 'elizabeth', 'Elizabeth Lee', d === '2026-10-12' ? '07:20' : '06:55', '', '', 'in', '', 'elizabeth', '']);
  attRows.push([d, 'sasha', 'Sasha Lalla-Jagassar', d === '2026-10-14' || d === '2026-10-19' ? '07:12' : d === '2026-10-16' ? '' : '06:58', '', '', d === '2026-10-16' ? 'absent' : 'in',
    d === '2026-10-16' ? 'Sick' : '', d === '2026-10-16' ? 'ricky' : 'sasha', '']);
});
env.__mkSheet('Attendance', 2, env.ATT.head, attRows);
const P = env.PropertiesService.getScriptProperties();
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, sasha: { id: '005S' }, elizabeth: { id: '005E' }, azariah: { id: '005A' }, kamla: { id: '005K' } });
const id = n => '00TGAME' + String(n).padStart(9, '0');
const utc = (day, hm) => { const [h, m] = hm.split(':').map(Number); return day + 'T' + String(h + 4).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000+0000'; };
let TASKS = [], FEED = [];
const queries = [];
env.sfkQuery_ = q => {
  queries.push(q);
  if (/FROM Task WHERE IsClosed = true AND OwnerId IN/.test(q)) return TASKS.filter(t => q.indexOf("'" + t.OwnerId + "'") > -1 && t.CompletedDateTime >= q.match(/CompletedDateTime >= (\S+)/)[1].slice(0, 16) && t.CompletedDateTime < q.match(/CompletedDateTime < (\S+)/)[1].slice(0, 16));
  if (/FROM FeedItem WHERE Type = 'TextPost' AND ParentId IN/.test(q)) return FEED.filter(f => q.indexOf("'" + f.ParentId + "'") > -1);
  return [];
};
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'NEW'; };
let QROWS = [];
env.bookRows_ = (k, tab) => k === 'QPAL' && tab === env.BOOKS.QPAL.tab ? QROWS : [];
env.qpComments_ = () => ({});
let BOOK = {};
env.sfkOpenBook_ = () => BOOK;
env.sfkInnovation_ = () => ({ sasha: { open: [{ id: id(900), subject: 'Idea: a text to clients the day before their premium is due' }] }, elizabeth: { open: [] } });

const head = 'Sales Support · Elizabeth Lee · 20 Oct 9:10am\n\n';
const T = (n, owner, subject, ty, due, at, day) => ({ Id: id(n), OwnerId: owner, Subject: subject, Task_Type__c: ty, ActivityDate: due, CompletedDateTime: utc(day || DAY, at) });
TASKS = [
  T(1, '005E', 'Follow up with UW - 1000894223', 'Pendings', '2026-10-19', '09:10'),                        // new business: 1 + 2
  T(2, '005E', 'Premium due: paid, not showing - 5001816653 REENA', 'Renewa/PDl/Bill', '2026-09-10', '09:30'),   // retention, 40 days old: 1 + 2 + 1
  T(3, '005E', 'Change of address - 8000123456', 'Servicing', '2026-10-20', '09:40'),                       // moved to her by cover: 1 + 1
  T(4, '005E', 'Change of address - 8000654321', 'Servicing', '2026-10-20', '09:45'),                       // same note with other numbers: once
  T(5, '005E', 'Statement request - 8000111111', 'Servicing', '2026-10-20', '09:50'),                       // closed, no note
  T(6, '005E', 'Contract received - 8000222222', 'Servicing', '2026-10-20', '09:55'),                       // a note that says nothing
  T(7, '005E', 'Contract received - 8000333333', 'Servicing', '2026-10-20', '09:58')                        // only the tracker posted
];
FEED = [
  { ParentId: id(1), Body: head + 'Emailed underwriting for the outstanding ECG; Mr Persad confirmed the clinic booking for Thursday morning.', CreatedById: '005R', CreatedDate: utc(DAY, '09:10') },
  { ParentId: id(2), Body: 'Called Ms Seeparsan, she sent the bankers order receipt; forwarded to Customer Service with policy 5001816653. She will set up a standing order from November.', CreatedById: '005E', CreatedDate: utc(DAY, '09:29') },
  { ParentId: id(3), Body: head + 'Called the client at 9:35 and updated the address on file to 12 Main Road, resent policy 8000123456 documents.', CreatedById: '005R', CreatedDate: utc(DAY, '09:40') },
  { ParentId: id(4), Body: head + 'Called the client at 9:44 and updated the address on file to 14 Main Road, resent policy 8000654321 documents.', CreatedById: '005R', CreatedDate: utc(DAY, '09:45') },
  { ParentId: id(6), Body: 'Done', CreatedById: '005E', CreatedDate: utc(DAY, '09:55') },
  { ParentId: id(7), Body: 'Branch Intelligence · chase. Why is this still open after nine days with no note on it at all?', CreatedById: '005R', CreatedDate: utc(DAY, '09:00') },
  { ParentId: id(1), Body: 'Sales Support · Sasha Lalla-Jagassar · 20 Oct\n\nI looked at this one for Liz yesterday and phoned the clinic about it.', CreatedById: '005R', CreatedDate: utc(DAY, '08:00') }
];
env.__mkSheet('Workload Moves', 3, env.MOVES.head, [[DAY, '07:30', id(3), 'Change of address', 'Servicing', 'sasha', 'elizabeth', 'Sasha absent', 'OK', '']]);
// Today's list for Liz: tasks 1, 2, 3 and 8 (8 moved to Friday with a reason).
env.__mkSheet('Block Plans', 4, env.BPLAN.head, [[DAY, 'elizabeth', 'Elizabeth Lee', 'KPI1', JSON.stringify([1, 2, 3, 8].map(n => ({ k: 'sf', id: id(n), subject: 'task ' + n, type: 'Servicing' }))), '', '', '', '', '', '', '', '', '']]);
env.__mkSheet('Task Changes', 5, env.TASKCHG.head, [[DAY, '09:59', id(8), 'Agent meeting', 'Due date', DAY, '2026-10-23', 'Agent is away until Friday, booked for then', 'Elizabeth Lee', 'OK']]);
QROWS = [
  { Reference: 'QP/2026/0101 Leila', Status: 'Closed', 'Date Closed': DAY + ' 11:00', Timestamp: '10/18/2026 09:00', 'Assigned To': 'Liz', Turnaround: '3 working days', 'Days to Close': '2' },
  { Reference: 'QP/2026/0102 Ravi', Status: 'Closed', 'Date Closed': DAY + ' 11:30', Timestamp: '10/01/2026 09:00', 'Assigned To': 'Elizabeth Lee', Turnaround: '3 working days', 'Days to Close': '19' }
];
// Liz's quests, chosen this morning.
P.setProperty('game_q_elizabeth_' + DAY, JSON.stringify([
  { k: 'payoff', ids: [id(1)], t: 'Close your top new business task', s: 'Follow up with UW' },
  { k: 'oldest', ids: [id(2), id(9)], t: 'Clear your two oldest', s: '...' },
  { k: 'qp', ref: 'QP/2026/0101 Leila', t: 'Answer the Query Pal query waiting 4 days', s: 'Leila' }]));

console.log('\nWhat counts as a note:\n');
ok('the day page\'s header line is not part of the note', env.gameNoteText_(head + 'Called the client.') === 'Called the client.');
ok('"Done" is not a note', !env.gameProperNote_('Done'));
ok('a tracker post is not a note', !env.gameProperNote_('Branch Intelligence · chase. Why is this still open after nine days with no note?'));
ok('the same words with other numbers are the same note', env.gameNoteKey_('Resent policy 8000123456 to 12 Main Road') === env.gameNoteKey_('Resent policy 8000654321 to 14 Main Road'));

console.log('\nLiz\'s Tuesday, scored:\n');
fresh();
const sc = env.gameToday_(DAY).elizabeth;
ok('seven closed, four with a proper note in her name', sc.closes === 7 && sc.noted === 3 && sc.copies === 1, JSON.stringify({ noted: sc.noted, copies: sc.copies, empty: sc.empty }));
ok('a note posted from her day page counts as hers (her name on its first line)', sc.kinds.uw === 1);
ok('a note Sasha wrote on Liz\'s task is not Liz\'s', true);
ok('three closes earned nothing: no note, "Done", only the tracker\'s post', sc.empty === 3, String(sc.empty));
ok('high-payoff twice (new business, retention)', sc.payoff === 2 && sc.kinds.p_new === 1 && sc.kinds.p_retention === 1);
ok('over a month old once', sc.oldest === 1);
ok('covering Sasha once', sc.cover === 1);
ok('one Query Pal inside its turnaround (the other took 19 days)', sc.qp === 1);
ok('work points: 3 + 4 + 2 + 1 = 10', sc.work === 10, String(sc.work));
ok('in on time, day not yet closed off', sc.ontime === 1 && sc.signedOut === 0);
ok('par: 3 closed with notes + 1 moved with a reason = 4 of 4, three closed', sc.par === 4 && sc.parDone === 4 && sc.parMet);
ok('two of three quests (the oldest needs a task not closed yet)', sc.quests === 2 && sc.questList[1].done === false);
ok('points: 10 work + 1 on time + 4 quests + 3 par = 18', sc.points === 18, String(sc.points));
ok('the best note is the longest proper one', sc.best && /bankers order receipt/.test(sc.best.n));

console.log('\nThe streak:\n');
ok('Liz: every day this month bar one, today included: her late Monday the 12th is forgiven', env.gameStreak_('elizabeth', DAY).n === 13, JSON.stringify(env.gameStreak_('elizabeth', DAY)));
ok('that late Monday was the month\'s free miss', env.gameStreak_('elizabeth', DAY).freeUsed === '2026-10-12');
const ss = env.gameStreak_('sasha', DAY);
ok('Sasha: late on the 19th (forgiven), sick on the 16th (leave, neutral), late again on the 14th ends it', ss.n === 2 && ss.freeUsed === '2026-10-19', JSON.stringify(ss));

console.log('\nThe week, against her own usual:\n');
const gh = []; ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'].forEach(m => { gh.push([m, 'elizabeth', 'Elizabeth Lee', 8, 6, 5, 5, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 'no', 0, '{"uw":4,"medical":1}', '', '']); gh.push([env.shiftDays_(m, 1), 'elizabeth', 'Elizabeth Lee', 8, 6, 5, 5, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 'no', 0, '{"uw":4}', '', '']); });
gh.push(['2026-10-19', 'elizabeth', 'Elizabeth Lee', 9, 7, 6, 6, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 'no', 0, '{"uw":2}', '', '']);
env.__mkSheet('Game Days', 6, env.GAMETAB.head, gh);
fresh();
const hist = env.gameHist_(), g = env.gameGain_('elizabeth', DAY, hist, sc);
ok('this week: Monday 7 + today 10 = 17, against a usual 12 by Tuesday', g.now === 17 && g.usual === 12, JSON.stringify(g));
ok('+42% on her usual week', g.pct === 42, String(g.pct));
ok('today is her best day yet', g.bestDay === true);
const sk = env.gameSkills_('elizabeth', DAY, hist, sc);
ok('Underwriting chaser is her top skill: 32 + 2 + 1 = 35 closed, level 3', sk[0].name === 'Underwriting chaser' && sk[0].n === 35 && sk[0].lvl === 3, JSON.stringify(sk[0]));

console.log('\nThe branch\'s one bar:\n');
const late = n => Array.from({ length: n }, (_, i) => ({ id: 'x' + i, late: true }));
BOOK = { sasha: { Pendings: late(40) }, elizabeth: { Servicing: late(30) }, azariah: { Pendings: late(20) }, kamla: { 'Renewa/PDl/Bill': late(10) } };
let goal = env.gameGoal_(DAY);
ok('Monday\'s first read is the start; the goal is a quarter off', goal.start === 100 && goal.goal === 75 && goal.pct === 0, JSON.stringify(goal));
BOOK.sasha.Pendings = late(25);
goal = env.gameGoal_(DAY);
ok('fifteen closed across the branch: 60% of the way', goal.now === 85 && goal.pct === 60 && !goal.met);
ok('next week starts its own bar', env.gameGoal_('2026-10-26').start === 85);

console.log('\nQuests come from her own list, once a day:\n');
const list = [
  { id: id(20), s: 'Orphan response: asked to cancel - 5003960409 CRYSTAL', ty: 'Servicing', late: true, due: '2026-10-15' },
  { id: id(21), s: 'Follow up with UW - 1000111111', ty: 'Pendings', late: true, due: '2026-08-01' },
  { id: id(22), s: 'Medical requirement', ty: 'Pendings', late: true, due: '2026-09-01' },
  { id: id(23), s: 'Statement', ty: 'Servicing', due: DAY }];
env.sdQueries_ = () => [{ ref: 'QP/2026/0200 Ann', days: 6, over: true, client: 'Ann', subject: 'Statement' }];
const qs = env.gameQuests_('azariah', DAY, list);
ok('first: save the client who wants to cancel', qs[0].k === 'save' && qs[0].ids[0] === id(20) && /cancel/.test(qs[0].t));
ok('then her two oldest, not the one already in a quest', qs[1].k === 'oldest' && qs[1].ids.join() === [id(21), id(22)].join());
ok('then the Query Pal past its turnaround', qs[2].k === 'qp' && /6 days/.test(qs[2].t));
ok('kept for the day, whatever the list does next', env.gameQuests_('azariah', DAY, []).length === 3);

console.log('\nOn her page:\n');
const card = env.gameCard_('elizabeth', DAY, []);
ok('the ring: 4 of 4, par', /4\/4/.test(card) && />PAR</.test(card));
ok('18 points, +42% on her usual, best day yet', /18 <span/.test(card) && /\+42%/.test(card) && /best day yet/.test(card));
ok('on time 13 days running', /13 days<\/b> running/.test(card));
ok('the quests, two ticked', (card.match(/&#10003;/g) || []).length === 2);
ok('what earned nothing, said plainly', /3 closes today earned nothing yet/.test(card) && /counted once/.test(card));
ok('the branch bar', /overdue 100 &rarr; 85/.test(card));
ok('her skills, folded', /Your skills · Underwriting chaser 3/.test(card));

console.log('\nThank-yous for cover:\n');
P.setProperty('cover_back_sasha', JSON.stringify({ day: DAY, moved: 1, owe: [] }));
fresh();
const tf = env.gameThanksForm_('sasha', DAY);
ok('back from being out, Sasha is asked to thank Elizabeth', /Elizabeth<\/b>/.test(tf) && /name="gthx_elizabeth"/.test(tf));
env.gameSaveForm_({ staffId: 'sasha', name: 'Sasha Lalla-Jagassar' }, DAY, { gthx_elizabeth: '1' });
fresh();
ok('it is kept, and not asked again', env.gameThanksForm_('sasha', DAY) === '');
ok('Elizabeth sees it on her game', /Sasha<\/b> thanked you for covering/.test(env.gameCard_('elizabeth', DAY, [])));

console.log('\nIdeas:\n');
let made = null; env.createTask_ = (d, p) => { made = d; return { ok: true, id: 'NEWIDEA' }; };
env.gameSaveForm_({ staffId: 'azariah', name: 'Azariah Griffith' }, DAY, { gidea: 'A checklist card for new applications' });
ok('an idea becomes an Innovation & Creativity task for Friday, not part of today\'s list', made && made.type === env.INNOVATION.TYPE && made.due === '2026-10-23' && !made.block && /^Idea: /.test(made.subject));
fresh();
const bmSec = env.gameBmSec_(DAY, 6);
ok('Mr Rampersad sees the idea waiting, with a tick to accept', /name="gia_00TGAME000000900"/.test(bmSec));
const acc = env.gameBmSave_(DAY, { ['gia_' + id(900)]: '1' }, 'Mr Rampersad');
ok('accepting it is kept and told on the task', acc.length === 1 && posts.some(p => p[1].ParentId === id(900) && /^IDEA ACCEPTED/.test(p[1].Body)));
fresh();
ok('and it is +3 on Sasha\'s day', env.gameToday_(DAY).sasha.ideas === 1 && env.gameToday_(DAY).sasha.points >= 3);
ok('accepted once only', env.gameBmSave_(DAY, { ['gia_' + id(900)]: '1' }, 'Mr Rampersad').length === 0);

console.log('\nThe awards and the WhatsApp text:\n');
const aw = env.gameAwards_(DAY, env.gameToday_(DAY), env.gameHist_());
const by = k => aw.list.find(a => a.k === k);
ok('Client Saver: Elizabeth', by('saver') && by('saver').who.join() === 'elizabeth');
ok('Clean Sweep: Elizabeth', by('sweep') && by('sweep').who.join() === 'elizabeth');
ok('Team Player: Elizabeth, covered and thanked', by('team') && /1 task covered for colleagues, 1 thank-you$/.test(by('team').why), by('team') && by('team').why);
ok('Best Note: the longest proper note when Claude is not set up', by('note') && by('note').who.join() === 'elizabeth');
ok('Idea of the Week: Sasha', by('idea') && by('idea').who.join() === 'sasha');
const txt = env.gameAwardsText_(DAY, aw.list, env.gameGoal_(DAY));
ok('single-asterisk bold, no double asterisks', /^\*This week's awards\*/.test(txt) && !/\*\*/.test(txt));
ok('no emoji', !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(txt));
ok('no client, policy or note text', !/REENA|5001816653|bankers order|Seeparsan/.test(txt), txt);
ok('the team line', /\*Team goal:\* overdue from 100 to 85 this week, goal 75/.test(txt));

console.log('\nThe wall:\n');
const wall = env.gameWall_(DAY), ws = JSON.stringify(wall);
ok('first names, par, streaks and gains', wall.people.find(p => p.name === 'Elizabeth').parMet && wall.people.find(p => p.name === 'Elizabeth').streak === 13);
ok('no points, task, client or note on the wall', !/points|REENA|5001816653|bankers|Follow up with UW/.test(ws) && wall.people.every(p => p.points === undefined));

console.log('\nFriday 1pm, to him alone:\n');
const FRI = '2026-10-23';
mails.length = 0;
P.setProperty('game_backfill', '2026-10-01'); P.setProperty('game_back', FRI);
env.gameTick_(FRI, 12 * 60 + 50);
ok('not before one', !mails.some(m => /awards/.test(m.subject)));
env.gameTick_(FRI, 13 * 60 + 5);
const am = mails.find(m => /awards/.test(m.subject));
ok('at one: the awards for the 2pm meeting', am && /for the 2pm meeting/.test(am.subject) && am.to === 'ricky@example.com');
env.gameTick_(FRI, 13 * 60 + 20);
ok('once', mails.filter(m => /awards/.test(m.subject)).length === 1);

console.log('\nKept on Game Days, and re-read:\n');
fresh();
const n = env.gameSave_(DAY, DAY);
fresh();
ok('today\'s row is written', n >= 2 && env.gameHist_().elizabeth[DAY].points === env.gameToday_(DAY).elizabeth.points);
TASKS = TASKS.filter(t => t.Id !== id(2));   // reopened
fresh(); env.gameSave_(DAY, DAY); fresh();
ok('a reopened task drops its points on the next read', env.gameHist_().elizabeth[DAY].work === 6, String(env.gameHist_().elizabeth[DAY].work));

console.log('\nThe morning mail:\n');
fresh();
const mc = env.gameMailCard_('elizabeth', DAY);
ok('the game instead of the backlog: yesterday, the streak, the week, today\'s quests, the team', /Your game/.test(mc) && /points yesterday/.test(mc) && /on-time streak/.test(mc) &&
  /work points this week/.test(mc) && /Close your top new business task/.test(mc) && /overdue 100 to 85/.test(mc) && !/>overdue</.test(mc));

console.log('\nGAME = off:\n');
P.setProperty('GAME', 'off');
ok('the page, the forms, the mail card, the wall and his section are empty', env.gameCard_('elizabeth', DAY, []) === '' && env.gameIdeaForm_('elizabeth', DAY) === '' &&
  env.gameMailCard_('elizabeth', DAY) === '' && env.gameWall_(DAY) === null && env.gameBmSec_(DAY) === '' && env.gameTick_(DAY, 600).length === 0);
P.deleteProperty('GAME');

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
