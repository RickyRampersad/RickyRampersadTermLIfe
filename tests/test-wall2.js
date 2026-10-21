// The new wall's feed (20 October 2026).
//
// Ricky: the wall "streams outside without client's name so the agents can see
// what is being actioned, who is doing what, who is out today, and what is
// happening throughout the day".
//
// Pinned here: never a client, a policy number, a note, a task subject or why
// someone is out, inside or out; outside also drops arrival times, lateness,
// points and dollars, and agents who have nothing to show yet; who is out and
// who is covering shows on both; tasks closed with a note land in their hour
// and their kind; the running feed is newest first; the outside link needs its
// key; the Branch Manager's sign-in gets the inside read and anyone else the
// outside one.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-20';
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = new Date(DAY + 'T11:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes'],
   ['Pawan Probhu', 'pawan', 'pawan@example.com', '1', 'Personal Assistant', 'Branch', 'Yes'],
   ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Agency', 'Yes']]);
env.__mkSheet('Attendance', 2, env.ATT.head, [
  [DAY, 'elizabeth', 'Elizabeth Lee', '06:55', '', '', 'in', '', 'elizabeth', ''],
  [DAY, 'azariah', 'Azariah Griffith', '08:12', '', '', 'in', '', 'azariah', ''],
  [DAY, 'sasha', 'Sasha Lalla-Jagassar', '', '', '', 'absent', 'Sick with the flu', 'ricky', ''],
  [DAY, 'kamla', 'Kamla Dookran', '07:58', '', '', 'in', '', 'kamla', ''],
  [DAY, 'pawan', 'Pawan Probhu', '07:50', '', '', 'in', '', 'pawan', ''],
  [DAY, 'akaash', 'Akaash Kalladeen', '06:02', '', '', 'in', '', 'akaash', '']]);
env.__mkSheet('Workload Moves', 3, env.MOVES.head, [
  [DAY, '07:00', '00TWALL00000000001', 'Premium due - 5001816653 REENA SEEPARSAN', 'Renewa/PDl/Bill', 'sasha', 'elizabeth', 'Sasha absent', 'OK', ''],
  [DAY, '07:00', '00TWALL00000000002', 'Follow up with UW - 1000894223 RAVI', 'Pendings', 'sasha', 'elizabeth', 'Sasha absent', 'OK', ''],
  [DAY, '08:15', '00TWALL00000000003', 'COB for MOHAMMED 8000123456', 'Servicing', 'sasha', 'azariah', 'Sasha absent', 'OK', '']]);
const P = env.PropertiesService.getScriptProperties();
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, sasha: { id: '005S' }, elizabeth: { id: '005E' }, azariah: { id: '005A' }, kamla: { id: '005K' } });
const utc = (hm) => { const [h, m] = hm.split(':').map(Number); return DAY + 'T' + String(h + 4).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000+0000'; };
const TASKS = [
  { Id: '00TWALL00000000001', OwnerId: '005E', Subject: 'Premium due - 5001816653 REENA SEEPARSAN', Task_Type__c: 'Renewa/PDl/Bill', ActivityDate: '2026-09-01', CompletedDateTime: utc('09:20') },
  { Id: '00TWALL00000000002', OwnerId: '005E', Subject: 'Follow up with UW - 1000894223 RAVI', Task_Type__c: 'Pendings', ActivityDate: '2026-10-19', CompletedDateTime: utc('10:05') },
  { Id: '00TWALL00000000004', OwnerId: '005A', Subject: 'Claim for JOHN DOE 7000000001', Task_Type__c: 'Claims/ Mat', ActivityDate: '2026-10-20', CompletedDateTime: utc('09:40') },
  { Id: '00TWALL00000000005', OwnerId: '005A', Subject: 'Statement for ANN 8000999999', Task_Type__c: 'Servicing', ActivityDate: '2026-10-20', CompletedDateTime: utc('09:50') }   // no note: not on the wall
];
const FEED = [
  { ParentId: '00TWALL00000000001', Body: 'Called Ms Seeparsan, she sent the bankers order receipt; forwarded to Customer Service.', CreatedById: '005E', CreatedDate: utc('09:19') },
  { ParentId: '00TWALL00000000002', Body: 'Emailed underwriting for the ECG; Mr Ravi booked the clinic for Thursday morning.', CreatedById: '005E', CreatedDate: utc('10:04') },
  { ParentId: '00TWALL00000000004', Body: 'Sent the complete death claim file to Claims with the certificate and the ID copies.', CreatedById: '005A', CreatedDate: utc('09:39') }
];
env.sfkQuery_ = q => {
  if (/FROM Task WHERE IsClosed = true AND OwnerId IN/.test(q)) return TASKS.filter(t => q.indexOf("'" + t.OwnerId + "'") > -1);
  if (/FROM FeedItem WHERE Type = 'TextPost' AND ParentId IN/.test(q)) return FEED.filter(f => q.indexOf("'" + f.ParentId + "'") > -1);
  return [];
};
env.bookRows_ = (k, tab) => k === 'QPAL' && tab === env.BOOKS.QPAL.tab ? [{ Reference: 'QP/2026/0101 Leila Jailal', Status: 'Closed', 'Date Closed': DAY + ' 10:00', 'Assigned To': 'Azariah', Turnaround: '3 days', 'Days to Close': '1', Timestamp: '10/19/2026 09:00' }] : [];
env.qpComments_ = () => ({});
env.openQueries_ = () => [{ ref: 'QP/2026/0200 X', over: true }, { ref: 'QP/2026/0201 Y', over: false }];
env.sfkOpenBook_ = () => ({ sasha: { Pendings: [{ late: true }, { late: true }] }, elizabeth: { Servicing: [{ late: true }] } });
// Agents
env.agentPeople_ = () => ({ 'a-dev': { key: 'a-dev', name: 'Devendra Singh', agentName: 'Devendra Singh', code: 'A1' }, 'a-mar': { key: 'a-mar', name: 'Marissa Khan', agentName: 'Marissa Khan', code: 'A2' },
                            'a-raj': { key: 'a-raj', name: 'Rajesh Ali', agentName: 'Rajesh Ali', code: 'A3' } });
env.agentFunnel_ = () => ({ rows: [{ name: 'Devendra Singh', ff: 6, apps: 2, pickedUp: 41000, pipeline: 90000 }, { name: 'Marissa Khan', ff: 3, apps: 1, pickedUp: 12000, pipeline: 30000 }, { name: 'Rajesh Ali', ff: 0, apps: 0, pickedUp: 0, pipeline: 0 }],
                            total: { ff: 9, apps: 3, pickedUp: 53000, pipeline: 120000 }, known: true });
env.ff360Feed_ = () => ({});
env.ff360Agent_ = (feed, names) => ({ 'Devendra Singh': { week: 2, pickedUp: 120000 }, 'Marissa Khan': { week: 1, pickedUp: 30000 }, 'Rajesh Ali': { week: 0, pickedUp: 0 } })[names[0]];
env.goalFor_ = name => ({ api: 1200000, paceApi: 69000 });
env.agentMode_ = () => true;
env.agentDaySummary_ = () => [{ name: 'Devendra Singh', hasPlan: true, hasClose: false }, { name: 'Marissa Khan', hasPlan: false, hasClose: false }, { name: 'Rajesh Ali', hasPlan: false, hasClose: false }];
env.__mkSheet('Agent Day', 4, env.AGDAY.head, [[DAY, 'a-dev', 'dev@example.com', '', 'plan', 'ff', '', 2, '', '', '07:40']]);
env.unitAgents_ = () => ['Akaash Kalladeen', 'Devendra Singh', 'Marissa Khan'];
// The Branch Manager's day
env.dayLogRows_ = () => [{ Kind: 'checkin', Group: '', What: 'Checked in', At: '05:04' }, { Kind: 'note', Group: 'New business', What: 'Note on Follow up with UW - 1000894223', At: '05:40' },
  { Kind: 'close', Group: 'Orphan clients', What: 'Closed REENA', At: '10:30' }, { Kind: 'email', Group: 'Servicing', What: 'Re: SEEPARSAN premium', At: '10:45' }];
env.dayLogSalesforce_ = () => 0;
env.myTasks_ = () => [{ ty: 'Pendings', subject: 'Follow up with UW - 1000894223 RAVI' }, { ty: 'Renewa/PDl/Bill', subject: 'Premium due 5001816653' }];
env.inboxView_ = () => ({ done: [1, 2], items: [1, 2, 3, 4] });

const inside = env.wallIntel_(DAY, false);
env.CacheService.getScriptCache().remove('wall2_out_' + DAY);
const outside = env.wallIntel_(DAY, true);
const IN = JSON.stringify(inside), OUT = JSON.stringify(outside);

console.log('\nNever on the wall, inside or out:\n');
['REENA', 'SEEPARSAN', 'RAVI', 'MOHAMMED', 'JOHN DOE', 'Leila', '5001816653', '1000894223', '8000123456', 'Premium due', 'Follow up with UW', 'bankers order', 'death claim', 'Sick', 'flu']
  .forEach(w => ok('no "' + w + '"', IN.indexOf(w) === -1 && OUT.indexOf(w) === -1));

console.log('\nOutside also leaves out:\n');
const sa = p => outside.staff.people.find(x => x.sid === p);
ok('arrival times, lateness and points', ['inAt', 'late', 'points'].every(k => outside.staff.people.every(p => !(k in p))) && !/checked in/.test(OUT));
ok('a week below their usual (progress only)', outside.staff.people.every(p => p.gain == null || p.gain >= 0));
ok('dollars', !('goal' in outside.agents.fy) && !('picked' in outside.agents.fy) && !('pickedMonth' in outside.agents) && !/41000|120000|1200000|53000/.test(OUT));
ok('agents with nothing to show yet', outside.agents.rows.length === 2 && !outside.agents.rows.some(r => r.name === 'Rajesh'));
ok('agent projection times', outside.agents.rows.every(r => !('planAt' in r)));
ok('the inbox and Query Pal past turnaround', outside.managers.inbox === null && !('over' in outside.managers.qp));

console.log('\nWho is in, who is out, who is covering:\n');
ok('Sasha is out today, on both', sa('sasha').status === 'out' && inside.staff.people.find(p => p.sid === 'sasha').status === 'out');
ok('Liz took two of hers and Azariah one', JSON.stringify(sa('sasha').coveredBy) === JSON.stringify([{ name: 'Elizabeth', n: 2 }, { name: 'Azariah', n: 1 }]), JSON.stringify(sa('sasha').coveredBy));
ok('and they show as covering', sa('elizabeth').covering === 2 && sa('azariah').covering === 1);
ok('Pawan is on the board too', sa('pawan').status === 'in' && sa('pawan').game === false);
ok('inside: in at 8:12, late 12', inside.staff.people.find(p => p.sid === 'azariah').inAt === '8:12' && inside.staff.people.find(p => p.sid === 'azariah').late === 12);
ok('the tile: 5 of 6 in, Sasha out', outside.staff.tiles.inNow === 5 && outside.staff.tiles.of === 6 && outside.staff.tiles.out.join() === 'Sasha');
ok('Akaash is on the board, as the unit manager, out of the game', (() => { const a = inside.staff.people.find(p => p.sid === 'akaash'); return a && a.status === 'in' && a.role === 'Unit manager' && a.game === false && a.inAt === '6:02'; })());

console.log('\nHour by hour, and the kind of work:\n');
ok('three closed with a note (one without a note is left off)', outside.staff.tiles.closes === 3);
ok('two in the 9 o\'clock hour, one at 10', outside.staff.team[2] === 2 && outside.staff.team[3] === 1, JSON.stringify(outside.staff.team));
ok('Liz\'s own row', JSON.stringify(sa('elizabeth').hours.slice(0, 5)) === '[0,0,1,1,0]');
const mix = Object.fromEntries(outside.staff.mix.map(m => [m.k, m.n]));
ok('retention 1, new business 1, claims 1', mix.retention === 1 && mix['new'] === 1 && mix.claims === 1, JSON.stringify(mix));
ok('two in three high-payoff', outside.staff.payoffPct === 67);
ok('the busiest hour', outside.staff.busiest.at === '9:00' && outside.staff.busiest.n === 2);
// 21 Oct 2026: the kinds inside each hour, and who has the bag.
ok('each hour carries its kinds, adding up to the hour', sa('elizabeth').hourKinds.every((k, i) => Object.values(k).reduce((x, y) => x + y, 0) === sa('elizabeth').hours[i]), JSON.stringify(sa('elizabeth').hourKinds.slice(0, 5)));
ok('the kinds across the desks match the mix', (() => { const t = {}; outside.staff.people.forEach(p => (p.hourKinds || []).forEach(h => Object.keys(h).forEach(k => t[k] = (t[k] || 0) + h[k]))); return Object.keys(mix).every(k => (t[k] || 0) === mix[k]); })());
ok('the bag: a name, the hour it leaves, and the cut-off', !!outside.staff.bag && !!outside.staff.bag.who && outside.staff.bag.h === 12 && outside.staff.bag.at === '12:00' && outside.staff.bag.cutoff === '11:45', JSON.stringify(outside.staff.bag));
ok('the bag never goes to someone out today', !outside.staff.people.some(p => p.status === 'out' && p.name === outside.staff.bag.who));

console.log('\nThe running feed:\n');
const tk = outside.ticker;
const mins = t => { const [h, m] = t.at.split(':').map(Number); return (h < 5 ? h + 12 : h) * 60 + m; };
ok('newest first', tk.every((t, i) => i === 0 || mins(tk[i - 1]) >= mins(t)) && tk.some(t => t.at === '10:05' && /Elizabeth closed a new business task with a note/.test(t.who + ' ' + t.what)), JSON.stringify(tk.slice(0, 3)));
ok('a task over a month old says so', tk.some(t => t.who === 'Elizabeth' && /retention task over a month old/.test(t.what)));
ok('cover is in it', tk.some(t => t.who === 'Azariah' && /covering for Sasha: 1 task/.test(t.what)));
ok('outside says "is in", inside "checked in"', tk.some(t => t.what === 'is in') && inside.ticker.some(t => t.what === 'checked in'));
ok('an agent\'s projection', tk.some(t => t.who === 'Devendra' && /projection/.test(t.what)));

console.log('\nAgents and managers:\n');
ok('fact finds and applications this month, conversion', outside.agents.ffMonth === 9 && outside.agents.appsMonth === 3 && outside.agents.conv === 33);
ok('the year: a percentage of the goal, against the year gone', outside.agents.fy.pct === 4.2 && outside.agents.fy.gone === 5.2, JSON.stringify(outside.agents.fy));
ok('inside: the dollars', inside.agents.fy.goal === 3600000 && inside.agents.pickedMonth === 53000);
ok('his day: by kind of work, against what waits', inside.managers.groups.length >= 2 && inside.managers.doneToday === 3);
ok('the unit: Akaash and two agents', inside.managers.unit.lead === 'Akaash' && inside.managers.unit.n === 2 && inside.managers.unit.ffMonth === 9 && inside.managers.unit.planned === 1);
ok('Query Pal answered this week', outside.managers.qp.answeredWeek === 1 && inside.managers.qp.over === 1);
ok('his agents by first name, most fact finds first', (() => { const g = inside.managers.unit.agents || []; return g.length === 2 && g[0].name === 'Devendra' && g[0].ff === 6 && g[1].name === 'Marissa' && g[0].planned === true; })(), JSON.stringify(inside.managers.unit.agents));

console.log('\nThe Branch Manager\'s day, from 5am:\n');
const bm = outside.managers.bm;
ok('three things done, the check-in not counted', bm.n === 3 && bm.notes === 1 && bm.closes === 1 && bm.emails === 1);
ok('the hours start at 5am: a note in the 5 o\'clock hour, two at 10', bm.fromH === 5 && bm.hours[0] === 1 && bm.hours[5] === 2, JSON.stringify(bm.hours));
ok('his feed says what kind, never the subject', bm.feed[0].what === 'answered an e-mail' && bm.feed.some(f => f.what === 'closed an orphan clients task') && bm.feed.some(f => f.what === 'wrote a note on a new business task'));
ok('and he is in the running feed', outside.ticker.some(t => t.who === 'Mr Rampersad' && /orphan clients task/.test(t.what)));
ok('inside: in at 5:04; outside: no time', inside.managers.bm.inAt === '5:04' && !('inAt' in bm));

console.log('\nThe links:\n');
ok('no key, no wall', env.wallOutside_('').ok === false);
const link = env.wallOutsideLink(), key = link.split('k=')[1];
ok('the link is made once', /^https:\/\/rickyrampersadbranch\.com\/wall\/\?k=[0-9A-Za-z]{8,16}$/.test(link) && env.wallOutsideLink() === link, link);
ok('a wrong key, no wall', env.handle_('wallout', { k: 'nope' }).ok === false);
const wo = env.handle_('wallout', { k: key });
ok('the right key: the outside read, no sign-in', wo.ok && wo.intel.outside === true);
env.readToken_ = t => t === 'BM' ? { staffId: 'ricky', manager: true } : { staffId: 'elizabeth', manager: false };
ok('the Branch Manager signed in: inside', env.handle_('wall2', {}, 'BM').intel.outside === false);
ok('anyone else signed in: outside', env.handle_('wall2', {}, 'LIZ').intel.outside === true);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
