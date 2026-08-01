/**
 * ============================================================
 *  RENEWAL AUTOMATION — Ricky Rampersad, Guardian Group Agent
 * ============================================================
 *  Attach this script to the "Motor Renewal Book — Schedule"
 *  Google Sheet (Extensions → Apps Script → paste this file).
 *
 *  What it does:
 *   1. Every morning, finds policies due in REMINDER_DAYS (14)
 *      days and emails the client their personal portal link.
 *   2. Sends a follow-up at FOLLOWUP_DAYS (7) days if the
 *      client hasn't responded yet.
 *   3. Serves the portal's data lookup (doGet ?token=...).
 *   4. Receives portal submissions (doPost), logs them to a
 *      "Responses" tab, emails the client an acknowledgment,
 *      and emails renewal instructions to Guardian (CC you).
 *   5. Keeps "Days Left", "Renewal Status" and "Portal Link"
 *      columns up to date.
 *
 *  ONE-TIME SETUP (see RENEWAL-SETUP.md in the repo):
 *   a. Fill in CONFIG below (especially PORTAL_BASE and
 *      GUARDIAN_RENEWALS_EMAIL).
 *   b. Run setup() once and authorise the permissions.
 *   c. Deploy → New deployment → Web app →
 *      Execute as: Me · Who has access: Anyone →
 *      copy the /exec URL into the portal's CONFIG.API_URL.
 * ============================================================
 */

var CONFIG = {
  // --- Your details -----------------------------------------------------
  AGENT_NAME: 'Ricky Rampersad',
  AGENT_EMAIL: 'ricky.rampersad@myguardiangroup.com', // receives copies of everything
  AGENT_PHONE: '(868) 678-5921',

  // --- Guardian ----------------------------------------------------------
  // TODO: paste the Guardian renewals email address here when you have it.
  // While this is blank, instruction emails go only to AGENT_EMAIL so
  // nothing is lost — you can forward manually until it's set.
  GUARDIAN_RENEWALS_EMAIL: '',

  // --- Portal ------------------------------------------------------------
  // Your Netlify site. The /r/ path redirects to the portal with the token.
  PORTAL_BASE: 'https://YOUR-SITE-NAME.netlify.app/r/',

  // --- Schedule ----------------------------------------------------------
  REMINDER_DAYS: 14,   // first reminder: 14 days before Next Due
  FOLLOWUP_DAYS: 7,    // follow-up if no response: 7 days before
  DAILY_HOUR: 8,       // hour of day (0-23) the daily check runs

  // --- Sheet -------------------------------------------------------------
  SCHEDULE_SHEET: '',        // '' = first sheet in the spreadsheet
  RESPONSES_SHEET: 'Responses',
};

// Column headers exactly as they appear in the sheet.
var COL = {
  NEXT_DUE: 'Next Due',
  DAYS_LEFT: 'Days Left',
  MONTH: 'Month',
  CLIENT: 'Client Account',
  CONTACT: 'Contact',
  COVERAGE: 'Coverage',
  SUM_INSURED: 'Sum Insured (TT$)',
  PREMIUM: 'Premium (TT$)',
  PAID: 'Paid (TT$)',
  BALANCE: 'Balance Owing (TT$)',
  PAY_STATUS: 'Payment Status',
  POLICY_NO: 'Policy #',
  MOBILE: 'Mobile',
  EMAIL: 'Email',
  RENEWAL_STATUS: 'Renewal Status',
  PORTAL_LINK: 'Portal Link',
  TOKEN: 'Token',
};

/* ======================= SETUP ======================= */

/** Run this ONCE after pasting the script. */
function setup() {
  ensureResponsesSheet_();
  fillTokensAndLinks();

  // Recreate the daily trigger cleanly.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyRenewalCheck') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyRenewalCheck')
    .timeBased().everyDays(1).atHour(CONFIG.DAILY_HOUR).create();

  Logger.log('Setup complete. Daily check will run around %s:00. Now deploy as a Web App and paste the /exec URL into the portal.', CONFIG.DAILY_HOUR);
}

/** Generates a token + portal link for any row missing one. Safe to re-run. */
function fillTokensAndLinks() {
  var s = getSchedule_();
  var data = s.sheet.getDataRange().getValues();
  var byClient = {}; // same client account -> same token

  for (var r = s.headerRow; r < data.length; r++) {
    var row = data[r];
    var client = String(row[s.col[COL.CLIENT]] || '').trim();
    if (!client && !row[s.col[COL.NEXT_DUE]]) continue;

    var token = String(row[s.col[COL.TOKEN]] || '').trim();
    if (!token) {
      token = byClient[client] || makeToken_();
      s.sheet.getRange(r + 1, s.col[COL.TOKEN] + 1).setValue(token);
    }
    if (client) byClient[client] = token;

    var link = CONFIG.PORTAL_BASE + encodeURIComponent(token);
    if (String(row[s.col[COL.PORTAL_LINK]] || '') !== link) {
      s.sheet.getRange(r + 1, s.col[COL.PORTAL_LINK] + 1).setValue(link);
    }
  }
}

/* ======================= DAILY AUTOMATION ======================= */

function dailyRenewalCheck() {
  fillTokensAndLinks();
  var s = getSchedule_();
  var data = s.sheet.getDataRange().getValues();
  var today = startOfDay_(new Date());
  var sentCount = 0;

  for (var r = s.headerRow; r < data.length; r++) {
    var row = data[r];
    var due = parseDate_(row[s.col[COL.NEXT_DUE]]);
    if (!due) continue;

    var daysLeft = Math.round((startOfDay_(due) - today) / 86400000);
    s.sheet.getRange(r + 1, s.col[COL.DAYS_LEFT] + 1).setValue(daysLeft);

    var email = String(row[s.col[COL.EMAIL]] || '').trim();
    var status = String(row[s.col[COL.RENEWAL_STATUS]] || '').trim();
    if (!email || /@(example|unknown)/i.test(email)) continue;
    if (/responded|renewed|sent to guardian|declined/i.test(status)) continue; // client already acted

    var info = rowInfo_(row, s);

    if (daysLeft === CONFIG.REMINDER_DAYS && !/reminder sent/i.test(status)) {
      sendReminderEmail_(info, daysLeft, false);
      setStatus_(s, r, 'Reminder sent ' + isoDate_(new Date()));
      sentCount++;
    } else if (daysLeft === CONFIG.FOLLOWUP_DAYS && /reminder sent/i.test(status) && !/follow-up/i.test(status)) {
      sendReminderEmail_(info, daysLeft, true);
      setStatus_(s, r, status + ' · Follow-up ' + isoDate_(new Date()));
      sentCount++;
    }
  }
  Logger.log('dailyRenewalCheck: %s email(s) sent.', sentCount);
}

function sendReminderEmail_(info, daysLeft, isFollowUp) {
  var first = firstName_(info.contact || info.client);
  var subject = (isFollowUp ? 'Reminder: ' : '') +
    'Your ' + (info.coverage || 'insurance') + ' renewal is due ' + prettyDate_(info.due) +
    ' — confirm in 2 minutes';

  var owing = Number(info.balance) > 0.01;
  var html =
    emailShell_(
      'Your renewal is coming up',
      '<p style="margin:0 0 14px">Hi ' + esc_(first) + ',</p>' +
      '<p style="margin:0 0 14px">' +
        (isFollowUp
          ? 'Just a friendly follow-up — your renewal is now <strong>' + daysLeft + ' days away</strong> and we haven\'t received your instructions yet. It takes two minutes to confirm online.'
          : 'Your <strong>' + esc_(info.coverage || 'insurance') + '</strong> policy' +
            (info.policyNo ? ' (<strong>' + esc_(info.policyNo) + '</strong>)' : '') +
            ' comes up for renewal on <strong>' + prettyDate_(info.due) + '</strong> — that\'s ' + daysLeft + ' days from now.') +
      '</p>' +
      statTable_([
        ['Renewal date', prettyDate_(info.due)],
        ['Coverage', info.coverage || '—'],
        ['Annual premium', 'TT$ ' + money_(info.premium)],
        owing ? ['Balance owing', 'TT$ ' + money_(info.balance) + ' — please settle before renewal'] : ['Payment status', info.payStatus || 'Paid up'],
      ]) +
      '<p style="margin:18px 0 8px">On your personal renewal page you can:</p>' +
      '<ul style="margin:0 0 18px;padding-left:20px;color:#33475b">' +
        '<li>Review your policy and confirm <strong>renew as-is</strong>, or tell us what changed</li>' +
        '<li>Check your <strong>sum insured</strong> is right (we explain the "average clause" — worth 2 minutes!)</li>' +
        '<li>See current offers you may qualify for</li>' +
      '</ul>' +
      button_(info.portalLink, 'Review & Confirm My Renewal') +
      '<p style="margin:18px 0 0;font-size:13px;color:#7a8ca0">Prefer to talk? Call ' + esc_(CONFIG.AGENT_NAME) + ' at ' + esc_(CONFIG.AGENT_PHONE) + ' or just reply to this email.</p>'
    );

  MailApp.sendEmail({
    to: info.email,
    replyTo: CONFIG.AGENT_EMAIL,
    subject: subject,
    htmlBody: html,
    name: CONFIG.AGENT_NAME + ' — Guardian Group Agent',
  });
}

/* ======================= WEB API (portal) ======================= */

/** GET ?token=XYZ → client + policies as JSON. */
function doGet(e) {
  var token = e && e.parameter && String(e.parameter.token || '').trim();
  var out = { found: false };

  if (token) {
    var s = getSchedule_();
    var data = s.sheet.getDataRange().getValues();
    var policies = [];
    var client = '', contact = '', email = '', mobile = '';

    for (var r = s.headerRow; r < data.length; r++) {
      var row = data[r];
      if (String(row[s.col[COL.TOKEN]] || '').trim() !== token) continue;
      var info = rowInfo_(row, s);
      client = client || info.client;
      contact = contact || info.contact;
      email = email || info.email;
      mobile = mobile || info.mobile;
      policies.push({
        coverage: info.coverage,
        nextDue: info.due ? isoDate_(info.due) : '',
        premium: num_(info.premium),
        paid: num_(info.paid),
        balance: num_(info.balance),
        paymentStatus: info.payStatus,
        policyNo: info.policyNo,
        sumInsured: info.sumInsured === '' ? '' : num_(info.sumInsured),
      });
    }

    if (policies.length) {
      policies.sort(function (a, b) { return (a.nextDue || '9999').localeCompare(b.nextDue || '9999'); });
      out = { found: true, client: client, contact: contact, email: email, mobile: mobile, policies: policies };
    }
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/** POST — portal submission → log, ack client, instruct Guardian. */
function doPost(e) {
  var out = { ok: false };
  try {
    var p = JSON.parse(e.postData.contents);
    if (p.action !== 'submit') throw new Error('Unknown action');

    var resp = ensureResponsesSheet_();
    resp.appendRow([
      new Date(), p.token || '', p.name || '', p.email || '', p.mobile || '',
      p.decision || '', p.changes || '', p.notes || '',
      (p.campaigns || []).join('; '), 'Received',
    ]);

    // Update Renewal Status on every row with this token.
    var clientInfo = null;
    if (p.token) {
      var s = getSchedule_();
      var data = s.sheet.getDataRange().getValues();
      for (var r = s.headerRow; r < data.length; r++) {
        if (String(data[r][s.col[COL.TOKEN]] || '').trim() === p.token) {
          setStatus_(s, r, 'Responded ' + isoDate_(new Date()) + ' — ' + (p.decision || ''));
          clientInfo = clientInfo || rowInfo_(data[r], s);
        }
      }
    }

    sendClientAck_(p);
    sendGuardianInstructions_(p, clientInfo);
    out = { ok: true };
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendClientAck_(p) {
  if (!p.email) return;
  var html = emailShell_(
    'We\'ve received your renewal instructions ✅',
    '<p style="margin:0 0 14px">Hi ' + esc_(firstName_(p.name)) + ',</p>' +
    '<p style="margin:0 0 14px">Thank you — your renewal instructions are in and we\'re acting on them right away.</p>' +
    statTable_([
      ['Your decision', p.decision || '—'],
      p.changes ? ['Changes requested', p.changes] : null,
      (p.campaigns || []).length ? ['Offers you\'re interested in', p.campaigns.join(', ')] : null,
    ].filter(Boolean)) +
    '<p style="margin:18px 0 14px"><strong>What happens next:</strong></p>' +
    '<ol style="margin:0 0 18px;padding-left:20px;color:#33475b">' +
      '<li>We prepare your renewal and send formal instructions to Guardian.</li>' +
      '<li>We\'ll contact you if anything is needed (valuation, documents, payment).</li>' +
      '<li>Your new certificate and schedule are issued before your current cover expires.</li>' +
    '</ol>' +
    '<p style="margin:0;font-size:13px;color:#7a8ca0">Questions in the meantime? Reply to this email or call ' + esc_(CONFIG.AGENT_PHONE) + '.</p>'
  );
  MailApp.sendEmail({
    to: p.email,
    replyTo: CONFIG.AGENT_EMAIL,
    subject: 'Received: your renewal instructions — we\'re on it',
    htmlBody: html,
    name: CONFIG.AGENT_NAME + ' — Guardian Group Agent',
  });
}

function sendGuardianInstructions_(p, info) {
  var to = CONFIG.GUARDIAN_RENEWALS_EMAIL || CONFIG.AGENT_EMAIL;
  var cc = CONFIG.GUARDIAN_RENEWALS_EMAIL ? CONFIG.AGENT_EMAIL : '';

  var rows = [
    ['Client', (info && info.client) || p.name || '—'],
    ['Contact person', p.name || (info && info.contact) || '—'],
    ['Email', p.email || (info && info.email) || '—'],
    ['Mobile', p.mobile || (info && info.mobile) || '—'],
    info && info.policyNo ? ['Policy #', info.policyNo] : null,
    info && info.coverage ? ['Coverage', info.coverage] : null,
    info && info.due ? ['Renewal date', prettyDate_(info.due)] : null,
    info ? ['Premium on record', 'TT$ ' + money_(info.premium)] : null,
    info ? ['Balance owing', 'TT$ ' + money_(info.balance)] : null,
    ['Client decision', p.decision || '—'],
    p.changes ? ['Changes requested', p.changes] : null,
    p.notes ? ['Client notes', p.notes] : null,
    (p.campaigns || []).length ? ['Campaign interest', p.campaigns.join(', ')] : null,
    ['Received via', 'Client renewal portal, ' + new Date().toString()],
  ].filter(Boolean);

  var html = emailShell_(
    'Renewal instructions — ' + ((info && info.client) || p.name || 'client'),
    '<p style="margin:0 0 14px">Please process the following renewal per the client\'s confirmed instructions:</p>' +
    statTable_(rows) +
    '<p style="margin:18px 0 0;font-size:13px;color:#7a8ca0">Submitted by the client through the secure renewal portal of ' +
    esc_(CONFIG.AGENT_NAME) + ' (' + esc_(CONFIG.AGENT_EMAIL) + '). Please reply-all with confirmation or requirements.</p>'
  );

  MailApp.sendEmail({
    to: to,
    cc: cc,
    replyTo: CONFIG.AGENT_EMAIL,
    subject: 'RENEWAL INSTRUCTIONS: ' + ((info && info.client) || p.name || '') +
             (info && info.policyNo ? ' — ' + info.policyNo : '') +
             (info && info.due ? ' — due ' + isoDate_(info.due) : ''),
    htmlBody: html,
    name: CONFIG.AGENT_NAME + ' — Guardian Group Agent',
  });
}

/* ======================= HELPERS ======================= */

function getSchedule_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = CONFIG.SCHEDULE_SHEET ? ss.getSheetByName(CONFIG.SCHEDULE_SHEET) : ss.getSheets()[0];
  if (!sheet) throw new Error('Schedule sheet not found');

  var values = sheet.getRange(1, 1, Math.min(5, sheet.getLastRow()), sheet.getLastColumn()).getValues();
  var headerRow = -1, col = {};
  for (var i = 0; i < values.length; i++) {
    var idx = values[i].indexOf(COL.NEXT_DUE);
    if (idx !== -1) {
      headerRow = i + 1; // data starts on the next row (0-based index = headerRow)
      values[i].forEach(function (h, c) { if (h) col[String(h).trim()] = c; });
      break;
    }
  }
  if (headerRow === -1) throw new Error('Could not find header row (looking for "' + COL.NEXT_DUE + '")');
  // Verify required columns exist.
  [COL.CLIENT, COL.EMAIL, COL.TOKEN, COL.RENEWAL_STATUS, COL.PORTAL_LINK].forEach(function (h) {
    if (!(h in col)) throw new Error('Missing column: "' + h + '"');
  });
  return { sheet: sheet, headerRow: headerRow, col: col };
}

function rowInfo_(row, s) {
  return {
    due: parseDate_(row[s.col[COL.NEXT_DUE]]),
    client: String(row[s.col[COL.CLIENT]] || '').trim(),
    contact: String(row[s.col[COL.CONTACT]] || '').trim(),
    coverage: String(row[s.col[COL.COVERAGE]] || '').trim(),
    sumInsured: row[s.col[COL.SUM_INSURED]] === '' ? '' : row[s.col[COL.SUM_INSURED]],
    premium: row[s.col[COL.PREMIUM]],
    paid: row[s.col[COL.PAID]],
    balance: row[s.col[COL.BALANCE]],
    payStatus: String(row[s.col[COL.PAY_STATUS]] || '').trim(),
    policyNo: String(row[s.col[COL.POLICY_NO]] || '').trim(),
    mobile: String(row[s.col[COL.MOBILE]] || '').trim(),
    email: String(row[s.col[COL.EMAIL]] || '').trim(),
    portalLink: String(row[s.col[COL.PORTAL_LINK]] || '').trim(),
  };
}

function ensureResponsesSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CONFIG.RESPONSES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.RESPONSES_SHEET);
    sh.appendRow(['Timestamp', 'Token', 'Name', 'Email', 'Mobile', 'Decision', 'Changes', 'Notes', 'Campaign Interest', 'Status']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function setStatus_(s, rowIndex0, status) {
  s.sheet.getRange(rowIndex0 + 1, s.col[COL.RENEWAL_STATUS] + 1).setValue(status);
}

function makeToken_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  var t = '';
  for (var i = 0; i < 8; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));
  return t;
}

function parseDate_(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (!v) return null;
  var d = new Date(String(v).trim() + (String(v).length === 10 ? 'T00:00:00' : ''));
  return isNaN(d) ? null : d;
}

function startOfDay_(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function isoDate_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function prettyDate_(d) { return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'd MMMM yyyy') : '—'; }
function num_(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
function money_(v) { return num_(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function firstName_(name) {
  var n = String(name || '').replace(/,/g, ' ').trim().split(/\s+/)[0] || 'there';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- HTML email building blocks ---------- */

function emailShell_(title, bodyHtml) {
  return '' +
  '<div style="background:#F4F8FB;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E3EDF5">' +
      '<div style="background:linear-gradient(135deg,#0E2A47,#0E8C8C);padding:26px 30px">' +
        '<div style="color:#ffffff;font-size:19px;font-weight:bold">' + esc_(title) + '</div>' +
        '<div style="color:#BFD9E8;font-size:12px;margin-top:4px">' + esc_(CONFIG.AGENT_NAME) + ' · Guardian Group Agent</div>' +
      '</div>' +
      '<div style="padding:28px 30px;color:#152435;font-size:15px;line-height:1.6">' + bodyHtml + '</div>' +
      '<div style="padding:18px 30px;background:#F4F8FB;border-top:1px solid #E3EDF5;font-size:11px;color:#7a8ca0;line-height:1.5">' +
        esc_(CONFIG.AGENT_NAME) + ' · ' + esc_(CONFIG.AGENT_PHONE) + ' · ' + esc_(CONFIG.AGENT_EMAIL) +
        '<br/>Figures are from our office records and are indicative; your official Guardian renewal notice and policy documents are binding.' +
      '</div>' +
    '</div>' +
  '</div>';
}

function statTable_(pairs) {
  return '<table style="width:100%;border-collapse:collapse;margin:8px 0 4px">' +
    pairs.map(function (p) {
      return '<tr>' +
        '<td style="padding:9px 12px;background:#F4F8FB;border:1px solid #E3EDF5;font-size:12px;color:#5B7186;font-weight:bold;width:42%">' + esc_(p[0]) + '</td>' +
        '<td style="padding:9px 12px;border:1px solid #E3EDF5;font-size:14px;color:#152435">' + esc_(p[1]) + '</td>' +
      '</tr>';
    }).join('') + '</table>';
}

function button_(href, label) {
  return '<div style="text-align:center;margin:22px 0 8px">' +
    '<a href="' + esc_(href) + '" style="display:inline-block;background:#F2B33D;color:#5C3D00;font-weight:bold;font-size:15px;text-decoration:none;padding:14px 34px;border-radius:999px">' +
    esc_(label) + '</a>' +
    '<div style="font-size:11px;color:#7a8ca0;margin-top:10px">Or copy this link: ' + esc_(href) + '</div>' +
  '</div>';
}

/* ---------- Manual test utilities ---------- */

/** Send yourself a sample reminder email to preview the design. */
function testReminderEmail() {
  sendReminderEmail_({
    client: 'SAMPLE, CLIENT HH', contact: 'Sample', coverage: 'Comprehensive',
    due: new Date(Date.now() + CONFIG.REMINDER_DAYS * 86400000),
    premium: 10649.31, paid: 5000, balance: 5649.31, payStatus: 'Balance owing',
    policyNo: 'TTMV1600000', email: CONFIG.AGENT_EMAIL,
    portalLink: CONFIG.PORTAL_BASE + 'SAMPLE01',
  }, CONFIG.REMINDER_DAYS, false);
  Logger.log('Sample reminder sent to ' + CONFIG.AGENT_EMAIL);
}
