// With the agent — the delivery wall's roster, and what it leaves off.
//
// INTEL_EXCLUDE_AGENTS takes an agent off every wall, and the rule in
// iExcluded_ is that every screen that excludes says how much it removed.
// The delivery wall did not: its row loop skipped the excluded rows in
// silence, and its roster map — the "N active agents" line at the foot of the
// screen — was built BEFORE the exclusion ran, so the same agent the branch had
// asked to leave off was gone from the list and still in the total. Both were
// put right on 16 September 2026, and this file holds them there.
//
// It also holds the cap off: the wall used to be handed the top 24 agents and
// showed 18 of them. It now measures what fits, which only works if the build
// hands over every one.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Intelligence.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const NOW = new Date('2026-09-16T10:00:00');
function clock(env) {
  const realDate = env.Date;
  env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                   get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
}

/* Invented names throughout, in the repository's own convention. */
const ACCESS = ['Name', 'Email', 'Access Code', 'Role', 'Unit', 'Agent Name (exactly as in data)', 'Agent Number', 'Active'];
const INF = ['Policy Id', 'Policy Maturity Date', 'Plan', 'Fund Value', 'Given Name', 'Surname', 'Email',
             'Servicing Agent Id', 'Servicing Agent Name', 'Dispatch Date', 'Delivery Category',
             'Servicing Agent Status', 'Servicing Agent Contract End Date'];
const inf = (id, name, status, dispatch, cat, ended) =>
  ['P' + Math.random().toString(36).slice(2, 8), '2050-01-01', 'ECT65', 0, 'CLIENT', 'NAME', '',
   id, name, dispatch, cat, status, ended || ''];

const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
clock(env);
env.__mkSheet('Access', 1, ACCESS, [
  ['Anand Pretend', 'a@example.com', '1111', 'Agent', 'Unit A', 'Anand Pretend', 'A00001', 'Yes'],
  ['Beena Sample',  'b@example.com', '2222', 'Agent', 'Unit A', 'Beena Sample',  'A00002', 'Yes'],
  ['Gone Away',     'g@example.com', '4444', 'Agent', 'Unit A', 'Gone Away',     'A00004', 'Yes'],
  ['Dora Departed', 'd@example.com', '5555', 'Agent', 'Unit A', 'Dora Departed', 'A00005', 'Yes'],
  ['Vera Vested',   'v@example.com', '6666', 'Agent', 'Unit A', 'Vera Vested',   'A00006', 'Yes']
]);
env.__mkSheet('Inforce', 2, INF, [
  inf('A00001', 'ANAND PRETEND', 'Active',   '2026-08-01', 'Undelivered'),
  inf('A00001', 'ANAND PRETEND', 'Active',   '2026-07-01', '0-30 Days'),
  inf('A00002', 'BEENA SAMPLE',  'Active',   '2026-06-01', '0-30 Days'),
  // Excluded: two rows, one name — one of them undelivered
  inf('A00004', 'GONE AWAY',     'Active',   '2026-08-10', 'Undelivered'),
  inf('A00004', 'GONE AWAY',     'Active',   '2026-05-01', '31-60 Days'),
  // Left the branch with one still out
  inf('A00005', 'DORA DEPARTED', 'Inactive', '2026-07-01', 'Undelivered', '2026-08-15'),
  // Retired, still earning renewals
  inf('A00006', 'VERA VESTED',   'Vested',   '2026-06-01', '0-30 Days')
]);

console.log('\nThe roster, with the exclusion applied to it:\n');
const D = env.iBuildDelivery_();
ok('the build ran', !D.error, D.error || '');
const RO = D.roster || {};
ok('two active agents — the excluded one is not a third', RO.active === 2, String(RO.active));
ok('one inactive', RO.inactive === 1, String(RO.inactive));
ok('one vested', RO.vested === 1, String(RO.vested));

console.log('\nWhat the exclusion removed, said out loud:\n');
const X = D.excluded || {};
ok('two rows', X.rows === 2, String(X.rows));
ok('from one name', X.agents === 1, String(X.agents));
ok('the excluded agent is on no list',
   !(D.agents || []).some(a => /gone away/i.test(a.k)) && !(D.departed.rows || []).some(a => /gone away/i.test(a.agent)),
   JSON.stringify((D.agents || []).map(a => a.k)));
ok('and their undelivered contract is not in the cabinet count', D.headline.inCabinet === 1, String(D.headline.inCabinet));
/* Three, not two: the vested agent's delivery counts as a delivery that
   happened, because it did. Only the excluded agent's one is gone. */
ok('nor delivered on the branch’s behalf', D.history.delivered === 3, String(D.history.delivered));
ok('the departed agent’s contract is on its own line, not the roster',
   D.departed.n === 1 && D.departed.rows[0].agent === 'Dora Departed', JSON.stringify(D.departed));

console.log('\nEvery agent, not the top 24:\n');
const env2 = makeEnv();
clock(env2);
const MANY = [];
for (let i = 1; i <= 30; i++) MANY.push(['Sample Person ' + i, 'p' + i + '@example.com', '9' + i, 'Agent', 'Unit A', 'Sample Person ' + i, 'A009' + String(i).padStart(2, '0'), 'Yes']);
env2.__mkSheet('Access', 1, ACCESS, MANY);
env2.__mkSheet('Inforce', 2, INF, MANY.map((m, i) =>
  inf(m[6], m[0].toUpperCase(), 'Active', '2026-08-01', i % 2 ? 'Undelivered' : '0-30 Days')));
const D2 = env2.iBuildDelivery_();
ok('thirty agents handed to the wall', (D2.agents || []).length === 30, String((D2.agents || []).length));
ok('outstanding first, then the clean ones', D2.agents[0].n === 1 && D2.agents[29].n === 0);
ok('nothing removed when nobody is excluded', D2.excluded.rows === 0 && D2.excluded.agents === 0, JSON.stringify(D2.excluded));
ok('and the roster is all thirty', D2.roster.active === 30, String(D2.roster.active));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nALL PASS\n');
process.exit(fails ? 1 : 0);
