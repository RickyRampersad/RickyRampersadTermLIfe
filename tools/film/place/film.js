/* ── Build with us · the place ───────────────────────────────────────────
   Every frame is a pure function of t. The renderer seeks; it never plays.
   So nothing here may live in a CSS animation or a timer. */
(function(){
  var LEAD = 0.289, BAR = 2.432;            /* 98.7 BPM, the branch bed */
  var DISS = 0.16;                          /* dissolve between shots */

  /* shot: the line, where in the square the 9:16 window sits (0 left,
     1 right of 840px of room), the zoom, and the drift */
  var SH = [
    { line:'An insurance branch<br>wrote its <t>own software.</t>',  x0:.46, x1:.52, z0:1.00, z1:1.07 },
    { line:'A hundred thousand lines.<br>It runs <t>the whole branch.</t>', x0:.60, x1:.52, z0:1.06, z1:1.00 },
    { line:'Nobody here was<br>hired as <t>a developer.</t>',        x0:.42, x1:.48, z0:1.00, z1:1.06 },
    { line:'Every piece of it started<br>as <t>somebody&rsquo;s annoyance.</t>', x0:.50, x1:.43, z0:1.05, z1:1.00 },
    { line:'One administrator&rsquo;s<br>seat is <t>open.</t>',      x0:.56, x1:.63, z0:1.00, z1:1.07 },
    { line:'You get the keys.<br><t>Not a request form.</t>',        x0:.46, x1:.52, z0:1.04, z1:1.00 }
  ];

  var starts = [0], durs = [LEAD + BAR];
  for (var i = 1; i < SH.length; i++){ starts.push(starts[i-1] + durs[i-1]); durs.push(BAR); }
  var T_END = starts[SH.length-1] + durs[SH.length-1];   /* 14.881 */
  var TOTAL = 19.35;                                     /* the bed's length */

  var shots = [].slice.call(document.querySelectorAll('.sh'));
  var caps  = document.getElementById('caps');
  var endEl = document.getElementById('end');
  var endKids = [].slice.call(endEl.querySelectorAll('.in > *'));

  /* one caption per shot, split to WORDS (never letters: letters wreck the
     screen-reader read and are the dated form) */
  var capEls = SH.map(function(s){
    var d = document.createElement('div'); d.className = 'cap';
    d.setAttribute('aria-label', s.line.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
    /* build word spans, carrying the teal run */
    var teal = false, out = '';
    s.line.split('<br>').forEach(function(row, ri){
      if (ri) out += '<span class="br"></span>';
      row.split(' ').forEach(function(w){
        if (w.indexOf('<t>') >= 0){ teal = true; w = w.replace('<t>',''); }
        var close = w.indexOf('</t>') >= 0;
        if (close) w = w.replace('</t>','');
        out += '<span class="w' + (teal ? ' t' : '') + '">' + w + '</span>';
        if (close) teal = false;
      });
    });
    d.innerHTML = out + '<i class="rule"></i>';
    caps.appendChild(d);
    return d;
  });
  /* a line break that survives inline-block words */
  var st = document.createElement('style');
  st.textContent = '.cap .br{display:block;height:0;width:100%}';
  document.head.appendChild(st);

  function ease(p){ return p < 0 ? 0 : p > 1 ? 1 : p * p * (3 - 2 * p); }
  function lin(p){ return p < 0 ? 0 : p > 1 ? 1 : p; }

  window.SEEK = function(t){
    var u = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    document.documentElement.style.setProperty('--u', u + 'px');

    for (var i = 0; i < SH.length; i++){
      var s = SH[i], a = starts[i], d = durs[i], p = (t - a) / d;
      var img = shots[i].firstElementChild;

      /* opacity: a short dissolve in, held, cut out by the next shot's rise */
      var o = 0;
      if (t >= a - DISS && t < a + d){
        o = lin((t - a + DISS) / DISS);
      }
      shots[i].style.opacity = o > 0 ? Math.min(1, o) : 0;
      if (o <= 0){ capEls[i].style.opacity = 0; continue; }

      /* the camera: constant velocity reads as a camera, easing reads as a slide */
      var q = lin(p);
      var z = s.z0 + (s.z1 - s.z0) * q;
      var x = -(s.x0 + (s.x1 - s.x0) * q) * 840 * u;
      img.style.transform = 'translate3d(' + x + 'px,0,0) scale(' + z + ')';

      /* the words: one rise, word by word, starting just after the cut */
      var ws = capEls[i].querySelectorAll('.w');
      capEls[i].style.opacity = 1;
      for (var k = 0; k < ws.length; k++){
        var wp = ease((t - a - 0.20 - k * 0.035) / 0.38);
        ws[k].style.opacity = wp;
        ws[k].style.transform = 'translate3d(0,' + ((1 - wp) * 26 * u).toFixed(2) + 'px,0)';
      }
      var r = capEls[i].querySelector('.rule');
      r.style.width = (ease((t - a - 0.14) / 0.72) * 132 * u).toFixed(1) + 'px';
    }

    /* the end card: still, because a moving camera is what stops a QR
       from decoding — the lesson from the first seven cuts */
    var ep = (t - T_END) / 0.42;
    endEl.style.opacity = lin(ep);
    for (var m = 0; m < endKids.length; m++){
      var kp = ease((t - T_END - 0.10 - m * 0.085) / 0.5);
      endKids[m].style.opacity = kp;
      endKids[m].style.transform = 'translate3d(0,' + ((1 - kp) * 22 * u).toFixed(2) + 'px,0)';
    }
  };
  window.FILM = { total: TOTAL, ends: T_END, starts: starts, durs: durs };
  window.SEEK(0);
})();
