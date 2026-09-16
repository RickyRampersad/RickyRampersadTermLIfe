// Lapses on a calendar — what the branch lost this year, month by month.
//
// The dues tab has always carried every lapse the branch ever had, and the
// nightly build has always read the issue date off it — and used neither for
// anything the wall could show. This screen answers the three questions a
// manager asks first: how many policies went this year, which month took the
// most of them, and how old they were when they went.
//
// The rules this file holds the builder to:
//
//   CALENDAR WINDOWS. This month, this quarter, the year from 1 January.
//   Never a rolling 365 days — that moves every morning.
//
//   TENURE FROM THE DATES, NOT FROM A COLUMN. Lapse date minus issue date,
//   in five bands, with a median per window and per agent. An issue date
//   after the lapse date is a typing error and is not "under a year".
//
//   EVERY EXCLUSION IS COUNTED. An agent left off the wall comes off every
//   window, and the screen says how many policies and how much premium that
//   took away. The book still lost them.
//
//   NOTHING CLIENT-LEVEL. The payload is walked key by key.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Intelligence.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
const NOW = new Date('2026-09-16T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* ── The dues tab, invented ────────────────────────────────────────────────
   Twenty-one lapsed rows spread over the year and over every tenure band,
   two from earlier years, one with no lapse date, one dated ahead of today,
   two held by the excluded agent — and a handful that are not lapsed at all,
   carrying lapse dates inside the year, which must count for nothing. */
const DUESH = ['Agent', 'Number', 'Client Number', 'Client', 'Premium', 'Issue Date', 'Status',
               'Status(2)', 'Days', 'Insurance Type', 'Paid To Date', 'Sum Assured', 'Plan Code',
               'Billing type', 'Mode', 'Status Description', 'Projected Lapse Date', 'Phone', 'email'];
let seq = 0;
const row = (agent, status, modal, issue, lapse, desc) =>
  [agent, 'LAP-' + (++seq), 'C' + seq, 'CLIENTNAME ' + seq, modal, issue, status, '', 0, '2',
   '2026-09-28', 250000, 'ECT65 1', 'Direct Bill', 'Monthly', desc || (status === '1' ? 'Lapsed' : 'Premium Paying'),
   lapse, '868-555-0100', 'client' + seq + '@example.com'];
const L = (agent, modal, issue, lapse) => row(agent, '1', modal, issue, lapse);

env.__mkSheet('Dues', 9, DUESH, [
  /* This month — September, before the 16th. */
  L('Anand Pretend',   100, '2026-03-01', '2026-09-02'),    // half a year
  L('Anand Pretend',   200, '2020-09-01', '2026-09-10'),    // six years
  L('Beena Sample',    150, '2025-06-01', '2026-09-14'),    // one year and a bit
  /* This quarter but not this month — July and August. Five in July, which
     is what makes July the tallest column on the strip. */
  L('Anand Pretend',   120, '2024-01-01', '2026-07-05'),    // two and a half
  L('Beena Sample',     80, '2016-01-01', '2026-07-12'),    // ten and a half
  L('Carl Fictitious', 300, '2026-01-15', '2026-07-20'),    // half a year
  L('Carl Fictitious',  90, '2023-07-01', '2026-07-28'),    // three
  L('Anand Pretend',    60, '',           '2026-07-30'),    // no issue date at all
  L('Beena Sample',    110, '2025-02-01', '2026-08-09'),    // one and a half
  /* The year before the quarter. */
  L('Anand Pretend',   130, '2022-05-01', '2026-01-20'),    // three and three quarters
  L('Carl Fictitious',  70, '2019-03-01', '2026-02-14'),    // seven
  L('Beena Sample',     95, '2026-01-02', '2026-03-30'),    // three months
  L('Anand Pretend',   210, '2021-04-01', '2026-04-11'),    // five, just
  L('Carl Fictitious',  55, '2010-06-01', '2026-05-19'),    // sixteen
  L('Beena Sample',    140, '2026-07-01', '2026-06-10'),    // issued AFTER it lapsed — a typo
  /* Earlier years: on the tab, not on this screen. */
  L('Anand Pretend',   100, '2015-01-01', '2025-11-30'),
  L('Carl Fictitious', 100, '2012-01-01', '2024-03-01'),
  /* Defects. */
  L('Beena Sample',    100, '2020-01-01', ''),              // no lapse date
  L('Carl Fictitious', 100, '2025-01-01', '2026-10-05'),    // projected ahead of today
  /* The excluded agent. */
  L('Gone Away',       500, '2026-02-01', '2026-08-03'),
  L('Gone Away',       400, '2020-01-01', '2026-09-05'),
  /* Not lapsed, whatever the lapse-date column says. */
  row('Anand Pretend', '0', 999, '2020-01-01', '2026-07-01'),
  row('Beena Sample',  '2', 999, '2020-01-01', '2026-07-02', 'Premium Paying'),
  row('Carl Fictitious', '3', 999, '2026-05-01', '2026-09-03', 'Pending'),
  row('Anand Pretend', '', 999, '2020-01-01', '2026-07-04', 'Surrendered')
]);

const d = env.iLapsesWall_();
console.log('\nWhat the wall is handed:\n');
ok('it is configured', d.configured === true, d.error || '');
ok('it knows the month and the quarter', d.month === 'September' && d.quarter === 'Q3' && d.year === 2026,
   d.month + ' ' + d.quarter + ' ' + d.year);

/* ── 1. Three calendar windows ───────────────────────────────────────────── */
console.log('\nThree windows, all calendar:\n');
const W = d.windows || {};
ok('this month: three policies', W.month.policies === 3, JSON.stringify(W.month));
ok('  on $450 a month, $5,400 a year', W.month.modal === 450 && W.month.annualised === 5400,
   W.month.modal + ' / ' + W.month.annualised);
ok('this quarter: nine policies', W.quarter.policies === 9, String(W.quarter.policies));
ok('  on $1,210 a month, $14,520 a year', W.quarter.modal === 1210 && W.quarter.annualised === 14520,
   W.quarter.modal + ' / ' + W.quarter.annualised);
ok('year to date: fifteen policies', W.year.policies === 15, String(W.year.policies));
ok('  on $1,910 a month, $22,920 a year', W.year.modal === 1910 && W.year.annualised === 22920,
   W.year.modal + ' / ' + W.year.annualised);
ok('the year starts on 1 January, not 365 days ago',
   W.year.policies === 15 && d.lapsed.earlier === 2,
   'a rolling year would have taken the November lapse: earlier=' + d.lapsed.earlier);
ok('every lapsed row on the tab is accounted for', d.lapsed.total === 21, String(d.lapsed.total));
ok('a row that is not lapsed counts for nothing, whatever its lapse date says',
   W.year.modal === 1910, 'a 999 would show here');

/* ── 2. The month strip ──────────────────────────────────────────────────── */
console.log('\nThe year, month by month:\n');
const BM = d.byMonth || [];
ok('January to September — nine months, not twelve', BM.length === 9 && BM[0].lab === 'Jan' && BM[8].lab === 'Sep',
   BM.map(m => m.lab).join(' '));
const jul = BM.find(m => m.lab === 'Jul') || {};
ok('July is the tallest column', jul.policies === 5 && BM.every(m => m.policies <= 5),
   BM.map(m => m.lab + ':' + m.policies).join(' '));
ok('  and carries its premium', jul.modal === 650, String(jul.modal));
ok('the excluded agent’s August is not in August', (BM.find(m => m.lab === 'Aug') || {}).policies === 1);
ok('September so far is three', (BM.find(m => m.lab === 'Sep') || {}).policies === 3);

/* ── 3. Tenure at lapse ──────────────────────────────────────────────────── */
console.log('\nHow long they lived:\n');
const band = (w, k) => ((w.bands || []).find(b => b.key === k) || {}).n;
ok('the five bands are there, in order',
   W.year.bands.map(b => b.key).join(',') === 'u1,y1,y2,y5,y10', W.year.bands.map(b => b.key).join(','));
ok('year to date: 3 under a year, 2 in the second, 3 to five, 3 to ten, 2 beyond',
   band(W.year, 'u1') === 3 && band(W.year, 'y1') === 2 && band(W.year, 'y2') === 3 &&
   band(W.year, 'y5') === 3 && band(W.year, 'y10') === 2,
   JSON.stringify(W.year.bands));
ok('the bands add up to the dated ones, and the undated are said',
   W.year.bands.reduce((a, b) => a + b.n, 0) === 13 && W.year.noIssue === 2,
   'bands ' + W.year.bands.reduce((a, b) => a + b.n, 0) + ', no issue ' + W.year.noIssue);
ok('this month: one in each of under a year, the second year, and five to ten',
   band(W.month, 'u1') === 1 && band(W.month, 'y1') === 1 && band(W.month, 'y5') === 1,
   JSON.stringify(W.month.bands));
ok('median years: 1.3 this month, 2.0 this quarter, 3.1 this year',
   W.month.medianYears === 1.3 && W.quarter.medianYears === 2.0 && W.year.medianYears === 3.1,
   [W.month.medianYears, W.quarter.medianYears, W.year.medianYears].join(' / '));
ok('under a year: 1, 2, 3', W.month.under1y === 1 && W.quarter.under1y === 2 && W.year.under1y === 3,
   [W.month.under1y, W.quarter.under1y, W.year.under1y].join(' / '));
ok('under two years includes under one: 2, 4, 5',
   W.month.under2y === 2 && W.quarter.under2y === 4 && W.year.under2y === 5,
   [W.month.under2y, W.quarter.under2y, W.year.under2y].join(' / '));
ok('issued after it lapsed is a defect, not a sale that did not hold',
   band(W.year, 'u1') === 3 && d.defects.noIssueDate === 2, 'noIssueDate ' + d.defects.noIssueDate);

/* ── 4. By agent ─────────────────────────────────────────────────────────── */
console.log('\nWho lost them:\n');
const A = d.agents || [];
const ag = n => A.find(a => a.agent === n) || {};
ok('three agents, most lost first', A.map(a => a.agent).join(' | ') ===
   'Anand Pretend | Beena Sample | Carl Fictitious', A.map(a => a.agent).join(' | '));
ok('Anand: 2 this month, 4 this quarter, 6 this year',
   ag('Anand Pretend').month === 2 && ag('Anand Pretend').quarter === 4 && ag('Anand Pretend').policies === 6,
   JSON.stringify(ag('Anand Pretend')));
ok('  median 3.7 years, one under a year', ag('Anand Pretend').medianYears === 3.7 && ag('Anand Pretend').under1y === 1,
   JSON.stringify(ag('Anand Pretend')));
ok('Beena: 1, 3, 5 — median 1.4, three under two',
   ag('Beena Sample').month === 1 && ag('Beena Sample').quarter === 3 && ag('Beena Sample').policies === 5 &&
   ag('Beena Sample').medianYears === 1.4 && ag('Beena Sample').under2y === 3,
   JSON.stringify(ag('Beena Sample')));
ok('Carl: 0, 2, 4 — median 5.0', ag('Carl Fictitious').month === 0 && ag('Carl Fictitious').quarter === 2 &&
   ag('Carl Fictitious').policies === 4 && ag('Carl Fictitious').medianYears === 5.0,
   JSON.stringify(ag('Carl Fictitious')));
ok('and the premium with them', ag('Anand Pretend').modal === 820 && ag('Beena Sample').modal === 575 &&
   ag('Carl Fictitious').modal === 515);
ok('each window carries its own agent list too',
   (W.month.byAgent || []).length === 2 && (W.quarter.byAgent || []).length === 3 &&
   (W.month.byAgent[0] || {}).agent === 'Anand Pretend',
   JSON.stringify(W.month.byAgent));
ok('the excluded agent is nowhere on it',
   !A.some(a => a.agent === 'Gone Away') && !Object.keys(W).some(k => W[k].byAgent.some(a => a.agent === 'Gone Away')));
ok('agentCount is the whole list, not the trimmed one', d.agentCount === 3, String(d.agentCount));

/* ── 5. Exclusions and defects, said out loud ────────────────────────────── */
console.log('\nWhat was taken off, and what could not be placed:\n');
ok('two lapses on $900 a month came off with the excluded agent',
   d.excluded.policies === 2 && d.excluded.modal === 900 && d.excluded.annualised === 10800 && d.excluded.agents === 1,
   JSON.stringify(d.excluded));
ok('and the screen is told, in money', (d.notes || []).some(x => /2 lapses this year, TT\$10,800\.00 a year/.test(x)),
   JSON.stringify(d.notes));
ok('one lapsed policy has no lapse date', d.defects.noLapseDate === 1, String(d.defects.noLapseDate));
ok('one is dated ahead of today and is not counted as gone', d.defects.futureLapseDate === 1,
   String(d.defects.futureLapseDate));
ok('two carry no usable issue date', d.defects.noIssueDate === 2, String(d.defects.noIssueDate));
ok('both defects are named in the notes',
   (d.notes || []).some(x => /no lapse date/.test(x)) && (d.notes || []).some(x => /no usable issue date/.test(x)),
   JSON.stringify(d.notes));

/* ── 6. Nothing client-level reaches the wall ────────────────────────────── */
console.log('\nAnd nothing client-level is in the answer:\n');
const badKeys = [];
(function walk(o, p) {
  if (!o || typeof o !== 'object') return;
  Object.keys(o).forEach(k => {
    if (/client|phone|email|number|paidTo|^policy$|^plan$|^name$|^desc$/i.test(k)) badKeys.push(p + '.' + k);
    walk(o[k], p + '.' + k);
  });
})(d, 'd');
ok('no key on the payload names a client, a policy or a way to reach them', badKeys.length === 0,
   JSON.stringify(badKeys.slice(0, 5)));
const blob = JSON.stringify(d);
ok('no policy number in the payload', !/LAP-\d/.test(blob));
ok('no client name in the payload', !/CLIENTNAME/.test(blob));
ok('no phone or e-mail in the payload', !/868-555|@example/.test(blob));
ok('the only names are our own agents', /Anand Pretend/.test(blob) && /Carl Fictitious/.test(blob));

/* ── 7. The wall action needs no sign-in ─────────────────────────────────── */
console.log('\nThe wall action needs no sign-in:\n');
const out = env.intelRoute_({ action: 'intel.lapses' });
let r = null;
try { r = JSON.parse(out.getContent()); } catch (e) { r = null; }
ok('intel.lapses answers without a token', !!(r && r.ok && r.data && r.data.configured),
   JSON.stringify(r).slice(0, 120));
ok('and the answer is the same aggregates', r && r.data.windows.year.policies === 15);
/* Held for a quarter of an hour: a second ask comes back from the cache. */
const again = JSON.parse(env.intelRoute_({ action: 'intel.lapses' }).getContent());
ok('the second read is the cached one', again.data.generatedAt === r.data.generatedAt);

/* ── 8. With no dues tab at all ──────────────────────────────────────────── */
console.log('\nWith no dues tab at all:\n');
const env2 = makeEnv({});
const d2 = env2.iLapsesWall_();
ok('it says so rather than throwing', d2.configured === false && /No dues tab/.test(d2.error || ''), d2.error);

/* ── 9. On the first of a quarter, the month and the quarter agree ───────── */
console.log('\nOn the first day of a quarter:\n');
const env3 = makeEnv({});
const NOW3 = new Date('2026-10-01T09:00:00');
const RD3 = env3.Date;
env3.Date = new Proxy(RD3, { construct(t, a) { return a.length ? new RD3(...a) : new RD3(NOW3.getTime()); },
                             get(t, k) { return k === 'now' ? () => NOW3.getTime() : t[k]; } });
seq = 0;
env3.__mkSheet('Dues', 9, DUESH, [
  L('Anand Pretend', 100, '2025-01-01', '2026-10-01'),
  L('Beena Sample',  100, '2025-01-01', '2026-09-30')
]);
const d3 = env3.iLapsesWall_();
ok('1 October is Q4, and the quarter holds only the first',
   d3.quarter === 'Q4' && d3.windows.quarter.policies === 1 && d3.windows.month.policies === 1 &&
   d3.windows.year.policies === 2,
   JSON.stringify([d3.quarter, d3.windows.quarter.policies, d3.windows.month.policies, d3.windows.year.policies]));
ok('and the strip runs January to October', d3.byMonth.length === 10, String(d3.byMonth.length));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nAll good.\n');
process.exit(fails ? 1 : 0);
