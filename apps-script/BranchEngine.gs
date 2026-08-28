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
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (b.action === 'signin')       return benSignin_(b);
    if (b.action === 'pendingnote')  return benPendingNote_(b);
    if (b.action === 'submitmonth')  return benSubmitMonth_(b);
    if (b.action === 'reviewmonth')  return benReviewMonth_(b);
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
    sub.state = 'SENT';
    sub.events.push({ at: now, by: byName, code: who.code, did: 'APPROVED' });
    sub.events.push({ at: now, by: byName, code: who.code, did: 'SENT' });
    var sent = bsendMonth_(sub);
    bwrite_(sub);
    blog_(byName, who.code, 'APPROVED', sub.group.name, sub.monthLabel, sent.note);
    bbillingRows_(sub);
    return bok_({ sent: sent.sent, testMode: sent.testMode, note: sent.note });
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
    var DAY = 24 * 3600 * 1000;
    var waiting = bsubs_().filter(function (s) {
      var ev = s.events && s.events[0] || {};
      return s.state === 'SUBMITTED' && ev.at && (Date.now() - ev.at) > 20 * 3600 * 1000;
    });
    if (!waiting.length) return;
    var approver = bprop_('BEN_APPROVER_EMAIL') || bprop_('BEN_NOTIFY');
    if (!approver) return;
    var mgr = bprop_('BEN_NOTIFY');
    var lines = waiting.map(function (s) {
      var days = Math.max(1, Math.floor((Date.now() - s.events[0].at) / DAY));
      return '• ' + s.group.name + ' — ' + s.monthLabel + ' (waiting ' + days + ' day' + (days === 1 ? '' : 's') + ')\n  '
        + bprop_('BEN_SITE') + 'review.html#' + s.id;
    });
    MailApp.sendEmail({
      to: approver,
      cc: (mgr && mgr !== approver) ? mgr : undefined,
      name: BEN.FROM_NAME,
      subject: '⏰ Waiting for review: ' + waiting.length + ' month' + (waiting.length === 1 ? '' : 's'),
      body: 'Still waiting for a decision:\n\n' + lines.join('\n\n')
        + '\n\nApproving sends to the client; returning goes back to staff with your reason.'
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

function benefitsDunning() {
  try {
    var DAY = 24 * 3600 * 1000;
    var testMode = bprop_('BEN_TEST_MODE') !== 'off';
    bsubs_().forEach(function (sub) {
      if (sub.state !== 'SENT') return;
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

/* one-click receipt confirmation from the billing email */
function benAck_(p) {
  var sub = bsubs_().filter(function (s) { return s.id === String(p.id || ''); })[0];
  if (!sub) return HtmlService.createHtmlOutput('<h2>Link not recognised</h2><p>Please contact the branch.</p>');
  sub.dunning = sub.dunning || {};
  if (!sub.dunning.ack) {
    sub.dunning.ack = Date.now();
    bwrite_(sub);
    blog_('Client', '', 'ACKNOWLEDGED', sub.group.name, sub.monthLabel, 'billing receipt confirmed');
  }
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Georgia,serif;max-width:480px;margin:14vh auto;text-align:center">'
    + '<h2 style="color:#0B3C46">Receipt confirmed — thank you</h2>'
    + '<p>' + sub.group.name + ' · ' + sub.monthLabel + '</p>'
    + '<p style="color:#68747f">The branch has been notified. Nothing more is needed from you.</p></div>');
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
