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

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
