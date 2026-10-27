// The day's list on My day (27 October 2026).
//
// Ricky, 6:11am: "I don't like to see the script ... ensure ... it goes out for a better user experience". The morning's
// button opens My day, so the day's list has to be there: what the system set at check-in, each ticked when closed today;
// before check-in, what check-in will set. A unit manager's My day has no staff list.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-27';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], [
  ['akaash@example.com', 'A06869 - Akaash Kalladeen', 'A06869', '4', 'Unit Manager', 'Akaash Kalladeen', 'Active'],
  ['sasha@example.com', 'SL002 - SASHA LALLA', 'SL002', '2', 'Staff', 'SASHA LALLA', 'Active']]);
env.__mkSheet('Attendance', 2, env.ATT.head, []);
env.sfkToken_ = () => ({ instance_url: 'https://sf.example' });
env.workdayProgress_ = () => ({ sf: true, closed: 1, target: 5, pct: 20, _closed: [{ id: '00T1', subject: 'A' }], _all: [{ t: { id: '00T2', subject: 'B', due: DAY, late: false }, ty: 'Servicing' }, { t: { id: '00T9', subject: 'Z', due: '2026-10-20', late: true }, ty: 'Servicing' }] });
env.workdayBars_ = () => []; env.workdayTeam_ = () => [];
let plan = {};
env.planRows_ = () => plan;
env.sdList_ = () => [{ id: '00T5', s: 'Preview one', ty: 'Pendings' }, { id: '00T6', s: 'Preview two', ty: 'Servicing' }];

plan = { KPI1: { Items: JSON.stringify([{ k: 'sf', id: '00T1', subject: 'Closed already', type: 'Servicing' }, { k: 'sf', id: '00T2', subject: 'Still open', type: 'Pendings' }, { k: 'note', text: 'not a task' }]) } };
let m = env.workdayModel_('sasha', DAY);
ok('checked in: the list the system set', m.listSet === true && m.list.length === 2, JSON.stringify(m.list));
ok('a task closed today is ticked, the other is not', m.list[0].done === true && m.list[1].done === false);
ok('each opens its task in Salesforce', m.list[1].url === 'https://sf.example/00T2');
ok('Next up still comes too (the page leaves out what is on the list)', Array.isArray(m.next) && m.next.some(x => x.id === '00T9'));
plan = {};
m = env.workdayModel_('sasha', DAY);
ok('not checked in: what check-in will set, marked so', m.listSet === false && m.list.length === 2 && m.list[0].s === 'Preview one' && m.list[0].ty === 'Pendings');
m = env.workdayModel_('akaash', DAY);
ok('a unit manager\'s My day has no staff list', m.list === undefined);
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
