/**
 * ============================================================
 *  GROUP MOVE OUT — the first half of moving the group side to its own project
 *  Ricky Rampersad Branch · paste into the Service Questionnaire project for the move, then delete it
 * ============================================================
 *
 *  The group side (GroupClients.gs, GroupBilling.gs, GIRenewals.gs) moves to a project of its own (26 November 2026),
 *  owned by support@rickyrampersadbranch.com. A new project has none of this project's Script properties and none of
 *  its timed jobs, so these carry them:
 *
 *    1. groupMoveExport   writes every Script property, the branch code and the group's timed jobs onto a hidden tab,
 *                         _move_group, in this project's sheet, and tells you the sheet's ID.
 *    2. groupMoveStopOld  deletes the group's timed jobs here (the hourly refresh, the Monday letters, the 10:30 group
 *                         day), so the two projects never both send a letter, a bill or a reminder.
 *  Then, in the new project, groupMoveImport reads the tab, sets everything, rebuilds the jobs and deletes the tab.
 *
 *  The tab holds the project's secrets (the Microsoft, Salesforce and Claude keys) for the minutes the move takes,
 *  which is why it is hidden, why groupMoveImport deletes it at once, and why groupMoveCleanUp exists if the move stops
 *  half way. Values are written as text behind a "v:", so Sheets never turns a setting into a number or a date.
 *
 *  The orphan side's own timed jobs are not touched: only the group's.
 */

var GROUP_MOVE = {
  VERSION: '2026-11-26a',
  TAB: '_move_group',
  JOBS: ['gcmRefreshTick', 'gcmMondaySend', 'gcmDay1030', 'gcmRehearseTick', 'gcmWelcomeTick'],
  SKIP: { GROUP_MOVED_OUT: 1, GROUP_MOVED_IN: 1, MOVE_STOPPED: 1, MOVE_IMPORTED: 1 }
};

function groupMoveExport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties().getProperties();
  var keys = Object.keys(props).filter(function (k) { return !GROUP_MOVE.SKIP[k]; }).sort();
  var jobs = [];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (GROUP_MOVE.JOBS.indexOf(fn) > -1 && jobs.indexOf(fn) < 0) jobs.push(fn);
  });
  var team = (typeof SVC === 'object' && SVC) ? String(SVC.TEAM_CODE || '').trim() : '';
  var me = '';
  try { me = Session.getEffectiveUser().getEmail() || ''; } catch (e) {}
  var rows = [['Kind', 'Key', 'Value'],
    ['meta', 'exported', 'v:' + new Date().toISOString()],
    ['meta', 'from', 'v:' + me],
    ['meta', 'sheet', 'v:' + ss.getId()],
    ['meta', 'script', 'v:' + ScriptApp.getScriptId()],
    ['meta', 'version', 'v:' + GROUP_MOVE.VERSION],
    ['meta', 'teamCode', 'v:' + team]];
  keys.forEach(function (k) { rows.push(['prop', k, 'v:' + String(props[k])]); });
  jobs.forEach(function (fn) { rows.push(['job', fn, 'v:']); });
  var sh = ss.getSheetByName(GROUP_MOVE.TAB) || ss.insertSheet(GROUP_MOVE.TAB);
  sh.clear();
  var range = sh.getRange(1, 1, rows.length, 3);
  range.setNumberFormat('@');
  range.setValues(rows);
  try { sh.hideSheet(); } catch (e) {}
  return groupMoveSay_('Ready. ' + keys.length + ' settings' + (team ? ', the branch code' : ' (no branch code: TEAM_CODE is blank here)') +
    ' and ' + jobs.length + ' group timed job' + (jobs.length === 1 ? '' : 's') + ' (' + (jobs.join(', ') || 'none') + ') are on the hidden tab "' + GROUP_MOVE.TAB + '".\n\n' +
    'Next: run groupMoveStopOld here. Then, in the new group project, add the Script property SQ_SHEET_ID = ' + ss.getId() + ' and run groupMoveImport.');
}

function groupMoveStopOld() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(GROUP_MOVE.TAB)) return groupMoveSay_('Run groupMoveExport first: it writes down the timed jobs before they are deleted.');
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (GROUP_MOVE.JOBS.indexOf(t.getHandlerFunction()) > -1) { ScriptApp.deleteTrigger(t); n++; }
  });
  PropertiesService.getScriptProperties().setProperty('GROUP_MOVED_OUT', new Date().toISOString());
  return groupMoveSay_('Stopped: ' + n + ' group timed job' + (n === 1 ? '' : 's') + ' deleted here. The orphan side\'s jobs are untouched. ' +
    'The group pages still answer from here until they are pointed at the new address.\n\n' +
    'Next: in the new group project, set SQ_SHEET_ID = ' + ss.getId() + ' and run groupMoveImport.');
}

/** If the move stops half way: deletes the tab, and the secrets on it, from this sheet. */
function groupMoveCleanUp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(GROUP_MOVE.TAB);
  if (sh) ss.deleteSheet(sh);
  return groupMoveSay_(sh ? 'The "' + GROUP_MOVE.TAB + '" tab is deleted.' : 'There was no "' + GROUP_MOVE.TAB + '" tab to delete.');
}

function groupMoveSay_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
  return msg;
}
