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
 * NOTE ON ACCESS: "Anyone" means anyone with the URL can read the
 * whole funnel, unauthenticated. Treat the /exec URL as a secret —
 * never commit it to this public repository. Adding a shared-key
 * check to doGet is the next hardening step.
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
    if (e && e.parameter && e.parameter.type === 'policies') return getPolicies_();
    var sh = getSheet_();
    var values = sh.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row[2] && !row[12]) continue; // skip blanks (no policy & no body)
      var obj = {};
      for (var c = 0; c < HEADERS.length; c++) obj[HEADERS[c]] = row[c];
      out.push(obj);
    }
    return json_({ ok: true, rows: out });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* WRITE — appends one comment / survey / retention / verdict row */
function doPost(e) {
  try {
    var d  = JSON.parse(e.postData.contents);
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
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
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
  // A0 Agent | B1 Number | C2 ClientNo | D3 Client | E4 Premium | G6 Status | H7 Status(2)
  // I8 Days | J9 InsType | M12 SumAssured | N13 PlanCode | O14 Billing | R17 StatusDesc
  // S18 ProjLapse | V21 Phone | W22 email
  return {
    Agent: row[0], Policy: String(row[1]), ClientNo: String(row[2] == null ? '' : row[2]),
    Client: row[3], Premium: num_(row[4]), Status: num_(row[6]), StatusH: row[7] || '',
    DaysArrears: num_(row[8]), InsType: row[9], SumAssured: num_(row[12]),
    PlanCode: row[13] || '', Billing: row[14] || '', StatusDesc: row[17] || '',
    LapseDate: row[18] || '', Phone: row[21] || '', Email: row[22] || ''
  };
}

function getPolicies_() {
  try {
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
      if (isFunnel || isContext) { var p = mapPolicy_(row); p.id = id++; out.push(p); }
    }
    return json_({ ok: true, policies: out, total: out.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
