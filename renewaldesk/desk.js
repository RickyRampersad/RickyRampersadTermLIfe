/* The renewal desk (29 October 2026). "when Pawan logs in and selects the month and year, he can select the risks, motor,
 * home, pl etc … so any person can help him, then it pulls up last year and guides the renewal process".
 *
 * Everything comes from GIRenewals.gs at request time (gcm.renList, gcm.renOne, gcm.renNoticeFind, gcm.renNoticePdf,
 * gcm.renPreview, gcm.renAct), behind the group client management sign-in (the same two localStorage keys, which the
 * branch app's sso.js fills). Guardian General's notice is read here with pdf.js and girread.js and confirmed by a
 * person before it is saved. No client data lives in this file. */
const SVC = 'https://script.google.com/macros/s/AKfycbxdW5mVcK6DZbq4qnCj1l1cJvjsTYWZ9UMH91H6yC_NrElNYpGd1vRyJH1W_1mcu61woQ/exec';
const PDFJS = { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dmy = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : ''; };
const money = n => 'TT$' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const whole = n => 'TT$' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const STAGE_N = { due: 1, notice: 2, drafted: 3, approval: 4, sent: 5, changes: 6, approved: 7, instructed: 8, confirmed: 9, delivered: 10, done: 11, renewed: 11, lost: 12 };
const STAGE_TONE = { due: 'dim', notice: '', drafted: '', approval: 'vio', sent: 'warn', changes: 'bad', approved: 'ok', instructed: 'vio', confirmed: 'ok', delivered: 'ok', done: 'ok', renewed: 'ok', lost: 'dim' };
let AUTH = { code: '', who: '' }, LIST = null, ONE = null, STEP = 0, NOTICE_DRAFT = null;
let F = { month: '', line: '', tile: '', q: '' };
try { AUTH.code = localStorage.getItem('rrb-gcm-code') || ''; AUTH.who = localStorage.getItem('rrb-gcm-who') || ''; } catch (e) {}
try { const f = JSON.parse(localStorage.getItem('rrb-gir-view') || 'null'); if (f) { F.line = f.line || ''; F.tile = f.tile || ''; } } catch (e) {}
const keepView = () => { try { localStorage.setItem('rrb-gir-view', JSON.stringify({ line: F.line, tile: F.tile })); } catch (e) {} };

function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.className = 'toast', bad ? 9000 : 4500); }
async function api(params) {
  const q = Object.entries(Object.assign({}, params, { code: AUTH.code, who: AUTH.who })).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  try { const txt = await (await fetch(SVC + '?' + q + '&z=' + Date.now())).text(); try { return JSON.parse(txt); } catch (e) { return { ok: false, error: 'The branch backend is not answering for renewals yet: GIRenewals.gs and GroupClients.gs need pasting and a New version publishing.' }; } }
  catch (e) { return { ok: false, error: 'Could not reach the branch backend. Check the connection and try again.' }; }
}
async function post(body) {
  try { const txt = await (await fetch(SVC, { method: 'POST', body: JSON.stringify(Object.assign({}, body, { code: AUTH.code, who: AUTH.who })) })).text(); try { return JSON.parse(txt); } catch (e) { return { ok: false, error: 'The backend answered with a page instead of data.' }; } }
  catch (e) { return { ok: false, error: 'Could not reach the branch backend.' }; }
}
const act = (a, extra) => post(Object.assign({ action: 'gcm.renAct', key: ONE.r.key, act: a }, extra || {}));

/* ── months ── */
function ymNow(add) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + (add || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function ymAdd(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
const ymLabel = ym => { const [y, m] = ym.split('-').map(Number); return MONL[m - 1] + ' ' + y; };

/* ── the gate ── */
$('gate').addEventListener('submit', e => { e.preventDefault(); AUTH = { code: $('gCode').value.trim(), who: $('gWho').value.trim() }; start(); });
async function start() {
  const hk = decodeURIComponent((location.hash || '').slice(1));
  const km = /\|(\d{4}-\d{2})$/.exec(hk);
  F.month = new URL(location.href).searchParams.get('m') || (km ? km[1] : ymNow(1));
  const go = $('gGo'), err = $('gErr');
  if (go) { go.disabled = true; go.textContent = 'Opening… reading Salesforce'; }
  const d = await api({ action: 'gcm.renList', month: F.month });
  if (!d.ok) {
    if (!$('gate')) { location.reload(); return; }
    err.textContent = d.error || 'Not opened.'; go.disabled = false; go.textContent = 'Sign in'; return;
  }
  try { localStorage.setItem('rrb-gcm-code', AUTH.code); localStorage.setItem('rrb-gcm-who', AUTH.who); } catch (e) {}
  LIST = d; head();
  if (km) openOne(hk); else drawList();
}
function signOut() { try { localStorage.removeItem('rrb-gcm-code'); localStorage.removeItem('rrb-gcm-who'); } catch (e) {} location.href = location.pathname; }
function head() {
  const me = (LIST || ONE || {}).me || {};
  $('who').innerHTML = '<b>' + esc(me.name || '') + '</b>' + esc(me.title || '') + (me.approver ? ' · approves letters' : '') +
    '<br><button type="button" onclick="document.getElementById(\'help\').showModal()">How it works</button> · <button type="button" onclick="signOut()">Sign out</button>';
}
function testBanner(d) {
  return d.live ? '' : '<div class="banner test"><b>Test mode.</b> Letters, reminders and instructions go to you and the test inbox, marked TEST. Salesforce is written only when you tick it on a step. The branch manager switches it live.</div>';
}

/* ── the month ── */
async function loadMonth(ym) {
  F.month = ym;
  history.replaceState(null, '', location.pathname + '?m=' + ym);
  $('main').innerHTML = '<div class="card empty">Reading ' + esc(ymLabel(ym)) + ' from Salesforce…</div>';
  const d = await api({ action: 'gcm.renList', month: ym });
  if (!d.ok) { $('main').innerHTML = '<div class="card empty">' + esc(d.error || 'Not read.') + ' <button class="btn ghost sm" onclick="loadMonth(F.month)">Try again</button></div>'; return; }
  LIST = d; drawList();
}
const TILES = [['all', 'Renewing'], ['mine', 'Yours'], ['noLetter', 'No letter yet'], ['waiting', 'Waiting on the client'], ['approved', 'Client said yes'], ['instructed', 'With Guardian General'], ['done', 'Done'], ['late', 'Behind'], ['noEmail', 'No e-mail']];
function tileMatch(r, t) {
  if (!t || t === 'all') return true;
  if (t === 'mine') return r.mine;
  if (t === 'noLetter') return ['due', 'notice', 'drafted', 'approval'].includes(r.stage);
  if (t === 'waiting') return ['sent', 'changes'].includes(r.stage);
  if (t === 'approved') return r.stage === 'approved';
  if (t === 'instructed') return ['instructed', 'confirmed'].includes(r.stage);
  if (t === 'done') return ['delivered', 'done', 'renewed'].includes(r.stage);
  if (t === 'late') return r.late;
  if (t === 'noEmail') return !r.email;
  return true;
}
function drawList() {
  ONE = null;
  if (location.hash) history.replaceState(null, '', location.pathname + '?m=' + F.month);
  const d = LIST, opts = [];
  for (let i = -2; i <= 4; i++) { const ym = ymAdd(ymNow(0), i); opts.push('<option value="' + ym + '"' + (ym === d.month ? ' selected' : '') + '>' + ymLabel(ym) + '</option>'); }
  if (!opts.some(o => o.indexOf('"' + d.month + '"') >= 0)) opts.push('<option value="' + d.month + '" selected>' + ymLabel(d.month) + '</option>');
  const q = F.q.trim().toLowerCase();
  const rows = d.rows.filter(r => (!F.line || r.line === F.line) && tileMatch(r, F.tile) && (!q || (r.client + ' ' + r.policy + ' ' + r.what + ' ' + (r.holder || '')).toLowerCase().indexOf(q) >= 0));
  const lines = d.lines.filter(l => l.n);
  $('main').innerHTML = testBanner(d) +
    '<div class="mbar"><h1>Renewals in ' + esc(d.monthLabel) + '</h1><div class="mnav">' +
      '<button class="btn ghost sm" type="button" aria-label="Month before" onclick="loadMonth(ymAdd(F.month,-1))">‹</button>' +
      '<label class="sr" for="mSel" style="position:absolute;left:-9999px">Month</label><select class="field" id="mSel" onchange="loadMonth(this.value)">' + opts.join('') + '</select>' +
      '<button class="btn ghost sm" type="button" aria-label="Month after" onclick="loadMonth(ymAdd(F.month,1))">›</button></div></div>' +
    '<div class="tiles">' + TILES.map(([k, l]) => '<button type="button" class="tile' + (F.tile === k || (!F.tile && k === 'all') ? ' on' : '') + (k === 'late' && d.tiles.late ? ' alert' : '') + (k === 'done' ? ' good' : '') + (k === 'instructed' ? ' vio' : '') +
      '" onclick="F.tile=\'' + k + '\';keepView();drawList()"><b>' + (d.tiles[k] || 0) + '</b><span>' + l + '</span></button>').join('') + '</div>' +
    '<div class="chips"><button type="button" class="chip' + (!F.line ? ' on' : '') + '" onclick="F.line=\'\';keepView();drawList()">Every line<span class="n">' + d.rows.length + '</span></button>' +
      lines.map(l => '<button type="button" class="chip' + (F.line === l.k ? ' on' : '') + '" onclick="F.line=\'' + l.k + '\';keepView();drawList()">' + esc(l.label) + '<span class="n">' + l.n + '</span></button>').join('') + '</div>' +
    '<input class="field search" id="q" type="search" placeholder="Search a client, policy or vehicle" value="' + esc(F.q) + '" aria-label="Search">' +
    '<div class="rows">' + (rows.length ? rows.map(rowHtml).join('') : '<div class="card empty">' + (d.rows.length ? 'Nothing matches. <button class="btn ghost sm" type="button" onclick="F.tile=\'\';F.line=\'\';F.q=\'\';keepView();drawList()">Show every renewal</button>' : 'No Guardian General renewals in Salesforce for ' + esc(d.monthLabel) + '.') + '</div>') + '</div>' +
    '<p class="muted small" style="margin-top:16px">Read from Salesforce: every Guardian General cover term ending in ' + esc(d.monthLabel) + ', and any with no end date that began a year before. ' + (d.mail ? '' : 'Microsoft 365 is not set up, so nothing can go from support@. ') + (d.ai ? '' : 'AI drafts are not set up. ') + '</p>';
  const qi = $('q'); qi.oninput = () => { F.q = qi.value; const p = qi.selectionStart; drawList(); const n = $('q'); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
}
function rowHtml(r) {
  const n = STAGE_N[r.stage] || 1, pctDone = r.stage === 'lost' ? 100 : Math.round(Math.min(11, n) / 11 * 100), dd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.ren);
  const flags = [r.late ? '<span class="pill bad">Behind</span>' : '', !r.email ? '<span class="pill bad">No e-mail</span>' : '', r.noEnd ? '<span class="pill warn">No end date in Salesforce</span>' : '',
    r.answer === 'changes' ? '<span class="pill bad">Asked for changes</span>' : '', r.ownerActive === false ? '<span class="pill warn">Owner has left</span>' : '', r.mine ? '<span class="pill">Yours</span>' : ''].join('');
  return '<button type="button" class="row" onclick="openOne(\'' + esc(r.key) + '\')"><div class="day' + (r.late ? ' late' : '') + '"><b>' + (dd ? +dd[3] : '') + '</b><span>' + (dd ? MON[+dd[2] - 1] : '') + '</span></div>' +
    '<div class="rt"><h3>' + esc(r.client) + '</h3><div class="sub">' + esc(r.lineLabel) + ' · ' + esc(r.policy) + ' · ' + esc(r.what) + '</div>' +
    '<div class="flags"><span class="pill ' + (STAGE_TONE[r.stage] || '') + '">' + esc(r.stageLabel) + '</span>' + flags + '</div><div class="bar"><i style="width:' + pctDone + '%"></i></div></div>' +
    '<div class="rr"><div class="p">' + (r.newTotal ? money(r.newTotal) : money(r.lastPremium)) + '</div><div class="muted">' + (r.newTotal ? 'was ' + money(r.lastPremium) : 'last year') + '</div>' +
    '<div class="muted">' + (r.days === null ? '' : r.days < 0 ? Math.abs(r.days) + ' days ago' : r.days === 0 ? 'today' : 'in ' + r.days + ' days') + '</div><div class="muted">' + esc(r.holder || 'Nobody yet') + '</div></div></button>';
}

/* ── one renewal ── */
const STEPS = ['Last year', 'Notice', 'Values', 'Letter', 'Approve', 'Client', 'Proceed', 'Guardian General', 'Delivered'];
function stepNow(o) {
  const s = o.stage;
  if (s === 'renewed' || s === 'lost' || s === 'done') return 0;
  if (!o.notice) return o.holder ? 1 : 0;   /* nobody has it yet: open on last year */
  if (!o.letter || s === 'notice' || s === 'drafted') return 3;
  if (s === 'approval') return 4;
  if (s === 'sent' || s === 'changes') return 5;
  if (s === 'approved') return 6;
  if (s === 'instructed' || s === 'confirmed') return 7;
  return 8;
}
function stepDone(o, i) {
  const n = STAGE_N[o.stage] || 1;
  return [true, !!o.notice, Object.keys(o.values || {}).length > 0 || n >= 5, n >= 4 && !!o.letter, n >= 5 && n !== 12, n >= 7 && n !== 12, n >= 8 && n !== 12 && !!o.proceed, n >= 9 && n !== 12, n >= 10 && n !== 12][i];
}
async function openOne(key, keepStep) {
  history.replaceState(null, '', location.pathname + '?m=' + F.month + '#' + encodeURIComponent(key));
  if (!keepStep) $('main').innerHTML = '<div class="card empty">Opening the renewal: last year, the history and the claims from Salesforce…</div>';
  const d = await api({ action: 'gcm.renOne', key });
  if (!d.ok) { $('main').innerHTML = '<div class="card empty">' + esc(d.error || 'Not opened.') + ' <button class="btn ghost sm" type="button" onclick="backToList()">Back to the month</button></div>'; return; }
  ONE = d; if (!LIST) head();
  if (!keepStep) STEP = stepNow(d);
  drawOne();
}
async function backToList() { if (!LIST || LIST.month !== F.month) await loadMonth(F.month); else drawList(); }
function drawOne() {
  const d = ONE, r = d.r;
  const days = d.days === null ? '' : d.days < 0 ? 'renewed ' + Math.abs(d.days) + ' days ago' : d.days === 0 ? 'renews today' : 'renews in ' + d.days + ' days';
  const take = d.holder ? '<span class="pill">' + esc(d.holder) + ' has it</span>' + (d.holder !== d.me.name ? ' <button class="btn ghost sm" type="button" onclick="doAct(\'take\')">Take it over</button>' : '') : '<button class="btn sm" type="button" onclick="doAct(\'take\')">Take it</button>';
  $('main').innerHTML = testBanner(d) +
    '<p><button class="btn ghost sm" type="button" onclick="backToList()">‹ ' + esc(ymLabel(F.month)) + '</button></p>' +
    '<div class="dtop"><div><h1>' + esc(r.client) + '</h1><div class="sub">' + esc(r.lineLabel) + ' · ' + esc(r.policy) + ' · ' + esc(dmy(r.ren)) + ', ' + esc(days) + '</div>' +
      '<div class="flags" style="margin-top:8px"><span class="pill ' + (STAGE_TONE[d.stage] || '') + '">' + esc(d.stageLabel) + '</span>' + (d.test && d.sentAt ? '<span class="pill warn">Letter sent in test mode</span>' : '') + '</div></div>' +
      '<div class="acts" style="margin:0">' + take + (d.sfUrl && r.trans[0] ? ' <a class="btn ghost sm" target="_blank" rel="noopener" href="' + esc(d.sfUrl + r.trans[0]) + '">Last year in Salesforce</a>' : '') + '</div></div>' +
    (d.stage === 'renewed' ? '<div class="banner info"><b>Already renewed in Salesforce.</b> A newer term for this policy begins ' + esc(dmy(r.newer && r.newer.from)) + '. Nothing to do here unless the desk should still write to the client.</div>' : '') +
    (d.stage === 'lost' ? '<div class="banner info"><b>Not renewing.</b> ' + esc(d.outcome) + '</div>' : '') +
    '<ol class="steps">' + STEPS.map((s, i) => '<li><button type="button" class="step' + (stepDone(d, i) ? ' done' : '') + '"' + (STEP === i ? ' aria-current="step"' : '') + ' onclick="STEP=' + i + ';drawOne()"><span class="n">' + (stepDone(d, i) && STEP !== i ? '✓' : i + 1) + '</span><span class="t">' + s + '</span></button></li>').join('') + '</ol>' +
    '<div class="two"><div class="card panel" id="panel">' + panel(STEP) + '</div><div>' + sideHtml() + '</div></div>' +
    '<div class="card"><h2 style="font-size:1.1rem;margin-bottom:6px">Every step so far</h2>' + (d.log.length ? '<ul class="log">' + d.log.map(l => '<li><b>' + esc(l.at) + '</b> · ' + esc(l.step) + ' · ' + esc(l.by) + (l.detail ? ' · <span class="muted">' + esc(l.detail) + '</span>' : '') + '</li>').join('') + '</ul>' : '<p class="muted">Nothing yet.</p>') +
    '<div class="acts">' + (d.stage !== 'lost' && d.stage !== 'done' ? '<button class="btn warn sm" type="button" onclick="lost()">The client is not renewing</button>' : '') + '</div></div>';
  wire(STEP);
}
function sideHtml() {
  const d = ONE;
  return '<div class="card"><h2 style="font-size:1.1rem;margin-bottom:8px">What the record says</h2><div class="ins">' +
    (d.insights.length ? d.insights.map(i => '<div class="in ' + i.level + '"><span class="lv">' + ({ act: 'Act', check: 'Check', good: 'In their favour', note: 'Note' }[i.level] || '') + '</span><b>' + esc(i.title) + '</b>' + esc(i.text) + '</div>').join('') : '<p class="muted">Nothing stands out.</p>') + '</div></div>' +
    '<div class="card"><h2 style="font-size:1.1rem;margin-bottom:6px">The client</h2><p style="margin:0">' + esc(d.r.contact.name || d.r.client) + '<br><span class="muted">' + esc(d.email || 'No e-mail on file') + (d.r.contact.mobile ? ' · ' + esc(d.r.contact.mobile) : '') + '</span></p>' +
    '<p class="muted small">Account owner: ' + esc(d.r.owner.name || 'not set') + (d.r.owner.active === false ? ' (no longer active)' : '') + '</p>' +
    '<label class="l" for="em">E-mail for the letter</label><div style="display:flex;gap:6px"><input class="field" id="em" type="email" value="' + esc(d.email) + '"><button class="btn ghost sm" type="button" onclick="setEmail()">Save</button></div>' +
    (d.tasks.length ? '<h3 style="font-size:.95rem;margin:14px 0 4px">Open tasks</h3><ul class="small" style="padding-left:18px;margin:0">' + d.tasks.map(t => '<li>' + (d.sfUrl ? '<a target="_blank" rel="noopener" href="' + esc(d.sfUrl + t.id) + '">' + esc(t.subject) + '</a>' : esc(t.subject)) + ' <span class="muted">· ' + esc(t.owner) + (t.due ? ', due ' + esc(dmy(t.due)) : '') + '</span></li>').join('') + '</ul>' : '') + '</div>';
}

/* ── the panels ── */
function panel(i) {
  const d = ONE, r = d.r;
  if (i === 0) {
    const max = Math.max(1, ...d.history.years.map(y => y.premium || 0));
    return '<h2>Last year, and since the policy began</h2><p class="lead">What renews, as it stands in Salesforce.</p>' +
      '<div class="tw"><table class="t"><thead><tr><th>What renews</th><th>Cover</th><th class="n">Value or sum</th><th class="n">Premium</th></tr></thead><tbody>' +
      r.items.map(x => '<tr><td><b>' + esc(itemLabel(x)) + '</b>' + (x.assignee ? '<br><span class="muted small">Bank: ' + esc(x.assignee) + '</span>' : '') + (x.noEnd ? '<br><span class="pill warn">No end date</span>' : '') + '</td><td>' + esc(x.coverage || '') + (x.ncd ? '<br><span class="muted small">NCD ' + esc(x.ncd) + '</span>' : '') + '</td><td class="n">' + (x.value || x.cover ? whole(x.value || x.cover) : '') + '</td><td class="n">' + money(x.total) + '<br><span class="muted small">' + esc(dmy(x.from)) + ' to ' + esc(dmy(x.to)) + '</span></td></tr>').join('') +
      '</tbody></table></div>' +
      historyHtml(d, max) +
      '<div class="acts"><button class="btn" type="button" onclick="STEP=1;drawOne()">Next: Guardian General\'s notice</button></div>';
  }
  if (i === 1) {
    const n = d.notice;
    return '<h2>Guardian General\'s renewal notice</h2><p class="lead">The new premium is on Guardian General\'s notice: a PDF on their reminder in support@. The desk reads it; you check the figures and save.</p>' +
      (n ? '<div class="banner info"><b>Saved by ' + esc(n.by) + ', ' + esc(n.at) + ':</b> ' + money(n.total) + ' tax included, ' + esc(dmy(n.from)) + ' to ' + esc(dmy(n.to)) + (n.tranId ? ' · Tran Id ' + esc(n.tranId) : '') + '. Read another to replace it.</div>' : '') +
      '<div class="acts"><button class="btn" type="button" id="nFind">Find it in support@</button><label class="btn ghost" for="nFile" style="cursor:pointer">Upload the PDF</label><input id="nFile" type="file" accept="application/pdf" hidden><button class="btn ghost" type="button" id="nType">Type the figures</button></div>' +
      '<div id="nFound" class="found"></div><div id="nForm"></div>';
  }
  if (i === 2) {
    const n = d.notice || {};
    return '<h2>The values</h2><p class="lead">From 45 days before the renewal, the client confirms each vehicle\'s value or the sums insured. Type the figure they give; leave it blank to keep last year\'s. They can also change it themselves on their renewal page.</p>' +
      r.items.map(x => { const nn = (n.items || []).find(v => v.reg && x.vehicle && v.reg.replace(/\W/g, '') === x.vehicle.replace(/\W/g, '')), v = (d.values || {})[x.id];
        return '<div class="pt"><b>' + esc(itemLabel(x)) + '</b><div class="grid2 small" style="margin:6px 0"><span>Last year: <b>' + (x.value || x.cover ? whole(x.value || x.cover) : '–') + '</b></span>' + (nn && nn.value ? '<span>Guardian General\'s notice: <b>' + whole(nn.value) + '</b></span>' : '') + (v ? '<span>Confirmed: <b>' + whole(v.value) + '</b> (' + esc(v.by || '') + ')</span>' : '') + '</div>' +
          '<label class="l" for="v_' + esc(x.id) + '">Confirmed value</label><input class="field" inputmode="decimal" id="v_' + esc(x.id) + '" data-id="' + esc(x.id) + '" placeholder="' + esc(String(Math.round(x.value || x.cover || 0))) + '" value="' + (v ? Math.round(v.value) : '') + '"></div>'; }).join('') +
      '<div class="acts"><button class="btn" type="button" id="vSave">Save the values</button><button class="btn ghost" type="button" onclick="STEP=3;drawOne()">Next: the letter</button></div>';
  }
  if (i === 3) {
    const L = d.letter;
    if (!d.notice) return '<h2>The letter</h2><p class="lead">Read Guardian General\'s notice first: the letter states the new premium.</p><div class="acts"><button class="btn" type="button" onclick="STEP=1;drawOne()">Go to the notice</button></div>';
    return '<h2>The renewal letter</h2><p class="lead">It carries the items, the premium this year and last, the history since the policy began, the documents Guardian General needs and the button to approve. You write the personal part: <i>Draft with AI</i> writes it from the record. Read every word.</p>' +
      '<div class="acts"><button class="btn vio" type="button" id="lAi"' + (d.ai ? '' : ' disabled title="AI drafts are not set up"') + '>Draft with AI</button><button class="btn ghost" type="button" id="lPlain">Start from the plain letter</button><button class="btn ghost" type="button" id="lPrev"' + (L ? '' : ' disabled') + '>See it as the client will</button></div>' +
      (L ? '<label class="l" for="lOpen">Opening</label><textarea class="field" id="lOpen">' + esc(L.opening) + '</textarea>' +
        '<label class="l">Worth a look before they approve (up to six)</label><div id="lPts">' + (L.points || []).map(ptHtml).join('') + '</div><button class="btn ghost sm" type="button" id="lAdd">Add a point</button>' +
        '<label class="l" for="lClose">Closing</label><textarea class="field" id="lClose" style="min-height:60px">' + esc(L.closing) + '</textarea>' +
        '<p class="muted small">' + (L.ai ? 'Drafted with AI by ' : 'Written by ') + esc(L.by || '') + (L.at ? ', ' + esc(L.at) : '') + '. A [blank] left in stops the save.</p>' +
        '<div class="acts"><button class="btn" type="button" id="lSave">Save the letter</button><button class="btn teal" type="button" id="lSubmit"' + (d.stage === 'approval' ? ' disabled' : '') + '>' + (d.stage === 'approval' ? 'Waiting for approval' : 'Save and send for approval') + '</button></div><div id="lPv"></div>' : '<p class="muted">No letter yet.</p>');
  }
  if (i === 4) {
    const can = d.me.approver, L = d.letter;
    return '<h2>Approve and send</h2><p class="lead">The branch manager or the Branch Manager\'s Assistant approves every letter: its points are advice. It goes from support@, at least 21 days before the renewal, with sales support copied. The renewal task opens on last year\'s record.</p>' +
      (d.sentAt ? '<div class="banner info"><b>Sent ' + esc(d.sentAt) + '</b> to ' + esc(d.sentTo) + (d.test ? ' (test)' : '') + ', approved by ' + esc(d.approvedBy) + '.</div>' : '') +
      (!L ? '<p class="muted">No letter yet.</p>' : d.stage !== 'approval' && !d.sentAt ? '<p>' + (d.submittedBy ? 'Sent back to ' + esc(d.submittedBy) + '.' : 'Not sent for approval yet.') + '</p><div class="acts"><button class="btn" type="button" onclick="STEP=3;drawOne()">Go to the letter</button></div>' :
        (d.stage === 'approval' ? '<p>' + esc(d.submittedBy) + ' sent it for approval.</p><div class="acts"><button class="btn ghost" type="button" id="aPrev">Read the letter</button></div><div id="aPv"></div>' +
          (can ? '<p class="small">It goes to <b>' + esc(d.email || 'no e-mail on file') + '</b>' + (d.live ? '' : ' (test mode: to you and the test inbox instead)') + '.</p>' + (d.live ? '' : '<label class="tickrow"><input type="checkbox" id="aSf"> Open the renewal task in Salesforce too (only for a renewal that is really going ahead)</label>') +
            '<div class="acts"><button class="btn teal" type="button" id="aGo"' + (d.email ? '' : ' disabled') + '>Approve and send</button></div><label class="l" for="aWhy">Or send it back, saying what to change</label><textarea class="field" id="aWhy" style="min-height:60px"></textarea><div class="acts"><button class="btn ghost" type="button" id="aBack">Send it back</button></div>'
            : '<p class="muted">Waiting for the branch manager or the Branch Manager\'s Assistant.</p>') : ''));
  }
  if (i === 5) {
    const a = d.answer, rem = d.reminders || {};
    return '<h2>The client\'s answer</h2><p class="lead">They sign in with a code to their e-mail, see their renewal and its history since the policy began, and approve, ask for changes, or write. It comes onto the renewal task\'s Chatter. Reminders go at 14 and 10 days; at 7 with no answer, call them. Nothing renews without their yes.</p>' +
      (!d.sentAt ? '<p class="muted">The letter has not gone yet.</p>' : '') +
      (a ? '<div class="ans"><b>' + ({ approve: 'Approved', changes: 'Asked for changes', '': 'Wrote to us' }[a.decision || ''] || esc(a.decision)) + '</b> · ' + esc(a.at) + (a.name ? ' · ' + esc(a.name) : '') + (a.comment ? '<p style="margin:6px 0 0">“' + esc(a.comment) + '”</p>' : '') +
        (a.values && Object.keys(a.values).length ? '<p class="small" style="margin:6px 0 0">New values: ' + Object.keys(a.values).map(id => { const x = d.r.items.find(z => z.id === id); return esc(x ? itemLabel(x) : id) + ' ' + whole(a.values[id]); }).join('; ') + '</p>' : '') +
        ((a.history || []).length ? '<details class="small"><summary>Earlier</summary><ul>' + a.history.map(h => '<li>' + esc(h.at) + ' · ' + esc(h.name || '') + ': ' + esc(h.text || '') + '</li>').join('') + '</ul></details>' : '') + '</div>' : (d.sentAt ? '<p>No answer yet.</p>' : '')) +
      (d.sentAt ? '<p class="small muted">Reminders: ' + (['r14', 'r10', 'call'].map(k => rem[k] ? ({ r14: '14 days', r10: '10 days', call: 'call at 7 days' }[k]) + ' ' + esc(rem[k].at) : '').filter(String).join(' · ') || 'none yet') + '</p>' : '') +
      '<label class="l" for="pYes">They said yes on the phone, by e-mail or in person</label><textarea class="field" id="pYes" style="min-height:60px" placeholder="Who said yes, how, and when"></textarea><div class="acts"><button class="btn ghost" type="button" id="pYesGo">Record their yes</button></div>' +
      '<label class="l" for="cm">A comment on the renewal task\'s Chatter</label><textarea class="field" id="cm" style="min-height:60px"></textarea><div class="acts"><button class="btn ghost" type="button" id="cmGo">Post it</button></div>' +
      (a && a.decision === 'approve' ? '<div class="acts"><button class="btn teal" type="button" onclick="STEP=6;drawOne()">Next: proceed to renew</button></div>' : '');
  }
  if (i === 6) {
    const yes = d.answer && d.answer.decision === 'approve';
    if (d.proceed) return '<h2>Proceed to renew</h2><div class="banner info"><b>Instructed ' + esc(d.proceed.at) + '</b> by ' + esc(d.proceed.by) + ' to ' + esc(d.proceed.to) + '.<br>' + esc(d.proceed.subject) + '</div>' + sfDone(d.proceed);
    return '<h2>Proceed to renew</h2><p class="lead">One press does all of it.</p><ul>' +
      '<li>' + tick(yes) + ' The client said yes' + (yes ? ' (' + esc(d.answer.name || '') + ', ' + esc(d.answer.at) + ')' : '') + '</li><li>' + tick(!!d.notice) + ' Guardian General\'s notice is read' + (d.notice ? ': ' + money(d.notice.total) : '') + '</li></ul>' +
      '<p>Then, in Salesforce: a new billing record for the year, a cover term for each item with the confirmed values and the notice\'s dates, a follow-up task on the new record, and the delivery in the driver\'s calendar the working day before the renewal. The instruction goes to Guardian General\'s renewals team with support@ and sales support copied.</p>' +
      (d.live ? '' : '<label class="tickrow"><input type="checkbox" id="pSf"> Write Salesforce too (only for a renewal that is really going ahead). In test mode the instruction goes to you and the test inbox.</label>') +
      '<div class="acts"><button class="btn teal" type="button" id="pGo"' + (yes && d.notice ? '' : ' disabled') + '>Proceed to renew</button></div>';
  }
  if (i === 7) {
    const p = d.proceed;
    if (!p) return '<h2>Guardian General</h2><p class="muted">Nothing has gone to Guardian General yet.</p>';
    return '<h2>Guardian General</h2><p class="lead">No reply in two working days: the desk follows up with the trail, every two working days, and posts it on the follow-up task. Their "ready" moves the delivery to the next working day.</p>' +
      '<div class="banner info">Instruction ' + esc(p.at) + ' to ' + esc(p.to) + '</div>' +
      (d.chases.length ? '<ul class="small">' + d.chases.map(c => '<li>Follow-up ' + c.n + ' · ' + esc(c.at) + ' · ' + esc(c.by) + '</li>').join('') + '</ul>' : '<p class="muted small">No follow-ups yet.</p>') +
      (d.ggReply ? '<div class="ans"><b>' + (d.ggReply.ready ? 'Ready' : 'Replied') + '</b> · ' + esc(d.ggReply.at) + (d.ggReply.from ? ' · ' + esc(d.ggReply.from) : '') + '<br>' + esc(d.ggReply.subject) + '</div>' : '') +
      '<div class="acts"><button class="btn ghost" type="button" id="gChase">Send a follow-up now</button></div>' +
      '<label class="l" for="gTxt">Guardian General answered (if the desk did not see it)</label><input class="field" id="gTxt" placeholder="What they said"><label class="tickrow"><input type="checkbox" id="gReady"> The documents are ready</label><div class="acts"><button class="btn ghost" type="button" id="gMark">Save</button></div>';
  }
  if (i === 8) {
    return '<h2>Delivered and paid</h2><p class="lead">The schedule and certificates collected at Endeavour and delivered, and the premium paid.</p>' +
      (d.delivered ? '<div class="ans"><b>Delivered</b> · ' + esc(d.delivered) + '</div>' : '<label class="l" for="dTxt">Delivered: to whom, where</label><input class="field" id="dTxt"><div class="acts"><button class="btn" type="button" id="dGo">Mark delivered</button></div>') +
      (d.paid ? '<div class="ans"><b>Paid</b> · ' + esc(d.paid) + '</div>' : '<label class="l" for="pdTxt">Paid: receipt number and how</label><input class="field" id="pdTxt"><div class="acts"><button class="btn" type="button" id="pdGo">Mark paid</button></div>');
  }
  return '';
}
const tick = b => b ? '<span class="pill ok">Done</span>' : '<span class="pill bad">Not yet</span>';
function sfDone(p) {
  const base = ONE.sfUrl, link = (id, l) => id ? (base ? '<a target="_blank" rel="noopener" href="' + esc(base + id) + '">' + l + '</a>' : l) : '';
  return p.trans ? '<p>In Salesforce: ' + [link(p.trans, 'the new billing record'), (p.risks || []).filter(String).length + ' cover term(s)', link(p.follow, 'the follow-up task'), link(p.event, 'the delivery')].filter(String).join(' · ') + '</p>' : '<p class="muted">Salesforce was not written (test mode).</p>';
}
/* ── the whole history: every year since the policy began, newest first, each a fold ── */
function historyHtml(d, max) {
  const H = d.history, ys = H.years || [], S = H.summary;
  if (!ys.length) return '<h3 style="margin:16px 0 4px;font-size:1rem">Since the policy began</h3><p class="muted">No earlier terms in Salesforce.</p>' + claimsAll(d);
  const tiles = S ? '<div class="tiles" style="margin-top:14px">' +
    tileH(dmy(S.since).replace(/^\d+ /, ''), 'with us since') + tileH(S.terms, S.terms === 1 ? 'term' : 'terms') +
    tileH(whole(S.paid), 'paid since ' + (S.since || '').slice(0, 4)) +
    tileH(S.claims, (S.claims === 1 ? 'claim' : 'claims') + ' · ' + S.clean + ' of ' + S.terms + ' years with none') +
    (S.payDays !== null ? tileH(S.payDays + ' days', 'usual time to pay after the renewal' + (S.paidLate ? ' · late ' + S.paidLate + ' time' + (S.paidLate === 1 ? '' : 's') : '')) : '') +
    (S.owed > 1 ? tileH(whole(S.owed), 'still owed on the record', 'bad') : '') + '</div>' : '';
  const gaps = (H.gaps || []).length ? '<p class="muted small">Salesforce did not give the ' + esc(H.gaps.join(', ')) + ' this time; the rest is complete.</p>' : '';
  return '<h3 style="margin:16px 0 4px;font-size:1rem">Since the policy began</h3>' + tiles +
    '<h4 class="sub">The premium, year by year</h4><div class="hist">' + ys.map(y => '<div class="hb"><b>' + y.year + '</b><div class="tr"><i style="width:' + Math.max(3, Math.round((y.premium || 0) / max * 100)) + '%"></i></div><div class="v">' + money(y.premium) + '<span class="ch">' + (y.change === null ? 'first year' : (y.change > 0 ? '+' : '') + y.change + '%') + '</span></div></div>').join('') + '</div>' +
    (H.vehicles.length ? '<h4 class="sub">Each vehicle\'s value over the years</h4><div class="tw"><table class="t"><thead><tr><th>Vehicle</th>' + yearsHead() + '</tr></thead><tbody>' + H.vehicles.map(v => '<tr><td><b>' + esc(v.reg) + '</b> <span class="muted">' + esc(v.desc) + '</span></td>' + yearsCells(v) + '</tr>').join('') + '</tbody></table></div>' : '') +
    '<h4 class="sub">Every year, newest first</h4>' + ys.slice().reverse().map((y, i) => yearFold(d, y, i === 0)).join('') + gaps + claimsAll(d);
}
function tileH(v, label, tone) { return '<div class="tile' + (tone ? ' ' + tone : '') + '" style="cursor:default"><b>' + esc(String(v)) + '</b><span>' + esc(label) + '</span></div>'; }
function yearFold(d, y, open) {
  const billed = sum(y.bills, 'billed'), paid = sum(y.bills, 'paid'), owed = sum(y.bills, 'owed'), first = y.bills.map(b => b.firstPaid).filter(Boolean).sort()[0];
  const chips = [];
  if (!y.bills.length) chips.push('<span class="pill dim">No billing record</span>');
  else if (owed > 1) chips.push('<span class="pill bad">Owed ' + money(owed) + '</span>');
  else if (paid) chips.push('<span class="pill ok">Paid' + (first ? ' ' + esc(dmy(first)) : '') + '</span>');
  else chips.push('<span class="pill warn">No payment recorded</span>');
  chips.push(y.claims.length ? '<span class="pill warn">' + y.claims.length + ' claim' + (y.claims.length === 1 ? '' : 's') + '</span>' : '<span class="pill dim">No claims</span>');
  const rt = (y.tasks || []).filter(t => t.renewal);
  if (rt.length) chips.push(rt.some(t => !t.closed) ? '<span class="pill vio">Renewal task open</span>' : '<span class="pill">Renewal task closed</span>');
  if (y.desk) chips.push('<span class="pill">Renewal desk: ' + esc(deskWord(y.desk)) + '</span>');
  const sf = id => d.sfUrl ? '<a target="_blank" rel="noopener" href="' + esc(d.sfUrl + id) + '">' : '', sfe = () => d.sfUrl ? '</a>' : '';
  const body =
    '<div><h4>What was insured</h4><div class="tw"><table class="t"><thead><tr><th>Item</th><th class="n">Value or sum</th><th class="n">Premium</th></tr></thead><tbody>' +
      y.risks.map(k => '<tr><td>' + esc(k.label) + '</td><td class="n">' + (k.value ? whole(k.value) : '–') + '</td><td class="n">' + money(k.premium) + '</td></tr>').join('') + '</tbody></table></div></div>' +
    '<div><h4>Billed and paid</h4>' + (y.bills.length ? y.bills.map(b => '<p class="small" style="margin:2px 0">' + sf(b.id) + esc(b.name || 'Billing record') + sfe() + (b.ren ? ' · renewal ' + esc(dmy(b.ren)) : '') + ' · billed <b>' + money(b.billed) + '</b> · paid <b>' + money(b.paid) + '</b>' + (b.owed > 1 ? ' · <b style="color:var(--bad)">owed ' + money(b.owed) + '</b>' : '') + '</p>' +
      (b.pays.length ? '<ul class="small" style="margin:2px 0 6px;padding-left:18px">' + b.pays.map(p => '<li>' + esc(dmy(p.on)) + ' · ' + money(p.amount) + (p.how ? ' · ' + esc(p.how) : '') + '</li>').join('') + '</ul>' + (b.lateDays !== null ? '<p class="muted small" style="margin:0 0 6px">First payment ' + b.lateDays + ' days ' + (b.lateDays < 0 ? 'before' : 'after') + ' the renewal.</p>' : '') : '<p class="muted small" style="margin:0 0 6px">No payment recorded on it.</p>')).join('') : '<p class="muted small">No billing record linked to this term.</p>') + '</div>' +
    '<div><h4>Claims in this term</h4>' + (y.claims.length ? '<ul class="small" style="margin:0;padding-left:18px">' + y.claims.map(c => '<li>' + esc(dmy(c.on)) + ' · ' + esc(c.type) + (c.vehicle ? ' · ' + esc(c.vehicle) : '') + ' · ' + esc(c.status) + (c.paid ? ' · paid ' + money(c.paid) : '') + '</li>').join('') + '</ul>' : '<p class="muted small">None.</p>') + '</div>' +
    ((y.tasks || []).length ? '<div><h4>Tasks on this year\'s billing</h4>' + y.tasks.map(t => '<div class="tk"><p class="small" style="margin:0"><b>' + sf(t.id) + esc(t.subject) + sfe() + '</b><br><span class="muted">' + esc(t.owner) + ' · opened ' + esc(dmy(t.opened)) + (t.closed ? ' · closed ' + esc(dmy(t.closedOn)) : ' · ' + esc(t.status) + (t.due ? ', due ' + esc(dmy(t.due)) : '')) + ' · ' + t.notes + ' note' + (t.notes === 1 ? '' : 's') + '</span></p>' +
      t.last.map(n => '<div class="nt"><i>' + esc(n.by) + ', ' + esc(dmy(n.on)) + '</i>' + esc(n.text) + '</div>').join('') + '</div>').join('') + '</div>' : '') +
    (y.desk ? '<div><h4>On the renewal desk</h4><p class="small" style="margin:0">' + esc(deskLine(y.desk)) + '</p></div>' : '');
  return '<details class="yr"' + (open ? ' open' : '') + '><summary><span class="y">' + y.year + '</span><span class="d">' + esc(dmy(y.from)) + ' to ' + esc(dmy(y.to)) + (y.policies.length ? ' · ' + esc(y.policies.join(', ')) : '') + '</span>' +
    '<span class="p">' + money(y.premium) + (y.change !== null ? ' <span class="muted small">' + (y.change > 0 ? '+' : '') + y.change + '%</span>' : '') + '</span><span class="c">' + chips.join(' ') + '</span></summary><div class="yb">' + body + '</div></details>';
}
function sum(a, k) { return (a || []).reduce((x, y) => x + (Number(y[k]) || 0), 0); }
function deskWord(x) { return x.outcome === 'lost' ? 'not renewed' : x.proceedAt ? 'instructed' : x.answer === 'approve' ? 'client said yes' : x.sentAt ? 'letter sent' : 'started'; }
function deskLine(x) { return [x.sentAt ? 'Letter sent ' + x.sentAt + (x.test ? ' (test)' : '') : 'No letter sent', x.answer ? 'client: ' + ({ approve: 'approved', changes: 'asked for changes', question: 'asked a question' }[x.answer] || x.answer) : '', x.proceedAt ? 'instructed ' + x.proceedAt : '', x.outcome === 'lost' ? 'not renewed' : ''].filter(Boolean).join(' · ') + '.'; }
function claimsAll(d) {
  const extra = d.history.summary ? d.history.summary.claimsBefore : d.claims.length;
  if (!d.claims.length) return '<p class="muted small">No claims on record for this policy or its vehicles.</p>';
  return '<details class="small" style="margin-top:8px"><summary>Every claim on record (' + d.claims.length + ')' + (extra ? ', ' + extra + ' before these terms' : '') + '</summary><ul style="padding-left:18px">' + d.claims.map(c => '<li>' + esc(dmy(c.on)) + ' · ' + esc(c.type) + (c.vehicle ? ' · ' + esc(c.vehicle) : '') + ' · ' + esc(c.status) + (c.paid ? ' · paid ' + money(c.paid) : '') + '</li>').join('') + '</ul></details>';
}
function yearsHead() { const ys = [...new Set(ONE.history.vehicles.flatMap(v => v.years.map(y => y.year)))].sort(); return ys.map(y => '<th class="n">' + y + '</th>').join(''); }
function yearsCells(v) { const ys = [...new Set(ONE.history.vehicles.flatMap(w => w.years.map(y => y.year)))].sort(); return ys.map(y => { const h = v.years.find(z => z.year === y); return '<td class="n">' + (h && h.value ? whole(h.value) : '–') + '</td>'; }).join(''); }
function itemLabel(x) {
  if (x.vehicle) return [x.year, x.make, x.model].filter(Boolean).join(' ') + ' (' + x.vehicle + ')';
  if (x.location) return x.location + (x.sums && x.sums.length ? ': ' + x.sums.map(s => s.label + ' ' + whole(s.value)).join(', ') : '');
  if (x.cats && x.cats.length) return x.cats.map(c => [c.cat, c.model].filter(Boolean).join(' ') + (c.value ? ' ' + whole(c.value) : '')).join('; ');
  return x.coverage || x.name || 'Cover';
}
const ptHtml = p => '<div class="pt"><input class="field" data-pt="t" value="' + esc(p.title || '') + '" placeholder="A short title" aria-label="Point title"><textarea class="field" data-pt="x" style="min-height:60px;margin-top:6px" aria-label="Point text">' + esc(p.text || '') + '</textarea><button class="btn ghost sm" type="button" onclick="this.parentNode.remove()" style="margin-top:6px">Remove</button></div>';

/* ── the presses ── */
async function doAct(a, extra, msgOk) {
  const r = await act(a, extra);
  if (!r.ok) { toast(r.error || 'Not saved.', true); return r; }
  toast(r.said || msgOk || 'Saved.');
  await openOne(ONE.r.key, true);
  return r;
}
async function setEmail() { await doAct('email', { email: $('em').value.trim() }); }
async function lost() {
  const why = prompt('Why is the client not renewing? In their words if you have them.');
  if (why === null) return;
  await doAct('lost', { text: why });
}
function letterFromForm() {
  return { opening: $('lOpen').value.trim(), closing: $('lClose').value.trim(),
    points: [...document.querySelectorAll('#lPts .pt')].map(p => ({ title: p.querySelector('[data-pt="t"]').value.trim(), text: p.querySelector('[data-pt="x"]').value.trim() })).filter(p => p.title || p.text) };
}
async function preview(where) {
  const box = $(where); box.innerHTML = '<p class="muted">Putting the letter together…</p>';
  const r = await api({ action: 'gcm.renPreview', key: ONE.r.key });
  if (!r.ok) { box.innerHTML = '<p class="err">' + esc(r.error || 'No preview.') + '</p>'; return; }
  box.innerHTML = '<p class="small muted" style="margin-top:12px">Subject: <b>' + esc(r.subject) + '</b></p><iframe class="sframe" title="The letter as the client reads it" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>';
  box.querySelector('iframe').srcdoc = '<!doctype html><meta charset="utf-8"><base target="_blank"><body style="margin:0;padding:12px;background:#f1f4f8">' + r.html;
}
function wire(i) {
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  if (i === 1) {
    on('nFind', findNotice); on('nType', () => noticeForm(ONE.notice || { policy: ONE.r.policy, items: [], reqs: [] }, null));
    $('nFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; readPdf(await f.arrayBuffer(), f.name); };
  }
  if (i === 2) on('vSave', async () => { const v = {}; document.querySelectorAll('[data-id]').forEach(el => { const n = Number(el.value.replace(/[^0-9.]/g, '')); if (n > 0) v[el.dataset.id] = n; }); if (!Object.keys(v).length) { toast('Type at least one value.', true); return; } await doAct('values', { values: v }); });
  if (i === 3) {
    on('lAi', async () => { const b = $('lAi'); b.disabled = true; b.textContent = 'Drafting… about 20 seconds'; await doAct('draft', { ai: 'Y' }); });
    on('lPlain', async () => { if (ONE.letter && !confirm('Replace the letter with the plain one?')) return; await doAct('draft', {}); });
    on('lPrev', () => preview('lPv'));
    on('lAdd', () => { if (document.querySelectorAll('#lPts .pt').length >= 6) { toast('Six points at most.', true); return; } $('lPts').insertAdjacentHTML('beforeend', ptHtml({})); });
    on('lSave', () => doAct('letter', { letter: letterFromForm() }));
    on('lSubmit', async () => { const s = await act('letter', { letter: letterFromForm() }); if (!s.ok) { toast(s.error, true); return; } await doAct('submit'); });
  }
  if (i === 4) {
    on('aPrev', () => preview('aPv'));
    on('aGo', async () => { const b = $('aGo'); b.disabled = true; b.textContent = 'Sending…'; await doAct('approve', { writeSf: $('aSf') && $('aSf').checked ? 'Y' : '' }); });
    on('aBack', () => doAct('reject', { text: $('aWhy').value.trim() }));
  }
  if (i === 5) { on('pYesGo', () => doAct('phoneYes', { text: $('pYes').value.trim() })); on('cmGo', () => doAct('comment', { text: $('cm').value.trim() })); }
  if (i === 6) on('pGo', async () => { if (!confirm('Proceed to renew ' + ONE.r.policy + '?')) return; const b = $('pGo'); b.disabled = true; b.textContent = 'Instructing… about 30 seconds'; await doAct('proceed', { writeSf: $('pSf') && $('pSf').checked ? 'Y' : '' }); });
  if (i === 7) { on('gChase', () => doAct('chase')); on('gMark', () => doAct('ggReply', { text: $('gTxt').value.trim(), ready: $('gReady').checked ? 'Y' : '' })); }
  if (i === 8) { on('dGo', () => doAct('delivered', { text: $('dTxt').value.trim() })); on('pdGo', () => doAct('paid', { text: $('pdTxt').value.trim() })); }
}

/* ── the notice ── */
async function findNotice() {
  const box = $('nFound'); box.innerHTML = '<p class="muted">Looking in support@ for ' + esc(ONE.r.policy) + '…</p>';
  const r = await api({ action: 'gcm.renNoticeFind', key: ONE.r.key, policy: ONE.r.policy });
  if (!r.ok) { box.innerHTML = '<p class="err">' + esc(r.error) + '</p>'; return; }
  if (!r.found.length) { box.innerHTML = '<p>No notice for ' + esc(ONE.r.policy) + ' in support@ yet. Ask CRMS Renewals for it, or upload the PDF.</p>'; return; }
  box.innerHTML = r.found.map((f, k) => '<div class="fd"><div><b>' + esc(f.name) + '</b><br><span class="muted small">' + esc(f.at) + ' · ' + esc(f.from) + ' · ' + esc(f.subject) + '</span></div><button class="btn sm" type="button" data-k="' + k + '">Read it</button></div>').join('');
  box.querySelectorAll('button[data-k]').forEach(b => b.onclick = async () => {
    const f = r.found[+b.dataset.k]; b.disabled = true; b.textContent = 'Reading…';
    const p = await api({ action: 'gcm.renNoticePdf', msg: f.msg, att: f.att });
    if (!p.ok) { toast(p.error, true); b.disabled = false; b.textContent = 'Read it'; return; }
    const bin = atob(p.b64), u = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
    readPdf(u.buffer, f.name);
  });
}
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = PDFJS.src; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS.worker; ok(); }; s.onerror = () => no(new Error('The PDF reader did not load.')); document.head.appendChild(s); });
}
async function readPdf(buf, name) {
  $('nForm').innerHTML = '<p class="muted">Reading ' + esc(name) + '…</p>';
  try { await loadPdfJs(); const n = GirRead.parse(await GirRead.text(buf)); n.source = { name }; noticeForm(n, name); }
  catch (e) { $('nForm').innerHTML = '<p class="err">' + esc(e.message || e) + ' Type the figures instead.</p>'; }
}
function noticeForm(n, name) {
  NOTICE_DRAFT = n;
  const items = n.items || [], other = n.key && n.key !== ONE.r.key.split('|')[0] && GirRead.polKey(n.replaces || '') !== ONE.r.key.split('|')[0];
  $('nForm').innerHTML = '<div class="pt" style="background:#fff">' + (name ? '<p class="small muted">Read from <b>' + esc(name) + '</b>. Check every figure against the PDF before you save.</p>' : '') +
    ((n.warnings || []).length ? '<div class="banner test">' + n.warnings.map(esc).join('<br>') + '</div>' : '') +
    (other ? '<div class="banner test">This notice is for <b>' + esc(n.policy) + '</b>, not ' + esc(ONE.r.policy) + '.<label class="tickrow"><input type="checkbox" id="nOther"> It replaces the old policy number</label></div>' : '') +
    '<div class="grid2"><div><label class="l" for="nPol">Policy number</label><input class="field" id="nPol" value="' + esc(n.policy || '') + '"></div><div><label class="l" for="nTran">Tran Id</label><input class="field" id="nTran" value="' + esc(n.tranId || '') + '"></div>' +
    '<div><label class="l" for="nFrom">From</label><input class="field" type="date" id="nFrom" value="' + esc(n.from || '') + '"></div><div><label class="l" for="nTo">To</label><input class="field" type="date" id="nTo" value="' + esc(n.to || '') + '"></div>' +
    '<div><label class="l" for="nPrem">Premium</label><input class="field" inputmode="decimal" id="nPrem" value="' + (n.premium || '') + '"></div><div><label class="l" for="nTax">Tax</label><input class="field" inputmode="decimal" id="nTax" value="' + (n.tax || '') + '"></div>' +
    '<div><label class="l" for="nTot">Total, tax included</label><input class="field" inputmode="decimal" id="nTot" value="' + (n.total || '') + '"></div></div>' +
    (items.length ? '<h3 style="font-size:.95rem;margin:14px 0 4px">What the notice lists</h3><div class="tw"><table class="t"><thead><tr><th>Item</th><th class="n">Value</th><th class="n">Premium</th></tr></thead><tbody>' + items.map((x, k) => '<tr><td>' + esc(x.reg ? x.reg + ' ' + (x.desc || '') : x.location || x.type || x.desc || 'Item') + '</td><td class="n"><input class="field" style="min-width:7rem" data-iv="' + k + '" value="' + (x.value || '') + '" aria-label="Value"></td><td class="n">' + (x.premium ? money(x.premium) : '') + '</td></tr>').join('') + '</tbody></table></div>' : '') +
    '<label class="l" for="nReqs">What Guardian General needs with the renewal (one a line)</label><textarea class="field" id="nReqs" style="min-height:70px">' + esc((n.reqs || []).join('\n')) + '</textarea>' +
    '<div class="acts"><button class="btn" type="button" id="nSave">Save the notice</button></div></div>';
  $('nSave').onclick = async () => {
    const num = id => Number(($(id).value || '').replace(/[^0-9.]/g, '')) || 0;
    const out = Object.assign({}, NOTICE_DRAFT, { policy: $('nPol').value.trim(), key: GirRead.polKey($('nPol').value), tranId: $('nTran').value.trim(), from: $('nFrom').value, to: $('nTo').value,
      premium: num('nPrem'), tax: num('nTax'), total: num('nTot'), reqs: $('nReqs').value.split('\n').map(s => s.trim()).filter(String) });
    out.items = (NOTICE_DRAFT.items || []).map((x, k) => { const el = document.querySelector('[data-iv="' + k + '"]'); return Object.assign({}, x, { value: el ? Number(el.value.replace(/[^0-9.]/g, '')) || 0 : x.value }); });
    const r = await act('notice', { notice: out, confirmOther: $('nOther') && $('nOther').checked ? 'Y' : '' });
    if (!r.ok) { toast(r.error, true); return; }
    toast(r.said); STEP = 2; await openOne(ONE.r.key, true);
  };
}

/* ── start: signed in already (here, in group client management, or in the branch app) ── */
window.addEventListener('hashchange', () => { const k = decodeURIComponent(location.hash.slice(1)); const km = /\|(\d{4}-\d{2})$/.exec(k); if (LIST && km && (!ONE || ONE.r.key !== k)) { F.month = km[1]; openOne(k); } });
if (AUTH.code) { $('gWho').value = AUTH.who; start(); }
