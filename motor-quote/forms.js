/* The motor proposal and the Know Your Policy form, filled on Guardian's own PDFs.
 *
 * Asked for on 21 October 2026: "it has to be exactly on the Guardian PDF and know your [policy], ensuring that
 * they can answer it". The two blank forms are in motor-quote/forms/ exactly as Guardian issues them (their file
 * properties cleared, nothing else touched):
 *   - gg-private-motor-proposal.pdf, GG-MOT-APV-PRO-02/2025v2, four US Legal pages with no form fields, so every
 *     answer is printed at the position of its own blank, measured off the PDF's characters (YES____NO____ pairs,
 *     the underscore runs, the two tables' cells);
 *   - gg-know-your-policy-private-motor.pdf, Motor Guard KYP, which has its own fields (45: the YES/NO boxes, the
 *     name, the date, the signature, contact and e-mail), filled by name.
 * Coordinates are PDF points from the top of the page (612 x 1008), as the measurement gave them; the drawing turns
 * them round. The representative's half of the KYP is left for the branch to complete.
 *
 * Works in the browser (window.MQForms, with window.PDFLib) and in Node (module.exports, with require('pdf-lib')).
 */
(function (root) {
  var H = 1008;
  var INK = [0.02, 0.09, 0.36];            // a dark blue pen, so the answers read as filled in
  var SIZE = 10.5, CELL = 9;               // bold, the size of the form's own print (21 Oct 2026: "more bold and scaled properly")

  /* A YES____NO____ pair: the two underscore runs. */
  function yn(p, top, yes0, yes1, no0, no1) { return { t: 'yn', p: p, top: top, yes: [yes0, yes1], no: [no0, no1] }; }
  /* A blank to write on: from x0 to x1, its line's top. */
  function bl(p, top, x0, x1, size) { return { t: 'text', p: p, top: top, x0: x0, x1: x1, size: size }; }
  /* A text that runs over a first blank and on to the next lines. */
  function ml(p, lines) { return { t: 'multi', p: p, lines: lines }; }
  /* One of several blanks gets an X. */
  function pick(p, top, opts) { return { t: 'pick', p: p, top: top, opts: opts }; }

  var PROPOSAL = {
    clientNo:   bl(1, 160, 112, 330), policyNo: bl(1, 160, 424, 576),
    name1:      bl(1, 359.4, 251, 423), surname: bl(1, 359.4, 432, 565),
    dob:        bl(1, 428.4, 192, 319), pob: bl(1, 448.3, 195, 322),
    nationality: bl(1, 471.3, 123, 317), residence: bl(1, 494.2, 173, 316), marital: bl(1, 517.3, 138, 315),
    address:    ml(1, [[540.3, 255, 571], [563.2, 54, 570]]),
    mailing:    bl(1, 586.3, 183, 571),
    phone:      bl(1, 609.3, 125, 318), email: bl(1, 609.3, 398, 569),
    occupation: bl(1, 632.2, 282, 414), employer: bl(1, 655.3, 253, 402),
    pep:        yn(1, 701.2, 511.1, 533.3, 548.4, 570.5),
    permitNo:   bl(1, 777.2, 142, 252), permitIssued: bl(1, 777.2, 320, 420), permitClass: bl(1, 777.2, 468, 567),
    otherGG:    yn(1, 812.5, 511.7, 533.9, 549.0, 571.1), otherGGd: bl(1, 835.5, 190, 568),
    q3a:        yn(1, 880.9, 513.0, 535.2, 550.3, 572.5), q3b: yn(1, 892.4, 514.3, 536.5, 551.5, 573.9),
    d3name:     bl(1, 915.3, 121, 388), d3dob: bl(1, 915.3, 452, 574),
    d3permit:   bl(1, 938.3, 136, 286), d3issued: bl(1, 938.3, 348, 425), d3class: bl(1, 938.3, 474, 567),

    q4:         yn(2, 65.0, 508.7, 530.9, 546.0, 568.1), q4d: bl(2, 85.4, 314, 563),
    fuel:       pick(2, 140.8, { Gas: [217.3, 234.0], Electric: [316.9, 333.5], Hybrid: [404.1, 420.7], CNG: [484.6, 501.3] }),
    vehicle:    { t: 'row', p: 2, top: 186, bottom: 233, cols: { reg: [42, 99], makeModel: [99, 167], chassis: [167, 243], engine: [243, 310],
                  year: [310, 360], cc: [360, 414], seating: [414, 459], body: [459, 517], sumInsured: [517, 576] } },
    acc:        yn(2, 315.2, 508.9, 531.1, 546.1, 568.5),
    accAudio:   bl(2, 338.2, 179, 267), accPaint: bl(2, 338.2, 470, 563), accRims: bl(2, 349.8, 179, 267), accOther: bl(2, 349.8, 470, 563),
    q6:         yn(2, 384.8, 510.6, 532.8, 547.9, 570.0), q6d: ml(2, [[419.2, 185, 562], [442.3, 64, 569]]),
    cond:       pick(2, 488.7, { New: [113.6, 146.9], Secondhand: [257.6, 285.4], 'Foreign used': [390.2, 423.6] }),
    q7b:        yn(2, 500.2, 508.4, 530.7, 545.8, 568.0), q7c: yn(2, 511.8, 508.0, 530.2, 545.3, 567.5),
    q7d:        yn(2, 523.3, 510.2, 532.5, 547.4, 569.8),
    trailerReg: bl(2, 546.2, 336, 562), trailerMake: bl(2, 557.7, 270, 564),
    q7e:        yn(2, 580.8, 507.8, 530.0, 545.2, 567.4),
    financeName: bl(2, 603.7, 347, 563), financeAddr: bl(2, 626.7, 103, 569),
    q8:         yn(2, 661.8, 507.6, 529.8, 544.9, 567.0),
    q9:         yn(2, 696.7, 507.1, 529.3, 544.4, 566.5), q9d: ml(2, [[742.8, 67, 567], [765.7, 67, 567]]),
    q10:        bl(2, 835.1, 63, 568),
    q11:        yn(2, 881.7, 499.9, 522.0, 537.1, 559.3), q11d: bl(2, 939.2, 63, 568),

    q12:        yn(3, 76.5, 509.3, 531.5, 546.6, 568.7), q12d: ml(3, [[134.0, 63, 568], [157.0, 63, 568]]),
    q13:        yn(3, 192.0, 508.2, 530.4, 545.5, 567.6), q13d: bl(3, 238.0, 63, 568),
    q14a:       yn(3, 290.2, 510.7, 532.9, 548.0, 570.2), q14b: yn(3, 301.8, 510.7, 532.9, 548.0, 570.2),
    q14c:       yn(3, 313.3, 510.7, 532.9, 548.0, 570.2), q14d: ml(3, [[336.2, 255, 565], [359.2, 63, 568]]),
    q15:        yn(3, 417.2, 508.7, 530.9, 546.0, 568.1),
    accidents:  { t: 'rows', p: 3, rows: [[497, 544], [544, 590], [590, 637]], cols: { date: [42, 121], cost: [121, 247], driver: [247, 342], details: [342, 576] } },
    q16a:       yn(3, 672.7, 510.7, 532.9, 548.0, 570.2), q16ad: bl(3, 695.7, 185, 557),
    q16b:       yn(3, 718.6, 510.8, 533.0, 548.0, 570.4), q16bd: bl(3, 753.2, 185, 568),
    q16c:       yn(3, 778.0, 513.8, 530.5, 545.5, 567.9), q16cd: bl(3, 812.5, 180, 568),
    cover:      pick(3, 870.4, { 'Third Party': [132.0, 187.7], 'Third Party Fire and Theft': [367.7, 412.1], Comprehensive: [516.6, 566.7] }),
    from:       bl(3, 929.3, 173, 377), to: bl(3, 929.3, 393, 569),

    b19a: yn(4, 122.5, 509.8, 532.0, 547.1, 569.2),
    b19b: yn(4, 165.1, 509.3, 531.5, 546.7, 568.8), b19bLimit: bl(4, 177.2, 230, 329),
    b19c: yn(4, 198.4, 508.2, 530.4, 545.4, 567.6), b19cLimit: bl(4, 209.8, 230, 339),
    b19d: yn(4, 232.9, 510.8, 533.0, 548.2, 570.2),
    b19e: yn(4, 266.2, 510.6, 532.8, 547.8, 570.0),
    b19f: yn(4, 297.3, 510.8, 533.0, 548.2, 570.2),
    b19g: yn(4, 327.2, 510.4, 532.6, 547.7, 569.8),
    b19h: yn(4, 360.5, 508.5, 530.8, 545.9, 568.1),
    b19i: yn(4, 381.2, 510.4, 532.6, 547.7, 569.8),
    b19iLevel: pick(4, 392.7, { '1': [196.1, 207.1], '2': [293.4, 304.4], '3': [387.8, 399.0] }),
    b19j: yn(4, 414.5, 508.5, 530.8, 545.9, 568.1),
    b19k: yn(4, 436.4, 509.0, 531.2, 546.3, 568.5),
    b19kLimit: pick(4, 457.1, { '50000': [196.1, 212.7], '75000': [261.1, 277.8], '100000': [326.1, 342.7], '120000': [396.7, 413.4] }),
    signDate: bl(4, 931.3, 123, 216),
    signature: { t: 'sig', p: 4, x0: 362, x1: 572, bottom: 940, h: 40 },
  };

  /* The KYP form's own fields: question, YES box, NO box. */
  var KYP = [
    ['k1', 'ChkBox', 'ChkBox-0'], ['k2', 'NO', 'ChkBox-1'], ['k3', 'ChkBox-2', 'ChkBox-3'], ['k4', 'ChkBox-4', 'ChkBox-5'],
    ['k5', 'ChkBox-6', 'ChkBox-7'], ['k6', 'ChkBox-8', 'ChkBox-9'], ['k7', 'ChkBox-10', 'ChkBox-11'], ['k8', 'ChkBox-12', 'ChkBox-13'],
    ['k9', 'NO-0', 'ChkBox-14'], ['k10', 'ChkBox-15', 'ChkBox-16'], ['k11', 'ChkBox-17', 'ChkBox-18'], ['k12', 'ChkBox-19', 'ChkBox-20'],
    ['k13', 'ChkBox-21', 'ChkBox-22'], ['k14', 'ChkBox-23', 'ChkBox-24'], ['k15', 'ChkBox-25', 'ChkBox-26'], ['k16', 'NO-1', 'ChkBox-27'],
    ['k17', 'ChkBox-28', 'ChkBox-29'],
  ];
  /* The signature box on the KYP's last page (Text3, "Insured's signature"), for the drawn signature. */
  var KYP_SIG = { p: 4, x0: 173, x1: 416, top: 592, bottom: 620 };

  /* The standard fonts encode WinAnsi only: anything else would stop the save. */
  function ansi(s) {
    return String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
      .replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();
  }
  /* yyyy-mm-dd to the form's MM/DD/YY; anything else as typed. */
  function mdy(v) { var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[2] + '/' + m[3] + '/' + m[1].slice(2) : String(v || ''); }
  function money(v) { var n = Number(String(v == null ? '' : v).replace(/[^0-9.]/g, '')); return n ? Math.round(n).toLocaleString('en-US') : String(v || ''); }
  function yes(v) { return /^y/i.test(String(v || '')); }
  function no(v) { return /^n/i.test(String(v || '')); }

  /* The words that fit between x0 and x1 at the size, shrinking to 6.5 pt before a line breaks. */
  function fit(font, text, width, size, keep) {
    var s = size;
    while (!keep && s > 6.5 && font.widthOfTextAtSize(text, s) > width) s -= 0.5;
    if (font.widthOfTextAtSize(text, s) <= width) return { text: text, size: s, rest: '' };
    var words = text.split(' '), line = '';
    for (var i = 0; i < words.length; i++) {
      var next = line ? line + ' ' + words[i] : words[i];
      if (font.widthOfTextAtSize(next, s) > width) break;
      line = next;
    }
    if (!line) { var c = text.length; while (c > 1 && font.widthOfTextAtSize(text.slice(0, c), s) > width) c--; line = text.slice(0, c); }
    return { text: line, size: s, rest: text.slice(line.length).trim() };
  }

  async function fillProposal(PDFLib, templateBytes, A, signaturePng) {
    var pdf = await PDFLib.PDFDocument.load(templateBytes);
    var bold = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold), font = bold;
    var pages = pdf.getPages(), ink = PDFLib.rgb(INK[0], INK[1], INK[2]);
    var page = function (n) { return pages[n - 1]; };
    var text = function (p, s, x, top, size, f) { page(p).drawText(s, { x: x, y: H - top, size: size, font: f || font, color: ink }); };
    /* On a blank: the baseline sits just above the underline. */
    var onBlank = function (spec, value, size, keep) {
      var v = ansi(value); if (!v) return '';
      var f = fit(font, v, spec.x1 - spec.x0 - 2, size || SIZE, keep);
      text(spec.p, f.text, spec.x0 + 1, spec.top + 7.6, f.size);
      return f.rest;
    };
    var mark = function (p, top, run) { var w = bold.widthOfTextAtSize('X', 12); text(p, 'X', (run[0] + run[1]) / 2 - w / 2, top + 8.4, 12, bold); };
    var A2 = Object.assign({}, A, {
      name1: [A.title, A.first].filter(Boolean).join(' '), dob: mdy(A.dob), permitIssued: mdy(A.permitIssued), d3dob: mdy(A.d3dob),
      d3issued: mdy(A.d3issued), from: mdy(A.from), to: mdy(A.to), signDate: mdy(A.signDate),
      accAudio: A.accAudio ? money(A.accAudio) : '', accPaint: A.accPaint ? money(A.accPaint) : '', accRims: A.accRims ? money(A.accRims) : '',
      accOther: A.accOther ? money(A.accOther) : '', b19bLimit: A.b19bLimit ? '$ ' + money(A.b19bLimit) : '', b19cLimit: A.b19cLimit ? '$ ' + money(A.b19cLimit) : '',
      b19kLimit: String(A.b19kLimit || '').replace(/\D/g, ''),
    });
    Object.keys(PROPOSAL).forEach(function (k) {
      var spec = PROPOSAL[k], v = A2[k];
      if (spec.t === 'yn') { if (yes(v)) mark(spec.p, spec.top, spec.yes); else if (no(v)) mark(spec.p, spec.top, spec.no); return; }
      if (spec.t === 'pick') { var run = spec.opts[String(v || '')]; if (run) mark(spec.p, spec.top, run); return; }
      if (spec.t === 'text') { onBlank(spec, v); return; }
      if (spec.t === 'multi') {
        var rest = ansi(v);
        /* Every line but the last keeps the full size and breaks at a word; the last may shrink to hold the rest. */
        spec.lines.forEach(function (l, i) { if (rest) rest = onBlank({ p: spec.p, top: l[0], x0: l[1], x1: l[2] }, rest, SIZE, i < spec.lines.length - 1); });
        return;
      }
      if (spec.t === 'row' || spec.t === 'rows') {
        var rows = spec.t === 'row' ? [[spec.top, spec.bottom]] : spec.rows, data = spec.t === 'row' ? [A2] : (A2[k] || []);
        rows.forEach(function (r, i) {
          var d = data[i]; if (!d) return;
          Object.keys(spec.cols).forEach(function (c) {
            var raw = c === 'sumInsured' || c === 'cost' ? (d[c] ? '$' + money(d[c]) : '') : c === 'date' ? mdy(d[c]) : d[c];
            var rest2 = ansi(raw), col = spec.cols[c], y = r[0] + 13, lines = 0;
            while (rest2 && lines < 3 && y < r[1] - 2) {
              var f2 = fit(font, rest2, col[1] - col[0] - 4, CELL, true);   // a cell wraps at full size (a 17-character chassis number takes two lines)
              text(spec.p, f2.text, col[0] + 2, y, f2.size);
              rest2 = f2.rest; y += 11; lines++;
            }
          });
        });
        return;
      }
    });
    if (signaturePng) {
      var img = await pdf.embedPng(signaturePng), s = PROPOSAL.signature;
      var sc = Math.min((s.x1 - s.x0) / img.width, s.h / img.height);
      page(s.p).drawImage(img, { x: s.x0, y: H - s.bottom + 2, width: img.width * sc, height: img.height * sc });
    }
    pdf.setTitle('Private Motor Vehicle Insurance Proposal GG-MOT-APV-PRO-02/2025v2');
    pdf.setAuthor(''); pdf.setCreator('Ricky Rampersad Branch motor quote'); pdf.setProducer('pdf-lib');
    return pdf.save();
  }

  async function fillKyp(PDFLib, templateBytes, A, signaturePng) {
    var pdf = await PDFLib.PDFDocument.load(templateBytes), form = pdf.getForm();
    var set = function (name, v) { try { var t = form.getTextField(name); t.setText(ansi(v)); t.setFontSize(name === 'I' ? 10.5 : 11.5); } catch (e) {} };
    KYP.forEach(function (q) {
      var y = form.getCheckBox(q[1]), n = form.getCheckBox(q[2]);
      y.uncheck(); n.uncheck();
      if (yes(A[q[0]])) y.check(); else if (no(A[q[0]])) n.check();
      /* The form's own "on" look draws a glyph some viewers cannot show; pdf-lib's standard check mark shows everywhere. */
      y.updateAppearances(); n.updateAppearances();
    });
    var who = String(A.insuredName || [A.first, A.surname].filter(Boolean).join(' ')).toUpperCase();
    set('I', who); set('Text1', who);
    set('Text2', mdy(A.signDate));
    set('Text4', A.phone); set('Text5', A.email);
    if (signaturePng) {
      var img = await pdf.embedPng(signaturePng), s = KYP_SIG, pg = pdf.getPages()[s.p - 1];
      var sc = Math.min((s.x1 - s.x0) / img.width, (s.bottom - s.top + 6) / img.height);
      pg.drawImage(img, { x: s.x0, y: H - s.bottom, width: img.width * sc, height: img.height * sc });
    }
    form.updateFieldAppearances(await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold));
    pdf.setAuthor(''); pdf.setCreator('Ricky Rampersad Branch motor quote');
    return pdf.save();
  }

  var api = { PROPOSAL: PROPOSAL, KYP: KYP, fillProposal: fillProposal, fillKyp: fillKyp, mdy: mdy, ansi: ansi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MQForms = api;
})(typeof window !== 'undefined' ? window : this);
