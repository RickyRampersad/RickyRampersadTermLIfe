/**
 * Move.gs — carry a project's settings into its copy in the Workspace.
 *
 * Google does not copy a project's Script properties, timed jobs or web app
 * when a spreadsheet is copied. This file carries the settings across, so
 * nobody types fifty values by hand on a properties page that has gone
 * read-only, and it tells you which timed jobs to switch back on.
 *
 * The same file goes into every project that moves. Paste it as a new
 * script file called Move in the OLD project first.
 *
 * ─── THE ORDER ─────────────────────────────────────────────────────────────
 *
 * 1. In the OLD project (signed in as rampersadricky@gmail.com):
 *    run moveExport. It writes every setting, and the names of the timed
 *    jobs, into a hidden, protected tab called _move in this spreadsheet.
 *
 * 2. Signed in as ricky.rampersad@rickyrampersadbranch.com, copy the
 *    spreadsheet into the branch shared drive (File > Make a copy). The copy
 *    carries the _move tab and this file.
 *
 * 3. In the NEW copy: Extensions > Apps Script, run moveImport. It stores
 *    every setting, puts the new spreadsheet's ID wherever the old one
 *    appeared, deletes the _move tab, and lists the timed jobs to switch
 *    back on (each project's own setup function does that).
 *
 * 4. Back in the OLD project: run moveCleanup. It deletes the _move tab
 *    there, so the settings are not left sitting in a sheet.
 *
 * 5. Only once the new copy is tested and the pages point at it: run
 *    moveStopOld in the OLD project. It switches the old timed jobs off, so
 *    nothing is sent twice. The old web app keeps answering links already
 *    in clients' inboxes; switch it off after 30 days.
 *
 * Nothing here sends anything, and nothing is logged but setting NAMES.
 */

var MOVE_TAB = '_move';

function moveExport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) { console.log('This project is not attached to a spreadsheet. Ask Claude for the standalone version.'); return; }
  var props = PropertiesService.getScriptProperties().getProperties();
  var names = Object.keys(props).sort();
  var jobs = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction() + ' (' + String(t.getEventType()) + ')';
  });
  var sh = ss.getSheetByName(MOVE_TAB) || ss.insertSheet(MOVE_TAB);
  sh.clear();
  var rows = [['kind', 'name', 'value'], ['source', 'spreadsheet', ss.getId()]];
  names.forEach(function (k) { rows.push(['setting', k, props[k]]); });
  jobs.forEach(function (j) { rows.push(['job', j, '']); });
  sh.getRange(1, 1, rows.length, 3).setNumberFormat('@').setValues(rows);
  sh.hideSheet();
  try { var pr = sh.protect().setDescription('Move settings: delete after the move'); pr.removeEditors(pr.getEditors()); } catch (e) {}
  console.log('Written to the hidden "' + MOVE_TAB + '" tab: ' + names.length + ' settings and ' + jobs.length + ' timed jobs.');
  console.log('Settings: ' + names.join(', '));
  console.log('Timed jobs: ' + (jobs.join(', ') || 'none'));
  console.log('Next: copy this spreadsheet while signed in to the Workspace account, then run moveImport in the copy.');
}

function moveImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss && ss.getSheetByName(MOVE_TAB);
  if (!sh) { console.log('No "' + MOVE_TAB + '" tab here. Run moveExport in the old project first, then make the copy.'); return; }
  var rows = sh.getDataRange().getValues(), oldId = '', set = {}, jobs = [];
  rows.slice(1).forEach(function (r) {
    if (r[0] === 'source') oldId = String(r[2]);
    if (r[0] === 'setting' && r[1]) set[String(r[1])] = String(r[2]);
    if (r[0] === 'job') jobs.push(String(r[1]));
  });
  var newId = ss.getId(), swapped = [];
  Object.keys(set).forEach(function (k) {
    if (oldId && set[k].indexOf(oldId) > -1) { set[k] = set[k].split(oldId).join(newId); swapped.push(k); }
  });
  PropertiesService.getScriptProperties().setProperties(set, false);
  ss.deleteSheet(sh);
  console.log('Stored ' + Object.keys(set).length + ' settings. The "' + MOVE_TAB + '" tab is deleted from this copy.');
  if (swapped.length) console.log('Pointed at this copy instead of the old sheet: ' + swapped.join(', '));
  console.log('Timed jobs the old copy had (switch them on with this project’s setup function): ' + (jobs.join(', ') || 'none'));
  console.log('Next: Deploy > New deployment > Web app (execute as me, anyone), and send Claude the address. Then run moveCleanup in the OLD project.');
}

function moveCleanup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss && ss.getSheetByName(MOVE_TAB);
  if (!sh) { console.log('Nothing to clean up here.'); return; }
  ss.deleteSheet(sh);
  console.log('The "' + MOVE_TAB + '" tab is deleted from the old spreadsheet.');
}

function moveStopOld() {
  var ts = ScriptApp.getProjectTriggers();
  var names = ts.map(function (t) { return t.getHandlerFunction(); });
  ts.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  console.log('Switched off ' + ts.length + ' timed jobs in the old copy: ' + (names.join(', ') || 'none') + '.');
  console.log('The old web app still answers links already sent. Archive it after 30 days (Deploy > Manage deployments > Archive).');
}
