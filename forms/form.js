/* ═══════════════════════════════════════════════════════════════════════
   The branch's own forms — shared behaviour
   Ricky Rampersad Branch · 22 October 2026

   One script for all six. Every field is real HTML in the page, so the
   form is readable and fillable with this file blocked; what this adds is
   the conditional fields, the validation, the send, and the done screen.

   Three things it will not do, on purpose:
     · it never clears what somebody typed on a failed send
     · if the backend does not answer, it opens a pre-filled e-mail with
       every answer in it, so a submission is never lost to a bad minute
       of signal — the same road service/index.html takes
     · it posts text/plain, which is what stops the browser asking Apps
       Script for a CORS preflight it cannot answer
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var form = document.querySelector('form[data-form]');
  if (!form) return;

  var CFG = window.RRB_FORM || {};
  var KEY = form.dataset.form;
  var DRAFT = 'rrb-form-' + KEY;

  /* ── conditional fields ─────────────────────────────────────────────
     A field carries data-show="other_key=Value" or "other_key!=Value".
     Hidden means hidden from everything: display:none takes it out of
     the accessibility tree too, and its inputs are disabled so a stale
     answer can never travel with the form.                           */

  var conds = [].slice.call(form.querySelectorAll('[data-show]'));

  function valueOf(k) {
    var r = form.querySelector('[name="' + k + '"]:checked');
    if (r) return r.value;
    var el = form.querySelector('[name="' + k + '"]');
    return el ? el.value : '';
  }

  function applyConds() {
    conds.forEach(function (box) {
      var rule = box.dataset.show;
      var neg  = rule.indexOf('!=') > -1;
      var bits = rule.split(neg ? '!=' : '=');
      var have = valueOf(bits[0].trim());
      var want = bits[1].trim();
      var on   = neg ? (have !== want) : (have === want);
      box.classList.toggle('hid', !on);
      [].forEach.call(box.querySelectorAll('input, select, textarea'), function (i) {
        i.disabled = !on;
      });
    });
  }

  form.addEventListener('change', applyConds);
  applyConds();

  /* Date bounds are set here, not baked into the page: a max of "today"
     written into the markup is wrong the next morning. */
  (function () {
    var today = new Date().toISOString().slice(0, 10);
    [].forEach.call(form.querySelectorAll('input[type=date][data-past]'), function (i) {
      i.max = today;
    });
    [].forEach.call(form.querySelectorAll('input[type=date][data-future]'), function (i) {
      i.min = today;
    });
  })();

  /* ── draft, so a long form survives a stray tap ─────────────────── */

  function saveDraft() {
    try {
      var d = {};
      new FormData(form).forEach(function (v, k) { d[k] = v; });
      localStorage.setItem(DRAFT, JSON.stringify(d));
    } catch (e) { /* private window, blocked storage: the form still works */ }
  }

  function loadDraft() {
    var d;
    try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { return; }
    if (!d) return;
    Object.keys(d).forEach(function (k) {
      var els = form.querySelectorAll('[name="' + k + '"]');
      if (!els.length) return;
      if (els[0].type === 'radio' || els[0].type === 'checkbox') {
        [].forEach.call(els, function (e) { if (e.value === d[k] || e.type === 'checkbox') e.checked = true; });
      } else { els[0].value = d[k]; }
    });
    applyConds();
  }

  function clearDraft() { try { localStorage.removeItem(DRAFT); } catch (e) {} }

  var saveT = null;
  form.addEventListener('input', function () {
    clearTimeout(saveT); saveT = setTimeout(saveDraft, 400);
  });
  loadDraft();

  /* ── validation. The browser's own messages are fine for a type, but
         a form this long needs one summary at the top that says what is
         missing and takes you there. ────────────────────────────────── */

  var errBox = document.getElementById('err');

  function label(el, short) {
    var wrap = el.closest('.f');
    if (short && wrap && wrap.dataset.short) return wrap.dataset.short;
    /* .q is a radio group's own legend. It has to be looked for FIRST:
       querySelector('label') inside a radio block finds the first
       option's label, which would name the field after one answer. */
    var l = wrap && (wrap.querySelector('.q') || wrap.querySelector('label'));
    var t = l ? l.textContent : el.name;
    t = t.replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ').trim();
    if (short && t.length > 58) t = t.slice(0, 55).replace(/[\s,.;]+$/, '') + '\u2026';
    return t;
  }

  function check() {
    var miss = [], seen = {};
    [].forEach.call(form.querySelectorAll('[required]'), function (el) {
      if (el.disabled || el.closest('.hid')) return;
      var ok = el.type === 'radio'
        ? !!form.querySelector('[name="' + el.name + '"]:checked')
        : (el.type === 'checkbox' ? el.checked : !!String(el.value).trim());
      if (!ok && el.validity) ok = ok && el.validity.valid;
      if (el.value && el.validity && !el.validity.valid) ok = false;
      if (!ok && !seen[el.name]) { seen[el.name] = 1; miss.push({ el: el, t: label(el, true) }); }
      if (el.type !== 'radio' && el.type !== 'checkbox') el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    });
    return miss;
  }

  function showErrors(miss) {
    if (!errBox) return;
    errBox.innerHTML = '<b>' + (miss.length === 1 ? 'One answer is missing' : miss.length + ' answers are missing')
      + '.</b> ' + miss.map(function (m) {
        return '<a href="#' + m.el.id + '">' + m.t + '</a>';
      }).join(' &middot; ');
    errBox.hidden = false;
    errBox.setAttribute('tabindex', '-1');
    errBox.focus({ preventScroll: true });
    errBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    miss[0].el.focus({ preventScroll: true });
  }

  /* ── what we send ───────────────────────────────────────────────── */

  function answers() {
    var out = [];
    [].forEach.call(form.querySelectorAll('fieldset'), function (fs) {
      var sec = (fs.querySelector('legend') || {}).textContent || '';
      [].forEach.call(fs.querySelectorAll('.f'), function (wrap) {
        if (wrap.closest('.hid')) return;
        var el = wrap.querySelector('input, select, textarea');
        if (!el || el.disabled) return;
        var v = '', k = el.name;
        if (el.type === 'radio') {
          var c = form.querySelector('[name="' + k + '"]:checked');
          v = c ? c.value : '';
        } else if (el.type === 'checkbox') {
          v = el.checked ? 'Yes' : 'No';
        } else { v = String(el.value || '').trim(); }
        if (!v) return;
        out.push({ k: k, section: sec.trim(), label: label(el), value: v });
      });
    });
    return out;
  }

  function payload() {
    var f = answers(), core = {};
    ['name', 'email', 'phone', 'reach', 'when', 'agent', 'notes'].forEach(function (k) {
      var hit = null;
      f.forEach(function (a) { if (a.k === k) hit = a.value; });
      core[k] = hit || '';
    });
    return {
      action: 'q.quote',
      form: KEY, code: CFG.code || '', line: CFG.line || '', title: CFG.title || '',
      core: core, fields: f,
      page: location.pathname,
      ref_from: (new URLSearchParams(location.search)).get('from') || '',
      at: new Date().toISOString()
    };
  }

  /* ── the e-mail road, for when the backend cannot be reached ─────── */

  function localRef() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (CFG.code || 'Q') + '-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1)
      + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function mailFallback(body, ref) {
    var t = (CFG.title || 'Request').toUpperCase() + '\nReference: ' + ref
          + '\nSent: ' + new Date().toLocaleString() + '\n';
    var sec = '';
    body.fields.forEach(function (a) {
      if (a.section !== sec) { sec = a.section; t += '\n-- ' + sec.toUpperCase() + ' --\n'; }
      t += a.label + '\n   ' + a.value + '\n';
    });
    var to = CFG.support || 'support@rickyrampersadbranch.com';
    var a = document.createElement('a');
    a.href = 'mailto:' + to
      + '?subject=' + encodeURIComponent((CFG.title || 'Request') + ' \u2014 ' + ref)
      + '&body=' + encodeURIComponent(t);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 0);
  }

  /* ── the done screen ────────────────────────────────────────────── */

  function done(ref, sent) {
    var wrap = document.getElementById('page');
    var steps = CFG.steps || [];
    var extra = CFG.done_extra ? '<p style="margin-top:var(--sp-s)">' + CFG.done_extra + '</p>' : '';
    var finish = CFG.finish_url
      ? '<p class="send" style="margin-top:var(--sp-m)"><a class="btn" href="' + CFG.finish_url
        + '" target="_blank" rel="noopener">' + (CFG.finish_label || 'Continue')
        + '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></p>'
      : '';
    var warn = sent ? '' :
      '<div class="note" style="border-color:var(--warn);background:var(--warn-bg)"><strong>We could not reach our system just now,</strong> '
      + 'so your answers opened in an e-mail instead. Send that e-mail and the branch has everything — '
      + 'quote the reference above when you call.</div>';

    wrap.innerHTML =
      '<div class="done layout"><div class="done-card">'
      + '<div class="done-ic"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>'
      + '<h1>Thank you. We have it.</h1>'
      + '<p>' + (CFG.done_line || 'Your request is with the branch team.') + '</p>'
      + '<div class="refbox"><span class="k">Your reference</span><span class="v">' + ref + '</span></div>'
      + (steps.length ? '<ol class="steps">' + steps.map(function (s, i) {
          return '<li><span class="n">' + (i + 1) + '</span><span>' + s + '</span></li>';
        }).join('') + '</ol>' : '')
      + extra + finish + warn
      + '<p style="margin-top:var(--sp-m);font-size:var(--f--1);color:var(--muted)">'
      + 'Need us sooner? Call the branch on <a href="tel:+18682266461">(868) 226-6461</a>.</p>'
      + '</div></div>';
    document.title = 'Thank you — ' + (CFG.title || 'Request');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── send ───────────────────────────────────────────────────────── */

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (form.dataset.sending === '1') return;

    var miss = check();
    if (miss.length) { showErrors(miss); return; }
    if (errBox) errBox.hidden = true;

    var btn = form.querySelector('[type=submit]');
    var was = btn ? btn.innerHTML : '';
    form.dataset.sending = '1';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Sending&hellip;'; }

    var body = payload(), ref = '', sent = false;

    function finish() {
      form.dataset.sending = '';
      if (btn) { btn.disabled = false; btn.innerHTML = was; }
      if (!ref) ref = localRef();
      clearDraft();
      done(ref, sent);
      /* The mail app opens AFTER the done screen is painted. Whatever the
         handler does to this tab, the reference is already in front of
         them — and if they never send the e-mail, the number they quote
         on the phone still finds the request. */
      if (!sent) setTimeout(function () { mailFallback(body, ref); }, 60);
    }

    if (!CFG.api) { finish(); return; }

    var ac = ('AbortController' in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (ac) ac.abort(); }, 12000);

    fetch(CFG.api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: ac ? ac.signal : undefined
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) { sent = d && d.ok !== false; ref = (d && d.ref) || ''; })
      .catch(function () { sent = false; })
      .then(function () { clearTimeout(to); finish(); });
  });
})();
