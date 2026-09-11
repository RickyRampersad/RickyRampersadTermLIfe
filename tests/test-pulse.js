// The branch's own message, at two o'clock.
//
// The Branch Manager asked for a daily trigger that sends a WhatsApp to the
// group. Nothing can post to a WhatsApp group — Meta's API sends to numbers
// and has never done groups, and the libraries that do it drive a logged-in
// WhatsApp Web from a server, against the terms, with the branch's own number
// on the line. So the script writes the message and hands it over ready, with
// a link that opens WhatsApp with it typed. The last tap is a person's.
//
// What is tested here is the message, because a message nobody reads is worse
// than no message. The house rules in CLAUDE.md: under about 120 words, one
// finding, the number nobody in the room already knows in the first line, and
// an ask that can be answered in a line. And one rule that is this file's own
// — it names who is IN FRONT and never who is behind. A daily naming of who
// is last in a group chat is read once.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const NOW = new Date('2026-09-10T14:03:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const TODAY = '2026-09-10';

const LOGH = ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status']
  .concat(['KPI1', 'KPI2', 'PM1', 'PM2'].reduce((a, p) => a.concat([p, p + '_Actioned', p + '_Resolved', p + '_Open', p + '_Blocker']), []))
  .concat(['Closed', 'Overdue', 'Aged60', 'ValueAdded', 'Innovation', 'SystemFlags', 'Notes', 'UpdatedAt', 'Revision'])
  .concat(['KPI1_At', 'KPI2_At', 'PM1_At', 'PM2_At'])
  .concat(['KPI1_Quality', 'KPI2_Quality', 'PM1_Quality', 'PM2_Quality'])
  .concat(['MailAM', 'MailPM']);
const logRow = (sid, name, f) => {
  const r = new Array(LOGH.length).fill('');
  Object.keys(f || {}).forEach(h => { r[LOGH.indexOf(h)] = f[h]; });
  r[LOGH.indexOf('Date')] = TODAY; r[LOGH.indexOf('StaffId')] = sid;
  r[LOGH.indexOf('Name')] = name; r[LOGH.indexOf('Status')] = 'Submitted';
  return r;
};

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ada Quill', 'ada', 'ada@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Bram Quill', 'bram', 'bram@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Cleo Quill', 'cleo', 'cleo@example.com', '1', 'Unit Manager', 'Unit', 'Yes']]);
env.__mkSheet('KPI Log', 2, LOGH, [
  logRow('ada', 'Ada Quill', { KPI1: 'Renewa/PDl/Bill', KPI1_Actioned: 12, KPI2: 'Renewa/PDl/Bill', KPI2_Actioned: 9, PM1: 'Renewa/PDl/Bill', PM1_Actioned: 4 }),
  logRow('bram', 'Bram Quill', { KPI1: 'Renewa/PDl/Bill', KPI1_Actioned: 3 })
]);
env.__mkSheet('KPI Training', 3, ['TrainingDate', 'StaffId', 'Trainer', 'Block'], []);
env.__mkSheet('Attendance', 4, ['Date', 'StaffId', 'Name', 'FirstSignIn', 'LastSeen', 'SignedOut',
                                'Status', 'Reason', 'MarkedBy', 'UpdatedAt'],
  [[TODAY, 'ada', 'Ada Quill', '08:01', '13:50', '', 'in', '', 'ada', ''],
   [TODAY, 'bram', 'Bram Quill', '07:52', '13:55', '', 'in', '', 'bram', ''],
   [TODAY, 'cleo', 'Cleo Quill', '08:10', '13:40', '', 'in', '', 'cleo', '']]);

// Salesforce is the authority on the task position; the harness stands in for it.
const sf = (staff) => () => ({ ok: true, staff });
env.sfkMetricsSafe_ = sf({
  ada:  { closed: 31, overdue: 4, aged60: 1, open: 12, noDate: 0 },
  bram: { closed: 12, overdue: 2, aged60: 0, open: 9,  noDate: 0 },
  cleo: { closed: 2,  overdue: 0, aged60: 0, open: 3,  noDate: 0 }
});
const words = t => t.split(/\s+/).filter(Boolean).length;
const paras = t => t.split(/\n\n+/);

console.log('\nIt reads like a message, not a memo:\n');
let t = env.branchPulse();
ok('under the 120 words the house rule allows', words(t) <= 120, words(t) + ' words');
ok('and long enough to be worth sending', words(t) >= 25, words(t) + ' words');
ok('a bold one-line headline, in WhatsApp\'s own asterisks', /^\*[^*\n]+\*$/.test(paras(t)[0]), paras(t)[0]);
ok('three or four short paragraphs, no more', paras(t).length <= 4, String(paras(t).length));
ok('no hard wraps inside a paragraph — WhatsApp reflows and wrapped text arrives ragged',
   paras(t).every(p => p.indexOf('\n') < 0));
ok('nothing is bulleted', !/^\s*[-•*]\s/m.test(t.replace(/^\*[^*\n]+\*$/m, '')));

console.log('\nThe first line is the number nobody in the room has:\n');
ok('the branch total leads it', /^\*Two o.clock — 45 closed so far today\.\*/.test(t), paras(t)[0]);
ok('the person in front is named, first name only', /^Ada is in front with 31/.test(paras(t)[1]), paras(t)[1]);
ok('and the one behind them', /Bram right behind on 12/.test(paras(t)[1]), paras(t)[1]);
ok('nobody\'s surname is in it', !/Quill/.test(t));
ok('and nobody is named for being behind', !/Cleo/.test(t), t);

console.log('\nOne finding, and an ask that follows from it:\n');
ok('the finding is the overdue count', /6 tasks across the branch are overdue/.test(t), paras(t)[2]);
ok('the ask is answerable in a line', /^Reply with one you are clearing before four\.$/.test(paras(t)[3]), paras(t)[3]);
ok('and there is exactly one ask', (t.match(/Reply with/g) || []).length === 1);

console.log('\nThe finding changes with the day, and never names a person for it:\n');
env.sfkMetricsSafe_ = sf({ ada: { closed: 31, overdue: 0, aged60: 7, open: 12, noDate: 0 },
                           bram: { closed: 12, overdue: 0, aged60: 0, open: 9, noDate: 0 },
                           cleo: { closed: 2, overdue: 0, aged60: 0, open: 3, noDate: 0 } });
env.resetRequestMemo_();
let t2 = env.branchPulse();
// Cleo filed nothing at all today, so the silent desk outranks the sixty-day pile.
ok('a desk that has logged nothing outranks an old task', /1 of 3 desks has logged nothing at all yet today/.test(t2), paras(t2)[2]);
ok('it is a count, never a name', !/Cleo/.test(t2), t2);
ok('with its own ask', /Reply when yours is in\./.test(t2));

env.__sheets['KPI Log'].appendRow(logRow('cleo', 'Cleo Quill', { KPI1: 'Reporting', KPI1_Actioned: 2, KPI2: 'Reporting', KPI2_Actioned: 1, PM1: 'Reporting', PM1_Actioned: 1 }));
env.resetRequestMemo_();
let t3 = env.branchPulse();
ok('with every desk in, the sixty-day pile is the finding', /7 tasks have not been touched in sixty days/.test(t3), paras(t3)[2]);

// Nothing overdue, nobody silent, nothing aged — and Bram still has one block
// of four, so the day is not clean yet. "One of us is short" is a count and
// never a name.
env.sfkMetricsSafe_ = sf({ ada: { closed: 31, overdue: 0, aged60: 0, open: 12, noDate: 0 },
                           bram: { closed: 12, overdue: 0, aged60: 0, open: 9, noDate: 0 },
                           cleo: { closed: 2, overdue: 0, aged60: 0, open: 3, noDate: 0 } });
env.resetRequestMemo_();
const tShort = env.branchPulse();
ok('a desk short of three blocks is a finding, and still not a name',
   /One of us is short of three blocks/.test(tShort) && !/Bram is short|Cleo/.test(tShort), paras(tShort)[2]);
env.__sheets['KPI Log']._grid.forEach(r => {
  if (r[LOGH.indexOf('StaffId')] === 'bram') {
    r[LOGH.indexOf('KPI2')] = 'Renewa/PDl/Bill'; r[LOGH.indexOf('KPI2_Actioned')] = 5;
    r[LOGH.indexOf('PM1')] = 'Renewa/PDl/Bill';  r[LOGH.indexOf('PM1_Actioned')] = 2;
  }
});
env.sfkMetricsSafe_ = sf({ ada: { closed: 31, overdue: 0, aged60: 0, open: 12, noDate: 0 },
                           bram: { closed: 12, overdue: 0, aged60: 0, open: 9, noDate: 0 },
                           cleo: { closed: 2, overdue: 0, aged60: 0, open: 3, noDate: 0 } });
env.resetRequestMemo_();
let t4 = env.branchPulse();
ok('and a clean day is said out loud rather than skipped',
   /Every desk has reported and nothing is overdue/.test(t4), paras(t4)[2]);
ok('the clean day still asks for something', /Reply with the one client/.test(t4));
ok('every version of it stays under 120 words',
   [t2, t3, t4].every(x => words(x) <= 120), [t2, t3, t4].map(words).join(', '));

console.log('\nA day with no Salesforce still says something true:\n');
env.sfkMetricsSafe_ = () => ({ ok: false, reason: 'notConfigured' });
env.resetRequestMemo_();
const t5 = env.branchPulse();
ok('it does not invent a closed count', !/closed so far today/.test(t5), paras(t5)[0]);
ok('and falls back to who has reported', /desks have reported so far|is in front/.test(t5), t5);

console.log('\nHanded over ready to send:\n');
env.sfkMetricsSafe_ = sf({ ada: { closed: 31, overdue: 4, aged60: 1, open: 12, noDate: 0 },
                           bram: { closed: 12, overdue: 2, aged60: 0, open: 9, noDate: 0 },
                           cleo: { closed: 2, overdue: 0, aged60: 0, open: 3, noDate: 0 } });
env.resetRequestMemo_();
const sent = [];
env.MailApp.sendEmail = m => sent.push(m);
const said = env.sendBranchPulse();
ok('one mail, to the manager', sent.length === 1 && /ricky@example\.com/.test(sent[0].to), JSON.stringify(sent.map(m => m.to)));
ok('the subject says it is for the group, and how long it is',
   /For the branch group/.test(sent[0].subject) && /\d+ words/.test(sent[0].subject), sent[0].subject);
ok('the message is in the mail to read before sending', sent[0].htmlBody.indexOf('is in front with 31') > -1);
const link = (sent[0].htmlBody.match(/https:\/\/wa\.me\/\?text=[^"]+/) || [''])[0];
ok('with a link that opens WhatsApp with it already typed', link.indexOf('https://wa.me/?text=') === 0);
ok('and the whole message is in that link',
   decodeURIComponent(link.replace('https://wa.me/?text=', '')).indexOf('Ada is in front with 31') > -1);
ok('the mail says plainly that the last tap is a person\'s',
   /no way to let a script post/.test(sent[0].htmlBody));
ok('it reports what it did', /Two o.clock message ready/.test(said), said);

console.log('\nA day nobody opened gets no message:\n');
// The same guard the checkpoint uses: the day's own record, not the calendar.
sent.length = 0;
env.nothingToReport_ = () => true;
const quiet = env.sendBranchPulse({ triggerUid: 'x' });
ok('nothing is sent', sent.length === 0, String(sent.length));
ok('and it says why', /no two o.clock message/.test(quiet), quiet);

console.log('\nThe clock that sends it:\n');
env.installTriggers();
const tr = env.ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction() === 'sendBranchPulse');
ok('one trigger, once a day, at two', tr.length === 1 &&
   tr[0].chain.some(c => c === 'everyDays(1)') && tr[0].chain.some(c => c === 'atHour(14)'),
   JSON.stringify(tr.map(x => x.chain)));
ok('and reinstalling does not double it',
   (env.installTriggers(), env.ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction() === 'sendBranchPulse').length === 1));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
