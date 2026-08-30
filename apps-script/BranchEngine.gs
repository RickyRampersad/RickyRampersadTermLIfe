/* ══════════════════════════════════════════════════════════════════════════
   RICKY RAMPERSAD BRANCH — THE WHOLE ENGINE, ONE FILE
   Quote requests + enrollments + feedback + EMPLOYEE BENEFITS backend.

   THIS FILE REPLACES BOTH Code.gs AND Benefits.gs.
   In the branch sheet's Apps Script editor:
     1. Paste this over Benefits.gs (Ctrl+A, Ctrl+V), Save.
     2. DELETE the Code.gs file (⋮ beside its name → Remove) — everything it
        did is in here, unchanged.
     3. Deploy → New deployment → Web app · Execute as Me · Anyone → Deploy,
        and copy the URL from the success panel.
   One file means there is never again a stale half — the newest copy always
   lives at the repository, and only that copy should ever be pasted.
   ══════════════════════════════════════════════════════════════════════════ */

/* ============================================================================
   RICKY RAMPERSAD BRANCH — QUOTE-REQUEST ENGINE (Google Apps Script)
   Lives inside the branch Google Sheet. Does three jobs:

     1. Every submission from the portal is appended to a "Requests" tab.
     2. The client instantly gets a branded thank-you email.
     3. You get a new-request alert (CC sales support once armed below),
        with the filled Guardian census form attached as .xlsx.
     4. Daily 3:00 p.m. sweep: any request still marked "New" after 5
        Trinidad working days gets a follow-up reminder email, every
        working day, escalating after 7 chases.

   SET-UP (once):
     1. Open the branch sheet → Extensions → Apps Script.
     2. Delete whatever is in the editor, paste this whole file, hit Save.
     3. Run ▶ the function  setup  once. Google will ask you to authorise —
        Review permissions → choose your account → Advanced → Go to project
        → Allow. (It is your own script in your own sheet.)
     4. Deploy → New deployment → type: Web app →
        "Execute as: Me"  ·  "Who has access: Anyone" → Deploy.
     5. Copy the Web app URL it gives you and send it to Claude — it gets
        baked into the portal, then redeploy the site zip. Done.

   Project Settings (⚙ icon): set Time zone to (GMT-4) Port of Spain so the
   3 p.m. sweep runs at Trinidad 3 p.m.

   SHARING THE PROJECT WITH Benefits.gs: a script project can hold only one
   doGet and one doPost, and Benefits.gs owns them now — it routes anything
   that is not a benefits call back here. That is the only change in this
   file: doPost is named quoteDoPost_ and doGet is named quoteDoGet_.
   Everything the quote engine does is untouched.
   ========================================================================= */

// ── Switches ───────────────────────────────────────────────────────────────
// Branch sales support — copied on request alerts, enrollment alerts and the
// census email to Guardian. Blank = off. (Armed 4 Aug 2026.)
var CC_SALES_SUPPORT = 'rickyrampersadsalessupport@myguardiangroup.com';

// Where new-request alerts go. Blank = the Google account that owns this
// script (you). You can also put your Guardian address here.
var BRANCH_EMAIL = '';

// ── Census straight to Guardian (ARMED 4 Aug 2026 on Ricky's instruction) ──
// Every submission that includes a census emails it to these addresses
// immediately. To PAUSE (e.g. while testing): make GUARDIAN_CENSUS_TO = ''
// then Deploy → Manage deployments → New version.
var GUARDIAN_CENSUS_TO = 'EBCustomercare@myguardiangroup.com, gia.taskrequest@myguardiangroup.com';
var GUARDIAN_CENSUS_CC = 'ricardo.seereeram@myguardiangroup.com';

// When an AGENT enters a request on a client's behalf, the branch alert
// CCs that agent automatically (matched by the name recorded on the request).
var AGENT_EMAILS = {
  'ricky rampersad':      'ricky.rampersad@myguardiangroup.com',
  'narissa mohammed':     'narissa.mohammed@myguardiangroup.com',
  'kerwyn ramroach':      'kerwyn.ramroach@myguardiangroup.com',
  'premchand dookran':    'premchand.dookran@myguardiangroup.com',
  'javid ali':            'javid.ali@myguardiangroup.com',
  'aleema mohammed-ali':  'aleema.mohammed-ali@myguardiangroup.com',
  'akaash kalladeen':     'akaash.kalladeen@myguardiangroup.com',
  'joy barbara sammah':   'joy.sammah@myguardiangroup.com',
  'faizal mohammed':      'faizal.mohammed@myguardiangroup.com',
  'meera persad khan':    'meera.persad-khan@myguardiangroup.com',
  'petra chadee':         'pchadee@langeinsuranceandfinancial.com',
  'gary sookdeo':         'gary.sookdeo@myguardiangroup.com',
  'randolph gonzales':    'randolph.gonzales@myguardiangroup.com',
  'neil ramnanan':        'neil.ramnanan@myguardiangroup.com',
  'dhalina heeraman':     'dhalina.heeraman@myguardiangroup.com',
  'varun seegolam':       'varun.seegolam@myguardiangroup.com',
  'anthony simmons':      'anthony.simmons@myguardiangroup.com',
  'darryl manick':        'darryl.manick@myguardiangroup.com',
  'tricia baksh':         'tricia.baksh@myguardiangroup.com',
  'malcolm sooknanan':    'malcolm.sooknanan@myguardiangroup.com',
  'chris badaloo':        'chris.badaloo@myguardiangroup.com',
  'fawwaz mohamed':       'fawwaz.mohamed@myguardiangroup.com',
  'stephanie rajkumar':   'stephanie.rajkumar@myguardiangroup.com',
  'john boodhoo':         'john.boodhoo@myguardiangroup.com',
  'jamil khan':           'jamil.khan@myguardiangroup.com',
  'aidan eugene':         'aidan.eugene@myguardiangroup.com',
  'crystal fraser':       'crystalstephanie.fraser@myguardiangroup.com',
  'roberta laltoo':       'roberta.laltoo@myguardiangroup.com',
  'alyssa joseph':        'alyssa.joseph@myguardiangroup.com',
  'naila samuel':         'naila.samuel@myguardiangroup.com',
  'daniel bhagwandas':    'danielbhagwandas@gmail.com',
  'felicia rampersad':    'felicia.rampersad@myguardiangroup.com',
  'jesus boodhoo':        'jesus.boodhoo@myguardiangroup.com',
};
function agentEmail_(name) {
  return AGENT_EMAILS[String(name || '').trim().toLowerCase()] || '';
}

var SHEET_TAB = 'Requests';
var FEEDBACK_TAB = 'Feedback';
var ENROLL_TAB = 'Enrollments';
var BRAND = 'Ricky Rampersad Branch — Employee Benefits · Guardian Life';
var BRANCH_PHONE = '868-678-5821';

// ── Trinidad & Tobago working days ────────────────────────────────────────
var TT_HOLIDAYS = [
  // movable, update each January:
  '2026-02-16', '2026-02-17', '2026-03-20', '2026-04-03', '2026-04-06',
  '2026-06-04', '2026-11-08',
];
var TT_FIXED = [[1,1],[3,30],[5,30],[6,19],[8,1],[8,31],[9,24],[12,25],[12,26]];

function isWorkingDay_(d) {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (TT_FIXED.some(([m, dd]) => m === d.getMonth() + 1 && dd === d.getDate())) return false;
  const iso = Utilities.formatDate(d, 'America/Port_of_Spain', 'yyyy-MM-dd');
  return TT_HOLIDAYS.indexOf(iso) === -1;
}

function workingDaysBetween_(from, to) {
  let c = 0;
  const cur = new Date(from); cur.setHours(0, 0, 0, 0);
  const end = new Date(to);   end.setHours(0, 0, 0, 0);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    if (isWorkingDay_(cur)) c++;
  }
  return c;
}

// ── One-time setup ────────────────────────────────────────────────────────
function setup() {
  requestsTab_();
  feedbackTab_();
  enrollTab_();
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailySweep').timeBased().atHour(15).everyDays(1).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Requests + Feedback tabs ready, 3 p.m. daily sweep installed.', 'Branch engine', 8);
}

/** One daily trigger runs all the sweeps. */
function dailySweep() {
  dailyFollowUp();
  feedbackSweep();
  benefitsFollowUp();
  benefitsDunning();
}

function requestsTab_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_TAB);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TAB);
    const head = ['Received', 'Ref', 'Company', 'Contact', 'Email', 'Phone',
                  'Staff', 'Benefits requested', 'Pension structure', 'Status',
                  'Chasers sent', 'Last chased', 'Via', 'Notes'];
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#0B3C46').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, 1, 150); sh.setColumnWidth(2, 130); sh.setColumnWidth(3, 180);
    sh.setColumnWidth(8, 240); sh.setColumnWidth(14, 260);
  }
  return sh;
}

function feedbackTab_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(FEEDBACK_TAB);
  if (!sh) {
    sh = ss.insertSheet(FEEDBACK_TAB);
    const head = ['Received', 'Ref', 'Agent', 'Email', 'Type', 'Feedback',
                  'Status', 'Updates sent', 'Last emailed', 'Resolved on', 'Resolution note'];
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#F08A24').setFontColor('#04252C');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 160);
    sh.setColumnWidth(6, 320); sh.setColumnWidth(11, 260);
  }
  return sh;
}

function enrollTab_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ENROLL_TAB);
  if (!sh) {
    sh = ss.insertSheet(ENROLL_TAB);
    const head = ['Received', 'Ref', 'Company', 'Employee', 'Date of birth', 'Gender',
                  'Email', 'Address', 'Phones', 'Marital', 'Occupation', 'ID', 'Coverage', 'Extra',
                  'Other plan', 'Dependents', 'Beneficiaries', 'Tier', 'Annual salary',
                  'Date employed', 'Effective date', 'Plan admin', 'Signed form received', 'Status'];
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#0E8FA3').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150); sh.setColumnWidth(3, 170); sh.setColumnWidth(4, 170);
    sh.setColumnWidth(15, 280); sh.setColumnWidth(16, 280);
  }
  return sh;
}

// ── Employee enrollment (posted by /enroll.html) ──────────────────────────
function handleEnrollment_(d) {
  const sh = enrollTab_();
  const ref = d.ref || 'EN-' + Date.now();
  sh.appendRow([
    new Date(), ref, d.company || '', d.employee || '', d.dob || '', d.gender || '',
    d.email || '', d.address || '', d.phones || '', d.marital || '', d.occupation || '', d.idinfo || '',
    d.coverage || '', d.extra || '', d.otherPlan || '', d.dependents || '',
    d.beneficiaries || '', d.tier || '', d.salary || '', d.dateEmployed || '',
    d.dateEffective || '', d.planAdmin || '', 'No', 'New',
  ]);

  if (d.email && /@/.test(d.email)) {
    MailApp.sendEmail({
      to: d.email,
      subject: 'Enrollment received — ' + ref + (d.company ? ' (' + d.company + ')' : ''),
      htmlBody: shell_(
        '<p>Dear ' + (d.employee || 'member') + ',</p>' +
        '<p>Your enrollment in the <b>' + (d.coverage || 'Group') + '</b> plan' +
        (d.company ? ' of <b>' + d.company + '</b>' : '') + ' has been received. Your reference is <b>' + ref + '</b>.</p>' +
        '<p><b>One step remains:</b> sign the printed application form your plan administrator has, attach a copy of your ID' +
        (/Health/.test(d.coverage || '') ? ' (and complete the bank details for claim payments on the printed copy)' : '') +
        ', and hand it back to your administrator.</p>' +
        '<p>Welcome aboard,<br><b>Ricky Rampersad</b><br>Branch Manager · ' + BRANCH_PHONE + '</p>'
      ),
      name: BRAND,
    });
  }

  MailApp.sendEmail({
    to: BRANCH_EMAIL || Session.getEffectiveUser().getEmail(),
    cc: CC_SALES_SUPPORT || undefined,
    subject: '📋 New enrollment ' + ref + ' — ' + (d.employee || '') + (d.company ? ' @ ' + d.company : ''),
    htmlBody: shell_(
      '<p style="margin-top:0"><b>New employee enrollment</b> from the portal.</p>' +
      '<table style="font-size:13px;border-collapse:collapse">' +
      [['Reference', ref], ['Company', d.company], ['Employee', d.employee],
       ['DOB / Gender', (d.dob || '') + ' · ' + (d.gender || '')], ['Email', d.email],
       ['Coverage', (d.coverage || '') + (d.extra ? ' + ' + d.extra : '')],
       ['Tier', d.tier], ['Other plan', d.otherPlan],
       ['Dependents', d.dependents || '—'], ['Beneficiaries', d.beneficiaries || '—'],
       ['Effective', d.dateEffective], ['Plan admin', d.planAdmin]]
        .map(function (r) {
          return '<tr><td style="padding:4px 12px 4px 0;color:#68747f;white-space:nowrap;vertical-align:top">' + r[0] +
                 '</td><td style="padding:4px 0;font-weight:bold">' + (r[1] || '—') + '</td></tr>';
        }).join('') +
      '</table>' +
      '<p>Logged on the <b>Enrollments</b> tab. Chase the <b>signed printed form + ID copy</b> (and bank details for health claims), then flip “Signed form received” to Yes and send the pack to Guardian.</p>'
    ),
    name: 'Branch Portal',
  });
  return ContentService.createTextOutput('ok');
}

// ── Testing feedback (posted by the portal's 🧪 button) ───────────────────
function handleFeedback_(d) {
  const sh = feedbackTab_();
  const ref = d.ref || 'FB-' + Date.now();
  sh.appendRow([
    new Date(), ref, d.agent || 'Unnamed tester', d.email || '',
    d.category || '', d.message || '', 'Open', 0, '', '', '',
  ]);

  if (d.email && /@/.test(d.email)) {
    MailApp.sendEmail({
      to: d.email,
      subject: 'Thank you — feedback received (' + ref + ')',
      htmlBody: shell_(
        '<p>Hi ' + (d.agent || 'there') + ',</p>' +
        '<p><b>Thank you for testing the portal.</b> Your feedback is logged as <b>' + ref + '</b>:</p>' +
        '<p style="background:#f4f6f9;border-left:4px solid #F08A24;border-radius:6px;padding:10px 14px">' +
        (d.category ? '<b>' + d.category + '</b><br>' : '') + (d.message || '') + '</p>' +
        '<p>Every piece of feedback gets looked at personally. You\'ll get an update <b>every few days</b> until this is resolved — and a final note when it\'s fixed.</p>' +
        '<p>Keep it coming,<br><b>Ricky Rampersad</b><br>Branch Manager</p>'
      ),
      name: BRAND,
    });
  }

  MailApp.sendEmail({
    to: BRANCH_EMAIL || Session.getEffectiveUser().getEmail(),
    subject: '🧪 Portal feedback ' + ref + ' — ' + (d.category || 'General') + ' (' + (d.agent || 'Unnamed') + ')',
    htmlBody: shell_(
      '<p style="margin-top:0"><b>' + (d.agent || 'Unnamed tester') + '</b> (' + (d.email || 'no email') + ') says:</p>' +
      '<p style="background:#f4f6f9;border-left:4px solid #F08A24;border-radius:6px;padding:10px 14px">' +
      (d.category ? '<b>' + d.category + '</b><br>' : '') + (d.message || '') + '</p>' +
      '<p>Logged on the <b>Feedback</b> tab as <b>' + ref + '</b>. The tester is emailed every 3 days until you change Status to <b>Resolved</b> — add a “Resolution note” and they\'ll see it in their closing email.</p>'
    ),
    name: 'Branch Portal',
  });
  return ContentService.createTextOutput('ok');
}

/**
 * Runs daily at 3 p.m. (working days): testers with an Open item get an
 * update every 3 days; rows just marked Resolved get one closing email.
 */
function feedbackSweep() {
  if (!isWorkingDay_(new Date())) return;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FEEDBACK_TAB);
  if (!sh || sh.getLastRow() < 2) return;

  const rows = sh.getDataRange().getValues();
  const today = new Date();
  const DAY = 24 * 3600 * 1000;

  for (let i = 1; i < rows.length; i++) {
    const [ts, ref, agent, email, type, msg, status, updates, lastMail, resolvedOn, note] = rows[i];
    if (!email || !/@/.test(String(email))) continue;
    const closed = /resolv|closed|done|fixed/i.test(String(status));

    if (closed && !resolvedOn) {
      MailApp.sendEmail({
        to: String(email),
        subject: '✅ Resolved — your portal feedback ' + ref,
        htmlBody: shell_(
          '<p>Hi ' + agent + ',</p>' +
          '<p>Good news — the item you raised (<b>' + ref + '</b>' + (type ? ' · ' + type : '') + ') is <b>resolved</b>.</p>' +
          (note ? '<p style="background:#eef7ee;border-left:4px solid #3d8b4f;border-radius:6px;padding:10px 14px">' + note + '</p>' : '') +
          '<p>Thank you for making the portal better. Spot anything else? The 🧪 button is always there.</p>' +
          '<p><b>Ricky Rampersad</b><br>Branch Manager</p>'
        ),
        name: BRAND,
      });
      sh.getRange(i + 1, 10).setValue(new Date());
      continue;
    }

    if (!closed) {
      const last = (lastMail instanceof Date) ? lastMail : (ts instanceof Date ? ts : null);
      if (!last || (today - last) >= 3 * DAY) {
        const n = (Number(updates) || 0) + 1;
        MailApp.sendEmail({
          to: String(email),
          subject: 'Still on it — your portal feedback ' + ref,
          htmlBody: shell_(
            '<p>Hi ' + agent + ',</p>' +
            '<p>A quick update on <b>' + ref + '</b>' + (type ? ' (' + type + ')' : '') + ' — it\'s still <b>' + (status || 'Open') + '</b> and hasn\'t been forgotten. You\'ll hear from us the moment it\'s resolved.</p>' +
            '<p style="color:#68747f;font-size:13px">You raised: “' + String(msg).slice(0, 180) + (String(msg).length > 180 ? '…' : '') + '”</p>' +
            '<p><b>Ricky Rampersad</b><br>Branch Manager</p>'
          ),
          name: BRAND,
        });
        sh.getRange(i + 1, 8).setValue(n);
        sh.getRange(i + 1, 9).setValue(new Date());
      }
    }
  }
}

// ── The portal posts here ─────────────────────────────────────────────────
// (Benefits.gs owns the project's doPost and hands non-benefits traffic to
//  this function — renamed from doPost, otherwise untouched.)
function quoteDoPost_(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.kind === 'feedback') return handleFeedback_(d);
    if (d.kind === 'enrollment') return handleEnrollment_(d);
    const sh = requestsTab_();
    const ref = d.ref || 'RRB-' + Date.now();

    sh.appendRow([
      new Date(), ref, d.company || '', d.contact || '', d.email || '',
      d.phone || '', d.staff || '', (d.benefits || []).join(', '),
      d.structure || '', 'New', 0, '',
      (d.via || 'client') + (d.agentName ? ' · ' + d.agentName : ''), d.notes || '',
    ]);

    // 1) client thank-you
    if (d.email && /@/.test(d.email)) {
      MailApp.sendEmail({
        to: d.email,
        subject: 'We received your request — ' + ref,
        htmlBody: clientHtml_(d, ref),
        name: BRAND,
      });
    }

    // 2) branch alert, census attached
    const opts = {
      to: BRANCH_EMAIL || Session.getEffectiveUser().getEmail(),
      subject: 'New quote request ' + ref + (d.company ? ' — ' + d.company : ''),
      htmlBody: branchHtml_(d, ref),
      name: 'Branch Portal',
    };
    const ccList = [];
    if (CC_SALES_SUPPORT) ccList.push(CC_SALES_SUPPORT);
    const introducer = agentEmail_(d.agentName || d.enteredBy);
    if (introducer) ccList.push(introducer);
    if (ccList.length) opts.cc = ccList.join(',');
    let censusBlob = null;
    if (d.censusB64) {
      censusBlob = Utilities.newBlob(
        Utilities.base64Decode(d.censusB64),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ref + '-Guardian-census.xlsx'
      );
      opts.attachments = [censusBlob];
    }
    MailApp.sendEmail(opts);

    // 3) census straight to Guardian — EB Customer Care + GIA task request,
    //    CC the branch account officer. Fires only when a census was uploaded.
    if (censusBlob && GUARDIAN_CENSUS_TO) {
      const gCc = [];
      if (GUARDIAN_CENSUS_CC) gCc.push(GUARDIAN_CENSUS_CC);
      if (CC_SALES_SUPPORT) gCc.push(CC_SALES_SUPPORT);
      if (introducer) gCc.push(introducer);
      MailApp.sendEmail({
        to: GUARDIAN_CENSUS_TO,
        cc: gCc.length ? gCc.join(',') : undefined,
        subject: 'Group quotation request — census attached — ' +
                 (d.company || 'New group') + ' (' + ref + ')',
        htmlBody: guardianHtml_(d, ref),
        name: BRAND,
        attachments: [censusBlob],
      });
    }

    return ContentService.createTextOutput('ok');
  } catch (err) {
    // Log so a bad payload never disappears silently: see Executions panel.
    console.error(err);
    return ContentService.createTextOutput('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}

// Handy browser check: opening the web-app URL should show this line.
// (Renamed from doGet — Benefits.gs calls it when the URL has no action.)
function quoteDoGet_() {
  return ContentService.createTextOutput('Ricky Rampersad Branch engine is running.');
}

// ── Daily 3 p.m. sweep ────────────────────────────────────────────────────
function dailyFollowUp() {
  if (!isWorkingDay_(new Date())) return;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TAB);
  if (!sh || sh.getLastRow() < 2) return;

  const rows = sh.getDataRange().getValues();
  const today = new Date();
  const inbox = BRANCH_EMAIL || Session.getEffectiveUser().getEmail();

  for (let i = 1; i < rows.length; i++) {
    const [ts, ref, company, contact, , , , benefits, , status, chasers] = rows[i];
    if (String(status).trim().toLowerCase() !== 'new') continue;
    if (!(ts instanceof Date)) continue;
    if (workingDaysBetween_(ts, today) < 5) continue;

    const n = (Number(chasers) || 0) + 1;
    const escalate = n > 7;
    MailApp.sendEmail({
      to: inbox,
      subject: (escalate ? '🔴 ESCALATION: ' : '⏰ Follow up: ') + ref +
               (company ? ' — ' + company : '') + ' (' + n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th') + ' chase)',
      htmlBody:
        '<div style="font-family:Georgia,serif;max-width:560px">' +
        '<p><b>' + ref + '</b>' + (company ? ' · ' + company : '') +
        (contact ? ' · ' + contact : '') + '</p>' +
        '<p>Requested: ' + (benefits || '—') + '</p>' +
        '<p>This request has had no response for 5+ working days. ' +
        (escalate
          ? 'It has now been chased ' + (n - 1) + ' times — treat as escalated to the Branch Manager.'
          : 'Reminder ' + n + ' of 7 before escalation.') + '</p>' +
        '<p style="color:#666">Mark the Status column anything other than “New” (e.g. Quoted, In review) to stop these chasers.</p>' +
        '</div>',
      name: 'Branch Portal',
    });
    sh.getRange(i + 1, 11).setValue(n);
    sh.getRange(i + 1, 12).setValue(new Date());
  }
}

// ── Email templates ───────────────────────────────────────────────────────
function shell_(inner) {
  return (
    '<div style="background:#f4f5f7;padding:24px 12px;font-family:Georgia,\'Times New Roman\',serif;color:#1c2733">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e3e6ea">' +
    '<div style="background:#0B3C46;color:#fff;padding:18px 26px">' +
    '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#E07E14">Ricky Rampersad Branch</div>' +
    '<div style="font-size:17px;font-weight:bold;margin-top:2px">Employee Benefits · Guardian Life</div>' +
    '</div>' +
    '<div style="padding:24px 26px;font-size:15px;line-height:1.65">' + inner + '</div>' +
    '<div style="padding:14px 26px;border-top:1px solid #e3e6ea;font-size:12px;color:#68747f">' +
    'Ricky Rampersad Branch · Chaguanas · ' + BRANCH_PHONE +
    '</div></div></div>'
  );
}

function guardianHtml_(d, ref) {
  return shell_(
    '<p>Good day,</p>' +
    '<p>Please find attached the completed <b>Census Data Form</b> for a group quotation:</p>' +
    '<table style="font-size:14px;border-collapse:collapse">' +
    '<tr><td style="padding:4px 12px 4px 0;color:#68747f">Company</td><td style="font-weight:bold">' + (d.company || '—') + '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#68747f">Employees</td><td style="font-weight:bold">' + (d.staff || '—') + '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#68747f">Benefits requested</td><td style="font-weight:bold">' + ((d.benefits || []).join(', ') || '—') + '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#68747f">Branch reference</td><td style="font-weight:bold">' + ref + '</td></tr>' +
    '</table>' +
    '<p>Introducing branch: <b>Ricky Rampersad Branch, Chaguanas</b> — Ricky Rampersad, Branch Manager, ' + BRANCH_PHONE + '.</p>' +
    '<p>Kindly acknowledge receipt and revert with the proposal at your earliest convenience.</p>' +
    '<p>Warm regards,<br><b>Ricky Rampersad</b><br>Branch Manager</p>'
  );
}

function clientHtml_(d, ref) {
  return shell_(
    '<p>Dear ' + (d.contact || 'valued client') + ',</p>' +
    '<p>Thank you for your employee-benefits enquiry' +
    (d.company ? ' for <b>' + d.company + '</b>' : '') + '. Your reference is</p>' +
    '<p style="text-align:center;margin:18px 0"><span style="display:inline-block;background:#FDF3E3;border:1px solid #E07E14;border-radius:8px;padding:10px 22px;font-size:18px;font-weight:bold;letter-spacing:.06em">' + ref + '</span></p>' +
    '<p>What happens next:</p>' +
    '<ol style="padding-left:20px">' +
    '<li>Our benefits team reviews your requirements' + (d.staff ? ' for your ' + d.staff + ' employees' : '') + '.</li>' +
    '<li>We prepare quotations on: <b>' + ((d.benefits || []).join(', ') || 'your selected benefits') + '</b>.</li>' +
    '<li>Your advisor presents the options and answers every question — no obligation.</li>' +
    '</ol>' +
    '<p>We aim to respond within <b>5 working days</b>. If anything changes in the meantime, simply reply to this email or call ' + BRANCH_PHONE + ' and quote your reference.</p>' +
    '<p>Warm regards,<br><b>Ricky Rampersad</b><br>Branch Manager</p>'
  );
}

function branchHtml_(d, ref) {
  const row = (k, v) =>
    '<tr><td style="padding:5px 12px 5px 0;color:#68747f;white-space:nowrap;vertical-align:top">' + k + '</td>' +
    '<td style="padding:5px 0;font-weight:bold">' + (v || '—') + '</td></tr>';
  return shell_(
    '<p style="margin-top:0"><b>New quote request</b> just landed on the portal.</p>' +
    '<table style="font-size:14px;border-collapse:collapse">' +
    row('Reference', ref) +
    row('Company', d.company) +
    row('Contact', d.contact) +
    row('Email', d.email) +
    row('Phone', d.phone) +
    row('Employees', d.staff) +
    row('Benefits', (d.benefits || []).join(', ')) +
    row('Pension structure', d.structure) +
    row('Came in via', d.via === 'agent' ? 'Agent (' + (d.enteredBy || '') + ')' : 'Client direct') +
    row('Notes', d.notes) +
    '</table>' +
    (d.censusB64
      ? '<p style="background:#eef4ee;border:1px solid #bcd6bc;border-radius:8px;padding:10px 14px">📎 The filled <b>Guardian census form</b> is attached — review it before it goes to EBCustomercare.</p>'
      : '<p style="color:#68747f">No census was uploaded with this request.</p>') +
    '<p>It is logged on the <b>Requests</b> tab of the branch sheet. Mark Status once picked up — chasers start after 5 working days.</p>'
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   PART TWO — EMPLOYEE BENEFITS BACKEND
   (doGet/doPost live below and route quote traffic to the engine above.)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ============================================================
 *  EMPLOYEE BENEFITS — branch backend
 *  Ricky Rampersad Branch · rickyrampersadbranch.com/benefits/
 * ============================================================
 *
 *  The pages under /benefits/ run entirely in the browser until this
 *  script is deployed; then they become a real multi-machine system:
 *
 *    pendings.html   reads the Pendings tab, saves "what is outstanding"
 *    upload.html     staff submit a month for review (documents attached)
 *    review.html     an administrator verifies; APPROVAL IS WHAT SENDS
 *
 *  ── DEPLOY (once, ~5 minutes) ────────────────────────────────────────
 *  1. Open the branch Google Sheet (the one with the Administrators tab).
 *  2. Extensions → Apps Script → paste this file in as Benefits.gs.
 *  3. Run benefitsSetup() once from the editor (authorise when asked).
 *     It creates any missing tabs and default properties, and touches
 *     nothing you already have.
 *  4. Deploy → New deployment → Web app:
 *        Execute as: Me        Who has access: Anyone
 *     Copy the /exec URL.
 *  5. Paste that URL into `const API = ""` near the top of the script in
 *     THREE files: benefits/pendings.html, benefits/upload.html,
 *     benefits/review.html. Commit, push, merge to main — Netlify ships it.
 *
 *  ── SHARING THE PROJECT WITH THE QUOTE ENGINE (Code.gs) ─────────────
 *  This file owns doGet/doPost and passes non-benefits traffic through to
 *  the quote engine. Code.gs must therefore rename two functions:
 *      function doPost(e)  →  function quoteDoPost_(e)
 *      function doGet()    →  function quoteDoGet_()
 *  Nothing else in Code.gs changes. The quote portal's EXISTING deployed
 *  URL keeps working regardless — deployments are pinned to the version
 *  they were made from — and after the rename, one new URL serves both.
 *
 *  ── SAFETY ───────────────────────────────────────────────────────────
 *  TEST MODE IS ON BY DEFAULT: approvals email BEN_NOTIFY (you), never
 *  the client, until you set BEN_TEST_MODE to "off" in Script Properties.
 *
 *  Every request carries an auth code and this script checks it here,
 *  server-side, against the Administrators tab — the browser gate is a
 *  door, this is the lock:
 *      administrators  = codes in the Administrators tab, or BEN_ADMIN_CODE
 *      staff           = BEN_STAFF_CODE (the assistant), or any administrator
 *  Whoever submitted a month cannot approve it — enforced here too, not
 *  only in the page.
 *
 *  ── TABS (benefitsSetup creates the missing ones) ────────────────────
 *  Administrators : Code | Name | Role            ← you maintain this
 *  Groups         : Group ID | Group Name | Lines | Billing Email | Portal Code
 *  Pendings       : Id | Account | Source Name | Member | Line | Policy |
 *                   Issued | Note | Note By | Note At
 *  Submissions    : Id | Group ID | Group Name | Month Key | Month | State |
 *                   Updated | JSON                ← the flow store
 *  Billing        : Group ID | Month | Line | Invoice | Billed | Paid |
 *                   Paid On | Method | Receipt | Note   ← feeds client History
 *  BenefitsActivity : At | By | Code | Did | Group | Month | Note
 *
 *  Uploaded documents are filed in Drive under
 *  Benefits Billing / <group> / <month> and attached to the email the
 *  approval sends.
 */

var BEN = {
  ADMINS_SHEET:   'Administrators',
  GROUPS_SHEET:   'Groups',
  PENDINGS_SHEET: 'Pendings',
  SUBS_SHEET:     'Submissions',
  BILLING_SHEET:  'Billing',
  ACTIVITY_SHEET: 'BenefitsActivity',
  TERMS_SHEET:    'Terminations',
  DRIVE_ROOT:     'Benefits Billing',
  FROM_NAME:      'Ricky Rampersad Branch — Employee Benefits'
};

/* ============================ setup ============================ */

function benefitsSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var want = {};
  want[BEN.ADMINS_SHEET]   = ['Code', 'Name', 'Role'];
  want[BEN.PENDINGS_SHEET] = ['Id', 'Account', 'Source Name', 'Member', 'Line', 'Policy', 'Issued', 'Note', 'Note By', 'Note At'];
  want[BEN.SUBS_SHEET]     = ['Id', 'Group ID', 'Group Name', 'Month Key', 'Month', 'State', 'Updated', 'JSON'];
  want[BEN.BILLING_SHEET]  = ['Group ID', 'Month', 'Line', 'Invoice', 'Billed', 'Paid', 'Paid On', 'Method', 'Receipt', 'Note'];
  want[BEN.ACTIVITY_SHEET] = ['At', 'By', 'Code', 'Did', 'Group', 'Month', 'Note'];
  want[BEN.TERMS_SHEET]    = ['Id', 'Group', 'Member', 'Line', 'Last Day', 'Reason',
                              'Reported By', 'Reported At', 'State', 'Sent At',
                              'Actioned At', 'Settled At', 'Note'];
  Object.keys(want).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (name === BEN.ADMINS_SHEET && !sh) {
      /* The branch may already keep its people on a tab of its own naming
         (Access); creating an empty Administrators tab beside it would be
         the one the resolver must then ignore. Skip if any qualifies. */
      try { if (badminsSheet_()) return; } catch (e) {}
    }
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, want[name].length).setValues([want[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('BEN_ADMIN_CODE')) p.setProperty('BEN_ADMIN_CODE', 'RRB-ADMIN-2026');
  if (!p.getProperty('BEN_STAFF_CODE')) p.setProperty('BEN_STAFF_CODE', 'RRB2026');
  if (!p.getProperty('BEN_TEST_MODE'))  p.setProperty('BEN_TEST_MODE', 'on');
  if (!p.getProperty('BEN_NOTIFY'))     p.setProperty('BEN_NOTIFY', Session.getEffectiveUser().getEmail());
  /* Who verifies. Submissions are emailed to the approver with the review
     link, with the branch manager copied. Blank = the manager reviews. */
  if (!p.getProperty('BEN_APPROVER_EMAIL')) p.setProperty('BEN_APPROVER_EMAIL', '');
  if (!p.getProperty('BEN_SITE')) p.setProperty('BEN_SITE', 'https://rickyrampersadbranch.com/benefits/');
  /* Pending applications and terminations are visible to the branch at once
     and to employers only when this says "on" — see benGroupView_ for why
     that switch exists rather than being on by default. */
  if (!p.getProperty('BEN_CLIENT_PENDING')) p.setProperty('BEN_CLIENT_PENDING', 'off');
}

/* ============================ plumbing ============================ */

function bss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function bsheet_(name) {
  var sh = bss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '" — run benefitsSetup() once.');
  return sh;
}
function bprop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function bjson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function bok_(o) { o = o || {}; o.ok = true; return bjson_(o); }
function berr_(msg) { return bjson_({ ok: false, error: msg }); }

/* Read a tab as objects keyed by lower-cased header words, so the
   Administrators tab you already made matches whether its column says
   Code, AGENT CODE or Agent #. */
function brows_(sh) {
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0].map(function (h) { return String(h).toLowerCase(); });
  return v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, c) { o[h] = r[c]; });
    return o;
  });
}
function bfield_(o, names) {
  var keys = Object.keys(o);
  for (var i = 0; i < names.length; i++) {
    for (var k = 0; k < keys.length; k++) {
      if (keys[k].indexOf(names[i]) !== -1) return o[keys[k]];
    }
  }
  return '';
}

/* ── who is asking ── */

/* The branch keeps its people on the tab IT named — Access — while the
   original setup had created an empty Administrators tab beside it. Reading
   the empty one would lock every real administrator out, so resolve to
   whichever admin-looking tab actually holds people. Recognised names:
   Administrators, Admins, Access (and the odd spelling). BEN_ADMINS_TAB in
   Script Properties overrides everything if the branch renames again. */
function badminsSheet_() {
  var ss = bss_();
  var override = bprop_('BEN_ADMINS_TAB');
  if (override) {
    var o = ss.getSheetByName(override);
    if (o) return o;
  }
  var ok = { administrators:1, administrator:1, admins:1, admin:1, access:1, acess:1, accesstab:1 };
  var cands = ss.getSheets().filter(function (sh) {
    return ok[String(sh.getName()).toLowerCase().replace(/[^a-z]/g, '')] === 1;
  });
  if (!cands.length) throw new Error('No Administrators or Access tab found — run benefitsSetup() once.');
  var withPeople = cands.filter(function (sh) { return sh.getLastRow() > 1; });
  return withPeople[0] || cands[0];
}

/* One Access tab holds everyone: branch people AND each client company's
   plan administrator. Company decides which doors a row opens — Guardian
   Life rows are the branch; every other company is a client whose login
   reaches their own billing and nothing else. A client administrator must
   never pass as a branch administrator. */
function bIsBranch_(r) {
  return /guardian/i.test(String(bfield_(r, ['company'])));
}
function bActive_(r) {
  return !/inactive|disabled|^no$|^off$/i.test(String(bfield_(r, ['active'])).trim());
}
function bLoginOf_(r) {
  return String(bfield_(r, ['login', 'log in', 'code', 'agent', 'number'])).trim().toUpperCase();
}
function bClientRows_(company) {
  var want = String(company || '').trim().toUpperCase();
  return brows_(badminsSheet_()).filter(function (r) {
    return bActive_(r) && !bIsBranch_(r) &&
           String(bfield_(r, ['company'])).trim().toUpperCase() === want;
  });
}

function badmin_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  if (code === bprop_('BEN_ADMIN_CODE').toUpperCase()) return { name: 'Branch admin code', code: code };
  var hit = brows_(badminsSheet_()).filter(function (r) {
    return bActive_(r) && bIsBranch_(r) && bLoginOf_(r) === code;
  })[0];
  return hit ? { name: String(bfield_(hit, ['name'])).trim() || code, code: code } : null;
}
function bstaff_(code) {
  code = String(code || '').trim().toUpperCase();
  if (code && code === bprop_('BEN_STAFF_CODE').toUpperCase()) return { name: 'Branch staff', code: code };
  return badmin_(code);
}

/* Portal sign-in against the Administrators tab — agent number AND the
   password column the branch maintains there. POST only, so the password
   never sits in a URL. If the tab has no password column, this refuses
   rather than quietly accepting a number alone. */
function benSignin_(b) {
  var sh = badminsSheet_();
  var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
    .map(function (h) { return String(h).toLowerCase(); });
  var hasPw = head.some(function (h) { return h.indexOf('pass') !== -1 || h === 'pw'; });
  if (!hasPw) return berr_('The Administrators tab has no Password column — add one, or sign in with the branch code.');
  var code = String(b.code || '').trim().toUpperCase();
  var pw   = String(b.password || '');
  /* The login column is whatever the branch calls it — LogIn on the Access
     tab — so resolve it the same way every other lookup does rather than
     hunting for a "Code" header that does not exist. Passwords typed as
     numbers come back as numbers, so compare as text both ways. */
  var hit = brows_(sh).filter(function (r) {
    return bLoginOf_(r) === code &&
           String(bfield_(r, ['password', 'pass', 'pw'])).trim() === pw && pw !== '';
  })[0];
  if (!hit) return berr_('Not on the access list — check the login and password.');
  if (!bActive_(hit)) return berr_('This login has been deactivated — speak to the branch.');
  var name = String(bfield_(hit, ['name'])).trim() || code;
  var roleTxt = String(bfield_(hit, ['role', 'title', 'position'])).trim() || 'Administrator';

  /* A client company's administrator signs in to see their own billing —
     nothing of the branch, nothing of anyone else's. Their months come back
     with the sign-in so the employer portal needs exactly one call. */
  if (!bIsBranch_(hit)) {
    var company = String(bfield_(hit, ['company'])).trim();
    blog_(name, code, 'SIGNIN', company, '', roleTxt + ' (client)');
    return bok_({ role: 'client', name: name, company: company, title: roleTxt,
                  rows: bBillingRowsFor_(company) });
  }

  /* Branch rows: the Role column decides — agents get the agent view, and
     managers, the BMA and sales support get the administrator doors. Every
     sign-in lands on the activity tab under the person's own name. */
  var isAgent = /agent|advisor/i.test(roleTxt) && !/manager|admin|assist|support|branch/i.test(roleTxt);
  blog_(name, code, 'SIGNIN', '', '', roleTxt);
  return bok_({ name: name, role: isAgent ? 'agent' : 'manager', title: roleTxt });
}

function bBillingRowsFor_(company) {
  var want = String(company || '').trim().toUpperCase();
  return brows_(bsheet_(BEN.BILLING_SHEET)).filter(function (r) {
    return String(bfield_(r, ['group id', 'groupid'])).trim().toUpperCase() === want;
  }).map(function (r) {
    return {
      month:   String(bfield_(r, ['month'])),
      line:    String(bfield_(r, ['line'])),
      invoice: String(bfield_(r, ['invoice'])),
      billed:  Number(bfield_(r, ['billed'])) || 0,
      paid:    Number(bfield_(r, ['paid'])) || 0,
      paidOn:  bdate_(bfield_(r, ['paid on', 'paidon'])),
      method:  String(bfield_(r, ['method'])),
      receipt: String(bfield_(r, ['receipt'])),
      note:    String(bfield_(r, ['note']))
    };
  });
}

function blog_(by, code, did, group, month, note) {
  bsheet_(BEN.ACTIVITY_SHEET).appendRow([new Date(), by || '', code || '', did || '', group || '', month || '', note || '']);
}

/* ============================ routing ============================

   This project also holds Code.gs, the quote-request engine, and a script
   project can only have ONE doGet and ONE doPost — two files defining them
   fight, and whichever loads last silently wins. So this file owns the two
   entry points and hands anything that is not a benefits call through to
   the quote engine, whose own entry points are renamed quoteDoPost_ /
   quoteDoGet_. One deployed URL then serves both engines: benefits traffic
   carries an `action`, everything else is a quote, enrollment or feedback
   posting exactly as before. */

function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) || '';
    if (a === 'pendings')  return benPendings_(e.parameter);
    if (a === 'monthflow') return benMonthflow_(e.parameter);
    if (a === 'billing')   return benBilling_(e.parameter);
    if (a === 'groups')    return benGroups_(e.parameter);
    if (a === 'roster')    return benRoster_(e.parameter);
    if (a === 'groupview') return benGroupView_(e.parameter);
    if (a === 'terminations') return benTerminations_(e.parameter);
    if (a === 'ack')       return benAck_(e.parameter);
    if (a === 'rate')      return benRate_(e.parameter);
    if (!a) {
      if (typeof quoteDoGet_ === 'function') return quoteDoGet_();
      return ContentService.createTextOutput('Ricky Rampersad Branch engine is running.');
    }
    return berr_('Unknown action.');
  } catch (err) { return berr_(String(err && err.message || err)); }
}

function doPost(e) {
  try {
    /* A client replying from the billing email posts a plain HTML form —
       top-level navigation, not fetch, so there is no CORS to negotiate and
       nothing for them to sign in to. It arrives as parameters, not JSON, so
       it has to be read before the JSON parse below. */
    if (e && e.parameter && e.parameter.action === 'clientreply') {
      /* Several boxes ticked arrive on e.parameters, where every field is an
         array; e.parameter keeps only the first, which would silently drop
         all but one reason. Read the reasons from the array form. */
      var form = { action: 'clientreply', id: e.parameter.id, verdict: e.parameter.verdict,
                   note: e.parameter.note,
                   reason: (e.parameters && e.parameters.reason) || e.parameter.reason };
      return benClientReply_(form);
    }
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (b.action === 'signin')       return benSignin_(b);
    if (b.action === 'pendingnote')  return benPendingNote_(b);
    if (b.action === 'submitmonth')  return benSubmitMonth_(b);
    if (b.action === 'reviewmonth')  return benReviewMonth_(b);
    if (b.action === 'sendmonth')    return benSendMonth_(b);
    /* The employer portal posts this one: a client's password must never
       ride in a URL, where it lands in every proxy and history list. */
    if (b.action === 'groupview')    return benGroupView_(b);
    if (b.action === 'terminations') return benTerminations_(b);
    if (b.action === 'reportleaver') return benReportTermination_(b);
    if (b.action === 'leaversent')   return benTerminationSent_(b);
    if (typeof quoteDoPost_ === 'function') return quoteDoPost_(e);
    return berr_('Unknown action.');
  } catch (err) { return berr_(String(err && err.message || err)); }
}

/* ============================ pendings ============================ */

function benPendings_(p) {
  if (!badmin_(p.auth)) return berr_('Administrators only.');
  var rows = brows_(bsheet_(BEN.PENDINGS_SHEET)).map(function (r) {
    return {
      id:        String(bfield_(r, ['id'])),
      account:   String(bfield_(r, ['account'])),
      sourceName:String(bfield_(r, ['source'])) || null,
      member:    String(bfield_(r, ['member'])),
      line:      String(bfield_(r, ['line'])),
      policy:    String(bfield_(r, ['policy'])),
      issued:    bdate_(bfield_(r, ['issued'])),
      note:      String(bfield_(r, ['note']) || ''),
      noteBy:    String(bfield_(r, ['note by', 'noteby']) || ''),
      noteAt:    String(bfield_(r, ['note at', 'noteat']) || '')
    };
  });
  return bok_({ rows: rows });
}

function bdate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

function benPendingNote_(b) {
  var who = badmin_(b.auth);
  if (!who) return berr_('Administrators only.');
  var sh = bsheet_(BEN.PENDINGS_SHEET);
  var rows = brows_(sh);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).toLowerCase(); });
  var col = function (part) {
    for (var i = 0; i < head.length; i++) if (head[i].indexOf(part) !== -1) return i + 1;
    return 0;
  };
  var hit = rows.filter(function (r) { return String(bfield_(r, ['id'])) === String(b.id); })[0];
  if (!hit) return berr_('No pending row with that id.');
  var byName = (who.name === 'Branch admin code' && b.by) ? String(b.by) : who.name;
  if (col('note'))    sh.getRange(hit._row, col('note')).setValue(String(b.text || ''));
  if (col('note by')) sh.getRange(hit._row, col('note by')).setValue(byName);
  if (col('note at')) sh.getRange(hit._row, col('note at')).setValue(new Date());
  blog_(byName, who.code, 'PENDING NOTE', String(bfield_(hit, ['account'])), '', String(b.text || ''));
  return bok_();
}

/* ============================ the month flow ============================ */

function bsubs_() {
  return brows_(bsheet_(BEN.SUBS_SHEET)).map(function (r) {
    try { var o = JSON.parse(String(bfield_(r, ['json'])) || 'null'); }
    catch (e) { o = null; }
    if (o) o._row = r._row;
    return o;
  }).filter(function (x) { return !!x; });
}

function benMonthflow_(p) {
  if (!bstaff_(p.auth)) return berr_('Staff or administrators only.');
  var subs = bsubs_().map(function (s) { delete s._row; delete s._fileIds; return s; });
  if (p.group) subs = subs.filter(function (s) { return s.group && s.group.id === p.group; });
  return bok_({ subs: subs });
}

function benSubmitMonth_(b) {
  var who = bstaff_(b.auth);
  if (!who) return berr_('Staff or administrators only.');
  var sub = b.sub;
  if (!sub || !sub.id || !sub.group || !sub.monthKey) return berr_('That submission is incomplete.');

  /* file the documents in Drive so approval can attach them */
  sub._fileIds = [];
  (b.files || []).forEach(function (f) {
    if (!f || !f.b64 || !f.name) return;
    var blob = Utilities.newBlob(Utilities.base64Decode(f.b64), f.type || 'application/pdf', f.name);
    var folder = bfolder_(sub.group.name, sub.monthKey);
    sub._fileIds.push(folder.createFile(blob).getId());
  });

  var sh = bsheet_(BEN.SUBS_SHEET);
  /* a resubmission replaces what is open for that group and month */
  bsubs_().forEach(function (s) {
    if (s.group.id === sub.group.id && s.monthKey === sub.monthKey &&
        (s.state === 'SUBMITTED' || s.state === 'RETURNED')) {
      sh.deleteRow(s._row);
      if (!sub._fileIds.length && s._fileIds) sub._fileIds = s._fileIds;
    }
  });
  sh.appendRow([sub.id, sub.group.id, sub.group.name, sub.monthKey, sub.monthLabel,
                sub.state, new Date(), JSON.stringify(sub)]);
  var ev = sub.events && sub.events[sub.events.length - 1];
  blog_(ev ? ev.by : who.name, who.code, 'SUBMITTED', sub.group.name, sub.monthLabel, '');

  /* The month-end found members Guardian has terminated whose cover our own
     record still shows in force, and staff answered that they would put it
     through. That answer is a promise; this is what makes it a tracked one,
     so it gets chased rather than remembered. */
  try {
    var owed = (sub.stuckLeavers || []).filter(function (n) { return !!n; });
    if (owed.length) benReportTermination_({
      auth: b.auth, by: ev ? ev.by : who.name, group: sub.group.id,
      members: owed.map(function (n) { return { name: n, line: 'life' }; }),
      lastDay: sub.leaverLastDay || bdate_(new Date()),
      reason: 'Terminated by Guardian on the ' + sub.monthLabel + ' statement',
      note: 'Raised by the month-end: our record still showed the cover in force.'
    });
  } catch (termErr) {}

  /* The approver hears about it the moment it lands — no chasing staff for
     links. The branch manager is copied so nothing waits unseen. */
  var notified = '';
  try {
    var approver = bprop_('BEN_APPROVER_EMAIL') || bprop_('BEN_NOTIFY');
    if (approver) {
      var ccMgr = bprop_('BEN_NOTIFY');
      var link = bprop_('BEN_SITE') + 'review.html#' + sub.id;
      var total = 0;
      Object.keys(sub.lineTotals || {}).forEach(function (k) { total += sub.lineTotals[k]; });
      MailApp.sendEmail({
        to: approver,
        cc: (ccMgr && ccMgr !== approver) ? ccMgr : undefined,
        name: BEN.FROM_NAME,
        subject: 'For review: ' + sub.group.name + ' — ' + sub.monthLabel,
        body: (ev ? ev.by : who.name) + ' submitted ' + sub.group.name + ' for ' + sub.monthLabel + '.\n\n'
          + 'This month: TT$' + total.toFixed(2)
          + (sub.arrears && sub.arrears.balance ? '\nPayable balance incl. arrears: TT$' + Number(sub.arrears.balance).toFixed(2) : '')
          + '\n\nReview and decide here (sign in as an administrator):\n' + link
          + '\n\nApproving sends it to the client; returning it sends it back to staff with your reason.'
      });
      notified = approver;
    }
  } catch (mailErr) {}
  return bok_({ id: sub.id, notified: notified });
}

function benReviewMonth_(b) {
  var who = badmin_(b.auth);
  if (!who) return berr_('Administrators only.');
  var byName = (who.name === 'Branch admin code' && b.by) ? String(b.by) : who.name;
  var sub = bsubs_().filter(function (s) { return s.id === String(b.id); })[0];
  if (!sub) return berr_('No submission with that id.');
  if (sub.state !== 'SUBMITTED') return berr_('That month is not waiting for review.');

  /* the server, not the page, is where this rule holds */
  var first = sub.events && sub.events[0] || {};
  if ((first.code && String(first.code).toUpperCase() === who.code) ||
      (first.by && first.by === byName)) {
    return berr_('You submitted this month, so another administrator has to approve it.');
  }

  var now = Date.now();
  if (b.decision === 'approve') {
    /* Approval clears the month; it does not send it. The last hand on a
       billing before a client sees it is the assistant who built it — she
       reads the approver's notes, satisfies herself nothing changed under
       her, and presses send. An approver who could send would be signing
       off and posting in one motion, with nobody left to catch a document
       swapped between the two. */
    sub.state = 'APPROVED';
    sub.events.push({ at: now, by: byName, code: who.code, did: 'APPROVED',
                      note: b.note ? String(b.note) : '' });
    bwrite_(sub);
    blog_(byName, who.code, 'APPROVED', sub.group.name, sub.monthLabel,
          b.note ? String(b.note) : 'cleared to send');
    var back = '';
    try {
      var staffEmail = bSubmitterEmail_(sub);
      if (staffEmail) {
        MailApp.sendEmail({
          to: staffEmail,
          cc: bprop_('BEN_NOTIFY') || undefined,
          name: BEN.FROM_NAME,
          subject: 'Cleared to send: ' + sub.group.name + ' — ' + sub.monthLabel,
          body: byName + ' has approved ' + sub.group.name + ' for ' + sub.monthLabel + '.\n\n'
            + (b.note ? 'Their note:\n' + String(b.note) + '\n\n' : '')
            + 'It is back with you. Open the month, read the note, check nothing has moved, '
            + 'and press Send — that is what puts it in front of the client.\n\n'
            + bprop_('BEN_SITE') + 'upload.html'
        });
        back = staffEmail;
      }
    } catch (mailErr) {}
    return bok_({ state: 'APPROVED', backTo: back });
  }
  if (b.decision === 'return') {
    if (!b.note) return berr_('Returning it needs a reason.');
    sub.state = 'RETURNED';
    sub.events.push({ at: now, by: byName, code: who.code, did: 'RETURNED', note: String(b.note) });
    bwrite_(sub);
    blog_(byName, who.code, 'RETURNED', sub.group.name, sub.monthLabel, String(b.note));
    return bok_();
  }
  return berr_('Decision must be approve or return.');
}

/* The email address of whoever submitted a month, read off the Access tab by
   their login code — so "back to staff" reaches the person who built it and
   not a branch-wide alias. */
function bSubmitterEmail_(sub) {
  var first = (sub.events || [])[0] || {};
  var code = String(first.code || '').toUpperCase();
  var name = String(first.by || '');
  var hit = null;
  brows_(badminsSheet_()).forEach(function (r) {
    if (hit) return;
    if (!bActive_(r)) return;
    var login = String(bLoginOf_(r) || '').toUpperCase();
    if ((code && login === code) || (!code && name && String(bfield_(r, ['name'])) === name)) hit = r;
  });
  return hit ? String(bfield_(hit, ['email'])).trim() : '';
}

/* Staff press send. The month must have been approved by somebody else
   first — the page hides the button, and this is the lock behind it. */
function benSendMonth_(b) {
  var who = bstaff_(b.auth);
  if (!who) return berr_('Staff or administrators only.');
  var sub = bsubs_().filter(function (s) { return s.id === String(b.id); })[0];
  if (!sub) return berr_('No submission with that id.');
  if (sub.state === 'SENT') return berr_('That month has already gone out.');
  if (sub.state !== 'APPROVED') return berr_('That month has not been approved yet, so it cannot be sent.');

  var byName = (who.name === 'Branch admin code' && b.by) ? String(b.by) : who.name;
  var sent = bsendMonth_(sub);
  sub.state = 'SENT';
  sub.events.push({ at: Date.now(), by: byName, code: who.code, did: 'SENT', note: sent.note });
  bwrite_(sub);
  blog_(byName, who.code, 'SENT', sub.group.name, sub.monthLabel, sent.note);
  bbillingRows_(sub);
  /* The statement of adjustments credited these members back, which is the
     billing itself saying the cover ended and the money came off. That is
     the only stage of a termination the employer actually feels. */
  var settled = 0;
  try { settled = bTermSettle_(sub.group.id, sub.adjItems || []); } catch (e) {}
  return bok_({ sent: sent.sent, testMode: sent.testMode, note: sent.note, settled: settled });
}

function bwrite_(sub) {
  var sh = bsheet_(BEN.SUBS_SHEET);
  var row = sub._row; delete sub._row;
  var line = [sub.id, sub.group.id, sub.group.name, sub.monthKey, sub.monthLabel,
              sub.state, new Date(), JSON.stringify(sub)];
  if (row) sh.getRange(row, 1, 1, line.length).setValues([line]);
  else sh.appendRow(line);
}

/* Approval writes the month into the Billing tab — one row per line — so
   the client's History view has a record the branch maintains payment
   against. Paid columns stay empty until someone fills them. */
function bbillingRows_(sub) {
  var sh = bsheet_(BEN.BILLING_SHEET);
  Object.keys(sub.lineTotals || {}).forEach(function (label) {
    sh.appendRow([sub.group.id, sub.monthLabel, label, '', sub.lineTotals[label], '', '', '', '', '']);
  });
}

function bfolder_(groupName, monthKey) {
  var root = DriveApp.getFoldersByName(BEN.DRIVE_ROOT);
  root = root.hasNext() ? root.next() : DriveApp.createFolder(BEN.DRIVE_ROOT);
  var g = root.getFoldersByName(groupName);
  g = g.hasNext() ? g.next() : root.createFolder(groupName);
  var m = g.getFoldersByName(monthKey);
  return m.hasNext() ? m.next() : g.createFolder(monthKey);
}

function bsendMonth_(sub) {
  var testMode = bprop_('BEN_TEST_MODE') !== 'off';
  var clientEmail = bClientRows_(sub.group.name).map(function (r) {
    return String(bfield_(r, ['email'])).trim();
  }).filter(function (x) { return !!x; }).join(',');
  var to = testMode ? bprop_('BEN_NOTIFY') : clientEmail;

  if (!to) {
    return { sent: false, testMode: testMode,
             note: 'Approved, but no billing email is on the Groups tab for ' + sub.group.name + ' — nothing was emailed.' };
  }
  var atts = (sub._fileIds || []).map(function (id) {
    try { return DriveApp.getFileById(id).getBlob(); } catch (e) { return null; }
  }).filter(function (x) { return !!x; });

  var mgrCc = bprop_('BEN_NOTIFY');
  var ackLink = bexecUrl_() ? (bexecUrl_() + '?action=ack&id=' + encodeURIComponent(sub.id)) : '';
  var footer = '\n\n———\n'
    + (ackLink ? 'Please confirm receipt of this billing by opening this link:\n' + ackLink + '\n\n' : '')
    + 'Premium is due on receipt. Cover lapses 45 days after the billing date, so kindly arrange payment early.';
  MailApp.sendEmail({
    to: to,
    cc: (!testMode && mgrCc && mgrCc !== to) ? mgrCc : undefined,
    name: BEN.FROM_NAME,
    subject: (testMode ? '[TEST — would go to ' + (clientEmail || 'no address on file') + '] ' : '') + sub.email.subject,
    body: sub.email.body + footer,
    attachments: atts
  });
  return { sent: true, testMode: testMode,
           note: testMode ? 'Test mode — emailed ' + to + ' instead of the client.' : 'Emailed ' + to + '.' };
}

/* The book, for the upload page's group picker — real groups come from the
   Groups tab, so staff choose the actual client and never a sample. Billing
   emails stay server-side; the page only learns whether one is on file. */
function benGroups_(p) {
  if (!bstaff_(p.auth)) return berr_('Staff or administrators only.');
  /* The book IS the Access tab: every non-Guardian company with an active
     administrator row is a group. One row creates the group, the employer
     login, and the billing contact at once. */
  var seen = {}, groups = [];
  brows_(badminsSheet_()).forEach(function (r) {
    if (!bActive_(r) || bIsBranch_(r)) return;
    var company = String(bfield_(r, ['company'])).trim();
    if (!company) return;
    var key = company.toUpperCase();
    if (seen[key]) { if (String(bfield_(r, ['email'])).trim()) seen[key].hasEmail = true; return; }
    seen[key] = { id: company, name: company, lines: ['life', 'health', 'pension'],
                  hasEmail: !!String(bfield_(r, ['email'])).trim() };
    groups.push(seen[key]);
  });
  return bok_({ groups: groups });
}

/* ══════════════ THE ROSTER — WHAT SALESFORCE BELIEVES ══════════════

   The billing says who Guardian is charging for. Salesforce says who the
   branch believes is covered. Nobody has ever put the two side by side, and
   on D Rampersad they do not agree: Salesforce holds 71 life records and 78
   health records reading "Premium Paying" against a September billing of 67
   lives on each line.

   That gap is not an accounting curiosity. Every name in it is either a
   leaver whose status was never changed — so the branch is quoting cover
   that stopped, and the conversion notice they were owed never went — or
   cover that lapsed with nobody watching.

   The three people terminated on the September statement prove the point.
   All three still read as in force. Harripersad Ramdath is "Premium Paying"
   and employed "Active" on both lines, last touched in 2021.

   So the month-end now asks Salesforce the same question it asks the
   documents, and disagreements become work rather than nothing.

   Read-only. This never writes to Salesforce — a termination goes through
   the department, on the employer's instruction, the way it always has.
   The connection is the one SalesforceSync.gs already set up; if it is not
   set up, the roster check simply says so and the month proceeds. Never
   block a billing on a check that could not run. */

/* Statuses that mean "this cover is running and being paid for". Anything
   else — Matured, Expired, Converted, Not Proceeded With, Rejected, Death —
   is cover that has ended, and a blank is a record nobody has maintained. */
var BEN_INFORCE = ['Premium Paying', 'Paid up', 'RNP'];

/* Waiting on somebody: an application in, not yet on cover. */
var BEN_PENDING = ['Pending', 'Postponed', 'RFC', 'RDE', 'ANT', 'ANP', 'RDC',
                   'Underwriting complete, Missing Settlement Reqts'];

/* Finished, one way or another. Death is here because the record has ended;
   the claim it becomes is a different process and a different department. */
var BEN_ENDED   = ['Matured', 'Expired', 'Converted', 'Not taken', 'Rejected',
                   'Not Proceeded With', 'Death', 'Surrendered', 'File Closed'];

/* Three lines, but only two of them have a group record type.

   Life and health each carry both — LIFE and LIFE_GROUP, INDIVIDUAL_HEALTH
   and HEALTH_GROUP. Pension has one type for everything: 12,843 records
   covering personal annuities and company-owned Section 134 schemes alike,
   with nothing in the record type to tell them apart.

   That matters because a company-owned pension IS an individual annuity
   product — a TopHat or a LifeStyle written on one employee — and what makes
   it the employer's scheme rather than the employee's own savings is who
   OWNS it. On this branch's five schemes, that is recorded on 8 records out
   of 402. The rest are indistinguishable, and counting them as the scheme
   would show an employer a pile of their staff's personal plans and call it
   their pension. So they are counted separately and named honestly. */
function bLineOf_(rt) {
  if (rt === 'HEALTH_GROUP') return 'health';
  if (rt === 'PENSION')      return 'pension';
  return 'life';
}

/* Company-owned, on the evidence rather than on the hope of it. The picklist
   first; failing that the free-text owner, which the book writes four ways
   for the same two companies ("SERVUS LTD" / "SERVUS LIMITED", "D Rampersad
   & Co." / "D Rampersad Company Ltd"), so it is compared the same forgiving
   way account names are. Anything blank is UNKNOWN — never assumed to be
   the scheme. */
function bPensionOwned_(row, group, bills) {
  /* On the scheme's own bill number the question is already answered: the
     employer is invoiced for it every month. That beats an ownership field
     nobody filled. */
  if (row.bill && (bills || []).some(function (b) {
    return bBillLike_(b) && bBillLike_(row.bill).indexOf(bBillLike_(b)) === 0;
  })) return 'company';
  var own = String(row.owner || '').trim();
  if (!own) return 'unknown';
  if (/^company$/i.test(own)) return 'company';
  if (/^personal$/i.test(own)) return 'personal';
  var words = function (x) {
    return String(x).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\b(LTD|LIMITED|CO|COMPANY|INC)\b/g, ' ')
      .split(/\s+/).filter(function (w) { return w.length > 3; });
  };
  var a = words(own), b = words(group), hit = 0;
  a.forEach(function (w) { if (b.indexOf(w) !== -1) hit++; });
  return hit ? 'company' : 'personal';
}

function bClassify_(status) {
  var s = String(status || '').trim();
  if (!s) return 'unknown';
  /* The same status is written three ways across the two status fields —
     "Premium Paying", "premium paying", "PREMIUM PAYING". Xtra Foods' entire
     group life scheme, 155 of its 156 records, carries it in capitals in the
     text field with the picklist left blank; matching exactly dropped the
     branch's largest life scheme out of every in-force count. */
  var hit = function (list) {
    for (var i = 0; i < list.length; i++)
      if (list[i].toUpperCase() === s.toUpperCase()) return true;
    return false;
  };
  if (hit(BEN_INFORCE)) return 'inforce';
  if (hit(BEN_PENDING)) return 'pending';
  if (hit(BEN_ENDED))   return 'ended';
  /* A status nobody has classified is not quietly an in-force policy. Say
     unknown and let a person look — 26 different values sit in this field on
     one account alone, several of them bare codes like "1", "E" and "X". */
  return 'unknown';
}

var BEN_DAY = 24 * 3600 * 1000;

/* A LIKE that finds the account however the book spells it. The two longest
   words in order survive LIMITED against LTD, doubled spaces and the odd
   full stop — the differences that made an exact match report honest
   matches as failures. */
function bAcctLike_(name) {
  var words = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/).filter(function (w) { return w.length > 3; });
  var two = words.slice().sort(function (a, b) { return b.length - a.length; }).slice(0, 2);
  var kept = words.filter(function (w) { return two.indexOf(w) !== -1; });
  return '%' + (kept.length ? kept.join('%') : String(name || '').toUpperCase()) + '%';
}

/* One read of Salesforce, classified once. The staff screen and the employer
   portal both come through here, so a member cannot be pending on one screen
   and in force on the other — which is exactly the kind of second version of
   the truth this whole platform exists to remove. */
/* ── the list bill number is what makes a scheme a scheme ──
   Group pension has no record type, and chasing it by account name was
   always going to be approximate. The actual identifier was in front of us
   the whole time: List_Bill__c, the number Guardian bills the group under,
   and it works for all three lines at once.

     S047        Servus pension   301 records · 84 people · $57,780
     B087        Bankers pension  104 records · 58 people
     D041        Dansteel         pension, life and LIFE_GROUP together
     TGM 1099    D Rampersad group life      — the policy on the letter
     01_DRACO00  D Rampersad group health    — the Employer Group ID
     TGM1526     Xtra Foods group life
     01_NAIXT00  Xtra Foods group health     — under Naipaul's, its legal name

   Two things follow. A scheme spans record types — Bankers' B087 holds 104
   PENSION rows and 95 LIFE rows, one policy for each leg — so the record
   type was never going to identify it. And the number is already printed on
   every document the month-end reads: the life letter's POLICY #, the health
   invoice's Employer Group ID.

   The field is spelled loosely, so it is matched loosely: "TGM1526" and
   "TGM 1526" are one scheme, and "01_DRACO00" is "01_DRACO001" cut to ten
   characters. */
/* Every distinct bill number in a set of rows, biggest first — a group's own
   scheme numbers, read off its records rather than asked for. */
function bDistinctBills_(rows) {
  var tally = {};
  (rows || []).forEach(function (r) {
    if (!r.bill) return;
    tally[r.bill] = (tally[r.bill] || 0) + 1;
  });
  return Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })
    .map(function (b) { return { bill: b, records: tally[b] }; });
}

function bBillLike_(bill) {
  return String(bill || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function bRosterRows_(group, bills) {
  if (typeof sfQuery_ !== 'function')
    throw new Error('SalesforceSync.gs is not in this project, so the branch record could not be read.');
  /* Both account fields, because they disagree in BOTH directions and each
     one alone loses a different part of the book.

     On the bank's account the lookup is wrong: 9,262 records sit there
     carrying somebody else's name in ACCOUNTS_NAME__c. Reading the lookup
     there gives you other people's clients.

     On the branch's pension schemes it is the other way round. Records whose
     ACCOUNTS_NAME__c names the scheme have a lookup pointing at a household
     — or at "PROJECTS", "Lapses", "TO REALLOCATE". And records whose lookup
     correctly says SERVUS LTD (202 of them, $69,264 of premium) were being
     missed entirely by reading the name field alone.

     Neither field is authoritative. Asking for either is the only way to see
     the whole scheme, and the duplicates that follow are removed by Id. */
  var like = bAcctLike_(group).replace(/'/g, "\\'");
  /* A scheme identified by its bill number is identified exactly; the
     account-name match stays as the way in when nobody has told us the
     number yet. */
  var billWhere = '';
  (bills || []).forEach(function (b) {
    var v = String(b || '').replace(/'/g, "\\'").trim();
    if (v) billWhere += " OR List_Bill__c LIKE '" + v.slice(0, 8) + "%'";
  });
  var rows = sfQuery_(
    "SELECT Id, POLICY__c, Contact__r.Name, RecordType.DeveloperName, "
    + "Policy_Status_Description_R__c, Policy_Status_Description__c, "
    + "Status_Change_Date__c, Employment_Status__c, Pension_Premiums__c, "
    + "Ownership__c, POLICY_OWNER__c, PLAN_NAME__c, List_Bill__c, "
    + "CreatedDate, LastModifiedDate "
    + "FROM CLIENT_PORTFOLIO__c "
    + "WHERE (ACCOUNTS_NAME__c LIKE '" + like + "' OR Account__r.Name LIKE '" + like + "'"
    + billWhere + ") "
    + "AND RecordType.DeveloperName IN ('LIFE_GROUP','HEALTH_GROUP','PENSION','LIFE') "
    + "LIMIT 4000");

  var now = Date.now();
  /* One record reached through both fields is one record. */
  var seen = {};
  rows = rows.filter(function (r) { if (seen[r.Id]) return false; seen[r.Id] = 1; return true; });

  return rows.map(function (r) {
    /* The same status is kept in four fields and they disagree — a picklist,
       a text copy, a code, and a second misspelt picklist. Read the picklist
       first and fall back to the text, which is the pair that carries
       values. */
    /* Read the picklist first, then the text copy — and where they disagree,
       say so rather than picking one. On Dansteel's health scheme nine
       records have the picklist reading Lapsed and the text reading Premium
       paying, which is a question for a person, not a tie for code to break. */
    var stA = String(r.Policy_Status_Description_R__c || '').trim();
    var stB = String(r.Policy_Status_Description__c || '').trim();
    var st = stA || stB;
    var stClash = !!(stA && stB && bClassify_(stA) !== bClassify_(stB));
    var created = r.CreatedDate ? new Date(r.CreatedDate).getTime() : 0;
    return {
      name:   (r.Contact__r && r.Contact__r.Name) || '',
      policy: String(r.POLICY__c || ''),
      line:   bLineOf_(r.RecordType && r.RecordType.DeveloperName),
      status: st,
      state:  stClash ? 'unknown' : bClassify_(st),
      statusClash: stClash ? (stA + ' / ' + stB) : null,
      inForce: bClassify_(st) === 'inforce',
      statusAt: r.Status_Change_Date__c || null,
      employment: r.Employment_Status__c || '',
      premium: Number(r.Pension_Premiums__c) || 0,
      plan:    String(r.PLAN_NAME__c || ''),
      bill:    String(r.List_Bill__c || ''),
      owner:   String(r.Ownership__c || r.POLICY_OWNER__c || ''),
      since:  created ? String(r.CreatedDate).slice(0, 10) : null,
      days:   created ? Math.floor((now - created) / BEN_DAY) : null,
      modified: String(r.LastModifiedDate || '').slice(0, 10)
    };
  }).filter(function (r) { return !!r.name; });
}

function benRoster_(p) {
  if (!bstaff_(p.auth)) return berr_('Staff or administrators only.');
  var group = String(p.group || '').trim();
  if (!group) return berr_('Which group?');
  try {
    var bills = [].concat(p.bills || p.bill || []).filter(Boolean);
    if (typeof bills[0] === 'string' && bills.length === 1) bills = bills[0].split(',');
    var rows = bRosterRows_(group, bills);
    return bok_({ roster: rows, matchedOn: bAcctLike_(group), bills: bills,
                  /* What the branch does not know yet: every bill number these
                     records actually carry. Reading them back is how a group
                     learns its own, once, instead of nobody ever knowing. */
                  billsFound: bDistinctBills_(rows),
                  read: new Date().toISOString() });
  } catch (err) {
    /* A month must never be held up because Salesforce was unreachable. */
    return bok_({ roster: null, why: String(err && err.message || err) });
  }
}

/* ══════════════ TRACKING A TERMINATION ══════════════

   An employer reports a leaver and then hears nothing. That is the whole
   problem. Salesforce is supposed to be the answer — "look, the status
   changed" — except we have measured it: the three members Guardian
   terminated on D Rampersad's July statement still read Premium Paying on
   our own record, one of them last touched in 2021, and across the entire
   org only five group records changed to an ended status in two years.

   So a termination gets its own row, and it moves through four stages.
   The first two are things a person does. The last two are NOT typed by
   anybody — they are derived from evidence, because a stage somebody can
   claim is a stage that gets claimed:

     REPORTED  the employer or the branch told us, with a last day
     SENT      passed to Guardian's department
     ACTIONED  our own record no longer shows them in force  ← from the roster
     SETTLED   they are off the billing and the credit has appeared  ← from
               the month-end, which reads the statement of adjustments

   SETTLED is the only stage that means the employer has stopped paying for
   somebody who left, which is the only stage they actually care about.

   Nothing here writes to Salesforce. The department terminates cover; this
   watches for it having happened and says so when it has not. */

function btermsSheet_() { return bsheet_(BEN.TERMS_SHEET); }

var BEN_TERM_STATES = ['REPORTED', 'SENT', 'ACTIONED', 'SETTLED'];

function bTermRows_(group) {
  var want = String(group || '').trim().toUpperCase();
  return brows_(btermsSheet_()).map(function (r) {
    return {
      id:       String(bfield_(r, ['id'])),
      group:    String(bfield_(r, ['group'])),
      member:   String(bfield_(r, ['member'])),
      line:     String(bfield_(r, ['line'])) || 'life',
      lastDay:  bdate_(bfield_(r, ['last day', 'lastday'])),
      reason:   String(bfield_(r, ['reason'])),
      by:       String(bfield_(r, ['reported by', 'reportedby'])),
      at:       bdate_(bfield_(r, ['reported at', 'reportedat'])),
      state:    String(bfield_(r, ['state'])).toUpperCase() || 'REPORTED',
      sentAt:     bdate_(bfield_(r, ['sent at', 'sentat'])),
      actionedAt: bdate_(bfield_(r, ['actioned at', 'actionedat'])),
      settledAt:  bdate_(bfield_(r, ['settled at', 'settledat'])),
      note:     String(bfield_(r, ['note'])),
      _row:     r._row
    };
  }).filter(function (t) {
    return t.member && (!want || String(t.group).trim().toUpperCase() === want);
  });
}

function bTermWrite_(t) {
  var sh = btermsSheet_();
  var line = [t.id, t.group, t.member, t.line, t.lastDay || '', t.reason || '',
              t.by || '', t.at || '', t.state, t.sentAt || '',
              t.actionedAt || '', t.settledAt || '', t.note || ''];
  if (t._row) sh.getRange(t._row, 1, 1, line.length).setValues([line]);
  else sh.appendRow(line);
}

/* Two names are the same person only when they share two words. One is not
   enough: Suraj Roopchand terminated and Vedish Roopchand still employed
   share a surname and nothing else. */
function bSameName_(a, b) {
  var w = function (s) {
    return String(s || '').toUpperCase().replace(/[^A-Z ]/g, ' ')
      .split(/\s+/).filter(function (x) { return x.length > 1; });
  };
  var A = w(a), B = w(b), n = 0;
  A.forEach(function (x) { if (B.indexOf(x) !== -1) n++; });
  return n >= 2;
}

/* Report one. Staff, an administrator, or a client administrator for their
   own group — the same door the employer portal's leaver form comes through
   once QueryPal hands over. */
function benReportTermination_(b) {
  var who = bstaff_(b.auth), group, byName;
  if (who) {
    group = String(b.group || '').trim();
    byName = (who.name === 'Branch admin code' && b.by) ? String(b.by) : who.name;
  } else {
    var row = bClientRow_(b.code, b.password);
    if (!row) return berr_('Not on the access list — check the login and password.');
    group = String(bfield_(row, ['company'])).trim();
    byName = String(bfield_(row, ['name'])).trim() || group;
  }
  if (!group) return berr_('Which group?');

  var members = [].concat(b.member || b.members || []);
  if (!members.length) return berr_('Who has left?');
  if (members.length > 25) return berr_('Twenty-five at a time, so each one gets its own notice.');
  /* A death in service is a claim, not an administrative leaver. It is
     urgent, it goes to a different department, and the family is owed a
     benefit rather than a conversion offer. Refused here on purpose. */
  if (/death|deceased|passed away/i.test(String(b.reason || '')))
    return berr_('A death in service is a claim, not a termination — call the branch on 678-5921 and we will start it today.');

  var lastDay = String(b.lastDay || '').trim();
  if (!lastDay) return berr_('A termination needs the last day — the premium stops from that date.');

  var open = bTermRows_(group), made = [];
  members.forEach(function (m) {
    var name = String(m && m.name ? m.name : m).trim();
    if (!name) return;
    var line = String((m && m.line) || b.line || 'life');
    /* Reporting the same person twice does not make two terminations. */
    if (open.some(function (t) {
      return t.state !== 'SETTLED' && t.line === line && bSameName_(t.member, name);
    })) return;
    var t = { id: 'T' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
              group: group, member: name, line: line, lastDay: lastDay,
              reason: String(b.reason || ''), by: byName, at: bdate_(new Date()),
              state: 'REPORTED', note: String(b.note || '') };
    bTermWrite_(t); made.push(t);
    blog_(byName, who ? who.code : '', 'LEAVER REPORTED', group, '', name + ' — last day ' + lastDay);
  });
  if (!made.length) return bok_({ made: 0, note: 'Already reported — nothing added.' });

  try {
    var to = [bprop_('BEN_APPROVER_EMAIL'), bprop_('BEN_NOTIFY')]
      .filter(function (x) { return !!x; });
    if (to.length) MailApp.sendEmail({
      to: to.join(','), name: BEN.FROM_NAME,
      subject: 'Leaver reported: ' + group + ' — ' + made.length + ' member' + (made.length === 1 ? '' : 's'),
      body: byName + ' reported ' + made.length + ' leaver' + (made.length === 1 ? '' : 's')
        + ' at ' + group + ', last day ' + lastDay + ':\n\n'
        + made.map(function (t) { return '  • ' + t.member + ' (' + t.line + ')'; }).join('\n')
        + (b.reason ? '\n\nReason: ' + b.reason : '')
        + '\n\nPut it through to the department, then mark it sent on the month-end screen.\n'
        + bprop_('BEN_SITE') + 'upload.html'
    });
  } catch (mailErr) {}
  return bok_({ made: made.length, ids: made.map(function (t) { return t.id; }) });
}

/* Staff mark it passed to the department. That is the last thing a person
   types about a termination; everything after is observed. */
function benTerminationSent_(b) {
  var who = bstaff_(b.auth);
  if (!who) return berr_('Staff or administrators only.');
  var byName = (who.name === 'Branch admin code' && b.by) ? String(b.by) : who.name;
  var ids = [].concat(b.id || b.ids || []).map(String);
  var n = 0;
  bTermRows_('').forEach(function (t) {
    if (ids.indexOf(t.id) === -1 || t.state !== 'REPORTED') return;
    t.state = 'SENT'; t.sentAt = bdate_(new Date());
    bTermWrite_(t); n++;
    blog_(byName, who.code, 'LEAVER SENT', t.group, '', t.member);
  });
  return bok_({ moved: n });
}

/* ── the sweep: what the branch record and the billing now show ──
   Runs with the daily trigger. Nothing here is a claim; every move is
   evidence. A termination that has been sitting with the department too
   long is chased, because that is the week an employer is paying for
   somebody who left. */
function benTerminationSweep_() {
  var open = bTermRows_('').filter(function (t) { return t.state !== 'SETTLED'; });
  if (!open.length) return { checked: 0, actioned: 0, stale: 0 };

  var byGroup = {};
  open.forEach(function (t) { (byGroup[t.group] = byGroup[t.group] || []).push(t); });

  var actioned = 0;
  Object.keys(byGroup).forEach(function (g) {
    var roster;
    try { roster = bRosterRows_(g); } catch (e) { return; }   // unreachable: leave them be
    if (!roster.length) return;
    byGroup[g].forEach(function (t) {
      if (t.state === 'ACTIONED') return;
      var mine = roster.filter(function (r) {
        return r.line === t.line && bSameName_(r.name, t.member);
      });
      /* No record at all is not proof of anything — the roster may simply
         not hold them. Only a record that exists and is no longer in force
         is evidence the department acted. */
      if (!mine.length) return;
      if (mine.some(function (r) { return r.inForce; })) return;
      t.state = 'ACTIONED'; t.actionedAt = bdate_(new Date());
      bTermWrite_(t); actioned++;
      blog_('System', '', 'LEAVER ACTIONED', t.group, '', t.member + ' — no longer in force on our record');
    });
  });

  /* Chase what has not moved. Fourteen days with the department is a fair
     wait; a month is an employer paying for nobody. */
  var stale = open.filter(function (t) {
    if (t.state === 'ACTIONED') return false;
    var when = t.sentAt || t.at;
    if (!when) return false;
    return (Date.now() - new Date(when).getTime()) > 14 * BEN_DAY;
  });
  if (stale.length) {
    try {
      var to = [bprop_('BEN_APPROVER_EMAIL'), bprop_('BEN_NOTIFY')]
        .filter(function (x) { return !!x; });
      if (to.length) MailApp.sendEmail({
        to: to.join(','), name: BEN.FROM_NAME,
        subject: '⏰ ' + stale.length + ' termination' + (stale.length === 1 ? '' : 's')
          + ' still not through',
        body: 'These were reported and our own record still shows the cover in force. '
          + 'Every week one of these sits, the employer is paying for somebody who left.\n\n'
          + stale.map(function (t) {
              var d = Math.floor((Date.now() - new Date(t.sentAt || t.at).getTime()) / BEN_DAY);
              return '  • ' + t.group + ' — ' + t.member + ' (' + t.line + '), last day '
                + t.lastDay + ', reported ' + d + ' day' + (d === 1 ? '' : 's') + ' ago'
                + (t.state === 'REPORTED' ? ' — NOT YET SENT TO THE DEPARTMENT' : '');
            }).join('\n')
      });
    } catch (mailErr) {}
  }
  return { checked: open.length, actioned: actioned, stale: stale.length };
}

/* The month-end closes the loop. When a statement of adjustments credits a
   member back, that is the billing itself saying the cover ended and the
   money came off — the only stage that means the employer has stopped
   paying. Called from benSendMonth_ with the adjustment items. */
function bTermSettle_(group, adjItems) {
  if (!adjItems || !adjItems.length) return 0;
  var open = bTermRows_(group).filter(function (t) { return t.state !== 'SETTLED'; });
  if (!open.length) return 0;
  var n = 0;
  adjItems.forEach(function (i) {
    if (!i || !i.name || (i.total || 0) >= 0) return;      // credits only
    open.forEach(function (t) {
      if (t.state === 'SETTLED' || !bSameName_(t.member, i.name)) return;
      t.state = 'SETTLED'; t.settledAt = bdate_(new Date());
      if (!t.actionedAt) t.actionedAt = t.settledAt;
      bTermWrite_(t); n++;
      blog_('System', '', 'LEAVER SETTLED', group, '', t.member + ' — credited on the billing');
    });
  });
  return n;
}

function benTerminations_(p) {
  var group, forBranch = false;
  if (bstaff_(p.auth)) { group = String(p.group || '').trim(); forBranch = true; }
  else {
    var row = bClientRow_(p.code, p.password);
    if (!row) return berr_('Not on the access list — check the login and password.');
    group = String(bfield_(row, ['company'])).trim();
  }
  var rows = bTermRows_(group).map(function (t) {
    delete t._row;
    if (!forBranch) delete t.note;      // the branch's working notes stay internal
    return t;
  });
  return bok_({ group: group, terminations: rows });
}

/* ══════════════ WHAT AN EMPLOYER SEES ══════════════

   Every group the branch manages already has a login on the Access tab, so
   "all our groups in one portal" is not a new system — it is two more tabs
   on the one they already sign in to. This is what fills them: their own
   pending applications and their own terminations, read from the same
   Salesforce records the month-end checks against.

   A word about why this does not simply switch on.

   Across the whole org there are NINE pending group records. Seven belong
   to one client. The youngest was raised in July 2024 and the oldest in May
   2023 — between two and three and a quarter years ago. Several carry a
   placeholder where the policy number goes ("TGM - Jeanmarc Rampersad",
   "TPG Krishna" — and that last one sits on a different member's record).
   In the same two years, five group records changed to an ended status,
   all for one client, four of them on the same afternoon.

   Switch that straight through to employers and Bhagwansingh's signs in to
   an application pending since May 2023. That is not transparency, it is
   publishing our own filing.

   So the branch sees this immediately and the client sees it when the
   branch says so: BEN_CLIENT_PENDING in Script Properties, "off" until
   somebody has looked. The staleness is reported honestly to the branch on
   the way, because a list of things nobody has touched in two years is the
   most useful thing this view produces first. */

/* Anything older than this was not "in progress" by any reading. */
var BEN_STALE_DAYS = 90;

function bClientRow_(code, password) {
  var sh = badminsSheet_();
  var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
    .map(function (h) { return String(h).toLowerCase(); });
  if (!head.some(function (h) { return h.indexOf('pass') !== -1 || h === 'pw'; })) return null;
  var c = String(code || '').trim().toUpperCase(), pw = String(password || '');
  var hit = brows_(sh).filter(function (r) {
    return bLoginOf_(r) === c &&
           String(bfield_(r, ['password', 'pass', 'pw'])).trim() === pw && pw !== '';
  })[0];
  if (!hit || !bActive_(hit) || bIsBranch_(hit)) return null;
  return hit;
}

function benGroupView_(p) {
  /* An employer proves who they are the same way they signed in. Whatever
     group they ask for, they get their own — the company is read off their
     row, never off the request. */
  var group, forBranch = false;
  var staff = bstaff_(p.auth);
  if (staff) { group = String(p.group || '').trim(); forBranch = true; }
  else {
    var row = bClientRow_(p.code, p.password);
    if (!row) return berr_('Not on the access list — check the login and password.');
    group = String(bfield_(row, ['company'])).trim();
  }
  if (!group) return berr_('That login is not attached to a company.');

  if (!forBranch && bprop_('BEN_CLIENT_PENDING') !== 'on')
    return bok_({ group: group, shown: false,
                  why: 'The branch has not switched this on yet.' });

  var rows, bills = [].concat(p.bills || p.bill || []).filter(Boolean);
  if (typeof bills[0] === 'string' && bills.length === 1) bills = bills[0].split(',');
  try { rows = bRosterRows_(group, bills); }
  catch (err) { return bok_({ group: group, shown: false, why: String(err && err.message || err) }); }

  var pick = function (state) {
    return rows.filter(function (r) { return r.state === state; })
      .sort(function (a, b) { return (b.days || 0) - (a.days || 0); })
      .map(function (r) {
        return { name: r.name, line: r.line, policy: r.policy, status: r.status,
                 since: r.since, days: r.days, statusAt: r.statusAt, modified: r.modified,
                 stale: (r.days != null && r.days > BEN_STALE_DAYS) };
      });
  };
  var pending = pick('pending'), ended = pick('ended');
  var counts = { life: 0, health: 0, pension: 0 };
  rows.forEach(function (r) { if (r.inForce && counts[r.line] != null) counts[r.line]++; });
  /* Pension carries a monthly contribution on the record; life and health do
     not, so it is the one line whose schedule can be read rather than billed
     from a document. Only where Guardian has actually filled the field —
     which on this branch's pension book is a minority of records. */
  var contrib = 0, withFigure = 0, owned = 0, unclear = 0, personal = 0;
  rows.forEach(function (r) {
    if (r.line !== 'pension' || !r.inForce) return;
    var who = bPensionOwned_(r, group, bills);
    if (who === 'company') { owned++; if (r.premium) { contrib += r.premium; withFigure++; } }
    else if (who === 'personal') personal++;
    else unclear++;
  });

  /* The tracked terminations ride along, because an employer asking "what
     happened to the leaver I reported" is asking one question, not two.
     Salesforce's ended statuses answer "did it eventually happen"; these
     answer "where is it now". */
  var tracked = [];
  try {
    tracked = bTermRows_(group).map(function (t) {
      delete t._row; if (!forBranch) delete t.note; return t;
    });
  } catch (e) {}

  return bok_({
    group: group, shown: true, read: new Date().toISOString(),
    inForce: counts, pending: pending, ended: ended, tracked: tracked,
    /* owned  — demonstrably the employer's, by the ownership field
       unclear — no owner recorded, so it could be either
       personal — an employee's own plan, which is not the scheme
       The monthly figure covers the owned ones only. */
    bills: bDistinctBills_(rows),
    pension: { monthly: Math.round(contrib * 100) / 100, priced: withFigure,
               owned: owned, unclear: unclear, personal: personal,
               total: owned + unclear + personal },
    /* Unclassified statuses are the branch's problem, not the client's, so
       they go back only to staff. */
    unknown: forBranch ? rows.filter(function (r) { return r.state === 'unknown'; }).length : undefined,
    stale: pending.filter(function (r) { return r.stale; }).length
  });
}

/* ============================ client billing ============================ */

/* group.html asks with the group's portal code, not an admin code — a
   client may read their own months and nothing else. */
function benBilling_(p) {
  /* Client administrators get their months through sign-in now. This route
     stays for the branch: an administrator may read any group's ledger. */
  if (!badmin_(p.auth)) return berr_('That code was not recognised.');
  var gid = String(p.group || '').trim();
  return bok_({ group: gid, name: gid, rows: bBillingRowsFor_(gid) });
}

/* ── follow-up: months waiting for review do not wait quietly ──
   Runs with the daily 3 p.m. sweep. Any submission still SUBMITTED after a
   day re-emails the approver the list and the links, manager copied. Time
   triggers always run the latest saved code, so pasting this file is
   enough — no redeployment needed for the sweep. */
function benefitsFollowUp() {
  try {
    var DAY = 24 * 3600 * 1000, HOLD = 20 * 3600 * 1000;
    var mgr = bprop_('BEN_NOTIFY');
    var approver = bprop_('BEN_APPROVER_EMAIL') || mgr;

    /* When a month last moved, whatever moved it. A month stuck is a month
       whose last event is old, and the useful question is always "sitting
       with whom" — so each stall is chased to the desk that holds it. */
    function stuckFor(s) {
      var ev = (s.events || [])[s.events.length - 1] || {};
      return ev.at ? (Date.now() - ev.at) : 0;
    }
    function days(ms) { return Math.max(1, Math.floor(ms / DAY)); }

    var waiting = bsubs_().filter(function (s) {
      return s.state === 'SUBMITTED' && stuckFor(s) > HOLD;
    });
    if (waiting.length && approver) {
      MailApp.sendEmail({
        to: approver,
        cc: (mgr && mgr !== approver) ? mgr : undefined,
        name: BEN.FROM_NAME,
        subject: '⏰ Waiting for review: ' + waiting.length + ' month' + (waiting.length === 1 ? '' : 's'),
        body: 'Still waiting for a decision:\n\n'
          + waiting.map(function (s) {
              return '• ' + s.group.name + ' — ' + s.monthLabel + ' (waiting '
                + days(stuckFor(s)) + ' day' + (days(stuckFor(s)) === 1 ? '' : 's') + ')\n  '
                + bprop_('BEN_SITE') + 'review.html#' + s.id;
            }).join('\n\n')
          + '\n\nApproving hands it back to staff to send; returning goes back with your reason.'
      });
    }

    /* The new stall the flow creates: approved, cleared, and sitting unsent
       on somebody's desk. The client is waiting on a billing that is ready
       and nobody knows it. Chase the person who has to press send. */
    var ready = bsubs_().filter(function (s) {
      return (s.state === 'APPROVED' || s.state === 'RETURNED') && stuckFor(s) > HOLD;
    });
    ready.forEach(function (s) {
      var staffEmail = bSubmitterEmail_(s);
      if (!staffEmail && !mgr) return;
      var approvedNow = s.state === 'APPROVED';
      MailApp.sendEmail({
        to: staffEmail || mgr,
        cc: (mgr && mgr !== staffEmail) ? mgr : undefined,
        name: BEN.FROM_NAME,
        subject: (approvedNow ? '⏰ Approved and not yet sent: ' : '⏰ Sent back and not yet fixed: ')
          + s.group.name + ' — ' + s.monthLabel,
        body: s.group.name + ' — ' + s.monthLabel + ' has been sitting with you for '
          + days(stuckFor(s)) + ' day' + (days(stuckFor(s)) === 1 ? '' : 's') + '.\n\n'
          + (approvedNow
              ? 'It is approved. The client has not seen it — pressing Send is the only thing left.'
              : 'It came back with a note to answer, and the month cannot go out until it does.')
          + '\n\n' + bprop_('BEN_SITE') + 'upload.html'
      });
    });
  } catch (e) {}
}

/* ══════════════ THE COLLECTIONS EXPERIENCE ══════════════
   Billing reaches the branch on the 25th and goes out on the 26th — the
   approval send is email one, carrying a confirm-receipt link. Cover
   lapses 45 days after billing, so the ladder is:

     day 10 — reminder one, the invoice re-attached, if no payment
     day 25 — reminder two
     day 35 — final notice, naming the lapse date

   Payment is what staff record on the Billing tab (the Paid column); the
   moment any payment shows for the month, reminders stop and the client
   gets a thank-you with a five-star rating link instead. Acknowledgement
   and rating land on the activity tab and inside the submission's trail.

   Test mode routes every one of these to the branch, never the client.

   The confirm/rate links need a deployment that serves the ack and rate
   actions — set BEN_EXEC in Script Properties to the current /exec URL.
   Without it, emails simply omit the link; the reminder ladder itself
   runs off the daily trigger, which always uses the latest saved code. */

function bexecUrl_() {
  var u = bprop_('BEN_EXEC');
  if (u) return u;
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function bBillingPaid_(gid, monthLabel) {
  var rows = brows_(bsheet_(BEN.BILLING_SHEET)).filter(function (r) {
    return String(bfield_(r, ['group id', 'groupid'])).trim() === gid &&
           String(bfield_(r, ['month'])).trim() === String(monthLabel).trim();
  });
  var billed = 0, paid = 0;
  rows.forEach(function (r) {
    billed += Number(bfield_(r, ['billed'])) || 0;
    paid   += Number(bfield_(r, ['paid'])) || 0;
  });
  return { billed: billed, paid: paid };
}

/* One daily pass over the terminations: what the branch record now shows,
   and what has been sitting too long. Time triggers always run the latest
   saved code, so pasting this file is enough. */
function benefitsTerminationSweep() {
  try { return benTerminationSweep_(); } catch (e) { return { error: String(e && e.message || e) }; }
}

function benefitsDunning() {
  try {
    var DAY = 24 * 3600 * 1000;
    var testMode = bprop_('BEN_TEST_MODE') !== 'off';
    bsubs_().forEach(function (sub) {
      /* A month that has gone out is still in the ladder after the client
         confirms it — confirming is not paying. A month they have queried
         is not: chasing somebody for money while their question sits
         unanswered is how a branch loses a group. */
      if (sub.state !== 'SENT' && sub.state !== 'CONFIRMED') return;
      var sentEv = null;
      (sub.events || []).forEach(function (e) { if (e.did === 'SENT') sentEv = e; });
      if (!sentEv || !sentEv.at) return;
      var d = Math.floor((Date.now() - sentEv.at) / DAY);
      sub.dunning = sub.dunning || {};

      /* who this month's mail goes to — the plan administrators on Access */
      var clientEmail = bClientRows_(sub.group.name).map(function (r) {
        return String(bfield_(r, ['email'])).trim();
      }).filter(function (x) { return !!x; }).join(',');
      var to = testMode ? bprop_('BEN_NOTIFY') : clientEmail;
      if (!to) return;
      var pfx = testMode ? '[TEST — would go to ' + (clientEmail || 'no address on file') + '] ' : '';

      var pay = bBillingPaid_(sub.group.id, sub.monthLabel);

      /* payment ends the ladder with thanks and a rating ask */
      if (pay.paid > 0) {
        if (!sub.dunning.thanked) {
          var stars = '';
          if (bexecUrl_()) {
            for (var n = 1; n <= 5; n++) {
              stars += n + ' star' + (n === 1 ? '' : 's') + ': '
                + bexecUrl_() + '?action=rate&id=' + encodeURIComponent(sub.id) + '&stars=' + n + '\n';
            }
          }
          MailApp.sendEmail({
            to: to, name: BEN.FROM_NAME,
            subject: pfx + 'Thank you — ' + sub.monthLabel + ' premium received (' + sub.group.name + ')',
            body: 'Good day,\n\nYour ' + sub.monthLabel + ' premium has been received and applied. '
              + 'Thank you for settling promptly — your cover continues without interruption.\n\n'
              + (stars ? 'How did we do this month? One tap:\n' + stars + '\n' : '')
              + 'Kind regards,\nRicky Rampersad\nGuardian Life of the Caribbean'
          });
          sub.dunning.thanked = Date.now();
          bwrite_(sub);
          blog_('System', '', 'THANKED', sub.group.name, sub.monthLabel, 'payment received');
        }
        return;
      }

      /* no payment: the ladder */
      var atts = (sub._fileIds || []).map(function (id) {
        try { return DriveApp.getFileById(id).getBlob(); } catch (e) { return null; }
      }).filter(function (x) { return !!x; });
      var ackLine = (!sub.dunning.ack && bexecUrl_())
        ? '\n\nIf you have received this billing, please confirm with one click:\n'
          + bexecUrl_() + '?action=ack&id=' + encodeURIComponent(sub.id)
        : '';
      var lapseInDays = 45 - d;

      function remind(key, subjectTag, bodyText, withAtts) {
        if (sub.dunning[key]) return;
        MailApp.sendEmail({
          to: to, name: BEN.FROM_NAME,
          subject: pfx + subjectTag + ' — ' + sub.group.name + ' · ' + sub.monthLabel,
          body: bodyText + ackLine + '\n\nKind regards,\nRicky Rampersad\nGuardian Life of the Caribbean',
          attachments: withAtts ? atts : undefined
        });
        sub.dunning[key] = Date.now();
        bwrite_(sub);
        blog_('System', '', 'REMINDER', sub.group.name, sub.monthLabel, subjectTag);
      }

      if (d >= 35) {
        remind('r35', 'FINAL NOTICE: premium unpaid',
          'Good day,\n\nOur records show the ' + sub.monthLabel + ' premium remains unpaid '
          + d + ' days after billing. Cover lapses 45 days after the billing date'
          + (lapseInDays > 0 ? ' — that is ' + lapseInDays + ' day' + (lapseInDays === 1 ? '' : 's') + ' from now.' : '.')
          + '\n\nIf payment has already been made, please send us the payment reference and we will have it applied immediately — this usually resolves it the same day.', true);
      } else if (d >= 25) {
        remind('r25', 'Second reminder: premium outstanding',
          'Good day,\n\nA further reminder that the ' + sub.monthLabel + ' premium is still showing as unpaid. '
          + 'The original billing is attached again for ease of reference.\n\n'
          + 'If payment has been made, reply with the reference and we will have it applied.', true);
      } else if (d >= 10) {
        remind('r10', 'Reminder: premium outstanding',
          'Good day,\n\nWe have not yet received payment or a response for the ' + sub.monthLabel
          + ' billing sent on ' + Utilities.formatDate(new Date(sentEv.at), Session.getScriptTimeZone(), 'dd MMM yyyy')
          + '. The billing is attached again.\n\nIf it has been settled, reply with the payment reference and we will match it.', true);
      }
    });
  } catch (e) {}
}

/* ══════════════ THE CLIENT'S REPLY ══════════════
   A billing that lands and is never answered is the one that lapses. So the
   email asks a question the client can answer in one tap: is this right?

   Yes ends it — the month is confirmed and the branch stops wondering.
   No is the valuable answer, and it is the one a free-text reply loses. A
   client writing "there's a problem with the bill" starts a week of email;
   a client picking "someone on this billing has left us" tells the branch
   which department to call before anyone has read a sentence. So the reasons
   are named, and they are the things that actually go wrong on these packs.

   The page posts a plain form back to this same script — a top-level
   navigation, so there is nothing to sign in to, nothing to install, and no
   browser between them and us that can block it. */

var BEN_REPLY_REASONS = [
  ['left',    'Someone on this billing has left us'],
  ['missing', 'Someone who should be covered is not on it'],
  ['premium', 'A premium or sum assured looks wrong'],
  ['paid',    'The balance is wrong — we have paid'],
  ['tier',    'A member is on the wrong plan or tier'],
  ['attach',  'The attachment is missing or will not open'],
  ['other',   'Something else']
];

function bhesc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bpage_(inner) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>'
    + 'body{margin:0;background:#F7F9FB;color:#0E1F2E;font:15px/1.6 "Gill Sans MT","Segoe UI",system-ui,sans-serif}'
    + '.w{max-width:560px;margin:7vh auto;padding:0 1.2rem}'
    + '.c{background:#fff;border:1px solid #D3DEE7;border-radius:8px;padding:1.8rem 1.7rem}'
    + 'h2{font-family:Optima,Palatino,Georgia,serif;color:#08333D;margin:0 0 .3rem;font-size:1.4rem}'
    + '.s{color:#5C7080;font-size:13px;margin:0 0 1.2rem}'
    + '.amt{font-family:ui-monospace,Menlo,monospace;font-size:1.6rem;color:#08333D;margin:.2rem 0 1.2rem}'
    + 'button{font:inherit;cursor:pointer;border-radius:5px;padding:.7rem 1.1rem;border:1px solid;width:100%;'
    + 'font-weight:700;letter-spacing:.04em;margin-top:.6rem}'
    + '.go{background:#1F7A55;border-color:#1F7A55;color:#fff}'
    + '.alt{background:#fff;border-color:#D3DEE7;color:#08333D}'
    + 'label{display:block;padding:.5rem .1rem;border-bottom:1px solid #EDF2F7;font-size:14px;cursor:pointer}'
    + 'label:last-of-type{border-bottom:0}'
    + 'input[type=checkbox]{margin-right:.6rem;transform:scale(1.15)}'
    + 'textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid #D3DEE7;border-radius:5px;'
    + 'padding:.6rem;min-height:80px;margin-top:.7rem;background:#F7F9FB}'
    + '.q{display:none;margin-top:1rem;border-top:1px solid #EDF2F7;padding-top:1rem}'
    + '</style><div class="w"><div class="c">' + inner + '</div></div>');
}

/* the landing page the billing email links to */
function benAck_(p) {
  var sub = bsubs_().filter(function (s) { return s.id === String(p.id || ''); })[0];
  if (!sub) return bpage_('<h2>Link not recognised</h2><p class="s">Please contact the branch and we will resend it.</p>');

  sub.dunning = sub.dunning || {};
  if (sub.dunning.verdict === 'ok')    return bpage_(bthanks_(sub));
  if (sub.dunning.verdict === 'query') return bpage_(bqueryDone_(sub));

  /* Opening the link is itself the receipt — whatever they answer next. */
  if (!sub.dunning.ack) {
    sub.dunning.ack = Date.now();
    bwrite_(sub);
    blog_('Client', '', 'ACKNOWLEDGED', sub.group.name, sub.monthLabel, 'billing opened');
  }

  var total = 0;
  Object.keys(sub.lineTotals || {}).forEach(function (k) { total += Number(sub.lineTotals[k]) || 0; });
  var due = (sub.arrears && sub.arrears.balance) ? Number(sub.arrears.balance) : total;

  return bpage_(
    '<h2>' + bhesc_(sub.group.name) + '</h2>'
    + '<p class="s">' + bhesc_(sub.monthLabel) + ' group billing</p>'
    + (due ? '<div class="amt">TT$' + due.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</div>' : '')
    + '<p>Is this billing correct?</p>'
    + '<form method="post" action="' + bhesc_(bexecUrl_()) + '">'
    + '<input type="hidden" name="action" value="clientreply">'
    + '<input type="hidden" name="id" value="' + bhesc_(sub.id) + '">'
    + '<button class="go" name="verdict" value="ok" type="submit">Yes — received and correct</button>'
    + '<button class="alt" type="button" onclick="document.getElementById(\'q\').style.display=\'block\';this.style.display=\'none\'">'
    + 'No — something is not right</button>'
    + '<div class="q" id="q">'
    + '<p class="s" style="margin-bottom:.4rem">Tell us what, and it goes straight to the person who prepared it.</p>'
    + BEN_REPLY_REASONS.map(function (r) {
        return '<label><input type="checkbox" name="reason" value="' + r[0] + '">' + r[1] + '</label>';
      }).join('')
    + '<textarea name="note" maxlength="1500" placeholder="Names, amounts, anything that helps us find it"></textarea>'
    + '<button class="go" name="verdict" value="query" type="submit" style="background:#A9701F;border-color:#A9701F">'
    + 'Send this to the branch</button>'
    + '</div></form>');
}

function bthanks_(sub) {
  return '<h2>Thank you — noted</h2>'
    + '<p class="s">' + bhesc_(sub.group.name) + ' · ' + bhesc_(sub.monthLabel) + '</p>'
    + '<p>You have confirmed this billing is correct. The branch has been told, and nothing '
    + 'more is needed from you beyond settling it.</p>';
}

function bqueryDone_(sub) {
  return '<h2>We have it — thank you</h2>'
    + '<p class="s">' + bhesc_(sub.group.name) + ' · ' + bhesc_(sub.monthLabel) + '</p>'
    + '<p>Your query is with the branch and reminders on this month have stopped while we look at it. '
    + 'Somebody will come back to you.</p>';
}

/* the reply itself */
function benClientReply_(p) {
  var sub = bsubs_().filter(function (s) { return s.id === String(p.id || ''); })[0];
  if (!sub) return bpage_('<h2>Link not recognised</h2><p class="s">Please contact the branch.</p>');
  sub.dunning = sub.dunning || {};

  var verdict = String(p.verdict || '') === 'query' ? 'query' : 'ok';
  var picked = [];
  if (p.reason) {
    var raw = (typeof p.reason === 'string') ? [p.reason] : p.reason;
    /* Apps Script hands a single checkbox back as a string and several as an
       array; e.parameters would give arrays either way but the form check in
       doPost reads e.parameter. Handle both rather than depend on it. */
    raw.forEach(function (code) {
      BEN_REPLY_REASONS.forEach(function (r) { if (r[0] === code) picked.push(r[1]); });
    });
  }
  var note = String(p.note || '').slice(0, 1500);

  sub.dunning.verdict = verdict;
  sub.dunning.repliedAt = Date.now();
  if (!sub.dunning.ack) sub.dunning.ack = Date.now();
  if (verdict === 'query') { sub.dunning.query = { reasons: picked, note: note, at: Date.now() }; }
  sub.state = (verdict === 'ok') ? 'CONFIRMED' : 'QUERIED';
  sub.events.push({ at: Date.now(), by: sub.group.name, code: '', did: sub.state,
                    note: verdict === 'query' ? (picked.join('; ') + (note ? ' — ' + note : '')) : '' });
  bwrite_(sub);
  blog_('Client', '', verdict === 'ok' ? 'CONFIRMED' : 'QUERIED', sub.group.name, sub.monthLabel,
        verdict === 'ok' ? 'billing confirmed correct' : picked.join('; ') + (note ? ' — ' + note : ''));

  /* The branch hears about a query at once — the assistant who built it,
     the approver, and the manager. A confirmation is quieter: it lands on
     the activity tab and stops the reminder ladder, and nobody's inbox
     needs to carry it. */
  try {
    if (verdict === 'query') {
      var to = [bSubmitterEmail_(sub), bprop_('BEN_APPROVER_EMAIL'), bprop_('BEN_NOTIFY')]
        .filter(function (x) { return !!x; });
      var seen = {}, list = [];
      to.forEach(function (a) { if (!seen[a]) { seen[a] = 1; list.push(a); } });
      if (list.length) {
        MailApp.sendEmail({
          to: list.join(','), name: BEN.FROM_NAME,
          subject: '⚠ Query raised: ' + sub.group.name + ' — ' + sub.monthLabel,
          body: sub.group.name + ' has replied that the ' + sub.monthLabel + ' billing is not right.\n\n'
            + (picked.length ? 'What they picked:\n' + picked.map(function (x) { return '  • ' + x; }).join('\n') + '\n\n' : '')
            + (note ? 'What they wrote:\n' + note + '\n\n' : '')
            + 'Reminders on this month have stopped until it is resolved.\n\n'
            + bprop_('BEN_SITE') + 'review.html#' + sub.id
        });
      }
    }
  } catch (mailErr) {}

  return bpage_(verdict === 'ok' ? bthanks_(sub) : bqueryDone_(sub));
}

/* the five-star tap from the thank-you email */
function benRate_(p) {
  var sub = bsubs_().filter(function (s) { return s.id === String(p.id || ''); })[0];
  var stars = Math.max(1, Math.min(5, Number(p.stars) || 0));
  if (!sub || !stars) return HtmlService.createHtmlOutput('<h2>Link not recognised</h2>');
  sub.dunning = sub.dunning || {};
  if (!sub.dunning.rated) {
    sub.dunning.rated = stars;
    bwrite_(sub);
    blog_('Client', '', 'RATED', sub.group.name, sub.monthLabel, stars + ' star' + (stars === 1 ? '' : 's'));
  }
  var shown = '★★★★★'.slice(0, sub.dunning.rated) + '☆☆☆☆☆'.slice(0, 5 - sub.dunning.rated);
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Georgia,serif;max-width:480px;margin:14vh auto;text-align:center">'
    + '<h2 style="color:#0B3C46">Thank you!</h2>'
    + '<p style="font-size:34px;letter-spacing:.15em;color:#E8A020">' + shown + '</p>'
    + '<p style="color:#68747f">Your rating reached the branch. We appreciate your business.</p></div>');
}
