/* ============================================================
   QUERY PAL BACKEND VERSION: v6.9-COLOR-CODE (2026-07)
   Everything from v5-HTML-EMAIL is preserved, PLUS:
     • Agent login   (?action=agentauth&num=...&pwd=...) — the pair is checked
       against the Agent Codes sheet tab (Agent Number + Password columns).
       Master codes in AGENT_ACCESS below work with either field on its own.
     • Dashboard     (?action=myqueries&code=...)  — agent / manager / branch views
     • Tracking      (?action=track&ref=...)       — powers "Track a request" on the site
     • Auto close-out — set Status to Closed/Resolved → Date Closed + Days to Close fill in
     • Optional RAI proxy (doPost action:'rai') — needs ANTHROPIC_API_KEY in Script Properties

   If login or the dashboard says "needs the upgraded script",
   THIS code is NOT deployed. After pasting: Deploy > Manage
   deployments > pencil > Version: NEW VERSION > Deploy.
   (Saving alone does nothing.)  Run getVersion() to confirm.

   AGENT CODES — put them in any tab EXCEPT "Queries" (e.g. "Agent Codes"),
   one agent per row:   Premchand Dookran | PD427 | premchand.dookran@...
   Column order is free; codes aren't case-sensitive (min 3 chars); enter
   all-digit codes as TEXT so leading zeros hold. Add/revoke = edit the sheet.

   ROLES — worked out automatically from AGENT_MANAGER below:
     Ricky → sees the whole branch · Gary / Kerwyn / Akaash → see their teams
     everyone else → their own queries only.
   Optional overrides in the codes tab: a ROLE cell ("Manager" or "Branch")
   and/or a MANAGER cell (the manager's name as written in the manager's row).
   ============================================================ */
function getVersion(){ return 'v7.2-WALL'; }

/* Rampersad Branch shield logo — gold gradient, dark checkmark (inline in routed emails). */
var LOGO_B64 = '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';

/* ================================ AGENT ACCESS =================================
   One password per agent. EDIT THIS LIST to add, change or revoke access —
   then redeploy (Deploy > Manage deployments > pencil > New version > Deploy).

   Format:    'PASSWORD': ['Full Name', 'email'],
   Passwords aren't case-sensitive. Roles are worked out automatically:
   Ricky = branch (sees all) · Gary / Kerwyn / Akaash = manager (see their
   teams from AGENT_MANAGER below) · everyone else = agent (sees own only).
   To override, add a third item: 'manager' or 'branch'.
   (The "Agent Codes" sheet tab still works as a second list — this one wins.)
   ============================================================================== */
const AGENT_ACCESS = {
  '260026':  ['Ricky Rampersad', 'ricky.rampersad@myguardiangroup.com', 'branch'],
  'RRB2026': ['Rampersad Branch', '', 'branch'],                    // shared branch master
  'AE101': ["Aidan Eugene", "aidan.eugene@myguardiangroup.com"],
  'AJ102': ["Alyssa Joseph", "alyssa.joseph@myguardiangroup.com"],
  'AK103': ["Akaash Kalladeen", "Akaash.Kalladeen@myguardiangroup.com"],
  'AS104': ["Anthony Simmons", "anthony.simmons@myguardiangroup.com"],
  'CB105': ["Chris Badaloo", "chris.badaloo@myguardiangroup.com"],
  'CF106': ["Crystal Fraser", "crystal.fraser@myguardiangroup.com"],
  'DB107': ["Daniel Bhagwandas", "daniel.bhagwandas@myguardiangroup.com"],
  'DM108': ["Darryl Manick", "darryl.manick@myguardiangroup.com"],
  'DH109': ["Dhalina Heeraman", "dhalina.heeraman@myguardiangroup.com"],
  'DL110': ["Diane Lutchman statham", "diane.lutchman-statham@myguardiangroup.com"],
  'FM111': ["Faizal Mohammed", "faizal.mohammed@myguardiangroup.com"],
  'FM112': ["Fawwaz Mohamed", "fawwaz.mohamed@myguardiangroup.com"],
  'FR113': ["Felicia Rampersad2", "felicia.rampersad2@myguardiangroup.com"],
  'GK114': ["Ganesh Khodai", "ganesh.khodai@myguardiangroup.com"],
  'GS115': ["Gary Sookdeo", "gary.sookdeo@myguardiangroup.com"],
  'JB116': ["Jesus Boodhoo", "jesus.boodhoo@myguardiangroup.com"],
  'JP117': ["Jonathan Pantin", "jonathan.pantin@myguardiangroup.com"],
  'JP118': ["Janice Phillip", "janice.phillip@myguardiangroup.com"],
  'JK119': ["Jamil Khan", "jamil.khan@myguardiangroup.com"],
  'JB120': ["John Boodoo", "john.boodoo@myguardiangroup.com"],
  'JS121': ["Joy Sammah", "joy.sammah@myguardiangroup.com"],
  'KD122': ["Kamla Dookran", "kamla.dookran@myguardiangroup.com"],
  'KR123': ["Kerwyn Ramroach", "kerwyn.ramroach@myguardiangroup.com"],
  'MS124': ["Malcolm Sooknanan", "malcolm.sooknanan@myguardiangroup.com"],
  'MP125': ["Meera Persad khan", "meera.persad-khan@myguardiangroup.com"],
  'NS126': ["Naila Samuel", "naila.samuel@myguardiangroup.com"],
  'NM127': ["Narissa Mohammed", "narissa.mohammed@myguardiangroup.com"],
  'NR128': ["Neil Ramnanan", "neil.ramnanan@myguardiangroup.com"],
  'PD129': ["Premchand Dookran", "premchand.dookran@myguardiangroup.com"],
  'RG130': ["Randolph Gonzales", "randolph.gonzales@myguardiangroup.com"],
  'RL131': ["Roberta Laltoo", "roberta.laltoo@myguardiangroup.com"],
  'SR132': ["Stephanie Rajkumar", "stephanie.rajkumar@myguardiangroup.com"],
  'TB133': ["Tricia Baksh", "tricia.baksh@myguardiangroup.com"],
  'VS134': ["Varun Seegolam", "varun.seegolam@myguardiangroup.com"],
};

/**********************************************************************
 * RICKY RAMPERSAD BRANCH — QUERY PAL : Backend v3
 * Sequential reference, correct routing, history, test mode.
 *
 * REFERENCE FORMAT:  RRB/YEAR/RUNNINGNO/CLIENT/SUBJECT
 *   e.g. RRB/2026/001/John Doe/testing
 *   Running number NEVER resets — it climbs across all years.
 * EMAIL SUBJECT:  ClientName - first 10 chars of description
 *
 * ── AFTER PASTING, REDEPLOY ──
 * Deploy > Manage deployments > pencil > Version: New version
 *   > Who has access: ANYONE > Deploy.
 **********************************************************************/

const SHEET_NAME   = 'Queries';
const SEND_EMAIL   = true;     // false = log only
const TEST_MODE    = false;    // true = all emails go to TEST_EMAIL only
const TEST_EMAIL   = 'rampersadricky@gmail.com';
const BRANCH_SUPPORT = 'support@rickyrampersadbranch.com';
const RR_SUPPORT     = 'rickyrampersadsalessupport@myguardiangroup.com';
/* HEALTH CLAIMS & HEALTH QUERIES ONLY go to Sales Support to be logged on the
   portal, daily, in the Claims & Maturity block 10:00 AM–12:00 PM (that is simply
   the block's name). Maturities, life/pension claims and every other query route
   to their departments as normal. */
const SUPPORT_RX = /health & medical|health claim|claims health/i;
function isSupportCase_(a, b, c) { return SUPPORT_RX.test(String(a||'') + ' ' + String(b||'') + ' ' + String(c||'')); }

/* Category colour code — every routed email wears its family colour (ribbon under
   the masthead, masthead chip, details border) so the inbox reads at a glance. */
function catColor_(cat) {
  var c = String(cat || '').toLowerCase();
  if (c.indexOf('payments') > -1)                               return { hex: '#0b6ab4', tint: '#e8f3fb', line: '#bcdcf3' };
  if (c.indexOf('money') > -1 || c.indexOf('payout') > -1)      return { hex: '#15803d', tint: '#e9f7ee', line: '#bfe6cd' };
  if (c.indexOf('update') > -1)                                 return { hex: '#0f766e', tint: '#e7f6f4', line: '#b9e2dd' };
  if (c.indexOf('document') > -1 || c.indexOf('policy &') > -1) return { hex: '#4338ca', tint: '#eceafc', line: '#c9c3f2' };
  if (c.indexOf('health') > -1 || c.indexOf('medical') > -1)    return { hex: '#b45309', tint: '#fdf3e7', line: '#f2d4ae' };
  if (c.indexOf('claims') > -1 || c.indexOf('benefit') > -1)    return { hex: '#b3261e', tint: '#fceeed', line: '#f0c4c1' };
  if (c.indexOf('car') > -1 || c.indexOf('home') > -1)          return { hex: '#c2410c', tint: '#fdefe7', line: '#f3ccb4' };
  if (c.indexOf('quote') > -1 || c.indexOf('projection') > -1)  return { hex: '#6d28d9', tint: '#f1eafc', line: '#d7c5f4' };
  if (c.indexOf('tech') > -1)                                   return { hex: '#475569', tint: '#eef1f5', line: '#ccd5e0' };
  if (c.indexOf('wrong') > -1)                                  return { hex: '#d13438', tint: '#fdecec', line: '#f4c2c3' };
  return { hex: '#0b6ab4', tint: '#e8f3fb', line: '#bcdcf3' };
}

// Agent -> Manager email (from branch production hierarchy). Manager of the logging agent is CC'd.
const AGENT_MANAGER = {
  "john boodhoo":"gary.sookdeo@myguardiangroup.com",
  "chris badaloo":"gary.sookdeo@myguardiangroup.com",
  "naila samuel":"gary.sookdeo@myguardiangroup.com",
  "felicia rampersad":"gary.sookdeo@myguardiangroup.com",
  "gary sookdeo":"gary.sookdeo@myguardiangroup.com",
  "tricia baksh":"gary.sookdeo@myguardiangroup.com",
  "alyssa joseph":"gary.sookdeo@myguardiangroup.com",
  "jesus boodhoo":"gary.sookdeo@myguardiangroup.com",
  "anthony simmons":"kerwyn.ramroach@myguardiangroup.com",
  "dhalina heeraman":"kerwyn.ramroach@myguardiangroup.com",
  "aidan eugene":"kerwyn.ramroach@myguardiangroup.com",
  "kerwyn ramroach":"kerwyn.ramroach@myguardiangroup.com",
  "crystal fraser":"kerwyn.ramroach@myguardiangroup.com",
  "aleema mohammed ali":"ricky.rampersad@myguardiangroup.com",
  "premchand dookran":"ricky.rampersad@myguardiangroup.com",
  "joy barbara sammah":"ricky.rampersad@myguardiangroup.com",
  "narissa mohammed":"ricky.rampersad@myguardiangroup.com",
  "faizal mohamed":"ricky.rampersad@myguardiangroup.com",
  "javid ali":"ricky.rampersad@myguardiangroup.com",
  "ricky rampersad":"ricky.rampersad@myguardiangroup.com",
  "meera persad khan":"ricky.rampersad@myguardiangroup.com",
  "randolph gonzales":"ricky.rampersad@myguardiangroup.com",
  "neil ramnanan":"ricky.rampersad@myguardiangroup.com",
  "varun seegolam":"ricky.rampersad@myguardiangroup.com",
  "jamil khan":"ricky.rampersad@myguardiangroup.com",
  "darryl manick":"Akaash.Kalladeen@myguardiangroup.com",
  "stephanie rajkumar":"Akaash.Kalladeen@myguardiangroup.com",
  "akaash kalladeen":"Akaash.Kalladeen@myguardiangroup.com",
  "malcolm sooknanan":"Akaash.Kalladeen@myguardiangroup.com",
  "fawwaz mohamed":"Akaash.Kalladeen@myguardiangroup.com",
  "daniel bhagwandas":"Akaash.Kalladeen@myguardiangroup.com",
};
/* Spelling variants seen on the agent dropdown / in the log, mapped to the key
   used above. Without these the lookup misses and the CC quietly goes to the
   branch manager instead of the agent's own manager. */
const AGENT_MANAGER_ALIAS = {
  "john boodoo":        "john boodhoo",
  "felicia rampersad2": "felicia rampersad",
  "faizal mohammed":    "faizal mohamed",
  "joy sammah":         "joy barbara sammah"
};

/* ── TODO (branch): these agents have no manager on the hierarchy yet, so their
   routed emails CC the branch manager by default. Add each one to AGENT_MANAGER
   above with the correct manager email:
       diane lutchman statham · ganesh khodai · jonathan pantin
       janice phillip · kamla dookran · roberta laltoo
   Run auditManagerMap() in the editor at any time to re-check.              ── */

const DEFAULT_MANAGER = 'ricky.rampersad@myguardiangroup.com'; // fallback if agent not mapped
const BRANCH_MANAGER_EMAIL = 'ricky.rampersad@myguardiangroup.com'; // sees everything on the dashboard

function normAgentKey_(s){
  return String(s||'').toLowerCase()
    .replace(/[-._]/g,' ')
    .replace(/[0-9]+/g,' ')          // "Felicia Rampersad2"
    .replace(/\s+/g,' ').trim();
}
/* Returns {email, how} — how is 'exact' | 'alias' | 'name' | 'default'.
   Reporting how the match was made matters: several agents genuinely report to
   the branch manager, so the address alone cannot tell a real mapping from a
   fallback. */
function managerLookup_(agentName){
  var key = normAgentKey_(agentName);
  if (!key) return { email: DEFAULT_MANAGER, how: 'default' };
  if (AGENT_MANAGER[key]) return { email: AGENT_MANAGER[key], how: 'exact' };
  var ali = AGENT_MANAGER_ALIAS[key];
  if (ali && AGENT_MANAGER[ali]) return { email: AGENT_MANAGER[ali], how: 'alias' };
  // unique first-name + surname match, so a middle name or a doubled consonant
  // does not cost the agent their manager
  var parts = key.split(' ');
  if (parts.length >= 2){
    var first = parts[0], last = parts[parts.length-1], hit = '', n = 0;
    for (var k in AGENT_MANAGER){
      var p = k.split(' ');
      if (p[0] === first && p[p.length-1] === last){ hit = k; n++; }
    }
    if (n === 1) return { email: AGENT_MANAGER[hit], how: 'name' };
  }
  return { email: DEFAULT_MANAGER, how: 'default' };
}
function managerForAgent(agentName){
  if(!agentName) return DEFAULT_MANAGER;
  return managerLookup_(agentName).email;
}

/* Editor helper: lists any agent whose manager is not on the hierarchy map. */
function auditManagerMap(){
  var names = [], out = [];
  try {
    var tab = codeTable_();
    for (var i=0;i<tab.length;i++) if (tab[i].name) names.push(tab[i].name);
  } catch(e){}
  for (var c in AGENT_ACCESS) if (AGENT_ACCESS[c][0]) names.push(AGENT_ACCESS[c][0]);
  var seen = {};
  for (var j=0;j<names.length;j++){
    var n = names[j], k = normAgentKey_(n);
    if (seen[k] || !k) continue; seen[k] = 1;
    if (managerLookup_(n).how === 'default') out.push(n);
  }
  var msg = out.length
    ? 'No manager mapped (CC falls back to the branch manager):\n  ' + out.join('\n  ')
    : 'Every agent resolves to a named manager.';
  Logger.log(msg); return msg;
}
// Working-day deadline from turnaround (skips Sat/Sun)
function deadlineFrom(turnaround){
  var n = parseInt(turnaround); if(isNaN(n)) n = 5;
  var d = new Date(); var added = 0;
  while(added < n){ d.setDate(d.getDate()+1); var dow=d.getDay(); if(dow!==0 && dow!==6) added++; }
  return d;
}
function fmtDeadline(d){
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Port_of_Spain', 'EEE d MMM yyyy');
}
/* ══════════════════ SERVER-SIDE ROUTING ══════════════════
   The web app is published to "Anyone", so every field in the posted JSON is
   attacker-controlled. Routing must therefore be decided here, from the query
   type, and never from the departmentEmail the browser sends — otherwise the
   webhook can be driven to send branded branch mail to any address.
   Keep this table in step with DATA in index.html.                          */
const QUERY_ROUTES = {
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
  'Complaint': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Something\'s Wrong'],
  'Confirmation of Funds': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'My Money & Payouts'],
  'Direct Debit & Future Payment Methods': ['glocpremium@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Direct Debit payment not actioned.': ['gloc.premiumquery@myguardiangroup.com', '1', 'Payments & Premiums'],
  'Embassy letters': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'My Policy & Documents'],
  'Escalations': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Something\'s Wrong'],
  'Follow up on status of Annuity surrender': ['gloccorporategroupunit@myguardiangroup.com', '1', 'My Money & Payouts'],
  'Follow up on status of death claims and in less instances procedure re same': ['glocclaims@myguardiangroup.com', '2', 'Claims & Benefits'],
  'Future Payments - Recurring Credit Card': ['gloc.premiumquery@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Future Payments - Salary Deduction': ['premiumsapplicationunit@myguardiangroup.com', '5', 'Payments & Premiums'],
  'General Insurance Renewals (Motor&Home)': ['crmsrenewals@myguardiangroup.com', '3', 'My Car & Home'],
  'Integrity letters': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'My Policy & Documents'],
  'Misallocation of premium payments': ['premiumsapplicationunit@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Missing Premiums Individual Life and Pensions': ['premiumsapplicationunit@myguardiangroup.com', '5', 'Payments & Premiums'],
  'MPOS': ['GLOCITMORequests@myguardiangroup.com', '5', 'Tech Help (Agents)'],
  'Non receipt of pension payments or COE': ['gloc.premiumquery@myguardiangroup.com', '2', 'My Money & Payouts'],
  'Online Customer Portal (New)': ['GLOCPhoneCSRs@myguardiangroup.com', '5', 'Tech Help'],
  'Pending Cases that should have settled': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Something\'s Wrong'],
  'Premium Histories (Old & New)': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'Payments & Premiums'],
  'Procedure for processing online banking (health, life and annuity) payments': ['gloc.premiumquery@myguardiangroup.com', '5', 'Payments & Premiums'],
  'Projection Maturity Annuity': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Projection Quote Rated Cases': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Query - Health Claim': ['ebcustomercare@myguardiangroup.com', '7', 'Health & Medical'],
  'Query on value of policy or paid to date etc.': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '3', 'My Policy & Documents'],
  'Quotes US Econoilife': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Quotes & Projections'],
  'Recurring Credit Card Set up and Update': ['RCC@myguardiangroup.com', '3', 'Payments & Premiums'],
  'Refund Cheques': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '5', 'My Money & Payouts'],
  'Request Info': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Something\'s Wrong'],
  'SalesPal': ['GLOCITMORequests@myguardiangroup.com', '1', 'Tech Help (Agents)'],
  'ScanPal': ['GLOCITMORequests@myguardiangroup.com', '1', 'Tech Help (Agents)'],
  'Scripts Undelivered': ['rickyrampersadsalessupport@myguardiangroup.com', '1', 'Something\'s Wrong'],
  'Statements – tax and csv': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'My Policy & Documents'],
  'Status of policies or value': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '1', 'My Policy & Documents'],
  'Surrenders': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '10', 'My Money & Payouts'],
  'Withdrawals': ['gloccustomerservicechaguanassrsc@myguardiangroup.com', '3', 'My Money & Payouts'],
};
const DEPT_NAMES = {
  'crmsrenewals@myguardiangroup.com': 'CRMS Renewals',
  'gloccorporategroupunit@myguardiangroup.com': 'Corporate Group Unit',
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
function routeFor_(queryType) {
  var k = String(queryType || '').trim();
  var r = QUERY_ROUTES[k];
  if (!r) {                                       // tolerate case drift
    var lk = k.toLowerCase();
    for (var t in QUERY_ROUTES) if (t.toLowerCase() === lk) { r = QUERY_ROUTES[t]; k = t; break; }
  }
  if (!r) return null;
  var n = parseInt(r[1]); if (isNaN(n)) n = 5;
  return { type: k, email: r[0], tat: n + (n === 1 ? ' day' : ' days'),
           group: r[2], dept: DEPT_NAMES[r[0]] || r[0] };
}

/* HTML-escape anything that came from a person. Client names and descriptions
   are pasted straight into the routed email; without this a crafted value can
   inject markup into what departments and managers receive.                  */
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Sliding-window counter in the script cache. Apps Script does not expose the
   caller's IP, so limits are keyed on what we do know (agent code, action).  */
function rateLimit_(key, max, windowSec) {
  try {
    var c = CacheService.getScriptCache(), k = 'rl_' + key;
    var n = Number(c.get(k) || 0) + 1;
    c.put(k, String(n), windowSec);
    return n <= max;
  } catch (e) { return true; }                    // cache unavailable: fail open, never lock the branch out
}

const SF_CASE_INTAKE = 'rickyrampersadsalessupport@s-3l8to0r0jvugn1x94v93wkqay.a-mfgmaq.usa622.case.salesforce.com'; // Email-to-Case: each query email creates a Salesforce Case
const LOG_TO_SALESFORCE = true; // false = stop creating Cases

function setupHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const headers = ['Reference','Run No','Timestamp','Status','Logged By','Client/Name','Email','Phone',
    'Policy/App No','Agent','Agent Email','Category','Query Type','Department','Department Email',
    'Turnaround','Priority','Subject','Description','CC List','Date Closed','Days to Close'];
  sh.clear();
  sh.getRange(1,1,1,headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#003e66').setFontColor('#ffffff').setVerticalAlignment('middle');
  sh.setFrozenRows(1); sh.setRowHeight(1,30);
  for (let c=1;c<=headers.length;c++) sh.setColumnWidth(c,130);
  sh.setColumnWidth(19,320); sh.setColumnWidth(18,240);
}

/* Next running number = highest existing Run No + 1 (never resets). Locked to avoid collisions. */
/* Caller holds the script lock (see doPost) so the number cannot be reused. */
function nextRunNo(sh) {
  {
    const last = sh.getLastRow();
    let max = 0;
    if (last >= 2) {
      const col = sh.getRange(2,2,last-1,1).getValues(); // col B = Run No
      for (let i=0;i<col.length;i++){ const v=parseInt(col[i][0]); if(!isNaN(v)&&v>max) max=v; }
    }
    return max + 1;
  }
}

function pad(n){ return ('000'+n).slice(-3); }
function clean(s){ return (s||'').toString().replace(/[\/\\]/g,' ').replace(/\s+/g,' ').trim(); }

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'rai')       return raiProxy_(d);        // optional AI assistant proxy
    if (d.action === 'agentauth') return agentAuthPost_(d);   // sign-in, so no password rides in the URL

    // Decide the destination here, from the query type. Whatever department or
    // turnaround the browser claimed is discarded.
    const route = routeFor_(d.queryType);
    if (!route) return json({ ok: false, error: 'Unknown query type — nothing was sent.' });
    d.queryType       = route.type;
    d.departmentEmail = route.email;
    d.department      = route.dept;
    d.turnaround      = route.tat;
    d.category        = route.group;

    if (!rateLimit_('post', 30, 60)) return json({ ok: false, error: 'Too many requests just now — try again in a minute.' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) setupHeaders();

    // Number and append under one lock. Reading the next number and writing the
    // row separately let two simultaneous submissions take the same reference.
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var reference, runNo;
    try {
      runNo = nextRunNo(sh);
      const year  = new Date().getFullYear();
      const subjPart = clean(d.subject || d.descFirst10 || (d.description||'').substring(0,10)).substring(0,24);
      reference = 'RRB/' + year + '/' + pad(runNo) + '/' + clean(d.client||d.name) + '/' + clean(subjPart);
      sh.appendRow([
        reference, runNo, new Date(d.timestamp), d.status || 'Open',
        d.loggedBy, d.client || d.name, d.email, d.phone,
        d.policy, d.agent, d.agentEmail, d.category, d.queryType,
        d.department, d.departmentEmail, d.turnaround, d.priority,
        d.subject, d.description, d.cc, '', ''
      ]);
      SpreadsheetApp.flush();
    } finally { lock.releaseLock(); }

    d.reference = reference;
    if (SEND_EMAIL && d.departmentEmail) sendRoutedEmail(d);
    return json({ok:true, reference:reference, runNo:runNo});
  } catch (err) {
    return json({ok:false, error:String(err)});
  }
}

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  if (p.action === 'history') return getHistory(p.email, p.policy);
  if (p.action === 'agentauth') return agentAuth_(p.num || p.code, p.pwd);
  if (p.action === 'myqueries') return myQueries_(p.code, p.token);
  if (p.action === 'wall')      return wallStats_(p.code, p.token, p.days);
  if (p.action === 'track' && p.ref) return trackRef_(p.ref);
  if (p.action === 'survey' && p.ref) return surveyClick_(p.ref, p.score);
  if (p.action === 'surveynote' && p.ref) return surveyNote_(p.ref, p.text);
  return ContentService.createTextOutput('RRB Query Pal logger is live. ' + getVersion());
}

function getHistory(email, policy) {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sh || sh.getLastRow() < 2) return json({ok:true, rows:[]});
    const data = sh.getDataRange().getValues();
    // columns: 0 Ref,1 Run,2 Time,3 Status,4 Name,5 Email,6 Phone,7 Policy,...12 Type,13 Dept,15 TAT,16 Pri,20 Closed
    const iRef=0,iTime=2,iStatus=3,iName=5,iEmail=6,iPolicy=8,iType=12,iDept=13,iTat=15,iPri=16,iClosed=20;
    const em=(email||'').toString().trim().toLowerCase();
    const po=(policy||'').toString().trim().toLowerCase();
    const rows=[];
    for (let r=1;r<data.length;r++){
      const row=data[r];
      const mE = em && row[iEmail] && row[iEmail].toString().trim().toLowerCase()===em;
      const mP = po && row[iPolicy] && row[iPolicy].toString().trim().toLowerCase()===po;
      if (mE || mP){
        rows.push({reference:row[iRef], timestamp:row[iTime], status:row[iStatus]||'Open',
          name:row[iName], queryType:row[iType], department:row[iDept],
          turnaround:row[iTat], priority:row[iPri], dateClosed:row[iClosed]||''});
      }
    }
    rows.sort(function(a,b){return new Date(b.timestamp)-new Date(a.timestamp);});
    return json({ok:true, rows:rows});
  } catch (err) { return json({ok:false, error:String(err), rows:[]}); }
}

/* Turn the posted attachments into mail blobs.
   Accepts d.files = [{name, mime, data(base64)}] and the older single-file
   d.attachPdf / d.attachId slots. Unknown file types are never relayed.     */
var ATTACH_OK_RX = /^(application\/(pdf|msword|rtf|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.oasis\.opendocument\.text)|text\/(plain|csv)|image\/(jpeg|png|gif|webp|heic|heif))$/i;
var ATTACH_MAX_FILES = 6;
var ATTACH_MAX_BYTES = 20 * 1024 * 1024;   // stay under Gmail's 25 MB message limit

function safeFileName_(n) {
  n = String(n || '').replace(/[\\\/\r\n\t]+/g, ' ').replace(/[^A-Za-z0-9 ._-]+/g, '').replace(/\s+/g, ' ').trim();
  return (n || 'attachment').substring(0, 80);
}

function buildAttachments_(d) {
  var blobs = [], names = [], used = 0, skipped = 0;
  var add = function (b64, mime, name) {
    if (!b64) return;
    if (blobs.length >= ATTACH_MAX_FILES) { skipped++; return; }
    mime = String(mime || '').toLowerCase();
    if (!ATTACH_OK_RX.test(mime)) { skipped++; return; }
    try {
      var bytes = Utilities.base64Decode(b64);
      if (used + bytes.length > ATTACH_MAX_BYTES) { skipped++; return; }
      used += bytes.length;
      var nm = safeFileName_(name);
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

function sendRoutedEmail(d) {
  // Recipients: department (To); CC = agent + agent's manager + RR Sales Support + Branch Support + client
  var mgr = managerForAgent(d.agent);
  var ccSet = {};
  [d.agentEmail, mgr, RR_SUPPORT, BRANCH_SUPPORT, d.email].forEach(function(x){
    if (x && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) ccSet[x.toLowerCase()] = x;
  });
  var support = isSupportCase_(d.category, d.queryType, d.department);
  if (support) delete ccSet[RR_SUPPORT.toLowerCase()];
  var to = support ? RR_SUPPORT : d.departmentEmail, cc = Object.values(ccSet).join(',');
  var tag = '';
  if (TEST_MODE){ to = TEST_EMAIL; cc = ''; tag = '[TEST] '; }

  var emailSubject = tag + (support ? '[PORTAL] ' : '') + clean(d.client||d.name) + ' - ' + clean(d.subject || d.descFirst10 || (d.description||'').substring(0,10));
  var deadline = fmtDeadline(deadlineFrom(d.turnaround));
  var col = catColor_(d.category);
  var mgrName = mgr.split('@')[0].replace(/\./g,' ').replace(/\b\w/g, function(c){return c.toUpperCase();});

  // ---- Build a clean, professional HTML email ----
  var row = function(label, val){
    if(!val) val = '&mdash;';
    return '<tr>'
      + '<td style="padding:9px 16px 9px 0;color:#8fa6ba;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;vertical-align:top;border-bottom:1px dashed #e8f0f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;">'+label+'</td>'
      + '<td style="padding:9px 0;color:#0a2138;font-size:13.5px;font-weight:600;border-bottom:1px dashed #e8f0f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;">'+val+'</td>'
      + '</tr>';
  };

  var F = 'font-family:Segoe UI,Helvetica,Arial,sans-serif;';
  var logoBlob = null;
  try { logoBlob = Utilities.newBlob(Utilities.base64Decode(LOGO_B64), 'image/png', 'querypal-logo.png'); } catch (e) {}
  var badge = logoBlob
    ? '<td style="width:46px;height:46px;background:#ffffff;border-radius:13px;text-align:center;vertical-align:middle;padding:6px;"><img src="cid:qplogo" width="34" height="34" alt="Rampersad Branch" style="display:block;margin:0 auto;border:0;"></td>'
    : '<td style="width:42px;height:42px;background:#ffffff;border-radius:12px;text-align:center;vertical-align:middle;'+F+'font-size:13px;font-weight:800;color:#0b6ab4;letter-spacing:.5px;">RRB</td>';

  var priorityBadge = '';
  if (d.priority && d.priority !== 'Normal'){
    var pcol = d.priority.indexOf('Escalation')>-1 ? '#e0483e' : '#dd7a02';
    priorityBadge = '<span style="display:inline-block;background:'+pcol+';color:#ffffff;font-size:10.5px;font-weight:800;padding:5px 12px;border-radius:20px;letter-spacing:.04em;'+F+'">'+d.priority+'</span>';
  }

  // ---- Attachments: guided-form PDF/ID plus any photos or documents the client attached ----
  var att = buildAttachments_(d);

  var attachNote = '';
  if (att.blobs.length){
    var parts = [];
    if (d.attachPdf) parts.push('the completed, signed form');
    if (d.attachId && !(d.files && d.files.length))
      parts.push((d.attachIdName && d.attachIdName.indexOf('RCC_Card')===0) ? 'a photo of the credit card' : 'a valid photo ID');
    if (d.files && d.files.length) parts.push(att.names.length + (att.names.length>1 ? ' files' : ' file'));
    attachNote = row('Attached', '&#128206; ' + parts.join(' and ')
      + '<div style="margin-top:6px;color:#5e7a93;font-size:11.5px;font-weight:500;">' + att.names.join('<br>') + '</div>'
      + (att.skipped ? '<div style="margin-top:6px;color:#dd7a02;font-size:11.5px;font-weight:600;">'
                       + att.skipped + ' file(s) could not be attached — the client may need to resend them.</div>' : ''));
  }

  var html =
  '<div style="background:#eef6fc;padding:28px 12px;'+F+'">'
  + '<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(8,42,76,.14);border:1px solid #e1ebf4;">'

  // ---- masthead ----
  + '<div style="background:linear-gradient(128deg,#0a2f4f,#0b6ab4);padding:20px 26px;">'
  +   '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
  +     badge
  +     '<td style="padding-left:13px;vertical-align:middle;">'
  +       '<div style="'+F+'font-size:16px;font-weight:800;color:#ffffff;line-height:1.15;">Ricky Rampersad Branch</div>'
  +       '<div style="'+F+'font-size:11px;color:#bfe0ff;margin-top:2px;">Query Pal &middot; Rampersad Branch 26000</div>'
  +     '</td>'
  +     '<td style="text-align:right;vertical-align:middle;"><span style="display:inline-block;background:'+(support?'#8a5200':col.hex)+';color:'+(support?'#ffe2ad':'#ffffff')+';'+F+'font-size:9.5px;font-weight:800;letter-spacing:.16em;padding:6px 12px;border-radius:20px;">'+(support?'PORTAL — LOG TODAY':'SERVICE REQUEST')+'</span></td>'
  +   '</tr></table>'
  + '</div>'

  // ---- category ribbon — the colour code ----
  + '<div style="background:'+col.tint+';border-bottom:1px solid '+col.line+';border-left:4px solid '+col.hex+';padding:9px 26px;">'
  +   '<span style="'+F+'font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:'+col.hex+';">'+(d.category||'Service request')+'</span>'
  + '</div>'

  // ---- deadline banner ----
  + '<div style="background:#fff9ee;border-bottom:1px solid #ffe4b8;border-left:4px solid #f5b93b;padding:16px 26px;">'
  +   '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
  +     '<td>'
  +       '<div style="'+F+'font-size:10px;color:#b07d1d;font-weight:800;text-transform:uppercase;letter-spacing:.16em;">'+(support?'Sales Support — log to portal':'Action required by')+'</div>'
  +       '<div style="'+F+'font-size:22px;color:#7a5210;font-weight:800;margin-top:3px;">'+(support?'Log by end of day':deadline)+'</div>'
  +       '<div style="'+F+'font-size:12px;color:#9a7330;margin-top:3px;">'+(support
            ? 'Claims &amp; Maturity portal block: <b>10:00 AM &ndash; 12:00 PM daily (KPI)</b> &middot; resolve by <b>'+deadline+'</b> ('+d.turnaround+')'
            : 'Target turnaround for this request type: <b>'+d.turnaround+'</b>')+'</div>'
  +     '</td>'
  +     '<td style="text-align:right;vertical-align:top;">'+priorityBadge+'</td>'
  +   '</tr></table>'
  + '</div>'

  // ---- body ----
  + '<div style="padding:24px 26px;">'
  +   '<p style="margin:0 0 6px;'+F+'font-size:16px;color:#0a2138;font-weight:700;">New '+d.queryType+' request</p>'
  +   '<p style="margin:0 0 16px;'+F+'font-size:13px;color:#5e7a93;line-height:1.6;">'+(support
        ? 'Routed to <b>Sales Support</b> to be logged on the portal <b>today</b>. The servicing agent, their manager ('+mgrName+') and branch support are copied. This case remains open — and is followed up daily — until it is logged, actioned and closed.'
        : 'Routed to your team for action. The servicing agent, their manager ('+mgrName+') and branch support are copied so this can be progressed and confirmed without delay.')+'</p>'
  +   '<div style="background:#0a2f4f;border-radius:12px;padding:13px 16px;margin:0 0 16px;">'
  +     '<div style="'+F+'font-size:9px;color:#9fc9ec;font-weight:800;letter-spacing:.2em;text-transform:uppercase;">Reference</div>'
  +     '<div style="font-family:Consolas,Menlo,monospace;font-size:13px;font-weight:700;color:#ffffff;margin-top:4px;word-break:break-all;">'+d.reference+'</div>'
  +   '</div>'
  +   '<table cellpadding="0" cellspacing="0" style="width:100%;">'
  +     row('Subject', esc_(d.subject))
  +     row('Logged by', esc_(d.loggedBy) + (d.client||d.name ? ' &mdash; '+esc_(d.client||d.name) : ''))
  +     row('Policy / App', esc_(d.policy))
  +     row('Servicing agent', esc_(d.agent))
  +     row('Reporting manager', esc_(mgrName))
  +     row('Client contact', esc_(d.email) + (d.phone ? ' &middot; '+esc_(d.phone) : ''))
  +     attachNote
  +   '</table>'
  +   '<div style="margin:18px 0 7px;'+F+'font-size:10px;color:#8fa6ba;font-weight:800;text-transform:uppercase;letter-spacing:.14em;">Details of request</div>'
  +   '<div style="background:#f6fafd;border:1px solid #e4eef6;border-left:3px solid '+col.hex+';border-radius:0 10px 10px 0;padding:14px 16px;'+F+'font-size:13.5px;color:#0a2138;line-height:1.6;white-space:pre-wrap;">'+ esc_(d.description) +'</div>'
  +   '<p style="margin:20px 0 0;'+F+'font-size:13px;color:#0a2138;line-height:1.6;">'+(support
        ? 'Kindly <b>log this on the portal in today\u2019s Claims &amp; Maturity block (10:00&ndash;12:00)</b> and <b>reply-all to this thread to confirm it is logged</b>. Follow-up is Sales Support\u2019s responsibility &mdash; automated reminders continue daily until the case is closed.'
        : 'Kindly action this request and <b>reply to confirm completion or status by '+deadline+'</b>. A quick acknowledgement helps us keep the client informed &mdash; thank you for your partnership in delivering on our service standard.')+'</p>'
  + '</div>'

  // ---- footer ----
  + '<div style="background:#f6fafd;border-top:1px solid #e4eef6;padding:16px 26px;text-align:center;">'
  +   '<div style="'+F+'font-size:12px;color:#31506b;font-weight:700;">Ricky Rampersad Branch &middot; Lots 28&ndash;30 Endeavour Industrial Estate, Chaguanas</div>'
  +   '<div style="'+F+'font-size:11.5px;color:#8fa6ba;margin-top:4px;">Reply to this email to respond &middot; <a href="mailto:'+BRANCH_SUPPORT+'" style="color:#0b7fd4;text-decoration:none;">'+BRANCH_SUPPORT+'</a> &middot; <a href="https://wa.me/18686786921" style="color:#0b7fd4;text-decoration:none;">WhatsApp 678&#8209;6921</a></div>'
  +   '<div style="'+F+'font-size:9px;color:#aabecf;font-weight:800;letter-spacing:.18em;margin-top:9px;">RICKY RAMPERSAD &bull; CFD, MFA &bull; BRANCH MANAGER &bull; 23&times; MDRT</div>'
  + '</div>'
  + '</div></div>';

  // plain-text fallback
  var plain =
    (TEST_MODE ? '*** TEST MODE - would go to '+d.departmentEmail+' cc '+Object.values(ccSet).join(', ')+' ***\n\n' : '')
    + 'RICKY RAMPERSAD BRANCH · '+String(d.category||'SERVICE REQUEST').toUpperCase()+'\n'
    + '========================================\n\n'
    + 'New '+d.queryType+' request — '+(support?'routed to SALES SUPPORT to log on the portal.':'routed to your team.')+'\n\n'
    + 'SUBJECT: '+(d.subject||'-')+'\n'
    + (support ? 'LOG TO PORTAL: today, Claims & Maturity block 10:00 AM–12:00 PM (daily KPI)\n' : '')
    + 'ACTION REQUIRED BY: '+deadline+'  (target turnaround '+d.turnaround+')\n'
    + (d.priority && d.priority !== 'Normal' ? 'PRIORITY: '+d.priority+'\n' : '')
    + 'REFERENCE: '+d.reference+'\n\n'
    + 'Logged by:         '+d.loggedBy+' — '+(d.client||d.name)+'\n'
    + 'Policy/App:        '+(d.policy||'-')+'\n'
    + 'Servicing agent:   '+(d.agent||'-')+'\n'
    + 'Reporting manager: '+mgrName+'\n'
    + 'Client contact:    '+d.email+(d.phone?' · '+d.phone:'')+'\n\n'
    + 'DETAILS OF REQUEST\n------------------\n'+d.description+'\n\n'
    + 'Kindly action and reply to confirm completion or status by '+deadline+'.\n\n'
    + 'Ricky Rampersad Branch · Lots 28–30 Endeavour Industrial Estate, Chaguanas\n'
    + BRANCH_SUPPORT+' · WhatsApp 678-6921 · 23× MDRT Branch — Query Pal';

  var attachments = att.blobs;      // built above, before the HTML body

  var mail = { to:to, cc:cc, replyTo:BRANCH_SUPPORT, name:'RR Branch Query Pal',
               subject:emailSubject, body:plain, htmlBody:html };
  if (logoBlob) mail.inlineImages = { qplogo: logoBlob };
  if (attachments.length) mail.attachments = attachments;
  if (LOG_TO_SALESFORCE && !TEST_MODE && SF_CASE_INTAKE && !d.noSalesforceAttach) mail.bcc = SF_CASE_INTAKE;
  MailApp.sendEmail(mail);

  // Forms carrying an ID: create the Salesforce Case via a separate text-only email (ID stays out of SF)
  if (LOG_TO_SALESFORCE && !TEST_MODE && SF_CASE_INTAKE && d.noSalesforceAttach){
    MailApp.sendEmail({ to:SF_CASE_INTAKE, replyTo:BRANCH_SUPPORT, name:'RR Branch Query Pal',
      subject:emailSubject,
      body:'Query logged via Query Pal (signed form and ID sent to the department only, not attached here for privacy).\n\nREFERENCE: '+d.reference+'\nQUERY: '+d.queryType+'\nClient: '+(d.client||d.name)+'\nPolicy/App: '+(d.policy||'-')+'\nDetails:\n'+d.description });
  }
}


/* ============================== AUTOPILOT ==============================
   Runs by itself once you install the trigger (one time only):
   ▶ In the Apps Script editor pick the function  setupTriggers  and press Run.
   Every 4 hours it will:
   1. FOLLOW-UPS — any query still Open past its working-day deadline gets a
      follow-up email IN THE SAME EMAIL THREAD (department + agent + manager
      see the full trail). Up to FOLLOWUP_MAX chases, FOLLOWUP_GAP_DAYS apart,
      working hours only. Counter + date land in columns W and X.
   2. SURVEYS — the moment a row shows Closed / Resolved, the client gets a
      one-tap ★ rating email. Their score lands in column Z, comments in AA.
   Note: the first redeploy will ask for one extra Gmail permission — that is
   what lets follow-ups reply inside the original thread.
   ======================================================================== */
const AUTOPILOT_ON      = true;
const FOLLOWUP_MAX      = 3;   // chase up to 3 times (standard queries)
const FOLLOWUP_MAX_SUPPORT = 10; // health/claims: chase daily until closed (sanity cap)
const FOLLOWUP_GAP_DAYS = 2;   // wait 2 days between chases
const SURVEY_ON         = true;

function setupTriggers() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'autoSweep') ScriptApp.deleteTrigger(ts[i]);
  }
  ScriptApp.newTrigger('autoSweep').timeBased().everyHours(4).create();
  return 'Autopilot installed — sweeping every 4 hours.';
}

function autoSweep() {
  if (!AUTOPILOT_ON) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return;
  ensureAutoHeaders_(sh);
  var hour = Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Port_of_Spain', 'H'));
  var quiet = (hour < 8 || hour >= 18);                  // chase in working hours only
  var data = sh.getDataRange().getValues();
  var now = new Date();
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var status = String(row[3] || '').toLowerCase();
    var isClosed = /closed|resolved|completed/.test(status);

    if (SURVEY_ON && isClosed && !row[24] && row[6]) {   // survey once, needs client email
      try { sendSurvey_(row); sh.getRange(r + 1, 25).setValue(new Date()); } catch (se) {}
      continue;
    }
    if (quiet || isClosed) continue;
    // anything not closed is still owed an answer — "In Progress", "Pending",
    // "Acknowledged" all keep getting chased. Only these opt out.
    if (/cancel|withdraw|duplicate|on hold/.test(status)) continue;
    var sup = isSupportCase_(row[11], row[12], row[13]);
    var count = Number(row[22] || 0);
    if (count >= (sup ? FOLLOWUP_MAX_SUPPORT : FOLLOWUP_MAX)) continue;
    var logged = (row[2] instanceof Date) ? row[2] : new Date(row[2]);
    if (isNaN(logged)) continue;
    var due = deadlineAt_(logged, row[15]);
    if (now <= due) {                                    // not overdue yet…
      // …but support cases demand a reply: chase from the next working day if the thread is silent
      if (!(sup && workedDaysSince_(logged) >= 1 && !threadReplied_(row[0], count))) continue;
    }
    var last = row[23] ? new Date(row[23]) : null;
    if (last && !isNaN(last) && (now - last) < (sup ? 1 : FOLLOWUP_GAP_DAYS) * 86400000) continue;
    try {
      sendFollowUp_(row, count + 1, due, sup);
      sh.getRange(r + 1, 23).setValue(count + 1);
      sh.getRange(r + 1, 24).setValue(now);
    } catch (fe) {}
  }
}

function ensureAutoHeaders_(sh) {
  var want = ['Follow-ups', 'Last Follow-up', 'Survey Sent', 'Score', 'Feedback'];
  var have = sh.getRange(1, 23, 1, 5).getValues()[0];
  for (var i = 0; i < 5; i++) {
    if (String(have[i] || '') !== want[i]) {
      sh.getRange(1, 23 + i).setValue(want[i])
        .setFontWeight('bold').setBackground('#003e66').setFontColor('#ffffff');
    }
  }
}

function workedDaysSince_(start) {
  var d = new Date(start.getTime()), n = 0, now = new Date();
  while (d < now) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6 && d <= now) n++; }
  return n;
}

/* Has anyone other than us replied on the query's email thread? */
function threadReplied_(ref, fuCount) {
  try {
    var th = GmailApp.search('"' + ref + '"', 0, 1);
    if (!th.length) return false;
    var own = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
    var ms = th[0].getMessages();
    if (own) {
      for (var i = 0; i < ms.length; i++) {
        if (String(ms[i].getFrom()).toLowerCase().indexOf(own) === -1) return true;
      }
      return false;
    }
    return ms.length > (1 + (fuCount || 0));
  } catch (e) { return false; }
}

function deadlineAt_(start, turnaround) {
  var n = parseInt(turnaround); if (isNaN(n)) n = 5;
  var d = new Date(start.getTime()); var added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) added++; }
  return d;
}

function logoBlob_() {
  try { return Utilities.newBlob(Utilities.base64Decode(LOGO_B64), 'image/png', 'rrb-shield.png'); }
  catch (e) { return null; }
}

function findRowByRef_(ref) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return null;
  var data = sh.getDataRange().getValues();
  var want = String(ref || '').trim().toUpperCase();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0] || '').trim().toUpperCase() === want) return { sh: sh, r: r + 1, row: data[r] };
  }
  return null;
}

/* ---------------- follow-up (threaded) ---------------- */
function sendFollowUp_(row, n, due, sup) {
  var F = 'font-family:Segoe UI,Helvetica,Arial,sans-serif;';
  var ref = row[0], client = row[5], qtype = row[12], dept = row[13], agent = row[9];
  var mgr = managerForAgent(agent);
  var mgrName = mgr.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  var overdueDays = Math.max(1, Math.round((Date.now() - due.getTime()) / 86400000));
  var cap = sup ? FOLLOWUP_MAX_SUPPORT : FOLLOWUP_MAX;
  var stage = n >= cap ? 'FINAL ESCALATION' : (sup ? 'SUPPORT FOLLOW-UP' : (n === 2 ? 'SECOND FOLLOW-UP' : 'FOLLOW-UP'));
  var bar = (n >= cap || (sup && n >= 3)) ? '#e0483e' : '#dd7a02';
  var pastDue = Date.now() > due.getTime();
  var img = logoBlob_();

  var rowHtml = function (l, v) {
    return '<tr><td style="padding:8px 16px 8px 0;color:#8fa6ba;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;border-bottom:1px dashed #e8f0f7;' + F + '">' + l + '</td>'
      + '<td style="padding:8px 0;color:#0a2138;font-size:13.5px;font-weight:600;border-bottom:1px dashed #e8f0f7;' + F + '">' + (v || '&mdash;') + '</td></tr>';
  };
  var html =
    '<div style="background:#eef6fc;padding:28px 12px;' + F + '">'
    + '<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(8,42,76,.14);border:1px solid #e1ebf4;">'
    + '<div style="background:linear-gradient(128deg,#0a2f4f,#0b6ab4);padding:18px 26px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
    + (img ? '<td style="width:46px;height:46px;background:#ffffff;border-radius:13px;text-align:center;vertical-align:middle;padding:6px;"><img src="cid:qplogo" width="34" height="34" alt="Rampersad Branch" style="display:block;margin:0 auto;border:0;"></td>' : '')
    + '<td style="padding-left:13px;vertical-align:middle;"><div style="' + F + 'font-size:16px;font-weight:800;color:#fff;">Ricky Rampersad Branch</div>'
    + '<div style="' + F + 'font-size:11px;color:#bfe0ff;margin-top:2px;">Query Pal &middot; Rampersad Branch 26000</div></td>'
    + '<td style="text-align:right;vertical-align:middle;"><span style="display:inline-block;background:' + bar + ';color:#fff;' + F + 'font-size:9.5px;font-weight:800;letter-spacing:.14em;padding:6px 12px;border-radius:20px;">' + stage + ' ' + n + ' OF ' + cap + '</span></td>'
    + '</tr></table></div>'
    + '<div style="background:#fdeceb;border-bottom:1px solid #f6c9c5;border-left:4px solid ' + bar + ';padding:15px 26px;">'
    + '<div style="' + F + 'font-size:10px;color:#a03a33;font-weight:800;text-transform:uppercase;letter-spacing:.16em;">' + (sup ? 'Awaiting Sales Support &mdash; portal + reply' : 'Still open &mdash; overdue') + '</div>'
    + '<div style="' + F + 'font-size:20px;color:#7c2a24;font-weight:800;margin-top:3px;">' + (pastDue ? ('Due ' + fmtDeadline(due) + ' &middot; ' + overdueDays + (overdueDays === 1 ? ' day' : ' days') + ' past deadline') : ('No reply yet &middot; due ' + fmtDeadline(due))) + '</div>'
    + (sup ? '<div style="' + F + 'font-size:12px;color:#9a7330;margin-top:3px;">Claims &amp; Maturity portal block: <b>10:00 AM &ndash; 12:00 PM daily (KPI)</b></div>' : '') + '</div>'
    + '<div style="padding:22px 26px;">'
    + '<p style="margin:0 0 14px;' + F + 'font-size:13.5px;color:#0a2138;line-height:1.6;">' + (sup
      ? 'Following up on the case below &mdash; still <b>open</b> with <b>no confirmation on this thread</b>. As a health/claims item, it is <b>Sales Support’s responsibility</b> to log it on the portal and drive it to close. Kindly <b>reply-all with confirmation or status</b> &mdash; reminders continue daily until the case is closed. The full original request is in this trail.'
      : 'Following up on the request below &mdash; our records still show it <b>open</b>. Kindly <b>reply to this thread with a status or completion confirmation</b> so we can update the client. The full original request is in this email trail.') + '</p>'
    + '<div style="background:#0a2f4f;border-radius:12px;padding:12px 16px;margin:0 0 14px;"><div style="' + F + 'font-size:9px;color:#9fc9ec;font-weight:800;letter-spacing:.2em;text-transform:uppercase;">Reference</div>'
    + '<div style="font-family:Consolas,Menlo,monospace;font-size:13px;font-weight:700;color:#fff;margin-top:4px;word-break:break-all;">' + ref + '</div></div>'
    + '<table cellpadding="0" cellspacing="0" style="width:100%;">'
    + rowHtml('Request', qtype) + rowHtml('Client', client) + rowHtml('Servicing agent', agent)
    + rowHtml('Reporting manager', mgrName) + rowHtml('Department', dept)
    + '</table>'
    + '<p style="margin:18px 0 0;' + F + 'font-size:12.5px;color:#5e7a93;line-height:1.6;">' + (n >= cap ? 'This is the <b>final automated escalation</b> — the branch manager is copied and will follow up personally.' : 'A one-line acknowledgement is perfectly fine — it keeps the client informed.') + '</p>'
    + '</div>'
    + '<div style="background:#f6fafd;border-top:1px solid #e4eef6;padding:14px 26px;text-align:center;">'
    + '<div style="' + F + 'font-size:11.5px;color:#8fa6ba;">Ricky Rampersad Branch &middot; <a href="mailto:' + BRANCH_SUPPORT + '" style="color:#0b7fd4;text-decoration:none;">' + BRANCH_SUPPORT + '</a> &middot; WhatsApp 678&#8209;6921</div>'
    + '</div></div></div>';

  var plain = stage + ' ' + n + '/' + cap + ' — ' + ref + '\n'
    + 'Still OPEN, due ' + fmtDeadline(due) + ' (' + overdueDays + ' days past deadline).\n'
    + 'Request: ' + qtype + ' · Client: ' + client + ' · Agent: ' + agent + '\n'
    + 'Please reply to this thread with a status or completion confirmation. — Query Pal';

  var subjectBase = clean(client) + ' - ' + (row[17] || '');
  if (TEST_MODE) {
    MailApp.sendEmail({ to: TEST_EMAIL, replyTo: BRANCH_SUPPORT, name: 'RR Branch Query Pal',
      subject: '[TEST] Re: ' + subjectBase, body: plain, htmlBody: html,
      inlineImages: img ? { qplogo: img } : undefined });
    return;
  }
  var sent = false;
  try {
    var threads = GmailApp.search('"' + ref + '"', 0, 3);        // find the original by its reference
    if (threads && threads.length) {
      threads[0].replyAll(plain, { htmlBody: html, name: 'RR Branch Query Pal',
        inlineImages: img ? { qplogo: img } : undefined });
      sent = true;                                               // true threaded reply — full trail
    }
  } catch (ge) {}
  if (!sent) {
    var cc = [row[10], mgr, BRANCH_SUPPORT].filter(function (x) { return x; }).join(',');
    MailApp.sendEmail({ to: (sup ? RR_SUPPORT : row[14]), cc: cc, replyTo: BRANCH_SUPPORT, name: 'RR Branch Query Pal',
      subject: 'Re: ' + subjectBase, body: plain, htmlBody: html,
      inlineImages: img ? { qplogo: img } : undefined });
  }
}

/* ---------------- closure survey ---------------- */
function sendSurvey_(row) {
  var F = 'font-family:Segoe UI,Helvetica,Arial,sans-serif;';
  var ref = row[0], client = String(row[5] || ''), qtype = row[12];
  var first = client.split(/\s+/)[0] || 'there';
  first = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  var base = ScriptApp.getService().getUrl();
  var img = logoBlob_();
  var stars = '';
  var labels = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];
  for (var s = 1; s <= 5; s++) {
    stars += '<td style="padding:4px;"><a href="' + base + '?action=survey&ref=' + encodeURIComponent(ref) + '&score=' + s + '" '
      + 'style="display:block;background:#fff9ee;border:1.5px solid #f2ce8a;border-radius:14px;padding:13px 6px 10px;text-decoration:none;text-align:center;">'
      + '<span style="font-size:24px;line-height:1;">' + '\u2B50' + '</span><br>'
      + '<span style="' + F + 'font-size:15px;font-weight:800;color:#7a5210;">' + s + '</span><br>'
      + '<span style="' + F + 'font-size:9px;font-weight:700;letter-spacing:.06em;color:#b07d1d;text-transform:uppercase;">' + labels[s - 1] + '</span></a></td>';
  }
  var html =
    '<div style="background:#eef6fc;padding:28px 12px;' + F + '">'
    + '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(8,42,76,.14);border:1px solid #e1ebf4;">'
    + '<div style="background:linear-gradient(128deg,#0a2f4f,#0b6ab4);padding:18px 26px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
    + (img ? '<td style="width:46px;height:46px;background:#ffffff;border-radius:13px;text-align:center;vertical-align:middle;padding:6px;"><img src="cid:qplogo" width="34" height="34" alt="Rampersad Branch" style="display:block;margin:0 auto;border:0;"></td>' : '')
    + '<td style="padding-left:13px;vertical-align:middle;"><div style="' + F + 'font-size:16px;font-weight:800;color:#fff;">Ricky Rampersad Branch</div>'
    + '<div style="' + F + 'font-size:11px;color:#bfe0ff;margin-top:2px;">Query Pal &middot; Rampersad Branch 26000</div></td>'
    + '<td style="text-align:right;vertical-align:middle;"><span style="display:inline-block;background:#12507f;color:#cfeaff;' + F + 'font-size:9.5px;font-weight:800;letter-spacing:.16em;padding:6px 12px;border-radius:20px;">RESOLVED \u2713</span></td>'
    + '</tr></table></div>'
    + '<div style="padding:26px;">'
    + '<p style="margin:0 0 6px;' + F + 'font-size:19px;color:#0a2138;font-weight:800;">How did we do, ' + first + '?</p>'
    + '<p style="margin:0 0 18px;' + F + 'font-size:13.5px;color:#5e7a93;line-height:1.6;">Your <b>' + qtype + '</b> request has been resolved. One tap below tells us how the service felt &mdash; that\u2019s all it takes.</p>'
    + '<table cellpadding="0" cellspacing="0" style="width:100%;">'
    + '<tr>' + stars + '</tr></table>'
    + '<p style="margin:16px 0 0;' + F + 'font-size:11px;color:#8fa6ba;text-align:center;">Reference <span style="font-family:Consolas,Menlo,monospace;">' + ref + '</span></p>'
    + '</div>'
    + '<div style="background:#f6fafd;border-top:1px solid #e4eef6;padding:14px 26px;text-align:center;">'
    + '<div style="' + F + 'font-size:11.5px;color:#8fa6ba;">Thank you for choosing Rampersad Branch &middot; WhatsApp 678&#8209;6921</div>'
    + '<div style="' + F + 'font-size:9px;color:#aabecf;font-weight:800;letter-spacing:.18em;margin-top:8px;">RICKY RAMPERSAD &bull; CFD, MFA &bull; BRANCH MANAGER &bull; 23&times; MDRT</div>'
    + '</div></div></div>';

  var plain = 'How did we do, ' + first + '?\n\nYour ' + qtype + ' request (' + ref + ') is resolved.\n'
    + 'Rate us 1-5 by opening: ' + base + '?action=survey&ref=' + encodeURIComponent(ref) + '&score=5\n'
    + '(change score=5 to your rating)\n\n— Ricky Rampersad Branch · Query Pal';

  MailApp.sendEmail({ to: TEST_MODE ? TEST_EMAIL : row[6], replyTo: BRANCH_SUPPORT,
    name: 'Ricky Rampersad Branch', subject: (TEST_MODE ? '[TEST] ' : '') + 'How did we do? \u2014 ' + qtype,
    body: plain, htmlBody: html, inlineImages: img ? { qplogo: img } : undefined });
}

function surveyPage_(title, msg, extra) {
  var html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Query Pal</title></head><body style="margin:0;background:#eef6fc;font-family:Segoe UI,Helvetica,Arial,sans-serif;">'
    + '<div style="max-width:460px;margin:60px auto;background:#fff;border-radius:20px;box-shadow:0 12px 34px rgba(8,42,76,.14);border:1px solid #e1ebf4;overflow:hidden;">'
    + '<div style="background:linear-gradient(128deg,#0a2f4f,#0b6ab4);padding:22px;text-align:center;">'
    + '<svg width="52" height="52" viewBox="0 0 64 64" fill="none"><defs><linearGradient id="g" x1="14" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd95c"/><stop offset=".55" stop-color="#f2ac1d"/><stop offset="1" stop-color="#d98908"/></linearGradient></defs><path d="M32 3L8 12v20c0 16 11 25 24 29 13-4 24-13 24-29V12L32 3z" fill="url(#g)"/><path d="M21 33l8 8 15-16" stroke="#0e2f4a" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    + '<div style="color:#fff;font-weight:800;font-size:17px;margin-top:8px;">Ricky Rampersad Branch</div></div>'
    + '<div style="padding:26px;text-align:center;">'
    + '<div style="font-size:21px;font-weight:800;color:#0a2138;">' + title + '</div>'
    + '<p style="font-size:14px;color:#5e7a93;line-height:1.6;margin:10px 0 0;">' + msg + '</p>'
    + (extra || '')
    + '</div></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Query Pal');
}

function surveyClick_(ref, score) {
  var n = Math.max(1, Math.min(5, Number(score) || 0));
  var hit = findRowByRef_(ref);
  if (!hit) return surveyPage_('Reference not found', 'That link looks incomplete \u2014 please use the buttons in your email, or WhatsApp us on 678\u20116921.');
  hit.sh.getRange(hit.r, 26).setValue(n);
  var base = ScriptApp.getService().getUrl();
  var form = '<form action="' + base + '" method="get" style="margin-top:18px;">'
    + '<input type="hidden" name="action" value="surveynote"><input type="hidden" name="ref" value="' + String(ref).replace(/"/g, '&quot;') + '">'
    + '<textarea name="text" rows="3" placeholder="Anything we could do better? (optional)" style="width:100%;box-sizing:border-box;border:1.5px solid #e1ebf4;border-radius:12px;padding:12px;font-size:14px;font-family:inherit;"></textarea>'
    + '<button type="submit" style="margin-top:10px;background:linear-gradient(126deg,#37b1ec,#0b6ab4);color:#fff;border:none;border-radius:12px;padding:12px 22px;font-size:14px;font-weight:800;cursor:pointer;">Send feedback</button></form>';
  var stars = ''; for (var i = 0; i < n; i++) stars += '\u2B50';
  return surveyPage_(stars, 'Thank you \u2014 your <b>' + n + '/5</b> rating for <span style="font-family:Consolas,monospace;">' + String(ref).replace(/</g, '&lt;') + '</span> is recorded.', form);
}

function surveyNote_(ref, text) {
  var hit = findRowByRef_(ref);
  var t = String(text || '').trim().substring(0, 1000);
  if (hit && t) {
    var old = String(hit.row[26] || '');
    hit.sh.getRange(hit.r, 27).setValue(old ? old + ' | ' + t : t);
  }
  return surveyPage_('Thank you \uD83D\uDE4F', 'Your feedback is with the branch \u2014 it genuinely shapes how we serve you.');
}

/* ===================== agent login — codes live in this workbook =====================
   Scans every tab EXCEPT the Queries log for the code. Name = first plain-text cell in
   the row, email = the cell containing "@". Role comes from an optional ROLE cell, or
   is worked out from AGENT_MANAGER above (Ricky = branch, mapped managers = manager). */

var ROLE_RX = /^(agent|adviser|advisor|manager|abm|mgr|unit manager|assistant branch manager|assistant manager|branch|branch manager|bm|admin|all|staff)$/i;

function roleWord_(v) {
  if (!ROLE_RX.test(v)) return null;
  if (/^(branch|branch manager|bm|admin|all|staff)$/i.test(v)) return 'branch';
  if (/^(manager|abm|mgr|unit manager|assistant branch manager|assistant manager)$/i.test(v)) return 'manager';
  return 'agent';
}

function normName_(s) {
  return String(s||'').toLowerCase().replace(/[-.]/g,' ').replace(/\s+/g,' ').trim();
}

/* Every non-empty row from every tab except the Queries log. */
function codeRows_() {
  var out = [];
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (sh.getName() === SHEET_NAME) continue;
    var rows = sh.getLastRow(), cols = sh.getLastColumn();
    if (rows < 1 || cols < 1) continue;
    var data = sh.getRange(1, 1, rows, Math.min(cols, 10)).getValues();
    // structured credential tabs (Password / Agent Number headers) belong to codeTable_
    var hd = [];
    for (var h0 = 0; h0 < data[0].length; h0++) hd.push(String(data[0][h0]).trim().toLowerCase());
    if (hd.indexOf('password') > -1 || hd.indexOf('pass') > -1 || hd.indexOf('pin') > -1 ||
        hd.indexOf('agent number') > -1 || hd.indexOf('agent no') > -1 || hd.indexOf('number') > -1) continue;
    for (var r = 0; r < data.length; r++) {
      var cells = [];
      for (var c = 0; c < data[r].length; c++) {
        var v = String(data[r][c]).trim();
        if (v) cells.push(v);
      }
      if (cells.length) out.push(cells);
    }
  }
  return out;
}

/* Structured "Agent Codes" tab — a header row with Password and/or Agent Number.
   Sign in with EITHER value. Name cells like "A00427 - Ricky Rampersad" are cleaned,
   Role reads Branch/Assistant Branch/Unit Manager, Unit builds the manager's team,
   and anything not marked Active is refused. */
function codeTable_() {
  var out = [];
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (sh.getName() === SHEET_NAME) continue;
    var rows = sh.getLastRow(), cols = sh.getLastColumn();
    if (rows < 2 || cols < 2) continue;
    var data = sh.getRange(1, 1, rows, Math.min(cols, 12)).getValues();
    var head = [];
    for (var h = 0; h < data[0].length; h++) head.push(String(data[0][h]).trim().toLowerCase());
    var col = function () {
      for (var a = 0; a < arguments.length; a++) { var i = head.indexOf(arguments[a]); if (i > -1) return i; }
      return -1;
    };
    var cPwd = col('password', 'pass', 'pin'), cNum = col('agent number', 'agent no', 'agent #', 'number');
    if (cPwd < 0 && cNum < 0) continue;                      // not a credentials tab
    var cName = col('name', 'agent name', 'agent'), cMail = col('email', 'e-mail', 'agent email');
    var cRole = col('role'), cUnit = col('unit', 'team', 'manager'), cAct = col('active', 'status');
    for (var r = 1; r < data.length; r++) {
      var g = function (i) { return i > -1 ? String(data[r][i]).trim() : ''; };
      var name = g(cName).replace(/^[A-Za-z]?\d+\s*[-\u2013\u2014]\s*/, '');
      var e = { num: g(cNum).toUpperCase(), pwd: g(cPwd), name: name, email: g(cMail),
                role: '', unit: g(cUnit), active: true };
      var act = g(cAct);
      if (cAct > -1 && act && !/^activ/i.test(act)) e.active = false;
      e.role = roleWord_(g(cRole)) || roleFromHierarchy_(e.name, e.email);
      if (e.num || e.pwd) out.push(e);
    }
  }
  return out;
}

function parseRow_(cells, code) {
  var p = { code: code || '', name: '', email: '', role: '', mgr: '', cells: cells };
  var texts = [];
  for (var k = 0; k < cells.length; k++) {
    var v = cells[k];
    if (code && v.toUpperCase() === code) continue;          // skip the code itself
    var rw = roleWord_(v);
    if (rw) { p.role = rw; continue; }
    if (!p.email && v.indexOf('@') > -1) { p.email = v; continue; }
    if (v.indexOf('@') === -1 && !/^[\d.]+$/.test(v)) texts.push(v);
  }
  p.name = texts[0] || '';
  p.mgr  = texts[1] || '';
  if (!p.role) p.role = roleFromHierarchy_(p.name, p.email); // fall back to AGENT_MANAGER
  return p;
}

/* Role from the production hierarchy: Ricky = branch; anyone whose email appears
   as a manager email in AGENT_MANAGER = manager; everyone else = agent. */
function roleFromHierarchy_(name, email) {
  var em = String(email||'').toLowerCase();
  if (em && em === BRANCH_MANAGER_EMAIL.toLowerCase()) return 'branch';
  if (normName_(name) === 'ricky rampersad') return 'branch';
  var vals = Object.values(AGENT_MANAGER);
  for (var i = 0; i < vals.length; i++) {
    var mv = String(vals[i]).toLowerCase();
    if (em && em === mv) return 'manager';
    // no email in the codes row? match the manager's name inferred from the email
    if (!em && mv.split('@')[0].replace(/\./g,' ') === normName_(name)) return 'manager';
  }
  return 'agent';
}

function findAgent_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  for (var k in AGENT_ACCESS) {                              // the script list wins
    if (k.toUpperCase() === code) {
      var e0 = AGENT_ACCESS[k] || [];
      var nm = e0[0] || '', em = e0[1] || '';
      var rl = e0[2] ? (roleWord_(String(e0[2])) || 'agent') : roleFromHierarchy_(nm, em);
      return { code: code, name: nm, email: em, role: rl, mgr: '',
               cells: [nm, em].filter(function (x) { return x; }) };
    }
  }
  var tab = codeTable_();                                    // the Agent Codes tab
  for (var t = 0; t < tab.length; t++) {
    var e1 = tab[t];
    if (!e1.active) continue;
    if ((e1.num && e1.num === code) || (e1.pwd && String(e1.pwd).toUpperCase() === code)) {
      return { code: code, name: e1.name, email: e1.email, role: e1.role, mgr: e1.unit,
               src: 'tab', pwd: String(e1.pwd || ''),
               cells: [e1.name, e1.email].filter(function (x) { return x; }) };
    }
  }
  if (code.length < 3) return null;                          // loose scan stays strict
  var rows = codeRows_();
  for (var i = 0; i < rows.length; i++) {
    for (var c = 0; c < rows[i].length; c++) {
      if (rows[i][c].toUpperCase() === code) return parseRow_(rows[i], code);
    }
  }
  return null;
}

/* ══════════════════ AGENT SIGN-IN ══════════════════
   Agent codes follow a guessable pattern (initials + a running number), so a
   code on its own must not open a dashboard full of client names and policy
   numbers. Passwords are stored as salted hashes in Script Properties — run
   bootstrapAgentPasswords() once to generate and print them, hand them out,
   then set REQUIRE_AGENT_PASSWORD to true to close the gap for good.        */
const REQUIRE_AGENT_PASSWORD = false;   // ← flip to true once every agent has their password
const PW_PROP  = 'AGENT_PW_HASHES';
const PW_SALT  = 'AGENT_PW_SALT';
const AUTH_MAX_TRIES = 5;               // per code, per window
const AUTH_WINDOW    = 600;             // 10 minutes
const TOKEN_TTL      = 8 * 3600;        // a working day

function pwSalt_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty(PW_SALT);
  if (!s) { s = Utilities.getUuid(); p.setProperty(PW_SALT, s); }
  return s;
}
function pwHash_(code, pwd) {
  var raw = String(code).toUpperCase() + '|' + String(pwd) + '|' + pwSalt_();
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw));
}
function pwStore_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PW_PROP) || '{}'); }
  catch (e) { return {}; }
}
function pwSave_(map) {
  PropertiesService.getScriptProperties().setProperty(PW_PROP, JSON.stringify(map));
}
/* Editor helper: set or change one agent's password. */
function setAgentPassword(code, pwd) {
  var m = pwStore_(); m[String(code).toUpperCase()] = pwHash_(code, pwd); pwSave_(m);
  return 'Password set for ' + code;
}
/* Editor helper: give every code a fresh random password and print the list
   once so it can be handed out. Re-running it replaces every password. */
function bootstrapAgentPasswords() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', m = {}, lines = [];
  for (var code in AGENT_ACCESS) {
    var pwd = '';
    for (var i = 0; i < 8; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    m[code.toUpperCase()] = pwHash_(code, pwd);
    lines.push(code + '\t' + (AGENT_ACCESS[code][0] || '') + '\t' + pwd);
  }
  pwSave_(m);
  var msg = 'Passwords generated — copy this list now, it is not recoverable:\n\n'
          + 'CODE\tAGENT\tPASSWORD\n' + lines.join('\n')
          + '\n\nNow set REQUIRE_AGENT_PASSWORD = true and redeploy.';
  Logger.log(msg); return msg;
}

/* Short-lived session token, so the agent code itself stops being the key that
   travels on every dashboard request. */
function issueToken_(me) {
  var tok = Utilities.getUuid().replace(/-/g, '');
  try {
    CacheService.getScriptCache().put('tok_' + tok, JSON.stringify(
      { code: me.code, name: me.name, email: me.email, role: me.role }), TOKEN_TTL);
  } catch (e) {}
  return tok;
}
function agentFromToken_(tok) {
  if (!tok) return null;
  try {
    var v = CacheService.getScriptCache().get('tok_' + String(tok));
    if (!v) return null;
    var o = JSON.parse(v);
    return findAgent_(o.code);
  } catch (e) { return null; }
}

function agentAuthPost_(d) { return agentAuth_(d.num || d.code, d.pwd); }

function agentAuth_(code, pwd) {
  var tried = String(code || pwd || '').toUpperCase().substring(0, 24);
  if (!rateLimit_('auth_' + tried, AUTH_MAX_TRIES, AUTH_WINDOW))
    return json({ ok: false, why: 'rate' });

  var me = findAgent_(code);
  if (!me && pwd) me = findAgent_(pwd);          // master code typed in the password box
  if (!me) return json({ ok: false });

  if (me.src === 'tab') {                        // sheet rows carry their own password
    var want = String(me.pwd || '').trim().toUpperCase();
    var got  = String(pwd || '').trim().toUpperCase();
    if (want && got !== want) return json({ ok: false, why: 'pwd' });
  } else {
    // codes from the script list: check the stored hash when one exists
    var have = pwStore_()[String(me.code).toUpperCase()];
    if (have) {
      if (!pwd || pwHash_(me.code, pwd) !== have) return json({ ok: false, why: 'pwd' });
    } else if (REQUIRE_AGENT_PASSWORD) {
      return json({ ok: false, why: 'nopw' });   // no password on file and none allowed
    }
  }
  return json({ ok: true, token: issueToken_(me), code: me.code,
                name: me.name, email: me.email, role: me.role });
}

/* ================== query dashboard — role decides what a code sees ==================
   agent → own queries · manager → their team (sheet MANAGER links + AGENT_MANAGER map)
   branch → everything. Matching against the log uses Agent name OR Agent Email.      */

/* Which agent names/emails this person is allowed to see.
   null = everything (branch). Shared by the dashboard and the wall so the two
   can never disagree about who reports to whom. */
function scopeKeys_(me) {
  if (!me || me.role === 'branch') return null;
  var keys = {};
  var add = function (v) { v = normName_(v); if (v) keys[v] = 1; };
  var addRow = function (cells) {
    for (var k = 0; k < cells.length; k++) if (!roleWord_(cells[k])) add(cells[k]);
  };
  addRow(me.cells);                                        // always yourself
  if (me.role === 'manager') {
    var meMail = String(me.email||'').toLowerCase();
    if (!meMail) {                                         // codes row has no email → find it in the map
      var mvals = Object.values(AGENT_MANAGER);
      for (var m2 = 0; m2 < mvals.length; m2++) {
        var mv2 = String(mvals[m2]).toLowerCase();
        if (mv2.split('@')[0].replace(/\./g,' ') === normName_(me.name)) { meMail = mv2; break; }
      }
    }
    var meName = normName_(me.name);
    // (a) team from the production hierarchy map
    for (var nm in AGENT_MANAGER) {
      if (String(AGENT_MANAGER[nm]).toLowerCase() === meMail) add(nm);
    }
    // (b) team from codes-tab rows that name this manager
    var rows = codeRows_();
    for (var i = 0; i < rows.length; i++) {
      for (var c = 0; c < rows[i].length; c++) {
        if (normName_(rows[i][c]) === meName) { addRow(rows[i]); break; }
      }
    }
    // (c) team from the Agent Codes tab: everyone whose Unit names this manager
    var tab2 = codeTable_();
    for (var t2 = 0; t2 < tab2.length; t2++) {
      if (normName_(tab2[t2].unit) === meName) { add(tab2[t2].name); add(tab2[t2].email); }
    }
  }
  return keys;
}

function myQueries_(code, token) {
  var me = agentFromToken_(token) || (REQUIRE_AGENT_PASSWORD ? null : findAgent_(code));
  if (!me) return json({ ok: false });

  var keys = scopeKeys_(me);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return json({ ok: true, role: me.role, name: me.name,
                  counts: { open: 0, done: 0, total: 0 }, rows: [] });
  }

  // read through column 27 — Follow-ups (23) and Score (26) live past the base 22
  var wide = Math.max(22, Math.min(27, sheet.getLastColumn()));
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, wide).getValues();
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var fmt = function (v, pat) {
    if (v instanceof Date) return Utilities.formatDate(v, tz, pat);
    return String(v || '').trim();
  };
  var isDone = function (s) { return /closed|resolved|completed/i.test(s); };

  var out = [], open = 0, done = 0, total = 0, CAP = 300;
  for (var r = data.length - 1; r >= 0; r--) {               // newest first
    var row = data[r];
    var agent = String(row[9] || '').trim();
    var aMail = String(row[10] || '').trim().toLowerCase();
    if (keys && !(keys[normName_(agent)] || keys[normName_(aMail)])) continue;

    var st = String(row[3] || 'Open').trim();
    total++; if (isDone(st)) done++; else open++;
    if (out.length >= CAP) continue;                         // keep counting, stop collecting
    out.push({
      ref:    String(row[0] || '').trim(),
      ts:     fmt(row[2], 'd MMM · h:mm a'),
      status: st,
      client: String(row[5] || '').trim(),
      agent:  agent,
      qtype:  String(row[12] || '').trim(),
      dept:   String(row[13] || '').trim(),
      tat:    String(row[15] || '').trim(),
      pri:    String(row[16] || '').trim(),
      closed: fmt(row[20], 'd MMM'),
      days:   String(row[21] === 0 ? '0' : (row[21] || '')).trim(),
      tsIso:  (row[2] instanceof Date) ? row[2].toISOString() : String(row[2] || ''),
      score:  Number(row[25]) || 0,
      fu:     Number(row[22]) || 0
    });
  }
  return json({ ok: true, role: me.role, name: me.name,
                counts: { open: open, done: done, total: total }, rows: out });
}

/* ══════════════════ WALL — aggregates for the insights wall ══════════════════
   Computed over every row rather than the dashboard's most recent 300, so the
   panels are exact on a busy branch. Only aggregates cross the wire: no client
   names, policy numbers or descriptions leave the sheet for this view.       */
function wallStats_(code, token, days) {
  var me = agentFromToken_(token) || (REQUIRE_AGENT_PASSWORD ? null : findAgent_(code));
  if (!me) return json({ ok: false });

  var window = parseInt(days); if (isNaN(window) || window <= 0) window = 0;   // 0 = all time
  var keys = scopeKeys_(me);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2)
    return json({ ok: true, role: me.role, name: me.name, empty: true });

  var wide = Math.max(22, Math.min(27, sh.getLastColumn()));
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, wide).getValues();
  var now = new Date(), cut = window ? (now.getTime() - window * 86400000) : 0;
  var DONE = /closed|resolved|completed/i;

  var tot = 0, open = 0, done = 0, overdue = 0, chased = 0;
  var onT = 0, onTot = 0, dSum = 0, dN = 0, sSum = 0, sN = 0;
  var weeks = {}, byDept = {}, byAgent = {}, byType = {}, age = { ok: 0, soon: 0, late: 0 };
  var scoreDist = { 1:0, 2:0, 3:0, 4:0, 5:0 }, notes = [];

  var bump = function (m, k) {
    if (!k) return null;
    if (!m[k]) m[k] = { n: 0, done: 0, onT: 0, onTot: 0, dSum: 0, dN: 0, late: 0, chased: 0, sSum: 0, sN: 0 };
    return m[k];
  };

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
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

    // 12-week volume, bucket 0 = this week
    var wk = Math.floor((now.getTime() - ts.getTime()) / (7 * 86400000));
    if (wk >= 0 && wk < 12) weeks[wk] = (weeks[wk] || 0) + 1;

    if (!isDone) {                                        // ageing of what is still open
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

/* ======================= tracking — powers "Track a request" ======================== */

function trackRef_(ref) {
  try {
    ref = String(ref || '').trim().toLowerCase();
    if (!ref) return json({ found: false });
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sh || sh.getLastRow() < 2) return json({ found: false });
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, 22).getValues();
    var hit = null;
    for (var r = data.length - 1; r >= 0; r--) {             // prefer the newest match
      var rr = String(data[r][0] || '').trim().toLowerCase();
      if (!rr) continue;
      if (rr === ref) { hit = data[r]; break; }              // exact wins immediately
      if (!hit && rr.indexOf(ref) === 0) hit = data[r];      // forgiving: ref typed short
    }
    if (!hit) return json({ found: false });
    var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
    var fmt = function (v, pat) {
      if (v instanceof Date) return Utilities.formatDate(v, tz, pat);
      return String(v || '').trim();
    };
    return json({
      found: true,
      reference: String(hit[0] || ''),
      status: String(hit[3] || 'Open'),
      queryType: String(hit[12] || ''),
      department: String(hit[13] || ''),
      logged: fmt(hit[2], 'd MMM yyyy, h:mm a'),
      turnaround: String(hit[15] || ''),
      dateClosed: fmt(hit[20], 'd MMM yyyy'),
      daysToClose: String(hit[21] === 0 ? '0' : (hit[21] || ''))
    });
  } catch (err) { return json({ found: false, error: String(err) }); }
}

/* ============ auto close-out: set Status → Date Closed + Days fill in =============== */

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEET_NAME) return;
    var r = e.range.getRow(), c = e.range.getColumn();
    if (r < 2 || c !== 4) return;                            // col D = Status
    var st = String(sh.getRange(r, 4).getValue() || '');
    if (/closed|resolved|completed/i.test(st)) {
      if (!sh.getRange(r, 21).getValue()) {                  // col U = Date Closed
        var now = new Date();
        sh.getRange(r, 21).setValue(now);
        var logged = sh.getRange(r, 3).getValue();           // col C = Timestamp
        if (logged instanceof Date) {
          var days = Math.max(0, Math.round((now - logged) / 86400000));
          sh.getRange(r, 22).setValue(days);                 // col V = Days to Close
        }
      }
    } else {
      sh.getRange(r, 21).setValue('');                       // reopened → clear both
      sh.getRange(r, 22).setValue('');
    }
  } catch (err) { /* never block manual edits */ }
}

/* ============== optional RAI proxy — needs ANTHROPIC_API_KEY property ================ */

function raiProxy_(d) {
  try {
    // Anyone can post to this endpoint, so cap it: the API key is ours to pay for.
    if (!rateLimit_('rai_' + (d.token || 'anon'), 20, 600)) return json({ reply: null, why: 'rate' });
    if (!rateLimit_('rai_all', 200, 3600))                   return json({ reply: null, why: 'rate' });
    var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!key) return json({ reply: null });                  // site falls back to its local brain
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        system: 'You are RAI, the helpful assistant for Ricky Rampersad Branch (Guardian Life, Trinidad) inside the Query Pal app. Be warm and brief (2-4 sentences). Help clients and agents pick the right service request, explain what documents to prepare, and give the branch contact (WhatsApp 1-868-678-6921) when asked. Never invent policy details or promise outcomes.',
        messages: (d.messages || []).slice(-8)
      }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return json({ reply: null });
    var body = JSON.parse(res.getContentText());
    var txt = (body.content && body.content[0] && body.content[0].text) ? body.content[0].text : null;
    return json({ reply: txt });
  } catch (err) { return json({ reply: null }); }
}

function runSelfTest() {
  const fake = {
    timestamp:new Date().toISOString(), loggedBy:'Agent', status:'Open',
    client:'Test Client', name:'Test Client', email:TEST_EMAIL, phone:'868-000-0000',
    policy:'TEST123', agent:'Ricky Rampersad', agentEmail:TEST_EMAIL,
    category:'Policy Servicing', queryType:'Surrenders',
    department:'Customer Service - Chaguanas SRSC', departmentEmail:TEST_EMAIL,
    turnaround:'10 days', priority:'Normal',
    descFirst10:'This is a ', description:'This is a self-test row.', cc:TEST_EMAIL
  };
  const out = doPost({postData:{contents:JSON.stringify(fake)}});
  Logger.log('Self-test result: ' + out.getContent());
}

function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
