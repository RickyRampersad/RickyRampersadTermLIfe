// The strategic meeting page's backend, apps-script/StrategicMeeting.gs, run under the fake Sheets
// with the board's sign-in, the stream and the Claude call stubbed. 20 October 2026: "build a
// framework with all you have under rickyrampersadbranch/strategic meeting so you can have the
// days and topics and make a contribution, you and Akaash can log in to contribute items and
// business intelligence can guide you".
//
// What it holds the script to: the branch manager and a unit manager write, staff and agents
// read; a contribution lands on the Strategic Meeting tab and comes back; a removal keeps the
// row and takes it off the list; the live facts are counts and never a name; the AI guide sees
// the session, the notes, the counts and the contributions, is refused without a key, and is
// read once per session and set of contributions. Then the page and Service.gs against it.
//
// Run: node tests/test-strategic-meeting.js   (needs nothing but node)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/StrategicMeeting.gs');
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

/* ── the project around it, stubbed ── */
env.ss_ = () => env.SpreadsheetApp.getActiveSpreadsheet();
env.tTz_ = () => 'America/Port_of_Spain';
env.tNameKey_ = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const PEOPLE = {
  BRANCH: { ok: true, role: 'branch', me: null, viaBranch: false },
  AKAASH: { ok: true, role: 'unit', me: { name: 'Akaash Kalladeen', title: 'Unit Manager' }, team: ['Neil Ramnanan'] },
  SASHA:  { ok: true, role: 'staff', me: { name: 'Sasha Lalla', title: 'Staff' } },
  NEIL:   { ok: true, role: 'agent', me: { name: 'Neil Ramnanan', title: 'Agent' } },
};
env.tWho_ = (code, who) => PEOPLE[String(code || '').toUpperCase()] || { ok: false, refused: true, configured: true, error: 'That agent number and password do not match.' };
env.tTeam_ = () => ({ people: [
  { name: 'Ricky Rampersad', role: 'bm', active: true }, { name: 'Akaash Kalladeen', role: 'um', active: true, unit: 'Akaash Kalladeen' },
  { name: 'Neil Ramnanan', role: 'agent', active: true, unit: 'Akaash Kalladeen' }, { name: 'Anita Example', role: 'agent', active: true, unit: 'Ricky Rampersad' },
  { name: 'Gone Away', role: 'agent', active: true }, { name: 'Sasha Lalla', role: 'staff', active: true }, { name: 'Old Hand', role: 'agent', active: false } ] });
env.tFormer_ = () => ({ goneaway: true });
let streamCalls = 0, streamThrows = false;
env.T_STREAM = { KEY: 'x' };
env.tServeCached_ = (c, build) => build();
env.tStream_ = () => { streamCalls++; if (streamThrows) throw new Error('board down'); return { ok: true, at: '20 Oct 2026 09:00', hh: { all: 2168, answered: 410 }, clients: { all: 2333, answered: 480 },
  auto: { letters: 1477, reminders: 1199, afterReminder: 128 }, people: { week: 57, reachedWeek: 31 }, lines: ['410 of 2,168 households have answered (19%).', 'Automatic client e-mail is on hold until the manager\'s go.'] }; };
let key = '';
env.gcmAiKey_ = () => key;
const sent = []; let next = null;
env.gcmClaude_ = (system, user) => { sent.push({ system, user }); const n = typeof next === 'function' ? next(user) : next; if (n instanceof Error) throw n; return n; };
env.T_CLAIM = { TAB: 'Retention Payments' };
env.__mkSheet('Retention Payments', 7, ['Claim', 'Token', 'Client', 'Submitted', 'Paid', 'Status', 'Note'], [
  ['RP-1', 't1', 'A Client', new Date('2026-10-05'), new Date('2026-10-14'), 'paid', ''],
  ['RP-2', 't2', 'B Client', new Date('2026-10-06'), '', 'sent', ''],
  ['RP-3', 't3', 'C Client', '', '', 'held', ''],
  ['RP-4', 't4', 'D Client', new Date('2026-10-06'), '', 'void', ''],
]);
const get = p => env.smDoGet_(p);
const post = b => env.smDoPost_(b);
const tab = n => env.__sheets[n] && env.__sheets[n]._grid;

/* ── 1. who ── */
console.log('\nSign-in and who may write:\n');
ok('sm.ping answers with the version', get({ action: 'sm.ping' }).ok && get({ action: 'sm.ping' }).sm === 1);
ok('a wrong password is refused on sm.me', get({ action: 'sm.me', code: 'nope', who: 'x' }).refused === true);
ok('a wrong password is refused on sm.list', get({ action: 'sm.list', code: 'nope' }).refused === true);
const me = get({ action: 'sm.me', code: 'BRANCH' });
ok('the branch code opens and may write', me.ok && me.me.role === 'branch' && me.me.canWrite === true && me.me.name === 'Branch');
const ak = get({ action: 'sm.me', code: 'AKAASH' });
ok('the unit manager opens and may write', ak.ok && ak.me.role === 'unit' && ak.me.canWrite === true && ak.me.name === 'Akaash Kalladeen');
ok('staff open and read only', get({ action: 'sm.me', code: 'SASHA' }).me.canWrite === false);
ok('an agent opens and reads only', get({ action: 'sm.me', code: 'NEIL' }).me.canWrite === false);
ok('an unknown action is refused', get({ action: 'sm.what' }).ok === false && post({ action: 'sm.what' }).ok === false);

/* ── 2. contributions ── */
console.log('\nContributions:\n');
ok('nothing logged yet, and no tab yet', get({ action: 'sm.list', code: 'BRANCH' }).items.length === 0 && !tab('Strategic Meeting'));
let r = post({ action: 'sm.add', code: 'SASHA', session: 'd1-protect', day: 1, title: 'Protecting the Business We Win', kind: 'fact', point: 'x' });
ok('staff cannot log', r.ok === false && /branch manager and a unit manager/.test(r.error));
r = post({ action: 'sm.add', code: 'BRANCH', session: 'd1-protect', day: 1, title: 'Protecting', kind: 'fact', point: '' });
ok('an empty point is refused', r.ok === false && /point/.test(r.error));
r = post({ action: 'sm.add', code: 'BRANCH', session: 'd1 protect!', day: 1, title: 'Protecting', kind: 'fact', point: 'x' });
ok('a session key with odd characters is refused', r.ok === false);
r = post({ action: 'sm.add', code: 'BRANCH', session: 'd1-protect', day: 1, title: 'Protecting the Business We Win', kind: 'fact',
  point: 'By 6 October 323 of the 1,477 clients written to had answered.', evidence: 'Measured 6 October 2026.', ask: 'Count preserved business beside produced.' });
ok('the branch logs a fact and gets it back', r.ok && /^SM-[A-Z0-9]{10}$/.test(r.id) && r.item.by === 'Branch' && r.item.role === 'branch' && r.item.kind === 'fact');
ok('the tab is made with its headers and the row', tab('Strategic Meeting') && tab('Strategic Meeting')[0].join() === env.SM.HEAD.join() && tab('Strategic Meeting').length === 2 && tab('Strategic Meeting')[1][11] === 'logged');
const r2 = post({ action: 'sm.add', code: 'AKAASH', session: 'd2-recruit', day: 2, title: 'Recruitment & Retention', kind: 'wild', point: 'A recruit who leaves inside a year counts against activity.' });
ok('the unit manager logs; a kind outside the list becomes a note', r2.ok && r2.item.kind === 'note' && r2.item.by === 'Akaash Kalladeen');
const r3 = post({ action: 'sm.add', code: 'AKAASH', session: 'd2-recruit', day: 2, title: 'Recruitment & Retention', kind: 'definition', point: 'The Step-Back Approach is …' });
ok('a definition is a kind', r3.ok && r3.item.kind === 'definition');
let list = get({ action: 'sm.list', code: 'NEIL' });
ok('an agent reads all three', list.ok && list.items.length === 3 && list.me.canWrite === false);
ok('a long field is cut at the limit', post({ action: 'sm.add', code: 'BRANCH', session: 'd1-forum', day: 2, title: 't', kind: 'note', point: 'x'.repeat(5000) }).item.point.length === env.SM.MAX);

console.log('\nTaking one back:\n');
ok('the unit manager cannot take back the branch\'s', post({ action: 'sm.remove', code: 'AKAASH', id: r.id }).ok === false);
ok('staff cannot take anything back', post({ action: 'sm.remove', code: 'SASHA', id: r2.id }).ok === false);
ok('the unit manager takes back his own', post({ action: 'sm.remove', code: 'AKAASH', id: r2.id }).ok === true);
ok('the branch takes back anyone\'s', post({ action: 'sm.remove', code: 'BRANCH', id: r3.id }).ok === true);
ok('a removed id is refused the second time', post({ action: 'sm.remove', code: 'BRANCH', id: 'SM-NOPE' }).ok === false);
list = get({ action: 'sm.list', code: 'BRANCH' });
ok('the list leaves the removed out', list.items.length === 2 && list.items.every(i => i.id !== r2.id && i.id !== r3.id));
const grid = tab('Strategic Meeting'), rowOf = id => grid.find(x => x[1] === id);
ok('the rows stay, marked removed and by whom', /^removed /.test(rowOf(r2.id)[11]) && rowOf(r2.id)[12] === 'Akaash Kalladeen' && rowOf(r3.id)[12] === 'Branch');

/* ── 3. the live facts ── */
console.log('\nThe live facts:\n');
let f = get({ action: 'sm.facts', code: 'SASHA' });
ok('staff may read the facts', f.ok && f.facts);
ok('the campaign counts come from the stream', f.facts.campaign && f.facts.campaign.households === 2168 && f.facts.campaign.householdsAnswered === 410 && f.facts.campaign.letters === 1477 && f.facts.campaign.afterReminder === 128 && f.facts.campaign.outcomesWeek === 57);
ok('the stream\'s own sentences travel', f.facts.lines.length === 2);
ok('the claims are counted: void left out, paid read from the date or the status', f.facts.claims && f.facts.claims.found === 3 && f.facts.claims.sent === 2 && f.facts.claims.paid === 1);
ok('the team is counted: a former agent and an inactive one left out, agents by unit', f.facts.team && f.facts.team.agents === 2 && f.facts.team.unitManagers === 1 && f.facts.team.staff === 1 && f.facts.team.unitList.length === 2);
const blob = JSON.stringify(f.facts);
ok('no client name in the facts', !/A Client|B Client|C Client|D Client/.test(blob));
ok('the facts are kept ten minutes', (get({ action: 'sm.facts', code: 'BRANCH' }), streamCalls === 1));
env.CacheService.getScriptCache().remove('sm:facts:1');
streamThrows = true;
f = get({ action: 'sm.facts', code: 'BRANCH' });
ok('a stream that fails leaves the campaign out and the rest standing', f.ok && f.facts.campaign === null && /board down/.test(f.facts.campaignError) && f.facts.claims.found === 3);
streamThrows = false; env.CacheService.getScriptCache().remove('sm:facts:1');

/* ── 4. the AI guide ── */
console.log('\nThe AI guide:\n');
const G = { action: 'sm.guide', code: 'BRANCH', session: 'd1-protect', title: 'Protecting the Business We Win', brief: 'Conservation; churn; timely requirements; ethics.',
  question: 'Should the business we preserve be recognised alongside the business we produce?', notes: 'Letters at 45, 60, 75 and 90 days.\nPosition: yes.' };
r = post(G);
ok('without a key the guide says what to set', r.ok === false && /ANTHROPIC_API_KEY/.test(r.error) && sent.length === 0);
key = 'sk-test';
next = JSON.stringify({ points: [
  { kind: 'fact', point: 'By 6 October 323 clients had answered.', evidence: 'The record.', ask: 'Count it.' },
  { kind: 'definition', point: 'A position dressed as a definition.', evidence: '', ask: '' },
  { kind: 'nonsense', point: 'Another.', evidence: 'e', ask: 'a' } ], caution: 'The material gives no persistency figure.' });
r = post(G);
ok('with a key the guide answers three points and a caution', r.ok && r.points.length === 3 && r.caution === 'The material gives no persistency figure.');
ok('a definition or an unknown kind from the AI reads as a position', r.points[1].kind === 'position' && r.points[2].kind === 'position');
const u = sent[0].user;
ok('the prompt carries the session, the question, the notes, the counts and the contributions', /SESSION: Protecting/.test(u) && /GUIDING QUESTION/.test(u) && /45, 60, 75 and 90/.test(u) && /410 of 2168 households/.test(u) && /TT\$200 retention claims: 3 found, 2 submitted, 1 paid/.test(u) && /323 of the 1,477 clients/.test(u));
ok('the system prompt forbids a client\'s or a former agent\'s name and invention', /Never name a client/.test(sent[0].system) && /Never name a former agent/.test(sent[0].system) && /invent nothing/.test(sent[0].system));
ok('the prompt says what the record cannot support goes in the caution', /caution/.test(sent[0].system));
r = post(G);
ok('the same session and contributions are not read twice', r.ok && r.cached === true && sent.length === 1);
post({ action: 'sm.add', code: 'BRANCH', session: 'd1-protect', day: 1, title: 'Protecting', kind: 'position', point: 'Yes: count the retained premium.' });
r = post(G);
ok('a new contribution brings a fresh read, and it is in the prompt', r.ok && !r.cached && sent.length === 2 && /count the retained premium/.test(sent[1].user) && /CONTRIBUTIONS ALREADY LOGGED FOR THIS SESSION \(2\)/.test(sent[1].user));
post({ action: 'sm.add', code: 'BRANCH', session: 'd2-recruit', day: 2, title: 'Recruitment', kind: 'definition', point: 'Step-Back: a recruit steps back for a week before signing.' });
r = post(Object.assign({}, G, { session: 'd1-career', title: 'Career Path Review' }));
ok('a definition logged anywhere reaches every session\'s guide', r.ok && /DEFINITIONS LOGGED BY THE BRANCH/.test(sent[2].user) && /steps back for a week/.test(sent[2].user));
next = 'Here are my thoughts, not JSON.';
r = post(Object.assign({}, G, { session: 'd1-fraud', title: 'Fraud' }));
ok('an answer that is not JSON is an error, not a crash', r.ok === false && /shape/.test(r.error));
next = new Error('The AI did not answer (HTTP 529). Write the reason yourself.');
r = post(Object.assign({}, G, { session: 'd1-awards', title: 'Awards' }));
ok('a refused call reaches the page as a sentence', r.ok === false && /did not answer/.test(r.error));
ok('staff may ask the guide too (they read)', (next = JSON.stringify({ points: [{ kind: 'fact', point: 'p', evidence: '', ask: '' }], caution: '' }), post(Object.assign({}, G, { code: 'SASHA', session: 'd1-synth', title: 'Synthesis' })).ok === true));
ok('a wrong password cannot ask the guide', post(Object.assign({}, G, { code: 'nope' })).refused === true);

/* ── 5. the page and the routing ── */
console.log('\nThe page and Service.gs:\n');
const page = fs.readFileSync(path.join(ROOT, 'strategic-meeting/index.html'), 'utf8');
const svc = fs.readFileSync(path.join(ROOT, 'apps-script/Service.gs'), 'utf8');
const train = fs.readFileSync(path.join(ROOT, 'orphan-transition/training.html'), 'utf8');
const stub = fs.readFileSync(path.join(ROOT, 'strategicmeeting/index.html'), 'utf8');
ok('Service.gs routes sm.* GET and POST to StrategicMeeting.gs', /\/\^sm\\\.\/\.test\(String\(p\.action[^\n]*smDoGet_/.test(svc) && /\/\^sm\\\.\/\.test\(String\(body\.action[^\n]*smDoPost_/.test(svc));
const url = m => (m.match(/const SVC = '([^']+)'/) || [])[1];
ok('the page talks to the same /exec as the training page', url(page) && url(page) === url(train));
ok('the page signs in with the board\'s keys', /rrb-transition-code/.test(page) && /rrb-assign-who/.test(page));
ok('the page carries the gold shield and no other mark', /logo-mark\.png/.test(page) && !/gcm-mark|board-mark/.test(page));
ok('the page carries the view beacon', /<!-- rrb-views -->/.test(page));
const keys = [...page.matchAll(/key: '([a-z0-9-]+)'/g)].map(m => m[1]);
ok('every session key is unique and plain', keys.length > 20 && new Set(keys).size === keys.length && keys.every(k => /^[a-z0-9-]+$/.test(k)));
ok('the branch manager\'s slot is Friday 11:25 to 12:00, marked as his', /key: 'd2-recruit', t: '11:25', e: '12:00'[^\n]*mine: true/.test(page));
ok('every session of the agenda is on the page', ['Project Mahogany', 'Career Path Review', 'Succession Planning Considerations', 'Awards & Recognition Framework', 'Protecting the Business We Win', 'Fraud Prevention', 'Day 1 Synthesis',
  'Succession Planning & Performance Management', 'Agent & Unit Transfers', 'Recruitment & Retention', 'Open Forum', 'Consolidation of Recommendations', 'Feature Address', 'Closing Reflections', 'Barbados'].every(t => page.indexOf(t) >= 0));
ok('the page says the record has no definition of the Step-Back Approach', /no written definition of the Step-Back Approach/.test(page) && /What the record does not hold/.test(page));
ok('no client name and no per-book count on the page', !/\b(Mohammed|Persad|Ramroach|Sookdeo)\b/.test(page.replace(/Ricky Rampersad|Rampersad Branch/g, '')));
ok('the page keeps contributions on the device until the backend is linked', /rrb-sm-local/.test(page) && /Unknown action/i.test(page));
ok('the short address forwards to the page', /url=\/strategic-meeting\//.test(stub) && /location\.replace\('\/strategic-meeting\/'/.test(stub));
ok('the memo\'s logistics are on the page', /Hyatt Regency Trinidad, 1 Wrightson Road/.test(page) && /Business casual/.test(page) && /3:30 pm/.test(page));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall passed\n');
process.exit(fails ? 1 : 0);
