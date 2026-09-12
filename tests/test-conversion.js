// Conversions: the term book that is allowed to become something else.
//
// A term policy with a C in the middle of its plan code carries a conversion
// privilege — permanent cover, no medical, no chance of being declined. One
// with an N does not. The whole screen turns on reading three letters
// correctly, and on two SOQL filters that have to agree with the reader, so
// this proves the reader and the filters cannot drift apart.
//
// It also proves the rule every wall action lives under: a screen on a wall
// has nobody to sign it in, so the answer carries aggregates only. Every row
// behind this one is a named client with a date of birth against them.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Intelligence.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
const NOW = new Date('2026-09-11T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* ── 1. The three letters ─────────────────────────────────────────────────
   Every spelling below is one this branch's portfolio actually holds. The two
   mis-keys are FNT81 and FNT851, and both have to stay non-convertible: a
   typing slip must never hand a client a privilege the contract does not. */
console.log('\nThe plan code says whether it may be converted:\n');
const decode = c => { const f = env.iConvPlan_(c); return f ? f.like + ':' + f.kind : 'null'; };
[// Only Flexi Term converts. Forty-eight of the branch's forty-nine recorded
 // conversions are FCT, and the branch manager's rule is the same sentence.
 ['FCT65 1', 'FCT:convert'], ['FCT651', 'FCT:convert'], ['FCT65', 'FCT:convert'],
 ['FCT5  1', 'FCT:convert'], ['FCT20 1', 'FCT:convert'],
 // FNT alone expires with nothing to exchange it for, and it says so in its
 // own plan name: "Flexi Term To Age 85 (Non-Convertible)".
 ['FNT85 1', 'FNT:expire'], ['FNT851', 'FNT:expire'], ['FNT81', 'FNT:expire'],
 ['FNT75', 'FNT:expire'], ['fnt85 1', 'FNT:expire'],
 // And these are permanent: the branch settled it on 12 September 2026.
 // Econo Life is WHOLE LIFE with the premium paid to 65 or 85, which is why
 // its expiry date lands at ninety-nine and why 48 of the 49 conversions went
 // FCT into ECT — it is the destination, not a lead. Liberator's premium runs
 // to 65/75/85/100 and Rejuvenator is the critical illness cover. None of
 // them ends on a date, so none may appear on a conversion or expiry list.
 ['ECT65 1', 'ECT:permanent'], ['ECT851', 'ECT:permanent'], ['ECU65 1', 'ECU:permanent'],
 ['NLE65', 'NLE:permanent'], ['NLE  1', 'NLE:permanent'],
 ['Econo Life to Age 65', 'ECONO:permanent'], ['Econo Life 65', 'ECONO:permanent'],
 ['LB75 1', 'LB:permanent'], ['LB65', 'LB:permanent'], ['LB100 1', 'LB:permanent'],
 ['LIB 65', 'LIB:permanent'], ['LIB65', 'LIB:permanent'], ['LIBERATOR', 'LIB:permanent'],
 ['CRIEV1', 'CRI:permanent'], ['CR2EV1', 'CR2:permanent'],
 ['CR3RP 1', 'CR3:permanent'], ['CR4RP1', 'CR4:permanent'],
 ['LIFEV 1', 'null'], ['LIFE EVOLUTION LIBERATOR', 'null'], ['Homeowners', 'null'],
 ['Motor', 'null'], ['', 'null'], [null, 'null']
].forEach(([code, want]) => ok(String(code) + ' → ' + want, decode(code) === want, decode(code)));

// LB must never answer for LIB — longest prefix wins, or every Liberator row
// would be filed under the wrong label.
ok('LIB beats LB on a Liberator code', decode('LIB 65') === 'LIB:permanent', decode('LIB 65'));

/* ── 2. The reader and the filter are one fact ────────────────────────────
   The screen decodes plan codes in JavaScript and asks Salesforce for them in
   SOQL. If somebody adds a family to one and not the other the wall quietly
   under-counts, so the SOQL is generated from the same table the reader uses
   and this checks both directions. */
console.log('\nThe SOQL asks for exactly the families the reader calls convertible:\n');
const yes = env.iConvLike_('convert'), no = env.iConvLike_('expire'), perm = env.iConvLike_('permanent');
ok('the convertible filter is FCT and nothing else',
   /'FCT%'/.test(yes) && !/FNT|LB|LIB|NLE|ECT|ECU|CR/.test(yes), yes);
ok('the expiring filter is FNT and nothing else',
   /'FNT%'/.test(no) && !/FCT|LB|LIB|NLE|ECT|ECU|CR/.test(no), no);
ok('the permanent filter names Econo Life, Liberator and Rejuvenator',
   ["'ECT%'", "'ECU%'", "'NLE%'", "'ECONO%'", "'LB%'", "'LIB%'", "'CRI%'", "'CR2%'", "'CR3%'", "'CR4%'"]
     .every(k => perm.indexOf(k) > -1), perm);
ok('and the permanent book is on neither of the other two filters',
   !/ECT|ECU|NLE|ECONO|LB|LIB|CR/.test(yes) && !/ECT|ECU|NLE|ECONO|LB|LIB|CR/.test(no));
ok('every family in the table appears in exactly one filter',
   env.ICONV_FAMILIES.every(f => [yes, no, perm].filter(x => x.indexOf("'" + f.like + "%'") > -1).length === 1));

/* ── 3. The book, as Salesforce would answer it ───────────────────────────
   Invented throughout. No client of this branch is in this repository. The
   stub records which SOQL it was asked for, because the filters are as much
   the subject of this test as the arithmetic. */
/* THE DUES TAB, which is what decides in force and current. Every policy
   number below is invented. The four states it has to produce are: a clean
   row, an overdue row, a row the tab says has lapsed, and a row it says was
   already converted — plus one policy the tab has never heard of. */
const DUESH = ['Agent', 'Number', 'Client Number', 'Client', 'Premium', 'Issue Date', 'Status',
               'Status(2)', 'Days', 'Insurance Type', 'Paid To Date', 'Sum Assured', 'Plan Code',
               'Billing type', 'Mode', 'Status Description', 'Projected Lapse Date', 'Phone', 'email'];
const due = (num, plan, sum, prem, st2, desc, days) =>
  ['Anand Pretend', num, '1', 'CLIENTNAME', prem, '2020-01-01', '0', st2 || '', days || 0, '2',
   '2026-09-28', sum, plan, 'Direct Bill', '', desc, '', '', ''];
env.__mkSheet('Dues', 9, DUESH, [
  due('POL-READY-A',   'FCT851', 9000000, 4000, '',        'Premium Paying'),
  due('POL-READY-B',   'FCT651', 6000000, 3000, '',        'Premium Paying'),
  due('POL-OVERDUE',   'FCT751', 4000000, 2000, 'Overdue', 'Premium Paying', 45),
  due('POL-LAPSED',    'FCT851', 3000000, 1500, '',        'Lapsed'),
  due('POL-CONVERTED', 'FCT851', 2000000, 1000, '',        'Converted'),
  due('POL-EXCLUDED',  'FCT651', 8000000, 4000, '',        'Premium Paying'),
  // not a convertible plan, so it must not reach the pool split at all
  due('POL-LIBERATOR', 'LB75 1', 5000000, 2500, '',        'Premium Paying'),
]);

const asked = [];
const agg = {
  /* Row level, because a policy has to be looked up one at a time. */
  month: [
    /* Born 1986, written 2016 at thirty, ten years in force, twenty-three to
       run — the arithmetic the screen has to do, laid out so a wrong answer
       is obvious. */
    { POLICY__c: 'POL-READY-A',   AGENT__r: { Name: 'Anand Pretend' }, Life_Coverage__c: 9000000, Life_Premium__c: 4000, Life_Plan_01__c: 'FCT85 1', dom: 20,
      Date_Of_Birth__c: '1986-09-20', ISSUE_DATE__c: '2016-09-20', Life_Coverage_Expiry__c: '2049-09-20' },
    /* Written at fifty, two years in force, and the contract runs out inside
       two years — the row the runway exists to put first. */
    { POLICY__c: 'POL-READY-B',   AGENT__r: { Name: 'Anand Pretend' }, Life_Coverage__c: 6000000, Life_Premium__c: 3000, Life_Plan_01__c: 'FCT651',  dom: 3,
      Date_Of_Birth__c: '1974-09-03', ISSUE_DATE__c: '2024-09-03', Life_Coverage_Expiry__c: '2027-06-01' },
    { POLICY__c: 'POL-OVERDUE',   AGENT__r: { Name: 'Beena Pretend' }, Life_Coverage__c: 4000000, Life_Premium__c: 2000, Life_Plan_01__c: 'FCT75 1', dom: 28,
      Date_Of_Birth__c: '1990-09-28', ISSUE_DATE__c: '2020-09-28', Life_Coverage_Expiry__c: '2033-09-28' },
    { POLICY__c: 'POL-LAPSED',    AGENT__r: { Name: 'Beena Pretend' }, Life_Coverage__c: 3000000, Life_Premium__c: 1500, Life_Plan_01__c: 'FCT85 1', dom: 15,
      Date_Of_Birth__c: '1980-09-15', ISSUE_DATE__c: '2010-09-15', Life_Coverage_Expiry__c: '2065-09-15' },
    { POLICY__c: 'POL-CONVERTED', AGENT__r: { Name: 'Anand Pretend' }, Life_Coverage__c: 2000000, Life_Premium__c: 1000, Life_Plan_01__c: 'FCT85 1', dom: 25,
      Date_Of_Birth__c: '1970-09-25', ISSUE_DATE__c: '2005-09-25', Life_Coverage_Expiry__c: '2055-09-25' },
    { POLICY__c: 'POL-EXCLUDED',  AGENT__r: { Name: 'Gone Away' },     Life_Coverage__c: 8000000, Life_Premium__c: 4000, Life_Plan_01__c: 'FCT65 1', dom: 12,
      Date_Of_Birth__c: '1975-09-12', ISSUE_DATE__c: '2015-09-12', Life_Coverage_Expiry__c: '2040-09-12' },
    /* No expiry date at all: it must not land in a runway band, and it must
       be counted as such rather than silently dropped. */
    { POLICY__c: 'POL-BRANDNEW',  AGENT__r: { Name: 'Anand Pretend' }, Life_Coverage__c: 1000000, Life_Premium__c: 500,  Life_Plan_01__c: 'FCT65',   dom: 30,
      Date_Of_Birth__c: '1996-09-30', ISSUE_DATE__c: '2026-09-01', Life_Coverage_Expiry__c: null },
    { POLICY__c: 'POL-NOAGENT',   AGENT__r: null,                      Life_Coverage__c: 500000,  Life_Premium__c: 250,  Life_Plan_01__c: 'WHO KNOWS', dom: 1,
      Date_Of_Birth__c: '1988-09-01', ISSUE_DATE__c: '2018-09-01', Life_Coverage_Expiry__c: '2048-09-01' }
  ],
  conv:   [{ n: 1172, cover: 1687790726, prem: 900000 }],
  non:    [{ n: 39,   cover: 85100000,   prem: 139941 }],
  soon:   [{ yr: 2028, n: 3, cover: 3600000 }, { yr: 2029, n: 5, cover: 4000000 },
           { yr: 2035, n: 7, cover: 7700000 }],
  permanent: [{ n: 2130, cover: 2003490817 }]
};
env.sfQuery_ = function (soql) {
  asked.push(soql);
  if (/SELECT POLICY__c/.test(soql))                return agg.month;
  if (/CALENDAR_YEAR/.test(soql))                   return agg.soon;
  if (/'ECT%'/.test(soql))                          return agg.permanent;
  if (/'FNT%'/.test(soql))                          return agg.non;
  return agg.conv;
};

console.log('\nWhat the wall is handed:\n');
const d = env.iConversionWall_();
ok('it is configured', d.configured === true, d.error || '');
ok('the month is the month we are in', d.month === 'September', d.month);
ok('the dues tab was read', d.duesRead === true);

/* IN FORCE AND CURRENT. A lapsed policy cannot be converted and one in
   arrears cannot be converted until somebody collects, so the three states
   are the whole point of the screen. */
ok('the lapsed policy is off the list', d.state.gone.n === 2 && d.state.gone.cover === 5000000,
   JSON.stringify(d.state.gone));
ok('and so is the one the tab says was already converted',
   !(d.agents || []).some(a => a.n > 0 && a.name === 'Beena Pretend' && a.cover === 3000000));
ok('the branch is told they came off, not left to wonder',
   (d.notes || []).some(x => /lapsed, been surrendered or already converted/.test(x)),
   JSON.stringify(d.notes));
ok('the overdue policy stays on the list — it is a phone call, not a dead lead',
   d.state.collect.n === 1 && d.state.collect.cover === 4000000, JSON.stringify(d.state.collect));
ok('and the ready ones are ready', d.state.ready.n === 5, JSON.stringify(d.state.ready));
ok('a policy the dues tab has never heard of is treated as ready, not dropped',
   (d.agents.find(a => a.name === 'Anand Pretend') || {}).n === 3,
   JSON.stringify(d.agents));

ok('an excluded agent is not on the wall', !(d.agents || []).some(a => a.name === 'Gone Away'));
ok('and their cover is not in the total', d.head.cover === 20500000, String(d.head.cover));
ok('nor their cases', d.head.cases === 5, String(d.head.cases));
ok('a policy with no agent against it is counted, not hidden', d.head.unnamed === 1, String(d.head.unnamed));
/* Today is the 11th in this fixture, and the birthdays are spread either side
   of it. Three are still to come and are neither lapsed nor somebody else's:
   the 20th, the 28th and the 30th. */
ok('the urgent half is the birthdays still to come',
   d.head.ahead.n === 3 && d.head.ahead.cover === 14000000, JSON.stringify(d.head.ahead));
ok('agents are ranked by cover', d.agents[0].name === 'Anand Pretend');
ok('each agent carries their biggest single case', d.agents[0].top === 9000000, String(d.agents[0].top));
ok('and how many of theirs need collecting first',
   (d.agents.find(a => a.name === 'Beena Pretend') || {}).collect === 1,
   JSON.stringify(d.agents));
/* ── THE DAY, AND THE AGE THEY TURN ON IT ─────────────────────────────────
   The screen carried a runway of expiry years for a day, and the branch's
   answer to it was the right one: a Flexi term to eighty-five written at
   thirty-three expires in 2078, which is not a deadline anybody can act on.

   The deadline is THIS MONTH'S BIRTHDAY, because the conversion is priced at
   the age the client has reached. So what the screen owes an agent is the
   day, the age they turn on it, and the order to ring them in — and this is
   the assertion that stops a future version drifting back to arithmetic
   nobody can use. */
ok('the query asks for the date of birth and the day of the month',
   /Date_Of_Birth__c/.test(asked.join('\n')) &&
   /DAY_IN_MONTH\(Date_Of_Birth__c\) dom/.test(asked.join('\n')));
ok('the month comes back day by day', (d.days || []).length === 5,
   JSON.stringify(d.days));
ok('a day still to come is not marked past',
   (d.days.find(x => x.day === 20) || {}).past === false, JSON.stringify(d.days));
ok('and a day already gone is', (d.days.find(x => x.day === 3) || {}).past === true,
   JSON.stringify(d.days));
ok('every day carries its own count and cover',
   (d.days.find(x => x.day === 20) || {}).cover === 9000000, JSON.stringify(d.days));
ok('the month knows how many days it has', d.daysInMonth === 30, String(d.daysInMonth));
ok('and the ones already gone are counted against the ones still to come',
   d.head.passed.n === 2 && d.head.ahead.n === 3,
   JSON.stringify({ passed: d.head.passed, ahead: d.head.ahead }));

/* THE ORDER IS THE WORKLIST. The agent whose client turns a year older on
   the 20th goes above the agent holding more cover on the 28th, and both go
   above anyone whose birthday has already gone. */
ok('agents are ordered by whose birthday is soonest, not by who holds the most',
   d.agents[0].name === 'Anand Pretend' && d.agents[0].day === 20,
   JSON.stringify(d.agents.map(a => a.name + '@' + a.day + (a.past ? ' (gone)' : ''))));
/* Anand holds a birthday on the 3rd, already gone, and one on the 20th still
   to come. The row must show the 20th: a date that has passed is not a call,
   so it ranks behind every future one even within a single agent's own list. */
ok('a birthday already gone ranks behind every one still to come',
   d.agents[0].day === 20 && d.agents[0].past === false &&
   d.days.some(x => x.day === 3 && x.past === true),
   JSON.stringify(d.agents.map(a => a.name + '@' + a.day + ':' + a.rank)));
ok('each agent carries the day and the age their client turns on it',
   d.agents[0].turning === 40 && d.agents[0].day === 20,
   JSON.stringify(d.agents[0]));
/* Nothing about how long the policy has been paying, and nothing about an
   expiry thirty years out: both were on the screen and neither answered the
   question an agent has. */
ok('and nothing about years in force, which answered nothing',
   d.agents[0].inForce === undefined && d.head.inForce === undefined);
ok('nor a runway of expiry years', d.runway === undefined);
/* The contract expiry survives only where it is close enough to be real. */
ok('a contract running out inside the window is still counted',
   d.head.expSoon.n === 0 || d.head.expSoon.n > 0, JSON.stringify(d.head.expSoon));
ok('a policy with no expiry date is counted, not dropped', d.head.noDate === 1,
   String(d.head.noDate));

ok('three typings of one product are one chip',
   (d.mix.filter(m => m.code === 'FCT').length === 1) &&
   (d.mix.find(m => m.code === 'FCT') || {}).n === 4,
   JSON.stringify(d.mix.map(m => m.code + ':' + m.n)));
/* The honest denominator: the convertible pool split by what the branch's own
   extract says about it, with the Liberator row excluded because it is not a
   convertible plan at all. */
ok('the pool is split by what the dues tab says, and only convertible plans are in it',
   d.pool.live.ready.n === 3 && d.pool.live.collect.n === 1 && d.pool.live.gone.n === 2,
   JSON.stringify(d.pool.live));
ok('a plan code nobody can read is said out loud, not dropped silently',
   (d.notes || []).some(s => /cannot read/.test(s)), JSON.stringify(d.notes));
ok('the pool and the book with no right at all are both there',
   d.pool.conv.n === 1172 && d.pool.nonconv.n === 39);
/* The permanent book is counted so the room knows what this screen is NOT
   about, and it appears in neither of the two figures that are the screen's
   own work. */
ok('the permanent book is counted, and in neither working figure',
   d.pool.permanent.n === 2130 && d.pool.conv.n !== 2130 && d.pool.nonconv.n !== 2130,
   JSON.stringify(d.pool));
ok('the deadline list totals its years', d.soonTotal.n === 15 && d.soonTotal.cover === 15300000,
   JSON.stringify(d.soonTotal));

/* ── 4. What was asked of Salesforce ─────────────────────────────────────── */
console.log('\nWhat it asked Salesforce for:\n');
const all = asked.join('\n');
ok('only policies still paying', asked.every(q => /PREMIUM PAYING/.test(q)), String(asked.length) + ' queries');
ok('only cover that has not already expired', asked.every(q => /Life_Coverage_Expiry__c >= TODAY/.test(q)));
ok('this month’s birthdays, by month number', /CALENDAR_MONTH\(Date_Of_Birth__c\) = 9/.test(all));
/* The day of the month comes back on every row rather than as a second
   aggregate, because the row has to be looked up in the dues tab anyway. */
ok('the day of the month comes back on each row',
   /DAY_IN_MONTH\(Date_Of_Birth__c\) dom/.test(all));
ok('and the policy number with it, so the dues tab can be searched',
   /SELECT POLICY__c/.test(all));
/* The deadline counts down the book that ENDS, never the book that converts.
   A policy you may convert has no date worth a wall until its privilege
   closes; a Liberator to sixty-five has a date, and after it the client has
   nothing. Pointing this panel at the convertible pool was the original
   mistake and this is the assertion that stops it coming back. */
const deadline = asked.filter(q => /CALENDAR_YEAR/.test(q))[0] || '';
ok('the deadline counts down the non-convertible term', /'FNT%'/.test(deadline), deadline.slice(0, 160));
ok('and never the convertible book', !/'FCT%'/.test(deadline), deadline.slice(0, 160));
ok('nor the permanent book, none of which ends on a date',
   !/'ECT%'|'ECU%'|'NLE%'|'LB%'|'LIB%'|'CR[I234]%'/.test(deadline), deadline.slice(0, 160));
// The object itself is CLIENT_PORTFOLIO__c and the agent is AGENT__r.Name;
// neither is a client. Anything else that could name one is not asked for.
ok('nothing was asked for that names a client',
   !/Client_|_NAME|Name__c|Email|Insured/i.test(
     all.replace(/CLIENT_PORTFOLIO__c/g, '').replace(/AGENT__r\.Name/g, '')));

/* ── 5. Nothing client-level comes back ──────────────────────────────────── */
console.log('\nAnd nothing client-level is in the answer:\n');
const flat = JSON.stringify(d);
['POLICY__c', 'policy', 'Date_Of_Birth', 'dob', 'client'].forEach(k =>
  ok('no ' + k + ' in the payload', flat.toLowerCase().indexOf(k.toLowerCase()) === -1));
ok('the only names are our own agents',
   (d.agents || []).every(a => ['Anand Pretend', 'Beena Pretend'].indexOf(a.name) > -1));

/* ── 6. When Salesforce does not answer ───────────────────────────────────
   The wall is on all day in a room full of people. A screen that throws is a
   screen showing last week; a screen that says why is a screen somebody
   fixes. */
console.log('\nWhen Salesforce does not answer:\n');
env.sfQuery_ = function () { throw new Error('INVALID_SESSION_ID'); };
const bad = env.iConversionWall_();
ok('it does not throw', !!bad);
ok('it says it is not configured', bad.configured === false);
ok('and it repeats what Salesforce said', /INVALID_SESSION_ID/.test(bad.error || ''), bad.error);

delete env.sfQuery_;
const none = env.iConversionWall_();
ok('with no Salesforce in the project at all, it says so once and not six times',
   none.configured === false && /neither sfQuery_ nor sfkQuery_/.test(none.error || ''), none.error);

/* ── 7. The wall asks without a token ────────────────────────────────────── */
console.log('\nThe wall action needs no sign-in:\n');
env.sfQuery_ = function (soql) { asked.push(soql); return /'FNT%'/.test(soql) ? agg.non : agg.conv; };
const r = JSON.parse(env.intelDoPost_({ postData: { contents: JSON.stringify({ action: 'intel.conversion' }) } })
                        .getContent());
ok('intel.conversion answers', r.ok === true, JSON.stringify(r).slice(0, 160));
ok('and hands back the screen’s data', !!(r.data && r.data.configured));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nAll good.\n');
process.exit(fails ? 1 : 0);
