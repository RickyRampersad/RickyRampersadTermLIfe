/* ============================================================
   SOURCE MARKET SURVEY — screens
   The wizard the recruit fills, the briefing they read first,
   and the manager's read of what came back.
   ============================================================ */
window.SurveyUI = (function () {
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S = () => window.SURVEY;

const fmtWhen = iso => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return d + ' days ago';
  return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
};

/* ============================================================
   BRIEFING
   ============================================================ */
function briefingHtml() {
  const B = window.SURVEY_BRIEFING;
  return `
    <p class="fhint" style="font-size:14px;margin-bottom:20px">${esc(B.intro)}</p>
    ${B.sections.map(sec => `
      <div class="fgroup">
        <div class="flabel">${esc(sec.h)}</div>
        ${sec.quote ? `<blockquote class="script">${esc(sec.quote)}</blockquote>` : ''}
        ${sec.p ? `<p class="fhint" style="font-size:13.5px;max-width:none">${esc(sec.p)}</p>` : ''}
        ${sec.stats ? `<div class="statgrid">${sec.stats.map(s =>
          `<div class="statmini"><b>${esc(s.n)}</b><span>${esc(s.t)}</span></div>`).join('')}</div>` : ''}
        ${sec.list ? `<ul class="preplist">${sec.list.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      </div>`).join('')}
  `;
}

function openBriefing() {
  $('modalTitle').textContent = window.SURVEY_BRIEFING.title;
  $('modalSub').textContent = 'Read this before your first survey — and again before Module 3';
  $('modalBody').innerHTML = briefingHtml() +
    `<div class="modal-actions"><button type="button" class="btn ghost" data-close>Close</button></div>`;
  openModal();
}

/* ============================================================
   THE WIZARD
   ============================================================ */
let W = null;   /* { answers, step, onDone, token, readOnly } */

function openSurvey(opts) {
  W = { answers: opts.answers ? JSON.parse(JSON.stringify(opts.answers)) : {},
        step: 0, onDone: opts.onDone, token: opts.token, readOnly: !!opts.readOnly };
  if (!W.answers.referrals) W.answers.referrals = [{ name:'', mobile:'', relation:'' }];
  renderStep();
  openModal();
}

function renderStep() {
  const steps = S().steps;
  const st = steps[W.step];
  const sc = S().score(W.answers);

  $('modalTitle').textContent = W.readOnly ? 'Market survey' : st.title;
  $('modalSub').textContent = W.readOnly
    ? `${esc(W.answers.firstName || '')} ${esc(W.answers.lastName || '')}`
    : `${st.tag} of ${steps.length} · Source Market Survey`;

  $('modalBody').innerHTML = `
    ${W.readOnly ? '' : `
      <div class="sv-meter">
        <div class="sv-bar"><i style="width:${sc.total}%"></i></div>
        <div class="sv-num"><b>${sc.total}</b><span>/100</span></div>
        <div class="sv-band ${sc.band.key}">${esc(sc.band.label)}</div>
      </div>
      <p class="lede" style="margin:14px 0 18px">${esc(st.lede)}</p>
      ${st.script ? `<blockquote class="script">${esc(st.script)}</blockquote>` : ''}
    `}
    ${W.readOnly ? readOnlyBody() : st.fields.map(fieldHtml).filter(Boolean).join('')}
    ${W.readOnly ? '' : `
      <div class="modal-actions">
        ${W.step > 0 ? '<button type="button" class="btn ghost" id="svBack">← Back</button>' : '<button type="button" class="btn ghost" data-close>Cancel</button>'}
        <button type="button" class="btn ghost" id="svHelp">How to run this</button>
        <button type="button" class="btn teal" id="svNext">${W.step === steps.length - 1 ? 'Submit survey' : 'Continue →'}</button>
      </div>`}
  `;

  if (W.readOnly) return;
  wireFields();
  const back = $('svBack'); if (back) back.onclick = () => { W.step--; renderStep(); };
  $('svHelp').onclick = () => { const keep = W; openBriefing();
    const btn = $('modalBody').querySelector('[data-close]');
    if (btn) btn.onclick = () => { W = keep; renderStep(); }; };
  $('svNext').onclick = advance;
}

function visible(f) {
  if (!f.showIf) return true;
  return W.answers[f.showIf[0]] === f.showIf[1];
}

function fieldHtml(f) {
  if (!visible(f)) return '';
  const v = W.answers[f.k];
  const lab = `<label class="flabel" for="sv_${f.k}">${esc(f.label)}${f.req ? ' <span style="color:var(--gold)">*</span>' : ''}</label>`;
  const hint = f.hint ? `<p class="fhint">${esc(f.hint)}</p>` : '';
  let body = '';

  if (f.t === 'choice') {
    body = `<div class="choicewrap" data-choice="${f.k}">${S().opts[f.opts].map(o =>
      `<button type="button" class="chip ${v === o ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  } else if (f.t === 'multi') {
    const arr = Array.isArray(v) ? v : [];
    body = `<div class="choicewrap" data-multi="${f.k}">${S().opts[f.opts].map(o =>
      `<button type="button" class="chip ${arr.indexOf(o) > -1 ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  } else if (f.t === 'select') {
    body = `<select id="sv_${f.k}" data-k="${f.k}"><option value="">Select…</option>${
      S().opts[f.opts].map(o => `<option value="${esc(o)}" ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else if (f.t === 'area') {
    body = `<textarea id="sv_${f.k}" data-k="${f.k}" rows="${f.rows || 3}">${esc(v || '')}</textarea>`;
  } else if (f.t === 'check') {
    body = `<label class="chk"><input type="checkbox" data-k="${f.k}" ${v ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
    return `<div class="fgroup">${body}${hint}</div>`;
  } else if (f.t === 'referrals') {
    body = referralsHtml();
  } else if (f.t === 'consent') {
    body = consentHtml();
  } else {
    const type = f.t === 'email' ? 'email' : f.t === 'tel' ? 'tel' : 'text';
    body = `<input id="sv_${f.k}" type="${type}" data-k="${f.k}" value="${esc(v || '')}"
              ${type === 'tel' ? 'inputmode="tel"' : ''}>`;
  }
  return `<div class="fgroup">${lab}${hint}${body}<div class="err" id="sve_${f.k}"></div></div>`;
}

function referralsHtml() {
  const refs = W.answers.referrals || [];
  return `<div id="svRefs">${refs.map((r, i) => `
    <div class="refrow" data-i="${i}">
      <input type="text" placeholder="Name" data-rk="name" value="${esc(r.name || '')}">
      <input type="tel" placeholder="Mobile" inputmode="tel" data-rk="mobile" value="${esc(r.mobile || '')}">
      <select data-rk="relation"><option value="">Relation…</option>${
        S().opts.relation.map(o => `<option value="${esc(o)}" ${r.relation === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
      ${refs.length > 1 ? `<button type="button" class="refx" data-del="${i}" aria-label="Remove">×</button>` : '<span></span>'}
    </div>`).join('')}
    </div>
    <button type="button" class="btn ghost" id="svAddRef" style="margin-top:10px;padding:9px 16px;font-size:12px">+ Another name</button>
    <p class="fhint" style="margin-top:10px">A name with a mobile number scores 8 points. A name alone scores 4. Two names is full marks.</p>`;
}

function consentHtml() {
  const c = W.answers.consent || {};
  return `<div class="consentbox">
    <p>${esc(S().consentText)}</p>
    <label class="flabel" for="sv_consentName" style="margin-top:14px">Type their full name to confirm they agreed</label>
    <input id="sv_consentName" type="text" data-ck="name" value="${esc(c.name || '')}" placeholder="Their full name">
    <p class="fhint" style="margin-top:8px">You are recording that you read this to them and they agreed.
      On the old form a third of surveys came back with no consent at all — those do not count.</p>
  </div>`;
}

function wireFields() {
  const body = $('modalBody');

  /* Text, textarea and select only update the model and the meter. They must
     NOT re-render the step: blurring a field to click Continue would rebuild
     the DOM out from under the click, and the button press would land on
     nothing. Only the chips below re-render, because they can reveal fields. */
  body.querySelectorAll('[data-k]').forEach(n => {
    if (n.type === 'checkbox') {
      n.onchange = () => { W.answers[n.dataset.k] = n.checked; refreshMeter(); };
    } else {
      const set = () => { W.answers[n.dataset.k] = n.value; refreshMeter(); };
      n.oninput = set;
      n.onchange = set;
    }
  });

  body.querySelectorAll('[data-choice]').forEach(g => {
    g.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      W.answers[g.dataset.choice] = b.dataset.v;
      renderStep();   /* choices can reveal other fields */
    });
  });

  body.querySelectorAll('[data-multi]').forEach(g => {
    g.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const k = g.dataset.multi;
      const arr = Array.isArray(W.answers[k]) ? W.answers[k].slice() : [];
      const i = arr.indexOf(b.dataset.v);
      if (i > -1) arr.splice(i, 1); else arr.push(b.dataset.v);
      W.answers[k] = arr;
      b.classList.toggle('on');
      refreshMeter();
    });
  });

  body.querySelectorAll('.refrow').forEach(row => {
    const i = Number(row.dataset.i);
    row.querySelectorAll('[data-rk]').forEach(inp => {
      inp.oninput = inp.onchange = () => {
        W.answers.referrals[i] = W.answers.referrals[i] || {};
        W.answers.referrals[i][inp.dataset.rk] = inp.value;
        refreshMeter();
      };
    });
    const del = row.querySelector('[data-del]');
    if (del) del.onclick = () => { W.answers.referrals.splice(i, 1); renderStep(); };
  });

  const add = $('svAddRef');
  if (add) add.onclick = () => { W.answers.referrals.push({ name:'', mobile:'', relation:'' }); renderStep(); };

  const cn = body.querySelector('[data-ck]');
  if (cn) cn.oninput = () => {
    W.answers.consent = { name: cn.value, at: new Date().toISOString() };
    refreshMeter();
  };
}

/* Update the meter without re-rendering — keeps focus in the field. */
function refreshMeter() {
  const sc = S().score(W.answers);
  const bar = $('modalBody').querySelector('.sv-bar i');
  const num = $('modalBody').querySelector('.sv-num b');
  const band = $('modalBody').querySelector('.sv-band');
  if (bar) bar.style.width = sc.total + '%';
  if (num) num.textContent = sc.total;
  if (band) { band.textContent = sc.band.label; band.className = 'sv-band ' + sc.band.key; }
}

function advance() {
  const steps = S().steps;
  const st = steps[W.step];
  const missing = st.fields.filter(f => f.req && visible(f)).filter(f => {
    if (f.t === 'consent') return !(W.answers.consent && String(W.answers.consent.name || '').trim());
    const v = W.answers[f.k];
    return Array.isArray(v) ? !v.length : !(v && String(v).trim());
  });
  if (missing.length) {
    missing.forEach(f => {
      const e = $('sve_' + f.k);
      if (e) { e.textContent = 'Needed before you continue.'; e.classList.add('on'); }
    });
    const first = $('sve_' + missing[0].k);
    if (first) first.scrollIntoView({ block:'center' });
    return;
  }
  if (W.step < steps.length - 1) { W.step++; renderStep(); $('modalBody').scrollTop = 0; return; }
  submit();
}

async function submit() {
  const btn = $('svNext');
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    const sc = S().score(W.answers);
    await window.API.submitSurvey(W.token, { answers: W.answers, score: sc.total, parts: sc.parts });
    showDone(sc);
  } catch (err) {
    alert(err.message);
    btn.disabled = false; btn.textContent = 'Submit survey';
  }
}

function showDone(sc) {
  const a = W.answers;
  const willEmail = a.contactOk && a.email;
  $('modalTitle').textContent = 'Survey submitted';
  $('modalSub').textContent = `${esc(a.firstName || '')} ${esc(a.lastName || '')}`;
  $('modalBody').innerHTML = `
    <div class="sv-done">
      <div class="sv-score ${sc.band.key}"><b>${sc.total}</b><span>/100</span></div>
      <h3>${esc(sc.band.label)}</h3>
      <p>${sc.referralNames ? `You came away with ${sc.referralNames === 1 ? 'a name' : sc.referralNames + ' names'} — that is the part most surveys miss.`
        : 'No referral this time. Ask again in a fortnight; "maybe later" often turns into yes.'}</p>
    </div>
    <div class="fgroup">
      <div class="flabel">Where it went</div>
      <div class="next"><div class="n">1</div><div><b>Your Unit Manager and the Branch Manager</b>
        <p>They have it now, with your own read of the conversation.</p></div></div>
      <div class="next"><div class="n">2</div><div><b>${willEmail ? esc(a.firstName) + ' gets a thank-you note' : 'No note to ' + esc(a.firstName || 'them')}</b>
        <p>${willEmail
          ? 'A short message from the branch thanking them, explaining you are in selection, and saying someone will be in touch once you are contracted. You do not chase them in the meantime.'
          : (a.email ? 'They did not agree to be contacted, so nothing is sent.' : 'No email on file, so nothing is sent.')}</p></div></div>
      <div class="next"><div class="n">3</div><div><b>It counts towards your file</b>
        <p>Market surveys feed your Income Potential Analysis and the Discovery Summary in your selection file.</p></div></div>
    </div>
    <div class="modal-actions"><button type="button" class="btn teal" id="svClose">Done</button></div>`;
  $('svClose').onclick = () => { closeModal(); if (W.onDone) W.onDone(); };
}

function readOnlyBody() {
  const a = W.answers;
  const sc = S().score(a);
  const rows = [];
  S().steps.forEach(st => st.fields.forEach(f => {
    if (f.t === 'consent' || f.t === 'check') return;
    let v = a[f.k];
    if (f.t === 'referrals') {
      const refs = (a.referrals || []).filter(r => r && r.name);
      v = refs.length ? refs.map(r => `${r.name}${r.mobile ? ' — ' + r.mobile : ''}${r.relation ? ' (' + r.relation + ')' : ''}`).join('  ·  ') : '';
    }
    if (Array.isArray(v)) v = v.join(', ');
    if (v && String(v).trim()) rows.push([f.label, v]);
  }));
  return `
    <div class="sv-meter"><div class="sv-bar"><i style="width:${sc.total}%"></i></div>
      <div class="sv-num"><b>${sc.total}</b><span>/100</span></div>
      <div class="sv-band ${sc.band.key}">${esc(sc.band.label)}</div></div>
    <div class="rv-answers" style="margin-top:18px">
      ${rows.map(([q, v]) => `<div class="ans"><div class="ans-q">${esc(q)}</div><div class="ans-a">${esc(v)}</div></div>`).join('')}
    </div>
    ${a.consent ? `<div class="banner ok" style="margin-top:16px"><b>Consent recorded</b> — ${esc(a.consent.name)}${a.consent.at ? ' on ' + new Date(a.consent.at).toLocaleDateString('en-GB') : ''}.
      ${a.contactOk ? ' They agreed to be contacted once the recruit is contracted.' : ' They did not agree to further contact.'}</div>`
      : `<div class="banner" style="margin-top:16px"><b>No consent recorded.</b> This survey does not count towards the file.</div>`}
    <div class="modal-actions"><button type="button" class="btn ghost" data-close>Close</button></div>`;
}

/* ============================================================
   RECRUIT — the surveys section
   ============================================================ */
function recruitSection(data, token, onChange) {
  const list = (data.surveys || []).slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const scored = list.map(s => s.score).filter(n => typeof n === 'number');
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0;
  const refs = list.reduce((n, s) => n + (s.referralNames || 0), 0);

  return `<section id="surveysSection">
    <div class="sec-label">Source market surveys — ${list.length} done</div>
    <p class="sec-sub">Real conversations with people you already know. They build your Project 100, they feed the
      Income Potential Analysis in your selection file, and they are how the branch learns what the market thinks.</p>

    <div class="statrow" style="margin-bottom:16px">
      <div class="stat"><b>${list.length}</b><span>surveys submitted</span></div>
      <div class="stat"><b>${avg || '—'}</b><span>average score</span></div>
      <div class="stat"><b>${refs}</b><span>referral names won</span></div>
    </div>

    <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">
      <button type="button" class="btn teal" id="svNew">Start a new survey</button>
      <button type="button" class="btn ghost" id="svBrief">How to run one</button>
    </div>

    ${list.length ? `<div class="svlist">${list.map(s => {
      const band = S().band(s.score || 0);
      return `<button class="svrow" data-sv="${esc(s.id)}">
        <span class="sv-who">${esc(s.prospectName || 'Unnamed')}</span>
        <span class="sv-meta">${esc(fmtWhen(s.submittedAt))}${s.referralNames ? ' · ' + s.referralNames + ' referral' + (s.referralNames > 1 ? 's' : '') : ''}</span>
        <span class="sv-pill ${band.key}">${s.score}</span>
      </button>`;
    }).join('')}</div>` : `<div class="empty"><b>None yet.</b>
      <p>Read the briefing first — it takes three minutes and it is built from what the branch learned across 880 of these.</p></div>`}
  </section>`;
}

function wireRecruitSection(data, token, onChange) {
  const nw = $('svNew'); if (nw) nw.onclick = () => openSurvey({ token, onDone: onChange });
  const br = $('svBrief'); if (br) br.onclick = openBriefing;
  document.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => {
    const s = (data.surveys || []).find(x => String(x.id) === b.dataset.sv);
    if (s) openSurvey({ token, answers: s.answers, readOnly: true });
  });
}

/* ============================================================
   MANAGER — what the surveys are saying
   ============================================================ */
function analyse(surveys) {
  const A = surveys.map(s => s.answers || {}).filter(Boolean);
  const n = A.length;
  const count = k => {
    const c = {};
    A.forEach(a => { const v = a[k]; if (v) c[v] = (c[v] || 0) + 1; });
    return Object.entries(c).sort((x, y) => y[1] - x[1]);
  };
  const warm = A.filter(a => a.changes === 'Yes' && (a.ownsIns === 'No' || a.confidence === 'NotConfident'));
  const refs = surveys.reduce((t, s) => t + (s.referralNames || 0), 0);
  const withRef = surveys.filter(s => (s.referralNames || 0) > 0).length;
  return {
    n, refs, withRef,
    refRate: n ? Math.round(withRef / n * 100) : 0,
    warm: warm.length,
    warmWithEmail: warm.filter(a => a.email && a.contactOk).length,
    wordAssoc: count('wordAssoc'), mostImportant: count('mostImportant'),
    bestWay: count('bestWay'), communityValues: count('communityValues'),
    changes: count('changes'), ownsIns: count('ownsIns')
  };
}

function bars(pairs, n) {
  const tot = pairs.reduce((a, p) => a + p[1], 0) || 1;
  return `<div class="barset">${pairs.slice(0, 5).map(([k, v]) => `
    <div class="barrow">
      <span class="b-k">${esc(k)}</span>
      <span class="b-t"><i style="width:${Math.round(v / tot * 100)}%"></i></span>
      <span class="b-v">${Math.round(v / tot * 100)}%</span>
    </div>`).join('')}</div>`;
}

function managerSection(surveys) {
  if (!surveys || !surveys.length) {
    return `<section><div class="sec-label">Market surveys</div>
      <div class="empty"><b>No surveys yet.</b><p>They start in Discovery Module 3.</p></div></section>`;
  }
  const a = analyse(surveys);
  const list = surveys.slice().sort((x, y) => new Date(y.submittedAt) - new Date(x.submittedAt));

  return `<section>
    <div class="sec-label">Market surveys — ${a.n}</div>
    <div class="statrow" style="margin-bottom:16px">
      <div class="stat"><b>${a.refRate}%</b><span>came back with a referral</span></div>
      <div class="stat"><b>${a.refs}</b><span>names captured</span></div>
      <div class="stat"><b>${a.warm}</b><span>warm prospects found</span></div>
      <div class="stat"><b>${a.warmWithEmail}</b><span>warm, and contactable</span></div>
    </div>

    <div class="anal">
      <div class="anblock"><div class="an-h">First word they associate with insurance</div>${bars(a.wordAssoc)}</div>
      <div class="anblock"><div class="an-h">What an insurer should offer above all</div>${bars(a.mostImportant)}</div>
      <div class="anblock"><div class="an-h">Best way to reach them</div>${bars(a.bestWay)}</div>
      <div class="anblock"><div class="an-h">What the community values</div>${bars(a.communityValues)}</div>
    </div>

    <div class="svlist" style="margin-top:16px">${list.map(s => {
      const band = S().band(s.score || 0);
      const warm = s.answers && s.answers.changes === 'Yes' &&
                   (s.answers.ownsIns === 'No' || s.answers.confidence === 'NotConfident');
      return `<button class="svrow" data-sv="${esc(s.id)}">
        <span class="sv-who">${esc(s.prospectName || 'Unnamed')}${warm ? ' <span class="flag warn">warm</span>' : ''}</span>
        <span class="sv-meta">${esc(fmtWhen(s.submittedAt))}${s.referralNames ? ' · ' + s.referralNames + ' referral' + (s.referralNames > 1 ? 's' : '') : ' · no referral'}</span>
        <span class="sv-pill ${band.key}">${s.score}</span>
      </button>`;
    }).join('')}</div>
  </section>`;
}

function wireManagerSection(surveys) {
  document.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => {
    const s = surveys.find(x => String(x.id) === b.dataset.sv);
    if (s) openSurvey({ answers: s.answers, readOnly: true });
  });
}

/* modal helpers live in app.js; borrow them */
function openModal() { window.__openModal(); }
function closeModal() { window.__closeModal(); }

return { openSurvey, openBriefing, recruitSection, wireRecruitSection,
         managerSection, wireManagerSection, analyse };
})();
