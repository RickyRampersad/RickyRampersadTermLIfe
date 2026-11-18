// What the record shows about how we work — and who may see which half of it.
//
// 10 November 2026, the branch manager: "calling out the agents, observing the
// strengths, the weakness ... that's the only way we can actually look at how we
// train and skills and drills", and, of the staff who sit through a meeting
// without contributing, "between me and you".
//
// What it holds the two scripts to:
//   the read      strength, watch and drill come from a person's OWN projection
//                 and their OWN normal — never from anybody else's;
//                 thin evidence says so rather than reading as a verdict;
//                 the drills roll up with counts and NO NAMES.
//   who sees it   staff and managers get the per-person read; an agent gets the
//                 drills and nothing about any person, including themselves;
//                 the run of quiet meetings reaches staff and managers only.
//   away          a meeting somebody apologised for is not counted as silence.
//
// Run: node tests/test-observed.js
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra !== undefined && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

/* ── the tracker's read ─────────────────────────────────────────────────── */
console.log('\nhow a person is read');
const fs = require('fs');
const kpi = fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8');
const lift = names => {
  let src = '';
  names.forEach(n => {
    const re = new RegExp('\\n(?:var ' + n + ' = |function ' + n + '\\s*\\()');
    const i = kpi.search(re);
    if (i < 0) throw new Error('not found: ' + n);
    let j = kpi.indexOf('\n}', i); if (/^var /.test(kpi.slice(i + 1, i + 5))) j = kpi.indexOf('\n};', i) + 1;
    src += kpi.slice(i, j + 2) + '\n';
  });
  return src;
};
const env = {};
new Function('G', lift(['OBS', 'OBS_DRILL', 'AGENT_METRICS', 'agBalance_', 'obsAgent_', 'obsDesk_']) +
  ';G.OBS=OBS;G.obsAgent_=obsAgent_;G.obsDesk_=obsDesk_;G.OBS_DRILL=OBS_DRILL;')(env);

const days = ['2026-11-10','2026-11-09','2026-11-06','2026-11-05','2026-11-04',
              '2026-11-03','2026-11-02','2026-10-30','2026-10-29','2026-10-28'];
const day = (plan, done) => {
  const mk = o => { const r = {}; Object.keys(o).forEach(k => { r[k] = {}; }); return r; };
  const p = {}, c = {};
  Object.keys(plan || {}).forEach(k => { p[k] = { Planned: plan[k] }; });
  Object.keys(done || {}).forEach(k => { c[k] = { Done: done[k] }; });
  return { plan: p, close: c };
};

//  somebody who plans and lands it
const lands = {}; days.forEach(d => { lands[d] = day({ calls: 10, ff: 2 }, { calls: 10, ff: 2 }); });
const a1 = env.obsAgent_('One', lands, days);
ok('planning and landing it reads as a strength', /lands it/.test(a1.strength || ''), JSON.stringify(a1.strength));
ok('and nothing is flagged to drill', !a1.train, a1.train);

//  somebody who never projects
const a2 = env.obsAgent_('Two', { '2026-11-10': day({ calls: 5 }, { calls: 5 }),
  '2026-11-09': day({ calls: 5 }, { calls: 5 }), '2026-11-06': day({ calls: 5 }, { calls: 5 }) }, days);
ok('a day that is rarely projected is the watch', /projected 3 of 10/.test(a2.watch || ''), a2.watch);
ok('and the drill is projecting the day', /Projecting the day/.test(a2.train || ''), a2.train);

//  somebody who projects an activity and never does it
const never = {}; days.forEach(d => { never[d] = day({ calls: 10, close: 2 }, { calls: 10, close: 0 }); });
const a3 = env.obsAgent_('Three', never, days);
ok('an activity projected and never done is named', /Closing interviews projected 20, none done/.test(a3.watch || ''), a3.watch);
ok('and its own drill comes with it', /closing interview/i.test(a3.train || ''), a3.train);
ok('their strength is still said first', !!a3.strength, a3.strength);

//  thin evidence is said to be thin, not read as a verdict
const a4 = env.obsAgent_('Four', { '2026-11-10': day({ calls: 3 }, null) }, days);
ok('one day on the record is called thin, not weak', a4.thin && /Little on the record/.test(a4.watch), a4.watch);
ok('and nothing about their work is claimed', !a4.strength, a4.strength);

//  NOTHING in a read mentions anybody else
const all = [a1, a2, a3, a4];
/*  "Does more than is projected" compares a person with their OWN projection,
    which is the rule, not a breach of it — the first cut of this check matched
    the bare word "than" and failed on it. The words that would mean somebody
    else are these. */
ok('NOBODY IS COMPARED WITH ANYBODY ELSE',
  all.every(x => !/than (the|his|her|their|everyone|the rest|average)|ahead of (the|everyone)|best|worst|top (performer|of)|bottom|rank|fewest|most of (the|any)|compared with/i.test(
    [x.strength, x.watch].filter(Boolean).join(' '))),
  JSON.stringify(all.map(x => [x.strength, x.watch])));
ok('and no read mentions another person by name',
  all.every(x => !/\b(One|Two|Three|Four)\b/.test([x.strength, x.watch, x.train].filter(Boolean).join(' '))),
  JSON.stringify(all.map(x => [x.strength, x.watch])));

console.log('\na desk');
const d1 = env.obsDesk_({ name: 'A', today: 5, normal: 9, recent: 10, overdue: 2, stale: 0 });
ok('ahead of their own normal is the strength', /own normal/.test(d1.strength || ''), d1.strength);
const d2 = env.obsDesk_({ name: 'B', today: 1, normal: 9, recent: 4, overdue: 14, stale: 7 });
ok('tasks with nothing written on them come first', /nothing written/.test(d2.watch || ''), d2.watch);
ok('with the note drill', /note on every task/.test(d2.train || ''), d2.train);

/* ── who may see which half ─────────────────────────────────────────────── */
console.log('\nwho sees it');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Meetings.gs');
const { makeEnv } = require('./harness');
const m = makeEnv();
const pack = { ok: true, asOf: '7:02', production: { policies: 5 }, observed: {
  days: 10, from: 'a', to: 'b', plannedShare: 58,
  train: [{ point: 'The closing interview', n: 4 }],
  agents: [{ name: 'Agent One', watch: 'Calls — 22 of 60', train: 'Call reluctance' }],
  desks: [{ name: 'Support Two', watch: '14 past their date' }]
} };
const asAgent = m.packFor_(pack, { role: 'agent', email: 'a@x', name: 'Agent One' });
ok('an agent gets the branch\'s figures', asAgent.production && asAgent.production.policies === 5);
ok('and the drills, which carry no names',
  asAgent.observed.train.length === 1 &&
  !JSON.stringify(asAgent.observed.train).match(/Agent One|Support Two/),
  JSON.stringify(asAgent.observed.train));
ok('AN AGENT IS SENT NOTHING ABOUT ANY PERSON, INCLUDING THEMSELVES',
  !asAgent.observed.agents && !asAgent.observed.desks &&
  !/Agent One|Support Two/.test(JSON.stringify(asAgent)),
  JSON.stringify(asAgent.observed));
const asStaff = m.packFor_(pack, { role: 'staff', email: 's@x', name: 'Support One' });
ok('staff and managers get the per-person read',
  asStaff.observed.agents.length === 1 && asStaff.observed.desks.length === 1);
ok('the original is not changed by reading it as an agent',
  pack.observed.agents.length === 1);
ok('no pack at all is handled', m.packFor_(null, { role: 'agent' }) === null);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passing');
process.exit(fails ? 1 : 0);
