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
 *   transitionSetup()        once — the tab and the 8:00 digest; the send stays off
 *   transitionPreviewToMe()  one of each letter to your own inbox
 *   transitionSendTest()     the rows marked Test = Y, now, whatever the hour
 *   transitionGoLive()       the send, on — once the test rows have been checked
 *   transitionPause()        the send, off; the test rows still go by hand
 *   transitionSendBatch()    what the send trigger runs; safe to run by hand — the day's new letters, then the
 *                            rows ticked in the "Send again" column (tSendAgain_), then (tRemind_) the same letter
 *                            once more to anyone unanswered after REMIND_DAYS
 *   transitionDigest()       the morning e-mail (DIGEST_HOURS); safe to run by hand
 *   transitionWeekly()       the Monday insight report (WEEKLY_HOUR): what the answers mean; safe to run by hand
 *   transitionSetBookSource() the Branch Portfolio's link, once (menu); then transitionBuildClientBook() every
 *                            morning writes each client's policies to the Client Book tab for the board and the briefs
 *   transitionClaimsStart()  the go for the TT$200 retention claims (T_CLAIM): a questionnaire from a client named to an
 *                            agent is e-mailed to the Retention unit, and the unpaid are listed every Monday until Salesforce
 *                            has the payment date; transitionClaimsNow() checks at once, transitionClaimsMondayNow() sends
 *                            the Monday list today, transitionClaimsStop() holds them again
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
 * and checked, and the run sends nothing. A row with no Send on date
 * is held, not sent now; a row the sender cannot use (no e-mail, no first
 * name, no letter for its segment) is moved to Exclude with the reason, so
 * it leaves the queue for someone to fix rather than being tried every run.
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
  BATCH: 120,                // the most one run will send: 120 × PACE_MS is four and a half minutes, inside the six a run is allowed
  SEND_EVERY_MIN: 30,        // how often the send runs inside HOURS: 1, 5, 10, 15, 30, or 60 for once an hour.
                             // 25 September 2026, the manager's numbers: "the run should be every 30 mins", and
                             // "all to go out in batches today" — 120 every half hour is a day's list in a day
  PACE_MS: 2150,             // the least time from one letter to the next: Microsoft 365 takes thirty a minute from one mailbox
  RUN_BUDGET_MS: 300000,     // a run stops sending after five minutes and leaves the rest to the next run: Apps Script kills a run at
                             // six, and a killed run writes no log line and shows no alert (the first batch of 25 September 2026 died
                             // that way at 106 letters, after holding 95 same-address rows first — every sent row was stamped, nothing was lost)
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
  CHASE_MAX_PER_RUN: 40,     // the most "still on it" notes one chase run sends, whatever the backlog — see tChase_
  HOLD_CLIENT_MAIL: true,    // 28 September: nothing automatic goes to a client until the manager says so — transitionReleaseClientMail is the go
  /* 7 October 2026, after an introduction went to a client while an agent was being trained on the board: "hold off all
     auto email for now please!", then "yes" to the hold stopping the receipts and the introductions too. Until then a
     client who answered a letter already sent was thanked whatever the hold (the manager, 28 September). */
  HOLD_RECEIPTS: true,       // while held, the receipt waits and goes after the go (answers under fourteen days old)
  HOLD_INTROS: true,         // while held, naming an agent sends the agent's brief and no introduction to the client
  RECEIPT_WAIT_MIN: 15,      // a receipt goes this many minutes after the client's last tap, so it can recap all of them
                             // (3 until 6 October 2026: with one receipt per client it has to gather a slow reader's taps too)
  RECEIPT_FORM_WAIT_MIN: 30, // and waits this long for the review when a tap opened the form, so it can recap that too
  /* Three automatic e-mails, then a person (6 October 2026, the manager: "a human interaction after the third …
     you don't want to irritate clients with automated emails right through"). A client gets the letter, one
     reminder if they do not answer, and one receipt when they do. Nothing else is sent by a machine: a client who
     answers again after their receipt is listed for a person (tReceipts_), and the "still on it" note is no longer
     sent by the chase but pressed on the assignment board, once, by a person who has read the file (tStillClient_).
     The introduction when an agent is named, the manager's notes and the questionnaire's own confirmation are a
     person's press or the client's own request, and stand. */
  ONE_RECEIPT_PER_CLIENT: true,
  STILL_NOTE_AUTO: false,
  RECEIPT_MAX_PER_RUN: 30,   // the most one five-minute run will send
  INBOX_DAYS: 3,             // how far back the inbox reader looks for replies (transitionInbox, every five minutes)
  REMIND_DAYS: 5,            // a letter unanswered this long goes once more, with a line saying when the first went (tRemind_); 0 turns it off.
                             // 21 until 29 September 2026, when the manager asked for the follow-up "in about five days from the date it was sent"
  REMIND_MAX_PER_RUN: 120,   // the most reminders one run adds, after the day's new letters and inside the same BATCH
  /* who signs the receipts — the team, never an individual — used only when the
     site cannot be fetched: receipt.json beside the letters is the word */
  CARE: { name: 'Client Support Team', us: 'our Client Support team', Us: 'Our Client Support team',
          line: 'Ricky Rampersad Branch · Guardian Life of the Caribbean' },
  /* who signs the note the board sends after a call (T_NOTES): the manager, in his own name */
  MANAGER: { name: 'Ricky Rampersad', title: 'Branch Manager' },
};

/* The switch the send is behind. transitionGoLive sets it, transitionPause
   clears it; until it is set the trigger runs and sends nothing. */
var T_LIVE = 'transition_live';
var T_HOLD = 'client_mail_hold';   // 'on' or 'off' once pressed; unset, HOLD_CLIENT_MAIL decides

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
  if (T_READ_ONCE && T_READ_ONCE.send) return T_READ_ONCE.send;   // a board request reads the tab once (transitionBoard_)
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
  var out = { sh: sh, col: col, rows: rows };
  if (T_READ_ONCE) T_READ_ONCE.send = out;
  return out;
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
    if (f === 'transitionDigest' || f === 'transitionReceipts' || f === 'transitionInbox' || f === 'transitionWeekly' || f === 'transitionBuildClientBook') ScriptApp.deleteTrigger(t);
  });
  TRANSITION.DIGEST_HOURS.forEach(function (h) {
    ScriptApp.newTrigger('transitionDigest').timeBased().inTimezone(tTz_()).atHour(h).everyDays(1).create();
  });
  /* the replies and the receipts: every five minutes, whether or not the send is on, because letters already out earn them */
  ScriptApp.newTrigger('transitionInbox').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('transitionReceipts').timeBased().everyMinutes(5).create();
  tWeeklyTrigger_();
  /* the Client Book's morning build, once the Branch Portfolio's link is set (transitionSetBookSource) */
  if (PropertiesService.getScriptProperties().getProperty(T_BOOK.PROP)) tBookTrigger_();
  var msg = '"' + TRANSITION.SHEET + '" is ready and the digest is installed for ' +
    TRANSITION.DIGEST_HOURS.map(function (h) { return h + ':00'; }).join(' and ') +
    ', the weekly insight report for Monday ' + TRANSITION.WEEKLY_HOUR + ':00, and the replies are read and the receipts sent every five minutes' +
    (PropertiesService.getScriptProperties().getProperty(T_BOOK.PROP) ? '; the Client Book rebuilds every morning at ' + T_BOOK.HOUR + ':00' : '') + '. ' +
    'The send stays off until Transition: go live. Import the send list into the tab, run ' +
    'transitionPreviewToMe, then transitionSendTest, read what arrived and check the Exclude column, then go live.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/** The send, on. Only after the preview and the Test rows have been
 *  read and the Exclude column checked: from the next weekday run inside
 *  HOURS the trigger sends up to BATCH real letters a run, every
 *  SEND_EVERY_MIN minutes. Safe to press again: the send trigger is always
 *  set to the configured cadence, so a change to SEND_EVERY_MIN is a paste
 *  and this press, never a second trigger running beside the first. */
function transitionGoLive() {
  PropertiesService.getScriptProperties().setProperty(T_LIVE, 'yes');
  tSendTrigger_();
  var have = {};
  ScriptApp.getProjectTriggers().forEach(function (t) { have[t.getHandlerFunction()] = true; });
  if (!have.transitionInbox) ScriptApp.newTrigger('transitionInbox').timeBased().everyMinutes(5).create();
  if (!have.transitionReceipts) ScriptApp.newTrigger('transitionReceipts').timeBased().everyMinutes(5).create();
  if (!have.transitionWeekly) tWeeklyTrigger_();
  if (!have.transitionBuildClientBook && PropertiesService.getScriptProperties().getProperty(T_BOOK.PROP)) tBookTrigger_();
  var msg = 'Live. The send is on: up to ' + TRANSITION.BATCH + ' letters ' + tCadence_() + ', ' +
    TRANSITION.HOURS[0] + ':00 to ' + TRANSITION.HOURS[1] + ':00, Monday to Friday. Transition: pause turns it off.';
  log_('transition', 'live', msg);
  return tSay_(msg);
}

/** The send trigger at the configured cadence, and only that one: every
 *  transitionSendBatch trigger goes first. everyMinutes takes 1, 5, 10, 15 or
 *  30; anything else on SEND_EVERY_MIN falls back to ten, and 60 or more is
 *  hours. */
function tSendTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'transitionSendBatch') ScriptApp.deleteTrigger(t);
  });
  var m = Number(TRANSITION.SEND_EVERY_MIN) || 60;
  var b = ScriptApp.newTrigger('transitionSendBatch').timeBased();
  if (m >= 60) b.everyHours(Math.max(1, Math.round(m / 60))).create();
  else b.everyMinutes([1, 5, 10, 15, 30].indexOf(m) >= 0 ? m : 10).create();
}

/** The cadence in words, for the go-live alert and the page. */
function tCadence_() {
  var m = Number(TRANSITION.SEND_EVERY_MIN) || 60;
  if (m >= 60) { var h = Math.max(1, Math.round(m / 60)); return h === 1 ? 'every hour' : 'every ' + h + ' hours'; }
  return 'every ' + ([1, 5, 10, 15, 30].indexOf(m) >= 0 ? m : 10) + ' minutes';
}

/** The send, off: the switch cleared and the trigger removed. The Test
 *  rows still send by hand. */
function transitionPause() {
  PropertiesService.getScriptProperties().deleteProperty(T_LIVE);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'transitionSendBatch') ScriptApp.deleteTrigger(t);
  });
  var msg = 'Paused. Test rows still send by hand; the run sends nothing.';
  log_('transition', 'paused', msg);
  return tSay_(msg);
}

/** Whether the send is on — the switch set and the trigger installed —
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
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }   // the editor's Run button has no alert: the execution log
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
  /* a projected lapse date already gone by, on a policy the sheet still carries
     as in force, is a projection that did not happen: cut, so the fact goes and
     Paid to and Days outstanding still print (25 September 2026: 88 rows on the
     first day's list carried one, the oldest from 2012 — "Projected lapse
     18 August 2012" is not a fact a client can use) */
  if (Number(tDays_(out.projected_lapse)) > 0) out.projected_lapse = '';
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
  /* the same letter once more (tRemind_, tSendAgain_): "Reminder:" in place of the notice's "Important:", never both */
  if (tText_(row.sent_on)) subject = 'Reminder: ' + subject.replace(/^Important:\s*/i, '');
  var html = tFill_(L.html, row);
  /* A field this script does not know goes out as {{name}} in the client's own
     letter. That means the letters on the site are newer than this file: stop
     the run rather than send one, and paste the current Transition.gs. */
  var left = (subject + html).match(/\{\{\w+\}\}/);
  if (left) throw new Error('Letter ' + seg + ' carries ' + left[0] + ', which this script cannot fill: paste the current Transition.gs. Nothing was sent.');
  tMsSend_(tText_(row.Email), subject, html, tClientOpts_());
  return 'sent';
}

/** Token for a row that came in without one, written back before the send, on the row where it still is (tAt_). */
function tEnsureToken_(t, row) {
  if (tText_(row.Token)) return;
  var n = tAt_(t, row);
  var tok = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  t.sh.getRange(n, t.col.Token).setValue(tok);
  row.Token = tok;
}

/** The sheet row a send row is on now. A run reads the tab once and writes back by row number, and a person may
 *  sort the tab in between: on 30 September 2026 it was found sorted by Sent at, every row moved. A Sent at written
 *  by the old number would land on another client: the client just sent would still read unsent and be sent the
 *  letter again, and someone else would read sent without ever having had it. So the row's own Token is checked
 *  before every write, and when it has moved, the Token column is read once more and every row of the run found
 *  again by its token. A row with no token yet (tEnsureToken_ gives it one before its letter) is written only where
 *  it was read, while its token cell is still empty and its e-mail the same. Throws when the row cannot be found,
 *  so nothing is ever written to another client; the run stops and the next one reads the tab afresh. */
function tAt_(t, row) {
  var tok = tText_(row.Token), c = t.col.Token;
  if (!c) return row._row;
  if (!tok) {
    var tokHere = String(t.sh.getRange(row._row, c).getValue() || '').trim();
    var mailHere = t.col.Email ? String(t.sh.getRange(row._row, t.col.Email).getValue() || '').trim().toLowerCase() : '';
    if (!tokHere && mailHere === tText_(row.Email).toLowerCase()) return row._row;
    throw new Error(TRANSITION.SHEET + ' moved under a row with no token (' + (tText_(row.Client) || 'a client') + '): nothing written for it this run.');
  }
  if (String(t.sh.getRange(row._row, c).getValue() || '').trim() === tok) return row._row;
  var last = t.sh.getLastRow(), at = {};
  (last >= 2 ? t.sh.getRange(2, c, last - 1, 1).getValues() : []).forEach(function (v, i) {
    var k = String(v[0] || '').trim();
    if (k && !at[k]) at[k] = i + 2;
  });
  t.rows.forEach(function (r) { var k = tText_(r.Token); if (k && at[k]) r._row = at[k]; });
  if (!at[tok]) throw new Error('The row for token ' + tok + ' is no longer on ' + TRANSITION.SHEET + ': nothing written for it.');
  row._row = at[tok];
  log_('transition', 'rows-moved', TRANSITION.SHEET + ' was sorted or had rows added while a run was going: rows found again by token');
  return row._row;
}

/* The columns are checked by tRead_ before any of this runs, so a write that
   fails here throws and stops the run — it never skips quietly and lets the
   same rows send again next hour. The row is found by its token first (tAt_),
   so a tab sorted in the middle of a run is marked on the right clients. */
function tMark_(t, row, status, sent) {
  var n = tAt_(t, row);
  if (sent) t.sh.getRange(n, t.col['Sent at']).setValue(new Date());
  t.sh.getRange(n, t.col.Status).setValue(status);
  return n;
}

/** A row the sender cannot use leaves the queue: the reason goes into Exclude,
 *  where tSummary_ counts it under 'held back', and into Status. Clearing the
 *  Exclude cell after the fix puts the row back. */
function tHoldRow_(t, row, why) {
  var n = tMark_(t, row, why, false);
  t.sh.getRange(n, t.col.Exclude).setValue(why);
  row.Exclude = why;
}

/** Send these rows with these letters. The letters were fetched before this
 *  was called, outside any per-row try, so a site that does not answer stops
 *  the run instead of marking sixty rows 'error' and pushing them all to
 *  tomorrow. Only a mail failure is retried tomorrow. */
function tSendRows_(t, rows, letters, deadline) {
  var sent = 0, skipped = 0, failed = 0, left = 0;
  for (var i = 0; i < rows.length; i++) {
    /* the time budget: what is not reached is simply not touched, and the next run takes it */
    if (deadline && Date.now() > deadline) { left = rows.length - i; break; }
    var row = rows[i];
    var t0 = Date.now(), tried = true;
    try {
      tEnsureToken_(t, row);
      var res = tSendRow_(row, letters);
      if (res === 'sent') { sent++; tMark_(t, row, 'sent', true); }
      else { skipped++; tried = false; tHoldRow_(t, row, res); }   // held before the mailbox saw it: no wait for it
    } catch (err) {
      var why = String(err && err.message ? err.message : err);
      if (/invalid email|InvalidRecipients/i.test(why)) {
        /* the address passed the shape test and the mail server still refused it: for the manager, not for tomorrow */
        skipped++; tHoldRow_(t, row, 'no e-mail: ' + why.slice(0, 100));
      } else {
        failed++;
        var n = tMark_(t, row, 'error: ' + why.slice(0, 120), false);
        /* try again tomorrow, not every hour */
        var tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        t.sh.getRange(n, t.col['Send on']).setValue(Utilities.formatDate(tmr, tTz_(), 'yyyy-MM-dd'));
      }
    }
    if (tried) tPace_(t0);
  }
  return { sent: sent, skipped: skipped, failed: failed, left: left };
}

/** The gap between two letters: Microsoft 365 takes thirty a minute from one
 *  mailbox, so a letter never follows the last inside PACE_MS — counted from
 *  when the last began, so the send's own time is part of the gap rather than
 *  added after it. (25 September 2026: that is a quarter of an hour over a
 *  day's list, out of the ninety minutes a day a consumer Google account
 *  allows its triggers in all; a run started from the menu is not counted.) */
function tPace_(t0) {
  var rest = (Number(TRANSITION.PACE_MS) || 2100) - (Date.now() - t0);
  if (rest > 0) Utilities.sleep(rest);
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

/* ── replies the address alone cannot place (30 September 2026) ──────
   "All responses must have the trail." Until then a reply from an address the
   send tab does not hold, or from an inbox two clients share, was passed over
   in silence. One client asked from a work address to cancel an application, and
   nothing was filed and nothing thanked her. Another asked twice on 25 September
   "Can you call me now?" from an inbox shared with a relative. A reply to one of our own e-mails (T_OUR_SUBJECT) is now placed by
   the first name it greets ("Dear X," in the quoted letter, "Thank you, X." or
   "Still on it, X." in the subject). Among clients at a shared inbox, that name
   is enough. From an address we do not hold, the former agent the subject names
   must agree as well. One client left is filed as theirs; none or several go on
   the Replies to match tab with the clients it could be. A person types the
   token there and the next run files it. Mail from our own domains is never
   taken for a client's reply: a colleague answering a client on the thread is
   not the client. */
var T_OUR_SUBJECT = /^\s*(?:(?:re|fw|fwd)\s*:\s*)+.*(?:important:|reminder:|thank you,|still on it|has resigned|has moved on|no longer with guardian|meet your agent)/i;
var T_OUR_DOMAINS = /@(?:[\w-]+\.)*(?:myguardiangroup\.com|rickyrampersadbranch\.com|guardianonline\.onmicrosoft\.com)$/i;
/* The reference at the foot of the follow-up note (tChaseClient_), quoted beneath a reply from any address. */
var T_YOUR_REF = /Your reference:\s*([A-Za-z0-9_-]{6,64})/;
var T_MATCH_TAB = 'Replies to match';
var T_MATCH_HEAD = ['Received', 'From', 'Subject', 'Their words', 'Could be', 'Token (type it to file)', 'Filed', 'Message id'];

/** Which client a reply to our own mail is from, when the address alone cannot say. */
function tGuessClient_(subject, text, from, tokens, shared) {
  var names = {}, m, re = /\bdear\s+([A-Za-z][A-Za-z'\-]+)\s*,/gi;
  while ((m = re.exec(String(text || '')))) names[m[1].toLowerCase()] = 1;
  var bare = String(subject || '').replace(/^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i, '');
  var s = /(?:thank you|still on it),\s*([A-Za-z][A-Za-z'\-]+)/i.exec(bare);
  if (s) names[s[1].toLowerCase()] = 1;
  var atShared = shared[from] && shared[from].length > 1;
  var ag = /^(?:(?:important|reminder)\s*:\s*)?([A-Za-z][A-Za-z'\-]+)\s+has\s+(?:resigned|moved on)/i.exec(bare);
  var agFull = /agent\s+([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+)*)\s+is no longer/.exec(bare);
  var pool = atShared ? shared[from] : Object.keys(tokens);
  var cands = pool.filter(function (t) {
    var r = tokens[t];
    if (!r || tYes_(r.Test) || !names[tText_(r['First name']).toLowerCase()]) return false;
    if (atShared) return true;                                         // the inbox is theirs: the name decides
    if (ag) return tText_(r['Agent first name']).toLowerCase() === ag[1].toLowerCase();
    if (agFull) return tText_(r.Agent).toLowerCase() === agFull[1].toLowerCase();
    return true;                                                       // a stranger's address and no book named: listed, never filed
  });
  var sure = cands.length === 1 && (atShared || ag || agFull);
  return { token: sure ? cands[0] : '', candidates: cands.slice(0, 6) };
}

/** The Replies to match tab, made the first time it is needed; its message ids, so nothing is listed twice. */
function tMatchTab_() {
  var ss = ss_(), sh = ss.getSheetByName(T_MATCH_TAB);
  if (!sh) { sh = ss.insertSheet(T_MATCH_TAB); sh.appendRow(T_MATCH_HEAD); try { sh.setFrozenRows(1); } catch (e) {} }
  return sh;
}
function tMatchIds_() {
  var ids = {};
  try {
    var sh = ss_().getSheetByName(T_MATCH_TAB), last = sh ? sh.getLastRow() : 0;
    if (sh && last > 1) sh.getRange(2, 8, last - 1, 1).getValues().forEach(function (v) { if (v[0]) ids[String(v[0])] = 1; });
  } catch (e) {}
  return ids;
}

/** Files every reply a person has placed on the Replies to match tab by typing its token: a Client Responses row
 *  exactly as the reader writes one, with the message id in Referrer, so it is never filed twice. */
function tFileMatched_(tokens) {
  var n = 0, sh;
  try { sh = ss_().getSheetByName(T_MATCH_TAB); } catch (e) { return 0; }
  if (!sh || sh.getLastRow() < 2) return 0;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues(), resp = null;
  var spec = (typeof RESPONSES !== 'undefined' && RESPONSES.question) || { needs: 'a reply the same day', status: 'Open' };
  for (var i = 0; i < vals.length; i++) {
    var tok = tText_(vals[i][5]), done = tText_(vals[i][6]);
    if (!tok || /^filed/i.test(done)) continue;
    if (!tokens[tok]) { if (done !== 'check the token') sh.getRange(i + 2, 7).setValue('check the token'); continue; }
    try {
      resp = resp || responseSheet_();
      resp.appendRow([new Date(), tok, tText_(tokens[tok].Segment).toUpperCase(), 'question', spec.needs, '/reply?q=wrote',
        ('reply ' + tText_(vals[i][7])).slice(0, 120), spec.status, '', '',
        (vals[i][3] ? '"' + String(vals[i][3]).slice(0, 300) + '" ' : '') + '[matched by hand]']);
      sh.getRange(i + 2, 7).setValue('filed ' + Utilities.formatDate(new Date(), tTz_(), 'd MMM HH:mm'));
      n++;
    } catch (err) { log_('transition', 'inbox-match-failed', String(err && err.message ? err.message : err)); }
  }
  return n;
}

/* ── letters that bounced ─────────────────────────────────────────── */
/* Until 29 September 2026 the inbox reader passed over every non-delivery report, so a letter that never arrived
   left its row reading 'sent': 139 addresses bounced on 25 and 26 September (read by hand off support@ on 27
   September), not one was marked, and the five-day follow-up would have gone to every one of them again. A report is
   known by its subject (and a postmaster sender); the address that failed is whichever address in the report's own
   part (before the original message's headers, which also carry the CC) is on the Transition Send tab, so no one
   format needs parsing and nobody else's row is touched. The row is held with "bounced: <why> (<date>)" in Exclude,
   which stops the reminder, the send again, the receipt and the chase, shows on the board as "letter bounced", and is
   exactly what tFilePhoneEmails_ replaces when a caller takes a working address. */
var T_BOUNCE_SUBJ = /^(undeliverable|undelivered|delivery status notification \(failure\)|mail delivery failed|delivery has failed|returned mail|failure notice|message not delivered|non-?delivery)/i;
var T_BOUNCE_LAST = 'bounce_last';     // the newest report already read, as Graph's receivedDateTime; unset until the one-time sweep
function tIsBounce_(from, subject) {
  var s = String(subject || '').trim();
  return T_BOUNCE_SUBJ.test(s) || (/^(postmaster|mailer-daemon|microsoftexchange)/i.test(String(from || '')) && /(undeliver|failure|failed|returned)/i.test(s));
}
/** Why a report says the letter failed, in the words Client Support reads. */
function tBounceWhy_(text) {
  var s = String(text || '');
  if (/\b[45]\.2\.2\b|mailbox (is )?full|over ?quota|quota exceeded|out of storage|insufficient storage/i.test(s)) return 'mailbox full';
  if (/\b5\.4\.(310|312|314|316)\b|\bdns\b|domain[^\n.]{0,40}(does not exist|doesn't exist|couldn't be found|not found)|host (not found|unknown)|no mx/i.test(s)) return 'bad domain';
  if (/\b5\.1\.(0|1|10)\b|wasn'?t found|was not found|does ?n[o']?t exist|no such (user|mailbox)|user unknown|unknown user|mailbox (not found|unavailable)|no mailbox|address not found|address could(n'?t| not) be found|recipient (not found|rejected)|invalid recipient|address rejected|account (is )?disabled/i.test(s)) return 'no such mailbox';
  if (/\b4\.4\.7\b|message expired|expired|timed? ?out|no (response|reply) from/i.test(s)) return 'no response';
  if (/\b5\.7\.\d+\b|blocked|spam|blacklist|block ?list|policy reasons/i.test(s)) return 'blocked';
  return 'undeliverable';
}
/** Holds every row of the tab whose address failed in this report. Returns how many rows it held. */
function tBounceMark_(t, text, when) {
  var body = String(text || '');
  var cut = body.search(/original message headers|-{2,}\s*original message|content-type:\s*message\/rfc822|^\s*received: from/im);
  if (cut > 0) body = body.slice(0, cut);
  var found = {};
  (body.toLowerCase().match(/[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)+/g) || []).forEach(function (a) { found[a.replace(/^[.'-]+|[.]+$/g, '')] = 1; });
  if (!Object.keys(found).length) return 0;
  var v = 'bounced: ' + tBounceWhy_(body) + ' (' + Utilities.formatDate(when instanceof Date && !isNaN(when.getTime()) ? when : new Date(), tTz_(), 'd MMM') + ')';
  var marked = 0;
  t.rows.forEach(function (r) {
    var mail = tText_(r.Email).toLowerCase(), ex = tText_(r.Exclude);
    if (!mail || !found[mail] || tYes_(r.Test)) return;
    if (/^bounced/i.test(ex) || /^bounced/i.test(tText_(r.Status))) return;                     // once
    if (ex && !/^check: (same e-mail as row|shares an inbox)/i.test(ex)) return;                  // held for something else: left as it is
    var n = tAt_(t, r);
    t.sh.getRange(n, t.col.Exclude).setValue(v);
    t.sh.getRange(n, t.col.Status).setValue('bounced');
    r.Exclude = v; r.Status = 'bounced'; marked++;
  });
  return marked;
}
/** Once, the first time the reader runs after the paste: every report in the inbox since the campaign's first letter,
 *  so the bounces of 25 and 26 September are held before any follow-up goes. The property it sets is where the
 *  five-minute reader carries on from; a sweep that cannot finish leaves it unset and tries again next run. */
function tBounceSweep_(token) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(T_BOUNCE_LAST)) return 0;
  var t = tRead_(), first = null;
  t.rows.forEach(function (r) { var d = r['Sent at']; if (d instanceof Date && !isNaN(d.getTime()) && (!first || d < first)) first = d; });
  var stamp = function (d) { return d.toISOString().replace(/\.\d+Z$/, 'Z'); };
  if (!first) { props.setProperty(T_BOUNCE_LAST, stamp(new Date())); return 0; }
  var since = stamp(new Date(Math.max(first.getTime() - 86400000, Date.now() - 60 * 86400000)));
  var user = 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(TRANSITION.MS_FROM);
  var url = user + '/mailFolders/inbox/messages?$select=id,subject,from,receivedDateTime&$orderby=receivedDateTime%20desc&$top=100' +
    '&$filter=' + encodeURIComponent('receivedDateTime ge ' + since);
  var hits = [], pages = 0, newest = '';
  while (url) {
    if (++pages > 40) return 0;                                             // more than 4,000 messages: leave it for the next run
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
    if (res.getResponseCode() !== 200) return 0;
    var j = JSON.parse(res.getContentText());
    (j.value || []).forEach(function (m) {
      var from = String(((m.from || {}).emailAddress || {}).address || '').toLowerCase();
      if (!tIsBounce_(from, m.subject)) return;
      hits.push(m.id);
      if (m.receivedDateTime > newest) newest = m.receivedDateTime;
    });
    url = j['@odata.nextLink'] || '';
  }
  var marked = 0;
  for (var i = 0; i < hits.length; i += 20) {
    var reqs = hits.slice(i, i + 20).map(function (id) {
      return { url: user + '/messages/' + encodeURIComponent(id) + '?$select=body,receivedDateTime', muteHttpExceptions: true,
               headers: { Authorization: 'Bearer ' + token, Prefer: 'outlook.body-content-type="text"' } };
    });
    var got = UrlFetchApp.fetchAll(reqs);
    for (var k = 0; k < got.length; k++) {
      if (got[k].getResponseCode() !== 200) return marked;                 // unfinished: the property stays unset, the next run starts again
      var m = JSON.parse(got[k].getContentText());
      marked += tBounceMark_(t, (m.body || {}).content, m.receivedDateTime ? new Date(m.receivedDateTime) : null);
    }
  }
  props.setProperty(T_BOUNCE_LAST, newest || since);
  log_('transition', 'bounces', 'first sweep since ' + since + ': ' + hits.length + ' reports read, ' + marked + ' rows held as bounced');
  return marked;
}

function tInbox_() {
  var out = { filed: 0, seen: 0, skipped: 0, bounced: 0, toMatch: 0, byName: 0 };
  if (!tMsCreds_()) return out;
  var since = new Date(Date.now() - TRANSITION.INBOX_DAYS * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
  var url = 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(TRANSITION.MS_FROM) + '/mailFolders/inbox/messages' +
    '?$select=id,internetMessageId,subject,from,receivedDateTime,body&$orderby=receivedDateTime%20desc&$top=50' +
    '&$filter=' + encodeURIComponent('receivedDateTime ge ' + since);
  var token;
  try { token = tMsToken_(); } catch (err) { log_('transition', 'inbox-not-ready', String(err && err.message ? err.message : err)); return out; }
  try { out.bounced += tBounceSweep_(token); } catch (err) { log_('transition', 'bounce-sweep-failed', String(err && err.message ? err.message : err)); }
  var bProps = PropertiesService.getScriptProperties(), bLast = bProps.getProperty(T_BOUNCE_LAST) || '', bNewest = '', bTab = null;
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
  var tokens = tTokenMap_(), byMail = {}, shared = {};
  Object.keys(tokens).forEach(function (t) {
    if (tYes_(tokens[t].Test)) return;   // a Test row is a colleague standing in as a client: their everyday mail is not a reply (28 September)
    var m = tText_(tokens[t].Email).toLowerCase();
    if (m) { byMail[m] = byMail[m] ? 'many' : t; (shared[m] = shared[m] || []).push(t); }   // one client per address, or nobody
  });
  try { out.filed += tFileMatched_(tokens); } catch (err) { log_('transition', 'inbox-match-failed', String(err && err.message ? err.message : err)); }
  var matchIds = null;
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
    if (tIsBounce_(from, subject)) {                                     // a letter that never arrived: the row is held, once
      var at = String(m.receivedDateTime || '');
      if (!bLast || at > bLast) {
        try {
          bTab = bTab || tRead_();
          out.bounced += tBounceMark_(bTab, String((m.body || {}).content || ''), at ? new Date(at) : null);
          if (at > bNewest) bNewest = at;
        } catch (err) { log_('transition', 'bounce-failed', String(err && err.message ? err.message : err)); }
      }
      out.skipped++; return;
    }
    if (!from || ours[from] || /^(postmaster|mailer-daemon|no-?reply|noreply)/.test(from) ||
        /^(automatic reply|auto:|out of office|undeliverable|delivery status)/i.test(subject)) { out.skipped++; return; }
    var text = String((m.body || {}).content || '').replace(/\r/g, '');
    var ref = T_REF.exec(text) || T_REF.exec(subject);
    var tok = ref ? ref[1] : ((byMail[from] && byMail[from] !== 'many') ? byMail[from] : '');
    var how = '';
    /* a reply to the follow-up note carries the client's reference in the quoted note: exact, from any address. One
       of our own addresses counts only when it is the one that row was written to (a colleague standing in as a
       client on a Test row); anyone else of ours on the thread is answering the client, not the client */
    var yours = !tok && T_YOUR_REF.exec(text);
    if (yours && tokens[yours[1]]) {
      var mail = tText_(tokens[yours[1]].Email).toLowerCase();
      if (!T_OUR_DOMAINS.test(from) || mail === from) { tok = yours[1]; how = ' [matched by reference' + (mail === from ? '' : ', from ' + from) + ']'; }
    }
    if ((!tok || !tokens[tok]) && T_OUR_SUBJECT.test(subject) && !T_OUR_DOMAINS.test(from)) {
      var g = tGuessClient_(subject, text, from, tokens, shared);
      if (g.token) { tok = g.token; how = ' [matched by name]'; out.byName++; }
      else {
        matchIds = matchIds || tMatchIds_();
        if (!matchIds[id]) {
          try {
            tMatchTab_().appendRow([m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(), from, subject.slice(0, 200),
              tWords_(text, lines).slice(0, 500), g.candidates.map(function (t) { return tText_(tokens[t].Client) + ': ' + t; }).join('; '), '', '', id]);
            matchIds[id] = 1; out.toMatch++;
          } catch (err) { log_('transition', 'inbox-match-failed', String(err && err.message ? err.message : err)); }
        }
        return;
      }
    }
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
        (words ? '"' + words.slice(0, 300) + '"' : '') + how]);
      filed[id] = 1; out.filed++;
    } catch (err) { log_('transition', 'inbox-row-failed', String(err && err.message ? err.message : err)); }
  });
  if (bNewest && bNewest > bLast) { try { bProps.setProperty(T_BOUNCE_LAST, bNewest); } catch (e) {} }
  if (out.bounced) log_('transition', 'bounces', out.bounced + ' rows held as bounced');
  if (out.filed || out.toMatch) log_('transition', 'inbox', out.filed + ' filed' + (out.byName ? ' (' + out.byName + ' by name)' : '') + ', ' +
    out.toMatch + ' put on "' + T_MATCH_TAB + '", ' + out.seen + ' already filed, ' + out.skipped + ' not this campaign');
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
    if (!t || t.charAt(0) === '>' || lines[t.toLowerCase()] || T_SIGNATURE.test(t)) return false;
    out.push(t); return false;
  });
  return out.join(' ').replace(/\s+/g, ' ').trim();
}
/** The line a phone or a mail app adds under every message: never the client's words. */
var T_SIGNATURE = /^(sent from my (iphone|ipad|galaxy|samsung[\w ]*|android[\w ]*|huawei[\w ]*|mobile[\w ]*)|get outlook for (ios|android)|sent from yahoo mail[\w ]*|sent from mail for windows[\w ]*)\.?$/i;

/** A client's words in a reply's Note cell: the quoted text transitionInbox put first, without the phone's signature
 *  that replies filed before 29 September still carry. '' when the reply only tapped. */
function tNoteWords_(note) {
  var m = /^\s*"([\s\S]*?)"(?:\s|$)/.exec(String(note || ''));
  if (!m) return '';
  return m[1].replace(/\s+/g, ' ').replace(/\s*(sent from my (iphone|ipad|galaxy|samsung[\w ]*|android[\w ]*|huawei[\w ]*|mobile[\w ]*)|get outlook for (ios|android)|sent from yahoo mail[\w ]*|sent from mail for windows[\w ]*)\.?\s*$/i, '').trim();
}
/** The notes a person added when marking a client on the board ("[called 28 Sep · Ricky] left a message"), as
 *  "called 28 Sep · Ricky: left a message". A stamp with nothing added is on the card already, as the mark. */
function tFileNotes_(note) {
  var out = [], re = /\[(called|met|declined|closed|open|no answer|assigned) ([^\]·]+?) · ([^\]]+)\]([^\[]*)/g, m;
  while ((m = re.exec(String(note || '')))) {
    var extra = m[4].replace(/\s+/g, ' ').trim();
    if (extra) out.push(m[1] + ' ' + m[2].trim() + ' · ' + m[3].trim() + ': ' + extra.slice(0, 300));
  }
  return out;
}

/** Every five minutes, installed by transitionSetup. The e-mails taken on calls go onto their rows, held, first. */
function transitionReceipts() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'another run is busy';
  try {
    try { tSharedInboxRows_(); } catch (e) { log_('transition', 'shared-inbox-failed', String(e && e.message ? e.message : e)); }
    try { tAgainCol_(); } catch (e) { log_('transition', 'send-again-column-failed', String(e && e.message ? e.message : e)); }
    try { tFilePhoneEmails_(); } catch (e) { log_('transition', 'phone-emails-failed', String(e && e.message ? e.message : e)); }
    try { tHaSync_(false); } catch (e) { log_('transition', 'household-assignments-failed', String(e && e.message ? e.message : e)); }
    var out = tReceipts_();
    tClaimsRun_(false);   // the TT$200 retention claims, after the receipts; never throws
    return out;
  } finally { lock.releaseLock(); }
}

/* ── families sharing one inbox ──────────────────────────────────── */
/** Whether two send rows are one family by name: a surname in common, a married name's either half counting
 *  ("Persad-Singh" and "Singh"), a lone initial never. */
function tSurnames_(row) {
  var t = tText_(row.Client).toLowerCase().replace(/[^a-z\-' ]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  return t.length > 1 ? t.slice(1) : t;
}
function tSameFamily_(a, b) {
  var sa = tSurnames_(a);
  return tSurnames_(b).some(function (x) { return x.length > 1 && sa.indexOf(x) >= 0; });
}
/** Whether two send rows sharing an inbox are one person on two client numbers: the same first name and a surname in
 *  common, a letter out allowed ("Mohamed" and "Mohammed"). On 29 September, 23 of the 95 rows the old rule held had the
 *  same name as the client already written to at that inbox (one man on two consecutive client numbers); the family rule
 *  would have sent each of them the same letter a second time. A father and son of one name sharing an inbox are held
 *  too, which is a check for Client Support, never a letter lost. */
function tSamePerson_(a, b) {
  var fn = function (r) { return (tText_(r.Client) || tText_(r['First name'])).toLowerCase().replace(/[^a-z\- ]/g, '').split(/[\s-]+/).filter(Boolean); };
  var na = fn(a), nb = fn(b);
  if (na.length < 2 || nb.length < 2) return false;
  var fa = na[0], fb = nb[0];
  var first = fa === fb || (fa.length >= 4 && fb.length >= 4 && fa.slice(0, 4) === fb.slice(0, 4) && Math.abs(fa.length - fb.length) <= 2);
  if (!first) return false;
  var near = function (x, y) {
    if (x === y) return x.length > 1;
    if (Math.abs(x.length - y.length) > 1 || Math.min(x.length, y.length) < 4) return false;
    if (x.length === y.length) { var d = 0; for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) d++; return d <= 1; }
    var lo = x.length < y.length ? x : y, hi = x.length < y.length ? y : x;
    for (var j = 0; j < hi.length; j++) if (hi.slice(0, j) + hi.slice(j + 1) === lo) return true;
    return false;
  };
  return na.slice(1).some(function (x) { return nb.slice(1).some(function (y) { return near(x, y); }); });
}
/** When a row's letter went, as a number to sort by; a row not sent, or sent on a day typed as text, sorts last. */
function tSentMs_(r) { var d = r['Sent at']; return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : Infinity; }
/** Who another send row is, for a hold's text: the name and the client number. Never the row number: the tab gets
 *  sorted (30 September 2026, by Sent at), and "row 47" then names someone else. */
function tWhoRow_(f) {
  var no = tText_(f['Client number']);
  return (tText_(f.Client) || tText_(f['First name']) || 'another client') + (no ? ' (client ' + no + ')' : '');
}
/** What a row sharing an inbox under a different surname carries in Exclude until Client Support confirms the address. */
function tInboxCheck_(f) {
  return ('check: shares an inbox with ' + tWhoRow_(f) + ', a different surname: confirm the address').slice(0, 160);
}
/** What a row carries when the inbox's letter already went to the same person under another client number. */
function tSameCheck_(f) {
  return ('check: same name and inbox as ' + tWhoRow_(f) + ': likely one person on two client numbers, one letter is enough').slice(0, 160);
}
/** The families the old one-inbox rule held for good ("check: same e-mail as row N": 95 clients on 28 September),
 *  sorted once under the new rule: a family member's Exclude is cleared, so their own letter goes after the go, one
 *  a day per inbox; a different surname is held for Client Support to confirm the address. Runs first in the
 *  five-minute receipts run, once: the script property it sets stops it after the pass, and no row can be held the
 *  old way any more. The "row N" in the old note is where the first letter's row stood when the note was written;
 *  the tab has been sorted since (30 September 2026: all 95 pointed at the wrong client), so the letters the inbox
 *  has had are found by the address itself, as the sender finds them (tSendBatch_). */
var T_INBOX_SORTED = 'shared_inbox_sorted';
function tSharedInboxRows_() {
  var out = { family: 0, confirm: 0, same: 0 };
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(T_INBOX_SORTED) === 'yes') return out;
  var t = tRead_(), sentTo = {};
  t.rows.forEach(function (r) {
    var mail = tText_(r.Email).toLowerCase();
    if (mail && tText_(r['Sent at'])) (sentTo[mail] = sentTo[mail] || []).push(r);
  });
  Object.keys(sentTo).forEach(function (k) { sentTo[k].sort(function (a, b) { return tSentMs_(a) - tSentMs_(b); }); });
  t.rows.forEach(function (r) {
    if (!/^check: same e-mail as row \d+/i.test(tText_(r.Exclude))) return;
    var had = (sentTo[tText_(r.Email).toLowerCase()] || []).filter(function (s) { return s !== r; });
    var twin = had.filter(function (s) { return tSamePerson_(s, r); })[0], f = had[0];
    var n = tAt_(t, r);
    if (twin) {
      var same = tSameCheck_(twin);
      t.sh.getRange(n, t.col.Exclude).setValue(same);
      t.sh.getRange(n, t.col.Status).setValue(same);
      out.same++;
    } else if (f && tSameFamily_(f, r)) {
      t.sh.getRange(n, t.col.Exclude).setValue('');
      t.sh.getRange(n, t.col.Status).setValue('');
      if (t.col.Reason) t.sh.getRange(n, t.col.Reason).setValue('shares an inbox with ' + tWhoRow_(f) + ', family: their own letter after the go, one a day per inbox');
      out.family++;
    } else {
      var why = f ? tInboxCheck_(f) : 'check: shares an inbox, a different surname: confirm the address';
      t.sh.getRange(n, t.col.Exclude).setValue(why);
      t.sh.getRange(n, t.col.Status).setValue(why);
      out.confirm++;
    }
  });
  props.setProperty(T_INBOX_SORTED, 'yes');
  log_('transition', 'shared-inbox', out.family + ' family members freed for their own letter after the go, one a day per inbox; ' +
       out.confirm + ' held for Client Support to confirm the address; ' + out.same + ' held as one person on two client numbers');
  return out;
}

/* ── e-mails taken on a call ─────────────────────────────────────── */
/** Client Support calls every client the letter did not reach, before any agent is named, to put right what our
 *  records hold (27 September: "the objective is to get the data cleaned, the correct email, then send off the
 *  email … to have it on record"). The caller's copy of the answer page files the address the client spelled back
 *  as its own Client Responses row, q=email_given, the Referrer cell reading "call by <name>: <address>". This
 *  writes it onto the client's Transition Send row and holds it there for the branch's go: the address in Email,
 *  T_PHONE_HOLD in Exclude, who took it and when in Reason. Neither a letter nor a receipt goes to a held row. A row
 *  whose letter went to another address (it bounced, or the client reads a different one) has Sent at and Status
 *  cleared, so the letter goes again, to the address the client gave, once released; the same address with the
 *  letter already sent is left alone. A row held for anything else (an agent, a household, staff, a claim, a check,
 *  nothing held) is never touched. Every row read is marked [filed…] in its Note cell, appended, never re-read. */
var T_PHONE_HOLD = 'hold: e-mail by phone';

/** Client e-mail on hold, the manager's word on 28 September 2026: "hold any emails going to clients until
 *  I say so". While it is on, no letter and no reminder goes (the batch stops before it touches a row) and no
 *  "still on it" note (it stays due). Nothing is lost and nothing is marked. Since 7 October the receipt waits
 *  too (HOLD_RECEIPTS) and goes after the go, and naming an agent sends no introduction (HOLD_INTROS); until
 *  then a client who answered a letter already sent was thanked as usual ("if they answer on an old one, one
 *  going out is ok and logged"). A note the manager presses on the board is his go for that note and goes.
 *  What is not a client still goes: the Test rows (colleagues), the preview to the owner, the digest, the
 *  reports, the agent's brief, and the alert that a client wrote in. Reading replies and filing e-mails taken
 *  by phone go on as before. */
function tClientMailHeld_() {
  var p = '';
  try { p = String(PropertiesService.getScriptProperties().getProperty(T_HOLD) || ''); } catch (e) {}
  if (p === 'on') return true;
  if (p === 'off') return false;
  return TRANSITION.HOLD_CLIENT_MAIL === true;
}
/** The go: letters, reminders, receipts and notes resume on their next runs. */
function transitionReleaseClientMail() {
  PropertiesService.getScriptProperties().setProperty(T_HOLD, 'off');
  log_('transition', 'client-mail', 'released: letters, reminders, receipts and notes resume');
  return tSay_('Client e-mail released: letters, reminders and "still on it" notes go on their next runs' +
    (TRANSITION.HOLD_RECEIPTS === true ? ', and the receipts that waited go within five minutes (answers under fourteen days old)' : '') + '.' +
    (TRANSITION.HOLD_INTROS !== false ? ' Introductions held while an agent was named do not go by themselves.' : ''));
}
/** Hold again, whatever HOLD_CLIENT_MAIL says. */
function transitionHoldClientMail() {
  PropertiesService.getScriptProperties().setProperty(T_HOLD, 'on');
  var also = (TRANSITION.HOLD_RECEIPTS === true ? ' receipts' : '') + (TRANSITION.HOLD_INTROS !== false ? (TRANSITION.HOLD_RECEIPTS === true ? ' and' : '') + ' introductions' : '');
  log_('transition', 'client-mail', 'on hold: no letters, reminders or still-on-it notes until transitionReleaseClientMail' + (also ? '; no' + also + ' either' : '; receipts still thank a client who answers'));
  return tSay_('Client e-mail on hold: no letters, reminders or "still on it" notes go until you release it.' +
    (TRANSITION.HOLD_RECEIPTS === true ? ' Receipts wait and go after the release.' : ' A client who answers a letter already sent is still thanked.') +
    (TRANSITION.HOLD_INTROS !== false ? ' Naming an agent briefs the agent and sends the client nothing.' : '') + ' A note you press on the board still goes.');
}
function tFilePhoneEmails_() {
  var out = { filed: 0, same: 0, left: 0, updated: 0 }, answered = null;
  var rs, last;
  try { rs = ss_().getSheetByName(SVC.RESP_SHEET); last = rs ? rs.getLastRow() : 0; } catch (e) { return out; }
  if (!rs || last < 2) return out;
  var vals = rs.getRange(2, 1, last - 1, 11).getValues(), todo = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i], page = String(v[5] || ''), note = String(v[10] || '');
    if (page.indexOf('/your-policy/phone') !== 0 || tQOf_(page) !== 'email_given' || note.indexOf('[filed') >= 0) continue;
    var m = String(v[6] || '').match(/^call by ([^:]*):\s*(\S+)\s*$/);
    todo.push({ rowNum: i + 2, token: String(v[1] || '').trim(), by: m ? m[1].trim() : '', email: m ? m[2].trim().toLowerCase() : '',
                when: v[0], note: note });
  }
  if (!todo.length) return out;
  var t;
  try { t = tRead_(); } catch (e) { log_('transition', 'phone-emails-held', String(e && e.message ? e.message : e)); return out; }
  var byTok = {}, tz = tTz_();
  t.rows.forEach(function (r) { var k = tText_(r.Token); if (k) byTok[k] = r; });
  function mark(x, what) {
    try { rs.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[filed' + (what ? ': ' + what : '') + ']'); } catch (e) {}
  }
  todo.forEach(function (x) {
    var r = byTok[x.token], bad = tEmailProblem_(x.email);
    if (!r) { mark(x, 'no row for this token'); out.left++; return; }
    if (bad) { mark(x, 'address looks wrong (' + bad + '), not filed'); out.left++; return; }
    var ex = tText_(r.Exclude), old = tText_(r.Email).toLowerCase(), sentAt = r['Sent at'];
    var sent = sentAt instanceof Date ? !isNaN(sentAt.getTime()) : !!tText_(sentAt);
    if (ex && !/^no e-mail/i.test(ex) && !/^bounced/i.test(ex) && ex !== T_PHONE_HOLD && !/^check: shares an inbox/i.test(ex)) {
      mark(x, 'row held for "' + ex.slice(0, 40) + '", not changed'); out.left++; return;
    }
    if (old === x.email && sent && !ex) { mark(x, 'same address, the letter went there already'); out.same++; return; }
    /* the address the letter bounced from, "confirmed" on a call: filing it would clear the hold and send the letter back
       to a box that does not exist (29 September 2026: ten bounced addresses kept as they were, two of them misspelt).
       A full mailbox is the client's own address and may have been cleared, so it may be confirmed. */
    if (old === x.email && /^bounced: (no such mailbox|bad domain)/i.test(ex)) {
      mark(x, 'this address bounced (' + ex.replace(/^bounced: /i, '') + '), not filed: ask for the right one'); out.left++; return;
    }
    var took = x.when instanceof Date ? ' on ' + Utilities.formatDate(x.when, tz, 'd MMM') : '';
    /* A client who answered a letter that reached them gets the new address for whatever a person sends next, and never
       the letter again: clearing Sent at here queued it for the go (7 October 2026: a client who had answered gave her
       personal address by reply, and recording it would have sent her the letter a second time; the manager, that
       morning: "client do not get the reminders a second time whom have responded"). A letter that bounced, or a client
       with no e-mail, never reached them, so theirs still goes after the go. */
    if (sent && !/^(bounced|no e-mail)/i.test(ex) && ex !== T_PHONE_HOLD) {
      if (!answered) answered = tAnswered_();
      if (answered[x.token]) {
        var n0 = tAt_(t, r);
        t.sh.getRange(n0, t.col.Email).setValue(x.email);
        if (t.col.Reason) t.sh.getRange(n0, t.col.Reason).setValue('e-mail taken by ' + (x.by || 'Client Support') + took +
          '; they answered the letter sent to ' + (old || 'no address') + ', so it does not go again');
        r.Email = x.email;
        mark(x, 'answered: address updated, the letter does not go again'); out.updated++; return;
      }
    }
    var was = sent ? '; the letter of ' + (sentAt instanceof Date ? Utilities.formatDate(sentAt, tz, 'd MMM') : tText_(sentAt)) +
      ' went to ' + (old || 'no address') + ' and goes again on release' : '';
    var n = tAt_(t, r);      // the client's own row, found by token: clearing Sent at on another client's row would send them their letter again
    t.sh.getRange(n, t.col.Email).setValue(x.email);
    t.sh.getRange(n, t.col.Exclude).setValue(T_PHONE_HOLD);
    if (t.col.Reason) t.sh.getRange(n, t.col.Reason).setValue('e-mail taken by ' + (x.by || 'Client Support') + took + was);
    if (sent) { t.sh.getRange(n, t.col['Sent at']).setValue(''); t.sh.getRange(n, t.col.Status).setValue(''); r['Sent at'] = ''; }
    r.Email = x.email; r.Exclude = T_PHONE_HOLD;
    mark(x, ''); out.filed++;
  });
  if (out.filed || out.same || out.left || out.updated) {
    log_('transition', 'phone-emails', out.filed + ' filed and held for the go, ' + out.updated + ' updated for clients who had answered (no letter again), ' +
      out.same + ' already sent there, ' + out.left + ' not filed');
  }
  return out;
}

/** The same checks the caller's page makes, again here, since the page is the only thing standing between a
 *  hurried line and a letter to a stranger: one address, a full ending, no common slip of a provider's name. */
function tEmailProblem_(e) {
  e = String(e || '').trim().toLowerCase();
  if (!e || /[\s,;\/]/.test(e) || (e.match(/@/g) || []).length !== 1) return 'not one address';
  var local = e.split('@')[0], dom = e.split('@')[1] || '';
  if (!local || dom.indexOf('.') < 0 || /\.$/.test(dom) || dom.split('.').pop().length < 2) return 'cut off';
  var first = dom.split('.')[0];
  if (['gmail', 'yahoo', 'hotmail', 'outlook', 'live', 'icloud', 'aol', 'msn', 'ymail', 'rocketmail'].indexOf(first) >= 0 &&
      /^(c|co|cm|om|con|comm)$/.test(dom.slice(first.length + 1))) return 'cut-off ending';
  if (/^(gnail|gmial|gmai|gamil|gmaill|hotmial|hotmal|hotmai|yaho|yahooo|outlok|iclod)$/.test(first)) return 'misspelt';
  return '';
}

/** The branch's go for the e-mails taken on calls: clears T_PHONE_HOLD from Exclude on every row that carries it,
 *  so the next batch in sending hours sends those letters. From the editor's Run button, or clear the cells by
 *  hand (filter Exclude for "hold: e-mail by phone"); the send itself is the ordinary batch, so the go-live switch,
 *  the sending hours, the one-address rule and the pace all still apply. */
function transitionReleasePhoneEmails() {
  var t = tRead_(), n = 0;
  t.rows.forEach(function (r) {
    if (tText_(r.Exclude) === T_PHONE_HOLD) { t.sh.getRange(tAt_(t, r), t.col.Exclude).setValue(''); n++; }
  });
  log_('transition', 'phone-emails-released', n + ' released');
  return tSay_(n + ' e-mail' + (n === 1 ? '' : 's') + ' taken by phone released: the next batch in sending hours sends those letters.');
}

function tQOf_(page) { return (String(page || '').match(/[?&]q=([a-z_]+)/) || [])[1] || ''; }

/* How to reach a client, taken on a call: the e-mail, "no e-mail", a new number or address, and how and when to call.
   It is the branch's record-keeping, never the client's answer to the letter (29 September 2026: 107 e-mails taken by
   Client Support were waiting to be filed, and each would have counted as an answer). So a row like this never stops
   the follow-up (tAnswered_), is never a response in the reports or on the wall (tInsights_, tSummary_), and never
   makes a card "answered" on the board (tBoard_: state 'reached'). The answers a caller ticks with the client on the
   line, from the letter's own questions, are answers like any other. */
var T_CONTACT_Q = /^(email_given|email_none|phone_given|address_given|reach_[a-z]+|when_[a-z]+)$/;
function tContactRow_(page) {
  page = String(page || '');
  return page.indexOf('/your-policy/phone') === 0 && T_CONTACT_Q.test(tQOf_(page));
}
/* An agent named from the board on a client who has not answered: transitionAssign_ writes an 'assign' row (Page
   /assign) so the name has a row to sit on. It is the branch's own note, never the client's answer. Until 30
   September 2026 every reader took it for one: the receipts run would have thanked the client for a response they
   never gave (and receipts are not held with client e-mail), the chase would have sent them the "still on it" note
   for a request they never made, their five-day reminder would have stopped, the board would have counted them as
   answered, and naming them again would have sent the introduction that thanks them for answering. None had been
   written on the sheet when it was caught. */
function tAssignRow_(page) { return String(page || '').indexOf('/assign') === 0; }
/* A call logged from the board on a client with no row of their own (transitionUpdate_, 7 October 2026: "where does
   staff make their notes and who to call as we move from the spreadsheet to data entry"). Client Support works the call
   list on the board now, and a try ("No answer", "Called") needs a row to sit on: Page /call, Response 'call'. Like an
   assign row it is the branch's record, never the client's answer: never thanked, never chased, never counted as an
   answer. A call marked Called or Met was a conversation, so it stops the five-day reminder as a contact row does
   (tRespondedAt_). */
function tCallRow_(page) { return String(page || '').indexOf('/call') === 0; }
/** A row on Client Responses that is the branch's record, not the client's answer: details taken on a call, an agent
 *  named from the board, or a call logged from the board. */
function tOursRow_(page) { return tContactRow_(page) || tAssignRow_(page) || tCallRow_(page); }
/** A call row whose outcome was a conversation. */
function tSpokeCall_(page, status) { return tCallRow_(page) && /^(called|met)$/i.test(String(status || '').trim()); }

/** One receipt per client per sitting: every unreceipted tap of a token this
 *  campaign recognises, once the newest is RECEIPT_WAIT_MIN old (a client
 *  ticking four checks gets one e-mail, not four), and once the review is
 *  filed when a tap opened the form, or RECEIPT_FORM_WAIT_MIN has passed.
 *  Each row it thanks is marked [receipt] in its Note cell, appended, so a
 *  human note there survives and the same tap is never thanked twice. */
function tReceipts_() {
  var out = { sent: 0, waiting: 0, held: 0, repeat: 0, wrote: 0, again: 0 };
  var sh, last;
  try { sh = ss_().getSheetByName(SVC.RESP_SHEET); last = sh ? sh.getLastRow() : 0; } catch (e) { return out; }
  if (!sh || last < 2) return out;
  var vals;
  try { vals = sh.getRange(2, 1, last - 1, 11).getValues(); } catch (e) { return out; }
  var tokens = tTokenMap_(), now = new Date(), groups = {}, order = [], prior = {}, every = {}, again = [];
  var row0 = function (r) { return (r || {}).Client || (r || {})['First name']; };
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i], received = v[0] instanceof Date ? v[0] : null;
    if (!received) continue;
    var token = String(v[1] || '').trim();
    if (!tokens[token]) continue;                                    // not this campaign's token: never touched
    (every[token] || (every[token] = [])).push(v);                   // every row the client has, marked or not: the trail
    if (tAssignRow_(v[5]) || tCallRow_(v[5])) continue;              // an agent named, or a call logged, from the board: nothing the client said
    var note = String(v[10] || '');
    if (note.indexOf('[receipt]') >= 0) {                            // seen by a run already: what it answered, and whether a receipt thanked it
      var p = prior[token] || (prior[token] = { thanked: {}, answered: {} }), pq = tQOf_(v[5]);
      if (pq) p.answered[pq] = 1;
      if (!/\[receipt\] (held|by phone|no e-mail)/.test(note)) p.thanked[pq || String(v[3] || '').trim().toLowerCase()] = 1;
      continue;
    }
    if (now - received > 14 * 86400000) continue;                    // long before the receipts ran: left alone
    if (!groups[token]) { groups[token] = { rows: [], newest: received }; order.push(token); }
    groups[token].rows.push({ rowNum: i + 2, received: received, r: String(v[3] || '').trim().toLowerCase(),
                              q: tQOf_(v[5]), seg: String(v[2] || '').trim().toUpperCase(), note: note,
                              via: String(v[6] || '').indexOf('reply ') === 0,       // filed from a reply: its words are in the Note, no form follows
                              words: String(v[5] || '').indexOf('/your-policy/words') === 0,   // written on the words page: the same, without the e-mail
                              phone: String(v[5] || '').indexOf('/your-policy/phone') === 0 });   // ticked by a caller on the line
    if (received > groups[token].newest) groups[token].newest = received;
  }
  if (!order.length) return out;
  /* receipts held with the rest of client e-mail (7 October 2026). Only the e-mail to the client waits: the run still
     marks what it always marks and still tells the branch who wrote in, so a hold never hides a client's own words.
     A receipt that waited is not marked and goes on the first run after the go. Until then the whole run stopped here. */
  var holdSend = TRANSITION.HOLD_RECEIPTS === true && tClientMailHeld_();
  var rc = tReceipt_();
  if (!rc || !rc.json.recap) { log_('transition', 'receipts-held', order.length + ' waiting: receipt.json on the site is missing or old, rebuild the letters'); return out; }
  if (!tMsCreds_()) { log_('transition', 'receipts-held', order.length + ' waiting: ' + T_MS_MISSING); return out; }
  var reviews = null, budget = TRANSITION.RECEIPT_MAX_PER_RUN, writers = [];
  for (var k = 0; k < order.length; k++) {
    var tok = order[k], g = groups[tok];
    /* answers a caller ticked with the client on the line were read back on the call (the call script), so
       nothing is e-mailed for them, whatever address the sheet holds: Client Support's round of calls, from
       28 September, sends nothing to anyone until the branch says so. Marked at once, never retried. */
    var byPhone = g.rows.filter(function (x) { return x.phone; });
    if (byPhone.length) {
      try { byPhone.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt] by phone: read back on the call'); }); } catch (e) {}
      g.rows = g.rows.filter(function (x) { return !x.phone; });
      if (!g.rows.length) { out.held++; continue; }
      g.newest = g.rows.reduce(function (m, x) { return x.received > m ? x.received : m; }, g.rows[0].received);
    }
    /* a reply in the client's own words is owed a person's reply, never a machine's (1 October 2026: "please ensure
       no duplicates are triggering to the client once they respond"). Until then every client who wrote in was also
       sent "Thank you, … We have received your response.": 42 clients by that noon, one of them three minutes
       after the manager had answered her himself, and clients who wrote only "Noted, thank you" were thanked for
       it. The words stay on the record for the board, the digest and the late list; taps sent beside them still
       get their one receipt. A reply that answers a question (a Ref line, the reply mode) is a tap, not words. */
    var wrote = g.rows.filter(function (x) { return (x.via || x.words) && (x.q === 'wrote' || !x.q); });
    if (wrote.length) {
      try { wrote.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt] held: they wrote in their own words: a person replies'); }); } catch (e) {}
      out.wrote++;
      writers.push({ row: tokens[tok], words: wrote.map(function (x) { return x.note.replace(/\s*\[[^\]]*\]/g, '').trim(); }).filter(Boolean),
                     page: wrote.filter(function (x) { return x.words; }).map(function (x) { return { at: x.received, words: tNoteWords_(x.note) }; }),
                     rows: every[tok] || [] });
      log_('transition', 'receipt-held', tText_((tokens[tok] || {}).Client || (tokens[tok] || {})['First name']) + ' · wrote in their own words: a person replies, no automatic receipt');
      g.rows = g.rows.filter(function (x) { return wrote.indexOf(x) < 0; });
      if (!g.rows.length) continue;
      g.newest = g.rows.reduce(function (m, x) { return x.received > m ? x.received : m; }, g.rows[0].received);
    }
    var formTap = g.rows.some(function (x) { return (x.r === 'urgent' || x.r === 'review' || x.r === 'selfserve') && !x.via; });
    var review = null;
    if (formTap) { if (reviews === null) reviews = tReviewMap_(); review = reviews['transition:' + tok] || null; }
    var ageMin = (now - g.newest) / 60000;
    if (ageMin < TRANSITION.RECEIPT_WAIT_MIN || (formTap && !review && ageMin < TRANSITION.RECEIPT_FORM_WAIT_MIN)) { out.waiting++; continue; }
    /* one receipt per answer, ever (1 October 2026): a client who taps an answer they were already thanked for is not
       thanked again. Until then 60 of the first 278 clients' receipts did only that, one client four times for the same
       "No" between 9 pm and 6:30 am. A reply with words of its own, or a tap that opens the form, is never a repeat. */
    var pr = prior[tok];
    if (pr && g.rows.every(function (x) { return !x.via && !/^(urgent|review|selfserve)$/.test(x.r) && pr.thanked[x.q || x.r]; })) {
      try { g.rows.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt] repeat: thanked before'); }); } catch (e) {}
      out.repeat++;
      continue;
    }
    /* three automatic e-mails, then a person (6 October 2026): the letter, one reminder, one receipt. A client who
       answers again after their receipt is never written to by a machine again: the rows are marked, the branch
       hears in the same internal e-mail that names who wrote in, and a person follows up. A tap that opens the form
       still brings the questionnaire's own confirmation from Service.gs, with the reference and the access code. */
    if (pr && TRANSITION.ONE_RECEIPT_PER_CLIENT !== false && Object.keys(pr.thanked).length) {
      try { g.rows.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt] held: one receipt per client: a person follows up'); }); } catch (e) {}
      out.again++;
      again.push({ row: tokens[tok], items: g.rows.map(function (x) { return x.q || x.r; }).filter(function (w, i, a) { return a.indexOf(w) === i; }) });
      log_('transition', 'receipt-held', tText_(row0(tokens[tok])) + ' · answered again after their receipt: a person follows up');
      continue;
    }
    if (pr) g.prior = pr.answered;                                   // so the receipt never offers a question answered before
    if (budget <= 0) { out.held++; continue; }
    var row = tokens[tok], to = tText_(row.Email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      /* a client with no e-mail on file: their answers were ticked on their own link by the caller, who repeated
         them back on the line (the call script), so nothing can or need go by e-mail; marked, never retried */
      out.held++;
      try { g.rows.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt] no e-mail: by phone'); }); } catch (e) {}
      continue;
    }
    if (tText_(row.Exclude)) {
      /* a row the branch holds (bounced, a recovered address awaiting the go, a check, a claim) is never written
         to by a receipt either: the address in it is dead, or not yet cleared to use */
      out.held++;
      try { g.rows.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt] held: row excluded (' + tText_(row.Exclude).slice(0, 40) + ')'); }); } catch (e) {}
      continue;
    }
    if (tLooksAutomated_(rc, g.rows)) {
      /* mail security that opens every link in a letter answers every question every way; a receipt
         would thank the client for answers they never gave (a client wrote in to say so, 26 September) */
      out.held++;
      try { g.rows.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt] held: answers look automated'); }); } catch (e) {}
      log_('transition', 'receipt-held', tText_(row.Client || row['First name']) + ' · answers look automated (' + g.rows.length + ' taps)');
      continue;
    }
    if (holdSend) { out.onhold = (out.onhold || 0) + 1; continue; }   // client e-mail on hold: this receipt goes after the go
    try {
      var m = tReceiptMail_(rc, row, g, review);
      tMsSend_(to, m.subject, m.html, tClientOpts_());
      g.rows.forEach(function (x) { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[receipt]'); });
      log_('transition', 'receipt', tText_(row.Client || row['First name']) + ' · ' +
        g.rows.map(function (x) { return x.q || x.r; }).join(', ') + (review ? ' · review ' + tText_(review.Reference) : ''));
      out.sent++; budget--;
    } catch (e) { log_('transition', 'receipt-failed', String(e && e.message ? e.message : e)); }
  }
  /* words written on the page reach support@ with the trail beneath, the way a reply by e-mail would (2 October 2026:
     "can this include the trail"); a reply by e-mail already sits in support@ with ours quoted under it, so the
     branch's alert is enough for those. A trail that cannot go falls back to the alert, so nobody is missed. */
  var alert = [];
  writers.forEach(function (w) {
    if (!w.page.length) { alert.push(w); return; }
    try { tTrailMail_(w.row, w.page, w.rows, rc); out.trail = (out.trail || 0) + 1; }
    catch (e) { log_('transition', 'trail-failed', String(e && e.message ? e.message : e)); alert.push(w); }
  });
  tWroteAlert_(alert, again);
  if (out.sent || out.held || out.repeat || out.wrote || out.again) log_('transition', 'receipts', out.sent + ' sent, ' + out.waiting + ' waiting, ' + out.held + ' held' +
    (out.onhold ? ', ' + out.onhold + ' waiting for the go: client e-mail is on hold' : '') +
    (out.repeat ? ', ' + out.repeat + ' repeated an answer already thanked: not thanked again' : '') +
    (out.wrote ? ', ' + out.wrote + ' wrote in their own words: a person replies' : '') +
    (out.again ? ', ' + out.again + ' answered again after their receipt: a person follows up' : ''));
  return out;
}

/** The branch hears at once when a client writes in their own words, now that no receipt goes to the client
 *  (1 October 2026). It used to hear through the receipt's own copy; this is that copy without the client: one
 *  internal e-mail a run, to the two addresses the receipts were copied to, never to anyone outside the branch. */
function tWroteAlert_(writers, again) {
  writers = writers || []; again = again || [];
  if (!writers.length && !again.length) return;
  var to = (TRANSITION.CC && TRANSITION.CC.length) ? TRANSITION.CC.join(',') : (TRANSITION.COPY_TO || SVC.AGENT_EMAIL);
  var name = function (row) { return tText_(row.Client) || tText_(row['First name']) || 'A client'; };
  var who = function (list) { return list.length === 1 ? name(list[0].row || {}) : tN_(list.length, 'client', 'clients'); };
  var subj = writers.length ? who(writers) + ' wrote in: reply in person, nothing automatic went to them' +
      (again.length ? ' · ' + who(again) + ' answered again after the receipt' : '')
    : who(again) + ' answered again after the receipt: a person follows up, nothing automatic went to them';
  var line = function (x, tail) {
    var row = x.row || {};
    return '- ' + name(row) + ' · letter ' + (tText_(row.Segment) || '?') + (row.Agent ? ' · was with ' + tText_(row.Agent) : '') +
      (tText_(row.Email) ? ' · ' + tText_(row.Email) : '') + tail;
  };
  var body = '';
  if (writers.length) {
    body += 'A client wrote to us in their own words, in a reply to support@ or on the words page. No receipt went to them: a person replies, from support@ ' +
      'or with support@ copied.\n\n' + writers.map(function (x) { return line(x, x.words.length ? '\n  ' + x.words.join('\n  ').slice(0, 1500) : ''); }).join('\n\n') + '\n\n';
  }
  if (again.length) {
    /* three automatic e-mails, then a person (6 October 2026): the second receipt is a person's call or note */
    body += 'A client answered again after their receipt. They have had their one receipt, so nothing automatic went to them: a person follows up, ' +
      'by phone or with a note from the board.\n\n' + again.map(function (x) { return line(x, ' · ' + x.items.join(', ')); }).join('\n') + '\n\n';
  }
  body += 'Their words and answers are on Client Responses and on the assignment board:\n' +
    'https://rickyrampersadbranch.com/orphan-transition/assign.html\n\n' + T_INTERNAL;
  try { MailApp.sendEmail(to, subj, body, { name: TRANSITION.FROM_NAME }); } catch (e) {}
}

/** The trail: everything between us and one client, newest first, in the words the client saw (2 October 2026,
 *  asked of the words page: "can this include the trail"). Ours: the letter and any reminder, the receipt, the
 *  follow-up note, the manager's notes, the introduction of their agent, a call. Theirs: their answers, on the page
 *  or on a call, their replies, their words from the page. Nothing internal, no staff names, holds or marks,
 *  because a reply to the client carries it beneath. rows are the client's Client Responses rows as read, every one. */
function tTrail_(row, rows, rc) {
  var j = (rc && rc.json) || {}, recap = j.recap || {}, rq = recap.q || {}, rt = recap.taps || {}, rtt = recap.tap_text || {};
  var seg = tText_(row.Segment).toUpperCase(), tz = tTz_(), out = [];
  var add = function (at, who, text, quote) {
    out.push({ at: (at instanceof Date && !isNaN(at.getTime())) ? at : null, who: who, text: text, quote: quote || '' });
  };
  var day = function (d) { return d instanceof Date ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : ''; };
  var subj = function (s) { return tFill_(s, row).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); };
  /* the letter, by its own subject line, and a reminder or the letter sent again */
  var sentAt = row['Sent at'] instanceof Date ? row['Sent at'] : null;
  if (sentAt) {
    var letter = '';
    try {
      (JSON.parse(tFetch_('manifest.json')).letters || []).forEach(function (L) { if (String(L.segment).toUpperCase() === seg) letter = subj(L.subject); });
    } catch (e) {}
    add(sentAt, 'us', 'Our letter', letter);
  }
  var st = /^(reminded|sent again)\s+(\d{4})-(\d{2})-(\d{2})/i.exec(tText_(row.Status));
  if (st) add(new Date(+st[2], +st[3] - 1, +st[4], 12), 'us', st[1].toLowerCase() === 'reminded' ? 'Our reminder, with the letter again' : 'The letter again');
  var answers = {}, called = {}, thanked = {}, firstWords = null, chased = false, year = new Date().getFullYear();
  var MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  rows.forEach(function (v) {
    var at = v[0] instanceof Date ? v[0] : null, r = String(v[3] || '').trim().toLowerCase(), page = String(v[5] || ''),
        q = tQOf_(page), note = String(v[10] || ''), d = day(at);
    if (tAssignRow_(page)) { /* the branch naming an agent: nothing the client said */ }
    else if (tCallRow_(page)) { if (tSpokeCall_(page, v[7]) && d && !called[d]) { called[d] = 1; add(at, 'us', 'We spoke with you by phone'); } }   // a try with no answer is not in the trail
    else if (tContactRow_(page)) { if (d && !called[d]) { called[d] = 1; add(at, 'us', 'We spoke with you by phone'); } }
    else if (page.indexOf('/your-policy/words') === 0) {
      var w = tNoteWords_(note);
      if (w) add(at, 'them', 'You wrote on our page', w);
      if (at && (!firstWords || at < firstWords)) firstWords = at;
    } else if (page.indexOf('/reply') === 0 && (q === 'wrote' || !q)) {
      var rw = tNoteWords_(note);
      if (rw) add(at, 'them', 'You wrote to us', rw);
    } else {
      var item = rq[q] ? rq[q][0] + ' ' + rq[q][1] : rt[r] ? ((rtt[seg] && rtt[seg][r]) || rt[r]) : '';
      var key = d + (page.indexOf('/your-policy/phone') === 0 ? ' phone' : '');
      if (item && d) {
        var a = answers[key] || (answers[key] = { at: at, phone: / phone$/.test(key), items: [] });
        if (a.items.indexOf(item) < 0) a.items.push(item);
      }
    }
    /* a receipt that went, not one held, by phone, or a repeat; once a day */
    if (at && /\[receipt\](?! (held|by phone|no e-mail|repeat))/.test(note) && !thanked[d]) {
      thanked[d] = 1; add(new Date(at.getTime() + 60000), 'us', 'Our receipt', subj(j.subject || 'Thank you, {{first_name}}. We have received your response.'));
    }
    if (/\[chase2\](?! held)/.test(note)) chased = true;
    (note.match(/\[told \d{1,2} [A-Z][a-z]{2} · \w+\]/g) || []).forEach(function (m) {
      var t = /\[told (\d{1,2}) ([A-Z][a-z]{2}) · (\w+)\]/.exec(m), N = T_NOTES[t[3]];
      if (N && MON[t[2]] !== undefined) add(new Date(year, MON[t[2]], +t[1], 12), 'us', 'A note from ' + tNoteSign_().name, N.label);
    });
    var intro = /\[intro ([^\]]+)\]/.exec(note);
    if (intro) add(v[9] instanceof Date ? v[9] : at, 'us', 'We introduced your agent', intro[1]);
  });
  Object.keys(answers).forEach(function (k) {
    var a = answers[k]; add(a.at, 'them', a.phone ? 'You told us by phone' : 'You answered our letter', a.items.join(' · '));
  });
  /* the follow-up note went before the words that answer it; its day is not recorded, so it sits just before them */
  if (chased) add(firstWords ? new Date(firstWords.getTime() - 60000) : null, 'us', 'Our follow-up note', subj((j.still && j.still.subject) || 'Still on it, {{first_name}}.'));
  /* a dedupe of what two rows of the same day both say (an intro on every actionable row) */
  var seen = {};
  out = out.filter(function (t) { var k = day(t.at) + '|' + t.text + '|' + t.quote; if (seen[k]) return false; seen[k] = 1; return true; });
  out.sort(function (a, b) { return (b.at ? b.at.getTime() : -1) - (a.at ? a.at.getTime() : -1); });
  return out;
}

/** Words written on the page, to support@ with the branch copied and the trail beneath, the way a reply by e-mail
 *  would arrive. Reply goes to the client (reply-to), so the team answers from the thread; the subject is the note's,
 *  so it threads with it, here and in the client's own inbox. The reference at the foot files a reply on their record. */
function tTrailMail_(row, page, rows, rc) {
  var first = tText_(row['First name']) || 'the client', email = tText_(row.Email), tz = tTz_(), esc = tEsc_;
  var words = page.map(function (x) { return x.words; }).filter(Boolean);
  var newest = page.reduce(function (m, x) { return (x.at && (!m || x.at > m)) ? x.at : m; }, null);
  var trail = tTrail_(row, rows, rc).filter(function (t) { return !(t.text === 'You wrote on our page' && words.indexOf(t.quote) >= 0); });
  var chased = rows.some(function (v) { return /\[chase2\](?! held)/.test(String(v[10] || '')); });
  var subject = chased ? 'Re: Still on it, ' + first + '.' : first + ' wrote to us on our page';
  var html = '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:620px">' +
    '<p style="margin:0 0 12px;font-size:12.5px;color:#8a97a8">Written on our page' + (newest ? ', ' + esc(Utilities.formatDate(newest, tz, 'EEEE d MMMM, h:mm a')) : '') +
      '. Reply to answer ' + esc(first) + (email ? ' at ' + esc(email) : '') + '.</p>' +
    '<p style="margin:0 0 6px;font-weight:800;color:#12202e">' + esc(tText_(row.Client) || first) + ' wrote:</p>' +
    words.map(function (w) {
      return '<div style="margin:0 0 12px;padding:8px 12px;border-left:3px solid #efc24b;background:#fffaf0;color:#12202e">' + esc(w) + '</div>';
    }).join('') +
    '<p style="margin:20px 0 6px;font-weight:800;color:#12202e">The trail</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">' +
    trail.map(function (t) {
      return '<tr><td style="padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap;font-size:13px;color:#8a97a8">' +
        (t.at ? esc(Utilities.formatDate(t.at, tz, 'd MMM')) : '') + '</td><td style="padding:6px 0;vertical-align:top;font-size:14px;border-top:1px solid #eef2f5">' +
        '<b style="color:' + (t.who === 'them' ? '#12202e' : '#5d7186') + '">' + esc(t.text) + '</b>' +
        (t.quote ? '<br><span style="color:' + (t.who === 'them' ? '#12202e' : '#5d7186') + '">' + (t.who === 'them' ? '“' + esc(t.quote) + '”' : esc(t.quote)) + '</span>' : '') +
        '</td></tr>';
    }).join('') + '</table>' +
    (tText_(row.Token) ? '<p style="margin:14px 0 0;font-size:12px;color:#8a97a8">Your reference: ' + esc(tText_(row.Token)) + '</p>' : '') +
    '</div>';
  tMsSend_(TRANSITION.MS_FROM, subject, html, { cc: TRANSITION.CC, replyTo: email || TRANSITION.MS_FROM });
  log_('transition', 'trail', tText_(row.Client || row['First name']) + ' · words from the page, with the trail, to support@');
}

/** True when a client's taps answer two or more questions both ways, or tick every option of one.
 *  A person who changes one answer (it happens: "keep looking after it", then "talk it through")
 *  is not caught; a link checker that opens every link in the letter is. Replies and answers a
 *  caller ticked on the phone never count. Only the receipt is held; every row stays recorded. */
function tLooksAutomated_(rc, rows) {
  var qs = (rc && rc.json && rc.json.questions) || {}, qOf = {}, size = {};
  Object.keys(qs).forEach(function (k) { var ans = (qs[k] && qs[k][1]) || []; size[k] = ans.length; ans.forEach(function (a) { qOf[a[2]] = k; }); });
  var seen = {};
  rows.forEach(function (x) {
    if (x.via || x.phone || !x.q || !qOf[x.q]) return;
    var k = qOf[x.q];
    (seen[k] = seen[k] || {})[x.q] = true;
  });
  var both = 0, all = false;
  Object.keys(seen).forEach(function (k) {
    var n = Object.keys(seen[k]).length;
    if (n > 1 && k !== 'reach' && k !== 'when') both++;   // how and when to call may change between visits
    if (n > 2 && n === size[k]) all = true;
  });
  return both >= 2 || all;
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
    Object.keys(g.prior || {}).forEach(function (q) { answered[q] = 1; });   // and what they answered before this receipt
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

/** One internal e-mail a run, to the branch (never to a client): every client
 *  newly past the branch's own target, and every one reaching the second level,
 *  with what each is still waiting on, who they were with, and whether the
 *  client was sent the "still on it" note or why not. Until 28 September this
 *  was one e-mail per open answer; since the quick checks (one row per answer,
 *  several per client) that would have been some eighty a day in one inbox. */
function tChaseSummary_(late) {
  if (!late.length) return;
  var to = TRANSITION.COPY_TO || SVC.AGENT_EMAIL;
  var second = late.filter(function (x) { return x.level >= 2; }).length;
  var subj = 'Late: ' + tN_(late.length, 'client', 'clients') + ' past the branch\'s own target' +
    (second ? ' (' + second + ' for the second time)' : '');
  var lines = late.map(function (x) {
    var row = x.row || {};
    return '- ' + (tText_(row.Client) || tText_(row['First name']) || 'a client') + ' · letter ' + (tText_(row.Segment) || '?') +
      (row.Agent ? ' · was with ' + tText_(row.Agent) : '') + ' · ' + tN_(x.days, 'working day', 'working days') + ' · ' + x.items.join(', ') +
      (x.level >= 2 ? (x.held ? ' · no note to the client: ' + x.held : ' · the client was sent the "still on it" note') : '');
  });
  var body = 'Still marked Open on Client Responses, past the branch\'s own target:\n\n' + lines.join('\n') +
    '\n\nMark each one on the assignment board (Called, Met, Declined, Closed), or type anything other than "Open" into ' +
    'Status on Client Responses once it is resolved: that stops the chase for that client.\n' +
    (TRANSITION.STILL_NOTE_AUTO !== true ? 'Since 6 October the "still on it" note is not sent by the system: a person who has read the file sends it ' +
      'from the board, once, by opening the client, marking the call, and ticking the note.\n' : '') +
    'https://rickyrampersadbranch.com/orphan-transition/assign.html\n\n' + T_INTERNAL;
  try { MailApp.sendEmail(to, subj, body, { name: TRANSITION.FROM_NAME }); } catch (e) {}
}

/** The client's own "still on it" note — only the second time, and only
 *  once, so it reassures rather than nags. Warm, not defensive, and signed
 *  by the team that answers. Takes the row already looked up; a null row
 *  (should not happen, tChase_ filters it out first) is simply skipped. */
function tChaseClient_(row, r, needs) {
  if (!row) return false;
  var to = tText_(row.Email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  var first = tText_(row['First name']) || 'there';
  var rc = tReceipt_(), care = tCare_(rc);
  var still = (rc && rc.json.still) || { subject: 'Still on it, {{first_name}}.',
    line: 'You have not been forgotten, and {{care_us}} is still on it. {{next}} We will ask again rather than assume, and you are welcome to reply here at any time.' };
  /* the client's own next step from receipt.json, never the branch's third-person note */
  var next = (rc && rc.json && rc.json.next && rc.json.next[r]) || needs;
  var vals = { 'First name': first, Token: tText_(row.Token), Segment: tText_(row.Segment), next: next,
               care_name: care.care_name, care_first: care.care_first, care_us: care.care_us, care_Us: care.care_Us, care_line: care.care_line };
  /* the words for what this client is waiting on (still.follow, 30 September): a call, a review or an agent
     gets the invitation to tell us, in their own words and on their own review link, what matters before an
     agent is named; a payment, a contract or an application gets its own line. An older receipt.json has
     only still.line. */
  var text = (still.follow && (still.follow[r] || still.follow['default'])) || still.line;
  /* the client's reference at the foot, so a reply from any address carries it back to their record (T_YOUR_REF) */
  var html = '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:520px">' + tHead_() +
    '<div style="padding:18px 4px 0"><p style="margin:0 0 12px">Dear ' + tEsc_(first) + ',</p>' +
    '<p style="margin:0 0 12px">' + tFill_(text, vals) + '</p>' +
    '<p style="margin:16px 0 0"><b style="display:block">' + tEsc_(care.care_name) + '</b>' + tEsc_(care.care_line) + '</p>' +
    (vals.Token ? '<p style="margin:14px 0 0;font-size:12px;color:#8a97a8">Your reference: ' + tEsc_(vals.Token) + '</p>' : '') +
    tLegal_(rc) + '</div></div>';
  if (!tMsCreds_()) { log_('transition', 'chase-client-held', T_MS_MISSING); return false; }
  try { tMsSend_(to, tFill_(still.subject, vals).replace(/<[^>]+>/g, ''), html, tClientOpts_()); return true; }
  catch (e) { log_('transition', 'chase-client-failed', String(e && e.message ? e.message : e)); return false; }
}

/** Chases what a client is still waiting on. Run from the digest — not from
 *  tSummary_, which the responses page polls every two minutes, so a chase is
 *  never fired twice by a page left open.
 *
 *  Client Responses has been recording taps since before this campaign —
 *  the site's original assign/review/question doors, going back months —
 *  and every one of those old rows still reads "Open" because nothing
 *  before 22 September ever looked at that column again. So the very first
 *  check on every row is whether its token is one this campaign's own
 *  Transition Send tab recognises; the token map is read once, not once per
 *  row. Anything else is passed over in silence — it was never this
 *  campaign's to chase.
 *
 *  One client, one chase (28 September): since the quick checks every answer
 *  is its own row, so a client who ticked four things has four Open rows, and
 *  the chase that worked row by row would have sent that client four "still
 *  on it" notes and the branch four nudges; run on the first weekend's
 *  answers it would have e-mailed 103 clients, 54 of them more than once,
 *  one of them fifteen times, and put some eighty nudges a day in one inbox.
 *  Now a client whose open answers are past WAIT goes on one internal list
 *  (tChaseSummary_, one e-mail a run); still open at WAIT × CHASE_MULT, the
 *  client gets one "still on it" note, once ever, whichever row carries the
 *  mark. The note is never sent to an address the sheet holds (anything in
 *  Exclude: bounced, an e-mail taken by phone awaiting the go, a check), to a
 *  client with no e-mail, or when the answers look automated (the mail
 *  scanner that ticked every box for a client who wrote in on 26 September
 *  to say she had sent none of them): those are marked held, with the
 *  reason, and listed for the branch instead.
 *
 *  Stops the moment Status reads anything other than "Open" — how the branch
 *  marks a concern resolved, and what the assignment board writes. The level
 *  is recorded in each row's own Note cell, appended, never overwritten, so a
 *  human note already there survives. CHASE_MAX_PER_RUN bounds the client
 *  notes one run sends, so a pile of late answers is worked through over
 *  several runs rather than risking the six-minute ceiling. */
function tChase_() {
  var out = { chase1: 0, chase2: 0, held: 0, skipped: 0, deferred: 0 };
  var sh, last;
  try { sh = ss_().getSheetByName(SVC.RESP_SHEET); last = sh ? sh.getLastRow() : 0; } catch (e) { return out; }
  if (!sh || last < 2) return out;
  var vals;
  try { vals = sh.getRange(2, 1, last - 1, 11).getValues(); } catch (e) { return out; }
  var tokens = tTokenMap_(), now = new Date(), groups = {}, order = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i], token = String(v[1] || '').trim();
    if (!token) continue;
    var isOpen = String(v[7] || '').trim().toLowerCase() === 'open';
    if (!tokens[token]) { if (isOpen) out.skipped++; continue; }     // not this campaign's token: never chased
    if (tYes_(tokens[token].Test)) continue;                           // a colleague standing in as a client: never chased
    if (tAssignRow_(v[5]) || tCallRow_(v[5])) continue;                // an agent named, or a call logged, from the board: the client asked nothing, so nothing to chase
    var g = groups[token];
    if (!g) { g = groups[token] = { row: tokens[token], all: [], open: [], did2: false }; order.push(token); }
    var note = String(v[10] || ''), page = String(v[5] || '');
    var x = { rowNum: i + 2, received: v[0] instanceof Date ? v[0] : null, r: String(v[3] || '').trim().toLowerCase(),
              needs: String(v[4] || ''), q: tQOf_(page), note: note, assigned: String(v[8] || '').trim(),
              via: String(v[6] || '').indexOf('reply ') === 0, phone: page.indexOf('/your-policy/phone') === 0 };
    g.all.push(x);
    if (note.indexOf('[chase2]') >= 0) g.did2 = true;               // the client's note goes once, ever
    if (isOpen && x.received) g.open.push(x);
  }
  var rc, late = [], budget = TRANSITION.CHASE_MAX_PER_RUN, hold = tClientMailHeld_();
  /* an agent named in Salesforce, or typed on the Household Assignments tab, holds the note as the board's name does (1 October) */
  var haAgent = {};
  try { var hax = tHaRead_(); if (hax) hax.rows.forEach(function (r) { if (r.token && r.agent) haAgent[r.token] = r.agent; }); } catch (e) {}
  var mark = function (x, add) {
    if (x.note.indexOf(add.split(' ')[0]) >= 0) return;
    x.note = (x.note ? x.note + ' ' : '') + add;
    try { sh.getRange(x.rowNum, 11).setValue(x.note); } catch (e) {}
  };
  for (var k = 0; k < order.length; k++) {
    var g = groups[order[k]];
    if (!g.open.length) continue;
    var due1 = [], due2 = false, days = 0;
    g.open.forEach(function (x) {
      var wait = x.r === 'urgent' ? TRANSITION.WAIT_URGENT : TRANSITION.WAIT_DAYS, d = tWorkingDays_(x.received, now);
      if (d < wait) return;
      days = Math.max(days, d);
      if (x.note.indexOf('[chase1]') < 0) due1.push(x);
      if (d >= wait * TRANSITION.CHASE_MULT) due2 = true;
    });
    due2 = due2 && !g.did2;
    if (due2 && budget <= 0) { out.deferred++; due2 = false; }       // over the cap: the note waits for the next run
    if (due2 && hold) { out.deferred++; due2 = false; }              // client e-mail on hold: the note stays due
    if (!due1.length && !due2) continue;
    var held = '';
    if (due2) {
      if (rc === undefined) rc = tReceipt_() || null;
      var to = tText_(g.row.Email);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) held = 'no e-mail on file';
      else if (tText_(g.row.Exclude)) held = 'the send row is held (' + tText_(g.row.Exclude).slice(0, 40) + ')';
      /* a client who wrote to us in their own words is owed a person's reply, not a template beside it (30 September) */
      else if (g.all.some(function (x) { return x.q === 'wrote'; })) held = 'they wrote to us in their own words: a person replies';
      /* an agent already named: the note says we are about to name one, so it waits on the agent's call instead (1 October) */
      else if (g.all.some(function (x) { return x.assigned; })) held = 'an agent is named (' + g.all.filter(function (x) { return x.assigned; })[0].assigned + '): the agent follows up';
      else if (haAgent[order[k]]) held = 'an agent is named (' + haAgent[order[k]] + '): the agent follows up';
      else if (rc && tLooksAutomated_(rc, g.all)) held = 'the answers look automated';
      /* three automatic e-mails, then a person (6 October 2026): the note is a person's press on the board now (tStillClient_) */
      else if (TRANSITION.STILL_NOTE_AUTO !== true) held = 'automatic notes are off since 6 October: a person sends it from the board';
      else if (!tMsCreds_()) held = T_MS_MISSING;
      if (!held) {
        var top = g.open.slice().sort(function (a, b) {
          return ((T_PRIORITY[b.q] || T_PRIORITY[b.r] || 0) - (T_PRIORITY[a.q] || T_PRIORITY[a.r] || 0)) || (a.received - b.received);
        })[0];
        /* a note Microsoft refused is said so on the branch's list, never counted as sent */
        var went = false;
        try { went = tChaseClient_(g.row, top.r, top.needs); }
        catch (e) { held = 'the note failed (' + String(e && e.message ? e.message : e).slice(0, 60) + ')'; }
        if (went) { out.chase2++; budget--; } else if (!held) held = 'the note did not send (the log says why)';
      }
      if (held) out.held++;
      g.open.forEach(function (x) { mark(x, '[chase1]'); mark(x, held ? '[chase2] held: ' + held : '[chase2]'); });
    } else {
      due1.forEach(function (x) { mark(x, '[chase1]'); });
      out.chase1++;
    }
    var items = [];
    g.open.forEach(function (x) { var w = x.q || x.r; if (items.indexOf(w) < 0) items.push(w); });
    late.push({ row: g.row, days: days, level: due2 ? 2 : 1, held: held, items: items });
  }
  tChaseSummary_(late);
  if (late.length || out.skipped || out.deferred) {
    log_('transition', 'chase', out.chase1 + ' late (branch told), ' + out.chase2 + ' clients sent the still-on-it note, ' +
      out.held + ' held from the client, ' + out.skipped + ' not this campaign, ' + out.deferred + ' left for the next run');
  }
  return out;
}

/* ── the send ──────────────────────────────────────────────── */
function transitionSendBatch(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'another send is running';
  try { return tSendBatch_(force); } finally { lock.releaseLock(); }
}

function tSendBatch_(force) {
  var tz = tTz_(), now = new Date(), deadline = Date.now() + (Number(TRANSITION.RUN_BUDGET_MS) || 300000);
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
  if (tClientMailHeld_()) {                                   // the manager's hold: before any row is touched, a press by hand included
    log_('transition', 'held', 'client e-mail on hold: no letters or reminders sent');
    return tSay_('Client e-mail is on hold: no letters or reminders sent. The go is transitionReleaseClientMail.');
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
  /* one inbox, one letter a day. Until 29 September 2026 a family sharing an e-mail got the first member's letter and
     the rest were held for good ("check: same e-mail as row N", which the next run only held again). The manager's
     choice that day: a family member gets their own letter at the shared inbox on a later day, never two the same
     day; someone sharing an inbox under a different surname is held for Client Support to confirm the address, since
     the inbox may be an office's or a relative's, unless a person already confirmed it on a call (the Reason a
     phone e-mail leaves, "e-mail taken by …"). */
  var firstAt = {}, sentTo = {}, busy = {};
  t.rows.forEach(function (r) {
    var mail = tText_(r.Email).toLowerCase(), sa = r['Sent at'];
    if (!mail || !tText_(sa)) return;
    if (!firstAt[mail] || tSentMs_(r) < tSentMs_(firstAt[mail])) firstAt[mail] = r;   // the inbox's first letter by date, however the tab is sorted
    (sentTo[mail] = sentTo[mail] || []).push(r);
    if (sa instanceof Date && !isNaN(sa.getTime()) && Utilities.formatDate(sa, tz, 'yyyy-MM-dd') === today) busy[mail] = r._row;
    /* a reminder or a letter sent again in an earlier run today counts too: Sent at keeps the first letter's date, so
       without this two family members at one inbox had their reminders on one day, half an hour apart (the rehearsal
       of 30 September 2026, on five inboxes of Tricia Baksh's book) */
    var st = tText_(r.Status);
    if (/^(reminded|sent again) \d{4}-\d{2}-\d{2}$/i.test(st) && st.slice(-10) === today) busy[mail] = r._row;
  });
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
    /* the same person under another client number, whoever had the inbox's first letter: that letter was theirs */
    var twin = (sentTo[mail] || []).filter(function (s) { return s._row !== r._row && tSamePerson_(s, r); })[0];
    if (twin) { tHoldRow_(t, r, tSameCheck_(twin)); return false; }
    /* a different surname first, so Client Support has the row at once, whatever else the inbox had today */
    var f = firstAt[mail];
    if (f && f._row !== r._row && !tSameFamily_(f, r) && !/^e-mail taken by/i.test(tText_(r.Reason))) {
      tHoldRow_(t, r, tInboxCheck_(f)); return false;
    }
    if (busy[mail]) return false;                                 // this inbox has had its letter today: a later run day, nothing marked
    busy[mail] = r._row;
    return true;
  });
  due.sort(function (a, b) { return tOrder_(a) - tOrder_(b) || a._row - b._row; });
  var res = tSendRows_(t, due.slice(0, cap), letters, deadline);
  var waiting = Math.max(0, due.length - cap) + res.left;
  var msg = res.sent + ' sent, ' + res.skipped + ' skipped, ' + res.failed + ' failed, ' + waiting + ' waiting for the next run' +
    (res.left ? ' (' + res.left + ' of this batch left at the five-minute budget)' : '');
  /* the rows a person ticked in "Send again", then the reminders, with what is left of the run's cap and time: never
     before the day's new letters, and never able to stop them — a failure in either is logged alone */
  var used = Math.min(cap, due.length);
  var again = { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  try { again = res.left ? again : tSendAgain_(t, letters, cap - used, deadline, busy); }
  catch (err) { log_('transition', 'send-again-failed', String(err && err.message ? err.message : err)); }
  if (again.sent || again.skipped || again.failed || again.waiting) {
    msg += '; sent again: ' + again.sent + ' sent, ' + again.skipped + ' held, ' + again.failed + ' failed, ' + again.waiting + ' waiting';
  }
  used += again.sent + again.skipped + again.failed;
  var rem = { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  try { rem = (res.left || again.waiting) ? rem : tRemind_(t, letters, cap - used, deadline, busy); }
  catch (err) { log_('transition', 'remind-failed', String(err && err.message ? err.message : err)); }
  if (rem.sent || rem.skipped || rem.failed || rem.waiting) {
    msg += '; reminders: ' + rem.sent + ' sent, ' + rem.skipped + ' held, ' + rem.failed + ' failed, ' + rem.waiting + ' waiting';
  }
  log_('transition', 'batch', msg);
  return msg;
}

/* ── the reminder: the same letter once more, to anyone who has not answered ── */
/** Runs at the end of every batch, after the day's new letters and inside
 *  the same cap. A row sent REMIND_DAYS or more ago, still marked 'sent', whose
 *  token has no row on Client Responses and no review, gets its own letter again
 *  with sent_on set — the line above the greeting says when the first went, the
 *  subject says "Reminder:" — and its Status becomes 'reminded <date>', so it is
 *  never reminded twice. Sent at is left as it was: it is the first send's date,
 *  and the reason the batch never picks the row up again. Bounded by
 *  REMIND_MAX_PER_RUN. (25 September 2026: a reminder at three to six weeks is
 *  what the FCA's letter trial found lifted response most; see CLAUDE.md. 29
 *  September: the manager chose five days.) Never to an inbox that had a
 *  letter today (`busy`, the batch's own map), so a family sharing one never
 *  gets two in a day; a bounced row is held in Exclude and never reminded.
 *  Nor is a client who responded any other way since their letter went
 *  (tRespondedAt_: Client Support spoke to them, or a review came in from
 *  their address), and a person can stop one by hand by typing anything
 *  but "sent" in Status. */
function tRemind_(t, letters, cap, deadline, busy) {
  var days = Number(TRANSITION.REMIND_DAYS) || 0;
  cap = Math.min(Number(cap) || 0, TRANSITION.REMIND_MAX_PER_RUN);
  if (cap <= 0 || days <= 0) return { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  if (deadline && Date.now() > deadline) return { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  var tz = tTz_(), now = new Date();
  var cutoff = new Date(now.getTime() - days * 86400000);
  /* strict: when Client Responses or the reviews cannot be read, this run reminds nobody (the batch logs it as
     remind-failed) rather than taking everyone for unanswered. 7 October 2026, the manager: clients who responded must
     never get the reminder; on that morning's sheet one such run would have sent 120, every one to a client who had
     answered. */
  var answered = tAnswered_(true), since = tRespondedAt_(true);
  busy = busy || {};
  var due = t.rows.filter(function (r) {
    if (tHeld_(r.Exclude) || tYes_(r.Test) || !tText_(r.Segment)) return false;
    if (tText_(r.Status).toLowerCase() !== 'sent') return false;             // reminded, sent again, bounced, error, check: not again
    var at = r['Sent at'];
    if (!(at instanceof Date) || isNaN(at.getTime()) || at.getTime() > cutoff.getTime()) return false;
    var tok = tText_(r.Token), mail = tText_(r.Email).toLowerCase();
    if (!tok || answered[tok]) return false;
    /* responded another way since the letter went: Client Support spoke to them, or a review came in from their address */
    var spoke = since.spoke[tok], rev = since.review[mail];
    if ((spoke && spoke.getTime() > at.getTime()) || (rev && rev.getTime() > at.getTime())) return false;
    if (tHold_(r, letters)) return false;
    if (busy[mail] && busy[mail] !== r._row) return false;                   // that inbox has had its letter today
    busy[mail] = r._row;
    return true;
  });
  due.sort(function (a, b) { return tOrder_(a) - tOrder_(b) || a._row - b._row; });
  var sent = 0, skipped = 0, failed = 0, left = 0;
  due.slice(0, cap).forEach(function (r) {
    if (left || (deadline && Date.now() > deadline)) { left++; return; }   // the time budget: the rest waits for the next run
    var t0 = Date.now();
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
    tPace_(t0);
  });
  return { sent: sent, skipped: skipped, failed: failed, waiting: Math.max(0, due.length - cap) + left };
}

/* ── "Send again": a person ticks a row, the next run sends that client's letter once more ── */
/* Asked for on 29 September 2026: a way, in the tab, to send a client the survey again when nothing came back. The
   column holds tick boxes; tAgainCol_ adds it the first time the five-minute run finds none. */
var T_AGAIN = 'Send again';
/** The column's number, adding it (with tick boxes) at the end of the tab when it is not there. */
function tAgainCol_() {
  var sh = tSheet_(), lastCol = sh.getLastColumn();
  if (!lastCol) return 0;
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var i = head.indexOf(T_AGAIN);
  if (i >= 0) return i + 1;
  if (sh.getMaxColumns() <= lastCol) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
  var c = lastCol + 1;
  sh.getRange(1, c).setValue(T_AGAIN);
  try { sh.getRange(1, c).setFontWeight('bold'); } catch (e) {}
  try { sh.getRange(2, c, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()); } catch (e) {}
  log_('transition', 'send-again', 'the "' + T_AGAIN + '" column is on ' + TRANSITION.SHEET + ', column ' + c);
  return c;
}
/** The rows a person ticked in "Send again": each client's own letter once more, now, whatever its Send on and
 *  whether or not the client answered, because a person asked for it. A row sent before goes with the line saying
 *  when the first went and "Reminder:" in the subject, as tRemind_ sends it; a row never sent goes as its first
 *  letter. Every hold still stands: the manager's hold on client e-mail (the batch never gets this far), anything in
 *  Exclude (bounced, a check, an e-mail waiting for the go), a Test row, no letter for the segment, and one letter an
 *  inbox a day. A held row keeps its tick and goes once the hold is lifted. Sent, the tick is cleared and Status reads
 *  'sent again <date>', which also keeps the automatic reminder from following it. */
function tSendAgain_(t, letters, cap, deadline, busy) {
  var out = { sent: 0, skipped: 0, failed: 0, waiting: 0 };
  var c = t.col[T_AGAIN];
  cap = Number(cap) || 0;
  if (!c || cap <= 0 || (deadline && Date.now() > deadline)) return out;
  var tz = tTz_(), stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  busy = busy || {};
  var ticked = t.rows.filter(function (r) { return tYes_(r[T_AGAIN]); });
  var due = ticked.filter(function (r) {
    if (tHeld_(r.Exclude) || tYes_(r.Test) || !tText_(r.Segment)) return false;
    if (tHold_(r, letters)) return false;
    var mail = tText_(r.Email).toLowerCase();
    if (busy[mail] && busy[mail] !== r._row) return false;          // that inbox has had its letter today
    busy[mail] = r._row;
    return true;
  });
  due.sort(function (a, b) { return tOrder_(a) - tOrder_(b) || a._row - b._row; });
  var left = 0;
  due.slice(0, cap).forEach(function (r) {
    if (left || (deadline && Date.now() > deadline)) { left++; return; }
    var t0 = Date.now(), row = {};
    var before = r['Sent at'] instanceof Date && !isNaN(r['Sent at'].getTime());
    try {
      tEnsureToken_(t, r);
      for (var k in r) row[k] = r[k];
      if (before) row.sent_on = Utilities.formatDate(r['Sent at'], tz, 'd MMMM yyyy');
      var res = tSendRow_(row, letters);
      if (res === 'sent') {
        out.sent++;
        tMark_(t, r, before ? 'sent again ' + stamp : 'sent', !before);   // a first letter is an ordinary send, reminded like any other
        var untick = r[T_AGAIN] === true ? false : '';                   // a tick box stays a tick box
        t.sh.getRange(tAt_(t, r), c).setValue(untick);
        r[T_AGAIN] = untick;
      } else { out.skipped++; tMark_(t, r, 'send again held: ' + res, false); }
    } catch (err) {
      out.failed++;
      tMark_(t, r, 'send again error: ' + String(err && err.message ? err.message : err).slice(0, 100), false);
    }
    tPace_(t0);
  });
  out.waiting = Math.max(0, due.length - cap) + left;
  return out;
}

/** The other ways a client responds, for the reminder alone. 30 September 2026, the manager, keeping the five-day
 *  reminder: "if they have answered or responded please ensure we dont resent". Returns the last time Client Support
 *  spoke to a client (a contact row, tContactRow_), by token, and the last review filed from an e-mail address, by
 *  address, for a review filled in without the letter's link. A client who spoke to us, or wrote a review from their
 *  address, after their letter went has responded, and gets no reminder. A call before the letter (an e-mail taken
 *  for a client the letter had not reached) is not a response to it: that client's first letter goes, and its
 *  reminder after it. Never throws unless strict (the reminder asks strictly): a tab that cannot be read records nobody. */
function tRespondedAt_(strict) {
  var out = { spoke: {}, review: {} };
  var later = function (m, k, d) { if (k && d instanceof Date && !isNaN(d.getTime()) && (!m[k] || d.getTime() > m[k].getTime())) m[k] = d; };
  try {
    tSheetRows_(SVC.RESP_SHEET).rows.forEach(function (v) {
      if (tContactRow_(v[5]) || tSpokeCall_(v[5], v[7])) later(out.spoke, String(v[1] || '').trim(), v[0]);
    });
  } catch (e) { if (strict) throw e; }
  try {
    var q = tSheetRows_(SVC.IND_SHEET), qi = {};
    q.head.forEach(function (h, i) { qi[h] = i; });
    if (qi.Email !== undefined && qi.Timestamp !== undefined) q.rows.forEach(function (v) {
      later(out.review, String(v[qi.Email] || '').trim().toLowerCase(), v[qi.Timestamp]);
    });
  } catch (e) { if (strict) throw e; }
  return out;
}

/** Every token that has answered: a row on Client Responses, or a review whose
 *  Link ref carries it. Read once per run. Never throws unless strict: a tab
 *  that cannot be read counts nobody as answered. The reminder asks strictly
 *  (tRemind_), so a run that cannot read the answers reminds nobody instead of
 *  everybody (7 October 2026). An e-mail or a number taken on a call is not an
 *  answer, and nor is an agent named from the board (tOursRow_): that client
 *  gets the letter, and the follow-up after it, like anyone. */
function tAnswered_(strict) {
  var map = {};
  try {
    tSheetRows_(SVC.RESP_SHEET).rows.forEach(function (v) {
      var tok = String(v[1] || '').trim();
      if (tok && !tOursRow_(v[5])) map[tok] = 1;
    });
  } catch (e) { if (strict) throw e; }
  try {
    var q = tSheetRows_(SVC.IND_SHEET), qi = {};
    q.head.forEach(function (h, i) { qi[h] = i; });
    if (qi['Link ref'] !== undefined) q.rows.forEach(function (v) {
      var m = /^transition:(\S+)$/.exec(String(v[qi['Link ref']] || '').trim());
      if (m) map[m[1]] = 1;
    });
  } catch (e) { if (strict) throw e; }
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
  /* a Test row that had its letter before also gets the reminder version, as the
     clients written to on 25 September get theirs (30 September 2026: "before
     anything goes out want to send to the test team"): the first letter's date
     is read before the send stamps today's */
  var before = {};
  rows.forEach(function (r) { if (r['Sent at'] instanceof Date && !isNaN(r['Sent at'].getTime())) before[r._row] = r['Sent at']; });
  var res = tSendRows_(t, rows, letters);
  var rem = 0, remFailed = 0;
  rows.forEach(function (r) {
    if (!before[r._row]) return;
    var row = {};
    for (var k in r) row[k] = r[k];
    row.sent_on = Utilities.formatDate(before[r._row], tTz_(), 'd MMMM yyyy');
    var t0 = Date.now();
    try { if (tSendRow_(row, letters) === 'sent') rem++; } catch (err) { remFailed++; }
    tPace_(t0);
  });
  var msg = 'Test: ' + res.sent + ' sent, ' + res.skipped + ' skipped, ' + res.failed + ' failed' +
    (rem || remFailed ? '; the reminder version to ' + rem + (remFailed ? ' (' + remFailed + ' failed)' : '') : '') + '.';
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

/** The follow-up note to the Test rows, exactly as the chase sends it to a client (30 September 2026: "can i see a
 *  test"): the same function, sender, CC and subject. Each Test row gets the version its letter most often brings (J
 *  the contract line, K and T1 the application line, I the payment line, every other letter the invitation to tell
 *  us in their own words before an agent is named, on a review link carrying that row's token). Nothing is marked on
 *  any tab and the hold does not apply (the Test rows are colleagues), so it can be pressed again. A reply to it
 *  files on that Test row through the reference at its foot; a review sent from its link lands on that row's record. */
var T_STILL_TEST = { J: 'deliver', K: 'finish', T1: 'finish', I: 'paid' };
function transitionStillTest() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return tSay_('another send is running');
  try { return tStillTest_(); } finally { lock.releaseLock(); }
}

function tStillTest_() {
  try { tMsToken_(); } catch (err) { return tStop_('sender-not-ready', err); }
  var rc = tReceipt_();
  if (!rc || !rc.json.still || !rc.json.still.follow) {
    return tSay_('The site is still serving the old follow-up words. Merge the branch, give the site two minutes, then run this again.');
  }
  var t;
  try { t = tRead_(); } catch (err) { return tStop_('stopped', err); }
  var rows = t.rows.filter(function (r) { return tYes_(r.Test) && !tHeld_(r.Exclude) && tText_(r.Segment); });
  if (!rows.length) return tSay_('No rows marked Test = Y.');
  var sent = [], failed = 0;
  rows.forEach(function (r) {
    var tap = T_STILL_TEST[tText_(r.Segment).toUpperCase()] || 'callme', t0 = Date.now();
    if (tChaseClient_(r, tap, '')) sent.push(tText_(r['First name']) + ' (' + tText_(r.Segment).toUpperCase() + ')');
    else failed++;
    tPace_(t0);
  });
  var msg = 'Follow-up note test: sent to ' + sent.length + (sent.length ? ': ' + sent.join(', ') : '') +
    (failed ? '. ' + failed + ' did not send: the log says why' : '') + '. Nothing was marked on any tab.';
  log_('transition', 'still-test', msg);
  return tSay_(msg);
}

/* ── what comes back ──────────────────────────────────────────────── */
/** Whether a code opens the page, and whether any code could — the branch
 *  code in Service.gs or a Portal code on the Agent Skill Bank. */
/** The wall, the dashboard and the responses page: the branch code only. Their one answer carries every client's
 *  name and answers, so an agent's own code never opens it (1 October 2026, when the codes were handed out): an agent
 *  sees their own clients on the assignment board, with their agent number and code (tWho_). */
function tCodeOk_(code) {
  code = String(code || '').trim().toUpperCase();
  var branch = String(SVC.TEAM_CODE || '').trim().toUpperCase();
  return { ok: !!(branch && code === branch), configured: !!branch };
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
  /* a board request reads each tab once (transitionBoard_, 7 October 2026): the households, the 24 September plan and the
     assignments all read Household Assignments, three reads of the same tab on every sign-in */
  var key = 'rows:' + name;
  if (T_READ_ONCE && T_READ_ONCE[key]) return T_READ_ONCE[key];
  var sh = ss_().getSheetByName(name), out = { head: [], rows: [] };
  if (sh && sh.getLastRow() >= 2) {
    var vals = sh.getDataRange().getValues();
    out = { head: vals[0].map(function (h) { return String(h).trim(); }), rows: vals.slice(1) };
  }
  if (T_READ_ONCE) T_READ_ONCE[key] = out;
  return out;
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
    if (tOursRow_(v[5])) return;                                // an e-mail or a number taken on a call, an agent named from the board: not a tap
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
    armed: tArmed_(), runs: tRuns_(40),   // a day of half-hour batches and their receipts, for the dashboard's timeline (was 6)
    assign: tHaWallSafe_(byTok, resp.rows, tz, now),   // the wall's three assignment slides (1 October 2026)
  };
}

function transitionData_(code) {
  var c = tCodeOk_(code);
  if (!c.ok) {
    return { ok: false, refused: true, error: c.configured
      ? 'That code does not open this page. Use the branch code. An agent sees their own clients on the assignment board.'
      : 'Not open yet: the branch code is not set. Put it into TEAM_CODE in Service.gs, then publish a New version.' };
  }
  /* one answer serves every screen for thirty seconds: the wall, the dashboard and
     the responses page each ask every minute or two, and the summary reads three
     tabs (25 September 2026, the go-live afternoon: seven seconds an answer, and
     one request in eight lost to the web app's own timeout while several screens
     polled at once) */
  var cache = null, key = 'transition:summary';
  try { cache = CacheService.getScriptCache(); var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  try {
    var out = tSummary_();
    try { if (cache && out && out.ok) cache.put(key, JSON.stringify(out), 30); } catch (e) {}
    return out;
  }
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
  contact_yes: 'their former agent has been in touch since leaving',   // every letter asks it since 30 September 2026, T's book and the resigned books alike
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
  /* the call list: a client with no e-mail on file is held from the send and called instead; the caller ticks the
     answers on the client's own link, so they arrive on Client Responses like a tap. Counted on their own, never
     among the letters sent, so the response rate stays the letters' rate. */
  var calls = { listed: 0, reached: 0, approached: 0, bySegment: {} };
  t.rows.forEach(function (r) {
    var seg = tText_(r.Segment).toUpperCase();
    if (!seg || tYes_(r.Test)) return;                                     // staff standing in as clients: never in the numbers
    if (tHeld_(r.Exclude)) {
      reach.held++;
      var why = (tText_(r.Exclude) || 'held').split(':')[0].toLowerCase();
      reach.heldReasons[why] = (reach.heldReasons[why] || 0) + 1;
      if (/^no e-?mail/.test(why)) {
        calls.listed++;
        var cs = calls.bySegment[seg] = calls.bySegment[seg] || { key: seg, listed: 0, reached: 0 };
        cs.listed++;
        var ctok = tText_(r.Token);
        if (ctok) byTok[ctok] = { seg: seg, family: famOf(seg), agent: tText_(r.Agent) || '(no agent on the sheet)', channel: 'call',
          client: tText_(r.Client) || tText_(r['First name']) || 'a client', sentAt: null, remindedOn: null,
          answered: false, first: null, afterReminder: false, codes: [], taps: [], risk: [], open: false, assigned: '', lastSaid: '', lastAt: null };
      }
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
    if (tAssignRow_(v[5])) return;                                        // an agent named from the board: the branch's note, not an answer
    if (tCallRow_(v[5])) { if (o.channel === 'call' && tSpokeCall_(v[5], v[7])) o.reached = true; return; }   // a call logged from the board: not an answer
    if (tContactRow_(v[5])) { if (o.channel === 'call') o.reached = true; return; }   // taken on a call: reached, not an answer
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
    if (o.channel === 'call') {                                            // reached by phone: its own count, and the risk list
      if (!o.answered && !o.reached) return;
      calls.reached++; calls.bySegment[o.seg].reached++;
      var capp = o.risk.indexOf('approached_yes') >= 0 || o.risk.indexOf('contact_yes') >= 0 || o.risk.indexOf('review_approached') >= 0;
      if (capp) calls.approached++;
      if (o.risk.length) {
        risk.push({ client: o.client, agent: o.agent, seg: o.seg + ' (by phone)', open: o.open, assigned: o.assigned,
                    said: o.risk.map(function (c) { return T_RISK[c] || c; }).join('; '),
                    when: o.lastAt || o.first, days: o.lastAt ? tWorkingDays_(o.lastAt, now) : 0 });
      }
      return;
    }
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
    if (o.first && o.sentAt) {
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
        ' someone has already approached them' + (told1('contact', 'contact_yes') ? ', or that their former agent has been in touch since leaving' : '') +
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
  if (calls.listed) lines.push('The call list: ' + tN_(calls.listed, 'client', 'clients') + ' with no e-mail on file, ' + calls.reached + ' reached and recorded by phone so far' +
    (calls.approached ? ', ' + calls.approached + ' of them approached' : '') + '.');
  if (reach.failed) lines.push(tN_(reach.failed, 'letter failed to send and is', 'letters failed to send and are') + ' retried the next day; the reason is in ' + (reach.failed === 1 ? 'its' : 'their') + ' Status cell.');

  return {
    at: Utilities.formatDate(now, tz, 'd MMM yyyy HH:mm'), day: Utilities.formatDate(now, tz, 'd MMMM yyyy'), windowDays: windowDays || 7, tz: tz,
    reach: reach, response: response, rate: tPct_(response.answered, reach.sent), curve: curve, told: toldList, byType: byType,
    reviews: reviews, follow: follow, risk: risk.slice(0, 40), riskTotal: risk.length, riskOpen: riskOpen,
    byFamily: list('family', function (a, b) { return b.sent - a.sent; }),
    bySegment: list('segment', function (a, b) { return a.key < b.key ? -1 : 1; }),
    byAgent: list('agent', function (a, b) { return (b.approached - a.approached) || (b.risk - a.risk) || (b.sent - a.sent); }),
    calls: { listed: calls.listed, reached: calls.reached, approached: calls.approached,
             bySegment: Object.keys(calls.bySegment).sort().map(function (k) { return calls.bySegment[k]; }) },
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
    (a.armed ? '' : '<p style="margin:0 0 14px;padding:10px 14px;background:#fdeeea;border-left:4px solid #b3261e;color:#8a3324"><b>The send is off.</b> Nothing sends until Service Questionnaire &rarr; Transition: go live.</p>') +
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
  if (a.calls && a.calls.listed) {
    out += h3('By phone: the clients with no e-mail on file') + '<p style="margin:0 0 6px">' + a.calls.listed + ' on the call list &middot; ' + a.calls.reached +
      ' reached and recorded on their own link' + (a.calls.approached ? ' &middot; ' + a.calls.approached + ' approached' : '') + '</p>' +
      table(['Letter', 'On the list', 'Reached'], a.calls.bySegment.map(function (g) { return ['<b>' + esc(g.key) + '</b>', g.listed, g.reached]; }));
  }
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
      '<b>The send is off.</b> The Test rows still go by hand; nothing else sends until Service Questionnaire &rarr; Transition: go live.</p>') +
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

/* ── the assignment board ───────────────────────────────────────────── */
/* Asked for on 26 September 2026 ("a link for who you are going to assign
   which agent to meet with the client, an agent's login view and a manager's
   login view, on these codes"): orphan-transition/assign.html, beside the
   dashboard. The branch code opens the whole board; an agent's own portal
   code from the Agent Skill Bank opens their list; the branch code with a
   name (`who`) opens that agent's list, the way the agent portal works
   (agentAuth_ in Service.gs). Nothing here is a new column: a name goes into
   Assigned to and Assigned on on the client's rows of Client Responses, which
   is what the responses page, the digest, the chase and the reports already
   read, and an outcome goes into Status, which is what stops the chase. */
var T_STATUSES = ['Open', 'Called', 'Met', 'Declined', 'Closed'];   // what a person may mark; "No answer" is a note only, the row stays Open
/* how pressing a client is, from the most pressing thing they said: the order the board lists them in */
var T_PRIORITY = { urgent: 100, contact_yes: 95, approached_yes: 90, review_approached: 90, paid: 85, pay_person: 80, pay: 80, pay_unsure: 70,
  contract_missing: 70, deliver: 70, review: 65, contract_unsure: 60, k_outstanding: 60, finish: 60, k_stop: 55, stop: 55, k_unsure: 55, claim: 55,
  callme: 50, stay_talk: 50, rate_better: 50, life_changed: 45, question: 45, wrote: 45, assign: 45,
  pays_confirm: 40, walk_yes: 40, built_yes: 40, more_yes: 40, value_yes: 40 };

/* ── households: the family on our list beside each card ──────────────── */
/* 29 September 2026: "group by addresses … assign a household number so we can see whom from the household
   responded". The Households tab (Token, Household, …) is built in the session scratchpad by the reassignment's own
   rule (build-households.py: same address, same phone or same e-mail; a key more than six clients share is an office,
   not a family; a departed agent's or a staff member's own contact details never link anyone) and imported into this
   sheet. The board reads it so a card shows the family on our list and who of them has answered, the family can be
   named to one agent in one press, and what a client tells us the rule missed is linked from the board
   (transitionUpdate_ with family=, tLinkFamily_). Addresses on file differ in form (a house number on one policy, a
   light-pole number on the spouse's), which is why the link exists at all. */
var T_HH_SHEET = 'Households';
/** The Households tab as { byTok: { token: household }, rows: [{ hh, token, no, client, with, head }] }. Since 29 September
 *  2026 ("include the wife cover … anyone else who is covered in the household") a household also holds the branch's
 *  other clients at the same address, phone or e-mail, who have no token (they are not on the send list) and are known
 *  by client number, with the agent who looks after them in Was with; Head marks the member it is named after. */
/* 7 October 2026 ("aren't we assigning households?"): the Households tab was never imported into the live sheet, so the
   board showed no family and "Select the family" never appeared. The Household Assignments tab (T_HA, imported on
   1 October for the wall) carries the same households, by the same rule, one row a client of the books, so the board
   reads it when there is no Households tab. It has no family members outside the books, so a household read from it
   shows the clients on our list only. */
function tHouseholds_() {
  var out = { byTok: {}, rows: [] };
  var read = function (name) {
    try {
      var t = tSheetRows_(name), ix = {};
      t.head.forEach(function (h, i) { ix[String(h).trim().toLowerCase()] = i; });
      if (ix.household === undefined || (ix.token === undefined && ix['client number'] === undefined)) return;
      var g = function (v, k) { return ix[k] !== undefined ? v[ix[k]] : ''; };
      t.rows.forEach(function (v) {
        var hh = String(g(v, 'household') || '').trim(), tok = String(g(v, 'token') || '').trim(), no = tCno_(g(v, 'client number'));
        if (!hh || (!tok && !no)) return;
        if (tok) out.byTok[tok] = hh;
        out.rows.push({ hh: hh, token: tok, no: no, client: String(g(v, 'client') || '').trim(), with: String(g(v, 'was with') || '').trim(), head: tYes_(g(v, 'head')) });
      });
    } catch (e) {}
  };
  read(T_HH_SHEET);
  if (!out.rows.length) read(T_HA.SHEET);
  return out;
}
/** Where a family member who has not answered stands, from their own send row. */
function tMemberState_(r) {
  var ex = tText_(r.Exclude), sent = r['Sent at'];
  if (/^no e-mail/i.test(ex)) return 'no e-mail';
  if (/^check: same e-mail/i.test(ex)) return 'shares an inbox, no letter of their own';
  if (/^check: shares an inbox/i.test(ex)) return 'shares an inbox, address to confirm';
  if (/^check: same name and inbox/i.test(ex)) return 'the same person as a family member, by name: no second letter';
  if (ex === T_PHONE_HOLD) return 'e-mail taken by phone, waiting for the go';
  if (!ex && /^shares an inbox with/i.test(tText_(r.Reason)) && !(sent instanceof Date ? !isNaN(sent.getTime()) : tText_(sent))) return 'shares an inbox: own letter after the go';
  if (/^bounced/i.test(ex)) return 'letter bounced';
  if (ex) return 'held: ' + ex.slice(0, 40);
  if (sent instanceof Date ? !isNaN(sent.getTime()) : tText_(sent)) return 'written to, no answer yet';
  return 'not written to yet';
}
/** The one thing a client said that matters most, for the family line on a card. */
function tSaid_(c) {
  var best = null;
  (c.answers || []).forEach(function (a) { var p = T_PRIORITY[a.code] || 0; if (!best || p > best.p) best = { p: p, t: a.a }; });
  (c.taps || []).forEach(function (x) { var p = T_PRIORITY[x.tap] || 0; if (!best || p > best.p) best = { p: p, t: x.label }; });
  return best ? best.t : (c.review ? 'filed a review' : '');
}
function tColLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
/** Puts two clients in one household on the Households tab: the household either already has, or a new number.
 *  Two households that turn out to be one keep the older number. Never throws; { ok, hh, name } or { ok: false, why }.
 *  Where there is no Households tab and the board reads the Household Assignments tab (tHouseholds_), the link is made
 *  there instead: a new Households tab holding only this pair would hide every other household from the board. */
function tLinkFamily_(a, b) {
  try {
    var ra = tRowByToken_(a), rb = tRowByToken_(b);
    if (!ra || !rb) return { ok: false, why: 'that family member is not on the send list' };
    var hhSh = ss_().getSheetByName(T_HH_SHEET), haSh = ss_().getSheetByName(T_HA.SHEET);
    var sh = hhSh && hhSh.getLastRow() > 1 ? hhSh : (haSh || hhSh);
    if (!sh) { sh = ss_().insertSheet(T_HH_SHEET); sh.appendRow(['Token', 'Household', 'Members', 'Client', 'Letter', 'Was with']); }
    var last = sh.getLastRow(), lastCol = Math.max(6, sh.getLastColumn());
    var vals = sh.getRange(1, 1, Math.max(1, last), lastCol).getValues();
    var head = vals[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var it = head.indexOf('token'), ih = head.indexOf('household');
    if (it < 0 || ih < 0) return { ok: false, why: 'the Households tab has no Token and Household columns' };
    var hhA = '', hhB = '', max = 0, rowsOf = {};
    for (var i = 1; i < vals.length; i++) {
      var t = String(vals[i][it] || '').trim(), h = String(vals[i][ih] || '').trim(), n = parseInt(h.replace(/\D/g, ''), 10);
      if (n > max) max = n;
      if (t === a) hhA = h;
      if (t === b) hhB = h;
      if (h) (rowsOf[h] = rowsOf[h] || []).push(i + 1);
    }
    var hh = hhA || hhB || ('H' + ('000' + (max + 1)).slice(-4));
    if (hhA && hhB && hhA !== hhB) {
      /* two households that are one family: the older number stays, the other's rows take it */
      var num = function (h) { return parseInt(String(h).replace(/\D/g, ''), 10) || 0; };
      hh = num(hhA) <= num(hhB) ? hhA : hhB;
      var drop = hh === hhA ? hhB : hhA;
      (rowsOf[drop] || []).forEach(function (rn) { sh.getRange(rn, ih + 1).setValue(hh); });
    }
    [[a, ra, hhA], [b, rb, hhB]].forEach(function (x) {
      if (x[2]) return;
      var row = []; for (var k = 0; k < lastCol; k++) row.push('');
      var put = function (name, v) { var j = head.indexOf(name); if (j >= 0) row[j] = v; };
      row[it] = x[0]; row[ih] = hh;
      put('client', tText_(x[1].Client) || tText_(x[1]['First name'])); put('letter', tText_(x[1].Segment)); put('was with', tText_(x[1].Agent));
      put('client number', tText_(x[1]['Client number'])); put('on our list', 'yes');
      sh.appendRow(row);
      /* the tab's own live columns, when it carries them: has this client answered, and how many of the household have */
      var rn = sh.getLastRow(), ja = head.indexOf('answered'), jh = head.indexOf('household answered');
      var T = tColLetter_(it + 1), Hc = tColLetter_(ih + 1), A = tColLetter_(ja + 1);
      if (ja >= 0) sh.getRange(rn, ja + 1).setFormula('=IF(COUNTIFS(\'Client Responses\'!$B:$B,$' + T + rn + ',\'Client Responses\'!$F:$F,"<>/your-policy/phone*")>0,"answered","")');
      if (jh >= 0 && ja >= 0) sh.getRange(rn, jh + 1).setFormula('=COUNTIFS($' + Hc + ':$' + Hc + ',$' + Hc + rn + ',$' + A + ':$' + A + ',"answered")');
    });
    return { ok: true, hh: hh, name: tText_(rb.Client) || tText_(rb['First name']) };
  } catch (e) { return { ok: false, why: String(e && e.message ? e.message : e).slice(0, 120) }; }
}

/* ── who is in the branch, who signs in, and what they see ─────────────────
   The Agent Skill Bank is the roster and the sign-in. Since 3 October 2026 it
   carries each person's Agent no., Password, Role, Unit and Active, set up by
   the branch manager ("I did put the agent access in the Service
   Questionnaire"), with what he asked for: "an agent uses his agent number
   and password assigned. I am the branch manager so when I log in I can see
   what's happening in the branch by units and persons that also fall under
   me. Akaash should see his team as he is a unit manager." So a Branch
   Manager (or an Assistant Branch Manager) sees the whole board, by unit and
   person; a Unit Manager the clients named to anyone whose Unit is his own
   name, himself included; an agent their own; Staff every client who
   answered, with no money and no policy figures (Client Support sees no
   money), marking calls in their own name, never naming an agent or writing
   to a client, and never on the roster to be named themselves. The Agent
   column reads "A00427 - Ricky Rampersad": the number in front is dropped.
   The tab has two Active columns; either one reading No, Not Active,
   Inactive, Resigned or Terminated takes the person off. The locks, whatever
   the tab says: anyone who was the agent on these books opens nothing and
   is never on the roster, being the Agent of a row on Transition Send; and
   ten wrong tries on one agent number close it for fifteen minutes. The old
   Portal code still signs in someone with no Password. Until 7 October
   2026 a password shorter than eight characters opened nothing as well
   (every one on the tab was one or two digits, most of them the row number,
   several shared). That day the manager chose to keep the passwords already
   on the tab ("i still want to keep as is"), having been told that a guess
   from an agent number would open the board, so MIN is 1. Raise it again to
   bring the rule back: nothing else changes. */
var T_INACTIVE = /^(no|n|not\s*active|inactive|false|0|resigned|terminated|left|suspended|transferred)$/i;
var T_USERS = { MIN: 1, TRIES: 10, LOCK_S: 900 };

/** A name as a key: letters only, so "Persad-Khan" and "Persad Khan" are one. */
function tNameKey_(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

/** "A00427 - Ricky Rampersad", "AG-003 - Azariah Griffith": the name without the number in front. */
function tCleanName_(s) { return String(s || '').replace(/^\s*[A-Za-z]{0,3}\s*-?\s*\d+\s*[-–—:]\s*/, '').replace(/\s+/g, ' ').trim(); }

/** The Role column in one word: bm, abm, um, staff or agent. "Branch Manager Assistant" is staff, never the branch manager. */
function tRoleOf_(s) {
  s = String(s || '').toLowerCase();
  if (/assistant\s*branch\s*manager|\babm\b/.test(s)) return 'abm';
  if (/\bbma\b|assistant|staff|support|admin|clerk|secretary/.test(s)) return 'staff';
  if (/branch\s*manager|\bbm\b/.test(s)) return 'bm';
  if (/unit\s*manager|\bum\b/.test(s)) return 'um';
  return 'agent';
}

/** A password as the script keeps it: a SHA-256 digest, never the password itself. */
function tDigest_(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'rrb-board:' + String(s || '').trim().toUpperCase(), Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}

/** Everyone on the Agent Skill Bank: { roles: whether the tab has Role and Unit columns, people: [{ name, no, email, phone,
 *  areas, avail, role, roleText, unit, active, pw (digest), pwShort, portal }] }. */
function tTeam_() {
  if (T_READ_ONCE && T_READ_ONCE.team) return T_READ_ONCE.team;   // a board request reads the tab once (transitionBoard_)
  var out = { roles: false, people: [] };
  try {
    var t = tSheetRows_(SVC.TEAM_SHEET), idx = {};
    t.head.forEach(function (h, i) { h = String(h).trim().toLowerCase(); if (h) (idx[h] = idx[h] || []).push(i); });
    out.roles = !!(idx.role && idx.unit);
    var cells = function (r, names) {
      var vals = [];
      names.forEach(function (n) {
        (idx[n] || []).forEach(function (i) {
          var x = r[i];
          if (x === null || x === undefined) return;
          x = typeof x === 'number' ? String(Math.round(x)) : String(x).trim();
          if (x) vals.push(x);
        });
      });
      return vals;
    };
    var col = function (r, names) { return cells(r, names)[0] || ''; };
    t.rows.forEach(function (r) {
      var name = tCleanName_(col(r, ['agent', 'name']));
      if (!name) return;
      var pw = col(r, ['password']), roleText = col(r, ['role']);
      out.people.push({ name: name, no: col(r, ['agent no.', 'agent number', 'agent no']), email: col(r, ['email', 'e-mail']),
        phone: col(r, ['phone', 'mobile', 'whatsapp', 'cell']), areas: col(r, ['areas covered', 'areas', 'town']), avail: col(r, ['availability']),
        role: tRoleOf_(roleText), roleText: roleText || 'Agent', unit: tCleanName_(col(r, ['unit'])),
        active: !cells(r, ['active']).some(function (a) { return T_INACTIVE.test(a); }),
        pw: pw ? tDigest_(pw) : '', pwShort: !!pw && pw.length < T_USERS.MIN, portal: col(r, ['portal code']) });
    });
  } catch (e) {}
  if (T_READ_ONCE) T_READ_ONCE.team = out;
  return out;
}

/** The roster, with the columns the board needs: everyone on the Agent Skill Bank who is active, is not staff, and was not
 *  the agent on these books (tFormer_). A Phone (or Mobile, WhatsApp, Cell) column and Areas covered come along if they
 *  are there, so an introduction can carry a number. The branch writes "Not Active" (1 October 2026). */
function tRoster_() {
  var former = tFormer_(), seen = {};
  return tTeam_().people.filter(function (p) {
    var k = tNameKey_(p.name);
    if (!p.active || p.role === 'staff' || former[k] || seen[k]) return false;
    seen[k] = true;
    return true;
  }).map(function (p) {
    return { name: p.name, no: p.no, email: p.email, phone: p.phone, areas: p.areas, avail: p.avail, portal: p.portal, role: p.role, unit: p.unit };
  });
}

/** Everyone who was the agent on these books: the Agent column of Transition Send, staff Test rows aside. Kept ten minutes. */
function tFormer_() {
  var cache = null, key = 'former-v1';
  try { cache = CacheService.getScriptCache(); var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  var out = {}, read = false;
  try {
    tRead_().rows.forEach(function (r) {
      var a = tText_(r.Agent);
      if (!a || tYes_(r.Test) || /^test\b/i.test(a)) return;
      out[tNameKey_(a)] = true;
    });
    read = true;
  } catch (e) {}
  try { if (cache && read) cache.put(key, JSON.stringify(out), 600); } catch (e) {}
  return out;
}

/** A unit manager's team: himself, and everyone active on the tab (staff aside) whose Unit is his name. */
function tUnitOf_(lead, team, former) {
  var k = tNameKey_(lead), out = [lead];
  team.people.forEach(function (p) {
    var pk = tNameKey_(p.name);
    if (p.active && p.role !== 'staff' && !former[pk] && pk !== k && tNameKey_(p.unit) === k) out.push(p.name);
  });
  return out;
}

/** Whether a name on a client (Assigned to) is one of `names`: the full name, whatever its spacing or hyphens. Never a
 *  first name alone: two people can share one, and a list must never show someone else's client. */
function tOnTeam_(names) {
  var keys = {};
  (names || []).forEach(function (n) { var k = tNameKey_(n); if (k) keys[k] = true; });
  return function (assigned) { var k = tNameKey_(assigned); return !!k && !!keys[k]; };
}

/** Wrong tries on one agent number, kept for fifteen minutes. */
function tTries_(k) { try { return Number(CacheService.getScriptCache().get(k) || 0); } catch (e) { return 0; } }
function tTriesAdd_(k) { try { CacheService.getScriptCache().put(k, String(tTries_(k) + 1), T_USERS.LOCK_S); } catch (e) {} }
function tTriesClear_(k) { try { CacheService.getScriptCache().remove(k); } catch (e) {} }

/** What a person on the tab sees, by their role. Only the branch manager (or the branch code) may e-mail a client a note
 *  from the board: the notes are signed in his name. */
function tAs_(p, team, former, viaBranch) {
  var me = { name: p.name, email: p.email, phone: p.phone, areas: p.areas, title: p.roleText || '' };
  var w = { ok: true, me: me, user: true, viaBranch: !!viaBranch, configured: true };
  if (p.role === 'bm' || p.role === 'abm') { w.role = 'branch'; w.canTell = p.role === 'bm'; return w; }
  if (p.role === 'um') { w.role = 'unit'; w.team = tUnitOf_(p.name, team, former); return w; }
  w.role = p.role === 'staff' ? 'staff' : 'agent';
  return w;
}

/** Who is asking. The branch code: the whole board, or one person's own view when a name or number comes with it. Anyone
 *  else: their agent number (or name) and their password from the Agent Skill Bank (or, with no Password, their old
 *  Portal code), both, so a password opens only the view of the person it belongs to (1 October 2026: "agent Number, and
 *  name and code"). Never a password back out, and a refusal never says which of the two was wrong. */
function tWho_(code, who) {
  code = String(code || '').trim().toUpperCase();
  who = String(who || '').trim().replace(/\s+/g, ' ');
  var branch = String(SVC.TEAM_CODE || '').trim().toUpperCase();
  var team = tTeam_(), former = tFormer_();
  var configured = !!(branch || team.people.some(function (p) { return p.pw || p.portal; }));
  var refuse = function (msg) { return { ok: false, refused: true, configured: configured, error: msg }; };
  if (!code) return refuse('Enter your agent number and your password, or the branch code.');
  var w = who.toLowerCase(), wn = w.replace(/[^a-z0-9]/g, '');
  var digits = function (s) { return s.replace(/^[a-z]+/, ''); };
  var isMe = function (a) {                                  // A10024, a10024, 10024 or the name as on the tab
    if (!w || !a.name) return false;
    if (a.name.toLowerCase().replace(/\s+/g, ' ') === w) return true;
    var no = String(a.no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return !!no && !!wn && (no === wn || (/^\d+$/.test(digits(no)) && digits(no) === digits(wn)));
  };
  var person = null;
  team.people.forEach(function (p) { if (!person && isMe(p)) person = p; });
  var here = !!person && person.active && !former[tNameKey_(person.name)];
  if (branch && code === branch) {
    if (!who) return { ok: true, role: 'branch', me: null, canTell: true, configured: true };
    if (!here) return refuse('We do not have anyone active by that name or number on the Agent Skill Bank.');
    return tAs_(person, team, former, true);
  }
  if (!who) return refuse('Enter your agent number with your password.');
  var tk = 'tries-' + (wn || 'none').slice(0, 40);
  if (tTries_(tk) >= T_USERS.TRIES) return refuse('Too many tries on that agent number. Wait fifteen minutes, or ask the branch.');
  if (here) {
    var hit = person.pw ? tDigest_(code) === person.pw
      : (!!person.portal && person.portal.length >= T_USERS.MIN && person.portal.toUpperCase() === code);
    if (hit && person.pwShort) return refuse('Your password is too short to open client records. Ask Ricky for a new one of at least ' + T_USERS.MIN + ' characters.');
    if (hit) { tTriesClear_(tk); return tAs_(person, team, former, false); }
  }
  tTriesAdd_(tk);
  return refuse(configured
    ? 'That agent number and password do not match. Check both, or ask the branch for your password.'
    : 'Not open yet: set TEAM_CODE in Service.gs, or give each person a Password on the Agent Skill Bank.');
}

/** The menu's "check the agent access": what the Agent Skill Bank gives the board, in words. Never a password. */
function transitionUsersCheck() { return tSay_(tUsersCheck_()); }
function tUsersCheck_() {
  var team = tTeam_(), former = tFormer_(), roles = {}, weak = 0, none = 0, open = 0, left = 0, units = {};
  var count = {};
  team.people.forEach(function (p) { if (p.pw) count[p.pw] = (count[p.pw] || 0) + 1; });
  var shared = 0;
  team.people.forEach(function (p) {
    if (former[tNameKey_(p.name)]) { left++; return; }
    if (!p.active) return;
    roles[p.roleText] = (roles[p.roleText] || 0) + 1;
    if (p.unit && p.role !== 'staff') units[p.unit] = (units[p.unit] || 0) + 1;
    if (p.pw && count[p.pw] > 1) shared++;
    if (!p.pw && !(p.portal && p.portal.length >= T_USERS.MIN)) none++;
    else if (p.pwShort) weak++;
    else open++;
  });
  return 'The Agent Skill Bank: ' + team.people.length + ' people. ' + Object.keys(roles).map(function (r) { return roles[r] + ' ' + r; }).join(', ') + '. ' +
    (team.roles ? 'Units: ' + Object.keys(units).map(function (u) { return u + ' (' + units[u] + ')'; }).join(', ') + '. ' : 'No Role and Unit columns yet, so everyone signs in as an agent. ') +
    open + ' can sign in to the assignment board. ' +
    (weak ? weak + (weak === 1 ? ' has' : ' have') + ' a password shorter than ' + T_USERS.MIN + ' characters, which opens nothing: give each a new one. ' : '') +
    (shared ? shared + (shared === 1 ? ' shares' : ' share') + ' a password with someone else. ' : '') +
    (none ? none + (none === 1 ? ' has' : ' have') + ' no password. ' : '') +
    (left ? left + (left === 1 ? ' was' : ' were') + ' the agent on these books and can never sign in, whatever the tab says.' : '');
}

/* ── the call list: who Client Support calls, on the board ─────────────
   7 October 2026: "where does staff make their notes and who to call as we move from the spreadsheet to data entry when
   call and can see the scripts". Until then each caller's list (Sasha, Liz, Azariah) was a tab of the Client Support calls
   Google Sheet, which only ever read this sheet: nothing typed there reached Client Responses, the board, the reports or
   the chase. The Call List tab is that list brought into this sheet once (built in the session scratchpad from the calls
   sheet, calls7oct/build-call-list.py): one row a client, with who calls them, in the caller's own order, why, the
   numbers, the address, the agent the notice names, and a line of what the caller had typed there. The board reads it: a
   client on it with nothing on Client Responses shows under "To call" (state 'tocall') with the reason and the number, a
   caller's own list first, and every try is logged on the board (transitionUpdate_ writes a /call row, tCallRow_). */
var T_CALLS = { SHEET: 'Call List' };
var T_CALLS_MEMO = null;
/** The Call List tab as { ready, by: { token: { caller, order, why, phone, other, email, addr, agent, sheet, back, done } } }. */
function tCalls_() {
  if (T_CALLS_MEMO) return T_CALLS_MEMO;
  var by = {}, n = 0;
  try {
    var t = tSheetRows_(T_CALLS.SHEET), ix = {};
    t.head.forEach(function (h, i) { ix[String(h).trim().toLowerCase()] = i; });
    if (ix.token !== undefined) t.rows.forEach(function (v) {
      var g = function (k) { return ix[k] !== undefined ? tText_(v[ix[k]]) : ''; };
      var tok = g('token');
      if (!tok) return;
      by[tok] = { caller: g('caller'), order: Number(ix.order !== undefined ? v[ix.order] : 0) || 0, why: g('call for'), phone: g('phone'),
                  other: g('other numbers'), email: g('e-mail on file'), addr: g('address on file'), agent: g('notice agent'),
                  sheet: g('from the calls sheet'), back: g('call-back'), done: g('done') };
      n++;
    });
  } catch (e) {}
  return (T_CALLS_MEMO = { ready: n > 0, by: by });
}
/** Whether a client on the Call List still needs a call from the list: on a caller's list or the no-number list (a row
 *  carrying only the numbers from the manager's own list is not), not marked done, not under the manager's hold on a book
 *  (7 October 2026: nothing for that book until he lifts it), and nobody the books leave out. */
function tToCall_(call, held) {
  return !!call && !!(call.caller || call.why) && !call.done && !/^hold: manager's hold/i.test(held || '') && !T_NOT_BOOK.test(held || '');
}

/* One read of Transition Send serves a whole board request (7 October 2026, "taking too long to log in"): the check of
   who was on these books (tFormer_, when its ten-minute copy has lapsed) and the board itself read the same tab, three to
   four seconds a read, and the Agent Skill Bank was read four times. Only transitionBoard_ turns this on, and nothing in
   that request writes to either tab. */
var T_READ_ONCE = null;

/** GET action=board&code=…[&who=…][&all=1]. */
function transitionBoard_(p) {
  p = p || {};
  T_READ_ONCE = {};
  try {
    var w = tWho_(p.code, p.who);
    if (!w.ok) return { ok: false, refused: true, configured: w.configured, error: w.error };
    try { return tBoard_(w, /^(1|yes|true)$/i.test(String(p.all || ''))); }
    catch (err) { return { ok: false, error: String(err && err.message ? err.message : err) }; }
  } finally { T_READ_ONCE = null; }
}

/** Every client who answered (a tap, a tick, a reply or a review), what they
 *  told us, who is named on it and where it stands; with `all`, every other
 *  client written to as a compact row, so a caller can be named on someone
 *  who has not answered yet. An agent gets the clients named to them and
 *  nothing else. Staff Test rows are never on the board. */
/** Whether a client on the board has answered the letter. Never a silent row, a family member off the board, a client
 *  reached by phone for their details only, or one named from the board with no answer of their own. */
function tHasAnswered_(c) { return !!c && ['open', 'assigned', 'done', 'noted'].indexOf(c.state) >= 0; }
function tBoard_(w, all, lite) {
  var tz = tTz_(), now = new Date();
  var t = tRead_();
  var calls = tCalls_();
  var rc = tReceipt_();
  var qdef = (rc && rc.json && rc.json.questions) || {}, codeQ = {};
  Object.keys(qdef).forEach(function (k) { (qdef[k][1] || []).forEach(function (a) { codeQ[a[2]] = { q: qdef[k][0], a: a[0], tap: a[1] }; }); });
  var tapWords = (rc && rc.json && rc.json.recap && rc.json.recap.taps) || {};
  var fmt = function (d, f) { return d instanceof Date && !isNaN(d.getTime()) ? Utilities.formatDate(d, tz, f || 'd MMM HH:mm') : ''; };
  var byTok = {}, order = [], sentNoAnswer = 0, sendBy = {};
  t.rows.forEach(function (r) {
    var tok = tText_(r.Token);
    if (!tok) return;
    if (tYes_(r.Test) || /^test:/i.test(tText_(r.Agent)) || /^test\b/i.test(tText_(r.Client))) return;   // staff standing in as clients
    sendBy[tok] = r;
    var c = { token: tok, client: tText_(r.Client) || tText_(r['First name']) || 'a client', firstName: tText_(r['First name']),
      no: tText_(r['Client number']), seg: tText_(r.Segment).toUpperCase(), book: tText_(r.Agent), email: tText_(r.Email),
      phone: tText_(r.Phone) || tText_(r.Mobile) || tText_(r.Cell) || '', sent: fmt(r['Sent at'], 'd MMM'),
      held: tHeld_(r.Exclude) ? (tText_(r.Exclude) || 'held') : '',
      facts: { since: tText_(r.first_year).replace(/\.0$/, ''), paidTo: tText_(r.paid_to), appReceived: tText_(r.app_received) },
      answers: [], taps: [], notes: [], fileNotes: [], markers: [], needs: [], reach: '', when: '', rows: [], own: 0, contact: 0, calls: 0, open: 0, actionable: 0, done: 0, noted: 0,
      late: false, assigned: '', assignedOn: '', mark: '', review: null, score: 0, firstAt: null, lastAt: null, assignedAt: null };
    /* whether the board may offer the manager's note (T_NOTES): the same test transitionUpdate_ applies before it sends */
    c.tellWhy = tNoteBlock_(r);
    c.canTell = !c.tellWhy;
    /* on Client Support's call list (tCalls_): who calls them and why, the numbers, and what the caller typed on the old sheet */
    var cl = calls.by[tok];
    if (cl) {
      c.call = { caller: cl.caller, order: cl.order, why: cl.why, sheet: cl.sheet, back: cl.back, agent: cl.agent, addr: cl.addr, other: cl.other };
      if (!c.phone) c.phone = cl.phone;
    }
    byTok[tok] = c; order.push(tok);
  });

  /* Client Responses: Received, Token, Segment, Response, Needs, Page, Referrer, Status, Assigned to, Assigned on, Note */
  var resp = tSheetRows_(SVC.RESP_SHEET);
  resp.rows.forEach(function (v, i) {
    var tok = String(v[1] || '').trim(), c = byTok[tok];
    if (!c) return;
    var type = String(v[3] || '').trim();
    if (!type) return;
    var rec = v[0] instanceof Date ? v[0] : null;
    var m = /[?&]q=([a-z_]+)/.exec(String(v[5] || '')), code = m ? m[1] : '';
    var status = String(v[7] || '').trim(), assigned = String(v[8] || '').trim(), on = v[9] instanceof Date ? v[9] : null, note = String(v[10] || '');
    var at = fmt(rec);
    c.rows.push({ n: i + 2, type: type });
    if (tCallRow_(v[5])) {
      /* a call logged from the board on a client with no row of their own: the outcome and the file note, nothing else */
      c.calls++;
      if (rec && (!c.firstAt || rec < c.firstAt)) c.firstAt = rec;
      if (rec && (!c.lastAt || rec > c.lastAt)) c.lastAt = rec;
      (note.match(/\[[^\]]*\]/g) || []).forEach(function (mk) { if (c.markers.indexOf(mk) < 0) c.markers.push(mk); });
      tFileNotes_(note).forEach(function (f) { if (c.fileNotes.indexOf(f) < 0) c.fileNotes.push(f); });
      if (status && !/^(open|logged)$/i.test(status)) c.mark = status;
      return;
    }
    if (tContactRow_(v[5])) c.contact++;                              // details taken on a call
    else if (!tAssignRow_(v[5])) c.own++;                             // the client's own answer, not an agent named from the board
    if (rec && (!c.firstAt || rec < c.firstAt)) c.firstAt = rec;
    if (rec && (!c.lastAt || rec > c.lastAt)) c.lastAt = rec;
    if (code && codeQ[code]) {
      var q = codeQ[code];
      if (/^reach_/.test(code)) c.reach = q.a;
      else if (/^when_/.test(code)) c.when = q.a;
      else if (!c.answers.some(function (x) { return x.code === code; })) c.answers.push({ q: q.q, a: q.a, code: code, at: at });
      if (T_PRIORITY[code]) c.score = Math.max(c.score, T_PRIORITY[code]);
    } else if (type !== 'informed' || code === 'wrote') {
      /* a reply with no reference is filed as a 'question' row, q=wrote: it is a reply, not the "My details have
         changed" tap that shares its type */
      var tk = code === 'wrote' ? 'wrote' : type;
      if (!c.taps.some(function (x) { return x.tap === tk; })) c.taps.push({ tap: tk, label: tk === 'wrote' ? (String(v[5] || '').indexOf('/your-policy/words') === 0 ? 'Wrote to us on the page' : 'Wrote back by e-mail') : (tapWords[type] || type), needs: String(v[4] || ''), at: at });
      if (T_PRIORITY[type]) c.score = Math.max(c.score, T_PRIORITY[type]);
    }
    (note.match(/\[[^\]]*\]/g) || []).forEach(function (mk) { if (c.markers.indexOf(mk) < 0) c.markers.push(mk); });
    /* the client's own words come only from a reply, where transitionInbox writes them first, in quotes, or from the
       words page, which writes them the same way (2 October 2026). Everything else in a Note cell is ours: the scripts'
       stamps ("[receipt] by phone: read back on the call") and the notes a person adds when marking a call here, which
       go on the file, never in the client's mouth. */
    if (String(v[5] || '').indexOf('/reply') === 0 || String(v[5] || '').indexOf('/your-policy/words') === 0) {
      var said = tNoteWords_(note);
      if (said && c.notes.indexOf(said) < 0) c.notes.push(said.slice(0, 500));
    }
    tFileNotes_(note).forEach(function (f) { if (c.fileNotes.indexOf(f) < 0) c.fileNotes.push(f); });
    var isOpen = status.toLowerCase() === 'open';
    if (type !== 'informed') {
      c.actionable++;
      var needs = String(v[4] || '').trim();
      if (needs && c.needs.indexOf(needs) < 0) c.needs.push(needs);
      if (isOpen) {
        c.open++;
        var wait = type === 'urgent' ? TRANSITION.WAIT_URGENT : TRANSITION.WAIT_DAYS;
        if (!assigned && rec && tWorkingDays_(rec, now) >= wait) c.late = true;
      } else {
        c.done++;
        if (status && !/^logged$/i.test(status)) c.mark = status;
      }
    } else c.noted++;
    if (assigned && (!c.assignedAt || (on && on > c.assignedAt))) { c.assigned = assigned; c.assignedAt = on || c.assignedAt || rec; c.assignedOn = fmt(on, 'd MMM'); }
  });

  /* the reviews: Service Questionnaires rows the campaign's link ref names, or whose e-mail is on the send list */
  var q = tSheetRows_(SVC.IND_SHEET), qi = {};
  q.head.forEach(function (h, i) { qi[h] = i; });
  var byMail = {};
  order.forEach(function (tok) { var c = byTok[tok]; if (c.email) byMail[c.email.toLowerCase()] = c; });
  var wordCols = [];
  q.head.forEach(function (h, i) {
    if (/tell us what happened|how you.?ve been treated|what would you like help with|something specific you want to ask|been in touch with you about moving|^who was it/i.test(h)) wordCols.push([h, i]);
  });
  q.rows.forEach(function (v) {
    var mm = qi['Link ref'] !== undefined ? /^transition:(\S+)$/.exec(String(v[qi['Link ref']] || '').trim()) : null;
    var c = (mm && byTok[mm[1]]) || (qi.Email !== undefined ? byMail[String(v[qi.Email] || '').trim().toLowerCase()] : null);
    if (!c) return;
    var ts = qi.Timestamp !== undefined && v[qi.Timestamp] instanceof Date ? v[qi.Timestamp] : null;
    var col = function (h) { return qi[h] !== undefined ? String(v[qi[h]] || '').trim() : ''; };
    c.review = { ref: col('Reference'), when: fmt(ts), priority: col('Priority'), status: col('Status'), handled: col('Handled by'), words: [] };
    wordCols.forEach(function (wc) { var val = String(v[wc[1]] || '').trim(); if (val) c.review.words.push({ q: wc[0], a: val.slice(0, 400) }); });
    if (/urgent/i.test(c.review.priority)) c.score = Math.max(c.score, 100);
    if (/^yes/i.test(col('Has anyone been in touch with you about moving or replacing this policy?'))) c.score = Math.max(c.score, T_PRIORITY.review_approached);
    if (ts && (!c.firstAt || ts < c.firstAt)) c.firstAt = ts;
    if (ts && (!c.lastAt || ts > c.lastAt)) c.lastAt = ts;
  });

  /* an agent named in Salesforce, or typed on the Household Assignments tab (tHaSync_, 1 October 2026): on the card, in the
     agent's own list when they log in, and on the roster's counts. The board's own name stands unless Salesforce's is newer. */
  var haBy = {};
  try {
    var hax = tHaRead_();
    if (hax) hax.rows.forEach(function (r) { if (r.token && r.agent) haBy[r.token] = { agent: r.agent, on: tHaDate_(r.date), via: r.source || 'the tab' }; });
  } catch (e) {}
  var clients = [], silent = [];
  order.forEach(function (tok) {
    var c = byTok[tok], ha = haBy[tok];
    if (ha && (!c.assigned || (ha.on && c.assignedAt && ha.on > c.assignedAt))) {
      c.assigned = ha.agent; c.assignedOn = ha.on ? fmt(ha.on, 'd MMM') : ''; c.assignedVia = ha.via; c.late = false;
    }
    if (!c.rows.length && !c.review && !ha) {
      if (c.sent && !c.held) sentNoAnswer++;
      /* on Client Support's call list and not yet called from the board: a light row with why, the number and the old
         sheet's notes, for the branch and for staff (7 October 2026); a try logged on it turns it into a card */
      if (tToCall_(c.call, c.held)) {
        clients.push({ token: tok, client: c.client, firstName: c.firstName, no: c.no, seg: c.seg, book: c.book, email: c.email,
          phone: c.phone, sent: c.sent, held: c.held, call: c.call, state: 'tocall', rows: [], canTell: c.canTell, tellWhy: c.tellWhy });
        return;
      }
      if (c.sent && !c.held && all) silent.push({ token: tok, client: c.client, firstName: c.firstName, no: c.no, seg: c.seg, book: c.book, email: c.email, phone: c.phone, sent: c.sent, state: 'silent', rows: [] });
      return;
    }
    /* reached by phone: Client Support took an e-mail or a number, and the client has not answered the letter yet. Named:
       an agent was named from the board on a client who has not answered (tAssignRow_). Called: Client Support logged a
       call on the board and nothing else is recorded yet (tCallRow_). Each card stays, so an agent can be named or the
       outcome marked, but none is ever counted as an answer, and none is sent the introduction that thanks a client for
       answering */
    var namedRow = c.assigned || c.rows.some(function (x) { return x.type === 'assign'; });
    c.state = !c.own && !c.review ? (c.contact ? 'reached' : (c.calls && !namedRow) ? 'called' : 'named')
      : c.open ? (c.assigned ? 'assigned' : 'open') : (c.actionable ? 'done' : (c.assigned ? 'assigned' : 'noted'));
    c.first = fmt(c.firstAt); c.last = fmt(c.lastAt);
    delete c.firstAt; delete c.lastAt; delete c.assignedAt;
    clients.push(c);
  });
  var rank = { open: 0, assigned: 1, done: 2, noted: 3, reached: 4, named: 5, called: 6, tocall: 7 };
  /* the call list in each caller's own order, as it was on their sheet: the terminated book and the action letters first */
  var callOrder = function (c) { return c.call ? [String(c.call.caller || '~'), c.call.order || 1e9] : ['~', 1e9]; };
  clients.sort(function (a, b) {
    if (a.state === 'tocall' && b.state === 'tocall') {
      var x = callOrder(a), y = callOrder(b);
      return x[0].localeCompare(y[0]) || (x[1] - y[1]);
    }
    return (rank[a.state] - rank[b.state]) || ((b.late ? 1 : 0) - (a.late ? 1 : 0)) || (b.score - a.score) || String(a.first).localeCompare(String(b.first));
  });
  var counts = { answered: 0, open: 0, assigned: 0, done: 0, noted: 0, reached: 0, named: 0, called: 0, tocall: 0, late: 0, silent: sentNoAnswer };
  clients.forEach(function (c) { counts[c.state]++; if (c.late) counts.late++; if (tHasAnswered_(c)) counts.answered++; });
  /* the Client Book (tBook_): each card carries the client's policies; the rows without a card (not answered, family)
     carry the totals alone, and the board fetches the rest when one is opened (transitionBook_) */
  var bk = tBook_();
  if (bk.ready) {
    clients.forEach(function (c) {
      if (c.state === 'tocall') { c.pol = tBookBrief_(c.no); return; }   // a call-list row: the totals, like a row without a card
      c.pol = tBookFor_(c.no, true);
      c.profile = tProfileFor_(c.no);
      c.ins = tInsightsFor_(c.pol, c.profile, bk.today);
    });
    /* a row without a card: the totals, and which insights apply (for the filter), nothing more */
    silent.forEach(function (c) {
      c.pol = tBookBrief_(c.no);
      var ik = tInsightsFor_(tBookFor_(c.no, true), tProfileFor_(c.no), bk.today).map(function (i) { return i.k; });
      if (ik.length) c.ik = ik;
    });
  }
  /* who this viewer may see: everyone for the branch and for staff, a unit manager's team (tAs_), an agent alone */
  var staff = w.role === 'staff';
  var onTeam = w.role === 'unit' ? tOnTeam_(w.team) : w.role === 'agent' ? tOnTeam_([w.me.name]) : null;
  var roster = tRoster_();
  /* the roster: every agent for the branch and for staff (who name agents too since 5 October 2026), a unit manager's
     team for him, an agent alone; the figures on it for the branch and a unit manager only */
  var agents = roster.filter(function (a) { return !onTeam || onTeam(a.name); }).map(function (a) {
    var k = tNameKey_(a.name), mine = clients.filter(function (c) { return c.assigned && tNameKey_(c.assigned) === k; });
    var o = { name: a.name, areas: a.areas, avail: a.avail, email: !!a.email, phone: !!a.phone, role: a.role || '', unit: a.unit || '',
              open: mine.filter(function (c) { return c.open; }).length, done: mine.filter(function (c) { return !c.open && c.actionable; }).length };
    /* what each person has been named on: for the branch, and for a unit manager over his own team; an agent never sees
       another's figures */
    if ((w.role === 'branch' || w.role === 'unit') && bk.ready) {
      o.clients = mine.length; o.prem = 0; o.cover = 0;
      mine.forEach(function (c) { if (c.pol) { o.prem += c.pol.sum.prem; o.cover += c.pol.sum.cover; } });
      o.prem = Math.round(o.prem);
    }
    return o;
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  var answeredBy = {};
  clients.forEach(function (c) { if (tHasAnswered_(c)) answeredBy[c.token] = c; });
  if (onTeam || staff) {
    if (onTeam) clients = clients.filter(function (c) { return onTeam(c.assigned); });
    silent = [];
    /* the tiles count this viewer's own list, never the branch's */
    counts = { answered: 0, open: 0, assigned: 0, done: 0, noted: 0, reached: 0, named: 0, called: 0, tocall: 0, late: 0, silent: 0 };
    clients.forEach(function (c) { counts[c.state]++; if (c.late) counts.late++; if (tHasAnswered_(c)) counts.answered++; });
  }
  /* the TT$200 retention claims (the Retention Payments tab): a line on the card and the payments panel, for the branch every
     claim, for a unit manager his team's and for an agent their own, by the agent the claim pays; never for staff, who see
     no money */
  var claims = null;
  if (!staff) {
    var crows = [], today = Utilities.formatDate(now, tz, 'yyyy-MM-dd'), cBy = {};
    try { crows = tClaimsRead_().rows; } catch (e) {}
    crows = crows.filter(function (r) { return !onTeam || onTeam(r.agent); });
    var cview = crows.map(function (r) { return tClaimView_(r, tz, today, w.role === 'branch'); });
    cview.forEach(function (v) { if (v.token) cBy[v.token] = v; });
    clients.forEach(function (c) { if (cBy[c.token]) c.claim = cBy[c.token]; });
    var corder = { check: 0, notsent: 1, held: 2, 'new': 3, unpaid: 4, paid: 5, closed: 6 }, csum = { n: cview.length, unpaid: 0, owed: 0, paid: 0, paidAmt: 0, held: 0 };
    cview.forEach(function (v) {
      if (v.state === 'unpaid') { csum.unpaid++; csum.owed += v.amount; }
      else if (v.state === 'paid') { csum.paid++; csum.paidAmt += v.amount; }
      else if (v.state !== 'closed') csum.held++;
    });
    cview.sort(function (a, b) { return (corder[a.state] - corder[b.state]) || String(b.id).localeCompare(String(a.id)); });
    claims = { rows: cview, sum: csum, live: tClaimsLive_(), sf: tSfOn_(), amount: T_CLAIM.AMOUNT, cur: T_CLAIM.CUR, minDays: T_CLAIM.MIN_DAYS,
               to: w.role === 'branch' ? T_CLAIM.TO : '' };
  }
  /* the branch by unit and person (the Agent Skill Bank's Role and Unit): every unit for the branch, his own for a unit manager */
  var units = w.role === 'branch' || w.role === 'unit' ? tUnits_(w, clients, bk.ready) : null;
  /* households (the Households tab): every member, those on our list and the family who hold policies with other agents,
     what each holds with us, and who heads it ("have the husband as the <name> household and include the wife cover so
     we can see the wife and his cover as well anyone else who is covered in the household", 29 September 2026). The
     branch sees every member and every figure. An agent sees the members on our list, by name and where they stand, and
     the figures of their own clients only; never who else is covered with other agents. */
  var hx = tHouseholds_(), hhOf = hx.byTok, hhMembers = {}, households = {}, hhInfo = {}, hhBook = {}, family = [], onBoard = {}, own = {};
  var branch = w.role === 'branch';
  hx.rows.forEach(function (m) {
    if (m.token && !sendBy[m.token]) return;          // a token that has left the send list, or a staff Test row
    (hhMembers[m.hh] = hhMembers[m.hh] || []).push(m);
  });
  clients.concat(silent).forEach(function (c) { c.hh = hhOf[c.token] || ''; onBoard[c.token] = true; });
  if (!staff) clients.forEach(function (c) { own[c.token] = true; });   // staff: no figures for anyone (Client Support sees no money)
  Object.keys(hhMembers).forEach(function (h) {
    var ms = hhMembers[h];
    if (ms.length < 2 || !ms.some(function (m) { return m.token && onBoard[m.token]; })) return;
    var list = ms.map(function (m) {
      var c = m.token ? answeredBy[m.token] : null, r = m.token ? sendBy[m.token] : null, no = r ? tText_(r['Client number']) : m.no;
      var x = { token: m.token || '', no: no, onList: !!r, markedHead: m.head,
        client: c ? c.client : (r ? (tText_(r.Client) || tText_(r['First name']) || 'a client') : (m.client || 'a client')),
        seg: r ? tText_(r.Segment).toUpperCase() : '', state: c ? 'answered' : (r ? tMemberState_(r) : 'with another agent'),
        said: c ? tSaid_(c) : '', with: r ? '' : m.with };
      var pf = tProfileFor_(no);
      if (pf) { if (pf.age !== undefined) x.age = pf.age; if (pf.gender) x.gender = pf.gender; if (pf.role) x.role = pf.role; }
      var p = bk.ready ? tBookBrief_(no, true) : null;
      x._rank = p ? [p.sum.cover, p.sum.prem, x.age || 0] : [0, 0, x.age || 0];   // for the head, and never sent
      if (p && (branch || (m.token && own[m.token]))) x.pol = p;
      return x;
    });
    if (!branch) list = list.filter(function (x) { return x.onList; });
    if (list.length < 2) return;
    /* the head: the member marked on the tab, else the adult with the most life cover, then premium a year, then the eldest */
    var head = list.filter(function (x) { return x.markedHead; })[0];
    if (!head) {
      var adults = list.filter(function (x) { return x.age === undefined || x.age >= 18; });
      head = (adults.length ? adults : list).slice().sort(function (a, b) {
        for (var i = 0; i < 3; i++) if (b._rank[i] !== a._rank[i]) return b._rank[i] - a._rank[i];
        return (b.onList ? 1 : 0) - (a.onList ? 1 : 0);
      })[0];
    }
    list.forEach(function (x) { x.head = x === head; delete x.markedHead; delete x._rank; });
    list.sort(function (a, b) { return (b.head ? 1 : 0) - (a.head ? 1 : 0) || (b.age || 0) - (a.age || 0); });
    households[h] = list;
    /* what the family holds, from the members this viewer may see; who in it has no life cover, among the adults */
    var seen = list.filter(function (x) { return x.pol; }), t = { members: list.length, seen: seen.length, live: 0, prem: 0, cover: 0, ci: 0 }, gaps = [];
    seen.forEach(function (x) {
      t.live += x.pol.sum.live; t.prem += x.pol.sum.prem; t.cover += x.pol.sum.cover; t.ci += x.pol.sum.ci || 0;
      if (!x.pol.sum.cover && !x.pol.sum.unconf && (x.age === undefined || (x.age >= 18 && x.age < 65))) gaps.push(x.client);
    });
    t.prem = Math.round(t.prem);
    hhInfo[h] = { name: head.client + ' household', size: list.length, gaps: gaps,
      children: list.filter(function (x) { return x.age !== undefined && x.age < 18; }).length, elsewhere: list.filter(function (x) { return !x.onList; }).length };
    if (seen.length && (branch || seen.length === list.length)) hhBook[h] = t;   // an agent gets the family's total only when every member is theirs
    /* the branch: the members of a household where someone answered who are on our list but not on the board themselves */
    if (!branch || !list.some(function (x) { return x.token && answeredBy[x.token]; })) return;
    list.forEach(function (x) {
      if (!x.token || onBoard[x.token] || answeredBy[x.token]) return;
      var r = sendBy[x.token], why = tNoteBlock_(r);
      family.push({ token: x.token, client: x.client, firstName: tText_(r['First name']), no: tText_(r['Client number']),
        seg: x.seg, book: tText_(r.Agent), email: tText_(r.Email), phone: tText_(r.Phone) || tText_(r.Mobile) || tText_(r.Cell) || '',
        sent: fmt(r['Sent at'], 'd MMM'), state: 'family', fstate: x.state, hh: h, rows: [], canTell: !why, tellWhy: why, pol: bk.ready ? tBookBrief_(r['Client number']) : null });
    });
  });
  counts.households = Object.keys(households).filter(function (h) { return households[h].some(function (m) { return m.state === 'answered'; }); }).length;
  /* what the records say about the clients who answered, for the branch's insight bar and the filter */
  if (branch && bk.ready) {
    counts.insights = {};
    clients.forEach(function (c) { if (tHasAnswered_(c)) (c.ins || []).forEach(function (i) { counts.insights[i.k] = (counts.insights[i.k] || 0) + 1; }); });
    Object.keys(hhInfo).forEach(function (h) { if (hhInfo[h].gaps.length && households[h].some(function (m) { return m.state === 'answered'; })) counts.insights.hhgap = (counts.insights.hhgap || 0) + 1; });
    /* the book at a glance: over those who answered, and over every client of the books on the send list (not when the
       board is read only to name an agent) */
    var bookNos = [];
    if (!lite) order.forEach(function (tok) { var r = sendBy[tok]; if (!T_NOT_BOOK.test(tText_(r.Exclude))) bookNos.push(tText_(r['Client number'])); });
    if (!lite) counts.glance = { answered: tGlance_(clients.filter(tHasAnswered_).map(function (c) { return c.no; })), all: tGlanceCached_(bookNos) };
  }
  /* who should look after whom: a suggestion on every client nobody is named on (tSuggest_), for whoever may name one */
  if (tCanAssign_(w)) counts.sug = tSuggest_(clients.filter(function (c) { return c.state !== 'tocall'; }).concat(silent, family),
    { roster: tRoster_(), plan: tPlan_(), clients: clients, households: households, answeredBy: answeredBy });
  /* staff see who each client is, what the records say and each policy's plan, where it stands and what it is paid to,
     never a figure: Client Support sees no money (29 September), and the insights are theirs too (5 October 2026: "I do
     need the staff to log in with the insights shared") */
  if (staff) clients.forEach(function (c) {
    var p = tPolNoMoney_(c.pol), f = tProfileNoMoney_(c.profile);
    if (p) c.pol = p; else delete c.pol;
    if (f) c.profile = f; else delete c.profile;
    if (c.ins) c.ins = c.ins.filter(function (i) { return !T_MONEY_INS[i.k]; });
    if (c.ik) c.ik = c.ik.filter(function (k) { return !T_MONEY_INS[k]; });
  });
  return { ok: true, at: Utilities.formatDate(now, tz, 'd MMM yyyy HH:mm'), role: w.role, me: w.me || null, viaBranch: !!w.viaBranch,
           waitDays: TRANSITION.WAIT_DAYS, waitUrgent: TRANSITION.WAIT_URGENT, agents: agents, clients: clients, silent: silent, counts: counts,
           households: households, hhInfo: hhInfo, family: family, hhBook: hhBook, profiles: tProfiles_().ready,
           book: { ready: bk.ready, money: !staff, at: bk.built ? bk.built.when : '', yearAny: T_BOOK.YEARLY_ANY, yearAnniv: T_BOOK.YEARLY_ANNIV },
           mail: { intro: (typeof tMsCreds_ === 'function' && !!tMsCreds_()) ? 'support@' : 'gmail' },
           units: units, team: w.role === 'unit' ? w.team : null, canTell: w.role === 'branch' && w.canTell !== false, canAssign: tCanAssign_(w),
           notes: tNotesForBoard_(w),
           calls: { ready: calls.ready }, mailHeld: tClientMailHeld_(),   // the call list is on the board; automatic client e-mail is on hold
           /* what the hold stops besides the letters, reminders and notes (7 October 2026), so the board says it in words */
           introsHeld: TRANSITION.HOLD_INTROS !== false && tClientMailHeld_(), receiptsHeld: TRANSITION.HOLD_RECEIPTS === true && tClientMailHeld_(),
           claims: claims, detail: true };   // detail: this backend answers action=detail and action=comment (ping campaign 7)
}

/** The branch by unit and person, from the Agent Skill Bank's Role and Unit columns: each unit under its manager (the Unit
 *  column names him), with what each person has been named on, how many of those answered, are open, late or done, and,
 *  with the Client Book, the premium a year and the life cover. A unit whose manager has left or is no longer active shows
 *  as its people under "no unit manager now". Staff are not in a unit. A unit manager gets his own unit only. Null when the
 *  tab has no Role and Unit columns. */
function tUnits_(w, clients, bkReady) {
  var team = tTeam_();
  if (!team.roles) return null;
  var former = tFormer_(), live = {}, groups = {}, order = [];
  team.people.forEach(function (u) { if (u.name && u.active && u.role !== 'staff' && !former[tNameKey_(u.name)]) live[tNameKey_(u.name)] = u; });
  var stat = function (name, roleText) {
    var k = tNameKey_(name), mine = clients.filter(function (c) { return c.assigned && tNameKey_(c.assigned) === k; });
    var o = { name: name, role: roleText || '', named: mine.length, answered: mine.filter(tHasAnswered_).length,
              open: mine.filter(function (c) { return c.open; }).length, late: mine.filter(function (c) { return c.open && c.late; }).length,
              done: mine.filter(function (c) { return !c.open && c.actionable; }).length };
    if (bkReady) {
      o.prem = 0; o.cover = 0;
      mine.forEach(function (c) { if (c.pol) { o.prem += c.pol.sum.prem; o.cover += c.pol.sum.cover; } });
      o.prem = Math.round(o.prem);
    }
    return o;
  };
  var group = function (key, lead, title) {
    if (!groups[key]) { groups[key] = { key: key, lead: lead, title: title, people: [] }; order.push(key); }
    return groups[key];
  };
  Object.keys(live).forEach(function (k) {
    var u = live[k], lead = live[tNameKey_(u.unit)];
    var g = lead ? group(tNameKey_(lead.name), lead.name, lead.roleText) : group('~none', '', 'No unit manager now');
    g.people.push(stat(u.name, u.roleText));
  });
  var rank = function (g) {
    if (g.key === '~none') return 3;
    var r = (live[g.key] || {}).role;
    return r === 'bm' ? 0 : r === 'abm' ? 1 : 2;
  };
  var out = order.map(function (k) { return groups[k]; }).sort(function (a, b) { return (rank(a) - rank(b)) || a.lead.localeCompare(b.lead); });
  out.forEach(function (g) {
    var lk = tNameKey_(g.lead);
    g.people.sort(function (a, b) { return ((tNameKey_(b.name) === lk) - (tNameKey_(a.name) === lk)) || a.name.localeCompare(b.name); });
    g.total = { people: g.people.length, named: 0, answered: 0, open: 0, late: 0, done: 0 };
    if (bkReady) { g.total.prem = 0; g.total.cover = 0; }
    g.people.forEach(function (p) {
      ['named', 'answered', 'open', 'late', 'done', 'prem', 'cover'].forEach(function (f) { if (g.total[f] !== undefined) g.total[f] += p[f] || 0; });
    });
  });
  if (w.role === 'unit') {
    var mk = tNameKey_(w.me && w.me.name);
    out = out.filter(function (g) { return g.key === mk; });
  }
  return out;
}

/* ── who should look after whom: the board's suggestion ────────────────── */
/* 29 September 2026, evening: "how is the assignment going to be?" Until then the manager chose an agent card by card
   ("it was just randomly we assign"). The board now suggests one for every client nobody is named on, says why, and
   names nobody until he presses. In this order:
   1. the family: someone in the household already has an agent, so the rest go to the same one;
   2. the plan: the 24 September split, checked with the team (the Assignment Plan tab, one row a client: the agent the
      plan gives them, the team's own pick beside it, the tenure band and the area). The plan keeps households together
      and gives every agent an even share of every band. A household on the board takes its head's plan agent, so the
      two lists' different ideas of a family never split one;
   3. the lightest list: the active agent with the fewest clients named so far, counting the suggestions already made
      in this pass, so what is left goes round the roster evenly; a household is suggested once, as one.
   An agent the plan names who is not on the Agent Skill Bank (Active) is shown as such and never swapped for someone
   else: the roster is filled first. */
var T_PLAN = { SHEET: 'Assignment Plan' };
var T_PLAN_MEMO = null;
/** The Assignment Plan tab as { ready, by: { client number: { agent, team, band, area, hh } } }. */
function tPlan_() {
  if (T_PLAN_MEMO) return T_PLAN_MEMO;
  var by = {}, n = 0;
  try {
    var t = tSheetRows_(T_PLAN.SHEET), ix = {};
    t.head.forEach(function (h, i) { ix[String(h).trim().toLowerCase()] = i; });
    var col = function (v, names) {
      for (var k = 0; k < names.length; k++) { var i = ix[names[k]]; if (i !== undefined && String(v[i] == null ? '' : v[i]).trim()) return String(v[i]).trim(); }
      return '';
    };
    if (ix['client number'] !== undefined) t.rows.forEach(function (v) {
      var no = tCno_(v[ix['client number']]), agent = col(v, ['plan agent', 'plan: assign to', 'agent']);
      if (!no || !agent) return;
      by[no] = { agent: agent, team: col(v, ["team's pick", 'team: household sits with']), band: col(v, ['band']), area: col(v, ['area']), hh: col(v, ['plan household']) };
      n++;
    });
  } catch (e) {}
  /* no Assignment Plan tab on the sheet (7 October 2026): the Household Assignments tab carries the same 24 September
     plan, one suggestion a household, with its reason, which is what the wall's "Next households to assign" shows; the
     board suggests the same agent */
  if (!n) {
    try {
      var h = tSheetRows_(T_HA.SHEET), hx = {};
      h.head.forEach(function (x, i) { hx[String(x).trim().toLowerCase()] = i; });
      if (hx['client number'] !== undefined && hx['suggested agent'] !== undefined) h.rows.forEach(function (v) {
        var no = tCno_(v[hx['client number']]), agent = String(v[hx['suggested agent']] || '').trim();
        if (!no || !agent) return;
        by[no] = { agent: agent, team: '', band: '', area: '', hh: hx.household !== undefined ? String(v[hx.household] || '').trim() : '',
                   why: hx['why suggested'] !== undefined ? String(v[hx['why suggested']] || '').trim() : '' };
        n++;
      });
    } catch (e) {}
  }
  return (T_PLAN_MEMO = { ready: n > 0, by: by });
}
/** The roster agent a name means: the full name, or a first name that only one agent on the roster carries. */
function tRosterMatch_(roster, name) {
  var s = String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return null;
  for (var i = 0; i < roster.length; i++) if (roster[i].name.toLowerCase() === s) return roster[i];
  var first = s.split(' ')[0], hit = roster.filter(function (a) { return a.name.toLowerCase().split(/\s+/)[0] === first; });
  return hit.length === 1 ? hit[0] : null;
}
/** Puts c.sug = { agent, why, src } (src: family, plan, load; or agent '' with `planned` when the plan names someone not on
 *  the roster) on every row nobody is named on. Returns the counts for the page: by agent, by source, and off the roster. */
function tSuggest_(rows, ctx) {
  var roster = ctx.roster || [], plan = ctx.plan || { by: {} }, load = {}, out = { byAgent: {}, src: { family: 0, plan: 0, load: 0 }, off: 0, offNames: {}, plan: !!plan.ready };
  if (!roster.length) return out;
  var first = function (n) { return String(n || '').split(/\s+/)[0]; };
  roster.forEach(function (a) { load[a.name] = 0; });
  (ctx.clients || []).forEach(function (c) { var a = c.assigned ? tRosterMatch_(roster, c.assigned) : null; if (a) load[a.name]++; });
  var planOf = function (no) { return plan.by[tCno_(no)] || null; };
  /* the family's agent, where someone in it is named already; and the household's plan agent: its head's, else most members' */
  var famAgent = {}, famPlan = {}, hhPick = {};
  Object.keys(ctx.households || {}).forEach(function (h) {
    var list = ctx.households[h], named = {}, votes = {}, head = null;
    list.forEach(function (m) {
      var c = m.token ? ctx.answeredBy[m.token] : null, a = c && c.assigned ? tRosterMatch_(roster, c.assigned) : null;
      if (a) { named[a.name] = named[a.name] || { n: 0, who: m.client }; named[a.name].n++; }
      var p = planOf(m.no);
      if (p) { votes[p.agent] = (votes[p.agent] || 0) + 1; if (m.head) head = p.agent; }
    });
    var best = Object.keys(named).sort(function (x, y) { return named[y].n - named[x].n; })[0];
    if (best) famAgent[h] = { agent: best, who: named[best].who };
    var most = Object.keys(votes).sort(function (x, y) { return votes[y] - votes[x] || x.localeCompare(y); })[0];
    if (head || most) famPlan[h] = head || most;
  });
  var put = function (c, s) {
    c.sug = s;
    if (s.agent) { out.byAgent[s.agent] = (out.byAgent[s.agent] || 0) + 1; out.src[s.src]++; load[s.agent] = (load[s.agent] || 0) + 1; }
    else { out.off++; out.offNames[s.planned] = (out.offNames[s.planned] || 0) + 1; }
  };
  rows.forEach(function (c) {
    if (!c || c.assigned || c.sug) return;
    var h = c.hh || '', fa = h ? famAgent[h] : null;
    if (fa) { put(c, { agent: fa.agent, why: 'with the family: ' + fa.who + ' is with ' + first(fa.agent), src: 'family' }); return; }
    var p = planOf(c.no), pname = (h && famPlan[h]) || (p ? p.agent : '');
    if (pname) {
      var a = tRosterMatch_(roster, pname);
      if (!a) { put(c, { agent: '', planned: pname, why: 'the 24 Sep plan names ' + pname + ', who is not on the Agent Skill Bank yet', src: 'plan' }); return; }
      var bits = ['the 24 Sep plan'];
      /* read from the Household Assignments tab, the plan's own reason ("24 September plan (the household head's)", "family: …") */
      if (p && p.why && p.agent.toLowerCase() === pname.toLowerCase()) bits = [p.why.replace(/^24 September plan/i, 'the 24 Sep plan')];
      if (p && p.band) bits.push(p.band);
      if (p && p.area) bits.push(p.area);
      if (h && (!p || p.agent.toLowerCase() !== pname.toLowerCase())) bits.push('with the family');
      else if (p && p.team && p.team.toLowerCase() !== p.agent.toLowerCase()) bits.push('the team\'s own list had ' + p.team);
      put(c, { agent: a.name, why: bits.join(' · '), src: 'plan' });
      return;
    }
    if (h && hhPick[h]) { put(c, { agent: hhPick[h], why: 'with the family: the lightest list when the first of them was suggested', src: 'load' }); return; }
    var light = roster.slice().sort(function (x, y) { return (load[x.name] - load[y.name]) || x.name.localeCompare(y.name); })[0];
    put(c, { agent: light.name, why: 'the lightest list: ' + load[light.name] + ' named or suggested so far', src: 'load' });
    if (h) hhPick[h] = light.name;
  });
  return out;
}

/* ── the book at a glance: who the clients are, how they pay, what they hold ── */
/* The branch's panel on the board, over those who answered and over every client of the books on the send list (never the
   departed agents' own policies, their households, staff, a death claim or a client who holds nothing). Counts only. */
var T_NOT_BOOK = /^(agent|agent household|agent e-mail|staff e-mail|death claim|nothing held)/i;
var T_AGE_BANDS = [[0, 30, 'under 30'], [30, 45, '30 to 44'], [45, 60, '45 to 59'], [60, 70, '60 to 69'], [70, 200, '70 and over']];
var T_YEAR_BANDS = [[0, 2, 'under 2 years'], [2, 5, '2 to 5 years'], [5, 10, '5 to 10 years'], [10, 20, '10 to 20 years'], [20, 1000, '20 years or more']];
var T_BILL_WORDS = { 'bankers order': 'bankers order', 'direct bill': 'direct bill', 'pre authorized cheque': 'pre-authorised cheque', 'salary deduction': 'salary deduction',
  'military pay': 'military pay', 'post dated cheque': 'post-dated cheque', 'single premium': 'single premium' };
function tGlance_(nos) {
  var g = { n: 0, onBook: 0, prem: 0, cover: 0, ci: 0, due: 0, lapsed: 0, occN: 0, empN: 0, incN: 0, income: 0 };
  var age = {}, gender = {}, pay = {}, holds = {}, ben = {}, years = {}, occ = {}, emp = {}, occL = {}, empL = {}, inc = [], seen = {};
  var bump = function (o, k) { o[k] = (o[k] || 0) + 1; };
  var empKey = function (s) {
    return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(limited|ltd|company|co|the|of|trinidad|and|tobago|tt)\b/g, ' ').replace(/\s+/g, ' ').trim();
  };
  (nos || []).forEach(function (no) {
    no = tCno_(no);
    if (!no || seen[no]) return;
    seen[no] = true;
    g.n++;
    var p = tBookFor_(no, true), pf = tProfileFor_(no), band = 'not recorded';
    if (pf && pf.age !== undefined) T_AGE_BANDS.forEach(function (b) { if (pf.age >= b[0] && pf.age < b[1]) band = b[2]; });
    bump(age, band);
    bump(gender, pf && pf.gender ? pf.gender : 'not recorded');
    if (pf && pf.occ) { var k = pf.occ.toLowerCase().replace(/[^a-z]/g, ''); g.occN++; bump(occ, k); if (!occL[k]) occL[k] = pf.occ; }
    if (pf && pf.emp) { var e = empKey(pf.emp) || pf.emp.toLowerCase(); g.empN++; bump(emp, e); if (!empL[e]) empL[e] = pf.emp; }
    if (pf && pf.income > 0) { g.incN++; inc.push(pf.income); }
    if (!p) { bump(holds, 'nothing on the portfolio'); return; }
    g.onBook++;
    var s = p.sum, list = p.list || [], live = list.filter(function (x) { return tBookLive_(x.st); }), cls = {}, bills = {};
    g.prem += s.prem; g.cover += s.cover; g.ci += s.ci || 0;
    if (s.due) g.due++;
    if (s.lapsed) g.lapsed++;
    live.forEach(function (x) {
      if (x.cls) cls[x.cls] = true;
      if (x.st === 'inforce' || x.st === 'overdue') bills[T_BILL_WORDS[String(x.bill || '').toLowerCase()] || (x.bill ? String(x.bill).toLowerCase() : 'not recorded')] = true;
      bump(ben, { named: 'a named person', estate: 'the estate', provisions: 'the special provisions', role: 'a role only (Proposer, Annuitant)' }[x.benK] || 'not on our file');
    });
    Object.keys(bills).forEach(function (k) { bump(pay, k); });
    if (!live.length) bump(holds, 'nothing in force');
    else {
      if (s.cover) bump(holds, 'life cover');
      if (s.ci || cls['critical illness']) bump(holds, 'critical illness');
      if (s.acc || cls.accident) bump(holds, 'accident');
      if (cls.health) bump(holds, 'health');
      if (cls.savings) bump(holds, 'savings or annuity');
    }
    var yb = 'no policy issued yet';
    if (s.since) T_YEAR_BANDS.forEach(function (b) { if (s.years >= b[0] && s.years < b[1]) yb = b[2]; });
    bump(years, yb);
  });
  var fixed = function (o, order) { return order.filter(function (k) { return o[k]; }).map(function (k) { return [k, o[k]]; }); };
  var top = function (o, labels, n) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a] || a.localeCompare(b); }).slice(0, n).map(function (k) { return [labels[k] || k, o[k]]; }); };
  g.prem = Math.round(g.prem); g.cover = Math.round(g.cover); g.ci = Math.round(g.ci);
  if (inc.length) { inc.sort(function (a, b) { return a - b; }); g.income = inc[Math.floor(inc.length / 2)]; }
  g.age = fixed(age, T_AGE_BANDS.map(function (b) { return b[2]; }).concat(['not recorded']));
  g.gender = fixed(gender, ['female', 'male', 'not recorded']);
  g.pay = top(pay, {}, 10);
  g.holds = fixed(holds, ['life cover', 'critical illness', 'accident', 'health', 'savings or annuity', 'nothing in force', 'nothing on the portfolio']);
  g.ben = fixed(ben, ['a named person', 'the special provisions', 'a role only (Proposer, Annuitant)', 'the estate', 'not on our file']);
  g.years = fixed(years, T_YEAR_BANDS.map(function (b) { return b[2]; }).concat(['no policy issued yet']));
  g.occ = top(occ, occL, 12);
  g.emp = top(emp, empL, 10);
  return g;
}
/** The glance over the whole book changes once a day, with the Client Book: kept for ten minutes. */
function tGlanceCached_(nos) {
  var key = 'glance-all-' + ((tBook_().built || {}).at || '') + '-' + nos.length, c = null;
  try { c = CacheService.getScriptCache(); var hit = c.get(key); if (hit) return JSON.parse(hit); } catch (e) { c = null; }
  var g = tGlance_(nos);
  try { if (c) c.put(key, JSON.stringify(g), 600); } catch (e) {}
  return g;
}

/** GET action=assign&code=<branch>&tokens=a,b,c&agent=<name>[&brief=0][&intro=1][&note=…].
 *  Writes the agent onto every actionable row the client has (or every row,
 *  or a new "assign" row for a client who has not answered), e-mails the
 *  agent one brief for the batch, and, when asked, the client an
 *  introduction: the "name and a number" the receipt promised. */
function transitionAssign_(p) {
  p = p || {};
  var w = tWho_(p.code, p.who);
  /* the branch names, and since 5 October 2026 so do staff ("as the branch manager i and the staff has to be given the
     option of which agent to assign"): a unit manager and an agent still cannot */
  if (!w.ok || !tCanAssign_(w)) return { ok: false, refused: true, error: 'Only the branch (the branch code, or a branch manager signed in) and the staff can name an agent on a client.' };
  var byStaff = w.role === 'staff' && w.me && w.me.name ? w.me.name : '';
  var agentName = String(p.agent || '').trim().slice(0, 80);
  var tokens = String(p.tokens || p.token || '').split(',').map(function (s) { return s.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64); }).filter(Boolean);
  if (!agentName || !tokens.length) return { ok: false, error: 'Choose an agent and at least one client.' };
  var agent = null;
  tRoster_().forEach(function (a) { if (a.name.toLowerCase() === agentName.toLowerCase()) agent = a; });
  if (!agent) return { ok: false, error: 'No agent by that name on the Agent Skill Bank (active rows only).' };
  var wantBrief = !/^(0|no|false)$/i.test(String(p.brief === undefined ? '1' : p.brief));
  var wantIntro = /^(1|yes|true)$/i.test(String(p.intro || ''));
  var extra = String(p.note || '').replace(/[\[\]<>]/g, '').trim().slice(0, 200);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'The sheet is busy. Try again in a moment.' };
  try {
    var b = tBoard_({ ok: true, role: 'branch', me: null }, true, true), map = {};
    b.clients.forEach(function (c) { map[c.token] = c; });
    b.silent.forEach(function (c) { map[c.token] = c; });
    (b.family || []).forEach(function (c) { map[c.token] = c; });   // a family member off the board, named with the household
    var sh = ss_().getSheetByName(SVC.RESP_SHEET);
    if (!sh && typeof responseSheet_ === 'function') sh = responseSheet_();
    if (!sh) return { ok: false, error: 'The Client Responses tab is missing.' };
    var now = new Date(), stamp = Utilities.formatDate(now, tTz_(), 'd MMM');
    /* who named, outside the stamp so the stamp's readers (the claims, the history) still read the agent alone; it shows
       on the card and in the brief as the file note "assigned 5 Oct · Name: named by …" */
    var marker = '[assigned ' + stamp + ' · ' + agent.name + ']' + (byStaff ? ' named by ' + byStaff : '') + (extra ? (byStaff ? ': ' : ' ') + extra : '');
    var done = [], missing = [], written = 0, onBoard = {};
    if (byStaff) b.clients.forEach(function (c) { onBoard[c.token] = true; });   // staff name only the clients on their own board
    tokens.forEach(function (tok) {
      var c = map[tok];
      if (!c || (byStaff && !onBoard[tok])) { missing.push(tok); return; }
      var targets = (c.rows || []).filter(function (r) { return r.type !== 'informed'; });
      if (!targets.length) targets = c.rows || [];
      if (targets.length) {
        targets.forEach(function (r) {
          sh.getRange(r.n, 9, 1, 2).setValues([[agent.name, now]]);
          var cell = sh.getRange(r.n, 11), note = String(cell.getValue() || '');
          cell.setValue((note ? note + ' ' : '') + marker);
          written++;
        });
      } else {
        sh.appendRow([now, tok, c.seg || '', 'assign', 'a named agent, from the board', '/assign', byStaff ? 'staff: ' + byStaff : 'branch', 'Open', agent.name, now, marker]);
        c.rows = [{ n: sh.getLastRow(), type: 'assign' }];
        written++;
      }
      c.assigned = agent.name; c.assignedOn = stamp;
      done.push(c);
    });
    var briefed = false, introduced = 0, notAnswered = 0, introHeld = 0, warnings = [];
    /* client e-mail on hold (7 October 2026: an introduction went to a client while an agent was being trained on the
       board): the agent is named and briefed, and the client is sent nothing and nothing is marked. An introduction
       held does not go by itself after the go, because a naming made in practice would go with it. */
    var holdIntro = TRANSITION.HOLD_INTROS !== false && tClientMailHeld_();
    if (done.length && wantBrief) {
      try { tBriefMail_(agent, done, b); briefed = true; }
      catch (e) { warnings.push('The brief to ' + agent.name + ' did not send: ' + String(e && e.message ? e.message : e)); }
    }
    if (done.length && wantIntro) {
      /* one introduction per inbox in one press (a family sharing an e-mail reads it once), and none to an address
         the send row holds back: a bounce, a check, an inbox shared with the one already written to. None to a client
         who has not answered (a silent row, the family of one who did, a client reached by phone for their details only,
         or one named before without an answer: tHasAnswered_): the introduction thanks them for answering, and they have
         asked for nothing; the agent's brief carries them, and the agent calls. */
      var inboxes = {};
      done.forEach(function (c) {
        var mail = String(c.email || '').trim().toLowerCase();
        if (!tHasAnswered_(c)) { notAnswered++; return; }
        if (c.canTell === false || !mail || inboxes[mail]) return;
        if (holdIntro) { introHeld++; inboxes[mail] = true; return; }
        try { if (tIntroMail_(sh, c, agent, stamp)) { introduced++; inboxes[mail] = true; } }
        catch (e) { warnings.push('The introduction to ' + c.client + ' did not send: ' + String(e && e.message ? e.message : e)); }
      });
    }
    log_('transition', 'assign', agent.name + ' · ' + done.length + ' client' + (done.length === 1 ? '' : 's') + (byStaff ? ' · named by ' + byStaff : '') +
         (briefed ? ' · briefed' : '') + (introduced ? ' · ' + introduced + ' introduced' : '') + (introHeld ? ' · ' + introHeld + ' introduction' + (introHeld === 1 ? '' : 's') + ' held: client e-mail on hold' : '') +
         (missing.length ? ' · ' + missing.length + ' unknown' : ''));
    return { ok: true, agent: agent.name, assigned: done.length, rows: written, briefed: briefed, introduced: introduced, introHeld: introHeld, notAnswered: notAnswered, missing: missing, warnings: warnings };
  } finally { lock.releaseLock(); }
}

/** GET action=update&code=…[&who=…]&token=…&status=Called|Met|Declined|Closed|Open|No answer[&note=…][&tell=…&line=…].
 *  An outcome on every actionable row the client has (Status, and a stamped
 *  note); "No answer" stamps the note and leaves the row Open, so the chase
 *  still watches it. An agent may mark only a client named to them. With
 *  `tell` (the branch code only), the client is also sent the manager's note
 *  of that name from T_NOTES, with `line` as a sentence of his own: `note` is
 *  the file's and never reaches the client. */
function transitionUpdate_(p) {
  p = p || {};
  var w = tWho_(p.code, p.who);
  if (!w.ok) return { ok: false, refused: true, error: w.error };
  var tok = String(p.token || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  var status = String(p.status || '').trim(), noAnswer = /^no answer$/i.test(status), known = '';
  T_STATUSES.forEach(function (s) { if (s.toLowerCase() === status.toLowerCase()) known = s; });
  if (!tok || (!known && !noAnswer)) return { ok: false, error: 'Choose a client and an outcome.' };
  var extra = String(p.note || '').replace(/[\[\]<>]/g, '').trim().slice(0, 300);
  var tell = String(p.tell || '').trim().toLowerCase();
  var line = String(p.line || '').replace(/<[^>]*>/g, '').replace(/[\[\]<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  /* both refusals come before anything is written, so a refused note never leaves half an update behind */
  if (tell && tell !== T_STILL_KEY && !T_NOTES.hasOwnProperty(tell)) return { ok: false, error: 'That is not one of the notes the board sends.' };
  /* the "still on it" note is the team's, so the branch and Client Support may press it (6 October 2026); the others are the manager's */
  if (tell === T_STILL_KEY && !tCanAssign_(w)) return { ok: false, refused: true, error: 'Only the branch and Client Support send the "still on it" note from the board.' };
  if (tell && tell !== T_STILL_KEY && (w.role !== 'branch' || w.canTell === false)) return { ok: false, refused: true, error: 'Only the branch manager can e-mail a client from the board: the notes go in his name.' };
  /* a family member the client told us about (29 September: a client who told the manager about his wife), put in one household */
  var fam = String(p.family || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (fam === tok) fam = '';
  if (fam && w.role !== 'branch') return { ok: false, refused: true, error: 'Only the branch can link a family.' };
  var who = w.me && w.me.name ? w.me.name : 'branch';
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'The sheet is busy. Try again in a moment.' };
  try {
    var sh = ss_().getSheetByName(SVC.RESP_SHEET), last = sh ? sh.getLastRow() : 0;
    if (!sh || last < 2) return { ok: false, error: 'No responses yet.' };
    var vals = sh.getRange(2, 1, last - 1, 11).getValues(), any = [], targets = [], assignedTo = '', notes = '';
    vals.forEach(function (v, i) {
      if (String(v[1] || '').trim() !== tok) return;
      any.push(i + 2);
      notes += ' ' + String(v[10] || '');
      if (String(v[3] || '').trim() !== 'informed') targets.push(i + 2);
      if (String(v[8] || '').trim()) assignedTo = String(v[8]).trim();
    });
    if (!any.length) {
      /* a client on the call list with nothing on Client Responses yet (7 October 2026): the try needs a row to sit on, a
         /call row (tCallRow_), the branch's record, which nothing ever reads as the client's answer. The branch and staff
         work the call list; an agent's clients always have a row already */
      if (!tCanAssign_(w)) return { ok: false, error: 'No rows for that client.' };
      var srow = tRowByToken_(tok);
      if (!srow || tYes_(srow.Test)) return { ok: false, error: 'That client is not on the send list.' };
      sh.appendRow([new Date(), tok, tText_(srow.Segment).toUpperCase(), 'call', 'a call from the board', '/call',
        w.role === 'staff' && w.me ? 'staff: ' + w.me.name : 'branch', 'Open', '', '', '']);
      any = [sh.getLastRow()]; targets = any.slice();
    }
    /* the name on the rows, or the one Salesforce gave (the Household Assignments tab): the board shows the client on that
       person's list either way, so either lets them mark it */
    var names = [assignedTo];
    if (w.role !== 'branch') { try { var hx = tHaRead_(); if (hx) hx.rows.forEach(function (r) { if (r.token === tok && r.agent) names.push(r.agent); }); } catch (e) {} }
    var mayMark = function (test) { return names.some(function (n) { return test(n); }); };
    if (w.role === 'agent' && !mayMark(tOnTeam_([w.me.name]))) return { ok: false, refused: true, error: 'That client is not on your list.' };
    if (w.role === 'unit' && !mayMark(tOnTeam_(w.team))) return { ok: false, refused: true, error: 'That client is not on your team\'s list.' };
    if (!targets.length) targets = any;
    var stamp = Utilities.formatDate(new Date(), tTz_(), 'd MMM');
    var linked = fam ? tLinkFamily_(tok, fam) : null;
    var marker = '[' + (noAnswer ? 'no answer' : known.toLowerCase()) + ' ' + stamp + ' · ' + who + ']' + (extra ? ' ' + extra : '') +
      (linked && linked.ok ? ' [family: ' + linked.name.replace(/[\[\]]/g, '') + ', ' + linked.hh + ']' : '');
    targets.forEach(function (rn) {
      if (!noAnswer) sh.getRange(rn, 8).setValue(known);
      var cell = sh.getRange(rn, 11), note = String(cell.getValue() || '');
      cell.setValue((note ? note + ' ' : '') + marker);
    });
    /* the outcome is on the rows whatever happens to the note: a note that cannot go says why, and nothing is marked sent */
    var told = null, toldMark = '[told ' + stamp + ' · ' + tell + ']';
    if (tell) {
      told = notes.indexOf(toldMark) >= 0 ? { sent: false, why: 'that note already went to them today' }
        : tell === T_STILL_KEY ? tStillClient_(tok, vals, sh)
        : tTellClient_(tok, tell, noAnswer ? 'No answer' : known, line);
      if (told.sent) {
        var first = sh.getRange(targets[0], 11), had = String(first.getValue() || '');
        first.setValue((had ? had + ' ' : '') + toldMark);
      }
    }
    log_('transition', 'update', who + ' · ' + (noAnswer ? 'no answer' : known) + ' · ' + tok + ' · ' + targets.length + ' row' + (targets.length === 1 ? '' : 's') +
         (told ? (told.sent ? ' · note "' + tell + '" e-mailed' : ' · note "' + tell + '" not sent: ' + told.why) : '') +
         (linked ? (linked.ok ? ' · family linked, ' + linked.hh : ' · family not linked: ' + linked.why) : ''));
    var out = { ok: true, status: noAnswer ? 'Open' : known, rows: targets.length };
    if (told) { out.told = told.sent; if (told.sent) out.toldTo = told.to; else out.warning = 'The note did not go: ' + told.why + '.'; }
    if (linked) {
      if (linked.ok) { out.household = linked.hh; out.family = linked.name; }
      else out.warning = (out.warning ? out.warning + ' ' : '') + 'The family was not linked: ' + linked.why + '.';
    }
    return out;
  } finally { lock.releaseLock(); }
}

/* ── the manager's own note to the client, sent from the board ────────── */
/* 28 September 2026: "a button where I click so I can update the notes and let
   them know that I will assign their agent as discussed and will review etc,
   to create the experience". Marking a call on the board (transitionUpdate_)
   can send the client one of these notes, in the manager's own name, with a
   line of his own if he adds one. It goes from support@ with the branch copied
   and the confidentiality footer, like every client e-mail, and never through
   Gmail. The notes never give a date for the agent (24 September: the client is
   matched to the agent who fits, and nothing says when), never mention anyone
   who left, and never give advice. Only the manager's click sends one, so the
   hold on automatic client e-mail (HOLD_CLIENT_MAIL) does not stop it: the
   click is his go for that one note. The board shows the words before he
   sends, from tNotesForBoard_, so what he reads is what the client gets. */
var T_NOTES = {
  agent:  { label: 'I am matching you with your agent', subject: 'Following our {{what}} today',
            body: 'As we discussed, I am matching you with the agent on our branch team who best fits your file, and I will introduce them to you in writing. Until then, our branch team looks after your policy.' },
  review: { label: 'I am looking into your file myself', subject: 'Following our {{what}} today',
            body: 'As we discussed, I am looking into your file myself, and I will come back to you with what I find. Nothing about your policy changes in the meantime.' },
  noted:  { label: 'Thank you: all noted', subject: 'Thank you for your time today',
            body: 'Everything you told me is noted on your file. Nothing about your policy changes, and our branch team keeps looking after it.' },
  missed: { label: 'I tried to reach you', subject: 'I tried to reach you today',
            body: 'I tried to reach you today about your answers to our letter. When is a good time for a call? Reply to this e-mail with a day and a time, or call the branch on {{phone}}.' }
};
/* the first line follows what happened on the call; the "missed" note has none, and no closing line either */
var T_NOTE_THANKS = { Called: 'Thank you for speaking with me today.', Met: 'Thank you for meeting with me today.', _: 'Thank you for your time today.' };
var T_NOTE_CLOSE = 'If anything comes up, reply to this e-mail and it reaches us directly.';

function tBranchPhone_() { return (typeof SVC !== 'undefined' && SVC.AGENT_PHONE) || '(868) 678-5921'; }
function tNoteSign_() {
  var m = TRANSITION.MANAGER || {};
  return { name: m.name || 'Ricky Rampersad', title: (m.title || 'Branch Manager') + ' · Ricky Rampersad Branch', line: 'Guardian Life of the Caribbean' };
}

/** Why the manager's note cannot go to this Transition Send row, or '' when
 *  it can: an e-mail that looks like one, and a row not held. An e-mail taken
 *  by phone waits on the row for the branch's go, and is the client's own,
 *  spelled back on the call, so the manager's click may use it; anything else
 *  in Exclude (a bounce, a check, a household, a claim) stops the note. */
function tNoteBlock_(row) {
  if (!row) return 'not on the send list';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tText_(row.Email))) return 'no e-mail on file';
  var ex = tHeld_(row.Exclude) ? (tText_(row.Exclude) || 'held') : '';
  if (ex && !/^hold: e-mail by phone/i.test(ex)) return 'the send row is held (' + ex + ')';
  return '';
}

/** The note's words in order: subject, then the paragraphs between "Dear …" and the signature. */
function tNoteParts_(key, status, line) {
  var n = T_NOTES[key], paras = [];
  if (key !== 'missed') paras.push(T_NOTE_THANKS[status] || T_NOTE_THANKS._);
  paras.push(n.body.replace('{{phone}}', tBranchPhone_()));
  if (line) paras.push(line);
  if (key !== 'missed') paras.push(T_NOTE_CLOSE);
  return { subject: n.subject.replace('{{what}}', status === 'Met' ? 'meeting' : 'call'), paras: paras };
}

/** What the board needs to offer the notes and show them word for word before they go: the manager's notes for
 *  the branch manager, and the team's "still on it" note for the branch and Client Support (6 October 2026).
 *  Null when the person may send none. */
function tNotesForBoard_(w) {
  var manager = !!w && w.ok && w.role === 'branch' && w.canTell !== false, team = tCanAssign_(w);
  if (!manager && !team) return null;
  var list = manager ? Object.keys(T_NOTES).map(function (k) {
    var n = T_NOTES[k];
    return { key: k, label: n.label, subject: n.subject, body: n.body.replace('{{phone}}', tBranchPhone_()) };
  }) : [];
  if (team) list.push(tStillNoteForBoard_());
  return { ready: !!tMsCreds_(), thanks: T_NOTE_THANKS, close: T_NOTE_CLOSE, sign: tNoteSign_(), list: list };
}

/* ── the "still on it" note, pressed by a person ───────────────────────── */
/* Three automatic e-mails, then a person (6 October 2026). The chase no longer
   sends the client the "still on it" note (STILL_NOTE_AUTO); it lists the late
   clients for the branch, and a person who has read the file sends the note
   from the board, once ever, in the team's name and words (receipt.json
   `still`, the same e-mail tChaseClient_ always sent), by opening the client,
   marking the call and ticking the note. The branch and Client Support may
   press it (tCanAssign_), because the note is the team's, not the manager's. */
var T_STILL_KEY = 'still';
function tStillNoteForBoard_() {
  var rc = null;
  try { rc = tReceipt_(); } catch (e) {}
  var care = tCare_(rc), still = rc && rc.json && rc.json.still;
  var text = (still && still.follow && still.follow['default']) || (still && still.line) ||
    'Thank you for answering our letter. It has taken us longer than it should, and we are sorry for the wait. {{care_Us}} is still on it.';
  text = text.replace(/\{\{care_name\}\}/g, care.care_name).replace(/\{\{care_first\}\}/g, care.care_first).replace(/\{\{care_us\}\}/g, care.care_us)
             .replace(/\{\{care_Us\}\}/g, care.care_Us).replace(/\{\{care_line\}\}/g, care.care_line).replace(/\{\{next\}\}/g, '')
             .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return { key: T_STILL_KEY, label: 'Still on it (the team\'s note, once ever)', subject: 'Still on it, {{first}}.', body: text, plain: true, once: true,
           sign: { name: care.care_name, title: 'Ricky Rampersad Branch', line: 'Guardian Life of the Caribbean' } };
}

/** Sends the client the team's "still on it" note on a person's press, once ever: refuses when it already went
 *  (a sent [chase2] mark on any of the client's rows; a held mark does not count), when the send row cannot be
 *  written to (tNoteBlock_), or when the note does not send. Marks every row [chase2] so the chase and the trail
 *  read it as sent. vals and sh are Client Responses as transitionUpdate_ read them. */
function tStillClient_(tok, vals, sh) {
  var rows = [], open = [], before = false;
  vals.forEach(function (v, i) {
    if (String(v[1] || '').trim() !== tok || tAssignRow_(v[5]) || tCallRow_(v[5])) return;
    var note = String(v[10] || '');
    var x = { rowNum: i + 2, received: v[0] instanceof Date ? v[0] : null, r: String(v[3] || '').trim().toLowerCase(),
              needs: String(v[4] || ''), q: tQOf_(v[5]), note: note };
    rows.push(x);
    if (/\[chase2\](?!\s*held)/.test(note)) before = true;
    if (String(v[7] || '').trim().toLowerCase() === 'open' && x.received) open.push(x);
  });
  if (!rows.length) return { sent: false, why: 'no answers on record for that client' };
  if (before) return { sent: false, why: 'the "still on it" note already went to them, and it goes once' };
  var row = null;
  try { tRead_().rows.forEach(function (r) { if (!row && tText_(r.Token) === tok) row = r; }); }
  catch (e) { return { sent: false, why: 'the send list could not be read (' + String(e && e.message ? e.message : e).slice(0, 120) + ')' }; }
  var why = tNoteBlock_(row);
  if (why) return { sent: false, why: why };
  if (!tMsCreds_()) return { sent: false, why: 'Microsoft 365 sending is not set up (MS_TENANT, MS_CLIENT and MS_SECRET)' };
  var pick = (open.length ? open : rows).slice().sort(function (a, b) {
    return ((T_PRIORITY[b.q] || T_PRIORITY[b.r] || 0) - (T_PRIORITY[a.q] || T_PRIORITY[a.r] || 0)) || ((a.received || 0) - (b.received || 0));
  })[0];
  var went = false;
  try { went = tChaseClient_(row, pick.r, pick.needs); } catch (e) { return { sent: false, why: String(e && e.message ? e.message : e).slice(0, 200) }; }
  if (!went) return { sent: false, why: 'the note did not send (the log says why)' };
  rows.forEach(function (x) { if (x.note.indexOf('[chase2]') >= 0 && !/\[chase2\]\s*held/.test(x.note)) return;
    try { sh.getRange(x.rowNum, 11).setValue((x.note ? x.note + ' ' : '') + '[chase2]'); } catch (e) {} });
  return { sent: true, to: tText_(row.Email) };
}

function tNoteHtml_(first, parts, rc) {
  var esc = tEsc_, s = tNoteSign_();
  return '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:520px">' + tHead_() +
    '<div style="padding:18px 4px 0"><p style="margin:0 0 12px">Dear ' + esc(first) + ',</p>' +
    parts.paras.map(function (x) { return '<p style="margin:0 0 12px">' + esc(x) + '</p>'; }).join('') +
    '<p style="margin:16px 0 0"><b style="display:block">' + esc(s.name) + '</b>' + esc(s.title) + '<br>' + esc(s.line) + '</p>' +
    tLegal_(rc) + '</div></div>';
}

/** Sends the note to the client on the Transition Send row for this token.
 *  { sent: true, to } or { sent: false, why }; never throws. */
function tTellClient_(tok, key, status, line) {
  var row = null;
  try { tRead_().rows.forEach(function (r) { if (!row && tText_(r.Token) === tok) row = r; }); }
  catch (e) { return { sent: false, why: 'the send list could not be read (' + String(e && e.message ? e.message : e).slice(0, 120) + ')' }; }
  var why = tNoteBlock_(row);
  if (why) return { sent: false, why: why };
  if (!tMsCreds_()) return { sent: false, why: 'Microsoft 365 sending is not set up (MS_TENANT, MS_CLIENT and MS_SECRET)' };
  var to = tText_(row.Email), parts = tNoteParts_(key, status, line);
  try { tMsSend_(to, parts.subject, tNoteHtml_(tText_(row['First name']) || 'there', parts, tReceipt_()), tClientOpts_()); }
  catch (e) { return { sent: false, why: String(e && e.message ? e.message : e).slice(0, 200) }; }
  return { sent: true, to: to };
}

/** One internal e-mail to the agent for the batch: every client named to
 *  them in this press, with everything the branch knows, so the first call
 *  is personal and not cold. From the script owner's account, never to a
 *  client, and it says it is internal. */
var T_BRIEF_FULL = 25;   // clients shown in full in one brief; a larger batch lists the rest by name, and the board has every one
function tBriefMail_(agent, clients, board) {
  var F = 'Inter,Arial,sans-serif', esc = tEsc_;
  var to = agent.email || TRANSITION.COPY_TO || SVC.AGENT_EMAIL;
  var names = clients.map(function (c) { return c.client; });
  var subject = (agent.email ? '' : '(no e-mail on the roster for ' + agent.name + ') ') + 'Your client' + (clients.length === 1 ? '' : 's') + ': ' +
    names.slice(0, 3).join(', ') + (names.length > 3 ? ' and ' + (names.length - 3) + ' more' : '');
  var block = function (c) {
    var lines = '';
    if (c.answers && c.answers.length) lines += '<p style="margin:8px 0 2px"><b>What they told us</b></p><ul style="margin:0;padding-left:18px">' +
      c.answers.map(function (a) { return '<li><span style="color:#64798e">' + esc(a.q) + '</span><br><b>' + esc(a.a) + '</b></li>'; }).join('') + '</ul>';
    if (c.taps && c.taps.length) lines += '<p style="margin:8px 0 2px"><b>They tapped</b> ' + c.taps.map(function (t) { return esc(t.label) + (t.needs ? ' <span style="color:#64798e">(' + esc(t.needs) + ')</span>' : ''); }).join(' · ') + '</p>';
    if (c.notes && c.notes.length) lines += '<p style="margin:8px 0 2px"><b>In their words</b></p>' + c.notes.map(function (n) { return '<p style="margin:2px 0;font-style:italic">“' + esc(n) + '”</p>'; }).join('');
    if (c.review) lines += '<p style="margin:8px 0 2px"><b>Their review</b> ' + esc(c.review.ref) + (c.review.priority ? ' · ' + esc(c.review.priority) : '') + '</p>' +
      (c.review.words || []).map(function (x) { return '<p style="margin:2px 0"><span style="color:#64798e">' + esc(x.q) + '</span><br>' + esc(x.a) + '</p>'; }).join('');
    if (c.fileNotes && c.fileNotes.length) lines += '<p style="margin:8px 0 2px"><b>On the file</b></p>' + c.fileNotes.map(function (n) { return '<p style="margin:2px 0;color:#64798e">' + esc(n) + '</p>'; }).join('');
    /* who they are, what to raise first, and their policies with us, from the Client Book and the Client Profile: a row off
       the board carries the totals alone, so the rest is read here */
    var bpol = c.pol && c.pol.list ? c.pol : (c.no ? tBookFor_(c.no, true) : null), bprof = c.profile || (c.no ? tProfileFor_(c.no) : null);
    lines += tBookMailHtml_(bpol, bprof, c.ins || tInsightsFor_(bpol, bprof, tBook_().today));
    /* the family on our list, by name, age and where they stand: never the figures of anyone not named to this agent */
    var fam = board && c.hh && board.households && board.households[c.hh] ? board.households[c.hh].filter(function (m) { return m.onList && m.token !== c.token; }) : [];
    if (fam.length) lines += '<p style="margin:8px 0 2px"><b>' + esc((board.hhInfo && board.hhInfo[c.hh] && board.hhInfo[c.hh].name) || 'Their household') + '</b> <span style="color:#64798e">' +
      fam.map(function (m) { return esc(m.client) + (m.age !== undefined ? ' (' + m.age + ')' : '') + ': ' + esc(m.state === 'answered' ? 'answered' : m.state); }).join(' · ') + '</span></p>';
    var reach = [];
    if (c.phone) reach.push('<a href="tel:' + esc(String(c.phone).replace(/[^\d+]/g, '')) + '">' + esc(c.phone) + '</a>');
    if (c.email) reach.push('<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
    if (c.reach) reach.push('prefers ' + esc(c.reach.toLowerCase()));
    if (c.when) reach.push('best in the ' + esc(c.when.toLowerCase()));
    /* r=phone: the caller's copy of the answer page. Without an r= the address opens the film. */
    var link = 'https://rickyrampersadbranch.com/your-policy/?t=' + encodeURIComponent(c.token) + '&s=' + encodeURIComponent(c.seg || '') + '&r=phone';
    return '<div style="border:1px solid #d7e3ea;border-radius:10px;padding:12px 14px;margin:10px 0">' +
      '<p style="margin:0"><b style="font-size:16px;color:#12202e">' + esc(c.client) + '</b> <span style="color:#64798e">' + esc(c.no || '') + ' · letter ' + esc(c.seg || '') +
      (c.book ? ' · was with ' + esc(c.book) : '') + (c.sent ? ' · written to ' + esc(c.sent) : '') + (c.first ? ' · answered ' + esc(c.first) : '') + '</span></p>' +
      (c.needs && c.needs.length ? '<p style="margin:6px 0 0;color:#8a3324"><b>Needs:</b> ' + esc(c.needs.join('; ')) + '</p>' : '') + lines +
      '<p style="margin:8px 0 0"><b>Reach them:</b> ' + (reach.length ? reach.join(' · ') : 'no phone or e-mail on the sheet: look the client up by number') + '</p>' +
      '<p style="margin:6px 0 0;font-size:13px"><a href="' + link + '">Their own answer page</a>: tick anything more they tell you with them on the line, and it lands on the sheet.</p></div>';
  };
  var html = '<div style="font:15px/1.5 ' + F + ';color:#33465a;max-width:640px">' +
    '<h2 style="font:800 20px ' + F + ';color:#12202e;margin:0 0 4px">' + esc(agent.name) + ', you have been named on ' + clients.length + ' client' + (clients.length === 1 ? '' : 's') + '.</h2>' +
    '<p style="margin:0 0 12px;color:#64798e">From the transition letters. Each is a call before anything else, at the time the client chose. Mark the outcome on your list: ' +
    '<a href="https://rickyrampersadbranch.com/orphan-transition/assign.html">rickyrampersadbranch.com/orphan-transition/assign.html</a> (your own code, or the branch code and your name).</p>' +
    clients.slice(0, T_BRIEF_FULL).map(block).join('') +
    (clients.length > T_BRIEF_FULL ? '<p style="margin:14px 0 4px"><b>And ' + (clients.length - T_BRIEF_FULL) + ' more</b> <span style="color:#64798e">(each in full on your list on the board)</span></p>' +
      '<p style="margin:0;font-size:13.5px">' + clients.slice(T_BRIEF_FULL).map(function (c) { return esc(c.client) + ' <span style="color:#64798e">' + esc(c.no || '') + '</span>'; }).join(' · ') + '</p>' : '') +
    '<div style="background:#fff6df;border-left:4px solid #efc24b;padding:10px 14px;margin:14px 0;font-size:13.5px">' +
    '<b>Three rules.</b> Nothing about the former agent beyond what the letter said. If the client says the former agent has been in touch, or that they pay in person, thank them, say a person calls before anything else, and do not ask what was said. ' +
    'Nothing needs to be signed or paid until they have spoken to the branch.</div>' +
    '<p style="font:12px ' + F + ';color:#64798e;margin-top:18px">' + esc(tInternal_(tReceipt_())) + '</p></div>';
  MailApp.sendEmail(to, subject, 'Open in a mail app that shows HTML.', { htmlBody: html, name: TRANSITION.FROM_NAME });
}

/** The introduction the receipt promised: "once your file has been read, we
 *  introduce the agent who fits it, in writing, with a name and a number".
 *  From support@ through clientMail_ (Service.gs) with the branch copied;
 *  once per client per agent, marked on the client's first row. Returns
 *  true when it went. */
function tIntroMail_(sh, c, agent, stamp) {
  var to = String(c.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  var mark = '[intro ' + agent.name + ']';
  if ((c.markers || []).some(function (m) { return m.indexOf('[intro') === 0 && m.indexOf(agent.name) > 0; })) return false;
  if (typeof clientMail_ !== 'function') throw new Error('clientMail_ is not in this project');
  var rc = tReceipt_(), care = tCare_(rc), esc = tEsc_;
  var first = c.firstName || 'there', aFirst = agent.name.split(/\s+/)[0];
  var call = c.open ? '<p style="margin:0 0 12px">' + esc(aFirst) + ' will call you ' + (c.when ? 'in the ' + esc(c.when.toLowerCase()) : 'in the next few days') +
    (c.reach && /whatsapp/i.test(c.reach) ? ', and can reach you on WhatsApp as you asked' : '') + '.</p>' : '';
  var direct = [];
  if (agent.phone) direct.push(esc(agent.phone));
  if (agent.email) direct.push('<a href="mailto:' + esc(agent.email) + '" style="color:#07606f">' + esc(agent.email) + '</a>');
  var html = '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:520px">' + tHead_() +
    '<div style="padding:18px 4px 0"><p style="margin:0 0 12px">Dear ' + esc(first) + ',</p>' +
    '<p style="margin:0 0 12px">Thank you for answering our letter. A person has read what you told us, and <b>' + esc(agent.name) + '</b> of our branch team ' +
    'now looks after your policy.</p>' + call +
    '<p style="margin:0 0 12px">You can reach ' + esc(aFirst) + ' directly' + (direct.length ? ': ' + direct.join(' · ') : ' by replying to this e-mail') +
    '. Nothing about your policy changes: it stays with Guardian Life, and the same branch team keeps your file.</p>' +
    '<p style="margin:16px 0 0"><b style="display:block">' + esc(care.care_name) + '</b>' + esc(care.care_line) + '</p></div></div>';
  clientMail_({ to: to, subject: 'Meet your agent: ' + agent.name, htmlBody: html, cc: TRANSITION.CC || [] });
  try {
    var rn = c.rows && c.rows.length ? c.rows[0].n : 0;
    if (rn) { var cell = sh.getRange(rn, 11), note = String(cell.getValue() || ''); cell.setValue((note ? note + ' ' : '') + mark + ' ' + stamp); }
  } catch (e) {}
  return true;
}

/* ── the Client Book: each client's policies, from the live Branch Portfolio ── */
/* 29 September 2026: "we do need to push more data: the total cover, plan, tenure, premium etc … we did have a lot of
   other data on the workbook". Once a day, before the digest, transitionBuildClientBook opens the Branch Portfolio
   (its ID is the BOOK_SHEET_ID Script property, set from the menu, never this file, which is public), takes every
   policy of every client on Transition Send and writes them to the Client Book tab: the plan, where it stands, when
   it was issued, the premium and how often it is paid, what that comes to in a year, how it is paid, the paid-to date
   and the sum assured. The board reads that tab (tBook_): each card's "Their policies with us", the order by what is
   at stake, what each agent has been named on, the family's total; the agent's brief lists the policies. The build
   refreshes the counts on the Plan Codes tab and adds any code it has not met, with no class. Life cover adds only a
   plan that tab calls life with Confirmed = Y (the house rule: only life sums assured are life cover; critical
   illness, accident, health and savings plans are listed and never added in), and it counts on the board the moment
   it is confirmed, without waiting for the next build. Client Support sees plan and paid-to only: two money-free
   columns on Transition Send, which their calls sheet already imports. An agent sees the figures for their own
   clients and nobody else's. */
var T_BOOK = {
  PROP: 'BOOK_SHEET_ID',          // the Branch Portfolio's spreadsheet ID: a Script property (transitionSetBookSource), never this file
  BUILT: 'client_book_built',     // when the last build ran and what it found, as JSON: a Script property
  SHEET: 'Client Book',
  CODES: 'Plan Codes',
  HOUR: 6,                        // the daily build, sheet time zone: before the 8:00 digest
  CHUNK: 4000,                    // rows per read of the portfolio
  /* The portfolio's Mode column is empty, so how often a premium is paid is read off the figures: monthly, unless it
     is YEARLY_ANY or more, or YEARLY_ANNIV or more and paid to the policy's own anniversary (a yearly payer always is).
     Measured on 29 September 2026 against the 2,120 policies whose mode the PBI export gives: all but 44 come within
     half of their true year; those 44 are mostly quarterly and half-yearly payers, which nothing on the sheet shows.
     "A year" is what the client pays in twelve months: the monthly premium times twelve. */
  YEARLY_ANY: 10000,
  YEARLY_ANNIV: 2000,
  SEND_PLANS: 'Plans on file',    // the two money-free columns on Transition Send, for the Client Support calls sheet
  SEND_PAID: 'Paid to on file',
};
var T_BOOK_HEAD = ['Client number', 'Client', 'Policy', 'Plan code', 'Standing', 'Status description', 'Issued', 'Premium',
  'Pays', 'Premium a year', 'Billing', 'Paid to', 'Sum assured', 'Insurance type', 'Was with'];
var T_CODES_HEAD = ['Plan code', 'Plan', 'Class', 'Confirmed', 'Insurance type', 'Policies', 'In force', 'PBI plan', 'Note'];
/* the portfolio's own headers, matched whatever their case; the first name that is there wins */
var T_BOOK_SRC = { agent: ['agent'], no: ['number', 'policy number'], client: ['client', 'client name'], cno: ['client number'],
  premium: ['premium'], issued: ['issue date'], status: ['status'], status2: ['status(2)'], itype: ['insurance type'],
  paid: ['paid to date'], sa: ['sum assured'], code: ['plan code'], bill: ['billing type'], desc: ['status description'] };
var T_BOOK_NEED = ['cno', 'no', 'code', 'desc', 'premium'];
/* where a policy stands, from Status (0 in force or ended, 1 lapsed, 2 premium overdue, 3 pending), Status(2) and
   Status Description, which is the only column that tells a policy in force from one surrendered or never taken */
var T_STANDING = { inforce: 'in force', overdue: 'premium due', paidup: 'paid up', waived: 'premium waived', annuity: 'annuity in payment',
  pending: 'application pending', lapsed: 'lapsed', ended: 'ended' };
var T_ST_ORDER = { inforce: 0, overdue: 1, paidup: 2, waived: 3, annuity: 4, pending: 5, lapsed: 6, ended: 7 };
var T_LIVE_DESC = { 'premium paying': 'inforce', 'paid up': 'paidup', 'waiver of prem': 'waived', 'vested annuity': 'annuity' };
var T_NEVER = /^(not proceeded with|not taken|postponed|rejected|declined|file closed)$/i;   // applications that never became a policy: no tenure
var T_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function tBookLive_(st) { return st === 'inforce' || st === 'overdue' || st === 'paidup' || st === 'waived' || st === 'annuity'; }
function tStanding_(status, status2, desc) {
  var s = String(status == null ? '' : status).trim(), s2 = String(status2 || '').trim().toLowerCase(), d = String(desc || '').trim().toLowerCase();
  if (s2 === 'pending' || s === '3') return 'pending';
  if (s2 === 'lapse' || s2 === 'lapsed' || s === '1' || d === 'lapsed') return 'lapsed';
  var live = T_LIVE_DESC[d];
  if (live) return live === 'inforce' && (s2 === 'overdue' || s === '2') ? 'overdue' : live;
  return 'ended';
}
/** A class as the Plan Codes tab may write it, in one of the six words; '' when there is none. */
function tClass_(x) {
  var s = String(x || '').trim().toLowerCase();
  if (!s) return '';
  if (/^life\b/.test(s)) return 'life';
  if (/critical|^ci$/.test(s)) return 'critical illness';
  if (/accident|^pa$/.test(s)) return 'accident';
  if (/health|medical|hospital/.test(s)) return 'health';
  if (/saving|annuit|pension|invest/.test(s)) return 'savings';
  return 'other';
}
function tNum_(x) {
  if (typeof x === 'number') return isFinite(x) ? x : 0;
  var n = parseFloat(String(x == null ? '' : x).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}
/** A client number as both sheets can agree on it: digits, no leading zeros (the PBI export pads them, the sheet does not). */
function tCno_(x) {
  if (typeof x === 'number') return isFinite(x) && x > 0 ? String(Math.round(x)) : '';
  return String(x == null ? '' : x).replace(/\D/g, '').replace(/^0+/, '');
}
function tPolNo_(x) { return typeof x === 'number' ? (isFinite(x) ? String(Math.round(x)) : '') : String(x == null ? '' : x).trim(); }
/** A date as yyyy-MM-dd in the zone it was written in, or '' for anything that is not one. (The portfolio shows
 *  ########## where a column is too narrow; that is only how it looks, and the cell underneath is a date.) */
function tYmd_(x, tz) {
  if (x instanceof Date) return isNaN(x.getTime()) ? '' : Utilities.formatDate(x, tz, 'yyyy-MM-dd');
  var s = String(x == null ? '' : x).trim(), m;
  if (!s) return '';
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);   // day first, the way the branch writes it
  var t = Date.parse(s);
  return isNaN(t) ? '' : Utilities.formatDate(new Date(t), tz, 'yyyy-MM-dd');
}
function tDmy_(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? Number(m[3]) + ' ' + T_MON[Number(m[2]) - 1] + ' ' + m[1] : ''; }
function tDaysBetween_(a, b) {
  var pa = String(a).split('-'), pb = String(b).split('-');
  return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
}
function tMoney_(n, dp) { return (Number(n) || 0).toFixed(dp || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
/** How often a premium is paid (T_BOOK above says how this is read), and what it comes to in a year while it is being paid. */
function tPays_(prem, bill, iss, paid) {
  if (!(prem > 0)) return '';
  if (/^single/i.test(String(bill || '').trim())) return 'single';
  var anniv = String(iss).length === 10 && String(paid).length === 10 && iss.slice(5) === paid.slice(5);
  return prem >= T_BOOK.YEARLY_ANY || (anniv && prem >= T_BOOK.YEARLY_ANNIV) ? 'yearly' : 'monthly';
}
function tYearOf_(st, prem, pays) {
  if (st !== 'inforce' && st !== 'overdue') return 0;
  return pays === 'monthly' ? Math.round(prem * 1200) / 100 : pays === 'yearly' ? prem : 0;
}

/* ── the build ── */
/** Menu: asks for the Branch Portfolio's link, keeps its ID in the Script properties, and builds the Client Book once.
 *  From then on it rebuilds every morning at T_BOOK.HOUR. */
function transitionSetBookSource() {
  var ui = SpreadsheetApp.getUi(), cur = PropertiesService.getScriptProperties().getProperty(T_BOOK.PROP);
  var res = ui.prompt('The Branch Portfolio', 'Paste the link to the Branch Portfolio sheet: the address in the browser when it is open.' +
    (cur ? ' A link is already set; a new one replaces it.' : ''), ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var txt = String(res.getResponseText() || '').trim(), m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(txt);
  var id = m ? m[1] : (/^[a-zA-Z0-9_-]{20,}$/.test(txt) ? txt : '');
  if (!id) { ui.alert('That is not a link to a Google Sheet. Open the Branch Portfolio, copy the address from the browser, and try again.'); return; }
  try { SpreadsheetApp.openById(id).getName(); }
  catch (e) { ui.alert('This account cannot open that sheet (' + String(e && e.message ? e.message : e) + '). Share it with the account that owns this script, or check the link.'); return; }
  PropertiesService.getScriptProperties().setProperty(T_BOOK.PROP, id);
  var r = tBuildBook_();
  ui.alert(r.msg + (r.ok ? ' It rebuilds every morning at ' + T_BOOK.HOUR + ':00.' : ''));
}

/** What the daily trigger runs, and the menu's "rebuild now". Safe to run at any time: it rewrites the tab whole. */
function transitionBuildClientBook() { return tSay_(tBuildBook_().msg); }

function tBuildBook_() {
  var id = String(PropertiesService.getScriptProperties().getProperty(T_BOOK.PROP) || '').trim();
  if (!id) return { ok: false, msg: 'No Branch Portfolio link yet: in the sheet, Service Questionnaire → Transition: set the Branch Portfolio link.' };
  var t0 = Date.now();
  try {
    var want = {};
    tRead_().rows.forEach(function (r) { if (tYes_(r.Test)) return; var c = tCno_(r['Client number']); if (c) want[c] = true; });
    /* and the family on the Households tab who are not on the send list: their cover belongs on the household's line */
    tHouseholds_().rows.forEach(function (m) { if (!m.token && m.no) want[m.no] = true; });
    var src = tBookSource_(id), got = tBookRead_(src, want), recs = got.recs;
    recs.sort(function (a, b) {
      return a.client.localeCompare(b.client) || a.cno.localeCompare(b.cno) || (T_ST_ORDER[a.st] - T_ST_ORDER[b.st]) || String(b.iss).localeCompare(String(a.iss));
    });
    tBookWrite_(recs);
    var codes = tCodesSync_(recs);
    tBookForget_();
    var plans = tSendPlans_(recs, tPlanCodes_());
    var prof = tProfileRefresh_(recs, t0 + 300000);
    var have = {};
    recs.forEach(function (r) { have[r.cno] = true; });
    var missing = Object.keys(want).filter(function (c) { return !have[c]; }).length;
    var info = { at: new Date().toISOString(), tab: src.tab, rows: got.rows, policies: recs.length, clients: Object.keys(have).length, missing: missing,
                 added: codes.added, unclassed: codes.unclassed, secs: Math.round((Date.now() - t0) / 1000) };
    PropertiesService.getScriptProperties().setProperty(T_BOOK.BUILT, JSON.stringify(info));
    tBookTrigger_();
    var msg = 'Client Book built: ' + info.policies + ' policies of ' + info.clients + ' clients, read from ' + info.rows + ' rows of "' + src.tab + '"' +
      (missing ? '; ' + missing + ' client' + (missing === 1 ? '' : 's') + ' on the send list with no policy on the portfolio' : '') +
      (codes.added ? '; ' + codes.added + ' new plan code' + (codes.added === 1 ? '' : 's') + ' added to Plan Codes' : '') +
      (codes.unclassed ? '; ' + codes.unclassed + ' plan code' + (codes.unclassed === 1 ? '' : 's') + ' with no class yet (not counted as life cover)' : '') +
      (plans.error ? '; the Plans on file columns were not written: ' + plans.error : '') +
      (prof.rows !== undefined ? '; Client Profile refreshed from Salesforce: ' + prof.rows + ' of ' + prof.of + ' policies' :
        prof.error ? '; the Client Profile was not refreshed: ' + prof.error : '; the Client Profile is the imported one (' + prof.skipped + ')') +
      '. ' + info.secs + ' seconds.';
    log_('transition', 'client book', msg);
    return { ok: true, msg: msg, info: info };
  } catch (e) {
    var bad = 'The Client Book was not built: ' + String(e && e.message ? e.message : e);
    log_('transition', 'client book', bad);
    return { ok: false, msg: bad };
  }
}

/** The daily build's trigger, installed once: by the first build, by setup and by go live. */
function tBookTrigger_() {
  try {
    if (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'transitionBuildClientBook'; })) return;
    ScriptApp.newTrigger('transitionBuildClientBook').timeBased().inTimezone(tTz_()).atHour(T_BOOK.HOUR).everyDays(1).create();
  } catch (e) {}
}

/** The tab on the portfolio that holds the policies (the first whose header row has Client Number and Plan Code), and where each column is. */
function tBookSource_(id) {
  var book = SpreadsheetApp.openById(id), tz = book.getSpreadsheetTimeZone() || tTz_(), found = null;
  book.getSheets().some(function (s) {
    var lc = s.getLastColumn();
    if (!lc || s.getLastRow() < 2) return false;
    var h = s.getRange(1, 1, 1, lc).getValues()[0].map(function (x) { return String(x).trim().toLowerCase(); });
    if (h.indexOf('client number') < 0 || h.indexOf('plan code') < 0) return false;
    found = { sh: s, head: h };
    return true;
  });
  if (!found) throw new Error('the Branch Portfolio has no tab with a Client Number and a Plan Code column');
  var ix = {}, missing = [];
  Object.keys(T_BOOK_SRC).forEach(function (k) {
    var i = -1;
    T_BOOK_SRC[k].forEach(function (n) { if (i < 0) i = found.head.indexOf(n); });
    ix[k] = i;
    if (i < 0 && T_BOOK_NEED.indexOf(k) >= 0) missing.push(T_BOOK_SRC[k][0]);
  });
  if (missing.length) throw new Error('the Branch Portfolio tab "' + found.sh.getName() + '" has no ' + missing.join(', ') + ' column');
  return { sh: found.sh, ix: ix, tz: tz, tab: found.sh.getName() };
}

/** Every row of the portfolio whose client is on the send list, as a record: read in chunks of T_BOOK.CHUNK rows and
 *  only as many columns as the policies need, because the portfolio holds the whole branch. */
function tBookRead_(src, want) {
  var ix = src.ix, cols = Object.keys(ix).map(function (k) { return ix[k]; }).filter(function (i) { return i >= 0; });
  var c0 = Math.min.apply(null, cols), c1 = Math.max.apply(null, cols), last = src.sh.getLastRow(), out = [], seen = 0;
  var at = function (v, k) { return ix[k] >= 0 ? v[ix[k] - c0] : ''; };
  for (var r = 2; r <= last; r += T_BOOK.CHUNK) {
    var vals = src.sh.getRange(r, c0 + 1, Math.min(T_BOOK.CHUNK, last - r + 1), c1 - c0 + 1).getValues();
    vals.forEach(function (v) {
      var cno = tCno_(at(v, 'cno'));
      if (!cno) return;
      seen++;
      if (want[cno]) out.push(tBookRecord_(function (k) { return at(v, k); }, cno, src.tz));
    });
  }
  return { recs: out, rows: seen };
}

function tBookRecord_(get, cno, tz) {
  var iss = tYmd_(get('issued'), tz), paid = tYmd_(get('paid'), tz);
  var prem = Math.round(tNum_(get('premium')) * 100) / 100, bill = String(get('bill') == null ? '' : get('bill')).trim();
  var st = tStanding_(get('status'), get('status2'), get('desc')), pays = tPays_(prem, bill, iss, paid);
  return { cno: cno, client: String(get('client') == null ? '' : get('client')).trim(), no: tPolNo_(get('no')), code: String(get('code') == null ? '' : get('code')).trim(),
           st: st, desc: String(get('desc') == null ? '' : get('desc')).trim(), iss: iss, prem: prem, pays: pays, yr: tYearOf_(st, prem, pays), bill: bill, paid: paid,
           sa: tNum_(get('sa')), itype: String(get('itype') == null ? '' : get('itype')).trim(), agent: String(get('agent') == null ? '' : get('agent')).trim() };
}

/** The Client Book tab, rewritten whole: the new rows over the old, then whatever is left below cleared, so the board
 *  never reads an empty tab while it is being written. Policy and client numbers are kept as text. */
function tBookWrite_(recs) {
  var ss = ss_(), sh = ss.getSheetByName(T_BOOK.SHEET) || ss.insertSheet(T_BOOK.SHEET);
  var w = T_BOOK_HEAD.length, rows = [T_BOOK_HEAD];
  recs.forEach(function (r) {
    rows.push([r.cno, r.client, r.no, r.code, T_STANDING[r.st] || r.st, r.desc, r.iss, r.prem || '', r.pays, r.yr || '', r.bill, r.paid, r.sa || '', r.itype, r.agent]);
  });
  if (sh.getMaxRows() < rows.length) sh.insertRowsAfter(sh.getMaxRows(), rows.length - sh.getMaxRows());
  if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
  sh.getRange(1, 1, rows.length, 1).setNumberFormat('@');
  sh.getRange(1, 3, rows.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, rows.length, w).setValues(rows);
  var last = sh.getLastRow();
  if (last > rows.length) sh.getRange(rows.length + 1, 1, last - rows.length, Math.max(w, sh.getLastColumn())).clearContent();
  if (rows.length > 1) {
    [7, 12].forEach(function (c) { sh.getRange(2, c, rows.length - 1, 1).setNumberFormat('d mmm yyyy'); });
    [8, 10].forEach(function (c) { sh.getRange(2, c, rows.length - 1, 1).setNumberFormat('#,##0.00'); });
    sh.getRange(2, 13, rows.length - 1, 1).setNumberFormat('#,##0');
  }
  try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, w).setFontWeight('bold').setBackground(SB.light); } catch (e) {}
}

/** The Plan Codes tab: every code keeps what sales support wrote; the counts are refreshed; a code not met before is
 *  added at the bottom with no class, so nothing new is ever counted as life cover before it is confirmed. */
function tCodesSync_(recs) {
  var ss = ss_(), sh = ss.getSheetByName(T_BOOK.CODES);
  if (!sh) {
    sh = ss.insertSheet(T_BOOK.CODES);
    sh.appendRow(T_CODES_HEAD);
    try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, T_CODES_HEAD.length).setFontWeight('bold').setBackground(SB.light); } catch (e) {}
  }
  var lastCol = Math.max(1, sh.getLastColumn()), last = Math.max(1, sh.getLastRow());
  var vals = sh.getRange(1, 1, last, lastCol).getValues(), head = vals[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var ic = head.indexOf('plan code'), icl = head.indexOf('class'), ip = head.indexOf('policies'), il = head.indexOf('in force'), it = head.indexOf('insurance type'), inote = head.indexOf('note');
  if (ic < 0) return { added: 0, unclassed: 0, error: 'the Plan Codes tab has no Plan code column' };
  var stats = {};
  recs.forEach(function (r) {
    if (!r.code) return;
    var s = stats[r.code] = stats[r.code] || { n: 0, live: 0, t: {} };
    s.n++;
    if (tBookLive_(r.st)) s.live++;
    s.t[r.itype] = (s.t[r.itype] || 0) + 1;
  });
  var have = {}, unclassed = 0;
  for (var i = 1; i < vals.length; i++) {
    var code = String(vals[i][ic] || '').trim();
    if (!code) continue;
    have[code] = true;
    if (stats[code] && stats[code].live && icl >= 0 && !tClass_(vals[i][icl])) unclassed++;
  }
  if (vals.length > 1) [[ip, 'n'], [il, 'live']].forEach(function (x) {
    if (x[0] < 0) return;
    sh.getRange(2, x[0] + 1, vals.length - 1, 1).setValues(vals.slice(1).map(function (v) { var s = stats[String(v[ic] || '').trim()]; return [s ? s[x[1]] : 0]; }));
  });
  var stamp = Utilities.formatDate(new Date(), tTz_(), 'd MMM yyyy');
  var add = Object.keys(stats).filter(function (c) { return !have[c]; }).sort().map(function (c) {
    var s = stats[c], row = [], t = Object.keys(s.t).sort(function (a, b) { return s.t[b] - s.t[a]; })[0] || '';
    for (var k = 0; k < head.length; k++) row.push('');
    row[ic] = c;
    if (it >= 0) row[it] = t;
    if (ip >= 0) row[ip] = s.n;
    if (il >= 0) row[il] = s.live;
    if (inote >= 0) row[inote] = 'Found by the Client Book build on ' + stamp + ': name it, give it a class and confirm it.';
    if (s.live) unclassed++;
    return row;
  });
  if (add.length) sh.getRange(vals.length + 1, 1, add.length, head.length).setValues(add);
  return { added: add.length, unclassed: unclassed };
}

/** Plan and paid-to for Client Support, who are not licensed and see no money figures: two columns on Transition
 *  Send, which their calls sheet imports already (its Feed tab reads 'Transition Send'!A:AZ). The names are the Plan
 *  Codes tab's at build time. Never throws. */
function tSendPlans_(recs, codes) {
  try {
    var t = tRead_(), sh = t.sh, byNo = {};
    recs.forEach(function (r) { (byNo[r.cno] = byNo[r.cno] || []).push(r); });
    var lastCol = sh.getLastColumn(), cp = t.col[T_BOOK.SEND_PLANS], cd = t.col[T_BOOK.SEND_PAID];
    var grow = (cp ? 0 : 1) + (cd ? 0 : 1);
    if (grow && sh.getMaxColumns() < lastCol + grow) sh.insertColumnsAfter(sh.getMaxColumns(), lastCol + grow - sh.getMaxColumns());
    if (!cp) { cp = ++lastCol; sh.getRange(1, cp).setValue(T_BOOK.SEND_PLANS); }
    if (!cd) { cd = ++lastCol; sh.getRange(1, cd).setValue(T_BOOK.SEND_PAID); }
    if (!t.rows.length) return { rows: 0 };
    var plans = [], paid = [];
    t.rows.forEach(function (r) {
      var x = tPlansText_(byNo[tCno_(r['Client number'])] || [], codes);
      plans.push([x.plans]); paid.push([x.paid]);
    });
    sh.getRange(2, cp, t.rows.length, 1).setValues(plans);
    sh.getRange(2, cd, t.rows.length, 1).setNumberFormat('@').setValues(paid);
    return { rows: t.rows.length };
  } catch (e) { return { error: String(e && e.message ? e.message : e).slice(0, 160) }; }
}
/** "Econo Life to 65: in force, paid to 21 Sep 2026; Evolution to 65: lapsed": no premium, no cover, no sum assured.
 *  A client whose every policy has ended reads what ended ("Evolution to 65: surrendered"), so a blank means nothing on file. */
function tPlansText_(list, codes) {
  var live = list.filter(function (r) { return r.st !== 'ended'; }).sort(function (a, b) { return T_ST_ORDER[a.st] - T_ST_ORDER[b.st]; });
  if (!live.length) live = list.filter(function (r) { return !T_NEVER.test(r.desc); });
  var parts = live.slice(0, 4).map(function (r) {
    var pc = codes[r.code] || {};
    return (pc.name || r.code || 'a policy') + ': ' + (r.st === 'ended' ? String(r.desc || 'ended').toLowerCase() : (T_STANDING[r.st] || r.st)) +
      ((r.st === 'inforce' || r.st === 'overdue') && r.paid ? ', paid to ' + tDmy_(r.paid) : '');
  });
  if (live.length > 4) parts.push('and ' + (live.length - 4) + ' more');
  var due = live.filter(function (r) { return (r.st === 'inforce' || r.st === 'overdue') && r.paid; }).map(function (r) { return r.paid; }).sort();
  return { plans: parts.join('; '), paid: due.length ? tDmy_(due[0]) : '' };
}

/* ── reading it back ── */
var T_BOOK_MEMO = null, T_CODES_MEMO = null;   // one read of each tab per execution
function tBookForget_() { T_BOOK_MEMO = null; T_CODES_MEMO = null; T_PROFILE_MEMO = null; T_PLAN_MEMO = null; }

/** The Plan Codes tab as { code: { name, cls, conf } }: read on every request, so a code confirmed at noon counts at noon. */
function tPlanCodes_() {
  if (T_CODES_MEMO) return T_CODES_MEMO;
  var out = {};
  try {
    var t = tSheetRows_(T_BOOK.CODES), ix = {};
    t.head.forEach(function (h, i) { ix[String(h).trim().toLowerCase()] = i; });
    if (ix['plan code'] !== undefined) t.rows.forEach(function (v) {
      var code = String(v[ix['plan code']] || '').trim();
      if (!code) return;
      var cls = ix['class'] !== undefined ? tClass_(v[ix['class']]) : '';
      out[code] = { name: ix.plan !== undefined ? String(v[ix.plan] || '').trim() : '', cls: cls, conf: !!cls && ix.confirmed !== undefined && tYes_(v[ix.confirmed]) };
    });
  } catch (e) {}
  return (T_CODES_MEMO = out);
}

/** The Client Book tab as { ready, by: { client number: [records] }, built }. */
function tBook_() {
  if (T_BOOK_MEMO) return T_BOOK_MEMO;
  var by = {}, n = 0, tz = tTz_();
  try {
    var t = tSheetRows_(T_BOOK.SHEET), ix = {}, inv = {};
    t.head.forEach(function (h, i) { ix[h] = i; });
    Object.keys(T_STANDING).forEach(function (k) { inv[T_STANDING[k]] = k; });
    if (ix['Client number'] !== undefined && ix.Policy !== undefined) t.rows.forEach(function (v) {
      var cno = tCno_(v[ix['Client number']]);
      if (!cno) return;
      var get = function (h) { return ix[h] !== undefined ? v[ix[h]] : ''; };
      (by[cno] = by[cno] || []).push({ no: tPolNo_(get('Policy')), client: String(get('Client') || '').trim(), code: String(get('Plan code') || '').trim(), st: inv[String(get('Standing')).trim()] || 'ended',
        desc: String(get('Status description') || '').trim(), iss: tYmd_(get('Issued'), tz), prem: tNum_(get('Premium')), pays: String(get('Pays') || '').trim(),
        yr: tNum_(get('Premium a year')), bill: String(get('Billing') || '').trim(), paid: tYmd_(get('Paid to'), tz), sa: tNum_(get('Sum assured')) });
      n++;
    });
  } catch (e) {}
  return (T_BOOK_MEMO = { ready: n > 0, by: by, built: tBookBuilt_(), today: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') });
}
function tBookBuilt_() {
  try {
    var j = JSON.parse(PropertiesService.getScriptProperties().getProperty(T_BOOK.BUILT) || 'null');
    if (j && j.at) { j.when = Utilities.formatDate(new Date(j.at), tTz_(), 'd MMM HH:mm'); return j; }
  } catch (e) {}
  return null;
}

/** A policy's cover, split. Where the Client Profile carries Salesforce's split, its life, critical illness and accident
 *  figures (the portfolio's Sum Assured lumps an Evolution policy's life and critical illness together: on 29 September
 *  2026 that was so on 206 of 509 live Evolution policies); a savings, accident or health plan never counts as life,
 *  whatever its fields say (the house rule: only life sums assured are life cover). Without the split, the Plan Codes
 *  rule: the sum assured of a plan confirmed as life. */
function tCoverOf_(r, pc, pf) {
  var never = pc.cls === 'savings' || pc.cls === 'accident' || pc.cls === 'health';
  if (pf && (pf.life !== null || pf.ci !== null || pf.acc !== null)) {
    return { life: never ? 0 : (pf.life || 0), ci: pf.ci || 0, acc: pf.acc || (pc.cls === 'accident' ? (pf.life || 0) : 0), src: 'sf' };
  }
  var sa = r.sa || 0;
  return { life: pc.cls === 'life' && pc.conf ? sa : 0, ci: pc.cls === 'critical illness' && pc.conf ? sa : 0, acc: pc.cls === 'accident' && pc.conf ? sa : 0, src: 'plan' };
}

/** One client's policies: the totals (sum), and with `withList` each policy not ended plus a count of the ended ones.
 *  Life cover adds the life figure of each live policy (tCoverOf_); a policy with no split whose plan is not yet
 *  confirmed, or has no class, shows its sum assured in `unconf`, which the board says is not counted. Each policy in
 *  the list carries its beneficiaries and what kind they are (tBenKind_), the date its life cover ends, and who it
 *  insures when that is someone else. null when the client has nothing on the book. */
function tBookFor_(cno, withList) {
  var b = tBook_(), recs = b.by[tCno_(cno)];
  if (!recs || !recs.length) return null;
  var codes = tPlanCodes_(), P = tProfiles_(), ended = {}, list = [];
  var s = { live: 0, due: 0, lapsed: 0, pending: 0, ended: 0, prem: 0, cover: 0, ci: 0, acc: 0, unconf: 0, since: '', years: 0 };
  recs.forEach(function (r) {
    var pc = codes[r.code] || { name: '', cls: '', conf: false }, live = tBookLive_(r.st), pf = P.by[r.no] || null;
    var cv = tCoverOf_(r, pc, pf), life = live ? cv.life : 0;
    if (live) { s.live++; if (r.st === 'overdue') s.due++; s.ci += cv.ci; s.acc += cv.acc; }
    else if (r.st === 'lapsed') s.lapsed++;
    else if (r.st === 'pending') s.pending++;
    else { s.ended++; var k = (r.desc || 'ended').toLowerCase(); ended[k] = (ended[k] || 0) + 1; }
    s.prem += r.yr || 0;
    s.cover += life;
    if (live && cv.src === 'plan' && r.sa > 0 && !life && (!pc.cls || pc.cls === 'life')) s.unconf += r.sa;
    if (r.iss && r.st !== 'pending' && !T_NEVER.test(r.desc) && (!s.since || r.iss < s.since)) s.since = r.iss;
    if (withList && r.st !== 'ended') {
      var ins = pf && tOtherLife_(pf.insured, r.client) ? tTitleCase_(pf.insured) : '';   // the life it covers, when that is someone else's
      list.push({ no: r.no, code: r.code, name: pc.name, cls: pc.cls, conf: pc.conf, st: r.st,
        desc: r.st === 'pending' ? r.desc : '', iss: r.iss, prem: r.prem, pays: r.pays, yr: r.yr, bill: r.bill, paid: r.paid,
        od: r.st === 'overdue' && r.paid ? Math.max(0, tDaysBetween_(r.paid, b.today)) : 0, sa: r.sa,
        life: cv.life, ci: cv.ci, acc: cv.acc, src: cv.src, counted: life > 0,
        ben: pf ? pf.ben.map(tTitleCase_) : [], benK: pf ? tBenKind_(pf.ben) : '', ends: pf ? pf.ends : '', insured: ins });
    }
  });
  s.prem = Math.round(s.prem * 100) / 100;
  if (s.since) s.years = Math.max(0, Math.floor(tDaysBetween_(s.since, b.today) / 365.25));
  var out = { sum: s };
  if (withList) {
    out.list = list.sort(function (a, c) { return (T_ST_ORDER[a.st] - T_ST_ORDER[c.st]) || String(c.iss).localeCompare(String(a.iss)); });
    out.ended = Object.keys(ended).sort().map(function (k) { return { what: k, n: ended[k] }; });
  }
  return out;
}

/** The three totals a row without a card uses (its pill and its place in the order): with everyone on the board that is
 *  some 2,700 rows, so nothing more rides on them; the rest comes when the row is opened (transitionBook_). A household
 *  member (`more`) adds critical illness, lapsed and premium due. */
function tBookBrief_(cno, more) {
  var p = tBookFor_(cno, false);
  if (!p) return null;
  var o = { prem: p.sum.prem, cover: p.sum.cover, live: p.sum.live };
  if (more) { o.ci = p.sum.ci; o.lapsed = p.sum.lapsed; o.due = p.sum.due; o.unconf = p.sum.unconf; }
  return { sum: o };
}

/** Who may name an agent on a client: the branch (the branch code, or a branch manager signed in) and, since 5 October
 *  2026, staff ("as the branch manager i and the staff has to be given the option of which agent to assign"). The
 *  manager chose that a staff member's naming does all the branch's does: the brief to the agent, and the introduction
 *  to a client who answered. A unit manager and an agent never name. */
function tCanAssign_(w) { return !!w && !!w.ok && (w.role === 'branch' || w.role === 'staff'); }

/* What staff see (5 October 2026: "I do need the staff to log in with the insights shared"). Client Support sees no money
   (29 September), so a client's policies reach them as each plan, where it stands, when it was issued, what it is paid to
   and whose life it insures, and the totals as counts and years; never a premium, a sum assured, cover, a beneficiary or
   an income. The insight lines are theirs, all but cover against income. */
var T_MONEY_INS = { income: true };
function tPolNoMoney_(pol) {
  if (!pol || !pol.sum) return null;
  var s = pol.sum;
  return { noMoney: true,
    sum: { live: s.live || 0, due: s.due || 0, lapsed: s.lapsed || 0, pending: s.pending || 0, ended: s.ended || 0, since: s.since || '', years: s.years || 0 },
    list: (pol.list || []).map(function (x) {
      return { no: x.no, code: x.code, name: x.name, st: x.st, desc: x.desc, od: x.od, iss: x.iss, paid: x.paid, insured: x.insured };
    }),
    ended: pol.ended || [] };
}
function tProfileNoMoney_(p) {
  if (!p) return null;
  var o = {};
  ['age', 'gender', 'dob', 'bday', 'bdayIn', 'occ', 'emp', 'role', 'pay'].forEach(function (k) { if (p[k] !== undefined && p[k] !== '') o[k] = p[k]; });
  return Object.keys(o).length ? o : null;
}

/** GET action=book&code=<branch>&token=…: one client's policies, for a row on the board that carries only the totals
 *  (a client who has not answered, or the family of one who has). The branch code only: an agent's own clients come
 *  with their policies on the board itself. */
function transitionBook_(p) {
  p = p || {};
  var w = tWho_(p.code, p.who);
  if (!w.ok) return { ok: false, refused: true, error: w.error };
  if (w.role !== 'branch') return { ok: false, refused: true, error: 'Only the branch code opens the policies of a client who is not on your list.' };
  var tok = String(p.token || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64), row = tok ? tRowByToken_(tok) : null;
  if (!row || tYes_(row.Test)) return { ok: false, error: 'That client is not on the send list.' };
  var b = tBook_(), pol = tBookFor_(row['Client number'], true), prof = tProfileFor_(row['Client number']);
  return { ok: true, token: tok, pol: pol, profile: prof, ins: tInsightsFor_(pol, prof, b.today), bookAt: b.built ? b.built.when : '' };
}

/** What a policy pays, in words: the beneficiaries' names, or what the record says instead. */
function tBenWords_(x) {
  if (!x.ben || !x.ben.length) return '';
  if (x.benK === 'named') return x.ben.join(', ');
  return { estate: 'the estate', provisions: 'see the special provisions', role: x.ben[0].replace(/\s*-\s*(male|female)$/i, '') }[x.benK] || x.ben.join(', ');
}
/** A policy's cover in words: "life $1,000,000 · CI $500,000", or the sum assured the plan list does not count. */
function tCoverWords_(x) {
  var parts = [];
  if (x.life) parts.push('life $' + tMoney_(x.life) + (x.counted || !tBookLive_(x.st) ? '' : ' (not counted)'));
  if (x.ci) parts.push('CI $' + tMoney_(x.ci));
  if (x.acc) parts.push('accident $' + tMoney_(x.acc));
  if (!parts.length && x.sa) parts.push('$' + tMoney_(x.sa) + ' (not counted)');
  return parts.join(' · ');
}
/** The policies in the agent's brief: who the client is, what to raise first, the totals, then one line a policy.
 *  Internal mail, the agent's own clients. */
function tBookMailHtml_(pol, prof, ins) {
  if (!pol || !pol.sum) return '';
  var s = pol.sum, esc = tEsc_, head = [], td = 'padding:3px 10px 3px 0;vertical-align:top', who = [];
  if (prof) {
    if (prof.age) who.push(prof.age + (prof.gender ? ', ' + prof.gender : ''));
    else if (prof.gender) who.push(prof.gender);
    if (prof.occ) who.push(prof.occ);
    if (prof.emp) who.push(prof.emp);
    if (prof.income) who.push('income $' + tMoney_(prof.income) + ' a year on file');
    if (prof.bday) who.push('birthday ' + prof.bday);
  }
  if (s.prem) head.push('≈ $' + tMoney_(s.prem) + ' a year');
  head.push(s.cover ? '$' + tMoney_(s.cover) + ' life cover' : (s.unconf ? 'life cover: plans still to confirm' : 'no life cover on file'));
  if (s.ci) head.push('$' + tMoney_(s.ci) + ' critical illness');
  if (s.since) head.push('with us since ' + s.since.slice(0, 4));
  var rows = (pol.list || []).map(function (x) {
    var ben = tBenWords_(x);
    return '<tr><td style="' + td + '"><b>' + esc(x.name || x.code || 'a policy') + '</b><br><span style="color:#64798e;font-size:12px">' + esc(x.no) +
      (x.cls ? ' · ' + esc(x.cls) + (x.conf ? '' : ', to confirm') : '') + (x.insured ? ' · insures ' + esc(x.insured) : '') + '</span></td>' +
      '<td style="' + td + '">' + esc(T_STANDING[x.st] || x.st) + (x.od ? ', ' + x.od + ' days' : '') + '</td>' +
      '<td style="' + td + ';white-space:nowrap">' + (x.prem ? '$' + tMoney_(x.prem, 2) + ' ' + esc(x.pays || '') : '') + '</td>' +
      '<td style="' + td + '">' + esc(tCoverWords_(x)) + (ben ? '<br><span style="color:#64798e;font-size:12px">pays ' + esc(ben) + '</span>' : '') + '</td>' +
      '<td style="padding:3px 0;vertical-align:top;white-space:nowrap">' + (x.paid ? 'paid to ' + esc(tDmy_(x.paid)) : '') + '</td></tr>';
  }).join('');
  return (who.length ? '<p style="margin:8px 0 2px"><b>Who they are</b> <span style="color:#64798e">' + esc(who.join(' · ')) + '</span></p>' : '') +
    (ins && ins.length ? '<p style="margin:8px 0 2px"><b>Raise first</b></p><ul style="margin:0;padding-left:18px">' +
      ins.map(function (i) { return '<li' + (i.lv === 'hot' ? ' style="color:#8a3324"' : '') + '>' + esc(i.t) + '</li>'; }).join('') + '</ul>' : '') +
    '<p style="margin:8px 0 2px"><b>Their policies with us</b> <span style="color:#64798e">' + esc(head.join(' · ')) + '</span></p>' +
    (rows ? '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">' + rows + '</table>' : '');
}

/* ── the client's profile, and what the board reads from it ── */
/* 29 September 2026: "we should have more data to the cards … the occupation and incomes etc as well any other data like
   beneficiary etc to make some insights". Salesforce's CLIENT_PORTFOLIO__c carries, per policy: the date of birth, the
   occupation and income where the application recorded them, up to three beneficiaries ("Benificiary" there), the
   insured and the owner, and the cover split into life, critical illness, accident and waiver; its Contact carries the
   gender. The Client Profile tab holds those fields, one row a policy. It is imported once (built in the session
   scratchpad through the Salesforce connector) and, when this project has the SF_* Script properties ServiceSalesforce.gs
   uses, refreshed by the morning build straight from Salesforce, by policy number (clients opened since mid-2026 carry no
   client number there). Measured on 29 September 2026 over the campaign's live policies: a date of birth on 98 in 100, a
   gender on 93, a beneficiary on every one but a name on barely 1 in 100 (half say "(See Special Provisions)", a third
   "Proposer" or "Annuitant", one in eight the estate), a life figure on 74, critical illness on 38; an occupation on
   about 1 client in 10 and an income on 1 in 13. The board shows what is there and says nothing about what is not.
   The same evening ("where is the occupation?"): the policy record's Occupation is filled for 7 clients in 100, but the
   Contact's Title, which the branch has always typed the job into ("TEACHER", "POLICE OFFICER", "CLERK"), is filled
   for 6 in 10 once the courtesy titles are taken out, so the Occupation column falls back to it (tJobTitle_). */
var T_PROFILE = { SHEET: 'Client Profile', CHUNK: 200, BUDGET_MS: 150000 };
var T_PROFILE_HEAD = ['Policy', 'Client number', 'Client', 'Date of birth', 'Gender', 'Smoker', 'Occupation', 'Employer', 'Annual income',
  'Life cover', 'Critical illness cover', 'Accident cover', 'Waiver cover', 'Life cover ends', 'Beneficiary 1', 'Beneficiary 2', 'Beneficiary 3',
  'Insured', 'Owner', 'Family role', 'From'];
/* what Contact.Employer__c holds is mostly a household's or an agent's name ("RAMROACH, KERWYN HH"): only a value that reads
   as an employer or a status is shown */
var T_EMPLOYER = /\b(ltd|limited|company|co\.|corp|corporation|inc|ministry|bank|services|authority|school|hospital|petroleum|board|government|govt|police|defence|regiment|council|university|college|enterprises?|group|agency|association|trust|church|fire service|prison|customs|wasa|tstt|t&tec|ngc|petrotrin|self[- ]employed|retired|pensioner|housewife|homemaker|student|unemployed)\b/i;
var T_PROFILE_MEMO = null;

function tNumOrNull_(x) { return x === '' || x === null || x === undefined ? null : tNum_(x); }
/** An occupation or an employer as the board prints it: typed in capitals or in lower case, it is set in title case with the
 *  small words kept small and the island's own acronyms kept whole (T&TEC, WASA, NGC, TSTT); typed in mixed case, as typed. */
var T_ACRONYMS = /^(t&tec|ttec|wasa|ngc|tstt|bp|bptt|nlcb|ttps|ttdf|nib|hdc|tcl|rbl|fcb|jmmb|nidco|udecott|plipdeco|erha|nwrha|swrha|crha|trha|tha|it|ceo|hr|ict|uwi|utt)$/i;
function tNiceLabel_(x) {
  var s = String(x == null ? '' : x).replace(/\s+/g, ' ').trim();
  if (!s || (s !== s.toUpperCase() && s !== s.toLowerCase())) return s;
  return s.toLowerCase().replace(/[^\s\/()-]+/g, function (w, i) {
    if (T_ACRONYMS.test(w)) return w.toUpperCase();
    if (i > 0 && /^(of|and|the|for|to|in|on|at|&)$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}
/** A Contact's Title as an occupation: '' for a courtesy title or a placeholder ("MR", "Mrs.", "UNKNOWN", "NOT ON LIST"). */
function tJobTitle_(x) {
  var s = String(x == null ? '' : x).replace(/\s+/g, ' ').trim();
  if (!s || /^(mr|mrs|ms|miss|mstr|master|dr|rev|sir|madam|hon)\.?$/i.test(s) || /^(unknown|not on list|not known|n\/?a|none|nil|other|-+|\.+|0)$/i.test(s)) return '';
  return s;
}
function tGender_(x) { var s = String(x || '').trim().toLowerCase(); return /^m(ale)?$/.test(s) ? 'male' : /^f(emale)?$/.test(s) ? 'female' : ''; }
function tTitleCase_(x) {
  var s = String(x || '').replace(/\s+/g, ' ').trim();
  return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }) : s;
}
/** Where a policy's benefit goes, read from the Beneficiary fields: 'named' (people), 'estate', 'provisions' (see the special
 *  provisions: the name is in the contract, not on our file), 'role' (Proposer, Annuitant: a role, not a person), or ''. */
function tBenKind_(list) {
  var s = (list || []).join(' ').toLowerCase();
  if (!s) return '';
  if (/estate|legal personal|\blpr\b/.test(s)) return 'estate';
  if (/special provision/.test(s)) return 'provisions';
  if (/proposer|annuitant|insured|owner|policy ?holder|trustee/.test(s)) return 'role';
  return 'named';
}

/** The Client Profile tab as { ready, by: { policy: {…} } }. */
function tProfiles_() {
  if (T_PROFILE_MEMO) return T_PROFILE_MEMO;
  var by = {}, n = 0, tz = tTz_();
  try {
    var t = tSheetRows_(T_PROFILE.SHEET), ix = {};
    t.head.forEach(function (h, i) { ix[String(h).trim().toLowerCase()] = i; });
    if (ix.policy !== undefined) t.rows.forEach(function (v) {
      var no = tPolNo_(v[ix.policy]);
      if (!no) return;
      var g = function (k) { return ix[k] !== undefined ? v[ix[k]] : ''; };
      var txt = function (k) { return String(g(k) == null ? '' : g(k)).replace(/\s+/g, ' ').trim(); };
      var emp = txt('employer');
      by[no] = { dob: tYmd_(g('date of birth'), tz), gender: tGender_(g('gender')), smoker: /^y/i.test(txt('smoker')) ? 'smoker' : '',
        occ: tNiceLabel_(txt('occupation')), emp: T_EMPLOYER.test(emp) && !/\bHH\b/.test(emp) ? tNiceLabel_(emp) : '', income: tNum_(g('annual income')),
        life: tNumOrNull_(g('life cover')), ci: tNumOrNull_(g('critical illness cover')), acc: tNumOrNull_(g('accident cover')), wp: tNumOrNull_(g('waiver cover')),
        ends: tYmd_(g('life cover ends'), tz), ben: [txt('beneficiary 1'), txt('beneficiary 2'), txt('beneficiary 3')].filter(Boolean),
        insured: txt('insured'), owner: txt('owner'), role: tTitleCase_(txt('family role')) };
      n++;
    });
  } catch (e) {}
  return (T_PROFILE_MEMO = { ready: n > 0, by: by });
}

/** One client's profile, from the profile rows of their own policies: the date of birth and the age, the gender, the
 *  occupation, an employer that reads as one, the income, a family role; and, from the Client Book, `pay` when a live
 *  premium comes through an employer ("salary deduction") or military pay, which says they are employed and by whom
 *  paid even where Salesforce has no occupation. null when nothing is known. */
/** Whether a policy's insured, by name, is someone other than the client who owns it: not the same first name with a
 *  surname in common (tSamePerson_'s test). A blank or one-word name is never someone else. */
function tOtherLife_(insured, client) {
  var a = tText_(insured), b = tText_(client);
  if (!a || !b || a.split(/\s+/).length < 2 || b.split(/\s+/).length < 2) return false;
  if (tSamePerson_({ Client: a }, { Client: b })) return false;
  /* the owner under a looser spelling ("Ramkhelawan", "Ramkilawan"): the same first name and surnames that begin alike */
  var w = function (s) { return s.toLowerCase().replace(/[^a-z\- ]/g, '').split(/[\s-]+/).filter(Boolean); };
  var x = w(a), y = w(b);
  return !(x[0] === y[0] && x[0].length >= 3 && x.slice(1).some(function (p) { return p.length >= 4 && y.slice(1).some(function (q) { return q.slice(0, 4) === p.slice(0, 4); }); }));
}
function tProfileFor_(cno) {
  var P = tProfiles_(), b = tBook_(), all = b.by[tCno_(cno)] || [], recs = P.ready ? all : [];
  var o = { dob: '', gender: '', smoker: '', occ: '', emp: '', income: 0, role: '' }, any = false;
  /* who a person is comes from the policies on their own life: a policy the client took out on a child's life carries the
     child's date of birth and gender (the board read one mother as 5). A policy whose insured is someone
     else by name is left out, unless no policy is on the client's own life, when every one is read as before. */
  var own = recs.filter(function (r) { var p = P.by[r.no]; return p && !tOtherLife_(p.insured, r.client); });
  (own.length ? own : recs).forEach(function (r) {
    var p = P.by[r.no];
    if (!p) return;
    any = true;
    ['dob', 'gender', 'smoker', 'occ', 'emp', 'role'].forEach(function (k) { if (!o[k] && p[k]) o[k] = p[k]; });
    if (p.income > o.income) o.income = p.income;
  });
  all.forEach(function (r) {
    if (o.pay || (r.st !== 'inforce' && r.st !== 'overdue')) return;
    if (/military/i.test(r.bill)) o.pay = 'military pay';
    else if (/salary|payroll/i.test(r.bill)) o.pay = 'salary deduction';
  });
  if (!any && !o.pay) return null;
  if (o.dob) {
    var d = o.dob.split('-'), t = b.today.split('-');
    o.age = Number(t[0]) - Number(d[0]) - ((t[1] + t[2]) < (d[1] + d[2]) ? 1 : 0);
    o.bday = Number(d[2]) + ' ' + T_MON[Number(d[1]) - 1];
    var next = new Date(Date.UTC(Number(t[0]), Number(d[1]) - 1, Number(d[2]))), now = new Date(Date.UTC(Number(t[0]), Number(t[1]) - 1, Number(t[2])));
    if (next < now) next = new Date(Date.UTC(Number(t[0]) + 1, Number(d[1]) - 1, Number(d[2])));
    o.bdayIn = Math.round((next - now) / 86400000);
  }
  return o;
}

/** When a policy's life cover ends: Salesforce's date where it has one, else the plan's own name ("to 65" from the date of
 *  birth, "20 years" from the issue date); '' when neither says. */
function tCoverEnds_(x, dob) {
  if (x.ends) return x.ends;
  var name = String(x.name || ''), m;
  if (dob && (m = /\bto (?:age )?(\d{2,3})\b/i.exec(name))) return (Number(dob.slice(0, 4)) + Number(m[1])) + dob.slice(4);
  if (x.iss && (m = /\b(\d{1,2}) ?(?:years|yr)\b/i.exec(name))) return (Number(x.iss.slice(0, 4)) + Number(m[1])) + x.iss.slice(4);
  return '';
}

/** What a card should say before anything else: a premium due, cover that ends soon, who the policy pays, no life cover,
 *  a lapsed policy, cover against income, a birthday coming. Each { k, t, lv }: lv 'hot', 'warm' or 'info'. Only what the
 *  records show; never advice. */
function tInsightsFor_(pol, prof, today) {
  var out = [];
  if (!pol || !pol.sum) return out;
  var s = pol.sum, list = pol.list || [], dob = prof && prof.dob;
  var add = function (k, t, lv) { out.push({ k: k, t: t, lv: lv }); };
  var due = list.filter(function (x) { return x.st === 'overdue'; }).sort(function (a, b) { return b.od - a.od; })[0];
  /* a paid-to date more than a year gone on a policy the portfolio still calls premium paying is a record to check,
     not "premium due 2954 days" (50 of the 371 overdue policies in the families on 29 September) */
  if (due && due.od > 365) add('due', 'Paid to ' + tDmy_(due.paid).replace(/^\d+ /, '') + ' on ' + (due.name || due.code) + ', still shown as premium paying: check the record', 'warm');
  else if (due && due.od >= 30) add('due', 'Premium due ' + due.od + ' days on ' + (due.name || due.code), due.od >= 60 ? 'hot' : 'warm');
  var soon = null;
  list.forEach(function (x) {
    if (!tBookLive_(x.st) || !x.life) return;
    var end = tCoverEnds_(x, dob);
    if (!end || end <= today) return;
    var days = tDaysBetween_(today, end);
    if (days <= 5 * 365 && (!soon || days < soon.days)) soon = { days: days, end: end, x: x };
  });
  if (soon) add('ends', 'Life cover ends ' + tDmy_(soon.end).replace(/^\d+ /, '') + (dob ? ', at ' + (Number(soon.end.slice(0, 4)) - Number(dob.slice(0, 4))) : '') + ' (' + (soon.x.name || soon.x.code) + ')', soon.days <= 2 * 365 ? 'hot' : 'warm');
  var live = list.filter(function (x) { return tBookLive_(x.st); }), kinds = {};
  live.forEach(function (x) { var k = x.benK || ''; kinds[k] = (kinds[k] || 0) + 1; });
  if (kinds.estate) add('estate', 'Pays the estate on ' + tN_(kinds.estate, 'policy', 'policies') + ': no beneficiary named on our file', 'warm');
  if (kinds.provisions) add('provisions', 'Beneficiary in the special provisions on ' + tN_(kinds.provisions, 'policy', 'policies') + ': the name is in the contract, not on our file', 'info');
  if (kinds.role) add('role', 'Beneficiary recorded only as a role ("Proposer", "Annuitant") on ' + tN_(kinds.role, 'policy', 'policies'), 'info');
  if (live.length && !s.cover && !s.unconf) add('nolife', 'No life cover in force' + (s.ci ? ': critical illness only' : ''), 'warm');
  var lapsed = list.filter(function (x) { return x.st === 'lapsed'; });
  if (lapsed.length) add('lapsed', tN_(lapsed.length, 'lapsed policy', 'lapsed policies') + ': ' + lapsed.slice(0, 2).map(function (x) { return (x.name || x.code) + (x.paid ? ' (paid to ' + tDmy_(x.paid).replace(/^\d+ /, '') + ')' : ''); }).join(', '), 'info');
  if (prof && prof.income > 0 && s.cover) {
    var mult = s.cover / prof.income;
    add('income', 'Life cover is ' + (mult >= 10 ? Math.round(mult) : Math.round(mult * 10) / 10) + '× the income on file ($' + tMoney_(prof.income) + ' a year)', mult < 5 ? 'warm' : 'info');
  }
  if (prof && prof.bday && prof.bdayIn <= 30) add('birthday', 'Birthday ' + prof.bday + (prof.bdayIn === 0 ? ', today' : ', in ' + tN_(prof.bdayIn, 'day', 'days')) + ' (turns ' + (prof.age + (prof.bdayIn === 0 ? 0 : 1)) + ')', 'info');
  /* 29 September, evening ("where is the occupation and other insights given the data you have?"): what the book says
     beyond the cover. A premium taken from the pay packet stops the day the job does; a waiver means the benefit is paying
     the premium; a surrender before is the client's own history; and an adult with life cover and no critical illness
     cover on a policy Salesforce has split. Facts off the record, for the licensed agent to raise; never advice. */
  var payroll = live.filter(function (x) { return (x.st === 'inforce' || x.st === 'overdue') && /salary|payroll|military/i.test(x.bill || ''); });
  if (payroll.length) {
    var mil = payroll.some(function (x) { return /military/i.test(x.bill); });
    add('payroll', (mil ? 'Paid from military pay' : 'Paid by salary deduction') + ' on ' + tN_(payroll.length, 'policy', 'policies') + ': ' +
      (mil ? 'leaving the service' : 'a change of job') + ' stops the deduction', 'info');
  }
  var waived = list.filter(function (x) { return x.st === 'waived'; });
  if (waived.length) add('waived', 'Premium waived on ' + tN_(waived.length, 'policy', 'policies') + ': the waiver benefit pays it', 'info');
  var surr = (pol.ended || []).filter(function (e) { return /surrender/i.test(e.what); }).reduce(function (t, e) { return t + e.n; }, 0);
  if (surr) add('surr', 'Surrendered ' + tN_(surr, 'policy', 'policies') + ' with us before', 'info');
  if (prof && prof.age >= 18 && prof.age < 65 && s.cover && !s.ci && live.every(function (x) { return x.src === 'sf' && x.cls !== 'critical illness'; }))
    add('noci', 'Life cover, and no critical illness cover on file', 'info');
  var rank = { hot: 0, warm: 1, info: 2 };
  return out.sort(function (a, b) { return rank[a.lv] - rank[b.lv]; });
}

/* ── refreshing the profile from Salesforce, in the morning build ── */
var T_SF_FIELDS = ['POLICY__c', 'FIRST_NAME__c', 'LAST_NAME__c', 'Date_Of_Birth__c', 'Occupation__c', 'ANNUAL_INCOME__c', 'Monthly_Income__c',
  'Benificiary_1__c', 'Benificiary_2__c', 'Benificiary_3__c', 'INSURED__c', 'POLICY_OWNER__c', 'Family_Role__c', 'Life_Coverage__c',
  'Critical_Illness_Coverage__c', 'ADDAP_Coverage__c', 'WP_Coverage__c', 'Life_Coverage_Expiry__c', 'Contact__r.Gender__c', 'Contact__r.Smoker__c',
  'Contact__r.Employer__c', 'Contact__r.Total_Income__c', 'Contact__r.Birthdate', 'Contact__r.Title'];
/** One Client Profile row from one CLIENT_PORTFOLIO__c record. The occupation is the policy's own, else the Contact's Title
 *  when it is a job and not a courtesy title. */
function tProfileRow_(rec, cno, client) {
  var c = rec.Contact__r || {}, v = function (x) { return x === null || x === undefined ? '' : x; };
  var income = rec.ANNUAL_INCOME__c || (rec.Monthly_Income__c ? rec.Monthly_Income__c * 12 : 0) || c.Total_Income__c || '';
  return [String(rec.POLICY__c || ''), cno || '', client || [rec.FIRST_NAME__c, rec.LAST_NAME__c].filter(Boolean).join(' '), v(rec.Date_Of_Birth__c || c.Birthdate),
    v(c.Gender__c), v(c.Smoker__c), v(rec.Occupation__c) || tJobTitle_(c.Title), v(c.Employer__c), income, v(rec.Life_Coverage__c), v(rec.Critical_Illness_Coverage__c),
    v(rec.ADDAP_Coverage__c), v(rec.WP_Coverage__c), v(rec.Life_Coverage_Expiry__c), v(rec.Benificiary_1__c), v(rec.Benificiary_2__c), v(rec.Benificiary_3__c),
    /* the life insured: INSURED__c is filled on a few policies in a hundred, but the policy record's own name and date of
       birth are always the insured's — the owner's on most, a child's or a spouse's on a policy the owner took out on
       someone else's life (29 September 2026: one mother on these books owns two on her daughters' lives) */
    v(rec.INSURED__c) || [rec.FIRST_NAME__c, rec.LAST_NAME__c].filter(Boolean).join(' '), v(rec.POLICY_OWNER__c), v(rec.Family_Role__c), 'Salesforce'];
}
/** Rewrites the Client Profile tab from Salesforce for these policies, when ServiceSalesforce.gs and its four SF_* Script
 *  properties are there; otherwise leaves the imported tab as it is. Never throws; { rows } or { skipped } or { error }. */
function tProfileRefresh_(recs, deadline) {
  if (typeof svcSfReady_ !== 'function' || typeof svcSfQuery_ !== 'function' || !svcSfReady_()) return { skipped: 'Salesforce is not set up in this project (SF_KEY, SF_SECRET, SF_LOGIN_URL)' };
  try {
    var who = {}, pols = [];
    recs.forEach(function (r) { if (/^\d{6,12}$/.test(r.no) && !who[r.no]) { who[r.no] = r; pols.push(r.no); } });
    var rows = [T_PROFILE_HEAD], seen = {};
    for (var i = 0; i < pols.length; i += T_PROFILE.CHUNK) {
      if (deadline && Date.now() > deadline) return { error: 'stopped at ' + i + ' of ' + pols.length + ' policies: the build ran out of time; the tab was left as it was' };
      var part = pols.slice(i, i + T_PROFILE.CHUNK);
      svcSfQuery_('SELECT ' + T_SF_FIELDS.join(', ') + ' FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN (' +
        part.map(function (p) { return "'" + svcSoqlLit_(p) + "'"; }).join(',') + ')').forEach(function (rec) {
        var no = String(rec.POLICY__c || ''), r = who[no];
        if (!r || seen[no]) return;
        seen[no] = true;
        rows.push(tProfileRow_(rec, r.cno, r.client));
      });
    }
    var ss = ss_(), sh = ss.getSheetByName(T_PROFILE.SHEET) || ss.insertSheet(T_PROFILE.SHEET), w = T_PROFILE_HEAD.length;
    if (sh.getMaxRows() < rows.length) sh.insertRowsAfter(sh.getMaxRows(), rows.length - sh.getMaxRows());
    if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
    sh.getRange(1, 1, rows.length, 2).setNumberFormat('@');
    sh.getRange(1, 1, rows.length, w).setValues(rows);
    var last = sh.getLastRow();
    if (last > rows.length) sh.getRange(rows.length + 1, 1, last - rows.length, Math.max(w, sh.getLastColumn())).clearContent();
    try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, w).setFontWeight('bold').setBackground(SB.light); } catch (e) {}
    T_PROFILE_MEMO = null;
    return { rows: rows.length - 1, of: pols.length };
  } catch (e) { return { error: String(e && e.message ? e.message : e).slice(0, 200) }; }
}

/* ── who looks after which household: the wall's assignment slides ─────── */
/* 1 October 2026. The manager began naming agents in Salesforce, on the policy record (CLIENT_PORTFOLIO__c: Assigned
   Agent, Date Assigned to Agent, Campaign "Orphan"), and asked for it on the wall, by household, for the branch meeting
   ("i want this built as some 3 slides on the transition wall, would like to assign the households").
   The Household Assignments tab is the map: one row a client of the books, with the household (the 29 September build:
   the same address, phone or e-mail; a key more than six clients share is an office, not a family), the client's
   policy numbers, the agent and the day they were named, and a suggested agent for the household. It is built in the
   session scratchpad and imported once. tHaSync_ keeps the agent columns current, inside the five-minute receipts run,
   at most every EVERY_MIN minutes: from Salesforce when this project has the SF_* properties (every assignment dated
   since SINCE, matched by policy number, else client number, else a name only one row carries), and from the board's
   Assigned to. A row whose Source is anything else (a name typed in by hand) is never overwritten. The wall reads the
   tab through tHaWall_, inside tSummary_, and prints first names only. */
var T_HA = { SHEET: 'Household Assignments', SINCE: '2026-09-09', EVERY_MIN: 15, PROP: 'ha_synced', NEXT: 8, DAYS: 14 };
var T_HA_HEAD = ['Household', 'Household name', 'Members', 'Token', 'Client', 'Client number', 'Letter', 'Book', 'Policies',
  'Agent assigned', 'Date assigned', 'Source', 'Feedback', 'Suggested agent', 'Why suggested'];
/* what a household that is waiting said, at its most pressing (T_PRIORITY's codes), in the wall's words */
var T_HA_SAID = { urgent: 'wants an agent now', contact_yes: 'the former agent has been in touch', approached_yes: 'someone has approached them',
  review_approached: 'someone has approached them', paid: 'paid, and it is not showing', pay_person: 'pays a representative in person',
  pay: 'pays a representative in person', pay_unsure: 'not sure how the premium is paid', contract_missing: 'the contract never reached them',
  deliver: 'the contract never reached them', review: 'filed a review', contract_unsure: 'not sure of the contract',
  k_outstanding: 'wants help to finish the application', finish: 'wants help to finish the application', k_stop: 'no longer wishes to proceed',
  stop: 'no longer wishes to proceed', k_unsure: 'not sure what the application needs', claim: 'a maturity claim', callme: 'asked for a call',
  stay_talk: 'wants to talk it through first', rate_better: 'said we could be better', life_changed: 'life has changed',
  question: 'wrote to us', wrote: 'wrote to us', assign: 'asked for an agent', pays_confirm: 'wants to know what the policy pays',
  walk_yes: 'wants the policy walked through', built_yes: 'wants to know what the policy has built', more_yes: 'wants to know what more it could do',
  value_yes: 'wants to know what the policy still holds' };

/** A date cell, a yyyy-MM-dd string or a Date, as a Date at midnight; null for anything else. */
function tHaDate_(x) {
  var d = tDay_(x);
  if (!d) return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** The Household Assignments tab, or null when it is not there or has no Household, Token and Agent assigned columns. */
function tHaRead_() {
  var sh = ss_().getSheetByName(T_HA.SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  var vals, ix = {};
  if (T_READ_ONCE) { var once = tSheetRows_(T_HA.SHEET); vals = [once.head].concat(once.rows); }   // a board request: the read the households made
  else vals = sh.getRange(1, 1, sh.getLastRow(), Math.max(1, sh.getLastColumn())).getValues();
  vals[0].forEach(function (h, i) { ix[String(h).trim().toLowerCase()] = i; });
  if (ix.household === undefined || ix.token === undefined || ix['agent assigned'] === undefined) return null;
  var g = function (v, k) { return ix[k] !== undefined ? v[ix[k]] : ''; };
  var rows = [];
  for (var i = 1; i < vals.length; i++) {
    var v = vals[i], tok = String(g(v, 'token') || '').trim(), hh = String(g(v, 'household') || '').trim();
    if (!tok && !hh) continue;
    rows.push({ rn: i + 1, hh: hh || 'S' + tok, hhName: String(g(v, 'household name') || '').trim(), token: tok,
      client: String(g(v, 'client') || '').trim(), cno: tCno_(g(v, 'client number')),
      pols: String(g(v, 'policies') || '').split(/[\s,;]+/).map(function (p) { return p.trim(); }).filter(Boolean),
      agent: String(g(v, 'agent assigned') || '').trim(), date: g(v, 'date assigned'), source: String(g(v, 'source') || '').trim(),
      fb: String(g(v, 'feedback') || '').trim(), sug: String(g(v, 'suggested agent') || '').trim(), why: String(g(v, 'why suggested') || '').trim() });
  }
  return { sh: sh, ix: ix, rows: rows, last: vals.length };
}

/** The editor's Run button: brings the tab up to date now, whatever the clock says. */
function transitionSyncAssignments() {
  var r = tHaSync_(true);
  return tSay_(r.skipped ? 'Nothing synced: ' + r.skipped + '.' : 'Household Assignments: ' + r.changed + ' row' + (r.changed === 1 ? '' : 's') +
    ' changed; ' + r.named + ' clients named, read from ' + r.via + '.');
}

/** Brings the agent columns of the Household Assignments tab up to date from Salesforce and the board. Inside the
 *  five-minute receipts run, which holds the script lock; at most every EVERY_MIN minutes unless forced.
 *  Never writes when the tab was sorted while it read (the tokens are checked again first). */
function tHaSync_(force) {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty(T_HA.PROP) || 0);
  if (!force && Date.now() - last < T_HA.EVERY_MIN * 60000) return { skipped: 'synced in the last ' + T_HA.EVERY_MIN + ' minutes' };
  var ha = tHaRead_();
  if (!ha) return { skipped: 'there is no ' + T_HA.SHEET + ' tab yet (import it from the scratchpad build)' };
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); };
  var want = {}, sf = null, via;
  if (typeof svcSfReady_ === 'function' && typeof svcSfQuery_ === 'function' && svcSfReady_()) {
    try {
      sf = svcSfQuery_('SELECT POLICY__c, Client_Number__c, FIRST_NAME__c, LAST_NAME__c, Assigned_Agent__r.Name, Date_Assigned_to_Agent__c, ' +
        'Campain_Feedback_Update__c FROM CLIENT_PORTFOLIO__c WHERE Date_Assigned_to_Agent__c >= ' + T_HA.SINCE +
        ' AND Assigned_Agent__c != null ORDER BY Date_Assigned_to_Agent__c LIMIT 5000');
      via = 'Salesforce';
    } catch (e) { via = 'the board only (Salesforce did not answer: ' + String(e && e.message ? e.message : e).slice(0, 100) + ')'; }
  } else via = 'the board only (Salesforce is not linked to this project)';
  if (sf) {
    var byPol = {}, byCno = {}, byName = {};
    ha.rows.forEach(function (r) {
      r.pols.forEach(function (p) { (byPol[p] = byPol[p] || []).push(r); });
      if (r.cno) (byCno[r.cno] = byCno[r.cno] || []).push(r);
      var k = norm(r.client); if (k) (byName[k] = byName[k] || []).push(r);
    });
    sf.forEach(function (rec) {
      var agent = rec.Assigned_Agent__r && rec.Assigned_Agent__r.Name ? String(rec.Assigned_Agent__r.Name).trim() : '';
      var day = tDay_(rec.Date_Assigned_to_Agent__c);
      if (!agent || !day) return;
      var hit = byPol[tPolNo_(rec.POLICY__c)] || byCno[tCno_(rec.Client_Number__c)];
      if (!hit) { var nm = byName[norm(String(rec.FIRST_NAME__c || '') + String(rec.LAST_NAME__c || ''))]; if (nm && nm.length === 1) hit = nm; }
      (hit || []).forEach(function (r) {
        var w = want[r.rn];
        if (!w || day >= w.day) want[r.rn] = { agent: agent, day: day, fb: String(rec.Campain_Feedback_Update__c || '') || (w ? w.fb : ''), source: 'Salesforce' };
      });
    });
  }
  /* the board: the newest name in Assigned to on the client's rows of Client Responses */
  var byTok = {};
  ha.rows.forEach(function (r) { if (r.token) byTok[r.token] = r; });
  tSheetRows_(SVC.RESP_SHEET).rows.forEach(function (v) {
    var r = byTok[String(v[1] || '').trim()], agent = String(v[8] || '').trim();
    if (!r || !agent || (want[r.rn] && want[r.rn].source === 'Salesforce')) return;
    var day = tDay_(v[9]) || tDay_(v[0]) || '';
    if (!want[r.rn] || day >= want[r.rn].day) want[r.rn] = { agent: agent, day: day, fb: '', source: 'board' };
  });
  /* what changes: only rows the sync wrote itself, or rows nobody has named yet */
  var cols = { agent: ha.ix['agent assigned'], date: ha.ix['date assigned'], source: ha.ix.source, fb: ha.ix.feedback };
  var edits = [];
  ha.rows.forEach(function (r) {
    var mine = r.source === 'Salesforce' || r.source === 'board' || (!r.source && !r.agent);
    if (!mine) return;
    var w = want[r.rn];
    if (!w && r.source === 'Salesforce' && !sf) return;            // Salesforce did not answer this time: keep what it said last
    var next = w || { agent: '', day: '', fb: '', source: '' };
    if (next.agent === r.agent && next.source === r.source && next.day === (tDay_(r.date) || '') && (next.fb || '') === r.fb) return;
    edits.push({ rn: r.rn, token: r.token, w: next });
  });
  if (edits.length) {
    /* the tab may have been sorted since it was read: every edited row must still carry its token */
    var tokCol = ha.ix.token + 1, now = ha.sh.getRange(1, tokCol, ha.sh.getLastRow(), 1).getValues();
    var moved = edits.some(function (e) { return !now[e.rn - 1] || String(now[e.rn - 1][0] || '').trim() !== e.token; });
    if (moved) return { changed: 0, named: 0, via: via + ' (the tab moved while it was read: nothing written; the next run tries again)' };
    var vals = function (e) { return [[cols.agent, e.w.agent], [cols.date, e.w.day ? tHaDate_(e.w.day) : ''], [cols.source, e.w.source], [cols.fb, e.w.fb || '']]; };
    if (edits.length <= 25) {
      edits.forEach(function (e) { vals(e).forEach(function (p) { if (p[0] !== undefined) ha.sh.getRange(e.rn, p[0] + 1).setValue(p[1]); }); });
    } else {
      /* a board assigning households by the hundred: each column read fresh and written back whole, four calls, not a
         thousand, so the run never reaches Apps Script's six minutes */
      var n = now.length - 1, block = {};
      [cols.agent, cols.date, cols.source, cols.fb].forEach(function (c) { if (c !== undefined && n > 0) block[c] = ha.sh.getRange(2, c + 1, n, 1).getValues(); });
      edits.forEach(function (e) { vals(e).forEach(function (p) { if (block[p[0]] && block[p[0]][e.rn - 2]) block[p[0]][e.rn - 2][0] = p[1]; }); });
      Object.keys(block).forEach(function (c) { ha.sh.getRange(2, Number(c) + 1, n, 1).setValues(block[c]); });
    }
  }
  props.setProperty(T_HA.PROP, String(Date.now()));
  props.setProperty('ha_via', JSON.stringify({ at: new Date().toISOString(), via: via }));
  var named = 0;
  Object.keys(want).forEach(function () { named++; });
  if (edits.length) log_('transition', 'household-assignments', edits.length + ' rows changed, from ' + via);
  return { changed: edits.length, named: named, via: via };
}

/** tHaWall_, never able to stop the summary the wall, the dashboard and the responses page all read. */
function tHaWallSafe_(byTok, rows, tz, now) {
  try { return tHaWall_(byTok, rows, tz, now); }
  catch (e) { return { tab: false, error: String(e && e.message ? e.message : e).slice(0, 160) }; }
}
/** What the wall's three assignment slides show, from the Household Assignments tab, the answers on Client Responses
 *  and the board's names. byTok is the send list by token, resp the Client Responses rows (tSummary_ has read both).
 *  Names go to a page opened with the branch code, and the wall prints first names only. */
function tHaWall_(byTok, resp, tz, now) {
  var ha = tHaRead_();
  if (!ha) return { tab: false };
  var fmt = function (d) { return d ? Utilities.formatDate(d, tz, 'd MMM') : ''; };
  /* each client's most pressing answer, and the board's newest name. Answers a mail scanner ticked (the receipts run marks
     them "answers look automated", tLooksAutomated_) are not answers: three such clients would otherwise head the list. */
  var ans = {}, board = {}, auto = {};
  resp.forEach(function (v) {
    var tok = String(v[1] || '').trim();
    if (!tok || /^preview$/i.test(tok)) return;
    if (/look automated/i.test(String(v[10] || ''))) auto[tok] = true;
    var named = String(v[8] || '').trim();
    if (named) { var on = tHaDate_(v[9]) || (v[0] instanceof Date ? v[0] : null), b = board[tok]; if (!b || (on && (!b.on || on >= b.on))) board[tok] = { agent: named, on: on }; }
    if (tOursRow_(v[5])) return;                                  // a detail taken on a call, an agent named from the board: not an answer
    var type = String(v[3] || '').trim();
    if (!type) return;
    var m = /[?&]q=([^&#]+)/.exec(String(v[5] || '')), q = m ? m[1] : '';
    var pq = T_PRIORITY[q] || 0, pt = T_PRIORITY[type] || 0, pri = Math.max(pq, pt, 1);
    var a = ans[tok] = ans[tok] || { pri: 0, code: '', first: null };
    if (pri > a.pri) { a.pri = pri; a.code = pq >= pt && q ? q : type; }
    var when = v[0] instanceof Date ? v[0] : null;
    if (when && (!a.first || when < a.first)) a.first = when;
  });
  Object.keys(auto).forEach(function (tok) { delete ans[tok]; });
  /* households */
  var H = {}, order = [];
  ha.rows.forEach(function (r) {
    var s = byTok[r.token];
    if (s && tYes_(s.Test)) return;
    var b = board[r.token];
    var agent = r.agent || (b ? b.agent : ''), on = r.agent ? tHaDate_(r.date) : (b ? b.on : null);
    if (!H[r.hh]) { H[r.hh] = { id: r.hh, name: r.hhName || r.client, mem: [] }; order.push(r.hh); }
    H[r.hh].mem.push({ client: r.client, agent: agent, on: on, fb: r.agent ? r.fb : '', ans: ans[r.token] || null, sug: r.sug, why: r.why });
  });
  var out = { tab: true, hh: { total: 0, done: 0, part: 0, none: 0 }, answered: { hh: 0, named: 0, waiting: 0 }, clients: { total: 0, named: 0, fb: 0 },
    agents: [], days: [], finish: [], next: [] };
  var ag = {}, days = {}, finish = [], next = [];
  order.forEach(function (id) {
    var h = H[id], named = h.mem.filter(function (m) { return m.agent; }), answered = h.mem.filter(function (m) { return m.ans; });
    out.hh.total++;
    out.clients.total += h.mem.length;
    out.clients.named += named.length;
    if (named.length === h.mem.length) out.hh.done++; else if (named.length) out.hh.part++; else out.hh.none++;
    if (answered.length) { out.answered.hh++; if (named.length) out.answered.named++; else out.answered.waiting++; }
    named.forEach(function (m) {
      var a = ag[m.agent] = ag[m.agent] || { name: m.agent, hh: {}, clients: 0, fb: 0, first: null, last: null };
      a.hh[id] = 1; a.clients++;
      if (m.fb) { a.fb++; out.clients.fb++; }
      if (m.on) {
        if (!a.first || m.on < a.first) a.first = m.on;
        if (!a.last || m.on > a.last) a.last = m.on;
        var k = Utilities.formatDate(m.on, tz, 'yyyy-MM-dd'); days[k] = (days[k] || 0) + 1;
      }
    });
    if (named.length && named.length < h.mem.length) {
      /* a family half named: the rest go to the agent the family already has */
      var count = {}; named.forEach(function (m) { count[m.agent] = (count[m.agent] || 0) + 1; });
      var with_ = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
      var left = h.mem.filter(function (m) { return !m.agent; });
      finish.push({ name: h.name, size: h.mem.length, agent: with_, agents: Object.keys(count).length, named: named.map(function (m) { return m.client; }),
        left: left.map(function (m) { return m.client; }), answered: left.some(function (m) { return m.ans; }) });
    } else if (!named.length && answered.length) {
      var best = null, who = '', first = null, sug = '', why = '';
      answered.forEach(function (m) {
        if (!best || m.ans.pri > best.pri) { best = m.ans; who = m.client; }
        if (m.ans.first && (!first || m.ans.first < first)) first = m.ans.first;
      });
      h.mem.some(function (m) { if (m.sug) { sug = m.sug; why = m.why; return true; } return false; });
      next.push({ name: h.name, who: who, size: h.mem.length, pri: best.pri, said: T_HA_SAID[best.code] || 'answered the letter', first: first,
        since: fmt(first), urgent: best.pri >= T_PRIORITY.urgent, sug: sug, why: /^family/i.test(why) ? 'family' : why ? 'plan' : '' });
    }
  });
  out.agents = Object.keys(ag).map(function (k) {
    var a = ag[k];
    return { name: a.name, hh: Object.keys(a.hh).length, clients: a.clients, fb: a.fb, first: fmt(a.first), last: fmt(a.last) };
  }).sort(function (a, b) { return b.hh - a.hh || b.clients - a.clients || a.name.localeCompare(b.name); });
  /* the last DAYS days, oldest first, so the room sees the pace */
  for (var i = T_HA.DAYS - 1; i >= 0; i--) {
    var d = new Date(now.getTime() - i * 86400000), k = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    out.days.push({ day: Utilities.formatDate(d, tz, 'd MMM'), clients: days[k] || 0 });
  }
  out.finish = finish.sort(function (a, b) { return (b.answered ? 1 : 0) - (a.answered ? 1 : 0) || a.name.localeCompare(b.name); }).slice(0, T_HA.NEXT);
  out.next = next.sort(function (a, b) { return b.pri - a.pri || (a.first ? a.first.getTime() : Infinity) - (b.first ? b.first.getTime() : Infinity); })
    .slice(0, T_HA.NEXT).map(function (x) { delete x.first; return x; });
  var last = null;
  try { last = JSON.parse(PropertiesService.getScriptProperties().getProperty('ha_via') || 'null'); } catch (e) {}
  out.synced = last && last.at ? Utilities.formatDate(new Date(last.at), tz, 'd MMM HH:mm') : '';
  out.via = last && last.via ? last.via : 'the tab as imported';
  return out;
}

/* ── Salesforce writes, through ServiceSalesforce.gs's sign-in ──────────── */
/** Whether this project can reach Salesforce: ServiceSalesforce.gs is in it and its four SF_* Script properties are set. */
function tSfOn_() {
  return typeof svcSfReady_ === 'function' && typeof svcSfQuery_ === 'function' && typeof svcSfToken_ === 'function' && svcSfReady_();
}
/** Ids or policy numbers as a SOQL list, each quoted and escaped. */
function tSoqlIn_(list) { return list.map(function (x) { return "'" + svcSoqlLit_(x) + "'"; }).join(','); }
/** One write to Salesforce (method 'patch' or 'post', path under /services/data/<version>), signed in as ServiceSalesforce.gs
 *  signs in; a 401 signs in again once. Returns Salesforce's reply ({} for a 204); throws with Salesforce's own reason. */
function tSfSend_(method, path, payload) {
  var go = function (tok) {
    return UrlFetchApp.fetch(tok.instance_url + '/services/data/' + SVCSF.API + path, {
      method: method, contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok.access_token }, payload: JSON.stringify(payload || {}) });
  };
  var res = go(svcSfToken_());
  if (res.getResponseCode() === 401) { svcSfProps_().deleteProperty('SVC_SF_TOKEN'); res = go(svcSfToken_()); }
  var code = res.getResponseCode(), text = res.getContentText() || '';
  if (code >= 300) {
    var why = 'HTTP ' + code;
    try { var e = JSON.parse(text); e = e && e[0] ? e[0] : e; if (e && (e.message || e.errorCode)) why = (e.errorCode ? e.errorCode + ': ' : '') + (e.message || ''); } catch (x) {}
    throw new Error('Salesforce did not take it: ' + why.slice(0, 200));
  }
  try { return text ? JSON.parse(text) : {}; } catch (x) { return {}; }
}

/** A client's policy numbers, the live ones first and the largest premium first: the Client Book's, then the Household
 *  Assignments tab's (ha, when the caller has read it; read here when it is undefined). */
function tClientPols_(tok, cno, ha) {
  var out = [], add = function (p) { p = tPolNo_(p); if (p && out.indexOf(p) < 0) out.push(p); };
  try {
    var b = cno ? tBookFor_(cno, true) : null;
    if (b && b.list) b.list.slice().sort(function (x, y) { return ((tBookLive_(y.st) ? 1 : 0) - (tBookLive_(x.st) ? 1 : 0)) || ((y.yr || 0) - (x.yr || 0)); })
      .forEach(function (x) { add(x.no); });
  } catch (e) {}
  if (ha === undefined) { try { ha = tHaRead_(); } catch (e) { ha = null; } }
  if (ha && tok) ha.rows.forEach(function (r) { if (r.token === tok) r.pols.forEach(add); });
  return out;
}

/* ── the TT$200 retention claim ──────────────────────────────────────── */
/* 3 October 2026: "when a questionnaire is recieved the agent is compensated 200.00 as an email goes to retention email
   GlocConservationRetentionunit@myguardiangroup.com with the details and to track payments, the email have to be
   followed up until the payment date is updated on salesforce". The manager's rules, the same day: a service
   questionnaire received for a client on or after the day that client was named to an agent, whoever sent the link,
   earns that agent one claim, once per client; each claim is e-mailed to the Retention unit when it is found, copied to
   the manager and the agent; and every Monday one e-mail lists every claim still unpaid, oldest first, until Date Comm
   Paid is filled in Salesforce.
   Salesforce already keeps the branch's retention claims on the policy record (CLIENT_PORTFOLIO__c): Date Subm to
   Retention, Was Agent Paid (Yes or No) and Date Comm Paid, the commission run's date, the 4th of a month. On 3 October
   it held 250 since 2024, some marked paid with no date. A claim here writes the first two the same way on one of the
   client's policies (the questionnaire's, else the one the agent was named on in Salesforce, else the live one with the
   largest premium), never over an earlier claim's date; a payment date on or after the day the client was named is what
   closes it. A claim the branch has already entered by hand (a submission date on or after the naming) is recorded and
   never e-mailed a second time.
   Nothing goes until the manager's go (transitionClaimsStart, on the menu): until then a claim found is recorded on the
   Retention Payments tab, held, and it goes with the go. On the tab a person may type a Paid date (the claim is closed;
   Salesforce is not touched), or Void, Declined or Withdrawn in Status (never e-mailed or followed up again). */
var T_CLAIM = {
  TAB: 'Retention Payments',
  AMOUNT: 200, CUR: 'TT$',
  TO: 'GlocConservationRetentionunit@myguardiangroup.com',
  COPY: '',             // blank = SVC.AGENT_EMAIL, the manager: copied on every claim and every Monday list, and where a reply goes
  MONDAY_HOUR: 9,       // the Monday list goes in the first five-minute run at or after this hour, sheet time zone
  MIN_DAYS: 3,          // a claim joins the Monday list once it was sent this many days before
  PAID_EVERY_MIN: 120,  // how often the unpaid claims are read back from Salesforce
  SCAN_EVERY_MIN: 15,   // how often the questionnaires are matched again when no new one has come in
  MAX_PER_RUN: 10,      // the most claims one run e-mails
  WINDOW_DAYS: 120,     // a questionnaire older than this is never looked at
  LIVE: 'claims_live',  // the go: 'on' once transitionClaimsStart is pressed
};
var T_CLAIM_HEAD = ['Claim', 'Token', 'Client', 'Client number', 'Policy', 'Agent', 'Agent no.', 'Agent e-mail', 'Named on', 'Named via',
  'Questionnaire', 'Received', 'Amount', 'Submitted', 'Salesforce', 'Follow-ups', 'Last follow-up', 'Paid', 'Status', 'Note'];
var T_CLAIM_SHUT = /^(paid|void|declined|withdrawn|cancel)/i;   // closed: never e-mailed or followed up again
var T_CLAIM_RETRY = /^(not sent|held)/i;                       // tried again on the next scan
var T_CLAIM_FOOT = 'This e-mail carries client information for Guardian Life of the Caribbean’s own use: do not forward it outside the company.';

function tClaimsLive_() { try { return PropertiesService.getScriptProperties().getProperty(T_CLAIM.LIVE) === 'on'; } catch (e) { return false; } }

/** The menu's "start the TT$200 claims": the go. Every claim held for it goes in this run, up to MAX_PER_RUN, the rest in
 *  the next five-minute runs. */
function transitionClaimsStart() {
  PropertiesService.getScriptProperties().setProperty(T_CLAIM.LIVE, 'on');
  return tSay_('The TT$200 claims are on. ' + tClaimsLocked_(true));
}
function transitionClaimsStop() {
  PropertiesService.getScriptProperties().setProperty(T_CLAIM.LIVE, 'off');
  return tSay_('The TT$200 claims are off: a claim found is recorded on the ' + T_CLAIM.TAB + ' tab and held until you start them again. Nothing else changes.');
}
/** The menu's "check the TT$200 claims now": the scan and the payment check, whatever the clock says. */
function transitionClaimsNow() { return tSay_(tClaimsLocked_(true)); }
/** The menu's "send the Monday retention follow-up now": the list of unpaid claims, today, whatever the day. */
function transitionClaimsMondayNow() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return tSay_('Another run is busy. Try again in a minute.');
  try { return tSay_(tClaimsMonday_(true).what); } finally { lock.releaseLock(); }
}
function tClaimsLocked_(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'Another run is busy. Try again in a minute.';
  try { return tClaimsSay_(tClaimsRun_(force)); } finally { lock.releaseLock(); }
}
function tClaimsSay_(r) {
  return [r.found ? tN_(r.found, 'new claim', 'new claims') + ' found.' : 'No new claim.',
    r.sent ? tN_(r.sent, 'claim', 'claims') + ' e-mailed to the Retention unit.' : '',
    r.held ? tN_(r.held, 'claim is', 'claims are') + ' held: see Status on the ' + T_CLAIM.TAB + ' tab.' : '',
    r.paid ? tN_(r.paid, 'claim', 'claims') + ' marked paid.' : '', r.monday || '',
    r.errors && r.errors.length ? 'Problems: ' + r.errors.join('; ') : ''].filter(Boolean).join(' ');
}

/** Inside the five-minute receipts run, which holds the script lock: new claims found and e-mailed, the unpaid read back
 *  from Salesforce, and the Monday list. Never throws. */
function tClaimsRun_(force) {
  var out = { found: 0, sent: 0, held: 0, paid: 0, monday: '', errors: [] };
  var why = function (e) { return String(e && e.message ? e.message : e).slice(0, 200); };
  try { var a = tClaimsFind_(force); out.found = a.found; out.sent = a.sent; out.held = a.held; }
  catch (e) { out.errors.push('finding: ' + why(e)); log_('transition', 'claims-failed', why(e)); }
  try { out.paid = tClaimsPaid_(force).paid; }
  catch (e) { out.errors.push('payments: ' + why(e)); log_('transition', 'claims-paid-failed', why(e)); }
  try { out.monday = tClaimsMonday_(false).what; }
  catch (e) { out.errors.push('Monday list: ' + why(e)); log_('transition', 'claims-monday-failed', why(e)); }
  return out;
}

/** The Retention Payments tab, made the first time a claim is found. */
function tClaimTab_() {
  var ss = ss_(), sh = ss.getSheetByName(T_CLAIM.TAB);
  if (sh) return sh;
  sh = ss.insertSheet(T_CLAIM.TAB);
  sh.getRange(1, 1, 1, T_CLAIM_HEAD.length).setValues([T_CLAIM_HEAD]);
  try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, T_CLAIM_HEAD.length).setFontWeight('bold').setBackground(SB.light); } catch (e) {}
  return sh;
}

/** Every claim on the tab, read by its headers (a person may add columns): { sh, ix, rows }; no rows when there is no tab. */
function tClaimsRead_() {
  var sh = ss_().getSheetByName(T_CLAIM.TAB), out = { sh: sh, ix: {}, rows: [] };
  if (!sh || sh.getLastRow() < 2) return out;
  var vals = sh.getRange(1, 1, sh.getLastRow(), Math.max(1, sh.getLastColumn())).getValues();
  vals[0].forEach(function (h, i) { h = String(h).trim(); if (h && out.ix[h] === undefined) out.ix[h] = i; });
  var g = function (v, k) { return out.ix[k] !== undefined ? v[out.ix[k]] : ''; };
  for (var i = 1; i < vals.length; i++) {
    var v = vals[i], id = tText_(g(v, 'Claim'));
    if (!id) continue;
    out.rows.push({ rn: i + 1, id: id, token: tText_(g(v, 'Token')), client: tText_(g(v, 'Client')), cno: tText_(g(v, 'Client number')),
      policy: tPolNo_(g(v, 'Policy')), agent: tText_(g(v, 'Agent')), agentNo: tText_(g(v, 'Agent no.')), agentEmail: tText_(g(v, 'Agent e-mail')),
      named: g(v, 'Named on'), via: tText_(g(v, 'Named via')), q: tText_(g(v, 'Questionnaire')), received: g(v, 'Received'),
      amount: Number(g(v, 'Amount')) || T_CLAIM.AMOUNT, submitted: g(v, 'Submitted'), sf: tText_(g(v, 'Salesforce')),
      follow: Number(g(v, 'Follow-ups')) || 0, lastFollow: g(v, 'Last follow-up'), paid: g(v, 'Paid'), status: tText_(g(v, 'Status')), note: tText_(g(v, 'Note')) });
  }
  return out;
}

/** Writes fields onto one claim's row, found by its Claim id (the tab may have been sorted since it was read). Returns ret. */
function tClaimSet_(c, fields, ret) {
  try {
    var sh = ss_().getSheetByName(T_CLAIM.TAB);
    if (!sh || sh.getLastRow() < 2) return ret;
    var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (h) { return String(h).trim(); });
    var idc = head.indexOf('Claim');
    if (idc < 0) return ret;
    var ids = sh.getRange(1, idc + 1, sh.getLastRow(), 1).getValues(), rn = 0;
    for (var i = 1; i < ids.length && !rn; i++) if (String(ids[i][0] || '').trim() === c.id) rn = i + 1;
    if (!rn) return ret;
    Object.keys(fields).forEach(function (k) { var j = head.indexOf(k); if (j >= 0) sh.getRange(rn, j + 1).setValue(fields[k]); });
  } catch (e) {}
  return ret;
}

/** Who each client was named to, and when, every time, by token, oldest first: [{ agent, day: 'yyyy-MM-dd', via }]. From the
 *  board (Assigned to on the client's Client Responses rows, and the [assigned d MMM · Name] stamps in their Note cells, which
 *  keep every name before the latest) and the Household Assignments tab (Salesforce's names, through tHaSync_). */
function tNamingsAll_(tz, ha) {
  var by = {}, now = new Date(), year = now.getFullYear(), today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  var add = function (tok, agent, day, via) {
    if (!tok || !agent || !day) return;
    var a = by[tok] = by[tok] || [];
    if (!a.some(function (x) { return x.day === day && tNameKey_(x.agent) === tNameKey_(agent); })) a.push({ agent: agent, day: day, via: via });
  };
  tSheetRows_(SVC.RESP_SHEET).rows.forEach(function (v) {
    var tok = String(v[1] || '').trim(), agent = String(v[8] || '').trim();
    if (!tok) return;
    if (agent) add(tok, agent, tDay_(v[9]) || tDay_(v[0]) || '', 'board');
    var re = /\[assigned (\d{1,2}) ([A-Z][a-z]{2}) · ([^\]]+)\]/g, m, note = String(v[10] || '');
    while ((m = re.exec(note))) {
      if (MON[m[2]] === undefined) continue;
      var d = Utilities.formatDate(new Date(year, MON[m[2]], +m[1], 12), tz, 'yyyy-MM-dd');
      if (d > today) d = Utilities.formatDate(new Date(year - 1, MON[m[2]], +m[1], 12), tz, 'yyyy-MM-dd');   // a stamp from December, read in January
      add(tok, m[3].trim(), d, 'board');
    }
  });
  if (ha) ha.rows.forEach(function (r) { if (r.token && r.agent) add(r.token, r.agent, tDay_(r.date) || '', r.source === 'Salesforce' ? 'Salesforce' : 'board'); });
  Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; }); });
  return by;
}

/** New claims: every service questionnaire from the last WINDOW_DAYS that names a client of the campaign (its Link ref, else
 *  a policy number only that client holds, else an e-mail only that client has) and came in on or after the day the client
 *  was named to an agent, once per client; then each new or held claim is tried (tClaimSubmit_). Matched again at once when
 *  a questionnaire arrives, and otherwise every SCAN_EVERY_MIN minutes, so a name given in Salesforce with an earlier date
 *  is still seen. */
function tClaimsFind_(force) {
  var props = PropertiesService.getScriptProperties(), tz = tTz_(), now = new Date();
  var q = tSheetRows_(SVC.IND_SHEET), out = { found: 0, sent: 0, held: 0 };
  var lastN = Number(props.getProperty('claims_q_rows') || -1), lastAt = Number(props.getProperty('claims_scan_at') || 0);
  if (!force && q.rows.length === lastN && Date.now() - lastAt < T_CLAIM.SCAN_EVERY_MIN * 60000) return out;
  props.setProperty('claims_q_rows', String(q.rows.length));
  props.setProperty('claims_scan_at', String(Date.now()));
  var cl = tClaimsRead_(), qi = {};
  q.head.forEach(function (h, i) { if (h && qi[h] === undefined) qi[h] = i; });
  var col = function (v, h) { return qi[h] !== undefined ? v[qi[h]] : ''; };
  var have = {}, byQ = {}, cut = now.getTime() - T_CLAIM.WINDOW_DAYS * 86400000, fresh = [];
  cl.rows.forEach(function (r) { if (r.token) have[r.token] = r; if (r.q) byQ[r.q] = r; });
  q.rows.forEach(function (v) {
    var at = col(v, 'Timestamp'), ref = tText_(col(v, 'Reference'));
    if (!ref || byQ[ref] || !(at instanceof Date) || isNaN(at.getTime()) || at.getTime() < cut) return;
    var pol = tPolNo_(col(v, 'Policy #')), link = tText_(col(v, 'Link ref'));
    if (/^test/i.test(pol) || /^transition:(pilot|test)\b/i.test(link) || /^(test|void|duplicate|spam)/i.test(tText_(col(v, 'Status')))) return;
    fresh.push({ ref: ref, at: at, pol: pol, link: link, email: tText_(col(v, 'Email')).toLowerCase() });
  });
  var retry = cl.rows.filter(function (r) { return T_CLAIM_RETRY.test(r.status); });
  if (!fresh.length && !retry.length) return out;
  /* the clients of the campaign: never a staff Test row, a departed agent's own policy or household, staff, a death claim */
  var t = tRead_(), byTok = {}, byMail = {};
  t.rows.forEach(function (r) {
    var tok = tText_(r.Token);
    if (!tok || tYes_(r.Test) || /^test:/i.test(tText_(r.Agent)) || /^test\b/i.test(tText_(r.Client)) || T_NOT_BOOK.test(tText_(r.Exclude))) return;
    byTok[tok] = r;
    var m = tText_(r.Email).toLowerCase();
    if (m) (byMail[m] = byMail[m] || []).push(tok);
  });
  var ha = null;
  try { ha = tHaRead_(); } catch (e) {}
  var polTok = null;
  var tokOfPol = function (p) {
    if (!polTok) {
      polTok = {};
      var add = function (no, tok) { no = tPolNo_(no); if (!no) return; var a = polTok[no] = polTok[no] || []; if (a.indexOf(tok) < 0) a.push(tok); };
      if (ha) ha.rows.forEach(function (r) { if (r.token && byTok[r.token]) r.pols.forEach(function (no) { add(no, r.token); }); });
      var bk = tBook_();
      if (bk.ready) Object.keys(byTok).forEach(function (tok) { (bk.by[tCno_(byTok[tok]['Client number'])] || []).forEach(function (rec) { add(rec.no, tok); }); });
    }
    var a = polTok[p] || [];
    return a.length === 1 ? a[0] : '';
  };
  var names = tNamingsAll_(tz, ha), made = [], ids = {}, seq = Number(props.getProperty('claims_seq') || 0);
  cl.rows.forEach(function (r) { ids[r.id] = true; });
  fresh.sort(function (a, b) { return a.at.getTime() - b.at.getTime(); });   // a client's first questionnaire after the naming is the one that claims
  fresh.forEach(function (c) {
    var m = /^transition:([A-Za-z0-9_-]+)$/.exec(c.link);
    var tok = (m && byTok[m[1]] ? m[1] : '') || (c.pol ? tokOfPol(c.pol) : '') || (c.email && (byMail[c.email] || []).length === 1 ? byMail[c.email][0] : '');
    if (!tok || have[tok]) return;                                            // not a client of the campaign, or claimed once already
    var day = Utilities.formatDate(c.at, tz, 'yyyy-MM-dd'), nm = null;
    (names[tok] || []).forEach(function (n) { if (n.day <= day) nm = n; });   // the agent they were named to when it came in
    if (!nm) return;                                                          // before anyone was named: no claim (the manager's rule)
    var r = byTok[tok], id;
    do { seq++; id = 'RP-' + Utilities.formatDate(now, tz, 'yyMMdd') + '-' + ('00' + seq).slice(-3); } while (ids[id]);
    ids[id] = true;
    var mine = c.pol && tClientPols_(tok, tText_(r['Client number']), ha).indexOf(c.pol) >= 0;
    var claim = { id: id, token: tok, client: tText_(r.Client) || tText_(r['First name']) || 'a client', cno: tText_(r['Client number']),
      policy: mine ? c.pol : '', agent: nm.agent, named: tHaDate_(nm.day), via: nm.via, q: c.ref, received: c.at, amount: T_CLAIM.AMOUNT, status: 'New' };
    made.push(claim); have[tok] = claim;
  });
  props.setProperty('claims_seq', String(seq));
  if (made.length) {
    var sh = tClaimTab_(), head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), T_CLAIM_HEAD.length)).getValues()[0].map(function (h) { return String(h).trim(); });
    var rows = made.map(function (c) {
      var v = { Claim: c.id, Token: c.token, Client: c.client, 'Client number': c.cno, Policy: c.policy, Agent: c.agent, 'Named on': c.named,
        'Named via': c.via, Questionnaire: c.q, Received: c.received, Amount: c.amount, 'Follow-ups': 0, Status: 'New' };
      return head.map(function (h) { return v.hasOwnProperty(h) ? v[h] : ''; });
    });
    var start = sh.getLastRow() + 1;
    ['Token', 'Client number', 'Policy'].forEach(function (h) { var j = head.indexOf(h); if (j >= 0) sh.getRange(start, j + 1, rows.length, 1).setNumberFormat('@'); });
    sh.getRange(start, 1, rows.length, head.length).setValues(rows);
    out.found = made.length;
    log_('transition', 'claims-found', made.map(function (c) { return c.id + ' ' + c.agent + ' · ' + c.client; }).join('; '));
  }
  var ctx = { live: tClaimsLive_(), roster: tRoster_(), ha: ha };
  made.concat(retry).forEach(function (c) {
    if (out.sent >= T_CLAIM.MAX_PER_RUN) return;
    var r = tClaimSubmit_(c, ctx);
    if (r === 'sent') out.sent++;
    else if (r === 'held' || r === 'not sent') out.held++;
  });
  return out;
}

/** One claim to the Retention unit: the agent off the Agent Skill Bank; held until the go; Salesforce read for a submission
 *  the branch already entered by hand; then the e-mail and the submission date in Salesforce. Returns 'sent', 'by hand',
 *  'held' or 'not sent'; the Status cell says the same in words. */
function tClaimSubmit_(c, ctx) {
  var k = tNameKey_(c.agent), a = null;
  ctx.roster.forEach(function (x) { if (!a && tNameKey_(x.name) === k) a = x; });
  if (!a) return tClaimSet_(c, { Status: 'Held: ' + c.agent + ' is not on the Agent Skill Bank as an active agent' }, 'held');
  c.agentNo = a.no; c.agentEmail = a.email;
  var who = { 'Agent no.': a.no, 'Agent e-mail': a.email };
  if (!ctx.live) return tClaimSet_(c, tMerge_(who, { Status: 'Held: waiting for the go (Transition: start the TT$200 claims)' }), 'held');
  var pols = tClientPols_(c.token, c.cno, ctx.ha);
  if (c.policy && pols.indexOf(c.policy) < 0) pols.unshift(c.policy);
  var sf = tClaimSf_(pols, c);
  if (sf.byHand) {
    return tClaimSet_(c, tMerge_(who, { Policy: sf.byHand.no, Submitted: tHaDate_(sf.byHand.day),
      Salesforce: sf.byHand.id + ' · entered by hand ' + sf.byHand.day + ': not e-mailed again', Status: 'Submitted by hand' }), 'by hand');
  }
  c.policy = (sf.rec && sf.rec.no) || c.policy || pols[0] || '';
  tClaimSet_(c, tMerge_(who, { Policy: c.policy, Status: 'Sending' }));
  try { tClaimMail_(c); }
  catch (e) { return tClaimSet_(c, { Status: 'Not sent: ' + String(e && e.message ? e.message : e).slice(0, 160) }, 'not sent'); }
  var note = tClaimSfWrite_(sf, c);
  tClaimSet_(c, { Submitted: new Date(), Salesforce: note, Status: 'Submitted' });
  log_('transition', 'claim', c.id + ' · ' + c.agent + ' · ' + c.client + ' · e-mailed to the Retention unit · Salesforce: ' + note);
  return 'sent';
}
/** Two sets of fields as one. */
function tMerge_(a, b) { var o = {}; [a, b].forEach(function (x) { Object.keys(x || {}).forEach(function (k) { o[k] = x[k]; }); }); return o; }

/** The client's policies in Salesforce for a claim: { on, rec (the record to write), byHand (a submission on or after the
 *  day the client was named, already entered), all, why, error }. Never throws. */
function tClaimSf_(pols, c) {
  if (!tSfOn_()) return { on: false, why: 'Salesforce is not linked to this project' };
  if (!pols.length) return { on: true, why: 'no policy number for this client' };
  try {
    var recs = svcSfQuery_('SELECT Id, POLICY__c, Assigned_Agent__r.Name, Date_Subm_to_Retention__c, Was_Agent_Paid__c, Date_Comm_Paid__c ' +
      'FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN (' + tSoqlIn_(pols.slice(0, 100)) + ')');
    var named = tDay_(c.named) || '', byHand = null;
    var all = recs.map(function (r) {
      return { id: r.Id, no: tPolNo_(r.POLICY__c), agent: r.Assigned_Agent__r ? String(r.Assigned_Agent__r.Name || '') : '',
        sub: String(r.Date_Subm_to_Retention__c || ''), was: String(r.Was_Agent_Paid__c || ''), paid: String(r.Date_Comm_Paid__c || '') };
    });
    all.forEach(function (x) { if (x.sub && named && x.sub >= named && (!byHand || x.sub < byHand.sub)) byHand = x; });
    if (byHand) return { on: true, all: all, byHand: { id: byHand.id, no: byHand.no, day: byHand.sub } };
    var k = tNameKey_(c.agent), free = all.filter(function (x) { return !x.sub; });
    free.sort(function (x, y) {
      return ((x.no === c.policy ? 0 : 1) - (y.no === c.policy ? 0 : 1))                       // the questionnaire's own policy
        || ((tNameKey_(x.agent) === k ? 0 : 1) - (tNameKey_(y.agent) === k ? 0 : 1))           // the one the agent was named on
        || (pols.indexOf(x.no) - pols.indexOf(y.no));                                          // the live one with the largest premium
    });
    return { on: true, all: all, rec: free[0] || null,
      why: free.length ? '' : all.length ? 'every policy of this client already carries an earlier retention submission' : 'Salesforce has none of these policies' };
  } catch (e) { return { on: true, error: String(e && e.message ? e.message : e).slice(0, 160) }; }
}

/** Date Subm to Retention (today) and, when blank, Was Agent Paid = No on the claim's record. Returns the Salesforce cell. */
function tClaimSfWrite_(sf, c) {
  if (!sf.on) return 'not linked: enter Date Subm to Retention on policy ' + (c.policy || '(none on file)') + ' by hand';
  if (sf.error) return 'not read (' + sf.error + '): enter it by hand';
  if (!sf.rec) return 'not written: ' + (sf.why || 'no record') + '; enter it by hand';
  var today = Utilities.formatDate(new Date(), tTz_(), 'yyyy-MM-dd'), body = { Date_Subm_to_Retention__c: today };
  if (!sf.rec.was) body.Was_Agent_Paid__c = 'No';
  try {
    tSfSend_('patch', '/sobjects/CLIENT_PORTFOLIO__c/' + sf.rec.id, body);
    return sf.rec.id + ' · policy ' + sf.rec.no + ': Date Subm to Retention ' + today + (body.Was_Agent_Paid__c ? ', Was Agent Paid No' : '');
  } catch (e) { return 'failed on policy ' + sf.rec.no + ': ' + String(e && e.message ? e.message : e).slice(0, 160) + '; enter it by hand'; }
}

/** A date for the e-mails: a Date or a yyyy-MM-dd as "3 October 2026". */
function tClaimDay_(x) {
  var d = x instanceof Date ? x : tHaDate_(x);
  return d && !isNaN(d.getTime()) ? Utilities.formatDate(d, tTz_(), 'd MMMM yyyy') : tText_(x);
}

/** The claim to the Retention unit, from support@, the manager and the agent copied, a reply going to the manager. */
function tClaimMail_(c) {
  var esc = tEsc_, copy = T_CLAIM.COPY || SVC.AGENT_EMAIL, M = TRANSITION.MANAGER || {};
  var amt = T_CLAIM.CUR + tMoney_(c.amount || T_CLAIM.AMOUNT, 2), agent = c.agent + (c.agentNo ? ' (' + c.agentNo + ')' : '');
  var rows = [['Agent to be paid', agent], ['Amount', amt], ['Client', c.client + (c.cno ? ' · client number ' + c.cno : '')],
    ['Policy', c.policy || 'none on file: see the client number'], ['Service questionnaire', c.q + ', received ' + tClaimDay_(c.received)],
    ['Named to the agent', tClaimDay_(c.named) + (c.via === 'Salesforce' ? ', in Salesforce' : ', on the branch assignment board')], ['Branch reference', c.id]];
  var subject = 'Retention claim ' + amt + ': ' + agent + ' · ' + c.client + (c.policy ? ', policy ' + c.policy : '');
  var html = '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:620px">' +
    '<p style="margin:0 0 12px">Good day,</p>' +
    '<p style="margin:0 0 12px">Please process the conservation payment below for an orphan policyholder of the Ricky Rampersad Branch. ' +
    'The client was named to the agent on ' + esc(tClaimDay_(c.named)) + ', and their service questionnaire came in on ' + esc(tClaimDay_(c.received)) + '.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 14px">' +
    rows.map(function (r) {
      return '<tr><td style="padding:6px 14px 6px 0;vertical-align:top;white-space:nowrap;font-size:13px;color:#8a97a8;border-top:1px solid #eef2f5">' + esc(r[0]) +
        '</td><td style="padding:6px 0;vertical-align:top;font-size:14.5px;color:#12202e;border-top:1px solid #eef2f5"><b>' + esc(r[1]) + '</b></td></tr>';
    }).join('') + '</table>' +
    '<p style="margin:0 0 12px">When it is paid, please reply with the payment date, or enter it as <b>Date Comm Paid</b> on the policy in Salesforce. ' +
    'Until that date is there, this claim is on the list of unpaid claims we send you every Monday.</p>' +
    '<p style="margin:0 0 14px">Thank you,<br><b style="color:#12202e">' + esc(M.name || 'Ricky Rampersad') + '</b><br>' + esc(M.title || 'Branch Manager') + ', Ricky Rampersad Branch</p>' +
    '<p style="margin:0;font-size:12px;color:#8a97a8">' + esc(T_CLAIM_FOOT) + '</p></div>';
  var cc = [copy];
  if (c.agentEmail && cc.map(function (x) { return String(x).toLowerCase(); }).indexOf(String(c.agentEmail).toLowerCase()) < 0) cc.push(c.agentEmail);
  tMsSend_(T_CLAIM.TO, subject, html, { cc: cc, replyTo: copy });
}

/** Payments: a Paid date typed on the tab closes a claim; with Salesforce linked, every PAID_EVERY_MIN minutes, a Date Comm
 *  Paid on or after the day the client was named, on the claim's policy or any other of the client's, closes it too, and Was
 *  Agent Paid is set to Yes on that record when it is not already. A date still to come (the next commission run) counts:
 *  the date is what the Retention unit was asked for. */
function tClaimsPaid_(force) {
  var cl = tClaimsRead_(), out = { paid: 0 };
  var open = [];
  cl.rows.forEach(function (r) {
    if (!/^submitted/i.test(r.status)) return;
    if (tText_(r.paid)) { tClaimSet_(r, { Status: 'Paid (entered on this tab)' }); out.paid++; return; }
    open.push(r);
  });
  if (!open.length || !tSfOn_()) return out;
  var props = PropertiesService.getScriptProperties(), last = Number(props.getProperty('claims_paid_at') || 0);
  if (!force && Date.now() - last < T_CLAIM.PAID_EVERY_MIN * 60000) return out;
  props.setProperty('claims_paid_at', String(Date.now()));
  var ha = null;
  try { ha = tHaRead_(); } catch (e) {}
  var per = {}, want = {}, recs = {};
  open.forEach(function (r) {
    var ps = tClientPols_(r.token, r.cno, ha);
    if (r.policy) { ps = ps.filter(function (p) { return p !== r.policy; }); ps.unshift(r.policy); }
    per[r.id] = ps;
    ps.forEach(function (p) { want[p] = true; });
  });
  var nos = Object.keys(want);
  for (var i = 0; i < nos.length; i += 150) {
    svcSfQuery_('SELECT Id, POLICY__c, Was_Agent_Paid__c, Date_Comm_Paid__c FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN (' + tSoqlIn_(nos.slice(i, i + 150)) + ')')
      .forEach(function (x) { recs[tPolNo_(x.POLICY__c)] = { id: x.Id, was: String(x.Was_Agent_Paid__c || ''), paid: String(x.Date_Comm_Paid__c || '') }; });
  }
  open.forEach(function (r) {
    var named = tDay_(r.named) || '', hit = null;
    per[r.id].forEach(function (p) { var x = recs[p]; if (!hit && x && x.paid && (!named || x.paid >= named)) hit = { no: p, rec: x }; });
    if (!hit) return;
    var note = '[paid ' + hit.rec.paid + ' in Salesforce, policy ' + hit.no + ']';
    if (hit.rec.was !== 'Yes') {
      try { tSfSend_('patch', '/sobjects/CLIENT_PORTFOLIO__c/' + hit.rec.id, { Was_Agent_Paid__c: 'Yes' }); note += ' [Was Agent Paid set to Yes]'; }
      catch (e) { note += ' [Was Agent Paid not set: ' + String(e && e.message ? e.message : e).slice(0, 80) + ']'; }
    }
    tClaimSet_(r, { Paid: tHaDate_(hit.rec.paid), Status: 'Paid', Note: (r.note ? r.note + ' ' : '') + note });
    out.paid++;
    log_('transition', 'claim-paid', r.id + ' · ' + r.agent + ' · ' + r.client + ' · ' + hit.rec.paid);
  });
  return out;
}

/** The Monday list: one e-mail to the Retention unit with every claim sent at least MIN_DAYS before and still without a
 *  payment date, oldest first, the manager copied (never the agents: the list carries every agent's clients; each agent
 *  sees their own claims on the board). Once a Monday, in the first run at or after MONDAY_HOUR; forced from the menu. */
function tClaimsMonday_(force) {
  var props = PropertiesService.getScriptProperties(), tz = tTz_(), now = new Date(), today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  if (!force) {
    if (!tClaimsLive_() || props.getProperty('claims_monday') === today) return { what: '' };
    if (Utilities.formatDate(now, tz, 'u') !== '1' || Number(Utilities.formatDate(now, tz, 'H')) < T_CLAIM.MONDAY_HOUR) return { what: '' };
  }
  var due = tClaimsRead_().rows.filter(function (r) {
    var s = tDay_(r.submitted);
    return /^submitted/i.test(r.status) && !tText_(r.paid) && !!s && (force || tDaysBetween_(s, today) >= T_CLAIM.MIN_DAYS);
  });
  if (!due.length) {
    if (!force) props.setProperty('claims_monday', today);
    return { what: 'No unpaid claim to follow up.' };
  }
  due.sort(function (a, b) { return String(tDay_(a.submitted)).localeCompare(String(tDay_(b.submitted))) || a.id.localeCompare(b.id); });
  var esc = tEsc_, copy = T_CLAIM.COPY || SVC.AGENT_EMAIL, M = TRANSITION.MANAGER || {};
  var total = due.reduce(function (s, r) { return s + (r.amount || T_CLAIM.AMOUNT); }, 0), oldest = tDay_(due[0].submitted);
  var td = 'padding:6px 10px 6px 0;vertical-align:top;font-size:13.5px;color:#12202e;border-top:1px solid #eef2f5';
  var th = 'padding:4px 10px 4px 0;text-align:left;font-size:11.5px;font-weight:600;color:#8a97a8';
  var subject = 'Unpaid retention claims: ' + tN_(due.length, 'claim', 'claims') + ', ' + T_CLAIM.CUR + tMoney_(total, 2) + ', the oldest sent ' + tClaimDay_(oldest);
  var html = '<div style="font:15px/1.6 Inter,Arial,sans-serif;color:#33465a;max-width:760px">' +
    '<p style="margin:0 0 12px">Good day,</p>' +
    '<p style="margin:0 0 12px">These conservation payments for orphan policyholders of the Ricky Rampersad Branch were sent to you and still show no payment date in Salesforce. ' +
    'Please reply with the date each is paid, or enter it as <b>Date Comm Paid</b> on the policy; each one leaves this list when the date is there.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 14px"><tr>' +
    ['Sent to you', 'Agent', 'Client', 'Policy', 'Questionnaire', 'Amount', 'Asked before'].map(function (h) { return '<th style="' + th + '">' + h + '</th>'; }).join('') + '</tr>' +
    due.map(function (r) {
      var s = tDay_(r.submitted), days = tDaysBetween_(s, today);
      return '<tr><td style="' + td + ';white-space:nowrap">' + esc(tClaimDay_(s)) + '<br><span style="color:#8a97a8;font-size:12px">' + esc(tN_(days, 'day', 'days')) + ' ago</span></td>' +
        '<td style="' + td + '">' + esc(r.agent) + (r.agentNo ? '<br><span style="color:#8a97a8;font-size:12px">' + esc(r.agentNo) + '</span>' : '') + '</td>' +
        '<td style="' + td + '">' + esc(r.client) + (r.cno ? '<br><span style="color:#8a97a8;font-size:12px">client ' + esc(r.cno) + '</span>' : '') + '</td>' +
        '<td style="' + td + '">' + esc(r.policy || '—') + '</td><td style="' + td + '">' + esc(r.q) + '</td>' +
        '<td style="' + td + ';white-space:nowrap">' + esc(T_CLAIM.CUR + tMoney_(r.amount || T_CLAIM.AMOUNT, 2)) + '</td>' +
        '<td style="' + td + '">' + esc(r.follow ? tN_(r.follow, 'time', 'times') : 'first time') + '<br><span style="color:#8a97a8;font-size:12px">' + esc(r.id) + '</span></td></tr>';
    }).join('') + '</table>' +
    '<p style="margin:0 0 14px">' + esc(tN_(due.length, 'claim', 'claims')) + ', ' + esc(T_CLAIM.CUR + tMoney_(total, 2)) + ' in all. Thank you,<br><b style="color:#12202e">' +
    esc(M.name || 'Ricky Rampersad') + '</b><br>' + esc(M.title || 'Branch Manager') + ', Ricky Rampersad Branch</p>' +
    '<p style="margin:0;font-size:12px;color:#8a97a8">' + esc(T_CLAIM_FOOT) + '</p></div>';
  tMsSend_(T_CLAIM.TO, subject, html, { cc: [copy], replyTo: copy });
  due.forEach(function (r) { tClaimSet_(r, { 'Follow-ups': (r.follow || 0) + 1, 'Last follow-up': now }); });
  if (!force) props.setProperty('claims_monday', today);
  log_('transition', 'claims-monday', due.length + ' unpaid claims followed up with the Retention unit, ' + T_CLAIM.CUR + tMoney_(total, 2));
  return { what: 'Followed up ' + tN_(due.length, 'unpaid claim', 'unpaid claims') + ' with the Retention unit (' + T_CLAIM.CUR + tMoney_(total, 2) + ').' };
}

/** One claim as the board shows it: dates as "3 Oct 2026", where it stands in one word (unpaid, paid, held, notsent, check,
 *  closed, new), and for the branch the Status and Salesforce cells as written. */
function tClaimView_(r, tz, today, branch) {
  var d = function (x) { var y = tDay_(x); return y ? tDmy_(y) : ''; };
  var sub = tDay_(r.submitted) || '', paid = tDay_(r.paid) || '', st = r.status;
  var state = /^paid/i.test(st) || (/^submitted/i.test(st) && tText_(r.paid)) ? 'paid' : T_CLAIM_SHUT.test(st) ? 'closed' : /^submitted/i.test(st) ? 'unpaid'
    : /^held/i.test(st) ? 'held' : /^not sent/i.test(st) ? 'notsent' : /^sending/i.test(st) ? 'check' : 'new';
  var v = { id: r.id, token: r.token, client: r.client, agent: r.agent, amount: r.amount, q: r.q, received: d(r.received), named: d(r.named), via: r.via,
    submitted: sub ? tDmy_(sub) : '', days: sub ? tDaysBetween_(sub, today) : null, follow: r.follow, last: d(r.lastFollow),
    paid: paid ? tDmy_(paid) : (tText_(r.paid) && !paid ? tText_(r.paid) : ''), future: !!paid && paid > today, state: state, byHand: /by hand/i.test(st) };
  if (branch) { v.status = st; v.sf = r.sf; }
  return v;
}

/* ── one client in full: the history, their Salesforce tasks, the team's comments ── */
/* 3 October 2026: "I would Like updates so the agent can see the email and history and tasks opened on salesforce assigned
   to the staff and a place for their comments". The board's "History · tasks · comments" opens one client: everything
   between us and them, newest first (tTrail_, which a reply carries to the client, in the board's words, with what the
   branch did beside it: the names, the calls, the questionnaire, the claim, the comments); every Salesforce task on their
   policies or their contact record, open or closed in the last TASK_DAYS days, with who it is assigned to and its Chatter;
   and the comments. A comment is kept on the Board Comments tab and posted to the Chatter of the client's open tasks (the
   newest TASKS of them), or to the policy record when none is open, in the name of the person who wrote it. Who may open a
   client is who sees the card: the branch and staff everyone, a unit manager his team's, an agent their own. */
var T_CMT = { TAB: 'Board Comments', MAX: 800, TASKS: 3, TASK_DAYS: 14 };
var T_CMT_HEAD = ['When', 'Token', 'Client', 'Client number', 'By', 'Role', 'Comment', 'Salesforce'];
/* the trail's lines are in the client's own voice (it goes beneath a reply to them); the board reads them about the client */
var T_HIST_WORDS = { 'You answered our letter': 'Answered our letter', 'You told us by phone': 'Told us on a call', 'You wrote to us': 'Wrote to us',
  'You wrote on our page': 'Wrote on our page', 'We spoke with you by phone': 'We spoke with them by phone', 'We introduced your agent': 'We introduced their agent' };
var T_OUTCOME_WORDS = { called: 'Called', met: 'Met', 'no answer': 'Tried to call: no answer', declined: 'Declined', closed: 'Closed', open: 'Reopened' };

/** The agent a client is on now, the way the board decides it: the Assigned to with the newest Assigned on, unless the
 *  Household Assignments tab (Salesforce) names someone later. */
function tNamedNow_(tok, rows, ha) {
  var name = '', at = null, ar = null;
  rows.forEach(function (v) {
    var a = String(v[8] || '').trim(), on = v[9] instanceof Date ? v[9] : null, rec = v[0] instanceof Date ? v[0] : null;
    if (a && (!at || (on && on > at))) { name = a; at = on || at || rec; }
  });
  if (ha) ha.rows.forEach(function (r) { if (r.token === tok && r.agent) ar = r; });
  if (ar) { var hd = tHaDate_(ar.date); if (!name || (hd && at && hd > at)) { name = ar.agent; at = hd || at; } }
  return name;
}
/** Whether this viewer may open one client: the branch and staff, anyone; a unit manager, his team's; an agent, their own. */
function tMayOpen_(w, named) {
  if (w.role === 'branch' || w.role === 'staff') return true;
  if (w.role === 'unit') return tOnTeam_(w.team)(named);
  return !!(w.me && w.me.name) && tOnTeam_([w.me.name])(named);
}
/** The client a request names, and whether this viewer may open them: { ok, row, rows (their Client Responses rows), ha } or
 *  a refusal. */
function tOpenClient_(p, w) {
  var tok = String(p.token || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64), row = tok ? tRowByToken_(tok) : null;
  if (!row || tYes_(row.Test)) return { ok: false, error: 'That client is not on the send list.' };
  var rows = tSheetRows_(SVC.RESP_SHEET).rows.filter(function (v) { return String(v[1] || '').trim() === tok; }), ha = null;
  try { ha = tHaRead_(); } catch (e) {}
  if (!tMayOpen_(w, tNamedNow_(tok, rows, ha))) return { ok: false, refused: true, error: w.role === 'unit' ? 'That client is not on your team’s list.' : 'That client is not on your list.' };
  return { ok: true, tok: tok, row: row, rows: rows, ha: ha };
}

/** GET action=detail&code=…[&who=…]&token=…: one client's history, Salesforce tasks and comments; the claim too, for anyone
 *  but staff (Client Support sees no money). */
function transitionDetail_(p) {
  p = p || {};
  var w = tWho_(p.code, p.who);
  if (!w.ok) return { ok: false, refused: true, error: w.error };
  try {
    var o = tOpenClient_(p, w);
    if (!o.ok) return o;
    var tz = tTz_(), today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), staff = w.role === 'staff';
    var claim = null;
    var mineC = w.role === 'unit' ? tOnTeam_(w.team) : w.role === 'agent' ? tOnTeam_([w.me.name]) : null;
    if (!staff) tClaimsRead_().rows.forEach(function (r) { if (r.token === o.tok && (!mineC || mineC(r.agent))) claim = r; });
    var comments = tCommentsFor_(o.tok);
    var hist = tHistory_(o.row, o.rows, o.ha, claim, staff);
    var tasks = tSfTasks_(o.tok, tText_(o.row['Client number']), o.ha);
    var out = { ok: true, token: o.tok, client: tText_(o.row.Client) || tText_(o.row['First name']), at: Utilities.formatDate(new Date(), tz, 'd MMM HH:mm'),
      history: hist, tasks: tasks.tasks, tasksWhy: tasks.why || '', tasksError: tasks.error || '', sf: tasks.on, taskDays: T_CMT.TASK_DAYS,
      comments: comments.map(function (x) { return { when: x.when, by: x.by, role: x.role, text: x.text, sf: x.sf }; }) };
    if (claim) out.claim = tClaimView_(claim, tz, today, w.role === 'branch');
    return out;
  } catch (err) { return { ok: false, error: String(err && err.message ? err.message : err) }; }
}

/** Everything between us and one client, newest first: the trail (tTrail_), in the board's words, and what the branch did
 *  beside it — who they were named to, each call marked, the questionnaire and the claim (not for staff). The comments are
 *  their own list beside it. [{ when, who: 'them' | 'us' | 'branch', text, quote }]. */
function tHistory_(row, rows, ha, claim, staff) {
  var tz = tTz_(), out = [], now = new Date(), year = now.getFullYear();
  var MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  var stampDay = function (dd, mmm) {
    if (MON[mmm] === undefined) return null;
    var d = new Date(year, MON[mmm], +dd, 12);
    if (d > now) d = new Date(year - 1, MON[mmm], +dd, 12);
    return d;
  };
  var add = function (at, who, text, quote, timed) { out.push({ at: at instanceof Date && !isNaN(at.getTime()) ? at : null, who: who, text: text, quote: quote || '', timed: !!timed }); };
  try { tTrail_(row, rows, tReceipt_()).forEach(function (t) { add(t.at, t.who, T_HIST_WORDS[t.text] || t.text, t.quote, true); }); } catch (e) {}
  var seen = {}, tok = tText_(row.Token);
  rows.forEach(function (v) {
    var note = String(v[10] || ''), m;
    var re = /\[assigned (\d{1,2}) ([A-Z][a-z]{2}) · ([^\]]+)\]/g;
    while ((m = re.exec(note))) { var k = 'a' + m[1] + m[2] + m[3]; if (!seen[k]) { seen[k] = 1; add(stampDay(m[1], m[2]), 'branch', 'Named to ' + m[3].trim(), ''); } }
    var ro = /\[(called|met|declined|closed|open|no answer) (\d{1,2}) ([A-Z][a-z]{2}) · ([^\]]+)\]([^\[]*)/g;
    while ((m = ro.exec(note))) {
      var extra = m[5].replace(/\s+/g, ' ').trim(), k2 = 'o' + m[1] + m[2] + m[3] + m[4] + extra;
      if (!seen[k2]) { seen[k2] = 1; add(stampDay(m[2], m[3]), 'branch', T_OUTCOME_WORDS[m[1]] + ' · ' + m[4].trim(), extra); }
    }
  });
  if (ha) ha.rows.forEach(function (r) {
    if (r.token !== tok || !r.agent || r.source !== 'Salesforce') return;
    add(tHaDate_(r.date), 'branch', 'Named to ' + r.agent + ' in Salesforce', r.fb ? 'Feedback in Salesforce: ' + r.fb : '');
  });
  /* the questionnaire: by the letter's link, or under the e-mail the letter went to */
  try {
    var q = tSheetRows_(SVC.IND_SHEET), qi = {}, mail = tText_(row.Email).toLowerCase();
    q.head.forEach(function (h, i) { if (h && qi[h] === undefined) qi[h] = i; });
    q.rows.forEach(function (v) {
      var g = function (h) { return qi[h] !== undefined ? v[qi[h]] : ''; };
      var link = tText_(g('Link ref')), em = tText_(g('Email')).toLowerCase();
      if (link !== 'transition:' + tok && !(mail && em === mail)) return;
      add(g('Timestamp'), 'them', 'Filed a service questionnaire', [tText_(g('Reference')), tText_(g('Priority')), tText_(g('Status'))].filter(Boolean).join(' · '), true);
    });
  } catch (e) {}
  if (claim && !staff) {
    var amt = T_CLAIM.CUR + tMoney_(claim.amount || T_CLAIM.AMOUNT, 0);
    if (claim.submitted) add(claim.submitted instanceof Date ? claim.submitted : tHaDate_(tDay_(claim.submitted)), 'branch',
      amt + ' retention claim ' + claim.id + (/by hand/i.test(claim.status) ? ' (entered by hand)' : ' sent to the Retention unit'), 'for ' + claim.agent, claim.submitted instanceof Date);
    var pd = tDay_(claim.paid);
    if (pd) add(tHaDate_(pd), 'branch', amt + (pd > Utilities.formatDate(now, tz, 'yyyy-MM-dd') ? ' claim to be paid' : ' claim paid'),
      /entered on this tab/i.test(claim.status) ? 'the date entered on the ' + T_CLAIM.TAB + ' tab' : 'Date Comm Paid in Salesforce', false);
  }
  var dedupe = {};
  out = out.filter(function (x) { var k = (x.at ? Utilities.formatDate(x.at, tz, 'yyyy-MM-dd') : '') + '|' + x.text + '|' + x.quote; if (dedupe[k]) return false; dedupe[k] = 1; return true; });
  out.sort(function (a, b) { return (b.at ? b.at.getTime() : -1) - (a.at ? a.at.getTime() : -1); });
  return out.map(function (x) {
    return { when: x.at ? Utilities.formatDate(x.at, tz, x.timed ? 'd MMM yyyy, HH:mm' : 'd MMM yyyy') : '', who: x.who, text: x.text, quote: String(x.quote || '').slice(0, 1500) };
  });
}

/** Plain text from a Salesforce rich-text field: paragraphs and breaks as new lines, tags dropped, entities read. */
function tPlain_(s) {
  return String(s == null ? '' : s).replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(p|div|li)\s*>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** A task's subject as a person reads it: a broken flow formula ("Email: Happy Birthday " & $Record.FirstName) reads as what it is. */
function tTaskSubject_(s) {
  var t = tPlain_(s).replace(/\s+/g, ' ');
  if (/\$Record\./.test(t)) return /birthday/i.test(t) ? 'Birthday e-mail (automatic)' : 'Automatic e-mail';
  return t || '(no subject)';
}

/** The client's Salesforce records: { on, recs: [{ id, no, contact }] }. */
function tSfRecs_(pols) {
  if (!pols.length) return [];
  return svcSfQuery_('SELECT Id, POLICY__c, Contact__c FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN (' + tSoqlIn_(pols.slice(0, 100)) + ')').map(function (r) {
    return { id: r.Id, no: tPolNo_(r.POLICY__c), contact: r.Contact__c || '' };
  });
}
/** Every Salesforce task on the client's policy records or their contact record, open or changed in the last TASK_DAYS days,
 *  open first: who it is assigned to, its status and due date, who opened it, and its Chatter (posts and their replies).
 *  { on, tasks, why, error }. Never throws. */
function tSfTasks_(tok, cno, ha) {
  if (!tSfOn_()) return { on: false, tasks: [], why: 'Salesforce is not linked to this project yet: copy SF_KEY, SF_SECRET and SF_LOGIN_URL from the KPI Tracker into Project Settings → Script properties.' };
  try {
    var pols = tClientPols_(tok, cno, ha);
    if (!pols.length) return { on: true, tasks: [], why: 'No policy numbers for this client in the Client Book.' };
    var recs = tSfRecs_(pols), what = [], who = [], polOf = {};
    recs.forEach(function (r) { if (what.indexOf(r.id) < 0) what.push(r.id); polOf[r.id] = r.no; if (r.contact && who.indexOf(r.contact) < 0) who.push(r.contact); });
    if (!what.length) return { on: true, tasks: [], why: 'Salesforce has none of this client’s policies.' };
    var cond = ['WhatId IN (' + tSoqlIn_(what) + ')'];
    if (who.length) cond.push('WhoId IN (' + tSoqlIn_(who) + ')');
    var rows = svcSfQuery_('SELECT Id, Subject, Status, Priority, ActivityDate, IsClosed, Owner.Name, CreatedBy.Name, CreatedDate, LastModifiedDate, Description, WhatId ' +
      'FROM Task WHERE (' + cond.join(' OR ') + ') AND (IsClosed = false OR LastModifiedDate = LAST_N_DAYS:' + T_CMT.TASK_DAYS + ') ORDER BY CreatedDate DESC LIMIT 25');
    var feed = {}, inst = '';
    try { inst = svcSfToken_().instance_url || ''; } catch (e) {}
    if (rows.length) {
      svcSfQuery_('SELECT Id, ParentId, Body, CreatedDate, CreatedBy.Name, (SELECT CommentBody, CreatedDate, CreatedBy.Name FROM FeedComments ORDER BY CreatedDate DESC LIMIT 5) ' +
        'FROM FeedItem WHERE ParentId IN (' + tSoqlIn_(rows.map(function (t) { return t.Id; })) + ") AND Type = 'TextPost' ORDER BY CreatedDate DESC LIMIT 100").forEach(function (f) {
        (feed[f.ParentId] = feed[f.ParentId] || []).push({ when: tSfWhen_(f.CreatedDate), by: f.CreatedBy ? f.CreatedBy.Name : '', text: tPlain_(f.Body).slice(0, 1500),
          replies: ((f.FeedComments && f.FeedComments.records) || []).map(function (x) { return { when: tSfWhen_(x.CreatedDate), by: x.CreatedBy ? x.CreatedBy.Name : '', text: tPlain_(x.CommentBody).slice(0, 800) }; }) });
      });
    }
    var tasks = rows.map(function (t) {
      return { id: t.Id, subject: tTaskSubject_(t.Subject), status: String(t.Status || ''), priority: String(t.Priority || ''), open: !t.IsClosed,
        due: t.ActivityDate ? tDmy_(String(t.ActivityDate)) : '', owner: t.Owner ? t.Owner.Name : '', by: t.CreatedBy ? t.CreatedBy.Name : '',
        opened: tSfWhen_(t.CreatedDate), changed: tSfWhen_(t.LastModifiedDate), policy: polOf[t.WhatId] || '',
        desc: tPlain_(t.Description).slice(0, 700), posts: feed[t.Id] || [], url: inst ? inst + '/' + t.Id : '' };
    });
    tasks.sort(function (a, b) { return (b.open ? 1 : 0) - (a.open ? 1 : 0); });
    return { on: true, tasks: tasks };
  } catch (e) { return { on: true, tasks: [], error: 'Salesforce did not answer: ' + String(e && e.message ? e.message : e).slice(0, 160) }; }
}
/** A Salesforce date-time ("2026-10-03T15:18:26.000+0000") as "3 Oct 2026, 11:18" in the sheet's zone. */
function tSfWhen_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(String(s || ''));
  if (!m) return '';
  return Utilities.formatDate(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])), tTz_(), 'd MMM yyyy, HH:mm');
}

/** The Board Comments tab, made the first time someone comments. */
function tCmtTab_() {
  var ss = ss_(), sh = ss.getSheetByName(T_CMT.TAB);
  if (sh) return sh;
  sh = ss.insertSheet(T_CMT.TAB);
  sh.getRange(1, 1, 1, T_CMT_HEAD.length).setValues([T_CMT_HEAD]);
  try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, T_CMT_HEAD.length).setFontWeight('bold').setBackground(SB.light); } catch (e) {}
  return sh;
}
/** Every comment, newest first, by token: { tok: [{ at, when, by, role, text, sf }] }. */
function tCommentsAll_() {
  var by = {}, tz = tTz_(), t = tSheetRows_(T_CMT.TAB), ix = {};
  t.head.forEach(function (h, i) { if (h && ix[h] === undefined) ix[h] = i; });
  if (ix.Token === undefined) return by;
  t.rows.forEach(function (v) {
    var tok = String(v[ix.Token] || '').trim(), text = ix.Comment !== undefined ? String(v[ix.Comment] || '').trim() : '';
    if (!tok || !text) return;
    var at = ix.When !== undefined && v[ix.When] instanceof Date ? v[ix.When] : null;
    (by[tok] = by[tok] || []).push({ at: at, when: at ? Utilities.formatDate(at, tz, 'd MMM yyyy, HH:mm') : '', by: ix.By !== undefined ? String(v[ix.By] || '') : '',
      role: ix.Role !== undefined ? String(v[ix.Role] || '') : '', text: text, sf: ix.Salesforce !== undefined ? String(v[ix.Salesforce] || '') : '' });
  });
  Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return (b.at ? b.at.getTime() : 0) - (a.at ? a.at.getTime() : 0); }); });
  return by;
}
function tCommentsFor_(tok) { return tCommentsAll_()[tok] || []; }

/** GET action=comment&code=…[&who=…]&token=…&text=…: a comment on one client, by anyone who may open them. Kept on the Board
 *  Comments tab, and posted to the Chatter of the client's open Salesforce tasks (or the policy record when none is open). */
function transitionComment_(p) {
  p = p || {};
  var w = tWho_(p.code, p.who);
  if (!w.ok) return { ok: false, refused: true, error: w.error };
  var text = String(p.text || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, T_CMT.MAX);
  if (!text) return { ok: false, error: 'Write the comment first.' };
  var o = tOpenClient_(p, w);
  if (!o.ok) return o;
  var by = w.me && w.me.name ? w.me.name : 'The branch', role = w.me ? (w.me.title || '') : '';
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'The sheet is busy. Try again in a moment.' };
  try {
    var sh = tCmtTab_(), at = new Date(), client = tText_(o.row.Client) || tText_(o.row['First name']);
    /* a comment beginning = + - or @ would be a formula in the sheet: the apostrophe keeps it text, and the sheet never shows it */
    sh.appendRow([at, o.tok, client, tText_(o.row['Client number']), by, role, /^[=+\-@]/.test(text) ? "'" + text : text, 'posting to Salesforce…']);
    var rn = sh.getLastRow(), sf = tCommentToSf_(o, by, role, text, at);
    sh.getRange(rn, 8).setValue(sf.note);
    log_('transition', 'comment', by + ' · ' + client + ' · ' + sf.note);
    return { ok: true, posted: sf.posted, sf: sf.note,
      comment: { when: Utilities.formatDate(at, tTz_(), 'd MMM yyyy, HH:mm'), by: by, role: role, text: text, sf: sf.note } };
  } finally { lock.releaseLock(); }
}
/** The comment into Salesforce, in the writer's name: on the newest TASKS open tasks of the client, else on a policy record.
 *  { posted, note }. Never throws. */
function tCommentToSf_(o, by, role, text, at) {
  if (!tSfOn_()) return { posted: 0, note: 'not posted: Salesforce is not linked to this project' };
  try {
    var pols = tClientPols_(o.tok, tText_(o.row['Client number']), o.ha), recs = tSfRecs_(pols);
    if (!recs.length) return { posted: 0, note: 'not posted: Salesforce has none of this client’s policies' };
    var what = recs.map(function (r) { return r.id; }), who = recs.map(function (r) { return r.contact; }).filter(Boolean);
    var cond = ['WhatId IN (' + tSoqlIn_(what) + ')'];
    if (who.length) cond.push('WhoId IN (' + tSoqlIn_(who) + ')');
    var open = svcSfQuery_('SELECT Id, Subject FROM Task WHERE (' + cond.join(' OR ') + ') AND IsClosed = false ORDER BY CreatedDate DESC LIMIT ' + T_CMT.TASKS);
    var body = 'From the assignment board · ' + by + (role ? ' (' + role + ')' : '') + ', ' + Utilities.formatDate(at, tTz_(), 'd MMM yyyy HH:mm') + ':\n\n' + text;
    if (open.length) {
      var n = 0, fails = [];
      open.forEach(function (t) { try { tSfSend_('post', '/sobjects/FeedItem', { ParentId: t.Id, Body: body }); n++; } catch (e) { fails.push(String(e && e.message ? e.message : e).slice(0, 80)); } });
      return { posted: n, note: n ? 'posted to ' + tN_(n, 'open task', 'open tasks') + (fails.length ? '; ' + fails.length + ' refused: ' + fails[0] : '') : 'not posted: ' + fails[0] };
    }
    tSfSend_('post', '/sobjects/FeedItem', { ParentId: recs[0].id, Body: body });
    return { posted: 1, note: 'no open task: posted on policy ' + recs[0].no };
  } catch (e) { return { posted: 0, note: 'not posted: ' + String(e && e.message ? e.message : e).slice(0, 160) }; }
}
