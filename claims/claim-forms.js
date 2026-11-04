/* Guardian General's Motor Vehicle Accident Report Form, filled on Guardian's own PDF.
 *
 * Asked for on 3 November 2026, with the blank attached: "It has to line up exactly in a
 * bold color." The blank is in claims/forms/ exactly as Guardian issues it:
 *   - gg-motor-accident-report.pdf, GG-MOT-CLM-02/2025, five US Legal pages (612 x 1008)
 *     with NO form fields at all, so every answer is printed at the position of its own
 *     ruled blank.
 *
 * How the positions were found: the rules on this form are drawn lines, not underscore
 * runs (only four underscore blanks exist on the whole document), so they cannot be read
 * off the text layer the way the motor proposal's were. The page was rasterised at 150dpi
 * and every long, thin, horizontal dark run was detected by pixel, converted to points,
 * and matched to the label sitting to its left on the same baseline. 193 rules, of which
 * the ones below are the blanks a filed claim can actually answer.
 *
 * Coordinates are PDF points from the TOP of the page, the same convention motor-quote/
 * forms.js uses; the drawing turns them round. The colour and weight are that file's too
 * (a dark blue pen, bold), so a filled claim form and a filled proposal read as one branch.
 *
 * Guardian asks for a good deal this branch never collects — sex, date of birth,
 * occupation, employer, class of vehicle, physical impairment, convictions, the third
 * party's insurer. Those blanks are deliberately left for a person to complete; a claim
 * form that invents them is worse than one with gaps.
 *
 * Works in the browser (window.ClaimForms, with window.PDFLib) and in Node
 * (module.exports, with pdf-lib).
 */
(function (root) {
  var H = 1008;                            // US Legal, portrait
  var INK = [0.02, 0.09, 0.36];            // the same dark blue pen the motor forms use
  var SIZE = 10.5;                         // bold, the size of the form's own print

  /* A blank to write on: the page, its line's distance from the top, and the x range of
     the rule itself — so a long answer can be shrunk to fit its own blank rather than
     running across the next one. */
  function bl(p, top, x0, x1, size) { return { t: 'text', p: p, top: top, x0: x0, x1: x1, size: size }; }

  /* A bounded box that wraps by word: the description of the accident, and the details of
     damage. Bounded by the box's own rules, so text cannot escape it. */
  function box(p, top, x0, x1, lines, lead, size) {
    return { t: 'box', p: p, top: top, x0: x0, x1: x1, lines: lines, lead: lead || 13.5, size: size || 9.5 };
  }

  var ACCIDENT = {
    /* page 1 — the insured, and the driver */
    claimRef:       bl(1, 259.9, 386.4, 576.5),
    vehicleReg:     bl(1, 320.6, 211.7, 336.5),
    insFirst:       bl(1, 373.9, 209.8, 324.5),
    insSurname:     bl(1, 373.9, 461.8, 576.5),
    insMobile:      bl(1, 392.4, 209.8, 324.5),
    insEmail:       bl(1, 437.5, 210.7, 576.5),
    /* NB: page 1 carries three Primary Contact / Email pairs. The middle one at
       top 592/636 belongs to the hire-purchase institution and must stay blank. */
    driverSame:     bl(1, 695.0, 248.6, 324.5),
    driverRel:      bl(1, 695.0, 461.8, 576.5),
    driverFirst:    bl(1, 717.1, 211.2, 326.4),
    driverSurname:  bl(1, 717.1, 461.8, 576.5),
    driverMobile:   bl(1, 756.0, 209.8, 324.5),
    driverEmail:    bl(1, 800.2, 210.7, 576.5),

    /* page 2 — 3.(b) the permit, and 5. the accident */
    permitNo:       bl(2, 171.8, 147.8, 278.4),
    permitClass:    bl(2, 171.8, 487.7, 577.0),
    permitIssue:    bl(2, 192.7, 151.2, 226.6),
    permitRenewal:  bl(2, 192.7, 321.1, 377.8),
    permitExpiry:   bl(2, 192.7, 515.5, 577.4),
    lossDate:       bl(2, 630.0, 217.0, 307.2),
    lossTime:       bl(2, 631.9, 397.4, 492.5),
    lossLocation:   bl(2, 654.2, 216.5, 577.0),
    lossCause:      bl(2, 676.3, 217.0, 307.2),
    policeStation:  bl(2, 721.0, 296.6, 577.0),

    /* page 3 — the account of it, and the damage */
    description:    box(3, 88.0, 63.4, 577.0, 11),
    /* bounded by its own rules at top 731.0 and 813.1 — 82pt, so five lines */
    damageDetails:  box(3, 745.0, 61.9, 576.5, 5),
    /* the form prints its own '$' ending at 492.3, so the amount starts clear of it */
    garageEstimate: bl(3, 948.7, 495.0, 577.0),

    /* pages 4 and 5 */
    anyoneInjured:  bl(4, 579.4, 179.5, 254.4),
    reportDate:     bl(5, 613.9, 156.0, 240.5)
  };

  /* Shrink to fit the blank rather than overrun it; never below 6pt, where it stops
     being legible and a gap would serve the assessor better. */
  function fit(font, text, width, size) {
    var s = size || SIZE;
    while (s > 6 && font.widthOfTextAtSize(text, s) > width - 4) s -= 0.25;
    return s;
  }

  function wrap(font, text, width, size, maxLines) {
    var words = String(text || '').split(/\s+/).filter(Boolean), rows = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var next = line ? line + ' ' + words[i] : words[i];
      if (font.widthOfTextAtSize(next, size) > width) {
        if (line) rows.push(line);
        line = words[i];
        if (rows.length >= maxLines) break;          // a real stop: forEach+return would not
      } else line = next;
    }
    if (line && rows.length < maxLines) rows.push(line);
    return rows.slice(0, maxLines);
  }

  /* values: { claimRef, vehicleReg, insFirst, ... } — anything missing is left blank. */
  async function fillAccident(bytes, values, PDFLib) {
    var L = PDFLib || root.PDFLib;
    var pdf = await L.PDFDocument.load(bytes);
    var font = await pdf.embedFont(L.StandardFonts.HelveticaBold);
    var pages = pdf.getPages();
    var ink = L.rgb(INK[0], INK[1], INK[2]);

    Object.keys(ACCIDENT).forEach(function (key) {
      var spec = ACCIDENT[key];
      var val = values[key];
      if (val === undefined || val === null || String(val).trim() === '') return;
      var page = pages[spec.p - 1];
      if (!page) return;

      if (spec.t === 'box') {
        var rows = wrap(font, val, spec.x1 - spec.x0 - 12, spec.size, spec.lines);
        rows.forEach(function (t, i) {
          page.drawText(t, {
            x: spec.x0 + 6, y: H - spec.top - i * spec.lead,
            size: spec.size, font: font, color: ink
          });
        });
        return;
      }

      var s = String(val).trim();
      var size = fit(font, s, spec.x1 - spec.x0, spec.size);
      page.drawText(s, { x: spec.x0 + 2, y: H - spec.top + 2.6, size: size, font: font, color: ink });
    });

    pdf.setAuthor('');
    pdf.setCreator('Ricky Rampersad Branch claims');
    return pdf.save();
  }

  var api = { ACCIDENT: ACCIDENT, fillAccident: fillAccident, INK: INK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClaimForms = api;
})(typeof window !== 'undefined' ? window : this);
