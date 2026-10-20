// Akaash drills into his agents' pendings and queries, with filters (19 October 2026).
//
// Ricky: "Can he be able to drill into his agents queries and pendings and have
// filters?" My unit listed the unit's Salesforce work in four lists and nothing
// from Query Pal. Now Unit work carries his agents' open client queries beside
// the pendings, each opening to its detail and its whole trail, and filters
// over all of it: by kind, by agent, by how it stands, and by any word.
//
// Pinned here: his agents' queries are on the page and nobody else's; each
// item says whose it is, what kind, and how it stands, for the filters; the
// counts on the chips are right; a query opens to its reference, policy,
// turnaround and every note; a note on a query goes on Query Pal's trail,
// internal, and is counted; an agent's card leads to his work.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-19';
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Unit', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support', 'Support', 'Yes']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, elizabeth: { id: '005E' }, sasha: { id: '005S' } });   // Akaash has no login
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = [];
env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const writes = [];
env.sfkInsert_ = (o, b) => { writes.push([o, b]); return o === 'Task' ? '00TNEW' : 'FEED'; };
const P = env.PropertiesService.getScriptProperties();
const q = s => Object.fromEntries(new URL(s).searchParams);

const AG = ['Akaash Kalladeen', 'Darryl Manick', 'Stephanie Rajkumar', 'Kevin Ramdial'];
const open = [
  { id: '00TP1', subject: 'Medical outstanding on a new application', agent: 'Darryl Manick', due: '2026-10-09', late: true, ty: 'Pendings', touched: 9, owner: 'Elizabeth Lee', status: 'In Progress', account: '' },
  { id: '00TP2', subject: 'Signed proposal still to come', agent: 'Stephanie Rajkumar', due: '2026-10-22', late: false, ty: 'Pendings', touched: 1, owner: 'Sasha Lalla-Jagassar', status: 'Not Started', account: '' },
  { id: '00TS1', subject: 'Change of address on a policy', agent: 'Kevin Ramdial', due: '2026-10-01', late: true, ty: 'Servicing', touched: 16, owner: '', status: 'Not Started', account: '' },
  { id: '00TN1', subject: 'New business: application submitted', agent: 'Darryl Manick', due: '2026-10-20', late: false, ty: 'New Business', touched: 2, owner: 'Elizabeth Lee', status: 'In Progress', account: '' }];
env.unitBook_ = () => ({ agents: AG, open, closedYday: 3, closedToday: [{ id: 'x' }] });
env.cmdChatter_ = ids => ({
  '00TP1': [{ at: '2026-10-18T14:00:00Z', day: '2026-10-18', by: 'Elizabeth Lee', text: 'BMA · Sun 18 Oct 9:00am\n\nAkaash, can you get Darryl to book the medical this week?' },
            { at: '2026-10-15T14:00:00Z', day: '2026-10-15', by: 'Elizabeth Lee', text: 'Requirement letter sent to the client.' },
            { at: '2026-10-10T14:00:00Z', day: '2026-10-10', by: 'Elizabeth Lee', text: 'Medical ordered.' }] });
env.ff360Feed_ = () => ({ leaders: [{ name: 'Stephanie Rajkumar', count: 2, pickedUp: 9000 }], monthLeaders: [{ name: 'Darryl Manick', count: 3, pickedUp: 2000 }, { name: 'Stephanie Rajkumar', count: 5, pickedUp: 9000 }],
  yearLeaders: [{ name: 'Darryl Manick', count: 3, pickedUp: 2000 }, { name: 'Stephanie Rajkumar', count: 5, pickedUp: 9000 }, { name: 'Akaash Kalladeen', count: 1, pickedUp: 1500 }] });
env.skillBank_ = () => ({});
const goals = { 'darryl manick': { api: 120000, apps: 24, paceApi: 6923, weeksIn: 3, last: { week: 2, contacts: 10, appts: 2, ff: 1, apps: 0, help: 'Joint calls on two referrals' } },
                'stephanie rajkumar': { api: 100000, apps: 20, paceApi: 5769, weeksIn: 3, last: null },
                'akaash kalladeen': { api: 60000, apps: 12, paceApi: 3462, weeksIn: 3, last: null } };
env.goalFor_ = n => goals[String(n).toLowerCase()] || null;
env.agentDaySummary_ = (day, names) => names.map(n => ({ key: 'a-' + n.split(' ')[0].toLowerCase(), name: n,
  status: n === 'Kevin Ramdial' ? 'absent (no plan)' : n === 'Stephanie Rajkumar' ? 'plan in' : 'no plan yet', planned: n === 'Stephanie Rajkumar' ? 12 : 0, done: 0, ff: 0, apps: 0,
  hasPlan: n === 'Stephanie Rajkumar', hasClose: false }));
env.agRows_ = (key, day, kind) => key === 'a-stephanie' && kind === 'plan' ? { calls: { Planned: 10 }, appts: { Planned: 2 } } : {};
env.ppmLetters_ = () => [{ 'Letter ID': 'L1', 'Agent Name': 'Kevin Ramdial', 'Performance Period': 'Q3 FY26', Status: 'Assigned' }];
env.signedInAt_ = () => '';
env.signInFromPage_ = () => ({ at: '07:05', first: true });

console.log('\nOne link, every day:\n');

const QS = [
  { ref: 'RRB/2026/093/Client Q/Cash Value Statement', when: '10/09/2026 09:00:00', days: 10, client: 'Client Q', agent: 'Darryl Manick', assigned: 'Elizabeth Lee', subject: 'Cash value statement', dept: 'Policy Services', type: 'Cash Value Statement', status: 'Open', policy: '1000801276', priority: 'Normal', turn: 3, over: true, fu: 2, desc: 'Client wants the cash value before the anniversary.' },
  { ref: 'RRB/2026/101/Client R/Change of beneficiary', when: '10/18/2026 10:00:00', days: 1, client: 'Client R', agent: 'Stephanie Rajkumar', assigned: '', subject: 'Change of beneficiary', dept: 'Policy Services', type: 'Beneficiary', status: 'Open', policy: '', priority: '', turn: 5, over: false, fu: 0, desc: '' },
  { ref: 'RRB/2026/102/Client S/Claim', when: '10/18/2026 10:00:00', days: 1, client: 'Client S', agent: 'Someone Else', assigned: '', subject: 'Claim', dept: 'Claims', type: 'Claim', status: 'Open', policy: '', priority: '', turn: 5, over: false, fu: 0, desc: '' }];
env.openQueries_ = () => QS.map(x => Object.assign({}, x));
env.qpComments_ = () => ({ 'RRB/2026/093': [{ day: '2026-10-17', by: 'System', text: 'Client progress update #1 sent' }, { day: '2026-10-12', by: 'Elizabeth Lee', text: 'Asked Policy Services for the statement.' }] });
env.__mkSheet('Comments', 9, ['When', 'Reference', 'Author', 'Role', 'Comment', ''], [['2026-10-17', 'RRB/2026/093/Client Q/Cash Value Statement', 'System', 'system', 'Client progress update #1 sent', 'internal']]);

env.unitBook_ = () => ({ agents: AG.concat(['Malcolm Sooknanan']), open, closedYday: 3, closedToday: [{ id: 'x' }] });

console.log('\nUnit work, with his agents\' queries:\n');
const page = env.replyClick_({ parameter: q(env.unitUrl_('akaash')) }).getContent();
const work = page.slice(page.indexOf('data-sec="work"'), page.indexOf('data-sec="agents"'));
ok('his agents\' open queries are there', /Client queries · Query Pal \(2\)/.test(work) && /Client Q/.test(work) && /Client R/.test(work));
ok('and nobody else\'s', !/Client S/.test(page));
ok('a plain filter bar: an agent, what to show, a search', /id="uf-a"/.test(work) && /id="uf-v"/.test(work) && /id="uf-q"/.test(work) && /value="k:pend"/.test(work) && /value="k:qp"/.test(work) && /value="darryl manick"/.test(work) && /value="s:late"/.test(work) && /value="s:quiet"/.test(work) && !/class="chip/.test(work));
ok('the counts are right: 6 in all, 2 queries, Darryl 3, overdue 3', /value="">Everything · 6</.test(work) && /value="k:qp">Client queries · 2</.test(work) && /value="darryl manick">Darryl Manick · 3</.test(work) && /value="s:late">Overdue · 3</.test(work),
  (work.match(/<option value="[^"]*">[^<]*</g) || []).join(' | '));
ok('who holds the work comes after the lists, not before', work.indexOf('id="u-work"') > work.indexOf('Client queries · Query Pal'));
ok('each item says whose, what kind and how it stands', /id="tP1"|id="t00TP1" data-ag="darryl manick" data-kind="pend" data-late="1" data-quiet="1" data-nonote="0"/.test(work) && /id="q0" data-ag="darryl manick" data-kind="qp" data-late="1"/.test(work));
ok('and its words, for the search: a policy number finds the query', /id="q0"[^>]*data-q="[^"]*1000801276/.test(work));

console.log('\nA query, opened:\n');
const q0 = work.slice(work.indexOf('id="q0"'), work.indexOf('id="q1"'));
ok('its reference, policy, turnaround and how long it has been open', /RRB\/2026\/093/.test(q0) && /policy 1000801276/.test(q0) && /turnaround 3 days/.test(q0) && /10 days open/.test(q0) && /past turnaround/.test(q0) && /2 follow-ups/.test(q0));
ok('who holds it', /with <b>Elizabeth Lee<\/b>/.test(q0));
ok('its whole trail, newest first', /History/.test(q0) && q0.indexOf('Client progress update') < q0.indexOf('Asked Policy Services'));
ok('a box for his note, saying the client will not see it', /name="q_0"/.test(q0) && /internal: the client does not see it/.test(q0));
ok('a query with no notes says so', /No notes on this query yet/.test(work));

console.log('\nHis note on a query:\n');
const before = env.__sheets ? null : null;
const sheet = env.SpreadsheetApp.getActive().getSheetByName('Comments');
const rows0 = sheet._grid.length;
const saved = env.replyPost_({ parameter: Object.assign(q(env.unitUrl_('akaash')), { q_0: 'Darryl, call Client Q today with the cash value.' }) }).getContent();
const last = sheet._grid[sheet._grid.length - 1];
ok('it goes on the query\'s trail in Query Pal', sheet._grid.length === rows0 + 1 && last[1] === QS[0].ref && last[4] === 'Darryl, call Client Q today with the cash value.', JSON.stringify(last));
ok('as his, marked internal', last[2] === 'Akaash Kalladeen (Unit Manager)' && last[3] === 'staff' && last[5] === 'internal');
ok('the page says so', /noted on the query in Query Pal \(internal\)/.test(saved));
ok('and it counts among his comments today', P.getProperty('um_posts_akaash_' + DAY) === '1');

console.log('\nFrom an agent to his work:\n');
const agents = page.slice(page.indexOf('data-sec="agents"'), page.indexOf('data-sec="you"'));
ok('Darryl\'s card: his queries counted, and a way into his work', /client queries: <b>1<\/b>/.test(agents) && /data-fag="darryl manick"[^>]*>Darryl's pendings and queries/.test(agents));
ok('the filters run on the page', /UNIT|data-fclear/.test(page) && /function apply\(\)/.test(page));

console.log('\nPick an agent: his day, and a note when there is nothing to comment on:\n');
const page2 = env.replyClick_({ parameter: q(env.unitUrl_('akaash')) }).getContent();
const work2 = page2.slice(page2.indexOf('data-sec="work"'), page2.indexOf('data-sec="agents"'));
const card = n => { const i = work2.indexOf('data-dayfor="' + n + '"'); return i < 0 ? '' : work2.slice(i, work2.indexOf('</textarea>', i)); };
ok('a card for each agent, hidden until he is picked', /data-dayfor="darryl manick" style="display:none/.test(work2) && !!card('malcolm sooknanan') && !card('akaash kalladeen'));
ok('Stephanie\'s day: her status and what she projected', /plan in/.test(card('stephanie rajkumar')) && /projected Calls to make 10 · Appointments to set 2/.test(card('stephanie rajkumar')), card('stephanie rajkumar').slice(0, 300));
ok('Malcolm has nothing open, and it says so', /Nothing open for Malcolm:<\/b> no pendings, no client queries/.test(card('malcolm sooknanan')));
ok('and a box for a note that needs no task', /name="an_malcolm sooknanan"/.test(card('malcolm sooknanan')) && /He gets it in his morning e-mail/.test(card('malcolm sooknanan')));
const said = 'Malcolm, nothing open with the branch: book two fact finds this week.';
const r2 = env.replyPost_({ parameter: Object.assign(q(env.unitUrl_('akaash')), { 'an_malcolm sooknanan': said }) }).getContent();
const notesTab = env.SpreadsheetApp.getActive().getSheetByName('Manager Notes');
ok('the note is kept', !!notesTab && notesTab._grid.length === 2 && notesTab._grid[1][1] === 'Malcolm Sooknanan' && notesTab._grid[1][3] === said && notesTab._grid[1][2] === 'Akaash Kalladeen', notesTab && JSON.stringify(notesTab._grid[1]));
ok('the page says where it goes', /A note for Malcolm · <b>kept: he gets it in his next morning e-mail/.test(r2));
const page3 = env.replyClick_({ parameter: q(env.unitUrl_('akaash')) }).getContent();
ok('and it shows on his card next time', /Akaash · Mon 19 Oct: Malcolm, nothing open/.test(page3.slice(page3.indexOf('data-dayfor="malcolm sooknanan"'))));

console.log('\nThe note in Malcolm\'s morning e-mail:\n');
const MAL = { key: 'a-malcolm', name: 'Malcolm Sooknanan', agentName: 'Malcolm Sooknanan', email: 'malcolm@example.com' };
env.agentBook_ = () => null;
const sent = [];
env.agSend_ = (a, subject, html) => { sent.push({ subject, html }); return true; };
env.agentMode_ = () => 'preview';
env.agentMorningMail_(MAL, '2026-10-20', { open: {}, ff: {}, f360: {}, goal: {}, q: {}, orphan: {} }, null);
ok('in preview, the note is in the mail', sent.length === 1 && /From your manager/.test(sent[0].html) && sent[0].html.indexOf(said) > -1);
ok('but not marked sent: the agent has not had it', !notesTab._grid[1][5]);
env.agentMode_ = () => 'live';
env.agentMorningMail_(MAL, '2026-10-20', { open: {}, ff: {}, f360: {}, goal: {}, q: {}, orphan: {} }, null);
ok('live, it goes to him and is marked sent', /From your manager/.test(sent[1].html) && /^2026-10-20 /.test(String(notesTab._grid[1][5])), String(notesTab._grid[1][5]));
env.agentMorningMail_(MAL, '2026-10-21', { open: {}, ff: {}, f360: {}, goal: {}, q: {}, orphan: {} }, null);
ok('and the next morning it is not sent again', !/From your manager/.test(sent[2].html));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
