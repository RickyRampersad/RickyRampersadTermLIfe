// Part 2 of the orphan campaign on the Branch Intelligence wall (28 October 2026): Transition.gs tOrphanWall2_ and the
// First-Contact Cup. Salesforce, the sheet and the AI are made up here. Checks the TT$200 money by stage and by agent
// (anyone who has left on one line, never named), new applications from the campaign's own clients, premiums paid back and
// policies back in force from the Client Book, who is in charge, the cup's points for Liz, Sasha and Azariah, the AI reads
// and what they are sent, and that the answer carries no client, no token, no policy and no former agent.
// Run: node tests/test-orphan-wall2.js
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
  auto: { letters: 6, reminders: 2, afterReminder: 1, replies: 5 }, people: { firstTouch: {} },
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

/* Salesforce, made up */
e.tSfOn_ = () => true;
const part1 = q => {
  if (/FROM Task WHERE IsClosed/.test(q)) return [];
  if (/FROM TaskFeed/.test(q) || /FROM FeedComment/.test(q)) return [];
  if (/Campaign__c = 'Orphan'/.test(q)) return [
    { Contact__c: 'K1', Assigned_Agent__r: { Name: 'Neil Ramnanan', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: shift(-5), Campain_Feedback_Update__c: 'Met' },
    { Contact__c: 'K9', Assigned_Agent__r: { Name: 'Narissa Mohammed', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: shift(-3), Campain_Feedback_Update__c: '' }];
  throw new Error('part 1 asked: ' + q);
};
e.tSfQuery_ = part1;
const TA = '00TA00000000001AAA', TB = '00TB00000000001AAA', TC = '00TC00000000001AAA', TD = '00TD00000000001AAA';
const asked = [];
e.tSfComposite_ = q => {
  asked.push(q);
  if (/Date_SQ_submitted__c >= /.test(q) && /Was_Agent_Paid__c/.test(q)) return [
    { Contact__c: 'K1', POLICY__c: '5000000100', Date_SQ_submitted__c: shift(-5), Date_SQ_submitted_to_CSR__c: shift(-4), Date_SQ_processed_by_CSR__c: shift(-3),
      Date_Subm_to_Retention__c: shift(-2), Was_Agent_Paid__c: 'No', Date_Comm_Paid__c: shift(7), Assigned_Agent__r: { Name: 'Neil Ramnanan', Employment_Status__c: 'Active' }, AgentName__c: 'A11801 - Tricia Baksh' },
    { Contact__c: 'K2', POLICY__c: '5000009991', Date_SQ_submitted__c: shift(-20), Date_Subm_to_Retention__c: shift(-15), Was_Agent_Paid__c: 'Yes', Date_Comm_Paid__c: shift(-1), AgentName__c: 'A10024 - Neil Ramnanan' },
    { Contact__c: 'K2', POLICY__c: '5000009992', Date_SQ_submitted__c: shift(-20), Was_Agent_Paid__c: 'Yes', AgentName__c: 'A10024 - Neil Ramnanan' },
    { Contact__c: 'K3', POLICY__c: '5000009993', Date_SQ_submitted__c: shift(-6), Was_Agent_Paid__c: 'Yes', AgentName__c: 'A01363 - Kerwyn Ramroach' },
    { Contact__c: 'K4', POLICY__c: '5000009994', Date_SQ_submitted__c: shift(-4), AgentName__c: 'A01066 - Narissa Mohammed' },
    { Contact__c: 'K5', POLICY__c: '5000009995', Date_SQ_submitted__c: shift(-3), AgentName__c: 'A00427 - Ricky Rampersad' }];
  if (/App_Received_Date__c >= /.test(q)) return [
    { Id: 'a1', Contact__c: 'N1', POLICY__c: '5009990001', App_Received_Date__c: shift(-10), Date_Settled__c: shift(-3), Policy_Status_Description__c: 'Premium Paying', AgentName__c: 'A10024 - Neil Ramnanan', RecordType: { Name: 'LIFE' } },
    { Id: 'a2', Contact__c: 'N1', POLICY__c: '5009990002', App_Received_Date__c: shift(-9), Policy_Status_Description__c: 'Underwriting incomplete', AgentName__c: 'A10024 - Neil Ramnanan', RecordType: { Name: 'HEALTH' } },
    { Id: 'a3', Contact__c: 'N2', POLICY__c: '5009990003', App_Received_Date__c: shift(-9), Policy_Status_Description__c: 'Premium Paying', AgentName__c: 'A10024 - Neil Ramnanan', RecordType: { Name: 'LIFE' } }];
  if (/WHERE Contact__c IN/.test(q) && /'N1'/.test(q)) return [{ Contact__c: 'N1', POLICY__c: '5000000200' }, { Contact__c: 'N1', POLICY__c: '5009990001' }, { Contact__c: 'N2', POLICY__c: '5009990003' }];
  if (/FROM Task WHERE Subject LIKE 'Orphan%'/.test(q)) return [
    { Id: TA, CreatedDate: sfAt(-8, 7), WhatId: 'RA', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null },
    { Id: TB, CreatedDate: sfAt(-6, 7), WhatId: 'RB', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null },
    { Id: TC, CreatedDate: sfAt(-4, 7), WhatId: 'ACC', What: { Type: 'Account' }, WhoId: 'KC' },
    { Id: TD, CreatedDate: sfAt(-3, 7), WhatId: 'RD', What: { Type: 'CLIENT_PORTFOLIO__c' }, WhoId: null }];
  if (/WHERE Id IN/.test(q)) return [{ Id: 'RA', POLICY__c: '5000000100' }, { Id: 'RB', POLICY__c: '5000000200' }, { Id: 'RD', POLICY__c: '5000000400' }];
  if (/WHERE Contact__c IN/.test(q) && /'KC'/.test(q)) return [{ Contact__c: 'KC', POLICY__c: '5000000300' }];
  if (/WHERE Contact__c IN/.test(q)) return [];
  if (/FROM TaskFeed/.test(q)) return [
    { ParentId: TA, Body: '<p>Called the client, no answer, left a voicemail.</p>', CreatedDate: sfAt(-8, 9), CreatedBy: { Name: 'Elizabeth Lee' } },
    { ParentId: TA, Body: '<p>Spoke to Alice Abel, she wants an agent to call about her policy. Will follow up Friday for the questionnaire.</p>', CreatedDate: sfAt(-8, 14), CreatedBy: { Name: 'Sasha Lalla-Jagassar' } },
    { ParentId: TC, Body: 'Sales Support · Azariah Griffith · Mon 26 Oct: Spoke to the client, confirmed the e-mail; the agent will call.', CreatedDate: sfAt(-2, 10), CreatedBy: { Name: 'Ricky Rampersad' } },
    { ParentId: TD, Body: 'From the assignment board · Sasha Lalla-Jagassar (Client Support), 27 Oct 2026, 10:15: Left a message for the client.', CreatedDate: sfAt(-1, 10), CreatedBy: { Name: 'Ricky Rampersad' } },
    { ParentId: TD, Body: 'ON YOUR LIST TODAY — Sasha Lalla-Jagassar, #1 of 4', CreatedDate: sfAt(-1, 6), CreatedBy: { Name: 'Ricky Rampersad' } },
    { ParentId: TB, Body: '<p>WhatsApp message from Kamla to client.</p>', CreatedDate: sfAt(-2, 9), CreatedBy: { Name: 'Kamla Dookran' } }];
  if (/FROM FeedComment/.test(q)) return [{ ParentId: 'notorphan', CommentBody: 'Spoke to someone else.', CreatedDate: sfAt(-1, 9), CreatedBy: { Name: 'Sasha Lalla-Jagassar' } }];
  if (/Date_SQ_submitted__c >= /.test(q)) return [{ POLICY__c: '5000000100', Contact__c: 'K1', Date_SQ_submitted__c: shift(-5) }];
  throw new Error('unexpected query: ' + q);
};

const d = e.transitionBoard_({ action: 'board', who: 'wall' });
const body = JSON.stringify(d);
ok('the answer comes', d.ok === true && d.wall === 1, body.slice(0, 300));
ok('no part 2 error', !d.part2, JSON.stringify(d.part2));

console.log('\nThe TT$200 money:');
const M = d.money || {};
ok('one claim a client, the branch manager\'s never', M.clients === 4, JSON.stringify(M));
ok('paid once the date has come, to be paid when it is ahead, pending otherwise', M.paid === 1 && M.scheduled === 1 && M.pending === 2, JSON.stringify(M.stage));
ok('stages: received 1, with Retention 0, to be paid 1, paid 1, and the one with "Yes" and no date', M.stage.received === 2 && M.stage.scheduled === 1 && M.stage.paid === 1 && M.noDate === 1, JSON.stringify(M.stage) + ' noDate ' + M.noDate);
ok('TT$200 a client, as T_CLAIM says', M.amount === 200 && M.cur === 'TT$');
const MA = Object.fromEntries((M.agents || []).map(a => [a.name, a]));
ok('Neil: two claims, one paid, one to be paid (Assigned Agent wins over the policy\'s agent)', MA['Neil R.'] && MA['Neil R.'].sq === 2 && MA['Neil R.'].paid === 1 && MA['Neil R.'].scheduled === 1, JSON.stringify(MA));
ok('Narissa: one pending', MA['Narissa M.'] && MA['Narissa M.'].pending === 1);
ok('an agent who left is one line, never named', M.left && M.left.sq === 1 && !MA['Kerwyn R.'] && !MA['Tricia B.'], JSON.stringify(M.left));
ok('the next pay date is said', /\d+ [A-Z][a-z]{2}/.test(M.next || ''), M.next);

console.log('\nWhat the campaign earned:');
const R = (d.results || {}).apps || {};
ok('applications from the campaign\'s own clients only (matched by a policy they held)', R.clients === 1 && R.apps === 2, JSON.stringify(R));
ok('one settled, one in underwriting', R.settled === 1 && R.uw === 1 && R.ntu === 0);
ok('the branch\'s own total is kept apart', R.branchApps === 3);
const B = d.back || {};
ok('letter I: 4 written to (excluded and test rows aside)', B.ready && B.I.letter === 3, JSON.stringify(B));
ok('paid past the letter\'s date: one; still behind: one; nothing paying: one', B.I.caughtUp === 1 && B.I.behind === 1 && B.I.none === 1, JSON.stringify(B.I));
ok('letter G: one of two back in force', B.G.letter === 2 && B.G.back === 1, JSON.stringify(B.G));
ok('when the Client Book was built is said', B.built === '28 Oct 06:00');

console.log('\nWho is in charge:');
const CH = d.charge || {};
const CA = Object.fromEntries((CH.agents || []).map(a => [a.name, a]));
ok('each agent with their support person', CA['Neil R.'] && CA['Neil R.'].support === 'Liz' && CA['Narissa M.'] && CA['Narissa M.'].support === 'Azariah', JSON.stringify(CH.agents));
ok('their claims beside their clients', CA['Neil R.'].sq === 2 && CA['Neil R.'].paid === 1);
const CN = Object.fromEntries((CH.namers || []).map(x => [x.name, x.n]));
ok('who named: the Branch Manager twice, Azariah once, Salesforce once', CN['Branch Manager'] === 2 && CN.Azariah === 1 && CN['In Salesforce'] === 1, JSON.stringify(CH.namers));
const CS = Object.fromEntries((CH.support || []).map(x => [x.name, x]));
ok('each support person\'s agents', CS.Liz && CS.Liz.agents === 1 && CS.Azariah && CS.Azariah.agents === 1, JSON.stringify(CH.support));

console.log('\nWhat clients told us:');
const S = d.said || {};
ok('asks, subjects (thanks apart) and what needs a person', S.asks.length === 2 && S.themes.length === 1 && S.themes[0].label === 'Premiums and payments' && S.thanks === 9 && S.risk.length === 1, JSON.stringify(S));
ok('wrote in, and replies by e-mail', S.wrote === 4 && S.replies === 5);

console.log('\nThe First-Contact Cup:');
const CUP = d.cup || {};
ok('the cup comes', CUP.people && CUP.people.length === 3, JSON.stringify(CUP).slice(0, 300));
const P = Object.fromEntries((CUP.people || []).map(p => [p.name, p]));
ok('Sasha reached Alice first, the same day she answered, and the questionnaire came in within 7 days', P.Sasha.all.reached === 1 && P.Sasha.all.fast === 1 && P.Sasha.all.home === 1 && P.Sasha.all.homeFast === 1, JSON.stringify(P.Sasha.all));
ok('Sasha\'s AI read counts (5 and 5 on Alice; the rules\' 2 and 1 on Dara, a message left)', P.Sasha.all.commGood === 1 && P.Sasha.all.driveGood === 1 && P.Sasha.all.comm === 3.5 && P.Sasha.all.drive === 3, JSON.stringify(P.Sasha.all));
ok('Sasha\'s points: 3 + 2 + 10 + 5 + 1 + 1, plus her try on Dara (rules: no conversation)', P.Sasha.all.pts === 22, String(P.Sasha.all.pts));
ok('Liz: a try on Alice before Sasha, and Brian reached on the board', P.Liz.all.reached === 1 && P.Liz.all.tried >= 1, JSON.stringify(P.Liz.all));
ok('Liz made the first contact on Alice and Brian: her speed is the median of the two', typeof P.Liz.all.speed === 'number' && P.Liz.all.speed <= 3, String(P.Liz.all.speed));
ok('Azariah: Carla reached through the tracker\'s note under her name, and Ezra\'s details taken on a call', P.Azariah.all.reached === 2, JSON.stringify(P.Azariah.all));
ok('Azariah: the questionnaire Ezra filed after her call is brought home', P.Azariah.all.home === 1, JSON.stringify(P.Azariah.all));
ok('Kamla is not in the cup; a list post is nobody\'s note', !P.Kamla && Object.keys(P).sort().join(',') === 'Azariah,Liz,Sasha');
ok('a leader for the campaign so far', ['Sasha', 'Azariah', 'Liz'].includes(CUP.leader.all), CUP.leader.all);
ok('three periods, the week from Wednesday', /since 25 Sep/.test(CUP.periods.all) && CUP.periods.week && CUP.periods.last, JSON.stringify(CUP.periods));
ok('the points are said, so the page can explain them', CUP.points.home === 10 && CUP.points.reached === 3);
ok('reads by rules where the AI has not read yet, and the AI off is said', CUP.read && CUP.read.on === false && CUP.read.ai >= 1, JSON.stringify(CUP.read));

console.log('\nNothing about a client:');
['tokA', 'tokB', 'tokC', 'Alice', 'Abel', 'Brian', 'Bose', 'Carla', 'Dara', 'Ezra', 'Fiona', 'Xavier', '5000000', '5009990', 'K1', 'N1', TA, '868-555', 'e@x.com', 'Kerwyn', 'Ramroach', 'Tricia', 'Baksh', 'voicemail', 'questionnaire for']
  .forEach(s => ok('no "' + s + '"', body.indexOf(s) < 0));
ok('no staff surname', !/Lalla|Jagassar|Griffith|Dookran|Ramnanan\b/.test(body), (body.match(/Lalla|Jagassar|Griffith|Dookran|Ramnanan\b/) || [])[0]);

console.log('\nThe AI reads (tCupRun_):');
const sent = [];
e.gcmAiKey_ = () => 'k';
e.tGuideClaude_ = (sys, user, schema) => { sent.push(user); const items = JSON.parse(user); return { reads: items.map(x => ({ id: x.id, comm: 4, drive: 3, why: 'Clear notes, 868 555 1234 and Alice.' })) }; };
e.tWorkday_ = () => true; e.tHourOf_ = () => 10;
const r1 = e.tCupRun_({ force: true });
ok('it reads every timeline it has not read, or that changed', r1.read >= 4, JSON.stringify(r1));
const sentAll = sent.join('\n');
ok('the AI is sent no client name, phone or e-mail', !/Alice|Abel|Brian|868-555|e@x\.com/.test(sentAll), sentAll.slice(0, 400));
ok('the AI is told what happened around the notes', /questionnaire_in/.test(sentAll) && /client_answered_or_task_opened/.test(sentAll));
const tab = e.__sheets['Cup Reads']._grid;
ok('each read is a row on Cup Reads, the old one replaced', tab.filter(r => r[1] === 'sasha' && r[2] === 'tokA').length === 1 && tab.length - 1 >= 4, JSON.stringify(tab.slice(0, 3)));
ok('the why keeps no long number', !tab.slice(1).some(r => /\d{4,}/.test(String(r[6]))));
const before = sent.length;
const r2 = e.tCupRun_({ force: true });
ok('a second run reads nothing that has not changed', r2.read === 0 && sent.length === before, JSON.stringify(r2));
e.tWorkday_ = () => false;
ok('outside working days it waits', e.tCupRun_({}).read === 0);

console.log('\nWithout Salesforce:');
e.tSfOn_ = () => false;
const d2 = e.transitionBoard_({ action: 'board', who: 'wall' });
ok('the Client Book\'s results and what clients said still come', d2.back && d2.back.ready && d2.said && !d2.money && !d2.cup);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
