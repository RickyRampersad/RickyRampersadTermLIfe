// "Who is working for you" and the licence line in the agent's morning brief (8 Nov 2026).
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-11-09', env = makeEnv(); env.todayISO_ = () => DAY;
const A = { key: 'a-neil', name: 'Neil Ramnanan', email: 'neil@example.com' };
env.cmdChatter_ = () => ({
  T1: [{ text: 'Sales Support · Azariah Griffith · Fri: Awaiting the agent to send the signed form', day: '2026-11-06' }],
  T2: [{ text: 'Chased underwriting, waiting on underwriting for the medical', day: '2026-11-08' }],
  T3: [{ text: 'Called client, left message', day: '2026-10-28' }] });
const open = [
  { id: 'T1', subject: 'Pendings: signed form - Ana Test', ty: 'Pendings', due: '2026-11-06', late: true, owner: 'Azariah Griffith' },
  { id: 'T2', subject: 'UWPRO: medical - Ben Test', ty: 'Pendings', due: DAY, late: false, owner: 'Azariah Griffith' },
  { id: 'T3', subject: 'Premium owed - Cal Test', ty: 'Renewa/PDl/Bill', due: '2026-10-28', late: true, owner: 'Sasha Lalla' }];
const w = env.agStaffWork_(A, DAY, open, [{}, {}]);
ok('one waiting on the agent', w.waitingOnYou === 1, String(w.waitingOnYou));
ok('grouped by who has it: Azariah first (she waits on him), then Sasha', w.html.indexOf('Azariah') < w.html.indexOf('Sasha') && /Azariah <span[^>]*>· 2 for you/.test(w.html));
ok('the task waiting on him is tagged and asks him to answer Azariah', /WAITING ON YOU/.test(w.html) && /answer Azariah/.test(w.html));
ok('what the other waits on is said', /Waiting on underwriting/.test(w.html));
ok('12 days overdue and quiet: needs a push', /NEEDS A PUSH/.test(w.html) && /overdue 12d/.test(w.html));
ok('every task opens its Chatter on My day', (w.html.match(/go=agitems/g) || []).length === 3);
ok('Query Pal counted', /Query Pal: 2/.test(w.html));
ok('licence: shown only in its month', /falls due this month/.test(env.agLicenceLine_({ life: '2019-11-21', gen: '' }, DAY)) && env.agLicenceLine_({ life: '2019-06-11', gen: '' }, DAY) === '');
ok('a placeholder general licence (1901) is never shown', env.agLicenceLine_({ life: '', gen: '1901-11-01' }, DAY) === '');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
