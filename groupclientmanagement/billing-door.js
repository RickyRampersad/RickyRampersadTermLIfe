/* The Billings door (25 October 2026): billing.html, one group and one month at a time, in eight steps.
 *
 * "the objective is to upload the November 2026 group health, life and pension billing and the claims experience, also
 * build in intelligence from AI to ask the questions and run the analysis, as we need to also produce Guardian Life
 * billings as well, read the old invoices that are owed. Tasks opened for last month in October billing: an analysis,
 * deep insight, history is done as well, to post on Chatter for an update, as well any terminations etc. Make much more
 * simple and interactive, a site that will pop and not confuse the weekly query and task update" and "the analysis for
 * all persons re dependants and persons coming of age to convert".
 *
 * The steps: Upload · Found · Questions · Last month's tasks · Changes · People · Statement · Approve. The weekly letters
 * stay on index.html and nothing of them is here. This file defines the page's helpers ($, esc, api, post, toast, dmy,
 * BOARD, openGroup, render) the way index.html does, so billing-ui.js (the line cards' pieces, the findings, the task
 * panel, the forms, the payment box, the approve and send actions) runs unchanged; it then replaces openBilling and
 * drawBilling with the door's own. Sign-in is the staff page's (the same two localStorage keys). No client data lives
 * here: everything comes from GroupBilling.gs at request time. */
const SVC = 'https://script.google.com/macros/s/AKfycbxdW5mVcK6DZbq4qnCj1l1cJvjsTYWZ9UMH91H6yC_NrElNYpGd1vRyJH1W_1mcu61woQ/exec';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* a letter or statement shown here runs nothing; its links open in a tab of their own, and a link to the group's page
   says it came from a preview (27 October 2026) */
const PV_SANDBOX = 'allow-popups allow-popups-to-escape-sandbox';
const pvHead = '<!doctype html><meta charset="utf-8"><base target="_blank">';
const pvLinks = h => String(h || '').replace(/([?&;]from=)(letter|welcome|reminder|bill)\b/g, '$1preview');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : ''; };
const pct = n => n == null ? '–' : n + '%';
let AUTH = { code: '', who: '' }, BOARD = null, VIEW = 'list', GROUP = null, TAB = '';
const ROLE = { branch: 'Branch manager', deputy: 'Assistant branch manager', staff: 'Staff' };
try { AUTH.code = localStorage.getItem('rrb-gcm-code') || ''; AUTH.who = localStorage.getItem('rrb-gcm-who') || ''; } catch (e) {}
let LIST = { show: 'mine', q: '' };
try { const f = JSON.parse(localStorage.getItem('rrb-gbl-list') || 'null'); if (f && f.show) LIST.show = f.show; } catch (e) {}

function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.className = 'toast', bad ? 8000 : 4000); }
async function api(params) {
  const q = Object.entries(Object.assign({}, params, { code: AUTH.code, who: AUTH.who })).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  try { const txt = await (await fetch(SVC + '?' + q + '&z=' + Date.now())).text(); try { return JSON.parse(txt); } catch (e) { return { ok: false, notLive: true, error: 'The branch backend is not answering for billing yet: GroupBilling.gs and GroupClients.gs need pasting and a New version publishing.' }; } }
  catch (e) { return { ok: false, error: 'Could not reach the branch backend. Check the connection and try again.' }; }
}
async function post(body) {
  try { const txt = await (await fetch(SVC, { method: 'POST', body: JSON.stringify(Object.assign({}, body, { code: AUTH.code, who: AUTH.who })) })).text(); try { return JSON.parse(txt); } catch (e) { return { ok: false, error: 'The backend answered with a page instead of data.' }; } }
  catch (e) { return { ok: false, error: 'Could not reach the branch backend.' }; }
}
const dlg = $('dlg');
$('dlgX').onclick = () => dlg.close();

/* ── the gate ── */
$('gate').addEventListener('submit', e => { e.preventDefault(); AUTH = { code: $('gCode').value.trim(), who: $('gWho').value.trim() }; open_(); });
async function open_() {
  const err = $('gErr'), go = $('gGo');
  if (err) { err.textContent = ''; go.disabled = true; go.textContent = 'Opening… the sheet is answering'; }
  const d = await api({ action: 'gcm.board' });
  if (!d.ok) {
    if (!$('gate')) { location.reload(); return; }
    err.textContent = d.error || 'Not opened.'; go.disabled = false; go.textContent = 'Sign in'; return;
  }
  try { localStorage.setItem('rrb-gcm-code', AUTH.code); localStorage.setItem('rrb-gcm-who', AUTH.who); } catch (e) {}
  BOARD = d; head();
  const u = new URL(location.href), g = u.searchParams.get('g'), m = (u.searchParams.get('m') || '').slice(0, 7);  /* an address saved as 2026-10-01 still opens October */
  if (g && d.groups.some(x => x.key === g)) openBilling(g, m); else render();
}
function signOut() { try { localStorage.removeItem('rrb-gcm-code'); localStorage.removeItem('rrb-gcm-who'); } catch (e) {} location.href = 'billing.html'; }
function head() {
  $('who').innerHTML = esc(BOARD.me) + ' · ' + (BOARD.title || ROLE[BOARD.role] || 'Staff') + (BOARD.refreshed ? ' · Salesforce as at ' + esc(BOARD.refreshed) : '') +
    ' <button class="btn ghost" id="rf" type="button">Refresh from Salesforce</button> <a class="btn ghost" href="index.html">Weekly letters</a> <button class="btn ghost" type="button" onclick="signOut()">Sign out</button>';
  $('rf').onclick = refresh;
}
async function refresh() {
  const b = $('rf'); b.disabled = true; b.textContent = 'Refreshing… about a minute';
  const r = await api({ action: 'gcm.refresh' });
  if (!r.ok) { toast(r.error || 'Not refreshed', true); b.disabled = false; b.textContent = 'Refresh from Salesforce'; return; }
  toast(r.said || 'Refreshed');
  const d = await api({ action: 'gcm.board' }); if (d.ok) { BOARD = d; head(); }
  if (VIEW === 'billing' && BILL) openBilling(BILL.group.key, BILL.month); else render();
}
function openGroup(key) { openBilling(key); }
/** Back to the list: drawn at once from the board as it was, then read again, since the door may have moved the group's billing. */
async function backToList() { render(); const d = await api({ action: 'gcm.board' }); if (d.ok && VIEW === 'list') { BOARD = d; head(); render(); } }

/* ── the list: every group, where its month's billing stands ── */
function render() {
  VIEW = 'list'; BILL = null;
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  const d = BOARD, B = d.billing || {}, day = d.billingDay;
  const month = (d.today || '').slice(0, 7);
  const groups = d.groups.slice().sort((a, b) => (b.own ? 1 : 0) - (a.own ? 1 : 0) || a.name.localeCompare(b.name));
  const todo = groups.filter(blTodo).length, done = groups.filter(blDone).length, mine = groups.filter(g => g.own).length;
  if (LIST.show === 'mine' && !mine) LIST.show = 'all';
  const pill = (b, s, cls) => '<span class="pill' + (cls ? ' ' + cls : '') + '"><b>' + esc(b) + '</b>' + esc(s) + '</span>';
  $('mhello').innerHTML = '<h1>Billings Management</h1><p style="margin:6px 0 0;color:rgba(255,255,255,.85);max-width:72ch">The ' + esc(blMon(month)) + ' bills, one group at a time: upload the Group Health, Group Life and pension bills with the claims experience, see what the checks found, answer the questions, bring last month’s tasks up to date on Chatter, record the terminations and enrolments, look at the people, read the statement, approve.</p>' +
    '<div class="pills">' + pill(groups.length, 'groups') + pill(todo, 'with billing to do', todo ? 'hot' : 'ok') + pill(done, 'approved or sent') +
    (day ? pill(day.label.replace(/, \d+:\d+$/, ''), day.isDay ? 'the bills go today at ' + day.hour + ':00' : 'the bills go out at ' + day.hour + ':00' + (day.daysTo ? ' · in ' + day.daysTo + ' day' + (day.daysTo === 1 ? '' : 's') : '')) : '') +
    (d.billingLive === false ? pill('Test mode', 'a send goes to you, marked TEST') : '') + '</div>';
  let h = '<div class="filt" role="group" aria-label="Which groups"><span class="lbl">Show</span>' +
    [['mine', 'Mine', mine], ['todo', 'Billing to do', todo], ['all', 'Everyone', groups.length]].map(([k, l, n]) => '<button type="button" class="fbtn" data-show="' + k + '" aria-pressed="' + (LIST.show === k) + '">' + l + '<span class="n">' + n + '</span></button>').join('') +
    '<input class="field" id="lq" placeholder="Find a group" value="' + esc(LIST.q) + '" style="max-width:260px;margin-left:auto;padding:7px 10px">' + '</div>';
  const list = groups.filter(g => (LIST.show === 'all' || (LIST.show === 'mine' ? g.own : blTodo(g))) && (!LIST.q || (g.name + ' ' + (g.assigned || '') + ' ' + (g.bills || []).join(' ')).toLowerCase().indexOf(LIST.q.toLowerCase()) >= 0));
  h += '<div class="dlist">' + (list.length ? list.map(dGroupCard).join('') : '<p class="muted">No group matches.</p>') + '</div>';
  $('app').innerHTML = h;
  $('app').querySelectorAll('[data-show]').forEach(b => b.onclick = () => { LIST.show = b.dataset.show; try { localStorage.setItem('rrb-gbl-list', JSON.stringify({ show: LIST.show })); } catch (e) {} render(); });
  $('lq').oninput = () => { LIST.q = $('lq').value; const v = LIST.q; render(); const q = $('lq'); q.focus(); q.setSelectionRange(v.length, v.length); };
  $('app').querySelectorAll('[data-g]').forEach(b => b.onclick = () => openBilling(b.dataset.g));
  window.scrollTo(0, 0);
}
function dGroupCard(g) {
  const b = BOARD.billing ? BOARD.billing[g.key] : null;
  const st = !b || !b.lines ? 'none' : (b.fixes || b.held) ? 'todo' : blDone(g) ? 'done' : 'check';
  return '<button class="gcard g-' + st + '" type="button" data-g="' + esc(g.key) + '"><h4>' + esc(g.name) + '</h4>' + (blBoardChip(g) || '') +
    '<div class="who">' + (g.own ? '<b>Yours</b>' : 'Looked after by <b>' + esc(g.assigned || 'nobody') + '</b>') + (g.canAct === false ? ' · read only' : '') + ' · list bill ' + esc((g.bills || []).join(', ') || 'none') + '</div>' +
    '<div class="go">Open the billing →</div></button>';
}

/* ── the door: one group, one month, eight steps ── */
const D_STEPS = [['upload', 'Upload the bills'], ['findings', 'What was found'], ['ask', 'Answer the questions'], ['tasks', 'Last month’s tasks'], ['changes', 'Terminations and changes'], ['people', 'The people'], ['statement', 'The statement'], ['approve', 'Approve and send']];
let DOOR = dFresh();
function dFresh() { return { step: '', sig: '', ask: null, upd: null, people: null, stmt: null, aiRead: null, aiBusy: false, loading: {}, posted: {}, letters: {}, seenStmt: false }; }
function dSig(d) { return d.lines.map(o => o.bill ? [o.bill.checkedAt, o.bill.reconciledAt, o.bill.sentAt, Object.keys(o.bill.resolved || {}).length, o.steps.status].join('~') : '').join('|') + '|' + (d.tasks || []).length + '|' + (d.changes || []).length; }
async function openBilling(key, month) {
  const same = VIEW === 'billing' && BILL && BILL.group.key === key && (!month || month === BILL.month);
  if (!same) $('app').innerHTML = '<p class="muted" style="margin:30px 0">Opening the billing: Salesforce’s billing records, payments, members and tasks…</p>';
  else { const s = $('dsync'); if (s) s.textContent = 'Updating…'; }
  const d = await api(Object.assign({ action: 'gcm.billing', group: key }, month ? { month } : {}));
  if (!d.ok) { toast(d.error || 'Not opened', true); if (!same) render(); return; }
  const sig = dSig(d);
  if (!same || d.month !== BILL.month) DOOR = dFresh();
  else if (sig !== DOOR.sig) { DOOR.ask = null; DOOR.upd = null; DOOR.stmt = null; DOOR.aiRead = null; }
  DOOR.sig = sig;
  VIEW = 'billing'; BILL = d; BILL_MONTH = d.month;
  try { history.replaceState(null, '', 'billing.html?g=' + encodeURIComponent(key) + '&m=' + d.month); } catch (e) {}
  drawBilling();
}
function drawBilling() {
  const d = BILL, g = d.group, S = dStates();
  if (!DOOR.step || !S[DOOR.step]) DOOR.step = dFirstOpen(S);
  $('mhello').innerHTML = '';
  const months = new Set([d.month, blAddM(d.today.slice(0, 7), 1), d.today.slice(0, 7)]);
  d.lines.forEach(o => { o.stored.forEach(x => months.add(x.month)); o.sf.history.forEach(x => months.add(x.month)); });
  const opts = [...months].filter(Boolean).sort().reverse().map(m => '<option value="' + m + '"' + (m === d.month ? ' selected' : '') + '>' + blMon(m) + '</option>').join('');
  let h = '<button class="back" type="button" id="blBack">← All groups</button>' +
    '<div class="dhead"><div><h2>' + esc(g.name) + ' <span class="muted">· ' + esc(d.monthLabel) + '</span></h2><p class="sub">List bill ' + esc(g.bills.join(', ') || 'none') + ' · bills go to ' + esc(g.contact || g.to.join(', ') || 'nobody yet') +
    (d.canAct === false ? ' · <b>read only</b>: ' + esc(g.assigned || 'its owner') + ', the assistant branch manager or the branch manager act here' : '') + (d.salesforce ? '' : ' · <b>Salesforce is not linked</b>') + ' <span id="dsync" class="muted"></span></p></div>' +
    '<div class="dctl"><label class="sel">Month <select id="blMonth">' + opts + '</select></label><button class="btn ghost sm" type="button" id="blFresh">Read Salesforce again</button></div></div>';
  h += '<div id="dstrip">' + dStripHtml(S) + '</div><div class="dpanel" id="dpanel">' + dPanel(DOOR.step) + '</div>';
  $('app').innerHTML = h;
  $('blBack').onclick = () => backToList();
  $('blMonth').onchange = () => openBilling(g.key, $('blMonth').value);
  $('blFresh').onclick = async () => { $('blFresh').disabled = true; const r = await api({ action: 'gcm.billing', group: g.key, month: d.month, fresh: 'Y' }); if (r.ok) { BILL = r; DOOR.sig = dSig(r); DOOR.ask = DOOR.upd = DOOR.stmt = DOOR.people = null; drawBilling(); toast('Salesforce read again.'); } else { $('blFresh').disabled = false; toast(r.error || 'Not read', true); } };
  dBindStrip(); dBindPanel(); dAfterDraw(DOOR.step);
  dPrefetch();
  window.scrollTo(0, 0);
}
function dBindStrip() { $('dstrip').querySelectorAll('[data-go]').forEach(b => b.onclick = () => dGo(b.dataset.go)); }
function dDrawStrip() { const el = $('dstrip'); if (!el) return; el.innerHTML = dStripHtml(dStates()); dBindStrip(); }
function dDrawPanel() { const el = $('dpanel'); if (!el) return; el.innerHTML = dPanel(DOOR.step); dBindPanel(); dAfterDraw(DOOR.step); }
function dGo(step) { if (!D_STEPS.some(([k]) => k === step)) return; DOOR.step = step; dDrawStrip(); dDrawPanel(); const p = $('dpanel'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function dStripHtml(S) {
  const done = D_STEPS.filter(([k]) => S[k].state === 'done').length;
  return '<div class="prog"><span>' + done + ' of ' + D_STEPS.length + ' steps done</span><div class="track"><div class="fill" style="width:' + Math.round(100 * done / D_STEPS.length) + '%"></div></div>' + (BILL.live ? '' : '<span class="chip" title="A send goes to you and the branch, marked TEST, until gblGoLive"><i style="background:var(--warnMark)"></i>Test mode</span>') + '</div>' +
    '<ol class="dsteps" aria-label="The steps">' + D_STEPS.map(([k, l], i) => { const s = S[k]; return '<li><button type="button" class="dstep ' + esc(s.state) + '" data-go="' + k + '"' + (DOOR.step === k ? ' aria-current="step"' : '') + '><span class="n">' + (s.state === 'done' ? '✓' : i + 1) + '</span><span class="l">' + l + '</span>' + (s.badge !== '' && s.badge != null ? '<span class="b">' + esc(s.badge) + '</span>' : '') + '</button></li>'; }).join('') + '</ol>';
}
/** Where each step stands: done, todo, check (amber), wait (nothing to do yet), info. */
function dStates() {
  const d = BILL, withBill = d.lines.filter(o => o.bill);
  let expected = d.lines.filter(o => o.bill || (o.sf && o.sf.rec)); if (!expected.length) expected = d.lines;
  const openF = lvl => withBill.reduce((n, o) => n + (o.bill.findings || []).filter(f => f.level === lvl && !(o.bill.resolved || {})[f.id]).length, 0);
  const fixes = openF('fix'), checks = openF('check'), S = {};
  S.upload = { state: withBill.length >= expected.length && withBill.length ? 'done' : 'todo', badge: withBill.length + '/' + expected.length };
  S.findings = { state: !withBill.length ? 'wait' : fixes ? 'todo' : checks ? 'check' : 'done', badge: fixes + checks ? fixes + checks : (withBill.length ? '✓' : '') };
  const A = DOOR.ask, left = A && A.ok ? A.total - A.answered : null;
  S.ask = { state: !withBill.length ? 'wait' : !A ? 'todo' : left ? 'todo' : 'done', badge: !withBill.length ? '' : !A ? '…' : left ? left : '✓' };
  const openT = (d.tasks || []).filter(t => !dUpdated(t.id)).length;
  S.tasks = { state: !(d.tasks || []).length ? 'done' : openT ? 'todo' : 'done', badge: (d.tasks || []).length ? (openT || '✓') : '0' };
  const nCh = (d.changes || []).filter(c => /^(joiner|leaver|tier|dependent)$/.test(c.kind) && (c.effective || '').slice(0, 7) === d.month).length;
  S.changes = { state: 'info', badge: nCh || '' };
  const P = DOOR.people, acts = P && P.ok ? P.counts.convert + P.counts.depAge + P.counts.retire : null, chk = P && P.ok ? P.counts.over65 + P.counts.depOver + P.counts.tierDeps + P.counts.tierSingle + P.counts.nodob + P.counts.nosf : 0;
  S.people = { state: !withBill.length ? 'wait' : !P ? 'todo' : acts ? 'todo' : chk ? 'check' : 'done', badge: !withBill.length ? '' : !P ? '…' : acts ? acts : chk ? chk : '✓' };
  S.statement = { state: !withBill.length ? 'wait' : DOOR.seenStmt ? 'done' : 'todo', badge: '' };
  const sentOrApp = withBill.filter(o => o.bill.sentAt || o.steps.status === 'approved').length, toApprove = withBill.filter(o => o.bill.reconciledAt && !o.bill.sentAt && o.steps.status !== 'approved').length;
  S.approve = { state: !withBill.length ? 'wait' : sentOrApp >= withBill.length ? 'done' : 'todo', badge: !withBill.length ? '' : toApprove ? toApprove : sentOrApp + '/' + withBill.length };
  return S;
}
function dFirstOpen(S) { const k = D_STEPS.map(([k]) => k).find(k => S[k].state === 'todo' || S[k].state === 'check'); return k || 'approve'; }
function dUpdated(id) { return !!DOOR.posted[id] || (BILL.changes || []).some(c => c.task === id && /^task(update|closed)$/.test(c.kind) && (c.effective || '').slice(0, 7) === BILL.month); }
function dNav(step) {
  const i = D_STEPS.findIndex(([k]) => k === step), prev = D_STEPS[i - 1], next = D_STEPS[i + 1];
  return '<div class="dnav">' + (prev ? '<button class="btn ghost" type="button" data-go="' + prev[0] + '">← ' + prev[1] + '</button>' : '<span></span>') + (next ? '<button class="btn" type="button" data-go="' + next[0] + '">Next: ' + next[1] + ' →</button>' : '<button class="btn ghost" type="button" id="dDone">← All groups</button>') + '</div>';
}
function dPanel(step) {
  switch (step) {
    case 'upload': return dUpload();
    case 'findings': return dFindings();
    case 'ask': return dAsk();
    case 'tasks': return dTasks();
    case 'changes': return dChanges();
    case 'people': return dPeople();
    case 'statement': return dStatement();
    default: return dApprove();
  }
}
function dBindPanel() {
  const app = $('dpanel'); if (!app) return;
  blBindLines(); blBindTasks(); blBindChanges();
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => dGo(b.dataset.go));
  const dn = $('dDone'); if (dn) dn.onclick = () => backToList();
  app.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => dAnswer(b.dataset.ans, b.dataset.v, b));
  app.querySelectorAll('[data-upd]').forEach(b => b.onclick = () => dPostUpdate(b.dataset.upd, b));
  app.querySelectorAll('[data-ucmt]').forEach(b => b.onclick = () => dMoreOnTask(b.dataset.ucmt));
  app.querySelectorAll('[data-letter]').forEach(b => b.onclick = () => dLetter(b.dataset));
  app.querySelectorAll('[data-ptask]').forEach(b => b.onclick = () => { blTaskPanel(b.dataset.line || 'health', ''); dPreset(b.dataset.ptask, b.dataset.member || ''); });
  app.querySelectorAll('[data-enrol]').forEach(b => b.onclick = () => blFormPanel(b.dataset.enrol || '', '', null, 'enrol'));
  const pdf = $('dPdf'); if (pdf) pdf.onclick = dPdf;
  const ml = $('dMail'); if (ml) ml.onclick = dMail;
  const ai = $('dAiGo'); if (ai) ai.onclick = () => { DOOR.aiRead = null; dAiRead(true); };
}
function dAfterDraw(step) {
  if (step === 'findings') dAiRead(false);
  if (step === 'ask' && !DOOR.ask) dLoad('ask');
  if (step === 'tasks' && !DOOR.upd) dLoad('upd');
  if (step === 'people' && !DOOR.people) dLoad('people');
  if (step === 'statement') { DOOR.seenStmt = true; if (!DOOR.stmt) dLoad('stmt'); else dDrawStrip(); }
}
/** The four slow reads start the moment the door opens, so the badges fill in while the first step is being worked. */
function dPrefetch() { if (!BILL.lines.some(o => o.bill)) return; ['ask', 'upd', 'people', 'stmt'].forEach(k => { if (!DOOR[k] && !DOOR.loading[k]) dLoad(k); }); }
const D_ROUTE = { ask: 'gcm.billAsk', upd: 'gcm.billTaskUpdates', people: 'gcm.billPeople', stmt: 'gcm.billStatement' }, D_STEP = { ask: 'ask', upd: 'tasks', people: 'people', stmt: 'statement' };
async function dLoad(k) {
  const d = BILL, key = d.group.key, month = d.month; DOOR.loading[k] = true;
  const r = await api({ action: D_ROUTE[k], group: key, month });
  DOOR.loading[k] = false;
  if (!BILL || BILL.group.key !== key || BILL.month !== month) return;
  DOOR[k] = r;
  dDrawStrip();
  if (DOOR.step === D_STEP[k]) { const el = $('dpanel'); if (el) { el.innerHTML = dPanel(DOOR.step); dBindPanel(); } }
}
/** The whole bill read again after an action that changes the findings, without leaving the step or losing what is typed. */
async function dRefreshBill() {
  const key = BILL.group.key, month = BILL.month, step = DOOR.step;
  const d = await api({ action: 'gcm.billing', group: key, month });
  if (!d.ok || !BILL || BILL.group.key !== key || BILL.month !== month) return;
  const sig = dSig(d); BILL = d;
  if (sig !== DOOR.sig) { DOOR.sig = sig; DOOR.stmt = null; if (step !== 'ask') DOOR.ask = null; dDrawStrip(); if (step !== 'ask') dDrawPanel(); }
}
const dSfRow = o => { const rec = o.sf.rec; return '<div class="sfrow">' + (rec ? '<span class="chip"><i style="background:var(--bar)"></i>Salesforce ' + esc(rec.name) + ': billed ' + esc(blMoney(rec.billed)) + (rec.paid ? ', paid ' + esc(blMoney(rec.paid)) : ', nothing paid yet') + (rec.reconciled ? ' · reconciled' : '') + '</span>' : '<span class="chip warn"><i></i>No ' + esc(o.rt) + ' record for ' + esc(BILL.monthLabel) + ' in Salesforce</span>') + o.sf.pays.map(p => '<span class="chip good"><i></i>' + esc(blMoney(p.amount)) + ' paid ' + esc(dmy(p.paidOn)) + (p.method ? ' by ' + esc(p.method) : '') + '</span>').join('') + '</div>'; };

/* ── step 1: upload ── */
function dUpload() {
  const d = BILL;
  let h = '<h3 class="ptitle">Upload the ' + esc(d.monthLabel) + ' bills</h3><p class="plead">One line at a time: Head Office’s Group Health invoice, the Group Life pack (the member bill, the statement of adjustment and the letter together) and the branch’s pension list bill. Each is read here on your device, then stored and checked against Salesforce. The claims experience spreadsheet goes in under Group Health.</p>';
  h += d.lines.map(dUploadCard).join('');
  return h + dNav('upload');
}
function dUploadCard(o) {
  const d = BILL, b = o.bill, can = d.canAct !== false;
  let h = '<section class="bline" id="line-' + o.line + '"><div class="blt"><h3>' + esc(o.label) + '</h3>' + blSteps(o.steps) + '</div>' + dSfRow(o);
  if (!b || BILL_READ[o.line]) {
    h += '<div class="upload" id="up-' + o.line + '"><p class="small">' + esc(BL_HINT[o.line]) + '</p>';
    if (can) h += '<div class="uprow"><label class="btn ghost" for="file-' + o.line + '">Choose the file' + (o.line === 'life' ? 's' : '') + '</label><input type="file" id="file-' + o.line + '" data-line="' + o.line + '" accept="' + (o.line === 'listbill' ? '.xlsx,.xls,.csv,.pdf' : '.pdf') + '"' + (o.line === 'life' ? ' multiple' : '') + ' class="hide">' +
      (o.line === 'listbill' && o.fromSalesforce ? '<button class="btn ghost" type="button" data-fromsf="listbill">Build it from Salesforce (' + o.fromSalesforce.count + ' policies, ' + esc(blMoney(o.fromSalesforce.total)) + ')</button>' : '') + '<span class="small muted" id="upmsg-' + o.line + '"></span></div>';
    else h += '<p class="small muted">Only ' + esc(d.group.assigned || 'the owner') + ', the assistant branch manager or the branch manager can upload here.</p>';
    h += '<div id="preview-' + o.line + '">' + (BILL_READ[o.line] ? blPreview(o.line, BILL_READ[o.line]) : '') + '</div></div>';
  }
  if (b) {
    const v = b.variance;
    h += '<div class="tiles bill-tiles"><div class="tile"><b>' + esc(blMoney(b.due)) + '</b><span>due for ' + esc(blMon(b.month)) + (b.dueBy ? ' · by ' + esc(dmy(b.dueBy)) : '') + '</span></div>' +
      '<div class="tile"><b>' + b.members + '</b><span>' + (o.line === 'listbill' ? 'policies' : 'members') + ' on the bill</span></div>' +
      (b.arrears ? '<div class="tile alert"><b>' + esc(blMoney(b.arrears)) + '</b><span>earlier months shown unpaid</span></div>' : '') +
      '<div class="tile' + (Math.abs(v) > 0.05 ? ' alert' : '') + '"><b>' + (b.sfRecord ? esc(blMoney(b.sfBilled)) : '–') + '</b><span>billed in Salesforce' + (b.sfRecord ? (Math.abs(v) > 0.05 ? ' · ' + (v > 0 ? esc(blMoney(v)) + ' more than' : esc(blMoney(-v)) + ' short of') + ' the ' + esc(blMoney(blCharged(o.line, b))) + ' charged' : ' · the same as the ' + esc(blMoney(blCharged(o.line, b))) + ' charged') : ' · no record') + '</span></div></div>' +
      '<p class="small muted">' + (b.ref ? 'Ref ' + esc(b.ref) + ' · ' : '') + (b.dated ? 'dated ' + esc(dmy(b.dated)) + ' · ' : '') + 'uploaded by ' + esc(b.by) + ' ' + esc(b.checkedAt) + (b.files ? ' · ' + esc(b.files) : '') + (b.reconciledAt ? ' · <b>reconciled ' + esc(b.reconciledAt) + '</b>' : '') + (b.sentAt ? ' · <b>sent ' + esc(b.sentAt) + '</b>' : '') +
      (can && !BILL_READ[o.line] ? ' · <button class="lnk" type="button" data-reup="' + o.line + '">upload again</button>' : '') + '</p>';
  }
  if (o.line === 'health') h += blClaims(o, can);
  return h + '</section>';
}

/* ── step 2: what was found ── */
function dFindings() {
  const d = BILL, withBill = d.lines.filter(o => o.bill);
  let h = '<h3 class="ptitle">What the checks found</h3><p class="plead">Every bill against Salesforce: the month’s record and its amount, the arrears, every member on the bill and on the record, who joined or left, the back-charges, the rates, the list bill. Fix what is marked <b>fix</b>, confirm what is marked <b>check</b>; the rest is for the record. The AI reads the whole month for you first.</p>';
  if (!withBill.length) return h + '<div class="dnote">No bill is uploaded for ' + esc(d.monthLabel) + ' yet. <button class="lnk" type="button" data-go="upload">Upload first</button></div>' + dNav('findings');
  if (d.ai) h += '<div id="blAiBox">' + (DOOR.aiRead ? dAiHtml(DOOR.aiRead) : '<div class="drawer ai"><p class="muted" style="margin:0">' + (DOOR.aiBusy ? 'Reading this month with AI: the findings as counts, the Salesforce figures, the open tasks…' : 'The AI read of this month comes here.') + '</p></div>') + '</div>';
  withBill.forEach(o => { h += '<section class="bline" id="line-' + o.line + '"><div class="blt"><h3>' + esc(o.label) + '</h3>' + blSteps(o.steps) + '</div>' + dSfRow(o) + blSfwPanel(o) + blFindings(o) + '</section>'; });
  return h + dNav('findings');
}
function dAiHtml(r) {
  if (!r.ok) return '<div class="note bad">' + esc(r.error) + ' <button class="lnk" type="button" id="dAiGo">Try again</button></div>';
  return '<div class="drawer ai"><h3 style="margin-top:0">Where this month stands <span class="muted small">· AI read for staff; no name left this page · <button class="lnk" type="button" id="dAiGo">read again</button></span></h3><p>' + esc(r.where) + '</p>' +
    (r.first && r.first.length ? '<p><b>First:</b></p><ol>' + r.first.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') + (r.careful ? '<p><b>Careful:</b> ' + esc(r.careful) + '</p>' : '') + (r.say ? '<p><b>To the group:</b> “' + esc(r.say) + '”</p>' : '') + '</div>';
}
async function dAiRead(force) {
  const d = BILL; if (!d.ai || !d.lines.some(o => o.bill) || DOOR.aiBusy || (DOOR.aiRead && !force)) return;
  const key = d.group.key, month = d.month; DOOR.aiBusy = true;
  const box = $('blAiBox'); if (box) box.innerHTML = '<div class="drawer ai"><p class="muted" style="margin:0">Reading this month with AI: the findings as counts, the Salesforce figures, the open tasks…</p></div>';
  const r = await api({ action: 'gcm.billAi', group: key, month });
  DOOR.aiBusy = false;
  if (!BILL || BILL.group.key !== key || BILL.month !== month) return;
  DOOR.aiRead = r;
  const b2 = $('blAiBox'); if (b2) { b2.innerHTML = dAiHtml(r); const ai = $('dAiGo'); if (ai) ai.onclick = () => { DOOR.aiRead = null; dAiRead(true); }; }
}

/* ── step 3: the questions ── */
function dAsk() {
  const d = BILL, A = DOOR.ask, can = d.canAct !== false;
  let h = '<h3 class="ptitle">Answer the questions</h3><p class="plead">The checks ask what only a person knows, and the AI adds its own from the figures. One tap answers each. Every answer goes onto the line’s billing task in Salesforce under your name, settles the finding it came from, or opens what comes next: a task, a payment, the termination form.</p>';
  if (!d.lines.some(o => o.bill)) return h + '<div class="dnote">No bill is uploaded for ' + esc(d.monthLabel) + ' yet. <button class="lnk" type="button" data-go="upload">Upload first</button></div>' + dNav('ask');
  if (!A) return h + '<div class="dnote"><p class="muted" style="margin:0">Reading the findings and asking the AI…</p></div>' + dNav('ask');
  if (!A.ok) return h + '<div class="note bad">' + esc(A.error) + '</div>' + dNav('ask');
  const left = A.total - A.answered;
  h += '<div class="prog"><span>' + A.answered + ' of ' + A.total + ' answered</span><div class="track"><div class="fill" style="width:' + (A.total ? Math.round(100 * A.answered / A.total) : 100) + '%"></div></div></div>';
  if (A.aiError) h += '<div class="note">The AI could not add its questions: ' + esc(A.aiError) + '</div>';
  if (!A.questions.length) h += '<div class="dnote" style="border-left:4px solid var(--good)">' + esc(A.said) + '</div>';
  else if (!left) h += '<div class="dnote" style="border-left:4px solid var(--good)"><b>Every question is answered.</b> Change an answer below if something turns out differently.</div>';
  h += A.questions.map(q => dQCard(q, can)).join('');
  return h + dNav('ask');
}
function dQCard(q, can) {
  const a = q.answered, lvl = q.kind === 'ai' ? 'ai' : (q.level || 'note');
  return '<article class="qcard q-' + esc(lvl) + (a ? ' answered' : '') + '" id="q-' + esc(q.id) + '"><div class="qtop">' +
    (q.kind === 'ai' ? '<span>AI question · from the figures</span>' : '<span>' + esc(BL_WHO[q.who] || q.who || 'The check') + (q.label ? ' · ' + esc(q.label) : '') + '</span>') +
    (lvl === 'fix' || lvl === 'check' ? '<span class="chip ' + (lvl === 'fix' ? 'bad' : 'warn') + '"><i></i>' + (lvl === 'fix' ? 'fix before reconciling' : 'to confirm') + '</span>' : '') + '</div>' +
    '<h4>' + esc(q.text) + '</h4>' + (q.why && q.why !== q.text ? '<p class="why">' + esc(q.why) + '</p>' : '') +
    (q.members && q.members.length > 1 ? '<details class="names"><summary>' + q.members.length + ' named</summary><ul>' + q.members.map(m => '<li>' + esc(blNice(m.name)) + (m.id ? ' · ' + esc(m.id) : '') + (m.premium != null ? ' · ' + esc(blMoney(m.premium)) : '') + '</li>').join('') + '</ul></details>' : '') +
    (a ? '<div class="ans">Answered: ' + esc(a.label) + ' · ' + esc(a.by) + ' · ' + esc(a.at) + (a.note ? ' · “' + esc(a.note) + '”' : '') + '</div>' : '') +
    (can ? '<div class="opts">' + q.options.map(o => '<button type="button" class="qopt' + (a || /unsure/.test(o.v) ? ' quiet' : '') + '" data-ans="' + esc(q.id) + '" data-v="' + esc(o.v) + '">' + esc(o.label) + '</button>').join('') + '</div>' +
      (a ? '' : '<details class="qnote"><summary>Add a note with the answer</summary><input class="field" id="qn-' + esc(q.id) + '" maxlength="600" placeholder="What you know, in a line: it goes on the task with the answer"></details>') : '') + '</article>';
}
const blNice = s => String(s || '').replace(/\s*,\s*/, ', ').replace(/\b([A-Z])([A-Z'’-]+)\b/g, (m, a, b) => a + b.toLowerCase());
async function dAnswer(qid, v, btn) {
  const A = DOOR.ask, q = A && A.questions.find(x => x.id === qid); if (!q) return;
  const opt = q.options.find(o => o.v === v); if (!opt) return;
  const card = $('q-' + qid), note = ($('qn-' + qid) || {}).value || '';
  card.querySelectorAll('button').forEach(b => b.disabled = true); btn.textContent = btn.textContent.replace(/…$/, '') + '…';
  const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line: q.line || '', month: BILL.month, act: 'answer', q: qid, v, note, text: q.text, label: opt.label });
  if (!r.ok) { toast(r.error || 'Not answered', true); card.querySelectorAll('button').forEach(b => b.disabled = false); btn.textContent = btn.textContent.replace(/…$/, ''); return; }
  q.answered = r.answered; A.answered = A.questions.filter(x => x.answered).length;
  toast(r.said || 'Answered.');
  card.outerHTML = dQCard(q, BILL.canAct !== false);
  $('q-' + qid).querySelectorAll('[data-ans]').forEach(b => b.onclick = () => dAnswer(b.dataset.ans, b.dataset.v, b));
  const pr = $('dpanel').querySelector('.prog'); if (pr) pr.outerHTML = '<div class="prog"><span>' + A.answered + ' of ' + A.total + ' answered</span><div class="track"><div class="fill" style="width:' + (A.total ? Math.round(100 * A.answered / A.total) : 100) + '%"></div></div></div>';
  dDrawStrip();
  if (r.next) dNext(r.next, q); else if (r.resolved) dRefreshBill();
}
/** What an answer opens next: a second upload, the Salesforce fix, the payment box, the task panel with the kind chosen, the termination form. */
function dNext(n, q) {
  if (!n || !n.kind) return;
  if (n.kind === 'reup') { BILL_READ[n.line] = { part: null, names: [], warnings: [], again: true }; dGo('upload'); const b = $('preview-' + n.line); if (b) b.innerHTML = ''; toast('Upload the ' + (BL_LABEL[n.line] || '') + ' bill again.'); }
  else if (n.kind === 'fix' && (n.fix === 'sfAmount' || n.fix === 'sfWrite')) { toast('Writing to Salesforce…'); post({ action: 'gcm.billAct', group: BILL.group.key, line: n.line, month: BILL.month, act: n.fix }).then(r => { toast(r.ok ? r.said : (r.error || 'Not set'), !r.ok); if (r.ok) { DOOR.ask = null; dRefreshBill().then(() => dLoad('ask')); } }); }
  else if (n.kind === 'pay') blPayment(n.line, n.month || BILL.month, n.amount);
  else if (n.kind === 'task') { blTaskPanel(n.line || 'health', /^a\d+$/.test(q.id) ? '' : q.id); dPreset(n.task, n.member || ''); }
  else if (n.kind === 'leavers') { const M = n.members || []; blFormPanel(M[0] ? blNice(M[0]) : '', 'terminate', null, 'change'); if (M.length > 1) toast('One form a person: ' + M.map(blNice).join(', ') + '.'); }
}
function dPreset(kind, member) {
  const chip = document.querySelector('#tkKinds .chip[data-kind="' + kind + '"]'); if (chip) chip.click();
  const m = $('tkMember'); if (m && member) { m.value = member; m.dispatchEvent(new Event('input')); }
}

/* ── step 4: last month's tasks, read against this month ── */
const D_VERDICT = { cleared: ['good', 'Settled by this month’s bills'], open: ['warn', 'Still open'], worse: ['bad', 'Got worse'] };
function dTasks() {
  const d = BILL, U = DOOR.upd, can = d.canAct !== false;
  let h = '<h3 class="ptitle">Last month’s tasks, read against this month</h3><p class="plead">Every billing task still open in Salesforce, with what the ' + esc(d.monthLabel) + ' bills and Salesforce say about it: settled, still open, or worse. The update is written for you (by the AI from the task’s history when it is on, from the record otherwise). Edit it, post it on the task with the owner told, and close the task when it is settled.</p>';
  if (!(d.tasks || []).length) h += '<div class="dnote" style="border-left:4px solid var(--good)">No billing task is open on this group in Salesforce.</div>';
  else if (!U) h += '<div class="dnote"><p class="muted" style="margin:0">Reading the open tasks, their Chatter and this month’s bills…</p></div>';
  else if (!U.ok) h += '<div class="note bad">' + esc(U.error) + '</div>';
  else {
    const n = k => U.tasks.filter(t => t.verdict === k).length, posted = U.tasks.filter(t => dUpdated(t.id)).length;
    h += '<div class="dtiles"><div class="dtile"><b>' + U.tasks.length + '</b><span>open billing tasks</span></div><div class="dtile good"><b>' + n('cleared') + '</b><span>settled by this month’s bills</span></div><div class="dtile warn"><b>' + n('open') + '</b><span>still open</span></div>' + (n('worse') ? '<div class="dtile alert"><b>' + n('worse') + '</b><span>got worse</span></div>' : '') + '<div class="dtile act"><b>' + posted + '</b><span>updated this month</span></div></div>';
    if (U.aiError) h += '<div class="note">The AI did not write the updates (' + esc(U.aiError) + '); these are written from the record.</div>';
    if (U.feedError) h += '<div class="note bad">Chatter could not be read: ' + esc(U.feedError) + '</div>';
    h += U.tasks.map(t => dUCard(t, can)).join('');
  }
  h += blInboxHtml(d);
  return h + dNav('tasks');
}
function dUCard(t, can) {
  const was = dUpdated(t.id), V = D_VERDICT[t.verdict] || D_VERDICT.open, closed = DOOR.posted[t.id] && DOOR.posted[t.id].closed;
  return '<article class="ucard v-' + esc(t.verdict) + (was ? ' posted' : '') + '" id="u-' + esc(t.id) + '"><div class="ltt"><h4>' + esc(t.title) + '</h4><span class="chip ' + V[0] + '"><i></i>' + V[1] + '</span></div>' +
    '<div class="small muted"><b>' + esc(t.owner || '–') + '</b> has it · opened ' + esc(dmy(t.opened)) + ' (' + t.age + ' days) · due ' + (t.due ? esc(dmy(t.due)) + (t.late ? ' <b style="color:var(--badText)">past</b>' : '') : 'not set') + ' · ' + esc(t.status) + (t.shown ? ' · the group sees it' : '') + '</div>' +
    '<ul class="ev">' + (t.evidence || []).map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' +
    (t.lastPost ? '<div class="last">Last on Chatter: <b>' + esc(t.lastPost.by) + '</b> ' + esc(t.lastPost.when) + ' · ' + esc(String(t.lastPost.text || '').slice(0, 220)) + '</div>' : '<div class="last">No Chatter on this task yet.</div>') +
    (was ? '<div class="ans">' + (closed || t.open === false ? 'Closed after the ' + esc(BILL.monthLabel) + ' review.' : 'Update posted for ' + esc(BILL.monthLabel) + '.') + '</div>' : '') +
    (can ? '<label class="small" for="ut-' + esc(t.id) + '" style="margin-top:8px">The update' + (t.byAi ? ' <span class="muted">· written by the AI from the history and the bills; edit it</span>' : ' <span class="muted">· from the record; edit it</span>') + '</label><textarea class="field" id="ut-' + esc(t.id) + '" maxlength="2000">' + esc(t.update) + '</textarea>' +
      '<div class="uprow"><label class="toggle small"><input type="checkbox" id="un-' + esc(t.id) + '" checked> Tell ' + esc(t.owner || 'whoever has it') + ': @mention on Chatter and an e-mail from support@</label>' +
      '<label class="toggle small"><input type="checkbox" id="uc-' + esc(t.id) + '"' + (t.canClose && !was ? ' checked' : '') + (t.open === false || closed ? ' disabled' : '') + '> Close the task in Salesforce</label></div>' +
      '<div class="uprow"><button class="btn sm" type="button" data-upd="' + esc(t.id) + '">' + (was ? 'Post another update' : 'Post the update') + '</button><button class="btn sm ghost" type="button" data-ucmt="' + esc(t.id) + '">Comment, or post for the group…</button></div>' : '') +
    '<div id="uex-' + esc(t.id) + '"></div></article>';
}
async function dPostUpdate(id, btn) {
  const t = DOOR.upd && DOOR.upd.tasks.find(x => x.id === id); if (!t) return;
  const text = ($('ut-' + id) || {}).value || '', notify = $('un-' + id) && $('un-' + id).checked, close = $('uc-' + id) && $('uc-' + id).checked && !$('uc-' + id).disabled;
  if (!text.trim()) return toast('Write the update first.', true);
  if (blBlank(text)) return toast('Fill in every [blank] first.', true);
  if (close && !confirm('Post the update and close “' + t.title + '” in Salesforce?')) return;
  btn.disabled = true;
  const r = await post({ action: 'gcm.billAct', group: BILL.group.key, month: BILL.month, act: 'taskUpdate', task: id, text, notify: notify ? 'Y' : '', close: close ? 'Y' : '' });
  btn.disabled = false;
  toast(r.ok ? r.said : (r.error || 'Not posted'), !r.ok);
  if (!r.ok) return;
  DOOR.posted[id] = { closed: !!r.closed }; if (r.closed) t.open = false;
  const card = $('u-' + id); if (card) { card.outerHTML = dUCard(t, BILL.canAct !== false); const c2 = $('u-' + id); c2.querySelector('[data-upd]').onclick = e => dPostUpdate(id, e.currentTarget); c2.querySelector('[data-ucmt]').onclick = () => dMoreOnTask(id); }
  const tiles = $('dpanel').querySelector('.dtiles .act b'); if (tiles) tiles.textContent = DOOR.upd.tasks.filter(x => dUpdated(x.id)).length;
  dDrawStrip();
}
/** The task card from the review (its Chatter in full, the one-tap prompts, Comment for the team, Post for the group) under the update. */
function dMoreOnTask(id) {
  const box = $('uex-' + id); if (!box) return;
  if (box.innerHTML) { box.innerHTML = ''; return; }
  const t = (BILL.tasks || []).find(x => x.id === id); if (!t) { box.innerHTML = '<p class="small muted">This task is not on the month’s review.</p>'; return; }
  box.innerHTML = '<div class="items" style="margin-top:10px">' + blTaskCard(t) + '</div>';
  blBindTasks();
}

/* ── step 5: terminations and changes ── */
function dChanges() {
  const d = BILL, cnt = k => d.lines.reduce((n, o) => n + (o.bill ? (o.bill.findings || []).filter(f => f.kind === k).reduce((s, f) => s + ((f.members || []).length || 1), 0) : 0), 0);
  let h = '<h3 class="ptitle">Terminations, enrolments and changes</h3><p class="plead">What this month’s bills show against last month’s, and everything reported from the bills, the group’s page and this desk. Record a change to open the task for whoever acts on it, or fill Guardian’s own form from the record: EB0010 to terminate or change a member, GIO001 to enrol one, EASI Collect for the claim payment account.</p>';
  if (d.lines.some(o => o.bill)) h += '<div class="dtiles"><div class="dtile good"><b>' + cnt('joined') + '</b><span>joined since last month, on the bills</span></div><div class="dtile warn"><b>' + cnt('left') + '</b><span>came off the bills</span></div><div class="dtile"><b>' + cnt('moved') + '</b><span>changed tier or premium</span></div><div class="dtile act"><b>' + (d.changes || []).filter(c => /^(joiner|leaver|tier|dependent)$/.test(c.kind) && (c.effective || '').slice(0, 7) === d.month).length + '</b><span>recorded for ' + esc(d.monthLabel) + '</span></div></div>';
  h += blChangesHtml(d).replace(/^<h3 class="blsec">[\s\S]*?<\/h3>/, '');
  return h + dNav('changes');
}

/* ── step 6: the people ── */
function dPeople() {
  const d = BILL, P = DOOR.people, can = d.canAct !== false;
  let h = '<h3 class="ptitle">The people on the bills</h3><p class="plead">Everyone on the health and life bills, matched to their Salesforce record: their dependants, who turns 65 (the group cover ends and an individual plan is offered), which dependants reach the dependant age, who retires on the company pension within five years, and the records to put right. The group’s page shows counts only; the names stay here.</p>';
  if (!d.lines.some(o => o.bill && o.line !== 'listbill')) return h + '<div class="dnote">No health or life bill is uploaded for ' + esc(d.monthLabel) + ' yet. <button class="lnk" type="button" data-go="upload">Upload first</button></div>' + dNav('people');
  if (!P) return h + '<div class="dnote"><p class="muted" style="margin:0">Matching every member to Salesforce…</p></div>' + dNav('people');
  if (!P.ok) return h + '<div class="note bad">' + esc(P.error) + '</div>' + dNav('people');
  const c = P.counts;
  if (!P.salesforce) h += '<div class="note bad">Salesforce is not linked' + (P.sfError ? ': ' + esc(P.sfError) : '') + ', so nobody can be matched to a record.</div>';
  h += '<div class="dtiles"><div class="dtile"><b>' + c.members + '</b><span>on the bills</span></div><div class="dtile"><b>' + c.matched + '</b><span>matched to Salesforce</span></div><div class="dtile act"><b>' + c.convert + '</b><span>turning ' + P.convertAge + ': convert</span></div><div class="dtile act"><b>' + c.depAge + '</b><span>dependants reaching ' + P.depAge + '</span></div>' +
    (c.retire ? '<div class="dtile act"><b>' + c.retire + '</b><span>retiring within five years</span></div>' : '') + '<div class="dtile warn"><b>' + (c.over65 + c.depOver + c.tierDeps + c.tierSingle) + '</b><span>to check: age, tier, dependants</span></div><div class="dtile' + (c.nodob + c.nosf ? ' alert' : '') + '"><b>' + (c.nodob + c.nosf) + '</b><span>records to put right</span></div></div>';
  const sec = (title, lead, list, lvl) => list.length ? '<h3 class="blsec" style="margin-top:18px">' + title + ' <span class="muted small">' + list.length + '</span></h3><p class="small muted" style="margin:0 0 8px">' + lead + '</p>' + list.map(p => dPCard(p, lvl, can)).join('') : '';
  h += sec('To act on', 'A letter to the member, written for you and sent from support@ (to you, marked TEST, until the bills are live), or a task for whoever should call.', P.people.filter(p => p.flags.some(f => f.level === 'act')), 'act');
  h += sec('To check', 'What the bill and the record say differently.', P.people.filter(p => p.flags.some(f => f.level === 'check') && !p.flags.some(f => f.level === 'act')), 'check');
  h += sec('Records to put right', 'Nothing can be worked out for these until the record is right.', P.people.filter(p => p.flags.every(f => f.level === 'data') && p.flags.length), 'data');
  if (P.onRecord && P.onRecord.length) h += '<h3 class="blsec" style="margin-top:18px">On record, not on these bills <span class="muted small">' + P.onRecord.length + '</span></h3><p class="small muted" style="margin:0 0 8px">From the Group Milestones tab: the pension plans and anyone the bills do not carry.</p><ul class="feed">' + P.onRecord.map(r => '<li><b>' + esc(r.person) + '</b>' + (r.member ? ' (dependant of ' + esc(r.member) + ')' : '') + ' · ' + esc(({ convert65: 'turns ' + P.convertAge, dependent: 'dependant reaches ' + P.depAge, retire: 'retires' + (r.ownership ? ' on the ' + (r.ownership === 'Company' ? 'company' : 'personal') + ' pension' : ''), nodob: 'no date of birth on record' })[r.kind] || r.kind) + (r.date ? ' · ' + esc(dmy(r.date)) + (r.inDays != null ? ' (' + (r.inDays >= 0 ? 'in ' + r.inDays : Math.abs(r.inDays) + ' days ago') + (r.inDays >= 0 ? ' days' : '') + ')' : '') : '') + (r.task ? ' · ' + esc(r.task) : '') + (r.assumed ? ' · assumed age' : '') + '</li>').join('') + '</ul>';
  h += '<details class="hist" style="margin-top:14px"><summary>Everyone on the bills <span class="n">' + P.people.length + '</span></summary><div class="scroll"><table class="t small"><thead><tr><th>Member</th><th>Lines</th><th>Tier</th><th class="num">Age</th><th>Dependants on record</th><th>Record</th></tr></thead><tbody>' +
    P.people.map(p => '<tr><td><b>' + esc(p.name) + '</b></td><td>' + p.lines.map(l => esc(BL_LABEL[l] || l)).join(', ') + '</td><td>' + esc(p.tier || '–') + '</td><td class="num">' + (p.age == null ? '–' : p.age) + '</td><td>' + (p.deps.length ? p.deps.map(x => esc(x.name) + (x.rel ? ' (' + esc(String(x.rel).toLowerCase()) + (x.age != null ? ', ' + x.age : '') + ')' : '')).join(', ') : '–') + '</td><td>' + (p.sf ? '<span class="chip good"><i></i>matched</span>' : '<span class="chip bad"><i></i>no record</span>') + '</td></tr>').join('') + '</tbody></table></div></details>';
  return h + dNav('people');
}
function dLetterSent(kind, name) { return DOOR.letters[kind + '|' + name] || (BILL.changes || []).some(c => c.kind === 'letter' && c.note === kind && blSame(c.member, name)); }
const blSame = (a, b) => { const k = s => String(s || '').toLowerCase().replace(/[^a-z]/g, ''); const x = k(a), y = k(b); return !!x && (x === y || (String(a || '').split(/[\s,]+/).filter(Boolean).every(w => k(b).indexOf(k(w)) >= 0))); };
function dPCard(p, lvl, can) {
  const flags = lvl === 'act' ? p.flags : lvl === 'check' ? p.flags.filter(f => f.level !== 'act') : p.flags;
  const meta = [p.age != null ? p.age + ' years' : 'age unknown', p.gender, p.lines.map(l => BL_LABEL[l] || l).join(' and '), p.tier, p.deps.length ? p.deps.length + ' dependant' + (p.deps.length === 1 ? '' : 's') + ' on record: ' + p.deps.map(x => x.name + (x.rel ? ' (' + String(x.rel).toLowerCase() + (x.age != null ? ', ' + x.age : '') + ')' : '')).join(', ') : (p.sf ? 'no dependant on record' : ''), p.email].filter(Boolean);
  return '<article class="pcard"><h4>' + esc(p.name) + '</h4><div class="pm">' + meta.map(esc).join(' · ') + '</div>' + flags.map(f => {
    let acts = '';
    const line = p.lines[0] || 'health';
    if (can) {
      if (f.kind === 'convert' || f.kind === 'depage') { const sent = dLetterSent(f.kind, p.raw || p.name); acts += (sent ? '<span class="sent">Letter ' + (BILL.live ? 'sent' : 'sent as a test') + '</span>' : '') + '<button class="btn sm' + (sent ? ' ghost' : '') + '" type="button" data-letter="' + f.kind + '" data-member="' + esc(p.raw || p.name) + '" data-date="' + esc(f.date || '') + '" data-dep="' + esc(f.dep || '') + '" data-email="' + esc(p.email || '') + '" data-line="' + line + '">' + (sent ? 'Letter again' : 'Preview the letter') + '</button><button class="btn sm ghost" type="button" data-ptask="' + f.kind + '" data-member="' + esc(p.name) + '" data-line="' + line + '">Open a task</button>'; }
      else if (f.kind === 'nosf') acts += '<button class="btn sm" type="button" data-enrol="' + esc(p.name) + '">Enrol them: GIO001</button><button class="btn sm ghost" type="button" data-ptask="joiner" data-member="' + esc(p.name) + '" data-line="' + line + '">Open a task</button>';
      else if (f.kind === 'retire') acts += '<button class="btn sm ghost" type="button" data-ptask="other" data-member="' + esc(p.name) + '" data-line="' + line + '">Open a task</button>';
      else acts += '<button class="btn sm ghost" type="button" data-ptask="data" data-member="' + esc(p.name) + '" data-line="' + line + '">Open a task to put it right</button>';
    }
    return '<div class="pflag ' + esc(f.level) + '"><div class="ft">' + esc(f.text) + '</div><div class="fa">' + acts + '</div></div>';
  }).join('') + '</article>';
}
async function dLetter(ds) {
  const b = { action: 'gcm.billAct', group: BILL.group.key, line: ds.line || 'health', month: BILL.month, act: 'memberLetter', kind: ds.letter, member: ds.member, date: ds.date || '', dep: ds.dep || '', email: ds.email || '' };
  $('dlgT').textContent = (ds.letter === 'depage' ? 'A dependant coming of age' : 'Turning 65: the conversion letter') + ' · ' + blNice(ds.member);
  $('dlgB').innerHTML = '<p class="muted">Writing the letter…</p>';
  if (!dlg.open) dlg.showModal();
  const r = await post(b);
  if (!r.ok) { $('dlgB').innerHTML = '<div class="note bad">' + esc(r.error) + '</div>'; return; }
  $('dlgB').innerHTML = '<p class="to"><b>Subject:</b> ' + esc(r.subject) + '<br><b>To:</b> ' + (r.to ? esc(r.to) : '<span style="color:var(--badText)">no e-mail on the record</span>') + ' · ' + esc(r.said) + '</p>' +
    '<iframe title="The letter" sandbox="' + PV_SANDBOX + '" srcdoc="' + esc(pvHead + '<body style="margin:0;font-family:Arial,sans-serif">' + pvLinks(r.html)) + '"></iframe>' +
    '<div class="row"><button class="btn" type="button" id="dLetterSend"' + (!r.to && r.live ? ' disabled title="No e-mail on the record"' : '') + '>' + (r.live ? 'Send to the member from support@' : 'Send the test copy to me') + '</button><button class="btn ghost" type="button" id="dLetterX">Close</button></div>' +
    '<p class="small muted">Facts only, no advice: the group cover ends at the age and a licensed agent calls about the options. ' + (r.live ? 'It goes from support@ with sales support copied.' : 'The bills are in test mode, so it goes to you, marked TEST, and names who would get it.') + '</p>';
  $('dLetterX').onclick = () => dlg.close();
  $('dLetterSend').onclick = async () => {
    $('dLetterSend').disabled = true;
    const s = await post(Object.assign({}, b, { send: 'Y' }));
    toast(s.ok ? s.said : (s.error || 'Not sent'), !s.ok);
    if (s.ok) { DOOR.letters[ds.letter + '|' + ds.member] = true; dlg.close(); dDrawPanel(); } else $('dLetterSend').disabled = false;
  };
}

/* ── step 7: the statement of account ── */
function dStatement() {
  const d = BILL, S = DOOR.stmt;
  let h = '<h3 class="ptitle">The statement of account</h3><p class="plead">What the group owes, on one page: this month’s lines, the earlier invoices Salesforce still shows unpaid, what changed since last month, and what is attached. It goes inside the bill e-mail and as a PDF beside the bills when you press Send now, and in the billing-day run.</p>';
  if (!d.lines.some(o => o.bill)) return h + '<div class="dnote">No bill is uploaded for ' + esc(d.monthLabel) + ' yet. <button class="lnk" type="button" data-go="upload">Upload first</button></div>' + dNav('statement');
  if (!S) return h + '<div class="dnote"><p class="muted" style="margin:0">Writing the statement from the bills and Salesforce…</p></div>' + dNav('statement');
  if (!S.ok) return h + '<div class="note bad">' + esc(S.error) + '</div>' + dNav('statement');
  if (!S.data) return h + '<div class="dnote">' + esc(S.said) + '</div>' + dNav('statement');
  const t = S.data;
  h += '<div class="dtiles"><div class="dtile"><b>' + esc(blMoney(t.total)) + '</b><span>this month, ' + t.lines.length + ' line' + (t.lines.length === 1 ? '' : 's') + (t.dueBy ? ' · by ' + esc(dmy(t.dueBy)) : '') + '</span></div><div class="dtile' + (t.owedTotal ? ' alert' : ' good') + '"><b>' + esc(blMoney(t.owedTotal)) + '</b><span>still owed from ' + t.owed.length + ' earlier month' + (t.owed.length === 1 ? '' : 's') + ', per Salesforce</span></div><div class="dtile act"><b>' + esc(blMoney(t.grand)) + '</b><span>to bring the account up to date</span></div>' +
    (t.arrearsDiff || []).map(x => '<div class="dtile warn"><b>' + esc(blMoney(x.invoice)) + '</b><span>Head Office’s ' + esc(String(x.label).toLowerCase()) + ' invoice shows outstanding; Salesforce has ' + esc(blMoney(x.ours)) + '</span></div>').join('') + '</div>';
  if (t.owed.length) h += '<div class="scroll"><table class="t small sowed"><thead><tr><th>Earlier invoice</th><th class="num">Billed</th><th class="num">Received</th><th class="num">Still owed</th><th>Record</th></tr></thead><tbody>' + t.owed.map(o => '<tr><td>' + esc(o.label) + ' · ' + esc(o.monthLabel) + '</td><td class="num">' + esc(blMoney(o.billed)) + '</td><td class="num">' + (o.paid ? esc(blMoney(o.paid)) : '–') + '</td><td class="num bad">' + esc(blMoney(o.owed)) + '</td><td class="small">' + esc(o.status) + '</td></tr>').join('') + '</tbody></table></div>';
  else h += '<div class="dnote" style="border-left:4px solid var(--good)">Nothing is owed from earlier months in Salesforce.' + (t.invoiceOwed ? ' Head Office’s invoice still shows ' + esc(blMoney(t.invoiceOwed)) + ' outstanding: the arrears question on the Questions step settles which is right.' : '') + '</div>';
  h += '<p class="small muted">Changes on this billing: ' + (t.changes.joined || t.changes.left || t.changes.moved ? [t.changes.joined ? t.changes.joined + ' joined' : '', t.changes.left ? t.changes.left + ' left' : '', t.changes.moved ? t.changes.moved + ' changed tier or premium' : ''].filter(Boolean).map(esc).join(', ') : 'no one joined or left') + '. Attached with the bill: ' + (t.attachments.length ? esc(t.attachments.join('; ')) : 'nothing yet') + '.</p>';
  h += '<div class="uprow" style="margin:8px 0"><button class="btn ghost" type="button" id="dPdf">Download the PDF</button><button class="btn ghost" type="button" data-go="approve">Send it with the bill →</button></div>';
  h += '<iframe class="sframe" title="The statement of account as the group reads it" sandbox="' + PV_SANDBOX + '" srcdoc="' + esc(pvHead + '<body style="margin:0;font-family:Arial,sans-serif">' + pvLinks(S.html)) + '"></iframe>';
  return h + dNav('statement');
}
async function dPdf() {
  const b = $('dPdf'); b.disabled = true; b.textContent = 'Making the PDF…';
  const r = await api({ action: 'gcm.billStatement', group: BILL.group.key, month: BILL.month, pdf: 'Y' });
  b.disabled = false; b.textContent = 'Download the PDF';
  if (!r.ok || !r.pdf) return toast(r.ok ? 'The PDF could not be made on the server; the page above is the statement.' : (r.error || 'Not made'), true);
  const bin = atob(r.pdf), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u], { type: 'application/pdf' })); a.download = r.pdfName || 'Statement.pdf'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/* the bill e-mail as the group reads it: who it greets, who signs it, whom they rate (27 October 2026) */
async function dMail() {
  $('dlgT').textContent = 'The ' + BILL.monthLabel + ' bill e-mail, as the group reads it';
  $('dlgB').innerHTML = '<p class="muted">Writing the e-mail…</p>';
  if (!dlg.open) dlg.showModal();
  const r = await api({ action: 'gcm.billStatement', group: BILL.group.key, month: BILL.month, mail: 'Y' });
  if (!r.ok || !r.mail) { $('dlgB').innerHTML = '<div class="note bad">' + esc(r.ok ? 'This backend does not write the e-mail preview yet: paste GroupBilling.gs and publish a New version.' : (r.error || 'Not written')) + '</div>'; return; }
  const m = r.mail;
  $('dlgB').innerHTML = '<p class="to"><b>Subject:</b> ' + esc(m.subject) + '<br><b>To:</b> ' + (m.to ? esc(m.to) : '<span style="color:var(--badText)">no address: ' + esc(m.why || 'none on the register or in Salesforce') + '</span>') + (m.cc ? ' · <b>Cc:</b> ' + esc(m.cc) : '') +
    '<br><b>Greets:</b> ' + esc(m.greet) + (m.named ? '' : ' <span class="chip warn"><i></i>no contact name in Salesforce: add the Contact Person on the account, or a Greeting on the register</span>') +
    '<br><b>Signed by:</b> ' + esc(m.signer) + (m.carer ? ' · <b>Rated:</b> ' + esc(m.carer) + ', who looks after the account' : '') + '</p>' +
    (r.live ? '' : '<p class="small muted">Sending is in test mode, so the bill goes to you, marked TEST, until gblGoLive.</p>') +
    '<iframe title="The bill e-mail" sandbox="' + PV_SANDBOX + '" srcdoc="' + esc(pvHead + '<body style="margin:0;font-family:Arial,sans-serif">' + pvLinks(m.html)) + '"></iframe>' +
    '<div class="row"><button class="btn ghost" type="button" id="dMailX">Close</button></div>';
  $('dMailX').onclick = () => dlg.close();
}

/* ── step 8: approve and send ── */
function dApprove() {
  const d = BILL, can = d.canAct !== false, withBill = d.lines.filter(o => o.bill);
  let h = '<h3 class="ptitle">Approve and send</h3><p class="plead">A reconciled line goes by itself on the billing day once it is approved, or now with Send now, which works only on an approved bill. After the 10:00 cut-off, Approve and Send now each ask why it was not done by then. The e-mail carries the bill, the statement of account (inline and as a PDF) and the cover note, from support@ with sales support copied.</p>';
  h += blDayStrip(d.day, d.live);
  if (withBill.length) h += '<div class="dnote dmail"><div><b>The e-mail the group gets</b><span class="small muted"> · addressed to their contact by name, signed by the person who looks after the account, with the sign-in to comment on any line and five stars to rate that person.</span></div><button class="btn ghost sm" type="button" id="dMail">See the e-mail as the group reads it</button></div>';
  if (!d.live) h += '<div class="note info"><div><b>Sending is in test mode.</b> A bill sent from here goes to you and the branch, marked TEST, until the branch manager runs gblGoLive in the script editor. Everything else is live: the checks, the Salesforce fixes, the tasks and the Chatter.</div></div>';
  if (!withBill.length) h += '<div class="dnote">No bill is uploaded for ' + esc(d.monthLabel) + ' yet. <button class="lnk" type="button" data-go="upload">Upload first</button></div>';
  d.lines.forEach(o => {
    const b = o.bill, s = o.steps;
    h += '<section class="bline" id="line-' + o.line + '"><div class="blt"><h3>' + esc(o.label) + '</h3>' + blSteps(s) + '</div>';
    if (!b) { h += '<p class="small muted">No bill uploaded for ' + esc(d.monthLabel) + (o.sf && o.sf.rec ? ', though Salesforce bills this line this month' : '') + '.</p></section>'; return; }
    h += '<div class="sfrow">' + (b.reconciledAt ? '<span class="chip good"><i></i>Reconciled ' + esc(b.reconciledAt) + ' by ' + esc(b.reconciledBy) + '</span>' : s.fixes ? '<span class="chip bad"><i></i>' + s.fixes + ' finding' + (s.fixes === 1 ? '' : 's') + ' to fix first</span>' : '<span class="chip warn"><i></i>Not reconciled yet</span>') +
      (b.sentAt ? '<span class="chip good"><i></i>Sent ' + esc(b.sentAt) + '</span>' : '') + '<span class="chip"><i style="background:var(--bar)"></i>' + esc(blMoney(b.due)) + ' for ' + b.members + ' ' + (o.line === 'listbill' ? 'policies' : 'members') + '</span>' + (b.files ? '<span class="chip"><i style="background:var(--bar)"></i>' + esc(b.files) + '</span>' : '') + '</div>';
    if (s.fixes && !b.reconciledAt) h += '<p class="small">Fix or resolve the findings marked fix on <button class="lnk" type="button" data-go="findings">What was found</button> first' + (d.role === 'branch' ? '. As branch manager you may reconcile over them' : '') + '.</p>';
    if (can) h += '<div class="blacts">' + (!b.reconciledAt ? '<button class="btn' + (s.fixes ? ' ghost' : '') + '" type="button" data-rec="' + o.line + '"' + (s.fixes && d.role !== 'branch' ? ' disabled title="Fix or resolve the findings marked fix first"' : '') + '>Mark reconciled</button>' : '') +
      blApproveActs(o, b, s, d) + blSendBtn(o, b, s, d) +
      '<button class="btn ghost" type="button" data-pay="' + o.line + '">Record a payment</button></div>';
    h += blHistory(o) + '</section>';
  });
  return h + dNav('approve');
}

/* opened signed in already: straight in */
if (AUTH.code) open_();
