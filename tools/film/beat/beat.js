/* The beat engine. Every frame is a pure function of t, as before, so the
   frame-by-frame render and a live play are identical.

   A film is a list of hits. Each hit is held for a whole number of BEATS and
   the cut lands exactly on one; nothing dissolves. The words are on screen,
   there is no voice, and the music carries it.

   window.BEAT_CFG is appended ahead of this file by the renderer.            */
(function () {
  const BEAT = 0.608, BAR = BEAT * 4, FIRST = 0.289;

  const Q = new URLSearchParams(location.search);
  const SHAPE = ({ v: 'v', f: 'f', w: 'w' })[Q.get('shape')] || 'v';
  const W = SHAPE === 'w';
  document.body.dataset.shape = SHAPE;

  /* One unit, a share of the frame WIDTH. A feed plays any film about 400px
     wide whatever its pixels, so width is what decides whether a word reads. */
  const U = innerWidth / (W ? 1460 : 1080);
  document.documentElement.style.setProperty('--u', U.toFixed(5) + 'px');

  const cfg = window.BEAT_CFG, hitsEl = document.getElementById('hits');
  const flash = document.getElementById('flash'), bar = document.getElementById('bar');
  const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c;
    if (h != null) e.innerHTML = h; return e; };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  /* a hard, snappy ease: most of the move is over in the first third */
  const snap = p => 1 - Math.pow(1 - cl(p, 0, 1), 4);

  let at = FIRST;
  const hits = cfg.hits.map((h, idx) => {
    const d = h.b * BEAT;
    const o = { ...h, i: idx, from: at, to: at + d, d };
    at += d;

    const el = E('div', 'hit'); hitsEl.appendChild(el);
    el.appendChild(E('div', 'bg ' + (h.bg || 'navy')));
    if (h.bg === 'paper') el.classList.add('paper');
    if (h.bg === 'cyan') el.classList.add('oncyan');

    /* a screen, punched in and bleeding off the frame */
    if (h.shot) {
      const sw = E('div', 'shotw');
      const im = E('img'); im.src = 'img/' + h.shot;
      const p = h.pos || (W ? [-4, -12, 74] : [-12, 2, 118]);
      im.style.left = p[0] + '%'; im.style.top = p[1] + '%'; im.style.width = p[2] + '%';
      sw.appendChild(im); el.appendChild(sw);
      el.appendChild(E('div', 'veil'));
      o.im = im;
    }

    /* the shield, as the picture rather than a stamp */
    if (h.mark) {
      const m = E('div', 'mk', '<img src="img/mark.svg" alt="">');
      const s = h.marksize || (W ? 86 : 96);
      m.style.width = s + '%'; m.style.height = 'auto';
      m.style.left = (h.markx != null ? h.markx : (100 - s) / 2) + '%';
      m.style.top = (h.marky != null ? h.marky : -8) + '%';
      el.appendChild(m); o.mk = m;
    }

    const inner = E('div', 'inner ' + (h.align || (h.shot ? 'left' : 'mid')));
    el.appendChild(inner);

    /* the words, one span each so they can land one after another */
    o.words = [];
    (h.t || []).forEach(lineText => {
      const line = E('div', 'line');
      String(lineText).split(' ').forEach(w => {
        const sp = E('span', 'w', w === '*' ? '&nbsp;' : w);
        if (/^\{.*\}$/.test(w)) { sp.className = 'w cyanink'; sp.innerHTML = w.slice(1, -1); }
        line.appendChild(sp); o.words.push(sp);
      });
      inner.appendChild(line);
    });
    if (h.rule) { const r = E('div', 'rule'); inner.appendChild(r); o.rule = r; }
    if (h.sub) inner.appendChild(E('div', 'sub', h.sub));

    if (h.qr) {
      const q = E('div', 'qr',
        '<img src="img/qr-' + cfg.key + '.png" alt="">' +
        '<div class="url">' + cfg.url + '<div class="urls">' + (h.qr === true ? '' : h.qr) + '</div></div>');
      inner.appendChild(q); o.qrEl = q.querySelector('img');
    }

    o.el = el; o.inner = inner;
    o.lines = [].slice.call(inner.querySelectorAll('.line'));
    return o;
  });
  const DUR = at + (cfg.tail != null ? cfg.tail : 0.45);

  /* ── the type is fitted, never guessed ────────────────────────────────
     A card carries two to five words, so the size that fills the frame
     differs wildly card to card. Each line is grown until it fills about
     88% of the card's width, then the card is shrunk if it is too tall. */
  function fit() {
    hits.forEach(o => {
      if (!o.lines.length) return;
      const box = o.inner.getBoundingClientRect();
      const availW = box.width - (parseFloat(getComputedStyle(o.inner).paddingLeft) * 2);
      const cap = o.cap || (W ? 180 : 168);
      let size = cap;
      o.lines.forEach(l => l.style.fontSize = size * U + 'px');
      for (let p = 0; p < 26; p++) {
        let wide = 0, tall = 0;
        o.lines.forEach(l => {
          wide = Math.max(wide, l.scrollWidth);
          tall += l.getBoundingClientRect().height;
        });
        const extra = (o.qrEl ? o.qrEl.getBoundingClientRect().height + 120 * U : 0) +
                      (o.sub ? 70 * U : 0);
        if (wide <= availW && tall + extra <= box.height * 0.80) break;
        size *= 0.93;
        o.lines.forEach(l => l.style.fontSize = size * U + 'px');
      }
      o.size = size;
    });
  }

  const cuts = hits.map(h => h.from).slice(1);

  function SEEK(t) {
    hits.forEach(o => {
      const on = t >= o.from - 0.001 && t < o.to;
      const p = (t - o.from) / o.d;          /* 0..1 through the hit */
      if (!on) { o.el.style.opacity = 0; o.el.style.zIndex = 0; return; }
      o.el.style.opacity = 1; o.el.style.zIndex = 2;

      /* the card itself lands hard and then drifts, so a held beat is alive */
      const land = snap((t - o.from) / 0.14);
      const sc = 1.055 - 0.055 * land + p * 0.022;
      o.el.style.transform = 'scale(' + sc.toFixed(4) + ')';

      /* each word a sixth of a beat after the one before it */
      o.words.forEach((w, i) => {
        const e = snap((t - o.from - i * BEAT / 6) / 0.13);
        w.style.opacity = e.toFixed(3);
        w.style.transform = 'translate3d(0,' + ((1 - e) * 0.38).toFixed(3) + 'em,0) ' +
          'scale(' + (0.86 + 0.14 * e).toFixed(3) + ')';
      });

      if (o.rule) o.rule.style.width =
        (snap((t - o.from - 0.12) / 0.3) * (o.rulew || 46)).toFixed(1) + '%';

      /* a screen punches in and keeps moving */
      if (o.im) {
        const e = snap((t - o.from) / 0.26);
        o.im.style.transform = 'scale(' + (1.14 - 0.14 * e + p * 0.05).toFixed(4) + ') ' +
          'translate3d(0,' + ((1 - e) * -2.2 + p * 1.4).toFixed(2) + '%,0)';
      }
      if (o.mk) {
        const e = snap((t - o.from) / 0.3);
        o.mk.style.opacity = (0.10 + 0.12 * e).toFixed(3);
        o.mk.style.transform = 'scale(' + (1.18 - 0.18 * e + p * 0.04).toFixed(4) + ')';
      }
    });

    /* one frame of white on the cut, and the beat bar running underneath */
    let fl = 0;
    cuts.forEach(c => { if (t >= c && t < c + 0.085) fl = Math.max(fl, 1 - (t - c) / 0.085); });
    flash.style.opacity = (fl * 0.5).toFixed(3);
    bar.style.width = (cl((t - FIRST) / (DUR - FIRST), 0, 1) * 100).toFixed(2) + '%';
  }

  window.SEEK = SEEK;
  window.FILM_DUR = DUR;
  window.FILM_CUTS = cuts;
  window.FILM_FIT = () => hits.map(h => +((h.size || 0) / (W ? 180 : 168)).toFixed(3));

  function go() {
    fit(); SEEK(0);
    window.FILM_READY = true;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(go, 60));
  else setTimeout(go, 300);
})();
