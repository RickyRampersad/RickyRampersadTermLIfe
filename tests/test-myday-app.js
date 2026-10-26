// My day in the branch app (26 October 2026).
//
// Ricky, 4:49pm, the branch app open as Pawan: "MAKE AVAILABLE AS A VIEW ON THE BRANCH APPS AS MY DAY, CAN THIS BE DONE".
// My workday takes the branch app's sign-in (ops=): the tracker asks RR Operations who the token is (lb.whoami) and
// finds the desk on the Access tab by e-mail, number or first name, only among the desks of that person's role.
// Pinned here:
//   - Pawan (Staff, a branch app number the tracker does not know) gets his own day, by name
//   - Kamla by e-mail; the branch manager is ricky; a unit manager his own desk
//   - an agent who shares a staff member's first name gets nothing; an ended sign-in says to sign in again
//   - RR Operations is asked once per token (kept ten minutes); the e-mail link still works; a wrong link still refused
//   - checking in with the app's sign-in records the right desk; doGet routes wd=app&ops=
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-27';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], [
  ['Ricky.Rampersad@example.com', 'A00427 - Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
  ['akaash@example.com', 'A06869 - Akaash Kalladeen', 'A06869', '4', 'Unit Manager', 'Akaash Kalladeen', 'Active'],
  ['sasha@example.com', 'SL002 - SASHA LALLA', 'SL002', '2', 'Staff', 'SASHA LALLA', 'Active'],
  ['kamla.dookran@example.com', 'KD001 - KAMLA DOOKRAN', 'KD001', '1', 'Staff', 'KAMLA DOOKRAN', 'Active'],
  ['support@example.com', 'PB001-Pawan Prabhu', 'PB001', '1', 'Staff', 'PAWAN PRABHU', 'Active']]);
env.__mkSheet('Attendance', 2, env.ATT.head, []);
const WHO = {
  ['P'.repeat(32)]: { ok: true, name: 'Pawan Prabhu', role: 'Staff', agentNo: 'PP005', email: '' },
  ['K'.repeat(32)]: { ok: true, name: 'Kamla D.', role: 'Staff', agentNo: '', email: 'KAMLA.DOOKRAN@example.com' },
  ['R'.repeat(32)]: { ok: true, name: 'Ricky Rampersad', role: 'Branch Manager', agentNo: 'A00427', email: '' },
  ['U'.repeat(32)]: { ok: true, name: 'Akaash Kalladeen', role: 'Unit Manager', agentNo: 'A06869', email: '' },
  ['G'.repeat(32)]: { ok: true, name: 'Sasha Persad', role: 'Agent', agentNo: 'A09999', email: '' },
  ['X'.repeat(32)]: { ok: false, error: 'signed-out' }
};
let calls = [];
env.UrlFetchApp = { fetch: (url, o) => { const b = JSON.parse(o.payload); calls.push(b); return { getContentText: () => JSON.stringify(WHO[b.token] || { ok: false }) }; } };
env.workdayModel_ = (sid, day) => ({ ok: true, sid, day });
const get = t => env.workdayGet_({ wd: 'app', ops: t.repeat(32) });

ok('Pawan, by name: his own day', get('P').sid === 'pawan', JSON.stringify(get('P')));
ok('it asked RR Operations who the token is', calls.length === 1 && calls[0].action === 'lb.whoami');
get('P');
ok('and kept the answer (one call per token)', calls.length === 1, String(calls.length));
ok('Kamla, by e-mail', get('K').sid === 'kamla');
ok('the branch manager is his own desk', get('R').sid === 'ricky');
ok('a unit manager, his own desk', get('U').sid === 'akaash');
const ag = get('G');
ok('an agent named Sasha is not Sasha\'s day', ag.ok === false && /branch staff and managers/.test(ag.error), JSON.stringify(ag));
const gone = get('X');
ok('an ended sign-in says to sign in again', gone.ok === false && /Sign in again at rickyrampersadbranch.com\/app/.test(gone.error));
ok('the e-mail link still opens', env.workdayGet_({ wd: 'sasha', k: env.workSig_('sasha') }).sid === 'sasha');
ok('a wrong link is still refused', env.workdayGet_({ wd: 'sasha', k: 'bad' }).ok === false);
let ci = null; env.sdCheckin_ = (person) => { ci = person.staffId; return { at: '16:55', first: true }; };
const r = env.workdayPost_({ wd: 'app', ops: 'P'.repeat(32), act: 'checkin' });
ok('checking in with the app\'s sign-in records his desk', ci === 'pawan' && r.ok !== false && r.checkedIn && r.checkedIn.first === true, JSON.stringify(r));
const out = env.doGet({ parameter: { wd: 'app', ops: 'P'.repeat(32) }, parameters: {} });
const body = out && out.getContent ? out.getContent() : String(out && out.content || '');
ok('doGet answers wd=app&ops= with his day', /"sid":"pawan"/.test(body), body.slice(0, 120));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
