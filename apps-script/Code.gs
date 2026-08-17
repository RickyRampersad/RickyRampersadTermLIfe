/**
 * Guardian Renewal Platform v2 — Google Apps Script backend
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1joDyJMrF0RrQCqt3A6iuFjbC2uzXB7P1ZhOxqyyjAkM
 *
 * CLIENT experience  (link: WEBAPP_URL?t=TOKEN)
 *   Guided renewal portal: MotorGuard benefits, value adjustment (comprehensive),
 *   payment update, renewal + adjusted-value history, instruction submission,
 *   post-renewal service survey (?t=TOKEN&survey=1).
 *
 * STAFF experience  (link: WEBAPP_URL?staff=STAFF_KEY)
 *   Dashboard: pipeline KPIs, tasks, comments, add renewal, mark renewed,
 *   resend invites. Every action is logged with the staff member's email in
 *   the Activity tab — that's the accountability trail.
 *
 * AUTOMATION (install from the Guardian Renewals menu, runs daily ~8am)
 *   T-30 educational invite → T-14 reminder → T-7 reminder → day-of →
 *   T+3 gentle overdue → T+7 final email + auto "call the client" task.
 *   No daily spam: after T+7 the pipeline goes human (phone beats inbox).
 *   Client instruction or staff "mark renewed" stops the sequence.
 *   7 days after "renewed", the client gets the QA survey.
 *
 * TEST MODE (Guardian Renewals menu → "🧪 Turn test mode ON")
 *   A Script Properties switch, so flipping it needs no redeploy. While ON:
 *   every email is rerouted to TEST_INBOX (default: you) with a [TEST]
 *   subject and a banner naming the real recipients; "Reminders Sent" and
 *   "Renewal Status" are never stamped, so live state stays untouched; and
 *   test responses, tasks and activity rows are marked TEST so they're easy
 *   to spot and delete. Clients can never receive test traffic.
 */

var CONFIG = {
  RENEWALS_GID: 2062860621,

  MAIL_TO: 'GuardianGeneralRenewals@myguardiangroup.com',
  MAIL_CC: [
    'ricky.rampersad@myguardiangroup.com',   // you
    'salessupport@myguardiangroup.com',      // sales support team
    'support@rickyrampersadbranch.com'       // personal support inbox
    // ,'crmsrenewals@myguardiangroup.com'   // carrier renewals desk — uncomment to copy them too
  ],

  FROM_NAME: 'Ricky Rampersad — Guardian Renewals',
  AGENT_NAME: 'Ricky Rampersad',
  AGENT_PHONE: '(868) 678-5921',

  // Deployed Apps Script web app (Deploy > New deployment > Web app).
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbwYQlLt1txn4pCWEq3xO_FmmPUfRAUMzey-vzbUe-qDr9tX27BpM0ZbkP5G0WuYQuZJ8g/exec',

  // Staff access key — the staff dashboard link is WEBAPP_URL?staff=THIS_KEY.
  // Set it ONLY in your Apps Script copy, never in this repository: this file
  // is served on the public website, so any value committed here is public.
  // The key that used to sit here was published and must be treated as burned —
  // set a fresh long private value in the Apps Script editor.
  STAFF_KEY: 'CHANGE-ME-in-Apps-Script-only',

  RESPONSES_SHEET: 'Renewal Responses',
  STAFF_SHEET: 'Staff',
  TASKS_SHEET: 'Tasks',
  ACTIVITY_SHEET: 'Activity',
  SURVEYS_SHEET: 'Surveys',

  SURVEY_DAYS_AFTER_RENEWAL: 7,

  // Test mode reroutes every email here instead of clients/Guardian.
  // Leave '' to use the account that owns the script (you).
  TEST_INBOX: '',
};

var BRAND = { navy: '#0d2137', ink: '#07131f', blue: '#00A8C5', teal: '#00CFEA', gold: '#efc24b', gold2: '#dca530', light: '#eef4fa' };

/* ============================ test mode ============================ */
// The switch lives in Script Properties (not code), so the deployed web app
// obeys it the moment it's flipped — no redeploy. Flip it from the sheet:
// Guardian Renewals menu → 🧪 Test mode.

function testMode_() {
  return PropertiesService.getScriptProperties().getProperty('TEST_MODE') === 'on';
}

function testInbox_() {
  return CONFIG.TEST_INBOX || Session.getEffectiveUser().getEmail();
}

// Single gate for ALL outgoing mail. Live: passes straight through.
// Test mode: reroutes to the test inbox with a [TEST] subject and a banner
// naming the real recipients; cc/bcc/replyTo are stripped so no reply or
// copy can leak toward a real client.
function sendMail_(opts) {
  if (!testMode_()) { MailApp.sendEmail(opts); return; }
  var would = 'To: ' + (opts.to || '(none)') + (opts.cc ? ' · CC: ' + opts.cc : '') + (opts.bcc ? ' · BCC: ' + opts.bcc : '');
  var o = {};
  for (var k in opts) o[k] = opts[k];
  delete o.cc; delete o.bcc; delete o.replyTo;
  o.to = testInbox_();
  o.subject = '[TEST] ' + (opts.subject || '');
  if (o.htmlBody) {
    o.htmlBody =
      '<div style="background:#b3261e;color:#fff;padding:10px 16px;border-radius:6px;margin:0 0 14px;font-family:Arial,sans-serif;font-size:13px">' +
      '<b>🧪 TEST MODE</b> — nothing was sent to the real recipients.<br>Would have gone to — ' + esc_(would) + '</div>' + o.htmlBody;
  }
  o.body = 'TEST MODE — would have gone to — ' + would + '\n\n' + (o.body || '');
  MailApp.sendEmail(o);
}

/* ============================ sheet plumbing ============================ */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function renewalsSheet_() {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++)
    if (sheets[i].getSheetId() === CONFIG.RENEWALS_GID) return sheets[i];
  throw new Error('Renewals tab (gid ' + CONFIG.RENEWALS_GID + ') not found.');
}

function namedSheet_(name, headers) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}
function responsesSheet_() {
  return namedSheet_(CONFIG.RESPONSES_SHEET, ['Timestamp','Token','Client','Policy #','Coverage','Next Due',
    'Instruction','Updated Vehicle Value (TT$)','Wants Comprehensive Quote','Changes / Notes',
    'Email','Mobile','Payment Method','Payment Reference','Emailed To','Status']);
}

/** Append a response row by header name, creating any missing columns. */
function appendResponse_(vals) {
  var sh = responsesSheet_();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  Object.keys(vals).forEach(function (h) {
    if (headers.indexOf(h) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      headers.push(h);
    }
  });
  sh.appendRow(headers.map(function (h) { return (h in vals) ? vals[h] : ''; }));
}

/** Guardian General "Request to Adjust Sums Insured / Policy Values/Limit"
 *  letter, pre-filled from the client's portal submission, as a PDF blob. */
function valueLetterBlob_(m, newValue, email, mobile, token) {
  var adjust = !!newValue;
  var cur = m.sumInsured ? Number(m.sumInsured).toLocaleString('en-US', {minimumFractionDigits: 2}) : '____________';
  var html =
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:13px;line-height:1.75;color:#111;padding:30px 36px">' +
    'Date: <b>' + nowStamp_() + '</b><br><br>' +
    'Guardian General Insurance Limited,<br>30-34 Newtown Centre, Maraval Road,<br>PORT OF SPAIN<br><br>' +
    '<b>Re: Request to Adjust Sums Insured / Policy Values/Limit</b><br><br>' +
    'Policy Number: <b>' + esc_(m.policy || '____________________') + '</b><br>' +
    'Insured Name: <b>' + esc_(m.client) + '</b><br><br>' +
    'Dear Sir/Madam,<br><br>I/we hereby request:<br>' +
    '<table style="font-size:13px;line-height:1.7"><tr><td style="vertical-align:top;padding-right:8px;font-size:16px">' + (adjust ? '&#9744;' : '&#9745;') + '</td>' +
    '<td>No adjustment to the sum insured and therefore wish to continue with a value of <b>$' + (adjust ? '____________' : cur) + '</b></td></tr>' +
    '<tr><td style="vertical-align:top;padding-right:8px;font-size:16px">' + (adjust ? '&#9745;' : '&#9744;') + '</td>' +
    '<td>An adjustment to the sums insured/values/limit on my/our insurance policy referenced above.</td></tr></table><br>' +
    'I/we understand that this adjustment may result in a change to the premium and other policy terms and conditions.<br><br>' +
    (adjust ?
      ('Please find below the revised sums insured/values/limit that I/we wish to apply:<br><br>' +
       '&nbsp;&nbsp;Current Sum Insured/Value/Limit: <b>$' + cur + '</b><br>' +
       '&nbsp;&nbsp;Requested New Sum Insured/Value/Limit: <b>$' + Number(newValue).toLocaleString('en-US', {minimumFractionDigits: 2}) + '</b><br><br>') : '') +
    'I/we confirm that the information provided is true and accurate to the best of my/our knowledge and agree that the insurer may rely on this request to update the policy accordingly.<br><br>' +
    'Kindly process this adjustment effective from: <b>' + esc_(m.nextDue || '____________________') + '</b> (date).<br><br>' +
    'Should you require any additional information or documentation, please feel free to contact me/us at your earliest convenience.<br><br>' +
    'Thank you for your attention and assistance.<br><br>Sincerely,<br><br><br>' +
    'Signature: _______________________________ &nbsp;&nbsp;&nbsp; Contact Number: <b>' + esc_(mobile || '___________________') + '</b><br><br>' +
    'Name: <b>' + esc_(m.contact || m.client) + '</b> &nbsp;&nbsp;&nbsp; Email Address: <b>' + esc_(email || '_______________________') + '</b><br><br>' +
    'ID/DP/BRN: _____________________________<br><br>' +
    '<span style="font-size:10px;color:#666">Prepared from the insured\'s electronic submission via the Guardian Renewals portal on ' + nowStamp_() + ' (ref ' + esc_(token || '') + '). Signature to be completed by the insured.</span>' +
    '</div>';
  return Utilities.newBlob(html, 'text/html', 'letter.html').getAs('application/pdf')
    .setName('Value Confirmation - ' + (m.policy || m.client).replace(/[^\w \-]/g, '') + '.pdf');
}
function staffSheet_() {
  var sh = ss_().getSheetByName(CONFIG.STAFF_SHEET);
  if (!sh) {
    sh = namedSheet_(CONFIG.STAFF_SHEET, ['Email','Name','Role','Active']);
    sh.appendRow([Session.getEffectiveUser().getEmail(), CONFIG.AGENT_NAME, 'admin', 'Y']);
  }
  return sh;
}
function tasksSheet_() {
  return namedSheet_(CONFIG.TASKS_SHEET, ['ID','Created','Due','Assigned To','Client','Token',
    'Title','Status','Created By','Completed','Completed By']);
}
function activitySheet_() {
  return namedSheet_(CONFIG.ACTIVITY_SHEET, ['Timestamp','Token','Client','Type','By','Details']);
}
function surveysSheet_() {
  return namedSheet_(CONFIG.SURVEYS_SHEET, ['Timestamp','Token','Client','Policy #',
    'Satisfaction (1-5)','Ease (1-5)','Comments','Speed (1-5)']);
}

/* Client-visible communication timeline, built from the Activity trail.
 * Internal entries (staff comments, task work, assignments) never reach the
 * client — only touchpoints the client themselves sent or received. */
var COMM_LABELS = {
  'invite-sent':            { label: 'Renewal invitation emailed to you', from: 'us' },
  'property-invite':        { label: 'Renewal invitation emailed to you', from: 'us' },
  'client-instruction':     { label: 'Your renewal instruction received', from: 'you' },
  'property-instruction':   { label: 'Your renewal instruction received', from: 'you' },
  'property-stage':         { label: 'Progress update emailed to you', from: 'us' },
  'rate-review-requested':  { label: 'We asked Guardian to review your rate', from: 'us' },
  'renewed':                { label: 'Renewal confirmed', from: 'us' },
  'survey-sent':            { label: 'Feedback request emailed to you', from: 'us' },
  'survey':                 { label: 'Your feedback received — thank you', from: 'you' },
};
function commsForToken_(token) {
  token = String(token || '').trim();
  if (!token) return [];
  var sh = activitySheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues()
    .filter(function (r) { return String(r[1]).trim() === token; })
    .map(function (r) {
      var type = String(r[3]).replace(/^TEST:/, '');
      var meta = COMM_LABELS[type] ||
        (type.indexOf('reminder-') === 0 ? { label: 'Renewal reminder emailed to you', from: 'us' } : null);
      if (!meta) return null;
      return { when: fmtDate_(r[0]), label: meta.label, from: meta.from,
               detail: String(r[5] || '').slice(0, 160) };
    })
    .filter(function (x) { return !!x; })
    .reverse().slice(0, 30);
}

function headerMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) { map[String(h).trim().toLowerCase()] = i; });
  return map;
}
function col_(map, name) {
  var k = name.toLowerCase();
  if (k in map) return map[k];
  for (var key in map) if (key.indexOf(k) === 0) return map[key];
  return -1;
}
/** Adds any missing operational columns to the renewals tab. */
function ensureRenewalCols_() {
  var sh = renewalsSheet_();
  var map = headerMap_(sh);
  ['Reminders Sent', 'Renewed Date', 'Assigned To'].forEach(function (h) {
    if (col_(map, h) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      map = headerMap_(sh);
    }
  });
  return map;
}

function fmtDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]')
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd MMM yyyy');
  return String(v);
}
function asDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
function daysUntil_(v) {
  var d = asDate_(v);
  if (!d) return null;
  var t = new Date(); t.setHours(0,0,0,0);
  var dd = new Date(d); dd.setHours(0,0,0,0);
  return Math.round((dd - t) / 86400000);
}
function fmtMoney_(v) {
  var n = Number(v);
  if (!v && v !== 0) return '';
  if (isNaN(n)) return String(v);
  return 'TT$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function nowStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy');
}

/* ============================ data access ============================ */

function rowObj_(r, map, rowIndex) {
  return {
    rowIndex: rowIndex,
    client:   String(r[col_(map, 'client account')] || ''),
    contact:  String(r[col_(map, 'contact')] || ''),
    coverage: String(r[col_(map, 'coverage')] || ''),
    nextDue:  fmtDate_(r[col_(map, 'next due')]),
    nextDueRaw: r[col_(map, 'next due')],
    days:     daysUntil_(r[col_(map, 'next due')]),
    sumInsured: r[col_(map, 'sum insured')] || '',
    premium:  r[col_(map, 'premium')] || 0,
    paid:     r[col_(map, 'paid')] || 0,
    balance:  r[col_(map, 'balance owing')] || 0,
    payStatus: String(r[col_(map, 'payment status')] || ''),
    policy:   String(r[col_(map, 'policy')] || ''),
    mobile:   String(r[col_(map, 'mobile')] || ''),
    email:    String(r[col_(map, 'email')] || ''),
    renewalStatus: String(r[col_(map, 'renewal status')] || ''),
    remindersSent: String(r[col_(map, 'reminders sent')] || ''),
    renewedDate: fmtDate_(r[col_(map, 'renewed date')]),
    assignedTo: String(r[col_(map, 'assigned to')] || ''),
    token: String(r[col_(map, 'token')] || ''),
  };
}

function allRenewals_() {
  var sh = renewalsSheet_();
  var map = ensureRenewalCols_();
  if (sh.getLastRow() < 2) return [];
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return data.map(function (r, i) { return rowObj_(r, map, i + 2); });
}

function rowsForToken_(token) {
  token = String(token || '').trim();
  if (!token) return [];
  return allRenewals_().filter(function (r) { return r.token === token; });
}

function historyForToken_(token) {
  var sh = responsesSheet_();
  if (sh.getLastRow() < 2) return [];
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return data.filter(function (r) { return String(r[1]).trim() === String(token).trim(); })
    .map(function (r) {
      return {
        when: fmtDate_(r[0]),
        policy: String(r[3] || ''),
        coverage: String(r[4] || ''),
        instruction: String(r[6] || ''),
        value: r[7] ? fmtMoney_(r[7]) : '',
        valueRaw: r[7] || '',
        payMethod: String(r[12] || ''),
        payRef: String(r[13] || ''),
        status: String(r[15] || 'Received'),
      };
    }).reverse();
}

/** Adjusted-value history for comprehensive policies (from client submissions). */
function valueHistory_(token, policy) {
  return historyForToken_(token).filter(function (h) {
    return h.valueRaw && (!policy || h.policy === policy);
  }).map(function (h) { return { when: h.when, value: h.value }; });
}

/* ---------- vehicle risk details (imported "Risk Details" tab) ---------- */

/**
 * Normalises a client/account name so the same person matches across tabs
 * regardless of order or house-style: "RAMCHARITAR, AKASH HH" and
 * "Akash Ramcharitar" both become "AKASH RAMCHARITAR".
 * Words are sorted so surname-first and first-name-first agree.
 */
function normName_(s) {
  return String(s || '').toUpperCase()
    .replace(/\b(HOUSEHOLD|HH|REVISED|LTD|LIMITED|LTEE|INC|COMPANY|CO|THE|ESTATE|OF)\b/g, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .split(/ +/).filter(function (w) { return w.length > 1; })
    .sort().join(' ');
}

/**
 * Builds three lookups over the "Risk Details" tab so a client's vehicles can
 * be found by (in order of reliability):
 *   1. Token  — exact, and the only key that is guaranteed unique
 *   2. Email  — exact
 *   3. Name   — normalised (see normName_)
 * Token wins because names and emails are shared across household accounts.
 */
var _riskMap = null;
function riskLookup_() {
  if (_riskMap) return _riskMap;
  _riskMap = { byToken: {}, byEmail: {}, byName: {} };
  var sh = ss_().getSheetByName('Risk Details');
  if (!sh || sh.getLastRow() < 2) return _riskMap;
  var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var idx = {};
  vals[0].forEach(function (h, i) { idx[String(h).trim().toLowerCase()] = i; });
  function g(r, n) { var i = idx[n]; return i === undefined ? '' : r[i]; }
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    var nameKey = normName_(g(r, 'client'));
    var tokKey = String(g(r, 'token') || '').trim();
    var mailKey = String(g(r, 'email') || '').trim().toLowerCase();
    if (!nameKey && !tokKey) continue;
    var rec = {
      reg: String(g(r, 'vehicle reg') || '').trim(),
      make: String(g(r, 'make') || '').trim(),
      model: String(g(r, 'model') || '').trim(),
      year: String(g(r, 'year') || '').trim(),
      chassis: String(g(r, 'chassis #') || '').trim(),
      engine: String(g(r, 'engine #') || '').trim(),
      cover: String(g(r, 'coverage type') || '').trim(),
      value: g(r, 'insured value (tt$)') || '',
      ncd: String(g(r, 'ncd %') || '').trim(),
      windscreen: g(r, 'windscreen (tt$)') || '',
      depreciation: String(g(r, 'depreciation %') || '').trim(),
      policy: String(g(r, 'policy #') || '').trim(),
      carrier: String(g(r, 'carrier') || '').trim(),
      from: fmtDate_(g(r, 'from')), to: fmtDate_(g(r, 'to')),
      toKey: String(g(r, 'to') || ''),
      status: String(g(r, 'vehicle status') || '').trim(),
      since: fmtDate_(g(r, 'vehicle first insured')),
      years: String(g(r, 'years insured') || '').trim(),
      address: String(g(r, 'address') || '').trim(),
    };
    if (tokKey) (_riskMap.byToken[tokKey] = _riskMap.byToken[tokKey] || []).push(rec);
    if (mailKey) (_riskMap.byEmail[mailKey] = _riskMap.byEmail[mailKey] || []).push(rec);
    if (nameKey) (_riskMap.byName[nameKey] = _riskMap.byName[nameKey] || []).push(rec);
  }
  return _riskMap;
}

/** Latest comprehensive insured value on record for a client (Risk Details tab). */
function latestCompValue_(clientName, token, email) {
  var vs = vehiclesForClient_(clientName, token, email);
  for (var i = 0; i < vs.length; i++) if (vs[i].comp && vs[i].value) return vs[i].value;
  return '';
}

/** Vehicles on record for a client, grouped by registration, latest details +
 *  insured-value history. Values only surface for comprehensive cover.
 *  Looks up by token first (exact), then email, then normalised name. */
function vehiclesForClient_(clientName, token, email) {
  var map = riskLookup_();
  var rows = (token && map.byToken[String(token).trim()])
          || (email && map.byEmail[String(email).trim().toLowerCase()])
          || map.byName[normName_(clientName)]
          || [];
  var groups = {};
  rows.forEach(function (v) {
    var k = (v.reg || v.chassis || '?').replace(/\s+/g, '').toUpperCase();
    (groups[k] = groups[k] || []).push(v);
  });
  var out = [];
  Object.keys(groups).forEach(function (k) {
    if (k === '?') return;
    var g = groups[k].sort(function (a, b) { return String(a.toKey).localeCompare(String(b.toKey)); });
    function last(field) {
      for (var i = g.length - 1; i >= 0; i--) if (g[i][field]) return g[i][field];
      return '';
    }
    var comp = /comprehensive/i.test(last('cover'));
    out.push({
      reg: last('reg'), make: last('make'), model: last('model'), year: last('year'),
      chassis: last('chassis'), engine: last('engine'), cover: last('cover'),
      ncd: last('ncd'), windscreen: comp ? last('windscreen') : '',
      depreciation: comp ? last('depreciation') : '',
      policy: last('policy'), carrier: last('carrier'),
      periodTo: last('to'), comp: comp,
      since: last('since'), years: last('years'), address: last('address'),
      value: comp ? last('value') : '',
      valueHistory: comp ? g.filter(function (x) { return x.value; })
        .map(function (x) { return { when: x.to || x.from, value: fmtMoney_(x.value) }; }) : [],
    });
  });
  return out;
}

function logActivity_(token, client, type, by, details) {
  activitySheet_().appendRow([new Date(), token, client, (testMode_() ? 'TEST:' : '') + type,
    by || 'system', String(details || '').slice(0, 900)]);
}

/* ============================ web app routing ============================ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.staff) return staffPage_(p);
  if (p.p && typeof propertyPage_ === 'function') return propertyPage_(p);   // property links (?p=TOKEN)
  return clientPage_(p);
}

function clientPage_(p) {
  var token = String(p.t || '');
  var rows = rowsForToken_(token);
  var t = HtmlService.createTemplateFromFile('Portal');
  t.payload = JSON.stringify({
    ok: rows.length > 0,
    survey: String(p.survey || '') === '1',
    token: token,
    firstName: rows.length ? (rows[0].contact || rows[0].client).split(' ')[0] : '',
    client: rows.length ? rows[0].client : '',
    policies: rows.map(function (r) {
      var comp = /comprehensive/i.test(r.coverage);
      return {
        rowIndex: r.rowIndex, coverage: r.coverage, comp: comp,
        nextDue: r.nextDue, days: r.days, premium: r.premium,
        // third party: no values; comprehensive: sheet value, else latest from Risk Details
        sumInsured: comp ? (r.sumInsured || latestCompValue_(r.client, r.token, r.email)) : '',
        balance: r.balance, payStatus: r.payStatus,
        policy: r.policy, mobile: r.mobile, email: r.email,
        renewalStatus: r.renewalStatus,
        valueHistory: comp ? valueHistory_(token, r.policy) : [],
      };
    }),
    history: token ? historyForToken_(token) : [],
    comms: token ? commsForToken_(token) : [],
    vehicles: rows.length ? vehiclesForClient_(rows[0].client, rows[0].token, rows[0].email) : [],
    agent: { name: CONFIG.AGENT_NAME, phone: CONFIG.AGENT_PHONE },
  });
  return t.evaluate().setTitle('Guardian Group — Policy Renewal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function staffPage_(p) {
  var t = HtmlService.createTemplateFromFile('Staff');
  var authorized = String(p.staff) === CONFIG.STAFF_KEY;
  t.payload = JSON.stringify({ ok: authorized, key: authorized ? CONFIG.STAFF_KEY : '' });
  return t.evaluate().setTitle('Guardian Renewals — Staff')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ============================ client API ============================ */

function submitInstruction(payload) {
  payload = payload || {};
  var token = String(payload.token || '').trim();
  var rows = rowsForToken_(token);
  if (!rows.length) throw new Error('We could not find your policy. Please use the link from your renewal email.');

  var match = rows.filter(function (r) { return String(r.rowIndex) === String(payload.rowIndex); })[0] || rows[0];
  var instruction = String(payload.instruction || '').slice(0, 100);
  var newValue = payload.newValue ? Number(String(payload.newValue).replace(/[^0-9.]/g, '')) : '';
  var wantsComp = payload.wantsComp ? 'YES' : '';
  var waiver = payload.waiver ? 'YES' : '';
  var windscreen = payload.windscreen ? 'YES' : '';
  var notes = String(payload.notes || '').slice(0, 2000);
  var email = String(payload.email || match.email || '').slice(0, 200);
  var mobile = String(payload.mobile || match.mobile || '').slice(0, 60);
  var payMethod = String(payload.payMethod || '').slice(0, 60);
  var payRef = String(payload.payRef || '').slice(0, 120);
  var isComp = /comprehensive/i.test(match.coverage);

  var cc = CONFIG.MAIL_CC.filter(String).join(',');
  appendResponse_({
    'Timestamp': new Date(), 'Token': token, 'Client': match.client,
    'Policy #': match.policy || '(not on file)', 'Coverage': match.coverage,
    'Next Due': match.nextDue, 'Instruction': instruction,
    'Updated Vehicle Value (TT$)': newValue, 'Wants Comprehensive Quote': wantsComp,
    'Changes / Notes': notes, 'Email': email, 'Mobile': mobile,
    'Payment Method': payMethod, 'Payment Reference': payRef,
    'Emailed To': testMode_() ? testInbox_() + ' (TEST MODE)' : CONFIG.MAIL_TO + (cc ? ' cc ' + cc : ''),
    'Status': testMode_() ? 'TEST' : 'Received',
    'Waiver of Excess': waiver, 'Windscreen Cover': windscreen,
  });

  // pre-filled Guardian General value-confirmation letter (comprehensive only)
  var letter = null;
  if (isComp && instruction.indexOf('PLEASE CALL') < 0) {
    try {
      if (!match.sumInsured) match.sumInsured = latestCompValue_(match.client, match.token, match.email);
      letter = valueLetterBlob_(match, newValue, email, mobile, token);
    } catch (err) {}
  }

  // stamp the policy row — skipped in test mode: this stamp is what stops
  // the reminder ladder, so a test submission must never silence a real client
  if (!testMode_()) {
    try {
      var sh = renewalsSheet_();
      var map = ensureRenewalCols_();
      sh.getRange(match.rowIndex, col_(map, 'renewal status') + 1)
        .setValue(instruction + ' — ' + nowStamp_());
    } catch (err) {}
  }

  logActivity_(token, match.client, 'client-instruction', 'client',
    instruction + (newValue ? ' · value ' + fmtMoney_(newValue) : '') +
    (waiver ? ' · +WAIVER OF EXCESS' : '') + (windscreen ? ' · +WINDSCREEN' : '') +
    (wantsComp ? ' · wants comprehensive quote' : '') + (payMethod ? ' · pay: ' + payMethod : ''));

  // notify renewals team
  var subject = 'RENEWAL INSTRUCTION — ' + match.client + (match.policy ? ' — ' + match.policy : '') + ' — ' + instruction;
  sendMail_({
    to: CONFIG.MAIL_TO, cc: cc, replyTo: email || undefined, name: CONFIG.FROM_NAME,
    subject: subject,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433">' +
      '<div style="background:' + BRAND.navy + ';color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">' +
      '<b>Client renewal instruction received via portal</b></div>' +
      '<table style="border-collapse:collapse;width:100%;max-width:640px">' +
      tr_('Client', esc_(match.client)) + tr_('Contact person', esc_(match.contact)) +
      tr_('Policy #', esc_(match.policy || '(not on file)')) + tr_('Coverage', esc_(match.coverage)) +
      tr_('Renewal due', esc_(match.nextDue)) + tr_('Premium', fmtMoney_(match.premium)) +
      tr_('Balance owing', fmtMoney_(match.balance) + (Number(match.balance) > 0 ? '  ⚠️' : '')) +
      tr_('<b>INSTRUCTION</b>', '<b>' + esc_(instruction) + '</b>') +
      (newValue ? tr_('Updated vehicle value', fmtMoney_(newValue) + ' — signed confirmation letter attached') : '') +
      (isComp ? tr_('<b>Waiver of Excess</b>', waiver ? '<b>YES — client requests the Waiver of Excess benefit (quote & bill the difference)</b>' : 'Declined / not selected') : '') +
      (windscreen ? tr_('<b>Windscreen (TP)</b>', '<b>YES — client requests the NEW third-party windscreen cover (quote & bill)</b>') : '') +
      (wantsComp ? tr_('Upsell', 'Client requests a COMPREHENSIVE quote') : '') +
      (payMethod ? tr_('Payment method', esc_(payMethod)) : '') +
      (payRef ? tr_('Payment reference', esc_(payRef)) : '') +
      (notes ? tr_('Client notes', esc_(notes)) : '') +
      tr_('Client email', esc_(email || '(none)')) + tr_('Client mobile', esc_(mobile || '(none)')) +
      '</table><p style="color:#5a6b80;font-size:12px">Via Guardian renewal portal (token ' + esc_(token) + ').' +
      (letter ? ' Pre-filled Guardian General value-confirmation letter attached.' : '') + '</p></div>',
    attachments: letter ? [letter] : [],
  });

  // confirmation to client
  if (email) {
    sendMail_({
      to: email, name: CONFIG.FROM_NAME,
      subject: 'We received your renewal instruction — ' + (match.policy || match.coverage),
      htmlBody: brandWrap_(
        '<p>Dear ' + esc_((match.contact || match.client).split(' ')[0]) + ',</p>' +
        '<p>Thank you — we received your instruction: <b>' + esc_(instruction) + '</b>' +
        (match.policy ? ' for policy <b>' + esc_(match.policy) + '</b>' : '') + '.</p>' +
        (waiver ? eduBox_('You asked to add the <b>Waiver of Excess</b> benefit — we will include it in your renewal terms and confirm the premium difference with you before anything is billed.') : '') +
        (windscreen ? eduBox_('You asked to add the new <b>windscreen cover</b> — we will include it in your renewal terms and confirm the premium difference with you.') : '') +
        (letter ? '<p>Attached is your pre-filled <b>value confirmation letter</b> for Guardian General — please check it, <b>sign it, and reply to this email with a photo or scan</b> (or bring it to the branch).</p>' : '') +
        (Number(match.balance) > 0 ?
          eduBox_('A balance of <b>' + fmtMoney_(match.balance) + '</b> shows on this policy. Renewal completes once it is settled — contact us about payment options.') : '') +
        '<p>Our renewals team will be in touch to complete everything. Nothing is bound until we confirm.</p>' + sig_(),
        'Renewal confirmation'),
      attachments: letter ? [letter] : [],
    });
  }
  return { ok: true, history: historyForToken_(token) };
}

function submitSurvey(payload) {
  payload = payload || {};
  var token = String(payload.token || '').trim();
  // one survey endpoint for both books: motor first, property fallback
  var rows = rowsForToken_(token);
  if (!rows.length && typeof propByToken_ === 'function') rows = propByToken_(token) || [];
  if (!rows.length) throw new Error('We could not find your policy link.');
  var sat = Math.max(1, Math.min(5, Number(payload.sat) || 0));
  var ease = Math.max(1, Math.min(5, Number(payload.ease) || 0));
  var speed = Math.max(0, Math.min(5, Number(payload.speed) || 0));
  var comments = String(payload.comments || '').slice(0, 2000);
  surveysSheet_().appendRow([new Date(), token, rows[0].client, rows[0].policy, sat, ease,
    (testMode_() ? '[TEST] ' : '') + comments, speed || '']);
  logActivity_(token, rows[0].client, 'survey', 'client', 'Satisfaction ' + sat + '/5 · Ease ' + ease + '/5' +
    (speed ? ' · Speed ' + speed + '/5' : '') + (comments ? ' · "' + comments.slice(0, 120) + '"' : ''));
  if (sat <= 3 || (speed && speed <= 3)) {   // service recovery: low score → immediate staff task
    createTask_('Service recovery call — survey score ' + sat + '/5' + (speed ? ' (speed ' + speed + '/5)' : ''),
      '', rows[0].assignedTo || '', rows[0].client, token, 'system');
  }
  return { ok: true };
}

/* ============================ staff auth + API ============================ */

function staffList_() {
  var sh = staffSheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
    .filter(function (r) { return String(r[3]).toUpperCase() !== 'N' && String(r[0]).indexOf('@') > 0; })
    .map(function (r) { return { email: String(r[0]).trim().toLowerCase(), name: String(r[1] || r[0]), role: String(r[2] || 'staff') }; });
}

function requireStaff_(key, me) {
  if (String(key) !== CONFIG.STAFF_KEY) throw new Error('Invalid staff link.');
  me = String(me || '').trim().toLowerCase();
  var found = staffList_().filter(function (s) { return s.email === me; })[0];
  if (!found) throw new Error('Your email is not on the Staff sheet — ask an admin to add you.');
  return found;
}

function staffData(key, me, isLogin) {
  var staff = requireStaff_(key, me);
  // isLogin is passed only on the dashboard's first load, so the Activity
  // trail records every sign-in without logging every screen refresh
  if (isLogin) logActivity_('', staff.name, 'login', staff.email, 'Signed in to the staff dashboard (' + staff.role + ')');
  var renewals = allRenewals_().map(function (r) {
    r.nextDueRaw = undefined;   // keep payload serializable
    return r;
  });

  // last touch per token (accountability)
  var act = activitySheet_();
  var lastTouch = {}, feed = [];
  if (act.getLastRow() > 1) {
    var rows = act.getRange(2, 1, act.getLastRow() - 1, 6).getValues();
    rows.forEach(function (a) {
      var tok = String(a[1]);
      lastTouch[tok] = { when: fmtDate_(a[0]), by: String(a[4]), type: String(a[3]) };
    });
    feed = rows.slice(-60).reverse().map(function (a) {
      return { when: fmtDate_(a[0]), client: String(a[2]), type: String(a[3]), by: String(a[4]), details: String(a[5]) };
    });
  }

  // tasks
  var tsh = tasksSheet_();
  var tasks = [];
  if (tsh.getLastRow() > 1) {
    tasks = tsh.getRange(2, 1, tsh.getLastRow() - 1, 11).getValues().map(function (t) {
      return { id: String(t[0]), created: fmtDate_(t[1]), due: fmtDate_(t[2]), dueDays: daysUntil_(t[2]),
               assignee: String(t[3]), client: String(t[4]), token: String(t[5]),
               title: String(t[6]), status: String(t[7]), createdBy: String(t[8]),
               completed: fmtDate_(t[9]), completedBy: String(t[10]) };
    });
  }

  // surveys
  var ssh = surveysSheet_();
  var surveys = { count: 0, avgSat: 0, avgEase: 0, recent: [] };
  if (ssh.getLastRow() > 1) {
    var sv = ssh.getRange(2, 1, ssh.getLastRow() - 1, 7).getValues();
    surveys.count = sv.length;
    surveys.avgSat = Math.round(sv.reduce(function (s, r) { return s + Number(r[4] || 0); }, 0) / sv.length * 10) / 10;
    surveys.avgEase = Math.round(sv.reduce(function (s, r) { return s + Number(r[5] || 0); }, 0) / sv.length * 10) / 10;
    surveys.recent = sv.slice(-8).reverse().map(function (r) {
      return { when: fmtDate_(r[0]), client: String(r[2]), sat: r[4], ease: r[5], comments: String(r[6]) };
    });
  }

  // vehicle details per token (from the imported "Risk Details" tab)
  var vehiclesByToken = {};
  var seenTok = {};
  renewals.forEach(function (r) {
    if (!r.token || seenTok[r.token]) return;
    seenTok[r.token] = 1;
    var v = vehiclesForClient_(r.client, r.token, r.email);
    if (v.length) vehiclesByToken[r.token] = v;
  });

  return {
    me: staff, staff: staffList_(), renewals: renewals, tasks: tasks,
    lastTouch: lastTouch, feed: feed, surveys: surveys,
    vehicles: vehiclesByToken,
    properties: (typeof propertyPipeline_ === 'function') ? propertyPipeline_() : [],
    propStages: (typeof propertyStages_ === 'function') ? propertyStages_() : [],
    portalBase: CONFIG.WEBAPP_URL,
  };
}

function createTask_(title, due, assignee, client, token, by) {
  var id = 'T' + new Date().getTime().toString(36);
  if (testMode_()) title = '[TEST] ' + title;
  tasksSheet_().appendRow([id, new Date(), due ? new Date(due) : '', assignee, client, token,
    String(title).slice(0, 300), 'Open', by, '', '']);
  logActivity_(token, client, 'task-created', by, title + (assignee ? ' → ' + assignee : ''));
  return id;
}

function staffAction(key, me, action, params) {
  var staff = requireStaff_(key, me);
  params = params || {};
  var sh, map;

  switch (action) {
    case 'comment': {
      logActivity_(params.token, params.client, 'comment', staff.email, params.text);
      break;
    }
    case 'addTask': {
      createTask_(params.title, params.due, params.assignee || staff.email, params.client || '', params.token || '', staff.email);
      break;
    }
    case 'completeTask': {
      var tsh = tasksSheet_();
      var data = tsh.getRange(2, 1, Math.max(tsh.getLastRow() - 1, 1), 11).getValues();
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][0]) === String(params.id)) {
          tsh.getRange(i + 2, 8).setValue('Done');
          tsh.getRange(i + 2, 10).setValue(new Date());
          tsh.getRange(i + 2, 11).setValue(staff.email);
          logActivity_(String(data[i][5]), String(data[i][4]), 'task-done', staff.email, String(data[i][6]));
          break;
        }
      }
      break;
    }
    case 'markRenewed': {
      sh = renewalsSheet_(); map = ensureRenewalCols_();
      sh.getRange(Number(params.rowIndex), col_(map, 'renewal status') + 1).setValue('RENEWED — ' + nowStamp_());
      sh.getRange(Number(params.rowIndex), col_(map, 'renewed date') + 1).setValue(new Date());
      logActivity_(params.token, params.client, 'renewed', staff.email, 'Marked renewed');
      // "How did we do?" goes out the moment the renewal is confirmed.
      // The stamp keeps the daily +7d catcher from sending it twice.
      try {
        var srow = allRenewals_().filter(function (x) { return x.rowIndex === Number(params.rowIndex); })[0];
        if (srow && srow.email) {
          sendSurveyEmail_(srow);
          var cRem = col_(map, 'reminders sent');
          if (cRem >= 0 && !testMode_()) {
            var st0 = String(sh.getRange(Number(params.rowIndex), cRem + 1).getValue() || '');
            if (st0.indexOf('survey@') < 0)
              sh.getRange(Number(params.rowIndex), cRem + 1).setValue((st0 ? st0 + '; ' : '') + 'survey@' + nowStamp_());
          }
          logActivity_(params.token, params.client, 'survey-sent', 'system', 'On renewal confirmation');
        }
      } catch (err) { Logger.log('survey on markRenewed: ' + err); }
      break;
    }
    case 'assign': {
      sh = renewalsSheet_(); map = ensureRenewalCols_();
      sh.getRange(Number(params.rowIndex), col_(map, 'assigned to') + 1).setValue(params.assignee || '');
      logActivity_(params.token, params.client, 'assigned', staff.email, '→ ' + (params.assignee || '(unassigned)'));
      break;
    }
    case 'resendInvite': {
      var rows = allRenewals_().filter(function (r) { return r.rowIndex === Number(params.rowIndex); });
      if (rows.length && rows[0].email) {
        sendStageEmail_(rows[0], 'manual');
        logActivity_(rows[0].token, rows[0].client, 'invite-sent', staff.email, 'Manual resend');
      } else throw new Error('No email on file for this row.');
      break;
    }
    case 'addRenewal': {
      sh = renewalsSheet_(); map = ensureRenewalCols_();
      var token = Utilities.getUuid().replace(/-/g, '').slice(0, 8);
      var newRow = new Array(sh.getLastColumn()).fill('');
      function set(name, v) { var c = col_(map, name); if (c >= 0) newRow[c] = v; }
      set('next due', params.nextDue ? new Date(params.nextDue) : '');
      set('days left', params.nextDue ? daysUntil_(params.nextDue) : '');
      set('client account', params.client); set('contact', params.contact);
      set('coverage', params.coverage); set('sum insured', params.sumInsured || '');
      set('premium', params.premium || ''); set('policy', params.policy || '');
      set('mobile', params.mobile || ''); set('email', params.email || '');
      set('assigned to', params.assignee || staff.email);
      set('token', token);
      if (CONFIG.WEBAPP_URL) set('portal link', portalLink_(token));
      sh.appendRow(newRow);
      logActivity_(token, params.client, 'renewal-added', staff.email,
        (params.coverage || '') + ' due ' + (params.nextDue || '?'));
      break;
    }
    case 'propStage': {
      advancePropertyStage(params.token, params.stage, params.note || '', staff.email);
      break;
    }
    case 'propInvite': {
      sendPropertyInviteByToken_(params.token, staff.email);
      break;
    }
    case 'propRateReview': {
      sendRateReviewEmail_(params.token, staff.email);
      break;
    }
    case 'propAssign': {
      var pr = propByToken_(params.token);
      if (!pr) throw new Error('Property renewal not found.');
      pr.forEach(function (x) { setPropCell_(x.rowIndex, 'assigned to', params.assignee || ''); });
      logActivity_(params.token, pr[0].client, 'assigned', staff.email, 'property → ' + (params.assignee || '(unassigned)'));
      break;
    }
    default: throw new Error('Unknown action: ' + action);
  }
  return staffData(key, me);
}

/* ============================ emails ============================ */

function tr_(k, v) {
  return '<tr><td style="padding:7px 12px;background:#f4f7fa;border:1px solid #e3eaf2;width:190px;color:#5a6b80">' +
    k + '</td><td style="padding:7px 12px;border:1px solid #e3eaf2">' + v + '</td></tr>';
}
function brandWrap_(inner, tag) {
  var badge = /propert/i.test(tag || '') ? 'PROPERTY RENEWAL' : 'MOTOR RENEWAL';
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433;max-width:640px">' +
    '<div style="background:' + BRAND.ink + ';color:#fff;padding:18px 22px;border-radius:12px 12px 0 0;border-bottom:3px solid ' + BRAND.gold + '">' +
    '<table width="100%"><tr>' +
    '<td width="46" valign="middle"><table cellpadding="0" cellspacing="0"><tr><td style="width:38px;height:38px;background:' + BRAND.gold + ';border-radius:8px 8px 15px 15px;text-align:center;font-size:22px;font-weight:bold;color:' + BRAND.ink + '">✓</td></tr></table></td>' +
    '<td valign="middle" style="padding-left:12px"><b style="font-size:17px;color:' + BRAND.gold + ';letter-spacing:.3px">Ricky Rampersad Branch</b><br>' +
    '<span style="color:#a9bbcf;font-size:12px">' + (tag || 'Policy renewal') + ' · Guardian Group</span></td>' +
    '<td align="right" style="color:' + BRAND.teal + ';font-size:11px;letter-spacing:2px"><b>' + badge + '</b></td></tr></table></div>' +
    '<div style="border:1px solid #dde5ee;border-top:none;padding:20px 22px;border-radius:0 0 12px 12px">' + inner +
    '<p style="color:#8a97a8;font-size:11px;border-top:1px solid #e3eaf2;padding-top:10px;margin-top:18px">' +
    'This is a plain-language summary for your information. Full terms are in your policy wording and schedule, which govern in all cases. Renewal terms are subject to confirmation.</p>' +
    '</div></div>';
}
function eduBox_(html) {
  return '<div style="background:#fdf6e9;border-left:4px solid ' + BRAND.gold + ';padding:12px 16px;margin:14px 0">' + html + '</div>';
}
function sig_() {
  return '<p>Warm regards,<br><b>' + esc_(CONFIG.AGENT_NAME) + '</b><br>Guardian Group' +
    (CONFIG.AGENT_PHONE ? '<br>' + esc_(CONFIG.AGENT_PHONE) : '') + '</p>';
}
function ctaBtn_(link, label) {
  return '<p style="text-align:center;margin:22px 0"><a href="' + link + '" style="background:' + BRAND.gold +
    ';color:' + BRAND.navy + ';text-decoration:none;font-weight:bold;padding:13px 30px;border-radius:8px;display:inline-block">' +
    label + '</a></p>';
}
function portalLink_(token) {
  return CONFIG.WEBAPP_URL + (CONFIG.WEBAPP_URL.indexOf('?') > -1 ? '&' : '?') + 't=' + encodeURIComponent(token);
}

var STAGES = {
  '30d':   { subject: function (r) { return 'Your motor policy renews on ' + r.nextDue + ' — review & renew online'; },
             intro: function (r) { return 'Your <b>' + esc_(r.coverage) + '</b> motor policy' + polRef_(r) + ' renews on <b>' + r.nextDue + '</b>. Renewal takes two minutes in our secure portal — review your cover, tell us about changes, and send your instruction.'; } },
  '14d':   { subject: function (r) { return 'Two weeks to go — renew your motor policy by ' + r.nextDue; },
             intro: function (r) { return 'A friendly reminder: your <b>' + esc_(r.coverage) + '</b> motor policy' + polRef_(r) + ' renews on <b>' + r.nextDue + '</b> — two weeks away. It takes two minutes online.'; } },
  '7d':    { subject: function (r) { return 'One week left — your motor policy renews ' + r.nextDue; },
             intro: function (r) { return 'Just one week to go — your <b>' + esc_(r.coverage) + '</b> policy' + polRef_(r) + ' renews on <b>' + r.nextDue + '</b>. Renewing before the date keeps your cover (and your No Claim Discount) seamless.'; } },
  '0d':    { subject: function (r) { return 'Your motor policy renews TODAY — one click to stay covered'; },
             intro: function (r) { return 'Your <b>' + esc_(r.coverage) + '</b> policy' + polRef_(r) + ' renews <b>today</b>. Send your instruction now and your protection continues without a break.'; } },
  'od3':   { subject: function (r) { return 'Your motor policy renewal date has passed — let’s keep you covered'; },
             intro: function (r) { return 'Your <b>' + esc_(r.coverage) + '</b> policy' + polRef_(r) + ' reached its renewal date of <b>' + r.nextDue + '</b>. A gap in motor cover — even a short one — leaves you personally exposed and can affect your No Claim Discount. It takes two minutes to put right.'; } },
  'od7':   { subject: function (r) { return 'Final reminder — your motor cover needs attention'; },
             intro: function (r) { return 'This is our final email reminder: your <b>' + esc_(r.coverage) + '</b> policy' + polRef_(r) + ' renewal of <b>' + r.nextDue + '</b> is still open. One of our team will call you shortly — or beat us to it and renew online now.'; } },
  'manual':{ subject: function (r) { return 'Your motor policy renewal — review & renew online'; },
             intro: function (r) { return 'Your <b>' + esc_(r.coverage) + '</b> motor policy' + polRef_(r) + ' renews on <b>' + r.nextDue + '</b>. Review your cover and send your instruction in our secure portal.'; } },
};
function polRef_(r) { return r.policy ? ' <b>' + esc_(r.policy) + '</b>' : ''; }

function sendStageEmail_(row, stage) {
  var st = STAGES[stage] || STAGES['manual'];
  var comp = /comprehensive/i.test(row.coverage);
  var link = portalLink_(row.token);
  var edu = comp
    ? eduBox_('<b style="color:#9a6d0b">💡 Vehicles depreciate.</b> Your vehicle is insured for ' +
        (row.sumInsured ? '<b>' + fmtMoney_(row.sumInsured) + '</b>' : 'its declared value') +
        ' — update it to today’s market value in the portal so your premium stays fair.') +
      eduBox_('<b style="color:#9a6d0b">⚠️ Important change from Guardian General:</b> the <b>Waiver of Excess</b> is no longer included free after three claim-free years — it is now an optional benefit you purchase. It means your excess is waived if you claim. You can add it in one tick when you renew in the portal.')
    : eduBox_('<b style="color:#9a6d0b">💡 Third party covers others — not your own vehicle.</b> ' +
        'Comprehensive adds accident, fire and theft cover for your own car, plus a No Claim Discount that grows to 60%. Tick one box in the portal for a free comparison quote.') +
      eduBox_('<b style="color:#9a6d0b">🆕 New benefit:</b> <b>windscreen cover</b> can now be added to Private Third Party policies — a cracked windscreen no longer has to come out of your pocket. Add it in one tick in the portal.');
  var bal = Number(row.balance) > 0
    ? '<div style="background:#fbe9e7;border-left:4px solid #b3261e;padding:12px 16px;margin:14px 0">A balance of <b>' +
      fmtMoney_(row.balance) + '</b> shows on this policy. Settling it keeps your renewal seamless.</div>'
    : '';
  sendMail_({
    to: row.email, name: CONFIG.FROM_NAME,
    subject: st.subject(row),
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_((row.contact || row.client).split(' ')[0] || 'Valued Client') + ',</p>' +
      '<p>' + st.intro(row) + '</p>' +
      ctaBtn_(link, 'Review & renew my policy') + edu + bal +
      '<p>Prefer to talk it through? Just reply to this email' + (CONFIG.AGENT_PHONE ? ' or call ' + esc_(CONFIG.AGENT_PHONE) : '') + '.</p>' + sig_(),
      'Policy renewal'),
  });
}

function sendSurveyEmail_(row) {
  var link = portalLink_(row.token) + '&survey=1';
  sendMail_({
    to: row.email, name: CONFIG.FROM_NAME,
    subject: 'How did we do with your renewal? (30 seconds)',
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_((row.contact || row.client).split(' ')[0] || 'Valued Client') + ',</p>' +
      '<p>Your renewal is complete — thank you for staying with Guardian. We hold ourselves to a high standard, and your honest feedback is how we keep it that way.</p>' +
      ctaBtn_(link, 'Rate your renewal experience') +
      '<p>It takes about 30 seconds, and every response is read by the team.</p>' + sig_(),
      'Service feedback'),
  });
}

/* ============================ daily automation ============================ */

function dailyAutomation() {
  var sh = renewalsSheet_();
  var map = ensureRenewalCols_();
  var rows = allRenewals_();
  var cRem = col_(map, 'reminders sent');
  var sentEmails = 0;

  rows.forEach(function (r) {
    if (!r.token) return;
    var stamps = r.remindersSent || '';
    // word-boundary match: '0d@' must not match inside '30d@'
    function has(code) { return new RegExp('(^|[;\\s])' + code + '@').test(stamps); }
    function stamp(code) {
      stamps = (stamps ? stamps + '; ' : '') + code + '@' + nowStamp_();
      // test mode: keep the in-memory stamp (one stage per row per run) but
      // persist nothing — a rehearsal must not mark real reminders as sent
      if (!testMode_()) sh.getRange(r.rowIndex, cRem + 1).setValue(stamps);
    }

    var instructed = /—/.test(r.renewalStatus);      // client sent an instruction
    var renewed = /RENEWED/i.test(r.renewalStatus) || r.renewedDate;

    // ---- post-renewal QA survey (once, +N days) ----
    if (renewed && r.email && !has('survey')) {
      var since = r.renewedDate ? -daysUntil_(r.renewedDate) : null;
      if (since !== null && since >= CONFIG.SURVEY_DAYS_AFTER_RENEWAL) {
        sendSurveyEmail_(r); stamp('survey');
        logActivity_(r.token, r.client, 'survey-sent', 'system', '+' + since + ' days after renewal');
        sentEmails++;
      }
      return;
    }
    if (renewed || instructed || r.days === null || !r.email) return;

    // ---- reminder ladder: most urgent unsent stage, one per day ----
    var d = r.days;
    var stage = null;
    if (d <= -7 && !has('od7')) stage = 'od7';
    else if (d <= -3 && d > -30 && !has('od3')) stage = 'od3';
    else if (d === 0 && !has('0d')) stage = '0d';
    else if (d <= 7 && d > 0 && !has('7d')) stage = '7d';
    else if (d <= 14 && d > 7 && !has('14d')) stage = '14d';
    else if (d <= 30 && d > 14 && !has('30d')) stage = '30d';
    if (!stage) return;

    sendStageEmail_(r, stage);
    stamp(stage);
    logActivity_(r.token, r.client, 'reminder-' + stage, 'system', STAGES[stage].subject(r));
    sentEmails++;

    // after the final email, hand over to a human
    if (stage === 'od7') {
      createTask_('Call ' + (r.contact || r.client) + ' — renewal overdue since ' + r.nextDue +
        (r.mobile ? ' (' + r.mobile + ')' : ''), '', r.assignedTo || '', r.client, r.token, 'system');
    }
  });
  Logger.log('dailyAutomation: ' + sentEmails + ' emails sent' +
    (testMode_() ? ' — TEST MODE, all rerouted to ' + testInbox_() : ''));
  // property follow-ups ride the same daily trigger when Property.gs is installed
  try { if (typeof dailyPropertyFollowUps === 'function') dailyPropertyFollowUps(); } catch (err) { Logger.log(err); }
}

/* ============================ menu & setup ============================ */

function onOpen() {
  var t = testMode_();
  SpreadsheetApp.getUi().createMenu('Guardian Renewals')
    .addItem('1. Fill portal links', 'fillPortalLinks')
    .addItem('2. Install daily automation (8am)', 'installTriggers')
    .addItem(t ? 'Run automation now (🧪 test — emails only you)'
              : 'Run automation now (LIVE — emails clients)', 'dailyAutomation')
    .addSeparator()
    .addItem(t ? '🧪 Test mode is ON — turn OFF (go live)'
              : '🧪 Turn test mode ON (rehearse safely)', 'toggleTestMode')
    .addSeparator()
    .addItem('Show staff dashboard link', 'showStaffLink')
    .addItem('Preview a client portal (row 2)', 'showMyLink')
    .addSeparator()
    .addItem('🔗 Link Risk Details to portal tokens', 'linkRiskDetails')
    .addToUi();
  // property menu comes along automatically when Property.gs is installed
  try { if (typeof propertyMenu_ === 'function') propertyMenu_(SpreadsheetApp.getUi()).addToUi(); } catch (err) { Logger.log(err); }
}

function toggleTestMode() {
  var props = PropertiesService.getScriptProperties();
  var ui = SpreadsheetApp.getUi();
  if (testMode_()) {
    var resp = ui.alert('Go LIVE?',
      'Test mode is ON. Turn it OFF so emails go to real clients and Guardian again?\n\n' +
      'Note: reminders the automation rehearsed while testing were not marked as sent, ' +
      'so anything due will send for real on the next 8am run.', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
    props.deleteProperty('TEST_MODE');
    onOpen();
    ui.alert('Test mode is OFF — the system is LIVE. Emails now go to real clients and Guardian.');
  } else {
    props.setProperty('TEST_MODE', 'on');
    onOpen();
    ui.alert('🧪 Test mode is ON.\n\n' +
      'Every email now goes only to ' + testInbox_() + ' with a [TEST] banner — nothing reaches ' +
      'clients or Guardian. Reminder and status stamps are not written, and test responses, tasks ' +
      'and activity are marked TEST.\n\n' +
      'One-time note: for PORTAL submissions (client links) to obey test mode, the web app must be ' +
      'running this version of the code. After pasting new code, use Deploy → Manage deployments → ' +
      '✏️ Edit → Version: New version → Deploy — the /exec URL stays the same.');
  }
}

function requireUrl_() {
  if (!CONFIG.WEBAPP_URL) {
    SpreadsheetApp.getUi().alert('Deploy the web app first (Deploy > New deployment > Web app, execute as Me, access: Anyone with the link), then paste its URL into CONFIG.WEBAPP_URL.');
    throw new Error('WEBAPP_URL not set');
  }
}

function fillPortalLinks() {
  requireUrl_();
  var sh = renewalsSheet_();
  var map = ensureRenewalCols_();
  var cTok = col_(map, 'token'), cLink = col_(map, 'portal link');
  var n = sh.getLastRow() - 1;
  var toks = sh.getRange(2, cTok + 1, n, 1).getValues();
  sh.getRange(2, cLink + 1, n, 1).setValues(toks.map(function (r) { return [r[0] ? portalLink_(r[0]) : '']; }));
  SpreadsheetApp.getActiveSpreadsheet().toast('Portal links filled for ' + n + ' rows.');
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyAutomation') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyAutomation').timeBased().everyDays(1).atHour(8).create();
  staffSheet_(); tasksSheet_(); activitySheet_(); surveysSheet_(); responsesSheet_(); ensureRenewalCols_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Daily automation installed (runs ~8am). Support tabs created.');
}

function showStaffLink() {
  requireUrl_();
  SpreadsheetApp.getUi().alert('Staff dashboard link (share only with your team):\n\n' +
    CONFIG.WEBAPP_URL + (CONFIG.WEBAPP_URL.indexOf('?') > -1 ? '&' : '?') + 'staff=' + CONFIG.STAFF_KEY +
    '\n\nStaff must also be listed on the "Staff" tab (email, name, role, Active=Y).');
}

function showMyLink() {
  requireUrl_();
  var sh = renewalsSheet_();
  var map = headerMap_(sh);
  var tok = sh.getRange(2, col_(map, 'token') + 1).getValue();
  SpreadsheetApp.getUi().alert('Sample client portal link (row 2):\n\n' + portalLink_(tok));
}

/**
 * Stamps each Risk Details vehicle row with its owner's portal token (adding
 * the Token column if the tab doesn't have one). Token is the only exact,
 * guaranteed link between a renewal row and its vehicles — email and name
 * matching stay as fallbacks, but linked rows can never mis-match.
 * Safe to re-run: existing tokens are left untouched.
 */
function linkRiskDetails() {
  var ui = SpreadsheetApp.getUi();
  var sh = ss_().getSheetByName('Risk Details');
  if (!sh || sh.getLastRow() < 2) { ui.alert('No "Risk Details" tab found.'); return; }
  var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var idx = {};
  vals[0].forEach(function (h, i) { idx[String(h).trim().toLowerCase()] = i; });
  var cTok = idx['token'];
  if (cTok === undefined) {
    cTok = vals[0].length;
    sh.getRange(1, cTok + 1).setValue('Token');
    for (var j = 1; j < vals.length; j++) vals[j].push('');
  }
  var byEmail = {}, byName = {};
  allRenewals_().forEach(function (r) {
    if (!r.token) return;
    var e = String(r.email || '').trim().toLowerCase();
    if (e && !byEmail[e]) byEmail[e] = r.token;
    var n = normName_(r.client);
    if (n && !byName[n]) byName[n] = r.token;
  });
  var filled = 0, already = 0, unmatched = {};
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    var cur = String(r[cTok] || '').trim();
    if (cur) { already++; out.push([cur]); continue; }
    var e = String(r[idx['email']] || '').trim().toLowerCase();
    var t = (e && byEmail[e]) || byName[normName_(r[idx['client']])] || '';
    if (t) filled++;
    else if (String(r[idx['client']] || '').trim()) unmatched[String(r[idx['client']])] = 1;
    out.push([t]);
  }
  sh.getRange(2, cTok + 1, out.length, 1).setValues(out);
  _riskMap = null;   // rebuilt with tokens on next lookup
  var un = Object.keys(unmatched);
  ui.alert('Risk Details linked.\n\n' + filled + ' vehicle rows connected to portal tokens (' + already + ' already had one).\n\n' +
    (un.length
      ? un.length + ' client(s) on Risk Details have no matching Motor row (name/email differs or no renewal row yet):\n• ' +
        un.slice(0, 25).join('\n• ') + (un.length > 25 ? '\n…' : '') +
        '\n\nTo connect them, paste the client\'s Token from the Motor tab onto their vehicle rows.'
      : 'Every vehicle row is connected.'));
}
