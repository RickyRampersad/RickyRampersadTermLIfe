// A manager closes a task for the agent, from his own page (27 October 2026).
//
// Ricky: "the managers must be able to close off on behalf of the agents as it's
// appearing on their dash. Akash told me things on his dash, he wants to close off."
//
// Pinned here: every task on the Unit Manager's page (morning and 5:30) has a
// "Close this task for <agent>" tick; ticked with a real note, the note goes on
// Chatter first, headed as his and "closed for <agent>", then the task is
// Completed and the change logged; with no note, a one-word note, or a client
// still waiting for an agent, nothing closes and the page says why; a comment
// without the tick never closes anything.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-27';
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  [['ricky@example.com', 'A00427 - Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
   ['akaash@example.com', 'A06869 - Akaash Kalladeen', 'A06869', '1', 'Unit Manager', 'Akaash Kalladeen', 'Active']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R', active: true }, akaash: { id: '005A', active: true } });
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const log = [];
env.sfkInsert_ = (o, b) => { log.push({ post: b.ParentId, body: b.Body }); return 'FEED'; };
env.sfkPatchTask_ = (id, b) => { log.push({ patch: id, body: b }); };
const changes = []; env.taskChangeLog_ = o => changes.push(o);
const A = '00TDARRYL0001', B = '00TDARRYL0002', C = '00TDARRYL0003', D = '00TDARRYL0004';
env.cmdChatter_ = () => ({ [C]: [{ day: DAY, by: 'Client Support', text: 'Client called: she wants an agent to visit her at home.' }] });
env.unitBook_ = () => ({ agents: ['Akaash Kalladeen', 'Darryl Manick'], closedToday: [], closedYday: 0,
  open: [{ id: A, subject: 'Conversion form signed and sent', agent: 'Darryl Manick', due: DAY, late: false, ty: 'Pendings', touched: 1 },
         { id: B, subject: 'Medical requirement outstanding', agent: 'Darryl Manick', due: DAY, late: true, ty: 'Pendings', touched: 3 },
         { id: C, subject: 'Orphan client follow up', agent: 'Darryl Manick', due: DAY, late: false, ty: 'Pendings', touched: 1 },
         { id: D, subject: 'Premium query', agent: 'Darryl Manick', due: DAY, late: false, ty: 'Pendings', touched: 1 }] });
env.ff360Feed_ = () => null;
env.skillBank_ = () => ({});
const qs = u => Object.fromEntries(new URL(u.replace(/&amp;/g, '&')).searchParams);
const who = { staffId: 'akaash', name: 'Akaash Kalladeen' };

console.log('\nThe 5:30 page:\n');
env.sendUnitManagerEvening_('akaash', DAY);
const m = mails.pop();
const link = (m.htmlBody.match(/href="([^"]*f=umeve[^"]*)"/) || [])[1] || '';
const page = env.replyClick_({ parameter: qs(link) }).getContent();
ok('every task has a Close tick, naming the agent', [A, B, C, D].every(id => page.indexOf('name="x_' + id + '"') > -1) && /Close this task for Darryl/.test(page));
ok('and says the comment is the closing note', /your comment above is the closing note/.test(page));

const P = { rs: 'akaash', d: DAY, f: 'umeve', only: '1' };
const good = 'Spoke to the client today; the signed conversion form went to New Business this morning. Nothing more needed from Darryl.';
let r = env.umEveReplySave_(who, DAY, Object.assign({}, P, { ['c_' + A]: good, ['x_' + A]: '1' })).getContent();
const iPost = log.findIndex(x => x.post === A), iPatch = log.findIndex(x => x.patch === A);
ok('a ticked task with a real note: the note goes on first', iPost > -1 && iPatch > iPost);
ok('headed as his, and closed for the agent', iPost > -1 && /^Unit Manager · Akaash Kalladeen .* · closed for Darryl Manick\n\n/.test(log[iPost].body) && log[iPost].body.indexOf(good) > -1);
ok('then the task is Completed', iPatch > -1 && log[iPatch].body.Status === 'Completed');
ok('and the change is logged, with who closed it for whom', changes.length === 1 && changes[0].TaskId === A && /Akaash Kalladeen for Darryl Manick/.test(changes[0].By));
ok('the page says it closed', /closed for Darryl/.test(r));

log.length = 0;
r = env.umEveReplySave_(who, DAY, Object.assign({}, P, { ['x_' + B]: '1' })).getContent();
ok('ticked with no note: nothing posts, nothing closes', !log.length);
ok('and the page says to write what was done', /write what was done/.test(r));

log.length = 0;
r = env.umEveReplySave_(who, DAY, Object.assign({}, P, { ['c_' + B]: 'done', ['x_' + B]: '1' })).getContent();
ok('a one-word note does not close it', !log.some(x => x.patch));
ok('and the page says why', /too short to close on/.test(r));

log.length = 0;
r = env.umEveReplySave_(who, DAY, Object.assign({}, P, { ['c_' + C]: 'Called the client and explained the policy; she is happy for now.', ['x_' + C]: '1' })).getContent();
ok('a client waiting for an agent: not closed', !log.some(x => x.patch));
ok('and the page says to name the agent', /asked for an agent/.test(r));
log.length = 0;
r = env.umEveReplySave_(who, DAY, Object.assign({}, P, { ['c_' + C]: 'Darryl is assigned as her agent and called her today to book the visit for Thursday.', ['x_' + C]: '1' })).getContent();
ok('once the note names the agent assigned, it closes', log.some(x => x.patch === C && x.body.Status === 'Completed'));

log.length = 0;
r = env.umEveReplySave_(who, DAY, Object.assign({}, P, { ['c_' + D]: 'Darryl, please call the client about the premium query tomorrow.' })).getContent();
ok('a comment without the tick never closes', log.length === 1 && log[0].post === D && !/closed for/.test(log[0].body));

console.log('\nThe morning page:\n');
env.bigPut_(env.umItemsKey_('akaash', DAY), [{ id: A, s: 'Conversion form signed and sent', a: 'Darryl Manick', due: DAY, k: 'pend' }]);
log.length = 0;
r = env.umReplySave_(who, DAY, { rs: 'akaash', d: DAY, f: 'um', ['c_' + A]: good, ['x_' + A]: '1' }).getContent();
ok('closes from the morning page too', log.some(x => x.patch === A && x.body.Status === 'Completed'));
ok('and the page counts it', /1 task closed/.test(r));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
