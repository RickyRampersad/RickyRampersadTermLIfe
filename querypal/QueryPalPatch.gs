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
  if (/Enrollment$/i.test(k))  return null;                 // handled by qpEnroll_()
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
  if (/(Termination|Enrollment)$/i.test(String(d.queryType || ''))) return true;   // trusted internal paths
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


/* ══════════════════ 8. CLIENT PORTAL — codes, enrollment, history, stats ══════════════════ */

/* --- 8a. Self-service access codes ---------------------------------------
   The client enters their email; if it is on the branch's records the code is
   emailed to that address — and only that address. The response is identical
   whether the email is known or not, so the endpoint cannot be used to test
   which emails the branch holds. Company codes stay branch-issued: their scope
   is an account name, not an email, so there is nothing safe to match on.   */

function qpClientCodesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CLIENT_CODES_TAB);
  if (!sh) {
    sh = ss.insertSheet(CLIENT_CODES_TAB);
    sh.getRange(1, 1, 1, 4).setValues([['Code', 'Type', 'Name', 'Scope Value']])
      .setFontWeight('bold').setBackground('#003e66').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function qpRequestCode_(e) {
  var p = e.parameter || {};
  var email = String(p.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return json({ ok: false, error: 'Enter a valid email address.' });
  var neutral = json({ ok: true, msg: 'If that email is on our records, your access code is on its way.' });
  if (!qpRateLimit_('code_' + email, 3, 3600) || !qpRateLimit_('code_all', 30, 3600)) return neutral;

  var code = '', name = '';
  // 1 — a code already exists for this email: resend it
  var sh = qpClientCodesSheet_();
  if (sh.getLastRow() > 1) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    for (var r = 0; r < rows.length; r++) {
      if (String(rows[r][1] || '').trim().toLowerCase() !== 'company'
          && String(rows[r][3] || '').trim().toLowerCase() === email) {
        code = String(rows[r][0]).trim(); name = String(rows[r][2] || '').trim(); break;
      }
    }
  }
  // 2 — no code yet: the email must be on the Group Clients roster to get one
  if (!code) {
    try {
      var g = gcSheet_();
      if (g && g.getLastRow() > 1) {
        var ix = gcIdx_(g);
        if (ix.email != null) {
          var data = g.getRange(2, 1, g.getLastRow() - 1, g.getLastColumn()).getValues();
          for (var r2 = 0; r2 < data.length; r2++) {
            if (String(data[r2][ix.email] || '').trim().toLowerCase() === email) {
              name = ix.name != null ? String(data[r2][ix.name] || '').trim() : '';
              break;
            }
          }
        }
      }
    } catch (ge) {}
    if (name) {
      var taken = {};
      if (sh.getLastRow() > 1) {
        var cs = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
        for (var c2 = 0; c2 < cs.length; c2++) taken[String(cs[c2][0]).trim().toUpperCase()] = 1;
      }
      do { code = 'IND' + String(Math.floor(1000 + Math.random() * 9000)); } while (taken[code]);
      sh.appendRow([code, 'individual', name, email]);
    }
  }
  if (code) { try { qpSendCodeEmail_(email, name, code); } catch (se) {} }
  return neutral;                       // identical answer either way
}

function qpSendCodeEmail_(email, name, code) {
  var F = 'font-family:Segoe UI,Helvetica,Arial,sans-serif;';
  var first = (String(name || '').split(/\s+/)[0] || '').trim();
  var html = badgeHeader_('Your Access Code', 'Query Pal client portal')
    + '<div style="' + F + 'font-size:13.5px;color:#0a2138;line-height:1.75;">'
    + 'Dear ' + esc(first || 'Client') + ',<br><br>'
    + 'Here is your personal access code for the Rampersad Branch client portal. '
    + 'Use it on the site under <b>Track my cases</b> to see every request you have with us, '
    + 'follow live progress, and message the team on any open case.'
    + '<div style="background:#0a2f4f;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">'
    + '<div style="' + F + 'font-size:9px;color:#9fc9ec;font-weight:800;letter-spacing:.2em;text-transform:uppercase;">Access code</div>'
    + '<div style="font-family:Consolas,Menlo,monospace;font-size:26px;font-weight:800;color:#fff;letter-spacing:.14em;margin-top:5px;">' + esc(code) + '</div></div>'
    + 'Keep it private — anyone holding this code can see your cases. If you did not request it, you can ignore this email.'
    + '</div>' + badgeFooter_();
  var msg = { to: (TEST_MODE ? TEST_EMAIL : email), replyTo: BRANCH_SUPPORT, name: 'Ricky Rampersad Branch',
    subject: (TEST_MODE ? '[TEST] ' : '') + 'Your Query Pal access code',
    body: 'Your Query Pal access code is ' + code + '. Use it under "Track my cases" on the branch site.',
    htmlBody: html };
  var img = qpLogoInline_(); if (img) msg.inlineImages = { qplogo: img };
  MailApp.sendEmail(msg);
}

/* --- 8b. Group enrollment — the mirror of terminate_() --------------------
   Company signs in, submits the member's details with the enrollment forms
   attached, the branded request goes to Group Insurance Administration, and
   the case is logged so the autopilot chases it like everything else.       */

function qpEnroll_(d) {
  if (!qpRateLimit_('enroll', 15, 3600)) return json({ ok: false, error: 'Too many enrollment requests just now — try again shortly.' });
  var c = resolveClientCode_(d.code);
  if (!c || c.type !== 'company') return json({ ok: false, error: 'Company sign-in required.' });

  var first = String(d.first || '').trim(), last = String(d.last || '').trim();
  var member = (first + ' ' + last).trim();
  var eff = String(d.effdate || '').trim();
  var doLife = !!d.life, doHealth = !!d.health;
  if (!member || !eff || (!doLife && !doHealth))
    return json({ ok: false, error: 'Member name, effective date and at least one plan are required.' });

  var plans = []; if (doLife) plans.push('Group Life'); if (doHealth) plans.push('Group Health');
  var plansTxt = plans.join(' & ');
  var lifePol = String(d.lifepol || '').trim(), healthPol = String(d.healthpol || '').trim();
  var memberEmail = String(d.memberEmail || '').trim();
  var dob = String(d.dob || '').trim(), note = String(d.note || '').trim();
  var nFiles = (d.files && d.files.length) || 0;

  var ref = 'RRB/' + Utilities.formatDate(new Date(), tz_(), 'yyyy/MMdd/HHmmss') + '/ENRL';
  var subject = plansTxt + ' Enrollment – ' + member + ' – ' + c.name;
  var desc = 'Please enroll the following member under ' + c.name + ', effective ' + eff + ':\n\n'
    + 'Member: ' + member + (dob ? ('  (DOB ' + dob + ')') : '') + '\n'
    + (doLife   ? '• Group Life'   + (lifePol   ? ' — Policy ' + lifePol   : '') + '\n' : '')
    + (doHealth ? '• Group Health' + (healthPol ? ' — Policy ' + healthPol : '') + '\n' : '')
    + (memberEmail ? 'Member email: ' + memberEmail + '\n' : '')
    + (note ? '\nNotes from the company:\n' + note + '\n' : '')
    + (nFiles ? '\n' + nFiles + ' enrollment document' + (nFiles > 1 ? 's are' : ' is') + ' attached.\n' : '')
    + '\nKindly confirm completion on this thread.';

  var d2 = {
    reference: ref,
    category: 'Group Enrollments',
    queryType: plansTxt + ' Enrollment',
    subject: subject, description: desc,
    client: member, name: member,
    loggedBy: c.name + ' (Company)',
    policy: [lifePol, healthPol].filter(function (x) { return x; }).join(' / '),
    agent: '', agentEmail: '',
    email: memberEmail, phone: '',
    department: TERM_DEPT_NAME,
    departmentEmail: TERM_DEPT_TO.join(','),
    turnaround: String(TERM_TAT_DAYS),
    priority: 'Normal',
    assignedStaff: TERM_ASSIGNEE,
    noSalesforceAttach: true,
    files: d.files || []
  };
  try { sendRoutedEmail(d2); } catch (me) { return json({ ok: false, error: 'Could not send to the department: ' + me }); }

  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var row = []; row[0] = ref; row[1] = ''; row[2] = new Date(); row[3] = 'Open';
    row[4] = c.name + ' (Company)'; row[5] = member; row[6] = memberEmail;
    row[7] = c.scope;                               // company scope -> visible in the company portal
    row[11] = 'Group Enrollments'; row[12] = plansTxt + ' Enrollment';
    row[13] = TERM_DEPT_NAME; row[14] = TERM_DEPT_TO.join(',');
    row[15] = String(TERM_TAT_DAYS); row[16] = 'Normal';
    row[17] = subject; row[18] = desc.substring(0, 900);
    while (row.length < 29) row.push('');
    row[28] = TERM_ASSIGNEE;
    sh.appendRow(row);
    cmtSheet_().appendRow([new Date(), ref, c.name + ' (Company)', 'client',
      '📥 Enrollment submitted — ' + plansTxt + ' for ' + member + ', effective ' + eff
      + (nFiles ? (' — ' + nFiles + ' document' + (nFiles > 1 ? 's' : '') + ' attached') : ''), 'trail']);
  } catch (le) {}

  return json({ ok: true, ref: ref, plans: plansTxt });
}

/* --- 8c. Client-safe case history -----------------------------------------
   The existing casehistory endpoint takes only a reference and returns
   INTERNAL staff notes, so it must never be what the portal calls. This one
   requires the client's code, verifies the case belongs to them, and shows
   only what a client should see: milestones plus trail/client comments.     */

function qpClientHistory_(e) {
  var p = e.parameter || {};
  var c = resolveClientCode_(p.code);
  var ref = String(p.ref || '').trim();
  if (!c || !ref) return json({ ok: false });

  var allowed = false;
  try {
    var cases = JSON.parse(clientCases_({ parameter: { code: c.code } }).getContent()).cases || [];
    for (var i = 0; i < cases.length; i++) if (cases[i].ref === ref) { allowed = true; break; }
  } catch (ce) {}
  if (!allowed) return json({ ok: false });

  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var fmt = function (v) {
    var dd = (v instanceof Date) ? v : new Date(v);
    return isNaN(dd) ? '' : Utilities.formatDate(dd, tz, 'd MMM · h:mm a');
  };
  var events = [];
  var qs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (qs && qs.getLastRow() > 1) {
    var w = Math.min(29, qs.getMaxColumns());
    var qd = qs.getRange(2, 1, qs.getLastRow() - 1, w).getValues();
    for (var r = 0; r < qd.length; r++) {
      if (String(qd[r][0]).trim() !== ref) continue;
      var logged = (qd[r][2] instanceof Date) ? qd[r][2] : new Date(qd[r][2]);
      events.push({ ord: isNaN(logged) ? 0 : logged.getTime(), who: 'Branch',
        text: 'Request logged and routed to ' + String(qd[r][13] || 'the department'), when: fmt(logged) });
      var fu = Number(qd[r][22]) || 0;
      var lastFu = qd[r][23], fuOrd = (lastFu instanceof Date) ? lastFu.getTime() : (isNaN(logged) ? 1 : logged.getTime() + 1);
      for (var k = 1; k <= fu; k++) {
        events.push({ ord: fuOrd - (fu - k), who: 'Branch',
          text: (k === fu && fu > 1 ? 'Escalated with the department' : 'We followed up with the department on your behalf'),
          when: k === fu ? fmt(lastFu) : '' });
      }
      if (qd[r][27]) events.push({ ord: (qd[r][27] instanceof Date) ? qd[r][27].getTime() : 2, who: 'Department',
        text: 'The department responded on your case', when: fmt(qd[r][27]) });
      if (/closed|resolved|completed/i.test(String(qd[r][3] || '')))
        events.push({ ord: (qd[r][20] instanceof Date) ? qd[r][20].getTime() : 9e15, who: 'Branch',
          text: 'Resolved' + (qd[r][21] !== '' ? (' in ' + qd[r][21] + ' day' + (Number(qd[r][21]) === 1 ? '' : 's')) : ''),
          when: fmt(qd[r][20]) });
      if (Number(qd[r][25]) > 0) events.push({ ord: 9e15, who: 'You',
        text: 'You rated this ' + Number(qd[r][25]) + '★ — thank you', when: '' });
      break;
    }
  }
  // comments — trail and client only; internal staff notes never leave the branch
  try {
    var cm = cmtSheet_();
    if (cm.getLastRow() > 1) {
      var cd = cm.getRange(2, 1, cm.getLastRow() - 1, 6).getValues();
      for (var j = 0; j < cd.length; j++) {
        if (String(cd[j][1]).trim() !== ref) continue;
        var mode = String(cd[j][5] || '').toLowerCase(), role = String(cd[j][3] || '').toLowerCase();
        if (mode !== 'trail' && role !== 'client') continue;
        var when = (cd[j][0] instanceof Date) ? cd[j][0] : new Date(cd[j][0]);
        events.push({ ord: isNaN(when) ? 3 : when.getTime(),
          who: String(cd[j][2] || 'Branch'), text: String(cd[j][4] || ''), when: fmt(when) });
      }
    }
  } catch (he) {}
  events.sort(function (a, b) { return a.ord - b.ord; });
  return json({ ok: true, items: events.map(function (ev) { return { who: ev.who, text: ev.text, when: ev.when }; }) });
}

/* --- 8d. Client stats — response rate, resolution rate, and pace ----------
   Aggregated over only the cases this code is allowed to see, matched with
   the same rules clientCases_ uses.                                         */

function qpClientStats_(e) {
  var c = resolveClientCode_((e.parameter || {}).code);
  if (!c) return json({ ok: false });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2)
    return json({ ok: true, total: 0, open: 0, resolved: 0 });

  var scope = c.scope.toLowerCase();
  var hit = function (v) { return v && v.length >= 4 && (v === scope || v.indexOf(scope) > -1 || scope.indexOf(v) > -1); };
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(29, sh.getMaxColumns())).getValues();

  var total = 0, resolved = 0, responded = 0, onT = 0, onTot = 0;
  var respSum = 0, respN = 0, closeSum = 0, closeN = 0;
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    var match = false;
    if (c.type === 'company') {
      match = hit(String(row[7] || '').trim().toLowerCase()) || hit(String(row[5] || '').trim().toLowerCase());
    } else {
      match = String(row[6] || '').trim().toLowerCase() === scope;
    }
    if (!match) continue;
    total++;
    var done = /closed|resolved|completed/i.test(String(row[3] || ''));
    var repliedAt = (row[27] instanceof Date) ? row[27] : null;
    if (done) resolved++;
    if (done || repliedAt) responded++;
    var logged = (row[2] instanceof Date) ? row[2] : new Date(row[2]);
    if (repliedAt && !isNaN(logged)) { respSum += Math.max(0, (repliedAt - logged) / 86400000); respN++; }
    if (done && row[21] !== '' && !isNaN(+row[21])) {
      closeSum += +row[21]; closeN++;
      onTot++; var tat = parseInt(row[15]); if (isNaN(tat)) tat = 5;
      if (+row[21] <= tat) onT++;
    }
  }
  var pc = function (a, b) { return b ? Math.round(a / b * 100) : null; };
  var av = function (a, b) { return b ? Math.round(a / b * 10) / 10 : null; };
  return json({ ok: true, total: total, open: total - resolved, resolved: resolved,
    resolutionRate: pc(resolved, total), responseRate: pc(responded, total),
    avgResponse: av(respSum, respN), avgClose: av(closeSum, closeN), onTime: pc(onT, onTot) });
}


/* --- 8e. Group terminations — the leaver run ------------------------------
   The agent path (terminate_(), GET action=terminate) stays exactly as it is.
   This is the company path, and it is deliberately built like qpEnroll_:
   POST only, company sign-in required, rate limited. Terminating cover is
   destructive and dated, so it must never be reachable by pasting a URL.

   One case per member, because the department closes them one at a time and
   the conversion notice is per person. Capped, because every member costs a
   departmental email plus a notice and MailApp quota is finite.             */

var QP_LEAVER_MAX      = 25;   // members per submission
var QP_CONVERSION_DAYS = 30;   // matches the notice terminate_() already sends

/* Death in service is a CLAIM, not an administrative leaver. It is urgent, it
   goes to a different department, and the family is owed a benefit rather than
   a conversion offer. It is refused here on purpose. */
var QP_LEAVER_REASONS = {
  resignation:  'Resignation',
  retirement:   'Retirement',
  redundancy:   'Redundancy / restructuring',
  dismissal:    'Dismissal',
  end_contract: 'End of contract',
  other:        'Other'
};

/* ---- closing the anonymous GET ------------------------------------------
   action=terminate has been a GET on a webhook whose URL is printed in the
   page, carrying no proof of who is asking. Anyone who viewed source could
   end an employee's Group Life and Health cover, and trigger a conversion
   notice to that person, by pasting a URL.

   This guard requires a signed-in agent (session token or agent code) or a
   company code. Apply edit 10 in PATCH-INSTRUCTIONS.md to switch it on for
   terminate, and edit 11 for the roster and lookup endpoints, which today
   hand back an employer's staff list and policy numbers to anyone who asks.

   Set to false only to roll back in a hurry.                              */
var QP_BLOCK_GET_TERMINATE = true;

function qpGetTerminateOk_(p) {
  if (!QP_BLOCK_GET_TERMINATE) return true;
  p = p || {};
  try {
    if (p.token && qpAgentFromToken_(p.token)) return true;      // agent, session token
    if (p.code) {
      if (typeof findAgent_ === 'function' && findAgent_(p.code)) return true;   // agent, code
      var c = resolveClientCode_(p.code);
      if (c && c.type === 'company') return true;                // company portal
    }
  } catch (e) {}
  return false;
}

function qpDateParse_(s) {
  s = String(s || '').trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);          // dd/mm/yyyy, as the agent path sends
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function qpDaysBetween_(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function qpFmtDate_(d) {
  return Utilities.formatDate(d, tz_(), 'dd/MM/yyyy');
}

function qpLeavers_(d) {
  if (!qpRateLimit_('leavers', 10, 3600))
    return json({ ok: false, error: 'Too many termination submissions just now — try again shortly.' });

  var c = resolveClientCode_(d.code);
  if (!c || c.type !== 'company') return json({ ok: false, error: 'Company sign-in required.' });

  var members = (d.members && d.members.length) ? d.members : null;
  if (!members) return json({ ok: false, error: 'Select at least one employee to report as a leaver.' });
  if (members.length > QP_LEAVER_MAX)
    return json({ ok: false, error: 'Please report no more than ' + QP_LEAVER_MAX + ' leavers at a time.' });

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var results = [], errors = [];

  for (var i = 0; i < members.length; i++) {
    var m = members[i] || {};
    var first = String(m.first || '').trim(), last = String(m.last || '').trim();
    var member = (first + ' ' + last).trim();
    var doLife = !!m.life, doHealth = !!m.health;
    var reasonKey = String(m.reason || 'resignation').trim();

    if (!member) { errors.push('A row was missing the employee name.'); continue; }

    if (/^death$/i.test(reasonKey)) {
      errors.push(member + ' — a death in service is a claim, not a termination. '
        + 'Please log it under Claims so it is handled urgently and the family is paid.');
      continue;
    }
    var reason = QP_LEAVER_REASONS[reasonKey] || QP_LEAVER_REASONS.other;

    var effRaw = String(m.effdate || d.effdate || '').trim();
    var effDate = qpDateParse_(effRaw);
    if (!effDate) { errors.push(member + ' — a valid last day of cover is required.'); continue; }
    if (!doLife && !doHealth) { errors.push(member + ' — pick Group Life, Group Health, or both.'); continue; }

    var eff = qpFmtDate_(effDate);
    var backdatedBy = qpDaysBetween_(effDate, today);
    var isBackdated = backdatedBy > 0;

    var plans = []; if (doLife) plans.push('Group Life'); if (doHealth) plans.push('Group Health');
    var plansTxt = plans.join(' & ');
    var lifePol = String(m.lifepol || '').trim(), healthPol = String(m.healthpol || '').trim();
    var memberEmail = String(m.memberEmail || '').trim();
    var note = String(m.note || d.note || '').trim();

    var ref = 'RRB/' + Utilities.formatDate(new Date(), tz_(), 'yyyy/MMdd/HHmmss') + '/TERM' + (i ? '-' + (i + 1) : '');
    var subject = plansTxt + ' Termination – ' + member + ' – ' + c.name;

    var desc = 'Please terminate the following member under ' + c.name + ', effective ' + eff + ':\n\n'
      + 'Member: ' + member + '\n'
      + 'Reason: ' + reason + '\n'
      + (doLife   ? '• Group Life'   + (lifePol   ? ' — Policy ' + lifePol   : '') + '\n' : '')
      + (doHealth ? '• Group Health' + (healthPol ? ' — Policy ' + healthPol : '') + '\n' : '')
      + (memberEmail ? 'Member email: ' + memberEmail + '\n' : '')
      + (isBackdated
          ? '\n⚠ BACKDATED — this last day of cover is ' + backdatedBy + ' day'
            + (backdatedBy === 1 ? '' : 's') + ' in the past.\n'
            + 'Please check for premium already collected beyond it, and for any claim '
            + 'incurred after it that may have been paid in error.\n'
          : '')
      + (note ? '\nNotes from the company:\n' + note + '\n' : '')
      + '\nReported by ' + c.name + ' through the company portal.'
      + '\nKindly confirm completion on this thread.';

    var d2 = {
      reference: ref,
      category: 'Group Terminations',
      queryType: plansTxt + ' Termination',
      subject: subject, description: desc,
      client: member, name: member,
      loggedBy: c.name + ' (Company)',
      policy: [lifePol, healthPol].filter(function (x) { return x; }).join(' / '),
      agent: '', agentEmail: '',
      email: memberEmail, phone: '',
      department: TERM_DEPT_NAME,
      departmentEmail: TERM_DEPT_TO.join(','),
      turnaround: String(TERM_TAT_DAYS),
      priority: isBackdated ? 'High' : 'Normal',
      assignedStaff: TERM_ASSIGNEE,
      noSalesforceAttach: true,
      files: []
    };
    try { sendRoutedEmail(d2); }
    catch (me) { errors.push(member + ' — could not send to the department: ' + me); continue; }

    try {
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      var row = []; row[0] = ref; row[1] = ''; row[2] = new Date(); row[3] = 'Open';
      row[4] = c.name + ' (Company)'; row[5] = member; row[6] = memberEmail;
      row[7] = c.scope;                               // company scope -> visible in the company portal
      row[11] = 'Group Terminations'; row[12] = plansTxt + ' Termination';
      row[13] = TERM_DEPT_NAME; row[14] = TERM_DEPT_TO.join(',');
      row[15] = String(TERM_TAT_DAYS); row[16] = isBackdated ? 'High' : 'Normal';
      row[17] = subject; row[18] = desc.substring(0, 900);
      while (row.length < 29) row.push('');
      row[28] = TERM_ASSIGNEE;
      sh.appendRow(row);
      cmtSheet_().appendRow([new Date(), ref, c.name + ' (Company)', 'client',
        '📤 Termination submitted — ' + plansTxt + ' for ' + member + ', last day ' + eff
        + ' (' + reason + ')' + (isBackdated ? ' — BACKDATED by ' + backdatedBy + ' days' : ''), 'trail']);
    } catch (le) {}

    var notified = false;
    if (memberEmail) { try { qpConversionNotice_(member, memberEmail, plans, eff, c.name); notified = true; } catch (ne) {} }

    results.push({ ref: ref, member: member, plans: plansTxt, effective: eff,
                   backdated: isBackdated, noticeSent: notified });
  }

  if (!results.length)
    return json({ ok: false, error: errors.join(' \n') || 'Nothing could be submitted.' });
  return json({ ok: true, results: results, errors: errors, count: results.length });
}

/* The leaver's own copy: what ended, when, and the window in which they can
   take the cover into their own name without new medical evidence. Sent from
   the company path only — the agent path keeps using terminate_()'s notice,
   so a member never receives two. */
function qpConversionNotice_(member, email, plans, eff, companyName) {
  var deadline = new Date(); deadline.setDate(deadline.getDate() + QP_CONVERSION_DAYS);
  var what = plans.join(' and ');
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#22303c;line-height:1.6">'
    + '<p>Dear ' + qpEsc_(member) + ',</p>'
    + '<p>We have been notified by <b>' + qpEsc_(companyName) + '</b> that your <b>' + qpEsc_(what)
    + '</b> cover under their group plan ends on <b>' + qpEsc_(eff) + '</b>.</p>'
    + '<div style="border-left:3px solid #F08A24;background:#FFF8F0;padding:12px 16px;margin:16px 0">'
    + '<p style="margin:0"><b>You may be able to keep this cover in your own name.</b> Group plans '
    + 'normally allow you a short window — commonly ' + QP_CONVERSION_DAYS + ' days — to convert to an '
    + 'individual policy <b>without new medical questions</b>. After that window, cover would depend on '
    + 'your health at the time.</p>'
    + '<p style="margin:8px 0 0">Please contact us on or before <b>' + qpEsc_(qpFmtDate_(deadline))
    + '</b> if you would like us to price it. The exact window and terms are set by your group policy '
    + 'and we will confirm them for you.</p></div>'
    + '<p>If you had a claim for treatment received <i>before</i> your cover ended, you can still submit '
    + 'it — there is normally a limited period to do so, and we will help you with it.</p>'
    + '<p>Nothing here is a bill or a request for payment. It is simply so you do not lose a right you '
    + 'currently hold without knowing it.</p>'
    + '<p>Kind regards,<br><b>Ricky Rampersad Branch</b><br>Guardian Life of the Caribbean</p>'
    + '<p style="font-size:11.5px;color:#7c8b98;border-top:1px solid #e3e9ee;padding-top:10px">'
    + 'This notice is a courtesy summary and is not the policy. Conversion rights, eligibility and time '
    + 'limits are governed by the group policy wording and Guardian\'s underwriting rules.</p></div>';

  var msg = { to: email, subject: 'Your group cover is ending — what you can do next',
              name: 'Ricky Rampersad Branch', htmlBody: html };
  try { var img = qpLogoInline_(); if (img) msg.inlineImages = { qplogo: img }; } catch (e) {}
  MailApp.sendEmail(msg);
}

function qpEsc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  out.push('--- client portal ---');
  out.push('Portal endpoints loaded: requestcode, enroll, leavers, clienthistory, clientstats');
  out.push('Enrollment bypasses the router: ' + (qpRouteFor_('Group Life Enrollment') === null ? 'yes' : 'NO — PROBLEM'));
  out.push('--- terminations ---');
  out.push('Leaver run bypasses the router: ' + (qpRouteFor_('Group Life Termination') === null ? 'yes' : 'NO — PROBLEM'));
  out.push('Death in service is refused as a leaver: ' + (QP_LEAVER_REASONS.death === undefined ? 'yes' : 'NO — PROBLEM'));
  out.push('Max leavers per submission: ' + QP_LEAVER_MAX);
  out.push('GET guard armed: ' + (QP_BLOCK_GET_TERMINATE ? 'yes' : 'NO — set QP_BLOCK_GET_TERMINATE = true'));
  out.push('Anonymous call refused by the guard: ' + (qpGetTerminateOk_({}) === false ? 'yes' : 'NO — PROBLEM'));
  out.push('NOTE: the guard only bites once edits 10 and 11 call it from doGet in Code.gs.');
  var msg = out.join('\n');
  Logger.log(msg); return msg;
}
