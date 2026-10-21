// Ask Claude to draft, on his reply page (20 October 2026).
//
// Ricky, 5:49pm: "i want to see mine now and have further intelligence built
// into mine, if there is something can i ask to draft an intelligent response
// and send?" Under every item: a box to tell Claude what to say and a "Draft
// with Claude" button; the reply comes back in the item's box, everything else
// he typed kept, nothing posted. At the foot: anything else, written to copy.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-20';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes']]);
const P = env.PropertiesService.getScriptProperties();
P.setProperty('ANTHROPIC_API_KEY', 'sk-test');
const ITEMS = [{ id: '00TASK000000000001', k: 'ask', s: 'Waterloo Capital renewal', by: 'Kamla Dookran', said: 'Can we move the meeting to Thursday?' },
               { id: '00TASK000000000002', k: 'mine', s: 'Soodeen family projections', due: '2026-10-19', late: true }];
P.setProperty('bm_items_' + DAY, JSON.stringify(ITEMS));
env.cmdChatter_ = () => ({ '00TASK000000000002': [{ day: '2026-10-19', by: 'Akaash Kalladeen', text: 'Client wants the LIB projection at age 65 and 70.' }] });
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'NEW'; };
env.sfkPatchTask_ = () => ({});
let asked = [];
env.UrlFetchApp = { fetch: (url, o) => {
  const body = JSON.parse(o.payload); asked.push(body.messages[0].content);
  const c = body.messages[0].content;
  if (/He asks:/.test(c)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: '*From tomorrow* every close-out item is answered before you leave.' }] }) };
  const items = JSON.parse(c.slice(c.indexOf('[')));
  const out = {}; items.forEach(it => { out[it.id] = { why: 'Akaash needs the projections', note: 'Akaash, the projections at 65 and 70 go to you by Thursday noon; I will sign them off myself.' }; });
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(out) }] }) };
} };
const sig = env.replySig_('ricky', DAY, 'bm');
const post = params => env.doPost({ parameter: Object.assign({ rs: 'ricky', d: DAY, f: 'bm', k: sig }, params), parameters: {} }).getContent();

// The link answers with a light page first (2026-10-21a); full=1 is the page it then builds (openPage).
const page = env.doGet({ parameter: { rs: 'ricky', d: DAY, f: 'bm', k: sig, full: '1' } }).getContent();
ok('every item has its own "tell Claude what to say" box and button', (page.match(/name="ai_00TASK/g) || []).length === 2 && (page.match(/name="draft" value="00TASK/g) || []).length === 2);
ok('and the free box at the foot', /Ask Claude for anything else/.test(page) && /name="draft" value="_free"/.test(page));
ok('Enter in a box drafts that item, not the first one', /onkeydown="askEnter\(event,this\)"/.test(page) && /function askEnter/.test(page));

const back = post({ draft: '00TASK000000000002', ai_00TASK000000000002: 'tell him Thursday noon, and I sign off myself', c_00TASK000000000001: 'Kamla, Thursday is fine.', log: 'Met NovaHub' });
ok('Draft with Claude: the reply comes back in that item\'s box', /<textarea name="c_00TASK000000000002"[^>]*>Akaash, the projections at 65 and 70 go to you by Thursday noon; I will sign them off myself\.<\/textarea>/.test(back));
ok('his instruction went to Claude, marked as his, with the task\'s history', /"instruction":"tell him Thursday noon, and I sign off myself"/.test(asked[0]) && /Only "instruction" comes from him/.test(asked[0]) && /LIB projection at age 65 and 70/.test(asked[0]));
ok('everything else he typed is kept', /<textarea name="c_00TASK000000000001"[^>]*>Kamla, Thursday is fine\.<\/textarea>/.test(back) && />Met NovaHub<\/textarea>/.test(back) && /value="tell him Thursday noon, and I sign off myself"/.test(back));
ok('nothing was posted by drafting', !posts.length);
ok('the page opens at that item', /getElementById\("i_00TASK000000000002"\)/.test(back));

const sent = post({ c_00TASK000000000002: 'Akaash, the projections at 65 and 70 go to you by Thursday noon; I will sign them off myself.' });
ok('Send posts it on the task\'s Chatter as his', posts.length === 1 && posts[0][1].ParentId === '00TASK000000000002' && /^Branch Manager · /.test(posts[0][1].Body) && /Thursday noon/.test(posts[0][1].Body) && /Sent: 1 of 1/.test(sent));

asked = [];
const free = post({ draft: '_free', ai_free: 'A WhatsApp to the staff: every close-out item answered before you leave, from tomorrow' });
ok('anything else: written, to copy', /id="freeOut"[^>]*>\*From tomorrow\* every close-out item is answered before you leave\.<\/textarea>/.test(free) && /Copy<\/button>/.test(free));
ok('WhatsApp house rules in the ask', /no emojis, no sign-off, short, bold only with \*single asterisks\*/.test(asked[0]));
P.setProperty('ANTHROPIC_API_KEY', '');
ok('no Claude key: says so, keeps what he typed', /Claude is not set up/.test(post({ draft: '00TASK000000000001', ai_00TASK000000000001: 'say yes' })));

// ---- a manager's post @mentions whoever holds the task, and e-mails them ------------------------------
// Ricky, 5:51pm: "it needs to @ the assignee of the task as they will not get this, same applies to Akaash and Kamla".
P.setProperty('ANTHROPIC_API_KEY', 'sk-test');
env.__mkSheet('Access', 9, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes'],
   ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Unit', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
env.resetRequestMemo_ && env.resetRequestMemo_();
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, kamla: { id: '005K' }, sasha: { id: '005S' } });
env.bmSfId_ = () => '005R';
env.sfkToken_ = () => ({ instance_url: 'https://guardian.example', access_token: 'tok' });
env.sfkRecordUrl_ = id => 'https://guardian.example/' + id;
const OWN = { '00TASK000000000001': '005K', '00TASK000000000002': '005S', '00TASK000000000003': '005R' };
env.sfkQuery_ = q => { const m = q.match(/WHERE Id = '([^']+)'/); return m && OWN[m[1]] ? [{ Id: m[1], OwnerId: OWN[m[1]], Subject: 'Task ' + m[1].slice(-1) }] : []; };
const connect = [], mails = []; env.MailApp = { sendEmail: m => mails.push(m) };
const claudeFetch = env.UrlFetchApp.fetch;
env.UrlFetchApp = { fetch: (url, o) => {
  if (/chatter\/feed-elements/.test(url)) { connect.push(JSON.parse(o.payload)); return { getResponseCode: () => 201, getContentText: () => '{"id":"0D5NEW"}' }; }
  return claudeFetch(url, o);
} };
posts.length = 0;
const id1 = env.mgrPost_({ ParentId: '00TASK000000000002', Body: 'Branch Manager · 20 Oct 5:52pm\n\nSasha, call the client today.' }, 'ricky');
const seg = (connect[0] || { body: { messageSegments: [] } }).body.messageSegments;
ok('his post goes in through Chatter with the holder @mentioned', id1 === '0D5NEW' && connect[0].subjectId === '00TASK000000000002' && seg[0].type === 'Text' && /^Branch Manager · /.test(seg[0].text) &&
  seg[1].type === 'Mention' && seg[1].id === '005S' && seg[2].text === ' Sasha, call the client today.' && !posts.length, JSON.stringify(seg));
ok('and the holder gets it by e-mail too, with the link', mails.length === 1 && mails[0].to === 'sasha@example.com' && /^Mr Rampersad on your task/.test(mails[0].subject) &&
  /call the client today/.test(mails[0].htmlBody) && /guardian\.example\/00TASK000000000002/.test(mails[0].htmlBody), mails[0] && mails[0].subject);
connect.length = 0; mails.length = 0;
env.mgrPost_({ ParentId: '00TASK000000000001', Body: 'Unit Manager · Akaash Kalladeen · 20 Oct\n\nKamla, the client signed today.' }, 'akaash');
ok('Akaash\'s too: Kamla @mentioned and e-mailed', connect.length === 1 && connect[0].body.messageSegments[1].id === '005K' && mails.length === 1 && mails[0].to === 'kamla@example.com' && /^Akaash Kalladeen on your task/.test(mails[0].subject));
connect.length = 0; mails.length = 0; posts.length = 0;
env.mgrPost_({ ParentId: '00TASK000000000003', Body: 'Branch Manager · 20 Oct\n\nDone, client called.' }, 'ricky');
ok('his own task: a plain post, no mention, no e-mail', !connect.length && !mails.length && posts.length === 1);
posts.length = 0;
env.mgrPost_({ ParentId: '00TASK000000000002', Body: 'Sales Support · Sasha\n\nCalled.' }, 'sasha');
ok('a desk\'s own post: as before', !connect.length && posts.length === 1);
env.UrlFetchApp = { fetch: (url, o) => (/chatter\/feed-elements/.test(url) ? { getResponseCode: () => 400, getContentText: () => '[{"message":"bad"}]' } : claudeFetch(url, o)) };
posts.length = 0; mails.length = 0;
env.mgrPost_({ ParentId: '00TASK000000000002', Body: 'Branch Manager · 20 Oct\n\nSasha, again.' }, 'ricky');
ok('a mention Salesforce refuses: the plain post still goes in, and the e-mail', posts.length === 1 && mails.length === 1);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
