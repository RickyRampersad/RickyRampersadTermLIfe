// Every agent, live (2 November 2026, 2026-10-29g).
//
// Ricky, 6:42am: "the agents are not supposed to more or less be in draft now ... I presented last Friday and let the agents
// know from today. Their check-ins have been sent." Pinned here:
//   - from 2 November every agent gets their own morning, midday and 5:30 mail, with no AGENT_DAY set; no [Preview] samples
//   - an agent who had only a preview sample this morning still gets their own mail in the morning window
//   - before 2 November nothing changes (the five, and three samples to him); AGENT_DAY = pilot goes back; off stops it
//   - the fact-find chase does not start because of this
//   - nobody who has left is mailed, and nobody who has left is copied (Felicia, once in Gary's unit: the Branch Manager)
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
let DAY = '2026-11-02';
const env = makeEnv();
env.todayISO_ = () => DAY;
const P = env.PropertiesService.getScriptProperties();
P.setProperty('MANAGER_EMAIL', 'ricky@example.com');

console.log('\nWho is an agent here, from the Skill Bank:\n');
const row = (name, code, role, unit, active) => ({ code, name, role, unit, email: name.split(' ')[0].toLowerCase() + '@example.com', active,
  isAgent: /^agent$/i.test(role), isUM: /unit manager/i.test(role), isStaff: false });
const bank = {};
[row('Akaash Kalladeen', 'A09088', 'Unit Manager', 'Akaash Kalladeen', true),
 row('Gary Sookdeo', 'A04020', 'Unit Manager', 'Gary Sookdeo', true),
 row('Neil Ramnanan', 'A10024', 'Agent', 'Akaash Kalladeen', true),
 row('Narissa Mohammed', 'A01066', 'Agent', 'Ricky Rampersad', true),
 row('Felicia Rampersad', 'A12001', 'Agent', 'Gary Sookdeo', true),
 row('Alyssa Joseph', 'A12530', 'Agent', 'Gary Sookdeo', true),
 row('Anthony Simmons', 'A06869', 'Agent', 'KERWYN RAMROACH UNIT-CHAGUANAS REG CEN', true),
 row('Varun Seegolam', 'A10428', 'Agent', 'Ricky Rampersad', false)].forEach(p => { bank[env.bkNk_(p.name)] = p; });
env.skillBank_ = () => bank;
const people = env.agentPeople_();
const names = Object.keys(people).map(k => people[k].name).sort();
ok('the agents still here, Active: Felicia, Narissa, Neil', JSON.stringify(names) === JSON.stringify(['Felicia Rampersad', 'Narissa Mohammed', 'Neil Ramnanan']), JSON.stringify(names));
ok('nobody who has left, even marked Active (Alyssa, Anthony); nor anyone Inactive (Varun)', !names.some(n => /Alyssa|Anthony|Varun/.test(n)));
ok('Neil\'s copy goes to Akaash', people['a-neil-ramnanan'].manager === 'akaash@example.com');
ok('Felicia\'s copy goes to nobody who has left: the Branch Manager', people['a-felicia-rampersad'].manager === '' && env.agentManagerEmail_(people['a-felicia-rampersad']) === 'ricky@example.com',
  people['a-felicia-rampersad'].manager + ' / ' + env.agentManagerEmail_(people['a-felicia-rampersad']));
bank[env.bkNk_('Akaash Kalladeen')].active = false;
ok('nor a Unit Manager marked Inactive', env.agentPeople_()['a-neil-ramnanan'].manager === '');
bank[env.bkNk_('Akaash Kalladeen')].active = true;

console.log('\nThe switch:\n');
ok('from 2 November, with nothing set: live', env.agentMode_() === 'live');
ok('every agent is live', Object.keys(people).every(k => env.agentLiveFor_(people[k])));
DAY = '2026-10-30';
ok('before 2 November: as it was, the pilot', env.agentMode_() === 'preview' && !env.agentLiveFor_(people['a-narissa-mohammed']) && env.agentLiveFor_(people['a-neil-ramnanan']));
DAY = '2026-11-02';
P.setProperty('AGENT_DAY', 'pilot');
ok('AGENT_DAY = pilot goes back to the five', env.agentMode_() === 'preview' && !env.agentLiveFor_(people['a-narissa-mohammed']) && env.agentLiveFor_(people['a-neil-ramnanan']));
P.setProperty('AGENT_DAY', 'off');
ok('AGENT_DAY = off stops it', env.agentMode_() === 'off' && !env.agentLiveFor_(people['a-neil-ramnanan']));
P.setProperty('AGENT_DAY', 'live');
ok('AGENT_DAY = live is live', env.agentMode_() === 'live');
P.setProperty('AGENT_DAY', 'preview');
ok('a leftover AGENT_DAY = preview does not hold them back', env.agentMode_() === 'live');
P.deleteProperty('AGENT_DAY');
ok('the fact-find chase does not start because of this', env.ffMode_() === 'preview');
P.setProperty('FF_CHASE', 'live');
ok('it still has its own switch', env.ffMode_() === 'live');
P.deleteProperty('FF_CHASE');

console.log('\nThe mail, this morning:\n');
env.agentPeople_ = () => people;
env.agentBatchData_ = () => ({});
const mails = [];
env.mailSend_ = o => { mails.push(o); return 'relay'; };
const fake = kind => a => env.agSend_(a, kind + ' · ' + a.name, '<p>x</p>', []);
env.agentMorningMail_ = fake('am'); env.agentMiddayMail_ = fake('md'); env.agentEveningMail_ = fake('pm');
const run = mins => { for (let i = 0; i < 5; i++) env.agentTick_(DAY, mins); };
const to = a => mails.filter(m => m.to === a.email);
// 5:30am today, before the release: Neil had his own (the pilot), Narissa a sample to Mr Rampersad.
P.setProperty('ag_am_a-neil-ramnanan_' + DAY, '05:31'); P.setProperty('agp_am_a-narissa-mohammed_' + DAY, '05:31');
run(7 * 60 + 15);
ok('Narissa (a sample at 5:30) now gets her own morning mail', to(people['a-narissa-mohammed']).length === 1);
ok('Felicia gets hers', to(people['a-felicia-rampersad']).length === 1);
ok('Neil is not sent a second', to(people['a-neil-ramnanan']).length === 0);
ok('no [Preview] samples to Mr Rampersad', !mails.some(m => /\[Preview\]/.test(m.subject)));
run(12 * 60 + 5); run(17 * 60 + 35);
ok('the midday and the 5:30 go to all three', Object.keys(people).every(k => to(people[k]).filter(m => /^(md|pm) /.test(m.subject)).length === 2));
const n = mails.length; run(17 * 60 + 50);
ok('and once only', mails.length === n);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
