// The agents' My day, and the register on My day (27 October 2026).
//
// Ricky, 7:40am: "if they dont get the trigger point them to the branch app log in link"; 7:44am: "seeing liz was also
// absent yesterday and sasha was absent yesterday, so the attendance log must be visible". Pinned here:
//   - an agent signed in to the Branch App gets Project my day and Close off my day (the e-mails' own pages), found by
//     e-mail, number or name; today's list is made then if the 5:30 e-mail never went; posting does nothing
//   - an agent outside the pilot is told it is coming; one not on the list is told to ask
//   - his and Kamla's My day carry the last five working days: in, late, absent with the reason, NO RECORD
//   - Mark absent: he for any desk, Kamla for hers (not Pawan), never a day someone signed in, never ahead
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-27';
const env = makeEnv();
env.todayISO_ = () => DAY;
const realDate = env.Date; let NOW = new Date(DAY + 'T09:10:00');
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); }, get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], [
  ['ricky@example.com', 'A00427 - Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
  ['sasha@example.com', 'SL002 - SASHA LALLA', 'SL002', '2', 'Staff', 'SASHA LALLA', 'Active'],
  ['liz@example.com', 'EL001 - ELIZABETH LEE', 'EL001', '2', 'Staff', 'ELIZABETH LEE', 'Active'],
  ['azariah@example.com', 'AG001 - AZARIAH GRIFFITH', 'AG001', '2', 'Staff', 'AZARIAH GRIFFITH', 'Active'],
  ['kamla@example.com', 'KD001 - KAMLA DOOKRAN', 'KD001', '1', 'Staff', 'KAMLA DOOKRAN', 'Active'],
  ['support@example.com', 'PB001-Pawan Prabhu', 'PB001', '1', 'Staff', 'PAWAN PRABHU', 'Active']]);
const att = (o) => env.ATT.head.map(h => o[h] != null ? o[h] : '');
env.__mkSheet('Attendance', 2, env.ATT.head, [
  att({ Date: '2026-10-26', StaffId: 'azariah', Name: 'Azariah Griffith', FirstSignIn: '07:56', Status: 'in', MarkedBy: 'azariah' }),
  att({ Date: '2026-10-26', StaffId: 'kamla', Name: 'Kamla Dookran', FirstSignIn: '10:40', Status: 'in', MarkedBy: 'kamla' }),
  att({ Date: '2026-10-26', StaffId: 'pawan', Name: 'Pawan Prabhu', Status: 'absent', Reason: 'No sign-in by 4:49pm (automatic)', MarkedBy: 'tracker' }),
  att({ Date: '2026-10-27', StaffId: 'azariah', Name: 'Azariah Griffith', FirstSignIn: '07:58', Status: 'in', MarkedBy: 'azariah' })]);

console.log('\nThe agents:\n');
const AG = {
  'a-neil-ramnanan': { key: 'a-neil-ramnanan', name: 'Neil Ramnanan', agentName: 'Neil Ramnanan', agentId: 'A10024', code: 'A10024', email: 'neil@example.com', manager: 'akaash@example.com' },
  'a-kevin-ali': { key: 'a-kevin-ali', name: 'Kevin Ali', agentName: 'Kevin Ali', agentId: 'A55555', code: 'A55555', email: 'kevin@example.com', manager: '' } };
env.agentPeople_ = () => AG;
let batch = 0; env.agentBatchData_ = (list) => { batch++; return { open: { 'a-neil-ramnanan': [{ id: '00T1', subject: 'Premium due - Marcus Bailey', owner: 'Sasha', due: '2026-10-26', late: true }] } }; };
const WHO = {
  ['N'.repeat(32)]: { ok: true, name: 'Neil Ramnanan', role: 'Agent', agentNo: '', email: 'NEIL@example.com' },
  ['M'.repeat(32)]: { ok: true, name: 'N. Ramnanan', role: 'Agent', agentNo: 'a-10024', email: '' },
  ['V'.repeat(32)]: { ok: true, name: 'Kevin Ali', role: 'Agent', agentNo: 'A55555', email: '' },
  ['Z'.repeat(32)]: { ok: true, name: 'Nobody Here', role: 'Agent', agentNo: 'A00001', email: '' },
  ['R'.repeat(32)]: { ok: true, name: 'Ricky Rampersad', role: 'Branch Manager', agentNo: 'A00427', email: '' },
  ['K'.repeat(32)]: { ok: true, name: 'Kamla', role: 'Staff', agentNo: '', email: 'kamla@example.com' } };
env.UrlFetchApp = { fetch: (url, o) => { const b = JSON.parse(o.payload || '{}'); return { getContentText: () => JSON.stringify(WHO[b.token] || { ok: false }), getResponseCode: () => 200 }; } };
const get = t => env.workdayGet_({ wd: 'app', ops: t.repeat(32) });
const n = get('N');
ok('Neil, by e-mail: his agent day', n.ok && n.agent && n.first === 'Neil' && n.on === true, JSON.stringify(n).slice(0, 160));
ok('Project my day opens the e-mail\'s own page', /rs=a-neil-ramnanan&d=2026-10-27&f=ag&k=/.test(n.project.url) && n.project.done === false && n.project.by === '10:30am');
ok('Close off my day too, at 5:30', /f=agc&k=/.test(n.close.url) && n.close.at === '5:30pm' && n.close.open === false);
ok('no 5:30 e-mail: today\'s list made now, as the e-mail would have', batch === 1 && env.bigGet_('ag_items_a-neil-ramnanan_' + DAY, []).length === 1);
get('N'); ok('and only once', batch === 1);
ok('by number too', get('M').first === 'Neil');
const k = get('V');
ok('an agent outside the pilot is told it is coming, with no pages', k.ok && k.agent && k.on === false && !k.project, JSON.stringify(k));
const z = get('Z');
ok('one not on the list is told to ask', z.ok === false && /list of agents/.test(z.error));
ok('an agent posting does nothing', env.workdayPost_({ wd: 'app', ops: 'N'.repeat(32), act: 'checkin' }).ok === false);
NOW = new Date(DAY + 'T12:05:00');
ok('after midday the close-off is open', get('N').close.open === true);

console.log('\nThe register on My day:\n');
NOW = new Date(DAY + 'T09:10:00');
const A = env.workdayAtt_('ricky', DAY);
const cell = (sid, d) => { const i = A.days.findIndex(x => x.d === d); return A.desks.filter(x => x.sid === sid)[0].cells[i]; };
ok('the last five working days, Wednesday to today', A.days.map(d => d.l).join(',') === 'Wed 21,Thu 22,Fri 23,Mon 26,Tue 27', A.days.map(d => d.l).join(','));
ok('Monday: Liz and Sasha NO RECORD', cell('elizabeth', '2026-10-26').st === 'none' && cell('sasha', '2026-10-26').st === 'none');
ok('Azariah in at 7:56 Monday (8 to 4 this week: on time)', cell('azariah', '2026-10-26').st === 'in' && cell('azariah', '2026-10-26').t === '7:56am');
ok('Kamla 10:40 Monday reads late', cell('kamla', '2026-10-26').st === 'late' && cell('kamla', '2026-10-26').late > 0);
ok('Pawan absent Monday, by the clock', cell('pawan', '2026-10-26').st === 'absent' && cell('pawan', '2026-10-26').auto === true);
ok('today: Azariah in, Sasha not in yet at 9:10 (8 to 4 this week)', cell('azariah', DAY).st === 'in' && cell('sasha', DAY).st === 'notin');
ok('he may mark every desk', A.desks.every(d => d.mark));
const KA = env.workdayAtt_('kamla', DAY);
ok('Kamla may mark Sasha, Liz and Azariah, not Pawan or herself', KA.desks.filter(d => d.mark).map(d => d.sid).sort().join() === 'azariah,elizabeth,sasha', KA.desks.filter(d => d.mark).map(d => d.sid).join());
env.workdayModel_ = (sid, day) => ({ ok: true, sid, day, att: env.workdayAtt_(sid, day) });
const post = (t, o) => env.workdayPost_(Object.assign({ wd: 'app', ops: t.repeat(32), act: 'absent' }, o));
let r = post('R', { who: 'elizabeth', date: '2026-10-26', why: 'Sick' });
ok('he marks Liz sick for Monday', r.ok && r.marked && r.att.desks.filter(d => d.sid === 'elizabeth')[0].cells[3].st === 'absent' && r.att.desks.filter(d => d.sid === 'elizabeth')[0].cells[3].why === 'Sick', JSON.stringify(r).slice(0, 200));
ok('the register row says who marked it', (() => { const a = env.attRow_(env.hrRows_(env.ATT, true), '2026-10-26', 'elizabeth'); return a && a.row.Status === 'absent' && a.row.MarkedBy === 'ricky'; })());
r = post('K', { who: 'sasha', date: '2026-10-26', why: 'On leave' });
ok('Kamla marks Sasha on leave', r.ok && env.workdayAtt_('ricky', DAY).desks.filter(d => d.sid === 'sasha')[0].cells[3].why === 'On leave');
ok('Kamla cannot mark Pawan', post('K', { who: 'pawan', date: '2026-10-26', why: 'Sick' }).ok === false);
ok('nobody marks a day someone signed in', /signed in/.test(post('R', { who: 'azariah', date: '2026-10-26', why: 'Sick' }).error || ''));
ok('nor a day ahead, nor without a reason', post('R', { who: 'sasha', date: '2026-10-28', why: 'Sick' }).ok === false && post('R', { who: 'sasha', date: '2026-10-23', why: '' }).ok === false);
ok('a desk cannot mark anyone', post('N', { who: 'sasha', date: '2026-10-26', why: 'Sick' }).ok === false);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
