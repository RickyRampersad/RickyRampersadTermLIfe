/******************************************************************
 * RRB PREMIUM DUE — SERVER-SIDE SIGN-IN AND SCOPE
 * ----------------------------------------------------------------
 * Until now the engine checked access codes in the browser, against a
 * list shipped inside the page. Anyone who opened it — including a
 * client following a survey link — could read every staff code from
 * the source, or skip the check entirely from the console. Role
 * separation was presentation, not security.
 *
 * This moves the roster into the sheet and the decision onto the
 * server. Three things change:
 *
 *   1. The page never receives anybody's code. The login dropdown is
 *      built from names and roles only.
 *   2. A signed token, not a role string in JavaScript, decides what
 *      you can read.
 *   3. The portfolio read is SCOPED. An agent is sent their own book —
 *      roughly fifty policies — instead of all 10,029 and a promise
 *      that the interface will hide the rest.
 *
 * That third point matters twice over. The old ?type=policies handed
 * the entire branch book, with client names, emails and phone numbers,
 * to anyone who had the /exec URL and no credentials at all. It also
 * moved 3.67 MB per pull; an agent now moves a fraction of that.
 *
 * WHAT THIS STILL IS NOT
 * A code is a shared secret typed into a browser, so this is sign-in,
 * not identity. Someone who has a valid code can use it, and someone
 * who shares theirs has shared their access. It stops code harvesting
 * and out-of-scope reads. It is not a substitute for Google sign-in,
 * which is the right end state if this ever holds more than it does now.
 *
 * SETUP
 *  1. Paste this file into the same Apps Script project as
 *     PremiumDue.gs and PremiumDueTemplates.gs.
 *  2. Run pdSetupRoster() once. It creates a 'Roster' tab with the
 *     columns below and a starter row for you.
 *  3. Fill the tab in: one row per person who signs in.
 *
 *        name      | exactly as it appears in the portfolio's Agent column
 *        role      | Branch Manager | ABM / Branch Manager | Unit Manager
 *                  | Sales Support  | Agent
 *        agentId   | optional, for reference
 *        code      | their access code, e.g. AB-123
 *        manager   | the name of the person they report to (blank for the BM)
 *        active    | TRUE / FALSE — set FALSE to revoke immediately
 *
 *  4. Re-deploy the web app (Deploy → Manage deployments → edit → Deploy).
 *  5. In the engine, leave DEPLOY.CODES empty. It now asks the server.
 *
 * Scope follows the manager column, so the tree is maintained in one
 * place instead of three. Sales Support and Branch Manager see the whole
 * branch; a Unit Manager or ABM sees everyone beneath them; an Agent
 * sees themselves.
 ******************************************************************/

var ROSTER_SHEET = 'Roster';
var ROSTER_HEADERS = ['name', 'role', 'agentId', 'code', 'manager', 'active'];
var TOKEN_TTL_MS = 12 * 60 * 60 * 1000;    // one working day

/* ============================ the roster ============================ */

function pdRosterSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ROSTER_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ROSTER_SHEET);
    sh.appendRow(ROSTER_HEADERS);
    sh.getRange(1, 1, 1, ROSTER_HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Run once from the editor. Creates the tab and a starter row. */
function pdSetupRoster() {
  var sh = pdRosterSheet_();
  if (sh.getLastRow() <= 1) {
    sh.appendRow(['Ricky Rampersad', 'Branch Manager', '', 'CHANGE-ME', '', true]);
    sh.appendRow(['', '', '', '', '', '']);
  }
  SpreadsheetApp.getUi().alert(
    'Roster tab ready.\n\nFill in one row per person, then re-deploy the web app ' +
    '(Deploy → Manage deployments → edit → Deploy).\n\n' +
    'Set active to FALSE to revoke someone immediately — no re-deploy needed for that.');
}

function pdRoster_() {
  var sh = pdRosterSheet_();
  var v = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var name = String(v[i][0] || '').trim();
    if (!name) continue;
    var active = v[i][5];
    if (active === false || String(active).toUpperCase() === 'FALSE') continue;
    out.push({
      name: name,
      role: String(v[i][1] || 'Agent').trim(),
      agentId: String(v[i][2] || '').trim(),
      code: String(v[i][3] || '').trim().toUpperCase(),
      manager: String(v[i][4] || '').trim()
    });
  }
  return out;
}

function pdRoleKey_(role) {
  role = String(role || '');
  if (role === 'Branch Manager') return 'bm';
  if (role === 'ABM / Branch Manager') return 'abm';
  if (role === 'Unit Manager') return 'unit';
  if (role === 'Sales Support') return 'support';
  return 'agent';
}

/**
 * Whose policies this person may read.
 * Returns null for "the whole branch" — support and BM.
 * Walks the manager column downward, so the tree lives in one place.
 */
function pdScopeFor_(name, roster) {
  var me = null, byManager = {};
  for (var i = 0; i < roster.length; i++) {
    var r = roster[i];
    if (r.name === name) me = r;
    (byManager[r.manager] = byManager[r.manager] || []).push(r.name);
  }
  if (!me) return [];
  var rk = pdRoleKey_(me.role);
  if (rk === 'bm' || rk === 'support' || rk === 'abm' && !me.manager) return null;
  if (rk === 'agent') return [name];

  var seen = {}, stack = [name];
  while (stack.length) {
    var cur = stack.pop();
    if (seen[cur]) continue;
    seen[cur] = true;
    var kids = byManager[cur] || [];
    for (var k = 0; k < kids.length; k++) if (!seen[kids[k]]) stack.push(kids[k]);
  }
  return Object.keys(seen);
}

/* ============================ tokens ============================ */
/* Stateless and signed, so there is no session table to keep. The token
   carries only who and until-when; role and scope are looked up fresh on
   every request, so setting active to FALSE takes effect on the next call
   rather than whenever a token happens to expire. */

function pdSecret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('PD_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('PD_SECRET', s);
  }
  return s;
}
function pdB64_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}
function pdSign_(payload) {
  return pdB64_(Utilities.computeHmacSha256Signature(payload, pdSecret_()));
}
function pdMintToken_(name) {
  var payload = name + '|' + (Date.now() + TOKEN_TTL_MS);
  return pdB64_(Utilities.newBlob(payload).getBytes()) + '.' + pdSign_(payload);
}

/** Returns the signed-in person, or null. */
function pdVerifyToken_(token) {
  if (!token) return null;
  var parts = String(token).split('.');
  if (parts.length !== 2) return null;
  var payload;
  try {
    payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
  } catch (e) { return null; }
  if (pdSign_(payload) !== parts[1]) return null;          // tampered or forged

  var bits = payload.split('|');
  if (bits.length !== 2) return null;
  if (Number(bits[1]) < Date.now()) return null;           // expired

  var roster = pdRoster_();
  for (var i = 0; i < roster.length; i++) {
    if (roster[i].name === bits[0]) {
      var r = roster[i];
      return {
        name: r.name, role: r.role, roleKey: pdRoleKey_(r.role),
        agentId: r.agentId, scope: pdScopeFor_(r.name, roster)
      };
    }
  }
  return null;                                             // removed or deactivated
}

/* ============================ endpoints ============================ */

/** Names and roles only — never codes. Builds the login dropdown. */
function pdPublicRoster_() {
  var roster = pdRoster_();
  var out = roster.map(function (r) {
    return { name: r.name, role: r.role, agentId: r.agentId };
  });
  return json_({ ok: true, roster: out });
}

/**
 * ?type=auth&name=...&code=...
 * A wrong code and an unknown name return the same message and take a
 * similar amount of work, so the response cannot be used to discover
 * who is on the roster.
 */
function pdAuth_(name, code) {
  Utilities.sleep(250);                                    // blunt the brute force
  name = String(name || '').trim();
  code = String(code || '').trim().toUpperCase();
  var roster = pdRoster_();
  var found = null;
  for (var i = 0; i < roster.length; i++) {
    if (roster[i].name === name && roster[i].code && pdSafeEq_(roster[i].code, code)) found = roster[i];
  }
  if (!found) return json_({ ok: false, error: 'That name and code do not match.' });

  var scope = pdScopeFor_(found.name, roster);
  return json_({
    ok: true,
    token: pdMintToken_(found.name),
    name: found.name,
    role: found.role,
    roleKey: pdRoleKey_(found.role),
    agentId: found.agentId,
    scopeCount: scope === null ? 0 : scope.length,
    wholeBranch: scope === null,
    expires: Date.now() + TOKEN_TTL_MS
  });
}

/** Constant-time-ish compare, so timing does not leak the code. */
function pdSafeEq_(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
