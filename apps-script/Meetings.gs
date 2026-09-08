/**
 * ============================================================
 *  BRANCH MEETING BUILDER — backend
 *  Ricky Rampersad Branch (TV Branch)
 * ============================================================
 *
 *  This replaces the separate attendance register. Nobody
 *  signs a sheet and nobody fills a form: you open the meeting
 *  and press "I'm here", and that IS the register. The record
 *  is the login — time-stamped, one row per person, no second
 *  place to look.
 *
 *  WHAT LIVES HERE
 *   People      — who may sign in, and what they are allowed
 *                 to see. Roles are assigned by the branch,
 *                 never chosen by the person signing up.
 *   Meetings    — the meeting itself: date, format, chair, the
 *                 check-in window, status.
 *   Agenda      — the running order. Every item names its
 *                 presenter and carries a visibility setting.
 *   Uploads     — what each presenter is presenting. Files go
 *                 to a private Drive folder; the bytes are
 *                 served back only after a permission check.
 *   Attendance  — Present / Late / Excused / Absent, plus the
 *                 people with NO ENTRY at all, which the April
 *                 Q1 minutes treat as a compliance observation
 *                 in its own right.
 *   Actions     — the action item tracker, with carry-forward.
 *   Minutes     — the written record, section by section.
 *   Log         — an audit trail of everything that happened.
 *
 *  WHO SEES WHAT
 *   manager  Everything. Builds meetings, publishes minutes,
 *            adds people, sees the full register.
 *   staff    Everything except people administration.
 *   agent    Signs in, gets counted present, and sees only the
 *            agenda items, materials and minute sections that
 *            were marked "Everyone". Staff-only material —
 *            persistency red zones, licensing, clawback, unit
 *            performance, the register itself — is filtered
 *            out on the server, so it never reaches an agent's
 *            browser at all.
 *
 *  SETUP (about ten minutes, once):
 *   1. Make a new Google Sheet — call it "Branch Meetings".
 *      Extensions -> Apps Script.
 *   2. Paste this file in, save.
 *   3. Set ADMIN_EMAIL and JOIN_CODE below, then run
 *      setupMeetings() once and grant the permissions it asks
 *      for. It builds every tab, creates the Drive folder for
 *      materials, and puts you on the People tab as manager.
 *   4. Deploy -> New deployment -> Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Copy the /exec URL.
 *   5. Paste that URL into CONFIG.API_URL in meetings/index.html.
 *   6. Add your people on the People tab (or from the app's
 *      People screen). Everyone signs in with their email and
 *      picks their own PIN the first time.
 *
 *  NOTHING IN THIS FILE HOLDS BRANCH DATA. It is the program
 *  only. The data lives in the Sheet and in the Drive folder,
 *  both private to the account that owns the script.
 * ============================================================
 */

var MEET = {
  /* The branch manager. Seeded onto the People tab as manager
     by setupMeetings() so there is always one way in. */
  ADMIN_EMAIL: 'ricky.rampersad@myguardiangroup.com',
  ADMIN_NAME:  'Ricky Rampersad',

  BRANCH: 'Ricky Rampersad Branch',
  BRANCH_SHORT: 'TV Branch',

  /* Typed once, when someone sets their PIN for the first time. It
     stops a stranger who guesses a branch email address from claiming
     an account before its owner does — it is not the sign-in
     credential, and it is useless on its own, because the email must
     already be on the People tab.

     Set it ONLY in your Apps Script copy, never in this repository:
     this file sits in a public repo, so any value committed here is
     public. Change it again once everyone has enrolled. */
  JOIN_CODE: 'CHANGE-ME-in-Apps-Script-only',

  /* Each person picks their own PIN to sign in. */
  PIN_MIN: 4,
  PIN_MAX: 8,

  /* Wrong PIN this many times in a row and the account is held
     shut for a while, so nobody can sit and guess four digits. */
  MAX_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,

  /* A sign-in this many minutes after the start time is recorded
     as Late rather than Present. Per-meeting override lives on
     the Meetings tab. */
  LATE_AFTER_MINUTES: 10,

  /* Check-in opens this long before the start time by default. */
  CHECKIN_OPENS_BEFORE: 30,
  /* ...and closes this long after it, so nobody marks themselves
     present for a meeting that finished an hour ago. */
  CHECKIN_CLOSES_AFTER: 90,

  /* Biggest file a presenter may upload. Apps Script has to hold
     the whole thing in memory as base64, so this is deliberately
     modest — anything larger goes in as a link instead. */
  MAX_UPLOAD_MB: 12,

  /* Drive folder holding every presenter's materials. Created by
     setupMeetings() and remembered in Script Properties. */
  FOLDER_PROP: 'MEETINGS_FOLDER_ID',

  TAB_PEOPLE:     'People',
  TAB_MEETINGS:   'Meetings',
  TAB_AGENDA:     'Agenda',
  TAB_UPLOADS:    'Uploads',
  TAB_ATTENDANCE: 'Attendance',
  TAB_ACTIONS:    'Actions',
  TAB_MINUTES:    'Minutes',
  TAB_ARCHIVE:    'Archive',
  TAB_SESSIONS:   'Sessions',
  TAB_CONTRIB:    'Contributions',
  TAB_TOPICS:     'Topics',
  TAB_LOG:        'Log',

  /* An audio clip recorded in the app. Apps Script has to hold the whole
     thing in memory as base64, so this is deliberately short: it is for a
     contribution, a decision or a segment — not the whole meeting. The
     full recording is the one Teams already makes; attach its link to the
     session instead. */
  MAX_CLIP_MINUTES: 15,

  /* A sheet cell holds 50,000 characters. A long set of minutes runs past
     that, so a document's text is split across numbered chunk rows and
     stitched back together on the way out. */
  CHUNK_CHARS: 45000,

  /* Indexing converts each document through Drive, which is slow enough
     that a big folder would run past the six-minute execution limit. Each
     run stops after this many and reports what is left; running it again
     picks up where it stopped. */
  INDEX_BATCH: 15
};

/* The sections a branch meeting runs through. Taken from the
   branch's own minutes so the app builds the document the branch
   already writes, rather than a generic agenda. */
var SECTIONS = [
  'Opening & Mission Statement',
  'Correspondence & Administrative Reminders',
  'Reports Reviewed',
  'Performance & Community Management',
  'Digital Innovation Updates',
  'Training & Development',
  'Other Items',
  'Closing'
];

/* The kinds of meeting the branch actually holds. */
var MEETING_TYPES = ['Branch Meeting', 'Staff Meeting', 'Managers Meeting',
                     'One-on-One', 'Quarterly Review', 'Resolution Meeting',
                     'Training Session', 'Client Meeting'];

/*  Who a meeting is FOR, which is a different question from what is on its
 *  agenda. Visibility controls a single item; scope controls whether the
 *  meeting exists at all for a given person.
 *
 *    branch      Everyone. The weekly branch meeting.
 *    staff       Staff and the manager. Agents never see it — not the
 *                meeting, not the register, not that it happened.
 *    one-to-one  The two people in the room, plus the branch manager. A
 *                manager reviewing an agent's persistency is not branch
 *                business.
 *    client      The agent whose client it is, plus the branch manager.
 *                These carry client detail, and the branch's standing rule
 *                is that client information travels no further than it has
 *                to.
 */
var MEETING_SCOPES = ['branch', 'staff', 'one-to-one', 'client'];

function cleanScope_(v) {
  v = low_(v);
  return MEETING_SCOPES.indexOf(v) === -1 ? 'branch' : v;
}

/* What a person may log during a meeting. */
var CONTRIB_KINDS = ['Point', 'Question', 'Answer', 'Decision', 'Concern', 'Commitment', 'Apology'];

/* Action item statuses, in the branch's own wording. */
var ACTION_STATUSES = ['Not Started', 'Open', 'In Progress', 'Overdue', 'Standing', 'Complete'];

var SCHEMA = {
  People: ['Email', 'Name', 'Role', 'Unit', 'Active', 'PIN Hash', 'Salt', 'Token',
           'Attempts', 'Locked Until', 'Added', 'Added By', 'Last Seen'],

  Meetings: ['ID', 'Ref', 'Type', 'Title', 'Subtitle', 'Week', 'Date', 'Start', 'End', 'Format',
             'Location', 'Chair', 'Guest', 'Status', 'Check-In Opens', 'Check-In Closes',
             'Late After (min)', 'Materials Due', 'Pre-Read', 'Anchor Document', 'Mission Statement',
             'Purpose', 'Minutes Status', 'Archive Link', 'Scope', 'Participants',
             'Client Ref', 'Topics', 'Created By', 'Created', 'Updated'],

  Agenda: ['ID', 'Meeting ID', 'Order', 'Section', 'Title', 'Detail', 'Presenter Email',
           'Presenter Name', 'Allotted (min)', 'Visibility', 'Materials Required', 'Ready',
           'Ready At', 'Reviewed By', 'Topics', 'Status', 'Created By', 'Created'],

  Uploads: ['ID', 'Meeting ID', 'Agenda ID', 'Owner Email', 'Owner Name', 'Kind', 'File Name',
            'File ID', 'Link', 'Mime', 'Size', 'Visibility', 'Summary', 'Reviewed By',
            'Reviewed At', 'Uploaded'],

  Attendance: ['ID', 'Meeting ID', 'Email', 'Name', 'Role', 'Unit', 'Status', 'Method',
               'Signed In', 'Minutes Late', 'Reason', 'Recorded By', 'Device'],

  Actions: ['ID', 'Meeting ID', 'Item', 'Owner', 'Initiated By', 'Due', 'Status', 'Priority',
            'Notes', 'Origin Meeting', 'Created', 'Created By', 'Updated', 'Completed'],

  Minutes: ['ID', 'Meeting ID', 'Order', 'Section', 'Body', 'Visibility', 'Author', 'Updated'],

  Archive: ['ID', 'Meeting ID', 'Title', 'Date', 'Year', 'Type', 'Source File ID',
            'Drive Link', 'Visibility', 'Chunk', 'Text', 'Words', 'Indexed By', 'Indexed At'],

  Sessions: ['ID', 'Meeting ID', 'Started', 'Started By', 'Ended', 'Ended By',
             'Minutes Run', 'Allotted', 'Notice Given', 'Recording Link',
             'Transcript Link', 'Recording Note', 'Current Agenda ID', 'Item Started'],

  Contributions: ['ID', 'Meeting ID', 'Agenda ID', 'When', 'Offset (min)', 'Email', 'Name',
                  'Role', 'Kind', 'Body', 'Topics', 'Visibility', 'Clip Upload ID', 'Edited'],

  Topics: ['ID', 'Name', 'Category', 'Description', 'Active', 'Created By', 'Created'],

  Log: ['Timestamp', 'Actor', 'Role', 'Action', 'Target', 'Details']
};

/* ======================== setup ======================== */

/** Run this once, by hand, from the Apps Script editor. */
function setupMeetings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SCHEMA).forEach(function (name) {
    ensureTab_(ss, name, SCHEMA[name]);
  });

  materialsFolder_();          // creates the Drive folder on first call
  topicsSheetSeeded_();        // the branch's recurring subjects, ready to tag

  // Seed the branch manager so there is always one way in.
  var people = readPeople_();
  var admin = String(MEET.ADMIN_EMAIL || '').trim().toLowerCase();
  if (admin && !people.some(function (p) { return p.email === admin; })) {
    tab_(MEET.TAB_PEOPLE).appendRow([admin, MEET.ADMIN_NAME, 'manager', 'Branch', 'Y',
      '', '', '', 0, '', new Date(), 'setup', '']);
  }

  log_('setup', 'system', '', 'Meeting Builder set up', 'Tabs, Drive folder and manager seeded');

  // Deliberately no dialog here. SpreadsheetApp.getUi().alert() draws in the
  // SHEET's window, so running this from the Apps Script editor — which is
  // how it is meant to be run — leaves it waiting for a click on a dialog
  // nobody is looking at, until the six-minute limit kills it. The work is
  // long finished by then; the timeout only looks like a failure. The
  // summary goes to the execution log instead, which is on screen already.
  var summary = 'Branch Meeting Builder is ready.\n' +
    'Tabs: ' + Object.keys(SCHEMA).join(', ') + '\n' +
    'Materials folder: ' + materialsFolder_().getName() + '\n' +
    'Topics seeded: ' + topicList_().length + '\n\n' +
    'Next: Deploy > New deployment > Web app (Execute as: Me, Access: Anyone), ' +
    'then paste the /exec URL into CONFIG.API_URL in managementmeetings/index.html.';
  Logger.log(summary);
  return summary;
}

/** The menu version, which may safely show a dialog because the person
 *  clicking the menu is by definition looking at the sheet. */
function setupMeetingsFromMenu() {
  var summary = setupMeetings();
  SpreadsheetApp.getUi().alert(summary);
}

function ensureTab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0d2137').setFontColor('#efc24b');
    sh.setFrozenRows(1);
    return sh;
  }
  // Tab exists — add any column this version of the script expects
  // but the sheet has not got yet, so an upgrade never loses data.
  var have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  headers.forEach(function (h) {
    if (have.indexOf(h) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h)
        .setFontWeight('bold').setBackground('#0d2137').setFontColor('#efc24b');
    }
  });
  return sh;
}

function tab_(name) {
  return ensureTab_(SpreadsheetApp.getActiveSpreadsheet(), name, SCHEMA[name]);
}

/** Column letter -> index map, so added columns never shift the code. */
function cols_(name) {
  var sh = tab_(name);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  head.forEach(function (h, i) { map[String(h).trim()] = i; });
  return map;
}

/** Every data row of a tab as an object keyed by header name. */
function readTab_(name) {
  var sh = tab_(name);
  if (sh.getLastRow() < 2) return [];
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    .map(function (r, i) {
      var o = { _row: i + 2 };
      head.forEach(function (h, c) { if (h) o[h] = r[c]; });
      return o;
    });
}

/** Write one field of one row without touching the rest. */
function setCell_(name, rowIndex, header, value) {
  var map = cols_(name);
  if (!(header in map)) return;
  tab_(name).getRange(rowIndex, map[header] + 1).setValue(value);
}

/** Append an object, placing each value under its own header. */
function appendRow_(name, obj) {
  var sh = tab_(name);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  sh.appendRow(head.map(function (h) { return (h in obj) ? obj[h] : ''; }));
}

/** Append many rows in one write. Reads the headers once and lands the lot
 *  in a single setValues, instead of a round trip per row. */
function appendRows_(name, objs) {
  if (!objs || !objs.length) return 0;
  var sh = tab_(name);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var rows = objs.map(function (o) {
    return head.map(function (h) { return (h in o) ? o[h] : ''; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, head.length).setValues(rows);
  return rows.length;
}

/** The private Drive folder holding presenters' materials. */
function materialsFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(MEET.FOLDER_PROP);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* deleted — remake below */ }
  }
  var folder = DriveApp.createFolder('Branch Meeting Materials — ' + MEET.BRANCH);
  props.setProperty(MEET.FOLDER_PROP, folder.getId());
  return folder;
}

/* ======================== small helpers ======================== */

function uid_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
}

function makeToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function hashPin_(pin, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + ':' + String(pin));
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function str_(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function low_(v) { return str_(v).toLowerCase(); }
function num_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function yes_(v) { return str_(v).toUpperCase() !== 'N' && str_(v) !== 'false'; }

function tz_() { return Session.getScriptTimeZone() || 'America/Port_of_Spain'; }
function iso_(d) { return d instanceof Date ? d.toISOString() : ''; }

/** A Date from a sheet cell that may hold a Date, a string, or nothing. */
function asDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Combine the meeting's Date cell with an "HH:mm" time into one Date. */
function atTime_(dateVal, timeVal) {
  var d = asDate_(dateVal);
  if (!d) return null;
  var t = str_(timeVal);
  var out = new Date(d.getTime());
  var m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    out.setHours(Number(m[1]), Number(m[2]), 0, 0);
  } else if (timeVal instanceof Date) {
    out.setHours(timeVal.getHours(), timeVal.getMinutes(), 0, 0);
  } else {
    out.setHours(0, 0, 0, 0);
  }
  return out;
}

function fmtDate_(v) {
  var d = asDate_(v);
  return d ? Utilities.formatDate(d, tz_(), 'd MMM yyyy') : str_(v);
}
function fmtStamp_(v) {
  var d = asDate_(v);
  return d ? Utilities.formatDate(d, tz_(), 'd MMM yyyy, h:mm a') : str_(v);
}
function fmtTime_(v) {
  var d = asDate_(v);
  return d ? Utilities.formatDate(d, tz_(), 'h:mm a') : str_(v);
}

function log_(action, actor, role, target, details) {
  try {
    appendRow_(MEET.TAB_LOG, {
      'Timestamp': new Date(), 'Actor': actor, 'Role': role,
      'Action': action, 'Target': target, 'Details': details
    });
  } catch (err) { /* logging must never break the request */ }
}

/* ======================== people & sign-in ======================== */
/*
 *  Roles are assigned by the branch on the People tab. Nobody
 *  picks their own role when they enrol — an agent cannot make
 *  themselves staff and read the persistency report. Enrolling
 *  only sets a PIN against an email the branch has already
 *  listed.
 */

function readPeople_() {
  return readTab_(MEET.TAB_PEOPLE).map(function (r) {
    return {
      _row: r._row,
      email: low_(r['Email']),
      name: str_(r['Name']) || str_(r['Email']),
      role: low_(r['Role']) || 'agent',
      unit: str_(r['Unit']),
      active: yes_(r['Active']),
      hash: str_(r['PIN Hash']),
      salt: str_(r['Salt']),
      token: str_(r['Token']),
      attempts: num_(r['Attempts']),
      lockedUntil: asDate_(r['Locked Until']),
      lastSeen: asDate_(r['Last Seen'])
    };
  }).filter(function (p) { return p.email.indexOf('@') > 0; });
}

function findPersonByEmail_(email) {
  email = low_(email);
  return readPeople_().filter(function (p) { return p.email === email; })[0] || null;
}

function findPersonByToken_(token) {
  token = str_(token);
  if (!token) return null;
  return readPeople_().filter(function (p) { return p.token && p.token === token; })[0] || null;
}

/** Everyone who should be at a branch meeting — the denominator
 *  the register is measured against. */
function roster_() {
  return readPeople_().filter(function (p) { return p.active; });
}

/** Resolve a token to a signed-in person, or throw. */
function requireUser_(token) {
  var p = findPersonByToken_(token);
  if (!p) throw new Error('Your session has ended — please sign in again.');
  if (!p.active) throw new Error('Your access has been turned off. Speak to the branch manager.');
  setCell_(MEET.TAB_PEOPLE, p._row, 'Last Seen', new Date());
  return p;
}

function requireStaff_(token) {
  var p = requireUser_(token);
  if (p.role !== 'staff' && p.role !== 'manager') {
    throw new Error('That is staff-only.');
  }
  return p;
}

function requireManager_(token) {
  var p = requireUser_(token);
  if (p.role !== 'manager') throw new Error('That is the branch manager only.');
  return p;
}

function isStaff_(p) { return p && (p.role === 'staff' || p.role === 'manager'); }

/** What a person is allowed to see. Everything in the app runs
 *  through this one test, so there is a single place to be right.
 *
 *    all     Everyone in the room, agents included.
 *    staff   Staff and the manager. This is where the persistency
 *            red zones, licensing, clawback and unit performance
 *            live — the things the branch discusses about agents
 *            rather than with them.
 *    chair   The chair alone. The W18 agenda's "Branch Manager's
 *            Talking Points — not for distribution" and anything
 *            marked BM EYES ONLY. Staff do not see these either.
 */
function canSee_(person, visibility, meeting) {
  var v = low_(visibility) || 'all';
  if (v === 'all' || v === 'everyone') return true;
  if (v === 'chair' || v === 'private' || v === 'bm') {
    if (!person) return false;
    if (person.role === 'manager') return true;
    return !!(meeting && low_(meeting['Chair']) === person.email);
  }
  return isStaff_(person);
}

/** Whether a meeting exists at all for this person.
 *
 *  canSee_ decides whether one agenda item, upload or minute section is
 *  shown. This decides whether the whole meeting is. A staff meeting is not
 *  a branch meeting with some items hidden — an agent should not know it
 *  happened, who was at it, or that they were not.
 */
function canOpenMeeting_(person, m) {
  if (!person || !m) return false;
  if (person.role === 'manager') return true;

  var status = low_(m['Status']) || 'draft';
  if ((status === 'draft' || status === 'cancelled') && !isStaff_(person)) return false;

  switch (cleanScope_(m['Scope'])) {
    case 'staff':
      return isStaff_(person);
    case 'one-to-one':
    case 'client':
      // Only the people actually in the room. The branch manager is
      // already through, above.
      return low_(m['Chair']) === person.email || isParticipant_(m, person);
    default:
      return true;
  }
}

/** The Participants cell is a comma-separated list of emails. */
function isParticipant_(m, person) {
  return str_(m['Participants']).toLowerCase()
    .split(/[,;]/).map(function (x) { return x.trim(); })
    .indexOf(person.email) > -1;
}

var VISIBILITIES = ['all', 'staff', 'chair'];

function cleanVisibility_(v) {
  v = low_(v);
  return VISIBILITIES.indexOf(v) === -1 ? 'all' : v;
}

function publicUser_(p) {
  return { email: p.email, name: p.name, role: p.role, unit: p.unit, staff: isStaff_(p) };
}

/** First time in: prove you are on the People tab, know the join
 *  code, and choose a PIN. */
function apiEnrol_(body) {
  var email = low_(body.email);
  var pin = str_(body.pin);
  var join = str_(body.joinCode).toUpperCase();

  if (email.indexOf('@') < 1) return { ok: false, error: 'Enter your work email address.' };
  if (join !== String(MEET.JOIN_CODE).toUpperCase()) {
    return { ok: false, error: 'That branch code is not right. Ask the branch manager for it.' };
  }
  var bad = checkPin_(pin);
  if (bad) return { ok: false, error: bad };

  var p = findPersonByEmail_(email);
  if (!p) {
    return { ok: false, error: 'That email is not on the branch list yet. Ask the branch manager to add you.' };
  }
  if (!p.active) return { ok: false, error: 'Your access has been turned off. Speak to the branch manager.' };
  if (p.hash) {
    return { ok: false, error: 'You already have a PIN. Sign in with it, or ask the branch manager to reset it.' };
  }

  var salt = Utilities.getUuid();
  var token = makeToken_();
  setCell_(MEET.TAB_PEOPLE, p._row, 'Salt', salt);
  setCell_(MEET.TAB_PEOPLE, p._row, 'PIN Hash', hashPin_(pin, salt));
  setCell_(MEET.TAB_PEOPLE, p._row, 'Token', token);
  setCell_(MEET.TAB_PEOPLE, p._row, 'Attempts', 0);
  setCell_(MEET.TAB_PEOPLE, p._row, 'Locked Until', '');
  setCell_(MEET.TAB_PEOPLE, p._row, 'Last Seen', new Date());

  log_('enrol', p.name, p.role, p.email, 'Set a PIN for the first time');
  return { ok: true, token: token, user: publicUser_(p) };
}

function apiLogin_(body) {
  var email = low_(body.email);
  var pin = str_(body.pin);

  var p = findPersonByEmail_(email);
  // Same wording whether the email is unknown or the PIN is wrong,
  // so the sign-in box cannot be used to discover who is on staff.
  var generic = { ok: false, error: 'That email and PIN do not match.' };
  if (!p) return generic;
  if (!p.active) return { ok: false, error: 'Your access has been turned off. Speak to the branch manager.' };
  if (!p.hash) return { ok: false, error: 'needs-enrol', needsEnrol: true };

  if (p.lockedUntil && p.lockedUntil.getTime() > Date.now()) {
    var mins = Math.ceil((p.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: 'Too many wrong tries. Try again in ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.' };
  }

  if (hashPin_(pin, p.salt) !== p.hash) {
    var attempts = p.attempts + 1;
    setCell_(MEET.TAB_PEOPLE, p._row, 'Attempts', attempts);
    if (attempts >= MEET.MAX_ATTEMPTS) {
      setCell_(MEET.TAB_PEOPLE, p._row, 'Locked Until', new Date(Date.now() + MEET.LOCKOUT_MINUTES * 60000));
      setCell_(MEET.TAB_PEOPLE, p._row, 'Attempts', 0);
      log_('lockout', p.name, p.role, p.email, 'Locked for ' + MEET.LOCKOUT_MINUTES + ' minutes');
      return { ok: false, error: 'Too many wrong tries. Locked for ' + MEET.LOCKOUT_MINUTES + ' minutes.' };
    }
    return generic;
  }

  var token = p.token || makeToken_();
  setCell_(MEET.TAB_PEOPLE, p._row, 'Token', token);
  setCell_(MEET.TAB_PEOPLE, p._row, 'Attempts', 0);
  setCell_(MEET.TAB_PEOPLE, p._row, 'Locked Until', '');
  setCell_(MEET.TAB_PEOPLE, p._row, 'Last Seen', new Date());

  log_('login', p.name, p.role, p.email, 'Signed in');
  return { ok: true, token: token, user: publicUser_(p) };
}

function checkPin_(pin) {
  pin = str_(pin);
  if (!/^\d+$/.test(pin)) return 'Your PIN must be numbers only.';
  if (pin.length < MEET.PIN_MIN || pin.length > MEET.PIN_MAX) {
    return 'Your PIN must be between ' + MEET.PIN_MIN + ' and ' + MEET.PIN_MAX + ' digits.';
  }
  return '';
}

function apiChangePin_(body) {
  var p = requireUser_(body.token);
  if (hashPin_(str_(body.oldPin), p.salt) !== p.hash) {
    return { ok: false, error: 'Your current PIN is not right.' };
  }
  var bad = checkPin_(body.newPin);
  if (bad) return { ok: false, error: bad };
  var salt = Utilities.getUuid();
  setCell_(MEET.TAB_PEOPLE, p._row, 'Salt', salt);
  setCell_(MEET.TAB_PEOPLE, p._row, 'PIN Hash', hashPin_(str_(body.newPin), salt));
  log_('change-pin', p.name, p.role, p.email, 'Changed their PIN');
  return { ok: true };
}

/** Manager clears a forgotten PIN so the person can enrol again. */
function apiResetPin_(body) {
  var me = requireManager_(body.token);
  var target = findPersonByEmail_(body.email);
  if (!target) return { ok: false, error: 'That person is not on the branch list.' };
  setCell_(MEET.TAB_PEOPLE, target._row, 'PIN Hash', '');
  setCell_(MEET.TAB_PEOPLE, target._row, 'Salt', '');
  setCell_(MEET.TAB_PEOPLE, target._row, 'Token', '');
  setCell_(MEET.TAB_PEOPLE, target._row, 'Attempts', 0);
  setCell_(MEET.TAB_PEOPLE, target._row, 'Locked Until', '');
  log_('reset-pin', me.name, me.role, target.email, 'PIN cleared — may enrol again');
  return { ok: true };
}

function apiSignOut_(body) {
  var p = findPersonByToken_(body.token);
  if (p) {
    setCell_(MEET.TAB_PEOPLE, p._row, 'Token', '');
    log_('logout', p.name, p.role, p.email, 'Signed out');
  }
  return { ok: true };
}

/* ---- people administration (manager only) ---- */

function apiPeople_(token) {
  var me = requireStaff_(token);
  return {
    ok: true,
    canEdit: me.role === 'manager',
    people: readPeople_().map(function (p) {
      return {
        email: p.email, name: p.name, role: p.role, unit: p.unit, active: p.active,
        enrolled: !!p.hash,
        locked: !!(p.lockedUntil && p.lockedUntil.getTime() > Date.now()),
        lastSeen: p.lastSeen ? fmtStamp_(p.lastSeen) : ''
      };
    })
  };
}

function apiSavePerson_(body) {
  var me = requireManager_(body.token);
  var email = low_(body.email);
  if (email.indexOf('@') < 1) return { ok: false, error: 'Enter a valid email address.' };
  var role = low_(body.role);
  if (['manager', 'staff', 'agent'].indexOf(role) === -1) role = 'agent';

  var existing = findPersonByEmail_(email);
  if (existing) {
    setCell_(MEET.TAB_PEOPLE, existing._row, 'Name', str_(body.name) || existing.name);
    setCell_(MEET.TAB_PEOPLE, existing._row, 'Role', role);
    setCell_(MEET.TAB_PEOPLE, existing._row, 'Unit', str_(body.unit));
    setCell_(MEET.TAB_PEOPLE, existing._row, 'Active', body.active === false ? 'N' : 'Y');
    log_('edit-person', me.name, me.role, email, 'Role ' + role + ', unit ' + str_(body.unit));
  } else {
    appendRow_(MEET.TAB_PEOPLE, {
      'Email': email, 'Name': str_(body.name) || email, 'Role': role, 'Unit': str_(body.unit),
      'Active': body.active === false ? 'N' : 'Y', 'Attempts': 0,
      'Added': new Date(), 'Added By': me.email
    });
    log_('add-person', me.name, me.role, email, 'Added as ' + role);
  }
  return { ok: true };
}

/* ======================== meetings ======================== */

function meetingRows_() { return readTab_(MEET.TAB_MEETINGS); }

function findMeeting_(id) {
  id = str_(id);
  return meetingRows_().filter(function (m) { return str_(m['ID']) === id; })[0] || null;
}

/** When check-in opens and closes for a meeting. Explicit values on
 *  the row win; otherwise it is a window around the start time. */
function checkinWindow_(m) {
  var start = atTime_(m['Date'], m['Start']);
  if (!start) return { open: null, close: null, start: null };
  var open = asDate_(m['Check-In Opens']) ||
    new Date(start.getTime() - MEET.CHECKIN_OPENS_BEFORE * 60000);
  var close = asDate_(m['Check-In Closes']) ||
    new Date(start.getTime() + MEET.CHECKIN_CLOSES_AFTER * 60000);
  return { open: open, close: close, start: start };
}

/** Present or Late, decided by the clock rather than by anyone's
 *  opinion. Late is recorded with the number of minutes, because the
 *  branch's minutes record lateness with a reason and an ETA. */
function statusForNow_(m, when) {
  var w = checkinWindow_(m);
  if (!w.start) return { status: 'present', late: 0 };
  var grace = num_(m['Late After (min)']) || MEET.LATE_AFTER_MINUTES;
  var lateBy = Math.round((when.getTime() - w.start.getTime()) / 60000);
  if (lateBy > grace) return { status: 'late', late: lateBy };
  return { status: 'present', late: 0 };
}

function meetingCard_(m, person, myAttendance) {
  var w = checkinWindow_(m);
  var now = Date.now();
  return {
    id: str_(m['ID']),
    ref: str_(m['Ref']),
    type: str_(m['Type']) || 'Branch Meeting',
    title: str_(m['Title']),
    subtitle: str_(m['Subtitle']),
    week: str_(m['Week']),
    date: fmtDate_(m['Date']),
    dateISO: iso_(asDate_(m['Date'])),
    start: str_(m['Start']),
    end: str_(m['End']),
    format: str_(m['Format']) || 'In-person',
    location: str_(m['Location']),
    chair: str_(m['Chair']),
    guest: str_(m['Guest']),
    status: low_(m['Status']) || 'draft',
    scope: cleanScope_(m['Scope']),
    participants: isStaff_(person) ? str_(m['Participants']) : '',
    clientRef: isStaff_(person) ? str_(m['Client Ref']) : '',
    topics: str_(m['Topics']),
    minutesStatus: low_(m['Minutes Status']) || 'none',
    // Sent back so the builder re-opens on the grace period this
    // meeting actually uses, rather than resetting it to the default.
    lateAfter: num_(m['Late After (min)']) || MEET.LATE_AFTER_MINUTES,
    materialsDue: fmtStamp_(m['Materials Due']),
    preRead: str_(m['Pre-Read']),
    anchor: str_(m['Anchor Document']),
    archiveLink: str_(m['Archive Link']),
    checkInOpen: !!(w.open && w.close && now >= w.open.getTime() && now <= w.close.getTime()),
    checkInOpensAt: w.open ? fmtStamp_(w.open) : '',
    checkInClosesAt: w.close ? fmtStamp_(w.close) : '',
    startsAt: w.start ? fmtStamp_(w.start) : '',
    past: !!(w.close && now > w.close.getTime()),
    me: myAttendance || null
  };
}

/** Meetings a person may open. Drafts are staff-only: an agent never
 *  sees a meeting that is still being built. */
function apiMeetings_(token) {
  var me = requireUser_(token);
  var att = readTab_(MEET.TAB_ATTENDANCE);
  var mine = {};
  att.forEach(function (a) {
    if (low_(a['Email']) === me.email) {
      mine[str_(a['Meeting ID'])] = {
        status: low_(a['Status']),
        signedIn: fmtStamp_(a['Signed In']),
        late: num_(a['Minutes Late']),
        reason: str_(a['Reason'])
      };
    }
  });

  var rows = meetingRows_().filter(function (m) { return canOpenMeeting_(me, m); });

  rows.sort(function (a, b) {
    var da = asDate_(a['Date']), db = asDate_(b['Date']);
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  });

  return {
    ok: true,
    user: publicUser_(me),
    meetings: rows.map(function (m) { return meetingCard_(m, me, mine[str_(m['ID'])]); })
  };
}

/** One meeting in full — agenda, materials, actions, minutes — with
 *  everything the person may not see removed on the server. */
function apiMeeting_(token, id) {
  var me = requireUser_(token);
  var m = findMeeting_(id);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };
  if (!canOpenMeeting_(me, m)) {
    // Deliberately the same wording as a missing meeting. Telling someone a
    // meeting exists but is not for them tells them it happened.
    log_('denied', me.name, me.role, str_(id), 'Meeting outside their scope');
    return { ok: false, error: 'That meeting no longer exists.' };
  }

  var att = readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });
  var mine = att.filter(function (a) { return low_(a['Email']) === me.email; })[0];
  var myAtt = mine ? {
    status: low_(mine['Status']), signedIn: fmtStamp_(mine['Signed In']),
    late: num_(mine['Minutes Late']), reason: str_(mine['Reason'])
  } : null;

  var card = meetingCard_(m, me, myAtt);
  card.mission = canSee_(me, 'all') ? str_(m['Mission Statement']) : '';
  card.purpose = str_(m['Purpose']);

  var uploads = readTab_(MEET.TAB_UPLOADS).filter(function (u) {
    return str_(u['Meeting ID']) === str_(m['ID']);
  });

  var agenda = readTab_(MEET.TAB_AGENDA)
    .filter(function (a) { return str_(a['Meeting ID']) === str_(m['ID']); })
    .sort(function (a, b) { return num_(a['Order']) - num_(b['Order']); });

  // Clock times run from the meeting start through the allotted
  // minutes, so the running order carries a real time against every
  // item the way the branch's own agendas do. Times are worked out
  // over the whole agenda first, then the items the person may not
  // see are dropped — otherwise hiding an item would shift the clock
  // for everyone else.
  var clock = atTime_(m['Date'], m['Start']);
  agenda.forEach(function (a) {
    a._clock = clock ? Utilities.formatDate(clock, tz_(), 'h:mm a') : '';
    if (clock) clock = new Date(clock.getTime() + (num_(a['Allotted (min)']) || 0) * 60000);
  });

  var visibleAgenda = agenda.filter(function (a) {
    return canSee_(me, a['Visibility'], m);
  }).map(function (a) {
    var items = uploads.filter(function (u) {
      return str_(u['Agenda ID']) === str_(a['ID']) && canSee_(me, u['Visibility'], m);
    });
    return {
      id: str_(a['ID']),
      order: num_(a['Order']),
      clock: a._clock,
      section: str_(a['Section']),
      title: str_(a['Title']),
      detail: str_(a['Detail']),
      presenter: str_(a['Presenter Name']),
      presenterEmail: low_(a['Presenter Email']),
      mine: low_(a['Presenter Email']) === me.email,
      minutes: num_(a['Allotted (min)']),
      visibility: cleanVisibility_(a['Visibility']),
      materialsRequired: yes_(a['Materials Required']) && str_(a['Materials Required']) !== '',
      ready: str_(a['Ready']).toUpperCase() === 'Y',
      readyAt: fmtStamp_(a['Ready At']),
      topics: str_(a['Topics']),
      reviewedBy: str_(a['Reviewed By']),
      status: str_(a['Status']),
      materials: items.map(function (u) { return uploadCard_(u); })
    };
  });

  var actions = readTab_(MEET.TAB_ACTIONS)
    .filter(function (x) { return str_(x['Meeting ID']) === str_(m['ID']); })
    .map(function (x) { return actionCard_(x); });
  // An agent sees the action items that name them and the ones owned
  // by "All Agents"; the branch's tracker also carries manager-level
  // items that are not theirs to read.
  if (!isStaff_(me)) {
    actions = actions.filter(function (x) {
      var owner = low_(x.owner);
      return owner.indexOf('all') === 0 || owner.indexOf(me.name.toLowerCase()) > -1 ||
             owner.indexOf(me.email) > -1 || low_(x.initiatedBy) === me.email;
    });
  }

  var minutesPublished = low_(m['Minutes Status']) === 'published';
  var minutes = (minutesPublished || isStaff_(me))
    ? readTab_(MEET.TAB_MINUTES)
        .filter(function (x) {
          return str_(x['Meeting ID']) === str_(m['ID']) && canSee_(me, x['Visibility'], m);
        })
        .sort(function (a, b) { return num_(a['Order']) - num_(b['Order']); })
        .map(function (x) {
          return { id: str_(x['ID']), order: num_(x['Order']), section: str_(x['Section']),
                   body: str_(x['Body']), visibility: cleanVisibility_(x['Visibility']),
                   author: str_(x['Author']), updated: fmtStamp_(x['Updated']) };
        })
    : [];

  var contributions = contributionsFor_(m, me);

  var out = {
    ok: true, user: publicUser_(me), meeting: card,
    agenda: visibleAgenda, actions: actions, minutes: minutes,
    minutesPublished: minutesPublished,
    sections: SECTIONS,
    session: sessionCard_(sessionFor_(m['ID']), agenda),
    contributions: contributions,
    kinds: CONTRIB_KINDS,
    topicList: topicList_().map(function (t) { return t.name; }),
    canRun: isStaff_(me),
    maxClipMinutes: MEET.MAX_CLIP_MINUTES
  };

  // The register itself is staff material. An agent sees that they
  // are counted, never who else was or was not there.
  if (isStaff_(me)) {
    out.register = register_(m, att);
    out.floor = floorStats_(contributions, out.register);
  }
  else out.presentCount = att.filter(function (a) {
    return ['present', 'late'].indexOf(low_(a['Status'])) > -1;
  }).length;

  return out;
}

function uploadCard_(u) {
  return {
    id: str_(u['ID']),
    kind: low_(u['Kind']) || 'file',
    name: str_(u['File Name']),
    link: str_(u['Link']),
    mime: str_(u['Mime']),
    size: num_(u['Size']),
    owner: str_(u['Owner Name']),
    ownerEmail: low_(u['Owner Email']),
    visibility: cleanVisibility_(u['Visibility']),
    summary: str_(u['Summary']),
    reviewedBy: str_(u['Reviewed By']),
    uploaded: fmtStamp_(u['Uploaded'])
  };
}

function actionCard_(x) {
  return {
    id: str_(x['ID']),
    meetingId: str_(x['Meeting ID']),
    item: str_(x['Item']),
    owner: str_(x['Owner']),
    initiatedBy: str_(x['Initiated By']),
    due: str_(x['Due']),
    dueISO: iso_(asDate_(x['Due'])),
    status: str_(x['Status']) || 'Open',
    priority: str_(x['Priority']),
    notes: str_(x['Notes']),
    origin: str_(x['Origin Meeting']),
    created: fmtDate_(x['Created']),
    completed: fmtDate_(x['Completed'])
  };
}

/* ======================== the register ======================== */
/*
 *  There is no separate attendance register any more. You open the
 *  meeting and press "I'm here" — that writes the row, and the row
 *  IS the register. One place, time-stamped, nothing to reconcile
 *  afterwards.
 *
 *  The register reports five groups. The fifth is the one the Q1
 *  minutes went out of their way to record: people who made NO
 *  ENTRY at all — neither present, absent, excused nor late. That
 *  is not the same as being absent, and the branch treats it as a
 *  fact about the record rather than an accusation.
 */

function register_(m, att) {
  att = att || readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });

  var byEmail = {};
  att.forEach(function (a) { byEmail[low_(a['Email'])] = a; });

  var groups = { present: [], late: [], excused: [], absent: [], noEntry: [] };

  att.forEach(function (a) {
    var entry = {
      email: low_(a['Email']), name: str_(a['Name']), role: low_(a['Role']),
      unit: str_(a['Unit']), method: low_(a['Method']),
      signedIn: fmtStamp_(a['Signed In']), time: fmtTime_(a['Signed In']),
      late: num_(a['Minutes Late']), reason: str_(a['Reason']),
      recordedBy: str_(a['Recorded By'])
    };
    var st = low_(a['Status']);
    if (groups[st]) groups[st].push(entry);
  });

  // Everyone on the branch list with no row at all for this meeting.
  roster_().forEach(function (p) {
    if (!byEmail[p.email]) {
      groups.noEntry.push({ email: p.email, name: p.name, role: p.role, unit: p.unit });
    }
  });

  var order = function (a, b) { return a.name.localeCompare(b.name); };
  Object.keys(groups).forEach(function (k) { groups[k].sort(order); });

  var roll = roster_().length;
  var here = groups.present.length + groups.late.length;

  return {
    counts: {
      present: groups.present.length, late: groups.late.length,
      excused: groups.excused.length, absent: groups.absent.length,
      noEntry: groups.noEntry.length, roll: roll, here: here,
      rate: roll ? Math.round((here / roll) * 100) : 0
    },
    groups: groups
  };
}

/** Sign in to the meeting. This is the attendance record. */
function apiCheckIn_(body) {
  var me = requireUser_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var st = low_(m['Status']) || 'draft';
  if (st === 'draft') return { ok: false, error: 'That meeting has not been opened yet.' };
  if (st === 'cancelled') return { ok: false, error: 'That meeting was cancelled.' };

  var now = new Date();
  var w = checkinWindow_(m);
  if (w.open && now.getTime() < w.open.getTime()) {
    return { ok: false, error: 'Check-in opens at ' + fmtStamp_(w.open) + '.' };
  }
  if (w.close && now.getTime() > w.close.getTime()) {
    return { ok: false, error: 'Check-in for this meeting closed at ' + fmtStamp_(w.close) + '.' };
  }

  var existing = readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']) && low_(a['Email']) === me.email;
  })[0];

  var decided = statusForNow_(m, now);

  if (existing) {
    // Already excused or marked absent, and now they have walked in:
    // the arrival is the truth, so the row is corrected rather than
    // duplicated. The original reason is kept beside it.
    var was = low_(existing['Status']);
    if (was === 'present' || was === 'late') {
      return { ok: true, already: true, status: was,
               signedIn: fmtStamp_(existing['Signed In']),
               late: num_(existing['Minutes Late']) };
    }
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Status', decided.status);
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Method', 'login');
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Signed In', now);
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Minutes Late', decided.late);
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Recorded By', 'self');
    if (str_(existing['Reason'])) {
      setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Reason',
        'Signed in after being logged ' + was + ' — ' + str_(existing['Reason']));
    }
    log_('check-in', me.name, me.role, str_(m['Ref']) || str_(m['ID']),
      'Corrected from ' + was + ' to ' + decided.status);
    return { ok: true, status: decided.status, late: decided.late, signedIn: fmtStamp_(now) };
  }

  appendRow_(MEET.TAB_ATTENDANCE, {
    'ID': uid_('ATT'), 'Meeting ID': str_(m['ID']), 'Email': me.email, 'Name': me.name,
    'Role': me.role, 'Unit': me.unit, 'Status': decided.status, 'Method': 'login',
    'Signed In': now, 'Minutes Late': decided.late, 'Reason': '', 'Recorded By': 'self',
    'Device': str_(body.device).slice(0, 120)
  });

  log_('check-in', me.name, me.role, str_(m['Ref']) || str_(m['ID']),
    decided.status + (decided.late ? ' (' + decided.late + ' min late)' : ''));

  return { ok: true, status: decided.status, late: decided.late, signedIn: fmtStamp_(now) };
}

/** Tell the branch in advance that you cannot attend, and why. The
 *  April minutes log reasons against every absence; this is where
 *  they come from now. */
function apiExcuse_(body) {
  var me = requireUser_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };
  var reason = str_(body.reason);
  if (reason.length < 3) return { ok: false, error: 'Please say why you cannot attend.' };

  var existing = readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']) && low_(a['Email']) === me.email;
  })[0];

  if (existing && ['present', 'late'].indexOf(low_(existing['Status'])) > -1) {
    return { ok: false, error: 'You are already signed in to this meeting.' };
  }

  if (existing) {
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Status', 'excused');
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Reason', reason);
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Method', 'self-excused');
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Signed In', new Date());
  } else {
    appendRow_(MEET.TAB_ATTENDANCE, {
      'ID': uid_('ATT'), 'Meeting ID': str_(m['ID']), 'Email': me.email, 'Name': me.name,
      'Role': me.role, 'Unit': me.unit, 'Status': 'excused', 'Method': 'self-excused',
      'Signed In': new Date(), 'Minutes Late': 0, 'Reason': reason, 'Recorded By': 'self'
    });
  }
  log_('excused', me.name, me.role, str_(m['Ref']) || str_(m['ID']), reason);
  return { ok: true };
}

/** Staff correcting the register by hand — the "was here earlier,
 *  forgot to log" case from the Q1 minutes. Every correction records
 *  who made it, so the register stays auditable. */
function apiMarkAttendance_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var email = low_(body.email);
  var person = findPersonByEmail_(email);
  if (!person) return { ok: false, error: 'That person is not on the branch list.' };

  var status = low_(body.status);
  if (['present', 'late', 'excused', 'absent'].indexOf(status) === -1) {
    return { ok: false, error: 'Pick present, late, excused or absent.' };
  }

  var existing = readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']) && low_(a['Email']) === email;
  })[0];

  var fields = {
    'Status': status, 'Method': 'manual', 'Reason': str_(body.reason),
    'Recorded By': me.name, 'Minutes Late': num_(body.late)
  };

  if (existing) {
    Object.keys(fields).forEach(function (k) {
      setCell_(MEET.TAB_ATTENDANCE, existing._row, k, fields[k]);
    });
    if (!asDate_(existing['Signed In'])) {
      setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Signed In', new Date());
    }
  } else {
    appendRow_(MEET.TAB_ATTENDANCE, {
      'ID': uid_('ATT'), 'Meeting ID': str_(m['ID']), 'Email': email, 'Name': person.name,
      'Role': person.role, 'Unit': person.unit, 'Signed In': new Date(),
      'Status': status, 'Method': 'manual', 'Reason': str_(body.reason),
      'Recorded By': me.name, 'Minutes Late': num_(body.late)
    });
  }

  log_('mark-attendance', me.name, me.role, email,
    status + ' for ' + (str_(m['Ref']) || str_(m['ID'])) + (str_(body.reason) ? ' — ' + str_(body.reason) : ''));
  return { ok: true };
}

/** The register on its own, for the attendance screen and for export. */
function apiRegister_(token, meetingId) {
  var me = requireStaff_(token);
  var m = findMeeting_(meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };
  return { ok: true, meeting: meetingCard_(m, me, null), register: register_(m) };
}

/** Attendance across every meeting, per person — the view that feeds
 *  a one-on-one. Who keeps logging, who never does. */
function apiAttendanceHistory_(token) {
  var me = requireStaff_(token);
  // Only branch meetings count toward an attendance rate. A one-to-one or a
  // client meeting is not something the whole branch failed to attend.
  var meetings = meetingRows_().filter(function (m) {
    var st = low_(m['Status']);
    return st !== 'draft' && st !== 'cancelled' && cleanScope_(m['Scope']) === 'branch';
  });
  var ids = {};
  meetings.forEach(function (m) { ids[str_(m['ID'])] = m; });

  var att = readTab_(MEET.TAB_ATTENDANCE).filter(function (a) { return ids[str_(a['Meeting ID'])]; });
  var per = {};
  roster_().forEach(function (p) {
    per[p.email] = { email: p.email, name: p.name, role: p.role, unit: p.unit,
                     present: 0, late: 0, excused: 0, absent: 0, noEntry: 0, total: meetings.length };
  });
  var seen = {};
  att.forEach(function (a) {
    var e = low_(a['Email']);
    if (!per[e]) return;
    var st = low_(a['Status']);
    if (per[e][st] !== undefined) per[e][st]++;
    seen[e + '|' + str_(a['Meeting ID'])] = 1;
  });
  Object.keys(per).forEach(function (e) {
    meetings.forEach(function (m) { if (!seen[e + '|' + str_(m['ID'])]) per[e].noEntry++; });
    var p = per[e];
    p.rate = p.total ? Math.round(((p.present + p.late) / p.total) * 100) : 0;
  });

  var list = Object.keys(per).map(function (e) { return per[e]; });
  list.sort(function (a, b) { return a.rate - b.rate || a.name.localeCompare(b.name); });
  return { ok: true, meetings: meetings.length, people: list };
}

/* ======================== building a meeting ======================== */

/** Week number in the branch's own W## form, taken from the date. */
function weekOf_(d) {
  d = asDate_(d);
  if (!d) return '';
  return 'W' + Utilities.formatDate(d, tz_(), 'w');
}

function apiSaveMeeting_(body) {
  var me = requireStaff_(body.token);
  var id = str_(body.id);
  var date = asDate_(body.date);
  if (!str_(body.title)) return { ok: false, error: 'Give the meeting a title.' };
  if (!date) return { ok: false, error: 'Pick a date for the meeting.' };

  var type = MEETING_TYPES.indexOf(str_(body.type)) > -1 ? str_(body.type) : 'Branch Meeting';
  var week = str_(body.week) || weekOf_(date);
  var status = low_(body.status);
  if (['draft', 'scheduled', 'live', 'closed', 'cancelled'].indexOf(status) === -1) status = 'draft';

  var fields = {
    'Type': type,
    'Title': str_(body.title),
    'Subtitle': str_(body.subtitle),
    'Week': week,
    'Date': date,
    'Start': str_(body.start),
    'End': str_(body.end),
    'Format': str_(body.format) || 'In-person',
    'Location': str_(body.location),
    'Chair': low_(body.chair) || me.email,
    'Guest': str_(body.guest),
    'Status': status,
    'Late After (min)': num_(body.lateAfter) || MEET.LATE_AFTER_MINUTES,
    'Materials Due': asDate_(body.materialsDue) || '',
    'Pre-Read': str_(body.preRead),
    'Anchor Document': str_(body.anchor),
    'Mission Statement': str_(body.mission),
    'Purpose': str_(body.purpose),
    'Scope': cleanScope_(body.scope),
    'Participants': str_(body.participants),
    'Client Ref': str_(body.clientRef),
    'Topics': str_(body.topics),
    'Updated': new Date()
  };

  if (id) {
    var m = findMeeting_(id);
    if (!m) return { ok: false, error: 'That meeting no longer exists.' };
    Object.keys(fields).forEach(function (k) { setCell_(MEET.TAB_MEETINGS, m._row, k, fields[k]); });
    log_('edit-meeting', me.name, me.role, str_(m['Ref']) || id, type + ' — ' + str_(body.title));
    return { ok: true, id: id };
  }

  var newId = uid_('MTG');
  var prefix = type === 'Branch Meeting' ? 'RRB-BM' :
               type === 'Staff Meeting' ? 'RRB-STAFF' :
               type === 'One-on-One' ? 'RRB-121' :
               type === 'Quarterly Review' ? 'RRB-QR' : 'RRB-MTG';
  fields['ID'] = newId;
  fields['Ref'] = prefix + '-' + week + '-' + Utilities.formatDate(date, tz_(), 'yyyy-MM-dd');
  fields['Minutes Status'] = 'none';
  fields['Created By'] = me.email;
  fields['Created'] = new Date();
  appendRow_(MEET.TAB_MEETINGS, fields);

  log_('new-meeting', me.name, me.role, fields['Ref'], type + ' — ' + str_(body.title));
  return { ok: true, id: newId, ref: fields['Ref'] };
}

/** Open the doors: draft -> scheduled, so it appears for everyone
 *  and check-in can run. */
function apiSetMeetingStatus_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };
  var status = low_(body.status);
  if (['draft', 'scheduled', 'live', 'closed', 'cancelled'].indexOf(status) === -1) {
    return { ok: false, error: 'Unknown status.' };
  }
  setCell_(MEET.TAB_MEETINGS, m._row, 'Status', status);
  setCell_(MEET.TAB_MEETINGS, m._row, 'Updated', new Date());
  log_('meeting-status', me.name, me.role, str_(m['Ref']) || str_(m['ID']), 'Set to ' + status);
  return { ok: true };
}

function apiSaveAgenda_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };
  if (!str_(body.title)) return { ok: false, error: 'Give the agenda item a title.' };

  var presenterEmail = low_(body.presenterEmail);
  var presenter = presenterEmail ? findPersonByEmail_(presenterEmail) : null;

  var fields = {
    'Section': str_(body.section) || SECTIONS[0],
    'Title': str_(body.title),
    'Detail': str_(body.detail),
    'Presenter Email': presenterEmail,
    'Presenter Name': presenter ? presenter.name : str_(body.presenterName),
    'Allotted (min)': num_(body.minutes) || 5,
    'Visibility': cleanVisibility_(body.visibility),
    'Materials Required': body.materialsRequired ? 'Y' : 'N',
    'Topics': str_(body.topics),
    'Status': str_(body.status) || 'Planned'
  };

  var id = str_(body.id);
  if (id) {
    var row = readTab_(MEET.TAB_AGENDA).filter(function (a) { return str_(a['ID']) === id; })[0];
    if (!row) return { ok: false, error: 'That agenda item no longer exists.' };
    Object.keys(fields).forEach(function (k) { setCell_(MEET.TAB_AGENDA, row._row, k, fields[k]); });
    if (body.order !== undefined) setCell_(MEET.TAB_AGENDA, row._row, 'Order', num_(body.order));
    log_('edit-agenda', me.name, me.role, str_(m['Ref']), str_(body.title));
    return { ok: true, id: id };
  }

  var existing = readTab_(MEET.TAB_AGENDA).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });
  var maxOrder = existing.reduce(function (n, a) { return Math.max(n, num_(a['Order'])); }, 0);

  fields['ID'] = uid_('AGD');
  fields['Meeting ID'] = str_(m['ID']);
  fields['Order'] = body.order !== undefined ? num_(body.order) : maxOrder + 10;
  fields['Ready'] = 'N';
  fields['Created By'] = me.email;
  fields['Created'] = new Date();
  appendRow_(MEET.TAB_AGENDA, fields);

  log_('new-agenda', me.name, me.role, str_(m['Ref']), str_(body.title) +
    (presenter ? ' — ' + presenter.name : ''));
  return { ok: true, id: fields['ID'] };
}

function apiDeleteAgenda_(body) {
  var me = requireStaff_(body.token);
  var row = readTab_(MEET.TAB_AGENDA).filter(function (a) { return str_(a['ID']) === str_(body.id); })[0];
  if (!row) return { ok: false, error: 'That agenda item no longer exists.' };
  tab_(MEET.TAB_AGENDA).deleteRow(row._row);
  log_('delete-agenda', me.name, me.role, str_(body.id), str_(row['Title']));
  return { ok: true };
}

/** Drag-and-drop reordering: the app sends the ids in their new order. */
function apiReorderAgenda_(body) {
  requireStaff_(body.token);
  var ids = body.ids || [];
  var rows = readTab_(MEET.TAB_AGENDA);
  ids.forEach(function (id, i) {
    var row = rows.filter(function (a) { return str_(a['ID']) === str_(id); })[0];
    if (row) setCell_(MEET.TAB_AGENDA, row._row, 'Order', (i + 1) * 10);
  });
  return { ok: true };
}

/** Copy the standing agenda the branch runs every week, so building
 *  next week's meeting is a matter of filling in, not typing out. */
function apiSeedAgenda_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var existing = readTab_(MEET.TAB_AGENDA).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });
  if (existing.length) return { ok: false, error: 'This meeting already has an agenda.' };

  var chair = str_(m['Chair']) || me.email;
  var chairPerson = findPersonByEmail_(chair);
  var chairName = chairPerson ? chairPerson.name : MEET.ADMIN_NAME;

  // The standing order, taken from the branch's own agendas.
  var standing = [
    { s: 0, t: 'Opening | Mission Statement | Moment of Silence', m: 5, p: chairName, d: 'Standard opening', v: 'all' },
    { s: 0, t: 'Attendance Register Check', m: 5, p: chairName, d: 'Everyone logs in before we open. The app is the register.', v: 'all' },
    { s: 0, t: 'Review of Minutes & Action Items Tracker', m: 10, p: chairName, d: 'Carry-forward items first.', v: 'all' },
    { s: 1, t: 'Correspondence & Administrative Reminders', m: 10, p: '', d: 'Circulars, deadlines, cut-off dates.', v: 'all' },
    { s: 2, t: 'Outstanding Requirements Report', m: 8, p: '', d: 'By product and value. 5-day turnaround, 20-day file closure.', v: 'staff' },
    { s: 2, t: 'Persistency — 2-Year & 5-Year', m: 8, p: '', d: 'Red / orange / green. Branch target 90% against the 75% threshold.', v: 'staff' },
    { s: 2, t: 'Licensing Report', m: 5, p: '', d: 'Central Bank approvals by renewal month.', v: 'staff' },
    { s: 2, t: 'Scripts & Clawback Report', m: 6, p: '', d: 'Dispatch inside the 20-business-day window.', v: 'staff' },
    { s: 2, t: '85-Day Premium Due & Lapse Activity', m: 8, p: '', d: 'Standing item at every branch meeting.', v: 'staff' },
    { s: 3, t: 'Performance & Community Management', m: 8, p: chairName, d: 'Weekly pulse, one-on-one cadence, tenure-band tracker.', v: 'staff' },
    { s: 4, t: 'Digital Innovation Update', m: 10, p: chairName, d: 'Fact Find 360 and branch automation.', v: 'all' },
    { s: 6, t: 'Other Items', m: 5, p: '', d: '', v: 'all' },
    { s: 7, t: 'Closing Remarks', m: 5, p: chairName, d: '', v: 'all' }
  ];

  standing.forEach(function (item, i) {
    appendRow_(MEET.TAB_AGENDA, {
      'ID': uid_('AGD'), 'Meeting ID': str_(m['ID']), 'Order': (i + 1) * 10,
      'Section': SECTIONS[item.s], 'Title': item.t, 'Detail': item.d,
      'Presenter Name': item.p, 'Presenter Email': item.p === chairName ? chair : '',
      'Allotted (min)': item.m, 'Visibility': item.v,
      'Materials Required': item.v === 'staff' ? 'Y' : 'N',
      'Ready': 'N', 'Status': 'Planned', 'Created By': me.email, 'Created': new Date()
    });
  });

  log_('seed-agenda', me.name, me.role, str_(m['Ref']), standing.length + ' standing items');
  return { ok: true, added: standing.length };
}

/* ======================== what people are presenting ======================== */
/*
 *  Presenters attach their own material against their own agenda
 *  slot. Files go into a private Drive folder — never shared, never
 *  linked publicly — and the bytes come back out only through
 *  apiFile_, which checks the same visibility rule as everything
 *  else. Anything too big for that goes in as a link instead.
 */

function apiUpload_(body) {
  var me = requireUser_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var agendaId = str_(body.agendaId);
  var slot = readTab_(MEET.TAB_AGENDA).filter(function (a) { return str_(a['ID']) === agendaId; })[0];
  if (!slot) return { ok: false, error: 'Pick the agenda item you are presenting.' };

  // You may attach to your own slot. Staff may attach to any slot,
  // because support prepares material on a manager's behalf.
  if (low_(slot['Presenter Email']) !== me.email && !isStaff_(me)) {
    return { ok: false, error: 'That is someone else\'s agenda item.' };
  }

  var kind = low_(body.kind) === 'link' ? 'link' : 'file';
  var visibility = cleanVisibility_(body.visibility || slot['Visibility']);
  var rec = {
    'ID': uid_('UPL'), 'Meeting ID': str_(m['ID']), 'Agenda ID': agendaId,
    'Owner Email': me.email, 'Owner Name': me.name, 'Kind': kind,
    'Visibility': visibility, 'Summary': str_(body.summary), 'Uploaded': new Date()
  };

  if (kind === 'link') {
    var link = str_(body.link);
    if (!/^https?:\/\//i.test(link)) return { ok: false, error: 'Paste a full link starting with https://' };
    rec['File Name'] = str_(body.name) || link.replace(/^https?:\/\//i, '').slice(0, 80);
    rec['Link'] = link;
  } else {
    var data = str_(body.data);
    var name = str_(body.name) || 'material';
    if (!data) return { ok: false, error: 'Choose a file to upload.' };
    var comma = data.indexOf(',');
    var b64 = comma > -1 ? data.slice(comma + 1) : data;
    var bytes;
    try { bytes = Utilities.base64Decode(b64); }
    catch (err) { return { ok: false, error: 'That file could not be read.' }; }
    if (bytes.length > MEET.MAX_UPLOAD_MB * 1024 * 1024) {
      return { ok: false, error: 'That file is over ' + MEET.MAX_UPLOAD_MB +
        ' MB. Put it in Drive or OneDrive and paste the link instead.' };
    }
    var mime = str_(body.mime) || 'application/octet-stream';
    var blob = Utilities.newBlob(bytes, mime, name);
    var folder = meetingFolder_(m);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    rec['File Name'] = name;
    rec['File ID'] = file.getId();
    rec['Mime'] = mime;
    rec['Size'] = bytes.length;
  }

  appendRow_(MEET.TAB_UPLOADS, rec);

  // Attaching material is what "ready" means for that slot.
  setCell_(MEET.TAB_AGENDA, slot._row, 'Ready', 'Y');
  setCell_(MEET.TAB_AGENDA, slot._row, 'Ready At', new Date());

  log_('upload', me.name, me.role, str_(m['Ref']),
    kind + ': ' + rec['File Name'] + ' -> ' + str_(slot['Title']));
  return { ok: true, id: rec['ID'] };
}

/** One sub-folder per meeting, so the Drive folder stays navigable. */
function meetingFolder_(m) {
  var root = materialsFolder_();
  var name = (str_(m['Ref']) || str_(m['ID'])) + ' — ' + str_(m['Title']).slice(0, 60);
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

/** Serve a file back, but only to someone allowed to see it. The
 *  Drive file itself stays private, so this check is the only way in. */
function apiFile_(token, uploadId) {
  var me = requireUser_(token);
  var u = readTab_(MEET.TAB_UPLOADS).filter(function (x) { return str_(x['ID']) === str_(uploadId); })[0];
  if (!u) return { ok: false, error: 'That file is no longer here.' };
  var m = findMeeting_(u['Meeting ID']);
  if (!canSee_(me, u['Visibility'], m)) {
    log_('denied', me.name, me.role, str_(uploadId), 'Tried to open material above their access');
    return { ok: false, error: 'That material is not shared with you.' };
  }
  if (low_(u['Kind']) === 'link') return { ok: true, kind: 'link', link: str_(u['Link']) };

  var file;
  try { file = DriveApp.getFileById(str_(u['File ID'])); }
  catch (err) { return { ok: false, error: 'That file is no longer in Drive.' }; }

  log_('open-file', me.name, me.role, str_(u['File Name']), str_(m && m['Ref']));
  return {
    ok: true, kind: 'file', name: str_(u['File Name']), mime: str_(u['Mime']),
    data: Utilities.base64Encode(file.getBlob().getBytes())
  };
}

function apiDeleteUpload_(body) {
  var me = requireUser_(body.token);
  var u = readTab_(MEET.TAB_UPLOADS).filter(function (x) { return str_(x['ID']) === str_(body.id); })[0];
  if (!u) return { ok: false, error: 'That file is no longer here.' };
  if (low_(u['Owner Email']) !== me.email && !isStaff_(me)) {
    return { ok: false, error: 'That is not your file.' };
  }
  if (str_(u['File ID'])) {
    try { DriveApp.getFileById(str_(u['File ID'])).setTrashed(true); } catch (err) { /* already gone */ }
  }
  tab_(MEET.TAB_UPLOADS).deleteRow(u._row);
  log_('delete-upload', me.name, me.role, str_(u['File Name']), '');
  return { ok: true };
}

/** Staff signing off that a presenter's material is fit for the room
 *  — the branch's "reports reviewed before the meeting, no
 *  corrections in the live meeting" rule. */
function apiReviewUpload_(body) {
  var me = requireStaff_(body.token);
  var u = readTab_(MEET.TAB_UPLOADS).filter(function (x) { return str_(x['ID']) === str_(body.id); })[0];
  if (!u) return { ok: false, error: 'That file is no longer here.' };
  setCell_(MEET.TAB_UPLOADS, u._row, 'Reviewed By', me.name);
  setCell_(MEET.TAB_UPLOADS, u._row, 'Reviewed At', new Date());
  var slot = readTab_(MEET.TAB_AGENDA).filter(function (a) { return str_(a['ID']) === str_(u['Agenda ID']); })[0];
  if (slot) setCell_(MEET.TAB_AGENDA, slot._row, 'Reviewed By', me.name);
  log_('review-upload', me.name, me.role, str_(u['File Name']), 'Checked before the meeting');
  return { ok: true };
}

/** Who still owes material, and how long they have. This is the
 *  "COME PREPARED WITH ... Reports Ready? Y/N" table, live. */
function apiPrep_(token, meetingId) {
  var me = requireUser_(token);
  var m = findMeeting_(meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var uploads = readTab_(MEET.TAB_UPLOADS).filter(function (u) {
    return str_(u['Meeting ID']) === str_(m['ID']);
  });

  var slots = readTab_(MEET.TAB_AGENDA)
    .filter(function (a) { return str_(a['Meeting ID']) === str_(m['ID']); })
    .filter(function (a) { return isStaff_(me) || low_(a['Presenter Email']) === me.email; })
    .filter(function (a) { return canSee_(me, a['Visibility'], m); })
    .sort(function (a, b) { return num_(a['Order']) - num_(b['Order']); })
    .map(function (a) {
      var mine = uploads.filter(function (u) { return str_(u['Agenda ID']) === str_(a['ID']); });
      return {
        id: str_(a['ID']), title: str_(a['Title']), section: str_(a['Section']),
        presenter: str_(a['Presenter Name']), presenterEmail: low_(a['Presenter Email']),
        mine: low_(a['Presenter Email']) === me.email,
        required: yes_(a['Materials Required']) && str_(a['Materials Required']) !== '' &&
                  str_(a['Materials Required']).toUpperCase() !== 'N',
        ready: str_(a['Ready']).toUpperCase() === 'Y',
        readyAt: fmtStamp_(a['Ready At']),
        reviewedBy: str_(a['Reviewed By']),
        visibility: cleanVisibility_(a['Visibility']),
        count: mine.length,
        materials: mine.map(function (u) { return uploadCard_(u); })
      };
    });

  return {
    ok: true, user: publicUser_(me), meeting: meetingCard_(m, me, null),
    slots: slots, maxMB: MEET.MAX_UPLOAD_MB
  };
}

/* ======================== action items ======================== */
/*
 *  The branch's tracker has three parts: new items from today, items
 *  carried forward and still open, and standing items on a continuous
 *  cadence. Carry-forward is a copy that remembers where it came
 *  from, so an item raised on 18 March still says so five weeks later
 *  when it is being called overdue.
 */

function apiActions_(token, meetingId) {
  var me = requireUser_(token);
  var all = readTab_(MEET.TAB_ACTIONS).map(function (x) { return actionCard_(x); });

  if (!isStaff_(me)) {
    var nm = me.name.toLowerCase();
    all = all.filter(function (x) {
      var owner = low_(x.owner);
      return owner.indexOf('all ') === 0 || owner === 'all agents' ||
             owner.indexOf(nm) > -1 || owner.indexOf(me.email) > -1;
    });
  }
  if (meetingId) all = all.filter(function (x) { return x.meetingId === str_(meetingId); });

  var today = new Date(); today.setHours(0, 0, 0, 0);
  all.forEach(function (x) {
    var d = asDate_(x.dueISO);
    x.overdue = !!(d && d.getTime() < today.getTime() && x.status !== 'Complete' && x.status !== 'Standing');
  });

  var open = all.filter(function (x) { return x.status !== 'Complete'; });
  return {
    ok: true,
    actions: all,
    counts: {
      total: all.length,
      open: open.length,
      overdue: all.filter(function (x) { return x.overdue; }).length,
      standing: all.filter(function (x) { return x.status === 'Standing'; }).length,
      complete: all.filter(function (x) { return x.status === 'Complete'; }).length
    },
    statuses: ACTION_STATUSES
  };
}

function apiSaveAction_(body) {
  var me = requireStaff_(body.token);
  if (!str_(body.item)) return { ok: false, error: 'Describe the action item.' };
  var status = ACTION_STATUSES.indexOf(str_(body.status)) > -1 ? str_(body.status) : 'Open';

  var fields = {
    'Item': str_(body.item),
    'Owner': str_(body.owner),
    'Initiated By': str_(body.initiatedBy) || me.name,
    'Due': str_(body.due),
    'Status': status,
    'Priority': str_(body.priority),
    'Notes': str_(body.notes),
    'Updated': new Date()
  };
  if (status === 'Complete') fields['Completed'] = new Date();

  var id = str_(body.id);
  if (id) {
    var row = readTab_(MEET.TAB_ACTIONS).filter(function (x) { return str_(x['ID']) === id; })[0];
    if (!row) return { ok: false, error: 'That action item no longer exists.' };
    Object.keys(fields).forEach(function (k) { setCell_(MEET.TAB_ACTIONS, row._row, k, fields[k]); });
    log_('edit-action', me.name, me.role, id, status + ' — ' + str_(body.item).slice(0, 60));
    return { ok: true, id: id };
  }

  fields['ID'] = uid_('ACT');
  fields['Meeting ID'] = str_(body.meetingId);
  fields['Origin Meeting'] = str_(body.originMeeting) || str_(body.meetingId);
  fields['Created'] = new Date();
  fields['Created By'] = me.email;
  appendRow_(MEET.TAB_ACTIONS, fields);
  log_('new-action', me.name, me.role, fields['ID'], str_(body.item).slice(0, 60));
  return { ok: true, id: fields['ID'] };
}

function apiDeleteAction_(body) {
  var me = requireStaff_(body.token);
  var row = readTab_(MEET.TAB_ACTIONS).filter(function (x) { return str_(x['ID']) === str_(body.id); })[0];
  if (!row) return { ok: false, error: 'That action item no longer exists.' };
  tab_(MEET.TAB_ACTIONS).deleteRow(row._row);
  log_('delete-action', me.name, me.role, str_(body.id), str_(row['Item']).slice(0, 60));
  return { ok: true };
}

/** Bring every still-open item from an earlier meeting onto this one,
 *  keeping the meeting it was first raised in. */
function apiCarryForward_(body) {
  var me = requireStaff_(body.token);
  var to = findMeeting_(body.meetingId);
  if (!to) return { ok: false, error: 'That meeting no longer exists.' };

  var already = {};
  readTab_(MEET.TAB_ACTIONS).forEach(function (x) {
    if (str_(x['Meeting ID']) === str_(to['ID'])) already[str_(x['Item']).toLowerCase()] = 1;
  });

  var carried = 0;
  readTab_(MEET.TAB_ACTIONS).forEach(function (x) {
    if (str_(x['Meeting ID']) === str_(to['ID'])) return;
    var status = str_(x['Status']);
    if (status === 'Complete') return;
    if (already[str_(x['Item']).toLowerCase()]) return;

    appendRow_(MEET.TAB_ACTIONS, {
      'ID': uid_('ACT'), 'Meeting ID': str_(to['ID']), 'Item': str_(x['Item']),
      'Owner': str_(x['Owner']), 'Initiated By': str_(x['Initiated By']), 'Due': str_(x['Due']),
      'Status': status, 'Priority': str_(x['Priority']), 'Notes': str_(x['Notes']),
      'Origin Meeting': str_(x['Origin Meeting']) || str_(x['Meeting ID']),
      'Created': asDate_(x['Created']) || new Date(), 'Created By': str_(x['Created By']),
      'Updated': new Date()
    });
    carried++;
  });

  log_('carry-forward', me.name, me.role, str_(to['Ref']), carried + ' open items carried forward');
  return { ok: true, carried: carried };
}

/* ======================== minutes ======================== */
/*
 *  The minutes are written in the app, against the meeting they
 *  belong to, and published from there. Attendance and the action
 *  tracker are already in the system, so they never have to be typed
 *  again — apiMinutesDraft_ hands the writer a starting document with
 *  those parts already filled in from the record.
 */

function apiSaveMinutes_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var fields = {
    'Section': str_(body.section),
    'Body': str_(body.body),
    'Visibility': cleanVisibility_(body.visibility),
    'Author': me.name,
    'Updated': new Date()
  };

  var id = str_(body.id);
  if (id) {
    var row = readTab_(MEET.TAB_MINUTES).filter(function (x) { return str_(x['ID']) === id; })[0];
    if (!row) return { ok: false, error: 'That section no longer exists.' };
    Object.keys(fields).forEach(function (k) { setCell_(MEET.TAB_MINUTES, row._row, k, fields[k]); });
    if (body.order !== undefined) setCell_(MEET.TAB_MINUTES, row._row, 'Order', num_(body.order));
    return { ok: true, id: id };
  }

  var existing = readTab_(MEET.TAB_MINUTES).filter(function (x) {
    return str_(x['Meeting ID']) === str_(m['ID']);
  });
  fields['ID'] = uid_('MIN');
  fields['Meeting ID'] = str_(m['ID']);
  fields['Order'] = body.order !== undefined ? num_(body.order)
    : existing.reduce(function (n, x) { return Math.max(n, num_(x['Order'])); }, 0) + 10;
  appendRow_(MEET.TAB_MINUTES, fields);

  if (low_(m['Minutes Status']) === 'none' || !str_(m['Minutes Status'])) {
    setCell_(MEET.TAB_MEETINGS, m._row, 'Minutes Status', 'draft');
  }
  log_('minutes', me.name, me.role, str_(m['Ref']), 'Wrote "' + str_(body.section) + '"');
  return { ok: true, id: fields['ID'] };
}

function apiDeleteMinute_(body) {
  var me = requireStaff_(body.token);
  var row = readTab_(MEET.TAB_MINUTES).filter(function (x) { return str_(x['ID']) === str_(body.id); })[0];
  if (!row) return { ok: false, error: 'That section no longer exists.' };
  tab_(MEET.TAB_MINUTES).deleteRow(row._row);
  log_('delete-minute', me.name, me.role, str_(body.id), str_(row['Section']));
  return { ok: true };
}

/** Publishing releases the "Everyone" sections to agents. Staff-only
 *  and chair-only sections stay where they are. */
function apiPublishMinutes_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };
  var to = low_(body.status) === 'draft' ? 'draft' : 'published';
  setCell_(MEET.TAB_MEETINGS, m._row, 'Minutes Status', to);
  setCell_(MEET.TAB_MEETINGS, m._row, 'Updated', new Date());
  log_('publish-minutes', me.name, me.role, str_(m['Ref']), 'Minutes ' + to);
  return { ok: true, status: to };
}

/** A starting document, with the parts the system already knows
 *  filled in: who was there, who was late and why, who made no entry
 *  at all, and every action item on the tracker. */
function apiMinutesDraft_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var existing = readTab_(MEET.TAB_MINUTES).filter(function (x) {
    return str_(x['Meeting ID']) === str_(m['ID']);
  });
  if (existing.length) return { ok: false, error: 'These minutes have already been started.' };

  var reg = register_(m);
  var names = function (list) {
    return list.length ? list.map(function (p) { return p.name; }).join('  |  ') : '—';
  };

  var attendance =
    'Attendance captured by the Branch Meeting Builder. Signing in to the meeting is the register.\n\n' +
    'PRESENT (' + reg.counts.present + ')\n' + names(reg.groups.present) + '\n\n' +
    'LATE (' + reg.counts.late + ')\n' +
    (reg.groups.late.length ? reg.groups.late.map(function (p) {
      return p.name + ' — ' + p.late + ' min late' + (p.reason ? ' (' + p.reason + ')' : '');
    }).join('\n') : '—') + '\n\n' +
    'EXCUSED (' + reg.counts.excused + ')\n' +
    (reg.groups.excused.length ? reg.groups.excused.map(function (p) {
      return p.name + ' — ' + (p.reason || 'no reason logged');
    }).join('\n') : '—') + '\n\n' +
    'ABSENT (' + reg.counts.absent + ')\n' +
    (reg.groups.absent.length ? reg.groups.absent.map(function (p) {
      return p.name + ' — ' + (p.reason || 'no reason logged');
    }).join('\n') : '—') + '\n\n' +
    'NO ENTRY IN THE REGISTER (' + reg.counts.noEntry + ')\n' +
    names(reg.groups.noEntry) + '\n' +
    (reg.counts.noEntry
      ? 'Neither present, absent, excused nor late. Signing in is the branch standard for a ' +
        'scheduled meeting; where an active agent has not engaged with it, that is recorded as a ' +
        'factual observation of the record and carried to the one-on-one with their manager.'
      : 'Every active member of the branch engaged with the register.') + '\n\n' +
    'Roll: ' + reg.counts.roll + '  |  In the room: ' + reg.counts.here +
    '  |  Engagement: ' + reg.counts.rate + '%';

  var agenda = readTab_(MEET.TAB_AGENDA)
    .filter(function (a) { return str_(a['Meeting ID']) === str_(m['ID']); })
    .sort(function (a, b) { return num_(a['Order']) - num_(b['Order']); });

  var actions = readTab_(MEET.TAB_ACTIONS)
    .filter(function (x) { return str_(x['Meeting ID']) === str_(m['ID']); });

  var tracker = actions.length
    ? actions.map(function (x) {
        return '• ' + str_(x['Item']) + '\n    Owner: ' + (str_(x['Owner']) || '—') +
               '  |  Initiated by: ' + (str_(x['Initiated By']) || '—') +
               '  |  Due: ' + (str_(x['Due']) || '—') +
               '  |  Status: ' + (str_(x['Status']) || 'Open');
      }).join('\n')
    : 'No action items recorded for this meeting yet.';

  var draft = [
    { section: 'Purpose', body: str_(m['Purpose']) || '', visibility: 'all' },
    { section: 'Attendance Record — Digital Register', body: attendance, visibility: 'staff' }
  ];

  // One heading per agenda item, carrying its own visibility across,
  // so a staff-only report cannot become an all-hands minute by
  // accident.
  agenda.forEach(function (a) {
    draft.push({
      section: str_(a['Title']),
      body: str_(a['Detail']) + (str_(a['Presenter Name']) ? '\n\nPresented by ' + str_(a['Presenter Name']) + '.' : ''),
      visibility: cleanVisibility_(a['Visibility'])
    });
  });

  draft.push({ section: 'Action Item Tracker', body: tracker, visibility: 'staff' });
  draft.push({ section: 'Closing', body: '', visibility: 'all' });

  draft.forEach(function (d, i) {
    appendRow_(MEET.TAB_MINUTES, {
      'ID': uid_('MIN'), 'Meeting ID': str_(m['ID']), 'Order': (i + 1) * 10,
      'Section': d.section, 'Body': d.body, 'Visibility': d.visibility,
      'Author': me.name, 'Updated': new Date()
    });
  });

  setCell_(MEET.TAB_MEETINGS, m._row, 'Minutes Status', 'draft');
  log_('minutes-draft', me.name, me.role, str_(m['Ref']), draft.length + ' sections started from the record');
  return { ok: true, sections: draft.length };
}

/* ======================== the archive ======================== */
/*
 *  Every meeting the branch has already held lives as a Word document
 *  in a Drive folder. importArchive() registers each one as a past
 *  meeting so the app opens on the whole history rather than starting
 *  from empty — the point being that there is one place to look.
 *
 *  Run it from the Apps Script editor with the folder's id:
 *
 *      importArchive('1A20zsgib-...');
 *
 *  It only ever adds. Running it twice does not duplicate anything.
 */
function importArchive(folderIds) {
  var ids = (folderIds instanceof Array ? folderIds : String(folderIds || '').split(','))
    .map(function (x) {
      x = str_(x);
      var g = x.match(/folders\/([A-Za-z0-9_-]+)/);   // a pasted folder URL works too
      return g ? g[1] : x;
    })
    .filter(Boolean);

  if (!ids.length) {
    ids = String(PropertiesService.getScriptProperties().getProperty('ARCHIVE_FOLDER_ID') || '')
      .split(',').filter(Boolean);
  }
  if (!ids.length) throw new Error('Pass the Drive folder id(s): importArchive("1A20zsg...,1ycYn-n...")');
  PropertiesService.getScriptProperties().setProperty('ARCHIVE_FOLDER_ID', ids.join(','));

  // The same minutes sit in more than one folder, under more than one
  // Google account, sometimes with a "(1)" on the end. Matching on the
  // file's link alone would register the same meeting three times, so a
  // meeting is also claimed by its tidied title and its date.
  var haveUrl = {}, haveMeeting = {};
  meetingRows_().forEach(function (m) {
    if (str_(m['Archive Link'])) haveUrl[str_(m['Archive Link'])] = 1;
    var d = asDate_(m['Date']);
    if (d) haveMeeting[str_(m['Title']).toLowerCase() + '|' + Utilities.formatDate(d, tz_(), 'yyyy-MM-dd')] = 1;
  });

  var added = 0, skipped = 0;

  ids.forEach(function (folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();

  while (files.hasNext()) {
    var f = files.next();
    var url = f.getUrl();
    if (haveUrl[url]) { skipped++; continue; }

    // Only meeting documents. A folder picks up spreadsheets, images and
    // whatever else has been dropped in it over the years, and every one
    // of those would otherwise be registered as a meeting that never
    // happened.
    if (!isMeetingDoc_(f)) { skipped++; continue; }

    var name = f.getName().replace(/\.(docx?|pdf)$/i, '');
    var date = dateFromName_(name) || f.getLastUpdated();
    var isAgenda = /agenda/i.test(name);
    var type = /staff[_ ]?meeting/i.test(name) ? 'Staff Meeting'
             : /one[- ]?on[- ]?one/i.test(name) ? 'One-on-One'
             : /q[1-4]|quarter/i.test(name) ? 'Quarterly Review'
             : /resolution/i.test(name) ? 'Resolution Meeting'
             : 'Branch Meeting';

    var key = tidyName_(name).toLowerCase() + '|' + Utilities.formatDate(date, tz_(), 'yyyy-MM-dd');
    if (haveMeeting[key]) { skipped++; continue; }
    haveMeeting[key] = 1;
    haveUrl[url] = 1;

    var id = uid_('MTG');
    appendRow_(MEET.TAB_MEETINGS, {
      'ID': id,
      'Ref': 'RRB-ARCHIVE-' + Utilities.formatDate(date, tz_(), 'yyyy-MM-dd'),
      'Type': type,
      'Title': tidyName_(name),
      'Subtitle': isAgenda ? 'Agenda (archived)' : 'Minutes (archived)',
      'Week': weekOf_(date),
      'Date': date,
      'Format': 'In-person',
      'Location': MEET.BRANCH + ', Chaguanas',
      'Chair': MEET.ADMIN_EMAIL,
      'Status': 'closed',
      'Minutes Status': isAgenda ? 'none' : 'published',
      'Archive Link': url,
      'Purpose': 'Imported from the branch meeting archive. The original document is linked above.',
      'Created By': 'archive-import',
      'Created': new Date(),
      'Updated': new Date()
    });
    added++;
  }
  });

  log_('import-archive', 'system', '', ids.join(', '), added + ' added, ' + skipped + ' already here');
  return { added: added, skipped: skipped };
}

/** Word documents, Google Docs and PDFs are meeting records. Anything
 *  else in the folder is not. */
function isMeetingDoc_(file) {
  var mime = String(file.getMimeType() || '');
  return mime === 'application/vnd.google-apps.document' ||
         mime === 'application/pdf' ||
         mime === 'application/msword' ||
         mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

/** Pull a date out of the branch's file names — they carry it in
 *  several shapes: 15April2026, 2026-07-08, 7Augustl2026, Aug_21. */
function dateFromName_(name) {
  var months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var m;

  m = name.match(/(20\d\d)[-_](\d{1,2})[-_](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  // Run together with no separators: "..._20260722".
  m = name.match(/(?:^|\D)(20\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = name.match(/(\d{1,2})\s*[_-]?\s*([A-Za-z]{3,9})\.?[a-z]*\s*[_-]?\s*(20\d\d)/);
  if (m && months[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(Number(m[3]), months[m[2].slice(0, 3).toLowerCase()], Number(m[1]));
  }

  // Day then month with the year somewhere else in the name, as in
  // "Meeting_Agendas_16_March_FINAL".
  m = name.match(/(\d{1,2})\s*[_ -]\s*([A-Za-z]{3,9})/);
  if (m && months[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(anyYear_(name), months[m[2].slice(0, 3).toLowerCase()], Number(m[1]));
  }

  // Month then day, as in "Minutes (Aug 21)".
  m = name.match(/([A-Za-z]{3,9})\.?\s*[_-]?\s*(\d{1,2})(?!\d)/);
  if (m && months[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(anyYear_(name), months[m[1].slice(0, 3).toLowerCase()], Number(m[2]));
  }
  return null;
}

function anyYear_(name) {
  var y = name.match(/20\d\d/);
  return y ? Number(y[0]) : new Date().getFullYear();
}

/** "Branch_Meeting_Minutes_15April2026_Q1_Review_FINAL (4)" reads
 *  badly in a list. Tidy it into something a person would write. */
function tidyName_(name) {
  var out = name.replace(/[_]+/g, ' ')
    .replace(/\s*\b(FINAL|DEEP DIVE|v\d+|W\d+)\b\s*/gi, ' ');
  // Drive's duplicate suffixes stack up: "... (1) (1)", and a stray
  // version number is often left behind in front of them.
  var before;
  do {
    before = out;
    out = out.replace(/\s*\(\d+\)\s*$/, '').replace(/\s+\d{1,2}\s*$/, '');
  } while (out !== before);
  return out.replace(/\s{2,}/g, ' ').trim();
}

/* ======================== running the meeting ======================== */
/*
 *  A session is one actual run of a meeting: started at, finished at, and
 *  what was happening in between. The branch's agendas say "25 MIN STRICT"
 *  and the August minutes record the chair asking for 45 minutes of
 *  attention, so the clock is not decoration — it is the thing being
 *  managed.
 *
 *  Recording: the full audio is whatever Teams already makes, and its link
 *  is attached to the session so the recording stops living apart from the
 *  record. Short clips recorded in the app hang off a contribution.
 */

function sessionFor_(meetingId) {
  var rows = readTab_(MEET.TAB_SESSIONS).filter(function (r) {
    return str_(r['Meeting ID']) === str_(meetingId);
  });
  // The live one is the session with no end time; otherwise the last.
  return rows.filter(function (r) { return !asDate_(r['Ended']); })[0] ||
         rows[rows.length - 1] || null;
}

function sessionCard_(sn, agenda) {
  if (!sn) return null;
  var started = asDate_(sn['Started']);
  var ended = asDate_(sn['Ended']);
  var running = !!(started && !ended);
  var elapsed = started
    ? Math.round(((ended ? ended.getTime() : Date.now()) - started.getTime()) / 60000)
    : 0;

  var currentId = str_(sn['Current Agenda ID']);
  var current = null;
  if (currentId && agenda) {
    agenda.forEach(function (a) { if (str_(a['ID']) === currentId) current = a; });
  }
  var itemStarted = asDate_(sn['Item Started']);

  return {
    id: str_(sn['ID']),
    running: running,
    started: started ? fmtStamp_(started) : '',
    startedISO: iso_(started),
    startedBy: str_(sn['Started By']),
    ended: ended ? fmtStamp_(ended) : '',
    endedBy: str_(sn['Ended By']),
    elapsed: elapsed,
    allotted: num_(sn['Allotted']),
    over: num_(sn['Allotted']) ? elapsed - num_(sn['Allotted']) : 0,
    noticeGiven: str_(sn['Notice Given']).toUpperCase() === 'Y',
    recordingLink: str_(sn['Recording Link']),
    transcriptLink: str_(sn['Transcript Link']),
    recordingNote: str_(sn['Recording Note']),
    currentAgendaId: currentId,
    currentTitle: current ? str_(current['Title']) : '',
    currentAllotted: current ? num_(current['Allotted (min)']) : 0,
    itemElapsed: itemStarted ? Math.round((Date.now() - itemStarted.getTime()) / 60000) : 0
  };
}

/** Start the meeting. The clock starts here, not at the scheduled time. */
function apiStartSession_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var live = readTab_(MEET.TAB_SESSIONS).filter(function (r) {
    return str_(r['Meeting ID']) === str_(m['ID']) && !asDate_(r['Ended']);
  })[0];
  if (live) return { ok: false, error: 'This meeting is already running.' };

  var allotted = readTab_(MEET.TAB_AGENDA)
    .filter(function (a) { return str_(a['Meeting ID']) === str_(m['ID']); })
    .reduce(function (n, a) { return n + num_(a['Allotted (min)']); }, 0);

  var id = uid_('SES');
  appendRow_(MEET.TAB_SESSIONS, {
    'ID': id, 'Meeting ID': str_(m['ID']), 'Started': new Date(), 'Started By': me.name,
    'Allotted': allotted, 'Notice Given': body.noticeGiven ? 'Y' : 'N'
  });

  // Starting the meeting is what "live" means, so the status follows.
  setCell_(MEET.TAB_MEETINGS, m._row, 'Status', 'live');
  log_('session-start', me.name, me.role, str_(m['Ref']) || str_(m['ID']),
    allotted ? allotted + ' minutes on the agenda' : 'no agenda timings set');
  return { ok: true, id: id };
}

/** Finish it. The run time goes on the record beside the allotted time. */
function apiEndSession_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var sn = readTab_(MEET.TAB_SESSIONS).filter(function (r) {
    return str_(r['Meeting ID']) === str_(m['ID']) && !asDate_(r['Ended']);
  })[0];
  if (!sn) return { ok: false, error: 'This meeting is not running.' };

  var started = asDate_(sn['Started']) || new Date();
  var ended = new Date();
  var ran = Math.round((ended.getTime() - started.getTime()) / 60000);

  setCell_(MEET.TAB_SESSIONS, sn._row, 'Ended', ended);
  setCell_(MEET.TAB_SESSIONS, sn._row, 'Ended By', me.name);
  setCell_(MEET.TAB_SESSIONS, sn._row, 'Minutes Run', ran);
  setCell_(MEET.TAB_SESSIONS, sn._row, 'Current Agenda ID', '');
  setCell_(MEET.TAB_SESSIONS, sn._row, 'Item Started', '');

  setCell_(MEET.TAB_MEETINGS, m._row, 'Status', 'closed');
  log_('session-end', me.name, me.role, str_(m['Ref']) || str_(m['ID']),
    'Ran ' + ran + ' min against ' + num_(sn['Allotted']) + ' allotted');
  return { ok: true, ran: ran, allotted: num_(sn['Allotted']) };
}

/** Move the room on to the next item. Everyone's screen follows. */
function apiSetCurrentItem_(body) {
  var me = requireStaff_(body.token);
  var sn = sessionFor_(body.meetingId);
  if (!sn || asDate_(sn['Ended'])) return { ok: false, error: 'This meeting is not running.' };
  setCell_(MEET.TAB_SESSIONS, sn._row, 'Current Agenda ID', str_(body.agendaId));
  setCell_(MEET.TAB_SESSIONS, sn._row, 'Item Started', new Date());
  return { ok: true };
}

/** Attach the Teams recording and transcript to the session. */
function apiAttachRecording_(body) {
  var me = requireStaff_(body.token);
  var sn = sessionFor_(body.meetingId);
  if (!sn) return { ok: false, error: 'This meeting has not been run yet.' };

  var rec = str_(body.recordingLink), tr = str_(body.transcriptLink);
  if (rec && !/^https?:\/\//i.test(rec)) return { ok: false, error: 'Paste a full recording link.' };
  if (tr && !/^https?:\/\//i.test(tr)) return { ok: false, error: 'Paste a full transcript link.' };

  setCell_(MEET.TAB_SESSIONS, sn._row, 'Recording Link', rec);
  setCell_(MEET.TAB_SESSIONS, sn._row, 'Transcript Link', tr);
  setCell_(MEET.TAB_SESSIONS, sn._row, 'Recording Note', str_(body.note));
  log_('attach-recording', me.name, me.role, str_(body.meetingId),
    (rec ? 'recording ' : '') + (tr ? 'transcript' : ''));
  return { ok: true };
}

/* ======================== contributions ======================== */
/*
 *  Signing in says you were there. A contribution says what you brought.
 *  Each one is stamped with the minute of the meeting it came at and the
 *  agenda item it came under, so the record reads in order afterwards
 *  rather than as a pile of notes.
 *
 *  Anyone signed in and present may log their own. Nobody may log one in
 *  somebody else's name — the server takes the author from the token, not
 *  from what the browser claims.
 */

function contribCard_(c) {
  return {
    id: str_(c['ID']),
    meetingId: str_(c['Meeting ID']),
    agendaId: str_(c['Agenda ID']),
    when: fmtStamp_(c['When']),
    time: fmtTime_(c['When']),
    offset: num_(c['Offset (min)']),
    email: low_(c['Email']),
    name: str_(c['Name']),
    role: low_(c['Role']),
    kind: str_(c['Kind']) || 'Point',
    body: str_(c['Body']),
    topics: str_(c['Topics']),
    visibility: cleanVisibility_(c['Visibility']),
    clipId: str_(c['Clip Upload ID']),
    edited: fmtStamp_(c['Edited'])
  };
}

function apiAddContribution_(body) {
  var me = requireUser_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };
  if (!canOpenMeeting_(me, m)) return { ok: false, error: 'That meeting no longer exists.' };

  var text = str_(body.body);
  if (text.length < 2) return { ok: false, error: 'Write what you want on the record.' };

  // You have to be in the room. The register already knows whether you are.
  var att = readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']) && low_(a['Email']) === me.email;
  })[0];
  if (!att || ['present', 'late'].indexOf(low_(att['Status'])) === -1) {
    return { ok: false, error: 'Sign in to the meeting first — that is what puts you in the room.' };
  }

  var sn = sessionFor_(m['ID']);
  var started = sn ? asDate_(sn['Started']) : null;
  var offset = started ? Math.round((Date.now() - started.getTime()) / 60000) : 0;

  var kind = CONTRIB_KINDS.indexOf(str_(body.kind)) > -1 ? str_(body.kind) : 'Point';
  var agendaId = str_(body.agendaId) || (sn ? str_(sn['Current Agenda ID']) : '');

  var id = uid_('CON');
  appendRow_(MEET.TAB_CONTRIB, {
    'ID': id, 'Meeting ID': str_(m['ID']), 'Agenda ID': agendaId, 'When': new Date(),
    'Offset (min)': offset, 'Email': me.email, 'Name': me.name, 'Role': me.role,
    'Kind': kind, 'Body': text, 'Topics': str_(body.topics),
    'Visibility': cleanVisibility_(body.visibility || 'all'),
    'Clip Upload ID': str_(body.clipId)
  });

  log_('contribution', me.name, me.role, str_(m['Ref']) || str_(m['ID']),
    kind + ': ' + text.slice(0, 60));
  return { ok: true, id: id };
}

/** Your own, or staff tidying the record. Editing stamps the edit. */
function apiEditContribution_(body) {
  var me = requireUser_(body.token);
  var row = readTab_(MEET.TAB_CONTRIB).filter(function (c) {
    return str_(c['ID']) === str_(body.id);
  })[0];
  if (!row) return { ok: false, error: 'That contribution is no longer there.' };
  if (low_(row['Email']) !== me.email && !isStaff_(me)) {
    return { ok: false, error: 'That is somebody else\'s contribution.' };
  }
  if (body.remove) {
    tab_(MEET.TAB_CONTRIB).deleteRow(row._row);
    log_('contribution-delete', me.name, me.role, str_(body.id), str_(row['Body']).slice(0, 60));
    return { ok: true, removed: true };
  }
  if (str_(body.body)) setCell_(MEET.TAB_CONTRIB, row._row, 'Body', str_(body.body));
  if (str_(body.kind) && CONTRIB_KINDS.indexOf(str_(body.kind)) > -1) {
    setCell_(MEET.TAB_CONTRIB, row._row, 'Kind', str_(body.kind));
  }
  if (body.topics !== undefined) setCell_(MEET.TAB_CONTRIB, row._row, 'Topics', str_(body.topics));
  if (body.visibility) setCell_(MEET.TAB_CONTRIB, row._row, 'Visibility', cleanVisibility_(body.visibility));
  setCell_(MEET.TAB_CONTRIB, row._row, 'Edited', new Date());
  log_('contribution-edit', me.name, me.role, str_(body.id), '');
  return { ok: true };
}

/** The floor of one meeting, in the order it happened. */
function contributionsFor_(m, person) {
  return readTab_(MEET.TAB_CONTRIB)
    .filter(function (c) { return str_(c['Meeting ID']) === str_(m['ID']); })
    .filter(function (c) { return canSee_(person, c['Visibility'], m); })
    .sort(function (a, b) {
      var da = asDate_(a['When']), db = asDate_(b['When']);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    })
    .map(contribCard_);
}

/** Who actually said something, and how much. Silence is visible too. */
function floorStats_(contribs, register) {
  var per = {};
  contribs.forEach(function (c) {
    if (!per[c.email]) per[c.email] = { email: c.email, name: c.name, role: c.role, count: 0, kinds: {} };
    per[c.email].count++;
    per[c.email].kinds[c.kind] = (per[c.email].kinds[c.kind] || 0) + 1;
  });

  var spoke = Object.keys(per).map(function (e) { return per[e]; })
    .sort(function (a, b) { return b.count - a.count; });

  var silent = [];
  if (register) {
    ['present', 'late'].forEach(function (g) {
      (register.groups[g] || []).forEach(function (p) {
        if (!per[p.email]) silent.push({ email: p.email, name: p.name, role: p.role });
      });
    });
    silent.sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  return { total: contribs.length, spoke: spoke, silent: silent };
}

/* ======================== topics ======================== */
/*
 *  The same subjects come back week after week — clawback, persistency,
 *  the 85-day report, fact find compliance, licensing. Without a shared
 *  vocabulary each meeting spells them differently and none of it joins up.
 *
 *  So topics are a controlled list the branch keeps, and a meeting, an
 *  agenda item or a contribution is tagged from it. The topic index then
 *  answers the question the minutes cannot: what has this branch actually
 *  said about clawback since March, and in which meetings.
 */

/* Seeded on first run from the subjects the branch's own minutes return to. */
var SEED_TOPICS = [
  ['Persistency', 'Quality of business', '2-year and 5-year, red/orange/green tracking'],
  ['Clawback', 'Quality of business', 'Dispatch inside the 20-business-day window'],
  ['Fact Find', 'Compliance', 'Schedule 11 — taken, retained, available for inspection'],
  ['85-Day Report', 'Retention', 'Standing item at every branch meeting'],
  ['Premium Due & Lapse', 'Retention', 'Escalation at day 45, 60 and 90'],
  ['Licensing', 'Compliance', 'Central Bank approvals by renewal month'],
  ['Outstanding Requirements', 'Operations', '5-day turnaround, 20-day file closure'],
  ['Attendance', 'Operations', 'The digital register'],
  ['Goal Planning', 'Performance', 'Submission and manager enforcement'],
  ['Recruiting', 'Manpower', 'Pipeline and selection'],
  ['Training & Development', 'Manpower', 'Coaching cadence and study requirements'],
  ['Digital Innovation', 'Strategy', 'Branch automation and the paperless branch'],
  ['Data Governance', 'Compliance', ''],
  ['Client Service', 'Client', 'Surveys, callbacks, servicing gaps'],
  ['Production & Quota', 'Performance', 'API against quota by unit and tenure']
];

function topicsSheetSeeded_() {
  var sh = tab_(MEET.TAB_TOPICS);
  if (sh.getLastRow() > 1) return;
  SEED_TOPICS.forEach(function (t) {
    appendRow_(MEET.TAB_TOPICS, {
      'ID': uid_('TOP'), 'Name': t[0], 'Category': t[1], 'Description': t[2],
      'Active': 'Y', 'Created By': 'setup', 'Created': new Date()
    });
  });
}

function topicList_() {
  topicsSheetSeeded_();
  return readTab_(MEET.TAB_TOPICS)
    .filter(function (t) { return yes_(t['Active']); })
    .map(function (t) {
      return { id: str_(t['ID']), name: str_(t['Name']), category: str_(t['Category']),
               description: str_(t['Description']) };
    })
    .sort(function (a, b) {
      return (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name);
    });
}

/** A tag cell holds names separated by commas. */
function tagsOf_(v) {
  return str_(v).split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
}

function apiTopics_(token) {
  var me = requireUser_(token);
  var topics = topicList_();

  var meetings = meetingRows_().filter(function (m) { return canOpenMeeting_(me, m); });
  var contribs = readTab_(MEET.TAB_CONTRIB);
  var agenda = readTab_(MEET.TAB_AGENDA);
  var open = {};
  meetings.forEach(function (m) { open[str_(m['ID'])] = m; });

  var counts = {};
  var bump = function (name, what) {
    var k = name.toLowerCase();
    if (!counts[k]) counts[k] = { meetings: {}, items: 0, contributions: 0 };
    if (what) counts[k][what]++;
  };

  meetings.forEach(function (m) {
    tagsOf_(m['Topics']).forEach(function (t) {
      bump(t); counts[t.toLowerCase()].meetings[str_(m['ID'])] = 1;
    });
  });
  agenda.forEach(function (a) {
    var m = open[str_(a['Meeting ID'])];
    if (!m || !canSee_(me, a['Visibility'], m)) return;
    tagsOf_(a['Topics'] || '').forEach(function (t) {
      bump(t, 'items'); counts[t.toLowerCase()].meetings[str_(a['Meeting ID'])] = 1;
    });
  });
  contribs.forEach(function (c) {
    var m = open[str_(c['Meeting ID'])];
    if (!m || !canSee_(me, c['Visibility'], m)) return;
    tagsOf_(c['Topics']).forEach(function (t) {
      bump(t, 'contributions'); counts[t.toLowerCase()].meetings[str_(c['Meeting ID'])] = 1;
    });
  });

  return {
    ok: true,
    canManage: isStaff_(me),
    kinds: CONTRIB_KINDS,
    topics: topics.map(function (t) {
      var c = counts[t.name.toLowerCase()] || { meetings: {}, items: 0, contributions: 0 };
      t.meetings = Object.keys(c.meetings).length;
      t.items = c.items;
      t.contributions = c.contributions;
      return t;
    })
  };
}

/** Everything the branch has said about one topic, newest first. */
function apiTopic_(token, name) {
  var me = requireUser_(token);
  var want = str_(name).toLowerCase();
  if (!want) return { ok: false, error: 'Pick a topic.' };

  var meetings = meetingRows_().filter(function (m) { return canOpenMeeting_(me, m); });
  var byId = {};
  meetings.forEach(function (m) { byId[str_(m['ID'])] = m; });

  var hasTag = function (v) {
    return tagsOf_(v).some(function (t) { return t.toLowerCase() === want; });
  };

  var out = [];
  meetings.forEach(function (m) {
    var items = readTab_(MEET.TAB_AGENDA).filter(function (a) {
      return str_(a['Meeting ID']) === str_(m['ID']) && hasTag(a['Topics'] || '') &&
             canSee_(me, a['Visibility'], m);
    });
    var says = readTab_(MEET.TAB_CONTRIB).filter(function (c) {
      return str_(c['Meeting ID']) === str_(m['ID']) && hasTag(c['Topics']) &&
             canSee_(me, c['Visibility'], m);
    });
    if (!hasTag(m['Topics']) && !items.length && !says.length) return;

    out.push({
      meeting: { id: str_(m['ID']), title: str_(m['Title']), type: str_(m['Type']),
                 date: fmtDate_(m['Date']), dateISO: iso_(asDate_(m['Date'])) },
      items: items.map(function (a) {
        return { title: str_(a['Title']), detail: str_(a['Detail']),
                 presenter: str_(a['Presenter Name']) };
      }),
      contributions: says.map(contribCard_)
    });
  });

  out.sort(function (a, b) {
    return (b.meeting.dateISO || '').localeCompare(a.meeting.dateISO || '');
  });

  log_('topic-read', me.name, me.role, str_(name), out.length + ' meeting(s)');
  return { ok: true, topic: str_(name), timeline: out, count: out.length };
}

function apiSaveTopic_(body) {
  var me = requireStaff_(body.token);
  var name = str_(body.name);
  if (!name) return { ok: false, error: 'Give the topic a name.' };
  topicsSheetSeeded_();

  var row = readTab_(MEET.TAB_TOPICS).filter(function (t) {
    return str_(t['ID']) === str_(body.id) ||
           (!str_(body.id) && str_(t['Name']).toLowerCase() === name.toLowerCase());
  })[0];

  if (row) {
    setCell_(MEET.TAB_TOPICS, row._row, 'Name', name);
    setCell_(MEET.TAB_TOPICS, row._row, 'Category', str_(body.category));
    setCell_(MEET.TAB_TOPICS, row._row, 'Description', str_(body.description));
    setCell_(MEET.TAB_TOPICS, row._row, 'Active', body.active === false ? 'N' : 'Y');
    log_('topic-edit', me.name, me.role, name, '');
    return { ok: true };
  }

  appendRow_(MEET.TAB_TOPICS, {
    'ID': uid_('TOP'), 'Name': name, 'Category': str_(body.category),
    'Description': str_(body.description), 'Active': 'Y',
    'Created By': me.email, 'Created': new Date()
  });
  log_('topic-new', me.name, me.role, name, '');
  return { ok: true };
}

/* ======================== short audio clips ======================== */
/*
 *  Not the meeting recording — Teams does that, and an eighty-minute file
 *  cannot be assembled inside Apps Script's memory. This is for a short
 *  capture: a decision as it was worded, an agent's contribution, a
 *  motivation segment worth keeping. It hangs off a contribution and lives
 *  in the same private Drive folder as everything else.
 */

function apiUploadClip_(body) {
  var me = requireUser_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };
  if (!canOpenMeeting_(me, m)) return { ok: false, error: 'That meeting no longer exists.' };

  var data = str_(body.data);
  if (!data) return { ok: false, error: 'Nothing was recorded.' };
  var comma = data.indexOf(',');
  var bytes;
  try { bytes = Utilities.base64Decode(comma > -1 ? data.slice(comma + 1) : data); }
  catch (err) { return { ok: false, error: 'That recording could not be read.' }; }

  if (bytes.length > MEET.MAX_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, error: 'That clip is too long. Keep it under ' +
      MEET.MAX_CLIP_MINUTES + ' minutes, or attach the Teams recording to the session instead.' };
  }

  var mime = str_(body.mime) || 'audio/webm';
  var stamp = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HHmm');
  var name = me.name + ' — ' + stamp + '.' + (mime.indexOf('mp4') > -1 ? 'm4a' : 'webm');

  var file = meetingFolder_(m).createFile(Utilities.newBlob(bytes, mime, name));
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);

  var id = uid_('UPL');
  appendRow_(MEET.TAB_UPLOADS, {
    'ID': id, 'Meeting ID': str_(m['ID']), 'Agenda ID': str_(body.agendaId),
    'Owner Email': me.email, 'Owner Name': me.name, 'Kind': 'audio',
    'File Name': name, 'File ID': file.getId(), 'Mime': mime, 'Size': bytes.length,
    'Visibility': cleanVisibility_(body.visibility || 'all'),
    'Summary': str_(body.summary) || 'Voice note', 'Uploaded': new Date()
  });

  log_('clip', me.name, me.role, str_(m['Ref']) || str_(m['ID']),
    Math.round(bytes.length / 1024) + ' KB');
  return { ok: true, id: id, name: name };
}

/* ======================== the searchable archive ======================== */
/*
 *  Registering a past meeting as a row with a Drive link is not much use:
 *  opening it needs Drive permission on the file, and nothing about it is
 *  searchable. So the archive pulls the WORDS out of each document and
 *  keeps them in the sheet. Once that is done the branch can search five
 *  months of minutes for "clawback" or "Fact Find" and get the meetings
 *  back, in the app, without anybody touching Drive.
 *
 *  Extraction goes through Drive's own converter: copy the .docx (or PDF,
 *  which is OCR'd on the way) into a Google Doc, read the text, throw the
 *  copy away. That happens over the REST API with the script's own token,
 *  so there is no advanced service to switch on by hand.
 *
 *  Past minutes name agents against persistency, clawback and licensing,
 *  so an indexed document is STAFF-ONLY until somebody decides otherwise.
 */

function archiveRows_() { return readTab_(MEET.TAB_ARCHIVE); }

/** All chunks of one document, stitched back into a single string. */
function archiveText_(rows) {
  return rows.sort(function (a, b) { return num_(a['Chunk']) - num_(b['Chunk']); })
             .map(function (r) { return str_(r['Text']); }).join('');
}

/** Group the chunk rows by document. */
function archiveDocs_() {
  var byId = {};
  archiveRows_().forEach(function (r) {
    var id = str_(r['ID']);
    if (!byId[id]) byId[id] = { id: id, meta: r, chunks: [] };
    byId[id].chunks.push(r);
  });
  return Object.keys(byId).map(function (id) { return byId[id]; });
}

function archiveCard_(doc) {
  var m = doc.meta;
  return {
    id: str_(m['ID']),
    meetingId: str_(m['Meeting ID']),
    title: str_(m['Title']),
    date: fmtDate_(m['Date']),
    dateISO: iso_(asDate_(m['Date'])),
    year: str_(m['Year']),
    type: str_(m['Type']),
    link: str_(m['Drive Link']),
    visibility: cleanVisibility_(m['Visibility']),
    words: num_(m['Words']),
    indexedAt: fmtStamp_(m['Indexed At'])
  };
}

/** Pull the text out of one Drive file. */
function extractText_(fileId, mime) {
  if (mime === 'application/vnd.google-apps.document') {
    return DocumentApp.openById(fileId).getBody().getText();
  }

  // Everything else goes through Drive's converter. A PDF is OCR'd on the
  // way, which is why scanned minutes end up searchable too.
  var res = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) +
    '/copy?fields=id&supportsAllDrives=true',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ mimeType: 'application/vnd.google-apps.document' }),
      muteHttpExceptions: true
    });

  if (res.getResponseCode() !== 200) {
    throw new Error('Could not read that document (' + res.getResponseCode() + ').');
  }

  var copyId = JSON.parse(res.getContentText()).id;
  try {
    return DocumentApp.openById(copyId).getBody().getText();
  } finally {
    // The converted copy is scratch. Leaving it behind would litter Drive
    // with a duplicate of every document in the archive.
    try { DriveApp.getFileById(copyId).setTrashed(true); } catch (err) { /* already gone */ }
  }
}

/** Write one document's text into the sheet, split across chunk rows. */
function storeText_(rec, text, actor) {
  var clean = String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  var words = clean ? clean.split(/\s+/).length : 0;
  var chunk = 1;

  for (var i = 0; i < clean.length || chunk === 1; i += MEET.CHUNK_CHARS) {
    appendRow_(MEET.TAB_ARCHIVE, {
      'ID': rec.id, 'Meeting ID': rec.meetingId, 'Title': rec.title, 'Date': rec.date,
      'Year': rec.year, 'Type': rec.type, 'Source File ID': rec.fileId,
      'Drive Link': rec.link, 'Visibility': rec.visibility,
      'Chunk': chunk, 'Text': clean.substr(i, MEET.CHUNK_CHARS),
      'Words': words, 'Indexed By': actor, 'Indexed At': new Date()
    });
    chunk++;
    if (!clean.length) break;
  }
  return words;
}

/** Index every meeting document that is registered but has no text yet.
 *  Safe to run repeatedly; it only ever picks up what is missing. */
function indexArchive() {
  var indexed = {};
  archiveRows_().forEach(function (r) { indexed[str_(r['Source File ID'])] = 1; });

  var pending = meetingRows_().filter(function (m) {
    var link = str_(m['Archive Link']);
    if (!link) return false;
    var id = fileIdFromUrl_(link);
    return id && !indexed[id];
  });

  var done = 0, failed = [];
  pending.slice(0, MEET.INDEX_BATCH).forEach(function (m) {
    var fileId = fileIdFromUrl_(str_(m['Archive Link']));
    try {
      var file = DriveApp.getFileById(fileId);
      var date = asDate_(m['Date']) || new Date();
      storeText_({
        id: uid_('ARC'), meetingId: str_(m['ID']), title: str_(m['Title']), date: date,
        year: Utilities.formatDate(date, tz_(), 'yyyy'), type: str_(m['Type']),
        fileId: fileId, link: str_(m['Archive Link']), visibility: 'staff'
      }, extractText_(fileId, file.getMimeType()), 'index');
      done++;
    } catch (err) {
      failed.push(str_(m['Title']) + ': ' + (err && err.message ? err.message : err));
    }
  });

  var left = Math.max(0, pending.length - MEET.INDEX_BATCH);
  log_('index-archive', 'system', '', done + ' indexed',
    left + ' still to do' + (failed.length ? ', ' + failed.length + ' failed' : ''));
  return { indexed: done, remaining: left, failed: failed };
}

/** "https://drive.google.com/file/d/FILEID/view" -> "FILEID" */
function fileIdFromUrl_(url) {
  var m = String(url || '').match(/\/d\/([A-Za-z0-9_-]{20,})/) ||
          String(url || '').match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : '';
}

/* ---- what the app calls ---- */

/** Browse: every indexed meeting the person may see, grouped by year. */
function apiArchive_(token) {
  var me = requireUser_(token);
  var m = null;
  var docs = archiveDocs_()
    .filter(function (d) { return canSee_(me, d.meta['Visibility'], m); })
    .map(archiveCard_);

  docs.sort(function (a, b) { return (b.dateISO || '').localeCompare(a.dateISO || ''); });

  var years = {}, types = {};
  docs.forEach(function (d) {
    years[d.year] = (years[d.year] || 0) + 1;
    types[d.type] = (types[d.type] || 0) + 1;
  });

  return {
    ok: true, user: publicUser_(me), documents: docs,
    years: Object.keys(years).sort().reverse().map(function (y) { return { year: y, count: years[y] }; }),
    types: Object.keys(types).sort().map(function (t) { return { type: t, count: types[t] }; }),
    canManage: isStaff_(me)
  };
}

/** Search the words of every meeting the person may see. */
function apiArchiveSearch_(token, q, year, type) {
  var me = requireUser_(token);
  var needle = str_(q).toLowerCase();
  if (needle.length < 2) return { ok: false, error: 'Type at least two characters to search.' };

  var results = [];
  archiveDocs_().forEach(function (d) {
    if (!canSee_(me, d.meta['Visibility'], null)) return;
    var card = archiveCard_(d);
    if (year && card.year !== str_(year)) return;
    if (type && card.type !== str_(type)) return;

    var text = archiveText_(d.chunks);
    var hay = text.toLowerCase();
    var titleHit = card.title.toLowerCase().indexOf(needle) > -1;

    var hits = [], at = hay.indexOf(needle);
    while (at > -1 && hits.length < 5) {
      hits.push(snippet_(text, at, needle.length));
      at = hay.indexOf(needle, at + needle.length);
    }

    // Total occurrences, so a meeting that discussed something at length
    // ranks above one that mentioned it once.
    var count = 0, scan = hay.indexOf(needle);
    while (scan > -1) { count++; scan = hay.indexOf(needle, scan + needle.length); }

    if (count || titleHit) {
      card.matches = count;
      card.inTitle = titleHit;
      card.snippets = hits;
      results.push(card);
    }
  });

  results.sort(function (a, b) {
    if (a.inTitle !== b.inTitle) return a.inTitle ? -1 : 1;
    return b.matches - a.matches;
  });

  log_('archive-search', me.name, me.role, needle, results.length + ' meeting(s)');
  return { ok: true, query: str_(q), results: results, count: results.length };
}

/** A readable line either side of the match, cut at word boundaries. */
function snippet_(text, at, len) {
  var from = Math.max(0, at - 110);
  var to = Math.min(text.length, at + len + 110);
  var out = text.substring(from, to).replace(/\s+/g, ' ').trim();
  if (from > 0) out = '…' + out.replace(/^\S+\s/, '');
  if (to < text.length) out = out.replace(/\s\S+$/, '') + '…';
  return out;
}

/** One document in full, for reading in the app. */
function apiArchiveDoc_(token, id) {
  var me = requireUser_(token);
  var doc = archiveDocs_().filter(function (d) { return d.id === str_(id); })[0];
  if (!doc) return { ok: false, error: 'That document is not in the archive.' };
  if (!canSee_(me, doc.meta['Visibility'], null)) {
    log_('denied', me.name, me.role, str_(id), 'Tried to open a staff-only archive document');
    return { ok: false, error: 'That document is not shared with you.' };
  }
  var card = archiveCard_(doc);
  card.text = archiveText_(doc.chunks);
  log_('archive-read', me.name, me.role, card.title, '');
  return { ok: true, document: card };
}

/** Staff adding a past meeting through the app: the file goes to Drive, the
 *  words go into the sheet, and it is searchable straight away. */
function apiArchiveUpload_(body) {
  var me = requireStaff_(body.token);
  var name = str_(body.name);
  var data = str_(body.data);
  if (!name || !data) return { ok: false, error: 'Choose a document to add.' };

  var comma = data.indexOf(',');
  var bytes;
  try { bytes = Utilities.base64Decode(comma > -1 ? data.slice(comma + 1) : data); }
  catch (err) { return { ok: false, error: 'That file could not be read.' }; }
  if (bytes.length > MEET.MAX_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, error: 'That file is over ' + MEET.MAX_UPLOAD_MB + ' MB.' };
  }

  var mime = str_(body.mime) || 'application/octet-stream';
  var folder = archiveFolder_();
  var file = folder.createFile(Utilities.newBlob(bytes, mime, name));
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);

  var date = asDate_(body.date) || dateFromName_(name) || new Date();
  var title = str_(body.title) || tidyName_(name.replace(/\.(docx?|pdf)$/i, ''));
  var type = MEETING_TYPES.indexOf(str_(body.type)) > -1 ? str_(body.type) : 'Branch Meeting';

  var text;
  try { text = extractText_(file.getId(), mime); }
  catch (err) {
    file.setTrashed(true);
    return { ok: false, error: 'Could not read the words out of that document. ' +
      'Word documents, Google Docs and PDFs work; other formats do not.' };
  }

  // A row on Meetings too, so a past meeting sits in the same list as
  // every other one rather than in a separate world.
  var meetingId = uid_('MTG');
  appendRow_(MEET.TAB_MEETINGS, {
    'ID': meetingId, 'Ref': 'RRB-ARCHIVE-' + Utilities.formatDate(date, tz_(), 'yyyy-MM-dd'),
    'Type': type, 'Title': title, 'Subtitle': 'Archived record', 'Week': weekOf_(date),
    'Date': date, 'Format': 'In-person', 'Location': MEET.BRANCH, 'Chair': MEET.ADMIN_EMAIL,
    'Status': 'closed', 'Minutes Status': 'published', 'Archive Link': file.getUrl(),
    'Purpose': 'Added to the archive from the app.', 'Created By': me.email,
    'Created': new Date(), 'Updated': new Date()
  });

  var words = storeText_({
    id: uid_('ARC'), meetingId: meetingId, title: title, date: date,
    year: Utilities.formatDate(date, tz_(), 'yyyy'), type: type,
    fileId: file.getId(), link: file.getUrl(),
    visibility: cleanVisibility_(body.visibility || 'staff')
  }, text, me.name);

  log_('archive-add', me.name, me.role, title, words + ' words indexed');
  return { ok: true, title: title, words: words, date: fmtDate_(date) };
}

/** One private folder for archived meeting documents. */
function archiveFolder_() {
  var root = materialsFolder_();
  var it = root.getFoldersByName('Past meetings');
  return it.hasNext() ? it.next() : root.createFolder('Past meetings');
}

/** Staff opening a past meeting up to the whole branch, or closing it again. */
function apiArchiveVisibility_(body) {
  var me = requireStaff_(body.token);
  var vis = cleanVisibility_(body.visibility);
  var rows = archiveRows_().filter(function (r) { return str_(r['ID']) === str_(body.id); });
  if (!rows.length) return { ok: false, error: 'That document is not in the archive.' };
  rows.forEach(function (r) { setCell_(MEET.TAB_ARCHIVE, r._row, 'Visibility', vis); });
  log_('archive-visibility', me.name, me.role, str_(rows[0]['Title']), 'Now ' + vis);
  return { ok: true, visibility: vis };
}

/** Staff removing a document from the archive. */
function apiArchiveDelete_(body) {
  var me = requireStaff_(body.token);
  var rows = archiveRows_().filter(function (r) { return str_(r['ID']) === str_(body.id); });
  if (!rows.length) return { ok: false, error: 'That document is not in the archive.' };
  var title = str_(rows[0]['Title']);
  // Bottom up: deleting a row shifts every row below it.
  rows.map(function (r) { return r._row; }).sort(function (a, b) { return b - a; })
      .forEach(function (rowIndex) { tab_(MEET.TAB_ARCHIVE).deleteRow(rowIndex); });
  log_('archive-delete', me.name, me.role, title, 'Removed from the archive');
  return { ok: true };
}

/** Index in the background, from the app, a batch at a time. */
function apiArchiveIndex_(body) {
  requireStaff_(body.token);
  var out = indexArchive();
  return { ok: true, indexed: out.indexed, remaining: out.remaining, failed: out.failed };
}

/* ======================== a sample meeting ======================== */
/*
 *  Signing in to an empty app shows nothing, and nothing is hard to judge.
 *  This builds one finished meeting — agenda with real clock times, a
 *  register with all five groups including no-entry, contributions on the
 *  floor, an action tracker and published minutes — so the branch can see
 *  the thing working before a real meeting depends on it.
 *
 *  It uses the real People tab, because a register full of invented names
 *  tells you nothing about how yours will look. Every row it writes is
 *  marked SAMPLE and removeSampleMeeting() takes all of it back out.
 */

var SAMPLE_TAG = 'SAMPLE';

function seedSampleMeeting() {
  if (meetingRows_().some(function (m) { return str_(m['Ref']) === 'RRB-SAMPLE'; })) {
    var msg = 'The sample meeting is already there. Run removeSampleMeeting() first if you want a fresh one.';
    Logger.log(msg);
    return msg;
  }

  var people = roster_();
  if (people.length < 4) {
    var warn = 'Put the branch on the People tab first — the sample builds its register from it.';
    Logger.log(warn);
    return warn;
  }

  var byRole = function (r) { return people.filter(function (p) { return p.role === r; }); };
  var manager = byRole('manager')[0] || people[0];
  var staff = byRole('staff');
  var agents = byRole('agent');

  // Last Wednesday, 9am — the branch's usual slot.
  var when = new Date();
  when.setDate(when.getDate() - ((when.getDay() + 4) % 7 || 7));
  when.setHours(0, 0, 0, 0);
  var start = new Date(when.getTime()); start.setHours(9, 0, 0, 0);

  var meetingId = uid_('MTG');
  appendRow_(MEET.TAB_MEETINGS, {
    'ID': meetingId, 'Ref': 'RRB-SAMPLE', 'Type': 'Branch Meeting',
    'Title': 'SAMPLE — Branch Meeting', 'Subtitle': 'Example data, safe to delete',
    'Week': weekOf_(when), 'Date': when, 'Start': '09:00', 'End': '10:00',
    'Format': 'In-person', 'Location': '9–13 Endeavour 1st Street, Chaguanas',
    'Chair': manager.email, 'Status': 'closed', 'Late After (min)': 10,
    'Minutes Status': 'published', 'Scope': 'branch',
    'Topics': 'Persistency, Clawback, Fact Find',
    'Mission Statement': 'We will deliver increased financial freedom for our clients ' +
      'through positive interaction powered by technology.',
    'Purpose': 'This meeting did not happen. It is example data so the branch can see ' +
      'the app working — the running order, the register, the floor, the tracker and the ' +
      'minutes — before a real meeting depends on it. The attendance below is invented. ' +
      'Remove it from the sheet menu when you have finished looking.',
    'Created By': SAMPLE_TAG, 'Created': new Date(), 'Updated': new Date()
  });

  // ---- the running order ----
  var agenda = [
    [0, 'Opening | Mission Statement | Moment of Silence', 5, manager, 'all', 'Standard opening.', ''],
    [0, 'Attendance Register Check', 5, manager, 'all', 'Everyone logs in before we open. The app is the register.', 'Attendance'],
    [0, 'Review of Minutes & Action Items Tracker', 10, manager, 'all', 'Carry-forward items first.', ''],
    [1, 'Correspondence & Administrative Reminders', 8, staff[0] || manager, 'all',
     'Reinstatement campaign extended to 30 September. Policy owner and payer must be the same person — applications are not accepted otherwise.', ''],
    [2, 'Persistency — 2-Year & 5-Year', 8, staff[1] || manager, 'staff',
     'Red / orange / green. The branch holds itself to 90% against the 75% threshold.', 'Persistency'],
    [2, 'Scripts & Clawback Report', 6, staff[1] || manager, 'staff',
     'Dispatch inside the 20-business-day window. Contracts returned for correction need Sales Admin emailed so the dispatch date is adjusted.', 'Clawback'],
    [2, '85-Day Premium Due & Lapse Activity', 8, staff[2] || manager, 'staff',
     'Standing item. Escalation at day 45, 60 and 90.', 'Premium Due & Lapse'],
    [4, 'Digital Innovation — Fact Find 360', 10, manager, 'all',
     'Digital needs analysis, client e-signature, manager approval queue. Schedule 11 requires a fact find be taken, retained and available for inspection.', 'Fact Find'],
    [6, 'Other Items', 5, null, 'all', '', ''],
    [7, 'Closing Remarks', 5, manager, 'all', '', '']
  ];

  var agendaRows = [], agendaIds = [];
  agenda.forEach(function (a, i) {
    var id = uid_('AGD');
    agendaIds.push(id);
    agendaRows.push({
      'ID': id, 'Meeting ID': meetingId, 'Order': (i + 1) * 10,
      'Section': SECTIONS[a[0]], 'Title': a[1], 'Detail': a[5],
      'Presenter Email': a[3] ? a[3].email : '', 'Presenter Name': a[3] ? a[3].name : '',
      'Allotted (min)': a[2], 'Visibility': a[4],
      'Materials Required': a[4] === 'staff' ? 'Y' : 'N',
      'Ready': a[4] === 'staff' ? 'Y' : 'N', 'Topics': a[6],
      'Status': 'Done', 'Created By': SAMPLE_TAG, 'Created': new Date()
    });
  });
  appendRows_(MEET.TAB_AGENDA, agendaRows);

  // ---- the register: present, late, excused, absent, and no entry at all ----
  var att = [], n = agents.length;
  var lateOne = agents[n - 1], excusedOne = agents[n - 2], absentOne = agents[n - 3];
  // The last two agents are left out entirely, so the no-entry group — the
  // observation the Q1 minutes record in its own right — is not empty.
  var noEntry = [agents[n - 4], agents[n - 5]].filter(Boolean);

  people.forEach(function (p) {
    if (noEntry.some(function (x) { return x.email === p.email; })) return;

    var row = { 'ID': uid_('ATT'), 'Meeting ID': meetingId, 'Email': p.email,
      'Name': p.name, 'Role': p.role, 'Unit': p.unit, 'Recorded By': SAMPLE_TAG };

    if (excusedOne && p.email === excusedOne.email) {
      row['Status'] = 'excused'; row['Method'] = 'self-excused';
      row['Signed In'] = new Date(start.getTime() - 3600000);
      row['Reason'] = 'Sick leave';
    } else if (absentOne && p.email === absentOne.email) {
      row['Status'] = 'absent'; row['Method'] = 'manual';
      row['Signed In'] = start; row['Reason'] = 'No reason logged';
    } else if (lateOne && p.email === lateOne.email) {
      row['Status'] = 'late'; row['Method'] = 'login';
      row['Signed In'] = new Date(start.getTime() + 26 * 60000);
      row['Minutes Late'] = 26;
      row['Reason'] = 'Traffic on the highway';
    } else {
      row['Status'] = 'present'; row['Method'] = 'login';
      row['Signed In'] = new Date(start.getTime() - Math.round(Math.random() * 12) * 60000);
      row['Minutes Late'] = 0;
    }
    att.push(row);
  });
  appendRows_(MEET.TAB_ATTENDANCE, att);

  // ---- one session, finished, running slightly over ----
  var allotted = agenda.reduce(function (t, a) { return t + a[2]; }, 0);
  appendRow_(MEET.TAB_SESSIONS, {
    'ID': uid_('SES'), 'Meeting ID': meetingId, 'Started': start, 'Started By': manager.name,
    'Ended': new Date(start.getTime() + (allotted + 12) * 60000), 'Ended By': manager.name,
    'Minutes Run': allotted + 12, 'Allotted': allotted, 'Notice Given': 'Y',
    'Recording Note': 'Example session — no recording attached.'
  });

  // ---- the floor ----
  var speak = function (who, mins, kind, body, topic, agIdx, vis) {
    return { 'ID': uid_('CON'), 'Meeting ID': meetingId, 'Agenda ID': agendaIds[agIdx],
      'When': new Date(start.getTime() + mins * 60000), 'Offset (min)': mins,
      'Email': who.email, 'Name': who.name, 'Role': who.role, 'Kind': kind,
      'Body': body, 'Topics': topic, 'Visibility': vis || 'all' };
  };
  var a0 = agents[0] || manager, a1 = agents[1] || manager, a2 = agents[2] || manager;
  appendRows_(MEET.TAB_CONTRIB, [
    speak(manager, 3, 'Point', 'Phones away for the next forty-five minutes, please.', '', 0),
    speak(a0, 22, 'Question', 'My five-year measure shows red. I settled two of those cases myself — can that be reconfirmed before it goes to the report?', 'Persistency', 4, 'staff'),
    speak(staff[1] || manager, 24, 'Answer', 'I will pull the underlying policies and come back by Friday.', 'Persistency', 4, 'staff'),
    speak(manager, 26, 'Decision', 'Any 5-year figure queried in this room gets reconfirmed before it goes on a report. Nobody is managed against a number we have not checked.', 'Persistency', 4, 'staff'),
    speak(a1, 40, 'Concern', 'Clients are still hitting the MyGG portal error on a first premium payment. Two this week.', '', 5),
    speak(manager, 42, 'Commitment', 'Send the screenshots today and I will escalate them together rather than one at a time.', '', 5),
    speak(a2, 55, 'Point', 'The fact find took about five minutes after the client meeting and the closing interview was far easier for it.', 'Fact Find', 7),
    speak(manager, 58, 'Decision', 'Fact Find 360 is the branch standard from Monday. Ask me if you want a walk-through.', 'Fact Find', 7)
  ]);

  // ---- the tracker ----
  var due = function (d) { var x = new Date(start.getTime()); x.setDate(x.getDate() + d); return fmtDate_(x); };
  appendRows_(MEET.TAB_ACTIONS, [
    { 'ID': uid_('ACT'), 'Meeting ID': meetingId, 'Item': 'Reconfirm the queried 5-year persistency figure',
      'Owner': (staff[1] || manager).name, 'Initiated By': a0.name, 'Due': due(3), 'Status': 'Open',
      'Notes': 'Raised on the floor', 'Origin Meeting': meetingId, 'Created': start, 'Created By': SAMPLE_TAG, 'Updated': start },
    { 'ID': uid_('ACT'), 'Meeting ID': meetingId, 'Item': 'Send MyGG portal screenshots for escalation',
      'Owner': 'All Agents', 'Initiated By': manager.name, 'Due': due(1), 'Status': 'Open',
      'Origin Meeting': meetingId, 'Created': start, 'Created By': SAMPLE_TAG, 'Updated': start },
    { 'ID': uid_('ACT'), 'Meeting ID': meetingId, 'Item': 'Adopt Fact Find 360 for client engagements',
      'Owner': 'All Agents', 'Initiated By': manager.name, 'Due': due(4), 'Status': 'In Progress',
      'Origin Meeting': meetingId, 'Created': start, 'Created By': SAMPLE_TAG, 'Updated': start },
    { 'ID': uid_('ACT'), 'Meeting ID': meetingId, 'Item': 'Submit weekly pulse reports',
      'Owner': 'All Agents', 'Initiated By': manager.name, 'Due': 'Weekly', 'Status': 'Standing',
      'Origin Meeting': meetingId, 'Created': start, 'Created By': SAMPLE_TAG, 'Updated': start },
    { 'ID': uid_('ACT'), 'Meeting ID': meetingId, 'Item': 'Chase the outstanding production letter sign-offs',
      'Owner': (staff[0] || manager).name, 'Initiated By': manager.name, 'Due': due(-6), 'Status': 'Open',
      'Notes': 'Deliberately overdue, so the tracker shows what overdue looks like',
      'Origin Meeting': meetingId, 'Created': start, 'Created By': SAMPLE_TAG, 'Updated': start }
  ]);

  // ---- minutes, drawn from the record ----
  var reg = register_({ ID: meetingId }, att);
  var names = function (l) { return l.length ? l.map(function (p) { return p.name; }).join('  |  ') : '—'; };
  appendRows_(MEET.TAB_MINUTES, [
    { 'ID': uid_('MIN'), 'Meeting ID': meetingId, 'Order': 10, 'Section': 'Purpose',
      'Visibility': 'all', 'Author': SAMPLE_TAG, 'Updated': new Date(),
      'Body': 'Example minutes. This meeting did not take place — the attendance and the ' +
        'contributions below are invented so the branch can see the finished shape of a record.' },
    { 'ID': uid_('MIN'), 'Meeting ID': meetingId, 'Order': 20,
      'Section': 'Attendance Record — Digital Register', 'Visibility': 'staff',
      'Author': SAMPLE_TAG, 'Updated': new Date(),
      'Body': 'Signing in to the meeting is the register.\n\n' +
        'PRESENT (' + reg.counts.present + ')\n' + names(reg.groups.present) + '\n\n' +
        'LATE (' + reg.counts.late + ')\n' + (reg.groups.late.map(function (p) {
          return p.name + ' — ' + p.late + ' min late (' + p.reason + ')'; }).join('\n') || '—') + '\n\n' +
        'EXCUSED (' + reg.counts.excused + ')\n' + (reg.groups.excused.map(function (p) {
          return p.name + ' — ' + p.reason; }).join('\n') || '—') + '\n\n' +
        'ABSENT (' + reg.counts.absent + ')\n' + (reg.groups.absent.map(function (p) {
          return p.name + ' — ' + p.reason; }).join('\n') || '—') + '\n\n' +
        'NO ENTRY IN THE REGISTER (' + reg.counts.noEntry + ')\n' + names(reg.groups.noEntry) + '\n' +
        'Neither present, absent, excused nor late. Signing in is the branch standard for a ' +
        'scheduled meeting; where an active agent has not engaged with it, that is recorded as a ' +
        'factual observation of the record and carried to the one-on-one with their manager.\n\n' +
        'Roll: ' + reg.counts.roll + '  |  In the room: ' + reg.counts.here +
        '  |  Engagement: ' + reg.counts.rate + '%' },
    { 'ID': uid_('MIN'), 'Meeting ID': meetingId, 'Order': 30, 'Section': 'Persistency',
      'Visibility': 'staff', 'Author': SAMPLE_TAG, 'Updated': new Date(),
      'Body': 'Reviewed on the red / orange / green tracking. A queried 5-year figure is to be ' +
        'reconfirmed before it goes on a report — the branch does not manage anyone against a ' +
        'number it has not checked. Internal target remains 90% against the 75% threshold.' },
    { 'ID': uid_('MIN'), 'Meeting ID': meetingId, 'Order': 40, 'Section': 'Digital Innovation',
      'Visibility': 'all', 'Author': SAMPLE_TAG, 'Updated': new Date(),
      'Body': 'Fact Find 360 becomes the branch standard. Schedule 11 of the Insurance Act ' +
        'requires that a fact find be taken, retained and available for inspection; this is the ' +
        'branch’s mechanism for meeting that consistently.' },
    { 'ID': uid_('MIN'), 'Meeting ID': meetingId, 'Order': 50, 'Section': 'Closing',
      'Visibility': 'all', 'Author': SAMPLE_TAG, 'Updated': new Date(),
      'Body': 'Meeting closed. Ran ' + (allotted + 12) + ' minutes against ' + allotted + ' allotted.' }
  ]);

  log_('seed-sample', SAMPLE_TAG, '', 'RRB-SAMPLE',
    agendaRows.length + ' agenda items, ' + att.length + ' on the register');

  var out = 'Sample meeting created.\n' +
    agendaRows.length + ' agenda items · ' + att.length + ' on the register (' +
    reg.counts.present + ' present, ' + reg.counts.late + ' late, ' + reg.counts.excused +
    ' excused, ' + reg.counts.absent + ' absent, ' + reg.counts.noEntry + ' no entry) · ' +
    '8 contributions · 5 action items · 5 minute sections.\n\n' +
    'Open the app and it is at the top of the list. Remove it with ' +
    'removeSampleMeeting() or from the Branch Meetings menu.';
  Logger.log(out);
  return out;
}

function seedSampleMeetingFromMenu() {
  SpreadsheetApp.getUi().alert(seedSampleMeeting());
}

/** Take every sample row back out, leaving real meetings untouched. */
function removeSampleMeeting() {
  var m = meetingRows_().filter(function (x) { return str_(x['Ref']) === 'RRB-SAMPLE'; })[0];
  if (!m) { Logger.log('No sample meeting to remove.'); return 'No sample meeting to remove.'; }
  var id = str_(m['ID']);

  var removed = 0;
  [MEET.TAB_AGENDA, MEET.TAB_ATTENDANCE, MEET.TAB_ACTIONS, MEET.TAB_MINUTES,
   MEET.TAB_CONTRIB, MEET.TAB_SESSIONS, MEET.TAB_UPLOADS].forEach(function (t) {
    var rows = readTab_(t).filter(function (r) { return str_(r['Meeting ID']) === id; });
    // Bottom up: deleting a row shifts every row beneath it.
    rows.map(function (r) { return r._row; }).sort(function (a, b) { return b - a; })
        .forEach(function (n) { tab_(t).deleteRow(n); removed++; });
  });
  tab_(MEET.TAB_MEETINGS).deleteRow(m._row);

  log_('remove-sample', SAMPLE_TAG, '', 'RRB-SAMPLE', removed + ' rows removed');
  var out = 'Sample meeting removed — ' + removed + ' rows, plus the meeting itself.';
  Logger.log(out);
  return out;
}

function removeSampleMeetingFromMenu() {
  SpreadsheetApp.getUi().alert(removeSampleMeeting());
}

/* ======================== the log ======================== */

function apiLog_(token, limit) {
  requireStaff_(token);
  var rows = readTab_(MEET.TAB_LOG);
  return {
    ok: true,
    entries: rows.slice(-(num_(limit) || 200)).reverse().map(function (r) {
      return { when: fmtStamp_(r['Timestamp']), actor: str_(r['Actor']), role: str_(r['Role']),
               action: str_(r['Action']), target: str_(r['Target']), details: str_(r['Details']) };
    })
  };
}

/** Everything the app needs to draw its home screen in one call. */
function apiHome_(token) {
  var me = requireUser_(token);
  var list = apiMeetings_(token);
  var actions = apiActions_(token, '');

  var now = Date.now();
  var next = null, live = null;
  list.meetings.forEach(function (c) {
    if (c.status === 'live') { if (!live) live = c; return; }
    if (c.status === 'scheduled' && !c.past) {
      var t = c.dateISO ? new Date(c.dateISO).getTime() : 0;
      if (t >= now - 86400000 && (!next || t < new Date(next.dateISO).getTime())) next = c;
    }
  });

  var out = {
    ok: true, user: publicUser_(me), meetings: list.meetings,
    next: live || next, actions: actions.actions, actionCounts: actions.counts,
    types: MEETING_TYPES, sections: SECTIONS, statuses: ACTION_STATUSES,
    scopes: MEETING_SCOPES, kinds: CONTRIB_KINDS,
    topicList: topicList_().map(function (t) { return t.name; })
  };

  if (isStaff_(me)) {
    out.people = readPeople_().filter(function (p) { return p.active; })
      .map(function (p) { return { email: p.email, name: p.name, role: p.role, unit: p.unit }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  return out;
}

/* ======================== the API ======================== */
/*
 *  Everything that only reads goes through doGet; everything that
 *  changes something goes through doPost. The token identifies the
 *  person on every single call — there is no request anywhere in this
 *  file that trusts what the browser says about who it is.
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try {
    switch (str_(p.action) || 'home') {
      case 'home':       out = apiHome_(p.token); break;
      case 'meetings':   out = apiMeetings_(p.token); break;
      case 'meeting':    out = apiMeeting_(p.token, p.id); break;
      case 'register':   out = apiRegister_(p.token, p.id); break;
      case 'attendance': out = apiAttendanceHistory_(p.token); break;
      case 'prep':       out = apiPrep_(p.token, p.id); break;
      case 'actions':    out = apiActions_(p.token, p.id); break;
      case 'file':       out = apiFile_(p.token, p.id); break;
      case 'people':     out = apiPeople_(p.token); break;
      case 'archive':    out = apiArchive_(p.token); break;
      case 'topics':     out = apiTopics_(p.token); break;
      case 'topic':      out = apiTopic_(p.token, p.name); break;
      case 'search':     out = apiArchiveSearch_(p.token, p.q, p.year, p.type); break;
      case 'document':   out = apiArchiveDoc_(p.token, p.id); break;
      case 'log':        out = apiLog_(p.token, p.limit); break;
      case 'ping':       out = { ok: true, app: 'Branch Meeting Builder', branch: MEET.BRANCH }; break;
      default:           out = { ok: false, error: 'Unknown action.' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return json_(out);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'That request could not be read.' }); }

  var out;
  try {
    switch (str_(body.action)) {
      case 'enrol':          out = apiEnrol_(body); break;
      case 'login':          out = apiLogin_(body); break;
      case 'signOut':        out = apiSignOut_(body); break;
      case 'changePin':      out = apiChangePin_(body); break;
      case 'resetPin':       out = apiResetPin_(body); break;

      case 'checkIn':        out = apiCheckIn_(body); break;
      case 'excuse':         out = apiExcuse_(body); break;
      case 'markAttendance': out = apiMarkAttendance_(body); break;

      case 'saveMeeting':    out = apiSaveMeeting_(body); break;
      case 'meetingStatus':  out = apiSetMeetingStatus_(body); break;
      case 'saveAgenda':     out = apiSaveAgenda_(body); break;
      case 'deleteAgenda':   out = apiDeleteAgenda_(body); break;
      case 'reorderAgenda':  out = apiReorderAgenda_(body); break;
      case 'seedAgenda':     out = apiSeedAgenda_(body); break;

      case 'upload':         out = apiUpload_(body); break;
      case 'deleteUpload':   out = apiDeleteUpload_(body); break;
      case 'reviewUpload':   out = apiReviewUpload_(body); break;

      case 'saveAction':     out = apiSaveAction_(body); break;
      case 'deleteAction':   out = apiDeleteAction_(body); break;
      case 'carryForward':   out = apiCarryForward_(body); break;

      case 'saveMinutes':    out = apiSaveMinutes_(body); break;
      case 'deleteMinute':   out = apiDeleteMinute_(body); break;
      case 'publishMinutes': out = apiPublishMinutes_(body); break;
      case 'minutesDraft':   out = apiMinutesDraft_(body); break;

      case 'savePerson':     out = apiSavePerson_(body); break;

      case 'archiveUpload':     out = apiArchiveUpload_(body); break;
      case 'archiveVisibility': out = apiArchiveVisibility_(body); break;
      case 'archiveDelete':     out = apiArchiveDelete_(body); break;
      case 'archiveIndex':      out = apiArchiveIndex_(body); break;

      case 'startSession':      out = apiStartSession_(body); break;
      case 'endSession':        out = apiEndSession_(body); break;
      case 'currentItem':       out = apiSetCurrentItem_(body); break;
      case 'attachRecording':   out = apiAttachRecording_(body); break;

      case 'contribute':        out = apiAddContribution_(body); break;
      case 'editContribution':  out = apiEditContribution_(body); break;
      case 'uploadClip':        out = apiUploadClip_(body); break;

      case 'saveTopic':         out = apiSaveTopic_(body); break;

      default:               out = { ok: false, error: 'Unknown action.' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ======================== menu ======================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Branch Meetings')
    .addItem('⚙️  Set up / repair tabs', 'setupMeetingsFromMenu')
    .addItem('📥  Import the meeting archive', 'promptImportArchive')
    .addItem('🔎  Index the archive for searching', 'promptIndexArchive')
    .addSeparator()
    .addItem('🧪  Create a sample meeting', 'seedSampleMeetingFromMenu')
    .addItem('🗑️  Remove the sample meeting', 'removeSampleMeetingFromMenu')
    .addSeparator()
    .addItem('🔗  Show the app URL', 'showAppUrl')
    .addToUi();
}

function promptImportArchive() {
  var ui = SpreadsheetApp.getUi();
  var saved = PropertiesService.getScriptProperties().getProperty('ARCHIVE_FOLDER_ID') || '';
  var res = ui.prompt('Import the meeting archive',
    'Paste the Drive folder id(s) holding the past meeting documents.\n' +
    'More than one folder? Separate them with a comma — duplicates across\n' +
    'folders are registered once.' +
    (saved ? '\n\n(Last used: ' + saved + ')' : ''), ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var id = res.getResponseText().trim() || saved;
  if (!id) return;
  var out = importArchive(id);
  ui.alert('Archive imported.\n\n' + out.added + ' meeting(s) added, ' +
    out.skipped + ' skipped (already here, or not a meeting document).\n\n' +
    'They are listed now, but not yet searchable. Run ' +
    '"Index the archive for searching" next to read the words out of each ' +
    'document — that is what makes the search work.');
}

function promptIndexArchive() {
  var out = indexArchive();
  // Menu-only, for the same reason as setupMeetingsFromMenu. Run
  // indexArchive() directly from the editor and read the log.
  SpreadsheetApp.getUi().alert('Archive indexing\n\n' +
    out.indexed + ' meeting(s) read and made searchable.\n' +
    (out.remaining
      ? out.remaining + ' still to do — run this again to continue. ' +
        'It works in batches so it never runs past the execution limit.'
      : 'Nothing left to index.') +
    (out.failed.length ? '\n\nCould not read:\n' + out.failed.join('\n') : ''));
}

function showAppUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('Branch Meeting Builder\n\n' +
    (url ? url : 'Not deployed yet — Deploy > New deployment > Web app.') +
    '\n\nPaste this into CONFIG.API_URL in meetings/index.html.');
}
