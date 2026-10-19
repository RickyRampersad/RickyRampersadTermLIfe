// Akaash sees each task's history and can comment on it, from his phone (19 October 2026).
//
// Ricky, 5:58pm: "Akaash is unable to see the history under Darryl nor is he
// able to post a comment in the text field." His 5:30 e-mail sent every
// "open →" to Salesforce (a user record with his e-mail exists), where he
// cannot see Darryl's task or post on it. And on his own page a comment was
// only posted with a complete account of the day: anything less was refused,
// and what he had typed was gone.
//
// Pinned here: a Unit Manager's links open his own page, never Salesforce,
// even when a Salesforce user has his e-mail; the link names the task and the
// page opens on it, with its whole history and a box; a comment posts on its
// own; a refused account keeps the comment posted and the numbers typed; the
// full account still works; an inactive Salesforce user is no login.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-19';
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  [['ricky@example.com', 'A00427 - Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
   ['akaash@example.com', 'A06869 - Akaash Kalladeen', 'A06869', '1', 'Unit Manager', 'Akaash Kalladeen', 'Active'],
   ['liz@example.com', 'EL -004 - Elizabeth lee', 'EL004', '1', 'Staff', 'Elizabeth lee', 'Active']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R', active: true }, akaash: { id: '005A', active: true }, elizabeth: { id: '005E', active: false } });
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = [];
env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const posts = [];
env.sfkInsert_ = (o, b) => { posts.push(b); return 'FEED'; };
const DARRYL = '00TDARRYL0001';
env.cmdChatter_ = () => ({ [DARRYL]: [
  { day: '2026-10-19', by: 'Elizabeth Lee', text: 'Conversion form sent to the client for signing.' },
  { day: '2026-10-16', by: 'Elizabeth Lee', text: 'Client asked for the Econo life illustration first.', reply: true },
  { day: '2026-10-14', by: 'Darryl Manick', text: 'Client wants to convert the 15 year term to Econo life before the anniversary.' }] });
env.unitBook_ = () => ({ agents: ['Akaash Kalladeen', 'Darryl Manick'], closedToday: [], closedYday: 0,
  open: [{ id: DARRYL, subject: 'Conversion of 15 yearTerm life Policy 1000801276 to Econo life', agent: 'Darryl Manick', due: DAY, late: false, ty: 'Pendings', touched: 1 },
         { id: '00TAKAASH0002', subject: 'Follow up with UW', agent: 'Akaash Kalladeen', due: '2026-10-20', late: false, ty: 'Pendings', touched: 1 }] });
env.ff360Feed_ = () => null;
env.skillBank_ = () => ({});
const qs = u => Object.fromEntries(new URL(u.replace(/&amp;/g, '&')).searchParams);

console.log('\nThe 5:30 e-mail:\n');
env.sendUnitManagerEvening_('akaash', DAY);
const m = mails.pop();
ok('it went to Akaash', !!m && m.to === 'akaash@example.com');
ok('no Salesforce links for a Unit Manager, even with a Salesforce user on his e-mail', !!m && !/sf\.example\/00T/.test(m.htmlBody) && /comment &rarr;/.test(m.htmlBody));
const link = (m.htmlBody.match(/href="([^"]*i=00TDARRYL0001[^"]*)"/) || [])[1] || '';
ok('Darryl\'s link names his task', !!link && qs(link).f === 'umeve' && qs(link).i === DARRYL, link.slice(0, 120));

console.log('\nThe page it opens:\n');
const page = env.replyClick_({ parameter: qs(link) }).getContent();
const top = page.indexOf('The task you opened'), kpi = page.indexOf('Your day as a manager');
ok('opens on Darryl\'s task, above the numbers', top > -1 && top < kpi && page.indexOf('Conversion of 15 yearTerm') > top && page.indexOf('Conversion of 15 yearTerm') < kpi);
ok('with its whole history, oldest note included', /History/.test(page) && /before the anniversary/.test(page) && /Econo life illustration/.test(page) && /sent to the client for signing/.test(page));
ok('a box for his comment, once (not twice on the page)', (page.match(new RegExp('name="c_' + DARRYL + '"', 'g')) || []).length === 1);
ok('and a button that posts the comment alone', /name="only" value="1"/.test(page) && /Post my comment/.test(page));

console.log('\nPosting:\n');
const P = { rs: 'akaash', d: DAY, f: 'umeve' };
const say = 'Darryl, call the client tomorrow at 9 and get the conversion form signed.';
let r = env.umEveReplySave_({ staffId: 'akaash', name: 'Akaash Kalladeen' }, DAY, Object.assign({}, P, { only: '1', ['c_' + DARRYL]: say })).getContent();
ok('a comment on its own goes on the task', posts.length === 1 && posts[0].ParentId === DARRYL && posts[0].Body.indexOf(say) > -1 && /^Unit Manager · Akaash Kalladeen/.test(posts[0].Body));
ok('and the page says so, with no account demanded', /posted on Chatter/.test(r) && !/left blank/.test(r));
r = env.umEveReplySave_({ staffId: 'akaash', name: 'Akaash Kalladeen' }, DAY, Object.assign({}, P, { ['c_00TAKAASH0002']: 'UW chased again.', d_coach: '2' })).getContent();
ok('an account with numbers missing: the comment still goes on', posts.length === 2 && posts[1].ParentId === '00TAKAASH0002');
ok('the page asks for the numbers, says the comment is posted, keeps what he typed', /left blank/.test(r) && /posted/.test(r) && /name="d_coach" value="2"/.test(r));
const full = Object.assign({}, P); env.UM_CHECKS.forEach(c => { full['d_' + c.id] = '1'; });
r = env.umEveReplySave_({ staffId: 'akaash', name: 'Akaash Kalladeen' }, DAY, full).getContent();
ok('the full account still goes in', /Your day is in/.test(r));

console.log('\nWho has a Salesforce login:\n');
ok('an inactive Salesforce user is no login', env.noSfLogin_('elizabeth') === true && env.noSfLogin_('ricky') === false);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
