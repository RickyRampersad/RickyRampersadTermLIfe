// Every RR Operations e-mail goes from support@rickyrampersadbranch.com through Microsoft 365 when the MS_*
// properties are set, and from the script's own account when they are not (18 October 2026).
// Run: node tests/test-rrops-mail.js
const path = require('path');
process.env.GS_PATH = ['DeliveryBook.gs', 'LogBook.gs'].map(f => path.join(__dirname, '..', 'apps-script', f)).join(',');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
function world(props, graphCode, owner, aliases) {
  const env = makeEnv({ props });
  env.__graph = []; env.__mail = []; env.__gmail = [];
  env.GmailApp = { getAliases: () => aliases || [], sendEmail: (to, subj, body, opt) => env.__gmail.push(Object.assign({ to, subject: subj }, opt)) };
  env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 90 };
  env.Session = { getEffectiveUser: () => ({ getEmail: () => owner || 'owner@example.com' }) };
  env.UrlFetchApp = { fetch: (u, o) => {
    if (/oauth2\/v2\.0\/token/.test(u)) return { getResponseCode: () => 200, getContentText: () => '{"access_token":"tok"}' };
    if (/graph\.microsoft\.com/.test(u)) { env.__graph.push({ u, body: JSON.parse(o.payload) }); return { getResponseCode: () => graphCode, getContentText: () => '' }; }
    return { getResponseCode: () => 200, getContentText: () => '{}' };
  } };
  return env;
}
const MS = { MS_TENANT: 't', MS_CLIENT: 'c', MS_SECRET: 's', DB_TEST_INBOX: 'test@example.com' };

let e = world(Object.assign({ DB_MODE: 'live' }, MS), 202);
let r = e.lbMail_({ to: ['agent@example.com'], cc: ['boss@example.com'], subject: 'Log Book: hand in by 12:00', html: '<p>x</p>' });
ok('a Log Book e-mail goes through Microsoft 365', e.__graph.length === 1 && !e.__mail.length, r);
ok('from support@rickyrampersadbranch.com', /users\/support%40rickyrampersadbranch\.com\/sendMail/.test(e.__graph[0].u));
ok('to and copy as asked, saved in Sent Items', e.__graph[0].body.message.toRecipients[0].emailAddress.address === 'agent@example.com' &&
   e.__graph[0].body.message.ccRecipients[0].emailAddress.address === 'boss@example.com' && e.__graph[0].body.saveToSentItems === true);
ok('replies go to sales support', /salessupport/.test(e.__graph[0].body.message.replyTo[0].emailAddress.address));

e = world(MS, 202);   // test mode
r = e.lbMail_({ to: ['agent@example.com'], subject: 'Training result', html: '<p>x</p>' });
ok('test mode: from support@ too, to the test inbox only', e.__graph.length === 1 &&
   e.__graph[0].body.message.toRecipients[0].emailAddress.address === 'test@example.com' && /^\[TEST\]/.test(e.__graph[0].body.message.subject), r);

e = world({ DB_MODE: 'live' }, 202);
r = e.lbMail_({ to: ['agent@example.com'], subject: 'x', html: 'x' });
ok('without the Microsoft 365 sign-in it still goes, from the script\'s account', !e.__graph.length && e.__mail.length === 1, r);

e = world(Object.assign({ DB_MODE: 'live' }, MS), 403);
r = e.lbMail_({ to: ['agent@example.com'], subject: 'x', html: 'x' });
ok('Microsoft refuses: it still goes, from the script\'s account', e.__graph.length === 1 && e.__mail.length === 1, r);

e = world(Object.assign({ DB_MODE: 'live' }, MS), 202);
r = e.lbSupportMail_({ to: ['dept@example.com'], subject: 'Did it arrive?', html: 'x' });
ok('the department check goes from support@ with replies to support@', e.__graph.length === 1 &&
   /support@rickyrampersadbranch\.com/.test(e.__graph[0].body.message.replyTo[0].emailAddress.address), r);

e = world(Object.assign({ DB_MODE: 'live' }, MS), 202);
r = e.dbSendConfirmation_({ ref: 'DB-1', items: [{ document: 'Policy Contract', policy: '9000000001', type: 'LIFE' }], deliveredText: '18 Oct 2026', relationship: 'Self', collector: 'Anika Pretend' },
  { name: 'Anika Pretend', first: 'Anika' }, 'anika@example.com', { name: 'Sam Support' }, false);
ok('the Delivery Book\'s client confirmation goes from support@', e.__graph.length === 1 && !e.__mail.length &&
   e.__graph[0].body.message.toRecipients[0].emailAddress.address === 'anika@example.com', JSON.stringify(r.status));

e = world({ DB_MODE: 'live' }, 202, 'rampersadricky@gmail.com', ['support@rickyrampersadbranch.com']);
r = e.lbMail_({ to: ['agent@example.com'], cc: ['boss@example.com'], subject: 'x', html: 'x' });
ok('no Microsoft 365, support@ a Send-mail-as address in Gmail: it goes from support@', e.__gmail.length === 1 && !e.__mail.length &&
   e.__gmail[0].from === 'support@rickyrampersadbranch.com' && e.__gmail[0].cc === 'boss@example.com', r);
e = world({ DB_MODE: 'live' }, 202, 'support@rickyrampersadbranch.com', []);
r = e.lbMail_({ to: ['agent@example.com'], subject: 'x', html: 'x' });
ok('the script runs as support@ itself: it goes from support@', e.__mail.length === 1 && !e.__gmail.length && /from support@/.test(r), r);
e = world({ DB_MODE: 'live' }, 202, 'rampersadricky@gmail.com', ['ricky@other.com']);
r = e.dbSendConfirmation_({ ref: 'DB-1', items: [{ document: 'Policy Contract', policy: '9', type: 'LIFE' }], deliveredText: 'x', relationship: 'Self', collector: 'A' },
  { name: 'A P', first: 'A' }, 'anika@example.com', { name: 'Sam' }, false);
ok('no support@ anywhere: the client confirmation still goes, as before', e.__mail.length === 1 && !e.__gmail.length, JSON.stringify(r.status));

console.log(fails ? '\n' + fails + ' failed' : '\nall passed');
process.exit(fails ? 1 : 0);
