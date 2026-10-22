// The Branch Manager's 5:00 mail: what Claude wrote for each of his tasks (22 October 2026).
//
// Ricky, 6:22am: "I am not seeing any AI writing my tasks in the morning report to me at 5??". The 5:00 run has
// Claude read his tasks and who waits on him (bmdAdvice_ through unitModel_ with ai); the mail now shows, under
// each, Claude's reply or what to do (close it, move it, write a note) and the words, with one button to post them.
// Pinned here: the replies to people asking him come first; his own tasks follow, "keep" left out; the subject says
// how many Claude has written; with no answer from Claude the mail says so; with no key the section is not there.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = env.Utilities.formatDate(new Date(), 'x', 'yyyy-MM-dd');
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  [['ricky@example.com', 'Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
   ['kamla@example.com', 'Kamla Dookran', 'KD001', '1', 'Staff', 'Kamla Dookran', 'Active']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R', active: true } });
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
env.sfkQuery_ = () => [];
env.cmdChatter_ = () => ({});
env.intelFor_ = () => null;
env.inboxScrub_ = () => null;
env.inboxView_ = () => null;
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const W = { mine: [{ id: '00TM1', subject: 'Investment Discussions - Neal Balroop', due: '2026-09-18', late: true }], byOwner: {}, ignored: [],
  ask: [{ id: '00TA1', subject: 'Bond letter for RPM Express', by: 'Kamla Dookran', said: 'Mr Rampersad, can I send the revised bond letter to the client?', at: DAY + 'T09:00:00.000Z' }] };
env.bmWaiting_ = () => W;
const MINE = [{ id: '00TM1', subject: 'Investment Discussions - Neal Balroop', due: '2026-09-18', late: true, ty: 'Opportunity' },
  { id: '00TM2', subject: 'Refund of premium receipt for Tanya', due: '2026-10-15', late: true, ty: 'Servicing' },
  { id: '00TM3', subject: 'Staff appraisal for Liz', due: DAY, late: false, ty: 'Lic/Staffing/SA/HR' }];
let ADV = {};
env.unitModel_ = (sid, day, o) => ({ sid, day, w: W, mine: MINE, adv: o && o.ai ? ADV : {}, urgent: [], inbox: null });
const props = env.PropertiesService.getScriptProperties();
const send = () => { mails.length = 0; props.deleteProperty('bmday_' + DAY); env.sendBranchManagerDay_(DAY); return mails.find(m => /^Your day · Branch Manager/.test(m.subject)); };

props.setProperty('ANTHROPIC_API_KEY', 'k');
ADV = { 'a:00TA1': { act: 'reply', why: 'Approve the revised bond letter?', note: 'Kamla, yes, send the revised bond letter to the client today and copy me.', ai: true },
  '00TM1': { act: 'note', why: 'No note since September', note: 'Where does the Balroop investment discussion stand, and what is the next step and its date?', ai: true },
  '00TM2': { act: 'close', why: 'The receipt went to the client on 16 Oct', note: 'Refund receipt sent to the client on 16 October. Closing.', ai: true },
  '00TM3': { act: 'keep', why: 'In hand', note: '', ai: true } };
let am = send();
ok('the 5:00 mail carries what Claude wrote', !!am && /Claude has written these for you \(3\)/.test(am.htmlBody), am && am.subject);
ok('a reply to the person asking him, with what she said', /Kamla Dookran<\/b> asks you on Bond letter for RPM Express/.test(am.htmlBody) && /can I send the revised bond letter/.test(am.htmlBody) && /Claude&#39;s reply · Approve the revised bond letter\?|Claude's reply · Approve the revised bond letter\?/.test(am.htmlBody) && /Kamla, yes, send the revised bond letter/.test(am.htmlBody));
ok('his own tasks: close it, write a note, with the words', /Claude: Close it · The receipt went to the client on 16 Oct/.test(am.htmlBody) && /Claude: Write a note · No note since September/.test(am.htmlBody) && /Where does the Balroop investment discussion stand/.test(am.htmlBody));
ok('a task in hand is left out', !/Staff appraisal for Liz/.test(am.htmlBody));
ok('people waiting on him come first', am.htmlBody.indexOf('People waiting on your word') > -1 && am.htmlBody.indexOf('People waiting on your word') < am.htmlBody.indexOf('Your own tasks (2)'));
ok('one button to post them, and nothing posts by itself', /Post Claude&#39;s replies|Post Claude's replies/.test(am.htmlBody) && /Nothing is posted/.test(am.htmlBody));
ok('the subject says Claude has written 3', / · Claude has written 3$/.test(am.subject), am.subject);
ok('it sits after Urgent and before the team', am.htmlBody.indexOf('Urgent (') < am.htmlBody.indexOf('Claude has written these') && am.htmlBody.indexOf('Claude has written these') < am.htmlBody.indexOf('The team this morning'));

ADV = {};
am = send();
ok('no answer from Claude: the mail says so', !!am && /Claude did not answer at 5:00/.test(am.htmlBody) && !/Claude has written/.test(am.subject));

props.deleteProperty('ANTHROPIC_API_KEY');
am = send();
ok('no key: no Claude section at all', !!am && !/Claude did not answer/.test(am.htmlBody) && !/Claude has written/.test(am.htmlBody));


console.log('\nBranch Intelligence at full depth (2026-10-22b):\n');
props.setProperty('ANTHROPIC_API_KEY', 'k');
// The record, its neighbours, the whole Chatter and the inbox, as Salesforce and the scrub hold them.
env.sfkQuery_ = q => {
  if (/FROM Task WHERE Id = '00TA1'/.test(q)) return [{ Id: '00TA1', Subject: 'Bond letter for RPM Express', Status: 'In Progress', Priority: 'High', ActivityDate: '2026-10-20', Description: 'Bond renewal for RPM Express Ltd, policy 8000123456', CreatedDate: '2026-10-01T10:00:00.000+0000', WhatId: '001X', What: { Name: 'RPM Express Ltd' }, Who: { Name: 'Christine Ramdass' }, Owner: { Name: 'Kamla Dookran' }, CreatedBy: { Name: 'Ricky Rampersad' } }];
  if (/WhatId = '001X'/.test(q)) return [{ Subject: 'Collect bond premium', ActivityDate: '2026-10-23', Status: 'Not Started', Owner: { Name: 'Pawan Probhu' } }];
  return [];
};
const NOTES = []; for (let i = 0; i < 30; i++) NOTES.push({ day: '2026-10-' + String(1 + (i % 20)).padStart(2, '0'), at: '2026-10-' + String(1 + (i % 20)).padStart(2, '0') + 'T1' + (i % 10) + ':00:00.000Z', by: i % 2 ? 'Kamla Dookran' : 'Ricky Rampersad', text: 'Note number ' + i + ' on the bond.' });
let CHATN = { '00TA1': NOTES.slice(), '00TM1': [{ day: '2026-09-18', at: '2026-09-18T10:00:00.000Z', by: 'Ricky Rampersad', text: 'Meeting set with Neal.' }] };
env.cmdChatter_ = ids => { const o = {}; ids.forEach(id => { if (CHATN[id]) o[id] = CHATN[id]; }); return o; };
env.inboxRows_ = () => [
  { Key: 'm1', Date: DAY, Received: DAY + 'T08:00:00Z', From: 'Christine Ramdass', Subject: 'Bond 8000123456: revised letter?', Gist: 'Client asks whether the revised bond letter is ready.', Ask: 'Send the revised letter', Status: 'open', TaskId: '' },
  { Key: 'm2', Date: DAY, Received: DAY + 'T07:00:00Z', From: 'Someone Else', Subject: 'Unrelated motor quote', Gist: 'Nothing to do with it.', Ask: '', Status: 'open', TaskId: '' }];
let calls = [], answer = null;
env.UrlFetchApp = { fetch: (u, o) => { const body = JSON.parse(o.payload); calls.push(body);
  const ids = [...new Set((body.messages[0].content.match(/"id":"(00T[A-Z0-9]+)"/g) || []).map(x => x.slice(6, -1)))];
  const js = {}; ids.forEach(id => { js[id] = answer ? answer(id) : { read: 'Open 21 days; Kamla asked on ' + DAY + '; the client e-mailed this morning.', reply: 'Kamla, yes: send the revised bond letter to Christine today and copy me. Pawan collects the premium by Fri 23 Oct.', next: 'Kamla sends the letter today', add: ['Check the Log Book for the signed bond form'], action: 'chase' }; });
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(js) }] }) }; } };

const got = env.bmDeepDraft_(DAY, [{ id: '00TA1', k: 'ask', s: 'Bond letter for RPM Express', by: 'Kamla Dookran', said: 'can I send the revised bond letter?' }], 'Say yes and copy me');
const sent = calls[0] && JSON.parse(calls[0].messages[0].content.slice(calls[0].messages[0].content.indexOf('[{')));
ok('the full read: the whole Chatter (25 notes), oldest first', sent && sent[0].history_oldest_first.length === 25 && /Note number 24/.test(sent[0].history_oldest_first[0].text));
ok('the record and the other open tasks on it', sent && sent[0].record && /8000123456/.test(sent[0].record.description) && sent[0].other_open_tasks_on_this_record.length === 1);
ok('the playbook: what to do and when to close', sent && 'what_to_do' in sent[0] && 'when_to_close' in sent[0]);
ok('the inbox: the client\'s e-mail about the same policy, not the unrelated one', sent && sent[0].mail_about_it.length === 1 && /revised letter/.test(sent[0].mail_about_it[0].subject));
ok('his own words lead', sent && sent[0].he_said === 'Say yes and copy me');
ok('on the drafting model', calls[0].model === 'claude-sonnet-5-5', calls[0].model);
ok('it comes back with where it stands, the reply, the next step and what to check', got['00TA1'] && /Open 21 days/.test(got['00TA1'].read) && /Kamla, yes/.test(got['00TA1'].reply) && got['00TA1'].next && got['00TA1'].add.length === 1 && got['00TA1'].mail === 1);

calls = [];
const n1 = env.bmDeepWarm_(DAY, 60000);
ok('4:40: every item of his written and kept (the ask and his own task)', n1 === 2 && Object.keys(env.bmDeepGet_(DAY)).length === 2, String(n1));
ok('in batches', calls.length === 1);
calls = [];
ok('the next hour: nothing new, nothing redrafted', env.bmDeepWarm_(DAY, 60000) === 0 && calls.length === 0);
CHATN['00TM1'] = [{ day: DAY, at: DAY + 'T11:00:00.000Z', by: 'Ricky Rampersad', text: 'Neal wants to meet next week.' }].concat(CHATN['00TM1']);
ok('a new note on a task: that one is drafted again', env.bmDeepWarm_(DAY, 60000) === 1 && calls.length === 1);

am = send();
ok('the 5:00 mail reads it: where it stands, the reply, the next step, what to check', !!am && /Where it stands:<\/b> Open 21 days/.test(am.htmlBody) && /Kamla, yes: send the revised bond letter/.test(am.htmlBody) && /<b>Next:<\/b> Kamla sends the letter today/.test(am.htmlBody) && /Check first:<\/b> Check the Log Book/.test(am.htmlBody));
ok('and says it read the whole Chatter, the record and his inbox', /Branch Intelligence read each task&#39;s whole Chatter|Branch Intelligence read each task's whole Chatter/.test(am.htmlBody) && /and the e-mail in your inbox about it/.test(am.htmlBody) && /Read with 1 e-mail from your inbox/.test(am.htmlBody));
ok('his own task: the action Claude chose', /Claude: Chase/.test(am.htmlBody));
const dr = env.bmDraftsFor_(DAY, [{ id: '00TA1', k: 'ask', s: 'Bond letter for RPM Express' }], true);
ok('the respond page and the 3:00 read the same reply', dr['00TA1'] && /Kamla, yes/.test(dr['00TA1'].note));
const md = env.bmdDrafts_({ day: DAY, w: W, mine: MINE, adv: {} });
ok('My day\'s drafts too', md.some(x => x.id === '00TA1' && /Kamla, yes/.test(x.text)) && md.some(x => x.id === '00TM1' && x.kind === 'own'));

calls = [];
const pg = env.bmDraftOne_('ricky', DAY, { draft: '00TA1', ai_00TA1: 'Say yes, and Pawan collects Friday' });
const html = pg && pg.getContent ? pg.getContent() : String(pg);
const said = calls[0] && JSON.parse(calls[0].messages[0].content.slice(calls[0].messages[0].content.indexOf('[{')))[0].he_said;
ok('Draft with Claude on his page: the full read, built on his words', said === 'Say yes, and Pawan collects Friday' && /Branch Intelligence has written your reply/.test(html) && /Kamla, yes: send the revised bond letter/.test(html));

const ping = env.handle_('ping', {}, '');
ok('the ping says Claude is on (never the key), the models, and how many of his items are written at full depth', ping.has.claude === true && ping.claude && ping.claude.draftModel === 'claude-sonnet-5-5' && ping.claude.fullDepthToday === 2 && !/sk-|"k"/.test(JSON.stringify(ping)), JSON.stringify(ping.claude));

const dow = Number(env.Utilities.formatDate(new Date(), 'x', 'u'));
if (dow <= 5) {
  let warmed = 0; const realWarm = env.bmDeepWarm_; env.bmDeepWarm_ = () => { warmed++; return 3; }; env.runlog_ = () => {};
  props.deleteProperty('bmdeep_' + DAY);
  env.hhmm_ = () => '04:42'; env.housekeepingTick_(); env.housekeepingTick_();
  ok('the tick at 4:40: once, before the 5:00 mail', warmed === 1 && props.getProperty('bmdeep_' + DAY) === '1', String(warmed));
  env.bmDeepWarm_ = realWarm;
} else ok('the tick at 4:40 (weekday only; skipped today)', true);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
