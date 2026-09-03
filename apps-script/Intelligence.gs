/* ══════════════════════════════════════════════════════════════════════════
   BRANCH INTELLIGENCE — backend for the Ricky Rampersad Branch workbook
   Spreadsheet: 1T1SG3mgs5QV5LuF3JTpmn1zFldhGjOQNoe0YCMhWxjs

   What this file is for
   ─────────────────────
   The branch workbook holds 29 tabs of Guardian extracts. Four questions are
   asked of it every week and none of them could be answered from it directly:

     1. Which premiums are actually going to lapse, and whose are they?
     2. What is stuck in pending business, and what requirement is stopping it?
     3. Which policies mature soon — pensions and life, separately?
     4. Which term benefits and conversion privileges expire before we notice?

   This script answers those four, behind a sign-in, and mails the answers out
   on a schedule so nobody has to remember to look.

   The shape of it
   ───────────────
   A nightly trigger (intelRebuild) reads the source tabs once, computes every
   figure, and writes the result to a cache tab as JSON plus five plain-English
   watchlist tabs the branch can sort and filter in the Sheet itself. The web
   app only ever reads the cache. That matters: the requirements extract alone
   is 66,000 rows, and recomputing it inside a page load would time out.

   Reading is never raw
   ────────────────────
   The site holds no client data and the browser is never handed the book. A
   request returns the caller's own slice — an agent gets their policies, a
   manager gets the branch. That is the whole reason the sign-in exists.

   DEPLOYING BESIDE AN EXISTING SCRIPT
   ───────────────────────────────────
   A script project may declare doGet and doPost exactly once. If this project
   already has them (BranchEngine.gs does), do NOT paste the block at the
   bottom of this file — add one line to the existing doPost instead. Run
   intelSelfTest() and it will tell you which case you are in and what to do.
   ══════════════════════════════════════════════════════════════════════════ */

var INTEL = {
  CACHE_TAB:      '_Intel Cache',
  ACTIONS_TAB:    'Intel Actions',
  SESSIONS_TAB:   'Intel Sessions',

  // The five tabs the rebuild writes for people to read in the Sheet itself.
  W_DUES:         'Watchlist — Dues',
  W_PENDING:      'Watchlist — Pending',
  W_REQS:         'Watchlist — Requirements',
  W_MATURITY:     'Watchlist — Maturities',
  W_EXPIRY:       'Watchlist — Expiry',
  W_XSELL:        'Watchlist — Cross-sell',

  SESSION_HOURS:  12,     // a sign-in lasts a working day, then it is gone
  CHASE_MIN_DAYS: 31,     // below this a premium is inside its grace period
  MATURITY_MONTHS: 60,    // how far ahead a maturity is worth knowing about
  EXPIRY_MONTHS:  120,    // term benefits are a longer conversation
  CACHE_CHUNK:    45000   // a cell holds 50k characters; stay under it
};

/* ── Numbers, dates and the specific ways this workbook lies ───────────────
   Every defect below was measured on the live workbook, not guessed:

     ##########    2,612 Paid To Date cells — a column too narrow at export
     30 Mar 1900   2,533 Projected Lapse Dates — spreadsheet epoch zero
     1.00E+09      107 policy numbers destroyed by scientific notation
     TAIL@GMAIL.CO M   2,745 e-mail addresses with a space wrapped into them

   Treating any of these as a value is how a report ends up confidently wrong,
   so each one resolves to blank here and is counted on the data-health panel
   instead. Blank is honest; 30 March 1900 is not.                          */

function iNum_(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function iBadNumber_(v) {
  return /[eE][+\-]?\d/.test(String(v || ''));   // 5.00E+09 — the digits are gone
}

var I_MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function iDate_(v, dayFirst) {
  if (!v && v !== 0) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) || v.getFullYear() < 1950 ? null : v;
  }
  var s = String(v).trim();
  if (!s || s === '##########' || s === 'Not Available' || /^0000-00-00/.test(s)) return null;

  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                       // 2026-08-28
  if (m) return iMk_(+m[1], +m[2] - 1, +m[3]);

  m = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,})[-\/\s](\d{2,4})$/);   // 28-Aug-2026 · 7-August-26
  if (m) {
    var mo = I_MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo === undefined) return null;
    return iMk_(iYear_(m[3]), mo, +m[1]);
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);             // 15 November 2018
  if (m) {
    var mo2 = I_MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo2 === undefined) return null;
    return iMk_(+m[3], mo2, +m[1]);
  }

  /* Slash dates come in both orders and the workbook uses both. The task log
     writes 10/17/2025, which can only be month-first. The settlement extract
     writes 22/05/2026, which can only be day-first. Read whichever component
     is impossible as a month, and fall back to the caller's hint when both
     are under thirteen.

     Getting this wrong is not a small error: month 22 rolls the year forward,
     so 22/05/2026 came out as 2028 and sorted to the top of "latest settled". */
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    var p1 = +m[1], p2 = +m[2];
    if (p1 > 12 && p2 <= 12) return iMk_(+m[3], p2 - 1, p1);   // must be day-first
    if (p2 > 12 && p1 <= 12) return iMk_(+m[3], p1 - 1, p2);   // must be month-first
    return dayFirst ? iMk_(+m[3], p2 - 1, p1) : iMk_(+m[3], p1 - 1, p2);
  }

  var d = new Date(s);
  return isNaN(d.getTime()) || d.getFullYear() < 1950 ? null : d;
}

function iYear_(y) { y = +y; return y < 100 ? (y < 70 ? 2000 + y : 1900 + y) : y; }

/* 30 March 1900 is the spreadsheet's zero, not a date anybody meant. */
function iMk_(y, mo, d) {
  if (y < 1950) return null;
  var dt = new Date(y, mo, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function iDays_(from, to) {
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function iToday_() {
  var t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

function iIso_(d) {
  return d ? Utilities.formatDate(d, iTz_(), 'yyyy-MM-dd') : '';
}

function iTz_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'America/Port_of_Spain';
}

function iMoney_(n) {
  return 'TT$' + Utilities.formatString('%,.2f', iNum_(n)).replace(/^(-?)/, '$1');
}

/* An address the mail server will actually accept. The workbook's export put a
   space inside 2,745 of them, so a plain "does it contain @" test passes on
   addresses that bounce. Strip the spaces first, then judge. */
function iEmail_(v) {
  var s = String(v || '').trim();
  if (!s || /^not available$/i.test(s)) return '';
  s = s.replace(/\s+/g, '');
  return /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(s) ? s.toLowerCase() : '';
}

function iPhone_(v) {
  var s = String(v || '').trim();
  if (!s || /^not available$/i.test(s)) return '';
  var digits = s.replace(/\D/g, '');
  if (digits.length < 7) return '';
  if (/^0+$/.test(digits.slice(-7))) return '';   // 868-000-0000 is a placeholder
  return s;
}

/* ── Finding the tabs ──────────────────────────────────────────────────────
   Tabs are found by the columns they carry, never by their names. The branch
   renames tabs, and the KPI tracker learned this the expensive way. A Script
   Property named INTEL_TAB_<KEY> overrides the search if a tab ever has to be
   pointed at by hand.

   Header cells are trimmed before matching. The Access tab's first header is
   literally "Email " with a trailing space, and an untrimmed lookup misses it
   — which locks out every person on the tab.                               */

function iSs_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function iProp_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function iSetProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, String(v)); }

function iHeaders_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
}

/* A tab qualifies when it carries every column in `must`. Ties break on row
   count: the fullest tab wins, because the workbook keeps empty duplicates of
   several extracts and reading one of those reports "nothing outstanding". */
function iFindTab_(key, must) {
  var override = iProp_('INTEL_TAB_' + key);
  if (override) {
    var o = iSs_().getSheetByName(override);
    if (o) return o;
  }
  var best = null, bestRows = -1;
  iSs_().getSheets().forEach(function (sh) {
    if (sh.getLastRow() < 2) return;
    var head = iHeaders_(sh);
    var ok = must.every(function (m) {
      return head.some(function (h) { return h === m || h.indexOf(m) === 0; });
    });
    if (!ok) return;
    if (sh.getLastRow() > bestRows) { best = sh; bestRows = sh.getLastRow(); }
  });
  return best;
}

function iTabDues_()     { return iFindTab_('DUES',     ['agent', 'client number', 'premium', 'status description']); }
function iTabInforce_()  { return iFindTab_('INFORCE',  ['policy id', 'policy maturity date', 'plan', 'fund value']); }
function iTabPending_()  { return iFindTab_('PENDING',  ['policy', 'decisiontype', 'reqtdayslapsed']); }
function iTabReqs_()     { return iFindTab_('REQS',     ['insured_requirement_id', 'requirement_code', 'policy_number']); }
function iTabTasks_()    { return iFindTab_('TASKS',    ['subject', 'task type', 'days o/s']); }
function iTabAccess_()   { return iFindTab_('ACCESS',   ['email', 'name', 'role']); }
function iTabSettled_()  { return iFindTab_('SETTLED',  ['api_amt', 'count', 'year', 'month']); }
function iTabMagnum_()   { return iFindTab_('MAGNUM',   ['overall_decision_code', 'policy_number']); }

/* Column index by name, tolerant of the trailing spaces and the (2)-style
   suffixes the extracts carry. Returns -1 when the column is absent, and every
   caller is expected to cope with that rather than read column A by accident. */
function iCol_(head, names) {
  for (var n = 0; n < names.length; n++) {
    var want = String(names[n]).toLowerCase();
    for (var i = 0; i < head.length; i++) if (head[i] === want) return i;
  }
  for (var n2 = 0; n2 < names.length; n2++) {
    var w2 = String(names[n2]).toLowerCase();
    for (var j = 0; j < head.length; j++) if (head[j].indexOf(w2) === 0) return j;
  }
  return -1;
}

/* Read only the columns asked for. The requirements extract is 66,000 rows by
   23 columns; pulling the whole range is 1.5 million cells and the rebuild
   runs out of time. Six single-column reads is a fraction of the work. */
function iReadCols_(sh, spec) {
  var out = { rows: 0, get: function () { return ''; } };
  if (!sh) return out;
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return out;

  var head = iHeaders_(sh);
  var cols = {}, data = {};
  Object.keys(spec).forEach(function (key) {
    var idx = iCol_(head, spec[key]);
    cols[key] = idx;
    data[key] = idx < 0 ? null
      : sh.getRange(2, idx + 1, lastRow - 1, 1).getValues();
  });

  return {
    rows: lastRow - 1,
    has: function (key) { return cols[key] >= 0; },
    get: function (key, r) {
      var c = data[key];
      return c ? c[r][0] : '';
    }
  };
}

function iSheet_(name, headerRow) {
  var sh = iSs_().getSheetByName(name);
  if (!sh) {
    sh = iSs_().insertSheet(name);
    if (headerRow) {
      sh.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
      sh.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

/* Replace a watchlist wholesale. These tabs are derived — nothing anybody
   types into them survives a rebuild, and the header says so. */
function iWriteTab_(name, header, rows, note) {
  var sh = iSheet_(name, header);
  sh.clear();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold')
    .setBackground('#00254d').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  var foot = rows.length + 1 + 2;
  sh.getRange(foot, 1).setValue(
    'Rebuilt ' + Utilities.formatDate(new Date(), iTz_(), 'yyyy-MM-dd HH:mm') +
    ' by Branch Intelligence. This tab is rebuilt from scratch every night — ' +
    'edits made here are lost. Record decisions in "' + INTEL.ACTIONS_TAB + '".' +
    (note ? '  ' + note : '')
  ).setFontColor('#777777').setFontStyle('italic');
  sh.autoResizeColumns(1, Math.min(header.length, 12));
  return sh;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE REBUILD
   Runs nightly. Reads every source once, computes all five domains, writes the
   cache and the watchlists. Everything the web app serves comes from here.
   ══════════════════════════════════════════════════════════════════════════ */

function intelRebuild() {
  var started = new Date();
  var today = iToday_();
  var out = {
    builtAt: Utilities.formatDate(started, iTz_(), 'yyyy-MM-dd HH:mm'),
    asOf: iIso_(today),
    dues: iBuildDues_(today),
    tasks: iBuildTasks_(today),
    pending: iBuildPending_(today),
    reqs: iBuildReqs_(today),
    maturity: iBuildMaturity_(today),
    expiry: null,
    production: iBuildProduction_(today),
    freshness: iBuildFreshness_(today),
    health: null
  };
  // Maturities and expiry read the same inforce book, so they are built together.
  out.expiry = out.maturity.expiry;
  delete out.maturity.expiry;
  /* Cross-sell reads every in-force record, not just the maturing ones. The
     raw list is dropped straight after so it never reaches a browser. */
  out.underwriting = iBuildUnderwriting_(today);
  out.crosssell = iBuildCrossSell_(today, out.maturity.all);
  /* Built here because it needs the in-force rows, and shipped in the cache so
     scoping and the digests all agree on who is who. */
  out.aliases = iBuildAliases_(out.maturity.all);
  out.units = iBuildUnits_();
  delete out.maturity.all;
  iJoinChases_(out);

  /* Movements need every policy's status, not just the chase list. The working
     list is handed over and dropped straight after — it is a third of a
     megabyte and nothing on screen reads it. */
  out.__duesAll = (out.dues && out.dues.allCodes) || [];
  out.movements = iBuildMovements_(out);
  delete out.__duesAll;
  if (out.dues) delete out.dues.allCodes;
  out.health = iBuildHealth_(out);
  out.seconds = Math.round((new Date() - started) / 1000);

  iSaveCache_(out);
  iWriteWatchlists_(out);
  iSetProp_('INTEL_LAST_BUILD', out.builtAt);
  return out;
}

/* ── Premium dues ─────────────────────────────────────────────────────────
   The status codes are not self-explanatory and reading them wrongly is the
   easiest mistake in this workbook:

     Status 0  — no premium problem. The Status Description says what the
                 policy actually is: Premium Paying, Surrendered, Matured,
                 Death, Paid up. Not a dues case.
     Status 1  — Lapsed. Already gone. It is a reinstatement conversation,
                 not a collection one, and it does not belong in "at risk".
     Status 2  — Overdue and still premium-paying. THIS is the collectable
                 book. Confusingly its Status Description reads "Premium
                 Paying", which is why a naive filter on the description
                 misses every case that matters.
     Status 3  — Pending, underwriting incomplete.

   PREMIUM IS MODAL, NOT ANNUAL. The Premium column is one instalment. The
   Mode column that would say which frequency is empty in all 20,392 rows, so
   the sheet cannot be annualised and this script never pretends otherwise:
   it reports instalments at risk and labels them as such. Summing the column
   and calling it annual premium understates it roughly twelvefold on monthly
   business and overstates nothing consistently — the figure means nothing at
   all. Confirmed against the in-force book, where the same policies carry
   Modal Premium identical to this column and an Annual Premium 11.9x larger.
                                                                            */
function iBuildDues_(today) {
  var sh = iTabDues_();
  if (!sh) return { error: 'No dues tab found (needs Agent, Client Number, Premium, Status Description).' };

  var d = iReadCols_(sh, {
    agent: ['agent'], number: ['number'], clientNo: ['client number'], client: ['client'],
    premium: ['premium'], issue: ['issue date'], status: ['status'], status2: ['status(2)', 'status2'],
    days: ['days'], itype: ['insurance type'], paidTo: ['paid to date'], sumAssured: ['sum assured'],
    plan: ['plan code'], billing: ['billing type'], mode: ['mode'], desc: ['status description'],
    lapseDate: ['projected lapse date'], phone: ['phone'], email: ['email']
  });

  var BUCKETS = ['0-30', '31-60', '61-90', '91-180', '181-365', '365+'];
  function bucket(n) {
    return n <= 30 ? '0-30' : n <= 60 ? '31-60' : n <= 90 ? '61-90'
         : n <= 180 ? '91-180' : n <= 365 ? '181-365' : '365+';
  }

  var ageing = {}, byBilling = {}, byAgent = {}, byPlan = {}, ageingByAgent = {};
  BUCKETS.forEach(function (b) { ageing[b] = { policies: 0, modal: 0 }; });

  var chase = [], lapsedRecent = [], allCodes = [];
  var counts = { total: 0, overdue: 0, lapsed: 0, pending: 0, clean: 0 };
  var defects = { sciNumber: 0, badPaidTo: 0, badLapseDate: 0, spacedEmail: 0, noPhone: 0, noEmail: 0, unreachable: 0 };
  var modalOverdue = 0, modalChase = 0;

  for (var r = 0; r < d.rows; r++) {
    var status = String(d.get('status', r)).trim();
    var agent  = String(d.get('agent', r)).trim();
    if (!agent && !status) continue;
    counts.total++;

    var rawNum = d.get('number', r);
    if (iBadNumber_(rawNum)) defects.sciNumber++;
    if (String(d.get('paidTo', r)).trim() === '##########') defects.badPaidTo++;
    if (!iDate_(d.get('lapseDate', r)) && String(d.get('lapseDate', r)).trim()) defects.badLapseDate++;

    var rawEmail = String(d.get('email', r)).trim();
    if (rawEmail && !/^not available$/i.test(rawEmail) && /\s/.test(rawEmail)) defects.spacedEmail++;
    var email = iEmail_(rawEmail), phone = iPhone_(d.get('phone', r));
    if (!phone) defects.noPhone++;
    if (!email) defects.noEmail++;

    var modal = iNum_(d.get('premium', r));
    var days  = iNum_(d.get('days', r));
    var billing = String(d.get('billing', r)).trim() || '(none)';
    var plan = String(d.get('plan', r)).trim() || '(none)';

    if (status === '1') counts.lapsed++;
    else if (status === '3') counts.pending++;
    else if (status !== '2') { counts.clean++; }

    /* One letter per policy for the overnight comparison. A policy that has
       genuinely ended is 'G' — it should never show up as a fresh lapse. */
    var desc = String(d.get('desc', r)).trim();
    var code = status === '1' ? 'L' : status === '2' ? 'O' : status === '3' ? 'U'
             : /surrender|matured|death|file closed|not proceeded|not taken|expired|rejected|declined|converted/i.test(desc) ? 'G'
             : 'P';
    if (!iBadNumber_(rawNum)) {
      allCodes.push({ policy: String(rawNum).trim(), code: code, agent: agent,
                      client: String(d.get('client', r)).trim(), modal: modal,
                      plan: plan, phone: phone, email: email });
    }

    if (status === '2') {
      counts.overdue++;
      modalOverdue += modal;
      var b = bucket(days);
      ageing[b].policies++; ageing[b].modal += modal;

      if (!byBilling[billing]) byBilling[billing] = { total: 0, overdue: 0, modal: 0 };
      byBilling[billing].overdue++; byBilling[billing].modal += modal;

      if (!byAgent[agent]) byAgent[agent] = { book: 0, overdue: 0, chase: 0, modal: 0, unreachable: 0 };
      byAgent[agent].overdue++;

      /* Per-agent bands, kept because an agent's own view must show their own
         ageing and the chase list alone cannot rebuild it — it starts at 31
         days and the 0-30 band would vanish. */
      if (!ageingByAgent[agent]) { ageingByAgent[agent] = {}; BUCKETS.forEach(function (k) { ageingByAgent[agent][k] = { policies: 0, modal: 0 }; }); }
      ageingByAgent[agent][b].policies++; ageingByAgent[agent][b].modal += modal;

      if (!byPlan[plan]) byPlan[plan] = { total: 0, overdue: 0 };
      byPlan[plan].overdue++;

      if (days >= INTEL.CHASE_MIN_DAYS) {
        modalChase += modal;
        byAgent[agent].chase++; byAgent[agent].modal += modal;
        if (!phone && !email) { defects.unreachable++; byAgent[agent].unreachable++; }
        chase.push({
          agent: agent,
          policy: iBadNumber_(rawNum) ? '' : String(rawNum).trim(),
          policyBroken: iBadNumber_(rawNum),
          clientNo: String(d.get('clientNo', r)).trim(),
          client: String(d.get('client', r)).trim(),
          modal: modal, days: days, bucket: b,
          plan: plan, billing: billing,
          paidTo: iIso_(iDate_(d.get('paidTo', r))),
          lapseOn: iIso_(iDate_(d.get('lapseDate', r))),
          phone: phone, email: email,
          reachable: !!(phone || email)
        });
      }
    }

    if (!byBilling[billing]) byBilling[billing] = { total: 0, overdue: 0, modal: 0 };
    byBilling[billing].total++;
    if (!byAgent[agent]) byAgent[agent] = { book: 0, overdue: 0, chase: 0, modal: 0, unreachable: 0 };
    byAgent[agent].book++;
    if (!byPlan[plan]) byPlan[plan] = { total: 0, overdue: 0 };
    byPlan[plan].total++;

    if (status === '1') {
      var lapsedOn = iDate_(d.get('lapseDate', r));
      var ago = lapsedOn ? iDays_(lapsedOn, today) : null;
      if (ago !== null && ago >= 0 && ago <= 365) {
        lapsedRecent.push({
          agent: agent, client: String(d.get('client', r)).trim(),
          policy: String(rawNum).trim(), plan: plan, modal: modal,
          lapsedOn: iIso_(lapsedOn), daysAgo: ago,
          phone: phone, email: email
        });
      }
    }
  }

  // Sharpest first: the oldest arrears on the largest instalments.
  chase.sort(function (a, b) { return (b.days - a.days) || (b.modal - a.modal); });
  lapsedRecent.sort(function (a, b) { return a.daysAgo - b.daysAgo; });

  var billingRows = Object.keys(byBilling).map(function (k) {
    var v = byBilling[k];
    return { billing: k, total: v.total, overdue: v.overdue, modal: v.modal,
             rate: v.total ? v.overdue / v.total : 0 };
  }).filter(function (x) { return x.total >= 10; })
    .sort(function (a, b) { return b.rate - a.rate; });

  var agentRows = Object.keys(byAgent).map(function (k) {
    var v = byAgent[k];
    return { agent: k, book: v.book, overdue: v.overdue, chase: v.chase,
             modal: v.modal, unreachable: v.unreachable,
             rate: v.book ? v.chase / v.book : 0 };
  }).filter(function (x) { return x.book >= 20; })
    .sort(function (a, b) { return b.rate - a.rate; });

  var planRows = Object.keys(byPlan).map(function (k) {
    var v = byPlan[k];
    return { plan: k, total: v.total, overdue: v.overdue, rate: v.total ? v.overdue / v.total : 0 };
  }).filter(function (x) { return x.total >= 25; })
    .sort(function (a, b) { return b.rate - a.rate; }).slice(0, 15);

  return {
    counts: counts, ageing: ageing, buckets: BUCKETS,
    modalOverdue: modalOverdue, modalChase: modalChase,
    chaseCount: chase.length,
    chase: chase.slice(0, 4000),
    lapsedRecent: lapsedRecent.slice(0, 1500),
    byBilling: billingRows, byAgent: agentRows, byPlan: planRows,
    ageingByAgent: ageingByAgent,
    allCodes: allCodes,
    defects: defects,
    // Said in one place so every screen and every e-mail says the same thing.
    basis: 'Premium is the modal instalment. The Mode column is empty in every ' +
           'row of this extract, so the book cannot be annualised — these are ' +
           'instalments at risk, not annual premium.'
  };
}

/* ── Pending business ─────────────────────────────────────────────────────
   The pending tab is the branch's own working list, not a Guardian extract,
   so it is small and its status codes are the ones staff use:

     OR    outstanding requirement — the case is waiting on a document
     PCRU  pending client response, underwriting
     PCRC  pending client response, client

   POL_MISC_SUSP_AMT is money the client has already paid that cannot be
   applied until the case closes. It is the most persuasive number on the
   screen: it is the client's own money sitting still.                      */
function iBuildPending_(today) {
  var sh = iTabPending_();
  if (!sh) return { error: 'No pending tab found (needs Policy, DecisionType, ReqtdaysLapsed).' };

  var d = iReadCols_(sh, {
    yr: ['yr'], mth: ['mth'], policy: ['policy'], decision: ['decisiontype'],
    client: ['client name'], status: ['status'], submit: ['submitdt'],
    branch: ['branch'], reqt: ['reqt'], reqtDt: ['reqtdt'],
    agentId: ['agentid'], agent: ['agent name'], lapsed: ['reqtdayslapsed'],
    branchName: ['branchname'], susp: ['pol_misc_susp_amt'], clientId: ['clientid'],
    where: ['being processed in'], pay: ['payment method']
  });

  var rows = [], byStatus = {}, byDecision = {}, byAgent = {}, byUnit = {};
  var suspense = 0, suspenseCases = 0, stale = 0;
  var AGE = { '0-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, '180+': 0 };

  for (var r = 0; r < d.rows; r++) {
    var policy = String(d.get('policy', r)).trim();
    if (!policy) continue;

    var submit = iDate_(d.get('submit', r));
    var reqtDt = iDate_(d.get('reqtDt', r));

    /* ReqtdaysLapsed in this tab reaches 8,128 — a stale cell, not a case
       that has waited twenty-two years. Age is recomputed from the dates,
       and the sheet's own figure is kept only as a fallback when both dates
       are missing. Anything over ten years is dropped rather than shown. */
    var age = reqtDt ? iDays_(reqtDt, today) : (submit ? iDays_(submit, today) : null);
    if (age === null) {
      var claimed = iNum_(d.get('lapsed', r));
      age = (claimed > 0 && claimed < 3650) ? claimed : null;
    }
    if (age !== null && (age < 0 || age > 3650)) age = null;

    var status   = String(d.get('status', r)).trim() || '(none)';
    var decision = String(d.get('decision', r)).trim() || '(none)';
    var agent    = String(d.get('agent', r)).trim() || '(unassigned)';
    var unit     = String(d.get('branchName', r)).trim() || '(unassigned)';
    var susp     = iNum_(d.get('susp', r));

    if (susp > 0) { suspense += susp; suspenseCases++; }
    byStatus[status]     = (byStatus[status] || 0) + 1;
    byDecision[decision] = (byDecision[decision] || 0) + 1;
    if (!byAgent[agent]) byAgent[agent] = { cases: 0, susp: 0, oldest: 0 };
    byAgent[agent].cases++; byAgent[agent].susp += susp;
    if (age !== null && age > byAgent[agent].oldest) byAgent[agent].oldest = age;
    if (!byUnit[unit]) byUnit[unit] = { cases: 0, susp: 0 };
    byUnit[unit].cases++; byUnit[unit].susp += susp;

    if (age !== null) {
      AGE[age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90'
        : age <= 180 ? '91-180' : '180+']++;
      if (age > 90) stale++;
    }

    rows.push({
      policy: policy, client: String(d.get('client', r)).trim(),
      clientId: String(d.get('clientId', r)).trim(),
      status: status, decision: decision, agent: agent, unit: unit,
      requirement: String(d.get('reqt', r)).trim(),
      submitted: iIso_(submit), requestedOn: iIso_(reqtDt),
      age: age, suspense: susp,
      where: String(d.get('where', r)).trim(),
      payment: String(d.get('pay', r)).trim()
    });
  }

  rows.sort(function (a, b) { return (b.suspense - a.suspense) || ((b.age || 0) - (a.age || 0)); });

  return {
    total: rows.length, suspense: suspense, suspenseCases: suspenseCases, stale: stale,
    ageing: AGE, byStatus: byStatus, byDecision: byDecision,
    byAgent: Object.keys(byAgent).map(function (k) {
      return { agent: k, cases: byAgent[k].cases, susp: byAgent[k].susp, oldest: byAgent[k].oldest };
    }).sort(function (a, b) { return b.cases - a.cases; }),
    byUnit: Object.keys(byUnit).map(function (k) {
      return { unit: k, cases: byUnit[k].cases, susp: byUnit[k].susp };
    }).sort(function (a, b) { return b.cases - a.cases; }),
    rows: rows
  };
}

/* ── The chase log ────────────────────────────────────────────────────────
   The Tasks tab is the branch's own record of chasing head office — every row
   is "Follow up with UW" on a pending case, assigned to a member of staff.
   1,516 of 1,552 are closed; the open ones are the live chases.

   The policy number lives inside the Subject line rather than a column of its
   own, so it is pulled out with a pattern. That join is what answers the
   question nothing else in this workbook can: which pending cases has nobody
   picked up. A case with no chase against it is not being worked — it is just
   sitting there, and it will sit there until somebody notices.             */
function iBuildTasks_(today) {
  var sh = iTabTasks_();
  if (!sh) return { error: 'No tasks tab found (needs Subject, Task Type, Days O/S).', byPolicy: {} };

  var d = iReadCols_(sh, {
    modified: ['last modified date'], status: ['status'], by: ['last modified by'],
    assigned: ['assigned'], date: ['date'], os: ['days o/s'],
    since: ['days since last activity'], subject: ['subject'], agent: ['agent'],
    type: ['task type'], created: ['created by'], contact: ['contact']
  });

  var open = [], byAssignee = {}, byContact = {}, byPolicy = {};
  var closed = 0;

  for (var r = 0; r < d.rows; r++) {
    var subject = String(d.get('subject', r)).trim();
    if (!subject) continue;
    var status = String(d.get('status', r)).trim();
    var isOpen = !/^completed$/i.test(status);
    if (!isOpen) closed++;

    var assigned = String(d.get('assigned', r)).trim() || '(unassigned)';
    var modified = iDate_(d.get('modified', r));
    var since = iNum_(d.get('since', r));
    /* Days Since Last Activity is 0 on almost every row, including rows last
       touched months ago, so it is only trusted when the date agrees. */
    var quiet = modified ? iDays_(modified, today) : null;
    if (quiet === null || quiet < 0) quiet = since || null;

    /* Guardian policy numbers in this book are ten digits beginning 1 or 5.
       Subjects carry one or two of them, sometimes slash-separated. */
    var found = subject.match(/\b[15]\d{9}\b/g) || [];
    found.forEach(function (pol) {
      if (!byPolicy[pol]) byPolicy[pol] = [];
      byPolicy[pol].push({ assigned: assigned, status: status, open: isOpen,
                           on: iIso_(modified), quiet: quiet });
    });

    /* Closed tasks are kept for the join — they are the evidence a case WAS
       worked — but they are not part of the open workload. */
    if (!isOpen) continue;

    byAssignee[assigned] = (byAssignee[assigned] || 0) + 1;
    var contact = String(d.get('contact', r)).trim() || '(none)';
    byContact[contact] = (byContact[contact] || 0) + 1;

    open.push({
      subject: subject, status: status, assigned: assigned,
      agent: String(d.get('agent', r)).trim(),
      contact: contact, policies: found,
      lastTouched: iIso_(modified), quiet: quiet
    });
  }

  open.sort(function (a, b) { return (b.quiet || 0) - (a.quiet || 0); });

  return {
    openCount: open.length, closed: closed,
    byAssignee: Object.keys(byAssignee).map(function (k) { return { who: k, n: byAssignee[k] }; })
      .sort(function (a, b) { return b.n - a.n; }),
    byContact: Object.keys(byContact).map(function (k) { return { who: k, n: byContact[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 10),
    byPolicy: byPolicy,
    rows: open
  };
}

/* ── Requirements ─────────────────────────────────────────────────────────
   Sixty-six thousand rows of requirement history. A requirement is open when
   it has no closed_date; everything else is the audit trail of a case that
   already went through. Age is measured from added_date, because ordered_date
   is missing on a tenth of the open ones.

   The requirement code is the thing staff actually chase, so the codes are
   spelled out. Anything not in the list is shown as its raw code rather than
   guessed at — a compliance list that invents a meaning is worse than one
   that admits it does not know.                                            */
var IREQ_CODES = {
  FUTPY: 'First / future premium', DECLF: 'Declaration of health',
  PRADD: 'Proof of address', AGEAD: 'Proof of age', MDMED: 'Medical examination',
  REINC: 'Proof of income', FACTF: 'Fact find', VERFY: 'Identity verification',
  MICRO: 'Microscopic urinalysis', OFT: 'Order for tests', BP: 'Blood profile',
  'IMP HIST': 'Impairment history', PCFEV: 'Client confirmation', INFCR: 'Inspection report',
  ATTPH: "Attending physician's statement", EKG: 'Electrocardiogram'
};
function iReqLabel_(code) {
  var c = String(code || '').trim().toUpperCase();
  return IREQ_CODES[c] || c || '(unnamed)';
}

function iBuildReqs_(today) {
  var sh = iTabReqs_();
  if (!sh) return { error: 'No requirements tab found (needs insured_requirement_id, requirement_code, policy_number).' };

  var d = iReadCols_(sh, {
    added: ['added_date'], closed: ['closed_date'], ordered: ['ordered_date'],
    policy: ['policy_number'], code: ['requirement_code'], cat: ['requirements'],
    comment: ['requirement_comment'], first: ['first_name'], last: ['last_name'],
    reqId: ['insured_requirement_id']
  });

  var AGE = { '0-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, '181-365': 0, '365+': 0 };
  var open = [], byCode = {}, byCat = {}, byPolicy = {}, seen = {};
  var closedThisYear = 0, ages = [];

  for (var r = 0; r < d.rows; r++) {
    var policy = String(d.get('policy', r)).trim();
    if (!policy) continue;

    var closed = iDate_(d.get('closed', r));
    if (closed) {
      if (iDays_(closed, today) <= 365) closedThisYear++;
      continue;
    }

    /* The extract repeats a requirement once per history row. Counting rows
       instead of requirements inflates the open list several times over, so
       each insured_requirement_id is taken once. */
    var key = String(d.get('reqId', r)).trim() || (policy + '|' + d.get('code', r));
    if (seen[key]) continue;
    seen[key] = 1;

    var added = iDate_(d.get('added', r)) || iDate_(d.get('ordered', r));
    var age = added ? iDays_(added, today) : null;
    if (age !== null && age >= 0) {
      ages.push(age);
      AGE[age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90'
        : age <= 180 ? '91-180' : age <= 365 ? '181-365' : '365+']++;
    }

    var code = String(d.get('code', r)).trim().toUpperCase();
    var cat  = String(d.get('cat', r)).trim() || '(uncategorised)';
    byCode[code] = (byCode[code] || 0) + 1;
    byCat[cat]   = (byCat[cat] || 0) + 1;
    byPolicy[policy] = (byPolicy[policy] || 0) + 1;

    open.push({
      policy: policy, code: code, label: iReqLabel_(code), category: cat,
      comment: String(d.get('comment', r)).trim(),
      orderedFor: [String(d.get('first', r)).trim(), String(d.get('last', r)).trim()]
        .filter(String).join(' '),
      added: iIso_(added), age: age
    });
  }

  open.sort(function (a, b) { return (b.age || 0) - (a.age || 0); });
  ages.sort(function (a, b) { return a - b; });

  var worst = Object.keys(byPolicy).map(function (p) { return { policy: p, open: byPolicy[p] }; })
    .sort(function (a, b) { return b.open - a.open; }).slice(0, 40);

  return {
    openCount: open.length,
    policies: Object.keys(byPolicy).length,
    closedThisYear: closedThisYear,
    medianAge: ages.length ? ages[Math.floor(ages.length / 2)] : 0,
    oldest: ages.length ? ages[ages.length - 1] : 0,
    overYear: AGE['365+'],
    ageing: AGE,
    byCode: Object.keys(byCode).map(function (k) {
      return { code: k, label: iReqLabel_(k), n: byCode[k] };
    }).sort(function (a, b) { return b.n - a.n; }).slice(0, 20),
    byCategory: byCat,
    worstPolicies: worst,
    rows: open.slice(0, 3000)
  };
}

/* ── What each plan actually is ───────────────────────────────────────────
   The house rule is check the type, never the name — and this book is exactly
   where that bites. Two of the 45 plans read as life cover and are not:

     LIFE SECURE / LIFSECURE CO   deferred annuity, a savings target
     PA DTH/DIS                   personal accident, pays a monthly income
     EVOL - CRIT                  critical illness, reimburses on diagnosis

   None of those is payable on death, so none belongs in a sum-assured total.
   Putting them in is what produced the branch's TT$121m cover figure once
   before. The table below is the whole classification and it is deliberately
   explicit: a plan that is not listed comes back "unclassified" and is
   counted separately rather than being quietly filed as life.

   Add a plan here when Guardian adds one. Do not widen the prefixes.       */
var IPLANS = {
  retirement: ['LSTYLE', 'LFSTYL', 'L/STYLE', 'UNREG ANNUITY', 'LIFE SECURE', 'LIFSECURE',
               'NL2000 FND', 'LS2000 FND', "N'LIFE FND"],
  term:       ['FLTRM', 'XPR LIFE', 'RV C/TRM', 'YR RELIANCE'],
  life:       ['EVOL TO', 'EVOL - LIFE', 'ECONO LIFE'],
  benefit:    ['PA DTH', 'EVOL - CRIT', 'EVOL -DEPOSIT']
};

function iClassifyPlan_(plan) {
  var p = String(plan || '').trim().toUpperCase();
  if (!p) return 'unclassified';
  var keys = ['benefit', 'term', 'retirement', 'life'];   // benefit first: EVOL - CRIT is not EVOL TO
  for (var k = 0; k < keys.length; k++) {
    var pats = IPLANS[keys[k]];
    for (var i = 0; i < pats.length; i++) if (p.indexOf(pats[i]) !== -1) return keys[k];
  }
  return 'unclassified';
}

/* ── Maturities and expiry ────────────────────────────────────────────────
   Both read the in-force book, which is the only tab carrying a maturity date
   at all. The dues extract has none, which is why nobody could see these.

     A retirement maturity is a conversation about a fund. It carries Fund
     Value and no sum insured, and it needs starting a year out, not a month.

     A life maturity is an endowment paying out.

     A term expiry is cover disappearing. If the plan carries CNV the client
     may convert to permanent cover without evidence of health — a right that
     expires with the term and is worth more than the renewal.              */
function iBuildMaturity_(today) {
  var sh = iTabInforce_();
  if (!sh) return { error: 'No in-force tab found (needs Policy Id, Policy Maturity Date, Plan, Fund Value).', expiry: { error: 'No in-force tab found.' } };

  var d = iReadCols_(sh, {
    policy: ['policy id'], given: ['given name'], sur: ['surname'], plan: ['plan'],
    eff: ['policy effective date'], mat: ['policy maturity date'],
    sumIns: ['sum insured'], fund: ['fund value'],
    modal: ['modal premium'], annual: ['annual premium'],
    billMode: ['policy bill mode'], billType: ['policy bill type'],
    paidTo: ['policy paid to date'], overdue: ['daysoverdue'],
    funds3: ['funds for 3 premiums'], susp: ['premium in suspense amount'],
    clientId: ['client id'], birth: ['client birth date'], sex: ['sex'],
    c1: ['contact 1'], c2: ['contact 2'], c3: ['contact 3'], email: ['email'],
    city: ['city'], agent: ['servcing agent name', 'servicing agent name'],
    agentId: ['servicing agent id'], unit: ['servcing branch name', 'servicing branch name'],
    agentStatus: ['servicing agent status']
  });

  var mat = [], exp = [], all = [], byClass = {}, byAgentTotals = {};
  var suspense = 0, suspenseCases = 0, fundHeld = 0, orphaned = 0, noFunds3 = 0;
  var horizonM = INTEL.MATURITY_MONTHS, horizonE = INTEL.EXPIRY_MONTHS;

  for (var r = 0; r < d.rows; r++) {
    var policy = String(d.get('policy', r)).trim();
    if (!policy) continue;

    var plan = String(d.get('plan', r)).trim();
    var cls  = iClassifyPlan_(plan);
    byClass[cls] = (byClass[cls] || 0) + 1;

    var susp = iNum_(d.get('susp', r));
    var agentNm = String(d.get('agent', r)).trim();
    if (!byAgentTotals[agentNm]) byAgentTotals[agentNm] = { agentId: iCode_(d.get('agentId', r)),
      suspense: 0, suspenseCases: 0, fundHeld: 0, orphaned: 0, noFunds3: 0 };
    var mineT = byAgentTotals[agentNm];

    if (susp > 0) { suspense += susp; suspenseCases++; mineT.suspense += susp; mineT.suspenseCases++; }
    if (cls === 'retirement') { fundHeld += iNum_(d.get('fund', r)); mineT.fundHeld += iNum_(d.get('fund', r)); }
    if (String(d.get('funds3', r)).trim().toLowerCase() === 'no') { noFunds3++; mineT.noFunds3++; }

    /* An inactive or vested servicing agent means nobody is calling this
       client. On a maturing policy that is a payout nobody will service. */
    var agentStatus = String(d.get('agentStatus', r)).trim();
    var isOrphan = /inactive|vested|terminated/i.test(agentStatus);
    if (isOrphan) { orphaned++; mineT.orphaned++; }

    /* Age drives which cross-sell conversation fits, so it is computed once
       here rather than in every rule. A birth date that parses to an
       impossible age is treated as absent rather than used. */
    var born = iDate_(d.get('birth', r));
    var age = born ? Math.floor((iDays_(born, today) || 0) / 365.25) : null;
    if (age !== null && (age < 0 || age > 110)) age = null;

    var matDate = iDate_(d.get('mat', r));
    var monthsOut = matDate ? iDays_(today, matDate) : null;
    if (monthsOut !== null) monthsOut = monthsOut < 0 ? null : monthsOut / 30.44;

    var rec = {
      policy: policy,
      client: [String(d.get('given', r)).trim(), String(d.get('sur', r)).trim()].filter(String).join(' '),
      clientId: String(d.get('clientId', r)).trim(),
      plan: plan, cls: cls, age: age,
      matures: iIso_(matDate),
      months: monthsOut === null ? null : Math.round(monthsOut),
      sumInsured: iNum_(d.get('sumIns', r)),
      fund: iNum_(d.get('fund', r)),
      annual: iNum_(d.get('annual', r)),
      modal: iNum_(d.get('modal', r)),
      billMode: String(d.get('billMode', r)).trim(),
      billType: String(d.get('billType', r)).trim(),
      overdue: iNum_(d.get('overdue', r)),
      suspense: susp,
      agent: String(d.get('agent', r)).trim(),
      agentId: iCode_(d.get('agentId', r)),
      agentActive: !isOrphan,
      unit: String(d.get('unit', r)).trim(),
      city: String(d.get('city', r)).trim(),
      phone: iPhone_(d.get('c1', r)) || iPhone_(d.get('c2', r)) || iPhone_(d.get('c3', r)),
      email: iEmail_(d.get('email', r)),
      convertible: /CNV(?!.*NCNV)/.test(plan.toUpperCase()) && plan.toUpperCase().indexOf('NCNV') === -1
    };

    /* Every in-force record is kept for cross-sell, which cares about what a
       client holds whether or not anything is maturing. Maturity and expiry
       take only what falls inside their horizons. */
    all.push(rec);
    if (monthsOut === null) continue;
    if (cls === 'term' || cls === 'benefit') {
      if (monthsOut <= horizonE) exp.push(rec);
    } else if (monthsOut <= horizonM) {
      mat.push(rec);
    }
  }

  mat.sort(function (a, b) { return a.months - b.months; });
  exp.sort(function (a, b) { return a.months - b.months; });

  function window_(list, months) { return list.filter(function (x) { return x.months <= months; }); }
  function sum(list, key) { return list.reduce(function (t, x) { return t + x[key]; }, 0); }

  var retire = mat.filter(function (x) { return x.cls === 'retirement'; });
  var lifeM  = mat.filter(function (x) { return x.cls === 'life'; });

  return {
    byClass: byClass,
    suspense: suspense, suspenseCases: suspenseCases,
    fundHeld: fundHeld, orphaned: orphaned, noFunds3: noFunds3,
    byAgentTotals: byAgentTotals,
    retirement: {
      total: retire.length,
      w12: window_(retire, 12).length, w24: window_(retire, 24).length, w60: retire.length,
      fund12: sum(window_(retire, 12), 'fund'), fund24: sum(window_(retire, 24), 'fund'),
      fund60: sum(retire, 'fund'),
      rows: retire
    },
    life: {
      total: lifeM.length,
      w12: window_(lifeM, 12).length, w24: window_(lifeM, 24).length, w60: lifeM.length,
      sum12: sum(window_(lifeM, 12), 'sumInsured'), sum24: sum(window_(lifeM, 24), 'sumInsured'),
      sum60: sum(lifeM, 'sumInsured'),
      rows: lifeM
    },
    note: 'Sums insured here are life cover only. Personal accident and critical ' +
          'illness plans are counted under Expiry, never in a cover total — ' +
          'neither is payable on death.',
    expiry: iShapeExpiry_(exp, window_, sum),
    all: all
  };
}

function iShapeExpiry_(exp, window_, sum) {
  var term = exp.filter(function (x) { return x.cls === 'term'; });
  var rider = exp.filter(function (x) { return x.cls === 'benefit'; });
  var conv = term.filter(function (x) { return x.convertible; });
  return {
    term: {
      total: term.length,
      w12: window_(term, 12).length, w24: window_(term, 24).length,
      w60: window_(term, 60).length, w120: term.length,
      cover24: sum(window_(term, 24), 'sumInsured'),
      cover60: sum(window_(term, 60), 'sumInsured'),
      cover120: sum(term, 'sumInsured'),
      rows: term
    },
    convertible: {
      total: conv.length,
      w24: window_(conv, 24).length, w60: window_(conv, 60).length,
      cover: sum(conv, 'sumInsured'),
      rows: conv
    },
    riders: {
      total: rider.length,
      w12: window_(rider, 12).length, w24: window_(rider, 24).length,
      rows: rider
    },
    note: 'Personal accident and critical illness benefits are listed here ' +
          'because they end, not because they pay a death claim. Their ' +
          'amounts are never added to a sum-assured total.'
  };
}

/* Mark every pending case with whether anybody is chasing it, and hand the
   pending domain its own count of the ones nobody is. The task rows keep the
   policy numbers they mention, so this is a lookup rather than a search. */
function iJoinChases_(out) {
  var t = out.tasks || {}, p = out.pending || {};
  if (t.error || p.error || !p.rows) return;
  var map = t.byPolicy || {};
  var never = 0, live = 0, wentQuiet = 0;

  p.rows.forEach(function (row) {
    var hits = map[row.policy] || [];
    var openHits = hits.filter(function (h) { return h.open; });
    row.chases = hits.length;
    row.liveChase = openHits.length;

    if (!hits.length) {
      /* No task of any kind has ever named this policy. */
      row.chase = 'never';
      row.chasedBy = ''; row.chasedOn = '';
      never++;
      return;
    }
    /* Whoever touched it most recently is the person to ask. */
    var pool = openHits.length ? openHits : hits;
    var latest = pool.slice().sort(function (a, b) { return String(b.on).localeCompare(String(a.on)); })[0];
    row.chasedBy = latest.assigned;
    row.chasedOn = latest.on;
    if (openHits.length) { row.chase = 'live'; live++; }
    else { row.chase = 'closed'; wentQuiet++; }
  });

  /* Three different states, because they need three different actions: raise a
     task, wait, or find out why the last one was closed with the case still
     open. Collapsing them into one "unchased" number hides the difference. */
  p.chaseNever = never;
  p.chaseLive = live;
  p.chaseClosed = wentQuiet;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE SAME PERSON, TWO NAMES
   The extracts disagree about what an agent is called, and not just in spelling.
   The dues sheet books business against the person — "Gary Sookdeo". The
   in-force book services it against their agency — "GARY SOOKDEO INSURANCE
   SOLUTIONS LTD". Strip the company words and those two still meet.

   Three do not, and they are the branch's three most senior people:

     A00427   ADVANCED INVESTMENTS MANAGEMENT LIMITED   is Ricky Rampersad
     A01363   ARCHITECTS FOR INSURANCE & FINANCIAL...   is Kerwyn Ramroach
     A06869   EXPERT ADVISORS COMPANY LTD               is Akaash Kalladeen

   No amount of name cleverness gets from "Ricky Rampersad" to "Advanced
   Investments Management Limited". Before this, each of them saw their dues
   book (booked under their own name) and none of their in-force book — no
   maturities, no expiring cover, no cross-sell leads, and a fund-held figure
   of zero against a real TT$3.5m. Their monthly e-mails went out empty.

   The agent code is what joins them, and the workbook holds both halves: the
   in-force book has code → agency name, the access list has code → person.
   Joining those two gives an alias group per person, built fresh every night,
   so a company Guardian adds next year needs nothing typed in here.
   ══════════════════════════════════════════════════════════════════════════ */

function iBuildAliases_(inforceRows) {
  var byCode = {};
  function put(code, name) {
    code = iCode_(code);
    name = String(name || '').trim();
    if (!code || !name || !iNameKey_(name)) return;
    if (!byCode[code]) byCode[code] = {};
    byCode[code][name] = 1;
  }

  /* Half one: the in-force book, where the name is usually the agency. */
  (inforceRows || []).forEach(function (r) { put(r.agentId, r.agent); });

  /* Half two: the access lists, where the name is the person. Both the
     "Agent Number" column and the "A00427 - Ricky Rampersad" prefix form are
     read, because the branch's two access tabs each use only one of them. */
  iAccessTabs_().forEach(function (sh) {
    var head = iHeaders_(sh), last = sh.getLastRow();
    if (last < 2) return;
    var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    var cName = iCol_(head, ['name']),
        cAgent = iCol_(head, ['agent name (exactly as in data)', 'agent name']),
        cNum = iCol_(head, ['agent number', 'agent id', 'agentid']);
    vals.forEach(function (row) {
      var nm = cName >= 0 ? String(row[cName]).trim() : '';
      var id = iIdentity_(nm, cAgent >= 0 ? row[cAgent] : '', cNum >= 0 ? row[cNum] : '');
      if (!id.agentId) return;
      put(id.agentId, id.agentName);
      put(id.agentId, id.display);
    });
  });

  /* A code with only one name tells us nothing we did not already know. */
  var groups = [];
  Object.keys(byCode).forEach(function (code) {
    var names = Object.keys(byCode[code]);
    if (names.length < 2) return;
    groups.push({ code: code, names: names });
  });
  return groups;
}

/* Name → group index, so a match is a lookup rather than a scan. */
function iAliasIndex_(groups) {
  var idx = {};
  (groups || []).forEach(function (g, i) {
    g.names.forEach(function (n) {
      var k = iNameKey_(n);
      if (k) idx[k] = i;
    });
  });
  return idx;
}

/* ══════════════════════════════════════════════════════════════════════════
   WHAT MOVED OVERNIGHT
   The rebuild sees the book fresh every night and has no memory of yesterday,
   so a policy that slid from overdue to lapsed looks exactly like one that was
   always lapsed. Nobody notices, and by the time anybody does, the
   reinstatement window is shorter.

   So each rebuild leaves behind a fingerprint — policy number against status —
   and the next one compares. What comes out is the only genuinely urgent list
   in this whole app: what changed while nobody was looking.

   The fingerprint is stored on a hidden tab rather than in Script Properties,
   which caps at 9 KB and would truncate silently at about a tenth of this book.
   ══════════════════════════════════════════════════════════════════════════ */

var INTEL_STATE_TAB = '_Intel State';

function iSaveState_(map) {
  var json = JSON.stringify(map);
  var chunks = [];
  for (var i = 0; i < json.length; i += INTEL.CACHE_CHUNK) chunks.push([json.substr(i, INTEL.CACHE_CHUNK)]);
  var sh = iSheet_(INTEL_STATE_TAB, ['state']);
  sh.clear();
  sh.getRange(1, 1).setValue('STATE/1 chunks=' + chunks.length + ' len=' + json.length +
                             ' at=' + Utilities.formatDate(new Date(), iTz_(), 'yyyy-MM-dd HH:mm'));
  if (chunks.length) sh.getRange(2, 1, chunks.length, 1).setValues(chunks);
  sh.hideSheet();
}

function iLoadState_() {
  var sh = iSs_().getSheetByName(INTEL_STATE_TAB);
  if (!sh || sh.getLastRow() < 2) return null;
  var manifest = String(sh.getRange(1, 1).getValue());
  var m = manifest.match(/len=(\d+)/);
  var json = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0]); }).join('');
  if (m && json.length !== +m[1]) return null;   // truncated — treat as no history
  try { return JSON.parse(json); } catch (e) { return null; }
}

/* Compact on purpose: one letter per policy, because 20,392 keys is already a
   third of a megabyte and this is compared, never read by a person.
     P premium paying / clean   O overdue   L lapsed   U underwriting pending
     N pending business         G gone (surrendered, matured, died, closed)   */
function iFingerprint_(out) {
  var st = {};
  (out.__duesAll || []).forEach(function (r) { st['d' + r.policy] = r.code; });
  ((out.pending || {}).rows || []).forEach(function (r) { st['n' + r.policy] = 'N'; });
  return st;
}

function iBuildMovements_(out) {
  var now = iFingerprint_(out);
  var was = iLoadState_();
  iSaveState_(now);

  if (!was) {
    return { first: true, note: 'This is the first night with a fingerprint to compare. ' +
             'Movements appear from tomorrow.' };
  }

  var lapsed = [], slipped = [], cleared = [], newPending = [], donePending = [], vanished = [];
  var index = {};
  (out.__duesAll || []).forEach(function (r) { index['d' + r.policy] = r; });
  ((out.pending || {}).rows || []).forEach(function (r) { index['n' + r.policy] = r; });

  Object.keys(now).forEach(function (k) {
    var before = was[k], after = now[k];
    if (before === after || before === undefined) return;
    var row = index[k] || {};
    if (after === 'L' && before !== 'L') lapsed.push(row);
    else if (after === 'O' && (before === 'P' || before === undefined)) slipped.push(row);
    else if (after === 'P' && (before === 'O' || before === 'L')) cleared.push(row);
  });

  /* A key present tonight and absent last night is new; the other way round is
     a policy that left the extract entirely, which is worth knowing about
     because it is usually a surrender nobody mentioned. */
  Object.keys(now).forEach(function (k) {
    if (was[k] !== undefined) return;
    if (k.charAt(0) === 'n') newPending.push(index[k] || {});
  });
  Object.keys(was).forEach(function (k) {
    if (now[k] !== undefined) return;
    if (k.charAt(0) === 'n') donePending.push({ policy: k.slice(1) });
    else vanished.push({ policy: k.slice(1), was: was[k] });
  });

  return {
    first: false,
    since: 'the last rebuild',
    lapsed: lapsed.slice(0, 400),
    slipped: slipped.slice(0, 400),
    cleared: cleared.slice(0, 400),
    newPending: newPending.slice(0, 200),
    donePending: donePending.slice(0, 200),
    vanished: vanished.slice(0, 200),
    counts: {
      lapsed: lapsed.length, slipped: slipped.length, cleared: cleared.length,
      newPending: newPending.length, donePending: donePending.length, vanished: vanished.length
    }
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   CROSS-SELL
   Not "everyone could buy more" — that is a mailing list, not a lead. Each
   rule below names a specific gap in what a client already holds, measured on
   the in-force book, and says what the conversation is.

   Measured on the branch's own 2,153 clients before any of it was written:

     1,780 of them (83%) hold exactly one policy
     1,249 hold life cover and no retirement plan
       357 hold a retirement fund and no death benefit at all
       311 hold term cover and nothing permanent
     1,963 (91%) hold no critical illness or personal accident benefit

   ONE HONEST LIMIT, AND IT IS ON EVERY SCREEN THAT SHOWS THIS.
   These gaps are gaps *in this branch's in-force book*. A client shown as
   having no retirement plan may hold one with another company, another
   branch, or through their employer. The list is a prompt to ask, never a
   statement about the client's affairs — and an adviser who opens with "you
   have no retirement plan" instead of "do you have one anywhere else?" will
   be wrong roughly as often as the branch's share of that client's wallet.
   ══════════════════════════════════════════════════════════════════════════ */

var IXSELL_RULES = [
  {
    id: 'protection-gap',
    short: 'No death benefit',
    title: 'Saving for retirement with no death benefit',
    needs: function (h) { return h.retirement && !h.life && !h.term; },
    why: 'They are building a fund and their family has no sum assured behind it. ' +
         'If they die before it matures, their people get the fund balance — not a cover amount.',
    ask: 'What happens to this plan, and to them, if you are not here to finish it?',
    size: function (c) { return c.fund; },
    sizeLabel: 'fund with no cover behind it',
    bestAge: [25, 60],
    weight: 40,
    kind: 'lead'
  },
  {
    id: 'term-only',
    short: 'Term only',
    title: 'Term cover only — nothing permanent',
    needs: function (h) { return h.term && !h.life && !h.retirement; },
    why: 'The cover ends on a date. Nothing here pays out if they outlive it, and the ' +
         'premium climbs steeply at renewal — if the plan renews at all.',
    ask: 'Do you know the date this cover stops, and what it costs to replace it then?',
    size: function (c) { return c.sumInsured; },
    sizeLabel: 'cover with an end date',
    bestAge: [40, 65],
    weight: 32,
    kind: 'lead'
  },
  {
    id: 'conversion-window',
    short: 'Conversion closing',
    title: 'Conversion right closing',
    needs: function (h, c) { return c.convertible && c.convertibleMonths <= 60; },
    why: 'They can move to permanent cover with no evidence of health until the term ends. ' +
         'After that a medical decides, and they will be older.',
    ask: 'You have a right here most people never hear about. Shall I show you what it is worth?',
    size: function (c) { return c.sumInsured; },
    sizeLabel: 'convertible without a medical',
    bestAge: [0, 200],
    weight: 38,
    kind: 'lead'
  },
  {
    id: 'money-in-motion',
    short: 'Money in motion',
    title: 'Money coming out within two years',
    needs: function (h, c) { return c.maturingMonths !== null && c.maturingMonths <= 24; },
    why: 'A maturity is the one moment a client has a lump sum and a decision. Whoever is in ' +
         'the room when it lands keeps it.',
    ask: 'This matures in ' + '', // filled per client below
    size: function (c) { return c.maturingValue; },
    sizeLabel: 'maturing',
    bestAge: [0, 200],
    weight: 36,
    kind: 'lead'
  },
  {
    id: 'retirement-gap',
    short: 'Not saving',
    title: 'Protected, but not saving',
    needs: function (h) { return (h.life || h.term) && !h.retirement; },
    why: 'Their family is covered if they die. Nothing here is building anything if they live, ' +
         'and they are already paying premiums every month, so affordability is proven.',
    ask: 'Everything you hold pays out if the worst happens. What is working for you if it does not?',
    size: function (c) { return c.annual; },
    sizeLabel: 'already paid a year',
    bestAge: [25, 55],
    weight: 22,
    kind: 'campaign'
  },
  {
    id: 'living-benefit',
    short: 'No living benefit',
    title: 'No critical illness or accident benefit',
    needs: function (h) { return !h.benefit && (h.life || h.term || h.retirement); },
    why: 'Everything they hold pays on death. Nothing pays on the diagnosis or the accident ' +
         'they are far more likely to survive — and which costs money while they do.',
    ask: 'You are covered if you die. What covers you if you live through something expensive?',
    size: function (c) { return c.annual; },
    sizeLabel: 'already paid a year',
    bestAge: [30, 55],
    weight: 18,
    kind: 'campaign'
  }
];

function iBuildCrossSell_(today, inforceRows) {
  if (!inforceRows || !inforceRows.length) {
    return { error: 'The in-force book is needed to find cross-sell gaps and was not read.' };
  }

  /* One entry per client, holding everything they have with this branch. */
  var byClient = {};
  inforceRows.forEach(function (r) {
    var id = r.clientId || ('name:' + iNameKey_(r.client));
    if (!id) return;
    if (!byClient[id]) {
      byClient[id] = {
        clientId: r.clientId, client: r.client, age: r.age, city: r.city,
        phone: '', email: '', agent: r.agent, agentId: r.agentId, agentActive: r.agentActive,
        policies: 0, annual: 0, sumInsured: 0, fund: 0, worstOverdue: 0,
        holds: { life: false, term: false, retirement: false, benefit: false },
        plans: [], convertible: false, convertibleMonths: null,
        maturingMonths: null, maturingValue: 0
      };
    }
    var c = byClient[id];
    c.policies++;
    c.annual += r.annual;
    c.sumInsured += r.sumInsured;
    c.fund += r.fund;
    c.worstOverdue = Math.max(c.worstOverdue, r.overdue);
    if (r.cls !== 'unclassified') c.holds[r.cls] = true;
    if (c.plans.indexOf(r.plan) === -1) c.plans.push(r.plan);
    if (!c.phone && r.phone) c.phone = r.phone;
    if (!c.email && r.email) c.email = r.email;
    if (c.age === null || c.age === undefined) c.age = r.age;

    if (r.convertible && (c.convertibleMonths === null || r.months < c.convertibleMonths)) {
      c.convertible = true;
      c.convertibleMonths = r.months;
    }
    /* Only a maturity that actually pays the client counts as money in motion —
       a term policy reaching its end date pays nobody. */
    if ((r.cls === 'retirement' || r.cls === 'life') &&
        (c.maturingMonths === null || r.months < c.maturingMonths)) {
      c.maturingMonths = r.months;
      c.maturingValue = r.cls === 'retirement' ? r.fund : r.sumInsured;
    }
  });

  var leads = [], byRule = {}, holdsCount = {};
  Object.keys(byClient).forEach(function (id) {
    var c = byClient[id];
    var key = [c.holds.life ? 'life' : '', c.holds.term ? 'term' : '',
               c.holds.retirement ? 'retirement' : '', c.holds.benefit ? 'benefit' : '']
              .filter(String).join('+') || '(none)';
    holdsCount[key] = (holdsCount[key] || 0) + 1;

    /* Every rule a client trips is counted, because that is the campaign
       figure — but the client appears ONCE on the call list, under their
       strongest reason. A name repeated six times is a list nobody works. */
    var hits = [];
    IXSELL_RULES.forEach(function (rule) {
      if (!rule.needs(c.holds, c)) return;
      var score = iXsellScore_(rule, c);
      byRule[rule.id] = (byRule[rule.id] || 0) + 1;
      if (score.total <= 0) return;
      hits.push({ rule: rule, score: score });
    });
    if (!hits.length) return;
    hits.sort(function (a, b) { return b.score.total - a.score.total; });

    /* The wording — title, why, the opening question — is identical for every
       client under a rule, so it travels once in `rules` below and the row
       carries only the id. Repeating it on 2,000 rows cost a megabyte and a
       half of the response for nothing. */
    var best = hits[0], rule = best.rule;
    leads.push({
      rule: rule.id,
      askOverride: rule.id === 'money-in-motion'
        ? 'This matures in ' + c.maturingMonths + ' months. Shall we plan where it goes before it lands?'
        : '',
      allRules: hits.map(function (h) { return h.rule.id; }),
      clientId: c.clientId, client: c.client, age: c.age, city: c.city,
      agent: c.agent, agentId: c.agentId, agentActive: c.agentActive,
      phone: c.phone, email: c.email,
      policies: c.policies,
      annual: c.annual, size: rule.size(c) || 0,
      holds: key, overdue: c.worstOverdue,
      score: best.score.total, reasons: best.score.reasons
    });
  });

  /* Highest score first, and within a score the largest number attached. A
     lead list nobody can get to the bottom of is ranked or it is useless. */
  leads.sort(function (a, b) { return (b.score - a.score) || (b.size - a.size); });

  function band(lo, hi) {
    return leads.filter(function (l) { return l.score >= lo && l.score <= hi; }).length;
  }

  return {
    clients: Object.keys(byClient).length,
    leads: leads.length,
    thisWeek: band(80, 100),
    worthACall: band(60, 79),
    keepOnFile: band(1, 59),
    byRule: IXSELL_RULES.map(function (r) {
      return { id: r.id, title: r.title, kind: r.kind, n: byRule[r.id] || 0 };
    }).filter(function (r) { return r.n; }),
    /* Said once. Every row points at one of these by id. */
    rules: IXSELL_RULES.reduce(function (m, r) {
      /* `short` is for the table, where a three-line title turns a call list
         into four rows a screen. `title` is for e-mail and the gaps summary,
         where the room exists to say it properly. */
      m[r.id] = { title: r.title, short: r.short, why: r.why, ask: r.ask,
                  kind: r.kind, sizeLabel: r.sizeLabel };
      return m;
    }, {}),
    holds: holdsCount,
    rows: leads.slice(0, 2500),
    caveat: 'These are gaps in THIS branch\'s in-force book. A client shown without a ' +
            'retirement plan may hold one elsewhere. Open by asking, never by telling.'
  };
}

/* Scored out of 100, and the parts are deliberately unequal: how sharp the gap
   is (up to 40) matters, but being able to reach somebody who is paid up and
   the right age matters just as much, because that is what makes a call happen.

   Two conditions score zero rather than low, because they are not leads at all:
   nobody the branch can contact, and anybody behind on what they already hold.
   Pitching a client who is in arrears is how a branch loses both sales.

   The reasons come back with the number so an adviser can see why a name is
   near the top instead of being asked to trust a score. */
function iXsellScore_(rule, c) {
  var total = rule.weight, reasons = [];

  if (!c.phone && !c.email) return { total: 0, reasons: ['no way to reach them'] };
  if (c.worstOverdue > 30) return { total: 0, reasons: ['behind on existing premiums — this is a collections call'] };

  if (c.phone) { total += 20; reasons.push('phone on file'); }
  else { total += 8; reasons.push('e-mail only'); }

  if (c.worstOverdue <= 0) { total += 15; reasons.push('paid up to date'); }
  else { total += 5; reasons.push('slightly behind (' + Math.round(c.worstOverdue) + ' days)'); }

  if (c.age === null || c.age === undefined) { reasons.push('date of birth not on file'); }
  else if (c.age >= rule.bestAge[0] && c.age <= rule.bestAge[1]) {
    total += 15; reasons.push('age ' + c.age + ' suits this');
  } else { reasons.push('age ' + c.age + ' is outside the usual band'); }

  if (c.annual >= 12000) { total += 10; reasons.push('pays ' + iMoney_(c.annual) + ' a year already'); }
  else if (c.annual >= 6000) { total += 6; reasons.push('pays ' + iMoney_(c.annual) + ' a year already'); }
  else if (c.annual >= 3000) { total += 3; }

  if (c.policies >= 2) { total += 5; reasons.push(c.policies + ' policies — an established relationship'); }
  if (!c.agentActive) { total -= 8; reasons.push('servicing agent is not active'); }

  return { total: Math.max(0, Math.min(100, Math.round(total))), reasons: reasons };
}

/* ══════════════════════════════════════════════════════════════════════════
   HOW OLD IS EACH SOURCE
   Every figure in this app is only as current as the extract under it, and the
   extracts do not refresh together. On the day this was written the
   requirements tab was a day old and the Salesforce task export was sixty-one
   — so "10 cases being chased" was being read off two-month-old data with
   nothing on screen to say so.

   WHAT THIS MEASURES, EXACTLY. Not when the tab was refreshed — a spreadsheet
   does not record that per tab — but the newest business event in it, read
   from a column that only ever looks backwards. Issue dates, dispatch dates,
   the date a requirement was raised. A tab refreshed this morning whose branch
   genuinely wrote nothing for a fortnight will read as a fortnight old, and
   that is the honest limit of the measure: it says "nothing here has happened
   in N days", which is either a stale extract or a quiet fortnight, and either
   one is worth knowing before quoting the number.

   Forward-looking columns are useless for this and are deliberately excluded.
   Paid To Date is what cover is paid up TO — its maximum sits in 2028.
   ══════════════════════════════════════════════════════════════════════════ */

var INTEL_SOURCES = [
  { key: 'dues',     label: 'Branch Portfolio — premium dues',   tab: iTabDues_,
    cols: ['issue date', 'app received date'],
    feeds: 'the chase list, the ageing bands and the billing-method rates' },
  { key: 'inforce',  label: 'Export — the in-force book',        tab: iTabInforce_,
    cols: ['dispatch date', 'acknowledgement date', 'policy effective date'],
    feeds: 'maturities, expiring cover, cross-sell and every fund figure' },
  { key: 'pending',  label: 'Requirement Management — pending',  tab: iTabPending_,
    cols: ['reqtdt', 'submitdt'],
    feeds: 'pending business and the suspense held' },
  { key: 'reqs',     label: 'URPPBIEX — requirements',           tab: iTabReqs_,
    cols: ['added_date', 'ordered_date', 'closed_date'],
    feeds: 'outstanding requirements and their ages' },
  { key: 'settled',  label: 'Branch Settlement — production',    tab: iTabSettled_,
    cols: ['effective_dt', 'pol_app_recv_dt'], dayFirst: true,
    feeds: 'everything on the Production screen' },
  /* RR_UWPRO_MAGNUM carries no date of its own — its recency is only visible
     through the dues book it joins to, which is already measured above. */
  { key: 'tasks',    label: 'SFTASK MGT — the chase log',        tab: iTabTasks_,
    cols: ['last modified date', 'date'],
    feeds: 'who is chasing which pending case' }
];

function iBuildFreshness_(today) {
  return INTEL_SOURCES.map(function (src) {
    var sh;
    try { sh = src.tab(); } catch (e) { sh = null; }
    if (!sh) return { key: src.key, label: src.label, feeds: src.feeds, missing: true };

    var head = iHeaders_(sh), last = sh.getLastRow();
    var best = null, via = '';
    if (last > 1) {
      src.cols.forEach(function (c) {
        var i = iCol_(head, [c]);
        if (i < 0) return;
        var vals = sh.getRange(2, i + 1, last - 1, 1).getValues();
        for (var r = 0; r < vals.length; r++) {
          var d = iDate_(vals[r][0], src.dayFirst);
          /* A date in the future is a promise, not an event — it cannot say
             anything about how recently this tab was filled. */
          if (d && d <= today && (!best || d > best)) { best = d; via = head[i]; }
        }
      });
    }
    return {
      key: src.key, label: src.label, feeds: src.feeds,
      tab: sh.getName(), rows: Math.max(0, last - 1),
      newest: iIso_(best), via: via,
      ageDays: best ? iDays_(best, today) : null
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   WHAT THE BRANCH ACTUALLY WROTE
   Every other screen in this app is about something going wrong — arrears,
   lapses, cases stuck, requirements nobody chased. None of it says what the
   branch sold. An agent could work here all year and never see a number that
   went their way.

   The settlement extract closes that. Three things about it decide whether
   the figures come out right:

   COUNT IS A FLAG, NOT A QUANTITY. 1 on the base coverage, 0 on each rider
   attached to it, -1 on a reversal. So applications are the SUM of the
   column, not the row count: August is 126 rows and 70 apps.

   THE TAB CARRIES ITS OWN TOTAL ROW. One row reads EFFECTIVE_DT "Total" with
   COUNT 742 and no policy. Including it doubles the year. It is dropped here,
   and the sum of what remains is checked against it — 742 either way, and the
   API agrees to a cent.

   A00427 AND U00427 ARE ONE PERSON. Guardian writes agent codes both ways and
   four agents appear under both, so grouping on the raw code split Varun
   Seegolam's August into 296,745 and 65,393 when he had written 362,138.
   iCode_ folds every code before it is used as a key.
   ══════════════════════════════════════════════════════════════════════════ */

function iBuildProduction_(today) {
  var sh = iTabSettled_();
  if (!sh) return { error: 'No settlement tab found (needs API_AMT, COUNT, YEAR, MONTH).' };

  var d = iReadCols_(sh, {
    eff: ['effective_dt'], branch: ['agent_branch'], agentId: ['agt_id'],
    policy: ['pol_id'], cvg: ['cvg_id'], plan: ['plan_id_base'],
    face: ['face_amt'], recv: ['pol_app_recv_dt'], count: ['count'],
    api: ['api_amt'], year: ['year'], month: ['month'],
    clientId: ['cli_id'], first: ['client first name'], last: ['client last name']
  });

  var thisYear = today.getFullYear();
  var byMonth = {}, byAgent = {}, rows = [];
  var apps = 0, api = 0, face = 0, sheetTotal = null, dropped = 0;

  for (var r = 0; r < d.rows; r++) {
    var eff = String(d.get('eff', r)).trim();
    var yr = String(d.get('year', r)).trim();
    var mo = String(d.get('month', r)).trim();

    /* The tab's own total row, and the filter caption beneath it. */
    if (/^total$/i.test(eff) || /^applied filters/i.test(eff)) {
      if (/^total$/i.test(eff)) sheetTotal = { apps: iNum_(d.get('count', r)), api: iNum_(d.get('api', r)) };
      dropped++; continue;
    }
    if (!yr || !/^\d+$/.test(mo)) { dropped++; continue; }
    if (+yr !== thisYear) continue;

    var n = iNum_(d.get('count', r));
    var a = iNum_(d.get('api', r));
    var f = iNum_(d.get('face', r));
    var code = iCode_(d.get('agentId', r));
    var m = +mo;

    apps += n; api += a; face += f;

    if (!byMonth[m]) byMonth[m] = { month: m, apps: 0, api: 0, face: 0, policies: {} };
    byMonth[m].apps += n; byMonth[m].api += a; byMonth[m].face += f;
    var pol = String(d.get('policy', r)).trim();
    if (pol) byMonth[m].policies[pol] = 1;

    if (!byAgent[code]) byAgent[code] = { agentId: code, agent: '', apps: 0, api: 0, face: 0, months: {} };
    byAgent[code].apps += n; byAgent[code].api += a; byAgent[code].face += f;
    byAgent[code].months[m] = (byAgent[code].months[m] || 0) + a;

    /* Only the rows that count as an application are worth listing — the
       rider rows carry the same client and would read as duplicates. */
    if (n !== 0) {
      rows.push({
        agentId: code, month: m,
        settled: iIso_(iDate_(d.get('eff', r), true)),
        received: iIso_(iDate_(d.get('recv', r), true)),
        policy: pol, plan: String(d.get('plan', r)).trim(),
        client: [String(d.get('first', r)).trim(), String(d.get('last', r)).trim()]
                  .filter(String).join(' '),
        clientId: String(d.get('clientId', r)).trim(),
        branch: String(d.get('branch', r)).trim(),
        apps: n, api: a, face: f,
        reversal: n < 0
      });
    }
  }

  /* Names come from the alias table's own sources, so a company-coded agent
     shows as the person. */
  var codeName = iCodeNames_();
  Object.keys(byAgent).forEach(function (c) { byAgent[c].agent = codeName[c] || c; });
  rows.forEach(function (x) { x.agent = codeName[x.agentId] || x.agentId; });

  var months = Object.keys(byMonth).map(function (k) {
    var m = byMonth[k];
    m.policies = Object.keys(m.policies).length;
    m.perApp = m.apps ? m.api / m.apps : 0;
    return m;
  }).sort(function (a, b) { return a.month - b.month; });

  var agents = Object.keys(byAgent).map(function (c) { return byAgent[c]; })
    .sort(function (a, b) { return b.api - a.api; });

  rows.sort(function (a, b) { return String(b.settled).localeCompare(String(a.settled)); });

  var best = months.reduce(function (m, x) { return !m || x.api > m.api ? x : m; }, null);
  var worst = months.reduce(function (m, x) { return !m || x.api < m.api ? x : m; }, null);
  var latest = months.length ? months[months.length - 1] : null;

  return {
    year: thisYear,
    apps: apps, api: api, face: face,
    avgApp: apps ? api / apps : 0,
    monthlyAvg: months.length ? api / months.length : 0,
    months: months, byAgent: agents, rows: rows.slice(0, 1200),
    best: best, worst: worst, latest: latest,
    /* The tab totals its own column; agreeing with it is the check that the
       total row was excluded exactly once and nothing else was. */
    reconciles: sheetTotal ? (Math.round(sheetTotal.apps) === Math.round(apps) &&
                              Math.abs(sheetTotal.api - api) < 1) : null,
    sheetTotal: sheetTotal, droppedRows: dropped,
    basis: 'Applications are the sum of the COUNT column, which is a flag: 1 on ' +
           'the base coverage, 0 on each rider, -1 on a reversal. API is annual ' +
           'premium as the extract reports it.'
  };
}

/* Agent code to the person's name, from the same two halves the alias table
   joins — the access list for people, the in-force book for agencies. */
function iCodeNames_() {
  var out = {};
  iAccessTabs_().forEach(function (sh) {
    var head = iHeaders_(sh), last = sh.getLastRow();
    if (last < 2) return;
    var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    var cName = iCol_(head, ['name']),
        cAgent = iCol_(head, ['agent name (exactly as in data)', 'agent name']),
        cNum = iCol_(head, ['agent number', 'agent id', 'agentid']);
    vals.forEach(function (row) {
      var id = iIdentity_(cName >= 0 ? row[cName] : '',
                          cAgent >= 0 ? row[cAgent] : '',
                          cNum >= 0 ? row[cNum] : '');
      if (id.agentId && id.display && !out[id.agentId]) out[id.agentId] = id.display;
    });
  });
  var inf = iTabInforce_();
  if (inf) {
    var di = iReadCols_(inf, { id: ['servicing agent id'],
                               nm: ['servcing agent name', 'servicing agent name'] });
    for (var r = 0; r < di.rows; r++) {
      var c = iCode_(di.get('id', r)), n = String(di.get('nm', r)).trim();
      if (c && n && !out[c]) out[c] = n;
    }
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   WHY HALF THE WORK EXISTS
   The pending desk, the 1,425 open requirements and everything Sasha and
   Azariah chase all begin at the same place: a case that did not go through
   first time. Only 40% of this branch's submissions are accepted as they
   stand. The other 60% come back, and that coming back IS the backlog.

   Nothing measured it, because the decisions sit in their own tab and nobody
   joined it up. Five columns, no dates, no agent — but the policy number
   joins to the dues book at 99%, which supplies both.

   MEASURED ON THE CURRENT YEAR, NOT ALL FOUR. A decision from 2023 says
   nothing about how somebody prepares a case today, and the two views
   genuinely disagree: one agent sits at 33% across four years and 8% across
   this one. The all-time figures are kept for context and clearly labelled,
   but the coachable number is this year's.

   And the direction is the wrong way. Straight-through ran 39%, 39%, 42% and
   is 36% so far in 2026, with referrals up from 43% to 46% — the backlog is
   being fed faster this year than last.
   ══════════════════════════════════════════════════════════════════════════ */

var IUW_MIN_CASES = 10;   /* below this an agent's rate is noise, not a signal */

function iBuildUnderwriting_(today) {
  var sh = iTabMagnum_();
  if (!sh) return { error: 'No underwriting tab found (needs overall_decision_code, policy_number).' };
  var dues = iTabDues_();
  if (!dues) return { error: 'The dues book is needed to date a decision and attach an agent.' };

  /* The decision tab carries neither a date nor an agent. Both come from the
     dues book, which holds every policy the branch has. */
  var dd = iReadCols_(dues, {
    number: ['number'], agent: ['agent'], recv: ['app received date'],
    issue: ['issue date'], plan: ['plan code'], client: ['client'],
    sumAssured: ['sum assured'], premium: ['premium']
  });
  var pol = {};
  for (var i = 0; i < dd.rows; i++) {
    var num = dd.get('number', i);
    if (iBadNumber_(num)) continue;
    var key = String(num).trim();
    if (!key || pol[key]) continue;
    pol[key] = {
      agent: String(dd.get('agent', i)).trim(),
      recv: iDate_(dd.get('recv', i)),
      plan: String(dd.get('plan', i)).trim(),
      client: String(dd.get('client', i)).trim(),
      sumAssured: iNum_(dd.get('sumAssured', i)),
      premium: iNum_(dd.get('premium', i))
    };
  }

  var d = iReadCols_(sh, {
    policy: ['policy_number'], code: ['overall_decision_code'],
    desc: ['overall_decision_code_description'], id: ['magnum_decision_id']
  });

  var thisYear = today.getFullYear();
  var mixAll = {}, mixYear = {}, byYear = {}, byAgent = {}, rows = [];
  var total = 0, dated = 0, yearTotal = 0, seen = {};

  for (var r = 0; r < d.rows; r++) {
    var p = String(d.get('policy', r)).trim();
    var code = String(d.get('code', r)).trim();
    if (!p || !code) continue;
    var id = String(d.get('id', r)).trim() || (p + code);
    if (seen[id]) continue;
    seen[id] = 1;
    total++;
    mixAll[code] = (mixAll[code] || 0) + 1;

    var info = pol[p];
    if (!info || !info.recv) continue;
    dated++;
    var y = info.recv.getFullYear();
    if (!byYear[y]) byYear[y] = { year: y, n: 0, std: 0, ref: 0, info: 0 };
    var b = byYear[y];
    b.n++;
    if (code === 'Standard') b.std++;
    if (code === 'Referred') b.ref++;
    if (code === 'Additional Information') b.info++;

    if (y !== thisYear) continue;
    yearTotal++;
    mixYear[code] = (mixYear[code] || 0) + 1;

    var a = info.agent || '(unattributed)';
    if (!byAgent[a]) byAgent[a] = { agent: a, n: 0, std: 0, ref: 0, info: 0, sa: [] };
    var ab = byAgent[a];
    ab.n++;
    if (code === 'Standard') ab.std++;
    if (code === 'Referred') ab.ref++;
    if (code === 'Additional Information') ab.info++;
    if (info.sumAssured > 0) ab.sa.push(info.sumAssured);

    rows.push({
      policy: p, code: code, agent: a,
      client: info.client, plan: info.plan,
      received: iIso_(info.recv),
      sumAssured: info.sumAssured, modal: info.premium,
      firstTime: code === 'Standard'
    });
  }

  rows.sort(function (x, y2) { return String(y2.received).localeCompare(String(x.received)); });

  function median(a) {
    if (!a.length) return 0;
    var s2 = a.slice().sort(function (x, y3) { return x - y3; });
    return s2[Math.floor(s2.length / 2)];
  }
  var agents = Object.keys(byAgent).map(function (k) {
    var v = byAgent[k];
    return { agent: v.agent, n: v.n, std: v.std, ref: v.ref, info: v.info,
             rate: v.n ? v.std / v.n : 0,
             back: v.n ? (v.ref + v.info) / v.n : 0,
             medianSA: median(v.sa) };
  }).filter(function (v) { return v.n >= IUW_MIN_CASES; })
    .sort(function (a, b2) { return a.rate - b2.rate; });

  var years = Object.keys(byYear).map(function (k) {
    var v = byYear[k];
    return { year: v.year, n: v.n, rate: v.n ? v.std / v.n : 0,
             refRate: v.n ? v.ref / v.n : 0 };
  }).filter(function (v) { return v.n >= 40; })
    .sort(function (a, b2) { return a.year - b2.year; });

  function mixRows(m, n) {
    return Object.keys(m).map(function (k) {
      return { code: k, n: m[k], share: n ? m[k] / n : 0 };
    }).sort(function (a, b2) { return b2.n - a.n; });
  }

  var stdYear = mixYear['Standard'] || 0;
  return {
    year: thisYear,
    total: total, dated: dated, yearTotal: yearTotal,
    rate: yearTotal ? stdYear / yearTotal : 0,
    rateAll: total ? (mixAll['Standard'] || 0) / total : 0,
    comeBack: yearTotal ? ((mixYear['Referred'] || 0) + (mixYear['Additional Information'] || 0)) / yearTotal : 0,
    mix: mixRows(mixYear, yearTotal),
    mixAll: mixRows(mixAll, total),
    years: years, byAgent: agents,
    minCases: IUW_MIN_CASES,
    rows: rows.slice(0, 1500),
    note: 'Rates are this year\'s. A decision from three years ago says nothing ' +
          'about how somebody prepares a case today, and the two views disagree — ' +
          'one agent sits at 33% across four years and 8% across this one.'
  };
}

/* ── Data health ──────────────────────────────────────────────────────────
   Shown on the front screen, not buried. Every figure this app reports is
   only as good as the extract underneath it, and the branch should be able
   to see the size of the doubt without asking anybody.                     */
function iBuildHealth_(out) {
  var items = [];

  /* Staleness first, because it changes what every other figure means. A tab
     nobody has refreshed is not a data defect — it is a report about a
     different week. */
  (out.freshness || []).forEach(function (f) {
    if (f.missing) {
      items.push({ severity: 'high', what: f.label + ' — tab not found', count: 0, of: null, pct: 0,
        why: 'The screens fed by this source (' + f.feeds + ') will be empty.',
        fix: 'Check the tab still carries its columns, or set the matching INTEL_TAB_* property.' });
      return;
    }
    if (f.ageDays === null || f.ageDays <= 14) return;
    items.push({
      severity: f.ageDays > 30 ? 'high' : 'medium',
      what: f.label + ' — nothing newer than ' + f.newest,
      count: f.ageDays, of: null, pct: 0,
      why: 'The newest ' + (f.via || 'dated record') + ' in this tab is ' + f.ageDays +
           ' days old, so ' + f.feeds + ' describe that date, not today. Either the extract ' +
           'has not been refreshed or the branch genuinely had no activity — both are worth ' +
           'knowing before the figure is quoted.',
      fix: 'Refresh the extract into this tab.'
    });
  });
  var dues = out.dues || {}, def = dues.defects || {}, counts = dues.counts || {};
  var n = counts.total || 0;

  function add(severity, what, count, of, why, fix) {
    items.push({ severity: severity, what: what, count: count, of: of,
                 pct: of ? count / of : 0, why: why, fix: fix });
  }

  if (def.sciNumber) add('high', 'Policy numbers lost to scientific notation', def.sciNumber, n,
    'Excel wrote a ten-digit policy number as 5.00E+09 on export. The digits are gone — these rows cannot be matched to a policy.',
    'Format the Number column as Plain text in the source export before it is pasted.');

  if (dues.basis) add('high', 'Premium cannot be annualised', n, n,
    'The Mode column is empty in every row, so a monthly instalment and an annual one are indistinguishable. Totals here are instalments, never annual premium.',
    'Add Mode (or Billing Frequency) to the export.');

  if (def.badPaidTo) add('medium', 'Paid To Date exported as ##########', def.badPaidTo, n,
    'A column too narrow at export. The date is not recoverable from this sheet.',
    'Widen the column, or export as CSV rather than copying from the screen.');

  if (def.badLapseDate) add('medium', 'Projected Lapse Date holds no usable date', def.badLapseDate, n,
    'Almost all of these read 30 Mar 1900 or 30 March 1900 — the spreadsheet epoch zero, an empty cell that looks like a date. A handful hold a status word (Lapsed, Converted) in the date column instead. Sorting on this column puts the real lapses last.',
    'Leave the cell blank when there is no projected date, and keep status words out of a date column.');

  if (def.spacedEmail) add('medium', 'E-mail addresses with a space inside them', def.spacedEmail, n,
    'NAME@GMAIL.CO M — a line wrap baked into the value. These bounce.',
    'Strip spaces on export; this app already ignores them when mailing.');

  if (def.unreachable) add('high', 'Chase-list clients with no phone and no e-mail', def.unreachable, dues.chaseCount || 0,
    'These premiums cannot be collected by any channel the branch has. They are the first thing to fix, not the last.',
    'Work the list in Dues → Unreachable and capture a contact.');

  var pend = out.pending || {};
  if (pend.chaseNever) add('high', 'Pending cases never chased', pend.chaseNever, pend.total,
    'No follow-up task of any kind — open or closed — has ever named these policies. They are not being worked; they are sitting, and they will keep sitting until somebody notices.',
    'Raise a follow-up task, or work them from Pending \u2192 Nobody is chasing these.');
  if (pend.chaseClosed) add('medium', 'Pending cases whose last chase was closed', pend.chaseClosed, pend.total,
    'Somebody chased these and closed the task, but the case is still pending. Either it was closed too early or the case moved and nobody updated it.',
    'Re-open the chase, or close the case.');

  var mat = out.maturity || {};
  if (mat.orphaned) add('medium', 'Policies whose servicing agent is inactive or vested', mat.orphaned, null,
    'Nobody is calling these clients. On a maturing policy that is a payout with no adviser attached.',
    'Reassign servicing on the Guardian record.');

  var reqs = out.reqs || {};
  if (reqs.overYear) add('high', 'Requirements open more than a year', reqs.overYear, reqs.openCount || 0,
    'Median open age is ' + (reqs.medianAge || 0) + ' days. Requirements this old are usually cases that died and were never closed off.',
    'Close what is dead so the live list is believable.');

  var unclass = (mat.byClass || {}).unclassified || 0;
  if (unclass) add('medium', 'In-force plans this app cannot classify', unclass, null,
    'A plan not in the classification table is never counted as life cover, retirement or term — it is left out of those totals rather than guessed at.',
    'Add the plan to IPLANS in Intelligence.gs from the product sheet.');

  var order = { high: 0, medium: 1, low: 2 };
  items.sort(function (a, b) { return order[a.severity] - order[b.severity] || b.count - a.count; });
  return { items: items, high: items.filter(function (x) { return x.severity === 'high'; }).length };
}

/* ── The cache ────────────────────────────────────────────────────────────
   One JSON document, split across cells because a cell holds 50,000
   characters. Row 1 is the manifest so a half-written cache is detectable
   rather than silently short.                                              */
function iSaveCache_(obj) {
  var json = JSON.stringify(obj);
  var chunks = [];
  for (var i = 0; i < json.length; i += INTEL.CACHE_CHUNK) chunks.push([json.substr(i, INTEL.CACHE_CHUNK)]);

  var sh = iSheet_(INTEL.CACHE_TAB, ['payload']);
  sh.clear();
  sh.getRange(1, 1).setValue('INTEL/1 chunks=' + chunks.length + ' built=' + obj.builtAt + ' len=' + json.length);
  if (chunks.length) sh.getRange(2, 1, chunks.length, 1).setValues(chunks);
  sh.hideSheet();
  return chunks.length;
}

function iLoadCache_() {
  var sh = iSs_().getSheetByName(INTEL.CACHE_TAB);
  if (!sh || sh.getLastRow() < 2) return null;
  var manifest = String(sh.getRange(1, 1).getValue());
  var m = manifest.match(/chunks=(\d+).*len=(\d+)/);
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var json = values.map(function (r) { return String(r[0]); }).join('');
  if (m && json.length !== +m[2]) return null;    // truncated — treat as no cache
  try { return JSON.parse(json); } catch (e) { return null; }
}

/* ── The watchlists ───────────────────────────────────────────────────────
   The same five lists, written back into the workbook as plain tabs. Staff
   who would rather sort in Sheets than open the app get exactly the figures
   the app shows, and a manager can filter them without a sign-in.          */
function iWriteWatchlists_(out) {
  var d = out.dues || {};
  iWriteTab_(INTEL.W_DUES,
    ['Agent', 'Policy', 'Client No', 'Client', 'Modal premium', 'Days overdue', 'Band',
     'Plan', 'Billing type', 'Paid to', 'Projected lapse', 'Phone', 'E-mail', 'Reachable'],
    (d.chase || []).slice(0, 3000).map(function (x) {
      return [x.agent, x.policyBroken ? '(number lost on export)' : x.policy, x.clientNo, x.client,
              x.modal, x.days, x.bucket, x.plan, x.billing, x.paidTo, x.lapseOn,
              x.phone, x.email, x.reachable ? 'yes' : 'NO'];
    }),
    'Modal premium is one instalment — the Mode column is empty, so this book cannot be annualised.');

  var p = out.pending || {};
  iWriteTab_(INTEL.W_PENDING,
    ['Policy', 'Client', 'Agent', 'Unit', 'Status', 'Decision', 'Requirement',
     'Submitted', 'Requested', 'Age (days)', 'Suspense held', 'Being chased by',
     'Last chased', 'Processed in', 'Payment'],
    (p.rows || []).map(function (x) {
      return [x.policy, x.client, x.agent, x.unit, x.status, x.decision, x.requirement,
              x.submitted, x.requestedOn, x.age === null ? '' : x.age, x.suspense,
              x.chase === 'never' ? 'NEVER CHASED' : (x.chasedBy || ''),
              x.chase === 'closed' ? x.chasedOn + ' (task closed)' : (x.chasedOn || ''),
              x.where, x.payment];
    }),
    'Age is recomputed from the dates. The sheet\'s own ReqtdaysLapsed reaches 8,128 and is not used.');

  var q = out.reqs || {};
  iWriteTab_(INTEL.W_REQS,
    ['Policy', 'Code', 'Requirement', 'Category', 'Ordered for', 'Added', 'Age (days)', 'Comment'],
    (q.rows || []).map(function (x) {
      return [x.policy, x.code, x.label, x.category, x.orderedFor, x.added, x.age === null ? '' : x.age, x.comment];
    }),
    'Open means no closed_date. One row per requirement, not per history entry.');

  var m = out.maturity || {};
  var matRows = (m.retirement ? m.retirement.rows : []).concat(m.life ? m.life.rows : []);
  matRows.sort(function (a, b) { return a.months - b.months; });
  iWriteTab_(INTEL.W_MATURITY,
    ['Matures', 'Months', 'Kind', 'Policy', 'Client', 'Plan', 'Fund value', 'Sum insured',
     'Annual premium', 'Servicing agent', 'Agent active', 'Phone', 'E-mail', 'City'],
    matRows.map(function (x) {
      return [x.matures, x.months, x.cls === 'retirement' ? 'Pension / annuity' : 'Life',
              x.policy, x.client, x.plan, x.fund, x.sumInsured, x.annual,
              x.agent, x.agentActive ? 'yes' : 'NO', x.phone, x.email, x.city];
    }),
    'Sum insured is life cover only.');

  var e = out.expiry || {};
  var expRows = (e.term ? e.term.rows : []).concat(e.riders ? e.riders.rows : []);
  expRows.sort(function (a, b) { return a.months - b.months; });
  iWriteTab_(INTEL.W_EXPIRY,
    ['Expires', 'Months', 'Kind', 'Convertible', 'Policy', 'Client', 'Plan', 'Cover ending',
     'Annual premium', 'Servicing agent', 'Phone', 'E-mail', 'City'],
    expRows.map(function (x) {
      return [x.matures, x.months, x.cls === 'term' ? 'Term cover' : 'Rider / benefit',
              x.convertible ? 'YES — conversion right ends with the term' : '',
              x.policy, x.client, x.plan, x.sumInsured, x.annual,
              x.agent, x.phone, x.email, x.city];
    }),
    'Rider amounts are never added to a sum-assured total.');

  var x = out.crosssell || {};
  iWriteTab_(INTEL.W_XSELL,
    ['Score', 'Band', 'Client', 'Age', 'The gap', 'What to ask', 'Worth', 'What that is',
     'Also needs', 'Holds now', 'Policies', 'Annual premium', 'Servicing agent', 'Phone',
     'E-mail', 'City', 'Why this scored'],
    (x.rows || []).map(function (r) {
      var def = (x.rules || {})[r.rule] || {};
      return [r.score,
              r.score >= 80 ? 'Call this week' : r.score >= 60 ? 'Worth a call' : 'Keep on file',
              r.client, r.age === null ? '' : r.age, def.title || r.rule,
              r.askOverride || def.ask || '',
              r.size, def.sizeLabel || '',
              (r.allRules || []).filter(function (id) { return id !== r.rule; })
                .map(function (id) { return ((x.rules || {})[id] || {}).title || id; }).join('; '),
              r.holds,
              r.policies, r.annual, r.agent, r.phone, r.email, r.city,
              (r.reasons || []).join('; ')];
    }),
    'Gaps in THIS branch\'s in-force book only — a client may hold the missing product elsewhere. Open by asking, not by telling.');
}

/* ══════════════════════════════════════════════════════════════════════════
   WHO IS ASKING
   The workbook carries two access-looking tabs — one with an Access Code
   column and one with a Password column — and the branch uses both. Rather
   than pick a winner and lock half the staff out, sign-in searches every tab
   that looks like an access list and accepts either secret column. Whichever
   tab a person is on, their sign-in works.

   Sign-in is POST only, so a code never sits in a URL or a browser history.
   ══════════════════════════════════════════════════════════════════════════ */

function iAccessTabs_() {
  var override = iProp_('INTEL_TAB_ACCESS');
  if (override) {
    var o = iSs_().getSheetByName(override);
    if (o) return [o];
  }
  return iSs_().getSheets().filter(function (sh) {
    if (sh.getLastRow() < 2) return false;
    var h = iHeaders_(sh);
    var hasWho = h.some(function (x) { return x === 'email' || x.indexOf('email') === 0; });
    var hasSecret = h.some(function (x) { return x.indexOf('access code') === 0 || x.indexOf('password') === 0 || x === 'pass' || x === 'pw'; });
    var hasName = h.some(function (x) { return x === 'name' || x.indexOf('name') === 0; });
    return hasWho && hasName && hasSecret;
  });
}

/* Constant-time-ish comparison. Access codes here are short and the risk is
   modest, but there is no reason to leak length or prefix through timing. */
function iSecretEq_(a, b) {
  a = String(a); b = String(b);
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function iFindPerson_(who, secret) {
  who = String(who || '').trim().toLowerCase();
  secret = String(secret || '').trim();
  if (!who || !secret) return null;

  var tabs = iAccessTabs_();
  for (var t = 0; t < tabs.length; t++) {
    var sh = tabs[t], head = iHeaders_(sh);
    var last = sh.getLastRow();
    if (last < 2) continue;
    var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();

    var cEmail  = iCol_(head, ['email']);
    var cName   = iCol_(head, ['name']);
    var cRole   = iCol_(head, ['role (agent/manager/staff)', 'role']);
    var cAgent  = iCol_(head, ['agent name (exactly as in data)', 'agent name']);
    var cAgtNum = iCol_(head, ['agent number', 'agent id', 'agentid']);
    var cCode   = iCol_(head, ['access code', 'password', 'pass', 'pw']);
    var cMgr    = iCol_(head, ['manager email (direct manager)', 'manager email']);
    var cUnit   = iCol_(head, ['unit']);
    var cActive = iCol_(head, ['active']);
    if (cCode < 0) continue;

    for (var r = 0; r < vals.length; r++) {
      var row = vals[r];
      var email = cEmail  >= 0 ? String(row[cEmail]).trim().toLowerCase() : '';
      var name  = cName   >= 0 ? String(row[cName]).trim() : '';
      var agent = cAgent  >= 0 ? String(row[cAgent]).trim() : '';
      var agtNo = cAgtNum >= 0 ? iCode_(row[cAgtNum]) : '';

      /* People sign in with whatever they know: their Guardian address, their
         agent number, or the name the branch put beside it. */
      var matches = (email && email === who) ||
                    (agtNo && agtNo.toLowerCase() === who) ||
                    (agent && agent.toLowerCase() === who) ||
                    (name && name.toLowerCase() === who);
      if (!matches) continue;

      if (cActive >= 0 && /^(no|inactive|disabled|off)$/i.test(String(row[cActive]).trim())) {
        return { blocked: 'This login has been deactivated — speak to the branch.' };
      }
      if (!iSecretEq_(String(row[cCode]).trim(), secret)) continue;

      var roleTxt = (cRole >= 0 ? String(row[cRole]).trim() : '') || 'Agent';
      var role = iRoleOf_(roleTxt);
      var ident = iIdentity_(name, agent, agtNo);
      return {
        name: ident.display || who,
        email: email,
        role: role,
        title: roleTxt,
        agentName: ident.agentName,
        agentId: ident.agentId,
        unit: cUnit >= 0 ? String(row[cUnit]).trim() : '',
        manager: cMgr >= 0 ? String(row[cMgr]).trim() : '',
        tab: sh.getName()
      };
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE BRANCH IS FIVE LEVELS, NOT THREE
   The Unit column on the access list is the org chart and nobody was reading
   it. It says which manager each agent reports to, and every one of the 29
   agents has it filled in:

     Ricky Rampersad     13 people   Branch Manager
     Gary Sookdeo         8          Unit Manager
     Kerwyn Ramroach      6          Assistant Branch Manager
     Akaash Kalladeen     6          Unit Manager
     SalesSupport         3          the pending desk
     Branch Managers Assistant  1

   A unit manager runs a team, not the branch. Before this they were handed the
   whole branch — every other unit's arrears and every other unit's clients —
   which is both more than they need and more than they should have.

   The map is rebuilt nightly from the access list, so moving an agent between
   units is a cell change in the sheet and nothing else.
   ══════════════════════════════════════════════════════════════════════════ */

function iBuildUnits_() {
  var units = {};
  iAccessTabs_().forEach(function (sh) {
    var head = iHeaders_(sh), last = sh.getLastRow();
    if (last < 2) return;
    var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    var cName = iCol_(head, ['name']),
        cAgent = iCol_(head, ['agent name (exactly as in data)', 'agent name']),
        cNum = iCol_(head, ['agent number', 'agent id', 'agentid']),
        cUnit = iCol_(head, ['unit']),
        cRole = iCol_(head, ['role (agent/manager/staff)', 'role']),
        cActive = iCol_(head, ['active']);
    if (cUnit < 0) return;
    vals.forEach(function (row) {
      var unit = String(row[cUnit]).trim();
      if (!unit) return;
      if (cActive >= 0 && /^(no|inactive|disabled|off)$/i.test(String(row[cActive]).trim())) return;
      var id = iIdentity_(cName >= 0 ? row[cName] : '',
                          cAgent >= 0 ? row[cAgent] : '',
                          cNum >= 0 ? row[cNum] : '');
      if (!id.agentName && !id.agentId) return;
      if (!units[unit]) units[unit] = [];
      units[unit].push({ name: id.agentName, id: iCode_(id.agentId),
                         role: cRole >= 0 ? String(row[cRole]).trim() : '' });
    });
  });
  return units;
}

/* ── Three kinds of person, not two ───────────────────────────────────────
   The first cut of this split everyone into "branch" and "agent" on a loose
   regex, and Staff fell through to agent. Staff have no book of their own, so
   all four of them — including the person who logs two thirds of the branch's
   chase work — signed in to an app with nothing in it.

   So there are three. Order matters: "Assistant Branch Manager" contains
   "assist" and must not be read as support staff, which is why the manager
   test runs first and both are anchored rather than loose.

     branch   everything, plus the management cuts — the agent league,
              billing-method rates, data health
     staff    everything too, because they work every agent's pending cases,
              but they do not sell, so the selling screens are not their day
     agent    their own book and nobody else's                             */
function iRoleOf_(title) {
  var t = String(title || '').trim().toLowerCase();
  /* Most specific first. "Assistant Branch Manager" contains both "assistant"
     and "manager", and "Unit Manager" contains "manager" — a loose test gets
     all three wrong. */
  if (/branch manager|^bm$/.test(t) && !/assistant/.test(t)) return 'branch';
  if (/assistant branch manager|^abm$/.test(t))              return 'branch';
  if (/unit manager|team manager/.test(t))                   return 'unit';
  if (/sales support manager|staff manager|support manager|^bma$|managers assistant/.test(t)) return 'staff-lead';
  if (/^manager$|^admin/.test(t))                            return 'branch';
  if (/^staff$|sales support|^support$|administrator|clerk|secretar/.test(t)) return 'staff';
  return 'agent';
}

/* Who sees the whole branch, whatever their level. */
function iSeesBranch_(role) {
  return role === 'branch' || role === 'staff' || role === 'staff-lead';
}

/* One access tab names people "Narissa Mohammed"; the other names the same
   person "A01066 - Narissa Mohammed" and keeps A01066 in its own column. The
   dues, pending and requirement extracts are keyed on the human name, and the
   in-force book additionally carries a Servicing Agent Id, so both are
   resolved here — and a bare agent number is never used as the name key.
   Doing that cost the whole of the second access tab an empty app: "A01066"
   matches nothing in any extract. */
/* Guardian writes the same agent code two ways — A00427 and U00427 are one
   person, and the settlement extract uses both. Four agents appear under both
   prefixes there, so grouping on the raw code splits their production in two:
   Varun Seegolam showed up as 296,745 under U and 65,393 under A when he had
   written 362,138. Every code is folded to its A form before it is compared
   or used as a key. */
function iCode_(v) {
  var c = String(v || '').trim().toUpperCase();
  return c.replace(/^U(?=\d)/, 'A');
}

function iIdentity_(name, agentName, agentNumber) {
  var display = String(name || '').trim();
  var num = iCode_(agentNumber);

  /* Names on that tab are prefixed with the agent number. Strip it — what is
     left is the name the extracts use. */
  var m = display.match(/^([A-Z]?\d{3,})\s*[-\u2013]\s*(.+)$/i);
  if (m) {
    if (!num) num = iCode_(m[1]);
    display = m[2].trim();
  }

  var human = String(agentName || '').trim();
  /* An "Agent Name" column holding a bare number is a number, not a name. */
  if (/^[A-Z]?\d+$/i.test(human)) { if (!num) num = iCode_(human); human = ''; }
  if (!human) human = display;

  return { display: display || human || num, agentName: human, agentId: num };
}

function iSessionsTab_() {
  return iSheet_(INTEL.SESSIONS_TAB,
    ['Token', 'Name', 'E-mail', 'Role', 'Agent name', 'Issued', 'Expires', 'Last seen',
     'Agent id', 'Unit']);
}

function iIssueSession_(person) {
  var sh = iSessionsTab_();
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  var now = new Date();
  var exp = new Date(now.getTime() + INTEL.SESSION_HOURS * 3600000);
  sh.appendRow([token, person.name, person.email, person.role, person.agentName,
                now, exp, now, person.agentId || '', person.unit || '']);
  iPruneSessions_(sh);
  return { token: token, expires: exp.toISOString() };
}

/* Expired rows are deleted rather than left to accumulate — a sessions tab
   that grows forever is both a slow lookup and a list of who was here. */
function iPruneSessions_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var vals = sh.getRange(2, 1, last - 1, 10).getValues();
  var now = new Date();
  for (var r = vals.length - 1; r >= 0; r--) {
    var exp = vals[r][6];
    if (exp instanceof Date && exp < now) sh.deleteRow(r + 2);
  }
}

function iSession_(token) {
  token = String(token || '').trim();
  if (!token) return null;
  var sh = iSessionsTab_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, 10).getValues();
  var now = new Date();
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][0]) !== token) continue;
    var exp = vals[r][6];
    if (!(exp instanceof Date) || exp < now) return null;
    sh.getRange(r + 2, 8).setValue(now);
    return { name: vals[r][1], email: vals[r][2], role: vals[r][3],
             agentName: vals[r][4], agentId: String(vals[r][8] || ''),
             unit: String(vals[r][9] || '') };
  }
  return null;
}

/* ── Scoping ──────────────────────────────────────────────────────────────
   The single rule that makes the sign-in worth having: an agent's response
   contains their rows and nobody else's. The filtering happens here, on the
   server, before anything is serialised. Hiding rows in the browser is not
   hiding them.

   Agent names are matched loosely because the extracts disagree with each
   other — "Meera Persad-Khan" in the dues tab, "MEERA PERSAD KHAN" in the
   in-force book, "Gary Sookdeo" against "GARY SOOKDEO INSURANCE SOLUTIONS
   LTD" for the same person.                                                */
function iNameKey_(s) {
  return String(s || '').toLowerCase()
    .replace(/\b(insurance|financial|services|solutions|company|and|&|ltd|limited|inc)\b/g, ' ')
    .replace(/[^a-z]+/g, ' ').trim();
}

function iSameAgent_(a, b) {
  var x = iNameKey_(a), y = iNameKey_(b);
  if (!x || !y) return false;
  if (x === y) return true;
  var xs = x.split(' ').filter(Boolean), ys = y.split(' ').filter(Boolean);
  if (!xs.length || !ys.length) return false;
  // Surname plus first initial is enough, and is how the extracts differ.
  var xl = xs[xs.length - 1], yl = ys[ys.length - 1];
  return xl === yl && xs[0].charAt(0) === ys[0].charAt(0);
}

function iScope_(cache, session) {
  if (!cache) return null;
  /* Staff and their supervisor work every agent's pending cases, so they get
     the branch's data. What differs for them is the day's emphasis, not the
     slice. A unit manager falls through to the scoping below. */
  if (iSeesBranch_(session.role)) return cache;

  var me = session.agentName;
  var meId = iCode_(session.agentId);
  var c = JSON.parse(JSON.stringify(cache));

  /* A unit manager is scoped to their team, an agent to themselves. Both are
     the same operation over a different set of people, so the set is built
     once here and everything below asks the same question of it. */
  var team = [{ name: me, id: meId }];
  if (session.role === 'unit') {
    var members = (cache.units || {})[String(session.unit || '').trim()] || [];
    if (members.length) team = members;
  }

  /* Which alias group this person belongs to, if any — this is what lets
     "Ricky Rampersad" match rows filed under "Advanced Investments Management
     Limited". Falls back to name and code matching when there is no group. */
  var aliasIdx = iAliasIndex_(cache.aliases);
  /* Every alias group the team belongs to, so a member filed under a company
     name is still recognised as one of ours. */
  var groups = {}, names = {}, ids = {};
  team.forEach(function (p) {
    var k = iNameKey_(p.name);
    if (k) names[k] = 1;
    if (p.id) ids[iCode_(p.id)] = 1;
    var g = aliasIdx[k];
    if (g === undefined && p.id) {
      (cache.aliases || []).forEach(function (ag, i) { if (ag.code === String(p.id).toUpperCase()) g = i; });
    }
    if (g !== undefined) groups[g] = 1;
  });
  /* Name first, because that is all the dues, pending and requirement extracts
     carry. The in-force book also carries a Servicing Agent Id, and matching on
     it catches the rows where the branch wrote the agency's company name —
     "GARY SOOKDEO INSURANCE SOLUTIONS LTD" — where the person's name belongs. */
  function isMine(x, key) {
    var who = x[key || 'agent'];
    if (x.agentId && ids[iCode_(x.agentId)]) return true;
    var k = iNameKey_(who);
    if (k && names[k]) return true;
    var g = aliasIdx[k];
    if (g !== undefined && groups[g]) return true;
    /* Last resort: the loose surname test, which is what catches the extracts
       spelling the same person three different ways. */
    for (var i = 0; i < team.length; i++) if (iSameAgent_(who, team[i].name)) return true;
    return false;
  }
  function mine(list, key) {
    return (list || []).filter(function (x) { return isMine(x, key); });
  }
  function sum(list, key) { return (list || []).reduce(function (t, x) { return t + (Number(x[key]) || 0); }, 0); }
  function within(list, m) { return (list || []).filter(function (x) { return x.months <= m; }); }
  /* Pull one agent's row out of a precomputed per-agent map, matching the same
     loose way agent names are matched everywhere else in this file. */
  /* The precomputed per-agent maps are keyed on the name the extract used.
     An agent whose access row carries only a number still resolves, because
     each entry keeps the servicing agent id beside its totals. */
  /* The per-agent precomputed maps are keyed on the extract's own name. For a
     team they are summed rather than looked up, because a unit's total is the
     sum of its people's. */
  function forMe(map, blank) {
    var keys = Object.keys(map || {}).filter(function (k) {
      return isMine({ agent: k, agentId: (map[k] || {}).agentId });
    });
    if (!keys.length) return blank;
    if (keys.length === 1) return map[keys[0]];
    var out = JSON.parse(JSON.stringify(blank));
    keys.forEach(function (k) {
      var v = map[k];
      Object.keys(v).forEach(function (f) {
        if (typeof v[f] !== 'number') return;
        out[f] = (typeof out[f] === 'number' ? out[f] : 0) + v[f];
      });
      /* The dues ageing map is a band-per-band object, not flat numbers. */
      Object.keys(v).forEach(function (f) {
        if (!v[f] || typeof v[f] !== 'object' || !('policies' in v[f])) return;
        if (!out[f]) out[f] = { policies: 0, modal: 0 };
        out[f].policies += v[f].policies; out[f].modal += v[f].modal;
      });
    });
    return out;
  }

  /* ── dues ────────────────────────────────────────────────────────────────
     Every derived figure is rebuilt from this agent's own rows. Leaving a
     branch total on an agent's screen is the one bug this whole sign-in
     exists to prevent, so nothing is carried over untouched. */
  if (c.dues && !c.dues.error) {
    var d = c.dues;
    d.chase = mine(d.chase);
    d.lapsedRecent = mine(d.lapsedRecent);
    d.byAgent = mine(d.byAgent);
    d.chaseCount = d.chase.length;
    d.modalChase = sum(d.chase, 'modal');

    var blank = {};
    (d.buckets || []).forEach(function (b) { blank[b] = { policies: 0, modal: 0 }; });
    d.ageing = forMe(d.ageingByAgent, blank);
    delete d.ageingByAgent;

    var mineRow = d.byAgent[0];
    d.counts = {
      total: mineRow ? mineRow.book : 0,
      overdue: mineRow ? mineRow.overdue : 0,
      lapsed: d.lapsedRecent.length,
      pending: 0, clean: 0
    };
    d.modalOverdue = sum(d.buckets.map(function (b) { return d.ageing[b] || {}; }), 'modal');

    /* Defect counts are rescoped to what this agent can see and act on. The
       branch-wide extract defects stay on the data-health screen, where they
       belong, and are not restated as if they were this agent's. */
    d.defects = {
      unreachable: d.chase.filter(function (x) { return !x.reachable; }).length,
      noPhone: d.chase.filter(function (x) { return !x.phone; }).length,
      noEmail: d.chase.filter(function (x) { return !x.email; }).length,
      sciNumber: d.chase.filter(function (x) { return x.policyBroken; }).length,
      badPaidTo: 0, badLapseDate: 0, spacedEmail: 0
    };
    /* Billing and plan rates are branch-level measures — an agent's own book
       is too small to make a rate mean anything, and the branch shape is what
       tells them which method to move a client onto. Kept, and labelled. */
    d.ratesAreBranchWide = true;
  }

  /* ── pending ─────────────────────────────────────────────────────────── */
  if (c.pending && !c.pending.error) {
    var p = c.pending;
    p.rows = mine(p.rows);
    p.byAgent = mine(p.byAgent);
    p.total = p.rows.length;
    p.suspense = sum(p.rows, 'suspense');
    p.suspenseCases = p.rows.filter(function (x) { return x.suspense > 0; }).length;
    p.stale = p.rows.filter(function (x) { return (x.age || 0) > 90; }).length;

    var ageP = { '0-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, '180+': 0 };
    var st = {}, dec = {}, units = {};
    p.rows.forEach(function (x) {
      if (x.age !== null && x.age !== undefined) {
        ageP[x.age <= 30 ? '0-30' : x.age <= 60 ? '31-60' : x.age <= 90 ? '61-90'
          : x.age <= 180 ? '91-180' : '180+']++;
      }
      st[x.status] = (st[x.status] || 0) + 1;
      dec[x.decision] = (dec[x.decision] || 0) + 1;
      if (!units[x.unit]) units[x.unit] = { unit: x.unit, cases: 0, susp: 0 };
      units[x.unit].cases++; units[x.unit].susp += x.suspense;
    });
    p.ageing = ageP; p.byStatus = st; p.byDecision = dec;
    p.byUnit = Object.keys(units).map(function (k) { return units[k]; });
    p.chaseNever  = p.rows.filter(function (x) { return x.chase === 'never'; }).length;
    p.chaseLive   = p.rows.filter(function (x) { return x.chase === 'live'; }).length;
    p.chaseClosed = p.rows.filter(function (x) { return x.chase === 'closed'; }).length;
  }

  /* The chase log belongs to staff, not to agents — an agent has no business
     seeing who else is chasing what. They keep only the chase marks already
     attached to their own pending rows above. */
  if (c.tasks && !c.tasks.error) {
    c.tasks = { openCount: null, restricted: true };
  }
  /* The alias table and the org chart both name every agent in the branch;
     they are plumbing, and nobody below branch level needs to receive them. */
  delete c.aliases;
  delete c.units;

  /* ── requirements ────────────────────────────────────────────────────────
     Requirements carry no agent — they are keyed on policy. An agent sees the
     ones on the policies already in their pending list, which is exactly the
     set they can do something about. */
  if (c.reqs && !c.reqs.error) {
    var q = c.reqs;
    var minePol = {};
    (c.pending && c.pending.rows ? c.pending.rows : []).forEach(function (x) { minePol[x.policy] = 1; });
    q.rows = (q.rows || []).filter(function (x) { return minePol[x.policy]; });
    q.openCount = q.rows.length;
    q.policies = Object.keys(q.rows.reduce(function (m, x) { m[x.policy] = 1; return m; }, {})).length;
    q.worstPolicies = (q.worstPolicies || []).filter(function (x) { return minePol[x.policy]; });

    var ageQ = { '0-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, '181-365': 0, '365+': 0 };
    var codes = {}, cats = {}, agesQ = [];
    q.rows.forEach(function (x) {
      if (x.age !== null && x.age !== undefined && x.age >= 0) {
        agesQ.push(x.age);
        ageQ[x.age <= 30 ? '0-30' : x.age <= 60 ? '31-60' : x.age <= 90 ? '61-90'
          : x.age <= 180 ? '91-180' : x.age <= 365 ? '181-365' : '365+']++;
      }
      codes[x.code] = (codes[x.code] || 0) + 1;
      cats[x.category] = (cats[x.category] || 0) + 1;
    });
    agesQ.sort(function (a, b) { return a - b; });
    q.ageing = ageQ;
    q.medianAge = agesQ.length ? agesQ[Math.floor(agesQ.length / 2)] : 0;
    q.oldest = agesQ.length ? agesQ[agesQ.length - 1] : 0;
    q.overYear = ageQ['365+'];
    q.byCategory = cats;
    q.byCode = Object.keys(codes).map(function (k) { return { code: k, label: iReqLabel_(k), n: codes[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
    q.closedThisYear = null;   // not attributable to an agent — shown as unavailable
  }

  /* ── maturities ──────────────────────────────────────────────────────── */
  if (c.maturity && !c.maturity.error) {
    var m = c.maturity;
    var totals = forMe(m.byAgentTotals, { suspense: 0, suspenseCases: 0, fundHeld: 0, orphaned: 0, noFunds3: 0 });
    m.suspense = totals.suspense; m.suspenseCases = totals.suspenseCases;
    m.fundHeld = totals.fundHeld; m.orphaned = totals.orphaned; m.noFunds3 = totals.noFunds3;
    delete m.byAgentTotals;

    if (m.retirement) {
      var r = m.retirement;
      r.rows = mine(r.rows);
      r.total = r.rows.length;
      r.w12 = within(r.rows, 12).length; r.w24 = within(r.rows, 24).length; r.w60 = r.rows.length;
      r.fund12 = sum(within(r.rows, 12), 'fund');
      r.fund24 = sum(within(r.rows, 24), 'fund');
      r.fund60 = sum(r.rows, 'fund');
    }
    if (m.life) {
      var l = m.life;
      l.rows = mine(l.rows);
      l.total = l.rows.length;
      l.w12 = within(l.rows, 12).length; l.w24 = within(l.rows, 24).length; l.w60 = l.rows.length;
      l.sum12 = sum(within(l.rows, 12), 'sumInsured');
      l.sum24 = sum(within(l.rows, 24), 'sumInsured');
      l.sum60 = sum(l.rows, 'sumInsured');
    }
    /* byClass counts the whole in-force book, not this agent's slice. It is
       not shown on an agent's screen, so it is dropped rather than left to be
       read as theirs. */
    delete m.byClass;
  }

  /* ── cross-sell ──────────────────────────────────────────────────────────
     An agent gets their own clients and their own bands recounted. The
     campaign totals across the branch are not theirs to see. */
  if (c.crosssell && !c.crosssell.error) {
    var xs = c.crosssell;
    xs.rows = mine(xs.rows);
    xs.leads = xs.rows.length;
    xs.clients = xs.rows.length;
    xs.thisWeek   = xs.rows.filter(function (l) { return l.score >= 80; }).length;
    xs.worthACall = xs.rows.filter(function (l) { return l.score >= 60 && l.score < 80; }).length;
    xs.keepOnFile = xs.rows.filter(function (l) { return l.score < 60; }).length;
    var seen = {};
    xs.rows.forEach(function (l) {
      (l.allRules || [l.rule]).forEach(function (r) { seen[r] = (seen[r] || 0) + 1; });
    });
    xs.byRule = (xs.byRule || []).map(function (r) {
      return { id: r.id, title: r.title, kind: r.kind, n: seen[r.id] || 0 };
    }).filter(function (r) { return r.n; });
    delete xs.holds;
  }

  /* ── what moved overnight ───────────────────────────────────────────────
     Each list carries the servicing agent, so an agent sees their own losses
     and nobody else's. The counts are recomputed rather than carried. */
  if (c.movements && !c.movements.first) {
    var mv = c.movements;
    ['lapsed', 'slipped', 'cleared', 'newPending'].forEach(function (k) {
      mv[k] = mine(mv[k]);
    });
    /* These two carry a policy number and nothing else — there is no agent on
       them to filter by, so an agent is shown neither rather than everyone's. */
    mv.donePending = []; mv.vanished = [];
    mv.counts = { lapsed: mv.lapsed.length, slipped: mv.slipped.length,
                  cleared: mv.cleared.length, newPending: mv.newPending.length,
                  donePending: null, vanished: null };
  }

  /* ── underwriting ────────────────────────────────────────────────────────
     An agent sees their own decisions and their own rate. The year trend is
     the branch's shape and stays — one agent's 38 cases cannot draw a trend,
     and knowing the branch is at 36% is what makes their own number mean
     something. */
  if (c.underwriting && !c.underwriting.error) {
    var uw = c.underwriting;
    uw.rows = mine(uw.rows);
    uw.byAgent = mine(uw.byAgent);
    uw.yearTotal = uw.rows.length;
    var std = uw.rows.filter(function (r) { return r.firstTime; }).length;
    var back = uw.rows.filter(function (r) {
      return r.code === 'Referred' || r.code === 'Additional Information'; }).length;
    uw.rate = uw.yearTotal ? std / uw.yearTotal : 0;
    uw.comeBack = uw.yearTotal ? back / uw.yearTotal : 0;
    var mm = {};
    uw.rows.forEach(function (r) { mm[r.code] = (mm[r.code] || 0) + 1; });
    uw.mix = Object.keys(mm).map(function (k) {
      return { code: k, n: mm[k], share: uw.yearTotal ? mm[k] / uw.yearTotal : 0 };
    }).sort(function (a, b) { return b.n - a.n; });
    /* Branch-wide counts an agent has no use for. */
    uw.total = null; uw.dated = null; uw.mixAll = null; uw.rateAll = null;
  }

  /* ── production ──────────────────────────────────────────────────────────
     Rebuilt from this person's own settled rows rather than filtered, because
     every figure on that screen is a total and a filtered total is wrong. */
  if (c.production && !c.production.error) {
    var pr = c.production;
    pr.rows = mine(pr.rows);
    pr.byAgent = mine(pr.byAgent);
    pr.apps = pr.byAgent.reduce(function (t, a) { return t + a.apps; }, 0);
    pr.api  = pr.byAgent.reduce(function (t, a) { return t + a.api; }, 0);
    pr.face = pr.byAgent.reduce(function (t, a) { return t + a.face; }, 0);
    pr.avgApp = pr.apps ? pr.api / pr.apps : 0;

    var mm = {};
    pr.byAgent.forEach(function (a) {
      Object.keys(a.months || {}).forEach(function (k) {
        mm[k] = (mm[k] || 0) + a.months[k];
      });
    });
    /* Apps per month need the rows, since the per-agent map only carries API. */
    var ma = {};
    pr.rows.forEach(function (r) { ma[r.month] = (ma[r.month] || 0) + r.apps; });
    pr.months = Object.keys(mm).map(function (k) {
      var n = ma[k] || 0;
      return { month: +k, api: mm[k], apps: n, face: 0, policies: 0,
               perApp: n ? mm[k] / n : 0 };
    }).sort(function (a, b) { return a.month - b.month; });
    pr.monthlyAvg = pr.months.length ? pr.api / pr.months.length : 0;
    pr.best  = pr.months.reduce(function (m, x) { return !m || x.api > m.api ? x : m; }, null);
    pr.worst = pr.months.reduce(function (m, x) { return !m || x.api < m.api ? x : m; }, null);
    pr.latest = pr.months.length ? pr.months[pr.months.length - 1] : null;
    /* The reconciliation is a check on the whole tab, not on one slice. */
    pr.reconciles = null; delete pr.sheetTotal;
  }

  /* ── expiring cover ──────────────────────────────────────────────────── */
  if (c.expiry && !c.expiry.error) {
    var e = c.expiry;
    if (e.term) {
      var t = e.term;
      t.rows = mine(t.rows);
      t.total = t.rows.length;
      t.w12 = within(t.rows, 12).length; t.w24 = within(t.rows, 24).length;
      t.w60 = within(t.rows, 60).length; t.w120 = t.rows.length;
      t.cover24 = sum(within(t.rows, 24), 'sumInsured');
      t.cover60 = sum(within(t.rows, 60), 'sumInsured');
      t.cover120 = sum(t.rows, 'sumInsured');
    }
    if (e.convertible) {
      var v = e.convertible;
      v.rows = mine(v.rows);
      v.total = v.rows.length;
      v.w24 = within(v.rows, 24).length; v.w60 = within(v.rows, 60).length;
      v.cover = sum(v.rows, 'sumInsured');
    }
    if (e.riders) {
      var rd = e.riders;
      rd.rows = mine(rd.rows);
      rd.total = rd.rows.length;
      rd.w12 = within(rd.rows, 12).length; rd.w24 = within(rd.rows, 24).length;
    }
  }
  return c;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE ROUTER
   Every action is namespaced intel.* so this file can live beside a script
   that already owns doPost without either one guessing at the other's calls.
   ══════════════════════════════════════════════════════════════════════════ */

function iJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function iOk_(o)  { o = o || {}; o.ok = true;  return iJson_(o); }
function iErr_(m) { return iJson_({ ok: false, error: m }); }

/* Returns null when the action is not ours, so a host doPost can fall through
   to whatever it was already doing. */
function intelRoute_(b) {
  var action = String((b && b.action) || '');
  if (action.indexOf('intel.') !== 0) return null;

  if (action === 'intel.signin') return iActSignin_(b);

  var session = iSession_(b.token);
  if (!session) return iErr_('Your session has expired — sign in again.');

  switch (action) {
    case 'intel.data':    return iActData_(b, session);
    case 'intel.client':  return iActClientLookup_(b, session);
    case 'intel.action':  return iActLog_(b, session);
    case 'intel.session': return iOk_({ name: session.name, role: session.role,
                                       agentName: session.agentName, agentId: session.agentId,
                                       unit: session.unit });
    case 'intel.signout': return iActSignout_(b);
  }
  return iErr_('Unknown action: ' + action);
}

function iActSignin_(b) {
  var person = iFindPerson_(b.who, b.secret);
  if (person && person.blocked) return iErr_(person.blocked);
  if (!person) {
    /* One message for "no such person" and "wrong code" both. Telling the
       difference is telling an outsider which logins exist. */
    Utilities.sleep(400);
    return iErr_('That login and code do not match the branch access list.');
  }
  var s = iIssueSession_(person);
  iLogAction_(person.name, 'SIGNIN', '', '', person.title + ' · ' + person.tab);
  return iOk_({
    token: s.token, expires: s.expires,
    name: person.name, role: person.role, title: person.title,
    agentName: person.agentName, agentId: person.agentId, unit: person.unit
  });
}

function iActSignout_(b) {
  var sh = iSessionsTab_(), last = sh.getLastRow();
  if (last < 2) return iOk_({});
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][0]) === String(b.token)) { sh.deleteRow(r + 2); break; }
  }
  return iOk_({});
}

function iActData_(b, session) {
  var cache = iLoadCache_();
  if (!cache) return iErr_('No intelligence has been built yet — a manager should run intelRebuild() once, or wait for tonight.');
  var scoped = iScope_(cache, session);
  scoped.you = { name: session.name, role: session.role, agentName: session.agentName };
  scoped.actions = iRecentActions_(session);
  return iOk_({ data: scoped });
}

/* ══════════════════════════════════════════════════════════════════════════
   ONE CLIENT, EVERYTHING
   The screens in this app are lists: every overdue premium, every maturity,
   every lead. The question a branch is actually asked all day is the other
   way round — the phone rings, somebody gives a name, and the person who
   answers needs the whole story on one screen.

   This is the only part of the app that does NOT read the nightly cache. The
   cache holds the lists, and a client's policies mostly are not on them: a
   premium paid on time is on no list at all. So the lookup reads the source
   tabs live, which also means the answer is current rather than last night's.

   It reads the dues book first — that is the only tab with every policy in it
   — then enriches from the in-force book, pending business, requirements and
   the branch's own action log.
   ══════════════════════════════════════════════════════════════════════════ */

/* Who this person is allowed to see, decided once and used by both the
   shortlist and the full record. Aliases included, or the three agents whose
   book is filed under a company name could not look up their own clients. */
function iOwnershipTest_(session) {
  if (iSeesBranch_(session.role)) return function () { return true; };
  var cache = iLoadCache_();
  var aliasIdx = iAliasIndex_(cache && cache.aliases);
  var meId = iCode_(session.agentId);
  var myGroup = aliasIdx[iNameKey_(session.agentName)];
  if (myGroup === undefined && meId && cache) {
    (cache.aliases || []).forEach(function (g, i) { if (g.code === meId) myGroup = i; });
  }
  return function (agent) {
    if (iSameAgent_(agent, session.agentName)) return true;
    return myGroup !== undefined && aliasIdx[iNameKey_(agent)] === myGroup;
  };
}

function iActClientLookup_(b, session) {
  var q = String(b.q || '').trim();
  if (q.length < 3) return iErr_('Type at least three characters — a name, a policy or client number, a phone or an e-mail.');

  var sh = iTabDues_();
  if (!sh) return iErr_('No dues tab found, so there is nothing to search.');

  var d = iReadCols_(sh, {
    agent: ['agent'], number: ['number'], clientNo: ['client number'], client: ['client'],
    premium: ['premium'], issue: ['issue date'], status: ['status'], days: ['days'],
    paidTo: ['paid to date'], sumAssured: ['sum assured'], plan: ['plan code'],
    billing: ['billing type'], desc: ['status description'], lapseDate: ['projected lapse date'],
    address: ['address'], phone: ['phone'], email: ['email']
  });

  var needle = q.toLowerCase();
  var digits = q.replace(/\D/g, '');
  var byClient = {}, order = [];
  var ours = iOwnershipTest_(session);

  for (var r = 0; r < d.rows; r++) {
    var clientNo = String(d.get('clientNo', r)).trim();
    var name = String(d.get('client', r)).trim();
    if (!clientNo && !name) continue;

    /* Match on anything a caller might give: their name, the policy in their
       hand, their client number, the phone they are calling from, or the
       e-mail an enquiry came in on. Leading zeros differ between tabs, so the
       number comparisons strip them. */
    var policy = String(d.get('number', r)).trim();
    var phone = String(d.get('phone', r));
    var email = String(d.get('email', r));
    var hit =
      (name && name.toLowerCase().indexOf(needle) !== -1) ||
      (digits.length >= 4 && (
        policy.replace(/\D/g, '').indexOf(digits) === 0 ||
        clientNo.replace(/^0+/, '') === digits.replace(/^0+/, '') ||
        phone.replace(/\D/g, '').indexOf(digits) !== -1)) ||
      (needle.indexOf('@') !== -1 && iEmail_(email) === needle);
    if (!hit) continue;

    /* A client whose policies all sit on somebody else's book is not on this
       person's shortlist at all — showing the name, the agent and the phone
       number of a client they cannot open is the leak the sign-in exists to
       prevent. */
    if (!ours(String(d.get('agent', r)).trim())) continue;

    var key = clientNo || ('name:' + iNameKey_(name));
    if (!byClient[key]) { byClient[key] = { key: key, clientNo: clientNo, client: name, rowIdx: [] }; order.push(key); }
    byClient[key].rowIdx.push(r);
  }

  if (!order.length) return iOk_({ query: q, matches: [], client: null });

  /* Several people answer to "Mohammed". Hand back the shortlist and let the
     person on the phone pick, rather than guessing at one. */
  if (order.length > 1) {
    var list = order.map(function (k) {
      var c = byClient[k], first = c.rowIdx[0];
      return { clientNo: c.clientNo, client: c.client, policies: c.rowIdx.length,
               agent: String(d.get('agent', first)).trim(),
               phone: iPhone_(d.get('phone', first)), email: iEmail_(d.get('email', first)) };
    }).sort(function (a, b) { return b.policies - a.policies; });
    return iOk_({ query: q, matches: list.slice(0, 40), more: Math.max(0, list.length - 40), client: null });
  }

  /* One client. Widen from the rows that matched the query to every row that
     client has — somebody reading a policy number off a letter still wants
     their whole picture, not the one policy they happened to quote. */
  var only = byClient[order[0]];
  if (only.clientNo) {
    var want = only.clientNo.replace(/^0+/, '');
    var all = [];
    for (var w = 0; w < d.rows; w++) {
      if (String(d.get('clientNo', w)).trim().replace(/^0+/, '') === want) all.push(w);
    }
    if (all.length) only.rowIdx = all;
  }
  return iOk_(iClientRecord_(only, d, session, q));
}

/* Everything the workbook knows about one client, assembled. */
function iClientRecord_(c, d, session, q) {
  var today = iToday_();
  var mine = session.role !== 'branch';
  var ours = iOwnershipTest_(session);
  var policies = [], theirs = 0, others = 0;
  var address = '', phone = '', email = '', agents = {};

  c.rowIdx.forEach(function (r) {
    var agent = String(d.get('agent', r)).trim();
    /* An agent looking up a client sees the policies that are theirs. The rest
       are counted so nobody is misled into thinking they have the whole
       picture, but not detailed — another agent's book is not theirs to read. */
    if (!ours(agent)) { others++; return; }
    theirs++;
    agents[agent] = (agents[agent] || 0) + 1;
    address = address || String(d.get('address', r)).trim();
    phone = phone || iPhone_(d.get('phone', r));
    email = email || iEmail_(d.get('email', r));

    var status = String(d.get('status', r)).trim();
    var rawNum = d.get('number', r);
    policies.push({
      policy: iBadNumber_(rawNum) ? '' : String(rawNum).trim(),
      policyBroken: iBadNumber_(rawNum),
      plan: String(d.get('plan', r)).trim(),
      status: status,
      state: status === '1' ? 'Lapsed' : status === '2' ? 'Overdue'
           : status === '3' ? 'Underwriting' : String(d.get('desc', r)).trim(),
      desc: String(d.get('desc', r)).trim(),
      modal: iNum_(d.get('premium', r)),
      sumAssured: iNum_(d.get('sumAssured', r)),
      days: iNum_(d.get('days', r)),
      billing: String(d.get('billing', r)).trim(),
      issued: iIso_(iDate_(d.get('issue', r))),
      paidTo: iIso_(iDate_(d.get('paidTo', r))),
      lapseOn: iIso_(iDate_(d.get('lapseDate', r)))
    });
  });

  if (!theirs) {
    return { query: q, matches: [], client: null,
             blocked: 'That client\'s policies are on another agent\'s book.' };
  }

  policies.sort(function (a, b) {
    var rank = { 'Overdue': 0, 'Underwriting': 1, 'Lapsed': 2 };
    var ra = rank[a.state] === undefined ? 3 : rank[a.state];
    var rb = rank[b.state] === undefined ? 3 : rank[b.state];
    return ra - rb || b.modal - a.modal;
  });

  var polSet = {};
  policies.forEach(function (p) { if (p.policy) polSet[p.policy] = 1; });

  return {
    query: q, matches: [],
    client: {
      clientNo: c.clientNo, name: c.client,
      phone: phone, email: email, address: address,
      agents: Object.keys(agents),
      policies: policies,
      hiddenPolicies: others,
      counts: {
        total: policies.length,
        overdue: policies.filter(function (p) { return p.state === 'Overdue'; }).length,
        lapsed: policies.filter(function (p) { return p.state === 'Lapsed'; }).length,
        paying: policies.filter(function (p) { return /premium paying/i.test(p.desc) && p.status === '0'; }).length
      },
      modalOverdue: policies.filter(function (p) { return p.state === 'Overdue'; })
                            .reduce(function (t, p) { return t + p.modal; }, 0),
      inforce: iClientInforce_(c.clientNo, polSet),
      pending: iClientPending_(polSet),
      requirements: iClientReqs_(polSet, today),
      history: iClientHistory_(polSet, c.client)
    }
  };
}

/* The in-force book adds what the dues extract has no column for: the maturity
   date, the fund behind it, and what the cover is actually worth. */
function iClientInforce_(clientNo, polSet) {
  var sh = iTabInforce_();
  if (!sh) return [];
  var d = iReadCols_(sh, {
    policy: ['policy id'], plan: ['plan'], mat: ['policy maturity date'],
    sumIns: ['sum insured'], fund: ['fund value'], annual: ['annual premium'],
    billType: ['policy bill type'], paidTo: ['policy paid to date'],
    susp: ['premium in suspense amount'], clientId: ['client id'],
    agent: ['servcing agent name', 'servicing agent name']
  });
  var want = String(clientNo || '').replace(/^0+/, '');
  var out = [], today = iToday_();
  for (var r = 0; r < d.rows; r++) {
    var pol = String(d.get('policy', r)).trim();
    var cid = String(d.get('clientId', r)).trim().replace(/^0+/, '');
    if (!(polSet[pol] || (want && cid === want))) continue;
    var mat = iDate_(d.get('mat', r));
    out.push({
      policy: pol, plan: String(d.get('plan', r)).trim(),
      matures: iIso_(mat),
      months: mat ? Math.round((iDays_(today, mat) || 0) / 30.44) : null,
      sumInsured: iNum_(d.get('sumIns', r)), fund: iNum_(d.get('fund', r)),
      annual: iNum_(d.get('annual', r)), billType: String(d.get('billType', r)).trim(),
      paidTo: iIso_(iDate_(d.get('paidTo', r))), suspense: iNum_(d.get('susp', r)),
      agent: String(d.get('agent', r)).trim(),
      cls: iClassifyPlan_(String(d.get('plan', r)).trim())
    });
  }
  out.sort(function (a, b) { return (a.months === null ? 1e9 : a.months) - (b.months === null ? 1e9 : b.months); });
  return out;
}

function iClientPending_(polSet) {
  var sh = iTabPending_();
  if (!sh) return [];
  var d = iReadCols_(sh, {
    policy: ['policy'], status: ['status'], decision: ['decisiontype'],
    reqt: ['reqt'], submit: ['submitdt'], reqtDt: ['reqtdt'],
    susp: ['pol_misc_susp_amt'], where: ['being processed in'], agent: ['agent name']
  });
  var today = iToday_(), out = [];
  for (var r = 0; r < d.rows; r++) {
    var pol = String(d.get('policy', r)).trim();
    if (!polSet[pol]) continue;
    var reqtDt = iDate_(d.get('reqtDt', r)), submit = iDate_(d.get('submit', r));
    var age = reqtDt ? iDays_(reqtDt, today) : (submit ? iDays_(submit, today) : null);
    if (age !== null && (age < 0 || age > 3650)) age = null;
    out.push({ policy: pol, status: String(d.get('status', r)).trim(),
               decision: String(d.get('decision', r)).trim(),
               requirement: String(d.get('reqt', r)).trim(),
               submitted: iIso_(submit), age: age,
               suspense: iNum_(d.get('susp', r)),
               where: String(d.get('where', r)).trim() });
  }
  return out;
}

function iClientReqs_(polSet, today) {
  var sh = iTabReqs_();
  if (!sh) return [];
  var d = iReadCols_(sh, {
    added: ['added_date'], closed: ['closed_date'], policy: ['policy_number'],
    code: ['requirement_code'], cat: ['requirements'], comment: ['requirement_comment'],
    reqId: ['insured_requirement_id']
  });
  var seen = {}, out = [];
  for (var r = 0; r < d.rows; r++) {
    var pol = String(d.get('policy', r)).trim();
    if (!polSet[pol] || iDate_(d.get('closed', r))) continue;
    var key = String(d.get('reqId', r)).trim() || (pol + d.get('code', r));
    if (seen[key]) continue;
    seen[key] = 1;
    var added = iDate_(d.get('added', r));
    var code = String(d.get('code', r)).trim().toUpperCase();
    out.push({ policy: pol, code: code, label: iReqLabel_(code),
               category: String(d.get('cat', r)).trim(),
               comment: String(d.get('comment', r)).trim(),
               added: iIso_(added), age: added ? iDays_(added, today) : null });
  }
  out.sort(function (a, b) { return (b.age || 0) - (a.age || 0); });
  return out;
}

/* Everything anybody has logged against this client, so whoever picks up the
   phone knows what was said last time. */
function iClientHistory_(polSet, name) {
  var sh = iActionsTab_(), last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 9).getValues();
  var want = iNameKey_(name), out = [];
  for (var r = vals.length - 1; r >= 0; r--) {
    var row = vals[r];
    if (String(row[2]) === 'SIGNIN') continue;
    var pol = String(row[3] || '');
    var matches = (pol && polSet[pol]) || (want && iNameKey_(row[4]) === want);
    if (!matches) continue;
    out.push({
      when: iIso_(row[0] instanceof Date ? row[0] : iDate_(row[0])),
      by: String(row[1]), domain: String(row[2]), policy: pol,
      outcome: String(row[5]), note: String(row[6]), next: String(row[7]),
      followUp: iIso_(row[8] instanceof Date ? row[8] : iDate_(row[8]))
    });
    if (out.length >= 40) break;
  }
  return out;
}

/* ── The action log ───────────────────────────────────────────────────────
   What turns this from a report into a record. Every call, every promise to
   pay, every reason a case is stuck goes here under the name of whoever
   logged it — and the next person to open that policy sees it.             */
function iActionsTab_() {
  return iSheet_(INTEL.ACTIONS_TAB,
    ['When', 'By', 'Domain', 'Policy', 'Client', 'Outcome', 'Note', 'Next step', 'Follow up on']);
}

function iLogAction_(by, domain, policy, client, note, outcome, next, followUp) {
  iActionsTab_().appendRow([
    new Date(), by, domain, policy || '', client || '', outcome || '', note || '',
    next || '', followUp ? iDate_(followUp) : ''
  ]);
}

function iActLog_(b, session) {
  var policy = String(b.policy || '').trim();
  if (!policy && !b.note) return iErr_('An action needs at least a policy or a note.');
  iLogAction_(session.name, String(b.domain || 'general'), policy,
              String(b.client || ''), String(b.note || ''), String(b.outcome || ''),
              String(b.next || ''), b.followUp);
  return iOk_({ logged: true });
}

/* The last thing anybody recorded against each policy, so the app can show it
   beside the row. Capped: this is a sidebar, not the audit trail. */
function iRecentActions_(session) {
  var sh = iActionsTab_(), last = sh.getLastRow();
  if (last < 2) return [];
  var from = Math.max(2, last - 600);
  var vals = sh.getRange(from, 1, last - from + 1, 9).getValues();
  var out = [], byPolicy = {};
  for (var r = vals.length - 1; r >= 0; r--) {
    var row = vals[r];
    if (String(row[2]) === 'SIGNIN') continue;
    if (session.role !== 'branch' && String(row[1]) !== session.name) continue;
    var pol = String(row[3] || '');
    if (pol && byPolicy[pol]) continue;
    if (pol) byPolicy[pol] = 1;
    out.push({
      when: iIso_(row[0] instanceof Date ? row[0] : iDate_(row[0])),
      by: String(row[1]), domain: String(row[2]), policy: pol, client: String(row[4]),
      outcome: String(row[5]), note: String(row[6]), next: String(row[7]),
      followUp: iIso_(row[8] instanceof Date ? row[8] : iDate_(row[8]))
    });
    if (out.length >= 200) break;
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE AUTOMATIONS
   Nobody remembers to open a dashboard. These four send the branch the four
   things it would otherwise find out about too late.

     intelRebuild            02:00 nightly   recompute everything
     intelAgentDigest        07:00 weekdays  each agent's own chase list
     intelManagerDigest      07:30 Monday    the branch's week
     intelHorizonWatch       08:00 1st       maturities and expiries ahead

   TEST MODE — set Script Property INTEL_TEST_TO to an address and every
   message goes there instead, subject-tagged and banner-marked with who it
   was really for. Clients and agents cannot receive test traffic.
   ══════════════════════════════════════════════════════════════════════════ */

function intelInstallTriggers() {
  var wanted = ['intelRebuild', 'intelAgentDigest', 'intelManagerDigest',
                'intelHorizonWatch', 'intelCrossSellDigest'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (wanted.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('intelRebuild').timeBased().atHour(2).everyDays(1).create();
  ScriptApp.newTrigger('intelAgentDigest').timeBased().atHour(7).everyDays(1).create();
  ScriptApp.newTrigger('intelManagerDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  ScriptApp.newTrigger('intelHorizonWatch').timeBased().onMonthDay(1).atHour(8).create();
  ScriptApp.newTrigger('intelCrossSellDigest').timeBased().onMonthDay(8).atHour(8).create();
  return 'Installed. Check Project Settings → Time zone reads (GMT-04:00) Atlantic Time, ' +
         'or every one of these fires an hour out.';
}

function iSend_(to, subject, html) {
  var test = iProp_('INTEL_TEST_TO');
  var real = to;
  if (test) {
    html = '<div style="background:#E8A020;color:#00254d;padding:10px 14px;font:700 13px sans-serif;' +
           'border-radius:8px;margin-bottom:14px">TEST MODE — this would have gone to ' +
           iEsc_(real) + '</div>' + html;
    to = test;
    subject = '[TEST] ' + subject;
  }
  if (!to) return false;
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'Branch Intelligence' });
  return true;
}

function iEsc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function iShell_(title, lead, inner) {
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a2b3d">' +
    '<div style="background:linear-gradient(135deg,#00254d,#00458c);padding:22px 24px;border-radius:14px 14px 0 0">' +
      '<div style="color:#E8A020;font-size:11px;letter-spacing:.18em;font-weight:700;text-transform:uppercase">' +
        'A Ricky Rampersad Branch Initiative</div>' +
      '<div style="color:#fff;font-size:21px;font-weight:700;margin-top:6px">' + iEsc_(title) + '</div>' +
      (lead ? '<div style="color:#c8d6e8;font-size:13.5px;margin-top:8px;line-height:1.6">' + lead + '</div>' : '') +
    '</div>' +
    '<div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:22px 24px;background:#fff">' +
      inner +
    '</div>' +
    '<div style="color:#7e94b3;font-size:11px;padding:14px 24px;line-height:1.6">' +
      'Built from the branch workbook at ' + iEsc_(iProp_('INTEL_LAST_BUILD') || 'the last rebuild') + '. ' +
      'Premium figures are modal instalments — the extract carries no billing frequency, so this book cannot be annualised.' +
    '</div></div>';
}

function iTable_(head, rows) {
  if (!rows.length) return '<p style="color:#5c7590;font-size:13.5px">Nothing outstanding.</p>';
  var h = head.map(function (x) {
    return '<th style="text-align:left;padding:7px 9px;background:#00254d;color:#fff;font-size:11px;' +
           'text-transform:uppercase;letter-spacing:.05em">' + iEsc_(x) + '</th>';
  }).join('');
  var b = rows.map(function (r, i) {
    return '<tr style="background:' + (i % 2 ? '#f6f9fc' : '#fff') + '">' + r.map(function (c) {
      return '<td style="padding:7px 9px;border-bottom:1px solid #e8eef5;font-size:13px">' + iEsc_(c) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return '<table style="width:100%;border-collapse:collapse;margin:10px 0"><tr>' + h + '</tr>' + b + '</table>';
}

function iStat_(label, value, tone) {
  var colour = tone === 'bad' ? '#c0392b' : tone === 'good' ? '#1e8449' : '#00254d';
  return '<td style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;vertical-align:top">' +
    '<div style="font-size:11px;color:#5c7590;text-transform:uppercase;letter-spacing:.06em">' + iEsc_(label) + '</div>' +
    '<div style="font-size:22px;font-weight:700;color:' + colour + ';margin-top:3px">' + iEsc_(value) + '</div></td>';
}

/* ── Each agent's own morning list ────────────────────────────────────────
   Only what they can act on today: arrears past the grace period, cases where
   their client's own money is sitting in suspense, and anything they promised
   to follow up on that has come due. An agent with nothing outstanding is not
   mailed at all — a digest that arrives empty stops being read.            */
function intelAgentDigest() {
  var cache = iLoadCache_();
  if (!cache) return 'No cache — run intelRebuild() first.';
  var day = new Date().getDay();
  if (day === 0 || day === 6) return 'Weekend — skipped.';

  var directory = iAgentDirectory_();
  var sent = 0;

  Object.keys(directory).forEach(function (key) {
    var person = directory[key];
    if (!person.email) return;

    /* Staff and managers have no personal book; the branch digest is theirs,
       not an agent list that would always come back empty. */
    if (iRoleOf_(person.role) !== 'agent') return;

    var mine = iScope_(cache, { role: 'agent', agentName: person.agentName,
                                agentId: person.agentId, name: person.name });
    var chase = (mine.dues && mine.dues.chase ? mine.dues.chase : []);
    var urgent = chase.filter(function (x) { return x.days >= 60; });
    var pend = (mine.pending && mine.pending.rows ? mine.pending.rows : [])
      .filter(function (x) { return x.suspense > 0 || (x.age || 0) > 60 || x.chase === 'never'; });
    var due = iDueFollowUps_(person.name);
    var mv = mine.movements || {};
    var justLapsed = mv.first ? [] : (mv.lapsed || []);
    var justSlipped = mv.first ? [] : (mv.slipped || []);

    if (!urgent.length && !pend.length && !due.length && !justLapsed.length && !justSlipped.length) return;

    var inner =
      '<table style="width:100%;border-spacing:8px 0"><tr>' +
        iStat_('Lapsed overnight', String(justLapsed.length), justLapsed.length ? 'bad' : 'good') +
        iStat_('Arrears 60 days +', String(urgent.length), urgent.length ? 'bad' : 'good') +
        iStat_('Pending stuck', String(pend.length), pend.length ? 'bad' : 'good') +
        iStat_('Follow-ups due', String(due.length)) +
      '</tr></table>';

    /* Anything that moved last night goes first. It is the only part of this
       mail with a clock on it — everything else will still be true tomorrow. */
    if (justLapsed.length) {
      inner += '<h3 style="font-size:14px;margin:20px 0 4px;color:#c0392b">Lapsed last night</h3>' +
        '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">Reinstatement is easiest in ' +
        'the first weeks and hardest after a year. These are as easy as they will ever be, today.</p>' +
        iTable_(['Client', 'Policy', 'Plan', 'Instalment', 'Contact'],
          justLapsed.slice(0, 12).map(function (x) {
            return [x.client, x.policy, x.plan, iMoney_(x.modal),
                    x.phone || x.email || '— none on file —'];
          }));
    }
    if (justSlipped.length) {
      inner += '<h3 style="font-size:14px;margin:20px 0 4px;color:#b0791c">Slipped into arrears</h3>' +
        '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">Paying yesterday. A call now ' +
        'costs one conversation; in six months it costs a reinstatement.</p>' +
        iTable_(['Client', 'Policy', 'Instalment', 'Contact'],
          justSlipped.slice(0, 12).map(function (x) {
            return [x.client, x.policy, iMoney_(x.modal), x.phone || x.email || '— none on file —'];
          }));
    }

    if (urgent.length) {
      inner += '<h3 style="font-size:14px;margin:20px 0 4px;color:#00254d">Premiums past 60 days</h3>' +
        '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">Oldest first. ' +
        urgent.filter(function (x) { return !x.reachable; }).length +
        ' of these have no phone and no e-mail on file.</p>' +
        iTable_(['Client', 'Policy', 'Days', 'Instalment', 'Billing', 'Contact'],
          urgent.slice(0, 15).map(function (x) {
            return [x.client, x.policy || '(number lost on export)', String(x.days),
                    iMoney_(x.modal), x.billing, x.phone || x.email || '— none on file —'];
          }));
    }
    if (pend.length) {
      inner += '<h3 style="font-size:14px;margin:20px 0 4px;color:#00254d">Pending business holding money</h3>' +
        '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">"Nobody" means no follow-up task ' +
        'has ever named that policy — it is not being worked.</p>' +
        iTable_(['Client', 'Policy', 'Requirement', 'Age', 'Suspense', 'Chased by'],
          pend.slice(0, 12).map(function (x) {
            return [x.client, x.policy, x.requirement || x.status,
                    x.age === null ? '—' : x.age + ' days', x.suspense ? iMoney_(x.suspense) : '—',
                    x.chase === 'live' ? x.chasedBy
                      : x.chase === 'closed' ? 'chase closed ' + x.chasedOn : 'NOBODY'];
          }));
    }
    if (due.length) {
      inner += '<h3 style="font-size:14px;margin:20px 0 4px;color:#00254d">You said you would come back to these</h3>' +
        iTable_(['Client', 'Policy', 'You noted', 'Due'],
          due.slice(0, 12).map(function (x) { return [x.client, x.policy, x.next || x.note, x.followUp]; }));
    }
    inner += '<p style="margin-top:20px"><a href="' + iEsc_(iAppUrl_()) + '" style="background:#E8A020;' +
      'color:#00254d;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:9px;' +
      'display:inline-block;font-size:14px">Open Branch Intelligence →</a></p>';

    /* The lede counts what is actually below it. "Three things" printed above
       four sections is the kind of small wrongness that teaches people to stop
       reading the top of an e-mail. */
    var blocks = [justLapsed.length, justSlipped.length, urgent.length, pend.length, due.length]
      .filter(function (n) { return n > 0; }).length;
    var words = ['', 'One thing', 'Two things', 'Three things', 'Four things', 'Five things'][blocks] || 'Everything';
    iSend_(person.email, 'Your branch list — ' + Utilities.formatDate(new Date(), iTz_(), 'EEEE d MMMM'),
           iShell_('Good morning, ' + person.name.split(' ')[0],
                   words + ' this morning, and nothing else.', inner));
    sent++;
  });
  return 'Agent digests sent: ' + sent;
}

/* Everyone on an access tab who has an e-mail address, keyed so the same
   person on two tabs is mailed once. */
function iAgentDirectory_() {
  var out = {};
  iAccessTabs_().forEach(function (sh) {
    var head = iHeaders_(sh), last = sh.getLastRow();
    if (last < 2) return;
    var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    var cEmail = iCol_(head, ['email']), cName = iCol_(head, ['name']),
        cRole = iCol_(head, ['role (agent/manager/staff)', 'role']),
        cAgent = iCol_(head, ['agent name (exactly as in data)', 'agent name']),
        cAgtNum = iCol_(head, ['agent number', 'agent id', 'agentid']),
        cMgr = iCol_(head, ['manager email (direct manager)', 'manager email']),
        cActive = iCol_(head, ['active']);
    vals.forEach(function (row) {
      var email = cEmail >= 0 ? iEmail_(row[cEmail]) : '';
      var name = cName >= 0 ? String(row[cName]).trim() : '';
      if (!name) return;
      if (cActive >= 0 && /^(no|inactive|disabled|off)$/i.test(String(row[cActive]).trim())) return;
      var ident = iIdentity_(name,
        cAgent >= 0 ? row[cAgent] : '', cAgtNum >= 0 ? row[cAgtNum] : '');
      var key = iNameKey_(ident.agentName) || ident.agentId;
      if (!key || (out[key] && out[key].email)) return;
      out[key] = {
        name: ident.display, email: email,
        role: cRole >= 0 ? String(row[cRole]).trim() : '',
        agentName: ident.agentName, agentId: ident.agentId,
        manager: cMgr >= 0 ? iEmail_(row[cMgr]) : ''
      };
    });
  });
  return out;
}

function iDueFollowUps_(who) {
  var sh = iActionsTab_(), last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 9).getValues();
  var today = iToday_(), out = [];
  vals.forEach(function (row) {
    var fu = row[8] instanceof Date ? row[8] : iDate_(row[8]);
    if (!fu || fu > today) return;
    if (who && String(row[1]) !== who) return;
    out.push({ client: String(row[4]), policy: String(row[3]), note: String(row[6]),
               next: String(row[7]), followUp: iIso_(fu) });
  });
  return out;
}

function iAppUrl_() { return iProp_('INTEL_APP_URL') || 'https://rickyrampersadbranch.com/intelligence/'; }

/* ── The manager's Monday ─────────────────────────────────────────────────
   Trends, not a list. Where arrears moved since last week, which billing
   method is failing, which agents are carrying the worst ratio — and the
   data-health panel, because a manager acting on a number should know how
   solid it is.                                                             */
function intelManagerDigest() {
  var cache = iLoadCache_();
  if (!cache) return 'No cache — run intelRebuild() first.';
  var to = iProp_('INTEL_MANAGER_EMAIL');
  if (!to) {
    var dir = iAgentDirectory_();
    to = Object.keys(dir).map(function (k) { return dir[k]; })
      .filter(function (p) { return /manager|branch/i.test(p.role) && p.email; })
      .map(function (p) { return p.email; }).join(',');
  }
  if (!to) return 'No manager address — set Script Property INTEL_MANAGER_EMAIL.';

  var d = cache.dues || {}, p = cache.pending || {}, q = cache.reqs || {},
      m = cache.maturity || {}, e = cache.expiry || {}, h = cache.health || {};
  var prev = iPrevSnapshot_();
  var moved = prev ? (d.chaseCount - prev.chaseCount) : null;

  var inner =
    '<table style="width:100%;border-spacing:8px 0"><tr>' +
      iStat_('On the chase list', String(d.chaseCount || 0), (d.chaseCount || 0) ? 'bad' : 'good') +
      iStat_('Instalments at risk', iMoney_(d.modalChase || 0), 'bad') +
      iStat_('Pending cases', String(p.total || 0)) +
    '</tr><tr>' +
      iStat_('Client money in suspense', iMoney_((p.suspense || 0) + (m.suspense || 0)), 'bad') +
      iStat_('Requirements open', String(q.openCount || 0)) +
      iStat_('Open over a year', String(q.overYear || 0), (q.overYear || 0) ? 'bad' : 'good') +
    '</tr></table>';

  var mv = cache.movements || {}, mc = mv.counts || {};
  if (!mv.first && ((mc.lapsed || 0) + (mc.slipped || 0) + (mc.cleared || 0)) > 0) {
    inner += '<p style="font-size:14px;margin:16px 0 0;padding:12px 14px;border-radius:10px;background:#fdf0ee">' +
      '<b>Overnight:</b> ' + (mc.lapsed || 0) + ' lapsed, ' + (mc.slipped || 0) +
      ' slipped into arrears, ' + (mc.cleared || 0) + ' came good.</p>';
  }

  var xs = cache.crosssell || {};
  if (xs.thisWeek) {
    inner += '<p style="font-size:14px;margin:12px 0 0;padding:12px 14px;border-radius:10px;background:#eefaf3">' +
      '<b>' + xs.thisWeek + ' cross-sell calls are ready this week</b> — reachable, paid up, ' +
      'the right age, and a gap worth talking about. ' + (xs.worthACall || 0) + ' more are worth a call.</p>';
  }

  if (moved !== null) {
    inner += '<p style="font-size:14px;margin:16px 0 0;padding:12px 14px;border-radius:10px;background:' +
      (moved > 0 ? '#fdf0ee' : '#eefaf3') + '">The chase list ' +
      (moved > 0 ? 'grew by <b>' + moved + '</b>' : moved < 0 ? 'fell by <b>' + Math.abs(moved) + '</b>' : 'did not move') +
      ' since last Monday.</p>';
  }

  inner += '<h3 style="font-size:14px;margin:22px 0 4px;color:#00254d">How the arrears are aged</h3>' +
    iTable_(['Band', 'Policies', 'Instalments'],
      (d.buckets || []).map(function (b) {
        var v = (d.ageing || {})[b] || { policies: 0, modal: 0 };
        return [b + ' days', String(v.policies), iMoney_(v.modal)];
      }));

  inner += '<h3 style="font-size:14px;margin:22px 0 4px;color:#00254d">Which billing method is failing</h3>' +
    '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">Share of each method\'s policies now overdue. ' +
    'The method is the intervention: a client on a failing method moved to a working one stops recurring here.</p>' +
    iTable_(['Billing method', 'Policies', 'Overdue', 'Rate'],
      (d.byBilling || []).slice(0, 8).map(function (x) {
        return [x.billing, String(x.total), String(x.overdue), Math.round(x.rate * 100) + '%'];
      }));

  inner += '<h3 style="font-size:14px;margin:22px 0 4px;color:#00254d">Agents by share of book on the chase list</h3>' +
    iTable_(['Agent', 'Book', 'Chasing', 'Share', 'Unreachable'],
      (d.byAgent || []).slice(0, 10).map(function (x) {
        return [x.agent, String(x.book), String(x.chase), Math.round(x.rate * 100) + '%', String(x.unreachable)];
      }));

  var r12 = (m.retirement || {}).w12 || 0, l12 = (m.life || {}).w12 || 0,
      t24 = (e.term || {}).w24 || 0, c24 = (e.convertible || {}).w24 || 0;
  inner += '<h3 style="font-size:14px;margin:22px 0 4px;color:#00254d">Is anybody chasing the pending book</h3>' +
    '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">Matched against the follow-up tasks ' +
    'staff raise against head office.</p>' +
    iTable_(['State', 'Cases', 'What it means'], [
      ['Being chased now', String(p.chaseLive || 0), 'an open follow-up task names the policy'],
      ['Chase closed, case open', String(p.chaseClosed || 0), 'closed too early, or the case moved and nobody updated it'],
      ['Never chased', String(p.chaseNever || 0), 'no task has ever named it — it is not being worked']
    ]);

  inner += '<h3 style="font-size:14px;margin:22px 0 4px;color:#00254d">Coming up</h3>' +
    iTable_(['Horizon', 'Count', 'Worth'], [
      ['Pension maturities within 12 months', String(r12), iMoney_((m.retirement || {}).fund12 || 0) + ' of fund'],
      ['Life maturities within 12 months', String(l12), iMoney_((m.life || {}).sum12 || 0) + ' sum insured'],
      ['Term cover ending within 24 months', String(t24), iMoney_((e.term || {}).cover24 || 0) + ' of cover'],
      ['Conversion rights ending within 24 months', String(c24), 'convert without evidence of health']
    ]);

  var stale = (cache.freshness || []).filter(function (f) { return f.missing || (f.ageDays !== null && f.ageDays > 14); });
  if (stale.length) {
    inner += '<h3 style="font-size:14px;margin:22px 0 4px;color:#00254d">Sources that have stopped moving</h3>' +
      '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">The newest dated record in each. ' +
      'Either the extract has not refreshed or the branch genuinely had no activity — both ' +
      'change what the figures above describe.</p>' +
      iTable_(['Source', 'Newest record', 'Age', 'What it feeds'],
        stale.map(function (f) {
          return [f.label, f.missing ? 'tab not found' : f.newest,
                  f.missing ? '—' : f.ageDays + ' days', f.feeds];
        }));
  }

  if ((h.items || []).length) {
    inner += '<h3 style="font-size:14px;margin:22px 0 4px;color:#00254d">How solid these figures are</h3>' +
      iTable_(['Issue', 'Rows', 'What it means'],
        h.items.slice(0, 6).map(function (x) {
          return [x.what, x.of ? x.count + ' of ' + x.of : String(x.count), x.why];
        }));
  }

  inner += '<p style="margin-top:22px"><a href="' + iEsc_(iAppUrl_()) + '" style="background:#E8A020;' +
    'color:#00254d;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:9px;' +
    'display:inline-block;font-size:14px">Open Branch Intelligence →</a></p>';

  iSend_(to, 'Branch Intelligence — week of ' + Utilities.formatDate(new Date(), iTz_(), 'd MMMM yyyy'),
         iShell_('The branch this week', 'Where the money is, and where it is stuck.', inner));
  iSaveSnapshot_(cache);
  return 'Manager digest sent to ' + to;
}

/* A week-on-week comparison needs last week's numbers kept somewhere. Just
   the headline counts — this is a trend line, not a second copy of the book. */
function iSnapshotTab_() {
  return iSheet_('Intel Trend', ['Week of', 'Chase list', 'Instalments at risk', 'Pending',
                                 'Suspense', 'Requirements open', 'Open over a year',
                                 'Pending never chased']);
}
function iSaveSnapshot_(cache) {
  var d = cache.dues || {}, p = cache.pending || {}, q = cache.reqs || {}, m = cache.maturity || {};
  iSnapshotTab_().appendRow([new Date(), d.chaseCount || 0, d.modalChase || 0, p.total || 0,
                             (p.suspense || 0) + (m.suspense || 0), q.openCount || 0, q.overYear || 0,
                             p.chaseNever || 0]);
}
function iPrevSnapshot_() {
  var sh = iSnapshotTab_(), last = sh.getLastRow();
  if (last < 2) return null;
  var row = sh.getRange(last, 1, 1, 7).getValues()[0];
  return { chaseCount: iNum_(row[1]), modalChase: iNum_(row[2]), pending: iNum_(row[3]) };
}

/* ── The month's leads ────────────────────────────────────────────────────
   Ten names, not two hundred. A list an adviser can finish is a list they
   start; a list of everything is a list nobody opens twice. The opening
   question travels with the name, because the gap is only a gap in this
   branch's book and an adviser who opens by telling will be wrong.        */
function intelCrossSellDigest() {
  var cache = iLoadCache_();
  if (!cache) return 'No cache — run intelRebuild() first.';
  var directory = iAgentDirectory_(), sent = 0;

  Object.keys(directory).forEach(function (key) {
    var person = directory[key];
    if (!person.email) return;
    if (iRoleOf_(person.role) !== 'agent') return;
    var mine = iScope_(cache, { role: 'agent', agentName: person.agentName,
                                agentId: person.agentId, name: person.name });
    var xs = mine.crosssell || {};
    var top = (xs.rows || []).filter(function (l) { return l.score >= 70; }).slice(0, 10);
    if (!top.length) return;
    var defs = xs.rules || {};
    function ruleOf(l) { return defs[l.rule] || {}; }
    function alsoOf(l) {
      return (l.allRules || []).filter(function (id) { return id !== l.rule; })
        .map(function (id) { return (defs[id] || {}).title || id; });
    }

    var inner =
      '<table style="width:100%;border-spacing:8px 0"><tr>' +
        iStat_('Ready this week', String(xs.thisWeek || 0), 'good') +
        iStat_('Worth a call', String(xs.worthACall || 0)) +
        iStat_('Clients reviewed', String(xs.clients || 0)) +
      '</tr></table>' +
      '<p style="font-size:13.5px;color:#3d4457;margin:16px 0 4px">Ten names, highest first. ' +
      'Not two hundred — a list you can finish is a list you start.</p>';

    top.forEach(function (l) {
      inner +=
        '<div style="border:1px solid #e2e8f0;border-left:4px solid #E8A020;border-radius:10px;' +
        'padding:14px 16px;margin:12px 0">' +
          '<div style="font-size:16px;font-weight:700;color:#00254d">' + iEsc_(l.client) +
            (l.age !== null && l.age !== undefined ? ' <span style="font-weight:400;color:#5c7590;font-size:13px">· ' + l.age + '</span>' : '') +
            '<span style="float:right;background:#eefaf3;color:#1e8449;border-radius:99px;' +
            'padding:2px 10px;font-size:12px">' + l.score + '</span></div>' +
          '<div style="font-size:13.5px;color:#c0392b;font-weight:600;margin-top:5px">' + iEsc_(ruleOf(l).title) + '</div>' +
          '<div style="font-size:13px;color:#3d4457;margin-top:5px;line-height:1.6">' + iEsc_(ruleOf(l).why) + '</div>' +
          '<div style="font-size:13px;color:#00254d;margin-top:8px;font-style:italic">' +
            '\u201c' + iEsc_(l.askOverride || ruleOf(l).ask) + '\u201d</div>' +
          '<div style="font-size:12px;color:#5c7590;margin-top:8px">' +
            iMoney_(l.size) + ' ' + iEsc_(ruleOf(l).sizeLabel) + ' &nbsp;·&nbsp; holds ' + iEsc_(l.holds) +
            ' &nbsp;·&nbsp; ' + iEsc_(l.phone || l.email || 'no contact on file') +
            (alsoOf(l).length ? '<br>also needs: ' + iEsc_(alsoOf(l).join(' · ')) : '') +
          '</div>' +
        '</div>';
    });

    inner += '<p style="font-size:12.5px;color:#5c7590;margin-top:18px;padding:12px 14px;' +
      'background:#fdf9ee;border-left:3px solid #E8A020;border-radius:0 8px 8px 0;line-height:1.6">' +
      '<b>Ask, do not tell.</b> ' + iEsc_(xs.caveat || '') + '</p>';
    inner += '<p style="margin-top:18px"><a href="' + iEsc_(iAppUrl_()) + '" style="background:#E8A020;' +
      'color:#00254d;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:9px;' +
      'display:inline-block;font-size:14px">See your whole list →</a></p>';

    iSend_(person.email, 'Ten clients worth a call — ' + Utilities.formatDate(new Date(), iTz_(), 'MMMM yyyy'),
           iShell_('Your cross-sell list', 'Built from what each of your clients already holds.', inner));
    sent++;
  });
  return 'Cross-sell digests sent: ' + sent;
}

/* ── The horizon ──────────────────────────────────────────────────────────
   Monthly. A pension maturing needs a year's notice, not a month's — by the
   time a maturity letter arrives from head office the conversation is over.
   Term expiry and conversion rights go to the servicing agent, because those
   are the two the client never knows about.                                */
function intelHorizonWatch() {
  var cache = iLoadCache_();
  if (!cache) return 'No cache — run intelRebuild() first.';
  var directory = iAgentDirectory_(), sent = 0;
  var m = cache.maturity || {}, e = cache.expiry || {};
  var aliasIdx = iAliasIndex_(cache.aliases);

  Object.keys(directory).forEach(function (key) {
    var person = directory[key];
    if (!person.email) return;
    if (iRoleOf_(person.role) !== 'agent') return;
    var pid = iCode_(person.agentId);
    var pGroup = aliasIdx[iNameKey_(person.agentName)];
    if (pGroup === undefined && pid) {
      (cache.aliases || []).forEach(function (g, i) { if (g.code === pid) pGroup = i; });
    }
    function mine(rows, months) {
      return (rows || []).filter(function (x) {
        if (x.months > months) return false;
        if (iSameAgent_(x.agent, person.agentName)) return true;
        if (pid && x.agentId && iCode_(x.agentId) === pid) return true;
        return pGroup !== undefined && aliasIdx[iNameKey_(x.agent)] === pGroup;
      });
    }
    var pens = mine((m.retirement || {}).rows, 18);
    var life = mine((m.life || {}).rows, 18);
    var term = mine((e.term || {}).rows, 24);
    var conv = mine((e.convertible || {}).rows, 36);
    if (!pens.length && !life.length && !term.length && !conv.length) return;

    var inner = '';
    if (pens.length) {
      inner += '<h3 style="font-size:14px;margin:4px 0;color:#00254d">Pensions maturing within 18 months</h3>' +
        '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">Start these now. The decision — annuity, ' +
        'lump sum, or roll into a new plan — is made months before the maturity letter arrives.</p>' +
        iTable_(['Client', 'Plan', 'Matures', 'Fund value', 'Contact'],
          pens.map(function (x) { return [x.client, x.plan, x.matures, iMoney_(x.fund), x.phone || x.email || '— none on file —']; }));
    }
    if (life.length) {
      inner += '<h3 style="font-size:14px;margin:18px 0 4px;color:#00254d">Life policies maturing within 18 months</h3>' +
        iTable_(['Client', 'Plan', 'Matures', 'Sum insured', 'Contact'],
          life.map(function (x) { return [x.client, x.plan, x.matures, iMoney_(x.sumInsured), x.phone || x.email || '— none on file —']; }));
    }
    if (conv.length) {
      inner += '<h3 style="font-size:14px;margin:18px 0 4px;color:#00254d">Conversion rights ending within 3 years</h3>' +
        '<p style="font-size:12.5px;color:#5c7590;margin:0 0 6px">These clients can move to permanent cover ' +
        'with no evidence of health, until the term ends. After that the right is gone and a medical decides.</p>' +
        iTable_(['Client', 'Plan', 'Term ends', 'Cover', 'Contact'],
          conv.map(function (x) { return [x.client, x.plan, x.matures, iMoney_(x.sumInsured), x.phone || x.email || '— none on file —']; }));
    }
    if (term.length) {
      inner += '<h3 style="font-size:14px;margin:18px 0 4px;color:#00254d">Term cover ending within 2 years</h3>' +
        iTable_(['Client', 'Plan', 'Ends', 'Cover ending', 'Contact'],
          term.map(function (x) { return [x.client, x.plan, x.matures, iMoney_(x.sumInsured), x.phone || x.email || '— none on file —']; }));
    }

    iSend_(person.email, 'Your maturities and expiries — ' + Utilities.formatDate(new Date(), iTz_(), 'MMMM yyyy'),
           iShell_('What is coming for your clients',
                   'Nobody else is watching these dates. They arrive as a letter from head office, or they arrive from you first.',
                   inner));
    sent++;
  });
  return 'Horizon notices sent: ' + sent;
}

/* ══════════════════════════════════════════════════════════════════════════
   SETUP AND SAFETY
   ══════════════════════════════════════════════════════════════════════════ */

/* Run this first, and again whenever something behaves oddly. It says which
   tabs it resolved, whether this project already owns doGet/doPost, and how
   weak the access codes are. Everything it reports is a sentence you can act
   on rather than a stack trace. */
function intelSelfTest() {
  var out = [];
  function line(s) { out.push(s); }

  line('BRANCH INTELLIGENCE — self test');
  line('Workbook: ' + iSs_().getName());
  line('Time zone: ' + iTz_() + (iTz_().indexOf('Port_of_Spain') === -1 && iTz_().indexOf('Atlantic') === -1
       ? '   ← should be (GMT-04:00) Atlantic Time, or every trigger fires an hour out' : '   ok'));
  line('');

  line('Tabs resolved by their columns:');
  [['Dues', iTabDues_()], ['In-force book', iTabInforce_()], ['Pending', iTabPending_()],
   ['Requirements', iTabReqs_()], ['Tasks', iTabTasks_()],
   ['Settlement', iTabSettled_()], ['Underwriting', iTabMagnum_()]].forEach(function (p) {
    line('  ' + (p[0] + ':                ').slice(0, 16) +
         (p[1] ? p[1].getName() + '  (' + (p[1].getLastRow() - 1) + ' rows)' : 'NOT FOUND — this domain will be empty'));
  });
  line('');

  var access = iAccessTabs_();
  line('Access lists found: ' + access.length);
  access.forEach(function (sh) {
    var head = iHeaders_(sh);
    var secret = iCol_(head, ['access code', 'password', 'pass', 'pw']);
    line('  ' + sh.getName() + '  (' + (sh.getLastRow() - 1) + ' rows, secret column: ' +
         (secret >= 0 ? head[secret] : 'NONE — nobody on this tab can sign in') + ')');
  });
  if (access.length > 1) {
    line('  NOTE  more than one access list. Sign-in searches all of them, so nobody is');
    line('        locked out — but a person on two lists with two different codes can sign');
    line('        in with either. Consolidate when convenient.');
  }
  line('');

  var weak = iWeakCodes_();
  if (weak.total) {
    line('Access codes: ' + weak.weak + ' of ' + weak.total + ' are weak (' + weak.examples.join(', ') + ')');
    if (weak.weak) line('        Run intelIssueCodes() to replace every weak one with a strong code.');
    if (weak.duplicated) line('        ' + weak.duplicated + ' code(s) are shared by more than one person.');
  }
  line('');

  var hasDoPost = false;
  try { hasDoPost = typeof doPost === 'function'; } catch (err) { hasDoPost = false; }
  var otherRouter = false;
  try { otherRouter = typeof benSignin_ === 'function' || typeof quoteDoPost_ === 'function'; } catch (err2) {}
  if (otherRouter) {
    line('This project already contains another web-app router (BranchEngine).');
    line('  Do NOT keep the doGet/doPost block at the bottom of this file. Instead add');
    line('  this as the FIRST line inside the existing doPost, after it parses the body:');
    line('      var hit = intelRoute_(b); if (hit) return hit;');
    line('  intelRoute_ returns null for anything that is not an intel.* action, so the');
    line('  rest of that function keeps working exactly as it did.');
  } else {
    line('No other router detected — the doGet/doPost block at the bottom of this file is');
    line('  the one that will serve the app. Nothing to change.');
  }
  line('');

  var cache = iLoadCache_();
  line(cache ? 'Cache: built ' + cache.builtAt + ' in ' + cache.seconds + 's'
             : 'Cache: EMPTY — run intelRebuild() once.');
  var triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ['intelRebuild', 'intelAgentDigest', 'intelManagerDigest', 'intelHorizonWatch',
   'intelCrossSellDigest'].forEach(function (f) {
    line('  trigger ' + f + ': ' + (triggers.indexOf(f) !== -1 ? 'installed' : 'MISSING — run intelInstallTriggers()'));
  });
  if (iProp_('INTEL_TEST_TO')) line('');
  if (iProp_('INTEL_TEST_TO')) line('TEST MODE IS ON — all mail goes to ' + iProp_('INTEL_TEST_TO'));

  var text = out.join('\n');
  Logger.log(text);
  return text;
}

/* A one-character access code is not a password. The workbook has several.
   This measures the problem so the self test can name it. */
function iWeakCodes_() {
  var all = [], seen = {}, dup = 0;
  iAccessTabs_().forEach(function (sh) {
    var head = iHeaders_(sh), last = sh.getLastRow();
    if (last < 2) return;
    var c = iCol_(head, ['access code', 'password', 'pass', 'pw']);
    if (c < 0) return;
    sh.getRange(2, c + 1, last - 1, 1).getValues().forEach(function (r) {
      var v = String(r[0]).trim();
      if (!v) return;
      all.push(v);
      if (seen[v]) dup++; else seen[v] = 1;
    });
  });
  var weak = all.filter(function (v) { return v.length < 8 || /^\d+$/.test(v); });
  return {
    total: all.length, weak: weak.length, duplicated: dup,
    examples: weak.slice(0, 3).map(function (v) { return v.length <= 2 ? '"' + v + '"' : v.length + ' chars'; })
  };
}

/* Replace every weak access code with a strong one, in place, and report who
   got what so the branch can hand them out. Codes already 8+ characters and
   not purely numeric are left alone — nobody has to be re-issued twice.

   Read the returned list, distribute it, then clear it from your screen. */
function intelIssueCodes() {
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I, O, 0, 1 — these get read aloud
  var issued = [];
  iAccessTabs_().forEach(function (sh) {
    var head = iHeaders_(sh), last = sh.getLastRow();
    if (last < 2) return;
    var c = iCol_(head, ['access code', 'password', 'pass', 'pw']);
    var cName = iCol_(head, ['name']);
    if (c < 0) return;
    var range = sh.getRange(2, c + 1, last - 1, 1);
    var vals = range.getValues();
    var names = cName >= 0 ? sh.getRange(2, cName + 1, last - 1, 1).getValues() : null;
    var changed = false;
    for (var r = 0; r < vals.length; r++) {
      var cur = String(vals[r][0]).trim();
      var who = names ? String(names[r][0]).trim() : '';
      if (!who && !cur) continue;
      if (cur.length >= 8 && !/^\d+$/.test(cur)) continue;
      var code = '';
      var bytes = Utilities.getUuid().replace(/-/g, '');
      for (var i = 0; i < 10; i++) code += ALPHABET.charAt(parseInt(bytes.substr(i * 2, 2), 16) % ALPHABET.length);
      vals[r][0] = code;
      changed = true;
      issued.push({ tab: sh.getName(), name: who || '(row ' + (r + 2) + ')', code: code });
    }
    if (changed) range.setValues(vals);
  });
  var text = issued.length
    ? 'Re-issued ' + issued.length + ' access codes:\n' +
      issued.map(function (x) { return '  ' + x.name + '   ' + x.code + '   [' + x.tab + ']'; }).join('\n') +
      '\n\nHand these out, then clear this log. Sessions already open are unaffected.'
    : 'Every access code is already strong. Nothing changed.';
  Logger.log(text);
  return text;
}

function intelSetup() {
  iSheet_(INTEL.ACTIONS_TAB, ['When', 'By', 'Domain', 'Policy', 'Client', 'Outcome', 'Note', 'Next step', 'Follow up on']);
  iSessionsTab_();
  iSnapshotTab_();
  var built = intelRebuild();
  var triggers = intelInstallTriggers();
  return 'Built in ' + built.seconds + 's. ' + triggers + '\n\n' + intelSelfTest();
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Branch Intelligence')
      .addItem('Rebuild now', 'intelRebuild')
      .addItem('Self test', 'intelSelfTestDialog_')
      .addSeparator()
      .addItem('Send agent digests now', 'intelAgentDigest')
      .addItem('Send manager digest now', 'intelManagerDigest')
      .addItem('Send horizon notices now', 'intelHorizonWatch')
      .addItem('Send cross-sell lists now', 'intelCrossSellDigest')
      .addSeparator()
      .addItem('Re-issue weak access codes', 'intelIssueCodesDialog_')
      .addToUi();
  } catch (e) { /* no UI in a trigger context */ }
}

function intelSelfTestDialog_() { iDialog_('Self test', intelSelfTest()); }
function intelIssueCodesDialog_() { iDialog_('Access codes', intelIssueCodes()); }
function iDialog_(title, text) {
  var html = HtmlService.createHtmlOutput(
    '<pre style="font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap">' +
    iEsc_(text) + '</pre>').setWidth(720).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

/* ══════════════════════════════════════════════════════════════════════════
   WEB APP ENTRY POINTS
   DELETE THIS BLOCK if this script project already declares doGet/doPost —
   see intelSelfTest(), which tells you which case you are in. A project may
   declare each of them exactly once, and the second declaration silently wins.
   ══════════════════════════════════════════════════════════════════════════ */

function doGet(e) {
  return iJson_({ ok: true, service: 'Branch Intelligence',
                  built: iProp_('INTEL_LAST_BUILD') || 'never' });
}

function doPost(e) {
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var hit = intelRoute_(b);
    if (hit) return hit;
    return iErr_('Unknown action: ' + (b.action || '(none)'));
  } catch (err) {
    return iErr_(String(err && err.message ? err.message : err));
  }
}
