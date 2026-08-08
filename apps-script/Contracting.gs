/**
 * ============================================================
 *  CONTRACTS — Ricky Rampersad Private
 * ============================================================
 *  Backend for /contracting/ — the VUMI® Producer/Agent packet.
 *
 *  Paste this into its OWN Apps Script project (not the renewal
 *  one — both define doGet/doPost and only one can win).
 *
 *  What it does:
 *   1. Holds each applicant's answers so they can start on a
 *      phone and finish on a laptop (doGet ?action=load).
 *   2. Saves progress as they type (doPost action=save) into a
 *      "Contracting" sheet plus one Drive folder per applicant.
 *   3. Receives the finished packet (doPost action=submit),
 *      files the three PDFs and any uploads in Drive, emails the
 *      applicant a copy and tells you it landed.
 *   4. CHASES THE UNFINISHED ONES. A daily check emails anyone
 *      who has stalled, telling them exactly which answers are
 *      still missing, on a spacing that widens as it goes —
 *      and stops the moment they submit.
 *   5. Serves the recruiter dashboard (/contracting/admin.html).
 *
 *  ONE-TIME SETUP (see CONTRACTING-SETUP.md in the repo):
 *   a. Fill in CONFIG below — especially ADMIN_KEY and PORTAL_BASE.
 *   b. Run setupContracting() once and authorise the permissions.
 *   c. Deploy → New deployment → Web app →
 *      Execute as: Me · Who has access: Anyone →
 *      copy the /exec URL into contracting/app.js (CONFIG.API_URL)
 *      and contracting/admin.js (CONFIG.API_URL).
 * ============================================================
 */

var CONFIG = {
  // --- Your details -----------------------------------------------------
  // This is the private practice, not the Guardian branch. Everything an
  // applicant or a partner sees comes from here, so keep it private-side:
  // RECRUITER_EMAIL is the From and Reply-to on every outgoing letter.
  RECRUITER_NAME: 'Ricky Rampersad',
  RECRUITER_EMAIL: 'rampersadricky@gmail.com',
  RECRUITER_PHONE: '(868) 678-5921',
  BRAND_NAME: 'Ricky Rampersad Private',

  // --- Where a finished packet goes -------------------------------------
  // The signed forms are emailed here the moment the applicant submits.
  CARRIER_NAME: 'Amalia Suraz',
  CARRIER_EMAIL: 'contracts@woagp.com',

  // Everyone who gets a copy of each submission and of the chasing.
  // Internal copies only — these never appear to an applicant or a partner.
  COPY_TO: [
    'rampersadricky@gmail.com',
    'kamla.dookran@myguardiangroup.com',
  ],

  // --- Portal ------------------------------------------------------------
  // The applicant's personal link is this with their token appended:
  // https://rickyrampersadbranch.com/contracting/?t=AB12CD34
  PORTAL_BASE: 'https://rickyrampersadbranch.com/contracting/?t=',

  // Where an applicant tracks progress after submitting, with the short
  // code they are given. Shows progress only — never their personal data.
  STATUS_BASE: 'https://rickyrampersadbranch.com/contracting/status.html?c=',

  // --- Admin -------------------------------------------------------------
  // Shared secret the recruiter dashboard sends with every request.
  // CHANGE THIS before deploying — anyone with it can read applicant data.
  ADMIN_KEY: 'change-me-before-deploying',

  // --- Follow-up cadence -------------------------------------------------
  // Days to wait before each reminder, widening as it goes. Once the list
  // runs out the applicant is marked "Stalled" and you get told.
  REMINDER_SPACING: [2, 3, 4, 7, 7, 14, 14, 21],
  QUIET_DAYS: 2,     // don't chase someone who edited it in the last 2 days
  DAILY_HOUR: 9,     // hour of day (0-23) the check runs

  // --- Chasing the carrier ----------------------------------------------
  // Days to wait before each follow-up to the carrier after a packet is
  // sent, until they reply. Replies are spotted automatically (see
  // checkCarrierReplies_) or marked by hand from the dashboard.
  CARRIER_FOLLOWUP_SPACING: [3, 4, 7, 7, 14],

  // --- Storage -----------------------------------------------------------
  SHEET_NAME: 'Contracting',
  ACCESS_SHEET: 'Access',
  DRIVE_FOLDER: 'VUMI Contracting',

  // --- Who can sign in ---------------------------------------------------
  // Everyone signs in with an agent number and a passcode, both kept in the
  // "Access" tab of the sheet.
  //
  // The numbers below are yours to set — use whatever you already answer to.
  // Passcodes are NOT set here on purpose: this file lives in a git
  // repository, and a passcode written into it is a passcode published.
  // setupContracting() generates one for each of you and shows it once; to
  // choose your own, type it straight into the Access tab, or run
  // setPasscode('A00427', 'whatever-you-want') from the editor.
  //
  // Agents you invite are numbered RRP-001, RRP-002, … — a separate series,
  // so they can never collide with the numbers below.
  STAFF: [
    { number: 'A00427', name: 'Ricky Rampersad', role: 'manager',
      email: 'rampersadricky@gmail.com' },
    { number: 'A00428', name: 'Kamla Dookran', role: 'assistant',
      email: 'kamla.dookran@myguardiangroup.com' },
  ],
};

/**
 * Who a contract can be written with, grouped by line of business.
 *
 * This desk is not only insurance — real estate and premium financing run
 * through it too, and each of those will have its own paperwork. Only VUMI
 * has forms behind it today; the rest are listed so the shape is visible and
 * so adding one is a matter of dropping in its PDFs, mapping the fields in
 * packet.js, and flipping `available`.
 *
 * Nothing here is Guardian business.
 */
var CARRIERS = [
  { id: 'vumi', name: 'VUMI® Group', category: 'International Insurance', available: true },
  { id: 'bestdoctors', name: 'Best Doctors Insurance', category: 'International Insurance', available: false },
  { id: 'realestate', name: 'Real Estate', category: 'Property', available: false },
  { id: 'premiumfinance', name: 'Premium Financing', category: 'Finance', available: false },
];

var ACCESS_HEADERS = [
  'Agent Number', 'Passcode', 'Name', 'Role', 'Email', 'Mobile',
  'Language', 'Active', 'Token', 'Last Login',
];

var ACC = {
  NUMBER: 0, PASSCODE: 1, NAME: 2, ROLE: 3, EMAIL: 4, MOBILE: 5,
  LANG: 6, ACTIVE: 7, TOKEN: 8, LAST_LOGIN: 9,
};

/* New columns are appended, never inserted — ensureSheet_ adds any that a
   sheet created by an earlier version is missing, and existing data stays
   where it is. */
var HEADERS = [
  'Started', 'Token', 'Name', 'Email', 'Mobile', 'Language', 'Status',
  'Percent', 'Missing', 'Last Update', 'Submitted', 'Reminders Sent',
  'Last Reminder', 'Folder', 'Portal Link', 'Notes',
  'Tracking Code', 'Stage', 'Stage Updated', 'Sent To Carrier',
  'Carrier Ref', 'Carrier Replied', 'Carrier Chases', 'Last Carrier Chase',
  'Activity', 'Partner', 'Agent Number',
];

var COL = {
  STARTED: 0, TOKEN: 1, NAME: 2, EMAIL: 3, MOBILE: 4, LANG: 5, STATUS: 6,
  PERCENT: 7, MISSING: 8, UPDATED: 9, SUBMITTED: 10, REMINDERS: 11,
  LAST_REMINDER: 12, FOLDER: 13, LINK: 14, NOTES: 15,
  CODE: 16, STAGE: 17, STAGE_UPDATED: 18, CARRIER_SENT: 19,
  CARRIER_REF: 20, CARRIER_REPLIED: 21, CARRIER_CHASES: 22, LAST_CHASE: 23,
  ACTIVITY: 24, PARTNER: 25, AGENT_NO: 26,
};

/**
 * What the applicant sees on their progress bar, one step per milestone.
 * Submitting completes the first two in one go — the packet reaches the
 * carrier the moment it is signed — so a freshly submitted application
 * lands on "under review" at three of four, which is true: everything the
 * agent can do is done, and only the carrier's answer is outstanding.
 */
var STAGES = [
  { id: 'received', es: 'Solicitud recibida y firmada', en: 'Application received and signed' },
  { id: 'sent', es: 'Enviada a VUMI®', en: 'Sent to VUMI®' },
  { id: 'review', es: 'En revisión por VUMI®', en: 'Under review by VUMI®' },
  { id: 'approved', es: 'Código de agente emitido', en: 'Agent code issued' },
];

function stageIndex_(id) {
  for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i;
  return 0;
}

/* ======================= SETUP & MENU ======================= */

/** Run this ONCE after pasting the script. */
function setupContracting() {
  ensureSheet_();
  ensureRootFolder_();
  var staff = ensureAccessSheet_();
  enableContractingReminders();
  onOpen();

  if (staff.length) {
    var lines = staff.map(function (person) {
      return person.name + '  ' + person.number + '  passcode: ' + person.passcode;
    }).join('\n');
    Logger.log('Staff logins created:\n' + lines);
    try {
      SpreadsheetApp.getUi().alert('Staff logins created\n\n' + lines +
        '\n\nThese are in the "Access" tab. Change a passcode there any time.');
    } catch (e) { /* headless */ }
  }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('📝 Contracting')
      .addItem('Invite an agent…', 'promptInvite')
      .addItem('Show my sign-in details', 'showLogins')
      .addItem('Send reminders now', 'dailyContractingCheck')
      .addSeparator()
      .addItem('Turn automatic reminders ON', 'enableContractingReminders')
      .addItem('Turn automatic reminders OFF', 'disableContractingReminders')
      .addToUi();
  } catch (e) { /* not opened from the sheet */ }
}

function enableContractingReminders() {
  removeContractingTriggers_();
  ScriptApp.newTrigger('dailyContractingCheck')
    .timeBased().everyDays(1).atHour(CONFIG.DAILY_HOUR).create();
  try {
    SpreadsheetApp.getUi().alert('Automatic reminders are ON. Every day around ' +
      CONFIG.DAILY_HOUR + ':00 anyone who has stalled gets a nudge listing exactly what is missing.');
  } catch (e) { /* headless */ }
}

function disableContractingReminders() {
  removeContractingTriggers_();
  try { SpreadsheetApp.getUi().alert('Automatic reminders are OFF.'); } catch (e) { /* headless */ }
}

function removeContractingTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'dailyContractingCheck') ScriptApp.deleteTrigger(trigger);
  });
}

/**
 * Change somebody's passcode from the editor.
 *
 *   setPasscode('A00427', 'my-new-code')
 *
 * The same thing happens if you just type over the cell in the Access tab —
 * this is here for when that is quicker.
 */
function setPasscode(agentNumber, newPasscode) {
  var row = findAccessRow_(agentNumber);
  if (!row) { Logger.log('No such agent number: %s', agentNumber); return; }
  var code = String(newPasscode || '').trim();
  if (!code) { Logger.log('Give a passcode.'); return; }
  accessSheet_().getRange(row.index, ACC.PASSCODE + 1).setValue(code);
  Logger.log('%s (%s) can now sign in with: %s', row.values[ACC.NAME], agentNumber, code);
}

/** Print who can sign in, and with what. Run it any time you forget. */
function showLogins() {
  var values = accessSheet_().getDataRange().getValues();
  var lines = [];
  for (var r = 1; r < values.length; r++) {
    if (!values[r][ACC.NUMBER]) continue;
    if (String(values[r][ACC.ROLE] || '').toLowerCase() === 'agent') continue;
    lines.push(values[r][ACC.NAME] + '  ' + values[r][ACC.NUMBER] +
      '  passcode: ' + values[r][ACC.PASSCODE] +
      (String(values[r][ACC.ACTIVE] || '').toLowerCase() === 'no' ? '  (switched off)' : ''));
  }
  Logger.log('Staff logins:\n' + lines.join('\n'));
  try { SpreadsheetApp.getUi().alert('Staff logins\n\n' + lines.join('\n')); } catch (e) { /* headless */ }
}

/** Menu helper: invite someone without leaving the sheet. */
function promptInvite() {
  var ui = SpreadsheetApp.getUi();
  var name = ui.prompt('Invite an agent', "Agent's full name:", ui.ButtonSet.OK_CANCEL);
  if (name.getSelectedButton() !== ui.Button.OK) return;
  var email = ui.prompt('Invite an agent', "Agent's email:", ui.ButtonSet.OK_CANCEL);
  if (email.getSelectedButton() !== ui.Button.OK) return;
  var result = inviteAgent_({
    name: name.getResponseText(),
    email: email.getResponseText(),
    mobile: '',
    lang: 'es',
  });
  ui.alert(result.ok ? 'Invitation sent to ' + email.getResponseText() + '\n\nTheir link:\n' + result.link
                     : 'Could not send: ' + result.error);
}

/* ======================= WEB ENDPOINTS ======================= */

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || 'load');

  try {
    if (action === 'ping') return json_({ ok: true, service: 'contracting' });
    if (action === 'partners') return json_({ ok: true, carriers: CARRIERS });

    if (action === 'load') {
      var token = normaliseToken_(params.token);
      if (!token) return json_({ found: false });
      var row = findRow_(token);
      if (!row) return json_({ found: false });
      var saved = readApplication_(token);
      return json_({
        found: true,
        data: saved.data || null,
        step: saved.step || 0,
        status: row.values[COL.STATUS],
        percent: row.values[COL.PERCENT],
      });
    }

    /* The applicant's tracking code. Deliberately returns a stage and
       nothing else — no addresses, no bank details, no documents — so the
       code is safe to read down the phone or paste into a chat. */
    if (action === 'status') {
      var row = findRowByCode_(params.code);
      if (!row) return json_({ found: false });
      var lang = String(params.lang || row.values[COL.LANG] || 'es') === 'en' ? 'en' : 'es';
      var current = stageIndex_(String(row.values[COL.STAGE] || 'received'));
      return json_({
        found: true,
        firstName: firstName_(row.values[COL.NAME]),
        stage: STAGES[current].id,
        stageIndex: current,
        stageLabel: STAGES[current][lang],
        percent: Math.round(((current + 1) / STAGES.length) * 100),
        stages: STAGES.map(function (stage, i) {
          return { id: stage.id, label: stage[lang], done: i <= current };
        }),
        submitted: isoOrBlank_(row.values[COL.SUBMITTED]),
        stageUpdated: isoOrBlank_(row.values[COL.STAGE_UPDATED]),
        carrierReplied: !!row.values[COL.CARRIER_REPLIED],
        note: String(row.values[COL.NOTES] || ''),
      });
    }

    if (action === 'list') {
      if (!authorised_(params.key)) return json_({ ok: false, error: 'unauthorised' });
      return json_({ ok: true, applicants: listApplicants_() });
    }

    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad payload' });
  }

  try {
    var action = String(payload.action || '');

    if (action === 'login') return json_(signIn_(payload));
    if (action === 'register') return json_(registerAgent_(payload));
    if (action === 'openContract') return json_(openContract_(payload));
    if (action === 'save') return json_(saveProgress_(payload));
    if (action === 'submit') return json_(submitPacket_(payload));

    /* Everything below is the recruiter's side of the desk. */
    if (!authorised_(payload.key)) return json_({ ok: false, error: 'unauthorised' });
    if (action === 'invite') return json_(inviteAgent_(payload));
    if (action === 'nudge') return json_(nudgeNow_(payload.token));
    if (action === 'status') return json_(setStatus_(payload.token, payload.status, payload.notes));
    if (action === 'stage') return json_(setStage_(payload.token, payload.stage, payload.notes));
    if (action === 'chase') return json_(chaseCarrierNow_(payload.token));
    if (action === 'carrierReplied') return json_(markCarrierReplied_(payload.token));

    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function authorised_(key) {
  return String(key || '') === CONFIG.ADMIN_KEY && CONFIG.ADMIN_KEY !== '';
}

/* ======================= APPLICANT ACTIONS ======================= */

/** Autosave from the wizard — upsert the row, park the answers in Drive. */
function saveProgress_(p) {
  var token = normaliseToken_(p.token);
  if (!token) return { ok: false, error: 'no token' };

  var sheet = ensureSheet_();
  var row = findRow_(token);
  var now = new Date();
  var percent = Number(p.percent) || 0;
  var missing = (p.missing || []).join('; ');

  if (!row) {
    sheet.appendRow([
      now, token, p.name || '', p.email || '', p.mobile || '', p.lang || 'es',
      'In progress', percent, missing, now, '', 0, '', '', CONFIG.PORTAL_BASE + token, '',
      '', '', '', '', '', '', 0, '', '', p.partner || '', p.agentNumber || '',
    ]);
    row = findRow_(token);
  } else {
    var status = row.values[COL.STATUS];
    if (status !== 'Submitted') {
      sheet.getRange(row.index, COL.STATUS + 1).setValue('In progress');
    }
    if (p.name) sheet.getRange(row.index, COL.NAME + 1).setValue(p.name);
    if (p.email) sheet.getRange(row.index, COL.EMAIL + 1).setValue(p.email);
    if (p.mobile) sheet.getRange(row.index, COL.MOBILE + 1).setValue(p.mobile);
    sheet.getRange(row.index, COL.PERCENT + 1).setValue(percent);
    sheet.getRange(row.index, COL.MISSING + 1).setValue(missing);
    sheet.getRange(row.index, COL.UPDATED + 1).setValue(now);
  }

  writeApplication_(token, { data: p.data, step: p.step || 0, savedAt: now.toISOString() });
  return { ok: true };
}

/**
 * The finished packet: file it in Drive, send it to the carrier with the
 * team copied, thank the applicant and hand them their tracking code.
 */
function submitPacket_(p) {
  var token = normaliseToken_(p.token);
  if (!token) return { ok: false, error: 'no token' };

  saveProgress_(p);

  var folder = applicantFolder_(token, p.name);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  /* Built once: the same blobs are filed in Drive and attached to the
     emails, so what the carrier receives is what is on record. */
  var pdfBlobs = (p.pdfs || []).filter(function (pdf) { return pdf && pdf.base64; })
    .map(function (pdf) {
      return Utilities.newBlob(Utilities.base64Decode(pdf.base64), 'application/pdf', pdf.name);
    });

  var uploadBlobs = (p.uploads || []).filter(function (upload) { return upload && upload.dataUrl; })
    .map(function (upload) {
      var parts = String(upload.dataUrl).split(',');
      if (parts.length < 2) return null;
      return Utilities.newBlob(Utilities.base64Decode(parts[1]),
        upload.type || 'application/octet-stream', upload.name || 'documento');
    }).filter(Boolean);

  pdfBlobs.forEach(function (blob) {
    folder.createFile(blob.copyBlob().setName(stamp + ' ' + blob.getName()));
  });
  uploadBlobs.forEach(function (blob) { folder.createFile(blob.copyBlob()); });

  var sheet = ensureSheet_();
  var row = findRow_(token);
  var now = new Date();
  var code = row ? String(row.values[COL.CODE] || '') : '';
  if (!code) code = makeTrackingCode_();
  var ref = 'VUMI-' + token;

  if (row) {
    sheet.getRange(row.index, COL.STATUS + 1).setValue('Submitted');
    sheet.getRange(row.index, COL.SUBMITTED + 1).setValue(now);
    sheet.getRange(row.index, COL.FOLDER + 1).setValue(folder.getUrl());
    sheet.getRange(row.index, COL.CODE + 1).setValue(code);
    sheet.getRange(row.index, COL.STAGE + 1).setValue('review');
    sheet.getRange(row.index, COL.STAGE_UPDATED + 1).setValue(now);
    sheet.getRange(row.index, COL.CARRIER_SENT + 1).setValue(now);
    sheet.getRange(row.index, COL.CARRIER_REF + 1).setValue(ref);
    sheet.getRange(row.index, COL.CARRIER_CHASES + 1).setValue(0);
  }

  sendToCarrier_(p, folder, pdfBlobs.concat(uploadBlobs), ref);
  sendApplicantThanks_(p, pdfBlobs, code);
  logActivity_(findRow_(token), 'Signed and submitted — sent to ' + CONFIG.CARRIER_NAME +
    ' with ' + pdfBlobs.length + ' forms and ' + uploadBlobs.length + ' documents');
  return { ok: true, folder: folder.getUrl(), code: code };
}

/* ======================= RECRUITER ACTIONS ======================= */

function inviteAgent_(p) {
  var name = String(p.name || '').trim();
  var email = String(p.email || '').trim();
  if (!email) return { ok: false, error: 'no email' };

  /* Which contracts this person is being sent. One application is opened per
     partner, so the same agent can be contracted with several companies and
     each one is tracked, chased and submitted on its own. */
  var partners = (p.partners || []).map(function (x) { return String(x || '').trim(); }).filter(String);
  if (!partners.length) partners = [availablePartnerNames_()[0] || 'VUMI® Group'];

  /* Their sign-in details travel with the invitation — the agent number and
     passcode are how they get in, the link just saves them typing. */
  var access = issueAgentAccess_({ name: name, email: email, mobile: p.mobile, lang: p.lang });
  var opened = partners.map(function (partner) {
    return openContract_({ agentNumber: access.number, partner: partner });
  }).filter(function (r) { return r && r.ok; });

  var token = opened.length ? opened[0].token : '';
  var link = CONFIG.PORTAL_BASE.replace(/\?t=$/, '');

  var lang = p.lang === 'es' ? 'es' : 'en';
  var from = String(p.invitedBy || '').trim() || CONFIG.RECRUITER_NAME;
  var subject = lang === 'es'
    ? 'Invitación para contratarse — ' + CONFIG.BRAND_NAME
    : 'Your invitation to get contracted — ' + CONFIG.BRAND_NAME;

  MailApp.sendEmail({
    to: email,
    replyTo: CONFIG.RECRUITER_EMAIL,
    subject: subject,
    htmlBody: emailShell_(
      lang === 'es' ? 'Invitación a contratarse' : 'An invitation to get contracted',
      invitationLetter_(name, access, link, from, lang, partners)),
  });

  opened.forEach(function (o) {
    logActivity_(findRow_(o.token), (lang === 'es' ? 'Invitación enviada por ' : 'Invitation sent by ') +
      from + ' — ' + partners.length + ' contract' + (partners.length > 1 ? 's' : ''));
  });
  return { ok: true, token: token, link: link, partners: partners,
           agentNumber: access.number, passcode: access.passcode };
}

/**
 * The invitation itself — a letter, not a notification.
 *
 * Someone deciding whether to take on a new carrier deserves to be told what
 * they are being offered, what it will cost them in time, and what to have
 * on the table before they start. The sign-in details and the button sit in
 * the middle of that, not instead of it.
 */
function invitationLetter_(name, access, link, from, lang, partners) {
  var firstName = esc_(firstName_(name));
  var list = [].concat(partners || []).filter(String);
  if (!list.length) list = ['VUMI® Group'];
  var who = esc_(list.length === 1 ? list[0]
    : list.slice(0, -1).join(', ') + (lang === 'es' ? ' y ' : ' and ') + list[list.length - 1]);
  var many = list.length > 1;
  var phone = esc_(CONFIG.RECRUITER_PHONE);
  var p = 'margin:0 0 14px';
  var listStyle = 'margin:0 0 18px;padding-left:20px;color:#33475b';
  var heading = 'margin:22px 0 8px;font-size:15px;font-weight:800;color:#0E2A47';

  if (lang === 'es') {
    return '' +
      '<p style="' + p + '">Estimado(a) ' + firstName + ',</p>' +

      '<p style="' + p + '">Me complace invitarle a completar su contratación con <b>' + who +
      '</b> a través de ' + esc_(CONFIG.BRAND_NAME) + '.</p>' +
      (many ? '<p style="' + p + '">Son ' + list.length + ' contratos. Responda sus datos una vez y ' +
        'los reutilizamos en los demás — sólo tendrá que revisarlos y firmar cada uno.</p>' : '') +

      '<p style="' + p + '">Esta es una línea privada, independiente de cualquier otra representación ' +
      'que usted o yo tengamos. Contratarse le pone ese producto en las manos, junto a todo lo demás ' +
      'que usted ya coloca.</p>' +

      '<div style="' + heading + '">Qué implica</div>' +
      '<p style="' + p + '">Los formularios propios de la compañía — en el caso de VUMI®, la ' +
      'Solicitud de Productor/Agente de once páginas, el Formulario para Designación de Beneficiario ' +
      'y el W-8BEN del IRS. Usted responde cada pregunta una sola vez y el sistema los llena todos ' +
      'por usted — su firma, sus iniciales en cada página, todo.</p>' +
      '<p style="' + p + '">Unos <b>15 minutos</b>. Puede detenerse y seguir después; no se pierde nada.</p>' +

      '<div style="' + heading + '">Tenga a mano</div>' +
      '<ul style="' + listStyle + '">' +
        '<li>Su identificación con foto o pasaporte</li>' +
        '<li>Sus datos bancarios para el pago de comisiones</li>' +
        '<li>Dos referencias personales y dos referencias bancarias</li>' +
      '</ul>' +

      credentialBlock_(access, lang) +
      button_(link, 'Comenzar mi contratación') +

      '<p style="' + p + '">Cuando lo envíe, su paquete va directo a ' + who + ' y usted recibe un ' +
      'código para seguir el avance hasta que le emitan su código de agente.</p>' +

      '<p style="' + p + '">Si algo se le complica, llámeme al ' + phone + '. Prefiero resolverlo en dos ' +
      'minutos por teléfono que dejarlo a usted atascado.</p>' +

      '<p style="margin:22px 0 4px">Bienvenido(a) a bordo,</p>' +
      '<p style="margin:0;font-weight:800;color:#0E2A47">' + esc_(from) + '</p>' +
      '<p style="margin:2px 0 0;font-size:13px;color:#7a8ca0">' + esc_(CONFIG.BRAND_NAME) + ' · ' + phone + '</p>';
  }

  return '' +
    '<p style="' + p + '">Dear ' + firstName + ',</p>' +

    '<p style="' + p + '">I would like to invite you to complete your contracting with <b>' + who +
    '</b> through ' + esc_(CONFIG.BRAND_NAME) + '.</p>' +
    (many ? '<p style="' + p + '">That is ' + list.length + ' contracts. Answer your details once and ' +
      'we carry them across the rest — you only review them and sign each one.</p>' : '') +

    '<p style="' + p + '">This is a private line, independent of any other representation you or I ' +
    'hold. Getting contracted puts that product in your hands, alongside everything else you ' +
    'already write.</p>' +

    '<div style="' + heading + '">What it involves</div>' +
    '<p style="' + p + '">The partner\'s own forms — for VUMI® that is the eleven-page ' +
    'Producer/Agent application, the Beneficiary Designation and the IRS Form W-8BEN. You answer ' +
    'each question once and the system fills every form for you — your signature, your initials on ' +
    'every page, the lot.</p>' +
    '<p style="' + p + '">About <b>15 minutes</b>. You can stop and pick it up later; nothing is lost.</p>' +

    '<div style="' + heading + '">What to have with you</div>' +
    '<ul style="' + listStyle + '">' +
      '<li>Photo ID or passport</li>' +
      '<li>Bank details for your commission payments</li>' +
      '<li>Two personal references and two bank references</li>' +
    '</ul>' +

    credentialBlock_(access, lang) +
    button_(link, 'Start my contracting') +

    '<p style="' + p + '">Once you send it, your packet goes straight to ' + who + ' and you get a ' +
    'tracking code to follow it through to your agent code.</p>' +

    '<p style="' + p + '">If anything gets in the way, call me on ' + phone + '. I would far rather ' +
    'sort it out in two minutes on the phone than leave you stuck.</p>' +

    '<p style="margin:22px 0 4px">Welcome aboard,</p>' +
    '<p style="margin:0;font-weight:800;color:#0E2A47">' + esc_(from) + '</p>' +
    '<p style="margin:2px 0 0;font-size:13px;color:#7a8ca0">' + esc_(CONFIG.BRAND_NAME) + ' · ' + phone + '</p>';
}

function nudgeNow_(token) {
  var row = findRow_(normaliseToken_(token));
  if (!row) return { ok: false, error: 'not found' };
  sendReminder_(row, true);
  return { ok: true };
}

function setStatus_(token, status, notes) {
  var sheet = ensureSheet_();
  var row = findRow_(normaliseToken_(token));
  if (!row) return { ok: false, error: 'not found' };
  if (status) {
    sheet.getRange(row.index, COL.STATUS + 1).setValue(status);
    logActivity_(row, 'Status set to ' + status);
  }
  if (notes !== undefined && notes !== null) sheet.getRange(row.index, COL.NOTES + 1).setValue(notes);
  return { ok: true };
}

/**
 * Move an applicant along their progress bar. Reaching "approved" tells
 * them their code has been issued and closes the carrier follow-ups.
 */
function setStage_(token, stage, notes) {
  var sheet = ensureSheet_();
  var row = findRow_(normaliseToken_(token));
  if (!row) return { ok: false, error: 'not found' };

  var valid = STAGES.some(function (s) { return s.id === stage; });
  if (!valid) return { ok: false, error: 'unknown stage' };

  sheet.getRange(row.index, COL.STAGE + 1).setValue(stage);
  sheet.getRange(row.index, COL.STAGE_UPDATED + 1).setValue(new Date());
  logActivity_(row, 'Moved to "' + STAGES[stageIndex_(stage)].en + '"');
  if (notes !== undefined && notes !== null) sheet.getRange(row.index, COL.NOTES + 1).setValue(notes);

  if (stage === 'approved') {
    sheet.getRange(row.index, COL.STATUS + 1).setValue('Approved');
    if (!row.values[COL.CARRIER_REPLIED]) {
      sheet.getRange(row.index, COL.CARRIER_REPLIED + 1).setValue(new Date());
    }
    sendApprovedEmail_(row);
  }
  return { ok: true };
}

/** Tell the agent their code came through. */
function sendApprovedEmail_(row) {
  var email = String(row.values[COL.EMAIL] || '');
  if (!email) return;
  var lang = row.values[COL.LANG] === 'en' ? 'en' : 'es';
  var subject = lang === 'es'
    ? '¡Su contratación VUMI® fue aprobada! 🎉'
    : 'Your VUMI® contracting is approved! 🎉';

  MailApp.sendEmail({
    to: email,
    replyTo: CONFIG.RECRUITER_EMAIL,
    subject: subject,
    htmlBody: emailShell_(subject,
      '<p style="margin:0 0 14px">' + (lang === 'es' ? 'Hola ' : 'Hi ') +
      esc_(firstName_(row.values[COL.NAME])) + ',</p>' +
      '<p style="margin:0 0 14px">' + (lang === 'es'
        ? 'VUMI® aprobó su contratación y emitió su código de agente. Ya puede empezar a producir.'
        : 'VUMI® has approved your contracting and issued your agent code. You can start producing.') + '</p>' +
      '<p style="margin:0 0 14px">' + (lang === 'es'
        ? esc_(CONFIG.RECRUITER_NAME) + ' le escribirá con su código y los próximos pasos.'
        : esc_(CONFIG.RECRUITER_NAME) + ' will write to you with your code and the next steps.') + '</p>' +
      button_(CONFIG.STATUS_BASE + (row.values[COL.CODE] || ''),
        lang === 'es' ? 'Ver mi contratación' : 'View my contracting')),
  });
}

function chaseCarrierNow_(token) {
  var row = findRow_(normaliseToken_(token));
  if (!row) return { ok: false, error: 'not found' };
  if (!parseDate_(row.values[COL.CARRIER_SENT])) return { ok: false, error: 'not sent to the carrier yet' };
  sendCarrierFollowUp_(row, (Number(row.values[COL.CARRIER_CHASES]) || 0) + 1);
  return { ok: true };
}

function markCarrierReplied_(token) {
  var sheet = ensureSheet_();
  var row = findRow_(normaliseToken_(token));
  if (!row) return { ok: false, error: 'not found' };
  sheet.getRange(row.index, COL.CARRIER_REPLIED + 1).setValue(new Date());
  return { ok: true };
}

/**
 * Append one line to an applicant's trail.
 *
 * Kept as readable text in a single cell rather than a separate sheet: the
 * manager can see the whole history of an applicant without leaving their
 * row, and the dashboard splits it back apart for the timeline.
 */
function logActivity_(row, text) {
  if (!row || !text) return;
  var sheet = ensureSheet_();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var existing = String(row.values[COL.ACTIVITY] || '').trim();
  var line = stamp + ' — ' + text;
  var updated = existing ? existing + '\n' + line : line;
  /* A cell tops out at 50k characters; a trail this long means something is
     wrong anyway, so keep the recent end and drop the oldest. */
  if (updated.length > 8000) updated = updated.slice(-8000).replace(/^[^\n]*\n/, '');
  sheet.getRange(row.index, COL.ACTIVITY + 1).setValue(updated);
}

/** Partner names that actually have forms behind them today. */
function availablePartnerNames_() {
  return CARRIERS.filter(function (c) { return c.available; }).map(function (c) { return c.name; });
}

function listApplicants_() {
  var sheet = ensureSheet_();
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row[COL.TOKEN]) continue;
    out.push({
      token: row[COL.TOKEN],
      name: row[COL.NAME],
      email: row[COL.EMAIL],
      mobile: row[COL.MOBILE],
      lang: row[COL.LANG],
      status: row[COL.STATUS],
      percent: Number(row[COL.PERCENT]) || 0,
      missing: String(row[COL.MISSING] || '').split('; ').filter(String),
      started: isoOrBlank_(row[COL.STARTED]),
      updated: isoOrBlank_(row[COL.UPDATED]),
      submitted: isoOrBlank_(row[COL.SUBMITTED]),
      reminders: Number(row[COL.REMINDERS]) || 0,
      lastReminder: isoOrBlank_(row[COL.LAST_REMINDER]),
      folder: row[COL.FOLDER],
      link: row[COL.LINK] || (CONFIG.PORTAL_BASE + row[COL.TOKEN]),
      notes: row[COL.NOTES],
      code: row[COL.CODE] || '',
      stage: row[COL.STAGE] || '',
      stageUpdated: isoOrBlank_(row[COL.STAGE_UPDATED]),
      carrierSent: isoOrBlank_(row[COL.CARRIER_SENT]),
      carrierReplied: isoOrBlank_(row[COL.CARRIER_REPLIED]),
      carrierChases: Number(row[COL.CARRIER_CHASES]) || 0,
      lastChase: isoOrBlank_(row[COL.LAST_CHASE]),
      activity: String(row[COL.ACTIVITY] || '').split('\n').filter(String),
      partner: row[COL.PARTNER] || '',
      agentNumber: row[COL.AGENT_NO] || '',
    });
  }
  out.sort(function (a, b) { return (b.updated || '').localeCompare(a.updated || ''); });
  return out;
}

/* ======================= THE FOLLOW-UP ENGINE ======================= */

/**
 * Runs daily. Anyone who is not finished, has gone quiet, and is due
 * another nudge gets one — naming exactly what is still missing.
 */
function dailyContractingCheck() {
  var sheet = ensureSheet_();
  var values = sheet.getDataRange().getValues();
  var today = startOfDay_(new Date());
  var stalled = [];

  for (var r = 1; r < values.length; r++) {
    var row = { index: r + 1, values: values[r] };
    if (!row.values[COL.TOKEN]) continue;

    var status = String(row.values[COL.STATUS] || '');
    if (status === 'Submitted' || status === 'Withdrawn' || status === 'Stalled') continue;

    var updated = parseDate_(row.values[COL.UPDATED]) || parseDate_(row.values[COL.STARTED]);
    if (updated && daysBetween_(startOfDay_(updated), today) < CONFIG.QUIET_DAYS) continue;

    var sent = Number(row.values[COL.REMINDERS]) || 0;
    if (sent >= CONFIG.REMINDER_SPACING.length) {
      sheet.getRange(row.index, COL.STATUS + 1).setValue('Stalled');
      logActivity_(row, 'Marked stalled — reminders exhausted, needs a phone call');
      stalled.push(row);
      continue;
    }

    var since = parseDate_(row.values[COL.LAST_REMINDER]) || updated;
    var wait = CONFIG.REMINDER_SPACING[sent];
    if (since && daysBetween_(startOfDay_(since), today) < wait) continue;

    sendReminder_(row, false);
  }

  if (stalled.length) notifyRecruiterOfStalled_(stalled);

  /* Submitted packets are the carrier's turn — chase that side too. */
  checkCarrierReplies_();
  carrierFollowUpRound_();
}

/* ------------------- chasing the carrier ------------------- */

/**
 * Has the carrier answered? Each submission carries a reference in its
 * subject, so the thread it started can be found again; a message in that
 * thread from anyone other than us is a reply.
 *
 * Best effort — if the mailbox cannot be searched the follow-ups simply
 * carry on, and marking it replied by hand from the dashboard always works.
 */
function checkCarrierReplies_() {
  var sheet = ensureSheet_();
  var values = sheet.getDataRange().getValues();

  /* getActiveUser() is empty or throws depending on how the script is
     running, and it is only ever one more address to ignore — never let it
     take the daily check down with it. */
  var own = '';
  try { own = Session.getActiveUser().getEmail() || ''; } catch (e) { own = ''; }
  var ourAddresses = CONFIG.COPY_TO.concat([CONFIG.RECRUITER_EMAIL, own])
    .map(function (address) { return String(address || '').toLowerCase(); })
    .filter(Boolean);

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var ref = String(row[COL.CARRIER_REF] || '');
    if (!ref) continue;
    if (row[COL.CARRIER_REPLIED]) continue;

    var replied = null;
    try {
      GmailApp.search('subject:"' + ref + '"', 0, 5).forEach(function (thread) {
        thread.getMessages().forEach(function (message) {
          var from = String(message.getFrom() || '').toLowerCase();
          var isOurs = ourAddresses.some(function (address) {
            return address && from.indexOf(address) !== -1;
          });
          if (!isOurs && !replied) replied = message.getDate();
        });
      });
    } catch (e) { continue; }

    if (replied) {
      sheet.getRange(r + 1, COL.CARRIER_REPLIED + 1).setValue(replied);
      logActivity_({ index: r + 1, values: row }, CONFIG.CARRIER_NAME + ' replied — follow-ups stopped');
      notifyCarrierReplied_({ index: r + 1, values: row });
    }
  }
}

/** Nudge the carrier about every packet they have not answered yet. */
function carrierFollowUpRound_() {
  var sheet = ensureSheet_();
  var values = sheet.getDataRange().getValues();
  var today = startOfDay_(new Date());
  var giveUp = [];

  for (var r = 1; r < values.length; r++) {
    var row = { index: r + 1, values: values[r] };
    var sent = parseDate_(row.values[COL.CARRIER_SENT]);
    if (!sent) continue;                            // never went to the carrier
    if (row.values[COL.CARRIER_REPLIED]) continue;  // they answered
    if (row.values[COL.STAGE] === 'approved') continue;

    var chases = Number(row.values[COL.CARRIER_CHASES]) || 0;
    if (chases >= CONFIG.CARRIER_FOLLOWUP_SPACING.length) { giveUp.push(row); continue; }

    var since = parseDate_(row.values[COL.LAST_CHASE]) || sent;
    if (daysBetween_(startOfDay_(since), today) < CONFIG.CARRIER_FOLLOWUP_SPACING[chases]) continue;

    sendCarrierFollowUp_(row, chases + 1);
  }

  if (giveUp.length) notifyRecruiterOfCarrierSilence_(giveUp);
}

function sendCarrierFollowUp_(row, number) {
  var sheet = ensureSheet_();
  var name = row.values[COL.NAME] || row.values[COL.TOKEN];
  var ref = row.values[COL.CARRIER_REF] || ('VUMI-' + row.values[COL.TOKEN]);
  var sent = parseDate_(row.values[COL.CARRIER_SENT]);
  var waiting = sent ? daysBetween_(startOfDay_(sent), startOfDay_(new Date())) : 0;

  /* Same subject as the original, so it threads under it in her inbox
     rather than arriving as a fresh, easily-missed email. */
  GmailApp.sendEmail(CONFIG.CARRIER_EMAIL,
    'Nueva contratación de agente — ' + name + ' [' + ref + ']', '', {
    cc: CONFIG.COPY_TO.join(','),
    replyTo: CONFIG.RECRUITER_EMAIL,
    name: CONFIG.RECRUITER_NAME,
    htmlBody: emailShell_('Seguimiento — contratación de ' + esc_(name),
      '<p style="margin:0 0 14px">Hola ' + esc_(firstName_(CONFIG.CARRIER_NAME)) + ',</p>' +
      '<p style="margin:0 0 14px">Damos seguimiento al paquete de contratación de <b>' + esc_(name) +
      '</b>, enviado hace ' + waiting + ' día' + (waiting === 1 ? '' : 's') + '. ' +
      'El agente está esperando su código para poder empezar a producir.</p>' +
      statTable_([
        ['Agente', name],
        ['Referencia', ref],
        ['Enviado', sent ? prettyDate_(sent) : '—'],
        ['Seguimiento', String(number)],
      ]) +
      '<p style="margin:0 0 14px">¿Nos puede confirmar si el paquete está completo o si hace falta algo? ' +
      'Con gusto lo enviamos de nuevo si es necesario.</p>' +
      '<p style="margin:0;font-size:13px;color:#7a8ca0">' + esc_(CONFIG.RECRUITER_NAME) + ' · ' +
      esc_(CONFIG.RECRUITER_PHONE) + '</p>'),
  });

  sheet.getRange(row.index, COL.CARRIER_CHASES + 1).setValue(number);
  sheet.getRange(row.index, COL.LAST_CHASE + 1).setValue(new Date());
  logActivity_(row, 'Follow-up ' + number + ' sent to ' + CONFIG.CARRIER_NAME +
    ' — ' + waiting + ' days without a reply');
}

function notifyCarrierReplied_(row) {
  MailApp.sendEmail({
    to: CONFIG.COPY_TO.join(','),
    subject: 'VUMI replied — ' + (row.values[COL.NAME] || row.values[COL.TOKEN]),
    htmlBody: emailShell_('The carrier has come back to us',
      '<p style="margin:0 0 14px">A reply landed on the contracting packet for <b>' +
      esc_(row.values[COL.NAME] || row.values[COL.TOKEN]) + '</b>, so the automatic follow-ups have stopped.</p>' +
      '<p style="margin:0 0 14px">Check the thread, then move the applicant to <b>Code issued</b> on the ' +
      'dashboard once VUMI confirms — that is what turns their progress bar to complete.</p>'),
  });
}

function notifyRecruiterOfCarrierSilence_(rows) {
  var list = rows.map(function (row) {
    var sent = parseDate_(row.values[COL.CARRIER_SENT]);
    return '<li><b>' + esc_(row.values[COL.NAME] || row.values[COL.TOKEN]) + '</b> — sent ' +
      (sent ? prettyDate_(sent) : '—') + ', ' + (Number(row.values[COL.CARRIER_CHASES]) || 0) +
      ' follow-ups, no reply</li>';
  }).join('');

  MailApp.sendEmail({
    to: CONFIG.COPY_TO.join(','),
    subject: 'VUMI has not replied on ' + rows.length + ' packet(s)',
    htmlBody: emailShell_('Time to pick up the phone',
      '<p style="margin:0 0 14px">These packets went to ' + esc_(CONFIG.CARRIER_NAME) + ' at ' +
      esc_(CONFIG.CARRIER_EMAIL) + ' and have had every automatic follow-up without an answer. ' +
      'The emails have stopped so they do not become noise.</p>' +
      '<ul style="margin:0 0 18px;padding-left:20px;color:#33475b">' + list + '</ul>' +
      '<p style="margin:0 0 14px">The agents are still waiting on their codes.</p>'),
  });
}

function sendReminder_(row, manual) {
  var sheet = ensureSheet_();
  var email = String(row.values[COL.EMAIL] || '');
  if (!email) return;

  var lang = row.values[COL.LANG] === 'en' ? 'en' : 'es';
  var name = firstName_(row.values[COL.NAME]);
  var token = row.values[COL.TOKEN];
  var link = CONFIG.PORTAL_BASE + token;
  var percent = Number(row.values[COL.PERCENT]) || 0;
  var missing = String(row.values[COL.MISSING] || '').split('; ').filter(String);
  var sent = Number(row.values[COL.REMINDERS]) || 0;

  var subject, opening;
  if (percent === 0) {
    subject = lang === 'es' ? 'Su contratación VUMI® le está esperando' : 'Your VUMI® contracting is waiting';
    opening = lang === 'es'
      ? 'Todavía no ha empezado su solicitud. Son unos 15 minutos y puede hacerla desde el teléfono.'
      : "You haven't started your application yet. It takes about 15 minutes and works fine on a phone.";
  } else if (percent >= 100) {
    subject = lang === 'es' ? 'Su solicitud está completa — sólo falta enviarla' : 'Your application is complete — just send it';
    opening = lang === 'es'
      ? 'Su solicitud está llena y firmada. Sólo falta que pulse <b>Enviar mi solicitud</b> para que llegue a VUMI®.'
      : 'Your application is filled in and signed. All that is left is pressing <b>Send my application</b> so it reaches VUMI®.';
  } else {
    subject = lang === 'es'
      ? 'Le falta poco: ' + percent + '% de su contratación VUMI®'
      : "You're almost there: " + percent + '% of your VUMI® contracting';
    opening = lang === 'es'
      ? 'Va por el <b>' + percent + '%</b>. Retome donde lo dejó — su progreso está guardado.'
      : "You're <b>" + percent + '%</b> of the way through. Pick up where you left off — your progress is saved.';
  }

  var missingHtml = '';
  if (missing.length) {
    missingHtml = '<p style="margin:0 0 10px"><b>' +
      (lang === 'es' ? 'Lo que falta:' : 'What is still missing:') + '</b></p>' +
      '<ul style="margin:0 0 18px;padding-left:20px;color:#33475b">' +
      missing.slice(0, 8).map(function (item) { return '<li>' + esc_(item) + '</li>'; }).join('') +
      (missing.length > 8
        ? '<li>' + (lang === 'es' ? 'y ' + (missing.length - 8) + ' más' : 'and ' + (missing.length - 8) + ' more') + '</li>'
        : '') +
      '</ul>';
  }

  MailApp.sendEmail({
    to: email,
    replyTo: CONFIG.RECRUITER_EMAIL,
    subject: subject,
    htmlBody: emailShell_(subject,
      '<p style="margin:0 0 14px">' + (lang === 'es' ? 'Hola ' : 'Hi ') + esc_(name) + ',</p>' +
      '<p style="margin:0 0 14px">' + opening + '</p>' +
      missingHtml +
      button_(link, lang === 'es' ? 'Continuar mi solicitud' : 'Continue my application') +
      '<p style="margin:18px 0 0;font-size:13px;color:#7a8ca0">' +
      (lang === 'es'
        ? '¿Algo le está frenando? Responda a este correo o llame al ' + esc_(CONFIG.RECRUITER_PHONE) + ' y lo resolvemos juntos.'
        : 'Something holding you up? Reply to this email or call ' + esc_(CONFIG.RECRUITER_PHONE) + ' and we will sort it out together.') +
      '</p>'),
  });

  sheet.getRange(row.index, COL.REMINDERS + 1).setValue(sent + (manual ? 0 : 1));
  sheet.getRange(row.index, COL.LAST_REMINDER + 1).setValue(new Date());
  logActivity_(row, manual
    ? 'Reminder sent by hand — ' + percent + '% done, ' + missing.length + ' answers outstanding'
    : 'Automatic reminder ' + (sent + 1) + ' sent — ' + percent + '% done, ' +
      missing.length + ' answers outstanding');
}

function notifyRecruiterOfStalled_(rows) {
  var list = rows.map(function (row) {
    return '<li><b>' + esc_(row.values[COL.NAME] || row.values[COL.TOKEN]) + '</b> — ' +
      (Number(row.values[COL.PERCENT]) || 0) + '% · ' + esc_(row.values[COL.EMAIL] || '') +
      ' · <a href="' + esc_(CONFIG.PORTAL_BASE + row.values[COL.TOKEN]) + '">link</a></li>';
  }).join('');

  MailApp.sendEmail({
    to: CONFIG.RECRUITER_EMAIL,
    subject: 'Contracting: ' + rows.length + ' applicant(s) have gone quiet',
    htmlBody: emailShell_('These need a personal call',
      '<p style="margin:0 0 14px">Automatic reminders have run their course for these applicants. ' +
      'They are marked <b>Stalled</b> and will not be emailed again — a call from you is the next step.</p>' +
      '<ul style="margin:0 0 18px;padding-left:20px;color:#33475b">' + list + '</ul>'),
  });
}

/* ======================= EMAILS ======================= */

/**
 * The submission itself. Goes to the carrier with the whole packet attached
 * and the team copied, so everyone holds the same record.
 *
 * Sent through GmailApp rather than MailApp so it lands in the Sent folder,
 * where checkCarrierReplies_ can later find the thread and see whether the
 * carrier has answered. The reference in the subject is what ties the two
 * together — keep it there if you edit this.
 */
function sendToCarrier_(p, folder, attachments, ref) {
  var missing = (p.missing || []);
  var subject = 'Nueva contratación de agente — ' + (p.name || p.token) + ' [' + ref + ']';

  GmailApp.sendEmail(CONFIG.CARRIER_EMAIL, subject, '', {
    cc: CONFIG.COPY_TO.join(','),
    replyTo: CONFIG.RECRUITER_EMAIL,
    name: CONFIG.RECRUITER_NAME,
    htmlBody: emailShell_('Nueva solicitud de Productor/Agente',
      '<p style="margin:0 0 14px">Hola ' + esc_(firstName_(CONFIG.CARRIER_NAME)) + ',</p>' +
      '<p style="margin:0 0 14px">Adjunto el paquete de contratación completo y firmado de ' +
      '<b>' + esc_(p.name || '') + '</b>: la Solicitud de Productor/Agente, el Formulario para ' +
      'Designación de Beneficiario y el W-8BEN.</p>' +
      statTable_([
        ['Agente', p.name || '—'],
        ['Correo electrónico', p.email || '—'],
        ['Teléfono', p.mobile || '—'],
        ['Referencia', ref],
        ['Documentos adjuntos', String(attachments.length)],
        missing.length ? ['Pendiente en la solicitud', missing.join(', ')] : null,
      ].filter(Boolean)) +
      '<p style="margin:0 0 14px">Quedamos atentos a la confirmación y al código de agente. ' +
      'Si hace falta algún documento adicional, respóndanos a este mismo correo.</p>' +
      '<p style="margin:0;font-size:13px;color:#7a8ca0">' + esc_(CONFIG.RECRUITER_NAME) + ' · ' +
      esc_(CONFIG.RECRUITER_PHONE) + '</p>'),
    attachments: attachments,
  });
}

/** Thanks, their copy of the signed forms, and the code to follow progress. */
function sendApplicantThanks_(p, attachments, code) {
  if (!p.email) return;
  var lang = p.lang === 'en' ? 'en' : 'es';
  var statusLink = CONFIG.STATUS_BASE + code;
  var subject = lang === 'es'
    ? '¡Gracias! Su solicitud de agente VUMI® fue enviada ✅'
    : 'Thank you! Your VUMI® agent application is on its way ✅';

  MailApp.sendEmail({
    to: p.email,
    replyTo: CONFIG.RECRUITER_EMAIL,
    subject: subject,
    htmlBody: emailShell_(subject,
      '<p style="margin:0 0 14px">' + (lang === 'es' ? 'Hola ' : 'Hi ') + esc_(firstName_(p.name)) + ',</p>' +
      '<p style="margin:0 0 14px">' + (lang === 'es'
        ? 'Gracias por completar su solicitud. Su paquete firmado ya fue enviado a VUMI® y adjuntamos su copia de los tres formularios.'
        : 'Thank you for completing your application. Your signed packet has already gone to VUMI®, and your copy of all three forms is attached.') + '</p>' +

      '<div style="background:#E9F7F6;border:1px solid #CBEAE8;border-radius:14px;padding:18px;margin:0 0 18px;text-align:center">' +
        '<div style="font-size:12px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:#0E8C8C">' +
        (lang === 'es' ? 'Su código de seguimiento' : 'Your tracking code') + '</div>' +
        '<div style="font-size:30px;font-weight:800;letter-spacing:.18em;color:#0E2A47;margin:8px 0 4px">' + esc_(code) + '</div>' +
        '<div style="font-size:13px;color:#5B7186">' +
        (lang === 'es'
          ? 'Guárdelo. Con este código puede ver en qué punto va su contratación, cuando quiera.'
          : 'Keep it. This code shows you how far along your contracting is, any time.') +
        '</div>' +
      '</div>' +

      button_(statusLink, lang === 'es' ? 'Ver el avance de mi contratación' : 'Track my contracting') +

      '<p style="margin:18px 0 10px"><b>' + (lang === 'es' ? 'Qué sigue:' : 'What happens next:') + '</b></p>' +
      '<ol style="margin:0 0 18px;padding-left:20px;color:#33475b">' +
      (lang === 'es'
        ? '<li>VUMI® revisa su paquete.</li>' +
          '<li>Le escribimos si hace falta algún documento de respaldo.</li>' +
          '<li>VUMI® emite su código de agente y queda listo para vender.</li>'
        : '<li>VUMI® reviews your packet.</li>' +
          '<li>We write to you if any supporting document is needed.</li>' +
          '<li>VUMI® issues your agent code and you are ready to sell.</li>') +
      '</ol>' +
      '<p style="margin:0;font-size:13px;color:#7a8ca0">' +
      (lang === 'es' ? '¿Preguntas? Responda a este correo o llame al ' : 'Questions? Reply to this email or call ') +
      esc_(CONFIG.RECRUITER_PHONE) + '.</p>'),
    attachments: attachments,
  });
}

/* ======================= STORAGE ======================= */

function ensureSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  /* A sheet from an earlier version is missing the newer columns. Append
     them rather than rebuilding, so rows already in flight keep their data. */
  var width = sheet.getLastColumn();
  if (width < HEADERS.length) {
    var missing = HEADERS.slice(width);
    sheet.getRange(1, width + 1, 1, missing.length)
      .setValues([missing])
      .setFontWeight('bold');
  }
  return sheet;
}

/**
 * The Access tab: one row per person who can sign in. Returns any staff
 * logins it had to create, so setup can show you their passcodes once.
 */
function ensureAccessSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(CONFIG.ACCESS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.ACCESS_SHEET);
    sheet.appendRow(ACCESS_HEADERS);
    sheet.getRange(1, 1, 1, ACCESS_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var created = [];
  CONFIG.STAFF.forEach(function (person) {
    if (findAccessRow_(person.number)) return;
    var passcode = randomCode_(6);
    sheet.appendRow([
      person.number, passcode, person.name, person.role, person.email,
      '', 'en', 'Yes', '', '',
    ]);
    created.push({ name: person.name, number: person.number, passcode: passcode });
  });
  return created;
}

function accessSheet_() {
  ensureAccessSheet_();
  return SpreadsheetApp.getActive().getSheetByName(CONFIG.ACCESS_SHEET);
}

function findAccessRow_(agentNumber) {
  var wanted = normaliseNumber_(agentNumber);
  if (!wanted) return null;
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(CONFIG.ACCESS_SHEET);
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (normaliseNumber_(values[r][ACC.NUMBER]) === wanted) return { index: r + 1, values: values[r] };
  }
  return null;
}

/** Agent numbers are read aloud and retyped — ignore case, spaces and dashes. */
function normaliseNumber_(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Sign in with an agent number and passcode.
 *
 * Staff get the admin key back so the dashboard opens without anyone having
 * to know or type it. Agents get their application token, which is what
 * their answers are saved against.
 */
function signIn_(p) {
  var row = findAccessRow_(p.agentNumber);
  if (!row) return { ok: false, error: 'unknown' };

  if (String(row.values[ACC.ACTIVE] || '').trim().toLowerCase() === 'no') {
    return { ok: false, error: 'inactive' };
  }
  if (String(row.values[ACC.PASSCODE] || '').trim() !== String(p.passcode || '').trim()) {
    return { ok: false, error: 'passcode' };
  }

  var sheet = accessSheet_();
  sheet.getRange(row.index, ACC.LAST_LOGIN + 1).setValue(new Date());

  var role = String(row.values[ACC.ROLE] || 'agent').toLowerCase();
  var out = {
    ok: true,
    role: role,
    name: row.values[ACC.NAME],
    agentNumber: row.values[ACC.NUMBER],
    email: row.values[ACC.EMAIL],
    lang: row.values[ACC.LANG] || 'en',
    carriers: CARRIERS,
  };

  if (role === 'manager' || role === 'assistant') {
    out.adminKey = CONFIG.ADMIN_KEY;
    return out;
  }

  /* An agent can hold several contracts at once — one application per
     partner — so hand back the lot with where each one has got to. */
  out.applications = applicationsFor_(row.values[ACC.NUMBER]);
  return out;
}

/** Every application belonging to one agent, one per partner. */
function applicationsFor_(agentNumber) {
  var wanted = normaliseNumber_(agentNumber);
  if (!wanted) return [];
  var values = ensureSheet_().getDataRange().getValues();
  var out = [];
  for (var r = 1; r < values.length; r++) {
    if (normaliseNumber_(values[r][COL.AGENT_NO]) !== wanted) continue;
    out.push({
      partner: String(values[r][COL.PARTNER] || ''),
      token: values[r][COL.TOKEN],
      status: values[r][COL.STATUS],
      percent: Number(values[r][COL.PERCENT]) || 0,
      stage: values[r][COL.STAGE] || '',
      code: values[r][COL.CODE] || '',
      submitted: isoOrBlank_(values[r][COL.SUBMITTED]),
    });
  }
  return out;
}

/**
 * Open one agent's application for one partner, making it if it is not there.
 *
 * A second contract starts from the first: everything the agent already
 * typed is copied across, so somebody contracting with three companies
 * answers the personal questions once, not three times. The signature is
 * deliberately NOT copied — each contract has to be signed on its own.
 */
function openContract_(p) {
  var agentNumber = normaliseNumber_(p.agentNumber);
  var partner = String(p.partner || '').trim();
  if (!agentNumber || !partner) return { ok: false, error: 'missing' };

  var access = findAccessRow_(agentNumber);
  if (!access) return { ok: false, error: 'unknown agent' };

  var mine = applicationsFor_(agentNumber);
  var existing = mine.filter(function (a) { return a.partner === partner; })[0];
  if (existing) {
    var saved = readApplication_(existing.token);
    return { ok: true, token: existing.token, data: saved.data || null, step: saved.step || 0, created: false };
  }

  /* Carry over from whichever of their applications is furthest along. */
  var source = mine.slice().sort(function (a, b) { return b.percent - a.percent; })[0];
  var carried = null;
  if (source) {
    var previous = readApplication_(source.token);
    if (previous && previous.data) {
      carried = previous.data;
      carried.signature = {
        printedName: (carried.signature && carried.signature.printedName) || '',
        initials: (carried.signature && carried.signature.initials) || '',
        place: (carried.signature && carried.signature.place) || '',
        dataUrl: '', date: '',
      };
      delete carried.submittedAt;
      delete carried.trackingCode;
    }
  }

  var token = makeToken_();
  var now = new Date();
  ensureSheet_().appendRow([
    now, token, access.values[ACC.NAME], access.values[ACC.EMAIL], access.values[ACC.MOBILE],
    access.values[ACC.LANG] || 'en', 'In progress', 0, '', now, '', 0, '', '',
    CONFIG.PORTAL_BASE + token, '', '', '', '', '', '', '', 0, '', '',
    partner, access.values[ACC.NUMBER],
  ]);

  if (carried) writeApplication_(token, { data: carried, step: 0, savedAt: now.toISOString() });
  logActivity_(findRow_(token), source
    ? 'Contract with ' + partner + ' opened — details carried over from their ' + source.partner + ' application'
    : 'Contract with ' + partner + ' opened');

  return { ok: true, token: token, data: carried, step: 0, created: true, carried: !!carried };
}

/**
 * A new agent signing themselves up.
 *
 * This is how someone who has just been recruited gets in without waiting
 * for an invitation to be typed out: they give their name, email and mobile
 * and are issued a number and passcode on the spot. Nothing is approved by
 * doing this — they land in your pipeline at 0% like anyone else, and you
 * are emailed. Set Active to No in the Access tab to shut one down.
 */
function registerAgent_(p) {
  var name = String(p.name || '').trim();
  var email = String(p.email || '').trim();
  if (!name || !email) return { ok: false, error: 'missing' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'email' };

  /* Someone coming back a second time gets what they already have rather
     than a duplicate row and a second number. */
  var existing = findAccessByEmail_(email);
  if (existing) {
    return {
      ok: true, returning: true,
      agentNumber: existing.values[ACC.NUMBER],
      passcode: existing.values[ACC.PASSCODE],
      name: existing.values[ACC.NAME],
    };
  }

  var lang = p.lang === 'es' ? 'es' : 'en';
  var token = makeToken_();
  var access = issueAgentAccess_({
    name: name, email: email, mobile: p.mobile, lang: lang, token: token,
  });

  var now = new Date();
  ensureSheet_().appendRow([
    now, token, name, email, p.mobile || '', lang, 'Invited', 0, '', now,
    '', 0, '', '', CONFIG.PORTAL_BASE + token, 'Self-registered',
    '', '', '', '', '', '', 0, '', '', '', access.number,
  ]);

  sendCredentials_({ name: name, email: email, lang: lang }, access);
  logActivity_(findRow_(token), 'Signed themselves up · ' + access.number);
  MailApp.sendEmail({
    to: CONFIG.COPY_TO.join(','),
    subject: 'New agent signed up — ' + name,
    htmlBody: emailShell_('Someone started their contracting',
      statTable_([
        ['Name', name],
        ['Email', email],
        ['Mobile', p.mobile || '—'],
        ['Agent number', access.number],
      ]) +
      '<p style="margin:0 0 14px">They registered themselves on the contracting site and have their ' +
      'sign-in details. They are in your pipeline now — the usual reminders will chase them.</p>' +
      '<p style="margin:0;font-size:13px;color:#7a8ca0">Not someone you know? Set <b>Active</b> to ' +
      '<b>No</b> on their row in the Access tab and they cannot sign in again.</p>'),
  });

  return { ok: true, agentNumber: access.number, passcode: access.passcode, name: name };
}

/** The "here are your sign-in details" email, shared by invite and sign-up. */
function sendCredentials_(person, access) {
  var lang = person.lang === 'es' ? 'es' : 'en';
  var subject = lang === 'es'
    ? 'Sus datos de acceso — Contratación'
    : 'Your sign-in details — Contracting';

  MailApp.sendEmail({
    to: person.email,
    replyTo: CONFIG.RECRUITER_EMAIL,
    subject: subject,
    htmlBody: emailShell_(subject,
      '<p style="margin:0 0 14px">' + (lang === 'es' ? 'Hola ' : 'Hi ') +
      esc_(firstName_(person.name)) + ',</p>' +
      '<p style="margin:0 0 14px">' + (lang === 'es'
        ? 'Aquí están sus datos para entrar y completar su contratación.'
        : 'Here are the details you need to sign in and complete your contracting.') + '</p>' +
      credentialBlock_(access, lang) +
      button_(CONFIG.PORTAL_BASE.replace(/\?t=$/, ''),
        lang === 'es' ? 'Entrar y comenzar' : 'Sign in and start') +
      '<p style="margin:18px 0 0;font-size:13px;color:#7a8ca0">' +
      (lang === 'es'
        ? 'Guarde su número de agente y su código — los necesita cada vez que entre.'
        : 'Keep your agent number and passcode — you need them every time you sign in.') + '</p>'),
  });
}

function credentialBlock_(access, lang) {
  return '<div style="background:#E9F7F6;border:1px solid #CBEAE8;border-radius:14px;padding:18px;margin:0 0 18px">' +
    '<div style="font-size:12px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:#0E8C8C;text-align:center">' +
    (lang === 'es' ? 'Sus datos de acceso' : 'Your sign-in details') + '</div>' +
    '<table style="width:100%;margin-top:12px;border-collapse:collapse">' +
      '<tr><td style="padding:6px 0;color:#5B7186;font-size:13px">' +
        (lang === 'es' ? 'Número de agente' : 'Agent number') + '</td>' +
        '<td style="padding:6px 0;text-align:right;font-weight:800;font-size:18px;letter-spacing:.08em;color:#0E2A47">' +
        esc_(access.number) + '</td></tr>' +
      '<tr><td style="padding:6px 0;color:#5B7186;font-size:13px">' +
        (lang === 'es' ? 'Código de acceso' : 'Passcode') + '</td>' +
        '<td style="padding:6px 0;text-align:right;font-weight:800;font-size:18px;letter-spacing:.18em;color:#0E2A47">' +
        esc_(access.passcode) + '</td></tr>' +
    '</table>' +
  '</div>';
}

/** Give an agent a number and passcode. Reuses theirs if they already have one. */
function issueAgentAccess_(p) {
  var sheet = accessSheet_();
  var existing = p.agentNumber ? findAccessRow_(p.agentNumber) : findAccessByEmail_(p.email);
  if (existing) {
    return {
      number: existing.values[ACC.NUMBER],
      passcode: existing.values[ACC.PASSCODE],
      token: normaliseToken_(existing.values[ACC.TOKEN]) || '',
    };
  }

  var number = nextAgentNumber_();
  var passcode = randomCode_(6);
  sheet.appendRow([
    number, passcode, p.name || '', 'agent', p.email || '', p.mobile || '',
    p.lang || 'en', 'Yes', p.token || '', '',
  ]);
  return { number: number, passcode: passcode, token: p.token || '' };
}

function findAccessByEmail_(email) {
  var wanted = String(email || '').trim().toLowerCase();
  if (!wanted) return null;
  var sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.ACCESS_SHEET);
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][ACC.EMAIL] || '').trim().toLowerCase() === wanted) {
      return { index: r + 1, values: values[r] };
    }
  }
  return null;
}

/** RRP-001, RRP-002, ... continuing past whatever is already in the sheet. */
function nextAgentNumber_() {
  var sheet = accessSheet_();
  var values = sheet.getDataRange().getValues();
  var highest = 0;
  for (var r = 1; r < values.length; r++) {
    var match = /^RRP-?(\d+)$/i.exec(String(values[r][ACC.NUMBER] || '').trim());
    if (match) highest = Math.max(highest, parseInt(match[1], 10));
  }
  return 'RRP-' + String(highest + 1).padStart(3, '0');
}

function ensureRootFolder_() {
  var found = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER);
  return found.hasNext() ? found.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER);
}

function applicantFolder_(token, name) {
  var root = ensureRootFolder_();
  var folderName = (name ? String(name).replace(/[\\/:*?"<>|]/g, ' ').trim() + ' — ' : '') + token;
  var found = root.getFoldersByName(folderName);
  return found.hasNext() ? found.next() : root.createFolder(folderName);
}

/** The answers live in Drive, not a cell — a cell caps out at 50k characters. */
function writeApplication_(token, payload) {
  var folder = applicantFolder_(token, payload.data && payload.data.fullName);
  var json = JSON.stringify(payload);
  var files = folder.getFilesByName('application.json');
  if (files.hasNext()) files.next().setContent(json);
  else folder.createFile('application.json', json, MimeType.PLAIN_TEXT);
}

function readApplication_(token) {
  var root = ensureRootFolder_();
  var folders = root.getFolders();
  while (folders.hasNext()) {
    var folder = folders.next();
    if (folder.getName().indexOf(token) === -1) continue;
    var files = folder.getFilesByName('application.json');
    if (!files.hasNext()) continue;
    try { return JSON.parse(files.next().getBlob().getDataAsString()); } catch (e) { return {}; }
  }
  return {};
}

function findRow_(token) {
  if (!token) return null;
  var values = ensureSheet_().getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][COL.TOKEN] || '').trim() === token) return { index: r + 1, values: values[r] };
  }
  return null;
}

function findRowByCode_(code) {
  var wanted = normaliseToken_(code);
  if (!wanted) return null;
  var values = ensureSheet_().getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (normaliseToken_(values[r][COL.CODE]) === wanted) return { index: r + 1, values: values[r] };
  }
  return null;
}

function findRowByEmail_(email) {
  var wanted = String(email || '').trim().toLowerCase();
  if (!wanted) return null;
  var values = ensureSheet_().getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][COL.EMAIL] || '').trim().toLowerCase() === wanted) return { index: r + 1, values: values[r] };
  }
  return null;
}

/* ======================= HELPERS ======================= */

function normaliseToken_(token) {
  return String(token || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function makeToken_() {
  return randomCode_(10);
}

/**
 * The code an applicant types in to follow their progress. Short enough to
 * read down the phone, and separate from their application token — this one
 * only ever reveals a stage, never their details.
 */
function makeTrackingCode_() {
  for (var attempt = 0; attempt < 12; attempt++) {
    var code = randomCode_(6);
    if (!findRowByCode_(code)) return code;
  }
  return randomCode_(8);
}

/** No O/0/I/1 — these get read aloud and written down. */
function randomCode_(length) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function parseDate_(value) {
  if (!value) return null;
  var d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
function startOfDay_(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function prettyDate_(d) {
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'd MMMM yyyy') : '—';
}
function daysBetween_(a, b) { return Math.round((b - a) / 86400000); }
function isoOrBlank_(value) {
  var d = parseDate_(value);
  return d ? d.toISOString() : '';
}

function firstName_(name) {
  var first = String(name || '').trim().split(/\s+/)[0];
  return first || 'there';
}

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function emailShell_(title, bodyHtml) {
  return '' +
    '<div style="margin:0;padding:0;background:#f4f8fb">' +
    '<div style="max-width:600px;margin:0 auto;padding:28px 18px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">' +
      '<div style="background:linear-gradient(135deg,#0E2A47,#1C4E80);border-radius:18px 18px 0 0;padding:24px 26px">' +
        '<div style="color:#BFD9E8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">' +
          esc_(CONFIG.RECRUITER_NAME) + '</div>' +
        '<div style="color:#fff;font-size:21px;font-weight:800;margin-top:6px;line-height:1.25">' + title + '</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2ebf3;border-top:none;border-radius:0 0 18px 18px;padding:26px;color:#152435;font-size:15px;line-height:1.65">' +
        bodyHtml +
      '</div>' +
      '<div style="text-align:center;color:#8fa3b6;font-size:12px;padding:16px 0">' +
        esc_(CONFIG.RECRUITER_NAME) + ' · ' + esc_(CONFIG.RECRUITER_PHONE) + '</div>' +
    '</div></div>';
}

function statTable_(pairs) {
  return '<table style="width:100%;border-collapse:collapse;margin:0 0 18px">' +
    pairs.map(function (pair) {
      return '<tr>' +
        '<td style="padding:9px 0;border-bottom:1px solid #eef3f8;color:#7a8ca0;font-size:13px">' + esc_(pair[0]) + '</td>' +
        '<td style="padding:9px 0;border-bottom:1px solid #eef3f8;text-align:right;font-weight:700;font-size:14px">' + esc_(pair[1]) + '</td>' +
      '</tr>';
    }).join('') + '</table>';
}

function button_(href, label) {
  return '<div style="margin:22px 0"><a href="' + esc_(href) + '" ' +
    'style="display:inline-block;background:#12A5A0;color:#fff;text-decoration:none;font-weight:700;' +
    'padding:14px 26px;border-radius:999px;font-size:15px">' + esc_(label) + '</a></div>';
}

/* ======================= SELF TEST ======================= */

/** Run this from the editor to check the wiring without touching an applicant. */
function testContractingSetup() {
  var sheet = ensureSheet_();
  var folder = ensureRootFolder_();
  var triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'dailyContractingCheck';
  });
  Logger.log('Sheet: %s (%s rows)', sheet.getName(), sheet.getLastRow());
  Logger.log('Drive folder: %s', folder.getUrl());
  Logger.log('Daily reminder trigger: %s', triggers.length ? 'ON' : 'OFF');
  Logger.log('Admin key set: %s', CONFIG.ADMIN_KEY !== 'change-me-before-deploying');
  Logger.log('Applicants: %s', listApplicants_().length);
}
