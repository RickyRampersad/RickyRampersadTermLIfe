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
/*  FRIDAY 30 OCTOBER 2026, 12 NOON — the meet-and-discuss after the
 *  Joint Sales Managers' Strategic Meeting of 22 and 23 October.
 *
 *  IT IS A DISCUSSION MEETING, AND THE AGENDA SAYS SO ON EVERY ITEM.
 *
 *  McKinsey's own guidance sorts every meeting into one of three:
 *  information sharing, discussion (creative solutions and
 *  coordination), and decision making. Their explainer reports 61% of
 *  executives saying at least half the time they spent making
 *  decisions was ineffective. The commonest way that happens is an
 *  item nobody has labelled: a discussion drifts into a briefing, or
 *  a decision is never actually taken.
 *
 *  So `Section` carries the TYPE — Information, Discussion, Decision —
 *  and it is the eyebrow the page already prints above every item. The
 *  room always knows which of the three it is in. Of the ninety
 *  minutes, fifty are Discussion and twenty are Decision: twenty for
 *  information, because the information is in the pre-read.
 *
 *  WHY PEOPLE WRITE BEFORE THEY MEET
 *
 *  Rietzschel, Nijstad and Stroebe (2006) found nominal groups —
 *  people generating alone, pooled afterwards — produce more ideas,
 *  and more original ones, than a group talking it through. And
 *  Edmondson's work on psychological safety is blunt about why: the
 *  people at the top of a hierarchy have the most of it, and people
 *  lower down often stay quiet whatever they are thinking. In a room
 *  where the branch manager speaks first, the first voice anchors
 *  every voice after it.
 *
 *  Writing first, alone, is the structural fix for both. It is the
 *  reason the pre-meeting box exists and is not decoration.
 *
 *  AND WHY THE MEETING OPENS BY READING
 *
 *  Bezos on the six-pager: people bluff their way through a pre-read,
 *  so the time to read has to be carved out of the meeting itself.
 *  Item 1 is ten minutes of silence. Nobody presents what came in;
 *  everybody reads it. That is also what keeps the meeting to ninety
 *  minutes — the summarising is what makes a meeting long.
 *
 *  THE QUESTIONS
 *
 *  Practitioner guidance on survey wording is consistent on three
 *  things: open with "what" or "how" rather than "why", which reads
 *  as an accusation; one topic per question; and two or three
 *  open-ended items, because more than that is answered worse. So
 *  people are asked for three, not nine, and each question names one
 *  thing. "Describe what happens, not who" is on the hard one by
 *  design: a complaint about a person closes a room, a description of
 *  a process does not.
 *
 *  Every contribution is tagged with the part of the work it belongs
 *  to, off the Topics tab the project already seeds, so what comes
 *  back sorts by line instead of arriving as a pile.               */
var FRIDAY = {
  REF: 'MD-2026-10-30',
  TYPE: 'Meet & Discuss',
  TITLE: 'Back from the retreat: shaping FY27',
  SUBTITLE: 'What is working, what is not, and how we work from here',

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
  /*  No grace: twelve means twelve. Sign in after it starts and the
   *  register says present but late. */
  LATE_AFTER: 0,

  /*  What a person is asked to answer. Three, not nine: more than
   *  two or three open-ended questions is answered worse, not more. */
  ANSWER_AT_LEAST: 3,

  MISSION: 'Every voice heard, with a structure.',

  PURPOSE:
    'Akaash and I were at the company\u2019s Joint Sales Managers\u2019 Strategic ' +
    'Meeting on 22 and 23 October. Friday is not a briefing on it. It is a ' +
    'discussion: what is working in this branch, what is not, what we want to be ' +
    'known for, and how Wednesday runs from here. FY27 is 30 days old and every ' +
    'goal plan is in. Everything you write before Friday is read in the room ' +
    'before anybody speaks \u2014 so the quietest person in the branch is read as ' +
    'carefully as the loudest.',

  PRE_READ: [
    'WHAT THE BRANCH TOOK TO THE COMPANY, IN FIVE LINES',
    '1. Put the record on the table: a branch run on analytics, every desk accountable every day, is where the company says it wants to go, and it is running now.',
    '2. Get business preserved recognised beside business produced, with a unit the system can count: a review filed, a conversion, a premium retained.',
    '3. Get a company standard for writing to a departed agent\u2019s book inside days, in the company\u2019s words, and a counted rebuilding period for the manager who loses one.',
    '4. Get the readiness record accepted as the basis for advancement, ahead of tenure.',
    '5. Leave with an owner and a date on at least one of these.',
    '',
    'HOW FRIDAY RUNS',
    'Answer at least three of the questions on the agenda before Friday. Tag each answer with the part of the work it belongs to.',
    'The meeting opens with ten minutes of silence while the room reads what came in. Nobody presents it.',
    'Then we discuss it, in the order it came back \u2014 heaviest first.',
    'Every item says whether it is information, discussion or a decision. Two of them are decisions and they get decided on the day.',
    '',
    'There is no right answer and nothing is anonymous. Say the thing you would say in the car park.'
  ].join('\n'),

  /*  by: which role presents it, resolved against the People tab at
   *  run time. 'chair' is the branch manager, 'unitmgr' the unit
   *  manager, and '' means the item belongs to the room.
   *  tell: it asks nothing — the only items that may.            */
  AGENDA: [
    { section: 'Information', by: 'chair', mins: 10, tell: true,
      title: 'What you wrote \u2014 ten minutes to read it',
      detail: 'The meeting opens in silence. Everything written before today is on the ' +
              'screen and everybody reads it, including the people who wrote it. Nobody ' +
              'presents and nobody summarises \u2014 summarising is what makes a meeting long, ' +
              'and it is also how the loudest answer becomes the only one anybody hears.' },

    { section: 'Information', by: 'chair', mins: 10,
      title: 'What came back from the company',
      detail: 'Short, because the five lines are in the pre-read and you have read them. ' +
              'Question: which of the five matters most to your own week, and what would ' +
              'change for you if the company moved on it?' },

    { section: 'Discussion', by: '', mins: 15,
      title: 'What is working',
      detail: 'Tag your answer with the part of the work you spend most of your week in. ' +
              'Question: what is working there now that was not working a year ago? ' +
              'Name one thing, and say what it changed.' },

    { section: 'Discussion', by: '', mins: 20,
      title: 'What is not working',
      detail: 'The longest item on the agenda, because it is the one the year turns on. ' +
              'Question: what costs you the most time, or the most clients, in that same ' +
              'part of the work? Describe what happens, not who \u2014 a process we can fix ' +
              'on Friday, a person we cannot.' },

    /*  The unit manager runs this one, and that is the point of it.
     *  Edmondson: the people at the top of a hierarchy have the most
     *  psychological safety, and the room answers whoever asked. A
     *  branch manager asking "what should this branch be known for"
     *  gets answers addressed to him; somebody else asking it gets a
     *  conversation.                                              */
    { section: 'Discussion', by: 'unitmgr', mins: 15,
      title: 'What we want this branch known for',
      detail: 'Our culture is what a client and a new agent would say about us without ' +
              'being asked. Question: what do you want them to say about this branch in a ' +
              'year, and what do we do today that works against it?' },

    { section: 'Decision', by: 'chair', mins: 15,
      title: 'How Wednesday runs from here',
      detail: 'A decision, taken on the day. We watch Inside Wednesday ' +
              '(rickyrampersadbranch.com/meetings \u2192 the films) and then settle the shape: ' +
              'what is standing, what is read beforehand, how long, and what gets dropped. ' +
              'Question: what would make Wednesday worth ninety minutes of your week, and ' +
              'what should we stop doing in it?' },

    /*  The one item that asks nothing of the agenda, and the only
     *  other one: it is the decision that closes the meeting. Every
     *  question item carries a question, and the test holds the
     *  agenda to that.                                           */
    { section: 'Decision', by: 'chair', mins: 5, tell: true,
      title: 'Who owns what, and by when',
      detail: 'Nothing leaves this room without a name and a date against it \u2014 that was ' +
              'the branch\u2019s own fifth objective at the retreat and it applies here first. ' +
              'Every owner is recorded on the meeting and read back on Wednesday ' +
              '4 November at 9:00, when the standing meeting resumes.' }
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

  /*  Report the split, because it is the whole claim of the agenda:
   *  this is a discussion meeting, not a briefing with questions on
   *  the end. If information ever outgrows discussion, the agenda has
   *  drifted back into a briefing and this line says so.          */
  var by = {};
  FRIDAY.AGENDA.forEach(function (it) { by[it.section] = (by[it.section] || 0) + it.mins; });
  out.push('Of those ' + mins + ' minutes: ' +
    Object.keys(by).map(function (k) { return by[k] + ' ' + k.toLowerCase(); }).join(', ') + '.');
  if ((by.Discussion || 0) <= (by.Information || 0)) {
    out.push('WARNING: information now takes as long as discussion. This was meant to be ' +
      'a discussion meeting.');
  }
  var asks = FRIDAY.AGENDA.filter(function (it) { return !it.tell; }).length;
  out.push(asks + ' items ask a question; people are asked for ' + FRIDAY.ANSWER_AT_LEAST + '.');

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
