/**
 * Transition.gs — sends the transition letters and reports on what comes back.
 *
 * Lives in the Service Questionnaire project beside Service.gs (container-bound
 * to the same spreadsheet), so it shares SVC, SB, ss_(), json_(), the Client
 * Responses tab and the Team Feedback tab.
 *
 * The letters themselves are the generated files on the site
 * (rickyrampersadbranch.com/orphan-transition/letters/<SEG>.html). This file
 * fetches one per segment, fills the {{fields}} from the "Transition Send"
 * tab, cuts out any fact whose field is blank for that client, and sends.
 * One source of truth: rebuild the letters, and the next batch carries the
 * change. No letter text lives here.
 *
 *   transitionSetup()        once — the tab and the 8:00 digest; the hourly send stays off
 *   transitionPreviewToMe()  one of each letter to your own inbox
 *   transitionSendTest()     the rows marked Test = Y, now, whatever the hour
 *   transitionGoLive()       the hourly send, on — once the test rows have been checked
 *   transitionPause()        the hourly send, off; the test rows still go by hand
 *   transitionSendBatch()    what the hourly trigger runs; safe to run by hand
 *   transitionDigest()       the morning e-mail; safe to run by hand
 *
 * The Transition Send tab is built outside the repository from the Branch
 * Portfolio sheet (tools/letters has no client data). One row per client:
 * a token, the letter, the merge fields, and — filled in before anything is
 * looked at — the exclusions: the departed agents' own policies and their
 * households, staff addresses, death claims. A row with anything in Exclude
 * never sends.
 *
 * Nothing goes to a client on its own until transitionGoLive has been run:
 * the list can sit in the tab, the preview and the two Test rows can be read
 * and checked, and the hourly run sends nothing. A row with no Send on date
 * is held, not sent now; a row the sender cannot use (no e-mail, no first
 * name, no letter for its segment) is moved to Exclude with the reason, so
 * it leaves the queue for someone to fix rather than being tried every hour.
 *
 * Every e-mail a client receives from here — the letter, the receipt when they
 * tap, the "still on it" note — goes out through Microsoft 365 as MS_FROM,
 * with CC on each. The sign-in is three Script properties (MS_TENANT,
 * MS_CLIENT, MS_SECRET), never this file, which is public on the website.
 * Until they are set nothing client-facing sends at all: there is no fallback
 * to the Google account that owns the script.
 */
var TRANSITION = {
  SHEET: 'Transition Send',
  LETTERS: 'https://rickyrampersadbranch.com/orphan-transition/letters/',
  FILM: 'https://rickyrampersadbranch.com/your-policy/',
  FROM_NAME: 'Ricky Rampersad Branch',
  MS_FROM: 'support@rickyrampersadbranch.com',   // every client e-mail is sent as this mailbox
  CC: ['rickyrampersadsalessupport@myguardiangroup.com', 'Ricky.Rampersad@myguardiangroup.com'],   // visible on every client e-mail
  REPLY_TO: '',              // blank = MS_FROM. "Just reply" lands here.
  BCC: [],                   // a hidden copy of every client e-mail, if wanted
  BATCH: 60,                 // the most one hourly run will send
  HOURS: [9, 17],            // sends only between these hours, script time zone
  WEEKDAYS: [1, 2, 3, 4, 5], // Monday = 1
  ORDER: ['I', 'K', 'J', 'A', 'R', 'F', 'G'],   // the action letters first; F1…F5 sort as F, R1 and R2 as R
  DIGEST_TO: '',             // blank = the script owner
  DIGEST_HOURS: [8, 12],     // the digest fires this many times a day, sheet time zone
  COPY_TO: '',               // blank = SVC.AGENT_EMAIL. Where the internal "late" nudges go.
  WAIT_DAYS: 2,              // a tap older than this, still unassigned, is late
  WAIT_URGENT: 1,            // the urgent tap promises an agent by the next working day
  CHASE_MULT: 2,             // a tap still open at WAIT × this gets a second, client-facing chase
  CHASE_MAX_PER_RUN: 40,     // the most one chase run will act on, whatever the backlog — see tChase_
};

/* The switch the hourly send is behind. transitionGoLive sets it, transitionPause
   clears it; until it is set the trigger runs and sends nothing. */
var T_LIVE = 'transition_live';

var T_HEADERS = ['Token', 'Segment', 'First name', 'Email', 'Agent first name', 'Client', 'Agent',
  'Client number', 'first_year', 'years', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date', 'Exclude', 'Reason', 'Test', 'Send on',
  'Sent at', 'Status'];
/* the merge fields a letter may carry, and the ones that sit in the facts strip */
var T_FIELDS = ['first_year', 'years', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date'];
var T_FACTS = ['first_year', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date'];
/* the columns a send depends on: read, checked or written on every row. Headers
   are matched on their exact text, so a tab imported with 'Excluded' or 'exclude'
   would make every held-back row due — tRead_ refuses to run without them. */
var T_REQUIRED = ['Token', 'Segment', 'First name', 'Email', 'Agent first name', 'Exclude', 'Test',
  'Send on', 'Sent at', 'Status'];

/* ── the tab ──────────────────────────────────────────────────────── */
function tSheet_() {
  var sh = ss_().getSheetByName(TRANSITION.SHEET);
  if (!sh) {
    sh = ss_().insertSheet(TRANSITION.SHEET);
    sh.appendRow(T_HEADERS);
    sh.setFrozenRows(1);
    try { sh.getRange(1, 1, 1, T_HEADERS.length).setFontWeight('bold').setBackground(SB.light); } catch (e) {}
  }
  return sh;
}

/** Every row as an object keyed by the header text, plus _row (1-based).
 *  Throws, before anything is sent, if the header row is missing or any of
 *  T_REQUIRED is not on it. */
function tRead_() {
  var sh = tSheet_();
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (!lastCol) throw new Error('"' + TRANSITION.SHEET + '" has no header row. Nothing was sent.');
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var col = {};
  head.forEach(function (h, i) { if (h) col[h] = i + 1; });
  var missing = T_REQUIRED.filter(function (h) { return !col[h]; });
  if (missing.length) throw new Error('"' + TRANSITION.SHEET + '" is missing: ' + missing.join(', ') + '. Nothing was sent.');
  var rows = [];
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, lastCol).getValues().forEach(function (v, i) {
      var o = { _row: i + 2 };
      head.forEach(function (h, j) { if (h) o[h] = v[j]; });
      rows.push(o);
    });
  }
  return { sh: sh, col: col, rows: rows };
}

/* The sheet's own zone: its dates are midnight there, and the branch reads the
   clock there. The script project's zone is whatever it was created with. */
function tTz_() {
  try { var z = ss_().getSpreadsheetTimeZone(); if (z) return z; } catch (e) {}
  return Session.getScriptTimeZone() || 'America/Port_of_Spain';
}

/** A cell as the letter should print it: dates long, numbers whole, else trimmed text. */
function tText_(x) {
  if (x === null || x === undefined) return '';
  if (x instanceof Date) return isNaN(x.getTime()) ? '' : Utilities.formatDate(x, tTz_(), 'd MMMM yyyy');
  if (typeof x === 'number') return String(Math.round(x));
  var s = String(x).trim();
  return /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|ERROR!)$/.test(s) ? '' : s;   // a lookup that missed is a blank, not a fact
}
/* The two hand-edited flags. A tick in a checkbox column reads true, a typed
   Y or yes reads as text; a cleared checkbox reads false and must not hold. */
function tYes_(x) { return x === true || /^(y|yes|true|1|x)$/i.test(tText_(x)); }
function tHeld_(x) { if (x === false) return false; var s = tText_(x); return !!s && !/^(false|no|n|0)$/i.test(s); }
/** "Send on" as yyyy-MM-dd for comparing with today. '' for an empty cell;
 *  null for anything that cannot be read (29/9, 'Monday', 'hold') — the one
 *  column the branch edits by hand to delay a letter must fail towards holding
 *  it, never towards sending it this hour. */
function tDay_(x) {
  if (x === null || x === undefined || x === '') return '';
  if (x instanceof Date) return isNaN(x.getTime()) ? null : Utilities.formatDate(x, tTz_(), 'yyyy-MM-dd');
  var s = String(x).trim();
  if (!s) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/* ── setup ────────────────────────────────────────────────────────── */
/** Safe to run again: the digest triggers are always torn down and rebuilt
 *  from TRANSITION.DIGEST_HOURS, so changing the hours (or adding one) just
 *  means running this once more — nothing accumulates. */
function transitionSetup() {
  tSheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'transitionDigest') ScriptApp.deleteTrigger(t);
  });
  TRANSITION.DIGEST_HOURS.forEach(function (h) {
    ScriptApp.newTrigger('transitionDigest').timeBased().inTimezone(tTz_()).atHour(h).everyDays(1).create();
  });
  var msg = '"' + TRANSITION.SHEET + '" is ready and the digest is installed for ' +
    TRANSITION.DIGEST_HOURS.map(function (h) { return h + ':00'; }).join(' and ') +
    '. The hourly send stays off until Transition: go live. Import the send list into the tab, run ' +
    'transitionPreviewToMe, then transitionSendTest, read what arrived and check the Exclude column, then go live.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/** The hourly send, on. Only after the preview and the Test rows have been
 *  read and the Exclude column checked: from the next weekday hour inside
 *  HOURS the trigger sends up to BATCH real letters a run. */
function transitionGoLive() {
  PropertiesService.getScriptProperties().setProperty(T_LIVE, 'yes');
  var have = {};
  ScriptApp.getProjectTriggers().forEach(function (t) { have[t.getHandlerFunction()] = true; });
  if (!have.transitionSendBatch) ScriptApp.newTrigger('transitionSendBatch').timeBased().everyHours(1).create();
  var msg = 'Live. The hourly send is on, ' + TRANSITION.HOURS[0] + ':00 to ' + TRANSITION.HOURS[1] +
    ':00, Monday to Friday. Transition: pause turns it off.';
  log_('transition', 'live', msg);
  return tSay_(msg);
}

/** The hourly send, off: the switch cleared and the trigger removed. The Test
 *  rows still send by hand. */
function transitionPause() {
  PropertiesService.getScriptProperties().deleteProperty(T_LIVE);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'transitionSendBatch') ScriptApp.deleteTrigger(t);
  });
  var msg = 'Paused. Test rows still send by hand; the hourly run sends nothing.';
  log_('transition', 'paused', msg);
  return tSay_(msg);
}

/** Whether the hourly send is on — the switch set and the trigger installed —
 *  reported the way automationOn_() is, so the page and the digest can say so
 *  instead of the branch learning it from silence. */
function tArmed_() {
  try {
    if (PropertiesService.getScriptProperties().getProperty(T_LIVE) !== 'yes') return false;
    return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'transitionSendBatch'; });
  } catch (e) { return false; }
}

/** Say it on screen when there is a screen (the menu); the return value carries
 *  it when there is not (a trigger). */
function tSay_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/* ── the letter ───────────────────────────────────────────────────── */
function tFetch_(path) {
  var cache = CacheService.getScriptCache();
  var key = 'transition:' + path;
  var hit = cache.get(key);
  if (hit) return hit;
  var res = UrlFetchApp.fetch(TRANSITION.LETTERS + path, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not fetch ' + path + ' (HTTP ' + res.getResponseCode() + ')');
  var txt = res.getContentText();
  try { cache.put(key, txt, 600); } catch (e) {}
  return txt;
}

/** Every letter in the manifest, keyed by segment, fetched once before a run.
 *  Throws when the site does not answer, or when a letter on it carries
 *  {{fields}} but no fact markers — the previous cut, which prints 'Paid to'
 *  over a blank — so the caller stops before it touches a row. */
function tLetters_() {
  var man = JSON.parse(tFetch_('manifest.json'));
  var out = {};
  (man.letters || []).forEach(function (L) {
    var seg = String(L.segment).toUpperCase();
    var html = tFetch_(L.file);
    if (new RegExp('\\{\\{(' + T_FACTS.join('|') + ')\\}\\}').test(html) && !/<!--fact:/.test(html)) {
      throw new Error('Letter ' + seg + ' on the site carries no fact markers: merge and rebuild before sending');
    }
    if (/\{\{agent_first_name\}\}/.test(html) && !/<!--agent-->/.test(html)) {
      throw new Error('Letter ' + seg + ' on the site carries no agent markers: merge and rebuild before sending');
    }
    out[seg] = { segment: seg, subject: L.subject, html: html };
  });
  if (!Object.keys(out).length) throw new Error('The manifest on the site lists no letters');
  return out;
}

function tEsc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Fill one letter (or its subject) for one row. A fact whose field is blank
 *  is cut out between its markers; the strip goes when its last fact does. */
function tFill_(text, row) {
  var v = function (k) { return tText_(row[k]); };
  var out = text;
  T_FACTS.forEach(function (k) {
    if (!v(k)) out = out.replace(new RegExp('<!--fact:' + k + '-->[\\s\\S]*?<!--/fact-->', 'g'), '');
  });
  out = out.replace(/<!--facts-->([\s\S]*?)<!--\/facts-->/g, function (m, inner) {
    return /<!--fact:/.test(inner) ? m : '';
  });
  /* no agent first name on the row: "Your representative has moved on" still reads */
  if (!v('Agent first name')) out = out.replace(/<!--agent-->[\s\S]*?<!--\/agent-->/g, '');
  var map = {
    first_name: v('First name'),          // blank never reaches here: tHold_ keeps the row back
    agent_first_name: v('Agent first name'),
    token: v('Token'),
    segment: v('Segment').toUpperCase(),
  };
  T_FIELDS.forEach(function (k) { map[k] = v(k); });
  return out.replace(/\{\{(\w+)\}\}/g, function (m, k) {
    return map.hasOwnProperty(k) ? tEsc_(map[k]) : m;
  });
}

/** Why a row cannot go, or '' when it can. The same test keeps a row out of
 *  the batch's queue and out of the send itself, so a held row never takes a
 *  slot from one that can send. 'Dear Client' is not a letter this branch
 *  sends, and a blank first name is the usual sign of shifted columns. */
function tHold_(row, letters) {
  var seg = tText_(row.Segment).toUpperCase();
  if (!seg) return 'no letter';
  if (!letters[seg]) return 'no letter for segment ' + seg;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tText_(row.Email))) return 'no e-mail';
  if (!tText_(row['First name'])) return 'no first name';
  return '';
}

/* ── the sender: Microsoft 365, as MS_FROM ────────────────────────── */
/* Why not MailApp: it can only send from the Google account that owns the
   script — a personal gmail.com address on a letter from the branch — and it
   allows that account about a hundred recipients a day, every CC counted, so
   a letter with two copies would go out at some twenty-five a day. Microsoft
   365 sends as the branch's own mailbox, keeps each letter in its Sent Items,
   and allows thousands a day at up to thirty a minute. Decided 23 September. */
var T_MS_MISSING = 'Microsoft 365 sending is not set up: add MS_TENANT, MS_CLIENT and MS_SECRET ' +
  'under Project Settings → Script properties. Nothing was sent.';

function tMsCreds_() {
  var p = PropertiesService.getScriptProperties();
  var c = { tenant: p.getProperty('MS_TENANT'), client: p.getProperty('MS_CLIENT'), secret: p.getProperty('MS_SECRET') };
  return (c.tenant && c.client && c.secret) ? c : null;
}

/** An app-only token for Microsoft Graph, cached for most of its hour.
 *  Throws with Microsoft's own reason when the sign-in is refused. */
function tMsToken_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('transition:ms-token');
  if (hit) return hit;
  var c = tMsCreds_();
  if (!c) throw new Error(T_MS_MISSING);
  var res = UrlFetchApp.fetch('https://login.microsoftonline.com/' + encodeURIComponent(c.tenant) + '/oauth2/v2.0/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { client_id: c.client, client_secret: c.secret, grant_type: 'client_credentials',
               scope: 'https://graph.microsoft.com/.default' },
  });
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !body.access_token) {
    var why = String(body.error_description || body.error || ('HTTP ' + res.getResponseCode())).split('\n')[0];
    throw new Error('Microsoft 365 refused the sign-in: ' + why.slice(0, 200));
  }
  try { cache.put('transition:ms-token', body.access_token, Math.max(60, Math.min(3000, (body.expires_in || 3600) - 300))); } catch (e) {}
  return body.access_token;
}

function tAddr_(list) {
  return (list || []).filter(function (a) { return String(a || '').trim(); })
    .map(function (a) { return { emailAddress: { address: String(a).trim() } }; });
}

/** What every client e-mail carries besides its own body. */
function tClientOpts_() {
  return { cc: TRANSITION.CC, bcc: TRANSITION.BCC, replyTo: TRANSITION.REPLY_TO || TRANSITION.MS_FROM };
}

/** One e-mail, sent as MS_FROM and kept in its Sent Items. Throws with
 *  Microsoft's reason on anything but "accepted". */
function tMsSend_(to, subject, html, o) {
  o = o || {};
  var msg = {
    subject: subject,
    body: { contentType: 'HTML', content: html },
    from: { emailAddress: { name: TRANSITION.FROM_NAME, address: TRANSITION.MS_FROM } },
    toRecipients: tAddr_([to]),
  };
  if (o.cc && o.cc.length) msg.ccRecipients = tAddr_(o.cc);
  if (o.bcc && o.bcc.length) msg.bccRecipients = tAddr_(o.bcc);
  if (o.replyTo) msg.replyTo = tAddr_([o.replyTo]);
  var res = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(TRANSITION.MS_FROM) + '/sendMail', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + tMsToken_() },
    payload: JSON.stringify({ message: msg, saveToSentItems: true }),
  });
  var code = res.getResponseCode();
  if (code === 202) return;
  if (code === 401) { try { CacheService.getScriptCache().remove('transition:ms-token'); } catch (e) {} }
  var why = 'HTTP ' + code;
  try { var err = JSON.parse(res.getContentText()).error; if (err) why = (err.code ? err.code + ': ' : '') + (err.message || ''); } catch (e) {}
  throw new Error('Microsoft 365 did not send: ' + why.slice(0, 200));
}

/** Send one row with the letters tLetters_ fetched. Returns 'sent', or the
 *  reason it did not. Throws on a mail failure. */
function tSendRow_(row, letters) {
  var why = tHold_(row, letters);
  if (why) return why;
  var seg = tText_(row.Segment).toUpperCase();
  var L = letters[seg];
  var subject = tFill_(L.subject, row).replace(/<[^>]+>/g, '');
  tMsSend_(tText_(row.Email), subject, tFill_(L.html, row), tClientOpts_());
  return 'sent';
}

/** Token for a row that came in without one, written back before the send. */
function tEnsureToken_(t, row) {
  if (tText_(row.Token)) return;
  var tok = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  t.sh.getRange(row._row, t.col.Token).setValue(tok);
  row.Token = tok;
}

/* The columns are checked by tRead_ before any of this runs, so a write that
   fails here throws and stops the run — it never skips quietly and lets the
   same rows send again next hour. */
function tMark_(t, row, status, sent) {
  if (sent) t.sh.getRange(row._row, t.col['Sent at']).setValue(new Date());
  t.sh.getRange(row._row, t.col.Status).setValue(status);
}

/** A row the sender cannot use leaves the queue: the reason goes into Exclude,
 *  where tSummary_ counts it under 'held back', and into Status. Clearing the
 *  Exclude cell after the fix puts the row back. */
function tHoldRow_(t, row, why) {
  tMark_(t, row, why, false);
  t.sh.getRange(row._row, t.col.Exclude).setValue(why);
  row.Exclude = why;
}

/** Send these rows with these letters. The letters were fetched before this
 *  was called, outside any per-row try, so a site that does not answer stops
 *  the run instead of marking sixty rows 'error' and pushing them all to
 *  tomorrow. Only a mail failure is retried tomorrow. */
function tSendRows_(t, rows, letters) {
  var sent = 0, skipped = 0, failed = 0;
  rows.forEach(function (row) {
    try {
      tEnsureToken_(t, row);
      var res = tSendRow_(row, letters);
      if (res === 'sent') { sent++; tMark_(t, row, 'sent', true); }
      else { skipped++; tHoldRow_(t, row, res); }
    } catch (err) {
      var why = String(err && err.message ? err.message : err);
      if (/invalid email|InvalidRecipients/i.test(why)) {
        /* the address passed the shape test and the mail server still refused it: for the manager, not for tomorrow */
        skipped++; tHoldRow_(t, row, 'no e-mail: ' + why.slice(0, 100));
      } else {
        failed++;
        tMark_(t, row, 'error: ' + why.slice(0, 120), false);
        /* try again tomorrow, not every hour */
        var tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        t.sh.getRange(row._row, t.col['Send on']).setValue(Utilities.formatDate(tmr, tTz_(), 'yyyy-MM-dd'));
      }
    }
    Utilities.sleep(2100);   // Microsoft 365 takes thirty a minute from one mailbox
  });
  return { sent: sent, skipped: skipped, failed: failed };
}

function tOrder_(row) {
  var seg = tText_(row.Segment).toUpperCase();
  var i = TRANSITION.ORDER.indexOf(seg);
  if (i < 0) i = TRANSITION.ORDER.indexOf(seg.charAt(0));   // a letter with versions sorts with its family
  return i < 0 ? 99 : i;
}

/* ── the client responds: a receipt, a copy, and a chase until it is closed ── */

/** The Transition Send row for a token, or null. Does not require the
 *  columns a send needs — only Token — so a malformed tab never stops a
 *  client's tap from being answered. Never throws. */
function tRowByToken_(token) {
  token = String(token || '').trim();
  if (!token) return null;
  try {
    var sh = ss_().getSheetByName(TRANSITION.SHEET);
    var last = sh ? sh.getLastRow() : 0, lastCol = sh ? sh.getLastColumn() : 0;
    if (last < 2 || !lastCol) return null;
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var tokCol = head.indexOf('Token');
    if (tokCol < 0) return null;
    var vals = sh.getRange(2, 1, last - 1, lastCol).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][tokCol] || '').trim() === token) {
        var o = { _row: i + 2 };
        head.forEach(function (h, j) { if (h) o[h] = vals[i][j]; });
        return o;
      }
    }
  } catch (e) {}
  return null;
}

/** The navy strip every client e-mail carries, so a short receipt still
 *  reads as the same branch that sent the letter. */
function tHead_() {
  return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#07131f;' +
    'padding:12px 18px;border-bottom:3px solid #efc24b"><tr><td style="width:26px;padding-right:9px">' +
    '<img src="https://rickyrampersadbranch.com/logo-mark.png" width="26" height="26" alt="" style="display:block;border-radius:6px"></td>' +
    '<td style="font:800 13px \'Plus Jakarta Sans\',Arial,sans-serif;color:#eaf4ff">Ricky Rampersad Branch</td></tr></table>';
}

/** A receipt e-mailed the moment a client answers a letter, separate from
 *  the on-screen thank-you — so it is also in their inbox, and CC'd to the
 *  branch so a response is seen the moment it lands, not only in the
 *  digest. "Are responses coming in, and I am to be copied" — 22 September.
 *  Only for a token this campaign recognises (a Transition Send row with an
 *  e-mail); any other flow's token is untouched. Never blocks the click. */
function tAckClient_(token, r, needs) {
  try {
    var row = tRowByToken_(token);
    if (!row) return;
    var to = tText_(row.Email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return;
    var first = tText_(row['First name']) || 'there';
    var html = '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:520px">' + tHead_() +
      '<div style="padding:18px 4px 0"><p style="margin:0 0 12px">Dear ' + tEsc_(first) + ',</p>' +
      '<p style="margin:0 0 12px">Thank you for answering. Here is what happens next: <b>' + tEsc_(needs) + '</b>.</p>' +
      '<p style="margin:0 0 12px">If anything changes in the meantime, just reply to this e-mail — it reaches a person the same day.</p>' +
      '<p style="margin:16px 0 0"><b style="display:block">Ricky Rampersad</b>Branch Manager, Ricky Rampersad Branch<br>Guardian Life of the Caribbean</p></div></div>';
    if (!tMsCreds_()) { log_('transition', 'ack-held', 'no receipt for a "' + r + '" tap: ' + T_MS_MISSING); return; }
    tMsSend_(to, 'Thank you — we have this', html, tClientOpts_());
    log_('transition', 'ack', tText_(row.Client || row['First name']) + ' · ' + r);
  } catch (e) { log_('transition', 'ack-failed', String(e && e.message ? e.message : e)); }
}

/** Every Transition Send row, read once and keyed by token — so a loop over
 *  Client Responses never re-reads the whole tab per row. Used only by
 *  tChase_; tAckClient_ still calls tRowByToken_ directly, since that fires
 *  once per click, not once per row of a scan. */
function tTokenMap_() {
  var map = {};
  try {
    var sh = ss_().getSheetByName(TRANSITION.SHEET);
    var last = sh ? sh.getLastRow() : 0, lastCol = sh ? sh.getLastColumn() : 0;
    if (last < 2 || !lastCol) return map;
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var tokCol = head.indexOf('Token');
    if (tokCol < 0) return map;
    var vals = sh.getRange(2, 1, last - 1, lastCol).getValues();
    for (var i = 0; i < vals.length; i++) {
      var tok = String(vals[i][tokCol] || '').trim();
      if (!tok) continue;
      var o = { _row: i + 2 };
      head.forEach(function (h, j) { if (h) o[h] = vals[i][j]; });
      map[tok] = o;
    }
  } catch (e) {}
  return map;
}

/** An internal nudge, to the branch (never to the client): what is late, who
 *  it was with, and what it needs. `level` 2 is the second, plainer chase.
 *  Takes the row already looked up — never looks it up itself. */
function tChaseInternal_(row, r, needs, days, level) {
  row = row || {};
  var who = tText_(row.Client) || tText_(row['First name']) || 'a client';
  var to = TRANSITION.COPY_TO || SVC.AGENT_EMAIL;
  var subj = (level >= 2 ? 'Still late: ' : 'Late: ') + who + ' — ' + r + ', ' + days + ' working days';
  var body = who + ' tapped "' + r + '" ' + days + ' working days ago and is still marked Open.\n\n' +
    'Needs: ' + needs + '\n' + (row.Agent ? 'Was with: ' + tText_(row.Agent) + '\n' : '') +
    (row.Segment ? 'Letter: ' + tText_(row.Segment) + '\n' : '') +
    '\nAssign it on the Client Responses tab, or type anything other than "Open" into Status once it is resolved.\n' +
    'https://rickyrampersadbranch.com/orphan-transition/responses.html';
  try { MailApp.sendEmail(to, subj, body, { name: TRANSITION.FROM_NAME }); } catch (e) {}
}

/** The client's own "still on it" note — only the second time, and only
 *  once, so it reassures rather than nags. Warm, not defensive. Takes the
 *  row already looked up; a null row (should not happen, tChase_ filters
 *  it out first) is simply skipped. */
function tChaseClient_(row, needs) {
  if (!row) return;
  var to = tText_(row.Email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return;
  var first = tText_(row['First name']) || 'there';
  var html = '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:520px">' + tHead_() +
    '<div style="padding:18px 4px 0"><p style="margin:0 0 12px">Dear ' + tEsc_(first) + ',</p>' +
    '<p style="margin:0 0 12px">You have not been forgotten. We are still on: <b>' + tEsc_(needs) + '</b>. We will ask again rather than assume, and you are welcome to reply here at any time.</p>' +
    '<p style="margin:16px 0 0"><b style="display:block">Ricky Rampersad</b>Branch Manager, Ricky Rampersad Branch<br>Guardian Life of the Caribbean</p></div></div>';
  if (!tMsCreds_()) { log_('transition', 'chase-client-held', T_MS_MISSING); return; }
  try { tMsSend_(to, 'Still on it', html, tClientOpts_()); }
  catch (e) { log_('transition', 'chase-client-failed', String(e && e.message ? e.message : e)); }
}

/** Chases what a client is still waiting on. Run once a day, from the
 *  digest — not from tSummary_, which the responses page polls every two
 *  minutes, so a chase is never fired twice by a page left open.
 *
 *  Client Responses has been recording taps since before this campaign —
 *  the site's original assign/review/question doors, going back months —
 *  and every one of those old rows still reads "Open" because nothing
 *  before today ever looked at that column again. A chase that does not
 *  know the difference is a bug, not a feature: it would nudge the branch,
 *  and eventually reassure a client, about a conversation from months ago
 *  that a person already finished by hand. So the very first check on every
 *  row is whether its token is one this campaign's own Transition Send tab
 *  recognises; the token map is read once, not once per row. Anything else
 *  is passed over in silence — it was never this campaign's to chase.
 *
 *  A tap open past WAIT gets one internal nudge; still open past
 *  WAIT × CHASE_MULT it gets a client reassurance and a second, plainer
 *  nudge. Stops the moment Status reads anything other than "Open" — how
 *  the branch marks a concern resolved. Each row is chased once per level:
 *  the level is recorded in its own Note cell, appended, never overwritten,
 *  so a human note already there survives.
 *
 *  CHASE_MAX_PER_RUN bounds the work whatever the backlog, so a large
 *  one-off pile of late taps is worked through over several runs rather
 *  than risking the six-minute execution ceiling — the exact failure a
 *  same-day incident (22 September) turned out to be caused by the very
 *  problem this function guards against above. */
function tChase_() {
  var out = { chase1: 0, chase2: 0, skipped: 0, deferred: 0 };
  var sh, last;
  try { sh = ss_().getSheetByName(SVC.RESP_SHEET); last = sh ? sh.getLastRow() : 0; } catch (e) { return out; }
  if (!sh || last < 2) return out;
  var vals;
  try { vals = sh.getRange(2, 1, last - 1, 11).getValues(); } catch (e) { return out; }
  var tokens = tTokenMap_();
  var now = new Date();
  var budget = TRANSITION.CHASE_MAX_PER_RUN;
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i], rowNum = i + 2;
    var received = v[0] instanceof Date ? v[0] : null;
    if (!received || String(v[7] || '').trim().toLowerCase() !== 'open') continue;
    var token = String(v[1] || '').trim();
    var row = tokens[token];
    if (!row) { out.skipped++; continue; }               // not this campaign's token: never chased
    if (budget <= 0) { out.deferred++; continue; }        // over the cap: left for the next run
    var r = String(v[3] || '').trim(), needs = String(v[4] || '');
    var note = String(v[10] || '');
    var wait = r === 'urgent' ? TRANSITION.WAIT_URGENT : TRANSITION.WAIT_DAYS;
    var days = tWorkingDays_(received, now);
    var did1 = note.indexOf('[chase1]') >= 0, did2 = note.indexOf('[chase2]') >= 0;
    if (did1 && did2) continue;
    if (days < wait) continue;
    var newNote = note;
    try {
      if (!did1) {
        tChaseInternal_(row, r, needs, days, 1);
        newNote += (newNote ? ' ' : '') + '[chase1]'; did1 = true; out.chase1++; budget--;
      }
      if (!did2 && budget > 0 && days >= wait * TRANSITION.CHASE_MULT) {
        tChaseClient_(row, needs);
        tChaseInternal_(row, r, needs, days, 2);
        newNote += ' [chase2]'; out.chase2++; budget--;
      }
      if (newNote !== note) sh.getRange(rowNum, 11).setValue(newNote);
    } catch (e) { log_('transition', 'chase-row-failed', String(e && e.message ? e.message : e)); }
  }
  if (out.chase1 || out.chase2 || out.skipped || out.deferred) {
    log_('transition', 'chase', out.chase1 + ' internal, ' + out.chase2 + ' client reassured, ' +
      out.skipped + ' not this campaign, ' + out.deferred + ' left for the next run');
  }
  return out;
}

/* ── the hourly send ──────────────────────────────────────────────── */
function transitionSendBatch(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'another send is running';
  try { return tSendBatch_(force); } finally { lock.releaseLock(); }
}

function tSendBatch_(force) {
  var tz = tTz_(), now = new Date();
  if (force !== true) {
    var h = Number(Utilities.formatDate(now, tz, 'H'));
    var wd = Number(Utilities.formatDate(now, tz, 'u'));      // 1 = Monday … 7 = Sunday
    if (TRANSITION.WEEKDAYS.indexOf(wd) < 0 || h < TRANSITION.HOURS[0] || h >= TRANSITION.HOURS[1]) {
      return 'outside sending hours';
    }
    /* the switch: the list can sit in the tab, the Test rows can go by hand, and
       nothing else leaves until transitionGoLive has been run */
    if (PropertiesService.getScriptProperties().getProperty(T_LIVE) !== 'yes') {
      return tSay_('not live — Transition: go live when the test rows have been checked');
    }
  }
  /* the sender before the tab: Microsoft 365 set up and answering, or no row
     is touched — a refused sign-in never marks sixty rows 'error' */
  try { tMsToken_(); } catch (err) { return tStop_('sender-not-ready', err); }
  var cap = TRANSITION.BATCH;

  /* the tab and the letters before any row is touched: a header that does not
     match or a site that does not answer stops the run here, and the reason
     goes to the log, the page and the digest — not to a failure e-mail */
  var t, letters;
  try { t = tRead_(); } catch (err) { return tStop_('stopped', err); }
  try { letters = tLetters_(); } catch (err) { return tStop_('letters-unavailable', err); }

  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  /* one address, one letter: a household sharing an e-mail gets the first row
     this run and the rest held for a person to decide, not three letters at once */
  var seen = {};
  t.rows.forEach(function (r) { if (tText_(r['Sent at']) && tText_(r.Email)) seen[tText_(r.Email).toLowerCase()] = r._row; });
  var due = t.rows.filter(function (r) {
    if (tHeld_(r.Exclude)) return false;
    if (tText_(r['Sent at'])) return false;
    if (tYes_(r.Test)) return false;                            // the test rows go by hand
    if (!tText_(r.Segment)) return false;
    var so = tDay_(r['Send on']);
    if (so === null) { tMark_(t, r, 'check: Send on is not a date', false); return false; }
    if (!so || so > today) return false;                        // no date is a hold, never 'now'
    var why = tHold_(r, letters);                               // no e-mail, no first name, no letter: out of the queue
    if (why) { tHoldRow_(t, r, why); return false; }
    var mail = tText_(r.Email).toLowerCase();
    if (seen[mail]) { tHoldRow_(t, r, 'check: same e-mail as row ' + seen[mail]); return false; }
    seen[mail] = r._row;
    return true;
  });
  due.sort(function (a, b) { return tOrder_(a) - tOrder_(b) || a._row - b._row; });
  var res = tSendRows_(t, due.slice(0, cap), letters);
  var waiting = Math.max(0, due.length - cap);
  var msg = res.sent + ' sent, ' + res.skipped + ' skipped, ' + res.failed + ' failed, ' + waiting + ' waiting for the next run';
  log_('transition', 'batch', msg);
  return msg;
}

/** The menu item. Asks first, then sends the next batch whatever the hour
 *  and the switch, and says what happened. The trigger uses transitionSendBatch. */
function transitionSendBatchNow() {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui && ui.alert('Send the next batch now?', 'Up to ' + TRANSITION.BATCH + ' real letters go to clients the moment you press YES.',
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return 'not sent';
  return tSay_(transitionSendBatch(true));
}

/** A run that stopped before it touched a row: logged under its own event so
 *  the last-runs list on the page and in the digest carries the reason. */
function tStop_(event, err) {
  var msg = String(err && err.message ? err.message : err);
  log_('transition', event, msg);
  return tSay_(event + ': ' + msg);
}

/** The rows marked Test = Y, now. Ignores the hours and the live switch. Each sends once. */
function transitionSendTest() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return tSay_('another send is running');
  try { return tSendTest_(); } finally { lock.releaseLock(); }
}

function tSendTest_() {
  try { tMsToken_(); } catch (err) { return tStop_('sender-not-ready', err); }
  var t, letters;
  try { t = tRead_(); } catch (err) { return tStop_('stopped', err); }
  try { letters = tLetters_(); } catch (err) { return tStop_('letters-unavailable', err); }
  var rows = t.rows.filter(function (r) {
    return tYes_(r.Test) && !tHeld_(r.Exclude) && !tText_(r['Sent at']) && tText_(r.Segment);
  });
  if (!rows.length) return tSay_('No unsent rows marked Test = Y.');
  var res = tSendRows_(t, rows, letters);
  var msg = 'Test: ' + res.sent + ' sent, ' + res.skipped + ' skipped, ' + res.failed + ' failed.';
  log_('transition', 'test', msg);
  return tSay_(msg);
}

/** One of each letter to your own inbox, with sample values in every field. */
function transitionPreviewToMe() {
  var me = (Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail());
  if (!me) throw new Error('Could not read your address; run this from the sheet.');
  /* the same fetch and the same marker check as the send, so a site still
     serving the previous cut is found here, before the Test rows */
  var letters;
  try { letters = tLetters_(); } catch (err) { return tStop_('letters-unavailable', err); }
  /* set up but refused: say why here, before the Test rows find out */
  var ms = !!tMsCreds_();
  if (ms) { try { tMsToken_(); } catch (err) { return tStop_('sender-not-ready', err); } }
  var n = 0;
  Object.keys(letters).sort().forEach(function (seg) {
    var L = letters[seg];
    var row = {
      Token: 'PREVIEW', Segment: seg, 'First name': 'Sample', Email: me,
      'Agent first name': '[first name]', first_year: 2014, years: 12, issue_date: new Date(2014, 2, 14),
      paid_to: new Date(2026, 7, 1), days: 52, projected_lapse: new Date(2026, 10, 30),
      app_received: new Date(2026, 8, 3), matured_on: new Date(2026, 8, 1), maturity_date: new Date(2027, 2, 1),
    };
    var html = tFill_(L.html, row);
    var subject = '[preview ' + seg + '] ' + tFill_(L.subject, row);
    /* through Microsoft 365 once it is set up, so the preview arrives exactly
       as a client's letter will; to your own inbox only, never copied */
    if (ms) tMsSend_(me, subject, html, {});
    else MailApp.sendEmail(me, subject, 'Preview of letter ' + seg + '.', { htmlBody: html, name: TRANSITION.FROM_NAME });
    n++;
    Utilities.sleep(ms ? 2100 : 120);
  });
  var msg = n + ' preview letters sent to ' + me + (ms ? ' from ' + TRANSITION.MS_FROM + '.' :
    ', from this Google account: Microsoft 365 is not set up yet, so no client letter can send.');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/* ── what comes back ──────────────────────────────────────────────── */
/** Whether a code opens the page, and whether any code could — the branch
 *  code in Service.gs or a Portal code on the Agent Skill Bank. */
function tCodeOk_(code) {
  code = String(code || '').trim().toUpperCase();
  var branch = String(SVC.TEAM_CODE || '').trim().toUpperCase();
  var ok = !!(branch && code === branch), bank = [];
  try { bank = skillBank_(); } catch (e) {}
  bank.forEach(function (a) { if (a.portal && a.portal.toUpperCase() === code) ok = true; });
  return { ok: ok, configured: !!(branch || bank.length) };
}

/** Working days that have fully passed since `from`, as at `to`. The day the
 *  tap arrived never counts, and a day counts only once it is over — so a
 *  Monday tap has waited two working days at Thursday 00:00, a Friday tap at
 *  Wednesday 00:00, and nothing is 'late' the morning after it arrived. */
function tWorkingDays_(from, to) {
  var n = 0, d = new Date(from.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);                        // the first day that can count
  while (d.getTime() + 86400000 <= to.getTime()) {   // and only once it has passed
    var wd = d.getDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** The last few things the send did, off the Service Activity log — batches,
 *  tests, a stop and why, live, paused. The page and the digest show them
 *  under 'last runs', so a run that stopped is seen the same morning. */
function tRuns_(n) {
  var out = [];
  try {
    var sh = ss_().getSheetByName(SVC.LOG_SHEET);
    var last = sh ? sh.getLastRow() : 0;
    if (last < 2) return out;
    var from = Math.max(2, last - 400);
    var vals = sh.getRange(from, 1, last - from + 1, 4).getValues();
    for (var i = vals.length - 1; i >= 0 && out.length < n; i--) {
      if (String(vals[i][1]) !== 'transition') continue;
      out.push({
        when: vals[i][0] instanceof Date ? Utilities.formatDate(vals[i][0], tTz_(), 'd MMM HH:mm') : String(vals[i][0] || ''),
        event: String(vals[i][2] || ''), detail: String(vals[i][3] || ''),
      });
    }
  } catch (e) {}
  return out;
}

function tSheetRows_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return { head: [], rows: [] };
  var vals = sh.getDataRange().getValues();
  var head = vals[0].map(function (h) { return String(h).trim(); });
  return { head: head, rows: vals.slice(1) };
}

/** Everything the monitor page and the digest show. Names come from the send
 *  list at run time and never leave the sheet except to a page opened with
 *  the branch code. */
function tSummary_() {
  var tz = tTz_(), now = new Date();
  var t = tRead_();
  var byTok = {}, byMail = {}, seg = {}, totals = { clients: 0, ready: 0, sent: 0, excluded: 0, noEmail: 0, waiting: 0 };
  t.rows.forEach(function (r) {
    var s = tText_(r.Segment).toUpperCase() || '—';
    var g = seg[s] = seg[s] || { clients: 0, sent: 0, excluded: 0, waiting: 0, taps: 0 };
    g.clients++; totals.clients++;
    var ex = tHeld_(r.Exclude) ? (tText_(r.Exclude) || 'held') : '';
    if (ex) { g.excluded++; totals.excluded++; if (/no e-mail/i.test(ex)) totals.noEmail++; }
    else if (tText_(r['Sent at'])) { g.sent++; totals.sent++; }
    else if (s !== '—') { g.waiting++; totals.waiting++; }
    if (tText_(r.Token)) byTok[tText_(r.Token)] = r;
    if (tText_(r.Email)) byMail[tText_(r.Email).toLowerCase()] = r;
  });
  totals.ready = totals.sent + totals.waiting;

  /* the taps: Client Responses — Received, Token, Segment, Response, Needs, Page, Referrer, Status, Assigned to, Assigned on, Note */
  var resp = tSheetRows_(SVC.RESP_SHEET);
  var taps = [], byType = {}, late = [], today = 0;
  resp.rows.forEach(function (v, i) {
    var received = v[0] instanceof Date ? v[0] : null;
    var tok = String(v[1] || '').trim(), r = byTok[tok];
    if (/^preview$/i.test(tok)) return;                         // the manager tapping the preview letters
    var type = String(v[3] || '').trim();
    if (!type) return;
    var s = String(v[2] || '').trim().toUpperCase();
    if (seg[s]) seg[s].taps++;
    byType[type] = (byType[type] || 0) + 1;
    var item = {
      received: received ? Utilities.formatDate(received, tz, 'd MMM HH:mm') : '',
      segment: s, response: type, needs: String(v[4] || ''), status: String(v[7] || ''),
      assigned: String(v[8] || ''), assignedOn: v[9] instanceof Date ? Utilities.formatDate(v[9], tz, 'd MMM') : String(v[9] || ''),
      client: r ? tText_(r.Client) : (tok ? 'token ' + tok : ''), agent: r ? tText_(r.Agent) : '',
      row: i + 2,
    };
    if (received && Utilities.formatDate(received, tz, 'yyyy-MM-dd') === Utilities.formatDate(now, tz, 'yyyy-MM-dd')) today++;
    var opens = String(v[7] || '').toLowerCase() === 'open';
    var wait = type === 'urgent' ? TRANSITION.WAIT_URGENT : TRANSITION.WAIT_DAYS;   // urgent promises the next working day
    if (opens && !item.assigned && received && tWorkingDays_(received, now) >= wait) late.push(item);
    taps.push(item);
  });
  taps.reverse();

  /* the reviews: Service Questionnaires rows whose e-mail is on the send list */
  var q = tSheetRows_(SVC.IND_SHEET);
  var qi = {};
  q.head.forEach(function (h, i) { qi[h] = i; });
  var reviews = [], urgent = 0;
  q.rows.forEach(function (v) {
    var mail = String(qi.Email !== undefined ? v[qi.Email] || '' : '').trim().toLowerCase();
    /* the urgent tap carries the letter's token into Link ref; the e-mail is the fallback */
    var ref = String(qi['Link ref'] !== undefined ? v[qi['Link ref']] || '' : '').trim();
    var m = /^transition:(\S+)$/.exec(ref);
    var hit = (m && byTok[m[1]]) || (mail && byMail[mail]);
    if (!hit) return;
    byMail[mail] = hit;
    var pr = String(qi.Priority !== undefined ? v[qi.Priority] || '' : '');
    if (/urgent/i.test(pr)) urgent++;
    var when = qi.Timestamp !== undefined && v[qi.Timestamp] instanceof Date ? v[qi.Timestamp] : null;
    reviews.push({
      ref: String(qi.Reference !== undefined ? v[qi.Reference] || '' : ''),
      when: when ? Utilities.formatDate(when, tz, 'd MMM HH:mm') : '',
      client: String(qi.Client !== undefined ? v[qi.Client] || '' : '') || tText_(byMail[mail].Client),
      agent: tText_(byMail[mail].Agent), segment: tText_(byMail[mail].Segment).toUpperCase(),
      priority: pr, status: String(qi.Status !== undefined ? v[qi.Status] || '' : ''),
      handled: String(qi['Handled by'] !== undefined ? v[qi['Handled by']] || '' : ''),
    });
  });
  reviews.reverse();

  /* the team's verdicts: Team Feedback — Received, Name, Town, Item, Verdict, Comment, Taking assignments, … */
  var fb = tSheetRows_(SVC.FEEDBACK_SHEET);
  var verdicts = { send: 0, change: 0, hold: 0 }, taking = {}, names = {};
  fb.rows.forEach(function (v) {
    var verdict = String(v[4] || '').toLowerCase();
    if (/as it is/.test(verdict)) verdicts.send++;
    else if (/change/.test(verdict)) verdicts.change++;
    else if (/hold/.test(verdict)) verdicts.hold++;
    var name = String(v[1] || '').trim();
    if (name) names[name] = 1;
    if (name && /^(yes|y|1|true)$/i.test(String(v[6] || '').trim())) taking[name] = String(v[2] || '').trim();
  });

  return {
    ok: true, at: Utilities.formatDate(now, tz, 'd MMM yyyy HH:mm'), totals: totals, segments: seg,
    taps: { total: taps.length, today: today, byType: byType, late: late, latest: taps.slice(0, 40) },
    reviews: { total: reviews.length, urgent: urgent, latest: reviews.slice(0, 20) },
    feedback: { people: Object.keys(names).length, verdicts: verdicts, taking: taking },
    waitDays: TRANSITION.WAIT_DAYS, waitUrgent: TRANSITION.WAIT_URGENT,
    armed: tArmed_(), runs: tRuns_(6),
  };
}

function transitionData_(code) {
  var c = tCodeOk_(code);
  if (!c.ok) {
    return { ok: false, error: c.configured
      ? 'That code does not open this page. Use the branch code, or your own code from the Agent Skill Bank.'
      : 'Not open yet — set TEAM_CODE in Service.gs, or add an agent with a portal code to the Agent Skill Bank.' };
  }
  try { return tSummary_(); }
  catch (err) { return { ok: false, error: String(err && err.message ? err.message : err) }; }
}

/* ── the morning e-mail ───────────────────────────────────────────── */
function transitionDigest() {
  var to = TRANSITION.DIGEST_TO || Session.getEffectiveUser().getEmail();
  try { tChase_(); } catch (e) { log_('transition', 'chase-failed', String(e && e.message ? e.message : e)); }
  var s;
  try { s = tSummary_(); }
  catch (err) {
    /* a tab the send cannot read is the morning's whole news: say it plainly */
    var why = String(err && err.message ? err.message : err);
    log_('transition', 'stopped', why);
    MailApp.sendEmail(to, 'Transition: stopped — ' + why.slice(0, 80), 'The send and this digest could not read the sheet.\n\n' +
      why + '\n\nFix the "' + TRANSITION.SHEET + '" tab, then run Transition: send the Test rows now to check.', { name: TRANSITION.FROM_NAME });
    return 'digest sent to ' + to + ' (stopped: ' + why + ')';
  }
  var tile = function (n, label) {
    return '<td style="padding:10px 14px;background:#f4f8fa;border-radius:8px"><div style="font:800 24px/1 Arial,sans-serif;color:#12202e">' +
      n + '</div><div style="font:600 11px/1.3 Arial,sans-serif;color:#64798e;text-transform:uppercase;letter-spacing:.08em;margin-top:4px">' + label + '</div></td><td style="width:8px"></td>';
  };
  var rows = function (items, cols) {
    if (!items.length) return '<p style="color:#64798e">None.</p>';
    return '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:13px Arial,sans-serif;color:#33465a">' +
      items.map(function (it) {
        return '<tr>' + cols.map(function (c) { return '<td style="border-bottom:1px solid #e0eaef">' + tEsc_(it[c] || '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table>';
  };
  var segs = Object.keys(s.segments).sort().map(function (k) {
    var g = s.segments[k];
    return '<tr><td style="padding:4px 10px 4px 0"><b>' + tEsc_(k) + '</b></td><td style="padding:4px 10px">' + g.sent + ' sent</td><td style="padding:4px 10px">' +
      g.waiting + ' waiting</td><td style="padding:4px 10px">' + g.taps + ' taps</td><td style="padding:4px 10px">' + g.excluded + ' held back</td></tr>';
  }).join('');
  var types = Object.keys(s.taps.byType).map(function (k) { return k + ' ' + s.taps.byType[k]; }).join(' · ') || 'none yet';
  var html = '<div style="font:15px/1.5 Arial,sans-serif;color:#33465a;max-width:640px">' +
    '<h2 style="font:800 20px Arial,sans-serif;color:#12202e;margin:0 0 4px">Transition — ' + s.at + '</h2>' +
    '<p style="margin:0 0 14px;color:#64798e">Sends, taps, reviews and verdicts. The live page has the detail.</p>' +
    (s.armed ? '' : '<p style="margin:0 0 14px;padding:10px 14px;background:#fdeeea;border-left:4px solid #b3261e;color:#8a3324">' +
      '<b>The hourly send is off.</b> The Test rows still go by hand; nothing else sends until Service Questionnaire &rarr; Transition: go live.</p>') +
    '<table cellpadding="0" cellspacing="0"><tr>' + tile(s.totals.sent, 'letters sent') + tile(s.totals.waiting, 'waiting') +
    tile(s.taps.total, 'taps') + tile(s.reviews.total, 'reviews') + tile(s.taps.late.length, 'late') + '</tr></table>' +
    '<h3 style="font:800 15px Arial,sans-serif;color:#12202e;margin:18px 0 6px">By letter</h3><table cellpadding="0" cellspacing="0" style="font:13px Arial,sans-serif">' + segs + '</table>' +
    '<h3 style="font:800 15px Arial,sans-serif;color:#12202e;margin:18px 0 6px">Taps</h3><p style="margin:0">' + tEsc_(types) + ' &middot; ' + s.taps.today + ' today</p>' +
    '<h3 style="font:800 15px Arial,sans-serif;color:#b3261e;margin:18px 0 6px">Waiting more than ' + s.waitDays + ' working days, nobody assigned</h3>' +
    rows(s.taps.late, ['received', 'client', 'segment', 'response', 'agent']) +
    '<h3 style="font:800 15px Arial,sans-serif;color:#12202e;margin:18px 0 6px">Reviews from the campaign' + (s.reviews.urgent ? ' — ' + s.reviews.urgent + ' urgent' : '') + '</h3>' +
    rows(s.reviews.latest.slice(0, 10), ['when', 'client', 'segment', 'priority', 'status']) +
    '<h3 style="font:800 15px Arial,sans-serif;color:#12202e;margin:18px 0 6px">The team</h3>' +
    '<p style="margin:0">' + s.feedback.people + ' answered · ' + s.feedback.verdicts.send + ' send · ' + s.feedback.verdicts.change +
    ' change · ' + s.feedback.verdicts.hold + ' hold · taking assignments: ' + (tEsc_(Object.keys(s.feedback.taking).join(', ')) || 'nobody yet') + '</p>' +
    '<h3 style="font:800 15px Arial,sans-serif;color:#12202e;margin:18px 0 6px">Last runs</h3>' +
    rows(s.runs, ['when', 'event', 'detail']) + '</div>';
  MailApp.sendEmail(to, 'Transition: ' + s.totals.sent + ' sent, ' + s.taps.total + ' taps, ' + s.reviews.total +
    ' reviews' + (s.taps.late.length ? ', ' + s.taps.late.length + ' late' : ''), 'Open in a mail app that shows HTML.',
    { htmlBody: html, name: TRANSITION.FROM_NAME });
  return 'digest sent to ' + to;
}
