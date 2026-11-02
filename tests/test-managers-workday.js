// The managers' screen on My workday (29 October 2026, 2026-10-29f): what the tracker answers for Akaash and Mr Rampersad.
//
// Ricky, 6:45am, on Akaash: "remove the agent's performance ... look at grouping so he can see ... chatter on the fly ... If there
// is no task open, he has the ability to open it ... see that timeline from agents, staff, and managers as the day goes by".
// Pinned here: the unit's open tasks by agent (the manager first, then by name, never by count), pendings first in each, the
// agents with nothing open listed too; today's notes on those tasks from agents, staff and managers, newest first, the
// tracker's follow-ups and the chase left out; read once and kept three minutes; a task opens with its notes and what to do;
// a comment goes on its Chatter headed as his; Close for the agent needs a note that says what was done; Draft my reply is
// Claude's, for the managers; a task opened for an agent goes to the desk for its type, the agent named, his note on it first;
// his numbers save and sign him in; nothing on the unit is a performance figure; his e-mails open the screen.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-29';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'], ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Akaash', 'Yes'],
   ['Azariah Griffith', 'azariah', 'az@example.com', '1', 'Sales Support', 'Support', 'Yes'], ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Branch', 'Yes'], ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support', 'Support', 'Yes']]);
env.__mkSheet('Manager Day', 2, env.MGRDAY.head, []);
const U = { ricky: 'U_R', akaash: 'U_AK', azariah: 'U_AZ', sasha: 'U_S', kamla: 'U_K', elizabeth: 'U_E' };
env.sfkUsers_ = () => Object.fromEntries(Object.entries(U).map(([k, v]) => [k, { id: v }]));
env.bmSfId_ = () => U.ricky;
env.unitAgents_ = () => ['Akaash Kalladeen', 'Darryl Manick', 'Joy Barbara Sammah', 'Rajiv Soodoo'];
const at = (h, m) => '2026-10-29T' + String(h + 4).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0') + ':00.000+0000';
const TASK = (Id, Subject, ty, agent, owner, due, extra) => Object.assign({ Id, Subject, Task_Type__c: ty, ActivityDate: due, Status: 'Open', Owner: { Name: owner }, Agent__c: '003' + agent.slice(0, 3), Agent__r: { Name: agent }, LastModifiedDate: '2026-10-28T12:00:00.000+0000', CreatedDate: '2026-10-20T12:00:00.000+0000' }, extra || {});
const OPEN = [TASK('00TD1', 'Servicing - beneficiary - Khan', 'Servicing', 'Darryl Manick', 'Elizabeth Lee', '2026-10-29'),
  TASK('00TD2', 'Pending - ECG - Marcus Bailey', 'Pendings', 'Darryl Manick', 'Azariah Griffith', '2026-10-26', { LastModifiedDate: '2026-10-19T12:00:00.000+0000' }),
  TASK('00TJ1', 'Pending - signature - Boodram', 'Pendings', 'Joy Barbara Sammah', 'Azariah Griffith', '2026-10-23'),
  TASK('00TA1', 'Own - review - Ali', 'Opportunity', 'Akaash Kalladeen', 'Akaash Kalladeen', '2026-10-30')];
const NOTES = [{ ParentId: '00TD2', CreatedById: U.ricky, CreatedDate: at(13, 54), Body: 'Agent · Darryl Manick · Thu 29 Oct 1:54pm\n\nThe client did the ECG this morning.' },
  { ParentId: '00TD2', CreatedById: U.azariah, CreatedDate: at(9, 5), Body: 'Booked the clinic for Thursday.' },
  { ParentId: '00TJ1', CreatedById: U.ricky, CreatedDate: at(8, 0), Body: 'FOLLOW-UP: no note for five days.' },
  { ParentId: '00TJ1', CreatedById: U.ricky, CreatedDate: at(11, 40), Body: 'Unit Manager · Akaash Kalladeen · Thu 29 Oct 11:40am\n\nJoy, bring the signature page Friday.' }];
let queries = [];
env.sfkQuery_ = q => { queries.push(q);
  if (/FROM Task WHERE IsClosed = false AND Agent__r.Name IN/.test(q)) return OPEN;
  if (/FROM Task WHERE IsClosed = true/.test(q)) return [{ Id: '00TC1', Subject: 'x', CompletedDateTime: at(10), Agent__r: { Name: 'Darryl Manick' } }];
  if (/FROM FeedItem/.test(q)) return NOTES; if (/FROM FeedComment/.test(q)) return []; if (/FROM User/.test(q)) return [];
  if (/SELECT Agent__c FROM Task WHERE Agent__r.Name/.test(q)) return [{ Agent__c: '003RAJ' }];
  return []; };
const inserted = []; env.sfkInsert_ = (o, b) => { inserted.push([o, b]); return o === 'Task' ? '00TNEW' : 'FEED'; };
const patched = []; env.sfkPatchTask_ = (id, b) => patched.push([id, b]);
env.mgrPost_ = (obj) => { inserted.push(['FeedItem', obj]); return 'FEED'; };
env.taskChangeLog_ = () => {}; env.sfkForgetDay_ = () => {};
console.log('\nThe unit, by agent:\n');
const u = env.wdUnit_('akaash', DAY);
ok('by agent: Akaash first, then by name; never by count', u.agents.map(g => g.a).join('|') === 'Akaash Kalladeen|Darryl Manick|Joy Barbara Sammah|Rajiv Soodoo', u.agents.map(g => g.a).join('|'));
const d = u.agents[1];
ok('Darryl: 2 open, 1 overdue, 1 pending; the pending first, who has it, how long untouched', d.n === 2 && d.late === 1 && d.pend === 1 && d.tasks[0].id === '00TD2' && d.tasks[0].o === 'Azariah' && d.tasks[0].stale === 10 && d.tasks[0].late, JSON.stringify(d));
ok('Rajiv, nothing open, listed so a task can be opened for him', u.agents[3].n === 0 && u.agents[3].tasks.length === 0);
ok('the totals: open, overdue, pendings, closed today', u.open === 4 && u.late === 2 && u.pend === 2 && u.closedToday === 1, JSON.stringify([u.open, u.late, u.pend, u.closedToday]));
ok('no performance figure in it', !/api|production|persist|rank|goal|fact/i.test(JSON.stringify(Object.keys(u)) + JSON.stringify(u.agents.map(g => Object.keys(g)))));
console.log('\nThe day, as it happens:\n');
ok('today\'s notes on the unit\'s tasks, newest first, who and in what role', u.timeline.length === 3 && u.timeline[0].who === 'Darryl' && u.timeline[0].role === 'agent' && u.timeline[0].at === '1:54pm' && u.timeline[1].who === 'Akaash' && u.timeline[1].role === 'Unit Manager' && u.timeline[2].who === 'Azariah' && u.timeline[2].role === 'sales support', JSON.stringify(u.timeline.map(x => x.who + ':' + x.role)));
ok('the tracker\'s follow-up left out', !u.timeline.some(x => /FOLLOW-UP/.test(x.s)));
ok('on which task and for which agent', u.timeline[0].on === 'Pending - ECG - Marcus Bailey' && u.timeline[0].a === 'Darryl');
queries = []; env.wdUnit_('akaash', DAY);
ok('read once, kept three minutes', queries.length === 0);
console.log('\nA task, from the screen:\n');
const person = { staffId: 'akaash', name: 'Akaash Kalladeen' };
env.cmdChatter_ = ids => ({ [ids[0]]: [{ text: 'Agent · Darryl Manick · Thu 29 Oct 1:54pm\n\nThe client did the ECG this morning.', by: 'Ricky Rampersad', day: DAY }] });
let r = env.wdUnitAct_(person, 'akaash', DAY, { sub: 'open', id: '00TD2' });
ok('it opens with its notes and what to do', r.ok && r.notes.length === 1 && r.notes[0].who === 'Darryl Manick' && r.a === 'Darryl Manick' && r.todo, JSON.stringify(r).slice(0, 200));
ok('a task that is not the unit\'s is refused', !env.wdUnitAct_(person, 'akaash', DAY, { sub: 'open', id: '00TXX' }).ok);
r = env.wdUnitAct_(person, 'akaash', DAY, { sub: 'note', id: '00TD2', text: 'Azariah, chase underwriting for the ECG result by Friday.' });
const lastPost = inserted[inserted.length - 1][1];
ok('his comment goes on its Chatter, headed as the Unit Manager', r.ok && lastPost.ParentId === '00TD2' && /^Unit Manager · Akaash Kalladeen · Thu 29 Oct/.test(lastPost.Body) && /chase underwriting/.test(lastPost.Body), JSON.stringify(lastPost));
r = env.wdUnitAct_(person, 'akaash', DAY, { sub: 'close', id: '00TD1', text: 'ok' });
ok('Close for the agent wants a note that says what was done', !r.ok && /too short/i.test(r.error), JSON.stringify(r));
r = env.wdUnitAct_(person, 'akaash', DAY, { sub: 'close', id: '00TD1', text: 'Spoke to Mr Khan: the beneficiary form is signed and lodged with Policy Services today.' });
ok('with one, it is closed for Darryl, his note the closing note', r.ok && r.closed && patched.some(p => p[0] === '00TD1' && p[1].Status === 'Completed') && /closed for Darryl/.test(inserted[inserted.length - 1][1].Body), JSON.stringify(r));
let asked = 0; env.umReplyDraft_ = (sid, day, it, o) => { asked++; return { ok: true, reply: 'Azariah, ' + it.a + '...', said: o.said }; };
r = env.wdUnitAct_(person, 'akaash', DAY, { sub: 'draft', id: '00TD2', said: 'chase uw' });
ok('Draft my reply: Claude, for the task, with his words', r.ok && asked === 1 && r.said === 'chase uw');
console.log('\nA task for an agent with nothing open:\n');
r = env.wdUnitAct_(person, 'akaash', DAY, { sub: 'new', agent: 'Rajiv Soodoo', subject: 'Boodram - signature for 1000123456', type: 'Pendings', text: 'Azariah, Rajiv brings the signed page Friday.' });
const task = inserted.filter(x => x[0] === 'Task').pop();
ok('opened: Pendings with Azariah, Rajiv named, due today', r.ok && task[1].OwnerId === U.azariah && task[1].Agent__c === '003RAJ' && task[1].Task_Type__c === 'Pendings' && task[1].ActivityDate === DAY && /Opened for Rajiv, with Azariah/.test(r.msg), JSON.stringify(task));
ok('his note on it first, headed as his', inserted[inserted.length - 1][1].ParentId === '00TNEW' && /^Unit Manager · Akaash Kalladeen/.test(inserted[inserted.length - 1][1].Body));
ok('he may give it to another desk; a premium due goes to Sasha by itself', env.wdUnitDesk_('Renewa/PDl/Bill') === 'sasha' && env.wdUnitDesk_('Training') === 'kamla');
ok('an agent not in his unit, or no note, is refused', !env.wdUnitAct_(person, 'akaash', DAY, { sub: 'new', agent: 'Neil Ramnanan', subject: 'Something for Neil here', text: 'x' }).ok &&
  !env.wdUnitAct_(person, 'akaash', DAY, { sub: 'new', agent: 'Rajiv Soodoo', subject: 'Boodram - signature', text: '' }).ok);
console.log('\nHis numbers, and the route:\n');
let signed = 0; env.signInFromPage_ = () => { signed++; return { at: '06:05' }; }; env.umCopy_ = () => {};
r = env.wdUnitAct_(person, 'akaash', DAY, { sub: 'plan', p_coach: '2', n_coach: 'Darryl on pendings' });
ok('his day saves, and signs him in', r.ok && signed === 1 && env.mgrRows_('akaash', DAY, 'plan').coach.Planned == '2' && /signed in 6:05am/.test(r.msg), JSON.stringify(r));
ok('the screen reads it back', env.wdUnitChecks_('akaash', DAY).find(c => c.id === 'coach').v === '2');
env.wdAuth_ = () => ({ sid: 'sasha' }); env.workdayPerson_ = sid => ({ staffId: sid, name: sid });
ok('a desk cannot use it', env.workdayPost_({ act: 'unit', sub: 'open', id: '00TD2' }).ok === false);
const src = f => env[f].toString();
ok('his morning and progress e-mails open the screen at the unit, each task too, the old page below', /workGoUrl_\(sid, 'unit'\)/.test(src('sendUnitManagerMorning_')) && /workGoUrl_\(sid, 'unit', id\)/.test(src('sendUnitManagerMorning_')) && /workGoUrl_\(sid, 'unit'\)/.test(src('sendUnitManagerProgress_')) && /wdMgrOldLine_/.test(src('sendUnitManagerProgress_')));
ok('Akaash\'s model and his carry the unit', /wdUnitModel_\(m, sid, day\)/.test(src('workdayModel_')) && /wdUnitModel_\(m, 'ricky', day\)/.test(src('workdayLeadModel_')));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
