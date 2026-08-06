/**
 * ============================================================
 *  RENEWAL AUTOMATION — Ricky Rampersad, Guardian Group Agent
 * ============================================================
 *  Attach this script to the "Motor Renewal Book — Schedule"
 *  Google Sheet (Extensions → Apps Script → paste this file).
 *
 *  What it does — MANUAL MODE (default):
 *   1. Adds a "📋 Renewals" menu to the spreadsheet. Highlight
 *      any client row(s) and click "Send renewal email" — works
 *      even if the renewal date has already passed (the email
 *      wording adapts for overdue renewals).
 *   2. Serves the portal's data lookup (doGet ?token=...).
 *   3. Receives portal submissions (doPost), logs them to a
 *      "Responses" tab, emails the client an acknowledgment,
 *      and emails renewal instructions to Guardian (CC you).
 *   4. Keeps "Days Left", "Renewal Status" and "Portal Link"
 *      columns up to date (menu → Refresh).
 *
 *  Automatic reminders (14-day / 7-day follow-up) are OFF by
 *  default. Turn them on any time from the menu:
 *  📋 Renewals → Turn automatic reminders ON.
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
  // Renewal instruction emails go here, with AGENT_EMAIL CC'd on every one.
  GUARDIAN_RENEWALS_EMAIL: 'GuardianGeneralRenewals@myguardiangroup.com',

  // --- Portal ------------------------------------------------------------
  // Your Netlify site. The /r/ path redirects to the portal with the token.
  PORTAL_BASE: 'https://YOUR-SITE-NAME.netlify.app/r/',

  // --- Schedule ----------------------------------------------------------
  REMINDER_DAYS: 14,   // first reminder: 14 days before Next Due
  FOLLOWUP_DAYS: 7,    // follow-up if no response: 7 days before
  DAILY_HOUR: 8,       // hour of day (0-23) the daily check runs

  // --- Sheet -------------------------------------------------------------
  SCHEDULE_SHEET: '',        // '' = auto-detect the tab with the schedule headers
  RESPONSES_SHEET: 'Responses',
  FLEET_SHEET: 'Fleet',      // optional tab: per-vehicle register for corporate clients
  CLIENTS_SHEET: 'Clients',  // client directory: one row per client, holds the access code
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

/* ======================= SETUP & MENU ======================= */

/** Run this ONCE after pasting the script. Manual mode: no timers are created. */
function setup() {
  ensureResponsesSheet_();
  fillTokensAndLinks();
  disableAutomation(); // manual mode — remove any scheduled triggers
  onOpen();
  Logger.log('Setup complete in MANUAL mode. Use the "📋 Renewals" menu in the sheet to send emails. Now deploy as a Web App and paste the /exec URL into the portal.');
}

/** Builds the in-sheet menu. Runs automatically every time the sheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Renewals')
    .addItem('▶ Send renewal email — selected row(s)', 'sendToSelectedRows')
    .addItem('📤 Send to everyone due in the next ' + CONFIG.REMINDER_DAYS + ' days', 'sendToUpcoming')
    .addSeparator()
    .addItem('👥 Sync client directory', 'syncClients')
    .addItem('🔄 Refresh days left & portal links', 'refreshSheet')
    .addItem('✉ Preview the email (sends a sample to you)', 'testReminderEmail')
    .addSeparator()
    .addItem('🤖 Turn automatic reminders ON', 'enableAutomation')
    .addItem('✋ Turn automatic reminders OFF (current mode)', 'disableAutomation')
    .addToUi();
}

/**
 * MANUAL SEND — highlight one or more client rows on the schedule tab,
 * then click 📋 Renewals → "Send renewal email — selected row(s)".
 * Works for overdue renewals too: the email wording adapts.
 */
function sendToSelectedRows() {
  var ui = SpreadsheetApp.getUi();
  var s = getSchedule_();
  var active = SpreadsheetApp.getActiveSheet();
  if (active.getName() !== s.sheet.getName()) {
    ui.alert('Please select rows on the "' + s.sheet.getName() + '" tab first.');
    return;
  }

  // Collect unique data-row numbers from the selection.
  var rowNums = {};
  SpreadsheetApp.getActiveRangeList().getRanges().forEach(function (rg) {
    for (var r = rg.getRow(); r <= rg.getLastRow(); r++) {
      if (r > s.headerRow) rowNums[r] = true;
    }
  });
  var rows = Object.keys(rowNums).map(Number);
  if (!rows.length) {
    ui.alert('Highlight at least one client row (below the header) and try again.');
    return;
  }

  fillTokensAndLinks(); // make sure every selected row has a token + link
  var data = s.sheet.getDataRange().getValues();
  var preview = rows.map(function (r) {
    var info = rowInfo_(data[r - 1], s);
    return '• ' + (info.client || '(no name)') + ' — due ' + prettyDate_(info.due) +
           (info.email ? '' : '  ⚠ NO EMAIL, will be skipped');
  }).join('\n');

  var resp = ui.alert('Send renewal email now?',
    'This will email the personal renewal link to:\n\n' + preview, ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) return;

  var report = sendRows_(s, data, rows);
  ui.alert('Done', report, ui.ButtonSet.OK);
}

/** MANUAL BULK — one click sends to everyone due within REMINDER_DAYS who hasn't been contacted yet. */
function sendToUpcoming() {
  var ui = SpreadsheetApp.getUi();
  fillTokensAndLinks();
  var s = getSchedule_();
  var data = s.sheet.getDataRange().getValues();
  var today = startOfDay_(new Date());
  var rows = [];
  for (var r = s.headerRow; r < data.length; r++) {
    var info = rowInfo_(data[r], s);
    if (!info.due) continue;
    var dl = Math.round((startOfDay_(info.due) - today) / 86400000);
    var status = String(data[r][s.col[COL.RENEWAL_STATUS]] || '');
    if (dl >= 0 && dl <= CONFIG.REMINDER_DAYS && info.email && !status) rows.push(r + 1);
  }
  if (!rows.length) {
    ui.alert('Nobody to email: every client due in the next ' + CONFIG.REMINDER_DAYS +
             ' days has either been contacted already or has no email address.');
    return;
  }
  var resp = ui.alert('Send to ' + rows.length + ' client(s)?',
    'Emails their personal renewal link to everyone due in the next ' + CONFIG.REMINDER_DAYS +
    ' days who has an email and no Renewal Status yet.', ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) return;
  ui.alert('Done', sendRows_(s, data, rows), ui.ButtonSet.OK);
}

/** Shared sender used by both manual actions. Returns a human-readable report. */
function sendRows_(s, data, rowNumbers) {
  var today = startOfDay_(new Date());
  var sent = [], skipped = [];
  rowNumbers.sort(function (a, b) { return a - b; }).forEach(function (rowNum) {
    var row = data[rowNum - 1];
    var info = rowInfo_(row, s);
    if (!info.email && info.client) {
      // Fall back to the client directory's email for this account.
      var d = lookupClientByAccount_(info.client);
      if (d && d.email) info.email = d.email;
    }
    if (!info.email || /@(example|unknown)/i.test(info.email)) {
      skipped.push((info.client || 'Row ' + rowNum) + ' — no usable email');
      return;
    }
    if (!info.due) {
      skipped.push((info.client || 'Row ' + rowNum) + ' — no renewal date');
      return;
    }
    var daysLeft = Math.round((startOfDay_(info.due) - today) / 86400000);
    try {
      sendReminderEmail_(info, daysLeft, false);
      setStatus_(s, rowNum - 1, 'Invitation sent manually ' + isoDate_(new Date()));
      s.sheet.getRange(rowNum, s.col[COL.DAYS_LEFT] + 1).setValue(daysLeft);
      sent.push(info.client + ' <' + info.email + '>');
    } catch (err) {
      skipped.push((info.client || 'Row ' + rowNum) + ' — error: ' + err);
    }
  });
  return '✅ Sent: ' + sent.length + (sent.length ? '\n' + sent.join('\n') : '') +
         (skipped.length ? '\n\n⚠ Skipped: ' + skipped.length + '\n' + skipped.join('\n') : '');
}

/** Recalculates Days Left and fills tokens/links — no emails sent. */
function refreshSheet() {
  fillTokensAndLinks();
  var s = getSchedule_();
  var data = s.sheet.getDataRange().getValues();
  var today = startOfDay_(new Date());
  for (var r = s.headerRow; r < data.length; r++) {
    var due = parseDate_(data[r][s.col[COL.NEXT_DUE]]);
    if (due) s.sheet.getRange(r + 1, s.col[COL.DAYS_LEFT] + 1)
      .setValue(Math.round((startOfDay_(due) - today) / 86400000));
  }
  try { SpreadsheetApp.getUi().alert('Refreshed: days left, tokens and portal links are up to date.'); } catch (e) {}
}

/* --------- Automation switch (OFF by default) --------- */

function enableAutomation() {
  removeTriggers_();
  ScriptApp.newTrigger('dailyRenewalCheck')
    .timeBased().everyDays(1).atHour(CONFIG.DAILY_HOUR).create();
  try {
    SpreadsheetApp.getUi().alert('Automatic reminders are ON. Every day around ' + CONFIG.DAILY_HOUR +
      ':00 clients due in ' + CONFIG.REMINDER_DAYS + ' days get a reminder (follow-up at ' +
      CONFIG.FOLLOWUP_DAYS + ' days). Turn OFF any time from this menu.');
  } catch (e) {}
}

function disableAutomation() {
  removeTriggers_();
  try { SpreadsheetApp.getUi().alert('Automatic reminders are OFF. Use "Send renewal email — selected row(s)" to send manually.'); } catch (e) {}
}

function removeTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyRenewalCheck') ScriptApp.deleteTrigger(t);
  });
}

/** Kept for compatibility — the client directory is now the source of truth. */
function fillTokensAndLinks() { syncClients(); }

/**
 * CLIENT DIRECTORY — builds/updates the "Clients" tab from the schedule and
 * pushes access codes back onto every schedule row. One row per client:
 *   Client Account | Contact | Email | Mobile | Access Code | Portal Link | Policies
 *
 * - New client accounts found in the schedule are added automatically.
 * - You can also add a client (or fix an email/mobile) directly on the Clients
 *   tab — the directory's contact details win over the schedule's.
 * - The Access Code is the client's login for the portal (and the corporate
 *   fleet portal). Same client account name = same code across motor, property
 *   and fleet. Safe to re-run any time.
 */
function syncClients() {
  var s = getSchedule_();
  var data = s.sheet.getDataRange().getValues();
  var cs = ensureClientsSheet_();
  var cdata = cs.getDataRange().getValues();
  var cidx = {};
  cdata[0].forEach(function (h, i) { if (h) cidx[String(h).trim()] = i; });

  // Existing directory rows keyed by uppercased account name.
  var dir = {}, used = {};
  for (var r = 1; r < cdata.length; r++) {
    var a = String(cdata[r][cidx['Client Account']] || '').trim();
    if (!a) continue;
    var code = String(cdata[r][cidx['Access Code']] || '').trim();
    dir[a.toUpperCase()] = { row: r, code: code };
    if (code) used[code] = true;
  }

  // Group schedule rows by client account.
  var groups = {};
  for (var r = s.headerRow; r < data.length; r++) {
    var row = data[r];
    var name = String(row[s.col[COL.CLIENT]] || '').trim();
    if (!name) continue;
    var u = name.toUpperCase();
    var g = groups[u] = groups[u] || { name: name, contact: '', email: '', mobile: '', count: 0, token: '' };
    g.count++;
    g.contact = g.contact || String(row[s.col[COL.CONTACT]] || '').trim();
    g.email = g.email || String(row[s.col[COL.EMAIL]] || '').trim();
    g.mobile = g.mobile || String(row[s.col[COL.MOBILE]] || '').trim();
    g.token = g.token || String(row[s.col[COL.TOKEN]] || '').trim();
  }

  // Upsert every client into the directory.
  Object.keys(groups).forEach(function (u) {
    var g = groups[u];
    var code = (dir[u] && dir[u].code) || g.token;
    if (!code || (used[code] && !(dir[u] && dir[u].code === code))) {
      do { code = makeToken_(); } while (used[code]);
    }
    used[code] = true;
    g.code = code;
    var link = CONFIG.PORTAL_BASE + encodeURIComponent(code);

    if (dir[u]) {
      var rr = dir[u].row + 1;
      if (dir[u].code !== code) cs.getRange(rr, cidx['Access Code'] + 1).setValue(code);
      cs.getRange(rr, cidx['Portal Link'] + 1).setValue(link);
      cs.getRange(rr, cidx['Policies'] + 1).setValue(g.count);
      // Fill blanks only — the directory's own values always win.
      ['Contact', 'Email', 'Mobile'].forEach(function (h, i) {
        var v = [g.contact, g.email, g.mobile][i];
        if (v && !String(cdata[dir[u].row][cidx[h]] || '').trim()) cs.getRange(rr, cidx[h] + 1).setValue(v);
      });
    } else {
      cs.appendRow([g.name, g.contact, g.email, g.mobile, code, link, g.count]);
    }
  });

  // Push codes + links back onto the schedule rows.
  for (var r = s.headerRow; r < data.length; r++) {
    var name = String(data[r][s.col[COL.CLIENT]] || '').trim();
    if (!name) continue;
    var g = groups[name.toUpperCase()];
    if (!g) continue;
    if (String(data[r][s.col[COL.TOKEN]] || '').trim() !== g.code) {
      s.sheet.getRange(r + 1, s.col[COL.TOKEN] + 1).setValue(g.code);
    }
    var link = CONFIG.PORTAL_BASE + encodeURIComponent(g.code);
    if (String(data[r][s.col[COL.PORTAL_LINK]] || '') !== link) {
      s.sheet.getRange(r + 1, s.col[COL.PORTAL_LINK] + 1).setValue(link);
    }
  }
}

function ensureClientsSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CONFIG.CLIENTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.CLIENTS_SHEET);
    sh.appendRow(['Client Account', 'Contact', 'Email', 'Mobile', 'Access Code', 'Portal Link', 'Policies']);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Looks up a directory row by client account name. Returns null if not found. */
function lookupClientByAccount_(account) {
  var sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.CLIENTS_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  var data = sh.getDataRange().getValues();
  var idx = {};
  data[0].forEach(function (h, i) { if (h) idx[String(h).trim()] = i; });
  var want = String(account || '').trim().toUpperCase();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx['Client Account']] || '').trim().toUpperCase() === want) {
      return { email: String(data[r][idx['Email']] || '').trim(), mobile: String(data[r][idx['Mobile']] || '').trim() };
    }
  }
  return null;
}

/** Looks up a directory row by access code. Returns null if not found. */
function lookupClientByCode_(code) {
  var sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.CLIENTS_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  var data = sh.getDataRange().getValues();
  var idx = {};
  data[0].forEach(function (h, i) { if (h) idx[String(h).trim()] = i; });
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx['Access Code']] || '').trim() === code) {
      return {
        account: String(data[r][idx['Client Account']] || '').trim(),
        contact: String(data[r][idx['Contact']] || '').trim(),
        email: String(data[r][idx['Email']] || '').trim(),
        mobile: String(data[r][idx['Mobile']] || '').trim(),
      };
    }
  }
  return null;
}

/* ============ OPTIONAL DAILY AUTOMATION (OFF by default) ============
   Only runs if you switch it on: 📋 Renewals → Turn automatic reminders ON. */

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
  var overdue = daysLeft < 0;
  var subject = overdue
    ? 'Action needed: your ' + (info.coverage || 'insurance') + ' renewal was due ' + prettyDate_(info.due) + ' — renew in 2 minutes'
    : (isFollowUp ? 'Reminder: ' : '') +
      'Your ' + (info.coverage || 'insurance') + ' renewal is due ' + prettyDate_(info.due) +
      ' — confirm in 2 minutes';

  var opening;
  if (overdue) {
    opening = 'Your <strong>' + esc_(info.coverage || 'insurance') + '</strong> policy' +
      (info.policyNo ? ' (<strong>' + esc_(info.policyNo) + '</strong>)' : '') +
      ' came up for renewal on <strong>' + prettyDate_(info.due) + '</strong>. Driving without valid cover is an offence — let\'s get you renewed right away so there\'s no gap in your protection. It takes two minutes online.';
  } else if (isFollowUp) {
    opening = 'Just a friendly follow-up — your renewal is now <strong>' + daysLeft + ' days away</strong> and we haven\'t received your instructions yet. It takes two minutes to confirm online.';
  } else {
    opening = 'Your <strong>' + esc_(info.coverage || 'insurance') + '</strong> policy' +
      (info.policyNo ? ' (<strong>' + esc_(info.policyNo) + '</strong>)' : '') +
      ' comes up for renewal on <strong>' + prettyDate_(info.due) + '</strong> — that\'s ' + daysLeft + ' days from now.';
  }

  var owing = Number(info.balance) > 0.01;
  var html =
    emailShell_(
      overdue ? 'Let\'s get you renewed today' : 'Your renewal is coming up',
      '<p style="margin:0 0 14px">Hi ' + esc_(first) + ',</p>' +
      '<p style="margin:0 0 14px">' + opening + '</p>' +
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
        '<li>See your Guardian policy decoded — your No Claim Discount, flood cover (Special Perils) and more, in plain English</li>' +
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
    var accounts = {};

    // Directory first: an access code maps to a client account, and we return
    // every schedule row for that account (motor + property), current and past.
    var dirEntry = lookupClientByCode_(token);
    var wantAccount = dirEntry ? dirEntry.account.toUpperCase() : null;
    if (dirEntry) {
      client = dirEntry.account;
      contact = dirEntry.contact;
      email = dirEntry.email;
      mobile = dirEntry.mobile;
    }

    for (var r = s.headerRow; r < data.length; r++) {
      var row = data[r];
      var matches = wantAccount
        ? String(row[s.col[COL.CLIENT]] || '').trim().toUpperCase() === wantAccount
        : String(row[s.col[COL.TOKEN]] || '').trim() === token;
      if (!matches) continue;
      var info = rowInfo_(row, s);
      if (info.client) accounts[info.client] = true;
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
      out.fleet = getFleetRows_(Object.keys(accounts)); // [] unless a Fleet tab exists
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
  // If no sheet name is configured, scan all tabs and use the one whose
  // header row contains "Next Due" — the workbook has other tabs (client
  // master, staff roster) that must never be touched by the automation.
  var candidates = CONFIG.SCHEDULE_SHEET
    ? [ss.getSheetByName(CONFIG.SCHEDULE_SHEET)]
    : ss.getSheets();

  for (var s = 0; s < candidates.length; s++) {
    var sheet = candidates[s];
    if (!sheet || sheet.getLastRow() < 1) continue;
    var values = sheet.getRange(1, 1, Math.min(5, sheet.getLastRow()), sheet.getLastColumn()).getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i].indexOf(COL.NEXT_DUE) === -1) continue;
      var col = {};
      values[i].forEach(function (h, c) { if (h) col[String(h).trim()] = c; });
      if (!(COL.TOKEN in col)) continue; // must be the schedule, not a lookalike
      var headerRow = i + 1; // data starts on the next row (0-based index = headerRow)
      return checkColumns_({ sheet: sheet, headerRow: headerRow, col: col });
    }
  }
  throw new Error('Could not find the schedule tab (looking for a header row with "' + COL.NEXT_DUE + '" and "' + COL.TOKEN + '")');
}

function checkColumns_(s) {
  // Verify required columns exist.
  [COL.CLIENT, COL.EMAIL, COL.TOKEN, COL.RENEWAL_STATUS, COL.PORTAL_LINK].forEach(function (h) {
    if (!(h in s.col)) throw new Error('Missing column: "' + h + '"');
  });
  return s;
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

/**
 * Reads the optional "Fleet" tab (per-vehicle register for corporate clients).
 * Expected headers: Client Account | Vehicle Reg | Make | Model | Status |
 * Renewal Date | Policy # | Premium (TT$). Returns [] if the tab is missing.
 */
function getFleetRows_(accountNames) {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.FLEET_SHEET);
    if (!sh || sh.getLastRow() < 2) return [];
    var data = sh.getDataRange().getValues();
    var idx = {};
    data[0].forEach(function (h, i) { if (h) idx[String(h).trim()] = i; });
    if (!('Client Account' in idx)) return [];
    var wanted = {};
    (accountNames || []).forEach(function (n) { wanted[String(n).trim().toUpperCase()] = true; });
    var out = [];
    for (var r = 1; r < data.length; r++) {
      var acct = String(data[r][idx['Client Account']] || '').trim();
      if (!acct || !wanted[acct.toUpperCase()]) continue;
      var rd = data[r][idx['Renewal Date']];
      out.push({
        account: acct,
        reg: String(data[r][idx['Vehicle Reg']] || ''),
        make: String(data[r][idx['Make']] || ''),
        model: String(data[r][idx['Model']] || ''),
        status: String(data[r][idx['Status']] || ''),
        renewal: rd instanceof Date ? isoDate_(rd) : String(rd || ''),
        policyNo: String(data[r][idx['Policy #']] || ''),
        premium: num_(data[r][idx['Premium (TT$)']]),
      });
    }
    return out;
  } catch (e) {
    return [];
  }
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
