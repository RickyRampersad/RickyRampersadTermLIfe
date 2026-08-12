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
  /* Anyone who lands on the /exec URL directly gets pointed at the form. */
  return HtmlService.createHtmlOutput(
    '<meta http-equiv="refresh" content="0;url=' + SVC.FORM_URL + '">' +
    '<p style="font:15px sans-serif">Taking you to the service questionnaire… ' +
    '<a href="' + SVC.FORM_URL + '">continue</a>.</p>');
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
  var now = new Date();

  /* 1 — file it */
  saveRow_(isGroup, ref, priority, now, body);

  /* 2 — build the paperwork once, attach it to both emails */
  var attachments = [];
  var formPdf = questionnairePdf_(ref, priority, now, body);
  if (formPdf) attachments.push(formPdf);
  /* The branch questionnaire carries its own notes page. Everything else —
     group plans and donthaveanagent.com — has no printed form, so the answers
     document is the document. */
  if (body.kind === 'group' || identity_(body).dhaa) {
    var answersDoc = answersPdf_(ref, priority, now, body);
    if (answersDoc) attachments.push(answersDoc);
  }

  var letterPdf = null;
  if (core.changeAgent) {
    letterPdf = isGroup ? groupAgentLetterPdf_(ref, now, body) : agentLetterPdf_(ref, now, body);
    if (letterPdf) attachments.push(letterPdf);
  }

  /* 3 — the client hears from us immediately */
  var clientEmailed = false;
  if (core.email) {
    try {
      sendClientThanks_(ref, priority, body, formPdf, letterPdf);
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
    clientEmailed: clientEmailed,
    slaDays: SVC.SLA_BUSINESS_DAYS,
  };
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

/**
 * One row per submission, one column per question — and if the form grows a
 * new question tomorrow, the column appears on its own. That is the whole
 * reason the front end sends labels along with answers: nobody has to keep
 * two lists of questions in step by hand.
 */
function saveRow_(isGroup, ref, priority, now, body) {
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
  /* donthaveanagent.com has its own colours — a client who used that product
     should recognise the email as coming from it. */
  var bg = id.dhaa ? '#0A1017' : SB.navy;
  var chip = id.dhaa ? '#22C482' : SB.gold;
  var chipInk = id.dhaa ? '#06120C' : SB.navy;
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:' + SB.ink + ';max-width:660px">' +
    '<div style="background:' + bg + ';color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td width="46" valign="middle"><table cellpadding="0" cellspacing="0"><tr>' +
        '<td style="width:38px;height:38px;background:' + chip + ';border-radius:8px 8px 14px 14px;' +
        'text-align:center;font-size:22px;font-weight:bold;color:' + chipInk + '">✓</td></tr></table></td>' +
      '<td valign="middle" style="padding-left:10px"><b style="font-size:18px">' + esc_(id.name) + '</b><br>' +
        '<span style="color:#b7c9de;font-size:12px">' + esc_(tag || id.tag) +
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

function sendClientThanks_(ref, priority, body, formPdf, letterPdf) {
  var c = body.core || {};
  var a = answersById_(body);
  var isGroup = body.kind === 'group';
  var first = String(c.clientName || '').trim().split(/\s+/)[0] || 'there';

  var next = [];

  if (c.unresolved) {
    next.push('<b>The problem you told us about is already flagged.</b> It has gone straight to a service ' +
      'manager marked <b>' + esc_(c.unresolvedUrgency || 'for follow-up') + '</b>, and you will hear from a person — ' +
      'not an automatic reply — within ' + SVC.SLA_BUSINESS_DAYS + ' business day' +
      (SVC.SLA_BUSINESS_DAYS > 1 ? 's' : '') + '. If you would rather not wait, call ' +
      esc_(SVC.AGENT_PHONE) + ' and quote ' + esc_(ref) + '.');
  }

  if (c.changeAgent) {
    next.push(isGroup
      ? '<b>Your change of agent request is attached as a letter.</b> Guardian needs it on your company ' +
        'letterhead with your stamp — print the attachment on your letterhead, stamp and sign it, and send it back ' +
        'to us. We have already started the request at Customer Service so nothing waits on the post.'
      : '<b>Your change of servicing agent request has gone to Customer Service</b>, signed and attached here for ' +
        'your records. It usually takes 5 to 10 working days and Guardian confirms the change to you in writing. ' +
        'Your policy, your premium and your cover are not affected in any way.');
  }

  var recs = [];
  if (a.nameAddrOk === 'No') recs.push('your name and address');
  if (a.dobOk === 'No') recs.push('your date of birth');
  if (a.beneficiaryOk && a.beneficiaryOk !== 'Yes') recs.push('your beneficiary designation');
  if (a.premiumOk === 'No') recs.push('how you pay your premium');
  if (a.paperless === 'Yes') recs.push('switching you to e-documents');
  if (a.listingCurrent && a.listingCurrent !== 'Yes') recs.push('reconciling your member listing');
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
    scoreBlock +
    '<h3 style="font-size:15px;color:' + SB.navy + ';margin:22px 0 6px">What happens next</h3>' +
    '<ol style="padding-left:20px;margin:0;font-size:13.8px;line-height:1.65">' +
      next.map(function (n) { return '<li style="margin-bottom:9px">' + n + '</li>'; }).join('') +
    '</ol>' +
    box_('good', 'Nothing on this list needs you to do anything. If a form needs signing, it comes to you. ' +
      'If a person needs to call you, they call you.') +
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
  cc = cc.filter(function (x, i, arr) { return x && to.indexOf(x) < 0 && arr.indexOf(x) === i; });

  var notConfigured = SVC.CS_EMAIL ? '' : box_('warn',
    '<b>Customer Service routing is not switched on yet.</b> This submission went only to the branch. ' +
    'Set <code>SVC.CS_EMAIL</code> in Service.gs and redeploy to route these to Guardian Life Customer Service.');

  var actions = [];
  if (c.needsTracing) {
    actions.push('🔍 <b>Trace the policy first.</b> They do not have the number' +
      (c.insurer ? ' — they think it is with <b>' + esc_(c.insurer) + '</b>' : '') +
      '. Search on name and date of birth' +
      (c.clientName ? ': <b>' + esc_(c.clientName) + '</b>' : '') + '.');
  }
  if (body.origin === 'client') {
    actions.push('🤝 <b>No product questions were asked</b> — they came to us unprompted. ' +
      'Answer exactly what they asked for and nothing more; a sales approach here loses them for good.');
  }
  (body.fields || []).forEach(function (f) {
    if (f.flag === 'urgent')  actions.push('🔴 <b>' + esc_(f.label) + '</b> — ' + esc_(f.value));
    if (f.flag === 'records') actions.push('📝 <b>Record change:</b> ' + esc_(f.label) + ' — ' + esc_(f.value));
    if (f.flag === 'agent')   actions.push('🔁 <b>Change of agent:</b> ' + esc_(f.label) + ' — ' + esc_(f.value));
    if (f.flag === 'lead')    actions.push('⭐ <b>Follow-up:</b> ' + esc_(f.label) + ' — ' + esc_(f.value));
    if (f.flag === 'service') actions.push('💬 <b>Needs a reply:</b> ' + esc_(f.label) + ' — ' + esc_(f.value));
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

    (c.changeAgent
      ? box_('tip', '<b>Change of servicing agent requested.</b> The signed request is attached' +
          (isGroup ? ', drafted for the client\'s letterhead — they have been asked to print, stamp and return it.' : '.'))
      : '') +

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
    '.typed{font-family:"Courier New",monospace;font-size:9.6pt;padding:0 3px;white-space:nowrap}' +
    '.typed.fit{white-space:nowrap;font-size:6.6pt}' +
    '.cap{font-size:8pt}' +
    '.qs td{padding:4.2px 0}' +
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
    'table.cd{width:100%;border-collapse:collapse;font-size:7.6pt;line-height:1.25}' +
    'table.cd td{border-bottom:1px solid #ddd;padding:1.6px 4px;vertical-align:top}' +
    'table.cd td.n{width:16px;text-align:right;font-weight:bold;color:#555}' +
    'table.cd td.k{width:42%;color:#333}' +
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

  h +=
    '<p style="margin-top:0.325in">The Manager<br>Customer Service Department<br>' +
    '<b><u>GUARDIAN LIFE OF THE CARIBBEAN LIMITED</u></b></p>' +

    '<p style="margin-top:0.225in">Dear Sir/Madam</p>' +

    '<table style="margin-top:0.185in"><tr>' +
      '<td class="lbl">After completing your Service Questionnaire and reviewing my policy(ies) no(s)</td>' +
      L(w(a.coaPolicies || a.policyNos || c.policyNos)) + '</tr></table>' +

    '<table style="margin-top:0.155in"><tr><td class="lbl">withMr./Mrs./Miss</td>' +
      L(w(SVC.AGENT_NAME)) + '</tr></table>' +

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
        L(w(SVC.AGENT_NAME.toUpperCase())) + '</tr></table>' +
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

  /* ── page 2 ─────────────────────────────────────────────────────────────
     The form on page 1 is not written on. The detail behind the answers goes
     here instead: first the notes against the numbered questions they belong
     to, then everything else, set condensed in two columns.                */
  var notes = [];
  PAPER_Q.forEach(function (q) {
    var v = q.write ? a[q.write] : (q.note ? a[q.note] : '');
    if (v && String(v) !== '') notes.push({ n: q.n, t: q.t, v: String(v) });
  });

  var covered = {};
  PAPER_Q.forEach(function (q) {
    if (q.from) covered[q.from] = 1;
    if (q.note) covered[q.note] = 1;
    if (q.write) covered[q.write] = 1;
  });

  var rest = [];
  (body.fields || []).forEach(function (f) {
    if (!f.id || covered[f.id]) return;
    if (f.id.indexOf('coa') === 0 || f.id === 'agentComments') return;   /* on page 1 */
    rest.push(f);
  });

  var half = Math.ceil(rest.length / 2);
  var col = function (list) {
    return list.map(function (f) {
      return '<tr><td class="k">' + esc_(f.label) + '</td><td>' + esc_(f.value) + '</td></tr>';
    }).join('');
  };

  h += '<div class="pg"></div>' +
    '<div class="p2h">SERVICE QUESTIONNAIRE &mdash; NOTES ON THE ANSWERS</div>' +
    '<div class="p2s">' + esc_(a.lifeAssured || c.clientName || '') +
      ' &nbsp;&middot;&nbsp; policy ' + esc_(a.policyNos || c.policyNos || '') +
      ' &nbsp;&middot;&nbsp; ' + esc_(ref) +
      ' &nbsp;&middot;&nbsp; ' + esc_(Utilities.formatDate(d, tz, 'd MMMM yyyy, h:mm a')) +
      ' &nbsp;&middot;&nbsp; ' + esc_(priority) +
      (c.score !== '' && c.score !== undefined
        ? ' &nbsp;&middot;&nbsp; Protection Score ' + esc_(c.score) + '/100' : '') +
      '<br>Page 1 is form 2000-03-147 exactly as printed. Nothing below has been written onto it.' +
    '</div>';

  if (notes.length) {
    h += '<div class="p2t">Against the numbered questions</div><table class="cd">' +
      notes.map(function (x) {
        return '<tr><td class="n">' + x.n + '</td><td class="k">' + esc_(x.t) +
               '</td><td>' + esc_(x.v) + '</td></tr>';
      }).join('') + '</table>';
  }

  if (rest.length) {
    h += '<div class="p2t">Everything else asked</div>' +
      '<table style="table-layout:fixed"><tr>' +
        '<td style="width:49%;vertical-align:top"><table class="cd">' + col(rest.slice(0, half)) + '</table></td>' +
        '<td style="width:2%"></td>' +
        '<td style="width:49%;vertical-align:top"><table class="cd">' + col(rest.slice(half)) + '</table></td>' +
      '</tr></table>';
  }

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
    answerTables_(body) +
    consentFoot_(body, ref);

  return toPdf_('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + paperCss_() +
                '</style></head><body>' + h + '</body></html>',
                (isGroup ? 'Group Service Review ' : 'Service Review ') + ref);
}

/** Every answer, section by section — shared by both questionnaire PDFs. */
function answerTables_(body) {
  var out = '', section = '';
  (body.fields || []).forEach(function (f) {
    if (f.section !== section) {
      if (section) out += '</table>';
      section = f.section;
      out += '<h3>' + esc_(section) + '</h3><table class="ans">';
    }
    out += '<tr><td class="k">' + esc_(f.label) + '</td><td>' + esc_(f.value) + '</td></tr>';
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

  var inner =
    '<div class="ttl">GUARDIAN LIFE OF THE CARIBBEAN LIMITED</div>' +
    '<div class="ttl2">REQUEST FOR CHANGE OF SERVICING AGENT</div>' +

    '<p class="blk">The Manager<br>Customer Service Department<br>' +
    '<b><u>GUARDIAN LIFE OF THE CARIBBEAN LIMITED</u></b></p>' +

    '<p class="blk">Dear Sir/Madam</p>' +

    '<p>After completing your Service Questionnaire and reviewing my policy(ies) no(s) ' +
      onLine_(a.coaPolicies || a.policyNos || c.policyNos || 'all policies held', 230) + '</p>' +
    '<p>with Mr./Mrs./Miss ' + onLine_(SVC.AGENT_NAME, 430) + '</p>' +
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
      '<td style="width:56%">SERVICING AGENT\'S NAME ' + onLine_(SVC.AGENT_NAME.toUpperCase(), 210) +
        '<div class="cap" style="padding-left:14px">(in block letters)</div></td>' +
      '<td>AGENT\'S NO. ' + onLine_(SVC.AGENT_NO, 190) + '</td>' +
    '</tr></table>' +

    '<table class="hdr" style="margin-top:44px"><tr>' +
      '<td style="width:46%;text-align:center"><span class="sigline" style="width:100%">&nbsp;</span>' +
        '<div style="font-weight:bold;font-size:9.6pt">SIGNATURE OF AGENT</div></td>' +
      '<td style="width:8%"></td>' +
      '<td style="width:46%;text-align:center"><span class="sigline" style="width:100%">&nbsp;</span>' +
        '<div style="font-weight:bold;font-size:9.6pt">SIGNATURE OF MANAGER</div></td>' +
    '</tr></table>' +

    '<div class="code">2000 - 03 - 147</div>';

  return toPdf_('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + paperCss_() +
                'body{padding:44px 52px}.ttl{font-size:14pt}.ttl2{font-size:11.5pt;margin-bottom:26px}' +
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
    '<tr><td class="lb">TO:</td><td>' + rule(a.coaTo || SVC.AGENT_NAME, 380) + '</td></tr>' +
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
      subject: '⏰ ' + overdue.length + ' service questionnaire' + (overdue.length > 1 ? 's are' : ' is') +
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
    .addItem('Install daily follow-up watchdog', 'installServiceTriggers')
    .addItem('Run follow-up check now', 'dailyServiceFollowUp')
    .addToUi();
}
