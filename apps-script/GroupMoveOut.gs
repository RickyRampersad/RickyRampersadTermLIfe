/**
 * ============================================================
 *  GROUP MOVE OUT — the first half of moving the group side to its own project
 *  Ricky Rampersad Branch · paste into the Service Questionnaire project for the move, then delete it
 * ============================================================
 *
 *  The group side (GroupClients.gs, GroupBilling.gs, GIRenewals.gs) moves to a project of its own (26 November 2026),
 *  made under the same Google account that owns the sheets. A new project has none of this project's Script properties
 *  and none of its timed jobs, so these carry them:
 *
 *    1. groupMoveExport   writes every Script property, the branch code and the group's timed jobs into a small new
 *                         sheet in this account's Drive ("Group move: settings for the new project"), and the time zone.
 *    2. groupMoveStopOld  deletes the group's timed jobs here (the hourly refresh, the Monday letters, the 10:30 group
 *                         day), so the two projects never both send a letter, a bill or a reminder.
 *  Then, in the new project, groupMoveImport finds that sheet in Drive, sets everything, rebuilds the jobs and bins it.
 *
 *  Not a tab in the Service Questionnaire workbook: that workbook is so large that adding a tab to it failed on the
 *  first try with Google's "An unknown error has occurred, please try again later". The hidden tab is kept only as the
 *  fallback if Drive refuses the new sheet. Each step is tried three times and, if it still fails, says which it was.
 *
 *  The sheet holds the project's secrets (the Microsoft, Salesforce and Claude keys) for the minutes the move takes,
 *  which is why groupMoveImport empties and bins it at once, and why groupMoveCleanUp exists if the move stops half way.
 *  Values are written as text behind a "v:", so Sheets never turns a setting into a number or a date.
 *
 *  The orphan side's own timed jobs are not touched: only the group's.
 *
 *  It also writes down this project's time zone. A new project takes the time zone of the account that made it, and
 *  every timed job (the Monday 10:00 letters, the 10:30 group day, the billing day) runs by the project's clock, so
 *  groupMoveImport refuses until the new project is set to the same zone.
 */

var GROUP_MOVE = {
  VERSION: '2026-11-26c',
  TAB: '_move_group',
  /* the settings travel in a small sheet of their own, in this account's Drive: never in the Service Questionnaire
     workbook, which is so large that adding a tab to it can fail with Google's "An unknown error has occurred"
     (26 November 2026, the first try of the move). groupMoveImport finds it by this name and deletes it. */
  FILE: 'Group move: settings for the new project (groupMoveImport deletes this)',
  TRIES: 3,
  JOBS: ['gcmRefreshTick', 'gcmMondaySend', 'gcmDay1030', 'gcmRehearseTick', 'gcmWelcomeTick'],
  SKIP: { GROUP_MOVED_OUT: 1, GROUP_MOVED_IN: 1, MOVE_STOPPED: 1, MOVE_IMPORTED: 1, GROUP_MOVE_FILE: 1, MOVE_SHEET_ID: 1 }
};

/** One step, tried up to three times a second or two apart; a step that still fails says which it was. */
function groupMoveTry_(label, fn) {
  var last;
  for (var i = 0; i < GROUP_MOVE.TRIES; i++) {
    try { return fn(); }
    catch (e) { last = e; if (i < GROUP_MOVE.TRIES - 1) { try { Utilities.sleep(1500 * (i + 1)); } catch (e2) {} } }
  }
  throw new Error(label + ' (' + String(last && last.message || last) + ')');
}

function groupMoveExport() {
  try {
    var props = groupMoveTry_('reading the Script properties', function () { return PropertiesService.getScriptProperties().getProperties(); });
    var keys = Object.keys(props).filter(function (k) { return !GROUP_MOVE.SKIP[k]; }).sort();
    var jobs = groupMoveTry_('reading the timed jobs', function () {
      var out = [];
      ScriptApp.getProjectTriggers().forEach(function (t) {
        var fn = t.getHandlerFunction();
        if (GROUP_MOVE.JOBS.indexOf(fn) > -1 && out.indexOf(fn) < 0) out.push(fn);
      });
      return out;
    });
    var sqId = groupMoveTry_('reading this sheet\'s ID', function () { return SpreadsheetApp.getActiveSpreadsheet().getId(); });
    var team = (typeof SVC === 'object' && SVC) ? String(SVC.TEAM_CODE || '').trim() : '';
    var me = '', tz = '';
    try { me = Session.getEffectiveUser().getEmail() || ''; } catch (e) {}
    try { tz = Session.getScriptTimeZone() || ''; } catch (e) {}
    var rows = [['Kind', 'Key', 'Value'],
      ['meta', 'exported', 'v:' + new Date().toISOString()],
      ['meta', 'from', 'v:' + me],
      ['meta', 'sheet', 'v:' + sqId],
      ['meta', 'script', 'v:' + ScriptApp.getScriptId()],
      ['meta', 'version', 'v:' + GROUP_MOVE.VERSION],
      ['meta', 'teamCode', 'v:' + team],
      ['meta', 'timeZone', 'v:' + tz]];
    keys.forEach(function (k) { rows.push(['prop', k, 'v:' + String(props[k])]); });
    jobs.forEach(function (fn) { rows.push(['job', fn, 'v:']); });

    var where = groupMoveWrite_(rows);
    return groupMoveSay_('Ready. ' + keys.length + ' settings' + (team ? ', the branch code' : ' (no branch code: TEAM_CODE is blank here)') +
      ' and ' + jobs.length + ' group timed job' + (jobs.length === 1 ? '' : 's') + ' (' + (jobs.join(', ') || 'none') + ') are written down ' +
      (where.file ? 'in a small new sheet in your Drive, "' + GROUP_MOVE.FILE + '".' : 'on the hidden tab "' + GROUP_MOVE.TAB + '" of this sheet.') + '\n\n' +
      'This project runs on the time zone ' + (tz || '(unknown)') + '. The new project must be set to the same before groupMoveImport.\n\n' +
      'Next: run groupMoveStopOld here. Then, in the new group project, set the time zone and run groupMoveImport. ' +
      (where.file ? 'It finds the settings sheet in your Drive by itself, and sets SQ_SHEET_ID (' + sqId + ') for you. ' +
                    'Only if it says it cannot find it, add the Script property MOVE_SHEET_ID = ' + where.file + '.'
                  : 'First add the Script property SQ_SHEET_ID = ' + sqId + ' there.'));
  } catch (e) {
    return groupMoveSay_('Stopped while ' + String(e && e.message || e) + '. Nothing was changed: no timed job was touched. ' +
      'Run groupMoveExport again in a few minutes, and if it stops at the same step, send that line to Claude.');
  }
}

/** Writes the rows to a new small sheet (the old ones of the same name binned first); failing that, to a hidden tab here. */
function groupMoveWrite_(rows) {
  var why = '';
  try {
    groupMoveBinFiles_();
    var f = groupMoveTry_('making the settings sheet in your Drive', function () { return SpreadsheetApp.create(GROUP_MOVE.FILE, rows.length + 5, 3); });
    try {
      groupMoveTry_('writing the settings sheet', function () {
        var sh = f.getSheets()[0];
        sh.setName(GROUP_MOVE.TAB);
        var range = sh.getRange(1, 1, rows.length, 3);
        range.setNumberFormat('@');
        range.setValues(rows);
        SpreadsheetApp.flush();
      });
    } catch (e) { groupMoveBin_(f.getId()); throw e; }
    var id = f.getId();
    try { PropertiesService.getScriptProperties().setProperty('GROUP_MOVE_FILE', id); } catch (e) {}
    try { CacheService.getScriptCache().put('group-move-file', id, 21600); } catch (e) {}
    return { file: id };
  } catch (e) { why = String(e && e.message || e); }
  groupMoveTry_('writing the hidden tab here, after ' + why, function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(GROUP_MOVE.TAB) || ss.insertSheet(GROUP_MOVE.TAB);
    sh.clear();
    var range = sh.getRange(1, 1, rows.length, 3);
    range.setNumberFormat('@');
    range.setValues(rows);
    try { sh.hideSheet(); } catch (e) {}
  });
  return { tab: true };
}

/** Empties and bins a settings sheet: what it held were the project's secrets. */
function groupMoveBin_(id) {
  try { var f = SpreadsheetApp.openById(id); f.getSheets().forEach(function (sh) { try { sh.clear(); } catch (e) {} }); } catch (e) {}
  try { DriveApp.getFileById(id).setTrashed(true); return true; } catch (e) { return false; }
}

/** Every settings sheet of that name in this account's Drive, binned. */
function groupMoveBinFiles_() {
  var n = 0;
  try {
    var it = DriveApp.getFilesByName(GROUP_MOVE.FILE);
    while (it.hasNext()) { var f = it.next(); try { if (!f.isTrashed() && groupMoveBin_(f.getId())) n++; } catch (e) {} }
  } catch (e) {}
  return n;
}

function groupMoveExported_() {
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty('GROUP_MOVE_FILE') || ''; } catch (e) {}
  if (!id) { try { id = CacheService.getScriptCache().get('group-move-file') || ''; } catch (e) {} }
  if (id) return true;
  /* a tab counts only with the settings on it: a run that failed half way can leave an empty one behind */
  try { var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GROUP_MOVE.TAB); return !!sh && sh.getLastRow() >= 2; } catch (e) { return false; }
}

function groupMoveStopOld() {
  if (!groupMoveExported_()) return groupMoveSay_('Run groupMoveExport first: it writes down the timed jobs before they are deleted.');
  try {
    var n = groupMoveTry_('deleting the group\'s timed jobs', function () {
      var k = 0;
      ScriptApp.getProjectTriggers().forEach(function (t) {
        if (GROUP_MOVE.JOBS.indexOf(t.getHandlerFunction()) > -1) { ScriptApp.deleteTrigger(t); k++; }
      });
      return k;
    });
    try { PropertiesService.getScriptProperties().setProperty('GROUP_MOVED_OUT', new Date().toISOString()); } catch (e) {}
    return groupMoveSay_('Stopped: ' + n + ' group timed job' + (n === 1 ? '' : 's') + ' deleted here. The orphan side\'s jobs are untouched. ' +
      'The group pages still answer from here until they are pointed at the new address.\n\n' +
      'Next: in the new group project, set the time zone and run groupMoveImport.');
  } catch (e) {
    return groupMoveSay_('Stopped while ' + String(e && e.message || e) + '. Run groupMoveStopOld again in a few minutes: a job it already deleted stays deleted.');
  }
}

/** If the move stops half way: bins the settings sheet and deletes the hidden tab, and so the secrets on them. */
function groupMoveCleanUp() {
  var said = [];
  var n = groupMoveBinFiles_();
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty('GROUP_MOVE_FILE') || ''; } catch (e) {}
  if (id && groupMoveBin_(id)) n = Math.max(n, 1);
  try { PropertiesService.getScriptProperties().deleteProperty('GROUP_MOVE_FILE'); } catch (e) {}
  try { CacheService.getScriptCache().remove('group-move-file'); } catch (e) {}
  said.push(n ? 'The settings sheet is emptied and in the bin.' : 'There was no settings sheet in your Drive.');
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(GROUP_MOVE.TAB);
    if (sh) { ss.deleteSheet(sh); said.push('The "' + GROUP_MOVE.TAB + '" tab is deleted.'); }
  } catch (e) { said.push('The "' + GROUP_MOVE.TAB + '" tab could not be checked (' + String(e && e.message || e).slice(0, 120) + ').'); }
  return groupMoveSay_(said.join(' '));
}

function groupMoveSay_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
  return msg;
}
