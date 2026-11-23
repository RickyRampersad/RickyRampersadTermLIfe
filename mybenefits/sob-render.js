/* A group's Schedule of Benefits drawn from its text (GroupSchedules.gs keeps it as plain lines): a line with " | " is a
 * row of a table, its first cell the benefit; "# Heading", a line ending in a colon or a short line in capitals is a
 * heading; anything else is a sentence. The same drawing is the staff preview and the employee page, so what staff
 * check is exactly what employees read. SobRender.html(text) and SobRender.search(root, words). 23 November 2026. */
(function (root) {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  /* the same test the backend uses (gsbIsHead_), so the WhatsApp answer and the page agree on the sections */
  function isHead(t) {
    if (/^#/.test(t)) return true;
    if (t.indexOf('|') >= 0 || t.length > 70) return false;
    if (/:$/.test(t)) return true;
    return /[A-Z]{3}/.test(t) && t === t.toUpperCase() && !/\d/.test(t.replace(/\b(I|II|III|IV)\b/g, ''));
  }
  function parse(text) {
    var secs = [], cur = { head: '', items: [] };
    String(text || '').split('\n').forEach(function (l) {
      var t = l.trim();
      if (!t) return;
      if (isHead(t)) { if (cur.items.length || cur.head) secs.push(cur); cur = { head: t.replace(/^#+\s*/, '').replace(/:$/, ''), items: [] }; return; }
      if (t.indexOf('|') >= 0) cur.items.push({ cells: t.split('|').map(function (c) { return c.trim(); }).filter(function (c, i, a) { return c || i < a.length - 1; }) });
      else cur.items.push({ p: t });
    });
    if (cur.items.length || cur.head) secs.push(cur);
    return secs;
  }
  /* a title in capitals reads better in sentence case on a phone */
  function nice(h) { return h === h.toUpperCase() ? h.charAt(0) + h.slice(1).toLowerCase().replace(/\b(x-ray|icu|mri|ct|ad&d)\b/g, function (m) { return m.toUpperCase(); }) : h; }
  function html(text) {
    return parse(text).map(function (s, si) {
      var out = '<section class="sob-sec" data-sec="' + si + '">' + (s.head ? '<h3 class="sob-h">' + esc(nice(s.head)) + '</h3>' : '');
      var rows = '', paras = '';
      s.items.forEach(function (it) {
        if (it.cells) rows += '<tr class="sob-r"><th scope="row">' + esc(it.cells[0]) + '</th>' + it.cells.slice(1).map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
        else { if (rows) { out += '<table class="sob-t"><tbody>' + rows + '</tbody></table>'; rows = ''; } out += '<p class="sob-p sob-r">' + esc(it.p) + '</p>'; }
      });
      if (rows) out += '<table class="sob-t"><tbody>' + rows + '</tbody></table>';
      return out + '</section>';
    }).join('');
  }
  /* searching on the page: the words someone types, and what a schedule calls them */
  var SYN = { dentist: ['dental'], teeth: ['dental'], tooth: ['dental'], glasses: ['vision', 'optical', 'lens', 'frame'], eye: ['vision', 'optical', 'eye'], eyes: ['vision', 'optical'],
    pregnant: ['maternity'], pregnancy: ['maternity'], baby: ['maternity', 'newborn'], doctor: ['physician', 'consultation', 'doctor'], gp: ['physician', 'consultation'],
    medicine: ['prescription', 'drug'], medication: ['prescription', 'drug'], pharmacy: ['prescription', 'drug', 'pharmacy'], hospital: ['hospital', 'room', 'inpatient'],
    physio: ['physiotherapy', 'physical'], therapy: ['therapy', 'physiotherapy'], xray: ['x-ray', 'diagnostic'], scan: ['diagnostic', 'mri', 'scan'], abroad: ['overseas', 'out-of-country', 'international'],
    mental: ['psychiatric', 'mental'], excess: ['deductible'], limit: ['maximum', 'limit'], life: ['life', 'death'], death: ['death', 'life'], accident: ['accidental', 'dismemberment'] };
  function terms(q) {
    var out = [];
    String(q || '').toLowerCase().replace(/[^a-z0-9&%\- ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1; }).forEach(function (w) {
      [w].concat(SYN[w] || SYN[w.replace(/s$/, '')] || []).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    });
    return out;
  }
  /* hide the rows that do not carry a word, and the sections left empty; returns how many rows show */
  function search(box, q) {
    var t = terms(q), shown = 0;
    box.querySelectorAll('.sob-sec').forEach(function (sec) {
      var head = (sec.querySelector('.sob-h') || { textContent: '' }).textContent.toLowerCase(), any = false;
      sec.querySelectorAll('.sob-r').forEach(function (r) {
        var hay = (r.textContent + ' ' + head).toLowerCase(), hit = !t.length || t.some(function (w) { return hay.indexOf(w) >= 0; });
        r.hidden = !hit; if (hit) { any = true; shown++; }
      });
      sec.hidden = !any;
      sec.querySelectorAll('.sob-t').forEach(function (tb) { tb.hidden = !tb.querySelector('.sob-r:not([hidden])'); });
    });
    return shown;
  }
  root.SobRender = { parse: parse, html: html, search: search, isHead: isHead, terms: terms };
})(typeof window !== 'undefined' ? window : this);
