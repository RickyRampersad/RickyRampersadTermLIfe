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
const decode = c => { const f = env.iConvPlan_(c); return f ? f.code + (f.convertible ? '+' : '-') : 'null'; };
[['FCT65 1', 'FCT+'], ['FCT651', 'FCT+'], ['FCT65', 'FCT+'], ['FCT5  1', 'FCT+'], ['FCT20 1', 'FCT+'],
 ['ECT65 1', 'ECT+'], ['ECT851', 'ECT+'], ['ECU65 1', 'ECU+'],
 ['FNT85 1', 'FNT-'], ['FNT851', 'FNT-'], ['FNT81', 'FNT-'], ['FNT75', 'FNT-'],
 ['fnt85 1', 'FNT-'],
 ['LIFEV 1', 'null'], ['LIFE EVOLUTION LIBERATOR', 'null'], ['Homeowners', 'null'],
 ['Motor', 'null'], ['ECT', 'null'], ['', 'null'], [null, 'null']
].forEach(([code, want]) => ok(String(code) + ' → ' + want, decode(code) === want, decode(code)));

/* ── 2. The reader and the filter are one fact ────────────────────────────
   The screen decodes plan codes in JavaScript and asks Salesforce for them in
   SOQL. If somebody adds a family to one and not the other the wall quietly
   under-counts, so the SOQL is generated from the same table the reader uses
   and this checks both directions. */
console.log('\nThe SOQL asks for exactly the families the reader calls convertible:\n');
const yes = env.iConvLike_(true), no = env.iConvLike_(false);
ok('convertible filter names FCT, ECT, ECU', /FCT%/.test(yes) && /ECT%/.test(yes) && /ECU%/.test(yes), yes);
ok('convertible filter never names FNT', !/FNT/.test(yes), yes);
ok('non-convertible filter is FNT and nothing else', /FNT%/.test(no) && !/FCT|ECT|ECU/.test(no), no);
ok('every family in the table appears in one filter or the other',
   env.ICONV_FAMILIES.every(f => (f.convertible ? yes : no).indexOf(f.code + '%') > -1));

/* ── 3. The book, as Salesforce would answer it ───────────────────────────
   Invented throughout. No client of this branch is in this repository. The
   stub records which SOQL it was asked for, because the filters are as much
   the subject of this test as the arithmetic. */
const asked = [];
const agg = {
  agents: [{ ag: 'Anand Pretend', n: 9,  cover: 24000000, prem: 12000, top: 9000000 },
           { ag: 'Beena Pretend', n: 4,  cover: 6000000,  prem: 3000,  top: 3000000 },
           { ag: 'Gone Away',     n: 7,  cover: 18000000, prem: 9000,  top: 8000000 },
           { ag: null,            n: 2,  cover: 1000000,  prem: 500,   top: 500000 }],
  ahead:  [{ n: 6, cover: 15000000 }],
  mix:    [{ pc: 'FCT65 1', n: 5, cover: 12000000 }, { pc: 'FCT651', n: 3, cover: 8000000 },
           { pc: 'FCT65',   n: 1, cover: 4000000 },  { pc: 'ECT65 1', n: 4, cover: 6000000 },
           { pc: 'WHO KNOWS', n: 2, cover: 1000000 }],
  conv:   [{ n: 1172, cover: 1687790726, prem: 900000 }],
  non:    [{ n: 39,   cover: 85100000,   prem: 139941 }],
  soon:   [{ yr: 2028, n: 3, cover: 3600000 }, { yr: 2029, n: 5, cover: 4000000 },
           { yr: 2035, n: 7, cover: 7700000 }]
};
env.sfQuery_ = function (soql) {
  asked.push(soql);
  if (/GROUP BY AGENT__r.Name/.test(soql))          return agg.agents;
  if (/DAY_IN_MONTH/.test(soql))                    return agg.ahead;
  if (/GROUP BY Life_Plan_01__c/.test(soql))        return agg.mix;
  if (/CALENDAR_YEAR/.test(soql))                   return agg.soon;
  if (/FNT%/.test(soql))                            return agg.non;
  return agg.conv;
};

console.log('\nWhat the wall is handed:\n');
const d = env.iConversionWall_();
ok('it is configured', d.configured === true, d.error || '');
ok('the month is the month we are in', d.month === 'September', d.month);
ok('an excluded agent is not on the wall', !(d.agents || []).some(a => a.name === 'Gone Away'));
ok('and their cover is not in the total', d.head.cover === 30000000, String(d.head.cover));
ok('nor their cases', d.head.cases === 13, String(d.head.cases));
ok('a policy with no agent against it is counted, not hidden', d.head.unnamed === 2, String(d.head.unnamed));
ok('the urgent half is the birthdays still to come', d.head.ahead.n === 6 && d.head.ahead.cover === 15000000);
ok('agents are ranked by cover', d.agents[0].name === 'Anand Pretend');
ok('each agent carries their biggest single case', d.agents[0].top === 9000000, String(d.agents[0].top));
ok('three typings of one product are one chip',
   (d.mix.filter(m => m.code === 'FCT').length === 1) &&
   (d.mix.find(m => m.code === 'FCT') || {}).n === 9,
   JSON.stringify(d.mix.map(m => m.code + ':' + m.n)));
ok('a plan code nobody can read is said out loud, not dropped silently',
   (d.notes || []).some(s => /cannot read/.test(s)), JSON.stringify(d.notes));
ok('the pool and the book with no right at all are both there',
   d.pool.conv.n === 1172 && d.pool.nonconv.n === 39);
ok('the deadline list totals its years', d.soonTotal.n === 15 && d.soonTotal.cover === 15300000,
   JSON.stringify(d.soonTotal));

/* ── 4. What was asked of Salesforce ─────────────────────────────────────── */
console.log('\nWhat it asked Salesforce for:\n');
const all = asked.join('\n');
ok('only policies still paying', asked.every(q => /PREMIUM PAYING/.test(q)), String(asked.length) + ' queries');
ok('only cover that has not already expired', asked.every(q => /Life_Coverage_Expiry__c >= TODAY/.test(q)));
ok('this month’s birthdays, by month number', /CALENDAR_MONTH\(Date_Of_Birth__c\) = 9/.test(all));
ok('the urgent half, by day of month', /DAY_IN_MONTH\(Date_Of_Birth__c\) >= 11/.test(all));
/* Evolution's expiry date is the plan's maturity, not the term's end — an
   ECT65 on a client born in 2002 expires in 2102. A countdown that included
   it would be arithmetic on the wrong date. */
const deadline = asked.filter(q => /CALENDAR_YEAR/.test(q))[0] || '';
ok('the deadline counts down Flexi only, never Evolution',
   /LIKE 'FCT%'/.test(deadline) && !/LIKE 'ECT%'|LIKE 'ECU%'/.test(deadline), deadline.slice(0, 120));
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
env.sfQuery_ = function (soql) { asked.push(soql); return /FNT%/.test(soql) ? agg.non : agg.conv; };
const r = JSON.parse(env.intelDoPost_({ postData: { contents: JSON.stringify({ action: 'intel.conversion' }) } })
                        .getContent());
ok('intel.conversion answers', r.ok === true, JSON.stringify(r).slice(0, 160));
ok('and hands back the screen’s data', !!(r.data && r.data.configured));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nAll good.\n');
process.exit(fails ? 1 : 0);
