// Earthling and Angel 2026 (16 November 2026): the backend on a fake sheet.
const fs = require('fs'), vm = require('vm');
let fails = 0; const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
function sheetEnv(now) {
  const tabs = {}, props = {}, cache = {}, mails = [];
  const mkSheet = name => { const g = []; return { g, getRange: (r, c, nr, nc) => ({ setValues(v) { v.forEach((row, i) => { g[r - 1 + i] = g[r - 1 + i] || []; row.forEach((x, j) => g[r - 1 + i][c - 1 + j] = x); }); return this; }, setFontWeight() { return this; }, setValue(x) { g[r - 1] = g[r - 1] || []; g[r - 1][c - 1] = x; } }),
    setFrozenRows() {}, getLastRow: () => g.length, getDataRange: () => ({ getValues: () => g.map(r => r.slice()) }) }; };
  const ctx = { console, Date: class extends Date { constructor(...a) { super(...(a.length ? a : [now()])); } static now() { return now(); } }, JSON, Math, String, Object, Array,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => tabs[n], insertSheet: n => (tabs[n] = mkSheet(n)) }), openById: () => ({ getSheetByName: () => tabs.__bank }), getUi: () => { throw 1; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => props[k] = v, deleteProperty: k => delete props[k] }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => cache[k] = v }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: o => mails.push(o) }, Utilities: { getUuid: () => Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2), formatDate: d => new Date(d).toISOString().slice(0, 10) },
    ContentService: { createTextOutput: s => ({ setMimeType: () => s }), MimeType: {} }, ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ at: () => ({ create() {} }) }) }) } };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Angels.gs', 'utf8'), ctx);
  return { ctx, tabs, props, mails, cache };
}
let T = new Date('2026-11-17T10:00:00-04:00').getTime();
const E = sheetEnv(() => T), A = E.ctx;
const bank = { g: [['Agent', 'Agent no.', 'Email', 'Role', 'Active'], ['A00427 - Ricky Rampersad', 'A00427', 'r@x', 'Branch Manager', 'Yes'], ['SASHA LALLA', '', 's@x', 'Staff', 'Yes'], ['Neil Ramnanan', 'A10024', 'n@x', 'Agent', 'Yes'],
  ['Felicia Rampersad', 'A10050', 'f@x', 'Agent', 'Yes'], ['Gone Person', 'A1', 'g@x', 'Agent', 'Not Active'], ['Kamla Dookran', '', 'k@x', 'Branch Manager Assistant', 'Yes']] };
E.tabs.__bank = { getDataRange: () => ({ getValues: () => bank.g }) };
E.props.TEAM_SHEET_ID = 'x';
A.setupAngels();
const ppl = A.angPeople_();
ok('roster: active people only, five', ppl.length === 5 && !ppl.some(p => /Gone/.test(p.name)), ppl.map(p => p.name).join());
ok('a capitals name reads nicely', ppl.some(p => p.name === 'Sasha Lalla'));
E.props.ANGELS_CODE = 'team-code'; E.props.ANGELS_ADMIN_CODE = 'mgr-code';
const LG = id => ({ action: 'login', id, code: A.angIsAdmin_(A.angFind_(id) || {}) ? 'mgr-code' : 'team-code' });
const call = o => JSON.parse(A.angRoute_(o) && JSON.stringify(A.angRoute_(o)));
let r = A.angRoute_(LG('10024')); ok('agent number signs in (no prefix)', r.ok && r.name === 'Neil Ramnanan');
const tN = r.t;
ok('staff sign in by first name', A.angRoute_(LG('sasha')).ok);
ok('an unknown name is refused', !A.angRoute_(LG('nobody here')).ok);

// --- sign-in needs the passcode, and tries are limited (26 Nov 2026) ---
const R = o => A.angRoute_(o);
ok('a name alone is refused', !R({ action: 'login', id: 'sasha' }).ok);
ok('the Branch Manager by name alone is refused', !R({ action: 'login', id: 'Ricky Rampersad' }).ok);
ok('a wrong passcode is refused', !R({ action: 'login', id: 'sasha', code: 'nope' }).ok);
ok('the team passcode does not open the manager', !R({ action: 'login', id: 'Ricky Rampersad', code: 'team-code' }).ok);
ok('the manager passcode opens the manager', R({ action: 'login', id: 'Ricky Rampersad', code: 'mgr-code' }).admin === true);
ok('a refusal does not say whether the name exists', R({ action: 'login', id: 'nobody here', code: 'team-code' }).error === R({ action: 'login', id: 'sasha', code: 'bad' }).error);
for (let i = 0; i < 6; i++) R({ action: 'login', id: 'Felicia Rampersad', code: 'guess' + i });
ok('five wrong tries lock that person, even with the right code', /Too many/.test(R({ action: 'login', id: 'Felicia Rampersad', code: 'team-code' }).error || ''));
ok('another person is not locked by it', R({ action: 'login', id: 'Neil Ramnanan', code: 'team-code' }).ok);
const savedCode = E.props.ANGELS_CODE; delete E.props.ANGELS_CODE;
ok('no team passcode set: nobody signs in', !R({ action: 'login', id: 'Neil Ramnanan', code: '' }).ok);
E.props.ANGELS_CODE = savedCode; Object.keys(E.cache).filter(k => /^angt_/.test(k)).forEach(k => delete E.cache[k]);  // the lock times out after 15 minutes
ok('join needs one wish', !A.angRoute_({ action: 'join', t: tN }).ok);
r = A.angRoute_({ action: 'join', t: tN, w1: 'Golf balls', w2: '=HYPERLINK("x")', likes: 'Blue' });
ok('join saves, and a formula is defused', r.ok && r.joined && r.wish.w2.charAt(0) === "'", JSON.stringify(r.wish));
r = A.angRoute_({ action: 'join', t: tN, w1: 'Golf balls', w2: 'Book' }); ok('a second save updates, not duplicates', A.angRows_('Entries').length === 1);
ok('only an admin may draw', !A.angRoute_({ action: 'draw', t: tN }).ok);
const tR = A.angRoute_(LG('A00427')).t;
ok('the draw refuses under 3 joined', !A.angRoute_({ action: 'draw', t: tR }).ok);
['Felicia Rampersad', 'Kamla', 'Sasha'].forEach(n => { const t = A.angRoute_(LG(n)).t; A.angRoute_({ action: 'join', t, w1: 'Gift for ' + n }); });
T = new Date('2026-11-20T13:00:00-04:00').getTime();
ok('after noon on the 20th a non-admin cannot join', !A.angRoute_({ action: 'join', t: tN, w1: 'x' }).ok);
r = A.angRoute_({ action: 'remind', t: tR }); ok('the reminder goes to the one not joined (Ricky)', r.reminded === 1, String(r.reminded));
E.mails.length = 0;
r = A.angRoute_({ action: 'draw', t: tR }); ok('the draw: 4 Angels, 4 e-mails', r.ok && r.angels === 4 && E.mails.length === 4, JSON.stringify(r));
const pairs = A.angRows_('Pairs');
ok('nobody draws themselves', pairs.every(p => p['Angel key'] !== p['Earthling key']));
ok('everyone gives once and receives once', new Set(pairs.map(p => p['Earthling key'])).size === 4);
ok('no two draw each other', !pairs.some(p => pairs.some(q => q['Angel key'] === p['Earthling key'] && q['Earthling key'] === p['Angel key'])));
ok('the draw cannot run twice', !A.angRoute_({ action: 'draw', t: tR }).ok);
const me = A.angRoute_({ action: 'me', t: tN });
ok('my page shows my Earthling and their wish list', me.earthling && me.earthling.wish && me.earthling.wish.w1 && !me.angel);
E.mails.length = 0;
r = A.angRoute_({ action: 'note', t: tN, text: 'Merry Christmas, from your Angel!' });
const earth = pairs.find(p => p['Angel key'] === 'neil ramnanan');
ok('a note reaches the Earthling by e-mail, with no Angel name', E.mails.length === 1 && !/Neil/.test(E.mails[0].htmlBody + E.mails[0].subject + E.mails[0].name));
const eTok = A.angRoute_(LG(earth.Earthling)).t; const em = A.angRoute_({ action: 'me', t: eTok });
ok('the Earthling sees the note, not who sent it', em.notesIn.length === 1 && !JSON.stringify(em).includes('Neil') , JSON.stringify(em.notesIn));
A.angRoute_({ action: 'reveal', t: tR });
ok('after the reveal the Earthling sees their Angel', A.angRoute_({ action: 'me', t: eTok }).angel === 'Neil Ramnanan');
ok('ping answers with counts and no names', (() => { const p = A.angRoute_({ action: 'ping' }); return p.ok && p.joined === 4 && !/Neil|Sasha/.test(JSON.stringify(p)); })());
console.log(fails ? fails + ' FAILED' : 'all green'); process.exit(fails ? 1 : 0);
