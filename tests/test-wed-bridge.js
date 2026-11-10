// Wednesday: what each agent brings, and what we are observing, carried from the tracker onto the meeting builder (10 Nov 2026).
// Two projects in one test: the tracker (KPI.gs) and the meeting builder (Meetings.gs), joined by a fake UrlFetchApp that hands
// the tracker's signed POST straight to the meeting builder's doPost.
const path = require('path'), ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };

process.env.GS_PATH = path.join(ROOT, 'apps-script/Meetings.gs');
const { makeEnv } = require('./harness');
const M = makeEnv();
M.DriveApp = { createFolder: n => ({ getId: () => 'f1', getName: () => n, setSharing() { return this; } }), getFolderById: id => ({ getId: () => id, getName: () => 'Branch Meeting Materials' }), Access: {}, Permission: {} };
M.setupMeetings && M.setupMeetings();
M.appendRow_(M.MEET.TAB_PEOPLE, { 'Agent No': 'A10024', 'Email': 'neil@example.com', 'Name': 'Neil Ramnanan', 'Role': 'agent', 'Active': 'Y' });
const WED = '2026-11-11';
M.appendRow_(M.MEET.TAB_MEETINGS, { 'ID': 'MTG-1', 'Ref': 'W1', 'Type': 'Branch Meeting', 'Title': 'Branch meeting', 'Date': new Date(WED + 'T13:00:00Z'), 'Status': 'published', 'Scope': 'branch' });
[['AG-1', 'The production board'], ['AG-2', 'What worked for me'], ['AG-3', 'Training — one point, taught by one of us'], ['AG-4', 'Open floor']]
  .forEach(([id, t], i) => M.appendRow_(M.MEET.TAB_AGENDA, { 'ID': id, 'Meeting ID': 'MTG-1', 'Order': (i + 1) * 10, 'Title': t }));
M.PropertiesService.getScriptProperties().setProperty('MEET_BRIDGE_KEY', 'shared-secret');

process.env.GS_PATH = path.join(ROOT, 'apps-script/KPI.gs');
const K = makeEnv();
const TUE = '2026-11-10'; K.todayISO_ = () => TUE;
const P = K.PropertiesService.getScriptProperties(); P.setProperty('AGENT_DAY', 'live'); P.setProperty('MANAGER_EMAIL', 'ricky@example.com');
const N = { key: 'a-neil', name: 'Neil Ramnanan', agentName: 'Neil Ramnanan', code: 'A10024', email: 'neil@example.com', manager: 'akaash@example.com' };
const F = { key: 'a-fel', name: 'Felicia Rampersad', agentName: 'Felicia Rampersad', code: 'A20000', email: 'fel@example.com', manager: 'akaash@example.com' };
const R = { key: 'a-raj', name: 'Rajiv Soodoo', agentName: 'Rajiv Soodoo', code: 'A30000', email: 'raj@example.com', manager: 'akaash@example.com' };
K.agentPeople_ = () => ({ [N.key]: N, [F.key]: F, [R.key]: R }); K.agentLiveFor_ = () => true;
K.agentManagerEmail_ = a => a.manager; K.emailFor_ = s => ({ kamla: 'kamla@example.com' })[s] || '';
K.__mkSheet('Agent Day', 1, K.AGDAY.head, []);
const mails = []; K.mailSend_ = o => { mails.push(o); return 'relay'; };
let calls = 0;
K.UrlFetchApp = { fetch: (url, o) => { calls++; const out = M.doPost({ postData: { contents: o.payload } }); const t = out.getContent ? out.getContent() : String(out); return { getContentText: () => t }; } };

console.log('\nWithout the link set, a commitment is kept and waits:\n');
let r = K.wedSave_(N, TUE, { kind: 'case', text: 'Saved a lapsing premium by moving it to salary deduction' });
ok('saved, not sent, with the reason', r.ok && !r.sent && /MEET_URL/.test(r.status), JSON.stringify(r));
ok('nothing went across', calls === 0);
ok('My day shows it, for Wed 11 Nov', (() => { const w = K.wedModel_(N, TUE, null); return w.meet === WED && w.mine.length === 1 && w.mine[0].label === 'A case that worked'; })());

console.log('\nThe link set: the evening sends what waited, and the observations:\n');
P.setProperty('MEET_URL', 'https://example/exec'); P.setProperty('MEET_BRIDGE_KEY', 'shared-secret');
// the week's morning reads: Felicia no fact finds three mornings, Rajiv ahead, Neil pipeline
[['2026-11-05', F, 'prospect'], ['2026-11-06', F, 'prospect'], ['2026-11-09', F, 'prospect'], ['2026-11-09', R, 'onpace'], ['2026-11-10', N, 'pipeline']]
  .forEach(([d, a, k]) => K.agWrite_(a, d, 'obs', [{ Item: k, Question: '', Note: '' }]));
const out = K.wedTick_(TUE);
ok('Neil\'s case went across', out.some(x => /Neil Ramnanan case across/.test(x)), out.join(' | '));
ok('the observations went on under Training', out.some(x => /observations: on the meeting under Training/.test(x)), out.join(' | '));
const con = M.readTab_(M.MEET.TAB_CONTRIB);
const nc = con.find(c => /^A case that worked/.test(c['Body']));
ok('Neil\'s case is on What worked for me, brought in beforehand, for all to see', nc && nc['Agenda ID'] === 'AG-2' && Number(nc['Offset (min)']) === -1 && nc['Visibility'] === 'all' && nc['Name'] === 'Neil Ramnanan', JSON.stringify(nc));
const ob = con.find(c => c['Name'] === 'Branch Intelligence');
ok('the observation note is staff only, under Training', ob && ob['Agenda ID'] === 'AG-3' && ob['Visibility'] === 'staff');
ok('it names the development area and who it is for', ob && /Booking fact finds[^\n]*Felicia \(3 of 3 mornings\)/.test(ob['Body']), ob && ob['Body']);
ok('it names Rajiv as ahead of plan, and suggests the training point with him to teach it', ob && /ahead of plan: Rajiv/.test(ob['Body']) && /SUGGESTED TRAINING POINT: How I book a fact find from a cold name\. Who could teach it: Rajiv/.test(ob['Body']), ob && ob['Body']);
ok('it says who has not committed', ob && /NOT YET COMMITTED: Felicia, Rajiv/.test(ob['Body']));
ok('once an evening', K.wedTick_(TUE).length === 0);
ok('the morning brief reads it as on the agenda now', /^on the agenda: What worked for me/.test(K.wedMine_(N, WED)[0].status), K.wedMine_(N, WED)[0].status);

console.log('\nCommitting on the day, and changing it:\n');
r = K.wedSave_(F, TUE, { kind: 'question', text: 'How do you get a referral to agree to a fact find?' });
ok('Felicia\'s question goes straight on the Open floor', r.ok && r.sent && /Open floor/.test(r.status), JSON.stringify(r));
r = K.wedSave_(F, TUE, { kind: 'question', text: 'How do you turn a referral into a booked fact find in one call?' });
const fq = M.readTab_(M.MEET.TAB_CONTRIB).filter(c => /^A question for the room/.test(c['Body']));
ok('changing it rewrites the one row, it does not add a second', fq.length === 1 && /one call/.test(fq[0]['Body']) && fq[0]['Kind'] === 'Question');
mails.length = 0;
r = K.wedSave_(R, TUE, { kind: 'help', text: 'Need a joint visit with a business owner next week' });
const hc = M.readTab_(M.MEET.TAB_CONTRIB).find(c => /^Help I need/.test(c['Body']));
ok('help is staff only on the meeting', hc && hc['Visibility'] === 'staff' && hc['Kind'] === 'Concern');
ok('and goes to the manager now, Kamla copied', mails.some(m => m.to === 'akaash@example.com' && m.cc === 'kamla@example.com' && /asked for help/.test(m.subject)));
ok('too short is refused', !K.wedSave_(N, TUE, { kind: 'idea', text: 'more calls' }).ok);
ok('no kind is refused', !K.wedSave_(N, TUE, { kind: '', text: 'A perfectly long enough line here' }).ok);

console.log('\nThe door only opens to the tracker:\n');
const bad = JSON.parse(M.doPost({ postData: { contents: JSON.stringify({ action: 'bridge', op: 'commit', ts: Date.now(), payload: { kind: 'idea', text: 'forged one here', ref: 'x', date: WED }, sig: 'nope' }) } }).getContent());
ok('a forged signature is refused', !bad.ok && /Not signed/.test(bad.error));
const old = Date.now() - 11 * 60 * 1000, pl = { kind: 'idea', text: 'an old replay of a call', ref: 'y', date: WED };
const stale = JSON.parse(M.doPost({ postData: { contents: JSON.stringify({ action: 'bridge', op: 'commit', ts: old, payload: pl, sig: M.bridgeSign_('commit|' + old + '|' + JSON.stringify(pl), 'shared-secret') }) } }).getContent());
ok('a call older than ten minutes is refused', !stale.ok && /Too old/.test(stale.error));
ok('the meeting builder\'s ping says the bridge is set', M.apiPing_().bridge === true);

console.log('\nThe manager\'s 6pm e-mail carries it:\n');
const rm = K.agentRollupMail_('akaash@example.com', [N, F, R], TUE);
ok('who is bringing what, and the development observed', /For Wednesday, Wed 11 Nov/.test(rm.html) && /Neil · A case that worked/.test(rm.html) && /Booking fact finds/.test(rm.html) && /Suggested training point/.test(rm.html), '');

console.log('\nThe meeting day: before 9:00 it is today\'s meeting, after it the next one:\n');
ok('Wed 8:30 is today', K.wedMeetingFor_(WED, 8 * 60 + 30) === WED);
ok('Wed 10:00 is next week', K.wedMeetingFor_(WED, 10 * 60) === '2026-11-18');
ok('Sunday is the coming Wednesday', K.wedMeetingFor_('2026-11-08', 600) === WED);

console.log('\nThe morning brief:\n');
const mm = K.wedMailCard_(N, TUE, K.wedModel_(N, TUE, { kind: 'onpace' }));
ok('Neil, committed: it names what he is bringing', /You are bringing to Wed 11 Nov/.test(mm) && /A case that worked/.test(mm));
const nm = K.wedMailCard_({ key: 'a-x', name: 'X Y' }, TUE, K.wedModel_({ key: 'a-x', name: 'X Y' }, TUE, { kind: 'prospect' }));
ok('someone not committed gets the read as the ask', /Fact finds have been slow/.test(nm) && /Commit one thing for Wed 11 Nov/.test(nm) && /go=agwed/.test(nm));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green'); process.exit(fails ? 1 : 0);
