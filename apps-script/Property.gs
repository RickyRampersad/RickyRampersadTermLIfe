/**
 * ============================================================================
 * PROPERTY RENEWAL MODULE — Ricky Rampersad Branch
 * ============================================================================
 * Add this file alongside Code.gs (Apps Script → + → Script → name "Property").
 * It reuses Code.gs helpers (esc_, fmtMoney_, fmtDate_, sendMail_, brandWrap_,
 * logActivity_, createTask_, testMode_ …) so both modules stay consistent.
 *
 * CLIENT JOURNEY
 *   1. Renewal invitation email — shows the schedule of values exactly as the
 *      branch presents it (Building, Stock, General Contents, Plant/Equipment/
 *      Machinery, Electronic Equipment → Total) with the current premium.
 *   2. Client opens the portal (WEBAPP_URL?p=TOKEN), where they can:
 *        • read what each cover actually means
 *        • understand the EXCESS and — most importantly — the AVERAGE clause,
 *          with a live calculator on their own numbers
 *        • enter an adjusted value against any line, on the fly
 *        • send their instruction
 *   3. On submit: the instruction emails the CRMS renewals team (CC the branch
 *      team), the client gets a thank-you, and a progress record opens.
 *   4. The client can return to the same link any time to TRACK PROGRESS
 *      through the stages until the schedule is delivered.
 *
 * FOLLOW-UP CADENCE (dailyPropertyFollowUps, runs with the daily trigger)
 *   • Staff: every 3 days a task/nudge while a renewal sits unfinished
 *   • Client: every 5 days a progress update so they are never left wondering
 *   Both stop the moment the stage reaches Completed.
 */

var PROP = {
  SHEET: 'Property Renewals',
  PROGRESS_SHEET: 'Property Progress',

  // Where property instructions go. CRMS is the carrier renewals desk.
  CRMS_TO: 'crmsrenewals@myguardiangroup.com',
  CRMS_CC: [
    'ricky.rampersad@myguardiangroup.com',
    'salessupport@myguardiangroup.com',
    'support@rickyrampersadbranch.com',
  ],

  STAFF_FOLLOWUP_DAYS: 3,   // nudge the team every 3 days
  CLIENT_FOLLOWUP_DAYS: 5,  // update the client every 5 days

  // The renewal journey the client sees on the progress screen.
  STAGES: [
    { key: 'instructed', label: 'Instruction received',      blurb: 'We have your instructions and your file is open.' },
    { key: 'crms',       label: 'With Guardian CRMS',        blurb: 'Your renewal is with the insurer for terms.' },
    { key: 'terms',      label: 'Terms received',            blurb: 'Renewal terms are in — we are checking them for you.' },
    { key: 'accepted',   label: 'Accepted & payment',        blurb: 'Terms agreed; payment being arranged.' },
    { key: 'issued',     label: 'Schedule issued',           blurb: 'Your policy schedule and documents are issued.' },
  ],

  // The value lines, in the order the branch presents them.
  LINES: [
    { key: 'building',   label: 'Building Cover' },
    { key: 'stock',      label: 'Stock' },
    { key: 'contents',   label: 'General Contents' },
    { key: 'plant',      label: 'Plant, Equipment & Machinery' },
    { key: 'electronic', label: 'Electronic Equipment' },
  ],
};

/* ============================ sheets ============================ */

function propSheet_() {
  return namedSheet_(PROP.SHEET, [
    'Renewal Date', 'Days Left', 'Client', 'Contact', 'Email', 'Mobile',
    'Risk Location', 'Occupancy', 'Policy #', 'Carrier',
    'Building Cover', 'Stock', 'General Contents', 'Plant, Equipment & Machinery',
    'Electronic Equipment', 'Total Value', 'Premium', 'Excess',
    'Token', 'Portal Link', 'Renewal Status', 'Stage', 'Stage Updated',
    'Last Client Update', 'Last Staff Nudge', 'Reminders Sent', 'Assigned To',
    'Insured Since', 'Years Insured', 'Values Last Reviewed', 'Premium History',
  ]);
}

function propProgressSheet_() {
  return namedSheet_(PROP.PROGRESS_SHEET,
    ['Timestamp', 'Token', 'Client', 'Stage', 'Note', 'By']);
}

function propRow_(r, map, rowIndex) {
  function c(name) { var i = col_(map, name); return i < 0 ? '' : r[i]; }
  return {
    rowIndex: rowIndex,
    renewalDate: fmtDate_(c('renewal date')),
    days: daysUntil_(c('renewal date')),
    client: String(c('client') || ''),
    contact: String(c('contact') || ''),
    email: String(c('email') || '').trim(),
    mobile: String(c('mobile') || ''),
    location: String(c('risk location') || ''),
    occupancy: String(c('occupancy') || ''),
    policy: String(c('policy #') || ''),
    carrier: String(c('carrier') || 'Guardian General'),
    values: {
      building: num_(c('building cover')),
      stock: num_(c('stock')),
      contents: num_(c('general contents')),
      plant: num_(c('plant, equipment & machinery')),
      electronic: num_(c('electronic equipment')),
    },
    total: num_(c('total value')),
    premium: num_(c('premium')),
    excess: String(c('excess') || ''),
    token: String(c('token') || '').trim(),
    status: String(c('renewal status') || ''),
    stage: String(c('stage') || ''),
    stageUpdated: fmtDate_(c('stage updated')),
    lastClientUpdate: c('last client update'),
    lastStaffNudge: c('last staff nudge'),
    remindersSent: String(c('reminders sent') || ''),
    assignedTo: String(c('assigned to') || ''),
    // relationship + trend data that makes the portal feel personal
    since: fmtDate_(c('insured since')),
    years: String(c('years insured') || ''),
    valuesReviewed: String(c('values last reviewed') || ''),
    premiumHistory: parsePremiumHistory_(String(c('premium history') || '')),
  };
}

/** "2022:11130|2024:12804.8|2025:12804.8" -> [{year,amount},...] */
function parsePremiumHistory_(s) {
  if (!s) return [];
  return String(s).split('|').map(function (part) {
    var bits = part.split(':');
    return { year: String(bits[0] || '').trim(), amount: Number(bits[1]) || 0 };
  }).filter(function (x) { return x.year && x.amount; });
}

function num_(v) { var n = Number(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }

function allProperties_() {
  var sh = propSheet_();
  if (sh.getLastRow() < 2) return [];
  var map = headerMap_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    .map(function (r, i) { return propRow_(r, map, i + 2); })
    .filter(function (r) { return r.client || r.token; });
}

function propByToken_(token) {
  token = String(token || '').trim();
  if (!token) return null;
  var hit = allProperties_().filter(function (r) { return r.token === token; });
  return hit.length ? hit : null;
}

function setPropCell_(rowIndex, header, value) {
  var sh = propSheet_();
  var c = col_(headerMap_(sh), header);
  if (c >= 0) sh.getRange(rowIndex, c + 1).setValue(value);
}

/** Gives every property row a token + portal link. Safe to re-run. */
function fillPropertyLinks() {
  var sh = propSheet_();
  if (sh.getLastRow() < 2) return;
  var map = headerMap_(sh);
  var cTok = col_(map, 'token'), cLink = col_(map, 'portal link'), cClient = col_(map, 'client');
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var byClient = {};
  data.forEach(function (r) {
    var t = String(r[cTok] || '').trim();
    if (t) byClient[String(r[cClient] || '').trim().toUpperCase()] = t;
  });
  for (var i = 0; i < data.length; i++) {
    var client = String(data[i][cClient] || '').trim();
    if (!client) continue;
    var tok = String(data[i][cTok] || '').trim();
    if (!tok) {
      tok = byClient[client.toUpperCase()] || Utilities.getUuid().replace(/-/g, '').slice(0, 8);
      byClient[client.toUpperCase()] = tok;
      sh.getRange(i + 2, cTok + 1).setValue(tok);
    }
    if (CONFIG.WEBAPP_URL) sh.getRange(i + 2, cLink + 1).setValue(propPortalLink_(tok));
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('Property portal links filled.');
}

function propPortalLink_(token) {
  return CONFIG.WEBAPP_URL + (CONFIG.WEBAPP_URL.indexOf('?') > -1 ? '&' : '?') + 'p=' + encodeURIComponent(token);
}

/* ============================ web app ============================ */

/** Called from doGet in Code.gs when ?p=TOKEN is present. */
function propertyPage_(p) {
  var token = String(p.p || '');
  var rows = propByToken_(token) || [];
  var t = HtmlService.createTemplateFromFile('PropertyPortal');
  t.payload = JSON.stringify({
    ok: rows.length > 0,
    token: token,
    firstName: rows.length ? (rows[0].contact || rows[0].client).split(' ')[0] : '',
    client: rows.length ? rows[0].client : '',
    stages: PROP.STAGES,
    lines: PROP.LINES,
    risks: rows.map(function (r) {
      return {
        rowIndex: r.rowIndex, location: r.location, occupancy: r.occupancy,
        policy: r.policy, carrier: r.carrier, renewalDate: r.renewalDate, days: r.days,
        values: r.values, total: r.total, premium: r.premium, excess: r.excess,
        email: r.email, mobile: r.mobile,
        stage: r.stage, stageUpdated: r.stageUpdated, status: r.status,
        since: r.since, years: r.years, valuesReviewed: r.valuesReviewed,
        premiumHistory: r.premiumHistory,
        progress: progressFor_(r.token, r.location),
      };
    }),
    agent: { name: CONFIG.AGENT_NAME, phone: CONFIG.AGENT_PHONE },
  });
  return t.evaluate().setTitle('Property Renewal — Guardian Group')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function progressFor_(token, location) {
  var sh = propProgressSheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues()
    .filter(function (r) { return String(r[1]).trim() === String(token).trim(); })
    .map(function (r) {
      return { when: fmtDate_(r[0]), stage: String(r[3]), note: String(r[4]), by: String(r[5]) };
    }).reverse();
}

/* ============================ client submission ============================ */

/**
 * Called from PropertyPortal.html. One submission per POLICY — a policy can
 * cover several locations, and the client instructs on all of them together.
 * payload.locations = [{rowIndex, location, adjusted:{building,stock,...}}]
 */
function submitPropertyInstruction(payload) {
  payload = payload || {};
  var token = String(payload.token || '').trim();
  var rows = propByToken_(token);
  if (!rows) throw new Error('We could not find your property renewal. Please use the link from your renewal email.');

  var instruction = String(payload.instruction || '').slice(0, 120);
  var notes = String(payload.notes || '').slice(0, 2000);
  var locs = payload.locations && payload.locations.length ? payload.locations
           : [{ rowIndex: payload.rowIndex, adjusted: payload.adjusted || {} }];

  // Resolve each submitted location back to its sheet row.
  var parts = [];
  locs.forEach(function (L) {
    var r = rows.filter(function (x) { return String(x.rowIndex) === String(L.rowIndex); })[0];
    if (!r) return;
    var lines = PROP.LINES.map(function (D) {
      var cur = r.values[D.key] || 0;
      var adj = (L.adjusted && L.adjusted[D.key]) ? num_(L.adjusted[D.key]) : '';
      return { label: D.label, current: cur, adjusted: adj };
    });
    var curTotal = lines.reduce(function (s2, l) { return s2 + l.current; }, 0);
    var newTotal = lines.reduce(function (s2, l) { return s2 + (l.adjusted !== '' ? l.adjusted : l.current); }, 0);
    var changed = lines.some(function (l) { return l.adjusted !== '' && l.adjusted !== l.current; });
    parts.push({ row: r, lines: lines, curTotal: curTotal, newTotal: newTotal, changed: changed });
  });
  if (!parts.length) throw new Error('We could not match those locations to your policy.');

  var head = parts[0].row;
  var email = String(payload.email || head.email || '').slice(0, 200);
  var mobile = String(payload.mobile || head.mobile || '').slice(0, 60);
  var policy = String(payload.policy || head.policy || '');
  var anyChanged = parts.some(function (p) { return p.changed; });
  var polCur = parts.reduce(function (s2, p) { return s2 + p.curTotal; }, 0);
  var polNew = parts.reduce(function (s2, p) { return s2 + p.newTotal; }, 0);
  var isTest = (typeof testMode_ === 'function') && testMode_();

  parts.forEach(function (p) {
    appendResponse_({
      'Timestamp': new Date(), 'Token': token, 'Client': p.row.client,
      'Policy #': policy || '(not on file)', 'Coverage': 'Property — ' + (p.row.occupancy || 'risk'),
      'Next Due': p.row.renewalDate, 'Instruction': instruction,
      'Changes / Notes': notes, 'Email': email, 'Mobile': mobile,
      'Risk Location': p.row.location,
      'Current Total Value': p.curTotal,
      'Adjusted Total Value': p.changed ? p.newTotal : '',
      'Emailed To': PROP.CRMS_TO + ' cc ' + PROP.CRMS_CC.join(','),
      'Status': isTest ? 'TEST' : 'Received',
    });
    if (!isTest) {
      setPropCell_(p.row.rowIndex, 'renewal status', instruction + ' — ' + nowStamp_());
      setPropCell_(p.row.rowIndex, 'stage', 'instructed');
      setPropCell_(p.row.rowIndex, 'stage updated', new Date());
      setPropCell_(p.row.rowIndex, 'last client update', new Date());
    }
  });

  if (!isTest) {
    propProgressSheet_().appendRow([new Date(), token, head.client, 'instructed',
      instruction + ' · ' + parts.length + ' location(s)' +
      (anyChanged ? ' · values adjusted to ' + fmtMoney_(polNew) : ' · values unchanged'), 'client']);
  }
  logActivity_(token, head.client, 'property-instruction', 'client',
    instruction + ' · ' + parts.length + ' location(s)' + (anyChanged ? ' · ' + fmtMoney_(polNew) : ''));

  sendPropertyInstructionToCRMS_(head, policy, instruction, parts, anyChanged, polCur, polNew, notes, email, mobile, token);
  if (email) sendPropertyThankYou_(head, policy, instruction, anyChanged, polNew, parts.length, email, token);

  createTask_('Property renewal — ' + head.client + ' (' + (policy || 'policy') + ', ' +
    parts.length + ' location(s)) — client instructed',
    '', head.assignedTo || '', head.client, token, 'system');

  return { ok: true, stage: 'instructed', progress: progressFor_(token, head.location) };
}

function valueTableHtml_(lines, changed, newTotal, curTotal) {
  var rowsHtml = lines.map(function (l) {
    var adj = l.adjusted !== '' ? fmtMoney_(l.adjusted) : '<span style="color:#8a97a8">no change</span>';
    var hi = (l.adjusted !== '' && l.adjusted !== l.current);
    return '<tr>' +
      '<td style="padding:8px 12px;border:1px solid #e3eaf2">' + esc_(l.label) + '</td>' +
      '<td style="padding:8px 12px;border:1px solid #e3eaf2;text-align:right">' + (l.current ? fmtMoney_(l.current) : '—') + '</td>' +
      '<td style="padding:8px 12px;border:1px solid #e3eaf2;text-align:right' + (hi ? ';background:#fdf6e9;font-weight:bold' : '') + '">' + adj + '</td>' +
      '</tr>';
  }).join('');
  return '<table style="border-collapse:collapse;width:100%;max-width:640px;font-size:13.5px">' +
    '<tr><th style="padding:8px 12px;border:1px solid #e3eaf2;background:#003366;color:#fff;text-align:left">Cover</th>' +
    '<th style="padding:8px 12px;border:1px solid #e3eaf2;background:#003366;color:#fff;text-align:right">Current Value</th>' +
    '<th style="padding:8px 12px;border:1px solid #e3eaf2;background:#E8A020;color:#003366;text-align:right">Adjusted Value</th></tr>' +
    rowsHtml +
    '<tr><td style="padding:8px 12px;border:1px solid #e3eaf2;font-weight:bold;background:#f4f7fa">Totals</td>' +
    '<td style="padding:8px 12px;border:1px solid #e3eaf2;text-align:right;font-weight:bold;background:#f4f7fa">' + fmtMoney_(curTotal) + '</td>' +
    '<td style="padding:8px 12px;border:1px solid #e3eaf2;text-align:right;font-weight:bold;background:#fdf6e9">' +
      (changed ? fmtMoney_(newTotal) : '—') + '</td></tr></table>';
}

function sendPropertyInstructionToCRMS_(head, policy, instruction, parts, anyChanged, polCur, polNew, notes, email, mobile, token) {
  var sections = parts.map(function (p) {
    return '<p style="margin:16px 0 6px"><b>📍 ' + esc_(p.row.location || 'Location') + '</b>' +
      (p.row.occupancy ? ' <span style="color:#5a6b80">· ' + esc_(p.row.occupancy) + '</span>' : '') +
      ' — premium ' + fmtMoney_(p.row.premium) + '</p>' +
      valueTableHtml_(p.lines, p.changed, p.newTotal, p.curTotal);
  }).join('');

  var html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433">' +
    '<div style="background:#003366;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">' +
    '<b>PROPERTY RENEWAL INSTRUCTION — received via client portal</b></div>' +
    '<table style="border-collapse:collapse;width:100%;max-width:640px">' +
    tr_('Client', esc_(head.client)) +
    tr_('Contact', esc_(head.contact)) +
    tr_('Policy #', esc_(policy || '(not on file)')) +
    tr_('Renewal date', esc_(head.renewalDate)) +
    tr_('Locations on this policy', String(parts.length)) +
    tr_('Total premium on record', fmtMoney_(parts.reduce(function (s, p) { return s + (Number(p.row.premium) || 0); }, 0))) +
    tr_('<b>INSTRUCTION</b>', '<b>' + esc_(instruction) + '</b>') +
    (anyChanged
      ? tr_('<b>VALUES ADJUSTED</b>', '<b>Yes — policy total ' + fmtMoney_(polNew) + ' (was ' + fmtMoney_(polCur) + ')</b>')
      : tr_('Values', 'No change requested')) +
    (notes ? tr_('Client notes', esc_(notes)) : '') +
    tr_('Client email', esc_(email || '(none)')) + tr_('Client mobile', esc_(mobile || '(none)')) +
    '</table>' + sections +
    '<p style="color:#5a6b80;font-size:12px;margin-top:14px">Submitted by the insured through the Ricky Rampersad Branch renewal portal (ref ' + esc_(token) + '). ' +
    'Please action the renewal and reply-all with terms so the client can be updated.</p></div>';

  sendMail_({
    to: PROP.CRMS_TO,
    cc: PROP.CRMS_CC.filter(String).join(','),
    replyTo: email || undefined,
    name: CONFIG.FROM_NAME,
    subject: 'PROPERTY RENEWAL INSTRUCTION — ' + head.client + (policy ? ' — ' + policy : '') +
             ' — ' + parts.length + ' location(s)' + (anyChanged ? ' (VALUES ADJUSTED)' : ''),
    htmlBody: html,
  });
}

function sendPropertyThankYou_(r, policy, instruction, changed, newTotal, nLoc, email, token) {
  var link = propPortalLink_(token);
  sendMail_({
    to: email, name: CONFIG.FROM_NAME,
    subject: 'Thank you — your property renewal instruction is with our team',
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_((r.contact || r.client).split(' ')[0]) + ',</p>' +
      '<p>Thank you — we have your instruction for <b>' + esc_(policy ? 'policy ' + policy : r.location) + '</b>' +
      (nLoc > 1 ? ' covering <b>' + nLoc + ' locations</b>' : '') + ': <b>' + esc_(instruction) + '</b>' +
      (changed ? ', with your adjusted values totalling <b>' + fmtMoney_(newTotal) + '</b>' : '') + '.</p>' +
      '<p>It has gone straight to our renewals team at Guardian, and your file is now open. ' +
      'You can follow every step online — we will also email you an update as things move.</p>' +
      ctaBtn_(link, 'Track my renewal progress') +
      eduBox_('<b>What happens next:</b> we obtain your renewal terms, check them against your instructions, ' +
              'and come back to you. Nothing is bound until Guardian confirms and your schedule is issued.') +
      '<p style="font-size:13px;color:#5a6b80">Questions at any time? Reply to this email' +
      (CONFIG.AGENT_PHONE ? ' or call ' + esc_(CONFIG.AGENT_PHONE) : '') + '.</p>' + sig_(),
      'Property renewal'),
  });
}

/* ============================ invitations ============================ */

function sendPropertyInvite_(r) {
  var link = propPortalLink_(r.token);
  var curTotal = r.total || PROP.LINES.reduce(function (s, L) { return s + (r.values[L.key] || 0); }, 0);
  var lines = PROP.LINES.map(function (L) { return { label: L.label, current: r.values[L.key] || 0, adjusted: '' }; });

  sendMail_({
    to: r.email, name: CONFIG.FROM_NAME,
    subject: (r.days !== null && r.days < 0 ? 'Action needed: ' : '') +
             'Your property at ' + r.location + ' renews ' + r.renewalDate + ' — review & advise',
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_((r.contact || r.client).split(' ')[0]) + ',</p>' +
      '<p><b>' + esc_(r.location) + '</b> is due for renewal on <b>' + esc_(r.renewalDate) + '</b>. ' +
      'Please review your sums insured below and advise us of any adjustments.</p>' +
      valueTableHtml_(lines, false, 0, curTotal) +
      '<p style="margin-top:14px">The current premium at this level of cover is <b>' + fmtMoney_(r.premium) + '</b>.</p>' +
      (r.years ? '<p style="background:#e3f2ea;border-left:4px solid #1e7d4f;padding:11px 15px;margin:14px 0;font-size:13.5px">' +
        '🏆 <b>Thank you for ' + esc_(r.years) + ' years with us</b>' + (r.since ? ' — insured since ' + esc_(r.since) : '') + '.</p>' : '') +
      (r.valuesReviewed ? eduBox_('<b style="color:#a05e03">📅 Your sums insured were last reviewed in ' + esc_(r.valuesReviewed) + '.</b> ' +
        'Construction and replacement costs have moved since then — if these figures are no longer realistic, ' +
        'this is the moment to put them right.') : '') +
      ctaBtn_(link, 'Review & advise online') +
      eduBox_('<b style="color:#a05e03">⚠️ Why your values matter — the average clause.</b> ' +
        'If your property is insured for less than it would cost to rebuild or replace today, ' +
        'the insurer reduces <u>every</u> claim in the same proportion. Insure at 70% of value and a ' +
        '$100,000 claim pays $70,000 — even for a small partial loss. The portal shows you exactly ' +
        'what this would mean on your own figures.') +
      eduBox_('<b style="color:#a05e03">💡 Remember your excess</b> — the first portion of every claim is yours to carry. ' +
        'Your portal shows the excess that applies to this policy.') +
      '<p>Reviewing takes two minutes online, and you can adjust any line as you go. ' +
      'Prefer to talk it through? Just reply to this email' +
      (CONFIG.AGENT_PHONE ? ' or call ' + esc_(CONFIG.AGENT_PHONE) : '') + '.</p>' + sig_(),
      'Property renewal'),
  });
}

/** Menu: send property invitations to everyone selected on the Property tab. */
function sendPropertyInvitesToSelection() {
  var ui = SpreadsheetApp.getUi();
  var sh = propSheet_();
  if (SpreadsheetApp.getActiveSheet().getName() !== sh.getName()) {
    ui.alert('Open the "' + PROP.SHEET + '" tab and highlight the rows you want to invite.');
    return;
  }
  fillPropertyLinks();
  var rows = {};
  SpreadsheetApp.getActiveRangeList().getRanges().forEach(function (rg) {
    for (var i = rg.getRow(); i <= rg.getLastRow(); i++) if (i > 1) rows[i] = true;
  });
  var wanted = Object.keys(rows).map(Number);
  if (!wanted.length) { ui.alert('Highlight at least one property row first.'); return; }

  var all = allProperties_();
  var sent = [], skipped = [];
  wanted.forEach(function (n) {
    var r = all.filter(function (x) { return x.rowIndex === n; })[0];
    if (!r) return;
    if (!r.email || !/@/.test(r.email)) { skipped.push((r.client || 'Row ' + n) + ' — no email'); return; }
    try {
      sendPropertyInvite_(r);
      if (!(testMode_ && testMode_())) {
        setPropCell_(n, 'renewal status', 'Invitation sent ' + nowStamp_());
        setPropCell_(n, 'reminders sent', (r.remindersSent ? r.remindersSent + '; ' : '') + 'invite@' + nowStamp_());
      }
      logActivity_(r.token, r.client, 'property-invite', Session.getEffectiveUser().getEmail(), r.location);
      sent.push(r.client + ' — ' + r.location);
    } catch (e) { skipped.push((r.client || 'Row ' + n) + ' — ' + e); }
  });
  ui.alert('Property invitations',
    '✅ Sent: ' + sent.length + (sent.length ? '\n' + sent.join('\n') : '') +
    (skipped.length ? '\n\n⚠ Skipped: ' + skipped.length + '\n' + skipped.join('\n') : ''), ui.ButtonSet.OK);
}

/* ============================ progress & follow-ups ============================ */

/** Staff action: move a property renewal to the next stage and tell the client. */
function advancePropertyStage(token, stageKey, note, by) {
  var rows = propByToken_(token);
  if (!rows) throw new Error('Property renewal not found.');
  var r = rows[0];
  var stage = PROP.STAGES.filter(function (s) { return s.key === stageKey; })[0];
  if (!stage) throw new Error('Unknown stage: ' + stageKey);

  rows.forEach(function (x) {
    setPropCell_(x.rowIndex, 'stage', stageKey);
    setPropCell_(x.rowIndex, 'stage updated', new Date());
  });
  propProgressSheet_().appendRow([new Date(), token, r.client, stageKey, note || '', by || 'staff']);
  logActivity_(token, r.client, 'property-stage', by || 'staff', stage.label + (note ? ' — ' + note : ''));

  if (r.email) {
    var done = stageKey === 'issued';
    sendMail_({
      to: r.email, name: CONFIG.FROM_NAME,
      subject: done ? 'Your property renewal is complete — schedule issued'
                    : 'Renewal update: ' + stage.label + ' — ' + r.location,
      htmlBody: brandWrap_(
        '<p>Dear ' + esc_((r.contact || r.client).split(' ')[0]) + ',</p>' +
        '<p>An update on your renewal for <b>' + esc_(r.location) + '</b>:</p>' +
        eduBox_('<b>' + esc_(stage.label) + '</b><br>' + esc_(stage.blurb) + (note ? '<br><br>' + esc_(note) : '')) +
        (done ? '<p>Thank you for renewing with us — your documents are on their way. ' +
                'Please check your schedule carefully and keep it safe.</p>'
              : ctaBtn_(propPortalLink_(token), 'View my renewal progress')) +
        sig_(), 'Renewal progress'),
    });
    setPropCell_(r.rowIndex, 'last client update', new Date());
  }
  return { ok: true };
}

/**
 * Daily follow-ups. Call this from your existing daily trigger (or add it
 * to dailyAutomation in Code.gs).
 *   • staff nudge every PROP.STAFF_FOLLOWUP_DAYS while a file is open
 *   • client progress note every PROP.CLIENT_FOLLOWUP_DAYS
 * Both stop at the 'issued' stage.
 */
function dailyPropertyFollowUps() {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  function daysSince(v) {
    var d = asDate_(v); if (!d) return null;
    d.setHours(0, 0, 0, 0);
    return Math.round((today - d) / 86400000);
  }
  var open = allProperties_().filter(function (r) { return r.stage && r.stage !== 'issued'; });
  var staffNudges = 0, clientNotes = 0;

  open.forEach(function (r) {
    var stage = PROP.STAGES.filter(function (s) { return s.key === r.stage; })[0] || PROP.STAGES[0];

    // ---- staff every 3 days ----
    var sinceStaff = daysSince(r.lastStaffNudge) === null ? daysSince(r.stageUpdated) : daysSince(r.lastStaffNudge);
    if (sinceStaff !== null && sinceStaff >= PROP.STAFF_FOLLOWUP_DAYS) {
      createTask_('Chase property renewal — ' + r.client + ' (' + r.location + ') — ' + stage.label +
        ' for ' + sinceStaff + ' days', '', r.assignedTo || '', r.client, r.token, 'system');
      setPropCell_(r.rowIndex, 'last staff nudge', new Date());
      staffNudges++;
    }

    // ---- client every 5 days ----
    var sinceClient = daysSince(r.lastClientUpdate);
    if (r.email && sinceClient !== null && sinceClient >= PROP.CLIENT_FOLLOWUP_DAYS) {
      sendMail_({
        to: r.email, name: CONFIG.FROM_NAME,
        subject: 'Still on it — your property renewal for ' + r.location,
        htmlBody: brandWrap_(
          '<p>Dear ' + esc_((r.contact || r.client).split(' ')[0]) + ',</p>' +
          '<p>A quick note so you are never left wondering. Your renewal for <b>' + esc_(r.location) +
          '</b> is at this stage:</p>' +
          eduBox_('<b>' + esc_(stage.label) + '</b><br>' + esc_(stage.blurb)) +
          ctaBtn_(propPortalLink_(r.token), 'Track my renewal') +
          '<p style="font-size:13px;color:#5a6b80">We will keep you posted until your schedule is delivered.</p>' +
          sig_(), 'Renewal progress'),
      });
      if (!(testMode_ && testMode_())) setPropCell_(r.rowIndex, 'last client update', new Date());
      clientNotes++;
    }
  });
  Logger.log('dailyPropertyFollowUps: %s staff nudges, %s client updates', staffNudges, clientNotes);
}

/* ============================ menu ============================ */

function propertyMenu_(ui) {
  return ui.createMenu('🏠 Property Renewals')
    .addItem('▶ Send renewal invite — selected row(s)', 'sendPropertyInvitesToSelection')
    .addItem('🔗 Fill property portal links', 'fillPropertyLinks')
    .addSeparator()
    .addItem('🔄 Run property follow-ups now', 'dailyPropertyFollowUps')
    .addItem('👁 Preview a property portal (row 2)', 'showPropertyLink');
}

function showPropertyLink() {
  var rows = allProperties_();
  if (!rows.length) { SpreadsheetApp.getUi().alert('No property rows yet — add them to the "' + PROP.SHEET + '" tab.'); return; }
  SpreadsheetApp.getUi().alert('Property portal link (first row):\n\n' + propPortalLink_(rows[0].token));
}
