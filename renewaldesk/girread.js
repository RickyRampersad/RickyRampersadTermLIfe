/* The renewal desk (29 October 2026): reading Guardian General's renewal notice in the browser.
 *
 * "it pulls up last year and guides the renewal process": the new premium is only on Guardian General's notice, a PDF
 * attached to its reminder in the support@ inbox (TTCPL0100001-9100001-IFORM-I.PDF and the like). The desk fetches the
 * attachment behind the staff member's sign-in, reads it here with pdf.js, and shows what it found for a person to
 * confirm. Nothing is filed until they press Save. The layouts were read off real notices: liability (limits), property
 * (risk locations with their sums insured) and motor (one block a vehicle, a fleet many).
 *
 * GirRead.text(arrayBuffer)  the PDF's text, one string (pdf.js, loaded by the page from cdnjs)
 * GirRead.parse(text)        { policy, replaces, title, insured, amount, from, to, premium, tax, total, items, reqs,
 *                              tranId, preparedBy, preparedOn, warnings }
 */
(function (root) {
  'use strict';
  var MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function num(s) { var v = Number(String(s == null ? '' : s).replace(/[^0-9.]/g, '')); return isNaN(v) ? 0 : v; }
  /* "January 20, 2026" → 2026-01-20 */
  function ymd(s) {
    var m = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(String(s || ''));
    if (!m) return '';
    var i = MON.indexOf(m[1].slice(0, 3).toLowerCase());
    return i < 0 ? '' : m[3] + '-' + pad(i + 1) + '-' + pad(+m[2]);
  }
  var POL = '([A-Z]{2}\\s*[A-Z]{3}\\s*\\d{5,8})';
  function polKey(p) { var m = /([A-Z]{2})\s*([A-Z]{3})\s*0*(\d+)/i.exec(String(p || '')); return m ? (m[1] + m[2] + m[3]).toUpperCase() : ''; }
  function polShow(p) { var m = /([A-Z]{2})\s*([A-Z]{3})\s*(\d+)/i.exec(String(p || '')); return m ? (m[1] + ' ' + m[2] + ' ' + m[3]).toUpperCase() : String(p || '').trim(); }

  /* ── the text of a PDF (pdf.js in the browser) ───────────────────────────────────────────── */
  function text(buf) {
    var lib = root.pdfjsLib;
    if (!lib) return Promise.reject(new Error('The PDF reader did not load. Check the connection and open the page again.'));
    return lib.getDocument({ data: buf }).promise.then(function (doc) {
      var out = [], n = 0;
      var page = function () {
        n++;
        if (n > doc.numPages) return out.join('  ');
        return doc.getPage(n).then(function (p) { return p.getTextContent(); }).then(function (tc) {
          var rows = [];
          tc.items.forEach(function (it) {
            if (!it.str || !it.str.trim()) return;
            var x = it.transform[4], y = it.transform[5], r = null;
            for (var i = 0; i < rows.length; i++) if (Math.abs(rows[i].y - y) < 2.5) { r = rows[i]; break; }
            if (!r) { r = { y: y, items: [] }; rows.push(r); }
            r.items.push({ x: x, s: it.str, w: it.width || 0 });
          });
          rows.sort(function (a, b) { return b.y - a.y; });
          rows.forEach(function (r) {
            r.items.sort(function (a, b) { return a.x - b.x; });
            out.push(r.items.map(function (it) { return it.s; }).join(' '));
          });
          return page();
        });
      };
      return page();
    });
  }

  /* ── the notice ─────────────────────────────────────────────────────────────────────────── */
  var PROPERTY_LABELS = ['Building', 'Buildings', 'Stock', 'Plant,\\s*Machinery\\s*&\\s*Equipment', 'Plant\\s*,?\\s*Machinery\\s*and\\s*Equipment', 'Furniture/Fixtures/Fittings',
    'Furniture,?\\s*Fixtures\\s*(?:&|and)\\s*Fittings', 'General Contents', 'Contents', 'Electronic Equipment', 'Improvements?\\s*(?:&|and)\\s*Betterments?', 'Swimming Pool',
    'Outbuildings?', 'Money', 'Business Interruption', 'Loss of Rent', 'Glass', 'Machinery'];
  var LABEL_RE = new RegExp('(' + PROPERTY_LABELS.join('|') + ')\\s*\\$\\s*([\\d,]+)(?![\\d,]*\\.\\d)', 'gi');

  function parse(raw) {
    var t = String(raw || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(), out = { items: [], reqs: [], warnings: [] }, m;
    m = new RegExp('Policy Number:\\s*' + POL).exec(t);
    out.policy = m ? polShow(m[1]) : '';
    m = new RegExp('Replaces Policy Number:\\s*' + POL).exec(t);
    out.replaces = m ? polShow(m[1]) : '';
    m = /(?:^|\s)([A-Z][A-Za-z&' ]{2,40}?)\s+Policy Number:/.exec(t);
    out.title = m ? m[1].replace(/^null\s+/i, '').trim() : '';
    m = /Renewal Amount:\s*\$\s*([\d,]+\.\d{2})/.exec(t);
    out.amount = m ? num(m[1]) : 0;
    m = /Insured\s+(.+?)\s+Period of Insurance/.exec(t);
    out.insured = m ? m[1].trim() : '';
    /* where the notice was addressed, less the insured's name: "TO: <insured> <address> Renewal Amount" */
    m = /TO:\s*(.+?)\s+Renewal Amount/.exec(t);
    if (m) { var to = m[1].trim(); out.address = out.insured && to.toLowerCase().indexOf(out.insured.toLowerCase()) === 0 ? to.slice(out.insured.length).trim() : to; }
    /* the producer named on the notice: "Producer Ricky Rampersad Guardian Life of The Caribbean c/o …" */
    m = /Producer\s+(.+?)\s+(?:Guardian Life|c\/o|Dear Policyholder|RISK DETAILS)/.exec(t);
    out.producer = m && m[1].length < 60 ? m[1].trim() : '';
    m = /From:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+To:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/.exec(t);
    out.from = m ? ymd(m[1]) : '';
    out.to = m ? ymd(m[2]) : '';
    m = /Total Premium\s+\$\s*([\d,]+\.\d{2})/.exec(t);
    out.premium = m ? num(m[1]) : 0;
    m = /Government Tax\s+\$\s*([\d,]+\.\d{2})/.exec(t);
    out.tax = m ? num(m[1]) : 0;
    m = /Government Tax\s+\$\s*[\d,]+\.\d{2}\s+Total\s+\$\s*([\d,]+\.\d{2})/.exec(t);
    out.total = m ? num(m[1]) : (out.premium ? Math.round((out.premium + out.tax) * 100) / 100 : out.amount);
    m = /Tran Id:\s*(\d+)/.exec(t);
    out.tranId = m ? m[1] : '';
    m = /Prepared by:\s*(.+?)\s+on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/.exec(t);
    out.preparedBy = m ? m[1].trim() : '';
    out.preparedOn = m ? ymd(m[2]) : '';

    /* the risk details: between "DETAILS PREMIUM" and "Total Premium" */
    var a = t.search(/DETAILS\s+PREMIUM/), b = t.search(/Total Premium\s+\$/);
    var block = a >= 0 && b > a ? t.slice(a).replace(/^DETAILS\s+PREMIUM\s*/, '').slice(0, b - a) : '';
    block = block.replace(/Total Premium[\s\S]*$/, '').trim();
    if (/Reg#:/i.test(block)) out.items = vehicles(block);
    else if (/Risk Location:/i.test(block)) out.items = locations(block);
    else if (/Limit:/i.test(block)) out.items = limits(block);
    else if (block) out.items = generic(block);

    /* what Guardian General needs before it renews */
    m = /subject to the submission of the (?:below|following)[^:]*:\s*(.+?)(?=\s+(?:Material facts|OCCUPANCY|ADEQUACY|Consent|Thank you|Head Office|Please advise|If any of the above)\b|$)/i.exec(t);
    if (m) out.reqs = splitReqs(m[1]);
    m = /renewal is invited subject to submission of the following requirements:\s*(.+?)(?=\s+(?:Please advise|If any of the above|Tran Id)\b|$)/i.exec(t);
    if (m) out.reqs = out.reqs.concat(m[1].split(/\s+-(?=[A-Z])/).map(function (s) { return s.replace(/^-/, '').trim(); }).filter(Boolean));
    /* "Submission of the undermentioned required on/before 2026 renewal: (a) … (b) …" */
    m = /Submission of the undermentioned required[^:]*:\s*(.+?)(?=\s+(?:Material facts|OCCUPANCY|ADEQUACY|Consent|Thank you|Head Office|Please advise|If any of the above|Tran Id)\b|$)/i.exec(t);
    if (m) out.reqs = out.reqs.concat(splitReqs(m[1]));
    /* "If you have not already provided all outstanding "Know Your Customer" documents, please do so at renewal." */
    if (/Know Your Customer/i.test(t)) out.kyc = true;
    if (/ADEQUACY OF SUM INSURED/i.test(t)) out.adequacy = true;
    if (/declaration basis/i.test(t)) out.declaration = true;

    if (!out.policy) out.warnings.push('No policy number found: is this a Guardian General renewal notice?');
    if (!out.from || !out.to) out.warnings.push('The period of insurance was not read: type it in.');
    if (!out.total) out.warnings.push('The total was not read: type it in.');
    var sum = out.items.reduce(function (s, x) { return s + (x.premium || 0); }, 0);
    if (out.items.length && sum && out.premium && Math.abs(sum - out.premium) > 1) out.warnings.push('The items add to ' + sum.toFixed(2) + ', the notice says ' + out.premium.toFixed(2) + ': check the items.');
    out.key = polKey(out.policy);
    return out;
  }
  function splitReqs(s) {
    return String(s).split(/\s*\([a-z]\)\s*/i).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(function (x) { return x.length > 2; });
  }
  /* one vehicle: "2023 Kia Sportage Crossover/ SUV Eng#:G4FP… Chassis#:USYP… Reg#:PEE6927 Coverage:Comprehensive
     Sum Insured:$ 221,730 CC:1591 Windscreen: $ 8,000.00 No Claim Discount: 60.00% … $ 5,625.87" */
  function vehicles(block) {
    var out = [], re = /((?:19|20)\d{2})\s+(.+?)\s+Eng#:\s*(\S*)\s+Chassis#:\s*(\S*)\s+Reg#:\s*([A-Z0-9-]+)\s*(.*?)\$\s*([\d,]+\.\d{2})(?=\s*$|\s+(?:19|20)\d{2}\s)/g, m;
    while ((m = re.exec(block))) {
      var rest = m[6], x;
      var v = { kind: 'vehicle', year: Number(m[1]), desc: m[2].replace(/\s+/g, ' ').trim(), engine: m[3], chassis: m[4], reg: m[5].toUpperCase(), premium: num(m[7]) };
      x = /Coverage:\s*([A-Za-z ]+?)(?=\s+(?:Sum Insured|CC:|Windscreen|No Claim|$))/.exec(rest); if (x) v.coverage = x[1].trim();
      x = /Sum Insured:\s*\$\s*([\d,]+)/.exec(rest); if (x) v.value = num(x[1]);
      x = /Windscreen:\s*\$\s*([\d,]+(?:\.\d{2})?)/.exec(rest); if (x) v.windscreen = num(x[1]);
      x = /No Claim Discount:\s*([\d.]+)%/.exec(rest); if (x) v.ncd = Number(x[1]);
      x = /CC:\s*(\d+)/.exec(rest); if (x) v.cc = x[1];
      out.push(v);
    }
    return out;
  }
  /* one location: "Risk Location: LP 451 Southern Main Road, …, CHAGUANAS Stock $ 500,000 Plant,Machinery & Equipment $ 10,000 … $ 3,025.00" */
  function locations(block) {
    return block.split(/Risk Location:\s*/i).slice(1).map(function (seg) {
      var sums = [], first = -1, m;
      /* the newer layout: "Sum Insured/Limit of Liability: Plant Machinery & Equipment: $ 26,974,639.00 Mobile Plant: $ .00 $ 364,157.62",
         each sum as "Label: $ amount", cents included, and the premium last */
      var si = /Sum Insured\s*\/\s*Limit of Liability:\s*/i.exec(seg);
      if (si) {
        first = si.index;
        var rest = seg.slice(si.index + si[0].length), re2 = /([A-Za-z][A-Za-z,&/()' .\-]{1,60}?):\s*\$\s*([\d,]*\.?\d*)/g;
        while ((m = re2.exec(rest))) { var v = num(m[2]); if (v > 0) sums.push({ label: m[1].replace(/\s+/g, ' ').trim(), value: v }); }
      } else {
        LABEL_RE.lastIndex = 0;
        while ((m = LABEL_RE.exec(seg))) { if (first < 0) first = m.index; sums.push({ label: m[1].replace(/\s+/g, ' ').replace(/,(?=\S)/g, ', '), value: num(m[2]) }); }
      }
      var prem = seg.match(/\$\s*([\d,]+\.\d{2})/g);
      return { kind: 'location', location: (first >= 0 ? seg.slice(0, first) : seg).replace(/\s+/g, ' ').trim().replace(/[,\s]+$/, ''), sums: sums,
        value: sums.reduce(function (s, x) { return s + x.value; }, 0), premium: prem ? num(prem[prem.length - 1]) : 0 };
    }).filter(function (x) { return x.location || x.sums.length; });
  }
  /* "Type of Liability: PUBLIC Limit: Any one Accident $ 6,300,000 Any one Period $ 6,300,000 Excess Property Damage: $ 3,000 $ 7,500.00" */
  function limits(block) {
    var o = { kind: 'limit' }, m;
    m = /Type of Liability:\s*([A-Z ]+?)\s+Limit:/i.exec(block); if (m) o.type = m[1].trim();
    m = /Any one Accident\s*\$\s*([\d,]+)/i.exec(block); if (m) o.accident = num(m[1]);
    m = /Any one Period\s*\$\s*([\d,]+)/i.exec(block); if (m) o.period = num(m[1]);
    m = /Excess[^$]*\$\s*([\d,]+)(?![\d,]*\.\d)/i.exec(block); if (m) o.excess = num(m[1]);
    var prem = block.match(/\$\s*([\d,]+\.\d{2})/g); o.premium = prem ? num(prem[prem.length - 1]) : 0;
    o.value = o.period || o.accident || 0;
    return [o];
  }
  function generic(block) {
    var sums = [], m, re = /([A-Za-z][A-Za-z,&/()' .\-]{2,60}?)\s*\$\s*([\d,]+)(?![\d,]*\.\d)/g;
    while ((m = re.exec(block))) sums.push({ label: m[1].trim(), value: num(m[2]) });
    var prem = block.match(/\$\s*([\d,]+\.\d{2})/g);
    return [{ kind: 'other', text: block.slice(0, 400), sums: sums, value: sums.reduce(function (s, x) { return s + x.value; }, 0), premium: prem ? num(prem[prem.length - 1]) : 0 }];
  }

  var api = { text: text, parse: parse, polKey: polKey, polShow: polShow, ymd: ymd };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GirRead = api;
})(typeof window !== 'undefined' ? window : this);
