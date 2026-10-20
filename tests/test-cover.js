// Absence and cover: two clocks (20 October 2026).
//
// Ricky: "I would like the absent rule to be applied 5 minutes after sign-in ...
// unless she goes back and she can change it. The same applies to everybody"
// and "the staff who is absent, the task will have to be automatically
// reassigned as staff gets their day, so the day will have to now be
// readjusted."
//
// Pinned here: the register marks absent at start + 5, and a later check-in
// turns it into "in, late"; the work moves at start + 30 (at the start when
// the absence was marked ahead with a reason); a second share-out at 8:15
// reaches the eight o'clock desks; nobody takes more than their own pace in a
// day, across every absence; the BMA's own work waits for her; the receiver's
// day keeps its size, moved work on top; checking in before noon brings back
// what nobody touched; a closed branch marks nobody; Akaash and Pawan are on
// the register and nothing of theirs moves.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-20';                 // a Tuesday
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = new Date(DAY + 'T07:04:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const at = hm => { NOW = new realDate(DAY + 'T' + hm + ':00'); env.resetRequestMemo_ && env.resetRequestMemo_(); };
const M = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Azariah Ali', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes'],
   ['Pawan Probhu', 'pawan', 'pawan@example.com', '1', 'Personal Assistant', 'Branch', 'Yes'],
   ['Akaash Ramdeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Agency', 'Yes']]);
env.__mkSheet('Attendance', 2, env.ATT.head, []);
env.__mkSheet('Workload Moves', 3, env.MOVES.head, []);
env.__mkSheet('Block Plans', 4, env.BPLAN.head, []);
const P = env.PropertiesService.getScriptProperties();
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };

const USERS = { ricky: { id: '005R' }, sasha: { id: '005S' }, elizabeth: { id: '005E' }, azariah: { id: '005A' }, kamla: { id: '005K' } };
env.sfkUsers_ = () => USERS;
env.sfkConfigured_ = () => true;
const PACE = { elizabeth: 7, azariah: 10, sasha: 9, kamla: 12 };
env.intelFor_ = sid => ({ pace: PACE[sid] });

const id = (p, n) => '00TCOVER' + p + String(n).padStart(7, '0');   // 16 characters, as Salesforce's are
const task = (p, n, ty, extra) => Object.assign({ id: id(p, n), subject: p + ' task ' + n, due: '2026-10-19', late: true, ty }, extra || {});
let BOOK = {};
env.sfkOpenBook_ = () => JSON.parse(JSON.stringify(BOOK));
let NOTED = [];                           // tasks the owner has written on
let TASKS = {}, FEED = [];
const queries = [];
env.sfkQuery_ = q => {
  queries.push(q);
  if (/FROM FeedItem WHERE Type = 'TextPost'/.test(q)) return NOTED.filter(x => q.indexOf(x) > -1).map(x => ({ ParentId: x }));
  if (/FROM Task WHERE Id IN/.test(q)) return Object.values(TASKS).filter(t => q.indexOf(t.Id) > -1);
  if (/FROM FeedItem WHERE ParentId IN/.test(q)) return FEED.filter(f => q.indexOf(f.ParentId) > -1);
  return [];
};
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'FEED'; };
// Moves: the owner changes in the book, as Salesforce would.
let applied = [];
env.rebalanceApply_ = (day, moves) => moves.map(m => {
  applied.push(m);
  Object.keys(BOOK[m.from] || {}).forEach(ty => { BOOK[m.from][ty] = BOOK[m.from][ty].filter(t => t.id !== m.t.id); });
  return Object.assign({}, m, { ok: true });
});
let absorbed = [], coverMails = [];
const realAbsorb = env.coverAbsorb_, realMail = env.coverMail_;
env.coverAbsorb_ = (day, moves) => absorbed.push(moves.length);
env.coverMail_ = (day, plan, done, asked) => coverMails.push({ plan, done, asked });

console.log('\nThe register: absent five minutes after the start:\n');
const present = { ricky: 1, elizabeth: 1 }, absent = {};
at('07:04');
const early = env.autoAbsentTick_(DAY, M('07:04'), present, absent);
ok('7:04 and Sasha is not in: not yet absent', early.indexOf('sasha') === -1);
ok('Akaash, from six and not in, is on the register like everyone', early.indexOf('akaash') > -1);
at('07:05');
let marked = env.autoAbsentTick_(DAY, M('07:05'), present, absent);
ok('7:05: Sasha is marked absent', marked.indexOf('sasha') > -1 && absent.sasha === 1, marked.join(','));
ok('Elizabeth, in at 6:55, is not', marked.indexOf('elizabeth') === -1);
ok('Azariah and Kamla start at eight: not yet', marked.indexOf('azariah') === -1 && marked.indexOf('kamla') === -1);
env.resetRequestMemo_();
const row = sid => env.sheetObjects_(env.attSheet_()).find(r => String(r.StaffId) === sid && env.isoDay_(r.Date) === DAY) || {};
ok('the row says absent, by the tracker, with the time', row('sasha').Status === 'absent' && row('sasha').MarkedBy === 'tracker' && /No sign-in by 7:05/.test(row('sasha').Reason), JSON.stringify(row('sasha')));
ok('and the clock marks once', env.autoAbsentTick_(DAY, M('07:20'), present, {}).indexOf('sasha') === -1);

console.log('\nHer work moves at start + 30, not at 5:\n');
BOOK = { sasha: { 'Pendings': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => task('S', n, 'Pendings')),
                  'Renewa/PDl/Bill': [13, 14].map(n => task('S', n, 'Renewa/PDl/Bill')) } };
BOOK.sasha['Pendings'].push(task('S', 15, 'Pendings', { late: false, due: '2026-10-21' }));   // due tomorrow
BOOK.sasha['Pendings'].push(task('S', 16, 'Pendings'));                                          // she has written on this one
NOTED = [id('S', 16)];
at('07:20');
ok('7:20: nothing has moved', env.coverTick_(DAY, M('07:20'), present, absent).length === 0 && applied.length === 0);
at('07:30');
let r1 = env.coverTick_(DAY, M('07:30'), present, absent);
const toLiz = applied.filter(m => m.to === 'elizabeth');
ok('7:30: the first share-out', r1.length === 1 && /Sasha covered/.test(r1[0]), r1.join(' | '));
ok('Elizabeth, the only one in, takes no more than her own pace (7)', toLiz.length === 7, String(toLiz.length));
ok('the rest wait for the eight o\'clock desks', coverMails[0].plan.kept.length === 7, String(coverMails[0].plan.kept.length));
ok('a task Sasha has written on stays with her', !applied.some(m => m.t.id === id('S', 16)) && coverMails[0].plan.noted === 1);
ok('what is due tomorrow is asked about, not moved', !applied.some(m => m.t.id === id('S', 15)) && posts.some(p => p[1].ParentId === id('S', 15) && /^ACTION REQUIRED/.test(p[1].Body)));
ok('what each person took today is kept', JSON.parse(P.getProperty('cover_got_' + DAY)).elizabeth === 7);
ok('and Elizabeth\'s day is readjusted', absorbed[0] === 7);

console.log('\nA second share-out at 8:15, once the eight o\'clock desks are in:\n');
present.azariah = 1; present.kamla = 1;
const postsBefore = posts.length; applied = [];
at('08:00');
ok('8:00: nothing new (the second pass waits for 8:15)', env.coverTick_(DAY, M('08:00'), present, absent).length === 0);
at('08:15');
let r2 = env.coverTick_(DAY, M('08:15'), present, absent);
ok('8:15: the second pass', r2.length === 1 && /second pass/.test(r2[0]), r2.join(' | '));
ok('Elizabeth, already at her pace, is given nothing more', !applied.some(m => m.to === 'elizabeth'));
ok('the money work goes to Kamla, and only the money work', applied.filter(m => m.to === 'kamla').every(m => m.t.ty === 'Renewa/PDl/Bill') && applied.filter(m => m.to === 'kamla').length === 2,
   applied.map(m => m.to + ':' + m.t.ty).join(','));
ok('and the rest to Azariah', applied.filter(m => m.to === 'azariah').length === 5);
ok('nobody is asked twice for a note', posts.length === postsBefore);
at('09:00');
ok('and that is the last of it for the day', env.coverTick_(DAY, M('09:00'), present, absent).length === 0);

console.log('\nThe cap is per day, across every absence:\n');
BOOK.azariah = { 'Pendings': [1, 2, 3].map(n => task('A', n, 'Pendings')) };
const p2 = env.coverPlan_(DAY, 'azariah', { elizabeth: 1, sasha: 1, kamla: 1 }, { azariah: 1 });
ok('Elizabeth, who took seven for Sasha, takes none for Azariah', p2.moves.every(m => m.to !== 'elizabeth') && p2.moves.length === 3, p2.moves.map(m => m.to).join(','));

console.log('\nMarked absent ahead, with a reason: the work moves at the start; her own work waits for her:\n');
const D2 = '2026-10-21';
env.todayISO_ = () => D2;
env.attSheet_().appendRow(env.headerOf_(env.attSheet_()).map(h => ({ Date: D2, StaffId: 'kamla', Name: 'Kamla Dookran', Status: 'absent', Reason: 'Workshop', MarkedBy: 'ricky' })[h] || ''));
env.resetRequestMemo_(); env.forgetHr_(env.ATT);
BOOK = { kamla: { 'Lic/Staffing/SA/HR': [1, 2, 3].map(n => task('K', n, 'Lic/Staffing/SA/HR')),
                  'Renewa/PDl/Bill': [4, 5, 6, 7].map(n => task('K', n, 'Renewa/PDl/Bill')) } };
NOTED = []; applied = []; coverMails = [];
const pres2 = { sasha: 1, elizabeth: 1, azariah: 1, ricky: 1 }, abs2 = { kamla: 1 };
NOW = new realDate(D2 + 'T07:59:00');
ok('7:59: not yet', env.coverTick_(D2, M('07:59'), pres2, abs2).length === 0);
NOW = new realDate(D2 + 'T08:00:00');
let r3 = env.coverTick_(D2, M('08:00'), pres2, abs2);
ok('8:00, her start: the work moves at once', r3.length === 1 && applied.length === 4, r3.join(' | '));
ok('only the renewals moved', applied.every(m => m.t.ty === 'Renewa/PDl/Bill'));
ok('her staffing and licensing work waits for her', coverMails[0].plan.own.length === 3);
env.todayISO_ = () => DAY;

console.log('\nThe receiver\'s day keeps its size, with what moved on top:\n');
env.coverAbsorb_ = realAbsorb;
const LIZ = { staffId: 'elizabeth', name: 'Elizabeth Lee' };
const own = [1, 2, 3, 4, 5, 6, 7].map(n => ({ k: 'sf', id: id('L', n), subject: 'Liz task ' + n, type: 'Pendings' }));
env.planWrite_(LIZ, DAY, 'KPI1', { Items: JSON.stringify(own) });
env.forgetHr_(env.BPLAN); env.resetRequestMemo_();
env.sfkTaskStates_ = () => ({});
let MODEL = { b: { KPI1: { sug: own.map(it => ({ id: it.id, s: it.subject })), more: [] } }, loose: [] };
env.intelModel_ = () => MODEL;
env.bigPut_ = (k, v) => { MODEL = v; };
const moved = [1, 2, 3].map(n => ({ ok: true, to: 'elizabeth', from: 'sasha', t: task('S', 100 + n, 'Pendings') }));
env.coverAbsorb_(DAY, moved);
env.forgetHr_(env.BPLAN); env.resetRequestMemo_();
const lizPlan = env.planItemsOf_(env.planRows_('elizabeth', DAY).KPI1.Items).filter(it => it.k === 'sf');
ok('still seven on her day', lizPlan.length === 7, String(lizPlan.length));
ok('the three that moved are on top', lizPlan.slice(0, 3).map(it => it.id).join() === moved.map(m => m.t.id).join());
ok('her three lowest went to "when your list is done"', MODEL.b.KPI1.more.slice(0, 3).map(t => t.id).join() === [5, 6, 7].map(n => id('L', n)).join(),
   MODEL.b.KPI1.more.map(t => t.id).join());
env.coverAbsorb_(DAY, [{ ok: true, to: 'azariah', from: 'sasha', t: task('S', 200, 'Pendings') }]);
env.forgetHr_(env.BPLAN); env.resetRequestMemo_();
ok('somebody not checked in yet has no plan written for them', !env.planRows_('azariah', DAY).KPI1);

console.log('\nIn after all: before noon, what nobody touched comes back:\n');
const mv = env.hrTab_(env.MOVES, true);
['T1', 'T2', 'T3', 'T4'].forEach((n, i) => mv.appendRow(env.headerOf_(mv).map(h => ({ Date: DAY, TaskId: id(n, i), From: 'sasha', To: 'elizabeth', Type: 'Pendings', Result: 'OK' })[h] || '')));
env.forgetHr_(env.MOVES); env.resetRequestMemo_();
TASKS = {
  [id('T1', 0)]: { Id: id('T1', 0), OwnerId: '005E', IsClosed: false, Subject: 'untouched', LastModifiedById: '005R' },
  [id('T2', 1)]: { Id: id('T2', 1), OwnerId: '005E', IsClosed: false, Subject: 'status changed by Liz', LastModifiedById: '005E' },
  [id('T3', 2)]: { Id: id('T3', 2), OwnerId: '005E', IsClosed: false, Subject: 'Liz wrote on it', LastModifiedById: '005R' },
  [id('T4', 3)]: { Id: id('T4', 3), OwnerId: '005E', IsClosed: true, Subject: 'closed', LastModifiedById: '005E' }
};
FEED = [{ ParentId: id('T1', 0), Body: 'MOVED 20 Oct. Sasha Lalla is absent today.', CreatedById: '005R' },
        { ParentId: id('T3', 2), Body: 'Called the client, waiting on the form.', CreatedById: '005E' }];
P.setProperty('cover_got_' + DAY, JSON.stringify({ elizabeth: 7, azariah: 5, kamla: 2 }));
env.planWrite_(LIZ, DAY, 'KPI1', { Items: JSON.stringify([{ k: 'sf', id: id('T1', 0), subject: 'untouched' }, { k: 'sf', id: id('L', 1), subject: 'Liz task 1' }]) });
env.forgetHr_(env.BPLAN); env.resetRequestMemo_();
applied = [];
at('12:05');
ok('after noon nothing comes back', env.coverReturn_({ staffId: 'sasha', name: 'Sasha Lalla' }, DAY).length === 0 && applied.length === 0);
at('09:40');
const back = env.coverReturn_({ staffId: 'sasha', name: 'Sasha Lalla' }, DAY);
ok('9:40: the untouched task comes back to Sasha', back.length === 1 && back[0].t.id === id('T1', 0) && back[0].to === 'sasha' && back[0].from === 'elizabeth');
ok('one Elizabeth changed, one she wrote on and one closed stay where they are', !applied.some(m => [id('T2', 1), id('T3', 2), id('T4', 3)].indexOf(m.t.id) > -1));
ok('the note on it says why', /^BACK /.test(back[0].note) && /Sasha/.test(back[0].note));
env.forgetHr_(env.BPLAN); env.resetRequestMemo_();
ok('and it leaves Elizabeth\'s day', !env.planItemsOf_(env.planRows_('elizabeth', DAY).KPI1.Items).some(it => it.id === id('T1', 0)));
ok('her count for the day goes down by one', JSON.parse(P.getProperty('cover_got_' + DAY)).elizabeth === 6);

console.log('\nChecking in late turns the absence into "late":\n');
let returned = [];
env.coverReturn_ = (p, d) => { returned.push(p.staffId); return [1, 2]; };
at('07:18');
env.CacheService.getScriptCache().remove('att_sasha_' + DAY);
const a1 = env.recordAttendance_({ staffId: 'sasha', name: 'Sasha Lalla' });
env.resetRequestMemo_();
ok('Sasha at 7:18: in, and late by 18', a1.status === 'in' && a1.late === 18, JSON.stringify(a1));
ok('the register says so', row('sasha').FirstSignIn === '07:18' && /after the automatic absence/.test(row('sasha').Reason));
ok('and what nobody touched is asked back', returned[0] === 'sasha' && a1.back === 2);
env.todayISO_ = () => D2;
NOW = new realDate(D2 + 'T08:20:00');
env.CacheService.getScriptCache().remove('att_kamla_' + D2);
const a2 = env.recordAttendance_({ staffId: 'kamla', name: 'Kamla Dookran' });
env.resetRequestMemo_();
const k2 = env.sheetObjects_(env.attSheet_()).find(r => String(r.StaffId) === 'kamla' && env.isoDay_(r.Date) === D2) || {};
ok('marked absent ahead by a manager, and in after all: in, late', a2.status === 'in' && a2.late === 20 && /though marked absent \(Workshop\)/.test(k2.Reason), JSON.stringify(k2));
env.todayISO_ = () => DAY;

console.log('\nA closed branch, and whose work never moves:\n');
P.setProperty('BRANCH_CLOSED', '2026-12-25, ' + DAY);
ok('a closed day marks nobody', env.autoAbsentTick_(DAY, M('10:00'), {}, {}).length === 0);
ok('and covers nobody', env.coverTick_(DAY, M('10:00'), {}, { sasha: 1 }).length === 0);
P.deleteProperty('BRANCH_CLOSED');
ok('Akaash and Pawan are on the register, and nothing of theirs is shared out', env.COVER.POOL.indexOf('akaash') === -1 && env.COVER.POOL.indexOf('pawan') === -1);
ok('nor is the Branch Manager\'s', env.COVER.POOL.indexOf('ricky') === -1 && env.DAY_MAIL_DESKS.indexOf('ricky') === -1);

console.log('\nThe e-mail to Mr Rampersad says what waits for her:\n');
env.coverMail_ = realMail;
mails.length = 0;
try {
  realMail(D2, { sid: 'kamla', name: 'Kamla Dookran', first: 'Kamla', moves: [], kept: [], ask: [], own: [1, 2, 3], noted: 0, receivers: [] },
    [{ ok: true, to: 'sasha', from: 'kamla', t: task('K', 4, 'Renewa/PDl/Bill'), toName: 'Sasha Lalla', fromName: 'Kamla Dookran', why: 'x' }], []);
} catch (e) { console.log('   (mail threw: ' + e.message + ')'); }
const toRicky = mails.find(m => /absent/.test(m.subject) && /ricky/.test(m.to));
ok('the tile for her own work, waiting', toRicky && /own work, waits for the return/.test(toRicky.htmlBody));
const toKamla = mails.find(m => m.to === 'kamla@example.com');
ok('and she is told checking in brings back what nobody touched', toKamla && /before noon anything nobody has touched comes back to you/.test(toKamla.htmlBody));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
