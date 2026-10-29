// My day that helps at once (28 October 2026).
//
// Ricky, 6:10am: "when I open my day and it's asking me what to do I am not seeing it drafting the responses and using the
// intelligence!! Also it's taking long when I post", and 6:11: "would like to have the time left as well". Pinned here:
//   - yesterday's review of a mail still open is today's (ixDeepGet_), written into today's store before the morning tidy
//     drops the old days (ixDeepCarryNow_), and not asked of Claude again unless the mail, task or status moved;
//   - one review at a time, whether the clock or the page started it; a review keeps only what is on today's list;
//   - the page asks for the review itself (ixReviewNow): a stale page is refused, each reviewed item comes back built as the
//     page builds it, what is left is counted, and a review already running answers busy;
//   - Save in place (unitSave_ quick, unitSaveNow): what saved and its fields, the inbox items dealt with, what did not save
//     keeps its fields; a stale page is refused;
//   - the register: the time each person left under the time they came, early against their own hours, no sign-out said so.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-28', YDAY = '2026-10-27';
env.todayISO_ = () => DAY;
env.runlog_ = () => {};
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Support', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Pawan Probhu', 'pawan', 'pawan@example.com', '1', 'Renewals', 'Support', 'Yes']]);
const P = env.PropertiesService.getScriptProperties();
P.setProperty('ANTHROPIC_API_KEY', 'k');
env.inboxOn_ = () => true;
const cache = env.CacheService.getScriptCache();

// The list today: A carried from yesterday unchanged, B new this morning, C carried but its task has since moved.
const item = (k, at, task, status) => ({ k, at, task: task || '', status: status || 'open', from: 'kamla@x', subject: 'Subject ' + k, ask: 'Do ' + k, owner: 'Ricky', u: 'now', why: 'why', gist: 'gist ' + k, link: '' });
let LIST = [item('kA', 100), item('kB', 200), item('kC', 300, '00TC1')];
env.inboxView_ = () => ({ items: LIST, open: LIST.filter(x => x.status === 'open'), done: [], deep: env.ixDeepGet_(DAY) });
const rev = (k, n, post) => ({ post: post || ('Note for ' + k), done: 'Nothing yet.', read: 'Waiting', to: 'kamla', action: 'post', check: [], n });
env.bigPut_(env.ixDeepKey_(YDAY), { kA: rev('kA', '100||open'), kC: rev('kC', '300||open'), kOld: rev('kOld', '9||open') });
env.bigPut_(env.ixDeepKey_(DAY), { kB: rev('kB', '200||open', 'Today\'s note for kB') });

console.log('\nCarried reviews:\n');
const G = env.ixDeepGet_(DAY);
ok('today\'s store holds yesterday\'s reviews it does not have', G.kA && G.kC && G.kB && G.kA.post === 'Note for kA', Object.keys(G).join());
ok('today\'s review wins over a carried one', G.kB.post === 'Today\'s note for kB');
const carried = env.ixDeepCarryNow_(DAY);
const mine = env.bigGet_(env.ixDeepKey_(DAY), {});
ok('carried into today\'s own store, only what is still on the list', carried === 2 && mine.kA && mine.kC && !mine.kOld, carried + ' · ' + Object.keys(mine).join());

console.log('\nThe review:\n');
env.cmdTargets_ = () => [{ sid: 'kamla', id: '005K', name: 'Kamla Dookran' }, { sid: 'ricky', id: '005R', name: 'Ricky Rampersad' }];
env.sfkUsers_ = () => ({ kamla: { id: '005K' }, ricky: { id: '005R' } });
env.ixThread_ = () => []; env.ixTaskFor_ = () => null; env.bmDeepRows_ = () => []; env.bmDeepMail_ = () => []; env.cmdChatter_ = () => ({});
const asked = [];
env.claudeFetchAll_ = (key, reqs) => reqs.map(r => { const ids = (r.prompt.match(/"id":"(k[A-Z])"/g) || []).map(s => s.slice(6, 8)); asked.push(ids);
  const js = {}; ids.forEach(id => { js[id] = { done: 'Nothing yet.', read: 'Fresh', to: 'kamla', task: false, task_subject: '', due: 1, post: 'Fresh note ' + id, check: [], action: 'post' }; });
  return { getResponseCode: () => 200, __text: JSON.stringify(js) }; });
env.claudeText_ = res => res.__text; env.claudeDraftModel_ = () => 'model';
cache.put('ix_busy_' + DAY, '1');
ok('a review already running: the clock does not start another', env.ixDeepWarm_(DAY, 60000) === 0 && asked.length === 0);
cache.remove('ix_busy_' + DAY);
const n = env.ixDeepWarm_(DAY, 60000);
const flat = asked.reduce((a, b) => a.concat(b), []);
ok('only the item whose task moved is asked of Claude; the carried and today\'s are kept', n === 1 && flat.join() === 'kC', n + ' · ' + flat.join());
const after = env.bigGet_(env.ixDeepKey_(DAY), {});
ok('the store keeps only today\'s list', after.kA && after.kB && after.kC && !after.kOld && after.kC.post === 'Fresh note kC', Object.keys(after).join());
ok('and the busy mark is cleared when it ends', !cache.get('ix_busy_' + DAY));

console.log('\nFrom the page:\n');
const sig = env.unitSig_('ricky');
ok('a stale page is refused', env.ixReviewNow({ rs: 'ricky', f: 'unit', k: 'nope', keys: ['kA'] }).ok === false);
ok('nobody else\'s page asks for his inbox', env.ixReviewNow({ rs: 'kamla', f: 'unit', k: env.unitSig_('kamla'), keys: ['kA'] }).ok === false);
LIST = LIST.concat([item('kD', 400)]);
asked.length = 0;
env.claudeFetchAll_ = (key, reqs) => reqs.map(() => ({ getResponseCode: () => 529, __text: '' }));   // Claude busy: kD stays unreviewed
const R = env.ixReviewNow({ rs: 'ricky', f: 'unit', k: sig, keys: ['kA', 'kD'] });
ok('each reviewed item comes back built as the page builds it; what is left is counted', R.ok && /Claude reviewed it/.test(R.html.kA) && /name="ixpt_kA"/.test(R.html.kA) && /Note for kA/.test(R.html.kA) && !R.html.kD && R.left === 1, JSON.stringify({ keys: Object.keys(R.html), left: R.left }));
cache.put('ix_busy_' + DAY, '1');
const R2 = env.ixReviewNow({ rs: 'ricky', f: 'unit', k: sig, keys: ['kA', 'kD'] });
ok('a review already running: the page is told busy, and still gets what is ready', R2.ok && R2.busy && !!R2.html.kA && R2.left === 1);
cache.remove('ix_busy_' + DAY);
ok('the page says Claude is on it, and starts it itself', /ixReviewNow\(P\)/.test(env.IX_WAIT_JS) && /\.ixwait/.test(env.IX_WAIT_JS));

console.log('\nSave in place:\n');
env.bigPut_('unit_ids_ricky_' + DAY, [{ id: '00T1', s: 'Agent task one', a: 'Neil R' }, { id: '00T2', s: 'Agent task two', a: 'Joy S' }]);
env.bigPut_('unit_mine_ricky_' + DAY, []);
env.bigPut_('unit_inbox_ricky_' + DAY, [{ k: 'kA', f: 'Kamla', s: 'Subject kA', e: '', w: 'today', g: '', a: 'Do kA', l: '' }]);
env.mgrPost_ = (o) => { if (o.ParentId === '00T2') throw new Error('Salesforce said no'); return '0D5'; };
env.inboxRows_ = () => [{ Key: 'kA', _row: 2, TaskId: '' }];
const sets = []; env.inboxSet_ = (row, set) => sets.push([row, set]);
env.gameBmSave_ = () => []; env.mgrRows_ = () => ({}); env.signInFromPage_ = () => null; env.dayLogMany_ = () => {}; env.umPostsAdd_ = () => {};
env.unitRole_ = () => 'Branch Manager';
env.replyPerson_ = (sid, f) => ({ staffId: sid, name: env.nameFor_(sid) });
let pageBuilt = 0; env.unitPage_ = () => { pageBuilt++; return 'PAGE'; };
const S = env.unitSaveNow({ rs: 'ricky', f: 'unit', k: sig, c_00T1: 'Called the client', c_00T2: 'Second note', ixd_kA: '1' });
ok('Save answers with what saved, without building the page again', S.ok && pageBuilt === 0 && /2 of 3 saved/.test(S.html), S.html && S.html.slice(0, 80));
ok('the fields of what saved are cleared; what did not keeps its words', S.fields.indexOf('c_00T1') > -1 && S.fields.indexOf('c_00T2') < 0 && S.fields.indexOf('ixd_kA') > -1, S.fields.join());
ok('the inbox item dealt with folds, with what was done', S.inbox.length === 1 && S.inbox[0].k === 'kA' && /dealt with/.test(S.inbox[0].res) && sets.length === 1);
ok('what did not save says why', /NOT SAVED: Salesforce said no/.test(S.html));
ok('a stale page is refused, nothing written', env.unitSaveNow({ rs: 'ricky', f: 'unit', k: 'nope', c_00T1: 'x' }).ok === false);
ok('nothing ticked: says so', /Nothing to save/.test(env.unitSaveNow({ rs: 'ricky', f: 'unit', k: sig }).html));
ok('the form still posts the old way when the page cannot call the script', /f\.submit\(\)/.test(env.UNIT_SAVE_JS) && /unitSaveNow\(o\)/.test(env.UNIT_SAVE_JS));

console.log('\nThe register, with the time they left:\n');
const atRows = [
  { Date: YDAY, StaffId: 'sasha', FirstSignIn: '08:03', SignedOut: '15:58', Status: 'in' },
  { Date: YDAY, StaffId: 'elizabeth', FirstSignIn: '07:53', SignedOut: '14:10', Status: 'in' },
  { Date: YDAY, StaffId: 'azariah', FirstSignIn: '08:07', SignedOut: '', Status: 'in' },
  { Date: DAY, StaffId: 'kamla', FirstSignIn: '07:41', SignedOut: '', Status: 'in' }];
env.hrRows_ = () => atRows;
env.branchClosed_ = () => false;
const A = env.workdayAtt_('ricky', DAY);
const cell = (sid, d) => A.desks.find(x => x.sid === sid).cells[A.days.findIndex(x => x.d === d)];
ok('Sasha Tuesday: in 8:03am, left 3:58pm, not early', cell('sasha', YDAY).t === '8:03am' && cell('sasha', YDAY).o === '3:58pm' && !cell('sasha', YDAY).early, JSON.stringify(cell('sasha', YDAY)));
ok('Liz Tuesday: left 2:10pm, 110 minutes before her 4pm', cell('elizabeth', YDAY).o === '2:10pm' && cell('elizabeth', YDAY).early === 110, JSON.stringify(cell('elizabeth', YDAY)));
ok('Azariah Tuesday: no sign-out, said so', cell('azariah', YDAY).noout === true && !cell('azariah', YDAY).o, JSON.stringify(cell('azariah', YDAY)));
ok('Kamla today: still in, no sign-out yet is not called missing', !cell('kamla', DAY).noout && !cell('kamla', DAY).o, JSON.stringify(cell('kamla', DAY)));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
