/**
 * ============================================================================
 * WALL BOARD FEED — Ricky Rampersad Branch
 * ============================================================================
 * Serves the JSON behind /wall/ — the rotating Salesforce wall board.
 *
 * Drop this file into the SAME Apps Script project as SalesforceSync.gs: it
 * reads the same stored connection (SF_KEY / SF_SECRET / SF_USER / SF_PASS in
 * Script Properties), so if the renewal sync works, this works. Nothing else
 * to configure.
 *
 * Every function here is prefixed wb so nothing collides with the sync.
 *
 * DEPLOY:  Deploy → New deployment → Web app
 *            Execute as: Me · Who has access: Anyone
 *          Paste the /exec URL into WALL_DATA_URL at the top of wall/index.html.
 *
 * "Anyone" means anyone may fetch these numbers, so the feed is built to be
 * safe on a public URL: clients appear as first name + last initial, claims as
 * reference numbers only, and no policy numbers, emails or phone numbers ever
 * leave this script.
 *
 * The board asks for fresh numbers every 15 minutes; results are cached here
 * for 10, so Salesforce sees at most ~6 queries an hour of load.
 */

var WB = { API: 'v64.0', CACHE_MIN: 10 };

function doGet() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('wb_payload');
  var body = hit || JSON.stringify(wbBuild_());
  if (!hit) cache.put('wb_payload', body, WB.CACHE_MIN * 60);
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================ the payload ============================ */

function wbBuild_() {
  var yr = new Date().getFullYear();

  // production, month by month, this year
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthly = wbQ_(
    'SELECT CALENDAR_MONTH(CreatedDate) m, COUNT(Id) n, SUM(Billing_Premiums__c) prem ' +
    'FROM Risk_Details__c WHERE CreatedDate = THIS_YEAR ' +
    'GROUP BY CALENDAR_MONTH(CreatedDate) ORDER BY CALENDAR_MONTH(CreatedDate)'
  ).map(function (r) {
    return { m: months[r.m - 1], n: r.n, prem: Math.round(r.prem || 0) };
  });
  var risks = monthly.reduce(function (a, x) { return a + x.n; }, 0);
  var premium = monthly.reduce(function (a, x) { return a + x.prem; }, 0);

  // same period last year, for the deltas on the pulse slide
  var now = new Date();
  var lyFrom = (yr - 1) + '-01-01T00:00:00Z';
  var lyTo = Utilities.formatDate(new Date(yr - 1, now.getMonth(), now.getDate(), 23, 59, 59), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  var ly = wbQ_(
    'SELECT COUNT(Id) n, SUM(Billing_Premiums__c) prem FROM Risk_Details__c ' +
    'WHERE CreatedDate >= ' + lyFrom + ' AND CreatedDate <= ' + lyTo
  )[0] || {};

  var renewals30 = (wbQ_(
    'SELECT COUNT(Id) n FROM Risk_Details__c ' +
    'WHERE Next_Renewal_Date__c >= TODAY AND Next_Renewal_Date__c <= NEXT_N_DAYS:30'
  )[0] || {}).n || 0;

  var claimTypes = wbQ_(
    'SELECT Claim_Type__c t, COUNT(Id) n, AVG(Days_Pending__c) d FROM Claims_Revised__c ' +
    "WHERE Claim_Status__c = 'Opened' GROUP BY Claim_Type__c ORDER BY COUNT(Id) DESC"
  ).map(function (r) {
    return { k: r.t || 'Unclassified', n: r.n, avgDays: Math.round(r.d || 0) };
  });
  var openClaims = claimTypes.reduce(function (a, x) { return a + x.n; }, 0);

  var claimsClosedYtd = (wbQ_(
    "SELECT COUNT(Id) n FROM Claims_Revised__c WHERE Claim_Status__c = 'Closed' AND CreatedDate = THIS_YEAR"
  )[0] || {}).n || 0;

  var pipe = wbQ_('SELECT COUNT(Id) n, SUM(Amount) amt FROM Opportunity WHERE IsClosed = false')[0] || {};
  var won = (wbQ_(
    'SELECT COUNT(Id) n FROM Opportunity WHERE IsWon = true AND CloseDate = LAST_N_MONTHS:12'
  )[0] || {}).n || 0;

  return {
    generatedAt: new Date().toISOString(),
    ytd: {
      year: yr,
      risks: risks, premium: premium,
      lastYearRisks: ly.n || 0, lastYearPremium: Math.round(ly.prem || 0),
      renewals30: renewals30, openClaims: openClaims, claimsClosedYtd: claimsClosedYtd,
      pipelineCount: pipe.n || 0, pipelineValue: Math.round(pipe.amt || 0), wonLast12mo: won
    },
    monthly: monthly,
    classification: wbQ_(
      'SELECT Risk_Classification__c k, COUNT(Id) n FROM Risk_Details__c ' +
      'WHERE CreatedDate = THIS_YEAR GROUP BY Risk_Classification__c'
    ).map(function (r) {
      return { k: r.k === 'New Business' ? 'New business' : (r.k || 'Not yet classified'), n: r.n };
    }),
    carriers: wbQ_(
      'SELECT Carrier__c k, COUNT(Id) n FROM Risk_Details__c ' +
      'WHERE CreatedDate = LAST_N_MONTHS:12 GROUP BY Carrier__c ORDER BY COUNT(Id) DESC'
    ).map(function (r) { return { k: r.k || 'Not recorded', n: r.n }; }),
    renewals: wbQ_(
      'SELECT Contact_First_Name__c f, Last_Name__c l, Vehicle_Make__c mk, Policy__c p, ' +
      'Next_Renewal_Date__c d, Billing_Premiums__c prem FROM Risk_Details__c ' +
      'WHERE Next_Renewal_Date__c >= TODAY AND Next_Renewal_Date__c <= NEXT_N_DAYS:45 ' +
      'ORDER BY Next_Renewal_Date__c LIMIT 10'
    ).map(function (r) {
      return {
        who: wbMask_(r.f, r.l),
        what: r.mk ? r.mk + ' · motor' : wbRiskLabel_(r.p),
        when: r.d, prem: Math.round(r.prem || 0)
      };
    }),
    claimTypes: claimTypes,
    oldestClaims: wbQ_(
      'SELECT Claim_Reference__c ref, Claim_Type__c t, Days_Pending__c d FROM Claims_Revised__c ' +
      "WHERE Claim_Status__c = 'Opened' ORDER BY Days_Pending__c DESC NULLS LAST LIMIT 6"
    ).map(function (r) {
      return { ref: r.ref || '(no reference)', type: r.t || 'Unclassified', days: Math.round(r.d || 0) };
    }),
    topOpps: wbQ_(
      'SELECT Name, StageName s, Amount a FROM Opportunity WHERE IsClosed = false ' +
      'ORDER BY Amount DESC NULLS LAST LIMIT 7'
    ).map(function (r) {
      return { name: wbOppLabel_(r.Name), stage: r.s, amt: Math.round(r.a || 0) };
    }),
    legacy: wbLegacy_(),
    production: wbProduction_(),
    dashboardAdvisors: wbDashboard_(),
    settlement: wbSettlement_()
  };
}

/* ======================= settlement (dashboard panel) =======================
   Settled vs pending on the picked-up book: Date_Settled__c and
   Days_Taken_to_Settle__c. Blank Policy_Status_Description_R__c means the
   settle date is the only reliable signal — the dashboard's data-health
   panel exists to change that. */
function wbSettlement_() {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function one(soql) { return wbQ_(soql)[0] || {}; }
  var base = 'FROM CLIENT_PORTFOLIO__c WHERE Production_Picked_up_Date__c = THIS_YEAR';
  var s = one('SELECT COUNT(Id) n, SUM(Total_API__c) api, AVG(Days_Taken_to_Settle__c) d ' + base + ' AND Date_Settled__c != null');
  var p = one('SELECT COUNT(Id) n, SUM(Total_API__c) api ' + base + ' AND Date_Settled__c = null');
  function band(label, where) {
    var r = one('SELECT COUNT(Id) n ' + base + ' AND Date_Settled__c != null AND ' + where);
    return { k: label, n: r.n || 0 };
  }
  var byMonth = {};
  wbQ_('SELECT CALENDAR_MONTH(Production_Picked_up_Date__c) m, COUNT(Id) n, SUM(Total_API__c) api ' +
       base + ' AND Date_Settled__c != null GROUP BY CALENDAR_MONTH(Production_Picked_up_Date__c)')
    .forEach(function (r) { byMonth[months[r.m - 1]] = { sN: r.n, sApi: Math.round(r.api || 0) }; });
  var monthly = wbQ_('SELECT CALENDAR_MONTH(Production_Picked_up_Date__c) m, COUNT(Id) n, SUM(Total_API__c) api ' +
       base + ' GROUP BY CALENDAR_MONTH(Production_Picked_up_Date__c) ORDER BY CALENDAR_MONTH(Production_Picked_up_Date__c)')
    .map(function (r) {
      var mm = months[r.m - 1], st = byMonth[mm] || { sN: 0, sApi: 0 };
      return { m: mm, sN: st.sN, sApi: st.sApi,
               pN: r.n - st.sN, pApi: Math.round((r.api || 0) - st.sApi) };
    });
  return {
    settledN: s.n || 0, settledApi: Math.round(s.api || 0), avgDays: Math.round(s.d || 0),
    pendingN: p.n || 0, pendingApi: Math.round(p.api || 0),
    bands: [
      band('Within a week', 'Days_Taken_to_Settle__c <= 7'),
      band('8 – 30 days',   'Days_Taken_to_Settle__c > 7 AND Days_Taken_to_Settle__c <= 30'),
      band('Over 30 days',  'Days_Taken_to_Settle__c > 30')
    ],
    monthly: monthly,
    pendingByAgent: wbQ_(
      'SELECT AGENT__r.Name a, COUNT(Id) n, SUM(Total_API__c) api ' + base +
      ' AND Date_Settled__c = null GROUP BY AGENT__r.Name ORDER BY SUM(Total_API__c) DESC LIMIT 6'
    ).map(function (r) { return { a: r.a || 'Unassigned', n: r.n, api: Math.round(r.api || 0) }; })
  };
}

/* ======================= production wall (/wall/production) =======================
   CLIENT_PORTFOLIO__c filtered on Production_Picked_up_Date__c, summing
   Total_API__c — the "picked up for production" measure. Advisor names are
   branch staff and belong on a production wall; client fields are never
   queried, so none can leak onto the feed. */

function wbProduction_() {
  var yr = new Date().getFullYear();
  var now = new Date();
  var monthNames = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function one(soql) { return wbQ_(soql)[0] || {}; }
  var base = 'FROM CLIENT_PORTFOLIO__c WHERE Production_Picked_up_Date__c';

  var wk  = one('SELECT COUNT(Id) n, SUM(Total_API__c) api ' + base + ' = THIS_WEEK');
  var lwk = one('SELECT COUNT(Id) n, SUM(Total_API__c) api ' + base + ' = LAST_WEEK');
  var mtd = one('SELECT COUNT(Id) n, SUM(Total_API__c) api ' + base + ' = THIS_MONTH');
  var ytd = one('SELECT COUNT(Id) n, SUM(Total_API__c) api ' + base + ' = THIS_YEAR');

  // same window last year, for the month and YTD deltas
  function d(dt) { return Utilities.formatDate(dt, 'UTC', 'yyyy-MM-dd'); }
  var lyMtd = one('SELECT COUNT(Id) n, SUM(Total_API__c) api ' + base +
    ' >= ' + d(new Date(yr - 1, now.getMonth(), 1)) +
    ' AND Production_Picked_up_Date__c <= ' + d(new Date(yr - 1, now.getMonth(), now.getDate())));
  var lyYtd = one('SELECT COUNT(Id) n, SUM(Total_API__c) api ' + base +
    ' >= ' + d(new Date(yr - 1, 0, 1)) +
    ' AND Production_Picked_up_Date__c <= ' + d(new Date(yr - 1, now.getMonth(), now.getDate())));

  var monthly = wbQ_(
    'SELECT CALENDAR_MONTH(Production_Picked_up_Date__c) m, COUNT(Id) n, SUM(Total_API__c) api ' +
    base + ' = THIS_YEAR GROUP BY CALENDAR_MONTH(Production_Picked_up_Date__c) ' +
    'ORDER BY CALENDAR_MONTH(Production_Picked_up_Date__c)'
  ).map(function (r) { return { m: months[r.m - 1], n: r.n, api: Math.round(r.api || 0) }; });

  // increases — Policy_Increases__c on its own picked-up date, merged in.
  // API_Increase__c is the branch's confirmed "Total API" basis (matches the
  // Monday report); Increase_API__c is the joint-split field — do not swap back.
  var incBase = 'FROM Policy_Increases__c WHERE Increase_Production_Picked_Up_Date__c';
  var iWk  = one('SELECT COUNT(Id) n, SUM(API_Increase__c) api ' + incBase + ' = THIS_WEEK');
  var iLwk = one('SELECT COUNT(Id) n, SUM(API_Increase__c) api ' + incBase + ' = LAST_WEEK');
  var iMtd = one('SELECT COUNT(Id) n, SUM(API_Increase__c) api ' + incBase + ' = THIS_MONTH');
  var iYtd = one('SELECT COUNT(Id) n, SUM(API_Increase__c) api ' + incBase + ' = THIS_YEAR');
  var iLyMtd = one('SELECT COUNT(Id) n, SUM(API_Increase__c) api ' + incBase +
    ' >= ' + d(new Date(yr - 1, now.getMonth(), 1)) +
    ' AND Increase_Production_Picked_Up_Date__c <= ' + d(new Date(yr - 1, now.getMonth(), now.getDate())));
  var iLyYtd = one('SELECT COUNT(Id) n, SUM(API_Increase__c) api ' + incBase +
    ' >= ' + d(new Date(yr - 1, 0, 1)) +
    ' AND Increase_Production_Picked_Up_Date__c <= ' + d(new Date(yr - 1, now.getMonth(), now.getDate())));
  var incMonthly = {};
  wbQ_(
    'SELECT CALENDAR_MONTH(Increase_Production_Picked_Up_Date__c) m, COUNT(Id) n, SUM(API_Increase__c) api ' +
    incBase + ' = THIS_YEAR GROUP BY CALENDAR_MONTH(Increase_Production_Picked_Up_Date__c)'
  ).forEach(function (r) { incMonthly[months[r.m - 1]] = { n: r.n, api: Math.round(r.api || 0) }; });
  monthly.forEach(function (x) {
    var i = incMonthly[x.m] || { n: 0, api: 0 };
    x.incN = i.n; x.inc = i.api;
  });

  return {
    generatedAt: new Date().toISOString(),
    week:  { n: wk.n || 0,  api: Math.round(wk.api || 0),
             incN: iWk.n || 0, inc: Math.round(iWk.api || 0),
             prevN: lwk.n || 0, prevApi: Math.round(lwk.api || 0),
             prevInc: Math.round(iLwk.api || 0) },
    month: { label: monthNames[now.getMonth()], n: mtd.n || 0, api: Math.round(mtd.api || 0),
             incN: iMtd.n || 0, inc: Math.round(iMtd.api || 0),
             lastYearN: lyMtd.n || 0, lastYearApi: Math.round(lyMtd.api || 0),
             lastYearIncN: iLyMtd.n || 0, lastYearInc: Math.round(iLyMtd.api || 0) },
    ytd:   { year: yr, n: ytd.n || 0, api: Math.round(ytd.api || 0),
             incN: iYtd.n || 0, inc: Math.round(iYtd.api || 0),
             lastYearN: lyYtd.n || 0, lastYearApi: Math.round(lyYtd.api || 0),
             lastYearIncN: iLyYtd.n || 0, lastYearInc: Math.round(iLyYtd.api || 0) },
    monthly: monthly,
    heldBack: wbHeldBack_(),
    weekly: wbWeekly_(),
    leaders: wbLeaders_(base),
    latest: wbQ_(
      'SELECT AGENT__r.Name, Total_API__c, Production_Picked_up_Date__c, CreatedBy.Name ' + base +
      ' = THIS_MONTH ORDER BY Production_Picked_up_Date__c DESC LIMIT 10'
    ).map(function (r) {
      return { a: (r.AGENT__r && r.AGENT__r.Name) || 'Unassigned',
               d: r.Production_Picked_up_Date__c, api: Math.round(r.Total_API__c || 0),
               by: (r.CreatedBy && r.CreatedBy.Name) || '' };
    })
  };
}

/* Leaderboard on the Total API basis: new business + increases per advisor,
   merged so the wall agrees with the Monday report to the dollar. */
function wbLeaders_(base) {
  var byAgent = {};
  wbQ_(
    'SELECT AGENT__r.Name a, COUNT(Id) n, SUM(Total_API__c) api ' + base +
    ' = THIS_YEAR GROUP BY AGENT__r.Name'
  ).forEach(function (r) {
    byAgent[r.a || 'Unassigned'] = { n: r.n, api: r.api || 0 };
  });
  wbQ_(
    'SELECT Policy_Increases__r.AGENT__r.Name a, COUNT(Id) n, SUM(API_Increase__c) api ' +
    'FROM Policy_Increases__c WHERE Increase_Production_Picked_Up_Date__c = THIS_YEAR ' +
    'GROUP BY Policy_Increases__r.AGENT__r.Name'
  ).forEach(function (r) {
    var k = r.a || 'Unassigned';
    if (!byAgent[k]) byAgent[k] = { n: 0, api: 0 };
    byAgent[k].n += r.n; byAgent[k].api += (r.api || 0);
  });
  return Object.keys(byAgent).map(function (k) {
    return { a: k, n: byAgent[k].n, api: Math.round(byAgent[k].api) };
  }).sort(function (x, y) { return y.api - x.api; }).slice(0, 10);
}

/* ======================= dashboard feed (/wall/dashboard) =======================
   Per-advisor figures for every period the dashboard's table offers, plus
   last-year comparison and held-back book, all on the Total API basis. */
function wbDashboard_() {
  var yr = new Date().getFullYear(), now = new Date();
  function d(dt) { return Utilities.formatDate(dt, 'UTC', 'yyyy-MM-dd'); }
  var A = {};
  function row(name) {
    if (!A[name]) A[name] = { a: name, wN:0,wApi:0, lwN:0,lwApi:0, mN:0,mApi:0, yN:0,yApi:0, ly:0, hbN:0,hbApi:0 };
    return A[name];
  }
  function fold(soql, nKey, apiKey) {
    wbQ_(soql).forEach(function (r) {
      var x = row(r.a || 'Unassigned');
      x[nKey] += (r.n || 0); x[apiKey] = Math.round((x[apiKey] || 0) + (r.api || 0));
    });
  }
  var nb = 'SELECT AGENT__r.Name a, COUNT(Id) n, SUM(Total_API__c) api FROM CLIENT_PORTFOLIO__c WHERE Production_Picked_up_Date__c';
  var inc = 'SELECT Policy_Increases__r.AGENT__r.Name a, COUNT(Id) n, SUM(API_Increase__c) api FROM Policy_Increases__c WHERE Increase_Production_Picked_Up_Date__c';
  [[' = THIS_WEEK','wN','wApi'],[' = LAST_WEEK','lwN','lwApi'],[' = THIS_MONTH','mN','mApi'],[' = THIS_YEAR','yN','yApi']]
    .forEach(function (p) {
      fold(nb + p[0] + ' GROUP BY AGENT__r.Name', p[1], p[2]);
      fold(inc + p[0] + ' GROUP BY Policy_Increases__r.AGENT__r.Name', p[1], p[2]);
    });
  var lyTo = d(new Date(yr - 1, now.getMonth(), now.getDate()));
  fold(nb + ' >= ' + d(new Date(yr - 1, 0, 1)) + ' AND Production_Picked_up_Date__c <= ' + lyTo + ' GROUP BY AGENT__r.Name', 'lyN_', 'ly');
  fold(inc + ' >= ' + d(new Date(yr - 1, 0, 1)) + ' AND Increase_Production_Picked_Up_Date__c <= ' + lyTo + ' GROUP BY Policy_Increases__r.AGENT__r.Name', 'lyN_', 'ly');
  fold('SELECT AGENT__r.Name a, COUNT(Id) n, SUM(Total_API__c) api FROM CLIENT_PORTFOLIO__c ' +
       'WHERE App_Received_Date__c = THIS_YEAR AND Production_Picked_up_Date__c = null GROUP BY AGENT__r.Name', 'hbN', 'hbApi');
  return Object.keys(A).map(function (k) { var x = A[k]; delete x.lyN_; return x; })
    .sort(function (x, y) { return y.yApi - x.yApi; });
}

/* Held-back API: apps received this year with no production picked-up date —
   submitted business waiting on requirements. The live feed carries full
   advisor names; there are no client fields in any of these queries. */
function wbHeldBack_() {
  var base = 'FROM CLIENT_PORTFOLIO__c WHERE App_Received_Date__c = THIS_YEAR ' +
             'AND Production_Picked_up_Date__c = null';
  function one(soql) { return wbQ_(soql)[0] || {}; }
  var tot = one('SELECT COUNT(Id) n, SUM(Total_API__c) api, AVG(Days_App_Not_Picked_Up__c) d ' + base);
  function band(label, where) {
    var r = one('SELECT COUNT(Id) n, SUM(Total_API__c) api ' + base + ' AND ' + where);
    return { k: label, n: r.n || 0, api: Math.round(r.api || 0) };
  }
  return {
    n: tot.n || 0, api: Math.round(tot.api || 0), avgDays: Math.round(tot.d || 0),
    bands: [
      band('Under 2 weeks', 'Days_App_Not_Picked_Up__c <= 14'),
      band('2 – 4 weeks',   'Days_App_Not_Picked_Up__c > 14 AND Days_App_Not_Picked_Up__c <= 30'),
      band('1 – 2 months',  'Days_App_Not_Picked_Up__c > 30 AND Days_App_Not_Picked_Up__c <= 60'),
      band('Over 2 months', 'Days_App_Not_Picked_Up__c > 60')
    ],
    byAgent: wbQ_(
      'SELECT AGENT__r.Name a, COUNT(Id) n, SUM(Total_API__c) api ' + base +
      ' GROUP BY AGENT__r.Name ORDER BY SUM(Total_API__c) DESC LIMIT 6'
    ).map(function (r) { return { a: r.a || 'Unassigned', n: r.n, api: Math.round(r.api || 0) }; }),
    top: wbQ_(
      'SELECT AGENT__r.Name, Total_API__c, Days_App_Not_Picked_Up__c ' + base +
      ' ORDER BY Total_API__c DESC NULLS LAST LIMIT 6'
    ).map(function (r) {
      return { a: (r.AGENT__r && r.AGENT__r.Name) || 'Unassigned',
               api: Math.round(r.Total_API__c || 0),
               days: Math.round(r.Days_App_Not_Picked_Up__c || 0) };
    })
  };
}

/* ======================= the Friday 3pm weekly =======================
   The branch weekly, sent company-wide as a real spreadsheet.

   WHY A CLOCK TICK AND NOT A WEEKLY TRIGGER
   Apps Script's weekly time trigger fires somewhere inside the hour you pick
   — "3pm" means between 15:00 and 16:00. This has to land at 3pm sharp, so
   wbWeeklyTick() runs every 5 minutes instead and sends the moment Friday
   passes 15:00. A stamp in Script Properties means it can only go once a
   week however often the tick runs, so a retry or an extra trigger can never
   double-send to the whole company.

   SET IT UP
     1. Project Settings → Time zone → (GMT-04:00) Atlantic Time. Every time
        below is read in that zone; get it wrong and the send moves an hour.
     2. Script Properties:
          WEEKLY_TO   who it goes to, comma-separated (the company list)
          MANAGER_EMAIL  fallback if WEEKLY_TO is unset
     3. Triggers → Add Trigger → wbWeeklyTick → time-driven → minutes timer
        → every 5 minutes.
   Run wbSendWeeklyNow() from the editor any time to send it by hand. */

function wbWeeklyTick() {
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var dow = Number(Utilities.formatDate(now, tz, 'u'));      // 1 Mon … 5 Fri
  var hhmm = Number(Utilities.formatDate(now, tz, 'HHmm'));
  if (dow !== 5 || hhmm < 1500) return;                      // Friday, from 3pm
  var stamp = Utilities.formatDate(now, tz, 'YYYY-ww');      // ISO year + week
  var props = wbProps_();
  if (props.getProperty('WEEKLY_SENT') === stamp) return;    // already gone
  props.setProperty('WEEKLY_SENT', stamp);                   // claim before sending
  try {
    wbSendWeeklyNow();
  } catch (err) {
    props.deleteProperty('WEEKLY_SENT');                     // let the next tick retry
    throw err;
  }
}

function wbSendWeeklyNow() {
  var tz = Session.getScriptTimeZone();
  var p = wbProduction_(), h = p.heldBack || {}, s = wbSettlement_();
  var to = wbProps_().getProperty('WEEKLY_TO')
        || wbProps_().getProperty('MANAGER_EMAIL')
        || Session.getEffectiveUser().getEmail();
  var ending = Utilities.formatDate(new Date(), tz, 'd MMMM yyyy');
  function tt(n) { return 'TT$' + Math.round(n || 0).toLocaleString('en-US'); }
  function tot(o) { return (o.api || 0) + (o.inc || 0); }
  function cnt(o) { return (o.n || 0) + (o.incN || 0); }

  var body = [
    'Branch production to ' + ending + '.',
    '',
    'This week      ' + tt(tot(p.week))  + '  ·  ' + cnt(p.week)  + ' picked up',
    p.month.label + (p.month.label.length < 8 ? '        ' : '   ')
                   + tt(tot(p.month)) + '  ·  ' + cnt(p.month) + ' picked up',
    'Year to date   ' + tt(tot(p.ytd))   + '  ·  ' + cnt(p.ytd)   + ' picked up',
    '',
    'Held back      ' + tt(h.api) + ' across ' + h.n + ' apps, averaging ' + h.avgDays + ' days.',
    'Settled        ' + s.settledN + ' of the year\'s pickups; ' + s.pendingN + ' still pending.',
    '',
    'The attached workbook carries the detail: periods and the year by month,',
    'units, the advisor board, the held-back book and the day-by-day tray.',
    '',
    'Wall: https://factfind360.com/wall.html',
    'Dashboard: https://rickyrampersadbranch.com/dashboard'
  ].join('\n');

  MailApp.sendEmail({
    to: to,
    subject: 'Branch production — week ending ' + ending,
    body: body,
    attachments: [{
      fileName: 'RRB-production-' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + '.xls',
      mimeType: 'application/vnd.ms-excel',
      content: wbWorkbook_(p, s)
    }]
  });
}

/* The same five sheets the wall's Spreadsheet button produces, built here so
   the Friday send does not depend on anyone opening a browser. */
function wbWorkbook_(p, s) {
  function xe(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function cS(v, st) { return '<Cell ss:StyleID="' + st + '"><Data ss:Type="String">' + xe(v) + '</Data></Cell>'; }
  function cN(v, st) { return '<Cell ss:StyleID="' + st + '"><Data ss:Type="Number">' + (v || 0) + '</Data></Cell>'; }
  function R(c) { return '<Row>' + c.join('') + '</Row>'; }
  function sheet(name, cols, rows) {
    return '<Worksheet ss:Name="' + xe(name) + '"><Table>' +
      cols.map(function (w) { return '<Column ss:Width="' + w + '"/>'; }).join('') +
      rows.join('') + '</Table></Worksheet>';
  }
  function tot(o) { return (o.api || 0) + (o.inc || 0); }
  function cnt(o) { return (o.n || 0) + (o.incN || 0); }

  var W = [], r = [
    R([cS('PRODUCTION · Ricky Rampersad Branch', 'tt')]),
    R([cS('Total API = new business on its production picked-up date + increases on theirs', 'sub')]),
    R([cS('')]), R([cS('Period', 'hd'), cS('Pickups', 'hd'), cS('Total API', 'hd')])
  ];
  [['This week', p.week], [p.month.label, p.month], ['Year to date', p.ytd]]
    .forEach(function (x) { r.push(R([cS(x[0], 'p'), cN(cnt(x[1]), 'n'), cN(tot(x[1]), 'm')])); });
  r.push(R([cS('')]));
  r.push(R([cS('Month', 'hd'), cS('New business', 'hd'), cS('Increases', 'hd'), cS('Total API', 'hd')]));
  (p.monthly || []).forEach(function (x) {
    r.push(R([cS(x.m, 'p'), cN(x.api, 'm'), cN(x.inc, 'm'), cN((x.api || 0) + (x.inc || 0), 'mb')]));
  });
  W.push(sheet('Production', [200, 90, 120, 120], r));

  var a = [R([cS('Rank', 'hd'), cS('Advisor', 'hd'), cS('Pickups', 'hd'), cS('Total API', 'hd')])];
  (p.leaders || []).forEach(function (x, i) {
    a.push(R([cN(i + 1, 'n'), cS(x.a, 'p'), cN(x.n, 'n'), cN(x.api, 'm')]));
  });
  W.push(sheet('Advisors', [60, 200, 90, 120], a));

  var h = p.heldBack || {}, hb = [
    R([cS('Held back — written, waiting on requirements', 'tt')]),
    R([cS(h.n + ' apps · avg ' + h.avgDays + ' days', 'sub')]), R([cS('')]),
    R([cS('How long it waited', 'hd'), cS('Apps', 'hd'), cS('API', 'hd')])
  ];
  (h.bands || []).forEach(function (b) { hb.push(R([cS(b.k, 'p'), cN(b.n, 'n'), cN(b.api, 'm')])); });
  hb.push(R([cS('')]));
  hb.push(R([cS('Advisor', 'hd'), cS('Apps', 'hd'), cS('API', 'hd')]));
  (h.byAgent || []).forEach(function (b) { hb.push(R([cS(b.a, 'p'), cN(b.n, 'n'), cN(b.api, 'm')])); });
  W.push(sheet('Held back', [210, 90, 120], hb));

  var st = [
    R([cS('Settled', 'hd'), cS('Pending', 'hd'), cS('Avg days to settle', 'hd')]),
    R([cN(s.settledN, 'n'), cN(s.pendingN, 'n'), cN(s.avgDays, 'n')]), R([cS('')]),
    R([cS('Month', 'hd'), cS('Settled', 'hd'), cS('Settled API', 'hd'),
       cS('Pending', 'hd'), cS('Pending API', 'hd')])
  ];
  (s.monthly || []).forEach(function (x) {
    st.push(R([cS(x.m, 'p'), cN(x.sN, 'n'), cN(x.sApi, 'm'), cN(x.pN, 'n'), cN(x.pApi, 'm')]));
  });
  W.push(sheet('Settlement', [110, 90, 130, 90, 130], st));

  var wk = [R([cS('Week', 'hd'), cS('Pickups', 'hd'), cS('API', 'hd')])];
  (p.weekly || []).forEach(function (x) { wk.push(R([cS(x.w, 'p'), cN(x.n, 'n'), cN(x.api, 'm')])); });
  W.push(sheet('Week by week', [140, 90, 130], wk));

  return '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles>' +
    '<Style ss:ID="tt"><Font ss:Bold="1" ss:Size="14"/></Style>' +
    '<Style ss:ID="sub"><Font ss:Color="#666666"/></Style>' +
    '<Style ss:ID="hd"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0D9488" ss:Pattern="Solid"/></Style>' +
    '<Style ss:ID="p"/><Style ss:ID="n"/>' +
    '<Style ss:ID="m"><NumberFormat ss:Format="#,##0"/></Style>' +
    '<Style ss:ID="mb"><Font ss:Bold="1"/><NumberFormat ss:Format="#,##0"/></Style>' +
    '</Styles>' + W.join('') + '</Workbook>';
}

// Last nine weeks as Monday-start buckets, built from the raw dates so the
// labels can say which week each bar is, whatever Salesforce's locale week is.
function wbWeekly_() {
  var recs = wbQ_(
    'SELECT Production_Picked_up_Date__c d, Total_API__c api FROM CLIENT_PORTFOLIO__c ' +
    'WHERE Production_Picked_up_Date__c = LAST_N_DAYS:70'
  );
  var buckets = {};
  recs.forEach(function (r) {
    var dt = new Date(r.d + 'T12:00:00Z');
    var day = (dt.getUTCDay() + 6) % 7;                       // Monday = 0
    var mon = new Date(dt.getTime() - day * 864e5);
    var key = Utilities.formatDate(mon, 'UTC', 'yyyy-MM-dd');
    if (!buckets[key]) buckets[key] = { n: 0, api: 0, mon: mon };
    buckets[key].n++; buckets[key].api += (r.api || 0);
  });
  var keys = Object.keys(buckets).sort().slice(-9);
  return keys.map(function (k, i) {
    var b = buckets[k];
    var lab = i === keys.length - 1 ? 'This wk'
            : i === keys.length - 2 ? 'Last wk'
            : 'w/c ' + Utilities.formatDate(b.mon, 'UTC', 'd MMM');
    return { w: lab, n: b.n, api: Math.round(b.api) };
  });
}

/* Life production history is closed (2011–2017), so query it once and keep it. */
function wbLegacy_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('wb_legacy');
  if (hit) return JSON.parse(hit);
  var t = wbQ_(
    'SELECT COUNT(Id) n, SUM(Submitted_API__c) s, SUM(Settled_API__c) st, SUM(Total_Apps__c) a FROM Submission__c'
  )[0] || {};
  var best = wbQ_(
    'SELECT CALENDAR_YEAR(Submitted_Date__c) y, SUM(Submitted_API__c) s FROM Submission__c ' +
    'WHERE Submitted_Date__c != null GROUP BY CALENDAR_YEAR(Submitted_Date__c) ' +
    'ORDER BY SUM(Submitted_API__c) DESC LIMIT 1'
  )[0] || {};
  var years = wbQ_(
    'SELECT MIN(Submitted_Date__c) lo, MAX(Submitted_Date__c) hi FROM Submission__c'
  )[0] || {};
  var out = {
    cases: t.n || 0,
    submittedApi: Math.round(t.s || 0), settledApi: Math.round(t.st || 0),
    apps: Math.round(t.a || 0),
    years: String(years.lo || '').slice(0, 4) + ' – ' + String(years.hi || '').slice(0, 4),
    bestYear: String(best.y || ''), bestYearApi: Math.round(best.s || 0)
  };
  cache.put('wb_legacy', JSON.stringify(out), 6 * 60 * 60);
  return out;
}

/* ============================ privacy helpers ============================ */

// "Shalima" + "Mohammed" → "Shalima M." — enough for the team, nothing for a stranger.
function wbMask_(first, last) {
  var f = String(first || '').trim(), l = String(last || '').trim();
  if (!f && !l) return 'Client';
  return (f || l) + (l && f ? ' ' + l.charAt(0).toUpperCase() + '.' : '');
}

// Read the risk flavour off the policy prefix; never show the number itself.
function wbRiskLabel_(policy) {
  var p = String(policy || '').replace(/\s/g, '').toUpperCase();
  if (p.indexOf('FHO') > -1) return 'Homeowner';
  if (p.indexOf('FAR') > -1) return 'All risk property';
  if (p.indexOf('FCP') > -1 || p.indexOf('FSP') > -1) return 'Commercial property';
  if (p.indexOf('CPL') > -1) return 'Liability';
  if (p.indexOf('AP') > -1) return 'Motor';
  return 'Policy';
}

// Opportunity names carry full client names ("OPP Life - Sean Sookoo") —
// trim the prefix and shorten the person to first name + initial.
function wbOppLabel_(name) {
  var s = String(name || '').replace(/^OPP?\s+/i, '');
  var m = s.match(/^([^-–]+)[-–]\s*(.+)$/);
  if (!m) return s;
  var kind = m[1].trim(), who = m[2].trim();
  var words = who.split(/\s+/);
  // Only mask things that read like a person, not company names.
  if (words.length >= 2 && words.length <= 4 && !/Ltd|Limited|&|Company|Hardware|Marine/i.test(who)) {
    who = words[0] + ' ' + words[words.length - 1].charAt(0).toUpperCase() + '.';
  }
  return kind + ' — ' + who;
}

/* ============================ salesforce ============================ */

function wbProps_() { return PropertiesService.getScriptProperties(); }

function wbToken_() {
  var p = wbProps_();
  var cached = p.getProperty('SF_TOKEN'), when = Number(p.getProperty('SF_TOKEN_AT') || 0);
  if (cached && (new Date().getTime() - when) < 50 * 60 * 1000) return JSON.parse(cached);

  var key = p.getProperty('SF_KEY'), secret = p.getProperty('SF_SECRET');
  var user = p.getProperty('SF_USER'), pass = p.getProperty('SF_PASS');
  if (!key || !secret || !user || !pass)
    throw new Error('Salesforce is not set up — run ☁ Salesforce → Set up connection in the renewal sheet first.');

  var res = UrlFetchApp.fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'password', client_id: key, client_secret: secret,
               username: user, password: pass },
  });
  if (res.getResponseCode() !== 200)
    throw new Error('Salesforce login failed: ' + res.getContentText());
  var tok = JSON.parse(res.getContentText());
  p.setProperty('SF_TOKEN', JSON.stringify(tok));
  p.setProperty('SF_TOKEN_AT', String(new Date().getTime()));
  return tok;
}

function wbQ_(soql) {
  var tok = wbToken_();
  var url = tok.instance_url + '/services/data/' + WB.API + '/query?q=' + encodeURIComponent(soql);
  var out = [];
  while (url) {
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + tok.access_token }, muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 401) {           // token died mid-flight — one retry
      wbProps_().deleteProperty('SF_TOKEN');
      tok = wbToken_();
      res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + tok.access_token }, muteHttpExceptions: true });
    }
    if (res.getResponseCode() !== 200)
      throw new Error('SOQL failed (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 300));
    var j = JSON.parse(res.getContentText());
    out = out.concat(j.records || []);
    url = j.nextRecordsUrl ? tok.instance_url + j.nextRecordsUrl : null;
  }
  return out;
}

/* Run this from the editor to eyeball the payload before deploying. */
function wbTest() {
  Logger.log(JSON.stringify(wbBuild_(), null, 2));
}
