// The day's numbers, measured in the branch's own clock.
//
// Four things that were each wrong on 16 September 2026, kept wrong-proof:
//
//   WHO IS ON THE WALL. A departed member of staff stayed up because her
//   Active cell said a word the old regex did not list. Now the cell has to
//   say yes (or nothing at all) to keep a person on; any other word is off.
//
//   CLOSED TODAY. Was "completed tasks somebody edited today", in a UTC day
//   that ran from 8pm to 8pm local. Now it is CompletedDateTime inside the
//   local day — 04:00Z to 04:00Z, because Port of Spain is UTC-4 with no
//   daylight saving — with the birthday automation left out.
//
//   TOUCHED TODAY. The per-person position never had it, so a morning spent
//   moving forty pendings along read as "closed 0".
//
//   BLOCK → TYPE. Six schedule labels are Task_Type__c values letter for
//   letter and the rest are not; the map has to say so for every label, and
//   checkSchedule() refuses a block that has not decided.
//
// And the period totals — week, month, year — come back as one query per
// window for the whole branch, not one per person.
const path = require('path');
process.env.GS_PATH = path.join(__dirname, '..', 'apps-script/KPI.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const ACCESS = ['Name', 'Email', 'Password', 'Role', 'Unit', 'Active'];
const PROPS = { SF_KEY: 'k', SF_SECRET: 's', SF_USER: 'u', SF_PASS: 'p' };

/* ── 1. Who is on the wall ───────────────────────────────────────────────── */
console.log('\nThe Active cell, read the way a person fills it in:\n');
const CELLS = [
  ['',          true,  'blank — the column was never filled in for most rows'],
  ['   ',       true,  'whitespace is blank'],
  ['yes',       true,  ''],
  ['Yes',       true,  ''],
  ['Y',         true,  ''],
  ['Active',    true,  ''],
  ['ACTIVE',    true,  ''],
  ['true',      true,  ''],
  [true,        true,  'a checkbox cell'],
  ['1',         true,  ''],
  [1,           true,  'a numeric 1'],
  ['Left',      false, 'the word that kept somebody on the wall'],
  ['Resigned',  false, ''],
  ['N',         false, ''],
  ['x',         false, ''],
  ['no',        false, ''],
  ['Inactive',  false, ''],
  ['false',     false, ''],
  ['0',         false, ''],
  [0,           false, 'a numeric 0'],
  ['Maternity', false, 'a word nobody anticipated is off, not on'],
];
{
  const env = makeEnv();
  env.__mkSheet('Access', 1, ACCESS, CELLS.map(([v], i) =>
    ['Person ' + i, 'p' + i + '@example.com', '1', 'Sales Support Assistant', 'Support', v]));
  const roster = env.roster_();
  ok('every row is read', roster.length === CELLS.length, String(roster.length));
  CELLS.forEach(([v, want, why], i) => {
    const p = roster[i];
    ok(JSON.stringify(v) + ' → ' + (want ? 'active' : 'inactive'), p && p.active === want,
       why || (p ? 'got ' + p.active : 'no row'));
  });
  ok('the raw cell rides along, trimmed',
     roster[11].activeRaw === 'Left' && roster[1].activeRaw === '', JSON.stringify(roster[1].activeRaw));
  ok('publicRoster_ drops the departed',
     !env.publicRoster_().some(p => p.name === 'Person 11'));
}
{
  // No Active column at all — everybody is on, as before.
  const env = makeEnv();
  env.__mkSheet('Access', 1, ['Name', 'Email', 'Password', 'Role'],
    [['Anand Pretend', 'anand@example.com', '1', 'Sales Support Assistant']]);
  ok('no Active column means everybody is active', env.roster_()[0].active === true &&
     env.roster_()[0].activeRaw === '');
}

/* ── 2–3. Closed and touched today, in the branch's clock ────────────────── */
console.log('\nClosed today and touched today, from Salesforce:\n');
const env = makeEnv({ props: PROPS });
env.__mkSheet('Access', 1, ACCESS, [
  ['Anand Pretend',   'anand@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
  ['Beena Sample',    'beena@example.com', '1', 'Sales Support Assistant', 'Support', ''],
  ['Carl Fictitious', 'carl@example.com',  '1', 'Sales Support Assistant', 'Support', 'Left'],
]);
const USERS = { anand: { id: '005A', name: 'Anand Pretend', active: true, all: 1 },
                beena: { id: '005B', name: 'Beena Sample',  active: true, all: 1 } };
env.sfkUsers_ = () => USERS;

const asked = [];
env.sfkQuery_ = soql => {
  asked.push(soql);
  /* After four: what each desk closed and touched from 16:00 local (20:00Z). */
  if (/T20:00:00Z/.test(soql)) {
    if (/CompletedDateTime/.test(soql)) return [{ OwnerId: '005A', expr0: 2 }];
    if (/LastModifiedDate/.test(soql))  return [{ OwnerId: '005A', expr0: 4 }, { OwnerId: '005B', expr0: 1 }];
    return [];
  }
  if (/CompletedDateTime/.test(soql) && /Task_Type__c/.test(soql)) {
    return [{ OwnerId: '005A', Task_Type__c: 'Pendings', expr0: 3 },
            { OwnerId: '005B', Task_Type__c: null, expr0: 1 },
            { OwnerId: '005Z', Task_Type__c: 'Pendings', expr0: 99 }];   // not ours
  }
  if (/LastModifiedDate >= \d{4}-\d\d-\d\dT04:00:00Z/.test(soql)) {
    return [{ OwnerId: '005A', Task_Type__c: 'Pendings', expr0: 7 },
            { OwnerId: '005A', Task_Type__c: null, expr0: 2 }];
  }
  if (/CompletedDateTime/.test(soql) && /GROUP BY OwnerId$/.test(soql)) {
    const n = /2026-09-14T04/.test(soql) ? 5 : /2026-09-01T04/.test(soql) ? 20 : 300;
    return [{ OwnerId: '005A', expr0: n }, { OwnerId: '005B', expr0: n * 2 }];
  }
  return [];
};

const DAY = '2026-09-16';
const m = env.sfkMetricsSafe_(DAY);
ok('the position comes back', m && m.ok === true, JSON.stringify(m).slice(0, 120));

const closedQ = asked.find(q => /GROUP BY OwnerId, Task_Type__c/.test(q) && /CompletedDateTime/.test(q));
ok('closed today is asked once, per type', !!closedQ && asked.filter(q => q === closedQ).length === 1);
ok('  …by the time the task was completed, not last edited',
   /CompletedDateTime >= 2026-09-16T04:00:00Z AND CompletedDateTime < 2026-09-17T04:00:00Z/.test(closedQ || ''),
   closedQ);
ok('  …in the local day (04:00Z is midnight in Port of Spain)',
   /T04:00:00Z/.test(closedQ || '') && !/T00:00:00Z/.test(closedQ || ''));
ok('  …without the birthday automation',
   /\(NOT Subject LIKE '%Happy Birthday%'\)/.test(closedQ || ''));
ok('  …and no longer by Status and LastModifiedDate',
   !/LastModifiedDate/.test(closedQ || '') && !/Status = 'Completed'/.test(closedQ || ''));
ok('  …on the same user set', /OwnerId IN \('005A','005B'\)/.test(closedQ || ''));
ok('closed lands on the person', m.staff.anand.closed === 3 && m.staff.anand.byType.Pendings.closed === 3);
ok('an untyped closure is spelled Untyped', m.staff.beena.byType.Untyped && m.staff.beena.byType.Untyped.closed === 1);
ok('a user who is not ours is ignored', !Object.keys(m.staff).some(k => m.staff[k].closed === 99));

const touchedQ = asked.find(q => /LastModifiedDate >= 2026-09-16T04:00:00Z/.test(q));
ok('touched today is asked, per type', !!touchedQ && /GROUP BY OwnerId, Task_Type__c/.test(touchedQ || ''), touchedQ);
ok('  …over the same local day',
   /LastModifiedDate >= 2026-09-16T04:00:00Z AND LastModifiedDate < 2026-09-17T04:00:00Z/.test(touchedQ || ''));
ok('  …closed or not — no Status clause', !/Status/.test(touchedQ || ''));
ok('touched lands on the person and the type',
   m.staff.anand.touched === 9 && m.staff.anand.byType.Pendings.touched === 7 &&
   m.staff.anand.byType.Untyped.touched === 2, JSON.stringify(m.staff.anand.byType));
ok('a person with nothing touched reads 0, not undefined',
   m.staff.beena.touched === 0 && m.staff.beena.byType.Untyped.touched === 0);
ok('the branch roll-up carries touched too',
   m.branch.byType.Pendings.touched === 7 && m.branch.byType.Pendings.closed === 3);

/* The other windows are untouched. */
const openQ = asked.find(q => /Status != 'Completed' GROUP BY OwnerId, Task_Type__c/.test(q));
ok('open is still open, whatever the date', !!openQ);
ok('overdue still keys on ActivityDate', asked.some(q => /Status != 'Completed' AND ActivityDate < 2026-09-16 /.test(q)));
ok('needs still keys on a week untouched', asked.some(q => /LastModifiedDate < LAST_N_DAYS:7/.test(q)));

/* ── 4½. After four — the block that is measured, not filed ─────────────── */
console.log('\nAfter four, what each desk did:\n');
const eveClosedQ = asked.find(q => /CompletedDateTime >= 2026-09-16T20:00:00Z/.test(q));
const eveTouchedQ = asked.find(q => /LastModifiedDate >= 2026-09-16T20:00:00Z/.test(q));
ok('closed after four is asked from 16:00 local to the end of the day', !!eveClosedQ && /CompletedDateTime < 2026-09-17T04:00:00Z/.test(eveClosedQ) && /GROUP BY OwnerId$/.test(eveClosedQ), eveClosedQ);
ok('  …without the birthday automation', /NOT Subject LIKE '%Happy Birthday%'/.test(eveClosedQ || ''));
ok('touched after four the same way', !!eveTouchedQ && /LastModifiedDate < 2026-09-17T04:00:00Z/.test(eveTouchedQ));
ok('and each desk carries both', m.staff.anand.eveClosed === 2 && m.staff.anand.eveTouched === 4 && m.staff.beena.eveClosed === 0 && m.staff.beena.eveTouched === 1,
   JSON.stringify([m.staff.anand.eveClosed, m.staff.anand.eveTouched, m.staff.beena.eveClosed, m.staff.beena.eveTouched]));

/* ── 5. Closed per period — one query per window, not one per person ─────── */
console.log('\nThe week, the month and the year so far:\n');
const periodQs = asked.filter(q => /CompletedDateTime/.test(q) && /GROUP BY OwnerId$/.test(q) && !/T20:00:00Z/.test(q));
ok('three window queries for the whole branch', periodQs.length === 3, String(periodQs.length));
ok('  …week from Monday 04:00Z', periodQs.some(q => /CompletedDateTime >= 2026-09-14T04:00:00Z/.test(q)));
ok('  …month from the 1st', periodQs.some(q => /CompletedDateTime >= 2026-09-01T04:00:00Z/.test(q)));
ok('  …year from 1 January', periodQs.some(q => /CompletedDateTime >= 2026-01-01T04:00:00Z/.test(q)));
ok('  …each up to the end of the day', periodQs.every(q => /CompletedDateTime < 2026-09-17T04:00:00Z/.test(q)));
ok('  …without the birthday automation', periodQs.every(q => /NOT Subject LIKE '%Happy Birthday%'/.test(q)));
ok('  …on the same user set', periodQs.every(q => /OwnerId IN \('005A','005B'\)/.test(q)));
ok('  …grouped by owner, not one query per person', periodQs.every(q => !/OwnerId = '/.test(q)));
ok('m.periods carries every person', m.periods && m.periods.staff.anand && m.periods.staff.beena);
ok('  anand: 5 / 20 / 300',
   m.periods.staff.anand.week === 5 && m.periods.staff.anand.month === 20 && m.periods.staff.anand.ytd === 300,
   JSON.stringify(m.periods.staff.anand));
ok('  beena: 10 / 40 / 600',
   m.periods.staff.beena.week === 10 && m.periods.staff.beena.month === 40 && m.periods.staff.beena.ytd === 600);
ok('  branch is the sum',
   m.periods.branch.week === 15 && m.periods.branch.month === 60 && m.periods.branch.ytd === 900,
   JSON.stringify(m.periods.branch));

/* Cached like the rest: a second read is no new round trip. */
const before = asked.length;
const m2 = env.sfkMetricsSafe_(DAY);
ok('a second read within twelve minutes asks Salesforce nothing', asked.length === before);
ok('  …and still carries the periods', m2.periods && m2.periods.branch.ytd === 900);

/* A person sees their own periods and the branch's, not the next desk's. */
const mineOnly = env.metricsFor_({ staffId: 'anand', manager: false }, DAY);
ok('a non-manager gets their own week and the branch total',
   mineOnly.periods && mineOnly.periods.staff.anand && !mineOnly.periods.staff.beena &&
   mineOnly.periods.branch.week === 15);

/* If the windows fail, the morning's numbers still come back. */
{
  const env2 = makeEnv({ props: PROPS });
  env2.__mkSheet('Access', 1, ACCESS, [['Anand Pretend', 'anand@example.com', '1', 'SSA', 'Support', '']]);
  env2.sfkUsers_ = () => USERS;
  env2.sfkQuery_ = soql => { if (/GROUP BY OwnerId$/.test(soql) && /CompletedDateTime/.test(soql)) throw new Error('boom'); return []; };
  const m3 = env2.sfkMetricsSafe_(DAY);
  ok('a failed window query does not take the position down', m3.ok === true && m3.periods === null);
}

/* ── 4. Block → task type ───────────────────────────────────────────────── */
console.log('\nWhich Task_Type__c a block\'s work lands in:\n');
['Renewa/PDl/Bill', 'Pendings', 'Scripts/CB', 'Lic/Staffing/SA/HR', 'Opportunity', 'Training']
  .forEach(t => ok(t + ' → itself', env.blockTypeFor_(t) === t, env.blockTypeFor_(t)));
['Surveys / Query Pal', 'Reporting', 'Escalations', 'Joint Field Work', '', 'Never Heard Of It']
  .forEach(t => ok(JSON.stringify(t) + ' → no type', env.blockTypeFor_(t) === '', env.blockTypeFor_(t)));

/* Every label in the shipped SCHEDULE has decided. */
const labels = {};
Object.keys(env.SCHEDULE).forEach(sid => env.BLOCK_IDS.forEach(b => {
  const k = (env.SCHEDULE[sid].blocks[b] || {}).kpi; if (k) labels[k] = 1;
}));
const undecided = Object.keys(labels).filter(k => !Object.prototype.hasOwnProperty.call(env.BLOCK_TYPE, k));
ok('every label in SCHEDULE has a BLOCK_TYPE entry', undecided.length === 0, undecided.join(', '));
ok('the six identities are the only non-empty entries',
   Object.keys(env.BLOCK_TYPE).filter(k => env.BLOCK_TYPE[k]).length === 6);

/* checkSchedule() reads each person's role off the Access tab, so the shipped
   SCHEDULE is checked against a roster that holds everyone it schedules, in
   the roles the tab gives them. Surnames invented; the first names are the
   ids SCHEDULE is keyed by. */
const envS = makeEnv();
envS.__mkSheet('Access', 1, ACCESS, [
  ['Sasha Pretend',     'sasha@example.com',     '1', 'Sales Support Assistant',    'Support', ''],
  ['Azariah Sample',    'azariah@example.com',   '1', 'Sales Support Assistant',    'Support', ''],
  ['Ashley Fictitious', 'ashley@example.com',    '1', 'Sales Support Assistant',    'Support', ''],
  ['Elizabeth Pretend', 'elizabeth@example.com', '1', 'Sales Support Assistant',    'Support', ''],
  ['Kamla Sample',      'kamla@example.com',     '1', "Branch Manager's Assistant", 'Branch',  ''],
  ['Pawan Fictitious',  'pawan@example.com',     '1', 'Personal Assistant',         'Branch',  ''],
  ['Ricky Rampersad',   'ricky@example.com',     '1', 'Branch Manager',             'Branch',  ''],
  ['Kerwyn Pretend',    'kerwyn@example.com',    '1', 'Assistant Branch Manager',   'Branch',  ''],
  ['Akaash Sample',     'akaash@example.com',    '1', 'Unit Manager',               'Unit A',  ''],
  ['Gary Fictitious',   'gary@example.com',      '1', 'Unit Manager',               'Unit B',  ''],
]);
const verdict = envS.checkSchedule();
ok('checkSchedule() passes on the shipped SCHEDULE', /consistent/.test(verdict) && !/BLOCK_TYPE/.test(verdict), verdict);

/* And a block that has not decided is refused. */
{
  const saved = envS.SCHEDULE.sasha.blocks.KPI1.kpi;
  envS.SCHEDULE.sasha.blocks.KPI1.kpi = 'Renewa/PDl/Bill';           // on the list, in BLOCK_TYPE
  delete envS.BLOCK_TYPE['Renewa/PDl/Bill'];
  const v2 = envS.checkSchedule();
  ok('a label with no BLOCK_TYPE entry is named', /no BLOCK_TYPE entry/.test(v2) && /sasha KPI1/.test(v2), v2.split('\n')[1]);
  envS.BLOCK_TYPE['Renewa/PDl/Bill'] = 'Renewa/PDl/Bill';
  envS.SCHEDULE.sasha.blocks.KPI1.kpi = saved;
  ok('…and is consistent again once it has decided', /consistent/.test(envS.checkSchedule()));
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
