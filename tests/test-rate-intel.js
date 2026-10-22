// Service ratings, task by task (21 October 2026, 2026-10-21f).
//
// Ricky, 12:37pm: "I am seeing the Ratings coming in but a lot more data is
// needed: the timelines, the chats, the intelligence etc, the client, the
// department, how, so I can see this, the type etc, build more intel".
//
// Pinned here: the Service Ratings tab gains Agent, Client, Department, Opened,
// Closed, Notes, Timeline and Intel at its end, so a row recorded before still
// lines up; a run reads Salesforce at most twice more (the replies, the names),
// never once per task; the timeline is opened, every note and reply in order
// with who wrote it, the tracker's workload and date moves, and the close with
// its note; the Who is the client when a CLIENT and the department when a
// BUSINESS CONTACT, otherwise the department the notes name; the read of how it
// went comes from Claude in the agent summary's one call, plainly without it;
// his page (f=rate) shows the week and a card per rating, old rows with "—",
// refuses a link it did not sign, and opens one card from the 1 or 2 star
// e-mail; nothing new reaches the wall.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-20';   // a Tuesday
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = new Date(DAY + 'T10:30:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const fresh = () => { env.resetRequestMemo_ && env.resetRequestMemo_(); env.forgetHr_(env.RATETAB); };

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes'],
   ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Akaash', 'Yes']]);
const P = env.PropertiesService.getScriptProperties();
let mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkConfigured_ = () => true;
env.sfkToken_ = () => ({ instance_url: 'https://guardian.example' });
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, sasha: { id: '005S' }, elizabeth: { id: '005E' }, azariah: { id: '005A' }, kamla: { id: '005K' } });
env.agentPeople_ = () => ({ 'a-randolph': { name: 'Randolph Ramdial', email: 'randolph@agents.example' }, 'a-marissa': { name: 'Marissa Khan', email: 'marissa@agents.example' } });

// ---- a tab from before today: the seventeen columns, and a rating already on it ----------------
const OLD_HEAD = ['Token', 'Sent', 'Kind', 'TaskId', 'Type', 'What', 'Closer', 'CloserName', 'ToName', 'Email', 'Days', 'Status', 'Rating', 'RatedAt', 'Comment', 'Alerted', 'OptOut'];
const OLD_TOK = 'rold000000000000000000001';
env.__mkSheet('Service Ratings', 77, OLD_HEAD, [[OLD_TOK, new Date(DAY + 'T08:00:00'), 'agent', '00TOLD000000000001', 'Servicing', 'Servicing', 'sasha', 'Sasha Lalla-Jagassar',
  'Marissa Khan', 'marissa@agents.example', 2, 'sent', 4, new Date(DAY + 'T08:30:00'), 'Quick and clear', '', '']]);
// What the tracker logged: a workload move, a due date moved from a page (and the same move seen by the snapshot).
const id = n => '00TINTEL' + String(n).padStart(8, '0');
const S1 = 'Follow up with UW - 1000894223 JEREMIAH PERSAD';
env.__mkSheet('Workload Moves', 78, env.MOVES.head, [['2026-10-15', '10:00', id(1), S1, 'Pendings', 'sasha', 'elizabeth', 'Sasha is out today', 'OK', '']]);
env.__mkSheet('Task Changes', 79, env.TASKCHG.head, [['2026-10-16', '11:30', id(1), S1, 'Due date', '2026-10-16', '2026-10-19', 'Clinic booked for Monday', 'Elizabeth Lee', 'OK']]);
env.__mkSheet('Due Moves', 80, env.DUEMOVES.head, [['2026-10-17', id(1), S1, 'Elizabeth Lee', '', '2026-10-16', '2026-10-19', 'yes']]);

const utc = (day, hm) => { const [h, m] = hm.split(':').map(Number); return day + 'T' + String(h + 4).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000+0000'; };
const CONTACTS = {
  '003AG1': { Id: '003AG1', Name: 'Randolph Ramdial', FirstName: 'Randolph', Email: 'randolph@agents.example', RecordType: { Name: 'AGENT' } },
  '003AG2': { Id: '003AG2', Name: 'Marissa Khan', FirstName: 'Marissa', Email: 'marissa@agents.example', RecordType: { Name: 'AGENT' } },
  '003CL1': { Id: '003CL1', Name: 'Jeremiah Persad', FirstName: 'Jeremiah', Email: 'jeremiah@client.example', RecordType: { Name: 'CLIENT' } },
  '003CL2': { Id: '003CL2', Name: 'Reena Seeparsan', FirstName: 'Reena', Email: 'reena@client.example', RecordType: { Name: 'CLIENT' } },
  '003BC':  { Id: '003BC', Name: 'GLOC Customer Service Chaguanas RSC', FirstName: '', Email: 'cs@guardian.example', RecordType: { Name: 'BUSINESS CONTACT' } }
};
const USERS = { '005X': 'Shivonne Sammy' };
let TASKS = [], FEED = [], COMMENTS = [];
let queries = [];
const cut = s => String(s).slice(0, 19);
env.sfkQuery_ = q => {
  queries.push(q);
  if (/FROM Task WHERE IsClosed = true AND OwnerId IN/.test(q)) {
    const gt = (q.match(/CompletedDateTime > (\S+)/) || [])[1], le = (q.match(/CompletedDateTime <= (\S+)/) || [])[1];
    return TASKS.filter(t => q.indexOf("'" + t.OwnerId + "'") > -1 && (!gt || cut(t.CompletedDateTime) > cut(gt)) && (!le || cut(t.CompletedDateTime) <= cut(le)))
      .sort((a, b) => a.CompletedDateTime.localeCompare(b.CompletedDateTime));
  }
  if (/FROM FeedItem WHERE Type = 'TextPost' AND ParentId IN/.test(q)) return FEED.filter(f => q.indexOf("'" + f.ParentId + "'") > -1).sort((a, b) => b.CreatedDate.localeCompare(a.CreatedDate));
  if (/FROM FeedComment WHERE ParentId IN/.test(q)) return COMMENTS.filter(f => q.indexOf("'" + f.ParentId + "'") > -1).sort((a, b) => a.CreatedDate.localeCompare(b.CreatedDate));
  if (/FROM Contact WHERE Id IN/.test(q)) return Object.values(CONTACTS).filter(c => q.indexOf("'" + c.Id + "'") > -1);
  if (/FROM User WHERE Id IN/.test(q)) return Object.keys(USERS).filter(u => q.indexOf("'" + u + "'") > -1).map(u => ({ Id: u, Name: USERS[u] }));
  return [];
};
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'NEW'; };
const T = (n, owner, subject, ty, agent, who, at, opened, by, due) => ({ Id: id(n), OwnerId: owner, Subject: subject, Task_Type__c: ty, Agent__c: agent, WhoId: who,
  CreatedDate: opened, CreatedById: by, ActivityDate: due || null, CompletedDateTime: utc(DAY, at) });
const LIZ = 'Sales Support · Elizabeth Lee · ';
TASKS = [
  T(1, '005E', S1, 'Pendings', '003AG1', '003CL1', '09:10', utc('2026-10-14', '08:00'), '005R', '2026-10-16'),
  T(2, '005S', 'Statement request - 8000111111', 'Servicing', '003AG2', '003BC', '09:20', utc('2026-10-19', '09:00'), '005X')
];
FEED = [
  { ParentId: id(1), CreatedById: '005E', CreatedDate: utc('2026-10-14', '08:30'), Body: LIZ + '14 Oct 8:30am\n\nEmailed underwriting for the outstanding ECG requirement; waiting on underwriting to confirm what else they need.' },
  { ParentId: id(1), CreatedById: '005R', CreatedDate: utc('2026-10-15', '09:00'), Body: 'Branch Manager · Thu 15 Oct 9:00am\n\nLiz, please call the clinic and book the ECG for this week.' },
  { ParentId: id(1), CreatedById: '005E', CreatedDate: utc('2026-10-19', '10:00'), Body: 'Called the clinic; the ECG is booked for Monday and the client was told by phone.' },
  { ParentId: id(1), CreatedById: '005E', CreatedDate: utc(DAY, '09:00'), Body: LIZ + '20 Oct 9:00am\n\nUnderwriting confirmed the ECG results were received and the application moved to approval; the client was advised by e-mail.' },
  { ParentId: id(2), CreatedById: '005S', CreatedDate: utc(DAY, '09:15'), Body: 'Sales Support · Sasha Lalla-Jagassar · 20 Oct 9:15am\n\nPrinted the annual statement and e-mailed it to the agent and to Customer Service for stamping; confirmed received.' }
];
COMMENTS = [{ ParentId: id(1), CreatedById: '005X', CreatedDate: utc('2026-10-16', '11:00'), CommentBody: 'The clinic has no slots until Monday.' }];

const tab = () => env.__sheets['Service Ratings'];
const rowsNow = () => { fresh(); return env.sheetObjects_(tab()); };

console.log('\nThe record kept when a rating is asked for:\n');
let out = env.rateTick_(DAY, 10 * 60 + 30);
const head = tab()._grid[0];
ok('the run sent what it always did', out.length === 1 && /2 sent, 1 client held/.test(out[0]), out.join(' | '));
ok('the new columns are added at the end of the tab', head.slice(0, 17).join() === OLD_HEAD.join() &&
  head.slice(17).join() === 'Agent,Client,Department,Opened,Closed,Notes,Timeline,Intel', head.join());
ok('and the row from before still lines up', tab()._grid[1][0] === OLD_TOK && tab()._grid[1][12] === 4 && tab()._grid[1][14] === 'Quick and clear');
const runQ = queries.slice();
ok('Salesforce read twice more, not once per task: the replies and the names', runQ.length === 5 &&
  runQ.filter(q => /FROM FeedComment/.test(q)).length === 1 && runQ.filter(q => /FROM User/.test(q)).length === 1, runQ.map(q => q.slice(0, 40)).join(' | '));
ok('the names looked up are only the ones not on the register', /FROM User WHERE Id IN \('005X'\)$/.test(runQ.find(q => /FROM User/.test(q)) || ''));
ok('the task query asks who opened it and its due date', /CreatedById, ActivityDate/.test(runQ[0]));

let rows = rowsNow();
const r1 = rows.find(r => r.TaskId === id(1) && r.Kind === 'agent'), r1c = rows.find(r => r.TaskId === id(1) && r.Kind === 'client'), r2 = rows.find(r => r.TaskId === id(2));
ok('the agent, the client, opened and closed', r1 && r1.Agent === 'Randolph Ramdial' && r1.Client === 'Jeremiah Persad' && r1.Opened === '2026-10-14 08:00' && r1.Closed === '2026-10-20 09:10',
  r1 && JSON.stringify([r1.Agent, r1.Client, r1.Opened, r1.Closed]));
ok('the department the notes name, when the Who is a client', r1.Department === 'Underwriting', r1.Department);
ok('a business contact is the department, and there is no client', r2 && r2.Client === '' && r2.Department === 'GLOC Customer Service Chaguanas RSC' && r2.Agent === 'Marissa Khan',
  r2 && JSON.stringify([r2.Client, r2.Department]));
ok('the number of notes', Number(r1.Notes) === 4 && Number(r2.Notes) === 1, r1.Notes + ' ' + r2.Notes);
ok('the client row (held) carries the same record', r1c && r1c.Status === 'held' && r1c.Timeline === r1.Timeline && r1c.Client === 'Jeremiah Persad');

const tl = JSON.parse(r1.Timeline);
const seq = tl.map(e => e.k + (e.b ? ':' + e.b : '')).join(' > ');
ok('the timeline in order: opened, each note and reply with who wrote it, the moves, the close', seq ===
  'open:Ricky Rampersad > note:Elizabeth Lee > note:Ricky Rampersad > move > reply:Shivonne Sammy > due:Elizabeth Lee > note:Elizabeth Lee > close:Elizabeth Lee', seq);
ok('each step has its time, as the branch reads it', tl.map(e => e.a).join() === '2026-10-14 08:00,2026-10-14 08:30,2026-10-15 09:00,2026-10-15 10:00,2026-10-16 11:00,2026-10-16 11:30,2026-10-19 10:00,2026-10-20 09:10', tl.map(e => e.a).join());
ok('a note is its words, at most 140 characters, without the page\'s head', tl.filter(e => e.k === 'note').every(e => e.x.length <= 140 && !/Sales Support ·|Branch Manager ·/.test(e.x)) &&
  /^Emailed underwriting for the outstanding ECG/.test(tl[1].x) && /^Liz, please call the clinic/.test(tl[2].x));
ok('the opening carries the task and its due date', /^Follow up with UW - 1000894223 JEREMIAH PERSAD · due Fri 16 Oct$/.test(tl[0].x), tl[0].x);
ok('the moves: from whom to whom, and the date with the reason (once, not twice)', /^From Sasha to Elizabeth: Sasha is out today$/.test(tl[3].x) &&
  /^From Fri 16 Oct to Mon 19 Oct: Clinic booked for Monday$/.test(tl[5].x) && tl.filter(e => e.k === 'due').length === 1, tl[3].x + ' | ' + tl[5].x);
ok('the close carries the closing note, which is not listed twice', /^Underwriting confirmed the ECG results/.test(tl[7].x) && tl.filter(e => /Underwriting confirmed/.test(e.x)).length === 1);
ok('T2: opened by someone off the register, by name', JSON.parse(r2.Timeline)[0].b === 'Shivonne Sammy');

console.log('\nThe read of how it went, without Claude:\n');
ok('how long, the follow-ups, the moves and how it was worked', /^It took 6 days, with 3 notes before the closing note and 1 reply; it was moved 2 times; worked by phone and e-mail\./.test(r1.Intel), r1.Intel);
ok('where the wait was, and on whom', /The longest wait was 3 days, between the date move of Fri 16 Oct and Elizabeth Lee's note of Mon 19 Oct; the notes say it waited on underwriting\./.test(r1.Intel), r1.Intel);
ok('whether the closing note says what was done', /The closing note says what was done\.$/.test(r1.Intel));
ok('the agent\'s summary is still the note itself', mails.some(m => /randolph/.test(m.to) && /<b>What was done:<\/b> Underwriting confirmed the ECG results/.test(m.htmlBody)));

console.log('\nWith Claude: the same one call a run writes both:\n');
P.setProperty('ANTHROPIC_API_KEY', 'sk-test');
let asked = [], reply = '';
env.UrlFetchApp = { fetch: (url, o) => { asked.push(JSON.parse(o.payload)); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: reply }] }) }; } };
TASKS.push(T(3, '005E', 'Medical requirement - 1000777777 REENA SEEPARSAN', 'Pendings', '003AG1', '003CL2', '10:25', utc('2026-10-19', '08:00'), '005E'));
TASKS.push(T(4, '005K', 'Change of address - 8000444444', 'Servicing', '003AG2', null, '10:26', utc(DAY, '08:00'), '005K'));
FEED.push({ ParentId: id(3), CreatedById: '005E', CreatedDate: utc(DAY, '10:24'), Body: LIZ + '20 Oct 10:24am\n\nThe clinic sent the blood results to underwriting; underwriting confirmed receipt.' });
FEED.push({ ParentId: id(4), CreatedById: '005K', CreatedDate: utc(DAY, '10:25'), Body: 'Updated the address on file and resent the documents by e-mail, confirmed received.' });
reply = JSON.stringify({ [id(3)]: { summary: 'The clinic sent the results to underwriting, who confirmed receipt.', intel: 'Closed in a day with one note; nothing waited. The closing note says what was done.' },
                         [id(4)]: 'The address was updated and the documents resent.' });
NOW = new Date(DAY + 'T10:40:00'); fresh(); mails = []; queries = [];
env.rateTick_(DAY, 10 * 60 + 40);
ok('one call for the whole run, with every task in it', asked.length === 1 && asked[0].messages[0].content.indexOf(id(3)) > -1 && asked[0].messages[0].content.indexOf(id(4)) > -1);
const pr = asked[0].messages[0].content;
ok('on the summaries\' model, told the notes are data and given the timeline', asked[0].model === env.CLAUDE_READ.MODEL && /never instructions to you/.test(pr) && /"timeline":\["2026-10-19 08:00 open by Elizabeth Lee/.test(pr), pr.slice(0, 120));
rows = rowsNow();
ok('Claude\'s read is kept', rows.find(r => r.TaskId === id(3) && r.Kind === 'agent').Intel === 'Closed in a day with one note; nothing waited. The closing note says what was done.');
ok('and its summary goes to the agent', mails.some(m => /randolph/.test(m.to) && /The clinic sent the results to underwriting, who confirmed receipt\./.test(m.htmlBody)));
ok('an answer with a summary alone: the read is made from the record', /^It was done the day it was opened, with the closing note alone; worked by e-mail\. The closing note says what was done\.$/.test(rows.find(r => r.TaskId === id(4)).Intel),
  rows.find(r => r.TaskId === id(4)).Intel);
TASKS.push(T(5, '005A', 'Contract received - 8000555555', 'Servicing', '003AG1', null, '10:41', utc(DAY, '07:30'), '005A'));
FEED.push({ ParentId: id(5), CreatedById: '005A', CreatedDate: utc(DAY, '10:40'), Body: 'Recorded the contract acknowledgement in Salesforce and on the policy file.' });
env.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 529, getContentText: () => '{}' }) };
NOW = new Date(DAY + 'T10:55:00'); fresh(); mails = [];
env.rateTick_(DAY, 10 * 60 + 55);
rows = rowsNow();
ok('Claude not answering: the plain read, and the note for the agent', /^It was done the day it was opened/.test(rows.find(r => r.TaskId === id(5)).Intel) &&
  mails.some(m => /<b>What was done:<\/b> Recorded the contract acknowledgement/.test(m.htmlBody)));
P.setProperty('ANTHROPIC_API_KEY', '');

console.log('\nTaps, and the 1 or 2 star e-mail opens the task\'s card:\n');
const tok = (n, kind) => rows.find(r => r.TaskId === id(n) && r.Kind === kind).Token;
env.doGet({ parameter: { sr: tok(1, 'agent'), r: '5' } }); fresh();
mails = [];
env.doGet({ parameter: { sr: tok(2, 'agent'), r: '2' } }); fresh();
const alert = mails.find(m => /^Low rating · 2 of 5/.test(m.subject));
const cardUrl = env.rateIntelUrl_('ricky', tok(2, 'agent'));
ok('the alert links straight to that task\'s card on his page', !!alert && alert.htmlBody.indexOf(env.esc_(cardUrl)) > -1 && /&amp;f=rate&amp;k=/.test(alert.htmlBody) && /&amp;i=r/.test(alert.htmlBody), alert && alert.subject);
ok('and says how it went', alert && /How it went:<\/b> It was done the day it was opened|How it went:<\/b> It took/.test(alert.htmlBody));
ok('the Salesforce link is still there', alert && /guardian\.example\/00TINTEL00000002/.test(alert.htmlBody));

console.log('\nHis page:\n');
const k = env.rateIntelSig_('ricky');
let page = env.doGet({ parameter: { rs: 'ricky', f: 'rate', k } }).getContent();
ok('his link opens the page at once (it reads the tab only)', /<title>Service ratings<\/title>/.test(page) && !/Opening /.test(page));
rows = rowsNow();
ok('a card for every rating, newest first, the old one included', rows.every(r => page.indexOf('id="c' + r.Token + '"') > -1) &&
  page.indexOf('id="c' + tok(5, 'agent') + '"') < page.indexOf('id="c' + tok(1, 'agent') + '"') && page.indexOf('id="c' + tok(1, 'agent') + '"') < page.indexOf('id="c' + OLD_TOK + '"'));
const cardOf = t => { const a = page.indexOf('id="c' + t + '"'), b = page.indexOf('<div class="card rc"', a + 10); return page.slice(a, b < 0 ? page.indexOf('<script>', a) : b); };
const c1 = cardOf(tok(1, 'agent')), c2 = cardOf(tok(2, 'agent')), cOld = cardOf(OLD_TOK);
ok('the stars, who closed it and for whom', /aria-label="5 of 5"/.test(c1) && /<b>Elizabeth<\/b> closed it for <b>Randolph Ramdial<\/b> · the agent/.test(c1));
ok('the client, the department, the type and kind, opened to closed, days and notes', /<span>Client<\/span>Jeremiah Persad/.test(c1) && /<span>Department<\/span>Underwriting/.test(c1) &&
  /<span>Type<\/span>Pendings · Waiting on underwriting/.test(c1) && /Wed 14 Oct 8:00am &rarr; Tue 20 Oct 9:10am/.test(c1) && /<span>Days · notes<\/span>6 · 4/.test(c1));
ok('the department card for the business contact', /<span>Client<\/span><span class="nd">—<\/span>/.test(c2) && /<span>Department<\/span>GLOC Customer Service Chaguanas RSC/.test(c2));
ok('the timeline as a list, in order', /<ol class="tl">/.test(c1) && c1.indexOf('Emailed underwriting') < c1.indexOf('Liz, please call') && c1.indexOf('Liz, please call') < c1.indexOf('Reply from Shivonne Sammy') &&
  c1.indexOf('Reply from Shivonne Sammy') < c1.indexOf('Due date moved by Elizabeth Lee') && c1.indexOf('Due date moved') < c1.indexOf('Closed by Elizabeth Lee'));
ok('and the intelligence read', /<b>Intelligence<\/b>It took 6 days/.test(c1));
ok('a rating not yet given says so', /Waiting for a rating/.test(cardOf(tok(3, 'agent'))));
ok('a client mail held says it was not sent', /Not sent: client mail is held/.test(cardOf(tok(1, 'client'))));
ok('a low rating: the badge that it came to you', /sent to you at/.test(c2) && /aria-label="2 of 5"/.test(c2));
ok('a row from before: its stars and comment, and "—" where nothing was kept', /aria-label="4 of 5"/.test(cOld) && /Quick and clear/.test(cOld) &&
  /<span>Client<\/span><span class="nd">—<\/span>/.test(cOld) && /<span>Department<\/span><span class="nd">—<\/span>/.test(cOld) && /<span>Agent<\/span><span class="nd">—<\/span>/.test(cOld) &&
  /<b>Intelligence<\/b><span class="nd">—<\/span>/.test(cOld) && /Timeline: <span class="nd">—<\/span>/.test(cOld) && /<span>Opened &rarr; closed<\/span><span class="nd">—<\/span>/.test(cOld) &&
  /<span>Days · notes<\/span>2 · <span class="nd">—<\/span>/.test(cOld) && /<b>Sasha<\/b> closed it for <b>Marissa Khan<\/b>/.test(cOld));
// The week: the old 4, Elizabeth's 5 and Sasha's 2.
ok('the week: ratings, the average, the five-star share', /<div class="v">3<\/div><div class="l">ratings this week/.test(page) && /&#9733; 3\.7<\/div><div class="l">the average/.test(page) && /33%<\/div><div class="l">five stars/.test(page));
const askedN = rows.filter(r => /^(sent|test)$/.test(r.Status)).length, gotN = rows.filter(r => /^(sent|test)$/.test(r.Status) && Number(r.Rating) > 0).length;
ok('how many answer, of those asked', page.indexOf('answered: ' + gotN + ' of ' + askedN + ' asked this week') > -1, gotN + ' of ' + askedN);
ok('by who closed it and by type', /<span class="n">Elizabeth<\/span>.*&#9733; 5\.0 · 1/.test(page) && /<span class="n">Sasha<\/span>.*&#9733; 3\.0 · 2/.test(page) && /<div class="bar s"><span class="n">Servicing<\/span>/.test(page));
ok('the lowest, each a link to its card', page.indexOf('data-go="' + tok(2, 'agent') + '"') > -1 && /Nothing under four stars/.test(page) === false);
ok('what the week\'s record says: days, notes, the department most involved', /took [\d.]+ days on average, with [\d.]+ notes; the department most involved: /.test(page));
ok('filters by who closed it, agent or client, type and stars', /<select data-f="closer"/.test(page) && /<option value="elizabeth">Elizabeth<\/option>/.test(page) && /<select data-f="kind"/.test(page) &&
  /<select data-f="type"[^]*<option value="Pendings">/.test(page) && /<select data-f="stars"[^]*<option value="low">1 or 2 stars/.test(page));
ok('every card carries what the filters read', /class="card rc" id="c[^"]+" data-closer="elizabeth" data-kind="agent" data-type="Pendings" data-stars="5"/.test(page) && /data-stars="low"/.test(page) && /data-stars="wait"/.test(page) && /data-stars="none"/.test(page));
const scripts = (page.match(/<script>([\s\S]*?)<\/script>/g) || []).map(s => s.replace(/^<script>|<\/script>$/g, ''));
let parsed = true; scripts.forEach(s => { try { new Function(s); } catch (e) { parsed = false; console.log('    ' + e.message); } });
ok('its script parses', scripts.length === 1 && parsed);
const focus = env.doGet({ parameter: { rs: 'ricky', f: 'rate', k, i: tok(2, 'agent') } }).getContent();
ok('the link from the alert opens that card', focus.indexOf('var F="' + tok(2, 'agent') + '"') > -1 && /<details class="rtl" open>/.test(cardOfIn(focus, tok(2, 'agent'))) && !/<details class="rtl" open>/.test(cardOfIn(focus, tok(1, 'agent'))));
function cardOfIn(html, t) { const a = html.indexOf('id="c' + t + '"'), b = html.indexOf('<div class="card rc"', a + 10); return html.slice(a, b < 0 ? html.indexOf('<script>', a) : b); }
ok('a focus that is not a token is ignored', /var F="";/.test(env.doGet({ parameter: { rs: 'ricky', f: 'rate', k, i: '"><script>x' } }).getContent()));

console.log('\nThe signature:\n');
const bad = env.doGet({ parameter: { rs: 'ricky', f: 'rate', k: k.slice(0, -1) + (k.slice(-1) === 'A' ? 'B' : 'A') } }).getContent();
ok('a wrong k is refused, and shows nothing', /That link is not right/.test(bad) && !/class="card rc"/.test(bad) && !/Jeremiah/.test(bad));
ok('no k at all is refused', /That link is not right/.test(env.doGet({ parameter: { rs: 'ricky', f: 'rate' } }).getContent()));
ok('his k on someone else\'s link is refused', /That link is not right/.test(env.doGet({ parameter: { rs: 'sasha', f: 'rate', k } }).getContent()));
ok('the link is not one of the dated pages\' signatures', k !== env.replySig_('ricky', DAY, 'rate') && k !== env.meSig_('ricky') && k !== env.unitSig_('ricky'));
const kk = env.rateIntelSig_('kamla');
ok('the BMA\'s own signed link is refused until he opens it to her', /That link is not right/.test(env.doGet({ parameter: { rs: 'kamla', f: 'rate', k: kk } }).getContent()));
P.setProperty('RATE_PAGE_ALSO', 'kamla, akaash');
ok('RATE_PAGE_ALSO opens it to the BMA and the Unit Manager', /class="card rc"/.test(env.doGet({ parameter: { rs: 'kamla', f: 'rate', k: kk } }).getContent()) &&
  /class="card rc"/.test(env.doGet({ parameter: { rs: 'akaash', f: 'rate', k: env.rateIntelSig_('akaash') } }).getContent()));
ok('never to a desk', env.rateIntelPerson_('sasha') === null && /Not open to sasha/.test(env.showRatingsLink('sasha')));
P.setProperty('RATE_PAGE_ALSO', '');

console.log('\nWhere he finds the link:\n');
ok('on My day, with the other manager links', /Service ratings, task by task &rarr;/.test(env.rateIntelLink_('ricky', true)) && env.rateIntelLink_('sasha', true) === '');
env.gameOn_ = () => true;
env.gameToday_ = () => null; env.gameHist_ = () => ({}); env.gameThanksTo_ = () => []; env.gameGoal_ = () => null; env.gameQuests_ = () => [];
fresh();
const bm = env.gameBmSec_(DAY, 6);
ok('and under the ratings on his day page', bm.indexOf(env.esc_(env.rateIntelUrl_('ricky'))) > -1 && /Every rating, task by task/.test(bm));

console.log('\nNothing new reaches the wall:\n');
fresh();
const wall = env.wallStaff_(DAY, true), wj = JSON.stringify(wall);
ok('the wall still has its ratings', wall.svc && wall.svc.n === 3, JSON.stringify(wall.svc));
ok('no client, department, timeline, note or read on it', !/Jeremiah|Persad|Reena|Seeparsan|GLOC|Customer Service|Underwriting|underwriting|Shivonne|ECG|clinic|longest wait|closing note|Timeline|Intel|Department|Client/.test(wj),
  (wj.match(/Jeremiah|Persad|GLOC|Customer Service|nderwriting|Shivonne|ECG|clinic|longest wait|closing note|Timeline|Intel|Department|Client/) || [''])[0]);
const st = env.rateStats_(DAY, DAY);
ok('rateStats_, which the wall reads, carries none of the new columns', st.list.every(x => Object.keys(x).join() === 'day,m,n,kind,closer,comment,what'), Object.keys(st.list[0] || {}).join());

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
