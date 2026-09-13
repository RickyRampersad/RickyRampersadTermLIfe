/**
 * RRB CSEC Study Hub — sync service.
 *
 * Lets one family (or one teacher's class) share study progress across devices.
 * A group has a code; anyone holding the code can read and write that group.
 * That is the whole security model, and it is the same model as a shared link —
 * see "What this does and does not protect" below before deploying it.
 *
 * ── Deploy (one time, ~3 minutes, desktop browser) ────────────────────────────
 *   1. Create a new Google Sheet named "RRB CSEC Sync". Copy its ID from the URL
 *      (the long string between /d/ and /edit) into SHEET_ID below.
 *   2. script.google.com → New project → delete the sample code.
 *   3. Paste this whole file → save (name it "RRB CSEC Sync").
 *   4. Run `setup` once from the editor and authorise when asked. This creates
 *      the tabs and proves the Sheet ID is right before anyone relies on it.
 *   5. Deploy → New deployment → type: Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *   6. Copy the Web app URL (ends in /exec) and paste it into
 *      csec/assets/csec-sync.js as SYNC_URL, replacing RRB_CSEC_SYNC_URL.
 *   7. Open <that URL>?action=ping in a browser. You should see {"ok":true}.
 *
 * Re-deploying after an edit: Deploy → Manage deployments → edit → New version.
 * Keeping the same deployment keeps the same /exec URL.
 *
 * ── What this does and does not protect ───────────────────────────────────────
 * DOES:  keeps groups apart — without a code you cannot read or write a group;
 *        caps payload sizes and records per group; supports hard delete.
 * DOES NOT: authenticate anybody. The code IS the credential. Whoever has it
 *        can read the group's names and practice scores and can write to them.
 *        Treat a group code like a house key: give it to family and to the
 *        child's teacher, and to nobody else. If it leaks, make a new group.
 *
 * ── What is stored ────────────────────────────────────────────────────────────
 * Per profile: the display name typed into the hub, role, form, school, the
 * chosen subject list, and practice performance (per-strand counts, session
 * and test history). Nothing else. No date of birth, no address, no contact
 * details, no school reports, no marks from the school. Ask families to use a
 * first name or initials — the hub says so at sign-up.
 * `action=forget` deletes a profile's rows outright; `action=forgetGroup`
 * deletes the whole group. Neither is a soft delete.
 */

var SHEET_ID  = '1b5kOwEP9sJSyIzgp6YeyBEi-KZO2DaacaGKNOOJMCJE';   // "RRB CSEC Sync" in Drive
var MAX_BYTES = 180000;   // per record — a very heavy student is ~30 KB
var MAX_ROWS  = 400;      // per group — a big class plus room to spare
var CODE_ABC  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // no O/0, no I/1

/* ───────────────────────────── entry points ───────────────────────────── */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (String(p.action || '')) {
      case 'ping':  return json({ ok: true, service: 'rrb-csec-sync', version: 1 });
      case 'pull':  return json(pull(p.code));
      default:      return json({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

/**
 * Posted as text/plain so the browser sends a simple request and skips the
 * CORS preflight, which Apps Script cannot answer.
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'bad_json' });
  }
  try {
    switch (String(body.action || '')) {
      case 'create':      return json(createGroup(body.label, body.kind));
      case 'push':        return json(push(body.code, body.profile, body.progress));
      case 'forget':      return json(forget(body.code, body.profileId));
      case 'forgetGroup': return json(forgetGroup(body.code));
      default:            return json({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

/* ───────────────────────────── operations ───────────────────────────── */

function createGroup(label, kind) {
  var code = newCode();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet('groups').appendRow([
      code,
      String(label || 'Study group').slice(0, 60),
      kind === 'class' ? 'class' : 'family',
      new Date(),
      new Date()
    ]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, code: code };
}

function pull(code) {
  code = normalise(code);
  if (!code) return { ok: false, error: 'no_code' };
  var g = findGroup(code);
  if (!g) return { ok: false, error: 'unknown_code' };

  touch(code);
  var rows = sheet('records').getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (normalise(rows[i][0]) !== code) continue;
    var profile, progress;
    try { profile  = JSON.parse(rows[i][2] || 'null'); } catch (e) { profile = null; }
    try { progress = JSON.parse(rows[i][3] || 'null'); } catch (e) { progress = null; }
    out.push({
      profileId: String(rows[i][1]),
      profile: profile,
      progress: progress,
      updatedAt: rows[i][4] ? new Date(rows[i][4]).getTime() : 0
    });
  }
  return { ok: true, code: code, label: g.label, kind: g.kind, records: out };
}

function push(code, profile, progress) {
  code = normalise(code);
  if (!code) return { ok: false, error: 'no_code' };
  if (!findGroup(code)) return { ok: false, error: 'unknown_code' };
  if (!profile || !profile.id) return { ok: false, error: 'no_profile' };

  var pJson = JSON.stringify(profile  || null);
  var gJson = JSON.stringify(progress || null);
  if (pJson.length + gJson.length > MAX_BYTES) return { ok: false, error: 'too_large' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet('records');
    var rows = sh.getDataRange().getValues();
    var mine = 0, hit = -1;
    for (var i = 1; i < rows.length; i++) {
      if (normalise(rows[i][0]) !== code) continue;
      mine++;
      if (String(rows[i][1]) === String(profile.id)) hit = i + 1;   // 1-based row
    }
    if (hit === -1 && mine >= MAX_ROWS) return { ok: false, error: 'group_full' };

    var now = new Date();
    if (hit > 0) {
      sh.getRange(hit, 3, 1, 3).setValues([[pJson, gJson, now]]);
    } else {
      sh.appendRow([code, String(profile.id), pJson, gJson, now]);
    }
    touch(code);
    return { ok: true, updatedAt: now.getTime() };
  } finally {
    lock.releaseLock();
  }
}

function forget(code, profileId) {
  code = normalise(code);
  if (!code || !profileId) return { ok: false, error: 'bad_request' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet('records');
    var rows = sh.getDataRange().getValues();
    var removed = 0;
    for (var i = rows.length - 1; i >= 1; i--) {
      if (normalise(rows[i][0]) === code && String(rows[i][1]) === String(profileId)) {
        sh.deleteRow(i + 1);
        removed++;
      }
    }
    return { ok: true, removed: removed };
  } finally {
    lock.releaseLock();
  }
}

function forgetGroup(code) {
  code = normalise(code);
  if (!code) return { ok: false, error: 'no_code' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var removed = 0, i;
    var rec = sheet('records'), rows = rec.getDataRange().getValues();
    for (i = rows.length - 1; i >= 1; i--) {
      if (normalise(rows[i][0]) === code) { rec.deleteRow(i + 1); removed++; }
    }
    var grp = sheet('groups'), grows = grp.getDataRange().getValues();
    for (i = grows.length - 1; i >= 1; i--) {
      if (normalise(grows[i][0]) === code) grp.deleteRow(i + 1);
    }
    return { ok: true, removed: removed };
  } finally {
    lock.releaseLock();
  }
}

/* ───────────────────────────── helpers ───────────────────────────── */

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Codes are shown as ABCD-EFGH but compared without the dash or case. */
function normalise(c) {
  return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function newCode() {
  var s = '';
  for (var i = 0; i < 8; i++) s += CODE_ABC.charAt(Math.floor(Math.random() * CODE_ABC.length));
  return s.slice(0, 4) + '-' + s.slice(4);
}

function findGroup(code) {
  var rows = sheet('groups').getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (normalise(rows[i][0]) === code) {
      return { code: code, label: rows[i][1], kind: rows[i][2] };
    }
  }
  return null;
}

function touch(code) {
  try {
    var sh = sheet('groups'), rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (normalise(rows[i][0]) === code) { sh.getRange(i + 1, 5).setValue(new Date()); return; }
    }
  } catch (e) {}
}

function sheet(name) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(name === 'groups'
      ? ['code', 'label', 'kind', 'createdAt', 'lastSeen']
      : ['code', 'profileId', 'profile', 'progress', 'updatedAt']);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(name === 'groups'
      ? ['code', 'label', 'kind', 'createdAt', 'lastSeen']
      : ['code', 'profileId', 'profile', 'progress', 'updatedAt']);
  }
  return sh;
}

/** Run once from the editor after pasting, before deploying. */
function setup() {
  sheet('groups');
  sheet('records');
  var t = createGroup('Deployment test', 'family');
  Logger.log('Tabs ready. Test group created: ' + t.code);
  Logger.log('Now delete that test group with forgetGroup("' + t.code + '") if you wish.');
  return t;
}
