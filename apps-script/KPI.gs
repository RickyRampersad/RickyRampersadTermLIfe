/**
 * RRB · Daily KPI & Innovation Tracker — backend
 * =============================================================================
 * Bound to the KPI workbook. Serves the tracker at /kpi/ and sends the
 * 3pm checkpoint and the Friday weekly summary.
 *
 * What changed versus the first version of this script:
 *   1. Entries are UPSERTED on (StaffId, Date) instead of appended. Every
 *      "Save draft" used to add a fresh row, so one day could hold five copies
 *      of itself and every total downstream was inflated.
 *   2. Staff sign in. The Access tab holds the credentials; the check happens
 *      here, on the server. The password column is never served to a browser.
 *   3. Training records are kept. The form has always collected them; there
 *      was nowhere to put them, so they were dropped on save.
 *   4. Reports: a 3pm checkpoint and a weekly rollup, on screen and by email.
 *
 * Setup lives in KPI-SETUP.md at the repo root.
 * =============================================================================
 */

var CONFIG = {
  TZ: 'America/Port_of_Spain',
  TOKEN_HOURS: 12,
  CHECKPOINT_HOUR: 15,          // the 3pm cut
  LOG_TAB: 'KPI Log',           // created if header-detection finds nothing
  TRAINING_TAB: 'KPI Training',
  ACCESS_TAB: 'Access'
};

/** Manager recipients. Script Property MANAGER_EMAIL (comma-separated) wins;
 *  otherwise the workbook owner, which is the branch manager. */
function managerEmails_() {
  var p = PropertiesService.getScriptProperties().getProperty('MANAGER_EMAIL');
  if (p && p.trim()) {
    return p.split(',').map(function (s) { return s.trim(); }).filter(String);
  }
  var me = Session.getEffectiveUser().getEmail();
  return me ? [me] : [];
}

function ss_() { return SpreadsheetApp.getActive(); }

// ---------------------------------------------------------------------------
//  Tab discovery
//  The workbook's tabs are named however they were named. Rather than hardcode
//  a guess, find each one by the columns it carries.
// ---------------------------------------------------------------------------

function headerOf_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
}

function findTabBy_(mustHave) {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var head = headerOf_(sheets[i]).map(function (h) { return h.toLowerCase(); });
    var ok = mustHave.every(function (m) { return head.indexOf(m.toLowerCase()) > -1; });
    if (ok) return sheets[i];
  }
  return null;
}

/** The daily log. Identified by StaffId + KPI1_Actioned. */
function logSheet_() {
  var sh = findTabBy_(['StaffId', 'KPI1_Actioned']);
  if (sh) return ensureLogColumns_(sh);
  sh = ss_().insertSheet(CONFIG.LOG_TAB);
  sh.appendRow(LOG_HEADERS);
  sh.setFrozenRows(1);
  return sh;
}

/** The credentials tab. Identified by Email + Password. */
function accessSheet_() {
  var sh = findTabBy_(['Email', 'Password']);
  if (!sh) throw new Error('No Access tab found — it needs Email and Password columns.');
  return sh;
}

/** The training register. Created on first use. */
function trainingSheet_() {
  var sh = findTabBy_(['TrainingDate', 'Trainee']);
  if (sh) return sh;
  sh = ss_().insertSheet(CONFIG.TRAINING_TAB);
  sh.appendRow(TRAINING_HEADERS);
  sh.setFrozenRows(1);
  return sh;
}

var BLOCK_IDS = ['KPI1', 'KPI2', 'PM1', 'PM2'];

var LOG_HEADERS = ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status']
  .concat(BLOCK_IDS.reduce(function (a, p) {
    return a.concat([p, p + '_Actioned', p + '_Resolved', p + '_Open', p + '_Blocker']);
  }, []))
  .concat(['Closed', 'Overdue', 'Aged60', 'ValueAdded', 'Innovation', 'SystemFlags', 'Notes',
           'UpdatedAt', 'Revision']);

var TRAINING_HEADERS = ['TrainingDate', 'StaffId', 'Trainer', 'Block', 'Trainee', 'Topic',
                        'Objectives', 'Achieved', 'Test', 'Result', 'Followup', 'LoggedAt'];

/** UpdatedAt and Revision are new. Add them to an existing log without
 *  disturbing a single cell of what is already recorded. */
function ensureLogColumns_(sh) {
  var head = headerOf_(sh);
  ['UpdatedAt', 'Revision'].forEach(function (col) {
    if (head.indexOf(col) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
      head.push(col);
    }
  });
  return sh;
}

function colMap_(sh) {
  var m = {}, head = headerOf_(sh);
  head.forEach(function (h, i) { if (h) m[h] = i; });
  return m;
}

// ---------------------------------------------------------------------------
//  Dates
//  Dates arrive as text (2026-08-24) and as real Date cells. Normalise both to
//  the ISO day in branch time, or comparisons quietly fail across midnight.
// ---------------------------------------------------------------------------

/** A date cell comes back as a Date at midnight in the SPREADSHEET's zone, so
 *  that is the zone to read the calendar day back in. Reading it in any other
 *  zone can shift it by a day.
 *
 *  This is what broke the old script. It compared String(cell) against the
 *  posted "2026-06-22"; once Sheets had parsed that text into a date cell,
 *  String(cell) read "Mon Jun 22 2026 00:00:00 GMT-0400 (…)" and never matched
 *  again — so every save appended instead of updating the day it belonged to. */
var _ssTz = null;
function ssTz_() {
  if (_ssTz) return _ssTz;
  try { _ssTz = ss_().getSpreadsheetTimeZone() || CONFIG.TZ; }
  catch (e) { _ssTz = CONFIG.TZ; }
  return _ssTz;
}

function isoDay_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, ssTz_(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var d = new Date(s);
  return isNaN(d.getTime()) ? s : Utilities.formatDate(d, ssTz_(), 'yyyy-MM-dd');
}

function todayISO_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'); }

function shiftDays_(iso, n) {
  var p = iso.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing iso. The branch week runs Monday to Friday. */
function weekStart_(iso) {
  var p = iso.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  var dow = d.getUTCDay();                  // 0 Sun .. 6 Sat
  var back = dow === 0 ? 6 : dow - 1;
  return shiftDays_(iso, -back);
}

function weekDays_(monday) {
  var out = [];
  for (var i = 0; i < 5; i++) out.push(shiftDays_(monday, i));
  return out;
}

// ---------------------------------------------------------------------------
//  Sign-in
// ---------------------------------------------------------------------------

function normEmail_(s) { return String(s || '').trim().toLowerCase(); }

/** "Sasha Lalla-Jagassar" -> "sasha". The StaffId the log has always used is
 *  the first name, lowercased. Keep it, so old rows still join to new logins. */
function staffIdFor_(name) {
  return String(name || '').trim().toLowerCase().split(/[\s.]+/)[0] || '';
}

function roster_() {
  var sh = accessSheet_();
  if (sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  var idx = {};
  head.forEach(function (h, i) { idx[h.trim().toLowerCase()] = i; });
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var out = [];
  vals.forEach(function (r) {
    var email = normEmail_(r[idx['email']]);
    var name = String(r[idx['name']] || '').trim();
    if (!email && !name) return;
    var active = String(r[idx['active']] != null ? r[idx['active']] : 'Active').trim();
    out.push({
      email: email,
      name: name,
      staffId: staffIdFor_(name),
      agentNumber: String(r[idx['agent number']] || '').trim(),
      password: String(r[idx['password']] != null ? r[idx['password']] : ''),
      role: String(r[idx['role']] || '').trim(),
      unit: String(r[idx['unit']] || '').trim(),
      grade: idx['grade'] != null ? String(r[idx['grade']] || '').trim() : '',
      active: !/^(no|inactive|false|0)$/i.test(active)
    });
  });
  return out;
}

/** Manager rights: Role or Unit says so, or the address is on MANAGER_EMAIL. */
function isManager_(person) {
  if (!person) return false;
  var mgrs = managerEmails_().map(normEmail_);
  if (mgrs.indexOf(normEmail_(person.email)) > -1) return true;
  return /manager|admin|branch manager/i.test(person.role + ' ' + person.unit) &&
         !/assistant/i.test(person.unit);
}

function issueToken_(person) {
  var token = Utilities.getUuid();
  var payload = {
    staffId: person.staffId,
    name: person.name,
    email: person.email,
    manager: isManager_(person)
  };
  CacheService.getScriptCache().put('kpi_' + token, JSON.stringify(payload),
                                    CONFIG.TOKEN_HOURS * 3600);
  return { token: token, profile: payload };
}

function readToken_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('kpi_' + String(token));
  return raw ? JSON.parse(raw) : null;
}

/** Five wrong tries buys a fifteen-minute wait. The passwords on the Access
 *  tab are short, and without this the whole roster is minutes of guessing
 *  away from anyone who finds the page. */
var LOGIN_MAX_TRIES = 5, LOGIN_LOCK_SECONDS = 900;

function failKey_(key) { return 'kpifail_' + key; }

function tooManyTries_(key) {
  var n = Number(CacheService.getScriptCache().get(failKey_(key))) || 0;
  return n >= LOGIN_MAX_TRIES;
}

function noteFailure_(key) {
  var c = CacheService.getScriptCache();
  var n = (Number(c.get(failKey_(key))) || 0) + 1;
  c.put(failKey_(key), String(n), LOGIN_LOCK_SECONDS);
}

function clearFailures_(key) { CacheService.getScriptCache().remove(failKey_(key)); }

/** Identity is email or agent number; either is fine. Passwords are compared
 *  as trimmed strings so a numeric cell (1) matches typed text ("1"). */
function login_(who, password) {
  var key = String(who || '').trim().toLowerCase();
  var pass = String(password == null ? '' : password).trim();
  if (!key) return { ok: false, error: 'Enter your email or agent number.' };

  if (tooManyTries_(key)) {
    return { ok: false, error: 'Too many attempts. Wait fifteen minutes, or ask the Branch Manager.' };
  }

  var people = roster_();
  var person = null;
  for (var i = 0; i < people.length; i++) {
    var p = people[i];
    if (normEmail_(p.email) === key || p.agentNumber.toLowerCase() === key) { person = p; break; }
  }
  if (!person) {
    noteFailure_(key);
    return { ok: false, error: 'Not recognised. Check your email or agent number.' };
  }
  if (!person.active) return { ok: false, error: 'That account is not active. Speak to the Branch Manager.' };
  if (String(person.password).trim() !== pass) {
    noteFailure_(key);
    return { ok: false, error: 'Wrong password.' };
  }

  clearFailures_(key);
  var t = issueToken_(person);
  return { ok: true, token: t.token, profile: t.profile, roster: publicRoster_() };
}

/** The roster minus the passwords. This is the only shape that leaves here. */
function publicRoster_() {
  return roster_().filter(function (p) { return p.active; }).map(function (p) {
    return {
      staffId: p.staffId, name: p.name, email: p.email,
      agentNumber: p.agentNumber, unit: p.unit, grade: p.grade,
      manager: isManager_(p)
    };
  });
}

// ---------------------------------------------------------------------------
//  Reading entries
// ---------------------------------------------------------------------------

function allEntries_() {
  var sh = logSheet_();
  if (sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var out = [];
  vals.forEach(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, c) { if (h) o[h] = r[c]; });
    o.Date = isoDay_(o.Date);
    if (!o.StaffId && !o.Name) return;
    if (!o.StaffId) o.StaffId = staffIdFor_(o.Name);
    out.push(o);
  });
  return out;
}

/** One entry per person per day — the latest write wins.
 *  Until the backfill in dedupeLog() is run the sheet still holds the old
 *  duplicates, so collapse them on read too. Reports must not double-count. */
function latestEntries_() {
  var best = {};
  allEntries_().forEach(function (e) {
    var k = e.StaffId + '|' + e.Date;
    var seen = best[k];
    if (!seen) { best[k] = e; return; }
    var a = new Date(e.UpdatedAt || e.Timestamp || 0).getTime() || e._row;
    var b = new Date(seen.UpdatedAt || seen.Timestamp || 0).getTime() || seen._row;
    if (a >= b) best[k] = e;
  });
  return Object.keys(best).map(function (k) { return best[k]; });
}

function trainingRows_() {
  var sh = trainingSheet_();
  if (sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return vals.map(function (r) {
    var o = {};
    head.forEach(function (h, c) { if (h) o[h] = r[c]; });
    o.TrainingDate = isoDay_(o.TrainingDate);
    return o;
  }).filter(function (o) { return o.TrainingDate; });
}

// ---------------------------------------------------------------------------
//  Writing entries — upsert, not append
// ---------------------------------------------------------------------------

function saveEntry_(payload, profile) {
  var staffId = profile.manager && payload.staffId ? payload.staffId : profile.staffId;
  var date = isoDay_(payload.date);
  if (!staffId || !date) return { ok: false, error: 'Missing staff or date.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = logSheet_();
    var head = headerOf_(sh);
    var idx = colMap_(sh);
    var now = new Date();

    // Find this person's row for this day.
    var targetRow = 0, revision = 0, firstStamp = now;
    if (sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = 0; i < vals.length; i++) {
        var sid = String(vals[i][idx['StaffId']] || '').trim() ||
                  staffIdFor_(vals[i][idx['Name']]);
        if (sid === staffId && isoDay_(vals[i][idx['Date']]) === date) {
          targetRow = i + 2;
          revision = Number(vals[i][idx['Revision']]) || 0;
          firstStamp = vals[i][idx['Timestamp']] || now;
          break;                                   // first match is the keeper
        }
      }
    }

    var b = payload.blocks || {};
    var vals2 = {
      Timestamp: firstStamp,
      Date: date,
      StaffId: staffId,
      Name: payload.name || profile.name,
      Grade: payload.grade || '',
      Status: payload.submitted ? 'Submitted' : 'Draft',
      Closed: numOrBlank_(payload.metrics && payload.metrics.closed),
      Overdue: numOrBlank_(payload.metrics && payload.metrics.overdue),
      Aged60: numOrBlank_(payload.metrics && payload.metrics.aged60),
      ValueAdded: payload.valueAdded || '',
      Innovation: payload.innovation || '',
      SystemFlags: payload.systemFlags || '',
      Notes: payload.notes || '',
      UpdatedAt: now,
      Revision: revision + 1
    };
    BLOCK_IDS.forEach(function (p) {
      var d = b[blockKey_(p)] || {};
      vals2[p] = d.kpi || '';
      vals2[p + '_Actioned'] = d.actioned || '';
      vals2[p + '_Resolved'] = d.resolved || '';
      vals2[p + '_Open'] = d.openOwned || '';
      vals2[p + '_Blocker'] = joinBlocker_(d.blocker, d.blockerOwner);
    });

    var row = head.map(function (h) { return (h in vals2) ? vals2[h] : ''; });
    if (targetRow) sh.getRange(targetRow, 1, 1, head.length).setValues([row]);
    else sh.appendRow(row);

    saveTraining_(staffId, date, vals2.Name, b, now);
    return { ok: true, upserted: !!targetRow, revision: vals2.Revision };
  } finally {
    lock.releaseLock();
  }
}

/** Client block ids are kpi1/kpi2/pm1/pm2; columns are KPI1/KPI2/PM1/PM2. */
function blockKey_(p) { return p.toLowerCase(); }

function numOrBlank_(v) {
  if (v === '' || v == null) return '';
  var n = Number(v);
  return isNaN(n) ? '' : n;
}

function joinBlocker_(blocker, owner) {
  var b = String(blocker || '').trim(), o = String(owner || '').trim();
  if (b && o) return b + ' · ' + o;
  return b || o;
}

/** Training is one row per session in its own register, so "who trained whom
 *  on what" is a list you can read, not something buried across 28 columns.
 *  A re-save replaces that person's rows for that day rather than piling up. */
function saveTraining_(staffId, date, trainer, blocks, now) {
  var sh = trainingSheet_();
  var head = headerOf_(sh);
  var idx = colMap_(sh);

  if (sh.getLastRow() > 1) {
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (String(vals[i][idx['StaffId']] || '').trim() === staffId &&
          isoDay_(vals[i][idx['TrainingDate']]) === date) {
        sh.deleteRow(i + 2);
      }
    }
  }

  BLOCK_IDS.forEach(function (p) {
    var d = blocks[blockKey_(p)] || {};
    var any = d.tr_trainee || d.tr_topic || d.tr_objectives || d.tr_achieved ||
              d.tr_test || d.tr_result || d.tr_followup;
    if (d.kpi !== 'Training delivered' && !any) return;
    if (!any) return;
    var o = {
      TrainingDate: date, StaffId: staffId, Trainer: trainer, Block: p,
      Trainee: d.tr_trainee || '', Topic: d.tr_topic || '',
      Objectives: d.tr_objectives || '', Achieved: d.tr_achieved || '',
      Test: d.tr_test || '', Result: d.tr_result || '',
      Followup: d.tr_followup || '', LoggedAt: now
    };
    sh.appendRow(head.map(function (h) { return (h in o) ? o[h] : ''; }));
  });
}

// ---------------------------------------------------------------------------
//  Maintenance: collapse the duplicates already in the sheet
//  Run once from the editor. Keeps the newest row for each person and day.
// ---------------------------------------------------------------------------

function dedupeLog() {
  var sh = logSheet_();
  if (sh.getLastRow() < 3) return 'Nothing to do.';
  var idx = colMap_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  var keep = {};
  vals.forEach(function (r, i) {
    var sid = String(r[idx['StaffId']] || '').trim() || staffIdFor_(r[idx['Name']]);
    var k = sid + '|' + isoDay_(r[idx['Date']]);
    var stamp = new Date(r[idx['UpdatedAt']] || r[idx['Timestamp']] || 0).getTime() || 0;
    // Later timestamp wins; on a tie the lower row loses, so the last one stands.
    if (!keep[k] || stamp >= keep[k].stamp) keep[k] = { row: i + 2, stamp: stamp };
  });

  var survivors = {};
  Object.keys(keep).forEach(function (k) { survivors[keep[k].row] = true; });

  var removed = 0;
  for (var r = sh.getLastRow(); r >= 2; r--) {
    if (!survivors[r]) { sh.deleteRow(r); removed++; }
  }
  return 'Removed ' + removed + ' duplicate row(s); ' +
         Object.keys(keep).length + ' entries remain.';
}

// ---------------------------------------------------------------------------
//  Reporting
// ---------------------------------------------------------------------------

function n_(v) {
  if (v === '' || v == null) return null;
  var x = Number(v);
  return isNaN(x) ? null : x;
}

function hasText_(v) { return !!String(v == null ? '' : v).trim(); }

function isRealValueAdd_(v) {
  var s = String(v || '').trim().toLowerCase();
  return !!s && s !== 'none today' && s !== 'none' && s !== 'n/a' && s !== 'na' && s !== '-';
}

function blocksDone_(e) {
  var n = 0;
  BLOCK_IDS.forEach(function (p) { if (hasText_(e[p]) || hasText_(e[p + '_Actioned'])) n++; });
  return n;
}

/** Training sessions in a set of days. The register only fills from now on,
 *  so count the blocks logged as "Training delivered" — that is the record
 *  that goes back to June. */
function countTraining_(rows) {
  var n = 0;
  rows.forEach(function (e) {
    BLOCK_IDS.forEach(function (p) {
      if (String(e[p] || '').trim() === 'Training delivered') n++;
    });
  });
  return n;
}

function openBlockers_(e) {
  var out = [];
  BLOCK_IDS.forEach(function (p) {
    if (hasText_(e[p + '_Blocker'])) {
      out.push({ block: p, kpi: e[p] || '', text: String(e[p + '_Blocker']) });
    }
  });
  return out;
}

/** The 3pm cut. Blocks 1-3 are done by then; the last block is not, so it is
 *  reported as outstanding rather than as a gap. */
function checkpointReport_(date) {
  var day = date || todayISO_();
  var people = publicRoster_().filter(function (p) { return !p.manager; });
  var byId = {};
  latestEntries_().forEach(function (e) { if (e.Date === day) byId[e.StaffId] = e; });

  var lines = people.map(function (p) {
    var e = byId[p.staffId];
    var done = e ? blocksDone_(e) : 0;
    return {
      staffId: p.staffId, name: p.name, unit: p.unit,
      status: !e ? 'No entry' : (String(e.Status) === 'Submitted' ? 'Submitted' : 'Draft'),
      blocksDone: done,
      onTrack: done >= 3,
      closed: e ? n_(e.Closed) : null,
      overdue: e ? n_(e.Overdue) : null,
      aged60: e ? n_(e.Aged60) : null,
      valueAdded: e && isRealValueAdd_(e.ValueAdded) ? String(e.ValueAdded) : '',
      innovation: e && hasText_(e.Innovation) ? String(e.Innovation) : '',
      systemFlags: e && hasText_(e.SystemFlags) ? String(e.SystemFlags) : '',
      notes: e && hasText_(e.Notes) ? String(e.Notes) : '',
      blockers: e ? openBlockers_(e) : [],
      updatedAt: e && e.UpdatedAt ? Utilities.formatDate(new Date(e.UpdatedAt), CONFIG.TZ, 'HH:mm') : ''
    };
  });

  var tot = { closed: 0, overdue: 0, aged60: 0 };
  lines.forEach(function (l) {
    tot.closed += l.closed || 0; tot.overdue += l.overdue || 0; tot.aged60 += l.aged60 || 0;
  });

  return {
    date: day,
    cutHour: CONFIG.CHECKPOINT_HOUR,
    headcount: people.length,
    reported: lines.filter(function (l) { return l.status !== 'No entry'; }).length,
    submitted: lines.filter(function (l) { return l.status === 'Submitted'; }).length,
    silent: lines.filter(function (l) { return l.status === 'No entry'; })
                 .map(function (l) { return l.name; }),
    behind: lines.filter(function (l) { return l.status !== 'No entry' && !l.onTrack; })
                 .map(function (l) { return l.name; }),
    totals: tot,
    lines: lines
  };
}

/** Training sessions with their detail. The register only holds sessions
 *  logged since it was added, so anything older is rebuilt from the block it
 *  was recorded in — otherwise the list reads "nothing logged" underneath a
 *  count that says three. */
function trainingDetail_(rows, register, days) {
  var out = [], seen = {};
  register.filter(function (tr) { return days.indexOf(tr.TrainingDate) > -1; })
    .forEach(function (tr) {
      seen[tr.StaffId + '|' + tr.TrainingDate + '|' + tr.Block] = true;
      out.push({ date: tr.TrainingDate, trainer: tr.Trainer, trainee: tr.Trainee,
                 topic: tr.Topic, test: tr.Test, result: tr.Result,
                 followup: tr.Followup, fromRegister: true });
    });
  rows.forEach(function (e) {
    BLOCK_IDS.forEach(function (p) {
      if (String(e[p] || '').trim() !== 'Training delivered') return;
      if (seen[e.StaffId + '|' + e.Date + '|' + p]) return;
      out.push({ date: e.Date, trainer: e.Name, trainee: '',
                 topic: String(e[p + '_Actioned'] || '').trim(),
                 achieved: String(e[p + '_Resolved'] || '').trim(),
                 test: '', result: '', followup: '', fromRegister: false });
    });
  });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

/** The week, Monday to Friday, with last week alongside it for direction. */
function weeklyReport_(anyDateInWeek) {
  var monday = weekStart_(anyDateInWeek || todayISO_());
  var days = weekDays_(monday);
  var prevDays = weekDays_(shiftDays_(monday, -7));
  var entries = latestEntries_();
  var training = trainingRows_();
  var people = publicRoster_().filter(function (p) { return !p.manager; });

  function slice(dayList) {
    var set = {};
    dayList.forEach(function (d) { set[d] = true; });
    return entries.filter(function (e) { return set[e.Date]; });
  }

  function totals(rows) {
    var t = { closed: 0, overdue: 0, aged60: 0, daysLogged: 0, submitted: 0,
              valueAdds: 0, ideas: 0, blockers: 0, flags: 0, training: 0 };
    rows.forEach(function (e) {
      t.daysLogged++;
      if (String(e.Status) === 'Submitted') t.submitted++;
      t.closed += n_(e.Closed) || 0;
      t.overdue += n_(e.Overdue) || 0;
      t.aged60 += n_(e.Aged60) || 0;
      if (isRealValueAdd_(e.ValueAdded)) t.valueAdds++;
      if (hasText_(e.Innovation) && isRealValueAdd_(e.Innovation)) t.ideas++;
      t.blockers += openBlockers_(e).length;
      if (hasText_(e.SystemFlags)) t.flags++;
      t.training += countTraining_([e]);
    });
    return t;
  }

  var thisRows = slice(days), prevRows = slice(prevDays);
  var thisTot = totals(thisRows), prevTot = totals(prevRows);

  // Per person
  var perPerson = people.map(function (p) {
    var mine = thisRows.filter(function (e) { return e.StaffId === p.staffId; });
    var prev = prevRows.filter(function (e) { return e.StaffId === p.staffId; });
    var t = totals(mine), pt = totals(prev);
    var byDay = days.map(function (d) {
      var e = mine.filter(function (x) { return x.Date === d; })[0];
      return {
        date: d,
        status: !e ? 'none' : (String(e.Status) === 'Submitted' ? 'submitted' : 'draft'),
        closed: e ? n_(e.Closed) : null,
        overdue: e ? n_(e.Overdue) : null,
        blocks: e ? blocksDone_(e) : 0
      };
    });
    return {
      staffId: p.staffId, name: p.name, unit: p.unit,
      totals: t, prevTotals: pt, byDay: byDay,
      trainingSessions: countTraining_(mine)
    };
  });

  // What the week actually produced, in his words not mine
  function harvest(field, test) {
    var out = [];
    thisRows.forEach(function (e) {
      if (test(e[field])) {
        out.push({ name: e.Name, staffId: e.StaffId, date: e.Date, text: String(e[field]).trim() });
      }
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  var kpiMix = {};
  thisRows.forEach(function (e) {
    BLOCK_IDS.forEach(function (p) {
      var k = String(e[p] || '').trim();
      if (k) kpiMix[k] = (kpiMix[k] || 0) + 1;
    });
  });
  var mix = Object.keys(kpiMix).map(function (k) { return { kpi: k, count: kpiMix[k] }; })
    .sort(function (a, b) { return b.count - a.count; });

  var blockers = [];
  thisRows.forEach(function (e) {
    openBlockers_(e).forEach(function (b) {
      blockers.push({ name: e.Name, date: e.Date, kpi: b.kpi, text: b.text });
    });
  });

  return {
    weekStart: monday,
    weekEnd: days[days.length - 1],
    days: days,
    headcount: people.length,
    expectedReports: people.length * days.length,
    totals: thisTot,
    prevTotals: prevTot,
    perPerson: perPerson,
    kpiMix: mix,
    valueAdds: harvest('ValueAdded', isRealValueAdd_),
    innovations: harvest('Innovation', isRealValueAdd_),
    systemFlags: harvest('SystemFlags', hasText_),
    blockers: blockers,
    training: trainingDetail_(thisRows, training, days)
  };
}

// ---------------------------------------------------------------------------
//  Web endpoints
// ---------------------------------------------------------------------------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    return json_(handle_(p.action || 'rows', p, p.token));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  try {
    return json_(handle_(body.action || 'save', body, body.token));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function handle_(action, data, token) {
  if (action === 'ping') return { ok: true, today: todayISO_() };
  if (action === 'login') return login_(data.who || data.email, data.password);

  var profile = readToken_(token);
  if (!profile) return { ok: false, error: 'Session expired. Sign in again.', authRequired: true };

  switch (action) {
    case 'me':
      return { ok: true, profile: profile, roster: publicRoster_() };

    case 'rows': {
      // Staff see their own days. The manager sees the branch.
      var rows = latestEntries_();
      if (!profile.manager) {
        rows = rows.filter(function (r) { return r.StaffId === profile.staffId; });
      }
      rows.forEach(function (r) {
        delete r._row;
        if (r.UpdatedAt) r.UpdatedAt = String(r.UpdatedAt);
        if (r.Timestamp) r.Timestamp = String(r.Timestamp);
      });
      var tr = trainingRows_();
      if (!profile.manager) {
        tr = tr.filter(function (t) { return t.StaffId === profile.staffId; });
      }
      tr.forEach(function (t) { if (t.LoggedAt) t.LoggedAt = String(t.LoggedAt); });
      return { ok: true, rows: rows, training: tr, profile: profile, roster: publicRoster_() };
    }

    case 'training': {
      var tr = trainingRows_();
      if (!profile.manager) {
        tr = tr.filter(function (t) { return t.StaffId === profile.staffId; });
      }
      tr.forEach(function (t) { if (t.LoggedAt) t.LoggedAt = String(t.LoggedAt); });
      return { ok: true, training: tr };
    }

    case 'checkpoint':
      if (!profile.manager) return { ok: false, error: 'Branch Manager only.' };
      return { ok: true, report: checkpointReport_(data.date) };

    case 'weekly':
      if (!profile.manager) return { ok: false, error: 'Branch Manager only.' };
      return { ok: true, report: weeklyReport_(data.date) };

    case 'save':
      return saveEntry_(data, profile);

    default:
      return { ok: false, error: 'Unknown action: ' + action };
  }
}

// ---------------------------------------------------------------------------
//  Email reports
//  The 3pm checkpoint lands while there is still a working hour left to use it.
//  The weekly summary lands Friday evening.
// ---------------------------------------------------------------------------

var MAIL = {
  navy: '#16264F', deep: '#0D1838', gold: '#C7A34A', soft: '#E7D9AE',
  ink: '#1F2433', muted: '#6A7180', line: '#E5E1D6', paper: '#F7F5EF',
  green: '#2C7A57', amber: '#B0791C', red: '#AE3A33'
};

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function prettyDate_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return Utilities.formatDate(d, 'UTC', 'EEEE d MMMM yyyy');
}

function shortDate_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return Utilities.formatDate(d, 'UTC', 'EEE d MMM');
}

function shell_(title, sub, inner) {
  return '' +
  '<div style="margin:0;padding:0;background:' + MAIL.paper + ';font-family:Segoe UI,Helvetica,Arial,sans-serif;color:' + MAIL.ink + '">' +
    '<div style="max-width:660px;margin:0 auto;background:' + MAIL.paper + '">' +
      '<div style="background:' + MAIL.navy + ';border-bottom:3px solid ' + MAIL.gold + ';padding:22px 24px">' +
        '<div style="color:' + MAIL.soft + ';font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">Guardian Life</div>' +
        '<div style="color:#fff;font-size:15px;font-weight:800;margin-top:2px">Ricky Rampersad\'s Branch</div>' +
        '<div style="color:#fff;font-size:21px;font-weight:800;margin-top:14px">' + esc_(title) + '</div>' +
        '<div style="color:' + MAIL.soft + ';font-size:13px;margin-top:3px">' + esc_(sub) + '</div>' +
      '</div>' +
      '<div style="padding:20px 24px 34px">' + inner + '</div>' +
      '<div style="padding:0 24px 26px;color:' + MAIL.muted + ';font-size:11px">' +
        '9–13 Endeavour 1st Street, Chaguanas · generated automatically from the Daily KPI &amp; Innovation Tracker' +
      '</div>' +
    '</div>' +
  '</div>';
}

function statTiles_(tiles) {
  var cells = tiles.map(function (t) {
    return '<td style="width:' + Math.floor(100 / tiles.length) + '%;background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:13px 8px;text-align:center">' +
      '<div style="font-size:23px;font-weight:800;line-height:1;color:' + (t.color || MAIL.navy) + '">' + esc_(t.value) + '</div>' +
      '<div style="font-size:10.5px;color:' + MAIL.muted + ';font-weight:600;margin-top:5px">' + esc_(t.label) + '</div>' +
    '</td>';
  }).join('<td style="width:8px"></td>');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px"><tr>' + cells + '</tr></table>';
}

function sectionLabel_(text) {
  return '<div style="margin:24px 0 10px;font-size:11px;font-weight:800;letter-spacing:1.1px;' +
    'text-transform:uppercase;color:' + MAIL.navy + ';border-bottom:1px solid ' + MAIL.gold + ';padding-bottom:6px">' +
    esc_(text) + '</div>';
}

function bullets_(items, accent) {
  if (!items.length) {
    return '<div style="font-size:13px;color:' + MAIL.muted + '">Nothing logged.</div>';
  }
  return items.map(function (it) {
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (accent || MAIL.gold) + ';border-radius:9px;padding:11px 13px;margin-bottom:8px">' +
      '<div style="font-size:11.5px;font-weight:700;color:' + MAIL.navy + '">' + esc_(it.head) + '</div>' +
      '<div style="font-size:13px;line-height:1.5;margin-top:3px">' + esc_(it.body) + '</div>' +
    '</div>';
  }).join('');
}

// ---- 3pm checkpoint -------------------------------------------------------

function checkpointHtml_(r) {
  var tiles = statTiles_([
    { label: 'Reported', value: r.reported + '/' + r.headcount,
      color: r.reported === r.headcount ? MAIL.green : MAIL.amber },
    { label: 'Closed', value: r.totals.closed, color: MAIL.green },
    { label: 'Overdue', value: r.totals.overdue, color: r.totals.overdue > 0 ? MAIL.amber : MAIL.green },
    { label: '60+ days', value: r.totals.aged60, color: r.totals.aged60 > 0 ? MAIL.red : MAIL.green }
  ]);

  var chase = '';
  if (r.silent.length || r.behind.length) {
    var parts = [];
    if (r.silent.length) parts.push('<b>Nothing logged yet:</b> ' + esc_(r.silent.join(', ')));
    if (r.behind.length) parts.push('<b>Behind on blocks:</b> ' + esc_(r.behind.join(', ')));
    chase = '<div style="background:#FBE9E7;border:1px solid ' + MAIL.red + ';border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;color:#7A2A24;margin-bottom:6px">' +
      'To chase before close of business —<br>' + parts.join('<br>') + '</div>';
  } else {
    chase = '<div style="background:#E9F3EE;border:1px solid ' + MAIL.green + ';border-radius:10px;padding:12px 14px;font-size:13px;color:#1E5B40;margin-bottom:6px">' +
      'Everyone has logged and is on track at the 3pm cut.</div>';
  }

  var rowsHtml = r.lines.map(function (l) {
    var tone = l.status === 'No entry' ? MAIL.red : (l.status === 'Submitted' ? MAIL.green : MAIL.amber);
    var detail = [];
    l.blockers.forEach(function (b) {
      detail.push('<div style="font-size:12px;color:' + MAIL.red + ';margin-top:4px"><b>Blocked' +
        (b.kpi ? ' · ' + esc_(b.kpi) : '') + ':</b> ' + esc_(b.text) + '</div>');
    });
    if (l.systemFlags) {
      detail.push('<div style="font-size:12px;color:' + MAIL.red + ';margin-top:3px"><b>Flag:</b> ' + esc_(l.systemFlags) + '</div>');
    }
    if (l.notes) {
      detail.push('<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:3px"><b>Note:</b> ' + esc_(l.notes) + '</div>');
    }
    if (l.valueAdded) {
      detail.push('<div style="font-size:12px;margin-top:3px"><b style="color:' + MAIL.gold + '">Value added:</b> ' + esc_(l.valueAdded) + '</div>');
    }
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:12px 14px;margin-bottom:9px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="font-size:14px;font-weight:700">' + esc_(l.name) +
          '<span style="font-size:11px;color:' + MAIL.muted + ';font-weight:600"> · ' + l.blocksDone + '/4 blocks' +
          (l.updatedAt ? ' · last saved ' + esc_(l.updatedAt) : '') + '</span></td>' +
        '<td align="right" style="font-size:11px;font-weight:700;color:' + tone + '">' + esc_(l.status) + '</td>' +
      '</tr></table>' +
      '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:5px">' +
        'Closed ' + (l.closed == null ? '—' : l.closed) +
        ' · Overdue ' + (l.overdue == null ? '—' : l.overdue) +
        ' · 60+ ' + (l.aged60 == null ? '—' : l.aged60) + '</div>' +
      detail.join('') +
    '</div>';
  }).join('');

  return shell_('3pm Checkpoint', prettyDate_(r.date),
    tiles + chase + sectionLabel_('Where each person stands') + rowsHtml);
}

function sendCheckpoint(dateOpt) {
  var r = checkpointReport_(dateOpt);
  var to = managerEmails_();
  if (!to.length) throw new Error('No manager email configured.');
  MailApp.sendEmail({
    to: to.join(','),
    subject: 'RRB 3pm Checkpoint · ' + shortDate_(r.date) + ' · ' +
             r.reported + '/' + r.headcount + ' logged',
    htmlBody: checkpointHtml_(r)
  });
  return 'Sent to ' + to.join(', ');
}

// ---- weekly summary -------------------------------------------------------

/** A delta is only worth showing when there is a week behind it to compare
 *  against. With nothing logged last week, "▲ 69 vs last week" says nothing. */
function delta_(now, was, comparable) {
  if (!comparable) return '';
  var d = (now || 0) - (was || 0);
  if (!was && !now) return '';
  var arrow = d > 0 ? '▲' : (d < 0 ? '▼' : '—');
  var col = d === 0 ? MAIL.muted : MAIL.ink;
  return '<span style="font-size:10.5px;color:' + col + ';font-weight:600"> ' + arrow +
         (d === 0 ? '' : ' ' + Math.abs(d)) + ' vs last week</span>';
}

function weeklyHtml_(r) {
  var t = r.totals, p = r.prevTotals;
  var coverage = r.expectedReports ? Math.round((t.daysLogged / r.expectedReports) * 100) : 0;

  var tiles = statTiles_([
    { label: 'Reports in', value: t.daysLogged + '/' + r.expectedReports,
      color: coverage >= 90 ? MAIL.green : coverage >= 70 ? MAIL.amber : MAIL.red },
    { label: 'Closed', value: t.closed, color: MAIL.green },
    { label: 'Value adds', value: t.valueAdds, color: MAIL.gold },
    { label: 'Ideas', value: t.ideas, color: MAIL.navy }
  ]);

  var comparable = p.daysLogged > 0;
  var movement =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;margin-bottom:6px">' +
    [['Tasks closed', t.closed, p.closed],
     ['Overdue at week end', t.overdue, p.overdue],
     ['Aged 60+ days', t.aged60, p.aged60],
     ['Value added logged', t.valueAdds, p.valueAdds],
     ['Ideas logged', t.ideas, p.ideas],
     ['Training delivered', t.training, p.training],
     ['Blockers raised', t.blockers, p.blockers]
    ].map(function (row, i) {
      return '<tr>' +
        '<td style="padding:9px 14px;font-size:13px;' + (i ? 'border-top:1px solid ' + MAIL.line : '') + '">' + esc_(row[0]) + '</td>' +
        '<td align="right" style="padding:9px 14px;font-size:14px;font-weight:800;' + (i ? 'border-top:1px solid ' + MAIL.line : '') + '">' +
          row[1] + delta_(row[1], row[2], comparable) + '</td>' +
      '</tr>';
    }).join('') + '</table>';

  // Per person, with the week's shape at a glance
  var people = r.perPerson.map(function (pp) {
    var strip = pp.byDay.map(function (d) {
      var bg = d.status === 'submitted' ? MAIL.green : d.status === 'draft' ? MAIL.amber : '#E4E0D6';
      return '<td align="center" style="padding:0 3px">' +
        '<div style="background:' + bg + ';border-radius:5px;height:26px;line-height:26px;color:' +
          (d.status === 'none' ? MAIL.muted : '#fff') + ';font-size:11px;font-weight:700">' +
          (d.status === 'none' ? '–' : d.blocks + '/4') + '</div>' +
        '<div style="font-size:9px;color:' + MAIL.muted + ';margin-top:3px">' +
          shortDate_(d.date).slice(0, 3) + '</div></td>';
    }).join('');
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:12px 14px;margin-bottom:9px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="font-size:14px;font-weight:700">' + esc_(pp.name) + '</td>' +
        '<td align="right" style="font-size:11.5px;color:' + MAIL.muted + '">' +
          pp.totals.daysLogged + '/5 days · ' + pp.totals.closed + ' closed' +
          (pp.trainingSessions ? ' · ' + pp.trainingSessions + ' training' : '') + '</td>' +
      '</tr></table>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:9px"><tr>' + strip + '</tr></table>' +
    '</div>';
  }).join('');

  var mix = r.kpiMix.slice(0, 8);
  var maxMix = mix.length ? mix[0].count : 1;
  var mixHtml = mix.length ? mix.map(function (m) {
    var w = Math.max(4, Math.round((m.count / maxMix) * 100));
    return '<div style="margin-bottom:7px">' +
      '<div style="font-size:12px;display:block">' + esc_(m.kpi) +
        '<span style="color:' + MAIL.muted + ';font-weight:700"> · ' + m.count + '</span></div>' +
      '<div style="background:#EDE9DE;border-radius:4px;height:7px;margin-top:3px">' +
        '<div style="background:' + MAIL.navy + ';width:' + w + '%;height:7px;border-radius:4px"></div></div>' +
    '</div>';
  }).join('') : '<div style="font-size:13px;color:' + MAIL.muted + '">No KPI blocks logged.</div>';

  var inner =
    tiles +
    sectionLabel_('Movement on last week') +
      (comparable ? '' :
        '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin-bottom:8px">' +
        'Nothing was logged the week before, so there is nothing to compare against.</div>') +
      movement +
    sectionLabel_('The week, person by person') + people +
    sectionLabel_('Where the time went') + mixHtml +
    sectionLabel_('Value added') +
      bullets_(r.valueAdds.map(function (v) {
        return { head: v.name + ' · ' + shortDate_(v.date), body: v.text };
      }), MAIL.gold) +
    sectionLabel_('Innovations & ideas') +
      bullets_(r.innovations.map(function (v) {
        return { head: v.name + ' · ' + shortDate_(v.date), body: v.text };
      }), MAIL.navy) +
    sectionLabel_('Training delivered') +
      bullets_(r.training.map(function (tr) {
        var body = (tr.topic || '') +
          (tr.achieved ? ' · ' + tr.achieved : '') +
          (tr.test ? ' · Test: ' + tr.test + (tr.result ? ' (' + tr.result + ')' : '') : '') +
          (tr.followup ? ' · Next: ' + tr.followup : '');
        var head = tr.trainee
          ? (tr.trainer || '?') + ' → ' + tr.trainee + ' · ' + shortDate_(tr.date)
          : (tr.trainer || '?') + ' · ' + shortDate_(tr.date);
        return { head: head, body: body || '—' };
      }), MAIL.green) +
    sectionLabel_('Blockers raised') +
      bullets_(r.blockers.map(function (b) {
        return { head: b.name + ' · ' + shortDate_(b.date) + (b.kpi ? ' · ' + b.kpi : ''), body: b.text };
      }), MAIL.red) +
    sectionLabel_('System flags') +
      bullets_(r.systemFlags.map(function (f) {
        return { head: f.name + ' · ' + shortDate_(f.date), body: f.text };
      }), MAIL.red);

  return shell_('Weekly Summary', shortDate_(r.weekStart) + ' – ' + shortDate_(r.weekEnd), inner);
}

function sendWeekly(dateOpt) {
  var r = weeklyReport_(dateOpt);
  var to = managerEmails_();
  if (!to.length) throw new Error('No manager email configured.');
  MailApp.sendEmail({
    to: to.join(','),
    subject: 'RRB Weekly Summary · ' + shortDate_(r.weekStart) + ' – ' + shortDate_(r.weekEnd) +
             ' · ' + r.totals.closed + ' closed, ' + r.totals.valueAdds + ' value adds',
    htmlBody: weeklyHtml_(r)
  });
  return 'Sent to ' + to.join(', ');
}

// ---- triggers -------------------------------------------------------------

/** Run once from the editor. Safe to re-run: it clears its own triggers first. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'sendCheckpoint' || fn === 'sendWeekly') ScriptApp.deleteTrigger(t);
  });

  // 3pm checkpoint, Monday to Friday. Apps Script fires within the hour, so
  // the mail lands between 3 and 4 — while the last block is still running.
  ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].forEach(function (d) {
    ScriptApp.newTrigger('sendCheckpoint').timeBased()
      .onWeekDay(ScriptApp.WeekDay[d]).atHour(CONFIG.CHECKPOINT_HOUR).create();
  });

  // Weekly summary, Friday evening once the day is in.
  ScriptApp.newTrigger('sendWeekly').timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(17).create();

  return 'Triggers installed. Checkpoint weekdays at ' + CONFIG.CHECKPOINT_HOUR +
         ':00, weekly summary Friday 17:00 (' + CONFIG.TZ + ').';
}

/** Preview either report in the editor without emailing anyone. */
function previewCheckpoint() { Logger.log(checkpointHtml_(checkpointReport_())); }
function previewWeekly() { Logger.log(weeklyHtml_(weeklyReport_())); }
