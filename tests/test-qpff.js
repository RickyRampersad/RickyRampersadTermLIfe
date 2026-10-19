// The Query Pal deep dive and the fact-find chase (18 October 2026).
//
// "Also in Query Pal, a deep dive. Also in the agents' fact find, if a person
// is not doing it, it should trigger an e-mail requesting a response."
//
// Pinned here: the deep dive reads turnaround from each query's own promise,
// names who holds the late ones and which department is slow, and says it in
// sentences; the chase asks only the agents with no fact find in fourteen
// days, once, keeps the answer, gives the manager a task when help is asked,
// reminds only the silent, and gives the managers the week on Friday; its
// link is good all week and no longer; preview mode e-mails no agent.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const readTabs = env => (k, tab) => {
  const sh = env.__sheets[tab]; if (!sh) return [];
  const [h, ...rows] = sh._grid;
  return rows.map(r => { const o = {}; h.forEach((c, j) => { if (o[c] === undefined || o[c] === '') o[c] = r[j] === undefined ? '' : r[j]; }); return o; });
};

/* ── The Query Pal deep dive ────────────────────────────────────────────── */
{
  const env = makeEnv();
  const DAY = '2026-10-18';
  env.todayISO_ = () => DAY;
  const H = ['Reference', 'Timestamp', 'Status', 'Logged By', 'Client/Name', 'Agent', 'Category', 'Query Type', 'Department', 'Turnaround', 'Priority', 'Subject',
             'Date Closed', 'Days to Close', 'Follow-ups', 'Survey Sent', 'Score', 'Feedback', 'Dept Replied', 'Assigned To', 'Assigned To'];
  env.__mkSheet('Queries', 1, H, [
    ['RRB/2026/090/Ann Client/Cash value', '10/9/2026 9:00:00', 'Open', 'Client', 'Ann Client', '', 'Docs', 'Statements – tax and csv', 'Customer Service – Chaguanas', '1 day', 'Normal', 'Cash value statement', '', '', 2, '', '', '', '', 'Elizabeth Lee', ''],
    ['RRB/2026/091/Bo Client/Tax', '10/16/2026 9:00:00', 'Open', 'Staff: Azariah Griffith', 'Bo Client', 'Neil Agent', 'Docs', 'Statements – tax and csv', 'RR Branch Sales Support', '5 days', 'Urgent — client waiting', 'Tax statements', '', '', 0, '', '', '', '2026-10-17', 'Azariah Griffith', ''],
    ['RRB/2026/080/Cy Client/Tax', '10/1/2026 9:00:00', 'Closed', 'Client', 'Cy Client', '', 'Docs', 'Statements – tax and csv', 'RR Branch Sales Support', '1 day', 'Normal', 'Tax statements', '10/2/2026', 1, 0, '10/2/2026', 5, '', '10/1/2026', 'Elizabeth Lee', ''],
    ['RRB/2026/081/Di Client/Surrender', '9/20/2026 9:00:00', 'Closed', 'Agent', 'Di Client', 'Neil Agent', 'Money', 'Surrenders', 'Customer Service – Chaguanas', '3 days', 'Normal', 'Surrender', '10/4/2026', 14, 4, '10/4/2026', 2, 'Took too long', '9/30/2026', 'Azariah Griffith', ''],
    ['RRB/2026/082/Ed Client/Tax', '10/12/2026 9:00:00', 'Closed', 'Client', 'Ed Client', '', 'Docs', 'Statements – tax and csv', 'RR Branch Sales Support', '1 day', 'Normal', 'Tax statements', '10/13/2026', 1, 0, '', '', '', '10/12/2026', 'Elizabeth Lee', ''],
    ['RRB/2026/083/Fi Client/Portal', '10/14/2026 9:00:00', 'Closed', 'Client', 'Fi Client', '', 'Tech', 'Online Customer Portal', 'GLOC Phone CSRs', '5 days', 'Normal', 'Portal', '10/15/2026', 1, 0, '', '', '', '10/14/2026', 'Azariah Griffith', '']
  ]);
  env.__mkSheet('Comments', 2, ['When', 'Reference', 'Author', 'Role', 'Comment'],
    [['10/17/2026 10:00:00', 'RRB/2026/091/Bo Client/Tax', 'Azariah Griffith', 'staff', 'Sent to the department']]);
  env.bookRows_ = readTabs(env);
  const d = env.qpDive_(DAY);
  console.log('\nThe deep dive reads each query against its own promise:\n');
  ok('two open, one past its own turnaround', d.open.length === 2 && d.over.length === 1 && d.over[0].code === 'RRB/2026/090', JSON.stringify(d.over.map(x => x.code)));
  ok('"1 day", "5 days" read as turnarounds', env.qpTurn_('1 day') === 1 && env.qpTurn_('10 days') === 10 && env.qpTurn_('Same day') === 0);
  ok('the urgent one is counted', d.urgent.length === 1);
  ok('silence on the trail is counted', d.quiet.length === 1 && d.quiet[0].code === 'RRB/2026/090');
  ok('the backlog is read from the last seven days', /opened and/.test(d.says[0]) || /closed against/.test(d.says[0]), d.says[0]);
  ok('it names who holds the late one, and the worst', d.says.some(s => /1 of 2 open queries are past their own turnaround; Elizabeth Lee holds 1\. The worst is RRB\/2026\/090, 9 days on a 1-day turnaround/.test(s)), JSON.stringify(d.says));
  ok('it names the slow department', d.says.some(s => /^Customer Service – Chaguanas is the slowest: 14 days on average against a 1–3-day turnaround, and 1 open query has had no reply/.test(s)), JSON.stringify(d.says));
  ok('it sees what clients ask most', d.says.some(s => /"Statements – tax and csv" is \d+% of what clients ask/.test(s)));
  ok('a low score is called back', d.says.some(s => /1 client scored us 3 or under/.test(s)) && d.low[0].code === 'RRB/2026/081');
  const page = env.qpDivePage_({ staffId: 'ricky', name: 'Ricky' }, DAY).getContent();
  ok('the page leads with tiles and sentences', /<div class="tiles">/.test(page) && /What it says/.test(page));
  ok('the late one is first under Act now, with its history', /Act now · past their turnaround \(1\)/.test(page) && /RRB\/2026\/090 · Cash value statement/.test(page) && /none yet/.test(page));
  ok('desks, departments, what clients ask, how they arrive, six weeks, satisfaction', ['By desk', 'Departments', 'What clients ask', 'How queries arrive', 'Six weeks', 'Client satisfaction'].every(t => page.indexOf(t) > -1));
  ok('it is read only: no form on it', !/<form/.test(page));
}

/* ── The fact-find chase ────────────────────────────────────────────────── */
{
  const env = makeEnv({ props: { FF_CHASE: 'live' } });
  let TODAY = '2026-10-19';                                  // a Monday
  env.todayISO_ = () => TODAY;
  env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
    [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
     ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Unit', 'Yes']]);
  env.bookRows_ = readTabs(env);
  const AG = { 'a-ann': { key: 'a-ann', name: 'Ann Agent', agentName: 'Ann Agent', email: 'ann@example.com', code: 'A1' },
               'a-bob': { key: 'a-bob', name: 'Bob Agent', agentName: 'Bob Agent', email: 'bob@example.com', code: 'A2' },
               'a-cy':  { key: 'a-cy',  name: 'Cy Agent',  agentName: 'Cy Agent',  email: 'cy@example.com',  code: 'A3' },
               'a-dee': { key: 'a-dee', name: 'Dee Agent', agentName: 'Dee Agent', email: 'dee@example.com', code: 'A4' } };
  env.agentPeople_ = () => AG;
  env.agentManagerEmail_ = () => 'akaash@example.com';
  env.managerEmails_ = () => ['ricky@example.com'];
  env.sfkUsers_ = () => ({ ricky: { id: '005R' }, akaash: { id: '005A' } });
  env.bmSfId_ = () => '005R';
  env.goalFor_ = () => ({ ffWk: 3 });
  let feed = { leaders: [{ name: 'Cy Agent', count: 1 }], monthLeaders: [{ name: 'Cy Agent', count: 2 }, { name: 'Ann Agent', count: 0 }], yearLeaders: [{ name: 'Ann Agent', count: 4 }] };
  env.ff360Feed_ = () => feed;
  let FF = [{ Agent_Email__c: 'ann@example.com', Date_of_Interview__c: '2026-09-15' }, { Agent_Email__c: 'bob@example.com', Date_of_Interview__c: '2026-10-16' }];
  const soql = [];
  env.sfkQuery_ = q => { soql.push(q); return /Fact_Finding_Interviews__c/.test(q) ? FF.filter(r => q.indexOf("'" + r.Agent_Email__c + "'") > -1) : []; };
  const tasks = [];
  env.sfkInsert_ = (o, b) => { tasks.push([o, b]); return '00TNEW'; };
  const mails = [];
  env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };

  console.log('\nWho is asked:\n');
  const st = env.ffStatus_(TODAY);
  const by = {}; st.forEach(s => { by[s.a.key] = s; });
  ok('none in fourteen days is not active', !by['a-ann'].active && by['a-ann'].since === 34, JSON.stringify(by['a-ann'].since));
  ok('a fact find three days ago is active', by['a-bob'].active);
  ok('nothing in Salesforce but one this week on FactFind360 is active', by['a-cy'].active);
  ok('nothing anywhere is not active', !by['a-dee'].active && by['a-dee'].since === null);
  ok('the longest gone come first', st[0].a.key === 'a-dee' && st[1].a.key === 'a-ann');

  console.log('\nMonday, from seven:\n');
  ok('before seven, nothing', env.ffChaseTick_(TODAY, 6 * 60 + 50).length === 0 && !mails.length);
  let out = env.ffChaseTick_(TODAY, 7 * 60 + 10);
  ok('the two with none are asked', mails.length === 2 && mails.map(m => m.to).sort().join() === 'ann@example.com,dee@example.com', JSON.stringify(mails.map(m => m.to)));
  ok('sales support copied', mails.every(m => /rickyrampersadsalessupport@myguardiangroup\.com/.test(m.cc)));
  const ann = mails.find(m => m.to === 'ann@example.com');
  ok('it says when the last one was, and asks for a response', /Fact finds: your response is required · Ann Agent/.test(ann.subject) && /Tue 15 Sep/.test(ann.htmlBody) && /34 days ago/.test(ann.htmlBody));
  ok('the button is a week link to the response page', /f=agff/.test(ann.htmlBody) && /d=2026-10-19/.test(ann.htmlBody));
  env.ffChaseTick_(TODAY, 7 * 60 + 20);
  ok('asked once, not every ten minutes', mails.length === 2);

  console.log('\nThe response:\n');
  TODAY = '2026-10-20';
  const ANN = { staffId: 'a-ann', name: 'Ann Agent', agent: AG['a-ann'] };
  let page = env.ffReplyPage_(ANN, '2026-10-19', '').getContent();
  ok('the page shows the record and asks', /Your fact finds · week of/.test(page) && /since your last fact find/.test(page) && /What has stopped the fact finds\?/.test(page) && /name="commit"/.test(page));
  ok('the link is good all week', env.replyWeekLink_('agff', '2026-10-19') && !env.replyWeekLink_('cmd', '2026-10-19'));
  TODAY = '2026-10-27';
  ok('and no longer', !env.replyWeekLink_('agff', '2026-10-19'));
  TODAY = '2026-10-20';
  page = env.ffReplySave_(ANN, '2026-10-19', { commit: '2' }).getContent();
  ok('a reason is required', /Choose what has stopped/.test(page));
  page = env.ffReplySave_(ANN, '2026-10-19', { reason: 'booked', commit: '2' }).getContent();
  ok('booked needs who and when', /Say who and when/.test(page));
  mails.length = 0;
  page = env.ffReplySave_(ANN, '2026-10-19', { reason: 'leads', commit: '2', help: 'Ten names from the orphan list', note: '' }).getContent();
  const R = env.__sheets['Fact Find Responses'];
  ok('the answer is kept', R && R._grid.length === 2 && R._grid[1][1] === 'a-ann' && R._grid[1][6] === 'leads' && R._grid[1][7] === 2, R && JSON.stringify(R._grid[1]));
  ok('help asked becomes the manager\'s task', tasks.length === 1 && tasks[0][1].OwnerId === '005A' && /\[Fact finds\] Ann Agent: need names to call · commits 2 by Friday/.test(tasks[0][1].Subject), JSON.stringify(tasks[0] && tasks[0][1].Subject));
  ok('the agent gets it back, the manager and sales support copied', mails.length === 1 && mails[0].to === 'ann@example.com' && /akaash@example\.com/.test(mails[0].cc) && /salessupport/.test(mails[0].cc));
  ok('and the page thanks them', /Thank you · your response is in/.test(page) && /Your manager has it as a task/.test(page));

  console.log('\nWednesday, the silent are reminded:\n');
  TODAY = '2026-10-21'; mails.length = 0;
  env.ffChaseTick_(TODAY, 7 * 60 + 10);
  ok('only the one who has not answered', mails.length === 1 && mails[0].to === 'dee@example.com' && /^Reminder:/.test(mails[0].subject), JSON.stringify(mails.map(m => m.to)));
  ok('their manager copied', /akaash@example\.com/.test(mails[0].cc));
  env.ffChaseTick_(TODAY, 7 * 60 + 20);
  ok('once', mails.length === 1);

  console.log('\nFriday, the week to the managers:\n');
  TODAY = '2026-10-23'; mails.length = 0;
  FF.push({ Agent_Email__c: 'ann@example.com', Date_of_Interview__c: '2026-10-22' }, { Agent_Email__c: 'ann@example.com', Date_of_Interview__c: '2026-10-23' });
  env.ffChaseTick_(TODAY, 7 * 60 + 10);
  const sum = mails[0] || {};
  ok('one e-mail, to the Branch Manager and the Unit Manager', mails.length === 1 && /ricky@example\.com/.test(sum.to) && /akaash@example\.com/.test(sum.to), sum.to);
  ok('who answered, what they committed, what they did', /Fact finds this week · 1 of 2 answered, 2 done of 2 committed/.test(sum.subject) && /committed <b>2<\/b>, done <b style="color:#1E9E78">2<\/b>/.test(sum.htmlBody), sum.subject);
  ok('the silent named, to be called today', /No response · call them today \(1\)/.test(sum.htmlBody) && /Dee Agent/.test(sum.htmlBody));

  console.log('\nPreview mode e-mails no agent:\n');
  env.PropertiesService.getScriptProperties().setProperty('FF_CHASE', 'preview');
  TODAY = '2026-10-26'; mails.length = 0;
  env.ffChaseTick_(TODAY, 7 * 60 + 10);
  ok('one preview to the Branch Manager, with the list and a sample', mails.length === 1 && mails[0].to === 'ricky@example.com' && /^\[Preview\] Fact finds: 1 agent/.test(mails[0].subject) && /Dee Agent/.test(mails[0].htmlBody), JSON.stringify(mails.map(m => m.subject)));
  env.ffChaseTick_(TODAY, 7 * 60 + 20);
  ok('once', mails.length === 1);
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
