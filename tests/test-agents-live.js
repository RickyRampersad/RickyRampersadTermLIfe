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
P.setProperty('AGENT_DAY_OFF', 'none'); // these tests use agents who were taken off on 12 Nov 2026
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
// Intelligence.gs sits beside KPI.gs in the tracker's project; its INTEL_EXCLUDE_AGENTS reader, as it reads (3 Nov 2026)
env.iExcluded_ = () => { const o = {}; String(P.getProperty('INTEL_EXCLUDE_AGENTS') || '').split(',').forEach(n => { const k = n.trim().toLowerCase(); if (k) o[k] = true; }); return o; };
env.iExcludes_ = (skip, name) => !!skip[String(name || '').trim().toLowerCase()];
P.setProperty('INTEL_EXCLUDE_AGENTS', 'Narissa Mohammed');
ok('anyone on INTEL_EXCLUDE_AGENTS gets nothing, though Active on the Skill Bank (3 Nov 2026)', !env.agentPeople_()['a-narissa-mohammed'] && !!env.agentPeople_()['a-neil-ramnanan']);
P.deleteProperty('INTEL_EXCLUDE_AGENTS');
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

console.log('\nThe morning e-mail says when each is due:\n');
{
  P.setProperty('AGENT_COACH', 'off');   // the plain morning e-mail; the coach's is covered in test-agent-coach.js
  env.__mkSheet('Agent Day', 1, env.AGDAY.head, []);
  const got = []; const keep = env.mailSend_; env.mailSend_ = o => { got.push(o); return 'relay'; };
  const F = people['a-felicia-rampersad'];
  const open = [{ id: '00T1', subject: 'Orphan: change of beneficiary - Khalawan', owner: 'Elizabeth Lee', due: '2026-10-30', late: true },
    { id: '00T2', subject: 'Orphan response - Ramlakhan', owner: 'Elizabeth Lee', due: DAY, late: false },
    { id: '00T3', subject: 'UWPRO: Sarran', owner: 'Azariah Griffith', due: '2026-11-03', late: false }];
  env.agentMorningMail_(F, DAY, { open: { [F.key]: open }, closed: { [F.key]: [] }, ff: { [F.key]: [] }, f360: {}, goal: {}, q: {}, orphan: {} }, null);
  const h = (got[0] || {}).htmlBody || '';
  const line = s => (h.split(s)[1] || '').split('open &amp; comment')[0];
  ok('it goes to Felicia, not as a preview', got[0] && got[0].to === F.email && !/\[Preview\]/.test(got[0].subject), got[0] && got[0].subject);
  ok('overdue since its date', /overdue since Fri 30 Oct/.test(line('Khalawan')));
  ok('due today only when it is', /due today/.test(line('Ramlakhan')));
  ok('Tuesday\'s says Tuesday, not today', /due Tue 3 Nov/.test(line('UWPRO')) && !/due today/.test(line('UWPRO')), line('UWPRO'));

  // Ricky, 7:17am: "Akash gets his agents and I get my agents. Support is not copied at all, only the BMA, which is Kamla Dookran."
  const keepE = env.emailFor_; env.emailFor_ = sid => ({ kamla: 'kamla@example.com', akaash: 'akaash@example.com' })[sid] || '';
  got.length = 0;
  env.agentMorningMail_(F, DAY, { open: { [F.key]: open }, closed: { [F.key]: [] }, ff: { [F.key]: [] }, f360: {}, goal: {}, q: {}, orphan: {} }, null);
  ok('Felicia\'s copied to Mr Rampersad (her manager now) and Kamla, nobody else', got[0] && got[0].cc === 'ricky@example.com,kamla@example.com', got[0] && got[0].cc);
  const N = people['a-neil-ramnanan']; got.length = 0;
  env.agentMiddayMail_(N, DAY, { open: { [N.key]: [] }, closed: { [N.key]: [] }, ff: { [N.key]: [] }, f360: {}, goal: {}, q: {}, orphan: {} });
  ok('Neil\'s copied to Akaash and Kamla', got[0] && got[0].cc === 'akaash@example.com,kamla@example.com', got[0] && got[0].cc);
  got.length = 0; env.agentEveningMail_(N, DAY, { open: { [N.key]: [] }, closed: { [N.key]: [] }, ff: { [N.key]: [] }, f360: {}, goal: {}, q: {}, orphan: {} });
  ok('the 5:30 goes to Neil alone (8 Nov 2026: his manager gets the 6:30 roll-up)', got[0] && !got[0].cc, got[0] && got[0].cc);
  got.length = 0; env.agCopy_(N, DAY, false, [{ Item: 'calls', Question: 'Calls to make', Planned: '10', Note: '' }], []);
  ok('his projection goes to Akaash, Kamla copied, not sales support', got[0] && got[0].to === 'akaash@example.com' && got[0].cc === 'kamla@example.com', got[0] && (got[0].to + ' / ' + got[0].cc));
  ok('and nothing anywhere to sales support', !got.concat([]).some(m => /salessupport/.test(String(m.to) + String(m.cc))));
  env.emailFor_ = keepE;
  env.mailSend_ = keep;
  P.deleteProperty('AGENT_COACH');
}

console.log('\nEach client once; fact finds named and once (from his 5:36am copy of Felicia\'s):\n');
ok('two policies, one line', JSON.stringify(env.agByClient_([{ client: 'Jabraele Talleh' }, { client: 'Jabraele Talleh' }, { client: 'Jason Banmally' }], false)) === JSON.stringify(['Jabraele Talleh (2 policies)', 'Jason Banmally']));
ok('with the oldest days', JSON.stringify(env.agByClient_([{ client: 'Shivani Pancham', days: 1829 }, { client: 'Shivani Pancham', days: 367 }, { client: 'Alex John', days: 77 }, { client: 'Alex John', days: 77 }], true)) === JSON.stringify(['Shivani Pancham (2 policies, 1829d)', 'Alex John (2 policies, 77d)']));
{
  const keepQ = env.sfkQuery_, keepF = env.ff360Feed_;
  env.ff360Feed_ = () => null;
  env.sfkQuery_ = q => /Fact_Finding_Interviews__c/.test(q) ? [
    { Agent_Email__c: 'felicia@example.com', Name: 'Amrita Kimberly Rattan', Full_Name__c: null, Occupation__c: 'House Officer- Physician', Date_of_Interview__c: '2026-03-24', CreatedDate: '2026-03-25T01:06:53.000+0000' },
    { Agent_Email__c: 'felicia@example.com', Name: 'Amrita Kimberly Rattan', Full_Name__c: null, Occupation__c: 'House Officer- Physician', Date_of_Interview__c: '2026-03-24', CreatedDate: '2026-03-25T00:56:29.000+0000' }] : [];
  const d = env.agentBatchData_([people['a-felicia-rampersad']], DAY);
  const ff = d.ff['a-felicia-rampersad'];
  ok('the interview saved twice is one fact find, with the client\'s name', ff.length === 1 && ff[0].name === 'Amrita Kimberly Rattan', JSON.stringify(ff));
  env.sfkQuery_ = keepQ; env.ff360Feed_ = keepF;
}

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
ok('the midday (on again 13 Nov) and the 5:30 go to all three, once each', Object.keys(people).every(k => to(people[k]).filter(m => /^md /.test(m.subject)).length === 1 && to(people[k]).filter(m => /^pm /.test(m.subject)).length === 1));
const n = mails.length; run(17 * 60 + 50);
ok('and once only', mails.length === n);
env.PropertiesService.getScriptProperties().setProperty('AGENT_MIDDAY', 'off');
ok('AGENT_MIDDAY = off stops the midday', env.agMiddayMode_() === 'off');
env.PropertiesService.getScriptProperties().deleteProperty('AGENT_MIDDAY');
ok('unset, the midday is on', env.agMiddayMode_() === 'on');

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
