/**
 * ============================================================
 *  CLAIMS TT — backend
 *  Ricky Rampersad Branch
 * ============================================================
 *
 *  The custom claims intake + document upload service behind
 *  claims/index.html. A client picks their claim type, answers
 *  the questions that matter for that type, photographs or
 *  attaches their documents, and submits. Nothing is emailed
 *  back and forth and nobody has to walk into the branch with
 *  a folder of paper.
 *
 *  WHAT THIS SCRIPT DOES
 *   1. Storage — every claim becomes its own Google Drive
 *      folder (Claims TT / YEAR / CLM-XXXX — Client — Type)
 *      holding the uploaded documents, plus one row on the
 *      "Claims" tab and one row per file on the "Claim Files"
 *      tab.
 *   2. Upload — files arrive in chunks so a large PDF or an
 *      uncompressed phone photo cannot blow the request limit.
 *      Chunks are reassembled server-side.
 *   3. Notification — the claims desk for that line of business
 *      gets a full summary email (with the Drive folder link),
 *      the client gets an acknowledgement carrying their claim
 *      reference and a list of anything still outstanding.
 *   4. Status — a client can come back later and check where
 *      their claim stands using their reference plus the last
 *      four digits of the mobile number they filed with.
 *
 *  SETUP (about ten minutes, once):
 *   1. Make a new Google Sheet — call it "Claims TT".
 *      Extensions -> Apps Script.
 *   2. Paste this file in, save.
 *   3. Edit the CLAIMS config below — at minimum the claims
 *      desk email addresses and SITE_KEY.
 *   4. Run setupClaims() once and grant the permissions it
 *      asks for (Sheets, Drive, Gmail). It builds every tab and
 *      creates the Drive folder.
 *   5. Deploy -> New deployment -> Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Copy the /exec URL.
 *   6. Paste that URL into CONFIG.API_URL in claims/index.html
 *      and set CONFIG.SITE_KEY there to the same SITE_KEY.
 *
 *  NOTE ON doGet / doPost: an Apps Script project may only have
 *  one of each, so this file belongs in its OWN project with
 *  its own spreadsheet — do not paste it alongside Code.gs or
 *  Market.gs.
 * ============================================================
 */

var CLAIMS = {
  /* Which copy of this file is actually running, as a date. `?action=ping`
   * returns it, so a browser can tell a pasted-and-deployed build from one
   * that was pasted and never deployed — from outside those look identical,
   * and so does a later paste of an older copy winning the same function
   * name. Change it with any change worth deploying. */
  BUILD: '2026-11-06b',

  /* ---- where notifications go ---------------------------- */

  // The claims desk for each line of business. Any line left blank falls
  // back to DESK_DEFAULT.
  //
  // ⚠ These are Guardian's desks. The branch places business with many
  // carriers — Risk Details alone carries Tatil, Sagicor, Colfire, Beacon,
  // Maritime, Bankers, Gulf, New India, Presidential and United — so a
  // claim on a policy underwritten elsewhere currently still routes here
  // and has to be forwarded by hand. The registers already hold each
  // policy's Carrier, so routing by carrier is a small change when you
  // want it; say so and it gets built.
  /* Where a filed claim is forwarded, by line of business.
   *
   * DESK_OK is the list of lines whose address somebody has actually
   * CONFIRMED. A line not on it is never e-mailed: the claim still files, the
   * branch is still told, and the e-mail says in as many words that it was not
   * forwarded and why. That rule exists because the opposite failure is
   * invisible and expensive — a claim sent to an address nobody checks looks
   * exactly like a claim that was handled, to us and to the client, until the
   * day somebody asks why nothing happened.
   *
   * Four of the five addresses below were guesses, and the branch's own record
   * contradicts them. Measured on 3,634 Log Book lines (LB_DEPTS in
   * LogBook.gs), a Health Claim Form goes to EBD HEALTH CLAIMS or EBD CUSTOMER
   * CARE, and a Claim Submission Form - Life & CI goes to GLOC CLAIMS -
   * CUSTOMER SUPPORT. Motor is a different company altogether: Guardian
   * General's Motor Claims Department. So the names are right here and the
   * addresses have to come from the Log Book's own Departments tab, which is
   * private and holds the ones the branch really uses.
   *
   * To switch a line on: put the real address in DESK, add the key to DESK_OK,
   * and file one claim in test mode to see it arrive. */
  DESK: {
    /* Guardian General — P&C Claims. NOT Guardian Life.
       Confirmed 5 November 2026 off the branch's own record: a live motor
       claim ran from 14 August to 2 November 2026 on this one thread, and
       GGIL PC Claims is on every message of it — in the To line beside the
       Motor Claims Department representative handling it. The branch's own
       first notification of loss went to the same desk. */
    motor:    'GGILPCClaims@myguardiangroup.com',
    property: '',
    /* Health Claims TT. Confirmed 5 November 2026 by the branch manager —
       "this is guardian health claims email … so healthclaimstt@" — and by
       the branch's own record: every health claim sales support has filed
       goes To: healthclaimstt@, with EB Customer Care copied, not the other
       way round. EBCustomercare@ is the right desk for a change of cover or
       a billing question, which is what the renewal desk uses it for. */
    health:   'healthclaimstt@myguardiangroup.com',
    // GLOC Claims — Customer Support, the Log Book's own route for a
    // life/CI claim submission. Address to be read off the Departments tab.
    life:     '',
    pension:  '',
  },
  DESK_OK: ['health', 'motor'],
  DESK_DEFAULT: '',

  /* Copied on one line's claims only, beside MAIL_CC. EB Customer Care is on
     every health claim the branch files by hand, so it stays on ours; CRMS
     Claims is on every motor claim the branch has filed, so it stays on ours.
     Only department inboxes go here, never the individual representative
     handling one claim — they change, and a desk is what gets read. */
  DESK_CC: {
    health: ['EBCustomercare@myguardiangroup.com'],
    motor:  ['CRMSClaims@myguardiangroup.com'],
  },

  // Copied on every claim, whatever the type. With a line's desk not yet
  // confirmed, these are the only people who get it — which is why the branch
  // inbox has to be on the list.
  MAIL_CC: [
    'Ricky.Rampersad@myguardiangroup.com',               // you
    'rickyrampersadsalessupport@myguardiangroup.com',    // sales support team
    'support@rickyrampersadbranch.com',                  // branch support inbox
  ],

  /* ---- the Salesforce task ------------------------------------------------
   * Asked for on 5 November 2026: "a claim is opened with a task". Until then a
   * filed claim became a Claims__c row in the ledger and nothing else, so it
   * appeared on the client's record and in nobody's task list — and the one
   * thing a branch actually works from is a task list.
   *
   * OWNER is resolved to a Salesforce User by e-mail, and only an ACTIVE
   * STANDARD user: the branch manager's address also sits on four site guest
   * users in this org (gblOwnerId_ in GroupBilling.gs found that the hard way),
   * and a task owned by a guest user is a task nobody will ever see. The
   * `CLAIMS_TASK_OWNER` Script Property overrides it without a paste, and a
   * per-line address wins over the default when one is set. Unresolved, the
   * task still files — it lands on the integration user, and the claim's own
   * notes say so, which is recoverable. Not filing it would not be. */
  TASK: {
    ON: true,
    OWNER: { '': 'rickyrampersadsalessupport@myguardiangroup.com' },
    /* Task_Type__c, read off the branch's own tasks: the org's picklist carries
       Servicing, Pendings, Renewa/PDl/Bill, Lic/Staffing/SA/HR and this one.
       The space after the slash is the org's, not a typo. A value the org
       refuses is dropped and the task files without it. */
    TYPE: 'Claims/ Mat',
    DUE_WORKING_DAYS: 2,
  },

  /* ---- the claim record in Salesforce ------------------------------------
   * Asked for on 6 November 2026: "if its a claim it will create a claim on the
   * claim object related to the risk".
   *
   * OBJECT is `Claims_Revised__c`, NOT `Claims__c`. Measured on the live org
   * that day: Claims__c holds 3,509 records of which 994 are from 2015 and
   * exactly ONE is from 2026 — the branch stopped using it around 2016.
   * Claims_Revised__c is the live one: 21 this year, 34 in 2025, 59 in 2024,
   * continuous since 2019, and it is what GIRenewals.gs already reads for a
   * client's claims history. A ledger row written to the dead object is a row
   * nobody will ever look at.
   *
   * THE VEHICLE OR THE TRANSACTION? Asked in those words on 6 November 2026.
   * Neither, and the describe is the authority rather than the field list:
   * Claims_Revised__c has exactly five lookups — Contact__c (master-detail,
   * REQUIRED), CLIENT_PORTFOLIO__c (master-detail, REQUIRED), Claims_Officer__c
   * (a Contact), Claims_Revis__c (an Account) and Requirement__c. No
   * Risk_Details__c and no TRANSACTIONS__c, and its only custom child is
   * Requirement_Claims__c. All 25 of the most recent records agree: every one
   * hangs off a CLIENT_PORTFOLIO__c whose record type is the line (MOTOR,
   * HEALTH, HEALTH (GROUP), PROPERTY, LIFE) plus the client's Contact.
   *
   * BUT THE CLAIM AND THE VEHICLE MEET AT THE POLICY RECORD, which is what
   * makes "related to the risk" true without a new field. Risk_Details__c — the
   * vehicle — has TWO required parents of its own: TRANSACTIONS__c (the billing
   * record) and Client_Portfolio_Look_Up__c (the policy record). So a claim
   * written on the client's MOTOR policy record sits on the same parent as
   * every vehicle term of that policy, and from the vehicle the claim is one
   * hop away. That is why the register now carries 'Portfolio Id' off the
   * vehicle's own Client_Portfolio_Look_Up__c (see registerSheet_), and why
   * sfClaimParents_ prefers it for a motor claim.
   *
   * RISK_FIELD would be the API name of a lookup from the claim to
   * Risk_Details__c. It is EMPTY on purpose: the describe proves no such field
   * exists, so sending one is a guaranteed failed insert on every claim — two
   * Salesforce calls instead of one, on a page a client is waiting on, and an
   * error in the log on every single claim, which hides the real ones. Set it
   * to 'Risk_Details__c' (or whatever it is called) the day an admin adds the
   * lookup; nothing else changes, and the attempt is dropped if the org still
   * refuses it (gblSfwSave_'s rule in GroupBilling.gs).
   *
   * Meanwhile the vehicle is carried the way the branch's own 35 motor claims
   * carry it: the plate in Vehicle__c (Text(7)), letters and digits only and no
   * separator — 'TAA1234', not 'TAA 1234' — which is exactly what normKey_ and
   * data/build-vehicle-register.py's norm_reg already produce. (The example is
   * invented. This file is served from the repository root, so a real
   * registration in a comment is a published one.) The TERM and the
   * Risk_Details__c id are named in Notes__c, so which year of cover the claim
   * attached to is on the record in words even without the lookup.
   *
   * Never Policy__c: it is a FORMULA field on both objects, and Salesforce
   * rejects a write to one. Never Vehiclee__c: a duplicate field, null on every
   * record the branch has ever made. */
  SF_CLAIM: {
    ON: true,
    OBJECT: 'Claims_Revised__c',
    RISK_FIELD: '',
    /* Claim_Type__c picklist values the branch has actually used, counted on
       the live org: Health 183, Motor 35, Property 14, Life 3, Critical Illness
       1, Other 1. Pension has no value of its own, so it takes Other. */
    TYPES: {
      motor: 'Motor', health: 'Health', property: 'Property',
      life: 'Life', pension: 'Other',
    },
  },

  FROM_NAME: 'Ricky Rampersad — Claims TT',
  AGENT_NAME: 'Ricky Rampersad',
  AGENT_PHONE: '(868) 678-5921',
  BRANCH_HOURS: 'Monday to Friday, 8:00am – 4:00pm',

  /* ---- storage ------------------------------------------- */

  DRIVE_ROOT: 'Claims TT — Ricky Rampersad Branch',
  CLAIMS_SHEET: 'Claims',
  FILES_SHEET: 'Claim Files',
  LOG_SHEET: 'Claim Log',

  // Built by data/build-vehicle-register.py from the Salesforce export and
  // imported here. This is what lets a claimant type a number plate instead
  // of hunting for their chassis number at the roadside.
  REGISTER_SHEET: 'Vehicle Register',

  // Built by data/build-policy-register.py from CLIENT_PORTFOLIO__c — the
  // non-motor twin of the vehicle register. Health, life, pension and
  // personal-accident claimants type their policy or plan number and their
  // details fill themselves in.
  POLICY_REGISTER_SHEET: 'Policy Register',

  // Who may open the staff dashboard (claims/staff.html): one row per person
  // on this tab — Email, Name, Role, Active. Only Active=Y emails can sign in.
  STAFF_SHEET: 'Staff',

  /* ---- the 10-working-day promise --------------------------- */

  // The acknowledgement tells the client their claim will be reviewed within
  // this many WORKING days (weekends and the holidays below skipped) — the
  // same turnaround the branch has always promised on the health form. When
  // the date arrives and the claim is still open, the assigned staff member
  // gets the review checklist automatically.
  REVIEW_WORKING_DAYS: 10,

  // Trinidad & Tobago non-working days. Fixed-date holidays recur every
  // year; the moveable ones (Carnival, Good Friday, Easter Monday, Corpus
  // Christi, Eid, Divali) must be topped up each year — one minute, once a
  // year, from any public holiday calendar.
  HOLIDAYS: [
    // fixed — every year
    '01-01',            // New Year's Day
    '03-30',            // Spiritual Baptist Liberation Day
    '05-30',            // Indian Arrival Day
    '06-19',            // Labour Day
    '08-01',            // Emancipation Day
    '08-31',            // Independence Day
    '09-24',            // Republic Day
    '12-25', '12-26',   // Christmas, Boxing Day
    // moveable — listed per year (branch also closes Carnival Mon/Tue)
    '2026-02-16', '2026-02-17',   // Carnival
    '2026-03-20',                 // Eid-ul-Fitr (approx.)
    '2026-04-03', '2026-04-06',   // Good Friday, Easter Monday
    '2026-06-04',                 // Corpus Christi
    '2026-11-08',                 // Divali (approx.)
    '2027-02-08', '2027-02-09',   // Carnival
    '2027-03-10',                 // Eid-ul-Fitr (approx.)
    '2027-03-26', '2027-03-29',   // Good Friday, Easter Monday
    '2027-05-27',                 // Corpus Christi
    '2027-10-29',                 // Divali (approx.)
  ],

  /* ---- sign-in (one-time codes, no passwords) ------------- */

  // A client or staff member signs in with their email (clients may also use
  // their mobile) and receives a 6-digit code by email. No passwords exist
  // anywhere in this system, so there is nothing to forget, reset, or steal.
  CODE_TTL_MINUTES: 10,
  CODE_MAX_TRIES: 5,
  CODE_SENDS_PER_HOUR: 3,
  CLIENT_SESSION_DAYS: 30,
  STAFF_SESSION_HOURS: 12,

  /* ---- automated follow-up ------------------------------- */

  // Days after filing to chase the client for outstanding documents.
  // The sequence stops the moment nothing is outstanding, or the claim
  // reaches a closed status.
  CHASE_DAYS: [3, 7, 14, 21, 30],

  // Days with no movement before the *desk* gets nudged about a claim
  // that is still open.
  DESK_NUDGE_DAYS: [10, 25, 45],

  // Statuses that end all follow-up.
  CLOSED_STATUSES: ['Settled', 'Declined', 'Closed'],

  // Where the feedback link in a closing email points. This is this web
  // app's own /exec URL — the survey page is served by doGet below, so
  // the rating works even while claims/index.html is still unwired.
  // Left '' a closed claim logs 'survey-skipped' rather than mailing a
  // link that goes nowhere.
  SURVEY_URL: '',

  /* ---- limits -------------------------------------------- */

  MAX_FILE_MB: 15,        // per document, after the browser compresses photos
  MAX_FILES: 30,          // per claim
  CHUNK_TTL_MINUTES: 60,  // abandoned upload parts are swept after this

  /* ---- light abuse control ------------------------------- */

  // Shared with claims/index.html. This travels in the page's
  // JavaScript so it is NOT a secret — it only stops drive-by
  // posting from bots that never loaded the page. Change both
  // sides together.
  SITE_KEY: 'claims-tt-2026-rrb',

  // Statuses used on the Claims tab and shown to the client.
  STATUSES: ['Received', 'Under review', 'Awaiting documents', 'With adjuster',
             'Approved', 'Settled', 'Declined', 'Closed'],

  // Test mode reroutes every email here instead of clients/desks.
  // Leave '' to use the account that owns the script (you).
  TEST_INBOX: '',
};

var CBRAND = { navy: '#0E2A47', blue: '#1C4E80', teal: '#0E8C8C', gold: '#F2B33D', light: '#E9F7F6' };

/* ============================ test mode ============================
 * Same pattern as the renewals backend: a Script Properties switch, so
 * flipping it needs no redeploy. While ON, every email — desk, client,
 * chase — is rerouted to TEST_INBOX with a [TEST] subject and a banner
 * naming the real recipients. File a test claim end to end and nothing
 * ever reaches a client or a claims desk.
 *
 * ONE exception, and it is the sign-in code: see sendMail_ below.      */

function testMode_() {
  return PropertiesService.getScriptProperties().getProperty('TEST_MODE') === 'on';
}

function testInbox_() {
  return CLAIMS.TEST_INBOX || Session.getEffectiveUser().getEmail();
}

/** Addresses the branch itself trusts: anyone active on the Staff tab,
 *  anyone on MAIL_CC, the account that owns the script, and anything named
 *  in the CLAIMS_TESTERS property (comma separated). Never a client — a
 *  client is known by their claim, which is not on any of these lists. */
function claimsTester_(email) {
  var want = String(email || '').trim().toLowerCase();
  if (!want) return false;
  var list = CLAIMS.MAIL_CC.slice();
  try { list.push(Session.getEffectiveUser().getEmail()); } catch (e) {}
  try { list.push(testInbox_()); } catch (e) {}
  String(PropertiesService.getScriptProperties().getProperty('CLAIMS_TESTERS') || '')
    .split(/[,;\s]+/).forEach(function (a) { if (a) list.push(a); });
  for (var i = 0; i < list.length; i++) {
    if (String(list[i]).trim().toLowerCase() === want) return true;
  }
  try { if (staffByEmail_(want)) return true; } catch (e) {}
  return false;
}

function testBanner_(inner) {
  return '<div style="background:#b3261e;color:#fff;padding:10px 16px;border-radius:6px;' +
    'margin:0 0 14px;font-family:Arial,sans-serif;font-size:13px">' +
    '<b>🧪 TEST MODE</b> — ' + inner + '</div>';
}

/** Single gate for ALL outgoing mail. Live: passes straight through.
 *
 *  ONE exception in test mode, decided 5 November 2026 because the branch
 *  manager could not sign in at all: a SIGN-IN CODE for an address the
 *  branch itself trusts goes to that address, marked [TEST], with the test
 *  inbox copied. A code delivered somewhere else is a code nobody can use,
 *  which makes the whole sign-in untestable — the exact fault the motor
 *  quote hit ("the sign-in code included, so an agent could never sign in")
 *  and fixed with mqTester_.
 *
 *  THE GATE DECIDES WHO QUALIFIES, NEVER THE CALLER. `signIn` alone cannot
 *  get mail out of test mode: claimsTester_ has to agree, so a client's own
 *  sign-in code still reroutes and no client ever hears from a test. */
function sendMail_(opts) {
  /* Copy and strip OUR OWN flag first, on every path: MailApp.sendEmail
     validates the options object it is handed, and a live sign-in code is
     the last thing that should fall over on a field we invented. */
  var o = {};
  for (var k in opts) o[k] = opts[k];
  delete o.signIn;

  if (!testMode_()) { MailApp.sendEmail(o); return; }

  if (opts.signIn && claimsTester_(opts.to)) {
    o.cc = testInbox_();
    delete o.bcc; delete o.replyTo;
    o.subject = '[TEST] ' + (opts.subject || '');
    if (o.htmlBody) {
      o.htmlBody = testBanner_('this is a sign-in code, so it came to you rather than to the ' +
        'test inbox. Every other claims email is still going to ' + esc_(testInbox_()) +
        ' instead of its real recipient.') + o.htmlBody;
    }
    MailApp.sendEmail(o);
    return;
  }

  var would = 'To: ' + (opts.to || '(none)') + (opts.cc ? ' · CC: ' + opts.cc : '');
  delete o.cc; delete o.bcc; delete o.replyTo;
  o.to = testInbox_();
  o.subject = '[TEST] ' + (opts.subject || '');
  if (o.htmlBody) {
    o.htmlBody = testBanner_('nothing was sent to the real recipients.<br>' +
      'Would have gone to — ' + esc_(would)) + o.htmlBody;
  }
  MailApp.sendEmail(o);
}

function testModeOn_() {
  PropertiesService.getScriptProperties().setProperty('TEST_MODE', 'on');
  SpreadsheetApp.getUi().alert('🧪 Test mode is ON.\n\nEvery email now goes to ' + testInbox_() +
    ' with a [TEST] banner. Nothing can reach a client or a claims desk until you turn it off.');
}

function testModeOff_() {
  PropertiesService.getScriptProperties().deleteProperty('TEST_MODE');
  SpreadsheetApp.getUi().alert('Test mode is OFF — emails go to real recipients again.');
}

/** Human labels for the claim types the site offers. */
var CLAIM_TYPES = {
  motor:    { label: 'Motor',                   icon: '🚗' },
  health:   { label: 'Health / Medical',        icon: '🏥' },
  property: { label: 'Home / Property',         icon: '🏠' },
  life:     { label: 'Life / Critical Illness', icon: '🕊️' },
  pension:  { label: 'Pension / Annuity',       icon: '📈' },
};


/* ============================ sheet plumbing ============================ */

function cs_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function namedSheet_(name, headers) {
  var sh = cs_().getSheetByName(name);
  if (!sh) {
    sh = cs_().insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground(CBRAND.light);
    return sh;
  }
  /* A column added to this file after the tab was made has to be added to the
     tab, by name, or it is invisible: every reader here keys on the header text
     and getLastColumn() counts the data rows, so a row written one column wider
     than its header comes back under a blank key. Appended at the end, never
     reordered, so a tab somebody has already sorted or filtered is untouched. */
  var last = sh.getLastColumn();
  var have = {};
  sh.getRange(1, 1, 1, Math.max(last, 1)).getValues()[0].forEach(function (h) {
    have[String(h).trim()] = true;
  });
  var add = headers.filter(function (h) { return !have[h]; });
  if (add.length) {
    sh.getRange(1, last + 1, 1, add.length).setValues([add])
      .setFontWeight('bold').setBackground(CBRAND.light);
  }
  return sh;
}

var CLAIM_COLUMNS = [
  'Timestamp', 'Reference', 'Status', 'Claim Type', 'Sub-type',
  'Client Name', 'Policy #', 'Mobile', 'Email', 'National ID',
  'Incident Date', 'Incident Time', 'Location', 'Description',
  'Estimated Amount (TT$)', 'Police Report #', 'Police Station',
  'Third Party', 'Bank Details', 'Files', 'Missing Documents',
  'Drive Folder', 'Claim Form PDF', 'Assigned To', 'Internal Notes',
  'Follow-ups Sent', 'Review Due', 'Last Updated',
  /* What the claim's own checks flagged, and what the client said about each —
     the thing the desk most wants to read before it picks the file up. In the
     client's own words, so an assessor can weigh it rather than guess. */
  'Flagged Checks',
  /* Everything the claim answered that has no column of its own: the permit and
     its two dates, the vehicle details off the register, the policy's own cover
     period. JSON, because the set differs by claim type and a column per answer
     would make this tab unreadable. Read back by claimObject_ as claim.extra. */
  'Answers (JSON)',
];

/* ---- working-day arithmetic ---- */

function isWorkingDay_(d) {
  var day = d.getDay();
  if (day === 0 || day === 6) return false;
  var tz = Session.getScriptTimeZone() || 'America/Port_of_Spain';
  var full = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  var monthDay = Utilities.formatDate(d, tz, 'MM-dd');
  return CLAIMS.HOLIDAYS.indexOf(full) < 0 && CLAIMS.HOLIDAYS.indexOf(monthDay) < 0;
}

/** The date n working days after `from` — the 10-working-day promise. */
function addWorkingDays_(from, n) {
  var d = new Date(from.getTime());
  var added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay_(d)) added++;
  }
  return d;
}

function claimsSheet_() {
  var sh = namedSheet_(CLAIMS.CLAIMS_SHEET, CLAIM_COLUMNS);
  ensureClaimCols_(sh);
  return sh;
}

/** Add any column this version of the script expects but the sheet lacks. */
function ensureClaimCols_(sh) {
  var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  CLAIM_COLUMNS.forEach(function (name) {
    if (headers.indexOf(name) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(name).setFontWeight('bold').setBackground(CBRAND.light);
      headers.push(name);
    }
  });
}

/** Append a claim by header name, so column order never has to be remembered. */
function appendClaim_(vals) {
  var sh = claimsSheet_();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(headers.map(function (h) { return (h in vals) ? vals[h] : ''; }));

  /* Sheets parses '2026-11-01' into a Date and '14:30' into a time on 30
     December 1899, and neither reads back as the client typed it — the second
     put the WRONG TIME OF LOSS on the desk notice. So those two cells are set
     to plain text and written again. It is the house rule a month cell taught
     twice over: a value that looks like a date is not what you wrote.
     iso_ and hhmm_ still read the rows stored before this. */
  var row = sh.getLastRow();
  ['Incident Date', 'Incident Time'].forEach(function (h) {
    var c = headers.indexOf(h);
    if (c < 0 || !(h in vals)) return;
    var cell = sh.getRange(row, c + 1);
    cell.setNumberFormat('@');
    cell.setValue(String(vals[h] === null || vals[h] === undefined ? '' : vals[h]));
  });
}

function filesSheet_() {
  return namedSheet_(CLAIMS.FILES_SHEET,
    ['Timestamp', 'Reference', 'Document', 'File Name', 'Size (KB)', 'Type', 'Drive Link']);
}

function logSheet_() {
  return namedSheet_(CLAIMS.LOG_SHEET, ['Timestamp', 'Reference', 'Event', 'By', 'Details']);
}

function logClaim_(ref, event, by, details) {
  logSheet_().appendRow([new Date(), ref, event, by || 'client', String(details || '').slice(0, 900)]);
}

function headerMap_(sheet) {
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var m = {};
  h.forEach(function (name, i) { m[String(name).trim().toLowerCase()] = i; });
  return m;
}

/** Find a claim's row on the Claims tab. Returns {row, values, map} or null. */
function findClaim_(ref) {
  ref = String(ref || '').trim().toUpperCase();
  if (!ref) return null;
  var sh = claimsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var map = headerMap_(sh);
  var col = map['reference'] + 1;
  var refs = sh.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]).trim().toUpperCase() === ref) {
      var row = i + 2;
      return { row: row, values: sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0], map: map, sheet: sh };
    }
  }
  return null;
}

function setClaimField_(hit, field, value) {
  var idx = hit.map[String(field).toLowerCase()];
  if (idx === undefined) return;
  hit.sheet.getRange(hit.row, idx + 1).setValue(value);
  hit.values[idx] = value;
}

function claimField_(hit, field) {
  var idx = hit.map[String(field).toLowerCase()];
  return idx === undefined ? '' : hit.values[idx];
}


/* ============================ Drive plumbing ============================ */

/** The one root folder that holds every claim, remembered by id. */
function rootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CLAIMS_ROOT_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* deleted — rebuild below */ }
  }
  var it = DriveApp.getFoldersByName(CLAIMS.DRIVE_ROOT);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(CLAIMS.DRIVE_ROOT);
  props.setProperty('CLAIMS_ROOT_ID', folder.getId());
  return folder;
}

function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** Claims TT / 2026 / CLM-2608-4821 — Jane Doe — Motor */
function claimFolder_(ref, clientName, type) {
  var year = String(new Date().getFullYear());
  var yearFolder = childFolder_(rootFolder_(), year);
  var label = (CLAIM_TYPES[type] && CLAIM_TYPES[type].label) || 'Claim';
  var name = ref + ' — ' + safeName_(clientName || 'Client') + ' — ' + label;
  return childFolder_(yearFolder, name);
}

/** Scratch space for in-flight upload chunks. */
function partsFolder_() {
  return childFolder_(rootFolder_(), '_upload-parts');
}

function safeName_(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}


/* ============================ references ============================ */

/** CLM-YYMM-NNNN, checked against the sheet so it is never reused. */
function newReference_() {
  var d = new Date();
  var stamp = String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2);
  for (var attempt = 0; attempt < 40; attempt++) {
    var ref = 'CLM-' + stamp + '-' + String(Math.floor(1000 + Math.random() * 9000));
    if (!findClaim_(ref)) return ref;
  }
  // Vanishingly unlikely — fall back to a timestamp tail.
  return 'CLM-' + stamp + '-' + String(d.getTime()).slice(-6);
}


/* ============================ small helpers ============================ */

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtMoney_(v) {
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  if (!v || isNaN(n) || !n) return '';
  return 'TT$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clean_(v, max) {
  return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 300);
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Port_of_Spain', 'dd MMM yyyy, h:mm a');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function typeLabel_(type) {
  return (CLAIM_TYPES[type] && CLAIM_TYPES[type].label) || 'Claim';
}

/** The confirmed desk for a line, or '' when there is none. Never a guess. */
function deskFor_(type) {
  var ok = CLAIMS.DESK_OK || [];
  if (ok.indexOf(type) >= 0 && CLAIMS.DESK[type]) return CLAIMS.DESK[type];
  return CLAIMS.DESK_DEFAULT || '';
}

/** Why a claim was not forwarded, in words the branch can act on. */
function deskGap_(type) {
  if (deskFor_(type)) return '';
  var label = typeLabel_(type) || type;
  return 'This claim was NOT forwarded to a claims desk: the address for ' + label +
    ' has not been confirmed yet. It is filed, the documents are in Drive, and the ' +
    'client has been acknowledged — someone has to pass it on by hand until ' +
    'CLAIMS.DESK.' + type + ' is set and "' + type + '" is added to CLAIMS.DESK_OK.';
}

function ccList_(type) {
  var extra = (CLAIMS.DESK_CC && CLAIMS.DESK_CC[type]) || [];
  var seen = {}, out = [];
  CLAIMS.MAIL_CC.concat(extra).forEach(function (a) {
    var k = String(a || '').trim().toLowerCase();
    if (!k || seen[k]) return;
    seen[k] = 1; out.push(String(a).trim());
  });
  return out.join(',');
}

/** Last four digits of a mobile number, used to gate status lookups. */
function last4_(mobile) {
  var digits = String(mobile || '').replace(/\D/g, '');
  return digits.slice(-4);
}


/* ============================ Salesforce ============================

 * The system reads Salesforce itself — no CSV exports, no imports.
 *
 *   1. NIGHTLY SYNC (~3am): CLIENT PORTFOLIO and Risk Details are pulled
 *      over the REST API and rebuilt into the Policy Register and Vehicle
 *      Register tabs. The tabs are just a fast, normalized index — the
 *      truth stays in Salesforce.
 *   2. LIVE FALLBACK: a policy the sync hasn't seen yet (sold this
 *      morning, fixed this morning) is looked up in Salesforce directly
 *      at claim time.
 *   3. WRITE-BACK: every filed claim becomes a Claims__c record —
 *      Opened, dated, policy-linked — so the branch ledger fills itself
 *      in instead of depending on someone remembering to type it.
 *
 * Credentials: a Connected App (client-credentials flow) that a
 * Salesforce admin creates once — see CLAIMS-SETUP.md. The consumer key
 * and secret are stored in SCRIPT PROPERTIES via the "Connect
 * Salesforce" menu, NEVER in this file: this file is served on the
 * public website. Until credentials are entered, everything degrades
 * gracefully to the register tabs.
 * =================================================================== */

function sfProps_() {
  var p = PropertiesService.getScriptProperties();
  return {
    domain: p.getProperty('SF_DOMAIN') || '',        // e.g. https://yourorg.my.salesforce.com
    id: p.getProperty('SF_CLIENT_ID') || '',
    secret: p.getProperty('SF_CLIENT_SECRET') || '',
    writeClaims: p.getProperty('SF_WRITE_CLAIMS') !== 'off',   // on by default once connected
    writeTasks: p.getProperty('SF_WRITE_TASKS') !== 'off',     // likewise, see CLAIMS.TASK
  };
}

function sfConnected_() {
  var c = sfProps_();
  return !!(c.domain && c.id && c.secret);
}

/** OAuth client-credentials token, cached for ~50 minutes. */
function sfToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('sf-token');
  if (cached) return cached;
  var c = sfProps_();
  if (!sfConnected_()) throw new Error('Salesforce is not connected.');
  var res = UrlFetchApp.fetch(c.domain + '/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'client_credentials', client_id: c.id, client_secret: c.secret },
  });
  var body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200 || !body.access_token) {
    throw new Error('Salesforce sign-in failed: ' + (body.error_description || body.error || res.getResponseCode()));
  }
  cache.put('sf-token', body.access_token, 3000);
  return body.access_token;
}

/** Run a SOQL query over REST, following pagination to the end. */
function sfQuery_(soql) {
  var c = sfProps_();
  var records = [];
  var url = c.domain + '/services/data/v60.0/query?q=' + encodeURIComponent(soql);
  for (var hop = 0; hop < 40 && url; hop++) {
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + sfToken_() }, muteHttpExceptions: true,
    });
    var body = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() !== 200) {
      throw new Error('Salesforce query failed: ' + (body[0] && body[0].message || res.getResponseCode()));
    }
    records = records.concat(body.records || []);
    url = body.nextRecordsUrl ? c.domain + body.nextRecordsUrl : '';
  }
  return records;
}

/** Create one record. Returns the new Id, or throws. */
function sfCreate_(objectName, fields) {
  var c = sfProps_();
  var res = UrlFetchApp.fetch(c.domain + '/services/data/v60.0/sobjects/' + objectName, {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + sfToken_() },
    payload: JSON.stringify(fields), muteHttpExceptions: true,
  });
  var body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() >= 300 || !body.id) {
    throw new Error('Salesforce create failed: ' +
      ((body[0] && body[0].message) || body.message || res.getContentText().slice(0, 200)));
  }
  return body.id;
}

/** Update one record. Returns true, or throws. */
function sfPatch_(objectName, id, fields) {
  var c = sfProps_();
  var res = UrlFetchApp.fetch(c.domain + '/services/data/v60.0/sobjects/' + objectName + '/' + id, {
    method: 'patch', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + sfToken_() },
    payload: JSON.stringify(fields), muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    var body = JSON.parse(res.getContentText() || '{}');
    throw new Error('Salesforce update failed: ' +
      ((body[0] && body[0].message) || body.message || res.getContentText().slice(0, 200)));
  }
  return true;
}


/* ============================ the permit, written back ============================

 * Asked for on 3 November 2026: "if we don't have it and they put in the driver's
 * permit, it updates our records. It updates the issue date and the expiry date
 * as well."
 *
 * This is the valuable half of the permit work, because the cupboard is nearly
 * bare: measured on the live org that day, a permit number sits on about one
 * CLIENT contact in sixteen, an expiry on one in twenty-eight and an issue date
 * on one in three hundred. A client filing a claim has the permit in their hand
 * and Guardian's form demands all three, so this is the one moment in the year
 * when the record can be filled in by the only person who can read it.
 *
 * The rules are MotorQuote's own (mqPermitPlan_), and they exist so that one
 * mistyped digit on a bad morning cannot spoil a record that was right:
 *
 *   - a blank is filled;
 *   - a LATER expiry replaces an earlier one, and carries its issue date with it
 *     when that is later too — a renewed permit;
 *   - an EARLIER expiry is never written: a client reading an old permit must not
 *     roll the record backwards;
 *   - a DIFFERENT permit number is never written over one we hold. It is flagged
 *     for a person instead, because the other reading is that someone else was
 *     driving, and the claim's own checks already ask that question.
 *
 * Nothing here ever blocks a claim. Every refusal is a note on the claim row.
 * ============================================================================= */

function permitPlan_(given, held) {
  var out = { fields: {}, notes: [] };
  var num = String(given.number || '').trim();
  var heldNum = String(held.number || '').trim();
  var gi = iso_(given.issue), ge = iso_(given.expiry);
  var hi = iso_(held.issue), he = iso_(held.expiry);

  if (num) {
    if (!heldNum) { out.fields.DP__c = num; out.notes.push('permit number ' + num + ' added'); }
    else if (normKey_(num) !== normKey_(heldNum)) {
      /* Never silently. Either they mistyped, or a different person was driving. */
      out.notes.push('permit given as ' + num + ' but we hold ' + heldNum + ' — not changed, please check');
      return out;                       // and nothing else on this record is touched either
    }
  }

  if (ge) {
    if (!he) { out.fields.Driver_s_Permit_Expiry__c = ge; out.notes.push('permit expiry ' + ge + ' added'); }
    else if (ge > he) {
      out.fields.Driver_s_Permit_Expiry__c = ge;
      out.notes.push('permit expiry moved from ' + he + ' to ' + ge);
    } else if (ge < he) {
      out.notes.push('permit expiry given as ' + ge + ', earlier than the ' + he + ' we hold — not changed');
    }
  }

  if (gi) {
    /* The issue date rides with the expiry: on its own it tells us nothing new,
       and a renewal is the only reason it should move. */
    if (!hi) { out.fields.Drivers_Permit_Issue_Date__c = gi; out.notes.push('permit first issued ' + gi + ' added'); }
    else if (gi > hi && out.fields.Driver_s_Permit_Expiry__c) {
      out.fields.Drivers_Permit_Issue_Date__c = gi;
      out.notes.push('permit issue date moved from ' + hi + ' to ' + gi);
    }
  }

  return out;
}

/**
 * Write what the client typed back onto their Contact. Called after the claim
 * is filed and recorded, never before: the claim is the deliverable and a
 * Salesforce hiccup must not cost it.
 *
 * Returns a line for the claim's internal notes, or '' when there was nothing
 * to do. Never throws.
 */
function permitWriteBack_(claim) {
  try {
    if (claim.kind !== 'motor') return '';
    if (!sfConnected_()) return '';
    var a = claim.extra || {};
    var given = { number: a.driverPermit, issue: a.permitIssue, expiry: a.permitExpiry };
    if (!given.number && !given.issue && !given.expiry) return '';

    /* The Contact id and what we already hold both come off the register row the
       lookup matched, so this costs no extra read. Without a matched row there is
       nobody to write to — a claim filed by hand names no Salesforce record. */
    var reg = findVehicle_(a.vehicleReg || claim.policy || '');
    if (!reg) return '';
    var id = String(reg['Contact Id'] || '').trim();
    if (!id) return '';

    var plan = permitPlan_(given, {
      number: reg['Permit #'], issue: reg['Permit Issued'], expiry: reg['Permit Expires'],
    });
    if (!plan.notes.length) return '';

    var wrote = Object.keys(plan.fields).length;
    if (wrote) {
      sfPatch_('Contact', id, plan.fields);
      /* Keep the register in step, so the next claim on this vehicle reads the
         new value rather than waiting for the 3am sync. */
      permitRegisterUpdate_(a.vehicleReg || claim.policy || '', plan.fields);
    }
    logClaim_(claim.ref, wrote ? 'permit-updated' : 'permit-not-updated', 'system', plan.notes.join('; '));
    return 'Permit: ' + plan.notes.join('; ');
  } catch (err) {
    logClaim_(claim.ref, 'permit-write-failed', 'system', String(err));
    return 'Permit: could not be written to Salesforce (' + String(err).slice(0, 120) + ')';
  }
}

/** Put the same values on the register row, so the register does not lie until 3am.
 *
 *  EVERY row of that vehicle, not the first one that matches. The permit belongs
 *  to the insured, not to a year of cover, and since 5 November 2026 a vehicle
 *  has one register row per term — so writing only the first would leave the
 *  older terms carrying a permit the client has just corrected, and a claim on
 *  one of those terms would read it back. */
function permitRegisterUpdate_(query, fields) {
  try {
    var sh = registerSheet_();
    var last = sh.getLastRow();
    if (last < 2) return;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    var col = function (name) { return headers.indexOf(name) + 1; };
    var keyCol = col('Reg Key'), polCol = col('Policy Key');
    if (!keyCol) return;
    var want = normKey_(query);
    var keys = sh.getRange(2, keyCol, last - 1, 1).getValues();
    var pols = polCol ? sh.getRange(2, polCol, last - 1, 1).getValues() : null;
    var map = {
      DP__c: 'Permit #',
      Drivers_Permit_Issue_Date__c: 'Permit Issued',
      Driver_s_Permit_Expiry__c: 'Permit Expires',
    };
    /* The plate the policy number belongs to, so a client who quoted last
       year's policy number still has every one of their terms updated. */
    var plate = want;
    for (var p = 0; pols && p < keys.length; p++) {
      if (normKey_(pols[p][0]) === want && normKey_(keys[p][0])) { plate = normKey_(keys[p][0]); break; }
    }
    for (var i = 0; i < keys.length; i++) {
      if (normKey_(keys[i][0]) !== plate && !(pols && normKey_(pols[i][0]) === want)) continue;
      Object.keys(fields).forEach(function (f) {
        var c = col(map[f]);
        if (c) sh.getRange(i + 2, c).setValue(fields[f]);
      });
    }
  } catch (err) { /* the register catching up late is not worth failing a claim for */ }
}


/* ---- nightly register sync ---- */

/** CLIENT PORTFOLIO → Policy Register tab. Record Type separates the lines. */
function syncPolicyRegister() {
  var rows = sfQuery_(
    "SELECT Id, Name, RecordType.Name, POLICY__c, Product_Name__c, Contact__r.Name, Contact__c, " +
    "Email__c, Home_Tele__c, Home_Phone__c, Date_Of_Birth__c, Expiry_Date__c " +
    "FROM CLIENT_PORTFOLIO__c WHERE POLICY__c != null");
  var seen = {};
  var out = [];
  rows.forEach(function (r) {
    var key = normKey_(r.POLICY__c);
    if (key.length < 4 || seen[key]) return;
    seen[key] = true;
    var mobile = String(r.Home_Tele__c || '').replace(/\D/g, '').length >= 7 ? r.Home_Tele__c : (r.Home_Phone__c || '');
    out.push([
      key, String(r.POLICY__c || ''), String((r.RecordType || {}).Name || ''),
      String((r.Contact__r || {}).Name || r.Name || ''),
      String(r.Email__c || '').toLowerCase(), String(mobile || ''),
      String(r.Date_Of_Birth__c || ''), String(r.Product_Name__c || ''),
      String(r.Expiry_Date__c || ''), String(r.Name || ''),
      String(r.Contact__c || ''), String(r.Id || ''),
    ]);
  });
  var sh = policyRegisterSheet_();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, out[0].length).setValues(out);
  logClaim_('(sync)', 'policy-register-synced', 'system', out.length + ' policies from Salesforce');
  return out.length;
}

/** Risk Details → Vehicle Register tab: ONE ROW PER VEHICLE PER TERM.
 *
 *  The split that makes this work is between what belongs to the VEHICLE and
 *  what belongs to the TERM.
 *
 *  Identity — the plate, make, model, model year, chassis, engine, and the
 *  insured's name, e-mail, mobile and permit — belongs to the vehicle, so it is
 *  merged across every term the way the whole row used to be: the newest
 *  non-blank value wins and a blank never erases what an older year knew. That
 *  is what recovers a chassis number recorded once in 2019 and never again, and
 *  it now fills in the OLD rows too, which the single-row version could not do.
 *
 *  Cover — the period, the sum insured, the windscreen limit, the coverage
 *  type, the carrier, the policy number and the vehicle's status — belongs to
 *  the term, and is never merged. A claim for an accident in 2023 has to be
 *  assessed against 2023's sum insured on 2023's policy number, and the single
 *  row only ever held this year's.
 *
 *  Two terms with the same period are ONE term. The renewal desk found
 *  Salesforce holding exact duplicate cover rows (girDedupe_ in GIRenewals.gs,
 *  which is why last year's premium came out at two or three times the bill),
 *  so they are merged here rather than written twice.
 *
 *  Newest term first within a plate, which is what keeps findVehicle_ — and so
 *  the sign-in, the prefill and the permit write-back — reading this year's
 *  cover with no change to any of them. */
function syncVehicleRegister() {
  // Field names verified against the live org: the plate is Vehicle__c, the
  // make Vehicle_Make__c, the model year Year_of_Manufacture__c (Year__c is
  // the policy year), the sum insured Cover1__c, and the client hangs off
  // the Insured__c contact lookup.
  var rows = sfQuery_(
    "SELECT Id, Policy__c, Vehicle__c, Vehicle_Make__c, Model__c, Year_of_Manufacture__c, " +
    "Chassis__c, Engine__c, Motor_Vehicle_Coverage_Type__c, Cover1__c, Windscreen__c, " +
    "Carrier__c, From__c, To__c, Vehicle_Status__c, Contact__c, Email__c, " +
    "Client_Portfolio_Look_Up__c, " +
    "Insured__r.Name, Insured__r.Email, Insured__r.MobilePhone, Insured__c, " +
    "Insured__r.DP__c, Insured__r.Drivers_Permit_Issue_Date__c, Insured__r.Driver_s_Permit_Expiry__c " +
    "FROM Risk_Details__c WHERE Vehicle__c != null ORDER BY To__c NULLS FIRST");

  /* Client_Portfolio_Look_Up__c is NOT in TERM_FIELDS, deliberately. A term's
     other fields take the last row's value; its Risk Id takes the FIRST row's
     (see the tie-break below). If the policy record followed TERM_FIELDS then a
     duplicate pair could give the term a policy record belonging to a different
     row than the Risk Id it names — and the claim would be parented on one
     record while naming another. It is read off the same row as the Id. */
  var TERM_FIELDS = ['Motor_Vehicle_Coverage_Type__c', 'Cover1__c', 'Windscreen__c',
    'Carrier__c', 'From__c', 'To__c', 'Vehicle_Status__c', 'Policy__c'];
  var ID_FIELDS = ['Vehicle__c', 'Vehicle_Make__c', 'Model__c',
    'Year_of_Manufacture__c', 'Chassis__c', 'Engine__c'];
  var set = function (into, from, fields) {
    fields.forEach(function (f) {
      if (from[f] !== null && from[f] !== undefined && String(from[f]).trim() !== '') into[f] = from[f];
    });
  };

  var cars = {};
  rows.forEach(function (r) {
    var key = normKey_(r.Vehicle__c);
    if (key.length < 4 || key.length > 8 || !/\d/.test(key)) return;
    var car = cars[key] || (cars[key] = { ident: {}, terms: {}, order: [] });

    // Identity: the vehicle's, merged across every term it has ever had.
    set(car.ident, r, ID_FIELDS);
    var contact = r.Insured__r || {};
    var ident = car.ident;
    if (contact.Name || r.Contact__c) ident.client = contact.Name || r.Contact__c;
    if (contact.Email || r.Email__c) ident.email = contact.Email || r.Email__c;
    if (contact.MobilePhone) ident.mobile = contact.MobilePhone;
    if (contact.DP__c) ident.permit = contact.DP__c;
    if (contact.Drivers_Permit_Issue_Date__c) ident.permitIssue = contact.Drivers_Permit_Issue_Date__c;
    if (contact.Driver_s_Permit_Expiry__c) ident.permitExpiry = contact.Driver_s_Permit_Expiry__c;
    if (r.Insured__c) ident.insuredId = r.Insured__c;

    // Cover: the term's own, and the same period twice is the same term.
    var tk = iso_(r.From__c) + '|' + iso_(r.To__c);
    if (!car.terms[tk]) { car.terms[tk] = {}; car.order.push(tk); }
    set(car.terms[tk], r, TERM_FIELDS);
    /* The Id of the FIRST row that made this term, never a later duplicate's.
       Both records are real and either is a valid parent for a task, but the
       choice has to be stable or the register's Risk Id moves on every sync —
       and the first row is the fuller one in every duplicate pair seen so far.
       This is the renewal desk's own tie-break (girDedupe_: "else the first
       entered"), which has no billing record to prefer here. */
    if (!car.terms[tk].Id && r.Id) {
      car.terms[tk].Id = r.Id;
      car.terms[tk].portfolio = String(r.Client_Portfolio_Look_Up__c || '');
    }
    /* Only if the row that gave the Id had none. The lookup is required on
       Risk_Details__c, so in practice the first branch always fills it. */
    if (!car.terms[tk].portfolio && r.Client_Portfolio_Look_Up__c) {
      car.terms[tk].portfolio = String(r.Client_Portfolio_Look_Up__c);
    }
  });

  var out = [];
  Object.keys(cars).forEach(function (key) {
    var car = cars[key];
    var m = car.ident;
    var n = car.order.length;
    // Newest first: the query ran oldest-last, so reversing the order it saw
    // puts this year's cover at the top of the plate's rows.
    car.order.slice().reverse().forEach(function (tk) {
      var t = car.terms[tk];
      var from = iso_(t.From__c), to = iso_(t.To__c);
      out.push([key, String(m.Vehicle__c || ''), normKey_(t.Policy__c), String(t.Policy__c || ''),
        String(m.client || ''), String(m.email || '').toLowerCase(), String(m.mobile || ''),
        String(m.Vehicle_Make__c || ''), String(m.Model__c || ''), String(m.Year_of_Manufacture__c || ''),
        String(m.Chassis__c || ''), String(m.Engine__c || ''), String(t.Motor_Vehicle_Coverage_Type__c || ''),
        String(t.Cover1__c || ''), String(t.Windscreen__c || ''), String(t.Carrier__c || ''),
        from, to, String(t.Vehicle_Status__c || ''), n,
        String(m.permit || ''), String(m.permitIssue || ''), String(m.permitExpiry || ''),
        String(m.insuredId || ''),
        (from || to) ? (from || '?') + ' → ' + (to || '?') : '',
        String(t.Id || ''),
        String(t.portfolio || '')]);
    });
  });

  var sh = registerSheet_();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, out[0].length).setValues(out);
  logClaim_('(sync)', 'vehicle-register-synced', 'system',
    out.length + ' terms over ' + Object.keys(cars).length + ' vehicles from Salesforce');
  return out.length;
}

/** The nightly job. Each register fails independently — one bad field
 *  name in one object must not take down the other register.
 *
 *  VEHICLES GO FIRST, AND THAT ORDER MATTERS. The two registers are very
 *  different sizes: about 1,600 vehicles against about 54,000 policies, which
 *  is 28 pages of SOQL and half a million cells. Apps Script stops an
 *  execution at six minutes and a timeout is not catchable, so whichever
 *  register runs second is the one that silently never happens. The plate
 *  lookup is what the motor page leans on and it is the cheap one, so it
 *  runs first; policies have `sfFindPortfolio_` to fall back on, which asks
 *  Salesforce directly for anything the register has not seen. */
function salesforceNightlySync() {
  if (!sfConnected_()) return;
  var notes = [];
  try { notes.push(syncVehicleRegister() + ' cover terms'); }
  catch (err) { logClaim_('(sync)', 'vehicle-sync-failed', 'system', String(err)); notes.push('vehicles FAILED'); }
  try { notes.push(syncPolicyRegister() + ' policies'); }
  catch (err) { logClaim_('(sync)', 'policy-sync-failed', 'system', String(err)); notes.push('policies FAILED'); }
  return notes.join(', ');
}

/** Just the plate register, for when the policy half is what ran out of time.
 *  On the Claims TT menu as "Sync vehicles only (fast)". */
function syncVehiclesNow() {
  if (!sfConnected_()) {
    SpreadsheetApp.getUi().alert('Connect Salesforce first (Claims TT menu → Connect Salesforce).');
    return;
  }
  SpreadsheetApp.getUi().alert('Synced ' + syncVehicleRegister() +
    ' cover terms — one row per vehicle per year of cover.');
}

/* ---- live fallback lookup ---- */

/** A policy the nightly sync hasn't seen yet: ask Salesforce directly.
 *  SOQL cannot normalize, so the common punctuation variants are tried. */
function sfFindPortfolio_(query) {
  if (!sfConnected_()) return null;
  var raw = String(query || '').trim();
  var variants = {};
  [raw, raw.toUpperCase(), raw.replace(/\s+/g, ''), raw.toUpperCase().replace(/\s+/g, ''),
   raw.toUpperCase().replace(/[^A-Z0-9]+/g, ' '), raw.toUpperCase().replace(/[^A-Z0-9]+/g, '-')]
    .forEach(function (v) { if (v) variants[v.replace(/'/g, '')] = true; });
  var list = Object.keys(variants).map(function (v) { return "'" + v + "'"; }).join(',');
  try {
    var rows = sfQuery_(
      "SELECT Name, RecordType.Name, POLICY__c, Product_Name__c, Contact__r.Name, " +
      "Email__c, Home_Tele__c, Home_Phone__c, Date_Of_Birth__c " +
      "FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN (" + list + ") LIMIT 2");
    // Normalized comparison decides; exactly one match or nothing.
    var key = normKey_(query);
    var hits = rows.filter(function (r) { return normKey_(r.POLICY__c) === key; });
    if (hits.length !== 1) return null;
    var r = hits[0];
    var mobile = String(r.Home_Tele__c || '').replace(/\D/g, '').length >= 7 ? r.Home_Tele__c : (r.Home_Phone__c || '');
    return {
      'Policy Key': key, 'Policy #': String(r.POLICY__c || ''),
      'Line': String((r.RecordType || {}).Name || ''), 'Client': String((r.Contact__r || {}).Name || r.Name || ''),
      'Email': String(r.Email__c || '').toLowerCase(), 'Mobile': String(mobile || ''),
      'DOB': String(r.Date_Of_Birth__c || ''), 'Product': String(r.Product_Name__c || ''),
    };
  } catch (err) {
    logClaim_('(lookup)', 'sf-live-lookup-failed', 'system', String(err));
    return null;
  }
}

/* ---- claim write-back ---- */

/** The two parents a Claims_Revised__c record cannot be created without.
 *
 *  CLIENT_PORTFOLIO__c and Contact__c are both MASTER-DETAIL on that object,
 *  so both are required on insert — there is no filing one with a policy
 *  number alone. The registers hold the ids already, and a policy the sync has
 *  not seen yet is resolved live.
 *
 *  THE VEHICLE COMES FIRST on a motor claim, and that is the whole of "related
 *  to the risk" (see CLAIMS.SF_CLAIM). The matched term's own
 *  Client_Portfolio_Look_Up__c is the policy record that term was written
 *  under, so the claim lands on the same parent as the vehicle and on the right
 *  YEAR of it. The policy register is second best here for two reasons: it is
 *  built WHERE POLICY__c != null, and one of the branch's only two motor claims
 *  hangs off a MOTOR policy record with a null policy number; and it is keyed
 *  on the policy number, which changes between years while the vehicle does
 *  not.
 *
 *  Returns {portfolio, contact, line} with '' for anything it could not find.
 *  Never throws: the caller degrades to a note on the claim row. */
function sfClaimParents_(claim) {
  var out = { portfolio: '', contact: '', line: '' };
  var policyNo = String((claim.extra && claim.extra._policy && claim.extra._policy.policy) ||
    claim.policy || '').trim();

  // The vehicle term knows both ids for its own year of cover.
  var plate = String((claim.extra && claim.extra.vehicleReg) || '').trim();
  if (plate) {
    try {
      /* vehicleForClaim_ answers {row, terms, matched}, NOT a row — reading it
         as a row returns undefined for every field and says nothing about it,
         which is how both of these quietly wrote no Contact and no Risk the
         first time round. */
      var vhit = vehicleForClaim_(plate, iso_(claim.incidentDate));
      var vrow = (vhit && vhit.row) || findVehicle_(plate);
      if (vrow) {
        out.portfolio = String(vrow['Portfolio Id'] || '').trim();
        out.contact = String(vrow['Contact Id'] || '').trim();
      }
    } catch (err) { /* fall through to the policy register */ }
  }

  // The policy register knows both ids outright: every non-motor claim, and a
  // motor claim whose register row predates the 'Portfolio Id' column.
  if (policyNo && (!out.portfolio || !out.contact || !out.line)) {
    try {
      var prow = findPolicyRecord_(policyNo);
      if (prow) {
        out.portfolio = out.portfolio || String(prow['Portfolio Id'] || '').trim();
        out.contact = out.contact || String(prow['Contact Id'] || '').trim();
        out.line = out.line || String(prow['Line'] || '').trim();
      }
    } catch (err) { /* fall through to the live read */ }
  }

  // Anything still missing, and Salesforce is connected: ask it.
  if (policyNo && (!out.portfolio || !out.contact) && sfConnected_()) {
    try {
      var ids = sfPortfolioIds_(policyNo);
      if (ids) {
        out.portfolio = out.portfolio || ids.portfolio;
        out.contact = out.contact || ids.contact;
        out.line = out.line || ids.line;
      }
    } catch (err) { /* keep going */ }
  }
  return out;
}

/** Policy number -> {portfolio, contact, line} straight from Salesforce.
 *
 *  sfFindPortfolio_ next door selects neither Id nor Contact__c, because it
 *  exists to PREFILL a form and a client is never shown an id. This one exists
 *  to PARENT a record, so it asks for exactly the two ids and nothing else. */
function sfPortfolioIds_(policyNo) {
  var raw = String(policyNo || '').trim();
  if (!raw) return null;
  var variants = {};
  [raw, raw.toUpperCase(), raw.replace(/\s+/g, ''), raw.toUpperCase().replace(/\s+/g, ''),
   raw.toUpperCase().replace(/[^A-Z0-9]+/g, ' '), raw.toUpperCase().replace(/[^A-Z0-9]+/g, '-')]
    .forEach(function (v) { if (v) variants[v.replace(/'/g, '')] = true; });
  var list = Object.keys(variants).map(function (v) { return "'" + v + "'"; }).join(',');
  var rows = sfQuery_('SELECT Id, POLICY__c, Contact__c, RecordType.Name ' +
    'FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN (' + list + ') LIMIT 2');
  var key = normKey_(raw);
  var hits = rows.filter(function (r) { return normKey_(r.POLICY__c) === key; });
  if (hits.length !== 1) return null;
  return {
    portfolio: String(hits[0].Id || ''),
    contact: String(hits[0].Contact__c || ''),
    line: String((hits[0].RecordType || {}).Name || ''),
  };
}

/** The Risk_Details__c record this claim attached to: the exact term in force
 *  on the date of loss, which is the register's own 'Risk Id'. '' when the
 *  claim is not a motor claim or the plate matched nothing. */
function sfClaimRiskId_(claim) {
  var plate = String((claim.extra && claim.extra.vehicleReg) || '').trim();
  if (!plate) return '';
  try {
    // {row, terms, matched} — see the note in sfClaimParents_.
    var hit = vehicleForClaim_(plate, iso_(claim.incidentDate));
    var row = (hit && hit.row) || findVehicle_(plate);
    return row ? String(row['Risk Id'] || '').trim() : '';
  } catch (err) { return ''; }
}

/** Every filed claim becomes a claim record in the branch ledger.
 *
 *  Claims_Revised__c, related to the policy and the client by their two
 *  master-detail parents, carrying the plate and — once the org has a lookup
 *  for it — the exact Risk_Details__c term. See CLAIMS.SF_CLAIM for why the
 *  object changed, why Policy__c is never written, and what the branch's own
 *  motor claims look like. */
function sfLogClaim_(claim) {
  if (!sfConnected_() || !sfProps_().writeClaims || !CLAIMS.SF_CLAIM.ON) return '';
  if (testMode_()) { logClaim_(claim.ref, 'sf-writeback-skipped', 'system', 'test mode'); return ''; }

  var parents = sfClaimParents_(claim);
  if (!parents.portfolio || !parents.contact) {
    /* Both are master-detail, so there is no record to create without them.
       Said out loud on the claim rather than thrown: the claim is filed, the
       desk has it, and this is a thing a person can put right. */
    logClaim_(claim.ref, 'sf-claim-skipped', 'system',
      'no ' + (!parents.portfolio ? 'CLIENT PORTFOLIO' : 'Contact') + ' id for policy ' +
      (claim.policy || '(none given)') + ' — both are master-detail on ' +
      CLAIMS.SF_CLAIM.OBJECT + ', so the record cannot be created. File it by hand.');
    return '';
  }

  var amount = Number(String(claim.amount).replace(/[^0-9.]/g, '')) || 0;
  var riskId = sfClaimRiskId_(claim);
  var plate = normKey_((claim.extra && claim.extra.vehicleReg) || '');
  var term = (claim.extra && claim.extra._policy) || {};

  var notes = [];
  notes.push('Filed on ' + CLAIMS.DRIVE_ROOT.split('—')[0].trim() + ' as ' + claim.ref + '.');
  if (claim.subtype) notes.push('What happened: ' + claim.subtype + '.');
  if (term.coverFrom || term.coverTo) {
    notes.push('Assessed against the cover of ' + (term.coverFrom || '?') + ' to ' +
      (term.coverTo || '?') + (term.policy ? ' on policy ' + term.policy : '') + '.');
  }
  if (riskId && !CLAIMS.SF_CLAIM.RISK_FIELD) notes.push('Risk Details record: ' + riskId + '.');
  if (claim.flagged) notes.push('Flagged at filing: ' + claim.flagged);
  if (claim.folder) notes.push('Documents: ' + claim.folder);

  var fields = {};
  fields.CLIENT_PORTFOLIO__c = parents.portfolio;
  fields.Contact__c = parents.contact;
  fields.Claim_Type__c = CLAIMS.SF_CLAIM.TYPES[claim.kind] || 'Other';
  fields.Claim_Status__c = 'Opened';
  fields.Claim_Reference__c = String(claim.ref).slice(0, 30);
  fields.Date_Claim_Submitted__c = Utilities.formatDate(new Date(),
    Session.getScriptTimeZone() || 'America/Port_of_Spain', 'yyyy-MM-dd');
  /* iso_ again, not a bare read: the date the sheet hands back is a Date, and
     the yyyy-MM-dd test it used to face answered null without saying so. */
  if (iso_(claim.incidentDate)) fields.Service_Date__c = iso_(claim.incidentDate);
  if (plate) fields.Vehicle__c = plate.slice(0, 7);
  if (amount) fields.Submitted_Charges__c = amount;
  if (notes.length) fields.Notes__c = notes.join('<br>').slice(0, 30000);
  if (riskId && CLAIMS.SF_CLAIM.RISK_FIELD) fields[CLAIMS.SF_CLAIM.RISK_FIELD] = riskId;

  var id = '', dropped = [];
  try {
    id = sfCreate_(CLAIMS.SF_CLAIM.OBJECT, fields);
  } catch (err) {
    /* A field the org has not got is dropped and the record is created without
       it, never claimed as written — the Risk lookup is the one we expect to be
       missing, because no claims object in this org has one yet. */
    var bad = sfBadFields_(String(err && err.message ? err.message : err), fields);
    if (!bad.length) throw err;
    bad.forEach(function (f) { delete fields[f]; dropped.push(f); });
    id = sfCreate_(CLAIMS.SF_CLAIM.OBJECT, fields);
  }

  logClaim_(claim.ref, 'sf-claim-created', 'system',
    CLAIMS.SF_CLAIM.OBJECT + '/' + id +
    ' · policy ' + parents.portfolio + ' · contact ' + parents.contact +
    (plate ? ' · vehicle ' + plate : '') +
    (riskId ? ' · risk ' + riskId : '') +
    (dropped.length ? ' · the org refused: ' + dropped.join(', ') : ''));
  return id;
}

/** The field names in a Salesforce error, kept to the ones we actually sent.
 *
 *  Salesforce names them two ways and this reads both: INVALID_FIELD quotes
 *  'No such column 'X' on sobject', and INVALID_FIELD_FOR_INSERT_UPDATE says
 *  'Unable to create/update fields: X, Y'. */
function sfBadFields_(message, sent) {
  var msg = String(message || '');
  var out = [];
  Object.keys(sent).forEach(function (f) {
    if (msg.indexOf(f) > -1) out.push(f);
  });
  return out;
}


/* ============================ the task ============================
 *
 * Asked for on 5 November 2026: "a claim is opened with a task".
 *
 * Until this, a filed claim wrote one Claims__c row and nothing else. That row
 * is the ledger — it is on the client's record and it is what a report counts —
 * but it is not work anybody is shown, and the branch works from task lists.
 * So a claim could be filed, acknowledged, forwarded to Guardian General, and
 * still be sitting in nobody's day.
 *
 * It never throws. A claim that is recorded, acknowledged and forwarded has
 * done the important part; a task that could not be written is a line in the
 * log and a line in the claim's own notes, and the claim stands.
 */

/** The task's owner: an e-mail resolved to a Salesforce User, cached six hours.
 *
 *  ACTIVE and STANDARD, and exactly one match. The branch manager's own address
 *  sits on four site guest users in this org, and a task owned by a guest user
 *  is a task nobody will ever open; two standard users on one address is
 *  somebody's data problem and not something to guess at. Either way the task
 *  still files — it lands on the integration user — and the claim's notes say
 *  so, which is a thing a person can put right. */
function sfTaskOwnerId_(kind) {
  var map = CLAIMS.TASK.OWNER || {};
  var email = '';
  try { email = String(PropertiesService.getScriptProperties().getProperty('CLAIMS_TASK_OWNER') || '').trim(); }
  catch (err) { email = ''; }
  email = email || String(map[kind] || map[''] || '').trim();
  if (!email) return '';
  var cache = CacheService.getScriptCache();
  var ck = 'sf-user.' + email.toLowerCase();
  var hit = cache.get(ck);
  if (hit) return hit === '-' ? '' : hit;
  var id = '';
  try {
    var rows = sfQuery_("SELECT Id FROM User WHERE Email = '" + email.replace(/'/g, "\\'") +
      "' AND IsActive = true AND UserType = 'Standard' LIMIT 2");
    if (rows.length === 1) id = rows[0].Id;
  } catch (err) { id = ''; }
  cache.put(ck, id || '-', 21600);
  return id;
}

/** The Salesforce records this claim belongs to.
 *
 *  Motor comes off the vehicle register, on the term in force on the date of
 *  loss — so the task hangs off the year's cover the claim is actually assessed
 *  against, not whatever was renewed since. Everything else comes off the
 *  policy register. Either way, a claim filed by hand with a policy number we
 *  do not hold names no record, and the task still opens with neither. */
function claimSfIds_(claim) {
  var out = { contact: '', parent: '', parentKind: '', term: '', policy: '' };
  try {
    if (claim.kind === 'motor') {
      var a = claim.extra || {};
      var found = vehicleForClaim_(a.vehicleReg || claim.policy || '', claim.incidentDate);
      if (!found.row) return out;
      out.contact = String(found.row['Contact Id'] || '').trim();
      out.parent = String(found.row['Risk Id'] || '').trim();
      out.parentKind = out.parent ? 'the cover term' : '';
      out.term = String(found.row['Term'] || '').trim();
      out.policy = String(found.row['Policy #'] || '').trim();
      out.matched = found.matched;
      out.terms = found.terms.length;
      return out;
    }
    var reg = findPolicyRecord_(claim.policy || '');
    if (!reg) return out;
    out.contact = String(reg['Contact Id'] || '').trim();
    out.parent = String(reg['Portfolio Id'] || '').trim();
    out.parentKind = out.parent ? 'the policy record' : '';
    out.policy = String(reg['Policy #'] || '').trim();
    return out;
  } catch (err) { return out; }
}

/** Reference first, because the whole point is that a reply finds the file. */
function claimTaskSubject_(claim) {
  /* The LINE and then the subtype, because a task list is scanned by line:
     submissionType_ alone gives 'Collision', which says nothing about which
     desk or which kind of claim it is. Health keeps Guardian's own submission
     wording, which is the useful thing there. */
  var line = typeKeyStrict_(claim.type) === 'health'
    ? submissionType_(claim)
    : [claim.type, claim.subtype].filter(String).join(' — ');
  var bits = ['RRB CLAIM ' + claim.ref, line, claim.name];
  if (claim.kind === 'motor') {
    var plate = String((claim.extra || {}).vehicleReg || '').trim();
    if (plate) bits.push(plate);
  }
  return bits.filter(String).join(' - ').slice(0, 255);
}

/** What whoever opens the task needs in front of them, without opening the
 *  sheet, the Drive folder or their e-mail. */
function claimTaskBody_(claim, claimsId, ids, files, missing) {
  var L = [];
  var add = function (label, value) { if (value) L.push(label + ': ' + value); };
  L.push('Filed on claimstt.com and forwarded to the claims desk.');
  L.push('');
  add('Reference', claim.ref);
  add('Line', submissionType_(claim));
  add('Client', claim.name);
  add('Mobile', claim.mobile);
  add('E-mail', claim.email);
  add('Policy', claim.policy || ids.policy);
  if (claim.kind === 'motor') {
    var a = claim.extra || {};
    add('Vehicle', [a.vehicleReg, a.vehicleMake, a.vehicleYear].filter(String).join(' · '));
    if (ids.term) {
      add('Cover term', ids.term + (ids.matched === false && ids.terms > 1
        ? ' (the loss falls outside every term we hold — newest shown)' : ''));
    }
  }
  add('Date of loss', niceDate_(claim.incidentDate) + (claim.incidentTime ? ' at ' + claim.incidentTime : ''));
  add('Location', claim.location);
  add('Estimated amount', claim.amount ? 'TT$ ' + claim.amount : '');
  add('Documents', (files || []).length + ' uploaded');
  add('Still outstanding', (missing || []).join(', '));
  add('Checks to read', claim.flagged);
  add('Ledger record', claimsId ? 'Claims__c ' + claimsId : '');
  add('Documents folder', claim.folder);
  L.push('');
  L.push('Review due ' + CLAIMS.TASK.DUE_WORKING_DAYS + ' working days from filing. ' +
    'The client has the reference and can check their own claim at ' +
    'rickyrampersadbranch.com/claims/ with it and the last four digits of their mobile.');
  return L.join('\n').slice(0, 30000);
}

/** One task per filed claim. Returns a line for the claim's own notes. */
function sfClaimTask_(claim, claimsId, files, missing) {
  if (!CLAIMS.TASK.ON) return '';
  if (!sfConnected_() || !sfProps_().writeTasks) return '';
  if (testMode_()) { logClaim_(claim.ref, 'claim-task-skipped', 'system', 'test mode'); return ''; }
  try {
    var ids = claimSfIds_(claim);
    var base = {
      Subject: claimTaskSubject_(claim),
      Status: 'Not Started',
      /* High when a check fired. A loss outside the cover period, an expired
         permit or a date in the future is the kind of thing that wants a human
         eye before the assessor's, and the claim says which. */
      Priority: claim.flagged ? 'High' : 'Normal',
      ActivityDate: Utilities.formatDate(
        addWorkingDays_(new Date(), CLAIMS.TASK.DUE_WORKING_DAYS), sheetTz_(), 'yyyy-MM-dd'),
      Description: claimTaskBody_(claim, claimsId, ids, files, missing),
    };
    var owner = sfTaskOwnerId_(claim.kind);
    if (owner) base.OwnerId = owner;

    /* Each attempt drops one more thing the org might refuse, in the order
       they are most likely to be refused: a custom object as a parent needs
       activities enabled on it, a picklist value has to be on the picklist,
       and a WhoId has to be a Contact that still exists. The first attempt
       that lands wins, and what was dropped is recorded rather than passed
       over — the same rule the group billing writes keep (gblSfwSave_): never
       claim to have written something the org refused. */
    var attempts = [];
    if (ids.parent) attempts.push({ Task_Type__c: CLAIMS.TASK.TYPE, WhoId: ids.contact, WhatId: ids.parent });
    attempts.push({ Task_Type__c: CLAIMS.TASK.TYPE, WhoId: ids.contact });
    if (ids.contact) attempts.push({ WhoId: ids.contact });
    attempts.push({});

    var last = '';
    for (var i = 0; i < attempts.length; i++) {
      var fields = {};
      Object.keys(base).forEach(function (k) { fields[k] = base[k]; });
      Object.keys(attempts[i]).forEach(function (k) { if (attempts[i][k]) fields[k] = attempts[i][k]; });
      try {
        var id = sfCreate_('Task', fields);
        var on = [];
        if (fields.WhatId) on.push(ids.parentKind || 'the policy');
        if (fields.WhoId) on.push("the client's record");
        if (!on.length) on.push('no record — the policy number matched nothing we hold');
        var note = 'Salesforce task opened on ' + on.join(' and ') +
          ', due ' + base.ActivityDate +
          (owner ? '' : ', owner not set (CLAIMS_TASK_OWNER did not resolve to one active user)') +
          (i > 0 ? ' [after ' + i + ' field(s) the org refused]' : '');
        logClaim_(claim.ref, 'claim-task-opened', 'system', 'Task/' + id + ' · ' + note);
        return note;
      } catch (err) { last = String(err); }
    }
    logClaim_(claim.ref, 'claim-task-failed', 'system', last);
    return 'Salesforce task could NOT be opened: ' + last.slice(0, 160);
  } catch (err) {
    logClaim_(claim.ref, 'claim-task-failed', 'system', String(err));
    return 'Salesforce task could NOT be opened: ' + String(err).slice(0, 160);
  }
}

/* ---- menu plumbing ---- */

function connectSalesforce() {
  var ui = SpreadsheetApp.getUi();
  var p = PropertiesService.getScriptProperties();
  var domain = ui.prompt('Salesforce — step 1 of 3',
    'Your My Domain URL, e.g.\nhttps://yourorg.my.salesforce.com', ui.ButtonSet.OK_CANCEL);
  if (domain.getSelectedButton() !== ui.Button.OK) return;
  var id = ui.prompt('Salesforce — step 2 of 3', 'Connected App CONSUMER KEY:', ui.ButtonSet.OK_CANCEL);
  if (id.getSelectedButton() !== ui.Button.OK) return;
  var secret = ui.prompt('Salesforce — step 3 of 3', 'Connected App CONSUMER SECRET:', ui.ButtonSet.OK_CANCEL);
  if (secret.getSelectedButton() !== ui.Button.OK) return;
  p.setProperty('SF_DOMAIN', domain.getResponseText().trim().replace(/\/+$/, ''));
  p.setProperty('SF_CLIENT_ID', id.getResponseText().trim());
  p.setProperty('SF_CLIENT_SECRET', secret.getResponseText().trim());
  CacheService.getScriptCache().remove('sf-token');
  try {
    sfToken_();
    installSfTrigger_();
    ui.alert('✅ Connected. The registers will sync nightly (~3am).\n\nRun "Sync registers from Salesforce now" to fill them immediately.');
  } catch (err) {
    ui.alert('Connection failed:\n\n' + err + '\n\nCheck the domain URL and that the Connected App has the client-credentials flow enabled with a run-as user.');
  }
}

function installSfTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'salesforceNightlySync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('salesforceNightlySync').timeBased().everyDays(1).atHour(3).create();
}

function syncSalesforceNow() {
  if (!sfConnected_()) {
    SpreadsheetApp.getUi().alert('Connect Salesforce first (Claims TT menu → Connect Salesforce).');
    return;
  }
  SpreadsheetApp.getUi().alert('Synced: ' + salesforceNightlySync());
}


/* ============================ sign-in: codes & sessions ============================

 * "Log in" here means: tell us your email (or mobile), we email you a
 * 6-digit code, you type it back. No passwords exist in this system — for
 * a claimant who shows up twice a decade, a password is a guaranteed
 * reset-loop; a code in their inbox always works.
 *
 * Staff use the same machinery at claims/staff.html, gated by the Staff
 * tab — only listed, Active=Y emails receive a staff code. Client sessions
 * last 30 days; staff sessions 12 hours; every staff action is logged with
 * the staff member's name.
 * ============================================================================ */

function staffSheet_() {
  var sh = namedSheet_(CLAIMS.STAFF_SHEET, ['Email', 'Name', 'Role', 'Active']);
  return sh;
}

function staffByEmail_(email) {
  var want = String(email || '').trim().toLowerCase();
  if (!want) return null;
  var sh = staffSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var rows = sh.getRange(2, 1, last - 1, 4).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === want && /^y/i.test(String(rows[i][3]))) {
      return { email: want, name: String(rows[i][1] || want), role: String(rows[i][2] || 'Staff') };
    }
  }
  return null;
}

function staffNames_() {
  var sh = staffSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getValues()
    .filter(function (r) { return /^y/i.test(String(r[3])); })
    .map(function (r) { return String(r[1] || r[0]); });
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s).toLowerCase())
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function randToken_() {
  var out = '';
  while (out.length < 40) out += Math.random().toString(36).slice(2);
  return out.slice(0, 40);
}

/** Sessions live in script properties: sess.<token> -> {kind,id,email,name,role,exp}. */
function newSession_(kind, id, email, name, role) {
  var ttlMs = kind === 'staff'
    ? CLAIMS.STAFF_SESSION_HOURS * 3600 * 1000
    : CLAIMS.CLIENT_SESSION_DAYS * 864e5;
  var token = randToken_();
  PropertiesService.getScriptProperties().setProperty('sess.' + token, JSON.stringify({
    kind: kind, id: id, email: email || '', name: name || '', role: role || '',
    exp: Date.now() + ttlMs,
  }));
  return token;
}

function getSession_(token, kind) {
  token = String(token || '');
  if (token.length < 20) return null;
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('sess.' + token);
  if (!raw) return null;
  var sess;
  try { sess = JSON.parse(raw); } catch (err) { return null; }
  if (!sess || sess.exp < Date.now()) { props.deleteProperty('sess.' + token); return null; }
  if (kind && sess.kind !== kind) return null;
  return sess;
}

function dropSession_(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('sess.' + String(token));
}

/** Now and then, clear out expired sessions so properties never fill up. */
function pruneSessions_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('sess.') !== 0) return;
    try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); }
    catch (err) { props.deleteProperty(k); }
  });
}

function normIdentity_(identity) {
  var s = String(identity || '').trim();
  if (s.indexOf('@') > -1) return { kind: 'email', value: s.toLowerCase() };
  var digits = s.replace(/\D/g, '');
  return digits.length >= 7 ? { kind: 'mobile', value: digits } : null;
}

/** Every claim belonging to an email address or mobile number. */
function claimsForIdentity_(identity) {
  var id = normIdentity_(identity);
  if (!id) return [];
  var sh = claimsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var map = headerMap_(sh);
  var rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var hits = [];
  rows.forEach(function (values, i) {
    var email = String(values[map['email']] || '').trim().toLowerCase();
    var mobile = String(values[map['mobile']] || '').replace(/\D/g, '');
    var match = id.kind === 'email'
      ? email && email === id.value
      : mobile && (mobile.slice(-7) === id.value.slice(-7));
    if (match) hits.push({ row: i + 2, values: values, map: map, sheet: sh });
  });
  return hits;
}

/** Send a sign-in code. The response is the same whether or not we know
 *  the identity, so the endpoint cannot be used to fish for clients. */
function apiRequestCode_(b) {
  var kind = b.kind === 'staff' ? 'staff' : 'client';
  var id = normIdentity_(b.identity);
  var generic = { ok: true, sent: true,
    message: 'If we have that on file, a sign-in code is on its way to the email we hold. It lasts ' +
      CLAIMS.CODE_TTL_MINUTES + ' minutes.' };
  if (!id) return generic;

  var cache = CacheService.getScriptCache();
  var sendSlot = 'codes.' + kind + '.' + hash_(id.value);
  if (Number(cache.get(sendSlot) || 0) >= CLAIMS.CODE_SENDS_PER_HOUR) return generic;

  var email = '', name = '';
  if (kind === 'staff') {
    var staff = staffByEmail_(id.kind === 'email' ? id.value : '');
    if (!staff) {
      /* The vague answer above exists to stop a stranger fishing for CLIENTS.
         There is no client behind a staff address, and a branch member who
         reads "a code is on its way" and never gets one cannot tell being off
         the list from a mail failure — which is exactly what happened on
         5 November 2026. So the staff door says what is actually wrong. */
      return { ok: true, sent: false,
        message: 'That email is not on the Claims TT staff list, so there is no code to send. ' +
          'Open the Claims TT sheet, add it to the Staff tab (Email, Name, Role, Active = Y), ' +
          'or run Claims TT → "1. Set up / repair everything", which puts the branch addresses on.' };
    }
    email = staff.email; name = staff.name;
  } else {
    var mine = claimsForIdentity_(b.identity);
    if (!mine.length) {
      /* The vague answer above is for a STRANGER, who must not be able to use
         this endpoint to find out whether we hold a given person. One of the
         branch's own addresses asking about ITSELF is not a stranger — it is
         somebody testing, and on 5 November 2026 that vagueness cost an
         evening: every claim on file was under a made-up address, so the
         client door answered "a code is on its way" and had nothing to send
         it to. A client still gets the standard answer, every time. */
      if (claimsTester_(id.value)) {
        return { ok: true, sent: false,
          message: 'No claim on file under ' + id.value + ', so there is no code to send. ' +
            'The client sign-in only knows an address or mobile number already on a filed ' +
            'claim — file one carrying this address and it will work. You are told this ' +
            'because it is a branch address; anyone else gets the standard answer.' };
      }
      return generic;
    }
    // Newest claim with an email wins — that is where the code goes.
    for (var i = mine.length - 1; i >= 0; i--) {
      var e = String(mine[i].values[mine[i].map['email']] || '').trim();
      if (e) { email = e; name = String(mine[i].values[mine[i].map['client name']] || ''); break; }
    }
    if (!email) {
      // Real answer, not the generic one: they cannot receive a code at all.
      return { ok: true, sent: false,
        message: 'We have no email address on your claims, so we cannot send a code. Use the quick check with your claim reference, or call us on ' + CLAIMS.AGENT_PHONE + '.' };
    }
  }

  var code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('code.' + kind + '.' + hash_(id.value), JSON.stringify({ code: code, tries: 0 }),
    CLAIMS.CODE_TTL_MINUTES * 60);
  cache.put(sendSlot, String(Number(cache.get(sendSlot) || 0) + 1), 3600);

  sendMail_({
    /* signIn: the gate's one test-mode exception — a code for an address the
       branch trusts reaches that inbox. A client's still reroutes. */
    signIn: true,
    to: email, name: CLAIMS.FROM_NAME,
    subject: code + ' is your Claims TT sign-in code',
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_(String(name).split(' ')[0] || 'there') + ',</p>' +
      '<p>Your ' + (kind === 'staff' ? 'staff ' : '') + 'sign-in code is:</p>' +
      '<p style="background:' + CBRAND.light + ';border:1px solid #CBEAE8;border-radius:10px;padding:16px;text-align:center">' +
      '<b style="font-size:30px;letter-spacing:8px;color:' + CBRAND.navy + '">' + code + '</b></p>' +
      '<p>It works for ' + CLAIMS.CODE_TTL_MINUTES + ' minutes. If you did not ask for it, ignore this email — ' +
      'nobody can get in without the code in your inbox.</p>' + sig_(),
      'Sign-in code'),
  });
  return generic;
}

function apiVerifyCode_(b) {
  var kind = b.kind === 'staff' ? 'staff' : 'client';
  var id = normIdentity_(b.identity);
  if (!id) return { ok: false, error: 'Please enter the email or mobile number you asked the code for.' };

  var cache = CacheService.getScriptCache();
  var slot = 'code.' + kind + '.' + hash_(id.value);
  var raw = cache.get(slot);
  if (!raw) return { ok: false, error: 'That code has expired — request a fresh one.' };
  var rec = JSON.parse(raw);
  if (rec.tries >= CLAIMS.CODE_MAX_TRIES) { cache.remove(slot); return { ok: false, error: 'Too many attempts — request a fresh code.' }; }
  if (String(b.code || '').trim() !== rec.code) {
    rec.tries++;
    cache.put(slot, JSON.stringify(rec), CLAIMS.CODE_TTL_MINUTES * 60);
    return { ok: false, error: 'That code did not match. Check the email and try again.' };
  }
  cache.remove(slot);
  pruneSessions_();

  if (kind === 'staff') {
    var staff = staffByEmail_(id.value);
    if (!staff) return { ok: false, error: 'That email is not on the staff list.' };
    logClaim_('(staff)', 'staff-signed-in', staff.email, staff.role);
    return { ok: true, token: newSession_('staff', staff.email, staff.email, staff.name, staff.role),
      kind: 'staff', name: staff.name, role: staff.role };
  }
  return { ok: true, token: newSession_('client', id.value), kind: 'client' };
}

function apiSignOut_(b) { dropSession_(b.token); return { ok: true }; }

/** Everything a signed-in client may see about their own claims.
 *  Deliberately excludes bank details and internal notes. */
function clientClaimView_(hit) {
  var g = function (f) { return String(claimField_(hit, f) || ''); };
  var ref = g('Reference');
  return {
    ref: ref, status: g('Status') || 'Received',
    type: g('Claim Type'), subtype: g('Sub-type'),
    filedOn: Utilities.formatDate(new Date(claimField_(hit, 'Timestamp')),
      Session.getScriptTimeZone() || 'America/Port_of_Spain', 'dd MMM yyyy'),
    missing: String(g('Missing Documents')).split(';').map(function (s) { return s.trim(); }).filter(String),
    documents: filesForRef_(ref).map(function (f) { return f.doc; }),
    closed: isClosed_(g('Status')),
  };
}

function apiMyClaims_(b) {
  var sess = getSession_(b.token, 'client');
  if (!sess) return { ok: false, error: 'signed-out' };
  var mine = claimsForIdentity_(sess.id);
  return { ok: true, claims: mine.map(clientClaimView_).reverse(),
    agent: { name: CLAIMS.AGENT_NAME, phone: CLAIMS.AGENT_PHONE } };
}


/* ============================ the signed-in client ============================
 *
 * Asked for on 6 November 2026: "i am an existing client and it needs to put in
 * my vehicle details when i log in ... its pulling in all the vehicles on the
 * risk object".
 *
 * claims/index.html has called `myProfile` since it was written and the backend
 * never had the action, so signing in answered "Unknown action", whoLoad()
 * caught it and returned false, and a signed-in client saw NOTHING — no
 * welcome, no claims, no policies, no vehicles. The page was built against an
 * endpoint that did not exist, which is invisible from the outside because the
 * failure is a silent catch.
 *
 * Every vehicle comes from the Vehicle Register, which since 5 November holds
 * ONE ROW PER VEHICLE PER TERM straight off Risk_Details__c. So a client with
 * one car insured for six years has one card and six terms behind it, and the
 * claim is assessed against the term in force on the date of loss rather than
 * whatever has been renewed since.
 *
 * WHAT A CLIENT IS NEVER SENT: the Contact id, the Risk id, another client's
 * anything. The ids live in the register for the write-back's sake and are
 * stripped here — vehicleTermList_ next door makes the same promise, for the
 * same reason. */

/** Rows of a register belonging to this identity — the same match
 *  claimsForIdentity_ makes: an e-mail exactly, a mobile on its last seven
 *  digits. Then widened by the Contact id, so a second car recorded under a
 *  work e-mail still comes back when one of them matched. */
function registerRowsFor_(sheet, identity) {
  var id = normIdentity_(identity);
  if (!id) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var obj = function (values) {
    var o = {};
    headers.forEach(function (h, i) { o[String(h).trim()] = values[i]; });
    return o;
  };
  var mine = [], contacts = {};
  rows.forEach(function (values) {
    var r = obj(values);
    var email = String(r['Email'] || '').trim().toLowerCase();
    var mobile = String(r['Mobile'] || '').replace(/\D/g, '');
    var hit = id.kind === 'email'
      ? (email && email === id.value)
      : (mobile && mobile.slice(-7) === id.value.slice(-7));
    if (!hit) return;
    mine.push(r);
    var cid = String(r['Contact Id'] || '').trim();
    if (cid) contacts[cid] = true;
  });
  if (Object.keys(contacts).length) {
    rows.forEach(function (values) {
      var r = obj(values);
      var cid = String(r['Contact Id'] || '').trim();
      if (!cid || !contacts[cid]) return;
      if (mine.indexOf(r) > -1) return;
      for (var i = 0; i < mine.length; i++) {
        // Same row twice: the register is keyed by plate and term, or by policy.
        if (String(mine[i]['Reg Key'] || mine[i]['Policy Key'] || '') ===
            String(r['Reg Key'] || r['Policy Key'] || '') &&
            String(mine[i]['Term'] || '') === String(r['Term'] || '')) return;
      }
      mine.push(r);
    });
  }
  return mine;
}

/** What the signed-in client sees: who we think they are, their claims, and
 *  every policy and vehicle we hold for them, each one a card they can file a
 *  claim on with the details already filled in. */
function apiMyProfile_(b) {
  var sess = getSession_(b.token, 'client');
  if (!sess) return { ok: false, error: 'signed-out' };

  var mine = claimsForIdentity_(sess.id);
  var views = mine.map(clientClaimView_).reverse();
  var contact = { name: '', email: '', mobile: '' };

  /* Their own details, newest claim first — what they filed with last is the
     likeliest to be current. The registers fill any gap below. */
  views.forEach(function (v, i) {
    var hit = mine[mine.length - 1 - i];
    if (!hit) return;
    ['Client Name|name', 'Email|email', 'Mobile|mobile'].forEach(function (pair) {
      var parts = pair.split('|');
      var val = String(claimField_(hit, parts[0]) || '').trim();
      if (val && !contact[parts[1]]) contact[parts[1]] = val;
    });
  });

  var cards = [];

  /* ---- the vehicles, every term, off Risk Details ---- */
  var vrows = [];
  try { vrows = registerRowsFor_(registerSheet_(), sess.id); } catch (err) { vrows = []; }
  var byPlate = {}, plateOrder = [];
  vrows.forEach(function (r) {
    var key = String(r['Reg Key'] || normKey_(r['Vehicle Reg']) || '').trim();
    if (!key) return;
    if (!byPlate[key]) { byPlate[key] = []; plateOrder.push(key); }
    byPlate[key].push(r);
  });
  plateOrder.forEach(function (key) {
    /* The register is written newest term first, so the head of the list is
       this year's cover — which is what the card shows and what a claim with no
       date of loss yet is prefilled from. syncCoverTerm on the page re-picks
       the right one the moment they type the date. */
    var terms = byPlate[key];
    var r = terms[0];
    var v = function (f) { return String(r[f] === null || r[f] === undefined ? '' : r[f]).trim(); };
    if (!contact.name && v('Client')) contact.name = v('Client');
    if (!contact.email && v('Email')) contact.email = v('Email').toLowerCase();
    if (!contact.mobile && v('Mobile')) contact.mobile = v('Mobile');
    var descr = [v('Year'), v('Make'), v('Model')].filter(String).join(' ').trim();
    cards.push({
      line: 'Motor',
      product: descr || 'Vehicle on file',
      policy: v('Vehicle Reg') || v('Policy #'),
      terms: termsFromRows_(terms),
      prefill: {
        vehicleReg: v('Vehicle Reg'),
        vehicleMake: [v('Make'), v('Model')].filter(String).join(' '),
        vehicleYear: v('Year'), chassis: v('Chassis #'), engine: v('Engine #'),
        policy: v('Policy #'), coverage: v('Coverage Type'),
        insuredValue: v('Insured Value (TT$)'), windscreen: v('Windscreen (TT$)'),
        carrier: v('Carrier'),
        coverFrom: iso_(r['Cover From']), coverTo: iso_(r['Cover To']),
        name: v('Client'), email: v('Email'), mobile: v('Mobile'),
        driverPermit: v('Permit #'),
        permitIssue: iso_(r['Permit Issued']), permitExpiry: iso_(r['Permit Expires']),
        permitOnFile: v('Permit #'),
      },
    });
  });

  /* ---- everything else: health, life, pension, property ---- */
  var prows = [];
  try { prows = registerRowsFor_(policyRegisterSheet_(), sess.id); } catch (err) { prows = []; }
  prows.forEach(function (r) {
    var v = function (f) { return String(r[f] === null || r[f] === undefined ? '' : r[f]).trim(); };
    if (!contact.name && v('Client')) contact.name = v('Client');
    if (!contact.email && v('Email')) contact.email = v('Email').toLowerCase();
    if (!contact.mobile && v('Mobile')) contact.mobile = v('Mobile');
    cards.push({
      line: v('Line') || 'Policy',
      product: v('Product') || v('Line') || 'Policy on file',
      policy: v('Policy #'),
      prefill: {
        policy: v('Policy #'),
        coverage: [v('Line'), v('Product')].filter(String).join(' — '),
        name: v('Client'), email: v('Email').toLowerCase(), mobile: v('Mobile'),
      },
    });
  });

  logClaim_('(profile)', 'client-signed-in', 'client',
    cards.length + ' policy card(s), ' + plateOrder.length + ' vehicle(s), ' +
    views.length + ' claim(s) on file');

  return { ok: true, contact: contact,
    open: views.filter(function (v) { return !v.closed; }),
    closed: views.filter(function (v) { return v.closed; }),
    policies: cards,
    agent: { name: CLAIMS.AGENT_NAME, phone: CLAIMS.AGENT_PHONE } };
}

/** May this request add files to this claim?
 *  - the filing session itself (uploadKey handed out by claimStart), or
 *  - a signed-in client who owns the claim, or
 *  - signed-in staff. */
function mayTouchClaim_(b, hit) {
  var ref = String(claimField_(hit, 'Reference') || '');
  if (b.uploadKey && CacheService.getScriptCache().get('upk.' + ref) === String(b.uploadKey)) {
    return { by: 'client', name: 'client' };
  }
  var staff = getSession_(b.token, 'staff');
  if (staff) return { by: 'staff', name: staff.name };
  var client = getSession_(b.token, 'client');
  if (client) {
    var mine = claimsForIdentity_(client.id);
    for (var i = 0; i < mine.length; i++) {
      if (String(claimField_(mine[i], 'Reference')) === ref) return { by: 'client', name: 'client' };
    }
  }
  return null;
}


/* ============================ staff API ============================ */

function requireStaff_(b) {
  var sess = getSession_(b.token, 'staff');
  if (!sess) throw new Error('signed-out');
  return sess;
}

function apiStaffData_(b) {
  var staff = requireStaff_(b);
  var sh = claimsSheet_();
  var last = sh.getLastRow();
  var map = headerMap_(sh);
  var claims = [];
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    rows.forEach(function (values, i) {
      var hit = { row: i + 2, values: values, map: map, sheet: sh };
      var g = function (f) { return String(claimField_(hit, f) || ''); };
      if (!g('Reference')) return;
      claims.push({
        ref: g('Reference'), status: g('Status') || 'Received',
        type: g('Claim Type'), subtype: g('Sub-type'),
        name: g('Client Name'), policy: g('Policy #'),
        mobile: g('Mobile'), email: g('Email'),
        filed: fmtOrBlank_(claimField_(hit, 'Timestamp')),
        /* When it happened — the first question an assessor asks, and the
           card had no answer: it was only ever on the sheet and in the
           e-mail, where it printed as a raw Date. */
        when: whenText_({
          incidentDate: claimField_(hit, 'Incident Date'),
          incidentTime: claimField_(hit, 'Incident Time'),
        }),
        quietDays: Math.max(daysSince_(claimField_(hit, 'Last Updated')), 0),
        amount: g('Estimated Amount (TT$)'),
        location: g('Location'), description: g('Description'),
        missing: g('Missing Documents').split(';').map(function (s) { return s.trim(); }).filter(String),
        files: filesForRef_(g('Reference')),
        folder: g('Drive Folder'), pdf: g('Claim Form PDF'),
        assigned: g('Assigned To'), notes: g('Internal Notes'),
        reviewDue: fmtOrBlank_(claimField_(hit, 'Review Due')),
        reviewOverdue: !!claimField_(hit, 'Review Due') && daysSince_(claimField_(hit, 'Review Due')) >= 0,
        /* What the claim's own checks caught before it was sent, and what the
           client said about each. This is the first thing an assessor wants to
           know and the branch had no way to see it. */
        flagged: g('Flagged Checks'),
        /* The permit and the rest, for the desk to read without opening the
           sheet. The whole map; the page shows the few it knows the labels for. */
        extra: parseExtra_(g('Answers (JSON)')),
      });
    });
  }
  var kpis = {};
  CLAIMS.STATUSES.forEach(function (s) { kpis[s] = 0; });
  claims.forEach(function (c) { if (kpis[c.status] !== undefined) kpis[c.status]++; });
  var feedback = null;
  try { feedback = claimSurveyStats_(); } catch (err) { Logger.log('survey stats: ' + err); }
  return { ok: true, me: { name: staff.name, role: staff.role }, claims: claims.reverse(),
    staff: staffNames_(), statuses: CLAIMS.STATUSES, kpis: kpis, feedback: feedback };
}

function apiStaffAction_(b) {
  var staff = requireStaff_(b);
  var hit = findClaim_(b.ref);
  if (!hit) throw new Error('We could not find that claim.');
  var claim = claimObject_(hit);
  // b.action was consumed by routing ('staffAction'); the sub-action rides in b.do.
  var action = String(b.do || '');

  if (action === 'status') {
    var status = String(b.status || '');
    if (CLAIMS.STATUSES.indexOf(status) < 0) throw new Error('Unknown status.');
    setClaimField_(hit, 'Status', status);
    claim.status = status;
    if (b.notify && claim.email) sendStatusEmail_(claim);
    logClaim_(claim.ref, 'status-changed', staff.email, status + (b.notify ? ' (client emailed)' : ''));
    /*  A claim that has just closed is asked how it went, once, while the
     *  client still remembers. The marker stops the daily sweep sending a
     *  second one.                                                       */
    if (isClosed_(status) && claim.email && !surveySent_(hit)) {
      try { sendClaimSurvey_(claim, hit); }
      catch (err) { logClaim_(claim.ref, 'survey-send-failed', 'system', String(err)); }
    }
  } else if (action === 'assign') {
    setClaimField_(hit, 'Assigned To', clean_(b.assignee, 80));
    logClaim_(claim.ref, 'assigned', staff.email, clean_(b.assignee, 80) || '(cleared)');
  } else if (action === 'note') {
    var note = clean_(b.note, 800);
    if (!note) throw new Error('The note is empty.');
    var existing = String(claimField_(hit, 'Internal Notes') || '');
    setClaimField_(hit, 'Internal Notes',
      (existing ? existing + '\n' : '') + nowStamp_() + ' — ' + staff.name + ': ' + note);
    logClaim_(claim.ref, 'note-added', staff.email, note.slice(0, 120));
  } else if (action === 'missing') {
    var missing = (b.missing || []).map(function (m) { return clean_(m, 120); }).filter(String);
    setClaimField_(hit, 'Missing Documents', missing.join('; '));
    logClaim_(claim.ref, 'missing-updated', staff.email, missing.join(', ') || '(nothing outstanding)');
  } else if (action === 'chase') {
    if (!claim.email) throw new Error('That claim has no email on file — call the client instead.');
    var owed = String(claimField_(hit, 'Missing Documents') || '')
      .split(';').map(function (s) { return s.trim(); }).filter(String);
    if (!owed.length) throw new Error('Nothing is outstanding on that claim.');
    sendChase_(claim, owed, 1, CLAIMS.CHASE_DAYS.length);
    if (claim.status === 'Received') setClaimField_(hit, 'Status', 'Awaiting documents');
    logClaim_(claim.ref, 'chased-documents', staff.email, owed.join(', '));
  } else {
    throw new Error('Unknown action.');
  }
  setClaimField_(hit, 'Last Updated', new Date());
  return { ok: true, ref: claim.ref };
}

function fmtOrBlank_(v) {
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Port_of_Spain', 'dd MMM yyyy');
}


/* ============================ web app routing ============================ */

/* Is this thing on, and is it safe to send a client to it?
 *
 * Added 5 November 2026, on the question "can I use this now" — which could
 * not be answered from outside. The old ping said the file-size limits and
 * nothing else, so whether test mode was on, which lines had a desk, and
 * whether Salesforce was connected were all invisible, and the honest answer
 * was a guess. CLAUDE.md's own Apps Script note prescribes exactly this: a
 * build marker and a self-check, because from outside "not pasted", "not
 * deployed" and "a later copy won the name" look identical.
 *
 * It leaks nothing. The desk addresses are already in this public file, so
 * this reports only WHETHER each line has one; `build` is the date in this
 * file's own header, which is how a browser tells which copy is deployed. */
function claimPing_() {
  var lines = {}, ready = [];
  Object.keys(CLAIMS.DESK).forEach(function (k) {
    var on = !!deskFor_(k);
    lines[k] = on;
    if (on) ready.push(k);
  });
  var test = testMode_();
  /* How many people the staff desk will let in. A COUNT ONLY — this endpoint
     needs no sign-in, so it must never list the addresses. Zero is why a
     staff sign-in answers "a code is on its way" and sends nothing, which
     took an evening to find on 5 November 2026. */
  var staffCount = -1;
  try { staffCount = staffNames_().length; } catch (e) {}
  return {
    ok: true,
    service: 'claims-tt',
    build: CLAIMS.BUILD,
    testMode: test,
    live: !test,
    desks: lines,
    desksReady: ready,
    staffCanSignIn: staffCount,
    salesforce: sfConnected_(),
    /* What a filed claim writes to Salesforce, so "did it open a task?" is
       answerable from a browser. `task` false with salesforce true means the
       switch is off, not that it failed. */
    writes: {
      ledger: sfConnected_() && sfProps_().writeClaims && CLAIMS.SF_CLAIM.ON,
      /* Which object the claim record goes on. Claims__c is the one the branch
         abandoned in 2016; Claims_Revised__c is the live one. Reported because
         a row on the wrong object is a row nobody opens, and from outside the
         two are indistinguishable. */
      claimObject: CLAIMS.SF_CLAIM.OBJECT,
      /* '' is correct and deliberate: no claims object in this org has a lookup
         to Risk_Details__c. The claim reaches the vehicle through the policy
         record both of them hang off. See CLAIMS.SF_CLAIM. */
      riskField: CLAIMS.SF_CLAIM.RISK_FIELD || '',
      task: sfConnected_() && sfProps_().writeTasks && CLAIMS.TASK.ON,
      taskDueDays: CLAIMS.TASK.DUE_WORKING_DAYS,
    },
    /* Whether a signed-in client gets their policies and vehicles back. The
       page has called this action since it was written; the backend had no such
       case until 6 November 2026, so signing in silently showed nothing. */
    profile: true,
    registers: (function () {
      var out = { vehicleTerms: -1, policies: -1, vehiclePortfolioIds: 'unknown' };
      try {
        var vs = registerSheet_();
        var last = vs.getLastRow();
        out.vehicleTerms = Math.max(last - 1, 0);
        /* Whether the vehicle register carries the policy-record id a motor
           claim parents on. The sync rewrites the tab whole and the Salesforce
           field is required, so the newest row having one means the sync has
           run since 6 November 2026; 'not synced yet' means re-run "Sync
           registers from Salesforce now" or a motor claim may find no parent.
           Two cheap reads — the header and one row — because this endpoint
           needs no sign-in and must not invite a heavy scan. */
        var head = vs.getRange(1, 1, 1, vs.getLastColumn()).getValues()[0];
        var col = head.indexOf('Portfolio Id') + 1;
        if (!col) out.vehiclePortfolioIds = 'column missing';
        else if (last < 2) out.vehiclePortfolioIds = 'register empty';
        else out.vehiclePortfolioIds =
          String(vs.getRange(last, col).getValue() || '').trim() ? 'yes' : 'not synced yet';
      } catch (e) {}
      try { out.policies = Math.max(policyRegisterSheet_().getLastRow() - 1, 0); } catch (e) {}
      return out;
    })(),
    maxFileMb: CLAIMS.MAX_FILE_MB,
    maxFiles: CLAIMS.MAX_FILES,
    /* One sentence a person can act on, so nobody has to read the flags. */
    says: (test
      ? 'TEST MODE. Every e-mail goes to the test inbox — a real client would ' +
        'hear nothing, and nothing is written to Salesforce. Claims TT menu → ' +
        '"Turn test mode OFF" when the desks are set.'
      : (ready.length === Object.keys(lines).length
        ? 'Live, and every line has a claims desk.'
        : 'LIVE. Claims on ' + Object.keys(lines).filter(function (k) { return !lines[k]; }).join(', ') +
          ' are filed and acknowledged but NOT forwarded — someone must pass ' +
          'them on by hand until those desk addresses are set.')) +
      (sfConnected_()
        ? ''
        : ' Salesforce is not connected, so a filed claim opens no task and ' +
          'writes no ledger record: Claims TT menu → Connect Salesforce.') +
      (staffCount === 0
        ? ' Nobody is on the staff list, so the staff sign-in can send no code ' +
          'to anyone: Claims TT menu → "1. Set up / repair everything".'
        : '') +
      (test && staffCount > 0
        ? ' A staff sign-in code still reaches the staff member in test mode, ' +
          'so the desk can be tested; a client\'s code does not.'
        : ''),
  };
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  /*  The feedback page is HTML, not JSON, so it is answered before the
   *  action switch. A bad token and an unknown reference get the same
   *  page, so the link cannot be used to probe which references exist. */
  if (p.survey) {
    try {
      return claimSurveyPage_(p);
    } catch (err) {
      Logger.log('survey page: ' + err);
      return surveyHtml_('<h1>Something went wrong</h1><p>Please call <b>' +
        esc_(CLAIMS.AGENT_PHONE) + '</b> and we will take your feedback that way.</p>', '');
    }
  }
  var out;
  try {
    switch (p.action) {
      case 'ping':       out = claimPing_(); break;
      case 'status':     out = apiStatus_(p.ref, p.last4); break;
      case 'findPolicy': out = apiFindPolicy_(p.q); break;
      default:           out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return json_(out);
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Could not read request' });
  }

  if (clean_(body.siteKey, 80) !== CLAIMS.SITE_KEY) {
    return json_({ ok: false, error: 'This form is out of date. Please refresh the page and try again.' });
  }

  var out;
  try {
    switch (body.action) {
      case 'claimStart':   out = apiClaimStart_(body); break;
      case 'claimFile':    out = apiClaimFile_(body); break;
      case 'claimFinish':  out = apiClaimFinish_(body); break;
      case 'verifyPolicy': out = apiVerifyPolicy_(body); break;
      case 'requestCode':  out = apiRequestCode_(body); break;
      case 'verifyCode':   out = apiVerifyCode_(body); break;
      case 'signOut':      out = apiSignOut_(body); break;
      case 'myClaims':     out = apiMyClaims_(body); break;
      case 'myProfile':    out = apiMyProfile_(body); break;
      case 'staffData':    out = apiStaffData_(body); break;
      case 'staffAction':  out = apiStaffAction_(body); break;
      default:             out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return json_(out);
}


/* ============================ claim intake API ============================ */

/**
 * Step 1 — open the claim. Everything the client typed is written
 * to the sheet immediately, so a failed upload never loses the claim
 * itself. Returns the reference the client keeps.
 */
/* The checks the page ran, as something a person can read down in one go.
   Only what was shown to the client and what they typed about it; the notes the
   page keeps from them are kept here too, marked, because they were written for
   the assessor in the first place. */
function checkLines_(checks) {
  if (!checks || !checks.length) return '';
  return checks.slice(0, 20).map(function (c) {
    var level = String(c.level || '').toLowerCase();
    var tag = level === 'stop' ? '⚠' : level === 'check' ? '•' : 'ℹ';
    var line = tag + ' ' + clean_(c.title, 160);
    if (c.detail) line += ' — ' + clean_(c.detail, 400);
    if (c.said) line += '\n   Client says: ' + clean_(c.said, 600);
    return line;
  }).join('\n');
}

/* Every answer that has no column of its own, plus what the policy itself said,
   so the desk and the claim form can both read one place. Capped, and each value
   cleaned, because this is client-typed text going into a cell. */
/* Every answer that has no column of its own. It was motor's list alone until
   5 November 2026, so a health claim collected the patient's name, their
   relationship to the member, their date of birth, whether the treatment was
   pre-authorised and whether another plan covers it — and threw all five away
   before the desk ever saw them. Property lost four and life six the same way.
   Motor was complete, which is why nobody noticed: motor was the line tested.

   Anything added to a type's `fields` on claims/index.html has to be added
   here too, or the client answers it for nothing. */
var EXTRA_KEYS = [
  // motor
  'driverPermit', 'permitIssue', 'permitExpiry', 'driverName', 'driverSame', 'driverRel',
  'vehicleReg', 'vehicleMake', 'vehicleYear', 'chassis', 'engine', 'coverage',
  'insuredValueNote', 'damage', 'cause', 'injuries', 'thirdparty',
  'tpName', 'tpVehicle', 'tpInsurer', 'tpContact',
  // health — 'provider' is shared with motor's repairer
  'provider', 'patientName', 'patientRel', 'patientDob', 'preauth', 'otherCover',
  // property
  'propertyUse', 'occupied', 'emergency', 'fireStation',
  // life and critical illness
  'lifeAssured', 'lifeDob', 'lifeId', 'claimantName', 'claimantRel', 'employer',
];
function extraJson_(b) {
  var out = {};
  /* b.answers from this version of the page; b itself for a page cached from
     before it, which named a few of these at the top level. */
  var src = (b.answers && typeof b.answers === 'object') ? b.answers : b;
  EXTRA_KEYS.forEach(function (k) {
    var v = clean_(src[k], 300);
    if (!v) v = clean_(b[k], 300);
    if (v) out[k] = v;
  });
  var facts = b.policyFacts || {};
  var keep = {};
  ['coverFrom', 'coverTo', 'carrier', 'insuredValue', 'windscreen', 'permitOnFile', 'policy', 'vehicleReg', 'name']
    .forEach(function (k) { var v = clean_(facts[k], 120); if (v) keep[k] = v; });
  if (Object.keys(keep).length) out._policy = keep;
  try { return JSON.stringify(out).slice(0, 8000); } catch (err) { return ''; }
}

function apiClaimStart_(b) {
  var type = clean_(b.type, 20).toLowerCase();
  if (!CLAIM_TYPES[type]) throw new Error('Please choose what kind of claim you are making.');

  var name = clean_(b.name, 120);
  var mobile = clean_(b.mobile, 40);
  if (!name) throw new Error('Please tell us your name.');
  if (last4_(mobile).length < 4) throw new Error('Please give a mobile number we can reach you on.');

  var ref = newReference_();
  var folder = claimFolder_(ref, name, type);

  var thirdParty = [
    b.tpName ? 'Name: ' + clean_(b.tpName, 120) : '',
    b.tpVehicle ? 'Vehicle: ' + clean_(b.tpVehicle, 120) : '',
    b.tpInsurer ? 'Insurer: ' + clean_(b.tpInsurer, 120) : '',
    b.tpContact ? 'Contact: ' + clean_(b.tpContact, 120) : '',
  ].filter(String).join(' · ');

  var bank = [
    b.bankName ? clean_(b.bankName, 80) : '',
    b.bankBranch ? clean_(b.bankBranch, 80) : '',
    b.bankAccount ? 'A/C ' + clean_(b.bankAccount, 60) : '',
    b.bankType ? '(' + clean_(b.bankType, 30) + ')' : '',
  ].filter(String).join(' · ');

  appendClaim_({
    'Timestamp': new Date(), 'Reference': ref, 'Status': 'Received',
    'Claim Type': typeLabel_(type), 'Sub-type': clean_(b.subtype, 80),
    'Client Name': name, 'Policy #': clean_(b.policy, 60), 'Mobile': mobile,
    'Email': clean_(b.email, 160), 'National ID': clean_(b.nationalId, 40),
    'Incident Date': clean_(b.incidentDate, 30), 'Incident Time': clean_(b.incidentTime, 20),
    'Location': clean_(b.location, 250), 'Description': clean_(b.description, 4000),
    'Estimated Amount (TT$)': clean_(b.amount, 40),
    'Police Report #': clean_(b.policeReport, 60), 'Police Station': clean_(b.policeStation, 120),
    'Third Party': thirdParty, 'Bank Details': bank, 'Files': 0,
    'Missing Documents': '', 'Drive Folder': folder.getUrl(),
    'Claim Form PDF': '', 'Assigned To': '', 'Internal Notes': '',
    'Follow-ups Sent': '',
    'Review Due': addWorkingDays_(new Date(), CLAIMS.REVIEW_WORKING_DAYS),
    'Last Updated': new Date(),
    'Flagged Checks': checkLines_(b.checks),
    'Answers (JSON)': extraJson_(b),
  });

  logClaim_(ref, 'claim-opened', 'client',
    typeLabel_(type) + (b.subtype ? ' · ' + clean_(b.subtype, 80) : '') + ' · ' + name);

  // The filing session proves itself with this key on every upload, so a
  // guessed reference alone can never add files to someone else's claim.
  var uploadKey = randToken_();
  CacheService.getScriptCache().put('upk.' + ref, uploadKey, 21600);

  return {
    ok: true, ref: ref, uploadKey: uploadKey, folder: folder.getUrl(),
    maxFileMb: CLAIMS.MAX_FILE_MB, maxFiles: CLAIMS.MAX_FILES,
  };
}

/**
 * Step 2 — one document, possibly split across several calls.
 * The client slices the *base64 string* so the parts concatenate
 * back into exactly the original encoding.
 */
function apiClaimFile_(b) {
  var ref = clean_(b.ref, 30).toUpperCase();
  var hit = findClaim_(ref);
  if (!hit) throw new Error('We could not find that claim reference.');

  var who = mayTouchClaim_(b, hit);
  if (!who) throw new Error('signed-out');

  var uploadId = clean_(b.uploadId, 60);
  var part = Number(b.part) || 0;
  var parts = Number(b.parts) || 1;
  var data = String(b.data || '');
  if (!uploadId) throw new Error('Upload is missing its id.');
  if (!data) throw new Error('That document arrived empty — please try again.');

  var scratch = partsFolder_();

  // Not the last slice: park it and wait for the rest.
  if (part < parts - 1) {
    scratch.createFile(Utilities.newBlob(data, 'text/plain', partName_(ref, uploadId, part)));
    return { ok: true, buffered: true, part: part };
  }

  // Last slice: gather everything in order and rebuild the file.
  var b64 = '';
  for (var i = 0; i < parts - 1; i++) {
    var it = scratch.getFilesByName(partName_(ref, uploadId, i));
    if (!it.hasNext()) throw new Error('Part ' + (i + 1) + ' of that document did not arrive — please re-attach it.');
    var f = it.next();
    b64 += f.getBlob().getDataAsString();
    f.setTrashed(true);
  }
  b64 += data;

  var bytes = Utilities.base64Decode(b64);
  var sizeKb = Math.round(bytes.length / 1024);
  if (bytes.length > CLAIMS.MAX_FILE_MB * 1024 * 1024) {
    throw new Error('That document is larger than ' + CLAIMS.MAX_FILE_MB + 'MB.');
  }

  var docLabel = clean_(b.doc, 120) || 'Document';
  var fileName = safeName_(b.name) || (docLabel + '.dat');
  var mime = clean_(b.mime, 100) || 'application/octet-stream';

  var folderUrl = String(claimField_(hit, 'Drive Folder') || '');
  var folder = folderFromUrl_(folderUrl) ||
    claimFolder_(ref, String(claimField_(hit, 'Client Name') || ''), typeKeyFromLabel_(claimField_(hit, 'Claim Type')));

  var saved = folder.createFile(Utilities.newBlob(bytes, mime, docLabel + ' — ' + fileName));

  filesSheet_().appendRow([new Date(), ref, docLabel, fileName, sizeKb, mime, saved.getUrl()]);

  var count = Number(claimField_(hit, 'Files') || 0) + 1;
  setClaimField_(hit, 'Files', count);
  setClaimField_(hit, 'Last Updated', new Date());

  // A later upload can settle one of the documents we were waiting for.
  var satisfies = clean_(b.satisfies, 120);
  if (satisfies) {
    var owed = String(claimField_(hit, 'Missing Documents') || '')
      .split(';').map(function (s) { return s.trim(); }).filter(String)
      .filter(function (m) { return m.toLowerCase() !== satisfies.toLowerCase(); });
    setClaimField_(hit, 'Missing Documents', owed.join('; '));
    logClaim_(ref, 'document-received', who.name, satisfies + ' — ' + fileName +
      (owed.length ? ' · still outstanding: ' + owed.join(', ') : ' · nothing outstanding now'));
    if (!owed.length && String(claimField_(hit, 'Status')) === 'Awaiting documents') {
      setClaimField_(hit, 'Status', 'Under review');
    }
  } else if (who.by === 'staff') {
    logClaim_(ref, 'document-added', who.name, docLabel + ' — ' + fileName);
  }

  return { ok: true, name: fileName, sizeKb: sizeKb, link: saved.getUrl(), files: count };
}

function partName_(ref, uploadId, part) {
  return ref + '.' + uploadId + '.' + ('000' + part).slice(-4) + '.part';
}

function folderFromUrl_(url) {
  var m = String(url || '').match(/folders\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try { return DriveApp.getFolderById(m[1]); } catch (err) { return null; }
}

function typeKeyFromLabel_(label) {
  return typeKeyStrict_(label) || 'motor';
}

/** The same lookup with no fallback, for the one decision where guessing is
 *  expensive: who the claim is e-mailed to. typeKeyFromLabel_ answers 'motor'
 *  when it does not recognise a label, which was harmless while motor had no
 *  desk — an unrecognised claim simply went nowhere and said so. Motor is a
 *  confirmed desk at Guardian General now, so the same guess would send a
 *  client's claim to another company on the strength of a label we could not
 *  read. A real claim cannot reach that state (apiClaimStart_ validates the
 *  key and stores CLAIM_TYPES[key].label, so the label always round-trips),
 *  which is exactly why it would go unnoticed if it ever did. */
function typeKeyStrict_(label) {
  var l = String(label || '').toLowerCase();
  for (var k in CLAIM_TYPES) {
    if (CLAIM_TYPES[k].label.toLowerCase() === l) return k;
  }
  return '';
}

/**
 * Step 3 — everything is in. Notify the claims desk, acknowledge
 * the client, and record whatever they still owe us.
 */
function apiClaimFinish_(b) {
  var ref = clean_(b.ref, 30).toUpperCase();
  var hit = findClaim_(ref);
  if (!hit) throw new Error('We could not find that claim reference.');
  if (!mayTouchClaim_(b, hit)) throw new Error('signed-out');

  var missing = (b.missing || []).map(function (m) { return clean_(m, 120); }).filter(String);
  setClaimField_(hit, 'Missing Documents', missing.join('; '));
  setClaimField_(hit, 'Last Updated', new Date());

  var files = filesForRef_(ref);
  var claim = claimObject_(hit);

  // The desk works from a form, so render one and file it with the documents.
  var form = null;
  try { form = saveClaimForm_(hit, claim, files, missing); }
  catch (err) { logClaim_(ref, 'claim-form-failed', 'system', String(err)); }

  try { notifyDesk_(claim, files, missing, form); } catch (err) { logClaim_(ref, 'desk-email-failed', 'system', String(err)); }
  if (claim.email) {
    try { ackClient_(claim, files, missing, form); } catch (err) { logClaim_(ref, 'ack-email-failed', 'system', String(err)); }
  }

  logClaim_(ref, 'claim-submitted', 'client',
    files.length + ' document(s)' + (missing.length ? ' · outstanding: ' + missing.join(', ') : ''));

  // The branch ledger writes itself: one Claims__c row per filed claim.
  var claimsId = '';
  try { claimsId = sfLogClaim_(claim); }
  catch (err) { logClaim_(ref, 'sf-writeback-failed', 'system', String(err)); }

  /* ...and one task, so the claim is somebody's work and not only a record.
     After the ledger, so the task can name it. Never throws. */
  var notes = [];
  var taskNote = sfClaimTask_(claim, claimsId, files, missing);
  if (taskNote) notes.push(taskNote);

  /* The permit the client typed goes back onto their Contact — after the claim
     is safely recorded and the desk has been told, never before. Returns a line
     for the file and never throws; a Salesforce hiccup must not cost a claim. */
  var permitNote = permitWriteBack_(claim);
  if (permitNote) notes.push(permitNote);

  if (notes.length) {
    var had = String(claimField_(hit, 'Internal Notes') || '');
    setClaimField_(hit, 'Internal Notes', (had ? had + '\n' : '') + notes.join('\n'));
  }

  return { ok: true, ref: ref, files: files.length, missing: missing };
}

function filesForRef_(ref) {
  var sh = filesSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, 7).getValues();
  return rows.filter(function (r) { return String(r[1]).trim().toUpperCase() === ref; })
    .map(function (r) { return { doc: r[2], name: r[3], sizeKb: r[4], mime: r[5], link: r[6] }; });
}

function claimObject_(hit) {
  var g = function (f) { return String(claimField_(hit, f) || ''); };
  return {
    ref: g('Reference'), status: g('Status'), type: g('Claim Type'), subtype: g('Sub-type'),
    name: g('Client Name'), policy: g('Policy #'), mobile: g('Mobile'), email: g('Email'),
    nationalId: g('National ID'),
    /* Normalised here, once, because every reader wanted them normalised and
       none of them was: String()ing the Date the sheet hands back gave the
       desk 'Sun Nov 01 2026 03:00:00 GMT-0400', gave the claim form PDF the
       same, and made Salesforce's own yyyy-MM-dd test fail, so Date of
       Service was written as null on every claim. */
    incidentDate: iso_(claimField_(hit, 'Incident Date')),
    incidentTime: hhmm_(claimField_(hit, 'Incident Time')),
    location: g('Location'), description: g('Description'), amount: g('Estimated Amount (TT$)'),
    policeReport: g('Police Report #'), policeStation: g('Police Station'),
    thirdParty: g('Third Party'), bank: g('Bank Details'), folder: g('Drive Folder'),
    assigned: g('Assigned To'), reviewDue: claimField_(hit, 'Review Due'),
    flagged: g('Flagged Checks'),
    /* kind is the machine-readable type ('motor'); type is the label the sheet
       and the e-mails print ('Motor'). Two readers wanted two things, and one
       of them silently compared a label against a key. */
    kind: typeKey_(g('Claim Type')),
    extra: parseExtra_(g('Answers (JSON)')),
  };
}

function parseExtra_(s) {
  if (!s) return {};
  try { var o = JSON.parse(s); return (o && typeof o === 'object') ? o : {}; }
  catch (err) { return {}; }
}

/** 'Motor' back to 'motor' — the reverse of typeLabel_. */
function typeKey_(label) {
  var want = String(label || '').trim().toLowerCase();
  var keys = Object.keys(CLAIM_TYPES);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === want) return keys[i];
    if (String(typeLabel_(keys[i])).trim().toLowerCase() === want) return keys[i];
  }
  return want;
}


/* ============================ policy prefill ============================

 * Nobody can produce a chassis number standing at the roadside, and making
 * them try is most of why claim forms get abandoned. The register knows it
 * already — the job is to hand it over to the right person and nobody else.
 *
 * Two stages, because a number plate is public information:
 *
 *   1. findPolicy  — returns ONLY what is visible from the pavement anyway
 *                    (year, make, model) so the claimant can say "yes, that
 *                    is my car", plus which question they must answer next.
 *                    No name, no contact details, no policy number.
 *   2. verifyPolicy — they answer with the last four digits of the mobile we
 *                    hold, or their policy number. Only then does the record
 *                    come back.
 *
 * Without the split, anyone could type a stranger's plate and collect their
 * name, home email and phone number. With it, a plate alone yields nothing
 * the person standing behind the car cannot already see.
 * ====================================================================== */

function registerSheet_() {
  return namedSheet_(CLAIMS.REGISTER_SHEET, [
    'Reg Key', 'Vehicle Reg', 'Policy Key', 'Policy #', 'Client', 'Email', 'Mobile',
    'Make', 'Model', 'Year', 'Chassis #', 'Engine #', 'Coverage Type',
    'Insured Value (TT$)', 'Windscreen (TT$)', 'Carrier', 'Cover From', 'Cover To',
    'Vehicle Status', 'Years Insured',
    /* The permit, off the insured's own Contact. Guardian's accident report form
       asks for the number, the date of first issue and the date of expiry, and
       the expiry against the date of loss is the most material thing on a motor
       claim. Measured on the live org on 3 November 2026: a number on about one
       CLIENT contact in sixteen, an expiry on one in twenty-eight, an issue date
       on one in three hundred. So these are mostly blank, and the claim form is
       where the record finally gets filled in — which is the point of writing
       what the client types back to the Contact. */
    'Permit #', 'Permit Issued', 'Permit Expires',
    /* The insured's Contact id, so the write-back is one PATCH and not a
       second lookup. An internal id, never shown to a client. */
    'Contact Id',
    /* ONE ROW PER VEHICLE PER TERM since 5 November 2026, so these two are
       appended at the end — namedSheet_ backfills a new column by name onto a
       tab that already exists, and only at the end, so a register somebody has
       sorted or filtered is untouched.

       Until then every term of a vehicle was collapsed into one row, newest
       winning, and the register knew only the current year's cover. A claim for
       an accident in LAST year's term, filed after the renewal, therefore read
       as "the loss is before this policy started" — which is the wrong thing to
       say to a client with a perfectly good claim, and mid-term renewals are
       routine.

       'Term' is the cover period as a person reads it, so two rows for one
       plate can be told apart at a glance. 'Risk Id' is the Risk_Details__c
       record itself, which is what lets the claim name the exact term it
       attached to. */
    'Term', 'Risk Id',
    /* The TERM'S OWN policy record — Risk_Details__c.Client_Portfolio_Look_Up__c,
       a REQUIRED lookup to CLIENT_PORTFOLIO__c, so every vehicle row has one.
       Added 6 November 2026, and it is the answer to "is the claim on the
       vehicle or the transaction": the claim's own required parent is the policy
       record, so this is where the claim and the vehicle meet. See CLAIMS.SF_CLAIM.

       It is not a convenience. The policy register is built WHERE POLICY__c !=
       null, and one of the branch's only two motor claims hangs off a MOTOR
       policy record with a null policy number — so that client is not in the
       policy register at all, and without this column their claim could find no
       parent and would be skipped. */
    'Portfolio Id',
  ]);
}

function normKey_(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/* yyyy-MM-dd, which is the only thing an <input type="date"> accepts.
   A date written to a sheet as the text "2014-03-14" is parsed on the way in
   and comes back as a Date, whose toString is "Fri Mar 14 2014 00:00:00
   GMT-0400" — which a date input rejects in silence, so the field simply shows
   empty and the prefill looks as though it never happened. Same family as the
   group billing month that read back as a month. */
/* The zone Sheets used to BUILD the Date it hands back, which is the only
   zone that reads it back as the day and the hour that were typed. The
   script's own zone is a different setting and need not agree; formatting a
   midnight date cell in the wrong one moves it to the day before. */
function sheetTz_() {
  try { return cs_().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); }
  catch (err) { return Session.getScriptTimeZone() || 'America/Port_of_Spain'; }
}

/**
 * A time-only cell, back as HH:mm.
 *
 * Sheets stores a time with no date on **30 December 1899**, and that date is
 * old enough to carry a local-mean-time offset — Port of Spain ran at
 * -04:06:04 until 1912 — so String()ing the Date it hands back printed
 * 'Sat Dec 30 1899 18:30:00 GMT-0400' for a client who had typed 14:30.
 * The claims desk would have read the wrong time of loss on a motor claim.
 */
function hhmm_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, sheetTz_(), 'HH:mm');
  }
  var s = String(value).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i);               // 2:30 pm
  if (m) {
    var h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === 'p') h += 12;
    return ('0' + h).slice(-2) + ':' + m[2];
  }
  m = s.match(/(\d{1,2}):(\d{2})/);                                      // 14:30
  if (m) return ('0' + Math.min(23, Number(m[1]))).slice(-2) + ':' + m[2];
  return '';
}

/** 'yyyy-MM-dd' as a person reads it, WITHOUT going through new Date():
    new Date('2026-11-01') is UTC midnight, which is 31 October here. */
function niceDate_(value) {
  var s = iso_(value);
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(value || '');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return m[3] + ' ' + (months[Number(m[2]) - 1] || m[2]) + ' ' + m[1];
}

/** The incident as the desk should read it: '01 Nov 2026 at 14:30'. */
function whenText_(claim) {
  var d = niceDate_(claim.incidentDate);
  var t = hhmm_(claim.incidentTime);
  if (!d) return '';
  return d + (t ? ' at ' + t : '');
}

function iso_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, sheetTz_(), 'yyyy-MM-dd');
  }
  var s = String(value).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);            // dd/MM/yyyy
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  var d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Port_of_Spain', 'yyyy-MM-dd');
}

/** Every register row, cached for a few minutes — this is read on every lookup. */
function registerRows_() {
  var sh = registerSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  var values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  return values.map(function (row) {
    var o = {};
    headers.forEach(function (h, i) { o[h] = row[i]; });
    return o;
  });
}

/** Every term on file for one vehicle, newest first.
 *
 *  Match on the plate or the policy number — claimants have one or the other.
 *  The plate is tried against every row before the policy number is tried at
 *  all, because a policy number can be reissued and a plate cannot: matching
 *  plate-first on the whole register, rather than row by row, is what stops a
 *  2019 policy number pulling up the wrong vehicle's terms.
 *
 *  The register is written newest-term-first per plate (syncVehicleRegister),
 *  and the rows are returned in that order, so rows[0] is this year's cover. */
function findVehicleTerms_(query) {
  var key = normKey_(query);
  if (key.length < 4) return [];
  var rows = registerRows_();
  var hit = rows.filter(function (r) {
    return normKey_(r['Reg Key'] || r['Vehicle Reg']) === key;
  });
  if (hit.length) return hit;
  /* A policy number names one term directly. Give back that term and every
     other term of the SAME VEHICLE, so a client who quotes last year's policy
     number still gets this year's cover offered to them. */
  var byPolicy = rows.filter(function (r) {
    return normKey_(r['Policy Key'] || r['Policy #']) === key;
  });
  if (!byPolicy.length) return [];
  var plate = normKey_(byPolicy[0]['Reg Key'] || byPolicy[0]['Vehicle Reg']);
  if (!plate) return byPolicy;
  return rows.filter(function (r) {
    return normKey_(r['Reg Key'] || r['Vehicle Reg']) === plate;
  });
}

/** The newest term on file. What the sign-in, the prefill and the permit
 *  write-back have always used, and still should: a client typing their plate
 *  has not told us the date of loss yet. */
function findVehicle_(query) {
  var terms = findVehicleTerms_(query);
  return terms.length ? terms[0] : null;
}

/** The term that was in force on a given day, or null.
 *
 *  This is the whole point of keeping every term. A loss on 14 March 2024 is
 *  assessed against March 2024's sum insured, on March 2024's policy number,
 *  with March 2024's coverage type — none of which the single-row register
 *  could say. An undated or unmatched loss returns null and every caller falls
 *  back to the newest term, which is where they all were before. */
function vehicleTermOn_(terms, isoDay) {
  var want = iso_(isoDay);
  if (!want || !terms || !terms.length) return null;
  for (var i = 0; i < terms.length; i++) {
    var from = iso_(terms[i]['Cover From']), to = iso_(terms[i]['Cover To']);
    if (!from && !to) continue;                       // a term with no period dates
    if (from && want < from) continue;
    if (to && want > to) continue;
    return terms[i];
  }
  return null;
}

/** The register row a claim should be assessed against: the term in force on
 *  the date of loss, else the newest. Returns { row, terms, matched }. */
function vehicleForClaim_(query, isoDay) {
  var terms = findVehicleTerms_(query);
  if (!terms.length) return { row: null, terms: [], matched: false };
  var on = vehicleTermOn_(terms, isoDay);
  return { row: on || terms[0], terms: terms, matched: !!on };
}

/* ---- the non-motor register: health, life, pension, PA ---- */

function policyRegisterSheet_() {
  return namedSheet_(CLAIMS.POLICY_REGISTER_SHEET, [
    'Policy Key', 'Policy #', 'Line', 'Client', 'Email', 'Mobile',
    'DOB', 'Product', 'Expiry', 'Portfolio',
    /* The two ids the Salesforce task hangs off: the client's Contact and the
       policy record itself. Appended at the end (namedSheet_ backfills by name)
       and internal — never shown to a client. 'Portfolio' above is the policy
       record's NAME, which cannot be a parent id, which is why both are here. */
    'Contact Id', 'Portfolio Id',
  ]);
}

/**
 * Exact-match lookup by normalized policy number. TextFinder, not a full
 * read: the health register alone is ~2,000 rows and life/pension will take
 * it past 50,000 — scanning that on every keystroke would melt the quota.
 */
function findPolicyRecord_(query) {
  var key = normKey_(query);
  if (key.length < 4) return null;
  var sh = policyRegisterSheet_();
  if (sh.getLastRow() < 2) return null;
  var hit = sh.getRange(2, 1, sh.getLastRow() - 1, 1)
    .createTextFinder(key).matchEntireCell(true).findNext();
  if (!hit) return null;
  var values = sh.getRange(hit.getRow(), 1, 1, sh.getLastColumn()).getValues()[0];
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var o = {};
  headers.forEach(function (h, i) { o[String(h).trim()] = values[i]; });
  return o;
}

function dobKey_(value) {
  // The register holds yyyy-MM-dd; sheet may coerce it to a Date object.
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || 'America/Port_of_Spain', 'yyyyMMdd');
  }
  return String(value || '').replace(/\D/g, '');
}

/**
 * Five wrong answers on the same plate within fifteen minutes and it stops
 * talking. Enough to stop someone working through last-four-digit guesses,
 * loose enough that a client fumbling their own number never notices.
 */
function verifyThrottle_(key, spend) {
  var cache = CacheService.getScriptCache();
  var slot = 'vfy-' + normKey_(key);
  var used = Number(cache.get(slot) || 0);
  if (used >= 5) return false;
  if (spend) cache.put(slot, String(used + 1), 900);
  return true;
}

/** The verification questions a given register row supports. */
function verifyMethods_(row, includePolicyNumber) {
  var methods = [];
  if (last4_(row['Mobile']).length === 4) {
    methods.push({ id: 'mobile', label: 'The last 4 digits of your mobile number',
      hint: 'The number we have on file for this policy.' });
  }
  if (dobKey_(row['DOB']).length === 8) {
    methods.push({ id: 'dob', label: 'Your date of birth',
      hint: 'As it appears on the policy.' });
  }
  if (includePolicyNumber && normKey_(row['Policy Key'] || row['Policy #']).length >= 5) {
    methods.push({ id: 'policy', label: 'Your policy number',
      hint: 'On your certificate of insurance or renewal notice.' });
  }
  return methods;
}

/** Stage 1 — confirm we hold the policy without giving anything away.
 *  Vehicles answer to a plate or policy number; everything else (health,
 *  life, pension, PA) answers to its policy/plan number. */
function apiFindPolicy_(query) {
  var vehicle = findVehicle_(query);
  if (vehicle) {
    var descr = [vehicle['Year'], vehicle['Make'], vehicle['Model']].filter(String).join(' ').trim();
    var vMethods = verifyMethods_(vehicle, true);
    if (!vMethods.length) {
      return { ok: true, found: false,
        message: 'We found the vehicle but have no way to confirm it is yours online. Fill the form in by hand and we will match it up at our end.' };
    }
    return { ok: true, found: true, source: 'vehicle',
      vehicle: descr || 'Vehicle on file',
      coverage: String(vehicle['Coverage Type'] || ''), methods: vMethods };
  }

  var policy = findPolicyRecord_(query) || sfFindPortfolio_(query);
  if (policy) {
    // Reveal only what the policy number itself already implies.
    var line = String(policy['Line'] || 'Policy');
    var product = String(policy['Product'] || '');
    var pMethods = verifyMethods_(policy, false);
    if (!pMethods.length) {
      return { ok: true, found: false,
        message: 'We found the policy but have no way to confirm it is yours online. Fill the form in by hand and we will match it up at our end.' };
    }
    return { ok: true, found: true, source: 'policy',
      vehicle: line + ' policy' + (product ? ' — ' + product : ''),
      coverage: '', methods: pMethods };
  }

  return { ok: true, found: false,
    message: 'We could not match that. Check the number — or just fill the form in by hand, it only takes a little longer.' };
}

/** Stage 2 — they answered; hand over the record. */
function apiVerifyPolicy_(b) {
  var query = clean_(b.query, 40);
  var row = findVehicle_(query);
  var source = 'vehicle';
  if (!row) { row = findPolicyRecord_(query) || sfFindPortfolio_(query); source = 'policy'; }
  if (!row) return { ok: false, error: 'We could not match that policy.' };

  if (!verifyThrottle_(query, false)) {
    return { ok: false, error: 'Too many attempts on this policy. Please wait fifteen minutes, or simply fill the form in by hand.' };
  }

  var answer = clean_(b.answer, 60);
  var method = clean_(b.method, 20);
  var ok = false;

  if (method === 'mobile') {
    var given = String(answer).replace(/\D/g, '').slice(-4);
    ok = given.length === 4 && given === last4_(row['Mobile']);
  } else if (method === 'dob') {
    var want = dobKey_(row['DOB']);
    ok = want.length === 8 && dobKey_(answer) === want;
  } else if (method === 'policy' && source === 'vehicle') {
    var pk = normKey_(row['Policy Key'] || row['Policy #']);
    ok = pk.length >= 5 && normKey_(answer) === pk;
  }

  if (!ok) {
    verifyThrottle_(query, true);
    return { ok: false, error: 'That did not match what we have on file. Try again, or fill the form in by hand.' };
  }

  var val = function (f) { return String(row[f] === null || row[f] === undefined ? '' : row[f]).trim(); };

  if (source === 'vehicle') {
    logClaim_('(lookup)', 'policy-prefill', 'client', 'Matched ' + val('Vehicle Reg') + ' via ' + method);
    return { ok: true, terms: vehicleTermList_(query), prefill: {
      vehicleReg: val('Vehicle Reg'), vehicleMake: [val('Make'), val('Model')].filter(String).join(' '),
      vehicleYear: val('Year'), chassis: val('Chassis #'), engine: val('Engine #'),
      policy: val('Policy #'), coverage: val('Coverage Type'),
      insuredValue: val('Insured Value (TT$)'), windscreen: val('Windscreen (TT$)'),
      carrier: val('Carrier'),
      coverFrom: iso_(row['Cover From']), coverTo: iso_(row['Cover To']),
      name: val('Client'), email: val('Email'), mobile: val('Mobile'),
      /* driverPermit fills the field; permitOnFile is kept beside it as the
         policy's own value, so the page can tell the client their permit is
         not the one we hold when they overwrite it. Both come from the same
         cell, which is why prefilling cannot make that check fire by itself. */
      driverPermit: val('Permit #'),
      permitIssue: iso_(row['Permit Issued']), permitExpiry: iso_(row['Permit Expires']),
      permitOnFile: val('Permit #'),
    } };
  }

  logClaim_('(lookup)', 'policy-prefill', 'client', 'Matched ' + val('Line') + ' policy via ' + method);
  return { ok: true, prefill: {
    policy: val('Policy #'), coverage: [val('Line'), val('Product')].filter(String).join(' — '),
    name: val('Client'), email: String(val('Email')).toLowerCase(), mobile: val('Mobile'),
  } };
}

/** Every term on file for this vehicle, for the page to pick from once the
 *  client types the date of loss.
 *
 *  Only what the client is entitled to see about their own cover — no Contact
 *  id, no Risk id, no permit. Newest first, same order as the register. */
function vehicleTermList_(query) {
  return termsFromRows_(findVehicleTerms_(query));
}

/** The same list from register rows already in hand.
 *
 *  registerRows_ reads the whole tab on every call and the register is one row
 *  per vehicle per term, so a client with three cars signing in would otherwise
 *  read several thousand rows three times over to answer a question the first
 *  read had already answered. apiMyProfile_ has the rows; this is the mapper
 *  without the lookup, so the two paths can never drift apart. */
function termsFromRows_(rows) {
  return (rows || []).map(function (r) {
    var v = function (f) { return String(r[f] === null || r[f] === undefined ? '' : r[f]).trim(); };
    return {
      coverFrom: iso_(r['Cover From']), coverTo: iso_(r['Cover To']),
      policy: v('Policy #'), coverage: v('Coverage Type'),
      insuredValue: v('Insured Value (TT$)'), windscreen: v('Windscreen (TT$)'),
      carrier: v('Carrier'), status: v('Vehicle Status'),
    };
  }).filter(function (t) { return t.coverFrom || t.coverTo; });
}


/* ============================ status lookup ============================ */

/**
 * A client checking back on their claim. The reference alone is not
 * enough — they also have to know the last four digits of the mobile
 * number the claim was filed with.
 */
function apiStatus_(ref, last4) {
  var hit = findClaim_(clean_(ref, 30));
  var given = String(last4 || '').replace(/\D/g, '').slice(-4);
  if (!hit || given.length < 4 || last4_(claimField_(hit, 'Mobile')) !== given) {
    // Same answer either way, so the endpoint cannot be used to probe references.
    return { ok: false, error: 'We could not match that reference and mobile number. Please check both, or call us.' };
  }
  var claim = claimObject_(hit);
  var files = filesForRef_(claim.ref);
  var missing = String(claimField_(hit, 'Missing Documents') || '')
    .split(';').map(function (s) { return s.trim(); }).filter(String);

  return {
    ok: true,
    ref: claim.ref,
    status: claim.status || 'Received',
    type: claim.type,
    subtype: claim.subtype,
    filedOn: Utilities.formatDate(new Date(claimField_(hit, 'Timestamp')),
      Session.getScriptTimeZone() || 'America/Port_of_Spain', 'dd MMM yyyy'),
    documents: files.map(function (f) { return f.doc; }),
    missing: missing,
    agent: { name: CLAIMS.AGENT_NAME, phone: CLAIMS.AGENT_PHONE },
  };
}


/* ============================ emails ============================ */

function tr_(k, v) {
  return '<tr><td style="padding:7px 12px;background:#f4f7fa;border:1px solid #e3eaf2;width:190px;color:#5a6b80">' +
    k + '</td><td style="padding:7px 12px;border:1px solid #e3eaf2">' + v + '</td></tr>';
}

function brandWrap_(inner, tag) {
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433;max-width:640px">' +
    '<div style="background:' + CBRAND.navy + ';color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
    '<table width="100%"><tr>' +
    '<td width="46" valign="middle"><table cellpadding="0" cellspacing="0"><tr><td style="width:38px;height:38px;background:' + CBRAND.gold + ';border-radius:8px 8px 14px 14px;text-align:center;font-size:20px;font-weight:bold;color:' + CBRAND.navy + '">🛡</td></tr></table></td>' +
    '<td valign="middle" style="padding-left:10px"><b style="font-size:18px">Claims TT</b><br>' +
    '<span style="color:#b7c9de;font-size:12px">' + (tag || 'Claim submission') + ' · by ' + esc_(CLAIMS.AGENT_NAME) + '</span></td>' +
    '<td align="right" style="color:' + CBRAND.gold + ';font-size:11px;letter-spacing:2px"><b>CLAIMS</b></td></tr></table></div>' +
    '<div style="border:1px solid #dde5ee;border-top:none;padding:20px 22px;border-radius:0 0 10px 10px">' + inner +
    '<p style="color:#8a97a8;font-size:11px;border-top:1px solid #e3eaf2;padding-top:10px;margin-top:18px">' +
    'Submitting a claim is not an admission of liability by the insurer and does not guarantee payment. ' +
    'Cover and settlement are decided under your policy wording and schedule, which govern in all cases.</p>' +
    '</div></div>';
}

function noteBox_(html) {
  return '<div style="background:#fdf6e9;border-left:4px solid ' + CBRAND.gold + ';padding:12px 16px;margin:14px 0">' + html + '</div>';
}

function sig_() {
  return '<p>Warm regards,<br><b>' + esc_(CLAIMS.AGENT_NAME) + '</b><br>Ricky Rampersad Branch' +
    (CLAIMS.AGENT_PHONE ? '<br>' + esc_(CLAIMS.AGENT_PHONE) : '') + '</p>';
}

function fileListHtml_(files) {
  if (!files.length) return '<p style="color:#8a97a8">No documents were attached.</p>';
  return '<ul style="padding-left:18px;margin:8px 0">' + files.map(function (f) {
    return '<li style="margin:4px 0"><b>' + esc_(f.doc) + '</b> — <a href="' + esc_(f.link) + '">' +
      esc_(f.name) + '</a> <span style="color:#8a97a8">(' + f.sizeKb + ' KB)</span></li>';
  }).join('') + '</ul>';
}

/* ==================== what travels with the e-mail ====================

 * The desk notice used to attach the branch's own claim form and nothing
 * else: every document the client had just uploaded was a Drive link in the
 * body. So Guardian's own Motor Vehicle Accident Report Form — the one
 * document the motor desk actually works from, filled on the client's own
 * phone — arrived as a link, and the first live test came back with exactly
 * that: "did not go on the Guardian PDF".
 *
 * The documents travel with the mail now. Two things decide what fits:
 *
 *  - ORDER, because a budget cuts from the end. Guardian's own forms first,
 *    since the desk cannot open a file without them; then the papers an
 *    assessor reads — permit, estimate, police report, invoice; then the
 *    photographs, which are the heaviest and the least urgent.
 *  - A BUDGET, because Gmail refuses a message over 25 MB whole, and a
 *    refused message is a claim nobody hears about. 18 MB leaves room for
 *    the body, the branch form and MIME's own overhead.
 *
 * Anything that did not fit is named in the body with its link, so a desk
 * person is never left wondering whether a document exists.
 */
var ATTACH_BUDGET_MB = 18;

/** Guardian's own form, which the desk cannot work without. */
function isGuardianForm_(f) {
  return /guardian/i.test(String(f.doc) + ' ' + String(f.name)) &&
    /\.pdf$/i.test(String(f.name));
}

function attachRank_(f) {
  if (isGuardianForm_(f)) return 0;
  if (/^image\//i.test(String(f.mime))) return 2;
  return 1;
}

function driveIdFromUrl_(url) {
  var s = String(url || '');
  var m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : '';
}

/* An attachment is named for what it IS, never IMG_4821.jpg. Drive holds
   'Driver's permit — IMG_4821.jpg'; a mail client shows a long name badly,
   so the label carries it and the extension is kept, because a .pdf that
   loses its extension will not open on a desk machine. */
function attachName_(f, blob, seen) {
  var raw = String(f.name || blob.getName() || 'document');
  var dot = raw.lastIndexOf('.');
  var ext = dot > 0 ? raw.slice(dot) : '';
  /* Strip what a file system will not take, then collapse the gap it leaves:
     "Driver's permit — front and back" lost the dash and arrived at the desk
     as "Driver's permit  front and back.pdf", with two spaces in it. */
  var label = String(f.doc || '').replace(/[^A-Za-z0-9 '()&+.-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (!label) return raw;
  seen[label] = (seen[label] || 0) + 1;
  return label + (seen[label] > 1 ? ' ' + seen[label] : '') + ext;
}

/**
 * The blobs that go with a claim e-mail, and whatever stayed behind.
 * Never throws: a document Drive will not hand back must not cost the desk
 * its notice.
 */
function claimAttachments_(files, form, opts) {
  var o = opts || {};
  var out = form ? [form] : [];
  var used = form ? form.getBytes().length : 0;
  var budget = ATTACH_BUDGET_MB * 1024 * 1024;
  var left = [];
  var seen = {};

  var queue = (files || []).slice().sort(function (a, b) {
    return attachRank_(a) - attachRank_(b);
  });
  /* The client gets their own forms back for their records — not their own
     photographs, which they took and do not need posted to them. */
  if (o.formsOnly) queue = queue.filter(isGuardianForm_);

  for (var i = 0; i < queue.length; i++) {
    var f = queue[i];
    var id = driveIdFromUrl_(f.link);
    if (!id) { left.push(f); continue; }
    try {
      var blob = DriveApp.getFileById(id).getBlob();
      var size = blob.getBytes().length;
      if (used + size > budget) { left.push(f); continue; }
      blob.setName(attachName_(f, blob, seen));
      out.push(blob);
      used += size;
    } catch (err) { left.push(f); }
  }
  return { blobs: out, left: left };
}

function leftBehindHtml_(left) {
  if (!left || !left.length) return '';
  return '<div style="background:#fdf6e9;border-left:4px solid ' + CBRAND.gold +
    ';padding:12px 16px;margin:14px 0"><b>Not attached — open these in the folder:</b>' +
    fileListHtml_(left) + '</div>';
}

/** 'Attached: the claim form and 3 documents.' */
function attachedLine_(pack, form) {
  var docs = pack.blobs.length - (form ? 1 : 0);
  if (!form && !docs) return '';
  var bits = [];
  if (form) bits.push('the completed claim form');
  if (docs) bits.push(docs + ' document' + (docs === 1 ? '' : 's'));
  return ' Attached: ' + bits.join(' and ') + '. Everything is also saved in the folder.';
}

/* ─────────────────── what the desk is told, by line ───────────────────
 *
 * One shape for every line printed motor's questions at a health desk:
 * "Incident", "Location", "Police report #". The patient, their relationship
 * to the member, the provider, whether it was pre-authorised and whether
 * another plan pays were all asked of the client and then never shown to
 * anybody. Rewritten 5 November 2026 — "the fields need to be different as
 * this is a health claim submission".
 *
 * The order is the desk's own reading order, and a blank line is cut rather
 * than printed as "(not given)": a desk reads what is there faster than it
 * reads a column of dashes. Only the reference, the client and the claim
 * type are always printed, because those three identify the file.
 * ──────────────────────────────────────────────────────────────────── */

/** Guardian's own words for a health claim, beside ours. Their desk files by
 *  these, and the branch's own submissions have always carried them. */
var HEALTH_SUBMISSION = {
  'Prescription drugs': 'Prescription/Pharmacy Claim',
  'Doctor visit / consultation': 'Doctor Visit Claim',
  'Lab & diagnostics': 'Laboratory/Diagnostic Claim',
  'Dental': 'Dental Claim',
  'Optical': 'Optical Claim',
  'Hospitalisation / surgery': 'Hospitalisation/Surgical Claim',
  'Physiotherapy': 'Physiotherapy Claim',
  'Overseas treatment': 'Overseas Treatment Claim',
};

function submissionType_(claim) {
  var sub = String(claim.subtype || '').trim();
  if (typeKeyFromLabel_(claim.type) === 'health') {
    return HEALTH_SUBMISSION[sub] || (sub ? sub + ' Claim' : 'Health Claim');
  }
  return sub || String(claim.type || 'Claim');
}

/** The subject the desk already files by — which is not the same shape on
 *  every line, so one format for all five would be wrong on four of them.
 *
 *  Guardian General's motor desk has filed this branch's claims under
 *  "Vehicle # - <plate> Insured - <name> Date of Accident - <date>" for
 *  years: one claim ran three months on that single subject, and every reply
 *  quotes it, so a thread that does not match it starts life detached from
 *  how they work. Motor therefore keeps their shape and carries our own
 *  reference on the end, because the reference is what a reply has to quote
 *  for the claim to find its way back to the file.
 *
 *  Every other line keeps "RRB CLAIMS SUBMISSION - <type> - <client> -
 *  <ref>", which is the form sales support has sent by hand for years. */
function deskSubject_(claim, type, gap) {
  var flag = gap ? ' (not forwarded)' : '';
  if (type === 'motor') {
    var x = claim.extra || {};
    var plate = String(x.vehicleReg || claim.policy || '').trim();
    var when = niceDate_(claim.incidentDate);
    /* Their own wording keeps the label even when we have no value, because
       a gap in a subject they file by is a question they can answer; a
       missing label reads as a different kind of message altogether. */
    return 'Vehicle # - ' + (plate || '(not given)') + flag +
      ' Insured - ' + (claim.name || '(not given)') +
      ' Date of Accident - ' + (when || '(not given)') +
      ' - ' + claim.ref;
  }
  return 'RRB CLAIMS SUBMISSION' + flag + ' - ' +
    submissionType_(claim) + ' - ' + claim.name + ' - ' + claim.ref;
}

/** Guardian gives ninety days from the date of treatment. We hold that date,
 *  so the desk is told rather than asked — and the branch sees it on the day
 *  the claim is filed, which is the only day it can still be acted on. */
function claimAgeDays_(claim) {
  var iso = iso_(claim.incidentDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  var part = iso.split('-');
  var then = Date.UTC(+part[0], +part[1] - 1, +part[2]);
  var today = iso_(new Date()).split('-');
  var now = Date.UTC(+today[0], +today[1] - 1, +today[2]);
  return Math.round((now - then) / 86400000);
}

function ninetyDayNote_(claim) {
  if (typeKeyFromLabel_(claim.type) !== 'health') return '';
  var days = claimAgeDays_(claim);
  if (days === null || days < 0) return '';
  if (days > 90) {
    return '<div style="background:#fbe9e7;border-left:4px solid #b3261e;padding:12px 16px;margin:0 0 4px">' +
      '<b>Over ninety days old.</b> The treatment was ' + days + ' days ago. Guardian\'s own claim ' +
      'checklist asks whether ninety days or less have passed, so this one needs a decision ' +
      'rather than a routine submission.</div>';
  }
  if (days > 75) {
    return '<div style="background:#fff7e6;border-left:4px solid #d9a93f;padding:12px 16px;margin:0 0 4px">' +
      '<b>' + (90 - days) + ' day' + (90 - days === 1 ? '' : 's') + ' left of the ninety.</b> ' +
      'The treatment was ' + days + ' days ago.</div>';
  }
  return '';
}

/* The client's own words, without the block the page folds onto the end of
   them. claims/index.html appends every type-specific answer to the
   description under a "— — —" rule, because for a long time that was the only
   way those answers reached anybody. They now have labelled rows of their own
   on the desk notice and on the printed form, so printing the block as well
   says the patient's name, their relationship and their date of birth twice
   in the same e-mail.

   The Description column on the sheet keeps the whole folded text, untouched:
   it is the raw record of what was submitted, and Answers (JSON) holds the
   same answers structured. Nothing is lost by not printing it twice.

   A line is only taken off if it reads as one of ours — "Label: value", with
   a short label carrying no colon, which is every label the page can append.
   A client who types a row of dashes themselves keeps every word. */
function claimWords_(claim) {
  var text = String(claim.description || '');
  var cut = text.indexOf('\n\n— — —\n');
  if (cut < 0) return text.trim();
  var tail = text.slice(cut + 8).split('\n').filter(function (l) { return l.trim() !== ''; });
  if (!tail.length) return text.trim();
  for (var i = 0; i < tail.length; i++) {
    if (!/^[^:\n]{1,60}: \S/.test(tail[i])) return text.trim();
  }
  return text.slice(0, cut).trim();
}

function deskFields_(claim) {
  var x = claim.extra || {};
  var out = [];
  var row = function (label, value) {
    if (value === null || value === undefined || String(value).trim() === '') return;
    out.push(tr_(label, String(value)));
  };
  var join = function (parts) { return parts.filter(String).join(' · '); };
  var money = function (v) { return v ? esc_(fmtMoney_(v) || v) : ''; };

  row('<b>Reference</b>', '<b>' + esc_(claim.ref) + '</b>');
  row('Claim type', esc_(claim.type) + (claim.subtype ? ' — ' + esc_(claim.subtype) : ''));

  var type = typeKeyFromLabel_(claim.type);
  if (type === 'health') {
    row('Submission type', esc_(submissionType_(claim)));
    row('Member', esc_(claim.name));
    row('Plan / policy #', esc_(claim.policy || '(not given)'));
    row('Patient', join([esc_(x.patientName || claim.name),
      x.patientRel ? esc_(x.patientRel) : '', x.patientDob ? 'born ' + esc_(niceDate_(x.patientDob)) : '']));
    row('Date of treatment', esc_(niceDate_(claim.incidentDate) || '(not given)'));
    row('Provider', esc_(x.provider || ''));
    row('Where', esc_(claim.location || ''));
    row('Amount claimed', money(claim.amount));
    row('Pre-authorised', esc_(x.preauth || ''));
    row('Covered by another plan', esc_(x.otherCover || ''));
  } else if (type === 'property') {
    row('Client', esc_(claim.name));
    row('Policy #', esc_(claim.policy || '(not given)'));
    row('Property', esc_(claim.location || '(not given)'));
    row('What it is', esc_(x.propertyUse || ''));
    row('Anyone there', esc_(x.occupied || ''));
    row('Incident', esc_(whenText_(claim) || '(not given)'));
    row('Estimated loss', money(claim.amount));
    row('Emergency work done', esc_(x.emergency || ''));
    row('Fire station', esc_(x.fireStation || ''));
    row('Police report #', esc_(claim.policeReport || ''));
  } else if (type === 'life') {
    row('Policy owner', esc_(claim.name));
    row('Policy #', esc_(claim.policy || '(not given)'));
    row('Life assured', join([esc_(x.lifeAssured || ''),
      x.lifeDob ? 'born ' + esc_(niceDate_(x.lifeDob)) : '', x.lifeId ? 'ID ' + esc_(x.lifeId) : '']));
    row('Claimant', join([esc_(x.claimantName || ''), esc_(x.claimantRel || '')]));
    row('Employer', esc_(x.employer || ''));
    row('Date', esc_(whenText_(claim) || '(not given)'));
    row('Amount', money(claim.amount));
  } else {
    row('Client', esc_(claim.name));
    row('Policy #', esc_(claim.policy || '(not given)'));
    row('Vehicle', esc_(join([x.vehicleReg, x.vehicleMake, x.vehicleYear])));
    /* The cover term the loss falls in, and that term's sum insured — not
       whatever has been renewed since. An assessor reading a claim for a loss
       in March 2024 needs March 2024's figure, and until the register kept
       every term it could only ever show this year's. */
    row('Cover in force', esc_(coverTermText_(claim)));
    row('Sum insured then', money(coverFact_(claim, 'insuredValue')));
    row('Incident', esc_(whenText_(claim) || '(not given)'));
    row('Location', esc_(claim.location || ''));
    row('Estimated amount', money(claim.amount));
    row('Police report #', esc_(claim.policeReport || ''));
    row('Police station', esc_(claim.policeStation || ''));
    row('Third party', esc_(claim.thirdParty || ''));
  }

  row('Mobile', esc_(claim.mobile));
  row('Email', esc_(claim.email || '(none)'));
  row('National ID', esc_(claim.nationalId || ''));
  row('Settlement bank', esc_(claim.bank || ''));
  row('<b>' + (type === 'health' ? 'What the treatment was for' : 'What happened') + '</b>',
    esc_(claimWords_(claim)).replace(/\n/g, '<br>'));
  return out.join('');
}

function notifyDesk_(claim, files, missing, form) {
  // Strict: an unreadable label gets no desk, never motor's. See typeKeyStrict_.
  var type = typeKeyStrict_(claim.type);
  var desk = deskFor_(type);
  var gap = deskGap_(type);
  var pack = claimAttachments_(files, form);
  // The branch's own subject line, per line of business. See deskSubject_.
  var subject = deskSubject_(claim, type, gap);

  /* No confirmed desk: the branch alone gets it, with the reason at the top.
     Never a fallback address — a claim landing in an unwatched mailbox reads
     as handled and is not. */
  var cc = ccList_(type);
  sendMail_({
    to: desk || cc, cc: desk ? cc : '', replyTo: claim.email || undefined, name: CLAIMS.FROM_NAME,
    subject: subject,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433">' +
      '<div style="background:' + CBRAND.navy + ';color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">' +
      '<b>New claim submitted online — ' + esc_(claim.ref) + '</b></div>' +
      (gap ? '<div style="background:#fbe9e7;border-left:4px solid #b3261e;padding:12px 16px;margin:0 0 4px">' +
        '<b>Pass this on by hand.</b><br>' + esc_(gap) + '</div>' : '') +
      ninetyDayNote_(claim) +
      '<table style="border-collapse:collapse;width:100%;max-width:680px">' +
      deskFields_(claim) +
      '</table>' +
      '<h3 style="margin:20px 0 4px;font-size:15px">Documents received (' + files.length + ')</h3>' +
      fileListHtml_(files) +
      leftBehindHtml_(pack.left) +
      (missing.length
        ? '<div style="background:#fbe9e7;border-left:4px solid #b3261e;padding:12px 16px;margin:14px 0">' +
          '<b>Client flagged as still outstanding:</b><br>' + esc_(missing.join(', ')) + '</div>'
        : '') +
      '<p style="margin:16px 0"><a href="' + esc_(claim.folder) + '" style="background:' + CBRAND.gold +
      ';color:' + CBRAND.navy + ';text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:8px;display:inline-block">' +
      'Open the document folder</a></p>' +
      '<p style="color:#5a6b80;font-size:12px">Submitted through Claims TT on ' + nowStamp_() + '.' +
      attachedLine_(pack, form) + '</p></div>',
    attachments: pack.blobs,
  });
}

function ackClient_(claim, files, missing, form) {
  var first = String(claim.name).split(' ')[0] || 'there';
  var pack = claimAttachments_(files, form, { formsOnly: true });
  var forms = pack.blobs.length - (form ? 1 : 0);
  sendMail_({
    to: claim.email, name: CLAIMS.FROM_NAME,
    subject: 'We have your claim — ' + claim.ref,
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_(first) + ',</p>' +
      '<p>Thank you — your <b>' + esc_(claim.type).toLowerCase() + '</b> claim has been received and is now with our claims team.</p>' +
      '<p style="background:' + CBRAND.light + ';border:1px solid #CBEAE8;border-radius:10px;padding:14px 18px;text-align:center;font-size:16px">' +
      'Your claim reference<br><b style="font-size:22px;letter-spacing:1px;color:' + CBRAND.navy + '">' + esc_(claim.ref) + '</b></p>' +
      '<p>Please quote that reference in any call or email about this claim.</p>' +
      '<h3 style="font-size:15px;margin:20px 0 4px">What we received</h3>' +
      fileListHtml_(files) +
      (missing.length
        ? noteBox_('<b style="color:#a05e03">Still needed:</b> ' + esc_(missing.join(', ')) +
            '. Sign in on the claims page with this email address to upload them straight into your claim — ' +
            'or simply reply to this email with them attached. Your claim can only be assessed once they are in.')
        : noteBox_('<b style="color:#a05e03">Nothing outstanding.</b> You have given us everything we asked for at this stage. ' +
            'If the assessor needs anything more, we will contact you.')) +
      '<h3 style="font-size:15px;margin:20px 0 4px">What happens next</h3>' +
      '<ol style="padding-left:18px;color:#3c4a5c">' +
      '<li style="margin:6px 0">Our claims team reviews the file and confirms your cover.</li>' +
      '<li style="margin:6px 0">Where an inspection is needed, an adjuster or approved assessor contacts you directly to arrange it.</li>' +
      '<li style="margin:6px 0">We tell you what is covered, what your excess is, and what the settlement looks like.</li>' +
      '</ol>' +
      (claim.reviewDue
        ? '<p>Please allow <b>' + CLAIMS.REVIEW_WORKING_DAYS + ' working days</b> for processing — your claim is scheduled for review by <b>' +
          esc_(fmtOrBlank_(claim.reviewDue)) + '</b>, and our team is reminded of it automatically on that day. ' +
          'You can check where things stand any time by signing in on the claims page.</p>'
        : '') +
      noteBox_('<b style="color:#a05e03">Please do not start repairs</b> until the claim has been inspected or you have written approval — ' +
        'work done beforehand may not be reimbursed.') +
      (form || forms
        ? '<p>Your completed <b>claim form</b>' +
          (forms ? ' and the <b>insurer’s own accident report form</b>, filled in from your answers,' : '') +
          ' ' + (form && forms ? 'are' : 'is') + ' attached — keep ' +
          (form && forms ? 'them' : 'it') + ' for your records. You do not need to print, sign or return ' +
          (form && forms ? 'them' : 'it') + '; you completed and declared everything online.</p>'
        : '') +
      '<p>Any question at all, call me on <b>' + esc_(CLAIMS.AGENT_PHONE) + '</b> (' + esc_(CLAIMS.BRANCH_HOURS) + ').</p>' +
      sig_(),
      'Claim acknowledgement'),
    attachments: pack.blobs,
  });
}

/* ============================ the claim form PDF ============================

 * The desk has always worked from a form, not from an email body, and the
 * adjuster's file needs a document that can be printed and filed. So every
 * claim renders one: the answers laid out as a form, on branded paper, saved
 * beside the documents in the claim's Drive folder and attached to the desk
 * email.
 *
 * Where Guardian's own PDF for a line of business is a fillable AcroForm, the
 * long-run answer is to push the values straight into its named fields. Apps
 * Script cannot do that on its own — see CLAIMS-SETUP.md for how that step
 * gets bolted on. This renderer is what runs today, and it is what keeps the
 * desk working on day one.
 * ======================================================================== */

function pdfRow_(label, value, wide) {
  return '<tr>' +
    '<td style="width:170px;padding:6px 9px;background:#EEF3F8;border:1px solid #C9D8E6;font-size:10.5px;color:#41576E;vertical-align:top">' +
      esc_(label) + '</td>' +
    '<td colspan="' + (wide ? 3 : 1) + '" style="padding:6px 9px;border:1px solid #C9D8E6;font-size:11px;vertical-align:top">' +
      (value ? String(value) : '<span style="color:#9FB2C4">—</span>') + '</td>' +
  '</tr>';
}

function pdfSection_(title) {
  return '<tr><td colspan="4" style="padding:12px 9px 5px;font-size:10px;font-weight:bold;letter-spacing:1.4px;' +
    'text-transform:uppercase;color:' + CBRAND.teal + ';border:none">' + esc_(title) + '</td></tr>';
}

/* The printed form's own middle, per line of business — the same split
   deskFields_ makes, for the same reason and one layer further in.

   Found 5 November 2026, reading a health claim's own PDF back: the e-mail
   body had been put right that morning and the attachment had not. It was
   still motor's shape for every line — a health claim headed THE INCIDENT,
   printing "Date", "Location" and "Estimated amount" for a treatment whose
   amount is a receipt total and not an estimate, and carrying the patient's
   name, their relationship and their date of birth nowhere except buried in
   the free text under a rule of dashes.

   That matters more than the e-mail did. The e-mail is read once; the PDF is
   what gets filed, forwarded and opened again six weeks later, and on a
   health claim the patient is the first thing an assessor needs to know,
   because the person treated is often not the member. */
function pdfFields_(claim) {
  var x = claim.extra || {};
  var out = [];
  var sec = function (title) { out.push(pdfSection_(title)); };
  var row = function (label, value) {
    if (value === null || value === undefined || String(value).trim() === '') return;
    out.push(pdfRow_(label, String(value), true));
  };
  var join = function (parts) { return parts.filter(String).join(' · '); };
  var money = function (v) { return v ? esc_(fmtMoney_(v) || v) : ''; };
  var type = typeKeyFromLabel_(claim.type);

  sec('The claim');
  row('Claim type', esc_(claim.type) + (claim.subtype ? ' — ' + esc_(claim.subtype) : ''));
  if (type === 'health') row('Submission type', esc_(submissionType_(claim)));
  row('Date filed', nowStamp_());
  row('Status', esc_(claim.status || 'Received'));

  sec(type === 'health' ? 'The member' : type === 'life' ? 'The policy' : 'The claimant');
  row(type === 'health' ? 'Member' : type === 'life' ? 'Policy owner' : 'Name', esc_(claim.name));
  row(type === 'health' ? 'Plan / policy number' : 'Policy number', esc_(claim.policy));
  row('Mobile', esc_(claim.mobile));
  row('Email', esc_(claim.email));
  row('National ID', esc_(claim.nationalId));

  if (type === 'health') {
    sec('The patient');
    row('Patient', esc_(x.patientName || claim.name));
    row('Relationship to the member', esc_(x.patientRel || ''));
    row('Date of birth', x.patientDob ? esc_(niceDate_(x.patientDob)) : '');

    sec('The treatment');
    row('Date of treatment', esc_(niceDate_(claim.incidentDate)));
    row('Provider', esc_(x.provider || ''));
    row('Where', esc_(claim.location));
    row('Amount claimed', money(claim.amount));
    row('Pre-authorised', esc_(x.preauth || ''));
    row('Covered by another plan', esc_(x.otherCover || ''));
    row('What the treatment was for', esc_(claimWords_(claim)).replace(/\n/g, '<br>'));
  } else if (type === 'property') {
    sec('The property');
    row('Address', esc_(claim.location));
    row('What it is', esc_(x.propertyUse || ''));
    row('Anyone there at the time', esc_(x.occupied || ''));

    sec('The incident');
    row('Date', esc_(whenText_(claim)));
    row('Estimated loss', money(claim.amount));
    row('Emergency work done', esc_(x.emergency || ''));
    row('Fire station attended', esc_(x.fireStation || ''));
    row('Police report', esc_(join([claim.policeStation, claim.policeReport])));
    row('What happened', esc_(claimWords_(claim)).replace(/\n/g, '<br>'));
  } else if (type === 'life') {
    sec('The life assured');
    row('Life assured', esc_(x.lifeAssured || ''));
    row('Date of birth', x.lifeDob ? esc_(niceDate_(x.lifeDob)) : '');
    row('National ID', esc_(x.lifeId || ''));
    row('Employer', esc_(x.employer || ''));

    sec('The claimant');
    row('Claimant', esc_(x.claimantName || ''));
    row('Relationship', esc_(x.claimantRel || ''));

    sec('The claim');
    row('Date', esc_(whenText_(claim)));
    row('Amount', money(claim.amount));
    row('What happened', esc_(claimWords_(claim)).replace(/\n/g, '<br>'));
  } else {
    sec('The vehicle and the cover');
    row('Registration', esc_(x.vehicleReg || ''));
    row('Make and model', esc_(x.vehicleMake || ''));
    row('Year', esc_(x.vehicleYear || ''));
    row('Chassis', esc_(x.chassis || ''));
    row('Engine', esc_(x.engine || ''));
    row('Coverage', esc_(x.coverage || coverFact_(claim, 'coverage')));
    /* The year of cover the loss falls in. The form is what gets filed and
       opened again weeks later, so the term is on it rather than only in the
       covering e-mail. */
    row('Cover in force', esc_(coverTermText_(claim)));
    row('Sum insured then', money(coverFact_(claim, 'insuredValue')));
    row('Carrier', esc_(coverFact_(claim, 'carrier')));

    sec('The incident');
    row('Date', esc_(whenText_(claim)));
    row('Location', esc_(claim.location));
    row('Estimated amount', money(claim.amount));
    row('Police report', esc_(join([claim.policeStation, claim.policeReport])));
    row('Third party', esc_(claim.thirdParty || ''));
    row('What happened', esc_(claimWords_(claim)).replace(/\n/g, '<br>'));
  }

  if (claim.bank) { sec('Settlement'); row('Bank details', esc_(claim.bank)); }
  return out.join('');
}

/* ---- the cover term the claim is assessed against ----
 *
 * `_policy` in Answers (JSON) is what the CLIENT confirmed on the page: the
 * term whose dates bracket their date of loss, picked when they typed it
 * (claims/index.html), not whatever has been renewed since. That is the right
 * thing to print — it is what they saw and agreed to — and the Salesforce task
 * carries the register's own answer beside it, so the two can be compared if
 * they ever disagree.
 *
 * Empty for a claim filed by hand, and empty on every claim filed before 5
 * November 2026. Both print nothing rather than a guess. */
function coverFacts_(claim) {
  var x = claim.extra || {};
  return (x._policy && typeof x._policy === 'object') ? x._policy : {};
}
function coverFact_(claim, key) {
  return String(coverFacts_(claim)[key] || '').trim();
}
function coverTermText_(claim) {
  var p = coverFacts_(claim);
  var from = niceDate_(p.coverFrom), to = niceDate_(p.coverTo);
  if (!from && !to) return '';
  var span = (from || '?') + ' to ' + (to || '?');
  var pol = String(p.policy || '').trim();
  return span + (pol && pol !== String(claim.policy || '').trim() ? ' · policy ' + pol : '');
}

/* The ninety-day decision travels on the form too, not only in the covering
   e-mail: the form is what is filed, and whoever opens it later has to see
   that the date was already known and flagged on the day it was filed. */
function pdfNinetyNote_(claim) {
  if (typeKeyFromLabel_(claim.type) !== 'health') return '';
  var days = claimAgeDays_(claim);
  if (days === null || days < 0 || days <= 75) return '';
  var over = days > 90;
  return '<table width="100%" style="border-collapse:collapse;margin-bottom:12px"><tr>' +
    '<td style="background:' + (over ? '#FBE9E7' : '#FFF7E6') + ';border-left:4px solid ' +
      (over ? '#B3261E' : '#D9A93F') + ';padding:9px 12px;font-size:10.5px;color:#152435">' +
    (over
      ? '<b>Over ninety days old.</b> The treatment was ' + days + ' days ago. Guardian\'s claim ' +
        'checklist asks whether ninety days or less have passed.'
      : '<b>' + (90 - days) + ' day' + (90 - days === 1 ? '' : 's') + ' left of the ninety.</b> ' +
        'The treatment was ' + days + ' days ago.') +
    '</td></tr></table>';
}

/** The claim, as a form. Returns a PDF blob. */
function claimFormBlob_(claim, files, missing) {
  var html =
    '<html><body style="font-family:Helvetica,Arial,sans-serif;color:#152435;margin:0">' +
    '<table width="100%" style="border-collapse:collapse;margin-bottom:14px">' +
      '<tr><td style="background:' + CBRAND.navy + ';color:#fff;padding:16px 18px">' +
        '<div style="font-size:19px;font-weight:bold">Claim Form — ' + esc_(claim.type) + '</div>' +
        '<div style="font-size:11px;color:#B7C9DE;margin-top:3px">Claims TT · Ricky Rampersad Branch</div>' +
      '</td>' +
      '<td style="background:' + CBRAND.navy + ';color:' + CBRAND.gold + ';padding:16px 18px;text-align:right;vertical-align:middle">' +
        '<div style="font-size:9px;letter-spacing:2px;color:#B7C9DE">REFERENCE</div>' +
        '<div style="font-size:19px;font-weight:bold;letter-spacing:1px">' + esc_(claim.ref) + '</div>' +
      '</td></tr>' +
    '</table>' +

    pdfNinetyNote_(claim) +

    '<table width="100%" style="border-collapse:collapse">' +
      pdfFields_(claim) +

      pdfSection_('Documents received (' + files.length + ')') +
      pdfRow_('Attached', files.length
        ? files.map(function (f) { return esc_(f.doc) + ' — ' + esc_(f.name); }).join('<br>')
        : '', true) +
      (missing.length ? pdfRow_('Outstanding', '<b style="color:#B3261E">' + esc_(missing.join('<br>')) + '</b>', true) : '') +
    '</table>' +

    '<table width="100%" style="border-collapse:collapse;margin-top:26px">' +
      '<tr>' +
        '<td style="width:55%;padding-top:26px;border-top:1px solid #41576E;font-size:10px;color:#41576E">' +
          'Claimant\'s signature<br><span style="font-size:9px;color:#7A8FA3">Declared true and complete online on ' + nowStamp_() + '</span></td>' +
        '<td style="width:8%"></td>' +
        '<td style="padding-top:26px;border-top:1px solid #41576E;font-size:10px;color:#41576E">Date</td>' +
      '</tr>' +
    '</table>' +

    '<p style="font-size:9px;color:#7A8FA3;margin-top:20px;line-height:1.5">' +
      'Submitted through Claims TT. Filing a claim is not an admission of liability by the insurer and does not ' +
      'guarantee payment; cover and settlement are determined under the policy wording and schedule, which govern ' +
      'in all cases. The claimant accepted the declaration, information-sharing authority and liability notice online ' +
      'at the time of filing; the audit record is held against reference ' + esc_(claim.ref) + '.' +
    '</p></body></html>';

  return Utilities.newBlob(html, MimeType.HTML, 'Claim Form — ' + claim.ref + '.pdf').getAs(MimeType.PDF);
}

/** Render the form, file it beside the documents, and remember where it went. */
function saveClaimForm_(hit, claim, files, missing) {
  var pdf = claimFormBlob_(claim, files, missing);
  var folder = folderFromUrl_(claim.folder);
  if (folder) {
    var saved = folder.createFile(pdf);
    setClaimField_(hit, 'Claim Form PDF', saved.getUrl());
  }
  return pdf;
}


/* ============================ automated follow-up ============================

 * A claim stalls in one of two places: the client never sends the document
 * they said they would, or the file sits on a desk. This runs daily and
 * pushes on both, and it stops the moment the claim closes — nobody gets
 * chased about a claim that has already settled.
 * ========================================================================= */

function daysSince_(value) {
  var d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return -1;
  return Math.floor((new Date().getTime() - d.getTime()) / 86400000);
}

function isClosed_(status) {
  return CLAIMS.CLOSED_STATUSES.indexOf(String(status || '').trim()) >= 0;
}

/** Follow-ups already sent, as a set of markers like "chase-7" / "desk-25". */
function sentMarkers_(hit) {
  return String(claimField_(hit, 'Follow-ups Sent') || '')
    .split(',').map(function (s) { return s.trim(); }).filter(String);
}
function markSent_(hit, marker) {
  var all = sentMarkers_(hit);
  all.push(marker);
  setClaimField_(hit, 'Follow-ups Sent', all.join(', '));
}

/** Install from the menu. Runs ~9am daily. */
function claimsFollowUp() {
  var sh = claimsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return { chased: 0, nudged: 0 };

  var map = headerMap_(sh);
  var chased = 0, nudged = 0;

  for (var r = 2; r <= last; r++) {
    var hit = { row: r, values: sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0], map: map, sheet: sh };
    var claim = claimObject_(hit);
    if (!claim.ref || isClosed_(claim.status)) continue;

    var age = daysSince_(claimField_(hit, 'Timestamp'));
    var quiet = daysSince_(claimField_(hit, 'Last Updated'));
    if (age < 0) continue;

    var missing = String(claimField_(hit, 'Missing Documents') || '')
      .split(';').map(function (s) { return s.trim(); }).filter(String);
    var sent = sentMarkers_(hit);

    // 1. The client owes us something.
    if (missing.length && claim.email) {
      for (var i = 0; i < CLAIMS.CHASE_DAYS.length; i++) {
        var day = CLAIMS.CHASE_DAYS[i];
        var marker = 'chase-' + day;
        if (age >= day && sent.indexOf(marker) < 0) {
          try {
            sendChase_(claim, missing, i + 1, CLAIMS.CHASE_DAYS.length);
            markSent_(hit, marker);
            if (String(claim.status) === 'Received') setClaimField_(hit, 'Status', 'Awaiting documents');
            logClaim_(claim.ref, 'auto-chase', 'system', 'Reminder ' + (i + 1) + ' · ' + missing.join(', '));
            chased++;
          } catch (err) {
            logClaim_(claim.ref, 'auto-chase-failed', 'system', String(err));
          }
          break;   // one email per claim per day, never a burst
        }
      }
    }

    // 2. The 10-working-day promise has come due: the claim gets its review.
    var due = claimField_(hit, 'Review Due');
    if (due && daysSince_(due) >= 0 && sent.indexOf('review-10wd') < 0) {
      try {
        sendReviewDue_(claim, missing);
        markSent_(hit, 'review-10wd');
        logClaim_(claim.ref, 'review-due', 'system',
          CLAIMS.REVIEW_WORKING_DAYS + ' working days reached · assigned: ' + (claim.assigned || 'nobody'));
      } catch (err) {
        logClaim_(claim.ref, 'review-due-failed', 'system', String(err));
      }
    }

    // 3. Nothing has moved on our side.
    for (var k = 0; k < CLAIMS.DESK_NUDGE_DAYS.length; k++) {
      var nday = CLAIMS.DESK_NUDGE_DAYS[k];
      var nmark = 'desk-' + nday;
      if (quiet >= nday && sent.indexOf(nmark) < 0) {
        try {
          sendDeskNudge_(claim, age, quiet, missing);
          markSent_(hit, nmark);
          logClaim_(claim.ref, 'auto-desk-nudge', 'system', quiet + ' days without movement');
          nudged++;
        } catch (err) {
          logClaim_(claim.ref, 'auto-desk-nudge-failed', 'system', String(err));
        }
        break;
      }
    }
  }
  /*  Closed by hand on the sheet rather than through the dashboard — the
   *  status dropdown fires no code, so without this those clients are
   *  never asked.                                                       */
  var surveyed = 0;
  try { surveyed = claimSurveySweep_(); }
  catch (err) { Logger.log('survey sweep: ' + err); }
  return { chased: chased, nudged: nudged, surveyed: surveyed };
}

function sendChase_(claim, missing, n, total) {
  var closing = n >= total
    ? '<p>This is our last automatic reminder — from here we will call you instead. If these documents are hard to get, tell us and we will work around it; claims have been settled on less.</p>'
    : '<p>If any of these are hard to get hold of, reply and say so. There is almost always another way, and we would rather solve it than have your claim sit still.</p>';

  sendMail_({
    to: claim.email, cc: ccList_(), name: CLAIMS.FROM_NAME,
    subject: 'Reminder ' + n + ' — documents needed for claim ' + claim.ref,
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_(String(claim.name).split(' ')[0] || 'there') + ',</p>' +
      '<p>Your <b>' + esc_(String(claim.type).toLowerCase()) + '</b> claim <b>' + esc_(claim.ref) +
      '</b> is open and waiting on you for:</p>' +
      '<ul style="padding-left:18px">' + missing.map(function (m) {
        return '<li style="margin:5px 0"><b>' + esc_(m) + '</b></li>';
      }).join('') + '</ul>' +
      noteBox_('<b style="color:#a05e03">The quickest way:</b> sign in on the claims page with this email address and upload them ' +
        'straight into your claim — or reply to this email with a photo of each one attached. ' +
        'A phone photo is fine — flat, good light, whole page in frame.') +
      closing +
      '<p>Any question, call me on <b>' + esc_(CLAIMS.AGENT_PHONE) + '</b>.</p>' + sig_(),
      'Documents outstanding'),
  });
}

/** Staff email address for an "Assigned To" name, if they're on the Staff tab. */
function staffEmailForName_(name) {
  var want = String(name || '').trim().toLowerCase();
  if (!want) return '';
  var sh = staffSheet_();
  var last = sh.getLastRow();
  if (last < 2) return '';
  var rows = sh.getRange(2, 1, last - 1, 4).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (/^y/i.test(String(rows[i][3])) &&
        (String(rows[i][1]).trim().toLowerCase() === want || String(rows[i][0]).trim().toLowerCase() === want)) {
      return String(rows[i][0]).trim();
    }
  }
  return '';
}

/**
 * The 10-working-day review. The client was promised it in their
 * acknowledgement; this is the staff side of the same promise, with the
 * exact steps so nobody has to guess what "check the portal" means.
 */
function sendReviewDue_(claim, missing) {
  var to = staffEmailForName_(claim.assigned) || deskFor_(typeKeyFromLabel_(claim.type));
  var steps = [
    '<b>Check the carrier portal / system</b> for this claim' + (claim.policy ? ' (policy <b>' + esc_(claim.policy) + '</b>)' : '') + ' — has the carrier logged, assessed or paid it?',
    missing.length
      ? '<b>Outstanding from the client:</b> ' + esc_(missing.join(', ')) + ' — the automatic reminders are running; call if they have gone quiet.'
      : '<b>Nothing is outstanding from the client</b> — any delay from here is ours or the carrier’s to explain.',
    '<b>Update the claim status</b> on the dashboard or the sheet so the record reflects what you found.',
    '<b>Tell the client where things stand</b> — use "Email the client this update" when you change the status, or call. They were promised news by today.',
    'If the carrier has paid: record it, set the status to <b>Settled</b>, and the follow-ups stop by themselves.',
  ];
  sendMail_({
    to: to, cc: ccList_(), name: CLAIMS.FROM_NAME,
    subject: '🗓 10-working-day review due — claim ' + claim.ref + ' — ' + claim.name,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433">' +
      '<div style="background:' + CBRAND.navy + ';color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">' +
      '<b>Review due today — ' + esc_(claim.ref) + '</b></div>' +
      '<table style="border-collapse:collapse;width:100%;max-width:640px">' +
      tr_('Client', esc_(claim.name) + ' · ' + esc_(claim.mobile)) +
      tr_('Claim', esc_(claim.type) + (claim.subtype ? ' — ' + esc_(claim.subtype) : '')) +
      tr_('Status', esc_(claim.status)) +
      tr_('Assigned to', esc_(claim.assigned || 'nobody yet — please pick it up')) +
      '</table>' +
      '<p style="margin:16px 0 6px"><b>The review, step by step:</b></p>' +
      '<ol style="padding-left:20px;line-height:1.7">' +
      steps.map(function (s) { return '<li style="margin:6px 0">' + s + '</li>'; }).join('') +
      '</ol>' +
      '<p style="margin:16px 0"><a href="' + esc_(claim.folder) + '" style="background:' + CBRAND.gold +
      ';color:' + CBRAND.navy + ';text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:8px;display:inline-block">' +
      'Open the claim folder</a></p>' +
      '<p style="color:#5a6b80;font-size:12px">Sent automatically ' + CLAIMS.REVIEW_WORKING_DAYS +
      ' working days after filing — the turnaround the client was promised in their acknowledgement.</p></div>',
  });
}

function sendDeskNudge_(claim, age, quiet, missing) {
  sendMail_({
    to: deskFor_(typeKeyFromLabel_(claim.type)), cc: ccList_(typeKeyFromLabel_(claim.type)), name: CLAIMS.FROM_NAME,
    subject: 'Still open after ' + age + ' days — claim ' + claim.ref + ' — ' + claim.name,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433">' +
      '<div style="background:' + CBRAND.navy + ';color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">' +
      '<b>Open claim with no movement — ' + esc_(claim.ref) + '</b></div>' +
      '<table style="border-collapse:collapse;width:100%;max-width:640px">' +
      tr_('Reference', '<b>' + esc_(claim.ref) + '</b>') +
      tr_('Client', esc_(claim.name) + ' · ' + esc_(claim.mobile)) +
      tr_('Claim type', esc_(claim.type) + (claim.subtype ? ' — ' + esc_(claim.subtype) : '')) +
      tr_('Filed', age + ' days ago') +
      tr_('<b>No movement for</b>', '<b>' + quiet + ' days</b>') +
      tr_('Current status', esc_(claim.status)) +
      (missing.length ? tr_('Waiting on client for', esc_(missing.join(', '))) : tr_('Outstanding from client', 'Nothing — this one is with us')) +
      '</table>' +
      '<p style="margin:16px 0"><a href="' + esc_(claim.folder) + '" style="background:' + CBRAND.gold +
      ';color:' + CBRAND.navy + ';text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:8px;display:inline-block">' +
      'Open the claim folder</a></p>' +
      '<p style="color:#5a6b80;font-size:12px">Automatic reminder from Claims TT. It stops as soon as the claim reaches ' +
      esc_(CLAIMS.CLOSED_STATUSES.join(', ')) + '.</p></div>',
  });
}

function runFollowUpNow() {
  var out = claimsFollowUp();
  SpreadsheetApp.getUi().alert('Follow-up run complete.\n\n' +
    out.chased + ' client reminder(s) sent\n' + out.nudged + ' desk nudge(s) sent');
}


/** Menu action: nudge a client about documents still outstanding. */
function chaseMissingDocuments() {
  var sh = claimsSheet_();
  var sel = sh.getActiveRange();
  if (!sel || sel.getRow() < 2) {
    SpreadsheetApp.getUi().alert('Select the claim row (or rows) you want to chase, then run this again.');
    return;
  }
  var map = headerMap_(sh);
  var sent = 0, skipped = [];
  for (var r = sel.getRow(); r < sel.getRow() + sel.getNumRows(); r++) {
    var values = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
    var hit = { row: r, values: values, map: map, sheet: sh };
    var claim = claimObject_(hit);
    var missing = String(claimField_(hit, 'Missing Documents') || '')
      .split(';').map(function (s) { return s.trim(); }).filter(String);

    if (!claim.email) { skipped.push(claim.ref + ' (no email)'); continue; }
    if (!missing.length) { skipped.push(claim.ref + ' (nothing outstanding)'); continue; }

    sendMail_({
      to: claim.email, cc: ccList_(), name: CLAIMS.FROM_NAME,
      subject: 'Documents still needed for your claim — ' + claim.ref,
      htmlBody: brandWrap_(
        '<p>Dear ' + esc_(String(claim.name).split(' ')[0] || 'there') + ',</p>' +
        '<p>We are working on your <b>' + esc_(String(claim.type).toLowerCase()) + '</b> claim <b>' + esc_(claim.ref) +
        '</b>, but it cannot move forward until we receive:</p>' +
        '<ul style="padding-left:18px">' + missing.map(function (m) {
          return '<li style="margin:4px 0"><b>' + esc_(m) + '</b></li>';
        }).join('') + '</ul>' +
        '<p>Simply reply to this email with clear photos or scans attached — a phone photo is perfectly acceptable as long as the whole document is in frame and readable.</p>' +
        sig_(), 'Documents outstanding'),
    });
    setClaimField_(hit, 'Status', 'Awaiting documents');
    setClaimField_(hit, 'Last Updated', new Date());
    logClaim_(claim.ref, 'chased-documents', Session.getActiveUser().getEmail() || 'staff', missing.join(', '));
    sent++;
  }
  SpreadsheetApp.getUi().alert('Chased ' + sent + ' claim(s).' +
    (skipped.length ? '\n\nSkipped: ' + skipped.join(', ') : ''));
}

/** Menu action: tell the client their status changed. */
function sendStatusEmail_(claim) {
  sendMail_({
    to: claim.email, cc: ccList_(), name: CLAIMS.FROM_NAME,
    subject: 'Update on your claim — ' + claim.ref,
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_(String(claim.name).split(' ')[0] || 'there') + ',</p>' +
      '<p>Your claim <b>' + esc_(claim.ref) + '</b> has moved to:</p>' +
      '<p style="background:' + CBRAND.light + ';border:1px solid #CBEAE8;border-radius:10px;padding:14px 18px;text-align:center">' +
      '<b style="font-size:19px;color:' + CBRAND.navy + '">' + esc_(claim.status) + '</b></p>' +
      '<p>Sign in on the claims page with your email address to see your full claim at any time. ' +
      'We will be in touch as soon as there is more to tell you — or call me on <b>' + esc_(CLAIMS.AGENT_PHONE) +
      '</b> if you would like to talk it through.</p>' + sig_(), 'Claim update'),
  });
}

function notifyStatusChange() {
  var sh = claimsSheet_();
  var sel = sh.getActiveRange();
  if (!sel || sel.getRow() < 2) {
    SpreadsheetApp.getUi().alert('Select the claim row you want to update, then run this again.');
    return;
  }
  var map = headerMap_(sh);
  var hit = { row: sel.getRow(), values: sh.getRange(sel.getRow(), 1, 1, sh.getLastColumn()).getValues()[0], map: map, sheet: sh };
  var claim = claimObject_(hit);
  if (!claim.email) { SpreadsheetApp.getUi().alert('That claim has no email address on file — please call the client.'); return; }

  sendStatusEmail_(claim);
  setClaimField_(hit, 'Last Updated', new Date());
  logClaim_(claim.ref, 'status-emailed', Session.getActiveUser().getEmail() || 'staff', claim.status);
  SpreadsheetApp.getUi().alert('Update sent to ' + claim.email + '.');
}


/* ============================ housekeeping ============================ */

/** Sweep upload parts abandoned by a client who closed the tab mid-upload. */
function sweepAbandonedParts() {
  var cutoff = new Date().getTime() - CLAIMS.CHUNK_TTL_MINUTES * 60 * 1000;
  var files = partsFolder_().getFiles();
  var removed = 0;
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated().getTime() < cutoff) { f.setTrashed(true); removed++; }
  }
  return removed;
}


/* ============================ did we do what we promised? ============================
 *
 *  Claims TT makes the hardest written promise in the branch — a review
 *  within ten working days — and was the only platform that never asked
 *  the client how it went. The renewal portal has asked since it opened;
 *  the claim, which is the moment a client finds out whether any of this
 *  was worth paying for, asked nothing.
 *
 *  Three questions, on the same 1-to-5 scale the renewal survey uses, so
 *  the two books can finally be added together: how it went overall, how
 *  easy it was, how fast it felt.
 *
 *  THE FIRST CLICK IS THE ANSWER. Five scored links ride in the email, so
 *  rating the claim costs one tap from the inbox and nothing is lost if
 *  the client never reaches the page. The page then asks the other two
 *  and takes a comment. A survey that needs a form loaded before it
 *  records anything mostly records nothing.
 *
 *  A DECLINED CLAIM IS STILL ASKED, and asked differently. Surveying only
 *  the clients who were paid measures the policy wording, not the branch.
 *  The one number worth having is how the people who were turned down
 *  felt about being turned down.
 * ==================================================================================== */

var CSURVEY = {
  SHEET: 'Claim Surveys',

  /*  Days after a claim closes before the request goes out. 0 sends it on
   *  the status change, which is while the client still remembers. The
   *  daily follow-up catches claims closed by hand on the sheet.        */
  DAYS_AFTER_CLOSE: 0,

  /*  A score at or below this on the overall or the speed question raises
   *  a service-recovery note on the claim and emails the branch. Matches
   *  the renewal portal's threshold.                                     */
  RECOVERY_AT: 3,

  /*  The link in the email is Reference + this signature, so a reference
   *  on its own cannot be used to file somebody else's rating. The secret
   *  is created on first use and never leaves Script Properties.         */
  SECRET_PROP: 'CLAIM_SURVEY_SECRET',
  TOKEN_LEN: 16,

  COLUMNS: ['Timestamp', 'Reference', 'Claim Type', 'Client', 'Overall (1-5)',
            'Ease (1-5)', 'Speed (1-5)', 'Comments', 'Status At Close',
            'Days Open', 'Detail Completed'],
};

function claimSurveysSheet_() {
  return namedSheet_(CSURVEY.SHEET, CSURVEY.COLUMNS);
}

/* ---- the signature ---- */

function surveySecret_() {
  var p = PropertiesService.getScriptProperties();
  var s = String(p.getProperty(CSURVEY.SECRET_PROP) || '');
  if (!s) {
    s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    p.setProperty(CSURVEY.SECRET_PROP, s);
  }
  return s;
}

function surveyToken_(ref) {
  var sig = Utilities.computeHmacSha256Signature(String(ref || ''), surveySecret_());
  return sig.map(function (b) {
    return ((b < 0 ? b + 256 : b) + 0x100).toString(16).slice(1);
  }).join('').slice(0, CSURVEY.TOKEN_LEN);
}

/** Constant-length compare, so a wrong token leaks nothing by how long it took. */
function surveyTokenOk_(ref, token) {
  var want = surveyToken_(ref), got = String(token || '');
  if (got.length !== want.length) return false;
  var diff = 0;
  for (var i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

function surveyLink_(ref, score) {
  var url = String(CLAIMS.SURVEY_URL || '');
  if (!url) return '';
  return url + (url.indexOf('?') > -1 ? '&' : '?') +
    'survey=' + encodeURIComponent(ref) +
    '&k=' + surveyToken_(ref) +
    (score ? '&s=' + score : '');
}

/* ---- sending ---- */

/** True once a survey has gone out for this claim, so it can never go twice. */
function surveySent_(hit) {
  return sentMarkers_(hit).indexOf('survey') > -1;
}

function sendClaimSurvey_(claim, hit) {
  if (!claim.email) return false;
  if (!CLAIMS.SURVEY_URL) {
    logClaim_(claim.ref, 'survey-skipped', 'system',
      'CLAIMS.SURVEY_URL is not set — no link to send');
    return false;
  }
  var declined = /declin/i.test(claim.status);
  var first = esc_(String(claim.name).split(' ')[0] || 'there');

  /*  A settled claim and a declined claim are not the same conversation,
   *  and asking the second one in the first one's words reads as a taunt. */
  var intro = declined
    ? '<p>Your claim <b>' + esc_(claim.ref) + '</b> was not covered under your policy, and ' +
      'I know that is not the answer you were hoping for.</p>' +
      '<p>I would still like to know how the <b>process</b> felt — whether you were kept ' +
      'informed, and whether the reason was explained in a way that made sense. How we ' +
      'handle a claim we cannot pay says more about us than how we handle one we can.</p>'
    : '<p>Your claim <b>' + esc_(claim.ref) + '</b> is closed. Thank you for letting us ' +
      'handle it for you.</p>' +
      '<p>I would like to know how it went — honestly, including anything that was slower ' +
      'or harder than it should have been.</p>';

  var stars = '<table cellpadding="0" cellspacing="0" style="margin:18px auto"><tr>' +
    [1, 2, 3, 4, 5].map(function (n) {
      return '<td style="padding:0 5px"><a href="' + surveyLink_(claim.ref, n) + '" ' +
        'style="display:block;width:50px;height:50px;line-height:50px;text-align:center;' +
        'border:1px solid #dde5ee;border-radius:10px;background:' +
        (n >= 4 ? CBRAND.light : '#fff') + ';color:' + CBRAND.navy +
        ';font:bold 19px Arial,sans-serif;text-decoration:none">' + n + '</a></td>';
    }).join('') + '</tr><tr>' +
    '<td colspan="2" style="color:#8a97a8;font-size:11px;text-align:left;padding-top:6px">Poor</td>' +
    '<td></td>' +
    '<td colspan="2" style="color:#8a97a8;font-size:11px;text-align:right;padding-top:6px">Excellent</td>' +
    '</tr></table>';

  sendMail_({
    to: claim.email, name: CLAIMS.FROM_NAME,
    subject: 'How did we handle your claim? (one tap) — ' + claim.ref,
    htmlBody: brandWrap_(
      '<p>Dear ' + first + ',</p>' + intro +
      '<p style="text-align:center;margin-top:20px"><b>Overall, how was it?</b></p>' + stars +
      '<p style="text-align:center;color:#8a97a8;font-size:12px">One tap records it. ' +
      'The next screen asks two more questions if you have thirty seconds.</p>' +
      noteBox_('Every answer comes to me, not to a call centre. If something went wrong ' +
        'I would rather hear it from you than not hear it at all — ' +
        '<b>' + esc_(CLAIMS.AGENT_PHONE) + '</b>.') +
      sig_(), declined ? 'Your feedback' : 'Claim closed'),
  });
  if (hit) markSent_(hit, 'survey');
  logClaim_(claim.ref, 'survey-sent', 'system',
    (declined ? 'declined wording' : 'settled wording') + ' · ' + claim.status);
  return true;
}

/* ---- recording ---- */

/** The row for a reference, or null. */
function surveyRow_(ref) {
  var sh = claimSurveysSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var refs = sh.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]).trim() === String(ref).trim()) {
      return { row: i + 2, sheet: sh };
    }
  }
  return null;
}

/** First tap: the overall score. Idempotent — a re-click overwrites, never appends. */
function recordSurveyScore_(ref, score) {
  score = Math.max(1, Math.min(5, Number(score) || 0));
  if (!score) return null;
  var hit = findClaim_(ref);
  if (!hit) return null;
  var claim = claimObject_(hit);
  var openDays = daysSince_(claimField_(hit, 'Timestamp'));
  var existing = surveyRow_(ref);
  var sh = claimSurveysSheet_();

  if (existing) {
    existing.sheet.getRange(existing.row, 5).setValue(score);
    existing.sheet.getRange(existing.row, 1).setValue(new Date());
  } else {
    sh.appendRow([new Date(), claim.ref, claim.type, claim.name, score, '', '',
      (testMode_() ? '[TEST] ' : ''), claim.status, openDays >= 0 ? openDays : '', '']);
  }
  logClaim_(claim.ref, 'survey-scored', 'client', 'Overall ' + score + '/5');
  if (score <= CSURVEY.RECOVERY_AT) serviceRecovery_(claim, hit, 'overall ' + score + '/5');
  return claim;
}

/** Second step, from the page: ease, speed and a comment. */
function claimSurveyDetail(payload) {
  payload = payload || {};
  var ref = String(payload.ref || '').trim();
  if (!surveyTokenOk_(ref, payload.k)) throw new Error('That feedback link is not valid.');
  var hit = findClaim_(ref);
  if (!hit) throw new Error('That feedback link is not valid.');
  var claim = claimObject_(hit);

  var ease = Math.max(0, Math.min(5, Number(payload.ease) || 0));
  var speed = Math.max(0, Math.min(5, Number(payload.speed) || 0));
  var comments = clean_(payload.comments, 2000);

  var existing = surveyRow_(ref);
  if (!existing) {
    claimSurveysSheet_().appendRow([new Date(), claim.ref, claim.type, claim.name, '',
      ease || '', speed || '', (testMode_() ? '[TEST] ' : '') + comments, claim.status,
      '', 'Y']);
  } else {
    var sh = existing.sheet, r = existing.row;
    if (ease) sh.getRange(r, 6).setValue(ease);
    if (speed) sh.getRange(r, 7).setValue(speed);
    if (comments) sh.getRange(r, 8).setValue((testMode_() ? '[TEST] ' : '') + comments);
    sh.getRange(r, 11).setValue('Y');
  }
  logClaim_(claim.ref, 'survey-detail', 'client',
    'Ease ' + (ease || '—') + '/5 · Speed ' + (speed || '—') + '/5' +
    (comments ? ' · "' + comments.slice(0, 120) + '"' : ''));
  if (speed && speed <= CSURVEY.RECOVERY_AT) serviceRecovery_(claim, hit, 'speed ' + speed + '/5');
  return { ok: true };
}

/*  A bad score is not a statistic, it is a phone call somebody owes.
 *  The note goes on the claim so it is visible on the staff dashboard
 *  next to the claim itself, and the branch is emailed the same day. */
function serviceRecovery_(claim, hit, why) {
  var note = nowStamp_() + ' — SERVICE RECOVERY: client rated this claim ' + why +
    '. Call them.';
  try {
    var existing = String(claimField_(hit, 'Internal Notes') || '');
    setClaimField_(hit, 'Internal Notes', (existing ? existing + '\n' : '') + note);
    setClaimField_(hit, 'Last Updated', new Date());
  } catch (err) { Logger.log('recovery note: ' + err); }
  logClaim_(claim.ref, 'service-recovery', 'system', why);
  sendMail_({
    to: CLAIMS.MAIL_CC[0], name: CLAIMS.FROM_NAME,
    subject: '⚠ Service recovery — claim ' + claim.ref + ' rated ' + why,
    htmlBody: brandWrap_(
      '<p><b>' + esc_(claim.name) + '</b> rated claim <b>' + esc_(claim.ref) + '</b> ' +
      esc_(why) + '.</p>' +
      '<p>Type: ' + esc_(claim.type) + ' · closed as <b>' + esc_(claim.status) + '</b>' +
      (claim.assigned ? ' · handled by ' + esc_(claim.assigned) : ' · nobody assigned') + '</p>' +
      noteBox_('A note is already on the claim. The call is the part the system cannot do.') +
      (claim.mobile ? '<p>Reach them on <b>' + esc_(claim.mobile) + '</b>.</p>' : ''),
      'Service recovery'),
  });
}

/* ---- the page ---- */

/*  One page, two states. An invalid link and an unknown reference give
 *  the SAME answer, so the link cannot be used to find out whether a
 *  reference exists. No claim detail appears on it beyond a first name. */
function claimSurveyPage_(p) {
  var ref = String(p.survey || '').trim();
  var ok = ref && surveyTokenOk_(ref, p.k);
  var claim = null;
  if (ok) {
    var hit = findClaim_(ref);
    if (!hit) ok = false; else claim = claimObject_(hit);
  }
  if (!ok) return surveyHtml_(
    '<h1>This link has expired</h1>' +
    '<p>Feedback links are personal and stop working once the claim is archived. ' +
    'If you would still like to tell us how it went, call <b>' + esc_(CLAIMS.AGENT_PHONE) +
    '</b> — it is the same person who reads the surveys.</p>', '');

  var score = Math.max(0, Math.min(5, Number(p.s) || 0));
  if (score) recordSurveyScore_(ref, score);
  var first = esc_(String(claim.name).split(' ')[0] || 'there');

  var body =
    (score
      ? '<div class="got">Recorded — you rated it <b>' + score + ' out of 5</b>. Thank you.</div>'
      : '') +
    '<h1>' + (score ? 'Two more, if you have a moment' : 'How did we handle it, ' + first + '?') + '</h1>' +
    (score ? '' : '<div class="q"><label>Overall</label><div class="stars" data-k="sat"></div></div>') +
    '<div class="q"><label>How easy was it to deal with us?</label><div class="stars" data-k="ease"></div></div>' +
    '<div class="q"><label>How fast did it feel?</label><div class="stars" data-k="speed"></div></div>' +
    '<div class="q"><label>Anything you want to say<span class="opt"> — optional</span></label>' +
    '<textarea id="cm" rows="4" placeholder="What worked, what did not."></textarea></div>' +
    '<button id="go">Send my feedback</button>' +
    '<div class="err" id="err"></div>' +
    '<p class="fine">This goes to ' + esc_(CLAIMS.AGENT_NAME) + ' directly. ' +
    'Nothing about your policy or your claim changes because of what you say here.</p>';

  return surveyHtml_(body, ref, surveyToken_(ref), !!score);
}

function surveyHtml_(body, ref, token, haveScore) {
  var css =
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font:15px/1.6 Arial,Helvetica,sans-serif;color:#1a2433;background:#eef3f8;' +
      'min-height:100vh;display:grid;place-items:start center;padding:22px 16px 60px}' +
    '.card{background:#fff;border:1px solid #dde5ee;border-radius:16px;padding:26px 24px;' +
      'max-width:470px;width:100%;box-shadow:0 12px 34px rgba(14,42,71,.10)}' +
    '.top{background:' + CBRAND.navy + ';color:#fff;margin:-26px -24px 20px;padding:16px 24px;' +
      'border-radius:16px 16px 0 0;font-weight:bold;font-size:17px}' +
    '.top span{display:block;font-weight:normal;font-size:12px;color:#b7c9de;margin-top:2px}' +
    'h1{font-size:20px;line-height:1.3;margin-bottom:6px}' +
    '.got{background:' + CBRAND.light + ';border:1px solid #CBEAE8;border-radius:10px;' +
      'padding:12px 14px;margin-bottom:16px;font-size:14px}' +
    '.q{margin-top:18px}' +
    'label{display:block;font-weight:bold;font-size:14px;margin-bottom:7px}' +
    '.opt{font-weight:normal;color:#8a97a8}' +
    '.stars{display:flex;gap:7px}' +
    '.stars button{flex:1;height:48px;border:1px solid #dde5ee;background:#fff;border-radius:10px;' +
      'font:bold 17px Arial;color:' + CBRAND.navy + ';cursor:pointer}' +
    '.stars button.on{background:' + CBRAND.teal + ';border-color:' + CBRAND.teal + ';color:#fff}' +
    'textarea{width:100%;border:1px solid #dde5ee;border-radius:10px;padding:11px 13px;' +
      'font:14px Arial;resize:vertical}' +
    '#go{width:100%;margin-top:20px;background:' + CBRAND.navy + ';color:#fff;border:none;' +
      'border-radius:11px;padding:15px;font:bold 15px Arial;cursor:pointer}' +
    '#go:disabled{opacity:.55}' +
    '.err{display:none;background:#fdecea;border:1px solid #f5c2bd;color:#8c1d13;' +
      'border-radius:10px;padding:11px 13px;margin-top:12px;font-size:13.5px}' +
    '.fine{color:#8a97a8;font-size:11.5px;margin-top:16px;line-height:1.6}' +
    'button:focus-visible,textarea:focus-visible{outline:2px solid ' + CBRAND.teal + ';outline-offset:2px}';

  var js = !ref ? '' :
    'var S={};' +
    'document.querySelectorAll(".stars").forEach(function(row){' +
      'for(var n=1;n<=5;n++){(function(n){var b=document.createElement("button");' +
        'b.type="button";b.textContent=n;b.setAttribute("aria-label",n+" out of 5");' +
        'b.onclick=function(){S[row.dataset.k]=n;' +
          'row.querySelectorAll("button").forEach(function(x,i){x.classList.toggle("on",i<n);});};' +
        'row.appendChild(b);})(n);}' +
    '});' +
    'var go=document.getElementById("go"),err=document.getElementById("err");' +
    'go.onclick=function(){' +
      'err.style.display="none";' +
      'if(!' + (haveScore ? 'true' : 'S.sat') + '){err.textContent="Please tap a rating for the first question.";' +
        'err.style.display="block";return;}' +
      'go.disabled=true;go.textContent="Sending\\u2026";' +
      'google.script.run.withSuccessHandler(function(){' +
        'document.querySelector(".card").innerHTML=' +
          '"<div class=\\"top\\">Claims TT<span>Thank you</span></div>' +
          '<h1>Thank you.</h1><p>Your feedback is recorded and goes straight to ' +
          esc_(CLAIMS.AGENT_NAME).replace(/"/g, '\\"') + '. ' +
          'You can close this page.</p>";' +
      '}).withFailureHandler(function(e){' +
        'go.disabled=false;go.textContent="Send my feedback";' +
        'err.textContent=(e&&e.message)||"Something went wrong \\u2014 please try again.";' +
        'err.style.display="block";' +
      '}).claimSurveyDetail({ref:' + JSON.stringify(ref) + ',k:' + JSON.stringify(token || '') + ',' +
        'sat:S.sat||0,ease:S.ease||0,speed:S.speed||0,' +
        'comments:document.getElementById("cm").value});' +
    '};';

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_top">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Your feedback — Claims TT</title><style>' + css + '</style></head><body>' +
    '<div class="card"><div class="top">Claims TT<span>' + esc_(CLAIMS.AGENT_NAME) +
    ' · Guardian Group</span></div>' + body + '</div>' +
    (js ? '<script>' + js + '</script>' : '') + '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Your feedback — Claims TT')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---- what the dashboard reads ---- */

/*  Never the average alone. An average built from four replies out of
 *  forty is a number about four people, and the response rate is the
 *  part that says whether to believe it.                             */
function claimSurveyStats_() {
  var out = { sent: 0, scored: 0, rate: 0, overall: null, ease: null, speed: null,
              dist: [0, 0, 0, 0, 0], recovery: 0, recent: [] };
  var sh = claimSurveysSheet_();
  var last = sh.getLastRow();

  // how many were asked, counted off the claims themselves
  try {
    var csh = claimsSheet_();
    if (csh.getLastRow() > 1) {
      var map = headerMap_(csh);
      for (var r = 2; r <= csh.getLastRow(); r++) {
        var hit = { row: r, values: csh.getRange(r, 1, 1, csh.getLastColumn()).getValues()[0],
                    map: map, sheet: csh };
        if (surveySent_(hit)) out.sent++;
      }
    }
  } catch (err) { Logger.log('survey sent count: ' + err); }

  if (last < 2) return out;
  var rows = sh.getRange(2, 1, last - 1, CSURVEY.COLUMNS.length).getValues();
  var so = [], se = [], sp = [];
  rows.forEach(function (x) {
    var ov = Number(x[4]), ea = Number(x[5]), spd = Number(x[6]);
    if (ov >= 1 && ov <= 5) { out.scored++; so.push(ov); out.dist[ov - 1]++; }
    if (ea >= 1 && ea <= 5) se.push(ea);
    if (spd >= 1 && spd <= 5) sp.push(spd);
    if ((ov && ov <= CSURVEY.RECOVERY_AT) || (spd && spd <= CSURVEY.RECOVERY_AT)) out.recovery++;
    out.recent.push({ when: fmtOrBlank_(x[0]), ref: String(x[1]), type: String(x[2]),
                      overall: ov || null, ease: ea || null, speed: spd || null,
                      comments: String(x[7] || '').slice(0, 200), closedAs: String(x[8] || '') });
  });
  var mean = function (a) {
    return a.length ? Math.round(a.reduce(function (s, n) { return s + n; }, 0) / a.length * 10) / 10 : null;
  };
  out.overall = mean(so); out.ease = mean(se); out.speed = mean(sp);
  out.rate = out.sent ? Math.round(out.scored / out.sent * 1000) / 10 : 0;
  out.recent = out.recent.reverse().slice(0, 10);
  return out;
}

/* ---- menu ---- */

/** Shows the branch exactly what a client would get, without sending it. */
function previewClaimSurvey() {
  var ui = SpreadsheetApp.getUi();
  if (!CLAIMS.SURVEY_URL) {
    ui.alert('No survey URL is set.\n\n' +
      'The feedback link has to point at this web app. Deploy it, then put the\n' +
      '/exec URL into CLAIMS.SURVEY_URL at the top of Claims.gs.\n\n' +
      'Until it is set, a closed claim logs "survey-skipped" instead of mailing\n' +
      'a link that goes nowhere.');
    return;
  }
  var sh = claimsSheet_();
  var sel = sh.getActiveRange();
  if (!sel || sel.getRow() < 2) {
    ui.alert('Select a claim row first, then run this again.');
    return;
  }
  var map = headerMap_(sh);
  var hit = { row: sel.getRow(), values: sh.getRange(sel.getRow(), 1, 1, sh.getLastColumn()).getValues()[0],
              map: map, sheet: sh };
  var claim = claimObject_(hit);
  ui.alert('Claim ' + claim.ref + '\n\n' +
    'Status: ' + claim.status + (isClosed_(claim.status) ? ' (closed — would be surveyed)' : ' (still open — no survey yet)') + '\n' +
    'Survey already sent: ' + (surveySent_(hit) ? 'yes, it will not go again' : 'no') + '\n\n' +
    'The link that would go to the client:\n' + surveyLink_(claim.ref, 5) + '\n\n' +
    'Turn test mode on and run "Send feedback requests now" to receive it yourself.');
}

/** Catches claims closed by hand on the sheet. Safe to run any time. */
function sendClaimSurveysNow() {
  var n = claimSurveySweep_();
  SpreadsheetApp.getUi().alert(n === 0
    ? 'Nothing to send — every closed claim with an email has already been asked.'
    : n + ' feedback request' + (n === 1 ? '' : 's') + ' sent' +
      (testMode_() ? ' to ' + testInbox_() + ' (test mode).' : '.'));
}

/*  Rides the daily follow-up. A claim closed on the sheet rather than
 *  through the dashboard would otherwise never be asked.             */
function claimSurveySweep_() {
  var sh = claimsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var map = headerMap_(sh);
  var sent = 0;
  for (var r = 2; r <= last; r++) {
    var hit = { row: r, values: sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0],
                map: map, sheet: sh };
    var claim = claimObject_(hit);
    if (!claim.ref || !claim.email) continue;
    if (!isClosed_(claim.status)) continue;
    if (surveySent_(hit)) continue;
    var quiet = daysSince_(claimField_(hit, 'Last Updated'));
    if (quiet !== null && quiet >= 0 && quiet < CSURVEY.DAYS_AFTER_CLOSE) continue;
    try {
      if (sendClaimSurvey_(claim, hit)) sent++;
    } catch (err) {
      logClaim_(claim.ref, 'survey-send-failed', 'system', String(err));
    }
  }
  return sent;
}

/* ============================ setup & menu ============================ */

/* Say how setup went, without hanging.
 *
 * SpreadsheetApp.getUi().alert() posts its dialog in the SPREADSHEET tab and
 * then blocks until somebody clicks it. Run setupClaims from the Apps Script
 * editor — which is what the runbook tells you to do, and what anyone setting
 * this up for the first time does — and the dialog appears in a tab you are
 * not looking at. Six minutes later the run dies with "Exceeded maximum
 * execution time", after every bit of the work has already been done
 * successfully. It reads as a failed setup and is not one. That happened on
 * the first live setup, 4 November 2026.
 *
 * So the summary always goes to the execution log, which is where the editor
 * already has you looking, and the dialog is only shown from the menu, where
 * somebody is looking at the sheet and will click it. */
function claimsSetupSay_(summary) {
  Logger.log(summary);
  if (claimsFromMenu_) {
    try { SpreadsheetApp.getUi().alert(summary); } catch (err) { /* no UI; the log has it */ }
  }
  return summary;
}
var claimsFromMenu_ = false;

/** The menu's "Set up / repair everything" — same work, and it does show the box. */
function setupClaimsFromMenu() {
  claimsFromMenu_ = true;
  try { return setupClaims(); } finally { claimsFromMenu_ = false; }
}

function setupClaims() {
  filesSheet_(); logSheet_(); registerSheet_(); policyRegisterSheet_();
  claimSurveysSheet_();
  var root = rootFolder_();

  /* Staff tab: make sure every branch address can sign in, on EVERY run —
     "Set up / repair everything" has to repair. Until 5 November 2026 this
     seeded one address and only into an empty tab, so the Google account
     that owns the script was not on the list: the staff sign-in answered the
     branch manager with "a code is on its way" and sent nothing at all.
     An address already on the tab is left exactly as it is, Active = N
     included — somebody may have turned it off on purpose. */
  var staff = staffSheet_();
  var staffHave = {};
  if (staff.getLastRow() > 1) {
    staff.getRange(2, 1, staff.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var a = String(r[0] || '').trim().toLowerCase();
      if (a) staffHave[a] = true;
    });
  }
  var staffSeed = [];
  CLAIMS.MAIL_CC.forEach(function (a, i) {
    staffSeed.push([a, i === 0 ? CLAIMS.AGENT_NAME : 'Branch inbox', i === 0 ? 'Admin' : 'Staff']);
  });
  try { staffSeed.push([Session.getEffectiveUser().getEmail(), CLAIMS.AGENT_NAME, 'Admin']); } catch (e) {}
  var staffAdded = [];
  staffSeed.forEach(function (row) {
    var key = String(row[0] || '').trim().toLowerCase();
    if (!key || key.indexOf('@') < 0 || staffHave[key]) return;
    staffHave[key] = true;
    staff.appendRow([String(row[0]).trim(), row[1], row[2], 'Y']);
    staffAdded.push(String(row[0]).trim());
  });

  // Status column gets a dropdown so the desk cannot invent new statuses.
  var sh = claimsSheet_();
  var map = headerMap_(sh);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(CLAIMS.STATUSES, true).build();
  sh.getRange(2, map['status'] + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  sh.setColumnWidth(map['description'] + 1, 380);

  ['sweepAbandonedParts', 'claimsFollowUp'].forEach(function (fn) {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
    });
  });
  ScriptApp.newTrigger('sweepAbandonedParts').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('claimsFollowUp').timeBased().everyDays(1).atHour(9).create();

  var vehicles = Math.max(registerSheet_().getLastRow() - 1, 0);
  return claimsSetupSay_(
    'Claims TT is ready.\n\n' +
    'Tabs: ' + CLAIMS.CLAIMS_SHEET + ', ' + CLAIMS.FILES_SHEET + ', ' +
      CLAIMS.LOG_SHEET + ', ' + CLAIMS.REGISTER_SHEET + ', ' +
      CLAIMS.POLICY_REGISTER_SHEET + ', ' + CLAIMS.STAFF_SHEET + '\n' +
    'Staff sign-in: ' + (staffAdded.length
      ? 'added ' + staffAdded.join(', ') + ' to the ' + CLAIMS.STAFF_SHEET + ' tab'
      : 'every branch address is already on the ' + CLAIMS.STAFF_SHEET + ' tab') +
      '. Add anyone else there (Active=Y); they sign in at /claims/staff.html ' +
      'with a code emailed to them — in test mode a staff code still reaches ' +
      'them, so the sign-in can be tested\n' +
    'Drive folder: ' + root.getUrl() + '\n' +
    'Automatic follow-up: installed, runs daily ~9am (incl. the ' +
      CLAIMS.REVIEW_WORKING_DAYS + '-working-day review)\n' +
    'Client feedback: ' + (CLAIMS.SURVEY_URL
      ? 'on — every closed claim is asked for a rating'
      : 'OFF until CLAIMS.SURVEY_URL holds this web app\'s /exec URL') + '\n' +
    'Vehicle register: ' + vehicles + ' vehicle(s)' +
      (vehicles ? '' : ' — import vehicle-register.csv to switch on motor prefill') + '\n' +
    'Policy register: ' + (Math.max(policyRegisterSheet_().getLastRow() - 1, 0)) + ' policy(ies)' +
      ' — import policy-register.csv for health/life prefill\n\n' +
    'Next: Deploy → New deployment → Web app (execute as Me, access Anyone), ' +
    'then paste the /exec URL into CONFIG.API_URL in claims/index.html.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Claims TT')
    .addItem('1. Set up / repair everything', 'setupClaimsFromMenu')
    .addSeparator()
    .addItem('Open the claims Drive folder', 'openClaimsFolder')
    .addItem('Email the client their new status', 'notifyStatusChange')
    .addItem('Chase outstanding documents now', 'chaseMissingDocuments')
    .addSeparator()
    .addItem('⭐ Preview the feedback request (selected row)', 'previewClaimSurvey')
    .addItem('⭐ Send feedback requests now', 'sendClaimSurveysNow')
    .addSeparator()
    .addItem('☁️ Connect Salesforce (one-time)', 'connectSalesforce')
    .addItem('Sync registers from Salesforce now', 'syncSalesforceNow')
    .addItem('Sync vehicles only (fast)', 'syncVehiclesNow')
    .addSeparator()
    .addItem('🧪 Turn test mode ON (emails only reach you)', 'testModeOn_')
    .addItem('Turn test mode OFF (live emails)', 'testModeOff_')
    .addSeparator()
    .addItem('Run the follow-up sweep now (test)', 'runFollowUpNow')
    .addItem('Clean up abandoned uploads', 'cleanupNow')
    .addToUi();
}

function openClaimsFolder() {
  SpreadsheetApp.getUi().alert('Claims documents live here:\n\n' + rootFolder_().getUrl());
}

function cleanupNow() {
  SpreadsheetApp.getUi().alert('Removed ' + sweepAbandonedParts() + ' abandoned upload part(s).');
}
