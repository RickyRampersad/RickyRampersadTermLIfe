/* ============================================================================
   QUERY PAL — PATCH FILE  (v10.2 → v10.3-HARDENED)
   ----------------------------------------------------------------------------
   Add this as a SEPARATE file in the Apps Script project:
       + (new file)  →  Script  →  name it  QueryPalPatch
   Nothing here overwrites Code.gs. Every name ends in QP_ or is new, so it
   cannot collide with anything you already have.

   After adding this file, make the ten small edits listed in
   PATCH-INSTRUCTIONS.md, then Deploy → Manage deployments → pencil →
   Version: New version → Deploy.
   ============================================================================ */


/* ══════════════════ 1. SERVER-SIDE ROUTING ══════════════════
   doPost currently mails whatever departmentEmail the browser sends. The web
   app is published to "Anyone" and the URL is in the page source, so that lets
   anyone drive branded branch mail to any address. Routing is decided here,
   from the query type, and the posted value is discarded.
   Keep this table in step with DATA in index.html.                          */

const QP_ROUTES = {
  'Assignment And Release': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '2', 'My Policy & Documents'],
  'Bounce Cheque': ['gloc.premiumquery@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Change in Banking Information - Life and Pension': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '3', 'Update My Details'],
  'Change in Vesting Dates': ['glocalterations@myguardiangroup.com', '1', 'Update My Details'],
  'Change of Address - Life and Pension': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '2', 'Update My Details'],
  'Change of Agent - Life and Pension': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'Update My Details'],
  'Change of Beneficiary - Life and Pension': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'Update My Details'],
  'Change of Mode - Life and Pension': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'Update My Details'],
  'Change of Name-Life and Pension': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'Update My Details'],
  'Change of Payment Method - Life and Pension': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '3', 'Update My Details'],
  'Changes – name, address, agent, beneficiary, mode': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'Update My Details'],
  'Claims Health - Submission': ['healthclaimstt@myguardiangroup.com', '3', 'Health & Medical'],
  'Claims Life&Pension - Submission': ['GLOC.IndividualLifeClaims@myguardiangroup.com', '3', 'Claims & Benefits'],
  'Complaint': ['rickyrampersadsalessupport@myguardiangroup.com', '1', "Something's Wrong"],
  'Confirmation of Funds': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'My Money & Payouts'],
  'Direct Debit & Future Payment Methods': ['glocpremium@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Direct Debit payment not actioned.': ['gloc.premiumquery@myguardiangroup.com', '1', 'Payments & Premiums'],
  'Embassy letters': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'My Policy & Documents'],
  'Escalations': ['rickyrampersadsalessupport@myguardiangroup.com', '1', "Something's Wrong"],
  'Follow up on status of Annuity surrender': ['gloccorporategroupunit@myguardiangroup.com', '1', 'My Money & Payouts'],
  'Follow up on status of death claims and in less instances procedure re same': ['glocclaims@myguardiangroup.com', '2', 'Claims & Benefits'],
  'Future Payments - Recurring Credit Card': ['gloc.premiumquery@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Future Payments - Salary Deduction': ['premiumsapplicationunit@myguardiangroup.com', '5', 'Payments & Premiums'],
  'General Insurance Renewals (Motor&Home)': ['crmsrenewals@myguardiangroup.com', '3', 'My Car & Home'],
  'Group Health - Corporate & Conversions': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Health & Medical'],
  'Group Premium Remittance - Cheque Collection': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Payments & Premiums'],
  'Integrity letters': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'My Policy & Documents'],
  'Misallocation of premium payments': ['premiumsapplicationunit@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Missing Premiums Individual Life and Pensions': ['premiumsapplicationunit@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Motor or Home Claim - Follow-up': ['GGILPCClaims@myguardiangroup.com', '2', 'My Car & Home'],
  'MPOS': ['GLOCITMORequests@myguardiangroup.com', '5', 'Tech Help (Agents)'],
  'Non receipt of pension payments or COE': ['gloc.premiumquery@myguardiangroup.com', '2', 'My Money & Payouts'],
  'Online Customer Portal (New)': ['GLOCPhoneCSRs@myguardiangroup.com', '5', 'Tech Help'],
  'Pending Cases that should have settled': ['rickyrampersadsalessupport@myguardiangroup.com', '1', "Something's Wrong"],
  'Portal showing wrong information': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'Tech Help'],
  'Premium Histories (Old & New)': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'Payments & Premiums'],
  'Premium Overdue - Conservation Follow-up': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Payments & Premiums'],
  'Procedure for processing online banking (health, life and annuity) payments': ['gloc.premiumquery@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Projection Maturity Annuity': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Projection Quote Rated Cases': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Query - Health Claim': ['ebcustomercare@myguardiangroup.com', '7', 'Health & Medical'],
  'Query on value of policy or paid to date etc.': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '3', 'My Policy & Documents'],
  'Quote - Critical Illness': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Quote - Health Insurance': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Quote - Life Insurance': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Quote - Motor & Home Insurance': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Quote - Pension & Annuity': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Quote - Personal Accident': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Quotes US Econoilife': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Recurring Credit Card Set up and Update': ['RCC@myguardiangroup.com', '3', 'Payments & Premiums'],
  'Refund Cheques': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'My Money & Payouts'],
  'Request Info': ['rickyrampersadsalessupport@myguardiangroup.com', '1', "Something's Wrong"],
  'SalesPal': ['GLOCITMORequests@myguardiangroup.com', '1', 'Tech Help (Agents)'],
  'ScanPal': ['GLOCITMORequests@myguardiangroup.com', '1', 'Tech Help (Agents)'],
  'Scripts Undelivered': ['rickyrampersadsalessupport@myguardiangroup.com', '1', "Something's Wrong"],
  'Statements – tax and csv': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'My Policy & Documents'],
  'Status of policies or value': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'My Policy & Documents'],
  'Surrenders': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '10', 'My Money & Payouts'],
  'Underwriting Assistance - Pending Case Guidance': ['rickyrampersadsalessupport@myguardiangroup.com', '1', "Something's Wrong"],
  'Withdrawals': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '3', 'My Money & Payouts'],
};

const QP_DEPT_NAMES = {
  'crmsrenewals@myguardiangroup.com': 'CRMS Renewals',
  'gloccorporategroupunit@myguardiangroup.com': 'Corporate Group Unit',
  'GGILPCClaims@myguardiangroup.com': 'GGIL P&C Claims',   /* not in the site's DEPT map — add it there too */
  'gloccustomerservicechaguanassrsc@myguardiangroup.com': 'Customer Service – Chaguanas',
  'ebcustomercare@myguardiangroup.com': 'EB Customer Care',
  'glocalterations@myguardiangroup.com': 'GLOC Alterations',
  'glocclaims@myguardiangroup.com': 'GLOC Claims',
  'GLOCITMORequests@myguardiangroup.com': 'GLOC IT/MO Requests',
  'GLOCPhoneCSRs@myguardiangroup.com': 'GLOC Phone CSRs',
  'glocpremium@myguardiangroup.com': 'GLOC Premium',
  'gloc.premiumquery@myguardiangroup.com': 'GLOC Premium Query',
  'healthclaimstt@myguardiangroup.com': 'Health Claims TT',
  'GLOC.IndividualLifeClaims@myguardiangroup.com': 'Individual Life Claims',
  'premiumsapplicationunit@myguardiangroup.com': 'Premiums Application Unit',
  'rickyrampersadsalessupport@myguardiangroup.com': 'RR Branch Sales Support',
  'RCC@myguardiangroup.com': 'Recurring Credit Card Unit',
};

/* Group terminations are built server-side by terminate_(), not by the browser,
   so they are allowed through with the department the code itself set. */
function qpRouteFor_(queryType) {
  var k = String(queryType || '').trim();
  if (/Termination$/i.test(k)) return null;                 // handled by terminate_()
  var r = QP_ROUTES[k];
  if (!r) {
    var lk = k.toLowerCase();
    for (var t in QP_ROUTES) if (t.toLowerCase() === lk) { r = QP_ROUTES[t]; k = t; break; }
  }
  if (!r) return null;
  var n = parseInt(r[1]); if (isNaN(n)) n = 5;
  return { type: k, email: r[0], tat: n + (n === 1 ? ' day' : ' days'),
           group: r[2], dept: QP_DEPT_NAMES[r[0]] || r[0] };
}

/* Applied by doPost. Returns false when the type is unknown, so nothing is sent. */
function qpApplyRoute_(d) {
  if (/Termination$/i.test(String(d.queryType || ''))) return true;   // trusted internal path
  var route = qpRouteFor_(d.queryType);
  if (!route) return false;
  d.queryType       = route.type;
  d.departmentEmail = route.email;
  d.department      = route.dept;
  d.turnaround      = route.tat;
  d.category        = route.group;
  return true;
}


/* ══════════════════ 2. RATE LIMITING ══════════════════
   The old sign-in lockout was a counter in the page's JavaScript, which anyone
   can skip. Apps Script does not expose the caller's IP, so limits are keyed on
   what we do know. Cache failures fail OPEN so the branch is never locked out. */

function qpRateLimit_(key, max, windowSec) {
  try {
    var c = CacheService.getScriptCache(), k = 'qprl_' + key;
    var n = Number(c.get(k) || 0) + 1;
    c.put(k, String(n), windowSec);
    return n <= max;
  } catch (e) { return true; }
}


/* ══════════════════ 3. ATTACHMENTS — documents, not just photos ══════════════════
   Accepts the new files[] payload and keeps the older attachPdf / attachId
   slots working. Unknown file types are never relayed.                       */

var QP_ATTACH_OK = /^(application\/(pdf|msword|rtf|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.oasis\.opendocument\.text)|text\/(plain|csv)|image\/(jpeg|png|gif|webp|heic|heif))$/i;
var QP_ATTACH_MAX_FILES = 6;
var QP_ATTACH_MAX_BYTES = 20 * 1024 * 1024;   // stay under Gmail's 25 MB message limit

function qpSafeFileName_(n) {
  n = String(n || '').replace(/[\\\/\r\n\t]+/g, ' ').replace(/[^A-Za-z0-9 ._-]+/g, '').replace(/\s+/g, ' ').trim();
  return (n || 'attachment').substring(0, 80);
}

function qpBuildAttachments_(d) {
  var blobs = [], names = [], used = 0, skipped = 0;
  var add = function (b64, mime, name) {
    if (!b64) return;
    if (blobs.length >= QP_ATTACH_MAX_FILES) { skipped++; return; }
    mime = String(mime || '').toLowerCase();
    if (!QP_ATTACH_OK.test(mime)) { skipped++; return; }
    try {
      var bytes = Utilities.base64Decode(b64);
      if (used + bytes.length > QP_ATTACH_MAX_BYTES) { skipped++; return; }
      used += bytes.length;
      var nm = qpSafeFileName_(name);
      blobs.push(Utilities.newBlob(bytes, mime, nm));
      names.push(nm);
    } catch (e) { skipped++; }
  };

  if (d.attachPdf) add(d.attachPdf, 'application/pdf', d.attachPdfName || 'form.pdf');

  if (d.files && d.files.length) {
    for (var i = 0; i < d.files.length; i++) {
      var f = d.files[i] || {};
      add(f.data, f.mime, f.name || ('attachment' + (i + 1)));
    }
  } else if (d.attachId) {                       // older single-file payload
    add(d.attachId, d.attachIdMime || 'image/jpeg', d.attachIdName || 'ID.jpg');
  }
  return { blobs: blobs, names: names, skipped: skipped };
}

/* The "Attached" line for the routed email, listing the real filenames. */
function qpAttachNote_(d, att, rowFn) {
  if (!att.blobs.length) return '';
  var parts = [];
  if (d.attachPdf) parts.push('the completed, signed form');
  if (d.attachId && !(d.files && d.files.length))
    parts.push((d.attachIdName && d.attachIdName.indexOf('RCC_Card') === 0) ? 'a photo of the credit card' : 'a valid photo ID');
  if (d.files && d.files.length) parts.push(att.names.length + (att.names.length > 1 ? ' files' : ' file'));
  return rowFn('Attached', '&#128206; ' + parts.join(' and ')
    + '<div style="margin-top:6px;color:#5e7a93;font-size:11.5px;font-weight:500;">' + att.names.join('<br>') + '</div>'
    + (att.skipped ? '<div style="margin-top:6px;color:#dd7a02;font-size:11.5px;font-weight:600;">'
                     + att.skipped + ' file(s) could not be attached — the client may need to resend them.</div>' : ''));
}


/* ══════════════════ 4. MANAGER LOOKUP ══════════════════
   AGENT_MANAGER is keyed on names that do not match the agent list, so ten
   agents silently CC the branch manager instead of their own. These aliases
   plus a first+surname fallback close the gap without editing either table. */

const QP_MANAGER_ALIAS = {
  'john boodoo':        'john boodhoo',
  'felicia rampersad2': 'felicia rampersad',
  'faizal mohammed':    'faizal mohamed',
  'joy sammah':         'joy barbara sammah'
};

/* ── TODO (branch): no manager on the hierarchy for these six, so their routed
   emails CC the branch manager by default. Add each to AGENT_MANAGER in
   Code.gs with the right manager email:
       diane lutchman statham · ganesh khodai · jonathan pantin
       janice phillip · kamla dookran · roberta laltoo
   Run auditManagerMap() any time to re-check.                             ── */

function qpNameKey_(s) {
  return String(s || '').toLowerCase()
    .replace(/[-._]/g, ' ')
    .replace(/[0-9]+/g, ' ')            // "Felicia Rampersad2"
    .replace(/\s+/g, ' ').trim();
}

/* Returns {email, how}: 'exact' | 'alias' | 'name' | 'default'. Reporting how
   the match was made matters — several agents genuinely report to the branch
   manager, so the address alone cannot tell a real mapping from a fallback. */
function qpManagerLookup_(agentName) {
  var key = qpNameKey_(agentName);
  if (!key) return { email: DEFAULT_MANAGER, how: 'default' };
  if (AGENT_MANAGER[key]) return { email: AGENT_MANAGER[key], how: 'exact' };
  var ali = QP_MANAGER_ALIAS[key];
  if (ali && AGENT_MANAGER[ali]) return { email: AGENT_MANAGER[ali], how: 'alias' };
  var parts = key.split(' ');
  if (parts.length >= 2) {
    var first = parts[0], last = parts[parts.length - 1], hit = '', n = 0;
    for (var k in AGENT_MANAGER) {
      var p = k.split(' ');
      if (p[0] === first && p[p.length - 1] === last) { hit = k; n++; }
    }
    if (n === 1) return { email: AGENT_MANAGER[hit], how: 'name' };
  }
  return { email: DEFAULT_MANAGER, how: 'default' };
}

function qpManagerFor_(agentName) {
  if (!agentName) return DEFAULT_MANAGER;
  return qpManagerLookup_(agentName).email;
}

/* Editor helper: lists any agent whose manager is not on the hierarchy. */
function auditManagerMap() {
  var out = [], seen = {};
  for (var c in AGENT_ACCESS) {
    var n = AGENT_ACCESS[c][0]; if (!n) continue;
    if (String(AGENT_ACCESS[c][2] || '') === 'branch') continue;   // shared master logins, not people
    var k = qpNameKey_(n); if (seen[k]) continue; seen[k] = 1;
    if (qpManagerLookup_(n).how === 'default') out.push(n);
  }
  var msg = out.length
    ? 'No manager mapped (CC falls back to the branch manager):\n  ' + out.join('\n  ')
    : 'Every agent resolves to a named manager.';
  Logger.log(msg); return msg;
}


/* ══════════════════ 5. AGENT PASSWORDS ══════════════════
   Agent codes follow a guessable pattern (initials + a running number) and the
   AGENT_ACCESS list never checked a password, so guessing a code opened a
   dashboard of client names and policy numbers.

   Rollout without locking the branch out:
     1. run bootstrapAgentPasswords() — prints every password ONCE
     2. hand them out
     3. set QP_REQUIRE_PASSWORD = true below, redeploy
   Until step 3, an agent with no password on file signs in exactly as before. */

const QP_REQUIRE_PASSWORD = false;   // ← flip to true once everyone has theirs
const QP_PW_PROP  = 'AGENT_PW_HASHES';
const QP_PW_SALT  = 'AGENT_PW_SALT';
const QP_AUTH_MAX = 5;               // attempts per code
const QP_AUTH_WIN = 600;             // per 10 minutes
const QP_TOKEN_TTL = 8 * 3600;       // a working day

function qpSalt_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty(QP_PW_SALT);
  if (!s) { s = Utilities.getUuid(); p.setProperty(QP_PW_SALT, s); }
  return s;
}
function qpHash_(code, pwd) {
  var raw = String(code).toUpperCase() + '|' + String(pwd) + '|' + qpSalt_();
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw));
}
function qpPwStore_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(QP_PW_PROP) || '{}'); }
  catch (e) { return {}; }
}
function qpPwSave_(m) { PropertiesService.getScriptProperties().setProperty(QP_PW_PROP, JSON.stringify(m)); }

/* Editor helper: set or change one agent's password. */
function setAgentPassword(code, pwd) {
  var m = qpPwStore_(); m[String(code).toUpperCase()] = qpHash_(code, pwd); qpPwSave_(m);
  return 'Password set for ' + code;
}

/* Editor helper: fresh random password for every code, printed once. */
function bootstrapAgentPasswords() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', m = {}, lines = [];
  for (var code in AGENT_ACCESS) {
    var pwd = '';
    for (var i = 0; i < 8; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    m[code.toUpperCase()] = qpHash_(code, pwd);
    lines.push(code + '\t' + (AGENT_ACCESS[code][0] || '') + '\t' + pwd);
  }
  qpPwSave_(m);
  var msg = 'Passwords generated — copy this list now, it cannot be shown again:\n\n'
          + 'CODE\tAGENT\tPASSWORD\n' + lines.join('\n')
          + '\n\nNow set QP_REQUIRE_PASSWORD = true in QueryPalPatch and redeploy.';
  Logger.log(msg); return msg;
}

/* Checks the password for a code from the AGENT_ACCESS list.
   Returns null to allow, or a why-string to refuse. */
function qpCheckPassword_(me, pwd) {
  if (me.src === 'tab') return null;                 // sheet rows carry their own password
  var have = qpPwStore_()[String(me.code).toUpperCase()];
  if (have) return (pwd && qpHash_(me.code, pwd) === have) ? null : 'pwd';
  return QP_REQUIRE_PASSWORD ? 'nopw' : null;
}

/* Short-lived session token, so the agent code stops being the key that travels
   on every dashboard request. */
function qpIssueToken_(me) {
  var tok = Utilities.getUuid().replace(/-/g, '');
  try {
    CacheService.getScriptCache().put('qptok_' + tok, JSON.stringify(
      { code: me.code, name: me.name, email: me.email, role: me.role }), QP_TOKEN_TTL);
  } catch (e) {}
  return tok;
}
function qpAgentFromToken_(tok) {
  if (!tok) return null;
  try {
    var v = CacheService.getScriptCache().get('qptok_' + String(tok));
    if (!v) return null;
    return findAgent_(JSON.parse(v).code);
  } catch (e) { return null; }
}

/* Sign-in over POST, so no password rides in a URL or a proxy log. */
function qpAgentAuthPost_(d) {
  return agentAuth_(d.num || d.code, d.pwd);
}


/* ══════════════════ 6. WALL — aggregates for the insights wall ══════════════════
   Computed over every row rather than the dashboard's most recent 300, so the
   panels stay exact on a busy branch. Only totals cross the wire: no client
   names, policy numbers, references or request text.                         */

function qpScopeKeys_(me) {
  if (!me || me.role === 'branch') return null;              // null = see everything
  var keys = {};
  var add = function (v) { v = normName_(v); if (v) keys[v] = 1; };
  var addRow = function (cells) {
    for (var k = 0; k < cells.length; k++) if (!roleWord_(cells[k])) add(cells[k]);
  };
  addRow(me.cells || []);
  if (me.role === 'manager') {
    var meMail = String(me.email || '').toLowerCase();
    var meName = normName_(me.name);
    for (var nm in AGENT_MANAGER) {
      if (String(AGENT_MANAGER[nm]).toLowerCase() === meMail) add(nm);
    }
    try {
      var tab = codeTable_();
      for (var t = 0; t < tab.length; t++) {
        if (normName_(tab[t].unit) === meName) { add(tab[t].name); add(tab[t].email); }
      }
    } catch (e) {}
  }
  return keys;
}

function wallStats_(code, token, days) {
  var me = qpAgentFromToken_(token) || (QP_REQUIRE_PASSWORD ? null : findAgent_(code));
  if (!me) return json({ ok: false });

  var window = parseInt(days); if (isNaN(window) || window <= 0) window = 0;   // 0 = all time
  var keys = qpScopeKeys_(me);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2)
    return json({ ok: true, role: me.role, name: me.name, empty: true });

  var wide = Math.min(29, sh.getMaxColumns());
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, wide).getValues();
  var now = new Date(), cut = window ? (now.getTime() - window * 86400000) : 0;
  var DONE = /closed|resolved|completed/i;

  var tot = 0, open = 0, done = 0, overdue = 0, chased = 0;
  var onT = 0, onTot = 0, dSum = 0, dN = 0, sSum = 0, sN = 0;
  var weeks = {}, byDept = {}, byAgent = {}, byType = {}, age = { ok: 0, soon: 0, late: 0 };
  var scoreDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, notes = [];

  var bump = function (m, k) {
    if (!k) return null;
    if (!m[k]) m[k] = { n: 0, done: 0, onT: 0, onTot: 0, dSum: 0, dN: 0, late: 0, chased: 0, sSum: 0, sN: 0 };
    return m[k];
  };

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    var ts = (row[2] instanceof Date) ? row[2] : new Date(row[2]);
    if (isNaN(ts)) continue;
    if (cut && ts.getTime() < cut) continue;
    var agent = String(row[9] || '').trim(), aMail = String(row[10] || '').trim().toLowerCase();
    if (keys && !(keys[normName_(agent)] || keys[normName_(aMail)])) continue;

    var status = String(row[3] || 'Open'), isDone = DONE.test(status);
    var tat = parseInt(row[15]); if (isNaN(tat)) tat = 5;
    var dys = parseInt(row[21]);
    var fu  = Number(row[22]) || 0;
    var sc  = Number(row[25]) || 0;
    var dept = String(row[13] || '').trim(), type = String(row[12] || '').trim();

    tot++; chased += fu;
    if (isDone) done++; else open++;

    var dRec = bump(byDept, dept), aRec = bump(byAgent, agent), tRec = bump(byType, type);
    [dRec, aRec, tRec].forEach(function (x) { if (x) { x.n++; x.chased += fu; if (isDone) x.done++; } });

    if (isDone && !isNaN(dys)) {
      dSum += dys; dN++; onTot++;
      var good = dys <= tat; if (good) onT++;
      [dRec, aRec, tRec].forEach(function (x) { if (x) { x.dSum += dys; x.dN++; x.onTot++; if (good) x.onT++; } });
    }
    if (sc > 0) {
      sSum += sc; sN++;
      if (scoreDist[sc] !== undefined) scoreDist[sc]++;
      [dRec, aRec].forEach(function (x) { if (x) { x.sSum += sc; x.sN++; } });
      var fb = String(row[26] || '').trim();
      if (fb && notes.length < 6) notes.push({ score: sc, text: fb.substring(0, 140) });
    }

    var wk = Math.floor((now.getTime() - ts.getTime()) / (7 * 86400000));
    if (wk >= 0 && wk < 12) weeks[wk] = (weeks[wk] || 0) + 1;

    if (!isDone) {
      var due = deadlineAt_(ts, row[15]), left = (due.getTime() - now.getTime()) / 86400000;
      if (left < 0)      { age.late++; overdue++; if (dRec) dRec.late++; if (aRec) aRec.late++; }
      else if (left < 1)   age.soon++;
      else                 age.ok++;
    }
  }

  var pct = function (a, b) { return b ? Math.round(a / b * 100) : null; };
  var avg = function (a, b) { return b ? Math.round(a / b * 10) / 10 : null; };
  var flat = function (m) {
    var out = [];
    for (var k in m) {
      var v = m[k];
      out.push({ name: k, n: v.n, done: v.done, late: v.late, chased: v.chased,
                 onTime: pct(v.onT, v.onTot), avg: avg(v.dSum, v.dN), csat: avg(v.sSum, v.sN) });
    }
    return out.sort(function (a, b) { return b.n - a.n; });
  };
  var wkArr = [];
  for (var w = 11; w >= 0; w--) wkArr.push(weeks[w] || 0);

  return json({
    ok: true, role: me.role, name: me.name, days: window,
    generated: Utilities.formatDate(now, Session.getScriptTimeZone() || 'America/Port_of_Spain', 'd MMM yyyy · h:mm a'),
    totals: { total: tot, open: open, done: done, overdue: overdue, chased: chased,
              onTime: pct(onT, onTot), avg: avg(dSum, dN), csat: avg(sSum, sN), rated: sN },
    weeks: wkArr, age: age, scoreDist: scoreDist, notes: notes,
    depts: flat(byDept), agents: flat(byAgent), types: flat(byType).slice(0, 8)
  });
}


/* ══════════════════ 7. SELF-CHECK ══════════════════
   Run qpSelfCheck() in the editor after deploying. It touches nothing. */

function qpSelfCheck() {
  var out = [];
  out.push('Routes loaded: ' + Object.keys(QP_ROUTES).length + ' (expected 60)');
  var r = qpRouteFor_('Bounce Cheque');
  out.push('Bounce Cheque routes to: ' + (r ? r.email + ' / ' + r.tat : 'FAILED'));
  out.push('Unknown type refused: ' + (qpRouteFor_('Pay attacker@evil.com') === null ? 'yes' : 'NO — PROBLEM'));
  out.push('Termination passes through: ' + (qpRouteFor_('Group Life Termination') === null ? 'yes' : 'no'));
  var unmapped = auditManagerMap();
  out.push('--- manager map ---'); out.push(unmapped);
  out.push('--- passwords ---');
  out.push('Passwords on file: ' + Object.keys(qpPwStore_()).length + ' of ' + Object.keys(AGENT_ACCESS).length);
  out.push('Enforcement: ' + (QP_REQUIRE_PASSWORD ? 'ON' : 'OFF (rollout mode)'));
  var msg = out.join('\n');
  Logger.log(msg); return msg;
}
