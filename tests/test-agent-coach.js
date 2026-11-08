// The agent's coach (2 November 2026, 2026-10-29h).
//
// Ricky, 7:11–7:43am: the agent's first screen is their goal and what to do, from the sources; the month just gone with a
// reason; fact finds and the ask; the orphans; what should settle; what the branch is chasing; plan, midday, close-off; "think
// like an international sales manager ... different persons work differently ... don't make it too AI". Pinned here, with
// Felicia Rampersad's real Salesforce production (picked up by month, Oct 2025 to Oct 2026) and her goal plan:
//   - the month's goal is the quarter's API by the days (October $50.5k, November $48.9k on $600k); her usual and best month
//   - she reads as "pipeline": $34k in fact finds, nothing picked up this month; her best month is the personal touch; her
//     manager hears the goal is 3.2× last year
//   - quiet counts only the days she was live; the five from 27 October
//   - October's reason is asked with the first plan of November and refused without; it goes to her manager and the BMA
//   - the midday check-in saves, and "Need help" tells the manager; the fact-find answer lands on Fact Find Responses
//   - a manager sees an agent's day (the Branch Manager and BMA any, a Unit Manager his own) and cannot save it
//   - AGENT_COACH = live sends the coach's morning, the note first, copied to the manager and the BMA; unset, the old one
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-11-02';
const env = makeEnv();
env.todayISO_ = () => DAY;
const realDate = env.Date; let NOW = new realDate(DAY + 'T07:40:00');
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); }, get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Unit', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Branch', 'Yes']]);
env.__mkSheet('Agent Day', 1, env.AGDAY.head, []);
const P = env.PropertiesService.getScriptProperties();
P.setProperty('MANAGER_EMAIL', 'ricky@example.com');
const mails = []; env.mailSend_ = o => { mails.push(o); return 'relay'; };
const F = { key: 'a-felicia-rampersad', name: 'Felicia Rampersad', agentName: 'Felicia Rampersad', agentId: 'A13710', code: 'A13710', email: 'felicia@example.com', manager: '' };
const N = { key: 'a-neil-ramnanan', name: 'Neil Ramnanan', agentName: 'Neil Ramnanan', agentId: 'A10024', code: 'A10024', email: 'neil@example.com', manager: 'akaash@example.com' };
env.agentPeople_ = () => ({ [F.key]: F, [N.key]: N });
env.goalFor_ = name => /Felicia/.test(name) ? { q: [0, 0, 0, 0], api: 600000, title: 'MDRT', contactsWk: 27, apptsWk: 7.5, ffWk: 7.5, appsWk: 2.5, weeksIn: 5, last: null } : null;
env.ff360Feed_ = () => ({});
env.ff360Agent_ = (feed, names) => /Felicia/.test(names.join()) ? { week: 0, month: 0, year: 8, pickedUp: 0, pipeline: 34000, known: true } : { week: 2, month: 2, year: 9, pipeline: 0, known: true };
env.iLoadCache_ = () => null;
env.agentBook_ = a => a.key === F.key ? { urgent: [{ client: 'Shivani Pancham', days: 1829 }, { client: 'Shivani Pancham', days: 367 }, { client: 'Alex John', days: 77 }, { client: 'Alex John', days: 77 }, {}, {}, {}, {}],
  slipped: [{ client: 'Jabraele Talleh' }, { client: 'Jabraele Talleh' }, { client: 'Jason Banmally' }, { client: 'Joshua Gowandan' }, {}], lapsed: [], chase: new Array(8).fill({}), pend: [], follow: [] } : null;
env.bookRows_ = (k, tab) => (k === 'SKILL' && /Household/.test(tab)) ? [
  { Household: 'H1', 'Household name': 'Persad', Token: 'T1', Client: 'Asha Persad', 'Agent assigned': 'Felicia Rampersad', 'Date assigned': '2026-10-19', Feedback: 'Spoke to her, booked appointment for Thursday' },
  { Household: 'H2', 'Household name': 'Ali', Token: 'T2', Client: 'Omar Ali', 'Agent assigned': 'Felicia Rampersad', 'Date assigned': '2026-10-26', Feedback: '' }]
  : (k === 'SKILL' && /Responses/.test(tab)) ? [{ Token: 'T2', Response: 'callme', Needs: 'a call this week', Status: 'Open', 'Assigned to': 'Felicia Rampersad', 'Assigned on': '2026-10-26' }] : [];
// Felicia's real picked-up production by month (CLIENT_PORTFOLIO__c, read 2 Nov 2026), and her one open pending task.
const PICK = [[2026, 9, 4, 16722.72], [2026, 5, 4, 21523.44], [2025, 11, 2, 11877.96], [2025, 12, 1, 18000], [2026, 7, 8, 36943.08], [2025, 10, 2, 9004.68], [2026, 2, 3, 5902.8],
  [2026, 6, 6, 44962.44], [2026, 3, 1, 2895.96], [2026, 1, 5, 18668.04], [2026, 8, 0, 2400]];
const queries = [];
env.sfkQuery_ = q => { queries.push(q);
  if (/FROM CLIENT_PORTFOLIO__c/.test(q)) return PICK.map(([y, m, apps, api]) => ({ ag: 'A13710', y, m, apps, api })).concat([{ ag: 'A10024', y: 2026, m: 11, apps: 1, api: 6000 }]);
  if (/FROM Policy_Increases__c/.test(q)) return [];
  if (/Task_Type__c = 'Pendings'/.test(q)) return /Felicia/.test(q) ? [{ Id: '00TUl00000plS8RMAU', Subject: 'UWPRO: FLORA  SARRAN 5004304211', Owner: { Name: 'Azariah Griffith' }, ActivityDate: '2026-11-03', CreatedDate: '2026-10-30T12:46:51.000+0000' }] : [];
  if (/Fact_Finding_Interviews__c/.test(q)) return /felicia/.test(q) ? [{ Date_of_Interview__c: '2026-03-24', CreatedDate: '2026-03-25T01:06:53.000+0000' }] : [];
  return []; };
env.cmdChatter_ = () => ({});
env.ffResponses_ = () => ({});

console.log('\nThe month\'s goal, her usual and her best:\n');
const g = env.goalFor_('Felicia Rampersad');
ok('October: the quarter by the days, $50.5k on $600k', env.agMonthGoal_(g, '2026-10') === 50543, String(env.agMonthGoal_(g, '2026-10')));
ok('November: $48.9k', env.agMonthGoal_(g, '2026-11') === 48913, String(env.agMonthGoal_(g, '2026-11')));
const mo = env.agMonths_(F, DAY, g);
ok('her usual month last year $15.7k; last year $188.9k', mo.usual === 15742 && mo.lastYear === 188901, JSON.stringify([mo.usual, mo.lastYear]));
ok('her best month: June, $45k on 6 apps', mo.best && mo.best.name === 'June' && mo.best.api === 44962 && mo.best.apps === 6, JSON.stringify(mo.best));
ok('October picked up $0; November so far $0, working day 1 of 21', mo.prevApi === 0 && mo.mtd === 0 && mo.wd.gone === 1 && mo.wd.all === 21, JSON.stringify(mo.wd));

console.log('\nWhat the coach says to her:\n');
const cm = env.agCoachModel_(F, DAY, { fresh: true });
ok('she reads as pipeline: $34k in fact finds, nothing picked up this month', cm.coach.kind === 'pipeline' && /\$34k/.test(cm.coach.note), JSON.stringify(cm.coach));
ok('the personal touch is her own best month', /June: \$45k on 6 apps/.test(cm.coach.touch), cm.coach.touch);
ok('her manager hears the goal is 3.2× last year', /3\.2× last year's \$188\.9k/.test(cm.coach.mgr), cm.coach.mgr);
ok('not quiet: she went live today', cm.att.quiet === 0, JSON.stringify(cm.att));
ok('October to review, below goal, nothing said yet', cm.review && cm.review.name === 'October' && cm.review.below && !cm.review.said && cm.review.target === 50543);
ok('fact finds: no fact find in 223 days, so she is asked', cm.ffAsk && cm.ffDays === 223, JSON.stringify([cm.ffAsk, cm.ffDays]));
ok('orphans: 2 clients, the first 14 days ago, notes on 1, one waiting for a call', cm.orphans.clients === 2 && cm.orphans.oldest === 14 && cm.orphans.noted === 1 && cm.orphans.waiting.length === 1 && cm.orphans.waiting[0].c === 'Omar Ali', JSON.stringify(cm.orphans));
ok('her note sorted as an appointment booked', cm.orphans.kinds.some(k => /appointment/.test(k.l)), JSON.stringify(cm.orphans.kinds));
ok('pendings: Flora Sarran from Salesforce, with Azariah', cm.pend.n === 1 && /FLORA/.test(cm.pend.list[0].c) && cm.pend.list[0].o === 'Azariah', JSON.stringify(cm.pend.list));
ok('her calls: the orphan client first, then premiums by age, each client once', cm.calls[0].c === 'Omar Ali' && cm.calls[1].c === 'Shivani Pancham' && cm.calls.filter(c => c.c === 'Alex John').length === 1, JSON.stringify(cm.calls.map(c => c.c)));
ok('the plan suggested from her goal: 6 calls, 2 appointments, 2 fact finds, 1 app', cm.suggest.calls === 6 && cm.suggest.appts === 2 && cm.suggest.ff === 2 && cm.suggest.apps === 1, JSON.stringify(cm.suggest));

console.log('\nOn by default since 8 Nov 2026; AGENT_COACH = off keeps the old screen:\n');
P.setProperty('AGENT_COACH', 'off');
const link = a => ({ wd: a.key, k: env.workSig_(a.key) });
let m = env.workdayGet_(link(F));
ok('off: Felicia\'s screen is as it was', m.ok && m.native && !m.v2);
const mgrLink = sid => ({ wd: sid, k: env.workSig_(sid) });
m = env.workdayGet_(Object.assign(mgrLink('ricky'), { as: F.key }));
ok('Mr Rampersad sees Felicia\'s day as she will, with what he should know', m.ok && m.v2 && m.viewAs && m.viewAs.by === 'Ricky' && /pipeline/.test(m.coach.coach.mgr), JSON.stringify(m.viewAs));
ok('Akaash cannot open Felicia\'s (not his agent)', !env.workdayGet_(Object.assign(mgrLink('akaash'), { as: F.key })).ok);
ok('Akaash can open Neil\'s', env.workdayGet_(Object.assign(mgrLink('akaash'), { as: N.key })).ok);
ok('a manager cannot save an agent\'s plan from there', !env.workdayPost_(Object.assign(mgrLink('ricky'), { as: F.key, act: 'agplan' })).ok);

console.log('\nThe first plan of November asks about October:\n');
P.setProperty('AGENT_COACH', 'live');
env.CacheService.getScriptCache().remove && env.CacheService.getScriptCache().remove('agcoach_' + F.key + '_' + DAY);
const plan = Object.assign(link(F), { act: 'agplan', m_calls: '6', m_appts: '2', m_ff: '2', m_close: '1', m_apps: '1', m_dues: '3', m_pend: '1' });
['calls', 'appts', 'ff', 'close', 'apps', 'dues', 'pend'].forEach(k => { plan['n_' + k] = ''; });
let r = env.workdayPost_(plan);
ok('refused without what held October back', !r.ok && /held October back/.test(r.error), JSON.stringify(r).slice(0, 160));
mails.length = 0;
r = env.workdayPost_(Object.assign({}, plan, { mreason: 'appts', mnote: 'Booking two a day from the orphan list' }));
ok('with it, the plan saves and she is present', r.ok && r.v2 && r.coach.att.today, JSON.stringify(r).slice(0, 200));
ok('October\'s answer kept and shown back', r.coach.review && r.coach.review.said && r.coach.review.said.reason === 'No appointments');
const rv = mails.find(x => /^October review · Felicia Rampersad/.test(x.subject));
ok('it goes to her manager (Mr Rampersad) with Kamla copied', rv && rv.to === 'ricky@example.com' && rv.cc === 'kamla@example.com' && /No appointments/.test(rv.subject), rv && (rv.to + ' / ' + rv.cc + ' / ' + rv.subject));

console.log('\nMidday and the fact-find answer:\n');
NOW = new realDate(DAY + 'T12:20:00'); mails.length = 0;
r = env.workdayPost_(Object.assign(link(F), { act: 'agmid', m_calls: '3', m_appts: '1', mood: 'Need help', mnote: 'Clients not answering' }));
ok('the midday check-in saves and shows back', r.ok && r.midday && r.midday.done && /Need help/.test(r.midday.mood), JSON.stringify(r.midday));
ok('"Need help" tells her manager, Kamla copied', mails.some(x => /needs help this afternoon/.test(x.subject) && x.to === 'ricky@example.com' && x.cc === 'kamla@example.com'));
ok('the fact-find answer needs a reason', !env.workdayPost_(Object.assign(link(F), { act: 'agff', commit: '2' })).ok);
const ffSaved = []; env.ffReplySave_ = (person, week, q) => { ffSaved.push([person.agent.key, week, q]); return {}; };
r = env.workdayPost_(Object.assign(link(F), { act: 'agff', reason: 'leads', commit: '2', who: '' }));
ok('and goes to the fact-find responses for the week, the help asked for with it', r.ok && ffSaved.length === 1 && ffSaved[0][0] === F.key && ffSaved[0][1] === '2026-11-02' && ffSaved[0][2].reason === 'leads' && ffSaved[0][2].commit === '2' && /names to call/.test(ffSaved[0][2].help), JSON.stringify(ffSaved));

console.log('\nThe morning e-mail, once live:\n');
NOW = new realDate(DAY + 'T05:31:00'); mails.length = 0;
env.agentMorningMail_(F, DAY, { open: { [F.key]: [] }, closed: { [F.key]: [] }, ff: { [F.key]: [] }, f360: {}, goal: {}, q: {}, orphan: {} }, null);
const mm = mails[0] || {};
ok('the coach\'s morning, its title in the subject', /^Your day · Felicia Rampersad · Mon 2 Nov · Your pipeline is ready to close/.test(mm.subject), mm.subject);
ok('the note first, then calls, the goal, fact finds, orphans, the branch, the meeting, feedback (8 Nov 2026)', ['Your pipeline is ready to close', 'Your calls today', 'Your goal', 'Fact finds', 'Orphan clients', 'What the branch is doing for you', 'Wednesday', 'Was this brief useful?'].every((t, i, all) => mm.htmlBody.indexOf(t) > -1 && (i === 0 || mm.htmlBody.indexOf(t) > mm.htmlBody.indexOf(all[i - 1]))), (mm.htmlBody || '').slice(0, 80));
ok('copied to her manager and Kamla', mm.cc === 'ricky@example.com,kamla@example.com', mm.cc);
ok('no cyan in the coach\'s note', (mm.htmlBody || '').indexOf('#E3B23C') > -1);
P.setProperty('AGENT_COACH', 'off'); mails.length = 0;
env.agentMorningMail_(F, DAY, { open: { [F.key]: [] }, closed: { [F.key]: [] }, ff: { [F.key]: [] }, f360: {}, goal: {}, q: {}, orphan: {} }, null);
ok('off: the morning e-mail as before', mails[0] && /being worked for you/.test(mails[0].subject), mails[0] && mails[0].subject);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
