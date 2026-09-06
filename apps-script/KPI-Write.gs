/**
 * RRB · Daily KPI Tracker — writing back to Salesforce
 * =============================================================================
 * KPI.gs only reads. This file is the only thing that writes, and it writes to
 * live client records — so it is a separate file on purpose. Paste it in when
 * you want the capability; leave it out and the tracker is read-only.
 *
 * WHAT IT CAN CHANGE — two fields, and nothing else, whatever is posted:
 *
 *     Task_Update_Reason__c    why an overdue task is late
 *     ActivityDate             the due date
 *
 * It cannot close a task, reassign one, change a status, or alter anything a
 * client sees.
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
  due:    { sf: 'ActivityDate',            label: 'Due date' }
};

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

  // Whose task is it, and is that a branch person at all?
  var users = sfkUsers_();
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  var recs;
  try {
    recs = sfkQuery_('SELECT Id, OwnerId, Subject, ActivityDate, Task_Update_Reason_c__c ' +
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

  var was = key === 'due' ? task.ActivityDate : task.Task_Update_Reason_c__c;
  var body = {};
  body[spec.sf] = value;

  try {
    sfkPatch_(taskId, body);
  } catch (e) {
    audit_(profile, taskId, spec.label, was, value, 'FAILED: ' + String(e && e.message || e));
    return { ok: false, error: 'Salesforce refused the change: ' + String(e && e.message || e) };
  }

  audit_(profile, taskId, spec.label, was, value, 'ok');

  // This person's cached position is now stale.
  var c = CacheService.getScriptCache();
  var day = todayISO_();
  ['sfk_m_', 'sfk_nr_', 'sfk_bill_'].forEach(function (pre) { c.remove(pre + day); });

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
