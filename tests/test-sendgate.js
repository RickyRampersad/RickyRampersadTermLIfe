// Permission to write to an agent, asked for in code rather than promised.
//
// 15 September 2026: "moving forward you are to ask my permission on any
// emails going out to agents and clients."
//
// The client letters already worked that way — INTEL_SURVEY_LIVE has to be
// typed out as "send to clients" or nothing is sent. The agent mail did not:
// iSend_ wrote to whatever address it was handed unless INTEL_TEST_TO happened
// to be set, so six triggers mailed twenty-eight agents at 6am with nobody
// having said yes that morning, and two defects went out with them.
//
// The switch is now the other way round. Off is the default, off is not
// silence — a held run arrives in the manager's inbox as one preview per
// intended recipient, named across the top — and on takes a typed phrase,
// because a switch that "yes" or "true" can flip is a switch that gets
// flipped by somebody tidying a properties page.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'kpi-intel-gate-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const AGENT = 'anand@example.com';
const BOSS = 'boss@example.com';

// Every send is recorded, so the assertions are about what MailApp was handed.
function gate(props) {
  const env = makeEnv({ props: props });
  const sent = [];
  env.MailApp = { sendEmail: o => { sent.push(o); } };
  env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Unit', 'Active'], []);
  env.__mkSheet('KPI Log', 2, ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status'], []);
  return { env: env, sent: sent };
}

/* ── the default ──────────────────────────────────────────────────────────── */
console.log('\nNothing set — the default, which is the state the project ships in:\n');
{
  const g = gate({ INTEL_MANAGER_EMAIL: BOSS });
  const returned = g.env.iSend_(AGENT, 'Your branch list', '<p>ninety-one policies</p>');
  ok('it reports that it handled the message', returned === true);
  ok('exactly one message was sent', g.sent.length === 1, String(g.sent.length));
  ok('it went to the manager, not the agent', g.sent[0] && g.sent[0].to === BOSS, g.sent[0] && g.sent[0].to);
  ok('  the agent is not on it anywhere', g.sent.length === 1 && g.sent[0].to.indexOf('anand') === -1);
  ok('the subject says it was held', /^\[HELD\] /.test(g.sent[0].subject), g.sent[0].subject);
  ok('the body names who it would have gone to', g.sent[0].htmlBody.indexOf(AGENT) !== -1);
  ok('  and says how to switch it on', g.sent[0].htmlBody.indexOf('INTEL_AGENT_LIVE') !== -1 &&
                                       g.sent[0].htmlBody.indexOf('send to agents') !== -1);
  ok('the letter itself is still there to be read', g.sent[0].htmlBody.indexOf('ninety-one policies') !== -1);
}

console.log('\nNothing set and nowhere to hold it — nothing goes at all:\n');
{
  const env = makeEnv({ props: {} });
  const sent = [];
  env.MailApp = { sendEmail: o => { sent.push(o); } };
  env.Session = { getEffectiveUser: () => ({ getEmail: () => '' }) };
  env.__mkSheet('KPI Log', 1, ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status'], []);
  const returned = env.iSend_(AGENT, 'Your branch list', '<p>x</p>');
  ok('it refuses rather than falling back to the agent', returned === false);
  ok('  and sent nothing', sent.length === 0, String(sent.length));
}

/* ── switching it on takes the whole phrase ───────────────────────────────── */
console.log('\nOn, but only for the exact phrase:\n');
{
  const live = gate({ INTEL_MANAGER_EMAIL: BOSS, INTEL_AGENT_LIVE: 'send to agents' });
  live.env.iSend_(AGENT, 'Your branch list', '<p>x</p>');
  ok('"send to agents" reaches the agent', live.sent[0] && live.sent[0].to === AGENT, live.sent[0] && live.sent[0].to);
  ok('  with no banner and no prefix', live.sent[0].subject === 'Your branch list' &&
                                       live.sent[0].htmlBody.indexOf('HELD') === -1);

  // Whitespace and capitals are somebody typing, not somebody else's intent.
  const loose = gate({ INTEL_MANAGER_EMAIL: BOSS, INTEL_AGENT_LIVE: '  Send To Agents  ' });
  loose.env.iSend_(AGENT, 'Your branch list', '<p>x</p>');
  ok('trimmed and case-folded, it still counts', loose.sent[0].to === AGENT, loose.sent[0].to);

  // Anything that is not the phrase is not permission.
  ['yes', 'true', '1', 'on', 'send', 'SEND TO AGENT', 'send to clients', 'send  to  agents', 'agents']
    .forEach(function (v) {
      const g = gate({ INTEL_MANAGER_EMAIL: BOSS, INTEL_AGENT_LIVE: v });
      g.env.iSend_(AGENT, 'Your branch list', '<p>x</p>');
      ok('"' + v + '" is not permission', g.sent[0] && g.sent[0].to === BOSS, g.sent[0] && g.sent[0].to);
    });
}

/* ── test mode still outranks everything ─────────────────────────────────── */
console.log('\nTest mode outranks the live switch, so a test run cannot leak:\n');
{
  const g = gate({ INTEL_MANAGER_EMAIL: BOSS, INTEL_AGENT_LIVE: 'send to agents',
                   INTEL_TEST_TO: 'tester@example.com' });
  g.env.iSend_(AGENT, 'Your branch list', '<p>x</p>');
  ok('it goes to the test address', g.sent[0].to === 'tester@example.com', g.sent[0].to);
  ok('  tagged [TEST]', /^\[TEST\] /.test(g.sent[0].subject), g.sent[0].subject);
}

/* ── the manager's own mail is not stamped as held ───────────────────────── */
console.log("\nThe manager's own digest is his already — no banner on it:\n");
{
  const g = gate({ INTEL_MANAGER_EMAIL: BOSS });
  g.env.iSend_(BOSS, 'Branch Intelligence — week of 14 September', '<p>x</p>');
  ok('it goes to him', g.sent[0].to === BOSS);
  ok('  with no [HELD] prefix', g.sent[0].subject.indexOf('[HELD]') === -1, g.sent[0].subject);
  ok('  and no banner', g.sent[0].htmlBody.indexOf('HELD —') === -1);
}

/* ── the end to end proof: a whole digest run with nothing switched on ───── */
console.log('\nA full agent digest run, nothing switched on — the 6am case:\n');
{
  const g = gate({ INTEL_MANAGER_EMAIL: BOSS });
  g.env.__mkSheet('Access', 1,
    ['Name', 'Email', 'Access Code', 'Role', 'Unit', 'Agent Name (exactly as in data)', 'Agent Number', 'Active'],
    [['Anand Pretend', AGENT, '1', 'Agent', 'Unit 1', 'Anand Pretend', 'A101', 'Yes'],
     ['Beena Sample', 'beena@example.com', '1', 'Agent', 'Unit 1', 'Beena Sample', 'A102', 'Yes']]);
  // A cache with one overdue row each, so both agents have something to be sent.
  g.env.iLoadCache_ = () => ({
    dues: { chase: [{ agent: 'Anand Pretend', policy: '1', client: 'C1', modal: 100, days: 70, bucket: '61-90', reachable: true },
                    { agent: 'Beena Sample', policy: '2', client: 'C2', modal: 100, days: 70, bucket: '61-90', reachable: true }],
            byAgent: [], ageingByAgent: {}, counts: {}, buckets: ['61-90'], defects: {} },
    aliases: [], units: {}
  });
  let threw = '';
  try { g.env.intelAgentDigest(); } catch (e) { threw = String(e); }
  ok('the run completes', !threw, threw);
  const toAgents = g.sent.filter(o => o.to !== BOSS);
  ok('not one message reached an agent', toAgents.length === 0,
     JSON.stringify(toAgents.map(o => o.to)));
  ok('the manager received the previews instead', g.sent.length > 0 && g.sent.every(o => o.to === BOSS),
     g.sent.length + ' message(s)');
  ok('  each one naming its intended recipient',
     g.sent.every(o => /\[HELD\]/.test(o.subject) && /would have gone to/.test(o.htmlBody)));
}

/* ── the panic button, and the thing it must not undo ──────────────── */
console.log('\nintelMailOff() — for the morning somebody has no time to paste anything:\n');
{
  const g = gate({ INTEL_MANAGER_EMAIL: BOSS, INTEL_AGENT_LIVE: 'send to agents',
                   INTEL_SURVEY_LIVE: 'send to clients' });
  const said = g.env.intelMailOff();
  ok('it sends nothing itself', g.sent.length === 0, String(g.sent.length));
  ok('it sets test mode to the manager', g.env.iProp_('INTEL_TEST_TO') === BOSS,
     g.env.iProp_('INTEL_TEST_TO'));
  ok('  and says so in words the reader can act on', /MAIL IS OFF/.test(said) && said.indexOf(BOSS) !== -1);
  ok('  including that there is nothing to deploy', /nothing to deploy/i.test(said));

  // Live switches left alone: this is a hold, not a reconfiguration.
  ok('it does not clear the agent switch', g.env.iProp_('INTEL_AGENT_LIVE') === 'send to agents');
  ok('it does not clear the client switch', g.env.iProp_('INTEL_SURVEY_LIVE') === 'send to clients');

  // ...and with it held, a full digest run reaches no agent even though live is set.
  g.env.__mkSheet('Access', 1,
    ['Name', 'Email', 'Access Code', 'Role', 'Unit', 'Agent Name (exactly as in data)', 'Agent Number', 'Active'],
    [['Anand Pretend', AGENT, '1', 'Agent', 'Unit 1', 'Anand Pretend', 'A101', 'Yes']]);
  g.env.iLoadCache_ = () => ({
    dues: { chase: [{ agent: 'Anand Pretend', policy: '1', client: 'C1', modal: 100, days: 70, bucket: '61-90', reachable: true }],
            byAgent: [], ageingByAgent: {}, counts: {}, buckets: ['61-90'], defects: {} },
    aliases: [], units: {} });
  try { g.env.intelAgentDigest(); } catch (e) { /* reported below */ }
  ok('a digest run after it reaches no agent', g.sent.every(o => o.to === BOSS),
     JSON.stringify(g.sent.map(o => o.to)));
}

console.log('\nintelMailOn() clears the hold and NOTHING else:\n');
{
  const g = gate({ INTEL_MANAGER_EMAIL: BOSS, INTEL_TEST_TO: BOSS });
  const said = g.env.intelMailOn();
  ok('test mode is cleared', !g.env.iProp_('INTEL_TEST_TO'), g.env.iProp_('INTEL_TEST_TO'));
  ok('it did NOT switch agent mail on', !g.env.iAgentLive_());
  ok('  and says so', /still HELD/.test(said), said.split('\n')[2] || said.slice(0, 80));
  ok('  naming the phrase that would', said.indexOf('send to agents') !== -1);
  ok('it points at the address check first', /intelAddressCheck/.test(said));
  ok('it sends nothing', g.sent.length === 0);

  // With the hold cleared and the switch set, mail flows — the two are independent.
  const live = gate({ INTEL_MANAGER_EMAIL: BOSS, INTEL_TEST_TO: BOSS, INTEL_AGENT_LIVE: 'send to agents' });
  live.env.intelMailOn();
  live.env.iSend_(AGENT, 'Your branch list', '<p>x</p>');
  ok('both switches cleared and set together do reach the agent',
     live.sent[0] && live.sent[0].to === AGENT, live.sent[0] && live.sent[0].to);
}

console.log("\nWith nowhere to hold it, mail off refuses rather than pretending:\n");
{
  const env = makeEnv({ props: {} });
  const sent = [];
  env.MailApp = { sendEmail: o => { sent.push(o); } };
  env.Session = { getEffectiveUser: () => ({ getEmail: () => '' }) };
  env.__mkSheet('KPI Log', 1, ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status'], []);
  const said = env.intelMailOff();
  ok('it says what to set first', /INTEL_MANAGER_EMAIL/.test(said), said.slice(0, 70));
  ok('  and did not set test mode to nothing', !env.iProp_('INTEL_TEST_TO'));
}

console.log('');
process.exit(fails ? 1 : 0);
