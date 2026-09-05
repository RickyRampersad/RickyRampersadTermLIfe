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

  /* The wall screen is unauthenticated on purpose. It hangs on a wall — there is
     nobody to sign it in, and a token baked into a page served from a public
     repository would be a token anyone could read. So this action carries no
     token, and in exchange it returns ONLY aggregates: counts, money, bands and
     the names of our own agents and units. No client rows ever reach it. Anyone
     who finds the URL learns the branch's arrears summary and nothing about a
     single client. Keep it that way — see iBuildWall45_. */
  if (action === 'intel.wall') return iActWall45_(b);
  if (action === 'intel.delivery') return iActDelivery_(b);
  if (action === 'intel.licence')  return iActLicence_(b);
  if (action === 'intel.possession') return iActPossession_(b);

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

/* ── The 45-day wall ──────────────────────────────────────────────────────
   Feeds /intelligence/wall/. Unauthenticated by design — see the note in
   intelRoute_ — so the ONE rule this function has to keep is that nothing
   client-level leaves it. It returns counts, money, bands, and the names of
   our own agents and units. If you add a field here, ask first whether it
   would identify a client, and if it would, do not add it.

   Arrears are measured from Paid To Date against today, NOT from the tab's
   own Days column. Days is frozen at whatever moment the extract was cut —
   it read 35 for the policies that were genuinely at 45 days on the day this
   was written, because the extract was ten days old. Paid To Date is a fact
   about the policy rather than about the export, so it stays right no matter
   how stale the tab is. What staleness still costs is the policy SET: a
   premium paid since the cut is not in the file, so every count here is an
   upper bound. The wall says so, and asOf tells it when the tab was cut. */
/* The 45-day wall is the first of a series — 60 and 90 follow, and they are
   the same question asked further down the same line. So the band is a
   parameter, not a constant, and one deployed action serves every wall:

     {action:'intel.wall'}             -> 45, the default
     {action:'intel.wall', band:60}    -> the 60-day line
     {action:'intel.wall', band:90}    -> the 90-day line

   Each response also carries `bands`, a one-line summary of all three, so a
   wall can show where its own band sits against the other two without a
   second call. */
function iActWall45_(b) {
  var band = Math.round(iNum_((b && b.band) || 45)) || 45;
  if (IWALL_BANDS.indexOf(band) < 0) {
    return iErr_('Band must be one of ' + IWALL_BANDS.join(', ') + ' — got ' + band + '.');
  }
  var d = iBuildWall45_(band);
  if (d.error) return iErr_(d.error);
  return iOk_({ data: d });
}

var IWALL_BANDS = [45, 60, 90];

/* ── Agents whose book should not count in the branch view ─────────────────
   Set INTEL_EXCLUDE_AGENTS to a comma-separated list of names as the DUES BOOK
   writes them. Matching is on the same normalised key as everywhere else, so
   "Aleema Mohammed-Ali" and "ALEEMA MOHAMMED ALI" are the same person.

   Read this before adding a name. Excluding an agent does NOT settle their
   premiums — it only stops them being counted here. Their clients still owe
   the money and nobody is now looking at it, so an exclusion is a decision to
   hand that book to somebody, not a way to make it disappear. Every screen
   that excludes says how much it removed, for exactly that reason. */
function iExcluded_() {
  var raw = iProp_('INTEL_EXCLUDE_AGENTS');
  var out = {};
  String(raw || '').split(',').forEach(function (n) {
    var k = iNameKey_(n);
    if (k) out[k] = true;
  });
  return out;
}

/* Does this agent name fall under an exclusion?

   Exact keys are not enough, and the delivery wall proved it: the dues book
   writes "Aleema Mohammed-Ali" and the in-force book writes "ALEEMA LEYYA
   MOHAMMED-ALI" — same person, one middle name apart. An exclusion that
   matched one book and not the other put a removed agent back on a screen,
   which is exactly the instruction not being honoured.

   So: exact, or every token of the excluded name present in the candidate
   (and the surnames equal). "Aleema Mohammed Ali" is inside "Aleema Leyya
   Mohammed Ali"; "Meera Persad Khan" is not inside "Mohan Khan". This is
   deliberately NOT the surname-plus-initial test that the security review
   flagged — that one matched different people. */
function iExcludes_(skip, name) {
  var k = iNameKey_(name);
  if (!k) return false;
  if (skip[k]) return true;
  var ks = k.split(' ');
  for (var ex in skip) {
    if (!skip.hasOwnProperty(ex)) continue;
    var es = ex.split(' ');
    if (es.length < 2 || ks.length < 2) continue;
    if (es[es.length - 1] !== ks[ks.length - 1]) continue;   // surnames must match
    var all = true;
    for (var i = 0; i < es.length; i++) if (ks.indexOf(es[i]) < 0) { all = false; break; }
    if (all) return true;
  }
  return false;
}

function iBuildWall45_(target) {
  var sh = iTabDues_();
  if (!sh) return { error: 'No dues tab found.' };

  var d = iReadCols_(sh, {
    agent: ['agent'], clientNo: ['client number'], premium: ['premium'],
    issue: ['issue date'], status: ['status'], paidTo: ['paid to date'],
    billing: ['billing type'], days: ['days']
  });

  var today = iToday_(), DAY = 86400000;
  var TARGET = Math.round(iNum_(target)) || 45;

  /* unit map, keyed on the same normalised name the rest of the file uses */
  var units = iBuildUnits_(), unitOf = {};
  Object.keys(units).forEach(function (u) {
    units[u].forEach(function (m) {
      var k = iNameKey_(m.name);
      if (k) unitOf[k] = u;
    });
  });
  /* An agent written one way on the access list and another on the dues book
     still has to land in their unit — "Joy Barbara Sammah" against a book that
     says "Joy Sammah". Match on every name token being present in the other,
     which joins a dropped middle name and refuses two different people who
     merely share a surname. */
  function unitFor(agent) {
    var k = iNameKey_(agent);
    if (!k) return 'Unassigned';
    if (unitOf[k]) return unitOf[k];
    var ks = k.split(' '), hit = null, n = 0;
    Object.keys(unitOf).forEach(function (o) {
      var os = o.split(' ');
      if (os[os.length - 1] !== ks[ks.length - 1]) return;
      var all = ks.every(function (t) { return os.indexOf(t) >= 0; })
             || os.every(function (t) { return ks.indexOf(t) >= 0; });
      if (all) { hit = unitOf[o]; n++; }
    });
    return n === 1 ? hit : 'Unassigned';
  }

  var sel = [], line = {};
  var over45 = 0, over45Prem = 0, overdue = 0;
  var bandTally = {};
  IWALL_BANDS.forEach(function (b) { bandTally[b] = { band: b, onLine: 0, prem: 0, past: 0, pastPrem: 0 }; });
  var waveBy = {};   // paid-to date → the cohort crossing together
  /* When the extract was cut. Not the newest Paid To Date — a policy only
     appears here BECAUSE it is unpaid, so the newest of those is a floor, not
     the cut date. Paid To Date plus the tab's own frozen Days column names the
     day it was frozen, and thousands of rows agree on one answer; take the
     value they agree on. */
  var cutVotes = {};

  var skip = iExcluded_(), removed = { policies: 0, prem: 0, onLine: 0 };

  for (var r = 0; r < d.rows; r++) {
    if (String(d.get('status', r)).trim() !== '2') continue;
    var paid = iDate_(d.get('paidTo', r));
    if (!paid) continue;
    var days = Math.round((today - paid) / DAY);
    if (days <= 0 || days > 4000) continue;
    if (iExcludes_(skip, d.get('agent', r))) {
      removed.policies++; removed.prem += iNum_(d.get('premium', r));
      if (days === TARGET) removed.onLine++;
      continue;
    }
    overdue++;
    var frozen = iNum_(d.get('days', r));
    if (frozen > 0 && frozen < 2000) {
      var vote = iIso_(new Date(paid.getTime() + frozen * DAY));
      cutVotes[vote] = (cutVotes[vote] || 0) + 1;
    }

    var prem = iNum_(d.get('premium', r));
    if (days >= TARGET) { over45++; over45Prem += prem; }
    IWALL_BANDS.forEach(function (b) {
      if (days === b) { bandTally[b].onLine++; bandTally[b].prem += prem; }
      if (days >= b)  { bandTally[b].past++;   bandTally[b].pastPrem += prem; }
    });

    /* offset: how many days from today this policy crosses 45 */
    var off = TARGET - days;
    if (off >= -7 && off <= 7) {
      if (!line[off]) line[off] = { off: off, n: 0, prem: 0 };
      line[off].n++; line[off].prem += prem;
    }
    if (off > 0 && off <= 14) {
      var key = iIso_(paid);
      if (!waveBy[key]) waveBy[key] = { date: iIso_(new Date(paid.getTime() + TARGET * DAY)),
                                        paidTo: paid, n: 0, prem: 0 };
      waveBy[key].n++; waveBy[key].prem += prem;
    }
    if (days === TARGET) {
      sel.push({ agent: String(d.get('agent', r)).trim(),
                 clientNo: String(d.get('clientNo', r)).trim(),
                 prem: prem,
                 billing: String(d.get('billing', r)).trim() || '(none)',
                 issue: iDate_(d.get('issue', r)) });
    }
  }

  /* tenure bands */
  var BANDS = [['Under 1 year', 0, 1], ['1–2 years', 1, 2], ['2–5 years', 2, 5],
               ['5–10 years', 5, 10], ['10–20 years', 10, 20], ['20 years +', 20, 999]];
  var yrs = [];
  var tenure = BANDS.map(function (b) { return { k: b[0], n: 0, prem: 0 }; });
  sel.forEach(function (x) {
    if (!x.issue) return;
    var y = (today - x.issue) / DAY / 365.25;
    yrs.push(y);
    for (var i = 0; i < BANDS.length; i++) {
      if (y >= BANDS[i][1] && y < BANDS[i][2]) { tenure[i].n++; tenure[i].prem += x.prem; break; }
    }
  });
  yrs.sort(function (a, b) { return a - b; });
  function medianOf(a) { return a.length ? Math.round(a[Math.floor(a.length / 2)] * 10) / 10 : null; }

  /* billing, units, agents */
  var AUTO = { 'Bankers Order': 1, 'Pre Authorized Cheque': 1, 'Salary Deduction': 1,
               'Military Pay': 1, 'Post Dated Cheque': 1 };
  function tally(keyFn, extra) {
    var m = {};
    sel.forEach(function (x) {
      var k = keyFn(x);
      if (!m[k]) { m[k] = { k: k, n: 0, prem: 0, _y: [], _a: {} }; }
      m[k].n++; m[k].prem += x.prem;
      if (x.issue) m[k]._y.push((today - x.issue) / DAY / 365.25);
      m[k]._a[x.agent] = 1;
    });
    return Object.keys(m).map(function (k) {
      var o = m[k]; o._y.sort(function (a, b) { return a - b; });
      var out = { k: o.k, n: o.n, prem: Math.round(o.prem * 100) / 100 };
      if (extra) extra(out, o);
      return out;
    }).sort(function (a, b) { return b.n - a.n || b.prem - a.prem; });
  }

  var billing = tally(function (x) { return x.billing; },
                      function (out) { out.auto = !!AUTO[out.k]; });
  var unitRows = tally(function (x) { return unitFor(x.agent); },
                       function (out, o) { out.agents = Object.keys(o._a).length; });
  var agentRows = tally(function (x) { return x.agent; },
                        function (out, o) { out.med = medianOf(o._y); out.unit = unitFor(o.k); });

  /* the day-by-day line, -7 .. +7, zero-filled so the chart has no holes */
  var lineRows = [];
  for (var off = -7; off <= 7; off++) {
    var e = line[off] || { off: off, n: 0, prem: 0 };
    lineRows.push({ off: off, date: iIso_(new Date(today.getTime() + off * DAY)),
                    n: e.n, prem: Math.round(e.prem * 100) / 100 });
  }

  /* the wave — the biggest single cohort still ahead of the line */
  var wave = null;
  Object.keys(waveBy).forEach(function (k) {
    if (!wave || waveBy[k].n > wave.n) wave = waveBy[k];
  });
  var next7 = 0, next7Prem = 0;
  lineRows.forEach(function (x) { if (x.off > 0) { next7 += x.n; next7Prem += x.prem; } });

  var autoN = 0;
  billing.forEach(function (x) { if (x.auto) autoN += x.n; });

  /* ── The line is fewer conversations than it is policies ──────────────────
     Nearly a third of the branch's overdue book is the same client more than
     once, and worked as policies an agent rings the same person twice in an
     afternoon. Worse, where every one of a client's overdue policies shares a
     billing method AND a paid-to date, it is not several lapses at all — it is
     ONE collection that failed, carrying two or three policies with it. Those
     are the cheapest calls on the list: one conversation, one bank, several
     policies back on the books. Counted here so the screen can say how many
     calls the day actually is. */
  var byClient = {};
  sel.forEach(function (x) {
    var k = x.clientNo || ('_' + x.agent + x.prem);
    (byClient[k] = byClient[k] || []).push(x);
  });
  var households = { clients: 0, multi: 0, multiPolicies: 0, multiPrem: 0,
                     oneMandate: 0, oneMandatePolicies: 0, oneMandatePrem: 0 };
  Object.keys(byClient).forEach(function (k) {
    var v = byClient[k];
    households.clients++;
    if (v.length < 2) return;
    households.multi++; households.multiPolicies += v.length;
    v.forEach(function (x) { households.multiPrem += x.prem; });
    var bills = {};
    v.forEach(function (x) { bills[x.billing] = 1; });
    if (Object.keys(bills).length === 1) {
      households.oneMandate++; households.oneMandatePolicies += v.length;
      v.forEach(function (x) { households.oneMandatePrem += x.prem; });
    }
  });
  households.multiPrem = Math.round(households.multiPrem * 100) / 100;
  households.oneMandatePrem = Math.round(households.oneMandatePrem * 100) / 100;

  var clients = {};
  sel.forEach(function (x) { if (x.clientNo) clients[x.clientNo] = 1; });

  var cut = '', cutN = 0;
  Object.keys(cutVotes).forEach(function (k) { if (cutVotes[k] > cutN) { cutN = cutVotes[k]; cut = k; } });

  return {
    generatedAt: iIso_(today),
    asOf: cut,                    // the day the extract was frozen — everything here is as of then
    headline: { policies: sel.length,
                modal: Math.round(sel.reduce(function (a, x) { return a + x.prem; }, 0) * 100) / 100,
                clients: Object.keys(clients).length },
    wave: wave ? { date: wave.date,
                   label: Utilities.formatDate(new Date(wave.date + 'T12:00:00'), iTz_(), 'EEEE d MMMM'),
                   policies: wave.n, modal: Math.round(wave.prem * 100) / 100,
                   paidTo: Utilities.formatDate(wave.paidTo, iTz_(), 'd MMMM') } : null,
    line: lineRows,
    tenure: tenure.map(function (t) { return { k: t.k, n: t.n, prem: Math.round(t.prem * 100) / 100 }; }),
    tenureMedian: medianOf(yrs),
    billing: billing, autoFail: autoN, units: unitRows, agents: agentRows,
    band: TARGET,
    bands: IWALL_BANDS.map(function (b) {
      var x = bandTally[b];
      return { band: b, onLine: x.onLine, prem: Math.round(x.prem * 100) / 100,
               past: x.past, pastPrem: Math.round(x.pastPrem * 100) / 100 };
    }),
    households: households,
    /* Never silent about what an exclusion took out — see iExcluded_. */
    excluded: { names: Object.keys(iExcluded_()).length,
                policies: removed.policies,
                prem: Math.round(removed.prem * 100) / 100,
                onLine: removed.onLine },
    /* Cross-tabs, so the wall can be clicked into without ever holding a row.
       Ship the 41 rows and a screen in a public room could be filtered down to
       one line — agent, tenure, premium — which for a cohort this small is a
       client in all but name. These are the same slices computed server-side:
       pick any unit, band or billing method and the wall re-renders from a
       breakdown that was always an aggregate. Eighteen small objects. */
    cross: iWall45Cross_(sel, unitFor, BANDS, AUTO),
    survey: iBuildSurveyStats_(), surveyPool: iSurveyPoolSummary_(),
    context: { overdueTotal: overdue, over45: over45,
               over45Prem: Math.round(over45Prem * 100) / 100,
               next7: next7, next7Prem: Math.round(next7Prem * 100) / 100 }
  };
}

/* One breakdown per value of each dimension, each broken down by the other
   two plus its agents. Nothing here is finer than a group. */
function iWall45Cross_(sel, unitFor, BANDS, AUTO) {
  var DAY = 86400000, today = iToday_();
  function bandOf(x) {
    if (!x.issue) return null;
    var y = (today - x.issue) / DAY / 365.25;
    for (var i = 0; i < BANDS.length; i++) if (y >= BANDS[i][1] && y < BANDS[i][2]) return BANDS[i][0];
    return null;
  }
  function slice(rows) {
    function count(keyFn) {
      var m = {};
      rows.forEach(function (x) {
        var k = keyFn(x); if (k == null) return;
        if (!m[k]) m[k] = { k: k, n: 0, prem: 0 };
        m[k].n++; m[k].prem += x.prem;
      });
      return Object.keys(m).map(function (k) {
        return { k: k, n: m[k].n, prem: Math.round(m[k].prem * 100) / 100 };
      }).sort(function (a, b) { return b.n - a.n || b.prem - a.prem; });
    }
    var auto = 0;
    rows.forEach(function (x) { if (AUTO[x.billing]) auto++; });
    return { n: rows.length,
             prem: Math.round(rows.reduce(function (a, x) { return a + x.prem; }, 0) * 100) / 100,
             autoFail: auto,
             tenure: count(bandOf), billing: count(function (x) { return x.billing; }),
             units: count(function (x) { return unitFor(x.agent); }),
             agents: count(function (x) { return x.agent; }) };
  }
  var out = { unit: {}, tenure: {}, billing: {} };
  function group(dim, keyFn) {
    var m = {};
    sel.forEach(function (x) { var k = keyFn(x); if (k == null) return; (m[k] = m[k] || []).push(x); });
    Object.keys(m).forEach(function (k) { out[dim][k] = slice(m[k]); });
  }
  group('unit', function (x) { return unitFor(x.agent); });
  group('tenure', bandOf);
  group('billing', function (x) { return x.billing; });
  return out;
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
                'intelHorizonWatch', 'intelCrossSellDigest', 'intelSurveyFollowUp'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (wanted.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('intelRebuild').timeBased().atHour(2).everyDays(1).create();
  ScriptApp.newTrigger('intelAgentDigest').timeBased().atHour(7).everyDays(1).create();
  ScriptApp.newTrigger('intelManagerDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  ScriptApp.newTrigger('intelHorizonWatch').timeBased().onMonthDay(1).atHour(8).create();
  ScriptApp.newTrigger('intelCrossSellDigest').timeBased().onMonthDay(8).atHour(8).create();
  /* Thanks and follow-ups go out the morning after somebody answers, not at the
     end of the month — a thank-you a fortnight late reads as an audit, not a
     courtesy, and the two-day promise has already been broken by then. */
  ScriptApp.newTrigger('intelSurveyFollowUp').timeBased().atHour(9).everyDays(1).create();
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
  /* A survey click arrives here — it is a link in a mail client, so it can
     only ever be a GET. Everything else keeps the old health response. */
  var hit = iSurveyClick_(e);
  if (hit) return hit;
  return iJson_({ ok: true, service: 'Branch Intelligence',
                  built: iProp_('INTEL_LAST_BUILD') || 'never' });
}

function doPost(e) {
  try {
    /* The private-message form posts form-encoded, not JSON — handle it before
       trying to parse a body that was never JSON in the first place. */
    if (e && e.parameter && e.parameter.s && e.parameter.msg) {
      var page = iSurveyPrivateSend_(e);
      if (page) return page;
    }
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var hit = intelRoute_(b);
    if (hit) return hit;
    return iErr_('Unknown action: ' + (b.action || '(none)'));
  } catch (err) {
    return iErr_(String(err && err.message ? err.message : err));
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   WHAT IS IN OUR POSSESSION — the cabinet, from the in-force book
   ══════════════════════════════════════════════════════════════════════════
   This reads the branch's own in-force export rather than Salesforce, so the
   cabinet wall works today instead of waiting on a field name. When
   intelContractDiscover() settles that field, the Salesforce feed becomes the
   trigger for the LETTERS; this stays the picture of what is sitting here.

   TWO STATES, AND THEY ARE NOT THE SAME JOB
     Dispatch Pending   head office has it. Nothing for the branch to do yet.
     Undelivered        it is in our cabinet and the client does not have it.

   SCOPED TO ONE YEAR, AND THAT CHANGES THE ANSWER COMPLETELY.
   Across all time the book shows 179 undelivered, of which 138 were dispatched
   over a year ago — median eight and a half years. Those are not contracts in
   a cabinet. They are deliveries that happened and were never recorded, and a
   wall counting them sends the branch hunting through 2018.

   From 2026 the picture is real and it is good: 250 contracts dispatched, 216
   delivered, 34 still out. That is a number a branch can work in a morning.
   Set INTEL_DELIVERY_FROM_YEAR to move the floor; everything before it is
   counted once, as history, and never mixed into the live figures.

   DISPATCH PENDING CANNOT BE YEAR-SCOPED, AND PRETENDING OTHERWISE WOULD HIDE
   IT. Those rows carry no dispatch date at all — checked, all 31 of them —
   because head office has not dispatched yet, so there is no date to scope by.
   They are reported on their own line, outside the year, as what they are:
   waiting on head office, with no clock the branch controls.

   NAMES, NOT AGENCIES. The in-force book services business against the agency
   — "ADVANCED INVESTMENTS MANAGEMENT LIMITED" — so the wall used to name a
   company where the branch expects a person. Every row carries a Servicing
   Agent Id, and the access list maps that code to the human, so the join is
   exact and needs no name matching at all. A code that is not on the access
   list keeps whatever name the book gave it, rather than vanishing. */
function iBuildDelivery_() {
  var sh = iTabInforce_();
  if (!sh) return { error: 'No in-force tab found.' };
  var d = iReadCols_(sh, {
    policy: ['policy id'], given: ['given name'], surname: ['surname'], plan: ['plan'],
    email: ['email'], agentId: ['servicing agent id'], agent: ['servcing agent name', 'servicing agent name'],
    dispatch: ['dispatch date'], cat: ['delivery category'],
    aStatus: ['servicing agent status'], aEnd: ['servicing agent contract end date']
  });
  var today = iToday_(), DAY = 86400000;
  var fromYear = iDlvFromYear_();        // live figures start here
  var promise = iDlvDays_();             // the BRANCH promise, in calendar days
  var skip = iExcluded_();

  /* Code → person, and code → unit, both off the access list in one pass. The
     unit map is keyed on the code as well as the name: the name key misses
     every agent whose book is filed under a company. */
  var units = iBuildUnits_(), unitOfCode = {}, unitOfName = {}, personOfCode = {};
  Object.keys(units).forEach(function (u) {
    units[u].forEach(function (m) {
      var c = iCode_(m.id); if (c) { unitOfCode[c] = u; if (m.name) personOfCode[c] = m.name; }
      var k = iNameKey_(m.name); if (k) unitOfName[k] = u;
    });
  });
  function personFor(code, fallback) {
    var p = personOfCode[iCode_(code)];
    return p || String(fallback || '').trim() || '(none)';
  }
  function unitFor(code, name) {
    return unitOfCode[iCode_(code)] || unitOfName[iNameKey_(name)] || 'Unassigned';
  }

  /* ACTIVE ONLY, AND THE IN-FORCE BOOK IS THE ONE THAT KNOWS.
     The book carries Servicing Agent Status against every row — Active,
     Inactive or Vested — and it is more current than the access list: Jesus
     Boodhoo went Inactive on 25 February 2026 and the access list still reads
     Active. Vested is a retired agent still earning renewals; their book is
     serviced but they are not selling, so they are not an active agent either.

     A DEPARTED AGENT'S CONTRACT IS STILL IN OUR CABINET. Filtering them out of
     the roster is right; letting their outstanding contracts vanish with them
     is not — those are precisely the ones nobody is chasing. So they come out
     of the per-agent tallies and go onto their own line. */
  var statusOf = {};
  for (var sr = 0; sr < d.rows; sr++) {
    var sc = iCode_(String(d.get('agentId', sr)).trim());
    if (!sc || statusOf[sc]) continue;
    statusOf[sc] = { status: String(d.get('aStatus', sr)).trim() || 'Unknown',
                     ended: String(d.get('aEnd', sr)).trim() };
  }
  function isActive(code) {
    var st = statusOf[iCode_(code)];
    return !st || /^active$/i.test(st.status);
  }

  var live = [], before = 0, beforeOldest = 0, byCat = {}, dispatchPending = 0;
  var delivered = 0, deliveredWithin = 0, deliveredBefore = 0;
  var gone = [];                         // outstanding, agent no longer active

  for (var r = 0; r < d.rows; r++) {
    var cat = String(d.get('cat', r)).trim();
    if (!cat) continue;
    var rawAgent = String(d.get('agent', r)).trim();
    if (iExcludes_(skip, rawAgent)) continue;
    var code = String(d.get('agentId', r)).trim();

    /* No dispatch date and no year. Head office has not sent it, so it is not
       the branch's clock and not in the branch's year. */
    if (cat === 'Dispatch Pending') { dispatchPending++; continue; }

    var disp = iDate_(d.get('dispatch', r), true);
    var year = disp ? disp.getFullYear() : 0;
    if (year < fromYear) {
      /* History. Counted so the screen can say how much it set aside, and by
         how far, but never mixed into a live figure. */
      before++;
      var oldAge = disp ? Math.round((today - disp) / DAY) : 0;
      if (oldAge > beforeOldest) beforeOldest = oldAge;
      if (cat !== 'Undelivered') deliveredBefore++;
      continue;
    }

    byCat[cat] = (byCat[cat] || 0) + 1;

    /* Everything that is not Undelivered is a delivery that happened, and the
       band says how long it took — the only measure of the branch's own
       service standard this export supports. */
    if (cat !== 'Undelivered') {
      delivered++;
      if (cat === '0-30 Days') deliveredWithin++;
      continue;
    }

    var row = { agent: personFor(code, rawAgent), code: iCode_(code),
                unit: unitFor(code, rawAgent),
                age: disp ? Math.round((today - disp) / DAY) : null,
                plan: String(d.get('plan', r)).trim(),
                policy: String(d.get('policy', r)).trim() };
    if (isActive(code)) live.push(row);
    else {
      row.status = (statusOf[iCode_(code)] || {}).status || 'Unknown';
      row.ended  = (statusOf[iCode_(code)] || {}).ended || '';
      gone.push(row);
    }
  }

  function tally(keyFn) {
    var m = {};
    live.forEach(function (x) {
      var k = keyFn(x); if (k == null) return;
      if (!m[k]) m[k] = { k: k, n: 0, oldest: 0 };
      m[k].n++; if (x.age > m[k].oldest) m[k].oldest = x.age;
    });
    return Object.keys(m).map(function (k) { return m[k]; })
      .sort(function (a, b) { return b.n - a.n || b.oldest - a.oldest; });
  }

  /* Delivered per agent too, so a name with contracts out can be read beside
     what that same person has already got signed for. Six outstanding against
     four delivered is a different conversation from six against forty. */
  var doneBy = {};
  for (var r2 = 0; r2 < d.rows; r2++) {
    var c2 = String(d.get('cat', r2)).trim();
    if (!c2 || c2 === 'Undelivered' || c2 === 'Dispatch Pending') continue;
    var a2 = String(d.get('agent', r2)).trim();
    if (iExcludes_(skip, a2)) continue;
    var dd = iDate_(d.get('dispatch', r2), true);
    if (!dd || dd.getFullYear() < fromYear) continue;
    var id2 = String(d.get('agentId', r2)).trim();
    if (!isActive(id2)) continue;
    var nm2 = personFor(id2, a2);
    if (!doneBy[nm2]) doneBy[nm2] = { done: 0, fast: 0, unit: unitFor(id2, a2) };
    doneBy[nm2].done++;
    if (c2 === '0-30 Days') doneBy[nm2].fast++;
  }

  var BANDS = [['Under 20 days', 0, 20], ['20-30', 20, 31], ['31-60', 31, 61],
               ['61-90', 61, 91], ['91-180', 91, 181], ['Over 180', 181, 99999]];
  var ageing = BANDS.map(function (b) {
    return { k: b[0], n: live.filter(function (x) {
      return x.age !== null && x.age >= b[1] && x.age < b[2]; }).length };
  });
  var ages = live.map(function (x) { return x.age; })
                 .filter(function (a) { return a !== null; }).sort(function (a, b) { return a - b; });

  /* Every agent who touched a 2026 contract, outstanding or not — so the wall
     can show the whole roster rather than only the people in trouble. */
  var agentRows = tally(function (x) { return x.agent; });
  var seen = {};
  agentRows.forEach(function (a) {
    seen[a.k] = 1;
    a.done = (doneBy[a.k] || {}).done || 0;
    a.fast = (doneBy[a.k] || {}).fast || 0;
    a.unit = (live.filter(function (x) { return x.agent === a.k; })[0] || {}).unit ||
             (doneBy[a.k] || {}).unit || 'Unassigned';
  });
  /* An agent with nothing outstanding still belongs on the wall — and their
     unit comes off the delivered rows, because they have no live row to read
     it from. Reading it only from `live` filed every clean agent under
     Unassigned, which reads as a data fault rather than a good month. */
  Object.keys(doneBy).forEach(function (nm) {
    if (seen[nm]) return;
    agentRows.push({ k: nm, n: 0, oldest: 0, done: doneBy[nm].done, fast: doneBy[nm].fast,
                     unit: doneBy[nm].unit || 'Unassigned' });
  });
  agentRows.sort(function (a, b) { return b.n - a.n || b.oldest - a.oldest || b.done - a.done; });

  /* THREE STATES, AND THIS EXPORT ONLY KNOWS ONE OF THEM.
       in the cabinet          received from head office, still on our shelf
       with the agent          handed over, no acknowledgement letter back
       delivered               acknowledged
     "Undelivered" in the in-force book covers the first two together — it has
     no idea whether a contract is on our shelf or in an agent's car. Splitting
     them needs INTEL_SF_HANDED_FIELD and INTEL_SF_ACK_FIELD from the client
     portfolio. Until those are set the screen says undelivered and says why,
     rather than inventing a split and sending the desk to the wrong shelf. */
  var split = { configured: !!(iProp_('INTEL_SF_HANDED_FIELD') && iProp_('INTEL_SF_ACK_FIELD')),
                inCabinet: null, withAgent: null };

  return {
    generatedAt: iIso_(today),
    fromYear: fromYear,
    promise: promise,
    split: split,
    /* s268(1) of the Insurance Act 2018 — twenty BUSINESS days from acceptance
       of the risk, which is roughly 28 calendar days and is the INSURER's duty,
       not the agent's. Carried here as a number the screen can show without
       claiming the branch clock and the statutory clock are the same thing. */
    statutoryBusinessDays: 20,
    headline: { inCabinet: live.length, dispatchPending: dispatchPending,
                overPromise: live.filter(function (x) { return x.age !== null && x.age > promise; }).length,
                oldest: ages.length ? ages[ages.length - 1] : 0,
                median: ages.length ? ages[Math.floor(ages.length / 2)] : 0 },
    ageing: ageing,
    agents: agentRows.slice(0, 24),
    units: tally(function (x) { return x.unit; }),
    plans: tally(function (x) { return x.plan || '(none)'; }).slice(0, 5),
    /* Delivered, and how quickly — the only service-standard measure this
       export supports. */
    history: { delivered: delivered, within30: deliveredWithin,
               pct: delivered ? Math.round(deliveredWithin / delivered * 1000) / 10 : 0,
               dispatched: delivered + live.length,
               rate: (delivered + live.length) ? Math.round(delivered / (delivered + live.length) * 1000) / 10 : 0,
               /* Only bands that describe a completed delivery. Undelivered and
                  Dispatch Pending are states, not durations — listing them beside
                  "0-30 Days" invites reading them as how long delivery took. */
               bands: Object.keys(byCat)
                        .filter(function (k) { return k !== 'Undelivered' && k !== 'Dispatch Pending'; })
                        .map(function (k) { return { k: k, n: byCat[k] }; })
                        .sort(function (a, b) { return b.n - a.n; }) },
    /* What the year floor set aside, said out loud rather than silently
       dropped — a wall that quietly shrinks its own denominator is worse than
       one that shows an ugly number. */
    before: { rows: before, delivered: deliveredBefore,
              undelivered: before - deliveredBefore,
              oldestYears: Math.round(beforeOldest / 365 * 10) / 10 },
    /* Contracts still out against an agent who has left. Off the roster,
       because the roster is active agents; on the screen, because somebody
       has to deliver these and there is no agent left to ask. */
    departed: { n: gone.length,
                oldest: gone.reduce(function (m, x) { return Math.max(m, x.age || 0); }, 0),
                rows: gone.map(function (x) {
                  return { agent: x.agent, status: x.status, ended: x.ended,
                           age: x.age, unit: x.unit }; }) },
    roster: { active: Object.keys(statusOf).filter(function (c) { return isActive(c); }).length,
              inactive: Object.keys(statusOf).filter(function (c) {
                return /^inactive$/i.test((statusOf[c] || {}).status); }).length,
              vested: Object.keys(statusOf).filter(function (c) {
                return /^vested$/i.test((statusOf[c] || {}).status); }).length }
  };
}

function iActDelivery_(b) {
  var d = iBuildDelivery_();
  if (d.error) return iErr_(d.error);
  return iOk_({ data: d });
}

/* ══════════════════════════════════════════════════════════════════════════
   LICENSING — who renews when, and what is still open
   ══════════════════════════════════════════════════════════════════════════
   An agent whose licence lapses cannot write business, and in Trinidad cannot
   lawfully solicit it. The branch already tracks this, in two places that do
   not talk to each other: a field on the agent's Salesforce contact record,
   and a Salesforce task somebody opens a month or two before the date. This
   joins them and puts the year on a wall.

   THE FIELD IS License_Renewal_Month_Life__c, AND IT IS A NUMBER, NOT A DATE.
   Month in that field, day in License_Life_Renewal_Day__c. So the renewal is a
   recurring anniversary, not a one-off — 7 September every year, not
   7 September 2021. The next occurrence is computed here; nothing is read off
   a stored expiry.

   AND DO NOT USE License_Expiry__c. It reads 2020, 2021, 2022 for most of the
   roster — it stopped being maintained years ago. A wall driven off it would
   report almost every agent in the branch as unlicensed, which is both wrong
   and the kind of wrong that gets acted on. Same for
   Last_Renewed_License_Date__c: last renewed 2021 against a licence that has
   plainly been renewed since. The month-and-day anniversary is the only part
   of that record the branch keeps current, so it is the only part used.

   THE TASK TYPE IS A MIXED BUCKET. Lic/Staffing/SA/HR carries licence
   renewals, staff requisitions, appraisals, resignations, device collections
   and receipt books. Counting the bucket would say the branch has sixty open
   licence matters when it has a handful. Only subjects that actually name a
   licence are counted, and the wall says that is what it did.

   ACTIVE AGENTS ONLY. A vested agent still earns renewals but does not sell;
   an inactive one has gone. Neither needs a licence chased, and the in-force
   book's Servicing Agent Status is more current than the access list.
   ══════════════════════════════════════════════════════════════════════════ */

var ILIC = {
  SOON:     45,   // days ahead that counts as "coming up"
  GRACE:    45,   // days after a renewal date that we still ask "was it done?"
  TASKTYPE: 'Lic/Staffing/SA/HR'
};

/* A subject line that is genuinely about a licence. Everything else in that
   task type is staffing or HR and does not belong on this wall. */
function iLicIsLicence_(subject) {
  var s = String(subject || '').toLowerCase();
  if (!/licen[cs]e/.test(s)) return false;
  return /renewal|renew|expir|registration|salesman|provisional|state licen|cpd|reminder|change from/.test(s);
}

/* Which licence a task is about. The branch writes "GUARDIAN GENERAL LICENSE
   APPLICATION", "CBTT Application Dispatched General License" and, for the life
   side, "Salesman License Renewal" or "Sales License Renewal". Anything naming
   general is general; everything else is the life licence, which is the one
   every agent holds. A task naming both — "CPD Platform Renewal (General and
   Life)" — is left on the life side rather than counted twice. */
function iLicKind_(subject) {
  var s = String(subject || '').toLowerCase();
  if (/\bgeneral\b/.test(s) && !/general and life|life and general/.test(s)) return 'General';
  return 'Life';
}

/* The renewal date the branch wrote into the task subject, so it can be held
   against the date on the contact record. Seen in the wild as (13/Oct/2026),
   8/Sept/2026, (7.Jul.2026), (4/June/2026) and "due 18/Aug/2026". */
function iLicSubjectDate_(subject) {
  var m = String(subject || '').match(
    /(\d{1,2})\s*[\/.\- ]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[\/.\- ]\s*(\d{4})/i);
  if (!m) return null;
  var MON = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  var d = new Date(Number(m[3]), MON[m[2].toLowerCase()], Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/* Next occurrence of a month/day anniversary, on or after today. A day past
   the end of a short month lands on that month's last day rather than rolling
   into the next one — 31 in a 30-day month is a data entry, not a date. */
function iLicNextDue_(month, day, today) {
  if (!month) return null;
  var m = Math.round(month), dy = Math.round(day) || 1;
  if (m < 1 || m > 12) return null;
  function make(y) {
    var last = new Date(y, m, 0).getDate();
    return new Date(y, m - 1, Math.min(dy, last));
  }
  var d = make(today.getFullYear());
  if (d < today) d = make(today.getFullYear() + 1);
  return d;
}

function iBuildLicence_() {
  var today = iToday_(), DAY = 86400000;
  var skip = iExcluded_();

  /* THE ROSTER: the access list says who the branch is, the in-force book says
     who is still active. Both, joined on the agent code. */
  var units = iBuildUnits_(), roster = {}, codes = [];
  Object.keys(units).forEach(function (u) {
    units[u].forEach(function (m) {
      var c = iCode_(m.id);
      if (!c || !m.name) return;
      /* Staff have an access code (KD001, SL002) but no agent licence — this
         wall is about people who may lawfully solicit business. Counting the
         desk as four agents missing a licence field is a false alarm four
         times over. */
      if (iRoleOf_(m.role) === 'staff' || iRoleOf_(m.role) === 'staff-lead') return;
      if (!/^A\d/.test(c)) return;                      // agent codes only
      if (iExcludes_(skip, m.name)) return;
      if (roster[c]) return;
      roster[c] = { code: c, name: m.name, unit: u, role: m.role || '' };
      codes.push(c);
    });
  });

  var statusOf = {}, sh = iTabInforce_();
  if (sh) {
    var d = iReadCols_(sh, { agentId: ['servicing agent id'],
                             aStatus: ['servicing agent status'],
                             aEnd: ['servicing agent contract end date'] });
    for (var r = 0; r < d.rows; r++) {
      var c = iCode_(String(d.get('agentId', r)).trim());
      if (!c || statusOf[c]) continue;
      statusOf[c] = { status: String(d.get('aStatus', r)).trim() || 'Unknown',
                      ended: String(d.get('aEnd', r)).trim() };
    }
  }
  var dropped = { inactive: 0, vested: 0, names: [] };
  codes = codes.filter(function (c) {
    var st = (statusOf[c] || {}).status || '';
    var out = /^inactive$/i.test(st) || /^vested$/i.test(st);
    if (!out) return true;
    if (/^inactive$/i.test(st)) dropped.inactive++; else dropped.vested++;
    dropped.names.push({ name: roster[c].name, status: st,
                         ended: (statusOf[c] || {}).ended || '' });
    /* Out of the roster as well as the query. Filtering only the SOQL would
       leave the record here, and one row returned for any other reason would
       put a departed agent back on the wall. */
    delete roster[c];
    return false;
  });

  if (!codes.length) return { error: 'No active agents found on the access list.' };

  /* SALESFORCE. Everything above comes out of the workbook; the licence dates
     themselves exist nowhere else, so if this is not wired the wall says so
     rather than drawing an empty year. */
  var quoted = codes.map(function (c) { return "'" + c.replace(/'/g, '') + "'"; }).join(',');
  var contacts = [], tasks = [], sfError = '';
  try {
    contacts = sfQuery_(
      'SELECT Name, Agent__c, Agent_Type__c, License_Renewal_Month_Life__c, ' +
      'License_Life_Renewal_Day__c, License_Date_Life__c ' +
      'FROM Contact WHERE Agent__c IN (' + quoted + ') ' +
      'AND License_Renewal_Month_Life__c != null');
    /* Agent__c on Contact is the SERVICING agent code, so it is set on the
       agent's own record and on every client that agent services — 195 rows
       came back for 31 codes the first time this was run. The licence month is
       what separates the agent from their book, which is why it is in the
       WHERE clause and not filtered afterwards. */
    tasks = sfQuery_(
      'SELECT Id, Subject, Status, ActivityDate, IsClosed FROM Task ' +
      "WHERE Task_Type__c = '" + ILIC.TASKTYPE + "' " +
      'AND ActivityDate >= LAST_N_MONTHS:15 ORDER BY ActivityDate DESC');
  } catch (err) {
    sfError = String(err && err.message ? err.message : err);
  }

  if (sfError || !contacts.length) {
    return { generatedAt: iIso_(today), configured: false,
             error: sfError || 'Salesforce returned no licence records.',
             roster: { active: codes.length, inactive: dropped.inactive, vested: dropped.vested } };
  }

  /* Licence tasks only, and which agent each one names. Matching is on the
     agent's name appearing in the subject, because the task is not linked to
     the agent's contact record — WhoId is usually the head-office person the
     branch is waiting on, not the agent. */
  var licTasks = [];
  tasks.forEach(function (t) {
    if (!iLicIsLicence_(t.Subject)) return;
    var subj = String(t.Subject || ''), sk = iNameKey_(subj);
    var who = '';
    codes.forEach(function (c) {
      var nm = iNameKey_(roster[c].name);
      if (!nm) return;
      var parts = nm.split(' ');
      /* First name AND surname both present in the subject. Surname alone puts
         every Mohammed on one agent's row. */
      if (parts.length >= 2 &&
          sk.indexOf(parts[0]) >= 0 && sk.indexOf(parts[parts.length - 1]) >= 0) who = c;
    });
    licTasks.push({ code: who, subject: subj, status: String(t.Status || ''),
                    closed: !!t.IsClosed,
                    kind: iLicKind_(subj),
                    due: t.ActivityDate ? iIso_(iDate_(t.ActivityDate)) : '',
                    named: iLicSubjectDate_(subj) });
  });

  var openByCode = {}, anyByCode = {};
  licTasks.forEach(function (t) {
    if (!t.code) return;
    (anyByCode[t.code] = anyByCode[t.code] || []).push(t);
    if (!t.closed) (openByCode[t.code] = openByCode[t.code] || []).push(t);
  });

  /* ONE ROW PER LICENCE, NOT PER AGENT.
     An agent may hold two: a life licence and a general insurance licence, on
     separate anniversaries kept in separate fields. Fourteen of this branch's
     thirty do. Keyed on the agent, half of those renewals would never appear —
     and a general licence lapsing stops general business just as completely.

     So the unit of this wall is the LICENCE. The month strip counts licences,
     the due list names the agent and which of their licences it is, and an
     agent with both shows up twice because they have two dates to keep. */
  var LKINDS = [
    { kind: 'Life',    m: 'License_Renewal_Month_Life__c',
      d: 'License_Life_Renewal_Day__c',      since: 'License_Date_Life__c' },
    { kind: 'General', m: 'License_General_Month_General__c',
      d: 'License_General_Renewal_Day__c',   since: 'License_Date_General__c' }
  ];
  var seen = {}, agents = [], noField = [], placeholder = [];
  contacts.forEach(function (c) {
    var code = iCode_(c.Agent__c);
    if (!roster[code] || seen[code]) return;
    seen[code] = 1;

    LKINDS.forEach(function (K) {
      var since = c[K.since] ? String(c[K.since]) : '';
      /* 1901-01-01 IS NOT A DATE, IT IS AN EMPTY FIELD WEARING ONE. Randolph
         Gonzales's general licence reads 1901-01-01 with month 1 day 1, which
         would put a confident "renews 1 January" on the wall for a licence
         nothing else suggests he holds. Anything before 1950 is a placeholder
         and is reported as a gap rather than a date. */
      if (since && Number(since.slice(0, 4)) < 1950) {
        placeholder.push({ name: roster[code].name, kind: K.kind, value: since.slice(0, 10) });
        return;
      }
      var due = iLicNextDue_(c[K.m], c[K.d], today);
      if (!due) return;
      var days = Math.round((due - today) / DAY);

      /* Did the date just go past? The anniversary rolls to next year the moment
         it passes, so without this a licence that lapsed last week reads as 360
         days away — the single most dangerous thing this screen could do. */
      var last = new Date(due.getFullYear() - 1, due.getMonth(), due.getDate());
      var sinceLast = Math.round((today - last) / DAY);
      var justPassed = sinceLast >= 0 && sinceLast <= ILIC.GRACE;

      /* Tasks are matched on agent AND kind: a general licence application does
         not close out a life renewal, and counting it as though it did would
         report a lapse as handled. */
      function mine(t) { return t.kind === K.kind; }
      var open = (openByCode[code] || []).filter(mine),
          any  = (anyByCode[code] || []).filter(mine);

      /* A task that covers the renewal just gone: closed, and dated in the run-up
         to it. That is the branch's own evidence the renewal was handled. */
      var covered = false;
      any.forEach(function (t) {
        if (!t.closed) return;
        var td = t.named || (t.due ? new Date(t.due) : null);
        if (!td) return;
        var gap = Math.round((last - td) / DAY);
        if (gap >= -ILIC.GRACE && gap <= 120) covered = true;
      });

      /* The task subject often carries its own renewal date. Where it disagrees
         with the contact record by more than a couple of days, one of them is
         wrong and somebody should look — Meera Persad-Khan's differ by fourteen. */
      var clash = null;
      any.forEach(function (t) {
        if (!t.named || clash) return;
        var sameYear = new Date(due.getFullYear(), t.named.getMonth(), t.named.getDate());
        var off = Math.round((sameYear - due) / DAY);
        if (Math.abs(off) > 2 && Math.abs(off) < 200) clash = { days: off, said: iIso_(t.named) };
      });

      agents.push({
        name: roster[code].name, code: code, unit: roster[code].unit,
        role: roster[code].role,
        kind: K.kind,
        /* Salesforce stores the picklist VALUE, which is "Part_Time" — the label
           is "Part Time". An underscore on a wall reads as a broken field. */
        type: String(c.Agent_Type__c || '').replace(/_/g, ' '),
        licensedSince: since ? since.slice(0, 4) : '',
        month: Math.round(c[K.m]),
        day: Math.round(c[K.d]) || 1,
        due: iIso_(due), days: days,
        /* The anniversary that has just gone by. Without it the screen prints
           next September beside "passed yesterday", which reads as a typo and
           undermines the one row that matters. */
        lastDue: iIso_(last),
        justPassed: justPassed, sinceLast: justPassed ? sinceLast : null,
        covered: covered,
        openTasks: open.length,
        openSubjects: open.slice(0, 2).map(function (t) { return t.subject.slice(0, 90); }),
        clash: clash
      });
    });
  });
  /* seen[] is set per CONTACT, so a code missing from it has no licence record
     at all — not merely a missing general one. */
  codes.forEach(function (c) { if (!seen[c]) noField.push(roster[c].name); });

  agents.sort(function (a, b) { return a.days - b.days; });

  /* THE YEAR AHEAD, twelve months from this one. */
  var MN = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
  /* BUCKET BY THE ANNIVERSARY MONTH, NOT BY THE COMPUTED DATE.
     A licence that came up last week has a next-due date thirteen months out,
     which falls off the end of a twelve-month window — so the strip totalled
     28 of 30 and the two missing were the two the branch had just dealt with.
     Bucketing on the month number puts everyone in exactly one column and
     matches how a branch reads it: who comes up in September. */
  var months = [], y = today.getFullYear(), mo = today.getMonth();
  for (var i = 0; i < 12; i++) {
    var yy = y + Math.floor((mo + i) / 12), mm = (mo + i) % 12;
    var inMonth = agents.filter(function (a) { return a.month - 1 === mm; });
    months.push({ k: MN[mm] + (yy !== y ? ' ' + yy : ''), short: MN[mm].slice(0, 3),
                  year: yy, month: mm, n: inMonth.length, current: i === 0,
                  done: inMonth.filter(function (a) { return a.justPassed; }).length,
                  who: inMonth.map(function (a) { return a.name; }) });
  }

  function count(fn) { return agents.filter(fn).length; }
  /* Same rule as the strip. Reading it off the next-due date instead put
     Aidan Eugene and Joy Sammah — who both renewed on the 4th — outside their
     own month. */
  var thisMonth = agents.filter(function (a) { return a.month - 1 === today.getMonth(); });

  function tally(keyFn, pool) {
    var m = {};
    (pool || agents).forEach(function (a) {
      var k = keyFn(a); if (k == null) return;
      if (!m[k]) m[k] = { k: k, n: 0, soon: 0 };
      m[k].n++;
      if (a.days <= ILIC.SOON) m[k].soon++;
    });
    return Object.keys(m).map(function (k) { return m[k]; })
      .sort(function (a, b) { return b.soon - a.soon || b.n - a.n; });
  }

  return {
    generatedAt: iIso_(today),
    configured: true,
    soonDays: ILIC.SOON,
    taskType: ILIC.TASKTYPE,
    headline: {
      active: codes.length,
      /* Licences, not agents — fourteen of the thirty hold two. */
      tracked: agents.length,
      general: agents.filter(function (a) { return a.kind === 'General'; }).length,
      life: agents.filter(function (a) { return a.kind === 'Life'; }).length,
      thisMonth: thisMonth.length,
      soon: count(function (a) { return a.days <= ILIC.SOON; }),
      openTasks: agents.reduce(function (s, a) { return s + a.openTasks; }, 0),
      /* The alarm: a renewal date that has just gone by with no closed task to
         show for it. */
      unconfirmed: count(function (a) { return a.justPassed && !a.covered; })
    },
    thisMonth: thisMonth,
    /* Just-passed first, then by date. A renewal date rolls to next year the
       instant it passes, so sorting on days alone buries last week's lapse at
       the bottom of the list — 360 days away, and the one row that actually
       needs somebody today. */
    soon: agents.filter(function (a) { return a.days <= ILIC.SOON || a.justPassed; })
                .sort(function (a, b) {
                  if (a.justPassed !== b.justPassed) return a.justPassed ? -1 : 1;
                  if (a.justPassed) return a.sinceLast - b.sinceLast;
                  return a.days - b.days;
                }),
    agents: agents,
    months: months,
    units: tally(function (a) { return a.unit; }),
    kinds: tally(function (a) { return a.kind; }),
    types: tally(function (a) { return a.type || 'Not set'; }),
    /* How long each has held a life licence. The branch runs recruits beside
       people licensed since 1993, and the two need reminding differently — a
       first renewal is a form nobody has filled in before. */
    tenure: (function () {
      var B = [['Under 2 years', 0, 2], ['2-5', 2, 5], ['5-10', 5, 10],
               ['10-20', 10, 20], ['Over 20 years', 20, 999]];
      var yr = today.getFullYear();
      return B.map(function (b) {
        var hit = agents.filter(function (a) {
          if (!a.licensedSince) return false;
          var y = yr - Number(a.licensedSince);
          return y >= b[1] && y < b[2];
        });
        return { k: b[0], n: hit.length,
                 soon: hit.filter(function (a) { return a.days <= ILIC.SOON; }).length };
      });
    })(),
    clashes: agents.filter(function (a) { return a.clash; }),
    /* Said out loud, because a name missing from this wall is a name nobody
       is reminding. */
    gaps: { noField: noField,
            licenceTasks: licTasks.length, allTasks: tasks.length,
            unmatched: licTasks.filter(function (t) { return !t.code; }).length,
            /* A general licence field holding 1901-01-01 — an empty field with
               a date in it. Named, because the alternative is a confident wrong
               renewal date on a wall. */
            placeholder: placeholder,
            /* An agent the branch has raised a GENERAL licence task for who has
               no general licence date on their record. Either the date was never
               filled in or the application did not complete — both are worth a
               look, and neither is visible anywhere else. */
            generalNoDate: (function () {
              var haveGen = {};
              agents.forEach(function (a) { if (a.kind === 'General') haveGen[a.code] = 1; });
              var out = {}, list = [];
              licTasks.forEach(function (t) {
                if (t.kind !== 'General' || !t.code || haveGen[t.code] || out[t.code]) return;
                out[t.code] = 1;
                if (roster[t.code]) list.push(roster[t.code].name);
              });
              return list;
            })() },
    roster: { active: codes.length, inactive: dropped.inactive, vested: dropped.vested,
              dropped: dropped.names }
  };
}

function iActLicence_(b) {
  var d = iBuildLicence_();
  if (d.error && !d.roster) return iErr_(d.error);
  return iOk_({ data: d });
}

/* ══════════════════════════════════════════════════════════════════════════
   WHOSE HANDS IS IT IN — the three states of a contract
   ══════════════════════════════════════════════════════════════════════════
   The in-force book knows a contract is "Undelivered" and nothing more. The
   client portfolio in Salesforce knows the three dates that actually matter,
   and they are the three states the branch manages:

     Date_Policy_Contract_Recieved__c        head office sent it, we have it
     Date_Contract_Given_to_Agent__c         an agent collected it
     Date_Ack_Letter_Received_from_Agent__c  the client signed for it

   So:
     IN OUR CABINET     received, not given to any agent. Ours to chase.
     WITH THE AGENT     collected, no acknowledgement letter back. Theirs.
     ACKNOWLEDGED       the client has it and signed.

   THE TWO SOURCES DISAGREE AND IT IS NOT A BUG. The in-force export counts 34
   undelivered in 2026; the portfolio counts 216 not acknowledged. They measure
   different populations — the export is policies still in force and still
   serviced by a branch agent, the portfolio is every contract received. The
   portfolio holds the actual handover and acknowledgement dates, so it is the
   system of record for this question and the wall prefers it. If Salesforce
   does not answer, the wall falls back to the in-force view and says so.

   THE LAW, AND THE HONEST VERSION OF IT — verified against the Act itself, not
   recalled, because earlier drafts of this got it wrong three times.

     s268(1): "In the case of an individual life policy, upon acceptance of the
     risk, an insurer shall issue a policy within twenty business days of
     acceptance of the risk."

   That is the INSURER's clock, it starts at acceptance of the risk, and it
   governs ISSUING — not delivering. Read the Act right through and there is no
   deadline anywhere on getting the issued contract into the client's hands.

   Which is the stronger point, not the weaker one: the statutory clock stops
   at our cabinet door. Everything after it is the branch's, and nobody else's,
   which is exactly why the branch sets its own ten days.

   And it is not only the company's problem, because of a chain of three
   definitions:

     s2:   "intermediary" means an agent, agency, broker, brokerage, sales
           representative and adjuster
     s2:   "registrant" means any person who is registered as an insurer or
           intermediary under this Act
     s266: Registrants and insurance consultants shall comply with the
           standards on market conduct as prescribed in Schedule 11.

   So every agent on this wall is personally a registrant, personally bound by
   the market conduct standards. A contract sitting in a car for eight months
   is that agent's market conduct matter, not the branch's alone.
   ══════════════════════════════════════════════════════════════════════════ */

var IPOSS = {
  OBJECT: 'CLIENT_PORTFOLIO__c',
  OLD:    90        // days with an agent past which it stops being a backlog
};

/* Salesforce writes the unit underscored — "Ricky_Rampersad" — and the access
   list writes it plain. Compared on the key, so neither has to change. */
function iPossUnitKey_(u) { return iNameKey_(String(u || '').replace(/_/g, ' ')); }

function iBuildPossession_() {
  var today = iToday_(), DAY = 86400000;
  var skip = iExcluded_();
  var fromYear = iDlvFromYear_(), promise = iDlvDays_();

  /* The branch's own units, and the code → person and code → unit maps, from
     the access list — same joins as every other screen. */
  var units = iBuildUnits_(), unitKeys = {}, personOfCode = {}, unitOfCode = {};
  Object.keys(units).forEach(function (u) {
    unitKeys[iPossUnitKey_(u)] = u;
    units[u].forEach(function (m) {
      var c = iCode_(m.id);
      if (c) { unitOfCode[c] = u; if (m.name) personOfCode[c] = m.name; }
    });
  });

  /* Employment status from the in-force book, which is more current than the
     access list — see the note in iBuildDelivery_. */
  var statusOf = {}, sh = iTabInforce_();
  if (sh) {
    var f = iReadCols_(sh, { agentId: ['servicing agent id'],
                             aStatus: ['servicing agent status'] });
    for (var r = 0; r < f.rows; r++) {
      var sc = iCode_(String(f.get('agentId', r)).trim());
      if (sc && !statusOf[sc]) statusOf[sc] = String(f.get('aStatus', r)).trim();
    }
  }
  function active(code) { var s = statusOf[iCode_(code)]; return !s || /^active$/i.test(s); }

  var rows = [], sfError = '';
  try {
    rows = sfQuery_(
      'SELECT AgentName__c, Unit__c, Date_Policy_Contract_Recieved__c, ' +
      'Date_Contract_Given_to_Agent__c, Date_Ack_Letter_Received_from_Agent__c ' +
      'FROM ' + IPOSS.OBJECT + ' ' +
      'WHERE Date_Policy_Contract_Recieved__c >= ' + fromYear + '-01-01');
  } catch (err) {
    sfError = String(err && err.message ? err.message : err);
  }
  if (sfError || !rows.length) return { configured: false, error: sfError || 'No portfolio rows.' };

  var cabinet = [], withAgent = [], acked = 0, offBranch = 0, notActive = 0;

  rows.forEach(function (x) {
    var raw = String(x.AgentName__c || '').trim();
    var id = iIdentity_(raw, '', '');
    var code = iCode_(id.agentId), name = personOfCode[code] || id.agentName || '(none)';
    var unit = unitOfCode[code] || unitKeys[iPossUnitKey_(x.Unit__c)] || '';

    if (!unit) { offBranch++; return; }          // another branch's book
    if (iExcludes_(skip, name) || iExcludes_(skip, id.agentName)) return;
    if (!active(code)) { notActive++; return; }

    if (x.Date_Ack_Letter_Received_from_Agent__c) { acked++; return; }

    var got = iDate_(x.Date_Policy_Contract_Recieved__c);
    var gave = iDate_(x.Date_Contract_Given_to_Agent__c);
    if (gave) {
      withAgent.push({ agent: name, code: code, unit: unit,
                       age: Math.round((today - gave) / DAY),
                       held: got ? Math.round((gave - got) / DAY) : null });
    } else {
      cabinet.push({ agent: name, code: code, unit: unit,
                     age: got ? Math.round((today - got) / DAY) : null });
    }
  });

  function stat(list) {
    var a = list.map(function (x) { return x.age; })
                .filter(function (v) { return v !== null; }).sort(function (p, q) { return p - q; });
    return { n: list.length, oldest: a.length ? a[a.length - 1] : 0,
             median: a.length ? a[Math.floor(a.length / 2)] : 0,
             overPromise: a.filter(function (v) { return v > promise; }).length,
             over90: a.filter(function (v) { return v > IPOSS.OLD; }).length };
  }
  function tally(list, keyFn) {
    var m = {};
    list.forEach(function (x) {
      var k = keyFn(x); if (k == null) return;
      if (!m[k]) m[k] = { k: k, n: 0, oldest: 0, over90: 0 };
      m[k].n++;
      if (x.age > m[k].oldest) m[k].oldest = x.age;
      if (x.age > IPOSS.OLD) m[k].over90++;
    });
    return Object.keys(m).map(function (k) { return m[k]; })
      .sort(function (a, b) { return b.n - a.n || b.oldest - a.oldest; });
  }

  var BANDS = [['Under 10 days', 0, 10], ['10-30', 10, 31], ['31-60', 31, 61],
               ['61-90', 61, 91], ['91-180', 91, 181], ['Over 180', 181, 99999]];
  function ageing(list) {
    return BANDS.map(function (b) {
      return { k: b[0], n: list.filter(function (x) {
        return x.age !== null && x.age >= b[1] && x.age < b[2]; }).length };
    });
  }

  /* How long WE take to hand it over, measured only on contracts that were
     handed over — the one part of this the branch controls end to end. */
  var handed = withAgent.map(function (x) { return x.held; })
                        .filter(function (v) { return v !== null && v >= 0; })
                        .sort(function (a, b) { return a - b; });

  var total = cabinet.length + withAgent.length + acked;
  return {
    generatedAt: iIso_(today),
    configured: true,
    fromYear: fromYear,
    promise: promise,
    statutoryBusinessDays: 20,
    total: total,
    acknowledged: acked,
    ackRate: total ? Math.round(acked / total * 1000) / 10 : 0,
    cabinet: stat(cabinet),
    withAgent: stat(withAgent),
    cabinetAgeing: ageing(cabinet),
    agentAgeing: ageing(withAgent),
    byAgent: tally(withAgent, function (x) { return x.agent; }).slice(0, 24),
    byUnit: tally(withAgent, function (x) { return x.unit; }),
    cabinetBy: tally(cabinet, function (x) { return x.agent; }).slice(0, 8),
    handover: { n: handed.length,
                median: handed.length ? handed[Math.floor(handed.length / 2)] : 0,
                sameDay: handed.filter(function (v) { return v === 0; }).length,
                overPromise: handed.filter(function (v) { return v > promise; }).length },
    excluded: { offBranch: offBranch, notActive: notActive }
  };
}

function iActPossession_(b) {
  var d = iBuildPossession_();
  return iOk_({ data: d });
}


/* ══════════════════════════════════════════════════════════════════════════
   CONTRACTS IN OUR POSSESSION — the cabinet
   ══════════════════════════════════════════════════════════════════════════
   Head office sets a contract-received date in Salesforce. Today somebody
   notices, and types an e-mail. This does it instead: the moment that date is
   populated, the client hears from the branch and the agent is copied.

   WHAT THE LAW ACTUALLY SAYS, because the first draft of this got it wrong in
   three ways and they were all client-facing.

     Insurance Act 2018, s268(1): "In the case of an individual life policy,
     upon acceptance of the risk, an insurer shall issue a policy within twenty
     business days of acceptance of the risk."

   1. TWENTY BUSINESS DAYS, not twenty days. That is about 28 calendar days. A
      letter counting calendar days tells a client a deadline has passed when
      it has not — in writing, about a legal obligation.
   2. THE CLOCK STARTS AT ACCEPTANCE OF THE RISK, not when the contract reaches
      our cabinet. By then the insurer has already issued it. Cabinet receipt
      is a later event on a different clock.
   3. THE DUTY IS THE INSURER'S. The Act says "an insurer shall issue". Telling
      a client "your agent must, under the Act" names the wrong party.

   So two clocks, kept apart. The statutory one belongs to the company and is
   quoted accurately or not at all. The branch delivery clock starts when the
   contract lands in our cabinet, and it is OUR service promise — which is the
   honest and stronger thing to write: the law allows twenty business days, we
   aim to be quicker.

   Set INTEL_DELIVERY_DAYS to the branch standard in calendar days (default 10).
   ══════════════════════════════════════════════════════════════════════════ */

var IDLV = {
  TAB:        'Contract Delivery',
  DAYS:       10,          // the BRANCH promise, in calendar days — not the Act's
  FROM_YEAR:  2026,        // live figures start here; everything before is history
  NUDGE:      10,          // second letter this many days after the first
  FINAL:      20,          // third letter this many days after the first
  LIVE_PHRASE:'send to clients',
  MAX_RUN:    80
};

function iDlvDays_()  { return Math.round(iNum_(iProp_('INTEL_DELIVERY_DAYS'))) || IDLV.DAYS; }
function iDlvFromYear_() { return Math.round(iNum_(iProp_('INTEL_DELIVERY_FROM_YEAR'))) || IDLV.FROM_YEAR; }
function iDlvTab_() {
  return iSheet_(IDLV.TAB,
    ['Token', 'Received', 'Policy', 'Client', 'E-mail', 'Agent', 'Agent e-mail', 'Unit',
     'Plan', 'Sent day 0', 'Sent day 10', 'Sent day 20', 'Delivered', 'Delivered by',
     'Asked for', 'Asked at', 'Private sent', 'Opted out', 'Mode']);
}
var IDCOL = { TOKEN:1, RECEIVED:2, POLICY:3, CLIENT:4, EMAIL:5, AGENT:6, AGENTMAIL:7,
              UNIT:8, PLAN:9, D0:10, D10:11, D20:12, DELIVERED:13, DELIVEREDBY:14,
              ASKED:15, ASKEDAT:16, PRIVATE:17, OPTOUT:18, MODE:19 };

/* ── Finding the field, rather than guessing its API name ──────────────────
   "Policy Contract Received date" is the label somebody sees in Salesforce.
   The API name behind it could be anything, and a wrong guess in production
   silently returns nothing rather than failing loudly. So ask Salesforce.

   Run this once. It lists every date field on every object whose label or name
   mentions a contract being received, and prints the two lines to paste into
   Script Properties. */
function intelContractDiscover() {
  var tok = sfToken_();
  var objs = String(iProp_('INTEL_SF_OBJECTS') ||
    'Policy__c,Client_Portfolio__c,Risk_Details__c,Opportunity,Submission__c,Policy_Increases__c')
    .split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  /* Three states, so three dates to find, not one:
       received   head office → our cabinet
       handed     our cabinet → the agent
       acknowledged  the agent → the client, letter back to us
     A field list that only looks for "received" finds a third of the answer. */
  var out = [], missing = [];
  objs.forEach(function (o) {
    var url = tok.instance_url + '/services/data/' + SF.API + '/sobjects/' + o + '/describe';
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok.access_token } });
    if (res.getResponseCode() !== 200) { missing.push(o); return; }
    var d = JSON.parse(res.getContentText());
    (d.fields || []).forEach(function (f) {
      if (f.type !== 'date' && f.type !== 'datetime') return;
      var hay = (f.label + ' ' + f.name).toLowerCase();
      if (!/contract|deliver|receiv|dispatch|acknowledg|ack\b|handed|hand.?over|collect|sign/.test(hay)) return;
      out.push({ obj: o, name: f.name, label: f.label, type: f.type });
    });
  });
  if (!out.length) {
    return 'No date field on ' + objs.join(', ') + ' mentions contract, delivery, receipt or ' +
      'dispatch.' + (missing.length ? ' Could not read: ' + missing.join(', ') + '.' : '') +
      ' Set INTEL_SF_OBJECTS to a comma-separated list of the objects to look in and run again.';
  }
  var lines = out.map(function (f) {
    return '  ' + f.obj + '.' + f.name + '   (' + f.type + ')   "' + f.label + '"';
  });
  return 'Candidate fields:\n' + lines.join('\n') +
    '\n\nThere are three dates to name, not one:\n' +
    '  INTEL_SF_OBJECT           = ' + out[0].obj + '\n' +
    '  INTEL_SF_RECEIVED_FIELD   = when head office\'s contract reached our cabinet\n' +
    '  INTEL_SF_HANDED_FIELD     = when we handed it to the agent\n' +
    '  INTEL_SF_ACK_FIELD        = when the agent\'s acknowledgement came back\n' +
    '\nThe middle two are what split "in the cabinet" from "with the agent, ' +
    'unacknowledged" — the in-force export cannot tell those apart.\n' +
    'Then run intelContractScan().';
}

/* ── Reading the cabinet out of Salesforce ─────────────────────────────────
   Everything is a Script Property because the field names belong to the
   branch's Salesforce, not to this file. Nothing is guessed into a query. */
function iDlvSoql_(sinceDays) {
  var obj = iProp_('INTEL_SF_OBJECT'), fld = iProp_('INTEL_SF_RECEIVED_FIELD');
  if (!obj || !fld) return null;
  var f = {
    received: fld,
    policy:   iProp_('INTEL_SF_POLICY_FIELD')   || 'Name',
    client:   iProp_('INTEL_SF_CLIENT_FIELD')   || 'Client_Name__c',
    email:    iProp_('INTEL_SF_EMAIL_FIELD')    || 'Email__c',
    agent:    iProp_('INTEL_SF_AGENT_FIELD')    || 'Agent_Name__c',
    plan:     iProp_('INTEL_SF_PLAN_FIELD')     || 'Plan__c'
  };
  var cols = [];
  Object.keys(f).forEach(function (k) { if (cols.indexOf(f[k]) < 0) cols.push(f[k]); });
  var since = new Date(iToday_().getTime() - sinceDays * 86400000);
  return { fields: f,
    soql: 'SELECT Id, ' + cols.join(', ') + ' FROM ' + obj +
          ' WHERE ' + fld + ' != NULL AND ' + fld + ' >= ' + iIso_(since) +
          ' ORDER BY ' + fld + ' DESC' };
}

/* Look, and report. Sends nothing. Run this before ever running the sender. */
function intelContractScan() {
  var q = iDlvSoql_(90);
  if (!q) return 'Not configured yet. Run intelContractDiscover() and set ' +
                 'INTEL_SF_OBJECT and INTEL_SF_RECEIVED_FIELD.';
  var recs;
  try { recs = sfQuery_(q.soql); }
  catch (e) { return 'Salesforce said: ' + e.message + '\n\nQuery was:\n' + q.soql; }
  var sh = iDlvTab_(), known = {};
  var last = sh.getLastRow();
  if (last > 1) {
    sh.getRange(2, IDCOL.POLICY, last - 1, 1).getValues()
      .forEach(function (r) { known[String(r[0]).trim()] = 1; });
  }
  var fresh = recs.filter(function (r) { return !known[String(r[q.fields.policy] || '').trim()]; });
  var noMail = fresh.filter(function (r) { return !iEmail_(r[q.fields.email]); }).length;
  return 'Salesforce returned ' + recs.length + ' contracts received in the last 90 days.\n' +
         fresh.length + ' are not yet in the ' + IDLV.TAB + ' tab' +
         (noMail ? ', of which ' + noMail + ' have no usable client e-mail' : '') + '.\n' +
         'Nothing has been sent. intelContractRun() does the sending, and obeys ' +
         'INTEL_SURVEY_LIVE exactly like the client survey.';
}

/* ══════════════════════════════════════════════════════════════════════════
   THE CLIENT SURVEY
   ══════════════════════════════════════════════════════════════════════════
   Every client on the 45-day line gets one e-mail, built from what the
   workbook already knows about them, asking for a single click.

   The framing is deliberate and it is not a collections letter. These are
   mostly people who have paid for years and whose bank mandate quietly
   stopped working — 34 of the 41 on the day this was written. Opening with
   money owed treats a broken standing order like a refusal to pay, and it
   reads that way to somebody who has held cover with us for seven years.
   So the e-mail opens with the years, mentions the collection as a piece of
   admin we noticed on their behalf, and asks one question about the service.
   The premium usually fixes itself once somebody rings the bank; the goodwill
   does not come back if the first contact in seven years was a demand.

   ONE CLICK. Five stars, five links, no form, no login, no app. Whatever
   else is asked comes AFTER the click has landed, on the thank-you page,
   where it is optional.

   ──────────────────────────────────────────────────────────────────────────
   SENDING TO CLIENTS IS OFF BY DEFAULT AND STAYS OFF UNTIL SOMEBODY TYPES A
   SENTENCE.

   iSend_ already routes everything to INTEL_TEST_TO when that property is
   set. That is the right guard for staff digests and the wrong one here,
   because the day somebody clears INTEL_TEST_TO to let the agent digests go
   live, client mail would start flowing too. Client mail therefore has its
   own switch that has nothing to do with the internal one:

     INTEL_SURVEY_LIVE = send to clients        ← exactly this, or nothing sends

   Anything else — unset, "yes", "true", "1" — and the run is a rehearsal:
   it builds every message, writes every row, and delivers to INTEL_TEST_TO
   or, if that is unset too, to nobody at all while still reporting exactly
   what it would have done. Run intelSurveyPreview() first; it renders the
   real messages for real clients into a document you can read without a
   single one of them being sent.
   ══════════════════════════════════════════════════════════════════════════ */

var ISURVEY = {
  TAB:        'Intel Surveys',
  LIVE_PHRASE:'send to clients',
  COOLDOWN:   120,   // days between arrears EPISODES — not between 45/60/90
  EPISODE:    150,   // a letter this recent belongs to the same conversation
  MAX_RUN:    60     // never fire more than this in one go without asking again
};

function iSurveyTab_() {
  return iSheet_(ISURVEY.TAB,
    ['Token', 'Sent', 'Client number', 'Client', 'E-mail', 'Policy', 'Agent', 'Unit',
     'Years in force', 'Band', 'Billing', 'Premium', 'Template',
     'Rating', 'Rated at', 'Heard from agent', 'Comment', 'Mode',
     /* what happened AFTER they answered — see intelSurveyFollowUp */
     'Thanked', 'Follow-up', 'Owner', 'Due', 'Closed', 'Closed by', 'Outcome',
     /* Which of the four taps they used, and WHEN a private message was sent.
        The private message itself is deliberately not here — see the note above
        iSurveyOptionsHtml_. A confidential channel everybody can read is a lie. */
     'Asked for', 'Asked at', 'Private sent', 'Opted out', 'Stage']);
}

/* Columns, by number, because Apps Script counts from 1 and getting this wrong
   writes a rating into somebody's e-mail address. */
var ISCOL = { TOKEN:1, SENT:2, CLIENTNO:3, CLIENT:4, EMAIL:5, POLICY:6, AGENT:7,
              UNIT:8, YEARS:9, BAND:10, BILLING:11, PREMIUM:12, TEMPLATE:13,
              RATING:14, RATEDAT:15, HEARD:16, COMMENT:17, MODE:18,
              THANKED:19, FOLLOWUP:20, OWNER:21, DUE:22, CLOSED:23,
              CLOSEDBY:24, OUTCOME:25, ASKED:26, ASKEDAT:27, PRIVATE:28, OPTOUT:29,
              STAGE:30 };

/* ── The six letters ───────────────────────────────────────────────────────
   One per tenure band, because "thank you for your first eight months" and
   "thank you for your twenty-two years" are not the same sentence and a
   client can tell when a mail merge has not noticed which of them they are.

   Each carries: the subject, the opening, and the line that names what the
   relationship has actually been. `y` is years in force, already rounded. */
var ISURVEY_TEMPLATES = [
  { id: 'first-year', max: 1,
    subject: function (d) { return 'A question about your first year with us'; },
    open: function (d) {
      return 'You took out your policy with the Ricky Rampersad Branch ' +
             (d.months <= 1 ? 'last month' : d.months + ' months ago') +
             '. The first year tells us more than any other about whether we ' +
             'explained things properly at the start.';
    },
    line: function (d) { return 'Cover in force since ' + d.issued + '.'; } },

  { id: 'settling', max: 2,
    subject: function (d) { return 'Two years with the branch — how are we doing?'; },
    open: function (d) {
      return 'You have held cover with us for a little over ' + d.yWord + '. ' +
             'Long enough that we should be getting this right, and early ' +
             'enough that we can still fix anything we are not.';
    },
    line: function (d) { return 'Cover in force since ' + d.issued + '.'; } },

  { id: 'established', max: 5,
    subject: function (d) { return d.yWord + ' with us — thank you'; },
    open: function (d) {
      return 'You have been with the Ricky Rampersad Branch for ' + d.yWord +
             '. That is long past the point where a policy is a purchase — ' +
             'it is a decision you have quietly renewed every month since.';
    },
    line: function (d) { return 'Cover in force since ' + d.issued + ' — ' + d.yWord + '.'; } },

  { id: 'longstanding', max: 10,
    subject: function (d) { return d.yWord + ' of cover — thank you'; },
    open: function (d) {
      return 'You have held cover with this branch for ' + d.yWord + '. ' +
             'In that time premiums have gone out every month without you ' +
             'having to think about it, which is exactly how it should work ' +
             'and exactly why we so rarely say thank you for it.';
    },
    line: function (d) { return 'Cover in force since ' + d.issued + ' — ' + d.yWord + '.'; } },

  { id: 'decade-plus', max: 20,
    subject: function (d) { return d.yWord + ' with the branch — thank you'; },
    open: function (d) {
      return 'You have been insured through this branch for ' + d.yWord + '. ' +
             'Most things do not last that long. We would like to make sure ' +
             'the cover still fits the life you have now, and that whoever ' +
             'looks after you is doing it well.';
    },
    line: function (d) { return 'Cover in force since ' + d.issued + ' — ' + d.yWord + '.'; } },

  { id: 'lifetime', max: 999,
    subject: function (d) { return d.yWord + '. Thank you.'; },
    open: function (d) {
      return d.yWord + ' with the same branch. You were a client here before ' +
             'most of the people now working on your file arrived, and the ' +
             'cover you took out then has been running quietly ever since. ' +
             'We do not take that lightly.';
    },
    line: function (d) { return 'Cover in force since ' + d.issued + ' — ' + d.yWord + '.'; } }
];

function iSurveyTemplate_(years) {
  for (var i = 0; i < ISURVEY_TEMPLATES.length; i++) {
    if (years < ISURVEY_TEMPLATES[i].max) return ISURVEY_TEMPLATES[i];
  }
  return ISURVEY_TEMPLATES[ISURVEY_TEMPLATES.length - 1];
}

/* How the premium is collected, said the way the client experiences it. The
   standing-instruction wording is the whole point of the exercise: it tells
   somebody their bank stopped paying us without once implying they did. */
var ISURVEY_BILLING = {
  'Bankers Order':         { auto: true,  says: 'a standing order from your bank' },
  'Pre Authorized Cheque': { auto: true,  says: 'a pre-authorised debit' },
  'Salary Deduction':      { auto: true,  says: 'a deduction from your salary' },
  'Military Pay':          { auto: true,  says: 'a deduction from your pay' },
  'Post Dated Cheque':     { auto: false, says: 'post-dated cheques' },
  'Direct Bill':           { auto: false, says: 'a bill sent directly to you' }
};

function iSurveyYearsWord_(y) {
  if (y < 1) { var m = Math.max(1, Math.round(y * 12)); return m + (m === 1 ? ' month' : ' months'); }
  var n = Math.floor(y);
  return n + (n === 1 ? ' year' : ' years');
}

/* ── The message ───────────────────────────────────────────────────────────
   Plain, table-based HTML because it has to survive Gmail, Outlook and a
   phone. Inline styles only; no images, no web fonts, no tracking pixel.

   It asks for nothing that a fraudulent copy of it could use. There is no
   password field, no payment link, no attachment and no request for a
   number the client already gave us. The only thing to click is a rating,
   and the page it lands on shows nothing about the client. That matters:
   an insurance e-mail telling somebody their payment failed is exactly the
   shape a phishing mail takes, so this one is built so that following it
   cannot hurt them even if they follow it carelessly. */
/* ══════════════════════════════════════════════════════════════════════════
   THE FOUR TAPS UNDER THE RATING
   ══════════════════════════════════════════════════════════════════════════
   A rating out of five tells you a temperature. It does not tell you that the
   plan is wrong, that somebody has died, that they cannot afford it this year,
   or that they do not want to say any of that to their own agent. So the letter
   offers four more taps, and each one is a different kind of thing.

   WHY THIS IS NOT A CROSS-SELL. Every person receiving this letter is 45 days
   behind on a premium, and iXsellScore_ already scores anyone more than 30 days
   in arrears at ZERO with the reason "behind on existing premiums — this is a
   collections call". Putting a product in front of them here would contradict a
   rule this same system already enforces, and it is poor conduct besides:
   selling to somebody whose payment just failed is how a branch loses the sale
   and the client. So the first tap offers a REVIEW of what they already hold —
   service, and their decision to ask for it — never a product.

   WHY THE PRIVATE LINE IS GENUINELY PRIVATE. "Confidential" that everyone with
   the workbook open can read is a lie told to a client who trusted it. What
   they write is e-mailed to the branch manager and is NOT written into the
   sheet. The sheet records only that a private message was sent and when, so
   the branch can still prove it was received and answered.

   AND IF IT IS ABOUT THE BRANCH MANAGER. A complaints route that ends at the
   person being complained about is not a route. The private page names the
   onward one — the insurer's own complaints unit and the Office of the
   Financial Services Ombudsman — so the client always has somewhere else to go.
   ══════════════════════════════════════════════════════════════════════════ */
var ISURVEY_OPTIONS = [
  { key: 'review',  emoji: '',
    label: 'I would like someone to go through my cover with me',
    note:  'A review of what you already hold. No obligation, and nothing will be sold to you on the call.',
    to:    'agent' },
  { key: 'issue',   emoji: '',
    label: 'Something about my policy is not right',
    note:  'Wrong plan, wrong details, a claim or a change that did not happen.',
    to:    'desk' },
  { key: 'private', emoji: '',
    label: 'I would like to write to the branch manager, privately',
    note:  'Goes to the branch manager and to nobody else. Not to your agent, and not to the office.',
    to:    'manager' },
  { key: 'help',    emoji: '',
    label: 'I would like to talk about my options',
    note:  'Reducing the cover, making it paid-up, or a short arrangement.',
    to:    'manager' },
  { key: 'stop',    emoji: '',
    label: 'Please do not contact me like this again',
    note:  'We will stop. Your cover is not affected in any way.',
    to:    'desk' }
];

/* At 90 days the policy is close to lapsing, and a third letter asking somebody
   to rate the service would be tone-deaf. What a client three months behind
   needs is options, and there are real ones: most of these policies can be
   reduced, paused or made paid-up rather than lost. Offering them is both the
   decent thing and the thing that keeps the policy on the books — a lapsed
   policy earns nothing and a reduced one earns something.

   This is the vulnerability case in every conduct framework worth the name: a
   customer in financial difficulty is offered help before being chased. */
/* ── The branch's own mark and colours ─────────────────────────────────────
   Taken from the site, not invented: favicon.svg is the branch mark — a gold
   shield with a check on near-black navy — and index.html carries the palette.

     --bg    #07131f   near-black navy, the ground everywhere else
     --gold  #efc24b   the brand accent
     --teal  #00CFEA   secondary
     --card  #163553

   Letters stay on white with navy text, because a dark-ground e-mail is hard
   to read and prints badly; the brand arrives through the mark and the gold.

   THE MARK IS A HOSTED PNG, NOT AN SVG AND NOT A DATA URI. Gmail strips SVG
   entirely and blocks data: images, so either choice is a broken logo in the
   client most of the branch's clients use. It is served from the site instead,
   and every letter still reads correctly with images switched off — which is
   the default in most inboxes — because the branch name sits beside it as
   text, not inside the image. */
var IBRAND = {
  NAVY:  '#07131f',
  GOLD:  '#efc24b',
  GOLD2: '#c9942c',
  TEAL:  '#00CFEA',
  INK:   '#16202b',
  MUTED: '#5c6b7a',
  RULE:  '#e2e8ee',
  LOGO:  'https://rickyrampersadbranch.com/logo-mark.png'
};

/* The masthead every client-facing letter opens with. */
function iBrandHead_() {
  return '<table role="presentation" cellpadding="0" cellspacing="0" '
    + 'style="border-collapse:collapse;margin:0 0 22px"><tr>'
    + '<td style="padding-right:13px;vertical-align:middle">'
    + '<img src="' + IBRAND.LOGO + '" width="46" height="46" alt="" '
    + 'style="display:block;width:46px;height:46px;border:0;border-radius:11px"></td>'
    + '<td style="vertical-align:middle;border-left:3px solid ' + IBRAND.GOLD + ';padding-left:13px">'
    + '<div style="font:700 17px Georgia,serif;color:' + IBRAND.NAVY + '">Ricky Rampersad Branch</div>'
    + '<div style="font-size:12.5px;color:' + IBRAND.MUTED + '">Guardian Life &middot; Chaguanas, Trinidad</div>'
    + '</td></tr></table>';
}

function iSurvey90OptionsHtml_(d) {
  var rows = [
    ['Pay what is outstanding', 'Bring it up to date and nothing changes.'],
    ['Reduce the cover', 'A smaller sum assured and a smaller premium. The policy stays alive.'],
    ['Make it paid-up', 'Stop paying, and keep a reduced amount of cover for the rest of the term with nothing more to pay.'],
    ['Ask for time', 'A short arrangement while things settle. Tell us what is realistic.']
  ].map(function (o) {
    return '<tr><td style="padding:9px 12px 9px 0;vertical-align:top;white-space:nowrap;'
      + 'font-weight:600;color:#00254d;border-bottom:1px solid #e2e8ee">' + iEsc_(o[0])
      + '</td><td style="padding:9px 0;border-bottom:1px solid #e2e8ee;color:#3d4c5a">'
      + iEsc_(o[1]) + '</td></tr>';
  }).join('');
  return '<div style="margin:22px 0 0"><p style="margin:0 0 4px;font-weight:600">'
    + 'There is more than one way out of this.</p>'
    + '<p style="margin:0 0 12px;font-size:14px;color:#5c6b7a">Most policies can be '
    + 'reduced or paused rather than lost. Which one is right depends on your plan, '
    + 'so the call is worth having.</p>'
    + '<table style="border-collapse:collapse;width:100%;font-size:14.5px">' + rows + '</table>'
    + '<div style="margin:18px 0 0"><a href="' + d.base + '?s=' + d.token + '&o=help" '
    + 'style="display:block;text-align:center;text-decoration:none;background:' + IBRAND.GOLD + ';'
    + 'color:' + IBRAND.NAVY + ';border-radius:11px;padding:15px;font-weight:700">'
    + 'Ask the branch to call me about my options</a></div></div>';
}

function iSurveyOptionsHtml_(d) {
  var rows = ISURVEY_OPTIONS.map(function (o) {
    return '<a href="' + d.base + '?s=' + d.token + '&o=' + o.key + '" '
      + 'style="display:block;text-decoration:none;color:#16202b;border:1px solid #dde4ec;'
      + 'border-radius:10px;padding:13px 16px;margin:0 0 9px">'
      + '<span style="font-weight:600;color:#00254d">' + iEsc_(o.label) + '</span>'
      + '<span style="display:block;font-size:13px;color:#5c6b7a;margin-top:3px">'
      + iEsc_(o.note) + '</span></a>';
  }).join('');
  return '<div style="margin:26px 0 0"><p style="margin:0 0 4px;font-weight:600">'
    + 'Anything else?</p><p style="margin:0 0 12px;font-size:14px;color:#5c6b7a">'
    + 'Tap one. It goes to the branch, and somebody will be back to you within '
    + '<b>five working days</b>.</p>' + rows + '</div>';
}

function iSurveyHtml_(d) {
  var t = d.tpl, bill = ISURVEY_BILLING[d.billing] || { auto: false, says: d.billing };
  var stars = '';
  for (var i = 1; i <= 5; i++) {
    stars += '<a href="' + d.base + '?s=' + d.token + '&r=' + i + '" ' +
      'style="display:inline-block;width:52px;height:52px;line-height:52px;margin:0 5px;' +
      'text-align:center;font:700 20px Georgia,serif;color:' + IBRAND.NAVY + ';'
      + 'background:' + IBRAND.GOLD + ';' +
      'border-radius:26px;text-decoration:none">' + i + '</a>';
  }

  var payment = bill.auto
    ? '<p style="margin:0 0 14px">Your premium is collected by <b>' + iEsc_(bill.says) +
      '</b>. Our records show the last one did not come through. Nine times out of ten ' +
      'that is the bank rather than anything you have done — a card reissued, an account ' +
      'moved, a change of employer — and a short call to ' + iEsc_(bill.says.indexOf('salary') >= 0 ? 'your payroll office' : 'your bank') +
      ' usually settles it. We wanted you to hear it from us first.</p>'
    : '<p style="margin:0 0 14px">Your premium is billed to you as <b>' + iEsc_(bill.says) +
      '</b>, and our records show the most recent one is outstanding. If it has crossed ' +
      'in the post with this note, please ignore this paragraph.</p>';

  var stage = Number(d.stage) || 45;
  var st = ISURVEY_STAGES[stage] || ISURVEY_STAGES[45];
  /* The second and third letters open on what went before, so the client is
     never asked to start the conversation over. */
  var carried = (!st.first && d.hist)
    ? '<div style="background:#eef4fa;border-left:3px solid #0b7fd4;border-radius:0 9px 9px 0;'
      + 'padding:14px 17px;margin:0 0 16px;font-size:14.5px;color:#3d4c5a">'
      + iEsc_(st.kicker(d.hist)) + '</div>'
    : '';

  return ''
  + '<div style="font:15px/1.62 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
  + 'color:#16202b;max-width:600px;margin:0 auto;padding:0 4px">'

  + iBrandHead_()

  + '<p style="margin:0 0 14px">Dear ' + iEsc_(d.greeting) + ',</p>'
  + carried
  + (st.first ? '<p style="margin:0 0 14px">' + t.open(d) + '</p>' : '')
  + payment

  + '<div style="background:#f4f7fa;border-radius:10px;padding:16px 18px;margin:20px 0">'
  +   '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5c6b7a;'
  +   'font-weight:700;margin-bottom:8px">Your policy with us</div>'
  +   '<div style="font-size:14px;color:#16202b">' + iEsc_(t.line(d)) + '<br>'
  +   'Looked after by <b>' + iEsc_(d.agent) + '</b>.<br>'
  +   'Premium collected by ' + iEsc_(bill.says) + '.</div>'
  + '</div>'

  + (stage >= 90
     ? iSurvey90OptionsHtml_(d)
     : '<p style="margin:0 0 6px"><b>One question, one click.</b></p>'
       + '<p style="margin:0 0 16px">How would you rate the service you have had from '
       + iEsc_(d.agent) + '? Tap a number — that is the whole survey.</p>'
       + '<div style="text-align:center;margin:0 0 8px">' + stars + '</div>'
       + '<table role="presentation" style="width:100%;max-width:340px;margin:0 auto 22px">'
       + '<tr><td style="font-size:11.5px;color:#5c6b7a;text-align:left">1 — poor</td>'
       + '<td style="font-size:11.5px;color:#5c6b7a;text-align:right">5 — excellent</td></tr>'
       + '</table>')
  + iSurveyOptionsHtml_(d)

  + '<p style="margin:22px 0 14px;font-size:13.5px;color:#5c6b7a">'
  +   'Nothing is asked of you beyond that click. We will never ask you for a password, '
  +   'a card number or a payment through an e-mail link — if anything claiming to be '
  +   'from us ever does, it is not from us. To pay a premium or change a bank mandate, '
  +   (d.branchPhone ? 'call the branch on ' + iEsc_(d.branchPhone) + '.' : 'call the branch directly.')
  +   '</p>'

  + '<hr style="border:0;border-top:1px solid #e2e8ee;margin:22px 0 14px">'
  + '<div style="font-size:12.5px;color:#5c6b7a">'
  +   'Ricky Rampersad Branch · Guardian Life of the Caribbean<br>'
  +   'Chaguanas, Trinidad and Tobago' + (d.branchPhone ? ' · ' + iEsc_(d.branchPhone) : '') + '<br>'
  +   'Your agent: ' + iEsc_(d.agent) + (d.agentEmail ? ' · ' + iEsc_(d.agentEmail) : '') + '<br>'
  +   '<span style="color:#8b98a6">Sent because you hold cover with this branch. '
  +   'Reply to this e-mail if you would rather not hear from us again.</span>'
  + '</div></div>';
}

/* ── Preview ───────────────────────────────────────────────────────────────
   Renders one real message per tenure band, for real clients, and mails the
   set to whoever runs it. Nothing reaches a client. Read this before even
   thinking about the live switch. */
function intelSurveyPreview() {
  var pool = iSurveyPool_();
  if (pool.error) return pool.error;
  var seen = {}, out = [], n = 0;
  pool.rows.forEach(function (d) {
    if (seen[d.tpl.id] || n >= 6) return;
    seen[d.tpl.id] = 1; n++;
    d.token = 'PREVIEW'; d.base = iSurveyBase_();
    out.push('<div style="margin:0 0 10px;font:700 13px sans-serif;color:#00254d;'
      + 'background:#e8eef4;padding:8px 12px;border-radius:6px">'
      + iEsc_(d.tpl.id) + ' · ' + iEsc_(d.yWord) + ' · ' + iEsc_(d.billing)
      + ' · would go to ' + iEsc_(d.email || '(no address)') + '</div>'
      + iSurveyHtml_(d)
      + '<hr style="border:0;border-top:2px dashed #c9d4de;margin:34px 0">');
  });
  var to = Session.getActiveUser().getEmail() || iProp_('INTEL_TEST_TO');
  if (!to) return 'No address to send the preview to.';
  MailApp.sendEmail({ to: to, name: 'Branch Intelligence',
    subject: '[PREVIEW] The ' + out.length + ' client survey letters — nothing has been sent',
    htmlBody: '<div style="font:14px sans-serif;background:#fff8e6;border:1px solid #f2c14e;'
      + 'padding:14px 16px;border-radius:8px;margin-bottom:26px">'
      + '<b>This is a preview.</b> These are the real letters for real clients, rendered '
      + 'from live data. Not one has been sent. ' + pool.rows.length + ' clients are in '
      + 'today\'s pool.</div>' + out.join('') });
  return 'Preview of ' + out.length + ' letters sent to ' + to + '. ' +
         pool.rows.length + ' clients would receive one. Nothing went to a client.';
}

/* ── MARKET CONDUCT ────────────────────────────────────────────────────────
   These letters go to clients of a regulated insurer and ask them to rate a
   named adviser. That is market-conduct territory: what goes out has to be
   reviewed by a person before it goes, the branch has to be able to show
   afterwards exactly what was sent, and nobody should be able to change the
   wording after it was cleared.

   So approval is bound to the WORDING, not given once and left. iSurveyHash_
   fingerprints every subject line and every sentence of every template plus
   the rating scale. Approve, and that fingerprint is what gets stored. Change
   a single word and it no longer matches, approval lapses, and the send stops
   until somebody reviews the new wording. That is the control that matters —
   an approval that survives an edit is not an approval.

     INTEL_SURVEY_APPROVED_BY    who reviewed it (a name, recorded on every row)
     INTEL_SURVEY_APPROVED_HASH  the wording they approved — set by intelSurveyApprove()
     INTEL_SURVEY_LIVE           "send to clients", the separate go switch

   All three must be right. Missing or stale approval is a hard stop even when
   the live switch is on, and the reason is reported rather than silently
   swallowed. */
function iSurveyHash_() {
  var parts = [];
  var probe = { yWord: 'X years', months: 9, issued: 'MONTH YEAR', agent: 'AGENT',
                greeting: 'NAME', billing: 'Bankers Order', years: 5 };
  ISURVEY_TEMPLATES.forEach(function (t) {
    parts.push(t.id, String(t.subject(probe)), String(t.open(probe)), String(t.line(probe)));
  });
  Object.keys(ISURVEY_BILLING).sort().forEach(function (k) {
    parts.push(k, ISURVEY_BILLING[k].says, String(ISURVEY_BILLING[k].auto));
  });
  parts.push('scale:1-5');
  /* The thank-you is client-facing too, so it is approved with everything else
     — otherwise the letter is reviewed and the reply nobody read is not. */
  parts.push(iSurveyThanksHtml_({ greeting: 'NAME', agent: 'AGENT', rating: 5, low: false }));
  parts.push(iSurveyThanksHtml_({ greeting: 'NAME', agent: 'AGENT', rating: 1, low: true }));
  ISURVEY_OPTIONS.forEach(function (o) { parts.push(o.key, o.label, o.note); });
  var raw = parts.join('\u0001');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('').slice(0, 16);
}

/* Run this after reading intelSurveyPreview(). It records WHO approved WHICH
   wording, and prints the fingerprint so it can be quoted in a compliance file. */
function intelSurveyApprove(reviewer) {
  var who = String(reviewer || iProp_('INTEL_SURVEY_APPROVED_BY') || '').trim();
  if (!who) return 'Pass the reviewer\'s name: intelSurveyApprove("Kamla Dookran").';
  var h = iSurveyHash_();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('INTEL_SURVEY_APPROVED_BY', who);
  props.setProperty('INTEL_SURVEY_APPROVED_HASH', h);
  props.setProperty('INTEL_SURVEY_APPROVED_ON', iIso_(iToday_()));
  return 'Wording ' + h + ' approved by ' + who + ' on ' + iIso_(iToday_()) +
         '. Any change to a subject line, a letter or the scale voids this.';
}

/* Why a send may not go. Returns '' when everything is in order. */
function iSurveyBlocked_() {
  var approvedHash = iProp_('INTEL_SURVEY_APPROVED_HASH').trim();
  var who = iProp_('INTEL_SURVEY_APPROVED_BY').trim();
  var now = iSurveyHash_();
  if (!approvedHash || !who) {
    return 'No approved wording on file. Read intelSurveyPreview(), then run ' +
           'intelSurveyApprove("<reviewer name>"). Market conduct: somebody has to ' +
           'have seen what goes to clients.';
  }
  if (approvedHash !== now) {
    return 'The wording has changed since ' + who + ' approved it (' + approvedHash +
           ' approved, ' + now + ' now). Re-read intelSurveyPreview() and approve again.';
  }
  return '';
}

/* ══════════════════════════════════════════════════════════════════════════
   45 → 60 → 90: ONE CONVERSATION, NOT THREE SURVEYS
   ══════════════════════════════════════════════════════════════════════════
   A client who is still unpaid at 60 days has already had a letter at 45. The
   second one has to know that. Writing again as though nothing happened is
   what makes a branch look like a system rather than people, and it is exactly
   the complaint clients make about insurers.

   So each letter after the first opens with what went before: that we wrote,
   what they told us, and what was done about it. That last part is the one
   that matters — a client who complained at 45 days and reads a 60-day letter
   that never mentions it has learned the branch does not listen.

   THE PRIVATE MESSAGE IS NEVER QUOTED BACK. If they wrote to the branch
   manager, the later letter says only that they wrote and that it was
   answered. The words stay between them and him. Repeating a confidential
   message in a letter that copies the agent and the desk would break the
   promise the first letter made.

   WHO DOES NOT GET A SECOND LETTER
     opted out                    they asked us to stop; that holds for good
     an open follow-up            we owe THEM a call — see below
     already written at this stage no repeats

   THE OPEN-FOLLOW-UP RULE IS THE IMPORTANT ONE. Asking a client to rate the
   branch again while their unresolved complaint sits open is the single worst
   thing this system could do. Answer them first; the letter waits.

   AND THE COOLDOWN HAD TO CHANGE. It was 120 days between letters, which
   silently made the 60 and 90 day letters impossible — the sequence would have
   stopped dead after the first one and nobody would have seen why. It now
   governs the gap between ARREARS EPISODES, while 45/60/90 inside one episode
   run as the single conversation they are.
   ══════════════════════════════════════════════════════════════════════════ */
var ISURVEY_STAGES = {
  45: { stage: 45, first: true,
        kicker: function () { return ''; } },
  60: { stage: 60, first: false,
        kicker: function (h) {
          return 'We wrote to you on ' + h.when + '. ' + h.said +
                 ' The premium is still outstanding, which is why you are hearing from us again.';
        } },
  90: { stage: 90, first: false,
        kicker: function (h) {
          return 'This is our third note. We wrote on ' + h.when + '. ' + h.said +
                 ' Three months of premiums are now outstanding, and at this point the ' +
                 'policy is close to lapsing — so this letter is about what we can do ' +
                 'about that, not about asking you to rate us again.';
        } }
};

/* What to say about what happened last time. Never the private words. */
function iSurveyHistoryLine_(row) {
  var rating = Number(row[ISCOL.RATING - 1]);
  var asked  = String(row[ISCOL.ASKED - 1] || '');
  var closed = row[ISCOL.CLOSED - 1];
  var outcome = String(row[ISCOL.OUTCOME - 1] || '').trim();
  var bits = [];

  if (asked.indexOf('private') >= 0) {
    bits.push('You wrote to the branch manager privately' +
      (row[ISCOL.PRIVATE - 1] instanceof Date ? '' : '') + ', and he has your note.');
  }
  if (rating >= 1 && rating <= 5) bits.push('You rated us ' + rating + ' out of 5.');
  if (asked.indexOf('review') >= 0) bits.push('You asked for a review of your cover.');
  if (asked.indexOf('issue') >= 0)  bits.push('You told us something was not right.');
  if (!bits.length) bits.push('We did not hear back, which is fair enough — you may not have wanted to.');
  if (closed instanceof Date && outcome && outcome !== '(none recorded)') {
    bits.push('What we did about it: ' + outcome + '.');
  } else if (closed instanceof Date) {
    bits.push('That has since been dealt with.');
  }
  return bits.join(' ');
}

/* Everything already sent to this client in the current arrears episode. */
function iSurveyHistory_(sh, clientNo, today) {
  var last = sh.getLastRow();
  if (last < 2 || !clientNo) return null;
  var wide = Math.max(sh.getLastColumn(), ISCOL.STAGE);
  var vals = sh.getRange(2, 1, last - 1, wide).getValues();
  var DAY = 86400000, best = null;
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][ISCOL.CLIENTNO - 1]).trim() !== clientNo) continue;
    var sent = vals[r][ISCOL.SENT - 1];
    if (!(sent instanceof Date)) continue;
    if ((today - sent) / DAY > ISURVEY.EPISODE) continue;      // a previous episode
    if (!best || sent > best.sent) {
      best = { sent: sent, row: vals[r], idx: r,
               stage: Number(vals[r][ISCOL.STAGE - 1]) || 45,
               open: !!String(vals[r][ISCOL.FOLLOWUP - 1]).trim() &&
                     !String(vals[r][ISCOL.CLOSED - 1]).trim() };
    }
    /* any stage already used in this episode blocks a repeat of it */
    best = best || null;
  }
  if (!best) return null;
  var stages = {};
  vals.forEach(function (v) {
    if (String(v[ISCOL.CLIENTNO - 1]).trim() !== clientNo) return;
    var st = v[ISCOL.SENT - 1];
    if (st instanceof Date && (today - st) / DAY <= ISURVEY.EPISODE) {
      stages[Number(v[ISCOL.STAGE - 1]) || 45] = 1;
    }
  });
  best.stagesUsed = stages;
  best.when = Utilities.formatDate(best.sent, iTz_(), 'd MMMM');
  best.said = iSurveyHistoryLine_(best.row);
  return best;
}

function iSurveyBase_() {
  return iProp_('INTEL_EXEC_URL') || ScriptApp.getService().getUrl() || '';
}

/* ── Who gets one ──────────────────────────────────────────────────────────
   Today's 45-day cohort, which is the whole idea: the moment a long-standing
   client's payment stops is the moment worth reaching out, and it is early
   enough that the reaching out is a courtesy rather than a chase.

   Excluded: anybody with no usable e-mail, anybody surveyed inside the
   cooldown, and anybody whose policy has been in force less than 90 days —
   a brand-new client whose first collection failed is a servicing call from
   their agent, not a letter about how long they have been with us. */
function iSurveyPool_(stage) {
  stage = Math.round(iNum_(stage)) || 45;
  if (!ISURVEY_STAGES[stage]) return { error: 'Stage must be 45, 60 or 90.' };
  var sh = iTabDues_();
  if (!sh) return { error: 'No dues tab found.' };
  var d = iReadCols_(sh, {
    agent: ['agent'], number: ['number'], clientNo: ['client number'], client: ['client'],
    premium: ['premium'], issue: ['issue date'], status: ['status'],
    paidTo: ['paid to date'], billing: ['billing type'], email: ['email']
  });

  var today = iToday_(), DAY = 86400000;
  var units = iBuildUnits_(), unitOf = {}, mailOf = {};
  Object.keys(units).forEach(function (u) {
    units[u].forEach(function (m) { var k = iNameKey_(m.name); if (k) unitOf[k] = u; });
  });
  iAccessTabs_().forEach(function (sh2) {
    var head = iHeaders_(sh2), last = sh2.getLastRow();
    if (last < 2) return;
    var cN = iCol_(head, ['name']), cE = iCol_(head, ['email']);
    if (cN < 0 || cE < 0) return;
    sh2.getRange(2, 1, last - 1, sh2.getLastColumn()).getValues().forEach(function (row) {
      var id = iIdentity_(row[cN], '', '');
      var k = iNameKey_(id.agentName || row[cN]);
      if (k && row[cE]) mailOf[k] = iEmail_(row[cE]);
    });
  });

  var recent = {}, stopped = {}, sh3 = iSurveyTab_(), last3 = sh3.getLastRow();
  if (last3 > 1) {
    var wide3 = Math.max(sh3.getLastColumn(), ISCOL.OPTOUT);
    sh3.getRange(2, 1, last3 - 1, wide3).getValues().forEach(function (r) {
      var when = r[ISCOL.SENT - 1], who = String(r[ISCOL.CLIENTNO - 1]).trim();
      if (when instanceof Date && (today - when) / DAY < ISURVEY.COOLDOWN) recent[who] = 1;
      /* "Please do not contact me like this again" has to mean it, on every
         policy they hold and not just the one they were written to about.
         An opt-out that still sends is worse than never offering one. */
      if (String(r[ISCOL.OPTOUT - 1] || '').trim() && who) stopped[who] = 1;
    });
  }

  var skip = iExcluded_();
  var rows = [], skipped = { noEmail: 0, cooldown: 0, tooNew: 0, excluded: 0,
                             optedOut: 0, openFollowUp: 0, alreadyAtStage: 0 };
  for (var r = 0; r < d.rows; r++) {
    if (String(d.get('status', r)).trim() !== '2') continue;
    var paid = iDate_(d.get('paidTo', r));
    if (!paid || Math.round((today - paid) / DAY) !== stage) continue;
    /* A letter names the agent looking after them. Sending one under the name
       of somebody the branch has taken off its books invites the reply nobody
       wants: "she left months ago, who has my file now?" */
    if (iExcludes_(skip, d.get('agent', r))) { skipped.excluded++; continue; }

    var issue = iDate_(d.get('issue', r));
    var years = issue ? (today - issue) / DAY / 365.25 : 0;
    if (years * 365.25 < 90) { skipped.tooNew++; continue; }

    var clientNo = String(d.get('clientNo', r)).trim();
    if (stopped[clientNo]) { skipped.optedOut++; continue; }

    var hist = iSurveyHistory_(sh3, clientNo, today);
    if (hist) {
      /* We owe them a call. Asking them to rate us again while their complaint
         sits open is the worst thing this could do — answer them first. */
      if (hist.open) { skipped.openFollowUp++; continue; }
      if (hist.stagesUsed[stage]) { skipped.alreadyAtStage++; continue; }
    } else if (recent[clientNo]) {
      /* No history inside this episode but written to recently — a previous
         arrears episode that is still inside the cooldown. */
      skipped.cooldown++; continue;
    }

    var email = iEmail_(d.get('email', r));
    if (!email) { skipped.noEmail++; continue; }

    var agent = String(d.get('agent', r)).trim();
    var client = String(d.get('client', r)).trim();
    var nk = iNameKey_(agent);
    rows.push({
      clientNo: clientNo, client: client,
      greeting: iSurveyGreeting_(client),
      email: email, policy: String(d.get('number', r)).trim(),
      agent: agent, agentEmail: mailOf[nk] || '',
      unit: unitOf[nk] || 'Unassigned',
      years: Math.round(years * 10) / 10, yWord: iSurveyYearsWord_(years),
      months: Math.max(1, Math.round(years * 12)),
      issued: issue ? Utilities.formatDate(issue, iTz_(), 'MMMM yyyy') : 'record unclear',
      billing: String(d.get('billing', r)).trim() || 'Direct Bill',
      premium: iNum_(d.get('premium', r)),
      /* Set INTEL_BRANCH_PHONE and the letter tells clients where to ring
         instead of pointing at a number that is not there. Without it the
         wording changes rather than leaving a dangling "see below". */
      branchPhone: iProp_('INTEL_BRANCH_PHONE'),
      stage: stage, hist: hist,
      tpl: iSurveyTemplate_(years)
    });
  }
  /* One letter per client, not per policy. Somebody holding four policies
     gets one note about the longest-standing of them, because four identical
     thank-yous in one inbox is the opposite of feeling looked after. */
  var byClient = {};
  rows.forEach(function (x) {
    var k = x.clientNo || x.email;
    if (!byClient[k] || x.years > byClient[k].years) byClient[k] = x;
  });
  return { rows: Object.keys(byClient).map(function (k) { return byClient[k]; }), skipped: skipped };
}

/* "MOHAMMED, FATIMA" and "RAMPERSAD-SINGH, ANN MARIE" both have to come out
   as something you would actually write at the top of a letter. Surname-first
   with a comma is the extract's format; take the given names, title-case
   them, and fall back to a neutral greeting rather than shouting a name in
   capitals at somebody who has been a client for twenty years. */
function iSurveyGreeting_(name) {
  var s = String(name || '').trim();
  if (!s) return 'Valued client';
  var parts = s.split(',');
  var given = parts.length > 1 ? parts[1] : parts[0];
  given = String(given).trim().split(/\s+/)[0] || '';
  if (!/^[A-Za-z'’-]{2,}$/.test(given)) return 'Valued client';
  return given.charAt(0).toUpperCase() + given.slice(1).toLowerCase();
}

/* ── Sending ───────────────────────────────────────────────────────────────
   Copies the agent, the support desk and the unit manager on every letter,
   so the three people who might get a reply all know it went out and what it
   said. The client is the only address in To; the rest are Cc, because a
   client should be able to see who at the branch is looking after them. */
function intelSurveySend(stage) {
  stage = Math.round(iNum_(stage)) || 45;
  var live = iProp_('INTEL_SURVEY_LIVE').trim().toLowerCase() === ISURVEY.LIVE_PHRASE;
  var test = iProp_('INTEL_TEST_TO');
  /* A live send with no current approval is the one thing this must not do,
     however the switch is set. Test and dry runs still go, because reviewing
     is exactly what they are for. */
  var blocked = iSurveyBlocked_();
  if (live && blocked) return 'STOPPED — ' + blocked;
  var pool = iSurveyPool_(stage);
  if (pool.error) return pool.error;

  var rows = pool.rows;
  if (!rows.length) return 'Nobody is on the ' + stage + '-day line with a usable address today. '
    + JSON.stringify(pool.skipped);
  if (rows.length > ISURVEY.MAX_RUN) {
    return 'STOPPED. ' + rows.length + ' clients are in the pool, over the ' + ISURVEY.MAX_RUN +
           ' cap. That usually means a billing cohort has landed rather than a normal day. ' +
           'Look at it, then raise ISURVEY.MAX_RUN deliberately if it is right.';
  }

  var sh = iSurveyTab_(), base = iSurveyBase_(), sent = 0;
  var support = iSurveySupport_(), mode = live ? 'live' : (test ? 'test' : 'dry');

  rows.forEach(function (d) {
    d.token = Utilities.getUuid().replace(/-/g, '');
    d.base = base;
    var html = iSurveyHtml_(d);
    var cc = [d.agentEmail, support.desk, support.managerFor(d.unit)]
               .filter(function (x) { return x; })
               .filter(function (x, i, a) { return a.indexOf(x) === i; }).join(',');

    if (mode === 'live') {
      MailApp.sendEmail({ to: d.email, cc: cc, name: 'Ricky Rampersad Branch',
                          subject: d.tpl.subject(d), htmlBody: html });
      sent++;
    } else if (mode === 'test') {
      MailApp.sendEmail({ to: test, name: 'Branch Intelligence',
        subject: '[TEST] ' + d.tpl.subject(d),
        htmlBody: '<div style="background:#E8A020;color:#00254d;padding:10px 14px;'
          + 'font:700 13px sans-serif;border-radius:8px;margin-bottom:14px">TEST MODE — '
          + 'this would have gone to ' + iEsc_(d.email) + ', copying ' + iEsc_(cc || 'nobody')
          + '</div>' + html });
      sent++;
    }
    sh.appendRow([d.token, new Date(), d.clientNo, d.client, d.email, d.policy, d.agent,
                  d.unit, d.years, d.tpl.id, d.billing, d.premium, d.tpl.id,
                  '', '', '', '', mode + (live ? ' · cleared ' + iSurveyHash_() + ' by ' + iProp_('INTEL_SURVEY_APPROVED_BY') : ''),
                  '', '', '', '', '', '', '',      // follow-up block, filled later
                  '', '', '', '',                   // the four taps
                  stage]);
  });

  if (mode === 'live') return 'Sent ' + sent + ' day-' + stage + ' letters to clients, copying agents, '
    + 'the desk and unit managers. ' + JSON.stringify(pool.skipped);
  if (mode === 'test') return 'TEST MODE. ' + sent + ' day-' + stage + ' letters built and routed to ' + test +
    '. No client was written to. Set INTEL_SURVEY_LIVE to "' + ISURVEY.LIVE_PHRASE + '" when you mean it.';
  return 'DRY RUN. ' + rows.length + ' letters built and logged, none delivered — ' +
    'INTEL_SURVEY_LIVE is not set to "' + ISURVEY.LIVE_PHRASE + '" and INTEL_TEST_TO is empty.';
}

/* The desk and the unit managers, read off the access list rather than typed
   into code, so somebody joining or leaving the branch does not need a
   developer. */
function iSurveySupport_() {
  var desk = [], mgr = {};
  iAccessTabs_().forEach(function (sh) {
    var head = iHeaders_(sh), last = sh.getLastRow();
    if (last < 2) return;
    var cN = iCol_(head, ['name']), cE = iCol_(head, ['email']),
        cR = iCol_(head, ['role (agent/manager/staff)', 'role']), cU = iCol_(head, ['unit']);
    if (cE < 0) return;
    sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().forEach(function (row) {
      var email = iEmail_(row[cE]); if (!email) return;
      var role = cR >= 0 ? iRoleOf_(row[cR]) : 'agent';
      var unit = cU >= 0 ? String(row[cU]).trim() : '';
      if (role === 'staff' || role === 'staff-lead') desk.push(email);
      var id = iIdentity_(cN >= 0 ? row[cN] : '', '', '');
      if ((role === 'unit' || role === 'branch') && unit &&
          iNameKey_(id.agentName || (cN >= 0 ? row[cN] : '')) === iNameKey_(unit)) mgr[unit] = email;
    });
  });
  return { desk: desk.join(','), managerFor: function (u) { return mgr[u] || ''; } };
}

/* ── The click ─────────────────────────────────────────────────────────────
   A GET, because that is all a mail client will do. The landing page names
   the agent — the client already knows who that is — and says nothing else
   about anybody. A link that leaks tells the finder that somebody, somewhere,
   is a client of this branch, and no more than that. */
function iSurveyClick_(e) {
  var p = (e && e.parameter) || {};
  var token = String(p.s || '').trim();
  if (!token) return null;
  var sh = iSurveyTab_(), last = sh.getLastRow();
  if (last < 2) return iSurveyPage_('That link has expired.', '', '');
  /* Read the whole row, not a fixed 18 — the tab grew a follow-up block and a
     hardcoded width silently returns blanks for every column past it. */
  var vals = sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), ISCOL.STAGE)).getValues();
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][0]) !== token) continue;
    var agent = String(vals[r][6] || 'your agent');
    if (p.r) {
      var n = Math.max(1, Math.min(5, parseInt(p.r, 10) || 0));
      sh.getRange(r + 2, 14).setValue(n);
      sh.getRange(r + 2, 15).setValue(new Date());
      return iSurveyPage_('Thank you.', 'Your rating of ' + n + ' out of 5 has been recorded ' +
        'and will be read by the branch. Nothing further is needed.', token, agent);
    }
    if (p.c) {
      sh.getRange(r + 2, ISCOL.HEARD).setValue(String(p.c).toLowerCase() === 'yes' ? 'Yes' : 'No');
      return iSurveyPage_('Thank you — that is genuinely useful.',
        'The branch will see it alongside your rating.', '', '');
    }
    if (p.o) return iSurveyOption_(sh, r, String(p.o), vals[r]);
    return iSurveyPage_('Thank you.', 'Your response has been recorded.', '', '');
  }
  return iSurveyPage_('That link has expired.',
    'Ratings are recorded once. If you would like to tell us something, call the branch.', '', '');
}

function iSurveyPage_(head, body, token, agent) {
  var follow = token && agent
    ? '<div style="margin-top:26px;padding-top:22px;border-top:1px solid #e2e8ee">'
      + '<p style="margin:0 0 12px;font-size:15px">One more, only if you have a moment — '
      + 'have you heard from <b>' + iEsc_(agent) + '</b> in the last year?</p>'
      + '<a href="?s=' + iEsc_(token) + '&c=yes" style="display:inline-block;padding:11px 26px;'
      + 'margin-right:8px;background:#0b7fd4;color:#fff;border-radius:8px;text-decoration:none;'
      + 'font-weight:600">Yes</a>'
      + '<a href="?s=' + iEsc_(token) + '&c=no" style="display:inline-block;padding:11px 26px;'
      + 'background:#eef2f6;color:#16202b;border-radius:8px;text-decoration:none;'
      + 'font-weight:600">No</a></div>'
    : '';
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<div style="font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
    + 'color:#16202b;max-width:520px;margin:9vh auto;padding:0 22px">'
    + '<div style="font:700 15px Georgia,serif;color:#00254d;margin-bottom:26px">'
    + 'Ricky Rampersad Branch<span style="display:block;font:400 12.5px sans-serif;color:#5c6b7a">'
    + 'Guardian Life · Chaguanas</span></div>'
    + '<h1 style="font:700 27px Georgia,serif;color:#00254d;margin:0 0 12px">' + iEsc_(head) + '</h1>'
    + '<p style="margin:0;color:#3d4c5a">' + iEsc_(body) + '</p>' + follow
    + '</div>').setTitle('Thank you — Ricky Rampersad Branch');
}

/* One of the four taps. Everything except the private line is recorded and
   routed the same day; the private line opens a page to write on instead. */
function iSurveyOption_(sh, r, key, row) {
  var opt = null;
  ISURVEY_OPTIONS.forEach(function (o) { if (o.key === key) opt = o; });
  if (!opt) return iSurveyPage_('That link has expired.', '', '', '');

  var prev = String(row[ISCOL.ASKED - 1] || '');
  if (prev.indexOf(key) < 0) {
    sh.getRange(r + 2, ISCOL.ASKED).setValue(prev ? prev + ', ' + key : key);
    sh.getRange(r + 2, ISCOL.ASKEDAT).setValue(new Date());
  }

  if (key === 'private') return iSurveyPrivatePage_(String(row[ISCOL.TOKEN - 1]));

  if (key === 'stop') {
    sh.getRange(r + 2, ISCOL.OPTOUT).setValue(new Date());
    iSurveyOptionAlert_(opt, row, '');
    return iSurveyPage_('Done — we will stop.',
      'You will not get another note like this from the branch. Your cover is not ' +
      'affected in any way, and your agent remains the person looking after it.', '', '');
  }

  iSurveyOptionAlert_(opt, row, '');
  return iSurveyPage_('Thank you — that is on its way to the branch.',
    key === 'review'
      ? 'Somebody will call to arrange a time to go through your cover. Nothing will ' +
        'be sold to you on that call — it is a review of what you already have.'
      : 'Somebody will be in touch within five working days to put it right.', '', '');
}

/* Where the client writes. A form rather than a link, because a message in a
   web address ends up in server logs, in browser history and in whatever sits
   between — which is the opposite of confidential. */
function iSurveyPrivatePage_(token) {
  var base = iSurveyBase_();
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<div style="font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
    + 'color:#16202b;max-width:560px;margin:7vh auto;padding:0 22px">'
    + '<div style="font:700 15px Georgia,serif;color:#00254d;margin-bottom:24px">'
    + 'Ricky Rampersad Branch<span style="display:block;font:400 12.5px sans-serif;'
    + 'color:#5c6b7a">Guardian Life · Chaguanas</span></div>'
    + '<h1 style="font:700 26px Georgia,serif;color:#00254d;margin:0 0 10px">'
    + 'Write to the branch manager</h1>'
    + '<p style="margin:0 0 8px;color:#3d4c5a">This goes to the branch manager and to '
    + 'nobody else. Not to your agent. Not to the office. It is not stored on any '
    + 'branch spreadsheet — only the fact that you wrote, so we can prove we answered.</p>'
    + '<p style="margin:0 0 18px;color:#3d4c5a">You will get an acknowledgement within '
    + '<b>five working days</b> and an answer within <b>four weeks</b>.</p>'
    + '<form method="post" action="' + iEsc_(base) + '">'
    + '<input type="hidden" name="s" value="' + iEsc_(token) + '">'
    + '<textarea name="msg" rows="9" required maxlength="4000" '
    + 'placeholder="Tell us what happened, in your own words." '
    + 'style="width:100%;padding:14px;border:1.5px solid #dde4ec;border-radius:11px;'
    + 'font:15px/1.55 inherit;resize:vertical"></textarea>'
    + '<label style="display:block;margin:12px 0 16px;font-size:14px;color:#5c6b7a">'
    + '<input type="checkbox" name="callme" value="1" style="margin-right:7px">'
    + 'I would rather be called than written to</label>'
    + '<button type="submit" style="width:100%;padding:15px;border:0;border-radius:11px;'
    + 'background:' + IBRAND.GOLD + ';color:' + IBRAND.NAVY + ';font:700 16px inherit;cursor:pointer">'
    + 'Send to the branch manager</button></form>'
    + '<p style="margin:22px 0 0;font-size:13px;color:#5c6b7a;border-top:1px solid #e2e8ee;'
    + 'padding-top:16px"><b>If your concern is about the branch manager</b>, or you are '
    + 'not satisfied with the answer, you can take it to Guardian Life\u2019s own complaints '
    + 'unit, and after that to the <b>Office of the Financial Services Ombudsman</b> of '
    + 'Trinidad and Tobago, which is free and independent of us.</p>'
    + '</div>').setTitle('Write to the branch manager');
}

/* The message itself goes to one inbox. Nowhere else, and not to the sheet. */
function iSurveyPrivateSend_(e) {
  var p = (e && e.parameter) || {};
  var token = String(p.s || '').trim(), msg = String(p.msg || '').trim();
  if (!token || !msg) return null;
  var sh = iSurveyTab_(), last = sh.getLastRow();
  if (last < 2) return iSurveyPage_('That link has expired.', '', '', '');
  var wide = Math.max(sh.getLastColumn(), ISCOL.STAGE);
  var vals = sh.getRange(2, 1, last - 1, wide).getValues();
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][ISCOL.TOKEN - 1]) !== token) continue;
    var to = iProp_('INTEL_MANAGER_EMAIL');
    if (to) {
      /* Deliberately not through iSend_ — that one honours INTEL_TEST_TO, and a
         client's confidential message must never be redirected to a test inbox. */
      MailApp.sendEmail({ to: to.split(',')[0].trim(), name: 'Branch Intelligence',
        subject: 'PRIVATE — a client has written to you',
        htmlBody: '<div style="font:15px/1.65 sans-serif;color:#16202b;max-width:640px">'
          + '<div style="background:#fdf6ec;border:1px solid #f0d9b5;border-left:3px solid '
          + '#a45a06;border-radius:9px;padding:13px 16px;margin-bottom:20px">'
          + '<b>Confidential.</b> This client used the private line on the survey. It has '
          + 'been sent to you and to nobody else, and the text is not on any branch sheet. '
          + 'Do not forward it to their agent.</div>'
          + '<p><b>Client:</b> ' + iEsc_(String(vals[r][ISCOL.CLIENT - 1])) + '<br>'
          + '<b>Their agent:</b> ' + iEsc_(String(vals[r][ISCOL.AGENT - 1])) + '<br>'
          + '<b>Unit:</b> ' + iEsc_(String(vals[r][ISCOL.UNIT - 1])) + '<br>'
          + '<b>Reply to:</b> ' + iEsc_(String(vals[r][ISCOL.EMAIL - 1]))
          + (p.callme ? '<br><b>They would rather be called.</b>' : '') + '</p>'
          + '<p style="white-space:pre-wrap;background:#f4f7fa;border-radius:10px;'
          + 'padding:16px 18px">' + iEsc_(msg) + '</p>'
          + '<p style="font-size:13px;color:#5c6b7a">Acknowledge within five working days '
          + 'and answer within four weeks — that is what the page promised them.</p></div>' });
    }
    sh.getRange(r + 2, ISCOL.PRIVATE).setValue(new Date());
    return iSurveyPage_('Sent. Only the branch manager will see it.',
      'You will get an acknowledgement within five working days, and an answer within ' +
      'four weeks. If you are not satisfied, you can take it to Guardian Life\u2019s ' +
      'complaints unit and then to the Office of the Financial Services Ombudsman.', '', '');
  }
  return iSurveyPage_('That link has expired.', '', '', '');
}

/* The desk and the agent hear about the other three the same day — never the
   private one, and never with the client's words in it. */
function iSurveyOptionAlert_(opt, row, extra) {
  var support = iSurveySupport_();
  var to = opt.to === 'agent'
    ? [iSurveyAgentEmail_(String(row[ISCOL.AGENT - 1])), support.desk]
    : [support.desk, iProp_('INTEL_MANAGER_EMAIL')];
  to = to.filter(function (x) { return x; }).join(',');
  if (!to) return;
  iSend_(to, 'Survey: ' + opt.label,
    '<div style="font:15px/1.6 sans-serif;color:#16202b">'
    + '<p>A client has tapped <b>' + iEsc_(opt.label) + '</b> on the survey.</p>'
    + '<p><b>Their agent:</b> ' + iEsc_(String(row[ISCOL.AGENT - 1])) + '<br>'
    + '<b>Unit:</b> ' + iEsc_(String(row[ISCOL.UNIT - 1])) + '<br>'
    + '<b>Reference:</b> ' + iEsc_(String(row[ISCOL.TOKEN - 1]).slice(0, 8)) + '</p>'
    + '<p>They were told somebody would be back to them within <b>five working days</b>. '
    + 'Open the client in Branch Intelligence to see who they are.</p></div>');
}

function iSurveyAgentEmail_(name) {
  var out = '';
  iAccessTabs_().forEach(function (sh) {
    var head = iHeaders_(sh), last = sh.getLastRow();
    if (last < 2) return;
    var cN = iCol_(head, ['name']), cE = iCol_(head, ['email']);
    if (cN < 0 || cE < 0) return;
    sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().forEach(function (row) {
      var id = iIdentity_(row[cN], '', '');
      if (iNameKey_(id.agentName || row[cN]) === iNameKey_(name)) out = iEmail_(row[cE]) || out;
    });
  });
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   AFTER THEY ANSWER — the thank-you, and getting back to them
   ══════════════════════════════════════════════════════════════════════════
   A survey that collects a complaint and does nothing with it is worse than no
   survey at all. It tells a client the branch asked, heard, and did not care —
   and in a market-conduct file that is the version somebody reads back to you.

   So every answer gets two things. A thank-you, on the day, so the client knows
   it arrived and did not vanish. And where the answer says something is wrong,
   a follow-up with a name against it and a date it is due, which stays open and
   visible until somebody closes it with what they did.

   WHAT COUNTS AS SOMETHING WRONG
     a rating of 3 or less                — they are telling you plainly
     "no" to hearing from their agent     — a servicing gap, whatever the rating

   A 4 or 5 with no other flag gets a plain thank-you and nothing else. Promising
   a call to somebody who is content is how a good survey becomes a nuisance.

   THE THANK-YOU FOR A LOW SCORE PROMISES A CALL, so the follow-up it opens is a
   promise the branch has made in writing. It is due in two working days and the
   wall shows it until it is closed. Never let this run without the follow-up
   list being worked — an unkept written promise is worse than the silence it
   replaced.

     intelSurveyFollowUp()          the daily run: thanks, flags, alerts
     intelSurveyClose(token, who, outcome)   close one, with what was done
     intelSurveyOpen()              what is still open, oldest first
   ══════════════════════════════════════════════════════════════════════════ */

function iSurveyThanksHtml_(d) {
  var low = !!d.low;
  return ''
  + '<div style="font:15px/1.62 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
  + 'color:#16202b;max-width:600px;margin:0 auto;padding:0 4px">'
  + iBrandHead_()
  + '<p style="margin:0 0 14px">Dear ' + iEsc_(d.greeting) + ',</p>'
  + '<p style="margin:0 0 14px">Thank you for answering — it reached us, and a person '
  +   'at the branch has read it.</p>'
  + (low
     ? '<p style="margin:0 0 14px">You told us the service has not been what it should be. '
     +   'That is worth a conversation rather than another e-mail, so <b>somebody from the '
     +   'branch will call you within two working days</b>. Not ' + iEsc_(d.agent)
     +   ' — one of the managers here.</p>'
     + '<p style="margin:0 0 14px">If it is easier to reach you at a particular time, reply '
     +   'to this note and say when.</p>'
     : '<p style="margin:0 0 14px">Nothing further is needed from you. Your cover carries on '
     +   'as it is, and ' + iEsc_(d.agent) + ' remains the person looking after it.</p>')
  + '<hr style="border:0;border-top:1px solid #e2e8ee;margin:22px 0 14px">'
  + '<div style="font-size:12.5px;color:#5c6b7a">'
  +   'Ricky Rampersad Branch · Guardian Life of the Caribbean<br>'
  +   'Chaguanas, Trinidad and Tobago'
  +   (d.branchPhone ? ' · ' + iEsc_(d.branchPhone) : '') + '<br>'
  +   '<span style="color:#8b98a6">We will never ask you for a password or a card number '
  +   'by e-mail.</span></div></div>';
}

function iSurveyFollowUp_isLow_(rating, heard) {
  var n = Number(rating);
  if (n >= 1 && n <= 3) return 'rated ' + n + ' out of 5';
  if (String(heard) === 'No') return 'has not heard from their agent in a year';
  return '';
}

function intelSurveyFollowUp() {
  var live = iProp_('INTEL_SURVEY_LIVE').trim().toLowerCase() === ISURVEY.LIVE_PHRASE;
  var test = iProp_('INTEL_TEST_TO');
  var blocked = iSurveyBlocked_();
  if (live && blocked) return 'STOPPED — ' + blocked;

  var sh = iSurveyTab_(), last = sh.getLastRow();
  if (last < 2) return 'Nothing has been sent yet.';
  var wide = Math.max(sh.getLastColumn(), ISCOL.STAGE);
  var vals = sh.getRange(2, 1, last - 1, wide).getValues();
  var today = iToday_(), DAY = 86400000;
  var thanked = 0, opened = 0, alerts = [];
  var support = iSurveySupport_(), phone = iProp_('INTEL_BRANCH_PHONE');

  for (var r = 0; r < vals.length; r++) {
    var row = vals[r], rating = Number(row[ISCOL.RATING - 1]);
    var answered = (rating >= 1 && rating <= 5) || row[ISCOL.HEARD - 1];
    if (!answered) continue;
    if (String(row[ISCOL.THANKED - 1]).trim()) continue;   // already handled

    var why = iSurveyFollowUp_isLow_(rating, row[ISCOL.HEARD - 1]);
    var d = { greeting: iSurveyGreeting_(row[ISCOL.CLIENT - 1]),
              agent: String(row[ISCOL.AGENT - 1] || 'your agent'),
              rating: rating, low: !!why, branchPhone: phone };
    var html = iSurveyThanksHtml_(d);
    var to = iEmail_(row[ISCOL.EMAIL - 1]);

    if (live && to) {
      MailApp.sendEmail({ to: to, name: 'Ricky Rampersad Branch',
        subject: why ? 'Thank you — we will call you' : 'Thank you',
        htmlBody: html });
    } else if (test) {
      MailApp.sendEmail({ to: test, name: 'Branch Intelligence',
        subject: '[TEST] ' + (why ? 'Thank you — we will call you' : 'Thank you'),
        htmlBody: '<div style="background:#E8A020;color:#00254d;padding:10px 14px;'
          + 'font:700 13px sans-serif;border-radius:8px;margin-bottom:14px">TEST MODE — '
          + 'would have gone to ' + iEsc_(to || '(no address)') + '</div>' + html });
    }
    sh.getRange(r + 2, ISCOL.THANKED).setValue(new Date());
    thanked++;

    if (why) {
      /* Two working days, and the owner is the unit manager rather than the
         agent being rated — asking somebody to investigate their own score is
         not a follow-up. */
      var due = new Date(today.getTime() + (today.getDay() >= 4 ? 4 : 2) * DAY);
      sh.getRange(r + 2, ISCOL.FOLLOWUP).setValue(why);
      sh.getRange(r + 2, ISCOL.OWNER).setValue(
        support.managerFor(String(row[ISCOL.UNIT - 1])) || iProp_('INTEL_MANAGER_EMAIL') || 'branch');
      sh.getRange(r + 2, ISCOL.DUE).setValue(due);
      opened++;
      alerts.push({ why: why, agent: d.agent, unit: String(row[ISCOL.UNIT - 1]),
                    token: String(row[ISCOL.TOKEN - 1]), due: due,
                    comment: String(row[ISCOL.COMMENT - 1] || '') });
    }
  }

  if (alerts.length) iSurveyAlert_(alerts, support);
  var mode = live ? 'live' : (test ? 'test' : 'dry');
  return mode.toUpperCase() + '. Thanked ' + thanked + ', opened ' + opened +
         ' follow-up' + (opened === 1 ? '' : 's') + '. ' + iSurveyOpenSummary_();
}

/* The branch hears about a low score the same day, not at the end of the month.
   Client names are deliberately absent — the token identifies the row and the
   app looks it up behind the sign-in. */
function iSurveyAlert_(alerts, support) {
  var rows = alerts.map(function (a) {
    return '<tr><td style="padding:7px 10px;border-bottom:1px solid #e2e8ee">'
      + iEsc_(a.why) + '</td><td style="padding:7px 10px;border-bottom:1px solid #e2e8ee">'
      + iEsc_(a.agent) + '</td><td style="padding:7px 10px;border-bottom:1px solid #e2e8ee">'
      + iEsc_(a.unit) + '</td><td style="padding:7px 10px;border-bottom:1px solid #e2e8ee;'
      + 'font:12px monospace">' + iEsc_(a.token.slice(0, 8)) + '</td></tr>';
  }).join('');
  var to = [support.desk, iProp_('INTEL_MANAGER_EMAIL')].filter(function (x) { return x; }).join(',');
  if (!to) return;
  iSend_(to, alerts.length + ' client survey follow-up' + (alerts.length === 1 ? '' : 's') + ' to make',
    '<div style="font:15px/1.6 sans-serif;color:#16202b">'
    + '<p><b>' + alerts.length + '</b> client' + (alerts.length === 1 ? ' has' : 's have')
    + ' answered the survey in a way that needs a call. Each has been told in writing that '
    + 'somebody from the branch will ring within <b>two working days</b>.</p>'
    + '<table style="border-collapse:collapse;font-size:14px"><tr>'
    + '<th style="text-align:left;padding:7px 10px">What they said</th>'
    + '<th style="text-align:left;padding:7px 10px">Their agent</th>'
    + '<th style="text-align:left;padding:7px 10px">Unit</th>'
    + '<th style="text-align:left;padding:7px 10px">Ref</th></tr>' + rows + '</table>'
    + '<p style="color:#5c6b7a;font-size:13px">Open the client in Branch Intelligence to see '
    + 'who they are. Close it with <b>intelSurveyClose(ref, "your name", "what you did")</b>.</p></div>');
}

function intelSurveyClose(token, who, outcome) {
  token = String(token || '').trim(); who = String(who || '').trim();
  if (!token || !who) return 'intelSurveyClose("<ref>", "your name", "what you did")';
  var sh = iSurveyTab_(), last = sh.getLastRow();
  if (last < 2) return 'Nothing to close.';
  var wide = Math.max(sh.getLastColumn(), ISCOL.STAGE);
  var vals = sh.getRange(2, 1, last - 1, wide).getValues();
  for (var r = 0; r < vals.length; r++) {
    var t = String(vals[r][ISCOL.TOKEN - 1]);
    if (t !== token && t.slice(0, 8) !== token) continue;
    if (!String(vals[r][ISCOL.FOLLOWUP - 1]).trim()) return 'That one has no follow-up open.';
    sh.getRange(r + 2, ISCOL.CLOSED).setValue(new Date());
    sh.getRange(r + 2, ISCOL.CLOSEDBY).setValue(who);
    sh.getRange(r + 2, ISCOL.OUTCOME).setValue(String(outcome || '').trim() || '(none recorded)');
    return 'Closed by ' + who + '. ' + iSurveyOpenSummary_();
  }
  return 'No survey with reference ' + token + '.';
}

function iSurveyOpenRows_() {
  var sh = iSurveyTab_(), last = sh.getLastRow();
  if (last < 2) return [];
  var wide = Math.max(sh.getLastColumn(), ISCOL.STAGE);
  var vals = sh.getRange(2, 1, last - 1, wide).getValues();
  var today = iToday_(), out = [];
  vals.forEach(function (row) {
    if (!String(row[ISCOL.FOLLOWUP - 1]).trim()) return;
    if (String(row[ISCOL.CLOSED - 1]).trim()) return;
    var due = row[ISCOL.DUE - 1];
    out.push({ ref: String(row[ISCOL.TOKEN - 1]).slice(0, 8),
               why: String(row[ISCOL.FOLLOWUP - 1]),
               agent: String(row[ISCOL.AGENT - 1]), unit: String(row[ISCOL.UNIT - 1]),
               owner: String(row[ISCOL.OWNER - 1]),
               due: due instanceof Date ? iIso_(due) : '',
               overdue: due instanceof Date && due < today });
  });
  return out.sort(function (a, b) { return (a.due || '').localeCompare(b.due || ''); });
}

function iSurveyOpenSummary_() {
  var o = iSurveyOpenRows_();
  if (!o.length) return 'No follow-ups open.';
  var late = o.filter(function (x) { return x.overdue; }).length;
  return o.length + ' follow-up' + (o.length === 1 ? '' : 's') + ' open' +
         (late ? ', ' + late + ' past due' : '') + '.';
}

function intelSurveyOpen() {
  var o = iSurveyOpenRows_();
  if (!o.length) return 'No follow-ups open.';
  return o.map(function (x) {
    return (x.overdue ? 'PAST DUE ' : '') + x.ref + '  ' + x.why +
           '  [' + x.agent + ' · ' + x.unit + ']  due ' + x.due + '  owner ' + x.owner;
  }).join('\n');
}

/* ── What the wall shows ───────────────────────────────────────────────────
   Counts and rates. No client, no policy, no comment text — a comment is
   one person's words about a named colleague and it belongs in the app
   behind the sign-in, not on a screen in a room clients walk through. */
function iBuildSurveyStats_() {
  var sh = iSurveyTab_(), last = sh.getLastRow();
  var out = { sent: 0, responded: 0, rate: 0, avg: null, dist: [0, 0, 0, 0, 0],
              heardYes: 0, heardNo: 0, byBand: [], byUnit: [], live: 0, latest: '' };
  if (last < 2) return out;
  /* Read the whole row, not a fixed 18 — the tab grew a follow-up block and a
     hardcoded width silently returns blanks for every column past it. */
  var vals = sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), ISCOL.STAGE)).getValues();
  var band = {}, unit = {}, sum = 0, latest = null;
  vals.forEach(function (r) {
    if (String(r[17]) === 'live') out.live++;
    out.sent++;
    var b = String(r[9] || '—'), u = String(r[7] || 'Unassigned');
    if (!band[b]) band[b] = { k: b, sent: 0, resp: 0, sum: 0 };
    if (!unit[u]) unit[u] = { k: u, sent: 0, resp: 0, sum: 0 };
    band[b].sent++; unit[u].sent++;
    var n = Number(r[13]);
    if (n >= 1 && n <= 5) {
      out.responded++; sum += n; out.dist[n - 1]++;
      band[b].resp++; band[b].sum += n; unit[u].resp++; unit[u].sum += n;
      if (r[14] instanceof Date && (!latest || r[14] > latest)) latest = r[14];
    }
    if (String(r[15]) === 'Yes') out.heardYes++;
    if (String(r[15]) === 'No') out.heardNo++;
  });
  out.rate = out.sent ? Math.round(out.responded / out.sent * 1000) / 10 : 0;
  out.avg = out.responded ? Math.round(sum / out.responded * 10) / 10 : null;
  out.latest = latest ? iIso_(latest) : '';
  function fold(m) {
    return Object.keys(m).map(function (k) {
      var o = m[k];
      return { k: o.k, sent: o.sent, resp: o.resp,
               avg: o.resp ? Math.round(o.sum / o.resp * 10) / 10 : null };
    }).sort(function (a, b) { return b.sent - a.sent; });
  }
  out.byBand = fold(band); out.byUnit = fold(unit);
  /* Open promises, counted. A follow-up past its due date is a call the branch
     told a client in writing it would make and has not made. */
  var open = iSurveyOpenRows_();
  out.openFollowUps = open.length;
  out.overdueFollowUps = open.filter(function (x) { return x.overdue; }).length;
  out.thanked = 0;
  vals.forEach(function (r) { if (String(r[ISCOL.THANKED - 1] || '').trim()) out.thanked++; });
  return out;
}

/* What WOULD go out, so the wall has something true to show before anything
   has been sent. Counts per letter only — how many clients sit in each tenure
   band today, and how many are unreachable. No client, no policy, no address. */
function iSurveyPoolSummary_() {
  var pool = iSurveyPool_();
  if (pool.error) return { ready: 0, letters: [], noEmail: 0 };
  var m = {};
  ISURVEY_TEMPLATES.forEach(function (t) { m[t.id] = { k: t.id, n: 0 }; });
  pool.rows.forEach(function (d) { if (m[d.tpl.id]) m[d.tpl.id].n++; });
  return { ready: pool.rows.length, noEmail: pool.skipped.noEmail,
           letters: ISURVEY_TEMPLATES.map(function (t) { return m[t.id]; }) };
}
