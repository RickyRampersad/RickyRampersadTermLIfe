// Mail from support@, through the relay (20 October 2026).
//
// Ricky, 3:26pm: "So am I not using the rickyrampersadbranch account as you
// did have a workspace set up". The tracker runs under the personal Gmail
// (about 100 recipients a day) and ran out after 1pm on 19 and 20 October.
//
// Pinned here: with MAIL_RELAY_URL and MAIL_RELAY_KEY set, every e-mail goes to
// the relay (apps-script/MailRelay.gs, under support@) and not through Gmail;
// the relay sends only a request signed with its key, recent, and once; a
// wrong key, a relay that refuses or one that cannot be reached falls back to
// Gmail and is left alone for fifteen minutes; without the two properties
// nothing changes; mailRouteTest, mailQuotaLeft and the ping say which way.
const path = require('path');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const KEY = 'k'.repeat(64);
const env = makeEnv();
env.todayISO_ = () => '2026-10-20';
const relay = (() => { const saved = process.env.GS_PATH; process.env.GS_PATH = path.join(__dirname, '../apps-script/MailRelay.gs');
  const r = makeEnv({ props: { RELAY_KEY: KEY } }); if (saved == null) delete process.env.GS_PATH; else process.env.GS_PATH = saved; return r; })();
const gmail = [], viaRelay = [];
env.MailApp = { sendEmail: m => gmail.push(m), getRemainingDailyQuota: () => 0 };
relay.MailApp = { sendEmail: m => viaRelay.push(m), getRemainingDailyQuota: () => 1399 };
let fetches = 0, down = false;
env.UrlFetchApp = { fetch: (url, o) => {
  fetches++;
  if (down) throw new Error('Address unavailable: ' + url);
  const out = relay.doPost({ postData: { contents: o.payload } });
  return { getResponseCode: () => 200, getContentText: () => out.getContent() };
} };
env.managerEmails_ = () => ['ricky@example.com'];
const P = env.PropertiesService.getScriptProperties();
const msg = { to: 'elizabeth.lee@example.com', cc: 'ricky@example.com,sales@example.com', subject: 'Close-out notice · Elizabeth Lee', htmlBody: '<b>Before you leave</b>', name: 'Ricky Rampersad Branch' };

// Not set up: Gmail, as before.
ok('not set up: Gmail, as before', env.mailSend_(Object.assign({}, msg)) === 'gmail' && gmail.length === 1 && !fetches);
ok('mailRouteTest says what is missing', /not both in Script properties/.test(env.mailRouteTest()));
gmail.length = 0;

// Set up: the relay, from support@.
P.setProperty('MAIL_RELAY_URL', 'https://script.google.com/macros/s/RELAY/exec');
P.setProperty('MAIL_RELAY_KEY', KEY);
ok('set up: through the relay', env.mailSend_(Object.assign({}, msg)) === 'relay' && viaRelay.length === 1 && !gmail.length);
const r0 = viaRelay[0];
ok('the same e-mail: to, copies, subject, body, name', r0.to === msg.to && r0.cc === msg.cc && r0.subject === msg.subject && r0.htmlBody === msg.htmlBody && r0.name === 'Ricky Rampersad Branch');
ok('counted, and the relay\'s allowance noted', P.getProperty('relay_sent_2026-10-20') === '1' && /^1399 at /.test(P.getProperty('relay_left') || ''));
ok('the tracker\'s own e-mails go the same way', (() => { viaRelay.length = 0; env.rateClientPreview(); return viaRelay.length === 2 && !gmail.length; })());
ok('the ping says the relay is set up', env.handle_('ping', {}, '').has.mailRelay === true);
ok('mailRouteTest: through the relay', /Sent through the relay, from support@/.test(env.mailRouteTest()));
ok('mailQuotaLeft shows both', /Gmail recipients left today: 0/.test(env.mailQuotaLeft()) && /Relay \(support@\): \d+ sent today/.test(env.mailQuotaLeft()));

// The relay's own guard.
const signed = (m, t, key) => JSON.stringify({ m, t: String(t), s: env.mailRelaySign_(m + '|' + t, key) });
const ask = body => JSON.parse(relay.doPost({ postData: { contents: body } }).getContent());
viaRelay.length = 0;
const m1 = JSON.stringify({ to: 'x@example.com', subject: 'Hello' });
ok('a wrong key is refused', ask(signed(m1, Date.now(), 'not-the-key')).error === 'bad signature' && !viaRelay.length);
ok('an old request is refused', ask(signed(m1, Date.now() - 11 * 60000, KEY)).error === 'too old' && !viaRelay.length);
const once = signed(m1, Date.now(), KEY);
ok('the same request twice sends once', ask(once).ok && ask(once).duplicate === true && viaRelay.length === 1);
ok('not a relay request', ask('{}').error === 'not a relay request');
ok('opening it in a browser shows it is up, and nothing secret', (() => { const g = JSON.parse(relay.doGet().getContent()); return g.ok && g.ready && !JSON.stringify(g).includes(KEY); })());

// Refused or unreachable: Gmail, and the relay left alone for fifteen minutes.
P.setProperty('MAIL_RELAY_KEY', 'wrong'.repeat(10));
viaRelay.length = 0; gmail.length = 0; fetches = 0;
ok('a relay that refuses: Gmail, nothing lost', env.mailSend_(Object.assign({}, msg)) === 'gmail' && gmail.length === 1 && !viaRelay.length);
ok('the reason is kept', /bad signature \(sent from Gmail instead\)/.test(P.getProperty('MAIL_RELAY_LAST') || ''));
env.mailSend_(Object.assign({}, msg));
ok('and the next e-mail does not wait on it', fetches === 1 && gmail.length === 2);
P.setProperty('MAIL_RELAY_KEY', KEY); env.CacheService.getScriptCache().remove('mail_relay_down'); down = true; gmail.length = 0;
ok('a relay that cannot be reached: Gmail', env.mailSend_(Object.assign({}, msg)) === 'gmail' && gmail.length === 1 && /Address unavailable/.test(P.getProperty('MAIL_RELAY_LAST') || ''));
down = false;
ok('mailRouteTest clears the wait and tries again', /Sent through the relay/.test(env.mailRouteTest()));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
