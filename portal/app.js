/* ============================================================
   BRANCH PORTAL — views
   Recruits see their own journey. Managers see their recruits.
   Same login box; the account decides which app you get.
   ============================================================ */
(function () {
'use strict';

const $  = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const MODULES = window.DISCOVERY_MODULES;
const STAGES  = window.STAGES;
const GUIDE   = window.STAGE_GUIDE;
const SCALE   = window.SESSION_SCALE;

const ALL_SESSIONS = MODULES.flatMap(m => m.sessions.map(s => ({ ...s, moduleId: m.id, moduleTitle: m.title })));
const sessionById = id => ALL_SESSIONS.find(s => s.id === id);
const moduleById  = id => MODULES.find(m => m.id === id);
const stageIndex  = k => Math.max(0, STAGES.findIndex(s => s.key === k));

let STATE = { token: null, person: null, data: null, detail: null, openModule: null, openSession: null };

const fmtDate = iso => !iso ? '—' : new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
const fmtWhen = iso => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return d + ' days ago';
  return fmtDate(iso);
};
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/* ============================================================
   SESSION STATUS — one place, so recruit and manager agree
   ============================================================ */
function statusOf(sessionId, progress, submissions) {
  const p = (progress || []).find(x => x.sessionId === sessionId);
  const s = (submissions || []).filter(x => x.sessionId === sessionId)
              .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
  if (p && p.completedAt) return { key:'complete', label:'Complete', p, s };
  if (s)                  return { key:'submitted', label:'Submitted — with your manager', p, s };
  if (p && p.dueAt && new Date(p.dueAt) < new Date()) return { key:'overdue', label:'Overdue', p, s };
  if (p && p.assignedAt)  return { key:'active', label:'In progress', p, s };
  return { key:'locked', label:'Not started', p, s };
}

function moduleProgress(mod, progress, submissions) {
  const done = mod.sessions.filter(x => statusOf(x.id, progress, submissions).key === 'complete').length;
  return { done, total: mod.sessions.length, pct: Math.round(done / mod.sessions.length * 100) };
}

function overallProgress(progress, submissions) {
  const done = ALL_SESSIONS.filter(s => statusOf(s.id, progress, submissions).key === 'complete').length;
  return { done, total: ALL_SESSIONS.length, pct: Math.round(done / ALL_SESSIONS.length * 100) };
}

/* ============================================================
   LOGIN
   ============================================================ */
function showLogin(msg) {
  $('app').hidden = true;
  $('login').hidden = false;
  $('loginErr').textContent = msg || '';
  $('loginErr').classList.toggle('on', !!msg);
  if (!window.API.live) $('demoNote').hidden = false;
}

async function doLogin(ev) {
  ev.preventDefault();
  const btn = $('loginBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const r = await window.API.login($('email').value, $('pin').value);
    STATE.token = r.token; STATE.person = r.person;
    try { sessionStorage.setItem('rrb-portal', JSON.stringify(r)); } catch (e) {}
    await boot();
  } catch (err) {
    showLogin(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}

function signOut() {
  try { sessionStorage.removeItem('rrb-portal'); } catch (e) {}
  STATE = { token:null, person:null, data:null, detail:null, openModule:null, openSession:null };
  $('email').value = ''; $('pin').value = '';
  showLogin('');
}

async function boot() {
  $('login').hidden = true;
  $('app').hidden = false;
  $('who').textContent = STATE.person.name;
  $('whoRole').textContent = STATE.person.role === 'recruit' ? 'Recruit' :
    ({ BM:'Branch Manager', RM:'Recruiting Manager', BMA:'Branch Manager’s Assistant' })[STATE.person.role] || STATE.person.role;
  $('view').innerHTML = '<div class="loading">Loading your file…</div>';
  try {
    if (STATE.person.role === 'recruit') {
      STATE.data = (await window.API.recruitDashboard(STATE.token)).data;
      renderRecruit();
    } else {
      STATE.data = (await window.API.managerDashboard(STATE.token)).data;
      renderManagerList();
    }
  } catch (err) {
    $('view').innerHTML = '<div class="empty"><b>Could not load.</b><p>' + esc(err.message) + '</p></div>';
  }
}

/* ============================================================
   RECRUIT VIEW
   ============================================================ */
function renderRecruit() {
  const d = STATE.data;
  const r = d.recruit;
  const si = stageIndex(r.stage);
  const g = GUIDE[r.stage] || {};
  const prog = overallProgress(d.progress, d.submissions);
  const inDiscovery = si >= stageIndex('discovery');

  const due = ALL_SESSIONS
    .map(s => ({ s, st: statusOf(s.id, d.progress, d.submissions) }))
    .filter(x => x.st.key === 'active' || x.st.key === 'overdue');

  $('view').innerHTML = `
    <section class="hero-card">
      <div class="hero-top">
        <div>
          <div class="eyebrow">${esc(r.ref || 'Your file')} · ${r.track === 'experienced' ? 'Experienced track' : 'New to the industry'}</div>
          <h1>${esc(d.person.name)}</h1>
          <p class="sub">With the branch ${plural(r.daysSinceStart ?? 0, 'day')} · ${plural(r.daysInStage ?? 0, 'day')} at this step
            · Your manager is ${esc(r.rmName || 'being assigned')}</p>
        </div>
        ${inDiscovery ? `<div class="ring" role="img" aria-label="Discovery ${prog.pct} percent complete">
          <svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="52"/>
            <circle class="ring-fg" cx="60" cy="60" r="52"
              style="stroke-dasharray:${2*Math.PI*52};stroke-dashoffset:${2*Math.PI*52*(1-prog.pct/100)}"/></svg>
          <div class="ring-val"><b>${prog.pct}%</b><span>Discovery</span></div>
        </div>` : ''}
      </div>

      <ol class="stagebar">
        ${STAGES.map((s, i) => `<li class="${i < si ? 'past' : i === si ? 'now' : ''}">
          <span class="dot"></span><span class="nm">${esc(s.label)}</span></li>`).join('')}
      </ol>

      <div class="nowbox">
        <div class="nowlabel">Where you are</div>
        <h3>${esc(STAGES[si].recruitLabel)}</h3>
        ${g.next ? `<p><b>What happens next.</b> ${esc(g.next)}</p>` : ''}
        ${g.you  ? `<p><b>What you do.</b> ${esc(g.you)}</p>` : ''}
      </div>
    </section>

    ${due.length ? `<section>
      <div class="sec-label">Due now</div>
      <div class="duelist">
        ${due.map(x => `<button class="dueitem ${x.st.key === 'overdue' ? 'late' : ''}" data-open="${esc(x.s.id)}">
          <span class="d-mod">${esc(moduleById(x.s.moduleId).title)}</span>
          <span class="d-title">${esc(x.s.title)}</span>
          <span class="d-meta">${esc(x.s.duration)}${x.st.p && x.st.p.dueAt ? ' · due ' + fmtDate(x.st.p.dueAt) : ''}</span>
          <span class="d-go">${x.st.key === 'overdue' ? 'Overdue — submit debrief' : 'Submit debrief'} →</span>
        </button>`).join('')}
      </div>
    </section>` : ''}

    ${inDiscovery ? `<section>
      <div class="sec-label">Discovery — ${prog.done} of ${prog.total} sessions complete</div>
      <p class="sec-sub">Six modules, about seven weeks. Real activity, not classroom work. After every session you submit a debrief here; your manager reads it, scores it, and releases the feedback to you.</p>
      <div class="modlist">${MODULES.map(m => recruitModule(m, d)).join('')}</div>
    </section>` : `<section>
      <div class="sec-label">Discovery</div>
      <div class="empty"><b>Not yet.</b><p>Discovery opens once your assessment review is done. Six modules over about seven weeks — you will see every session here when it starts.</p></div>
    </section>`}

    ${d.scores.length ? `<section>
      <div class="sec-label">Your scores</div>
      <p class="sec-sub">Only scores your manager has released. Nothing is hidden from you that has been decided.</p>
      <div class="scoregrid">${d.scores.map(s => `<div class="scorecard">
        <div class="s-val">${esc(s.value)}${s.max ? `<span>/${esc(s.max)}</span>` : ''}</div>
        <div class="s-lab">${esc(s.label)}</div>
        ${s.band ? `<div class="s-band">${esc(s.band)}</div>` : ''}
        <div class="s-when">Updated ${esc(fmtWhen(s.updatedAt))}</div>
      </div>`).join('')}</div>
    </section>` : ''}

    ${d.timeline.length ? `<section>
      <div class="sec-label">Everything so far</div>
      <ol class="timeline">${d.timeline.slice().reverse().map(e => `<li>
        <span class="t-when">${esc(fmtDate(e.at))}</span>
        <span class="t-what">${esc(e.detail || e.type)}</span>
        <span class="t-who">${esc(e.actor)}</span></li>`).join('')}</ol>
    </section>` : ''}
  `;

  $('view').querySelectorAll('[data-open]').forEach(b =>
    b.onclick = () => openDebrief(b.getAttribute('data-open')));
  $('view').querySelectorAll('[data-mod]').forEach(b =>
    b.onclick = () => { STATE.openModule = STATE.openModule === b.getAttribute('data-mod') ? null : b.getAttribute('data-mod'); renderRecruit(); });
}

function recruitModule(m, d) {
  const mp = moduleProgress(m, d.progress, d.submissions);
  const open = STATE.openModule === m.id;
  return `<div class="modcard ${open ? 'open' : ''}">
    <button class="modhead" data-mod="${esc(m.id)}" aria-expanded="${open}">
      <span class="m-bar"><i style="width:${mp.pct}%"></i></span>
      <span class="m-n">${esc(m.id.toUpperCase())}</span>
      <span class="m-t">${esc(m.title)}</span>
      <span class="m-c">${mp.done}/${mp.total}</span>
      <span class="m-x">${open ? '−' : '+'}</span>
    </button>
    ${open ? `<div class="modbody">
      <p class="m-obj">${esc(m.objective)}</p>
      <ul class="sesslist">${m.sessions.map(s => {
        const st = statusOf(s.id, d.progress, d.submissions);
        const can = st.key === 'active' || st.key === 'overdue' || st.key === 'submitted' || st.key === 'complete';
        return `<li class="sess ${st.key}">
          <span class="s-status" aria-hidden="true"></span>
          <span class="s-body">
            <b>${esc(s.title)}</b>
            <span class="s-meta">${esc(s.duration)} · ${s.items.length} checkpoints · ${esc(st.label)}</span>
            ${st.s && st.s.reviewed ? `<span class="s-fb">
              <b>${esc(SCALE[st.s.managerScore] ? SCALE[st.s.managerScore][1] : '')}</b>
              ${st.s.managerComments ? esc(st.s.managerComments) : ''}</span>` : ''}
          </span>
          ${can ? `<button class="s-go" data-open="${esc(s.id)}">${st.key === 'complete' || st.key === 'submitted' ? 'View' : 'Debrief'}</button>` : ''}
        </li>`;
      }).join('')}</ul>
    </div>` : ''}
  </div>`;
}

/* ============================================================
   DEBRIEF FORM — the recruit's after-session submission
   ============================================================ */
function openDebrief(sessionId) {
  const s = sessionById(sessionId);
  const m = moduleById(s.moduleId);
  const d = STATE.data;
  const st = statusOf(sessionId, d.progress, d.submissions);
  const qs = (window.DEBRIEF_QUESTIONS[m.id] || []).concat(window.DEBRIEF_COMMON);
  const prior = st.s;
  const readOnly = !!prior;

  $('modalTitle').textContent = s.title;
  $('modalSub').textContent = m.title + ' · ' + s.duration;

  $('modalBody').innerHTML = `
    ${readOnly ? `<div class="banner ${prior.reviewed ? 'ok' : ''}">
      ${prior.reviewed
        ? `<b>Reviewed by your manager.</b> ${prior.managerScore != null && SCALE[prior.managerScore] ? 'Scored: ' + esc(SCALE[prior.managerScore][1]) + '.' : ''} ${esc(prior.managerComments || '')}`
        : `<b>Submitted ${esc(fmtWhen(prior.submittedAt))}.</b> Your manager has it. You will get an email when the feedback is released.`}
    </div>` : ''}

    <div class="fgroup">
      <div class="flabel">What this session covers</div>
      <p class="fhint">Tick what you actually did. Your manager ticks their own copy — where the two disagree is usually the useful conversation.</p>
      <div class="checks">
        ${s.items.map((it, i) => `<label class="chk">
          <input type="checkbox" data-cp="${i}" ${readOnly ? 'disabled' : ''}
            ${(st.p && (st.p.checkpointsDone || []).indexOf(i) > -1) ? 'checked' : ''}>
          <span>${esc(it)}</span></label>`).join('')}
      </div>
    </div>

    ${qs.map(q => `<div class="fgroup">
      <label class="flabel" for="q_${esc(q.k)}">${esc(q.q)}</label>
      ${q.why ? `<p class="fhint">${esc(q.why)}</p>` : ''}
      ${q.type === 'scale5' ? `<div class="scale" data-scale="${esc(q.k)}">
          ${q.labels.map((l, i) => `<button type="button" class="sc ${prior && prior.payload && prior.payload[q.k] == i+1 ? 'on' : ''}"
            data-v="${i+1}" ${readOnly ? 'disabled' : ''}><b>${i+1}</b><span>${esc(l)}</span></button>`).join('')}
        </div>`
        : q.type === 'number' ? `<input id="q_${esc(q.k)}" type="number" inputmode="numeric" min="${q.min||0}" max="${q.max||9999}"
            value="${esc(prior && prior.payload ? prior.payload[q.k] : '')}" ${readOnly ? 'disabled' : ''}>`
        : q.type === 'text' ? `<input id="q_${esc(q.k)}" type="text"
            value="${esc(prior && prior.payload ? prior.payload[q.k] : '')}" ${readOnly ? 'disabled' : ''}>`
        : `<textarea id="q_${esc(q.k)}" rows="${q.rows || 3}" ${readOnly ? 'disabled' : ''}>${esc(prior && prior.payload ? prior.payload[q.k] : '')}</textarea>`}
    </div>`).join('')}

    ${readOnly ? '' : `<div class="modal-actions">
      <button type="button" class="btn ghost" data-close>Cancel</button>
      <button type="button" class="btn teal" id="sendDebrief">Submit to my manager</button>
    </div>`}
  `;

  let scaleVals = {};
  $('modalBody').querySelectorAll('[data-scale]').forEach(g => {
    g.querySelectorAll('.sc').forEach(b => b.onclick = () => {
      g.querySelectorAll('.sc').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      scaleVals[g.getAttribute('data-scale')] = Number(b.getAttribute('data-v'));
    });
  });

  const send = $('sendDebrief');
  if (send) send.onclick = async () => {
    const answers = {};
    qs.forEach(q => {
      if (q.type === 'scale5') answers[q.k] = scaleVals[q.k] || null;
      else { const el = $('q_' + q.k); if (el) answers[q.k] = el.value.trim(); }
    });
    const missing = qs.filter(q => q.type !== 'scale5' && !answers[q.k]);
    if (missing.length) { alert('Please answer: ' + missing[0].q); return; }

    const checkpointsDone = [...$('modalBody').querySelectorAll('[data-cp]')]
      .filter(c => c.checked).map(c => Number(c.getAttribute('data-cp')));

    send.disabled = true; send.textContent = 'Sending…';
    try {
      await window.API.submitDebrief(STATE.token, {
        moduleId: m.id, sessionId: s.id, answers,
        selfConfidence: answers.confidence || null, checkpointsDone
      });
      closeModal();
      STATE.data = (await window.API.recruitDashboard(STATE.token)).data;
      renderRecruit();
    } catch (err) {
      alert(err.message); send.disabled = false; send.textContent = 'Submit to my manager';
    }
  };

  openModal();
}

/* ============================================================
   MANAGER — recruit list
   ============================================================ */
function renderManagerList() {
  const d = STATE.data;
  const needs = d.recruits.filter(r => r.awaitingReview > 0 || r.overdue > 0);
  const stalled = d.recruits.filter(r => r.daysInStage != null && r.daysInStage > 14);

  $('view').innerHTML = `
    <section class="hero-card">
      <div class="eyebrow">${esc(d.me.role === 'BM' ? 'Whole branch' : 'Your recruits')}</div>
      <h1>${plural(d.recruits.length, 'recruit')} in the pipeline</h1>
      <div class="statrow">
        <div class="stat"><b>${needs.reduce((a, r) => a + r.awaitingReview, 0)}</b><span>debriefs to review</span></div>
        <div class="stat"><b>${d.recruits.reduce((a, r) => a + r.overdue, 0)}</b><span>overdue sessions</span></div>
        <div class="stat"><b>${stalled.length}</b><span>stalled over 14 days</span></div>
      </div>
    </section>

    ${needs.length ? `<section>
      <div class="sec-label">Needs you now</div>
      <div class="attn">${needs.map(r => `<button class="attnrow" data-r="${esc(r.id)}">
        <span class="a-name">${esc(r.name)}</span>
        <span class="a-why">${[r.awaitingReview ? plural(r.awaitingReview, 'debrief') + ' waiting' : '',
                               r.overdue ? plural(r.overdue, 'session') + ' overdue' : ''].filter(Boolean).join(' · ')}</span>
        <span class="a-go">Open →</span></button>`).join('')}</div>
    </section>` : ''}

    <section>
      <div class="sec-label">All recruits</div>
      <div class="rgrid">${d.recruits.map(r => {
        const si = stageIndex(r.stage);
        const pct = Math.round(r.sessionsDone / r.sessionsTotal * 100);
        return `<button class="rcard" data-r="${esc(r.id)}">
          <div class="rc-head">
            <span class="rc-name">${esc(r.name)}</span>
            <span class="rc-ref">${esc(r.ref || '')}</span>
          </div>
          <div class="rc-stage">${esc(STAGES[si].label)}</div>
          <div class="rc-bar"><i style="width:${Math.round((si + 1) / STAGES.length * 100)}%"></i></div>
          <div class="rc-meta">
            <span>${plural(r.daysInStage ?? 0, 'day')} at this step</span>
            ${r.stage === 'discovery' ? `<span>Discovery ${r.sessionsDone}/${r.sessionsTotal} · ${pct}%</span>` : ''}
          </div>
          <div class="rc-flags">
            ${r.awaitingReview ? `<span class="flag warn">${r.awaitingReview} to review</span>` : ''}
            ${r.overdue ? `<span class="flag late">${r.overdue} overdue</span>` : ''}
            ${(r.daysInStage ?? 0) > 14 ? `<span class="flag">stalled</span>` : ''}
          </div>
        </button>`;
      }).join('')}</div>
    </section>
  `;
  $('view').querySelectorAll('[data-r]').forEach(b => b.onclick = () => openRecruit(b.getAttribute('data-r')));
}

/* ============================================================
   MANAGER — one recruit
   ============================================================ */
async function openRecruit(id) {
  $('view').innerHTML = '<div class="loading">Opening file…</div>';
  try {
    STATE.detail = (await window.API.recruitDetail(STATE.token, id)).data;
    STATE.detail.id = id;
    renderRecruitDetail();
  } catch (err) {
    $('view').innerHTML = '<div class="empty"><b>Could not open.</b><p>' + esc(err.message) + '</p></div>';
  }
}

function renderRecruitDetail() {
  const d = STATE.detail;
  const r = d.recruit;
  const si = stageIndex(r.stage);
  const prog = overallProgress(d.progress, d.submissions);
  const pending = d.submissions.filter(s => !s.released)
                    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  $('view').innerHTML = `
    <button class="back" id="back">← All recruits</button>

    <section class="hero-card">
      <div class="hero-top">
        <div>
          <div class="eyebrow">${esc(r.ref || '')} · ${r.track === 'experienced' ? 'Experienced' : 'New to the industry'}</div>
          <h1>${esc(d.person.name)}</h1>
          <p class="sub">${esc(d.person.phone || '')} ${d.person.email ? '· ' + esc(d.person.email) : ''}
            · ${plural(r.daysSinceStart ?? 0, 'day')} with the branch</p>
        </div>
        <div class="stagepick">
          <label for="stageSel">Stage</label>
          <select id="stageSel">${STAGES.map(s =>
            `<option value="${esc(s.key)}" ${s.key === r.stage ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
          <span class="pickmeta">${plural(r.daysInStage ?? 0, 'day')} here</span>
        </div>
      </div>
      <ol class="stagebar">
        ${STAGES.map((s, i) => `<li class="${i < si ? 'past' : i === si ? 'now' : ''}">
          <span class="dot"></span><span class="nm">${esc(s.label)}</span></li>`).join('')}
      </ol>
    </section>

    ${pending.length ? `<section>
      <div class="sec-label">Debriefs waiting on you — ${pending.length}</div>
      <p class="sec-sub">Read it, score it, release it. Nothing goes back to the recruit until you release.</p>
      ${pending.map(s => reviewCard(s)).join('')}
    </section>` : ''}

    <section>
      <div class="sec-label">Discovery — ${prog.done} of ${prog.total} sessions</div>
      <div class="mgrid">${MODULES.map(m => {
        const mp = moduleProgress(m, d.progress, d.submissions);
        return `<div class="mblock">
          <div class="mb-head"><b>${esc(m.title)}</b><span>${mp.done}/${mp.total}</span></div>
          <div class="mb-bar"><i style="width:${mp.pct}%"></i></div>
          <ul class="mb-sess">${m.sessions.map(s => {
            const st = statusOf(s.id, d.progress, d.submissions);
            return `<li class="msess ${st.key}">
              <span class="ms-dot"></span>
              <span class="ms-t">${esc(s.title)}</span>
              ${st.p && st.p.managerScore != null && SCALE[st.p.managerScore]
                ? `<span class="ms-sc">${st.p.managerScore}</span>` : ''}
              <button class="ms-go" data-mark="${esc(s.id)}" data-mod="${esc(m.id)}">${st.key === 'complete' ? 'Edit' : 'Mark'}</button>
            </li>`;
          }).join('')}</ul>
        </div>`;
      }).join('')}</div>
    </section>

    ${d.timeline.length ? `<section>
      <div class="sec-label">History</div>
      <ol class="timeline">${d.timeline.slice().reverse().map(e => `<li>
        <span class="t-when">${esc(fmtDate(e.at))}</span>
        <span class="t-what">${esc(e.detail || e.type)}</span>
        <span class="t-who">${esc(e.actor)}</span></li>`).join('')}</ol>
    </section>` : ''}
  `;

  $('back').onclick = () => renderManagerList();
  $('stageSel').onchange = async (ev) => {
    await window.API.setStage(STATE.token, { recruitId: d.id, stage: ev.target.value });
    openRecruit(d.id);
  };
  $('view').querySelectorAll('[data-mark]').forEach(b =>
    b.onclick = () => openMark(b.getAttribute('data-mark'), b.getAttribute('data-mod')));
  wireReviewCards();
}

function reviewCard(s) {
  const sess = sessionById(s.sessionId);
  const mod = moduleById(s.moduleId);
  const qs = (window.DEBRIEF_QUESTIONS[s.moduleId] || []).concat(window.DEBRIEF_COMMON);
  return `<div class="review" data-sub="${esc(s.id)}">
    <div class="rv-head">
      <div><b>${esc(sess ? sess.title : s.sessionId)}</b>
        <span>${esc(mod ? mod.title : '')} · submitted ${esc(fmtWhen(s.submittedAt))}</span></div>
    </div>
    <div class="rv-answers">
      ${qs.filter(q => q.type !== 'scale5').map(q => {
        const a = s.payload ? s.payload[q.k] : '';
        if (!a) return '';
        return `<div class="ans"><div class="ans-q">${esc(q.q)}</div><div class="ans-a">${esc(a)}</div></div>`;
      }).join('')}
      ${s.payload && s.payload.confidence ? `<div class="ans">
        <div class="ans-q">Their own confidence</div>
        <div class="ans-a">${esc(s.payload.confidence)} of 5</div></div>` : ''}
    </div>
    <div class="rv-score">
      <div class="flabel">Your score</div>
      <div class="scale" data-mscale>
        ${SCALE.map(([v, l]) => `<button type="button" class="sc" data-v="${v}"><b>${v}</b><span>${esc(l)}</span></button>`).join('')}
      </div>
      <div class="flabel" style="margin-top:14px">Feedback for the recruit</div>
      <textarea data-comment rows="3" placeholder="What they did well, and the one thing to change before the next session."></textarea>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-hold>Save without releasing</button>
        <button type="button" class="btn teal" data-release>Score and release</button>
      </div>
    </div>
  </div>`;
}

function wireReviewCards() {
  $('view').querySelectorAll('.review').forEach(card => {
    let score = null;
    card.querySelectorAll('[data-mscale] .sc').forEach(b => b.onclick = () => {
      card.querySelectorAll('[data-mscale] .sc').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); score = Number(b.getAttribute('data-v'));
    });
    const send = async (release, btn) => {
      if (release && score === null) { alert('Pick a score first.'); return; }
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await window.API.reviewSubmission(STATE.token, {
          submissionId: card.getAttribute('data-sub'),
          managerScore: score,
          managerComments: card.querySelector('[data-comment]').value.trim(),
          release
        });
        openRecruit(STATE.detail.id);
      } catch (err) { alert(err.message); btn.disabled = false; btn.textContent = release ? 'Score and release' : 'Save without releasing'; }
    };
    card.querySelector('[data-release]').onclick = ev => send(true, ev.target);
    card.querySelector('[data-hold]').onclick    = ev => send(false, ev.target);
  });
}

/* Manager's own tick-off of a session */
function openMark(sessionId, moduleId) {
  const s = sessionById(sessionId);
  const d = STATE.detail;
  const st = statusOf(sessionId, d.progress, d.submissions);
  const done = (st.p && st.p.checkpointsDone) || [];

  $('modalTitle').textContent = s.title;
  $('modalSub').textContent = moduleById(moduleId).title + ' · ' + s.duration;
  $('modalBody').innerHTML = `
    <div class="fgroup">
      <div class="flabel">Manager preparation</div>
      <ul class="preplist">${moduleById(moduleId).managerPrep.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>
    <div class="fgroup">
      <div class="flabel">Checkpoints covered</div>
      <div class="checks">${s.items.map((it, i) => `<label class="chk">
        <input type="checkbox" data-cp="${i}" ${done.indexOf(i) > -1 ? 'checked' : ''}>
        <span>${esc(it)}</span></label>`).join('')}</div>
    </div>
    <div class="fgroup">
      <div class="flabel">Session score</div>
      <div class="scale" data-mscale>${SCALE.map(([v, l]) =>
        `<button type="button" class="sc ${st.p && st.p.managerScore === v ? 'on' : ''}" data-v="${v}"><b>${v}</b><span>${esc(l)}</span></button>`).join('')}</div>
    </div>
    <div class="fgroup">
      <label class="flabel" for="mnotes">Your notes</label>
      <textarea id="mnotes" rows="3">${esc(st.p ? st.p.managerNotes : '')}</textarea>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn ghost" data-close>Cancel</button>
      <button type="button" class="btn teal" id="saveMark">Save as complete</button>
    </div>`;

  let score = st.p ? st.p.managerScore : null;
  $('modalBody').querySelectorAll('[data-mscale] .sc').forEach(b => b.onclick = () => {
    $('modalBody').querySelectorAll('[data-mscale] .sc').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); score = Number(b.getAttribute('data-v'));
  });

  $('saveMark').onclick = async (ev) => {
    ev.target.disabled = true; ev.target.textContent = 'Saving…';
    try {
      await window.API.markSession(STATE.token, {
        recruitId: STATE.detail.id, moduleId, sessionId,
        completed: true,
        checkpointsDone: [...$('modalBody').querySelectorAll('[data-cp]')].filter(c => c.checked).map(c => Number(c.getAttribute('data-cp'))),
        managerScore: score, managerNotes: $('mnotes').value.trim()
      });
      closeModal();
      openRecruit(STATE.detail.id);
    } catch (err) { alert(err.message); ev.target.disabled = false; ev.target.textContent = 'Save as complete'; }
  };
  openModal();
}

/* ============================================================
   MODAL
   ============================================================ */
function openModal() {
  $('modal').hidden = false;
  document.body.style.overflow = 'hidden';
  $('modal').querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
  $('modalClose').focus();
}
function closeModal() {
  $('modal').hidden = true;
  document.body.style.overflow = '';
}

/* ============================================================
   START
   ============================================================ */
$('loginForm').onsubmit = doLogin;
$('signout').onclick = signOut;
$('modalClose').onclick = closeModal;
$('modal').onclick = ev => { if (ev.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('modal').hidden) closeModal(); });

(function restore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('rrb-portal') || 'null');
    if (saved && saved.token) { STATE.token = saved.token; STATE.person = saved.person; boot(); return; }
  } catch (e) {}
  showLogin('');
})();

})();
