// Increases, group and health, and the wall copies no clock rebuilt (28 October 2026).
//
// Ricky, 11:45am: "please fix the increases and group and individual Health wall this is incorrect". It was the copy built
// on 18 September, two of its health "pendings" were 2,066 and 2,056 days old, and eight increases were one Orphans line.
// Pinned here:
//   - a case past WALL_GRP.OLD_DAYS leaves the pending counts and the lists, and is counted apart as a record to close;
//   - the increases pending figures are worked again from what is left;
//   - a list of cases keeps every row, the departed reading Orphans on each; a list of people still folds;
//   - the feed says when it was read;
//   - keepWarm rebuilds the increases and group copy when it is over the hour old, in the day, with time to spare, and the
//     premium dues copy once in the early morning when its midnight build has not landed.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
env.todayISO_ = () => '2026-10-28';
env.runlog_ = () => {};

const feed = () => ({
  asOf: '2026-10-28 11:49',
  types: [{ key: 'HEALTH', label: 'Individual health', policies: 1278, pending: 15, paying: 280, closed: 182, none: 801, oldest: 2066, states: { reqts: 4, uw: 11 } },
          { key: 'HEALTH (GROUP)', label: 'Group health', policies: 524, pending: 2, paying: 123, closed: 3, none: 396, oldest: 21, states: { uw: 2 } }],
  totals: { policies: 1802, pending: 17, paying: 403, closed: 185, none: 1197 },
  rows: [{ type: 'HEALTH', label: 'Individual health', who: 'Satesh Samaroo', status: 'Underwriting incomplete, Missing Reqts', state: 'reqts', days: 2066 },
         { type: 'HEALTH', label: 'Individual health', who: 'Jonathan Hart', status: 'Underwriting incomplete, Missing Reqts', state: 'reqts', days: 2056 },
         { type: 'HEALTH', label: 'Individual health', who: 'Fawwaz Mohamed', status: 'Underwriting incomplete', state: 'uw', days: 55 },
         { type: 'HEALTH (GROUP)', label: 'Group health', who: 'Ricky Rampersad', status: 'Pending', state: 'uw', days: 21 }],
  increases: { book: { rows: 1126, paying: 1069, payingApi: 1916612, npw: 17, blank: 38 }, year: { n: 62, api: 414363 },
    pending: { n: 5, api: 9000, prem: 0, oldest: 728, noDocs: 5, reqts: 0 },
    rows: [{ who: 'Gary Sookdeo', support: 'Jenny', state: 'settle', status: 'Underwriting complete, Missing Settlement Reqts', days: 728, api: 4473, prem: 0, reqt: '', docs: false },
           { who: 'Gary Sookdeo', support: 'Azariah', state: 'uw', status: 'Pending', days: 40, api: 1200, prem: 0, reqt: '', docs: false },
           { who: 'Aidan Eugene', support: 'Azariah', state: 'uw', status: 'Pending', days: 30, api: 800, prem: 0, reqt: 'Medical', docs: false },
           { who: 'Randolph Gonzales', support: 'Azariah', state: 'reqts', status: 'Underwriting incomplete, Missing Reqts, Error on Policy', days: 684, api: 0, prem: 0, reqt: '', docs: false },
           { who: 'Ricky Rampersad', support: 'Elizabeth', state: 'uw', status: 'Pending', days: 0, api: 50, prem: 0, reqt: '', docs: true }] },
  held: 0, notes: [] });

console.log('\nWhat is really pending:\n');
const d = env.wallGroupsTidy_(feed(), '2026-10-28 11:49');
const H = d.types.find(t => t.key === 'HEALTH');
ok('the two health cases from 2020 leave the pending count, and are counted apart', H.pending === 13 && H.old === 2 && d.totals.pending === 15 && d.old.n === 2 && d.old.oldest === 2066, JSON.stringify({ p: H.pending, old: H.old, tot: d.totals.pending, o: d.old }));
ok('and leave the list; the oldest is now the oldest real one', d.rows.length === 2 && H.oldest === 55 && H.states.reqts === 2, JSON.stringify(d.rows.map(r => r.days)));
ok('increases past a year are counted apart; the pending figures worked again', d.increases.pending.n === 3 && d.increases.pending.api === 2050 && d.increases.pending.oldest === 40 && d.increases.pending.noDocs === 2 && d.increases.pending.reqts === 1 && d.old.inc === 2 && d.old.incApi === 4473 && d.old.incOldest === 728, JSON.stringify({ p: d.increases.pending, o: d.old }));
ok('the feed says when it was read', d.builtAt === '2026-10-28 11:49');

console.log('\nThrough the scrub:\n');
const s = env.wallScrub_(env.wallGroupsTidy_(feed(), '2026-10-28 11:49'));
ok('a list of cases keeps every row: two of Gary\'s and Aidan\'s one each read Orphans', s.increases.rows.length === 3 && s.increases.rows.filter(r => r.who === env.WALL_ORPHANS).length === 2, JSON.stringify(s.increases.rows.map(r => r.who)));
ok('and a single row by someone who has left is renamed, not dropped', s.rows.length === 2 && !JSON.stringify(s).match(/Gary|Aidan|Jonathan Hart/));
const people = env.wallScrub_({ agents: [{ k: 'Aidan Eugene', n: 2 }, { k: 'Tricia Baksh', n: 3 }, { k: 'Varun Seegolam', n: 4 }] });
ok('a list of people still folds into one Orphans row, counts summed', people.agents.length === 2 && people.agents.find(a => a.k === env.WALL_ORPHANS).n === 5, JSON.stringify(people.agents));

console.log('\nThe clock (keepWarm):\n');
const P = env.PropertiesService.getScriptProperties();
let stored = { groups: '2026-10-28 09:10', wall45: '2026-10-26 00:44' }, built = [], dues = 0;
env.iTz_ = () => 'America/Port_of_Spain';
env.iWallLoad_ = key => stored[key] ? { builtAt: stored[key], payload: {} } : null;
env.iWallSave_ = (key) => { built.push(key); stored[key] = 'now'; return 'now'; };
env.iGroupsWall_ = () => ({ types: [] });
env.intelRebuildWall45 = () => { dues++; return 'wall45 built'; };
const at = (hh, mm) => { const real = env.Utilities.formatDate; return (d0, tz, f) => f === 'H' ? String(hh) : f === 'yyyy-MM-dd HH:mm' ? '2026-10-28 ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') : real(d0, tz, f); };
const realFmt = env.Utilities.formatDate;
env.Utilities.formatDate = at(11, 50);
env.wallFeedsTick_(Date.now());
ok('11:50, the copy built at 9:10: rebuilt', built.join() === 'groups', built.join());
built = []; stored.groups = '2026-10-28 11:20'; env.wallFeedsTick_(Date.now());
ok('half an hour old: left alone', built.length === 0);
env.Utilities.formatDate = at(20, 5); stored.groups = '2026-10-28 09:10'; env.wallFeedsTick_(Date.now());
ok('after six: left to the morning', built.length === 0);
env.Utilities.formatDate = at(12, 0); env.wallFeedsTick_(Date.now() - 200000);
ok('a run with no time to spare leaves it to the next', built.length === 0);
env.Utilities.formatDate = at(5, 20); P.deleteProperty('wall45_catch'); env.wallFeedsTick_(Date.now());
ok('5:20, the dues copy from Monday: built now, once', dues === 1, String(dues));
env.wallFeedsTick_(Date.now());
ok('and not again that day', dues === 1);
env.Utilities.formatDate = realFmt;
ok('keepWarm carries it', /wallFeedsTick_\(kw0\)/.test(env.keepWarm.toString()));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
