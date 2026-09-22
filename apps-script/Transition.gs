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
 *   transitionSetup()        once — the tab, the hourly send, the 8:00 digest
 *   transitionPreviewToMe()  one of each letter to your own inbox
 *   transitionSendTest()     the rows marked Test = Y, now, whatever the hour
 *   transitionSendBatch()    what the hourly trigger runs; safe to run by hand
 *   transitionDigest()       the morning e-mail; safe to run by hand
 *
 * The Transition Send tab is built outside the repository from the Branch
 * Portfolio sheet (tools/letters has no client data). One row per client:
 * a token, the letter, the merge fields, and — filled in before anything is
 * looked at — the exclusions: the departed agents' own policies and their
 * households, staff addresses, death claims. A row with anything in Exclude
 * never sends.
 */
var TRANSITION = {
  SHEET: 'Transition Send',
  LETTERS: 'https://rickyrampersadbranch.com/orphan-transition/letters/',
  FILM: 'https://rickyrampersadbranch.com/your-policy/',
  FROM_NAME: 'Ricky Rampersad Branch',
  REPLY_TO: '',              // blank = SVC.AGENT_EMAIL. "Just reply" lands here.
  BCC: '',                   // a copy of every send, if wanted
  BATCH: 60,                 // the most one hourly run will send
  RESERVE: 25,               // daily quota kept back for the questionnaire's own e-mails
  HOURS: [9, 17],            // sends only between these hours, script time zone
  WEEKDAYS: [1, 2, 3, 4, 5], // Monday = 1
  ORDER: ['I', 'K', 'J', 'A', 'F', 'G'],   // the action letters first
  DIGEST_TO: '',             // blank = the script owner
  WAIT_DAYS: 2,              // a tap older than this, still unassigned, is late
};

var T_HEADERS = ['Token', 'Segment', 'First name', 'Email', 'Agent first name', 'Client', 'Agent',
  'Client number', 'first_year', 'years', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date', 'Exclude', 'Reason', 'Test', 'Send on',
  'Sent at', 'Status'];
/* the merge fields a letter may carry, and the ones that sit in the facts strip */
var T_FIELDS = ['first_year', 'years', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date'];
var T_FACTS = ['first_year', 'issue_date', 'paid_to', 'days', 'projected_lapse',
  'app_received', 'matured_on', 'maturity_date'];

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

/** Every row as an object keyed by the header text, plus _row (1-based). */
function tRead_() {
  var sh = tSheet_();
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var col = {};
  head.forEach(function (h, i) { if (h) col[h] = i + 1; });
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

function tTz_() { return Session.getScriptTimeZone() || 'America/Port_of_Spain'; }

/** A cell as the letter should print it: dates long, numbers whole, else trimmed text. */
function tText_(x) {
  if (x === null || x === undefined) return '';
  if (x instanceof Date) return isNaN(x.getTime()) ? '' : Utilities.formatDate(x, tTz_(), 'd MMMM yyyy');
  if (typeof x === 'number') return String(Math.round(x));
  return String(x).trim();
}
function tDay_(x) {            // yyyy-MM-dd, for comparing "Send on" with today
  if (x instanceof Date) return isNaN(x.getTime()) ? '' : Utilities.formatDate(x, tTz_(), 'yyyy-MM-dd');
  var s = String(x || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/* ── setup ────────────────────────────────────────────────────────── */
function transitionSetup() {
  tSheet_();
  var have = {};
  ScriptApp.getProjectTriggers().forEach(function (t) { have[t.getHandlerFunction()] = true; });
  if (!have.transitionSendBatch) ScriptApp.newTrigger('transitionSendBatch').timeBased().everyHours(1).create();
  if (!have.transitionDigest) ScriptApp.newTrigger('transitionDigest').timeBased().atHour(8).everyDays(1).create();
  var msg = '"' + TRANSITION.SHEET + '" is ready. The hourly send (' + TRANSITION.HOURS[0] + ':00 to ' +
    TRANSITION.HOURS[1] + ':00, Monday to Friday) and the 8:00 digest are installed. Import the send list ' +
    'into the tab, then run transitionPreviewToMe, then transitionSendTest.';
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

function tLetterFor_(seg) {
  var man = JSON.parse(tFetch_('manifest.json'));
  var L = null;
  (man.letters || []).forEach(function (l) { if (String(l.segment).toUpperCase() === seg) L = l; });
  if (!L) throw new Error('No letter for segment ' + seg);
  return { subject: L.subject, html: tFetch_(L.file) };
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
  var map = {
    first_name: v('First name') || 'Client',
    agent_first_name: v('Agent first name') || 'your representative',
    token: v('Token'),
    segment: v('Segment').toUpperCase(),
  };
  T_FIELDS.forEach(function (k) { map[k] = v(k); });
  return out.replace(/\{\{(\w+)\}\}/g, function (m, k) {
    return map.hasOwnProperty(k) ? tEsc_(map[k]) : m;
  });
}

/** Send one row. Returns 'sent', or the reason it did not. Throws on a mail failure. */
function tSendRow_(row) {
  var seg = tText_(row.Segment).toUpperCase();
  var to = tText_(row.Email);
  if (!seg) return 'no letter';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return 'no e-mail';
  var L = tLetterFor_(seg);
  var subject = tFill_(L.subject, row).replace(/<[^>]+>/g, '');
  var html = tFill_(L.html, row);
  var link = TRANSITION.FILM + '?t=' + encodeURIComponent(tText_(row.Token)) + '&s=' + encodeURIComponent(seg);
  var plain = 'Dear ' + (tText_(row['First name']) || 'Client') + ',\n\n' +
    'Your representative, ' + (tText_(row['Agent first name']) || 'your representative') +
    ', has moved on from Guardian Life. Your policy has not.\n\n' +
    'This letter is best read in a mail app that shows pictures. Everything in it, and the two-minute film, is here:\n' +
    link + '\n\nRicky Rampersad\nBranch Manager, Ricky Rampersad Branch\nGuardian Life of the Caribbean';
  var opts = { htmlBody: html, name: TRANSITION.FROM_NAME, replyTo: TRANSITION.REPLY_TO || SVC.AGENT_EMAIL };
  if (TRANSITION.BCC) opts.bcc = TRANSITION.BCC;
  MailApp.sendEmail(to, subject, plain, opts);
  return 'sent';
}

/** Token for a row that came in without one, written back before the send. */
function tEnsureToken_(t, row) {
  if (tText_(row.Token)) return;
  var tok = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  t.sh.getRange(row._row, t.col.Token).setValue(tok);
  row.Token = tok;
}

function tMark_(t, row, status, sent) {
  if (sent && t.col['Sent at']) t.sh.getRange(row._row, t.col['Sent at']).setValue(new Date());
  if (t.col.Status) t.sh.getRange(row._row, t.col.Status).setValue(status);
}

function tSendRows_(t, rows) {
  var sent = 0, skipped = 0, failed = 0;
  rows.forEach(function (row) {
    try {
      tEnsureToken_(t, row);
      var res = tSendRow_(row);
      if (res === 'sent') { sent++; tMark_(t, row, 'sent', true); }
      else { skipped++; tMark_(t, row, res, false); }
    } catch (err) {
      failed++;
      tMark_(t, row, 'error: ' + String(err && err.message ? err.message : err).slice(0, 120), false);
      /* try again tomorrow, not every hour */
      if (t.col['Send on']) {
        var tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        t.sh.getRange(row._row, t.col['Send on']).setValue(Utilities.formatDate(tmr, tTz_(), 'yyyy-MM-dd'));
      }
    }
    Utilities.sleep(120);
  });
  return { sent: sent, skipped: skipped, failed: failed };
}

function tOrder_(row) {
  var i = TRANSITION.ORDER.indexOf(tText_(row.Segment).toUpperCase());
  return i < 0 ? 99 : i;
}

/* ── the hourly send ──────────────────────────────────────────────── */
function transitionSendBatch(force) {
  var tz = tTz_(), now = new Date();
  if (force !== true) {
    var h = Number(Utilities.formatDate(now, tz, 'H'));
    var wd = Number(Utilities.formatDate(now, tz, 'u'));      // 1 = Monday … 7 = Sunday
    if (TRANSITION.WEEKDAYS.indexOf(wd) < 0 || h < TRANSITION.HOURS[0] || h >= TRANSITION.HOURS[1]) {
      return 'outside sending hours';
    }
  }
  var quota = MailApp.getRemainingDailyQuota() - TRANSITION.RESERVE;
  var cap = Math.min(TRANSITION.BATCH, quota);
  if (cap <= 0) { log_('transition', 'no-quota', 'remaining ' + MailApp.getRemainingDailyQuota()); return 'no quota left today'; }

  var t = tRead_();
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var due = t.rows.filter(function (r) {
    if (tText_(r.Exclude)) return false;
    if (tText_(r['Sent at'])) return false;
    if (tText_(r.Test).toUpperCase() === 'Y') return false;    // the test rows go by hand
    if (!tText_(r.Segment)) return false;
    var so = tDay_(r['Send on']);
    return !so || so <= today;
  });
  due.sort(function (a, b) { return tOrder_(a) - tOrder_(b) || a._row - b._row; });
  var res = tSendRows_(t, due.slice(0, cap));
  var waiting = Math.max(0, due.length - cap);
  var msg = res.sent + ' sent, ' + res.skipped + ' skipped, ' + res.failed + ' failed, ' + waiting + ' waiting for the next run';
  log_('transition', 'batch', msg);
  return msg;
}

/** The rows marked Test = Y, now. Ignores the hours. Each sends once. */
function transitionSendTest() {
  var t = tRead_();
  var rows = t.rows.filter(function (r) {
    return tText_(r.Test).toUpperCase() === 'Y' && !tText_(r.Exclude) && !tText_(r['Sent at']) && tText_(r.Segment);
  });
  if (!rows.length) return 'No unsent rows marked Test = Y.';
  var res = tSendRows_(t, rows);
  var msg = 'Test: ' + res.sent + ' sent, ' + res.skipped + ' skipped, ' + res.failed + ' failed.';
  log_('transition', 'test', msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/** One of each letter to your own inbox, with sample values in every field. */
function transitionPreviewToMe() {
  var me = (Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail());
  if (!me) throw new Error('Could not read your address; run this from the sheet.');
  var man = JSON.parse(tFetch_('manifest.json'));
  var n = 0;
  (man.letters || []).forEach(function (L) {
    var row = {
      Token: 'PREVIEW', Segment: L.segment, 'First name': 'Sample', Email: me,
      'Agent first name': '[first name]', first_year: '2014', years: '12', issue_date: '14 March 2014',
      paid_to: '1 August 2026', days: '52', projected_lapse: '30 November 2026',
      app_received: '3 September 2026', matured_on: '1 September 2026', maturity_date: '1 March 2027',
    };
    var html = tFill_(L.html ? L.html : tFetch_(L.file), row);
    var subject = '[preview ' + L.segment + '] ' + tFill_(L.subject, row);
    MailApp.sendEmail(me, subject, 'Preview of letter ' + L.segment + '.', { htmlBody: html, name: TRANSITION.FROM_NAME });
    n++;
    Utilities.sleep(120);
  });
  var msg = n + ' preview letters sent to ' + me + '.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/* ── what comes back ──────────────────────────────────────────────── */
function tCodeOk_(code) {
  code = String(code || '').trim().toUpperCase();
  var branch = String(SVC.TEAM_CODE || '').trim().toUpperCase();
  var ok = !!(branch && code === branch);
  try {
    skillBank_().forEach(function (a) { if (a.portal && a.portal.toUpperCase() === code) ok = true; });
  } catch (e) {}
  return ok;
}

function tWorkingDays_(from, to) {
  var n = 0, d = new Date(from.getTime());
  d.setHours(0, 0, 0, 0);
  while (d < to) {
    d.setDate(d.getDate() + 1);
    var wd = d.getDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
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
    var ex = tText_(r.Exclude);
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
  resp.rows.forEach(function (v) {
    var received = v[0] instanceof Date ? v[0] : null;
    var tok = String(v[1] || '').trim(), r = byTok[tok];
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
      email: r ? tText_(r.Email) : '', row: v._row,
    };
    if (received && Utilities.formatDate(received, tz, 'yyyy-MM-dd') === Utilities.formatDate(now, tz, 'yyyy-MM-dd')) today++;
    var opens = String(v[7] || '').toLowerCase() === 'open';
    if (opens && !item.assigned && received && tWorkingDays_(received, now) >= TRANSITION.WAIT_DAYS) late.push(item);
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
    if (!mail || !byMail[mail]) return;
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
  var fb = tSheetRows_(SVC.TEAM_SHEET);
  var verdicts = { send: 0, change: 0, hold: 0 }, taking = {}, names = {};
  fb.rows.forEach(function (v) {
    var verdict = String(v[4] || '').toLowerCase();
    if (/as it is/.test(verdict)) verdicts.send++;
    else if (/change/.test(verdict)) verdicts.change++;
    else if (/hold/.test(verdict)) verdicts.hold++;
    var name = String(v[1] || '').trim();
    if (name) names[name] = 1;
    if (name && /yes|y|1|true/i.test(String(v[6] || ''))) taking[name] = String(v[2] || '').trim();
  });

  return {
    ok: true, at: Utilities.formatDate(now, tz, 'd MMM yyyy HH:mm'), totals: totals, segments: seg,
    taps: { total: taps.length, today: today, byType: byType, late: late, latest: taps.slice(0, 40) },
    reviews: { total: reviews.length, urgent: urgent, latest: reviews.slice(0, 20) },
    feedback: { people: Object.keys(names).length, verdicts: verdicts, taking: taking },
    waitDays: TRANSITION.WAIT_DAYS,
  };
}

function transitionData_(code) {
  if (!tCodeOk_(code)) {
    return { ok: false, error: String(SVC.TEAM_CODE || '').trim()
      ? 'That code does not open this page. Use the branch code, or your own code from the Agent Skill Bank.'
      : 'Not open yet — set TEAM_CODE in Service.gs, or add an agent with a portal code to the Agent Skill Bank.' };
  }
  return tSummary_();
}

/* ── the morning e-mail ───────────────────────────────────────────── */
function transitionDigest() {
  var to = TRANSITION.DIGEST_TO || Session.getEffectiveUser().getEmail();
  var s = tSummary_();
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
    return '<tr><td style="padding:4px 10px 4px 0"><b>' + k + '</b></td><td style="padding:4px 10px">' + g.sent + ' sent</td><td style="padding:4px 10px">' +
      g.waiting + ' waiting</td><td style="padding:4px 10px">' + g.taps + ' taps</td><td style="padding:4px 10px">' + g.excluded + ' held back</td></tr>';
  }).join('');
  var types = Object.keys(s.taps.byType).map(function (k) { return k + ' ' + s.taps.byType[k]; }).join(' · ') || 'none yet';
  var html = '<div style="font:15px/1.5 Arial,sans-serif;color:#33465a;max-width:640px">' +
    '<h2 style="font:800 20px Arial,sans-serif;color:#12202e;margin:0 0 4px">Transition — ' + s.at + '</h2>' +
    '<p style="margin:0 0 14px;color:#64798e">Sends, taps, reviews and verdicts. The live page has the detail.</p>' +
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
    ' change · ' + s.feedback.verdicts.hold + ' hold · taking assignments: ' + (tEsc_(Object.keys(s.feedback.taking).join(', ')) || 'nobody yet') + '</p></div>';
  MailApp.sendEmail(to, 'Transition: ' + s.totals.sent + ' sent, ' + s.taps.total + ' taps, ' + s.reviews.total +
    ' reviews' + (s.taps.late.length ? ', ' + s.taps.late.length + ' late' : ''), 'Open in a mail app that shows HTML.',
    { htmlBody: html, name: TRANSITION.FROM_NAME });
  return 'digest sent to ' + to;
}
