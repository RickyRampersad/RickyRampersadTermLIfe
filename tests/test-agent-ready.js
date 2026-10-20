// The agents, ready to go live (20 October 2026).
//
// Ricky: "Remove from the agents the underperformance letters. Also, just as
// Akaash, have the task open on the agent's pendings, the ability to post an
// update in a text field that will send it directly to Chatter on the open
// task. Polish up more on the agents, because I would like to activate this
// morning."
//
// Pinned here: no performance letter in the agent's mail; each task's link
// names it and his page opens on it with its whole history and a box; an
// update posts on its own, without the projection; a projection with blanks
// keeps the updates posted and the numbers typed; this morning's previews do
// not stop the agents' own mails once AGENT_DAY is live.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-20';
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  [['ricky@example.com', 'Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active']]);
env.agentBySid_ = sid => sid === 'a-darryl' ? { agent: { key: 'a-darryl', name: 'Darryl Manick', agentName: 'Darryl Manick', email: 'darryl@example.com' } } : null;
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const posts = []; env.sfkInsert_ = (o, b) => { posts.push(b); return 'FEED'; };
const sent = []; env.agSend_ = (a, subject, html) => { sent.push({ subject, html }); return true; };
env.MailApp = { sendEmail: () => {}, getRemainingDailyQuota: () => 90 };
env.ppmLetters_ = () => [{ 'Letter ID': 'L1', 'Agent Name': 'Darryl Manick', 'Performance Period': 'Q2 FY26', Status: 'Assigned' }];
env.agentBook_ = () => null; env.goalFor_ = () => null; env.ff360Feed_ = () => null;
const A = { key: 'a-darryl', name: 'Darryl Manick', agentName: 'Darryl Manick', email: 'darryl@example.com' };
const T1 = { id: '00TA1', subject: 'Medical outstanding on a new application', owner: 'Elizabeth Lee', due: '2026-10-16', late: true };
const T2 = { id: '00TA2', subject: 'Signed proposal still to come', owner: 'Sasha Lalla-Jagassar', due: '2026-10-22', late: false };
const data = { open: { 'a-darryl': [T1, T2] }, ff: {}, f360: {}, goal: {}, q: {}, orphan: {} };
env.cmdChatter_ = () => ({ '00TA1': [{ day: '2026-10-19', by: 'Elizabeth Lee', text: 'Clinic booked for Thursday.' }, { day: '2026-10-12', by: 'Elizabeth Lee', text: 'Medical ordered.' }, { day: '2026-10-09', by: 'Darryl Manick', text: 'Client wants it done this month.' }] });

console.log('\nThe morning e-mail:\n');
env.agentMorningMail_(A, DAY, data, null);
const am = sent.pop().html;
ok('no performance letter', !/performance letter/i.test(am) && !/Q2 FY26/.test(am));
const link = (am.match(/href="([^"]*i=00TA1[^"]*)"/) || [])[1] || '';
ok('each task: open & comment, and the link names it', /open &amp; comment &rarr;/.test(am) && /f=ag/.test(link) && /i=00TA1/.test(link), link.slice(0, 120));

console.log('\nHis page, opened on the task:\n');
const q = new URL(link.replace(/&amp;/g, '&')).searchParams;
const page = env.replyClick_({ parameter: Object.fromEntries(q) }).getContent();
const top = page.indexOf('The task you opened');
ok('the task he tapped comes first, above the projection', top > -1 && top < page.indexOf('Your projection for today'));
const card = page.slice(top, page.indexOf('Your projection for today'));
ok('with who has it, when it is due, and its whole history', /with <b>Elizabeth Lee<\/b> · overdue since/.test(card) && /Clinic booked for Thursday/.test(card) && /Client wants it done this month/.test(card));
ok('a box and a button that posts the update alone', /name="c_00TA1"/.test(card) && /Post my update/.test(card) && (page.match(/name="c_00TA1"/g) || []).length === 1);
ok('the other tasks below, each with a box', /name="c_00TA2"/.test(page) && /Post my updates/.test(page));

console.log('\nPosting:\n');
const P = { rs: 'a-darryl', d: DAY, f: 'ag', k: q.get('k') };
let r = env.agReplySave_({ agent: A }, DAY, 'ag', Object.assign({}, P, { only: '1', c_00TA1: 'Client confirmed Thursday 10am at the clinic.' })).getContent();
ok('an update goes straight on the task, as his', posts.length === 1 && posts[0].ParentId === '00TA1' && /^Agent · Darryl Manick/.test(posts[0].Body) && /Thursday 10am/.test(posts[0].Body));
ok('with no projection asked for', /posted on the task/.test(r) && !/left blank/.test(r));
r = env.agReplySave_({ agent: A }, DAY, 'ag', Object.assign({}, P, { c_00TA2: 'Proposal signed, dropping it in tomorrow.', m_calls: '6' })).getContent();
ok('a projection with blanks: the update still goes on, the numbers stay', posts.length === 2 && posts[1].ParentId === '00TA2' && /left blank/.test(r) && /name="m_calls" value="6"/.test(r));

console.log('\nGoing live this morning:\n');
const props = env.PropertiesService.getScriptProperties();
props.setProperty('agp_am_a-darryl_' + DAY, '05:31');   // this morning's preview
props.setProperty('AGENT_DAY', 'live');
env.agentPeople_ = () => ({ 'a-darryl': A });
env.agentBatchData_ = () => data;
sent.length = 0;
const out = env.agentTick_(DAY, 7 * 60);
ok('a preview this morning does not stop his own mail once live', sent.length === 1 && out.length === 1 && !!props.getProperty('ag_am_a-darryl_' + DAY), JSON.stringify(out));
ok('and it is not sent twice', env.agentTick_(DAY, 7 * 60 + 10).length === 0 && sent.length === 1);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
