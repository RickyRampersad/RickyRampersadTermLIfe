// HELP 868: what the WhatsApp assistant may ask of the tracker (2 November 2026).
// Pinned: nothing answers without the key; pendings answer only for a number on the HELP868 Agents tab, only about that agent's
// own cases, with the last four digits of a policy and never a note's words; a wrong agent number is the same answer as an
// unknown number; an enquiry gets a reference from the log, is cleaned of numbers/e-mails/links, is not filed twice in a
// row, and a cell cannot start as a formula; one number is rate limited.
process.env.GS_PATH = __dirname + '/../apps-script/KPI.gs,' + __dirname + '/../apps-script/Help868.gs';
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
function sheet(name, rows) {
  const s = { rows: rows.map(r => r.slice()) };
  return Object.assign(s, {
    getName: () => name, getLastRow: () => s.rows.length,
    getDataRange: () => ({ getValues: () => s.rows.map(r => r.slice()) }),
    appendRow: r => { s.rows.push(r.slice()); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => Array.from({ length: nr || 1 }, (_, i) => Array.from({ length: nc || 1 }, (_, j) => { const row = s.rows[r - 1 + i] || []; return row[c - 1 + j] == null ? '' : row[c - 1 + j]; })),
      setValues: vs => vs.forEach((v, i) => v.forEach((x, j) => { while (s.rows.length < r + i) s.rows.push([]); s.rows[r - 1 + i][c - 1 + j] = x; }))
    })
  });
}
const tabs = [
  sheet('HELP868 Agents', [['Agent no.', 'Name', 'WhatsApp number', 'Active', 'Pendings'],
    ['A10024', 'Neil Ramnanan', '+1 (868) 555-0101', 'Yes', ''], ['A10031', 'Joy Sammah', '868 555 0102', 'No', ''], ['A10040', 'Rajiv Soodoo', '8685550103', 'Yes', 'No'], ['', 'Seven Digits', '5550104', 'Yes', '']]),
  sheet('Pendings Chase', [['Policy', 'Agent', 'Task', 'Owner', 'Due', 'Open tasks', 'Overdue', 'Last note at', 'Last note by', 'Last note', 'Earlier notes', 'Updated'],
    ['5000000001', 'Neil Ramnanan', 'Pending forms', 'Sasha Lalla-Jagassar', '2026-10-30', 1, 1, '1 Nov, 9:00 AM', 'Sasha Lalla-Jagassar', 'CLIENT SMITH medical booked', '[]', '2 Nov 2026, 6:00 AM'],
    ['5000000002', 'Neil Ramnanan', '', '', '', 0, 0, '', '', '', '[]', '2 Nov 2026, 6:00 AM'],
    ['5000000003', 'Someone Else', 'x', 'Azariah Griffith', '2026-11-05', 1, 0, '', '', 'secret', '[]', '2 Nov 2026, 6:00 AM']])
];
const ss = { getSheets: () => tabs, getSheetByName: n => tabs.find(t => t.getName() === n) || null, insertSheet: n => { const s = sheet(n, []); tabs.push(s); return s; } };
env.help868Ss_ = () => ss; env.iSs_ = () => ss;
// The harness's Utilities.formatDate ignores the pattern; this one honours the two patterns the file uses.
const realFmt = env.Utilities.formatDate;
env.Utilities.formatDate = (d, tz, f) => { const p2 = n => ('0' + n).slice(-2), y = d.getFullYear();
  if (f === 'yyMMdd') return p2(y % 100) + p2(d.getMonth() + 1) + p2(d.getDate());
  if (f === 'yyyy-MM-dd HH:mm') return y + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  return realFmt(d, tz, f); };
const mails = []; env.mailSend_ = o => { mails.push(o); return 'gmail'; };
env.managerEmails_ = () => ['boss@example.com'];
const props = env.PropertiesService.getScriptProperties();
const route = p => env.help868Route_(p);
const KEY = 'k'.repeat(24);

ok('off until the key is set', route({ action: 'help868.pendings', key: KEY, phone: '8685550101' }).error === 'HELP 868 is not switched on.');
props.setProperty('HELP868_KEY', KEY);
ok('wrong key refused', route({ action: 'help868.pendings', key: 'x', phone: '8685550101' }).error === 'Not allowed.');
ok('no number refused', /No WhatsApp number/.test(route({ action: 'help868.pendings', key: KEY }).error));

let r = route({ action: 'help868.pendings', key: KEY, phone: '+18685550101', agentNo: '10024' });
ok('a listed number sees its own cases only', r.verified && r.total === 2 && r.cases.length === 2, JSON.stringify(r));
ok('policy is the last four digits only', r.cases[0].policy === '••••0001', r.cases[0].policy);
ok('overdue case first', r.cases[0].overdue === 1 && r.overdue === 1 && r.noOpenTask === 1);
ok('first names only, no note words anywhere', r.cases[0].withTeam === 'Sasha' && !/SMITH|medical|secret|Someone/.test(JSON.stringify(r)));
ok('agent number may carry the letter', route({ action: 'help868.pendings', key: KEY, phone: '8685550101', agentNo: 'A10024' }).verified === true);
const bad = route({ action: 'help868.pendings', key: KEY, phone: '8685550101', agentNo: 'A99999' });
const unk = route({ action: 'help868.pendings', key: KEY, phone: '8689999999' });
ok('wrong agent number and unknown number answer the same', bad.verified === false && bad.message === unk.message && !bad.cases);
ok('inactive agent not verified', route({ action: 'help868.pendings', key: KEY, phone: '8685550102' }).verified === false);
ok('a seven-digit Salesforce number matches its WhatsApp form', route({ action: 'help868.pendings', key: KEY, phone: '+1 868 555 0104' }).verified === true);
ok('a bare seven digits is never a match', route({ action: 'help868.pendings', key: KEY, phone: '5550104' }).error === 'No WhatsApp number was sent.');
ok('Pendings = No not verified for pendings', route({ action: 'help868.pendings', key: KEY, phone: '8685550103' }).verified === false);

let e = route({ action: 'help868.enquiry', key: KEY, phone: '8689990001', name: 'Pat', category: 'payment', summary: 'My payment of 1234567 is missing, call 868-555-0000 or pat@example.com http://x.co/a' });
ok('enquiry filed with a reference', e.ok && /^H8-\d{6}-001$/.test(e.ref), JSON.stringify(e));
const log = tabs.find(t => t.getName() === 'HELP868 Enquiries');
ok('numbers, e-mails and links stripped from the stored summary', log.rows[1][6] === 'My payment of [number removed] is missing, call [number removed] or [e-mail removed] [link removed]', log.rows[1][6]);
ok('only the last four of the number is kept', log.rows[1][9] === '·0001' && !JSON.stringify(log.rows).includes('8689990001'));
ok('owner e-mailed once, with the reference', mails.length === 1 && mails[0].to === 'boss@example.com' && mails[0].subject.indexOf(e.ref) > -1);
const again = route({ action: 'help868.enquiry', key: KEY, phone: '8689990001', category: 'payment', summary: 'My payment of 1234567 is missing, call 868-555-0000 or pat@example.com http://x.co/a' });
ok('same words from the same number are not filed twice', again.repeat && again.ref === e.ref && log.rows.length === 2 && mails.length === 1);
e = route({ action: 'help868.enquiry', key: KEY, phone: '8689990001', category: 'nonsense', summary: '=HYPERLINK("x")' });
ok('second enquiry numbered 002, unknown category is Other, formula is neutralised', /-002$/.test(e.ref) && log.rows[2][2] === 'Other' && log.rows[2][6][0] === "'", log.rows[2].join('|'));
ok('verified agent is recorded as such', route({ action: 'help868.enquiry', key: KEY, phone: '8685550101', summary: 'Pending forms query' }).verifiedAgent === true);
ok('empty summary refused', route({ action: 'help868.enquiry', key: KEY, phone: '8689990002', summary: '  ' }).ok === false);
let limited = false; for (let i = 0; i < 25; i++) if (route({ action: 'help868.pendings', key: KEY, phone: '8689990003' }).limited) limited = true;
ok('one number is rate limited', limited);

const out = JSON.parse(env.doGet({ parameter: { action: 'help868.ping' } }).getContent());
ok('doGet routes help868.ping', out.ok === true && out.on === true && out.agents === 3, JSON.stringify(out));
const post = JSON.parse(env.doPost({ parameter: {}, postData: { contents: JSON.stringify({ action: 'help868.pendings', key: KEY, phone: '8685550101' }) } }).getContent());
ok('doPost routes help868.pendings', post.verified === true);
ok('ping reports the file is in the project', env.handle_('ping', {}).has.help868 === true);
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
