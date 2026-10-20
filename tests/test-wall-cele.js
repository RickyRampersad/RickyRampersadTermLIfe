// Celebrations on the wall (20 October 2026, 2026-10-20l).
//
// Ricky, 6:40pm: "and want celebrations added". The wall's staff feed now
// carries, for each person in the game, their top skill and level, any level
// reached today, and today's thank-yous, so the wall can celebrate them
// (confetti, a card, the Shout-outs scene). Pinned here: a level counts as
// reached today only when today's work took it over the line; earlier levels
// are not celebrated again; thank-yous from other days do not count; the
// running feed says who levelled up; and outside gets the same wins (they are
// wins only, never a shortfall).
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-20';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes'],
   ['Pawan Probhu', 'pawan', 'pawan@example.com', '1', 'Personal Assistant', 'Branch', 'Yes']]);
const base = { par: 8, parDone: 8, parMet: true, quests: 1, questList: [1, 2, 3], qp: 0, points: 20, last: 14 * 60 + 5, inAt: '07:00' };
// Elizabeth: 13 premium fixes before today, 3 today: level 1 -> 2 today. Azariah: 40 claims before, 1 today: level 3 already.
env.gameToday_ = () => ({ elizabeth: Object.assign({}, base, { kinds: { paidto: 3 } }), azariah: Object.assign({}, base, { parMet: false, kinds: { claim: 1 } }) });
env.gameHist_ = () => ({ elizabeth: { '2026-10-19': { work: 10, kinds: { paidto: 13 } } }, azariah: { '2026-10-19': { work: 10, kinds: { claim: 40 } } } });
env.gameCloses_ = () => [];
env.gameStreak_ = () => ({ n: 5 });
env.gameThanksTo_ = sid => sid === 'elizabeth' ? [{ from: 'sasha', day: DAY }, { from: 'kamla', day: '2026-10-19' }] : [];
env.rateStats_ = () => ({ all: { n: 0 }, list: [], by: {} });
env.scheduleFor_ = () => ({ hours: '7:00-3:00' });

for (const outside of [false, true]) {
  const w = env.wallStaff_(DAY, outside), by = {}; w.people.forEach(p => by[p.sid] = p);
  const tag = outside ? 'outside: ' : 'inside: ';
  ok(tag + 'top skill and level', by.elizabeth.topSkill && by.elizabeth.topSkill.name === 'Premium fixer' && by.elizabeth.topSkill.lvl === 2 && by.azariah.topSkill.name === 'Claims' && by.azariah.topSkill.lvl === 3, JSON.stringify([by.elizabeth.topSkill, by.azariah.topSkill]));
  ok(tag + 'a level reached today is a level-up', by.elizabeth.levelUps.length === 1 && by.elizabeth.levelUps[0].lvl === 2, JSON.stringify(by.elizabeth.levelUps));
  ok(tag + 'a level reached before today is not celebrated again', by.azariah.levelUps.length === 0);
  ok(tag + "only today's thank-yous", by.elizabeth.thanks === 1 && by.azariah.thanks === 0);
  ok(tag + 'nobody out of the game gets them', !('levelUps' in (by.pawan || {})));
  ok(tag + 'the feed says who levelled up and who was thanked', w.events.some(e => e.who === 'Elizabeth' && /levelled up: Premium fixer, level 2/.test(e.what)) && w.events.some(e => e.who === 'Elizabeth' && /thanked for covering/.test(e.what)));
}
env.gameToday_ = () => null;
const quiet = env.wallStaff_(DAY, false), q = quiet.people.find(p => p.sid === 'elizabeth');
ok('before anything is read today: no level-ups, the top skill from the saved days', q.levelUps.length === 0 && q.topSkill && q.topSkill.lvl === 1);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
