// Sample rating e-mails for the Branch Manager (21 October 2026, 2026-10-21g).
//
// Ricky, 1:55pm: "send some samples to see the revised and let me click".
//
// Pinned here: rateSamples(n) and Send me sample ratings on his Ratings page
// send up to three agent rating e-mails in the real format, marked [Sample],
// to him alone, built from the latest real agent ratings (or, with none, from
// made-up tasks with no client in them), plus one e-mail with every sample's
// links and his page; each sample has its own row (Kind and Status 'sample'),
// so a tap records, a comment is kept, and 1 or 2 stars brings the [Sample]
// low-rating e-mail with See the whole task; nothing goes on a task's Chatter
// and nobody is opted out; the week, the game (cards, Service Star), the wall
// and its ticker, the agent cap and his page's figures never count a sample;
// the page marks samples, can hide them, and only he has the button.
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
const id = n => '00TSAMPL' + String(n).padStart(8, '0');
const utc = (day, hm) => { const [h, m] = hm.split(':').map(Number); return day + 'T' + String(h + 4).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000+0000'; };
const CONTACTS = {
  '003AG1': { Id: '003AG1', Name: 'Randolph Ramdial', FirstName: 'Randolph', Email: 'randolph@agents.example', RecordType: { Name: 'AGENT' } },
  '003AG2': { Id: '003AG2', Name: 'Marissa Khan', FirstName: 'Marissa', Email: 'marissa@agents.example', RecordType: { Name: 'AGENT' } },
  '003CL1': { Id: '003CL1', Name: 'Jeremiah Persad', FirstName: 'Jeremiah', Email: 'jeremiah@client.example', RecordType: { Name: 'CLIENT' } }
};
let TASKS = [], FEED = [];
const cut = s => String(s).slice(0, 19);
env.sfkQuery_ = q => {
  if (/FROM Task WHERE IsClosed = true AND OwnerId IN/.test(q)) {
    const gt = (q.match(/CompletedDateTime > (\S+)/) || [])[1], le = (q.match(/CompletedDateTime <= (\S+)/) || [])[1];
    return TASKS.filter(t => q.indexOf("'" + t.OwnerId + "'") > -1 && (!gt || cut(t.CompletedDateTime) > cut(gt)) && (!le || cut(t.CompletedDateTime) <= cut(le)))
      .sort((a, b) => a.CompletedDateTime.localeCompare(b.CompletedDateTime));
  }
  if (/FROM FeedItem WHERE Type = 'TextPost' AND ParentId IN/.test(q)) return FEED.filter(f => q.indexOf("'" + f.ParentId + "'") > -1).sort((a, b) => b.CreatedDate.localeCompare(a.CreatedDate));
  if (/FROM Contact WHERE Id IN/.test(q)) return Object.values(CONTACTS).filter(c => q.indexOf("'" + c.Id + "'") > -1);
  return [];
};
let posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'NEW'; };
const T = (n, owner, subject, ty, agent, who, at, opened) => ({ Id: id(n), OwnerId: owner, Subject: subject, Task_Type__c: ty, Agent__c: agent, WhoId: who,
  CreatedDate: opened, CreatedById: '005R', CompletedDateTime: utc(DAY, at) });
const sampleRows = () => { fresh(); return env.sheetObjects_(env.rateTab_()).filter(r => r.Kind === 'sample'); };
const allRows = () => { fresh(); return env.sheetObjects_(env.rateTab_()); };
const toRicky = m => m.to === 'ricky@example.com';

console.log('\nNo real ratings yet: made-up samples, with no client in them:\n');
let line = env.rateSamples(3);
ok('it says what was sent', /^Sent 3 sample rating e-mails to ricky@example\.com, on made-up tasks, and one e-mail with all their links and your Ratings page\.$/.test(line), line);
ok('three samples and one e-mail of links, all to him alone', mails.length === 4 && mails.every(toRicky), mails.map(m => m.to + ' ' + m.subject).join(' | '));
ok('each in the agent e-mail\'s format, marked [Sample]', mails.slice(0, 3).every(m => /^\[Sample\] Done: .+ · how did we do\?$/.test(m.subject) && /in sales support has closed this task for you/.test(m.htmlBody) && /<b>What was done:<\/b>/.test(m.htmlBody)));
let rows = sampleRows();
ok('a row each: Kind and Status sample, its own token, no client', rows.length === 3 && rows.every(r => r.Status === 'sample' && /^r[a-z0-9]{6,}$/i.test(r.Token) && r.Client === '' && r.Email === 'ricky@example.com') &&
  new Set(rows.map(r => r.Token)).size === 3, JSON.stringify(rows.map(r => [r.Kind, r.Status, r.Closer])));
ok('with a record behind it: department, timeline, a read', rows.every(r => r.Department && JSON.parse(r.Timeline).length === 2 && /closing note says what was done/.test(r.Intel)));
ok('the made-up tasks name no client', !mails.some(m => /Jeremiah|Persad|client\.example/.test(m.htmlBody)));

console.log('\nFrom the latest real agent ratings:\n');
TASKS = [T(1, '005E', 'Follow up with UW - 1000894223 JEREMIAH PERSAD', 'Pendings', '003AG1', '003CL1', '09:10', utc('2026-10-14', '08:00')),
         T(2, '005S', 'Statement request - 8000111111', 'Servicing', '003AG2', null, '09:20', utc('2026-10-19', '09:00'))];
FEED = [{ ParentId: id(1), CreatedById: '005E', CreatedDate: utc(DAY, '09:00'), Body: 'Sales Support · Elizabeth Lee · 20 Oct 9:00am\n\nUnderwriting confirmed the ECG results were received and the application moved to approval; the agent was told by e-mail.' },
        { ParentId: id(2), CreatedById: '005S', CreatedDate: utc(DAY, '09:15'), Body: 'Printed the annual statement and e-mailed it to the agent; confirmed received by phone.' }];
fresh(); mails = [];
env.rateTick_(DAY, 10 * 60 + 30);
ok('(the real run: two agent e-mails, the client held)', mails.length === 2 && allRows().filter(r => r.Kind === 'agent').length === 2);
mails = [];
line = env.rateSamples(3);
ok('as many as there are real agent tasks (two), from their closers and kinds', /^Sent 2 sample rating e-mails to ricky@example\.com, from the latest real ones \(Sasha · What the policy has built; Elizabeth · Waiting on underwriting\)/.test(line), line);
ok('to him alone', mails.length === 3 && mails.every(toRicky));
const s1 = mails.find(m => /Follow up with UW/.test(m.subject));
ok('the real subject, kind, days, closer and what was done', s1 && s1.subject === '[Sample] Done: Follow up with UW - 1000894223 JEREMIAH PERSAD · how did we do?' &&
  /Randolph, Elizabeth in sales support has closed this task for you/.test(s1.htmlBody) && /Waiting on underwriting · opened Wed 14 Oct · closed Tue 20 Oct · 6 days/.test(s1.htmlBody) &&
  /<b>What was done:<\/b> Underwriting confirmed the ECG results were received/.test(s1.htmlBody), s1 && s1.subject);
rows = sampleRows();
const fromReal = rows.filter(r => r.TaskId === id(1));
const realRow = allRows().find(r => r.TaskId === id(1) && r.Kind === 'agent');
ok('the sample row carries the real row\'s record', fromReal.length === 1 && fromReal[0].Agent === realRow.Agent && fromReal[0].Client === 'Jeremiah Persad' && fromReal[0].Timeline === realRow.Timeline &&
  fromReal[0].Intel === realRow.Intel && fromReal[0].Closer === 'elizabeth' && fromReal[0].Kind === 'sample' && fromReal[0].Token !== realRow.Token);
ok('its stars are its own token\'s', [1, 2, 3, 4, 5].every(n => s1.htmlBody.indexOf(env.esc_(env.rateLink_(fromReal[0].Token, '&r=' + n))) > -1));
const idx = mails.find(m => /sample rating e-mails to try/.test(m.subject));
ok('the e-mail of links: every sample\'s five stars and card, and his page', idx && /^\[Sample\] 2 sample rating e-mails to try · /.test(idx.subject) &&
  rows.filter(r => r.TaskId).every(r => [1, 2, 3, 4, 5].every(n => idx.htmlBody.indexOf(env.esc_(env.rateLink_(r.Token, '&r=' + n))) > -1) && idx.htmlBody.indexOf(env.esc_(env.rateIntelUrl_('ricky', r.Token))) > -1) &&
  idx.htmlBody.indexOf(env.esc_(env.rateIntelUrl_('ricky'))) > -1, idx && idx.subject);
ok('the real agents were sent nothing more', !mails.some(m => /agents\.example|client\.example/.test(m.to)));

console.log('\nEvery link works, and leaves no trace:\n');
const tk1 = fromReal[0].Token, tk2 = rows.find(r => r.TaskId === id(2)).Token;
posts = []; mails = [];
let page = env.doGet({ parameter: { sr: tk1, r: '4' } }).getContent();
ok('a tap: the thank-you page, said to be a sample', /Your rating of 4 out of 5 has been recorded/.test(page) && /A sample/.test(page) && /nothing on the task's Chatter/.test(page) && /textarea name="comment"/.test(page));
ok('recorded on the sample row', Number(sampleRows().find(r => r.Token === tk1).Rating) === 4);
ok('nothing on the task\'s Chatter, no e-mail for four stars', !posts.length && !mails.length, JSON.stringify(posts));
page = env.doGet({ parameter: { sr: tk2, r: '2' } }).getContent();
const alert = mails.find(m => /Low rating/.test(m.subject));
ok('two stars: the low-rating e-mail, marked [Sample], to him alone', mails.length === 1 && toRicky(alert) && /^\[Sample\] Low rating · 2 of 5 from agent Marissa Khan · closed by Sasha$/.test(alert.subject), mails.map(m => m.subject).join(' | '));
ok('saying it is a sample, with See the whole task opening its card', /<b>A sample\.<\/b>/.test(alert.htmlBody) && /See the whole task/.test(alert.htmlBody) && alert.htmlBody.indexOf(env.esc_(env.rateIntelUrl_('ricky', tk2))) > -1);
ok('still no Chatter', !posts.length);
mails = [];
page = env.doPost({ parameter: { sr: tk2, comment: 'Took too long to hear back' } }).getContent();
ok('a comment is kept on the sample row, not on Chatter', /Your comment is with the branch/.test(page) && sampleRows().find(r => r.Token === tk2).Comment === 'Took too long to hear back' && !posts.length);
ok('and the low-rating e-mail carries it, still [Sample]', mails.length === 1 && /^\[Sample\]/.test(mails[0].subject) && /Took too long to hear back/.test(mails[0].htmlBody));
page = env.doGet({ parameter: { sr: tk1, out: '1' } }).getContent();
ok('"stop these e-mails" on a sample changes nothing', /Nothing was changed/.test(page) && allRows().every(r => r.OptOut !== 'yes'));

console.log('\nSamples count nowhere:\n');
// One real rating, and three five-star samples for Elizabeth (enough for a Service Star if they counted).
const realTok = realRow.Token;
env.doGet({ parameter: { sr: realTok, r: '5' } }); fresh();
mails = [];
env.rateSamples(3); fresh();
sampleRows().filter(r => r.Closer === 'elizabeth' && !r.Rating).forEach(r => { env.doGet({ parameter: { sr: r.Token, r: '5' } }); fresh(); });
ok('(Elizabeth now has three rated samples: a Service Star if they counted)', sampleRows().filter(r => r.Closer === 'elizabeth' && Number(r.Rating) >= 4).length >= 3);
const st = env.rateStats_(DAY, DAY);
ok('the week\'s ratings: the real one alone', st.all.n === 1 && st.by.elizabeth.n === 1 && !st.by.sasha && st.list.length === 1, JSON.stringify(st.by));
env.gameOn_ = () => true;
env.gameToday_ = () => null; env.gameHist_ = () => ({}); env.gameThanksTo_ = () => []; env.gameGoal_ = () => null; env.gameQuests_ = () => [];
const aw = env.gameAwards_(DAY, null, {});
ok('no Service Star from samples', !aw.list.some(a => a.k === 'service'), JSON.stringify(aw.list.map(a => a.k)));
const card = env.gameCard_('elizabeth', DAY, []), scard = env.gameCard_('sasha', DAY, []);
ok('her card counts the real rating only; Sasha\'s none', /Service rating this week <b[^>]*>&#9733; 5\.0<\/b> from 1 rating/.test(card) && !/Service rating this week/.test(scard));
const board = env.gameBoard_(DAY);
ok('the game board: the same', board.people.find(p => p.sid === 'elizabeth').svc.n === 1 && board.people.find(p => p.sid === 'sasha').svc === null && board.svc.n === 1);
const bm = env.gameBmSec_(DAY, 6);
ok('his day page\'s ratings: no sample\'s two stars or comment', /Service ratings this week · &#9733; 5\.0 from 1/.test(bm) && !/Took too long to hear back/.test(bm));
const wall = env.wallStaff_(DAY, true);
ok('the wall: one rating', wall.svc && wall.svc.n === 1 && wall.svc.recent.length === 1, JSON.stringify(wall.svc));
ok('and its ticker: one rating', wall.events.filter(e => /rated the service/.test(e.what)).length === 1, wall.events.map(e => e.what).filter(w => /rated/.test(w)).join(' | '));
// The agent cap and the cool-down read only real rows.
TASKS.push(T(3, '005E', 'Medical requirement - 1000777777', 'Pendings', '003AG1', null, '10:50', utc(DAY, '08:00')));
FEED.push({ ParentId: id(3), CreatedById: '005E', CreatedDate: utc(DAY, '10:49'), Body: 'The clinic sent the blood results to underwriting; underwriting confirmed receipt.' });
NOW = new Date(DAY + 'T11:05:00'); fresh(); mails = [];
env.rateTick_(DAY, 11 * 60 + 5);
ok('a real close still asks the agent: samples are no one\'s cap', mails.length === 1 && /randolph/.test(mails[0].to), mails.map(m => m.to).join());

console.log('\nHis page:\n');
const k = env.rateIntelSig_('ricky');
fresh();
page = env.doGet({ parameter: { rs: 'ricky', f: 'rate', k } }).getContent();
const nS = sampleRows().length;
ok('sample cards, marked Sample', (page.match(/class="card rc sm" id="c[^"]+" data-sample="1"/g) || []).length === nS && /<span class="badge a">Sample<\/span>/.test(page) && /a sample of the agent's e-mail, sent to you/.test(page));
ok('a toggle to hide them', page.indexOf('<input type="checkbox" id="hidesm"> Hide samples (' + nS + ')') > -1);
ok('never in the week\'s figures', /<div class="v">1<\/div><div class="l">ratings this week/.test(page) && /&#9733; 5\.0<\/div><div class="l">the average/.test(page) &&
  /answered: 1 of 3 asked this week/.test(page) && !/<span class="n">Sasha<\/span>/.test(page), (page.match(/answered: [^<]*/) || [''])[0]);
ok('the count says how many samples', new RegExp(', and ' + nS + ' samples').test(page));
ok('the button, signed, for him', /<input type="hidden" name="act" value="samples">/.test(page) && page.indexOf('name="k" value="' + k + '"') > -1 && /Send me sample ratings<\/button>/.test(page));
const scripts = (page.match(/<script>([\s\S]*?)<\/script>/g) || []).map(s => s.replace(/^<script>|<\/script>$/g, ''));
let parsed = true; scripts.forEach(s => { try { new Function(s); } catch (e) { parsed = false; console.log('    ' + e.message); } });
ok('its script parses', scripts.length === 1 && parsed);
P.setProperty('RATE_PAGE_ALSO', 'kamla');
const kpage = env.doGet({ parameter: { rs: 'kamla', f: 'rate', k: env.rateIntelSig_('kamla') } }).getContent();
ok('the BMA, when he opens the page to her, has no button', /class="card rc/.test(kpage) && !/Send me sample ratings/.test(kpage));
mails = [];
ok('and cannot send them by posting', /That link is not right/.test(env.doPost({ parameter: { rs: 'kamla', f: 'rate', k: env.rateIntelSig_('kamla'), act: 'samples' } }).getContent()) && !mails.length);
P.setProperty('RATE_PAGE_ALSO', '');
ok('a post with a wrong k sends nothing', /That link is not right/.test(env.doPost({ parameter: { rs: 'ricky', f: 'rate', k: 'nope', act: 'samples' } }).getContent()) && !mails.length);
NOW = new Date(DAY + 'T11:20:00');
page = env.doPost({ parameter: { rs: 'ricky', f: 'rate', k, act: 'samples' } }).getContent();
ok('the button sends them, and the page says so', mails.length === 4 && mails.every(toRicky) && /<div class="card ok">Sent 3 sample rating e-mails to ricky@example\.com/.test(page),
  mails.length + ' ' + (page.match(/<div class="card ok">[^<]*/) || [''])[0]);
ok('the new samples are on the page it returns', (page.match(/class="card rc sm"/g) || []).length === nS + 3);
NOW = new Date(DAY + 'T11:21:00'); mails = [];
page = env.doPost({ parameter: { rs: 'ricky', f: 'rate', k, act: 'samples' } }).getContent();
ok('a second press within two minutes sends nothing, and says when they went', !mails.length && /Samples went to you at 11:20am: they are in your inbox\. Nothing more was sent\./.test(page),
  (page.match(/<div class="card ok">[^<]*/) || [''])[0]);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
