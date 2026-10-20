// The inbox scrub and My day, for the Branch Manager (20 October 2026).
//
// Ricky: "it scrubs the inbox and see what urgent things should I actually go
// to in terms of planning my day. And when it's done, the progress check if
// it's completed or not." Then: "simplify this view and a button to plan my
// day or login ... when I check in, it has the time I check in, then I go into
// my urgent, my drafts, the inbox, and then I look at what is important. But
// everything I touch, email, reply on, it's written in a progress report as
// the day goes by."
//
// Pinned here: the scrub unwraps the branch-mailbox copies to their real sender
// and subject; drops automated mail, auto-replies, the tracker's own mail and
// conversations he answered last; sorts the rest (rules, or Claude when a key is
// set); a reply from him on the thread, a tick, or the task closed marks one
// dealt with; "make it a task" puts it in Salesforce for the desk; My day leads
// with the check-in, then urgent, drafts, inbox, important, today so far; a
// drafted note posts only with its tick; everything he does is logged under its
// task type; the 5:00 mail has one button; the 11:00 mail says what is dealt with.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = env.Utilities.formatDate(new Date(), 'x', 'yyyy-MM-dd');
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  [['ricky@example.com', 'Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
   ['kamla@example.com', 'Kamla Dookran', 'KD001', '1', 'Staff', 'Kamla Dookran', 'Active'],
   ['azariah@example.com', 'Azariah Griffith', 'AG003', '1', 'Staff', 'Azariah Griffith', 'Active']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R', active: true }, kamla: { id: '005K', active: true }, azariah: { id: '005A', active: true } });
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const posts = []; let nextId = 1; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return o === 'Task' ? '00TNEW' + (nextId++) : 'FEED'; };
const patches = []; env.sfkPatchTask_ = (id, b) => { patches.push([id, b]); return true; };
env.skillBank_ = () => ({ 'darryl manick': { name: 'Darryl Manick', isAgent: true, active: true, unit: 'Akaash Kalladeen' } });
env.openQueries_ = () => []; env.ff360Feed_ = () => null; env.goalFor_ = () => null; env.agentDaySummary_ = () => []; env.ppmLetters_ = () => [];
let SIGNED = ''; env.signedInAt_ = () => SIGNED; env.signInFromPage_ = () => { const first = !SIGNED; SIGNED = SIGNED || '05:42'; return { at: SIGNED, first }; };
env.unitBook_ = () => ({ agents: env.unitAgents_('ricky'), closedYday: 0, closedToday: [], open: [] });
env.bmWaiting_ = () => ({ mine: [], byOwner: {},
  ask: [{ id: '00TA1', subject: 'Bond letter for RPM Express', by: 'Kamla Dookran', said: 'Mr Rampersad, can I send the revised bond letter to the client?', at: DAY + 'T09:00:00.000Z' }],
  ignored: [{ id: '00TI1', subject: 'Call the Soodeen family', owner: 'Azariah Griffith', due: '2026-10-16' }] });
const T = (id, subj, ty, due) => ({ Id: id, Subject: subj, Task_Type__c: ty, ActivityDate: due, Status: 'In Progress', CreatedDate: '2026-10-01T12:00:00.000+0000', LastModifiedDate: '2026-10-10T12:00:00.000+0000', What: { Name: '' }, Who: { Name: '' }, Agent__r: null });
const MINE = [T('00TM1', 'Investment Discussions - Neal Balroop', 'Opportunity', '2026-09-18'), T('00TM2', 'Refund of premium receipt for Tanya', 'Servicing', '2026-10-15'), T('00TM3', 'Staff appraisal for Liz', 'Lic/Staffing/SA/HR', '2026-10-30')];
let CLOSED_TODAY = [], CLOSED_TASKS = [];
env.sfkQuery_ = q => {
  if (/FROM Task/.test(q) && /OwnerId = '005R'/.test(q) && /IsClosed = false/.test(q)) return MINE;
  if (/FROM Task/.test(q) && /OwnerId = '005R'/.test(q) && /IsClosed = true/.test(q)) return CLOSED_TODAY;
  if (/FROM Task/.test(q) && /IsClosed = true AND Id IN/.test(q)) return CLOSED_TASKS;
  return [];
};
const CHAT = { '00TM2': [{ day: '2026-10-16', at: '2026-10-16T14:00:00.000Z', by: 'Azariah Griffith', text: 'Refund receipt sent to the client.' }] };
env.cmdChatter_ = ids => { const o = {}; ids.forEach(id => { if (CHAT[id]) o[id] = CHAT[id]; }); return o; };

// Gmail, as the tracker sees it.
const now = Date.now(), ago = n => new Date(now - n * 60000).toISOString();
const msg = (id, from, subject, body, at, star) => ({ getId: () => id, getFrom: () => from, getSubject: () => subject, getPlainBody: () => body, getDate: () => new Date(at), isStarred: () => !!star });
const mirror = (from, text, quotedSubject) => 'querymypolicy.com has received a new message.\n----------\n\n    From ' + from + ':\n\n' + text + '\n\n________________________________\n\nFrom: Someone\n\nSent: Monday\n\nSubject: ' + quotedSubject + '\n\nEarlier text\n\n----------\n\nOpen Conversations: https://conversations.godaddy.com/x';
const GD = 'notifications@mail.conversations.godaddy.com';
let INBOX = [
  { getMessages: () => [msg('m1', GD, 'New message for querymypolicy.com', mirror('licorish1@hotmail.com', 'Good evening Mr. Rampersad, I would like to cancel my policy. Please call me.', 'Re: Reminder: Anthony has resigned and is no longer with Guardian Life.'), ago(5))] },
  { getMessages: () => [msg('m2', 'Kamla Dookran <Kamla.Dookran@myguardiangroup.com>', 'Revised bond letter for RPM Express', 'Mr Rampersad, please approve the revised bond letter today?', ago(4))] },
  { getMessages: () => [msg('m3', GD, 'New message for querymypolicy.com', mirror('crmssalsupport@myguardiangroup.com', 'Please see responses highlighted below.', 'RE: Premium Payment Reminder - TT FHO 1285531 - Kheron Khan'), ago(6)),
                        msg('m4', GD, 'Re: New message for querymypolicy.com', mirror('ricky.rampersad@myguardiangroup.com', 'Ayanna, thank you for the answers. Pawan has this for collection.', 'RE: Premium Payment Reminder - TT FHO 1285531 - Kheron Khan'), ago(3))] },
  { getMessages: () => [msg('m5', 'no-reply@alliedsecurityglobal.com', 'Alarm armed', 'Your alarm was armed.', ago(4))] },
  { getMessages: () => [msg('m6', 'rampersadricky@gmail.com', 'Your day · Branch Manager · Tue 20 Oct', 'Good morning, Mr Rampersad.', ago(4))] },
  { getMessages: () => [msg('m7', 'Kamla Dookran <Kamla.Dookran@myguardiangroup.com>', 'Automatic reply: Renewal Due', 'I am out of office.', ago(4))] },
  { getMessages: () => [msg('m8', 'Bryan <bryan@newsletter.billionairesportfolio.com>', 'Five stocks', 'Buy now.', ago(4))] }];
let SENT = [], DRAFTS = [{ getMessage: () => ({ getId: () => 'r1', getTo: () => 'client@example.com', getSubject: () => 'Your renewal notice', getDate: () => new Date(now - 3600000) }) }];
const searches = [];
env.GmailApp = { search: q => { searches.push(q); return /in:sent/.test(q) ? SENT : INBOX; }, getDrafts: () => DRAFTS };
const tab = () => env.SpreadsheetApp.getActive().getSheetByName('Inbox Scrub');
const rows = () => { const g = tab()._grid, h = g[0]; return g.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]]))); };

console.log('\nThe scrub:\n');
let r = env.inboxScrub_(DAY, 'am');
ok('reads the inbox, not promotions or social', /in:inbox after:\d+ -category:promotions -category:social/.test(searches[0]), searches[0]);
let R = rows();
ok('two to act on: the client asking to cancel, and Kamla\'s approval', R.length === 2 && R.some(x => x.Email === 'licorish1@hotmail.com') && R.some(x => /bond letter/.test(x.Subject)), JSON.stringify(R.map(x => x.Email + ' ' + x.Subject)));
const pearl = R.find(x => x.Email === 'licorish1@hotmail.com'), bond = R.find(x => /bond letter/.test(x.Subject));
ok('a branch-mailbox copy is unwrapped to its real sender and subject', pearl.Source === 'Branch mailbox' && /^Re: Reminder: Anthony has resigned/.test(pearl.Subject), pearl.Subject);
ok('a client wanting to cancel is to act on now; a request for approval, today', pearl.Urgency === 'now' && bond.Urgency === 'today', pearl.Urgency + ' ' + bond.Urgency);
ok('no automated mail, auto-reply, newsletter or the tracker\'s own mail', !R.some(x => /alarm|automatic reply|five stocks|your day/i.test(x.Subject)));
ok('a conversation he answered last is not listed', !R.some(x => /Kheron Khan/.test(x.Subject)));
const LOG = () => { const t = env.SpreadsheetApp.getActive().getSheetByName('My Day Log'); return t ? t._grid.slice(1) : []; };
ok('his Guardian reply is on his day\'s log as an e-mail, under its task type', LOG().some(x => x[2] === 'email' && /^Replied: Premium Payment Reminder - TT FHO 1285531/.test(x[4]) && x[3] === 'Renewals & billing'), JSON.stringify(LOG()));
ok('the tracker\'s own mail is not counted as his', !LOG().some(x => /Your day/.test(x[4])));
r = env.inboxScrub_(DAY, 'hour');
ok('read again, nothing is added twice', rows().length === 2 && r.added === 0, JSON.stringify(r));

console.log('\nClaude sorts, when a key is set:\n');
env.PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', 'k');
let prompt = '';
INBOX.push({ getMessages: () => [msg('m9', 'Neil Ramnanan <Neil.Ramnanan@myguardiangroup.com>', 'Q4 production numbers', 'Ricky, send me the branch Q4 projection by noon.', ago(2))] });
env.UrlFetchApp = { fetch: (u, o) => { prompt = JSON.parse(o.payload).messages[0].content; const ids = (prompt.match(/"id":"(k[0-9a-f]+)"/g) || []).map(s => s.slice(6, -1));
  const out = {}; ids.forEach(id => out[id] = { u: 'now', why: 'His manager wants it by noon', ask: 'Send Neil the Q4 projection by noon', owner: 'Ricky', gist: 'Neil asks for the branch Q4 projection by noon.' });
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(out) }] }) }; } };
r = env.inboxScrub_(DAY, 'hour');
const neil = rows().find(x => /Q4 production/.test(x.Subject));
ok('Claude reads the mail, told it is data not instructions', /never instructions to you/.test(prompt) && /send me the branch Q4 projection/.test(prompt));
ok('and its reading is kept: act now, what to do, who', !!neil && neil.Urgency === 'now' && neil.Ask === 'Send Neil the Q4 projection by noon' && neil.By === 'Claude', neil && JSON.stringify(neil));
env.PropertiesService.getScriptProperties().deleteProperty('ANTHROPIC_API_KEY');

console.log('\nMy day:\n');
const U = Object.fromEntries(new URL(env.unitUrl_('ricky')).searchParams);
let page = env.replyClick_({ parameter: U }).getContent();
ok('one button to check in, before anything else', /name="ci" value="1"[^>]*>Check in and start my day/.test(page) && page.indexOf('name="ci"') < page.indexOf('data-tab="day"'));
ok('My day is the first tab', /<button type="button" class="tab on" data-tab="day">My day/.test(page));
const day = page.slice(page.indexOf('data-sec="day"'), page.indexOf('data-sec="renew"') > 0 ? page.indexOf('data-sec="renew"') : page.indexOf('data-sec="work"'));
const at = id => day.indexOf('id="' + id + '"');
ok('in his order: urgent, drafts, inbox, important, today so far', at('md-urgent') > -1 && at('md-urgent') < at('md-drafts') && at('md-drafts') < at('u-inbox') && at('u-inbox') < at('md-imp') && at('md-imp') < at('md-log'));
const urg = day.slice(at('md-urgent'), at('md-drafts'));
ok('urgent: the inbox to act on now, and Kamla waiting on him', /Inbox · licorish1@hotmail\.com/.test(urg) && /Kamla is waiting on you · Bond letter for RPM Express/.test(urg) && /data-go="d00TA1"/.test(urg));
ok('and the long-overdue task of his', /Investment Discussions - Neal Balroop/.test(urg) && /data-go="m00TM1"/.test(urg));
const dr = day.slice(at('md-drafts'), at('u-inbox'));
ok('drafts: the e-mail waiting in Gmail, with a link to send it', /Your renewal notice/.test(dr) && /#drafts\?compose=r1/.test(dr));
ok('a chase written for his instruction with no note, ready to post with a tick', /name="dn_00TI1"[^>]*>Azariah, there is no note on this since it fell due on Fri 16 Oct/.test(dr) && /name="dp_00TI1"/.test(dr));
ok('and a reply box for Kamla, with what she said', /Kamla said: "Mr Rampersad, can I send the revised bond letter/.test(dr) && /name="dn_00TA1"/.test(dr));
const ib = day.slice(at('u-inbox'), at('md-imp'));
ok('the inbox: each with done, make it a task for a desk, and a note', ['ixd_', 'ixt_', 'ixw_', 'ixn_'].every(f => new RegExp('name="' + f + bond.Key + '"').test(ib)) && /Open the mail &rarr;/.test(ib));
const imp = day.slice(at('md-imp'), at('md-log'));
ok('important: his tasks by type, each with what to do and why', /New business \(1 · 1 overdue\)/.test(imp) && /Servicing \(1 · 1 overdue\)/.test(imp) && /Staffing &amp; licensing \(1\)/.test(imp));
ok('the last note reads as done: close it', /id="m00TM2"[\s\S]*?Close it<\/span>The last note reads as done/.test(imp));
ok('no note since it was opened: write a note', /id="m00TM1"[\s\S]*?Write a note<\/span>No note since it was opened/.test(imp));
ok('with the tick, the date and the note', /name="done_00TM1"/.test(imp) && /name="mv_00TM1"/.test(imp) && /name="c_00TM1"/.test(imp));

console.log('\nChecking in, and the day as it goes:\n');
page = env.replyPost_({ parameter: Object.assign({}, U, { ci: '1' }) }).getContent();
ok('check in: the time is kept and shown', /Checked in at 5:42am/.test(page) && /&#10003; Checked in 5:42am/.test(page) && LOG().some(x => x[2] === 'checkin' && x[1] === '05:42'));
posts.length = 0;
page = env.replyPost_({ parameter: Object.assign({}, U, { dn_00TI1: 'Azariah, call the Soodeens today and note it.', ['ixt_' + bond.Key]: '1', ['ixw_' + bond.Key]: 'kamla', ['ixn_' + bond.Key]: 'Approved, send it.', ['ixd_' + pearl.Key]: '1', done_00TM2: '1', c_00TM2: 'Receipt sent; closing.' }) }).getContent();
ok('a drafted note without its tick is not posted', !posts.some(p => p[1].ParentId === '00TI1'));
const task = posts.find(p => p[0] === 'Task');
ok('make it a task: a Salesforce task for Kamla, due today, with the gist and his note', !!task && task[1].OwnerId === '005K' && task[1].ActivityDate === DAY && /^Inbox · Kamla Dookran · Revised bond letter/.test(task[1].Subject) && /Note from Ricky Rampersad: Approved, send it\./.test(task[1].Description), task && JSON.stringify(task[1]));
ok('and a note on it for Kamla', posts.some(p => p[0] === 'FeedItem' && /^00TNEW/.test(p[1].ParentId) && /Branch Manager · Ricky Rampersad/.test(p[1].Body)));
R = rows();
ok('the tick marks the client\'s mail dealt with; the other is a task now', R.find(x => x.Key === pearl.Key).Status === 'done' && R.find(x => x.Key === bond.Key).Status === 'task' && /^00TNEW/.test(R.find(x => x.Key === bond.Key).TaskId));
ok('everything is on his day\'s log, under its type', LOG().some(x => x[2] === 'close' && /Refund of premium/.test(x[4]) && x[3] === 'Servicing') && LOG().some(x => x[2] === 'task' && /Kamla/.test(x[4])) && LOG().some(x => x[2] === 'inbox'), JSON.stringify(LOG().map(x => x[2] + ':' + x[3])));
page = env.replyPost_({ parameter: Object.assign({}, U, { dn_00TI1: 'Azariah, call the Soodeens today and note it.', dp_00TI1: '1' }) }).getContent();
ok('ticked, it posts in his words', posts.some(p => p[1].ParentId === '00TI1' && /call the Soodeens today/.test(p[1].Body) && /^Branch Manager · Ricky Rampersad/.test(p[1].Body)));
CLOSED_TASKS = [{ Id: R.find(x => x.Key === bond.Key).TaskId, Status: 'Completed', LastModifiedDate: new Date().toISOString() }];
env.inboxScrub_(DAY, 'hour');
ok('when Kamla closes the task, the mail is dealt with', rows().find(x => x.Key === bond.Key).Status === 'done' && rows().find(x => x.Key === bond.Key).By === 'task closed');
INBOX.push({ getMessages: () => [msg('m10', GD, 'Re: New message for querymypolicy.com', mirror('ricky.rampersad@myguardiangroup.com', 'Neil, the Q4 projection is attached.', 'RE: Q4 production numbers'), ago(1))] });
env.inboxScrub_(DAY, 'hour');
ok('and his reply on the thread marks his manager\'s mail answered', rows().find(x => /Q4 production/.test(x.Subject)).Status === 'replied' && rows().find(x => /Q4 production/.test(x.Subject)).By === 'you replied');
page = env.replyClick_({ parameter: U }).getContent();
const lg = page.slice(page.indexOf('id="md-log"'));
ok('today so far: the check-in, his e-mails, the close and the task, as they happened', /5:42am<\/b><span>Checked in/.test(lg) && /Replied: Q4 production numbers/.test(lg) && /Closed: Refund of premium/.test(lg) && !/Closed · Closed/.test(lg));
ok('where his time has gone, and where the work needs him', /Where your time has gone/.test(lg) && /Where the work needs you/.test(lg) && /Your time today: /.test(lg) && /Needs you most: /.test(lg));

console.log('\nThe mails:\n');
mails.length = 0;
env.sendBranchManagerDay_(DAY);
const am = mails.find(m => /^Your day · Branch Manager/.test(m.subject));
ok('5:00: one button to check in and start his day', !!am && /Check in and start my day/.test(am.htmlBody) && !/Plan my day and sign in/.test(am.htmlBody) && !/>My branch</.test(am.htmlBody));
ok('then what is urgent, and the inbox', !!am && /Urgent \(\d+\)/.test(am.htmlBody) && /Your inbox this morning · \d+ to act on/.test(am.htmlBody), am && am.subject);
mails.length = 0;
env.sendBranchManagerProgress_(DAY, 'mid');
const mid = mails.find(m => /Eleven o'clock/.test(m.subject));
ok('11:00: today so far, checked in at 5:42', !!mid && /Today so far · checked in 5:42am/.test(mid.htmlBody) && /Replied: Q4 production numbers/.test(mid.htmlBody), mid && mid.subject);
ok('and the inbox: what is dealt with', !!mid && /Your inbox · 3 of 3 dealt with/.test(mid.htmlBody) && / · inbox 3 of 3 dealt with/.test(mid.subject), mid && mid.subject);
ok('one button back to his day', !!mid && /Open my day/.test(mid.htmlBody));

console.log('\nThe switch:\n');
env.PropertiesService.getScriptProperties().setProperty('INBOX_SCRUB', 'off');
ok('INBOX_SCRUB = off stops the scrub', env.inboxScrub_(DAY, 'hour').off === true);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
