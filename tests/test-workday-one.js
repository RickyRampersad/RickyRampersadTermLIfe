// My workday is the one screen (29 October 2026, 2026-10-29a): what the tracker answers for it.
//
// Ricky, 6:15am: the dark My workday and the white day page do the same thing, so the dark one does it all. Pinned here:
//   - the page's tasks join the day's card list, so a card can act on them; a task not on the day is refused;
//   - a card opens with what to do, its last notes and the templates; Close now goes through cardAct_ with every rule it has;
//   - what came up becomes tasks, one a line; nothing at all is refused;
//   - the close-out comes as data and closes through hkCloseCore_, the page's own save; Check out signs a manager out;
//   - the Branch Manager and the unit managers have no cards and no close-out here; the close-out page still works.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
const DAY = '2026-10-29';
env.todayISO_ = () => DAY;
let who = 'sasha';
env.wdAuth_ = () => ({ sid: who });
env.workdayPerson_ = sid => ({ staffId: sid, name: sid === 'sasha' ? 'Sasha Lalla-Jagassar' : sid });
env.workdayModel_ = (sid, day) => ({ ok: true, sid, day, model: true });
env.replyPerson_ = (sid) => ({ staffId: sid, name: 'Sasha Lalla-Jagassar' });
env.nameFor_ = sid => ({ sasha: 'Sasha Lalla-Jagassar' }[sid] || sid);
const inserted = [], patched = [];
env.sfkInsert_ = (o, rec) => { inserted.push(rec); return { id: 'F1' }; };
env.sfkPatchTask_ = (id, f) => { patched.push([id, f]); };
env.taskChangeLog_ = () => {};
env.cmdChatter_ = ids => ({ [ids[0]]: [{ text: 'Sales Support · Sasha Lalla-Jagassar · Tue 27 Oct 9:02am\n\nCalled, no answer.', by: 'Sasha Lalla-Jagassar', day: '2026-10-27' }] });

console.log('\nThe card list:\n');
env.wdCardList_('sasha', DAY, [{ id: '00T1', s: 'Premium due: call back - 5001234567', ty: 'Renewa/PDl/Bill' }, { id: '00T3', s: 'Follow up with UW', ty: 'Pendings', due: '2026-10-27' }]);
let list = env.bigGet_('sd_list_sasha_' + DAY, []);
ok('the page\'s tasks join the day\'s card list', list.length === 2 && list.find(t => t.id === '00T3').due === '2026-10-27', JSON.stringify(list));
env.wdCardList_('sasha', DAY, [{ id: '00T1', s: 'x' }]);
ok('once each', env.bigGet_('sd_list_sasha_' + DAY, []).length === 2);
env.bigPut_('sd_list_sasha_' + DAY, env.bigGet_('sd_list_sasha_' + DAY, []).concat([{ id: '00T9', s: 'Take it', next: 1 }]));
env.wdCardList_('sasha', DAY, [{ id: '00T9', s: 'Take it', ty: 'Servicing' }]);
ok('a "take it into today" task on the page becomes one of the day\'s', env.bigGet_('sd_list_sasha_' + DAY, []).filter(t => t.id === '00T9').length === 1 && !env.bigGet_('sd_list_sasha_' + DAY, []).find(t => t.id === '00T9').next);

console.log('\nA card:\n');
const post = p => env.workdayPost_(Object.assign({ wd: who, k: 'K' }, p));
let r = post({ act: 'card', sub: 'open', id: '00T1' });
ok('it opens with what to do, the last note and the templates', r.ok && r.todo && r.notes.length === 1 && /Called, no answer/.test(r.notes[0].s) && r.tpl.length >= 2 && r.tpl.every(t => ['close', 'move', 'note'].indexOf(t.a) > -1) && r.min === '2026-10-30', JSON.stringify(r).slice(0, 300));
ok('a task not on the day is refused', !post({ act: 'card', sub: 'open', id: '00TX' }).ok);
r = post({ act: 'card', sub: 'close', id: '00T1', note: 'done' });
ok('the card\'s own rules hold: a note too thin to close on', !r.ok && /Too thin/.test(r.error), JSON.stringify(r));
r = post({ act: 'card', sub: 'close', id: '00T1', note: 'Spoke to the client: paying 552.29 by Friday through the bank, and she will call back.' });
ok('Close now: the note on Chatter, the task closed', r.ok && r.act === 'close' && inserted.some(x => x.ParentId === '00T1' && /552\.29/.test(x.Body)) && patched.some(x => x[0] === '00T1' && x[1].Status === 'Completed'), JSON.stringify(r));
r = post({ act: 'card', sub: 'move', id: '00T3', note: 'Waiting on underwriting until next week.', to: '2026-10-28' });
ok('Move now wants tomorrow or later', !r.ok && /tomorrow or later/.test(r.error));

console.log('\nWhat came up:\n');
const made = []; env.createTask_ = (t) => { made.push(t); return { ok: true }; };
r = post({ act: 'scrub', lines: 'Agent Persad asked for the Mohammed medicals\n\nok\nClient wants a statement', type: 'Pendings' });
ok('one task a line, in her day, of the type chosen; a word is not a task', r.ok && made.length === 2 && made.every(t => t.staffId === 'sasha' && t.due === DAY && t.type === 'Pendings') && r.out.length === 2, JSON.stringify(made));
ok('nothing written is refused', !post({ act: 'scrub', lines: '  ' }).ok);

console.log('\nClose my day:\n');
env.hkTasks_ = () => [{ id: '00T1', s: 'Premium due', closed: true, planned: true }, { id: '00T3', s: 'Follow up with UW', closed: false, planned: true }];
env.closeoutFor_ = () => ({ items: [{ id: 'hk_inbox', item: 'Inbox cleared', done: false }, { id: 'x_other', item: 'not a check' }] });
env.mailbagCard_ = () => null; env.innovationBlock_ = () => '';
r = post({ act: 'closeform' });
ok('the close-out as data: done, not done with a date to come, the checks', r.ok && r.form.done.length === 1 && r.form.open.length === 1 && r.form.open[0].id === '00T3' && r.form.open[0].d > DAY && r.form.checks.length === 1 && r.form.checks[0].id === 'hk_inbox', JSON.stringify(r.form));
let core = null; env.hkCloseCore_ = (person, day, p) => { core = p; return { ok: true, checks: [1], moved: 1, out: '16:02' }; };
r = post({ act: 'close', r_00T3: 'Waiting on UW', d_00T3: '2026-11-02', c_hk_inbox: 'Done', out: '1' });
ok('Close goes through the close-out\'s own save, and answers with the day', r.ok && r.model && core.r_00T3 === 'Waiting on UW' && core.out === '1' && r.closed.out === '4:02pm', JSON.stringify(r));
env.hkCloseCore_ = () => ({ ok: false, error: '1 answer is missing.' });
ok('and says what is missing', post({ act: 'close' }).error === '1 answer is missing.');

console.log('\nCheck out, and who may do what:\n');
env.signOutDay_ = () => ({ ok: true, out: '15:05' });
who = 'akaash';
r = post({ act: 'signout' });
ok('a manager checks out', r.ok && r.signedOut === '3:05pm');
ok('and has no cards or close-out here', !post({ act: 'card', sub: 'open', id: '00T1' }).ok && !post({ act: 'closeform' }).ok);
who = 'ricky';
ok('nor the Branch Manager', !post({ act: 'scrub', lines: 'Something to do today' }).ok);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
