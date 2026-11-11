/* ─────────── Mail Relay: the tracker's e-mail, sent as support@rickyrampersadbranch.com (20 October 2026) ───────────
 *
 *  Ricky, 20 Oct 3:26pm: "So am I not using the rickyrampersadbranch account as you did have a workspace set up".
 *  The KPI tracker runs under the personal Gmail, which may send to about 100 recipients a day; on 19 and 20
 *  October it ran out after 1pm and the close-outs never went. This little project runs under the support@
 *  Google Workspace account (about 1,500 recipients a day). The tracker hands each e-mail to it, signed with a
 *  shared key, and it goes out from support@. Nothing else moves: the tracker still reads Salesforce, the
 *  workbooks and your inbox as before, and if the relay is ever unreachable the tracker falls back to Gmail.
 *
 *  SET UP (once, signed in to Google as support@rickyrampersadbranch.com):
 *   1. script.google.com > New project. Name it "Mail Relay". Replace the code with this file. Save.
 *   2. Pick relayMakeKey in the function box and press Run. Allow it. The log shows a key: copy it.
 *   3. Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy. Copy the URL.
 *   4. In the KPI tracker's project (as the personal Gmail): Project Settings > Script properties >
 *        MAIL_RELAY_URL = the URL from step 3
 *        MAIL_RELAY_KEY = the key from step 2
 *   5. In the KPI project, run mailRouteTest: one test e-mail to you, and the log says which way it went.
 *  The key is a password: it stays in the two projects' Script properties and nowhere else.
 */
var RELAY = { MAX_PER_DAY: 1400, SKEW_MS: 10 * 60 * 1000, NAME: 'Ricky Rampersad Branch',
              FROM: 'support@rickyrampersadbranch.com' };

/* SENDING AS support@ (9 November 2026: "i dont want my name i want to show
   support@rickyrampersadbranch.com"). This project belongs to
   ricky.rampersad@rickyrampersadbranch.com; support@ is the branch's Microsoft
   365 mailbox, not a Google account. Once support@ is added to that Gmail as a
   "Send mail as" address (Gmail > Settings > Accounts), every e-mail goes out
   From: support@, with replies to support@ unless the sender set its own.
   Until the address is added, e-mail still goes, from the account itself, so
   nothing stops. relayCheckFrom says which it is. */
function relayFrom_() {
  try {
    var want = String(RELAY.FROM).toLowerCase();
    var ok = GmailApp.getAliases().some(function (a) { return String(a).toLowerCase() === want; });
    return ok ? RELAY.FROM : '';
  } catch (e) { return ''; }
}

function relaySend_(o) {
  var from = relayFrom_();
  if (!from) { MailApp.sendEmail(o); return 'account'; }
  var opt = { name: o.name, from: from, replyTo: o.replyTo || from };
  ['cc', 'bcc', 'htmlBody', 'attachments'].forEach(function (k) { if (o[k]) opt[k] = o[k]; });
  GmailApp.sendEmail(o.to, o.subject, o.body || ' ', opt);
  return 'support';
}

/** From the editor: which address the relay sends from, and a test e-mail to you. */
function relayCheckFrom() {
  var me = Session.getEffectiveUser().getEmail(), from = relayFrom_();
  var via = relaySend_({ to: me, subject: 'Mail Relay test', name: RELAY.NAME,
    htmlBody: '<p style="font:15px Arial">This test came through the Mail Relay. Look at the From line.</p>' });
  var m = via === 'support' ? 'Sending as ' + RELAY.FROM + '. A test e-mail went to ' + me + '.'
    : 'Sending as ' + me + ': ' + RELAY.FROM + ' is not yet a "Send mail as" address in this account\'s Gmail (Settings > Accounts). A test went to ' + me + '.';
  Logger.log(m); return m;
}

function relayOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function relaySign_(text, key) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(text), String(key))).replace(/=+$/, '');
}
function relayToday_() { return Utilities.formatDate(new Date(), 'America/Port_of_Spain', 'yyyy-MM-dd'); }

/** One e-mail from the tracker: { m: JSON of the message, t: time sent, s: signature of m|t }. */
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties(), key = props.getProperty('RELAY_KEY');
    if (!key) return relayOut_({ ok: false, error: 'RELAY_KEY is not set: run relayMakeKey.' });
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!b.m || !b.t || !b.s) return relayOut_({ ok: false, error: 'not a relay request' });
    if (Math.abs(Date.now() - Number(b.t)) > RELAY.SKEW_MS) return relayOut_({ ok: false, error: 'too old' });
    if (relaySign_(b.m + '|' + b.t, key) !== String(b.s)) return relayOut_({ ok: false, error: 'bad signature' });
    // The same request twice (a retry after a slow answer) sends once.
    var cache = CacheService.getScriptCache(), seen = 'rs_' + String(b.s).slice(0, 60);
    if (cache.get(seen)) return relayOut_({ ok: true, duplicate: true });
    var m = JSON.parse(b.m), dk = 'relay_n_' + relayToday_(), n = Number(props.getProperty(dk) || 0);
    if (n >= RELAY.MAX_PER_DAY) return relayOut_({ ok: false, error: 'the relay\'s own daily cap is reached' });
    if (!m.to || !m.subject) return relayOut_({ ok: false, error: 'no recipient or subject' });
    var o = { to: String(m.to), subject: String(m.subject), name: String(m.name || RELAY.NAME) };
    ['cc', 'bcc', 'replyTo', 'htmlBody', 'body'].forEach(function (k) { if (m[k]) o[k] = String(m[k]); });
    if (!o.body) o.body = ' ';
    /* Attachments travel as {name, type, b64} (11 November 2026: the fact find's PDFs, which until then had to go
       from the sender's own Gmail and its 100-a-day limit). At most ten, 20 MB together. */
    if (m.att && m.att.length) {
      var size = 0;
      o.attachments = m.att.slice(0, 10).map(function (a) {
        var bytes = Utilities.base64Decode(String(a.b64 || '')); size += bytes.length;
        return Utilities.newBlob(bytes, String(a.type || 'application/octet-stream'), String(a.name || 'attachment'));
      });
      if (size > 20 * 1024 * 1024) return relayOut_({ ok: false, error: 'attachments over 20 MB' });
    }
    relaySend_(o);
    cache.put(seen, '1', 1800);
    props.setProperty(dk, String(n + 1));
    var left = null; try { left = MailApp.getRemainingDailyQuota(); } catch (err) {}
    return relayOut_({ ok: true, left: left, att: true });
  } catch (err) {
    return relayOut_({ ok: false, error: String(err && err.message || err).slice(0, 200) });
  }
}

/** Opening the URL in a browser: is it up, and how much is left today. Nothing secret. */
function doGet() {
  var left = null; try { left = MailApp.getRemainingDailyQuota(); } catch (err) {}
  return relayOut_({ ok: true, service: 'Ricky Rampersad Branch mail relay', att: true, ready: !!PropertiesService.getScriptProperties().getProperty('RELAY_KEY'), left: left });
}

/** Run once: makes the key (or shows the one already made) for the tracker's MAIL_RELAY_KEY. */
function relayMakeKey() {
  var props = PropertiesService.getScriptProperties(), k = props.getProperty('RELAY_KEY');
  if (!k) { k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); props.setProperty('RELAY_KEY', k); }
  var who = ''; try { who = Session.getEffectiveUser().getEmail(); } catch (e) {}
  Logger.log('Relay key (copy into the KPI project as MAIL_RELAY_KEY): ' + k + '\nThis relay sends as: ' + who +
    '\nRecipients left today: ' + MailApp.getRemainingDailyQuota());
  return 'Key ready. Copy it from the log.';
}
