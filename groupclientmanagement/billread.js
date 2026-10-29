/* Billings Management (24 October 2026): reading a group's bills in the browser.
 *
 * "the staff log in … upload the group health, then life, then pensions if any and do the reconciliation". Guardian's
 * bills arrive as PDFs (Group Health's invoice from the health billing system; Group Life's member bill, its Statement of
 * Adjustment and the covering letter) and the branch's own pension and life list bill as a spreadsheet. This file turns
 * each into numbers the backend can check against Salesforce. Nothing here is a client's: the bill is read on the
 * staff member's own device, and what it finds goes to the backend behind their sign-in.
 *
 * BillRead.lines(arrayBuffer)  the PDF's text, one line a row of the page (pdf.js, loaded by the page from cdnjs)
 * BillRead.read(lines)         one document: { kind: 'health' | 'lifeBill' | 'lifeAdj' | 'lifeLetter' | 'unknown', … }
 * BillRead.sheet(rows)         a list bill from a spreadsheet's rows: { kind: 'listbill', … }
 * BillRead.combine(parts)      the documents of one line as one bill ({ health }, { life }, { listbill })
 * BillRead.samePerson(a, b)    one person under two spellings ("QUAN KEP ; KEITH" and "QUANKEP, KEITH")
 */
(function (root) {
  'use strict';
  var MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  /* "$53,492.00", "($1,028.00)", "$(514.00)", "(226,000.00)", "14,694.75" */
  function num(s) {
    s = String(s == null ? '' : s).trim();
    if (!s || s === '-') return 0;
    var neg = /\(/.test(s) || /^-/.test(s);
    var v = Number(s.replace(/[^0-9.]/g, ''));
    return isNaN(v) ? 0 : (neg ? -v : v);
  }
  var round = function (x) { return Math.round(x * 100) / 100; };
  var monIx = function (w) { return MON.indexOf(String(w || '').slice(0, 3).toLowerCase()); };
  /* "01-Oct-2021" → 2021-10-01; "September 25, 2026" → 2026-09-25; "October 01, 2026"; "31ST AUGUST 2026"; "9/25/2026" */
  function ymd(s) {
    s = String(s || '').trim();
    var m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
    if (m && monIx(m[2]) >= 0) return m[3] + '-' + pad(monIx(m[2]) + 1) + '-' + pad(+m[1]);
    m = /^([A-Za-z]+)\s+(\d{1,2})(?:ST|ND|RD|TH)?,?\s+(\d{4})$/i.exec(s);
    if (m && monIx(m[1]) >= 0) return m[3] + '-' + pad(monIx(m[1]) + 1) + '-' + pad(+m[2]);
    m = /^(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Za-z]+),?\s+(\d{4})$/i.exec(s);
    if (m && monIx(m[2]) >= 0) return m[3] + '-' + pad(monIx(m[2]) + 1) + '-' + pad(+m[1]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) return m[3] + '-' + pad(+m[1]) + '-' + pad(+m[2]);
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[0];
    return '';
  }
  /* "October 2026", "OCTOBER 2026", "October,2026", "2026-09 (Sep 2026)", "1--JUL--2026", "OCTOBER 1ST 2026" → 2026-10 */
  function month(s) {
    s = String(s || '');
    var m = /(\d{4})-(\d{2})\b/.exec(s);
    if (m) return m[1] + '-' + m[2];
    m = /\b([A-Za-z]{3,9})[\s,\-]*(?:\d{1,2}(?:ST|ND|RD|TH)?[\s,\-]+)?(\d{4})\b/i.exec(s);
    if (m && monIx(m[1]) >= 0) return m[2] + '-' + pad(monIx(m[1]) + 1);
    m = /\b\d{1,2}[\s\-]+([A-Za-z]{3})[\s\-]+(\d{4})\b/.exec(s);
    if (m && monIx(m[1]) >= 0) return m[2] + '-' + pad(monIx(m[1]) + 1);
    return '';
  }
  var AMT = '\\$?\\(?\\$?-?[\\d,]+\\.\\d\\d\\)?';
  var amtAtEnd = new RegExp('(' + AMT + ')\\s*$');

  /* ── the text of a PDF, as lines (pdf.js in the browser) ───────────────────────────────────── */
  function lines(buf) {
    var lib = root.pdfjsLib;
    if (!lib) return Promise.reject(new Error('The PDF reader did not load. Check the connection and open the page again.'));
    return lib.getDocument({ data: buf }).promise.then(function (doc) {
      var out = [], n = 0;
      var page = function () {
        n++;
        if (n > doc.numPages) return out;
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
            var line = '', end = null;
            r.items.forEach(function (it) {
              if (end !== null) { var gap = it.x - end; line += gap > 4 ? '   ' : gap > 0.8 ? ' ' : ''; }
              line += it.s; end = it.x + it.w;
            });
            out.push(line.replace(/\s+$/, ''));
          });
          out.push('<<page>>');
          return page();
        });
      };
      return page();
    });
  }

  /* ── which document this is ──────────────────────────────────────────────────────────────── */
  function kindOf(L) {
    var t = L.join('\n');
    if (/Group Health (Invoice|Payment Transmittal)/i.test(t)) return 'health';
    /* the covering letter names the statement too, so it is told first */
    if (/GROUP LIFE ASSURANCE PLAN\b/i.test(t) || /Monthly Billing (along with Statement|for\s+[A-Za-z]+\s+\d{4})/i.test(t)) return 'lifeLetter';
    if (/STATEMENT OF ADJUSTMENTS? AS AT/i.test(t)) return 'lifeAdj';
    if (/Monthly Billing\s*:/i.test(t) && /POLICY NO\s*:/i.test(t)) return 'lifeBill';
    return 'unknown';
  }
  function read(L) {
    L = (L || []).map(function (s) { return String(s || '').replace(/ /g, ' ').replace(/\s+$/, ''); });
    var k = kindOf(L);
    if (k === 'health') return readHealth(L);
    if (k === 'lifeBill') return readLifeBill(L);
    if (k === 'lifeAdj') return readLifeAdj(L);
    if (k === 'lifeLetter') return readLifeLetter(L);
    return { kind: 'unknown', lines: L.length, warnings: ['This does not look like a Group Health invoice or a Group Life bill, statement or letter.'] };
  }

  /* ── Group Health: the invoice from the health billing system ──────────────────────────────── */
  var TIER = /^(Employee(?:\s*\+\s*(?:Child(?:ren)?|Spouse|Family|Children|\d+))?|Employee Only|Single|Family|Couple|Member(?:\s*\+\s*\w+)?)$/i;
  var MEMBER = new RegExp('^(.+?)\\s+(\\d\\d-[A-Za-z]{3}-\\d{4})\\s+(\\S+)\\s+(\\d\\d-[A-Za-z]{3}-\\d{4})\\s+([A-Za-z]+\\s+\\d{4})\\s+(' + AMT + ')$');
  function readHealth(L) {
    var b = { kind: 'health', line: 'health', group: '', ref: '', month: '', dated: '', divisions: [], current: 0, adjustments: 0, adjByMonth: [], total: 0,
      outstanding: [], outstandingTotal: 0, payable: 0, dueBy: '', members: [], credits: [], transmittal: [], warnings: [] };
    var mode = '', inDiv = false, tier = '', sumDiv = null, outDiv = '', contract = '';
    var divByContract = {};
    L.forEach(function (s, i) {
      var t = s.trim(), m;
      if (!t) return;
      /* each page names what it is again in its heading; its letterhead is never a division */
      if (/^<<page>>$/.test(t)) { mode = ''; return; }
      if (/^GUARDIAN LIFE OF THE CARIBBEAN/i.test(t)) return;
      if (/Group Health Invoice Summary/i.test(t)) { mode = 'summary'; return; }
      if (/Outstanding Balance\(s\)/i.test(t)) { mode = 'outstanding'; return; }
      if (/Group Health Invoice Detail/i.test(t)) { mode = 'detail'; return; }
      if (/Group Health Invoice Credits and Adjustments/i.test(t)) { mode = 'credits'; tier = ''; return; }
      if (/Group Health Payment Transmittal/i.test(t)) { mode = 'transmittal'; return; }
      if ((m = /^(.*?)\s{2,}Employer Group ID:\s+(\S+)/.exec(s))) { if (!b.group && m[1].trim()) b.group = m[1].trim(); if (!b.ref) b.ref = m[2]; return; }
      if ((m = /Employer Group ID:\s*(\S+)/.exec(t))) { if (!b.ref) b.ref = m[1]; return; }
      if ((m = /Coverage for:\s*([A-Za-z]+\s+\d{4})/.exec(t))) { if (!b.month) b.month = month(m[1]); return; }
      if (!b.dated && (m = /^([A-Z][a-z]+ \d{1,2}, \d{4})\b/.exec(t)) && monIx(m[1]) >= 0) { b.dated = ymd(m[1]); return; }
      if ((m = /Payment to be remitted by:\s*(.+)$/i.exec(t))) { b.dueBy = ymd(m[1].trim()); return; }
      if ((m = /^TOTAL PAYABLE BALANCE.*?(\S+)$/i.exec(t))) { b.payable = num(m[1]); return; }
      if ((m = /^Benefit Contract ID:\s*(\S+)\s*-\s*(.+)$/i.exec(t))) { contract = m[1]; divByContract[contract] = m[2].trim(); tier = ''; return; }
      if (mode === 'summary') {
        if (/^DIVISIONS\b/i.test(t)) { inDiv = true; return; }
        if (!inDiv) return;
        if ((m = /^Total for current month\s+(\d+)\s+(\S+)$/i.exec(t))) { if (sumDiv) { sumDiv.employees = +m[1]; sumDiv.total = num(m[2]); } return; }
        if ((m = /^Credits\/Adjustments\s+(\S+)$/i.exec(t))) { b.adjustments = num(m[1]); sumDiv = null; return; }
        if ((m = /^(\d{4}-\d{2})\s*\(.*?\)\s+(\S+)$/.exec(t))) { b.adjByMonth.push({ month: m[1], amount: num(m[2]) }); return; }
        if ((m = /^Total Premium for current month\s+(\S+)$/i.exec(t))) { b.total = num(m[1]); return; }
        if ((m = /^(.+?)\s+(\d+)$/.exec(t)) && TIER.test(m[1].trim())) { if (sumDiv) sumDiv.tiers[m[1].trim()] = +m[2]; return; }
        /* a division's name: in capitals, with no amount */
        if (/^[A-Z0-9 .,&'()\-\/]+$/.test(t) && /[A-Z]{3,}/.test(t) && t.length > 6 && !/^(TOTAL|PRINTED)/.test(t)) { sumDiv = { name: t, employees: 0, total: 0, tiers: {} }; b.divisions.push(sumDiv); }
        return;
      }
      if (mode === 'outstanding') {
        if ((m = /^([A-Za-z]+\s+\d{4})\s+(\S+)\s+(\S+)$/.exec(t)) && /^G\d/.test(m[2])) { b.outstanding.push({ division: outDiv, month: month(m[1]), invoice: m[2], amount: num(m[3]) }); return; }
        if (/^Total Division Outstanding/i.test(t)) return;
        if (/^MONTH O\/S/i.test(t)) return;
        if (/^[A-Z0-9 .,&'()\-/]+$/.test(t) && t.length > 6 && !/TOTAL/.test(t)) { outDiv = t; return; }
        return;
      }
      if (mode === 'detail' || mode === 'credits') {
        if (TIER.test(t)) { tier = t; return; }
        if (/^Total for tier/i.test(t) || /^GRAND TOTAL/i.test(t) || /^EMPLOYEE NAME/i.test(t) || /^\(TTD\)$/.test(t)) return;
        if ((m = MEMBER.exec(t))) {
          var name = m[1].trim(), amt = num(m[6]);
          var row = { id: m[3], name: name, tier: tier, division: divByContract[contract] || '', contract: contract, start: ymd(m[2]), eff: ymd(m[4]), month: month(m[5]), premium: amt };
          if (mode === 'detail') b.members.push(row);
          else { row.kind = amt < 0 ? 'cancel' : 'adjust'; if (amt < 0) row.tier = ''; b.credits.push(row); }
        }
        return;
      }
      if (mode === 'transmittal') {
        if ((m = /^(Current Month|Canceled|Adjusted)\b(.*?)\s+(G\d\S+)\s+(\S+)$/i.exec(t))) b.transmittal.push({ what: (m[1] + m[2]).trim(), invoice: m[3], amount: num(m[4]) });
      }
    });
    /* a cancelled charge has no tier on the bill: it is the tier whose rate, in the same division, it reverses */
    var rates = {};
    b.members.forEach(function (x) { rates[x.division + '|' + x.premium] = x.tier; });
    b.credits.forEach(function (c) { if (c.kind === 'cancel') c.tier = rates[c.division + '|' + (-c.premium)] || ''; });
    b.current = round(b.divisions.reduce(function (s, d) { return s + d.total; }, 0));
    b.outstandingTotal = round(b.outstanding.reduce(function (s, o) { return s + o.amount; }, 0));
    b.due = b.total || round(b.current + b.adjustments);
    b.count = b.members.length;
    /* does it add up? A reading that does not is said, never guessed past */
    if (!b.month) b.warnings.push('The coverage month was not found on the bill.');
    if (!b.members.length) b.warnings.push('No members were read from the bill’s detail pages.');
    b.divisions.forEach(function (d) {
      var mem = b.members.filter(function (x) { return x.division === d.name || (!x.division && b.divisions.length === 1); });
      var sum = round(mem.reduce(function (s, x) { return s + x.premium; }, 0));
      if (mem.length && Math.abs(sum - d.total) > 0.05) b.warnings.push('The members read for ' + d.name + ' add to ' + money(sum) + '; the bill says ' + money(d.total) + '.');
      if (mem.length && d.employees && mem.length !== d.employees) b.warnings.push(d.employees + ' employees on the summary for ' + d.name + '; ' + mem.length + ' read from the detail.');
    });
    if (b.total && Math.abs(round(b.current + b.adjustments) - b.total) > 0.05) b.warnings.push('Current month ' + money(b.current) + ' and adjustments ' + money(b.adjustments) + ' do not make the total ' + money(b.total) + '.');
    var cr = round(b.credits.reduce(function (s, x) { return s + x.premium; }, 0));
    if (b.credits.length && Math.abs(cr - b.adjustments) > 0.05) b.warnings.push('The credits and adjustments read add to ' + money(cr) + '; the bill says ' + money(b.adjustments) + '.');
    if (b.payable && Math.abs(round(b.total + b.outstandingTotal) - b.payable) > 0.05) b.warnings.push('This month and the earlier months shown do not make the total payable of ' + money(b.payable) + '.');
    return b;
  }

  /* ── Group Life: the member bill ─────────────────────────────────────────────────────────── */
  var N = '\\(?-?[\\d,]*\\.?\\d+\\)?';
  /* Guardian's group life plans come in two layouts (27 October 2026: the second group's bill read no members at all):
     with New Life cover, ten figures a row (the three sums assured, six premiums, the total); without it, seven (two sums,
     four premiums, the total). A row is read by how many figures it carries; the statement's rows the same way. */
  var LIFE_COLS = {
    10: ['basic', 'add', 'newLife', 'pBasic', 'pBasicX', 'pAdd', 'pAddX', 'pNew', 'pNewX', 'premium'],
    7: ['basic', 'add', 'pBasic', 'pBasicX', 'pAdd', 'pAddX', 'premium']
  };
  function lifeFig(v) {
    var cols = LIFE_COLS[v.length]; if (!cols) return null;
    var o = { basic: 0, add: 0, newLife: 0, pBasic: 0, pBasicX: 0, pAdd: 0, pAddX: 0, pNew: 0, pNewX: 0, premium: 0 };
    cols.forEach(function (c, i) { o[c] = v[i]; });
    return o;
  }
  var LIFE_ROW = new RegExp('^(\\d{1,5})\\s+(.+?)((?:\\s+' + N + '){7,10})$');
  function readLifeBill(L) {
    var b = { kind: 'lifeBill', line: 'life', group: '', ref: '', month: '', dated: '', members: [], totals: null, total: 0, lives: 0, rates: null, warnings: [] };
    var odd = 0;
    L.forEach(function (s, i) {
      var t = s.trim(), m;
      if (!t) return;
      if ((m = /Monthly Billing\s*:\s*(.+)$/i.exec(t))) {
        if (!b.month) b.month = month(m[1]);
        /* the company is the line above, past any "GL POLICY NO" line (one layout puts it between the two) */
        for (var j = i - 1; j >= 0 && !b.group; j--) { var u = L[j].trim(); if (u && !/POLICY NO|^GL$|<<page>>/i.test(u)) b.group = u; }
        return;
      }
      if ((m = /POLICY NO\s*:\s*(.+)$/i.exec(t))) { if (!b.ref) b.ref = m[1].trim(); return; }
      if ((m = /^No\.? of Lives:?\s+(\d+)/i.exec(t))) { if (!b.lives) b.lives = +m[1]; return; }
      if ((m = /^GRAND TOTAL:?\s+(.+)$/i.exec(t))) {
        var v = m[1].trim().split(/\s+/).map(num);
        b.totals = lifeFig(v);
        b.total = v[v.length - 1];
        return;
      }
      if (!b.dated && (m = /(\d{1,2}-[A-Za-z]{3}-\d{4})\s+Page\s+\d/i.exec(t))) b.dated = ymd(m[1]);
      if ((m = LIFE_ROW.exec(t))) {
        var f = lifeFig(m[3].trim().split(/\s+/).map(num));
        if (!f) { odd++; return; }
        b.members.push(Object.assign({ id: m[1], cert: m[1], name: m[2].trim() }, f));
      }
    });
    if (odd) b.warnings.push(odd + ' row' + (odd === 1 ? '' : 's') + ' of the life bill carry a number of figures the reader does not know: check them by eye.');
    lifeChecks(b);
    if (b.lives && b.members.length && b.lives !== b.members.length) b.warnings.push('The bill says ' + b.lives + ' lives; ' + b.members.length + ' were read.');
    return b;
  }
  /* the rates are the ones most members are charged (per 1,000 a month): a member charged at another is a question */
  function rateOf(list, sum, prem) {
    var seen = {};
    list.forEach(function (x) { if (x[sum] > 0 && x[prem] > 0) { var r = Math.round(x[prem] / x[sum] * 1000 * 1000) / 1000; seen[r] = (seen[r] || 0) + 1; } });
    var best = null, n = 0;
    Object.keys(seen).forEach(function (k) { if (seen[k] > n) { n = seen[k]; best = Number(k); } });
    return best;
  }
  function lifeChecks(b) {
    if (!b.month) b.warnings.push('The billing month was not found on the life bill.');
    if (!b.members.length) { b.warnings.push('No members were read from the life bill.'); return; }
    b.rates = { basic: rateOf(b.members, 'basic', 'pBasic'), add: rateOf(b.members, 'add', 'pAdd'), newLife: rateOf(b.members, 'newLife', 'pNew') };
    var sum = round(b.members.reduce(function (s, x) { return s + x.premium; }, 0));
    if (b.total && Math.abs(sum - b.total) > 0.05) b.warnings.push('The members read add to ' + money(sum) + '; the grand total says ' + money(b.total) + '.');
    if (!b.total) b.total = sum;
    b.offRate = [];
    b.members.forEach(function (x) {
      var own = round(x.pBasic + x.pBasicX + x.pAdd + x.pAddX + x.pNew + x.pNewX);
      if (Math.abs(own - x.premium) > 0.05) b.offRate.push({ cert: x.cert, name: x.name, why: 'its premiums add to ' + money(own) + ', not the ' + money(x.premium) + ' charged' });
      [['basic', 'pBasic', 'basic'], ['add', 'pAdd', 'AD&D'], ['newLife', 'pNew', 'New Life']].forEach(function (k) {
        var r = b.rates[k[0]];
        if (r == null || !x[k[0]]) return;
        var want = round(x[k[0]] * r / 1000);
        if (Math.abs(want - x[k[1]]) > 0.05) b.offRate.push({ cert: x.cert, name: x.name, why: k[2] + ' ' + money(x[k[1]]) + ' on ' + money(x[k[0]], 0) + ', where the rate of ' + r + ' a thousand gives ' + money(want) });
      });
    });
    b.count = b.members.length;
  }

  /* ── Group Life: the Statement of Adjustment ─────────────────────────────────────────────── */
  var ADJ_ROW = new RegExp('^(\\d{1,5})\\s+(.+?)\\s+(\\d{1,3})((?:\\s+' + N + '){7,10})$');
  function readLifeAdj(L) {
    var b = { kind: 'lifeAdj', line: 'life', group: '', ref: '', month: '', before: 0, after: 0, adjustments: [], warnings: [] };
    var section = '', asAt = '';
    L.forEach(function (s, i) {
      var t = s.trim(), m;
      if (!t) return;
      if ((m = /STATEMENT OF ADJUSTMENTS? AS AT\s+(.+)$/i.exec(t))) { b.month = month(m[1].replace(/(\d)(ST|ND|RD|TH)\b/i, '$1')); return; }
      if (/^[A-Z]{2,5}\s?\d{2,6}$/.test(t) && !b.ref) { b.ref = t; if (i > 0 && !b.group) b.group = L[i - 1].trim(); return; }
      if ((m = /^PREMIUM DUE BEFORE ADJUSTMENTS?:\s+(.+)$/i.exec(t))) { var v = m[1].trim().split(/\s+/); b.before = num(v[v.length - 1]); return; }
      if ((m = /^PREMIUM DUE AFTER ADJUSTMENTS?:\s+(.+)$/i.exec(t))) { var w = m[1].trim().split(/\s+/); b.after = num(w[w.length - 1]); return; }
      if (/^NET ADJUSTMENTS?/i.test(t)) return;
      if ((m = /^(LESS|ADD|PLUS)\b\s*(.*)$/i.exec(t))) { section = (m[1] + ' ' + m[2]).toUpperCase(); asAt = ymd((/AS AT:?\s*(.+)$/i.exec(m[2]) || [])[1] || ''); return; }
      /* the date under the heading: "31ST AUGUST 2026" on one plan's statement, "AUGUST 31ST 2026" on another's */
      if (!asAt && (/^\d{1,2}(ST|ND|RD|TH)?\s+[A-Z]+,?\s+\d{4}$/i.test(t) || /^[A-Z]+\s+\d{1,2}(ST|ND|RD|TH)?,?\s+\d{4}$/i.test(t))) { asAt = ymd(t); return; }
      if ((m = ADJ_ROW.exec(t))) {
        var f = lifeFig(m[4].trim().split(/\s+/).map(num));
        if (!f) return;
        var kind = /TERMINAT|DELET|CANCEL|LEAV|RESIGN/.test(section) ? 'left' : /ADDITION|NEW|ENTRANT|ENROL|JOIN/.test(section) ? 'joined' : /INCREASE|DECREASE|SALAR|CHANGE|AMEND/.test(section) ? 'cover' : (f.premium < 0 ? 'left' : 'joined');
        b.adjustments.push({ cert: m[1], id: m[1], name: m[2].trim(), periods: +m[3], kind: kind, asAt: asAt, section: section.replace(/\s+/g, ' ').trim(),
          basic: f.basic, add: f.add, newLife: f.newLife, premium: f.premium });
      }
    });
    var net = round(b.adjustments.reduce(function (s, x) { return s + x.premium; }, 0));
    if (b.before && b.after && Math.abs(round(b.before + net) - b.after) > 0.05) b.warnings.push('Before adjustments ' + money(b.before) + ' and the adjustments read (' + money(net) + ') do not make ' + money(b.after) + '.');
    return b;
  }

  /* ── Group Life: the covering letter ─────────────────────────────────────────────────────── */
  function readLifeLetter(L) {
    var b = { kind: 'lifeLetter', line: 'life', group: '', ref: '', month: '', dated: '', due: 0, warnings: [] };
    var t = L.join(' ').replace(/\s+/g, ' '), m;
    if ((m = /ASSURANCE PLAN(?:\s+NO\.?)?\s*:?\s*([A-Z]{2,5}\s?\d{2,6})/i.exec(t))) b.ref = m[1];
    if ((m = /Statement of Adjustments? for\s+([A-Z]+\s+\d{4})/i.exec(t)) || (m = /Monthly Billing for\s+([A-Z]+\s+\d{4})/i.exec(t))) b.month = month(m[1]);
    if ((m = /amount of\s+(\$?[\d,]+\.\d\d)\s+due/i.exec(t))) b.due = num(m[1]);
    if ((m = /^([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(L[0] || ''))) b.dated = ymd(m[1]);
    for (var i = 0; i < L.length; i++) if (/GROUP LIFE ASSURANCE PLAN\b/i.test(L[i]) && i > 0) { b.group = L[i - 1].trim(); break; }
    if ((m = /within\s+[a-z\- ]*\(?(\d{2})\)?\s*days/i.exec(t))) b.reportDays = +m[1];
    return b;
  }

  /* ── the branch's own pension and life list bill, from a spreadsheet ─────────────────────── */
  function sheet(rows) {
    var b = { kind: 'listbill', line: 'listbill', group: '', ref: '', month: '', members: [], subtotals: {}, total: 0, warnings: [], source: 'upload' };
    var head = -1, col = {}, section = '', kind = '';
    rows = (rows || []).map(function (r) { return (r || []).map(function (v) { return v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v).trim(); }); });
    rows.forEach(function (r, i) {
      var joined = r.filter(String).join(' ');
      var m;
      if ((m = /LIST BILL\b.*?\b([A-Z]{1,4}\s?\d{2,5})\s*$/i.exec(joined)) && !b.ref) { b.ref = m[1].replace(/\s+/g, ''); b.title = joined; }
      if (/BILLING DATE/i.test(joined)) { b.month = month(joined.replace(/BILLING DATE/i, '')); return; }
      if (head < 0) {
        var low = r.map(function (v) { return v.toLowerCase(); });
        var pi = low.findIndex(function (v) { return /policy/.test(v); }), ai = low.findIndex(function (v) { return /premium|amount/.test(v); });
        if (pi >= 0 && ai >= 0) {
          head = i; col = { policy: pi, amount: ai, name: low.findIndex(function (v) { return /name/.test(v); }), issue: low.findIndex(function (v) { return /issue/.test(v); }),
            type: low.findIndex(function (v) { return /record type|type|line/.test(v); }) };
          if (col.type < 0) col.type = 0;
        }
        return;
      }
      var label = '';
      for (var j = 0; j < Math.min(col.policy, col.name < 0 ? col.policy : col.name); j++) if (r[j]) { label = r[j]; break; }
      if (/^sub-?total/i.test(label)) { b.subtotals[kind || 'All'] = num(r[col.amount]); return; }
      if (/^total$/i.test(label)) { b.total = num(r[col.amount]); return; }
      if (/^termination/i.test(label)) { section = 'Terminations'; kind = 'Terminated'; return; }
      /* a record type starts a part of the list; any other label ("Regularized") is a heading inside it */
      if (label && !/^sub/i.test(label)) {
        section = label.replace(/\s*↑\s*/, '').trim();
        if (/pension/i.test(section)) kind = 'Pension'; else if (/life/i.test(section)) kind = 'Life'; else if (/health/i.test(section)) kind = 'Health';
      }
      var pol = String(r[col.policy] || '').replace(/\.0$/, '').trim();
      if (!pol || !/\d/.test(pol)) return;
      b.members.push({ id: pol, policy: pol, name: col.name >= 0 ? r[col.name] : '', issue: col.issue >= 0 ? (ymd(r[col.issue]) || r[col.issue]) : '', premium: num(r[col.amount]),
        section: section, line: kind || 'Other' });
    });
    var live = b.members.filter(function (x) { return x.line !== 'Terminated'; });
    var sum = round(live.reduce(function (s, x) { return s + x.premium; }, 0));
    if (!b.total) b.total = sum;
    else if (Math.abs(sum - b.total) > 0.05) b.warnings.push('The policies read add to ' + money(sum) + '; the list says ' + money(b.total) + '.');
    if (head < 0) b.warnings.push('No column headed "Policy" and "Premium" was found on the sheet.');
    b.due = b.total; b.count = live.length;
    return b;
  }

  /* ── one line's documents as one bill ────────────────────────────────────────────────────── */
  function combine(parts) {
    var out = {};
    var health = parts.filter(function (p) { return p.kind === 'health'; });
    if (health.length) out.health = health[health.length - 1];
    var lb = parts.filter(function (p) { return p.kind === 'lifeBill'; }), la = parts.filter(function (p) { return p.kind === 'lifeAdj'; }), ll = parts.filter(function (p) { return p.kind === 'lifeLetter'; });
    if (lb.length || la.length || ll.length) {
      var bill = lb[lb.length - 1] || null, adj = la[la.length - 1] || null, let_ = ll[ll.length - 1] || null;
      var life = { kind: 'life', line: 'life', group: (bill || adj || let_).group, ref: (bill || adj || let_).ref, month: (bill || adj || let_).month, dated: (let_ || bill || {}).dated || '',
        members: bill ? bill.members : [], totals: bill ? bill.totals : null, rates: bill ? bill.rates : null, offRate: bill ? bill.offRate || [] : [],
        gross: bill ? bill.total : adj ? adj.before : 0, adjustments: adj ? adj.adjustments : [], due: 0, reportDays: let_ ? let_.reportDays : null,
        has: { bill: !!bill, adj: !!adj, letter: !!let_ }, warnings: [] };
      [bill, adj, let_].forEach(function (p) { if (p) life.warnings = life.warnings.concat(p.warnings); });
      life.due = let_ && let_.due ? let_.due : adj && adj.after ? adj.after : life.gross;
      if (adj && bill && Math.abs(adj.before - bill.total) > 0.05) life.warnings.push('The statement starts from ' + money(adj.before) + ' but the member bill totals ' + money(bill.total) + '.');
      if (let_ && adj && let_.due && Math.abs(let_.due - adj.after) > 0.05) life.warnings.push('The letter asks for ' + money(let_.due) + ' but the statement comes to ' + money(adj.after) + '.');
      var months = [bill, adj, let_].filter(Boolean).map(function (p) { return p.month; }).filter(String);
      if (months.some(function (m) { return m !== months[0]; })) life.warnings.push('The life documents are for different months: ' + months.join(', ') + '.');
      if (life.ref && [bill, adj, let_].some(function (p) { return p && p.ref && key(p.ref) !== key(life.ref); })) life.warnings.push('The life documents carry different policy numbers.');
      life.count = life.members.length;
      out.life = life;
    }
    var ls = parts.filter(function (p) { return p.kind === 'listbill'; });
    if (ls.length) out.listbill = ls[ls.length - 1];
    return out;
  }

  /* ── names ───────────────────────────────────────────────────────────────────────────────── */
  var key = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  /* "SURNAME, FIRST MIDDLE", "SURNAME ; FIRST", "First Middle Surname" → { last: ['SURNAME'], first: ['FIRST', 'MIDDLE'] } */
  function nameParts(s) {
    s = String(s || '').toUpperCase().replace(/\(.*?\)/g, ' ').replace(/[^A-Z,;\- ']/g, ' ').trim();
    var m = /^(.+?)\s*[,;]\s*(.*)$/.exec(s);
    var words = function (x) { return x.split(/[\s']+/).filter(function (w) { return w.length > 0; }); };
    if (m) return { last: words(m[1].replace(/-/g, ' ')), first: words(m[2].replace(/-/g, ' ')) };
    var w = words(s.replace(/-/g, ' '));
    return { last: w.slice(-1), first: w.slice(0, -1), loose: w };
  }
  /* the same person: a first name in common (a cut-off one counts: "DEBR" for "DEBRA") and a surname in common, the
     surname read whole too ("QUAN KEP" and "QUANKEP"), or one surname inside the other ("RAMROOP MATLOO" and "MATLOO") */
  function samePerson(a, b) {
    var x = nameParts(a), y = nameParts(b);
    var all = function (p) { return (p.loose || p.last.concat(p.first)); };
    var firstOk = function (f1, f2) {
      return f1.some(function (u) { return f2.some(function (v) { return u === v || (u.length >= 3 && v.length >= 3 && (u.indexOf(v) === 0 || v.indexOf(u) === 0)); }); });
    };
    var lastOk = function (l1, l2) {
      var j1 = l1.join(''), j2 = l2.join('');
      if (j1 && j1 === j2) return true;
      return l1.some(function (u) { return u.length > 2 && (l2.indexOf(u) >= 0 || j2.indexOf(u) >= 0); }) || l2.some(function (v) { return v.length > 2 && j1.indexOf(v) >= 0; });
    };
    if (!x.loose && !y.loose) return firstOk(x.first, y.first) && lastOk(x.last, y.last);
    /* a name with no comma ("Avinash Deosaran Rampersad"): its last word is the surname; any first word may match */
    var xa = all(x), ya = all(y);
    var xl = x.loose ? x.last : x.last, yl = y.loose ? y.last : y.last;
    var xf = x.loose ? x.loose.slice(0, -1) : x.first, yf = y.loose ? y.loose.slice(0, -1) : y.first;
    return firstOk(xf, yf) && (lastOk(xl, yl) || lastOk(xl, ya) || lastOk(yl, xa));
  }
  function nice(s) {
    var p = nameParts(s);
    var w = (p.loose ? p.loose : p.first.concat(p.last)).map(function (x) { return x.charAt(0) + x.slice(1).toLowerCase(); });
    return w.join(' ');
  }
  function money(n, dp) {
    n = Number(n) || 0;
    var s = Math.abs(n).toFixed(dp === 0 ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '−' : '') + 'TT$' + s;
  }

  var api = { lines: lines, read: read, kindOf: kindOf, sheet: sheet, combine: combine, samePerson: samePerson, nameParts: nameParts, nice: nice,
    num: num, ymd: ymd, month: month, money: money, key: key };
  root.BillRead = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
