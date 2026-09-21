// The permanent book: whole life, the premium period, and the riders.
//
// This is the other half of the branch and it is the larger half — 2,130
// policies, two billion dollars of cover — and for a day it was in the wrong
// column. The conversions screen had Econo Life down as a term that expires
// at 65, because that is what its plan code looks like and because its plan
// name on the one record that carries one reads "Econo Life to Age 65".
//
// The branch settled it on 12 September 2026:
//
//   ECONO LIFE IS WHOLE LIFE. The premium is paid to 65 or to 85; the cover
//   runs for life. The 65 is the end of the PREMIUM. That is why its expiry
//   date lands at ninety-nine, and why 48 of the branch's 49 conversions went
//   FCT into ECT — it is the destination, not a lead.
//
//   LIBERATOR's premium runs to 65, 75, 85 or 100, and the ones paid to 65
//   can be extended — which is the one thing on this screen an agent can act
//   on this week. It is NOT free and NOT automatic: the 6 March 2017
//   memorandum from the VP Insurance Operations requires an additional
//   premium and full underwriting on the increase, at the client's current
//   age, and it sets three gates — no more than three months in arrears, the
//   original sum assured kept, and never below the company minimum of
//   $100,000. Rejuvenator cannot be extended this way at all.
//
//   The screen used to gate on the ISSUE YEAR (2009 or earlier), which found
//   seventeen policies of which fifteen already paid to 75, 85 or 100 and had
//   nothing to extend. What decides it is the premium period.
//
//   REJUVENATOR is the critical illness cover.
//
// So this file holds the three families apart, proves the extension list is
// what it claims to be, and holds the two rules the branch repeated twice:
// in force, and paid to date, or it is not on the list.
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

/* ── 1. The three families, held apart by the plan code ───────────────────
   Every spelling below is one the branch's portfolio actually holds. */
console.log('\nThe plan code says which product it is:\n');
const fam = c => { const f = env.iPermFam_(c); return f ? f.fam : 'null'; };
[['ECT65 1', 'econo'], ['ECT651', 'econo'], ['ECT 65 1', 'econo'], ['ECT85 1', 'econo'],
 ['ECU65 1', 'econo'], ['NLE  1', 'econo'], ['NLE65', 'econo'],
 ['Econo Life to Age 65', 'econo'], ['Econo Life 65', 'econo'],
 ['LB75 1', 'lib'], ['LB85 1', 'lib'], ['LB100 1', 'lib'], ['LB65', 'lib'],
 ['LIB 65', 'lib'], ['LIB85', 'lib'], ['Liberator', 'lib'],
 ['CRIEV1', 'rejuv'], ['CR2EV1', 'rejuv'], ['CR3RP 1', 'rejuv'], ['CR4RP1', 'rejuv'],
 // Term belongs to the conversions screen, not this one.
 ['FCT65 1', 'null'], ['FNT85 1', 'null'], ['LIFEV 1', 'null'], ['Homeowners', 'null'],
 ['', 'null'], [null, 'null']
].forEach(([code, want]) => ok(String(code) + ' → ' + want, fam(code) === want, fam(code)));

/* LIB must win over LB, or every Liberator spelled the long way lands under
   the short prefix and the label reads wrong. */
ok('LIB beats LB', fam('LIB 65') === 'lib');
/* And the SOQL is generated from the same table, so the filter and the reader
   cannot drift apart. */
const like = env.iPermLike_();
console.log('\nAnd the filter asks Salesforce for exactly those:\n');
ok('every family in the table is in the filter',
   env.IPERM_FAMS.every(f => f.likes.every(k => like.indexOf("'" + k + "%'") > -1)), like);
ok('term is not', !/'FCT%'|'FNT%'/.test(like), like);

/* ── 2. The dues tab, which decides in force and paid to date ─────────────
   Invented throughout. Four states: clear, overdue, lapsed, and one the tab
   has never heard of. */
const DUESH = ['Agent', 'Number', 'Client Number', 'Client', 'Premium', 'Issue Date', 'Status',
               'Status(2)', 'Days', 'Insurance Type', 'Paid To Date', 'Sum Assured', 'Plan Code',
               'Billing type', 'Mode', 'Status Description', 'Projected Lapse Date', 'Phone', 'email'];
const due = (num, plan, sum, prem, st2, desc, days) =>
  ['Anand Pretend', num, '1', 'CLIENTNAME', prem, '2005-01-01', '0', st2 || '', days || 0, '2',
   '2026-09-28', sum, plan, 'Direct Bill', '', desc, '', '', ''];
env.__mkSheet('Dues', 9, DUESH, [
  due('LIB-OLD-A',   'LB75 1', 4000000, 4000, '',        'Premium Paying'),
  due('LIB-OLD-B',   'LB85 1', 3000000, 3000, 'Overdue', 'Premium Paying'),
  due('LIB-OLD-DEAD','LB75 1', 9000000, 9000, '',        'Lapsed'),
  due('LIB-OLD-EXCL','LB65',   8000000, 8000, '',        'Premium Paying'),
  due('ECONO-ONE',   'ECT65 1', 5000000, 5000, '',       'Premium Paying'),
  due('ECONO-TWO',   'ECT85 1', 2000000, 2000, 'Overdue','Premium Paying'),
  due('REJUV-ONE',   'CRIEV1',  1000000, 1000, '',       'Premium Paying'),
  /* THE MEMORANDUM'S OWN TWO LINES. Forty days behind is still eligible with
     a premium to collect; a hundred and twenty days is not eligible at all
     until the policy is brought up to date. And $60,000 is under the company
     minimum, so there is no extension to be had on it whatever it has paid. */
  due('LIB-OLD-LATE','LB65 1',  2000000, 2000, 'Overdue','Premium Paying', 40),
  due('LIB-OLD-GONE','LB65 1',  5000000, 5000, 'Overdue','Premium Paying', 120),
  due('LIB-OLD-TINY','LB65 1',    60000,   90, '',       'Premium Paying'),
  // Term, so it must never reach the permanent pool split.
  due('TERM-ONE',    'FCT65 1', 7000000, 7000, '',       'Premium Paying'),
]);

const asked = [];
const agg = {
  byCode: [
    { pc: 'ECT65 1', n: 673, cover: 808528726, prem: 559558, oldest: '2022-04-11' },
    { pc: 'NLE  1',  n: 111, cover: 39520000,  prem: 36444,  oldest: '1990-12-20' },
    { pc: 'LB75 1',  n: 106, cover: 45325096,  prem: 43338,  oldest: '2002-06-15' },
    { pc: 'CRIEV1',  n: 139, cover: 114375372, prem: 102539, oldest: '2002-05-28' },
    { pc: 'WHO KNOWS', n: 4, cover: 1000000,   prem: 500,    oldest: '2020-01-01' }
  ],
  /* The extension list, row by row, because every one has to be looked up in
     the dues tab. Two clear, one overdue, one lapsed, one excluded agent. */
  extRows: [
    { POLICY__c: 'LIB-OLD-A',    AGENT__r: { Name: 'Anand Pretend' }, Life_Coverage__c: 4000000, Life_Premium__c: 4000, ISSUE_DATE__c: '2003-05-01' },
    { POLICY__c: 'LIB-OLD-B',    AGENT__r: { Name: 'Anand Pretend' }, Life_Coverage__c: 3000000, Life_Premium__c: 3000, ISSUE_DATE__c: '2001-02-01' },
    { POLICY__c: 'LIB-OLD-DEAD', AGENT__r: { Name: 'Beena Pretend' }, Life_Coverage__c: 9000000, Life_Premium__c: 9000, ISSUE_DATE__c: '2005-01-01' },
    { POLICY__c: 'LIB-OLD-EXCL', AGENT__r: { Name: 'Gone Away' },     Life_Coverage__c: 8000000, Life_Premium__c: 8000, ISSUE_DATE__c: '2009-12-01' },
    { POLICY__c: 'LIB-OLD-NEW',  AGENT__r: { Name: 'Beena Pretend' }, Life_Coverage__c: 1000000, Life_Premium__c: 1000, ISSUE_DATE__c: '2007-07-07' },
    { POLICY__c: 'LIB-OLD-LATE', AGENT__r: { Name: 'Anand Pretend' }, Life_Coverage__c: 2000000, Life_Premium__c: 2000, ISSUE_DATE__c: '2004-04-04' },
    { POLICY__c: 'LIB-OLD-GONE', AGENT__r: { Name: 'Anand Pretend' }, Life_Coverage__c: 5000000, Life_Premium__c: 5000, ISSUE_DATE__c: '2006-06-06' },
    { POLICY__c: 'LIB-OLD-TINY', AGENT__r: { Name: 'Beena Pretend' }, Life_Coverage__c: 60000,   Life_Premium__c: 90,   ISSUE_DATE__c: '2008-08-08' }
  ],
  ages: [{ yr: 1990, n: 111, cover: 39520000 }, { yr: 2002, n: 245, cover: 159700468 },
         { yr: 2022, n: 673, cover: 808528726 }],
  mats: [{ yr: 2027, n: 12, cover: 4200000 }, { yr: 2029, n: 14, cover: 5600000 }],
  riders: [{ cin: 3102, cicov: 1277983100, ciprem: 1370913,
             adn: 1320, adcov: 262587454, adprem: 36254,
             wpn: 1452, wpprem: 177222, din: 30, diprem: 1802 }]
};
env.sfQuery_ = function (soql) {
  asked.push(soql);
  if (/SELECT POLICY__c/.test(soql))                 return agg.extRows;
  if (/GROUP BY Life_Plan_01__c/.test(soql))         return agg.byCode;
  if (/CALENDAR_YEAR\(ISSUE_DATE__c\)/.test(soql))   return agg.ages;
  if (/CALENDAR_YEAR\(Maturity_Date__c\)/.test(soql)) return agg.mats;
  return agg.riders;
};

console.log('\nWhat the wall is handed:\n');
const d = env.iPermanentWall_();
ok('it is configured', d.configured === true, d.error || '');
ok('the dues tab was read', d.duesRead === true);
ok('the gate is the premium period, not the issue year', d.extendAge === 65, String(d.extendAge));
ok('the company minimum travels with the answer', d.minSum === 100000, String(d.minSum));
ok('and so does the three-month rule', d.arrearsDays === 92, String(d.arrearsDays));
ok('the screen can cite the memorandum', /2017/.test(d.memo || ''), d.memo);

/* ── 3. IN FORCE, AND PAID TO DATE ───────────────────────────────────────── */
ok('a lapsed Liberator cannot be extended, so it is off the list',
   d.state.gone === 1 && !(d.agents || []).some(a => a.name === 'Beena Pretend' && a.cover === 9000000),
   JSON.stringify(d.state));
ok('and the branch is told it came off', (d.notes || []).some(x => /off the list/.test(x)),
   JSON.stringify(d.notes));
ok('an overdue one stays, with the premium to collect first',
   (d.agents.find(a => a.name === 'Anand Pretend') || {}).collect === 2,
   JSON.stringify(d.agents));
ok('one the tab has never heard of counts as ready, not dropped',
   d.state.ready === 3, JSON.stringify(d.state));
/* ── THE MEMORANDUM'S TWO LINES ─────────────────────────────────────────── */
ok('forty days behind is still eligible, with the premium to collect first',
   d.state.collect === 2, JSON.stringify(d.state));
ok('a hundred and twenty days behind is not eligible until it is brought up to date',
   d.state.behind === 1, JSON.stringify(d.state));
ok('and the branch is told why it came off',
   (d.notes || []).some(x => /three months in arrears/.test(x)), JSON.stringify(d.notes));
ok('under the company minimum there is no extension to be had',
   d.state.small === 1 && d.small.n === 1 && d.small.cover === 60000, JSON.stringify(d.small));
ok('and that is said in words too',
   (d.notes || []).some(x => /company minimum of \$100,000/.test(x)), JSON.stringify(d.notes));
ok('neither the one too far behind nor the one too small is in the cover',
   d.extend.cover === 8000000 + 2000000,
   String(d.extend.cover) + ' (the three clear ones plus the forty-day arrears, ' +
   'not the 5m at a hundred and twenty days nor the 60k under the minimum)');
ok('the excluded agent is nowhere on it', !(d.agents || []).some(a => a.name === 'Gone Away'));
/* The excluded agent comes out of the figure as well as the list. A total a
   room cannot add up from the rows beneath it is a total nobody believes. */
ok('and their cover is not in the total, nor the lapsed one’s',
   !JSON.stringify(d.agents).includes('Gone Away') && d.extend.cover < 9000000 + 8000000,
   String(d.extend.cover));
ok('four policies are on the list', d.extend.n === 4, String(d.extend.n));
ok('the oldest is the oldest of the ones still standing', d.extend.since === 2001,
   String(d.extend.since));
ok('and how long that has been in force', d.extend.years === 26 || d.extend.years === 25,
   String(d.extend.years));

/* ── 4. The three products, folded off a dozen spellings ─────────────────── */
console.log('\nThe three products:\n');
const f = k => d.families.find(x => x.fam === k) || {};
ok('Econo Life folds ECT and NLE together', f('econo').n === 784, String(f('econo').n));
ok('and says it is whole life with the premium to 65 or 85',
   /whole life/.test(f('econo').sub) && /premium to 65 or 85/.test(f('econo').sub), f('econo').sub);
ok('Liberator says which ages its premium runs to',
   /65, 75, 85 or 100/.test(f('lib').sub), f('lib').sub);
ok('Rejuvenator is named as the critical illness cover',
   /critical illness/.test(f('rejuv').sub), f('rejuv').sub);
ok('each carries the year its oldest was written', f('econo').since === 1990, String(f('econo').since));
ok('a plan code it cannot place is said out loud, not dropped',
   (d.notes || []).some(x => /cannot place/.test(x)), JSON.stringify(d.notes));
ok('the whole permanent book totals its families',
   d.total.n === 784 + 106 + 139, JSON.stringify(d.total));

/* ── 5. The riders, and the years in force ───────────────────────────────── */
console.log('\nAnd what rides on them:\n');
ok('four riders, critical illness first', d.riders.length === 4 &&
   d.riders[0].lab === 'Critical illness', JSON.stringify(d.riders.map(r => r.lab)));
ok('the critical illness rider carries more than the whole term book',
   d.riders[0].cover > 1e9, String(d.riders[0].cover));
ok('waiver of premium has a premium but no cover of its own',
   d.riders[2].cover === null && d.riders[2].prem > 0, JSON.stringify(d.riders[2]));
ok('years in force come back in bands, not twenty-five years',
   d.bands.length > 1 && d.bands.length <= 5, JSON.stringify(d.bands.map(b => b.lab)));
/* 1990 and 2002 are both over twenty years old, so both land in the last
   band — 111 + 245. The bands are cumulative by age, not one year each. */
ok('anything over twenty years old lands in the oldest band',
   (d.bands[d.bands.length - 1] || {}).lab === 'over 20 years' &&
   (d.bands[d.bands.length - 1] || {}).n === 356, JSON.stringify(d.bands));
ok('maturities still to come are there', d.maturities.length === 2 && d.maturities[0].yr === 2027);

/* ── 6. In force, on every read ──────────────────────────────────────────── */
console.log('\nWhat it asked Salesforce for:\n');
const all = asked.join('\n');
ok('only policies still paying', asked.every(q => /PREMIUM PAYING/.test(q)),
   String(asked.length) + ' queries');
/* Nothing here ends on a date, so this screen must NOT filter on an expiry
   date — doing so dropped whole life from its own screen. */
ok('and it never requires an expiry date, because nothing here has one',
   !/Life_Coverage_Expiry__c >= TODAY/.test(all));
/* THE GATE IS THE PREMIUM PERIOD. It used to be the issue year, which found
   seventeen policies of which fifteen already paid to 75, 85 or 100 and had
   nothing to extend. A Liberator paid to 65 is the one that runs out of road,
   whenever it was written — and the branch types that code four ways. */
ok('the extension list asks for the Liberators paid to 65, every spelling',
   ["LB65%", "LIB65%", "LIB 65%"].every(k => all.indexOf("'" + k + "'") > -1),
   env.iPermExtendLike_());
ok('and no longer cuts on the issue year', !/ISSUE_DATE__c < \d{4}-01-01/.test(all),
   'the year gate found fifteen policies with nothing to extend');
/* A Liberator paid to 85 must never reach the extension list. */
ok('a Liberator paid to 85 is not on it', !/LB85|LIB85/.test(env.iPermExtendLike_()),
   env.iPermExtendLike_());
ok('nothing was asked for that names a client',
   !/Client_|_NAME|Name__c|Email|Insured/i.test(
     all.replace(/CLIENT_PORTFOLIO__c/g, '').replace(/AGENT__r\.Name/g, '')));

/* ── 7. Nothing client-level comes back ─────────────────────────────────── */
console.log('\nAnd nothing client-level is in the answer:\n');
const flat = JSON.stringify(d);
['POLICY__c', 'LIB-OLD', 'Date_Of_Birth', 'dob', 'client'].forEach(k =>
  ok('no ' + k + ' in the payload', flat.toLowerCase().indexOf(k.toLowerCase()) === -1));
ok('the only names are our own agents',
   (d.agents || []).every(a => ['Anand Pretend', 'Beena Pretend'].indexOf(a.name) > -1));

/* ── 8. When Salesforce does not answer ─────────────────────────────────── */
console.log('\nWhen Salesforce does not answer:\n');
env.sfQuery_ = function () { throw new Error('INVALID_SESSION_ID'); };
const bad = env.iPermanentWall_();
ok('it does not throw', !!bad);
ok('it says it is not configured', bad.configured === false);
ok('and it repeats what Salesforce said', /INVALID_SESSION_ID/.test(bad.error || ''), bad.error);
delete env.sfQuery_;
const none = env.iPermanentWall_();
ok('with no Salesforce in the project at all, it says so',
   none.configured === false && /sfQuery_/.test(none.error || ''), none.error);

/* ── 9. The wall asks without a token ───────────────────────────────────── */
console.log('\nThe wall action needs no sign-in:\n');
env.sfQuery_ = function (soql) { return /SELECT POLICY__c/.test(soql) ? agg.extRows : agg.byCode; };
const r = JSON.parse(env.intelDoPost_({ postData: { contents: JSON.stringify({ action: 'intel.permanent' }) } })
                        .getContent());
ok('intel.permanent answers', r.ok === true, JSON.stringify(r).slice(0, 160));
ok('and hands back the screen’s data', !!(r.data && r.data.configured));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nAll good.\n');
process.exit(fails ? 1 : 0);
