// Whose list goes to whose address.
//
// "Ensure this is going out to the correct agent" — 15 September 2026. It was
// not. iScope_ ends on a loose test: same surname, same first initial, same
// person. That is what lets one agent be recognised under the three spellings
// the extracts use for them. In this branch's own book it also matches two
// pairs of DIFFERENT people — one pair holding 171 and 17 premium-paying
// policies, the other 91 and 89. Four separate Contact records in Salesforce,
// four separate books. The real names are not written down here, because this
// repository is public; they are in the branch's own access list and in the
// output of intelAddressCheck().
//
// The dues, pending and requirement extracts carry a name and no agent
// number, so the loose test was the only thing deciding those rows, and each
// of the four was being sent the other's clients every morning at six.
//
// The access list is the authority on who is a separate person, so a name or
// a number belonging to somebody else on it now stops the loose test dead.
// The fixtures below are the same shape with pretend names.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'kpi-intel-addr-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const ACCESS = ['Name', 'Email', 'Access Code', 'Role', 'Unit', 'Agent Name (exactly as in data)', 'Agent Number', 'Active'];

function envFor(rows) {
  const env = makeEnv();
  env.__mkSheet('Access', 1, ACCESS, rows);
  env.__mkSheet('KPI Log', 2, ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status'], []);
  env.IROSTER_MEMO = null;             // each fixture reads the tab afresh
  return env;
}

// One overdue row per agent, named exactly as the extract names them and with
// no agent number, which is what the dues tab actually carries.
function cache(names) {
  return {
    dues: {
      chase: names.map(function (n, i) {
        return { agent: n, policy: '80000000' + i, client: 'CLIENT ' + i,
                 modal: 100 + i, days: 40 + i, bucket: '31-60', reachable: true };
      }),
      byAgent: names.map(function (n) { return { agent: n, book: 1, overdue: 1, chase: 1, modal: 1 }; }),
      ageingByAgent: {}, counts: {}, buckets: ['31-60'], defects: {}
    },
    aliases: [], units: {}
  };
}

const who = n => ({ role: 'agent', agentName: n, agentId: '', name: n });
const got = (env, c, n) => (env.iScope_(c, who(n)).dues.chase || []).map(x => x.agent).sort();

/* ── the two pairs, both on the access list ───────────────────────────── */
console.log('\nTwo agents who share a surname and a first initial:\n');
{
  const env = envFor([
    ['Anand Pretend',  'anand@example.com',   '1', 'Agent', 'Unit 1', 'Anand Pretend',  'A101', 'Yes'],
    ['Amrit Pretend', 'amrit@example.com',  '1', 'Agent', 'Unit 1', 'Amrit Pretend', 'A102', 'Yes'],
    ['Beena Sample', 'beena@example.com', '1', 'Agent', 'Unit 2', 'Beena Sample', 'A103', 'Yes'],
    ['Bella Sample', 'bella@example.com', '1', 'Agent', 'Unit 2', 'Bella Sample', 'A104', 'Yes']
  ]);
  const c = cache(['Anand Pretend', 'Amrit Pretend', 'Beena Sample', 'Bella Sample']);

  ok('Anand Pretend gets his own row and nothing else',
     JSON.stringify(got(env, c, 'Anand Pretend')) === '["Anand Pretend"]',
     JSON.stringify(got(env, c, 'Anand Pretend')));
  ok('  Amrit Pretend is not folded into it', got(env, c, 'Anand Pretend').indexOf('Amrit Pretend') === -1);
  ok('Amrit Pretend gets his own row and nothing else',
     JSON.stringify(got(env, c, 'Amrit Pretend')) === '["Amrit Pretend"]',
     JSON.stringify(got(env, c, 'Amrit Pretend')));
  ok('Beena Sample gets their own row and nothing else',
     JSON.stringify(got(env, c, 'Beena Sample')) === '["Beena Sample"]',
     JSON.stringify(got(env, c, 'Beena Sample')));
  ok('Bella Sample gets their own row and nothing else',
     JSON.stringify(got(env, c, 'Bella Sample')) === '["Bella Sample"]',
     JSON.stringify(got(env, c, 'Bella Sample')));

  // The four together account for the four rows: nothing was dropped either.
  const total = ['Anand Pretend', 'Amrit Pretend', 'Beena Sample', 'Bella Sample']
    .reduce(function (t, n) { return t + got(env, c, n).length; }, 0);
  ok('every row still reaches exactly one of them', total === 4, total + ' of 4');
}

/* ── the loose test still does the job it was written for ─────────────── */
console.log('\nOne agent, three spellings — still one book:\n');
{
  const env = envFor([
    ['Carl Fictitious', 'carl@example.com', '1', 'Agent', 'Unit 1', 'Carl Fictitious', 'A201', 'Yes']
  ]);
  // The middle name and the initial are how the extracts differ for one person.
  const c = cache(['Carl Fictitious', 'C Fictitious', 'Carl Anand Fictitious']);
  const mine = got(env, c, 'Carl Fictitious');
  ok('all three spellings come to Carl Fictitious', mine.length === 3, JSON.stringify(mine));
}

console.log('\nA name nobody on the access list claims is still matched loosely:\n');
{
  // Amrit Pretend is NOT on the access list here, so his rows have no address
  // of their own and the loose test may claim them — that is the behaviour the
  // test was written for, and taking somebody off the list restores it.
  const env = envFor([
    ['Anand Pretend', 'anand@example.com', '1', 'Agent', 'Unit 1', 'Anand Pretend', 'A101', 'Yes']
  ]);
  const c = cache(['Anand Pretend', 'Amrit Pretend']);
  ok('with Amrit off the list, Anand receives both', got(env, c, 'Anand Pretend').length === 2);
  ok('  which is why intelAddressCheck() names the pair',
     typeof env.intelAddressCheck === 'function');
}

/* ── the agent number, where the extract carries one ──────────────────── */
console.log('\nThe in-force book carries a servicing agent id, and it decides:\n');
{
  const env = envFor([
    ['Anand Pretend',  'anand@example.com',  '1', 'Agent', 'Unit 1', 'Anand Pretend',  'A101', 'Yes'],
    ['Amrit Pretend', 'amrit@example.com', '1', 'Agent', 'Unit 1', 'Amrit Pretend', 'A102', 'Yes']
  ]);
  // A row filed under a company name, which is why the code test comes first.
  const c = {
    dues: { chase: [{ agent: 'FICTITIOUS INSURANCE SERVICES LTD', agentId: 'A101', policy: '1', modal: 1, days: 50, bucket: '31-60' },
                    { agent: 'FICTITIOUS INSURANCE SERVICES LTD', agentId: 'A102', policy: '2', modal: 1, days: 50, bucket: '31-60' }],
            byAgent: [], ageingByAgent: {}, counts: {}, buckets: [], defects: {} },
    aliases: [], units: {}
  };
  const j = env.iScope_(c, { role: 'agent', agentName: 'Anand Pretend', agentId: 'A101', name: 'Anand Pretend' });
  const s = env.iScope_(c, { role: 'agent', agentName: 'Amrit Pretend', agentId: 'A102', name: 'Amrit Pretend' });
  ok('the company name goes to the number that owns it — Anand',
     j.dues.chase.length === 1 && j.dues.chase[0].policy === '1',
     JSON.stringify(j.dues.chase.map(x => x.policy)));
  ok('  and the other one to Amrit',
     s.dues.chase.length === 1 && s.dues.chase[0].policy === '2',
     JSON.stringify(s.dues.chase.map(x => x.policy)));
}

/* ── the guard can only ever narrow ───────────────────────────────────── */
console.log('\nNo access list at all — the old behaviour, not an empty book:\n');
{
  const env = makeEnv();
  env.__mkSheet('KPI Log', 1, ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status'], []);
  env.IROSTER_MEMO = null;
  const c = cache(['Anand Pretend']);
  let mine = null, threw = '';
  try { mine = env.iScope_(c, who('Anand Pretend')); } catch (e) { threw = String(e); }
  ok('scoping still works with no access tab to read', !threw, threw);
  ok('  and Anand still gets his row', mine && mine.dues.chase.length === 1);
}

/* ── the branch manager still sees everything ─────────────────────────── */
console.log('\nThe branch manager is not scoped at all:\n');
{
  const env = envFor([
    ['Anand Pretend',  'anand@example.com',  '1', 'Agent', 'Unit 1', 'Anand Pretend',  'A101', 'Yes'],
    ['Amrit Pretend', 'amrit@example.com', '1', 'Agent', 'Unit 1', 'Amrit Pretend', 'A102', 'Yes']
  ]);
  const c = cache(['Anand Pretend', 'Amrit Pretend']);
  const all = env.iScope_(c, { role: 'branch', name: 'Ricky Rampersad', agentName: 'Ricky Rampersad', agentId: '' });
  ok('every row is still on the branch view', all.dues.chase.length === 2, all.dues.chase.length + ' of 2');
}

/* ── the check itself, because an untested report is how TT$%,.2f shipped ─ */
console.log('\nintelAddressCheck() — what it says, and what it must not say:\n');
{
  const env = envFor([
    ['Anand Pretend', 'anand@example.com', 'SECRETCODE1', 'Agent', 'Unit 1', 'Anand Pretend', 'A101', 'Yes'],
    ['Amrit Pretend', 'amrit@example.com', 'SECRETCODE2', 'Agent', 'Unit 1', 'Amrit Pretend', 'A102', 'Yes'],
    // A second row for the same person: swallowed by the directory, so this
    // agent would never be written to and nothing would say so.
    ['A. Pretend',    'stale@example.com', 'SECRETCODE3', 'Agent', 'Unit 1', 'Anand Pretend', 'A101', 'Yes'],
    ['Dev Nomail',    '',                  'SECRETCODE4', 'Agent', 'Unit 2', 'Dev Nomail',    'A104', 'Yes']
  ]);
  let text = '', threw = '';
  try { text = env.intelAddressCheck(); } catch (e) { threw = String(e); }
  ok('it runs', !threw, threw);
  ok('it names the pair that shares a surname and an initial',
     /Anand Pretend\s+<->\s+Amrit Pretend|Amrit Pretend\s+<->\s+Anand Pretend/.test(text));
  ok('it names the agent with no e-mail address', /Dev Nomail/.test(text));
  ok('it reports the swallowed row', /did not become a person|read as the same person/.test(text));
  ok('it prints no access code', text.indexOf('SECRETCODE') === -1);
  ok('it sends nothing', (env.__mail || []).length === 0, JSON.stringify(env.__mail || []));
}

console.log('');
process.exit(fails ? 1 : 0);
