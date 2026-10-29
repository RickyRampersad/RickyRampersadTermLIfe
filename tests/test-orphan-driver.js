// The branch manager's drive on the orphan wall (28 October 2026): Transition.gs tOwallDriver_, tOwallMail_ and the names
// the orphan slides never show (T_OWALL2.HIDE: Javid, and Aleema with him by the 17 September rule). Salesforce and the
// sheet are made up. Checks his posts by kind (his own words, the morning chase sent in his voice, the daily lists, Branch
// Intelligence, follow-ups, tasks moved, namings), when the team answers each prompt, each note after a prompt or on their
// own, what the notes say, the last ten working days, what his automation sent, and that nothing names a client.
// Run: node tests/test-orphan-driver.js
const path = require('path');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c || !x ? '' : '  ' + x)); if (!c) fails++; };

delete require.cache[require.resolve('./harness')];
process.env.GS_PATH = path.join(__dirname, '..', 'apps-script', 'Transition.gs');
const { makeEnv } = require('./harness');
const e = makeEnv({ props: {} });

const TZ = 'America/Port_of_Spain';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
e.Utilities.formatDate = (d, tz, f) => {
  const z = tz === 'UTC' ? 'UTC' : TZ;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(p => [p.type, p.value]));
  const H = +parts.hour, h12 = (H % 12) || 12, ap = H < 12 ? 'AM' : 'PM';
  if (f === 'yyyy-MM-dd') return parts.year + '-' + parts.month + '-' + parts.day;
  if (f === 'yyyy') return parts.year;
  if (f === 'H') return String(H);
  if (f === 'u') return String(DAYS.indexOf(parts.weekday) || 7);
  if (f === 'h:mm a') return h12 + ':' + parts.minute + ' ' + ap;
  if (f === 'd MMM, h:mm a') return (+parts.day) + ' ' + MON[+parts.month - 1] + ', ' + h12 + ':' + parts.minute + ' ' + ap;
  if (f === 'EEE d MMM, h:mm a') return parts.weekday + ' ' + (+parts.day) + ' ' + MON[+parts.month - 1] + ', ' + h12 + ':' + parts.minute + ' ' + ap;
  if (f === "yyyy-MM-dd'T'HH:mm:ss'Z'") return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second + 'Z';
  return d.toISOString();
};
e.tTz_ = () => TZ;
e.svcSoqlLit_ = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
e.log_ = () => {};
e.ss_ = () => e.SpreadsheetApp.getActiveSpreadsheet();
e.gcmAiKey_ = () => '';
e.SVC = { RESP_SHEET: 'Client Responses', IND_SHEET: 'Service Questionnaires', TEAM_SHEET: 'Agent Skill Bank' };
const TODAY = e.Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
const shift = n => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDate = (n, hh = 12) => new Date(shift(n) + 'T' + String(hh + 4).padStart(2, '0') + ':00:00Z');   // hh in Trinidad
const sfAt = (n, hh) => dayDate(n, hh).toISOString().replace('Z', '+0000');
const stamp = n => { const d = new Date(shift(n) + 'T12:00:00Z'); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };

/* the campaign: the send list, the Client Book, the policy-to-client map */
const SEND = [
  { Token: 'tokA', Segment: 'F1', Client: 'Alice Abel', 'First name': 'Alice', 'Client number': '100', paid_to: '', Exclude: '', Test: '' },
  { Token: 'tokB', Segment: 'I', Client: 'Brian Bose', 'First name': 'Brian', 'Client number': '200', paid_to: new Date(shift(-90) + 'T16:00:00Z'), Exclude: '', Test: '' },
  { Token: 'tokC', Segment: 'I', Client: 'Carla Cobb', 'First name': 'Carla', 'Client number': '300', paid_to: new Date(shift(-90) + 'T16:00:00Z'), Exclude: '', Test: '' },
  { Token: 'tokD', Segment: 'G', Client: 'Dara Dunn', 'First name': 'Dara', 'Client number': '400', paid_to: '', Exclude: '', Test: '' },
  { Token: 'tokE', Segment: 'G', Client: 'Ezra Eads', 'First name': 'Ezra', 'Client number': '500', paid_to: '', Exclude: '', Test: '' },
  { Token: 'tokF', Segment: 'I', Client: 'Fiona Fry', 'First name': 'Fiona', 'Client number': '600', paid_to: new Date(shift(-90) + 'T16:00:00Z'), Exclude: '', Test: '' },
  { Token: 'tokX', Segment: 'I', Client: 'Xavier Agentkin', 'First name': 'Xavier', 'Client number': '700', paid_to: new Date(shift(-90) + 'T16:00:00Z'), Exclude: 'agent household', Test: '' },
  { Token: 'tokT', Segment: 'G', Client: 'Staff Tester', 'First name': 'Staff', 'Client number': '800', paid_to: '', Exclude: '', Test: 'Y' }];
e.tRead_ = () => ({ rows: SEND });
e.tBook_ = () => ({ ready: true, built: { when: '28 Oct 06:00' }, today: TODAY, by: {
  '100': [{ no: '5000000100', st: 'inforce', paid: shift(20) }],
  '200': [{ no: '5000000200', st: 'inforce', paid: shift(5) }],
  '300': [{ no: '5000000300', st: 'overdue', paid: shift(-100) }, { no: '5000000301', st: 'inforce', paid: shift(20) }],
  '400': [{ no: '5000000400', st: 'inforce', paid: shift(10) }],
  '500': [{ no: '5000000500', st: 'lapsed', paid: shift(-300) }],
  '600': [{ no: '5000000600', st: 'lapsed', paid: shift(-200) }],
  '700': [{ no: '5000000700', st: 'inforce', paid: shift(10) }] } });
e.tPolTokens_ = () => ({ '5000000100': 'tokA', '5000000200': 'tokB', '5000000300': 'tokC', '5000000301': 'tokC', '5000000400': 'tokD', '5000000500': 'tokE', '5000000600': 'tokF', '5000000700': 'tokX' });
e.tRoster_ = () => [{ name: 'Neil Ramnanan' }, { name: 'Narissa Mohammed' }, { name: 'Akaash Kalladeen' }, { name: 'Ricky Rampersad' }];
e.tStream_ = () => ({ ok: true, stream: 1, at: 'x', clients: { all: 9, answered: 3, asked: 2, wrote: 4, reviews: 1 }, hh: { all: 8, answered: 3, asked: 2 },
  auto: { letters: 6, reminders: 2, afterReminder: 1, replies: 5, sentAgain: 1, receipts: { thanked: 3 }, notes: { sent: 2 }, managerNotes: 1, introductions: 2, lateAlerts: 4 }, people: { firstTouch: {} },
  said: { asks: [{ tap: 'callme', label: 'Call me', clients: 7 }, { tap: 'urgent', label: 'An agent, once their concerns are read', clients: 3 }],
          themes: [{ key: 'thanks', label: 'Thanks, or noted', clients: 9 }, { key: 'pay', label: 'Premiums and payments', clients: 4 }],
          risk: [{ code: 'contact_yes', label: 'their former agent has been in touch', clients: 2 }], questions: [] } });
e.tServeCached_ = (cfg, build) => build();

/* the sheet's tabs (the harness's sheets have no getDataRange; tSheetRows_ reads with it) */
const mk = e.__mkSheet;
e.__mkSheet = (...a) => { const sh = mk(...a); sh.getDataRange = () => sh.getRange(1, 1, sh._grid.length, Math.max(1, ...sh._grid.map(r => r.length))); return sh; };
e.__mkSheet('Client Responses', 1, ['Received', 'Token', 'Segment', 'Response', 'Needs', 'Page', 'Referrer', 'Status', 'Assigned to', 'Assigned on', 'Note'], [
  [dayDate(-8, 8), 'tokA', 'F1', 'callme', 'call', '/your-policy/?q=callme', 'tap', 'Open', '', '', ''],
  [dayDate(-6, 9), 'tokB', 'I', 'callme', 'call', '/your-policy/?q=callme', 'tap', 'Open', '', '', '[called ' + stamp(-3) + ' · ELIZABETH LEE] Spoke to Brian Bose on 868-555-1234, he paid.'],
  [dayDate(-1, 10), 'tokE', 'G', 'informed', '', '/your-policy/phone?q=email_given', 'call by Azariah: e@x.com', 'Logged', '', '', '']]);
e.__mkSheet('Service Questionnaires', 2, ['Reference', 'Timestamp', 'Link ref'], [['SQ-1', dayDate(-1, 11), 'transition:tokE']]);
e.__mkSheet('Assignment Log', 3, ['When', 'Token', 'Client', 'From', 'To', 'Named on', 'Source', 'By'], [
  [dayDate(-5), 'tokA', 'Alice Abel', '', 'Neil Ramnanan', dayDate(-5), 'board', 'Ricky Rampersad'],
  [dayDate(-4), 'tokB', 'Brian Bose', '', 'Neil Ramnanan', dayDate(-4), 'board', 'Ricky Rampersad'],
  [dayDate(-3), 'tokC', 'Carla Cobb', '', 'Narissa Mohammed', dayDate(-3), 'board', 'Azariah Griffith'],
  [dayDate(-2), 'tokD', 'Dara Dunn', '', 'Neil Ramnanan', dayDate(-2), 'Salesforce', 'Salesforce']]);
e.__mkSheet('Cup Reads', 4, ['Read on', 'Staff', 'Token', 'Key', 'Communication', 'Bringing it home', 'Why', 'By'], [
  [dayDate(-1), 'sasha', 'tokA', 'old', 5, 5, 'Clear notes and a firm next step.', 'AI']]);

e.__mkSheet('Agent Briefs', 5, ['When', 'Token', 'Client', 'Agent', 'Named on', 'Source', 'Status'], [
  [dayDate(-3), 'tokA', 'Alice Abel', 'Neil Ramnanan', dayDate(-3), 'board', 'sent'],
  [dayDate(-2), 'tokB', 'Brian Bose', 'Neil Ramnanan', dayDate(-2), 'Salesforce', 'sent'],
  [dayDate(-1), 'tokC', 'Carla Cobb', 'Gone Agent', dayDate(-1), 'Salesforce', 'held: not active']]);
e.__mkSheet('Branch Watch', 6, ['When', 'Kind', 'Token', 'Client', 'Agent', 'Key', 'To', 'What', 'Ref', 'Status'], [
  [dayDate(-2), 'clock', 'tokA', 'Alice Abel', 'Neil', 'k1', 'x', 'Level 1', '', 'sent'],
  [dayDate(-1), 'clock', 'tokB', 'Brian Bose', 'Neil', 'k2', 'x', 'Level 2', '', 'sent (passed)'],
  [dayDate(-1), 'chase', 'tokC', 'Carla Cobb', 'Neil', 'k3', 'x', 'words', '', 'sent to the branch manager only'],
  [dayDate(-1), 'naming', 'tokD', 'Dara Dunn', 'Neil', 'k4', 'x', 'words', '', '']]);

/* Salesforce, made up */
e.tSfOn_ = () => true;
e.tSfQuery_ = q => {
  if (/FROM Task WHERE IsClosed/.test(q)) return [];
  if (/FROM TaskFeed/.test(q) || /FROM FeedComment/.test(q)) return [];
  if (/Campaign__c = 'Orphan'/.test(q)) return [
    { Contact__c: 'K1', Assigned_Agent__r: { Name: 'Neil Ramnanan', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: shift(-5), Campain_Feedback_Update__c: 'Met' },
    { Contact__c: 'K7', Assigned_Agent__r: { Name: 'Javid Ali', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: shift(-2), Campain_Feedback_Update__c: '' },
    { Contact__c: 'K8', Assigned_Agent__r: { Name: 'Aleema Mohammed-Ali', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: shift(-2), Campain_Feedback_Update__c: '' }];
  throw new Error('part 1 asked: ' + q);
};
e.tRoster_ = () => [{ name: 'Neil Ramnanan' }, { name: 'Javid Ali' }, { name: 'Aleema Mohammed-Ali' }, { name: 'Ricky Rampersad' }];
const TA = '00TA00000000001AAA', TB = '00TB00000000001AAA', TC = '00TC00000000001AAA', TD = '00TD00000000001AAA', TE = '00TE00000000001AAA', TF = '00TF00000000001AAA';
const BM = { Name: 'Ricky Rampersad' };
e.tSfComposite_ = q => {
  if (/Date_SQ_submitted__c >= /.test(q) && /Was_Agent_Paid__c/.test(q)) return [
    { Contact__c: 'K1', POLICY__c: '5000000100', Date_SQ_submitted__c: shift(-5), Date_Comm_Paid__c: shift(-1), Was_Agent_Paid__c: 'Yes', Assigned_Agent__r: { Name: 'Neil Ramnanan', Employment_Status__c: 'Active' } },
    { Contact__c: 'K7', POLICY__c: '5000000200', Date_SQ_submitted__c: shift(-3), AgentName__c: 'A04020 - Javid Ali' }];
  if (/App_Received_Date__c >= /.test(q)) return [
    { Id: 'a1', Contact__c: 'N1', POLICY__c: '5009990001', App_Received_Date__c: shift(-10), Date_Settled__c: shift(-3), Policy_Status_Description__c: 'Premium Paying', AgentName__c: 'A04020 - Javid Ali', RecordType: { Name: 'LIFE' } },
    { Id: 'a2', Contact__c: 'N1', POLICY__c: '5009990002', App_Received_Date__c: shift(-9), Policy_Status_Description__c: 'Underwriting incomplete', AgentName__c: 'A04028 - Aleema Mohammed-Ali', RecordType: { Name: 'LIFE' } },
    { Id: 'a3', Contact__c: 'N1', POLICY__c: '5009990003', App_Received_Date__c: shift(-9), Policy_Status_Description__c: 'Premium Paying', AgentName__c: 'A10024 - Neil Ramnanan', RecordType: { Name: 'LIFE' } }];
  if (/WHERE Contact__c IN/.test(q) && /'N1'/.test(q)) return [{ Contact__c: 'N1', POLICY__c: '5000000200' }];
  if (/FROM Task WHERE Subject LIKE 'Orphan%'/.test(q)) return [
    { Id: TA, CreatedDate: sfAt(-8, 7), WhatId: 'RA', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null, Owner: { Name: 'Sasha Lalla-Jagassar' }, IsClosed: false },
    { Id: TB, CreatedDate: sfAt(-6, 7), WhatId: 'RB', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null, Owner: { Name: 'Elizabeth Lee' }, IsClosed: true, CompletedDateTime: sfAt(-1, 15) },
    { Id: TC, CreatedDate: sfAt(-4, 7), WhatId: 'RC', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null, Owner: { Name: 'Azariah Griffith' }, IsClosed: false },
    { Id: TD, CreatedDate: sfAt(-3, 7), WhatId: 'RD', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null, Owner: { Name: 'Sasha Lalla-Jagassar' }, IsClosed: false },
    { Id: TE, CreatedDate: sfAt(-3, 7), WhatId: 'RE', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null, Owner: { Name: 'Azariah Griffith' }, IsClosed: false },
    { Id: TF, CreatedDate: sfAt(-3, 7), WhatId: 'RF', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null, Owner: { Name: 'Elizabeth Lee' }, IsClosed: false }];
  if (/WHERE Id IN/.test(q)) return [{ Id: 'RA', POLICY__c: '5000000100' }, { Id: 'RB', POLICY__c: '5000000200' }, { Id: 'RC', POLICY__c: '5000000300' }, { Id: 'RD', POLICY__c: '5000000400' }];
  if (/WHERE Contact__c IN/.test(q)) return [];
  if (/FROM TaskFeed/.test(q)) return [
    /* task A: the daily list, then Sasha the same day (an answer); then his own follow-up, never answered */
    { ParentId: TA, Body: 'ON YOUR LIST TODAY — Sasha Lalla-Jagassar, #1 of 4', CreatedDate: sfAt(-2, 6), CreatedBy: BM },
    { ParentId: TA, Body: '<p>Spoke to Alice Abel, she confirmed her e-mail. Will send the service questionnaire tomorrow.</p>', CreatedDate: sfAt(-2, 11), CreatedBy: { Name: 'Sasha Lalla-Jagassar' } },
    { ParentId: TA, Body: '<p>Sasha, where are we with this client? Please update today.</p>', CreatedDate: sfAt(-1, 8), CreatedBy: BM },
    /* task B: Liz on her own, then Branch Intelligence, answered the next working day by her close */
    { ParentId: TB, Body: '<p>Called the client, no answer, left a voicemail.</p>', CreatedDate: sfAt(-6, 9), CreatedBy: { Name: 'Elizabeth Lee' } },
    { ParentId: TB, Body: 'Branch Intelligence · Mon 26 Oct: this task has had no note in three days. What happened on the call?', CreatedDate: sfAt(-3, 9), CreatedBy: BM },
    /* task C: Azariah parks it with the branch manager, after a follow-up */
    { ParentId: TC, Body: 'FOLLOW-UP · the client asked for a call two days ago.', CreatedDate: sfAt(-4, 9), CreatedBy: BM },
    { ParentId: TC, Body: 'Sales Support · Azariah Griffith · Mon 26 Oct: Spoke to the client, awaiting new agent to be assigned, please advise who to assign.', CreatedDate: sfAt(-2, 10), CreatedBy: BM },
    /* task D: a move for cover, Kamla's note on her own, a naming, and a record */
    { ParentId: TD, Body: 'MOVED 26 Oct. Sasha is absent today. This task is now with Azariah.', CreatedDate: sfAt(-1, 7), CreatedBy: BM },
    { ParentId: TD, Body: '<p>Pending</p>', CreatedDate: sfAt(-1, 9), CreatedBy: { Name: 'Kamla Dookran' } },
    { ParentId: TD, Body: 'AGENT NAMED: Neil Ramnanan, 27 Oct.', CreatedDate: sfAt(-1, 12), CreatedBy: BM },
    { ParentId: TD, Body: 'Sales Support · Sasha Lalla-Jagassar · Tue 27 Oct: not touched today.', CreatedDate: sfAt(-1, 17), CreatedBy: BM },
    /* task E and others: the morning chase in his voice, five in two minutes */
    { ParentId: TE, Body: 'Azariah, please call this client today.', CreatedDate: sfAt(0, 7).replace(':00:00', ':00:10'), CreatedBy: BM },
    { ParentId: TA, Body: 'Sasha, call today.', CreatedDate: sfAt(0, 7).replace(':00:00', ':00:40'), CreatedBy: BM },
    { ParentId: TC, Body: 'Azariah, call today.', CreatedDate: sfAt(0, 7).replace(':00:00', ':01:10'), CreatedBy: BM },
    { ParentId: TD, Body: 'Azariah, please update this one.', CreatedDate: sfAt(0, 7).replace(':00:00', ':01:30'), CreatedBy: BM },
    { ParentId: TB, Body: 'Liz, update please.', CreatedDate: sfAt(0, 7).replace(':00:00', ':01:50'), CreatedBy: BM },
    /* task F, the shapes read off the real posts: an instruction drafted for him, a hold notice, an agent's note through the
       board, the tracker's close-off line under a staff header, and a staff note asking him who to assign */
    { ParentId: TF, Body: 'UPDATE — the client wrote in this morning; please call today.', CreatedDate: sfAt(-1, 9), CreatedBy: BM },
    { ParentId: TF, Body: 'HOLD — do not call until the agent is named.', CreatedDate: sfAt(-1, 10), CreatedBy: BM },
    { ParentId: TF, Body: 'From the assignment board · Neil Ramnanan (Agent), 27 Oct 2026, 11:00: Met the client at home.', CreatedDate: sfAt(-1, 11), CreatedBy: BM },
    { ParentId: TF, Body: 'Sales Support · Elizabeth Lee · Tue 27 Oct:\nNot done today: the client did not answer.\nNew date Wed 28 Oct.', CreatedDate: sfAt(-1, 17), CreatedBy: BM },
    { ParentId: TF, Body: 'Staff · Sasha Lalla-Jagassar · Wed 28 Oct: Hi Mr Rampersad, please advise who to assign this to.', CreatedDate: sfAt(0, 9), CreatedBy: BM },
    /* a board note by the branch manager himself is his own words */
    { ParentId: TE, Body: 'From the assignment board · Ricky Rampersad (Branch Manager), 28 Oct 2026, 10:15: I called the client myself, Azariah to follow up.', CreatedDate: sfAt(0, 10), CreatedBy: BM }];
  if (/FROM FeedComment/.test(q)) return [{ ParentId: TE, CommentBody: 'Called, no answer. Will try again tomorrow.', CreatedDate: sfAt(0, 11), CreatedBy: { Name: 'Azariah Griffith' } }];
  if (/Date_SQ_submitted__c >= /.test(q)) return [];
  throw new Error('unexpected query: ' + q);
};

const d = e.transitionBoard_({ action: 'board', who: 'wall' });
const body = JSON.stringify(d);
ok('the answer comes, with no part 2 error', d.ok === true && d.wall === 1 && !d.part2, body.slice(0, 300));

console.log('\nJavid off the slides (and Aleema, by the 17 September rule):');
ok('not among the agents named', !(d.agents.people || []).some(p => /Javid|Aleema/.test(p.name)) && (d.agents.people || []).some(p => p.name === 'Neil R.'), JSON.stringify(d.agents.people));
ok('not on the money\'s agent rows', !(d.money.agents || []).some(a => /Javid|Aleema/.test(a.name)), JSON.stringify(d.money.agents));
ok('the money\'s totals still count the claim', d.money.clients === 2, String(d.money.clients));
ok('not on the new business rows', !(d.results.apps.agents || []).some(a => /Javid|Aleema/.test(a.name)) && d.results.apps.agents.some(a => a.name === 'Neil R.'), JSON.stringify(d.results.apps.agents));
ok('the new business totals still count them', d.results.apps.apps === 3, String(d.results.apps.apps));
ok('not on who looks after whom', !(d.charge.agents || []).some(a => /Javid|Aleema/.test(a.name)), JSON.stringify(d.charge.agents));
ok('the name appears nowhere in the answer', !/Javid|Aleema|A04020|A04028/.test(body), (body.match(/.{40}(Javid|Aleema).{40}/) || [])[0]);
e.PropertiesService.getScriptProperties().setProperty('OWALL_HIDE', 'Neil Ramnanan');
ok('the OWALL_HIDE property adds a name', e.tOwallHidden_('A10024 - Neil Ramnanan') && !e.tOwallHidden_('Narissa Mohammed'));
e.PropertiesService.getScriptProperties().deleteProperty('OWALL_HIDE');
ok('a name is matched by first and last name, whatever sits between', e.tOwallHidden_('Javid A. Ali') && e.tOwallHidden_('ALEEMA MOHAMMED-ALI') && !e.tOwallHidden_('Ali Javid') && !e.tOwallHidden_('Neil Ramnanan'));

console.log('\nWhat his automation sent:');
const DR = d.drive || {};
const MK = Object.fromEntries(((DR.mail || {}).kinds || []).map(k => [k.key, k.n]));
ok('letters, reminders, sent again, receipts, still-on-it notes, notes in his name, introductions, late alerts, replies filed',
  MK.letters === 6 && MK.reminders === 2 && MK.again === 1 && MK.receipts === 3 && MK.still === 2 && MK.notes === 1 && MK.intros === 2 && MK.late === 4 && MK.replies === 5, JSON.stringify(MK));
ok('the agent briefs that went (a held one does not count)', MK.briefs === 2, String(MK.briefs));
ok('the clock\'s reminders to agents, and the chasing alert', MK.clock === 2 && MK.chasing === 1 && !MK.notecheck, JSON.stringify(MK));
ok('the total is the sum', DR.mail.total === Object.values(MK).reduce((a, b) => a + b, 0), String(DR.mail.total));

console.log('\nHis posts on the orphan tasks:');
const PA = (DR.posts || {}).all || {};
ok('his own words: the follow-up on A and his board note (the burst, and an agent\'s note through the board, are not his hand)', PA.own === 2, JSON.stringify(PA));
ok('the morning chase in his voice: five in two minutes', PA.chase === 5, JSON.stringify(PA));
ok('one daily list, one Branch Intelligence note, two instructions drafted for him (FOLLOW-UP, UPDATE), one task moved for cover', PA.list === 1 && PA.intel === 1 && PA.follow === 2 && PA.move === 1, JSON.stringify(PA));
ok('a naming, a hold notice and the tracker\'s "not touched" record are counted, and are not prompts', PA.name === 1 && PA.hold === 1 && PA.auto === 1, JSON.stringify(PA));
ok('a staff note headed with their name is not his', !(PA.own > 2));
ok('today: the chase and his board note', DR.posts.today.chase === 5 && DR.posts.today.own === 1, JSON.stringify(DR.posts.today));
ok('by hand and by automation', DR.posts.hand.all === 2 && DR.posts.auto.all === 10, JSON.stringify([DR.posts.hand, DR.posts.auto]));

console.log('\nWhen the team answers:');
const AN = DR.answer || {};
ok('twelve prompts', AN.prompts === 12, JSON.stringify(AN));
ok('seven answered: the list on A, Intelligence on B (by the close), the follow-up on C, the move on D (by Kamla), both on E, the update on F (by Liz\'s close-off line)', AN.answered === 7, JSON.stringify(AN));
ok('the same day five times (A, D, both on E, F); the rest within a working day or two', AN.same === 5 && AN.same + AN.next + AN.later === 7, JSON.stringify(AN));
ok('his own follow-up on A, and four of this morning\'s chase, are still open', AN.open === 5, JSON.stringify(AN));
ok('by hand: two prompts, one answered (Azariah on E)', AN.hand.prompts === 2 && AN.hand.answered === 1, JSON.stringify(AN.hand));
const TM = Object.fromEntries((DR.team || []).map(p => [p.name, p]));
ok('Sasha: a note after the list, and a question to him on her own (a "Staff ·" line is hers)', TM.Sasha && TM.Sasha.notes === 2 && TM.Sasha.after === 1 && TM.Sasha.own === 1, JSON.stringify(TM.Sasha));
ok('Liz: her first note on her own, a close that answers Branch Intelligence, and a close-off line after the update', TM.Liz && TM.Liz.notes === 2 && TM.Liz.own === 1 && TM.Liz.after === 1 && TM.Liz.closes === 1 && TM.Liz.answered >= 2, JSON.stringify(TM.Liz));
ok('Azariah: two notes after a prompt (the tracker\'s under her name, and a comment)', TM.Azariah && TM.Azariah.notes === 2 && TM.Azariah.after === 2, JSON.stringify(TM.Azariah));
ok('Kamla: a note after the move', TM.Kamla && TM.Kamla.notes === 1 && TM.Kamla.after === 1, JSON.stringify(TM.Kamla));
ok('prompts left open on a task count against who holds it', TM.Sasha.waiting >= 2, JSON.stringify(TM.Sasha));
ok('the team\'s notes, and the share after a prompt', DR.notes === 7 && DR.after === 5, DR.notes + ' ' + DR.after);

console.log('\nWhat the notes say:');
ok('Sasha: reached, details, the questionnaire and a next step: a drive', TM.Sasha.themes.r === 1 && TM.Sasha.themes.d === 1 && TM.Sasha.themes.q === 1 && TM.Sasha.read.drive === 1, JSON.stringify(TM.Sasha));
ok('Sasha: "please advise who to assign" leaves it with him', TM.Sasha.themes.p === 1 && TM.Sasha.themes.k === 1 && TM.Sasha.read.park === 1, JSON.stringify(TM.Sasha));
ok('Liz: the close-off line is a date moved, no outcome', TM.Liz.themes.x === 1 && TM.Liz.read.status === 1, JSON.stringify(TM.Liz));
ok('Azariah: one parked with the branch manager, one a try with a next step', TM.Azariah.themes.p === 1 && TM.Azariah.read.park === 1 && TM.Azariah.themes.t === 1, JSON.stringify(TM.Azariah));
ok('Liz: a try, recorded', TM.Liz.themes.t === 1 && TM.Liz.read.record === 1, JSON.stringify(TM.Liz));
ok('the headers come off before a note is read', e.tOwallStrip_('Sales Support · Elizabeth Lee · Tue 27 Oct 4:10 pm:\nNot done today: x.\nNew date Wed 28 Oct.').indexOf('Not done today') === 0
  && e.tOwallStrip_('From the assignment board · Sasha Lalla-Jagassar (Client Support), 27 Oct 2026, 10:15: Left a message.') === 'Left a message.');
ok('Kamla: "Pending" is a status with no outcome', TM.Kamla.themes.v === 1 && TM.Kamla.read.status === 1, JSON.stringify(TM.Kamla));

console.log('\nThe last ten working days:');
ok('ten working days, today last', (DR.days || []).length === 10 && DR.days[9].d === TODAY || e.Utilities.formatDate(new Date(), TZ, 'u') > 5, JSON.stringify((DR.days || []).map(x => x.d)));
const dd = Object.fromEntries((DR.days || []).map(x => [x.d, x]));
if (dd[TODAY]) ok('today: one prompt by hand, five by automation, two notes, one after a prompt', dd[TODAY].hand === 1 && dd[TODAY].auto === 5 && dd[TODAY].notes === 2 && dd[TODAY].after === 1, JSON.stringify(dd[TODAY]));
ok('named on the board by him: none in this sample; the namers are read', DR.named && typeof DR.named.board === 'number');

console.log('\nNothing about a client:');
['tokA', 'tokB', 'Alice', 'Abel', 'Brian', 'Carla', 'Dara', '5000000', '5009990', TA.slice(0, 15), 'voicemail', 'where are we', 'Pending', 'Met the client', 'wrote in this morning'].forEach(s => ok('no "' + s + '"', body.indexOf(s) < 0));
ok('no staff surname', !/Lalla|Jagassar|Griffith|Dookran|Ramnanan\b/.test(body), (body.match(/.{30}(Lalla|Jagassar|Griffith|Dookran|Ramnanan\b).{30}/) || [])[0]);

console.log('\nWithout Salesforce:');
e.tSfOn_ = () => false;
const d2 = e.transitionBoard_({ action: 'board', who: 'wall' });
ok('what his automation sent still comes', d2.drive && d2.drive.mail && d2.drive.mail.total > 0 && !d2.drive.posts, JSON.stringify(d2.drive).slice(0, 200));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
