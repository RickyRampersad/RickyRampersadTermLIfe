// Service ratings: agents and clients rate the work closed for them (20 October 2026).
//
// Ricky: "when a task is closed for an agent, a star rating and a summary ...
// the agent gets to rate the support who had closed that task", and for a
// client "ask the client for the patience, looking at how long it took, and ask
// for a rating".
//
// Pinned here: only a close with a proper note by whoever closed it asks for a
// rating; the agent must be an active agent with an e-mail (never the Branch
// Manager, a department or a former agent), six a day at most; HR, training and
// the tracker's own tasks never ask; the client gets plain words from the kind of
// task (never the subject or the notes), thanks for their patience at three days
// or more, never for a claim, once a fortnight, with a link to stop; client mail
// is held until the wording is approved, and a changed wording needs approving
// again; ten minutes' grace after a close; a tap records the rating, posts it on
// the task's Chatter, and 1 or 2 stars goes to Mr Rampersad alone; a comment is
// kept; the ratings feed the card, his page, the awards and the wall, where no
// low rating, comment or client ever shows; RATE_TEST_TO and RATE_AGENTS = off.
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
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes']]);
const P = env.PropertiesService.getScriptProperties();
let mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkConfigured_ = () => true;
env.sfkToken_ = () => ({ instance_url: 'https://guardian.example' });
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, sasha: { id: '005S' }, elizabeth: { id: '005E' }, azariah: { id: '005A' }, kamla: { id: '005K' } });
env.agentPeople_ = () => ({ 'a-randolph': { name: 'Randolph Ramdial', email: 'randolph@agents.example' }, 'a-marissa': { name: 'Marissa Khan', email: 'marissa@agents.example' } });
const id = n => '00TRATE' + String(n).padStart(9, '0');
const utc = (day, hm) => { const [h, m] = hm.split(':').map(Number); return day + 'T' + String(h + 4).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000+0000'; };
const CONTACTS = {
  '003AG1': { Id: '003AG1', Name: 'Randolph Ramdial', FirstName: 'Randolph', Email: 'randolph@agents.example', RecordType: { Name: 'AGENT' } },
  '003AG2': { Id: '003AG2', Name: 'Marissa Khan', FirstName: 'Marissa', Email: 'marissa@agents.example', RecordType: { Name: 'AGENT' } },
  '003RR':  { Id: '003RR', Name: 'Ricky Rampersad', FirstName: 'Ricky', Email: 'ricky@example.com', RecordType: { Name: 'AGENT' } },
  '003FR':  { Id: '003FR', Name: 'Felicia Rampersad', FirstName: 'Felicia', Email: 'felicia@agents.example', RecordType: { Name: 'AGENT' } },
  '003DP':  { Id: '003DP', Name: 'GLOC Premium Query', FirstName: '', Email: 'premiums@guardian.example', RecordType: { Name: 'BUSINESS CONTACT' } },
  '003CL1': { Id: '003CL1', Name: 'Jeremiah Persad', FirstName: 'Jeremiah', Email: 'jeremiah@client.example', RecordType: { Name: 'CLIENT' } },
  '003CL2': { Id: '003CL2', Name: 'Reena Seeparsan', FirstName: 'Reena', Email: 'reena@client.example', RecordType: { Name: 'CLIENT' } },
  '003CL3': { Id: '003CL3', Name: 'Anil Maharaj', FirstName: 'Anil', Email: 'anil@client.example', RecordType: { Name: 'CLIENT' } }
};
let TASKS = [], FEED = [];
const queries = [];
const cut = s => String(s).slice(0, 19);
env.sfkQuery_ = q => {
  queries.push(q);
  if (/FROM Task WHERE IsClosed = true AND OwnerId IN/.test(q)) {
    const gt = (q.match(/CompletedDateTime > (\S+)/) || [])[1], le = (q.match(/CompletedDateTime <= (\S+)/) || [])[1];
    return TASKS.filter(t => q.indexOf("'" + t.OwnerId + "'") > -1 && (!gt || cut(t.CompletedDateTime) > cut(gt)) && (!le || cut(t.CompletedDateTime) <= cut(le)))
      .sort((a, b) => a.CompletedDateTime.localeCompare(b.CompletedDateTime));
  }
  if (/FROM FeedItem WHERE Type = 'TextPost' AND ParentId IN/.test(q)) return FEED.filter(f => q.indexOf("'" + f.ParentId + "'") > -1).sort((a, b) => b.CreatedDate.localeCompare(a.CreatedDate));
  if (/FROM Contact WHERE Id IN/.test(q)) return Object.values(CONTACTS).filter(c => q.indexOf("'" + c.Id + "'") > -1);
  return [];
};
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'NEW'; };

const head = 'Sales Support · Elizabeth Lee · 20 Oct 9:10am\n\n';
const T = (n, owner, subject, ty, agent, who, at, opened) => ({ Id: id(n), OwnerId: owner, Subject: subject, Task_Type__c: ty, Agent__c: agent, WhoId: who,
  CreatedDate: (opened || DAY) + 'T12:00:00.000+0000', CompletedDateTime: utc(DAY, at) });
const NOTE = n => ({ ParentId: id(n), Body: head + 'Emailed underwriting for the outstanding ECG; the clinic confirmed the booking for Thursday and the client was told.', CreatedById: '005R', CreatedDate: utc(DAY, '09:00') });
TASKS = [
  T(1, '005E', 'Follow up with UW - 1000894223 JEREMIAH PERSAD', 'Pendings', '003AG1', '003CL1', '09:10', '2026-10-14'),   // agent and client, six days
  T(2, '005E', 'Statement request - 8000111111', 'Servicing', '003AG1', '003CL2', '09:12'),                               // closed, no note
  T(3, '005E', 'Contract received - 8000222222', 'Servicing', '003RR', '003RR', '09:14'),                                 // the Branch Manager as agent
  T(4, '005E', 'Contract received - 8000333333', 'Servicing', '003FR', null, '09:16'),                                    // a former agent
  T(5, '005E', 'Premium query - 5001816653', 'Renewa/PDl/Bill', '003DP', '003DP', '09:18'),                               // a department
  T(6, '005E', 'Induction pack for Marissa', 'Training', '003AG2', null, '09:20'),                                        // training: never
  T(7, '005E', 'Email: Re your statement', 'Servicing', '003AG2', null, '09:22'),                                         // the tracker's own
  T(8, '005E', 'Death claim - 1000555555', 'Claims/ Mat', '003AG2', '003CL3', '09:24'),                                   // a claim: the agent yes, the client never
  T(9, '005E', 'Change of address - 8000444444', 'Servicing', '003AG2', null, '10:25')                                    // five minutes ago: not yet
];
FEED = [NOTE(1), NOTE(3), NOTE(4), NOTE(5), NOTE(6), NOTE(7), NOTE(8), NOTE(9),
  { ParentId: id(2), Body: 'Done', CreatedById: '005E', CreatedDate: utc(DAY, '09:12') }];

// ---- the first run --------------------------------------------------------------------------
ok('nothing before seven', env.rateTick_(DAY, 6 * 60 + 50).length === 0 && !mails.length);
fresh(); mails = [];
let out = env.rateTick_(DAY, 10 * 60 + 30);
const toAgent = mails.filter(m => /agents\.example/.test(m.to)), toClient = mails.filter(m => /client\.example/.test(m.to));
ok('two agent e-mails: the pendings task and the claim (to the agent)', toAgent.length === 2 && toAgent.every(m => /randolph|marissa/.test(m.to)), mails.map(m => m.to).join(', '));
ok('nobody else: not the Branch Manager, a former agent, a department, training or the tracker\'s own', !mails.some(m => /ricky@|felicia|premiums/.test(m.to)));
ok('no client e-mail before the wording is approved', !toClient.length);
const a1 = toAgent.find(m => /randolph/.test(m.to));
ok('the agent e-mail: what was closed and by whom', /Done: Follow up with UW/.test(a1.subject) && /how did we do/.test(a1.subject) && /Elizabeth in sales support has closed this task/.test(a1.htmlBody), a1.subject);
ok('a summary of what was done (the note, with no Claude key)', /<b>What was done:<\/b> Emailed underwriting for the outstanding ECG/.test(a1.htmlBody));
ok('six days, opened and closed', /6 days/.test(a1.htmlBody) && /opened Wed 14 Oct/.test(a1.htmlBody));
ok('five stars, each its own link', [1, 2, 3, 4, 5].every(n => a1.htmlBody.indexOf('&amp;r=' + n + '"') > -1 && /\?sr=r/.test(a1.htmlBody)));
ok('the note header never shows', !/Sales Support · Elizabeth Lee/.test(a1.htmlBody));
const tab = () => env.sheetObjects_(env.rateTab_());
let rows = tab();
ok('recorded: two agent rows, one client held (the pendings), none for the claim\'s client', rows.length === 3 && rows.filter(r => r.Kind === 'agent' && r.Status === 'sent').length === 2 &&
  rows.filter(r => r.Kind === 'client').length === 1 && rows.find(r => r.Kind === 'client').Status === 'held' && rows.find(r => r.Kind === 'client').TaskId === id(1), JSON.stringify(rows.map(r => [r.Kind, r.TaskId.slice(-2), r.Status])));
ok('the run log says so', out.length === 1 && /2 sent, 1 client held/.test(out[0]), out.join(' | '));
ok('ten minutes\' grace: the query stops ten minutes ago', queries.some(q => /CompletedDateTime <= 2026-10-20T14:20:00Z/.test(q)));
ok('the mark moves to the last close read', P.getProperty('RATE_SINCE') === '2026-10-20T13:24:00Z', P.getProperty('RATE_SINCE'));

// ---- again in five minutes: nothing twice, and the close from 10:25 now in ------------------
fresh(); mails = [];
out = env.rateTick_(DAY, 10 * 60 + 33);
ok('every five minutes, not every run', !mails.length && !out.length);
NOW = new Date(DAY + 'T10:40:00'); fresh(); mails = [];
out = env.rateTick_(DAY, 10 * 60 + 40);
ok('the 10:25 close, once its ten minutes are up; nothing sent twice', mails.length === 1 && /marissa/.test(mails[0].to) && /Change of address/.test(mails[0].subject), mails.map(m => m.subject).join(' | '));

// ---- the client wording: held, previewed, approved, and changed ------------------------------
ok('held, with the reason', /not been approved/.test(env.rateClientBlocked_()));
mails = [];
env.rateClientPreview();
ok('the previews go to him alone', mails.length === 2 && mails.every(m => m.to === 'ricky@example.com' && /^\[Preview\]/.test(m.subject)));
ok('the preview lists every phrase the client can be sent', /your question about what your policy pays/.test(mails[0].htmlBody) && /Never the task's subject or the notes/.test(mails[0].htmlBody));
env.rateClientApprove('Ricky Rampersad');
ok('approved, live', env.rateClientBlocked_() === '' && P.getProperty('RATE_CLIENTS') === 'send to clients');
const saved = env.RATE_CLIENT_WHAT.pays;
env.RATE_CLIENT_WHAT.pays = 'your question about your policy';
ok('a changed phrase needs approving again', /changed since Ricky Rampersad approved/.test(env.rateClientBlocked_()));
env.RATE_CLIENT_WHAT.pays = saved;
ok('and the wording he approved is live again', env.rateClientBlocked_() === '');

// ---- a client e-mail -------------------------------------------------------------------------
TASKS.push(T(10, '005A', 'Premium paid, not showing - 5001816653 REENA SEEPARSAN', 'Renewa/PDl/Bill', null, '003CL2', '10:31', '2026-10-15'));
FEED.push({ ParentId: id(10), Body: 'Called Ms Seeparsan, she sent the bankers order receipt; forwarded to Customer Service. Agent was rude on the phone, noted.', CreatedById: '005A', CreatedDate: utc(DAY, '10:31') });
NOW = new Date(DAY + 'T10:46:00'); fresh(); mails = [];
env.rateTick_(DAY, 10 * 60 + 46);
const c1 = mails.find(m => /reena/.test(m.to));
ok('the client is asked', !!c1 && /Your request is complete/.test(c1.subject), mails.map(m => m.to).join(', '));
ok('plain words, the policy\'s last four, and thanks for their patience (five days)', c1 && /Dear Reena/.test(c1.htmlBody) && /taken care of .+ \(policy ending 6653\)/.test(c1.htmlBody) && /It took 5 days, and we thank you for your patience\./.test(c1.htmlBody), c1 && c1.htmlBody.slice(0, 600));
ok('never the subject or the notes', c1 && !/bankers order|rude|SEEPARSAN|Premium paid, not showing|Azariah/.test(c1.htmlBody));
ok('nothing internal in a client\'s e-mail: no tracker, no system', c1 && !/Tracker|KPI|Salesforce|generated automatically/i.test(c1.htmlBody));
ok('a way to stop', c1 && /&amp;out=1/.test(c1.htmlBody) && /Stop these e-mails/.test(c1.htmlBody));
TASKS.push(T(11, '005A', 'Statement request - 5001816653', 'Servicing', null, '003CL2', '10:32'));
FEED.push({ ParentId: id(11), Body: 'Printed the annual statement and emailed it to the client, confirmed she received it.', CreatedById: '005A', CreatedDate: utc(DAY, '10:32') });
NOW = new Date(DAY + 'T10:52:00'); fresh(); mails = [];
env.rateTick_(DAY, 10 * 60 + 52);
ok('once a fortnight a client at most', !mails.some(m => /reena/.test(m.to)));

// ---- the taps --------------------------------------------------------------------------------
fresh(); rows = tab();
const tok = (task, kind) => rows.find(r => r.TaskId === id(task) && r.Kind === kind).Token;
mails = []; posts.length = 0;
let page = env.doGet({ parameter: { sr: tok(1, 'agent'), r: '5' } }).getContent();
fresh(); rows = tab();
ok('a tap: thank you, and the stars', /Thank you\./.test(page) && /rating of 5 out of 5 has been recorded/.test(page) && /textarea name="comment"/.test(page));
ok('recorded on the sheet', Number(rows.find(r => r.TaskId === id(1) && r.Kind === 'agent').Rating) === 5);
ok('and on the task\'s Chatter, so the person who closed it sees it', posts.some(p => p[0] === 'FeedItem' && p[1].ParentId === id(1) && /^SERVICE RATING · 5 of 5 from the agent, Randolph\. Thank you, Elizabeth\./.test(p[1].Body)), JSON.stringify(posts));
ok('five stars: no alert', !mails.length);
ok('a rating post is not a note for the game', env.gameProperNote_('SERVICE RATING · 5 of 5 from the agent, Randolph. Thank you, Elizabeth, for all of it today.') === false);
mails = [];
env.doGet({ parameter: { sr: tok(10, 'client'), r: '2' } });
ok('two stars: to Mr Rampersad alone, at once', mails.length === 1 && mails[0].to === 'ricky@example.com' && /Low rating · 2 of 5 from a client · closed by Azariah/.test(mails[0].subject), mails.map(m => m.subject).join(' | '));
ok('with a link to the task', /guardian\.example\/00TRATE000000010/.test(mails[0].htmlBody));
fresh(); mails = [];
env.doGet({ parameter: { sr: tok(10, 'client'), r: '2' } });
ok('the same tap twice: one alert', !mails.length);
fresh(); mails = []; posts.length = 0;
page = env.doPost({ parameter: { sr: tok(10, 'client'), comment: '  Took far too long to   get an answer ' } }).getContent();
fresh(); rows = tab();
ok('a comment is kept', rows.find(r => r.TaskId === id(10)).Comment === 'Took far too long to get an answer' && /Your comment is with the branch/.test(page));
ok('on the Chatter, and to him with the comment', posts.some(p => /comment from the client: "Took far too long/.test(p[1].Body)) && mails.length === 1 && /Took far too long/.test(mails[0].htmlBody));
ok('a link that is not ours', /expired/.test(env.doGet({ parameter: { sr: 'rnothing', r: '5' } }).getContent()));
fresh();
page = env.doGet({ parameter: { sr: tok(10, 'client'), out: '1' } }).getContent();
fresh(); rows = tab();
ok('stop: recorded, and said plainly', /will not ask again/.test(page) && rows.filter(r => r.Email === 'reena@client.example').every(r => r.OptOut === 'yes'));

// ---- the cap, the switches -----------------------------------------------------------------
for (let n = 20; n < 28; n++) { TASKS.push(T(n, '005K', 'Change of address - 80009999' + n, 'Servicing', '003AG2', null, '10:5' + (n - 20))); FEED.push(Object.assign(NOTE(n), { CreatedById: '005K', Body: 'Updated the address on file for the client and resent the documents by e-mail, confirmed received.' })); }
NOW = new Date(DAY + 'T11:20:00'); fresh(); mails = [];
env.rateTick_(DAY, 11 * 60 + 20);
const mar = mails.filter(m => /marissa/.test(m.to)).length;
ok('six a day for one agent at most (she had two already)', mar === 4, String(mar));
P.setProperty('RATE_TEST_TO', 'ricky@example.com');
TASKS.push(T(40, '005E', 'Medical requirement - 1000777777', 'Pendings', '003AG1', '003CL3', '11:15', '2026-10-19'));
FEED.push(NOTE(40));
NOW = new Date(DAY + 'T11:30:00'); fresh(); mails = [];
env.rateTick_(DAY, 11 * 60 + 30);
ok('RATE_TEST_TO: every rating mail to the test address, marked', mails.length === 2 && mails.every(m => m.to === 'ricky@example.com' && /^\[Test · for /.test(m.subject)), mails.map(m => m.to + ' ' + m.subject).join(' | '));
ok('one day: no patience line', /Thank you for giving us the chance to help/.test((mails.find(m => /anil/.test(m.subject)) || {}).htmlBody || ''));
P.deleteProperty ? P.deleteProperty('RATE_TEST_TO') : P.setProperty('RATE_TEST_TO', '');
P.setProperty('RATE_AGENTS', 'off');
TASKS.push(T(41, '005E', 'Medical requirement - 1000888888', 'Pendings', '003AG1', null, '11:25'));
FEED.push(NOTE(41));
NOW = new Date(DAY + 'T11:40:00'); fresh(); mails = [];
env.rateTick_(DAY, 11 * 60 + 40);
ok('RATE_AGENTS = off: no agent mail', !mails.length);
P.setProperty('RATE_AGENTS', '');

// ---- what the ratings feed -----------------------------------------------------------------
fresh(); rows = tab();
['3', '5', '4'].forEach((r, i) => { const row = rows.filter(x => x.Kind === 'agent' && x.Closer === 'kamla')[i]; env.doGet({ parameter: { sr: row.Token, r } }); fresh(); });
env.doGet({ parameter: { sr: rows.filter(x => x.Kind === 'agent' && x.Closer === 'kamla')[3].Token, r: '5' } }); fresh();
const st = env.rateStats_(DAY, DAY);
ok('the week\'s ratings by the person who closed them', st.by.kamla.n === 4 && st.by.kamla.avg === 4.3 && st.by.elizabeth.avg === 5 && st.by.azariah.avg === 2 && st.all.n === 6, JSON.stringify(st.by));
env.gameOn_ = () => true;
env.gameToday_ = () => null; env.gameHist_ = () => ({}); env.gameThanksTo_ = () => []; env.gameGoal_ = () => null;
const aw = env.gameAwards_(DAY, null, {});
const star = aw.list.find(a => a.k === 'service');
ok('Service Star: the best average with three ratings or more', star && star.who.join() === 'kamla' && /4\.3 stars from 4 ratings by agents and clients/.test(star.why), JSON.stringify(star));
ok('and in the WhatsApp text', /\*Service Star:\* Kamla · 4\.3 stars/.test(env.gameAwardsText_(DAY, aw.list, null)));
env.gameQuests_ = () => [];
const card = env.gameCard_('kamla', DAY, []);
ok('on her card: her rating this week', /Service rating this week <b[^>]*>&#9733; 4\.3<\/b> from 4 ratings · 2 five-star/.test(card));
const bm = env.gameBmSec_(DAY, 6);
ok('on his page: everyone\'s, and the latest with the comment', /Service ratings this week · &#9733; 4\.0 from 6/.test(bm) && /Took far too long to get an answer/.test(bm) && /<b>Azariah<\/b> · &#9733; 2\.0 from 1/.test(bm), (bm.match(/Service ratings this week[^<]*/) || [''])[0]);
const wall = env.wallStaff_(DAY, true), wj = JSON.stringify(wall);
ok('the wall: the branch as one, four and five stars by name', wall.svc && wall.svc.avg === 4 && wall.svc.n === 6 && wall.svc.recent.length === 4 && wall.svc.recent.every(r => r.n >= 4), JSON.stringify(wall.svc));
ok('never a low rating by name, a comment or a client', !/Took far too long|Reena|Seeparsan|Jeremiah|Randolph|"n":2/.test(JSON.stringify(wall.svc)) && !wall.events.some(e => /2 stars/.test(e.what)));
ok('on the running feed: the stars, by name', wall.events.some(e => e.who === 'Kamla' && /was given 5 stars by an agent/.test(e.what)));
ok('the wall carries no comment anywhere', !/Took far too long/.test(wj));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
