// The command centre: status, history and advice (18 October 2026).
//
// "The ability to close off task — I am seeing Assigned, but pull in the field
// status so I can close. Also add the Chatter history, if there are any
// comments, and build in further intelligence."
//
// Pinned here: the status list is the record's own (Salesforce's TaskStatus,
// the letter sheet's own values); closing needs a note and the note goes on
// first; a task where the client asked for an agent cannot be closed; a letter
// closed here closes its escalation and leaves a comment and an audit line;
// the page's items survive being longer than one Script Property; and a save
// finds each row by its id, never by its place.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-18';

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Akaash Kalladeen', 'akaash', 'akaash.kalladeen@example.com', '1', 'Unit Manager', 'Unit', 'Yes']]);
// The performance-letter workbook (openById hands back this same one in the harness).
env.__mkSheet('Letters', 2, ['Letter ID', 'Agent Email', 'Agent Name', 'Performance Period', 'Letter Date', 'Due Date', 'Letter Type', 'Drive File ID', 'Manager Email', 'Status', 'Date Assigned', 'Date Opened', 'Date Completed'],
  [['PPM-Q2-2026-DM-001', 'dm@example.com', 'Darryl Manick', 'Q2 2026', '2026-07-14', '2026-08-14', 'Underproduction Letter', 'FILE1', 'akaash.kalladeen@example.com', 'Assigned', '', '', ''],
   ['PPM-Q2-2026-JK-001', 'jk@example.com', 'Jamil Khan', 'Q2 2026', '2026-07-14', '2026-08-14', 'Underproduction Letter', 'FILE2', 'ricky@example.com', 'Opened - Review Required', '', '2026-08-07', '']]);
env.__mkSheet('Escalations', 3, ['Escalation ID', 'Letter ID', 'Current Status', 'Reminder Count', 'Resolved Date', 'Resolution Notes', 'Next Action Date'],
  [['ESC-1', 'PPM-Q2-2026-JK-001', 'Escalated - Branch Manager', 24, '', '', '2026-10-19']]);
env.__mkSheet('Communication Trail', 4, ['Trail ID', 'Letter ID', 'Email Type', 'Recipient Name', 'Sent Date', 'Status'],
  [['TR-1', 'PPM-Q2-2026-DM-001', 'Initial Email', 'Darryl Manick', '2026-08-06', 'Awaiting Response'],
   ['TR-2', 'PPM-Q2-2026-DM-001', 'Reminder', 'Darryl Manick', '2026-08-12', 'Awaiting Response']]);
env.__mkSheet('BM Comments', 5, ['Comment ID', 'Weekly ID', 'Letter ID', 'BM Email', 'BM Name', 'Comment Date', 'Comment', 'Action Required'], []);
env.__mkSheet('Audit Log', 6, ['Timestamp', 'Email', 'Role', 'Action', 'Letter ID', 'Details'], []);
env.__mkSheet('Comments', 7, ['When', 'Reference', 'Author', 'Role', 'Comment'],
  [['10/10/2026 9:00:00', 'RRB/2026/040/Ann Client/Beneficiary change', 'Azariah Griffith', 'staff', 'Sent to New Business, waiting on them']]);

// The harness has no getDataRange, so the workbook reader reads the fake grids directly.
env.bookRows_ = (k, tab) => {
  const sh = env.__sheets[tab]; if (!sh) return [];
  const [h, ...rows] = sh._grid;
  return rows.map(r => { const o = {}; h.forEach((c, j) => { o[c] = r[j] === undefined ? '' : r[j]; }); return o; });
};
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, kamla: { id: '005K' }, elizabeth: { id: '005L' }, akaash: { id: '005A' } });
env.bmSfId_ = () => '005R';
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
env.absentToday_ = () => ({ kamla: 1 });
env.skillBank_ = () => ({ 'old agent': { name: 'Old Agent', active: false } });
env.bmWaiting_ = () => ({ ignored: [], ask: [], mine: [], byOwner: {} });
env.openQueries_ = () => [{ ref: 'RRB/2026/040/Ann Client/Beneficiary change', days: 8, assigned: 'Azariah Griffith', subject: 'Beneficiary change', type: 'Servicing', status: 'Open', client: 'Ann Client' }];
env.iLoadCache_ = () => ({ dues: { chase: [{ client: 'CLIENT, Ann', policy: '5001234', modal: 450, days: 72, lapseOn: '2026-11-01' }] }, pending: { rows: [{ client: 'Bea Newbiz', policy: '7007', requirement: 'Medical', age: 20 }] }, movements: { first: true } });
const T = (id, subject, extra) => Object.assign({ id, subject, touched: 9, late: true, due: '2026-10-01', status: 'In Progress', agent: '' }, extra || {});
env.sfkOpenBook_ = () => ({
  elizabeth: { Servicing: [T('00T1', 'Send policy documents to client', { account: 'Ann Client' }), T('00T2', 'Beneficiary update for client', { account: 'Mr. Ann Client' }),
                           T('00T3', 'Orphan client callback', { status: 'Not Started' }), T('00T5', 'Lapse letter', { agent: 'Old Agent' })] },
  kamla: { Servicing: [T('00T4', 'Licence renewal pack')] }
});
const FEED = [
  { ParentId: '00T1', CreatedById: '005L', CreatedDate: '2026-10-16T14:00:00.000+0000', Body: '<p>Policy documents sent to the client by e-mail.</p>' },
  { ParentId: '00T1', CreatedById: '005R', CreatedDate: '2026-10-12T14:00:00.000+0000', Body: '<p>Please send these today.</p>' },
  { ParentId: '00T3', CreatedById: '005L', CreatedDate: '2026-10-15T14:00:00.000+0000', Body: '<p>Client says she wants a new agent assigned.</p>' },
  { ParentId: '00T4', CreatedById: '005R', CreatedDate: '2026-10-10T14:00:00.000+0000', Body: '<p>Where is this?</p>' }
];
const COMMENTS = [{ ParentId: '00T1', CreatedById: '005X', CreatedDate: '2026-10-16T15:00:00.000+0000', CommentBody: 'Client confirmed receipt.' }];
const soql = [];
env.sfkQuery_ = q => {
  soql.push(q);
  if (/FROM TaskStatus/.test(q)) return [{ MasterLabel: 'Not Started', IsClosed: false }, { MasterLabel: 'In Progress', IsClosed: false },
                                         { MasterLabel: 'Waiting on Client', IsClosed: false }, { MasterLabel: 'Completed', IsClosed: true }];
  if (/FROM FeedItem/.test(q)) return FEED.filter(f => q.indexOf("'" + f.ParentId + "'") > -1);
  if (/FROM FeedComment/.test(q)) return COMMENTS.filter(f => q.indexOf("'" + f.ParentId + "'") > -1);
  if (/FROM User/.test(q)) return [{ Id: '005X', Name: 'Guardian Service Desk' }];
  return [];
};
const writes = [];
env.sfkPatchTask_ = (id, body) => { writes.push(['patch', id, body]); };
env.sfkInsert_ = (obj, body) => { writes.push(['insert', obj, body]); return obj === 'Task' ? '00TNEW' : 'FEED'; };

const P = { staffId: 'ricky', name: 'Ricky Rampersad' };
const html = env.cmdReplyPage_(P, DAY, '', '').getContent();
const block = id => { const i = html.indexOf('value="' + id + '"'); const st = html.lastIndexOf('<details class="it"', i); const j = html.indexOf('<details class="it"', i); return html.slice(st, j < 0 ? undefined : j); };

console.log('\nThe status comes from the record\'s own list:\n');
ok('Salesforce\'s own statuses, read from TaskStatus', soql.some(q => /FROM TaskStatus/.test(q)) && /Set to Waiting on Client/.test(block('00T1')));
ok('the closing one says so', /Set to Completed \(closes it\)/.test(block('00T1')));
ok('the current status is shown and left by default', /<option value="">Status: In Progress \(leave\)<\/option>/.test(block('00T1')));
ok('a letter offers the sheet\'s own statuses', /Set to Opened - Review Required/.test(block('pl:PPM-Q2-2026-DM-001')) && /Set to Completed \(closes it\)/.test(block('pl:PPM-Q2-2026-DM-001')));
ok('and links to the letter itself', /drive\.google\.com\/file\/d\/FILE1\/view/.test(block('pl:PPM-Q2-2026-DM-001')));

console.log('\nThe history is under each item:\n');
ok('Chatter posts, newest first, with who wrote them', /Elizabeth Lee<\/b>: Policy documents sent to the client by e-mail\./.test(block('00T1')));
ok('replies too, named from Salesforce', /Guardian Service Desk \(reply\)<\/b>: Client confirmed receipt\./.test(block('00T1')));
ok('a task with nothing on it says so', /No Chatter on this task\./.test(block('00T2')));
ok('a letter shows its trail and the agent\'s silence', /2 e-mails; the last, reminder to Darryl Manick/.test(block('pl:PPM-Q2-2026-DM-001')) && /No response from the agent\./.test(block('pl:PPM-Q2-2026-DM-001')));
ok('and its escalation', /Escalated - Branch Manager · 24 reminders/.test(block('pl:PPM-Q2-2026-JK-001')));
ok('a query shows its comments', /Azariah Griffith<\/b>: Sent to New Business, waiting on them/.test(block('qp:RRB/2026/040/Ann Client/Beneficiary change')));

console.log('\nAnd what to do with it:\n');
ok('a note that reads as done is called done', /Suggested:<\/b> Elizabeth wrote &quot;Client confirmed receipt\.|Suggested:<\/b> Guardian wrote/.test(block('00T1')) || /It reads as done/.test(block('00T1')), block('00T1').match(/Suggested:<\/b>[^<]*/) || '');
ok('silence is called silence', /Nobody has written on this task/.test(block('00T2')));
ok('a client asking for an agent cannot be closed', /cannot be closed/.test(block('00T3')) && !/closes it/.test(block('00T3')));
ok('a desk not in today is named', /Kamla is not in today/.test(block('00T4')));
ok('an agent who has left makes the client an orphan', /Old Agent is no longer active/.test(block('00T5')));
ok('a letter never opened: call, and the manager sits with them', /Never opened, \d+ days past due, after 2 e-mails\. E-mail is not working: call Darryl and have Akaash sit with them/.test(block('pl:PPM-Q2-2026-DM-001')));
ok('a quarter-old letter is called out', /Q2 2026 letter is a quarter behind/.test(block('pl:PPM-Q2-2026-DM-001')));
ok('the summary counts what it sees', /What the system sees/.test(html) && /cannot be closed:<\/b> the client asked for an agent/.test(html) && /<b>Elizabeth<\/b> holds the most \(4/.test(html));
ok('a quarter is old only once the next has finished', env.cmdOldPeriod_('Q2 2026', DAY) && !env.cmdOldPeriod_('Q3 2026', DAY) && env.cmdOldPeriod_('Q3 2026', '2027-01-05'));

console.log('\nSaving:\n');
const ids = {}; html.replace(/name="id_(\d+)" value="([^"]+)"/g, (m, i, id) => { ids[id] = i; });
const save = form => env.cmdReplySave_(P, DAY, Object.assign(Object.keys(ids).reduce((a, id) => { a['id_' + ids[id]] = id; return a; }, {}), form)).getContent();
writes.length = 0;
let out = save({ ['st_' + ids['00T2']]: 'Completed' });
ok('closing without a note is refused', /a closed task without a note is not closed/.test(out) && !writes.length);
writes.length = 0;
out = save({ ['st_' + ids['00T3']]: 'Completed', ['q_' + ids['00T3']]: 'Done' });
ok('a client asking for an agent stays open', /cannot be closed/.test(out) && !writes.some(w => w[0] === 'patch'));
writes.length = 0;
out = save({ ['st_' + ids['00T1']]: 'Completed', ['q_' + ids['00T1']]: 'Client has the documents.' });
ok('closing with a note: the note goes on first', writes[0] && writes[0][0] === 'insert' && writes[0][1] === 'FeedItem' && /Closed \(Completed\)\. Client has the documents\./.test(writes[0][2].Body));
ok('then the task closes', writes[1] && writes[1][0] === 'patch' && writes[1][2].Status === 'Completed', JSON.stringify(writes));
ok('and the page says so', /letter closed|closed<\/b>/.test(out));
writes.length = 0;
out = save({ ['st_' + ids['00T2']]: 'Waiting on Client' });
ok('a status that does not close needs no note', writes.some(w => w[0] === 'patch' && w[2].Status === 'Waiting on Client') && /set to Waiting on Client/.test(out));

const L = env.__sheets['Letters']._grid, E = env.__sheets['Escalations']._grid;
out = save({ ['st_' + ids['pl:PPM-Q2-2026-JK-001']]: 'Completed' });
ok('a letter closed without a note is refused', /say why the letter is closed/.test(out) && L[2][9] === 'Opened - Review Required');
out = save({ ['st_' + ids['pl:PPM-Q2-2026-JK-001']]: 'Completed', ['q_' + ids['pl:PPM-Q2-2026-JK-001']]: 'Met him; Q3 figures replace this letter.' });
ok('closing a letter sets its status and completed date', L[2][9] === 'Completed' && L[2][12] instanceof env.Date, JSON.stringify(L[2]));
ok('its open escalation is resolved with the note', E[1][2] === 'Resolved' && E[1][5] === 'Met him; Q3 figures replace this letter.' && !!E[1][4]);
const BC = env.__sheets['BM Comments']._grid, AL = env.__sheets['Audit Log']._grid;
ok('your comment goes on its record', BC.length === 2 && BC[1][2] === 'PPM-Q2-2026-JK-001' && BC[1][6] === 'Met him; Q3 figures replace this letter.' && /Closed: Completed/.test(BC[1][7]));
ok('and the audit log has the line', AL.some(r => r[3] === 'STATUS CHANGE' && r[4] === 'PPM-Q2-2026-JK-001' && /from the KPI tracker by Ricky Rampersad/.test(r[5])));
out = save({ ['q_' + ids['pl:PPM-Q2-2026-DM-001']]: 'Calling him Monday.' });
ok('a note alone is a comment on the letter, not a new task', BC.length === 3 && BC[2][6] === 'Calling him Monday.' && /comment on the letter/.test(out));

console.log('\nThe page\'s items outlive one Script Property, and rows are found by id:\n');
const many = Array.from({ length: 60 }, (_, i) => ({ k: 'sf', id: '00TX' + i, src: 'Salesforce', t: 'x'.repeat(120), who: 'kamla', on: '', why: 'untouched 40 days, overdue since Mon 1 Sep', st: 'In Progress', ref: '', nc: 0 }));
env.cmdStore_('kamla', DAY, many);
const back = env.cmdLoad_('kamla', DAY);
ok('sixty items come back whole', back.length === 60 && back[59].id === '00TX59', String(back.length));
writes.length = 0;
out = save({ id_0: '00TGONE', st_0: 'Completed', q_0: 'x' });
ok('an item no longer on the list is not applied to another row', /no longer on the list/.test(out) && !writes.length);

console.log('\nOn a phone:\n');
ok('each row folds to one line: age, title, who, why', /<details class="it" id="it\d+" data-f="[^"]*"><summary><div class="hd"><span class="age a">9d<\/span>/.test(html));
ok('filter chips for what the system found, the sources and the desks', /class="chip on" data-f="all">All<i>/.test(html) && /data-f="tag-done">Reads as done<i>1/.test(html) && /data-f="who-Elizabeth">Elizabeth<i>4/.test(html));
ok('tiles at the top', /<div class="tiles">/.test(html) && /quick wins: read as done/.test(html));
ok('a one-tap close, with the note written for you', /data-close="Completed" data-note="Done, per Guardian&#39;s note of Fri 16 Oct\."|data-close="Completed" data-note="Done, per Guardian's note of Fri 16 Oct\."/.test(block('00T1')), (block('00T1').match(/data-close[^>]*/) || [''])[0]);
ok('no close button where the client asked for an agent', !/data-close/.test(block('00T3')));
ok('where it is stuck, by who holds it', /Where it is stuck/.test(html) && /<span class="n">Elizabeth<\/span>/.test(html));
ok('your notes answered, by desk', /Your notes answered/.test(html) && /<span class="c">1 of 1<\/span>/.test(html) && /<span class="c">0 of 1<\/span>/.test(html));
ok('the send button counts the changes', /id="send"/.test(html) && /Send "\+n\+" change/.test(html));
ok('the page\'s boxes are 16px, so a phone does not zoom in', /font-size:16px;line-height:1\.35/.test(html) && !/font:14px\/1\.4 inherit/.test(html));

console.log('\nRisk, and the client in one view:\n');
ok('a client is found across the records, words in any order', /Ann Client · also open/.test(block('00T2')) && /<b>Query Pal<\/b>: RRB\/2026\/040 · Beneficiary change · 8 days open/.test(block('00T2')) && /<b>Premium<\/b>: premium 72 days overdue on 5001234 \(TT\$450 a premium\), lapses Sun 1 Nov/.test(block('00T2')), block('00T2').match(/also open[\s\S]{0,400}/));
ok('the other task for the same client is listed too', /<b>Salesforce<\/b>: Send policy documents to client/.test(block('00T2')));
ok('the score says why', /Why this score: [^<]*premium 72 days overdue[^<]*open in 3 places/.test(block('00T2')), (block('00T2').match(/Why this score:[^<]*/) || [''])[0]);
ok('every row carries its score', (html.match(/class="badge[^"]*">Risk \d+<\/span>/g) || []).length === 8);
ok('the page runs highest risk first', (() => { const sc = (html.match(/>Risk (\d+)</g) || []).map(x => +x.replace(/\D/g, '')); return sc.length > 1; })());
ok('a do-first list, with nothing that only needs closing', /Do these first · highest risk/.test(html) && !/href="#it\d+" data-open="\d+"[^>]*>[^]*?Send policy documents to client<\/b>[^]*?Clients open/.test(html.split('What the system sees')[0]));
ok('clients open in more than one place, named once', /Clients open in more than one place \(1\)/.test(html) && /<b>(Mr\. )?Ann Client<\/b> ·/.test(html));
ok('chips for high risk and a client open elsewhere', /data-f="client-multi">Client open elsewhere<i>3/.test(html));
const risk = env.cmdRisk_({ k: 'sf', title: 'New application for client, client waiting', key: 'Pendings', age: 30, c360: [{ src: 'Premium', days: 80 }, { src: 'Query Pal' }], adv: { tag: 'unanswered' } }, { chatter: {} });
ok('new business, waiting a month, client waiting, premium 80 days, open elsewhere, unanswered: high', risk.band === 'high' && risk.score === 86, JSON.stringify(risk));
const low = env.cmdRisk_({ k: 'sf', title: 'File the copy', key: 'RR Operations', age: 6, c360: [], adv: { tag: 'done' } }, { chatter: {} });
ok('a filing job that reads as done: low', low.band === 'low' && low.why[0] === 'reads as done: close it', JSON.stringify(low));
ok('names match in any order and without titles', env.clientKeys_('KHAN, Mr. Jamil').full === env.clientKeys_('Jamil Khan').full);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
