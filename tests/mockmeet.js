/*  One fake backend for the meeting page, shared by the screenshot pass and
    anything else that needs the page drawn without the live sheet. Nothing
    here is a real person, a real client or a real figure.  */
const AGENDA = [
  ['Opening & Mission Statement', 'Open | Mission Statement | Moment of Silence', 2, 'Two minutes. The register is the app; nobody is marked in from the front.', 'The Branch Manager'],
  ['Performance & Community Management', 'The production board', 3, 'Written this week against target, by unit. The board is on the screen before anybody sits down \u2014 only the exceptions are spoken aloud.', 'The Branch Manager'],
  ['Performance & Community Management', "This week's call list", 12, 'The cross-sell band the sheet scored "call this week" \u2014 the gap named and the question already written for each one.', 'A Unit Manager'],
  ['Performance & Community Management', 'Maturities \u2014 money in motion', 10, 'Every policy reaching maturity is a conversation about where the money goes next.', ''],
  ['Performance & Community Management', 'The campaign \u2014 the orphan book', 9, 'Against target, with the pace needed to finish on time. A review filed is the unit measured.', ''],
  ['Reports Reviewed', 'Premiums due and lapses \u2014 what we are about to lose', 3, 'Her own book: what is overdue, what lapses next, and what came back from this week\u2019s letters. Only what is breaching.', 'Support One'],
  ['Reports Reviewed', 'Pendings and requirements \u2014 what is holding business up', 3, 'Her own book: requirements outstanding, first premiums not paid, and whose application is waiting on whom.', 'Support Two'],
  ['Reports Reviewed', 'Service, contracts and the 85-day', 2, 'Her own book: contracts undelivered, service requests past their standard, and the 85-day.', 'Support Three'],
  ['Performance & Community Management', "Accountability \u2014 Monday's brief and last week's actions", 10, 'Answered against sent, contact made against answered, and every action carried forward with its owner and its date.', 'The Branch Manager'],
  ['Training & Development', "Training and staffing \u2014 the BMA's report", 5, 'What the staff were trained on this week, what came of it, what is next, and where licensing and staffing stand.', "The Branch Manager's Assistant"],
  ['Performance & Community Management', 'What worked for me', 8, 'One agent, one case, what they actually did. Comes round the room.', 'Everyone'],
  ['Training & Development', 'Training \u2014 one point, taught by one of us', 10, 'Not the manager, and not the BMA. A product, an objection, a system.', 'Everyone'],
  ['Other Items', 'Open floor', 8, "The room's time. Anything not on the agenda.", 'Everyone'],
  ['Closing', 'Close \u2014 each unit commits its number', 5, 'Every unit says what it will have written by next Wednesday.', 'The Branch Manager']
].map((a, i) => ({
  id: 'AGD' + (i + 1), order: i + 1, clock: '', section: a[0], title: a[1], detail: a[3],
  presenter: a[4], presenterEmail: '', mine: i === 10, minutes: a[2], visibility: 'all',
  materialsRequired: false, ready: i < 6, readyAt: '', topics: '', reviewedBy: '',
  status: 'Scheduled', materials: []
}));

const MEETING = {
  id: 'MTG1', ref: 'MD-2026-11-11', type: 'Branch meeting',
  title: 'Branch meeting', subtitle: 'Wednesday, 9:00 to 10:30',
  week: '', date: '11 Nov 2026', dateISO: '2026-11-11', start: '9:00 AM', end: '10:30 AM',
  format: 'In-person', location: '', chair: 'The Branch Manager', guest: '',
  status: 'published', scope: 'branch', participants: '', clientRef: '', topics: '',
  minutesStatus: 'none', lateAfter: 10, materialsDue: '', anchor: '', archiveLink: '',
  preRead: '', purpose: 'Everything on the screen was built during the week. We speak to the exceptions.',
  mission: 'Every voice heard, with a structure.',
  checkInOpen: false, checkInOpensAt: 'Wed 11 Nov 8:30 AM',
  checkInClosesAt: 'Wed 11 Nov 10:30 AM', startsAt: 'Wed 11 Nov 9:00 AM',
  past: false, me: null
};

const CONTRIB = [
  { id: 'C1', name: 'Agent Two', email: 'two@example.com', role: 'agent', agendaId: 'AGD8',
    kind: 'Point', body: 'A client who would not take a call took a fact find, and it closed on the second visit.',
    time: 'Mon 9 Nov', offset: -1, visibility: 'all', topics: '', clipId: '' },
  { id: 'C2', name: 'Agent Three', email: 'three@example.com', role: 'agent', agendaId: 'AGD9',
    kind: 'Commitment', body: 'I can teach the objection that comes up on critical illness.',
    time: 'Mon 9 Nov', offset: -1, visibility: 'all', topics: '', clipId: '' },
  { id: 'C3', name: 'Agent Four', email: 'four@example.com', role: 'agent', agendaId: 'AGD10',
    kind: 'Question', body: 'Can we see the call list a day earlier?',
    time: 'Tue 10 Nov', offset: -1, visibility: 'all', topics: '', clipId: '' }
];

const ACTIONS = [
  { id: 'A1', item: 'Re-check the lapsed list and bring the names', owner: 'A Unit Manager',
    initiatedBy: 'The Branch Manager', due: 'Wed 18 Nov', status: 'Open', overdue: false,
    notes: '', origin: 'MTG0', meetingId: 'MTG1' },
  { id: 'A2', item: 'Send the cross-sell band to every agent on Monday', owner: 'Sales Support',
    initiatedBy: 'The Branch Manager', due: 'Mon 16 Nov', status: 'Open', overdue: true,
    notes: '', origin: 'MTG0', meetingId: 'MTG1' },
  { id: 'A3', item: 'Confirm the training slot for next week', owner: 'The Branch Manager',
    initiatedBy: 'A Unit Manager', due: 'Fri 13 Nov', status: 'Done', overdue: false,
    notes: '', origin: 'MTG1', meetingId: 'MTG1' }
];

const USER = r => ({ email: 'one@example.com', name: r === 'manager' ? 'The Branch Manager' : 'Agent One',
  role: r, unit: 'Unit One', agentNo: 'A00003' });

const ROSTER = [
  { name: 'The Branch Manager', role: 'manager', unit: '' },
  { name: 'A Unit Manager', role: 'unit manager', unit: 'Unit Two' },
  { name: "The Branch Manager's Assistant", role: 'staff', unit: '' },
  { name: 'Support One', role: 'staff', unit: '' },
  { name: 'Support Two', role: 'staff', unit: '' },
  { name: 'Support Three Surname', role: 'staff', unit: '' },
  { name: 'Agent One', role: 'agent', unit: 'Unit One' },
  { name: 'Agent Two', role: 'agent', unit: 'Unit One' },
  { name: 'Agent Three', role: 'agent', unit: 'Unit Two' },
  { name: 'Agent Four', role: 'agent', unit: 'Unit Two' },
  { name: 'Agent Five', role: 'agent', unit: 'Unit One' }
];

/*  The pack the tracker answers with (see meetPack_ in KPI.gs). Counts only:
    no client, no client count, no money. These are invented. */
const PACK = {
  ok: true, asOf: '7:02', day: '2026-11-11',
  parts: ['production', 'work', 'factfind', 'people', 'agents'],
  production: { since: '2026-10-01', policies: 72, apps: 60, week: 9 },
  work: { pendings: 32, renewals: 121, servicing: 352, claims: 11, closed7: 267, orphanOpen: 318 },
  factfind: { year: 157, month: 11, monthLabel: 'November', week: 0, lastWeek: 11 },
  people: [
    { name: 'Support One', hours: '7am \u2013 3pm', at: '6:58', late: 0, absent: false, today: 4, normal: 9, recent: 7, overdue: 6, stale: 1 },
    { name: 'Support Two', hours: '8am \u2013 4pm', at: '8:12', late: 12, absent: false, today: 2, normal: 11, recent: 5, overdue: 14, stale: 3 },
    { name: 'Support Three', hours: '8am \u2013 4pm', at: '', late: 0, absent: true, today: 0, normal: 8, recent: 6, overdue: 9, stale: 0 },
    { name: 'Kay', hours: '8am \u2013 5pm', at: '7:49', late: 0, absent: false, today: 1, normal: 5, recent: 5, overdue: 21, stale: 6 }
  ],
  agents: { total: 19, planned: 11, closed: 7 }
};

exports.pack = PACK;

exports.detail = (role = 'agent', over = {}) => Object.assign({
  roster: ROSTER, pack: PACK,
  ok: true, user: USER(role), meeting: MEETING, agenda: AGENDA, actions: ACTIONS,
  minutes: [], contributions: CONTRIB, minutesPublished: false,
  sections: ['Opening & Mission Statement', 'Performance & Community Management', 'Reports Reviewed', 'Training & Development', 'Other Items', 'Closing'],
  session: null, kinds: ['Point', 'Question', 'Answer', 'Decision', 'Concern', 'Commitment', 'Apology'],
  topicList: ['Production', 'Persistency', 'Recruitment'], canRun: role === 'manager',
  maxClipMinutes: 15, apologyReasons: ['Client appointment'], apologyOther: 'Something else',
  myRole: role, presentCount: 0
}, over);

exports.home = (role = 'agent', over = {}) => Object.assign({
  ok: true, user: USER(role), meetings: [MEETING], next: MEETING, actions: ACTIONS, feed: []
}, over);
