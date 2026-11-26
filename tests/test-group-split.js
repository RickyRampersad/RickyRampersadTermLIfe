// The group side in a project of its own (26 November 2026): group client management, the group bills and the GI
// renewal desk leave the Service Questionnaire project, which loads 2.4 MB of code on every call. Checks, in order:
//   1. the two generated files are what tools/gas/split-group.js writes from today's sources;
//   2. every name each project reads is declared in that project (a real scope walk, so a local variable never hides a
//      missing function), and no name is declared twice in either;
//   3. both projects load in a sandbox and answer: the new one its ping and gcm.ping, the old one with the helpers the
//      orphan side still calls;
//   4. the move: groupMoveExport and groupMoveStopOld in the old project, groupMoveImport in the new one, carry every
//      setting and the branch code, stop only the group's timed jobs there and rebuild them here;
//   5. tools/move/repoint-group.py finds every group page and nothing else.
// Run: node tests/test-group-split.js
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const req = (m) => { try { return require(m); } catch (e) { return require('/opt/node-tools/node_modules/' + m); } };
const acorn = req('acorn'), walk = req('acorn-walk');
const ROOT = path.join(__dirname, '..'), AS = path.join(ROOT, 'apps-script');
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };

/* ── 1. generated files ─────────────────────────────────────────── */
let gen = { status: 1, stdout: '' };
try { gen = { status: 0, stdout: cp.execFileSync('node', [path.join(ROOT, 'tools/gas/split-group.js'), '--check'], { encoding: 'utf8' }) }; }
catch (e) { gen = { status: e.status, stdout: String(e.stdout || '') }; }
ok('GroupShared.gs and GroupKeep.gs are what the generator writes from today\'s sources', gen.status === 0, gen.stdout.trim());

/* ── the three file sets ───────────────────────────────────────── */
const has = (f) => fs.existsSync(path.join(AS, f));
const FULL = ['Service.gs', 'Transition.gs', 'ServiceSalesforce.gs', 'GroupClients.gs', 'GroupBilling.gs', 'GIRenewals.gs', 'GroupSchedules.gs',
  'StrategicMeeting.gs', 'Quotes.gs', 'Help868.gs', 'Letters.gs'].filter(has);
const GROUP = ['GroupClients.gs', 'GroupBilling.gs', 'GIRenewals.gs', 'GroupSchedules.gs'].filter(has);
const NEW = GROUP.concat(['group-project/GroupShared.gs', 'group-project/GroupApp.gs']);
const OLD = FULL.filter(f => !GROUP.includes(f)).concat(['GroupKeep.gs']);
const src = {}; const ast = {};
for (const f of new Set(FULL.concat(NEW, OLD, ['GroupMoveOut.gs']))) { src[f] = fs.readFileSync(path.join(AS, f), 'utf8'); ast[f] = acorn.parse(src[f], { ecmaVersion: 2022 }); }

function topNames(files) {
  const out = {}; for (const f of files) for (const n of ast[f].body) {
    const names = n.type === 'FunctionDeclaration' ? [n.id.name] : n.type === 'VariableDeclaration' ? n.declarations.map(d => d.id.name) : [];
    for (const nm of names) (out[nm] = out[nm] || []).push(f);
  }
  return out;
}
/* names a pattern binds */
function patNames(p, out) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach(q => patNames(q.type === 'RestElement' ? q.argument : q.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach(e => patNames(e, out));
  else if (p.type === 'AssignmentPattern') patNames(p.left, out);
  else if (p.type === 'RestElement') patNames(p.argument, out);
  return out;
}
/* every name declared in a function's own scope (params, var, let, const, function, class), not in nested functions */
function scopeNames(fn) {
  const out = new Set(); (fn.params || []).forEach(p => patNames(p, []).forEach(n => out.add(n)));
  if (fn.type === 'FunctionExpression' && fn.id) out.add(fn.id.name);
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node !== fn.body && /Function/.test(node.type)) { if (node.type === 'FunctionDeclaration') out.add(node.id.name); return; }
    if (node.type === 'VariableDeclarator') patNames(node.id, []).forEach(n => out.add(n));
    if (node.type === 'ClassDeclaration' && node.id) out.add(node.id.name);
    if (node.type === 'CatchClause' && node.param) patNames(node.param, []).forEach(n => out.add(n));
    for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v); }
  };
  visit(fn.body);
  return out;
}
/* every name read in a file that no enclosing function declares */
function freeRefs(file) {
  const out = new Map();   // name -> first line
  const lineOf = (pos) => src[file].slice(0, pos).split('\n').length;
  const scopes = [];
  const bound = (nm) => scopes.some(s => s.has(nm));
  const fnVisit = (node, st, c) => { scopes.push(scopeNames(node)); (node.params || []).forEach(p => walkPattern(p, c)); c(node.body, st); scopes.pop(); };
  const walkPattern = (p, c) => { if (p && p.type === 'AssignmentPattern') c(p.right); };
  walk.recursive(ast[file], null, {
    FunctionDeclaration: fnVisit, FunctionExpression: fnVisit, ArrowFunctionExpression: fnVisit,
    Identifier(x) { if (!bound(x.name) && !out.has(x.name)) out.set(x.name, lineOf(x.start)); },
    MemberExpression(x, st, c) { c(x.object, st); if (x.computed) c(x.property, st); },
    Property(x, st, c) { if (x.computed) c(x.key, st); c(x.value, st); },
    VariableDeclarator(x, st, c) { if (x.init) c(x.init, st); },
    CatchClause(x, st, c) { c(x.body, st); },
    LabeledStatement(x, st, c) { c(x.body, st); },
    BreakStatement() {}, ContinueStatement() {}
  }, walk.base);
  return out;
}

/* ── 2. every name resolves, none is declared twice ─────────────── */
const fullTop = topNames(FULL.concat(['group-project/GroupApp.gs']));
function audit(label, files, allowMissing) {
  const top = topNames(files);
  const dup = Object.keys(top).filter(n => top[n].length > 1);
  ok(label + ': no name is declared twice', dup.length === 0, dup.map(n => n + ' (' + top[n].join(', ') + ')').join('; '));
  const missing = [];
  for (const f of files) for (const [nm, line] of freeRefs(f)) {
    if (top[nm] || !fullTop[nm] || (allowMissing || []).includes(nm)) continue;
    missing.push(nm + ' (' + f + ':' + line + ', declared in ' + fullTop[nm].join(', ') + ')');
  }
  ok(label + ': every name it reads is declared in it', missing.length === 0, missing.slice(0, 12).join('; '));
}
audit('new group project', NEW);
const ROUTER = ['gcmDoGet_', 'gcmDoPost_'];
audit('Service Questionnaire project after the move', OLD, ROUTER);
ok('the old router reaches the group side only through typeof-guarded calls',
  ROUTER.every(n => (src['Service.gs'].match(new RegExp(n + '\\(', 'g')) || []).length === (src['Service.gs'].match(new RegExp("typeof " + n + " === 'function'", 'g')) || []).length));
ok('the move-out file needs only what the old project has', (() => {
  const top = topNames(OLD.concat(['GroupMoveOut.gs']));
  return [...freeRefs('GroupMoveOut.gs').keys()].every(n => top[n] || !fullTop[n]);
})());

/* ── a sandbox: Apps Script made of nothing ─────────────────────── */
function world(opts) {
  const props = Object.assign({}, opts.props || {});
  const triggers = (opts.triggers || []).map(fn => ({ fn }));
  const tabs = opts.tabs || {};
  const newTab = (name) => {
    const t = { name, rows: [], hidden: false, fmt: null,
      getName: () => name, getLastRow: () => t.rows.length, getLastColumn: () => (t.rows[0] || []).length,
      clear: () => { t.rows = []; }, hideSheet: () => { t.hidden = true; },
      getRange: (r, c, nr, nc) => ({
        setNumberFormat: (f) => { t.fmt = f; return this; },
        setValues: (vals) => { vals.forEach((row, i) => { t.rows[r - 1 + i] = row.slice(); }); },
        getValues: () => t.rows.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc))
      }) };
    return t;
  };
  const sheet = opts.sheet || { id: 'SQ-SHEET-ID-0123456789abcdefghij', tabs };
  const ss = {
    getId: () => sheet.id, getName: () => 'Service Questionnaires', getSpreadsheetTimeZone: () => 'America/Port_of_Spain',
    getSheetByName: (n) => sheet.tabs[n] || null, getSheets: () => Object.values(sheet.tabs),
    insertSheet: (n) => (sheet.tabs[n] = newTab(n)), deleteSheet: (t) => { delete sheet.tabs[t.name]; }
  };
  const builder = (fn) => { const b = { timeBased: () => b, everyHours: () => b, onWeekDay: () => b, atHour: () => b, nearMinute: () => b, everyDays: () => b, inTimezone: () => b, at: () => b,
    create: () => { triggers.push({ fn }); return {}; } }; return b; };
  const store = {
    getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => Object.assign({}, props),
    setProperties: (o) => { Object.assign(props, o); }, deleteProperty: (k) => { delete props[k]; }
  };
  const cacheStore = {};
  const sb = {
    console: { log: () => {}, error: () => {} }, Date, Math, JSON, String, Number, Object, Array, RegExp, Error, Boolean, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent, Set, Map, Promise, Uint8Array, Buffer,
    PropertiesService: { getScriptProperties: () => store, getUserProperties: () => store },
    CacheService: { getScriptCache: () => ({ get: k => cacheStore[k] || null, put: (k, v) => { cacheStore[k] = String(v); }, remove: k => { delete cacheStore[k]; }, getAll: () => ({}), putAll: () => {} }) },
    ScriptApp: { getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t.fn, __t: t })), deleteTrigger: (x) => { const i = triggers.indexOf(x.__t); if (i > -1) triggers.splice(i, 1); },
      newTrigger: (fn) => builder(fn), getScriptId: () => opts.scriptId || 'SCRIPT-OLD', WeekDay: { MONDAY: 'MONDAY' } },
    SpreadsheetApp: { getActiveSpreadsheet: () => (opts.bound ? ss : null), openById: (id) => { if (id === sheet.id) return ss; if (opts.openIds && opts.openIds.includes(id)) return { getId: () => id, getName: () => 'Group Client Management', getSheetByName: () => null }; throw new Error('not found'); },
      getUi: () => { throw new Error('no ui'); } },
    Session: { getEffectiveUser: () => ({ getEmail: () => opts.me || 'support@rickyrampersadbranch.com' }), getScriptTimeZone: () => opts.tz || 'America/Port_of_Spain' },
    Utilities: { formatDate: (d, tz, f) => { const x = new Date(d); return f === 'H' ? String(x.getUTCHours()) : f === 'u' ? String(((x.getUTCDay() + 6) % 7) + 1) : x.toISOString().slice(0, 10); },
      computeDigest: () => [1, 2, 3], DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, base64Encode: (b) => Buffer.from(b).toString('base64'), newBlob: () => ({}) },
    ContentService: { createTextOutput: (t) => ({ text: t, setMimeType: function () { return this; } }), MimeType: { JSON: 'json' } },
    DriveApp: { getFolderById: () => ({ getName: () => 'forms' }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 503, getContentText: () => '{}' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    MailApp: { sendEmail: () => {} }, GmailApp: {}, HtmlService: {}, Logger: { log: () => {} }
  };
  sb.globalThis = sb;
  vm.createContext(sb);
  for (const f of opts.files) vm.runInContext(src[f], sb, { filename: f });
  return { sb, props, triggers, sheet, ss };
}

/* ── 3. both projects load and answer ───────────────────────────── */
let w;
try { w = world({ files: NEW, scriptId: 'SCRIPT-NEW' }); ok('the new group project loads', true); }
catch (e) { ok('the new group project loads', false, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); }
if (w) {
  const ping = JSON.parse(w.sb.doGet({ parameter: { action: 'ping' } }).text);
  ok('its ping answers as the group project', ping.ok && ping.project === 'group' && ping.service === 'Group client management', JSON.stringify(ping).slice(0, 200));
  ok('its ping says SQ_SHEET_ID is not set yet', ping.sheets && ping.sheets.sq === 'not set');
  ok('its ping carries no setting\'s value', !/SQ-SHEET|secret/i.test(JSON.stringify(ping)));
  const gp = JSON.parse(w.sb.doGet({ parameter: { action: 'gcm.ping' } }).text);
  ok('gcm.ping is answered by the group project and says so', gp.ok === true && gp.project === 'group', JSON.stringify(gp).slice(0, 200));
  ok('an action that is not the group\'s is refused', JSON.parse(w.sb.doGet({ parameter: { action: 'board' } }).text).error === 'Unknown action');
  ok('a POST of another project\'s action is refused', JSON.parse(w.sb.doPost({ postData: { contents: JSON.stringify({ action: 'q.submit' }) } }).text).error === 'Unknown action');
  ok('the branch code is read from the TEAM_CODE Script property', (() => {
    const w2 = world({ files: NEW, props: { TEAM_CODE: 'BRANCH-CODE' } }); return w2.sb.SVC.TEAM_CODE === 'BRANCH-CODE';
  })());
  ok('ss_() opens the Service Questionnaire sheet by SQ_SHEET_ID', (() => {
    const w3 = world({ files: NEW, props: { SQ_SHEET_ID: 'SQ-SHEET-ID-0123456789abcdefghij' } }); return w3.sb.ss_().getId() === 'SQ-SHEET-ID-0123456789abcdefghij';
  })());
  ok('ss_() takes a whole sheet link pasted in', (() => {
    const w4 = world({ files: NEW, props: { SQ_SHEET_ID: 'https://docs.google.com/spreadsheets/d/SQ-SHEET-ID-0123456789abcdefghij/edit' } }); return w4.sb.ss_().getId() === 'SQ-SHEET-ID-0123456789abcdefghij';
  })());
}
let o;
try { o = world({ files: OLD, bound: true }); ok('the Service Questionnaire project loads without the group files', true); }
catch (e) { ok('the Service Questionnaire project loads without the group files', false, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); }
if (o) {
  ok('it still has the Claude caller and the key reader the orphan board, HELP 868 and the strategic meeting use',
    typeof o.sb.gcmClaude_ === 'function' && typeof o.sb.gcmAiKey_ === 'function' && o.sb.GCM && o.sb.GCM.AI_MODEL);
  ok('it still has the holiday list the hiring board counts working days by', typeof o.sb.gblHolidays_ === 'function' && !!o.sb.gblHolidays_(2026)['2026-12-25']);
  ok('it still has the PDF helpers the letters cutter uses', !!o.sb.GBL_PDF && typeof o.sb.gblU8_ === 'function' && typeof o.sb.gblSigned_ === 'function');
  ok('it no longer answers group actions', typeof o.sb.gcmDoGet_ === 'undefined' && typeof o.sb.gcmDoPost_ === 'undefined');
}

/* ── 4. the move ───────────────────────────────────────────────── */
const OLD_PROPS = { GCM_SHEET_ID: 'GCM-SHEET-ID-0123456789abcdefghij', MS_TENANT: 'tenant', MS_CLIENT: 'client', MS_SECRET: 's3cret', SF_KEY: 'k', SF_SECRET: 'x',
  SF_LOGIN_URL: 'https://example.my.salesforce.com', ANTHROPIC_API_KEY: 'sk-test', GCM_HOLD: '{"all":false}', GIR_LIVE: 'Y', GCM_DAY_LAST: '2026-11-26', MOVE_IMPORTED: 'x', transition_live: 'Y' };
const OLD_JOBS = ['gcmRefreshTick', 'gcmMondaySend', 'gcmDay1030', 'transitionSendTick', 'transitionReceipts', 'gcmRefreshTick'];
const shared = { id: 'SQ-SHEET-ID-0123456789abcdefghij', tabs: {} };
const mo = world({ files: OLD.concat(['GroupMoveOut.gs']), bound: true, props: OLD_PROPS, triggers: OLD_JOBS, sheet: shared });
mo.sb.SVC.TEAM_CODE = 'BRANCH-CODE';
const said1 = mo.sb.groupMoveStopOld();
ok('groupMoveStopOld refuses before the export has written the jobs down', /groupMoveExport first/.test(said1) && mo.triggers.length === OLD_JOBS.length);
const said2 = mo.sb.groupMoveExport();
const tab = shared.tabs._move_group;
ok('groupMoveExport writes a hidden _move_group tab, every value as text', !!tab && tab.hidden && tab.fmt === '@' && tab.rows.slice(1).every(r => /^v:/.test(r[2])));
ok('it carries the branch code and the sheet ID, and names the ID in its message', /SQ-SHEET-ID-0123456789abcdefghij/.test(said2) && tab.rows.some(r => r[0] === 'meta' && r[1] === 'teamCode' && r[2] === 'v:BRANCH-CODE'));
ok('it writes down the project\'s time zone and names it', tab.rows.some(r => r[0] === 'meta' && r[1] === 'timeZone' && r[2] === 'v:America/Port_of_Spain') && /America\/Port_of_Spain/.test(said2));
ok('it writes down the group\'s timed jobs once each, and none of the orphan side\'s', JSON.stringify(tab.rows.filter(r => r[0] === 'job').map(r => r[1]).sort()) === JSON.stringify(['gcmDay1030', 'gcmMondaySend', 'gcmRefreshTick']));
mo.sb.groupMoveStopOld();
ok('groupMoveStopOld deletes the group\'s timed jobs and leaves the orphan side\'s running', JSON.stringify(mo.triggers.map(t => t.fn).sort()) === JSON.stringify(['transitionReceipts', 'transitionSendTick']));

const mn = world({ files: NEW, scriptId: 'SCRIPT-NEW', sheet: shared, openIds: ['GCM-SHEET-ID-0123456789abcdefghij'] });
ok('groupMoveImport asks for SQ_SHEET_ID first', /Set SQ_SHEET_ID first/.test(mn.sb.groupMoveImport()) && !!shared.tabs._move_group);
const mz = world({ files: NEW, scriptId: 'SCRIPT-NEW', sheet: shared, tz: 'America/New_York', props: { SQ_SHEET_ID: shared.id }, openIds: ['GCM-SHEET-ID-0123456789abcdefghij'] });
const saidZ = mz.sb.groupMoveImport();
ok('groupMoveImport stops, changing nothing, when the new project is on another time zone', /Stopped before anything was changed/.test(saidZ) && /appsscript\.json/.test(saidZ) && !('MS_SECRET' in mz.props) && mz.triggers.length === 0 && !!shared.tabs._move_group, saidZ);
ok('the ping says which time zone the project runs on', JSON.parse(mz.sb.doGet({ parameter: { action: 'ping' } }).text).timeZone === 'America/New_York');
mn.props.SQ_SHEET_ID = 'SQ-SHEET-ID-0123456789abcdefghij';
const said3 = mn.sb.groupMoveImport();
ok('it carries every setting, the secrets included, but not the move\'s own marks', mn.props.MS_SECRET === 's3cret' && mn.props.ANTHROPIC_API_KEY === 'sk-test' && mn.props.GCM_HOLD === '{"all":false}' && !('MOVE_IMPORTED' in mn.props), said3);
ok('it sets TEAM_CODE from the old project\'s branch code, and keeps its own SQ_SHEET_ID', mn.props.TEAM_CODE === 'BRANCH-CODE' && mn.props.SQ_SHEET_ID === 'SQ-SHEET-ID-0123456789abcdefghij');
ok('it rebuilds the hourly refresh, the Monday letters and the 10:30 day, once each',
  JSON.stringify(mn.triggers.map(t => t.fn).sort()) === JSON.stringify(['gcmDay1030', 'gcmMondaySend', 'gcmRefreshTick']), mn.triggers.map(t => t.fn).join(','));
ok('it deletes the tab that held the secrets', !shared.tabs._move_group);
ok('it marks the move done and says what to deploy next', !!mn.props.GROUP_MOVED_IN && /New deployment/.test(said3));
ok('it reports both sheets open', /Every sheet and folder/.test(said3), said3);
const mo2 = world({ files: OLD.concat(['GroupMoveOut.gs']), bound: true, props: OLD_PROPS, triggers: [], sheet: shared, scriptId: 'SCRIPT-OLD' });
mo2.sb.groupMoveExport();
ok('groupMoveImport refuses to run in the old project itself', /This is the old project/.test(world({ files: NEW, scriptId: 'SCRIPT-OLD', sheet: shared, props: { SQ_SHEET_ID: shared.id } }).sb.groupMoveImport()));
mo2.sb.groupMoveCleanUp();
ok('groupMoveCleanUp deletes the tab if the move stops half way', !shared.tabs._move_group);

/* ── 5. the pages ──────────────────────────────────────────────── */
let rp = { status: 1, out: '' };
try { rp = { status: 0, out: cp.execFileSync('python3', [path.join(ROOT, 'tools/move/repoint-group.py'), 'https://script.google.com/macros/s/AKfycbNEWGROUPPROJECTADDRESS0123456789/exec', '--check'], { cwd: ROOT, encoding: 'utf8' }) }; }
catch (e) { rp = { status: e.status, out: String(e.stdout || '') }; }
ok('repoint-group.py finds every group page and no page outside its list', rp.status === 0 && (rp.out.match(/^\s+1\s{2}/gm) || []).length === 10, rp.out.trim().split('\n').slice(-3).join(' | '));

console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
