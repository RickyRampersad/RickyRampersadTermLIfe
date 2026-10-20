// Branch Intelligence asks why, and Mr Rampersad's whole-branch page (19 October 2026).
//
// Ricky: "use AI intelligence: if there are no Chatter notes on a task,
// especially over 3 days, post a note asking why, especially when tasks are
// being moved forward." And, of Akaash's My unit: "And me?" — the whole branch.
//
// Pinned here: a task with no note from a person in 3+ days is asked about,
// worst first; a task asked about in the last 3 days is left alone; a date
// moved forward with no note is caught the next day, logged, and asked about
// first; a move with a note is not; Claude writes the note when a key is set,
// a plain question when not or when Claude fails; a dry run posts nothing;
// Mr Rampersad gets the list; CHASE_QUIET = off stops it; the history under a
// task shows its date moves. My branch: every agent, grouped by unit.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  [['ricky@example.com', 'Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
   ['akaash@example.com', 'Akaash Kalladeen', 'A06869', '1', 'Unit Manager', 'Akaash Kalladeen', 'Active'],
   ['azariah@example.com', 'Azariah Griffith', 'AG003', '1', 'Staff', 'Azariah Griffith', 'Active'],
   ['liz@example.com', 'Elizabeth Lee', 'EL004', '1', 'Staff', 'Elizabeth Lee', 'Active']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R', active: true }, azariah: { id: '005A', active: true }, elizabeth: { id: '005E', active: true } });
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'FEED'; };
let TASKS = [];
const queries = [];
env.sfkQuery_ = q => { queries.push(q); if (/FROM Task/.test(q) && /OwnerId IN/.test(q)) return TASKS; return []; };
const T = (id, subj, owner, ownerId, due, created) => ({ Id: id, Subject: subj, Task_Type__c: 'Pendings', ActivityDate: due, Status: 'In Progress', CreatedDate: created + 'T12:00:00.000+0000', OwnerId: ownerId, Owner: { Name: owner }, Agent__r: { Name: 'Darryl Manick' }, What: { Name: 'Client Q' } });
let CHAT = {};
env.cmdChatter_ = () => CHAT;
const BI = d => ({ day: d, by: 'Integration', text: 'Branch Intelligence · ' + d + ' 9:15am Liz, where does it stand?' });
const H = (d, by, t) => ({ day: d, by, text: t });

console.log('\nDay one: tasks gone quiet\n');
env.todayISO_ = () => '2026-10-19';
TASKS = [T('00T1', 'Medical outstanding on a new application', 'Elizabeth Lee', '005E', '2026-10-16', '2026-10-01'),
         T('00T2', 'Signed proposal still to come', 'Azariah Griffith', '005A', '2026-10-21', '2026-10-12'),
         T('00T3', 'Change of address on a policy', 'Azariah Griffith', '005A', '2026-10-15', '2026-10-10'),
         T('00T4', 'Cash value statement', 'Elizabeth Lee', '005E', '2026-10-18', '2026-10-01'),
         T('00T5', 'Beneficiary change form', 'Elizabeth Lee', '005E', '2026-10-22', '2026-10-15')];
CHAT = { '00T1': [H('2026-10-14', 'Elizabeth Lee', 'Medical ordered.')], '00T2': [H('2026-10-18', 'Azariah Griffith', 'Client signing Tuesday.')],
         '00T4': [BI('2026-10-18'), H('2026-10-10', 'Elizabeth Lee', 'Asked the department.')], '00T5': [H('2026-10-17', 'Elizabeth Lee', 'Form sent to the client.')] };
let r = env.chaseQuiet_('2026-10-19', true);
ok('a dry run says what it would ask, and posts nothing', r.done.length === 2 && posts.length === 0 && mails.length === 0, r.done.map(d => d.t.id + ' ' + d.why).join(' | '));
r = env.chaseQuiet_('2026-10-19', false);
ok('asks on the two quiet tasks, the longest quiet first', posts.length === 2 && posts[0][1].ParentId === '00T3' && posts[1][1].ParentId === '00T1', posts.map(p => p[1].ParentId).join(','));
ok('the one with no note since it was opened, said so', /^Branch Intelligence · Mon 19 Oct /.test(posts[0][1].Body) && /Azariah, there is no note on this task in the 9 days since it was opened/.test(posts[0][1].Body), posts[0][1].Body);
ok('the one quiet 5 days, asked where it stands and the next step', /Elizabeth, no note on this task in 5 days\. Where does it stand, what is outstanding, and what is the next step and its date\?/.test(posts[1][1].Body));
ok('a task asked about yesterday is left alone; one noted 2 days ago too', !posts.some(p => ['00T4', '00T2', '00T5'].includes(p[1].ParentId)));
ok('only the desks\' tasks, due within the week or overdue', queries.some(q => /OwnerId IN \('005A','005E'\)|OwnerId IN \('005E','005A'\)/.test(q) && /ActivityDate <= 2026-10-26/.test(q)), queries[queries.length - 1]);
ok('Mr Rampersad gets the list', mails.length === 1 && mails[0].to === 'ricky@example.com' && /Branch Intelligence asked on 2 tasks/.test(mails[0].subject) && /Change of address on a policy/.test(mails[0].htmlBody));

env.__mkSheet('Workload Moves', 21, ['Date', 'At', 'TaskId', 'Subject', 'Type', 'From', 'To', 'Why', 'Result', 'UndoneAt'], []);

console.log('\nDay two: a date moved forward with no note\n');
env.todayISO_ = () => '2026-10-20';
posts.length = 0; mails.length = 0;
TASKS[1] = T('00T2', 'Signed proposal still to come', 'Azariah Griffith', '005A', '2026-10-28', '2026-10-12');   // moved 21 → 28, no note
TASKS[4] = T('00T5', 'Beneficiary change form', 'Elizabeth Lee', '005E', '2026-10-29', '2026-10-15');        // moved 22 → 29, with a note
CHAT['00T1'] = [BI('2026-10-19')].concat(CHAT['00T1']); CHAT['00T3'] = [BI('2026-10-19')];
CHAT['00T5'] = [H('2026-10-19', 'Elizabeth Lee', 'Client away until next week, new date the 29th.')].concat(CHAT['00T5']);
r = env.chaseQuiet_('2026-10-20', false);
ok('the moved task is asked about, first', posts.length >= 1 && posts[0][1].ParentId === '00T2', posts.map(p => p[1].ParentId).join(','));
ok('saying the date moved from 21 to 28 Oct with no note', /Azariah, the date on this task moved from Wed 21 Oct to Wed 28 Oct with no note\. What held it up/.test(posts[0][1].Body), posts[0][1].Body);
ok('a move with a note is not asked about', !posts.some(p => p[1].ParentId === '00T5'));
ok('tasks asked yesterday are left alone today', !posts.some(p => ['00T1', '00T3'].includes(p[1].ParentId)));
const mv = env.SpreadsheetApp.getActive().getSheetByName('Due Moves');
ok('the tracker\'s own Workload Moves tab is left alone', env.SpreadsheetApp.getActive().getSheetByName('Workload Moves')._grid.length === 1);
ok('both moves are logged, noted or not', !!mv && mv._grid.length === 3 && mv._grid.some(x => x[1] === '00T2' && x[7] === 'no') && mv._grid.some(x => x[1] === '00T5' && x[7] === 'yes'), mv && JSON.stringify(mv._grid.slice(1)));
env._dueMovesMemo = null;
ok('and the history under the task says so', env.dueMovesLine_(env.dueMovesByTask_()['00T2']) === 'due date moved 1 time · last Wed 21 Oct → Wed 28 Oct, with no note', env.dueMovesLine_(env.dueMovesByTask_()['00T2']));

console.log('\nClaude writes the note when a key is set:\n');
env.todayISO_ = () => '2026-10-23';
posts.length = 0;
env.PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', 'test-key');
let sentPrompt = '';
env.UrlFetchApp = { fetch: (u, o) => { sentPrompt = JSON.parse(o.payload).messages[0].content;
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: '{"00T1":"Elizabeth, the medical for Darryl\'s client has had no note since the 14th. Has the clinic booked it, and when will the results reach underwriting?"}' }] }) }; } };
r = env.chaseQuiet_('2026-10-23', false);
const p1 = posts.find(p => p[1].ParentId === '00T1');
ok('Claude reads the task and its notes', /Medical outstanding on a new application/.test(sentPrompt) && /Medical ordered\./.test(sentPrompt) && /never invent facts/.test(sentPrompt));
ok('and its note is the one posted', !!p1 && /Has the clinic booked it/.test(p1[1].Body), p1 && p1[1].Body);
ok('a task Claude left out still gets the plain question', posts.filter(p => p[1].ParentId !== '00T1').every(p => /no note on this task|the date on this task moved/.test(p[1].Body)));
posts.length = 0;
env.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 529, getContentText: () => 'overloaded' }) };
CHAT['00T1'] = [H('2026-10-14', 'Elizabeth Lee', 'Medical ordered.')];
r = env.chaseQuiet_('2026-10-23', false);
ok('Claude unavailable: the plain question goes', posts.some(p => p[1].ParentId === '00T1' && /Elizabeth, no note on this task in 9 days/.test(p[1].Body)));

console.log('\nThe switch:\n');
ok('on unless CHASE_QUIET says off', env.chaseOn_() === true);
env.PropertiesService.getScriptProperties().setProperty('CHASE_QUIET', 'off');
ok('CHASE_QUIET = off stops it', env.chaseOn_() === false);

console.log('\nMy branch, for Mr Rampersad:\n');
env.skillBank_ = () => ({ 'darryl manick': { name: 'Darryl Manick', isAgent: true, active: true, unit: 'Akaash Kalladeen' },
  'stephanie rajkumar': { name: 'Stephanie Rajkumar', isAgent: true, active: true, unit: 'Akaash Kalladeen' },
  'javid ali': { name: 'Javid Ali', isAgent: true, active: true, unit: 'Ricky Rampersad' },
  'left agent': { name: 'Left Agent', isAgent: true, active: false, unit: 'Ricky Rampersad' } });
ok('every active agent in the branch, Mr Rampersad first', env.unitAgents_('ricky').join('|') === 'Ricky Rampersad|Darryl Manick|Stephanie Rajkumar|Javid Ali', env.unitAgents_('ricky').join('|'));
env.unitBook_ = () => ({ agents: env.unitAgents_('ricky'), open: [{ id: '00T1', subject: 'Medical outstanding', agent: 'Darryl Manick', owner: 'Elizabeth Lee', due: '2026-10-16', late: true, ty: 'Pendings', touched: 9, status: 'In Progress', account: 'Client Q', created: '2026-10-01' }], closedYday: 0, closedToday: [] });
env.openQueries_ = () => []; env.ff360Feed_ = () => null; env.goalFor_ = () => null; env.agentDaySummary_ = () => []; env.ppmLetters_ = () => []; env.signedInAt_ = () => '';
env.cmdChatter_ = () => ({});
const page = env.replyClick_({ parameter: Object.fromEntries(new URL(env.unitUrl_('ricky')).searchParams) }).getContent();
ok('his link opens My branch', /My branch · /.test(page), page.slice(0, 200).replace(/<[^>]+>/g, ' '));
ok('agents grouped by unit in the drop-down', /<optgroup label="Akaash Kalladeen"><option value="darryl manick">/.test(page) && /<optgroup label="Ricky Rampersad">/.test(page));
ok('and the history under the task shows the date move', /due date moved 1 time · last Wed 21 Oct/.test(page) || !/00T2/.test(page));
ok('his notes are signed as Branch Manager', /Branch Manager/.test(env.unitRole_('ricky')) && env.unitRole_('akaash') === 'Unit Manager');

console.log('\nMy tasks, on My branch:\n');
const MINE = [T('00TM1', 'Investment Discussions - Neal Balroop', 'Ricky Rampersad', '005R', '2026-09-18', '2026-08-01'),
              T('00TM2', 'Premium follow up - New Quote - Shivonne Sammy', 'Ricky Rampersad', '005R', '2026-10-23', '2026-10-01'),
              T('00TM3', 'Portfolio to Review - Ian Curtis Persad', 'Ricky Rampersad', '005R', '2026-09-17', '2026-08-01')];
MINE[0].Task_Type__c = 'Opportunity'; MINE[1].Task_Type__c = 'Opportunity'; MINE[2].Task_Type__c = 'Servicing';
const prevQ = env.sfkQuery_;
env.sfkQuery_ = q => /OwnerId = '005R'/.test(q) ? MINE : prevQ(q);
const patches = []; env.sfkPatchTask_ = (id, b) => { patches.push([id, b]); return true; };
posts.length = 0;
const mp = env.replyClick_({ parameter: Object.fromEntries(new URL(env.unitUrl_('ricky')).searchParams) }).getContent();
// 20 Oct 2026: his tasks moved from a My tasks tab to Important on My day, the first tab.
const mineSec = mp.slice(mp.indexOf('id="md-imp"'), mp.indexOf('id="md-log"'));
ok('My day is the first tab, before Branch work, with his tasks under Important', /data-tab="day">My day/.test(mp) && mp.indexOf('data-tab="day"') < mp.indexOf('data-tab="work"') && !/data-tab="mine"/.test(mp) && mineSec.length > 0);
ok('his tasks by type, counted, overdue shown', /New business \(2 · 1 overdue\)/.test(mineSec) && /Servicing \(1 · 1 overdue\)/.test(mineSec), (mineSec.match(/class="bh"[^>]*>[^<]*/g) || []).join(' | '));
ok('each with a tick to close, a date to move it, and a note', /name="done_00TM1"/.test(mineSec) && /type="date" name="mv_00TM1"/.test(mineSec) && /name="c_00TM1"/.test(mineSec));
const U = Object.fromEntries(new URL(env.unitUrl_('ricky')).searchParams);
let sv = env.replyPost_({ parameter: Object.assign({}, U, { mv_00TM3: '2026-10-27' }) }).getContent();
ok('a date moved with no reason is refused', /NOT MOVED: say why the date moves/.test(sv) && !patches.length);
sv = env.replyPost_({ parameter: Object.assign({}, U, { mv_00TM3: '2026-10-27', c_00TM3: 'Client travelling; review booked for the 27th.', done_00TM1: '1' }) }).getContent();
ok('with a reason it moves, and the reason goes on the task', patches.some(x => x[0] === '00TM3' && x[1].ActivityDate === '2026-10-27') && posts.some(x => x[1].ParentId === '00TM3' && /Branch Manager · Ricky Rampersad/.test(x[1].Body) && /review booked for the 27th/.test(x[1].Body)));
ok('the tick closes the other', patches.some(x => x[0] === '00TM1' && x[1].Status === 'Completed') && /closed/.test(sv));
const tc = env.SpreadsheetApp.getActive().getSheetByName('Task Changes');
ok('both changes kept with before and after, to undo', !!tc && tc._grid.some(r => r[2] === '00TM3' && r[4] === 'Due date' && r[5] === '2026-09-17' && r[6] === '2026-10-27') && tc._grid.some(r => r[2] === '00TM1' && r[4] === 'Status' && r[6] === 'Completed'), tc && JSON.stringify(tc._grid.slice(1)));
ok('and the move is on Due Moves, noted', env.SpreadsheetApp.getActive().getSheetByName('Due Moves')._grid.some(r => r[1] === '00TM3' && r[7] === 'yes'));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
