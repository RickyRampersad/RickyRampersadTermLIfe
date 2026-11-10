/*  One fake backend for the meeting page, shared by the screenshot pass and
    anything else that needs the page drawn without the live sheet. Nothing
    here is a real person, a real client or a real figure.  */
const AGENDA = [
  ['Opening & Mission Statement', 'Open | Mission Statement | Moment of Silence', 3, 'Three minutes. The register is the app; nobody is marked in from the front.', 'The Branch Manager'],
  ['Performance & Community Management', 'The production board', 7, 'Written this week against target, by unit. The screen is up — only the exceptions are spoken aloud.', 'The Branch Manager'],
  ['Performance & Community Management', "This week's call list", 12, 'The cross-sell band the sheet scored "call this week" — the gap named and the question already written for each one.', 'Sales Support'],
  ['Performance & Community Management', 'Maturities — money in motion', 10, 'Every policy reaching maturity is a conversation about where the money goes next.', 'Sales Support'],
  ['Performance & Community Management', 'The campaign — the orphan book', 9, 'Against target, with the pace needed to finish on time. A review filed is the unit measured.', 'The Branch Manager'],
  ['Performance & Community Management', "Accountability — Monday's brief and last week's actions", 10, 'Answered against sent, contact made against answered, and every action carried forward with its owner.', 'The Branch Manager'],
  ['Reports Reviewed', 'Conservation and exceptions', 8, 'What we are about to lose, and what is breaching its standard. Only the breaches.', 'A Unit Manager'],
  ['Performance & Community Management', 'What worked for me', 8, 'One agent, one case, what they actually did. Comes round the room.', 'Everyone'],
  ['Training & Development', 'Training — one point, taught by one of us', 10, 'Not the manager. A product, an objection, a system.', 'Everyone'],
  ['Other Items', 'Open floor', 8, "The room's time. Anything not on the agenda.", 'Everyone'],
  ['Closing', 'Close — each unit commits its number', 5, 'Every unit says what it will have written by next Wednesday.', 'The Branch Manager']
].map((a, i) => ({
  id: 'AGD' + (i + 1), order: i + 1, clock: '', section: a[0], title: a[1], detail: a[3],
  presenter: a[4], presenterEmail: '', mine: i === 7, minutes: a[2], visibility: 'all',
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
  { id: 'C1', name: 'Agent Two', email: 'two@example.com', role: 'agent', item: 'What worked for me',
    kind: 'Point', body: 'A client who would not take a call took a fact find, and it closed on the second visit.',
    time: 'Mon 9 Nov', offset: -1, visibility: 'all', topics: '', clipId: '' },
  { id: 'C2', name: 'Agent Three', email: 'three@example.com', role: 'agent', item: 'Training — one point, taught by one of us',
    kind: 'Commitment', body: 'I can teach the objection that comes up on critical illness.',
    time: 'Mon 9 Nov', offset: -1, visibility: 'all', topics: '', clipId: '' },
  { id: 'C3', name: 'Agent Four', email: 'four@example.com', role: 'agent', item: 'Open floor',
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

exports.detail = (role = 'agent', over = {}) => Object.assign({
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
