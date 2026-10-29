// The noon and three o'clock nudges read the day as it is kept now (28 October 2026, 2026-10-28c).
//
// Ricky, 12:38pm, with Kamla's noon "Your day is not planned": "this triggered despite persons working today". Both
// nudges asked only whether the old time blocks (gone since 17 October) had text. Pinned here:
//   noon  signed in, planned (at check-in or on the plan page), or anything done in Salesforce: nothing sent; only
//         somebody with none of these hears "You have not checked in today"; marked absent: nothing;
//   3pm   only somebody at work today with nothing closed or noted in Salesforce and nothing logged; nobody who is not in,
//         nobody whose day has ended, and nobody at all when Salesforce does not answer.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
env.todayISO_ = () => '2026-10-28';
env.hhmm_ = () => '15:05';             // the 3pm run

const people = ['kamla', 'pawan', 'sasha', 'azariah', 'elizabeth'].map(s => ({ staffId: s, name: s[0].toUpperCase() + s.slice(1) }));
env.publicRoster_ = () => people;
let ATT = [], PLANS = {}, SF = {}, SFDOWN = false, HOURS = {}, sent = [];
env.attSheet_ = () => 'att';
env.sheetObjects_ = () => ATT;
env.planRows_ = sid => PLANS[sid] || {};
env.blocksSubmittedOn_ = () => [];
env.deskToday_ = () => { if (SFDOWN) throw new Error('Salesforce did not answer'); return SF; };
env.scheduleFor_ = sid => ({ hours: HOURS[sid] || '', blocks: { KPI1: { time: '8am – 5pm', focus: 'Your day' } } });
env.nudge_ = (sid, date, missing, heading) => { sent.push(sid + ':' + heading); return true; };

const reset = () => {
  ATT = [{ Date: '2026-10-28', StaffId: 'kamla', FirstSignIn: '07:58', Status: 'in' },
         { Date: '2026-10-28', StaffId: 'elizabeth', FirstSignIn: '', Status: 'absent' }];
  PLANS = { kamla: { KPI1: { Items: JSON.stringify([{ k: 'sf', id: '00T1', subject: 'x', type: 'y' }]), Note: 'Set by the system at check-in, 7:58am' } },
            pawan: { KPI1: { Items: '[]', Note: '', PlannedAt: '2026-10-28 08:20' } } };
  SF = { kamla: { closed: 0, notes: 0 }, pawan: { closed: 0, notes: 0 }, sasha: { closed: 3, notes: 1 }, azariah: { closed: 0, notes: 0 }, elizabeth: { closed: 0, notes: 0 } };
  SFDOWN = false; HOURS = {}; sent = [];
};

console.log('\nNoon:\n');
reset();
let msg = env.remindMidday();
ok('Kamla, checked in at 7:58 with her day set, hears nothing', !sent.some(x => /^kamla/.test(x)), sent.join());
ok('nor Pawan, who planned on his page, nor Sasha, three closed in Salesforce', !sent.some(x => /^(pawan|sasha)/.test(x)), sent.join());
ok('nor Elizabeth, marked absent', !sent.some(x => /^elizabeth/.test(x)));
ok('only Azariah, with no check-in, no plan and nothing done, hears "You have not checked in today"', sent.join() === 'azariah:You have not checked in today', sent.join());
ok('the run says who was at work', /at work, not nudged: Kamla, Pawan, Sasha/.test(msg), msg);
reset(); env.PropertiesService.getScriptProperties().setProperty('daystart_plan_azariah_2026-10-28', '1|0'); env.remindMidday();
ok('the day-start mark counts as planned', sent.length === 0, sent.join());
env.PropertiesService.getScriptProperties().deleteProperty('daystart_plan_azariah_2026-10-28');

console.log('\nThree o\'clock:\n');
reset();
ATT.push({ Date: '2026-10-28', StaffId: 'sasha', FirstSignIn: '08:05', Status: 'in' }, { Date: '2026-10-28', StaffId: 'pawan', FirstSignIn: '08:20', Status: 'in' });
SF.sasha = { closed: 0, notes: 0 }; SF.kamla = { closed: 4, notes: 2 };
PLANS.pawan.KPI1.Achieved = 3;
env.remindCheckpoint();
ok('Kamla, four closed today, hears nothing', !sent.some(x => /^kamla/.test(x)), sent.join());
ok('nor Pawan, progress logged on his plan', !sent.some(x => /^pawan/.test(x)), sent.join());
ok('nor Azariah, who is not in (noon told him), nor Elizabeth, absent', !sent.some(x => /^(azariah|elizabeth)/.test(x)), sent.join());
ok('only Sasha, in since 8:05 with nothing closed or noted, hears "Your day is not logged"', sent.join() === 'sasha:Your day is not logged', sent.join());
reset(); ATT.push({ Date: '2026-10-28', StaffId: 'sasha', FirstSignIn: '08:05', Status: 'in' }); SF.sasha = { closed: 0, notes: 0 }; SFDOWN = true; env.remindCheckpoint();
ok('when Salesforce does not answer, nobody is chased', sent.length === 0, sent.join());
reset(); ATT.push({ Date: '2026-10-28', StaffId: 'sasha', FirstSignIn: '07:00', Status: 'in' }); SF.sasha = { closed: 0, notes: 0 }; HOURS.sasha = '7am – 12pm'; env.remindCheckpoint();
ok('nor somebody whose day has already ended', !sent.some(x => /^sasha/.test(x)), sent.join());

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
