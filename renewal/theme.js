/* The renewal experience's helpers, shared by every renewal page (see theme.css).
   Plain script, no library: window.RR. Nothing here fetches anything. */
(function () {
  'use strict';
  var calm = function () { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* Line icons on a 24-unit grid, 1.9 stroke, round caps (the motor quote's set, widened). */
  var P = {
    car: '<path d="M3 13l2-5.4A2.2 2.2 0 0 1 7 6h10a2.2 2.2 0 0 1 2 1.6L21 13v4.2a.8.8 0 0 1-.8.8H19M3 13v4.2c0 .4.4.8.8.8H5M3 13h18M9 18h6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
    shield: '<path d="M12 3l8 3.2v5.6c0 4.6-3.4 8.2-8 9.2-4.6-1-8-4.6-8-9.2V6.2z"/><path d="M8.6 12.2l2.4 2.4 4.6-5"/>',
    renew: '<path d="M20 11a8 8 0 0 0-14.4-4.6L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.4 4.6L20 16"/><path d="M20 21v-5h-5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    money: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
    doc: '<path d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 2.5V8h5.5"/><path d="M8.5 13h7M8.5 17h5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16.2 9.5"/>',
    alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    phone: '<path d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11 11 0 0 0 5.2 5.2l1.4-2.1 4.2 1.6V17a2.5 2.5 0 0 1-2.7 2.5A16 16 0 0 1 2.5 6.2 2.5 2.5 0 0 1 5 3.5z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    filter: '<path d="M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5"/><path d="M20 3.5v5h-5"/>',
    out: '<path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10"/><path d="M15 16l4-4-4-4M19 12H9"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    task: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 9l2 2 4-4M8 15.5h8"/>',
    send: '<path d="M21 3.5L10.5 14M21 3.5l-6.5 17-4-6.5-6.5-4z"/>',
    gift: '<rect x="3.5" y="8" width="17" height="5" rx="1"/><path d="M5 13v7.5h14V13M12 8v12.5M12 8C10 4 6.5 4.5 7 7c.3 1.3 2.6 1 5 1zm0 0c2-4 5.5-3.5 5-1-.3 1.3-2.6 1-5 1z"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8-2.5-2.5 8-8M14.5 6.5L13 5l-8 8 2.5 2.5"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8.4 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z"/>',
    map: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
    survey: '<path d="M9 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H15"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>'
  };
  function i(name, cls) {
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.info) + '</svg>';
  }

  /* Soft waves along the foot of a band, the front one the card's own white. */
  var WAVES = '<div class="waves" aria-hidden="true"><svg class="w1" viewBox="0 0 2880 120" preserveAspectRatio="none"><path d="M0 52 Q180 14 360 52 T720 52 T1080 52 T1440 52 T1800 52 T2160 52 T2520 52 T2880 52 V120 H0z" fill="rgba(255,255,255,.14)"/></svg>' +
    '<svg class="w2" viewBox="0 0 2880 120" preserveAspectRatio="none"><path d="M0 70 Q240 36 480 70 T960 70 T1440 70 T1920 70 T2400 70 T2880 70 V120 H0z" fill="rgba(255,255,255,.22)"/></svg>' +
    '<svg class="w3" viewBox="0 0 2880 120" preserveAspectRatio="none"><path d="M0 92 Q160 74 320 92 T640 92 T960 92 T1280 92 T1600 92 T1920 92 T2240 92 T2560 92 T2880 92 V120 H0z" fill="#fff"/></svg></div>';
  function bands(root) {
    (root || document).querySelectorAll('.rr-band:not(.has-waves)').forEach(function (b) {
      b.classList.add('has-waves');
      b.insertAdjacentHTML('afterbegin', '<span class="glide" aria-hidden="true"></span>');
      b.insertAdjacentHTML('beforeend', WAVES);
    });
  }

  /* A whole number that counts up on screen; the real figure stays in the text. */
  function cu(n) {
    var v = Math.max(0, Math.round(Number(n) || 0));
    return '<b class="cu" style="--to:' + v + '"><span class="vh">' + v + '</span></b>';
  }
  function money(n, cur) {
    var v = Number(n); if (!isFinite(v)) return '';
    return (cur || 'TT$ ') + Math.round(v).toLocaleString('en-US');
  }

  /* Charts. Every value is written in the text, so a screen reader, a copy
     and a test all read the number, not only the length of a bar. */
  function bars(rows, o) {
    o = o || {};
    var max = Math.max.apply(null, rows.map(function (r) { return Number(r.v) || 0; }).concat([1]));
    return '<div class="rr-bars" role="list">' + rows.map(function (r, k) {
      var w = Math.round((Number(r.v) || 0) / max * 100);
      return '<div class="rr-bar" role="listitem" style="' + (r.c ? '--c:' + r.c + ';--c2:' + r.c + ';' : '') + '"><span class="l" title="' + esc(r.l) + '">' + esc(r.l) + '</span>' +
        '<span class="t" aria-hidden="true"><i style="--w:' + w + '%;animation-delay:' + (k * 0.06) + 's"></i></span><span class="n">' + esc(r.t != null ? r.t : (o.money ? money(r.v) : r.v)) + '</span></div>';
    }).join('') + '</div>';
  }
  function cols(rows, o) {
    o = o || {};
    var max = Math.max.apply(null, rows.map(function (r) { return Number(r.v) || 0; }).concat([1]));
    return '<div class="rr-cols" role="list">' + rows.map(function (r, k) {
      var h = Math.round((Number(r.v) || 0) / max * 88);
      return '<div class="c' + (r.now ? ' now' : '') + '" role="listitem" aria-label="' + esc(r.l + ': ' + (r.t != null ? r.t : r.v)) + '"><b>' + esc(r.t != null ? r.t : r.v) + '</b><i style="--h:' + h + '%;animation-delay:' + (k * 0.05) + 's"></i></div>';
    }).join('') + '</div><div class="rr-cols-l" aria-hidden="true">' + rows.map(function (r) { return '<span>' + esc(r.l) + '</span>'; }).join('') + '</div>';
  }
  function stack(parts) {
    var total = parts.reduce(function (a, p) { return a + (Number(p.v) || 0); }, 0) || 1;
    return '<div class="rr-stack" aria-hidden="true">' + parts.map(function (p, k) {
      return '<i style="--w:' + ((Number(p.v) || 0) / total * 100).toFixed(2) + '%;--c:' + p.c + ';animation-delay:' + (k * 0.12) + 's"></i>';
    }).join('') + '</div><ul class="rr-key">' + parts.map(function (p) {
      return '<li style="--c:' + p.c + '">' + esc(p.l) + ' <b>' + esc(p.v) + '</b></li>';
    }).join('') + '</ul>';
  }
  function ring(p, big, small, o) {
    o = o || {};
    var v = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
    return '<div class="rr-ring' + (o.lg ? ' lg' : '') + '" style="--p:' + v + (o.c ? ';--c:' + o.c : '') + '" role="img" aria-label="' + esc(o.label || (big + ' ' + (small || ''))) + '"><span><b>' + esc(big) + '</b><small>' + esc(small || '') + '</small></span></div>';
  }
  function tile(k, v, o) {
    o = o || {};
    var tag = o.onclick || o.button ? 'button type="button"' : 'div';
    var end = o.onclick || o.button ? 'button' : 'div';
    return '<' + tag + ' class="rr-tile ' + (o.tone ? 't-' + o.tone : '') + (o.on ? ' on' : '') + '"' + (o.onclick ? ' onclick="' + esc(o.onclick) + '"' : '') + (o.id ? ' id="' + esc(o.id) + '"' : '') + '>' +
      '<span class="k">' + (o.icon ? i(o.icon) : '') + esc(k) + '</span><span class="v">' + (typeof v === 'number' && !o.raw ? cu(v) : esc(v)) + '</span>' +
      (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</' + end + '>';
  }

  function toast(msg, tone) {
    var t = document.createElement('div');
    t.className = 'rr-toast' + (tone ? ' ' + tone : '');
    t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; }, 3200);
    setTimeout(function () { t.remove(); }, 3600);
  }

  /* Below the first screen, each section waits and rises in as it is reached. */
  var RV = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('sr-in'); RV.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -6% 0px' }) : null;
  function reveal(root) {
    if (!RV || calm()) return;
    document.documentElement.classList.add('js-sr');
    (root || document).querySelectorAll('.sr:not(.sr-in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.94) el.classList.add('sr-in'); else RV.observe(el);
    });
  }

  /* A ripple from where the finger lands. */
  document.addEventListener('pointerdown', function (ev) {
    var el = ev.target.closest && ev.target.closest('.rr-btn,.rr-tile,button.rr-item,a.rr-item,.rr-opts button');
    if (!el || el.disabled || calm()) return;
    var r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
    s.className = 'rip';
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (ev.clientX - r.left - d / 2) + 'px;top:' + (ev.clientY - r.top - d / 2) + 'px';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(s); setTimeout(function () { s.remove(); }, 650);
  }, { passive: true });

  /* The thin line under the top bar shows how far down the page you are. */
  function progress() {
    var bar = document.querySelector('.rr-top .prog'); if (!bar) return;
    var on = function () { var h = document.documentElement.scrollHeight - innerHeight; bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h) : 0); };
    addEventListener('scroll', on, { passive: true }); on();
  }

  function init(root) { bands(root); reveal(root); }
  window.RR = { i: i, esc: esc, cu: cu, money: money, bars: bars, cols: cols, stack: stack, ring: ring, tile: tile, toast: toast, reveal: reveal, bands: bands, init: init, calm: calm, icons: Object.keys(P) };
  var go = function () { document.body && document.body.classList.add('rr'); init(); progress(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
