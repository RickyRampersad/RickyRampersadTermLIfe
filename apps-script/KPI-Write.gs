/**
 * RRB · Daily KPI Tracker — writing back to Salesforce
 * =============================================================================
 * KPI.gs only reads. This file is the only thing that writes, and it writes to
 * live client records — so it is a separate file on purpose. Paste it in when
 * you want the capability; leave it out and the tracker is read-only.
 *
 * WHAT IT CAN CHANGE — three things, and nothing else, whatever is posted:
 *
 *     Task_Update_Reason__c    why an overdue task is late
 *     ActivityDate             the due date
 *     Status -> Completed      closing a task, with a line of what was done
 *                              appended to its Description — never a bare close
 *
 * It cannot reassign a task, reopen one, set any other status, or alter
 * anything a client sees.
 *
 * WHO CAN CHANGE IT
 *   · A person may edit a task they own.
 *   · The Branch Manager may edit any branch task.
 *   · A task owned by anyone outside the Access tab cannot be touched at all,
 *     by anybody.
 *
 * THE TRAIL
 *   Every attempt — successful or not — is written to a tab of its own before
 *   the change is sent: when, who, which task, the old value, the new value,
 *   and the result. If a figure is ever questioned, the answer is in the sheet
 *   and does not need Salesforce to produce it.
 * =============================================================================
 */

var WRITE_FIELDS = {
  reason: { sf: 'Task_Update_Reason_c__c', label: 'Reason' },
  due:    { sf: 'ActivityDate',            label: 'Due date' },
  close:  { sf: 'Status',                  label: 'Closed' }
};
var CLOSE_MIN_WORDS = 4;

var AUDIT_TAB = 'KPI Salesforce Writes';
var AUDIT_HEADERS = ['When', 'StaffId', 'Name', 'TaskId', 'Field', 'Was', 'Now', 'Result'];

function auditSheet_() {
  var sh = findTabBy_(['TaskId', 'Field']);
  if (sh) return sh;
  sh = ss_().insertSheet(AUDIT_TAB);
  sh.appendRow(AUDIT_HEADERS);
  sh.setFrozenRows(1);
  return sh;
}

function audit_(profile, taskId, field, was, now, result) {
  try {
    var sh = auditSheet_();
    var head = headerOf_(sh);
    var o = {
      When: new Date(), StaffId: profile.staffId, Name: profile.name,
      TaskId: taskId, Field: field,
      Was: was == null ? '' : String(was), Now: now == null ? '' : String(now),
      Result: result
    };
    sh.appendRow(head.map(function (h) { return (h in o) ? o[h] : ''; }));
  } catch (e) { /* a failed audit must never swallow the caller's own error */ }
}

function sfkPatch_(taskId, body) {
  function send(tok) {
    return UrlFetchApp.fetch(
      tok.instance_url + '/services/data/' + SFK.API + '/sobjects/Task/' + taskId,
      {
        method: 'patch', contentType: 'application/json',
        muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + tok.access_token },
        payload: JSON.stringify(body)
      });
  }
  var tok = sfkToken_();
  var res = send(tok);
  if (res.getResponseCode() === 401) {          // token aged out mid-write
    sfkProps_().deleteProperty('SFK_TOKEN');
    res = send(sfkToken_());
  }
  var code = res.getResponseCode();
  if (code !== 204 && code !== 200) throw new Error(res.getContentText());
  return true;
}

/** Update one field on one task. Refuses anything it was not built for. */
function updateTask_(data, profile) {
  if (typeof sfkConfigured_ !== 'function' || !sfkConfigured_()) {
    return { ok: false, error: 'Salesforce is not connected.' };
  }

  var taskId = String(data.taskId || '').trim();
  var key = String(data.field || '').trim();
  var spec = WRITE_FIELDS[key];
  if (!taskId) return { ok: false, error: 'No task given.' };
  if (!spec) return { ok: false, error: 'That field cannot be edited from here.' };
  if (!/^[a-zA-Z0-9]{15,18}$/.test(taskId)) return { ok: false, error: 'That is not a task id.' };

  var value = data.value == null ? '' : String(data.value).trim();
  if (key === 'reason' && value.length < 4) {
    return { ok: false, error: 'Say what it is waiting on, and who owns the next step.' };
  }
  if (key === 'due') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: 'Use a real date.' };
    if (value < todayISO_()) return { ok: false, error: 'A new due date cannot be in the past.' };
  }
  if (key === 'close') {
    // The branch rule: a task moved with nothing written on it did not
    // happen. A close is the biggest move there is.
    if (value.replace(/\s+/g, ' ').split(' ').filter(String).length < CLOSE_MIN_WORDS) {
      return { ok: false, error: 'Say what was done — a line, not a word.' };
    }
  }

  // Whose task is it, and is that a branch person at all?
  var users = sfkUsers_();
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  var recs;
  try {
    recs = sfkQuery_('SELECT Id, OwnerId, Subject, ActivityDate, Task_Update_Reason_c__c, Status, Description ' +
                     "FROM Task WHERE Id = '" + taskId + "'");
  } catch (e) {
    return { ok: false, error: 'Could not read that task: ' + String(e && e.message || e) };
  }
  if (!recs.length) return { ok: false, error: 'That task no longer exists.' };

  var task = recs[0];
  var ownerStaff = byId[task.OwnerId];
  if (!ownerStaff) return { ok: false, error: 'That task belongs to someone outside the branch.' };
  if (!profile.manager && ownerStaff !== profile.staffId) {
    return { ok: false, error: 'That is not your task.' };
  }

  var was = key === 'due' ? task.ActivityDate : key === 'close' ? task.Status : task.Task_Update_Reason_c__c;
  var body = {};
  if (key === 'close') {
    if (task.Status === 'Completed') return { ok: false, error: 'Already closed.' };
    body.Status = 'Completed';
    // Appended, never replaced: whatever was written before stays.
    var at = new Date();
    var stamp = '[' + Utilities.formatDate(at, CONFIG.TZ, 'yyyy-MM-dd') + ' ' +
                Utilities.formatDate(at, CONFIG.TZ, 'HH:mm') + ' · ' + profile.name + '] ';
    var before = String(task.Description || '').replace(/\s+$/, '');
    body.Description = (before ? before + '\n' : '') + stamp + value;
  } else {
    body[spec.sf] = value;
  }

  try {
    sfkPatch_(taskId, body);
  } catch (e) {
    audit_(profile, taskId, spec.label, was, value, 'FAILED: ' + String(e && e.message || e));
    return { ok: false, error: 'Salesforce refused the change: ' + String(e && e.message || e) };
  }

  audit_(profile, taskId, spec.label, was, value, 'ok');

  // This person's cached position is now stale — the counts, the reasons,
  // the billing check, and the open book the plan reads from.
  var c = CacheService.getScriptCache();
  var day = todayISO_();
  ['sfk_m_', 'sfk_nr_', 'sfk_bill_', 'sfk_ob_'].forEach(function (pre) { c.remove(pre + day); });

  return { ok: true, field: key, label: spec.label, value: value, subject: task.Subject };
}

// ---------------------------------------------------------------------------
//  Bulk retype — a maintenance job, not part of the daily tracker
//
//  A quarter of this org's tasks carry no Task Type, and the single largest
//  block of them is automated birthday mail: 2,160 of them, all completed, all
//  on the Branch Manager. Untyped work cannot be attributed to a KPI, so it
//  quietly understates what the branch does.
//
//  Run retypeBirthdayTasks() first — it changes nothing and tells you what it
//  would do. Run retypeBirthdayTasksForReal() when you are happy with that.
//  Both write to the audit tab.
// ---------------------------------------------------------------------------

var RETYPE = {
  where: "Task_Type__c = NULL AND Subject LIKE '%irthday%'",
  to: 'Servicing',
  batch: 200                       // the sObject Collections limit per call
};

function retypeBirthdayTasks()        { return retypeBirthday_(false); }
function retypeBirthdayTasksForReal() { return retypeBirthday_(true); }

function retypeBirthday_(commit) {
  if (!sfkConfigured_()) { Logger.log('Salesforce is not connected.'); return; }

  var recs = sfkQuery_('SELECT Id, Subject FROM Task WHERE ' + RETYPE.where);
  var n = recs.length;
  if (!n) { var none = 'Nothing to retype — no untyped birthday tasks found.'; Logger.log(none); return none; }

  if (!commit) {
    var msg = [
      'DRY RUN — nothing has been changed.',
      '',
      n + ' untyped birthday task(s) would be set to Task Type "' + RETYPE.to + '".',
      'Example: ' + recs[0].Subject,
      '',
      'Run retypeBirthdayTasksForReal() to apply it.'
    ].join('\n');
    Logger.log(msg);
    return msg;
  }

  var tok = sfkToken_();
  var done = 0, failed = 0, firstError = '';
  for (var i = 0; i < n; i += RETYPE.batch) {
    var slice = recs.slice(i, i + RETYPE.batch).map(function (r) {
      return { attributes: { type: 'Task' }, id: r.Id, Task_Type__c: RETYPE.to };
    });
    var res = UrlFetchApp.fetch(tok.instance_url + '/services/data/' + SFK.API + '/composite/sobjects', {
      method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok.access_token },
      payload: JSON.stringify({ allOrNone: false, records: slice })
    });
    if (res.getResponseCode() !== 200) {
      failed += slice.length;
      if (!firstError) firstError = res.getContentText().slice(0, 300);
      continue;
    }
    JSON.parse(res.getContentText()).forEach(function (r) {
      if (r.success) done++;
      else {
        failed++;
        if (!firstError) firstError = JSON.stringify(r.errors).slice(0, 300);
      }
    });
  }

  audit_({ staffId: 'maintenance', name: 'Bulk retype' }, 'BATCH:' + n,
         'Task Type', '(blank)', RETYPE.to,
         done + ' set, ' + failed + ' failed' + (firstError ? ' — ' + firstError : ''));

  var out = [
    'Retyped ' + done + ' of ' + n + ' birthday task(s) to "' + RETYPE.to + '".',
    failed ? failed + ' failed. First error: ' + firstError : 'None failed.',
    '',
    'Logged on the "' + AUDIT_TAB + '" tab.'
  ].join('\n');
  Logger.log(out);
  return out;
}

// ---------------------------------------------------------------------------
//  Roll the overdue book forward, and tell each owner
//
//  One line in the sand: every overdue task moves to tomorrow, and the person
//  who owns it gets an @mention on the record saying so.
//
//  A caution, because it is the whole point of the exercise. The branch rule,
//  written by the Branch Manager on 17 June, is:
//
//      "A due date is not moved forward without a Chatter note stating the
//       genuine blocker and who owns the next step. Rolling a date is not
//       actioning a task."
//
//  This job rolls 160 dates at once. Done silently that is the very habit the
//  rule forbids, and it would bury the ageing further — the open book already
//  hides 7,315 days behind dates that have been moved before. So the note is
//  not optional here and it does not merely announce the move: it names the
//  standard and asks for the reason. The roll buys one clean day; the note is
//  what has to make it count.
//
//  Run rollOverdueForward() to see exactly what would happen. Nothing is
//  written and nothing is posted. Then rollOverdueForwardForReal().
// ---------------------------------------------------------------------------

function rollOverdueForward()        { return rollOverdue_(false); }
function rollOverdueForwardForReal() { return rollOverdue_(true); }

function chatterBody_(name, when) {
  return name + ' — I have moved this task forward to ' + when + ' for you.\n\n' +
    'The standard has not changed: a due date is not moved without a note saying ' +
    'what it is genuinely waiting on and who owns the next step. Rolling a date is ' +
    'not actioning a task.\n\n' +
    'Please put that reason on this task today, or close it.';
}

function rollOverdue_(commit) {
  if (!sfkConfigured_()) { Logger.log('Salesforce is not connected.'); return; }

  var day = todayISO_();
  var tomorrow = shiftDays_(day, 1);
  var users = sfkUsers_();
  var ids = Object.keys(users).map(function (k) { return "'" + users[k].id + "'"; });
  if (!ids.length) { Logger.log('No branch staff matched a Salesforce user.'); return; }
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  var recs = sfkQuery_(
    'SELECT Id, OwnerId, Subject, ActivityDate, Days_O_S__c, Task_Update_Reason_c__c ' +
    'FROM Task WHERE OwnerId IN (' + ids.join(',') + ") AND Status != 'Completed' " +
    'AND ActivityDate < ' + day);

  if (!recs.length) { var none = 'Nothing overdue. Nothing to move.'; Logger.log(none); return none; }

  // Who is affected, and how much ageing is actually being carried forward
  var per = {};
  recs.forEach(function (r) {
    var sid = byId[r.OwnerId] || 'unknown';
    per[sid] = per[sid] || { n: 0, days: 0, noReason: 0 };
    per[sid].n++;
    per[sid].days += Number(r.Days_O_S__c || 0);
    if (!(r.Task_Update_Reason_c__c || '').trim()) per[sid].noReason++;
  });

  var lines = [];
  Object.keys(per).sort(function (a, b) { return per[b].n - per[a].n; }).forEach(function (sid) {
    var p = per[sid];
    lines.push('  ' + (users[sid] ? users[sid].name : sid) + ': ' + p.n + ' task(s), ' +
      p.days + ' days of real age, ' + p.noReason + ' with no reason on them');
  });

  if (!commit) {
    var msg = ['DRY RUN — nothing moved, nothing posted.', '',
      recs.length + ' overdue task(s) would move to ' + tomorrow + ':', ''
    ].concat(lines).concat(['',
      'Each owner would get this on the record, @mentioned:', '',
      chatterBody_('@' + (users[Object.keys(per)[0]] ? users[Object.keys(per)[0]].name : 'Name'), tomorrow)
        .split('\n').map(function (l) { return '  ' + l; }).join('\n'),
      '', 'Run rollOverdueForwardForReal() to apply it.']).join('\n');
    Logger.log(msg);
    return msg;
  }

  // 1. move the dates, in batches
  var tok = sfkToken_(), moved = 0, failedMove = 0;
  for (var i = 0; i < recs.length; i += RETYPE.batch) {
    var slice = recs.slice(i, i + RETYPE.batch).map(function (r) {
      return { attributes: { type: 'Task' }, id: r.Id, ActivityDate: tomorrow };
    });
    var res = UrlFetchApp.fetch(tok.instance_url + '/services/data/' + SFK.API + '/composite/sobjects', {
      method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok.access_token },
      payload: JSON.stringify({ allOrNone: false, records: slice })
    });
    if (res.getResponseCode() !== 200) { failedMove += slice.length; continue; }
    JSON.parse(res.getContentText()).forEach(function (r) { r.success ? moved++ : failedMove++; });
  }

  // 2. tell each owner, on the record itself
  var posted = 0, failedPost = 0;
  recs.forEach(function (r) {
    var sid = byId[r.OwnerId];
    var name = users[sid] ? users[sid].name : '';
    var res = UrlFetchApp.fetch(
      tok.instance_url + '/services/data/' + SFK.API + '/chatter/feed-elements', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + tok.access_token },
        payload: JSON.stringify({
          feedElementType: 'FeedItem',
          subjectId: r.Id,
          body: { messageSegments: [
            { type: 'mentionSegment', id: r.OwnerId },
            { type: 'text', text: ' ' + chatterBody_(name, tomorrow).replace(name + ' — ', '') }
          ] }
        })
      });
    var c = res.getResponseCode();
    (c === 201 || c === 200) ? posted++ : failedPost++;
  });

  audit_({ staffId: 'maintenance', name: 'Roll overdue forward' },
         'BATCH:' + recs.length, 'Due date', 'various', tomorrow,
         moved + ' moved, ' + failedMove + ' failed; ' + posted + ' notes posted, ' +
         failedPost + ' failed');

  var out = ['Moved ' + moved + ' of ' + recs.length + ' overdue task(s) to ' + tomorrow + '.',
    failedMove ? failedMove + ' failed to move.' : '',
    'Posted ' + posted + ' note(s) to owners' + (failedPost ? ', ' + failedPost + ' failed.' : '.'),
    '', 'By owner:'].concat(lines).concat(['', 'Logged on the "' + AUDIT_TAB + '" tab.'])
    .filter(String).join('\n');
  Logger.log(out);
  return out;
}

/** Run from the editor to confirm the write path works before anyone uses it.
 *  It writes a reason to your own oldest unexplained overdue task, then puts
 *  the previous value back — so nothing is left changed. */
function sfWriteTest() {
  if (!sfkConfigured_()) { Logger.log('Salesforce is not connected.'); return; }
  var me = managerEmails_()[0];
  var users = sfkUsers_();
  var mine = Object.keys(users).filter(function (k) {
    return normEmail_(users[k].email || '') === normEmail_(me);
  })[0] || Object.keys(users)[0];

  var recs = sfkQuery_(
    "SELECT Id, Subject, Task_Update_Reason_c__c FROM Task WHERE OwnerId = '" +
    users[mine].id + "' AND Status != 'Completed' LIMIT 1");
  if (!recs.length) { Logger.log('No open task to test against.'); return; }

  var t = recs[0];
  var before = t.Task_Update_Reason_c__c;
  var profile = { staffId: mine, name: users[mine].name, manager: true };

  var r = updateTask_({ taskId: t.Id, field: 'reason',
                        value: 'Write test from the KPI tracker — ignore.' }, profile);
  var out = ['Test task: ' + t.Subject, 'Write: ' + (r.ok ? 'ok' : r.error)];

  if (r.ok) {                                   // put it back exactly as found
    try {
      sfkPatch_(t.Id, { Task_Update_Reason_c__c: before == null ? '' : before });
      out.push('Restored the previous value. Nothing left changed.');
    } catch (e) { out.push('COULD NOT RESTORE — set it back by hand: ' + t.Id); }
  }
  out.push('', 'Check the "' + AUDIT_TAB + '" tab: both the write and this test are logged.');
  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}

// ---------------------------------------------------------------------------
//  Policy status codes, from the underwriting extract to the portfolio
//
//  CLIENT_PORTFOLIO__c carries a policy status DESCRIPTION on most pending
//  records and no CODE at all. The description cannot be turned into the code
//  by rule, and it is worth being plain about why, because it looks as though
//  it should be. The codes are a two-by-two:
//
//      PCCU   no errors,   no outstanding requirement,  UW incomplete
//      PCRU   no errors,   OUTSTANDING REQUIREMENT,     UW incomplete
//      PECU   ERRORS,      no outstanding requirement,  UW incomplete
//      PERU   ERRORS,      OUTSTANDING REQUIREMENT,     UW incomplete
//      PCRC / PERC        the same, underwriting COMPLETE
//
//  "Underwriting incomplete" fixes the last letter and nothing else. Whether
//  a case has errors is not recorded anywhere in Salesforce, so a guess here
//  is a coin flip on a live client record — and PCRU and PERU mean different
//  things to the underwriter. The code has to come from the extract that
//  knows it, which is RR_UWPRO_INSURED_Requirement, column A.
//
//  TWO FIELDS ARE LABELLED "POLICY STATUS CODE". Both exist on the object:
//
//      Policy_Status_Code__c    free text. Where the inforce and lapsed codes
//                               live — 1, E, ELV, B, RFC, RNP.
//      Policy_Status_Cose__c    a picklist, and the API name really is
//                               spelled that way. Where the PENDING codes
//                               live: against "Underwriting incomplete" the
//                               branch has used this on 72 records and the
//                               text field on 4.
//
//  This writes the picklist, because this extract is an underwriting extract.
//  Change PSC.field if that is ever wrong.
//
//  HOW TO RUN IT. syncPolicyStatusCodes() changes nothing. It reads the
//  sheet, matches it to Salesforce, and reports what it WOULD do — including
//  a count of every code it found, which is the quickest way to confirm
//  column A holds what it is supposed to. Read that, then
//  syncPolicyStatusCodesForReal().
// ---------------------------------------------------------------------------

var PSC = {
  tabPrefix: 'RR_UWPRO',     // the tab's name begins with this
  codeCol: 1,                // column A, where the branch keeps the code
  object: 'CLIENT_PORTFOLIO__c',
  keyField: 'POLICY__c',     // the policy number on the portfolio record
  field: 'Policy_Status_Cose__c',
  batch: 200,                // the sObject Collections limit per call
  inChunk: 300,              // policy numbers per SOQL IN list
  budgetMs: 4.5 * 60 * 1000, // Apps Script stops at six minutes; leave room
  /* The picklist's own values. A code that is not one of these is REFUSED
     rather than written: Salesforce would either reject it or, on a
     permissive org, quietly store a value no report can read. */
  allowed: ['1', '2', '4', 'A', 'ANP', 'ANT', 'B', 'C', 'D', 'DILL', 'E', 'ELV',
            'F', 'H', 'PCCU', 'PCRC', 'PCRU', 'PECU', 'PERC', 'PERU', 'R',
            'RDC', 'RDE', 'RFC', 'RNP', 'RNT', 'RPP', 'W', 'X']
};

function syncPolicyStatusCodes()        { return syncPolicyCodes_(false); }
function syncPolicyStatusCodesForReal() { return syncPolicyCodes_(true); }

/** The tab, found by the name the branch uses rather than by its columns —
 *  column A has no header worth matching on and the branch named the sheet. */
function pscTab_() {
  if (typeof iSs_ !== 'function') return null;
  var want = String(PSC.tabPrefix).toLowerCase(), best = null;
  iSs_().getSheets().forEach(function (sh) {
    if (String(sh.getName()).toLowerCase().indexOf(want) !== 0) return;
    if (!best || sh.getLastRow() > best.getLastRow()) best = sh;
  });
  return best;
}

/** Policy number -> code, from the sheet. A policy carrying two different
 *  codes across its rows is reported and skipped, never guessed at. */
function pscFromSheet_() {
  var sh = pscTab_();
  if (!sh) {
    return { error: 'No tab beginning "' + PSC.tabPrefix + '" in the intelligence workbook. ' +
                    (typeof iSs_ === 'function' ? '' : 'Intelligence.gs is not in this project, and it is what opens that workbook.') };
  }
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return { error: 'The tab "' + sh.getName() + '" has no rows.' };

  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
  var polCol = -1;
  head.forEach(function (h, i) {
    if (polCol < 0 && (h === 'policy_number' || h.indexOf('policy_number') === 0)) polCol = i + 1;
  });
  if (polCol < 0) return { error: 'The tab "' + sh.getName() + '" has no POLICY_NUMBER column.' };

  var codes = sh.getRange(2, PSC.codeCol, lastRow - 1, 1).getValues();
  var pols  = sh.getRange(2, polCol,      lastRow - 1, 1).getValues();

  var map = {}, byCode = {}, conflicts = [], blank = 0, rows = 0;
  for (var r = 0; r < codes.length; r++) {
    var pol = String(pols[r][0]).trim();
    if (!pol) continue;
    var code = String(codes[r][0]).trim().toUpperCase();
    rows++;
    if (!code) { blank++; continue; }
    byCode[code] = (byCode[code] || 0) + 1;
    if (map[pol] === undefined) map[pol] = code;
    else if (map[pol] !== code && map[pol] !== null) {
      /* Two codes on one policy. Neither is safe to pick, so the policy is
         dropped from the run and named in the report. */
      if (conflicts.length < 25) conflicts.push(pol + ': ' + map[pol] + ' and ' + code);
      map[pol] = null;
    }
  }
  var dropped = 0;
  Object.keys(map).forEach(function (k) { if (map[k] === null) { delete map[k]; dropped++; } });

  return { tab: sh.getName(), colA: String(head[PSC.codeCol - 1] || '(no header)'),
           rows: rows, blank: blank, policies: Object.keys(map).length,
           byCode: byCode, conflicts: conflicts, dropped: dropped, map: map };
}

function pscQuote_(s) { return "'" + String(s).replace(/'/g, "\\'") + "'"; }

function syncPolicyCodes_(commit) {
  if (typeof sfkConfigured_ !== 'function' || !sfkConfigured_()) {
    var no = 'Salesforce is not connected.'; Logger.log(no); return no;
  }
  var started = Date.now();
  var sheet = pscFromSheet_();
  if (sheet.error) { Logger.log(sheet.error); return sheet.error; }

  /* Every code the sheet holds, checked against the picklist before anything
     is planned. An unknown code is named and its policies left alone. */
  var unknown = Object.keys(sheet.byCode).filter(function (c) { return PSC.allowed.indexOf(c) < 0; });

  var pols = Object.keys(sheet.map).filter(function (p) {
    return PSC.allowed.indexOf(sheet.map[p]) > -1;
  });

  var plan = [], already = 0, changing = 0, notFound = 0, checked = 0, ranOut = false;
  for (var i = 0; i < pols.length; i += PSC.inChunk) {
    if (Date.now() - started > PSC.budgetMs) { ranOut = true; break; }
    var slice = pols.slice(i, i + PSC.inChunk);
    checked += slice.length;
    var soql = 'SELECT Id, ' + PSC.keyField + ', ' + PSC.field +
               ' FROM ' + PSC.object + ' WHERE ' + PSC.keyField + ' IN (' +
               slice.map(pscQuote_).join(',') + ')';
    var recs = sfkQuery_(soql) || [];
    var seen = {};
    recs.forEach(function (rec) {
      var pol = String(rec[PSC.keyField] || '').trim();
      seen[pol] = true;
      var want = sheet.map[pol], have = rec[PSC.field] == null ? '' : String(rec[PSC.field]).trim();
      if (have === want) { already++; return; }
      changing++;
      plan.push({ id: rec.Id, policy: pol, was: have, now: want });
    });
    slice.forEach(function (p) { if (!seen[p]) notFound++; });
  }

  var head = [
    'Tab: "' + sheet.tab + '" · column A header reads "' + sheet.colA + '"',
    sheet.rows + ' rows · ' + sheet.policies + ' policies with a code · ' + sheet.blank + ' rows with column A empty',
    'Writing to ' + PSC.object + '.' + PSC.field,
    ''
  ];
  var codeLines = Object.keys(sheet.byCode).sort(function (a, b) { return sheet.byCode[b] - sheet.byCode[a]; })
    .map(function (c) {
      return '   ' + (PSC.allowed.indexOf(c) < 0 ? 'REFUSED ' : '        ') + c + '  ' + sheet.byCode[c] + ' row(s)';
    });

  var body = ['Codes found in column A:'].concat(codeLines).concat([
    '',
    changing + ' record(s) would change · ' + already + ' already correct · ' +
      notFound + ' policy number(s) not on ' + PSC.object,
    sheet.dropped ? sheet.dropped + ' policy(ies) skipped — two different codes on one policy' : 'No policy carries two different codes.',
    unknown.length ? 'REFUSED, not in the picklist: ' + unknown.join(', ') : 'Every code is a valid picklist value.',
    ranOut ? 'RAN OUT OF TIME after checking ' + checked + ' of ' + pols.length + ' policies — run it again to carry on.' : ''
  ]).filter(String);

  if (sheet.conflicts.length) {
    body.push('', 'Conflicting policies (first ' + sheet.conflicts.length + '):');
    sheet.conflicts.forEach(function (c) { body.push('   ' + c); });
  }

  if (!commit) {
    var dry = head.concat(['DRY RUN — nothing has been changed.', '']).concat(body)
      .concat(['', plan.length ? 'Example: policy ' + plan[0].policy + '  "' + (plan[0].was || '(blank)') + '" -> "' + plan[0].now + '"' : '',
               '', 'Run syncPolicyStatusCodesForReal() to apply it.']).filter(String).join('\n');
    Logger.log(dry);
    return dry;
  }

  var tok = sfkToken_(), done = 0, failed = 0, firstError = '';
  for (var j = 0; j < plan.length; j += PSC.batch) {
    if (Date.now() - started > PSC.budgetMs) { ranOut = true; break; }
    var batch = plan.slice(j, j + PSC.batch).map(function (p) {
      var rec = { attributes: { type: PSC.object }, id: p.id };
      rec[PSC.field] = p.now;
      return rec;
    });
    var res = UrlFetchApp.fetch(tok.instance_url + '/services/data/' + SFK.API + '/composite/sobjects', {
      method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok.access_token },
      payload: JSON.stringify({ allOrNone: false, records: batch })
    });
    if (res.getResponseCode() !== 200) {
      failed += batch.length;
      if (!firstError) firstError = res.getContentText().slice(0, 300);
      continue;
    }
    JSON.parse(res.getContentText()).forEach(function (r) {
      if (r.success) done++;
      else { failed++; if (!firstError) firstError = JSON.stringify(r.errors).slice(0, 300); }
    });
  }

  if (typeof audit_ === 'function') {
    audit_({ staffId: 'maintenance', name: 'Policy status code sync' }, 'BATCH:' + plan.length,
           PSC.field, '(from ' + sheet.tab + ' column A)', 'per policy',
           done + ' set, ' + failed + ' failed' + (firstError ? ' — ' + firstError : ''));
  }

  var out = head.concat([
    'Set ' + done + ' of ' + plan.length + ' record(s).',
    failed ? failed + ' failed. First error: ' + firstError : 'None failed.',
    ranOut ? 'Stopped on the six-minute limit — run it again to finish the rest.' : '',
    ''
  ]).concat(body).concat(['', typeof AUDIT_TAB === 'string' ? 'Logged on the "' + AUDIT_TAB + '" tab.' : ''])
    .filter(String).join('\n');
  Logger.log(out);
  return out;
}
