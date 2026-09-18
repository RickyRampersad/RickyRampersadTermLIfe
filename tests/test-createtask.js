// A line of the plan, made into a Salesforce task.
//
// Asked for on 18 September 2026: when somebody plans work Salesforce does not
// hold, the tracker should offer to create the task — a subject, assigned to
// them, with a due date — so that everything is driven by task and the block
// closer can read it back at the end of the hour.
//
// Run: node tests/test-createtask.js
const { makeEnv } = require('./harness');
const vm = require('vm'), fs = require('fs');
const env = makeEnv();
// The audit trail and the PATCH helper live in KPI-Write.gs. In the project
// both files share one scope, so the test loads it too — the guard that lets
// the create run without it is checked separately at the end.
new vm.Script(fs.readFileSync(__dirname + '/../apps-script/KPI-Write.gs', 'utf8'), { filename: 'KPI-Write.gs' })
  .runInContext(vm.createContext(env));
const TODAY = '2026-09-17';

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (cond ? '' : '  — ' + (extra === undefined ? '' : JSON.stringify(extra)))); if (!cond) fails++; };

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ada Quill', 'ada', 'ada@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes']]);
env.__mkSheet('KPI Log', 2, env.LOG_HEADERS.slice(), []);

const ada = { staffId: 'ada', name: 'Ada Quill', manager: false };
const mgr = { staffId: 'ricky', name: 'Ricky Rampersad', manager: true };

/* ── 1. What Salesforce said, in words ──────────────────────────────────── */
console.log('\nWhen Salesforce refuses, it is quoted rather than dumped:\n');
ok('the message is pulled out of the array',
   env.sfkSaid_('[{"message":"Task Type: bad value for restricted picklist","errorCode":"INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST","fields":["Task_Type__c"]}]')
   === 'Task Type: bad value for restricted picklist (Task_Type__c)');
ok('a plain object works the same', env.sfkSaid_('{"message":"Session expired"}') === 'Session expired');
ok('anything else comes back as it was', env.sfkSaid_('gateway timeout') === 'gateway timeout');

/* ── 2. The insert itself ───────────────────────────────────────────────── */
console.log('\nThe insert, and the token that ages out mid-write:\n');
env.sfkToken_ = () => ({ instance_url: 'https://example.my.salesforce.com', access_token: 'tok' });
let posts = [], codes = [];
env.UrlFetchApp = { fetch: (url, o) => {
  posts.push({ url, method: o.method, auth: o.headers.Authorization, body: JSON.parse(o.payload) });
  const c = codes.shift();
  return { getResponseCode: () => c.code, getContentText: () => c.text };
} };
codes = [{ code: 201, text: '{"id":"00T000000000009AAA","success":true}' }];
let id = env.sfkInsert_('Task', { Subject: 'Interview two recruits' });
ok('a created task hands back its id', id === '00T000000000009AAA', id);
ok('it posts to the Task endpoint, with the token',
   /\/services\/data\/v[0-9.]+\/sobjects\/Task$/.test(posts[0].url) && posts[0].method === 'post' && posts[0].auth === 'Bearer tok', posts[0] && posts[0].url);
posts = []; codes = [{ code: 401, text: 'expired' }, { code: 201, text: '{"id":"00T000000000010AAA"}' }];
id = env.sfkInsert_('Task', { Subject: 'Again' });
ok('a 401 is retried once on a fresh token', id === '00T000000000010AAA' && posts.length === 2, posts.length);
codes = [{ code: 400, text: '[{"message":"Required fields are missing: [Subject]","fields":["Subject"]}]' }];
let threw = '';
try { env.sfkInsert_('Task', {}); } catch (e) { threw = e.message; }
ok('a refusal throws in Salesforce\'s own words', /Required fields are missing/.test(threw), threw);

/* ── 3. Creating one from a plan line ───────────────────────────────────── */
console.log('\nA line on the plan becomes a task:\n');
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ ada: { id: '005A', name: 'Ada Quill', active: true } });
const made = [];
env.sfkInsert_ = (object, body) => { made.push({ object, body }); return '00T9' + String(made.length).padStart(11, '0') + 'AA'; };

let r = env.savePlan_({ date: TODAY, block: 'kpi1', items: [
  { k: 'sf', id: '00T000000000001AAA', subject: 'Chase the premium due', type: 'Renewa/PDl/Bill' },
  { k: 'own', label: 'Interview two recruits' },
  { k: 'own', label: 'Write the branch report' }] }, ada);
ok('the plan starts with two lines of her own', r.ok && r.plan.items.length === 3, r.error);

r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi1',
  label: 'Interview two recruits', subject: 'Interview two recruits',
  type: 'Lic/Staffing/SA/HR', due: TODAY }, ada);
ok('it is created', r.ok === true, r);
ok('assigned to her, due when she said, with the subject she gave',
   made.length === 1 && made[0].body.OwnerId === '005A' && made[0].body.ActivityDate === TODAY &&
   made[0].body.Subject === 'Interview two recruits' && made[0].body.Task_Type__c === 'Lic/Staffing/SA/HR',
   made[0] && made[0].body);
ok('and open, not started-and-forgotten', made[0].body.Status === 'In Progress', made[0].body.Status);
ok('the plan now carries the task, not the words', r.swapped === true &&
   r.plan.items.length === 3 && r.plan.items[1].k === 'sf' && r.plan.items[1].id === r.id &&
   r.plan.items[1].type === 'Lic/Staffing/SA/HR', r.plan && r.plan.items);
ok('her other line is untouched', r.plan.items[2].k === 'own' && r.plan.items[2].label === 'Write the branch report', r.plan.items[2]);
const audit = env.__sheets['KPI Salesforce Writes'];
ok('the write is on the audit tab', !!audit && audit._grid.length === 2 && String(audit._grid[1][4]) === 'create', audit && audit._grid[1]);
ok('naming the task and what it says', !!audit && /Interview two recruits/.test(String(audit._grid[1][6])) && String(audit._grid[1][7]) === 'OK', audit && audit._grid[1]);

console.log('\nWhat it will not do:\n');
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi1', label: 'x', subject: 'Hi', type: 'Servicing', due: TODAY }, ada);
ok('a two-letter subject is refused', !r.ok && /subject/i.test(r.error), r);
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi1', subject: 'Interview two recruits', type: 'Recruitment & Selection', due: TODAY }, ada);
ok('a type Salesforce does not hold is refused', !r.ok && /type/i.test(r.error), r);
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi1', subject: 'Interview two recruits', type: 'Servicing', due: '' }, ada);
ok('no due date is refused', !r.ok && /due date/i.test(r.error), r);
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi1', subject: 'Interview two recruits', type: 'Servicing', due: TODAY }, mgr);
ok('the Branch Manager cannot create one on somebody else\'s plan', !r.ok && /your own plan/i.test(r.error), r);
r = env.createTask_({ staffId: 'ricky', date: TODAY, block: 'kpi1', subject: 'Write the branch plan', type: 'RR Operations', due: TODAY }, mgr);
ok('and on his own, he is told no Salesforce user is matched', !r.ok && /Salesforce user/i.test(r.error), r);
const was = env.sfkConfigured_;
env.sfkConfigured_ = () => false;
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi1', subject: 'Interview two recruits', type: 'Servicing', due: TODAY }, ada);
ok('with Salesforce unconnected it says so plainly', !r.ok && /not connected/i.test(r.error), r);
env.sfkConfigured_ = was;

console.log('\nWhen Salesforce itself refuses:\n');
const good = env.sfkInsert_;
env.sfkInsert_ = () => { throw new Error('Task Type: bad value for restricted picklist'); };
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi1', label: 'Write the branch report',
  subject: 'Write the branch report', type: 'Servicing', due: TODAY }, ada);
ok('nothing is created and the reason is passed on', !r.ok && /refused it: Task Type/.test(r.error), r);
const plan = env.plansFor_(ada, { date: TODAY });
ok('the plan is left exactly as it was', plan.plans.KPI1.items[2].k === 'own', plan.plans.KPI1.items);
ok('the failure is on the audit tab too', /FAILED/.test(String(env.__sheets['KPI Salesforce Writes']._grid[2][7])), env.__sheets['KPI Salesforce Writes']._grid[2]);
env.sfkInsert_ = good;

console.log('\nA block that has already closed:\n');
env.planWrite_ = env.planWrite_;   // untouched; close it the way the closer does
const person = { staffId: 'ada', name: 'Ada Quill' };
env.planWrite_(person, TODAY, 'KPI2', { Items: [{ k: 'own', label: 'Reconcile the group bill' }], ClosedAt: new Date() });
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi2', label: 'Reconcile the group bill',
  subject: 'Reconcile the group bill', type: 'Renewa/PDl/Bill', due: TODAY }, ada);
ok('the task is still created', r.ok === true && !!r.id, r);
ok('but the closed plan is left alone, and says why', r.swapped === false && /already closed/.test(r.note || ''), r.note);

console.log('\nA line that is no longer there:\n');
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'kpi1', label: 'Something nobody typed',
  subject: 'Call the underwriter', type: 'Pendings', due: '2026-09-18' }, ada);
ok('the task is created and added to the plan rather than lost',
   r.ok && r.swapped === false && r.plan.items.some(x => x.k === 'sf' && x.id === r.id), r.plan && r.plan.items);

console.log('\nWithout the write file at all:\n');
const realAudit = env.audit_;
delete env.audit_;
r = env.createTask_({ staffId: 'ada', date: TODAY, block: 'pm1', label: 'Coach one agent',
  subject: 'Coach one agent', type: 'Training', due: TODAY }, ada);
ok('the task is still created, unaudited rather than refused', r.ok === true && !!r.id, r);
env.audit_ = realAudit;

console.log('\nThe types the screen may offer:\n');
const types = env.sfTaskTypes_();
ok('every one is a value Salesforce holds', types.length === 10 && types.every(t => !!env.SF_TYPES[t.value]), types.length);
ok('and carries the label the branch reads',
   types.some(t => t.value === 'Renewa/PDl/Bill' && t.label === 'Renewals / Premium Dues / Billing'));

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
