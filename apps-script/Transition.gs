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
 *   transitionSendBatch()    what the hourly trigger runs; safe to run by hand — the day's new letters,
 *                            then (tRemind_) the same letter once more to anyone unanswered after REMIND_DAYS
 *   transitionDigest()       the morning e-mail (DIGEST_HOURS); safe to run by hand
 *   transitionWeekly()       the Monday insight report (WEEKLY_HOUR): what the answers mean; safe to run by hand
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
  ORDER: ['T', 'I', 'K', 'J', 'A', 'R', 'F', 'G'],   // the terminated-contract notice, then the action letters; F1…F5 sort as F, R1 and R2 as R
  DIGEST_TO: '',             // blank = the script owner
  DIGEST_HOURS: [8, 12],     // the digest fires this many times a day, sheet time zone
  WEEKLY_TO: '',             // the Monday insight report; blank = DIGEST_TO. Several addresses: 'a@x.com, b@y.com'
  WEEKLY_HOUR: 7,            // Monday, within this hour, sheet time zone — before the 8:00 digest
  COPY_TO: '',               // blank = SVC.AGENT_EMAIL. Where the internal "late" nudges go.
  WAIT_DAYS: 2,              // a tap older than this, still unassigned, is late
  WAIT_URGENT: 1,            // the branch's own target for an urgent tap; the client is promised no timeline (24 September)
  CHASE_MULT: 2,             // a tap still open at WAIT × this gets a second, client-facing chase
  CHASE_MAX_PER_RUN: 40,     // the most one chase run will act on, whatever the backlog — see tChase_
  RECEIPT_WAIT_MIN: 3,       // a receipt goes this many minutes after the client's last tap, so it can recap all of them
  RECEIPT_FORM_WAIT_MIN: 30, // and waits this long for the review when a tap opened the form, so it can recap that too
  RECEIPT_MAX_PER_RUN: 30,   // the most one five-minute run will send
  INBOX_DAYS: 3,             // how far back the inbox reader looks for replies (transitionInbox, every five minutes)
  REMIND_DAYS: 21,           // a letter unanswered this long goes once more, with a line saying when the first went (tRemind_); 0 turns it off
  REMIND_MAX_PER_RUN: 30,    // the most reminders one hourly run adds, after the day's new letters and inside the same BATCH
  /* who signs the receipts — the team, never an individual — used only when the
     site cannot be fetched: receipt.json beside the letters is the word */
  CARE: { name: 'Client Support Team', us: 'our Client Support team', Us: 'Our Client Support team',
          line: 'Ricky Rampersad Branch · Guardian Life of the Caribbean' },
};

/* The switch the hourly send is behind. transitionGoLive sets it, transitionPause
   clears it; until it is set the trigger runs and sends nothing. */
var T_LIVE = 'transition_live';

var T_HEADERS = ['Token', 'Segment', 'First name', 'Email', 'Agent first name', 'Client', 'Agent',
  'Client number', 'first_year', 'years', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date', 'collected_on', 'promised_on', 'svc_docs', 'svc_requests', 'svc_reminders',
  'svc_birthday', 'terminated_on', 'Exclude', 'Reason', 'Test', 'Send on', 'Sent at', 'Status'];
/* The client's own record with the branch team (tools/letters/service-record.py
   fills these columns): cut cell by cell like a blank fact, a zero counting as
   blank, and where none is left the plain line about the team stands in. */
var T_SVC = ['svc_docs', 'svc_requests', 'svc_reminders', 'svc_birthday'];
/* The fields no column holds: worked out on the day the letter goes (tDerive_),
   so the days a letter prints are true that day — days_held from collected_on
   (letter J), days_open from app_received (K and T1) — and sent_on, set by the
   reminder alone, which is what puts the "we wrote to you on" line above the
   greeting; blank on a first send, so the fact cut removes the line whole. */
var T_DERIVED = ['days_held', 'days_open', 'sent_on'];
/* the merge fields a letter may carry, and the ones that sit in a strip.
   terminated_on is letter T's alone: the date Guardian Life terminated the
   agent's contract, from its own notice, filled from the sheet like the name.
   promised_on is letter J's: the day the branch's own delivery-update e-mail
   went to that client, blank where none did, and its sentence goes with it. */
var T_FIELDS = ['first_year', 'years', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date', 'collected_on', 'promised_on', 'terminated_on'].concat(T_SVC, T_DERIVED);
var T_FACTS = ['first_year', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date', 'collected_on', 'promised_on'].concat(T_SVC, T_DERIVED);
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
  /* a date the import left as text (the conversion box unticked) still prints as a date */
  var ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) { var d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])); return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tTz_(), 'd MMMM yyyy'); }
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
    var f = t.getHandlerFunction();
    if (f === 'transitionDigest' || f === 'transitionReceipts' || f === 'transitionInbox' || f === 'transitionWeekly') ScriptApp.deleteTrigger(t);
  });
  TRANSITION.DIGEST_HOURS.forEach(function (h) {
    ScriptApp.newTrigger('transitionDigest').timeBased().inTimezone(tTz_()).atHour(h).everyDays(1).create();
  });
  /* the replies and the receipts: every five minutes, whether or not the hourly send is on, because letters already out earn them */
  ScriptApp.newTrigger('transitionInbox').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('transitionReceipts').timeBased().everyMinutes(5).create();
  tWeeklyTrigger_();
  var msg = '"' + TRANSITION.SHEET + '" is ready and the digest is installed for ' +
    TRANSITION.DIGEST_HOURS.map(function (h) { return h + ':00'; }).join(' and ') +
    ', the weekly insight report for Monday ' + TRANSITION.WEEKLY_HOUR + ':00, and the replies are read and the receipts sent every five minutes. ' +
    'The hourly send stays off until Transition: go live. Import the send list into the tab, run ' +
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
  if (!have.transitionInbox) ScriptApp.newTrigger('transitionInbox').timeBased().everyMinutes(5).create();
  if (!have.transitionReceipts) ScriptApp.newTrigger('transitionReceipts').timeBased().everyMinutes(5).create();
  if (!have.transitionWeekly) tWeeklyTrigger_();
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
      tForget_(L.file);
      throw new Error('Letter ' + seg + ' on the site carries no fact markers: merge and rebuild before sending');
    }
    if (/\{\{agent_first_name\}\}/.test(html) && !/<!--agent-->/.test(html)) {
      tForget_(L.file);
      throw new Error('Letter ' + seg + ' on the site carries no agent markers: merge and rebuild before sending');
    }
    out[seg] = { segment: seg, subject: L.subject, html: html };
  });
  if (!Object.keys(out).length) { tForget_('manifest.json'); throw new Error('The manifest on the site lists no letters'); }
  return out;
}

/** Drop a fetched copy from the ten-minute cache, so a letter that failed a
 *  check is fetched afresh on the next run rather than failing again from the
 *  cache after the site has been fixed (24 September: letter T, twice). */
function tForget_(path) {
  try { CacheService.getScriptCache().remove('transition:' + path); } catch (e) {}
}

function tEsc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Whole days from a date (a Date, or text the import left as text) to today,
 *  as text; '' when it cannot be read or lies ahead. */
function tDays_(x) {
  var d = null;
  if (x instanceof Date) d = x;
  else {
    var s = String(x === null || x === undefined ? '' : x).trim();
    var ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (ymd) d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    else if (s) { var p = new Date(s); if (!isNaN(p.getTime())) d = p; }
  }
  if (!d || isNaN(d.getTime())) return '';
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var from = new Date(d.getTime()); from.setHours(0, 0, 0, 0);
  var n = Math.round((today.getTime() - from.getTime()) / 86400000);
  return n >= 0 ? String(n) : '';
}

/** The row with T_DERIVED filled: the days worked out from the row's own dates
 *  on the day the letter goes. A blank date leaves the field blank and the
 *  fact cut removes it; a value already on the row is kept. Never writes back. */
function tDerive_(row) {
  var out = {};
  for (var k in row) out[k] = row[k];
  if (!tText_(out.days_held)) out.days_held = tDays_(out.collected_on);
  if (!tText_(out.days_open)) out.days_open = tDays_(out.app_received);
  return out;
}

/** Fill one letter (or its subject) for one row. A fact whose field is blank
 *  is cut out between its markers; the strip goes when its last fact does. */
function tFill_(text, row) {
  row = tDerive_(row);
  var v = function (k) {
    var x = row[k];
    /* the month of the last birthday note: a sheet import reads 'August 2026' as
       a date, and the letter must print the month, never a first of the month */
    if (k === 'svc_birthday' && x instanceof Date) return isNaN(x.getTime()) ? '' : Utilities.formatDate(x, tTz_(), 'MMMM yyyy');
    var s = tText_(x);
    return (T_SVC.indexOf(k) >= 0 && /^0+$/.test(s)) ? '' : s;   // no record is not a record of nothing
  };
  var out = text;
  T_FACTS.forEach(function (k) {
    if (!v(k)) out = out.replace(new RegExp('<!--fact:' + k + '-->[\\s\\S]*?<!--/fact-->', 'g'), '');
  });
  out = out.replace(/<!--facts-->([\s\S]*?)<!--\/facts-->/g, function (m, inner) {
    return /<!--fact:/.test(inner) ? m : '';
  });
  if (/<!--svcpanel-->/.test(out)) out = out.replace(/<!--nosvc-->[\s\S]*?<!--\/nosvc-->/g, '');
  /* no agent first name on the row: "Your representative has moved on" still reads */
  if (!v('Agent first name')) out = out.replace(/<!--agent-->[\s\S]*?<!--\/agent-->/g, '');
  var map = {
    first_name: v('First name'),          // blank never reaches here: tHold_ keeps the row back
    agent_first_name: v('Agent first name'),
    agent_or_rep: v('Agent first name') || 'Your representative',   // the subject line: the name, or the notice's own words
    agent_name: v('Agent') || v('Agent first name') || 'Your representative',   // letter T: the full name, as the sheet spells it
    token: v('Token'),
    segment: v('Segment').toUpperCase(),
  };
  T_FIELDS.forEach(function (k) { map[k] = v(k); });
  /* the receipt's own fields, when the caller put them on the row */
  ['next', 'time', 'care_name', 'care_first', 'care_us', 'care_Us', 'care_line'].forEach(function (k) { if (row[k] !== undefined) map[k] = String(row[k]); });
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
  /* letter T names the agent and the date the contract was terminated in its
     first line: without both it would read as a blank, so the row is held */
  if (seg.charAt(0) === 'T' && !tText_(row['Agent first name'])) return 'no agent name';       // T and T1
  if (seg.charAt(0) === 'T' && !tText_(row.terminated_on)) return 'no termination date';
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
  /* Blobs (a PDF of the review, the appointment papers): under 3 MB each, which Graph's sendMail takes inline */
  if (o.attachments && o.attachments.length) msg.attachments = o.attachments.map(function (b) {
    return { '@odata.type': '#microsoft.graph.fileAttachment', name: b.getName(), contentType: b.getContentType(),
             contentBytes: Utilities.base64Encode(b.getBytes()) };
  });
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
  if (tText_(row.sent_on)) subject = 'Reminder: ' + subject;   // the same letter once more (tRemind_)
  var html = tFill_(L.html, row);
  /* A field this script does not know goes out as {{name}} in the client's own
     letter. That means the letters on the site are newer than this file: stop
     the run rather than send one, and paste the current Transition.gs. */
  var left = (subject + html).match(/\{\{\w+\}\}/);
  if (left) throw new Error('Letter ' + seg + ' carries ' + left[0] + ', which this script cannot fill: paste the current Transition.gs. Nothing was sent.');
  tMsSend_(tText_(row.Email), subject, html, tClientOpts_());
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

/** The receipt and its words, fetched from the site like the letters and
 *  cached with them; null when the site does not answer, and the caller
 *  falls back to a plain receipt so a tap is still acknowledged. */
function tReceipt_() {
  try {
    var j = JSON.parse(tFetch_('receipt.json'));
    return { json: j, html: tFetch_(j.file || 'receipt.html') };
  } catch (e) { return null; }
}

/** The confidentiality footer every client e-mail ends in, from receipt.json
 *  on the site (build-letters.py holds the words; see LEGAL there), else the
 *  same words kept here so no client e-mail ever goes without it. */
var T_LEGAL_FALLBACK = '<p style="margin:8px 0 0;font:400 12px/1.5 Inter,Arial,sans-serif;color:#64798e"><b style="color:#4a5f74">Confidential.</b> ' +
  'This e-mail is for you alone and concerns your policy with Guardian Life of the Caribbean. If it has reached you in error, please tell us by ' +
  'reply and delete it; do not forward it. Your personal information is handled under the General Privacy Principles of the Data Protection Act ' +
  '2011 of Trinidad and Tobago and the confidentiality duty the Insurance Act 2018 places on everyone who works for an insurer: it is used only to ' +
  'look after your policy, is never sold, and is never disclosed without your express consent unless the law requires it. You may ask at any time ' +
  'what we hold about you and have it corrected. Any concern about how your information has been handled can go to our branch by reply, to Guardian ' +
  'Life of the Caribbean, or to the Office of the Information Commissioner, the authority the Act establishes, and raising it never changes how ' +
  'your policy is looked after.</p>';
var T_INTERNAL = 'Internal to the Ricky Rampersad Branch. This e-mail carries client information: do not forward it outside the branch.';
function tLegal_(rc) {
  rc = rc === undefined ? tReceipt_() : rc;
  return (rc && rc.json && rc.json.legal && rc.json.legal.html) || T_LEGAL_FALLBACK;
}
function tInternal_(rc) {
  return (rc && rc.json && rc.json.legal && rc.json.legal.internal) || T_INTERNAL;
}

/** Who answers — the team — from the site's receipt.json, else the fallback. */
function tCare_(rc) {
  var c = (rc && rc.json && rc.json.care) || TRANSITION.CARE || {};
  var us = c.us || c.first || 'our Client Support team';
  return { care_name: c.name || 'Client Support Team', care_first: us, care_us: us, care_Us: c.Us || 'Our Client Support team',
           care_line: (c.line || 'Ricky Rampersad Branch · Guardian Life of the Caribbean').replace(/&middot;/g, '·') };
}

/** Service.gs still calls this on every tap. Nothing happens here any more:
 *  the receipt goes from transitionReceipts a few minutes later, once the
 *  client has finished tapping, so one e-mail can recap everything they
 *  told us — asked for on 24 September ("recap the concerns and a bit
 *  more … a wow experience"). */
function tAckClient_() {}

/* ── the replies: a tap in the letter opens a reply, and this files it ── */
/* Decided 24 September 2026, evening: "its supposed to be inside the email
   for easy use". Every check and every tap on the letters is a pre-written
   reply to MS_FROM (build-letters.py), so the client never leaves their mail
   app; this reads the support@ inbox every five minutes and files each reply
   on Client Responses exactly as the page filed a tap, so the receipts, the
   digest, the responses page and the chase see no difference. The last line
   of a reply is "Ref: <token> <tap> <answer>"; a reply without one is matched
   to the client by the address it came from and filed as a question, with
   their words in the Note cell. Nothing in the mailbox is changed — a reply
   stays unread for the team — so the Graph permission needed is Mail.Read
   (application), granted like Mail.Send; a message is never filed twice
   because its id is kept in the Referrer cell. Only this campaign's tokens
   are ever filed: any other e-mail is the team's to read, not the script's. */
/** Every five minutes, installed by transitionSetup and transitionGoLive. */
function transitionInbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'another run is busy';
  try { return tInbox_(); } finally { lock.releaseLock(); }
}

var T_REF = /Ref:\s*([A-Za-z0-9_-]{6,64})\s+([a-z]+)(?:\s+([a-z_]+))?/;

function tInbox_() {
  var out = { filed: 0, seen: 0, skipped: 0 };
  if (!tMsCreds_()) return out;
  var since = new Date(Date.now() - TRANSITION.INBOX_DAYS * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
  var url = 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(TRANSITION.MS_FROM) + '/mailFolders/inbox/messages' +
    '?$select=id,internetMessageId,subject,from,receivedDateTime,body&$orderby=receivedDateTime%20desc&$top=50' +
    '&$filter=' + encodeURIComponent('receivedDateTime ge ' + since);
  var token;
  try { token = tMsToken_(); } catch (err) { log_('transition', 'inbox-not-ready', String(err && err.message ? err.message : err)); return out; }
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Prefer: 'outlook.body-content-type="text"' } });
  var code = res.getResponseCode();
  if (code !== 200) {
    var why = 'HTTP ' + code;
    try { var e = JSON.parse(res.getContentText()).error; if (e) why = (e.code ? e.code + ': ' : '') + (e.message || ''); } catch (x) {}
    if (code === 401) { try { CacheService.getScriptCache().remove('transition:ms-token'); } catch (x) {} }
    log_('transition', 'inbox-not-ready', (code === 403 ? 'the Entra app needs the Graph application permission Mail.Read, with admin consent. ' : '') + why.slice(0, 200));
    return out;
  }
  var msgs = [];
  try { msgs = JSON.parse(res.getContentText()).value || []; } catch (x) {}
  if (!msgs.length) return out;
  var tokens = tTokenMap_(), byMail = {};
  Object.keys(tokens).forEach(function (t) {
    var m = tText_(tokens[t].Email).toLowerCase();
    if (m) byMail[m] = byMail[m] ? 'many' : t;                         // one client per address, or nobody
  });
  var filed = tFiledIds_(), rc = tReceipt_(), lines = {};
  ((rc && rc.json.reply && rc.json.reply.lines) || []).forEach(function (l) { lines[l.trim().toLowerCase()] = 1; });
  var ours = {};
  [TRANSITION.MS_FROM].concat(TRANSITION.CC, TRANSITION.BCC).forEach(function (a) { if (a) ours[String(a).trim().toLowerCase()] = 1; });
  var sheet = null;
  msgs.forEach(function (m) {
    var id = tMsgId_(m);
    if (!id || filed[id]) { out.seen++; return; }
    var from = String(((m.from || {}).emailAddress || {}).address || '').trim().toLowerCase();
    var subject = String(m.subject || '');
    if (!from || ours[from] || /^(postmaster|mailer-daemon|no-?reply|noreply)/.test(from) ||
        /^(automatic reply|auto:|out of office|undeliverable|delivery status)/i.test(subject)) { out.skipped++; return; }
    var text = String((m.body || {}).content || '').replace(/\r/g, '');
    var ref = T_REF.exec(text) || T_REF.exec(subject);
    var tok = ref ? ref[1] : ((byMail[from] && byMail[from] !== 'many') ? byMail[from] : '');
    if (!tok || !tokens[tok]) { out.skipped++; return; }             // not this campaign's client: the team reads it in the inbox
    var r = ref ? ref[2] : 'question', q = ref ? (ref[3] || '') : 'wrote';
    var specs = (typeof RESPONSES !== 'undefined') ? RESPONSES : {};
    var spec = specs[r];
    if (!spec) { r = 'question'; q = 'wrote'; spec = specs.question || { needs: 'a reply the same day', status: 'Open' }; }
    var words = tWords_(text, lines);
    try {
      sheet = sheet || responseSheet_();
      sheet.appendRow([new Date(), tok, tText_(tokens[tok].Segment).toUpperCase(), r, spec.needs,
        '/reply' + (q ? '?q=' + q : ''), ('reply ' + id).slice(0, 120), spec.status, '', '',
        words ? '"' + words.slice(0, 300) + '"' : '']);
      filed[id] = 1; out.filed++;
    } catch (err) { log_('transition', 'inbox-row-failed', String(err && err.message ? err.message : err)); }
  });
  if (out.filed) log_('transition', 'inbox', out.filed + ' filed, ' + out.seen + ' already filed, ' + out.skipped + ' not this campaign');
  return out;
}

/** The message ids already filed: 'reply <id>' in the Referrer cell of recent Client Responses rows. */
function tFiledIds_() {
  var ids = {};
  try {
    var sh = ss_().getSheetByName(SVC.RESP_SHEET), last = sh ? sh.getLastRow() : 0;
    if (!sh || last < 2) return ids;
    var vals = sh.getRange(2, 1, last - 1, 7).getValues(), cut = Date.now() - (TRANSITION.INBOX_DAYS + 2) * 86400000;
    for (var i = 0; i < vals.length; i++) {
      var d = vals[i][0] instanceof Date ? vals[i][0].getTime() : 0, ref = String(vals[i][6] || '');
      if (d >= cut && ref.indexOf('reply ') === 0) ids[ref.slice(6)] = 1;
    }
  } catch (e) {}
  return ids;
}

function tMsgId_(m) {
  return String(m.internetMessageId || m.id || '').replace(/^<|>$/g, '').trim().slice(0, 110);
}

/** The client's own words in a reply: what is left once the reference, the pre-written lines and any quoted
 *  earlier message are gone. '' when they only tapped. */
function tWords_(text, lines) {
  var body = text.split(/\n\s*Ref:\s*[A-Za-z0-9_-]{6,64}\s+[a-z]+/)[0];
  var out = [];
  var stop = /^(On .+ wrote:|From: |Sent: |-----Original Message-----|________________________________)/;
  body.split('\n').some(function (l) {
    var t = l.trim();
    if (stop.test(t)) return true;                                        // the quoted letter beneath: not theirs
    if (!t || t.charAt(0) === '>' || lines[t.toLowerCase()]) return false;
    out.push(t); return false;
  });
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** Every five minutes, installed by transitionSetup. */
function transitionReceipts() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'another run is busy';
  try { return tReceipts_(); } finally { lock.releaseLock(); }
}

function tQOf_(page) { return (String(page || '').match(/[?&]q=([a-z_]+)/) || [])[1] || ''; }

/** One receipt per client per sitting: every unreceipted tap of a token this
 *  campaign recognises, once the newest is RECEIPT_WAIT_MIN old (a client
 *  ticking four checks gets one e-mail, not four), and once the review is
 *  filed when a tap opened the form, or RECEIPT_FORM_WAIT_MIN has passed.
 *  Each row it thanks is marked [receipt] in its Note cell, appended, so a
 *  human note there survives and the same tap is never thanked twice. */
function tReceipts_() {
  var out = { sent: 0, waiting: 0, held: 0 };
  var sh, last;
  try { sh = ss_().getSheetByName(SVC.RESP_SHEET); last = sh ? sh.getLastRow() : 0; } catch (e) { return out; }
  if (!sh || last < 2) return out;
  var vals;
  try { vals = sh.getRange(2, 1, last - 1, 11).getValues(); } catch (e) { return out; }
  var tokens = tTokenMap_(), now = new Date(), groups = {}, order = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i], received = v[0] instanceof Date ? v[0] : null;
    if (!received) continue;
    var token = String(v[1] || '').trim();
    if (!tokens[token]) continue;                                    // not this campaign's token: never touched
    var note = String(v[10] || '');
    if (note.indexOf('[receipt]') >= 0) continue;                    // thanked already
    if (now - received > 14 * 86400000) continue;                    // long before the receipts ran: left alone
    if (!groups[token]) { groups[token] = { rows: [], newest: received }; order.push(token); }
    groups[token].rows.push({ rowNum: i + 2, received: received, r: String(v[3] || '').trim().toLowerCase(),
                              q: tQOf_(v[5]), seg: String(v[2] || '').trim().toUpperCase(), note: note,
                              via: String(v[6] || '').indexOf('reply ') === 0 });   // filed from a reply: its words are in the Note, no form follows
    if (received > groups[token].newest) groups[token].newest = received;
  }
  if (!order.length) return out;
  var rc = tReceipt_();
  if (!rc || !rc.json.recap) { log_('transition', 'receipts-held', order.length + ' waiting: receipt.json on the site is missing or old, rebuild the letters'); return out; }
  if (!tMsCreds_()) { log_('transition', 'receipts-held', order.length + ' waiting: ' + T_MS_MISSING); return out; }
  var reviews = null, budget = TRANSITION.RECEIPT_MAX_PER_RUN;
  for (var k = 0; k < order.length; k++) {
    var tok = order[k], g = groups[tok];
    var formTap = g.rows.some(function (x) { return (x.r === 'urgent' || x.r === 'review' || x.r === 'selfserve') && !x.via; });
    var review = null;
    if (formTap) { if (reviews === null) reviews = tReviewMap_(); review = reviews['transition:' + tok] || null; }
    var ageMin = (now - g.newest) / 60000;
    if (ageMin < TRANSITION.RECEIPT_WAIT_MIN || (formTap && !review && ageMin < TRANSITION.RECEIPT_FORM_WAIT_MIN)) { out.waiting++; continue; }
    if (budget <= 0) { out.held++; continue; }
    var row = tokens[tok], to = tText_(row.Email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { out.held++; continue; }
    try {
      var m = tReceiptMail_(rc, row, g, review);
      tMsSend_(to, m.subject, m.html, tClientOpts_());
      g.rows.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt]'); });
      log_('transition', 'receipt', tText_(row.Client || row['First name']) + ' · ' +
        g.rows.map(function (x) { return x.q || x.r; }).join(', ') + (review ? ' · review ' + tText_(review.Reference) : ''));
      out.sent++; budget--;
    } catch (e) { log_('transition', 'receipt-failed', String(e && e.message ? e.message : e)); }
  }
  if (out.sent || out.held) log_('transition', 'receipts', out.sent + ' sent, ' + out.waiting + ' waiting, ' + out.held + ' held');
  return out;
}

/** The reviews filed from a letter, keyed by their Link ref ("transition:<token>"),
 *  read once a run; the newest for a token wins. */
function tReviewMap_() {
  var map = {};
  try {
    var sh = ss_().getSheetByName(SVC.IND_SHEET);
    var last = sh ? sh.getLastRow() : 0, lastCol = sh ? sh.getLastColumn() : 0;
    if (last < 2 || !lastCol) return map;
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var iRef = head.indexOf('Link ref');
    if (iRef < 0) return map;
    var vals = sh.getRange(2, 1, last - 1, lastCol).getValues();
    for (var i = 0; i < vals.length; i++) {
      var ref = String(vals[i][iRef] || '').trim();
      if (ref.indexOf('transition:') !== 0) continue;
      var o = {};
      head.forEach(function (h, j) { if (h) o[h] = vals[i][j]; });
      map[ref] = o;
    }
  } catch (e) {}
  return map;
}

/** Cut a <!--name-->…<!--/name--> block, or keep its inside. */
function tBlock_(html, name, keep) {
  return html.replace(new RegExp('<!--' + name + '-->([\\s\\S]*?)<!--/' + name + '-->', 'g'), function (m, inner) { return keep ? inner : ''; });
}

/** The receipt: the words from receipt.json, the client's own answers built
 *  in. `g.rows` are the taps to thank for, `review` the questionnaire row
 *  filed from the letter, or null. Pure apart from the sheet's time zone. */
function tReceiptMail_(rc, row, g, review) {
  var j = rc.json, tpl = j.tpl, care = tCare_(rc), esc = tEsc_;
  var fill = function (t, o) { return t.replace(/\{(\w+)\}/g, function (m, k) { return o.hasOwnProperty(k) ? o[k] : m; }); };
  var rows = g.rows.slice().sort(function (a, b) { return a.received - b.received; });
  /* what they told us: a quick-check answer with its question, else the words they tapped on that letter */
  var recap = [], seen = {};
  rows.forEach(function (x) {
    var item = null;
    if (x.q && j.recap.q[x.q]) item = { q: j.recap.q[x.q][0], a: j.recap.q[x.q][1] };
    else if (j.recap.taps[x.r]) item = { q: j.recap.tapped, a: (j.recap.tap_text[x.seg] && j.recap.tap_text[x.seg][x.r]) || j.recap.taps[x.r] };
    if (!item || seen[item.q + '|' + item.a]) return;
    seen[item.q + '|' + item.a] = 1; recap.push(item);
  });
  /* their concerns, in their words: the review's own questions, those they answered */
  var concerns = [];
  if (review) (j.review || []).forEach(function (label) {
    var v = review[label];
    if (v === undefined || v === null) return;
    var a = String(v).replace(/\s+$/, '').trim();
    if (!a || a === 'undefined') return;
    concerns.push({ q: label, a: a.slice(0, 400) });
  });
  /* what happens next: one line per thing asked of us, the most pressing first, never the same line twice */
  var pri = { urgent: 0, callme: 1, paid: 2, pay: 2, claim: 2, deliver: 2, finish: 2, stop: 2, review: 3, selfserve: 3, assign: 3, question: 3, informed: 9 };
  var nexts = [], seenN = {};
  rows.slice().sort(function (a, b) { return (pri[a.r] === undefined ? 5 : pri[a.r]) - (pri[b.r] === undefined ? 5 : pri[b.r]); }).forEach(function (x) {
    if (x.r === 'informed') return;                                   // a noted answer asks nothing; the line for it comes only when nothing else does
    var n = (x.q && j.next_q && j.next_q[x.q]) || (j.next && j.next[x.r]);
    if (n && !seenN[n]) { seenN[n] = 1; nexts.push(n); }
  });
  if (review) nexts.unshift('Your review is filed' + (tText_(review.Reference) ? ' under reference ' + tText_(review.Reference) : '') + '. A person reads it before anyone is matched to you.');
  if (!nexts.length) nexts.push(j.next.informed);
  /* a reply in their own words, filed by transitionInbox with the words in the Note cell: quoted back */
  rows.forEach(function (x) {
    var w = /^"([\s\S]*?)"(?:\s|$)/.exec(x.note || '');
    if (w && w[1].trim()) concerns.push({ q: 'You wrote', a: w[1].trim() });
  });
  /* what they can still tell us, one tap each: the letter's other checks, how to reach them and, once a
     call is coming, when — as replies, like the letter's own taps (the two form answers open the page) */
  var more = [];
  if (j.questions && j.reply) {
    var answered = {};
    rows.forEach(function (x) { if (x.q) answered[x.q] = 1; });
    var seg = tText_(row.Segment).toUpperCase(), tokv = tText_(row.Token);
    var keys = ((j.segments || {})[seg] || []).concat(['reach']).concat(rows.some(function (x) { return x.r === 'callme'; }) ? ['when'] : []);
    keys.forEach(function (k) {
      var Q = j.questions[k];
      if (!Q || Q[1].some(function (a) { return answered[a[2]]; })) return;
      var links = Q[1].map(function (a) {
        var href = (j.reply.form_taps || []).indexOf(a[1]) >= 0
          ? j.reply.page + '?t=' + encodeURIComponent(tokv) + '&s=' + encodeURIComponent(seg) + '&r=' + a[1] + '&q=' + a[2]
          : tReplyLink_(j.reply, Q[0], a[0], a[1], a[2], tokv);
        return fill(tpl.more_a, { href: esc(href), a: esc(a[0]) });
      });
      more.push(fill(tpl.more_q, { q: esc(Q[0]), links: links.join('') }));
    });
  }
  var block = function (items, wrap, item, f) { return items.length ? fill(tpl[wrap], { items: items.map(function (it) { return fill(tpl[item], f(it)); }).join('') }) : ''; };
  var text = function (s) { return esc(s).replace(/\n/g, '<br>'); };
  var recapHtml = block(recap, 'items', 'item', function (it) { return { q: esc(it.q), a: text(it.a) }; });
  var concHtml = concerns.map(function (it) { return fill(tpl.quote, { q: esc(it.q), a: text(it.a) }); }).join('');
  var nextHtml = block(nexts, 'bullets', 'bullet', function (a) { return { a: esc(a) }; });
  var moreHtml = more.length && tpl.more ? fill(tpl.more, { items: more.join('') }) : '';
  var followHtml = block(j.follow || [], 'bullets_dark', 'bullet_dark', function (a) { return { a: esc(a) }; });
  var vals = {};
  Object.keys(row).forEach(function (k) { vals[k] = row[k]; });
  vals['First name'] = tText_(row['First name']) || 'there';
  vals.time = Utilities.formatDate(g.newest, tTz_(), 'h:mm a').toLowerCase();
  Object.keys(care).forEach(function (k) { vals[k] = care[k]; });
  var html = tFill_(rc.html, vals);
  html = tBlock_(html, 'recap', !!recapHtml);
  html = tBlock_(html, 'concerns', !!concHtml);
  html = tBlock_(html, 'more', !!moreHtml);
  html = html.replace(/\[\[recap\]\]/g, recapHtml).replace(/\[\[concerns\]\]/g, concHtml)
             .replace(/\[\[next\]\]/g, nextHtml).replace(/\[\[more\]\]/g, moreHtml).replace(/\[\[follow\]\]/g, followHtml);
  var subject = tFill_(j.subject, vals).replace(/<[^>]+>/g, '');
  if (/\{\{\w+\}\}|\[\[\w+\]\]/.test(subject + html)) throw new Error('the receipt on the site carries a field this script cannot fill');
  return { subject: subject, html: html, recap: recap, concerns: concerns, next: nexts, more: more.length };
}

/** A reply link the way build-letters.py writes them on the letters: the answer as the subject, the
 *  question and the answer in the body, a line for anything more, and the reference on the last line. */
function tReplyLink_(reply, question, label, r, q, token) {
  var body = question + '\n' + label + '\n\n' + reply.more + '\n\nRef: ' + token + ' ' + r + (q ? ' ' + q : '');
  return 'mailto:' + reply.to + '?subject=' + encodeURIComponent(label) + '&body=' + encodeURIComponent(body);
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
    'https://rickyrampersadbranch.com/orphan-transition/responses.html\n\n' + T_INTERNAL;
  try { MailApp.sendEmail(to, subj, body, { name: TRANSITION.FROM_NAME }); } catch (e) {}
}

/** The client's own "still on it" note — only the second time, and only
 *  once, so it reassures rather than nags. Warm, not defensive, and signed
 *  by the team that answers. Takes the row already looked up; a null row
 *  (should not happen, tChase_ filters it out first) is simply skipped. */
function tChaseClient_(row, r, needs) {
  if (!row) return;
  var to = tText_(row.Email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return;
  var first = tText_(row['First name']) || 'there';
  var rc = tReceipt_(), care = tCare_(rc);
  var still = (rc && rc.json.still) || { subject: 'Still on it, {{first_name}}.',
    line: 'You have not been forgotten, and {{care_us}} is still on it. {{next}} We will ask again rather than assume, and you are welcome to reply here at any time.' };
  /* the client's own next step from receipt.json, never the branch's third-person note */
  var next = (rc && rc.json && rc.json.next && rc.json.next[r]) || needs;
  var vals = { 'First name': first, next: next, care_name: care.care_name, care_first: care.care_first, care_us: care.care_us, care_Us: care.care_Us, care_line: care.care_line };
  var html = '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:520px">' + tHead_() +
    '<div style="padding:18px 4px 0"><p style="margin:0 0 12px">Dear ' + tEsc_(first) + ',</p>' +
    '<p style="margin:0 0 12px">' + tFill_(still.line, vals) + '</p>' +
    '<p style="margin:16px 0 0"><b style="display:block">' + tEsc_(care.care_name) + '</b>' + tEsc_(care.care_line) + '</p>' +
    tLegal_(rc) + '</div></div>';
  if (!tMsCreds_()) { log_('transition', 'chase-client-held', T_MS_MISSING); return; }
  try { tMsSend_(to, tFill_(still.subject, vals).replace(/<[^>]+>/g, ''), html, tClientOpts_()); }
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
        tChaseClient_(row, r, needs);
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
  /* the reminders, with what is left of the hour's cap: never before the day's
     new letters, and never able to stop them — a failure here is logged alone */
  var rem = { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  try { rem = tRemind_(t, letters, cap - Math.min(cap, due.length)); }
  catch (err) { log_('transition', 'remind-failed', String(err && err.message ? err.message : err)); }
  if (rem.sent || rem.skipped || rem.failed || rem.waiting) {
    msg += '; reminders: ' + rem.sent + ' sent, ' + rem.skipped + ' held, ' + rem.failed + ' failed, ' + rem.waiting + ' waiting';
  }
  log_('transition', 'batch', msg);
  return msg;
}

/* ── the reminder: the same letter once more, to anyone who has not answered ── */
/** Runs at the end of every hourly batch, after the day's new letters and inside
 *  the same cap. A row sent REMIND_DAYS or more ago, still marked 'sent', whose
 *  token has no row on Client Responses and no review, gets its own letter again
 *  with sent_on set — the line above the greeting says when the first went, the
 *  subject says "Reminder:" — and its Status becomes 'reminded <date>', so it is
 *  never reminded twice. Sent at is left as it was: it is the first send's date,
 *  and the reason the batch never picks the row up again. Bounded by
 *  REMIND_MAX_PER_RUN. (25 September 2026: a reminder at three to six weeks is
 *  what the FCA's letter trial found lifted response most; see CLAUDE.md.) */
function tRemind_(t, letters, cap) {
  var days = Number(TRANSITION.REMIND_DAYS) || 0;
  cap = Math.min(Number(cap) || 0, TRANSITION.REMIND_MAX_PER_RUN);
  if (cap <= 0 || days <= 0) return { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  var tz = tTz_(), now = new Date();
  var cutoff = new Date(now.getTime() - days * 86400000);
  var answered = tAnswered_();
  var due = t.rows.filter(function (r) {
    if (tHeld_(r.Exclude) || tYes_(r.Test) || !tText_(r.Segment)) return false;
    if (tText_(r.Status).toLowerCase() !== 'sent') return false;             // reminded, error, check: not again
    var at = r['Sent at'];
    if (!(at instanceof Date) || isNaN(at.getTime()) || at.getTime() > cutoff.getTime()) return false;
    var tok = tText_(r.Token);
    if (!tok || answered[tok]) return false;
    return !tHold_(r, letters);
  });
  due.sort(function (a, b) { return tOrder_(a) - tOrder_(b) || a._row - b._row; });
  var sent = 0, skipped = 0, failed = 0;
  due.slice(0, cap).forEach(function (r) {
    var row = {};
    for (var k in r) row[k] = r[k];
    row.sent_on = Utilities.formatDate(r['Sent at'], tz, 'd MMMM yyyy');
    try {
      var res = tSendRow_(row, letters);
      if (res === 'sent') { sent++; tMark_(t, r, 'reminded ' + Utilities.formatDate(now, tz, 'yyyy-MM-dd'), false); }
      else { skipped++; tMark_(t, r, 'reminder held: ' + res, false); }
    } catch (err) {
      failed++;
      tMark_(t, r, 'reminder error: ' + String(err && err.message ? err.message : err).slice(0, 100), false);
    }
    Utilities.sleep(2100);
  });
  return { sent: sent, skipped: skipped, failed: failed, waiting: Math.max(0, due.length - cap) };
}

/** Every token that has answered: a row on Client Responses, or a review whose
 *  Link ref carries it. Read once per run. Never throws: a tab that cannot be
 *  read counts nobody as answered, which reminds rather than forgets. */
function tAnswered_() {
  var map = {};
  try {
    tSheetRows_(SVC.RESP_SHEET).rows.forEach(function (v) { var tok = String(v[1] || '').trim(); if (tok) map[tok] = 1; });
  } catch (e) {}
  try {
    var q = tSheetRows_(SVC.IND_SHEET), qi = {};
    q.head.forEach(function (h, i) { qi[h] = i; });
    if (qi['Link ref'] !== undefined) q.rows.forEach(function (v) {
      var m = /^transition:(\S+)$/.exec(String(v[qi['Link ref']] || '').trim());
      if (m) map[m[1]] = 1;
    });
  } catch (e) {}
  return map;
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

/** The rows marked Test = Y, now. Ignores the hours and the live switch. Every press sends them all
 *  again: the Test rows are staff standing in as clients, and a test is run as often as the letters
 *  change (24 September, evening: the cells to clear could not be found, and the menu said "no unsent
 *  rows"), so Sent at and Status are simply overwritten. */
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
    return tYes_(r.Test) && !tHeld_(r.Exclude) && tText_(r.Segment);
  });
  if (!rows.length) return tSay_('No rows marked Test = Y.');
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
      'Agent first name': '[first name]', Agent: '[full name]', terminated_on: new Date(2026, 8, 9),
      first_year: 2014, years: 12, issue_date: new Date(2014, 2, 14),
      paid_to: new Date(2026, 7, 1), days: 52, projected_lapse: new Date(2026, 10, 30),
      app_received: new Date(2026, 8, 3), matured_on: new Date(2026, 8, 1), maturity_date: new Date(2027, 2, 1), collected_on: new Date(2026, 6, 20),
      promised_on: new Date(2026, 6, 20),
      svc_docs: 6, svc_requests: 3, svc_reminders: 8, svc_birthday: 'March 2026',
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
  var byTok = {}, byMail = {}, seg = {}, totals = { clients: 0, ready: 0, sent: 0, excluded: 0, noEmail: 0, waiting: 0, reminded: 0 };
  t.rows.forEach(function (r) {
    var s = tText_(r.Segment).toUpperCase() || '—';
    var g = seg[s] = seg[s] || { clients: 0, sent: 0, excluded: 0, waiting: 0, taps: 0, reminded: 0 };
    g.clients++; totals.clients++;
    var ex = tHeld_(r.Exclude) ? (tText_(r.Exclude) || 'held') : '';
    if (ex) { g.excluded++; totals.excluded++; if (/no e-mail/i.test(ex)) totals.noEmail++; }
    else if (tText_(r['Sent at'])) {
      g.sent++; totals.sent++;
      if (/^reminded/i.test(tText_(r.Status))) { g.reminded++; totals.reminded++; }   // the same letter went once more (tRemind_)
    }
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
    var wait = type === 'urgent' ? TRANSITION.WAIT_URGENT : TRANSITION.WAIT_DAYS;   // the branch's own targets, never shown to the client
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

/* ── the insights: what the answers say, for the digest and the Monday report ── */
/* Asked for on 25 September 2026 ("I need to have some serious insights"). The
   digest counted sends and taps; this reads what the clients said. Everything
   below is computed from the three tabs on the fly, never stored: the send
   list (who was written to, when, by which letter, from whose book), Client
   Responses (every tick and tap, with the answer in the Page column) and the
   Service Questionnaires (the reviews). Staff Test rows are never counted.
   The question words come from receipt.json on the site, so the report and
   the letters cannot disagree about what was asked. */
var T_RISK = {
  approached_yes: 'someone has already approached them',
  contact_yes: 'the terminated agent has been in touch',
  review_approached: 'said in the review that someone has been in touch about moving or replacing the policy',
  rate_better: 'rated us "could be better"',
  stay_talk: 'wants to talk it through before staying',
  contract_missing: 'the contract never reached them',
  k_stop: 'no longer wishes to proceed',
  pay_person: 'pays a representative in person',
  urgent: 'wants an agent now',
};
var T_QORDER = ['rating', 'stay', 'checkfirst', 'pays', 'contact', 'paying', 'received', 'outstanding', 'life', 'walk', 'built', 'more', 'value', 'reach', 'when'];
var T_FAMILY_FALLBACK = { T: 'notice', I: 'action', J: 'action', K: 'action', F: 'keep', R: 'keep', G: 'return', A: 'return' };

/** The Monday trigger for the insight report, within WEEKLY_HOUR, sheet time zone. */
function tWeeklyTrigger_() {
  ScriptApp.newTrigger('transitionWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(TRANSITION.WEEKLY_HOUR).inTimezone(tTz_()).create();
}

function tPct_(n, d) { return d ? Math.round(100 * n / d) : 0; }
/** A count with its verb or noun agreeing: tN_(1, 'wants', 'want') → '1 wants'. */
function tN_(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

/** Everything the reports say, cumulative and for the last `windowDays`. */
function tInsights_(windowDays) {
  var tz = tTz_(), now = new Date(), since = new Date(now.getTime() - (windowDays || 7) * 86400000);
  var t = tRead_();
  var fam = {};
  try { var man = JSON.parse(tFetch_('manifest.json')); (man.letters || []).forEach(function (L) { fam[String(L.segment).toUpperCase()] = L.family || ''; }); } catch (e) {}
  var famOf = function (seg) { return fam[seg] || T_FAMILY_FALLBACK[seg.charAt(0)] || 'other'; };
  var rc = tReceipt_();
  var qdef = (rc && rc.json && rc.json.questions) || {};
  var codeQ = {};
  Object.keys(qdef).forEach(function (k) {
    (qdef[k][1] || []).forEach(function (a) { codeQ[a[2]] = { key: k, question: qdef[k][0], label: a[0], tap: a[1] }; });
  });

  /* the send list: who was written to */
  var byTok = {}, reach = { sent: 0, sentWindow: 0, reminded: 0, failed: 0, waiting: 0, held: 0, heldReasons: {} };
  var groups = { family: {}, segment: {}, agent: {} };
  var grp = function (kind, key) {
    var o = groups[kind];
    return o[key] = o[key] || { key: key, sent: 0, answered: 0, answeredWindow: 0, approached: 0, risk: 0, stayYes: 0, stayTalk: 0 };
  };
  var nextByDay = {}, remindersDue = 0, remindDays = Number(TRANSITION.REMIND_DAYS) || 0;
  t.rows.forEach(function (r) {
    var seg = tText_(r.Segment).toUpperCase();
    if (!seg || tYes_(r.Test)) return;                                     // staff standing in as clients: never in the numbers
    if (tHeld_(r.Exclude)) {
      reach.held++;
      var why = (tText_(r.Exclude) || 'held').split(':')[0].toLowerCase();
      reach.heldReasons[why] = (reach.heldReasons[why] || 0) + 1;
      return;
    }
    var sentAt = r['Sent at'] instanceof Date && !isNaN(r['Sent at'].getTime()) ? r['Sent at'] : null;
    if (!sentAt) {
      if (/^error/i.test(tText_(r.Status))) reach.failed++; else reach.waiting++;
      var so = tDay_(r['Send on']);
      if (so && so <= Utilities.formatDate(new Date(now.getTime() + 7 * 86400000), tz, 'yyyy-MM-dd')) nextByDay[so] = (nextByDay[so] || 0) + 1;
      return;
    }
    reach.sent++;
    if (sentAt.getTime() >= since.getTime()) reach.sentWindow++;
    var rm = /^reminded (\d{4})-(\d{2})-(\d{2})/.exec(tText_(r.Status));
    if (rm) reach.reminded++;
    var o = {
      seg: seg, family: famOf(seg), agent: tText_(r.Agent) || '(no agent on the sheet)',
      client: tText_(r.Client) || tText_(r['First name']) || 'a client', sentAt: sentAt,
      remindedOn: rm ? new Date(Number(rm[1]), Number(rm[2]) - 1, Number(rm[3])) : null,
      answered: false, first: null, afterReminder: false, codes: [], taps: [], risk: [], open: false, assigned: '', lastSaid: '', lastAt: null,
    };
    var tok = tText_(r.Token);
    if (tok) byTok[tok] = o;
    grp('family', o.family).sent++; grp('segment', seg).sent++; grp('agent', o.agent).sent++;
    var age = (now.getTime() - sentAt.getTime()) / 86400000;
    if (remindDays && !rm && age >= remindDays - 7 && age < remindDays) o.dueReminder = true;
  });

  /* Client Responses: every tick and tap */
  var resp = tSheetRows_(SVC.RESP_SHEET);
  var told = {}, byType = {}, follow = { open: 0, late: 0, assignedWindow: 0, resolved: 0, replies: 0, daysToAssign: [] };
  resp.rows.forEach(function (v) {
    var tok = String(v[1] || '').trim(), o = byTok[tok];
    if (!o) return;                                                       // only this campaign's clients
    var type = String(v[3] || '').trim();
    if (!type) return;
    var received = v[0] instanceof Date ? v[0] : null;
    var m = /[?&]q=([a-z_]+)/.exec(String(v[5] || ''));
    var code = m ? m[1] : '';
    byType[type] = (byType[type] || 0) + 1;
    if (/^reply /.test(String(v[6] || ''))) follow.replies++;
    if (!o.answered || (received && o.first && received.getTime() < o.first.getTime())) { o.answered = true; o.first = received || o.first; }
    if (received && (!o.lastAt || received.getTime() > o.lastAt.getTime())) { o.lastAt = received; }
    if (o.remindedOn && received && received.getTime() > o.remindedOn.getTime()) o.afterReminder = true;
    if (code && codeQ[code]) {
      var q = codeQ[code];
      var tq = told[q.key] = told[q.key] || { key: q.key, question: q.question, n: 0, answers: {} };
      tq.n++; tq.answers[code] = (tq.answers[code] || 0) + 1;
      o.codes.push(code);
      if (code === 'stay_yes') o.stayYes = true;
      if (code === 'stay_talk') o.stayTalk = true;
      if (T_RISK[code] && o.risk.indexOf(code) < 0) o.risk.push(code);
      o.lastSaid = q.label;
    } else {
      o.taps.push(type);
      if (type === 'urgent' && o.risk.indexOf('urgent') < 0) o.risk.push('urgent');
      if (type === 'wrote' || code === 'wrote') o.lastSaid = 'wrote to us';
    }
    var isOpen = String(v[7] || '').trim().toLowerCase() === 'open';
    var assigned = String(v[8] || '').trim();
    if (type !== 'informed') {
      if (isOpen) {
        follow.open++; o.open = true;
        var wait = type === 'urgent' ? TRANSITION.WAIT_URGENT : TRANSITION.WAIT_DAYS;
        if (!assigned && received && tWorkingDays_(received, now) >= wait) follow.late++;
      } else follow.resolved++;
      if (assigned) {
        o.assigned = assigned;
        var on = v[9] instanceof Date ? v[9] : null;
        if (on && on.getTime() >= since.getTime()) follow.assignedWindow++;
        if (on && received) follow.daysToAssign.push(tWorkingDays_(received, on));
      }
    }
  });

  /* the reviews from the campaign */
  var q = tSheetRows_(SVC.IND_SHEET), qi = {};
  q.head.forEach(function (h, i) { qi[h] = i; });
  var iRef = qi['Link ref'], iTs = qi['Timestamp'], iPri = qi['Priority'], iTouch = -1, iWho = -1;
  q.head.forEach(function (h, i) {
    if (/been in touch/i.test(h) && /moving|replacing/i.test(h)) iTouch = i;
    if (/^who was it/i.test(h)) iWho = i;
  });
  var reviews = { total: 0, window: 0, urgent: 0, approached: 0, who: {} };
  q.rows.forEach(function (v) {
    var mm = iRef !== undefined ? /^transition:(\S+)$/.exec(String(v[iRef] || '').trim()) : null;
    var o = mm && byTok[mm[1]];
    if (!o) return;
    reviews.total++;
    var ts = iTs !== undefined && v[iTs] instanceof Date ? v[iTs] : null;
    if (ts && ts.getTime() >= since.getTime()) reviews.window++;
    if (iPri !== undefined && /urgent/i.test(String(v[iPri] || ''))) reviews.urgent++;
    if (!o.answered) { o.answered = true; o.first = ts; }
    if (iTouch >= 0 && /^yes/i.test(String(v[iTouch] || ''))) {
      reviews.approached++;
      if (o.risk.indexOf('review_approached') < 0) o.risk.push('review_approached');
      var who = String(iWho >= 0 ? v[iWho] || '' : '').trim() || 'not said';
      reviews.who[who] = (reviews.who[who] || 0) + 1;
    }
  });

  /* per client → the groups, the curve, the risk list */
  var response = { answered: 0, answeredWindow: 0, approached: 0, afterReminder: 0 };
  var curve = { 'the same day': 0, 'the next day': 0, 'day 2': 0, 'days 3 to 6': 0, 'days 7 to 13': 0, 'day 14 or later': 0 };
  var risk = [];
  Object.keys(byTok).forEach(function (tok) {
    var o = byTok[tok];
    if (o.dueReminder && !o.answered) remindersDue++;
    if (!o.answered) return;
    response.answered++;
    var win = o.first && o.first.getTime() >= since.getTime();
    if (win) response.answeredWindow++;
    if (o.afterReminder) response.afterReminder++;
    var appr = o.risk.indexOf('approached_yes') >= 0 || o.risk.indexOf('contact_yes') >= 0 || o.risk.indexOf('review_approached') >= 0;
    if (appr) response.approached++;
    [['family', o.family], ['segment', o.seg], ['agent', o.agent]].forEach(function (k) {
      var g = grp(k[0], k[1]);
      g.answered++; if (win) g.answeredWindow++; if (appr) g.approached++; if (o.risk.length) g.risk++;
      if (o.stayYes) g.stayYes++; if (o.stayTalk) g.stayTalk++;
    });
    if (o.first) {
      var d = Math.floor((o.first.getTime() - o.sentAt.getTime()) / 86400000);
      curve[d <= 0 ? 'the same day' : d === 1 ? 'the next day' : d === 2 ? 'day 2' : d <= 6 ? 'days 3 to 6' : d <= 13 ? 'days 7 to 13' : 'day 14 or later']++;
    }
    if (o.risk.length) {
      risk.push({ client: o.client, agent: o.agent, seg: o.seg, open: o.open, assigned: o.assigned,
                  said: o.risk.map(function (c) { return T_RISK[c] || c; }).join('; '),
                  when: o.lastAt || o.first, days: o.lastAt ? tWorkingDays_(o.lastAt, now) : 0 });
    }
  });
  risk.sort(function (a, b) { return (b.open - a.open) || ((b.when ? b.when.getTime() : 0) - (a.when ? a.when.getTime() : 0)); });
  var riskOpen = risk.filter(function (x) { return x.open; }).length;
  var list = function (kind, sortBy) {
    return Object.keys(groups[kind]).map(function (k) { var g = groups[kind][k]; g.rate = tPct_(g.answered, g.sent); return g; })
      .filter(function (g) { return g.sent; }).sort(sortBy);
  };
  var toldList = T_QORDER.concat(Object.keys(told).filter(function (k) { return T_QORDER.indexOf(k) < 0; }))
    .filter(function (k) { return told[k]; })
    .map(function (k) {
      var tq = told[k];
      var answers = (qdef[k] ? qdef[k][1] : []).map(function (a) { return { label: a[0], code: a[2], tap: a[1], n: tq.answers[a[2]] || 0, pct: tPct_(tq.answers[a[2]] || 0, tq.n) }; });
      return { key: k, question: tq.question, n: tq.n, answers: answers };
    });
  var med = follow.daysToAssign.slice().sort(function (a, b) { return a - b; });
  follow.medianDays = med.length ? med[Math.floor(med.length / 2)] : null;
  var days = Object.keys(nextByDay).sort().map(function (d) { return { day: d, n: nextByDay[d] }; });

  /* what it means, in sentences, only where there is something to say */
  var lines = [];
  var told1 = function (key, code) { return told[key] && told[key].answers[code] || 0; };
  if (!reach.sent) lines.push('No letter has gone to a client yet.');
  else if (!response.answered) lines.push(reach.sent + ' letters have gone and no client has answered yet. The first answers usually come the same day; the reminder goes by itself after ' + remindDays + ' days.');
  else {
    var early = curve['the same day'] + curve['the next day'];
    lines.push(response.answered + ' of the ' + reach.sent + ' clients written to have answered (' + tPct_(response.answered, reach.sent) + '%)' +
      (response.answeredWindow ? ', ' + response.answeredWindow + ' of them in the last ' + (windowDays || 7) + ' days' : '') +
      (early ? '; ' + tPct_(early, response.answered) + '% of first answers came within a day of the letter.' : '.'));
    if (response.approached) {
      var top = list('agent', function (a, b) { return b.approached - a.approached; })[0];
      lines.push(response.approached + ' client' + (response.approached === 1 ? '' : 's') + ' say' + (response.approached === 1 ? 's' : '') +
        ' someone has already approached them' + (told1('contact', 'contact_yes') ? ', or that the terminated agent has been in touch' : '') +
        (top && top.approached ? ' — the most from ' + top.key + '\'s former book (' + top.approached + ')' : '') + '. Each is a call before anything else.');
    }
    if (told.rating) {
      var good = told1('rating', 'rate_verywell') + told1('rating', 'rate_well');
      lines.push('Of ' + told.rating.n + ' who rated us, ' + tPct_(good, told.rating.n) + '% said very well or well; ' + told1('rating', 'rate_better') + ' said could be better.');
    }
    if (told.pays) lines.push(tN_(told1('pays', 'pays_confirm'), 'wants', 'want') + ' us to confirm who their policy pays (' + tPct_(told1('pays', 'pays_confirm'), told.pays.n) + '% of those asked); ' + tN_(told1('pays', 'pays_known'), 'already knows.', 'already know.'));
    if (told.stay) lines.push(tN_(told1('stay', 'stay_yes'), 'wants', 'want') + ' the branch team to keep looking after their policy; ' + tN_(told1('stay', 'stay_talk'), 'wants', 'want') + ' to talk it through first.');
    if (told.checkfirst) lines.push(tN_(told1('checkfirst', 'checkfirst_yes'), 'wants', 'want') + ' any change checked with us first, free; ' + told1('checkfirst', 'checkfirst_no') + ' will decide ' + (told1('checkfirst', 'checkfirst_no') === 1 ? 'alone.' : 'themselves.'));
    if (told.received && told1('received', 'contract_missing')) lines.push(tN_(told1('received', 'contract_missing'), 'says', 'say') + ' their policy contract never reached them: a delivery each, within the week.');
    if (told.outstanding) lines.push(tN_(told1('outstanding', 'k_outstanding'), 'wants', 'want') + ' help to finish their application; ' + tN_(told1('outstanding', 'k_stop'), 'no longer wishes', 'no longer wish') + ' to proceed.');
    if (told.paying && told1('paying', 'pay_person')) lines.push(tN_(told1('paying', 'pay_person'), 'still pays', 'still pay') + ' a representative in person: each one is set up to pay Guardian Life directly.');
    if (reviews.total) lines.push(reviews.total + ' full review' + (reviews.total === 1 ? '' : 's') + ' filed' + (reviews.urgent ? ', ' + reviews.urgent + ' urgent' : '') + (reviews.approached ? '; ' + reviews.approached + ' name an approach about moving or replacing the policy' : '') + '.');
    if (follow.open) lines.push(tN_(follow.open, 'answer is', 'answers are') + ' still open' + (follow.late ? ', ' + follow.late + ' of them past ' + TRANSITION.WAIT_DAYS + ' working days with nobody named' : '') +
      (follow.medianDays !== null ? '; a name goes on ' + (follow.medianDays === 0 ? 'the same working day' : 'within ' + tN_(follow.medianDays, 'working day', 'working days')) + ' (median)' : '') + '.');
    if (reach.reminded) lines.push(tN_(reach.reminded, 'reminder has', 'reminders have') + ' gone; ' + response.afterReminder + ' of those clients answered after it.');
  }
  if (reach.failed) lines.push(tN_(reach.failed, 'letter failed to send and is', 'letters failed to send and are') + ' retried the next day; the reason is in ' + (reach.failed === 1 ? 'its' : 'their') + ' Status cell.');

  return {
    at: Utilities.formatDate(now, tz, 'd MMM yyyy HH:mm'), day: Utilities.formatDate(now, tz, 'd MMMM yyyy'), windowDays: windowDays || 7, tz: tz,
    reach: reach, response: response, rate: tPct_(response.answered, reach.sent), curve: curve, told: toldList, byType: byType,
    reviews: reviews, follow: follow, risk: risk.slice(0, 40), riskTotal: risk.length, riskOpen: riskOpen,
    byFamily: list('family', function (a, b) { return b.sent - a.sent; }),
    bySegment: list('segment', function (a, b) { return a.key < b.key ? -1 : 1; }),
    byAgent: list('agent', function (a, b) { return (b.approached - a.approached) || (b.risk - a.risk) || (b.sent - a.sent); }),
    next: { days: days, remindersDue: remindersDue }, lines: lines, armed: tArmed_(),
  };
}

/** The report as an e-mail: tiles, what it means, then the tables. Inline
 *  styles only, so Gmail and Outlook show it. `weekly` adds every table;
 *  the digest shows the tiles and the sentences. */
function tInsightHtml_(a, weekly) {
  var F = 'Arial,sans-serif', esc = tEsc_;
  var h3 = function (s, c) { return '<h3 style="font:800 15px ' + F + ';color:' + (c || '#12202e') + ';margin:20px 0 6px">' + s + '</h3>'; };
  var tile = function (n, label) {
    return '<td style="padding:10px 14px;background:#f4f8fa;border-radius:8px;vertical-align:top"><div style="font:800 24px/1 ' + F + ';color:#12202e">' + n +
      '</div><div style="font:600 11px/1.3 ' + F + ';color:#64798e;text-transform:uppercase;letter-spacing:.08em;margin-top:4px">' + label + '</div></td><td style="width:8px"></td>';
  };
  var table = function (head, rows) {
    if (!rows.length) return '<p style="margin:0;color:#64798e">Nothing yet.</p>';
    return '<table cellpadding="5" cellspacing="0" style="border-collapse:collapse;font:13px ' + F + ';color:#33465a;width:100%">' +
      '<tr>' + head.map(function (h) { return '<th style="text-align:left;border-bottom:2px solid #d7e3ea;color:#12202e;font-size:12px">' + h + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td style="border-bottom:1px solid #e0eaef;vertical-align:top">' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  };
  var bar = function (pct) { return '<div style="background:#e6eef3;border-radius:4px;height:8px;width:120px"><div style="background:#0aa8bf;border-radius:4px;height:8px;width:' + Math.max(2, Math.round(1.2 * pct)) + 'px"></div></div>'; };
  var out = '<div style="font:15px/1.5 ' + F + ';color:#33465a;max-width:680px">' +
    '<h2 style="font:800 20px ' + F + ';color:#12202e;margin:0 0 4px">' + (weekly ? 'Transition: the week to ' + esc(a.day) : 'Transition: ' + esc(a.at)) + '</h2>' +
    '<p style="margin:0 0 14px;color:#64798e">' + (weekly ? 'What went, what came back, what the clients told us, and where to act. Every number is from the sheet at ' + esc(a.at) + '.' : 'Sends, answers and what they mean. The live page has the detail.') + '</p>' +
    (a.armed ? '' : '<p style="margin:0 0 14px;padding:10px 14px;background:#fdeeea;border-left:4px solid #b3261e;color:#8a3324"><b>The hourly send is off.</b> Nothing sends until Service Questionnaire &rarr; Transition: go live.</p>') +
    '<table cellpadding="0" cellspacing="0"><tr>' + tile(a.reach.sent, 'letters sent') + tile(a.response.answered, 'clients answered') + tile(a.rate + '%', 'response') +
    tile(a.riskOpen, 'to act on') + tile(a.reviews.total, 'reviews') + '</tr></table>' +
    h3('What it means') + '<ul style="margin:0;padding-left:20px">' + a.lines.map(function (l) { return '<li style="margin:4px 0">' + esc(l) + '</li>'; }).join('') + '</ul>';
  if (!weekly) return out + '</div>';
  out += h3('By family') + table(['Family', 'Sent', 'Answered', 'Response', 'Approached', 'Stay: yes / talk'], a.byFamily.map(function (g) {
    return [esc(g.key), g.sent, g.answered, g.rate + '%', g.approached, g.stayYes + ' / ' + g.stayTalk]; }));
  out += h3('By letter') + table(['Letter', 'Sent', 'Answered', 'Response', 'Approached', 'At risk'], a.bySegment.map(function (g) {
    return ['<b>' + esc(g.key) + '</b>', g.sent, g.answered, g.rate + '%', g.approached, g.risk]; }));
  out += h3('What the clients told us') + (a.told.length ? a.told.map(function (q) {
    return '<p style="margin:12px 0 4px;font-weight:700;color:#12202e">' + esc(q.question) + ' <span style="font-weight:400;color:#64798e">(' + q.n + ' answered)</span></p>' +
      '<table cellpadding="3" cellspacing="0" style="font:13px ' + F + ';color:#33465a">' + q.answers.map(function (x) {
        return '<tr><td style="padding-right:10px">' + esc(x.label) + '</td><td style="padding-right:10px"><b>' + x.n + '</b></td><td style="padding-right:10px">' + x.pct + '%</td><td>' + bar(x.pct) + '</td></tr>'; }).join('') + '</table>';
  }).join('') : '<p style="margin:0;color:#64798e">No answers yet.</p>');
  out += h3('By former book: where the approaches are') + table(['Former agent', 'Sent', 'Answered', 'Response', 'Approached', 'At risk'], a.byAgent.map(function (g) {
    return [esc(g.key), g.sent, g.answered, g.rate + '%', g.approached, g.risk]; }));
  var ck = Object.keys(a.curve);
  out += h3('When the first answer comes, from the day the letter went') + table(['After', 'Clients'], ck.map(function (k) { return [k, a.curve[k]]; }));
  out += h3('Taps, by type') + '<p style="margin:0">' + (Object.keys(a.byType).map(function (k) { return esc(k) + ' ' + a.byType[k]; }).join(' &middot; ') || 'none yet') +
    (a.follow.replies ? ' &middot; ' + a.follow.replies + ' filed from replies' : '') + '</p>';
  out += h3('Follow-through') + '<p style="margin:0">' + a.follow.open + ' open &middot; ' + a.follow.late + ' past ' + TRANSITION.WAIT_DAYS + ' working days with nobody named &middot; ' +
    a.follow.assignedWindow + ' assigned in the last ' + a.windowDays + ' days &middot; ' + a.follow.resolved + ' resolved' +
    (a.follow.medianDays !== null ? ' &middot; median ' + a.follow.medianDays + ' working day' + (a.follow.medianDays === 1 ? '' : 's') + ' to a name' : '') +
    ' &middot; reviews: ' + a.reviews.total + (a.reviews.urgent ? ' (' + a.reviews.urgent + ' urgent)' : '') +
    (a.reviews.approached ? ' &middot; ' + a.reviews.approached + ' review' + (a.reviews.approached === 1 ? '' : 's') + ' name an approach: ' +
      esc(Object.keys(a.reviews.who).map(function (w) { return w + ' ' + a.reviews.who[w]; }).join(', ')) : '') + '</p>';
  out += h3('To act on: clients who said something that needs a person' + (a.riskTotal > a.risk.length ? ' (first ' + a.risk.length + ' of ' + a.riskTotal + ')' : ''), '#b3261e') +
    table(['Client', 'Former agent', 'Letter', 'What they said', 'Waiting', 'Assigned to'], a.risk.map(function (x) {
      return [esc(x.client), esc(x.agent), esc(x.seg), esc(x.said), x.open ? x.days + ' working day' + (x.days === 1 ? '' : 's') : 'resolved', esc(x.assigned) || '<span style="color:#b3261e">nobody</span>']; }));
  out += h3('Next 7 days') + '<p style="margin:0">' + (a.next.days.length ? a.next.days.map(function (d) { return esc(d.day) + ': ' + d.n + ' letters'; }).join(' &middot; ') : 'no letters waiting with a date') +
    ' &middot; ' + a.next.remindersDue + ' reminders due' + ' &middot; ' + a.reach.waiting + ' waiting in all' + (a.reach.failed ? ' &middot; ' + a.reach.failed + ' failed, retried tomorrow' : '') +
    ' &middot; ' + a.reach.held + ' held back (' + esc(Object.keys(a.reach.heldReasons).map(function (k) { return k + ' ' + a.reach.heldReasons[k]; }).join(', ')) + ')</p>';
  return out + '</div>';
}

/** The Monday report: a week of answers, read for what they mean. Safe to run by hand. */
function transitionWeekly() {
  var to = TRANSITION.WEEKLY_TO || TRANSITION.DIGEST_TO || Session.getEffectiveUser().getEmail();
  var a;
  try { a = tInsights_(7); }
  catch (err) {
    var why = String(err && err.message ? err.message : err);
    log_('transition', 'weekly-failed', why);
    MailApp.sendEmail(to, 'Transition weekly: could not read the sheet', why, { name: TRANSITION.FROM_NAME });
    return tSay_('weekly report not sent: ' + why);
  }
  var subject = 'Transition, week to ' + a.day + ': ' + a.reach.sent + ' sent, ' + a.response.answered + ' answered (' + a.rate + '%), ' +
    a.riskOpen + ' to act on';
  MailApp.sendEmail(to, subject, 'Open in a mail app that shows HTML.',
    { htmlBody: tInsightHtml_(a, true) + '<p style="font:12px Arial,sans-serif;color:#64798e;margin-top:18px">' + tEsc_(tInternal_(tReceipt_())) + '</p>', name: TRANSITION.FROM_NAME });
  log_('transition', 'weekly', subject);
  return tSay_('Weekly report sent to ' + to);
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
  /* what the answers mean, over the last day: the same sentences the Monday report opens on */
  var insight = '';
  try { var a = tInsights_(1); insight = tInsightHtml_(a, false).replace(/^<div[^>]*>[\s\S]*?<\/table>/, '').replace(/<\/div>$/, ''); }
  catch (e) { insight = '<p style="color:#8a3324">The insight block could not be built: ' + tEsc_(String(e && e.message ? e.message : e)) + '</p>'; }
  var html = '<div style="font:15px/1.5 Arial,sans-serif;color:#33465a;max-width:640px">' +
    '<h2 style="font:800 20px Arial,sans-serif;color:#12202e;margin:0 0 4px">Transition — ' + s.at + '</h2>' +
    '<p style="margin:0 0 14px;color:#64798e">Sends, taps, reviews and verdicts. The live page has the detail; the Monday report reads the answers.</p>' +
    (s.armed ? '' : '<p style="margin:0 0 14px;padding:10px 14px;background:#fdeeea;border-left:4px solid #b3261e;color:#8a3324">' +
      '<b>The hourly send is off.</b> The Test rows still go by hand; nothing else sends until Service Questionnaire &rarr; Transition: go live.</p>') +
    '<table cellpadding="0" cellspacing="0"><tr>' + tile(s.totals.sent, 'letters sent') + tile(s.totals.waiting, 'waiting') +
    tile(s.taps.total, 'taps') + tile(s.reviews.total, 'reviews') + tile(s.taps.late.length, 'late') + '</tr></table>' +
    insight +
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
    rows(s.runs, ['when', 'event', 'detail']) +
    '<p style="font:12px Arial,sans-serif;color:#64798e;margin-top:18px">' + tEsc_(tInternal_(tReceipt_())) + '</p></div>';
  MailApp.sendEmail(to, 'Transition: ' + s.totals.sent + ' sent, ' + s.taps.total + ' taps, ' + s.reviews.total +
    ' reviews' + (s.taps.late.length ? ', ' + s.taps.late.length + ' late' : ''), 'Open in a mail app that shows HTML.',
    { htmlBody: html, name: TRANSITION.FROM_NAME });
  return 'digest sent to ' + to;
}
