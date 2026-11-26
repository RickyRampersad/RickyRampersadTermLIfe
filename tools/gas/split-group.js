#!/usr/bin/env node
/**
 * Splits the group side out of the Service Questionnaire project (26 November 2026).
 *
 *   node tools/gas/split-group.js           writes the two generated files
 *   node tools/gas/split-group.js --check   exits 1 if either is out of date (the test runs this)
 *
 * The Service Questionnaire project loads about 2.4 MB of code on every call, so a bare ping takes 6 to 8 seconds,
 * and the group side waits behind the orphan campaign's batches for the script lock. The group side (GroupClients.gs,
 * GroupBilling.gs, GIRenewals.gs, and GroupSchedules.gs once it is merged) moves to a project of its own. The two
 * projects share a little code, and this tool copies it rather than anybody retyping it:
 *
 *   apps-script/group-project/GroupShared.gs  for the NEW project: every declaration the group files use from the
 *                                             rest of the Service Questionnaire project (the sign-in, the support@
 *                                             mailer, the Salesforce login), copied word for word, with two changes:
 *                                             ss_() opens the Service Questionnaire sheet by the SQ_SHEET_ID Script
 *                                             property, and SVC keeps only the settings used, TEAM_CODE read from a
 *                                             Script property so a paste never blanks it.
 *   apps-script/GroupKeep.gs                  for the OLD project: the few group declarations the orphan side still
 *                                             uses (the Claude caller, the holiday list, the PDF helpers).
 *
 * Edit the source files, never these two: run this tool after any change and paste what it writes.
 * The map is exact: every file is parsed (acorn), and a name counts only where the code reads it, never in a string,
 * a comment or a property key.
 */
const fs = require('fs'), path = require('path');
const req = (m) => { try { return require(m); } catch (e) { return require('/opt/node-tools/node_modules/' + m); } };
const acorn = req('acorn'), walk = req('acorn-walk');

const ROOT = path.join(__dirname, '..', '..');
const AS = path.join(ROOT, 'apps-script');
/* the files of the Service Questionnaire project as it stands */
const PROJECT = ['Service.gs', 'Transition.gs', 'ServiceSalesforce.gs', 'GroupClients.gs', 'GroupBilling.gs', 'GIRenewals.gs',
  'GroupSchedules.gs', 'StrategicMeeting.gs', 'Quotes.gs', 'Help868.gs', 'Letters.gs'].filter(f => fs.existsSync(path.join(AS, f)));
/* the files that move */
const GROUP = ['GroupClients.gs', 'GroupBilling.gs', 'GIRenewals.gs', 'GroupSchedules.gs'].filter(f => PROJECT.includes(f));
/* shared code is copied in this order, so a setting a later one reads at load is already there */
const SHARED_ORDER = ['Service.gs', 'ServiceSalesforce.gs', 'Transition.gs', 'StrategicMeeting.gs', 'Quotes.gs', 'Help868.gs', 'Letters.gs'];
const OUT_SHARED = path.join(AS, 'group-project', 'GroupShared.gs');
const OUT_KEEP = path.join(AS, 'GroupKeep.gs');

const files = {};
for (const f of PROJECT) {
  const src = fs.readFileSync(path.join(AS, f), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2022, allowHashBang: true });
  files[f] = { src, ast };
}

/* every top-level declaration: name -> { file, node (the statement), index } */
const decl = {};
for (const f of PROJECT) files[f].ast.body.forEach((n, i) => {
  const names = n.type === 'FunctionDeclaration' ? [n.id.name] : n.type === 'VariableDeclaration' ? n.declarations.map(d => d.id.name) : [];
  for (const nm of names) {
    if (decl[nm] && decl[nm].file !== f) throw new Error(nm + ' is declared in both ' + decl[nm].file + ' and ' + f + ': the last one loaded wins in Apps Script; remove one first.');
    decl[nm] = { file: f, node: n, index: i };
  }
});

function refs(node) {
  const out = new Set();
  walk.recursive(node, null, {
    Identifier(x) { out.add(x.name); },
    MemberExpression(x, st, c) { c(x.object, st); if (x.computed) c(x.property, st); },
    Property(x, st, c) { if (x.computed) c(x.key, st); c(x.value, st); },
  }, walk.base);
  return out;
}

/** Everything reachable from the seed files' declarations, from files in `from`. `skip` names are never followed: the
 *  old project's router reaches the group side only through typeof-guarded calls (gcmDoGet_, gcmDoPost_), which
 *  simply answer Unknown action once the group files have left. */
function closure(seedFiles, fromFiles, skip) {
  const need = new Set(), q = [];
  const push = (nm) => { const d = decl[nm]; if (d && fromFiles.includes(d.file) && !need.has(nm) && !(skip || []).includes(nm)) q.push(nm); };
  for (const f of seedFiles) for (const n of files[f].ast.body) for (const r of refs(n)) push(r);
  while (q.length) {
    const nm = q.pop(); if (need.has(nm)) continue; need.add(nm);
    for (const r of refs(decl[nm].node)) push(r);
  }
  return need;
}

/** SVC.KEY names read anywhere in the copied code */
function svcKeys(names) {
  const keys = new Set();
  for (const nm of names) walk.full(decl[nm].node, (x) => {
    if (x.type === 'MemberExpression' && !x.computed && x.object.type === 'Identifier' && x.object.name === 'SVC') keys.add(x.property.name);
  });
  return [...keys].sort();
}

/** the source of a statement with the comment block directly above it (never a file's banner) */
function textOf(nm) {
  const d = decl[nm], body = files[d.file].ast.body, src = files[d.file].src;
  const prevEnd = d.index ? body[d.index - 1].end : 0;
  const lines = src.slice(prevEnd, d.node.start).split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const lead = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!t || !/^(\/\/|\/\*|\*)/.test(t)) break;
    lead.unshift(lines[i]);
  }
  const text = lead.join('\n');
  const keepLead = text && !/={6,}/.test(text) && /^\s*(\/\/|\/\*)/.test(lead[0] || '');
  return (keepLead ? text.replace(/^\s+/, '') + '\n' : '') + src.slice(d.node.start, d.node.end);
}

function ordered(names, order) {
  return [...names].sort((a, b) => {
    const da = decl[a], db = decl[b];
    const fa = order.indexOf(da.file), fb = order.indexOf(db.file);
    return fa !== fb ? fa - fb : da.node.start - db.node.start;
  }).filter((nm, i, arr) => arr.findIndex(x => decl[x].node === decl[nm].node) === i);   // one statement once
}

const OTHER = PROJECT.filter(f => !GROUP.includes(f));
const shared = closure(GROUP, OTHER);
/* the router's two entry points are the only group names the old project may lose */
const ROUTER = ['gcmDoGet_', 'gcmDoPost_'];
const keep = closure(OTHER, GROUP, ROUTER);

/* ── GroupShared.gs ─────────────────────────────────────────────── */
const SS_TEXT = [
  '/** The Service Questionnaire spreadsheet (the Agent Skill Bank, Transition Send, the sign-in tabs). In the group',
  ' *  project ss_() opens it by the SQ_SHEET_ID Script property, once a run; the group tabs themselves are opened by',
  ' *  GCM_SHEET_ID (gcmSS_). With SQ_SHEET_ID unset, the sheet this project is bound to, if any. */',
  'var GROUP_SQ_SS_ = null;',
  'function ss_() {',
  '  if (GROUP_SQ_SS_) return GROUP_SQ_SS_;',
  "  var id = String(PropertiesService.getScriptProperties().getProperty('SQ_SHEET_ID') || '').trim();",
  '  var m = /\\/d\\/([A-Za-z0-9_-]{20,})/.exec(id);   // a whole link pasted in works too',
  '  if (m) id = m[1];',
  '  if (!id) return (GROUP_SQ_SS_ = SpreadsheetApp.getActiveSpreadsheet());',
  '  try { GROUP_SQ_SS_ = SpreadsheetApp.openById(id); }',
  "  catch (e) { throw new Error('The Service Questionnaire sheet in SQ_SHEET_ID could not be opened (' + String(e && e.message ? e.message : e).slice(0, 120) + '): check the ID, and that this account can edit that sheet.'); }",
  '  return GROUP_SQ_SS_;',
  '}'
].join('\n');

function svcText(keys) {
  const node = decl.SVC.node.declarations.find(d => d.id.name === 'SVC').init;
  const src = files[decl.SVC.file].src;
  const lines = ['/** The Service Questionnaire settings the shared code reads, copied from Service.gs (' + keys.join(', ') + ').',
    ' *  TEAM_CODE, the branch code, is the TEAM_CODE Script property here, so no paste ever blanks it. */',
    'var SVC = {'];
  const props = node.properties.filter(p => keys.includes(p.key.name || p.key.value));
  props.forEach((p, i) => {
    const k = p.key.name || p.key.value;
    const v = k === 'TEAM_CODE'
      ? "(function () { try { return String(PropertiesService.getScriptProperties().getProperty('TEAM_CODE') || '').trim(); } catch (e) { return ''; } })()"
      : src.slice(p.value.start, p.value.end);
    lines.push('  ' + k + ': ' + v + (i < props.length - 1 ? ',' : ''));
  });
  const missing = keys.filter(k => !props.some(p => (p.key.name || p.key.value) === k));
  if (missing.length) throw new Error('SVC has no ' + missing.join(', '));
  lines.push('};');
  return lines.join('\n');
}

function header(title, lines) {
  return ['/**', ' * ============================================================', ' *  ' + title,
    ' *  Ricky Rampersad Branch · GENERATED by tools/gas/split-group.js: do not edit here', ' * ============================================================', ' *']
    .concat(lines.map(l => ' *  ' + l)).concat([' */', '']).join('\n');
}

const sharedNames = ordered(shared, SHARED_ORDER);
const keys = svcKeys(sharedNames);
const byFile = {};
sharedNames.forEach(nm => { (byFile[decl[nm].file] = byFile[decl[nm].file] || []).push(nm); });
let outShared = header('GROUP SHARED — the code the group project uses from the Service Questionnaire project', [
  'Copied word for word from ' + Object.keys(byFile).join(', ') + ' (' + sharedNames.length + ' declarations), except ss_() and SVC.',
  'The group project is: GroupClients.gs, GroupBilling.gs, GIRenewals.gs' + (GROUP.includes('GroupSchedules.gs') ? ', GroupSchedules.gs' : '') + ',',
  'this file and GroupApp.gs. Change the source in the Service Questionnaire files, run the tool, and paste this file again.'
]);
for (const f of SHARED_ORDER) {
  if (!byFile[f]) continue;
  outShared += '\n/* ── from ' + f + ' ' + '─'.repeat(Math.max(4, 100 - f.length)) + ' */\n\n';
  outShared += byFile[f].map(nm => nm === 'ss_' ? SS_TEXT : nm === 'SVC' ? svcText(keys) : textOf(nm)).join('\n\n') + '\n';
}

/* ── GroupKeep.gs ───────────────────────────────────────────────── */
const keepNames = ordered(keep, GROUP);
const users = {};
for (const f of OTHER) for (const n of files[f].ast.body) for (const r of refs(n)) if (keep.has(r)) (users[r] = users[r] || new Set()).add(f);
for (const nm of [...keep]) if (!users[nm]) delete users[nm];   // reached only through another kept name
let outKeep = header('GROUP KEEP — what the Service Questionnaire project still needs once the group side has moved', [
  'Copied word for word from ' + [...new Set(keepNames.map(n => decl[n].file))].join(', ') + ' (' + keepNames.length + ' declarations).',
  'Used by: ' + Object.keys(users).sort().map(n => n + ' (' + [...users[n]].sort().join(', ') + ')').join('; ') + '.',
  'Add this file to the Service Questionnaire project when GroupClients.gs, GroupBilling.gs and GIRenewals.gs leave it.',
  'While those files are still in the project, this one must NOT be: each name would then be declared twice.'
]);
outKeep += '\n' + keepNames.map(textOf).join('\n\n') + '\n';

const check = process.argv.includes('--check');
let stale = 0;
for (const [file, text] of [[OUT_SHARED, outShared], [OUT_KEEP, outKeep]]) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (cur === text) { console.log('up to date  ' + path.relative(ROOT, file) + '  (' + text.length + ' chars)'); continue; }
  if (check) { console.log('OUT OF DATE ' + path.relative(ROOT, file) + ': run node tools/gas/split-group.js'); stale++; continue; }
  fs.writeFileSync(file, text);
  console.log('wrote       ' + path.relative(ROOT, file) + '  (' + text.length + ' chars)');
}
console.log('shared: ' + sharedNames.length + ' declarations from ' + Object.keys(byFile).join(', ') + '; SVC keys: ' + keys.join(', '));
console.log('keep:   ' + keepNames.length + ' declarations: ' + keepNames.join(', '));
process.exit(stale ? 1 : 0);
