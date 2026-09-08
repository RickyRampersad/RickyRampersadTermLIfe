/* donthaveanagent.com — the film player.
 *
 * One file, no dependencies. Drop it in with <script src="player.js" defer>
 * and it upgrades every .vwrap that holds a <video> and a .vcover:
 *
 *   · tap the picture to pause and to resume, with a glyph that flashes
 *   · a seekable rail with a dot for every scene, the scene's name beside it
 *   · elapsed / total, mute, full screen
 *   · the rail folds away while playing and a thin line keeps showing progress
 *
 * Scene positions come from data-scenes (a comma list of scene lengths in
 * seconds, straight out of tools/film/films.json) and the names from
 * data-chapters (a | list). tools/film/chapters.py writes both onto every
 * page, so they never have to be typed. If anything in here throws, the
 * browser's own controls come back. */
(function () {
  'use strict';

  var CSS = [
    '.vwrap.dp{position:relative;-webkit-tap-highlight-color:transparent}',
    '.vwrap.dp video{cursor:pointer}',
    '.vwrap.dp:fullscreen{aspect-ratio:auto;border-radius:0;max-height:none}',
    '.vwrap.dp:fullscreen video{object-fit:contain;width:100%;height:100%}',
    '.dp-bar{position:absolute;left:0;right:0;bottom:0;z-index:4;display:flex;align-items:center;gap:8px;',
      'padding:26px 12px 10px;color:#FFF6F4;font-family:Montserrat,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'background:linear-gradient(180deg,rgba(15,26,43,0),rgba(15,26,43,.72) 45%,rgba(15,26,43,.86));',
      'opacity:0;transform:translateY(8px);transition:opacity .28s ease,transform .28s ease;pointer-events:none}',
    '.dp.dp-on .dp-bar{opacity:1;transform:none;pointer-events:auto}',
    '.dp.dp-on.dp-idle .dp-bar{opacity:0;transform:translateY(8px);pointer-events:none}',
    '.dp-b{flex:none;width:36px;height:36px;border:none;border-radius:50%;background:rgba(255,246,244,.12);color:#FFF6F4;',
      'display:grid;place-items:center;cursor:pointer;padding:0;transition:background .2s}',
    '.dp-b:hover{background:rgba(255,246,244,.24)} .dp-b svg{width:18px;height:18px;fill:currentColor;display:block}',
    '.dp-play{background:#FF5C4D} .dp-play:hover{background:#FF7A6B}',
    '.dp-play .dp-ii{display:none} .dp.dp-playing .dp-play .dp-ii{display:block} .dp.dp-playing .dp-play .dp-ip{display:none}',
    '.dp-mute .dp-mo{display:none} .dp.dp-muted .dp-mute .dp-mo{display:block} .dp.dp-muted .dp-mute .dp-mu{display:none}',
    '.dp-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}',
    '.dp-chap{font-weight:800;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#FFC2BA;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:12px;line-height:1.15}',
    '.dp-chap:empty{display:none}',
    '.dp-rail{position:relative;height:22px;cursor:pointer;touch-action:none;outline:none}',
    '.dp-rail::before{content:"";position:absolute;left:0;right:0;top:9px;height:4px;border-radius:99px;background:rgba(255,246,244,.26)}',
    '.dp-rail:focus-visible::before{box-shadow:0 0 0 2px rgba(255,246,244,.5)}',
    '.dp-fill{position:absolute;left:0;top:9px;height:4px;width:0;border-radius:99px;background:#FF5C4D}',
    '.dp-dots i{position:absolute;top:7px;width:8px;height:8px;margin-left:-4px;border-radius:50%;',
      'background:rgba(255,246,244,.55);border:1.5px solid rgba(15,26,43,.5);transition:transform .25s,background .25s}',
    '.dp-dots i.done{background:#FF5C4D} .dp-dots i.now{background:#fff;transform:scale(1.45);box-shadow:0 0 0 4px rgba(255,92,77,.35)}',
    '.dp-knob{position:absolute;top:4px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;',
      'box-shadow:0 1px 6px rgba(0,0,0,.4);transform:scale(0);transition:transform .2s}',
    '.dp-rail:hover .dp-knob,.dp-rail.drag .dp-knob{transform:scale(1)}',
    '.dp-time{flex:none;font-weight:700;font-size:11.5px;letter-spacing:.06em;color:#FFE9E5;font-variant-numeric:tabular-nums}',
    '.dp-slim{position:absolute;left:0;right:0;bottom:0;height:3px;z-index:3;background:rgba(255,246,244,.18);opacity:0;transition:opacity .3s}',
    '.dp-slim i{display:block;height:100%;width:0;background:#FF5C4D}',
    '.dp.dp-on.dp-idle .dp-slim{opacity:1}',
    '.dp-flash{position:absolute;left:50%;top:50%;width:78px;height:78px;margin:-39px 0 0 -39px;border-radius:50%;z-index:3;',
      'background:rgba(15,26,43,.62);color:#fff;display:grid;place-items:center;opacity:0;transform:scale(.7);pointer-events:none}',
    '.dp-flash svg{width:34px;height:34px;fill:currentColor}',
    '.dp-flash.go{animation:dpflash .75s ease forwards}',
    '.dp-flash .dp-ii{display:none} .dp-flash.paused .dp-ii{display:block} .dp-flash.paused .dp-ip{display:none}',
    '@keyframes dpflash{0%{opacity:0;transform:scale(.7)}25%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.25)}}',
    '.dp.dp-on .vcover{display:none}',
    '@media(max-width:520px){.dp-bar{gap:6px;padding:22px 9px 8px}.dp-b{width:32px;height:32px}.dp-b svg{width:16px;height:16px}',
      '.dp-time{font-size:10.5px}.dp-chap{font-size:9.5px}.dp-full{display:none}}',
    '@media(prefers-reduced-motion:reduce){.dp-bar,.dp-knob,.dp-dots i{transition:none}.dp-flash.go{animation-duration:.3s}}'
  ].join('\n');

  var ICON = {
    play: '<path class="dp-ip" d="M8 5v14l11-7z"/><path class="dp-ii" d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    mute: '<path class="dp-mu" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>' +
          '<path class="dp-mo" d="M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4L15.2 10.6l-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/>',
    full: '<path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/>'
  };

  function fmt(s) {
    s = Math.max(0, Math.floor(isFinite(s) ? s : 0));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e;
  }

  function upgrade(w) {
    var v = w.querySelector('video'), cover = w.querySelector('.vcover');
    if (!v || w.__dp) return;
    w.__dp = true;
    try {
      v.removeAttribute('controls');
      v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');

      var durs = (v.getAttribute('data-scenes') || '').split(',').map(parseFloat).filter(function (x) { return x > 0; });
      var names = (v.getAttribute('data-chapters') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      var starts = [0];
      durs.forEach(function (d) { starts.push(starts[starts.length - 1] + d); });
      var schedTotal = starts[starts.length - 1];

      var bar = el('div', 'dp-bar');
      var play = el('button', 'dp-b dp-play', '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON.play + '</svg>');
      play.type = 'button'; play.setAttribute('aria-label', 'Pause');
      var mid = el('div', 'dp-mid');
      var chap = el('div', 'dp-chap');
      var rail = el('div', 'dp-rail');
      rail.setAttribute('role', 'slider'); rail.setAttribute('aria-label', 'Seek'); rail.tabIndex = 0;
      rail.setAttribute('aria-valuemin', '0'); rail.setAttribute('aria-valuemax', '100'); rail.setAttribute('aria-valuenow', '0');
      var fill = el('div', 'dp-fill'), dots = el('div', 'dp-dots'), knob = el('div', 'dp-knob');
      rail.appendChild(fill); rail.appendChild(dots); rail.appendChild(knob);
      mid.appendChild(chap); mid.appendChild(rail);
      var time = el('span', 'dp-time', '0:00 / 0:00');
      var mute = el('button', 'dp-b dp-mute', '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON.mute + '</svg>');
      mute.type = 'button'; mute.setAttribute('aria-label', 'Mute');
      var full = el('button', 'dp-b dp-full', '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON.full + '</svg>');
      full.type = 'button'; full.setAttribute('aria-label', 'Full screen');
      bar.appendChild(play); bar.appendChild(mid); bar.appendChild(time); bar.appendChild(mute); bar.appendChild(full);

      var slim = el('div', 'dp-slim', '<i></i>');
      var flash = el('div', 'dp-flash', '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON.play + '</svg>');
      w.appendChild(flash); w.appendChild(slim); w.appendChild(bar);
      w.classList.add('dp');

      var dotEls = [];
      function layDots() {
        var total = (v.duration && isFinite(v.duration)) ? v.duration : schedTotal;
        dots.innerHTML = ''; dotEls = [];
        if (!total || starts.length < 2) return;
        starts.slice(0, durs.length).forEach(function (s, i) {
          var d = el('i'); d.style.left = (100 * s / total) + '%';
          d.title = names[i] || ('Scene ' + (i + 1));
          dots.appendChild(d); dotEls.push(d);
        });
      }

      function sceneAt(t) {
        var i = 0;
        while (i + 1 < starts.length && t >= starts[i + 1] - 0.05) i++;
        return Math.min(i, Math.max(0, durs.length - 1));
      }

      var idleTimer = null;
      function wake() {
        w.classList.remove('dp-idle');
        clearTimeout(idleTimer);
        if (!v.paused) idleTimer = setTimeout(function () { w.classList.add('dp-idle'); }, 2800);
      }

      function paint() {
        var total = (v.duration && isFinite(v.duration)) ? v.duration : schedTotal;
        var t = v.currentTime || 0;
        var pct = total ? Math.min(100, 100 * t / total) : 0;
        fill.style.width = pct + '%'; knob.style.left = pct + '%'; slim.firstChild.style.width = pct + '%';
        rail.setAttribute('aria-valuenow', String(Math.round(pct)));
        time.textContent = fmt(t) + ' / ' + fmt(total);
        if (dotEls.length) {
          var k = sceneAt(t);
          dotEls.forEach(function (d, i) { d.className = i < k ? 'done' : (i === k ? 'now' : ''); });
          if (names.length) chap.textContent = names[k] || '';
        }
      }

      function showFlash(paused) {
        flash.classList.toggle('paused', paused);
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      }
      function toggle() {
        if (v.paused) { v.play(); } else { v.pause(); }
        showFlash(v.paused);
        wake();
      }
      function start() {
        w.classList.add('dp-on');
        v.muted = false;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        wake();
      }

      if (cover) cover.addEventListener('click', function (e) { e.preventDefault(); start(); });
      w.addEventListener('click', function (e) {
        if (!w.classList.contains('dp-on')) return;
        if (e.target.closest('.dp-bar') || e.target.closest('.vcover')) return;   /* the cover's own click already started it */
        toggle();
      });
      play.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      mute.addEventListener('click', function (e) { e.stopPropagation(); v.muted = !v.muted; w.classList.toggle('dp-muted', v.muted); wake(); });
      full.addEventListener('click', function (e) {
        e.stopPropagation();
        if (document.fullscreenElement === w) { document.exitFullscreen(); return; }
        if (w.requestFullscreen) w.requestFullscreen().catch(function () { if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); });
        else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
        wake();
      });
      if (!document.fullscreenEnabled && !v.webkitEnterFullscreen) full.style.display = 'none';

      /* scrubbing — pointer events cover mouse and touch alike */
      var dragging = false;
      function seekTo(clientX) {
        var r = rail.getBoundingClientRect();
        var ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        var total = (v.duration && isFinite(v.duration)) ? v.duration : schedTotal;
        if (total) v.currentTime = ratio * total;
        paint();
      }
      rail.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); dragging = true; rail.classList.add('drag');
        try { rail.setPointerCapture(e.pointerId); } catch (x) {}
        seekTo(e.clientX);
      });
      rail.addEventListener('pointermove', function (e) { if (dragging) seekTo(e.clientX); });
      function endDrag(e) { if (!dragging) return; dragging = false; rail.classList.remove('drag'); wake(); }
      rail.addEventListener('pointerup', endDrag); rail.addEventListener('pointercancel', endDrag);
      rail.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 5); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { v.currentTime = Math.max(0, v.currentTime - 5); e.preventDefault(); }
        if (e.key === ' ' || e.key === 'Enter') { toggle(); e.preventDefault(); }
        paint();
      });
      w.addEventListener('keydown', function (e) {
        if (!w.classList.contains('dp-on') || e.target !== w) return;
        if (e.key === ' ' || e.key.toLowerCase() === 'k') { toggle(); e.preventDefault(); }
        if (e.key.toLowerCase() === 'm') { mute.click(); }
        if (e.key.toLowerCase() === 'f') { full.click(); }
        if (e.key === 'ArrowRight') { v.currentTime += 5; }
        if (e.key === 'ArrowLeft') { v.currentTime -= 5; }
      });
      w.tabIndex = w.tabIndex >= 0 ? w.tabIndex : -1;

      ['pointermove', 'pointerdown', 'touchstart'].forEach(function (evt) {
        w.addEventListener(evt, wake, { passive: true });
      });
      w.addEventListener('pointerleave', function () { if (!v.paused) { clearTimeout(idleTimer); idleTimer = setTimeout(function () { w.classList.add('dp-idle'); }, 900); } });

      v.addEventListener('loadedmetadata', function () { layDots(); paint(); });
      v.addEventListener('durationchange', function () { layDots(); paint(); });
      v.addEventListener('timeupdate', paint);
      v.addEventListener('seeking', paint);
      v.addEventListener('play', function () { w.classList.add('dp-playing'); w.classList.add('dp-on'); wake(); });
      v.addEventListener('pause', function () { w.classList.remove('dp-playing'); w.classList.remove('dp-idle'); clearTimeout(idleTimer); });
      v.addEventListener('volumechange', function () { w.classList.toggle('dp-muted', v.muted); });
      v.addEventListener('ended', function () {
        w.classList.remove('dp-on', 'dp-playing', 'dp-idle');
        v.currentTime = 0; paint();
        if (cover) cover.classList.remove('gone');
      });
      layDots(); paint();
    } catch (e) {
      v.setAttribute('controls', '');
      if (cover) cover.addEventListener('click', function () { cover.classList.add('gone'); v.play(); });
    }
  }

  function boot() {
    var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    document.querySelectorAll('.vwrap').forEach(upgrade);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
