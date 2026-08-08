/**
 * ============================================================
 *  AGENT CONTRACTING — Ricky Rampersad Branch
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
  RECRUITER_NAME: 'Ricky Rampersad',
  RECRUITER_EMAIL: 'ricky.rampersad@myguardiangroup.com',
  RECRUITER_PHONE: '(868) 678-5921',

  // --- Portal ------------------------------------------------------------
  // The applicant's personal link is this with their token appended:
  // https://rickyrampersadbranch.com/contracting/?t=AB12CD34
  PORTAL_BASE: 'https://rickyrampersadbranch.com/contracting/?t=',

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

  // --- Storage -----------------------------------------------------------
  SHEET_NAME: 'Contracting',
  DRIVE_FOLDER: 'VUMI Contracting',
};

var HEADERS = [
  'Started', 'Token', 'Name', 'Email', 'Mobile', 'Language', 'Status',
  'Percent', 'Missing', 'Last Update', 'Submitted', 'Reminders Sent',
  'Last Reminder', 'Folder', 'Portal Link', 'Notes',
];

var COL = {
  STARTED: 0, TOKEN: 1, NAME: 2, EMAIL: 3, MOBILE: 4, LANG: 5, STATUS: 6,
  PERCENT: 7, MISSING: 8, UPDATED: 9, SUBMITTED: 10, REMINDERS: 11,
  LAST_REMINDER: 12, FOLDER: 13, LINK: 14, NOTES: 15,
};

/* ======================= SETUP & MENU ======================= */

/** Run this ONCE after pasting the script. */
function setupContracting() {
  ensureSheet_();
  ensureRootFolder_();
  enableContractingReminders();
  onOpen();
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('📝 Contracting')
      .addItem('Invite an agent…', 'promptInvite')
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

    if (action === 'save') return json_(saveProgress_(payload));
    if (action === 'submit') return json_(submitPacket_(payload));

    /* Everything below is the recruiter's side of the desk. */
    if (!authorised_(payload.key)) return json_({ ok: false, error: 'unauthorised' });
    if (action === 'invite') return json_(inviteAgent_(payload));
    if (action === 'nudge') return json_(nudgeNow_(payload.token));
    if (action === 'status') return json_(setStatus_(payload.token, payload.status, payload.notes));

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

/** The finished packet: file it, acknowledge it, tell the recruiter. */
function submitPacket_(p) {
  var token = normaliseToken_(p.token);
  if (!token) return { ok: false, error: 'no token' };

  saveProgress_(p);

  var folder = applicantFolder_(token, p.name);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  (p.pdfs || []).forEach(function (pdf) {
    if (!pdf || !pdf.base64) return;
    folder.createFile(Utilities.newBlob(
      Utilities.base64Decode(pdf.base64), 'application/pdf', stamp + ' ' + pdf.name));
  });

  (p.uploads || []).forEach(function (upload) {
    if (!upload || !upload.dataUrl) return;
    var parts = String(upload.dataUrl).split(',');
    if (parts.length < 2) return;
    folder.createFile(Utilities.newBlob(
      Utilities.base64Decode(parts[1]), upload.type || 'application/octet-stream', upload.name || 'documento'));
  });

  var sheet = ensureSheet_();
  var row = findRow_(token);
  if (row) {
    sheet.getRange(row.index, COL.STATUS + 1).setValue('Submitted');
    sheet.getRange(row.index, COL.SUBMITTED + 1).setValue(new Date());
    sheet.getRange(row.index, COL.FOLDER + 1).setValue(folder.getUrl());
  }

  sendApplicantCopy_(p, folder);
  sendRecruiterAlert_(p, folder);
  return { ok: true, folder: folder.getUrl() };
}

/* ======================= RECRUITER ACTIONS ======================= */

function inviteAgent_(p) {
  var name = String(p.name || '').trim();
  var email = String(p.email || '').trim();
  if (!email) return { ok: false, error: 'no email' };

  var sheet = ensureSheet_();
  var existing = findRowByEmail_(email);
  var token = existing ? existing.values[COL.TOKEN] : makeToken_();
  var link = CONFIG.PORTAL_BASE + token;
  var now = new Date();

  if (!existing) {
    sheet.appendRow([
      now, token, name, email, p.mobile || '', p.lang || 'es',
      'Invited', 0, '', now, '', 0, '', '', link, p.notes || '',
    ]);
  }

  var lang = p.lang === 'en' ? 'en' : 'es';
  var firstName = firstName_(name);
  var subject = lang === 'es'
    ? 'Su contratación como agente VUMI® — empiece aquí'
    : 'Your VUMI® agent contracting — start here';

  var body = lang === 'es'
    ? '<p style="margin:0 0 14px">Hola ' + esc_(firstName) + ',</p>' +
      '<p style="margin:0 0 14px">Aquí está su enlace para completar su contratación como Productor/Agente VUMI®. ' +
      'Responde una sola vez y el sistema llena por usted los tres formularios oficiales: la solicitud de 11 páginas, ' +
      'la designación de beneficiario y el W-8BEN del IRS.</p>' +
      '<p style="margin:0 0 14px">Toma unos 15 minutos. Puede detenerse cuando quiera y seguir después desde el mismo enlace ' +
      '— su progreso se guarda solo.</p>' +
      '<p style="margin:0 0 10px"><b>Tenga a mano:</b></p>' +
      '<ul style="margin:0 0 18px;padding-left:20px;color:#33475b">' +
      '<li>Su identificación con foto o pasaporte</li>' +
      '<li>Sus datos bancarios para el pago de comisiones</li>' +
      '<li>Dos referencias personales y dos bancarias</li>' +
      '</ul>'
    : '<p style="margin:0 0 14px">Hi ' + esc_(firstName) + ',</p>' +
      '<p style="margin:0 0 14px">Here is your link to complete your VUMI® Producer/Agent contracting. ' +
      'You answer once and the system fills all three official forms for you: the 11-page application, ' +
      'the beneficiary designation and the IRS W-8BEN.</p>' +
      '<p style="margin:0 0 14px">It takes about 15 minutes. Stop whenever you like and pick up from the same link ' +
      '— your progress saves itself.</p>' +
      '<p style="margin:0 0 10px"><b>Have handy:</b></p>' +
      '<ul style="margin:0 0 18px;padding-left:20px;color:#33475b">' +
      '<li>Your photo ID or passport</li>' +
      '<li>Your bank details for commission payments</li>' +
      '<li>Two personal and two bank references</li>' +
      '</ul>';

  MailApp.sendEmail({
    to: email,
    replyTo: CONFIG.RECRUITER_EMAIL,
    subject: subject,
    htmlBody: emailShell_(subject,
      body + button_(link, lang === 'es' ? 'Comenzar mi contratación' : 'Start my contracting') +
      '<p style="margin:18px 0 0;font-size:13px;color:#7a8ca0">' +
      (lang === 'es' ? '¿Preguntas? Responda a este correo o llame al ' : 'Questions? Reply to this email or call ') +
      esc_(CONFIG.RECRUITER_PHONE) + '.</p>'),
  });

  return { ok: true, token: token, link: link };
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
  if (status) sheet.getRange(row.index, COL.STATUS + 1).setValue(status);
  if (notes !== undefined && notes !== null) sheet.getRange(row.index, COL.NOTES + 1).setValue(notes);
  return { ok: true };
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
      stalled.push(row);
      continue;
    }

    var since = parseDate_(row.values[COL.LAST_REMINDER]) || updated;
    var wait = CONFIG.REMINDER_SPACING[sent];
    if (since && daysBetween_(startOfDay_(since), today) < wait) continue;

    sendReminder_(row, false);
  }

  if (stalled.length) notifyRecruiterOfStalled_(stalled);
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

function sendApplicantCopy_(p, folder) {
  if (!p.email) return;
  var lang = p.lang === 'en' ? 'en' : 'es';
  var subject = lang === 'es'
    ? 'Recibimos su solicitud de agente VUMI® ✅'
    : 'We have your VUMI® agent application ✅';

  var attachments = (p.pdfs || []).filter(function (pdf) { return pdf && pdf.base64; })
    .map(function (pdf) {
      return Utilities.newBlob(Utilities.base64Decode(pdf.base64), 'application/pdf', pdf.name);
    });

  MailApp.sendEmail({
    to: p.email,
    replyTo: CONFIG.RECRUITER_EMAIL,
    subject: subject,
    htmlBody: emailShell_(subject,
      '<p style="margin:0 0 14px">' + (lang === 'es' ? 'Hola ' : 'Hi ') + esc_(firstName_(p.name)) + ',</p>' +
      '<p style="margin:0 0 14px">' + (lang === 'es'
        ? 'Su paquete de contratación llegó completo. Adjuntamos su copia de los tres formularios firmados.'
        : 'Your contracting packet arrived complete. Your copy of all three signed forms is attached.') + '</p>' +
      '<p style="margin:0 0 10px"><b>' + (lang === 'es' ? 'Qué sigue:' : 'What happens next:') + '</b></p>' +
      '<ol style="margin:0 0 18px;padding-left:20px;color:#33475b">' +
      (lang === 'es'
        ? '<li>Revisamos su paquete y lo enviamos a VUMI®.</li>' +
          '<li>Le escribimos si hace falta algún documento de respaldo.</li>' +
          '<li>VUMI® emite su código de agente y queda listo para vender.</li>'
        : '<li>We review your packet and send it on to VUMI®.</li>' +
          '<li>We write to you if any supporting document is needed.</li>' +
          '<li>VUMI® issues your agent code and you are ready to sell.</li>') +
      '</ol>' +
      '<p style="margin:0;font-size:13px;color:#7a8ca0">' +
      (lang === 'es' ? '¿Preguntas? Responda a este correo o llame al ' : 'Questions? Reply to this email or call ') +
      esc_(CONFIG.RECRUITER_PHONE) + '.</p>'),
    attachments: attachments,
  });
}

function sendRecruiterAlert_(p, folder) {
  var missing = (p.missing || []);
  MailApp.sendEmail({
    to: CONFIG.RECRUITER_EMAIL,
    subject: 'New contracting packet — ' + (p.name || p.token),
    htmlBody: emailShell_('A packet just came in',
      statTable_([
        ['Agent', p.name || '—'],
        ['Email', p.email || '—'],
        ['Mobile', p.mobile || '—'],
        ['Completeness', (p.percent || 0) + '%'],
        missing.length ? ['Still missing', missing.join(', ')] : null,
      ].filter(Boolean)) +
      button_(folder.getUrl(), 'Open the Drive folder')),
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
  }
  return sheet;
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
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 10; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function parseDate_(value) {
  if (!value) return null;
  var d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
function startOfDay_(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
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
