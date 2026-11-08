/**
 * ============================================================
 *  THE BRANCH'S OWN FORMS — backend
 *  Ricky Rampersad Branch
 * ============================================================
 *
 *  A fifth file in the Service Questionnaire project, beside Service.gs,
 *  Transition.gs, GroupClients.gs and StrategicMeeting.gs, routed by two
 *  lines in Service.gs (q.*) the way the others are.
 *
 *  WHY IT EXISTS. Until 22 October 2026 the homepage sent six of its
 *  busiest links out to JotForm: Motor, Property, Critical Illness, Key
 *  Person, OAS enrolment and the Xpress Life application. Motor is NOT
 *  here: /motor-quote/ and MotorQuote.gs, its own project, replaced that
 *  one on 21 October 2026 and do much more, so this file carries the
 *  other five and /quote/ sends Motor there. A JotForm
 *  submission never reached this sheet, never got a reference, and never
 *  landed in anybody's day — so a client who filled one in heard nothing
 *  back unless somebody happened to check an inbox. The branch manager
 *  put it plainly: "never closed by our online resources ... ensure that
 *  every link is not opening up a Jot form as well."
 *
 *  So the six forms are the branch's own pages now, and every one of them
 *  posts here. Each submission:
 *
 *    1. is filed on the Quote Requests tab, one row, with its reference;
 *    2. goes to sales support as one internal e-mail with every answer
 *       in it, so the desk that prices it has it without opening a sheet;
 *    3. goes back to the client as a confirmation carrying the reference
 *       and what happens next.
 *
 *  THE CLIENT'S CONFIRMATION IS NOT HELD by the hold on automatic client
 *  e-mail, for the same reason the questionnaire's confirmation is not:
 *  the client pressed send ten seconds ago and the reference has to reach
 *  them. It is an answer to something they just did, not a campaign.
 *
 *  SETUP: nothing. The tab makes itself on the first submission, and the
 *  pages already hold the deployment URL. After pasting this file, add
 *  the two q.* lines to Service.gs's doPost and doGet (they are in this
 *  repository's copy already), put TEAM_CODE back, and publish a New
 *  version — "Deploy → Manage deployments → pencil → New version", never
 *  New deployment, which issues a fresh /exec URL and unwires every
 *  front end.
 *
 *  NOT COLLECTED, anywhere, on purpose: a national ID or driver's permit
 *  number, a policy card number, bank or card details, and any health
 *  declaration. A web page is the wrong place for all of them. They are
 *  taken by a person, on the call or on the signed form.
 * ============================================================
 */

var QUOTE = {

  TAB: 'Quote Requests',

  /* Where a new request goes. Sales support prices it and decides which
     agent fits; the branch manager is copied because these are the
     branch's own leads now and he reads them. Both addresses already sit
     in SVC, so there is no new address in this file. */
  TO:  function () { return SVC.SALES_SUPPORT_EMAIL || SVC.AGENT_EMAIL; },
  CC:  function () {
    var cc = [SVC.AGENT_EMAIL].concat(SVC.CC || []);
    return cc.filter(function (a, i) { return a && cc.indexOf(a) === i; });
  },

  /* The six, and nothing else: an unknown key is turned away rather than
     filed under a name nobody will recognise. The code is the reference's
     own prefix, so a row's reference says which form it came from. */
  FORMS: {
    'property':         { code: 'QP', line: 'Property',          title: 'Property insurance quote' },
    'critical-illness': { code: 'QC', line: 'Critical illness',  title: 'Critical illness quote' },
    'key-person':       { code: 'QK', line: 'Key person',        title: 'Key person protection quote' },
    'oas':              { code: 'QO', line: 'OAS enrolment',     title: 'OAS enrolment' },
    'xpress-life':      { code: 'QX', line: 'Xpress Life',       title: 'Xpress Life application' },
    /* The careers page's booking: a confidential conversation with the Branch
       Manager. It goes to him alone, never to the sales support inbox, because
       the person asking may be contracted elsewhere today. */
    'careers':          { code: 'QT', line: 'Careers', title: 'Confidential conversation', to: 'manager',
                          client: 'Your request is with Mr Rampersad himself. Nobody else in the branch sees it.' },
    /* /buildwithus/ — the administrator's seat, the branch's own operations
       and automation role. It goes to the Branch Manager alone for the same
       reason the careers booking does: the person answering may be employed
       somewhere today, and an application that reached a shared branch inbox
       would be a breach of the discretion the page promises them. */
    'admin':            { code: 'QB', line: 'Build with us', title: 'Administrator and branch builder', to: 'manager',
                          client: 'Your answers are with Mr Rampersad himself. Nobody else in the branch sees them, and nothing reaches your current employer.' },
    /* /clientmanager/ — the general insurance agency's one seat. The key
       stays 'underwriter' and the reference stays QU- because the form was
       built for that name on 7 November 2026 and renamed the same day; moving
       it would strand the rows already on the tab for nothing. To the Branch
       Manager alone, like the other two recruiting forms, and the only form
       that takes a file: the CV. */
    'underwriter':      { code: 'QU', line: 'Client Manager', title: 'Client Manager, general insurance', to: 'manager', cv: true,
                          client: 'Your application is with Mr Rampersad himself. Nobody else in the branch sees it, and nothing reaches your current employer. '
                                + 'He replies within two working days to everyone he wants to speak to; if you do not hear from him in that time, it has been read and it has not gone forward on this occasion, and there will be no further letter.' }
  },

  /* The CV upload. Only a form whose def carries cv:true may send one.
     QUOTE_CV_FOLDER is the Drive folder id; without it the file is skipped
     and the row says so rather than the application being lost. */
  CV: {
    MAX_BYTES: 6 * 1024 * 1024,
    TYPES: { 'application/pdf': 'pdf', 'application/msword': 'doc',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' },
    FOLDER: function () { return (PropertiesService.getScriptProperties()
      .getProperty('QUOTE_CV_FOLDER') || '').trim(); }
  },

  /* The line of the summary column, per form: the two or three answers a
     person needs to see without opening the row. */
  SUMMARY: {
    'motor':            ['veh_year', 'veh_make', 'veh_model', 'veh_value', 'cov_type'],
    'property':         ['prop_type', 'prop_town', 'cov_what', 'sum_building', 'sum_contents'],
    'critical-illness': ['for_whom', 'life_dob', 'life_smoke', 'sum_want'],
    'key-person':       ['biz_name', 'kp_count', 'kp_role', 'kp_why', 'sum_want'],
    'oas':              ['emp_name', 'contrib', 'pay_how'],
    'xpress-life':      ['for_whom', 'life_dob', 'life_smoke', 'sum_want', 'how_finish'],
    'careers':          ['who', 'when_talk', 'note'],
    /* The score first, because it is the one thing that says whether to read
       the rest now or later; then where they are, and the thing they built. */
    'admin':            ['score', 'emp_role', 'pay_now'],
    /* Whether they clear the bar, their years and their papers. The unclipped
       scan line the page sends as its 'At a glance' section carries the rest.
       This also rides the subject line, so a full inbox sorts itself. */
    'underwriter':      ['scan_score', 'scan_bar', 'uw_years']
  },

  /* A client who taps send twice, or whose connection retries, must not
     make two rows and two e-mails. Inside this many minutes the same
     form from the same address gives back the reference it already has. */
  DEDUPE_MIN: 12,

  /* What the client is told happens next, per kind of page. The words are
     here and in tools/forms/forms.json, which writes the same list onto
     the done screen, so the page and the e-mail never disagree. */
  STEPS: {
    quote: ['Sales support checks it against our rates and your record, the same working day.',
            'A licensed agent calls you at the time you chose and talks you through the price.',
            'Happy with it? We put the cover on and you get the policy documents.'],
    enrol: ['Sales support checks it against your record and your workplace plan.',
            'We e-mail you the enrolment form and the payment authority to sign.',
            'Sign it, send it back, and your first contribution goes on the next run.'],
    apply: ['The branch opens your file under this reference straight away.',
            'A licensed agent calls you at the time you chose.',
            'Five health questions, no medical exam, and the cover is issued.'],
    join:  ['Mr Rampersad reads it himself, within two working days. Your name and your figures reach nobody else.',
            'If it reads like you, he asks you for one thing: something here you would fix, and how.',
            'Then twenty minutes on the phone — terms and pay openly — and a straight answer either way.'],
    talk:  ['Mr Rampersad reads it himself. Your name reaches nobody else.',
            'He calls you at the time you chose, within two working days, for twenty minutes.',
            'Your questions and the branch\'s own figures, no pitch. Then you decide.']
  },

  KIND: {
    'motor': 'quote', 'property': 'quote', 'critical-illness': 'quote',
    'key-person': 'quote', 'oas': 'enrol', 'xpress-life': 'apply', 'careers': 'talk',
    'admin': 'join', 'underwriter': 'join'
  },

  BRANCH_TEL: '(868) 226-6461',
  HEADERS: ['When', 'Ref', 'Form', 'Line', 'Status', 'Assigned to', 'Name', 'E-mail',
            'Phone', 'Reach', 'Best time', 'Agent named', 'Summary', 'Answers', 'Page', 'Note',
            /* Every answer exactly as it was typed, as JSON, for the hiring board
               to read back. The Answers cell beside it stays what it always was —
               one readable block with its newlines collapsed and each value cut at
               600 characters — because that cell is what a person skims and what
               the e-mail prints. On a quote form 600 is generous. On the three
               recruiting forms the written answers ARE the decision and run to 800,
               so reading the board off that cell would show less than the score was
               computed on. quoteCols_ adds a missing header to a tab that predates
               it, so this costs nothing on the rows already filed; they simply have
               no Full, and the board falls back to their Answers cell. */
            'Full']
};


/* ============================ routing ============================ */

/** Service.gs hands us anything whose action starts q. */
function quoteDoPost_(body) {
  var a = String((body && body.action) || '');
  if (a === 'q.quote') return quoteSubmit_(body);
  if (a === 'q.hire')  return quoteHireAct_(body);
  return { ok: false, error: 'Unknown action' };
}

function quoteDoGet_(p) {
  var a = String((p && p.action) || '');
  if (a === 'q.ping') {
    /* The pages do not need this — they post and read the answer. It is
       here so a person can check from a browser that the deployment
       carrying the forms is the live one. */
    return { ok: true, forms: Object.keys(QUOTE.FORMS), quotes: 1, hiring: 1 };
  }
  if (a === 'q.board') return quoteBoard_(p);
  return { ok: false, error: 'Unknown action' };
}


/* ============================ one submission ============================ */

function quoteSubmit_(body) {
  var form = String((body && body.form) || '').toLowerCase();
  var def  = QUOTE.FORMS[form];
  if (!def) return { ok: false, error: 'Unknown form' };

  var core   = (body && body.core)   || {};
  var fields = (body && body.fields) || [];
  if (!Object.prototype.toString.call(fields).match(/Array/)) fields = [];

  var name  = quoteClean_(core.name,  120);
  var email = quoteClean_(core.email, 160).toLowerCase();
  var phone = quoteClean_(core.phone,  40);

  if (!name)  return { ok: false, error: 'We need your name.' };
  if (!quoteEmailOk_(email)) return { ok: false, error: 'That e-mail address does not look right.' };
  if (!phone) return { ok: false, error: 'We need a phone number.' };

  /* A name that is a web address, or an answer dropped into the box no
     human can see, is a robot filling in the page. Turned away quietly:
     a bot that is told why tries again differently. */
  if (/https?:\/\/|\[url|<a\s/i.test(name) || quoteClean_(core.website, 10)) {
    return { ok: true, ref: 'QX-0000' };
  }

  var sh  = quoteSheet_();
  var now = new Date();

  var already = quoteRecent_(sh, form, email, now);
  if (already) return { ok: true, ref: already, repeat: true };

  var ref = quoteRef_(sh, def.code, now);

  var answers = quoteAnswers_(fields);
  var row = {};
  row['When']        = now;
  row['Ref']         = ref;
  row['Form']        = form;
  row['Line']        = def.line;
  row['Status']      = 'New';
  row['Assigned to'] = '';
  row['Name']        = name;
  row['E-mail']      = email;
  row['Phone']       = phone;
  row['Reach']       = quoteClean_(core.reach, 30);
  row['Best time']   = quoteClean_(core.when,  30);
  row['Agent named'] = quoteClean_(core.agent, 80);
  row['Summary']     = quoteSummary_(form, fields);
  row['Answers']     = answers.text;
  row['Full']        = quoteFull_(fields);
  row['Page']        = quoteClean_(body.page, 120);
  row['Note']        = '';

  /* The CV, for the one form that takes one. In its own try and BEFORE the
     row is written: a file that will not save must never lose the
     application, so the row records what happened either way. */
  var cv = null;
  if (def.cv && body && body.cv) {
    try { cv = quoteSaveCv_(ref, body.cv, name); }
    catch (e) { quoteLog_(ref, 'cv-failed', e); cv = { error: String(e).slice(0, 120) }; }
    row['Note'] = cv && cv.url ? 'CV: ' + cv.url
                : 'CV did not attach (' + ((cv && cv.error) || 'unknown') + ') — ask them to e-mail it.';
  }

  quoteAppend_(sh, row);

  /* Both e-mails are in their own try. A mail that will not send must
     never lose the row that is already filed. */
  var told = { team: false, client: false };
  try { quoteTeamMail_(ref, def, row, answers, now, cv); told.team = true; }
  catch (e) { quoteLog_(ref, 'team-mail-failed', e); }
  try { quoteClientMail_(ref, def, form, row); told.client = true; }
  catch (e) { quoteLog_(ref, 'client-mail-failed', e); }

  quoteLog_(ref, 'filed', def.line + ' · ' + (told.team ? 'team told' : 'TEAM NOT TOLD')
                        + ' · ' + (told.client ? 'client told' : 'CLIENT NOT TOLD'));

  return { ok: true, ref: ref, emailed: told.client, cv: !!(cv && cv.url) };
}


/* ============================ the CV ============================ */

/**
 * Save one uploaded CV to Drive and give back { name, url }.
 *
 * It is deliberately strict: only the three document types a CV actually
 * comes as, only up to QUOTE.CV.MAX_BYTES, and only into the folder the
 * QUOTE_CV_FOLDER property names. Anything else throws, and the caller
 * records that on the row rather than losing the application.
 */
function quoteSaveCv_(ref, cv, who) {
  var folderId = QUOTE.CV.FOLDER();
  if (!folderId) throw new Error('QUOTE_CV_FOLDER is not set');

  var type = String((cv && cv.type) || '').toLowerCase().split(';')[0];
  var ext  = QUOTE.CV.TYPES[type];
  if (!ext) throw new Error('not a PDF or Word document');

  var b64 = String((cv && cv.data) || '');
  var comma = b64.indexOf(',');
  if (b64.slice(0, 5) === 'data:' && comma > -1) b64 = b64.slice(comma + 1);
  if (!b64) throw new Error('empty file');
  /* base64 is 4 characters per 3 bytes; check before decoding so a huge
     paste cannot blow the run up on the decode itself. */
  if (b64.length / 4 * 3 > QUOTE.CV.MAX_BYTES) throw new Error('over 6 MB');

  var bytes = Utilities.base64Decode(b64);
  if (bytes.length > QUOTE.CV.MAX_BYTES) throw new Error('over 6 MB');

  var safe = String(who || 'candidate').replace(/[^A-Za-z0-9 .-]/g, '').slice(0, 60).trim() || 'candidate';
  var blob = Utilities.newBlob(bytes, type, ref + ' - ' + safe + '.' + ext);
  var file = DriveApp.getFolderById(folderId).createFile(blob);
  return { name: file.getName(), url: file.getUrl() };
}


/* ============================ the sheet ============================ */

function quoteSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(QUOTE.TAB);
  if (!sh) {
    sh = ss.insertSheet(QUOTE.TAB);
    sh.getRange(1, 1, 1, QUOTE.HEADERS.length).setValues([QUOTE.HEADERS])
      .setFontWeight('bold').setBackground('#0d3f5e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);   // When
    sh.setColumnWidth(2, 120);   // Ref
    sh.setColumnWidth(13, 300);  // Summary
    sh.setColumnWidth(14, 420);  // Answers
  }
  return sh;
}

/** Column index by header name, so a column added by hand never shifts us. */
function quoteCols_(sh) {
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), QUOTE.HEADERS.length))
               .getValues()[0];
  var map = {};
  head.forEach(function (h, i) { if (h) map[String(h).trim()] = i; });
  /* A tab made before a header existed gains it rather than losing the value. */
  QUOTE.HEADERS.forEach(function (h) {
    if (map[h] === undefined) {
      var at = sh.getLastColumn() + 1;
      sh.getRange(1, at).setValue(h).setFontWeight('bold')
        .setBackground('#0d3f5e').setFontColor('#ffffff');
      map[h] = at - 1;
    }
  });
  return map;
}

function quoteAppend_(sh, row) {
  var map = quoteCols_(sh);
  var width = Math.max(sh.getLastColumn(), QUOTE.HEADERS.length);
  var out = new Array(width).fill('');
  Object.keys(row).forEach(function (k) { if (map[k] !== undefined) out[map[k]] = row[k]; });
  sh.appendRow(out);
}

/**
 * The reference. <code>-<yyMMdd>-<nnn>, the number being how many of that
 * form came in that day. Read off the tab rather than kept in a property,
 * so a reference can never run ahead of a row that failed to write.
 */
function quoteRef_(sh, code, now) {
  var tz  = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'America/Port_of_Spain';
  var day = Utilities.formatDate(now, tz, 'yyMMdd');
  var stem = code + '-' + day + '-';
  var n = 0;
  var last = sh.getLastRow();
  if (last > 1) {
    var map = quoteCols_(sh);
    var refs = sh.getRange(2, map['Ref'] + 1, last - 1, 1).getValues();
    for (var i = 0; i < refs.length; i++) {
      var r = String(refs[i][0] || '');
      if (r.indexOf(stem) === 0) {
        var m = parseInt(r.slice(stem.length), 10);
        if (m > n) n = m;
      }
    }
  }
  return stem + ('00' + (n + 1)).slice(-3);
}

/** The same form from the same address, minutes ago: one request, not two. */
function quoteRecent_(sh, form, email, now) {
  var last = sh.getLastRow();
  if (last < 2) return '';
  var map = quoteCols_(sh);
  var from = Math.max(2, last - 60);                   // the tail is enough
  var rows = sh.getRange(from, 1, last - from + 1, sh.getLastColumn()).getValues();
  var cut = now.getTime() - QUOTE.DEDUPE_MIN * 60000;
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (String(r[map['Form']] || '') !== form) continue;
    if (String(r[map['E-mail']] || '').toLowerCase() !== email) continue;
    var w = r[map['When']];
    var t = (w instanceof Date) ? w.getTime() : Date.parse(w);
    if (t && t >= cut) return String(r[map['Ref']] || '');
    return '';                                          // their newest is older
  }
  return '';
}

function quoteLog_(ref, event, details) {
  try {
    if (typeof log_ === 'function') log_(ref, 'quote-' + event, String(details || ''));
  } catch (e) {}
}


/* ============================ reading the answers ============================ */

function quoteClean_(v, max) {
  var s = String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim();
  return s.slice(0, max || 200);
}

function quoteEmailOk_(s) {
  return /^[^@\s,;]+@[^@\s,;.]+(\.[^@\s,;.]+)+$/.test(String(s || ''));
}

/** One readable block, section by section, for the cell and for the e-mail. */
function quoteAnswers_(fields) {
  var text = '', html = '', sec = '';
  fields.forEach(function (f) {
    var s = quoteClean_(f.section, 60);
    var l = quoteClean_(f.label, 160);
    var v = quoteClean_(f.value, 600);
    if (!l || !v) return;
    if (s !== sec) {
      sec = s;
      text += (text ? '\n' : '') + '— ' + s.toUpperCase() + ' —\n';
      html += '<tr><td colspan="2" style="padding:14px 0 4px;font:700 12px/1.4 Arial,sans-serif;'
            + 'letter-spacing:.08em;text-transform:uppercase;color:#00728d">' + quoteEsc_(s) + '</td></tr>';
    }
    text += l + ': ' + v + '\n';
    html += '<tr><td style="padding:5px 16px 5px 0;font:400 14px/1.5 Arial,sans-serif;color:#5b6670;'
          + 'vertical-align:top;width:45%">' + quoteEsc_(l) + '</td>'
          + '<td style="padding:5px 0;font:600 14px/1.5 Arial,sans-serif;color:#2b3b47">'
          + quoteEsc_(v).replace(/\n/g, '<br>') + '</td></tr>';
  });
  return { text: text.replace(/\s+$/, ''), html: html };
}

/**
 * Every answer as JSON, for the Full column: the key, the section, the label
 * and the value with its own line breaks kept, cut at 4,000 characters rather
 * than 600. Only what a person typed — nothing is derived here, so the board
 * shows what was sent and not a second opinion about it.
 *
 * A row is a Sheets cell, which holds 50,000 characters; the longest form we
 * have comes to about 6,000. If it ever did overflow, the cell would be
 * refused and the whole application lost, so the write is bounded and the
 * board falls back to the Answers cell when Full is absent or unreadable.
 */
function quoteFull_(fields) {
  var out = [];
  (fields || []).forEach(function (f) {
    if (!f || !f.label) return;
    var v = String(f.value === undefined || f.value === null ? '' : f.value)
              .replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!v) return;
    out.push({ k: String(f.k || '').slice(0, 40),
               s: quoteClean_(f.section, 60),
               l: quoteClean_(f.label, 160),
               v: v.slice(0, 4000) });
  });
  var s = '';
  try { s = JSON.stringify(out); } catch (e) { return ''; }
  return s.length > 45000 ? '' : s;
}

function quoteSummary_(form, fields) {
  var want = QUOTE.SUMMARY[form] || [];
  var by = {};
  fields.forEach(function (f) { if (f && f.k) by[f.k] = quoteClean_(f.value, 60); });
  var bits = [];
  want.forEach(function (k) { if (by[k]) bits.push(by[k]); });
  return bits.join(' · ');
}

function quoteEsc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


/* ============================ the two e-mails ============================ */

/**
 * Internal. Carries a client's name and contact details, so it says so
 * at the foot — the house rule for every internal e-mail that does.
 */
function quoteTeamMail_(ref, def, row, answers, now, cv) {
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'America/Port_of_Spain';
  var when = Utilities.formatDate(now, tz, 'd MMM yyyy, h:mm a');

  var head = function (k, v) {
    return '<tr><td style="padding:4px 16px 4px 0;font:400 14px/1.5 Arial,sans-serif;color:#5b6670">'
         + k + '</td><td style="padding:4px 0;font:600 14px/1.5 Arial,sans-serif;color:#2b3b47">'
         + quoteEsc_(v) + '</td></tr>';
  };

  var tel = String(row['Phone'] || '').replace(/[^0-9+]/g, '');
  var h =
    '<div style="background:#faf9f2;padding:0;margin:0">'
    + '<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e4e0d4;border-radius:14px;overflow:hidden">'
    + '<div style="background:#0d3f5e;padding:20px 24px">'
    +   '<div style="font:700 11px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8fc6d8">'
    +   'New ' + quoteEsc_(def.line) + ' request</div>'
    +   '<div style="font:700 22px/1.3 Arial,sans-serif;color:#ffffff;margin-top:4px">' + quoteEsc_(ref) + '</div>'
    + '</div>'
    + '<div style="padding:24px">'
    +   '<p style="margin:0 0 16px;font:400 15px/1.6 Arial,sans-serif;color:#2b3b47">'
    +   'From the branch\'s own ' + quoteEsc_(def.title.toLowerCase()) + ' page. It is on the <b>'
    +   QUOTE.TAB + '</b> tab, status <b>New</b>.</p>'
    +   '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">'
    +     head('Client', row['Name'])
    +     '<tr><td style="padding:4px 16px 4px 0;font:400 14px/1.5 Arial,sans-serif;color:#5b6670">E-mail</td>'
    +     '<td style="padding:4px 0;font:600 14px/1.5 Arial,sans-serif"><a href="mailto:'
    +     quoteEsc_(row['E-mail']) + '" style="color:#00728d">' + quoteEsc_(row['E-mail']) + '</a></td></tr>'
    +     '<tr><td style="padding:4px 16px 4px 0;font:400 14px/1.5 Arial,sans-serif;color:#5b6670">Phone</td>'
    +     '<td style="padding:4px 0;font:600 14px/1.5 Arial,sans-serif"><a href="tel:' + quoteEsc_(tel)
    +     '" style="color:#00728d">' + quoteEsc_(row['Phone']) + '</a></td></tr>'
    +     head('Reach them', (row['Reach'] || '—') + ' · ' + (row['Best time'] || 'any time'))
    +     (row['Agent named'] ? head('Agent named by the client', row['Agent named']) : '')
    +     head('Came in', when)
    +     (cv && cv.url
          ? head('Their CV', '<a href="' + quoteEsc_(cv.url) + '">' + quoteEsc_(cv.name) + '</a>')
          : (cv && cv.error
             ? head('Their CV', 'did not attach (' + quoteEsc_(cv.error) + ') &mdash; ask them to e-mail it')
             : ''))
    +   '</table>'
    +   (row['Summary']
        ? '<div style="margin:18px 0;padding:12px 16px;background:#e8f3f6;border-left:4px solid #00728d;'
          + 'font:600 15px/1.5 Arial,sans-serif;color:#0d3f5e">' + quoteEsc_(row['Summary']) + '</div>' : '')
    +   '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px">'
    +   answers.html + '</table>'
    +   '<p style="margin:22px 0 0;font:400 14px/1.6 Arial,sans-serif;color:#5b6670">'
    +   (def.to === 'manager'
        ? 'They have been sent this reference and told you will call them yourself '
        : 'The client has been sent this reference and told a licensed agent will call them ')
    +   (row['Best time'] ? 'in the ' + String(row['Best time']).toLowerCase() : 'shortly')
    +   '. Mark the row when you have.</p>'
    + '</div></div>'
    + '<p style="max-width:640px;margin:14px auto 0;font:400 12px/1.5 Arial,sans-serif;color:#5b6670">'
    + 'Internal &mdash; this e-mail carries a client\'s name and contact details. '
    + 'Do not forward outside the branch.</p>'
    + '</div>';

  /* A careers booking goes to the Branch Manager alone (def.to): the person
     asking may be contracted elsewhere today, and the page promised nobody
     else would see their name. */
  MailApp.sendEmail({
    to: def.to === 'manager' ? SVC.AGENT_EMAIL : QUOTE.TO(),
    cc: def.to === 'manager' ? '' : QUOTE.CC().join(','),
    name: SVC.FROM_NAME,
    replyTo: row['E-mail'],
    /* The summary rides the subject too: with a recruiting ad running, the
       inbox is a list of forty and the decision of which to open first should
       not need any of them opened. */
    subject: 'New ' + def.line + ' request · ' + ref + ' · ' + row['Name']
           + (row['Summary'] ? ' · ' + quoteClean_(row['Summary'], 70) : ''),
    htmlBody: h
  });
}

/**
 * The client's. Through clientMail_ in Service.gs, which sends it from
 * support@rickyrampersadbranch.com when the Microsoft 365 properties are
 * set and adds the confidentiality footer — so this function never
 * duplicates either.
 */
function quoteClientMail_(ref, def, form, row) {
  var kind  = QUOTE.KIND[form] || 'quote';
  var steps = QUOTE.STEPS[kind] || QUOTE.STEPS.quote;
  var first = String(row['Name'] || '').split(' ')[0] || 'there';

  var li = steps.map(function (s, i) {
    return '<tr><td style="padding:6px 12px 6px 0;vertical-align:top">'
         + '<div style="width:24px;height:24px;border-radius:12px;background:#0d3f5e;color:#fff;'
         + 'font:700 12px/24px Arial,sans-serif;text-align:center">' + (i + 1) + '</div></td>'
         + '<td style="padding:6px 0;font:400 15px/1.55 Arial,sans-serif;color:#2b3b47">'
         + quoteEsc_(s) + '</td></tr>';
  }).join('');

  var h =
    '<div style="background:#faf9f2;padding:0;margin:0">'
    + '<div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e4e0d4;border-radius:14px;overflow:hidden">'
    + '<div style="background:#0d3f5e;padding:22px 26px">'
    +   '<img src="https://rickyrampersadbranch.com/logo-mark.png" width="44" height="44" alt="" '
    +   'style="display:block;border:0;margin-bottom:10px">'
    +   '<div style="font:700 21px/1.3 Arial,sans-serif;color:#ffffff">Thank you, ' + quoteEsc_(first) + '. We have it.</div>'
    + '</div>'
    + '<div style="padding:26px">'
    +   '<p style="margin:0 0 18px;font:400 15px/1.65 Arial,sans-serif;color:#2b3b47">'
    +   (def.client ? quoteEsc_(def.client) + ' '
        : 'Your ' + quoteEsc_(def.title.toLowerCase()) + ' is with our branch team. ')
    +   'Keep the reference below &mdash; quote it whenever you call us about this.</p>'
    +   '<div style="margin:0 0 20px;padding:14px 18px;background:#e8f3f6;border:1px solid #00728d;border-radius:10px">'
    +     '<div style="font:700 11px/1.4 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#005a70">Your reference</div>'
    +     '<div style="font:700 24px/1.3 Arial,sans-serif;color:#0d3f5e;letter-spacing:.02em">' + quoteEsc_(ref) + '</div>'
    +   '</div>'
    +   '<div style="font:700 13px/1.4 Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#00728d;margin-bottom:6px">What happens next</div>'
    +   '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">' + li + '</table>'
    +   (row['Summary']
        ? '<p style="margin:20px 0 0;font:400 14px/1.6 Arial,sans-serif;color:#5b6670">'
          + 'What you told us: ' + quoteEsc_(row['Summary']) + '.</p>' : '')
    +   '<p style="margin:20px 0 0;font:400 15px/1.65 Arial,sans-serif;color:#2b3b47">'
    +   'Need us sooner, or something has changed? Call the branch on '
    +   '<a href="tel:+18682266461" style="color:#00728d;font-weight:600">' + QUOTE.BRANCH_TEL + '</a> '
    +   'or just reply to this e-mail.</p>'
    +   '<p style="margin:22px 0 0;font:400 15px/1.6 Arial,sans-serif;color:#2b3b47">'
    +   'Ricky Rampersad Branch<br><span style="color:#5b6670;font-size:14px">Guardian Life of the Caribbean</span></p>'
    + '</div></div></div>';

  if (typeof clientMail_ === 'function') {
    clientMail_({ to: row['E-mail'], subject: def.title + ' — your reference ' + ref, htmlBody: h });
  } else {
    MailApp.sendEmail({ to: row['E-mail'], name: SVC.FROM_NAME, replyTo: SVC.SUPPORT_EMAIL,
                        subject: def.title + ' — your reference ' + ref, htmlBody: h });
  }
}


/* ══════════════════════════════════════════════════════════════════════
 * THE HIRING BOARD — /hiring, 8 November 2026
 *
 * Asked for after the filter was weighted: "anything further we can
 * enhance for the ultimate experience". The answer was that the thing
 * receiving the applications had become the weakest part of it. Every
 * one lands on the Quote Requests tab beside a client's property quote
 * and an OAS enrolment, in the order it arrived, and is read in Gmail.
 * Three seats, a weighted score nobody can sort on, no way to compare
 * two people, no record of who was called, and nothing measuring the
 * two-working-day promise the three pages make in writing.
 *
 * This reads that tab and shows the recruiting rows alone.
 *
 * ── WHO MAY OPEN IT: THE BRANCH MANAGER, SIGNED IN AS HIMSELF. ──
 *
 * Not staff, not a unit manager, not an agent, not the Assistant Branch
 * Manager, and NOT THE BRANCH CODE. That is not caution, it is the
 * promise the three pages make to every applicant in their own words:
 *
 *   "Your application is with Mr Rampersad himself. Nobody else in the
 *    branch sees it, and nothing reaches your current employer."
 *
 * A man applying for this seat is employed somewhere today. The branch
 * code is the wall's code and the dashboard's code; whoever switches the
 * wall on in the morning has it. If this board opened on it, the page
 * would be lying to the people it is asking to trust it, and the first
 * person to find that out would be an applicant whose employer heard.
 *
 * So the test is tAs_'s own shape: user (a real person, not the bare
 * code), not viaBranch (not the code with a name typed after it), and
 * canTell, which tAs_ sets for 'bm' alone and never for 'abm'. Signing
 * in through the branch app satisfies it; the branch code never does.
 * Do not widen this without changing what the three pages promise.
 *
 * Service.gs already routes anything starting q. to this file, so the
 * board needs no Service.gs change: paste Quotes.gs, publish a New
 * version, and it is live with the confirmation wording.
 * ══════════════════════════════════════════════════════════════════════ */

var HIRE = {
  /* The recruiting forms, in the order the board shows them. A quote form
     never appears here: separating the two is the point. */
  SEATS: ['underwriter', 'admin', 'careers'],

  /* What the three pages promise in writing, so the board can measure it.
     Change the pages and change this, or the clock measures a promise
     nobody made. */
  PROMISE_DAYS: 2,

  /* Where a row can stand. 'New' is what quoteSubmit_ writes. */
  STATUS: ['New', 'Reading', 'Call them', 'Met', 'Hired', 'Not this time'],

  /* The advisor seat is not on this tab and the board says so rather than
     showing an empty column that reads as "nobody applied". Applications
     for it go to Guardian's own TalentNest posting; only the "Talk first"
     booking from /careers/#talk and /joinourbranch/ reaches us, as the
     'careers' form. */
  ELSEWHERE: 'The advisor seat takes applications through Guardian’s own TalentNest posting, not this board. '
           + 'What reaches us from /joinourbranch/ and /careers/ is the confidential conversation booking, under Conversations.'
};


/** The Branch Manager, as himself, or null. See the block above for why. */
function quoteHireWho_(p) {
  if (typeof tWho_ !== 'function') return null;
  var w;
  try { w = tWho_((p && p.code) || '', (p && p.who) || ''); } catch (e) { return null; }
  if (!w || !w.ok) return null;
  if (w.user !== true || w.viaBranch === true || w.canTell !== true) return null;
  return { name: (w.me && w.me.name) || 'Branch Manager', email: (w.me && w.me.email) || '' };
}

/** Why a sign-in was turned away, in the words the person needs. */
function quoteHireRefuse_(p) {
  var w = null;
  if (typeof tWho_ === 'function') { try { w = tWho_((p && p.code) || '', (p && p.who) || ''); } catch (e) {} }
  /* The branch code twice over: on its own, tWho_ answers with no `user` at
     all; with a name typed after it, it answers viaBranch. Both are the code,
     and both get the same words, because being told "this board is the Branch
     Manager's alone" when you ARE the Branch Manager reads as a fault rather
     than as an instruction. */
  if (w && w.ok && (w.viaBranch === true || w.user !== true)) {
    return 'The branch code does not open this board. Sign in with your agent number and your password, '
         + 'or from the branch app — these applications are promised to you alone.';
  }
  if (w && w.ok) return 'This board is the Branch Manager’s alone. Every applicant was told nobody else in the branch sees their application.';
  return (w && w.error) || 'Sign in with your agent number and your password.';
}


/* ──────────────────────── reading the tab ──────────────────────── */

function quoteBoard_(p) {
  var me = quoteHireWho_(p);
  if (!me) return { ok: false, refused: true, error: quoteHireRefuse_(p) };

  var sh = quoteSheet_(), map = quoteCols_(sh), rows = [];
  var last = sh.getLastRow();
  if (last > 1) {
    var width = Math.max(sh.getLastColumn(), QUOTE.HEADERS.length);
    var vals = sh.getRange(2, 1, last - 1, width).getValues();
    var now = new Date();
    vals.forEach(function (r) {
      var form = String(r[map['Form']] || '').trim();
      if (HIRE.SEATS.indexOf(form) < 0) return;          /* a quote request is not ours */
      rows.push(quoteHireRow_(r, map, form, now));
    });
  }
  /* Newest first within a seat; the page sorts by score when asked. The
     order here is the order they arrived, which is the order the promise
     runs in, so a board that fails to sort still shows the oldest first. */
  rows.sort(function (a, b) { return (b.ms || 0) - (a.ms || 0); });

  var seats = HIRE.SEATS.map(function (k) {
    var def = QUOTE.FORMS[k] || {}, mine = rows.filter(function (r) { return r.form === k; });
    return { key: k, line: def.line || k, title: def.title || k,
             count: mine.length,
             open: mine.filter(function (r) { return r.open; }).length,
             late: mine.filter(function (r) { return r.open && r.clock && r.clock.late; }).length };
  });

  return { ok: true, me: me, rows: rows, seats: seats,
           status: HIRE.STATUS, promiseDays: HIRE.PROMISE_DAYS, elsewhere: HIRE.ELSEWHERE,
           cvFolder: !!QUOTE.CV.FOLDER(),
           now: Utilities.formatDate(new Date(), quoteTz_(), "yyyy-MM-dd'T'HH:mm:ss") };
}

function quoteTz_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'America/Port_of_Spain';
}

function quoteHireRow_(r, map, form, now) {
  var get = function (h) { return map[h] === undefined ? '' : r[map[h]]; };
  var when = get('When'), ms = (when instanceof Date) ? when.getTime() : Date.parse(String(when || '')) || 0;
  var status = String(get('Status') || 'New').trim() || 'New';
  var open = ['Met', 'Hired', 'Not this time'].indexOf(status) < 0;
  var fields = quoteHireFields_(get('Full'), get('Answers'));
  var by = {};
  fields.forEach(function (f) { if (f.k) by[f.k] = f.v; });

  var note = String(get('Note') || '');
  var cv = (note.match(/CV:\s*(\S+)/) || [])[1] || '';

  return {
    ref: String(get('Ref') || ''), form: form, line: String(get('Line') || ''),
    ms: ms, when: ms ? Utilities.formatDate(new Date(ms), quoteTz_(), 'd MMM, h:mm a') : '',
    status: status, open: open,
    name: String(get('Name') || ''), email: String(get('E-mail') || ''), phone: String(get('Phone') || ''),
    reach: String(get('Reach') || ''), best: String(get('Best time') || ''),
    summary: String(get('Summary') || ''), note: note, cv: cv,
    score: quoteHireScore_(by), bar: String(by['scan_bar'] || ''),
    file: quoteHireFile_(by), fields: fields,
    clock: open ? quoteHireClock_(ms, now) : null
  };
}

/**
 * Every answer. Full is JSON and exact; Answers is the readable block, its
 * newlines collapsed and each value cut at 600 characters, which is what a
 * row filed before Full existed has. Falling back to it loses the paragraphs
 * and the tail of a long answer, so the board says so on the card rather
 * than showing a clipped answer as though it were whole.
 */
function quoteHireFields_(full, answers) {
  var out = [];
  if (full) {
    try {
      var j = JSON.parse(String(full));
      if (j && j.length) {
        j.forEach(function (f) { out.push({ k: String(f.k || ''), s: String(f.s || ''), l: String(f.l || ''), v: String(f.v || ''), whole: true }); });
        return out;
      }
    } catch (e) {}
  }
  var sec = '';
  String(answers || '').split('\n').forEach(function (ln) {
    var m = ln.match(/^—\s*(.+?)\s*—$/);
    if (m) { sec = m[1]; return; }
    var i = ln.indexOf(': ');
    if (i > 0) out.push({ k: '', s: sec, l: ln.slice(0, i), v: ln.slice(i + 2), whole: false });
  });
  return out;
}

/**
 * The weighted score the page computed, taken apart for the card. The page
 * is the only place it is worked out; nothing is recomputed here, so the
 * board can never disagree with the e-mail about the same application.
 * Its shape: "Fit 65/100 · door 1 · depth 27/30 · file 18/25 · ..."
 */
function quoteHireScore_(by) {
  var s = String(by['scan_score'] || by['score'] || '');
  if (!s) return null;
  var fit = (s.match(/Fit\s+(\d+)\s*\/\s*100/i) || [])[1];
  var door = (s.match(/door\s+(\d)/i) || [])[1];
  var parts = [];
  s.split('·').forEach(function (bit) {
    var m = String(bit).trim().match(/^([a-z ]+?)\s+(\d+)\s*\/\s*(\d+)$/i);
    if (m && !/^fit$/i.test(m[1].trim())) parts.push({ label: m[1].trim(), got: Number(m[2]), of: Number(m[3]) });
  });
  return { fit: fit ? Number(fit) : null, door: door ? Number(door) : null, parts: parts, line: s };
}

/** What they did with the renewal file: the ticks in their own order. */
function quoteHireFile_(by) {
  var order = String(by['file_order'] || by['file_ticks'] || '');
  var ask = String(by['file_ask'] || '');
  var prem = String(by['file_premium'] || '');
  if (!order && !ask && !prem) return null;
  return { order: order, ask: ask, premium: prem };
}

/**
 * The promise clock. Two working days from the moment it arrived, which is
 * what the three pages say in writing. Working days are counted the way the
 * rest of the branch counts them, through GroupBilling's holiday list when
 * that file is in the project; without it, Monday to Friday.
 */
function quoteHireClock_(ms, now) {
  if (!ms) return null;
  var hol = {};
  if (typeof gblHolidays_ === 'function') { try { hol = gblHolidays_() || {}; } catch (e) {} }
  var tz = quoteTz_();
  var day = function (d) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); };
  var working = function (d) {
    var dow = Number(Utilities.formatDate(d, tz, 'u'));          /* 1 Mon … 7 Sun */
    return dow <= 5 && !hol[day(d)] && !hol[day(d).slice(5)];
  };
  var d = new Date(ms), used = 0, guard = 0;
  /* The day it arrived counts once it is over, as every other clock in this
     branch counts: an application on Friday morning is due Tuesday morning. */
  while (used < HIRE.PROMISE_DAYS && guard++ < 40) {
    d = new Date(d.getTime() + 86400000);
    if (working(d)) used++;
  }
  var dueMs = d.getTime();
  var left = Math.round((dueMs - now.getTime()) / 3600000);
  return { due: Utilities.formatDate(new Date(dueMs), tz, 'EEE d MMM'),
           hours: left, late: now.getTime() > dueMs,
           today: day(new Date(dueMs)) === day(now) };
}


/* ──────────────────────── acting on one ──────────────────────── */

function quoteHireAct_(body) {
  var me = quoteHireWho_(body);
  if (!me) return { ok: false, refused: true, error: quoteHireRefuse_(body) };

  var ref = String((body && body.ref) || '').trim();
  if (!ref) return { ok: false, error: 'Which application?' };

  var sh = quoteSheet_(), map = quoteCols_(sh), last = sh.getLastRow();
  if (last < 2) return { ok: false, error: 'Nothing on the tab yet.' };

  /* Found by its reference, never by a row number: the tab is sorted by
     hand often enough, and a stamp written to the wrong row is a stamp on
     somebody else's application. Transition Send learned this on
     30 September 2026 and the lesson is the same here. */
  var width = Math.max(sh.getLastColumn(), QUOTE.HEADERS.length);
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  var at = -1;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][map['Ref']] || '').trim() === ref) { at = i; break; }
  }
  if (at < 0) return { ok: false, error: 'That application is not on the tab any more.' };
  var row = vals[at], rowNo = at + 2;
  if (HIRE.SEATS.indexOf(String(row[map['Form']] || '').trim()) < 0) {
    return { ok: false, error: 'That reference is not an application.' };
  }

  var act = String((body && body.act) || '').trim();
  var stamp = '[' + Utilities.formatDate(new Date(), quoteTz_(), 'd MMM') + ' · ' + me.name + ']';
  var out = { ok: true, ref: ref };

  if (act === 'status' || act === 'invite') {
    var want = act === 'invite' ? 'Call them' : String((body && body.status) || '').trim();
    if (HIRE.STATUS.indexOf(want) < 0) return { ok: false, error: 'Not a status this board knows.' };
    sh.getRange(rowNo, map['Status'] + 1).setValue(want);
    out.status = want;
  }

  if (act === 'invite') {
    /* His press is his go, so the hold on automatic client e-mail does not
       stop it, exactly as a manager's note from the assignment board is not
       stopped: the hold is on what a machine sends by itself. */
    var sent = quoteHireInvite_(row, map, me, String((body && body.line) || ''));
    if (!sent.ok) return { ok: false, error: sent.error };
    out.sent = true;
  }

  /* NOT THIS TIME SENDS NOTHING, and that is deliberate. The page told
     every applicant, above the form and again in their confirmation, that
     silence inside two working days is the answer and "there will be no
     further letter". A rejection e-mail from here would contradict the
     branch's own written word to somebody who has already understood it.
     If that is ever to change, change the page first. */

  var note = quoteClean_((body && body.note) || '', 400);
  if (note || act === 'invite' || act === 'status') {
    var was = String(row[map['Note']] || '');
    var add = stamp + (act === 'invite' ? ' invited to a conversation' : act === 'status' ? ' ' + out.status : '')
            + (note ? ': ' + note : '');
    sh.getRange(rowNo, map['Note'] + 1).setValue(was ? was + '\n' + add : add);
    out.note = add;
  }
  return out;
}

/**
 * The invitation. From support@ through clientMail_, the same road the
 * confirmation took, signed by him. It offers a conversation and promises
 * nothing about the seat: a man who is employed somewhere today must not be
 * able to read this as an offer, and nothing here may reach his employer.
 */
function quoteHireInvite_(row, map, me, line) {
  var to = String(row[map['E-mail']] || '').trim();
  if (!quoteEmailOk_(to)) return { ok: false, error: 'No usable e-mail on that application.' };
  var who = String(row[map['Name']] || '').trim().split(/\s+/)[0] || 'there';
  var def = QUOTE.FORMS[String(row[map['Form']] || '')] || {};
  var own = quoteClean_(line, 600);

  var h = '<div style="background:#faf9f2;padding:28px 0"><div style="max-width:560px;margin:0 auto;'
        + 'background:#fff;border:1px solid #e4e0d4;border-radius:14px;overflow:hidden">'
        + '<div style="background:#0d1f33;padding:20px 28px">'
        +   '<div style="font:700 15px/1.3 Arial,sans-serif;color:#fff">Ricky Rampersad Branch</div>'
        +   '<div style="font:400 12px/1.4 Arial,sans-serif;color:#b9cadd;letter-spacing:.06em;text-transform:uppercase">'
        +   'Guardian Life of the Caribbean</div>'
        + '</div>'
        + '<div style="padding:28px">'
        +   '<p style="margin:0 0 16px;font:400 16px/1.6 Arial,sans-serif;color:#2b3b47">' + quoteEsc_(who) + ',</p>'
        +   '<p style="margin:0 0 16px;font:400 16px/1.6 Arial,sans-serif;color:#2b3b47">'
        +   'Thank you for your application for the ' + quoteEsc_(def.line || 'seat') + '. I have read it myself, '
        +   'and I would like twenty minutes with you.</p>'
        + (own ? '<p style="margin:0 0 16px;font:400 16px/1.6 Arial,sans-serif;color:#2b3b47">' + quoteEsc_(own).replace(/\n/g, '<br>') + '</p>' : '')
        +   '<p style="margin:0 0 16px;font:400 16px/1.6 Arial,sans-serif;color:#2b3b47">'
        +   'Reply to this e-mail with a time that suits you, or call me on '
        +   '<a href="tel:+18682266461" style="color:#00728d;font-weight:600">' + QUOTE.BRANCH_TEL + '</a>. '
        +   'Early morning and evening both work, and so does a Saturday.</p>'
        +   '<p style="margin:0 0 16px;font:400 15px/1.6 Arial,sans-serif;color:#5b6670">'
        +   'This is a conversation and nothing more at this stage — no decision has been made, on either side. '
        +   'It stays between us: nobody else in the branch sees your application, and nothing reaches your current employer.</p>'
        +   '<p style="margin:22px 0 0;font:400 16px/1.6 Arial,sans-serif;color:#2b3b47">'
        +   quoteEsc_(me.name) + '<br><span style="color:#5b6670;font-size:14px">Branch Manager</span></p>'
        + '</div></div></div>';

  var subj = 'Your application — can we talk?';
  try {
    if (typeof clientMail_ === 'function') clientMail_({ to: to, subject: subj, htmlBody: h, replyTo: me.email || undefined });
    else MailApp.sendEmail({ to: to, name: SVC.FROM_NAME, replyTo: me.email || SVC.SUPPORT_EMAIL, subject: subj, htmlBody: h });
  } catch (e) {
    return { ok: false, error: 'The invitation did not send: ' + String(e).slice(0, 120) };
  }
  return { ok: true };
}
