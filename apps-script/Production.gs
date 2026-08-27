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

/** Ordered tree: branch → its units → their agents, then the Total line. */
function productionData(key, me, pin) {
  var staff = requireProduction_(key, me, pin);
  var rows = prodRows_();
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
  return { ok: true, rows: out, total: tot, marks: marks,
           asOf: nowStamp_(), by: staff.name, role: staff.role };
}

/**
 * The download, in head office's exact column order. Returned as CSV text —
 * the dashboard turns it into a file. Restricted like the view, and logged.
 */
function productionCsv(key, me, pin) {
  var staff = requireProduction_(key, me, pin);
  var d = productionData(key, me, pin);
  var lines = [];
  lines.push('SUBMITTED,,,,,,');
  lines.push('Hierachy,Apps -W,API - W,Apps -M,Api -M,Apps -Y,API');
  function q(s) {
    s = String(s === null || s === undefined ? '' : s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function money(v) { return v ? Number(v).toFixed(2) : ''; }
  function count(v) { return v ? String(v) : ''; }
  d.rows.forEach(function (r) {
    var indent = new Array(r.depth + 1).join('    ');
    var label = r.level === 'agent' && r.code ? r.code + ' - ' + r.name : r.name || r.code;
    lines.push([q(indent + label), count(r.appsW), money(r.apiW), count(r.appsM),
                money(r.apiM), count(r.appsY), money(r.apiY)].join(','));
  });
  var t = d.total;
  lines.push(['Total', count(t.appsW), money(t.apiW), count(t.appsM),
              money(t.apiM), count(t.appsY), money(t.apiY)].join(','));
  lines.push('');
  lines.push(q('Downloaded ' + d.asOf + ' by ' + staff.name + ' (' + staff.email + ') — CONFIDENTIAL, branch management only'));
  logActivity_('', 'PRODUCTION', 'production-downloaded', staff.email, d.rows.length + ' lines exported');
  return { ok: true, csv: lines.join('\n'),
           filename: 'Production-SUBMITTED-' + d.asOf.replace(/[^\w]/g, '-') + '.csv' };
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
