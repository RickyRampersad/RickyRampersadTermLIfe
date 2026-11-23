// Each group's Schedule of Benefits for its employees (23 November 2026): staff upload and publish it on the group's
// page, employees read it from the link HR shares, and the HELP 868 WhatsApp assistant looks up the lines of the
// member's own plan. GroupSchedules.gs runs in a sandbox with the sheet, Salesforce, Drive and the cache in memory.
// Every group, member number and figure below is invented.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };

function fakeSheet() {
  const grid = [];
  const parse = v => {
    if (typeof v === 'string') {
      if (v.charAt(0) === "'") return v.slice(1);
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00Z');
      if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
      if (/^=/.test(v)) return '#FORMULA';
    }
    return v;
  };
  const sh = {
    grid,
    getLastRow: () => grid.length,
    getLastColumn: () => grid.reduce((m, r) => Math.max(m, (r || []).length), 0),
    setFrozenRows() {},
    getRange(r, c, nr = 1, nc = 1) {
      return {
        setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => { (grid[r - 1 + i] = grid[r - 1 + i] || [])[c - 1 + j] = parse(v); })); return this; },
        setValue(v) { (grid[r - 1] = grid[r - 1] || [])[c - 1] = parse(v); return this; },
        getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (grid[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; },
        setFontWeight() { return this; }
      };
    },
    getDataRange() { return sh.getRange(1, 1, grid.length, sh.getLastColumn()); }
  };
  return sh;
}
const SHEETS = {};
const SS = { getSheetByName: n => SHEETS[n] || null, insertSheet: n => (SHEETS[n] = fakeSheet()) };
const PROPS = {}, CACHE = {}, FILES = {};
let TODAY = '2026-11-23', SF_ON = true, QUERIES = [];

const G = { key: 'HARBOURPOINTLOGISTICSLTD', name: 'Harbour Point Logistics Ltd', accts: ['001AAAAAAAAAAAA'], billKeys: ['TQQ0001'], assigned: 'Kerry Sample' };
const OTHER = { key: 'CORALBAYTRADINGLTD', name: 'Coral Bay Trading Ltd', accts: ['001BBBBBBBBBBBB'], billKeys: ['TQQ0002'], assigned: 'Lee Sample' };
/* the members Salesforce holds: a live one at Harbour Point, a terminated one, one at Coral Bay */
const POLS = [
  { Id: 'a1', POLICY__c: 'TQX1234-00012-00', Certificate__c: '00012', Account__c: '001AAAAAAAAAAAAXYZ', List_Bill__c: 'TQQ 0001', Policy_Status_Description__c: 'Premium Paying', FIRST_NAME__c: 'Marcus', LAST_NAME__c: 'Sample' },
  { Id: 'a2', POLICY__c: 'TQX1234-00013-00', Certificate__c: '00013', Account__c: '001AAAAAAAAAAAAXYZ', List_Bill__c: 'TQQ 0001', Policy_Status_Description__c: 'Terminated', FIRST_NAME__c: 'Dana', LAST_NAME__c: 'Example' },
  { Id: 'b1', POLICY__c: 'TQX5678-00001-00', Certificate__c: '00001', Account__c: '001BBBBBBBBBBBBXYZ', List_Bill__c: 'TQQ 0002', Policy_Status_Description__c: 'Premium Paying', FIRST_NAME__c: 'Robin', LAST_NAME__c: 'Other' }
];
const signed = u8 => Array.from(u8, b => (b > 127 ? b - 256 : b));
const ymd = v => v instanceof Date ? v.toISOString().slice(0, 10) : (String(v || '').match(/^\d{4}-\d{2}-\d{2}/) || [''])[0];
let WHO = { ok: true, role: 'staff', name: 'Kerry Sample', email: 'kerry@branch.example' };

const sb = {
  console,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => PROPS[k] || null, setProperty: (k, v) => { PROPS[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: k => (k in CACHE ? CACHE[k] : null), put: (k, v) => { CACHE[k] = String(v); }, remove: k => { delete CACHE[k]; } }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate: () => TODAY.slice(2).replace(/-/g, ''),
    computeHmacSha256Signature: (v, k) => signed(crypto.createHmac('sha256', k).update(v).digest()),
    base64Decode: s => signed(Buffer.from(s, 'base64')), base64Encode: bytes => Buffer.from(bytes.map(x => x & 255)).toString('base64'),
    newBlob: (data, type, name) => ({ data, type, name, getBytes: () => data })
  },
  DriveApp: { getFileById: id => { const f = FILES[id]; if (!f) throw new Error('no file'); return { getBlob: () => ({ getBytes: () => f.data }) }; } },
  Logger: { log() {} },
  gcmSS_: () => SS,
  gcmRows_: name => { const sh = SS.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return []; const vals = sh.getDataRange().getValues(), head = vals[0].map(h => String(h).trim()); return vals.slice(1).map((r, i) => { const o = { _n: i + 2 }; head.forEach((h, j) => { if (h) o[h] = r[j]; }); return o; }); },
  gcmText_: x => x === null || x === undefined ? '' : (x instanceof Date ? ymd(x) : String(x).trim()),
  gcmCodeKey_: s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
  gcmBillKey_: s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
  gcmId15_: s => String(s || '').slice(0, 15),
  gcmIn_: list => list.map(x => "'" + String(x).replace(/'/g, "\\'") + "'").join(','),
  gcmToday_: () => TODAY, gcmWhen_: () => TODAY + ' 10:00', tTz_: () => 'America/Port_of_Spain',
  gcmRegister_: () => [G, OTHER],
  gcmWho_: () => WHO,
  gcmMine_: (who, g) => who.role === 'branch' || who.role === 'deputy' || g.assigned === who.name,
  tSfOn_: () => SF_ON,
  gcmQuery_: soql => {
    QUERIES.push(soql);
    const forms = (soql.match(/POLICY__c IN \(([^)]*)\)/) || ['', ''])[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
    return POLS.filter(p => forms.indexOf(p.POLICY__c) >= 0 || forms.indexOf(p.POLICY__c.replace(/-/g, '')) >= 0);
  },
  gblFolderId_: () => 'folder1',
  gblSubfolder_: () => ({ createFile: blob => { const id = 'file' + (Object.keys(FILES).length + 1); FILES[id] = blob; return { getId: () => id, setName() {} }; } })
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/GroupSchedules.gs'), 'utf8'), sb);

const SCHEDULE = [
  'GROUP HEALTH SCHEDULE OF BENEFITS',
  'Major Medical Maximum | $500,000 per person',
  'Calendar Year Deductible | $300 per person | $900 per family',
  'Co-insurance | 80% in network | 70% out of network',
  'HOSPITAL BENEFITS',
  'Room and board, daily maximum | $1,500 per day',
  'Intensive care unit | $3,000 per day',
  'DENTAL',
  'Preventive dental | 100% | $1,000 per year',
  'Major dental | 50% after deductible',
  'VISION',
  'Eye examination | $200 every 24 months',
  'Lenses and frames | $500 every 24 months',
  'MATERNITY',
  'Normal delivery | $10,000',
  'PRESCRIPTION DRUGS',
  'Prescription drugs | 80% after deductible'
].join('\n');
const run = (a, o, m) => sb.gsbRoute_(Object.assign({ action: a }, o), m || 'get');

console.log('\nRouting and the ping');
ok('an action it does not know is left alone (null)', run('gcm.nothing', {}) === null && run('gcm.nothing', {}, 'post') === null);
let ping = run('gcm.planPing', {});
ok('the ping names its build and that WhatsApp is off', ping.ok && ping.plans === 1 && /^2026-/.test(ping.build) && ping.whatsapp === false && ping.published === 0);

console.log('\nStaff: save, publish, replace, take down');
WHO = { ok: false, error: 'Sign in first.' };
ok('a save without signing in is refused', run('gcm.sobAct', { act: 'save', group: G.name, line: 'health', text: SCHEDULE }, 'post').ok === false);
WHO = { ok: true, role: 'staff', name: 'Lee Sample', email: 'lee@branch.example' };
let r = run('gcm.sobAct', { act: 'save', group: G.name, line: 'health', text: SCHEDULE }, 'post');
ok('a staff member who does not look after the group cannot change its schedule', r.ok === false && /Kerry Sample/.test(r.error));
WHO = { ok: true, role: 'staff', name: 'Kerry Sample', email: 'kerry@branch.example' };
ok('a schedule with hardly any text is refused', run('gcm.sobAct', { act: 'save', group: G.name, line: 'health', text: 'Schedule' }, 'post').ok === false);
ok('a plan line it does not know is refused', run('gcm.sobAct', { act: 'save', group: G.name, line: 'pets', text: SCHEDULE }, 'post').ok === false);
r = run('gcm.sobAct', { act: 'save', group: G.name, line: 'health', text: SCHEDULE.replace(/\n/g, '\r\n') + '\n\n\n\nNotes\t| tabbed', effective: '2026-06-01', pdf: Buffer.from('%PDF-1.4 fake').toString('base64'), fileName: 'GH schedule.pdf' }, 'post');
ok('the owner saves a draft, with a reference and the PDF kept in Drive', r.ok && /^SB-261123-001$/.test(r.ref) && r.kept === true, JSON.stringify(r));
const ref1 = r.ref;
let list = run('gcm.sobList', { group: G.name });
ok('the staff list shows the draft, not yet published, and no employee link yet', list.ok && list.schedules.length === 1 && list.schedules[0].status === 'draft' && !list.link && list.canAct === true);
ok('the text is cleaned: no carriage returns, runs of blank lines folded, a tab is a column', list.schedules[0].text.indexOf('\r') < 0 && !/\n{3}/.test(list.schedules[0].text) && /Notes \| tabbed/.test(list.schedules[0].text));
ok('the effective date is kept as written, not turned into a date by the sheet', list.schedules[0].effective === '2026-06-01');
ok('a staff member who does not look after it sees it but cannot change it', (WHO = { ok: true, role: 'staff', name: 'Lee Sample' }, run('gcm.sobList', { group: G.name }).canAct === false));
WHO = { ok: true, role: 'staff', name: 'Kerry Sample', email: 'kerry@branch.example' };
const k = sb.gsbToken_(G.key);
let v = run('gcm.sobView', { k });
ok('before publishing, the employee page shows nothing and says so', v.ok && v.plans.length === 0 && /not on this page yet/.test(v.note));
r = run('gcm.sobAct', { act: 'publish', group: G.name, ref: ref1 }, 'post');
ok('publishing gives the employee link', r.ok && r.link === 'https://rickyrampersadbranch.com/mybenefits/?k=' + k);
v = run('gcm.sobView', { k });
ok('the employee page now shows the plan, its title and date', v.ok && v.group === G.name && v.plans.length === 1 && v.plans[0].label === 'Group Health' && v.plans[0].effective === '2026-06-01' && /Preventive dental/.test(v.plans[0].text));
ok('the page link names no employer and is the group’s own code', !/harbour/i.test(r.link) && k.length === 20 && sb.gsbToken_(OTHER.key) !== k);
ok('a wrong or shortened code shows nothing', run('gcm.sobView', { k: k.slice(0, 19) + 'f' }).ok === false && run('gcm.sobView', { k: 'abc' }).ok === false);
ok('another group’s code shows only that group (nothing published there)', run('gcm.sobView', { k: sb.gsbToken_(OTHER.key) }).plans.length === 0);
const pdf = run('gcm.sobPdf', { k, ref: ref1 });
ok('the PDF downloads from the page, by the group’s code', pdf.ok && Buffer.from(pdf.b64, 'base64').toString() === '%PDF-1.4 fake');
ok('the PDF is refused with another group’s code', run('gcm.sobPdf', { k: sb.gsbToken_(OTHER.key), ref: ref1 }).ok === false);
r = run('gcm.sobAct', { act: 'save', group: G.name, ref: ref1, line: 'health', text: SCHEDULE + '\nEdited' }, 'post');
ok('a published schedule is never edited in place', r.ok === false && /new draft/.test(r.error));
const ref2 = run('gcm.sobAct', { act: 'save', group: G.name, line: 'health', text: SCHEDULE.replace('$500,000', '$750,000'), effective: '2027-06-01' }, 'post').ref;
ok('the new year’s draft does not touch the page until published', /\$500,000/.test(run('gcm.sobView', { k }).plans[0].text));
run('gcm.sobAct', { act: 'publish', group: G.name, ref: ref2 }, 'post');
v = run('gcm.sobView', { k });
ok('publishing the new one replaces the old: one Group Health schedule on the page', v.plans.length === 1 && /\$750,000/.test(v.plans[0].text) && v.plans[0].hasPdf === false);
ok('the old row reads replaced, with the reference that replaced it', sb.gsbAll_().filter(s => s.ref === ref1)[0].status === 'replaced' && /replaced by SB-/.test(sb.gsbAll_().filter(s => s.ref === ref1)[0].note));
const life = run('gcm.sobAct', { act: 'save', group: G.name, line: 'life', text: 'GROUP LIFE\nBasic life | 2 times annual salary, at most $500,000\nAccidental death | same as basic life\nConversion | within 31 days of leaving' }, 'post').ref;
run('gcm.sobAct', { act: 'publish', group: G.name, ref: life }, 'post');
ok('Group Health and Group Life show side by side, health first', run('gcm.sobView', { k }).plans.map(p => p.line).join() === 'health,life');
const evil = run('gcm.sobAct', { act: 'save', group: G.name, line: 'other', title: '=HYPERLINK("x")', text: '=IMPORTXML("http://x")\n' + SCHEDULE }, 'post');
ok('a title or text starting with = is stored as text, never as a formula', evil.ok && SHEETS['Group Schedules'].grid.every(row => row.indexOf('#FORMULA') < 0));
run('gcm.sobAct', { act: 'retire', group: G.name, ref: life }, 'post');
ok('taking one down removes it from the page', run('gcm.sobView', { k }).plans.map(p => p.line).join() === 'health');
ping = run('gcm.planPing', {});
ok('the ping counts what is published', ping.published === 1);

console.log('\nWhatsApp: the member’s own plan');
r = run('gcm.planLookup', { card: 'TQX1234-00012-00', question: 'dentist' }, 'post');
ok('with no key set, look-ups are refused and say what to set', r.ok === false && /PLAN_LOOKUP_KEY/.test(r.error));
sb.gsbMakeLookupKey();
const KEY = PROPS.PLAN_LOOKUP_KEY;
ok('the editor makes the key', KEY && KEY.length === 32);
ok('a wrong key is refused', run('gcm.planLookup', { key: 'nope', card: 'TQX1234-00012-00' }, 'post').ok === false);
r = run('gcm.planLookup', { key: KEY, phone: '+1 868 555 0101', card: 'tqx 1234-00012-00', question: 'Does it cover the dentist?' }, 'post');
ok('a member number typed loosely finds the member’s group', r.ok && r.found && r.group === G.name && r.schedule === true, JSON.stringify(r).slice(0, 300));
const lines = r.plans[0].lines;
ok('the answer is the dental lines, under their heading', /## DENTAL/.test(lines) && /Preventive dental \| 100% \| \$1,000 per year/.test(lines) && /Major dental/.test(lines));
ok('lines that do not bear on the question are left out', !/Room and board/.test(lines) && !/Normal delivery/.test(lines));
ok('the response carries the rule: answer only from these lines, Guardian assesses every claim', /only from these lines/.test(r.rule) && /assesses every claim/.test(r.rule));
ok('nothing of the member comes back: no name, no policy number', !/Marcus|Sample|00012/.test(JSON.stringify(r).replace(/Kerry Sample|Lee Sample/g, '')));
ok('the page link comes back for them to read it all', r.link === 'https://rickyrampersadbranch.com/mybenefits/?k=' + k);
r = run('gcm.planLookup', { key: KEY, phone: '18685550101', card: 'TQX1234-00012-00', question: 'how much for glasses' }, 'post');
ok('“glasses” finds the vision lines', /## VISION/.test(r.plans[0].lines) && /Lenses and frames/.test(r.plans[0].lines) && !/dental/i.test(r.plans[0].lines));
r = run('gcm.planLookup', { key: KEY, phone: '18685550101', card: 'TQX1234-00012-00', question: 'I am pregnant, what is covered' }, 'post');
ok('“pregnant” finds maternity', /Normal delivery \| \$10,000/.test(r.plans[0].lines));
r = run('gcm.planLookup', { key: KEY, phone: '18685550101', card: 'TQX1234-00012-00', question: 'zebra crossing' }, 'post');
ok('a question the schedule says nothing about: matched 0, and the opening lines to go on', r.matched === 0 && /Major Medical Maximum/.test(r.plans[0].lines));
r = run('gcm.planLookup', { key: KEY, phone: '18685550101', planCode: k.toUpperCase(), question: 'deductible' }, 'post');
ok('the plan code from the page works instead of a card', r.found && r.group === G.name && /Calendar Year Deductible/.test(r.plans[0].lines));
r = run('gcm.planLookup', { key: KEY, phone: '18685550102', card: 'TQX1234-00013-00', question: 'dental' }, 'post');
ok('a terminated member gets no schedule, only an offer to check', r.found === false && r.reason === 'not active' && !r.plans);
r = run('gcm.planLookup', { key: KEY, phone: '18685550103', card: 'TQX5678-00001-00', question: 'dental' }, 'post');
ok('a member of a group with nothing published is told so and offered a request', r.found === true && r.schedule === false && /not online with us yet/.test(r.say));
r = run('gcm.planLookup', { key: KEY, phone: '18685550104', question: 'dental' }, 'post');
ok('no number at all: asked for the member number on the card', r.found === false && r.reason === 'no number' && /health card/.test(r.say));
for (let i = 0; i < 8; i++) run('gcm.planLookup', { key: KEY, phone: '18685550199', card: 'NOPE999-0000' + i, question: 'x' }, 'post');
r = run('gcm.planLookup', { key: KEY, phone: '18685550199', card: 'TQX1234-00012-00', question: 'dental' }, 'post');
ok('eight numbers not found from one phone: it stops trying for fifteen minutes', r.found === false && r.reason === 'tries');
CACHE['gsb-day-18685550101-' + TODAY] = '40';
r = run('gcm.planLookup', { key: KEY, phone: '18685550101', card: 'TQX1234-00012-00', question: 'dental' }, 'post');
ok('forty look-ups in a day from one phone: a person takes over', r.found === false && r.reason === 'limit');
SF_ON = false;
r = run('gcm.planLookup', { key: KEY, phone: '18685550105', card: 'TQX1234-00012-00', question: 'dental' }, 'post');
ok('with Salesforce off, a card cannot be checked, so nothing is shown', r.found === false);
SF_ON = true;
ok('only Group Health and Group Life records are searched', QUERIES.every(q => /RecordType\.Name IN \('HEALTH \(GROUP\)', 'LIFE\(GROUP\)'\)/.test(q)));

console.log('\nWhat staff see of the questions');
const log = sb.gcmRows_('Plan Questions');
ok('each look-up is a row, the phone shown only by its last four digits', log.length >= 5 && log.every(x => !x.Phone || /^…\d{4}$/.test(x.Phone)));
ok('a page visit is one row an hour, not one a visit', log.filter(x => x.Via === 'page opened' && x.Group === G.name).length === 1);
list = run('gcm.sobList', { group: G.name });
ok('the group’s page lists the latest questions for staff', list.questions.length >= 3 && list.questions.some(q => /dentist/.test(q.q)));

console.log('\nThe router in GroupClients.gs hands over');
const gc = fs.readFileSync(path.join(ROOT, 'apps-script/GroupClients.gs'), 'utf8');
ok('GET and POST both pass unknown actions to gsbRoute_', (gc.match(/gsbRoute_\(/g) || []).length === 2);
ok('the ping carries plans', /plans: \(function \(\) \{ try \{ return typeof gsbPing_/.test(gc));

console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
