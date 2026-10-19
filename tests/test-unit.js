// The Unit Manager with no Salesforce login, and the 12 noon mailbag (19 October 2026).
//
// Ricky: "Akaash cannot, when he updates text it's not posted on the chatter
// task ... remember Akaash is not a registered user on Salesforce ... where is
// his agents' goals and activities and what he is doing ... the bag leaves at
// 12pm so a correction is needed."
//
// Pinned here: a big unit's day items survive storage (they used to be cut at
// 8,900 characters, which read back as nothing, so the page had no boxes and no
// comment reached Chatter); a desk with no Salesforce login gets comment links
// to its own page, never Salesforce; the page shows the latest notes on each
// task; his agents' goals and activity and what he is doing come first; the
// unit lists each agent once; the mailbag call at 11:15 for the 12 noon bag.
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
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support', 'Support', 'Yes']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, elizabeth: { id: '005E' } });   // no Akaash: he has no login
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = [];
env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const writes = [];
env.sfkInsert_ = (o, b) => { writes.push([o, b]); return 'FEED'; };
env.cmdChatter_ = ids => ({ [ids[0]]: [
  { at: '2026-10-18T14:00:00Z', day: '2026-10-18', by: 'Ricky Rampersad', text: 'Branch Manager · Sun 18 Oct 9:00am\n\nPlease call the client today.' },
  { at: '2026-10-17T14:00:00Z', day: '2026-10-17', by: 'Elizabeth Lee', text: 'Client asked for a call on Monday morning.', reply: true },
  { at: '2026-10-16T14:00:00Z', day: '2026-10-16', by: 'Elizabeth Lee', text: 'First call: no answer, voicemail left.' }] });
const P = env.PropertiesService.getScriptProperties();
const q = s => Object.fromEntries(new URL(s).searchParams);

console.log('\nA value too long for one property:\n');
const big = Array.from({ length: 60 }, (_, i) => ({ id: '00T' + i, s: 'SQ- Laura Goberdhan- 5004185506/8004274889/5003944438/1000463745/1000463737/500356230 ' + 'x'.repeat(60) }));
env.bigPut_('k_test', big);
ok('kept in pieces and read back whole', JSON.stringify(env.bigGet_('k_test', [])) === JSON.stringify(big) && Number(P.getProperty('k_test_n')) > 1, P.getProperty('k_test_n'));
P.setProperty('k_old', JSON.stringify([{ id: 'a' }]));
ok('a value kept the old way still reads', env.bigGet_('k_old', [])[0].id === 'a');
env.bigPut_('k_test', [{ id: 'small' }]);
ok('a shorter value clears the old pieces', env.bigGet_('k_test', [])[0].id === 'small' && !P.getProperty('k_test_1') && !P.getProperty('k_test_n'));

console.log('\nA big unit, a manager with no Salesforce login:\n');
env.skillBank_ = () => ({ 'akaash kalladeen': { name: 'Akaash Kalladeen', isAgent: true, active: true, unit: 'Akaash Kalladeen' },
                          'darryl manick': { name: 'Darryl Manick', isAgent: true, active: true, unit: 'Akaash Kalladeen' },
                          'stephanie rajkumar': { name: 'Stephanie Rajkumar', isAgent: true, active: true, unit: 'Akaash Kalladeen' } });
ok('each agent once, the manager included', env.unitAgents_('akaash').join('|') === 'Akaash Kalladeen|Darryl Manick|Stephanie Rajkumar', env.unitAgents_('akaash').join('|'));
env.UM_LIST_MAX = 25;   // a full unit: four sections of a long list each
const open = [];
for (let i = 0; i < 40; i++) open.push({ id: '00TU' + String(i).padStart(3, '0'), subject: (i % 2 ? 'SQ- Laura Goberdhan- 5004185506/8004274889/5003944438/1000463745/1000463737/500356230 follow up with the client on the outstanding requirements and the medical, the signed proposal and the first premium, then post the result ' : 'Premium Dues Report 14 Oct: Branch Manager\'s instructions not actioned (Purandaye, Akaash, orphan follow up); every client on the list to be called and the call posted on Chatter the same day ') + i,
  agent: i % 3 ? 'Darryl Manick' : 'Akaash Kalladeen', due: '2026-10-1' + (i % 9), late: true, ty: i % 4 ? 'Pendings' : 'Servicing', touched: 3 });
env.unitBook_ = () => ({ agents: ['Akaash Kalladeen', 'Darryl Manick', 'Stephanie Rajkumar'], open, closedYday: 4 });
env.ff360Feed_ = () => null;
mails.length = 0;
env.sendUnitManagerMorning_('akaash', DAY);
const am = mails[0], html = am.htmlBody;
ok('the morning went to Akaash', am && am.to === 'akaash@example.com', am && am.subject);
ok('no task link goes to Salesforce; each goes to his own comment page', !/sf\.example\/00TU/.test(html) && /f=um[^"]*#i00TU/.test(html) && /comment &rarr;/.test(html));
ok('the button says no Salesforce login is needed', /Comment and plan my day/.test(html) && /No Salesforce login needed/.test(html));
ok('his agents\' goals and activity, and what he is doing, come before the day and the unit list',
   html.indexOf('Your agents · goals and activity') > -1 && html.indexOf('What you are doing') > -1 &&
   html.indexOf('Your agents · goals and activity') < html.indexOf('Your unit in full') && html.indexOf('What you are doing') < html.indexOf('Your unit in full'));
const stored = env.bigGet_(env.umItemsKey_('akaash', DAY), []);
ok('every item of a big unit is kept (they no longer read back as nothing)', stored.length === 35 && JSON.stringify(stored).length > 8900, stored.length + ' items, ' + JSON.stringify(stored).length + ' chars');
const url = new URL(env.replyUrl_('akaash', DAY, 'um'));
const page = env.replyClick_({ parameter: Object.fromEntries(url.searchParams) }).getContent();
ok('the page has a box under every task, each with its anchor', (page.match(/name="c_00TU/g) || []).length === 35 && new RegExp('id="i' + stored[0].id + '"').test(page));
ok('and no Salesforce link for him', !/sf\.example\/00TU/.test(page));
ok('and the whole history a tap away, oldest included', /The whole history \(3 notes\)/.test(page) && /First call: no answer, voicemail left\./.test(page));
ok('a task with no notes says so', /No notes on Chatter yet\./.test(page));
ok('the box says he can speak his comment', /Type or speak your comment/.test(page));
ok('and the latest note on the task, so he sees the thread', /Branch Manager · Sun 18 Oct 9:00am|Branch Manager · Sun 18 Oct/.test(page) && /Please call the client today\./.test(page));
writes.length = 0;
const saved = env.replyPost_({ parameter: Object.assign(Object.fromEntries(url.searchParams), { ['c_' + stored[3].id]: 'Spoke to Darryl: he calls the client at 2 today.' }) }).getContent();
ok('his comment goes on that task\'s Chatter, headed as his', writes.some(w => w[0] === 'FeedItem' && w[1].ParentId === stored[3].id && /^Unit Manager · Akaash Kalladeen · Mon 19 Oct/.test(w[1].Body) && /Spoke to Darryl/.test(w[1].Body)) && /posted/.test(saved), writes.length + ' writes');
ok('and it counts in what he is doing', P.getProperty('um_posts_akaash_' + DAY) === '1');
const self = env.umSelfCard_('akaash', DAY);
ok('what you are doing: yesterday and today, comments counted', /What you are doing/.test(self) && /Today so far/.test(self) && /<b>1<\/b> comment on Chatter/.test(self), (self.match(/Today so far[^<]*<\/b>[^]*?<\/div>/) || [''])[0].replace(/<[^>]+>/g, '').slice(0, 160));

console.log('\nThe mailbag leaves at 12 noon:\n');
ok('12 noon by default; hand over by 11:45', env.mailbagLeavesText_() === '12 noon' && env.mailbagByText_() === '11:45am', env.mailbagByText_());
env.mailbagToday_ = () => ({ today: { Azariah: 2 }, backlog: { Azariah: 3, Sasha: 2 }, todayN: 2, backlogN: 5, oldest: '2026-10-14', byRouting: {} });
mails.length = 0;
ok('the call goes', env.sendMailbagCall_(DAY, {}) === true && mails.length === 1);
const call = mails[0], rt = env.mailbagRouter_(DAY, {});
ok('to the router and everyone holding documents', call.to.split(',').includes(env.emailFor_(rt.router)) && call.to.split(',').includes('azariah@example.com') && call.to.split(',').includes('sasha@example.com'), call.to);
ok('it says when the bag leaves and the hand-over time', /leaves at 12 noon/.test(call.subject) && /by 11:45am/.test(call.subject) && /The bag leaves at 12 noon\./.test(call.htmlBody), call.subject);
env.mailbagToday_ = () => ({ today: {}, backlog: {}, todayN: 0, backlogN: 0, oldest: null, byRouting: {} });
ok('nothing to go: no mail', env.sendMailbagCall_(DAY, {}) === false);
P.setProperty('MAILBAG_AT', '13:00');
ok('a Script Property moves it', env.mailbagLeavesText_() === '1:00pm' && env.mailbagByText_() === '12:45pm');
P.deleteProperty('MAILBAG_AT');

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
