// Fewer e-mails (8 Nov 2026): the coach's morning is the default, no midday, the 5:30 to the agent alone,
// and one 6:30 e-mail per manager with all their agents' close-offs, Kamla copied.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-11-09';
const env = makeEnv();
env.todayISO_ = () => DAY;
const P = env.PropertiesService.getScriptProperties();
P.setProperty('AGENT_DAY', 'live');
const mk = (n, mgr) => ({ key: 'a-' + n.toLowerCase(), name: n + ' Sample', agentName: n + ' Sample', email: n.toLowerCase() + '@example.com', manager: mgr });
const A = { 'a-neil': mk('Neil', 'akaash@example.com'), 'a-joy': mk('Joy', 'akaash@example.com'), 'a-felicia': mk('Felicia', 'ricky@example.com') };
env.agentPeople_ = () => A;
env.agentLiveFor_ = () => true;
env.emailFor_ = sid => ({ kamla: 'kamla@example.com' })[sid] || '';
const r = (who, kind, item, v, note) => [DAY, 'a-' + who, who + '@example.com', '', kind, item, item, kind === 'plan' ? v : '', kind === 'close' ? v : '', note || '', '07:10'];
env.__mkSheet('Agent Day', 1, env.AGDAY.head, [
  r('neil', 'plan', 'calls', '10'), r('neil', 'close', 'calls', '6'), r('neil', 'close', 'summary', '', 'Two appointments booked'),
  r('joy', 'plan', 'calls', '5'),
  r('felicia', 'plan', 'calls', '4'), r('felicia', 'close', 'calls', '5')]);
const mails = []; env.mailSend_ = o => { mails.push(o); return 'relay'; };

ok('the coach is on with AGENT_COACH unset', env.agCoachOn_(A['a-neil']) === true);
P.setProperty('AGENT_COACH', 'off'); ok('AGENT_COACH = off turns it off', env.agCoachOn_(A['a-neil']) === false); P.deleteProperty('AGENT_COACH');
ok('no midday run', env.agentTick_(DAY, 12 * 60 + 5).length === 0 && mails.length === 0);
ok('nothing before 6:30', env.agentRollupTick_(DAY, 18 * 60 + 10).length === 0 && mails.length === 0);
const out = env.agentRollupTick_(DAY, 18 * 60 + 35);
ok('one e-mail per manager', mails.length === 2, mails.map(m => m.to).join(' | '));
const ak = mails.find(m => m.to === 'akaash@example.com') || {}, ri = mails.find(m => m.to === 'ricky@example.com') || {};
ok('Kamla copied on each', ak.cc === 'kamla@example.com' && ri.cc === 'kamla@example.com');
ok('Akaash: 1 of 2 closed off, Joy named as not closed off', /1 of 2 closed off/.test(ak.subject) && /No close-off: Joy/.test(ak.htmlBody), ak.subject);
ok('Neil: short of his projection, his own words', /Short of their own projection: Neil/.test(ak.htmlBody) && /Two appointments booked/.test(ak.htmlBody));
ok('Mr Rampersad gets Felicia alone', /1 of 1/.test(ri.subject) && /Felicia/.test(ri.htmlBody) && !/Neil/.test(ri.htmlBody));
const n = mails.length; env.agentRollupTick_(DAY, 18 * 60 + 50);
ok('once a day', mails.length === n);
console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
