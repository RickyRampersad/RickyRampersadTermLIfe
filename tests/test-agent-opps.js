// Opportunities on the agent's own book, the 10am report, and feedback from the e-mails (8 Nov 2026).
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const MON = '2026-11-09', TUE = '2026-11-10', SAT = '2026-11-14';
const env = makeEnv(); let DAY = MON; env.todayISO_ = () => DAY;
const P = env.PropertiesService.getScriptProperties(); P.setProperty('AGENT_DAY', 'live'); P.setProperty('MANAGER_EMAIL', 'ricky@example.com');
const N = { key: 'a-neil', name: 'Neil Ramnanan', agentName: 'Neil Ramnanan', code: 'A10024', email: 'neil@example.com', manager: 'akaash@example.com' };
const X = { key: 'a-xena', name: 'Xena Newcomer', agentName: 'Xena Newcomer', code: 'A99999', email: 'xena@example.com', manager: 'ricky@example.com' };
env.agentPeople_ = () => ({ [N.key]: N, [X.key]: X }); env.agentLiveFor_ = () => true;
env.emailFor_ = s => ({ kamla: 'kamla@example.com' })[s] || '';
env.nameFor_ = s => ({ elizabeth: 'Elizabeth Lee', sasha: 'Sasha Lalla', azariah: 'Azariah Griffith' })[s] || s;
env.sfkUsers_ = () => ({ elizabeth: { id: '005LIZ' }, sasha: { id: '005SAS' }, azariah: { id: '005AZA' } });
env.__mkSheet('Agent Day', 1, env.AGDAY.head, []);
const pol = (id, c, name, dob, type, o) => Object.assign({ Id: id, POLICY__c: 'P' + id, PLAN_NAME__c: 'Plan', RecordType: { Name: type }, Contact__c: c, Contact__r: { Name: name, Birthdate: dob }, AGENT__c: '003AG', Policy_Status_Description__c: 'PREMIUM PAYING' }, o || {});
const BOOK = [
  pol('1', 'C1', 'Ana Test', '1985-05-01', 'LIFE', { Life_Coverage__c: 500000, Maturity_Date__c: '2027-03-01', Benificiary_1__c: 'Estate' }),
  pol('2', 'C2', 'Ben Test', '1990-02-02', 'LIFE', { Life_Coverage__c: 250000 }),
  pol('3', 'C3', 'Cal Test', '1970-07-07', 'LIFE', { Life_Coverage__c: 100000, Life_Coverage_Expiry__c: '2029-01-01', Critical_Illness_Coverage__c: 50000 }),
  pol('4', 'C4', 'Dee Test', '1988-08-08', 'LIFE', { Life_Coverage__c: 300000 }),
  pol('5', 'C5', 'Eve Lapsed', '1980-01-01', 'LIFE', { Life_Coverage__c: 300000, Policy_Status_Description__c: 'Lapsed' })];
const inserts = [], closedIds = {}; let feed = [];
env.sfkQuery_ = q => {
  if (/FROM CLIENT_PORTFOLIO__c/.test(q)) return /A10024/.test(q) ? BOOK : [];
  if (/FROM Task WHERE Id IN/.test(q)) return inserts.filter(i => i.o === 'Task').map(i => ({ Id: i.id, IsClosed: !!closedIds[i.id] }));
  if (/FROM FeedItem/.test(q)) return feed;
  return []; };
let n = 0; env.sfkInsert_ = (o, b) => { const id = (o === 'Task' ? '00T' : '0D5') + (++n); inserts.push({ o, id, b }); if (o === 'FeedItem') feed.push({ ParentId: b.ParentId, Body: b.Body, CreatedById: '005ME', CreatedDate: DAY + 'T10:00:00.000+0000' }); return id; };
const mails = []; env.mailSend_ = o => { mails.push(o); return 'relay'; };

console.log('\nWhat is found on Neil\'s book:\n');
const f = env.agOppFind_(N, MON);
ok('maturity first, for Ana', f[0].kind === 'maturity' && f[0].client === 'Ana Test', JSON.stringify(f[0]));
ok('life cover ending, for Cal', f.some(o => o.kind === 'expiry' && o.client === 'Cal Test'));
ok('no critical illness cover for Ben and Dee, not Cal (has CI)', f.some(o => o.kind === 'ci' && o.client === 'Ben Test') && !f.some(o => o.kind === 'ci' && o.client === 'Cal Test'));
ok('the estate as beneficiary for Ana', f.some(o => o.kind === 'ben' && o.client === 'Ana Test'));
ok('a lapsed policy is not read as in force', !f.some(o => o.client === 'Eve Lapsed'));

console.log('\nMonday morning: three tasks, one per client, owned by Liz:\n');
const opened = env.agOppOpen_(N, MON);
const tasks = inserts.filter(i => i.o === 'Task');
ok('three opened', opened.length === 3 && tasks.length === 3, String(opened.length));
ok('one per client', new Set(opened.map(r => r.ContactId)).size === 3);
ok('type Opportunity, owned by Liz (Neil\'s support), due Tuesday, with the agent on it', tasks.every(t => t.b.Task_Type__c === 'Opportunity' && t.b.OwnerId === '005LIZ' && t.b.ActivityDate === TUE && t.b.Agent__c === '003AG'));
ok('the finding posted on each task\'s Chatter', inserts.filter(i => i.o === 'FeedItem').length === 3 && /What we found/.test(inserts.find(i => i.o === 'FeedItem').b.Body));
ok('a second run the same day opens nothing more', env.agOppOpen_(N, MON).length === 0);
ok('Saturday opens nothing', env.agOppOpen_(N, SAT).length === 0);

console.log('\nThe 9:00 follow-up and the 10am report on Tuesday:\n');
DAY = TUE; feed = feed.filter(x => true);
const fu = env.agOppFollowTick_(TUE, 9 * 60 + 5);
ok('Tuesday 9:00: a follow-up on each open one with no word from a person', /follow-ups: 3/.test(fu.join()), fu.join());
ok('it asks Liz for the research and Neil for his answer', /Elizabeth: what has the research found\?/.test(feed[feed.length - 1].Body) && /Neil: how will you take this/.test(feed[feed.length - 1].Body));
ok('only once a day', env.agOppFollowTick_(TUE, 9 * 60 + 30).length === 0);
mails.length = 0;
env.agOppReportTick_(TUE, 10 * 60 + 5);
const ak = mails.find(m => m.to === 'akaash@example.com'), ri = mails.find(m => m.to === 'ricky@example.com');
ok('Akaash gets his unit, Kamla copied', ak && ak.cc === 'kamla@example.com' && /3 open/.test(ak.subject), ak && ak.subject);
ok('it shows Neil 3 waiting on the agent', ak && /Waiting on the agent/.test(ak.htmlBody) && /3 waiting on the agent/.test(ak.htmlBody));
ok('the Branch Manager gets the whole branch', ri && /The branch/.test(ri.subject));
ok('once a day', env.agOppReportTick_(TUE, 10 * 60 + 30).length === 0);

console.log('\nThe morning brief lists them, and asks for feedback:\n');
mails.length = 0; DAY = TUE;
const m2 = env.agentMorningMail2_(N, TUE, { open: { [N.key]: [] }, opps: { [N.key]: { fresh: [], open: env.agOppRows_().filter(r => r.AgentKey === N.key && r.Status === 'open') } } },
  { coach: { title: 'Good morning', note: 'n' }, months: null, goal: null, f3: {}, cases: null, orphans: null, pend: null, review: null, calls: [] });
ok('Your opportunities (3), with Liz researching and Neil\'s answer due', /Your opportunities \(3\)/.test(m2.html) && /Elizabeth is researching it/.test(m2.html) && /Your answer by 10am/.test(m2.html));
ok('the meeting and the feedback taps', /Commit one thing for/.test(m2.html) && /Was this brief useful\?/.test(m2.html) && /agfb=a-neil/.test(m2.html));

console.log('\nFeedback: a tap opens a page; Send records it:\n');
const sig = env.replySig_(N.key, TUE, 'agfb');
const page = env.agFbPage_({ agfb: N.key, d: TUE, q: 'day', v: '4', k: sig }, false).getContent();
ok('the page has 4 chosen and nothing is recorded yet', /value="4" checked/.test(page) && env.agRows_(N.key, TUE, 'fb').fb_day === undefined);
ok('a wrong signature is refused', /expired/.test(env.agFbPage_({ agfb: N.key, d: TUE, q: 'day', v: '4', k: 'x' }, false).getContent()));
env.agFbSave_({ agfb: N.key, d: TUE, q: 'day', v: '4', help: 'manager', note: 'Need a joint call on Ana', k: sig });
const fb = env.agRows_(N.key, TUE, 'fb');
ok('Send records the day and the help', fb.fb_day.Done === '4' && fb.fb_help.Done === 'manager' && /joint call/.test(fb.fb_help.Note));
const rm = env.agentRollupMail_('akaash@example.com', [N], TUE);
ok('the 6pm roll-up says Neil asked for time with his manager', /Asked for time with you tomorrow: Neil/.test(rm.html) && /Day: <b>4\/5<\/b>/.test(rm.html), rm.html.slice(0, 0));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
