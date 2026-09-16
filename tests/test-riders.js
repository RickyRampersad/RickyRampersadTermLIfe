// Riders on a clock — the rider book against the calendar.
//
// The branch's correction, on 12 September 2026: EVERY RIDER HAS AN EXPIRY.
// The permanent screen says the life cover does not end on a date and that is
// true, but the critical illness, the accidental death, the waiver of premium
// and the disability income riding on that same policy all do. A client told
// "this is for life" holds one contract where half of it is and half is not.
//
// The screen was asked for as "the riders expiring this month", and the month
// leads it. But the month is thin — one rider on the whole book in September
// 2026 — so this file also holds the two piles that are never thin, and the
// rule that keeps them honest:
//
//   ALREADY GONE, STILL ON THE BOOKS. The expiry has passed on a policy
//   Salesforce still calls premium paying.
//
//   NO EXPIRY DATE AT ALL. Fewer than half the riders in force carry one, so
//   the screen says the size of its own blind spot out loud.
//
// And the field names are asserted letter by letter, because one of them is
// misspelled in Salesforce — DI_Exipry__c — and a tidy-up that "fixes" it
// silently empties the disability income column.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Intelligence.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
const NOW = new Date('2026-09-12T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* ── 1. The four riders, and the fields that describe them ────────────────
   These are Salesforce's own names. Two of them do not read the way anybody
   would write them, and both are correct as spelled. */
console.log('\nThe four riders the branch writes, and the fields they live in:\n');
const K = k => env.iRidKind_(k) || {};
[['ci', 'Critical illness',   'Critical_Illness_Expiry__c'],
 ['ad', 'Accidental death',   'ADDAP_Expiry_Date__c'],
 ['wp', 'Waiver of premium',  'WP_Expiry__c'],
 ['di', 'Disability income',  'DI_Exipry__c']
].forEach(([key, lab, exp]) => {
  ok(lab + ' → ' + exp, K(key).lab === lab && K(key).exp === exp,
     K(key).lab + ' / ' + K(key).exp);
});
ok('the disability income expiry keeps Salesforce’s own misspelling',
   K('di').exp === 'DI_Exipry__c' && K('di').exp !== 'DI_Expiry__c',
   'a "corrected" name returns nothing and the column silently empties');
ok('the accidental death benefit keeps its own odd case',
   K('di').has === 'DI_bENEFIT__c', K('di').has);
ok('a rider nobody wrote is not a rider', env.iRidKind_('zz') === null);

/* Waiver of premium pays the premium, not a sum assured, so it must carry no
   cover at all rather than a zero that lands in a total. */
ok('waiver of premium has no sum assured', K('wp').cover === null, String(K('wp').cover));
ok('and is counted by what it costs', K('wp').has === 'WP_Premium__c', K('wp').has);

/* ── 2. In force, on the branch's own terms ───────────────────────────── */
console.log('\nAnd only what is in force is on the screen:\n');
ok('premium paying, in the branch’s words',
   /Policy_Status_Description__c = 'PREMIUM PAYING'/.test(env.iRidLive_()), env.iRidLive_());

/* ── 3. The dues tab, which decides paid to date ──────────────────────────
   Invented throughout: one clear, one overdue, one lapsed, one held by an
   excluded agent, and one the tab has never heard of. */
const DUESH = ['Agent', 'Number', 'Client Number', 'Client', 'Premium', 'Issue Date', 'Status',
               'Status(2)', 'Days', 'Insurance Type', 'Paid To Date', 'Sum Assured', 'Plan Code',
               'Billing type', 'Mode', 'Status Description', 'Projected Lapse Date', 'Phone', 'email'];
const due = (num, st2, desc) =>
  ['Anand Pretend', num, '1', 'CLIENTNAME', 1000, '2005-01-01', '0', st2 || '', 0, '2',
   '2026-09-28', 500000, 'ECT65 1', 'Direct Bill', '', desc, '', '', ''];
env.__mkSheet('Dues', 9, DUESH, [
  due('RID-CLEAR',   '',        'Premium Paying'),
  due('RID-OVERDUE', 'Overdue', 'Premium Paying'),
  due('RID-LAPSED',  '',        'Lapsed'),
  due('RID-EXCL',    '',        'Premium Paying'),
  due('RID-SEPT',    '',        'Premium Paying'),
  due('RID-NOV',     'Overdue', 'Premium Paying')
]);

/* The book, one row per rider, the way Salesforce answers it. n is how many
   carry the rider AT ALL — cover greater than nought, never merely set, since
   144 policies carry a critical illness coverage of zero — and d is how many
   of those carry an end date. The gap between them IS the blind spot. */
const book = {
  Critical_Illness_Coverage__c: [{ n: 2958, d: 1615, p: 1370913, c: 1277983100 }],
  ADDAP_Coverage__c:            [{ n: 1320, d: 517,  p: 36254,   c: 262587454 }],
  WP_Premium__c:                [{ n: 1616, d: 483,  p: 177222 }],
  DI_bENEFIT__c:                [{ n: 30,   d: 29,   p: 1802,    c: 115429 }]
};

/* Already gone: four critical illness rows, one of them lapsed, one held by
   the excluded agent, and one overdue that stays with a premium to collect. */
const ciRow = (pol, ag, xp, cov, prm) => ({
  POLICY__c: pol, AGENT__r: ag ? { Name: ag } : null,
  Critical_Illness_Expiry__c: xp, Critical_Illness_Coverage__c: cov,
  Critical_Illness_Premium__c: prm });
const adRow = (pol, ag, xp, cov, prm) => ({
  POLICY__c: pol, AGENT__r: ag ? { Name: ag } : null,
  ADDAP_Expiry_Date__c: xp, ADDAP_Coverage__c: cov, ADDAP_Premium__c: prm });
const goneCi = [
  ciRow('RID-CLEAR',   'Anand Pretend', '2017-06-01', 1500000, 900),
  ciRow('RID-OVERDUE', 'Anand Pretend', '2024-03-01', 500000,  400),
  ciRow('RID-LAPSED',  'Beena Pretend', '2015-01-01', 9000000, 5000),
  ciRow('RID-EXCL',    'Gone Away',     '2019-01-01', 8000000, 3000)
];
const goneAd = [ adRow('RID-UNKNOWN', 'Beena Pretend', '2021-02-01', 100000, 30) ];
/* Ahead: two this month — one already past the 12th and one still to come —
   and one in November, which belongs to the window and not to the month. */
/* No day-of-month column: the screen works the day out from the date, because
   a row-level SELECT may not carry DAY_IN_MONTH. */
const upCi = [
  ciRow('RID-SEPT', 'Anand Pretend', '2026-09-05', 250000, 200),
  ciRow('RID-NOV',  'Anand Pretend', '2026-11-20', 750000, 600)
];
const upAd = [ adRow('RID-UNKNOWN2', 'Beena Pretend', '2026-09-24', 100000, 0) ];
const forever = { ci: [{ n: 1092, cov: 601071002, prm: 488772 }],
                  ad: [{ n: 210,  cov: 41000000,  prm: 9000 }],
                  di: [{ n: 4,    cov: 12000,     prm: 180 }] };

const asked = [];
env.sfQuery_ = function (soql) {
  asked.push(soql);
  /* The book read: one per rider, told apart by the field it asks for. */
  if (/COUNT\(Id\) n, COUNT\(/.test(soql)) {
    const hit = Object.keys(book).filter(f => soql.indexOf(f + ' > 0') > -1)[0];
    return hit ? book[hit] : [];
  }
  if (/Life_Coverage_Expiry__c = null/.test(soql)) {
    if (/Critical_Illness_Coverage__c/.test(soql)) return forever.ci;
    if (/ADDAP_Coverage__c/.test(soql))            return forever.ad;
    if (/DI_bENEFIT__c/.test(soql))                return forever.di;
    return [];
  }
  if (/< TODAY/.test(soql)) {
    if (/Critical_Illness_Expiry__c/.test(soql)) return goneCi;
    if (/ADDAP_Expiry_Date__c/.test(soql))       return goneAd;
    return [];
  }
  if (/THIS_MONTH/.test(soql)) {
    if (/Critical_Illness_Expiry__c/.test(soql)) return upCi;
    if (/ADDAP_Expiry_Date__c/.test(soql))       return upAd;
    return [];
  }
  return [];
};

const d = env.iRidersWall_();
console.log('\nWhat the wall is handed:\n');
ok('it is configured', d.configured === true, d.error || '');
ok('the dues tab was read', d.duesRead === true);
ok('the window is a year', d.window === 12, String(d.window));

/* ── 4. THE BLIND SPOT, said out loud ─────────────────────────────────────
   5,924 riders in force and 2,644 with a date on them. A screen that quietly
   reported only the dated ones would be wrong by 3,280 policies. */
console.log('\nThe size of its own blind spot:\n');
ok('every rider in force is counted', d.book.n === 2958 + 1320 + 1616 + 30, String(d.book.n));
/* And it was asked for the right way: a coverage field set to zero is not a
   rider, so the count is on "greater than nought" and never on COUNT(field). */
ok('a rider with no cover at all is not counted as a rider',
   asked.filter(s2 => /COUNT\(Id\) n, COUNT\(/.test(s2)).every(s2 => / > 0/.test(s2)),
   asked.filter(s2 => /COUNT\(Id\) n/.test(s2))[0]);
ok('and only some of them carry a date', d.book.dated === 1615 + 517 + 483 + 29, String(d.book.dated));
ok('the difference is the blind spot', d.book.blank === d.book.n - d.book.dated,
   String(d.book.blank) + ' of ' + d.book.n);
ok('and the branch is told about it in words',
   (d.notes || []).some(x => /no expiry date at all/.test(x)), JSON.stringify(d.notes));
const ci = d.kinds.find(k => k.key === 'ci');
ok('per rider too — critical illness is 1,343 short of a date',
   ci.blank === 2958 - 1615, String(ci.blank));
/* Waiver of premium contributes no cover to any total, because it has none. */
ok('the waiver’s missing sum assured is not a zero in the cover total',
   d.book.cover === 1277983100 + 262587454 + 115429, String(d.book.cover));

/* ── 5. ALREADY GONE, AND IN FORCE, AND PAID TO DATE ───────────────────── */
console.log('\nThe ones that have already gone:\n');
/* Beena holds two rows in the fixture: a lapsed critical illness rider worth
   $9m, and an accidental death one the dues tab has never heard of. The
   second is hers; the first must not be. */
const beena = d.agents.find(a => a.name === 'Beena Pretend') || {};
ok('a lapsed policy’s rider is off the list',
   beena.n === 1 && beena.cover === 100000, JSON.stringify(beena));
ok('and its cover is not in the total', d.gone.cover === 1500000 + 500000 + 100000,
   String(d.gone.cover) + ' (1.5m + 0.5m + 0.1m, not the lapsed 9m nor the excluded 8m)');
ok('the excluded agent is nowhere on it', !(d.agents || []).some(a => a.name === 'Gone Away'));
ok('an overdue one stays, with the premium to collect first',
   (d.agents.find(a => a.name === 'Anand Pretend') || {}).collect === 1,
   JSON.stringify(d.agents.find(a => a.name === 'Anand Pretend')));
ok('one the dues tab has never heard of counts as ready, not dropped',
   d.gone.n === 3, String(d.gone.n));
ok('and the branch is told what the tab took off',
   (d.notes || []).some(x => /lapsed, been surrendered or matured/.test(x)), JSON.stringify(d.notes));
ok('the oldest expiry is a year, not a date on a client',
   (d.agents.find(a => a.name === 'Anand Pretend') || {}).oldest === 2017,
   String((d.agents.find(a => a.name === 'Anand Pretend') || {}).oldest));
ok('agents are ordered by what they hold', d.agents[0].cover >= (d.agents[1] || d.agents[0]).cover,
   JSON.stringify(d.agents.map(a => a.cover)));

/* ── 6. THIS MONTH, DAY BY DAY — what the screen was asked for ──────────── */
console.log('\nThis month, day by day:\n');
ok('September is the month', d.month === 'September', d.month);
ok('and it has thirty days', d.daysInMonth === 30, String(d.daysInMonth));
ok('two riders end this month', d.thisMonth.n === 2, JSON.stringify(d.thisMonth));
ok('on two days', d.days.length === 2, JSON.stringify(d.days));
ok('the 5th has gone', (d.days.find(x => x.day === 5) || {}).past === true);
ok('the 24th has not', (d.days.find(x => x.day === 24) || {}).past === false);
ok('and each day says which rider it was',
   (d.days.find(x => x.day === 5) || { kinds: {} }).kinds.ci === 1 &&
   (d.days.find(x => x.day === 24) || { kinds: {} }).kinds.ad === 1,
   JSON.stringify(d.days.map(x => x.kinds)));
ok('November is in the year ahead but not in the month',
   d.ahead.n === 3 && d.thisMonth.n === 2, JSON.stringify(d.ahead));
ok('the months ahead are named and in order',
   d.months.length === 2 && d.months[0].lab === 'September 2026' &&
   d.months[1].lab === 'November 2026',
   JSON.stringify(d.months.map(m => m.lab)));

/* ── 7. THE HERO: cover that rides on a policy which never ends ─────────── */
console.log('\nWhat rides on a policy that has no end date of its own:\n');
ok('the three riders that carry cover are added up',
   d.head.n === 1092 + 210 + 4, String(d.head.n));
ok('and the cover with them', d.head.cover === 601071002 + 41000000 + 12000, String(d.head.cover));
ok('the waiver is not asked about, because it has no cover to lose',
   !asked.some(s => /Life_Coverage_Expiry__c = null/.test(s) && /WP_/.test(s)));
ok('critical illness is the one that pays for the screen',
   (d.kinds.find(k => k.key === 'ci') || {}).forever.cover === 601071002);

/* ── 8. No client reaches this screen ────────────────────────────────────── */
console.log('\nAnd nothing client-level is in the answer:\n');
const blob = JSON.stringify(d);
['RID-CLEAR', 'RID-SEPT', 'POLICY__c', 'CLIENTNAME', 'Date_Of_Birth'].forEach(t => {
  ok('no ' + t + ' in the payload', blob.indexOf(t) === -1);
});
ok('the only names are our own agents',
   /Anand Pretend/.test(blob) && !/CLIENT/i.test(blob.replace(/CLIENT_PORTFOLIO/g, '')));
/* The policy number is read — it has to be, to test the dues tab — and it is
   read from the row and dropped. */
ok('but it was asked for, because the dues tab needs it',
   asked.some(s => /SELECT POLICY__c/.test(s)));

/* ── The shape of the reads ───────────────────────────────────────────────
   Salesforce allows field aliasing ONLY in an aggregate query, and rejects a
   row-level SELECT that carries one: "only aggregate expressions use field
   aliasing". Every row-level read here asks for plain field names, and the
   day of the month is arithmetic on the date rather than DAY_IN_MONTH. */
console.log('\nAnd the reads are shaped the way Salesforce will accept:\n');
const rowLevel = asked.filter(q => !/\bCOUNT\(|\bSUM\(|GROUP BY/.test(q));
ok('there is a row-level read to check', rowLevel.length > 0, String(asked.length) + ' queries');
rowLevel.forEach(q => {
  const list = q.slice(q.indexOf('SELECT ') + 7, q.indexOf(' FROM '));
  const aliased = list.split(',').map(x => x.trim()).filter(x => /\s/.test(x));
  ok('no field aliasing in a row-level read', aliased.length === 0, JSON.stringify(aliased));
  ok('and no aggregate function in one either', !/DAY_IN_MONTH|CALENDAR_(YEAR|MONTH)\(/.test(list), list);
});

/* ── 9. When Salesforce does not answer ──────────────────────────────────── */
console.log('\nWhen Salesforce does not answer:\n');
const env2 = makeEnv({});
env2.sfQuery_ = function () { throw new Error('INVALID_SESSION_ID'); };
let d2;
ok('it does not throw', (() => { try { d2 = env2.iRidersWall_(); return true; } catch (e) { return false; } })());
ok('and it repeats what Salesforce said',
   d2 && (d2.configured === false ? /INVALID_SESSION_ID/.test(d2.error || '')
                                  : (d2.notes || []).some(x => /INVALID_SESSION_ID/.test(x))),
   JSON.stringify(d2 && (d2.error || d2.notes)));

const env3 = makeEnv({});
env3.iSfHelper_ = () => '';
const d3 = env3.iRidersWall_();
ok('with no Salesforce in the project at all, it says so once',
   d3.configured === false && /neither sfQuery_ nor sfkQuery_/.test(d3.error || ''), d3.error);

/* ── 10. The wall action ─────────────────────────────────────────────────── */
console.log('\nThe wall action needs no sign-in:\n');
const r = env.iIntelRoute_ ? env.iIntelRoute_({ action: 'intel.riders' }) : env.iActRiders_({ fresh: true });
ok('intel.riders answers', !!r, JSON.stringify(r).slice(0, 120));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nAll good.\n');
process.exit(fails ? 1 : 0);
