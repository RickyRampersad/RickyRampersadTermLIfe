// The 5am report and the register, as set on 19 October 2026.
//
// Every report goes out from 5am. At the end of it the person presses
// "ready to start my day": before their own start is early, on the start
// minute on time, after it late. Not pressed by the start reads absent until
// they press. Near the top, how the week, the month and the quarter are going.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Kamla Dookran','kamla','kamla@example.com','1',"Branch Manager's Assistant",'Branch','Yes'],
   ['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);

console.log('\nEarly, on time, late, against each person\'s own start:\n');
ok('Kamla starts at 8', env.startFor_('kamla') === 480);
ok('Sasha starts at 7', env.startFor_('sasha') === 420);
ok('Kamla at 7:00 is early', env.attWord_('kamla', '07:00') === 'early');
ok('Kamla at 8:00 is on time', env.attWord_('kamla', '08:00') === 'on time');
ok('Kamla at 8:01 is late, by a minute', env.attWord_('kamla', '08:01') === 'late' && env.lateBy_('kamla', '08:01') === 1);
ok('Sasha at 7:00 is on time', env.attWord_('sasha', '07:00') === 'on time');
ok('Sasha at 7:30 is late', env.attWord_('sasha', '07:30') === 'late');

console.log('\nNot pressed by the start reads absent, from the minute after:\n');
const marked = [];
env.autoAbsentOn_ = () => true;
env.writeAutoAbsent_ = (sid) => { marked.push(sid); return true; };
env.PropertiesService.getScriptProperties().deleteAllProperties && env.PropertiesService.getScriptProperties().deleteAllProperties();
env.autoAbsentTick_('2026-10-19', 480, {}, {});
ok('at 8:00 exactly, Kamla is not yet absent', marked.indexOf('kamla') === -1, JSON.stringify(marked));
env.autoAbsentTick_('2026-10-19', 481, {}, {});
ok('at 8:01, Kamla reads absent', marked.indexOf('kamla') > -1, JSON.stringify(marked));
const before = marked.length;
env.autoAbsentTick_('2026-10-19', 482, { azariah: 1 }, {});
ok('and she is not marked twice', marked.filter(x => x === 'kamla').length === 1);

console.log('\nThe button at the end of the report:\n');
const card = env.startDayCard_('kamla', '2026-10-19', 480);
ok('it says what pressing does', /records you present/.test(card) && /before 8(:00)?\s?am is early/i.test(card), card.slice(0, 200));
ok('and links to her own page', /f=in/.test(card) && /rs=kamla/.test(card));

console.log('\nThe week, the month and the quarter:\n');
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ kamla: { id: '005K' } });
env.sfkQuery_ = (q) => {
  if (!/DAY_ONLY/.test(q)) return [];
  return [
    { d: '2026-10-12', n: 4 }, { d: '2026-10-13', n: 2 },             // last week, Mon and Tue
    { d: '2026-10-19', n: 99 },                                         // today: not counted
    { d: '2026-10-16', n: 3 },                                          // this month, last week Fri
    { d: '2026-09-02', n: 5 },                                          // last month
    { d: '2026-10-01', n: 1 }                                           // this month and quarter
  ];
};
const s = env.periodStats_('kamla', '2026-10-19');
ok('Salesforce answered', s.ok === true);
ok('this week is nothing yet on a Monday morning', s.week === 0, JSON.stringify(s));
ok('this month counts to yesterday, not today', s.month === 4 + 2 + 3 + 1, JSON.stringify(s));
ok('last month counts the same days', s.lastMonth === 5, JSON.stringify(s));
ok('the quarter starts on 1 October', s.quarter === 10, JSON.stringify(s));
const strip = env.periodStrip_('kamla', '2026-10-19');
ok('the strip shows the week, month, quarter and attendance', /This week/.test(strip) && /This month/.test(strip) && /This quarter/.test(strip) && /Attendance this month/.test(strip));
env.sfkConfigured_ = () => false;
env.CacheService.getScriptCache().remove('period_kamla_2026-10-20');
const strip2 = env.periodStrip_('kamla', '2026-10-20');
ok('without Salesforce it says so rather than showing noughts', /did not answer/.test(strip2));

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
