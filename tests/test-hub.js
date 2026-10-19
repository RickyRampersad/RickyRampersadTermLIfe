// My unit: the Unit Manager's one page (19 October 2026).
//
// Ricky: "Akaash needs to see what is high priority for him ... his unit, how
// his pendings are being managed, who is assigned ... post to Chatter, look
// back at the history ... his agents' goals against his, his unit's targets as
// at the date ... tasks open ... how he is coaching ... the day planner. All in
// one area, so he can track his performance from today, with business
// intelligence to plan his day ... make it very easy on all platforms."
//
// Pinned here: one link that works every day; "Do these first" ranks what he
// would overlook, each with its reason; the four tabs carry the plan, the unit's
// work with who holds it and the history, the agents against their goals and
// the unit as at today, and his own week; one Save posts his comments to
// Chatter as his, keeps his plan and done numbers, and makes a task for a desk;
// nothing links to Salesforce; Ricky gets a read-only view.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-19';
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Unit', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support', 'Support', 'Yes']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, elizabeth: { id: '005E' }, sasha: { id: '005S' } });   // Akaash has no login
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = [];
env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const writes = [];
env.sfkInsert_ = (o, b) => { writes.push([o, b]); return o === 'Task' ? '00TNEW' : 'FEED'; };
const P = env.PropertiesService.getScriptProperties();
const q = s => Object.fromEntries(new URL(s).searchParams);

const AG = ['Akaash Kalladeen', 'Darryl Manick', 'Stephanie Rajkumar', 'Kevin Ramdial'];
const open = [
  { id: '00TP1', subject: 'Medical outstanding on a new application', agent: 'Darryl Manick', due: '2026-10-09', late: true, ty: 'Pendings', touched: 9, owner: 'Elizabeth Lee', status: 'In Progress', account: '' },
  { id: '00TP2', subject: 'Signed proposal still to come', agent: 'Stephanie Rajkumar', due: '2026-10-22', late: false, ty: 'Pendings', touched: 1, owner: 'Sasha Lalla-Jagassar', status: 'Not Started', account: '' },
  { id: '00TS1', subject: 'Change of address on a policy', agent: 'Kevin Ramdial', due: '2026-10-01', late: true, ty: 'Servicing', touched: 16, owner: '', status: 'Not Started', account: '' },
  { id: '00TN1', subject: 'New business: application submitted', agent: 'Darryl Manick', due: '2026-10-20', late: false, ty: 'New Business', touched: 2, owner: 'Elizabeth Lee', status: 'In Progress', account: '' }];
env.unitBook_ = () => ({ agents: AG, open, closedYday: 3, closedToday: [{ id: 'x' }] });
env.cmdChatter_ = ids => ({
  '00TP1': [{ at: '2026-10-18T14:00:00Z', day: '2026-10-18', by: 'Elizabeth Lee', text: 'BMA · Sun 18 Oct 9:00am\n\nAkaash, can you get Darryl to book the medical this week?' },
            { at: '2026-10-15T14:00:00Z', day: '2026-10-15', by: 'Elizabeth Lee', text: 'Requirement letter sent to the client.' },
            { at: '2026-10-10T14:00:00Z', day: '2026-10-10', by: 'Elizabeth Lee', text: 'Medical ordered.' }] });
env.ff360Feed_ = () => ({ leaders: [{ name: 'Stephanie Rajkumar', count: 2, pickedUp: 9000 }], monthLeaders: [{ name: 'Darryl Manick', count: 3, pickedUp: 2000 }, { name: 'Stephanie Rajkumar', count: 5, pickedUp: 9000 }],
  yearLeaders: [{ name: 'Darryl Manick', count: 3, pickedUp: 2000 }, { name: 'Stephanie Rajkumar', count: 5, pickedUp: 9000 }, { name: 'Akaash Kalladeen', count: 1, pickedUp: 1500 }] });
env.skillBank_ = () => ({});
const goals = { 'darryl manick': { api: 120000, apps: 24, paceApi: 6923, weeksIn: 3, last: { week: 2, contacts: 10, appts: 2, ff: 1, apps: 0, help: 'Joint calls on two referrals' } },
                'stephanie rajkumar': { api: 100000, apps: 20, paceApi: 5769, weeksIn: 3, last: null },
                'akaash kalladeen': { api: 60000, apps: 12, paceApi: 3462, weeksIn: 3, last: null } };
env.goalFor_ = n => goals[String(n).toLowerCase()] || null;
env.agentDaySummary_ = (day, names) => names.map(n => ({ key: 'a-' + n.split(' ')[0].toLowerCase(), name: n,
  status: n === 'Kevin Ramdial' ? 'absent (no plan)' : n === 'Stephanie Rajkumar' ? 'plan in' : 'no plan yet', planned: n === 'Stephanie Rajkumar' ? 12 : 0, done: 0, ff: 0, apps: 0,
  hasPlan: n === 'Stephanie Rajkumar', hasClose: false }));
env.agRows_ = (key, day, kind) => key === 'a-stephanie' && kind === 'plan' ? { calls: { Planned: 10 }, appts: { Planned: 2 } } : {};
env.ppmLetters_ = () => [{ 'Letter ID': 'L1', 'Agent Name': 'Kevin Ramdial', 'Performance Period': 'Q3 FY26', Status: 'Assigned' }];
env.signedInAt_ = () => '';
env.signInFromPage_ = () => ({ at: '07:05', first: true });

console.log('\nOne link, every day:\n');
const u = env.unitUrl_('akaash');
ok('the link carries no date', !/[?&]d=/.test(u) && /f=unit/.test(u), u);
const page = env.replyClick_({ parameter: q(u) }).getContent();
ok('it opens his page', /My unit · /.test(page) && /same every day/.test(page));
ok('a link for someone else does not', /That link is not right/.test(env.replyClick_({ parameter: Object.assign(q(u), { rs: 'sasha' }) }).getContent()));
ok('nothing on it links to Salesforce', !/sf\.example/.test(page) && !/Open in Salesforce/.test(page));

console.log('\nDo these first, each with its reason:\n');
const m = env.unitModel_('akaash', DAY);
const kinds = m.top.map(x => x.k);
ok('his plan first, when it is not set', m.top[0].k === 'plan', kinds.join(','));
ok('a staff note asking him by name comes next', m.top[1].k === 'ask' && /Elizabeth asks you/.test(m.top[1].t) && /book the medical/.test(m.top[1].why), m.top[1].t);
ok('an absent agent', m.top.some(x => x.k === 'agent' && /Call Kevin/.test(x.t)));
ok('an overdue pending, with who holds it', m.top.some(x => x.k === 'pend' && /with Elizabeth Lee/.test(x.why) && /untouched 9 days/.test(x.why)));
ok('an agent asking for help', m.top.some(x => x.k === 'help' && /Darryl asked for help/.test(x.t) && /Joint calls/.test(x.why)));
ok('an agent behind API pace, with the gap', m.top.some(x => x.k === 'field' && /Darryl/.test(x.t) && /behind API pace/.test(x.why)));
ok('an agent with no goal plan', m.top.some(x => x.k === 'goal' && /Kevin/.test(x.t)));
ok('an open performance letter', m.top.some(x => x.k === 'letter' && /Kevin/.test(x.t)));
ok('a task nobody has touched for two weeks, with no one holding it', m.top.some(x => x.k === 'quiet' && /with no one/.test(x.why)));
ok('his own agent book is not on his list', !m.top.some(x => /Akaash/.test(x.t)));
ok('the top five show, the rest a tap away', /Do these first/.test(page) && /more the system sees/.test(page));
ok('each one jumps to its place on the page', /data-go="t00TP1"/.test(page) && /id="t00TP1"/.test(page) && /data-go="u-plan"/.test(page) && /id="u-plan"/.test(page));

console.log('\nThe tabs:\n');
ok('Today, Unit work, Agents, You', ['Today', 'Unit work', 'Agents', 'You'].every(t => page.indexOf('>' + t) > -1) && (page.match(/data-sec="/g) || []).length === 4);
ok('Today: plan and done side by side for every manager number', (page.match(/name="p_/g) || []).length === env.UM_CHECKS.length && (page.match(/name="d_/g) || []).length === env.UM_CHECKS.length);
ok('Today: his agents, how each is spending the day', /Kevin Ramdial[^]*absent \(no plan\)/.test(page) && /Stephanie Rajkumar[^]*plan in · 12 planned/.test(page));
ok('Unit work: who holds the unit\'s work, by desk, with overdue and quiet', /Who holds your unit's work/.test(page) && /Elizabeth Lee<\/b><span>2 open · 1 pending · <b[^>]*>1 overdue/.test(page) && /No one<\/b>/.test(page));
ok('Unit work: by kind, each task with agent, who has it, status, due, untouched', /Pendings \(2\)/.test(page) && /New business \(1\)/.test(page) && /with <b>Elizabeth Lee<\/b> · In Progress · overdue since/.test(page) && /untouched 9 days/.test(page));
ok('Unit work: the whole history and a box to type or speak into', /The whole history \(3 notes\)/.test(page) && /Medical ordered\./.test(page) && (page.match(/name="c_00T/g) || []).length === 4 && /Type or speak your comment/.test(page));
ok('Agents: the unit against its FY27 goals as at today', /Your unit against its FY27 goals · week 3 of 52/.test(page) && /Unit goal <b>\$280k<\/b>/.test(page));
ok('Agents: each agent, goal, pace, fact finds, today, open work, letter', /Stephanie Rajkumar[^]*\$9k of \$6k API pace/.test(page) && /Last check-in: week 2/.test(page) && /Asked for: Joint calls/.test(page) && /Performance letter · Q3 FY26/.test(page) && /Calls to make 10 · Appointments to set 2/.test(page));
ok('You: his own goal and the unit\'s, as at today', /Your goals as at/.test(page) && /Your own FY27 goal <b>\$60k<\/b>/.test(page));
ok('You: manager numbers this week, coaching, and his week', /Your manager numbers this week/.test(page) && /How you are coaching this week/.test(page) && /Your week/.test(page) && /Numbers met/.test(page));

console.log('\nOne Save:\n');
writes.length = 0;
const post = Object.assign(q(u), { c_00TP1: 'Darryl books the medical for Wednesday.', p_coach: '3', n_coach: 'Darryl, Kevin, Stephanie', p_field: '1',
  cap: 'Chase the signed proposal for Stephanie', capto: 'sasha', capd: '2026-10-21' });
const saved = env.replyPost_({ parameter: post }).getContent();
ok('his comment goes on that task\'s Chatter, headed as his', writes.some(w => w[0] === 'FeedItem' && w[1].ParentId === '00TP1' && /^Unit Manager · Akaash Kalladeen · Mon 19 Oct/.test(w[1].Body) && /Wednesday/.test(w[1].Body)));
ok('his plan is kept', env.mgrRows_('akaash', DAY, 'plan').coach.Planned === '3' && env.mgrRows_('akaash', DAY, 'plan').field.Planned === '1');
ok('a task for the desk he chose, due when he said, his note on its Chatter', writes.some(w => w[0] === 'Task' && w[1].OwnerId === '005S' && w[1].ActivityDate === '2026-10-21' && /Chase the signed proposal/.test(w[1].Subject)) &&
   writes.some(w => w[0] === 'FeedItem' && w[1].ParentId === '00TNEW' && /^Unit Manager · Akaash/.test(w[1].Body)));
ok('the page says what was saved, and signs him in', /3 of 3 saved/.test(saved) && /signed in 7:05am/.test(saved), (saved.match(/\d+ of \d+ saved[^<]*/) || [''])[0]);
ok('his comments count in what he is doing', P.getProperty('um_posts_akaash_' + DAY) === '2');
ok('his plan now shows as set, and drops off Do these first', !env.unitModel_('akaash', DAY).top.some(x => x.k === 'plan'));
writes.length = 0;
env.replyPost_({ parameter: Object.assign(q(u), { d_coach: '2', n_coach: 'Darryl and Kevin' }) });
const ev = env.mgrRows_('akaash', DAY, 'eve');
ok('done as he goes: the number and who', ev.coach && ev.coach.Done === '2' && /Darryl and Kevin/.test(ev.coach.Note));
const after = env.unitPage_({ staffId: 'akaash' }, DAY, '').getContent();
ok('his coaching shows on the You tab', /Mon 19 Oct: Darryl and Kevin/.test(after) || /19 Oct: Darryl and Kevin/.test(after));
ok('a desk task with no desk chosen is not lost silently', /choose which desk/.test(env.replyPost_({ parameter: Object.assign(q(u), { cap: 'Something for someone' }) }).getContent()));
ok('nothing in: says so', /Nothing to save/.test(env.replyPost_({ parameter: q(u) }).getContent()));
ok('a wrong link saves nothing', /Nothing was saved/.test(env.replyPost_({ parameter: Object.assign(q(u), { k: 'x', c_00TP1: 'hi' }) }).getContent()));

console.log('\nIn his mails, and Ricky\'s view:\n');
env.UM_LIST_MAX = 10;
mails.length = 0;
env.sendUnitManagerMorning_('akaash', DAY);
const am = mails.find(x => x.to === 'akaash@example.com');
ok('the morning mail leads with My unit', am && /My unit/.test(am.htmlBody) && am.htmlBody.indexOf('f=unit') > -1 && am.htmlBody.indexOf('f=unit') < am.htmlBody.indexOf('f=um&'), am && am.subject);
const v = env.unitViewUrl_('akaash');
const vp = env.replyClick_({ parameter: q(v) }).getContent();
ok('Ricky\'s view: the same page, read only, nothing to post', /Akaash Kalladeen · My unit/.test(vp) && /Read only/.test(vp) && /<fieldset disabled/.test(vp) && !/<form/.test(vp) && /Do these first/.test(vp));
ok('the view link is not his link', v !== u && /That link is not right/.test(env.replyClick_({ parameter: Object.assign(q(v), { f: 'unit' }) }).getContent()));
writes.length = 0;
ok('a POST to the view saves nothing', /Nothing was saved/.test(String((env.replyPost_({ parameter: Object.assign(q(v), { c_00TP1: 'x' }) }) || { getContent: () => 'Nothing was saved' }).getContent())) && !writes.length);

if (process.env.HUB_OUT) { require('fs').writeFileSync(process.env.HUB_OUT + '/hub.html', page); require('fs').writeFileSync(process.env.HUB_OUT + '/hub-after.html', after); }
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
