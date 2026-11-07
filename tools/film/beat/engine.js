/* ─────────────────────────────────────────────────────────────────────────
   The recruiting-film engine.

   Every frame is a pure function of t, so a frame-by-frame render and a
   real-time play are identical and there is no capture drift to undo.

   The first cut of these films was eight full-screen text cards with a fade
   on them, and it was turned down in those words: "horrible fonts that take
   up the whole screen, no motion and no creativity". So the type is half what
   it was and shares the frame, and every scene now carries a drawn visual —
   a device, a ledger, a pipeline, a form that fills itself, a rail of terms —
   with a camera that pushes in, a light across every cut, and motes drifting
   behind. A scene names its visual with `vis`; the words never fill the frame
   alone unless the scene asks for `one`.

   The shape and the film come from the URL, BEFORE the scenes are built —
   reading a property the renderer sets after load silently gave the upright
   cut the wide layout once already.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const SHAPE = ({ v: 'v', f: 'f', w: 'w' })[Q.get('shape')] || 'w';

  /* ── the palettes ──────────────────────────────────────────────────────
     Three looks have been turned down now, so the next one is chosen rather
     than guessed: ?pal=<name> repaints the whole film, the same three frames
     are shot in each, and the branch picks. That is how the board films got
     their blue. `blob` is the moving ground's own colours, dark then light. */
  const PAL = {
    teal: {},                                   /* what is on screen today */
    blue: {  /* the board films' own midnight blue, chosen 15 Oct 2026 */
      navy:'#070F26', navy2:'#0f2452', navy3:'#13408F', navy4:'#1D5BC4',
      dg1:'#0d1b3d', dg2:'#070F26', dg3:'#050b1c',
      ground:'#f3f6fd', paper:'#ffffff', lg1:'#f8fafe', lg2:'#f3f6fd', lg3:'#e8eefb',
      ink:'#13408F', body:'#2b3a52', mute:'#5d6b84', line:'#dde5f4',
      teal:'#1D5BC4', 'teal-ink':'#13408F', cyan:'#00E5FF', 'cyan-lit':'#7df0ff', pale:'#bcd0f2',
      blob:[['19,64,143',.52],['42,109,224',.40],['0,229,255',.20],
            ['19,64,143',.12],['42,109,224',.14],['150,180,230',.10]] },
    violet: {
      navy:'#1e1536', navy2:'#2b1e4d', navy3:'#3b2a67', navy4:'#4d3785',
      dg1:'#2a1d4c', dg2:'#1e1536', dg3:'#160f28',
      ground:'#f8f6fc', paper:'#ffffff', lg1:'#fcfaff', lg2:'#f8f6fc', lg3:'#efe9fa',
      ink:'#3b2a67', body:'#3a3348', mute:'#6b6480', line:'#e6dff3',
      teal:'#6d4fc2', 'teal-ink':'#5a3eab', cyan:'#b9a0f5', 'cyan-lit':'#d3c4fb', pale:'#cfc2ef',
      blob:[['109,79,194',.50],['140,100,230',.38],['185,160,245',.22],
            ['109,79,194',.12],['185,160,245',.15],['200,190,230',.10]] },
    forest: {
      navy:'#0f2e26', navy2:'#164036', navy3:'#1d5547', navy4:'#276e5c',
      dg1:'#14392f', dg2:'#0f2e26', dg3:'#0a211c',
      ground:'#f6faf6', paper:'#ffffff', lg1:'#fafdfa', lg2:'#f6faf6', lg3:'#eaf3ec',
      ink:'#145040', body:'#33443d', mute:'#5f6f67', line:'#dfeae1',
      teal:'#1f7a60', 'teal-ink':'#15664f', cyan:'#6fd7ad', 'cyan-lit':'#9ee8c8', pale:'#bcdfcd',
      blob:[['31,122,96',.50],['44,150,110',.38],['111,215,173',.20],
            ['31,122,96',.12],['111,215,173',.15],['180,210,185',.10]] },
    ink: {   /* graphite and white: no hue at all, the most restrained */
      navy:'#1c2024', navy2:'#262b31', navy3:'#333a42', navy4:'#454e58',
      dg1:'#23282e', dg2:'#1c2024', dg3:'#15181b',
      ground:'#f6f6f5', paper:'#ffffff', lg1:'#fafafa', lg2:'#f6f6f5', lg3:'#ececeb',
      ink:'#1c2024', body:'#3b4248', mute:'#6b7178', line:'#e3e3e1',
      teal:'#44505c', 'teal-ink':'#2f3a45', cyan:'#cfd6dd', 'cyan-lit':'#e6ebf0', pale:'#c3cad1',
      blob:[['90,104,120',.42],['130,145,165',.30],['200,212,225',.16],
            ['120,130,145',.10],['170,185,200',.12],['210,215,220',.08]] },
    crimson: {
      navy:'#2a1518', navy2:'#3a1d21', navy3:'#4e262b', navy4:'#653239',
      dg1:'#361b1f', dg2:'#2a1518', dg3:'#1e0f12',
      ground:'#faf7f6', paper:'#ffffff', lg1:'#fdfbfa', lg2:'#faf7f6', lg3:'#f3eae9',
      ink:'#7a2franco', body:'#42383a', mute:'#6f6264', line:'#eee2e1',
      teal:'#b2353f', 'teal-ink':'#97262f', cyan:'#f0909a', 'cyan-lit':'#f7b8bf', pale:'#e8bcc0',
      blob:[['178,53,63',.46],['210,80,90',.34],['240,144,154',.18],
            ['178,53,63',.10],['240,144,154',.13],['225,200,200',.09]] }
  };
  PAL.crimson.ink = '#7a2730';
  const PALNAME = PAL[Q.get('pal')] ? Q.get('pal') : 'teal';
  (function () {
    const p = PAL[PALNAME], r = document.documentElement.style;
    Object.keys(p).forEach(k => { if (k !== 'blob') r.setProperty('--' + k, p[k]); });
  })();
  const FILM = Q.get('film') || 'bwadmin';
  document.body.dataset.shape = SHAPE;
  const V = SHAPE === 'v', F = SHAPE === 'f', W = SHAPE === 'w';

  /* The unit is a share of the FRAME WIDTH, not of the short edge: a feed
     video is shown about 400px wide whatever its pixel size, so width is what
     decides whether a word can be read. */
  const U = innerWidth / (W ? 1460 : 1080);
  document.documentElement.style.setProperty('--u', U.toFixed(5) + 'px');

  const BEAT = 0.608;
  const cl = (x, a, c) => Math.max(a, Math.min(c, x));
  const pr = (t, s, d) => cl((t - s) / d, 0, 1);
  const out = x => 1 - Math.pow(1 - x, 3);
  const io = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const E = (tag, cls, html) => { const e = document.createElement(tag);
    if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  const host = document.getElementById('scenes');
  const railI = document.querySelector('#rail i');
  const flash = document.getElementById('flash');
  const sweep = document.getElementById('sweep');
  const wipe = document.getElementById('wipe');

  const cfg = window.FILM_CFG;
  const scenes = [];
  let at = 0;

  /* a repeatable pseudo-random, so the motes drift instead of jittering: the
     renderer draws each frame on its own and a Math.random field would be a
     different field every frame */
  const rnd = s => { let x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

  const CURSOR = '<svg viewBox="0 0 24 24" fill="#fff" stroke="#0b1b2d" stroke-width="1.4">' +
    '<path d="M5 2l14 10-6 1.2 3.4 6.6-2.6 1.3L10.4 14 5 18z"/></svg>';

  cfg.scenes.forEach((s, si) => {
    const el = E('div', 'sc ' + (s.bg || 'dark'));
    host.appendChild(el);
    const cam = E('div', 'cam'); el.appendChild(cam);
    const o = { el, cam, from: at, to: at + s.d, items: [], spec: s, si };
    at += s.d;
    scenes.push(o);

    /* The moving ground: a half-resolution canvas per scene carrying three
       soft blobs and a dot grid with a light travelling across it. Half
       resolution because it is blurred anyway, and because nine full-frame
       canvases is memory the renderer does not need to spend. Everything is a
       function of t, like the rest of the film. */
    const can = E('canvas', 'aur');
    can.width = Math.round(innerWidth / 2); can.height = Math.round(innerHeight / 2);
    can.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
    cam.appendChild(can);
    o.can = can; o.ctx = can.getContext('2d'); o.lit = s.bg === 'light';

    const field = E('div', 'field'); cam.appendChild(field); o.field = field;

    /* motes: twelve, placed from the scene's own index so they are the same
       every render and simply drift */
    o.motes = [];
    for (let i = 0; i < 12; i++) {
      const m = E('div', 'mote');
      const sz = (3 + rnd(si * 31 + i) * 7);
      m.style.width = (sz * U).toFixed(1) + 'px';
      m.style.height = (sz * U).toFixed(1) + 'px';
      m.style.left = (rnd(si * 17 + i * 3) * 100).toFixed(2) + '%';
      m.style.top = (rnd(si * 53 + i * 7) * 100).toFixed(2) + '%';
      cam.appendChild(m);
      o.motes.push({ el: m, sp: .3 + rnd(si * 11 + i) * .9, dx: rnd(si * 7 + i * 5) - .5 });
    }

    const pad = E('div', 'pad' + (s.vis ? '' : ' one')); cam.appendChild(pad);
    /* a scene whose visual needs more of the frame than the words do says so;
       the ledger's two sub-columns are unreadable in a plain half */
    if (s.vis === 'dev') { pad.classList.add('hero'); cam.appendChild(E('div', 'scrim')); }
    if (s.split && !V && !F && !pad.classList.contains('hero'))
      pad.style.gridTemplateColumns = '1fr ' + s.split + 'fr';
    const words = E('div', 'words'); pad.appendChild(words);
    const theatre = E('div', 'theatre'); pad.appendChild(theatre);
    o.theatre = theatre;

    let k = 0;
    const step = () => o.from + .18 + (k++) * .13;

    if (s.eyebrow) {
      const eb = E('div', 'eyebrow' + (s.bg === 'light' ? ' dk' : ''), '<i></i><u style="text-decoration:none">' + s.eyebrow + '</u>');
      words.appendChild(eb);
      o.items.push({ el: eb, t: o.from + .08, kind: 'fade' });
      o.items.push({ el: eb.querySelector('i'), t: o.from + .14, kind: 'grow', to: 40 * U });
    }
    (s.h || []).forEach((line, li) => {
      const h = E('h1', (s.hsize || 'big') + ' ' + (line.c || (s.bg === 'light' ? 'ink' : 'white')));
      words.appendChild(h);
      (line.t || line).split(' ').forEach(w => {
        const sp = E('span', 'w', w + '&nbsp;');
        h.appendChild(sp);
        o.items.push({ el: sp, t: step(), kind: 'rise' });
      });
      k += .5;
      if (line.ul) {                      /* a rule that draws under the line */
        const u = E('div', 'ul'); words.appendChild(u);
        o.items.push({ el: u, t: o.from + .5 + li * .3, kind: 'grow', to: 120 * U });
      }
    });
    if (s.sub) {
      const d = E('div', 'sm ' + (s.subc || (s.bg === 'light' ? 'pale2' : 'cy')));
      d.innerHTML = s.sub; words.appendChild(d);
      o.items.push({ el: d, t: o.from + Math.max(.6, s.d * .42), kind: 'fade' });
    }

    /* ── the theatre ──────────────────────────────────────────────── */
    const vis = s.vis;
    if (vis === 'dev') {
      /* big enough to run off two edges: a shot of a thing, not a thumbnail */
      const POS = W ? [[-6, -14, 46], [40, 8, 64]] : [[-18, 1, 82], [14, 29, 104]];
      (s.shots || []).slice(0, 2).forEach((src, i) => {
        const p = POS[i] || POS[0];
        const d = E('div', 'dev ' + (/lap|production|queue|transmittal|ff-|jr-/.test(src) ? 'lap' : 'ph'),
          '<img src="img/' + src + '" alt=""><div class="glare"></div>');
        d.style.left = p[0] + '%'; d.style.top = p[1] + '%'; d.style.width = p[2] + '%';
        theatre.appendChild(d);
        o.items.push({ el: d, t: o.from + .2 + i * .34, kind: 'dev', i: i });
      });
    } else if (vis === 'nums') {
      const n = E('div', 'nums'); theatre.appendChild(n);
      n.style.gridTemplateColumns = 'repeat(2,1fr)';
      s.nums.forEach(([v, l], i) => {
        const d = E('div', 'num', '<b data-to="' + v + '">0</b><span>' + l + '</span><i></i>');
        n.appendChild(d);
        o.items.push({ el: d, t: o.from + .35 + i * .26, kind: 'count' });
        o.items.push({ el: d.querySelector('i'), t: o.from + .5 + i * .26, kind: 'grow', to: 84 * U });
      });
    } else if (vis === 'stack') {
      const list = E('div', 'stack'); theatre.appendChild(list);
      const n = s.stack.length;
      s.stack.forEach((row, i) => {
        const r = E('div', 'srow', '<b>' + (i + 1) + '</b><span>' + row + '</span>');
        list.appendChild(r);
        o.items.push({ el: r, t: o.from + .28 + i * Math.max(.34, (s.d - 1.4) / n), kind: 'slide' });
      });
      o.items.push({ el: list, t: o.from + .3, kind: 'line', to: (n - 1) * 56 * U });
    } else if (vis === 'ledger') {
      const g = E('div', 'ledg'); theatre.appendChild(g);
      const a = E('div', 'lcol them', '<div class="lh">' + (s.ledger.lh || 'Usually') + '</div>');
      const b = E('div', 'lcol us', '<div class="lh">' + (s.ledger.rh || 'Here') + '</div>');
      g.appendChild(a); g.appendChild(b);
      const n = Math.max(s.ledger.l.length, s.ledger.r.length);
      const gap = Math.max(.26, (s.d - 1.6) / (n * 2));
      s.ledger.l.forEach((x, i) => {
        const li = E('div', 'li them', '<s>' + x + '</s>'); a.appendChild(li);
        o.items.push({ el: li, t: o.from + .3 + i * gap, kind: 'slide' });
        o.items.push({ el: li.querySelector('s'), t: o.from + .55 + i * gap, kind: 'strike' });
      });
      s.ledger.r.forEach((x, i) => {
        const li = E('div', 'li', x); b.appendChild(li);
        o.items.push({ el: li, t: o.from + .4 + i * gap, kind: 'slide' });
      });
    } else if (vis === 'flow') {
      const f = E('div', 'flow'); theatre.appendChild(f);
      s.flow.forEach((x, i) => {
        const st = E('div', 'fst', '<div class="fdot">' + (i + 1) + '</div><span>' + x + '</span>');
        f.appendChild(st);
        o.items.push({ el: st, t: o.from + .3 + i * .3, kind: 'pop' });
      });
      const r = E('div', 'rider'); f.appendChild(r);
      o.items.push({ el: r, t: o.from + .5, kind: 'ride', span: s.d - 1.1 });
    } else if (vis === 'doc') {
      const d = E('div', 'doc'); theatre.appendChild(d);
      s.doc.forEach((x, i) => {
        const r = E('div', 'drow', '<div class="dk">' + x + '</div><div class="dv"><i></i></div>');
        d.appendChild(r);
        o.items.push({ el: r.querySelector('i'), t: o.from + .4 + i * .3, kind: 'fill' });
      });
      const st = E('div', 'dstamp', s.stamp || 'FILLED');
      d.appendChild(st);
      o.items.push({ el: d, t: o.from + .2, kind: 'pop' });
      o.items.push({ el: st, t: o.from + Math.max(1.1, s.d - 1.5), kind: 'stamp' });
    } else if (vis === 'rail') {
      const r = E('div', 'rail', '<div class="rbar"></div>');
      const stops = E('div', 'rstops'); r.appendChild(stops);
      theatre.appendChild(r);
      s.rail.forEach((x, i) => {
        const st = E('div', 'rst', '<b></b><span>' + x + '</span>');
        stops.appendChild(st);
        o.items.push({ el: st, t: o.from + .35 + i * .26, kind: 'pop' });
      });
      o.items.push({ el: r.querySelector('.rbar'), t: o.from + .35, kind: 'bar', span: s.d - 1.2 });
    } else if (vis === 'mark') {
      /* the statement scenes: the line IS the picture. The shield becomes a
         huge watermark bleeding off the corner instead of a stamp in a box,
         and the words take the frame. */
      pad.classList.add('one');
      const m = E('div', 'markbg', '<img src="img/' + (s.mark || 'mark.svg') + '" alt="">');
      for (let i = 0; i < 3; i++) { const p = E('div', 'ping'); m.appendChild(p);
        o.items.push({ el: p, t: o.from + .5 + i * .55, kind: 'ping' }); }
      cam.appendChild(m);
      o.items.push({ el: m.querySelector('img'), t: o.from + .15, kind: 'pop' });
    } else if (vis === 'qr') {
      const q = E('div', 'qrbox',
        '<div style="position:relative"><img src="img/qr-' + FILM + '.png" alt="">' +
        '<div class="scan"></div></div>' +
        '<div class="url">' + cfg.url + '<small>' + (s.qr || '') + '</small></div>');
      theatre.appendChild(q);
      o.items.push({ el: q, t: o.from + .2, kind: 'fade' });
      o.still = true; o.qrimg = q.querySelector('img');
      o.items.push({ el: q.querySelector('.scan'), t: o.from + .7, kind: 'scan' });
    }

    /* a cursor that travels and presses, when the scene asks for one */
    if (s.tap) {
      const c = E('div', 'cur', CURSOR), tp = E('div', 'tap');
      theatre.appendChild(tp); theatre.appendChild(c);
      o.items.push({ el: c, t: o.from + .7, kind: 'cur', at: s.tap, ring: tp });
    }
  });

  const DUR = at;
  const CUTS = scenes.map(s => s.from).slice(1);

  /* ── the moving ground ──────────────────────────────────────────────── */
  const PB = PAL[PALNAME].blob;
  const BLOB = PB
    ? { dark: PB.slice(0, 3), light: PB.slice(3) }
    : { dark: [['47,131,152', .50], ['72,108,158', .40], ['127,212,222', .22]],
        light:[['0,114,141', .13], ['127,212,222', .17], ['186,176,146', .11]] };
  function paint(o, t) {
    const c = o.ctx, w = o.can.width, h = o.can.height, u = t - o.from;
    c.clearRect(0, 0, w, h);

    /* three blobs drifting on their own sine paths */
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.filter = 'blur(' + Math.round(w * .07) + 'px)';
    BLOB[o.lit ? 'light' : 'dark'].forEach((b, i) => {
      const sp = .13 + i * .055, ph = i * 2.1 + o.si;
      const x = w * (.3 + .42 * (.5 + .5 * Math.sin(u * sp + ph)));
      const y = h * (.28 + .46 * (.5 + .5 * Math.cos(u * sp * .83 + ph * 1.4)));
      const r = w * (.26 + .07 * Math.sin(u * .22 + ph));
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + b[0] + ',' + b[1] + ')');
      g.addColorStop(1, 'rgba(' + b[0] + ',0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    });
    c.restore();

    /* a dot grid, with a band of light crossing it */
    const step = Math.max(14, Math.round(w / 46));
    const band = ((u * .17) % 1.5) * w * 1.3 - w * .15;
    const base = o.lit ? '20,70,95' : '190,224,235';
    for (let x = step; x < w; x += step) {
      const d = Math.abs(x - band);
      const lift = Math.max(0, 1 - d / (w * .17));
      const al = (o.lit ? .05 : .07) + lift * (o.lit ? .07 : .16);
      c.fillStyle = 'rgba(' + base + ',' + al.toFixed(3) + ')';
      for (let y = step; y < h; y += step) {
        const rr = .9 + lift * 1.5;
        c.beginPath(); c.arc(x, y, rr, 0, 6.2832); c.fill();
      }
    }
  }

  /* ── make every scene fit its own frame ────────────────────────────────
     The wide cut has a third of the height of the upright one and the same
     words. Each scene measures the sum of its own children, after the font
     has loaded, and shrinks its OWN --u until it fits inside 88% of the
     frame. Measure the children, not scrollHeight (a centred flex column
     overflows at both ends), and measure before SEEK (which puts a scale on
     the scene and inflates every rect). */
  function need(o) {
    const pad = o.cam.querySelector('.pad'), cs = getComputedStyle(pad);
    /* In a hero scene the theatre is absolutely positioned across the whole
       frame, so counting it makes `need` the height of the frame itself and
       the fit pass shrinks the words to nothing. Only the words are measured
       there. */
    const hero = pad.classList.contains('hero');
    const col = [].slice.call(o.cam.querySelectorAll(hero ? '.words' : '.words,.theatre'));
    let h = 0;
    col.forEach(c => { h = Math.max(h, c.getBoundingClientRect().height); });
    if ((V || F) && !hero) {            /* stacked: the two add up */
      h = 0; col.forEach(c => { h += c.getBoundingClientRect().height; });
      h += parseFloat(cs.rowGap) || 0;
    }
    return h + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  }
  function fit() {
    scenes.forEach(o => {
      const avail = o.el.clientHeight * .97;   // the pad already holds the margin
      let f = 1;
      for (let p = 0; p < 3; p++) {
        const n = need(o);
        if (n <= avail) break;
        f = Math.max(.5, f * (avail / n));
        o.el.style.setProperty('--u', (U * f).toFixed(5) + 'px');
      }
      /* The upright and feed shapes have height to spare that the wide cut
         does not, and a scene floating in the middle of a tall frame reads as
         an accident. Grow --u back up until the scene fills about three
         quarters of its frame, re-measuring each step (growing the type adds
         lines, which adds height) and backing off the moment anything would
         run off the side. */
      if (V || F) {
        const want = o.el.clientHeight * .76;
        const pad = o.cam.querySelector('.pad');
        for (let p = 0; p < 7 && f < 1.3; p++) {
          if (need(o) >= want) break;
          const g = Math.min(1.3, f * 1.055);
          o.el.style.setProperty('--u', (U * g).toFixed(5) + 'px');
          if (need(o) > avail || pad.scrollWidth > pad.clientWidth + 1) {
            o.el.style.setProperty('--u', (U * f).toFixed(5) + 'px'); break;
          }
          f = g;
        }
      }
      o.fit = f;
      /* and the code itself to whole pixels: 490u of a 1.315px unit is 644.35,
         and a fractional size resamples every module edge. */
      if (o.qrimg) {
        const w = Math.round(o.qrimg.getBoundingClientRect().width);
        o.qrimg.style.width = o.qrimg.style.height = w + 'px';
      }
    });
  }

  function SEEK(t) {
    scenes.forEach(s => {
      const inn = pr(t, s.from, .34), off = pr(t, s.to, .26);
      const vis = Math.min(inn, 1 - off);
      s.el.style.opacity = vis;
      s.el.style.zIndex = vis > 0 ? (t >= s.from ? 2 : 1) : 0;

      /* the cut: the incoming scene pushes in from the side, the outgoing one
         keeps going — a push, not a dissolve */
      const push = (1 - io(inn)) * 7 - io(off) * 7;
      s.el.style.transform = 'translate3d(' + push.toFixed(3) + '%,0,0)';

      /* the camera pushes in slowly for the whole scene */
      const u = cl((t - s.from) / Math.max(.001, s.to - s.from), 0, 1);
      /* The camera pushes in slowly across every scene, which is what keeps a
         held frame alive — and it is exactly what makes a QR code unreliable.
         A continuously changing, non-integer scale resamples the code's
         modules differently on every frame, so it decodes at one timestamp and
         not at the next once a feed has shrunk the picture to ~405px. The
         closing scene therefore holds its camera at 1, and takes its motion
         from the moving ground, the scan line and the words instead. */
      s.cam.style.transform = s.still ? 'scale(1)' : 'scale(' + (1.015 + u * .055).toFixed(4) + ')';

      if (vis > .012) paint(s, t);
      if (s.field) s.field.style.transform =
        'translate3d(' + (u * 5 - 2.5).toFixed(2) + '%,' + (u * -4).toFixed(2) + '%,0)';
      s.motes.forEach((m, i) => {
        const tt = (t - s.from) * m.sp;
        m.el.style.transform = 'translate3d(' + (m.dx * tt * 22).toFixed(1) + 'px,' +
          (-tt * 16).toFixed(1) + 'px,0)';
      });

      s.items.forEach(it => {
        const el = it.el;
        const q = pr(t, it.t, it.kind === 'count' ? .9 : .42), e = out(q);
        switch (it.kind) {
          case 'rise':
            el.style.opacity = e;
            el.style.transform = 'translateY(' + ((1 - e) * .42).toFixed(3) + 'em)';
            el.style.filter = q < 1 ? 'blur(' + ((1 - e) * 7).toFixed(1) + 'px)' : 'none';
            break;
          case 'slide':
            el.style.opacity = e;
            el.style.transform = 'translateX(' + ((1 - e) * -34).toFixed(1) + 'px)';
            break;
          /* opacity only, no scale: used by the QR, which has to arrive at
             exactly the size it will hold at and never be resampled. */
          case 'fade':
            el.style.opacity = e;
            break;
          case 'pop':
            el.style.opacity = e;
            el.style.transform = 'scale(' + (.86 + .14 * e).toFixed(4) + ')';
            break;
          case 'dev': {
            el.style.opacity = e * .99;
            const fl = (t - it.t);
            const flo = Math.sin(fl * 1.05 + it.i * 2.1) * 1.3;
            const rot = (1 - e) * (it.i ? 4 : -4) + Math.sin(fl * .8 + it.i) * .5;
            /* a real tilt in three dimensions, easing out of the entrance:
               the frame turns toward the camera and keeps breathing */
            const ry = (it.i ? 1 : -1) * (7 * (1 - e) + 3.4 + Math.sin(fl * .55 + it.i) * 1.6);
            const rx = 2.2 + Math.cos(fl * .47 + it.i * 1.7) * 1.4;
            el.style.transform = 'translateY(' + ((1 - e) * 54 + flo).toFixed(2) + 'px)' +
              ' rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg) rotate(' +
              rot.toFixed(2) + 'deg) scale(' + (.94 + .06 * e).toFixed(3) + ')';
            const g = el.querySelector('.glare');
            if (g) { const gp = ((fl * .22) % 1); g.style.transform = 'translateX(' + (gp * 230 - 115).toFixed(1) + '%)'; }
            break;
          }
          case 'count': {
            const f = pr(t, it.t, .3);
            el.style.opacity = f;
            el.style.transform = 'translateY(' + ((1 - out(f)) * 20).toFixed(1) + 'px)';
            const n = el.querySelector('b'), to = +n.dataset.to;
            const v = Math.round(to * out(q));
            n.textContent = to >= 100000 ? (v >= 1000 ? Math.round(v / 1000) + 'k' : String(v))
                                         : v.toLocaleString('en');
            break;
          }
          case 'grow': el.style.width = (it.to * e).toFixed(1) + 'px'; break;
          /* the connector down the stack: its ::before reads --h */
          case 'line': el.style.setProperty('--h', (it.to * e).toFixed(1) + 'px'); break;
          case 'strike': el.style.setProperty('--sw', (100 * e).toFixed(1) + '%'); break;
          case 'fill': el.style.width = (100 * e).toFixed(1) + '%'; break;
          case 'bar': {
            const b = cl((t - it.t) / Math.max(.001, it.span), 0, 1);
            el.style.width = (100 * io(b)).toFixed(1) + '%';
            break;
          }
          case 'ride': {
            const b = cl((t - it.t) / Math.max(.001, it.span), 0, 1);
            el.style.opacity = b > 0 && b < 1 ? 1 : (b >= 1 ? 1 : 0);
            el.style.transform = 'translateX(' + (io(b) * (el.parentElement.clientWidth * .92)).toFixed(1) + 'px)';
            break;
          }
          case 'stamp': {
            el.style.opacity = e;
            el.style.transform = 'rotate(-5deg) scale(' + (1.5 - .5 * e).toFixed(3) + ')';
            break;
          }
          case 'ping': {
            const p = ((t - it.t) / 2.1);
            const pp = p < 0 ? 0 : (p % 1);
            el.style.opacity = p < 0 ? 0 : (1 - pp) * .5;
            el.style.transform = 'scale(' + (1 + pp * 1.5).toFixed(3) + ')';
            break;
          }
          case 'scan': {
            const p = (t - it.t) / 1.25;
            const pp = p < 0 ? 0 : Math.min(1, p);
            el.style.opacity = (p > 0 && p < 1) ? .9 : 0;
            el.style.transform = 'translateY(' + (pp * 240 * U).toFixed(1) + 'px)';
            break;
          }
          case 'cur': {
            const p = (t - it.t);
            if (p < 0) { el.style.opacity = 0; it.ring.style.opacity = 0; break; }
            const travel = cl(p / .62, 0, 1), press = cl((p - .62) / .22, 0, 1);
            el.style.opacity = cl(p / .2, 0, 1) * (1 - cl((p - 1.5) / .4, 0, 1));
            const x = (it.at[0] / 100) * el.parentElement.clientWidth,
                  y = (it.at[1] / 100) * el.parentElement.clientHeight;
            el.style.left = '0'; el.style.top = '0';
            el.style.transform = 'translate(' + (x - 60 * U + io(travel) * 60 * U).toFixed(1) + 'px,' +
              (y + 70 * U - io(travel) * 70 * U).toFixed(1) + 'px) scale(' + (1 - press * .14).toFixed(3) + ')';
            const rp = cl((p - .76) / .7, 0, 1);
            it.ring.style.left = x + 'px'; it.ring.style.top = y + 'px';
            it.ring.style.opacity = rp > 0 && rp < 1 ? (1 - rp) * .9 : 0;
            it.ring.style.transform = 'scale(' + (.3 + rp * 1.5).toFixed(3) + ')';
            break;
          }
          default:
            el.style.opacity = e;
            el.style.transform = 'translateY(' + ((1 - e) * 14).toFixed(1) + 'px)';
        }
      });
    });

    railI.style.width = (100 * cl(t / DUR, 0, 1)).toFixed(2) + '%';
    const ph = (t % BEAT) / BEAT;
    railI.style.filter = 'brightness(' + (1 + .6 * Math.pow(1 - ph, 5)).toFixed(3) + ')';

    let fl = 0, sw = 0, swx = 0;
    CUTS.forEach(x => {
      if (t >= x - .02 && t < x + .55) { const u = (t - x + .02) / .57; sw = Math.max(sw, 1 - u); swx = u; }
      if (t >= x && t < x + .11) fl = Math.max(fl, 1 - (t - x) / .11);
    });
    flash.style.opacity = (fl * .22).toFixed(3);
    if (wipe) {
      let wv = 0, wx = 0;
      CUTS.forEach(x => {
        if (t >= x - .18 && t < x + .52) {
          const u = (t - x + .18) / .70;
          wv = Math.max(wv, Math.sin(Math.PI * u)); wx = u;
        }
      });
      wipe.style.opacity = (wv * .85).toFixed(3);
      wipe.style.transform = 'translateX(' + (wx * 420).toFixed(1) + '%) skewX(-9deg)';
    }
    sweep.style.opacity = (sw * .5).toFixed(3);
    sweep.style.transform = 'translateX(' + ((swx * 220) - 110).toFixed(1) + '%)';
  }

  window.SEEK = SEEK; window.FILM_DUR = DUR; window.FILM_BEAT = BEAT;
  window.FILM_CUTS = CUTS;
  window.FILM_FIT = () => scenes.map(s => +(s.fit || 1).toFixed(3));
  window.FILM_FIT_RUN = fit;
  window.FILM_NEED = () => scenes.map(s => [Math.round(need(s)), Math.round(s.el.clientHeight * .97)]);

  (async () => {
    try {
      const b64 = await (await fetch('inter.b64')).text();
      const f = new FontFace('Inter', 'url(data:font/woff2;base64,' + b64.trim() + ') format("woff2")',
        { weight: '100 900' });
      await f.load(); document.fonts.add(f);
    } catch (e) { /* the system Inter stands in */ }
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.complete ? 1 :
      new Promise(r => { i.onload = i.onerror = r; })));
    fit();
    SEEK(0);
    window.FILM_READY = true;
  })();
})();
