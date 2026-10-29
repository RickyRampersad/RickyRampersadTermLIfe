// The agents' pilot (27 October 2026).
//
// Ricky, 6:24am: "Put this now live for Neil Ramnanan, Fawaz Mohammed, Rajiv Sukdev, Joy Sama, and Daryl Manik ... in a
// test group more or less from today, logging in, checks and afternoon."
// Pinned here:
//   - in preview, the five get their own morning, midday and 5:30 mail; every other agent stays in preview (samples to him)
//   - the pilot's mail is marked live (ag_), so it is sent once and never held back by the preview's samples
//   - the preview's three samples a day still go, and only from agents outside the pilot
//   - AGENT_PILOT replaces the list; AGENT_PILOT = off ends it; AGENT_DAY = off sends nothing; before 27 Oct nothing changes
//   - the agents' buttons say what to do when Google's page will not open
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
let DAY = '2026-10-27';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], [
  ['ricky@example.com', 'A00427 - Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active']]);
const P = env.PropertiesService.getScriptProperties();
const AG = (name, code) => ({ key: 'a-' + env.agSlug_(name), name, agentName: name, code, agentId: code, email: name.split(' ')[0].toLowerCase() + '@example.com', manager: 'um@example.com' });
const people = {};
[['Neil Ramnanan', 'A10024'], ['Fawwaz Mohamed', 'A12397'], ['Rajiv Soodoo', 'A14158'], ['Joy Barbara Sammah', 'A07347'], ['Darryl Manick', 'A11238'],
 ['Narissa Mohammed', 'A01066'], ['Premchand Dookran', 'A03522'], ['Randolph Gonzales', 'A09311'], ['Varun Seegolam', 'A10428']].forEach(x => { const a = AG(x[0], x[1]); people[a.key] = a; });
env.agentPeople_ = () => people;
env.agentBatchData_ = () => ({});
const mails = [];
env.mailSend_ = o => { mails.push(o); return 'relay'; };
const sent = [];
const fake = kind => (a) => { sent.push(kind + ':' + a.name); return env.agSend_(a, kind + ' · ' + a.name, '<p>x</p>', a.manager ? [a.manager] : []); };
env.agentMorningMail_ = fake('am'); env.agentMiddayMail_ = fake('md'); env.agentEveningMail_ = fake('pm');
const run = mins => { const out = []; for (let i = 0; i < 5; i++) out.push(...env.agentTick_(DAY, mins)); return out; };
const to = n => mails.filter(m => m.to === n.split(' ')[0].toLowerCase() + '@example.com');

console.log('\nThe morning, in preview with the pilot:\n');
run(6 * 60 + 40);
const five = ['Neil Ramnanan', 'Fawwaz Mohamed', 'Rajiv Soodoo', 'Joy Barbara Sammah', 'Darryl Manick'];
ok('each of the five gets their own morning mail, once', five.every(n => to(n).length === 1), five.map(n => n.split(' ')[0] + ':' + to(n).length).join(' '));
ok('copied to their unit manager, not marked preview', five.every(n => to(n)[0] && to(n)[0].cc === 'um@example.com' && !/\[Preview\]/.test(to(n)[0].subject)));
ok('nobody outside the pilot is mailed', ['Narissa Mohammed', 'Premchand Dookran', 'Randolph Gonzales', 'Varun Seegolam'].every(n => to(n).length === 0));
const prev = mails.filter(m => /\[Preview\]/.test(m.subject));
ok('he still gets three preview samples, all from outside the pilot', prev.length === 3 && prev.every(m => !five.some(n => m.subject.indexOf(n) > -1)), prev.map(m => m.subject).join(' | '));
ok('the pilot\'s mail is marked live (ag_)', five.every(n => !!P.getProperty('ag_am_a-' + env.agSlug_(n) + '_' + DAY)));
const before = mails.length; run(6 * 60 + 50);
ok('a later run sends nothing again', mails.length === before);

console.log('\nThe midday and the close-off:\n');
run(12 * 60 + 5); run(17 * 60 + 35);
ok('the five get the midday check and the 5:30 close-off', five.every(n => to(n).length === 3), five.map(n => n.split(' ')[0] + ':' + to(n).length).join(' '));
ok('still nobody else', ['Narissa Mohammed', 'Varun Seegolam'].every(n => to(n).length === 0));

console.log('\nThe switches:\n');
ok('by number, and by name', env.agentInPilot_(people['a-neil-ramnanan']) && env.agentInPilot_({ name: 'Darryl Manick' }) && !env.agentInPilot_(people['a-narissa-mohammed']));
P.setProperty('AGENT_PILOT', 'A01066, Varun Seegolam');
ok('AGENT_PILOT replaces the list', env.agentInPilot_(people['a-narissa-mohammed']) && env.agentInPilot_(people['a-varun-seegolam']) && !env.agentInPilot_(people['a-neil-ramnanan']));
P.setProperty('AGENT_PILOT', 'off');
ok('AGENT_PILOT = off ends it', !env.agentLiveFor_(people['a-neil-ramnanan']));
P.deleteProperty('AGENT_PILOT');
P.setProperty('AGENT_DAY', 'off');
ok('AGENT_DAY = off: nobody', !env.agentLiveFor_(people['a-neil-ramnanan']) && env.agentTick_(DAY, 6 * 60 + 40).length === 0);
P.setProperty('AGENT_DAY', 'live');
ok('AGENT_DAY = live: everyone', env.agentLiveFor_(people['a-narissa-mohammed']) && env.agentLiveFor_(people['a-neil-ramnanan']));
P.deleteProperty('AGENT_DAY');
DAY = '2026-10-26';
ok('before 27 Oct: no pilot', !env.agentLiveFor_(people['a-neil-ramnanan']));
DAY = '2026-10-27';

console.log('\nThe buttons:\n');
const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'KPI.gs'), 'utf8');
// 29 Oct 2026: the buttons open My day; under each, the full page and what to do when Google's page will not open.
ok('the morning, midday and close-off buttons open My day, the full page below with what to do when Google\'s page will not open', (src.match(/\) \+ agOldLine_\(replyUrl_\(a\.key, day, 'agc?'\)\);/g) || []).length === 3 && /private \(incognito\) window/.test(env.agOldLine_('x')) && (src.match(/workGoUrl_\(a\.key, 'ag(plan|close)'\)/g) || []).length === 3);
console.log('\nThe ping:\n');
const props = env.PropertiesService.getScriptProperties();
const pingNow = () => JSON.parse(env.doGet({ parameter: { action: 'ping' } }).getContent());
const was = pingNow().agents.mailedToday;   // the runs above
props.setProperty('ag_am_ZZ1_' + DAY, '05:31'); props.setProperty('ag_am_ZZ2_' + DAY, '05:31'); props.setProperty('ag_md_ZZ1_' + DAY, '12:01');
props.setProperty('ag_am_ZZ3_2026-10-26', '05:31'); props.setProperty('ag_prev_am_' + DAY, '3'); props.setProperty('agp_am_ZZ4_' + DAY, '05:41');
const ping = pingNow();
ok('ping says the mode and how many agents were mailed today, by run (not samples, not yesterday)', ping.agents && ping.agents.mailedToday.am - was.am === 2 && ping.agents.mailedToday.md - was.md === 1 && ping.agents.mailedToday.pm === was.pm && typeof ping.agents.mode === 'string', JSON.stringify(ping.agents));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
