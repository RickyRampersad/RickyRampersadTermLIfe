/**
 * ============================================================
 *  THE ONE-OFF MEETING — Ricky Rampersad Branch
 * ============================================================
 *
 *  A second file in the Branch Meeting Builder project. It holds
 *  nothing but a SPEC and a seeder, so building a one-off meeting
 *  is one press rather than thirty cells typed into a sheet on the
 *  night before.
 *
 *  WHY A ONE-OFF IS ITS OWN THING
 *
 *  The branch meets on a Wednesday. MEET.MEETING_DAY is 3 and every
 *  sentence a person reads takes the day from there, so a one-off on
 *  a Friday must NEVER be built by moving that number: it would
 *  rename the standing rhythm, the daily note's countdown and the
 *  week cycle along with it. A one-off is its own row, with its own
 *  Ref, beside the standing meetings.
 *
 *  THE REGISTER STILL HAS TO TELL THE TRUTH
 *
 *  Signing in IS the register, and from 6 October 2026 a person who
 *  does not sign in is absent. So the check-in window opens on the
 *  MORNING OF THE MEETING and not before. People are meant to open
 *  this meeting the day before, read it and say what they are
 *  bringing — and none of that may mark them present at a meeting
 *  that has not happened. Two different things:
 *
 *    Status 'published'   they can open it, read it, contribute to it
 *    Check-In Opens       the register, on the day, in the window
 *
 *  A meeting left at 'draft' is staff-only, so an agent would see
 *  nothing at all. That is the trap this file exists to avoid.
 *
 *  HOW TO RUN IT
 *
 *  From the Apps Script editor, pick seedFridayMeeting and press Run.
 *  It writes nothing twice: it finds the meeting by its Ref, brings
 *  the row into line with the spec and rebuilds its agenda, so it can
 *  be run again after an edit without a second meeting appearing.
 *
 *  It is deliberately NOT a menu item. onOpen lives in Meetings.gs
 *  and a second onOpen in the same project silently replaces the
 *  first, which would take the whole Branch Meetings menu away.
 *
 *  NOTHING HERE HOLDS BRANCH DATA. Presenters are resolved from the
 *  People tab by ROLE at run time, never written in — this file is
 *  published on the branch site.
 * ============================================================
 */

/*  FRIDAY 30 OCTOBER 2026, 12 NOON — the meet-and-discuss after the
 *  Joint Sales Managers' Strategic Meeting of 22 and 23 October.
 *
 *  The agenda is built from what the branch actually took into that
 *  meeting (strategic-meeting/index.html, the OBJECTIVE lines) and
 *  what the sessions asked. The point of the Friday is the half that
 *  listens, so THE FLOOR IS THE LONGEST ITEM ON IT — 25 of 90
 *  minutes. Anything that pushes the floor under twenty minutes has
 *  turned a meet-and-discuss back into a briefing.
 *
 *  Every item carries its QUESTION in Detail, because a question is
 *  what a person can answer the day before. An item with a title and
 *  no question gets read and nothing comes back.                   */
var FRIDAY = {
  REF: 'MD-2026-10-30',
  TYPE: 'Meet & Discuss',
  TITLE: 'Back from the retreat: shaping FY27',
  SUBTITLE: 'What we took to the company, what came back, and what you say',

  /*  yyyy-MM-dd and the 24-hour-ish forms the app's own time field
   *  takes, so the row reads the same as a row typed in the app. */
  DATE: '2026-10-30',
  START: '12:00 PM',
  END: '1:30 PM',
  FORMAT: 'In-person',
  LOCATION: '',                 /* the branch fills this in */

  /*  The register, on the day only. 11:30 gives the room half an
   *  hour to arrive and be counted before the clock starts.      */
  CHECKIN_OPENS: '11:30 AM',
  CHECKIN_CLOSES: '1:30 PM',
  LATE_AFTER: 10,

  MISSION: 'Every voice heard, with a structure.',

  PURPOSE:
    'Akaash and I were at the company’s Joint Sales Managers’ Strategic ' +
    'Meeting on 22 and 23 October. This is where we share what came out of it ' +
    'and hear the whole team as we shape FY27. The financial year started on ' +
    '1 October and every goal plan is in. Reset, recharge, refine — and the ' +
    'direction gets set with you, not for you.',

  /*  What went in on the branch's behalf. These are the branch's own
   *  five objectives for the retreat, so the team reads the same
   *  words the company heard.                                      */
  PRE_READ: [
    'What the branch took to the company, in five lines:',
    '1. Put the record on the table: a branch run on analytics, every desk accountable every day, is where the company says it wants to go, and it is running now.',
    '2. Get business preserved recognised beside business produced, with a unit the system can count: a review filed, a conversion, a premium retained.',
    '3. Get a company standard for writing to a departed agent’s book inside days, in the company’s words, and a counted rebuilding period for the manager who loses one.',
    '4. Get the readiness record accepted as the basis for advancement, ahead of tenure.',
    '5. Leave with an owner and a date on at least one of these.',
    '',
    'Read it before Friday and bring one line you want pushed.'
  ].join('\n'),

  /*  by: which role presents it, resolved against the People tab at
   *  run time. 'chair' is the branch manager, 'unitmgr' the unit
   *  manager, and '' means the item belongs to the room.          */
  AGENDA: [
    { section: 'Opening', by: 'chair', mins: 8,
      title: 'Where the year stands, 30 days in',
      detail: 'FY27 started on 1 October. Every goal plan is in — all of them, 30 days in. ' +
              'Question: what have your first 30 days told you that your plan did not?' },

    { section: 'Report back', by: 'chair', mins: 10,
      title: 'What we took to the company',
      detail: 'Five things went in on the branch’s behalf — they are in the pre-read. ' +
              'Question: which one of the five matters most to your week, and why that one?' },

    { section: 'Report back', by: 'chair', mins: 12,
      title: 'What came back: business preserved counts',
      detail: 'The company put the question itself: should the business we preserve be ' +
              'recognised alongside the business we produce? ' +
              'Question: if a review filed, a conversion or a premium retained earned the same ' +
              'recognition as new production, what would you do differently on Monday?' },

    { section: 'The path', by: 'unitmgr', mins: 10,
      title: 'Moving by record, not by tenure',
      detail: 'Advancement by a record anyone can read: recruits licensed and still producing ' +
              'at twelve and twenty-four months, persistency, a unit’s closures. ' +
              'Question: what is the next step you want, and what would you need to show for it?' },

    { section: 'The work', by: 'unitmgr', mins: 12,
      title: 'Protecting what we win',
      detail: 'The orphan books, premium due at 45, 60, 75 and 90 days, contracts delivered ' +
              'inside 28 days, and the bag at 12 noon. ' +
              'Question: where does the work still fall down between you and the client?' },

    { section: 'The floor', by: '', mins: 25,
      title: 'Every voice — what you are bringing',
      detail: 'This is the half that listens, and it is the longest item on the agenda on purpose. ' +
              'Question: what do you want us to push this year, and what do you want us to fix? ' +
              'Put it in before Friday and it is on the agenda rather than an interruption.' },

    { section: 'Close', by: 'chair', mins: 8,
      title: 'What we commit to, and who owns it',
      detail: 'Nothing leaves this room without an owner and a date — that was the branch’s ' +
              'own fifth objective at the retreat and it applies here first. ' +
              'Question: what are you taking, and by when?' },

    /*  The one item that asks nothing, and the only one: it is the
     *  announcement that closes the meeting. Every other item carries
     *  a question, because a question is what a person can answer the
     *  day before, and the test holds the agenda to that.          */
    { section: 'Close', by: 'chair', mins: 5, tell: true,
      title: 'Wednesday resumes',
      detail: 'The standing branch meeting is back on Wednesday 4 November at 9:00 — same ' +
              'sign-in, same floor, and the week’s wins read out as always.' }
  ]
};

/** The person who presents an item, found by role on the People tab
 *  rather than written into this public file. Returns a name and an
 *  e-mail, or just a label when the branch has nobody in that role
 *  yet — an agenda item with no presenter is still a valid item, and
 *  a made-up e-mail address is not.                                */
function fridayPresenter_(by) {
  if (!by) return { name: 'Everyone', email: '' };

  var people = readPeople_().filter(function (p) { return p.active; });
  var want = by === 'chair' ? 'manager' : 'unitmgr';
  var hit = people.filter(function (p) { return p.role === want; })[0];
  if (hit) return { name: hit.name, email: hit.email };

  if (by === 'chair') return { name: MEET.ADMIN_NAME, email: MEET.ADMIN_EMAIL };
  return { name: 'Unit Manager', email: '' };
}

/** A date and a clock time in the sheet's own zone. The spec keeps
 *  the date as yyyy-MM-dd so it cannot be read as the wrong order. */
function fridayAt_(dateStr, timeStr) {
  var d = fridayDate_(dateStr);
  if (!d) return null;
  var t = atTime_(d, timeStr);
  return t || d;
}

function fridayDate_(dateStr) {
  var p = String(dateStr).split('-');
  if (p.length !== 3) return null;
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/**
 *  Build Friday's meet-and-discuss. Run it from the editor.
 *
 *  Run it again as often as you like: the meeting is found by its
 *  Ref, the row is brought into line with the spec and the agenda is
 *  rebuilt from scratch, so an edit to FRIDAY above is one Run away
 *  from being live. Attendance, contributions and actions already
 *  recorded against the meeting are never touched.
 */
function seedFridayMeeting() {
  var out = [];
  var date = fridayDate_(FRIDAY.DATE);
  if (!date) throw new Error('FRIDAY.DATE must be yyyy-MM-dd.');

  var chair = fridayPresenter_('chair');

  /* ---- the meeting row, found by Ref so it is never doubled ---- */
  var rows = readTab_(MEET.TAB_MEETINGS).filter(function (m) {
    return str_(m['Ref']) === FRIDAY.REF;
  });
  var id, row;

  var vals = {
    'Ref': FRIDAY.REF,
    'Type': FRIDAY.TYPE,
    'Title': FRIDAY.TITLE,
    'Subtitle': FRIDAY.SUBTITLE,
    'Date': date,
    'Start': FRIDAY.START,
    'End': FRIDAY.END,
    'Format': FRIDAY.FORMAT,
    'Location': FRIDAY.LOCATION,
    'Chair': chair.name,
    /* Published, not draft: a draft is staff-only and an agent would
       see nothing to open tomorrow. */
    'Status': 'published',
    'Check-In Opens': fridayAt_(FRIDAY.DATE, FRIDAY.CHECKIN_OPENS),
    'Check-In Closes': fridayAt_(FRIDAY.DATE, FRIDAY.CHECKIN_CLOSES),
    'Late After (min)': FRIDAY.LATE_AFTER,
    'Mission Statement': FRIDAY.MISSION,
    'Purpose': FRIDAY.PURPOSE,
    'Pre-Read': FRIDAY.PRE_READ,
    'Minutes Status': 'none',
    'Scope': 'branch',
    'Updated': new Date()
  };

  if (rows.length) {
    row = rows[0];
    id = str_(row['ID']);
    Object.keys(vals).forEach(function (k) {
      setCell_(MEET.TAB_MEETINGS, row._row, k, vals[k]);
    });
    out.push('The meeting was already there (' + FRIDAY.REF + ') and has been brought into line.');
  } else {
    id = uid_('MTG');
    vals['ID'] = id;
    vals['Created By'] = chair.email || MEET.ADMIN_EMAIL;
    vals['Created'] = new Date();
    appendRow_(MEET.TAB_MEETINGS, vals);
    out.push('Created the meeting: ' + FRIDAY.TITLE + ', ' + FRIDAY.REF + '.');
  }

  /* ---- the agenda, rebuilt. Bottom-up, or the row numbers move
         under the delete as it goes.                              ---- */
  var sheet = tab_(MEET.TAB_AGENDA);
  var old = readTab_(MEET.TAB_AGENDA).filter(function (a) {
    return str_(a['Meeting ID']) === id;
  }).sort(function (a, b) { return b._row - a._row; });
  old.forEach(function (a) { sheet.deleteRow(a._row); });
  if (old.length) out.push('Replaced the ' + old.length + ' agenda item' +
    (old.length === 1 ? '' : 's') + ' that were there.');

  var mins = 0;
  FRIDAY.AGENDA.forEach(function (it, i) {
    var who = fridayPresenter_(it.by);
    mins += it.mins;
    appendRow_(MEET.TAB_AGENDA, {
      'ID': uid_('AGD'),
      'Meeting ID': id,
      'Order': i + 1,
      'Section': it.section,
      'Title': it.title,
      'Detail': it.detail,
      'Presenter Email': who.email,
      'Presenter Name': who.name,
      'Allotted (min)': it.mins,
      /* Everything is for everyone: the whole purpose of the Friday
         is that the team hears what the branch took to the company.
         Set one item to 'staff' in the sheet if that ever changes. */
      'Visibility': 'all',
      'Materials Required': false,
      'Ready': false,
      'Status': 'Scheduled',
      'Created By': chair.email || MEET.ADMIN_EMAIL,
      'Created': new Date()
    });
  });

  out.push('Wrote ' + FRIDAY.AGENDA.length + ' agenda items, ' + mins + ' minutes in all.');

  var floor = FRIDAY.AGENDA.filter(function (it) { return it.section === 'The floor'; })
    .reduce(function (n, it) { return n + it.mins; }, 0);
  out.push('The floor has ' + floor + ' of those ' + mins + ' minutes.');

  var open = fridayAt_(FRIDAY.DATE, FRIDAY.CHECKIN_OPENS);
  out.push('They can open it and contribute from now; the register opens ' +
    Utilities.formatDate(open, tz_(), 'EEEE d MMMM yyyy') + ' at ' + FRIDAY.CHECKIN_OPENS + '.');

  var roll = readPeople_().filter(function (p) { return p.active && p.role !== 'guest'; });
  var noCode = roll.filter(function (p) { return !p.code && !p.hash; });
  out.push('On the roll: ' + roll.length + '.');
  if (noCode.length) {
    out.push('BUT ' + noCode.length + ' of them cannot sign in yet — no access code and no PIN. ' +
      'Run the roster pull (Branch Meetings → Pull the roster from the Agent Skill Bank) ' +
      'before you send anybody the link.');
  } else {
    out.push('Every one of them can sign in with the code they already use.');
  }

  log_('seed-oneoff', chair.name, 'manager', FRIDAY.REF, FRIDAY.TITLE);

  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}
