/******************************************************************
 * RRB PREMIUM DUE ENGINE — comment / survey / retention backend
 * ----------------------------------------------------------------
 * Turns a Google Sheet into the single store for everything the
 * Premium Due Engine writes: the 45-day client survey, the 75-day
 * agent retention form (+ fact-find link), manager responses, and
 * every status comment. Replaces BOTH JotForms and the old
 * "Premium Due Status" comment columns.
 *
 * SETUP (one time, ~5 minutes):
 *  1. Create a NEW Google Sheet (or open a fresh tab in Branch Portfolio).
 *  2. Extensions -> Apps Script
 *  3. Delete anything in the editor, paste THIS ENTIRE FILE in.
 *  4. Set PORTFOLIO_ID below to your Branch Portfolio spreadsheet id.
 *  5. Save (disk icon).
 *  6. Deploy -> New deployment.
 *  7. Gear icon -> Web app.
 *  8. Description: "RRB Premium Due"
 *     Execute as:  Me
 *     Who has access:  Anyone        <-- important
 *  9. Deploy. Authorize when prompted.
 * 10. Copy the Web app URL (ends in /exec).
 * 11. In the engine, click "Connect sheet" (top bar) and paste it,
 *     or set DEPLOY.SHEET_URL in premium-due/index.html on the
 *     private build.
 *
 * ACCESS: the deployment must be readable by "Anyone" so that clients
 * can answer a survey without a Google account. That does NOT mean the
 * data is open — every read that returns client information requires a
 * signed token from PremiumDueAuth.gs, and returns only the policies
 * inside that person's scope. The two unauthenticated endpoints are
 * ?type=roster (names and roles, no codes) and the client survey POST.
 *
 * Treat the /exec URL as private anyway, and never commit it here.
 ******************************************************************/

var SHEET_NAME = 'PremiumDueLog';

/* Live policy source: the Branch Portfolio spreadsheet (read-only).
   The web app runs as you, so it can read your own portfolio by ID.
   doGet(?type=policies) returns the ACTIVE FUNNEL (Lapse / Overdue / Pending)
   plus the premium-paying policies of those same clients (for churn/duplicate
   context). */
var PORTFOLIO_ID  = 'YOUR_BRANCH_PORTFOLIO_SPREADSHEET_ID';
var PORTFOLIO_GID = 0;   // the "Premium Due status" tab (gid=0)

var HEADERS = ['ts','iso','policy','client','clientNo','agent','author','code','role',
               'stage','type','reason','body','retainProb','tone',
               'surveyReason','surveyContact','surveyPromise','factFind','managerVerdict'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* READ — default returns the comment/survey/retention log;
   ?type=policies returns the live portfolio */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};

    // --- open, and deliberately so ---
    if (p.type === 'roster') return pdPublicRoster_();          // names + roles, no codes
    if (p.type === 'auth')   return pdAuth_(p.name, p.code);
    if (p.type === 'case')   return pdClientCase_(p.policy, p.code);   // client tracking, by issued code

    // --- everything below returns client data and needs a token ---
    var who = pdVerifyToken_(p.token);
    if (!who) return json_({ ok: false, error: 'auth', message: 'Sign in again.' });

    if (p.type === 'policies') return getPolicies_(who.scope);

    var sh = getSheet_();
    var values = sh.getDataRange().getValues();
    var inScope = pdScopeIndex_(who.scope);
    var out = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row[2] && !row[12]) continue;                        // blank row
      if (inScope && !inScope[String(row[5] || '')]) continue;   // not this person's agent
      var obj = {};
      for (var c = 0; c < HEADERS.length; c++) obj[HEADERS[c]] = row[c];
      out.push(obj);
    }
    return json_({ ok: true, rows: out, scopedTo: who.name });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** null scope means the whole branch; otherwise a {agentName: true} lookup. */
function pdScopeIndex_(scope) {
  if (scope === null) return null;
  var ix = {};
  for (var i = 0; i < (scope || []).length; i++) ix[scope[i]] = true;
  return ix;
}

/* WRITE — appends one comment / survey / retention / verdict row */
function doPost(e) {
  try {
    var d  = JSON.parse(e.postData.contents);

    // A client answering a survey or clicking a 60-day option has no token,
    // and should not need one. Everything a staff member writes does.
    // A client NOTE requires the access code issued with their first answer —
    // that is what stops a guessed policy number leaving comments on a case.
    var clientWrite = (d.role === 'Client') && (d.type === 'survey' || d.type === 'response');
    var clientNote  = (d.role === 'Client') && (d.type === 'clientnote');
    if (clientNote && !pdClientCodeValid_(d.policy, d.code)) {
      return json_({ ok: false, error: 'code', message: 'That access code does not match this policy.' });
    }
    if (!clientWrite && !clientNote) {
      var who = pdVerifyToken_(d.token);
      if (!who) return json_({ ok: false, error: 'auth', message: 'Sign in again.' });
      d.author = who.name;                       // the signer, not whatever was posted
      d.role   = who.role;
    }

    var sh = getSheet_();
    var ts = d.ts || Date.now();
    sh.appendRow([
      ts,
      new Date(ts).toISOString(),
      d.policy   || '',
      d.client   || '',
      d.clientNo || '',
      d.agent    || '',
      d.author   || '',
      d.code     || '',
      d.role     || '',
      d.stage    || '',
      d.type     || 'comment',
      d.reason   || '',
      d.body     || '',
      (d.retainProb == null ? '' : d.retainProb),
      d.tone     || '',
      d.surveyReason   || '',
      d.surveyContact  || '',
      d.surveyPromise  || '',
      d.factFind       || '',
      d.managerVerdict || ''
    ]);
    if (d.type === 'retention' && typeof pdEscalateRetention_ === 'function') pdEscalateRetention_(d);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ===== CLIENT CASE TRACKING =====
   A client's first answer carries a generated access code, stored in the log
   row's code column. From then on that code unlocks a CLIENT-SAFE view of the
   case — the progress bar, the letters sent, their own replies and notes, and
   whether a manager has responded. Nothing internal: no staff commentary, no
   commercial decisions, no other policies. */

function pdClientCodeValid_(policy, code) {
  code = String(code || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (code.length < 4) return false;
  var v = getSheet_().getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][2]) !== String(policy)) continue;
    var type = String(v[i][10] || '');
    if (type !== 'survey' && type !== 'response' && type !== 'clientnote') continue;
    if (String(v[i][7] || '').toUpperCase() === code) return true;
  }
  return false;
}

function pdClientCase_(policy, code) {
  if (!pdClientCodeValid_(policy, code)) {
    return json_({ ok: false, error: 'code', message: 'Check the policy number and access code.' });
  }
  var v = getSheet_().getDataRange().getValues();
  var events = [], notes = [], replied = false, verdict = false, mgrTs = 0;
  var client = '';
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][2]) !== String(policy)) continue;
    var type = String(v[i][10] || ''), ts = Number(v[i][0]) || 0, stage = String(v[i][11] || '');
    if (v[i][3]) client = String(v[i][3]);
    if (type.indexOf('outbound') === 0) events.push({ ts: ts, kind: 'us', what: 'letter', stage: stage });
    else if (type === 'response' || type === 'survey') { replied = true; events.push({ ts: ts, kind: 'you', what: String(v[i][12] || v[i][11] || 'You replied') }); }
    else if (type === 'clientnote') notes.push({ ts: ts, body: String(v[i][12] || '') });
    else if (type === 'verdict') { verdict = true; mgrTs = Math.max(mgrTs, ts); }
    else if (type === 'internal' && stage === 'manager-60') events.push({ ts: ts, kind: 'us', what: 'manager', stage: 'manager' });
  }
  events.sort(function (a, b) { return a.ts - b.ts; });
  /* the structured progress bar: each step true once reached */
  var steps = [
    { k: 'written',  lab: 'We wrote to you',        done: events.length > 0 },
    { k: 'answered', lab: 'You answered',           done: replied },
    { k: 'manager',  lab: 'With a manager',         done: events.some(function (e) { return e.what === 'manager'; }) },
    { k: 'responded',lab: 'Manager responded',      done: verdict },
    { k: 'resolved', lab: 'Resolved',               done: false }
  ];
  return json_({ ok: true, client: client, policy: String(policy), steps: steps,
                 events: events, notes: notes });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===== LIVE POLICY READER =====
   Reads the Branch Portfolio (22 cols) and returns the premium-due funnel:
   Status 1 (Lapse), 2 (Overdue), 3 (Pending) — plus premium-paying policies of
   those same clients so churn/duplicate detection has context. Current/terminal
   policies are excluded to keep the payload light and the engine focused. */

function portfolioSheet_(ss) {
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getSheetId() === PORTFOLIO_GID) return all[i];
  }
  return all[0];
}

function num_(x) { var n = Number(x); return isNaN(n) ? 0 : n; }

function mapPolicy_(row) {
  // A0 Agent | B1 Number | C2 ClientNo | D3 Client | E4 Premium | F5 IssueDate | G6 Status
  // H7 Status(2) | I8 Days | J9 InsType | K10 PaidToDate | M12 SumAssured | N13 PlanCode
  // O14 Billing | P15 Mode | Q16 APLamount | R17 StatusDesc | S18 ProjLapse | V21 Phone | W22 email
  //
  // IssueDate and APLamount matter more than their absence suggested. A policy
  // does not simply stop at 90 days if it has built a value: under the contract's
  // non-forfeiture terms the cost of cover can be met from that value, and an
  // automatic premium loan may already be running. Writing "your cover ends" to
  // the holder of such a policy is not a hard truth, it is the wrong one.
  return {
    Agent: row[0], Policy: String(row[1]), ClientNo: String(row[2] == null ? '' : row[2]),
    Client: row[3], Premium: num_(row[4]), IssueDate: row[5] || '',
    Status: num_(row[6]), StatusH: row[7] || '',
    DaysArrears: num_(row[8]), InsType: row[9], PaidToDate: row[10] || '',
    SumAssured: num_(row[12]), PlanCode: row[13] || '', Billing: row[14] || '',
    Mode: row[15] || '', APLAmount: num_(row[16]), StatusDesc: row[17] || '',
    LapseDate: row[18] || '', AmountBilled: num_(row[19]), Address: row[20] || '',
    Phone: row[21] || '', Email: row[22] || '', SendFlag: String(row[23] == null ? '' : row[23]).trim()
  };
}

function getPolicies_(scope) {
  try {
    var inScope = pdScopeIndex_(scope === undefined ? null : scope);
    var ss = SpreadsheetApp.openById(PORTFOLIO_ID);
    var sh = portfolioSheet_(ss);
    var v  = sh.getDataRange().getValues();
    var rows = [];
    for (var r = 1; r < v.length; r++) {
      if (v[r][1] !== '' && v[r][1] != null) rows.push(v[r]);
    }

    // pass 1: client numbers that have any funnel policy
    var funnelClients = {};
    for (var i = 0; i < rows.length; i++) {
      var st = num_(rows[i][6]);
      if (st === 1 || st === 2 || st === 3) funnelClients[String(rows[i][2])] = true;
    }

    // pass 2: emit funnel + premium-paying policies of those clients
    var out = [], id = 1;
    for (var j = 0; j < rows.length; j++) {
      var row = rows[j], s = num_(row[6]), cn = String(row[2] == null ? '' : row[2]);
      var desc = String(row[17] || '');
      var isFunnel  = (s === 1 || s === 2 || s === 3);
      var isContext = (s === 0 && desc === 'Premium Paying' && funnelClients[cn]);
      if (!(isFunnel || isContext)) continue;
      if (inScope && !inScope[String(row[0] || '')]) continue;   // outside this person's book
      var p = mapPolicy_(row); p.id = id++; out.push(p);
    }
    return json_({ ok: true, policies: out, total: out.length, scoped: !!inScope });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
