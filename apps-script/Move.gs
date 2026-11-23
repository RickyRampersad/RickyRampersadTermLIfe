/**
 * ============================================================
 *  MOVE — the Service Questionnaire project from one Google account to another
 *  Ricky Rampersad Branch · a file in the Service Questionnaire project
 * ============================================================
 *
 *  Google will not hand a sheet from a personal Gmail to a Workspace account,
 *  so the project moves by copy: File → Make a copy, signed in as the new
 *  owner. A copy carries the tabs and the code and nothing else: not one
 *  Script property, not one timed job, and it answers at a new /exec. These
 *  functions carry the rest, in this order:
 *
 *  In the OLD project (the account it is leaving):
 *    1. moveExport    writes every Script property, the list of timed jobs and
 *                     each tab's row count onto a hidden tab, _move, which the
 *                     copy then carries across with the rest of the sheet.
 *    2. moveStopOld   deletes every timed job here, so the old project and the
 *                     new one never both send a letter or a receipt.
 *  Then, signed in as the new owner: File → Make a copy.
 *  In the NEW project (the copy):
 *    3. moveImport    sets the properties, rebuilds the same timed jobs, checks
 *                     that every sheet and folder the project names can be
 *                     opened, and deletes the copy's _move tab.
 *  Deploy the copy as a web app; the pages are pointed at its /exec.
 *  Back in the OLD project:
 *    4. moveCatchUp   lists every row written to the old sheet after the copy,
 *                     to be carried across by hand.
 *    5. moveCleanUp   deletes the old _move tab.
 *
 *  The _move tab holds the project's secrets (the Microsoft, Salesforce and
 *  Claude keys) for the few minutes of the move, which is why it is hidden,
 *  why moveImport deletes it in the copy at once, and why moveCleanUp exists.
 *  Values are written as text with a "v:" in front, so Sheets never reads a
 *  number, a date or a formula into a setting.
 */

var MOVE = {
  VERSION: '2026-11-23a',
  TAB: '_move',
  /* a value of this shape, under a key that does not name a secret, is a Drive or Sheets id */
  ID_RE: /^[A-Za-z0-9_-]{25,80}$/,
  SECRET_KEY_RE: /SECRET|TOKEN|PASS|KEY|CODE|CLIENT|TENANT|HASH|SIG/i,
  /* the move's own marks never travel */
  SKIP: { MOVE_STOPPED: 1, MOVE_IMPORTED: 1 }
};

/* ── 1. the old project: write everything the copy will need onto _move ─────────────────── */

function moveExport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties().getProperties();
  var keys = Object.keys(props).filter(function (k) { return !MOVE.SKIP[k]; }).sort();
  var trig = ScriptApp.getProjectTriggers();
  var rows = [['Kind', 'Key', 'Value']];
  rows.push(['meta', 'exported', 'v:' + new Date().toISOString()]);
  rows.push(['meta', 'from', 'v:' + moveWho_()]);
  rows.push(['meta', 'sheet', 'v:' + ss.getId()]);
  rows.push(['meta', 'version', 'v:' + MOVE.VERSION]);
  keys.forEach(function (k) { rows.push(['prop', k, 'v:' + String(props[k])]); });
  trig.forEach(function (t) { rows.push(['trigger', t.getHandlerFunction(), 'v:' + moveTrigKind_(t)]); });
  ss.getSheets().forEach(function (s) {
    if (s.getName() !== MOVE.TAB) rows.push(['count', s.getName(), 'v:' + s.getLastRow()]);
  });
  var sh = ss.getSheetByName(MOVE.TAB) || ss.insertSheet(MOVE.TAB);
  sh.clear();
  var range = sh.getRange(1, 1, rows.length, 3);
  range.setNumberFormat('@');
  range.setValues(rows);
  try { sh.hideSheet(); } catch (e) {}
  return moveSay_('Ready to move. ' + keys.length + ' settings, ' + trig.length + ' timed jobs and ' +
    rows.filter(function (r) { return r[0] === 'count'; }).length + ' tabs are written on the hidden tab "' + MOVE.TAB + '".\n\n' +
    'Next: run moveStopOld here, then sign in as the new owner and use File → Make a copy.');
}

/* ── 2. the old project: stop every timed job, so the two never both send ───────────────── */

function moveStopOld() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var m = moveRead_(ss);
  if (!m) return moveSay_('Run moveExport first: it writes down the timed jobs before they are deleted.');
  if (m.meta.sheet !== ss.getId()) return moveSay_('This is the copy, not the old project. Run moveImport here instead.');
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); n++; });
  PropertiesService.getScriptProperties().setProperty('MOVE_STOPPED', new Date().toISOString());
  return moveSay_('Stopped: ' + n + ' timed job' + (n === 1 ? '' : 's') + ' deleted in this project. Nothing here sends by itself any more; ' +
    'the web pages still answer until they are pointed at the new address.\n\n' +
    'Next: sign in as the new owner, open this sheet and use File → Make a copy. In the copy, Extensions → Apps Script, run moveImport.');
}

/* ── 3. the new project: carry the settings and the timed jobs, check what it can reach ─── */

function moveImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(MOVE.TAB);
  var m = moveRead_(ss);
  if (!m) return moveSay_('There is no "' + MOVE.TAB + '" tab here. Run moveExport in the old project before making the copy.');
  if (m.meta.sheet === ss.getId()) return moveSay_('This is the old project. moveImport runs in the copy, signed in as the new owner.');

  var store = PropertiesService.getScriptProperties();
  var keys = Object.keys(m.props);
  try { store.setProperties(m.props, false); }
  catch (e) { keys.forEach(function (k) { store.setProperty(k, m.props[k]); }); }

  /* the same timed jobs, built the way the project's own installers build them */
  var fns = {}, sheetTrig = [];
  m.triggers.forEach(function (t) {
    if (/^SPREADSHEET/.test(t.kind)) sheetTrig.push(t); else fns[t.fn] = (fns[t.fn] || 0) + 1;
  });
  var made = [], byHand = [];
  var inst = moveInstallers_();
  Object.keys(fns).sort().forEach(function (fn) {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t); });
    if (!inst[fn]) { byHand.push(fn); return; }
    try { inst[fn](); made.push(fn); } catch (e) { byHand.push(fn + ' (' + String(e && e.message || e) + ')'); }
  });
  sheetTrig.forEach(function (t) {
    try {
      var b = ScriptApp.newTrigger(t.fn).forSpreadsheet(ss);
      var ev = t.kind.split(' ')[1] || '';
      if (ev === 'ON_OPEN') b.onOpen(); else if (ev === 'ON_EDIT') b.onEdit();
      else if (ev === 'ON_CHANGE') b.onChange(); else if (ev === 'ON_FORM_SUBMIT') b.onFormSubmit();
      else { byHand.push(t.fn + ' (' + t.kind + ')'); return; }
      b.create(); made.push(t.fn + ' (' + ev + ')');
    } catch (e) { byHand.push(t.fn + ' (' + String(e && e.message || e) + ')'); }
  });

  var reach = moveReach_(m.props);
  store.setProperty('MOVE_IMPORTED', new Date().toISOString() + ' from ' + m.meta.from);
  if (sh) ss.deleteSheet(sh);

  var me = moveWho_();
  var lines = [];
  lines.push(keys.length + ' settings carried across from ' + m.meta.from + '.');
  lines.push(made.length + ' timed job' + (made.length === 1 ? '' : 's') + ' rebuilt: ' + (made.join(', ') || 'none') + '.');
  if (byHand.length) lines.push('To set up again by hand: ' + byHand.join(', ') + '.');
  if (reach.bad.length) lines.push('This account (' + me + ') cannot open: ' + reach.bad.join('; ') +
    '. Share each with ' + me + ' as an editor, then run moveCheck.');
  else lines.push('Every sheet and folder the project names can be opened (' + reach.ok + ').');
  lines.push('The "' + MOVE.TAB + '" tab is deleted from this copy.');
  lines.push('Next: Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone. Send the new /exec address to be wired into the pages.');
  return moveSay_(lines.join('\n\n'));
}

/** In the copy, after sharing: which sheets and folders this account still cannot open. */
function moveCheck() {
  var r = moveReach_(PropertiesService.getScriptProperties().getProperties());
  return moveSay_(r.bad.length ? 'Still cannot open: ' + r.bad.join('; ') + '.' : 'Every sheet and folder the project names can be opened (' + r.ok + ').');
}

/* ── 4 and 5. the old project after the move ───────────────────────────────────────────── */

/** Rows written to the old sheet after moveExport, tab by tab, to be carried by hand. */
function moveCatchUp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var m = moveRead_(ss);
  if (!m) return moveSay_('There is no "' + MOVE.TAB + '" tab here: moveCatchUp runs in the old project, before moveCleanUp.');
  var late = [];
  ss.getSheets().forEach(function (s) {
    var n = s.getName();
    if (n === MOVE.TAB || !(n in m.counts)) return;
    var now = s.getLastRow(), then = m.counts[n];
    if (now > then) late.push(n + ': rows ' + (then + 1) + ' to ' + now);
  });
  return moveSay_(late.length ? 'Written to the old sheet after the copy, to carry across by hand:\n' + late.join('\n')
                              : 'Nothing was written to the old sheet after the copy.');
}

function moveCleanUp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(MOVE.TAB);
  if (sh) ss.deleteSheet(sh);
  return moveSay_(sh ? 'The "' + MOVE.TAB + '" tab is deleted.' : 'There was no "' + MOVE.TAB + '" tab to delete.');
}

/* ── helpers ────────────────────────────────────────────────────────────────────────────── */

/** The timed jobs, each built the way the project's own installer builds it. */
function moveInstallers_() {
  var tz = function () { try { return tTz_(); } catch (e) { return Session.getScriptTimeZone(); } };
  return {
    dailyServiceFollowUp: function () { installTriggers_(); },
    transitionDigest: function () {
      TRANSITION.DIGEST_HOURS.forEach(function (h) {
        ScriptApp.newTrigger('transitionDigest').timeBased().inTimezone(tz()).atHour(h).everyDays(1).create();
      });
    },
    transitionInbox: function () { ScriptApp.newTrigger('transitionInbox').timeBased().everyMinutes(5).create(); },
    transitionReceipts: function () { ScriptApp.newTrigger('transitionReceipts').timeBased().everyMinutes(5).create(); },
    transitionWeekly: function () { tWeeklyTrigger_(); },
    transitionBuildClientBook: function () { tBookTrigger_(); },
    transitionSendBatch: function () { tSendTrigger_(); },
    transitionFindings: function () {
      ScriptApp.newTrigger('transitionFindings').timeBased().everyDays(1).atHour(T_FIND.HOUR).inTimezone(tz()).create();
    },
    gcmRefreshTick: function () { ScriptApp.newTrigger('gcmRefreshTick').timeBased().everyHours(1).create(); },
    gcmMondaySend: function () { gcmMondayTrigger_(); },
    gcmDay1030: function () { gcmDayTrigger_(); },
    lettersAttachTick: function () { ScriptApp.newTrigger('lettersAttachTick').timeBased().everyMinutes(LETTERS.EVERY_MIN).create(); }
  };
}

function moveTrigKind_(t) {
  var src = '', ev = '';
  try { src = String(t.getTriggerSource()); } catch (e) {}
  try { ev = String(t.getEventType()); } catch (e) {}
  return (src || 'CLOCK') + ' ' + (ev || 'CLOCK');
}

/** The _move tab as { meta, props, triggers, counts }, or null. */
function moveRead_(ss) {
  var sh = ss.getSheetByName(MOVE.TAB);
  if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getRange(1, 1, sh.getLastRow(), 3).getValues();
  var out = { meta: {}, props: {}, triggers: [], counts: {} };
  for (var i = 1; i < v.length; i++) {
    var kind = String(v[i][0]), key = String(v[i][1]), raw = v[i][2];
    var val = (typeof raw === 'string' && raw.indexOf('v:') === 0) ? raw.slice(2) : String(raw);
    if (kind === 'meta') out.meta[key] = val;
    else if (kind === 'prop') out.props[key] = val;
    else if (kind === 'trigger') out.triggers.push({ fn: key, kind: val });
    else if (kind === 'count') out.counts[key] = Number(val) || 0;
  }
  return out.meta.sheet ? out : null;
}

/** Every sheet and folder the settings name, plus the ones the code opens by default, tried as this account. */
function moveReach_(props) {
  var ids = {};
  Object.keys(props).forEach(function (k) {
    var v = String(props[k] || '').trim();
    if (MOVE.SECRET_KEY_RE.test(k) || !MOVE.ID_RE.test(v)) return;
    ids[v] = ids[v] || k;
  });
  try { if (typeof tBookId_ === 'function') { var b = tBookId_(); if (b && !ids[b]) ids[b] = 'the Branch Portfolio (Client Book)'; } } catch (e) {}
  try { if (typeof LETTERS !== 'undefined' && LETTERS.FOLDER && !ids[LETTERS.FOLDER]) ids[LETTERS.FOLDER] = 'the letters folder'; } catch (e) {}
  var ok = 0, bad = [];
  Object.keys(ids).forEach(function (id) {
    var name = '';
    try { name = DriveApp.getFileById(id).getName(); } catch (e) {
      try { name = DriveApp.getFolderById(id).getName(); } catch (e2) {}
    }
    if (name) ok++; else bad.push(ids[id] + ' (' + id + ')');
  });
  return { ok: ok, bad: bad };
}

function moveWho_() { try { return Session.getEffectiveUser().getEmail() || 'this account'; } catch (e) { return 'this account'; } }

function moveSay_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  try { Logger.log(msg); } catch (e) {}
  return msg;
}
