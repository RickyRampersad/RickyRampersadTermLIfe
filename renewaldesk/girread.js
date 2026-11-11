/* The renewal desk (29 October 2026): reading Guardian General's renewal notice in the browser.
 *
 * "it pulls up last year and guides the renewal process": the new premium is only on Guardian General's notice, a PDF
 * attached to its reminder in the support@ inbox (TTCPL0100001-9100001-IFORM-I.PDF and the like). The desk fetches the
 * attachment behind the staff member's sign-in, reads it here with pdf.js, and shows what it found for a person to
 * confirm. Nothing is filed until they press Save. The layouts were read off real notices: liability (limits), property
 * (risk locations with their sums insured) and motor (one block a vehicle, a fleet many).
 *
 * GirRead.text(arrayBuffer)  the PDF's text, one string (pdf.js, loaded by the page from cdnjs)
 * GirRead.parse(text)        { policy, replaces, title, insured, amount, from, to, premium, tax, total, taxRate,
 *                              taxRead, items, reqs, tranId, preparedBy, preparedOn, warnings }
 *                            each item: { premium, tax, total } — premium BEFORE tax, as the notice prints it;
 *                            total WITH tax, which is how Salesforce holds it (see taxItems below).
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
    taxItems(out);

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
  /* ── THE PREMIUMS ON A NOTICE ARE BEFORE TAX; SALESFORCE HOLDS BOTH ───────────────────────
     Every figure in the DETAILS column is tax-exclusive, and the notice adds the government
     premium tax once at the foot:

       Total Premium   $ 196,457.00      ← the items add to exactly this
       Government Tax  $  11,787.50      ← 6%
       Total           $ 208,244.50      ← and this is the Renewal Amount

     Risk_Details__c carries the same pair: Premium_01_Cover_01__c before tax and
     Total_Premiums_Gov_t_Inclusive__c with it. Everything else in this product already works
     on the inclusive figure — the history, last year's premium, the letter, the premium-rise
     insight — so the reconciliation has to as well, and that needs a tax figure PER ITEM.

     THE RATE COMES FROM THE NOTICE, NOT FROM HERE. It prints its own Government Tax, so the
     rate is read (tax ÷ premium) and 6% is only the fallback for a notice that prints none.
     A change in the tax then follows by itself, and a notice at some other rate is flagged
     rather than quietly overridden.

     AND THE ITEMS ARE APPORTIONED, NOT EACH ROUNDED. Guardian General's own per-item rounding
     cannot be reproduced from the figures they print: on the 63-vehicle fleet, 6% rounded to
     the nearest cent on each item comes to 11,787.44 against their 11,787.50, and rounding up
     gives 11,787.54. Their internal premiums evidently carry more decimals than the notice
     shows. Rounding each item independently would therefore leave every row a cent or two out
     — and on a screen built to compare our figure against theirs, cents of noise on 63 rows is
     the same fault as no match at all. So the tax is split by largest remainder: each item is
     within a cent of the true rate, and the items add to the notice's own Government Tax
     EXACTLY, which means the notice goes on checking itself. */
  var TAX_RATE = 0.06;
  function taxItems(out) {
    var items = out.items || [];
    var read = !!(out.premium && out.tax);
    var rate = read ? out.tax / out.premium : TAX_RATE;
    out.taxRate = Math.round(rate * 1e6) / 1e6;
    out.taxRead = read;
    if (read && Math.abs(rate - TAX_RATE) > 0.0005) {
      out.warnings.push('The notice charges tax at ' + (Math.round(rate * 10000) / 100) + '%, not ' +
        (TAX_RATE * 100) + '%: check it before you file anything.');
    }
    var sub = items.reduce(function (s, x) { return s + (x.premium || 0); }, 0);
    if (!items.length || !sub) return;
    /* the notice's own tax when its items tie to its own Total Premium (the normal case, and
       the 63-vehicle fleet does tie to the cent); otherwise the rate on what we actually read,
       because apportioning a tax the items do not account for would spread the error */
    var want = read && Math.abs(sub - out.premium) < 1 ? out.tax : Math.round(sub * rate * 100) / 100;
    var cents = items.map(function (x) { return (x.premium || 0) * rate * 100; });
    var part = cents.map(function (c) { return Math.floor(c); });
    var left = Math.round(want * 100) - part.reduce(function (s, c) { return s + c; }, 0);
    /* biggest fraction first, then the biggest premium, so the spread is stable run to run */
    var order = items.map(function (x, i) { return i; }).sort(function (a, b) {
      return (cents[b] - Math.floor(cents[b])) - (cents[a] - Math.floor(cents[a])) ||
        (items[b].premium || 0) - (items[a].premium || 0) || a - b;
    });
    for (var i = 0; left > 0 && i < order.length; i++, left--) part[order[i]]++;
    for (var j = order.length - 1; left < 0 && j >= 0; j--) if (part[order[j]] > 0) { part[order[j]]--; left++; }
    items.forEach(function (x, k) {
      x.tax = Math.round(part[k]) / 100;
      x.total = Math.round(((x.premium || 0) + x.tax) * 100) / 100;
    });
  }
  function splitReqs(s) {
    return String(s).split(/\s*\([a-z]\)\s*/i).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(function (x) { return x.length > 2; });
  }
  /* ONE VEHICLE, AND THE NOTICE COMES IN TWO LAYOUTS (11 November 2026).
     Private motor runs it together and puts the premium LAST:
       "2023 Kia Sportage Crossover/ SUV Eng#:G4FP… Chassis#:USYP… Reg#:XBA2000 Coverage:Comprehensive
        Sum Insured:$ 221,730 CC:1591 Windscreen: $ 8,000.00 No Claim Discount: 60.00% … $ 5,625.87"
     A COMMERCIAL FLEET puts the premium on the DESCRIPTION line and the rest beneath it:
       "2019 Volvo Concrete/Water/Tractor Truck                $ 15,905.05
        Eng#:    Chassis#: Reg#:XAA1000
        Coverage: Comprehensive Sum Insured:$ 510,300 HP: 127.00
        Windscreen: $ 10,000.00"

     The old pattern demanded the premium AFTER Reg#, and demanded a registration. On a fleet it
     therefore matched NOTHING: the desk read the notice as empty, the notice total showed nil,
     and every one of our own sixty risks reported "not on notice" — which reads as the client's
     fleet being wrong when the fault is entirely ours. It would also have dropped the trailers
     and plant that carry no registration at all.

     So the block is cut into one segment per vehicle at the year that starts its description, and
     each field is read wherever it falls. THE PREMIUM IS THE FIRST UNLABELLED AMOUNT: the labelled
     ones are taken out first, which lands on the description line's figure for a fleet and on the
     trailing figure for a private motor, with one rule rather than two. */
  var MONEY_LABEL = /(Sum\s*Insured|Windscreen|Limit[^:$]{0,30}|Excess|Value)\s*:?\s*\$\s*[\d,]+(?:\.\d{2})?/gi;
  function clean(s) { s = String(s == null ? '' : s).trim().replace(/[.,;]+$/, ''); return s === '.' ? '' : s; }
  /* "Third Party" or "Comprehensive", however the notice spaces or cases it ("Coverage:Third
     Party", "Coverage: Comprehensive"). Anything else is kept as written rather than guessed at. */
  function cover(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (/third\s*party/i.test(s)) return 'Third Party';
    if (/comprehensive/i.test(s)) return 'Comprehensive';
    return s;
  }
  function vehicles(block) {
    var s = String(block || ''), out = [], starts = [], m;
    /* A vehicle starts at the year of its description. TEN ON ONE FLEET HAVE NO DESCRIPTION —
       the notice prints the year, then the premium, and the make and model are simply blank
       (they are trailers). So a year followed straight by the figure starts a vehicle too, and
       an item with no words to its name is kept rather than dropped: the registration and the
       premium are what the reconciliation needs, and the description is not. */
    var re = /(^|\s)((?:19|20)\d{2})(\s+)(?=[A-Z][A-Za-z]|\$)/g;
    while ((m = re.exec(s))) { starts.push({ i: m.index + m[1].length, y: m[2] }); re.lastIndex = m.index + m[0].length; }
    starts.forEach(function (st, k) {
      var v = vehicle(s.slice(st.i, k + 1 < starts.length ? starts[k + 1].i : s.length), st.y);
      if (v) out.push(v);
    });
    return out;
  }
  function vehicle(seg, year) {
    var body = seg.replace(/^(?:19|20)\d{2}\s+/, ''), x;
    var d = /^([\s\S]*?)(?=\s*\$|\s*Eng#:|$)/.exec(body);
    var desc = (d ? d[1] : body).replace(/\s+/g, ' ').trim();
    var p = /\$\s*([\d,]+\.\d{2})/.exec(seg.replace(MONEY_LABEL, ' '));
    var v = { kind: 'vehicle', year: Number(year), desc: desc, premium: p ? num(p[1]) : 0 };
    /* Eng#:, Chassis#: and Reg#: can each be EMPTY, and an empty one is followed straight by the
       next label — so the value must never be allowed to BE a label. A blank is a blank, not the
       word after it, and a trailer or a plant item carries no registration at all. */
    x = /Eng#:\s*(?!Chassis#|Reg#|Coverage)([A-Za-z0-9\-/.]*)/i.exec(seg); v.engine = x ? clean(x[1]) : '';
    x = /Chassis#:\s*(?!Reg#|Coverage|Eng#)([A-Za-z0-9\-/.]*)/i.exec(seg); v.chassis = x ? clean(x[1]) : '';
    x = /Reg#:\s*(?!Coverage|Eng#|Chassis#)([A-Za-z0-9-]*)/i.exec(seg); v.reg = x ? clean(x[1]).toUpperCase() : '';
    x = /Coverage:\s*([A-Za-z /]+?)(?=\s*(?:Sum\s*Insured|CC:|Windscreen|No\s*Claim|HP:|Excess|Underwriter|Eng#|Chassis#|Reg#|\$|$))/i.exec(seg);
    if (x) v.coverage = cover(x[1]);
    x = /Sum\s*Insured\s*:?\s*\$\s*([\d,]+(?:\.\d{2})?)/i.exec(seg); if (x) v.value = num(x[1]);
    x = /Windscreen\s*:?\s*\$\s*([\d,]+(?:\.\d{2})?)/i.exec(seg); if (x) v.windscreen = num(x[1]);
    x = /No\s*Claim\s*Discount\s*:?\s*([\d.]+)\s*%/i.exec(seg); if (x) v.ncd = Number(x[1]);
    x = /CC\s*:\s*(\d+)/i.exec(seg); if (x) v.cc = x[1];
    x = /HP\s*:\s*([\d.]+)/i.exec(seg); if (x) v.hp = Number(x[1]);
    /* a year on its own, with no figure and nothing to identify it, is not a vehicle */
    return (v.premium || v.reg || v.chassis || v.engine) ? v : null;
  }
  /* one location: "Risk Location: LP 12 Sample Road, …, SOMEWHERE Stock $ 500,000 Plant,Machinery & Equipment $ 10,000 … $ 3,025.00"
     (invented: the first cut of this comment carried a real client's risk location, and this file is published) */
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
