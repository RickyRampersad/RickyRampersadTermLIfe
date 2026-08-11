// ═════════════════════════════════════════════════════════════════════════════
//  RR BRANCH OS — one-file install
//
//  Fixes agent→manager routing AND installs the 5pm manager digest, in a single
//  paste plus one one-line edit.
//
//  ── INSTALL ────────────────────────────────────────────────────────────────
//  1. Apps Script ▸ "RR Branch FF System" ▸ Files ▸ + ▸ Script.
//     Name it  RRBranchOS  and paste this whole file in.
//
//  2. Make FOUR small edits to existing functions. In each case keep the
//     function name and replace only what is described.
//
//     (a) Code.gs — function ffLoadRoster_()  →  replace its ENTIRE body with:
//             return rrbRosterFromAccess_();
//
//
//  3. Deploy ▸ Manage deployments ▸ Edit (pencil) ▸ New version ▸ Deploy.
//     Keep the SAME deployment so the /exec URL does not change.
//
//  4. Run  rrbSetup()  once from the editor and read the log. It clears the
//     stale cache, installs the 5pm trigger, and prints a health check.
//
//  5. Publish the updated site (index.html) from the zip supplied alongside
//     this file. Order does not matter — the new page sends a token AND the
//     old parameters, so it works against either version of the server.
//
//  ffLookupDirectManager_ is left alone on purpose — see PART 1.
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
//  PART 1 — the roster comes from the Access tab
// ═════════════════════════════════════════════════════════════════════════════
//
// The old ffLoadRoster_ read a Salesforce export in a second workbook. Two tabs
// there match the roster header test, the wrong one is found first, and it has
// no "Agent #" column — so every row was filtered out and the roster loaded
// EMPTY. With no roster, ffLookupDirectManager_ could only use its hardcoded
// AGENT_TO_KEY map, and anyone missing from that map silently routed to the
// Branch Manager. That is how one agent's nine cases all landed on the wrong
// desk.
//
// Why ffLookupDirectManager_ is NOT edited: its existing order is
//     AGENT_TO_KEY  →  roster  →  default "ricky"
// Once the roster actually loads, step 2 catches everyone the hardcoded map
// misses. The map was checked against the Access tab for all 34 people and
// agrees on every one of the 32 it covers, so leaving it first changes nothing
// — and rrbAuditRouting() below will tell you the moment that stops being true.

function rrbRosterFromAccess_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('rrb_ff_roster');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var roster = {};
  var rows;
  try {
    rows = rrbAccessSheet_();
  } catch (err) {
    // Never throw: a dozen callers depend on this and a submission in flight
    // must not die because a tab was renamed. Fail loudly in the log instead.
    Logger.log('rrbRosterFromAccess_: cannot read the Access tab — %s', err && err.message);
    return {};
  }

  rows.forEach(function (p) {
    if (!p.active) return;
    var code = _str(p.code).toUpperCase().trim();
    if (!/^A\d{4,6}$/.test(code)) return;
    roster[code] = { name: p.name, email: p.email, unit: p.unit };
  });

  if (!Object.keys(roster).length) {
    Logger.log('rrbRosterFromAccess_: the Access tab produced no usable agents. ' +
               'Check the Agent Number and Active columns.');
  }

  try { cache.put('rrb_ff_roster', JSON.stringify(roster), 1800); } catch (e) {}
  return roster;
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 2 — an unmapped agent is never silent again
// ═════════════════════════════════════════════════════════════════════════════

function rrbNoteUnmapped_(code) {
  try {
    var props = PropertiesService.getScriptProperties();
    var seen = JSON.parse(props.getProperty('RRB_UNMAPPED') || '{}');
    seen[code] = { last: new Date().toISOString(), count: (seen[code] && seen[code].count || 0) + 1 };
    props.setProperty('RRB_UNMAPPED', JSON.stringify(seen));
  } catch (e) { /* bookkeeping must never break a submission */ }
}

/** Who has submitted without resolving to a manager. */
function rrbShowUnmapped() {
  var seen = {};
  try { seen = JSON.parse(PropertiesService.getScriptProperties().getProperty('RRB_UNMAPPED') || '{}'); } catch (e) {}
  var codes = Object.keys(seen);
  if (!codes.length) { Logger.log('No unmapped agents recorded.'); return {}; }
  codes.forEach(function (c) { Logger.log('%s — %s submission(s), last %s', c, seen[c].count, seen[c].last); });
  return seen;
}

function rrbClearUnmapped() {
  PropertiesService.getScriptProperties().deleteProperty('RRB_UNMAPPED');
  Logger.log('Unmapped list cleared.');
}

/**
 * Compares the hardcoded AGENT_TO_KEY map against the Access tab and reports
 * anyone the two disagree about. Run it after changing a Unit on the sheet —
 * the hardcoded map is checked first, so a disagreement means the sheet edit
 * will NOT take effect for that person.
 */
function rrbAuditRouting() {
  var NAME2KEY = { 'Ricky Rampersad': 'ricky', 'Kerwyn Ramroach': 'kerwyn',
                   'Akaash Kalladeen': 'akaash', 'Gary Sookdeo': 'gary' };
  var rows;
  try { rows = rrbAccessSheet_(); } catch (e) { Logger.log('Cannot read Access tab: %s', e.message); return; }

  var mismatches = 0, unresolved = 0, checked = 0;
  rows.forEach(function (p) {
    if (!p.active) return;
    var code = _str(p.code).toUpperCase().trim();
    if (!/^A\d{4,6}$/.test(code)) return;
    checked++;

    var wanted = NAME2KEY[_str(p.unit).trim()];
    if (!wanted) {
      Logger.log('UNRESOLVED  %s %-24s Unit="%s" is not one of the four manager names',
                 code, p.name, p.unit);
      unresolved++;
      return;
    }
    var actual = ffLookupDirectManager_(code);
    if (actual !== wanted) {
      Logger.log('MISMATCH    %s %-24s sheet says %-7s but routing gives %s',
                 code, p.name, wanted, actual);
      mismatches++;
    }
  });
  Logger.log('--- audit: %s active agents checked, %s mismatches, %s unresolved units ---',
             checked, mismatches, unresolved);
  if (mismatches) {
    Logger.log('A mismatch means AGENT_TO_KEY in Code.gs overrides the sheet for that ' +
               'person. Delete their line from AGENT_TO_KEY to let the Access tab win.');
  }
  return { checked: checked, mismatches: mismatches, unresolved: unresolved };
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 3 — the 5pm manager digest
// ═════════════════════════════════════════════════════════════════════════════
//
// Answers the two questions a branch manager actually has at 5pm: did the branch
// move today, and is anything stuck on me. Carries two measures the branch
// cannot see anywhere else — recommend-ratio (cover proposed against cover the
// fact find proved was needed) and recommended premium against the client's own
// disclosed monthly surplus, as a point-of-sale lapse predictor.

var RRB_MD_SLA_REVIEW_DAYS = 3;
var RRB_MD_QUIET_DAYS      = 14;
var RRB_MD_TOP_N           = 5;
var RRB_MD_BAND_FRAGILE    = 0.50;
var RRB_MD_BAND_OVER       = 0.80;

// "Rec n Premium" is read as MONTHLY, so it compares against "Cash Surplus
// (calc)", which is monthly. If your agents enter an annual figure there, set
// this true. Check one real case before trusting the affordability block.
var RRB_MD_PREM_IS_ANNUAL  = false;

// Status casing in the sheet is inconsistent ("Completed" vs "pending_review"),
// so everything is compared lowercased. Do not switch these to exact matches.
var RRB_MD_PENDING_STATES  = ['pending_review', 'pending', 'submitted'];
var RRB_MD_DONE_STATES     = ['approved', 'completed', 'signed'];

function rrbMdIsYes_(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined || v === '') return false;
  var s = String(v).trim().toLowerCase();
  if (!s || s === 'no' || s === 'n' || s === 'false' || s === '0' || s === '-') return false;
  return true;
}
function rrbMdDays_(from, to) { return (!from || !to) ? null : Math.floor((to - from) / 86400000); }
function rrbMdDayStr_(d) { return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''; }
function rrbMdIn_(list, s) { return list.indexOf(s) > -1; }
function rrbMdMoney_(n) {
  return '$' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function rrbMdMedian_(nums) {
  if (!nums.length) return 0;
  var s = nums.slice().sort(function (a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function rrbMdEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Reads ffRevised once via the schema map, so inserting a column cannot shift a metric. */
function rrbMdLoadRows_() {
  var sh = SpreadsheetApp.openById(FF_SHEET_ID).getSheetByName(FF_REVISED_TAB);
  if (!sh || sh.getLastRow() < 2) return [];

  var values  = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) { return _str(h); });
  var k2l     = _ffSchemaMaps().k2l;

  var missing = [];
  function idx(key) {
    var lbl = k2l[key];
    var i = lbl ? headers.indexOf(lbl) : -1;
    if (i < 0) missing.push(key);
    return i;
  }
  var I = {
    id: idx('submissionId'), status: idx('status'), subAt: idx('submittedAt'),
    sigAt: idx('advisorSigDate'), code: idx('agentCode'), agent: idx('advisorName'),
    email: idx('agentEmail'), client: idx('clientName'),
    need: idx('insuranceNeed_calc'), cover: idx('fi_packageTotal'),
    lines: idx('fi_packageLines'), surplus: idx('cashSurplus_calc'),
    rep: idx('repDetected'), uw: idx('fi_uwEvidence'), mgr: idx('mgrAgree')
  };
  var premCols = [];
  for (var n = 1; n <= 6; n++) { var pi = idx('rec' + n + 'Prem'); if (pi >= 0) premCols.push(pi); }
  if (missing.length) Logger.log('rrbMdLoadRows_: columns not found → %s', missing.join(', '));

  function val(row, i) { return i >= 0 ? row[i] : ''; }
  function toDate(v) {
    if (!v) return null;
    var d = (v instanceof Date) ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id = _str(val(row, I.id));
    if (!id) continue;
    var prem = 0;
    for (var p = 0; p < premCols.length; p++) prem += _moneyToNum(row[premCols[p]]);
    if (RRB_MD_PREM_IS_ANNUAL) prem = prem / 12;

    out.push({
      id: id,
      status: _str(val(row, I.status)).toLowerCase(),
      submitted: toDate(val(row, I.subAt)),
      signed: toDate(val(row, I.sigAt)),
      code: _str(val(row, I.code)).toUpperCase(),
      agent: _str(val(row, I.agent)),
      client: _str(val(row, I.client)),
      need: _moneyToNum(val(row, I.need)),
      cover: _moneyToNum(val(row, I.cover)),
      lines: _moneyToNum(val(row, I.lines)),
      surplus: _moneyToNum(val(row, I.surplus)),
      prem: prem,
      replacement: rrbMdIsYes_(val(row, I.rep)),
      uwEvidence: rrbMdIsYes_(val(row, I.uw)),
      reviewed: rrbMdIsYes_(val(row, I.mgr))
    });
  }
  return out;
}

function rrbMdMetrics_(rows, now) {
  now = now || new Date();
  var todayStr = rrbMdDayStr_(now);
  var dow = (now.getDay() + 6) % 7;
  var weekStart = new Date(now); weekStart.setDate(now.getDate() - dow); weekStart.setHours(0,0,0,0);
  var prevStart = new Date(weekStart); prevStart.setDate(weekStart.getDate() - 7);

  var m = {
    todayStr: todayStr, total: rows.length, submittedToday: 0, signedToday: 0,
    pending: [], late: [], replacements: [], overCommitted: [], uwEvidence: [],
    quiet: [], byAgent: {}, reviewAges: [], premUnknown: 0, reviewedCount: 0,
    week: { subs: 0, signed: 0, cover: 0 }, prevWeek: { subs: 0, signed: 0, cover: 0 }
  };

  rows.forEach(function (r) {
    if (rrbMdDayStr_(r.submitted) === todayStr) m.submittedToday++;
    if (rrbMdDayStr_(r.signed) === todayStr) m.signedToday++;
    if (r.reviewed) m.reviewedCount++;

    if (r.submitted) {
      if (r.submitted >= weekStart)      { m.week.subs++;     m.week.cover     += r.cover; }
      else if (r.submitted >= prevStart) { m.prevWeek.subs++; m.prevWeek.cover += r.cover; }
    }
    if (r.signed) {
      if (r.signed >= weekStart)      m.week.signed++;
      else if (r.signed >= prevStart) m.prevWeek.signed++;
    }

    var done = rrbMdIn_(RRB_MD_DONE_STATES, r.status) || !!r.signed;
    if (!done && rrbMdIn_(RRB_MD_PENDING_STATES, r.status) && r.submitted) {
      r._age = rrbMdDays_(r.submitted, now);
      m.pending.push(r);
      m.reviewAges.push(r._age);
      if (r._age >= RRB_MD_SLA_REVIEW_DAYS) m.late.push(r);
    }
    if (!done) {
      if (r.replacement) m.replacements.push(r);
      if (r.uwEvidence)  m.uwEvidence.push(r);
      if (r.prem > 0 && r.surplus > 0) {
        r._ratio = r.prem / r.surplus;
        if (r._ratio >= RRB_MD_BAND_FRAGILE) m.overCommitted.push(r);
      } else if (r.cover > 0 && r.prem <= 0) {
        m.premUnknown++;
      }
    }

    var key = r.code || r.agent;
    if (key) {
      var a = m.byAgent[key] || (m.byAgent[key] = {
        code: r.code, name: r.agent || key, subs: 0, need: 0, cover: 0, lines: 0, lastSub: null });
      a.subs++; a.need += r.need; a.cover += r.cover; a.lines += r.lines;
      if (r.submitted && (!a.lastSub || r.submitted > a.lastSub)) a.lastSub = r.submitted;
    }
  });

  m.pending.sort(function (a, b) { return b._age - a._age; });
  m.overCommitted.sort(function (a, b) { return b._ratio - a._ratio; });
  m.medianReviewDays = rrbMdMedian_(m.reviewAges);
  m.oldest = m.pending.length ? m.pending[0] : null;

  m.agents = Object.keys(m.byAgent).map(function (k) {
    var a = m.byAgent[k];
    a.ratio = a.need > 0 ? (a.cover / a.need) : null;
    a.linesPer = a.subs > 0 ? (a.lines / a.subs) : 0;
    a.silentDays = a.lastSub ? rrbMdDays_(a.lastSub, now) : null;
    return a;
  }).sort(function (x, y) {
    if (x.ratio === null) return 1;
    if (y.ratio === null) return -1;
    return x.ratio - y.ratio;
  });

  var active = null;
  try {
    active = rrbAccessSheet_().filter(function (p) { return p.active; })
      .map(function (p) { return { code: _str(p.code).toUpperCase(), name: p.name }; });
  } catch (e) { active = null; }

  if (active) {
    active.forEach(function (p) {
      var a = m.byAgent[p.code];
      var d = (a && a.lastSub) ? rrbMdDays_(a.lastSub, now) : null;
      if (d === null || d >= RRB_MD_QUIET_DAYS) m.quiet.push({ name: p.name, code: p.code, days: d });
    });
    m.quietSource = 'access tab';
  } else {
    m.agents.forEach(function (a) {
      if (a.silentDays !== null && a.silentDays >= RRB_MD_QUIET_DAYS) {
        m.quiet.push({ name: a.name, code: a.code, days: a.silentDays });
      }
    });
    m.quietSource = 'submissions only';
  }
  m.quiet.sort(function (a, b) {
    if (a.days === null) return -1;
    if (b.days === null) return 1;
    return b.days - a.days;
  });
  return m;
}

function rrbMdHtml_(m) {
  var F = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
  var card = 'background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 12px';
  var h3 = 'margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280';
  var big = 'font-size:26px;font-weight:700;color:#0f172a;line-height:1';
  var lbl = 'font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em';

  function tile(v, l) {
    return '<td style="padding:0 14px 0 0;vertical-align:top"><div style="' + big + '">' + v +
           '</div><div style="' + lbl + '">' + rrbMdEsc_(l) + '</div></td>';
  }
  function good(msg) { return '<div style="color:#059669;font-size:14px">' + rrbMdEsc_(msg) + '</div>'; }

  var h = '<div style="' + F + ';background:#f8fafc;padding:16px;max-width:680px">';
  h += '<div style="font-size:18px;font-weight:700;color:#0f172a">RR Branch — Fact Find Digest</div>';
  h += '<div style="color:#6b7280;font-size:13px;margin:0 0 16px">' + rrbMdEsc_(m.todayStr) + '</div>';

  h += '<div style="' + card + '"><div style="' + h3 + '">Today</div><table cellpadding="0" cellspacing="0"><tr>' +
       tile(m.submittedToday, 'submitted') + tile(m.signedToday, 'signed') +
       tile(m.pending.length, 'in review') + '</tr></table></div>';

  h += '<div style="' + card + '"><div style="' + h3 + '">On your desk</div>';
  if (!m.pending.length) {
    h += good('Nothing waiting. The queue is clear.');
  } else {
    h += '<table cellpadding="0" cellspacing="0" style="margin-bottom:10px"><tr>' +
         tile(m.pending.length, 'awaiting review') +
         tile(m.late.length, 'over ' + RRB_MD_SLA_REVIEW_DAYS + ' days') +
         tile(m.medianReviewDays + 'd', 'median wait') + '</tr></table>';
    h += '<table cellpadding="6" cellspacing="0" width="100%" style="font-size:13px;border-collapse:collapse">';
    m.pending.slice(0, RRB_MD_TOP_N).forEach(function (r) {
      h += '<tr style="border-top:1px solid #f1f5f9"><td>' + rrbMdEsc_(r.client || '(no name)') +
           '</td><td style="color:#6b7280">' + rrbMdEsc_(r.agent) +
           '</td><td align="right" style="font-weight:700;color:' +
           (r._age >= RRB_MD_SLA_REVIEW_DAYS ? '#b91c1c' : '#6b7280') + '">' + r._age + 'd</td></tr>';
    });
    h += '</table>';
    if (m.pending.length > RRB_MD_TOP_N) {
      h += '<div style="' + lbl + ';margin-top:8px">+ ' + (m.pending.length - RRB_MD_TOP_N) + ' more</div>';
    }
  }
  h += '</div>';

  h += '<div style="' + card + '"><div style="' + h3 + '">Needs a decision</div>';
  var flags = '';
  if (m.replacements.length) {
    flags += '<div style="margin-bottom:8px"><strong style="color:#b91c1c">' + m.replacements.length +
             ' replacement' + (m.replacements.length === 1 ? '' : 's') + ' detected</strong>' +
             '<div style="' + lbl + '">Existing cover being replaced — review before these move.</div></div>';
  }
  if (m.overCommitted.length) {
    var over = m.overCommitted.filter(function (r) { return r._ratio >= RRB_MD_BAND_OVER; });
    flags += '<div style="margin-bottom:8px"><strong style="color:#b45309">' + m.overCommitted.length +
             ' case' + (m.overCommitted.length === 1 ? '' : 's') + ' priced above comfort</strong>';
    if (over.length) flags += ' <span style="color:#b91c1c">(' + over.length + ' will not persist)</span>';
    flags += '<div style="' + lbl + '">Recommended premium vs the client\'s own monthly surplus.</div>';
    flags += '<table cellpadding="6" cellspacing="0" width="100%" style="font-size:13px;border-collapse:collapse;margin-top:6px">';
    m.overCommitted.slice(0, RRB_MD_TOP_N).forEach(function (r) {
      flags += '<tr style="border-top:1px solid #f1f5f9"><td>' + rrbMdEsc_(r.client || '(no name)') +
               '</td><td style="color:#6b7280">' + rrbMdEsc_(r.agent) +
               '</td><td align="right">' + rrbMdMoney_(r.prem) + ' / ' + rrbMdMoney_(r.surplus) +
               '</td><td align="right" style="font-weight:700;color:' +
               (r._ratio >= RRB_MD_BAND_OVER ? '#b91c1c' : '#b45309') + '">' +
               Math.round(r._ratio * 100) + '%</td></tr>';
    });
    flags += '</table>';
  }
  if (m.uwEvidence.length) {
    flags += '<div style="margin-bottom:8px"><strong>' + m.uwEvidence.length +
             ' awaiting medical evidence</strong><div style="' + lbl + '">Expect underwriting delay.</div></div>';
  }
  h += flags || good('No replacements, no affordability breaches, no evidence gaps.');
  h += '</div>';

  var coach = m.agents.filter(function (a) { return a.ratio !== null && a.subs >= 2; }).slice(0, RRB_MD_TOP_N);
  if (coach.length) {
    h += '<div style="' + card + '"><div style="' + h3 + '">Recommend-ratio — cover proposed vs cover needed</div>' +
         '<table cellpadding="6" cellspacing="0" width="100%" style="font-size:13px;border-collapse:collapse">';
    coach.forEach(function (a) {
      var pct = Math.round(a.ratio * 100);
      h += '<tr style="border-top:1px solid #f1f5f9"><td>' + rrbMdEsc_(a.name) +
           '</td><td align="right" style="color:#6b7280">' + a.subs + ' case' + (a.subs === 1 ? '' : 's') +
           '</td><td align="right" style="color:#6b7280">' + a.linesPer.toFixed(1) + ' lines</td>' +
           '<td align="right" style="font-weight:700;color:' +
           (pct < 40 ? '#b91c1c' : pct < 70 ? '#b45309' : '#059669') + '">' + pct + '%</td></tr>';
    });
    h += '</table><div style="' + lbl + ';margin-top:8px">Weakest first. Small samples — a prompt to look, not a verdict.</div></div>';
  }

  h += '<div style="' + card + '"><div style="' + h3 + '">Quiet — no fact find in ' + RRB_MD_QUIET_DAYS + '+ days</div>';
  if (!m.quiet.length) {
    h += good('Everyone has been active.');
  } else {
    h += '<div style="font-size:13px">' + m.quiet.slice(0, 8).map(function (q) {
      return rrbMdEsc_(q.name) + ' <span style="color:#6b7280">(' + (q.days === null ? 'none yet' : q.days + 'd') + ')</span>';
    }).join(' &middot; ') + '</div>';
    if (m.quiet.length > 8) h += '<div style="' + lbl + ';margin-top:6px">+ ' + (m.quiet.length - 8) + ' more</div>';
  }
  h += '</div>';

  function delta(a, b) {
    var d = a - b;
    return '<span style="color:' + (d > 0 ? '#059669' : d < 0 ? '#b91c1c' : '#6b7280') + '">' +
           (d > 0 ? '+' : '') + d + '</span>';
  }
  h += '<div style="' + card + '"><div style="' + h3 + '">This week vs last</div>' +
       '<table cellpadding="6" cellspacing="0" width="100%" style="font-size:13px;border-collapse:collapse">' +
       '<tr style="color:#6b7280"><td></td><td align="right">This</td><td align="right">Last</td><td align="right">&plusmn;</td></tr>' +
       '<tr style="border-top:1px solid #f1f5f9"><td>Submitted</td><td align="right">' + m.week.subs +
       '</td><td align="right">' + m.prevWeek.subs + '</td><td align="right">' + delta(m.week.subs, m.prevWeek.subs) + '</td></tr>' +
       '<tr style="border-top:1px solid #f1f5f9"><td>Signed</td><td align="right">' + m.week.signed +
       '</td><td align="right">' + m.prevWeek.signed + '</td><td align="right">' + delta(m.week.signed, m.prevWeek.signed) + '</td></tr>' +
       '<tr style="border-top:1px solid #f1f5f9"><td>Cover recommended</td><td align="right">' + rrbMdMoney_(m.week.cover) +
       '</td><td align="right">' + rrbMdMoney_(m.prevWeek.cover) + '</td><td align="right"></td></tr>' +
       '</table></div>';

  var notes = [];
  var reviewPct = m.total ? Math.round(100 * m.reviewedCount / m.total) : 0;
  notes.push('Manager review completed on ' + m.reviewedCount + ' of ' + m.total + ' cases (' + reviewPct + '%).');
  if (m.premUnknown) notes.push(m.premUnknown + ' open case(s) have recommended cover but no premium captured, so affordability could not be checked on them.');
  try {
    var un = JSON.parse(PropertiesService.getScriptProperties().getProperty('RRB_UNMAPPED') || '{}');
    var uc = Object.keys(un);
    if (uc.length) notes.push('Unmapped agent code(s) submitting: ' + uc.join(', ') + ' — add them to the Access tab with a Unit.');
  } catch (e) {}
  h += '<div style="' + lbl + ';line-height:1.6">' + notes.map(rrbMdEsc_).join('<br>') + '</div>';

  h += '</div>';
  return h;
}

/** Sends the digest to the branch manager. Safe to run by hand any time. */
function rrbSendManagerDigest() {
  var m = rrbMdMetrics_(rrbMdLoadRows_(), new Date());
  var bits = [];
  if (m.pending.length) bits.push(m.pending.length + ' in review');
  if (m.replacements.length) bits.push(m.replacements.length + ' replacement');
  if (m.overCommitted.length) bits.push(m.overCommitted.length + ' over-priced');
  var subject = 'RR Branch — ' + m.todayStr + ' — ' + m.submittedToday + ' in, ' +
                m.signedToday + ' signed' + (bits.length ? ' · ' + bits.join(', ') : '');
  MailApp.sendEmail({ to: MAIL_CONFIG.branchManager, subject: subject, htmlBody: rrbMdHtml_(m) });
  Logger.log('Manager digest sent to %s — %s', MAIL_CONFIG.branchManager, subject);
  return { ok: true, subject: subject, pending: m.pending.length };
}

/** Builds everything and logs the numbers. Sends nothing. */
function rrbMdPreview() {
  var m = rrbMdMetrics_(rrbMdLoadRows_(), new Date());
  Logger.log('submitted today      : %s', m.submittedToday);
  Logger.log('signed today         : %s', m.signedToday);
  Logger.log('awaiting review      : %s  (median %s days, %s over SLA)', m.pending.length, m.medianReviewDays, m.late.length);
  Logger.log('oldest waiting       : %s', m.oldest ? (m.oldest._age + 'd — ' + m.oldest.client) : 'none');
  Logger.log('replacements open    : %s', m.replacements.length);
  Logger.log('priced above comfort : %s', m.overCommitted.length);
  Logger.log('manager reviewed     : %s of %s', m.reviewedCount, m.total);
  Logger.log('quiet agents         : %s (%s)', m.quiet.length, m.quietSource);
  Logger.log('--- recommend-ratio, weakest first ---');
  m.agents.slice(0, 10).forEach(function (a) {
    Logger.log('  %-26s %s cases  ratio %s  lines/case %s', a.name, a.subs,
      a.ratio === null ? 'n/a' : Math.round(a.ratio * 100) + '%', a.linesPer.toFixed(1));
  });
  return m;
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 4 — run this once
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Clears the stale roster cache, installs the 5pm trigger, and prints a health
 * check. Safe to run again at any time.
 */
function rrbSetup() {
  Logger.log('=== RR Branch OS setup ===');

  // 1. The old code cached an EMPTY roster for 30 minutes. Until that is
  //    cleared the new code returns the same empty result and nothing looks
  //    fixed. This is the step everyone skips.
  try {
    CacheService.getScriptCache().remove('rrb_ff_roster');
    CacheService.getScriptCache().remove('rrb_unit_parent');
    Logger.log('1. roster + hierarchy caches cleared');
  }
  catch (e) { Logger.log('1. cache clear failed: %s', e.message); }

  // 2. Roster health
  var roster = ffLoadRoster_();
  var n = Object.keys(roster).length;
  Logger.log('2. roster loaded: %s agents %s', n, n > 4 ? '(OK)' : '*** STILL EMPTY — did you edit ffLoadRoster_ in Code.gs? ***');

  // 3. Routing spot-check
  Logger.log('3. routing check:');
  ['A14158', 'A13777', 'A10428', 'A12001'].forEach(function (c) {
    Logger.log('   %s -> %s', c, ffLookupDirectManager_(c));
  });
  Logger.log('   expected: A14158 akaash, A13777 gary, A10428 ricky, A12001 akaash');

  // 4. Digest trigger
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rrbSendManagerDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rrbSendManagerDigest').timeBased()
    .atHour(17).everyDays(1).inTimezone('America/Port_of_Spain').create();
  Logger.log('4. digest scheduled 17:00 daily (America/Port_of_Spain)');

  // 5. Reporting hierarchy, as read from the Access tab
  Logger.log('5. reporting hierarchy:');
  rrbShowHierarchy();

  // 6. Audit sheet vs hardcoded map
  Logger.log('6. routing audit:');
  rrbAuditRouting();

  Logger.log('=== done. Run rrbMdPreview() to see the digest numbers without emailing. ===');
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 6 — who reports to whom
// ═════════════════════════════════════════════════════════════════════════════
//
// The code used to treat "Assistant Branch Manager" as branch-wide, identical
// to the Branch Manager. That is not the structure: an ABM sees their own unit
// and the units beneath them, not the whole branch.
//
// Set the parent of each unit here. A manager sees their own unit plus every
// unit under them, to any depth. Ricky is the root and therefore sees all.
//
//   *** CONFIRM AKAASH ***  He is currently set to report to Ricky. If his unit
//   sits under Kerwyn instead, change 'ricky' to 'kerwyn' on that line and
//   nothing else needs touching.

// The Unit column on the Access tab already means "who I report to". For an
// agent it names their manager. Applying the SAME meaning to a manager's own
// row gives the whole reporting tree from the sheet, with no new column and no
// code change when someone is hired or moved:
//
//   Ricky   Branch Manager             Unit = Ricky Rampersad    (self = root)
//   Kerwyn  Assistant Branch Manager   Unit = Ricky Rampersad    (reports to Ricky)
//   Gary    Unit Manager               Unit = Kerwyn Ramroach    (reports to Kerwyn)
//   Akaash  Unit Manager               Unit = Ricky Rampersad    (reports to Ricky)
//   agents  Agent                      Unit = their manager
//
// A manager whose Unit names themselves is a root and sees only their own unit
// and whatever sits beneath them. Change a manager's Unit on the sheet and the
// hierarchy changes on the next cache expiry — nothing here needs editing.

// Used only when the sheet cannot be read or describes no managers at all.
var RRB_UNIT_PARENT_FALLBACK = {
  ricky:  null,
  kerwyn: 'ricky',
  gary:   'kerwyn',
  akaash: 'ricky'
};

/**
 * Builds {unitKey: parentUnitKey|null} from the Access tab. Cached for 30
 * minutes alongside the roster; rrbSetup() clears both.
 */
function rrbUnitParent_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('rrb_unit_parent');
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }

  var tree = {};
  try {
    rrbAccessSheet_().forEach(function (p) {
      if (!p.active) return;
      if (!/manager/i.test(_str(p.role))) return;          // only managers form the tree
      var mine = rrbUnitKeyForName_(p.name);
      if (!mine) return;
      var parent = rrbUnitKeyForName_(p.unit);
      tree[mine] = (!parent || parent === mine) ? null : parent;
    });
  } catch (err) {
    Logger.log('rrbUnitParent_: cannot read the Access tab (%s) — using the built-in default.',
               err && err.message);
    return RRB_UNIT_PARENT_FALLBACK;
  }

  if (!Object.keys(tree).length) {
    Logger.log('rrbUnitParent_: no manager rows found on the Access tab — using the built-in default. ' +
               'Check the Role column says "Manager" for your managers.');
    return RRB_UNIT_PARENT_FALLBACK;
  }

  // A cycle (two managers pointing at each other) would hang rrbUnitsUnder_.
  // Break it by rooting anyone whose chain does not terminate.
  Object.keys(tree).forEach(function (k) {
    var seen = {}, cur = k;
    while (cur && tree[cur]) {
      if (seen[cur]) {
        Logger.log('rrbUnitParent_: reporting loop involving "%s" — rooting it. ' +
                   'Two managers list each other in the Unit column.', k);
        tree[k] = null;
        return;
      }
      seen[cur] = 1; cur = tree[cur];
    }
  });

  try { cache.put('rrb_unit_parent', JSON.stringify(tree), 1800); } catch (e) {}
  return tree;
}

/** A unit key plus every unit beneath it, to any depth. */
function rrbUnitsUnder_(key) {
  var parent = rrbUnitParent_();
  var out = [key];
  var grew = true;
  while (grew) {
    grew = false;
    for (var k in parent) {
      if (out.indexOf(k) < 0 && out.indexOf(parent[k]) > -1) { out.push(k); grew = true; }
    }
  }
  return out;
}

/**
 * The scope a person gets. Only the root sees {kind:'branch'}; every other
 * manager gets {kind:'units', unitKeys:[...]} covering themselves and anyone
 * beneath them. Agents see only their own cases.
 */
function rrbScopeForRole_(role, unitKey, code) {
  role = String(role || '');
  if (/branch manager/i.test(role) && !/assistant/i.test(role)) return { kind: 'branch' };
  if (/manager/i.test(role)) {
    // Branch-wide comes from the ROLE above, never from the tree. That keeps
    // the Branch Manager correct even while every manager still points at
    // themselves on the sheet — which is how it stands today.
    var parent = rrbUnitParent_();
    var key = unitKey || '';
    if (!key || !(key in parent)) return { kind: 'unit', unitKey: key };
    return { kind: 'units', unitKeys: rrbUnitsUnder_(key) };
  }
  return { kind: 'agent', code: code || '' };
}

/** Does this scope include a given unit? Understands every scope shape. */
function rrbScopeHasUnit_(scope, unitKey) {
  if (!scope) return false;
  if (scope.kind === 'branch') return true;
  if (scope.kind === 'units')  return (scope.unitKeys || []).indexOf(unitKey) > -1;
  if (scope.kind === 'unit')   return unitKey === scope.unitKey;
  return false;
}

/** Prints the resulting visibility for each manager. Run after changing the map. */
function rrbShowHierarchy() {
  var PARENT = rrbUnitParent_();
  Logger.log('=== unit hierarchy (from the Access tab) ===');
  for (var k in PARENT) {
    var parent = PARENT[k] || '(root)';
    var role = (k === 'ricky') ? 'Branch Manager'
             : (k === 'kerwyn') ? 'Assistant Branch Manager' : 'Unit Manager';
    var sc = rrbScopeForRole_(role, k, '');
    var sees = sc.kind === 'branch' ? 'the whole branch'
             : sc.kind === 'units'  ? sc.unitKeys.join(' + ')
                                    : sc.unitKey;
    Logger.log('  %-8s reports to %-8s role=%-26s sees: %s', k, parent, role, sees);
  }
}
