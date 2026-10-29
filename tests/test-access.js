// The Access tab with the agent number in front of each name (19 October 2026).
//
// Ricky put the agent number in column C and the password in column D, and the
// names now read the way the Skill Bank writes them: "A06869 - Akaash
// Kalladeen", "KD001 - KAMLA DOOKRAN", "EL -004 - Elizabeth lee". Everything in
// the tracker knows a person by the first word of their name, so before this
// Akaash became "a06869" and his Unit Manager mail had no address.
//
// Pinned here: the number comes off the front and the person keeps their id
// (ricky, akaash, kamla, elizabeth, sasha); names in capitals or with a small
// letter read normally; anyone can sign in with their agent number however it
// is typed (AG003, ag-003, AG 003); a plain name still works as before.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  [['ricky@example.com', 'A00427 - Ricky Rampersad', 'A00427', 'p1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
   ['akaash@example.com', 'A06869 - Akaash Kalladeen', 'A06869', 'p2', 'Unit Manager', 'Akaash Kalladeen', 'Active'],
   ['kamla@example.com', 'KD001 - KAMLA DOOKRAN', 'KD001', 'p3', 'Staff', 'KAMLA DOOKRAN', 'Active'],
   ['liz@example.com', 'EL -004 - Elizabeth lee', 'EL004', 'p4', 'Staff', 'Elizabeth', 'Active'],
   ['azariah@example.com', 'AG-003 - Azariah Griffith', '', 'p5', 'Staff', 'Azariah', 'Active'],
   ['sasha@example.com', 'SL002 - SASHA LALLA-JAGASSAR', 'SL002', 'p6', 'Staff', 'Sasha', 'Active'],
   ['pawan@example.com', 'Pawan Probhu', '', 'p7', 'Personal Assistant', 'Branch', 'Active'],
   ['javid@example.com', 'A04020 - Javid Ali', 'A04020', 'p8', 'Agent', 'Ricky Rampersad', 'Not Active']]);

console.log('\nWho is who:\n');
const r = env.roster_();
const by = Object.fromEntries(r.map(p => [p.staffId, p]));
ok('the ids are the first names, not the numbers', ['ricky', 'akaash', 'kamla', 'elizabeth', 'azariah', 'sasha', 'pawan', 'javid'].every(k => by[k]), r.map(p => p.staffId).join(','));
ok('the names read normally', by.ricky.name === 'Ricky Rampersad' && by.kamla.name === 'Kamla Dookran' && by.elizabeth.name === 'Elizabeth Lee' && by.sasha.name === 'Sasha Lalla-Jagassar' && by.pawan.name === 'Pawan Probhu',
  [by.kamla.name, by.elizabeth.name, by.sasha.name].join(' | '));
ok('the agent number from column C, or from the front of the name when C is blank', by.akaash.agentNumber === 'A06869' && by.azariah.agentNumber === 'AG003');
ok('e-mail found by the person, as before', env.emailFor_('akaash') === 'akaash@example.com' && env.emailFor_('kamla') === 'kamla@example.com' && env.nameFor_('akaash') === 'Akaash Kalladeen');
ok('Not Active is not active', by.javid.active === false && by.ricky.active === true);

console.log('\nSigning in with the agent number:\n');
const L = (w, p) => { env.resetRequestMemo_ && env.resetRequestMemo_(); try { return env.login_(w, p); } catch (e) { return { ok: false, error: e.message }; } };
ok('A06869 and its password', L('A06869', 'p2').ok === true, JSON.stringify(L('A06869', 'p2')).slice(0, 80));
ok('typed small, or with a dash or a space', L('kd001', 'p3').ok === true && L('AG-003', 'p5').ok === true && L('el 004', 'p4').ok === true);
ok('the wrong password is still refused', L('A06869', 'nope').ok === false);
ok('e-mail still works', L('ricky@example.com', 'p1').ok === true);
ok('a person who is Not Active cannot sign in', L('A04020', 'p8').ok === false);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
