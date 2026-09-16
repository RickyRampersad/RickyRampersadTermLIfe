// The licence wall's outstanding list — whose, how old, and touched when.
//
// Two things went wrong with this list before 16 September 2026, and this
// file holds both of them down.
//
//   THE DAY WAS UTC'S, NOT OURS. CreatedDate and LastModifiedDate come out of
//   Salesforce as UTC timestamps and the day was taken by slicing the first
//   ten characters. Port of Spain is four hours behind, so anything touched
//   after eight in the evening was "moved" tomorrow — and a touched-today dot
//   that lights the day AFTER somebody touched it is worse than no dot.
//
//   THE SUBJECT LINE WAS ON THE WALL. The audit of 15 September flagged every
//   open task's subject, as the branch typed it, on a screen with no sign-in.
//   The setup notes say a wall read carries no subject; the code did not. A
//   row now carries the agent, the licence kind and a one-word category, and
//   this file asserts that no subject text survives serialisation.
//
// Every name here is invented. The task type and the SOQL shape are not.
process.env.TZ = 'America/Port_of_Spain';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Intelligence.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Dev Departed' } });
/* Wednesday 16 September 2026, ten in the morning, branch time. */
const NOW = new Date('2026-09-16T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* ── 1. The day a timestamp falls on, in Port of Spain ─────────────────────
   UTC−4 all year: the boundary is 04:00Z. */
console.log('\nA Salesforce timestamp lands on the branch\'s own day:\n');
const day = ts => { const d = env.iLicLocalDay_(ts); return d ? env.iIso_(d) : null; };
ok('half past eight in the evening is still today, not tomorrow',
   day('2026-09-16T00:30:00.000+0000') === '2026-09-15', day('2026-09-16T00:30:00.000+0000'));
ok('one second before the boundary is still the 15th',
   day('2026-09-16T03:59:59.000+0000') === '2026-09-15', day('2026-09-16T03:59:59.000+0000'));
ok('and the boundary itself is the 16th',
   day('2026-09-16T04:00:00.000+0000') === '2026-09-16', day('2026-09-16T04:00:00.000+0000'));
ok('a colon in the offset works too', day('2026-09-16T00:30:00.000+00:00') === '2026-09-15');
ok('the UTC slice would have said the 16th — which is the bug',
   '2026-09-16T00:30:00.000+0000'.slice(0, 10) === '2026-09-16');
ok('nothing in, nothing out', day('') === null && day(null) === null);

/* ── 2. The category that replaces the subject ─────────────────────────── */
console.log('\nOne word for what the task is, never the line the branch typed:\n');
[['Salesman License Renewal - Anand Pretend (25/Sep/2026)', 'Renewal'],
 ['CPD Licence Platform Renewal (General and Life) Anand Pretend', 'CPD'],
 ['GUARDIAN GENERAL LICENSE APPLICATION Carl Fictitious (provisional)', 'Application'],
 ['Provisional License - New Recruit', 'Application'],
 ['Change from Provisional to Full Registration Licence', 'Registration'],
 ['Licence query', 'Licence']
].forEach(([subj, cat]) => ok(cat + '  ← "' + subj.slice(0, 40) + '…"', env.iLicCategory_(subj) === cat, env.iLicCategory_(subj)));

/* ── 3. The fixture: three agents, one excluded, eight tasks ───────────── */
const ACCESS = ['Name', 'Email', 'Access Code', 'Role', 'Unit', 'Agent Name (exactly as in data)', 'Agent Number', 'Active'];
env.__mkSheet('Access', 1, ACCESS, [
  ['Anand Pretend',   'a@example.com', 'x', 'Agent', 'Unit One', 'Anand Pretend',   'A00101', 'Yes'],
  ['Beena Sample',    'b@example.com', 'x', 'Agent', 'Unit One', 'Beena Sample',    'A00102', 'Yes'],
  ['Carl Fictitious', 'c@example.com', 'x', 'Agent', 'Unit Two', 'Carl Fictitious', 'A00103', 'Yes'],
  ['Dev Departed',    'd@example.com', 'x', 'Agent', 'Unit Two', 'Dev Departed',    'A00104', 'Yes'],
  ['Kim Support',     'k@example.com', 'x', 'Staff', 'Support',  'Kim Support',     'KD001',  'Yes']
]);

const asked = [];
const T = (subj, opts) => Object.assign({ Id: 'T' + (asked.length + Math.random()), Subject: subj,
  Status: 'In Progress', IsClosed: false, ActivityDate: null, Task_Type__c: 'Lic/Staffing/SA/HR',
  Who: { Name: 'Head Office Desk' } }, opts);
const TASKS = [
  /* Anand, open: last touched 20:30 on the 15th, branch time — 00:30Z on the
     16th. Due on the 10th, so six days past it. */
  T('Salesman License Renewal - Anand Pretend (25/Sep/2026)',
    { CreatedDate: '2026-08-20T14:00:00.000+0000', LastModifiedDate: '2026-09-16T00:30:00.000+0000',
      ActivityDate: '2026-09-10' }),
  /* Anand, open: touched at five past nine this morning. Due in a fortnight. */
  T('CPD Licence Platform Renewal (General and Life) Anand Pretend',
    { CreatedDate: '2026-09-01T12:00:00.000+0000', LastModifiedDate: '2026-09-16T13:05:00.000+0000',
      ActivityDate: '2026-09-30' }),
  /* Beena, open: not touched since 10 August, 19:59 branch time — and it
     was never given a due date at all. */
  T('Sales License Renewal Beena Sample (4/Sept/2026)',
    { CreatedDate: '2026-07-20T15:00:00.000+0000', LastModifiedDate: '2026-08-10T23:59:00.000+0000' }),
  /* Beena, closed last year: history, not the list. */
  T('Salesman License Renewal Beena Sample (4/Sept/2025)',
    { CreatedDate: '2025-07-15T15:00:00.000+0000', LastModifiedDate: '2025-08-30T15:00:00.000+0000',
      Status: 'Completed', IsClosed: true, ActivityDate: '2025-09-01' }),
  /* Carl, open, general: opened 23:00 on the 7th branch time, which is
     03:00Z on the 8th. Nine days old, not eight. */
  T('GUARDIAN GENERAL LICENSE APPLICATION Carl Fictitious (provisional)',
    { CreatedDate: '2026-09-08T03:00:00.000+0000', LastModifiedDate: '2026-09-08T03:00:00.000+0000',
      ActivityDate: '2026-09-20' }),
  /* Carl, closed in March. */
  T('Salesman License Renewal Carl Fictitious (15/Mar/2026)',
    { CreatedDate: '2026-01-20T15:00:00.000+0000', LastModifiedDate: '2026-03-20T01:00:00.000+0000',
      Status: 'Completed', IsClosed: true }),
  /* Nobody's — no agent named. Touched at ten last night. */
  T('Provisional License - New Recruit',
    { CreatedDate: '2026-09-14T15:00:00.000+0000', LastModifiedDate: '2026-09-16T02:00:00.000+0000' }),
  /* Same task type, not a licence: stays off the list entirely. */
  T('Staff Requisition - receipt books',
    { CreatedDate: '2026-09-10T15:00:00.000+0000', LastModifiedDate: '2026-09-10T15:00:00.000+0000' })
];
const CONTACTS = [
  { Name: 'Anand Pretend',   Agent__c: 'A00101', Agent_Type__c: 'Full_Time',
    License_Renewal_Month_Life__c: 9, License_Life_Renewal_Day__c: 25, License_Date_Life__c: '2015-09-25' },
  { Name: 'Beena Sample',    Agent__c: 'A00102', Agent_Type__c: 'Full_Time',
    License_Renewal_Month_Life__c: 9, License_Life_Renewal_Day__c: 4, License_Date_Life__c: '2019-09-04',
    License_General_Month_General__c: 11, License_General_Renewal_Day__c: 10, License_Date_General__c: '2022-11-10' },
  { Name: 'Carl Fictitious', Agent__c: 'A00103', Agent_Type__c: 'Part_Time',
    License_Renewal_Month_Life__c: 3, License_Life_Renewal_Day__c: 15, License_Date_Life__c: '2024-03-15' },
  /* The excluded agent's record comes back from Salesforce like anyone's;
     the roster is what keeps it off. */
  { Name: 'Dev Departed',    Agent__c: 'A00104', Agent_Type__c: 'Full_Time',
    License_Renewal_Month_Life__c: 9, License_Life_Renewal_Day__c: 20, License_Date_Life__c: '2010-09-20' }
];
env.iSfQuery_ = soql => { asked.push(soql); return /FROM Task/.test(soql) ? TASKS : CONTACTS; };

const d = env.iBuildLicence_();
const out = d.outstanding || [];
const row = subjStart => {
  /* The rows no longer carry the subject, so find them by what they do carry. */
  const want = { anandRenewal: o => o.code === 'A00101' && o.category === 'Renewal',
                 anandCpd:     o => o.code === 'A00101' && o.category === 'CPD',
                 beena:        o => o.code === 'A00102',
                 carl:         o => o.code === 'A00103',
                 nobody:       o => !o.code }[subjStart];
  return out.find(want) || {};
};

/* ── 4. What was asked of Salesforce ────────────────────────────────────── */
console.log('\nWhat it asked Salesforce for:\n');
const taskQ = asked.find(q => /FROM Task/.test(q)) || '';
ok('the task read carries Task_Type__c and the two timestamps',
   /Task_Type__c/.test(taskQ) && /CreatedDate, LastModifiedDate/.test(taskQ), taskQ);
ok('and no field is aliased — this is a row-level read',
   !/\b\w+__c\s+\w+\s*,/.test(taskQ.replace(/FROM.*$/, '')) && !/\bAS\b/i.test(taskQ), taskQ);
ok('it built', d.configured === true && !d.error, d.error);

/* ── 5. The outstanding list, without a subject in it ───────────────────── */
console.log('\nThe outstanding list:\n');
ok('five open licence tasks — the requisition is not one',
   out.length === 5 && d.gaps.allTasks === 8 && d.gaps.licenceTasks === 7,
   out.length + ' / ' + d.gaps.allTasks + ' / ' + d.gaps.licenceTasks);
ok('NO ROW CARRIES A SUBJECT', out.every(o => !('subject' in o)), JSON.stringify(Object.keys(out[0] || {})));
ok('and no licence row carries its open subjects either',
   (d.agents || []).every(a => !('openSubjects' in a)));
const blob = JSON.stringify(d);
ok('no subject text survives serialisation',
   !/Salesman License|GUARDIAN GENERAL|receipt books|New Recruit|CPD Platform/.test(blob),
   (blob.match(/Salesman License|GUARDIAN GENERAL|receipt books|New Recruit|CPD Platform/) || [])[0]);
ok('every row carries the agent code, the task type and a category',
   out.every(o => 'code' in o && o.type === 'Lic/Staffing/SA/HR' && /^(Renewal|CPD|Application|Registration|Licence)$/.test(o.category)),
   JSON.stringify(out.map(o => [o.code, o.type, o.category])));

const a1 = row('anandRenewal'), a2 = row('anandCpd'), b = row('beena'), c = row('carl'), n = row('nobody');
ok('Anand\'s renewal is matched to A00101 by both names in the subject', a1.agent === 'Anand Pretend' && a1.unit === 'Unit One');
ok('touched at 20:30 last night → moved on the 15th, NOT the 16th', a1.moved === '2026-09-15', a1.moved);
ok('  so it was not touched today', a1.touchedToday === false);
ok('  and it is one day since anybody touched it', a1.daysSinceTouch === 1, String(a1.daysSinceTouch));
ok('  due on the 10th → six days past due', a1.due === '2026-09-10' && a1.daysSinceDue === 6, a1.due + ' ' + a1.daysSinceDue);
ok('  opened 20 August → 27 days old', a1.days === 27, String(a1.days));

ok('Anand\'s CPD task was touched this morning', a2.touchedToday === true && a2.daysSinceTouch === 0 && a2.moved === '2026-09-16',
   JSON.stringify([a2.touchedToday, a2.daysSinceTouch, a2.moved]));
ok('  due in a fortnight reads as minus fourteen', a2.daysSinceDue === -14, String(a2.daysSinceDue));
ok('  "General and Life" stays on the life side', a2.kind === 'Life', a2.kind);

ok('Beena\'s open task last moved 10 August, 19:59 branch time', b.moved === '2026-08-10', b.moved);
ok('  thirty-seven days untouched', b.daysSinceTouch === 37, String(b.daysSinceTouch));
ok('  and it never had a due date', b.due === '' && b.daysSinceDue === null, b.due + ' ' + b.daysSinceDue);

ok('Carl\'s application opened at 23:00 on the 7th, branch time — nine days, not eight',
   c.opened === '2026-09-07' && c.days === 9, c.opened + ' ' + c.days);
ok('  it is a general licence matter', c.kind === 'General' && c.category === 'Application', c.kind + ' ' + c.category);
ok('  due on the 20th → minus four', c.daysSinceDue === -4, String(c.daysSinceDue));
ok('  and Carl has no general licence date on record — said out loud',
   (d.gaps.generalNoDate || []).indexOf('Carl Fictitious') >= 0, JSON.stringify(d.gaps.generalNoDate));

ok('the recruit\'s task names no agent: blank code, blank agent, still on the list',
   n.code === '' && n.agent === '' && n.moved === '2026-09-15', JSON.stringify([n.code, n.agent, n.moved]));
ok('longest open first', out[0].days >= out[out.length - 1].days,
   JSON.stringify(out.map(o => o.days)));

/* ── 6. The branch line ─────────────────────────────────────────────────── */
console.log('\nThe branch line — how many, how many touched, how many left alone:\n');
const h = d.headline;
ok('five outstanding', h.outstanding === 5, String(h.outstanding));
ok('one touched today', h.touchedToday === 1, String(h.touchedToday));
ok('two untouched for a week or more (Beena, Carl)', h.untouched7d === 2, String(h.untouched7d));
ok('one untouched for a month or more (Beena)', h.untouched30d === 1, String(h.untouched30d));
ok('one past its own due date, one with no due date', h.pastDue === 1 && h.noDue === 2, h.pastDue + ' ' + h.noDue);

/* ── 7. This month ──────────────────────────────────────────────────────── */
console.log('\nThis month — the licences up in September, and their tasks:\n');
const tm = d.thisMonth;
ok('two licences come up in September: Anand ahead, Beena gone by',
   tm.n === 2 && tm.agents.length === 2 &&
   tm.agents.some(a => a.code === 'A00101' && a.dueThisMonth === true && a.justPassed === false) &&
   tm.agents.some(a => a.code === 'A00102' && a.kind === 'Life' && a.justPassed === true && a.dueThisMonth === false),
   JSON.stringify(tm.agents.map(a => [a.code, a.kind, a.dueThisMonth, a.justPassed])));
ok('the headline count agrees with the strip\'s rule', h.thisMonth === 2, String(h.thisMonth));
ok('Beena\'s November general licence is not this month',
   !tm.agents.some(a => a.code === 'A00102' && a.kind === 'General'));
ok('the excluded agent\'s September licence is not on it',
   !tm.agents.some(a => a.code === 'A00104') && !/Dev Departed/.test(blob));
ok('three of this month\'s tasks are open (two Anand, one Beena)', tm.tasks === 3, String(tm.tasks));
ok('  one touched today', tm.touchedToday === 1, String(tm.touchedToday));
ok('  one untouched a week, one a month', tm.untouched7d === 1 && tm.untouched30d === 1, tm.untouched7d + ' ' + tm.untouched30d);
ok('  nobody this month is unstarted', tm.unstarted === 0, String(tm.unstarted));
ok('each agent row carries its own tasks, without subjects',
   tm.agents.every(a => Array.isArray(a.tasks) && a.tasks.every(t => !('subject' in t))));
const anandRow = tm.agents.find(a => a.code === 'A00101');
ok('Anand: due 25 September, nine days away, two tasks', anandRow.due === '2026-09-25' && anandRow.days === 9 && anandRow.tasks.length === 2,
   JSON.stringify([anandRow.due, anandRow.days, anandRow.tasks.length]));
ok('Carl\'s March licence carries dueThisMonth false', d.agents.find(a => a.code === 'A00103').dueThisMonth === false);

/* ── 8. Exclusions are counted, and the history still adds up ───────────── */
console.log('\nWhat was removed, and the history:\n');
ok('the screen says one agent was excluded', d.roster.excluded === 1 && d.roster.active === 3,
   JSON.stringify(d.roster));
ok('two closed tasks make the turnaround, on branch-time days',
   d.turnaround.closed === 2 && d.turnaround.slowest === 58 && d.turnaround.fastest === 46,
   JSON.stringify(d.turnaround));
ok('Beena\'s September date went by with nothing closed against it',
   h.unconfirmed === 1 && d.soon[0].code === 'A00102' && d.soon[0].kind === 'Life',
   JSON.stringify(d.soon.map(a => [a.code, a.kind, a.justPassed])));

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + '\n');
process.exit(fails ? 1 : 0);
