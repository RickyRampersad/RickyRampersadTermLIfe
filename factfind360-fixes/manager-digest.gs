// ═════════════════════════════════════════════════════════════════════════════
//  RR BRANCH — MANAGER DIGEST  (v2)
//
//  Paste this whole file into the "RR Branch FF System" Apps Script project as
//  a NEW file (Files ▸ + ▸ Script, name it "ManagerDigest"). It does not modify
//  or replace sendDailyFactFindDigest() — both can run side by side until you
//  decide which one the managers actually open.
//
//  To try it without emailing anyone:   run  rrbMdPreview()   and read the log.
//  To send yourself one now:            run  rrbSendManagerDigest()
//  To schedule it for 5pm daily:        run  rrbMdInstallTrigger()   (once)
//
//  Answers the two questions a branch manager actually has at 5pm:
//    "did the branch move today"  and  "is anything stuck on me".
// ═════════════════════════════════════════════════════════════════════════════

// ── Tunables ────────────────────────────────────────────────────────────────
var RRB_MD_SLA_REVIEW_DAYS = 3;    // days in pending_review before it is late
var RRB_MD_QUIET_DAYS      = 14;   // silence before an agent is "quiet"
var RRB_MD_TOP_N           = 5;    // rows per list, keeps it phone-sized

// Affordability bands: recommended monthly premium ÷ client monthly surplus.
var RRB_MD_BAND_FRAGILE    = 0.50; // 50–80% — fragile
var RRB_MD_BAND_OVER       = 0.80; // over 80% — will not persist

// IMPORTANT ASSUMPTION. "Rec n Premium" is read as a MONTHLY figure, so it can
// be compared against "Cash Surplus (calc)", which is monthly. If your agents
// actually enter an annual premium there, set this to true and the comparison
// converts. Check one real case before trusting the affordability block.
var RRB_MD_PREM_IS_ANNUAL  = false;

// Only these count as "still waiting on a manager". Status casing in the sheet
// is inconsistent ("Completed" vs "pending_review"), so everything is compared
// lowercased — do not switch these to exact matches.
var RRB_MD_PENDING_STATES  = ['pending_review', 'pending', 'submitted'];
var RRB_MD_DONE_STATES     = ['approved', 'completed', 'signed'];


// ── Load ────────────────────────────────────────────────────────────────────
/**
 * Reads ffRevised once and returns plain row objects with only the fields the
 * digest needs. Uses the schema map rather than fixed column positions, so
 * inserting a column in the sheet cannot silently shift a metric.
 */
function rrbMdLoadRows_() {
  var sh = SpreadsheetApp.openById(FF_SHEET_ID).getSheetByName(FF_REVISED_TAB);
  if (!sh || sh.getLastRow() < 2) return [];

  var values  = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) { return _str(h); });
  var k2l     = _ffSchemaMaps().k2l;

  var missing = [];
  function idx(key) {
    var lbl = k2l[key];
    var i   = lbl ? headers.indexOf(lbl) : -1;
    if (i < 0) missing.push(key);
    return i;
  }

  var I = {
    id: idx('submissionId'), status: idx('status'), subAt: idx('submittedAt'),
    sigAt: idx('advisorSigDate'), code: idx('agentCode'), agent: idx('advisorName'),
    email: idx('agentEmail'), client: idx('clientName'),
    need: idx('insuranceNeed_calc'), cover: idx('fi_packageTotal'),
    lines: idx('fi_packageLines'), surplus: idx('cashSurplus_calc'),
    rep: idx('repDetected'), uw: idx('fi_uwEvidence'),
    naq: idx('naqScore'), lapse: idx('lapseRisk'), plan: idx('rec1Rec')
  };
  var premCols = [];
  for (var n = 1; n <= 6; n++) {
    var pi = idx('rec' + n + 'Prem');
    if (pi >= 0) premCols.push(pi);
  }
  if (missing.length) {
    Logger.log('rrbMdLoadRows_: columns not found in ffRevised → ' + missing.join(', ') +
               '  (those metrics will read as empty)');
  }

  function val(row, i) { return i >= 0 ? row[i] : ''; }
  function toDate(v) {
    if (!v) return null;
    var d = (v instanceof Date) ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id  = _str(val(row, I.id));
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
      email: _str(val(row, I.email)).toLowerCase(),
      client: _str(val(row, I.client)),
      need: _moneyToNum(val(row, I.need)),      // cover needed
      cover: _moneyToNum(val(row, I.cover)),    // cover recommended
      lines: _moneyToNum(val(row, I.lines)),
      surplus: _moneyToNum(val(row, I.surplus)),// monthly
      prem: prem,                               // monthly
      replacement: rrbMdIsYes_(val(row, I.rep)),
      uwEvidence: rrbMdIsYes_(val(row, I.uw)),
      naq: _moneyToNum(val(row, I.naq)),
      lapse: _str(val(row, I.lapse)),
      plan: _str(val(row, I.plan))
    });
  }
  return out;
}

/** Tolerant truthiness — the sheet carries Yes/No, TRUE/FALSE, Y/N and 1/0. */
function rrbMdIsYes_(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined || v === '') return false;
  var s = String(v).trim().toLowerCase();
  if (!s || s === 'no' || s === 'n' || s === 'false' || s === '0' || s === '-') return false;
  return true;
}

function rrbMdDays_(from, to) {
  if (!from || !to) return null;
  return Math.floor((to - from) / 86400000);
}
function rrbMdDayStr_(d) {
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}
function rrbMdIn_(list, s) { return list.indexOf(s) > -1; }
function rrbMdMoney_(n) {
  n = Math.round(n || 0);
  return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function rrbMdMedian_(nums) {
  if (!nums.length) return 0;
  var s = nums.slice().sort(function (a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function rrbMdEsc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ── Metrics ─────────────────────────────────────────────────────────────────
function rrbMdMetrics_(rows, now) {
  now = now || new Date();
  var todayStr = rrbMdDayStr_(now);

  // Monday of this week, and the Monday before it.
  var dow = (now.getDay() + 6) % 7;                       // 0 = Monday
  var weekStart = new Date(now); weekStart.setDate(now.getDate() - dow); weekStart.setHours(0,0,0,0);
  var prevStart = new Date(weekStart); prevStart.setDate(weekStart.getDate() - 7);

  var m = {
    todayStr: todayStr, total: rows.length,
    submittedToday: 0, signedToday: 0,
    pending: [], late: [], replacements: [], overCommitted: [], uwEvidence: [],
    quiet: [], byAgent: {},
    week: { subs: 0, signed: 0, cover: 0 },
    prevWeek: { subs: 0, signed: 0, cover: 0 },
    reviewAges: [], oldest: null, premUnknown: 0
  };

  rows.forEach(function (r) {
    var subStr = rrbMdDayStr_(r.submitted);
    var sigStr = rrbMdDayStr_(r.signed);
    if (subStr === todayStr) m.submittedToday++;
    if (sigStr === todayStr) m.signedToday++;

    if (r.submitted) {
      if (r.submitted >= weekStart)      { m.week.subs++;     m.week.cover     += r.cover; }
      else if (r.submitted >= prevStart) { m.prevWeek.subs++; m.prevWeek.cover += r.cover; }
    }
    if (r.signed) {
      if (r.signed >= weekStart)      m.week.signed++;
      else if (r.signed >= prevStart) m.prevWeek.signed++;
    }

    // Still waiting on a manager.
    var done = rrbMdIn_(RRB_MD_DONE_STATES, r.status) || !!r.signed;
    if (!done && rrbMdIn_(RRB_MD_PENDING_STATES, r.status) && r.submitted) {
      var age = rrbMdDays_(r.submitted, now);
      r._age = age;
      m.pending.push(r);
      m.reviewAges.push(age);
      if (age >= RRB_MD_SLA_REVIEW_DAYS) m.late.push(r);
      if (!m.oldest || age > m.oldest._age) m.oldest = r;
    }

    // Red flags, scoped to cases not yet closed out.
    if (!done) {
      if (r.replacement) m.replacements.push(r);
      if (r.uwEvidence)  m.uwEvidence.push(r);
      if (r.prem > 0) {
        if (r.surplus > 0) {
          r._ratio = r.prem / r.surplus;
          if (r._ratio >= RRB_MD_BAND_FRAGILE) m.overCommitted.push(r);
        }
      } else if (r.cover > 0) {
        m.premUnknown++;   // recommended cover but no premium captured
      }
    }

    // Per-agent rollup.
    var key = r.code || r.email || r.agent;
    if (key) {
      var a = m.byAgent[key] || (m.byAgent[key] = {
        code: r.code, name: r.agent || r.email, subs: 0,
        need: 0, cover: 0, lines: 0, lastSub: null
      });
      a.subs++; a.need += r.need; a.cover += r.cover; a.lines += r.lines;
      if (r.submitted && (!a.lastSub || r.submitted > a.lastSub)) a.lastSub = r.submitted;
    }
  });

  m.pending.sort(function (a, b) { return b._age - a._age; });
  m.overCommitted.sort(function (a, b) { return b._ratio - a._ratio; });
  m.medianReviewDays = rrbMdMedian_(m.reviewAges);

  // Recommend-ratio: cover recommended ÷ cover needed. Both are cover figures,
  // so this is a like-for-like ratio, not premium over sum assured.
  m.agents = Object.keys(m.byAgent).map(function (k) {
    var a = m.byAgent[k];
    a.ratio = a.need > 0 ? (a.cover / a.need) : null;
    a.linesPer = a.subs > 0 ? (a.lines / a.subs) : 0;
    a.silentDays = a.lastSub ? rrbMdDays_(a.lastSub, now) : null;
    return a;
  }).sort(function (x, y) {
    if (x.ratio === null) return 1;
    if (y.ratio === null) return -1;
    return x.ratio - y.ratio;               // weakest first — that is the coaching list
  });

  // Quiet agents. Prefer the branch Access tab so people with no submissions at
  // all still appear; fall back to whoever shows up in the data.
  var active = null;
  try {
    active = rrbAccessSheet_().filter(function (p) { return p.active; })
      .map(function (p) { return { code: _str(p.code).toUpperCase(), name: p.name }; });
  } catch (e) { active = null; }

  if (active) {
    active.forEach(function (p) {
      var a = m.byAgent[p.code];
      var d = (a && a.lastSub) ? rrbMdDays_(a.lastSub, now) : null;
      if (d === null || d >= RRB_MD_QUIET_DAYS) {
        m.quiet.push({ name: p.name, code: p.code, days: d });
      }
    });
    m.quietSource = 'access tab';
  } else {
    m.agents.forEach(function (a) {
      if (a.silentDays !== null && a.silentDays >= RRB_MD_QUIET_DAYS) {
        m.quiet.push({ name: a.name, code: a.code, days: a.silentDays });
      }
    });
    m.quietSource = 'submissions only — agents with none ever cannot appear';
  }
  m.quiet.sort(function (a, b) {
    if (a.days === null) return -1;
    if (b.days === null) return 1;
    return b.days - a.days;
  });

  return m;
}


// ── Email ───────────────────────────────────────────────────────────────────
function rrbMdHtml_(m) {
  var F = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
  var card = 'background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 12px';
  var h3   = 'margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280';
  var big  = 'font-size:26px;font-weight:700;color:#0f172a;line-height:1';
  var lbl  = 'font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em';

  function tile(v, l) {
    return '<td style="padding:0 14px 0 0;vertical-align:top">' +
           '<div style="' + big + '">' + v + '</div>' +
           '<div style="' + lbl + '">' + rrbMdEsc_(l) + '</div></td>';
  }
  function row(cells) { return '<tr>' + cells + '</tr>'; }
  function empty(msg) { return '<div style="color:#059669;font-size:14px">' + rrbMdEsc_(msg) + '</div>'; }

  var h = '<div style="' + F + ';background:#f8fafc;padding:16px;max-width:680px">';
  h += '<div style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 2px">RR Branch — Fact Find Digest</div>';
  h += '<div style="color:#6b7280;font-size:13px;margin:0 0 16px">' + rrbMdEsc_(m.todayStr) + '</div>';

  // 1. Today
  h += '<div style="' + card + '"><div style="' + h3 + '">Today</div><table cellpadding="0" cellspacing="0">' +
       row(tile(m.submittedToday, 'submitted') + tile(m.signedToday, 'signed') +
           tile(m.pending.length, 'in review')) + '</table></div>';

  // 2. On your desk
  h += '<div style="' + card + '"><div style="' + h3 + '">On your desk</div>';
  if (!m.pending.length) {
    h += empty('Nothing waiting. The queue is clear.');
  } else {
    h += '<table cellpadding="0" cellspacing="0" style="margin-bottom:10px">' +
         row(tile(m.pending.length, 'awaiting review') +
             tile(m.late.length, 'over ' + RRB_MD_SLA_REVIEW_DAYS + ' days') +
             tile(m.medianReviewDays + 'd', 'median wait')) + '</table>';
    h += '<table cellpadding="6" cellspacing="0" width="100%" style="font-size:13px;border-collapse:collapse">';
    m.pending.slice(0, RRB_MD_TOP_N).forEach(function (r) {
      var lateFlag = r._age >= RRB_MD_SLA_REVIEW_DAYS;
      h += '<tr style="border-top:1px solid #f1f5f9">' +
           '<td style="color:#0f172a">' + rrbMdEsc_(r.client || '(no name)') + '</td>' +
           '<td style="color:#6b7280">' + rrbMdEsc_(r.agent) + '</td>' +
           '<td align="right" style="font-weight:700;color:' + (lateFlag ? '#b91c1c' : '#6b7280') + '">' +
           r._age + 'd</td></tr>';
    });
    h += '</table>';
    if (m.pending.length > RRB_MD_TOP_N) {
      h += '<div style="' + lbl + ';margin-top:8px">+ ' + (m.pending.length - RRB_MD_TOP_N) + ' more</div>';
    }
  }
  h += '</div>';

  // 3. Red flags
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
      flags += '<tr style="border-top:1px solid #f1f5f9">' +
               '<td>' + rrbMdEsc_(r.client || '(no name)') + '</td>' +
               '<td style="color:#6b7280">' + rrbMdEsc_(r.agent) + '</td>' +
               '<td align="right">' + rrbMdMoney_(r.prem) + ' / ' + rrbMdMoney_(r.surplus) + '</td>' +
               '<td align="right" style="font-weight:700;color:' +
               (r._ratio >= RRB_MD_BAND_OVER ? '#b91c1c' : '#b45309') + '">' +
               Math.round(r._ratio * 100) + '%</td></tr>';
    });
    flags += '</table>';
  }
  if (m.uwEvidence.length) {
    flags += '<div style="margin-bottom:8px"><strong>' + m.uwEvidence.length +
             ' awaiting medical evidence</strong>' +
             '<div style="' + lbl + '">Expect underwriting delay — chase early.</div></div>';
  }
  h += flags || empty('No replacements, no affordability breaches, no evidence gaps.');
  h += '</div>';

  // 4. Coaching — weakest recommend-ratio
  var coach = m.agents.filter(function (a) { return a.ratio !== null && a.subs >= 2; }).slice(0, RRB_MD_TOP_N);
  if (coach.length) {
    h += '<div style="' + card + '"><div style="' + h3 + '">Recommend-ratio — cover proposed vs cover needed</div>';
    h += '<table cellpadding="6" cellspacing="0" width="100%" style="font-size:13px;border-collapse:collapse">';
    coach.forEach(function (a) {
      var pct = Math.round(a.ratio * 100);
      h += '<tr style="border-top:1px solid #f1f5f9">' +
           '<td>' + rrbMdEsc_(a.name) + '</td>' +
           '<td align="right" style="color:#6b7280">' + a.subs + ' case' + (a.subs === 1 ? '' : 's') + '</td>' +
           '<td align="right" style="color:#6b7280">' + a.linesPer.toFixed(1) + ' lines</td>' +
           '<td align="right" style="font-weight:700;color:' + (pct < 40 ? '#b91c1c' : pct < 70 ? '#b45309' : '#059669') + '">' +
           pct + '%</td></tr>';
    });
    h += '</table><div style="' + lbl + ';margin-top:8px">Weakest first. Small samples — treat as a prompt to look, not a verdict.</div></div>';
  }

  // 5. Quiet agents + week comparison
  h += '<div style="' + card + '"><div style="' + h3 + '">Quiet — no fact find in ' + RRB_MD_QUIET_DAYS + '+ days</div>';
  if (!m.quiet.length) {
    h += empty('Everyone has been active.');
  } else {
    h += '<div style="font-size:13px;color:#0f172a">' + m.quiet.slice(0, 8).map(function (q) {
      return rrbMdEsc_(q.name) + ' <span style="color:#6b7280">(' +
             (q.days === null ? 'none yet' : q.days + 'd') + ')</span>';
    }).join(' &middot; ') + '</div>';
    if (m.quiet.length > 8) h += '<div style="' + lbl + ';margin-top:6px">+ ' + (m.quiet.length - 8) + ' more</div>';
  }
  h += '</div>';

  function delta(a, b) {
    var d = a - b;
    var c = d > 0 ? '#059669' : d < 0 ? '#b91c1c' : '#6b7280';
    return '<span style="color:' + c + '">' + (d > 0 ? '+' : '') + d + '</span>';
  }
  h += '<div style="' + card + '"><div style="' + h3 + '">This week vs last</div>' +
       '<table cellpadding="6" cellspacing="0" width="100%" style="font-size:13px;border-collapse:collapse">' +
       '<tr style="color:#6b7280"><td></td><td align="right">This</td><td align="right">Last</td><td align="right">±</td></tr>' +
       '<tr style="border-top:1px solid #f1f5f9"><td>Submitted</td><td align="right">' + m.week.subs +
         '</td><td align="right">' + m.prevWeek.subs + '</td><td align="right">' + delta(m.week.subs, m.prevWeek.subs) + '</td></tr>' +
       '<tr style="border-top:1px solid #f1f5f9"><td>Signed</td><td align="right">' + m.week.signed +
         '</td><td align="right">' + m.prevWeek.signed + '</td><td align="right">' + delta(m.week.signed, m.prevWeek.signed) + '</td></tr>' +
       '<tr style="border-top:1px solid #f1f5f9"><td>Cover recommended</td><td align="right">' + rrbMdMoney_(m.week.cover) +
         '</td><td align="right">' + rrbMdMoney_(m.prevWeek.cover) + '</td><td align="right"></td></tr>' +
       '</table></div>';

  var notes = [];
  if (m.premUnknown) notes.push(m.premUnknown + ' open case(s) have recommended cover but no premium captured, so affordability could not be checked on them.');
  if (m.quietSource && m.quietSource.indexOf('submissions') === 0) notes.push('Quiet list built from submissions only — agents who have never submitted cannot appear.');
  if (notes.length) {
    h += '<div style="' + lbl + ';line-height:1.6">' + notes.map(rrbMdEsc_).join('<br>') + '</div>';
  }

  h += '</div>';
  return h;
}


// ── Entry points ────────────────────────────────────────────────────────────
/** Sends the digest to the branch manager. Safe to run by hand any time. */
function rrbSendManagerDigest() {
  var rows = rrbMdLoadRows_();
  var m    = rrbMdMetrics_(rows, new Date());

  var bits = [];
  if (m.pending.length)      bits.push(m.pending.length + ' in review');
  if (m.replacements.length) bits.push(m.replacements.length + ' replacement');
  if (m.overCommitted.length) bits.push(m.overCommitted.length + ' over-priced');
  var subject = 'RR Branch — ' + m.todayStr + ' — ' + m.submittedToday + ' in, ' +
                m.signedToday + ' signed' + (bits.length ? ' · ' + bits.join(', ') : '');

  MailApp.sendEmail({
    to: MAIL_CONFIG.branchManager,
    subject: subject,
    htmlBody: rrbMdHtml_(m)
  });
  Logger.log('Manager digest sent to ' + MAIL_CONFIG.branchManager + ' — ' + subject);
  return { ok: true, subject: subject, pending: m.pending.length };
}

/** Builds everything and logs the numbers. Sends nothing. Start here. */
function rrbMdPreview() {
  var rows = rrbMdLoadRows_();
  var m    = rrbMdMetrics_(rows, new Date());
  Logger.log('rows read            : %s', rows.length);
  Logger.log('submitted today      : %s', m.submittedToday);
  Logger.log('signed today         : %s', m.signedToday);
  Logger.log('awaiting review      : %s  (median %s days, %s over SLA)',
             m.pending.length, m.medianReviewDays, m.late.length);
  Logger.log('oldest waiting       : %s', m.oldest ? (m.oldest._age + 'd — ' + m.oldest.client) : 'none');
  Logger.log('replacements open    : %s', m.replacements.length);
  Logger.log('priced above comfort : %s', m.overCommitted.length);
  Logger.log('awaiting UW evidence : %s', m.uwEvidence.length);
  Logger.log('quiet agents         : %s  (%s)', m.quiet.length, m.quietSource);
  Logger.log('premium not captured : %s', m.premUnknown);
  Logger.log('--- recommend-ratio, weakest first ---');
  m.agents.slice(0, 10).forEach(function (a) {
    Logger.log('  %-26s %s cases  ratio %s  lines/case %s',
      a.name, a.subs, a.ratio === null ? 'n/a' : Math.round(a.ratio * 100) + '%', a.linesPer.toFixed(1));
  });
  return m;
}

/** Run once to schedule 5pm daily. Replaces any existing digest-v2 trigger. */
function rrbMdInstallTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rrbSendManagerDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rrbSendManagerDigest')
    .timeBased().atHour(17).everyDays(1)
    .inTimezone('America/Port_of_Spain').create();
  Logger.log('Manager digest scheduled for 17:00 daily (America/Port_of_Spain).');
}
