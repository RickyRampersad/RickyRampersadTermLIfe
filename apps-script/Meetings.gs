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

     The real value lives in Script Properties, not here, for two
     reasons. This file sits in a public repository, so anything
     committed here is public. And the check runs inside doPost, which
     serves a PINNED SNAPSHOT of the code — editing this line and saving
     changes nothing until a new version is deployed, which is a trap
     that costs an afternoon. A property is read live.

     Set it from the sheet: Branch Meetings → Set the branch code. This
     line is only the fallback, used until a property exists. */
  JOIN_CODE: 'CHANGE-ME-from-the-Branch-Meetings-menu',

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
  TAB_ROTA:       'Rota',
  TAB_KPI:        'KPI',
  TAB_LOG:        'Log',

  /*  THE BRANCH MEETS ON A WEDNESDAY MORNING. 0 is Sunday, so 3 is
   *  Wednesday. The daily note counts down to the next one and changes
   *  what it asks for as the day gets closer. */
  MEETING_DAY: 3,
  MEETING_TIME: '9:00 AM',

  /*  Materials are due the evening before, which is the only deadline
   *  that has ever worked: a deadline on the morning of a meeting is a
   *  deadline nobody can act on once they have missed it. */
  MATERIALS_DUE_DAYS_BEFORE: 1,

  /*  The daily note goes out on working mornings only. A note on a
   *  Saturday is a note that teaches people to ignore the notes. */
  NOTE_HOUR: 7,

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
 *    branch      Everyone on the roll. The weekly branch meeting.
 *    unit        One unit only, named in the meeting's Unit column, plus
 *                staff and the manager. Akaash's unit meeting is not
 *                Gary's unit's business and never appears in their list.
 *    staff       Staff and the manager. Agents never see it — not the
 *                meeting, not the register, not that it happened.
 *    invited     Only the people named in Participants, plus the chair
 *                and the manager. The scope for a working group, a
 *                disciplinary, or anything else that is nobody else's.
 *    one-to-one  The two people in the room, plus the branch manager. A
 *                manager reviewing an agent's persistency is not branch
 *                business.
 *    client      The agent whose client it is, plus the branch manager.
 *                These carry client detail, and the branch's standing rule
 *                is that client information travels no further than it has
 *                to.
 *
 *  SCOPE ALSO DECIDES THE ROLL. rosterFor_ reads it to work out who was
 *  expected, and the register is measured against that — so closing a
 *  unit meeting of eight marks eight people, not the twenty-five who
 *  were never invited. Getting this wrong would have written a false
 *  absence onto most of the branch every time a unit met.
 */
var MEETING_SCOPES = ['branch', 'unit', 'staff', 'invited', 'one-to-one', 'client'];

/*  A meeting's type implies its scope, so the chair does not have to set
 *  both and cannot forget the second. It is a DEFAULT, applied only when
 *  no scope has been chosen — never a lock. */
var SCOPE_BY_TYPE = {
  'managers meeting': 'staff',
  'staff meeting': 'staff',
  'one-on-one': 'one-to-one',
  'client meeting': 'client'
};

function defaultScopeFor_(type) {
  return SCOPE_BY_TYPE[low_(type)] || 'branch';
}

function cleanScope_(v) {
  v = low_(v);
  return MEETING_SCOPES.indexOf(v) === -1 ? 'branch' : v;
}

/* What a person may log during a meeting. */
var CONTRIB_KINDS = ['Point', 'Question', 'Answer', 'Decision', 'Concern', 'Commitment', 'Apology'];

/* Action item statuses, in the branch's own wording. */
var ACTION_STATUSES = ['Not Started', 'Open', 'In Progress', 'Overdue', 'Standing', 'Complete'];

/*  EVERYBODY IN THE ROOM HOLDS A ROLE.
 *
 *  Three of these are standing roles on the People tab. The fourth,
 *  presenter, is not stored anywhere: you hold it for one meeting
 *  because the agenda names you against an item, and you stop holding
 *  it when that meeting closes. Storing it would mean maintaining it,
 *  and a stored list of presenters goes stale the first time an item
 *  changes hands.
 *
 *  GUEST is a standing role and is deliberately NOT on the roll.
 *  Head office visitors sat in the 30 July meeting — the President and
 *  two VPs — and a guest who does not sign in has not missed a branch
 *  meeting they were contracted to attend. roster_() is the
 *  denominator the register is measured against, and letting guests
 *  into it would mark three executives absent and quietly drop the
 *  branch's attendance rate for a month.
 */
var ROLES = ['manager', 'staff', 'agent', 'guest'];

/** The role a person holds FOR ONE MEETING, which is not always the
 *  role on their People row. The chair of this meeting and a presenter
 *  on this agenda both need their own view of it. */
function roleInMeeting_(m, person, agenda) {
  if (!person) return '';
  if (m && low_(m['Chair']) === person.email) return 'chair';
  agenda = agenda || readTab_(MEET.TAB_AGENDA).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });
  var presents = agenda.some(function (a) {
    return low_(a['Presenter Email']) === person.email;
  });
  if (presents) return 'presenter';
  return person.role;
}

/*  WHY YOU COULD NOT COME, FROM A LIST RATHER THAN A BOX.
 *
 *  Decided 6 October 2026, with the JotForm register disbanded. A
 *  free-text box gives "personal", "busy" and "sorry" — three words
 *  that cannot be counted, so nobody ever learns which reason is the
 *  one worth fixing. A fixed list can be counted on the wall the
 *  same evening, and after a term the branch can see whether it is
 *  losing the room to client appointments or to the hour it meets.
 *
 *  Keep this list short. Every reason added is a column on a wall
 *  that has to stay readable from across a room, and a list long
 *  enough to need scrolling is a list people pick the first item
 *  from. 'Something else' carries a note so nothing is forced into
 *  the wrong box, and the note is the only free text an apology has.
 */
var APOLOGY_REASONS = [
  'With a client',
  'Client appointment I could not move',
  'On a medical or hospital visit',
  'Unwell',
  'Family or personal emergency',
  'On leave or out of the country',
  'Training or an exam',
  'At head office or another branch',
  'Travel or transport problem',
  'Something else'
];

/* The one reason that may carry a note, and the only free text an
   apology accepts. Everything else is picked, so everything else
   can be counted. */
var APOLOGY_OTHER = 'Something else';

var SCHEMA = {
  /*  Access Code is the agent's own branch portfolio code — the same
   *  code they already use for the agent portal. The meeting door
   *  takes it instead of asking them to invent and remember a second
   *  secret, because a PIN nobody can remember is a person who does
   *  not sign in, and from 6 October 2026 a person who does not sign
   *  in is absent. PIN Hash stays for anyone enrolled before that
   *  and for staff who have no portfolio code. */
  People: ['Agent No', 'Email', 'Name', 'Role', 'Unit', 'Active', 'Access Code', 'PIN Hash', 'Salt',
           'Token', 'Attempts', 'Locked Until', 'Added', 'Added By', 'Last Seen'],

  Meetings: ['ID', 'Ref', 'Type', 'Title', 'Subtitle', 'Week', 'Date', 'Start', 'End', 'Format',
             'Location', 'Chair', 'Guest', 'Status', 'Check-In Opens', 'Check-In Closes',
             'Late After (min)', 'Materials Due', 'Pre-Read', 'Anchor Document', 'Mission Statement',
             'Purpose', 'Minutes Status', 'Archive Link', 'Scope', 'Participants',
             'Client Ref', 'Topics', 'Unit', 'Created By', 'Created', 'Updated'],

  Agenda: ['ID', 'Meeting ID', 'Order', 'Section', 'Title', 'Detail', 'Presenter Email',
           'Presenter Name', 'Allotted (min)', 'Visibility', 'Materials Required', 'Ready',
           'Ready At', 'Reviewed By', 'Topics', 'Status', 'Created By', 'Created'],

  Uploads: ['ID', 'Meeting ID', 'Agenda ID', 'Owner Email', 'Owner Name', 'Kind', 'File Name',
            'File ID', 'Link', 'Mime', 'Size', 'Visibility', 'Summary', 'Reviewed By',
            'Reviewed At', 'Uploaded'],

  /*  Reason holds one of APOLOGY_REASONS and nothing else, so it can
   *  be counted. Note is the free text that only 'Something else'
   *  carries. Keeping them apart is what lets the wall chart the
   *  reasons without a human reading every row first. */
  /*  WHO OWNS WHICH STANDING ITEM, SO THE CHAIR DOES NOT.
   *
   *  Cadence says how the presenter is decided each time a meeting is
   *  built:
   *    fixed    the named Owner, every time
   *    rotate   the next agent in the rotation — whoever has presented
   *             least recently, so it comes round the room rather than
   *             landing on whoever is willing
   *    chair    the chair of that meeting
   *
   *  Backup is who takes it when the owner apologises. On 7 August a
   *  report was "presented on her behalf" because its owner was away
   *  and nobody else held it; naming a backup is how that stops being
   *  a surprise on the day.                                          */
  /*  ONE ROW PER PERSON PER MEASURE. Deliberately long and thin rather
   *  than a column per KPI, because the branch's measures change — the
   *  minutes from July to September alone talk about fact finds,
   *  persistency, scripts, contracts, 75-day responses and licensing —
   *  and a shape that needs a new column every time one changes is a
   *  shape nobody maintains.
   *
   *  Filled from wherever the branch already has the number: a paste, an
   *  IMPORTRANGE, or a Salesforce pull. The daily note reads whatever is
   *  here and says nothing when a person has no rows, rather than
   *  inventing a figure to fill a space.                               */
  /*  Link is the wall this measure is actually read off — one of the five
   *  Intelligence Wall boards, or any page that shows the working behind
   *  the number. A KPI with no way to see what sits underneath it is a
   *  number people argue with; a KPI that opens the wall is one they go
   *  and work. It is surfaced in the daily note and beside the measure in
   *  the app, so nobody has to be told the address.                     */
  KPI: ['Agent No', 'Email', 'Name', 'Measure', 'Value', 'Target', 'Unit',
        'Direction', 'As Of', 'Note', 'Link', 'Active'],

  Rota: ['Order', 'Section', 'Item', 'Detail', 'Minutes', 'Visibility',
         'Cadence', 'Owner', 'Owner Email', 'Backup', 'Backup Email', 'Active', 'Notes'],

  Attendance: ['ID', 'Meeting ID', 'Email', 'Name', 'Role', 'Unit', 'Status', 'Method',
               'Signed In', 'Minutes Late', 'Reason', 'Note', 'Recorded By', 'Device'],

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

  /*  ONE ROW PER PERSON PER BLOCK PER DAY. Two rows a day each, so a
   *  branch of 28 writes about 280 rows a week — long and thin on
   *  purpose, because the categories change and a column per activity
   *  is a shape nobody maintains.
   *
   *  Items is a comma-joined list of activity keys. Went Well and In
   *  The Way are the only free text, capped at 500 characters each,
   *  and they are the part a human reads before a Wednesday.        */
  Activity: ['ID', 'Day', 'Block', 'Email', 'Name', 'Role', 'Unit', 'Token',
             'Sent', 'Opened', 'Answered', 'Items', 'Went Well', 'In The Way'],

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
    /*  Written by header, never by position. This was a positional
     *  appendRow until the Agent No column went in front of Email, at
     *  which point it would have put the manager's address in the
     *  agent-number cell and locked out the one person who can fix
     *  it. appendRow_ maps to the headers as they actually are.     */
    appendRow_(MEET.TAB_PEOPLE, {
      'Email': admin, 'Name': MEET.ADMIN_NAME, 'Role': 'manager', 'Unit': 'Branch',
      'Active': 'Y', 'Attempts': 0, 'Added': new Date(), 'Added By': 'setup'
    });
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
    'then paste the /exec URL into CONFIG.API_URL in meetings/index.html.';
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

/** The branch code people type once when setting a PIN. Script Properties
 *  first, so changing it takes effect immediately; the constant is only the
 *  fallback for a script that has never had one set. */
function joinCode_() {
  var v = PropertiesService.getScriptProperties().getProperty('JOIN_CODE');
  return str_(v) || String(MEET.JOIN_CODE);
}

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
      agentNo: str_(r['Agent No']),
      email: low_(r['Email']),
      name: str_(r['Name']) || str_(r['Email']),
      role: low_(r['Role']) || 'agent',
      unit: str_(r['Unit']),
      active: yes_(r['Active']),
      code: str_(r['Access Code']),
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

/** Agent numbers are typed on a phone, so they are matched with the
 *  punctuation and leading zeros taken off: 0745444, 745444 and
 *  745-444 are all the same agent. */
function normNo_(v) { return str_(v).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, ''); }

function findPersonByAgentNo_(no) {
  no = normNo_(no);
  if (!no) return null;
  return readPeople_().filter(function (p) { return normNo_(p.agentNo) === no; })[0] || null;
}

/** Who is signing in: an agent number, or an e-mail for anyone who
 *  has no number on the skill bank. One box takes both. */
function findSignIn_(who) {
  who = str_(who);
  if (who.indexOf('@') > 0) return findPersonByEmail_(who);
  return findPersonByAgentNo_(who) || findPersonByEmail_(who);
}

function findPersonByToken_(token) {
  token = str_(token);
  if (!token) return null;
  return readPeople_().filter(function (p) { return p.token && p.token === token; })[0] || null;
}

/** Everyone who should be at a branch meeting — the denominator
 *  the register is measured against.
 *
 *  Guests are excluded on purpose. The roll is who the branch expects,
 *  and a visiting executive who does not sign in has not missed a
 *  meeting they were contracted to attend. They can still sign in,
 *  and when they do they are counted present like anybody else; they
 *  are simply never counted absent for staying away. */
function roster_() {
  return readPeople_().filter(function (p) { return p.active && p.role !== 'guest'; });
}

/** Everyone who may sign in, guests included — used where the question
 *  is "may this person be here", not "was this person expected". */
function everyone_() {
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

  // A GUEST IS INVITED TO ONE MEETING, NOT TO THE BRANCH. Without this
  // a visitor given a sign-in for one session could open every branch
  // meeting ever held, including the minutes of the ones they were not
  // at. They get the meeting that names them and nothing else.
  if (person.role === 'guest') {
    return low_(m['Guest']).indexOf(person.email) > -1 ||
           low_(m['Guest']).indexOf(low_(person.name)) > -1 ||
           isParticipant_(m, person);
  }

  switch (cleanScope_(m['Scope'])) {
    case 'staff':
      return isStaff_(person);
    case 'unit':
      // The named unit, plus staff. A unit meeting with no unit set
      // would otherwise open for the whole branch, so an unset unit
      // closes it to everyone but staff rather than opening it to all.
      if (isStaff_(person)) return true;
      return !!str_(m['Unit']) && sameUnit_(m['Unit'], person.unit);
    case 'invited':
    case 'one-to-one':
    case 'client':
      // Only the people actually named. The branch manager is already
      // through, above.
      return low_(m['Chair']) === person.email || isParticipant_(m, person);
    default:
      return true;
  }
}

/** Units are typed by hand on two different sheets, so they are
 *  compared loosely: "Akaash Kalladeen", "akaash" and "Akaash's unit"
 *  are one unit. */
function sameUnit_(a, b) {
  // A possessive is dropped before the punctuation is, or "Gary's unit"
  // becomes "garys" and stops matching "Gary Sookdeo".
  var tidy = function (v) {
    return low_(v).replace(/[\u2019']s\b/g, '')
                  .replace(/[^a-z0-9 ]/g, ' ')
                  .replace(/\bunit\b/g, '')
                  .replace(/\s+/g, ' ').trim();
  };
  a = tidy(a);
  b = tidy(b);
  if (!a || !b) return false;
  if (a === b) return true;
  // One is a first name and the other the full name of the same person.
  var fa = a.split(/\s+/)[0], fb = b.split(/\s+/)[0];
  return fa === fb && fa.length > 2;
}

/*  WHO WAS EXPECTED AT THIS MEETING — the register's denominator.
 *
 *  roster_() is the whole branch, which is right for a branch meeting
 *  and wrong for everything else. Closing a unit meeting of eight
 *  against the whole roll would have written a false absence onto the
 *  twenty-five people who were never invited to it, and those rows are
 *  permanent once the register closes.
 */
function rosterFor_(m) {
  var all = roster_();
  switch (cleanScope_(m && m['Scope'])) {
    case 'staff':
      return all.filter(function (p) { return isStaff_(p); });
    case 'unit':
      if (!str_(m['Unit'])) return all.filter(function (p) { return isStaff_(p); });
      return all.filter(function (p) {
        return sameUnit_(m['Unit'], p.unit) || isStaff_(p);
      });
    case 'invited':
    case 'one-to-one':
    case 'client':
      return all.filter(function (p) {
        return low_(m['Chair']) === p.email || isParticipant_(m, p);
      });
    default:
      return all;
  }
}

/** The Participants cell is a comma-separated list of emails. */
function isParticipant_(m, person) {
  var want = str_(m['Participants']).toLowerCase()
    .split(/[,;]/).map(function (x) { return x.trim(); })
    .filter(function (x) { return !!x; });
  if (!want.length) return false;
  if (want.indexOf(person.email) > -1) return true;
  // People think in agent numbers now, so a list may be written in them.
  var no = normNo_(person.agentNo);
  return !!no && want.some(function (x) { return normNo_(x) === no; });
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
  if (join !== joinCode_().toUpperCase()) {
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

/*  ONE DOOR: THE AGENT NUMBER AND THE PASSWORD THEY ALREADY HAVE.
 *
 *  Decided 9 October 2026. Both live on the Agent Skill Bank, which is
 *  where the branch already keeps them and where the agent and staff
 *  portals read them from. Asking for a work e-mail instead meant
 *  asking a room full of people to type an address on a phone to get
 *  into a meeting that was marking them absent while they typed. The
 *  number is shorter, it is on their card, and they know it.
 *
 *  The box still takes an e-mail, because a few staff have no number
 *  on the skill bank, and it still takes a PIN set here before 6
 *  October. Two doors would mean two ways to fail on the way into a
 *  meeting; one box that accepts whichever of them you have is one.
 *
 *  THE PASSWORD IS NEVER STORED HERE. pullRoster hashes it on the way
 *  in — salted, SHA-256 — so the meeting sheet holds no second copy of
 *  a credential that already exists in one place. Changing it on the
 *  skill bank and pulling again is what changes it here.
 */
function sameCode_(given, held) {
  var a = str_(given).toUpperCase().replace(/\s+/g, '');
  var b = str_(held).toUpperCase().replace(/\s+/g, '');
  return !!a && !!b && a === b;
}

function apiLogin_(body) {
  // 'who' is the agent number or an e-mail; the older keys are kept so
  // a copy of the page still open in somebody's browser keeps working.
  var who = str_(body.who || body.agentNo || body.email);
  var pin = str_(body.password || body.code || body.pin);

  var p = findSignIn_(who);
  // Same wording whether the number is unknown or the password is
  // wrong, so the box cannot be used to find out who is on the branch.
  var generic = { ok: false, error: 'That agent number and password do not match.' };
  if (!p) return generic;
  if (!p.active) return { ok: false, error: 'Your access has been turned off. Speak to the branch manager.' };
  if (!p.hash && !p.code) return { ok: false, error: 'needs-enrol', needsEnrol: true };

  if (p.lockedUntil && p.lockedUntil.getTime() > Date.now()) {
    var mins = Math.ceil((p.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: 'Too many wrong tries. Try again in ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.' };
  }

  var byCode = sameCode_(pin, p.code);
  var byPin = !!p.hash && hashPin_(pin, p.salt) === p.hash;
  if (!byCode && !byPin) {
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
  if (ROLES.indexOf(role) === -1) role = 'agent';

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
    late: num_(mine['Minutes Late']), reason: str_(mine['Reason']),
    note: str_(mine['Note'])
  } : null;

  /*  AN APOLOGY IS NOT A SIDE DOOR INTO THE PACK. Somebody who has
   *  logged that they cannot attend gets the card, their own apology
   *  back, and nothing else — no agenda, no materials, no minutes,
   *  no floor. They can still change their mind: signing in corrects
   *  the row and the meeting opens.
   *
   *  Staff and the chair are exempt, because they build the agenda
   *  and write the minutes; locking a chair out of the meeting they
   *  are minuting would be a rule applied past the point it makes
   *  sense. Their apology is still recorded and still counted. */
  var apology = apologised_(m, me, att);
  if (apology && !isStaff_(me)) {
    var shut = meetingCard_(m, me, myAtt);
    return {
      ok: true, user: publicUser_(me), meeting: shut,
      apologised: apology,
      locked: true,
      lockedMessage: 'You logged that you cannot attend this meeting, so the pack is closed to you. '
        + 'If that changes, sign in and it opens.',
      agenda: [], actions: [], minutes: [], contributions: [],
      minutesPublished: false, sections: SECTIONS, kinds: CONTRIB_KINDS,
      topicList: [], canRun: false, session: null,
      apologyReasons: APOLOGY_REASONS, apologyOther: APOLOGY_OTHER
    };
  }

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
    maxClipMinutes: MEET.MAX_CLIP_MINUTES,
    apologyReasons: APOLOGY_REASONS,
    apologyOther: APOLOGY_OTHER,
    // The role held for THIS meeting, which the chair and a presenter
    // need in order to be shown their own part of the framework.
    myRole: roleInMeeting_(m, me, agenda)
  };

  // The register itself is staff material. An agent sees that they
  // are counted, never who else was or was not there.
  if (isStaff_(me)) {
    out.register = register_(m, att);
    out.floor = floorStats_(contributions, out.register);
    // Who is carrying this meeting. Counted every time it is opened, so
    // a rota drifting back to one person shows on the day.
    out.load = loadOf_(m, agenda);
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
 *  afterwards. The JotForm register was disbanded on 6 October 2026
 *  and nothing else records attendance.
 *
 *  NO LOGIN IS ABSENT. Until 6 October a person with no row at all
 *  was reported separately from the absent — "no entry", a fact
 *  about the record rather than an accusation — because the branch
 *  had two registers and neither could be trusted. With one register
 *  and the door open to everybody on the list, there is nothing left
 *  for a missing row to mean: the branch decided that not signing in
 *  is being absent, and said so to the room.
 *
 *  The distinction survives in the data, not in the count. An absent
 *  row carries a Method of 'no-login' when nobody ever opened the
 *  meeting, and 'marked' when staff put it there by hand, so anyone
 *  reading the sheet in six months can still tell a person who was
 *  marked absent from a person who simply never appeared. The count
 *  on the wall is one number, and it is absent.
 */

function register_(m, att) {
  att = att || readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });

  var byEmail = {};
  att.forEach(function (a) { byEmail[low_(a['Email'])] = a; });

  var groups = { present: [], late: [], excused: [], absent: [] };

  att.forEach(function (a) {
    var entry = {
      email: low_(a['Email']), name: str_(a['Name']), role: low_(a['Role']),
      unit: str_(a['Unit']), method: low_(a['Method']),
      signedIn: fmtStamp_(a['Signed In']), time: fmtTime_(a['Signed In']),
      late: num_(a['Minutes Late']), reason: str_(a['Reason']),
      note: str_(a['Note'] || ''),
      recordedBy: str_(a['Recorded By']),
      // Rows written by closeRegister_ when the meeting ended carry
      // Method 'no-login'. They are read back here so a closed
      // register says exactly what a live one said.
      neverLoggedIn: low_(a['Method']) === 'no-login'
    };
    var st = low_(a['Status']);
    if (groups[st]) groups[st].push(entry);
  });

  // Everyone on the branch list who never opened the meeting. Before
  // the register is closed they have no row at all; afterwards they
  // have one, and the loop above has already caught them.
  var noLogin = 0;
  var expected = rosterFor_(m);
  expected.forEach(function (p) {
    if (!byEmail[p.email]) {
      groups.absent.push({
        email: p.email, name: p.name, role: p.role, unit: p.unit,
        method: 'no-login', signedIn: '', time: '', late: 0,
        reason: '', note: '', recordedBy: '', neverLoggedIn: true
      });
    }
  });

  // Counted off the finished list, so it is the same number whether
  // the register is still open or was closed with the meeting.
  noLogin = groups.absent.filter(function (x) { return x.neverLoggedIn; }).length;

  var order = function (a, b) { return a.name.localeCompare(b.name); };
  Object.keys(groups).forEach(function (k) { groups[k].sort(order); });

  var roll = expected.length;
  var here = groups.present.length + groups.late.length;

  // Why the apologies came in, counted. One row per reason that was
  // actually used, so the wall never shows an empty column.
  var byReason = {};
  groups.excused.forEach(function (e) {
    var r = e.reason || APOLOGY_OTHER;
    byReason[r] = (byReason[r] || 0) + 1;
  });
  var reasons = Object.keys(byReason).map(function (r) {
    return { reason: r, count: byReason[r] };
  }).sort(function (a, b) { return b.count - a.count || a.reason.localeCompare(b.reason); });

  return {
    counts: {
      present: groups.present.length, late: groups.late.length,
      excused: groups.excused.length, absent: groups.absent.length,
      // Kept as a breakdown of the absent, never as a group of its own:
      // the branch counts a missing login as an absence.
      noLogin: noLogin,
      markedAbsent: groups.absent.length - noLogin,
      roll: roll, here: here,
      rate: roll ? Math.round((here / roll) * 100) : 0,
      accountedFor: roll ? Math.round(((here + groups.excused.length) / roll) * 100) : 0
    },
    reasons: reasons,
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

/*  THE APOLOGY. You still log in; you just do not get the meeting.
 *
 *  Decided 6 October 2026. Somebody who cannot come signs in with
 *  the same code as everybody else and picks a reason from
 *  APOLOGY_REASONS. That writes an 'excused' row, and from then on
 *  the meeting itself — agenda, materials, minutes, the floor — is
 *  closed to them (see apologised_ and apiMeeting_). An apology is
 *  not a side door into the pack.
 *
 *  The reason has to be one of the listed ones. A typed reason is
 *  refused rather than quietly stored, because the whole point of
 *  the list is that every apology lands in a box the wall can count.
 */
function apiExcuse_(body) {
  var me = requireUser_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var reason = str_(body.reason);
  if (!reason) return { ok: false, error: 'Pick the reason you cannot attend.' };
  if (APOLOGY_REASONS.indexOf(reason) === -1) {
    return { ok: false, error: 'Pick a reason from the list.' };
  }
  var note = str_(body.note).slice(0, 300);
  if (reason === APOLOGY_OTHER && note.length < 3) {
    return { ok: false, error: 'Say in a line what the reason is.' };
  }
  if (reason !== APOLOGY_OTHER) note = '';

  var existing = readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']) && low_(a['Email']) === me.email;
  })[0];

  if (existing && ['present', 'late'].indexOf(low_(existing['Status'])) > -1) {
    return { ok: false, error: 'You are already signed in to this meeting.' };
  }

  if (existing) {
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Status', 'excused');
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Reason', reason);
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Note', note);
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Method', 'apology');
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Signed In', new Date());
    setCell_(MEET.TAB_ATTENDANCE, existing._row, 'Recorded By', 'self');
  } else {
    appendRow_(MEET.TAB_ATTENDANCE, {
      'ID': uid_('ATT'), 'Meeting ID': str_(m['ID']), 'Email': me.email, 'Name': me.name,
      'Role': me.role, 'Unit': me.unit, 'Status': 'excused', 'Method': 'apology',
      'Signed In': new Date(), 'Minutes Late': 0, 'Reason': reason, 'Note': note,
      'Recorded By': 'self', 'Device': str_(body.device).slice(0, 120)
    });
  }
  log_('apology', me.name, me.role, str_(m['Ref']) || str_(m['ID']),
    reason + (note ? ' — ' + note : ''));
  return { ok: true, reason: reason, note: note };
}

/** Has this person apologised for this meeting? An apology closes the
 *  meeting to them, so this is checked before anything is handed over. */
function apologised_(m, person, att) {
  if (!m || !person) return null;
  att = att || readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });
  var mine = att.filter(function (a) { return low_(a['Email']) === person.email; })[0];
  if (!mine || low_(mine['Status']) !== 'excused') return null;
  return { reason: str_(mine['Reason']), note: str_(mine['Note']),
           at: fmtStamp_(mine['Signed In']) };
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
                     present: 0, late: 0, excused: 0, absent: 0, noLogin: 0,
                     total: meetings.length };
  });
  var seen = {};
  att.forEach(function (a) {
    var e = low_(a['Email']);
    if (!per[e]) return;
    var st = low_(a['Status']);
    if (per[e][st] !== undefined) per[e][st]++;
    if (st === 'absent' && low_(a['Method']) === 'no-login') per[e].noLogin++;
    seen[e + '|' + str_(a['Meeting ID'])] = 1;
  });
  // A meeting with no row at all is an absence, the same as one the
  // register wrote when it closed. noLogin is the share of those
  // absences nobody marked by hand, kept for the one-on-one.
  Object.keys(per).forEach(function (e) {
    meetings.forEach(function (m) {
      if (!seen[e + '|' + str_(m['ID'])]) { per[e].absent++; per[e].noLogin++; }
    });
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
    // No scope chosen takes the one its type implies, so a Managers
    // Meeting is never left open to the branch because somebody did not
    // look at a second dropdown.
    'Scope': str_(body.scope) ? cleanScope_(body.scope) : defaultScopeFor_(type),
    'Participants': str_(body.participants),
    'Client Ref': str_(body.clientRef),
    'Topics': str_(body.topics),
    'Unit': str_(body.unit),
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
/* ==================== the daily note ==================== */
/*
 *  WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
 *
 *  The branch meets on a Wednesday morning. This sends each person one
 *  short note on each working morning that counts down to it and asks
 *  for the one thing only they can bring. By Wednesday the meeting has
 *  been built by everybody rather than assembled by the chair on the
 *  night before.
 *
 *  IT IS NOT A DAILY PRODUCTION CHASE, and that is a design decision
 *  taken against the evidence rather than a preference. Chung,
 *  Narayandas and Chang (Management Science, 2021) ran daily against
 *  monthly quotas in a field experiment: daily quotas lifted the bottom
 *  quartile 11.7%, and pushed the top performers toward low-ticket
 *  business so their sales fell 8.1% and firm profit with it. A daily
 *  number shouted at a room of agents makes the weakest a little better
 *  and the strongest worse. The common practitioner rule — operational
 *  measures daily, strategic ones weekly — points the same way.
 *
 *  So the daily note carries what a person CONTROLS THAT DAY: their
 *  item for Wednesday, whether their material is in, their open
 *  actions, and their own measures with no league table and nobody
 *  else's figures. The strategy argument happens once a week, in the
 *  room, which is what the meeting is for.
 *
 *  Every note ends with the same ask, because "all have to contribute"
 *  has to be something a person can do in ten seconds from a phone.
 */

function nextMeetingDay_(from) {
  var d = new Date(from || new Date());
  d.setHours(0, 0, 0, 0);
  var delta = (MEET.MEETING_DAY - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** The meeting the notes are counting down to: the next one scheduled,
 *  or the next meeting day if none has been built yet. */
function upcomingMeeting_(from) {
  var now = from || new Date();
  var soon = meetingRows_().filter(function (m) {
    var st = low_(m['Status']);
    if (st === 'cancelled' || st === 'closed') return false;
    var d = asDate_(m['Date']);
    return d && d.getTime() >= new Date(now).setHours(0, 0, 0, 0);
  }).sort(function (a, b) {
    return asDate_(a['Date']).getTime() - asDate_(b['Date']).getTime();
  });
  return soon[0] || null;
}

function workingDaysBetween_(a, b) {
  var d = new Date(a); d.setHours(0,0,0,0);
  var end = new Date(b); end.setHours(0,0,0,0);
  var n = 0;
  while (d.getTime() < end.getTime()) {
    d.setDate(d.getDate() + 1);
    var w = d.getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

function kpiRowsFor_(person) {
  var no = normNo_(person.agentNo);
  return readTab_(MEET.TAB_KPI).filter(function (r) {
    if (!yes_(r['Active'])) return false;
    if (!str_(r['Measure'])) return false;
    if (person.email && low_(r['Email']) === person.email) return true;
    return !!no && normNo_(r['Agent No']) === no;
  }).map(function (r) {
    var v = num_(r['Value']), t = num_(r['Target']);
    var dir = low_(r['Direction']) || 'up';   // 'up' = higher is better
    var meets = !str_(r['Target']) ? null : (dir === 'down' ? v <= t : v >= t);
    return {
      measure: str_(r['Measure']), value: str_(r['Value']), target: str_(r['Target']),
      unit: str_(r['Unit']), note: str_(r['Note']), asOf: fmtDate_(r['As Of']),
      link: safeLink_(r['Link']),
      meets: meets
    };
  });
}

/*  THE NOTE, BUILT NOT SENT. Kept pure so what a person actually
 *  receives can be checked without a mailbox, and so the wording can
 *  be argued about without anybody being e-mailed. */
function dailyNoteFor_(person, ctx) {
  var m = ctx.meeting;
  var days = ctx.daysToMeeting;
  var when = days === 0 ? 'this morning'
           : days === 1 ? 'tomorrow'
           : 'in ' + days + ' days';

  var lines = [], must = [], subjectBits = [];

  // 1. Your item on Wednesday.
  (ctx.myItems || []).forEach(function (it) {
    if (it.required && !it.ready) {
      must.push('Your material for <b>' + esc_(it.title) + '</b> is not in yet.');
      subjectBits.push('material due');
    } else if (!it.ready) {
      must.push('Mark <b>' + esc_(it.title) + '</b> ready when you are.');
    } else {
      lines.push('<b>' + esc_(it.title) + '</b> — ready. ' + it.minutes + ' minutes, ' +
                 (it.clock ? 'at ' + esc_(it.clock) : 'on the running order') + '.');
    }
  });
  if (!(ctx.myItems || []).length) {
    lines.push('You are not presenting on Wednesday.');
  }

  // 2. Your actions.
  if (ctx.overdue && ctx.overdue.length) {
    must.push('<b>' + ctx.overdue.length + '</b> of your action items ' +
      (ctx.overdue.length === 1 ? 'is' : 'are') + ' past the date: ' +
      ctx.overdue.slice(0, 3).map(function (a) { return esc_(a.item); }).join('; ') +
      (ctx.overdue.length > 3 ? '…' : '') + '.');
    subjectBits.push(ctx.overdue.length + ' overdue');
  } else if (ctx.openActions && ctx.openActions.length) {
    lines.push('<b>' + ctx.openActions.length + '</b> open action' +
      (ctx.openActions.length === 1 ? '' : 's') + ', none overdue.');
  } else {
    lines.push('No action items against your name.');
  }

  // 3. Your own measures. No league table, no one else's figures.
  var kpi = ctx.kpi || [];
  var kpiHtml = '';
  if (kpi.length) {
    kpiHtml = '<table style="border-collapse:collapse;margin:10px 0;width:100%">' +
      kpi.map(function (k) {
        var mark = k.meets === null ? '' : (k.meets ? ' ✓' : ' —');
        return '<tr>' +
          '<td style="padding:4px 10px 4px 0;color:#49637d">' + esc_(k.measure) + '</td>' +
          '<td style="padding:4px 0;font-weight:700">' + esc_(k.value) +
            (k.unit ? ' ' + esc_(k.unit) : '') + mark + '</td>' +
          '<td style="padding:4px 0 4px 12px;color:#8aa3bb;font-size:12px">' +
            (k.target ? 'target ' + esc_(k.target) : '') +
            (k.link ? (k.target ? ' &middot; ' : '') +
              '<a href="' + esc_(k.link) + '" style="color:#00a8c5;text-decoration:none">open the wall</a>'
              : '') + '</td></tr>';
      }).join('') + '</table>';
  }

  // 4. The ask. The same one every day, because it has to be a habit.
  var ask = ctx.contributedThisWeek
    ? 'You have already put something on Wednesday&rsquo;s agenda. Add another if it matters.'
    : '<b>Add one thing to Wednesday&rsquo;s agenda</b> — a question, a concern, or something that worked. '
      + 'It takes ten seconds and it is the difference between a meeting you attend and one you are in.';

  var subject = days === 0
    ? 'Branch meeting this morning' + (subjectBits.length ? ' — ' + subjectBits[0] : '')
    : (subjectBits.length
        ? 'Wednesday ' + when + ': ' + subjectBits.join(', ')
        : 'Wednesday ' + when);

  var html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;' +
      'color:#0b2238;line-height:1.6">' +
    '<p style="margin:0 0 4px;font-size:13px;color:#8aa3bb">' + esc_(MEET.BRANCH) + '</p>' +
    '<h2 style="margin:0 0 2px;font-size:19px">Good morning, ' + esc_(firstName_(person.name)) + '.</h2>' +
    '<p style="margin:0 0 14px;font-size:14px;color:#49637d">' +
      (m ? esc_(str_(m['Title']) || 'Branch meeting') + ' is ' + when +
           (str_(m['Start']) ? ', ' + esc_(fmtTime_(atTime_(m['Date'], m['Start']))) : '') + '.'
         : 'The branch meeting is ' + when + '.') + '</p>' +
    (must.length
      ? '<div style="background:#fff5e6;border:1px solid #f0c674;border-radius:10px;padding:11px 13px;margin:0 0 14px">' +
        '<p style="margin:0 0 6px;font-weight:700;font-size:13px">Before Wednesday</p>' +
        '<ul style="margin:0;padding-left:18px;font-size:13.5px">' +
        must.map(function (x) { return '<li style="margin-bottom:4px">' + x + '</li>'; }).join('') +
        '</ul></div>'
      : '') +
    (lines.length
      ? '<ul style="margin:0 0 14px;padding-left:18px;font-size:13.5px;color:#49637d">' +
        lines.map(function (x) { return '<li style="margin-bottom:4px">' + x + '</li>'; }).join('') +
        '</ul>'
      : '') +
    (kpiHtml ? '<p style="margin:14px 0 2px;font-size:11px;letter-spacing:.12em;' +
       'text-transform:uppercase;color:#8aa3bb">Yours' +
       (kpi[0] && kpi[0].asOf ? ', as at ' + esc_(kpi[0].asOf) : '') + '</p>' + kpiHtml : '') +
    '<p style="margin:16px 0 14px;font-size:13.5px">' + ask + '</p>' +
    '<p style="margin:0 0 18px"><a href="' + esc_(ctx.appUrl || 'https://rickyrampersadbranch.com/meetings/') +
      '" style="background:#0b2238;color:#efc24b;text-decoration:none;padding:10px 18px;' +
      'border-radius:9px;font-weight:700;font-size:13.5px;display:inline-block">Open the meeting</a></p>' +
    '<p style="margin:0;font-size:11.5px;color:#8aa3bb">Signing in on Wednesday is the attendance register. ' +
      'If you do not sign in you are marked absent; if you cannot come, log it and pick a reason.</p>' +
    '<p style="margin:14px 0 0;font-size:11px;color:#a8bccf">Internal — Ricky Rampersad Branch. ' +
      'Your own figures only; nobody else receives yours.</p>' +
    '</div>';

  return { subject: subject, html: html, must: must.length, hasKpi: kpi.length > 0 };
}

function firstName_(n) { return str_(n).split(/\s+/)[0] || str_(n); }

/*  Only http and https ever reach an href. These links come off a sheet
 *  anybody on the branch can edit, and the daily note is e-mail: a
 *  javascript: or data: URL pasted into a cell must not become a live
 *  link in twenty-eight inboxes. */
function safeLink_(v) {
  var u = str_(v);
  return /^https?:\/\//i.test(u) ? u : '';
}
function esc_(v) {
  return str_(v).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/** Everything one person's note needs, read once per run rather than
 *  per person — a per-person read of six tabs would not finish. */
function dailyNoteContext_(now) {
  now = now || new Date();
  var m = upcomingMeeting_(now);
  var target = m ? asDate_(m['Date']) : nextMeetingDay_(now);
  var agenda = m ? readTab_(MEET.TAB_AGENDA).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  }) : [];
  var uploads = m ? readTab_(MEET.TAB_UPLOADS).filter(function (u) {
    return str_(u['Meeting ID']) === str_(m['ID']);
  }) : [];
  var actions = readTab_(MEET.TAB_ACTIONS);
  var contribs = m ? readTab_(MEET.TAB_CONTRIB).filter(function (c) {
    return str_(c['Meeting ID']) === str_(m['ID']);
  }) : [];
  var clock = m ? atTime_(m['Date'], m['Start']) : null;
  agenda.sort(function (a, b) { return num_(a['Order']) - num_(b['Order']); });
  agenda.forEach(function (a) {
    a._clock = clock ? Utilities.formatDate(clock, tz_(), 'h:mm a') : '';
    if (clock) clock = new Date(clock.getTime() + (num_(a['Allotted (min)']) || 0) * 60000);
  });
  return {
    now: now, meeting: m, target: target,
    daysToMeeting: Math.max(0, workingDaysBetween_(now, target)),
    agenda: agenda, uploads: uploads, actions: actions, contribs: contribs,
    appUrl: 'https://rickyrampersadbranch.com/meetings/'
  };
}

function noteContextFor_(person, ctx) {
  var mine = ctx.agenda.filter(function (a) {
    return low_(a['Presenter Email']) === person.email;
  }).map(function (a) {
    var files = ctx.uploads.filter(function (u) { return str_(u['Agenda ID']) === str_(a['ID']); });
    return {
      title: str_(a['Title']), minutes: num_(a['Allotted (min)']), clock: a._clock,
      required: yes_(a['Materials Required']) && str_(a['Materials Required']).toUpperCase() !== 'N',
      ready: str_(a['Ready']).toUpperCase() === 'Y' || files.length > 0
    };
  });
  var mineActions = ctx.actions.filter(function (x) {
    var owner = low_(x['Owner']);
    return owner && (owner.indexOf(person.email) > -1 ||
      (person.name && owner.indexOf(low_(person.name)) > -1));
  }).filter(function (x) { return low_(x['Status']) !== 'complete'; });
  var today = new Date(ctx.now); today.setHours(0,0,0,0);
  return {
    meeting: ctx.meeting,
    daysToMeeting: ctx.daysToMeeting,
    appUrl: ctx.appUrl,
    myItems: mine,
    openActions: mineActions.map(function (x) { return { item: str_(x['Item']) }; }),
    overdue: mineActions.filter(function (x) {
      var due = asDate_(x['Due']);
      return due && due.getTime() < today.getTime();
    }).map(function (x) { return { item: str_(x['Item']) }; }),
    kpi: kpiRowsFor_(person),
    contributedThisWeek: ctx.contribs.some(function (c) { return low_(c['Email']) === person.email; })
  };
}

/*  The trigger. Working mornings only, and it says nothing at all on a
 *  day when there is nothing to say — a note that arrives every day
 *  whether or not it carries anything is a note people filter.       */
function dailyMeetingNote() {
  var now = new Date();
  var w = now.getDay();
  if (w === 0 || w === 6) { Logger.log('Weekend — no note.'); return 'Weekend — no note.'; }

  var ctx = dailyNoteContext_(now);
  if (!ctx.meeting && ctx.daysToMeeting > 2) {
    Logger.log('No meeting within two working days — no note.');
    return 'No meeting within two working days — no note.';
  }

  var sent = 0, quiet = 0;
  everyone_().forEach(function (p) {
    if (!p.email) return;
    var per = noteContextFor_(p, ctx);
    var note = dailyNoteFor_(p, per);
    // Nothing owed, nothing open, no measures, and the meeting is still
    // days away: say nothing rather than train them to ignore it.
    if (!note.must && !note.hasKpi && per.daysToMeeting > 1 &&
        !per.myItems.length && !per.openActions.length) { quiet++; return; }
    try {
      MailApp.sendEmail({ to: p.email, subject: note.subject, htmlBody: note.html,
                          name: MEET.BRANCH });
      sent++;
    } catch (err) {
      Logger.log('Could not write to ' + p.email + ': ' + err);
    }
  });

  var msg = sent + ' note' + (sent === 1 ? '' : 's') + ' sent, ' + quiet + ' had nothing to say.';
  log_('daily-note', 'system', '', ctx.meeting ? str_(ctx.meeting['Ref']) : '', msg);
  Logger.log(msg);
  return msg;
}

/** Install the morning trigger. Safe to run again — it clears its own
 *  first, so pressing the menu item twice never doubles the notes. */
function installDailyNote() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyMeetingNote') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyMeetingNote').timeBased()
    .atHour(MEET.NOTE_HOUR).everyDays(1).create();
  var msg = 'Daily note installed for about ' + MEET.NOTE_HOUR + ':00 each morning. ' +
    'It stays quiet at weekends and when there is nothing to say.';
  Logger.log(msg);
  return msg;
}

function installDailyNoteFromMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.alert('The daily note', installDailyNote(), ui.ButtonSet.OK);
}

/** Send yourself today's note, to read it before the branch does. */
function previewDailyNote() {
  var me = findPersonByEmail_(MEET.ADMIN_EMAIL) || readPeople_()[0];
  if (!me) throw new Error('Nobody on the People tab yet.');
  var ctx = dailyNoteContext_(new Date());
  var note = dailyNoteFor_(me, noteContextFor_(me, ctx));
  MailApp.sendEmail({ to: me.email, subject: '[Preview] ' + note.subject,
                      htmlBody: note.html, name: MEET.BRANCH });
  var msg = 'Preview sent to ' + me.email + '.';
  Logger.log(msg);
  return msg;
}

/* ======================== the rota ======================== */
/*
 *  WHY THIS EXISTS. Read the five meetings on record from 22 July to
 *  11 September and one shape comes out of all of them: the branch
 *  manager presents most of the meeting. "Branch Manager's
 *  Presentation" is a standing section that is his alone and carried
 *  fourteen distinct topics across those five sessions; the whole Key
 *  Person Insurance workshop on 7 August was his; the opening, the
 *  correspondence, the compliance section and the closing are his
 *  every time. Admin carry the operational reports. Agents presented
 *  twice in five meetings — Rajiv on 21 August, Felicia on 7 August —
 *  and both were "share your approach" slots rather than items anybody
 *  owned.
 *
 *  The seeder used to put that in code: of twelve standing items, six
 *  defaulted to the chair and six were left blank for whoever ended up
 *  holding them, which in practice was the chair again. The rota is
 *  the fix. Every standing item has an owner who is not the chair, a
 *  backup for the day they apologise, and the two items that should
 *  move round the room rotate by themselves.
 */

function rotaRows_() {
  return readTab_(MEET.TAB_ROTA)
    .filter(function (r) { return yes_(r['Active']) && str_(r['Item']); })
    .sort(function (a, b) { return num_(a['Order']) - num_(b['Order']); });
}

/*  Whoever has presented least recently, so a rotating slot comes round
 *  the room instead of landing on whoever volunteers. Never presented
 *  at all sorts first — which is most of the branch, and the point.
 *
 *  `skip` is who has already been given a slot in the meeting being
 *  built right now. Without it both rotating items land on the same
 *  person: the rotation reads the Agenda tab to see who presented
 *  last, and during a build that tab has not been written yet, so
 *  every call inside one build returns the same name.               */
function nextInRotation_(exclude, skip) {
  exclude = low_(exclude || '');
  skip = skip || {};
  var lastSeen = {};
  readTab_(MEET.TAB_AGENDA).forEach(function (a) {
    var e = low_(a['Presenter Email']);
    if (!e) return;
    var when = asDate_(a['Created']);
    var t = when ? when.getTime() : 0;
    if (!(e in lastSeen) || t > lastSeen[e]) lastSeen[e] = t;
  });
  var pool = roster_().filter(function (p) {
    return p.role === 'agent' && p.email !== exclude && !skip[p.email];
  });
  if (!pool.length) return null;
  pool.sort(function (a, b) {
    var la = (a.email in lastSeen) ? lastSeen[a.email] : -1;
    var lb = (b.email in lastSeen) ? lastSeen[b.email] : -1;
    return la - lb || a.name.localeCompare(b.name);
  });
  return pool[0];
}

/** Who presents one rota item at this meeting. */
function presenterFor_(item, m, chairEmail, taken) {
  var cadence = low_(item['Cadence']) || 'fixed';
  if (cadence === 'chair') {
    var c = findPersonByEmail_(chairEmail);
    return c ? { name: c.name, email: c.email } : { name: str_(m['Chair']), email: low_(m['Chair']) };
  }
  if (cadence === 'rotate') {
    var nxt = nextInRotation_(chairEmail, taken);
    return nxt ? { name: nxt.name, email: nxt.email } : { name: '', email: '' };
  }
  var owner = findPersonByEmail_(item['Owner Email']);
  if (owner && owner.active) return { name: owner.name, email: owner.email };
  var backup = findPersonByEmail_(item['Backup Email']);
  if (backup && backup.active) return { name: backup.name, email: backup.email };
  return { name: str_(item['Owner']), email: low_(item['Owner Email']) };
}

/*  HOW MUCH OF THIS MEETING IS ONE PERSON'S.
 *
 *  A rota drifts back to the chair quietly — an owner is away, an item
 *  gets added in a hurry, and six months later it is one person's
 *  broadcast again. This counts it every time the meeting is opened so
 *  the drift is visible on the day rather than in a year's minutes.
 */
var LOAD_TARGET = 0.34;   /* no one person over about a third */

function loadOf_(m, agenda) {
  agenda = agenda || readTab_(MEET.TAB_AGENDA).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });
  var mins = 0, items = 0, by = {}, unowned = 0;
  agenda.forEach(function (a) {
    var min = num_(a['Allotted (min)']);
    mins += min; items++;
    var e = low_(a['Presenter Email']) || '';
    var n = str_(a['Presenter Name']);
    if (!e && !n) { unowned++; return; }
    var k = e || low_(n);
    if (!by[k]) by[k] = { name: n || e, email: e, items: 0, minutes: 0 };
    by[k].items++; by[k].minutes += min;
  });
  var list = Object.keys(by).map(function (k) {
    var x = by[k];
    x.shareItems = items ? Math.round((x.items / items) * 100) : 0;
    x.shareMinutes = mins ? Math.round((x.minutes / mins) * 100) : 0;
    return x;
  }).sort(function (a, b) { return b.minutes - a.minutes || b.items - a.items; });

  var chairEmail = low_(m['Chair']);
  var chair = list.filter(function (x) { return x.email === chairEmail; })[0] || null;
  var chairShare = chair && mins ? chair.minutes / mins : 0;

  return {
    items: items, minutes: mins, unowned: unowned,
    people: list,
    presenters: list.length,
    chair: chair,
    chairShare: Math.round(chairShare * 100),
    target: Math.round(LOAD_TARGET * 100),
    overTarget: chairShare > LOAD_TARGET,
    // Said in words, because a percentage on its own gets argued with.
    note: !items ? 'No agenda yet.'
      : chairShare > LOAD_TARGET
        ? 'The chair is presenting ' + Math.round(chairShare * 100) + '% of this meeting. '
          + 'Give an item away on the Rota tab and it stays given away.'
        : list.length < 3
          ? 'Only ' + list.length + ' people are presenting. A meeting the room takes part in '
            + 'needs more hands than that.'
          : 'Spread across ' + list.length + ' presenters'
            + (unowned ? ', with ' + unowned + ' item' + (unowned === 1 ? '' : 's') + ' nobody owns yet.' : '.')
  };
}

/*  The standing order, taken from the branch's own agendas. Owners are
 *  set by the branch on the Rota tab; what is seeded here is the shape
 *  and the cadence — in particular WHICH items are the chair's, which
 *  is now three of fourteen rather than six of twelve, and which come
 *  round the room.                                                   */
function seedRota() {
  var sh = tab_(MEET.TAB_ROTA);
  if (sh.getLastRow() > 1) {
    var msg = 'The Rota tab already has rows — left alone. Clear it first to re-seed.';
    Logger.log(msg);
    return msg;
  }
  var rows = [
    [0, 'Opening | Mission Statement | Moment of Silence', 5, 'all', 'chair', 'Standard opening'],
    [0, 'Attendance Register Check', 3, 'all', 'fixed', 'Everyone logs in before we open. The app is the register.'],
    [0, 'Review of Minutes & Action Items Tracker', 10, 'all', 'fixed', 'Carry-forward items first, with what closed since.'],
    [1, 'Correspondence & Administrative Reminders', 8, 'all', 'fixed', 'Circulars, deadlines, cut-off dates.'],
    [2, 'Outstanding Requirements Report', 8, 'staff', 'fixed', 'By product and value. 5-day turnaround, 20-day file closure.'],
    [2, 'Persistency — 2-Year & 5-Year', 8, 'staff', 'fixed', 'Red / orange / green. Branch target 90% against the 75% threshold.'],
    [2, 'Licensing & CPD Report', 5, 'staff', 'fixed', 'Central Bank approvals by renewal month.'],
    [2, 'Scripts & Clawback Report', 6, 'staff', 'fixed', 'Dispatch inside the 20-business-day window.'],
    [2, 'Contract Delivery — past the 10-day line', 6, 'staff', 'fixed', 'Undelivered contracts and who holds them.'],
    [2, '85-Day Premium Due & Lapse Activity', 8, 'staff', 'fixed', 'Standing item at every branch meeting.'],
    [3, 'What worked for me this month', 7, 'all', 'rotate', 'One agent, one case, what they actually did. Comes round the room.'],
    [5, 'Training — one point, taught by one of us', 10, 'all', 'rotate', 'Not the manager. A product, an objection, a system.'],
    [4, 'Digital Innovation Update', 8, 'all', 'fixed', 'Fact Find 360 and branch automation.'],
    [6, 'Other Items', 5, 'all', 'fixed', ''],
    [7, 'Closing Remarks', 4, 'all', 'chair', '']
  ];
  appendRows_(MEET.TAB_ROTA, rows.map(function (r, i) {
    return {
      'Order': (i + 1) * 10, 'Section': SECTIONS[r[0]], 'Item': r[1],
      'Detail': r[5], 'Minutes': r[2], 'Visibility': r[3], 'Cadence': r[4],
      'Owner': '', 'Owner Email': '', 'Backup': '', 'Backup Email': '',
      'Active': 'Y', 'Notes': ''
    };
  }));
  var out = rows.length + ' standing items written to the Rota tab.\n\n' +
    'Put an Owner Email against each one. Two items rotate by themselves and ' +
    'need no owner. Only the opening and the closing are the chair’s.\n\n' +
    'Any item left without an owner is seeded unowned, and the meeting will ' +
    'say so when it is opened.';
  Logger.log(out);
  return out;
}

function seedRotaFromMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.alert('The rota', seedRota(), ui.ButtonSet.OK);
}

function apiSeedAgenda_(body) {
  var me = requireStaff_(body.token);
  var m = findMeeting_(body.meetingId);
  if (!m) return { ok: false, error: 'That meeting no longer exists.' };

  var existing = readTab_(MEET.TAB_AGENDA).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });
  if (existing.length) return { ok: false, error: 'This meeting already has an agenda.' };

  var chair = str_(m['Chair']) || me.email;

  /*  The agenda is built from the Rota tab, so a new meeting arrives
   *  already owned by other people. The hard-coded list that used to
   *  live here gave six of twelve items to the chair by default and
   *  left the rest blank, which in practice meant the chair again. */
  var rota = rotaRows_();
  if (!rota.length) {
    return { ok: false, error: 'There is no rota yet. Run "Set up the standing rota" from the ' +
                               'Branch Meetings menu, then put an owner against each item.' };
  }

  // One rotating slot per person per meeting: handed to presenterFor_
  // so the rotation itself skips anybody already given one today.
  var taken = {};
  var standing = rota.map(function (r) {
    var who = presenterFor_(r, m, chair, taken);
    if (low_(r['Cadence']) === 'rotate' && who.email) taken[who.email] = true;
    return {
      section: str_(r['Section']) || SECTIONS[0],
      t: str_(r['Item']),
      d: str_(r['Detail']),
      m: num_(r['Minutes']) || 5,
      v: cleanVisibility_(r['Visibility']),
      pName: who.name,
      pEmail: who.email
    };
  });

  standing.forEach(function (item, i) {
    appendRow_(MEET.TAB_AGENDA, {
      'ID': uid_('AGD'), 'Meeting ID': str_(m['ID']), 'Order': (i + 1) * 10,
      'Section': item.section, 'Title': item.t, 'Detail': item.d,
      'Presenter Name': item.pName, 'Presenter Email': item.pEmail,
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
      return p.name + (p.neverLoggedIn ? ' — did not log in'
                                       : ' — ' + (p.reason || 'marked absent'));
    }).join('\n') : '—') + '\n' +
    (reg.counts.noLogin
      ? reg.counts.noLogin + ' of the absences are people who did not log in to the meeting. ' +
        'Signing in is how attendance is recorded; a member of the branch who does not sign in ' +
        'is recorded absent, and that is carried to the one-on-one with their manager.'
      : 'Every active member of the branch either attended or logged an apology.') + '\n\n' +
    'Roll: ' + reg.counts.roll + '  |  In the room: ' + reg.counts.here +
    '  |  Attendance: ' + reg.counts.rate + '%' +
    '  |  Accounted for: ' + reg.counts.accountedFor + '%';

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

  /*  THE TICKER NEEDS A TIMESTAMP, NOT A COUNT OF MINUTES.
   *
   *  itemElapsed below is whole minutes measured on the server, which is
   *  fine for a card and useless for a clock: the room cannot see a
   *  countdown that moves once a minute and only when somebody reloads.
   *  itemStartedISO lets the browser count the seconds itself, so the
   *  ticker runs smoothly without polling the sheet.                   */
  var next = null;
  if (current && agenda) {
    var curOrder = num_(current['Order']);
    agenda.forEach(function (a) {
      if (num_(a['Order']) <= curOrder) return;
      if (!next || num_(a['Order']) < num_(next['Order'])) next = a;
    });
  }

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
    itemElapsed: itemStarted ? Math.round((Date.now() - itemStarted.getTime()) / 60000) : 0,
    itemStartedISO: iso_(itemStarted),
    currentPresenter: current ? str_(current['Presenter Name']) : '',
    currentOrder: current ? num_(current['Order']) : 0,
    nextTitle: next ? str_(next['Title']) : '',
    nextPresenter: next ? str_(next['Presenter Name']) : '',
    nextAllotted: next ? num_(next['Allotted (min)']) : 0,
    nextAgendaId: next ? str_(next['ID']) : '',
    /* Every item's minutes, so the ticker can say how much of the meeting
       is still to come rather than only how long it has run. */
    plannedTotal: (agenda || []).reduce(function (n, a) {
      return n + num_(a['Allotted (min)']);
    }, 0)
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

  // The register is closed with the meeting: everyone who never
  // opened it gets a real absent row, so the sheet carries the whole
  // roll rather than leaving the absences to be worked out later by
  // whoever happens to read it.
  var marked = closeRegister_(m, me);

  log_('session-end', me.name, me.role, str_(m['Ref']) || str_(m['ID']),
    'Ran ' + ran + ' min against ' + num_(sn['Allotted']) + ' allotted'
    + (marked ? '; ' + marked + ' marked absent, no login' : ''));
  return { ok: true, ran: ran, allotted: num_(sn['Allotted']), markedAbsent: marked };
}

/*  Write the absences down when the meeting closes.
 *
 *  register_ works them out live for the screen, but a figure that
 *  only exists while a function is running is not a record. This
 *  writes one row per person who never opened the meeting, with
 *  Method 'no-login' so it stays distinguishable from an absence a
 *  human marked. It is safe to run twice — anyone with a row already
 *  is skipped — which matters because a meeting can be closed, re-
 *  opened to finish an item, and closed again.
 */
function closeRegister_(m, by) {
  var att = readTab_(MEET.TAB_ATTENDANCE).filter(function (a) {
    return str_(a['Meeting ID']) === str_(m['ID']);
  });
  var seen = {};
  att.forEach(function (a) { seen[low_(a['Email'])] = true; });

  var now = new Date();
  var rows = rosterFor_(m).filter(function (p) { return !seen[p.email]; }).map(function (p) {
    return {
      'ID': uid_('ATT'), 'Meeting ID': str_(m['ID']), 'Email': p.email, 'Name': p.name,
      'Role': p.role, 'Unit': p.unit, 'Status': 'absent', 'Method': 'no-login',
      'Signed In': '', 'Minutes Late': 0, 'Reason': '', 'Note': '',
      'Recorded By': 'register closed by ' + (by && by.name ? by.name : 'the system'),
      'Device': ''
    };
  });

  if (rows.length) appendRows_(MEET.TAB_ATTENDANCE, rows);
  return rows.length;
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

  // ---- the register: present, late, two apologies, and two who never
  //      logged in at all, which is what "absent" now means ----
  var att = [], n = agents.length;
  var lateOne = agents[n - 1], excusedOne = agents[n - 2], absentOne = agents[n - 3];
  var excusedTwo = agents[n - 6];
  // Left out of the loop entirely, then written back as absent with
  // Method 'no-login' — exactly what closeRegister_ does when a real
  // meeting ends, so the sample shows the rule rather than describing it.
  var noLogin = [agents[n - 4], agents[n - 5]].filter(Boolean);

  people.forEach(function (p) {
    if (noLogin.some(function (x) { return x.email === p.email; })) return;

    var row = { 'ID': uid_('ATT'), 'Meeting ID': meetingId, 'Email': p.email,
      'Name': p.name, 'Role': p.role, 'Unit': p.unit, 'Recorded By': SAMPLE_TAG };

    if (excusedOne && p.email === excusedOne.email) {
      row['Status'] = 'excused'; row['Method'] = 'apology';
      row['Signed In'] = new Date(start.getTime() - 3600000);
      row['Reason'] = 'Client appointment I could not move';
    } else if (excusedTwo && p.email === excusedTwo.email) {
      row['Status'] = 'excused'; row['Method'] = 'apology';
      row['Signed In'] = new Date(start.getTime() - 5400000);
      row['Reason'] = 'On a medical or hospital visit';
    } else if (absentOne && p.email === absentOne.email) {
      row['Status'] = 'absent'; row['Method'] = 'manual';
      row['Signed In'] = start; row['Reason'] = 'Marked absent by the chair';
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
  // The two who never opened it, written the way a closed register
  // writes them.
  noLogin.forEach(function (p) {
    att.push({ 'ID': uid_('ATT'), 'Meeting ID': meetingId, 'Email': p.email,
      'Name': p.name, 'Role': p.role, 'Unit': p.unit, 'Status': 'absent',
      'Method': 'no-login', 'Signed In': '', 'Minutes Late': 0, 'Reason': '',
      'Note': '', 'Recorded By': SAMPLE_TAG });
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
          return p.name + (p.neverLoggedIn ? ' — did not log in'
                                           : ' — ' + (p.reason || 'marked absent')); }).join('\n') || '—') + '\n' +
        reg.counts.noLogin + ' of the absences are people who did not log in to the meeting. ' +
        'Signing in is how attendance is recorded; a member of the branch who does not sign in ' +
        'is recorded absent, and that is carried to the one-on-one with their manager.\n\n' +
        'Roll: ' + reg.counts.roll + '  |  In the room: ' + reg.counts.here +
        '  |  Attendance: ' + reg.counts.rate + '%' +
        '  |  Accounted for: ' + reg.counts.accountedFor + '%' },
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
    ' excused, ' + reg.counts.absent + ' absent of whom ' + reg.counts.noLogin +
    ' never logged in) · ' +
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

/*  THE WALL'S FEED.
 *
 *  Opened with the branch code rather than a personal token, the way
 *  every other wall screen is, because a wall is a screen in a room
 *  and nobody signs into it. It gives the register for one meeting —
 *  the one named, or the latest that is running or has run — and
 *  nothing else: no agenda, no materials, no minutes. A wall that
 *  could be asked for the pack would be a pack with no password on
 *  it, mounted where visitors walk past.
 */
function apiWall_(code, id) {
  if (!sameCode_(code, joinCode_())) {
    return { ok: false, refused: true, error: 'That branch code is not right.' };
  }

  var rows = readTab_(MEET.TAB_MEETINGS).filter(function (r) {
    var st = low_(r['Status']);
    return st !== 'draft' && st !== 'cancelled';
  });
  var m = null;
  if (str_(id)) {
    m = rows.filter(function (r) { return str_(r['ID']) === str_(id); })[0] || null;
  } else {
    // The latest meeting that has actually happened, by date.
    rows.sort(function (a, b) {
      var da = asDate_(a['Date']), db = asDate_(b['Date']);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
    var now = Date.now();
    m = rows.filter(function (r) {
      var d = asDate_(r['Date']);
      return d && d.getTime() <= now + 12 * 3600000;
    })[0] || rows[0] || null;
  }
  if (!m) return { ok: true, meeting: null, branch: MEET.BRANCH };

  var reg = register_(m);
  return {
    ok: true,
    branch: MEET.BRANCH,
    asOf: fmtStamp_(new Date()),
    meeting: {
      id: str_(m['ID']), ref: str_(m['Ref']), type: str_(m['Type']),
      title: str_(m['Title']), week: str_(m['Week']),
      date: fmtDate_(m['Date']), start: fmtTime_(atTime_(m['Date'], m['Start'])),
      status: low_(m['Status']), chair: str_(m['Chair'])
    },
    counts: reg.counts,
    reasons: reg.reasons,
    groups: {
      // Names only. The wall never carries an email address: it is a
      // screen in a room people walk past, including visitors.
      present: reg.groups.present.map(function (x) { return { name: x.name, unit: x.unit, time: x.time }; }),
      late: reg.groups.late.map(function (x) { return { name: x.name, unit: x.unit, time: x.time, late: x.late }; }),
      excused: reg.groups.excused.map(function (x) { return { name: x.name, unit: x.unit, reason: x.reason }; }),
      absent: reg.groups.absent.map(function (x) {
        return { name: x.name, unit: x.unit, neverLoggedIn: !!x.neverLoggedIn };
      })
    }
  };
}


/* ===================================================================
 *  THE DAILY TIME BLOCKS
 *
 *  Two notes a day, one at 10:00 and one at 15:00, each asking one
 *  question: what did you actually do since the last one. The morning
 *  note covers 3pm yesterday to 10am today; the afternoon note covers
 *  10am to 3pm. Between them they cover the working day without ever
 *  asking anybody to remember more than five hours back, which is the
 *  only window people answer honestly.
 *
 *  WHY THE E-MAIL CARRIES ONE BUTTON AND NOT ONE LINK PER ACTIVITY.
 *
 *  The obvious design is a grid of links in the e-mail — tap
 *  "Prospecting" and it is logged, never open a page. It cannot be
 *  built that way. Microsoft Defender and most corporate mail
 *  gateways FETCH every link in a message to check it before the
 *  recipient sees it, and this branch is on Microsoft 365. A link
 *  that records an activity would be recorded by the scanner, for
 *  everybody, every morning, and the branch's first time-use model
 *  would be made of work nobody did.
 *
 *  So the e-mail holds one link to a page, and the clicking happens
 *  there. A scanner that follows it marks the row opened and nothing
 *  else. It is still one tap from the e-mail to the chips.
 *
 *  Everything on that page is a GET, including the save, because an
 *  HtmlService page is served from a different origin than /exec and
 *  a POST from it is a CORS problem with no good answer. A plain form
 *  with method="get" has none of that and needs no JavaScript, which
 *  also means it works in the in-app browser of every mail client.
 * =================================================================== */

var ACTIVITY = {
  TAB: 'Activity',

  /*  Who is asked. Staff keep their own KPI block and are not asked
   *  these questions yet — add 'staff' here when that changes. */
  SEND_TO: ['agent', 'manager'],

  /*  A person may answer a block until this many hours after it
   *  opened. After that the row stands as it is, so a week's figures
   *  stop moving once the week is over. */
  OPEN_HOURS: 20,

  /*  Categories in these groups are never reported against a named
   *  person to anybody but that person. See activityStats_. */
  PRIVATE_GROUPS: ['life']
};

/*  The two blocks. `from` and `to` are read as hours on a 24h clock;
 *  `backDays` says how far back the window starts. */
var ACTIVITY_BLOCKS = [
  { key: 'morning',   hour: 10, from: 15, backDays: 1, to: 10,
    label: 'Morning check', window: 'since 3pm yesterday' },
  { key: 'afternoon', hour: 15, from: 10, backDays: 0, to: 15,
    label: 'Afternoon check', window: 'since 10 this morning' }
];

/*  THE ACTIVITIES.
 *
 *  Short, concrete, and things a person either did or did not do —
 *  never a judgement of how well. Keep this list under about a dozen
 *  per role: a list long enough to need scrolling is a list people
 *  stop reading and start tapping the first three of.
 *
 *  `group` drives the roll-up and the privacy rule, not the colour.  */
var ACTIVITY_SETS = {
  agent: [
    { k: 'prospect', label: 'Prospecting',        group: 'work' },
    { k: 'calls',    label: 'Calls made',          group: 'work' },
    { k: 'seen',     label: 'Seen a client',       group: 'work' },
    { k: 'factfind', label: 'Fact find',           group: 'work' },
    { k: 'leads',    label: 'Followed up leads',   group: 'work' },
    { k: 'app',      label: 'Application in',      group: 'work' },
    { k: 'service',  label: 'Serviced a client',   group: 'service' },
    { k: 'quote',    label: 'Quote or proposal',   group: 'work' },
    { k: 'admin',    label: 'Paperwork and admin', group: 'admin' },
    { k: 'training', label: 'Training or study',   group: 'growth' },
    { k: 'team',     label: 'Branch or team time', group: 'admin' }
  ],
  manager: [
    { k: 'portfolio', label: 'My own portfolio',    group: 'work' },
    { k: 'coach',     label: 'Coaching an agent',   group: 'growth' },
    { k: 'recruit',   label: 'Recruiting',          group: 'growth' },
    { k: 'seen',      label: 'Seen a client',       group: 'work' },
    { k: 'calls',     label: 'Calls made',          group: 'work' },
    { k: 'service',   label: 'Serviced a client',   group: 'service' },
    { k: 'branch',    label: 'Branch admin',        group: 'admin' },
    { k: 'head',      label: 'Head office',         group: 'admin' },
    { k: 'training',  label: 'Training or study',   group: 'growth' },
    { k: 'team',      label: 'Branch or team time', group: 'admin' }
  ],
  staff: [
    { k: 'sq',       label: 'Service questionnaires', group: 'work' },
    { k: 'claims',   label: 'Claims and servicing',   group: 'work' },
    { k: 'renewals', label: 'Renewals chased',        group: 'work' },
    { k: 'client',   label: 'Client calls',           group: 'work' },
    { k: 'admin',    label: 'Paperwork and admin',    group: 'admin' },
    { k: 'training', label: 'Training or study',      group: 'growth' },
    { k: 'team',     label: 'Branch or team time',    group: 'admin' }
  ]
};

/*  Asked of everybody, whatever their role. This is the half of the
 *  picture that the branch has never had: a day is not only selling,
 *  and a model built on work categories alone says a person who spent
 *  the morning at a funeral did nothing. */
var ACTIVITY_LIFE = [
  { k: 'family',     label: 'Family time',     group: 'life' },
  { k: 'personal',   label: 'Personal time',   group: 'life' },
  { k: 'recreation', label: 'Recreation',      group: 'life' },
  { k: 'rest',       label: 'Rest or unwell',  group: 'life' },
  { k: 'travel',     label: 'Travelling',      group: 'life' }
];

function activityBlock_(key) {
  for (var i = 0; i < ACTIVITY_BLOCKS.length; i++) {
    if (ACTIVITY_BLOCKS[i].key === key) return ACTIVITY_BLOCKS[i];
  }
  return null;
}

/** The chips a given role is shown: their own set, then the life set. */
function activityMenuFor_(role) {
  var set = ACTIVITY_SETS[low_(role)] || ACTIVITY_SETS.agent;
  return set.concat(ACTIVITY_LIFE);
}

function activityLabel_(role, k) {
  var menu = activityMenuFor_(role);
  for (var i = 0; i < menu.length; i++) if (menu[i].k === k) return menu[i].label;
  return k;
}

function activityGroup_(role, k) {
  var menu = activityMenuFor_(role);
  for (var i = 0; i < menu.length; i++) if (menu[i].k === k) return menu[i].group;
  return '';
}

function isPrivateGroup_(g) { return ACTIVITY.PRIVATE_GROUPS.indexOf(g) > -1; }

/** The date key a row is filed under — local date, not UTC, so a 3pm
 *  block never lands on the next day for a branch four hours west. */
function dayKey_(d) {
  return Utilities.formatDate(d || new Date(), tz_(), 'yyyy-MM-dd');
}

function activityRows_() { return readTab_(ACTIVITY.TAB); }

function findActivity_(day, blockKey, email) {
  var rows = activityRows_(), e = low_(email);
  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i]['Day']) === day &&
        str_(rows[i]['Block']) === blockKey &&
        low_(rows[i]['Email']) === e) return rows[i];
  }
  return null;
}

function findActivityByToken_(token) {
  var t = str_(token);
  if (!t) return null;
  var rows = activityRows_();
  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i]['Token']) === t) return rows[i];
  }
  return null;
}

function itemsOf_(row) {
  var raw = str_(row && row['Items']);
  if (!raw) return [];
  return raw.split(',').map(function (s) { return s.trim(); })
            .filter(function (s) { return !!s; });
}

/* ------------------------- the e-mail ------------------------- */

function activityEmail_(person, row, block, url) {
  var first = firstName_(person.name);
  var link = url + '?action=act&t=' + encodeURIComponent(str_(row['Token']));
  var done = itemsOf_(row).length;

  var subject = block.label + ' — ' + (done ? 'add to your answer' : 'what did you get done?');

  var html =
    '<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#07131f;padding:26px 16px">' +
    '<div style="max-width:520px;margin:0 auto;background:#0d2439;border-radius:16px;overflow:hidden;' +
    'border:1px solid rgba(255,255,255,.11)">' +

    '<div style="padding:20px 24px 4px">' +
    '<img src="' + IBRAND_LOGO_() + '" width="38" height="38" alt="" ' +
    'style="border-radius:11px;display:block;margin-bottom:12px">' +
    '<div style="color:#f5b93b;font-size:11px;letter-spacing:.09em;text-transform:uppercase;' +
    'font-weight:700">' + esc_(block.label) + '</div>' +
    '<div style="color:#eaf4ff;font-size:19px;font-weight:700;margin-top:5px">' +
    esc_(first) + ', what did you get done ' + esc_(block.window) + '?</div>' +
    '<div style="color:#9dbdd8;font-size:13.5px;line-height:1.6;margin-top:9px">' +
    'Tap through and pick what you did. It takes about fifteen seconds and there is ' +
    'nothing to type unless you want to.' +
    '</div>' +
    '</div>' +

    '<div style="padding:18px 24px 24px">' +
    '<a href="' + esc_(link) + '" ' +
    'style="display:block;text-align:center;background:#f5b93b;color:#07131f;text-decoration:none;' +
    'font-weight:700;font-size:15px;padding:14px 18px;border-radius:11px">' +
    (done ? 'Add to my answer' : 'Pick what I did') + '</a>' +
    (done
      ? '<div style="color:#6d8ba6;font-size:12px;margin-top:11px;text-align:center">' +
        'You have ' + done + ' logged for this block already.</div>'
      : '') +
    '</div>' +

    '<div style="padding:14px 24px 20px;border-top:1px solid rgba(255,255,255,.09);' +
    'color:#6d8ba6;font-size:11.5px;line-height:1.65">' +
    'Your personal time is yours. Family, rest and recreation are counted for the branch as a ' +
    'whole and are never shown against your name.' +
    '</div>' +

    '</div></div>';

  return { subject: subject, html: html };
}

/*  The branch mark, hosted. In e-mail it must be a hosted PNG — Gmail
 *  strips SVG and blocks data: URIs, and the masthead arrives empty. */
function IBRAND_LOGO_() { return 'https://rickyrampersadbranch.com/logo-mark.png'; }

/* ------------------------- sending ------------------------- */

/** Open one block and write to everybody it is for. Safe to run twice:
 *  a person who already has a row for this block keeps it, token and
 *  answers intact, and is simply written to again. */
function activityCheck_(blockKey) {
  var block = activityBlock_(blockKey);
  if (!block) throw new Error('No such block: ' + blockKey);

  var now = new Date();
  var w = now.getDay();
  if (w === 0 || w === 6) { Logger.log('Weekend — no check.'); return 'Weekend — no check.'; }

  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (err) { url = ''; }
  if (!url) throw new Error('The web app is not deployed yet, so there is no link to send.');

  var day = dayKey_(now);
  var sent = 0, skipped = 0, failed = 0;

  everyone_().forEach(function (p) {
    if (!p.email) { skipped++; return; }
    if (ACTIVITY.SEND_TO.indexOf(low_(p.role)) === -1) { skipped++; return; }

    var row = findActivity_(day, block.key, p.email);
    if (!row) {
      var id = uid_('act');
      appendRow_(ACTIVITY.TAB, {
        'ID': id, 'Day': day, 'Block': block.key, 'Email': p.email, 'Name': p.name,
        'Role': p.role, 'Unit': p.unit, 'Token': makeToken_(), 'Sent': now, 'Items': ''
      });
      row = findActivity_(day, block.key, p.email);
      if (!row) { failed++; return; }
    } else {
      setCell_(ACTIVITY.TAB, row._row, 'Sent', now);
    }

    var mail = activityEmail_(p, row, block, url);
    try {
      MailApp.sendEmail({ to: p.email, subject: mail.subject, htmlBody: mail.html,
                          name: MEET.BRANCH });
      sent++;
    } catch (err) {
      failed++;
      Logger.log('Could not write to ' + p.email + ': ' + err);
    }
  });

  var msg = block.label + ': ' + sent + ' sent, ' + skipped + ' not asked, ' + failed + ' failed.';
  log_('activity-check', 'system', '', block.key, msg);
  Logger.log(msg);
  return msg;
}

/*  Two named handlers, because a time trigger cannot carry an
 *  argument. */
function activityMorning()   { return activityCheck_('morning'); }
function activityAfternoon() { return activityCheck_('afternoon'); }

/** Install both daily triggers. Safe to run again — it clears its own
 *  first, so pressing the menu item twice never doubles the notes. */
function installActivityChecks() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'activityMorning' || f === 'activityAfternoon') ScriptApp.deleteTrigger(t);
  });
  ACTIVITY_BLOCKS.forEach(function (b) {
    ScriptApp.newTrigger(b.key === 'morning' ? 'activityMorning' : 'activityAfternoon')
      .timeBased().atHour(b.hour).everyDays(1).create();
  });
  var msg = 'Time blocks are on: a note at about ' + ACTIVITY_BLOCKS[0].hour + ':00 and ' +
    'another at about ' + ACTIVITY_BLOCKS[1].hour + ':00, weekdays only. ' +
    'Asked of: ' + ACTIVITY.SEND_TO.join(' and ') + '.';
  Logger.log(msg);
  return msg;
}

function installActivityChecksFromMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.alert('The daily time blocks', installActivityChecks(), ui.ButtonSet.OK);
}

/** Send yourself the next block, to read it before the branch does. */
function previewActivityCheck() {
  var me = findPersonByEmail_(MEET.ADMIN_EMAIL) || readPeople_()[0];
  if (!me) throw new Error('Nobody on the People tab yet.');
  var url = ScriptApp.getService().getUrl() || '';
  if (!url) throw new Error('The web app is not deployed yet, so there is no link to send.');

  var block = new Date().getHours() < 13 ? ACTIVITY_BLOCKS[0] : ACTIVITY_BLOCKS[1];
  var day = dayKey_(new Date());
  var row = findActivity_(day, block.key, me.email);
  if (!row) {
    appendRow_(ACTIVITY.TAB, {
      'ID': uid_('act'), 'Day': day, 'Block': block.key, 'Email': me.email, 'Name': me.name,
      'Role': me.role, 'Unit': me.unit, 'Token': makeToken_(), 'Sent': new Date(), 'Items': ''
    });
    row = findActivity_(day, block.key, me.email);
  }
  var mail = activityEmail_(me, row, block, url);
  MailApp.sendEmail({ to: me.email, subject: '[Preview] ' + mail.subject,
                      htmlBody: mail.html, name: MEET.BRANCH });
  return 'Sent to ' + me.email + '.';
}

/* ------------------------- the page ------------------------- */

/*  Served as HTML, not JSON, because this is the one place in the app
 *  a person arrives from their inbox rather than from the meeting
 *  front end. Every control on it is a GET for the reason in the
 *  header comment. */
function activityPage_(p) {
  var row = findActivityByToken_(p.token || p.t);
  if (!row) return activityShell_('That link has expired',
    'Ask for the next check, or open the meeting app and log it there.', '');

  var block = activityBlock_(str_(row['Block'])) || ACTIVITY_BLOCKS[0];
  var role = low_(row['Role']) || 'agent';
  var menu = activityMenuFor_(role);

  /*  A block closes so that last week's figures cannot move after the
   *  week is counted. */
  var sent = asDate_(row['Sent']);
  var hours = sent ? (new Date().getTime() - sent.getTime()) / 36e5 : 0;
  var closed = hours > ACTIVITY.OPEN_HOURS;

  var items = itemsOf_(row);
  var changed = false;

  if (!closed) {
    var add = str_(p.k), drop = str_(p.x);
    if (add) {
      var known = false;
      for (var i = 0; i < menu.length; i++) if (menu[i].k === add) known = true;
      if (known && items.indexOf(add) === -1) { items.push(add); changed = true; }
    }
    if (drop && items.indexOf(drop) > -1) {
      items.splice(items.indexOf(drop), 1); changed = true;
    }
    if (changed) setCell_(ACTIVITY.TAB, row._row, 'Items', items.join(','));

    if ('well' in p || 'blocker' in p) {
      setCell_(ACTIVITY.TAB, row._row, 'Went Well', str_(p.well).slice(0, 500));
      setCell_(ACTIVITY.TAB, row._row, 'In The Way', str_(p.blocker).slice(0, 500));
      changed = true;
    }
    if (changed || !row['Answered']) {
      setCell_(ACTIVITY.TAB, row._row, 'Answered', new Date());
      row['Answered'] = new Date();
    }
  }
  if (!row['Opened']) setCell_(ACTIVITY.TAB, row._row, 'Opened', new Date());

  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (err) { url = ''; }
  var base = url + '?action=act&t=' + encodeURIComponent(str_(row['Token']));

  /* --- the chips --- */
  var work = [], life = [];
  menu.forEach(function (a) {
    var on = items.indexOf(a.k) > -1;
    var href = base + (on ? '&x=' : '&k=') + encodeURIComponent(a.k);
    var chip =
      '<a class="chip' + (on ? ' on' : '') + '" href="' + esc_(href) + '">' +
      (on ? '<span class="tick">&#10003;</span>' : '') + esc_(a.label) + '</a>';
    if (a.group === 'life') life.push(chip); else work.push(chip);
  });

  var body =
    '<div class="eyebrow">' + esc_(block.label) + '</div>' +
    '<h1>What did you get done ' + esc_(block.window) + '?</h1>' +
    (closed
      ? '<p class="closed">This block has closed, so it cannot be changed now. ' +
        'What is below is what was recorded.</p>'
      : '<p class="lede">Tap everything that applies. It saves as you go &mdash; ' +
        'there is no button to press at the end.</p>') +

    '<div class="group"><h2>Your work</h2><div class="chips">' + work.join('') + '</div></div>' +

    '<div class="group"><h2>Your time</h2>' +
    '<p class="priv">Counted for the branch as a whole. Never shown against your name.</p>' +
    '<div class="chips">' + life.join('') + '</div></div>';

  if (!closed) {
    body +=
      '<form class="group" method="get" action="' + esc_(url) + '">' +
      '<input type="hidden" name="action" value="act">' +
      '<input type="hidden" name="t" value="' + esc_(str_(row['Token'])) + '">' +
      '<h2>Anything worth saying?</h2>' +
      '<label>What went well</label>' +
      '<input type="text" name="well" maxlength="500" autocomplete="off" ' +
      'value="' + esc_(str_(row['Went Well'])) + '" placeholder="One line. Optional.">' +
      '<label>What is in the way</label>' +
      '<input type="text" name="blocker" maxlength="500" autocomplete="off" ' +
      'value="' + esc_(str_(row['In The Way'])) + '" placeholder="One line. Optional.">' +
      '<button type="submit">Save these two lines</button>' +
      '</form>';
  } else if (str_(row['Went Well']) || str_(row['In The Way'])) {
    body += '<div class="group"><h2>What you said</h2>' +
      (str_(row['Went Well']) ? '<p class="said">' + esc_(str_(row['Went Well'])) + '</p>' : '') +
      (str_(row['In The Way']) ? '<p class="said">' + esc_(str_(row['In The Way'])) + '</p>' : '') +
      '</div>';
  }

  var count = items.length;
  body += '<div class="done">' +
    (count ? count + ' logged for this block. You can close this page.'
           : 'Nothing logged yet — a block with nothing in it is recorded as nothing done.') +
    '</div>';

  return activityShell_('Your ' + block.label.toLowerCase(), '', body);
}

/** The page frame. Inline styles only: an HtmlService page cannot
 *  reach the branch stylesheet, and a web font is one more thing to
 *  fail on a phone with one bar. */
function activityShell_(title, message, body) {
  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc_(title) + '</title><style>' +
    '*{box-sizing:border-box}' +
    'body{margin:0;background:#07131f;color:#eaf4ff;padding:22px 16px 44px;' +
    'font-family:Inter,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}' +
    '.wrap{max-width:520px;margin:0 auto}' +
    '.eyebrow{color:#f5b93b;font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:700}' +
    'h1{font-size:21px;line-height:1.3;margin:7px 0 10px;font-weight:700}' +
    'h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6d8ba6;' +
    'margin:0 0 10px;font-weight:700}' +
    '.lede,.closed{color:#9dbdd8;font-size:14px;line-height:1.6;margin:0 0 20px}' +
    '.closed{color:#ffb4ab}' +
    '.priv{color:#6d8ba6;font-size:12px;line-height:1.55;margin:-4px 0 10px}' +
    '.group{margin:26px 0 0}' +
    '.chips{display:flex;flex-wrap:wrap;gap:8px}' +
    '.chip{display:inline-block;text-decoration:none;font-size:14px;font-weight:600;' +
    'padding:11px 15px;border-radius:999px;border:1px solid rgba(255,255,255,.17);' +
    'color:#eaf4ff;background:rgba(255,255,255,.055);line-height:1}' +
    '.chip.on{background:#f5b93b;border-color:#f5b93b;color:#07131f}' +
    '.tick{margin-right:6px;font-weight:800}' +
    'label{display:block;font-size:12.5px;color:#9dbdd8;margin:12px 0 5px}' +
    'input[type=text]{width:100%;padding:12px 13px;border-radius:11px;font-size:15px;' +
    'border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.055);color:#eaf4ff}' +
    'input::placeholder{color:#5d7b96}' +
    'button{margin-top:14px;width:100%;padding:13px;border:none;border-radius:11px;' +
    'background:#f5b93b;color:#07131f;font-size:15px;font-weight:700}' +
    '.done{margin:30px 0 0;padding-top:16px;border-top:1px solid rgba(255,255,255,.11);' +
    'color:#6d8ba6;font-size:12.5px;line-height:1.6}' +
    '.said{color:#9dbdd8;font-size:14px;line-height:1.6;margin:0 0 8px}' +
    '.msg{color:#9dbdd8;font-size:15px;line-height:1.6}' +
    '</style></head><body><div class="wrap">' +
    (body || ('<h1>' + esc_(title) + '</h1><p class="msg">' + esc_(message) + '</p>')) +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle(title);
}

/* ------------------------- the intelligence ------------------------- */

/*  WHAT THIS DELIBERATELY WILL NOT DO.
 *
 *  Personal time is asked for so that a day adds up, not so that it
 *  can be read back to a manager. Anything in ACTIVITY.PRIVATE_GROUPS
 *  is counted for the branch and stripped from every per-person
 *  figure unless the person asking IS that person. Take that rule out
 *  and the honest answers go with it: people do not log family time
 *  twice a day for a system that reports it upwards.              */
function activityStats_(days, viewerEmail) {
  days = num_(days) || 7;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  var cutKey = dayKey_(cutoff);
  var viewer = low_(viewerEmail);

  var rows = activityRows_().filter(function (r) { return str_(r['Day']) >= cutKey; });

  var byPerson = {}, catCount = {}, groupCount = {};
  var asked = 0, answered = 0, notes = [];

  rows.forEach(function (r) {
    var email = low_(r['Email']);
    var role = low_(r['Role']) || 'agent';
    var items = itemsOf_(r);
    var did = items.length > 0;

    asked++;
    if (did) answered++;

    if (!byPerson[email]) {
      byPerson[email] = { email: email, name: str_(r['Name']), unit: str_(r['Unit']),
                          role: role, asked: 0, answered: 0, items: 0, top: {} };
    }
    var P = byPerson[email];
    P.asked++;
    if (did) P.answered++;

    items.forEach(function (k) {
      var g = activityGroup_(role, k);
      var label = activityLabel_(role, k);

      /* Branch totals count everything, including personal time. */
      catCount[label] = (catCount[label] || 0) + 1;
      groupCount[g] = (groupCount[g] || 0) + 1;

      /* Per-person totals never carry a private group to anybody
         but its owner. */
      if (isPrivateGroup_(g) && email !== viewer) return;
      P.items++;
      P.top[label] = (P.top[label] || 0) + 1;
    });

    var well = str_(r['Went Well']), inway = str_(r['In The Way']);
    if (well)  notes.push({ when: str_(r['Day']), block: str_(r['Block']),
                            name: str_(r['Name']), kind: 'well', body: well });
    if (inway) notes.push({ when: str_(r['Day']), block: str_(r['Block']),
                            name: str_(r['Name']), kind: 'blocker', body: inway });
  });

  var people = Object.keys(byPerson).map(function (e) {
    var P = byPerson[e];
    P.rate = P.asked ? Math.round(P.answered / P.asked * 100) : 0;
    P.top = Object.keys(P.top).map(function (l) { return { label: l, n: P.top[l] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 4);
    return P;
  }).sort(function (a, b) { return b.answered - a.answered || a.name.localeCompare(b.name); });

  var categories = Object.keys(catCount).map(function (l) { return { label: l, n: catCount[l] }; })
    .sort(function (a, b) { return b.n - a.n; });

  var workish = (groupCount.work || 0) + (groupCount.service || 0) +
                (groupCount.admin || 0) + (groupCount.growth || 0);

  return {
    days: days,
    from: cutKey,
    to: dayKey_(new Date()),
    asked: asked,
    answered: answered,
    rate: asked ? Math.round(answered / asked * 100) : 0,
    silent: people.filter(function (p) { return !p.answered; })
                  .map(function (p) { return p.name || p.email; }),
    people: people,
    categories: categories,
    groups: groupCount,
    split: { work: workish, life: groupCount.life || 0 },
    notes: notes.sort(function (a, b) { return a.when < b.when ? 1 : -1; }).slice(0, 40)
  };
}

/** The app's view. An agent sees their own; staff and the manager see
 *  the branch, with personal time in the totals and in nobody's row. */
function apiActivity_(token, days) {
  var me = requireUser_(token);
  var stats = activityStats_(days, me.email);
  if (!isStaff_(me)) {
    stats.people = stats.people.filter(function (p) { return p.email === me.email; });
    stats.notes = stats.notes.filter(function (n) { return n.name === me.name; });
    stats.silent = [];
  }
  return { ok: true, me: publicUser_(me), activity: stats };
}


function doGet(e) {
  var p = (e && e.parameter) || {};

  /*  The activity check is served as a PAGE and must return before the
   *  JSON switch below. It is the one route a person reaches from
   *  their inbox rather than from the meeting front end, so it answers
   *  in HTML a phone can read, not in JSON. */
  if (str_(p.action) === 'act') {
    try { return activityPage_(p); }
    catch (err) {
      return activityShell_('Something went wrong',
        String(err && err.message ? err.message : err), '');
    }
  }

  var out;
  try {
    switch (str_(p.action) || 'home') {
      case 'home':       out = apiHome_(p.token); break;
      case 'wall':       out = apiWall_(p.code, p.id); break;
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
      case 'activity':   out = apiActivity_(p.token, p.days); break;
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
    .addItem('🪪  Pull the roster from the Agent Skill Bank', 'promptPullAccessCodes')
    .addItem('🔁  Set up the standing rota', 'seedRotaFromMenu')
    .addSeparator()
    .addItem('📨  Turn on the daily note', 'installDailyNoteFromMenu')
    .addItem('👁  Send me today\u2019s note to read', 'previewDailyNote')
    .addSeparator()
    .addItem('⏱  Turn on the daily time blocks', 'installActivityChecksFromMenu')
    .addItem('👁  Send me a time-block check to read', 'previewActivityCheck')
    .addItem('🔑  Set the branch code', 'promptBranchCode')
    .addItem('🔗  Show the app URL', 'showAppUrl')
    .addToUi();
}

/*  THE CODE THEY ALREADY HAVE, NOT A NEW ONE.
 *
 *  The agents' access codes live in the Agent Skill Bank on the
 *  branch portfolio sheet, which is a different spreadsheet from
 *  this one. Copying thirty-nine codes across by hand is how a
 *  roster ends up one letter wrong for two people who then cannot
 *  get into a meeting that is marking them absent, so this reads
 *  them straight off that sheet and writes them onto People,
 *  matching on e-mail.
 *
 *  The sheet id goes in a Script Property, never in this file: these
 *  .gs files are published on the branch site.
 *
 *  It only ever fills a blank or replaces a code that has changed,
 *  and it never creates a person — somebody who is not on the
 *  meeting roster is reported back rather than added, because who
 *  belongs in a branch meeting is the manager's call, not the skill
 *  bank's.
 */
function pullRoster(sheetId) {
  sheetId = str_(sheetId) ||
    PropertiesService.getScriptProperties().getProperty('ROSTER_SHEET_ID') || '';
  if (!sheetId) throw new Error('No Branch Portfolio sheet id set.');
  var mm = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);   // a pasted link works too
  if (mm) sheetId = mm[1];

  var ss = SpreadsheetApp.openById(sheetId);
  var sh = null;
  ss.getSheets().forEach(function (s) {
    if (low_(s.getName()).indexOf('agent skill bank') > -1) sh = s;
  });
  if (!sh) throw new Error('No "Agent Skill Bank" tab on that sheet.');

  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('The Agent Skill Bank tab is empty.');

  /*  The tab carries two columns called Active and two that begin
   *  "Agent" — the name and the number. A contains-match picks the
   *  wrong one of each, so every header is matched exactly first and
   *  only then loosely, and the FIRST hit wins.                    */
  var head = values[0].map(function (h) { return low_(h).replace(/[^a-z0-9]/g, ''); });
  var col = function (exact, loose) {
    for (var i = 0; i < head.length; i++) if (exact.indexOf(head[i]) > -1) return i;
    if (loose) for (var j = 0; j < head.length; j++) {
      for (var k = 0; k < loose.length; k++) if (head[j].indexOf(loose[k]) > -1) return j;
    }
    return -1;
  };
  var cName  = col(['agent', 'name']);
  var cNo    = col(['agentno', 'agentnumber', 'no'], ['agentno']);
  var cPass  = col(['password'], ['password']);
  var cRole  = col(['role']);
  var cUnit  = col(['unit']);
  var cAct   = col(['active']);
  var cMail  = col(['email', 'email2'], ['mail']);
  var cCode  = col(['portalcode'], ['portalcode', 'accesscode']);
  if (cNo === -1 && cMail === -1) {
    throw new Error('That tab has neither an agent number column nor an e-mail column.');
  }

  var people = readPeople_();
  var byNo = {}, byMail = {};
  people.forEach(function (p) {
    if (p.agentNo) byNo[normNo_(p.agentNo)] = p;
    if (p.email) byMail[p.email] = p;
  });

  var added = 0, updated = 0, pwset = 0, skipped = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var name = cName > -1 ? str_(row[cName]) : '';
    var no   = cNo   > -1 ? str_(row[cNo])   : '';
    var mail = cMail > -1 ? low_(row[cMail]) : '';
    var pass = cPass > -1 ? str_(row[cPass]) : '';
    if (!name && !no && !mail) continue;
    if (!no && mail.indexOf('@') < 1) { skipped.push(name || '(row ' + (r + 1) + ')'); continue; }

    var role = cRole > -1 ? low_(row[cRole]) : '';
    if (ROLES.indexOf(role) === -1) role = 'agent';
    var unit = cUnit > -1 ? str_(row[cUnit]) : '';
    var active = cAct > -1 ? (yes_(row[cAct]) ? 'Y' : 'N') : 'Y';
    var code = cCode > -1 ? str_(row[cCode]) : '';

    var p = (no && byNo[normNo_(no)]) || (mail && byMail[mail]) || null;

    if (!p) {
      var salt0 = Utilities.getUuid();
      appendRow_(MEET.TAB_PEOPLE, {
        'Agent No': no, 'Email': mail, 'Name': name || mail || no, 'Role': role,
        'Unit': unit, 'Active': active, 'Access Code': code,
        'PIN Hash': pass ? hashPin_(pass, salt0) : '', 'Salt': pass ? salt0 : '',
        'Added': new Date(), 'Added By': 'Agent Skill Bank'
      });
      added++;
      if (pass) pwset++;
      continue;
    }

    if (no   && normNo_(no) !== normNo_(p.agentNo)) setCell_(MEET.TAB_PEOPLE, p._row, 'Agent No', no);
    if (mail && mail !== p.email)                   setCell_(MEET.TAB_PEOPLE, p._row, 'Email', mail);
    if (name && name !== p.name)                    setCell_(MEET.TAB_PEOPLE, p._row, 'Name', name);
    if (unit)                                       setCell_(MEET.TAB_PEOPLE, p._row, 'Unit', unit);
    setCell_(MEET.TAB_PEOPLE, p._row, 'Active', active);
    /*  The manager's own role is never demoted by a pull. The skill
     *  bank calls everybody an agent, and a pull that quietly took the
     *  branch manager's own access away would lock the one person who
     *  can put it back.                                             */
    if (p.role !== 'manager') setCell_(MEET.TAB_PEOPLE, p._row, 'Role', role);
    if (code) setCell_(MEET.TAB_PEOPLE, p._row, 'Access Code', code);

    /*  The password is hashed here and the plain one is dropped. A
     *  pull that found no password leaves whatever they already had,
     *  so a blank cell on the skill bank never locks somebody out.  */
    if (pass) {
      var salt = Utilities.getUuid();
      setCell_(MEET.TAB_PEOPLE, p._row, 'Salt', salt);
      setCell_(MEET.TAB_PEOPLE, p._row, 'PIN Hash', hashPin_(pass, salt));
      setCell_(MEET.TAB_PEOPLE, p._row, 'Attempts', 0);
      setCell_(MEET.TAB_PEOPLE, p._row, 'Locked Until', '');
      pwset++;
    }
    updated++;
  }

  PropertiesService.getScriptProperties().setProperty('ROSTER_SHEET_ID', sheetId);
  log_('pull-roster', 'system', 'manager', 'People',
    added + ' added, ' + updated + ' updated, ' + pwset + ' passwords set');

  var msg = added + ' added, ' + updated + ' updated. ' +
    pwset + ' password' + (pwset === 1 ? '' : 's') + ' taken across and hashed — ' +
    'no password is stored in the meeting sheet.';
  if (skipped.length) {
    msg += '\n\n' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's') +
      ' had neither an agent number nor an e-mail and were skipped:\n' +
      skipped.slice(0, 15).join('\n') +
      (skipped.length > 15 ? '\n…and ' + (skipped.length - 15) + ' more' : '');
  }
  var shut = readPeople_().filter(function (p) { return p.active && !p.hash && !p.code; });
  if (shut.length) {
    msg += '\n\n' + shut.length + ' active people still have no password and no code, so they ' +
      'cannot sign in and will be marked absent:\n' +
      shut.slice(0, 15).map(function (p) {
        return p.name + (p.agentNo ? ' (' + p.agentNo + ')' : '');
      }).join('\n') +
      (shut.length > 15 ? '\n…and ' + (shut.length - 15) + ' more' : '');
  }
  Logger.log(msg);
  return msg;
}

/* The old name, kept so anything that called it still works. */
function pullAccessCodes(sheetId) { return pullRoster(sheetId); }


function promptPullAccessCodes() {
  var ui = SpreadsheetApp.getUi();
  var saved = PropertiesService.getScriptProperties().getProperty('ROSTER_SHEET_ID') || '';
  var res = ui.prompt('Pull the roster from the Agent Skill Bank',
    'Paste the link to the spreadsheet that holds the Agent Skill Bank\n' +
    'tab. Name, agent number, role, unit and active come across; the\n' +
    'password is hashed on the way in and never stored here.' +
    (saved ? '\n\n(Last used: ' + saved + ')' : ''), ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var id = res.getResponseText().trim() || saved;
  if (!id) return;
  try {
    ui.alert('The roster', pullRoster(id), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('The roster', String(err && err.message ? err.message : err), ui.ButtonSet.OK);
  }
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

/** Set the branch code without redeploying. */
function promptBranchCode() {
  var ui = SpreadsheetApp.getUi();
  var now = joinCode_();
  var res = ui.prompt('The branch code',
    'People type this once, when they set their PIN.\n\n' +
    'It is now: ' + now + '\n\n' +
    'Type a new one and press OK, or Cancel to leave it alone.\n' +
    'It takes effect immediately — no redeploy.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var v = res.getResponseText().trim();
  if (!v) return;
  PropertiesService.getScriptProperties().setProperty('JOIN_CODE', v);
  log_('branch-code', 'menu', '', 'JOIN_CODE', 'Changed');
  ui.alert('The branch code is now:\n\n' + v + '\n\n' +
    'Anyone setting up a PIN types this. Change it again once everyone has enrolled.');
}

function showAppUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('Branch Meeting Builder\n\n' +
    (url ? url : 'Not deployed yet — Deploy > New deployment > Web app.') +
    '\n\nPaste this into CONFIG.API_URL in meetings/index.html.');
}
