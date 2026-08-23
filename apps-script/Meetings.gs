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
  TAB_LOG:        'Log'
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
                     'One-on-One', 'Quarterly Review', 'Resolution Meeting', 'Training Session'];

/* Action item statuses, in the branch's own wording. */
var ACTION_STATUSES = ['Not Started', 'Open', 'In Progress', 'Overdue', 'Standing', 'Complete'];

var SCHEMA = {
  People: ['Email', 'Name', 'Role', 'Unit', 'Active', 'PIN Hash', 'Salt', 'Token',
           'Attempts', 'Locked Until', 'Added', 'Added By', 'Last Seen'],

  Meetings: ['ID', 'Ref', 'Type', 'Title', 'Subtitle', 'Week', 'Date', 'Start', 'End', 'Format',
             'Location', 'Chair', 'Guest', 'Status', 'Check-In Opens', 'Check-In Closes',
             'Late After (min)', 'Materials Due', 'Pre-Read', 'Anchor Document', 'Mission Statement',
             'Purpose', 'Minutes Status', 'Archive Link', 'Created By', 'Created', 'Updated'],

  Agenda: ['ID', 'Meeting ID', 'Order', 'Section', 'Title', 'Detail', 'Presenter Email',
           'Presenter Name', 'Allotted (min)', 'Visibility', 'Materials Required', 'Ready',
           'Ready At', 'Reviewed By', 'Status', 'Created By', 'Created'],

  Uploads: ['ID', 'Meeting ID', 'Agenda ID', 'Owner Email', 'Owner Name', 'Kind', 'File Name',
            'File ID', 'Link', 'Mime', 'Size', 'Visibility', 'Summary', 'Reviewed By',
            'Reviewed At', 'Uploaded'],

  Attendance: ['ID', 'Meeting ID', 'Email', 'Name', 'Role', 'Unit', 'Status', 'Method',
               'Signed In', 'Minutes Late', 'Reason', 'Recorded By', 'Device'],

  Actions: ['ID', 'Meeting ID', 'Item', 'Owner', 'Initiated By', 'Due', 'Status', 'Priority',
            'Notes', 'Origin Meeting', 'Created', 'Created By', 'Updated', 'Completed'],

  Minutes: ['ID', 'Meeting ID', 'Order', 'Section', 'Body', 'Visibility', 'Author', 'Updated'],

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

  // Seed the branch manager so there is always one way in.
  var people = readPeople_();
  var admin = String(MEET.ADMIN_EMAIL || '').trim().toLowerCase();
  if (admin && !people.some(function (p) { return p.email === admin; })) {
    tab_(MEET.TAB_PEOPLE).appendRow([admin, MEET.ADMIN_NAME, 'manager', 'Branch', 'Y',
      '', '', '', 0, '', new Date(), 'setup', '']);
  }

  log_('setup', 'system', '', 'Meeting Builder set up', 'Tabs, Drive folder and manager seeded');

  SpreadsheetApp.getUi().alert(
    'Branch Meeting Builder is ready.\n\n' +
    'Tabs created: ' + Object.keys(SCHEMA).join(', ') + '\n' +
    'Materials folder: ' + materialsFolder_().getName() + '\n\n' +
    'Next: Deploy > New deployment > Web app (Execute as: Me, Access: Anyone), ' +
    'then paste the /exec URL into CONFIG.API_URL in meetings/index.html.');
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

  var rows = meetingRows_().filter(function (m) {
    var st = low_(m['Status']) || 'draft';
    if (st === 'draft' || st === 'cancelled') return isStaff_(me);
    return true;
  });

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
  var st = low_(m['Status']) || 'draft';
  if ((st === 'draft' || st === 'cancelled') && !isStaff_(me)) {
    return { ok: false, error: 'That meeting is not open yet.' };
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

  var out = {
    ok: true, user: publicUser_(me), meeting: card,
    agenda: visibleAgenda, actions: actions, minutes: minutes,
    minutesPublished: minutesPublished,
    sections: SECTIONS
  };

  // The register itself is staff material. An agent sees that they
  // are counted, never who else was or was not there.
  if (isStaff_(me)) out.register = register_(m, att);
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
  var meetings = meetingRows_().filter(function (m) {
    var st = low_(m['Status']);
    return st !== 'draft' && st !== 'cancelled';
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
    types: MEETING_TYPES, sections: SECTIONS, statuses: ACTION_STATUSES
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
    .addItem('⚙️  Set up / repair tabs', 'setupMeetings')
    .addItem('📥  Import the meeting archive', 'promptImportArchive')
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
    out.skipped + ' already in the app.');
}

function showAppUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('Branch Meeting Builder\n\n' +
    (url ? url : 'Not deployed yet — Deploy > New deployment > Web app.') +
    '\n\nPaste this into CONFIG.API_URL in meetings/index.html.');
}
