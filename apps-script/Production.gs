/**
 * ============================================================================
 * PRODUCTION REPORT — Ricky Rampersad Branch
 * ============================================================================
 * The SUBMITTED production report, in head office's exact format:
 *
 *   Hierachy | Apps -W | API - W | Apps -M | Api -M | Apps -Y | API
 *
 * Branch → Unit Manager → Agent, with a Total line, week / month / year
 * columns, and the same highlighting head office uses.
 *
 * ── WHO CAN SEE IT ──────────────────────────────────────────────────────────
 * VIEW and DOWNLOAD are restricted to Role = admin or manager on the Staff
 * tab. Everyone else gets nothing — not a blank table, not a partial view:
 * the server refuses the request, so agent production figures never travel
 * to a staff member's browser at all. Every view and every download is
 * written to the Activity trail with the person's name and a timestamp.
 *
 * ── THE SHEET ───────────────────────────────────────────────────────────────
 * Paste head office's figures into the "Production" tab. Columns:
 *
 *   Code | Level | Name | Reports To | Apps W | API W | Apps M | API M | Apps Y | API Y
 *
 *   Level is one of:  branch | unit | agent
 *   Reports To holds the Code of the parent (blank for a branch)
 *
 * Group rows (branch, unit) may be left blank — Rebuild totals adds them up
 * from the agents beneath, so you only ever key the agent lines.
 */

var PROD = {
  SHEET: 'Production',
  HEADERS: ['Code', 'Level', 'Name', 'Reports To',
            'Apps W', 'API W', 'Apps M', 'API M', 'Apps Y', 'API Y'],
  // a figure at or above this share of its column's best is marked standout
  STANDOUT: 0.55,
};

function prodSheet_() { return namedSheet_(PROD.SHEET, PROD.HEADERS); }

/** Own number parser, so this file works with or without Property.gs. */
function prodNum_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

/** Only admin / manager may see production. Anyone else is refused. */
function requireProduction_(key, me, pin) {
  var staff = requireStaff_(key, me, pin);
  if (!/admin|manager/i.test(String(staff.role || ''))) {
    logActivity_('', 'PRODUCTION', 'production-denied', staff.email,
                 'Role "' + staff.role + '" is not permitted to view production');
    throw new Error('Production figures are restricted to admins and the branch manager.');
  }
  return staff;
}

function prodRows_() {
  var sh = prodSheet_();
  if (sh.getLastRow() < 2) return [];
  var map = headerMap_(sh);
  function c(r, n) { var i = col_(map, n); return i < 0 ? '' : r[i]; }
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    .map(function (r) {
      return {
        code: String(c(r, 'code') || '').trim(),
        level: String(c(r, 'level') || 'agent').trim().toLowerCase(),
        name: String(c(r, 'name') || '').trim(),
        parent: String(c(r, 'reports to') || '').trim(),
        appsW: prodNum_(c(r, 'apps w')), apiW: prodNum_(c(r, 'api w')),
        appsM: prodNum_(c(r, 'apps m')), apiM: prodNum_(c(r, 'api m')),
        appsY: prodNum_(c(r, 'apps y')), apiY: prodNum_(c(r, 'api y')),
      };
    })
    .filter(function (r) { return r.code || r.name; });
}

/**
 * Rolls agent figures up into their unit and branch lines, so group rows
 * always agree with the agents beneath them. Safe to run any time.
 */
function rebuildProductionTotals() {
  var staff;
  try { staff = { email: Session.getEffectiveUser().getEmail() }; } catch (e) { staff = { email: 'menu' }; }
  var sh = prodSheet_();
  var rows = prodRows_();
  if (!rows.length) { SpreadsheetApp.getUi().alert('The Production tab is empty — paste head office\'s figures in first.'); return; }

  var byCode = {}, kids = {};
  rows.forEach(function (r) {
    byCode[r.code] = r;
    if (r.parent) (kids[r.parent] = kids[r.parent] || []).push(r);
  });
  var F = ['appsW', 'apiW', 'appsM', 'apiM', 'appsY', 'apiY'];
  function roll(code, seen) {
    var r = byCode[code];
    if (!r || seen[code]) return { appsW: 0, apiW: 0, appsM: 0, apiM: 0, appsY: 0, apiY: 0 };
    seen[code] = 1;
    var children = kids[code] || [];
    if (!children.length) {
      var own = {}; F.forEach(function (f) { own[f] = r[f]; });
      return own;
    }
    var sum = { appsW: 0, apiW: 0, appsM: 0, apiM: 0, appsY: 0, apiY: 0 };
    children.forEach(function (ch) {
      var s = roll(ch.code, seen);
      F.forEach(function (f) { sum[f] += s[f]; });
    });
    F.forEach(function (f) { r[f] = Math.round(sum[f] * 100) / 100; });
    return sum;
  }
  var seen = {};
  rows.filter(function (r) { return r.level === 'branch'; })
      .forEach(function (b) { roll(b.code, seen); });
  rows.filter(function (r) { return r.level === 'unit' && !seen[r.code]; })
      .forEach(function (u) { roll(u.code, {}); });

  var map = headerMap_(sh);
  var out = rows.map(function (r) {
    return [r.appsW || '', r.apiW || '', r.appsM || '', r.apiM || '', r.appsY || '', r.apiY || ''];
  });
  var cW = col_(map, 'apps w');
  if (cW >= 0 && out.length) sh.getRange(2, cW + 1, out.length, 6).setValues(out);
  logActivity_('', 'PRODUCTION', 'production-rebuilt', staff.email, rows.length + ' rows rolled up');
  SpreadsheetApp.getUi().alert('Totals rebuilt — every unit and branch line now adds up from the agents beneath it.');
}

/* ── WHERE THE FIGURES COME FROM ────────────────────────────────────────────
   The Production tab holds the branch's shape — code, level, name, who each
   agent reports to. The figures on it were only ever as fresh as the last
   paste, so the week column could be a week old and nobody would know.

   These read the numbers straight from Salesforce instead, on the branch's
   own Total API basis: CLIENT_PORTFOLIO__c on Production_Picked_up_Date__c
   plus Policy_Increases__c on Increase_Production_Picked_Up_Date__c
   (API_Increase__c — not the joint-split field). Apps are pickups counted;
   W / M / Y are Salesforce's own THIS_WEEK, THIS_MONTH and THIS_YEAR.

   The sheet still owns the hierarchy, so a new agent is added there once and
   the figures follow. If Salesforce is unreachable the report falls back to
   whatever is on the tab and says so rather than showing an empty week. */

/** first + last name, lowercased and stripped, so "Narissa (Agent) Mohammed"
    and "Narissa Mohammed" are recognised as one person. */
function prodKey_(name) {
  var w = String(name || '').replace(/\([^)]*\)/g, ' ')
    .toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  return w[0] + '|' + w[w.length - 1];
}

/** Total API picked up per agent for week, month and year. */
function productionSalesforce_() {
  if (typeof wbQ_ !== 'function') return null;   // WallBoard.gs not in this project
  var out = {};
  function put(name, field, apps, api) {
    var k = prodKey_(name);
    if (!k) return;
    if (!out[k]) out[k] = { name: name, appsW: 0, apiW: 0, appsM: 0, apiM: 0, appsY: 0, apiY: 0 };
    out[k][field.a] += apps || 0;
    out[k][field.v] += api || 0;
  }
  var periods = [
    { when: 'THIS_WEEK',  f: { a: 'appsW', v: 'apiW' } },
    { when: 'THIS_MONTH', f: { a: 'appsM', v: 'apiM' } },
    { when: 'THIS_YEAR',  f: { a: 'appsY', v: 'apiY' } }
  ];
  periods.forEach(function (p) {
    wbQ_('SELECT AGENT__r.Name a, COUNT(Id) n, SUM(Total_API__c) api FROM CLIENT_PORTFOLIO__c ' +
         'WHERE Production_Picked_up_Date__c = ' + p.when + ' GROUP BY AGENT__r.Name')
      .forEach(function (r) { put(r.a, p.f, r.n, r.api); });
    wbQ_('SELECT Policy_Increases__r.AGENT__r.Name a, COUNT(Id) n, SUM(API_Increase__c) api ' +
         'FROM Policy_Increases__c WHERE Increase_Production_Picked_Up_Date__c = ' + p.when +
         ' GROUP BY Policy_Increases__r.AGENT__r.Name')
      .forEach(function (r) { put(r.a, p.f, r.n, r.api); });
  });
  return out;
}

/** Rolls agents up through their units to the branch, in memory. */
function prodRollUp_(rows) {
  var byCode = {}, kids = {}, F = ['appsW', 'apiW', 'appsM', 'apiM', 'appsY', 'apiY'];
  rows.forEach(function (r) { byCode[r.code] = r; });
  rows.forEach(function (r) { if (r.parent) (kids[r.parent] = kids[r.parent] || []).push(r); });
  function roll(code, seen) {
    var r = byCode[code], zero = { appsW: 0, apiW: 0, appsM: 0, apiM: 0, appsY: 0, apiY: 0 };
    if (!r || seen[code]) return zero;
    seen[code] = 1;
    var children = kids[code] || [];
    if (!children.length) { var own = {}; F.forEach(function (f) { own[f] = r[f] || 0; }); return own; }
    var sum = { appsW: 0, apiW: 0, appsM: 0, apiM: 0, appsY: 0, apiY: 0 };
    children.forEach(function (ch) {
      var v = roll(ch.code, seen);
      F.forEach(function (f) { sum[f] += v[f]; });
    });
    F.forEach(function (f) { r[f] = Math.round(sum[f] * 100) / 100; });
    return sum;
  }
  var seen = {};
  rows.filter(function (r) { return r.level === 'branch'; }).forEach(function (b) { roll(b.code, seen); });
  rows.filter(function (r) { return r.level === 'unit' && !seen[r.code]; }).forEach(function (u) { roll(u.code, {}); });
  return rows;
}

/** Ordered tree: branch → its units → their agents, then the Total line. */
function productionData(key, me, pin) {
  var staff = requireProduction_(key, me, pin);
  var rows = prodRows_();

  /* Live figures win over whatever was last pasted. An agent Salesforce has
     nothing for is zeroed rather than left showing last week's number, and
     anyone Salesforce knows who is missing from the tab is named on the
     report — a silent drop would understate the branch. */
  var source = 'sheet', unmatched = [];
  try {
    var live = productionSalesforce_();
    if (live && Object.keys(live).length) {
      var seenKey = {};
      rows.forEach(function (r) {
        if (r.level !== 'agent') return;
        var k = prodKey_(r.name), v = live[k];
        seenKey[k] = 1;
        ['appsW', 'apiW', 'appsM', 'apiM', 'appsY', 'apiY'].forEach(function (f) {
          r[f] = v ? Math.round((v[f] || 0) * 100) / 100 : 0;
        });
      });
      Object.keys(live).forEach(function (k) {
        if (!seenKey[k] && live[k].apiY) unmatched.push(live[k].name);
      });
      prodRollUp_(rows);
      source = 'salesforce';
    }
  } catch (e) {
    source = 'sheet';   // Salesforce unreachable — the tab still reports
  }

  var byCode = {}, kids = {};
  rows.forEach(function (r) { byCode[r.code] = r; });
  rows.forEach(function (r) { if (r.parent) (kids[r.parent] = kids[r.parent] || []).push(r); });

  var out = [], seen = {};
  function push(r, depth) {
    if (!r || seen[r.code]) return;
    seen[r.code] = 1;
    out.push({ code: r.code, name: r.name, level: r.level, depth: depth,
               appsW: r.appsW, apiW: r.apiW, appsM: r.appsM, apiM: r.apiM,
               appsY: r.appsY, apiY: r.apiY });
    (kids[r.code] || []).forEach(function (ch) { push(ch, depth + 1); });
  }
  rows.filter(function (r) { return r.level === 'branch'; }).forEach(function (b) { push(b, 0); });
  rows.filter(function (r) { return !seen[r.code] && !r.parent; }).forEach(function (r) { push(r, 0); });
  rows.filter(function (r) { return !seen[r.code]; }).forEach(function (r) { push(r, 1); });

  var tot = { appsW: 0, apiW: 0, appsM: 0, apiM: 0, appsY: 0, apiY: 0 };
  rows.filter(function (r) { return r.level === 'branch'; }).forEach(function (b) {
    ['appsW', 'apiW', 'appsM', 'apiM', 'appsY', 'apiY'].forEach(function (f) { tot[f] += b[f]; });
  });

  // standout thresholds — the same "who is carrying the month" highlight
  var agents = out.filter(function (r) { return r.level === 'agent'; });
  function best(f) { return agents.reduce(function (m, r) { return Math.max(m, r[f]); }, 0); }
  var marks = {};
  ['appsW', 'apiW', 'appsM', 'apiM', 'appsY', 'apiY'].forEach(function (f) {
    marks[f] = best(f) * PROD.STANDOUT;
  });

  logActivity_('', 'PRODUCTION', 'production-viewed', staff.email, out.length + ' lines');
  return { ok: true, rows: out, total: tot, marks: marks, source: source,
           unmatched: unmatched, asOf: nowStamp_(), by: staff.name, role: staff.role };
}

/**
 * The download, in head office's exact format — not a CSV of it.
 *
 * The report is recognised by how it looks: the green SUBMITTED banner, the
 * branch and unit lines shaded above their agents, the standout figures in
 * gold and the green Total across the foot. A comma-separated file throws all
 * of that away and arrives as raw text, which is why this builds a real
 * workbook instead.
 *
 * SpreadsheetML keeps it to one string with no library to ship — Excel, Google
 * Sheets and Numbers all open it. Restricted exactly like the view, and logged.
 */
function productionWorkbook(key, me, pin) {
  var staff = requireProduction_(key, me, pin);
  var d = productionData(key, me, pin);

  function xe(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function cS(v, st) { return '<Cell ss:StyleID="' + st + '"><Data ss:Type="String">' + xe(v) + '</Data></Cell>'; }
  function cN(v, st) {
    return (v === '' || v === null || v === undefined || v === 0)
      ? '<Cell ss:StyleID="' + st + '"/>'
      : '<Cell ss:StyleID="' + st + '"><Data ss:Type="Number">' + v + '</Data></Cell>';
  }
  var rows = [];

  // The banner, merged the full width of the report.
  rows.push('<Row ss:Height="22"><Cell ss:StyleID="ban" ss:MergeAcross="6">' +
            '<Data ss:Type="String">SUBMITTED</Data></Cell></Row>');
  rows.push('<Row ss:Height="18">' +
    cS('Hierachy', 'hd') + cS('Apps -W', 'hdc') + cS('API - W', 'hdc') +
    cS('Apps -M', 'hdc') + cS('Api -M', 'hdc') + cS('Apps -Y', 'hdc') + cS('API', 'hdc') +
    '</Row>');

  var m = d.marks || {};
  d.rows.forEach(function (r) {
    // Branch, unit and agent each carry their own shading, so the hierarchy
    // reads down the page without anyone needing the indent explained.
    var band = r.level === 'branch' ? 'b' : r.level === 'unit' ? 'u' : 'a';
    var label = (r.level === 'agent' && r.code) ? r.code + ' - ' + r.name : (r.name || r.code);
    var indent = new Array((r.depth || 0) + 1).join('    ');
    // A standout figure is gold, the same rule the on-screen report uses.
    function st(field, base) {
      return (r.level === 'agent' && m[field] && r[field] >= m[field]) ? base + 'g' : base;
    }
    rows.push('<Row>' +
      cS(indent + label, band + 'n') +
      cN(r.appsW, st('appsW', band + 'c')) + cN(r.apiW, st('apiW', band + 'm')) +
      cN(r.appsM, st('appsM', band + 'c')) + cN(r.apiM, st('apiM', band + 'm')) +
      cN(r.appsY, st('appsY', band + 'c')) + cN(r.apiY, st('apiY', band + 'm')) +
      '</Row>');
  });

  var t = d.total;
  rows.push('<Row ss:Height="19">' +
    cS('Total', 'tn') + cN(t.appsW, 'tc') + cN(t.apiW, 'tm') +
    cN(t.appsM, 'tc') + cN(t.apiM, 'tm') +
    cN(t.appsY, 'tc') + cN(t.apiY, 'tm') + '</Row>');

  rows.push('<Row/>');
  rows.push('<Row><Cell ss:StyleID="foot" ss:MergeAcross="6"><Data ss:Type="String">' +
    xe('Downloaded ' + d.asOf + ' by ' + staff.name + ' (' + staff.email +
       ') — CONFIDENTIAL, branch management only · figures from ' +
       (d.source === 'salesforce'
         ? 'Salesforce, production picked up (Total API)'
         : 'the Production tab as last pasted') +
       (d.unmatched && d.unmatched.length
         ? ' · not on the Production tab: ' + d.unmatched.join(', ')
         : '')) + '</Data></Cell></Row>');

  var B = '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>' +
          '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>' +
          '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>' +
          '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/></Borders>';
  var MONEY = '<NumberFormat ss:Format="#,##0.00"/>';
  function sty(id, extra) { return '<Style ss:ID="' + id + '">' + B + extra + '</Style>'; }
  function fill(c) { return '<Interior ss:Color="' + c + '" ss:Pattern="Solid"/>'; }
  var RIGHT = '<Alignment ss:Horizontal="Right"/>', CENTRE = '<Alignment ss:Horizontal="Center"/>';

  var styles =
    // banner and column heads
    '<Style ss:ID="ban"><Font ss:Bold="1" ss:Size="13" ss:Color="#FFFFFF"/>' + fill('#375623') + CENTRE + '</Style>' +
    sty('hd', '<Font ss:Bold="1"/>' + fill('#C6E0B4')) +
    sty('hdc', '<Font ss:Bold="1"/>' + fill('#C6E0B4') + CENTRE) +
    // branch lines
    sty('bn', '<Font ss:Bold="1"/>' + fill('#F8CBAD')) +
    sty('bc', '<Font ss:Bold="1"/>' + fill('#F8CBAD') + RIGHT) +
    sty('bm', '<Font ss:Bold="1"/>' + fill('#F8CBAD') + RIGHT + MONEY) +
    sty('bcg', '<Font ss:Bold="1"/>' + fill('#FFD966') + RIGHT) +
    sty('bmg', '<Font ss:Bold="1"/>' + fill('#FFD966') + RIGHT + MONEY) +
    // unit lines
    sty('un', '<Font ss:Bold="1"/>' + fill('#FCE4D6')) +
    sty('uc', '<Font ss:Bold="1"/>' + fill('#FCE4D6') + RIGHT) +
    sty('um', '<Font ss:Bold="1"/>' + fill('#FCE4D6') + RIGHT + MONEY) +
    sty('ucg', '<Font ss:Bold="1"/>' + fill('#FFD966') + RIGHT) +
    sty('umg', '<Font ss:Bold="1"/>' + fill('#FFD966') + RIGHT + MONEY) +
    // agent lines
    sty('an', '') + sty('ac', RIGHT) + sty('am', RIGHT + MONEY) +
    sty('acg', fill('#FFD966') + RIGHT) + sty('amg', fill('#FFD966') + RIGHT + MONEY) +
    // total
    sty('tn', '<Font ss:Bold="1" ss:Color="#FFFFFF"/>' + fill('#375623')) +
    sty('tc', '<Font ss:Bold="1" ss:Color="#FFFFFF"/>' + fill('#375623') + RIGHT) +
    sty('tm', '<Font ss:Bold="1" ss:Color="#FFFFFF"/>' + fill('#375623') + RIGHT + MONEY) +
    '<Style ss:ID="foot"><Font ss:Italic="1" ss:Size="9" ss:Color="#808080"/></Style>';

  var xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<Styles>' + styles + '</Styles>' +
    '<Worksheet ss:Name="Submitted">' +
    // Freeze under the headers so the hierarchy stays readable when scrolled.
    '<Table ss:DefaultRowHeight="15">' +
    '<Column ss:Width="215"/><Column ss:Width="58"/><Column ss:Width="82"/>' +
    '<Column ss:Width="58"/><Column ss:Width="88"/><Column ss:Width="58"/><Column ss:Width="92"/>' +
    rows.join('') + '</Table>' +
    '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">' +
    '<FreezePanes/><FrozenNoSplit/><SplitHorizontal>2</SplitHorizontal>' +
    '<TopRowBottomPane>2</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>' +
    '</Worksheet></Workbook>';

  logActivity_('', 'PRODUCTION', 'production-downloaded', staff.email,
               d.rows.length + ' lines exported as Excel');
  return { ok: true, xml: xml,
           filename: 'Production-SUBMITTED-' + d.asOf.replace(/[^\w]/g, '-') + '.xls' };
}

function productionMenu_(ui) {
  return ui.createMenu('📈 Production')
    .addItem('Rebuild unit & branch totals', 'rebuildProductionTotals')
    .addItem('Who can see production?', 'showProductionAccess');
}

function showProductionAccess() {
  var allowed = staffList_().filter(function (s) { return /admin|manager/i.test(s.role); });
  SpreadsheetApp.getUi().alert(
    'Production figures are restricted.\n\n' +
    'These people can view and download them:\n\n' +
    (allowed.length
      ? allowed.map(function (s) { return '  • ' + s.name + ' (' + s.role + ') — ' + s.email; }).join('\n')
      : '  (nobody — set someone\'s Role to admin or manager on the Staff tab)') +
    '\n\nEveryone else is refused by the server, so the figures never reach their browser. ' +
    'Every view and download is recorded on the Activity tab.');
}
