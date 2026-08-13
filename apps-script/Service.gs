/**
 * ============================================================
 *  SERVICE QUESTIONNAIRE — backend
 *  Ricky Rampersad Branch
 * ============================================================
 *
 *  The paper Guardian Life "Service Questionnaire" (form 2000-03-147)
 *  and the EBD "Group Change of Agent Request" letter, automated.
 *
 *  It serves TWO front doors and keeps one worklist:
 *    · service/index.html          — the branch site's service questionnaire
 *    · donthaveanagent/review.html — donthaveanagent.com, for orphan policies
 *  A "Source" and an "Arrived via" column tell them apart in the sheet, and
 *  identity_() below makes each client's confirmation email look like the
 *  product they actually used.
 *
 *  WHAT THIS SCRIPT DOES, every time a client presses send:
 *
 *    1. Files the answers in a Google Sheet — one tab for individual
 *       clients, one for group plans, a column per question. New
 *       questions on the form become new columns automatically.
 *    2. Emails the client a thank-you with their own copy of the
 *       answers and a plain list of what happens next.
 *    3. Routes the whole thing to Customer Service with a priority
 *       in the subject line, the completed questionnaire attached as
 *       a PDF, and — if they asked for a change of servicing agent —
 *       the request letter, filled in and signed, ready to process.
 *    4. Flags anything unresolved. A client who says "this was never
 *       fixed" is not a row in a spreadsheet; it's a phone call owed
 *       within one business day, and the follow-up watchdog below
 *       chases it if nobody makes it.
 *
 *  SETUP (about ten minutes, once):
 *    1. Make a new Google Sheet — call it "Service Questionnaires".
 *    2. Extensions → Apps Script. Paste this file in. Save.
 *    3. Fill in SVC below. CS_EMAIL is the one that matters —
 *       see the note on it.
 *    4. Run setupService() once and grant the permissions it asks
 *       for. It builds the tabs and sends you a test email.
 *    5. Deploy → New deployment → Web app.
 *         Execute as:     Me
 *         Who has access: Anyone
 *       Copy the /exec URL.
 *    6. Paste that URL into CONFIG.API_URL in service/index.html,
 *       commit, and the form is live.
 *    7. Optional: run installServiceTriggers() to switch on the
 *       daily follow-up watchdog.
 *
 *  This is its own Apps Script project, with its own spreadsheet —
 *  the same arrangement as Market.gs. It does not touch, and cannot
 *  break, the renewal platform in Code.gs.
 * ============================================================
 */

var SVC = {

  /* ── Where submissions go ──────────────────────────────────────────
     CS_EMAIL is Guardian Life's Customer Service Department — the desk
     that actually processes record changes and change-of-agent requests.

     It ships EMPTY on purpose. Until you fill it in, everything routes
     to you alone and each email says so at the top. That way a live form
     can never fire a half-configured letter at a carrier inbox. Put the
     real address in, redeploy, and the routing switches on.            */
  CS_EMAIL: '',

  AGENT_EMAIL:   'ricky.rampersad@myguardiangroup.com',
  SUPPORT_EMAIL: 'support@rickyrampersadbranch.com',

  /* Copied on every submission. Add your branch admin here. */
  CC: [],

  /* Copied only when something is flagged URGENT or HIGH. Leave empty
     to use CC. This is the "somebody senior needs to see this" list.  */
  ESCALATION_CC: [],

  /* The skilled agents on the branch team. Copied whenever a client asks
     for an agent to be appointed, so the match happens the same day —
     the client's "what I want in an agent" brief is in that email.     */
  TEAM_CC: [],

  /* While a request is still open, the client hears from us this often —
     "thanks for your patience, we're working on it" — automatically,
     until somebody marks the row Handled. Calendar days.               */
  CLIENT_UPDATE_DAYS: 2,

  FROM_NAME:    'Ricky Rampersad — Guardian Life',
  AGENT_NAME:   'Ricky Rampersad',
  AGENT_NO:     '',                      // Guardian agent number, if you want it on the letter
  AGENT_PHONE:  '(868) 678-5921',
  AGENT_WHATSAPP: '18686785921',

  /* Where the form lives — used in emails so staff can reach it. */
  FORM_URL: 'https://rickyrampersadbranch.com/service/',

  IND_SHEET:   'Service Questionnaires',
  GRP_SHEET:   'Group Service Questionnaires',
  LOG_SHEET:   'Service Activity',

  /* The branch's agents and what each is strongest at. Support maintains this
     tab, and "Appoint matched agent" lists it beside the client's brief so
     every match is picked from the live roster — never hard-coded to anyone.
     Any name can still be typed in; the bank informs, it does not restrict. */
  TEAM_SHEET:  'Agent Skill Bank',

  /* The promise made to the client on screen. Change it here and in
     service/index.html together, or don't change it at all.           */
  SLA_BUSINESS_DAYS: 1,
};

var SB = { navy: '#003366', blue: '#005EB8', gold: '#E8A020', light: '#E8F0F8', ink: '#1a2433' };


/* ============================ web endpoints ============================ */

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Could not read that submission.' });
  }

  try {
    if (body.action !== 'service') return json_({ ok: false, error: 'Unknown action' });
    return json_(handleSubmission_(body));
  } catch (err) {
    /* A real failure means a client pressed send and something broke on our
       side. Never lose it — tell us, loudly, with the raw payload. A rejected
       junk POST is not that, and shouldn't page anybody. */
    if (!err || !err.validation) reportFailure_(err, body);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** A submission we're deliberately turning away, not a bug. */
function bad_(msg) {
  var e = new Error(msg);
  e.validation = true;
  return e;
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'ping') {
    return json_({ ok: true, service: 'Service Questionnaire', configured: !!SVC.CS_EMAIL });
  }
  if (p.action === 'status') {
    return json_(statusFor_(p.ref, p.code));
  }
  /* Anyone who lands on the /exec URL directly gets pointed at the form. */
  return HtmlService.createHtmlOutput(
    '<meta http-equiv="refresh" content="0;url=' + SVC.FORM_URL + '">' +
    '<p style="font:15px sans-serif">Taking you to the service questionnaire… ' +
    '<a href="' + SVC.FORM_URL + '">continue</a>.</p>');
}

/**
 * Progress for one submission, released only to someone holding BOTH the
 * reference and the access code generated for it. What comes back is status
 * metadata — never the answers themselves.
 */
function statusFor_(ref, code) {
  ref = String(ref || '').trim().toUpperCase();
  code = String(code || '').trim().toUpperCase();
  if (!ref || !code) return { ok: false, error: 'Enter your reference and your access code.' };

  var names = [SVC.IND_SHEET, SVC.GRP_SHEET];
  for (var n = 0; n < names.length; n++) {
    var sh = ss_().getSheetByName(names[n]);
    if (!sh || sh.getLastRow() < 2) continue;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var col = function (h) { return headers.indexOf(h); };
    var iRef = col('Reference'), iCode = col('Access code');
    if (iRef < 0 || iCode < 0) continue;

    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (String(r[iRef] || '').trim().toUpperCase() !== ref) continue;
      if (String(r[iCode] || '').trim().toUpperCase() !== code) {
        return { ok: false, error: 'That access code does not match this reference. Check your confirmation email — the code is printed under your reference.' };
      }

      var status = String(r[col('Status')] || '');
      var done = /handled/i.test(status);
      var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
      var fmt = function (v) {
        if (!v) return '';
        var d = new Date(v);
        return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tz, 'd MMMM yyyy');
      };

      return {
        ok: true,
        ref: r[iRef],
        kind: names[n] === SVC.GRP_SHEET ? 'group' : 'individual',
        who: String(r[col('Company')] || r[col('Client')] || ''),
        filed: fmt(r[col('Timestamp')]),
        status: done ? 'Completed' : 'In progress',
        stage: done ? 4 : 2,   /* 1 received · 2 verifying & populating · 3 signature out · 4 done */
        route: col('Looked after by') > -1 ? String(r[col('Looked after by')] || '') : '',
        lastUpdate: col('Last client update') > -1 ? fmt(r[col('Last client update')]) : '',
        handledOn: col('Handled on') > -1 ? fmt(r[col('Handled on')]) : '',
        signed: col('Signed') > -1 ? !!String(r[col('Signed')] || '') : false,
        updateEveryDays: SVC.CLIENT_UPDATE_DAYS,
      };
    }
  }
  return { ok: false, error: 'We could not find that reference. Check it against your confirmation email, or call ' + SVC.AGENT_PHONE + '.' };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================ the main job ============================ */

/**
 * A web app deployed to "Anyone" is a door onto the public internet. This is
 * the doorman: enough to keep junk out of the sheet and cap what one POST can
 * cost us, and nothing so strict that a real client gets turned away.
 */
function validate_(body) {
  var c = body.core || {};
  var fields = body.fields || [];

  if (!Array.isArray(fields)) throw bad_('Malformed submission.');
  if (!fields.length && !c.clientName && !c.email) throw bad_('Empty submission — nothing to file.');
  if (fields.length > 400) throw bad_('That submission is too large to process.');

  /* Trim anything absurd rather than rejecting it — a client who pasted their
     life story into a comment box should still be heard, just not without
     limit. */
  fields.forEach(function (f) {
    f.label = String(f.label == null ? '' : f.label).slice(0, 300);
    f.value = String(f.value == null ? '' : f.value).slice(0, 6000);
    f.section = String(f.section == null ? '' : f.section).slice(0, 120);
    /* Date pickers hand us 1984-06-14. Nobody reads a letter like that. */
    f.value = prettyDate_(f.value);
  });
  ['clientName', 'companyName', 'email', 'phone', 'policyNos'].forEach(function (k) {
    if (c[k]) c[k] = String(c[k]).slice(0, 300);
  });
  if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) c.email = '';

  /* A signature bigger than this isn't a signature. */
  if (body.signature && String(body.signature).length > 400000) body.signature = '';
  if (body.signature && String(body.signature).indexOf('data:image/') !== 0) body.signature = '';

  return body;
}

function handleSubmission_(body) {
  body = validate_(body);
  var isGroup = body.kind === 'group';
  var core = body.core || {};
  var fields = body.fields || [];
  var ref = nextRef_(isGroup, body);
  var priority = computePriority_(body);
  var accessCode = accessCode_();
  var now = new Date();

  /* 1 — file it */
  saveRow_(isGroup, ref, priority, now, body, accessCode);

  /* 2 — build the paperwork once, attach it to both emails.
     Branch clients get ONE legal document: the individual's form 2000-03-147
     (which itself carries the change of servicing agent request) or the
     group's change of agent letter — each with every question asked and
     answered as its addendum. donthaveanagent.com has no printed form, so it
     keeps the review document plus, on the signed path, the letter. */
  var attachments = [];
  var formPdf = null, letterPdf = null;
  if (!identity_(body).dhaa) {
    formPdf = isGroup ? groupOnePdf_(ref, priority, now, body)
                      : paperFacsimilePdf_(ref, priority, now, body);
    if (formPdf) attachments.push(formPdf);
  } else {
    formPdf = answersPdf_(ref, priority, now, body);
    if (formPdf) attachments.push(formPdf);
    /* the letter only when there is a signature to carry — a matched-agent
       appointment is populated by support after verification and assignment */
    if (core.changeAgent && (body.signature || body.signatureTyped)) {
      letterPdf = isGroup ? groupAgentLetterPdf_(ref, now, body) : agentLetterPdf_(ref, now, body);
      if (letterPdf) attachments.push(letterPdf);
    }
  }

  /* 3 — the client hears from us immediately */
  var clientEmailed = false;
  if (core.email) {
    try {
      sendClientThanks_(ref, priority, body, formPdf, letterPdf, accessCode);
      clientEmailed = true;
    } catch (err) {
      log_(ref, 'client-email-failed', String(err));
    }
  }

  /* 4 — and Customer Service gets everything */
  var routedTo = routeToService_(ref, priority, now, body, attachments, clientEmailed);

  log_(ref, 'submitted', priority + ' · ' + (core.companyName || core.clientName || 'unnamed') +
       ' · ' + fields.length + ' answers · routed to ' + routedTo.join(', '));

  return {
    ok: true,
    ref: ref,
    priority: priority,
    accessCode: accessCode,
    clientEmailed: clientEmailed,
    slaDays: SVC.SLA_BUSINESS_DAYS,
  };
}

/** Six characters a person can read down a phone line — no 0/O, no 1/I/L. */
function accessCode_() {
  var abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 6; i++) out += abc.charAt(Math.floor(Math.random() * abc.length));
  return out;
}


/* ============================ priority ============================
   The client is told on screen what happens next. This is the code that
   has to make it true. Server-side is the version that counts — the page
   computes the same thing only so the promise and the inbox agree.     */

function computePriority_(body) {
  var c = body.core || {};
  var fields = body.fields || [];

  if (c.unresolved && /urgent/i.test(String(c.unresolvedUrgency || ''))) return 'URGENT';
  if (c.unresolved) return 'HIGH';
  if (Number(c.satisfaction) && Number(c.satisfaction) <= 2) return 'HIGH';
  if (c.nps !== '' && c.nps !== undefined && Number(c.nps) <= 6) return 'HIGH';

  /* donthaveanagent.com — somebody who has not been contacted in over five
     years and has finally raised their hand is not a routine filing. If we
     leave that one sitting in a queue we have proved their point for them. */
  if (/more than 5 years|never/i.test(String(c.lastContact || ''))) return 'HIGH';

  if (c.changeAgent) return 'ACTION';
  if (c.needsTracing) return 'ACTION';
  if (fields.some(function (f) { return f.flag === 'records'; })) return 'ACTION';
  return 'NORMAL';
}

function priorityColor_(p) {
  return p === 'URGENT' ? '#b3261e' : p === 'HIGH' ? '#c2570a' : p === 'ACTION' ? '#005EB8' : '#1e7d4f';
}

/* Plain English for why it was flagged — so whoever opens the email knows
   in one line what they're being asked to do. */
function priorityReason_(body) {
  var c = body.core || {};
  var bits = [];
  if (c.unresolved) bits.push('an unresolved problem the client says was never fixed' +
    (c.unresolvedUrgency ? ' (' + c.unresolvedUrgency + ')' : ''));
  if (/more than 5 years|never/i.test(String(c.lastContact || '')))
    bits.push('nobody has reviewed this policy with them in ' +
      (/never/i.test(String(c.lastContact)) ? 'their entire time as a policyholder' : 'over five years'));
  if (c.needsTracing) bits.push('a policy that needs tracing — they do not have the number');
  if (Number(c.satisfaction) && Number(c.satisfaction) <= 2) bits.push('a satisfaction score of ' + c.satisfaction + '/5');
  if (c.nps !== '' && c.nps !== undefined && Number(c.nps) <= 6) bits.push('a recommend score of ' + c.nps + '/10');
  if (c.changeAgent) bits.push('a change of servicing agent request');
  var recs = (body.fields || []).filter(function (f) { return f.flag === 'records'; });
  if (recs.length) bits.push(recs.length + ' record change' + (recs.length > 1 ? 's' : '') + ' to process');
  var leads = (body.fields || []).filter(function (f) { return f.flag === 'lead'; });
  if (leads.length) bits.push(leads.length + ' follow-up request' + (leads.length > 1 ? 's' : ''));
  return bits.length ? bits.join('; ') : 'a routine service review — no action outstanding';
}


/* ============================ the sheet ============================ */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheetFor_(isGroup) {
  var name = isGroup ? SVC.GRP_SHEET : SVC.IND_SHEET;
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.appendRow(['Reference', 'Timestamp', 'Priority', 'Status', 'Handled by', 'Handled on',
                  'Client', 'Company', 'Email', 'Phone', 'Insurer', 'Policy #', 'Score', 'Minutes taken',
                  'Source', 'Arrived via', 'Sent by', 'Link ref', 'Needs tracing',
                  // Compliance record. These four are the auditable trail for a
                  // registered agent: what the client declared, what they agreed
                  // we could do with it, whether they opted into marketing, and
                  // which version of the form they were actually served.
                  'Declared true', 'Consent to service', 'Marketing consent',
                  'Coverage questions asked']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground(SB.light);
  }
  return sh;
}

function logSheet_() {
  var sh = ss_().getSheetByName(SVC.LOG_SHEET);
  if (!sh) {
    sh = ss_().insertSheet(SVC.LOG_SHEET);
    sh.appendRow(['Timestamp', 'Reference', 'Event', 'Details']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function log_(ref, event, details) {
  try { logSheet_().appendRow([new Date(), ref, event, String(details || '').slice(0, 900)]); } catch (e) {}
}

/** The Agent Skill Bank tab — the branch keeps its roster here, one agent a
 *  row, and "Appoint matched agent" lists it beside the client's brief.
 *  The team updates it as skills grow; nothing in the code names an agent. */
function teamBankSheet_() {
  var sh = ss_().getSheetByName(SVC.TEAM_SHEET);
  if (!sh) {
    sh = ss_().insertSheet(SVC.TEAM_SHEET);
    sh.appendRow(['Agent', 'Agent no.', 'Skills & strengths', 'Availability',
                  'Languages', 'Areas covered', 'Active', 'Notes']);
    sh.setFrozenRows(1);
    try {
      sh.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground(SB.light);
    } catch (e) {}
  }
  return sh;
}

/**
 * One row per submission, one column per question — and if the form grows a
 * new question tomorrow, the column appears on its own. That is the whole
 * reason the front end sends labels along with answers: nobody has to keep
 * two lists of questions in step by hand.
 */
function saveRow_(isGroup, ref, priority, now, body, accessCode) {
  var sh = sheetFor_(isGroup);
  var c = body.core || {};

  var vals = {
    'Reference': ref,
    'Timestamp': now,
    'Priority': priority,
    'Status': priority === 'NORMAL' ? 'Filed' : 'Open',
    'Handled by': '',
    'Handled on': '',
    'Client': c.clientName || '',
    'Company': c.companyName || '',
    'Email': c.email || '',
    'Phone': c.phone || '',
    'Insurer': c.insurer || '',
    'Policy #': c.policyNos || '',
    /* donthaveanagent.com doesn't compute a score, so this must stay blank
       rather than writing the string "undefined" into the sheet. */
    'Score': (c.score === '' || c.score === undefined || c.score === null) ? '' : c.score,
    'Minutes taken': body.minutesTaken || '',

    /* Where it came from. The service questionnaire on the branch site and
       donthaveanagent.com both land here — same work, one worklist — and
       these columns are how you tell them apart when you report on it. */
    'Source': body.source || 'branch site',
    'Arrived via': body.origin === 'agent' ? 'Agent sent the link'
                 : body.origin === 'client' ? 'Client came on their own'
                 : '',
    'Sent by': (body.sentBy && body.sentBy.name) || '',
    'Link ref': body.linkRef || '',
    'Needs tracing': c.needsTracing ? 'YES — no policy number' : '',

    /* Who the client chose to be looked after by — the in-house team direct,
       or an agent matched to the brief they wrote. Drives the assignment. */
    'Looked after by': c.handledBy || '',

    /* Group change of agent needs the physical letter back — letterhead and
       company stamp. While this starts with YES, the every-2-day note chases
       the letter, referencing the previous correspondence, until support
       replaces it (e.g. "Received 15 Aug") or marks the row Handled.
       On the matched-agent path no letter has gone out yet — support sends it
       populated after verification and assignment, then sets this to YES so
       the chase starts from the day the client actually has the letter. */
    'Letter outstanding': (isGroup && c.changeAgent)
      ? ((identity_(body).dhaa && !(body.signature || body.signatureTyped))
          ? 'After match — support to send, then set YES'
          : 'YES — awaiting stamped letter')
      : '',

    /* The code that lets the client (and only the client) watch this row's
       progress from the website. Released with the reference, never alone. */
    'Access code': accessCode || '',

    /* Stamped by the watchdog each time the client is sent a "still working
       on it" note, so the every-2-days promise is measured, not guessed. */
    'Last client update': '',
  };

  (body.fields || []).forEach(function (f) {
    /* The question text is the column heading. Long ones get trimmed so the
       sheet stays readable; the PDF keeps the full wording. */
    var head = String(f.label || f.id || '').slice(0, 120);
    if (head) vals[head] = f.value;
  });

  /* The compliance record, written from the consent block the client actually
     ticked rather than inferred from anything. "Declared true" and "Consent to
     service" are mandatory on the form, so a No here means something went
     wrong and the row should be treated as unusable until it's checked. */
  var con = body.consent || {};
  vals['Declared true'] = con['true'] ? 'Yes' : 'No';
  vals['Consent to service'] = con.use ? 'Yes' : 'No';
  vals['Marketing consent'] = (con.marketing || c.consentMarketing) ? 'Yes' : 'No';
  vals['Coverage questions asked'] = body.coverageAsked === undefined
    ? '' : (body.coverageAsked ? 'Yes' : 'No — sales-free version served');
  vals['Signed'] = body.signature ? 'Drawn' : (body.signatureTyped ? 'Typed: ' + body.signatureTyped : '');

  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  Object.keys(vals).forEach(function (h) {
    if (headers.indexOf(h) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h).setFontWeight('bold').setBackground(SB.light);
      headers.push(h);
    }
  });
  sh.appendRow(headers.map(function (h) { return (h in vals) ? vals[h] : ''; }));

  /* Colour the priority cell — an open URGENT row should be visible from
     across the room. */
  try {
    var row = sh.getLastRow();
    var pCol = headers.indexOf('Priority') + 1;
    if (pCol > 0 && priority !== 'NORMAL') {
      sh.getRange(row, pCol).setBackground(priority === 'URGENT' ? '#fbe9e7' : '#fdf1dc')
        .setFontColor(priorityColor_(priority)).setFontWeight('bold');
    }
  } catch (e) {}
}

/**
 * Which product the client thinks they used.
 *
 * Two front doors share this backend, and a client who filled in a form
 * branded donthaveanagent.com should not get a confirmation headed "Service
 * Questionnaire" from a company they've never heard of. The reference prefix,
 * the email header and the subject line all follow from here.
 */
function identity_(body) {
  var dhaa = /donthaveanagent/i.test(String((body && body.source) || ''));
  return dhaa
    ? { dhaa: true,  name: "Don't Have An Agent", tag: 'Policy review',
        prefix: 'DHA', groupPrefix: 'DHAG',
        thing: 'policy review', subject: 'Your policy review is in' }
    : { dhaa: false, name: 'Service Questionnaire', tag: 'Policy service review',
        prefix: 'SQ', groupPrefix: 'GSQ',
        thing: 'service questionnaire', subject: 'Thank you — your service questionnaire is in' };
}

/** DHA-260812-0007 — dated, sequential, and easy to read down a phone line.
 *  The prefix says which front door it came through. */
function nextRef_(isGroup, body) {
  var sh = sheetFor_(isGroup);
  var n = Math.max(0, sh.getLastRow() - 1) + 1;
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var id = identity_(body);
  return (isGroup ? id.groupPrefix : id.prefix) + '-' +
         Utilities.formatDate(new Date(), tz, 'yyMMdd') + '-' + ('000' + n).slice(-4);
}


/* ============================ email furniture ============================ */

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Date inputs arrive as 2026-09-01. On a letter that should read
 *  "1 September 2026" — anything else looks like a computer wrote it. */
function prettyDate_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return String(s || '');
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Utilities.formatDate(d, tz, 'd MMMM yyyy');
}

function wrap_(inner, tag, id) {
  id = id || identity_(null);
  /* donthaveanagent.com has its own colours — Porcelain & Oxblood, the same
     palette as the site, so a client who used that product recognises the
     email as coming from it. */
  var bg = id.dhaa ? '#5E141F' : SB.navy;
  var chip = id.dhaa ? '#F2E9DC' : SB.gold;
  var chipInk = id.dhaa ? '#5E141F' : SB.navy;
  var sub = id.dhaa ? '#E5C9B3' : '#b7c9de';
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:' + SB.ink + ';max-width:660px">' +
    '<div style="background:' + bg + ';color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td width="46" valign="middle"><table cellpadding="0" cellspacing="0"><tr>' +
        '<td style="width:38px;height:38px;background:' + chip + ';border-radius:8px 8px 14px 14px;' +
        'text-align:center;font-size:22px;font-weight:bold;color:' + chipInk + '">✓</td></tr></table></td>' +
      '<td valign="middle" style="padding-left:10px"><b style="font-size:18px">' + esc_(id.name) + '</b><br>' +
        '<span style="color:' + sub + ';font-size:12px">' + esc_(tag || id.tag) +
        ' · ' + esc_(SVC.AGENT_NAME) + '</span></td>' +
      '</tr></table></div>' +
    '<div style="border:1px solid #dde5ee;border-top:none;padding:22px;border-radius:0 0 10px 10px">' + inner +
    '</div></div>';
}

function tr_(k, v) {
  return '<tr><td style="padding:8px 12px;background:#f4f7fa;border:1px solid #e3eaf2;width:46%;color:#5a6b80;' +
    'vertical-align:top">' + esc_(k) + '</td>' +
    '<td style="padding:8px 12px;border:1px solid #e3eaf2;vertical-align:top">' + esc_(v) + '</td></tr>';
}

/** A small typographic tag for the team's action list — reads cleanly in any
 *  mail client, prints in black and white, and never renders as a tofu box. */
function badge_(label, color) {
  return '<span style="display:inline-block;background:' + color + ';color:#fff;font-size:10px;' +
    'font-weight:bold;letter-spacing:.08em;padding:2.5px 8px;border-radius:3px;margin-right:8px;' +
    'vertical-align:1.5px">' + label + '</span>';
}

function box_(kind, html) {
  var c = kind === 'warn' ? { bg: '#fbe9e7', bar: '#b3261e' }
        : kind === 'good' ? { bg: '#e8f5ee', bar: '#1e7d4f' }
        : { bg: '#fdf6e9', bar: SB.gold };
  return '<div style="background:' + c.bg + ';border-left:4px solid ' + c.bar +
         ';padding:13px 16px;margin:14px 0;font-size:13.5px;line-height:1.6">' + html + '</div>';
}

function sig_() {
  return '<p style="margin-top:20px">Warm regards,<br><b>' + esc_(SVC.AGENT_NAME) + '</b><br>' +
    'Guardian Life of the Caribbean Limited' +
    (SVC.AGENT_PHONE ? '<br>' + esc_(SVC.AGENT_PHONE) : '') +
    (SVC.AGENT_EMAIL ? '<br>' + esc_(SVC.AGENT_EMAIL) : '') + '</p>';
}

/** Answers grouped under their section headings — the same order the client
 *  saw them in, which is the order they'll remember them in. */
function answerTables_(body) {
  var out = '', section = '';
  (body.fields || []).forEach(function (f) {
    if (f.section !== section) {
      if (section) out += '</table>';
      section = f.section;
      out += '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:' + SB.blue +
             ';margin:20px 0 7px">' + esc_(section) + '</h3>' +
             '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13.5px">';
    }
    out += tr_(f.label, f.value);
  });
  if (section) out += '</table>';
  return out;
}


/* ============================ email 1 — the client ============================
   The thank-you. It has one job beyond good manners: tell them exactly what
   happens next, in their case, with dates and a name attached. Vague
   reassurance is what makes people ring back a week later to check.        */

function sendClientThanks_(ref, priority, body, formPdf, letterPdf, accessCode) {
  var c = body.core || {};
  var a = answersById_(body);
  var isGroup = body.kind === 'group';
  var first = String(c.clientName || '').trim().split(/\s+/)[0] || 'there';

  var next = [];

  next.push('<b>Our support team has your file, and verification starts now.</b> They check your answers, ' +
    (isGroup ? 'prepare your letter with every detail filled in, '
             : 'trace and <b>fill in all the policy numbers for you</b>, ') +
    'then populate your documents for your <b>digital signature</b> — anything that needs signing arrives ' +
    'ready-made. Nothing to print, nothing to fill in twice.');

  if (c.handledBy === 'Matched agent') {
    next.push('<b>We are matching your agent now.</b> Once your answers are verified, we assign the agent who fits ' +
      'the brief you wrote, and your appointment papers arrive by email populated for your digital signature — ' +
      'with that agent\'s name filled in, and a note on who we chose and why.');
  } else if (c.handledBy === 'Direct — in-house team') {
    next.push('<b>You chose direct.</b> ' + esc_(SVC.AGENT_NAME) + '\'s in-house team looks after you from here — ' +
      'one office, one number, no hand-offs.');
  }

  if (c.unresolved) {
    next.push('<b>The problem you told us about is already flagged.</b> It has gone straight to a service ' +
      'manager marked <b>' + esc_(c.unresolvedUrgency || 'for follow-up') + '</b>, and you will hear from a person — ' +
      'not an automatic reply — within ' + SVC.SLA_BUSINESS_DAYS + ' business day' +
      (SVC.SLA_BUSINESS_DAYS > 1 ? 's' : '') + '. If you would rather not wait, call ' +
      esc_(SVC.AGENT_PHONE) + ' and quote ' + esc_(ref) + '.');
  }

  if (c.changeAgent) {
    var brief = a.wantInAgent
      ? ' You told us what you want in an agent — <b>' + esc_(String(a.wantInAgent)) + '</b> — and that is the ' +
        'brief your agent is matched on, and held to.'
      : '';
    /* A matched client asked US to pick — the appointment is with the matching
       desk until support assigns the agent, so nobody reads the manager's name
       as the answer to "who is my agent?". */
    next.push(c.handledBy === 'Matched agent'
      ? '<b>Your request to appoint an agent is with the branch’s matching desk.</b>' + brief
      : '<b>Your agent appointment goes direct to ' + esc_(SVC.AGENT_NAME) + ' and the branch team.</b>' + brief);
    /* Only claim the letter is attached when it truly is. On the branch site
       the one legal document IS the letter; on donthaveanagent.com the letter
       rides only on the signed (direct) path — a matched client's letter is
       populated after verification and assignment. */
    var letterInHand = !identity_(body).dhaa || !!letterPdf;
    next.push(isGroup
      ? (letterInHand
          ? '<b>Your change of agent request is attached as a letter — print it, stamp it, sign it, send it back.</b> ' +
            'Guardian needs it on your company letterhead with the company stamp. Reply to this email with a photo or ' +
            'scan, or hand it to us. <b>Until we receive it we will write to you every ' + SVC.CLIENT_UPDATE_DAYS +
            ' days, referencing our previous correspondence</b>, so it never slips through — the reminders stop the ' +
            'moment the letter is in. We have already started the request at Customer Service so nothing waits on the post.'
          : '<b>Your change of agent letter follows once your matched agent is confirmed.</b> It arrives by email ' +
            'populated for your company letterhead — with the agent’s name already filled in — and all you do is ' +
            'print it, stamp it, sign it and send it back. <b>From the day it goes out we will write to you every ' +
            SVC.CLIENT_UPDATE_DAYS + ' days, referencing our previous correspondence</b>, until it is safely in.')
      : (letterInHand
          ? '<b>Your change of servicing agent request has gone to Customer Service</b>, signed and attached here for ' +
            'your records. It usually takes 5 to 10 working days and Guardian confirms the change to you in writing. ' +
            'Your policy, your premium and your cover are not affected in any way.'
          : '<b>Your change of servicing agent papers follow once your matched agent is confirmed</b> — they arrive ' +
            'by email populated for your digital signature, with the agent’s name filled in. Your policy, your ' +
            'premium and your cover are not affected in any way.'));
  }

  var recs = [];
  if (a.nameAddrOk === 'No') recs.push('your name and address');
  if (a.dobOk === 'No') recs.push('your date of birth');
  if (a.beneficiaryOk && a.beneficiaryOk !== 'Yes') recs.push('your beneficiary designation');
  if (a.premiumOk === 'No') recs.push('how you pay your premium');
  if (a.paperless === 'Yes') next.push('<b>We are switching you to e-documents</b> — statements and letters by email, nothing lost in the post.');
  if (a.listingCurrent && a.listingCurrent !== 'Yes') recs.push('your member listing');
  if (a.billingOk && a.billingOk !== 'Yes') recs.push('your billing');
  if (recs.length) {
    next.push('<b>We are updating ' + esc_(recs.join(', ')) + '.</b> Where Guardian needs your signature — a ' +
      'beneficiary change always does — the form comes to you by email already filled in, so all you do is sign it.');
  }

  if (a.wantLocator === 'Yes') next.push('<b>Your Policy Location Record is on its way</b> — the one-page sheet that tells your family what you hold and who to call.');
  if (a.willHelp === 'Yes') next.push('<b>Our plain-English guide to making a Will is on its way</b>, and we can point you to an attorney if you would like one.');
  if (a.wantAnalysis === 'Yes') next.push('<b>Your free needs analysis is booked in.</b> We bring the numbers, you decide what to do with them. No cost and no obligation.');
  if (a.wantBenchmark === 'Yes') next.push('<b>We will prepare your market comparison</b> ahead of renewal — your plan beside what comparable companies provide and pay.');
  if (a.employeeReviews === 'Yes') next.push('<b>We will arrange individual reviews for your employees</b> — private, voluntary, and at times that suit your operation.');
  if (a.engagement && String(a.engagement).indexOf('None') !== 0) next.push('<b>We will be in touch about the sessions you asked for</b> (' + esc_(a.engagement) + '). These are provided at no cost to your company.');
  if (a.referral === 'Yes') next.push('<b>Thank you for the introduction.</b> Whoever you have sent us will be looked after exactly as you are.');
  if (c.contactFreq) next.push('<b>Your next check-in is set: ' + esc_(String(c.contactFreq).toLowerCase()) + '.</b> It is in our system now, so it does not depend on anybody remembering.');
  if (a.questions) next.push('<b>Your question gets a written answer</b>, not a brochure. Give us a day or two to answer it properly.');

  next.push('<b>You will never be left wondering.</b> Until everything here is closed, we send you an update ' +
    'every ' + SVC.CLIENT_UPDATE_DAYS + ' days — even when the update is simply that we are still working on it.');

  next.push('<b>Keep this email.</b> The attached PDF is a complete record of what you told us today, and the ' +
    'reference above will pull your file up in seconds if you call.');

  var scoreBlock = '';
  if (c.score !== '' && c.score !== undefined) {
    var gaps = (c.scoreGaps || []).slice(0, 3);
    scoreBlock = box_('tip',
      '<b style="color:#a05e03">Your ' + (isGroup ? 'Plan Health' : 'Protection') + ' Score: ' + esc_(c.score) + ' out of 100.</b><br>' +
      (gaps.length
        ? 'The areas worth a conversation: <b>' + esc_(gaps.join(' · ')) + '</b>. Nothing here needs a decision today — ' +
          'it is simply what we would look at together first.'
        : 'Everything we look at is in good order. We will confirm the details and keep it that way.'));
  }

  var bio = box_('tip',
    '<b style="color:#a05e03">Who you\u2019re dealing with.</b><br>' +
    '<b>' + esc_(SVC.AGENT_NAME) + '</b> — Branch Manager, Ricky Rampersad Branch \u00b7 Guardian Life of the ' +
    'Caribbean Limited. Branch Manager — and still a servicing agent to his own clients — leading a team of ' +
    'skilled, licensed Guardian Life agents on one idea: nobody who holds a policy should ever feel forgotten. The branch pairs old-fashioned service — a person who answers, visits and ' +
    'follows through — with tools most agencies don\u2019t have: guided digital reviews, documents populated for ' +
    'digital signature, live progress tracking, and an update every ' + SVC.CLIENT_UPDATE_DAYS + ' days until the ' +
    'work is done. This review is the first step of your onboarding — from here, you are dealing with ' +
    esc_(SVC.AGENT_NAME) + ' and his team.');

  var track = '';
  var id0 = identity_(body);
  if (id0.dhaa && accessCode) {
    var trackUrl = 'https://donthaveanagent.com/status.html?ref=' + encodeURIComponent(ref);
    track = box_('tip',
      '<b style="color:#a05e03">Watch your request move.</b> Log in any time at ' +
      '<a href="' + trackUrl + '">donthaveanagent.com</a> with your reference and this access code:' +
      '<div style="font-size:22px;font-weight:800;letter-spacing:.22em;margin:10px 0 4px;color:#5E141F">' +
      esc_(accessCode) + '</div>' +
      '<span style="font-size:12px">Keep it private — anyone holding it can see the status (never the answers) of this request.</span>');
  }

  var id = identity_(body);
  var opener = id.dhaa
    ? (body.origin === 'client'
        ? 'Thank you for getting in touch. You did the hard part — most people in your position never do, ' +
          'because they assume being forgotten was somehow their own fault. It wasn\'t.'
        : 'Thank you for completing your policy review. It is genuinely useful — most of what we get wrong in ' +
          'this business, we get wrong because nobody told us anything had changed.')
    : 'Thank you for completing your ' + (isGroup ? 'plan service review' : 'service questionnaire') +
      '. It is genuinely useful — most of what we get wrong in this business, we get wrong because nobody told ' +
      'us anything had changed.';

  var html = wrap_(
    '<p>Dear ' + esc_(first) + ',</p>' +
    '<p>' + opener + '</p>' +
    '<p>Your reference is <b style="color:' + SB.navy + '">' + esc_(ref) + '</b>.</p>' +
    track +
    scoreBlock +
    '<h3 style="font-size:15px;color:' + SB.navy + ';margin:22px 0 6px">What happens next</h3>' +
    '<ol style="padding-left:20px;margin:0;font-size:13.8px;line-height:1.65">' +
      next.map(function (n) { return '<li style="margin-bottom:9px">' + n + '</li>'; }).join('') +
    '</ol>' +
    box_('good', 'Nothing on this list needs you to do anything. If a form needs signing, it comes to you. ' +
      'If a person needs to call you, they call you.') +
    bio +
    '<p style="margin-top:18px">If anything above looks wrong, just reply to this email and we will put it right.</p>' +
    sig_(),
    isGroup ? 'Group plan review' : id.tag, id);

  var atts = [];
  if (formPdf) atts.push(formPdf);
  if (letterPdf) atts.push(letterPdf);

  MailApp.sendEmail({
    to: c.email,
    name: SVC.FROM_NAME,
    replyTo: SVC.AGENT_EMAIL,
    subject: id.subject + ' (' + ref + ')',
    htmlBody: html,
    attachments: atts,
  });
}


/* ============================ email 2 — customer service ============================ */

function routeToService_(ref, priority, now, body, attachments, clientEmailed) {
  var c = body.core || {};
  var av = answersById_(body);
  var isGroup = body.kind === 'group';
  var id = identity_(body);

  var to = [];
  if (SVC.CS_EMAIL) to.push(SVC.CS_EMAIL);
  to.push(SVC.AGENT_EMAIL);

  var cc = (SVC.CC || []).slice();
  if (SVC.SUPPORT_EMAIL) cc.push(SVC.SUPPORT_EMAIL);
  if ((priority === 'URGENT' || priority === 'HIGH') && SVC.ESCALATION_CC.length) {
    cc = cc.concat(SVC.ESCALATION_CC);
  }
  /* An agent appointment goes direct to the whole skilled team, so the
     match can happen the same day the client asks. */
  if (c.changeAgent && (SVC.TEAM_CC || []).length) cc = cc.concat(SVC.TEAM_CC);
  cc = cc.filter(function (x, i, arr) { return x && to.indexOf(x) < 0 && arr.indexOf(x) === i; });

  var notConfigured = SVC.CS_EMAIL ? '' : box_('warn',
    '<b>Customer Service routing is not switched on yet.</b> This submission went only to the branch. ' +
    'Set <code>SVC.CS_EMAIL</code> in Service.gs and redeploy to route these to Guardian Life Customer Service.');

  var actions = [];
  if (c.needsTracing) {
    actions.push(badge_('TRACE', SB.blue) + '<b>Trace the policy first.</b> They do not have the number' +
      (c.insurer ? ' — they think it is with <b>' + esc_(c.insurer) + '</b>' : '') +
      '. Search on name and date of birth' +
      (c.clientName ? ': <b>' + esc_(c.clientName) + '</b>' : '') + '.');
  }
  if (body.origin === 'client') {
    actions.push(badge_('CARE', '#1e7d4f') + '<b>No product questions were asked</b> — they came to us unprompted. ' +
      'Answer exactly what they asked for and nothing more; a sales approach here loses them for good.');
  }
  (body.fields || []).forEach(function (f) {
    if (f.flag === 'urgent')  actions.push(badge_('URGENT', '#b3261e') + '<b>' + esc_(f.label) + '</b> — ' + esc_(f.value));
    if (f.flag === 'records') actions.push(badge_('RECORDS', SB.blue) + '<b>' + esc_(f.label) + '</b> — ' + esc_(f.value));
    if (f.flag === 'agent')   actions.push(badge_('AGENT', '#5E141F') + '<b>' + esc_(f.label) + '</b> — ' + esc_(f.value));
    if (f.flag === 'lead')    actions.push(badge_('FOLLOW-UP', '#a05e03') + '<b>' + esc_(f.label) + '</b> — ' + esc_(f.value));
    if (f.flag === 'service') actions.push(badge_('REPLY', '#455a75') + '<b>' + esc_(f.label) + '</b> — ' + esc_(f.value));
  });

  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var html = wrap_(
    notConfigured +
    '<div style="background:' + priorityColor_(priority) + ';color:#fff;padding:10px 15px;border-radius:8px;' +
      'font-size:14px;font-weight:bold;margin-bottom:16px">' + esc_(priority) + ' · ' + esc_(ref) + '</div>' +

    '<p style="font-size:14px;margin-bottom:14px"><b>Why it is flagged:</b> ' + priorityReason_(body) + '</p>' +

    '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13.5px">' +
      tr_('Reference', ref) +
      tr_('Received', Utilities.formatDate(now, tz, 'EEE d MMM yyyy, h:mm a')) +
      tr_('Came from', (body.source || 'branch site') +
        (body.origin === 'agent' ? ' · agent sent the link' + ((body.sentBy && body.sentBy.name) ? ' (' + body.sentBy.name + ')' : '')
       : body.origin === 'client' ? ' · client arrived on their own — no product questions were asked'
       : '')) +
      tr_(isGroup ? 'Company' : 'Client', (isGroup ? c.companyName : c.clientName) || '—') +
      (isGroup ? tr_('Contact', c.clientName || '—') : '') +
      tr_('Email', c.email || '—') +
      tr_('Phone', c.phone || '—') +
      tr_('Policy #', c.policyNos || 'not given — look up by name') +
      tr_('Prefers', (c.prefContact || '—') + (c.contactFreq ? ' · check in ' + String(c.contactFreq).toLowerCase() : '')) +
      tr_('Satisfaction', (c.satisfaction ? c.satisfaction + '/5' : '—') + (c.nps !== '' && c.nps !== undefined ? ' · would recommend ' + c.nps + '/10' : '')) +
      (c.score !== '' && c.score !== undefined ? tr_(isGroup ? 'Plan health score' : 'Protection score', c.score + '/100' +
        ((c.scoreGaps || []).length ? ' · gaps: ' + c.scoreGaps.join(', ') : '')) : '') +
      tr_('Client emailed', clientEmailed ? 'Yes — thank-you sent with their copy' : 'No — no email address given') +
      tr_('Marketing consent', c.consentMarketing ? 'Yes' : 'No') +
    '</table>' +

    (actions.length
      ? '<h3 style="font-size:15px;color:' + SB.navy + ';margin:22px 0 8px">Action list</h3>' +
        '<div style="font-size:13.5px;line-height:1.75">' + actions.join('<br>') + '</div>'
      : box_('good', 'Nothing outstanding on this one. Filed for the record.')) +

    (priority === 'URGENT' || priority === 'HIGH'
      ? box_('warn', '<b>The client has been promised contact from a person within ' + SVC.SLA_BUSINESS_DAYS +
          ' business day' + (SVC.SLA_BUSINESS_DAYS > 1 ? 's' : '') + '.</b> That promise is in the email they have ' +
          'already received. Mark the row <b>Handled</b> in the sheet when it is done — anything still open after ' +
          'the deadline gets chased automatically.')
      : '') +

    (c.handledBy
      ? box_('warn', '<b>THE CLIENT CHOSE: ' + esc_(String(c.handledBy).toUpperCase()) + '.</b> ' +
          (c.handledBy === 'Matched agent'
            ? 'Verify the answers, assign the agent who fits the brief below, populate the appointment papers with ' +
              'that agent\'s name, and send them for digital signature.'
            : 'Verify the answers and the in-house team takes it from here. The signed appointment is attached.'))
      : '') +
    (c.changeAgent
      ? box_('tip', '<b>' + (c.handledBy === 'Matched agent'
            ? 'Agent appointment — assign from the team, against the brief below. The ' + esc_(SVC.TEAM_SHEET) +
              ' tab has the live roster; use “Appoint matched agent” on the client’s row.'
            : 'Agent appointment — direct to ' + esc_(SVC.AGENT_NAME) + ' and the team.') + '</b> ' +
          ((body.signature || body.signatureTyped)
            ? 'The signed request is attached' +
              (isGroup ? ', drafted for the client\'s letterhead — they have been asked to print, stamp and return it.' : '.')
            : 'No letter is attached yet — it is populated after verification and assignment' +
              (isGroup ? ' for the company\'s letterhead. When it goes out, set <b>Letter outstanding</b> to ' +
                         '<b>YES</b> in the sheet so the every-' + SVC.CLIENT_UPDATE_DAYS + '-day chase starts.'
                       : ', and goes out for digital signature.')) +
          (av.wantInAgent
            ? '<br><br><b>The client\'s brief — what they want in an agent:</b> ' + esc_(String(av.wantInAgent)) +
              (av.wantInAgentWhy ? '<br><i>&ldquo;' + esc_(String(av.wantInAgentWhy)) + '&rdquo;</i>' : '') +
              '<br>Match on this and brief the agent on it before first contact.'
            : ''))
      : '') +

    box_('good', '<b>Support workflow for this file:</b> (1) the client has already been thanked automatically — ' +
      'they know the support team is populating their documents for digital signature; (2) prepare anything that ' +
      'needs a signature and email it ready to sign; (3) set <b>Status</b> to <b>Handled</b> in the sheet the moment ' +
      'it is genuinely closed. Until then the client is sent an automatic &ldquo;still working on it&rdquo; note ' +
      'every ' + SVC.CLIENT_UPDATE_DAYS + ' days, and the morning watchdog chases anything past its promise.') +

    '<h3 style="font-size:15px;color:' + SB.navy + ';margin:24px 0 4px">Every answer</h3>' +
    '<p style="font-size:12.5px;color:#6b7a8d;margin-bottom:4px">Also attached as a PDF for the file.</p>' +
    answerTables_(body) +

    '<p style="color:#8a97a8;font-size:11.5px;border-top:1px solid #e3eaf2;padding-top:12px;margin-top:22px">' +
    'Submitted through ' + esc_(SVC.FORM_URL) + (body.agentMode ? ' (agent-assisted)' : '') +
    (body.minutesTaken ? ' · took the client about ' + esc_(body.minutesTaken) + ' minutes' : '') + '.</p>',
    isGroup ? 'Group plan review' : id.tag, id);

  MailApp.sendEmail({
    to: to.join(','),
    cc: cc.join(','),
    name: SVC.FROM_NAME,
    replyTo: c.email || SVC.AGENT_EMAIL,
    subject: '[' + priority + '] ' + (isGroup ? 'Group ' : '') + id.name + ' — ' +
             (c.companyName || c.clientName || 'client') + ' (' + ref + ')',
    htmlBody: html,
    attachments: attachments,
  });

  return to.concat(cc);
}

/* ============================ email 3 — the match ============================
   The matched path's second half. The client asked US to appoint an agent;
   after support verifies the answers and picks the agent who fits the brief,
   this sends the response that closes the loop: meet your agent, by name,
   with why we chose them — and the Request for Change of Servicing Agent
   attached, populated with THAT agent's name, ready for digital signature
   (letterhead-and-stamp for a company). Run from the sheet menu with the
   client's row selected. */

/** The live roster from the Agent Skill Bank tab — name, number, and what
 *  each agent is strongest at. Rows with Active = No stay off the list. */
function skillBank_() {
  var sh = ss_().getSheetByName(SVC.TEAM_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var col = function (r, h) { var i = head.indexOf(h); return i < 0 ? '' : String(r[i] || '').trim(); };
  return rows.map(function (r) {
    return { name: col(r, 'Agent'), no: col(r, 'Agent no.'),
             skills: col(r, 'Skills & strengths'), avail: col(r, 'Availability'),
             langs: col(r, 'Languages'), active: col(r, 'Active') };
  }).filter(function (a) { return a.name && !/^no$/i.test(a.active); });
}

function sendMatchAssignment() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if ([SVC.IND_SHEET, SVC.GRP_SHEET].indexOf(sh.getName()) < 0) {
    ui.alert('Select the client’s row on "' + SVC.IND_SHEET + '" or "' + SVC.GRP_SHEET + '" first.');
    return;
  }
  var row = sh.getActiveRange().getRow();
  if (row < 2) { ui.alert('Select the client’s row, not the header.'); return; }

  /* The choice is the team's, made per client against the brief — the skill
     bank is laid out to inform it, and any name can still be typed. */
  var bank = skillBank_();
  var listing = bank.length
    ? 'The skill bank:\n' +
      bank.map(function (a, i) {
        return (i + 1) + '. ' + a.name +
               (a.skills ? ' — ' + a.skills : '') +
               (a.avail ? ' · ' + a.avail : '') +
               (a.langs ? ' · ' + a.langs : '');
      }).join('\n') +
      '\n\nEnter a number from the list, or type any agent’s name:'
    : 'The agent’s name exactly as it should print on the letter.\n' +
      '(Tip: keep the roster in the "' + SVC.TEAM_SHEET + '" tab and it will be listed here.)';

  var agent = ui.prompt('Appoint which agent?', listing, ui.ButtonSet.OK_CANCEL);
  if (agent.getSelectedButton() !== ui.Button.OK || !agent.getResponseText().trim()) return;
  var t = agent.getResponseText().trim();

  var picked = null;
  var n = parseInt(t, 10);
  if (bank.length && String(n) === t && n >= 1 && n <= bank.length) picked = bank[n - 1];
  if (!picked) {
    picked = bank.filter(function (a) { return a.name.toLowerCase() === t.toLowerCase(); })[0] || null;
  }

  var why = ui.prompt('Why this agent?',
    'One or two sentences for the client — what made this the right match for their brief:',
    ui.ButtonSet.OK_CANCEL);
  if (why.getSelectedButton() !== ui.Button.OK) return;

  var res = matchAssignmentForRow_(sh, row,
    picked ? picked.name : t, picked ? picked.no : '', why.getResponseText().trim());
  ui.alert(res.ok ? 'Sent — ' + res.msg : 'Not sent — ' + res.msg);
}

function matchAssignmentForRow_(sh, row, agentName, agentNo, why) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var r = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  var v = function (h) { var i = headers.indexOf(h); return i < 0 ? '' : String(r[i] || ''); };

  var ref = v('Reference');
  var email = v('Email').trim();
  if (!ref) return { ok: false, msg: 'that row has no reference' };
  if (!email) return { ok: false, msg: ref + ' has no email address on file' };

  var isGroup = sh.getName() === SVC.GRP_SHEET;
  var id = identity_({ source: v('Source') });
  var first = v('Client').trim().split(/\s+/)[0] || 'there';
  var refInk = id.dhaa ? '#5E141F' : SB.navy;
  var now = new Date();

  /* the letter, populated with the appointed agent's name */
  var body = {
    kind: isGroup ? 'group' : 'individual',
    source: v('Source'),
    assignedAgent: agentName,
    assignedAgentNo: agentNo || '',
    core: { clientName: v('Client'), companyName: v('Company'), phone: v('Phone'),
            policyNos: v('Policy #'), changeAgent: true },
    fields: [
      { id: 'coaOwnerName', label: 'Policy owner', value: v('Client') },
      { id: 'coaPolicies',  label: 'Policies',     value: v('Policy #') },
      { id: 'coaHomePhone', label: 'Home phone',   value: v('Phone') },
      { id: 'agentComments', label: 'Agent comments',
        value: 'Appointed after review — matched to the client’s brief. ' +
               (v('Policy #') ? 'Policy number(s) confirmed by Sales Support.' : 'Policy trace by Sales Support.') },
    ],
  };
  var letter = null;
  try {
    letter = isGroup ? groupAgentLetterPdf_(ref, now, body) : agentLetterPdf_(ref, now, body);
  } catch (e) { log_(ref, 'match-letter-failed', String(e)); }

  var html = wrap_(
    '<p>Dear ' + esc_(first) + ',</p>' +
    '<p><b>You asked us to appoint an agent. After reviewing your answers, we have — ' +
      'meet ' + esc_(agentName) + '.</b></p>' +
    (why ? box_('tip', '<b style="color:#a05e03">Why ' + esc_(agentName) + '.</b><br>' + esc_(why) +
      '<br><span style="font-size:12px">Matched on the brief you wrote — and held to it.</span>') : '') +
    '<p><b>Your appointment papers are attached, already filled in</b> — ' +
      esc_(agentName) + '’s name is on them, and ' +
      (isGroup
        ? 'they are drafted for your company letterhead: <b>print, stamp, sign and send them back</b> — ' +
          'reply to this email with a photo or scan, or hand them to us. Until the letter is in we will ' +
          'write to you every ' + SVC.CLIENT_UPDATE_DAYS + ' days, referencing our previous correspondence, ' +
          'and the reminders stop the moment we receive it.'
        : 'they arrive ready for your <b>digital signature</b> — sign from your phone, and we file the rest. ' +
          'Nothing to print, nothing to fill in twice.') + '</p>' +
    '<p>' + esc_(agentName) + ' has been briefed on your file and will introduce ' +
      (isGroup ? 'themselves to your company' : 'themselves') + ' personally. ' +
      'Guardian Life confirms the change of agent to you in writing once it is processed — ' +
      'your policy, your premium and your cover are not affected in any way.</p>' +
    '<p>Your reference is <b style="color:' + refInk + '">' + esc_(ref) + '</b>.</p>' +
    sig_(),
    'Your agent is appointed', id);

  MailApp.sendEmail({
    to: email,
    name: SVC.FROM_NAME,
    replyTo: SVC.AGENT_EMAIL,
    subject: 'Meet your agent: ' + agentName + ' (' + ref + ')',
    htmlBody: html,
    attachments: letter ? [letter] : [],
  });

  /* the sheet reflects the assignment, and the right chase arms itself */
  var set = function (h, val) {
    var i = headers.indexOf(h);
    if (i > -1) sh.getRange(row, i + 1).setValue(val);
  };
  set('Looked after by', 'Matched: ' + agentName);
  set('Last client update', now);
  if (isGroup) set('Letter outstanding', 'YES — awaiting stamped letter');
  log_(ref, 'match-assigned', agentName + ' · papers sent to ' + email);

  return { ok: true, msg: agentName + ' appointed on ' + ref + ', papers emailed to ' + email };
}

/** If handleSubmission_ throws, the client still saw a failure message — but
 *  their answers must not evaporate. Send ourselves the raw payload. */
function reportFailure_(err, body) {
  try {
    MailApp.sendEmail({
      to: SVC.AGENT_EMAIL,
      name: SVC.FROM_NAME,
      subject: '[FAILED] Service questionnaire submission needs manual entry',
      htmlBody: wrap_(
        box_('warn', '<b>A client submitted the service questionnaire and this script failed to process it.</b> ' +
          'Their answers are below in full — please enter them by hand and call them.') +
        '<p><b>Error:</b> ' + esc_(String(err && err.message ? err.message : err)) + '</p>' +
        '<pre style="font-size:11px;background:#f4f7fa;padding:12px;border:1px solid #e3eaf2;white-space:pre-wrap;' +
        'word-break:break-word">' + esc_(JSON.stringify(body, null, 2).slice(0, 40000)) + '</pre>',
        'Submission error'),
    });
  } catch (e) { /* nothing more we can do from here */ }
}


/* ============================ PDFs ============================ */

/* ── The paper form, line by line ──────────────────────────────────────────
   Form 2000-03-147 has twenty numbered questions in a fixed order, each with
   a YES and a NO box. This table is that form: the wording is transcribed
   from the printed sheet, and `yes` / `no` list the online answers that put a
   tick in each box. Anything else — "Not sure", or a question the paper form
   asked without giving anywhere to write the answer — leaves both boxes empty
   and prints the client's actual words on the dotted line, which is exactly
   what an agent does with a pen.

   `write` names a question whose answer belongs on the line rather than in a
   box. `note` pulls the detail behind a Yes onto the line beside it.        */
var PAPER_Q = [
  { n: 1,  t: 'Are you satisfied with the service provided by Guardian Life?',
    from: 'satisfaction', yes: ['4', '5'], no: ['1', '2'], note: 'satisfaction' },
  { n: 2,  t: 'Do you need any clarification on your policy(ies)?',
    from: 'needClarify', yes: ['Yes'], no: ['No'], note: 'clarifyWhat' },
  { n: 3,  t: 'Are you satisfied with the explanation given?',
    from: 'explainOk', yes: ['Yes'], no: ['No'], note: 'explainWhat' },
  { n: 4,  t: 'Are you satisfied with your existing policy(ies) and the method of premium payments?',
    from: 'premiumOk', yes: ['Yes'], no: ['No'], note: 'premiumNote' },
  { n: 5,  t: 'Have you had any problems that have not been resolved to your satisfaction?',
    from: 'unresolved', yes: ['Yes'], no: ['No'], note: 'unresolvedWhat' },
  { n: 6,  t: 'How often would you like your agent to contact you, every 3 mths, 6 mths, 12 mths?',
    write: 'contactFreq' },
  { gap: true, n: 7,  t: 'Do you or your Spouse own any other Policies with the Company?',
    from: 'otherGuardian', yes: ['Yes'], no: ['No'], note: 'otherGuardianWhat' },
  { n: 8,  t: 'Do you own any other Policies?',
    from: 'otherCompany', yes: ['Yes'], no: ['No'], note: 'otherCompanyWhat' },
  { n: 9,  t: 'Are Name and Address correct?',
    from: 'nameAddrOk', yes: ['Yes'], no: ['No'], note: 'newAddress' },
  { n: 10, t: 'Is Date of Birth correct?',
    from: 'dobOk', yes: ['Yes'], no: ['No'], note: 'correctDob' },
  { n: 11, t: 'Is the Beneficiary Designation correct?',
    from: 'beneficiaryOk', yes: ['Yes'], no: ['No'], note: 'benName' },
  { n: 12, t: 'Does your Beneficiary Know where to locate your Policies?',
    from: 'benKnows', yes: ['Yes'], no: ['No'] },
  { n: 13, t: 'Do you have a Will?  (Explain the importance of a current Will)',
    from: 'hasWill', yes: ["Yes, and it's up to date", "Yes, but it's out of date"],
    no: ['No'], note: 'hasWill' },
  { n: 14, t: 'Do you participate in a Company Group Life or Health Plan?',
    from: 'groupPlan', yes: ['Yes'], no: ['No'], note: 'groupEmployer' },
  { gap: true, n: 15, t: 'Have you made arrangements to replace your Income in the event of accident or disability?',
    from: 'incomeProtection', yes: ['Yes'], no: ['No'] },
  { n: 16, t: 'Do you own your own Home?',
    from: 'homeStatus', yes: ['Own it outright', 'Own it with a mortgage'],
    no: ['Renting', 'Living with family'], note: 'homeStatus' },
  { n: 17, t: 'When last has your financial security programme been reviewed?',
    write: 'lastReview' },
  { gap: true, n: 18, t: 'Have you a Friend or Relative to whom I may be of service?',
    from: 'referral', yes: ['Yes'], no: ['No'], note: 'referralWho' },
  { n: 19, t: 'Have you a Friend or Relative who might be interested in a career in Life Insurance?',
    from: 'career', yes: ['Yes'], no: ['No'], note: 'careerWho' },
  { gap: true, n: 20, t: 'Have you any questions?',
    from: 'questions', filled: true, note: 'questions' }
];

/* The facsimile stylesheet — Times, dot leaders, ruled boxes, the lot. */
function paperCss_() {
  return '@page{size:8.5in 14in;margin:0}' +
    'body{font-family:"Times New Roman",Times,serif;font-size:11pt;color:#000;margin:0;' +
      'padding:.4in .55in .2in;line-height:1.18}' +
    '.ttl{text-align:center;font-size:19pt;letter-spacing:.6px;margin:0}' +
    '.ttl2{text-align:center;font-size:17pt;letter-spacing:.6px;margin:2px 0 0}' +
    'table{border-collapse:collapse;width:100%}' +
    'td{border:none;padding:0;vertical-align:bottom}' +
    '.lbl{white-space:nowrap;padding-right:5px}' +
    '.ldr{width:100%;border-bottom:1px dotted #000;height:1.05em}' +
    '.typed{font-family:"Courier New",monospace;font-size:9.6pt;font-weight:bold;padding:0 3px;white-space:nowrap}' +
    '.typed.fit{white-space:nowrap;font-size:6.2pt;font-weight:bold}' +
    '.cap{font-size:8pt}' +
    '.qs td{padding:3.8px 0}' +
    '.qs tr.gap td{padding-top:9px}' +
    '.qs td.qt{white-space:nowrap;padding-right:5px}' +
    '.qs td.bx{width:.92in;text-align:center;padding-left:.1in}' +
    '.yn{font-size:14pt;text-align:center;padding-bottom:3px}' +
    '.box{display:inline-block;width:.42in;height:.19in;border:1.6px solid #000;' +
      'border-radius:4px;text-align:center;line-height:.17in;font-size:13pt;font-weight:bold}' +
    '.cut{border:none;border-top:0;height:0;margin:14px 0 0;' +
      'background-image:linear-gradient(to right,#000 62%,transparent 0%);' +
      'background-size:7px 1.6px;background-repeat:repeat-x;background-position:0 0;padding-top:1.6px}' +
    'p{margin:0}' +
    '.sigimg{max-height:.34in;vertical-align:bottom;margin-bottom:-3px}' +
    '.dotline{border-bottom:1px dotted #000;height:.9em}' +
    '.code{font-size:12pt}' +
    '.pg{page-break-before:always;height:0}' +
    '.p2h{font-size:12.5pt;font-weight:bold;letter-spacing:.4px;margin:0 0 3px}' +
    '.p2s{font-size:8pt;color:#333;border-bottom:1px solid #000;padding-bottom:5px;margin-bottom:9px;line-height:1.35}' +
    '.p2t{font-size:8.4pt;font-weight:bold;letter-spacing:.7px;text-transform:uppercase;' +
      'margin:9px 0 3px;border-bottom:1px solid #999;padding-bottom:2px}' +
    'table.cd{width:100%;border-collapse:collapse;font-size:7.2pt;line-height:1.22}' +
    'table.cd td{border-bottom:1px solid #ddd;padding:1.3px 4px;vertical-align:top}' +
    'table.cd td.n{width:16px;text-align:right;font-weight:bold;color:#555}' +
    'table.cd td.k{width:42%;color:#333;font-weight:normal}' +
    'table.cd td.v{font-weight:bold}' +
    '.p2f{font-size:7.4pt;color:#333;border-top:1px solid #000;padding-top:5px;margin-top:10px;line-height:1.4}';
}

/* A value typed onto a dotted line, sized to the space the paper leaves. */
function onLine_(v, width) {
  var w = width || 240;
  if (v === undefined || v === null || String(v) === '') {
    return '<span class="dot" style="width:' + w + 'px">&nbsp;</span>';
  }
  return '<span class="fill" style="min-width:' + w + 'px">' + esc_(String(v)) + '</span>';
}

function pdfShell_(title, subtitle, inner) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Georgia,"Times New Roman",serif;font-size:11.5pt;color:#111;margin:34px 40px;line-height:1.5}' +
    'h1{font-size:15pt;text-align:center;letter-spacing:.5px;margin:0 0 2px}' +
    'h2{font-size:12pt;text-align:center;font-weight:normal;margin:0 0 18px;letter-spacing:.5px}' +
    'h3{font-size:9.5pt;text-transform:uppercase;letter-spacing:1px;color:#003366;margin:18px 0 5px;' +
      'border-bottom:1px solid #ccd6e2;padding-bottom:3px}' +
    'table{width:100%;border-collapse:collapse;font-size:10.5pt}' +
    'td{padding:5px 8px;border:1px solid #d8e0e9;vertical-align:top}' +
    'td.k{width:48%;color:#41525f;background:#f6f9fc}' +
    '.meta{font-size:9pt;color:#5a6b80;text-align:center;margin-bottom:16px}' +
    '.rule{border:none;border-top:2px solid #003366;margin:10px 0 16px}' +
    '.foot{font-size:8.5pt;color:#6b7a8d;border-top:1px solid #d8e0e9;padding-top:8px;margin-top:26px}' +
    '.line{border-bottom:1px solid #333;display:inline-block;min-width:230px}' +
    '.sig{max-height:70px}' +
    '</style></head><body>' +
    '<h1>' + esc_(title) + '</h1>' + (subtitle ? '<h2>' + esc_(subtitle) + '</h2>' : '') +
    '<hr class="rule">' + inner + '</body></html>';
}

function toPdf_(html, name) {
  try {
    return Utilities.newBlob(html, 'text/html', name + '.html').getAs('application/pdf').setName(name + '.pdf');
  } catch (err) {
    log_(name, 'pdf-failed', String(err));
    return null;   // the emails still carry every answer in the body
  }
}

/**
 * The completed questionnaire.
 *
 * For an individual this is a facsimile of form 2000-03-147 — the same title,
 * the same twenty questions in the same order and the same words, the same
 * YES/NO boxes, the same change-of-servicing-agent request underneath the
 * dashed rule, down to the form number in the corner. Ticked and typed from
 * what the client answered online, so it can be filed exactly where the paper
 * one was filed, and read by anyone who has read the paper one.
 *
 * Everything the paper form has no room for follows on a second page.
 */
function questionnairePdf_(ref, priority, now, body) {
  /* Only the branch questionnaire is form 2000-03-147. A donthaveanagent.com
     review asks different questions and must not masquerade as that form. */
  if (body.kind !== 'group' && !identity_(body).dhaa) {
    return paperFacsimilePdf_(ref, priority, now, body);
  }
  return null;   /* everything else is covered by answersPdf_ */
}

function paperFacsimilePdf_(ref, priority, now, body) {
  var a = answersById_(body);   /* the printable sentence */
  var r = rawById_(body);       /* the answer itself, for the tick boxes */
  var c = body.core || {};
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var d  = new Date(now);
  var dd = Utilities.formatDate(d, tz, 'd');
  var mm = Utilities.formatDate(d, tz, 'MMMM');
  var yy = Utilities.formatDate(d, tz, 'yyyy');

  /* A dotted leader that fills whatever width is left, with the answer typed
     on it. Blank prints as the bare leader — exactly as the sheet prints. */
  var L = function (v, w, wrap) {
    return '<td class="ldr"' + (w ? ' style="width:' + w + '"' : '') + '>' +
           (v ? '<span class="typed' + (wrap ? ' fit' : '') + '">' + esc_(String(v)) + '</span>'
              : '&nbsp;') + '</td>';
  };
  /* The three little rules of "Dated this ___ day of ___ ___" */
  var dated = function (on) {
    return '<table><tr>' +
      '<td class="lbl">Dated this</td>' + L(on ? dd : '', '13%') +
      '<td class="lbl">&nbsp;day of</td>' + L(on ? mm : '', '20%') + L(on ? yy : '', '12%') +
      '</tr><tr><td></td><td class="cap" style="text-align:center">day</td><td></td>' +
      '<td class="cap" style="text-align:center">month</td>' +
      '<td class="cap" style="text-align:center">year</td></tr></table>';
  };

  var h =
    '<div class="ttl">GUARDIAN LIFE OF THE CARIBBEAN LIMITED</div>' +
    '<div class="ttl2">SERVICE QUESTIONNAIRE</div>' +

    '<table style="margin-top:0.265in"><tr>' +
      '<td class="lbl">LIFE ASSURED</td>' + L(a.lifeAssured || c.clientName, '40%') +
      '<td class="lbl">&nbsp;&nbsp;POLICY NO(S)</td>' + L(a.policyNos || c.policyNos, '32%') +
    '</tr></table>' +

    '<table style="margin-top:0.12in"><tr>' +
      '<td style="width:57%"><table><tr><td class="lbl">PROPOSER</td>' +
        L(a.proposer) + '</tr></table>' +
        '<div class="cap" style="text-align:center">(If different from Life Assured)</div></td>' +
      '<td style="width:4%"></td>' +
      '<td style="vertical-align:top">' + dated(true) + '</td>' +
    '</tr></table>';

  /* the twenty questions ------------------------------------------------ */
  var rows = '<tr><td></td>' +
             '<td class="bx yn">YES</td><td class="bx yn">NO</td></tr>';

  PAPER_Q.forEach(function (q) {
    var yes = '', no = '', typed = '';

    if (q.write) {                                   /* an answer, not a tick */
      typed = a[q.write] || '';
    } else if (q.filled) {                           /* Q20 — any text means yes */
      if (String(a[q.from] || '') !== '') yes = '✓'; else no = '✓';
    } else {
      var v = String(r[q.from] === undefined ? '' : r[q.from]);
      if (indexOf_(q.yes, v) > -1) yes = '✓';
      else if (indexOf_(q.no, v) > -1) no = '✓';
    }

    rows += '<tr' + (q.gap ? ' class="gap"' : '') + '>' +
      '<td><table><tr><td class="qt">' + esc_(q.t) + '</td>' + L(typed) + '</tr></table></td>' +
      '<td class="bx"><span class="box">' + yes + '</span></td>' +
      '<td class="bx"><span class="box">' + no + '</span></td></tr>';
  });

  h += '<table class="qs" style="margin-top:0.165in">' + rows + '</table>' +
       '<div class="cut"></div>';

  /* change of servicing agent — the bottom half of the same sheet -------- */
  var wants = String(a.changeAgent || '').indexOf('Yes') === 0;
  var w = function (v) { return wants ? v : ''; };
  /* support sets assignedAgent when they populate the form for a client who
     asked us to choose; the manager's name is only the direct-path default */
  var coaAgent = String(body.assignedAgent || SVC.AGENT_NAME);

  h +=
    '<p style="margin-top:0.325in">The Manager<br>Customer Service Department<br>' +
    '<b><u>GUARDIAN LIFE OF THE CARIBBEAN LIMITED</u></b></p>' +

    '<p style="margin-top:0.225in">Dear Sir/Madam</p>' +

    '<table style="margin-top:0.185in"><tr>' +
      '<td class="lbl">After completing your Service Questionnaire and reviewing my policy(ies) no(s)</td>' +
      L(w(a.coaPolicies || a.policyNos || c.policyNos)) + '</tr></table>' +

    '<table style="margin-top:0.155in"><tr><td class="lbl">withMr./Mrs./Miss</td>' +
      L(w(coaAgent)) + '</tr></table>' +

    '<p style="margin-top:0.155in">I am requesting that he/she be appointed my Servicing Agent ' +
    'with immediate effect.</p>' +

    '<table style="margin-top:0.165in"><tr>' +
      '<td class="lbl">NAME OF POLICYOWNER IN BLOCK LETTERS</td>' +
      L(w(String(a.coaOwnerName || c.clientName || '').toUpperCase())) + '</tr></table>' +

    '<table style="margin-top:0.185in"><tr>' +
      '<td style="width:57%"><table><tr><td class="lbl">SIGNATURE OF POLICYOWNER</td>' +
        (wants && body.signature
          ? '<td class="ldr"><img class="sigimg" src="' + body.signature + '"></td>'
          : L(w(body.signatureTyped))) + '</tr></table></td>' +
      '<td style="width:4%"></td>' +
      '<td style="vertical-align:top">' + dated(wants) + '</td>' +
    '</tr></table>' +

    '<table style="margin-top:0.215in"><tr>' +
      '<td style="width:52%"><table><tr><td class="lbl">ADDRESS (HOME)</td>' +
        L(a.coaHomeAddress || a.newAddress, '', true) + '</tr></table>' +
        '<div class="cap" style="padding-left:.14in">(and mailing)</div></td>' +
      '<td style="width:3%"></td>' +
      '<td><table><tr><td class="lbl">(WORK)</td>' + L(a.coaWorkAddress, '', true) + '</tr></table></td>' +
    '</tr></table>' +

    '<table style="margin-top:0.125in"><tr>' +
      '<td style="width:52%"><div class="dotline">&nbsp;</div></td>' +
      '<td style="width:3%"></td>' +
      '<td><div class="dotline">&nbsp;</div></td>' +
    '</tr></table>' +

    '<table style="margin-top:0.245in"><tr>' +
      '<td style="width:52%"><table><tr><td class="lbl">TELEPHONE (HOME)</td>' +
        L(a.coaHomePhone || c.phone) + '</tr></table></td>' +
      '<td style="width:3%"></td>' +
      '<td><table><tr><td class="lbl">(WORK)</td>' + L(a.coaWorkPhone) + '</tr></table></td>' +
    '</tr></table>' +

    '<table style="margin-top:0.245in"><tr><td class="lbl">AGENT\'S COMMENTS</td>' +
      L(a.agentComments, '', true) + '</tr></table>' +

    '<table style="margin-top:0.245in"><tr>' +
      '<td style="width:55%"><table><tr><td class="lbl">SERVICING AGENT\'S NAME</td>' +
        L(w(coaAgent.toUpperCase())) + '</tr></table>' +
        '<div class="cap" style="padding-left:.14in">(in block letters)</div></td>' +
      '<td style="width:3%"></td>' +
      '<td><table><tr><td class="lbl">AGENT\'S NO.</td>' + L(SVC.AGENT_NO) + '</tr></table></td>' +
    '</tr></table>' +

    '<table style="margin-top:.3in"><tr>' +
      '<td style="width:42%"><div class="dotline">&nbsp;</div>' +
        '<div style="text-align:center;font-weight:bold">SIGNATURE OF AGENT</div></td>' +
      '<td style="width:8%"></td>' +
      '<td><div class="dotline">&nbsp;</div>' +
        '<div style="text-align:center;font-weight:bold">SIGNATURE OF MANAGER</div></td>' +
    '</tr></table>' +

    '<div class="code" style="margin-top:.14in">2000 - 03 - 147</div>';

  /* ── the addendum ───────────────────────────────────────────────────────
     One legal form. Page 1 is 2000-03-147 untouched; what follows is its
     addendum — every question asked and answered, part of the same document. */
  h += '<div class="pg"></div>' +
    '<div class="p2h">ADDENDUM TO SERVICE QUESTIONNAIRE \u2014 FORM 2000-03-147</div>' +
    '<div class="p2s">All questions asked and answered \u00b7 ' +
      esc_(a.lifeAssured || c.clientName || '') +
      (a.policyNos || c.policyNos ? ' \u00b7 policy ' + esc_(a.policyNos || c.policyNos) : '') +
      ' \u00b7 reference ' + esc_(ref) +
      ' \u00b7 ' + esc_(Utilities.formatDate(d, tz, 'd MMMM yyyy, h:mm a')) +
      '<br>This addendum forms part of the Service Questionnaire above.</div>' +
    addendumTable_(body);

  var con = body.consent || {};
  h += '<div class="p2f">Declared true and correct: <b>' + (con['true'] ? 'Yes' : 'No') +
    '</b> &nbsp;&middot;&nbsp; Consent to service and update records: <b>' + (con.use ? 'Yes' : 'No') +
    '</b> &nbsp;&middot;&nbsp; Marketing consent: <b>' + (con.marketing ? 'Yes' : 'No') + '</b><br>' +
    'Completed online at ' + esc_(SVC.FORM_URL) + '. Changes to policy records are effective only once ' +
    'processed and confirmed in writing by Guardian Life of the Caribbean Limited.</div>';

  return toPdf_('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + paperCss_() +
                '</style></head><body>' + h + '</body></html>',
                'Service Questionnaire ' + ref);
}

/**
 * Everything the client told us, as a separate document.
 *
 * It is separate on purpose. Form 2000-03-147 is reproduced exactly and nothing
 * is added to it, so the detail that sheet has no room for — the reason behind
 * a "No", the new beneficiary, the life changes — lives here instead.
 */
function answersPdf_(ref, priority, now, body) {
  var c = body.core || {};
  var isGroup = body.kind === 'group';
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';

  var h = '<div class="ttl" style="font-size:13pt">' +
      (isGroup ? 'GROUP SERVICE REVIEW' : 'SERVICE REVIEW') + ' \u2014 ANSWERS IN FULL</div>' +
    '<div class="ttl2" style="font-size:10pt">' +
      esc_(c.companyName || c.clientName || '') + ' \u00b7 reference ' + esc_(ref) +
      ' \u00b7 ' + esc_(Utilities.formatDate(new Date(now), tz, 'd MMMM yyyy, h:mm a')) +
      ' \u00b7 ' + esc_(priority) +
      (c.score !== '' && c.score !== undefined
        ? ' \u00b7 ' + (isGroup ? 'Plan Health Score ' : 'Protection Score ') + esc_(c.score) + '/100'
        : '') + '</div>' +
    pdfAnswerTables_(body) +
    consentFoot_(body, ref);

  return toPdf_('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + paperCss_() +
                '</style></head><body>' + h + '</body></html>',
                (isGroup ? 'Group Service Review ' : 'Service Review ') + ref);
}

/** Every question asked and answered, by section — the addendum body. */
function addendumTable_(body) {
  var out = '', section = '';
  (body.fields || []).forEach(function (f) {
    if (f.section !== section) {
      if (section) out += '</table>';
      section = f.section;
      out += '<div class="p2t">' + esc_(section) + '</div><table class="cd">';
    }
    out += '<tr><td class="k">' + esc_(f.label) + '</td><td class="v">' + esc_(f.value) + '</td></tr>';
  });
  if (section) out += '</table>';
  return out;
}

/** Every answer, section by section, in paperCss_ classes — the PDF flavour.
 *  NOT the same as answerTables_ above: that one carries inline styles for
 *  email clients, this one relies on the print stylesheet. Two names, on
 *  purpose — Apps Script is one global scope, and a shared name here once
 *  silently unstyled the team email's answer section. */
function pdfAnswerTables_(body) {
  var out = '', section = '';
  (body.fields || []).forEach(function (f) {
    if (f.section !== section) {
      if (section) out += '</table>';
      section = f.section;
      out += '<h3>' + esc_(section) + '</h3><table class="ans">';
    }
    out += '<tr><td class="k">' + esc_(f.label) + '</td><td class="v">' + esc_(f.value) + '</td></tr>';
  });
  if (section) out += '</table>';
  return out;
}

/** The compliance record: what they declared, and what they agreed to. */
function consentFoot_(body, ref) {
  var con = body.consent || {};
  return '<div class="foot">' +
    'Declared true and correct: <b>' + (con['true'] ? 'Yes' : 'No') + '</b> · ' +
    'Consent to service and update records: <b>' + (con.use ? 'Yes' : 'No') + '</b> · ' +
    'Marketing consent: <b>' + (con.marketing ? 'Yes' : 'No') + '</b><br>' +
    'Completed online at ' + esc_(SVC.FORM_URL) + ' · reference ' + esc_(ref) + '. ' +
    'Changes to policy records are effective only once processed and confirmed in writing by ' +
    'Guardian Life of the Caribbean Limited.</div>';
}

function agentLetterPdf_(ref, now, body) {
  var a = answersById_(body);
  var c = body.core || {};
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var d  = new Date(now);
  var dd = Utilities.formatDate(d, tz, 'd');
  var mm = Utilities.formatDate(d, tz, 'MMMM');
  var yy = Utilities.formatDate(d, tz, 'yyyy');
  var owner = String(a.coaOwnerName || c.clientName || '').toUpperCase();

  /* On the matched path support assigns the agent after verification, and the
     letter must carry THAT agent's name — body.assignedAgent (set by support
     when they populate the papers), falling back to the branch manager for
     the direct path. The agent number only prints when it is actually his. */
  var agentName = String(body.assignedAgent || a.coaTo || SVC.AGENT_NAME);
  var agentNo = body.assignedAgent ? String(body.assignedAgentNo || '') : SVC.AGENT_NO;

  var inner =
    '<div class="ttl">GUARDIAN LIFE OF THE CARIBBEAN LIMITED</div>' +
    '<div class="ttl2">REQUEST FOR CHANGE OF SERVICING AGENT</div>' +

    '<p class="blk">The Manager<br>Customer Service Department<br>' +
    '<b><u>GUARDIAN LIFE OF THE CARIBBEAN LIMITED</u></b></p>' +

    '<p class="blk">Dear Sir/Madam</p>' +

    '<p>After completing your Service Questionnaire and reviewing my policy(ies) no(s) ' +
      onLine_(a.coaPolicies || a.policyNos || c.policyNos || 'all policies held', 230) + '</p>' +
    '<p>with Mr./Mrs./Miss ' + onLine_(agentName, 430) + '</p>' +
    '<p>I am requesting that he/she be appointed my Servicing Agent with immediate effect.</p>' +

    '<p class="blk">NAME OF POLICYOWNER IN BLOCK LETTERS ' + onLine_(owner, 300) + '</p>' +

    '<table class="hdr" style="margin-top:10px"><tr>' +
      '<td style="width:56%">SIGNATURE OF POLICYOWNER ' +
        (body.signature
          ? '<span class="sigrule"><img class="sigimg" src="' + body.signature + '"></span>'
          : (body.signatureTyped
              ? '<span class="fill" style="min-width:180px;font-style:italic">' +
                esc_(body.signatureTyped) + '</span>'
              : onLine_('', 200))) + '</td>' +
      '<td style="text-align:right">Dated this ' + onLine_(dd, 34) + ' day of ' +
        onLine_(mm, 74) + ' ' + onLine_(yy, 42) +
        '<div class="cap" style="text-align:right">' +
        '<span style="display:inline-block;width:96px">day</span>' +
        '<span style="display:inline-block;width:84px">month</span>' +
        '<span style="display:inline-block;width:42px">year</span></div></td>' +
    '</tr></table>' +

    '<table class="hdr" style="margin-top:12px"><tr>' +
      '<td style="width:54%">ADDRESS (HOME) ' + onLine_(a.coaHomeAddress || a.newAddress, 210) +
        '<div class="cap" style="padding-left:14px">(and mailing)</div></td>' +
      '<td>(WORK) ' + onLine_(a.coaWorkAddress, 230) + '</td>' +
    '</tr></table>' +

    '<table class="hdr" style="margin-top:12px"><tr>' +
      '<td style="width:54%">TELEPHONE (HOME) ' + onLine_(a.coaHomePhone || c.phone, 190) + '</td>' +
      '<td>(WORK) ' + onLine_(a.coaWorkPhone, 230) + '</td>' +
    '</tr></table>' +

    '<p class="blk">AGENT\'S COMMENTS ' + onLine_(a.agentComments, 420) + '</p>' +

    '<table class="hdr" style="margin-top:12px"><tr>' +
      '<td style="width:56%">SERVICING AGENT\'S NAME ' + onLine_(agentName.toUpperCase(), 210) +
        '<div class="cap" style="padding-left:14px">(in block letters)</div></td>' +
      '<td>AGENT\'S NO. ' + onLine_(agentNo, 190) + '</td>' +
    '</tr></table>' +

    '<table class="hdr" style="margin-top:44px"><tr>' +
      '<td style="width:46%;text-align:center"><span class="sigline" style="width:100%">&nbsp;</span>' +
        '<div style="font-weight:bold;font-size:9.6pt">SIGNATURE OF AGENT</div></td>' +
      '<td style="width:8%"></td>' +
      '<td style="width:46%;text-align:center"><span class="sigline" style="width:100%">&nbsp;</span>' +
        '<div style="font-weight:bold;font-size:9.6pt">SIGNATURE OF MANAGER</div></td>' +
    '</tr></table>' +

    '<div class="code">2000 - 03 - 147</div>';

  /* paperCss_ is the questionnaire facsimile's stylesheet; this letter keeps
     its own line and fill styles on top — dotted rules for what is written on
     them, answers in bold, real signature lines. Without these the letter
     prints as a wall of plain text. */
  return toPdf_('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + paperCss_() +
                'body{padding:44px 52px;line-height:1.5;font-size:11.5pt}' +
                'p{margin:0 0 4px}.blk{margin-top:15px}' +
                '.ttl{font-size:14pt}.ttl2{font-size:11.5pt;margin-bottom:26px}' +
                '.dot{display:inline-block;border-bottom:1px dotted #000;vertical-align:bottom}' +
                '.fill{display:inline-block;border-bottom:1px dotted #000;vertical-align:bottom;' +
                  'font-family:"Courier New",monospace;font-size:10.2pt;font-weight:bold;padding:0 4px 1px}' +
                '.sigrule{display:inline-block;border-bottom:1px dotted #000;min-width:200px;text-align:center}' +
                '.sigline{display:inline-block;border-bottom:1px solid #000}' +
                'table.hdr td{padding:2px 0}' +
                '</style></head><body>' + inner + '</body></html>',
                'Change of Servicing Agent ' + ref);
}

/**
 * Group change of agent — the EBD letter, filled in and ready for the client
 * to print on their letterhead, stamp and return. Guardian requires the
 * letterhead and the company stamp, so this cannot be fully digital; what it
 * can be is already typed, already correct, and in their inbox in a minute.
 */
function groupAgentLetterPdf_(ref, now, body) {
  var a = answersById_(body);
  var c = body.core || {};
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';

  /* An underscore rule the length the Word document uses, with the answer
     typed on it. Empty falls back to the blank rule, so an unanswered field
     prints exactly as the original does. */
  var rule = function (v, w) {
    if (v === undefined || v === null || String(v) === '') {
      return '<span class="ul" style="width:' + w + 'px">&nbsp;</span>';
    }
    return '<span class="ul typed" style="min-width:' + w + 'px">' + esc_(String(v)) + '</span>';
  };

  var inner =
    '<p class="please">PLEASE PRINT ON COMPANY LETTER HEAD</p>' +

    '<p>Date:' + rule(Utilities.formatDate(new Date(now), tz, 'd MMMM yyyy'), 210) + '</p>' +

    '<p class="gap">The Manager<br>Customer Service Department<br>' +
    'Guardian Life of the Caribbean<br>1 Guardian Drive<br>West Moorings</p>' +

    '<p class="gap">Dear Sir/Madam,</p>' +

    '<p class="gap">RE: Request for Change of Agent \u2013 GROUP LIFE POLICY#' +
      rule(a.coaPolicyNo || a.groupPolicyNo || c.policyNos, 200) + '</p>' +

    '<p class="gap">This letter serves to inform you that I would like to request a change of ' +
      'Agent as follows:</p>' +

    '<table class="ff"><tr><td class="lb">FROM:</td><td>' + rule(a.coaFrom, 380) + '</td></tr>' +
    '<tr><td class="lb">TO:</td><td>' + rule(body.assignedAgent || a.coaTo || SVC.AGENT_NAME, 380) + '</td></tr>' +
    '<tr><td class="lb">EFFECTIVE DATE:</td><td>' + rule(prettyDate_(a.coaEffective), 370) +
      '</td></tr></table>' +

    '<p class="gap">Any courtesy extended in facilitating this request will be highly appreciated.</p>' +
    '<p>Thank you for your kind assistance in this matter.</p>' +

    '<p class="gap">Yours respectfully,</p>' +

    (body.signature
      ? '<p style="margin:6px 0 -18px 14px"><img class="sigimg" src="' + body.signature + '"></p>'
      : (body.signatureTyped
          ? '<p style="margin:20px 0 -6px 14px;font-style:italic;font-family:\'Courier New\',monospace;' +
            'font-size:10.4pt">' + esc_(body.signatureTyped) + '</p>'
          : '<p style="margin:30px 0 0">&nbsp;</p>')) +

    '<p style="margin:0"><span class="ul" style="width:230px">&nbsp;</span></p>' +
    '<p style="margin:1px 0 0">Director\'s Name &amp; Company Stamp</p>' +


    '';

  var css = '@page{size:8.5in 11in;margin:0}' +
    'body{font-family:"Times New Roman",Times,Georgia,serif;font-size:12pt;color:#000;' +
      'margin:0;padding:1in;line-height:1.5}' +
    'p{margin:0 0 4px}' +
    '.gap{margin-top:17px}' +
    '.please{text-align:center;font-weight:bold;letter-spacing:.4px;margin-bottom:26px}' +
    '.ul{display:inline-block;border-bottom:1px solid #000;vertical-align:bottom}' +
    '.typed{font-family:"Courier New",monospace;font-size:10.6pt;padding:0 4px 1px}' +
    '.ff{border-collapse:collapse;margin:2px 0 0}' +
    '.ff td{border:none;padding:3px 0;vertical-align:bottom}' +
    '.ff td.lb{padding-right:26px;white-space:nowrap}' +
    '.sigimg{max-height:52px}' +
    '.typedblk{margin:2px 0 0;font-family:"Courier New",monospace;font-size:9.6pt}' +
'';

  return toPdf_('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css +
                '</style></head><body>' + inner + '</body></html>',
                'Group Change of Agent ' + ref);
}

/**
 * The group's one legal form: page 1 is the Request for Change of Agent
 * exactly as the EBD document prints (nothing written on it beyond the
 * request's own fields), and the pages after it are the addendum — every
 * question asked and answered, part of the same document. A group that
 * declined the change of agent gets the addendum under its own heading.
 */
function groupOnePdf_(ref, priority, now, body) {
  var a = answersById_(body);
  var c = body.core || {};
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var wants = !!c.changeAgent;

  var rule = function (v, w) {
    if (v === undefined || v === null || String(v) === '') {
      return '<span class="ul" style="width:' + w + 'px">&nbsp;</span>';
    }
    return '<span class="ul typed" style="min-width:' + w + 'px">' + esc_(String(v)) + '</span>';
  };

  var inner = '';
  if (wants) {
    inner +=
      '<p class="please">PLEASE PRINT ON COMPANY LETTER HEAD</p>' +
      '<p>Date:' + rule(Utilities.formatDate(new Date(now), tz, 'd MMMM yyyy'), 210) + '</p>' +
      '<p class="gap">The Manager<br>Customer Service Department<br>' +
      'Guardian Life of the Caribbean<br>1 Guardian Drive<br>West Moorings</p>' +
      '<p class="gap">Dear Sir/Madam,</p>' +
      '<p class="gap">RE: Request for Change of Agent \u2013 GROUP LIFE POLICY#' +
        rule(a.coaPolicyNo || a.groupPolicyNo || c.policyNos, 200) + '</p>' +
      '<p class="gap">This letter serves to inform you that I would like to request a change of ' +
        'Agent as follows:</p>' +
      '<table class="ff"><tr><td class="lb">FROM:</td><td>' + rule(a.coaFrom, 380) + '</td></tr>' +
      '<tr><td class="lb">TO:</td><td>' + rule(body.assignedAgent || a.coaTo || SVC.AGENT_NAME, 380) + '</td></tr>' +
      '<tr><td class="lb">EFFECTIVE DATE:</td><td>' + rule(prettyDate_(a.coaEffective), 370) +
        '</td></tr></table>' +
      '<p class="gap">Any courtesy extended in facilitating this request will be highly appreciated.</p>' +
      '<p>Thank you for your kind assistance in this matter.</p>' +
      '<p class="gap">Yours respectfully,</p>' +
      (body.signature
        ? '<p style="margin:6px 0 -18px 14px"><img class="sigimg" src="' + body.signature + '"></p>'
        : (body.signatureTyped
            ? '<p style="margin:20px 0 -6px 14px;font-style:italic;font-family:\'Courier New\',monospace;' +
              'font-size:10.4pt">' + esc_(body.signatureTyped) + '</p>'
            : '<p style="margin:30px 0 0">&nbsp;</p>')) +
      '<p style="margin:0"><span class="ul" style="width:230px">&nbsp;</span></p>' +
      '<p style="margin:1px 0 0">Director\'s Name &amp; Company Stamp</p>';
  } else {
    inner += '<p style="text-align:center;font-size:15pt;font-weight:bold;letter-spacing:.4px">GROUP SERVICE REVIEW</p>' +
      '<p style="text-align:center;font-size:10pt">' + esc_(c.companyName || '') +
      (c.policyNos ? ' \u00b7 policy ' + esc_(c.policyNos) : '') + '</p>';
  }

  inner += '<div style="page-break-before:always"></div>' +
    '<div class="adh">' + (wants ? 'ADDENDUM TO REQUEST FOR CHANGE OF AGENT' : 'ALL QUESTIONS ASKED AND ANSWERED') + '</div>' +
    '<div class="ads">All questions asked and answered \u00b7 ' + esc_(c.companyName || '') +
      ' \u00b7 reference ' + esc_(ref) + ' \u00b7 ' +
      esc_(Utilities.formatDate(new Date(now), tz, 'd MMMM yyyy, h:mm a')) +
      '<br>This addendum forms part of the request above.</div>' +
    addendumTable_(body) +
    consentFoot_(body, ref);

  var css = 'body{font-family:"Times New Roman",Times,Georgia,serif;font-size:12pt;color:#000;' +
      'margin:0;padding:1in;line-height:1.5}' +
    '@page{size:8.5in 14in;margin:0}' +
    'p{margin:0 0 4px}' +
    '.gap{margin-top:17px}' +
    '.please{text-align:center;font-weight:bold;letter-spacing:.4px;margin-bottom:26px}' +
    '.ul{display:inline-block;border-bottom:1px solid #000;vertical-align:bottom}' +
    '.typed{font-family:"Courier New",monospace;font-size:10.6pt;font-weight:bold;padding:0 4px 1px}' +
    '.ff{border-collapse:collapse;margin:2px 0 0;width:100%}' +
    '.ff td{border:none;padding:3px 0;vertical-align:bottom}' +
    '.ff td.lb{padding-right:26px;white-space:nowrap;width:1%}' +
    '.sigimg{max-height:52px}' +
    '.adh{font-size:12.5pt;font-weight:bold;letter-spacing:.4px;margin:0 0 3px}' +
    '.ads{font-size:8.5pt;color:#333;border-bottom:1px solid #000;padding-bottom:5px;margin-bottom:9px;line-height:1.4}' +
    '.p2t{font-size:8.6pt;font-weight:bold;letter-spacing:.7px;text-transform:uppercase;' +
      'margin:10px 0 3px;border-bottom:1px solid #999;padding-bottom:2px;font-family:Arial,sans-serif}' +
    'table.cd{width:100%;border-collapse:collapse;font-size:8.6pt;line-height:1.3;font-family:Arial,sans-serif}' +
    'table.cd td{border-bottom:1px solid #ddd;padding:2.2px 5px;vertical-align:top}' +
    'table.cd td.k{width:44%;color:#333}' +
    'table.cd td.v{font-weight:bold}' +
    '.foot,.p2f{font-size:7.6pt;color:#333;border-top:1px solid #000;padding-top:5px;margin-top:10px;line-height:1.4;font-family:Arial,sans-serif}';

  return toPdf_('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css +
                '</style></head><body>' + inner + '</body></html>',
                'Group Service Questionnaire ' + ref);
}

/** { questionId: raw answer } — the answer itself, not the sentence the review
 *  screen prints. "4" rather than "4 of 5", so a tick box can be decided. */
function rawById_(body) {
  var out = {};
  (body.fields || []).forEach(function (f) {
    if (!f.id) return;
    out[f.id] = (f.raw === undefined || f.raw === null || f.raw === '') ? f.value : f.raw;
  });
  return out;
}

/** Array indexOf that tolerates a missing list. */
function indexOf_(arr, v) {
  if (!arr || !arr.length) return -1;
  for (var i = 0; i < arr.length; i++) if (String(arr[i]) === String(v)) return i;
  return -1;
}

/** { questionId: value } — handy for the specific answers the emails key off. */
function answersById_(body) {
  var out = {};
  (body.fields || []).forEach(function (f) { if (f.id) out[f.id] = f.value; });
  return out;
}


/* ============================ follow-up watchdog ============================
   A promise made on screen is worth nothing if nobody keeps it. This runs
   each morning, finds anything still Open past its deadline, and chases it.
   Install it with installServiceTriggers().                                */

function dailyServiceFollowUp() {
  clientPatiencePass_();
  [SVC.IND_SHEET, SVC.GRP_SHEET].forEach(function (name) {
    var sh = ss_().getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;

    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var iRef = headers.indexOf('Reference'), iTs = headers.indexOf('Timestamp');
    var iPri = headers.indexOf('Priority'), iSt = headers.indexOf('Status');
    var iCl = headers.indexOf('Client'), iCo = headers.indexOf('Company');
    var iEm = headers.indexOf('Email'), iPh = headers.indexOf('Phone');
    if (iRef < 0 || iSt < 0) return;

    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    var overdue = [];

    rows.forEach(function (r) {
      var status = String(r[iSt] || '').toLowerCase();
      if (status !== 'open') return;
      var pri = String(r[iPri] || '');
      if (pri !== 'URGENT' && pri !== 'HIGH' && pri !== 'ACTION') return;
      var days = businessDaysSince_(r[iTs]);
      var allowed = (pri === 'ACTION') ? 5 : SVC.SLA_BUSINESS_DAYS;
      if (days > allowed) {
        overdue.push({
          ref: r[iRef], pri: pri, days: days, allowed: allowed,
          who: r[iCo] || r[iCl] || '', email: r[iEm] || '', phone: r[iPh] || '',
        });
      }
    });

    if (!overdue.length) return;

    overdue.sort(function (x, y) { return y.days - x.days; });

    MailApp.sendEmail({
      to: [SVC.AGENT_EMAIL].concat(SVC.ESCALATION_CC.length ? SVC.ESCALATION_CC : SVC.CC).filter(String).join(','),
      name: SVC.FROM_NAME,
      subject: 'OVERDUE — ' + overdue.length + ' service questionnaire' + (overdue.length > 1 ? 's are' : ' is') +
               ' past the promise we made',
      htmlBody: wrap_(
        box_('warn', '<b>These clients were told they would hear from a person.</b> They have not been marked ' +
          'handled. Set <b>Status</b> to <b>Handled</b> in the sheet once each one is genuinely closed.') +
        '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13.5px">' +
        '<tr><td style="padding:8px 10px;background:#f4f7fa;border:1px solid #e3eaf2"><b>Reference</b></td>' +
        '<td style="padding:8px 10px;background:#f4f7fa;border:1px solid #e3eaf2"><b>Who</b></td>' +
        '<td style="padding:8px 10px;background:#f4f7fa;border:1px solid #e3eaf2"><b>Waiting</b></td>' +
        '<td style="padding:8px 10px;background:#f4f7fa;border:1px solid #e3eaf2"><b>Reach them</b></td></tr>' +
        overdue.map(function (o) {
          return '<tr><td style="padding:8px 10px;border:1px solid #e3eaf2"><b>' + esc_(o.ref) + '</b><br>' +
            '<span style="color:' + priorityColor_(o.pri) + ';font-size:11.5px;font-weight:bold">' + esc_(o.pri) + '</span></td>' +
            '<td style="padding:8px 10px;border:1px solid #e3eaf2">' + esc_(o.who) + '</td>' +
            '<td style="padding:8px 10px;border:1px solid #e3eaf2">' + o.days + ' business days<br>' +
            '<span style="font-size:11.5px;color:#b3261e">promised in ' + o.allowed + '</span></td>' +
            '<td style="padding:8px 10px;border:1px solid #e3eaf2;font-size:12.5px">' +
            esc_(o.phone) + '<br>' + esc_(o.email) + '</td></tr>';
        }).join('') + '</table>' +
        '<p style="font-size:13px;margin-top:16px">A late call still beats no call. Ring the oldest one first.</p>',
        'Overdue follow-ups'),
    });

    log_('watchdog', 'overdue-chased', overdue.length + ' in ' + name);
  });
}

/**
 * The promise on the form is "you will never be left wondering": while a
 * request is still open, the client hears from us every CLIENT_UPDATE_DAYS
 * days — thanks for the patience, we are working on it — automatically,
 * until somebody sets the row's Status to Handled.
 *
 * Runs inside the same daily trigger as the team watchdog. Each note it
 * sends is stamped in the 'Last client update' column, so the cadence is
 * measured from the last thing the client actually received, not guessed.
 * Rows older than 30 days stop getting the automatic note — at that point a
 * robo-update is worse than silence, and the team chase is still firing
 * every morning.
 */
function clientPatiencePass_() {
  [SVC.IND_SHEET, SVC.GRP_SHEET].forEach(function (name) {
    var sh = ss_().getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;

    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var iRef = headers.indexOf('Reference'), iTs = headers.indexOf('Timestamp');
    var iSt = headers.indexOf('Status'), iCl = headers.indexOf('Client');
    var iEm = headers.indexOf('Email'), iSrc = headers.indexOf('Source');
    if (iRef < 0 || iSt < 0 || iEm < 0) return;

    /* Sheets created before this column existed get it appended by name. */
    var iUp = headers.indexOf('Last client update');
    if (iUp < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue('Last client update')
        .setFontWeight('bold').setBackground(SB.light);
      headers.push('Last client update');
      iUp = headers.length - 1;
    }

    var iLo = headers.indexOf('Letter outstanding');
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    var sent = 0;
    var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';

    rows.forEach(function (r, idx) {
      if (String(r[iSt] || '').toLowerCase() !== 'open') return;
      var email = String(r[iEm] || '').trim();
      if (!email) return;

      var filed = new Date(r[iTs]);
      if (isNaN(filed.getTime())) return;
      if (daysSince_(filed) > 30) return;

      var last = r[iUp] ? new Date(r[iUp]) : filed;
      if (isNaN(last.getTime())) last = filed;
      if (daysSince_(last) < SVC.CLIENT_UPDATE_DAYS) return;

      var ref = String(r[iRef] || '');
      var first = String(r[iCl] || '').trim().split(/\s+/)[0] || 'there';
      var prevDate = Utilities.formatDate(last, tz, 'd MMMM yyyy');

      /* Brand the note after the product the client actually used — a
         donthaveanagent.com client gets the oxblood header, not "Service
         Questionnaire" from a product they have never heard of. */
      var rowId = identity_(iSrc > -1 ? { source: r[iSrc] } : null);
      var refInk = rowId.dhaa ? '#5E141F' : SB.navy;

      /* Two different notes. A company that owes us the stamped letter is
         chased for the letter, referencing the previous correspondence, until
         support records it received. Everyone else gets the patience note. */
      var chasingLetter = iLo > -1 && String(r[iLo] || '').indexOf('YES') === 0;

      var subject, html;
      if (chasingLetter) {
        subject = 'Awaiting your stamped letter — further to our correspondence (' + ref + ')';
        html = wrap_(
          '<p>Dear ' + esc_(first) + ',</p>' +
          '<p><b>Further to our email of ' + esc_(prevDate) + '</b> regarding your group change of agent ' +
          '(reference <b style="color:' + refInk + '">' + esc_(ref) + '</b>), we have not yet received the ' +
          'signed letter, and we don\u2019t want it to slip through.</p>' +
          '<p>Three steps and it\u2019s done:</p>' +
          '<ol style="padding-left:20px;line-height:1.8;font-size:13.8px">' +
          '<li><b>Print</b> the letter we sent you on your company letterhead.</li>' +
          '<li><b>Stamp and sign it</b> — the insurer requires the company stamp beside the signature.</li>' +
          '<li><b>Send it back</b> — reply to this email with a photo or scan, or hand it to us.</li></ol>' +
          '<p>We\u2019ll keep this gentle reminder coming every ' + SVC.CLIENT_UPDATE_DAYS + ' days until it\u2019s ' +
          'in, referencing our previous correspondence each time — it stops the moment we receive it. ' +
          'Lost the letter? Reply and we resend it the same day.</p>' + sig_(),
          'Awaiting your letter', rowId);
      } else {
        subject = 'Still on it — your request ' + ref;
        html = wrap_(
          '<p>Dear ' + esc_(first) + ',</p>' +
          '<p><b>Further to our email of ' + esc_(prevDate) + ' — thank you for your patience. Your request is ' +
          'being worked on right now.</b> Our support team has it, and nothing is stuck: this note is simply the ' +
          'promise we made that you would never be left wondering.</p>' +
          '<p>Your reference is <b style="color:' + refInk + '">' + esc_(ref) + '</b>. ' +
          'The moment it is complete you will hear from us properly.</p>' +
          '<p>If anything has changed on your side in the meantime, just reply to this email or call ' +
          esc_(SVC.AGENT_PHONE) + ' and quote the reference.</p>' +
          sig_(),
          'Working on it', rowId);
      }

      try {
        MailApp.sendEmail({ to: email, name: SVC.FROM_NAME, replyTo: SVC.AGENT_EMAIL, subject: subject, htmlBody: html });
        sh.getRange(idx + 2, iUp + 1).setValue(new Date());
        log_(ref, chasingLetter ? 'letter-chased' : 'client-updated',
             'automatic ' + SVC.CLIENT_UPDATE_DAYS + '-day note to ' + email);
        sent++;
      } catch (err) {
        log_(ref, 'client-update-failed', String(err));
      }
    });

    if (sent) log_('watchdog', 'patience-pass', sent + ' client update' + (sent > 1 ? 's' : '') + ' in ' + name);
  });
}

/** Whole calendar days between then and now. */
function daysSince_(when) {
  var d = (when instanceof Date) ? when : new Date(when);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/** Whole business days between then and now — weekends don't count. */
function businessDaysSince_(when) {
  var d = (when instanceof Date) ? new Date(when.getTime()) : new Date(when);
  if (isNaN(d.getTime())) return 0;
  var now = new Date(), n = 0;
  d.setHours(0, 0, 0, 0);
  var cur = new Date(d.getTime());
  cur.setDate(cur.getDate() + 1);
  while (cur <= now) {
    var wd = cur.getDay();
    if (wd !== 0 && wd !== 6) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}


/* ============================ setup & menu ============================ */

function setupService() {
  sheetFor_(false);
  sheetFor_(true);
  logSheet_();
  teamBankSheet_();

  var warn = SVC.CS_EMAIL ? '' :
    '<p style="color:#b3261e"><b>SVC.CS_EMAIL is still empty.</b> Submissions will route to the branch only ' +
    'until you set Guardian Life\'s Customer Service address and redeploy. That is deliberate — better than ' +
    'mailing a carrier inbox by accident.</p>';

  MailApp.sendEmail({
    to: SVC.AGENT_EMAIL, name: SVC.FROM_NAME,
    subject: 'Service Questionnaire backend is ready',
    htmlBody: wrap_(
      '<p>Tabs created and permissions granted. Two things left:</p>' +
      '<ol style="line-height:1.8">' +
      '<li><b>Deploy → New deployment → Web app</b> (Execute as: <b>Me</b>, Access: <b>Anyone</b>) and copy the /exec URL.</li>' +
      '<li>Paste it into <code>CONFIG.API_URL</code> in <code>service/index.html</code>, then commit.</li>' +
      '</ol>' + warn +
      '<p>Until that URL is in place the form still works — it falls back to a pre-filled email, so no client is ' +
      'ever turned away.</p>' + sig_(), 'Setup'),
  });

  SpreadsheetApp.getUi().alert('Tabs are ready and a confirmation email is on its way.\n\n' +
    'Next: Deploy → New deployment → Web app, then paste the /exec URL into CONFIG.API_URL in service/index.html.');
}

function installServiceTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyServiceFollowUp') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyServiceFollowUp').timeBased().atHour(8).everyDays(1).create();
  SpreadsheetApp.getUi().alert('The follow-up watchdog will run each morning around 8am.');
}

/** Fires a realistic submission through the whole pipeline so you can see
 *  exactly what a client and Customer Service each receive. */
function sendTestSubmission() {
  var demo = {
    action: 'service', kind: 'individual',
    submittedAt: new Date().toISOString(), minutesTaken: 4,
    core: {
      clientName: 'Test Client', companyName: '', email: SVC.AGENT_EMAIL, phone: '868 000 0000',
      policyNos: 'TEST-0001', prefContact: 'WhatsApp', satisfaction: 2, nps: 5,
      unresolved: true, unresolvedUrgency: 'Urgent — I need help today',
      contactFreq: 'Every 6 months', changeAgent: true, score: 38,
      scoreGaps: ['Income protected', 'Will', 'Critical illness'], consentMarketing: true,
    },
    fields: [
      { section: 'About you', id: 'lifeAssured', label: 'Your full name (Life Assured)', value: 'Test Client' },
      { section: 'How we\'re doing', id: 'satisfaction', label: 'Overall satisfaction', value: '2 of 5' },
      { section: 'How we\'re doing', id: 'unresolvedWhat', label: 'Tell us what happened',
        value: 'This is a test submission — no action needed.', flag: 'urgent' },
      { section: 'Your records', id: 'beneficiaryOk', label: 'Is your beneficiary designation still correct?',
        value: 'No', flag: 'records' },
      { section: 'Servicing agent', id: 'coaOwnerName', label: 'Name of policy owner IN BLOCK LETTERS',
        value: 'TEST CLIENT', flag: 'agent' },
      { section: 'Servicing agent', id: 'coaHomeAddress', label: 'Home address (and mailing)', value: '1 Test Street' },
    ],
    signature: '', signatureTyped: 'Test Client',
    consent: { 'true': true, use: true, marketing: true },
  };
  var res = handleSubmission_(demo);
  SpreadsheetApp.getUi().alert('Test submission sent as ' + res.ref + ' (' + res.priority + ').\n\n' +
    'Check ' + SVC.AGENT_EMAIL + ' — you should have both the client thank-you and the Customer Service routing email.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Service Questionnaire')
    .addItem('First-time setup', 'setupService')
    .addItem('Send a test submission', 'sendTestSubmission')
    .addSeparator()
    .addItem('Appoint matched agent (selected row)', 'sendMatchAssignment')
    .addSeparator()
    .addItem('Install daily follow-up watchdog', 'installServiceTriggers')
    .addItem('Run follow-up check now', 'dailyServiceFollowUp')
    .addToUi();
}
