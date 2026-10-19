// Pawan's day, 19 October 2026: the month's general insurance renewals (are we renewing?), the premium
// collection tasks, and the day ahead from his Salesforce calendar. Made-up clients only.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Pawan Probhu','pawan','pawan@example.com','1','Personal Assistant','Branch','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
const DAY = '2026-10-19';
const risks = [
  // renewed: a newer record for the same policy, spacing different
  { Id: 'r1', Policy__c: 'TT APG 1000001', Account__c: 'ALPHA HH', From__c: '2025-10-05', To__c: '2026-10-05', Total_Premiums_Gov_t_Inclusive__c: 5000, CreatedDate: '2025-10-01T10:00:00Z' },
  { Id: 'r1n', Policy__c: 'TTAPG1000001', Account__c: 'ALPHA HH', From__c: '2026-10-05', To__c: '2027-10-05', Total_Premiums_Gov_t_Inclusive__c: 5200, CreatedDate: '2026-10-03T10:00:00Z' },
  // lapsed: past expiry, not renewed, an open payment task
  { Id: 'r2', Policy__c: 'TT APU 1000002', Account__c: 'BETA HH', From__c: '2025-10-10', To__c: '2026-10-10', Total_Premiums_Gov_t_Inclusive__c: 4000 },
  // untouched: expires in 9 days, no task
  { Id: 'r3', Policy__c: 'TT FHO 1000003', Account__c: 'GAMMA LTD', From__c: '2025-10-28', To__c: '2026-10-28', Total_Premiums_Gov_t_Inclusive__c: 9000 },
  // working: expires later this month, a value adjustment open
  { Id: 'r4', Policy__c: 'TT APC 1000004', Account__c: 'DELTA HH', From__c: '2025-10-30', To__c: '2026-10-30', Total_Premiums_Gov_t_Inclusive__c: 3000 },
  // sold vehicle
  { Id: 'r5', Policy__c: 'TT AOG 1000005', Account__c: 'EPSILON HH', From__c: '2025-10-12', To__c: '2026-10-12', Vehicle_Status__c: 'Sold' },
  // last month: one renewed, one not
  { Id: 'r6', Policy__c: 'TT APG 1000006', Account__c: 'ZETA HH', From__c: '2025-09-20', To__c: '2026-09-20' },
  { Id: 'r6n', Policy__c: 'TT APG 1000006', Account__c: 'ZETA HH', From__c: '2026-09-20', To__c: '2027-09-20', CreatedDate: '2026-09-18T10:00:00Z' },
  { Id: 'r7', Policy__c: 'TT APG 1000007', Account__c: 'ETA HH', From__c: '2025-09-25', To__c: '2026-09-25' }
];
const tasks = [
  { Id: 't1', WhatId: 'r1', Subject: 'Risk to Renew for ALPHA', Status: 'Completed', IsClosed: true, CreatedDate: '2026-09-10T10:00:00Z' },
  { Id: 't2', WhatId: 'r2', Subject: 'Payment follow up TT APU 1000002', Status: 'Waiting on someone else', IsClosed: false, ActivityDate: '2026-10-12', CreatedDate: '2026-10-01T10:00:00Z' },
  { Id: 't4', WhatId: 'r4', Subject: 'Motor Value Adjustment Follow Up Renewal Due', Status: 'Waiting on someone else', IsClosed: false, CreatedDate: '2026-10-13T10:00:00Z' }
];
const coll = [
  { Id: 'p1', Subject: 'Payment to collect TT FCP 1000010', Status: 'Waiting on someone else', IsClosed: false, ActivityDate: '2026-10-16', CreatedDate: '2026-10-13T10:00:00Z', What: { Name: 'OMEGA HH' } },
  { Id: 'p2', Subject: 'Payment follow up PEX1234', Status: 'Waiting on someone else', IsClosed: false, ActivityDate: '2026-10-20', CreatedDate: '2026-09-20T10:00:00Z', What: { Name: 'TRANS-1' } },
  { Id: 'p3', Subject: 'Premium Collection - 1000999 Kim', Status: 'Waiting on someone else', IsClosed: false, ActivityDate: null, CreatedDate: '2026-10-16T10:00:00Z', What: { Name: 'CLIENT-1' } },
  { Id: 'p4', Subject: 'Payment to collect', Status: 'Completed', IsClosed: true, CreatedDate: '2026-10-01T10:00:00Z', CompletedDateTime: '2026-10-05T10:00:00Z' },
  { Id: 'p5', Subject: 'Motor Value Adjustment Follow Up', Status: 'Waiting on someone else', IsClosed: false, CreatedDate: '2026-10-10T10:00:00Z' }
];
env.sfkUsers_ = () => ({ pawan: { id: '005P' } });
env.sfkQuery_ = (q) => {
  if (/FROM Risk_Details__c/.test(q)) return risks;
  if (/FROM Task WHERE WhatId IN/.test(q)) return tasks.filter(t => q.indexOf("'" + t.WhatId + "'") > -1);
  if (/Task_Type__c = 'Renewa\/PDl\/Bill'/.test(q)) return coll;
  return [];
};

console.log('\nAre we renewing?\n');
const book = env.pawanGiBook_(DAY);
const st = (id) => (book.find(x => x.id === id) || {}).state;
ok('a newer record for the same policy is a renewal, spacing aside', st('r1') === 'renewed');
ok('past expiry with no renewal reads as not renewed', st('r2') === 'lapsed');
ok('no task on the record is untouched', st('r3') === 'untouched');
ok('a task on it is being worked', st('r4') === 'working');
ok('a sold vehicle is nothing to renew', st('r5') === 'sold');
ok('the renewal record itself is not counted as due', !book.find(x => x.id === 'r1n'));
const s = env.pawanGiStats_(book, DAY);
ok('October: 5 due, 4 live, 1 renewed, 1 lapsed', s.month.all === 5 && s.month.live === 4 && s.month.renewed === 1 && s.month.lapsed === 1, JSON.stringify(s.month));
ok('the rate counts only those that reached their date: 1 of 2', s.month.rate === 50, String(s.month.rate));
ok('September for comparison: 1 of 2', s.last.rate === 50 && s.last.renewed === 1);
ok('renewal work started 25 days ahead on the one with a task history', book.find(x => x.id === 'r1').lead === 25);
ok('the cold list holds the one expiring in 9 days with no task', s.cold.map(x => x.id).join() === 'r3');

console.log('\nPremium collection:\n');
const c = env.pawanCollections_(DAY);
ok('payments only, the value adjustment left out', c.open.length === 3 && c.otherOpen === 1, JSON.stringify({ n: c.open.length, other: c.otherOpen }));
ok('one past its due date, one with none', c.late === 1 && c.nodue === 1);
ok('closed this month, and the median days', c.closedMonth === 1 && c.median === 4);
ok('open three weeks or more', c.stale === 1);

console.log('\nThe day ahead:\n');
const events = [{ s: 'Collect cheque OMEGA', start: 600, end: 660, where: 'Chaguanas', what: 'OMEGA HH', who: '' }];
const lines = env.pawanDayAhead_(DAY, events, c);
const txt = lines.map(l => l.html).join(' | ');
ok('hours booked against his eight', /1 hours<\/b> of the day to 6pm/.test(txt), txt);
ok('the open stretches of the day', /open from/.test(txt));
ok('a payment due by tomorrow with nothing booked is named', /due by tomorrow with nothing on the calendar/.test(txt) && /PEX1234/.test(txt) && !/1000010/.test(txt.split('nothing on the calendar')[1] || ''), txt);

console.log('\nThe card:\n');
const card = env.pawanGiCard_(DAY, s, c);
ok('renewals, collection and the list to act on', /Are we renewing/.test(card) && /Premium collection/.test(card) && /Renewals to act on/.test(card));
ok('the lapsed one says how long ago', /expired 9d ago, not renewed/.test(card));
ok('the untouched one says no task yet', /no task yet/.test(card));

console.log('\nHis day is flexible:\n');
ok('never late, whenever he plans', env.lateBy_('pawan', '10:45') === 0 && env.attWord_('pawan', '10:45') === 'on time');
const marked = []; env.autoAbsentOn_ = () => true; env.writeAutoAbsent_ = (sid) => { marked.push(sid); return true; };
env.autoAbsentTick_(DAY, 11 * 60, {}, {});
ok('never marked absent by the clock', marked.indexOf('pawan') === -1, JSON.stringify(marked));
ok('his close-out is at 6pm', env.FLEX_CLOSE_AT === 18 * 60 && env.isFlex_('pawan'));

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
