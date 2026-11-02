// HELP 868: what the WhatsApp assistant may ask of the tracker (2 November 2026).
// Pinned: nothing answers without the key; nothing about a case is shown until the agent number AND the e-mailed code are right;
// the code goes only when the WhatsApp number is on the pilot tab and the Skill Bank agrees (and the reply is the same words
// whatever happened); five wrong tries void the code; a session lasts for the number it was opened on and ends when the agent is
// switched off; a case shows requirements and task facts but never money, client names, note words or another agent's policy;
// Salesforce logging is off until HELP868_SF = on, then notes the Pendings task and opens a Servicing task on the agent's
// Contact; an enquiry gets a reference, is cleaned, is not filed twice, and a cell cannot start as a formula.
process.env.GS_PATH = __dirname + '/../apps-script/Help868.gs';
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
function sheet(name, rows) {
  const s = { rows: rows.map(r => r.slice()) };
  return Object.assign(s, {
    getName: () => name, getLastRow: () => s.rows.length,
    getDataRange: () => ({ getValues: () => s.rows.map(r => r.slice()) }),
    appendRow: r => { s.rows.push(r.slice()); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => Array.from({ length: nr || 1 }, (_, i) => Array.from({ length: nc || 1 }, (_, j) => { const row = s.rows[r - 1 + i] || []; return row[c - 1 + j] == null ? '' : row[c - 1 + j]; })),
      setValues: vs => vs.forEach((v, i) => v.forEach((x, j) => { while (s.rows.length < r + i) s.rows.push([]); s.rows[r - 1 + i][c - 1 + j] = x; })),
      setValue: v => { while (s.rows.length < r) s.rows.push([]); s.rows[r - 1][c - 1] = v; }
    })
  });
}
const RH = ['POLICY', 'application_number', 'Agent Name', 'REQUIREMENT_CODE', 'requirement_name', 'WHO_ACTS_NEXT', 'RAG_STATUS', 'REQUIREMENT_STATUS', 'DAYS_SINCE_SUBMISSION', 'DecisionType', 'mode_premium', 'SUSPENDED_AMOUNT'];
const tabs = [
  sheet('HELP868 Agents', [['Agent no.', 'Name', 'WhatsApp number', 'Active', 'Pendings'],
    ['', 'Neil Ramnanan', '+1 (868) 555-0101', 'Yes', ''], ['A10031', 'Joy Sammah', '868 555 0102', 'No', ''], ['', 'Rajiv Soodoo', '8685550103', 'Yes', 'No'], ['', 'Seven Digits', '5550104', 'Yes', '']]),
  sheet('Pendings Chase', [['Policy', 'Agent', 'Task', 'Owner', 'Due', 'Open tasks', 'Overdue', 'Last note at', 'Last note by', 'Last note', 'Earlier notes', 'Updated'],
    ['5000000001', 'Neil Ramnanan', 'Pending forms - CLIENT SMITH', 'Sasha Lalla-Jagassar', '2026-10-30', 1, 1, '1 Nov, 9:00 AM', 'Sasha Lalla-Jagassar', 'CLIENT SMITH medical booked', '[]', '2 Nov 2026, 6:00 AM'],
    ['5000000002', 'Neil Ramnanan', '', '', '', 0, 0, '', '', '', '[]', '2 Nov 2026, 6:00 AM'],
    ['7000000001', 'Neil Ramnanan', '', '', '', 0, 0, '', '', '', '[]', '2 Nov 2026, 6:00 AM'],
    ['5000000003', 'Someone Else', 'x', 'Azariah Griffith', '2026-11-05', 1, 0, '', '', 'secret', '[]', '2 Nov 2026, 6:00 AM']]),
  sheet('Branch Pendings_2026-11-02-0800', [RH,
    ['5000000001', '1000000001', 'Neil Ramnanan', 'FUTPY', 'Future premium payment', 'Agent', 'Red', 'Ordered - awaiting receipt', 21, 'Standard', '999', '555'],
    ['5000000001', '1000000001', 'Neil Ramnanan', 'FACTF', 'Fact find form', 'Underwriting', 'Green', 'Received and accepted', 21, 'Standard', '999', '555'],
    ['5000000002', '', 'Neil Ramnanan', 'AGEAD', 'Proof of identity', 'Agent', 'Amber', 'Ordered - awaiting receipt', 9, '', '', ''],
    ['7000000001', '', 'Neil Ramnanan', 'PRADD', 'Proof of address', 'Agent', 'Amber', 'Ordered - awaiting receipt', 5, '', '', ''],
    ['5000000003', '', 'Someone Else', 'FINQ', 'Financial questionnaire', 'Agent', 'Red', 'Ordered - awaiting receipt', 40, '', '', '']])
];
const ss = { getSheets: () => tabs, getSheetByName: n => tabs.find(t => t.getName() === n) || null, insertSheet: n => { const s = sheet(n, []); tabs.push(s); return s; } };
env.ss_ = () => ss; env.SpreadsheetApp.openById = () => ss; env.tBookId_ = () => 'BOOK'; env.tTz_ = () => 'America/Port_of_Spain'; env.log_ = () => {};
const realFmt = env.Utilities.formatDate;
env.Utilities.formatDate = (d, tz, f) => { const p2 = n => ('0' + n).slice(-2), y = d.getFullYear();
  if (f === 'yyMMdd') return p2(y % 100) + p2(d.getMonth() + 1) + p2(d.getDate());
  if (f === 'yyyy-MM-dd HH:mm') return y + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  return realFmt(d, tz, f); };
const mails = []; env.tMsSend_ = (to, subject, html) => { mails.push({ to, subject, htmlBody: html }); }; env.tMsCreds_ = () => true;
env.TRANSITION = { CC: ['boss@example.com'], MS_FROM: 'support@example.com' };
env.tTeam_ = () => ({ people: [
  { name: 'Neil Ramnanan', no: 'A10024', email: 'neil@example.com', role: 'agent', active: true },
  { name: 'Joy Sammah', no: 'A10031', email: 'joy@example.com', role: 'agent', active: true },
  { name: 'Rajiv Soodoo', no: 'A10040', email: 'rajiv@example.com', role: 'agent', active: true },
  { name: 'Sasha Lalla', no: 'S1', email: 'sasha@example.com', role: 'staff', active: true }] });
let aiKey = '';
env.gcmAiKey_ = () => aiKey;
let sfReady = false; env.tSfOn_ = () => sfReady;
const props = env.PropertiesService.getScriptProperties();
const cache = env.CacheService.getScriptCache();
const route = p => env.help868Route_(p);
const KEY = 'k'.repeat(24), NEIL = '+18685550101';
const lastCode = () => { const m = /letter-spacing:4px[^>]*>(\d{6})</.exec(mails[mails.length - 1].htmlBody); return m && m[1]; };
const base = { key: KEY, phone: NEIL };

ok('off until the key is set', route({ action: 'help868.case', key: KEY, phone: NEIL }).error === 'HELP 868 is not switched on.');
props.setProperty('HELP868_KEY', KEY);
ok('wrong key refused', route({ action: 'help868.case', key: 'x', phone: NEIL }).error === 'Not allowed.');
ok('no number refused', /No WhatsApp number/.test(route({ action: 'help868.case', key: KEY }).error));
ok('short number refused', /No WhatsApp number/.test(route({ action: 'help868.case', key: KEY, phone: '55501' }).error));

// before any code
let r = route({ ...base, action: 'help868.pendings' });
ok('no code, no list: it asks for the code flow', r.needCode === true && r.verified === false && !r.cases);
ok('no code, no case either', route({ ...base, action: 'help868.case', policy: '5000000001' }).needCode === true);

// the code goes only when both halves agree, and the reply never says which
const sent0 = mails.length;
const ok1 = route({ ...base, action: 'help868.code', agentNo: 'A10024' });
const clr = n => cache.remove('h868g_' + n);
clr('8685550101'); const wrongNo = route({ ...base, action: 'help868.code', agentNo: 'A10031' });
clr('8689999999'); const unknownPhone = route({ key: KEY, action: 'help868.code', phone: '8689999999', agentNo: 'A10024' });
clr('8685550102'); const inactive = route({ key: KEY, action: 'help868.code', phone: '8685550102', agentNo: 'A10031' });
clr('8685550103'); const noPend = route({ key: KEY, action: 'help868.code', phone: '8685550103', agentNo: 'A10040' });
ok('a matching number and agent number e-mails one code, to the Skill Bank address', mails.length === sent0 + 1 && mails[sent0].to === 'neil@example.com' && /^\d{6}$/.test(lastCode()), mails[sent0] && mails[sent0].to);
ok('every other case sends nothing and gets the same words', mails.length === sent0 + 1 && [wrongNo, unknownPhone, inactive, noPend].every(x => x.message === ok1.message && x.ok === true));
ok('a second request inside a minute is held', /a moment ago/.test(route({ ...base, action: 'help868.code', agentNo: 'A10024' }).message));

// verify: wrong tries, then right
const code = lastCode();
ok('a wrong code does not sign in', route({ ...base, action: 'help868.verify', code: '000000' }).verified === false);
ok('still no list after a wrong code', route({ ...base, action: 'help868.pendings' }).needCode === true);
const v = route({ ...base, action: 'help868.verify', code });
ok('the right code signs the number in', v.verified === true && v.name === 'Neil', JSON.stringify(v));
ok('a used code cannot be used again', route({ ...base, action: 'help868.verify', code }).verified === false);
// five wrong tries void a code
clr('8685550101'); route({ ...base, action: 'help868.code', agentNo: '10024' }); const c2 = lastCode();
for (let i = 0; i < 5; i++) route({ ...base, action: 'help868.verify', code: '111111' });
ok('five wrong tries void the code even for the right one', route({ ...base, action: 'help868.verify', code: c2 }).verified === false);

// pendings and case, signed in (session from the first code is still open)
r = route({ ...base, action: 'help868.pendings' });
ok('signed in: own cases only', r.verified && r.total === 3 && r.cases.length === 3, JSON.stringify(r).slice(0, 200));
ok('list shows the last four digits only, first names only', r.cases[0].policy === '••••0001' && r.cases[0].withTeam === 'Sasha' && !/SMITH|medical|secret|Someone/.test(JSON.stringify(r)));
let c = route({ ...base, action: 'help868.case', policy: '5000000001' });
ok('case by full number: decision, days, open and closed requirements', c.found && c.daysSinceSubmission === 21 && c.decision === 'Standard' && c.openRequirements === 1 && c.closedRequirements === 1, JSON.stringify(c).slice(0, 300));
ok('requirement carries code, name, status and who acts next', c.requirements[0].code === 'FUTPY' && c.requirements[0].whoActsNext === 'Agent' && c.requirements[0].name === 'Future premium payment');
ok('task facts: open, overdue, who has it, last noted', c.task.openTasks === 1 && c.task.overdue === 1 && c.task.withTeam === 'Sasha' && c.task.lastNoteBy === 'Sasha');
ok('no money, client name or note words anywhere', !/999|555|SMITH|medical|secret/.test(JSON.stringify(c)));
c = route({ ...base, action: 'help868.case', policy: '0002' });
ok('last digits that fit one case find it', c.found && c.policy === '5000000002', JSON.stringify(c).slice(0, 120));
ok('digits that fit two cases ask for more', /2 of this agent/.test(route({ ...base, action: 'help868.case', policy: '0001' }).message));
ok('another agent\'s policy is not found', route({ ...base, action: 'help868.case', policy: '5000000003' }).found === false);
ok('under four digits asks for more', /last four/.test(route({ ...base, action: 'help868.case', policy: '123' }).message));
ok('Salesforce is off by default', c.salesforce === 'off');
const cs0 = route({ ...base, action: 'help868.case', policy: '5000000001' });
ok('stall read without Claude or notes: rules from the report (a future premium is owed)', cs0.stall && cs0.stall.reason === 'waiting_payment' && /premium payment/.test(cs0.stall.headline) && /arrange the premium/i.test(cs0.stall.suggestedNextStep) && /report and the task facts/.test(cs0.stall.basis), JSON.stringify(cs0.stall));

// the session is the number's own and ends with the pilot tab
ok('another number has no session', route({ key: KEY, action: 'help868.case', phone: '8685550102', policy: '5000000001' }).needCode === true);
tabs[0].rows[1][3] = 'No';
ok('switching the agent off ends the session at once', route({ ...base, action: 'help868.case', policy: '5000000001' }).needCode === true);
tabs[0].rows[1][3] = 'Yes';
ok('and switching back on restores it within the session window', route({ ...base, action: 'help868.case', policy: '5000000001' }).found === true);

// Salesforce
const sfIns = [], sfQ = []; const taskIns = () => sfIns.filter(x => x[0] === 'Task');
sfReady = true;
env.tSfQuery_ = q => { sfQ.push(q);
  if (/FROM Task/.test(q)) return [{ Id: '00TPEND', ActivityDate: '2026-10-30', CreatedDate: '2026-10-20T10:00:00.000+0000' }];
  if (/FROM Contact/.test(q)) return [{ Id: '003NEIL', Name: 'Neil Ramnanan' }];
  if (/FROM Policy_Increases__c/.test(q)) return [
    { Policy__c: '6000000009', Policy_Description_Status__c: 'Pending', Submitted_Date__c: '2026-10-01', Days_O_S__c: 32, Policy_Requirements__c: 'Signed form 5551234567 outstanding', Support__c: 'Sasha Lalla', Picked_Up_For_Production__c: 'No', Life_Increase_Premium__c: 888 },
    { Policy__c: '6000000010', Policy_Description_Status__c: 'Pending', Submitted_Date__c: '2026-10-25', Days_O_S__c: null, Policy_Requirements__c: '', Support__c: '', Picked_Up_For_Production__c: '' }];
  if (/FROM CLIENT_PORTFOLIO__c/.test(q)) return [
    { POLICY__c: 'TT 7000000555', RecordType: { Name: 'HEALTH (GROUP)' }, App_Received_Date__c: '2026-10-20' },
    { POLICY__c: 'TT 7000000556', RecordType: { Name: 'LIFE(GROUP)' }, App_Received_Date__c: '2026-10-25' },
    { POLICY__c: 'TT 7000000557', RecordType: { Name: 'HEALTH (GROUP)' }, App_Received_Date__c: '2026-10-27' }];
  return []; };
env.tSfSend_ = (m, path, b) => { const o = path.replace('/sobjects/', ''); sfIns.push([o, b]); return { id: o === 'Task' ? '00TNEW' : '0D5NEW' }; };
ok('switched on only by the property', route({ action: 'help868.ping' }).salesforce === false);
props.setProperty('HELP868_SF', 'on');
ok('ping shows Salesforce logging on', route({ action: 'help868.ping' }).salesforce === true);
c = route({ ...base, action: 'help868.case', policy: '5000000001' });
ok('a case look-up is noted on the open Pendings task', c.salesforce === 'noted on the task' && sfIns.length === 1 && sfIns[0][0] === 'FeedItem' && sfIns[0][1].ParentId === '00TPEND', JSON.stringify(sfIns));
ok('the note names the agent and says no client details were sent', /Neil Ramnanan/.test(sfIns[0][1].Body) && /No client details/.test(sfIns[0][1].Body) && !/FUTPY|Future premium/.test(sfIns[0][1].Body));


// what is holding it up: notes, inbox and report read together, only a reason and a next step come out
const prompts = []; let claudeSays = '{"reason":"waiting_agent","next":"send_requirement"}', claudeCalls = 0;
aiKey = 'sk-test-0123456789';
env.help868Notes_ = id => [
  { at: '2026-11-01T14:00:00.000+0000', day: '2026-11-01', by: 'Sasha Lalla', text: 'Called Mr John Smith on 868-555-9999 (john@x.com): the signed form for 5000000001 is still with the agent, he will bring it Thursday.' },
  { at: '2026-10-28T14:00:00.000+0000', day: '2026-10-28', by: 'Sasha Lalla', text: 'Medical report requested.' }];
env.help868Mailbox_ = () => [{ day: '2026-11-01', gist: 'Re: forms for 5000000001. Agent says the signed form will come in on Thursday. Please confirm receipt' }];
env.gcmClaude_ = (system, user) => { claudeCalls++; prompts.push(system + '\n' + user); return claudeSays; };
c = route({ ...base, action: 'help868.case', policy: '5000000001' });
ok('with notes and an inbox item, Claude\'s reason is used', c.stall.reason === 'waiting_agent' && c.stall.waitingOn === 'the agent' && /bring|Send the outstanding/i.test(c.stall.suggestedNextStep) && /read together/.test(c.stall.basis), JSON.stringify(c.stall));
ok('what Claude was sent has no e-mail, phone, policy number or personal name', prompts.length === 1 && !/john@x|555-9999|5000000001|John Smith|Sasha Lalla|agent@example/.test(prompts[0]) && /\[name\]/.test(prompts[0]), prompts[0] && prompts[0].slice(prompts[0].indexOf('RECORD:'), prompts[0].indexOf('RECORD:') + 700));
ok('the notes\' and e-mail\'s words never come back', !/signed form|Thursday|Medical report|Smith|john|agent@example|Please confirm/.test(JSON.stringify(c)), JSON.stringify(c.stall));
ok('the safe signals count the notes, the e-mail and the quiet days', c.stall.signals.some(s => /2 notes on the task/.test(s)) && c.stall.signals.some(s => /1 related e-mail/.test(s)) && c.stall.daysSinceLastActivity >= 0 && c.stall.signals.some(s => /Last recorded activity \d+ day/.test(s) || /today/.test(s)));
route({ ...base, action: 'help868.case', policy: '5000000001' });
ok('the same evidence is read once, not on every ask', claudeCalls === 1);
cache.removeAll(Object.keys({}));
claudeSays = '{"reason":"the agent is lazy","next":"fire everyone"}';
env.help868Notes_ = id => [{ at: '2026-11-02T14:00:00.000+0000', day: '2026-11-02', by: 'Azariah', text: 'Chased underwriting again.' }];
c = route({ ...base, action: 'help868.case', policy: '5000000001' });
ok('an answer outside the fixed lists is ignored and the rules decide', claudeCalls === 2 && c.stall.reason === 'waiting_payment' && /report and the task facts/.test(c.stall.basis), JSON.stringify(c.stall));
claudeSays = 'not json at all';
env.help868Notes_ = id => [{ at: '2026-11-02T15:00:00.000+0000', day: '2026-11-02', by: 'Azariah', text: 'Another chase.' }];
ok('an unreadable answer falls back to the rules too', route({ ...base, action: 'help868.case', policy: '5000000001' }).stall.reason === 'waiting_payment');
aiKey = '';
env.help868Notes_ = id => []; env.help868Mailbox_ = () => [];
c = route({ ...base, action: 'help868.case', policy: '5000000002' });
ok('no key and an agent-owned requirement: the rules say waiting on the agent, and that nobody is tracking it', c.stall.reason === 'waiting_agent' && c.stall.signals.some(s => /nobody on the team is tracking/.test(s)), JSON.stringify(c.stall));

// increases and groups (Salesforce, for the signed-in agent)
let inc = route({ ...base, action: 'help868.increases' });
ok('increases: those whose status is Pending, with last four digits', inc.found && inc.pending === 2 && inc.increases[0].policy === '••••0009', JSON.stringify(inc).slice(0, 220));
ok('increases: days outstanding from Salesforce, else worked out', inc.increases[0].daysOutstanding === 32 && inc.increases[1].daysOutstanding >= 0 && inc.over30Days === 1);
ok('increases: only the Pending status is read, no second query and no other status', sfQ.filter(q => /Policy_Increases__c/.test(q)).length === 1 && /Policy_Description_Status__c = 'Pending'/.test(sfQ.filter(q => /Policy_Increases__c/.test(q))[0]) && !/Premium Paying|Date_Settled/.test(sfQ.join(' ')) && inc.premiumPayingWithNoSettledDate === undefined);
ok('increases: no amounts, no phone-like numbers in the requirement text', !/888|5551234567/.test(JSON.stringify(inc)) && /\[number removed\]/.test(inc.increases[0].requirement));
ok('increases: supported-by is a first name', inc.increases[0].supportedBy === 'Sasha');
ok('increases are asked of Salesforce by the matched agent only', sfQ.some(q => /Policy_Increases__r\.AGENT__c = '003NEIL'/.test(q)));
let gr = route({ ...base, action: 'help868.groups' });
const byLine = n => gr.byLine.filter(l => l.line === n)[0].pending;
ok('groups: pending only, counted by line in a fixed order', gr.found && gr.pending === 3 && gr.byLine.map(l => l.line).join() === 'Group Life,Group Health,Pension' && byLine('Group Life') === 1 && byLine('Group Health') === 2 && byLine('Pension') === 0, JSON.stringify(gr.byLine));
ok('groups: each pending record by line, last four digits and days since received', gr.cases[0].line === 'Group Health' && gr.cases[0].policy === '••••0555' && gr.cases[0].daysSinceReceived > 0, JSON.stringify(gr.cases[0]));
const gq = sfQ.filter(q => /FROM CLIENT_PORTFOLIO__c/.test(q) && /RecordType/.test(q)).pop();
ok('groups: the one query asks for status Pending only', /Policy_Status_Description__c = 'Pending'/.test(gq) && !/GROUP BY|PREMIUM/i.test(gq), gq);
ok('groups: records, not employers, and no names', /records and not employers/.test(gr.note) && !/Ltd|Limited|Company/.test(JSON.stringify(gr)));
ok('increases and groups need the code too', route({ key: KEY, action: 'help868.increases', phone: '8685550102' }).needCode === true && route({ key: KEY, action: 'help868.groups', phone: '8685550102' }).needCode === true);
sfReady = false;
ok('without Salesforce they say so and show nothing', route({ ...base, action: 'help868.increases' }).found === false && route({ ...base, action: 'help868.groups' }).found === false);
sfReady = true;

// enquiries
let e = route({ ...base, action: 'help868.enquiry', category: 'payment', summary: 'My payment of 1234567 is missing, call 868-555-0000 or pat@example.com http://x.co/a' });
ok('enquiry filed with a reference, marked code-verified', e.ok && /^H8-\d{6}-001$/.test(e.ref) && e.codeVerifiedAgent === true, JSON.stringify(e));
const log = tabs.find(t => t.getName() === 'HELP868 Enquiries');
ok('a Servicing task opens on the agent\'s Contact', e.salesforce === 'task opened' && taskIns()[0] && taskIns()[0][1].WhoId === '003NEIL' && taskIns()[0][1].Task_Type__c === 'Servicing' && taskIns()[0][1].Subject.indexOf(e.ref) > -1, JSON.stringify(taskIns()[0]));
ok('the task and the log carry the cleaned summary', log.rows[1][6] === 'My payment of [number removed] is missing, call [number removed] or [e-mail removed] [link removed]' && taskIns()[0][1].Description.indexOf('[number removed]') > -1 && log.rows[1][10] === '00TNEW', log.rows[1].join('|'));
ok('only the last four of the number is kept', log.rows[1][9] === '·0101' && !JSON.stringify(log.rows).includes('8685550101'));
const mn = mails.length;
ok('owner e-mailed once, with the reference', mails[mn - 1].to === 'boss@example.com' && mails[mn - 1].subject.indexOf(e.ref) > -1);
const again = route({ ...base, action: 'help868.enquiry', category: 'payment', summary: 'My payment of 1234567 is missing, call 868-555-0000 or pat@example.com http://x.co/a' });
ok('same words from the same number are not filed twice', again.repeat && again.ref === e.ref && log.rows.length === 2 && mails.length === mn);
e = route({ key: KEY, action: 'help868.enquiry', phone: '8689990001', name: 'Pat', category: 'nonsense', summary: '=HYPERLINK("x")' });
ok('a stranger: not verified, Other, formula neutralised, numbered 002', /-002$/.test(e.ref) && log.rows[2][2] === 'Other' && log.rows[2][4] === 'Not verified' && log.rows[2][6][0] === "'" && e.codeVerifiedAgent === false, log.rows[2].join('|'));
ok('a stranger\'s enquiry still opens a task, with no Contact attached', taskIns().length === 2 && taskIns()[1][1].WhoId === undefined && taskIns()[1][1].Subject.indexOf(e.ref) > -1);
ok('empty summary refused', route({ key: KEY, action: 'help868.enquiry', phone: '8689990002', summary: '  ' }).ok === false);

// Salesforce failing never loses an enquiry
env.tSfSend_ = () => { throw new Error('boom'); };
e = route({ key: KEY, action: 'help868.enquiry', phone: '8689990004', summary: 'Anything' });
ok('Salesforce failing still files the enquiry', e.ok && e.filed && e.salesforce === 'failed', JSON.stringify(e));

let limited = false; for (let i = 0; i < 45; i++) if (route({ key: KEY, action: 'help868.case', phone: '8689990003' }).limited) limited = true;
ok('one number is rate limited', limited);

const out = route({ action: 'help868.ping' });
ok('ping says what is ready, as true or false, and nothing else about it', out.ok === true && out.on === true && out.agents === 3 && out.pendingReport === true && out.pendingsChase === true && out.salesforceReady === true && out.claudeReady === false && out.mailReady === true && Object.keys(out).sort().join() === 'agents,claudeReady,mailReady,ok,on,pendingReport,pendingsChase,salesforce,salesforceReady', JSON.stringify(out));
aiKey = 'sk-test-0123456789'; ok('claudeReady follows the Anthropic key', route({ action: 'help868.ping' }).claudeReady === true); aiKey = '';
const fs = require('fs'), svc = fs.readFileSync(__dirname + '/../apps-script/Service.gs', 'utf8');
ok('Service.gs routes help868 actions on both GET and POST', (svc.match(/help868Route_\(p\)/g) || []).length === 1 && (svc.match(/help868Route_\(body\)/g) || []).length === 1);
const kpi = fs.readFileSync(__dirname + '/../apps-script/KPI.gs', 'utf8');
ok('the tracker carries no HELP 868 code', !/help868/i.test(kpi));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
