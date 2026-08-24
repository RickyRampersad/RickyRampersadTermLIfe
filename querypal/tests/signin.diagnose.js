/* Sign-in diagnosis — runs the PRODUCTION findAgent_/agentAuth_ against a
   simulated Agent Codes tab, to answer two live questions:
     · can a newly added staff member (EL005 / password 5) sign in?
     · why would an agent already in AGENT_ACCESS (Kamla, KD122) get an error?
   The Apps Script side is stubbed; the auth functions are the real ones,
   pasted from the deployed v10.2 script. */
const assert = require('assert');

/* ---------- Apps Script stubs ---------- */
const SHEET_NAME = 'Queries';
let TABS = {};                                   // { tabName: [[row],[row]] }
const SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheets: () => Object.keys(TABS).map(name => {
      const data = TABS[name];
      return {
        getName: () => name,
        getLastRow: () => data.length,
        getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
        getRange: (r0, c0, nr, nc) => ({
          getValues: () => data.slice(r0 - 1, r0 - 1 + nr)
            .map(row => { const out = row.slice(c0 - 1, c0 - 1 + nc);
              while (out.length < nc) out.push(''); return out; }),
        }),
      };
    }),
  }),
};
const json = o => o;                             // the real one wraps in ContentService

/* ---------- production code, verbatim ---------- */
const BRANCH_MANAGER_EMAIL = 'ricky.rampersad@myguardiangroup.com';
var ROLE_RX = /^(agent|adviser|advisor|manager|abm|mgr|unit manager|assistant branch manager|assistant manager|branch|branch manager|bm|admin|all|staff)$/i;

const AGENT_ACCESS = {
  '260026':  ['Ricky Rampersad', 'ricky.rampersad@myguardiangroup.com', 'branch'],
  'RRB2026': ['Rampersad Branch', '', 'branch'],
  'AE101': ["Aidan Eugene", "aidan.eugene@myguardiangroup.com"],
  'KD122': ["Kamla Dookran", "kamla.dookran@myguardiangroup.com"],
  'PD129': ["Premchand Dookran", "premchand.dookran@myguardiangroup.com"],
  'GS115': ["Gary Sookdeo", "gary.sookdeo@myguardiangroup.com"],
};
const AGENT_MANAGER = {                          // Kamla is deliberately absent, as in production
  "premchand dookran": "ricky.rampersad@myguardiangroup.com",
  "aidan eugene": "gary.sookdeo@myguardiangroup.com",
};

function roleWord_(v) {
  if (!ROLE_RX.test(v)) return null;
  if (/^staff$/i.test(v)) return 'staff';
  if (/^(branch|branch manager|bm|admin|all)$/i.test(v)) return 'branch';
  if (/^(manager|abm|mgr|unit manager|assistant branch manager|assistant manager)$/i.test(v)) return 'manager';
  return 'agent';
}
function normName_(s) {
  return String(s || '').toLowerCase().replace(/[-.]/g, ' ').replace(/\s+/g, ' ').trim();
}
function codeRows_() {
  var out = [];
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (sh.getName() === SHEET_NAME) continue;
    var rows = sh.getLastRow(), cols = sh.getLastColumn();
    if (rows < 1 || cols < 1) continue;
    var data = sh.getRange(1, 1, rows, Math.min(cols, 10)).getValues();
    var hd = [];
    for (var h0 = 0; h0 < data[0].length; h0++) hd.push(String(data[0][h0]).trim().toLowerCase());
    if (hd.indexOf('password') > -1 || hd.indexOf('pass') > -1 || hd.indexOf('pin') > -1 ||
        hd.indexOf('agent number') > -1 || hd.indexOf('agent no') > -1 || hd.indexOf('number') > -1) continue;
    for (var r = 0; r < data.length; r++) {
      var cells = [];
      for (var c = 0; c < data[r].length; c++) {
        var v = String(data[r][c]).trim();
        if (v) cells.push(v);
      }
      if (cells.length) out.push(cells);
    }
  }
  return out;
}
function codeTable_() {
  var out = [];
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (sh.getName() === SHEET_NAME) continue;
    var rows = sh.getLastRow(), cols = sh.getLastColumn();
    if (rows < 2 || cols < 2) continue;
    var data = sh.getRange(1, 1, rows, Math.min(cols, 12)).getValues();
    var head = [];
    for (var h = 0; h < data[0].length; h++) head.push(String(data[0][h]).trim().toLowerCase());
    var col = function () {
      for (var a = 0; a < arguments.length; a++) { var i = head.indexOf(arguments[a]); if (i > -1) return i; }
      return -1;
    };
    var cPwd = col('password', 'pass', 'pin'), cNum = col('agent number', 'agent no', 'agent #', 'number');
    if (cPwd < 0 && cNum < 0) continue;
    var cName = col('name', 'agent name', 'agent'), cMail = col('email', 'e-mail', 'agent email');
    var cRole = col('role'), cUnit = col('unit', 'team', 'manager'), cAct = col('active', 'status');
    for (var r = 1; r < data.length; r++) {
      var g = function (i) { return i > -1 ? String(data[r][i]).trim() : ''; };
      var name = g(cName).replace(/^[A-Za-z]?\d+\s*[-–—]\s*/, '');
      var e = { num: g(cNum).toUpperCase(), pwd: g(cPwd), name: name, email: g(cMail),
                role: '', unit: g(cUnit), active: true };
      var act = g(cAct);
      if (cAct > -1 && act && !/^activ/i.test(act)) e.active = false;
      e.role = roleWord_(g(cRole)) || roleFromHierarchy_(e.name, e.email);
      if (e.num || e.pwd) out.push(e);
    }
  }
  return out;
}
function parseRow_(cells, code) {
  var p = { code: code || '', name: '', email: '', role: '', mgr: '', cells: cells };
  for (var i = 0; i < cells.length; i++) {
    var v = String(cells[i]).trim();
    if (!p.email && v.indexOf('@') > -1) { p.email = v; continue; }
    var rw = roleWord_(v);
    if (rw && !p.role) { p.role = rw; continue; }
    if (!p.name && v.toUpperCase() !== String(code).toUpperCase() && !/^\d+$/.test(v)) p.name = v;
  }
  if (!p.role) p.role = roleFromHierarchy_(p.name, p.email);
  return p;
}
function roleFromHierarchy_(name, email) {
  var em = String(email || '').toLowerCase();
  if (em && em === BRANCH_MANAGER_EMAIL.toLowerCase()) return 'branch';
  if (normName_(name) === 'ricky rampersad') return 'branch';
  var vals = Object.values(AGENT_MANAGER);
  for (var i = 0; i < vals.length; i++) {
    var mv = String(vals[i]).toLowerCase();
    if (em && em === mv) return 'manager';
    if (!em && mv.split('@')[0].replace(/\./g, ' ') === normName_(name)) return 'manager';
  }
  return 'agent';
}
function findAgentOrig_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  for (var k in AGENT_ACCESS) {
    if (k.toUpperCase() === code) {
      var e0 = AGENT_ACCESS[k] || [];
      var nm = e0[0] || '', em = e0[1] || '';
      var rl = e0[2] ? (roleWord_(String(e0[2])) || 'agent') : roleFromHierarchy_(nm, em);
      return { code: code, name: nm, email: em, role: rl, mgr: '',
               cells: [nm, em].filter(function (x) { return x; }) };
    }
  }
  var tab = codeTable_();
  for (var t = 0; t < tab.length; t++) {
    var e1 = tab[t];
    if (!e1.active) continue;
    if ((e1.num && e1.num === code) || (e1.pwd && String(e1.pwd).toUpperCase() === code)) {
      return { code: code, name: e1.name, email: e1.email, role: e1.role, mgr: e1.unit,
               src: 'tab', pwd: String(e1.pwd || ''),
               cells: [e1.name, e1.email].filter(function (x) { return x; }) };
    }
  }
  if (code.length < 3) return null;
  var rows = codeRows_();
  for (var i = 0; i < rows.length; i++) {
    for (var c = 0; c < rows[i].length; c++) {
      if (rows[i][c].toUpperCase() === code) return parseRow_(rows[i], code);
    }
  }
  return null;
}
const findAgent_ = findAgentOrig_;
function agentAuth_(code, pwd) {
  var me = findAgent_(code);
  if (!me && pwd) me = findAgent_(pwd);
  if (!me) return json({ ok: false });
  if (me.src === 'tab') {
    var want = String(me.pwd || '').trim().toUpperCase();
    var got = String(pwd || '').trim().toUpperCase();
    if (want && got !== want) return json({ ok: false, why: 'pwd' });
  }
  return json({ ok: true, code: me.code, name: me.name, email: me.email, role: me.role });
}


/* ---------- WITH PATCH EDIT 15: the Agent Codes tab becomes the master ---------- */
function qpSheetAgent_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  var tab;
  try { tab = codeTable_(); } catch (e) { return null; }
  for (var t = 0; t < tab.length; t++) {
    var e1 = tab[t];
    var hit = (e1.num && e1.num === code) ||
              (e1.pwd && String(e1.pwd).trim().toUpperCase() === code);
    if (!hit) continue;
    if (!e1.active) return { revoked: true };
    return { code: code, name: e1.name, email: e1.email, role: e1.role, mgr: e1.unit,
             src: 'tab', pwd: String(e1.pwd || ''),
             cells: [e1.name, e1.email].filter(function (x) { return x; }) };
  }
  return null;
}
function findAgentPatched_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  var fromSheet = qpSheetAgent_(code);
  if (fromSheet) return fromSheet.revoked ? null : fromSheet;
  return findAgentOrig_(code);
}
function agentAuthPatched_(code, pwd) {
  var me = findAgentPatched_(code);
  if (!me && pwd) me = findAgentPatched_(pwd);
  if (!me) return json({ ok: false });
  if (me.src === 'tab') {
    var want = String(me.pwd || '').trim().toUpperCase();
    var got = String(pwd || '').trim().toUpperCase();
    if (want && got !== want) return json({ ok: false, why: 'pwd' });
  }
  return json({ ok: true, code: me.code, name: me.name, email: me.email, role: me.role });
}


/* ---------- WITH PATCH EDIT 16: the loose scan is fenced ---------- */
var QP_LOOSE_TABS = /agent|staff|code|roster|team/i;
function qpLooseAgent_(code) {
  code = String(code || '').trim().toUpperCase();
  if (code.length < 4) return null;
  if (code.indexOf('@') > -1) return null;
  if (/\s/.test(code)) return null;
  if (!/\d/.test(code)) return null;
  if (/^\d{1,3}$/.test(code)) return null;
  var sheets;
  try { sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets(); } catch (e) { return null; }
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], nm = sh.getName();
    if (nm === SHEET_NAME) continue;
    if (!QP_LOOSE_TABS.test(nm)) continue;
    var rows = sh.getLastRow(), cols = sh.getLastColumn();
    if (rows < 1 || cols < 1) continue;
    var data = sh.getRange(1, 1, rows, Math.min(cols, 10)).getValues();
    for (var r = 0; r < data.length; r++) {
      var cells = [];
      for (var c = 0; c < data[r].length; c++) {
        if (data[r][c] instanceof Date) continue;
        var v = String(data[r][c]).trim();
        if (v) cells.push(v);
      }
      for (var k = 0; k < cells.length; k++) {
        if (cells[k].toUpperCase() !== code) continue;
        if (cells[k].indexOf('@') > -1) continue;
        return parseRow_(cells, code);
      }
    }
  }
  return null;
}
function findAgentSecure_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  var fromSheet = qpSheetAgent_(code);
  if (fromSheet) return fromSheet.revoked ? null : fromSheet;
  for (var k in AGENT_ACCESS) {
    if (k.toUpperCase() === code) {
      var e0 = AGENT_ACCESS[k] || [];
      var nm2 = e0[0] || '', em = e0[1] || '';
      var rl = e0[2] ? (roleWord_(String(e0[2])) || 'agent') : roleFromHierarchy_(nm2, em);
      return { code: code, name: nm2, email: em, role: rl, mgr: '',
               cells: [nm2, em].filter(function (x) { return x; }) };
    }
  }
  return qpLooseAgent_(code);
}
function authSecure_(code, pwd) {
  var me = findAgentSecure_(code);
  if (!me && pwd) me = findAgentSecure_(pwd);
  if (!me) return json({ ok: false });
  if (me.src === 'tab') {
    var want = String(me.pwd || '').trim().toUpperCase();
    var got = String(pwd || '').trim().toUpperCase();
    if (want && got !== want) return json({ ok: false, why: 'pwd' });
  }
  return json({ ok: true, code: me.code, name: me.name, email: me.email, role: me.role });
}

/* ---------- the diagnosis ---------- */
let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label +
    (ok ? '' : `\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};
const head = s => console.log('\n' + s);

/* ===== A. Elizabeth Lee, added to a PROPERLY HEADED Agent Codes tab ===== */
head('A · Elizabeth Lee in a tab headed  Name | Agent Number | Password | Role');
TABS = { 'Agent Codes': [
  ['Name', 'Agent Number', 'Password', 'Role'],
  ['Elizabeth Lee', 'EL005', '5', 'Staff'],
]};
t('EL005 + 5 signs in', agentAuth_('EL005', '5').ok, true);
t('role comes back as staff', agentAuth_('EL005', '5').role, 'staff');
t('wrong password is refused', agentAuth_('EL005', 'x'), { ok: false, why: 'pwd' });
t('EL005 with NO password is refused', agentAuth_('EL005', ''), { ok: false, why: 'pwd' });
t('password in the number box alone is NOT enough', agentAuth_('5', ''), { ok: false, why: 'pwd' });

/* ===== B. the header names the sheet must use ===== */
head('B · what happens when the columns are headed differently');
TABS = { 'Agent Codes': [
  ['Name', 'Code', 'PW', 'Role'],                      // NOT recognised headers
  ['Elizabeth Lee', 'EL005', '5', 'Staff'],
]};
const b = agentAuth_('EL005', 'anything-at-all');
t('unrecognised headers: she still gets in…', b.ok, true);
t('…but ANY password works — the tab is not read as credentials', b.ok, true);
t('and the role still reads from the row', b.role, 'staff');

/* ===== C. a row marked inactive ===== */
head('C · the Active column');
TABS = { 'Agent Codes': [
  ['Name', 'Agent Number', 'Password', 'Role', 'Active'],
  ['Elizabeth Lee', 'EL005', '5', 'Staff', 'Inactive'],
]};
t('Inactive row cannot sign in', agentAuth_('EL005', '5'), { ok: false });
TABS['Agent Codes'][1][4] = 'Active';
t('flipping it to Active fixes it', agentAuth_('EL005', '5').ok, true);

/* ===== D. Kamla — already in AGENT_ACCESS ===== */
head('D · Kamla Dookran (KD122) — in the script list');
TABS = {};
t('KD122 alone signs in, no password needed', agentAuth_('KD122', '').ok, true);
t('KD122 with any password still signs in', agentAuth_('KD122', 'whatever').ok, true);
t('she resolves to agent role', agentAuth_('KD122', '').role, 'agent');
t('her name is right', agentAuth_('KD122', '').name, 'Kamla Dookran');

head('D2 · what actually refuses Kamla');
t('lowercase kd122 is fine (case-insensitive)', agentAuth_('kd122', '').ok, true);
t('a trailing space is fine (trimmed)', agentAuth_(' KD122 ', '').ok, true);
t('her NAME as the code is refused', agentAuth_('Kamla Dookran', ''), { ok: false });
t('her EMAIL as the code is refused', agentAuth_('kamla.dookran@myguardiangroup.com', ''), { ok: false });
t('an old/other code is refused', agentAuth_('KD427', ''), { ok: false });
t('empty code + empty password is refused', agentAuth_('', ''), { ok: false });

head('D3 · the sheet CANNOT override the script list');
TABS = { 'Agent Codes': [
  ['Name', 'Agent Number', 'Password', 'Active'],
  ['Kamla Dookran', 'KD122', 'kamla2026', 'Inactive'],   // even inactive here…
]};
t('KD122 still signs in — AGENT_ACCESS wins', agentAuth_('KD122', '').ok, true);
t('…and her sheet password is NOT required', agentAuth_('KD122', '').ok, true);

/* ===== E. the collision a 1-character password creates ===== */
head('E · why password "5" is unsafe');
TABS = { 'Agent Codes': [
  ['Name', 'Agent Number', 'Password'],
  ['Elizabeth Lee', 'EL005', '5'],
  ['Someone Else', 'SE006', '5'],                        // same weak password
]};
t('"5" in the number box alone is refused', agentAuth_('5', ''), { ok: false, why: 'pwd' });
t('but "5" in BOTH boxes resolves to the first row with that password',
  agentAuth_('5', '5').name, 'Elizabeth Lee');
t('so SE006 typing 5 in the number box becomes Elizabeth', agentAuth_('5', '5').name, 'Elizabeth Lee');


/* ===== F. after patch edit 15 — the sheet governs everyone ===== */
head('F · patch edit 15: the Agent Codes tab becomes the master list');
TABS = { 'Agent Codes': [
  ['Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  ['Elizabeth Lee',  'EL005', 'Lee#2026', 'Staff',   'Ricky Rampersad', 'Active'],
  ['Kamla Dookran',  'KD122', 'Kam#2026', 'Agent',   'Gary Sookdeo',    'Active'],
  ['Aidan Eugene',   'AE101', 'Aid#2026', 'Manager', 'Ricky Rampersad', 'Left'],
]};
t('new staff sign in from the sheet', agentAuthPatched_('EL005', 'Lee#2026').ok, true);
t('a script-listed agent now needs the sheet password',
  agentAuthPatched_('KD122', ''), { ok: false, why: 'pwd' });
t('…and gets in with it', agentAuthPatched_('KD122', 'Kam#2026').ok, true);
t('the sheet can promote a role the script never set',
  agentAuthPatched_('KD122', 'Kam#2026').role, 'agent');
t('the sheet can REVOKE someone hard-coded in the script',
  agentAuthPatched_('AE101', 'Aid#2026'), { ok: false });
t('before the patch that revoke was ignored', agentAuth_('AE101', '').ok, true);
t('anyone not in the sheet still falls back to the script list',
  agentAuthPatched_('260026', '').ok, true);
t('and keeps their branch role', agentAuthPatched_('260026', '').role, 'branch');
t('unknown codes are still refused', agentAuthPatched_('ZZ999', ''), { ok: false });


/* ===== G. edit 16 — reproduce the LIVE hole, then close it ===== */
head('G · edit 16: a name must never be a password (live finding, 24 Aug 2026)');
TABS = {
  'Comments': [                                   // an ordinary working tab
    [new Date('2026-07-24T10:00:07'), 'RRB/2026/188', 'Kamla Dookran', 'staff', 'Chased the department', 'internal'],
  ],
  'Agent Codes': [
    ['Name', 'Agent Number', 'Password', 'Active'],
    ['Kamla Dookran', 'KD122', 'Kam#2026', 'Active'],
  ],
};
t('TODAY: a name alone signs in, no password', agentAuth_('Kamla Dookran', '').ok, true);
t('TODAY: it even hands back a timestamp as the person\'s name',
  /^\w{3} \w{3} \d{2} 2026/.test(agentAuth_('Kamla Dookran', '').name), true);
t('AFTER EDIT 16: the name is refused', authSecure_('Kamla Dookran', ''), { ok: false });
t('AFTER EDIT 16: an email is refused',
  authSecure_('kamla.dookran@myguardiangroup.com', ''), { ok: false });
t('AFTER EDIT 16: a bare digit is refused', authSecure_('5', ''), { ok: false });
t('AFTER EDIT 16: the real code still works', authSecure_('KD122', 'Kam#2026').ok, true);
t('AFTER EDIT 16: script-list people still sign in', authSecure_('260026', '').ok, true);

head('G2 · the Javid Ali collision, reproduced');
TABS = { 'Agent Codes': [
  ['Name', 'Agent Number', 'Password'],
  ['Javid Ali', 'JA135', '5'],                    // a one-character password already in use
]};
t('TODAY: EL005 + password 5 lands in someone else\'s account',
  agentAuth_('EL005', '5').name, 'Javid Ali');
t('AFTER EDIT 16: it still resolves — the password IS his',
  authSecure_('EL005', '5').name, 'Javid Ali');
t('the real fix is his password, not the code path — 4+ chars is refused as a code',
  authSecure_('EL005', ''), { ok: false });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
