/**
 * BRANCH INTELLIGENCE AUTOMATION — Ricky Rampersad Branch (Guardian Life)
 * =======================================================================
 * Attach this script to the branch Google Sheet (Extensions → Apps Script)
 * or run standalone with SHEET_ID set below.
 *
 * What it does, driven by the "Days" (arrears) column your staff update daily:
 *   Day 45+ : client email — thank-you, full policy history, payment note,
 *             1-click satisfaction survey (stored in "Survey Responses").
 *   Day 60+ : client follow-up that references the 45-day email and the
 *             survey (re-asks politely if not answered).
 *   Day 75+ : agent email referencing the 45-day email + the client's survey
 *             feedback, with a link to the Conservation Action form
 *             (replaces OTForms). When the agent submits, the manager is
 *             emailed to respond; the response is logged and sent back
 *             to the agent.
 *
 * Web app (one URL, role-based):  ?page=...
 *   client portal  — token link in every client email (portfolio + history)
 *   survey         — 1-click rating links from the 45/60-day emails
 *   agent          — login: pending conservation cases + their arrears book
 *   manager        — login: agent submissions awaiting response, survey feed
 *   staff          — login: daily queue, send log, survey feed
 *
 * SAFETY: TEST_MODE is ON by default — every email goes to TEST_EMAIL only.
 * Flip it to false only after you have reviewed real sends.
 */

// ============================== CONFIG =====================================
var CONFIG = {
  // Leave SHEET_ID blank if the script is bound to the sheet itself.
  SHEET_ID: '1T1SG3mgs5QV5LuF3JTpmn1zFldhGjOQNoe0YCMhWxjs',

  // The data tab is AUTO-DETECTED by its headers (Days, Paid To Date, email).
  // Set a name here only to override auto-detection.
  DATA_TAB: '',

  BRANCH_NAME: 'Ricky Rampersad Branch — Guardian Life',
  OPS_EMAIL: 'ricky.rampersad@myguardiangroup.com',   // Ricky — copied on all routings + daily digest
  MANAGER_EMAIL: 'ricky.rampersad@myguardiangroup.com', // fallback manager if no direct manager found
  SALES_SUPPORT_EMAIL: 'ricky.rampersad@myguardiangroup.com',   // TODO: sales support address
  CONSERVATION_EMAIL: 'ricky.rampersad@myguardiangroup.com',    // TODO: conservation department address
  REPLY_TO: 'ricky.rampersad@myguardiangroup.com',

  // All intelligence comes from the branch portfolio sheet itself.
  // The fact-find sheet is OPTIONAL extra context — disabled by default.
  USE_FACTFIND: false,
  FACTFIND_SHEET_ID: '1iytBbnETQFRmkveDSxadjsAfN07aMTW9E2slcA5qaWI',

  // TEST MODE — while true, ALL outbound email is redirected here.
  TEST_MODE: true,
  TEST_EMAIL: 'rampersadricky@gmail.com',

  // SEND_MODE 'manual': the 45-day letters are NOT sent automatically — they
  // queue on the staff dashboard, staff do their reference checks and click
  // Send. Everything downstream (3-day reminders, 60/75/90) then runs itself,
  // but only for cases staff actually sent. 'auto' restores full automation.
  SEND_MODE: 'manual',
  REMINDER_EVERY_DAYS: 3,   // client nudge cadence after the 45-day letter, until they respond

  // Stage thresholds (days in arrears) and guard rails
  STAGE_CLIENT_1: 45,
  STAGE_CLIENT_2: 60,
  STAGE_AGENT: 75,
  STAGE_CLIENT_3: 90,     // lapse-stage last-chance email to the client
  MAX_DAYS: 180,          // ignore ancient arrears (historic lapsed book)
  DAILY_SEND_CAP: 80,     // stay well under Gmail/Workspace quota
  ELIGIBLE_STATUSES: ['Premium Paying'],  // Status Description values to work
  RESPECT_SEND_FLAG: true, // a literal "N" in "Send Y or N" suppresses a row

  // Shown in client emails — edit to your branch's real payment channels.
  PAYMENT_INSTRUCTIONS:
    'You can bring your premium up to date at any Guardian Life office, ' +
    'through online banking to Guardian Life of the Caribbean, or by ' +
    'contacting our branch at 868-XXX-XXXX.',

  // Set automatically the first time the web app runs; you can also paste
  // the deployed /exec URL here.
  WEBAPP_URL: ''
};

var TABS = {
  LOG: 'Comms Log',
  SURVEY: 'Survey Responses',
  ACTIONS: 'Conservation Actions',
  USERS: 'App Users',
  TOKENS: 'Client Tokens',
  REQUESTS: 'Client Requests',
  REQLOG: 'Requirements Log'
};

var BRAND = { navy: '#003366', blue: '#005EB8', gold: '#E8A020', light: '#E8F0F8' };
var DEMO_RUN = false; // true only inside sendDemoSequence — suppresses logging

// Per-execution caches — Apps Script is slow on repeated service calls, and the
// book is 20k+ rows; read it once per run, not once per email.
var BOOK_MEMO = null;
var TZ_MEMO = null;
function tz_() { return TZ_MEMO || (TZ_MEMO = Session.getScriptTimeZone()); }

// Result cache: each portal view re-reads the 20k-row book on every click
// without this. Views are cached 5 min and busted the moment anything changes.
var CACHE_KEYS = ['v:dash', 'v:camps', 'v:opps:ALL', 'v:reqs:ALL', 'v:prod'];
function cacheGetJson_(key) {
  try { var v = CacheService.getScriptCache().get(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function cachePutJson_(key, obj) {
  try { var s = JSON.stringify(obj); if (s.length < 95000) CacheService.getScriptCache().put(key, s, 300); } catch (e) {}
}
function cacheBust_() {
  try { CacheService.getScriptCache().removeAll(CACHE_KEYS); } catch (e) {}
}

// ============================== MENU / SETUP ===============================
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('★ Branch Automation')
      .addItem('1. Set up tabs & seed users', 'setupTabs')
      .addItem('1b. Seed branch team logins', 'seedBranchTeam')
      .addItem('2. Install daily trigger (9am)', 'installTriggers')
      .addItem('3. Run automation now', 'dailyAutomation')
      .addItem('Preview today’s queue (no send)', 'previewQueue')
      .addItem('Send demo sequence to my inbox', 'sendDemoSequence')
      .addItem('Send responses report now (3pm report)', 'dailyResponsesReport')
      .addItem('Send weekly summary now', 'weeklyDigest')
      .addToUi();
  } catch (e) { /* standalone script — no UI */ }
}

function ss_() {
  return CONFIG.SHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/** Creates the storage tabs and seeds App Users with every agent name found. */
function setupTabs() {
  var ss = ss_();
  ensureTab_(ss, TABS.LOG, ['Timestamp', 'Stage', 'Policy', 'Client No', 'Client', 'Recipient', 'Agent', 'Days', 'Status', 'Notes']);
  ensureTab_(ss, TABS.SURVEY, ['Timestamp', 'Client No', 'Client', 'Policy', 'Stage', 'Rating (1-5)', 'Comment', 'Difficulty', 'Preferred Help', 'Best Contact', 'Source', 'Payment Method Preference', 'Beneficiary Update?', 'Interested In', 'Contact/Address Update']);
  ensureTab_(ss, TABS.ACTIONS, ['ID', 'Submitted', 'Policy', 'Client No', 'Client', 'Agent Email', 'Client Contacted?', 'Contact Method', 'Outcome', 'Client Intention', 'Follow-up Date', 'Agent Notes', 'Status', 'Manager Response', 'Manager Email', 'Responded At', 'Root Cause', 'Earlier Warning Signs?', 'What Changed', 'Confidence', 'Recommended Action', 'Mgr Approvals', 'Mgr Decision']);
  ensureTab_(ss, TABS.USERS, ['Email', 'Name', 'Role (agent/manager/staff)', 'Agent Name (exactly as in data)', 'Access Code', 'Manager Email (direct manager)', 'Session Token']);
  ensureTab_(ss, TABS.TOKENS, ['Client No', 'Token', 'Created']);
  ensureTab_(ss, TABS.REQUESTS, ['Timestamp', 'Client No', 'Client', 'Type', 'Details', 'Handled']);
  ensureTab_(ss, TABS.REQLOG, ['Timestamp', 'Policy', 'Client No', 'Client', 'Agent', 'Author', 'Comment', 'New Status']);
  seedUsers_(ss);
}

function ensureTab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground(BRAND.light);
  }
  return sh;
}

/** One row per distinct agent in the data so staff only have to fill emails. */
function seedUsers_(ss) {
  var users = ss.getSheetByName(TABS.USERS);
  var existing = {};
  users.getDataRange().getValues().slice(1).forEach(function (r) { existing[String(r[3]).trim()] = true; });
  var agents = {};
  getBook_().forEach(function (p) { if (p.agent) agents[p.agent] = true; });
  var rows = Object.keys(agents).sort()
    .filter(function (a) { return !existing[a]; })
    .map(function (a) { return ['', a, 'agent', a, makeCode_(), '', '']; });
  if (rows.length) users.getRange(users.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
}

function makeCode_() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** The branch team who appear in the login dropdown — name + code, linked to
 *  the App Users sheet (edit codes there any time). */
function seedBranchTeam() {
  var TEAM = [
    ['ricky.rampersad@myguardiangroup.com', 'Ricky Rampersad', 'manager', '', '1'],
    ['', 'Kamala', 'staff', '', '1'],
    ['', 'Sasha', 'staff', '', '2'],
    ['', 'Azaria', 'staff', '', '3']
  ];
  var sh = ss_().getSheetByName(TABS.USERS);
  var vals = sh.getDataRange().getValues();
  TEAM.forEach(function (t) {
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][1]).trim().toLowerCase() === t[1].toLowerCase() &&
          ['staff', 'manager'].indexOf(String(vals[i][2]).trim().toLowerCase()) > -1) {
        sh.getRange(i + 1, 1, 1, 5).setValues([t]);
        return;
      }
    }
    sh.appendRow(t.concat(['', '']));
  });
  var msg = 'Branch team seeded: Ricky Rampersad (branch manager, code 1), Kamala (staff, 1), Sasha (staff, 2), Azaria (staff, 3). Change codes any time in App Users.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/** Names for the login dropdown — branch team only (staff + managers). */
function apiLoginList() {
  var sh = ss_().getSheetByName(TABS.USERS);
  if (!sh) return { ok: true, team: [] };
  var team = [];
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    var role = String(r[2]).trim().toLowerCase();
    if ((role === 'staff' || role === 'manager') && String(r[4]).trim() && String(r[1]).trim()) {
      team.push({ name: String(r[1]).trim(), role: role === 'manager' ? 'Branch Manager' : 'Staff' });
    }
  });
  team.sort(function (a, b) { return (a.role === 'Branch Manager' ? 0 : 1) - (b.role === 'Branch Manager' ? 0 : 1) || a.name.localeCompare(b.name); });
  return { ok: true, team: team };
}

function installTriggers() {
  var mine = ['dailyAutomation', 'dailyResponsesReport', 'weeklyDigest'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (mine.indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyAutomation').timeBased().atHour(9).everyDays(1).create();
  ScriptApp.newTrigger('dailyResponsesReport').timeBased().atHour(15).everyDays(1).create();   // 3pm daily
  ScriptApp.newTrigger('weeklyDigest').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(16).create(); // Fri 4pm
}

// ============================== RESPONSE REPORTS ===========================
function surveyAll_() {
  var sh = ss_().getSheetByName(TABS.SURVEY);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1).map(function (r) {
    return { when: (r[0] instanceof Date) ? r[0] : new Date(r[0]), clientNo: String(r[1]), client: String(r[2]),
             policy: String(r[3]), stage: String(r[4]), rating: r[5], comment: String(r[6] || ''),
             difficulty: String(r[7] || ''), help: String(r[8] || ''), bestContact: String(r[9] || ''),
             source: String(r[10] || ''), payMethod: String(r[11] || ''), beneficiary: String(r[12] || ''),
             interest: String(r[13] || ''), contactUpd: String(r[14] || '') };
  }).filter(function (r) { return !isNaN(r.when); });
}

function responseRowHtml_(s) {
  var bits = [];
  if (s.rating) bits.push('rating <b>' + esc_(s.rating) + '/5</b>');
  if (s.difficulty) bits.push('difficulty: <b>' + esc_(s.difficulty) + '</b>');
  if (s.help) bits.push('wants: <b>' + esc_(s.help) + '</b>');
  if (s.payMethod) bits.push('pay by: <b>' + esc_(s.payMethod) + '</b>');
  if (s.beneficiary) bits.push('beneficiary: <b>' + esc_(s.beneficiary) + '</b>');
  if (s.interest && !/not right now/i.test(s.interest)) bits.push('<b style="color:#1a7f43">★ interested: ' + esc_(s.interest) + '</b>');
  if (s.contactUpd && !/current/i.test(s.contactUpd)) bits.push('<b style="color:#b02a2a">⚠ contact: ' + esc_(s.contactUpd) + '</b>');
  if (s.bestContact) bits.push('reach: <b>' + esc_(s.bestContact) + '</b>');
  if (s.comment) bits.push('“' + esc_(s.comment) + '”');
  return '<tr><td style="padding:6px 10px;border-bottom:1px solid #eef;white-space:nowrap;vertical-align:top">' +
    esc_(fmtDate_(s.when)) + '</td>' +
    '<td style="padding:6px 10px;border-bottom:1px solid #eef;vertical-align:top"><b>' + esc_(titleCase_(s.client)) +
    '</b><br><span style="color:#556">' + esc_(s.policy) + ' · ' + esc_(s.stage) + '</span></td>' +
    '<td style="padding:6px 10px;border-bottom:1px solid #eef;vertical-align:top;font-size:12px">' + bits.join(' · ') + '</td></tr>';
}

/** Daily 3pm: every client response received today, in full, to the team. */
function dailyResponsesReport() {
  var start = new Date(); start.setHours(0, 0, 0, 0);
  var todays = surveyAll_().filter(function (s) { return s.when >= start; });
  var leads = todays.filter(function (s) { return s.interest && !/not right now/i.test(s.interest); }).length;
  var updates = todays.filter(function (s) { return s.contactUpd && !/current/i.test(s.contactUpd); }).length;
  var body = '<p style="font-size:14px"><b>Client responses today — ' + fmtDate_(new Date()) + '</b></p>' +
    '<ul style="font-size:13px"><li>Responses received: <b>' + todays.length + '</b></li>' +
    '<li>★ Cross-sell leads: <b>' + leads + '</b></li><li>⚠ Contact updates needed: <b>' + updates + '</b></li></ul>' +
    (todays.length
      ? '<table style="border-collapse:collapse;width:100%;font-size:12px;margin:12px 0">' +
        todays.map(responseRowHtml_).join('') + '</table>'
      : '<p style="font-size:13px;color:#556">No client responses came in today. The 3-day nudges keep working the sent letters automatically.</p>') +
    '<p style="font-size:13px;color:#556">Full history per client is in the portal under History.</p>';
  MailApp.sendEmail({
    to: CONFIG.OPS_EMAIL,
    subject: '[Branch Responses] ' + todays.length + ' today · ' + leads + ' leads · ' + updates + ' contact updates — ' + fmtDate_(new Date()),
    htmlBody: emailShell_(body), name: 'Branch Intelligence'
  });
}

/** Weekly condensed summary (Fridays 4pm): the week in one screen. */
function weeklyDigest() {
  var since = new Date(Date.now() - 7 * 86400000);
  var wk = surveyAll_().filter(function (s) { return s.when >= since; });
  var checkins = wk.filter(function (s) { return /check-in|email-tap/.test(s.source); });
  var leads = wk.filter(function (s) { return s.interest && !/not right now/i.test(s.interest); });
  var updates = wk.filter(function (s) { return s.contactUpd && !/current/i.test(s.contactUpd); });
  var planFb = wk.filter(function (s) { return s.stage === 'PLAN-FEEDBACK'; });
  var exits = wk.filter(function (s) { return s.stage === 'EXIT-90'; });
  var ratings = wk.map(function (s) { return Number(s.rating); }).filter(function (n) { return n >= 1; });
  var avgRating = ratings.length ? (ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length).toFixed(1) : '—';
  // Letters sent this week, from the Comms Log
  var sends = { 'CLIENT-45': 0, 'REMIND-CLIENT': 0, 'CLIENT-60': 0, 'AGENT-75': 0, 'CLIENT-90': 0,
                'CLIENT-RESPONDED': 0, 'PAYMENT-RECEIVED': 0 };
  var logSh = ss_().getSheetByName(TABS.LOG);
  if (logSh) logSh.getDataRange().getValues().slice(1).forEach(function (r) {
    var d = (r[0] instanceof Date) ? r[0] : new Date(r[0]);
    if (!isNaN(d) && d >= since && sends[r[1]] != null && r[8] !== 'ERROR') sends[r[1]]++;
  });
  var acts = actionsIndex_().rows.filter(function (a) { return new Date(a.submitted) >= since; });
  var responded = acts.filter(function (a) { return a.status === 'Responded'; }).length;
  function stat(n, l) {
    return '<td style="text-align:center;padding:10px;border:1px solid #dbe6f2;border-radius:8px">' +
      '<div style="font-size:22px;font-weight:700;color:' + BRAND.navy + '">' + n + '</div>' +
      '<div style="font-size:10px;color:#567;text-transform:uppercase;letter-spacing:.05em">' + l + '</div></td>';
  }
  var leadRows = leads.slice(0, 15).map(function (s) {
    return '<li><b>' + esc_(titleCase_(s.client)) + '</b> (' + esc_(s.policy) + ') — ' + esc_(s.interest) + '</li>';
  }).join('');
  var body = '<p style="font-size:14px"><b>Week in review — ' + fmtDate_(since) + ' to ' + fmtDate_(new Date()) + '</b></p>' +
    '<table style="border-collapse:separate;border-spacing:6px;width:100%;font-size:13px">' +
    '<tr>' + stat(sends['CLIENT-45'], '45-day sent') + stat(sends['REMIND-CLIENT'], '3-day nudges') +
    stat(sends['CLIENT-60'], '60-day sent') + stat(sends['AGENT-75'], 'agent handoffs') + stat(sends['CLIENT-90'], '90-day sent') + '</tr>' +
    '<tr>' + stat(checkins.length, 'client responses') + stat(leads.length, '★ cross-sell leads') +
    stat(updates.length, '⚠ contact updates') + stat(sends['CLIENT-RESPONDED'] + sends['PAYMENT-RECEIVED'], 'marked saved/paid') +
    stat(avgRating, 'avg rating') + '</tr>' +
    '<tr>' + stat(acts.length, 'agent forms in') + stat(responded, 'manager responses') +
    stat(planFb.length, 'plan feedback') + stat(exits.length, 'final-word surveys') + stat('', '') + '</tr></table>' +
    (leadRows ? '<p style="font-size:13px"><b>★ Cross-sell leads this week:</b></p><ul style="font-size:13px;color:#334">' + leadRows + '</ul>' : '') +
    '<p style="font-size:13px;color:#556">Details: daily 3pm responses reports, the morning digests, and the portal History tab.</p>';
  MailApp.sendEmail({
    to: CONFIG.OPS_EMAIL,
    subject: '[Branch Weekly] ' + checkins.length + ' responses · ' + leads.length + ' leads · ' +
      (sends['CLIENT-RESPONDED'] + sends['PAYMENT-RECEIVED']) + ' saved/paid — week ending ' + fmtDate_(new Date()),
    htmlBody: emailShell_(body), name: 'Branch Intelligence'
  });
}

/** Sends the full email sequence for ONE real policy to TEST_EMAIL only —
 *  regardless of TEST_MODE — so you can rehearse the whole journey in your
 *  own inbox without touching a client. Nothing is logged; safe to repeat. */
function sendDemoSequence() {
  var pick = null;
  var book = getBook_();
  for (var i = 0; i < book.length; i++) {
    var p = book[i];
    if (CONFIG.ELIGIBLE_STATUSES.indexOf(p.statusDesc) > -1 && p.days >= CONFIG.STAGE_CLIENT_1 &&
        p.days <= CONFIG.MAX_DAYS && p.email) { pick = p; break; }
  }
  if (!pick) throw new Error('No eligible 45+ day Premium Paying policy with an email found in the data.');
  var saveMode = CONFIG.TEST_MODE, saveTest = CONFIG.TEST_EMAIL;
  CONFIG.TEST_MODE = true; // force-redirect everything in this run
  DEMO_RUN = true;
  try {
    sendClient45_(pick);
    logComm_('CLIENT-45', pick, CONFIG.TEST_EMAIL, 'SENT', 'Demo rehearsal');
    sendClient60_(pick, commsIndex_());
    logComm_('CLIENT-60', pick, CONFIG.TEST_EMAIL, 'SENT', 'Demo rehearsal');
    sendAgentEmail_(pick, CONFIG.TEST_EMAIL, commsIndex_());
    logComm_('AGENT-75', pick, CONFIG.TEST_EMAIL, 'SENT', 'Demo rehearsal');
    sendClient90_(pick, commsIndex_());
  } finally {
    CONFIG.TEST_MODE = saveMode; CONFIG.TEST_EMAIL = saveTest; DEMO_RUN = false;
  }
  var msg = 'Demo sequence for ' + titleCase_(pick.client) + ' (' + pick.policy + ', ' + pick.days +
    'd) sent to ' + CONFIG.TEST_EMAIL + ': 45-day, 60-day, 75-day agent, 90-day + case file. ' +
    'Logged as DEMO entries — search this client in the portal History tab to see the timeline.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

// ============================== DATA LAYER =================================
/** Auto-detect the daily data tab by its headers. */
function dataSheet_() {
  var ss = ss_();
  if (CONFIG.DATA_TAB) return ss.getSheetByName(CONFIG.DATA_TAB);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var head = sheets[i].getRange(1, 1, 1, Math.min(30, sheets[i].getLastColumn() || 1))
      .getValues()[0].map(function (h) { return String(h).toLowerCase().trim(); });
    if (head.indexOf('days') > -1 && head.indexOf('paid to date') > -1 && head.indexOf('email') > -1) {
      return sheets[i];
    }
  }
  throw new Error('Could not find the policy data tab (needs Days / Paid To Date / email headers). Set CONFIG.DATA_TAB.');
}

/** Reads the whole book once into plain objects (cached per execution). */
function getBook_() {
  if (BOOK_MEMO) return BOOK_MEMO;
  var sh = dataSheet_();
  var vals = sh.getDataRange().getValues();
  var head = vals[0].map(function (h) { return String(h).toLowerCase().trim(); });
  function col(name) { return head.indexOf(name); }
  var c = {
    agent: col('agent'), policy: col('number'), clientNo: col('client number'),
    client: col('client'), premium: col('premium'), issue: col('issue date'),
    status2: col('status(2)'), days: col('days'), type: col('insurance type'),
    appRecv: col('app received date'),
    paidTo: col('paid to date'), sum: col('sum assured'), plan: col('plan code'),
    billing: col('billing type'), statusDesc: col('status description'),
    lapse: col('projected lapse date'), phone: col('phone'), email: col('email'),
    address: col('address'),
    send: col('send y or n'),
    // Optional: add a "Beneficiary" column to the data tab and it will appear
    // in client emails and the check-in automatically.
    beneficiary: col('beneficiary')
  };
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (!r[c.policy]) continue;
    out.push({
      agent: String(r[c.agent] || '').trim(),
      policy: String(r[c.policy]).trim(),
      clientNo: String(r[c.clientNo] || '').trim(),
      client: String(r[c.client] || '').trim(),
      premium: num_(r[c.premium]),
      issue: fmtDate_(r[c.issue]),
      status2: String(r[c.status2] || '').trim(),
      days: Math.floor(num_(r[c.days])),
      paidTo: fmtDate_(r[c.paidTo]),
      appRecv: fmtDate_(r[c.appRecv]),
      sum: num_(r[c.sum]),
      plan: String(r[c.plan] || '').trim(),
      billing: String(r[c.billing] || '').trim(),
      statusDesc: String(r[c.statusDesc] || '').trim(),
      lapseDate: fmtDate_(r[c.lapse]),
      phone: String(r[c.phone] || '').trim(),
      email: cleanEmail_(r[c.email]),
      address: String(c.address > -1 ? (r[c.address] || '') : '').trim(),
      send: String(c.send > -1 ? (r[c.send] || '') : '').trim().toUpperCase(),
      beneficiary: String(c.beneficiary > -1 ? (r[c.beneficiary] || '') : '').trim()
    });
  }
  BOOK_MEMO = out;
  return out;
}

function cleanEmail_(e) {
  var s = String(e || '').replace(/\s+/g, '').toLowerCase();
  return /^[^@]+@[^@]+\.[a-z]{2,}$/.test(s) ? s : '';
}
function num_(v) {
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v || '').replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}
var MONTHS_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate_(v) {
  // Pure-JS formatting: Utilities.formatDate is ~100x slower and this runs
  // tens of thousands of times per book read.
  if (v instanceof Date && !isNaN(v)) {
    return ('0' + v.getDate()).slice(-2) + ' ' + MONTHS_[v.getMonth()] + ' ' + v.getFullYear();
  }
  var s = String(v || '').trim();
  return (s === '##########' || s === '30 Mar 1900') ? '' : s;
}
function money_(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function firstName_(full) {
  var w = String(full || '').trim().split(/\s+/)[0] || 'Valued Client';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}
function titleCase_(s) {
  return String(s || '').toLowerCase().replace(/\b[a-z]/g, function (m) { return m.toUpperCase(); });
}

// ============================== FACT FIND LAYER ============================
// Reads the fact-find-analyzer sheet: financial ratios, lapse risk, direct
// manager, advisor. Matched to policies by normalised client name.
var FF_MEMO = null;
function normName_(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

function factFindIndex_() {
  if (FF_MEMO) return FF_MEMO;
  FF_MEMO = {};
  if (!CONFIG.USE_FACTFIND) return FF_MEMO;
  try {
    var ffss = SpreadsheetApp.openById(CONFIG.FACTFIND_SHEET_ID);
    var sheets = ffss.getSheets(), sh = null;
    for (var i = 0; i < sheets.length; i++) {
      var h = sheets[i].getRange(1, 1, 1, Math.min(12, sheets[i].getLastColumn() || 1)).getValues()[0].join('|');
      if (h.indexOf('Submission ID') > -1 && h.indexOf('Client Name') > -1) { sh = sheets[i]; break; }
    }
    if (!sh) return FF_MEMO;
    var vals = sh.getDataRange().getValues();
    var head = vals[0].map(function (x) { return String(x).trim(); });
    function ci(name) { return head.indexOf(name); }
    var c = {
      client: ci('Client Name'), status: ci('Status'), submitted: ci('Submitted At'),
      advisor: ci('Advisor Name'), agentEmail: ci('Agent Email'), interview: ci('Interview Date'),
      income: ci('Monthly Income'), expenses: ci('Monthly Expenses'), surplus: ci('Cash Surplus (calc)'),
      cover: ci('Total Coverage (calc)'), need: ci('Insurance Need (calc)'),
      dmName: ci('Direct Mgr Name'), dmEmail: ci('Direct Mgr Email'),
      lapseRisk: ci('RAI Lapse Risk'), lapseFactors: ci('RAI Lapse Risk Factors')
    };
    var RATIOS = [
      ['Surplus ratio', 'FI Surplus Ratio', 'FI Surplus Band'],
      ['Debt-to-income', 'FI Debt-to-Income', 'FI DTI Band'],
      ['Emergency fund', 'FI Emergency Fund', 'FI Emergency Band'],
      ['Coverage gap', 'FI Coverage Gap', 'FI Coverage Band'],
      ['Protection multiple', 'FI Protection Multiple', 'FI Protection Band'],
      ['Premium burden', 'FI Premium Burden', 'FI Premium Band'],
      ['Retirement readiness', 'FI Retirement Readiness', 'FI Retirement Band']
    ];
    for (var r = 1; r < vals.length; r++) {
      var row = vals[r];
      var key = normName_(row[c.client]);
      if (!key) continue;
      var rec = {
        client: String(row[c.client]).trim(), status: String(row[c.status] || ''),
        submitted: row[c.submitted], advisor: String(row[c.advisor] || ''),
        agentEmail: cleanEmail_(row[c.agentEmail]), interview: fmtDate_(row[c.interview]),
        income: num_(row[c.income]), expenses: num_(row[c.expenses]), surplus: num_(row[c.surplus]),
        cover: num_(row[c.cover]), need: num_(row[c.need]),
        dmName: String(c.dmName > -1 ? row[c.dmName] : '').trim(),
        dmEmail: cleanEmail_(c.dmEmail > -1 ? row[c.dmEmail] : ''),
        lapseRisk: String(c.lapseRisk > -1 ? row[c.lapseRisk] : '').trim(),
        lapseFactors: String(c.lapseFactors > -1 ? row[c.lapseFactors] : '').trim(),
        ratios: RATIOS.map(function (def) {
          var v = ci(def[1]) > -1 ? String(row[ci(def[1])]).trim() : '';
          var b = ci(def[2]) > -1 ? String(row[ci(def[2])]).toLowerCase().trim() : '';
          return { label: def[0], value: v, band: b };
        }).filter(function (x) { return x.value; })
      };
      // keep the most recent submission per client
      if (!FF_MEMO[key] || new Date(rec.submitted) > new Date(FF_MEMO[key].submitted)) FF_MEMO[key] = rec;
    }
  } catch (e) { Logger.log('Fact find sheet unavailable: ' + e); }
  return FF_MEMO;
}
function factFindFor_(clientName) { return factFindIndex_()[normName_(clientName)] || null; }

function ffPanelHtml_(ff) {
  if (!ff) return '<p style="font-size:13px;color:#667">No fact find on file for this client — worth completing one during the conservation call.</p>';
  var bandColor = { good: '#1a7f43', ok: '#9a6205', warn: '#9a6205', bad: '#b02a2a' };
  var chips = ff.ratios.map(function (r) {
    var col = bandColor[r.band] || '#456';
    return '<span style="display:inline-block;margin:3px 4px 3px 0;padding:4px 10px;border-radius:14px;background:#f2f6fb;' +
      'font-size:12px;color:' + col + '"><b>' + esc_(r.label) + ':</b> ' + esc_(r.value) +
      (r.band ? ' (' + esc_(r.band) + ')' : '') + '</span>';
  }).join('');
  return '<div style="border:1px solid #dbe6f2;border-radius:10px;padding:14px;margin:12px 0;background:#fbfdff">' +
    '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:13px;margin-bottom:6px">FACT FIND ON FILE — interviewed ' +
    esc_(ff.interview || '?') + ' by ' + esc_(ff.advisor || '?') + '</div>' +
    '<div style="font-size:13px;color:#334">Income <b>' + money_(ff.income) + '</b>/mo · Expenses <b>' + money_(ff.expenses) +
    '</b>/mo · Surplus <b>' + money_(ff.surplus) + '</b>/mo · Coverage <b>' + money_(ff.cover) +
    '</b> vs need <b>' + money_(ff.need) + '</b></div>' +
    '<div style="margin-top:6px">' + chips + '</div>' +
    (ff.lapseRisk ? '<div style="font-size:13px;color:#334;margin-top:6px">Model lapse risk at point of sale: <b>' + esc_(ff.lapseRisk) + '</b>' +
      (ff.lapseFactors ? ' — ' + esc_(ff.lapseFactors) : '') + '</div>' : '') +
    '</div>';
}

// ============================== CORE-SYSTEM EXPORT LAYER ===================
// The "Export" tab: 44-column core-system extract, joined to the book by
// Policy Id. Auto-detected by headers; totals rows skipped; cached per run.
var EXPORT_MEMO = null;
var MON_ = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
function parseDMY_(s) {
  if (s instanceof Date && !isNaN(s)) return s;
  var m = String(s || '').match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (!m) return null;
  var d = new Date(Number(m[3]), MON_[m[2].toLowerCase()], Number(m[1]));
  return isNaN(d) ? null : d;
}
function exportIndex_() {
  if (EXPORT_MEMO) return EXPORT_MEMO;
  EXPORT_MEMO = { byPolicy: {}, all: [], agentStatus: {} };
  try {
    var sheets = ss_().getSheets(), sh = null;
    for (var i = 0; i < sheets.length; i++) {
      var head = sheets[i].getRange(1, 1, 1, Math.min(46, sheets[i].getLastColumn() || 1)).getValues()[0].join('|');
      if (head.indexOf('Policy Id') > -1 && head.indexOf('Servicing Agent Status') > -1) { sh = sheets[i]; break; }
    }
    if (!sh) return EXPORT_MEMO;
    var vals = sh.getDataRange().getValues();
    var head = vals[0].map(function (h) { return String(h).trim(); });
    function ci(n) { return head.indexOf(n); }
    var c = { pol: ci('Policy Id'), gn: ci('Given Name'), sn: ci('Surname'), plan: ci('Plan'),
      eff: ci('Policy Effective Date'), mat: ci('Policy Maturity Date'), over: ci('DaysOverDue'),
      f3: ci('Funds For 3 Premiums'), ms: ci('Misc Suspense Amount'), ps: ci('Premium In Suspense Amount'),
      si: ci('Sum Insured'), billType: ci('Policy Bill Type'), ap: ci('Annual Premium'),
      paidTo: ci('Policy Paid To Date'), fv: ci('Fund Value'), cid: ci('Client Id'),
      dob: ci('Client Birth Date'), sex: ci('Sex'),
      c1: ci('Contact 1'), c2: ci('Contact 2'), c3: ci('Contact 3'), email: ci('Email'),
      a1: ci('Address Line 1'), a2: ci('Address Line 2'), city: ci('City'),
      agtId: ci('Servicing Agent Id'), agtName: ci('Servcing Agent Name'), agtStat: ci('Servicing Agent Status'),
      agtEnd: ci('Servicing Agent Contract End Date'),
      disp: ci('Dispatch Date'), deliv: ci('Delivery Category') };
    var now = new Date();
    for (var r = 1; r < vals.length; r++) {
      var row = vals[r];
      var pol = String(row[c.pol] || '').trim();
      if (!pol || /^total/i.test(pol)) continue;
      var mat = parseDMY_(row[c.mat]);
      var dob = parseDMY_(row[c.dob]);
      var rec = {
        policy: pol,
        name: titleCase_(String(row[c.gn] || '') + ' ' + String(row[c.sn] || '')),
        plan: String(row[c.plan] || '').trim(),
        maturity: mat,
        monthsToMaturity: mat ? Math.round((mat - now) / 2628000000) : null,
        overdue: Math.round(num_(row[c.over])),
        funds3: String(row[c.f3] || '').trim().toLowerCase() === 'yes',
        susp: num_(row[c.ps]) + num_(row[c.ms]),
        sumInsured: num_(row[c.si]),
        billType: String(row[c.billType] || '').trim(),
        annualPremium: num_(row[c.ap]),
        fundValue: num_(row[c.fv]),
        age: dob ? Math.floor((now - dob) / 31557600000) : null,
        sex: String(row[c.sex] || '').trim(),
        phone: [row[c.c1], row[c.c2], row[c.c3]].map(function (x) { return String(x || '').trim(); })
          .filter(function (x) { return x && !/not avail/i.test(x); })[0] || '',
        email: /not avail/i.test(String(row[c.email] || '')) ? '' : cleanEmail_(row[c.email]),
        city: String(row[c.city] || '').trim(),
        agentId: String(row[c.agtId] || '').trim(),
        agentName: titleCase_(String(row[c.agtName] || '').trim()),
        agentStatus: String(row[c.agtStat] || '').trim(),
        agentEnd: fmtDate_(parseDMY_(row[c.agtEnd]) || row[c.agtEnd]),
        dispatch: fmtDate_(parseDMY_(row[c.disp]) || row[c.disp]),
        undelivered: /undeliver/i.test(String(row[c.deliv] || ''))
      };
      EXPORT_MEMO.byPolicy[rec.policy] = rec;
      EXPORT_MEMO.all.push(rec);
      if (rec.agentName && rec.agentStatus) EXPORT_MEMO.agentStatus[rec.agentName.toLowerCase()] = rec.agentStatus;
    }
  } catch (e) { Logger.log('Export tab unavailable: ' + e); }
  return EXPORT_MEMO;
}

// ============================== PORTFOLIO INTELLIGENCE =====================
// Everything we need to know about a client, derived from OUR OWN BOOK:
// holdings, tenure, prior lapses, household arrears, and opportunity flags.
function portfolioIntel_(p, book) {
  var mine = (book || getBook_()).filter(function (q) { return q.clientNo === p.clientNo; });
  var act = mine.filter(function (q) { return q.statusDesc === 'Premium Paying'; });
  var totPrem = 0, totSum = 0;
  act.forEach(function (q) { totPrem += q.premium; totSum += q.sum; });
  var priorLapses = mine.filter(function (q) { return /Lapsed|Surrendered/i.test(q.statusDesc); }).length;
  var matured = mine.filter(function (q) { return /Matured|Paid up/i.test(q.statusDesc); }).length;
  var otherArrears = act.filter(function (q) { return q.policy !== p.policy && q.days >= 45; }).length;
  var tenure = 0;
  act.forEach(function (q) {
    var m = String(q.issue || '').match(/(\d{4})/);
    if (m) tenure = Math.max(tenure, new Date().getFullYear() - Number(m[1]));
  });
  var flags = [];
  if (act.length === 1) flags.push({ k: 'only-policy', label: 'Their ONLY active policy', hint: 'Losing it means losing the client entirely — and one-policy clients are the branch’s biggest cross-sell pool.' });
  if (act.length > 1) flags.push({ k: 'multi', label: act.length + ' active policies (' + money_(totPrem) + ' premium)', hint: 'A valued household — protect the whole relationship.' });
  if (otherArrears) flags.push({ k: 'household-risk', label: otherArrears + ' OTHER policy(ies) also in arrears', hint: 'The whole household is slipping — one conversation can rescue all of them.' });
  if (priorLapses) flags.push({ k: 'fragile', label: priorLapses + ' prior lapse/surrender on record', hint: 'This client has walked away before — handle warmly and fix the payment method for good.' });
  if (tenure >= 10) flags.push({ k: 'loyal', label: tenure + ' years with us', hint: 'A loyal client worth a personal call — and overdue a coverage review.' });
  if (matured) flags.push({ k: 'redeploy', label: matured + ' matured/paid-up policy(ies)', hint: 'Money conversation waiting: where did those proceeds go?' });
  // Core-system export intelligence for THIS policy (joined by Policy Id)
  var ex = exportIndex_().byPolicy[p.policy];
  if (ex) {
    if (ex.susp > 0) flags.unshift({ k: 'suspense', label: '💰 ' + money_(ex.susp) + ' SITTING IN SUSPENSE', hint: 'Money already received but unapplied — check this BEFORE any arrears contact; it may clear the balance.' });
    if (ex.funds3) flags.push({ k: 'apl', label: '🛡️ Fund can carry 3 premiums', hint: 'APL is viable — cover need not break while the client catches up.' });
    if (ex.undelivered) flags.push({ k: 'undelivered', label: '📦 Policy documents UNDELIVERED' + (ex.dispatch ? ' (dispatched ' + ex.dispatch + ')' : ''), hint: 'Deliver the contract — an instant service win on the same visit.' });
    if (ex.monthsToMaturity !== null && ex.monthsToMaturity >= 0 && ex.monthsToMaturity <= 24) flags.push({ k: 'maturity', label: '🎯 Matures ' + fmtDate_(ex.maturity), hint: 'Redeployment conversation coming — start it early and keep the money in the family.' });
    if (ex.agentStatus && ex.agentStatus.toLowerCase() !== 'active') flags.push({ k: 'orphan', label: '🧭 Servicing agent is ' + ex.agentStatus.toUpperCase(), hint: 'Orphan client — needs an adopter; see the Campaigns tab.' });
  }
  return { policies: mine.length, active: act.length, totalPremium: totPrem, totalSum: totSum,
           tenure: tenure, priorLapses: priorLapses, otherArrears: otherArrears, matured: matured, flags: flags,
           ex: ex ? { susp: ex.susp, funds3: ex.funds3, age: ex.age, billType: ex.billType, fundValue: ex.fundValue } : null };
}

/** The intelligence panel used in agent/manager emails — grounded 100% in the
 *  branch portfolio (plus the fact find only if USE_FACTFIND is on). */
function clientIntelHtml_(p) {
  var pi = portfolioIntel_(p);
  var flagHtml = pi.flags.map(function (f) {
    return '<div style="font-size:13px;color:#334;margin:4px 0">▸ <b>' + esc_(f.label) + '</b> — ' + esc_(f.hint) + '</div>';
  }).join('');
  var html = '<div style="border:1px solid #dbe6f2;border-radius:10px;padding:14px;margin:12px 0;background:#fbfdff">' +
    '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:13px;margin-bottom:6px">CLIENT PORTFOLIO INTELLIGENCE — from our own book</div>' +
    '<div style="font-size:13px;color:#334">' + pi.active + ' active of ' + pi.policies + ' lifetime policies · active premium <b>' +
    money_(pi.totalPremium) + '</b>/yr · sum assured <b>' + money_(pi.totalSum) + '</b>' +
    (pi.tenure ? ' · client for <b>' + pi.tenure + ' years</b>' : '') + '</div>' +
    (flagHtml || '<div style="font-size:13px;color:#556;margin-top:4px">No special flags — a straightforward save.</div>') +
    '</div>';
  var ff = factFindFor_(p.client);
  if (ff) html += ffPanelHtml_(ff);
  return html;
}

// ============================== COMMS LOG ==================================
function commsIndex_() {
  var sh = ss_().getSheetByName(TABS.LOG);
  var idx = {};
  if (!sh) return idx;
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    idx[r[2] + '|' + r[1]] = { when: r[0], recipient: r[5] };  // policy|stage
  });
  return idx;
}
function logComm_(stage, p, recipient, status, notes) {
  // Demo runs are logged with a DEMO- prefix: visible in the History timeline,
  // but they never block or trigger the real stages (which key on exact names).
  if (DEMO_RUN) stage = 'DEMO-' + stage;
  ss_().getSheetByName(TABS.LOG).appendRow([
    new Date(), stage, p.policy, p.clientNo, p.client, recipient, p.agent, p.days, status, notes || ''
  ]);
}

// ============================== QUEUE LOGIC ================================
/** Which stage (if any) is due for a row, given what was already sent. */
function stageDue_(p, sent) {
  if (CONFIG.ELIGIBLE_STATUSES.indexOf(p.statusDesc) === -1) return null;
  if (CONFIG.RESPECT_SEND_FLAG && p.send === 'N') return null;
  if (!p.days || p.days < CONFIG.STAGE_CLIENT_1 || p.days > CONFIG.MAX_DAYS) return null;
  var k = function (st) { return sent[p.policy + '|' + st]; };
  // Payment recorded by staff halts the whole sequence for this policy.
  if (k('PAYMENT-RECEIVED')) return null;
  // In manual mode, client stages after 45 only run for cases staff actually sent.
  var manual = CONFIG.SEND_MODE === 'manual';
  if (p.days >= CONFIG.STAGE_CLIENT_3 && !k('CLIENT-90') && (!manual || k('CLIENT-45'))) return 'CLIENT-90';
  if (p.days >= CONFIG.STAGE_AGENT && !k('AGENT-75')) return 'AGENT-75';
  if (p.days >= CONFIG.STAGE_CLIENT_2 && p.days < CONFIG.STAGE_AGENT && !k('CLIENT-60') && (!manual || k('CLIENT-45'))) return 'CLIENT-60';
  if (p.days >= CONFIG.STAGE_CLIENT_1 && p.days < CONFIG.STAGE_CLIENT_2 && !k('CLIENT-45')) return 'CLIENT-45';
  return null;
}

function buildQueue_() {
  var sent = commsIndex_();
  var queue = [];
  getBook_().forEach(function (p) {
    var st = stageDue_(p, sent);
    if (st) queue.push({ stage: st, p: p, sent: sent });
  });
  // Most urgent first: lapse stage, agent stage, then oldest arrears
  queue.sort(function (a, b) {
    var w = { 'CLIENT-90': 0, 'AGENT-75': 1, 'CLIENT-60': 2, 'CLIENT-45': 3 };
    return (w[a.stage] - w[b.stage]) || (b.p.days - a.p.days);
  });
  return queue;
}

function previewQueue() {
  var q = buildQueue_();
  var counts = { 'CLIENT-45': 0, 'CLIENT-60': 0, 'AGENT-75': 0, 'CLIENT-90': 0 };
  q.forEach(function (i) { counts[i.stage]++; });
  var msg = 'Queue today: ' + q.length + ' total — 45-day: ' + counts['CLIENT-45'] +
    ', 60-day: ' + counts['CLIENT-60'] + ', 75-day agent: ' + counts['AGENT-75'] +
    ', 90-day lapse: ' + counts['CLIENT-90'] +
    '. Daily cap: ' + CONFIG.DAILY_SEND_CAP + '.' + (CONFIG.TEST_MODE ? ' [TEST MODE ON]' : '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

// ============================== MAIN RUN ===================================
function dailyAutomation() {
  var queue = buildQueue_();
  var sentCount = 0, skipped = [], results = [];
  var users = usersIndex_();

  var awaitingReview = 0;
  for (var i = 0; i < queue.length && sentCount < CONFIG.DAILY_SEND_CAP; i++) {
    var item = queue[i], p = item.p;
    try {
      if (item.stage === 'CLIENT-45' && CONFIG.SEND_MODE === 'manual') {
        awaitingReview++;   // stays on the staff dashboard until they click Send
        continue;
      }
      if (item.stage === 'AGENT-75') {
        var agentEmail = (users.byAgentName[p.agent] || {}).email;
        if (!agentEmail) { skipped.push('75d ' + p.policy + ' — no email for agent "' + p.agent + '" in App Users'); continue; }
        sendAgentEmail_(p, agentEmail, item.sent);
        logComm_('AGENT-75', p, agentEmail, 'SENT', '');
      } else {
        if (!p.email) { skipped.push(item.stage + ' ' + p.policy + ' — no client email'); continue; }
        if (item.stage === 'CLIENT-45') sendClient45_(p);
        else if (item.stage === 'CLIENT-60') sendClient60_(p, item.sent);
        else sendClient90_(p, item.sent);
        logComm_(item.stage, p, p.email, 'SENT', '');
      }
      sentCount++;
      results.push(item.stage + '  ' + p.policy + '  ' + p.client + '  (' + p.days + 'd)');
    } catch (err) {
      logComm_(item.stage, p, '', 'ERROR', String(err));
      skipped.push(item.stage + ' ' + p.policy + ' — ' + err);
    }
  }
  cacheBust_();
  var nudges = clientReminders_(sentCount);
  sentCount += nudges;
  var reminders = remindPending_(users);
  sendDigest_(queue.length, sentCount, results, skipped, reminders, awaitingReview, nudges);
}

/** Every REMINDER_EVERY_DAYS after the (staff-sent) 45-day letter, nudge the
 *  client again — until they respond, staff mark a response/payment, or the
 *  60-day stage takes over. */
function clientReminders_(alreadySent) {
  var sent = commsIndex_(), count = 0;
  var budget = CONFIG.DAILY_SEND_CAP - alreadySent;
  var answered = {};
  var svSh = ss_().getSheetByName(TABS.SURVEY);
  if (svSh) svSh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[3]) answered[String(r[3])] = true;   // any survey/check-in row = response
  });
  getBook_().forEach(function (p) {
    if (count >= budget) return;
    if (CONFIG.ELIGIBLE_STATUSES.indexOf(p.statusDesc) === -1 || !p.email) return;
    if (p.days < CONFIG.STAGE_CLIENT_1 || p.days >= CONFIG.STAGE_CLIENT_2) return;
    var s45 = sent[p.policy + '|CLIENT-45'];
    if (!s45) return;
    if (answered[p.policy]) return;
    if (sent[p.policy + '|CLIENT-RESPONDED'] || sent[p.policy + '|PAYMENT-RECEIVED']) return;
    if (CONFIG.RESPECT_SEND_FLAG && p.send === 'N') return;
    var lastNudge = sent[p.policy + '|REMIND-CLIENT'];
    var lastTouch = new Date(lastNudge ? lastNudge.when : s45.when);
    var daysSince = (Date.now() - lastTouch.getTime()) / 86400000;
    if (daysSince < CONFIG.REMINDER_EVERY_DAYS) return;
    try {
      sendClientNudge_(p, fmtDate_(new Date(s45.when)));
      logComm_('REMIND-CLIENT', p, p.email, 'SENT', 'No response since 45-day letter');
      count++;
    } catch (e) { logComm_('REMIND-CLIENT', p, p.email, 'ERROR', String(e)); }
  });
  return count;
}

/** Short, warm 3-day nudge referencing the 45-day letter. */
function sendClientNudge_(p, sentDate) {
  var body =
    '<p style="font-size:15px">Dear ' + esc_(titleCase_(firstName_(p.client))) + ',</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.7">Just a gentle nudge on the note we sent you on <b>' + esc_(sentDate) +
    '</b> about policy <b>' + esc_(p.policy) + '</b> (' + esc_(p.plan) + '). We have not heard back yet, and we do not want ' +
    'this to slip while your protection is still fully intact.</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.7">The quick questions take under a minute — one tap tells us exactly how to help:</p>' +
    checkinBlock_(p, 'CLIENT-45') +
    '<p style="font-size:14px;color:#334;line-height:1.7">Already sorted it? Wonderful — reply to this email or tell ' +
    (p.agent ? esc_(titleCase_(p.agent)) : 'your agent') + ' and we will close the loop with our thanks.</p>' +
    '<p style="font-size:14px;color:#334">Warm regards,<br><b>' + esc_(CONFIG.BRANCH_NAME) + '</b></p>';
  sendMail_(p.email, 'A gentle nudge — your Guardian Life policy ' + p.policy, emailShell_(body));
}

/** Daily nudges to agents (form not filled) and managers (form not answered)
 *  until they respond. One reminder per person per day, bundled. */
function remindPending_(users) {
  var sent = commsIndex_(), acts = actionsIndex_(), count = 0;
  var today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
  function remindedToday(key) {
    var rec = sent[key + '|REMIND'];
    return rec && Utilities.formatDate(new Date(rec.when), tz_(), 'yyyy-MM-dd') === today;
  }
  // Agents: AGENT-75 sent, no Conservation Action row yet, still on the book
  var byAgent = {};
  getBook_().forEach(function (p) {
    if (sent[p.policy + '|AGENT-75'] && !acts.byPolicy[p.policy] &&
        CONFIG.ELIGIBLE_STATUSES.indexOf(p.statusDesc) > -1 && p.days <= CONFIG.MAX_DAYS) {
      (byAgent[p.agent] = byAgent[p.agent] || []).push(p);
    }
  });
  Object.keys(byAgent).forEach(function (agent) {
    var u = users.byAgentName[agent];
    if (!u || !u.email || remindedToday('AGT:' + agent)) return;
    var list = byAgent[agent].map(function (p) {
      return '<li><b>' + esc_(titleCase_(p.client)) + '</b> — ' + esc_(p.policy) + ' (' + p.days + ' days)</li>';
    }).join('');
    sendMail_(u.email, 'Reminder: ' + byAgent[agent].length + ' conservation form(s) still outstanding',
      emailShell_('<p style="font-size:14px">Hi ' + esc_(u.name.split(' ')[0]) + ',</p>' +
        '<p style="font-size:14px;color:#334">These clients passed the 75-day mark and are still waiting on your Conservation Action form. This reminder repeats daily until each form is submitted:</p>' +
        '<ul style="font-size:13px;color:#334">' + list + '</ul>' +
        (webUrl_() ? '<p style="text-align:center"><a href="' + webUrl_() + '?page=agent" style="background:' + BRAND.gold + ';color:' + BRAND.navy + ';padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">Open my cases</a></p>' : '')));
    logComm_('REMIND', { policy: 'AGT:' + agent, clientNo: '', client: agent, agent: agent, days: '' }, u.email, 'SENT', byAgent[agent].length + ' pending forms');
    count++;
  });
  // Managers: submissions sitting in Pending Manager
  var byMgr = {};
  acts.rows.forEach(function (a) {
    if (a.status !== 'Pending Manager') return;
    var agentUser = users.byEmail[cleanEmail_(a.agentEmail)];
    var mgr = (agentUser && agentUser.managerEmail) || CONFIG.MANAGER_EMAIL;
    (byMgr[mgr] = byMgr[mgr] || []).push(a);
  });
  Object.keys(byMgr).forEach(function (mgr) {
    if (remindedToday('MGR:' + mgr)) return;
    var list = byMgr[mgr].map(function (a) {
      return '<li><b>' + esc_(titleCase_(String(a.client))) + '</b> — ' + esc_(a.policy) + ' (form ' + esc_(a.id) + ', submitted ' + esc_(fmtDate_(new Date(a.submitted))) + ')</li>';
    }).join('');
    sendMail_(mgr, 'Reminder: ' + byMgr[mgr].length + ' conservation form(s) awaiting your response',
      emailShell_('<p style="font-size:14px;color:#334">These agent submissions are waiting on your review. This reminder repeats daily until each is answered:</p>' +
        '<ul style="font-size:13px;color:#334">' + list + '</ul>' +
        (webUrl_() ? '<p style="text-align:center"><a href="' + webUrl_() + '?page=manager" style="background:' + BRAND.navy + ';color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">Review now</a></p>' : '')));
    logComm_('REMIND', { policy: 'MGR:' + mgr, clientNo: '', client: mgr, agent: '', days: '' }, mgr, 'SENT', byMgr[mgr].length + ' pending reviews');
    count++;
  });
  return count;
}

function sendMail_(to, subject, html) {
  var target = CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : to;
  var subj = (CONFIG.TEST_MODE ? '[TEST → ' + to + '] ' : '') + subject;
  MailApp.sendEmail({
    to: target, subject: subj, htmlBody: html,
    name: CONFIG.BRANCH_NAME, replyTo: CONFIG.REPLY_TO, noReply: false
  });
}

// ============================== EMAIL TEMPLATES ============================
function emailShell_(bodyHtml) {
  return '<div style="background:#f4f6f9;padding:24px 8px;font-family:Segoe UI,Arial,sans-serif">' +
    '<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">' +
    '<div style="background:' + BRAND.navy + ';padding:20px 28px">' +
    '<div style="color:#fff;font-size:18px;font-weight:700">' + esc_(CONFIG.BRANCH_NAME) + '</div>' +
    '<div style="color:' + BRAND.gold + ';font-size:12px;letter-spacing:.08em;text-transform:uppercase">Client Care &amp; Policy Support</div>' +
    '</div><div style="padding:28px">' + bodyHtml + '</div>' +
    '<div style="background:' + BRAND.light + ';padding:16px 28px;font-size:11px;color:#557">' +
    'A Ricky Rampersad Branch client-care initiative. This message is for information and service purposes. ' +
    'It is not a demand for payment and does not alter the terms of your policy. ' +
    'If you have already settled your premium, please disregard this notice with our thanks.</div></div></div>';
}

function historyTable_(policies, highlightPolicy) {
  // Beneficiary column appears as soon as the data tab carries beneficiary info
  var hasBene = policies.some(function (q) { return q.beneficiary; });
  var rows = policies.map(function (q) {
    var hot = highlightPolicy && q.policy === highlightPolicy;
    var td = 'padding:10px 12px;border-bottom:1px solid #eef2f7;' + (hot ? 'background:#fdf1f1;' : '');
    return '<tr>' +
      '<td style="' + td + (hot ? 'border-left:4px solid #b02a2a;font-weight:700;color:#b02a2a' : '') + '">' + esc_(q.policy) + '</td>' +
      '<td style="' + td + '">' + esc_(q.plan) + '</td>' +
      '<td style="' + td + '">' + esc_(q.issue) + '</td>' +
      '<td style="' + td + 'text-align:right">' + money_(q.premium) + '</td>' +
      '<td style="' + td + (hot ? 'color:#b02a2a;font-weight:700' : '') + '">' + esc_(q.paidTo || '—') + '</td>' +
      (hasBene ? '<td style="' + td + '">' + esc_(q.beneficiary ? titleCase_(q.beneficiary) : '—') + '</td>' : '') +
      '<td style="' + td + '">' + esc_(q.statusDesc) + '</td></tr>';
  }).join('');
  return '<table style="border-collapse:collapse;width:100%;font-size:13px;margin:20px 0 6px">' +
    '<tr style="background:' + BRAND.light + '">' +
    '<th style="padding:10px 12px;text-align:left">Policy</th><th style="padding:10px 12px;text-align:left">Plan</th>' +
    '<th style="padding:10px 12px;text-align:left">Issued</th><th style="padding:10px 12px;text-align:right">Premium</th>' +
    '<th style="padding:10px 12px;text-align:left">Paid To</th>' +
    (hasBene ? '<th style="padding:10px 12px;text-align:left">Beneficiary</th>' : '') +
    '<th style="padding:10px 12px;text-align:left">Status</th></tr>' +
    rows + '</table>' +
    (highlightPolicy ? '<div style="font-size:12px;color:#b02a2a;margin:0 0 14px">■ Highlighted in red: the policy that needs your attention.</div>' : '');
}

/** "On record for you" block — address & contact details, so notices never
 *  miss the client. Corrections come back through the check-in. */
function onRecordBlock_(p) {
  if (!p.address && !p.phone && !p.email) return '';
  return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin:18px 0;background:#fbfdff">' +
    '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:13px;margin-bottom:6px">ON RECORD FOR YOU — so a notice never misses you</div>' +
    (p.address ? '<div style="font-size:13px;color:#334;line-height:1.6">🏠 Address: <b>' + esc_(p.address) + '</b></div>' : '') +
    (p.phone ? '<div style="font-size:13px;color:#334;line-height:1.6">📞 Phone: <b>' + esc_(p.phone) + '</b></div>' : '') +
    (p.email ? '<div style="font-size:13px;color:#334;line-height:1.6">✉️ Email: <b>' + esc_(p.email) + '</b></div>' : '') +
    '<div style="font-size:12px;color:#889;margin-top:6px">Moved, changed numbers, new email? Tell us in the quick questions below — it takes one line.</div></div>';
}

/** Payment-method intelligence: what their current Billing type tells us about
 *  WHY the premium stopped, and which fix to lead with. Grounded in
 *  persistency research: automatic methods lapse far less than billed ones;
 *  failed drafts and job changes silently kill auto-payments. */
function payInsight_(p) {
  var b = String(p.billing || '').toLowerCase();
  if (/banker|standing|order/.test(b)) return {
    key: 'bank-order',
    inline: 'Since you pay by <b>' + esc_(p.billing) + '</b>, the most common cause is a standing order that quietly stopped at the bank ' +
      '(a changed account, a card reissue, one short month) — one call to your bank usually restarts it, and we can send the exact form.',
    chips: ['Bank standing order (automatic)', 'Salary deduction', 'Online banking transfer', 'Not sure — talk me through the options']
  };
  if (/salary|payroll|deduction/.test(b)) return {
    key: 'salary',
    inline: 'Since you pay by <b>' + esc_(p.billing) + '</b>, a job or payroll change may have switched your deduction off without telling ' +
      'anyone — one form re-establishes it, or we can chase the payroll side for you.',
    chips: ['Salary deduction', 'Bank standing order (automatic)', 'Online banking transfer', 'Not sure — talk me through the options']
  };
  if (/direct/.test(b)) return {
    key: 'direct-bill',
    inline: 'Since you pay by <b>' + esc_(p.billing) + '</b>, every due date depends on memory — and industry experience is clear that clients ' +
      'on automatic payment keep their policies at far higher rates. Five minutes sets one up, and this email never needs to happen again.',
    chips: ['Bank standing order (automatic)', 'Salary deduction', 'Online banking transfer', 'Keep my current method']
  };
  return {
    key: 'other',
    inline: 'Many clients also switch to a bank standing order or salary deduction so this never needs a reminder again — we can set that up for you.',
    chips: ['Bank standing order (automatic)', 'Salary deduction', 'Online banking transfer', 'Not sure — talk me through the options']
  };
}

/** Tap-to-answer blocks INSIDE the email — email apps strip real dropdowns,
 *  so every option is a button: one tap records the answer immediately and
 *  opens the check-in with it pre-selected and the rest as dropdowns. */
function tapAnswersBlock_(p, stage) {
  var base = webUrl_();
  if (!base) return '';
  var t = tokenForClient_(p.clientNo);
  var link = base + '?page=checkin&t=' + t + '&pol=' + encodeURIComponent(p.policy) + '&stage=' + stage;
  function q(n, text) {
    return '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:14px;margin-top:16px">' + n + ' · ' + text + '</div>';
  }
  function chips(param, opts) {
    return '<div style="margin:8px 0 4px">' + opts.map(function (o) {
      return '<a href="' + link + '&' + param + '=' + encodeURIComponent(o) + '" style="display:inline-block;margin:3px;background:' +
        BRAND.light + ';color:' + BRAND.navy + ';border:1px solid #cfdded;padding:9px 14px;border-radius:20px;' +
        'text-decoration:none;font-weight:600;font-size:12px">' + esc_(o) + '</a>';
    }).join('') + '</div>';
  }
  var ins = payInsight_(p);
  return '<div style="background:#fafbfe;border:1px solid #e2e8f0;border-radius:10px;padding:24px;margin:24px 0">' +
    '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:16px;text-align:center;margin-bottom:4px">Help us get this right — answer right here, one tap per question</div>' +
    '<div style="font-size:13px;color:#556;text-align:center;margin-bottom:8px">Every tap is saved instantly and goes straight to ' +
    (p.agent ? esc_(titleCase_(p.agent)) : 'your agent') + ' and our branch team. Answer one or answer all.</div>' +
    q(1, 'Going forward, how would you prefer to pay?') + chips('pre_pay', ins.chips) +
    q(2, p.beneficiary ? 'Your beneficiary on record is <span style="color:#7a5a10">' + esc_(titleCase_(p.beneficiary)) + '</span> — still right?'
                       : 'Are your beneficiary details up to date?') +
    chips('pre_bene', ['Yes — my beneficiary is current', 'No — please contact me to update it', 'Not sure — please tell me who is on record']) +
    q(3, 'Are your address and contact details still current?') +
    chips('pre_addr', ['All current — nothing to change', 'My address has changed (details below)', 'My phone or email has changed (details below)']) +
    q(4, 'What has made it difficult to keep the premium current?') +
    chips('pre_diff', ['Cash flow is tight right now', 'I forgot / didn\'t get the bill', 'Bank or salary-deduction issue',
                       'I\'m reconsidering whether I need this policy', 'I\'ve already paid — this may be an error']) +
    q(5, 'What would help you most?') +
    chips('pre_help', ['A payment plan to catch up gradually', 'Switching to a different payment schedule (monthly/quarterly)',
                       'A short premium break while I get back on my feet', 'Using my policy\'s own values to keep cover going',
                       'Setting up automatic payments so this doesn\'t recur', 'A call from my agent to talk it through']) +
    q(6, 'Anything you’d like to explore while we’re in touch?') +
    chips('pre_interest', ['Increasing my coverage', 'Updating or changing my beneficiary', 'Protection for my spouse or children',
                           'Health or critical illness cover', 'Education or retirement savings', 'A full financial review with my agent',
                           'Not right now — let\'s just sort this policy']) +
    q(7, 'Best way and time to reach you?') +
    '<div style="font-size:13px;color:#556;margin:6px 0 12px">One line on the next screen — it opens with everything you tapped already saved.</div>' +
    '<div style="text-align:center;margin-top:8px"><a href="' + link + '" style="background:' + BRAND.gold + ';color:' + BRAND.navy +
    ';padding:14px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Finish &amp; send my answers</a></div></div>';
}

/** One clear CTA into the check-in questionnaire (used on the 60-day email;
 *  the 45-day letter uses the richer tap-to-answer block). The questions
 *  themselves are previewed so the client knows exactly what's coming. */
function checkinBlock_(p, stage) {
  var base = webUrl_();
  if (!base) return '';
  var t = tokenForClient_(p.clientNo);
  var link = base + '?page=checkin&t=' + t + '&pol=' + encodeURIComponent(p.policy) + '&stage=' + stage;
  var qs = ['How would you prefer to pay going forward?',
            'Are your beneficiary details up to date?',
            'Are your address and contact details still current?',
            'What has made it difficult to keep the premium current?',
            'What would help you most right now?',
            'Anything you’d like to explore — more coverage, family protection, savings?',
            'When and how should we reach you?'];
  return '<div style="background:#fafbfe;border:1px solid #e2e8f0;border-radius:10px;padding:24px;text-align:center;margin:24px 0">' +
    '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:16px;margin-bottom:6px">Help us get this right — 60 seconds</div>' +
    '<div style="font-size:13px;color:#556;margin-bottom:12px">Seven quick questions, all tap-to-answer:</div>' +
    '<table style="margin:0 auto 16px;text-align:left;font-size:13px;color:#334;line-height:1.9">' +
    qs.map(function (q, i) {
      return '<tr><td style="color:' + BRAND.gold + ';font-weight:700;padding-right:10px;vertical-align:top">' + (i + 1) + '.</td><td>' + esc_(q) + '</td></tr>';
    }).join('') + '</table>' +
    '<a href="' + link + '" style="background:' + BRAND.gold + ';color:' + BRAND.navy + ';padding:14px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Answer the quick questions</a>' +
    '<div style="font-size:12px;color:#889;margin-top:10px">Your answers go straight to your agent and our branch team.</div></div>';
}

/** Soft cross-sell block for the 45-day letter: life changes → review moments.
 *  Marketing by service — every item is answerable inside the check-in. */
function lifeChangesBlock_(p) {
  var items = [
    ['💍', 'Married, or a new addition to the family?', 'A beneficiary update takes minutes — and a growing family often means it’s time to review how much cover they’d have.'],
    ['🏠', 'New home, new job, or bigger responsibilities?', 'Many clients increase their coverage as life grows — often for less than they expect.'],
    ['🛡️', 'Health and critical illness', 'Ask ' + (p.agent ? esc_(titleCase_(p.agent).split(' ')[0]) : 'your agent') + ' about protection that pays you while you recover — not only after.'],
    ['🎓', 'Education & retirement goals', 'The same visit that fixes a premium can start a savings plan for what’s next.']
  ];
  return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:20px 22px;margin:22px 0;background:#fffdf7">' +
    '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:15px;margin-bottom:4px">Life changes. Your protection should keep up.</div>' +
    '<div style="font-size:13px;color:#556;margin-bottom:12px">While we have you — a 2-minute review with ' +
    (p.agent ? esc_(titleCase_(p.agent)) : 'your agent') + ' can cover any of these, in the same conversation:</div>' +
    items.map(function (it) {
      return '<div style="display:flex;gap:10px;margin:9px 0"><div style="font-size:17px">' + it[0] + '</div>' +
        '<div style="font-size:13px;color:#334;line-height:1.6"><b style="color:' + BRAND.navy + '">' + it[1] + '</b><br>' + it[2] + '</div></div>';
    }).join('') +
    '<div style="font-size:12px;color:#889;margin-top:10px">Tick what interests you in the quick questions above — no obligation, ever.</div></div>';
}

/** Gold-highlighted servicing agent chip for client letters. */
function agentChip_(agentName) {
  if (!agentName) return '';
  return '<span style="background:#fdf6e7;border:1px solid #eed9a9;color:#7a5a10;border-radius:14px;padding:2px 12px;font-weight:700;white-space:nowrap">' +
    esc_(titleCase_(agentName)) + '</span>';
}

function portalBlock_(p) {
  var base = webUrl_();
  if (!base) return '';
  var t = tokenForClient_(p.clientNo);
  return '<p style="text-align:center;margin:20px 0"><a href="' + base + '?page=client&t=' + t +
    '" style="background:' + BRAND.blue + ';color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">View my policy portfolio</a></p>';
}

function clientPolicies_(clientNo) {
  return getBook_().filter(function (q) { return q.clientNo === clientNo; });
}

/** 45-day: thank-you + history + interactive check-in (questions stored,
 *  team notified). Tone: appreciation first, zero guilt, concrete options. */
function sendClient45_(p) {
  sendMail_(p.email, esc_(titleCase_(firstName_(p.client))) + ', a quick check-in on your Guardian Life policy ' + p.policy, emailShell_(build45Body_(p)));
}

function build45Body_(p) {
  var all = clientPolicies_(p.clientNo);
  var years = '';
  var m = String(p.issue || '').match(/(\d{4})/);
  if (m) { var y = new Date().getFullYear() - Number(m[1]); if (y >= 2) years = y + ' years'; }
  var body =
    '<p style="font-size:15px">Dear ' + esc_(titleCase_(firstName_(p.client))) + ',</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.7">Some relationships deserve a proper thank-you, and this is one of them. ' +
    (years ? 'For <b>' + esc_(years) + '</b> you' : 'You') + ' have trusted ' +
    (p.agent ? 'your servicing agent, ' + agentChip_(p.agent) + ', and ' : '') +
    'our <b style="color:' + BRAND.navy + '">' + esc_(CONFIG.BRANCH_NAME.split('—')[0].trim()) + '</b> family with something deeply personal — ' +
    'the protection of the people you love. That trust is the foundation of everything we do, and we never take it for granted.</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.7">' +
    (p.agent ? esc_(titleCase_(p.agent).split(' ')[0]) + ' and our' : 'Our') +
    ' branch team review every client’s file personally, and yours came up this week. Before anything else: this is a service note, not a demand — ' +
    'we simply noticed something we don’t want you to lose.</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.7">Here is your policy record with our branch — the one needing attention is marked in red:</p>' +
    historyTable_(all, p.policy) +
    '<div style="background:#fdf1f1;border:1px solid #f3caca;border-left:4px solid #b02a2a;border-radius:8px;padding:14px 16px;margin:18px 0">' +
    '<div style="font-size:14px;color:#7a1f1f;line-height:1.7">Policy <b>' + esc_(p.policy) + '</b> (' + esc_(p.plan) +
    ') is paid to <b>' + esc_(p.paidTo || 'a date now past') + '</b>' +
    (p.billing ? ', currently paid by <b>' + esc_(p.billing) + '</b>' : '') +
    (p.beneficiary ? '. Beneficiary on record: <b>' + esc_(titleCase_(p.beneficiary)) + '</b>' : '') +
    '. Your protection is still fully intact today — this note is about keeping it that way.</div></div>' +
    onRecordBlock_(p) +
    '<p style="font-size:14px;color:#334;line-height:1.7">Life gets busy and payments slip — it happens to many of our best clients. ' +
    'What matters is that the protection and the value you have built stay intact, and right now they still are. ' +
    payInsight_(p).inline + '</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.7"><b>Ways to bring it current:</b> ' + esc_(CONFIG.PAYMENT_INSTRUCTIONS) + '</p>' +
    tapAnswersBlock_(p, 'CLIENT-45') +
    '<p style="font-size:14px;color:#334;line-height:1.7">If money is simply tight right now, say so in the questions above — there are options ' +
    '(catch-up plans, payment mode changes, short premium breaks, using your policy’s own values to hold cover) and we would far rather arrange one than see you lose what you’ve built.</p>' +
    lifeChangesBlock_(p) +
    '<p style="font-size:14px;color:#334;line-height:1.7">Thank you again for choosing ' +
    (p.agent ? esc_(titleCase_(p.agent)) + ' and ' : '') + 'our branch. It is a privilege to stand behind you.</p>' +
    '<p style="font-size:14px;color:#334">With warm appreciation,<br><b>' + esc_(CONFIG.BRANCH_NAME) + '</b>' +
    (p.agent ? '<br><span style="font-size:13px;color:#556">Servicing agent: ' + esc_(titleCase_(p.agent)) + '</span>' : '') + '</p>';
  return body;
}

/** Letter template preview for the review queue — see exactly what the client
 *  would receive before clicking Send. */
function apiPreviewLetter(token, policy) {
  auth_(token, ['staff', 'manager']);
  var p = getBook_().filter(function (q) { return q.policy === String(policy); })[0];
  if (!p) return { ok: false, error: 'Policy not found' };
  return { ok: true, html: emailShell_(build45Body_(p)),
           subject: titleCase_(firstName_(p.client)) + ', a quick check-in on your Guardian Life policy ' + p.policy };
}

/** 60-day: references the 45-day email; mirrors the client's own check-in
 *  answers back to them if they responded, re-invites gently if not. */
function sendClient60_(p, sent) {
  var prev = sent[p.policy + '|CLIENT-45'];
  var prevDate = prev && prev.when ? fmtDate_(new Date(prev.when)) : null;
  var answers = surveyFor_(p.clientNo);
  var last = answers.length ? answers[answers.length - 1] : null;
  var answeredBlock = '';
  if (last && (last.difficulty || last.help || last.payMethod || last.beneficiary)) {
    answeredBlock =
      '<div style="background:#fbfdff;border:1px solid #dbe6f2;border-radius:10px;padding:14px;margin:12px 0">' +
      '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:13px;margin-bottom:4px">You told us:</div>' +
      (last.difficulty ? '<div style="font-size:13px;color:#334">• What made it difficult: <b>' + esc_(last.difficulty) + '</b></div>' : '') +
      (last.help ? '<div style="font-size:13px;color:#334">• What would help most: <b>' + esc_(last.help) + '</b></div>' : '') +
      (last.payMethod ? '<div style="font-size:13px;color:#334">• Preferred way to pay going forward: <b>' + esc_(last.payMethod) + '</b></div>' : '') +
      (last.beneficiary && /yes|not sure/i.test(last.beneficiary) ? '<div style="font-size:13px;color:#334">• Beneficiary details: <b>' + esc_(last.beneficiary) + '</b></div>' : '') +
      '<div style="font-size:13px;color:#334;margin-top:6px">That is exactly what our team is preparing for you — expect contact shortly. ' +
      'If anything has changed since, just reply to this email.</div></div>';
  }
  var body =
    '<p style="font-size:15px">Dear ' + esc_(titleCase_(firstName_(p.client))) + ',</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.6">' +
    (prevDate
      ? 'We wrote to you on <b>' + esc_(prevDate) + '</b> with your policy record and a short check-in, and we promised to stay close — so here we are.'
      : 'We recently reviewed your policy record and wanted to reach out personally.') +
    ' The premium on policy <b>' + esc_(p.policy) + '</b> is still outstanding' +
    (p.paidTo ? ' (paid to <b>' + esc_(p.paidTo) + '</b>)' : '') + '.</p>' +
    answeredBlock +
    (p.lapseDate ? '<p style="font-size:14px;color:#334;line-height:1.6">To be transparent with you: if nothing changes, this policy is projected to lapse around <b>' +
      esc_(p.lapseDate) + '</b>. A lapse pauses your protection, and restarting later usually costs more and can require fresh medical evidence — so acting this month genuinely matters.</p>' : '') +
    '<p style="font-size:14px;color:#334;line-height:1.6">' + esc_(CONFIG.PAYMENT_INSTRUCTIONS) +
    (last ? '' : ' If your circumstances have changed, the 60-second check-in below tells us exactly how to help — catch-up plans, a different payment schedule, a short premium break, or using the policy’s own values to keep cover going.') + '</p>' +
    portalBlock_(p) +
    (last
      ? '<p style="font-size:13px;color:#556">Thank you again for the answers you shared — they have been passed to our branch team and your agent.</p>'
      : checkinBlock_(p, 'CLIENT-60')) +
    '<p style="font-size:14px;color:#334">We’re on your side,<br><b>' + esc_(CONFIG.BRANCH_NAME) + '</b></p>';
  sendMail_(p.email, 'Following up on our ' + (prevDate ? esc_(prevDate) + ' ' : '') + 'note — policy ' + p.policy, emailShell_(body));
}

/** 90-day: lapse stage. References the whole history (emails, the client's own
 *  words, the agent/manager plan) — honest, urgent, still on the client's side. */
function sendClient90_(p, sent) {
  var d45 = sent[p.policy + '|CLIENT-45'], d60 = sent[p.policy + '|CLIENT-60'];
  var answers = surveyFor_(p.clientNo);
  var last = answers.length ? answers[answers.length - 1] : null;
  var act = actionsIndex_().byPolicy[p.policy];
  var historyItems = [];
  if (d45) historyItems.push('our policy review and check-in on <b>' + esc_(fmtDate_(new Date(d45.when))) + '</b>');
  if (d60) historyItems.push('our follow-up on <b>' + esc_(fmtDate_(new Date(d60.when))) + '</b>');
  if (last && (last.difficulty || last.help)) historyItems.push('your reply telling us ' +
    (last.difficulty ? '“' + esc_(last.difficulty) + '”' : 'what would help'));
  if (act && act.status === 'Responded') historyItems.push('the plan your agent and manager prepared for you');
  var planBlock = '';
  if (act) {
    planBlock = '<div style="background:#fbfdff;border:1px solid #dbe6f2;border-radius:10px;padding:14px;margin:12px 0">' +
      '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:13px;margin-bottom:4px">The plan we prepared for you:</div>' +
      '<div style="font-size:13px;color:#334">' + esc_(act.recommended || act.outcome || 'A personal payment arrangement') +
      (act.managerResponse ? ' — approved by branch management: “' + esc_(act.managerResponse) + '”' : '') +
      '</div><div style="font-size:13px;color:#334;margin-top:4px">It is still available — one call activates it.</div></div>';
  }
  var body =
    '<p style="font-size:15px">Dear ' + esc_(titleCase_(firstName_(p.client))) + ',</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.6">This is the note we hoped we would not have to send. Policy <b>' +
    esc_(p.policy) + '</b> (' + esc_(p.plan) + ') has now reached the lapse stage' +
    (p.lapseDate ? ' — projected to lapse around <b>' + esc_(p.lapseDate) + '</b>' : '') + '.</p>' +
    (historyItems.length ? '<p style="font-size:14px;color:#334;line-height:1.6">We have stayed in touch along the way — ' +
      historyItems.join(', ') + ' — because this policy is worth fighting for.</p>' : '') +
    planBlock +
    '<p style="font-size:14px;color:#334;line-height:1.7"><b>What a lapse actually means for you:</b> your protection stops, ' +
    'and reinstating later usually needs the arrears paid plus fresh evidence of good health — cover that costs more, or may not be offered at all. ' +
    'Every year of premiums you have already paid was building something; letting it go now is the most expensive option on the table.</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.7"><b>At this stage the paths are simple, and we will walk any of them with you:</b></p>' +
    '<ul style="font-size:13px;color:#334;line-height:1.8">' +
    '<li><b>Settle the arrears this week</b> — ' + esc_(CONFIG.PAYMENT_INSTRUCTIONS) + '</li>' +
    '<li><b>A structured catch-up arrangement</b> — split the outstanding amount over the coming months, agreed in one call.</li>' +
    '<li><b>A restructure conversation</b> — sometimes a smaller, sustainable premium protects your family better than a lapsed larger one.</li>' +
    '<li><b>If it does lapse</b> — ask us about reinstatement early; the sooner you apply, the simpler and cheaper it tends to be.</li></ul>' +
    portalBlock_(p) +
    '<p style="font-size:14px;color:#334;line-height:1.7">One conversation is all it takes. We are ready when you are.</p>' +
    exitSurveyBlock_(p) +
    '<p style="font-size:14px;color:#334">Still in your corner,<br><b>' + esc_(CONFIG.BRANCH_NAME) + '</b>' +
    (p.agent ? '<br><span style="font-size:13px;color:#556">Servicing agent: ' + esc_(titleCase_(p.agent)) + '</span>' : '') + '</p>';
  sendMail_(p.email, 'Last chance to protect policy ' + p.policy + ' — we can still fix this together', emailShell_(body));
  sendCaseFile90_(p, sent);
}

/** Final-word survey at the lapse stage — captures for the record why the
 *  policy could not be saved and how the client experienced us. */
function exitSurveyBlock_(p) {
  var base = webUrl_();
  if (!base) return '';
  var t = tokenForClient_(p.clientNo);
  var link = base + '?page=exit&t=' + t + '&pol=' + encodeURIComponent(p.policy);
  return '<div style="background:#fafbfe;border:1px solid #e2e8f0;border-radius:10px;padding:22px;text-align:center;margin:22px 0">' +
    '<div style="font-weight:700;color:' + BRAND.navy + ';font-size:15px;margin-bottom:6px">Whatever you decide — help us understand</div>' +
    '<div style="font-size:13px;color:#556;margin-bottom:14px">Two minutes, completely honest. If we could not save this policy, we want to know why, ' +
    'what we should have done differently, and whether you would want us to reach out when the time is right again. It goes on your file and it makes us better.</div>' +
    '<a href="' + link + '" style="background:' + BRAND.navy + ';color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Share your final word</a></div>';
}

/** Internal case file at day 90 — the complete record of how we assisted this
 *  client, for the branch head, admin/sales support and Conservation. */
function sendCaseFile90_(p, sent) {
  var events = historyFor_(p.clientNo);
  var rows = events.events.map(function (ev) {
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid #eef;white-space:nowrap;vertical-align:top">' + esc_(ev.when) + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eef;vertical-align:top"><b>' + esc_(ev.title) + '</b>' +
      (ev.detail ? '<br><span style="color:#556">' + esc_(ev.detail) + '</span>' : '') + '</td></tr>';
  }).join('');
  var to = [CONFIG.OPS_EMAIL, CONFIG.SALES_SUPPORT_EMAIL, CONFIG.CONSERVATION_EMAIL]
    .filter(function (e, i, arr) { return e && arr.indexOf(e) === i; }).join(',');
  MailApp.sendEmail({
    to: CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : to,
    subject: (CONFIG.TEST_MODE ? '[TEST] ' : '') + 'CASE FILE (90-day) — ' + titleCase_(p.client) + ', policy ' + p.policy + ' — full assistance record',
    htmlBody: emailShell_(
      '<p style="font-size:14px"><b>' + esc_(titleCase_(p.client)) + '</b> (client #' + esc_(p.clientNo) + ', agent ' + esc_(p.agent) +
      ') has reached the 90-day lapse stage on policy <b>' + esc_(p.policy) + '</b>. For the record — this is everything we did, ' +
      'in the client’s and the agent’s own words:</p>' +
      '<table style="border-collapse:collapse;width:100%;font-size:12px;margin:12px 0">' + rows + '</table>' +
      '<p style="font-size:13px;color:#556">Filed automatically for admin, sales support and Conservation. The same timeline is searchable in the portal under History.</p>'),
    name: 'Branch Automation'
  });
  logComm_('CASE-90', p, to, 'SENT', 'Internal case file');
}

/** 75-day: to the servicing agent — full context pack: both client emails,
 *  the client's own check-in answers, and the fact find with ratios. */
function sendAgentEmail_(p, agentEmail, sent) {
  var s45 = sent[p.policy + '|CLIENT-45'], s60 = sent[p.policy + '|CLIENT-60'];
  var surveys = surveyFor_(p.clientNo);
  var surveyHtml = surveys.length
    ? surveys.map(function (s) {
        return '<li>Responded ' + esc_(fmtDate_(new Date(s.when))) +
          (s.difficulty ? ' · difficulty: <b>' + esc_(s.difficulty) + '</b>' : '') +
          (s.help ? ' · wants: <b>' + esc_(s.help) + '</b>' : '') +
          (s.payMethod ? ' · pay by: <b>' + esc_(s.payMethod) + '</b>' : '') +
          (s.beneficiary ? ' · beneficiary: <b>' + esc_(s.beneficiary) + '</b>' : '') +
          (s.interest && !/not right now/i.test(s.interest) ? ' · <b style="color:#1a7f43">★ interested in: ' + esc_(s.interest) + '</b>' : '') +
          (s.contactUpdate && !/current/i.test(s.contactUpdate) ? ' · <b style="color:#b02a2a">⚠ contact update: ' + esc_(s.contactUpdate) + '</b>' : '') +
          (s.bestContact ? ' · reach them: <b>' + esc_(s.bestContact) + '</b>' : '') +
          (s.comment ? ' — “' + esc_(s.comment) + '”' : '') + '</li>';
      }).join('')
    : '<li>No check-in response yet — you are going in without their side of the story, so lead by listening.</li>';
  var base = webUrl_();
  var body =
    '<p style="font-size:15px">Hi ' + esc_(firstName_(agentEmail.split('@')[0])) + ',</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.6"><b>' + esc_(titleCase_(p.client)) + '</b> (client #' + esc_(p.clientNo) +
    ') is now <b>' + p.days + ' days</b> in arrears on policy <b>' + esc_(p.policy) + '</b> (' + esc_(p.plan) +
    ', premium ' + money_(p.premium) + ', paid to ' + esc_(p.paidTo || '—') +
    (p.lapseDate ? ', projected lapse ' + esc_(p.lapseDate) : '') + '). This case is now yours to conserve.</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.6"><b>What the branch has already done:</b></p><ul style="font-size:13px;color:#334">' +
    '<li>45-day client care email ' + (s45 ? 'sent <b>' + esc_(fmtDate_(new Date(s45.when))) + '</b> (policy history + check-in questions)' : '<b>not sent</b> (no valid email on file)') + '</li>' +
    '<li>60-day follow-up ' + (s60 ? 'sent <b>' + esc_(fmtDate_(new Date(s60.when))) + '</b> (referenced the 45-day note' + (surveys.length ? ' and their answers' : '') + ')' : 'not sent yet') + '</li>' +
    '<li>Client phone: <b>' + esc_(p.phone || 'not on file') + '</b> · email: <b>' + esc_(p.email || 'not on file') + '</b></li></ul>' +
    '<p style="font-size:14px;color:#334;line-height:1.6"><b>In the client’s own words (check-in answers):</b></p><ul style="font-size:13px;color:#334">' + surveyHtml + '</ul>' +
    clientIntelHtml_(p) +
    '<p style="font-size:14px;color:#334;line-height:1.6">Use the portfolio picture above when you call: an only-policy client losing their cover means losing the client; ' +
    'a household with other policies slipping needs one conversation that rescues all of them; a client who has lapsed before needs the payment method fixed for good, not just this premium collected. ' +
    'And every save is a doorway — the flags above tell you what to open next.</p>' +
    '<p style="font-size:14px;color:#334;line-height:1.6">Then complete the <b>Conservation Action form</b> — it asks why this policy reached 75 days and what you recommend. ' +
    'Your submission goes to your direct manager (copy to the branch head, sales support and the Conservation Department) and <b>you will get a daily reminder until it is submitted</b>. This replaces OTForms.</p>' +
    (base ? '<p style="text-align:center;margin:20px 0"><a href="' + base + '?page=agent" style="background:' + BRAND.gold +
      ';color:' + BRAND.navy + ';padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">Open Conservation Action form</a></p>' : '') +
    '<p style="font-size:14px;color:#334">Thanks,<br><b>' + esc_(CONFIG.BRANCH_NAME) + '</b></p>';
  sendMail_(agentEmail, 'ACTION (75-day): ' + titleCase_(p.client) + ' — policy ' + p.policy + ' conservation', emailShell_(body));
}

function sendDigest_(queued, sentCount, results, skipped, reminders, awaitingReview, nudges) {
  var body =
    '<p style="font-size:14px">Daily automation run — ' + fmtDate_(new Date()) + (CONFIG.TEST_MODE ? ' <b style="color:#c00">[TEST MODE]</b>' : '') + '</p>' +
    '<ul style="font-size:13px"><li>In queue: <b>' + queued + '</b></li>' +
    (CONFIG.SEND_MODE === 'manual' ? '<li><b style="color:#9a6205">' + (awaitingReview || 0) +
      ' × 45-day letters awaiting STAFF REVIEW &amp; SEND</b> on the dashboard</li>' : '') +
    '<li>Sent this run: <b>' + sentCount + '</b> (cap ' + CONFIG.DAILY_SEND_CAP + ')' +
    (nudges ? ' — incl. <b>' + nudges + '</b> 3-day client nudges' : '') + '</li>' +
    '<li>Reminders to agents/managers: <b>' + (reminders || 0) +
    '</b></li><li>Skipped: <b>' + skipped.length + '</b></li></ul>' +
    (results.length ? '<p style="font-size:13px"><b>Sent:</b><br>' + results.map(esc_).join('<br>') + '</p>' : '') +
    (skipped.length ? '<p style="font-size:13px;color:#a33"><b>Skipped / needs attention:</b><br>' + skipped.slice(0, 40).map(esc_).join('<br>') + '</p>' : '');
  MailApp.sendEmail({
    to: CONFIG.OPS_EMAIL, subject: '[Branch Automation] ' + sentCount + ' sent, ' + skipped.length + ' skipped — ' + fmtDate_(new Date()),
    htmlBody: emailShell_(body), name: 'Branch Automation'
  });
}

// ============================== SURVEYS ====================================
function surveyFor_(clientNo) {
  var sh = ss_().getSheetByName(TABS.SURVEY);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1)
    .filter(function (r) { return String(r[1]) === String(clientNo); })
    .map(function (r) {
      return { when: r[0], policy: r[3], stage: r[4], rating: r[5], comment: r[6],
               difficulty: String(r[7] || ''), help: String(r[8] || ''), bestContact: String(r[9] || ''),
               payMethod: String(r[11] || ''), beneficiary: String(r[12] || ''), interest: String(r[13] || ''),
               contactUpdate: String(r[14] || '') };
    });
}

// ============================== HISTORY ENGINE =============================
/** Every touchpoint for a client, newest first — emails, check-ins, agent
 *  forms, manager decisions, plan feedback, requirements notes, requests. */
function historyFor_(clientNo) {
  var policies = clientPolicies_(clientNo);
  var pols = {};
  policies.forEach(function (q) { pols[q.policy] = true; });
  var ev = [];
  function push(when, title, detail) {
    if (!when) return;
    var d = (when instanceof Date) ? when : new Date(when);
    if (isNaN(d)) return;
    ev.push({ ts: d.getTime(), when: fmtDate_(d), title: title, detail: detail || '' });
  }
  var STAGE_LABEL = {
    'CLIENT-45': '45-day client care email sent', 'CLIENT-60': '60-day follow-up sent',
    'AGENT-75': '75-day case handed to agent', 'CLIENT-90': '90-day lapse-stage email sent',
    'PLAN-COPY': 'Plan copy sent to client', 'CASE-90': 'Case file sent to admin', 'REMIND': 'Reminder sent',
    'REMIND-CLIENT': '3-day client nudge sent', 'CLIENT-RESPONDED': '✓ Response received (marked by staff)',
    'PAYMENT-RECEIVED': '💰 Payment received (marked by staff — sequence halted)',
    'DEMO-CLIENT-45': '[DEMO] 45-day letter rehearsal', 'DEMO-CLIENT-60': '[DEMO] 60-day follow-up rehearsal',
    'DEMO-AGENT-75': '[DEMO] 75-day agent briefing rehearsal', 'DEMO-CASE-90': '[DEMO] case file rehearsal'
  };
  var logSh = ss_().getSheetByName(TABS.LOG);
  if (logSh) logSh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (!pols[String(r[2])]) return;
    push(r[0], (STAGE_LABEL[r[1]] || r[1]) + ' — ' + r[2], 'To ' + r[5] + (r[8] !== 'SENT' ? ' · ' + r[8] : '') + (r[9] ? ' · ' + r[9] : ''));
  });
  surveyFor_(clientNo).forEach(function (s) {
    var bits = [];
    if (s.rating) bits.push('rating ' + s.rating + '/5');
    if (s.difficulty) bits.push('difficulty: ' + s.difficulty);
    if (s.help) bits.push('wants: ' + s.help);
    if (s.payMethod) bits.push('pay by: ' + s.payMethod);
    if (s.beneficiary) bits.push('beneficiary: ' + s.beneficiary);
    if (s.interest) bits.push('interested in: ' + s.interest);
    if (s.contactUpdate) bits.push('contact/address: ' + s.contactUpdate);
    if (s.bestContact) bits.push('reach: ' + s.bestContact);
    if (s.comment) bits.push('“' + s.comment + '”');
    var label = s.stage === 'MANAGER-75' ? 'Manager comments (on record)'
              : s.stage === 'PLAN-FEEDBACK' ? 'Client feedback on the plan'
              : s.stage === 'EXIT-90' ? 'Client final-word survey'
              : 'Client check-in answered (' + s.stage + ')';
    push(s.when, label + (s.policy ? ' — ' + s.policy : ''), bits.join(' · '));
  });
  actionsIndex_().rows.forEach(function (a) {
    if (!pols[a.policy]) return;
    push(a.submitted, 'Agent conservation form ' + a.id + ' — ' + a.policy,
      'By ' + a.agentEmail + ' · contacted: ' + a.contacted + ' (' + a.method + ') · root cause: ' + (a.rootCause || '—') +
      ' · fact find explains: ' + (a.ffExplains || '—') + (a.whatChanged ? ' · changed: ' + a.whatChanged : '') +
      ' · outcome: ' + a.outcome + ' · intention: ' + a.intention + ' · recommends: ' + (a.recommended || '—') +
      (a.notes ? ' · notes: “' + a.notes + '”' : ''));
    if (a.status === 'Responded') {
      push(a.submitted, 'Manager decision on ' + a.id,
        (a.mgrDecision || 'Responded') + (a.mgrApprovals ? ' · approved: ' + a.mgrApprovals : '') +
        (a.managerResponse ? ' · “' + a.managerResponse + '”' : ''));
    }
  });
  var reqSh = ss_().getSheetByName(TABS.REQLOG);
  if (reqSh) reqSh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (!pols[String(r[1])]) return;
    push(r[0], 'Requirements note — ' + r[1], (r[5] ? 'By ' + r[5] + ': ' : '') + (r[6] || '') + (r[7] ? ' [' + r[7] + ']' : ''));
  });
  var rqSh = ss_().getSheetByName(TABS.REQUESTS);
  if (rqSh) rqSh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (String(r[1]) !== String(clientNo)) return;
    push(r[0], 'Client portal request: ' + r[3], r[4]);
  });
  ev.sort(function (a, b) { return b.ts - a.ts; });
  return {
    clientNo: clientNo,
    client: policies.length ? titleCase_(policies[0].client) : '',
    agent: policies.length ? policies[0].agent : '',
    policies: policies.map(function (q) {
      return { policy: q.policy, plan: q.plan, days: q.days, statusDesc: q.statusDesc, premium: money_(q.premium), paidTo: q.paidTo };
    }),
    events: ev
  };
}

/** Portal search: policy #, client # or name → full timeline. Agents see
 *  their own clients only; staff and managers see everything. */
function apiHistory(token, query) {
  var u = auth_(token, ['agent', 'staff', 'manager']);
  var q = String(query || '').trim().toLowerCase();
  if (q.length < 3) return { ok: false, error: 'Type at least 3 characters — policy number, client number or name.' };
  var seen = {}, matches = [];
  getBook_().forEach(function (p) {
    if (u.role === 'agent' && p.agent !== u.agentName) return;
    if (seen[p.clientNo]) return;
    if (p.policy.toLowerCase().indexOf(q) > -1 || p.clientNo.toLowerCase().indexOf(q) > -1 ||
        p.client.toLowerCase().indexOf(q) > -1) {
      seen[p.clientNo] = true;
      matches.push({ clientNo: p.clientNo, client: titleCase_(p.client), agent: p.agent });
    }
  });
  if (!matches.length) return { ok: false, error: 'No match' + (u.role === 'agent' ? ' on your book' : '') + ' for “' + query + '”.' };
  if (matches.length > 8) return { ok: true, matches: matches.slice(0, 25) };
  if (matches.length > 1) return { ok: true, matches: matches };
  return { ok: true, history: historyFor_(matches[0].clientNo) };
}

function apiHistoryByClient(token, clientNo) {
  var u = auth_(token, ['agent', 'staff', 'manager']);
  var h = historyFor_(String(clientNo));
  if (u.role === 'agent' && h.agent !== u.agentName) return { ok: false, error: 'Not your client.' };
  return { ok: true, history: h };
}

/** Exit survey (90-day) — the client's final word, filed and pushed to admin. */
function apiExitSurvey(token, policy, answers) {
  var clientNo = clientNoForToken_(token);
  if (!clientNo) return { ok: false };
  answers = answers || {};
  var book = clientPolicies_(clientNo);
  var name = book.length ? book[0].client : '';
  ss_().getSheetByName(TABS.SURVEY).appendRow([
    new Date(), clientNo, name, policy, 'EXIT-90', answers.rating || '',
    String(answers.comment || '').slice(0, 2000), String(answers.reason || ''), String(answers.doDifferently || ''),
    String(answers.bestContact || '').slice(0, 300), 'exit-90', '', '', String(answers.futureContact || '')
  ]);
  var p = book.filter(function (q) { return q.policy === String(policy); })[0] || book[0] || {};
  var agentUser = usersIndex_().byAgentName[p.agent];
  var to = [CONFIG.OPS_EMAIL, CONFIG.CONSERVATION_EMAIL, agentUser && agentUser.email]
    .filter(function (e, i, arr) { return e && arr.indexOf(e) === i; }).join(',');
  MailApp.sendEmail({
    to: CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : to,
    subject: (CONFIG.TEST_MODE ? '[TEST] ' : '') + 'Final-word survey — ' + titleCase_(name) + ' (' + policy + ', 90-day)',
    htmlBody: emailShell_('<p style="font-size:14px"><b>' + esc_(titleCase_(name)) + '</b> (client #' + esc_(clientNo) +
      ') completed the final-word survey for policy <b>' + esc_(policy) + '</b>:</p>' +
      '<ul style="font-size:13px;color:#334">' +
      (answers.reason ? '<li>Main reason we could not save it: <b>' + esc_(answers.reason) + '</b></li>' : '') +
      (answers.doDifferently ? '<li>What we should have done differently: <b>' + esc_(answers.doDifferently) + '</b></li>' : '') +
      (answers.futureContact ? '<li>Reach out in future: <b>' + esc_(answers.futureContact) + '</b></li>' : '') +
      (answers.rating ? '<li>How our team treated them: <b>' + esc_(answers.rating) + '/5</b></li>' : '') +
      (answers.bestContact ? '<li>Best contact: <b>' + esc_(answers.bestContact) + '</b></li>' : '') +
      (answers.comment ? '<li>“' + esc_(answers.comment) + '”</li>' : '') + '</ul>' +
      '<p style="font-size:13px;color:#556">Filed on the client record — visible in the portal History timeline.</p>'),
    name: 'Branch Automation'
  });
  return { ok: true };
}

// ============================== TOKENS & USERS =============================
function tokenForClient_(clientNo) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('tok:' + clientNo);
  if (hit) return hit;
  var sh = ss_().getSheetByName(TABS.TOKENS);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(clientNo)) { cache.put('tok:' + clientNo, vals[i][1], 21600); return vals[i][1]; }
  }
  var tok = Utilities.getUuid().replace(/-/g, '');
  sh.appendRow([clientNo, tok, new Date()]);
  cache.put('tok:' + clientNo, tok, 21600);
  return tok;
}
function clientNoForToken_(token) {
  var vals = ss_().getSheetByName(TABS.TOKENS).getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) if (vals[i][1] === token) return String(vals[i][0]);
  return null;
}

function usersIndex_() {
  var sh = ss_().getSheetByName(TABS.USERS);
  var byEmail = {}, byAgentName = {}, byToken = {}, byName = {};
  if (sh) {
    sh.getDataRange().getValues().slice(1).forEach(function (r, i) {
      var u = { row: i + 2, email: cleanEmail_(r[0]), name: String(r[1]).trim(), role: String(r[2]).trim().toLowerCase(),
                agentName: String(r[3]).trim(), code: String(r[4]).trim(),
                managerEmail: cleanEmail_(r[5]), token: String(r[6]).trim() };
      if (u.email) byEmail[u.email] = u;
      if (u.agentName && u.email) byAgentName[u.agentName] = u;
      if (u.token) byToken[u.token] = u;
      if (u.name && (u.role === 'staff' || u.role === 'manager')) byName[u.name.toLowerCase()] = u;
    });
  }
  return { byEmail: byEmail, byAgentName: byAgentName, byToken: byToken, byName: byName };
}

/** Sign in by team name (dropdown) OR email — both check the access code. */
function apiLogin(identifier, code) {
  var idx = usersIndex_();
  var id = String(identifier || '').trim();
  var u = idx.byEmail[cleanEmail_(id)] || idx.byName[id.toLowerCase()];
  if (!u || !u.code || u.code.toUpperCase() !== String(code).trim().toUpperCase()) {
    return { ok: false, error: 'Name/email or access code not recognised. Ask the branch to check the App Users tab.' };
  }
  var token = Utilities.getUuid().replace(/-/g, '');
  ss_().getSheetByName(TABS.USERS).getRange(u.row, 7).setValue(token);
  return { ok: true, token: token, role: u.role, name: u.name };
}
function auth_(token, roles) {
  var u = usersIndex_().byToken[String(token || '').trim()];
  if (!u) throw new Error('Session expired — please log in again.');
  if (roles && roles.indexOf(u.role) === -1 && u.role !== 'manager') throw new Error('Not authorised for this area.');
  return u;
}

// ============================== WEB APP ====================================
function webUrl_() {
  if (CONFIG.WEBAPP_URL) return CONFIG.WEBAPP_URL;
  var stored = PropertiesService.getScriptProperties().getProperty('WEBAPP_URL');
  if (stored) return stored;
  try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; }
}

function doGet(e) {
  try { PropertiesService.getScriptProperties().setProperty('WEBAPP_URL', ScriptApp.getService().getUrl()); } catch (err) {}
  var page = (e && e.parameter && e.parameter.page) || 'home';
  var t = HtmlService.createTemplateFromFile('App');
  t.page = page;
  t.params = e.parameter || {};
  t.brand = BRAND;
  t.branchName = CONFIG.BRANCH_NAME;
  t.teamList = apiLoginList().team;   // login dropdown rendered server-side — no loading state

  // Server-rendered pieces
  t.checkin = null;
  t.clientData = null;
  t.feedbackValid = false;
  t.exitValid = false;
  if (page === 'checkin') t.checkin = checkinData_(e.parameter);
  if (page === 'client') t.clientData = clientPortalData_(e.parameter.t);
  if (page === 'feedback') t.feedbackValid = !!clientNoForToken_(e.parameter.t || '');
  if (page === 'exit') t.exitValid = !!clientNoForToken_(e.parameter.t || '');

  return t.evaluate().setTitle('Branch Portal — ' + CONFIG.BRANCH_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Server data for the check-in page: validates the token and pulls the
 *  client's current payment method from the data tab for prefill. */
function checkinData_(params) {
  var clientNo = clientNoForToken_(params.t || '');
  if (!clientNo) return null;
  var book = clientPolicies_(clientNo);
  if (!book.length) return null;
  var p = book.filter(function (q) { return q.policy === String(params.pol); })[0] || book[0];
  var stage = params.stage || 'CLIENT-45';
  // A tap-chip in the email carries one answer — save it THE MOMENT they land.
  // Successive taps from the email accumulate onto the same row, so a client
  // can answer question by question without ever pressing a submit button.
  var pre = {
    pay: String(params.pre_pay || '').slice(0, 120),
    bene: String(params.pre_bene || '').slice(0, 120),
    addr: String(params.pre_addr || '').slice(0, 120),
    diff: String(params.pre_diff || '').slice(0, 120),
    help: String(params.pre_help || '').slice(0, 120),
    interest: String(params.pre_interest || '').slice(0, 120)
  };
  var saved = recordTap_(clientNo, p, stage, pre);
  return {
    token: params.t, policy: p.policy, stage: stage,
    firstName: titleCase_(firstName_(p.client)), plan: p.plan,
    billing: p.billing || 'Not on record', paidTo: p.paidTo || '',
    beneficiary: p.beneficiary ? titleCase_(p.beneficiary) : '',
    address: p.address || '', phone: p.phone || '',
    pre: saved, prePay: saved.pay, preBene: saved.bene
  };
}

/** Merges tapped answers into the client's check-in row (col map below) and
 *  returns the ACCUMULATED answers so the page pre-fills everything so far. */
function recordTap_(clientNo, p, stage, pre) {
  var COLS = { diff: 8, help: 9, pay: 12, bene: 13, interest: 14, addr: 15 };
  var acc = { pay: pre.pay, bene: pre.bene, addr: pre.addr, diff: pre.diff, help: pre.help, interest: pre.interest };
  var any = Object.keys(pre).some(function (k) { return pre[k]; });
  try {
    var sh = ss_().getSheetByName(TABS.SURVEY);
    var vals = sh.getDataRange().getValues();
    for (var i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][1]) === clientNo && String(vals[i][3]) === String(p.policy) && vals[i][4] === stage) {
        Object.keys(COLS).forEach(function (k) {
          if (pre[k]) sh.getRange(i + 1, COLS[k]).setValue(pre[k]);
          else acc[k] = String(vals[i][COLS[k] - 1] || '');
        });
        if (any && !vals[i][10]) sh.getRange(i + 1, 11).setValue('email-tap');
        return acc;
      }
    }
    if (any) sh.appendRow([new Date(), clientNo, p.client, p.policy, stage, '', '', pre.diff, pre.help, '', 'email-tap', pre.pay, pre.bene, pre.interest, pre.addr]);
  } catch (e) { Logger.log('tap record failed: ' + e); }
  return acc;
}

/** Client check-in (45/60-day): structured answers stored with the rating,
 *  and the team + agent notified immediately. */
function apiCheckin(token, policy, stage, answers) {
  var clientNo = clientNoForToken_(token);
  if (!clientNo) return { ok: false };
  answers = answers || {};
  var sh = ss_().getSheetByName(TABS.SURVEY);
  var vals = sh.getDataRange().getValues();
  var rowIx = -1;
  for (var i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][1]) === clientNo && String(vals[i][3]) === String(policy) && vals[i][4] === stage) { rowIx = i + 1; break; }
  }
  var book = clientPolicies_(clientNo);
  var name = book.length ? book[0].client : '';
  var contactUpd = String(answers.addressStatus || '') +
                   (answers.addressUpdate ? ' — ' + String(answers.addressUpdate).slice(0, 500) : '');
  var payload = [String(answers.comment || '').slice(0, 2000), String(answers.difficulty || ''),
                 String(answers.help || ''), String(answers.bestContact || '').slice(0, 300), 'check-in',
                 String(answers.payMethod || ''), String(answers.beneficiary || ''), String(answers.interest || ''),
                 contactUpd];
  if (rowIx > -1) sh.getRange(rowIx, 7, 1, 9).setValues([payload]);
  else sh.appendRow([new Date(), clientNo, name, policy, stage, answers.rating || '',
                     payload[0], payload[1], payload[2], payload[3], payload[4], payload[5], payload[6], payload[7], payload[8]]);
  // Trigger the response back to the team + servicing agent
  var p = book.filter(function (q) { return q.policy === String(policy); })[0] || book[0] || {};
  var agentUser = usersIndex_().byAgentName[p.agent];
  var to = CONFIG.OPS_EMAIL + (agentUser && agentUser.email ? ',' + agentUser.email : '');
  MailApp.sendEmail({
    to: CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : to,
    subject: (CONFIG.TEST_MODE ? '[TEST] ' : '') + 'Client check-in answered — ' + titleCase_(name) + ' (' + policy + ', ' + stage + ')',
    htmlBody: emailShell_('<p style="font-size:14px"><b>' + esc_(titleCase_(name)) + '</b> (client #' + esc_(clientNo) +
      ') answered the ' + esc_(stage) + ' check-in for policy <b>' + esc_(policy) + '</b>:</p>' +
      '<ul style="font-size:13px;color:#334">' +
      (answers.difficulty ? '<li>What made it difficult: <b>' + esc_(answers.difficulty) + '</b></li>' : '') +
      (answers.help ? '<li>What would help most: <b>' + esc_(answers.help) + '</b></li>' : '') +
      (answers.payMethod ? '<li>Preferred payment method going forward: <b>' + esc_(answers.payMethod) + '</b></li>' : '') +
      (answers.beneficiary ? '<li>Beneficiary details: <b>' + esc_(answers.beneficiary) + '</b></li>' : '') +
      (answers.interest && !/not right now/i.test(answers.interest)
        ? '<li style="color:#1a7f43">★ CROSS-SELL LEAD — interested in: <b>' + esc_(answers.interest) + '</b></li>' : '') +
      (answers.addressStatus && !/current/i.test(answers.addressStatus)
        ? '<li style="color:#b02a2a">⚠ CONTACT UPDATE NEEDED: <b>' + esc_(answers.addressStatus) +
          (answers.addressUpdate ? ' — ' + esc_(answers.addressUpdate) : '') + '</b></li>' : '') +
      (answers.bestContact ? '<li>Best way to reach: <b>' + esc_(answers.bestContact) + '</b></li>' : '') +
      (answers.comment ? '<li>Comment: “' + esc_(answers.comment) + '”</li>' : '') + '</ul>' +
      '<p style="font-size:13px;color:#556">Act on this while it is warm — clients who answer are asking to be saved' +
      (answers.interest && !/not right now/i.test(answers.interest) ? ', and this one raised a hand for more' : '') + '.</p>'),
    name: 'Branch Automation'
  });
  return { ok: true };
}

function clientPortalData_(token) {
  var clientNo = clientNoForToken_(token || '');
  if (!clientNo) return null;
  var policies = clientPolicies_(clientNo);
  if (!policies.length) return null;
  var sent = commsIndex_();
  var comms = [];
  Object.keys(sent).forEach(function (k) {
    var parts = k.split('|');
    if (policies.some(function (p) { return p.policy === parts[0]; })) {
      comms.push({ policy: parts[0], stage: parts[1], when: fmtDate_(new Date(sent[k].when)) });
    }
  });
  return {
    clientNo: clientNo, name: titleCase_(policies[0].client), agent: policies[0].agent,
    token: token, policies: policies, comms: comms, surveys: surveyFor_(clientNo)
  };
}

function apiClientRequest(token, type, details) {
  var clientNo = clientNoForToken_(token);
  if (!clientNo) return { ok: false };
  var book = clientPolicies_(clientNo);
  var name = book.length ? book[0].client : '';
  ss_().getSheetByName(TABS.REQUESTS).appendRow([new Date(), clientNo, name, type, String(details || '').slice(0, 2000), '']);
  MailApp.sendEmail({
    to: CONFIG.OPS_EMAIL, subject: '[Client Portal] ' + type + ' — ' + titleCase_(name) + ' (#' + clientNo + ')',
    htmlBody: emailShell_('<p style="font-size:14px"><b>' + esc_(titleCase_(name)) + '</b> (client #' + esc_(clientNo) +
      ') submitted a <b>' + esc_(type) + '</b> request via the portal:</p><p style="font-size:14px;background:' +
      BRAND.light + ';padding:12px;border-radius:8px">' + esc_(details || '(no details)') + '</p>'),
    name: 'Branch Portal'
  });
  return { ok: true };
}

// ---- Agent area ----
function apiAgentQueue(token) {
  var u = auth_(token, ['agent']);
  var sent = commsIndex_();
  var actions = actionsIndex_();
  var mine = getBook_().filter(function (p) {
    return p.agent === u.agentName && CONFIG.ELIGIBLE_STATUSES.indexOf(p.statusDesc) > -1 &&
      p.days >= CONFIG.STAGE_CLIENT_1 && p.days <= CONFIG.MAX_DAYS;
  });
  return {
    ok: true, name: u.name,
    cases: mine.map(function (p) {
      var a = actions.byPolicy[p.policy];
      return {
        policy: p.policy, clientNo: p.clientNo, client: titleCase_(p.client), plan: p.plan,
        premium: money_(p.premium), days: p.days, phone: p.phone, email: p.email,
        paidTo: p.paidTo, lapseDate: p.lapseDate,
        sent45: !!sent[p.policy + '|CLIENT-45'], sent60: !!sent[p.policy + '|CLIENT-60'],
        sent75: !!sent[p.policy + '|AGENT-75'], sent90: !!sent[p.policy + '|CLIENT-90'],
        surveys: surveyFor_(p.clientNo).map(function (s) {
          return { rating: s.rating, comment: s.comment, difficulty: s.difficulty, help: s.help,
                   bestContact: s.bestContact, payMethod: s.payMethod, beneficiary: s.beneficiary,
                   interest: s.interest, stage: s.stage };
        }),
        intel: (function (pi) {
          return { active: pi.active, totalPremium: money_(pi.totalPremium), tenure: pi.tenure,
                   flags: pi.flags.map(function (f) { return f.label; }) };
        })(portfolioIntel_(p)),
        action: a ? { status: a.status, outcome: a.outcome, managerResponse: a.managerResponse, mgrApprovals: a.mgrApprovals, mgrDecision: a.mgrDecision } : null
      };
    }).sort(function (a, b) { return b.days - a.days; })
  };
}

function actionsIndex_() {
  var sh = ss_().getSheetByName(TABS.ACTIONS);
  var byPolicy = {}, rows = [];
  if (sh) {
    sh.getDataRange().getValues().slice(1).forEach(function (r, i) {
      var a = { row: i + 2, id: r[0], submitted: r[1], policy: String(r[2]), clientNo: String(r[3]), client: r[4],
                agentEmail: r[5], contacted: r[6], method: r[7], outcome: r[8], intention: r[9],
                followUp: r[10], notes: r[11], status: r[12], managerResponse: r[13],
                rootCause: String(r[16] || ''), ffExplains: String(r[17] || ''), whatChanged: String(r[18] || ''),
                confidence: String(r[19] || ''), recommended: String(r[20] || ''),
                mgrApprovals: String(r[21] || ''), mgrDecision: String(r[22] || '') };
      byPolicy[a.policy] = a; rows.push(a);
    });
  }
  return { byPolicy: byPolicy, rows: rows };
}

function apiSubmitConservation(token, form) {
  var u = auth_(token, ['agent']);
  var id = 'CA-' + Utilities.formatDate(new Date(), tz_(), 'yyMMdd-HHmmss');
  var p = getBook_().filter(function (q) { return q.policy === String(form.policy); })[0] || {};
  ss_().getSheetByName(TABS.ACTIONS).appendRow([
    id, new Date(), form.policy, p.clientNo || '', p.client || '', u.email,
    form.contacted, form.method, form.outcome, form.intention, form.followUp, String(form.notes || '').slice(0, 3000),
    'Pending Manager', '', '', '',
    form.rootCause || '', form.ffExplains || '', String(form.whatChanged || '').slice(0, 1000),
    form.confidence || '', form.recommended || '', '', ''
  ]);
  // Route: direct manager (App Users col F → CONFIG fallback),
  // CC branch head (Ricky) + sales support + Conservation Department for records.
  var directMgr = u.managerEmail || CONFIG.MANAGER_EMAIL;
  var cc = [CONFIG.OPS_EMAIL, CONFIG.SALES_SUPPORT_EMAIL, CONFIG.CONSERVATION_EMAIL]
    .filter(function (e, i, arr) { return e && e !== directMgr && arr.indexOf(e) === i; }).join(',');
  var base = webUrl_();
  MailApp.sendEmail({
    to: CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : directMgr,
    cc: CONFIG.TEST_MODE ? '' : cc,
    subject: (CONFIG.TEST_MODE ? '[TEST → ' + directMgr + ' cc ' + cc + '] ' : '') +
      'Conservation form ' + id + ' — ' + titleCase_(p.client || '') + ' (' + form.policy + ') needs your response',
    htmlBody: emailShell_(
      '<p style="font-size:14px"><b>' + esc_(u.name) + '</b> submitted a Conservation Action for <b>' +
      esc_(titleCase_(p.client || '')) + '</b>, policy <b>' + esc_(form.policy) + '</b> (' + (p.days || '?') + ' days in arrears):</p>' +
      '<ul style="font-size:13px">' +
      '<li>Client contacted: <b>' + esc_(form.contacted) + '</b> (' + esc_(form.method) + ')</li>' +
      '<li>Root cause of arrears: <b>' + esc_(form.rootCause || '—') + '</b></li>' +
      '<li>Earlier warning signs on our records: <b>' + esc_(form.ffExplains || '—') + '</b></li>' +
      (form.whatChanged ? '<li>What changed for the client: <b>' + esc_(form.whatChanged) + '</b></li>' : '') +
      '<li>Outcome: <b>' + esc_(form.outcome) + '</b> · Client intention: <b>' + esc_(form.intention) + '</b> · Confidence: <b>' + esc_(form.confidence || '—') + '</b></li>' +
      '<li>Recommended action: <b>' + esc_(form.recommended || '—') + '</b> · Follow-up: <b>' + esc_(form.followUp || '—') + '</b></li></ul>' +
      '<p style="font-size:13px;background:' + BRAND.light + ';padding:12px;border-radius:8px">' + esc_(form.notes || '(no notes)') + '</p>' +
      clientIntelHtml_(p) +
      '<p style="font-size:13px;color:#556">You will receive a daily reminder until this form is answered. Copies: branch head, sales support, Conservation Department (for records).</p>' +
      (base ? '<p style="text-align:center"><a href="' + base + '?page=manager" style="background:' + BRAND.navy +
        ';color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">Review &amp; respond</a></p>' : '')),
    name: 'Branch Automation'
  });
  cacheBust_();
  return { ok: true, id: id };
}

// ---- Manager area ----
function apiManagerQueue(token) {
  auth_(token, ['manager']);
  var acts = actionsIndex_().rows.sort(function (a, b) { return new Date(b.submitted) - new Date(a.submitted); });
  var sh = ss_().getSheetByName(TABS.SURVEY);
  var surveys = sh ? sh.getDataRange().getValues().slice(1).slice(-30).reverse().map(function (r) {
    return { when: fmtDate_(new Date(r[0])), client: titleCase_(String(r[2])), policy: r[3], rating: r[5], comment: r[6] };
  }) : [];
  return {
    ok: true,
    pending: acts.filter(function (a) { return a.status === 'Pending Manager'; }),
    recent: acts.filter(function (a) { return a.status !== 'Pending Manager'; }).slice(0, 20),
    surveys: surveys
  };
}

/** Manager responds with checkmarks (approvals), a decision dropdown and text.
 *  Stored in Conservation Actions, mirrored into Survey Responses, and a
 *  client-friendly copy goes to the client asking for their feedback. */
function apiManagerRespond(token, id, resp) {
  var u = auth_(token, ['manager']);
  var acts = actionsIndex_();
  var a = acts.rows.filter(function (x) { return x.id === id; })[0];
  if (!a) return { ok: false, error: 'Form not found' };
  resp = (typeof resp === 'string') ? { comment: resp, approvals: [], decision: '' } : (resp || {});
  var approvals = (resp.approvals || []).join('; ');
  var sh = ss_().getSheetByName(TABS.ACTIONS);
  sh.getRange(a.row, 13, 1, 4).setValues([['Responded', String(resp.comment || '').slice(0, 3000), u.email, new Date()]]);
  sh.getRange(a.row, 22, 1, 2).setValues([[approvals, resp.decision || '']]);
  // Mirror the manager's comments into Survey Responses (reporting home for all feedback)
  ss_().getSheetByName(TABS.SURVEY).appendRow([
    new Date(), a.clientNo, a.client, a.policy, 'MANAGER-75', '', String(resp.comment || '').slice(0, 2000),
    resp.decision || '', approvals, '', 'manager-response'
  ]);
  // 1) Back to the agent
  sendMail_(a.agentEmail,
    'Manager response — Conservation form ' + id + ' (' + a.policy + ')',
    emailShell_('<p style="font-size:14px">Your Conservation Action for <b>' + esc_(titleCase_(String(a.client))) +
      '</b> (policy ' + esc_(a.policy) + ') has a manager response:</p>' +
      '<ul style="font-size:13px;color:#334">' +
      '<li>Decision: <b>' + esc_(resp.decision || '—') + '</b></li>' +
      (approvals ? '<li>Approved: <b>' + esc_(approvals) + '</b></li>' : '') + '</ul>' +
      '<p style="font-size:14px;background:' + BRAND.light + ';padding:14px;border-radius:8px">' + esc_(resp.comment || '') + '</p>' +
      '<p style="font-size:13px;color:#556">— ' + esc_(u.name) + ', ' + esc_(CONFIG.BRANCH_NAME) + '</p>'));
  // 2) Client copy: what your agent and manager agreed, plus a feedback ask
  var p = getBook_().filter(function (q) { return q.policy === a.policy; })[0];
  if (p && p.email) {
    var base = webUrl_(), t = tokenForClient_(p.clientNo);
    var fbLink = base ? base + '?page=feedback&t=' + t + '&ca=' + encodeURIComponent(id) + '&pol=' + encodeURIComponent(a.policy) : '';
    sendMail_(p.email,
      'The plan we prepared for your policy ' + a.policy,
      emailShell_('<p style="font-size:15px">Dear ' + esc_(titleCase_(firstName_(String(a.client)))) + ',</p>' +
        '<p style="font-size:14px;color:#334;line-height:1.6">Following our recent notes, your agent and our branch management sat with your file this week. Here is where we landed:</p>' +
        '<div style="background:#fbfdff;border:1px solid #dbe6f2;border-radius:10px;padding:14px;margin:12px 0">' +
        '<div style="font-size:13px;color:#334">• Your agent’s recommendation: <b>' + esc_(a.recommended || a.outcome || 'a personal payment arrangement') + '</b></div>' +
        (approvals ? '<div style="font-size:13px;color:#334">• Approved by management: <b>' + esc_(approvals) + '</b></div>' : '') +
        (resp.comment ? '<div style="font-size:13px;color:#334">• From the manager: “' + esc_(String(resp.comment).slice(0, 500)) + '”</div>' : '') +
        '</div>' +
        '<p style="font-size:14px;color:#334;line-height:1.6">Your agent will be in touch to put this in motion. Before that call, we would value your honest take — does this plan actually work for you?</p>' +
        (fbLink ? '<p style="text-align:center;margin:20px 0"><a href="' + fbLink + '" style="background:' + BRAND.blue +
          ';color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">Review the plan &amp; give feedback</a></p>' : '') +
        '<p style="font-size:14px;color:#334">Thank you for working through this with us,<br><b>' + esc_(CONFIG.BRANCH_NAME) + '</b></p>'));
    logComm_('PLAN-COPY', p, p.email, 'SENT', 'Manager plan copy for ' + id);
  }
  return { ok: true };
}

/** Client feedback on the agent+manager plan — stored and pushed to the team. */
function apiPlanFeedback(token, caId, policy, answers) {
  var clientNo = clientNoForToken_(token);
  if (!clientNo) return { ok: false };
  answers = answers || {};
  var book = clientPolicies_(clientNo);
  var name = book.length ? book[0].client : '';
  ss_().getSheetByName(TABS.SURVEY).appendRow([
    new Date(), clientNo, name, policy, 'PLAN-FEEDBACK', answers.rating || '',
    String(answers.comment || '').slice(0, 2000), answers.worksForMe || '', '', String(answers.bestContact || '').slice(0, 300), caId
  ]);
  var a = actionsIndex_().rows.filter(function (x) { return x.id === caId; })[0];
  var to = [CONFIG.OPS_EMAIL, a && a.agentEmail, CONFIG.CONSERVATION_EMAIL]
    .filter(function (e, i, arr) { return e && arr.indexOf(e) === i; }).join(',');
  MailApp.sendEmail({
    to: CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : to,
    subject: (CONFIG.TEST_MODE ? '[TEST] ' : '') + 'Client feedback on conservation plan ' + caId + ' — ' + titleCase_(name),
    htmlBody: emailShell_('<p style="font-size:14px"><b>' + esc_(titleCase_(name)) + '</b> reviewed the plan for policy <b>' + esc_(policy) + '</b>:</p>' +
      '<ul style="font-size:13px;color:#334">' +
      '<li>Does the plan work for them: <b>' + esc_(answers.worksForMe || '—') + '</b></li>' +
      (answers.rating ? '<li>Rating of how we handled it: <b>' + esc_(answers.rating) + '/5</b></li>' : '') +
      (answers.bestContact ? '<li>Best way to reach: <b>' + esc_(answers.bestContact) + '</b></li>' : '') +
      (answers.comment ? '<li>“' + esc_(answers.comment) + '”</li>' : '') + '</ul>'),
    name: 'Branch Automation'
  });
  return { ok: true };
}

// ============================== OPPORTUNITIES MODULE =======================
// Opportunity spotting straight from the portfolio data. Staff/managers see
// the whole branch; agents see their own book.
function apiOpportunities(token) {
  var u = auth_(token, ['agent', 'staff', 'manager']);
  if (u.role !== 'agent') { var hit = cacheGetJson_('v:opps:ALL'); if (hit) return hit; }
  var book = getBook_().filter(function (p) { return u.role !== 'agent' || p.agent === u.agentName; });
  var byClient = {};
  book.forEach(function (p) {
    var c = byClient[p.clientNo] = byClient[p.clientNo] || { client: p.client, agent: p.agent, clientNo: p.clientNo,
      email: p.email, phone: p.phone, act: [], lapsed: 0, matured: 0, tenure: 0, arrears: 0 };
    if (p.statusDesc === 'Premium Paying') {
      c.act.push(p);
      if (p.days >= 30) c.arrears++;
      var m = String(p.issue || '').match(/(\d{4})/);
      if (m) c.tenure = Math.max(c.tenure, new Date().getFullYear() - Number(m[1]));
    }
    if (/Lapsed|Surrendered/i.test(p.statusDesc)) c.lapsed++;
    if (/Matured|Paid up/i.test(p.statusDesc)) c.matured++;
  });
  var clients = Object.keys(byClient).map(function (k) { return byClient[k]; });
  function row(c, metric) {
    return { client: titleCase_(c.client), clientNo: c.clientNo, agent: c.agent, metric: metric,
             contact: (c.email ? '✉️ ' : '') + (c.phone ? '📞' : '') || '—' };
  }
  function prem(c) { var t = 0; c.act.forEach(function (p) { t += p.premium; }); return t; }

  // 1 · Reinstatement window: lapsed 90–730 days, reachable
  var rein = book.filter(function (p) {
    return p.statusDesc === 'Lapsed' && p.days >= 90 && p.days <= 730 && (p.email || p.phone);
  }).sort(function (a, b) { return b.premium - a.premium; });
  // 2 · One-policy clients (cross-sell pool), richest first
  var single = clients.filter(function (c) { return c.act.length === 1; })
    .sort(function (a, b) { return prem(b) - prem(a); });
  // 3 · Loyal 10+ years (review/upgrade)
  var loyal = clients.filter(function (c) { return c.act.length && c.tenure >= 10; })
    .sort(function (a, b) { return b.tenure - a.tenure; });
  // 4 · Matured / paid-up money conversations
  var redeploy = book.filter(function (p) { return /Matured|Paid up/i.test(p.statusDesc); })
    .sort(function (a, b) { return b.sum - a.sum; });
  // 5 · Fragile: active + prior lapse + currently slipping
  var fragile = clients.filter(function (c) { return c.act.length && c.lapsed && c.arrears; })
    .sort(function (a, b) { return b.arrears - a.arrears; });

  var OUT = {
    ok: true, role: u.role,
    segments: [
      { key: 'rein', label: 'Reinstatement window', desc: 'Lapsed 90–730 days ago and still reachable — the sooner the ask, the easier the yes.',
        count: rein.length, rows: rein.slice(0, 25).map(function (p) {
          return { client: titleCase_(p.client), clientNo: p.clientNo, agent: p.agent,
                   metric: p.policy + ' · ' + money_(p.premium) + ' · lapsed ' + p.days + 'd',
                   contact: (p.email ? '✉️ ' : '') + (p.phone ? '📞' : '') }; }) },
      { key: 'single', label: 'One-policy clients', desc: 'Clients holding exactly one active policy — the branch\'s biggest cross-sell pool.',
        count: single.length, rows: single.slice(0, 25).map(function (c) { return row(c, money_(prem(c)) + '/yr · 1 policy'); }) },
      { key: 'loyal', label: 'Loyal 10+ years', desc: 'Long-tenure clients due a coverage review — needs have grown since they bought.',
        count: loyal.length, rows: loyal.slice(0, 25).map(function (c) { return row(c, c.tenure + ' yrs · ' + c.act.length + ' active · ' + money_(prem(c))); }) },
      { key: 'redeploy', label: 'Matured / paid-up', desc: 'Proceeds and freed-up premium looking for a home — annuity, savings, new cover.',
        count: redeploy.length, rows: redeploy.slice(0, 25).map(function (p) {
          return { client: titleCase_(p.client), clientNo: p.clientNo, agent: p.agent,
                   metric: p.policy + ' · ' + p.statusDesc + (p.sum ? ' · SA ' + money_(p.sum) : ''),
                   contact: (p.email ? '✉️ ' : '') + (p.phone ? '📞' : '') }; }) },
      { key: 'fragile', label: 'Fragile & slipping', desc: 'Lapsed before AND currently in arrears — the early-warning list; call before day 45.',
        count: fragile.length, rows: fragile.slice(0, 25).map(function (c) { return row(c, c.arrears + ' slipping · ' + c.lapsed + ' prior lapse · ' + money_(prem(c))); }) }
    ]
  };
  if (u.role !== 'agent') cachePutJson_('v:opps:ALL', OUT);
  return OUT;
}

// ============================== CLIENT LOOKUP (360° VIEW) ==================
// The staff's most-used screen: type a name, policy #, client #, phone or
// email → the client's ENTIRE world. Identity cluster (all client numbers
// that are really the same person), every policy, the household at the same
// address, replacement risk, and the cross-sell picture.
function lkNorm_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function lkAddrKey_(s) { return lkNorm_(s).slice(0, 40); }

function apiLookup(token, query) {
  var u = auth_(token, ['agent', 'staff', 'manager']);
  var q = String(query || '').trim().toLowerCase();
  if (q.length < 3) return { ok: false, error: 'Type at least 3 characters — name, policy number, client number, phone or email.' };
  var book = getBook_(), EX = exportIndex_();

  // --- find seed matches across every identifier
  var seedClients = {};
  book.forEach(function (p) {
    var hay = [p.policy, p.clientNo, p.client, p.phone, p.email].join(' ').toLowerCase();
    if (hay.indexOf(q) > -1) seedClients[p.clientNo] = true;
  });
  EX.all.forEach(function (e) {
    if ([e.policy, e.name, e.phone, e.email].join(' ').toLowerCase().indexOf(q) > -1) {
      var b = book.filter(function (p) { return p.policy === e.policy; })[0];
      if (b) seedClients[b.clientNo] = true;
    }
  });
  var seeds = Object.keys(seedClients);
  if (!seeds.length) return { ok: false, error: 'No match for “' + query + '” in the branch portfolio.' };

  // --- IDENTITY CLUSTER: same normalised name OR same address = same person
  var nameKey = {}, addrKey = {};
  book.forEach(function (p) {
    (nameKey[lkNorm_(p.client)] = nameKey[lkNorm_(p.client)] || {})[p.clientNo] = true;
    var a = lkAddrKey_(p.address);
    if (a.length >= 10) (addrKey[a] = addrKey[a] || {})[p.clientNo] = true;
  });
  var cluster = {}, household = {};
  seeds.forEach(function (cn) {
    cluster[cn] = true;
    book.filter(function (p) { return p.clientNo === cn; }).forEach(function (p) {
      Object.keys(nameKey[lkNorm_(p.client)] || {}).forEach(function (c2) { cluster[c2] = true; });
      var a = lkAddrKey_(p.address);
      if (a.length >= 10) Object.keys(addrKey[a] || {}).forEach(function (c2) { household[c2] = true; });
    });
  });
  var clusterIds = Object.keys(cluster);
  if (clusterIds.length > 12) clusterIds = seeds;   // guard against giant name collisions

  // --- all policies in the cluster
  var recs = book.filter(function (p) { return cluster[p.clientNo]; });
  var primary = recs[0] || {};
  var totPrem = 0, totSA = 0, byStatus = {}, agents = {};
  recs.forEach(function (p) {
    if (p.statusDesc === 'Premium Paying') { totPrem += p.premium; totSA += p.sum; }
    byStatus[p.statusDesc] = (byStatus[p.statusDesc] || 0) + 1;
    if (p.agent) agents[p.agent] = true;
  });

  // --- REPLACEMENT / INTEGRITY RADAR (what the old app called V6 risk)
  var yr = 365 * 86400000, now = Date.now();
  function issueTs(p) { var m = String(p.issue || '').match(/(\d{4})/); return m ? new Date(Number(m[1]), 0, 1).getTime() : 0; }
  var lapsedRecent = recs.filter(function (p) { return /Lapsed|Surrendered/i.test(p.statusDesc) && (now - issueTs(p)) <= 5 * yr; });
  var newBusiness = recs.filter(function (p) { return (now - issueTs(p)) <= 2 * yr; });
  var pending = recs.filter(function (p) { return isPendingCase_(p); });
  var arrears = recs.filter(function (p) { return p.statusDesc === 'Premium Paying' && p.days >= 45; });
  var flags = [];
  if (lapsedRecent.length && (newBusiness.length || pending.length))
    flags.push({ level: 'high', text: '⚠️ REPLACEMENT RISK — ' + lapsedRecent.length + ' policy(ies) lapsed/surrendered within 5 years AND ' +
      (pending.length ? pending.length + ' pending application(s)' : newBusiness.length + ' new policy(ies) written') +
      '. Confirm this was not a replacement; document the client\'s reasons.' });
  else if (lapsedRecent.length)
    flags.push({ level: 'watch', text: '🔎 ' + lapsedRecent.length + ' policy(ies) lapsed/surrendered in the last 5 years — history of losing cover; fix the payment method for good.' });
  if (arrears.length && newBusiness.length)
    flags.push({ level: 'high', text: '⚠️ Paying for NEW cover while ' + arrears.length + ' older policy(ies) sit in arrears — affordability or a switch in progress. Ask directly.' });
  if (Object.keys(agents).length > 1)
    flags.push({ level: 'info', text: '👥 Policies split across ' + Object.keys(agents).length + ' agents (' + Object.keys(agents).join(', ') + ') — agree who owns the relationship.' });
  if (clusterIds.length > 1)
    flags.push({ level: 'info', text: '🪪 ' + clusterIds.length + ' client numbers appear to be the same person (' + clusterIds.join(', ') + ') — consolidate the record.' });

  // --- export enrichment + opportunities
  var suspTot = 0, undel = 0, maturing = [], age = null, funds3 = 0;
  recs.forEach(function (p) {
    var e = EX.byPolicy[p.policy];
    if (!e) return;
    suspTot += e.susp; if (e.undelivered) undel++;
    if (e.funds3) funds3++;
    if (e.age && !age) age = e.age;
    if (e.monthsToMaturity !== null && e.monthsToMaturity >= 0 && e.monthsToMaturity <= 36)
      maturing.push({ policy: p.policy, when: fmtDate_(e.maturity), months: e.monthsToMaturity, value: money_(Math.max(e.sumInsured, e.fundValue)) });
  });
  var opps = [];
  if (suspTot > 0) opps.push('💰 ' + money_(suspTot) + ' sitting in suspense — apply it before any arrears conversation.');
  if (undel) opps.push('📦 ' + undel + ' policy document(s) never delivered — deliver in person and open the review.');
  maturing.forEach(function (m) { opps.push('🎯 ' + m.policy + ' matures ' + m.when + ' (' + m.months + ' months, ' + m.value + ') — start the redeployment talk now.'); });
  if (recs.filter(function (p) { return p.statusDesc === 'Premium Paying'; }).length === 1)
    opps.push('🌱 Only ONE active policy — the household protection conversation is wide open.');
  if (age && age >= 55 && age <= 64) opps.push('🌅 Client is ' + age + ' — retirement window: annuity, pension top-up, health cover.');
  if (age && age < 40 && totSA > 0) opps.push('📈 Age ' + age + ' with ' + money_(totSA) + ' cover — needs typically grow fastest in this decade.');
  if (funds3) opps.push('🛡️ ' + funds3 + ' policy(ies) can carry 3 premiums from their own fund — APL protects cover during any gap.');

  // --- household (same address, different client)
  var houseRows = [];
  Object.keys(household).forEach(function (cn) {
    if (cluster[cn]) return;
    var hp = book.filter(function (p) { return p.clientNo === cn; });
    if (!hp.length) return;
    var act = hp.filter(function (p) { return p.statusDesc === 'Premium Paying'; });
    var hprem = 0; act.forEach(function (p) { hprem += p.premium; });
    houseRows.push({ client: titleCase_(hp[0].client), clientNo: cn, agent: hp[0].agent,
      policies: act.length + ' active of ' + hp.length, premium: money_(hprem),
      arrears: act.filter(function (p) { return p.days >= 45; }).length });
  });

  return { ok: true, query: query,
    client: { name: titleCase_(primary.client), clientNos: clusterIds, agent: primary.agent,
      phone: primary.phone, email: primary.email, address: primary.address, age: age,
      activePremium: money_(totPrem), sumAssured: money_(totSA),
      status: Object.keys(byStatus).map(function (k) { return k + ': ' + byStatus[k]; }).join(' · ') },
    flags: flags, opportunities: opps,
    policies: recs.sort(function (a, b) { return (b.statusDesc === 'Premium Paying' ? 1 : 0) - (a.statusDesc === 'Premium Paying' ? 1 : 0) || b.premium - a.premium; })
      .map(function (p) {
        var e = EX.byPolicy[p.policy] || {};
        return { policy: p.policy, plan: p.plan, issue: p.issue, premium: money_(p.premium),
          sum: money_(p.sum), paidTo: p.paidTo, status: p.statusDesc, days: p.days,
          agent: p.agent, billing: p.billing, clientNo: p.clientNo,
          susp: e.susp > 0 ? money_(e.susp) : '', maturity: e.maturity ? fmtDate_(e.maturity) : '',
          undelivered: !!e.undelivered, agentStatus: e.agentStatus || '' };
      }),
    household: houseRows };
}

// ============================== CAMPAIGNS MODULE ===========================
// Campaign 1: ORPHANS — clients whose servicing agent is no longer active.
// An agent is deemed inactive when their newest policy issue date is more
// than ORPHAN_INACTIVE_YEARS old (no new business = gone). For each orphan
// client we mine the book: their policies, arrears state, the household at
// their address, and which ACTIVE agent already touches them — the natural
// adopter for reassignment and the cross-sell conversation.
function apiCampaigns(token) {
  auth_(token, ['staff', 'manager']);
  var hit = cacheGetJson_('v:camps'); if (hit) return hit;
  var thisYear = new Date().getFullYear();
  var book = getBook_();
  var EX = exportIndex_();
  var byPolicy = {};
  book.forEach(function (p) { byPolicy[p.policy] = p; });

  // ---- agent activity: export truth first, issue-date inference as fallback
  var agentNewest = {};
  book.forEach(function (p) {
    if (!p.agent) return;
    var m = String(p.issue || '').match(/(\d{4})/);
    if (m) agentNewest[p.agent] = Math.max(agentNewest[p.agent] || 0, Number(m[1]));
  });
  function agentInactive(name) {
    var st = EX.agentStatus[String(name || '').toLowerCase()];
    if (st) return st.toLowerCase() !== 'active' ? st : '';
    return (agentNewest[name] && thisYear - agentNewest[name] >= 2) ? 'No new business since ' + agentNewest[name] : '';
  }

  // ---- household index
  function normAddr(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40); }
  var byAddr = {}, seenCA = {};
  book.forEach(function (p) {
    var a = normAddr(p.address);
    if (!a || a.length < 8 || seenCA[p.clientNo + '|' + a]) return;
    seenCA[p.clientNo + '|' + a] = true;
    (byAddr[a] = byAddr[a] || []).push({ clientNo: p.clientNo, client: p.client, agent: p.agent });
  });

  // ============ 1 · SUSPENSE MONEY ============
  var susp = EX.all.filter(function (e) { return e.susp > 0; })
    .sort(function (a, b) { return b.susp - a.susp; });
  var suspTotal = 0; susp.forEach(function (e) { suspTotal += e.susp; });
  var suspRows = susp.slice(0, 40).map(function (e) {
    var b = byPolicy[e.policy];
    return ['<b>' + esc_(e.name) + '</b><div class="muted">' + esc_(e.policy) + '</div>',
      '<b style="color:#1a7f43">' + money_(e.susp) + '</b>',
      esc_(e.plan) + ' · ' + money_(e.annualPremium) + '/yr',
      b && b.days >= 30 ? '<span class="pill bad">' + b.days + 'd arrears</span>' : '<span class="pill ok">current</span>',
      esc_((b && b.agent) || e.agentName),
      (e.email ? '✉️ ' : '') + (e.phone ? '📞' : '')];
  });

  // ============ 2 · ORPHANS / REPLACEMENTS ============
  var byClientAgents = {};
  book.forEach(function (p) {
    if (p.statusDesc !== 'Premium Paying' || !p.agent || agentInactive(p.agent)) return;
    (byClientAgents[p.clientNo] = byClientAgents[p.clientNo] || {})[p.agent] = true;
  });
  var orphanByClient = {};
  book.forEach(function (p) {
    if (p.statusDesc !== 'Premium Paying') return;
    var why = agentInactive(p.agent);
    if (!why) return;
    var o = orphanByClient[p.clientNo] = orphanByClient[p.clientNo] || {
      clientNo: p.clientNo, client: p.client, lastAgent: p.agent, why: why,
      policies: 0, premium: 0, maxDays: 0, email: '', phone: '', address: '' };
    o.policies++; o.premium += p.premium; o.maxDays = Math.max(o.maxDays, p.days || 0);
    if (p.email) o.email = p.email;
    if (p.phone) o.phone = p.phone;
    if (p.address) o.address = p.address;
  });
  var orphans = Object.keys(orphanByClient).map(function (k) {
    var o = orphanByClient[k];
    var ownActive = Object.keys(byClientAgents[o.clientNo] || {});
    var houseAdopter = '', household = [];
    (byAddr[normAddr(o.address)] || []).forEach(function (h) {
      if (h.clientNo === o.clientNo) return;
      household.push(titleCase_(h.client));
      if (!houseAdopter && h.agent && !agentInactive(h.agent)) houseAdopter = h.agent;
    });
    o.adopter = ownActive[0] || houseAdopter;
    o.via = ownActive[0] ? 'own policy' : (houseAdopter ? 'household' : '');
    o.household = household.slice(0, 3).join(', ');
    return o;
  }).sort(function (a, b) { return b.premium - a.premium; });
  var orphPrem = 0; orphans.forEach(function (o) { orphPrem += o.premium; });
  var orphanRows = orphans.slice(0, 40).map(function (o) {
    return ['<b>' + esc_(titleCase_(o.client)) + '</b><div class="muted">#' + esc_(o.clientNo) + '</div>',
      esc_(o.lastAgent) + '<div class="muted">' + esc_(o.why) + '</div>',
      o.policies + ' pol · ' + money_(o.premium) + '/yr' + (o.maxDays >= 30 ? ' · <span class="pill bad">' + o.maxDays + 'd</span>' : ''),
      o.household ? esc_(o.household) : '<span class="muted">—</span>',
      o.adopter ? '<b style="color:#1a7f43">' + esc_(o.adopter) + '</b><div class="muted">via ' + esc_(o.via) + '</div>' : '<span class="muted">unassigned</span>',
      (o.email ? '✉️ ' : '') + (o.phone ? '📞' : '')];
  });

  // ============ 3 · UNDELIVERED POLICIES ============
  var undel = EX.all.filter(function (e) { return e.undelivered; })
    .sort(function (a, b) { return b.annualPremium - a.annualPremium; });
  var undelRows = undel.slice(0, 40).map(function (e) {
    var b = byPolicy[e.policy];
    return ['<b>' + esc_(e.name) + '</b><div class="muted">' + esc_(e.policy) + '</div>',
      esc_(e.plan), esc_(e.dispatch || '—'),
      money_(e.annualPremium) + '/yr',
      esc_((b && b.agent) || e.agentName),
      (e.email ? '✉️ ' : '') + (e.phone ? '📞' : '')];
  });

  // ============ 4 · MATURITY PIPELINE (24 months) ============
  var mats = EX.all.filter(function (e) { return e.monthsToMaturity !== null && e.monthsToMaturity >= 0 && e.monthsToMaturity <= 24; })
    .sort(function (a, b) { return a.monthsToMaturity - b.monthsToMaturity; });
  var matVal = 0; mats.forEach(function (e) { matVal += Math.max(e.sumInsured, e.fundValue); });
  var matRows = mats.slice(0, 40).map(function (e) {
    var b = byPolicy[e.policy];
    return ['<b>' + esc_(e.name) + '</b><div class="muted">' + esc_(e.policy) + (e.age ? ' · age ' + e.age : '') + '</div>',
      '<b>' + esc_(fmtDate_(e.maturity)) + '</b><div class="muted">' + e.monthsToMaturity + ' months</div>',
      esc_(e.plan),
      money_(Math.max(e.sumInsured, e.fundValue)),
      esc_((b && b.agent) || e.agentName),
      (e.email ? '✉️ ' : '') + (e.phone ? '📞' : '')];
  });

  // ============ 5 · APPROACHING RETIREMENT (55–64) ============
  var ret = EX.all.filter(function (e) { return e.age !== null && e.age >= 55 && e.age <= 64; });
  var seenClient = {};
  ret = ret.filter(function (e) { var b = byPolicy[e.policy]; var k = (b && b.clientNo) || e.policy;
    if (seenClient[k]) return false; seenClient[k] = true; return true; })
    .sort(function (a, b) { return b.annualPremium - a.annualPremium; });
  var retRows = ret.slice(0, 40).map(function (e) {
    var b = byPolicy[e.policy];
    return ['<b>' + esc_(e.name) + '</b><div class="muted">age ' + e.age + (e.city ? ' · ' + esc_(e.city) : '') + '</div>',
      esc_(e.plan) + '<div class="muted">' + esc_(e.policy) + '</div>',
      money_(e.annualPremium) + '/yr',
      e.funds3 ? '<span class="pill ok">fund healthy</span>' : '',
      esc_((b && b.agent) || e.agentName),
      (e.email ? '✉️ ' : '') + (e.phone ? '📞' : '')];
  });

  var exOn = EX.all.length > 0;
  var OUT = { ok: true, exportLoaded: exOn, campaigns: [
    { key: 'susp', icon: '💰', label: 'Suspense money', desc: 'Premium money ALREADY RECEIVED but sitting unapplied. Apply it before any arrears contact — for many of these clients it clears the balance without a single phone call.',
      stats: [[susp.length, 'policies'], [money_(suspTotal), 'sitting in suspense']],
      cols: ['Client', 'In suspense', 'Policy', 'Arrears?', 'Agent', 'Contact'], rows: suspRows },
    { key: 'orph', icon: '🧭', label: 'Orphans & replacements', desc: 'Premium Paying clients whose servicing agent is Inactive or Vested (core-system status' + (exOn ? '' : ' unavailable — inferred from new-business recency') + '). The adopter column is the active agent who already touches the client — reassignment starts there.',
      stats: [[orphans.length, 'orphan clients'], [money_(orphPrem), 'premium at stake'], [orphans.filter(function (o) { return o.adopter; }).length, 'have an adopter'], [orphans.filter(function (o) { return o.maxDays >= 30; }).length, 'already slipping']],
      cols: ['Client', 'Last agent', 'Book', 'Household', 'Suggested adopter', 'Contact'], rows: orphanRows },
    { key: 'undel', icon: '📦', label: 'Undelivered policies', desc: 'Contracts dispatched but never acknowledged by the client — some years old. Every delivery is a compliance fix AND a warm doorstep visit.',
      stats: [[undel.length, 'undelivered']],
      cols: ['Client', 'Plan', 'Dispatched', 'Premium', 'Agent', 'Contact'], rows: undelRows },
    { key: 'mat', icon: '🎯', label: 'Maturity pipeline', desc: 'Policies maturing inside 24 months. Start the redeployment conversation early — annuity, new protection, savings — and the money stays in the branch family.',
      stats: [[mats.length, 'maturing ≤24mo'], [money_(matVal), 'value maturing']],
      cols: ['Client', 'Matures', 'Plan', 'Value', 'Agent', 'Contact'], rows: matRows },
    { key: 'ret', icon: '🌅', label: 'Approaching retirement (55–64)', desc: 'Clients in the retirement-planning window, from client birthdates. Pension top-ups, annuities and health cover conversations land best right here.',
      stats: [[ret.length, 'clients 55–64']],
      cols: ['Client', 'Policy', 'Premium', 'Fund', 'Agent', 'Contact'], rows: retRows }
  ] };
  cachePutJson_('v:camps', OUT);
  return OUT;
}

// ============================== REQUIREMENTS MODULE ========================
// From 27 October 2026 (Ricky: one source for pending) the requirements view reads Guardian's pending report, the newest
// "Branch Pendings_<date>-<time>" tab of this workbook (one requirement a row), the same report the branch wall reads, so
// the Portal and the wall show the same pending. The chase on each policy comes from the "Pendings Chase" tab, which the
// KPI tracker rewrites every ten minutes from Salesforce's Pendings tasks (its task, owner, due date, last notes).
// A comment typed here is kept in the "Requirements Log" as before (the data tab is never written to), and the tracker
// posts it as a note on that policy's open Pendings task in Salesforce within ten minutes; column I of the log says when,
// or says there is no open Pendings task to post it on. Salesforce is the one place for chasing notes.

var PEND_TAB_PREFIX = 'Branch Pendings';
var PEND_CHASE_TAB = 'Pendings Chase';

// Kept for the dashboard and the pending reminders, which still read the book's own status.
function isPendingCase_(p) {
  if (p.status2 === 'Pending') return true;
  return /underwriting|missing reqts|missing settlement|error on policy|pending/i.test(p.statusDesc);
}

// Portal comments by policy. A comment already posted to Salesforce shows there, among the task's notes, so it is not
// shown twice; one still waiting, or with no open task to go on, shows here with what happened to it.
function reqLogIndex_() {
  var sh = ss_().getSheetByName(TABS.REQLOG);
  var byPolicy = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(1, 1, sh.getLastRow(), Math.max(9, sh.getLastColumn())).getValues().slice(1).forEach(function (r) {
      var pol = String(r[1]);
      if (!byPolicy[pol]) byPolicy[pol] = { comments: [], status: '' };
      var sf = String(r[8] || '');
      if (r[6] && !/^Posted/.test(sf)) byPolicy[pol].comments.push({ when: fmtDate_(new Date(r[0])), author: String(r[5] || '').replace(/\s*<[^>]*>\s*/g, ''),
        text: String(r[6]) + (sf ? ' (' + sf + ')' : ' (on its way to Salesforce)') });
      if (r[7]) byPolicy[pol].status = String(r[7]);
    });
  }
  return byPolicy;
}

// The newest pending report, one entry a policy, with its outstanding requirements.
function pendReport_() {
  var tabs = ss_().getSheets().filter(function (sh) { return sh.getName().indexOf(PEND_TAB_PREFIX) === 0; })
    .sort(function (a, b) { return a.getName() < b.getName() ? 1 : a.getName() > b.getName() ? -1 : 0; });
  if (!tabs.length) return null;
  var vals = tabs[0].getDataRange().getValues();
  if (vals.length < 2) return null;
  var h = vals[0].map(function (x) { return String(x).trim(); }), ix = function (n) { return h.indexOf(n); };
  var c = { pol: ix('POLICY'), app: ix('application_number'), cno: ix('ClientID'), cli: ix('Client Name'), agent: ix('Agent Name'),
            recv: ix('APPLICATION_RECEIVED_DATE'), days: ix('DAYS_SINCE_SUBMISSION'), prem: ix('annual_premium_amount'), mode: ix('mode_premium'),
            held: ix('SUSPENDED_AMOUNT'), dec: ix('DecisionType'), name: ix('requirement_name'), code: ix('REQUIREMENT_CODE'),
            kind: ix('REQUIREMENT_CATEGORY'), who: ix('WHO_ACTS_NEXT'), rag: ix('RAG_STATUS'), out: ix('DAYS_OUTSTANDING'), st: ix('REQUIREMENT_STATUS') };
  if (c.pol < 0) return null;
  var cell = function (r, i) { return i < 0 || r[i] == null ? '' : r[i]; };
  var by = {};
  vals.slice(1).forEach(function (r) {
    var pol = String(cell(r, c.pol)).trim(); if (!pol) return;
    if (/closed|received|waived|complete|cancel/i.test(String(cell(r, c.st)))) return;
    var p = by[pol] = by[pol] || {
      policy: pol, app: String(cell(r, c.app)).trim(), clientNo: String(cell(r, c.cno)).trim(), client: String(cell(r, c.cli)).trim(),
      agent: String(cell(r, c.agent)).trim(), appRecv: cell(r, c.recv), days: 0, premium: Number(cell(r, c.prem)) || Number(cell(r, c.mode)) || 0,
      held: 0, decision: String(cell(r, c.dec)).trim(), reqs: [] };
    p.days = Math.max(p.days, Number(cell(r, c.days)) || 0);
    p.held = Math.max(p.held, Number(cell(r, c.held)) || 0);
    p.reqs.push({ name: String(cell(r, c.name) || cell(r, c.code)), kind: String(cell(r, c.kind)), who: String(cell(r, c.who)),
                  rag: String(cell(r, c.rag)), days: Number(cell(r, c.out)) || 0 });
  });
  return { tab: tabs[0].getName(), cases: by };
}

// The tracker's chase tab: each policy's Pendings task in Salesforce and its last notes.
function pendChaseIndex_() {
  var sh = ss_().getSheetByName(PEND_CHASE_TAB), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    var notes = [];
    if (r[9]) notes.push({ when: String(r[7] || ''), author: String(r[8] || ''), text: String(r[9]) });
    try { JSON.parse(String(r[10] || '[]')).forEach(function (n) { notes.push({ when: n.at, author: n.by, text: n.text }); }); } catch (e) {}
    var due = r[4] instanceof Date ? fmtDate_(r[4]) : String(r[4] || '');
    out[String(r[0])] = { task: String(r[2] || ''), owner: String(r[3] || ''), due: due, open: Number(r[5]) || 0, overdue: Number(r[6]) || 0,
                          notes: notes, updated: String(r[11] || '') };
  });
  return out;
}

// "SEEGOLAM, VARUN" and "Varun Seegolam" are one agent: the report and App Users may write a name either way.
function sameAgent_(a, b) {
  var k = function (s) { return String(s || '').toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/).filter(String).sort().join(' '); };
  return !!k(a) && k(a) === k(b);
}

function apiRequirements(token) {
  var u = auth_(token, ['agent', 'staff', 'manager']);
  if (u.role !== 'agent') { var hit = cacheGetJson_('v:reqs:ALL'); if (hit) return hit; }
  var rep = pendReport_();
  if (!rep) return { ok: false, error: 'There is no "' + PEND_TAB_PREFIX + '" tab in the Branch Portfolio yet. Upload Guardian’s pending report.' };
  var log = reqLogIndex_(), chase = pendChaseIndex_();
  var cases = Object.keys(rep.cases).map(function (k) { return rep.cases[k]; })
    .filter(function (p) { return u.role !== 'agent' || sameAgent_(p.agent, u.agentName); })
    .map(function (p) {
      var l = log[p.policy] || (p.app && log[p.app]) || { comments: [], status: '' }, ch = chase[p.policy] || null;
      var kinds = {}, order = [];
      p.reqs.forEach(function (r) { var k = r.kind || r.name; if (!kinds[k]) { kinds[k] = 0; order.push(k); } kinds[k]++; });
      var red = p.reqs.filter(function (r) { return r.rag === 'Red'; }).length;
      var sf = !ch ? 'not read yet (the tracker writes it every ten minutes)'
        : ch.open ? ch.open + ' open Pendings task' + (ch.open > 1 ? 's' : '') + (ch.owner ? ' · ' + ch.owner : '') + (ch.due ? ' · due ' + ch.due : '') + (ch.overdue ? ' · ' + ch.overdue + ' overdue' : '')
        : ch.task ? 'Pendings task closed, policy still pending' : 'No Pendings task in Salesforce';
      return {
        policy: p.policy, clientNo: p.clientNo, client: titleCase_(p.client), agent: p.agent,
        plan: p.decision ? 'Underwriting: ' + p.decision : '', premium: money_(p.premium), sum: '',
        appRecv: p.appRecv instanceof Date ? fmtDate_(p.appRecv) : String(p.appRecv || ''), issue: '',
        statusDesc: 'Outstanding: ' + order.map(function (k) { return k + (kinds[k] > 1 ? ' ×' + kinds[k] : ''); }).join(' · ') +
          ' · ' + p.days + ' days since submission' + (red ? ' · ' + red + ' overdue at Guardian' : '') +
          (p.held ? ' · ' + money_(p.held) + ' held in suspense' : '') + ' · Salesforce: ' + sf,
        phone: '', localStatus: l.status,
        comments: (ch ? ch.notes : []).concat(l.comments.slice(-3).reverse()).slice(0, 6),
        days: p.days, red: red, held: p.held, reqs: p.reqs, salesforce: sf
      };
    })
    // Cases marked Settled here drop to the bottom; the longest waiting first.
    .sort(function (a, b) {
      var s = (a.localStatus === 'Settled' ? 1 : 0) - (b.localStatus === 'Settled' ? 1 : 0);
      return s || (b.days - a.days);
    });
  var OUT = { ok: true, role: u.role, cases: cases, source: rep.tab };
  if (u.role !== 'agent') cachePutJson_('v:reqs:ALL', OUT);
  return OUT;
}

function apiReqComment(token, policy, comment, newStatus) {
  var u = auth_(token, ['agent', 'staff', 'manager']);
  var rep = pendReport_(), p = (rep && rep.cases[String(policy)]) || null;
  if (!p) p = getBook_().filter(function (q) { return q.policy === String(policy); })[0] || {};
  ss_().getSheetByName(TABS.REQLOG).appendRow([
    new Date(), policy, p.clientNo || '', p.client || '', p.agent || '',
    u.name + ' <' + u.email + '>', String(comment || '').slice(0, 2000), newStatus || ''
  ]);
  cacheBust_();
  if (newStatus === 'Escalated') {
    MailApp.sendEmail({
      to: CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : CONFIG.MANAGER_EMAIL,
      subject: (CONFIG.TEST_MODE ? '[TEST] ' : '') + 'Requirement ESCALATED — ' + titleCase_(p.client || '') + ' (' + policy + ')',
      htmlBody: emailShell_('<p style="font-size:14px"><b>' + esc_(u.name) + '</b> escalated policy <b>' + esc_(policy) +
        '</b> (' + esc_(titleCase_(p.client || '')) + ', ' + esc_(p.statusDesc || p.decision || '') + '):</p>' +
        '<p style="font-size:13px;background:' + BRAND.light + ';padding:12px;border-radius:8px">' + esc_(comment || '(no comment)') + '</p>'),
      name: 'Branch Automation'
    });
  }
  return { ok: true, note: 'Saved. It goes onto the policy’s Pendings task in Salesforce within ten minutes.' };
}

// ---- Production board (from the new-business / API tab) ----
function productionSheet_() {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var head = sheets[i].getRange(1, 1, 1, Math.min(20, sheets[i].getLastColumn() || 1))
      .getValues()[0].map(function (h) { return String(h).toUpperCase().trim(); });
    if (head.indexOf('API_AMT') > -1 && head.indexOf('EFFECTIVE_DT') > -1) return sheets[i];
  }
  return null;
}

function apiProduction(token) {
  auth_(token, ['agent', 'staff', 'manager']);
  var hit = cacheGetJson_('v:prod'); if (hit) return hit;
  var sh = productionSheet_();
  if (!sh) return { ok: false, error: 'No production tab found (needs EFFECTIVE_DT / API_AMT headers).' };
  var vals = sh.getDataRange().getValues();
  var head = vals[0].map(function (h) { return String(h).toUpperCase().trim(); });
  var cAgt = head.indexOf('AGT_ID'), cApi = head.indexOf('API_AMT'), cCnt = head.indexOf('COUNT'),
      cYr = head.indexOf('YEAR'), cMo = head.indexOf('MONTH'), cBr = head.indexOf('AGENT_BRANCH'),
      cFn = head.indexOf('CLIENT FIRST NAME'), cLn = head.indexOf('CLIENT LAST NAME');
  var year = new Date().getFullYear();
  var byAgent = {}, byMonth = {}, totalApi = 0, totalCnt = 0;
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (Number(r[cYr]) !== year) continue;
    var api = num_(r[cApi]), cnt = num_(r[cCnt]), agt = String(r[cAgt] || '').trim(), mo = Number(r[cMo]);
    totalApi += api; totalCnt += cnt;
    if (!byAgent[agt]) byAgent[agt] = { api: 0, count: 0, branch: String(r[cBr] || '') };
    byAgent[agt].api += api; byAgent[agt].count += cnt;
    byMonth[mo] = (byMonth[mo] || 0) + api;
  }
  var leaders = Object.keys(byAgent).map(function (a) {
    return { agent: a, branch: byAgent[a].branch, api: byAgent[a].api, count: byAgent[a].count };
  }).sort(function (a, b) { return b.api - a.api; }).slice(0, 25)
    .map(function (l) { return { agent: l.agent, branch: l.branch, api: money_(l.api), count: l.count }; });
  var months = [];
  for (var m = 1; m <= 12; m++) months.push({ month: m, api: byMonth[m] || 0 });
  var OUT = { ok: true, year: year, totalApi: money_(totalApi), totalCount: totalCnt, leaders: leaders, months: months };
  cachePutJson_('v:prod', OUT);
  return OUT;
}

// ---- Staff review-and-send (manual mode) ----
/** Staff click-send the 45-day letters after their reference checks. */
function apiSendStage45(token, policies) {
  var u = auth_(token, ['staff', 'manager']);
  var sent = commsIndex_();
  var byPolicy = {};
  getBook_().forEach(function (p) { byPolicy[p.policy] = p; });
  var ok = 0, errors = [];
  (policies || []).forEach(function (pol) {
    var p = byPolicy[String(pol)];
    if (!p) { errors.push(pol + ': not in the data'); return; }
    if (sent[p.policy + '|CLIENT-45']) { errors.push(pol + ': already sent'); return; }
    if (!p.email) { errors.push(pol + ': no client email on file'); return; }
    try {
      sendClient45_(p);
      logComm_('CLIENT-45', p, p.email, 'SENT', 'Reviewed & sent by ' + u.email);
      ok++;
    } catch (e) { errors.push(pol + ': ' + e); }
  });
  cacheBust_();
  return { ok: true, sent: ok, errors: errors };
}

/** Staff record a response or payment — stops the 3-day nudges; a payment
 *  halts the entire sequence for that policy. */
function apiMarkStatus(token, policy, kind, note) {
  var u = auth_(token, ['staff', 'manager', 'agent']);
  var p = getBook_().filter(function (q) { return q.policy === String(policy); })[0];
  if (!p) return { ok: false, error: 'Policy not found in the data' };
  var stage = kind === 'payment' ? 'PAYMENT-RECEIVED' : 'CLIENT-RESPONDED';
  logComm_(stage, p, u.email, 'MARKED', String(note || '').slice(0, 300));
  cacheBust_();
  return { ok: true };
}

/** "Click for the file" — emails the full assistance record on demand. */
function apiCaseFile(token, policy) {
  auth_(token, ['staff', 'manager']);
  var p = getBook_().filter(function (q) { return q.policy === String(policy); })[0];
  if (!p) return { ok: false, error: 'Policy not found in the data' };
  sendCaseFile90_(p, commsIndex_());
  return { ok: true };
}

// ---- Staff dashboard ----
function apiStaffDashboard(token) {
  auth_(token, ['staff', 'manager']);
  var hit = cacheGetJson_('v:dash'); if (hit) return hit;
  var queue = buildQueue_();
  var counts = { 'CLIENT-45': 0, 'CLIENT-60': 0, 'AGENT-75': 0, 'CLIENT-90': 0 };
  queue.forEach(function (i) { counts[i.stage]++; });
  var logSh = ss_().getSheetByName(TABS.LOG);
  var recent = logSh ? logSh.getDataRange().getValues().slice(1).slice(-40).reverse().map(function (r) {
    return { when: fmtDate_(new Date(r[0])), stage: r[1], policy: r[2], client: titleCase_(String(r[4])), to: r[5], status: r[8] };
  }) : [];
  var acts = actionsIndex_().rows;
  // The 45-day REVIEW QUEUE — the staff work screen, loaded with intelligence
  var book = getBook_();
  var EXQ = exportIndex_();
  // household index + recent-new-business index for replacement spotting
  var hIdx = {}, nbIdx = {};
  var nowY = new Date().getFullYear();
  book.forEach(function (p) {
    var a = lkAddrKey_(p.address);
    if (a.length >= 10) (hIdx[a] = hIdx[a] || []).push(p);
    var m = String(p.issue || '').match(/(\d{4})/);
    if (m && nowY - Number(m[1]) <= 2) (nbIdx[p.clientNo] = nbIdx[p.clientNo] || []).push(p);
  });
  var review45 = queue.filter(function (i) { return i.stage === 'CLIENT-45'; }).slice(0, 80).map(function (i) {
    var p = i.p, pi = portfolioIntel_(p, book);
    // NEW POLICY / REPLACEMENT SPOTTER
    var newPols = (nbIdx[p.clientNo] || []).filter(function (q) { return q.policy !== p.policy; });
    var replacement = newPols.length ? {
      count: newPols.length,
      detail: newPols.slice(0, 2).map(function (q) { return q.plan + ' (' + q.issue + ', ' + money_(q.premium) + ')'; }).join('; '),
      sameAgent: newPols.some(function (q) { return q.agent === p.agent; })
    } : null;
    // HOUSEHOLD at the same address
    var hh = (hIdx[lkAddrKey_(p.address)] || []).filter(function (q) { return q.clientNo !== p.clientNo; });
    var hSeen = {}, household = [];
    hh.forEach(function (q) {
      if (hSeen[q.clientNo]) return; hSeen[q.clientNo] = true;
      var theirs = book.filter(function (z) { return z.clientNo === q.clientNo && z.statusDesc === 'Premium Paying'; });
      var hp = 0; theirs.forEach(function (z) { hp += z.premium; });
      household.push({ client: titleCase_(q.client), clientNo: q.clientNo, agent: q.agent,
        detail: theirs.length + ' active · ' + money_(hp) + '/yr' +
                (theirs.filter(function (z) { return z.days >= 45; }).length ? ' · also in arrears' : '') });
    });
    return {
      policy: p.policy, clientNo: p.clientNo, client: titleCase_(p.client), agent: p.agent,
      days: p.days, premium: money_(p.premium), paidTo: p.paidTo, billing: p.billing || '—',
      lapseDate: p.lapseDate, phone: p.phone || '', email: p.email || '',
      beneficiary: p.beneficiary ? titleCase_(p.beneficiary) : '',
      replacement: replacement, household: household.slice(0, 6),
      intel: { active: pi.active, totalPremium: money_(pi.totalPremium), tenure: pi.tenure,
               priorLapses: pi.priorLapses, otherArrears: pi.otherArrears,
               flags: pi.flags.map(function (f) { return f.label; }).join(' · '),
               exSusp: (pi.ex && pi.ex.susp > 0) ? money_(pi.ex.susp) : '',
               exFunds3: !!(pi.ex && pi.ex.funds3) }
    };
  });
  // ★ Daily Actionable Insights — a real engine: pipeline money, per-agent
  // pressure, payment-method mix, export cross-checks. Computed fresh from
  // the whole queue every run, like the old dashboard but deeper.
  var EXI = exportIndex_();
  var buckets = { 'CLIENT-45': { n: 0, p: 0 }, 'CLIENT-60': { n: 0, p: 0 }, 'AGENT-75': { n: 0, p: 0 }, 'CLIENT-90': { n: 0, p: 0 } };
  var byAgentM = {}, byPayM = {}, qSusp = 0, qSuspN = 0, qOrphN = 0, qUndelN = 0, qFunds3 = 0;
  queue.forEach(function (i) {
    var p = i.p;
    buckets[i.stage].n++; buckets[i.stage].p += p.premium;
    var a = byAgentM[p.agent] = byAgentM[p.agent] || { n: 0, p: 0 };
    a.n++; a.p += p.premium;
    var bt = p.billing || '(unknown)';
    var pm = byPayM[bt] = byPayM[bt] || { n: 0, p: 0 };
    pm.n++; pm.p += p.premium;
    var ex = EXI.byPolicy[p.policy];
    if (ex) {
      if (ex.susp > 0) { qSusp += ex.susp; qSuspN++; }
      if (ex.agentStatus && ex.agentStatus.toLowerCase() !== 'active') qOrphN++;
      if (ex.undelivered) qUndelN++;
      if (ex.funds3) qFunds3++;
    }
  });
  var insights = [];
  var repN = review45.filter(function (x) { return x.replacement; }).length;
  if (repN) insights.push('⚠️ <b>' + repN + ' client(s) in the 45-day queue also bought a NEW policy in the last 2 years</b> — possible replacement/switch. Ask before you write; document the answer.');
  var hhN = review45.filter(function (x) { return x.household && x.household.length; }).length;
  if (hhN) insights.push('🏠 <b>' + hhN + ' queue client(s) have relatives at the same address on our book</b> — one household visit can rescue several policies and open a review.');
  if (qSuspN) insights.push('💰 <b>' + qSuspN + ' client(s) in the pipeline have ' + money_(qSusp) + ' sitting in suspense</b> — apply that money FIRST; some of these cases close themselves.');
  var oldest = review45.length ? review45.reduce(function (a, b) { return a.days >= b.days ? a : b; }) : null;
  if (oldest) insights.push('⏰ Oldest unworked 45-day case: <b>' + oldest.client + '</b> at <b>' + oldest.days + ' days</b> (' + oldest.premium + '/yr) — it crosses to the 60-day stage at 60.');
  var big = review45.slice().sort(function (a, b) { return num_(String(b.premium).replace(/[$,]/g, '')) - num_(String(a.premium).replace(/[$,]/g, '')); })[0];
  if (big) insights.push('💎 Biggest premium awaiting review: <b>' + big.client + '</b> at ' + big.premium + '/yr — a personal call beats a letter at this size.');
  if (qOrphN) insights.push('🧭 <b>' + qOrphN + ' pipeline client(s) belong to inactive/vested agents</b> — they are slipping with NOBODY chasing; prioritise and see Campaigns → Orphans for adopters.');
  if (qUndelN) insights.push('📦 <b>' + qUndelN + ' pipeline client(s) never received their policy documents</b> — deliver the contract on the same visit that fixes the premium.');
  if (qFunds3) insights.push('🛡️ <b>' + qFunds3 + ' pipeline policies can carry themselves</b> (fund covers 3 premiums) — APL keeps cover alive while the client catches up.');
  var pendMgr = acts.filter(function (a) { return a.status === 'Pending Manager'; }).length;
  if (pendMgr) insights.push('✅ <b>' + pendMgr + ' conservation form(s) await the manager</b> — the client plan copy only goes out after the response.');
  var noEmail = queue.filter(function (i) { return i.stage === 'CLIENT-45' && !i.p.email; }).length;
  if (noEmail) insights.push('✉️ <b>' + noEmail + ' queue client(s) have no email on file</b> — every address staff find is a client the machine can help save.');
  var dbill = byPayM['Direct Bill'];
  if (dbill && dbill.n) insights.push('🏦 <b>' + dbill.n + ' of the pipeline pay by Direct Bill</b> (' + money_(dbill.p) + '/yr) — the auto-pay conversion in every letter is aimed straight at them.');
  var agentTop = Object.keys(byAgentM).map(function (a) { return { agent: a, n: byAgentM[a].n, p: byAgentM[a].p }; })
    .sort(function (a, b) { return b.p - a.p; }).slice(0, 10)
    .map(function (a) { return { agent: a.agent, n: a.n, premium: money_(a.p) }; });
  var payMix = Object.keys(byPayM).map(function (k) { return { method: k, n: byPayM[k].n, p: byPayM[k].p }; })
    .sort(function (a, b) { return b.n - a.n; }).slice(0, 6)
    .map(function (x) { return { method: x.method, n: x.n, premium: money_(x.p) }; });
  var pipeline = ['CLIENT-45', 'CLIENT-60', 'AGENT-75', 'CLIENT-90'].map(function (s) {
    return { stage: s.replace('CLIENT-', '').replace('AGENT-', '') + 'd', n: buckets[s].n, premium: money_(buckets[s].p) };
  });
  var OUT = {
    ok: true, testMode: CONFIG.TEST_MODE, sendMode: CONFIG.SEND_MODE,
    counts: counts, queueTotal: queue.length, cap: CONFIG.DAILY_SEND_CAP,
    insights: insights, pipeline: pipeline, agentTop: agentTop, payMix: payMix,
    review45: review45,
    queue: queue.filter(function (i) { return i.stage !== 'CLIENT-45'; }).slice(0, 40).map(function (i) {
      return { stage: i.stage, policy: i.p.policy, client: titleCase_(i.p.client), agent: i.p.agent,
               days: i.p.days, email: i.p.email || '(none)' };
    }),
    recent: recent,
    pendingManager: acts.filter(function (a) { return a.status === 'Pending Manager'; }).length
  };
  cachePutJson_('v:dash', OUT);
  return OUT;
}
