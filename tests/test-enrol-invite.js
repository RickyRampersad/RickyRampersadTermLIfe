// New members who fill in their own part of the group enrolment (17 November 2026): the group sends the employee their
// own link, the employee completes Sections A to D, the health declaration and the signature, the group checks it,
// completes Section F and approves, and it goes to EB Customer Care on Guardian's own GIO001 with the declaration
// attached. GroupBilling.gs runs in a sandbox with the sheet, the mail and pdf-lib in memory; Guardian's blank GIO001 is
// the repository's. Every name, address and code below is invented.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const PDFLib = require(path.join(ROOT, 'motor-quote/vendor/pdf-lib-1.17.1.min.js'));
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };

/* ── a spreadsheet in memory that reads back the way Sheets does: a leading apostrophe keeps text, a bare date or number
      is parsed (the trap the invite code must avoid) ── */
function fakeSheet() {
  const grid = [];
  const parse = v => {
    if (typeof v === 'string') {
      if (v.charAt(0) === "'") return v.slice(1);
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00Z');
      if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
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
        setFontWeight() { return this; }, clearContent() { return this; }
      };
    },
    getDataRange() { return sh.getRange(1, 1, grid.length, sh.getLastColumn()); }
  };
  return sh;
}
const SHEETS = {};
const SS = { getSheetByName: n => SHEETS[n] || null, insertSheet: n => (SHEETS[n] = fakeSheet()), getSpreadsheetTimeZone: () => 'America/Port_of_Spain', getId: () => 'gs' };

/* ── blobs, mail, properties ── */
const signed = u8 => Array.from(u8, b => (b > 127 ? b - 256 : b));
function blob(bytes, type, name) {
  const b = { _bytes: bytes, _type: type, _name: name || '', getBytes: () => bytes, getName: () => b._name, setName(n) { b._name = n; return b; }, getContentType: () => b._type,
    getDataAsString: () => Buffer.from(bytes.map(x => x & 255)).toString('utf8'), copyBlob: () => blob(bytes, type, b._name),
    getAs(t) { const p = blob(bytes, t, b._name.replace(/\.html$/, '.pdf')); p._fromHtml = b.getDataAsString(); return p; } };
  return b;
}
const LIB_TEXT = fs.readFileSync(path.join(ROOT, 'motor-quote/vendor/pdf-lib-1.17.1.min.js'), 'utf8');
const GIO001 = fs.readFileSync(path.join(ROOT, 'groupclientmanagement/forms/GIO001.pdf'));
const PROPS = {}, CACHE = {}, MAILS = [], CHANGES = [], TOLD = [];
let TODAY = '2026-11-17', LIVE = false, uuid = 0;

const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ymd = v => v instanceof Date ? v.toISOString().slice(0, 10) : (String(v || '').match(/^\d{4}-\d{2}-\d{2}/) || [''])[0];
const G = { key: 'harbour', name: 'Harbour Point Logistics Ltd', bills: ['TQQ 0001'], code: 'HPL123', to: ['hr@harbourpoint.example'], cc: [], ownerEmail: 'owner@branch.example', assigned: 'Kerry Sample', ownerActive: true, tasks: [] };
const OTHER = { key: 'other', name: 'Another Group Ltd', bills: ['TQQ 0002'], code: 'OTH999', to: ['hr@other.example'], cc: [], ownerEmail: 'owner2@branch.example', assigned: 'Lee Sample', ownerActive: true, tasks: [] };

const sb = {
  console, Buffer, TextEncoder, TextDecoder,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'GCM_BILL_LIVE' ? (LIVE ? 'yes' : '') : (PROPS[k] || '')), setProperty: (k, v) => { PROPS[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: k => CACHE[k] || null, put: (k, v) => { CACHE[k] = String(v); }, remove: k => { delete CACHE[k]; } }) },
  Utilities: {
    getUuid: () => { uuid++; return require('crypto').randomUUID(); },
    formatDate: (d, tz, f) => f === 'yyMMdd' ? TODAY.slice(2).replace(/-/g, '') : f === 'yyyy-MM-dd HH:mm' ? TODAY + ' 10:00' : TODAY,
    base64Decode: s => signed(Buffer.from(s, 'base64')), base64Encode: bytes => Buffer.from(bytes.map(x => x & 255)).toString('base64'),
    newBlob: (data, type, name) => blob(typeof data === 'string' ? signed(Buffer.from(data, 'utf8')) : data, type, name)
  },
  UrlFetchApp: { fetch: () => { throw new Error('no network in the test'); } },
  DriveApp: { getFolderById: () => { throw new Error('no Drive in the test'); } },
  gcmSS_: () => SS,
  gcmRows_: name => { const sh = SS.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return []; const vals = sh.getDataRange().getValues(), head = vals[0].map(h => String(h).trim()); return vals.slice(1).map((r, i) => { const o = { _n: i + 2 }; head.forEach((h, j) => { if (h) o[h] = r[j]; }); return o; }); },
  gcmText_: x => x === null || x === undefined ? '' : (x instanceof Date ? ymd(x) : String(x).trim()),
  gcmYes_: x => x === true || /^(y|yes|true|1|x)$/i.test(String(x === undefined || x === null ? '' : x).trim()),
  gcmYmd_: ymd, gcmToday_: () => TODAY, gcmAddDays_: addDays, gcmDow_: d => { const n = new Date(d + 'T12:00:00Z').getUTCDay(); return n === 0 ? 7 : n; },
  gcmWhen_: () => TODAY + ' 10:00', gcmCodeKey_: s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
  gcmLoad_: () => ({ reg: [G, OTHER], today: TODAY }),
  gcmClientAuth_: (L, lb, code) => { const g = [G, OTHER].find(x => x.bills[0] === lb && x.code === code); return g ? { ok: true, g } : { ok: false, error: 'That list bill and access code do not match.' }; },
  gcmCc_: g => ['sales@branch.example'], gcmDayManager_: () => 'manager@branch.example', gcmNiceName_: n => n, gcmSigner_: (who) => who.name,
  tTz_: () => 'America/Port_of_Spain', tEsc_: s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  tDmy_: s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || ''); },
  tInternal_: () => 'Internal.', tLegal_: () => '<p class="legal">Confidential.</p>', tSay_: s => s,
  tTries_: k => Number(CACHE[k] || 0), tTriesAdd_: k => { CACHE[k] = String(Number(CACHE[k] || 0) + 1); }, tTriesClear_: k => { delete CACHE[k]; },
  tMsCreds_: () => true, tMsSend_: (to, subject, html, o) => { MAILS.push({ to, subject, html, cc: (o || {}).cc || [], att: (o || {}).attachments || [] }); },
  GCM: { SITE: 'https://rickyrampersadbranch.com/groupclientmanagement/', COPY: ['sales@branch.example'], TELL_CC: ['sales@branch.example'] },
  TRANSITION: { CC: ['branch1@branch.example', 'branch2@branch.example'], MS_FROM: 'support@rickyrampersadbranch.com' }
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/GroupBilling.gs'), 'utf8'), sb, { filename: 'GroupBilling.gs' });
// the stubs win over the file's own definitions of the same names
Object.assign(sb, {
  gblMembers_: () => ({ ok: true, members: [{ line: 'health', policy: 'HP-0001-01' }, { line: 'life', policy: 'LP-0002-01' }] }),
  gblChange_: (g, who, line, b, source, extra) => { CHANGES.push({ g: g.key, who: who.name, line, b, source, extra }); return { task: '00T0000000000' + CHANGES.length }; },
  gblTellOwner_: (g, name, kind, line, b) => TOLD.push({ g: g.key, kind, line, b }),
  gblWorkingDay_: d => sb.gcmDow_(d) <= 5,
  gblFormFile_: (name, optional) => name === 'pdf-lib.min.js' ? blob(signed(Buffer.from(LIB_TEXT, 'utf8')), 'text/javascript', name) : name === 'GIO001.pdf' ? blob(signed(GIO001), 'application/pdf', name) : (optional ? null : (() => { throw new Error('no such form ' + name); })())
});

const tab = () => SHEETS['Group Enrolments'];
const rows = () => sb.gcmRows_('Group Enrolments');
const auth = { lb: 'TQQ 0001', code: 'HPL123' };
// a small signature: a real PNG (a dark diagonal stroke on transparent), as a canvas would hand over
function makePng(w, h) {
  const zlib = require('zlib'), crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const on = Math.abs(Math.round(x * h / w) - y) < 2, o = y * (w * 4 + 1) + 1 + x * 4; if (on) { raw[o] = 28; raw[o + 1] = 39; raw[o + 2] = 51; raw[o + 3] = 255; } }
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
const PNG = makePng(80, 20);

(async () => {
  console.log('\nThe group sends a new member their own link (test mode):\n');
  let r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'create', first: 'Marcus', last: 'Sample', email: 'marcus@home.example', covHealth: 'Y', covLife: 'Y', effective: '2026-12-01', name: 'Pat Admin', authorised: '' }));
  ok('the authorised tick is required', !r.ok && /authorised/.test(r.error), JSON.stringify(r));
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'create', first: 'Marcus', last: 'Sample', email: 'not-an-email', covHealth: 'Y', effective: '2026-12-01', name: 'Pat Admin', authorised: 'Y' }));
  ok('a real e-mail address is required', !r.ok && /e-mail address/.test(r.error));
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'create', first: 'Marcus', last: 'Sample', email: 'marcus@home.example', effective: '2026-12-01', name: 'Pat Admin', authorised: 'Y' }));
  ok('the cover is required', !r.ok && /Which cover/.test(r.error));
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'create', first: 'Marcus', last: 'Sample', email: 'marcus@home.example', covHealth: 'Y', covLife: 'Y', name: 'Pat Admin', authorised: 'Y' }));
  ok('the effective date is required', !r.ok && /effective date/.test(r.error));
  ok('nothing was sent for the refusals', MAILS.length === 0 && !tab());
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'create', first: 'marcus', last: 'sample', email: 'Marcus@Home.example', mobile: '868-555-0101', covHealth: 'Y', covLife: 'Y', effective: '2026-12-01', name: 'Pat Admin', role: 'HR Manager', authorised: 'Y' }));
  ok('created, with a reference', r.ok && /^EN-261117-001$/.test(r.ref), JSON.stringify(r));
  ok('test mode says so', r.test && /Test/.test(r.said));
  let row = rows()[0];
  ok('one row on Group Enrolments', rows().length === 1 && row.Employee === 'Marcus Sample' && row.First === 'Marcus' && row['E-mail'] === 'marcus@home.example');
  ok('the code is random, 32 hex, not made from the name', /^[a-f0-9]{32}$/.test(row.Code) && !/marcus|sample/i.test(row.Code));
  ok('dates and numbers kept as text (no Sheets parsing)', row.Effective === '2026-12-01' && row.Expires === '2027-01-16' && typeof row.Effective === 'string', typeof row.Effective + ' ' + row.Effective);
  ok('the mobile kept as text', row.Mobile === '868-555-0101');
  ok('waiting, no reminders yet, marked Test', row.Status === 'waiting' && String(row.Reminders) === '0' && row.Test === 'Y');
  let m = MAILS[0];
  ok('test: the e-mail went to the account owner, not the employee', m.to === 'owner@branch.example' && !MAILS.some(x => x.to === 'marcus@home.example' || x.cc.includes('marcus@home.example')));
  ok('test: the branch copied, marked TEST, with a banner naming the employee', m.cc.includes('branch1@branch.example') && /^\[TEST\] /.test(m.subject) && /would go to marcus@home\.example/.test(m.html));
  ok('the e-mail carries the employee’s own link and the button', m.html.indexOf('benefits/enroll.html?inv=' + row.Code) >= 0 && /Complete my part/.test(m.html));
  ok('it says the employer does not see the health answers', /does not see them/.test(m.html));
  ok('signed by whoever looks after the group', /Kerry Sample/.test(m.html));
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'create', first: 'Marcus', last: 'Sample', email: 'marcus@home.example', covHealth: 'Y', effective: '2026-12-01', name: 'Pat Admin', authorised: 'Y' }));
  ok('a second link to the same e-mail is refused while one is open', !r.ok && /already has a link/.test(r.error));

  console.log('\nThe group sees where each new member stands:\n');
  let list = sb.gblClientForm_(Object.assign({}, auth, { form: 'invite' }));
  ok('listed, waiting on Marcus', list.ok && list.invites.length === 1 && list.invites[0].status === 'waiting' && /Waiting on Marcus/.test(list.invites[0].words) && list.counts.waiting === 1);
  ok('the list carries no code, health answers or signature', !/allWell|data:image|"Signature"/.test(JSON.stringify(list)) && JSON.stringify(list).indexOf(row.Code) < 0);
  let other = sb.gblClientForm_({ lb: 'TQQ 0002', code: 'OTH999', form: 'invite' });
  ok('another group sees none of it', other.ok && other.invites.length === 0);

  console.log('\nThe employee opens their link:\n');
  let gt = sb.gblEnrolGet_({ inv: row.Code });
  ok('read by the code', gt.ok && gt.invite.company === 'Harbour Point Logistics Ltd' && gt.invite.first === 'Marcus' && gt.invite.last === 'Sample' && gt.invite.adminFirst === 'Pat' && gt.invite.effective === '2026-12-01', JSON.stringify(gt));
  ok('the cover the group chose', gt.invite.cover.health && gt.invite.cover.life);
  ok('only their own fields: no code, no other member, no list bill', !/HPL123|TQQ|Code|code|hr@harbourpoint/.test(JSON.stringify(gt)));
  ok('a code in the wrong shape is refused', !sb.gblEnrolGet_({ inv: 'abc' }).ok);
  const tries0 = Number(CACHE['gbl-inv-tries'] || 0);
  ok('an unknown code is refused and counted', !sb.gblEnrolGet_({ inv: 'f'.repeat(32) }).ok && Number(CACHE['gbl-inv-tries']) === tries0 + 1);

  console.log('\nThe employee sends their part:\n');
  const answers = { employee: 'Marcus Sample', dob: '1984-08-22', gender: 'M', email: 'marcus@home.example', telCell: '868-555-0101', telWork: '868-555-0102', marital: 'MARRIED', occupation: 'Operations Manager', address: '8 Sample Gardens, Arima',
    idType: 'ID', idNo: 'ID-0001-SAMPLE', otherPlan: 'no', covVoluntary: false, covDependentLife: false,
    deps: [{ key: 'd0', rel: 'SPOUSE', name: 'Renee Sample', gender: 'F', dob: '1986-03-04', country: 'TRINIDAD AND TOBAGO' }, { key: 'd1', rel: 'CHILD', name: 'Jordan Sample', gender: 'M', dob: '2012-07-11', country: 'TRINIDAD AND TOBAGO' }],
    bens: [{ rel: 'Spouse', name: 'Renee Sample', gender: 'F', dob: '1986-03-04', pct: 100 }] };
  const allNo = () => { const o = {}; 'a b c d e f g h i j k l ba bb bc'.split(' ').forEach(k => { o[k] = 'N'; }); return o; };
  const health = { persons: [{ key: 'emp', label: 'Marcus Sample' }, { key: 'd0', label: 'Renee Sample (Spouse)', fem: true }, { key: 'd1', label: 'Jordan Sample (Child)' }],
    answers: { emp: allNo(), d0: allNo(), d1: allNo() }, hw: { emp: { h: '5ft 10in', w: '180 lb' } }, preg: {}, medUse: 'N', detailNote: '', medNote: '', physNote: '', allWell: true };
  r = sb.gblEnrolSubmit_({ inv: row.Code, answers, health, sig: '' });
  ok('the signature is required', !r.ok && /sign/.test(r.error));
  r = sb.gblEnrolSubmit_({ inv: row.Code, answers, health: { answers: {} }, sig: PNG });
  ok('the health declaration is required', !r.ok && /health declaration/.test(r.error));
  r = sb.gblEnrolSubmit_({ inv: row.Code, answers: Object.assign({}, answers, { dob: '' }), health, sig: PNG });
  ok('the date of birth is required', !r.ok && /date of birth/.test(r.error));
  const before = MAILS.length;
  r = sb.gblEnrolSubmit_({ inv: row.Code, answers: JSON.stringify(answers), health: JSON.stringify(health), sig: PNG, sigSpouse: PNG });
  ok('their part is in', r.ok && r.said === 'Your part is done. Pat at Harbour Point Logistics Ltd will check it and send it to Guardian Life.', JSON.stringify(r));
  row = rows()[0];
  ok('ready, completed, the answers, health and signature kept', row.Status === 'ready' && row.Completed === '2026-11-17 10:00' && /Operations Manager/.test(row.Answers) && /"emp"/.test(row.Health) && row.Signature === PNG);
  ok('the health answers are not in the general answers', !/allWell|"answers"/.test(row.Answers));
  m = MAILS[before];
  ok('the group is told it is ready (test: to the account owner, banner naming the group)', MAILS.length === before + 1 && m.to === 'owner@branch.example' && /\[TEST\] Ready for you to check: Marcus Sample/.test(m.subject) && /would go to hr@harbourpoint\.example/.test(m.html), m && m.subject);
  ok('its button opens the forms on their page', /client\.html\?tab=billing&amp;form=enrol|client\.html\?tab=billing&form=enrol/.test(m.html));
  r = sb.gblEnrolSubmit_({ inv: row.Code, answers, health, sig: PNG, sigSpouse: PNG });
  ok('sending again while not approved replaces it, and tells nobody twice', r.ok && r.again && MAILS.length === before + 1);
  list = sb.gblClientForm_(Object.assign({}, auth, { form: 'invite' }));
  ok('the group sees it ready for them', list.invites[0].status === 'ready' && list.invites[0].words === 'Ready for you to check' && list.counts.ready === 1);
  ok('still no health or signature on the group’s list', !/allWell|data:image|"emp"/.test(JSON.stringify(list)));

  console.log('\nThe group checks Guardian’s GIO001 and completes Section F:\n');
  let pv = sb.gblClientForm_(Object.assign({}, auth, { form: 'invite', act: 'preview', ref: row.Ref, name: 'Pat Admin' }));
  ok('a preview without Section F says what is still needed', pv.ok && pv.pdf && pv.blocking.some(x => /coverage tier/.test(x)) && pv.blocking.some(x => /date employed/.test(x)) && pv.blocking.some(x => /annual salary/.test(x)), JSON.stringify(pv.blocking) + ' ' + pv.pdfError);
  ok('the preview carries no health answers', !/allWell|"emp"/.test(JSON.stringify(Object.assign({}, pv, { pdf: '' }))));
  pv = sb.gblClientForm_(Object.assign({}, auth, { form: 'invite', act: 'preview', ref: row.Ref, name: 'Pat Admin', tier: 'EMPLOYEE + FAMILY', employed: '2017-01-03', confirmed: '2017-04-03', salary: '240000', admin: 'Pat Admin' }));
  ok('with Section F nothing blocks', pv.ok && pv.blocking.length === 0, JSON.stringify(pv.blocking));
  ok('the group’s policy numbers read off its members', pv.policies.health === 'HP' && pv.policies.life === 'LP', JSON.stringify(pv.policies));
  const doc = await PDFLib.PDFDocument.load(Buffer.from(pv.pdf, 'base64'));
  const f = doc.getForm(), val = n => { try { return f.getTextField(n).getText() || ''; } catch (e) { return 'ERR ' + e.message; } };
  ok('GIO001: the employee and the group', val('NAME OF EMPLOYEEINSURED') === 'MARCUS SAMPLE' && val('NAME OF POLICYHOLDER') === 'Harbour Point Logistics Ltd', val('NAME OF EMPLOYEEINSURED'));
  ok('GIO001: date of birth, occupation, e-mail', val('DATE OF BIRTHddmmyyyy') === '22/08/1984' && val('OCCUPATION') === 'OPERATIONS MANAGER' && val('EMAIL ADDRESS') === 'marcus@home.example');
  ok('GIO001: the spouse first in Section C, the child after', val('NAME OF DEPENDENTS') === 'RENEE SAMPLE' && val('NAME OF DEPENDENTS-0') === 'JORDAN SAMPLE' && val('EFFECTIVE DATE ddmmyyyy') === '01/12/2026');
  ok('GIO001: the beneficiary in Section D', val('NAME OF BENEFICIARY') === 'RENEE SAMPLE' && val('PERCENTAGE') === '100%');
  ok('GIO001: Section F from the group', val('DATE EMPLOYED ddmmyyyy') === '03/01/2017' && val('EFFECTIVE DATE OF COVERAGE ddmmyyyy') === '01/12/2026' && val('BD') === 'TT$ 240000' && val('NAME') === 'Pat Admin');
  ok('GIO001: the employee signed online, dated', val('DATE ddmmyyyy') === '17/11/2026', val('DATE ddmmyyyy'));
  const xo = doc.getPages()[0].node.Resources().lookup(PDFLib.PDFName.of('XObject'));
  ok('GIO001: the signature is drawn on the page (an image on it)', !!xo && xo.keys().length >= 1);

  console.log('\nThe group approves; it goes to EB Customer Care (test mode):\n');
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'approve', ref: row.Ref, name: 'Pat Admin', authorised: 'Y', employed: '2017-01-03' }));
  ok('approval without the tier is refused, and nothing is sent', !r.ok && /coverage tier/.test(r.error) && CHANGES.length === 0, r.error);
  ok('the invite stays ready after a refusal', rows()[0].Status === 'ready');
  const m0 = MAILS.length;
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'approve', ref: row.Ref, name: 'Pat Admin', authorised: 'Y', tier: 'EMPLOYEE + FAMILY', employed: '2017-01-03', confirmed: '2017-04-03', salary: '240000' }));
  ok('approved', r.ok && r.test, JSON.stringify(r));
  m = MAILS[m0];
  ok('test: the pack went to the account owner, not to Guardian', m && m.to === 'owner@branch.example' && /^\[TEST\] GIO001 Group Health and Life Application Form – Harbour Point Logistics Ltd – Marcus Sample – Enrolment: Group Health and Group Life$/.test(m.subject), m && m.subject);
  ok('GIO001 and the Declaration of Insurability are both attached', m.att.length === 2 && /^GIO001 Application - MARCUS SAMPLE/.test(m.att[0].getName()) && /^Declaration of Insurability - Marcus Sample/.test(m.att[1].getName()), m.att.map(a => a.getName()).join(' | '));
  ok('the cover note says it was completed online and approved by the group', /completed Sections A to D and the Declaration of Insurability online on 17\/11\/2026 and signed on screen/.test(m.html) && /Pat Admin, completed Section F/.test(m.html));
  ok('what follows no longer asks for the Declaration or the employee’s signature', /To follow from the employee and the group: a copy of the identification/.test(m.html) && !/Declaration of Insurability, completed and signed by the employee/.test(m.html));
  const doiHtml = m.att[1]._fromHtml || '';
  ok('the Declaration: the insured, the spouse and the child, every answer No', /INSURED: <b>Marcus Sample/.test(doiHtml) && /Renee/.test(doiHtml) && /Jordan/.test(doiHtml) && (doiHtml.match(/&#10003;/g) || []).length === 15 * 4 - 15 && /&#9746; NO/.test(doiHtml), (doiHtml.match(/&#10003;/g) || []).length);
  ok('the Declaration carries both signatures', (doiHtml.match(/data:image\/png;base64/g) || []).length === 2);
  ok('a joiner on Group Changes, with the owner’s task', CHANGES.length === 1 && CHANGES[0].b.kind === 'joiner' && CHANGES[0].b.member === 'Marcus Sample' && CHANGES[0].line === 'health');
  row = rows()[0];
  ok('the invite reads sent, approved by the group, Section F kept', row.Status === 'sent' && row['Approved by'] === 'Pat Admin' && /EMPLOYEE \+ FAMILY/.test(row['Section F']) && row['Sent ref'] === '00T00000000001' && row.Test === 'Y');
  ok('the account owner is told', TOLD.some(t => t.kind === 'joiner' && /completed online/.test(t.b.detail)));
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'approve', ref: row.Ref, name: 'Pat Admin', authorised: 'Y', tier: 'SINGLE', employed: '2017-01-03', salary: '1' }));
  ok('approving twice is refused', !r.ok && /already gone/.test(r.error) && CHANGES.length === 1);
  ok('the employee’s link now says it is done', !sb.gblEnrolGet_({ inv: row.Code }).ok && sb.gblEnrolGet_({ inv: row.Code }).done === true);
  ok('and refuses another submission', !sb.gblEnrolSubmit_({ inv: row.Code, answers, health, sig: PNG }).ok);
  list = sb.gblClientForm_(Object.assign({}, auth, { form: 'invite' }));
  ok('the group sees it sent (test copy)', /Sent to Guardian Life 17\/11\/2026 \(test copy\)/.test(list.invites[0].words));

  console.log('\nReminders, one a working day, five at most:\n');
  TODAY = '2026-11-17';
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'create', first: 'Dana', last: 'Sample', email: 'dana@home.example', covHealth: 'Y', effective: '2026-12-01', name: 'Pat Admin', authorised: 'Y' }));
  const dref = r.ref, find = () => rows().find(x => x.Ref === dref);
  let rem = sb.gblInvRemind_({});
  ok('not on the day the link went', rem.reminded.length === 0);
  TODAY = '2026-11-18';
  let mm = MAILS.length;
  rem = sb.gblInvRemind_({ test: true });
  ok('a preview sends nothing', rem.reminded.length === 1 && MAILS.length === mm && String(find().Reminders) === '0');
  rem = sb.gblInvRemind_({});
  ok('the next working day: reminder 1', rem.reminded.includes(dref) && String(find().Reminders) === '1' && find()['Last reminder'] === '2026-11-18');
  m = MAILS[MAILS.length - 1];
  ok('test: the reminder went to the account owner, not the employee', m.to === 'owner@branch.example' && /^\[TEST\] Reminder 1: your Group Health enrolment/.test(m.subject) && !MAILS.some(x => x.to === 'dana@home.example'));
  rem = sb.gblInvRemind_({});
  ok('never twice in a day', rem.reminded.length === 0 && String(find().Reminders) === '1');
  TODAY = '2026-11-21';   // a Saturday
  ok('no reminders at the weekend', sb.gblInvRemind_({}).said === 'not a working day.');
  ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'].forEach(d => { TODAY = d; sb.gblInvRemind_({}); });
  ok('five reminders in all', String(find().Reminders) === '5');
  TODAY = '2026-11-27'; mm = MAILS.length;
  rem = sb.gblInvRemind_({});
  ok('after the fifth, no sixth: the group is told it is still waiting', rem.reminded.length === 0 && rem.told.includes(dref) && MAILS.length === mm + 1 && /Still waiting: Dana Sample/.test(MAILS[mm].subject) && String(find().Reminders) === '5');
  TODAY = '2026-11-30'; mm = MAILS.length;
  rem = sb.gblInvRemind_({});
  ok('and told only once', rem.told.length === 0 && MAILS.length === mm);
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'resend', ref: dref, name: 'Pat Admin', authorised: 'Y' }));
  ok('the group can send the link again', r.ok && /went to your account manager again/.test(r.said) && /link sent again 2026-11-30 by Pat Admin/.test(find().Note));

  console.log('\nAn expired link:\n');
  TODAY = '2027-02-15';
  ok('a link past its 60 days is refused', /expired/.test(sb.gblEnrolGet_({ inv: find().Code }).error || ''));
  rem = sb.gblInvRemind_({});
  ok('the reminder run marks it expired', rem.expired.includes(dref) && find().Status === 'expired');
  ok('the group sees it expired', sb.gblClientForm_(Object.assign({}, auth, { form: 'invite' })).invites.find(x => x.ref === dref).words === 'Link expired');
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'resend', ref: dref, name: 'Pat Admin', authorised: 'Y' }));
  ok('sending it again gives it another 60 days', r.ok && find().Status === 'waiting' && find().Expires === '2027-04-16' && sb.gblEnrolGet_({ inv: find().Code }).ok);

  console.log('\nLive (after gblGoLive):\n');
  LIVE = true; TODAY = '2026-12-01'; mm = MAILS.length;
  r = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'create', first: 'Chris', last: 'Sample', email: 'chris@home.example', covLife: 'Y', effective: '2027-01-01', name: 'Pat Admin', authorised: 'Y' }));
  m = MAILS[mm];
  ok('live: the link goes to the employee, sales support copied, no TEST', r.ok && !r.test && m.to === 'chris@home.example' && m.cc.includes('sales@branch.example') && !/TEST/.test(m.subject + m.html));
  ok('live: the group is told the link went', /has their own link by e-mail/.test(r.said));
  const ccode = rows().find(x => x.Ref === r.ref).Code; mm = MAILS.length;
  r = sb.gblEnrolSubmit_({ inv: ccode, answers: Object.assign({}, answers, { employee: 'Chris Sample', deps: [], bens: [] }), health: { persons: [{ key: 'emp' }], answers: { emp: allNo() }, medUse: 'N' }, sig: PNG });
  m = MAILS[mm];
  ok('live: the group’s contact is told, the account owner copied', r.ok && m.to === 'hr@harbourpoint.example' && m.cc.includes('owner@branch.example') && !/TEST/.test(m.subject));

  console.log('\nThe staff page: a link to copy into respond.io (23 November 2026):\n');
  const staff = { name: 'Kerry Sample', role: 'staff' }; G.contact = 'Pat Admin';
  LIVE = false; mm = MAILS.length;
  r = sb.gblFormAct_(G, staff, { act: 'inviteMake', first: 'MARCUS', last: 'SAMPLE', mobile: '868-555-0101', covHealth: 'Y', effective: '2027-01-01', send: 'N' });
  ok('made with a mobile and no e-mail, and nothing is e-mailed', r.ok && MAILS.length === mm, JSON.stringify(r));
  ok('the answer carries the employee’s own link, to copy', r.ok && r.invite.link === 'https://rickyrampersadbranch.com/benefits/enroll.html?inv=' + rows().find(x => x.Ref === r.ref).Code);
  const sr = rows().find(x => x.Ref === r.ref), mref = r.ref;
  ok('the employee reads the group’s contact as who asked, never the staff member', sr['Sent by'] === 'Pat Admin' && /made at the branch by Kerry Sample/.test(sr['Sent by role']) && sb.gblEnrolGet_({ inv: sr.Code }).invite.admin === 'Pat Admin');
  ok('the row says the link went on WhatsApp, and it is marked test', /WhatsApp/.test(sr.Note) && sr.Test === 'Y' && /Test mode/.test(r.said));
  r = sb.gblFormAct_(G, staff, { act: 'inviteMake', first: 'Marcus', last: 'Sample', mobile: '868-555-0101', covHealth: 'Y', effective: '2027-01-01', send: 'N' });
  ok('the same person twice is refused, pointing to the link they have', !r.ok && /already has a link/.test(r.error));
  r = sb.gblFormAct_(G, staff, { act: 'inviteMake', first: 'Ann', last: 'Sample', covHealth: 'Y', effective: '2027-01-01', send: 'N' });
  ok('neither an e-mail nor a mobile: refused', !r.ok && /e-mail address or mobile/.test(r.error));
  r = sb.gblFormAct_(G, staff, { act: 'inviteMake', first: 'Ann', last: 'Sample', mobile: '1', covHealth: 'Y', effective: '2027-01-01', send: 'Y' });
  ok('asked to e-mail it with no address: refused', !r.ok && /e-mail address/.test(r.error));
  r = sb.gblFormAct_(OTHER, staff, { act: 'inviteMake', first: 'Ann', last: 'Sample', mobile: '1', covHealth: 'Y', effective: '2027-01-01', send: 'N' });
  ok('a group with no contact on record asks whose name the employee sees', !r.ok && /Whose name/.test(r.error));
  mm = MAILS.length;
  r = sb.gblFormAct_(G, staff, { act: 'inviteMake', first: 'Dee', last: 'Sample', email: 'dee@home.example', covLife: 'Y', effective: '2027-01-01', send: 'Y' });
  ok('ticked to e-mail too: the test copy goes to the account manager, and the link can still be copied', r.ok && MAILS.length === mm + 1 && MAILS[mm].to === 'owner@branch.example' && !!r.invite.link);
  const slist = sb.gblFormAct_(G, staff, { act: 'invites' });
  ok('the list carries a link only while it can still be used', slist.ok && slist.invites.every(v => (v.status === 'waiting' || v.status === 'ready') ? /\?inv=[a-f0-9]{32}$/.test(v.link) : v.link === '') && slist.contact === 'Pat Admin');
  const gl = sb.gblClientForm_(Object.assign({}, auth, { form: 'invite' }));
  ok('the group’s own page is never sent an employee’s link', gl.ok && gl.invites.every(v => !('link' in v)) && !/\?inv=/.test(JSON.stringify(gl)));
  const gr = sb.gblClientFormSend_(Object.assign({}, auth, { form: 'invite', act: 'resend', ref: rows().find(x => x.Employee === 'Dee Sample').Ref, name: 'Pat Admin', authorised: 'Y' }));
  ok('nor in the answer to the group’s “send it again”', gr.ok && !/\?inv=/.test(JSON.stringify(gr)));
  mm = MAILS.length;
  r = sb.gblFormAct_(G, staff, { act: 'inviteAgain', ref: mref, send: 'N' });
  ok('renewed for WhatsApp: another 60 days, nothing e-mailed, the link back', r.ok && MAILS.length === mm && !!r.invite.link && /WhatsApp/.test(rows().find(x => x.Ref === mref).Note));
  r = sb.gblFormAct_(G, staff, { act: 'inviteAgain', ref: mref });
  ok('e-mailing it again with no address says to use WhatsApp', !r.ok && /WhatsApp/.test(r.error));
  TODAY = '2026-12-02'; mm = MAILS.length;
  const srem = sb.gblInvRemind_({});
  ok('the daily reminders pass over a link with no e-mail address', !srem.reminded.includes(mref) && !srem.errors.some(e => e.indexOf(mref) === 0));
  LIVE = true;

  console.log('\nToo many wrong codes:\n');
  CACHE['gbl-inv-tries'] = '40';
  ok('after forty wrong tries even a right code waits', /Too many tries/.test(sb.gblEnrolGet_({ inv: ccode }).error || ''));
  delete CACHE['gbl-inv-tries'];

  console.log('\nA cell that would be a formula is kept as text:\n');
  ok('gblInvCell_ prefixes =, +, -, @ and dates', sb.gblInvCell_('=HYPERLINK("x")') === "'=HYPERLINK(\"x\")" && sb.gblInvCell_('2026-12-01') === "'2026-12-01" && sb.gblInvCell_('Plain') === 'Plain' && sb.gblInvCell_(3) === 3);

  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
