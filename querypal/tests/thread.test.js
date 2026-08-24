/* The trail: thread-finding strategies, reply insight, and the reply we owe.
   Apps Script globals are stubbed; nothing here sends mail. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../QueryPalPatch.gs', 'utf8');

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label +
    (ok ? '' : `\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

// ---- stubs ----------------------------------------------------------------
const sentMail = [], trail = [];
let gmailThrows = false, gmailIndex = {};   // query -> [threads]

const mkMsg = (from, to, date) => ({
  getFrom: () => from, getTo: () => to, getCc: () => '', getDate: () => date });
const mkThread = msgs => ({
  getMessages: () => msgs, getMessageCount: () => msgs.length,
  replyAll: () => { sentMail.push({ kind: 'threaded' }); } });

const ctx = {
  GmailApp: { search: q => { if (gmailThrows) throw new Error('permission'); return gmailIndex[q] || []; } },
  MailApp: { sendEmail: m => sentMail.push(m) },
  Session: { getActiveUser: () => ({ getEmail: () => 'ricky.rampersad@myguardiangroup.com' }) },
  Logger: { log: () => {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) },
  cmtSheet_: () => ({ appendRow: r => trail.push(r) }),
  normName_: s => String(s || '').toLowerCase().replace(/[-.]/g, ' ').replace(/\s+/g, ' ').trim(),
  esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  classifyReply_: text => {
    const t2 = String(text || '').toLowerCase();
    if (/require|need |kindly provide|please provide|outstanding|pending|awaiting|in progress/.test(t2)) return 'blocked';
    if (/completed|processed|resolved|actioned|attached is/.test(t2)) return 'resolved';
    return 'unclear';
  },
  workedDaysSince_: d => Math.floor((Date.now() - d.getTime()) / 86400000),
  // the patch defines the real qpManagerFor_, so feed it the real tables
  AGENT_MANAGER: { 'aidan eugene': 'gary.sookdeo@myguardiangroup.com' },
  DEFAULT_MANAGER: 'ricky.rampersad@myguardiangroup.com',
  AGENT_ACCESS: { 'AE101': ['Aidan Eugene', 'aidan.eugene@myguardiangroup.com'] },
  codeTable_: () => [],
  TEST_MODE: false, TEST_EMAIL: 'rampersadricky@gmail.com',
  BRANCH_SUPPORT: 'support@rickyrampersadbranch.com',
  SHEET_NAME: 'Queries',
};
// only the section-10 helpers are needed; evaluate the whole patch in a sandbox
const vm = require('vm');
const sandbox = vm.createContext(Object.assign({ console }, ctx));
vm.runInContext(src.replace(/^const /gm, 'var '), sandbox);
const G = n => sandbox[n];

const REF = 'RRB/2026/214/Anita Maharaj/Tax statem';
const DEPT = 'gloccustomerservicechaguanassrsc@myguardiangroup.com';

// ---- (a) thread finding ---------------------------------------------------
console.log('\n-- finding the original thread --');
const qs = G('qpThreadQueries_')(REF, 'Anita Maharaj - Tax statement');
t('four search strategies are tried', qs.length, 4);
t('the exact reference is tried first', qs[0].how, 'reference');
t('a loose form drops the slashes', qs[1].q.includes('/'), false);
t('the run number is isolated', qs[2].q.includes('214'), true);
t('subject search is the last resort', qs[3].how, 'subject');

gmailIndex = {};
gmailIndex['"' + REF + '"'] = [mkThread([mkMsg('dept', DEPT, new Date())])];
let r1 = G('qpFindThread_')(REF, DEPT, 'x');
t('exact reference match wins', r1.how, 'reference');
t('and returns a usable thread', !!r1.thread, true);

gmailIndex = {};   // the reported failure: exact search misses
gmailIndex['"RRB 2026 214 Anita Maharaj Tax statem"'] = [mkThread([mkMsg('d', DEPT, new Date())])];
let r2 = G('qpFindThread_')(REF, DEPT, 'x');
t('falls back to the loose reference', r2.how, 'reference-loose');
t('the old single search would have missed this', !!r2.thread, true);

gmailIndex = {};
let r3 = G('qpFindThread_')(REF, DEPT, 'x');
t('a genuine miss is reported, not thrown', r3.how, 'no-thread-found');
t('and no thread comes back', r3.thread, null);

gmailThrows = true;
let r4 = G('qpFindThread_')(REF, DEPT, 'x');
t('an unauthorised Gmail scope is named explicitly', r4.how.startsWith('gmail-not-authorised'), true);
gmailThrows = false;

// ---- (b) reading the department's reply ------------------------------------
console.log('\n-- reading the reply --');
const askDoc = G('qpReadReply_')('Kindly provide the signed authorisation before we can proceed.');
t('a request for a document is spotted', askDoc.asks.length > 0, true);
t('and names the signed instruction', askDoc.asks.join(' ').includes('signed'), true);
t('the branch owes a same-day reply', askDoc.owed, true);
t('with a clear next step', askDoc.action.includes('today'), true);

const done = G('qpReadReply_')('This has been processed and the statement dispatched.');
t('a resolution reads as resolved', done.verdict, 'resolved');
t('a resolution owes no same-day reply', done.owed, false);
t('and tells us to close it', done.action.includes('close'), true);

const cantFind = G('qpReadReply_')('We are unable to locate this policy number.');
t('cannot-locate is surfaced', cantFind.asks.join(' ').includes('cannot find'), true);

const vague = G('qpReadReply_')('Noted.');
t('a bare acknowledgement still owes a reply', vague.owed, true);

const empty = G('qpReadReply_')('');
t('an empty reply is handled', empty.verdict, 'unclear');

trail.length = 0;
const ins = G('qpReplyInsight_')(REF, 'Please provide a valid ID for the client.', 'CS Chaguanas');
t('the insight is written to the trail', trail.length, 1);
t('as an internal note', trail[0][5], 'internal');
t('naming what they need', trail[0][4].includes('What they are asking'), true);
t('and the next step', trail[0][4].includes('Next step'), true);
t('flagged against the right case', trail[0][1], REF);
t('insight returns the reading', ins.owed, true);

// ---- (c) the reply we owe --------------------------------------------------
console.log('\n-- the reply we owe --');
const D = n => new Date(Date.now() - n * 86400000);
const sh = { getRange: () => ({ setValue: () => {} }) };
const mkRow = (desc, repliedDaysAgo) => {
  const row = new Array(29).fill('');
  row[0] = REF; row[5] = 'Anita Maharaj'; row[9] = 'Aidan Eugene';
  row[10] = 'aidan.eugene@myguardiangroup.com'; row[12] = 'Statements – tax and csv';
  row[13] = 'Customer Service – Chaguanas'; row[14] = DEPT; row[17] = 'Tax statement';
  row[18] = desc; row[27] = D(repliedDaysAgo); row[28] = 'Aidan Eugene';
  return row;
};
const threadWith = msgs => { gmailIndex = {}; gmailIndex['"' + REF + '"'] = [mkThread(msgs)]; };

// department replied 2 days ago asking for something, nobody answered
threadWith([mkMsg('CS <' + DEPT + '>', 'us', D(2))]);
sentMail.length = 0; trail.length = 0;
let acted = G('qpOwedSweep_')(sh, 0, mkRow('Please provide a valid ID', 2), new Date());
t('an unanswered department triggers a nudge', acted, true);
t('exactly one email goes out', sentMail.length, 1);
t('addressed to the assigned person', sentMail[0].to, 'aidan.eugene@myguardiangroup.com');
t('subject says we are the holdup', sentMail[0].subject.startsWith('Waiting on us'), true);
t('the body carries the next step', sentMail[0].body.includes('Next step'), true);
t('and it is logged on the trail', trail.length, 1);

// same case, but the branch already answered after the department
threadWith([mkMsg('CS <' + DEPT + '>', 'us', D(2)),
            mkMsg('Ricky Rampersad <ricky.rampersad@myguardiangroup.com>', DEPT, D(1))]);
sentMail.length = 0;
t('no nudge once we have answered',
  G('qpOwedSweep_')(sh, 0, mkRow('Please provide a valid ID', 2), new Date()), false);
t('and nothing is sent', sentMail.length, 0);

// a resolution owes nothing
threadWith([mkMsg('CS <' + DEPT + '>', 'us', D(3))]);
sentMail.length = 0;
t('a resolving reply is never chased',
  G('qpOwedSweep_')(sh, 0, mkRow('This has been processed and dispatched', 3), new Date()), false);

// same day: leave people alone
threadWith([mkMsg('CS <' + DEPT + '>', 'us', new Date())]);
sentMail.length = 0;
t('same-day replies get grace',
  G('qpOwedSweep_')(sh, 0, mkRow('Please provide a valid ID', 0), new Date()), false);

// the cap holds
threadWith([mkMsg('CS <' + DEPT + '>', 'us', D(5))]);
sentMail.length = 0;
t('the nudge cap is respected',
  G('qpOwedSweep_')(sh, 0, mkRow('Please provide a valid ID | owed-nudge:3', 5), new Date()), false);

// day 2+: the manager is copied
threadWith([mkMsg('CS <' + DEPT + '>', 'us', D(2))]);
sentMail.length = 0;
G('qpOwedSweep_')(sh, 0, mkRow('Please provide a valid ID | owed-nudge:1', 2), new Date());
t('the real manager lookup supplies the CC from day two', sentMail[0].cc, 'gary.sookdeo@myguardiangroup.com');

// no thread at all: never nudge on a guess
gmailIndex = {}; sentMail.length = 0;
t('never nudges when the thread cannot be read',
  G('qpOwedSweep_')(sh, 0, mkRow('Please provide a valid ID', 2), new Date()), false);

// a case with no department reply is not our problem yet
threadWith([mkMsg('x', 'y', D(1))]);
const noReply = mkRow('Please provide a valid ID', 2); noReply[27] = '';
t('no department reply means nothing is owed',
  G('qpOwedSweep_')(sh, 0, noReply, new Date()), false);

// markers
t('marker starts at zero', G('qpOwedMarker_')('some description'), 0);
t('marker is read back', G('qpOwedMarker_')('desc | owed-nudge:2'), 2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
