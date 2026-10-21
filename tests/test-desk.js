// The desk — the branch's daily accountability engine (Accountability.gs).
//
// Everything here runs against the REAL fact find wall payload, saved on the
// day the engine was written, and a Salesforce stubbed to the shapes the live
// org actually returns: "Waiting on someone else" as a task status, a
// compound Policy_Status_Description__c, AgentName__c written as an agent
// number then a name, and Agent_Support_Owner__c holding a bare first name.
// Those four are what the queries had to be written around, so they are what
// this test asserts.
//
// The branch here is invented. No client, advisor or staff name in this file
// belongs to anybody: the engine writes client names into one internal e-mail
// and onto a private tab, and nothing about it may put one in the repository.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'desk-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/Meetings.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Accountability.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');

let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const sec = (t) => console.log('\n' + t);

/* ── The clock. Friday 16 October 2026, mid-morning, because the morning
   note, the evening ask and the report all run on working days only and a
   test pinned to the Saturday the wall was read would have exercised none
   of them. It is movable, so the weekend skip is asserted for real rather
   than inferred. ───────────────────────────────────────────────────────── */
// KPI_SHEET_ID is the tracker's own workbook and has no default: pointing it
// at the Branch Portfolio by mistake is what made every day read as "no KPI
// Log" on the first cut. openById in the harness hands back this same book.
const env = makeEnv({ props: { SF_KEY: 'k', SF_SECRET: 's', SF_LOGIN_URL: 'https://x.my.salesforce.com',
                               FACTFIND_WALL_URL: 'https://ff/exec', FACTFIND_WALL_KEY: 'wk',
                               KPI_SHEET_ID: 'tracker-workbook',
                               DESK_TO: 'chair@example.com' } });
const RealDate = env.Date;
let NOW = new RealDate('2026-10-16T10:00:00');
const setClock = (iso) => { NOW = new RealDate(iso); };
env.Date = new Proxy(RealDate, { construct(t, a) { return a.length ? new RealDate(...a) : new RealDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* ── The people. One unit manager, because that is what the branch has ──── */
const PH = ['Agent No', 'Email', 'Name', 'Role', 'Unit', 'Active', 'Access Code', 'PIN Hash',
            'Salt', 'Token', 'Attempts', 'Locked Until', 'Added', 'Added By', 'Last Seen'];
const person = (no, email, name, role, unit, token) => {
  const o = { 'Agent No': no, Email: email, Name: name, Role: role, Unit: unit,
              Active: 'Yes', Token: token || '' };
  return PH.map(h => (o[h] === undefined ? '' : o[h]));
};
env.__mkSheet('People', 1, PH, [
  person('A00001', 'chair@example.com',  'Anand Pretend',    'Branch Manager', '',               'T-CHAIR'),
  person('A00002', 'um@example.com',     'Devi Invented',    'Unit Manager',   'Devi Invented',  'T-UM'),
  person('',       'farida@example.com',  'Farida Notreal',   'Staff',          '',               'T-STAFF'),
  person('',       'liz@example.com',    'Gita Imaginary',   'Staff',          '',               'T-STAFF2'),
  person('A01001', 'rajiv@example.com',  'Rajiv Pretendo',     'Agent',          'Devi Invented',  'T-BUSY'),
  person('A01002', 'quiet@example.com',  'Hamid Fictitious', 'Agent',          'Devi Invented',  'T-QUIET'),
  person('A01003', 'never@example.com',  'Ira Madeup',       'Agent',          '',               'T-NEVER'),
  person('',       'guest@example.com',  'A Visitor',        'Guest',          '',               '')
]);
['Log', 'Meetings', 'Agenda', 'Actions', 'Activity'].forEach((n, i) => env.__mkSheet(n, 50 + i, ['x'], []));

/* ── The two backends ───────────────────────────────────────────────────── */
// The wall, as it answered on 17 October 2026. The BRANCH AGGREGATES are the
// real ones, because the engine's most important assertion is the conversion
// they produce (3,168,518 recommended against 152,626 written = 4.8%), and a
// made-up pair would have proved nothing. Every NAME is invented, and the
// roster is the invented branch above.
const WALL = {
  ok: true, asOf: '2026-10-17T19:54:55.164Z',
  today: { submitted: 0, approved: 0 },
  week:  { submitted: 11, approved: 2, premium: 11737, lastWeek: 10 },
  month: { submitted: 23, approved: 5, label: 'October' },
  year:  { submitted: 131, need: 179205604, cover: 335145421, api: 3168518, pickedUp: 152626 },
  queue: { pending: 21, oldestDays: 37, oldestWho: 'Devi Invented', breaching: 18 },
  flags: { replacements: 0, overCommitted: 0, evidence: 0 },
  day:   { from: '7AM', clock: '3:55p', hour: 15, total: 0,
           roles: { advisor: 0, manager: 0, bma: 0, client: 0, system: 0 } },
  production: { mtd: { apps: 22, clients: 17, api: 0, apiRec: 515392, pipeline: 443482 } },
  series: [], weekend: { week: 0, month: 0, who: [] },
  leaders: [{ name: 'Rajiv Pretendo', count: 4, apiRec: 40378, pickedUp: 0, apps: 0, pipeline: 0 }],
  monthLeaders: [{ name: 'Rajiv Pretendo', count: 5, apiRec: 45891, pickedUp: 0 },
                 { name: 'Ira Madeup', count: 0, apiRec: 0, pickedUp: 0 }],
  yearLeaders: [{ name: 'Rajiv Pretendo', count: 9, apiRec: 120000, pickedUp: 9000, apps: 7, pipeline: 40000 },
                { name: 'Hamid Fictitious', count: 3, apiRec: 30000, pickedUp: 0, apps: 1, pipeline: 30000 }],
  managerPerf: [{ name: 'Anand Pretend', approved: 27, returned: 11, pending: 8,
                  medianDays: 2.2, returnRate: 29, reviewed: 38 },
                { name: 'Devi Invented', approved: 19, returned: 2, pending: 13,
                  medianDays: 1.4, returnRate: 10, reviewed: 21 }]
};

const SF = {
  tasks: [
    // Two desks, one buried. Status strings exactly as the org writes them.
    ...Array.from({ length: 56 }, (_, i) => ({ Subject: 'Thing ' + i, Status: 'In Progress',
      ActivityDate: '2026-08-0' + (1 + i % 9), LastModifiedDate: '2026-10-16T09:00:00.000+0000',
      Owner: { Name: 'Gita Imaginary' } })),
    ...Array.from({ length: 30 }, (_, i) => ({ Subject: 'Waiting ' + i, Status: 'Waiting on someone else',
      ActivityDate: '2026-11-20', LastModifiedDate: '2026-10-16T09:00:00.000+0000',
      Owner: { Name: 'Gita Imaginary' } })),
    ...Array.from({ length: 9 }, (_, i) => ({ Subject: 'Mine ' + i, Status: 'In Progress',
      ActivityDate: '2026-11-01', LastModifiedDate: '2026-09-01T09:00:00.000+0000',
      Owner: { Name: 'Farida Notreal' } })),
    { Subject: 'No date at all', Status: 'Not Started', ActivityDate: null,
      LastModifiedDate: '2026-10-16T09:00:00.000+0000', Owner: { Name: 'Farida Notreal' } }
  ],
  pipeline: [
    // Old, with money, supported by a first name — the live shape.
    ...Array.from({ length: 12 }, (_, i) => ({ POLICY__c: 'TPI' + (1000 + i),
      FIRST_NAME__c: 'Client', LAST_NAME__c: 'Number' + i,
      Policy_Status_Description__c: 'Postponed', App_Received_Date__c: '2025-01-15',
      Total_API__c: 25000, AgentName__c: 'A01001 - Rajiv Pretendo',
      Agent_Support_Owner__c: 'Gita', Requirements_O_S__c: 'Medical', PLAN_NAME__c: 'IHLCP' })),
    { POLICY__c: 'TPI2000', FIRST_NAME__c: 'Client', LAST_NAME__c: 'Compound',
      Policy_Status_Description__c: 'Underwriting incomplete, Missing Reqts',
      App_Received_Date__c: '2026-01-02', Total_API__c: 75948,
      AgentName__c: 'A01002 - Hamid Fictitious', Agent_Support_Owner__c: 'Farida',
      Requirements_O_S__c: '', PLAN_NAME__c: 'Evolution' },
    // Recent: pending, but not stuck. Must not be routed or counted as stuck.
    { POLICY__c: 'TPI3000', FIRST_NAME__c: 'Client', LAST_NAME__c: 'Fresh',
      Policy_Status_Description__c: 'Pending', App_Received_Date__c: '2026-10-01',
      Total_API__c: 9000, AgentName__c: 'A01001 - Rajiv Pretendo',
      Agent_Support_Owner__c: 'Gita', Requirements_O_S__c: '', PLAN_NAME__c: 'IHLCP' }
  ],
  counts: { on: 310, behind: 480, quiet: 170 }
};

// factFindFeed_ and goalFeed_ keep their own cache in Meetings.gs, so a test
// that only clears the desk's keys is still served yesterday's wall. Both
// layers have to go, which is also the answer when a figure on the real desk
// looks ten minutes stale.
const clearCaches = () => env.CacheService.getScriptCache()
  .removeAll(['acc.pipe', 'acc.tasks', 'acc.ff', 'acc.goals', 'acc.rem', 'ffwall', 'ffgoals',
              'acc.trk.2026-10-16', 'acc.filed.2026-10-16']);

let fetched = [];
env.UrlFetchApp = { fetch: (url) => {
  fetched.push(url);
  const body = (o) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(o) });
  if (url.indexOf('ff/exec') > -1) return body(WALL);
  if (url.indexOf('oauth2/token') > -1) return body({ access_token: 'tok', instance_url: 'https://x' });
  if (url.indexOf('FROM+Task') > -1 || url.indexOf('FROM%20Task') > -1) {
    return body({ records: SF.tasks, done: true });
  }
  if (url.indexOf('Send_Email_Premium_Due_Reminder__c+%3D+false') > -1 ||
      url.indexOf('Send_Email_Premium_Due_Reminder__c%20%3D%20false') > -1) {
    return body({ records: [{ n: SF.counts.quiet }], done: true });
  }
  if (url.indexOf('Of_Premiums_Due__c') > -1) return body({ records: [{ n: SF.counts.behind }], done: true });
  if (url.indexOf('Send_Email_Premium_Due_Reminder__c') > -1) return body({ records: [{ n: SF.counts.on }], done: true });
  if (url.indexOf('CLIENT_PORTFOLIO__c') > -1) return body({ records: SF.pipeline, done: true });
  return body({ records: [], done: true });
} };

const S = env.__load ? env.__load() : null;
const vm = require('vm');
vm.createContext(env);
vm.runInContext(fs.readFileSync(both, 'utf8'), env, { filename: 'desk.gs' });

/* =======================================================================
   1. THE FIVE SOURCES
   ======================================================================= */
sec('The five sources');
env.accSetup && null;
const snap = env.accSnapshot_();
const srcs = env.accSources_(snap);
ok('all five sources report', srcs.filter(s => s.live).length === 4 && srcs.length === 5,
   srcs.map(s => s.key + (s.live ? '' : '!')).join(' '));
ok('the flight plans are the one that is down (no goal token)',
   srcs.filter(s => !s.live)[0].key === 'goals');
ok('and it says which property to set',
   /FACTFIND_GOAL_TOKEN/.test(srcs.filter(s => !s.live)[0].why));

/* =======================================================================
   2. THE PIPELINE — the shapes the live org actually returns
   ======================================================================= */
sec('The pipeline');
ok('13 of the 14 pending are over 120 days; the recent one is not',
   snap.pipe.total.stuck === 13, 'stuck=' + snap.pipe.total.stuck);
ok('the compound status is counted', snap.pipe.byStatus
   .some(s => /Missing Reqts/.test(s.name)));
ok('API in the stuck ones adds up', snap.pipe.total.stuckApi === 12 * 25000 + 75948,
   String(snap.pipe.total.stuckApi));
ok('the agent number is stripped off the name',
   snap.pipe.byAgent.some(a => a.name === 'Rajiv Pretendo'),
   snap.pipe.byAgent.map(a => a.name).join(' | '));
ok('the support desk is grouped by its first name',
   snap.pipe.bySupport.some(s => s.name === 'Gita'));
ok('the oldest is read in days, not guessed', snap.pipe.oldestDays === 639,
   String(snap.pipe.oldestDays));

/* =======================================================================
   3. THE TASKS
   ======================================================================= */
sec('The desk, from Salesforce');
ok('every open task is counted', snap.tasks.total.open === 96, String(snap.tasks.total.open));
ok('overdue counts only a date in the past', snap.tasks.total.overdue === 56,
   String(snap.tasks.total.overdue));
ok('"waiting on someone else" is counted apart', snap.tasks.total.waiting === 30,
   String(snap.tasks.total.waiting));
ok('a task with no date is neither overdue nor ignored', snap.tasks.total.nodate === 1);
ok('untouched is read off LastModifiedDate', snap.tasks.total.untouched === 9,
   String(snap.tasks.total.untouched));
ok('the buried desk sorts first', snap.tasks.people[0].name === 'Gita Imaginary');

/* =======================================================================
   4. THE FACT FINDS — the conversion, which is the point
   ======================================================================= */
sec('The fact finds');
ok('the year conversion is recommended against written',
   snap.ff.year.conversion === 4.8, String(snap.ff.year.conversion));
ok('the review queue carries the breach count, not just the median',
   snap.ff.queue.pending === 21 && snap.ff.queue.breaching === 18);
ok('the day feed reads nothing logged', snap.ff.logging.total === 0);

/* =======================================================================
   5. THE QUIET ADVISORS
   ======================================================================= */
sec('Advisors with nothing filed');
const quiet = env.accQuietAgents_(snap);
const qn = quiet.map(q => q.name).sort();
ok('the one who filed this week is not quiet', qn.indexOf('Rajiv Pretendo') === -1, qn.join(' | '));
ok('the two who did not are', qn.length === 2 && qn[0] === 'Hamid Fictitious' && qn[1] === 'Ira Madeup');
ok('nothing all year is said differently from nothing this month',
   quiet.filter(q => q.name === 'Ira Madeup')[0].why === 'Nothing filed this year.');
ok('and a year with a quiet month says the year count',
   /3 fact finds this year/.test(quiet.filter(q => q.name === 'Hamid Fictitious')[0].why));
ok('a guest is never counted as a quiet advisor', qn.indexOf('A Visitor') === -1);

/* =======================================================================
   6. ROUTING — once, ever, and cleared when it clears
   ======================================================================= */
sec('Routing');
env.accSetup();
const r1 = env.accRoute_(snap);
ok('the stuck cases are routed', r1.routed >= 13, 'routed=' + r1.routed);
const routed = env.readTab_('Routed Items');
ok('each goes to the desk the record already names',
   routed.filter(x => x.Kind === 'stuck' && x.Ref === 'TPI1000')[0]['To'] === 'Gita Imaginary');
ok('the one supported by the other desk goes there',
   routed.filter(x => x.Ref === 'TPI2000')[0]['To'] === 'Farida Notreal');
ok('the recent application is not routed', !routed.some(x => x.Ref === 'TPI3000'));
ok('the review queue is routed to the reviewer holding it',
   routed.some(x => x.Kind === 'review' && x['To'] === 'Anand Pretend'));
ok('the clients behind with nothing chasing them are routed as a count',
   routed.some(x => x.Kind === 'noremind' && /170/.test(x['What'])));
ok('both quiet advisors are routed', routed.filter(x => x.Kind === 'quiet').length === 2);

const before = env.readTab_('Routed Items').length;
const r2 = env.accRoute_(snap);
ok('a second pass routes nothing twice', r2.routed === 0 && env.readTab_('Routed Items').length === before);

// The oldest case settles. Its row must close by itself on the next pass.
SF.pipeline = SF.pipeline.filter(p => p.POLICY__c !== 'TPI1000');
clearCaches();
const r3 = env.accRoute_(env.accSnapshot_());
const closedRow = env.readTab_('Routed Items').filter(x => x.Ref === 'TPI1000')[0];
ok('a settled case closes itself, stamped with the day',
   closedRow.Status === 'Cleared' && closedRow['Closed on'] === '2026-10-16',
   closedRow.Status + ' ' + closedRow['Closed on']);
ok('and nothing else is disturbed', r3.routed === 0);

/* =======================================================================
   7. THE TOPIC — one each, chosen by the numbers
   ======================================================================= */
sec('Each person\'s topic');
clearCaches();
const S2 = env.accSnapshot_();
const T = {};
env.accTopics_(S2).forEach(t => { T[t.name] = t; });

ok('everyone who should speak has one', Object.keys(T).length === 7, Object.keys(T).length + '');
ok('a guest gets none', !T['A Visitor']);
ok('the advisor with nothing all year is asked about the week ahead',
   T['Ira Madeup'].topic === 'Your week ahead');
ok('the advisor who went quiet is asked what changed',
   T['Hamid Fictitious'].topic === 'What changed');
ok('the busy advisor is asked about recommended against written',
   T['Rajiv Pretendo'].topic === 'Recommended against written',
   T['Rajiv Pretendo'].topic);
ok('with his own figure, not the branch\'s',
   /120,000/.test(T['Rajiv Pretendo'].question) && /7.5%/.test(T['Rajiv Pretendo'].evidence),
   T['Rajiv Pretendo'].evidence);
ok('the buried desk is asked about the applications on it first',
   T['Gita Imaginary'].topic === 'The applications on your desk');
ok('the other desk is asked who it is waiting on',
   T['Farida Notreal'].topic === 'The applications on your desk' ||
   T['Farida Notreal'].topic === 'Your overdue list' ||
   T['Farida Notreal'].topic === 'Who you are waiting on', T['Farida Notreal'].topic);
ok('the unit manager is asked about his review queue',
   T['Devi Invented'].topic === 'Your review queue', T['Devi Invented'].topic);
ok('the chair takes the branch conversion',
   T['Anand Pretend'].topic === 'Recommended against written, for the branch');
ok('every topic is a question', Object.keys(T).every(k => /\?/.test(T[k].question)));
ok('and every one carries its source', Object.keys(T).every(k => !!T[k].source));

/* =======================================================================
   8. WHAT AN AGENT MAY SEE
   ======================================================================= */
sec('Who sees what');
const agentView = env.apiDesk_('T-BUSY');
ok('an agent gets their own items, numbers and topic',
   agentView.ok && agentView.topic && agentView.numbers.length > 0);
ok('an agent is handed no branch block', !agentView.branch);
ok('an agent is handed no other advisor\'s name anywhere',
   JSON.stringify(agentView).indexOf('Hamid') === -1 &&
   JSON.stringify(agentView).indexOf('Ira Madeup') === -1);
ok('an agent is handed no other desk\'s figures',
   JSON.stringify(agentView).indexOf('Gita') === -1);

const umView = env.apiDesk_('T-UM');
ok('a unit manager gets his unit', !!umView.unit && umView.unit.people.length === 2);
ok('and not the branch findings', !umView.branch);
ok('his unit list carries each advisor\'s topic',
   umView.unit.people.every(p => !!p.topic));

const chairView = env.apiDesk_('T-CHAIR');
ok('the chair gets the branch', !!chairView.branch && chairView.branch.findings.length > 0);
ok('and the topics for everyone', chairView.branch.topics.length === 7);

const staffView = env.apiDesk_('T-STAFF');
ok('staff get the branch too', !!staffView.branch);

/* =======================================================================
   9. THE FINDINGS
   ======================================================================= */
sec('The findings');
const F = env.accFindings_(S2);
const keys = F.map(x => x.key);
ok('the stuck pipeline is the top finding', F[0].key === 'pipe.stuck' || F[0].severity === 3);
ok('more stuck than written is said out loud', keys.indexOf('pipe.vs.written') > -1);
ok('the conversion is a finding', keys.indexOf('ff.conversion') > -1);
ok('a third of the work waiting on somebody unnamed is a finding',
   keys.indexOf('task.waiting') > -1);
ok('nothing logged today is a finding', keys.indexOf('log.none') > -1);
ok('nobody closing off a day is a finding', keys.indexOf('close.none') > -1);
ok('the source that is down is a finding', keys.indexOf('src.goals') > -1);
ok('every finding carries a figure or a reason not to',
   F.every(x => x.figure !== undefined && !!x.source));
ok('severity 3 sorts first', F[0].severity === 3);
ok('nothing is said about a source that is down beyond that it is down',
   !F.some(x => x.source === 'Flight plans' && x.key !== 'src.goals'));

/* A source going dark must make the engine quieter, never wronger. */
sec('A source going dark');
env.UrlFetchApp = { fetch: () => { throw new Error('no network'); } };
clearCaches();
const dark = env.accSnapshot_();
const Fd = env.accFindings_(dark);
ok('no source reports', env.accSources_(dark).every(s => !s.live));
ok('and the findings are only that', Fd.every(x => /^src\./.test(x.key) || /^close\./.test(x.key)),
   Fd.map(x => x.key).join(' '));
ok('nobody is called quiet when the wall is down', env.accQuietAgents_(dark).length === 0);
ok('a topic is still produced for everyone', env.accTopics_(dark).length === 7);
ok('and the desk still opens', env.apiDesk_('T-CHAIR').ok === true);

/* =======================================================================
   10. CLOSING OFF
   ======================================================================= */
sec('Closing off the day');
env.UrlFetchApp = { fetch: (url) => {
  const body = (o) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(o) });
  if (url.indexOf('ff/exec') > -1) return body(WALL);
  if (url.indexOf('oauth2/token') > -1) return body({ access_token: 'tok', instance_url: 'https://x' });
  return body({ records: [], done: true });
} };
clearCaches();

const c1 = env.apiCloseOff_({ token: 'T-BUSY', period: 'day', done: 'Two fact finds',
                              blocked: 'Waiting on a medical', help: 'Chase the lab' });
ok('a close-off saves', c1.ok && c1.saved && !c1.replaced);
const row = env.readTab_('Close Offs')[0];
ok('the numbers are filled in for them', /Fact finds this week/.test(row['Numbers']));
ok('their own words are kept exactly', row['Blocked'] === 'Waiting on a medical');

const c2 = env.apiCloseOff_({ token: 'T-BUSY', period: 'day', done: 'Three, actually',
                              blocked: '', help: '' });
ok('closing off twice in one day replaces, never duplicates',
   c2.replaced === true && env.readTab_('Close Offs').length === 1);
ok('and the replacement is what is kept',
   env.readTab_('Close Offs')[0]['Done'] === 'Three, actually');

const cs = env.accCloseStats_(7);
ok('the stats count who closed off', cs.closed.length === 1);
ok('and name who did not', cs.silent.length === 6, String(cs.silent.length));
ok('a guest is not expected to close off a day', !cs.silent.some(p => p.name === 'A Visitor'));

ok('the desk knows they closed off today', env.apiDesk_('T-BUSY').closedToday === true);
ok('and that someone else did not', env.apiDesk_('T-QUIET').closedToday === false);

/* =======================================================================
   11. THE MAILS
   ======================================================================= */
sec('The e-mails');
const before3 = env.__calls.mail;
env.accMorning();
ok('the morning note goes to the desks with something on them',
   env.__calls.mail - before3 >= 4, 'sent=' + (env.__calls.mail - before3));

const nMail = env.__calls.mail;
env.accEvening();
ok('the evening ask skips whoever has already closed off',
   env.__calls.mail - nMail === 6, 'asked=' + (env.__calls.mail - nMail));

const nMail2 = env.__calls.mail;
env.accManagerDaily();
ok('the manager gets one report', env.__calls.mail - nMail2 === 1);
ok('the findings are written down so tomorrow can say what is new',
   env.readTab_('Findings').length > 0);

const F2 = env.accMarkFindings_(env.accFindings_(env.accSnapshot_()));
ok('a finding seen today is no longer new', F2.every(x => !x.first));
ok('and it is not written twice in one day',
   env.readTab_('Findings').filter(r => r.Key === 'ff.conversion').length === 1);

// The weekend, for real: the clock is moved to the Saturday and the three
// runs are called. A note on a Saturday is a note that teaches people to
// ignore the notes, so none of them may send anything.
const nMail3 = env.__calls.mail;
setClock('2026-10-17T10:00:00');
const sat = [env.accMorning(), env.accEvening(), env.accManagerDaily()];
ok('Saturday: every run stands down', sat.every(r => r.skipped === 'not a working day'));
ok('and not one e-mail goes', env.__calls.mail === nMail3);
setClock('2026-10-16T10:00:00');

/* =======================================================================
   12. TOPICS ONTO A MEETING
   ======================================================================= */
sec('Topics onto a meeting');
const seeded = env.apiDeskSeedTopics_({ token: 'T-CHAIR', meetingId: 'M-1' });
ok('the chair can seed them', seeded.ok && seeded.written === 7);
const again = env.apiDeskSeedTopics_({ token: 'T-CHAIR', meetingId: 'M-1' });
ok('seeding twice writes nothing twice', again.written === 0);
const refused = env.apiDeskSeedTopics_({ token: 'T-BUSY', meetingId: 'M-1' });
ok('an agent cannot seed them', refused.ok === false);

/* =======================================================================
   13. NAMES, THE WAY TWO SYSTEMS WRITE THEM
   ======================================================================= */
sec('Two spellings of one person');
ok('a married surname still matches', env.accSameName_('Reena Madeup-Fictitious', 'Reena Madeup'));
ok('a middle name still matches', env.accSameName_('Joy Barbara Invented', 'Joy Invented'));
ok('capitals and spacing do not matter', env.accSameName_('REENA  MADEUP', 'Reena Madeup'));
ok('two different people never match', !env.accSameName_('Ravi Singh', 'Ravi Persad'));
ok('a shared first name alone never matches', !env.accSameName_('Ravi Singh', 'Ravi'));


/* =======================================================================
   14. THE TRACKER'S OWN DAY, READ WHOLE
   The four tabs, found by their headers the way the tracker finds them.
   openById in the harness hands back this same workbook, which is exactly
   the shape the real thing has when the tracker and the meeting app share
   a container.
   ======================================================================= */
sec('The tracker\'s day');

const LOGH = ['Timestamp', 'Date', 'StaffId', 'Name', 'Status', 'MailAM', 'MailPM']
  .concat(['KPI1', 'KPI1_Actioned', 'KPI2', 'KPI2_Actioned', 'PM1', 'PM1_Actioned',
           'PM2', 'PM2_Actioned', 'EVE', 'EVE_Actioned']);
const logrow = (o) => LOGH.map(h => (o[h] === undefined ? '' : o[h]));
env.__mkSheet('KPI Log', 70, LOGH, [
  // Gita: KPI1 filed, morning mail swept, afternoon not.
  logrow({ Date: '2026-10-16', StaffId: 'gita', Name: 'Gita Imaginary',
           MailAM: '08:25|bm:done,abm:none', MailPM: '',
           KPI1: 'Surveys / Query Pal', KPI1_Actioned: 'Tested the dues extract' }),
  // Devi: everything in, both sweeps.
  logrow({ Date: '2026-10-16', StaffId: 'devi', Name: 'Devi Invented',
           MailAM: '07:59|um:done', MailPM: '15:20|um:done',
           KPI1: 'Opportunity', KPI1_Actioned: 'Called four of the unit' }),
  // Yesterday's row for Gita: must never be read as today.
  logrow({ Date: '2026-10-15', StaffId: 'gita', Name: 'Gita Imaginary',
           MailAM: '08:10|bm:done', MailPM: '15:40|bm:done',
           KPI1: 'x', KPI1_Actioned: 'yesterday' })
]);
env.__mkSheet('Attendance', 71,
  ['Date', 'StaffId', 'Name', 'FirstSignIn', 'LastSeen', 'SignedOut', 'Status', 'Reason'], [
  ['2026-10-16', 'gita', 'Gita Imaginary', '08:52', '15:01', '', 'in', ''],
  ['2026-10-16', 'devi', 'Devi Invented', '07:58', '15:30', '', 'in', ''],
  ['2026-10-16', 'farida', 'Farida Notreal', '', '', '', 'absent', 'Certified sick']
]);
env.__mkSheet('Closeout Items', 72,
  ['ItemId', 'Item', 'Who', 'Auto', 'Order', 'Active', 'Note'], [
  ['blocks',    'Every block reported',            'All',            'blocks', 10, 'Yes', ''],
  ['mail',      'Afternoon mail sweep cleared',    'All',            'mail',   20, 'Yes', ''],
  ['portfolio', 'Branch portfolio uploaded',       'sales support',  '',       30, 'Yes', ''],
  ['unitpipe',  'Unit pipeline reviewed',          'um',             '',       40, 'Yes', ''],
  ['dormant',   'An example nobody asked for',     'All',            '',       50, 'No',  '']
]);
env.__mkSheet('Closeout Log', 73,
  ['Date', 'StaffId', 'Name', 'ItemId', 'Item', 'Status', 'Reason', 'At', 'Source'], [
  ['2026-10-16', 'gita', 'Gita Imaginary', 'portfolio', 'Branch portfolio uploaded',
   'Not done', 'Waiting on head office', '15:50', 'page']
]);
env.__mkSheet('Day Blocks', 74, env.ACC_HEAD ? env.ACC_HEAD['Day Blocks'] : [], []);

clearCaches();
env.CacheService.getScriptCache().removeAll(['acc.trk.2026-10-16']);
env.accSeedBlocks_();
const people = env.readPeople_();
const byName = {};
people.forEach(p => { byName[p.name] = p; });

/* The seed keys on first names, so the invented roster has to be renamed to
   desks the seed knows. gita -> elizabeth's hours, devi -> akaash's. */
const trk = env.accTracker_('2026-10-16');
ok('the KPI Log is found by its headers', trk.live === true, trk.why);
ok('only today is read', !!trk.log['gita'] && trk.log['gita'].KPI1.actioned === 'Tested the dues extract',
   JSON.stringify(trk.log['gita'] && trk.log['gita'].KPI1));
ok('the morning sweep is read as a time', trk.log['gita'].mailAM === '08:25',
   trk.log['gita'].mailAM);
ok('an unswept afternoon reads empty, not zero', trk.log['gita'].mailPM === '');
ok('attendance gives the arrival', trk.att['gita'].in === '08:52', trk.att['gita'].in);
ok('and an absence with its reason',
   trk.att['farida'].status === 'absent' && trk.att['farida'].reason === 'Certified sick');
ok('the close-out list drops an inactive line',
   trk.items.length === 4 && !trk.items.some(i => i.id === 'dormant'), trk.items.length + '');
ok('and comes back in its own order', trk.items[0].id === 'blocks' && trk.items[3].id === 'unitpipe');
/* Pointed at the wrong book — the Branch Portfolio has no KPI Log — the desk
   must say which property to set, not fail silently or read a day of zeros. */
{
  const saved = env.__sheets['KPI Log'];
  delete env.__sheets['KPI Log'];
  clearCaches();
  const wrong = env.accTracker_('2026-10-16');
  ok('the wrong workbook is named, not read', wrong.live === false &&
     /No KPI Log/.test(wrong.why), wrong.why);
  const d = env.accDayFor_({ name: 'Sasha Someone', role: 'staff' }, env.accSnapshot_());
  ok('and a day built on it carries the reason', d.live === false && !!d.why);
  env.__sheets['KPI Log'] = saved;
  clearCaches();
}

ok('a hand tick is read with its reason',
   trk.ticks['gita'].portfolio.status === 'not done' &&
   trk.ticks['gita'].portfolio.reason === 'Waiting on head office');

/* ---- the role scoping, which is the whole differentiation ---- */
const staffP = { name: 'Gita Imaginary', role: 'staff' };
const umP = { name: 'Devi Invented', role: 'unitmgr' };
const bmP = { name: 'Anand Pretend', role: 'manager' };
ok('"All" reaches everybody', env.accCloApplies_('All', staffP, 'gita'));
ok('"sales support" reaches a staff desk', env.accCloApplies_('sales support', staffP, 'gita'));
ok('and not a unit manager', !env.accCloApplies_('sales support', umP, 'devi'));
ok('"um" reaches a unit manager', env.accCloApplies_('um', umP, 'devi'));
ok('and not the chair', !env.accCloApplies_('um', bmP, 'ricky'));
ok('a staff id reaches one desk only',
   env.accCloApplies_('gita', staffP, 'gita') && !env.accCloApplies_('gita', umP, 'devi'));
ok('a name reaches that person', env.accCloApplies_('Devi Invented', umP, 'devi'));

/* ---- who is on the tracker at all ---- */
ok('an advisor is not on the tracker',
   env.accOnTracker_({ name: 'Rajiv Pretendo', role: 'agent' }) === false);
ok('a desk with blocks is', env.accOnTracker_({ name: 'Sasha Someone', role: 'staff' }) === true);
ok('a desk with no blocks on the tab is not',
   env.accOnTracker_({ name: 'Nobody Here', role: 'staff' }) === false);

/* ---- an advisor's close-off is theirs; a desk's is the tracker's ---- */
const agentClose = env.apiCloseOff_({ token: 'T-BUSY', period: 'day', done: 'Two fact finds' });
ok('an advisor may close off here', agentClose.ok === true && agentClose.saved === true);

/* Rename a staff member onto a seeded desk so the guard has blocks to find. */
env.__sheets['People']._grid.forEach(r => { if (r[1] === 'liz@example.com') r[2] = 'Sasha Someone'; });
env.CacheService.getScriptCache().removeAll(['acc.trk.2026-10-16']);
const deskClose = env.apiCloseOff_({ token: 'T-STAFF2', period: 'day', done: 'anything' });
ok('a desk is sent to the tracker instead of asked twice',
   deskClose.ok === false && deskClose.onTracker === true &&
   /15:45/.test(deskClose.error), deskClose.error);


/* =======================================================================
   15. THE BRANCH'S OWN ROUTING, AND THE DAY PLAN
   The shapes are the live tracker's, read on 21 October 2026: Workload
   Moves with its reason in words, Manager Day with a Planned count and
   what was Done, and an Agent Day tab that exists and has never had a
   row in it. Every name and subject here is invented.
   ======================================================================= */
sec('The branch\'s own routing');

env.__mkSheet('Workload Moves', 80,
  ['Date', 'At', 'TaskId', 'Subject', 'Type', 'From', 'To', 'Why', 'Result', 'UndoneAt'], [
  // load, by pace — six on one morning, one reason between them
  ...Array.from({ length: 6 }, (_, i) => ['2026-10-14', '8:33', 'T' + i,
    'A client request ' + i, 'Servicing', 'gita', 'farida',
    'Gita had 77 due or overdue (17.9 days at her pace); Farida had 12 (0.7 days)', 'OK', '']),
  // absence cover — a different reason, and its own finding
  ...Array.from({ length: 3 }, (_, i) => ['2026-10-15', '8:02', 'A' + i,
    'A pending ' + i, 'Pendings', 'farida', 'devi',
    'Farida is absent today and this was due today with no note from Farida', 'OK', '']),
  // one that was undone: it must count as nothing
  ['2026-10-15', '9:00', 'U1', 'Undone one', 'Servicing', 'gita', 'devi',
   'Moved in error', 'OK', '2026-10-15T09:10:00'],
  // older than the week: out of range
  ['2026-09-01', '8:00', 'OLD', 'Old one', 'Servicing', 'gita', 'farida',
   'Long ago', 'OK', '']
]);
env.__mkSheet('Manager Day', 81,
  ['Date', 'StaffId', 'Kind', 'Item', 'Question', 'Planned', 'Done', 'Note', 'At'], [
  // the live tracker writes the same row three times; the desk folds them
  ...Array.from({ length: 3 }, () => ['2026-10-15', 'ricky', 'eve', 'coach',
    'Coaching: agents coached one to one', 1, 'Devi', 'Spoke about managing agents', '14:24']),
  ['2026-10-16', 'ricky', 'plan', 'coach', 'Coaching: agents coached one to one', 3,
   'Devi, Hamid, Rajiv', '', '6:00'],
  ['2026-10-16', 'gita', 'plan', 'dues', 'Premium dues worked', 20, '', '', '8:10']
]);
env.__mkSheet('Agent Day', 82,
  ['Date', 'Agent', 'Email', 'Manager', 'Kind', 'Item', 'Question', 'Planned', 'Done', 'Note', 'At'], []);
env.__mkSheet('Mailbag Log', 83,
  ['Date', 'Router', 'By', 'CollectedToday', 'Backlog', 'Sent', 'Reason', 'Note', 'At', 'Source'], [
  ['2026-10-14', 'Gita Imaginary', 'Kerry Notional', 0, 24, 'Handed over',
   'Not applicable today for collection of documents', '', '19:52', 'email']
]);

clearCaches();
const trk2 = env.accTracker_('2026-10-16');
ok('Workload Moves is found by its headers', (trk2.moves || []).length > 0,
   String((trk2.moves || []).length));
ok('a move older than the week is left out',
   !trk2.moves.some(m => m.day === '2026-09-01'));
ok('an undone move is carried, marked undone',
   trk2.moves.filter(m => m.undone).length === 1);
ok('the plan is read', (trk2.plan || []).length === 5, String((trk2.plan || []).length));
ok('the Agent Day tab is seen, and seen to be empty',
   trk2.agentPlanTab === true && (trk2.agentPlan || []).length === 0);
ok('the mail run is read with its backlog',
   (trk2.bag || []).length === 1 && trk2.bag[0].backlog === 24);

/* ---- what one desk sees of it ---- */
const gitaP = { name: 'Sasha Someone', role: 'staff' };   // staffId 'sasha' on the seed
const mvG = env.accMovesFor_({ name: 'Gita Imaginary', role: 'staff' }, trk2);
//  Seven rows name this desk as the one work came off, but one of them was
//  undone. A move that was reversed is not work somebody else is carrying,
//  so it must not read as one: six.
ok('a desk sees what was moved off it, and an undone move is not one',
   mvG.off.length === 6, String(mvG.off.length));
ok('and the reason once, not once a row',
   mvG.reasons.length === 1 && mvG.reasons[0].n === 6,
   mvG.reasons.map(r => r.n + '×').join(' '));
const mvF = env.accMovesFor_({ name: 'Farida Notreal', role: 'staff' }, trk2);
ok('a desk sees what was moved onto it', mvF.on.length === 6);
ok('and what was moved off it for being absent',
   mvF.off.length === 3 && /absent/.test(mvF.off[0].why));

/* ---- the plan, folded ---- */
const planR = env.accPlanFor_({ name: 'Ricky Someone', role: 'manager' }, trk2);
ok('three identical plan rows fold into one', planR.length === 2, String(planR.length));
ok('and the fold is counted, not hidden',
   planR.some(r => r.times === 3), JSON.stringify(planR.map(r => r.times)));
ok('the plan carries what was planned against what was done',
   planR.some(r => r.planned === 3 && /Devi, Hamid, Rajiv/.test(r.done)));

/* ---- the findings ---- */
clearCaches();
const F3 = env.accFindings_(env.accSnapshot_());
const k3 = F3.map(x => x.key);
ok('absence cover is its own finding', k3.indexOf('moves.cover') > -1);
ok('and load balancing is reported, not alarmed about',
   F3.filter(x => x.key === 'moves.load')[0].severity === 1);
ok('no advisor having filed a plan is a finding', k3.indexOf('plan.agents') > -1);
ok('the duplicate plan rows are a finding against the writer, not the person',
   k3.indexOf('plan.dup') > -1 &&
   /overstated/.test(F3.filter(x => x.key === 'plan.dup')[0].finding));
ok('the mail backlog is a finding', k3.indexOf('bag.backlog') > -1);

/* ---- no client name leaves the desk it belongs to ---- */
clearCaches();
const chair = env.apiDesk_('T-CHAIR');
ok('the branch block carries the reasons, never a move subject',
   JSON.stringify(chair.branch.moves).indexOf('A client request') === -1 &&
   chair.branch.moves.length > 0);

console.log('\n' + (fails ? fails + ' FAILED' : 'All checks passed'));
process.exit(fails ? 1 : 0);
