// The day feed, with the branch's structure and the longer view on it.
//
// Two wall pages each carried their own regex over the Role column to decide
// who was management, and on 15 September 2026 they disagreed: the blocks
// page put the Assistant Branch Manager under "Assistant Branch Manager"
// and the day page sorted him into a league table under a support desk.
// The tracker already knows the answer — publicRoster_ carries tier,
// tierLabel and tierOrder off one TIER table — so the feed now hands every
// desk its place and the pages take the order as given.
//
// And the blocks: "two of four filed at eleven" said nothing about whether
// that was a normal morning. Each desk now carries blocks filed this week,
// this month and this year against what it owed, counted in ONE pass over
// the KPI Log, because that sheet is unbounded and the day feed is the one
// that is not stored. Each block also carries the Salesforce figure for the
// task type it is for, when the type exists.
//
// KPI.gs is changing alongside this (blockTypeFor_, periods on the metrics),
// so everything here is asserted against the contract with stubs, and the
// feed has to hold up when the newer pieces are simply not there yet.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'kpi-intel-dayfeed-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Wednesday 16 September 2026, ten in the morning. */
const env = makeEnv();
const NOW = new Date('2026-09-16T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* ── The branch, invented, one desk on every tier and one who has left ─── */
const ACCESS = ['Name', 'Email', 'Password', 'Role', 'Unit', 'Agent Number', 'Active'];
env.__mkSheet('Access', 1, ACCESS, [
  ['Anand Pretend',   'anand@example.com', 'x', 'Branch Manager',              '', '', 'Active'],
  ['Beena Sample',    'beena@example.com', 'x', 'Assit Branch Mgr',            '', '', 'Active'],
  ['Carl Fictitious', 'carl@example.com',  'x', 'Sales Support Assistant',     '', '', 'Left'],
  ['Devi Invented',   'devi@example.com',  'x', 'Unit Manager',                '', '', 'Active'],
  ['Esha Madeup',     'esha@example.com',  'x', "Branch Manager's Assistant",  '', '', 'Active'],
  ['Farid Notreal',   'farid@example.com', 'x', 'Personal Assistant',          '', '', 'Active'],
  ['Gita Imaginary',  'gita@example.com',  'x', 'Sales Support Assistant',     '', '', 'Active']
]);

/* The schedule is keyed by first name, so the pretend desks get their own.
   Anand's four blocks: two on a Salesforce type, one on a label that is a
   type but which the stub carries no figure for, one on words only. */
const blk = (kpi) => ({ time: '8 – 10am', focus: kpi, kpi: kpi });
env.SCHEDULE.anand = { hours: '', lunch: '', blocks: {
  KPI1: blk('Pendings'), KPI2: blk('Reporting'), PM1: blk('Lic/Staffing/SA/HR'), PM2: blk('Opportunity') } };
env.SCHEDULE.gita = { hours: '', lunch: '', blocks: { KPI1: blk('Renewa/PDl/Bill'), KPI2: blk('Servicing') } };
env.SCHEDULE.carl = { hours: '', lunch: '', blocks: { KPI1: blk('Servicing') } };

/* ── The KPI Log, in the tracker's own columns ──────────────────────────── */
const H = env.LOG_HEADERS.slice();
const row = (o) => H.map(h => (o[h] === undefined ? '' : o[h]));
const filed = (sid, name, date, ids, ts) => {
  const o = { Timestamp: ts || (date + 'T16:00:00'), Date: date, StaffId: sid, Name: name };
  ids.forEach(id => { o[id + '_Actioned'] = 'did ' + id; });
  return row(o);
};
env.__mkSheet('KPI Log', 2, H, [
  filed('anand', 'Anand Pretend', '2026-09-16', ['KPI1']),                          // today
  filed('anand', 'Anand Pretend', '2026-09-15', ['KPI1', 'KPI2', 'PM1', 'PM2'], '2026-09-15T09:00:00'), // the older duplicate
  filed('anand', 'Anand Pretend', '2026-09-15', ['KPI1', 'KPI2'], '2026-09-15T17:00:00'),               // the write that stands
  filed('anand', 'Anand Pretend', '2026-09-08', ['PM1']),                           // this month, last week
  filed('anand', 'Anand Pretend', '2026-08-20', ['PM2']),                           // this year, last month
  filed('anand', 'Anand Pretend', '2025-12-30', ['KPI1', 'KPI2']),                  // last year: not counted
  filed('anand', 'Anand Pretend', '2026-09-20', ['KPI1', 'KPI2']),                  // dated ahead: not counted
  filed('gita',  'Gita Imaginary', '2026-09-16', ['KPI1', 'KPI2']),
  filed('carl',  'Carl Fictitious', '2026-09-16', ['KPI1']),
  filed('carl',  'Carl Fictitious', '2026-09-14', ['KPI1'])
]);

/* ── Salesforce, stubbed to the contract ────────────────────────────────── */
const PENDINGS = { open: 2, closed: 1, overdue: 0, needs: 0, touched: 4 };
const RENEWALS = { open: 7, closed: 3, overdue: 1, needs: 2, touched: 9 };
const PERIODS = { staff: { anand: { week: 5, month: 20, ytd: 100 }, gita: { week: 8, month: 30, ytd: 210 } },
                  branch: { week: 13, month: 50, ytd: 310 } };
let metrics = () => ({ ok: true, date: '2026-09-16',
  staff: { anand: { closed: 3, open: 5, overdue: 1, needs: 0, byType: { Pendings: PENDINGS } },
           gita:  { closed: 6, open: 9, overdue: 2, needs: 1, byType: { 'Renewa/PDl/Bill': RENEWALS } },
           beena: { closed: 1, open: 2, overdue: 0, needs: 0, byType: {} } },
  periods: PERIODS });
env.sfkMetricsSafe_ = () => metrics();

/* A person who has left. The Active column reads "Left", and whether the
   tracker's regex treats that as inactive is the tracker's decision; if it
   does not yet, the roster is stubbed the way that build will behave, and
   the feed still has to leave the desk out. */
const rawRoster = env.publicRoster_;
const carlActive = env.roster_().some(p => p.staffId === 'carl' && p.active);
if (carlActive) {
  env.publicRoster_ = () => rawRoster().filter(p => p.staffId !== 'carl');
  console.log('  (Active="Left" is not yet inactive to roster_; publicRoster_ stubbed to leave Carl out)');
}

const build = () => env.iDayBuild_({}).data;
let D = build();
const desk = (sid) => D.desks.find(d => d.name.toLowerCase().indexOf(sid) === 0);

/* ── 1. Every desk knows where it sits ──────────────────────────────────── */
console.log('\nEvery desk carries its place in the branch, from the roster:\n');
ok('six desks, the one who left is not among them',
   D.desks.length === 6 && !desk('carl'), D.desks.map(d => d.name).join(', '));
ok('every desk has tier, tierLabel and tierOrder',
   D.desks.every(d => d.tier && d.tierLabel && typeof d.tierOrder === 'number'),
   JSON.stringify(D.desks.map(d => [d.name, d.tier, d.tierOrder])));
ok('the Branch Manager, the ABM and the Unit Manager are management, first',
   desk('anand').tierOrder === 1 && desk('beena').tierOrder === 1 && desk('devi').tierOrder === 1 &&
   desk('anand').tierLabel === 'Management');
ok("then the Branch Manager's Assistant, the PA, then support",
   desk('esha').tierOrder === 2 && desk('farid').tierOrder === 3 && desk('gita').tierOrder === 4,
   [desk('esha').tierOrder, desk('farid').tierOrder, desk('gita').tierOrder].join());
ok('the feed is already in that order, busiest first inside a tier',
   same(D.desks.map(d => d.name.split(' ')[0]), ['Anand', 'Beena', 'Devi', 'Esha', 'Farid', 'Gita']),
   D.desks.map(d => d.name.split(' ')[0]).join(' > '));
ok('reportsTo and manager ride along',
   'reportsTo' in desk('anand') && desk('anand').manager === true && desk('gita').manager === false);

/* ── 2. Each block carries the Salesforce figure for its type ───────────── */
console.log('\nEach block carries the Salesforce figure for the type it is for:\n');
const abx = desk('anand').bx;
ok('a block on Pendings carries the desk\'s Pendings figure',
   abx[0].type === 'Pendings' && same(abx[0].sf, PENDINGS), JSON.stringify(abx[0]));
ok('a block on words Salesforce has no type for carries neither',
   abx[1].type === '' && abx[1].sf === null, JSON.stringify(abx[1]));
ok('a block on a type the desk has no tasks under names the type and no figure',
   abx[2].type === 'Lic/Staffing/SA/HR' && abx[2].sf === null, JSON.stringify(abx[2]));
ok('and Gita\'s renewals block carries hers',
   same(desk('gita').bx[0].sf, RENEWALS) && desk('gita').bx[0].type === 'Renewa/PDl/Bill');
ok('the whole byType map is on the desk too',
   same(desk('anand').byType, { Pendings: PENDINGS }) && desk('devi').byType === null);

/* When the tracker's own blockTypeFor_ is present it decides, not the label. */
env.blockTypeFor_ = (lab) => ({ Reporting: 'RR Operations', Pendings: 'Pendings' })[lab] || '';
metrics = () => ({ ok: true, staff: { anand: { closed: 0, open: 0, overdue: 0, needs: 0,
  byType: { 'RR Operations': { open: 1, closed: 0, overdue: 0, needs: 0, touched: 1 } } } } });
let D2 = build();
const a2 = D2.desks.find(d => d.name === 'Anand Pretend').bx;
ok('blockTypeFor_ in the tracker maps a label the fallback could not',
   a2[1].type === 'RR Operations' && a2[1].sf && a2[1].sf.open === 1, JSON.stringify(a2[1]));
ok('and a label it returns nothing for is no type', a2[3].type === '' && a2[3].sf === null);
delete env.blockTypeFor_;
metrics = () => ({ ok: true, date: '2026-09-16',
  staff: { anand: { closed: 3, open: 5, overdue: 1, needs: 0, byType: { Pendings: PENDINGS } },
           gita:  { closed: 6, open: 9, overdue: 2, needs: 1, byType: { 'Renewa/PDl/Bill': RENEWALS } } },
  periods: PERIODS });
D = build();

/* ── 3. Blocks filed this week, this month, this year ───────────────────── */
console.log('\nBlocks filed over the week, the month and the year, in one read of the log:\n');
/* An independent count of the weekdays, so the feed is checked against the
   calendar and not against its own helper. */
const weekdays = (from, to) => { let n = 0;
  for (let d = new Date(from + 'T12:00:00Z'); d <= new Date(to + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay(); if (w >= 1 && w <= 5) n++; }
  return n; };
const WK = weekdays('2026-09-14', '2026-09-16'), MO = weekdays('2026-09-01', '2026-09-16'), YR = weekdays('2026-01-01', '2026-09-16');
ok('the calendar: 3 weekdays this week, 12 this month, 185 this year', WK === 3 && MO === 12 && YR === 185, [WK, MO, YR].join());
const ap = desk('anand').blocksPeriods;
ok('Anand this week: 1 today + 2 yesterday of 4 blocks x 3 days',
   same(ap.week, { filed: 3, of: 12 }), JSON.stringify(ap.week));
ok('this month adds last week\'s one', same(ap.month, { filed: 4, of: 48 }), JSON.stringify(ap.month));
ok('this year adds August\'s one and not December\'s', same(ap.ytd, { filed: 5, of: 740 }), JSON.stringify(ap.ytd));
ok('the older duplicate for the 15th did not count its four',
   ap.week.filed === 3, 'a duplicate row counted would read 7');
ok('a row dated ahead of today is not counted', ap.week.filed === 3 && ap.ytd.filed === 5);
const gp = desk('gita').blocksPeriods;
ok('Gita, two blocks scheduled, filed both today',
   same(gp, { week: { filed: 2, of: 6 }, month: { filed: 2, of: 24 }, ytd: { filed: 2, of: 370 } }), JSON.stringify(gp));
ok('a desk with nothing scheduled and nothing filed owes nothing',
   same(desk('devi').blocksPeriods, { week: { filed: 0, of: 0 }, month: { filed: 0, of: 0 }, ytd: { filed: 0, of: 0 } }));
const sum = (k) => D.desks.reduce((n, d) => n + d.blocksPeriods[k].filed, 0);
ok('summed across the desks the wall shows, the one who left is not in it',
   sum('week') === 5 && sum('ytd') === 7, [sum('week'), sum('ytd')].join());
ok('the log was read once for the whole build, not once per desk',
   (() => { let reads = 0; const raw = env.allEntries_; env.allEntries_ = () => { reads++; return raw(); };
            build(); env.allEntries_ = raw; return reads; })() === 1);

/* ── 4. The periods from Salesforce pass straight through ───────────────── */
console.log('\nThe tracker\'s own period counts pass through untouched:\n');
ok('branch.periods is the tracker\'s branch figure', same(D.branch.periods, PERIODS.branch), JSON.stringify(D.branch.periods));
ok('and each desk carries its own', same(desk('anand').periods, PERIODS.staff.anand) && desk('devi').periods === null);
metrics = () => ({ ok: true, staff: { anand: { closed: 1, open: 1, overdue: 0, needs: 0 } } });
const D3 = build();
ok('a tracker build without periods leaves them null, not undefined',
   D3.branch.periods === null && D3.desks.every(d => d.periods === null && d.byType === null),
   JSON.stringify(D3.branch.periods));
ok('and a block on a desk with no byType has no figure',
   D3.desks.find(d => d.name === 'Anand Pretend').bx[0].sf === null);
metrics = () => ({ ok: false, reason: 'notConfigured' });
const D4 = build();
ok('Salesforce down: the tiers and the blocks still come, the figures are blank',
   !D4.configured && D4.desks.length === 6 && D4.desks[0].tierOrder === 1 && D4.branch.periods === null &&
   D4.desks.find(d => d.name === 'Anand Pretend').blocksPeriods.week.filed === 3 &&
   D4.desks.find(d => d.name === 'Anand Pretend').closed === null);
metrics = () => ({ ok: true, date: '2026-09-16',
  staff: { anand: { closed: 3, open: 5, overdue: 1, needs: 0, byType: { Pendings: PENDINGS } },
           gita:  { closed: 6, open: 9, overdue: 2, needs: 1, byType: { 'Renewa/PDl/Bill': RENEWALS } } },
  periods: PERIODS });
D = build();

/* ── 5. Nothing the day page already reads has changed shape ────────────── */
console.log('\nWhat day.html has read since the screen was built is untouched:\n');
ok('desks[].blocks is still four strings out of done / due / blank',
   D.desks.every(d => Array.isArray(d.blocks) && d.blocks.length === 4 &&
                      d.blocks.every(s => s === 'done' || s === 'due' || s === '')),
   JSON.stringify(D.desks.map(d => d.blocks)));
ok('Anand: first block filed, three due', same(desk('anand').blocks, ['done', 'due', 'due', 'due']));
ok('Gita: both filed, two not scheduled', same(desk('gita').blocks, ['done', 'done', '', '']));
ok('a desk with no schedule is four blanks', same(desk('devi').blocks, ['', '', '', '']));
ok('data.blocks is still the four block totals',
   D.blocks.length === 4 && same(Object.keys(D.blocks[0]).sort(), ['done', 'id', 'label', 'of', 'time']) &&
   D.blocks[0].done === 2 && D.blocks[0].of === 2 && D.blocks[1].done === 1 && D.blocks[1].of === 2 &&
   D.blocks[2].of === 1 && D.blocks[3].of === 1, JSON.stringify(D.blocks));
ok('and the branch line: 3 of 6 filed, closed summed with the managers in',
   D.branch.done === 3 && D.branch.of === 6 && D.branch.closed === 9, JSON.stringify(D.branch));
ok('bx still carries id, state, kpi, moved, closed, stuck',
   ['id', 'state', 'kpi', 'focus', 'time', 'due', 'moved', 'closed', 'stuck', 'type', 'sf']
     .every(k => k in desk('anand').bx[0]), Object.keys(desk('anand').bx[0]).join());

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed'));
try { fs.unlinkSync(both); } catch (e) {}
process.exit(fails ? 1 : 0);
