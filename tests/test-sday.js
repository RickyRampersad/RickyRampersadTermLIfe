// The system sets each desk's day; checking in is the register (20 October 2026).
//
// Ricky: "this system actually plans their day for them and they check in. When
// they check in, it's an attendance register" and "tasks are broken down by task
// types ... can intelligence be built in so they can work more or less
// effectively to the task that's assigned?"
//
// Pinned here: every kind of task gets its playbook (what to do, what closes it)
// and its history adds what it waits on; the target clears the overdue in a week
// and never sits under the desk's own median day; the morning e-mail has one
// button to check in; checking in signs in and writes the day as the plan; the
// page puts moved work first, then what cannot wait, each with what to do and a
// close / move / note in place; a close needs a note and a move a reason, each
// kept with before and after; Query Pal notes, the scrub and taking on the next
// ones; SYSTEM_DAY = off brings the old plan page back; old working copies are
// dropped after three weeks.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-20';
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support', 'Support', 'Yes']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, elizabeth: { id: '005E' }, sasha: { id: '005S' } });
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const posts = [], patches = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'FEED'; }; env.sfkPatchTask_ = (id, b) => { patches.push([id, b]); return true; };
const P = env.PropertiesService.getScriptProperties();
const q = s => Object.fromEntries(new URL(s).searchParams);

console.log('\nHow to work each kind of task:\n');
const pb = (s, ty, notes) => env.playbookFor_({ subject: s, ty: ty || 'Servicing' }, notes || [], DAY);
ok('a client asking to cancel: call first, and it cannot wait', pb('Orphan response: asked to cancel - 5003960409 CRYSTAL CONSTANTINE').k === 'cancel' && pb('Orphan response: asked to cancel - 5003960409 CRYSTAL').must);
ok('a former agent in touch comes before anything else on the line', pb('Orphan response: call me (evenings); confirm what the policy pays; former agent in touch - 8000537257 JAMEELA HOSEIN').k === 'former');
ok('a call asked for', pb('Orphan response: call me - 5002953824 KERLENE ALFONSO').k === 'callme' && /Call the client today/.test(pb('Orphan response: call me - 5002953824 KERLENE ALFONSO').todo));
ok('premium paid and not showing', pb('Orphan premium due: Paid, not showing (bankers order) - 5001816653 REENA SEEPARSAN', 'Renewa/PDl/Bill').k === 'paidto');
ok('confirm what the policy pays', pb('Orphan response: confirm what the policy pays - 5003957661 KIMBERLEY REMY').k === 'pays');
ok('a medical, a questionnaire, underwriting', pb('Stress Electrocardiogram, Erythrocyte Sedimentation Rate, CBC- 1000895157- Karlene Rampersad', 'Pendings').k === 'medical' &&
  pb('Foreign Travel questionnaire: 1000895017 AVINASH RAMPERSAD', 'Pendings').k === 'quest' && pb('Follow up with UW- 1000893677-NESHA AKING', 'Pendings').k === 'uw');
ok('a PMAR falls back on its type: a new business pending', pb('PMAR- JAMIE MOHAMMED 1000902196/5004289328', 'Pendings').label === 'New business pending');
ok('the policy and the client are read off the subject', pb('Orphan response: confirm what the policy pays - 5003957661 KIMBERLEY REMY').policy === '5003957661' && pb('Orphan response: confirm what the policy pays - 5003957661 KIMBERLEY REMY').client === 'KIMBERLEY REMY');
const w = pb('Follow up with UW- 1000893677-NESHA AKING', 'Pendings', [{ day: '2026-10-16', by: 'Sasha', text: 'Waiting on underwriting for the APS.' }]);
ok('its notes say what it waits on: chase them today', w.waiting === 'underwriting' && /It waits on the underwriting: chase them today/.test(w.next), JSON.stringify(w));
ok('quiet for days: do the next step', /No note in 4 days/.test(pb('COB- 1000832473- Ravi Persad', 'Servicing', [{ day: '2026-10-16', by: 'Liz', text: 'Form received.' }]).next));

console.log('\nHow big the day is:\n');
ok('the overdue cleared in a working week, at the desk\'s own pace', env.intelTarget_({ pace: 9, median: 9 }, 2, 50, 52) === 12, String(env.intelTarget_({ pace: 9, median: 9 }, 2, 50, 52)));
ok('never under her own median day', env.intelTarget_({ pace: 9, median: 9 }, 0, 10, 40) === 9);
P.setProperty('SYSTEM_DAY', 'off');
ok('the old sizing with SYSTEM_DAY off', env.intelTarget_({ pace: 9, median: 9 }, 2, 50, 52) === 7);
P.deleteProperty('SYSTEM_DAY');

console.log('\nThe day, set for her:\n');
const MODEL = { b: { KPI1: { sug: [
  { id: '00TS0000000001A', s: 'Follow up with UW- 1000893677-NESHA AKING', ty: 'Pendings', due: '2026-10-19', late: true, br: '' },
  { id: '00TS0000000002A', s: 'Orphan response: call me - 5002953824 KERLENE ALFONSO', ty: 'Servicing', due: '2026-10-19', late: true, br: '' },
  { id: '00TS0000000003A', s: 'COB- 1000832473- Ravi Persad', ty: 'Servicing', due: DAY, late: false, br: '' }],
  more: [{ id: '00TS0000000004A', s: 'Policy Documents- 1000899195 Pia Nabbie', ty: 'Servicing', due: DAY, late: false }] } }, order: ['KPI1'],
  loose: [{ id: '00TS0000000005A', s: 'Moved to you: PMAR- 1000908917- Camille Jadoo', ty: 'Pendings', due: '2026-10-19', late: true }] };
env.intelModel_ = (sid, d) => sid === 'elizabeth' ? MODEL : null;
const CHAT = { '00TS0000000001A': [{ day: '2026-10-16', by: 'Elizabeth Lee', text: 'Waiting on underwriting for the APS.' }] };
env.cmdChatter_ = ids => { const o = {}; ids.forEach(id => { if (CHAT[id]) o[id] = CHAT[id]; }); return o; };
let STATES = {}; env.sfkTaskStates_ = () => STATES;
env.openQueries_ = () => [{ ref: 'QP-7', days: 6, client: 'Ms Client', assigned: 'Elizabeth Lee', subject: 'Surrender value', over: true, turn: 3, dept: 'Customer Service', desc: 'Wants the surrender value in writing.' }];
const qpNotes = []; env.qpNote_ = (ref, who, txt) => qpNotes.push([ref, who, txt]);
const made = []; env.createTask_ = (d, pr) => { made.push(d); return { ok: true }; };
let SIGNED = ''; env.signedInAt_ = () => SIGNED;
env.signInFromPage_ = () => { const first = !SIGNED; SIGNED = SIGNED || '06:55'; return { at: SIGNED, first }; };
const url = env.replyUrl_('elizabeth', DAY, 'plan');
let page = env.replyClick_({ parameter: q(url) }).getContent();
ok('the page is her day, not a plan to fill in', /Your day · Tuesday 20 October 2026/.test(page) && !/Save my plan/.test(page) && /your day is set for you/.test(page));
ok('check in first, on a form of its own: the register', /<form[^>]*>[^]*?name="f" value="in"[^]*?Check in and start my day<\/button><\/form>/.test(page) && /This is the register/.test(page));
const work = page.slice(page.indexOf('id="p-work"'), page.indexOf('id="p-qp"'));
const order = ['00TS0000000005A', '00TS0000000002A', '00TS0000000001A', '00TS0000000003A'].map(id => work.indexOf('id="w' + id + '"'));
ok('moved to her first, then the call that cannot wait, then the morning\'s order', order.every((x, i) => x > -1 && (i === 0 || x > order[i - 1])), order.join(','));
ok('each says what to do', /What to do:<\/b> Call the client today on the number on file/.test(work) && /Moved to you<\/span>/.test(work));
ok('and what its history adds', /It waits on the underwriting: chase them today and note what they say\./.test(work));
ok('closed, moved or noted in place', ['x_', 'm_', 'n_'].every(f => new RegExp('name="' + f + '00TS0000000001A"').test(work)));
ok('her Query Pal queries, oldest first, past turnaround flagged', /Your client queries · Query Pal \(1\)/.test(page) && /past turnaround/.test(page) && /name="q_0"/.test(page));
ok('the scrub: inbox, WhatsApp and calls', /The scrub · inbox, WhatsApp and calls/.test(page) && /name="scrub"/.test(page));
ok('and the next ones, for when the list is done', /When your list is done: the next 1/.test(page) && /name="t_take" value="00TS0000000004A"/.test(page));

console.log('\nChecking in:\n');
page = env.replyPost_({ parameter: q(env.replyUrl_('elizabeth', DAY, 'in')), parameters: {} }).getContent();
ok('checking in signs her in and says so', /Checked in at 6:55am/.test(page) && /&#10003; Checked in 6:55am/.test(page));
const plans = env.planRows_('elizabeth', DAY);
const items = plans.KPI1 ? env.planItemsOf_(plans.KPI1.Items) : [];
ok('and writes her day as the plan, so the progress check and the close-off read it', items.length === 4 && items[0].id === '00TS0000000005A' && /Set by the system at check-in/.test(plans.KPI1.Note), JSON.stringify(items.map(i => i.id)));
ok('the Branch Manager sees the day set', !!P.getProperty('daystart_plan_elizabeth_' + DAY));

console.log('\nWorking the day:\n');
const base = q(url);
page = env.replyPost_({ parameter: Object.assign({}, base, { x_00TS0000000003A: '1' }), parameters: {} }).getContent();
ok('a close with no note is refused', /NOT CLOSED: say what was done/.test(page) && !patches.length);
page = env.replyPost_({ parameter: Object.assign({}, base, {
  x_00TS0000000003A: '1', n_00TS0000000003A: 'COB form sent to Customer Service, ref CS-123.',
  m_00TS0000000001A: '2026-10-23', n_00TS0000000001A: 'Underwriting says the APS is due Friday.',
  n_00TS0000000002A: 'Called, no answer; left a message.',
  q_0: 'Surrender value requested from Customer Service.', scrub: 'Agent Persad asked for the Mohammed medical requirements' }), parameters: { t_take: ['00TS0000000004A'] } }).getContent();
ok('closed with her note on it, signed as sales support', patches.some(p => p[0] === '00TS0000000003A' && p[1].Status === 'Completed') && posts.some(p => p[1].ParentId === '00TS0000000003A' && /^Sales Support · Elizabeth Lee · Tue 20 Oct/.test(p[1].Body) && /ref CS-123/.test(p[1].Body)));
ok('moved, with the reason on Chatter', patches.some(p => p[0] === '00TS0000000001A' && p[1].ActivityDate === '2026-10-23') && posts.some(p => p[1].ParentId === '00TS0000000001A' && /APS is due Friday/.test(p[1].Body)));
ok('a note alone goes on the task', posts.some(p => p[1].ParentId === '00TS0000000002A' && /left a message/.test(p[1].Body)) && !patches.some(p => p[0] === '00TS0000000002A'));
const tc = env.SpreadsheetApp.getActive().getSheetByName('Task Changes');
ok('each close and move kept with before and after', !!tc && tc._grid.some(r => r[2] === '00TS0000000003A' && r[6] === 'Completed') && tc._grid.some(r => r[2] === '00TS0000000001A' && r[5] === '2026-10-19' && r[6] === '2026-10-23'));
ok('the move is on Due Moves, noted', env.SpreadsheetApp.getActive().getSheetByName('Due Moves')._grid.some(r => r[1] === '00TS0000000001A' && r[7] === 'yes'));
ok('the query note goes on its trail in Query Pal', qpNotes.length === 1 && qpNotes[0][0] === 'QP-7' && /Elizabeth Lee \(Sales Support\)/.test(qpNotes[0][1]));
ok('the scrub line becomes a task in her day', made.length === 1 && /Mohammed medical/.test(made[0].subject) && made[0].due === DAY);
ok('and the one she took on joins today', env.planItemsOf_(env.planRows_('elizabeth', DAY).KPI1.Items).some(i => i.id === '00TS0000000004A'));
STATES = { '00TS0000000003A': 'Completed' };
page = env.replyClick_({ parameter: q(url) }).getContent();
ok('what is done moves out of the list, counted', /Your work today · 4 to do · 1 done/.test(page) && /Done today \(1\)/.test(page), (page.match(/Your work today[^<]*/) || [''])[0]);

console.log('\nThe switch, and the housekeeping:\n');
P.setProperty('SYSTEM_DAY', 'off');
env.intelModel_ = () => ({ b: { KPI1: { sug: [], more: [] } }, loose: [] });
page = env.replyClick_({ parameter: q(url) }).getContent();
ok('SYSTEM_DAY = off brings back the plan page', /Save my plan/.test(page));
P.deleteProperty('SYSTEM_DAY');
P.setProperty('intel_model_sasha_2026-09-01', 'x'); P.setProperty('intel_model_sasha_2026-09-01_1', 'x'); P.setProperty('daystart_first_sasha_2026-09-02', 'x');
P.setProperty('intel_model_sasha_2026-10-19', 'keep'); P.setProperty('cover_back_sasha', 'keep');
const gone = env.sdPrune_(DAY);
ok('working copies older than three weeks are dropped, nothing else', gone === 3 && !P.getProperty('intel_model_sasha_2026-09-01') && P.getProperty('intel_model_sasha_2026-10-19') === 'keep' && P.getProperty('cover_back_sasha') === 'keep', String(gone));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
