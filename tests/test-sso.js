// The branch app's one sign-in (18 October 2026): a tool in another project opens as the person an RR Operations
// session token belongs to, asked of RR Operations, never with a password.
// Run: node tests/test-sso.js
const path = require('path');
const AS = f => path.join(__dirname, '..', 'apps-script', f);
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const TOKEN = 'abcdef0123456789abcdef0123456789abcdef01';
function load(files, whoami) {
  delete require.cache[require.resolve('./harness')];
  process.env.GS_PATH = files.map(AS).join(',');
  const { makeEnv } = require('./harness');
  const env = makeEnv({ props: {} });
  env.__asked = [];
  env.UrlFetchApp = { fetch: (u, o) => {
    const b = JSON.parse(o.payload); env.__asked.push({ u, b });
    const out = b.token === TOKEN ? Object.assign({ ok: true }, whoami) : { ok: false, error: 'signed-out' };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(out) };
  } };
  return env;
}

/* the clients board, group clients and the walls (Transition.gs) */
let e = load(['Transition.gs'], { name: 'Ann Agent', role: 'Agent', agentNo: 'A00427' });
e.SVC = { TEAM_CODE: 'BRANCHX' };
const people = [
  { name: 'Ann Agent', no: 'A00427', active: true, role: 'agent', roleText: 'Agent' },
  { name: 'Uma Lead', no: 'A00777', active: true, role: 'um', roleText: 'Unit Manager' },
  { name: 'Ricky Boss', no: 'A00001', active: true, role: 'bm', roleText: 'Branch Manager' },
  { name: 'Gone Agent', no: 'A00999', active: true, role: 'agent', roleText: 'Agent' }];
e.tTeam_ = () => ({ people });
e.tFormer_ = () => ({ [e.tNameKey_('Gone Agent')]: 1 });
e.tUnitOf_ = () => [];
let w = e.tWho_('OPS:' + TOKEN, 'someone else');
ok('a token opens the board as the person it belongs to', w.ok && w.role === 'agent' && w.me.name === 'Ann Agent', JSON.stringify(w));
ok('RR Operations was asked who the token is, with the token only', e.__asked.length === 1 && e.__asked[0].b.action === 'lb.whoami' && !('code' in e.__asked[0].b));
e.tWho_('OPS:' + TOKEN, '');
ok('the answer is kept: a second request asks nobody', e.__asked.length === 1);
w = e.tWho_('OPS:' + TOKEN.replace(/a/g, 'b'), '');
ok('an unknown token opens nothing, and says to sign in again', !w.ok && w.refused && /Sign in again/.test(w.error));
ok('the walls stay closed to an agent', e.tCodeOk_('OPS:' + TOKEN).ok === false);
ok('the branch code still opens them', e.tCodeOk_('branchx').ok === true);

e = load(['Transition.gs'], { name: 'Ricky Boss', role: 'Branch Manager', agentNo: '1' });
e.SVC = { TEAM_CODE: 'BRANCHX' }; e.tTeam_ = () => ({ people }); e.tFormer_ = () => ({}); e.tUnitOf_ = () => [];
ok('the branch manager opens the walls and the dashboard', e.tCodeOk_('OPS:' + TOKEN).ok === true);
ok('the branch manager opens the whole board', e.tWho_('OPS:' + TOKEN, '').role === 'branch');

e = load(['Transition.gs'], { name: 'Gone Agent', role: 'Agent', agentNo: 'A00999' });
e.SVC = { TEAM_CODE: 'BRANCHX' }; e.tTeam_ = () => ({ people }); e.tFormer_ = () => ({ [e.tNameKey_('Gone Agent')]: 1 }); e.tUnitOf_ = () => [];
ok('someone who was the agent on these books never opens, token or not', !e.tWho_('OPS:' + TOKEN, '').ok);

e = load(['Transition.gs'], { name: 'Sasha Lalla', role: 'Staff', agentNo: '' });
e.SVC = { TEAM_CODE: 'BRANCHX' };
e.tTeam_ = () => ({ people: people.concat([{ name: 'SASHA LALLA', no: '', active: true, role: 'staff', roleText: 'Client Support' }]) });
e.tFormer_ = () => ({}); e.tUnitOf_ = () => [];
w = e.tWho_('OPS:' + TOKEN, '');
ok('staff with no agent number are found by name', w.ok && w.role === 'staff', JSON.stringify(w));

/* the Premium Due Desk (Intelligence.gs) */
e = load(['Intelligence.gs'], { name: 'Ann Agent', role: 'Agent', agentNo: 'A00427', email: 'ann@example.com' });
let asked = [];
e.iFindPerson_ = (who, secret, trusted) => { asked.push([who, secret, trusted]); return who === 'A00427' && trusted ? { name: 'Ann Agent', role: 'agent', title: 'Agent', tab: 'Access' } : null; };
e.iIssueSession_ = () => ({ token: 'PDD1', expires: 'later' });
e.iLogAction_ = () => {};
let r = JSON.parse(e.iActSsoIn_({ ops: TOKEN }).getContent ? e.iActSsoIn_({ ops: TOKEN }).getContent() : '{}');
ok('the desk opens its own session for the person, no code asked', r.ok && r.token === 'PDD1' && asked[0][0] === 'A00427' && asked[0][2] === true, JSON.stringify(r));
r = JSON.parse(e.iActSsoIn_({ ops: 'nope' }).getContent());
ok('a bad token opens no desk session', !r.ok);

console.log(fails ? '\n' + fails + ' failed' : '\nall passed');
process.exit(fails ? 1 : 0);
