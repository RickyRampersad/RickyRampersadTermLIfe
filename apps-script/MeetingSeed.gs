/**
 * ============================================================
 *  BUILD ANY BRANCH MEETING FROM A SPEC — Ricky Rampersad Branch
 * ============================================================
 *
 *  A file in the Branch Meeting Builder project. seedMeetingFrom_(spec) builds (or brings into line) one meeting and
 *  rebuilds its agenda, the way seedFridayMeeting does for the Friday, but for any meeting.
 *
 *  10 November 2026. Ricky: "tighten up further the agenda for tomorrow as it appears when they log in ... the meeting
 *  is a working meeting, so it moves along the slides". The spec for a given Wednesday carries names and the branch's
 *  own figures, and this repository is published on the branch site, so THE SPEC NEVER GOES HERE. It lives in a second,
 *  private file pasted into the project (for example Wednesday-11-Nov.gs) that defines one function calling this one.
 *
 *  The meeting is found by its Ref, or, failing that, as the branch meeting already on that date, so a standing meeting
 *  built from the rota is taken over rather than doubled. Attendance, contributions and actions are never touched. The
 *  agenda is rebuilt from the spec; a contribution already filed against an old agenda item stays on the record and
 *  shows on the floor.
 *
 *  Presenters are named by a key ('kamla', 'akaash') and resolved against the People tab by first name at run time,
 *  so a spec never holds an e-mail address. 'chair' is the branch manager; '' is the room.
 * ============================================================
 */
function seedPerson_(key) {
  key = low_(key);
  if (!key) return { name: 'Everyone', email: '' };
  var people = readPeople_().filter(function (p) { return p.active; });
  if (key === 'chair') {
    var mgr = people.filter(function (p) { return p.role === 'manager'; })[0];
    return mgr ? { name: seedClean_(mgr.name), email: mgr.email } : { name: MEET.ADMIN_NAME, email: MEET.ADMIN_EMAIL };
  }
  var hit = people.filter(function (p) {
    var words = seedClean_(p.name).toLowerCase().split(/\s+/);
    return words.indexOf(key) > -1 || (p.email.split('@')[0].split(/[._]/)[0] === key);
  })[0];
  return hit ? { name: seedClean_(hit.name), email: hit.email } : { name: key.charAt(0).toUpperCase() + key.slice(1), email: '' };
}
/** "A00427 - Ricky Rampersad" reads as "Ricky Rampersad" on an agenda. */
function seedClean_(n) { return str_(n).replace(/^[A-Z]?\d+\s*-\s*/, ''); }
function seedDate_(s) {
  var p = String(s).split('-'); if (p.length !== 3) return null;
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
function seedAt_(dateStr, timeStr) { var d = seedDate_(dateStr); if (!d) return null; return atTime_(d, timeStr) || d; }

function seedMeetingFrom_(spec) {
  var out = [], date = seedDate_(spec.DATE);
  if (!date) throw new Error('DATE must be yyyy-MM-dd.');
  var chair = seedPerson_('chair'), tz = tz_();
  var all = readTab_(MEET.TAB_MEETINGS);
  var row = all.filter(function (m) { return str_(m['Ref']) === spec.REF; })[0] ||
    all.filter(function (m) {
      var d = asDate_(m['Date']); return d && Utilities.formatDate(d, tz, 'yyyy-MM-dd') === spec.DATE &&
        cleanScope_(m['Scope']) === 'branch' && low_(m['Status']) !== 'cancelled';
    })[0];
  var vals = {
    'Ref': spec.REF, 'Type': spec.TYPE || 'Branch Meeting', 'Title': spec.TITLE, 'Subtitle': spec.SUBTITLE || '',
    'Date': date, 'Start': spec.START, 'End': spec.END, 'Format': spec.FORMAT || 'In-person', 'Location': spec.LOCATION || '',
    'Chair': chair.email || chair.name, 'Status': 'published',
    'Check-In Opens': seedAt_(spec.DATE, spec.CHECKIN_OPENS), 'Check-In Closes': seedAt_(spec.DATE, spec.CHECKIN_CLOSES),
    'Late After (min)': spec.LATE_AFTER || 0, 'Mission Statement': spec.MISSION || '', 'Purpose': spec.PURPOSE || '',
    'Pre-Read': spec.PRE_READ || '', 'Minutes Status': 'none', 'Scope': 'branch', 'Updated': new Date()
  };
  var id;
  if (row) {
    id = str_(row['ID']);
    Object.keys(vals).forEach(function (k) { setCell_(MEET.TAB_MEETINGS, row._row, k, vals[k]); });
    out.push('Brought the meeting already there into line (' + (str_(row['Ref']) || id) + ' is now ' + spec.REF + ').');
  } else {
    id = uid_('MTG'); vals['ID'] = id; vals['Created By'] = chair.email || MEET.ADMIN_EMAIL; vals['Created'] = new Date();
    appendRow_(MEET.TAB_MEETINGS, vals);
    out.push('Created the meeting: ' + spec.TITLE + ', ' + spec.REF + '.');
  }
  var sheet = tab_(MEET.TAB_AGENDA);
  var old = readTab_(MEET.TAB_AGENDA).filter(function (a) { return str_(a['Meeting ID']) === id; }).sort(function (a, b) { return b._row - a._row; });
  old.forEach(function (a) { sheet.deleteRow(a._row); });
  if (old.length) out.push('Replaced the ' + old.length + ' agenda items that were there.');
  var mins = 0, owners = {}, room = 0;
  spec.AGENDA.forEach(function (it, i) {
    var who = it.by === 'room' || !it.by ? { name: it.label || 'Everyone', email: '' } : seedPerson_(it.by);
    if (it.label) who.name = it.label;
    mins += it.mins;
    if (it.by === 'room' || !it.by) room += it.mins; else owners[who.name] = (owners[who.name] || 0) + it.mins;
    appendRow_(MEET.TAB_AGENDA, {
      'ID': uid_('AGD'), 'Meeting ID': id, 'Order': (i + 1) * 10, 'Section': it.section, 'Title': it.title, 'Detail': it.detail,
      'Presenter Email': who.email, 'Presenter Name': who.name, 'Allotted (min)': it.mins, 'Visibility': it.vis || 'all',
      'Materials Required': false, 'Ready': false, 'Status': 'Planned', 'Created By': chair.email || MEET.ADMIN_EMAIL, 'Created': new Date()
    });
  });
  out.push('Wrote ' + spec.AGENDA.length + ' agenda items, ' + mins + ' minutes.');
  out.push('Who holds the time: ' + Object.keys(owners).sort(function (a, b) { return owners[b] - owners[a]; }).map(function (k) { return k + ' ' + owners[k]; }).join(', ') + (room ? ', the room ' + room : '') + '.');
  var chairMins = owners[chair.name] || 0;
  if (chairMins > mins * 0.15) out.push('WARNING: the chair holds ' + chairMins + ' of ' + mins + ' minutes.');
  var unresolved = spec.AGENDA.filter(function (it) { return it.by && it.by !== 'room' && !seedPerson_(it.by).email; }).map(function (it) { return it.by; });
  if (unresolved.length) out.push('Not on the People tab, so shown by name only: ' + unresolved.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ') + '.');
  out.push('Open now for everyone to read and bring things to; the register opens ' + spec.CHECKIN_OPENS + ' on ' +
    Utilities.formatDate(date, tz, 'EEEE d MMMM') + '.');
  log_('seed-meeting', chair.name, 'manager', spec.REF, spec.TITLE);
  var msg = out.join('\n'); Logger.log(msg); return msg;
}
