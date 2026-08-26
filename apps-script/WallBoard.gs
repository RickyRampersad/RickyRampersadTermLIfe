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
    production: wbProduction_()
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

  return {
    generatedAt: new Date().toISOString(),
    week:  { n: wk.n || 0,  api: Math.round(wk.api || 0),
             prevN: lwk.n || 0, prevApi: Math.round(lwk.api || 0) },
    month: { label: monthNames[now.getMonth()], n: mtd.n || 0, api: Math.round(mtd.api || 0),
             lastYearN: lyMtd.n || 0, lastYearApi: Math.round(lyMtd.api || 0) },
    ytd:   { year: yr, n: ytd.n || 0, api: Math.round(ytd.api || 0),
             lastYearN: lyYtd.n || 0, lastYearApi: Math.round(lyYtd.api || 0) },
    monthly: monthly,
    weekly: wbWeekly_(),
    leaders: wbQ_(
      'SELECT AGENT__r.Name a, COUNT(Id) n, SUM(Total_API__c) api ' + base +
      ' = THIS_YEAR GROUP BY AGENT__r.Name ORDER BY SUM(Total_API__c) DESC LIMIT 10'
    ).map(function (r) {
      return { a: r.a || 'Unassigned', n: r.n, api: Math.round(r.api || 0) };
    }),
    latest: wbQ_(
      'SELECT AGENT__r.Name, Total_API__c, Production_Picked_up_Date__c ' + base +
      ' = THIS_MONTH ORDER BY Production_Picked_up_Date__c DESC LIMIT 10'
    ).map(function (r) {
      return { a: (r.AGENT__r && r.AGENT__r.Name) || 'Unassigned',
               d: r.Production_Picked_up_Date__c, api: Math.round(r.Total_API__c || 0) };
    })
  };
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
