// The walls: nobody who has left, and the system's day (27 October 2026).
//
// Ricky, 1:19pm: "Kerwyn and Gary as well their team members with exception of felicia is not longer here and not to be
// displayed"; 1:18pm: "the premium due and pendings needs to be real". Pinned here: a unit or agent row of someone who has
// left folds into one "Orphans · to reassign" row with the counts and money summed (the totals stay real); a desk of theirs
// is dropped; a name field, a list of names, a map keyed by name all read Orphans; Felicia stays; the Script Property
// WALL_LEFT replaces the list; doPost passes every intel.* wall feed through it and intel.day carries the system's day.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
env.todayISO_ = () => '2026-10-27';
const O = env.WALL_ORPHANS;
const D = {
  units: [{ k: 'Gary Sookdeo', n: 5, prem: 1351.86, agents: 3 }, { k: 'Kerwyn Ramroach', n: 4, prem: 4885.2, agents: 2 }, { k: 'Ricky Rampersad', n: 2, prem: 3005.57, agents: 2 }, { k: 'Akaash Kalladeen', n: 1, prem: 196.28, agents: 1 }],
  agents: [{ k: 'Anthony Simmons', n: 2, prem: 3810.42, med: 2.6, unit: 'Kerwyn Ramroach' }, { k: 'TRICIA BAKSH', n: 2, prem: 940.58, med: 4.8, unit: 'Gary Sookdeo' },
           { k: 'Premchand Dookran', n: 1, prem: 2418.33, med: 2, unit: 'Ricky Rampersad' }, { k: 'Felicia Rampersad', n: 1, prem: 100, med: 1, unit: 'Gary Sookdeo' }],
  desks: [{ name: 'Ricky Rampersad', closed: 3 }, { name: 'Kerwyn Ramroach', closed: 0 }],
  excluded: ['Aidan Eugene (A01234)', 'Someone Else'],
  byAgent: { 'Chris Badaloo': { n: 3 }, 'Jesus Boodhoo': { n: 2 }, 'Darryl Manick': { n: 4 } },
  headline: { n: 12, prem: 9438.91 } };
const S = env.wallScrub_(JSON.parse(JSON.stringify(D)));
ok('Gary and Kerwyn fold into one Orphans unit, counts and money summed', S.units.length === 3 && S.units[0].k === O && S.units[0].n === 9 && Math.abs(S.units[0].prem - 6237.06) < .01 && S.units[0].agents === 5, JSON.stringify(S.units[0]));
ok('the branch total is untouched', S.headline.n === 12 && S.headline.prem === 9438.91);
ok('their agents fold into one Orphans row; the median is not summed', S.agents[0].k === O && S.agents[0].n === 4 && S.agents[0].med === 4.8 && S.agents[0].unit === O, JSON.stringify(S.agents[0]));
ok('Felicia stays, under Orphans for a unit', S.agents.some(a => a.k === 'Felicia Rampersad' && a.unit === O));
ok('the rest as they were', S.agents.some(a => a.k === 'Premchand Dookran' && a.unit === 'Ricky Rampersad'));
ok('a desk of someone who has left is dropped', S.desks.length === 1 && S.desks[0].name === 'Ricky Rampersad');
ok('a list of names reads Orphans', S.excluded.join('|') === O + '|Someone Else', S.excluded.join('|'));
ok('a map keyed by name folds too', S.byAgent[O] && S.byAgent[O].n === 5 && S.byAgent['Darryl Manick'].n === 4 && !S.byAgent['Chris Badaloo']);
ok('nobody who has left is named anywhere', !/Kerwyn|Gary|Simmons|Baksh|Badaloo|Boodhoo|Eugene/i.test(JSON.stringify(S)), JSON.stringify(S).match(/Kerwyn|Gary|Simmons|Baksh|Badaloo|Boodhoo|Eugene/i));
env.PropertiesService.getScriptProperties().setProperty('WALL_LEFT', 'Premchand Dookran');
const S2 = env.wallScrub_(JSON.parse(JSON.stringify(D)));
ok('the Script Property WALL_LEFT replaces the list', S2.agents.some(a => a.k === 'Anthony Simmons') && !S2.agents.some(a => a.k === 'Premchand Dookran'));
env.PropertiesService.getScriptProperties().deleteProperty('WALL_LEFT');

console.log('\nThrough doPost:\n');
env.intelRoute_ = b => b.action === 'intel.wall' || b.action === 'intel.day' ? env.ContentService.createTextOutput(JSON.stringify({ ok: true, data: D })) : null;
env.workdayTeam_ = () => [{ sid: 'sasha', name: 'Sasha', hours: '8am – 4pm', at: '8:03am', late: 0, absent: false, closed: 6, target: 21, pct: 29, dayPct: 66, overdue: 12, dueToday: 3, list: { of: 10, done: 4 } },
  { sid: 'pawan', name: 'Pawan', hours: '8am – 5pm', at: '', late: 0, absent: true, closed: 0, target: 4, pct: 0, dayPct: 60, overdue: 1, dueToday: 0, list: null }];
const post = a => JSON.parse(env.doPost({ postData: { contents: JSON.stringify({ action: a }) }, parameter: {} }).getContent());
const w = post('intel.wall');
ok('intel.wall comes out scrubbed', w.ok && w.data.units[0].k === O && !/Kerwyn/.test(JSON.stringify(w)));
const d = post('intel.day');
ok('intel.day carries the system\'s day: per desk and the branch', d.data.system && d.data.system.team.length === 2 && d.data.system.closed === 6 && d.data.system.target === 25 && d.data.system.listOf === 10 && d.data.system.listDone === 4 && d.data.system.inNow === 1, JSON.stringify(d.data.system).slice(0, 200));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
