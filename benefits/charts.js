/* ══════════════════════════════════════════════════════════════════════
   CHARTS — SVG, no library, no CDN

   These pages are read on a phone in a car park and on a wall screen with
   no network. A chart that needs a CDN is a chart that is sometimes a
   blank rectangle, so every mark here is hand-built SVG.

   Colour comes from the stylesheet's own custom properties, so a chart
   matches the page in light and dark without being told which it is in.

   Every function returns an SVG string. Nothing here touches the DOM, so
   a chart can be built into a template literal beside the text it
   explains rather than wired up afterwards.
   ══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* The series palette. Teal leads because it is the branch's accent and
     the first series is almost always the one being argued for; gold is
     second because it reads as "the other one" without reading as wrong.
     Red is reserved — a series is never red merely for being third. */
  var SERIES = ['#0a92a8', '#c9942c', '#16344a', '#00CFEA', '#6d8fa3', '#94620f'];

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  };
  var money = function (n) {
    return (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  /* A figure a client reads aloud. 83,514 becomes $83.5k on an axis and
     stays $83,514 in a tooltip — the axis is for shape, not for audit. */
  var brief = function (n) {
    n = +n || 0;
    var a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'm';
    if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  };

  /* Nice round numbers for an axis, so a scale reads 0/20/40/60 rather
     than 0/17.3/34.6. */
  function niceMax(v) {
    if (v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }

  /* ── bars ──────────────────────────────────────────────────────────
     rows: [{label, value, tone?}]  tone: 'good' | 'warn' | 'bad'
     The workhorse. Horizontal, because a group scheme's labels are
     company and member names and those do not fit under a vertical bar. */
  function bars(rows, opt) {
    opt = opt || {};
    rows = (rows || []).filter(function (r) { return r && r.label != null; });
    if (!rows.length) return '';
    var w = opt.width || 640, rowH = opt.rowH || 30, pad = 8;
    var labW = opt.labelWidth || 150, valW = 72;
    var h = rows.length * rowH + pad * 2;
    var max = niceMax(Math.max.apply(null, rows.map(function (r) { return +r.value || 0; })));
    var barW = w - labW - valW - 16;
    var tone = { good: 'var(--go)', warn: 'var(--gold2)', bad: 'var(--stop)' };

    var out = rows.map(function (r, i) {
      var y = pad + i * rowH, v = +r.value || 0;
      var bw = max ? Math.max(v > 0 ? 2 : 0, (v / max) * barW) : 0;
      var fill = r.tone ? (tone[r.tone] || SERIES[0]) : SERIES[0];
      return '<g>'
        + '<text x="0" y="' + (y + rowH / 2 + 4) + '" font-size="12.5">' + esc(r.label) + '</text>'
        + '<rect x="' + labW + '" y="' + (y + 5) + '" width="' + bw.toFixed(1) + '" height="' + (rowH - 14)
        + '" rx="4" fill="' + fill + '"><title>' + esc(r.label) + ': ' + money(v) + '</title></rect>'
        + '<text class="val" x="' + w + '" y="' + (y + rowH / 2 + 4) + '" font-size="12.5" text-anchor="end">'
        + (opt.fmt ? opt.fmt(v) : money(v)) + '</text>'
        + '</g>';
    }).join('');

    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="'
      + esc(opt.title || 'Bar chart') + '">' + out + '</svg>';
  }

  /* ── a line over months ────────────────────────────────────────────
     points: [{label, value}] in time order. One series, because a client
     reading their own premium over six months is asking one question. */
  function line(points, opt) {
    opt = opt || {};
    points = (points || []).filter(function (p) { return p && p.value != null; });
    if (points.length < 2) return '';
    var w = opt.width || 640, h = opt.height || 190;
    var l = 46, r = 12, t = 12, b = 30;
    var iw = w - l - r, ih = h - t - b;
    var vals = points.map(function (p) { return +p.value || 0; });
    var max = niceMax(Math.max.apply(null, vals));
    var min = opt.zero === false ? Math.min.apply(null, vals) * 0.96 : 0;
    var span = (max - min) || 1;
    var x = function (i) { return l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw); };
    var y = function (v) { return t + ih - ((v - min) / span) * ih; };

    var grid = '', ticks = 4;
    for (var g = 0; g <= ticks; g++) {
      var gv = min + (span * g / ticks), gy = y(gv);
      grid += '<line class="grid" x1="' + l + '" y1="' + gy.toFixed(1) + '" x2="' + (w - r) + '" y2="' + gy.toFixed(1) + '"/>'
        + '<text x="' + (l - 8) + '" y="' + (gy + 4).toFixed(1) + '" font-size="10.5" text-anchor="end">'
        + brief(gv) + '</text>';
    }
    var d = points.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(+p.value).toFixed(1); }).join(' ');
    var area = d + ' L' + x(points.length - 1).toFixed(1) + ' ' + (t + ih) + ' L' + x(0).toFixed(1) + ' ' + (t + ih) + ' Z';

    var dots = points.map(function (p, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(+p.value).toFixed(1) + '" r="3.5" fill="' + SERIES[0] + '">'
        + '<title>' + esc(p.label) + ': ' + money(p.value) + '</title></circle>';
    }).join('');
    var labs = points.map(function (p, i) {
      /* Every label on a phone becomes a smear. Show the ends and the
         middle and trust the reader to follow the line between. */
      var show = points.length <= 6 || i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2);
      return show ? '<text x="' + x(i).toFixed(1) + '" y="' + (h - 8) + '" font-size="10.5" text-anchor="middle">'
        + esc(p.label) + '</text>' : '';
    }).join('');

    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="'
      + esc(opt.title || 'Trend') + '">'
      + '<defs><linearGradient id="lg' + (opt.id || '') + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="' + SERIES[0] + '" stop-opacity=".22"/>'
      + '<stop offset="1" stop-color="' + SERIES[0] + '" stop-opacity="0"/></linearGradient></defs>'
      + grid
      + '<path d="' + area + '" fill="url(#lg' + (opt.id || '') + ')"/>'
      + '<path d="' + d + '" fill="none" stroke="' + SERIES[0] + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'
      + dots + labs + '</svg>';
  }

  /* ── a ring ────────────────────────────────────────────────────────
     parts: [{label, value}]. For a split that sums to a whole — lives by
     line, contributions by tier. Refuses more than six slices: a ring
     with nine wedges is a legend with a decoration attached. */
  function donut(parts, opt) {
    opt = opt || {};
    parts = (parts || []).filter(function (p) { return (+p.value || 0) > 0; }).slice(0, 6);
    var total = parts.reduce(function (s, p) { return s + (+p.value || 0); }, 0);
    if (!total) return '';
    var size = opt.size || 168, sw = opt.thickness || 26;
    var cx = size / 2, cy = size / 2, rad = (size - sw) / 2 - 2;
    var circ = 2 * Math.PI * rad, at = 0;

    var arcs = parts.map(function (p, i) {
      var frac = (+p.value || 0) / total;
      var seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad.toFixed(1) + '" fill="none"'
        + ' stroke="' + SERIES[i % SERIES.length] + '" stroke-width="' + sw + '"'
        + ' stroke-dasharray="' + (frac * circ).toFixed(2) + ' ' + circ.toFixed(2) + '"'
        + ' stroke-dashoffset="' + (-at * circ).toFixed(2) + '"'
        + ' transform="rotate(-90 ' + cx + ' ' + cy + ')">'
        + '<title>' + esc(p.label) + ': ' + money(p.value) + ' (' + Math.round(frac * 100) + '%)</title></circle>';
      at += frac;
      return seg;
    }).join('');

    var mid = opt.centre != null ? opt.centre : money(total);
    var svg = '<svg class="chart" style="width:' + size + 'px;height:' + size + 'px" viewBox="0 0 ' + size + ' ' + size
      + '" role="img" aria-label="' + esc(opt.title || 'Breakdown') + '">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad.toFixed(1) + '" fill="none" stroke="var(--surface2)" stroke-width="' + sw + '"/>'
      + arcs
      + '<text class="val" x="' + cx + '" y="' + (cy + 2) + '" font-size="19" text-anchor="middle">' + esc(mid) + '</text>'
      + (opt.centreSub ? '<text x="' + cx + '" y="' + (cy + 19) + '" font-size="10.5" text-anchor="middle">'
          + esc(opt.centreSub) + '</text>' : '')
      + '</svg>';

    var legend = '<div class="legend">' + parts.map(function (p, i) {
      return '<span><i style="background:' + SERIES[i % SERIES.length] + '"></i>' + esc(p.label)
        + ' <b class="mono">' + money(p.value) + '</b></span>';
    }).join('') + '</div>';

    return opt.legend === false ? svg
      : '<div style="display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap">' + svg
        + '<div style="flex:1;min-width:170px">' + legend + '</div></div>';
  }

  /* ── a sparkline ───────────────────────────────────────────────────
     No axis, no labels — it belongs inside a stat tile, where the figure
     is the point and the shape is the context. */
  function spark(values, opt) {
    opt = opt || {};
    values = (values || []).map(Number).filter(function (v) { return !isNaN(v); });
    if (values.length < 2) return '';
    var w = opt.width || 120, h = opt.height || 30;
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var span = (max - min) || 1;
    var d = values.map(function (v, i) {
      return (i ? 'L' : 'M') + ((i / (values.length - 1)) * w).toFixed(1) + ' '
        + (h - ((v - min) / span) * (h - 4) - 2).toFixed(1);
    }).join(' ');
    var up = values[values.length - 1] >= values[0];
    return '<svg class="chart" style="width:' + w + 'px;height:' + h + 'px" viewBox="0 0 ' + w + ' ' + h
      + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="'
      + (opt.tone === 'flat' ? 'var(--slate)' : up ? 'var(--go)' : 'var(--stop)')
      + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  /* ── stacked bars over time ────────────────────────────────────────
     rows: [{label, parts:[n,n,n]}], keys: ['Life','Health','Pension']
     For a premium split month by month, where both the total and the mix
     matter and two charts would make the reader do the joining. */
  function stack(rows, keys, opt) {
    opt = opt || {};
    rows = rows || []; keys = keys || [];
    if (!rows.length || !keys.length) return '';
    var w = opt.width || 640, h = opt.height || 210;
    var l = 46, r = 12, t = 12, b = 32;
    var iw = w - l - r, ih = h - t - b;
    var totals = rows.map(function (x) { return (x.parts || []).reduce(function (s, v) { return s + (+v || 0); }, 0); });
    var max = niceMax(Math.max.apply(null, totals));
    var bw = Math.min(48, (iw / rows.length) * 0.62);

    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var gv = max * g / 4, gy = t + ih - (gv / max) * ih;
      grid += '<line class="grid" x1="' + l + '" y1="' + gy.toFixed(1) + '" x2="' + (w - r) + '" y2="' + gy.toFixed(1) + '"/>'
        + '<text x="' + (l - 8) + '" y="' + (gy + 4).toFixed(1) + '" font-size="10.5" text-anchor="end">' + brief(gv) + '</text>';
    }

    var cols = rows.map(function (row, i) {
      var cx = l + (iw / rows.length) * (i + 0.5), y0 = t + ih, seg = '';
      (row.parts || []).forEach(function (v, k) {
        var bh = max ? ((+v || 0) / max) * ih : 0;
        if (bh <= 0) return;
        y0 -= bh;
        seg += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + bw.toFixed(1)
          + '" height="' + bh.toFixed(1) + '" fill="' + SERIES[k % SERIES.length] + '">'
          + '<title>' + esc(row.label) + ' · ' + esc(keys[k] || '') + ': ' + money(v) + '</title></rect>';
      });
      return seg + '<text x="' + cx.toFixed(1) + '" y="' + (h - 10) + '" font-size="10.5" text-anchor="middle">'
        + esc(row.label) + '</text>';
    }).join('');

    var legend = '<div class="legend">' + keys.map(function (k, i) {
      return '<span><i style="background:' + SERIES[i % SERIES.length] + '"></i>' + esc(k) + '</span>';
    }).join('') + '</div>';

    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="'
      + esc(opt.title || 'Over time') + '">' + grid + cols + '</svg>' + legend;
  }

  root.Charts = { bars: bars, line: line, donut: donut, spark: spark, stack: stack,
                  series: SERIES, money: money, brief: brief };
})(typeof window !== 'undefined' ? window : this);
