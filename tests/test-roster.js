// Who is on the roster, who sees the branch, and what the Branch Manager is
// told about the people the Access tab hides.
//
// Run: node tests/test-roster.js
const { makeEnv } = require('./harness');
const env = makeEnv();

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (cond ? '' : '  — ' + (extra === undefined ? '' : JSON.stringify(extra)))); if (!cond) fails++; };

// Invented people. The last two are the cases that bit: a support assistant
// whose Unit cell says "Sales Admin", and a new hire whose Active cell says
// "New" — which, since 16 September 2026, means off.
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'], [
  ['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', ''],
  ['Ada Quill',       'ada',   'ada@example.com',   '1', 'Sales Support Assistant', 'Support', 'Yes'],
  ['Bram Quill',      'bram',  'bram@example.com',  '1', 'Sales Support', 'Sales Admin', ''],
  ['Cleo Quill',      'cleo',  'cleo@example.com',  '1', 'Sales Support Assistant', 'Support', 'New'],
  ['Dev Quill',       'dev',   'dev@example.com',   '1', 'Administrator', 'Branch', ''],
]);
env.__mkSheet('KPI Log', 2, env.LOG_HEADERS.slice(), []);

const people = env.roster_();
const by = id => people.find(p => p.staffId === id);

console.log('\nWho sees the branch:\n');
ok('the Branch Manager does', env.isManager_(by('ricky')) === true);
ok('a support assistant does not', env.isManager_(by('ada')) === false);
ok('nor one whose Unit says "Sales Admin" — admin is not administrator', env.isManager_(by('bram')) === false);
ok('an Administrator in the Role column does', env.isManager_(by('dev')) === true);

console.log('\nWho is on the roster:\n');
const pub = env.publicRoster_().map(p => p.staffId).sort().join(',');
ok('blank and Yes are on; "New" is off', pub === 'ada,bram,dev,ricky', pub);
const off = env.offRoster_();
ok('the off list names her and what the cell says', off.length === 1 && off[0].name === 'Cleo Quill' && off[0].says === 'New', off);
ok('and carries nothing else — no e-mail, no password', Object.keys(off[0]).sort().join(',') === 'name,says', Object.keys(off[0]));

console.log('\nWhat sign-in hands back:\n');
env.leads_ = () => null;
const r = env.login_('ricky@example.com', '1');
ok('the Branch Manager signs in', r.ok === true, r);
ok('and is told who is off the register', r.ok && Array.isArray(r.offRoster) && r.offRoster[0].name === 'Cleo Quill', r.offRoster);
ok('the roster he gets has no passwords', r.ok && r.roster.every(p => !('password' in p)));
const a = env.login_('ada@example.com', '1');
ok('a support assistant signs in', a.ok === true, a);
ok('and is not told', a.ok && a.offRoster === undefined, a.offRoster);
const c = env.login_('cleo@example.com', '1');
ok('the person whose cell says "New" cannot sign in, and is told why', c.ok === false && /not active/.test(c.error), c);

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
