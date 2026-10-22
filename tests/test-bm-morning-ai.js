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

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
