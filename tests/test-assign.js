// The day handed out: what goes in each block, why, and what accepting writes.
//
// Run: node tests/test-assign.js
const { makeEnv } = require('./harness');
const env = makeEnv();
const TODAY = '2026-09-18';

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (cond ? '' : '  — ' + (extra === undefined ? '' : JSON.stringify(extra)))); if (!cond) fails++; };

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ada Quill', 'ada', 'ada@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes']]);
env.__mkSheet('KPI Log', 2, env.LOG_HEADERS.slice(), []);
const ada = { staffId: 'ada', name: 'Ada Quill', manager: false };

// Ada's own schedule, so the blocks under test are the ones she works.
env.SCHEDULE.ada = { hours: '8am – 4pm', lunch: '12:30 – 1:30pm', blocks: {
  KPI1: { time: '8 – 10am', focus: 'Premium Dues', kpi: 'Renewa/PDl/Bill' },
  KPI2: { time: '10 – 12pm', focus: 'Billing', kpi: 'Renewa/PDl/Bill' },
  PM1:  { time: '1 – 3pm', focus: 'Orphans', kpi: 'Orphan Adoption Listing' } } };

const t = (n, over) => Object.assign({ id: '00T' + String(n).padStart(12, '0') + 'AAA',
  subject: 'Task ' + n, status: 'In Progress', due: '2026-09-01', late: false, age: n,
  touched: 1, needs: false, hasReason: false }, over || {});
const BOOK = { ada: { 'Renewa/PDl/Bill': [
  t(1, { age: 5 }),
  t(2, { late: true, due: '2026-08-07', age: 42, hasReason: false }),   // worst: overdue, unexplained
  t(3, { needs: true, touched: 21, age: 20 }),                          // next: three weeks of silence
  t(4, { late: true, due: '2026-09-01', age: 17, hasReason: true }),    // overdue but explained
  t(5, { age: 60 }) ] } };
env.sfkOpenBookSafe_ = () => BOOK;
env.metricsFor_ = () => ({ ok: true, staff: { ada: { rateAll: { enough: true, perHour: 1 } } } });

console.log('\nWhat the system hands out:\n');
let r = env.assignDay_({ date: TODAY }, ada);
ok('it answers for her own day', r.ok === true && r.staffId === 'ada', r);
const k1 = r.blocks.filter(b => b.block === 'KPI1')[0];
const k2 = r.blocks.filter(b => b.block === 'KPI2')[0];
const pm1 = r.blocks.filter(b => b.block === 'PM1')[0];
ok('two hours at one an hour is two tasks', k1.room === 2 && k1.items.length === 2, [k1.room, k1.items.length]);
ok('the overdue one nobody has explained is first', k1.items[0].id === t(2).id, k1.items.map(i => i.id));
ok('and it says exactly why', /Overdue since .* with no reason on it/.test(k1.items[0].why), k1.items[0].why);
ok('then the one nothing has happened to', k1.items[1].id === t(3).id && /Nothing has happened to it in 21 days/.test(k1.items[1].why), k1.items[1]);
ok('the next block gets the next worst, never the same task twice',
   k2.items.length === 2 && k2.items.every(i => !k1.items.some(j => j.id === i.id)), k2.items.map(i => i.id));
ok('an explained overdue outranks a merely old one', k2.items[0].id === t(4).id, k2.items.map(i => i.id));
ok('a block Salesforce holds no type for is handed words, not tasks',
   pm1.items.length === 0 && /say in a line what you will get done/.test(pm1.note), pm1);

console.log('\nWhat it will not do:\n');
env.metricsFor_ = () => ({ ok: true, staff: { ada: { rateAll: { enough: false } } } });
r = env.assignDay_({ date: TODAY }, ada);
ok('with no rate to go on it still fills the day, on a plain default',
   r.blocks.filter(b => b.block === 'KPI1')[0].items.length === 3, r.blocks[0]);
env.metricsFor_ = () => ({ ok: true, staff: { ada: { rateAll: { enough: true, perHour: 1 } } } });
env.sfkOpenBookSafe_ = () => null;
r = env.assignDay_({ date: TODAY }, ada);
ok('with Salesforce silent it hands out nothing and says so', r.ok === true && !r.blocks.length && /has not answered/.test(r.note), r);
env.sfkOpenBookSafe_ = () => BOOK;
const his = env.assignDay_({ staffId: 'ricky', date: TODAY }, ada);
ok('asking for somebody else\'s day quietly hands her her own', his.ok === true && his.staffId === 'ada', his.staffId);

console.log('\nAccepting it:\n');
r = env.assignDay_({ date: TODAY }, ada);
const take = {};
r.blocks.forEach(b => { if (b.items.length) take[b.block] = b.items.map(i => ({ k: 'sf', id: i.id, subject: i.subject, type: i.type })); });
let a = env.acceptDay_({ date: TODAY, blocks: take }, ada);
ok('every block is written in one go', a.ok === true && a.wrote === 2, a);
ok('and the plans come back filled', a.plans.KPI1.items.length === 2 && a.plans.KPI2.items.length === 2, a.plans);

console.log('\nAsked again after that:\n');
r = env.assignDay_({ date: TODAY }, ada);
const offered = r.blocks.reduce((n, b) => n + b.items.length, 0);
ok('nothing already on the plan is handed out twice', offered <= 1, r.blocks.map(b => b.items.length));
ok('and the block says it is already planned',
   r.blocks.filter(b => b.block === 'KPI1')[0].planned === 2, r.blocks[0]);

console.log('\nA block the closer has already filed:\n');
env.planWrite_({ staffId: 'ada', name: 'Ada Quill' }, TODAY, 'PM1', { Items: [], ClosedAt: new Date() });
a = env.acceptDay_({ date: TODAY, blocks: { PM1: [{ k: 'sf', id: t(9).id, subject: 'Late arrival', type: 'Renewa/PDl/Bill' }] } }, ada);
ok('is left exactly as it was closed', a.ok === true && a.wrote === 0 && a.skipped.indexOf('PM1') > -1, a);

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
