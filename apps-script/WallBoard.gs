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
    // NB: SOQL only allows field aliases in aggregate queries — plain
    // queries must use the API names and read them off the record verbatim.
    renewals: wbQ_(
      'SELECT Contact_First_Name__c, Last_Name__c, Vehicle_Make__c, Policy__c, ' +
      'Next_Renewal_Date__c, Billing_Premiums__c FROM Risk_Details__c ' +
      'WHERE Next_Renewal_Date__c >= TODAY AND Next_Renewal_Date__c <= NEXT_N_DAYS:45 ' +
      'ORDER BY Next_Renewal_Date__c LIMIT 10'
    ).map(function (r) {
      return {
        who: wbMask_(r.Contact_First_Name__c, r.Last_Name__c),
        what: r.Vehicle_Make__c ? r.Vehicle_Make__c + ' · motor' : wbRiskLabel_(r.Policy__c),
        when: r.Next_Renewal_Date__c, prem: Math.round(r.Billing_Premiums__c || 0)
      };
    }),
    claimTypes: claimTypes,
    oldestClaims: wbQ_(
      'SELECT Claim_Reference__c, Claim_Type__c, Days_Pending__c FROM Claims_Revised__c ' +
      "WHERE Claim_Status__c = 'Opened' ORDER BY Days_Pending__c DESC NULLS LAST LIMIT 6"
    ).map(function (r) {
      return { ref: r.Claim_Reference__c || '(no reference)', type: r.Claim_Type__c || 'Unclassified',
               days: Math.round(r.Days_Pending__c || 0) };
    }),
    topOpps: wbQ_(
      'SELECT Name, StageName, Amount FROM Opportunity WHERE IsClosed = false ' +
      'ORDER BY Amount DESC NULLS LAST LIMIT 7'
    ).map(function (r) {
      return { name: wbOppLabel_(r.Name), stage: r.StageName, amt: Math.round(r.Amount || 0) };
    }),
    legacy: wbLegacy_(),
    production: wbProduction_(),
    dashboardAdvisors: wbDashboard_(),
    settlement: wbSettlement_(),
    renewalsWall: wbRenewalsWall_()
  };
}

/* ===================== renewals wall (/renewals/) =====================
   This month's motor + property renewals with renewed/paid state, the open
   task picture, and next month's preview. Same privacy line as the rest of
   the live feed: clients as first name + last initial, no policy numbers,
   no registrations, no addresses — and task subjects are never shipped raw,
   because staff write client names into them. */

function wbRenewalsWall_() {
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth();
  var names = ['January','February','March','April','May','June','July',
               'August','September','October','November','December'];
  function norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  // NB: plain (non-aggregate) SOQL cannot alias fields — API names throughout.
  var due = wbQ_(
    "SELECT Name, Contact_First_Name__c, Last_Name__c, RecordType.Name, Policy__c, " +
    "Vehicle__c, Vehicle_Make__c, Model__c, Motor_Vehicle_Coverage_Type__c, " +
    "Vehicle_Status__c, Property_Type__c, Next_Renewal_Date__c, Billing_Premiums__c, " +
    "Cover1__c, Depreciation_10_Option_1__c, Depreciation_15_Option_2__c, " +
    "Windscreen__c, Waiver_of_Excess__c, Total_Property_Cover__c, Account__c, Risk_Location__c, " +
    "Burglary__c, Stock__c, General_Contents__c, Public_Liability_Cover__c, " +
    "Swimming_Pool__c, Electronic_Equipment__c, WC_Cover__c " +
    "FROM Risk_Details__c WHERE Next_Renewal_Date__c = THIS_MONTH " +
    "AND RecordType.Name IN ('Motor','Property') ORDER BY Next_Renewal_Date__c"
  );

  // Next-cycle rows written recently: the proof a renewal has been renewed.
  // Consumed as they match, so three risks on one policy need three rows.
  var succ = wbQ_(
    "SELECT Policy__c, Vehicle__c, From__c, Billing_Premiums__c, Payments_Made__c, " +
    "Cover1__c, Windscreen__c " +
    "FROM Risk_Details__c WHERE From__c >= LAST_N_DAYS:60 " +
    "AND RecordType.Name IN ('Motor','Property') ORDER BY From__c"
  );
  function successorOf(r) {
    for (var i = 0; i < succ.length; i++) {
      var s = succ[i];
      if (!s.From__c || s.From__c < r.Next_Renewal_Date__c) continue; // new cycle starts on/after the due date
      var hit = (r.Vehicle__c && s.Vehicle__c) ? norm(s.Vehicle__c) === norm(r.Vehicle__c)
              : (r.Policy__c && s.Policy__c) ? norm(s.Policy__c) === norm(r.Policy__c) : false;
      if (hit) { succ.splice(i, 1); return s; }
    }
    return null;
  }
  function propKind(policy) {
    var p = norm(policy);
    if (p.indexOf('FHO') > -1) return 'Homeowner';
    if (p.indexOf('FAR') > -1) return 'All risk';
    if (p.indexOf('FCP') > -1) return 'Commercial package';
    return 'Property';
  }

  // Open tasks hanging off this month's renewals — matched on the risk
  // record itself or the client's account. Counts only; subjects carry
  // client names and never leave this script.
  var linkedTasks = wbQ_(
    "SELECT What.Name, What.Type FROM Task WHERE IsClosed = false " +
    "AND (What.Type = 'Risk_Details__c' OR What.Type = 'Account') LIMIT 400"
  );
  function taskCount(riskName, account) {
    var n = 0;
    linkedTasks.forEach(function (t) {
      var wn = (t.What && t.What.Name) || '';
      if (!wn) return;
      if (wn === riskName || (account && norm(wn) === norm(account))) n++;
    });
    return n;
  }

  var motor = [], property = [], valMotor = [], valProperty = [];
  var compRegs = [], propDue = [];
  due.forEach(function (r) {
    var s = successorOf(r);
    var who = wbMask_(r.Contact_First_Name__c, r.Last_Name__c);
    var row = { d: r.Next_Renewal_Date__c, who: who,
                prem: Math.round((r.Billing_Premiums__c || 0) * 100) / 100 };
    var tn = taskCount(r.Name, r.Account__c);
    if (tn) row.tasks = tn;
    row.__acct = r.Account__c;                                // consumed by the intel pass below
    if (s) { row.renewed = true; row.newPrem = Math.round((s.Billing_Premiums__c || 0) * 100) / 100;
             row.paid = Math.round((s.Payments_Made__c || 0) * 100) / 100; }
    var isMotor = r.RecordType && r.RecordType.Name === 'Motor';
    if (isMotor) {
      row.what = (r.Vehicle_Make__c || 'Vehicle') + (r.Model__c ? ' ' + r.Model__c : '');
      row.cov = /comprehensive/i.test(r.Motor_Vehicle_Coverage_Type__c || '') ? 'Comprehensive' : 'Third party';
      if (r.Vehicle_Status__c && r.Vehicle_Status__c !== 'Current') row.off = r.Vehicle_Status__c;
      motor.push(row);
      // the depreciation conversation — comprehensive only
      if (row.cov === 'Comprehensive' && !row.off) {
        if (r.Vehicle__c) compRegs.push(r.Vehicle__c);
        valMotor.push({
          d: row.d, who: who, what: r.Vehicle_Make__c || 'Vehicle', _reg: r.Vehicle__c,
          cur: s ? Math.round(s.Cover1__c || 0) : Math.round(r.Cover1__c || 0),
          _expiring: Math.round(r.Cover1__c || 0),
          renewed: !!s,
          opt10: Math.round(r.Depreciation_10_Option_1__c || 0),
          opt15: Math.round(r.Depreciation_15_Option_2__c || 0),
          ws: Math.round((s ? s.Windscreen__c : r.Windscreen__c) || 0),
          wsAdded: !!(s && s.Windscreen__c && !r.Windscreen__c),
          waiver: !!r.Waiver_of_Excess__c,
          premSaved: (s && r.Billing_Premiums__c > 0 && s.Billing_Premiums__c < r.Billing_Premiums__c)
            ? Math.round(r.Billing_Premiums__c - s.Billing_Premiums__c) : 0,
        });
      }
    } else {
      row.what = propKind(r.Policy__c);
      row.type = r.Property_Type__c || '—';
      property.push(row);
      // the appreciation conversation — sums insured and riders
      var riders = [];
      if (r.Burglary__c) riders.push('Burglary');
      if (r.Stock__c) riders.push('Stock');
      if (r.General_Contents__c) riders.push('Contents');
      if (r.Public_Liability_Cover__c) riders.push('Public liability');
      if (r.Swimming_Pool__c) riders.push('Pool');
      if (r.Electronic_Equipment__c) riders.push('Electronics');
      if (r.WC_Cover__c) riders.push('WC');
      var sum = Math.round(r.Total_Property_Cover__c || 0);
      propDue.push({ acct: r.Account__c, pol: r.Policy__c, loc: r.Risk_Location__c, sum: sum });
      valProperty.push(sum > 0
        ? { d: row.d, who: who, what: row.what, sum: sum, riders: riders }
        : { d: row.d, who: who, what: row.what, missing: true, riders: riders });
    }
  });

  // Motor: last cycle's value per comprehensive vehicle (for the "last year →
  // this year" pair). One query across the regs; latest row before the
  // current cycle wins.
  if (compRegs.length) {
    var regList = compRegs.map(function (v) { return "'" + String(v).replace(/'/g, "\\'") + "'"; }).join(',');
    var hist = wbQ_(
      'SELECT Vehicle__c, From__c, Cover1__c FROM Risk_Details__c ' +
      "WHERE RecordType.Name = 'Motor' AND Vehicle__c IN (" + regList + ') ORDER BY From__c'
    );
    valMotor.forEach(function (m) {
      var prev = 0;
      hist.forEach(function (h) {
        if (norm(h.Vehicle__c) !== norm(m._reg)) return;
        var v = Math.round(h.Cover1__c || 0);
        if (!v) return;
        if (v === m._expiring || v === m.cur) return;          // the current/renewed cycle itself
        prev = v;                                              // last different value before it
      });
      m.prev = prev || m._expiring;
      if (m.renewed && m._expiring) m.prev = m._expiring;      // renewed: expiring value is "last year"
      if (!m.renewed && !prev) m.prev = m._expiring;           // no history: show the standing figure
      if (!m.renewed && m.prev === m._expiring && m._expiring) m.stuckYears = 2;
      delete m._reg; delete m._expiring;
    });
  }

  // Property: how long each sum insured has sat unchanged, from the same
  // account's history (zero/blank rows are gaps, not changes).
  if (propDue.length) {
    var accts = {};
    propDue.forEach(function (p) { if (p.acct) accts[p.acct] = 1; });
    var acctList = Object.keys(accts).map(function (a) { return "'" + a.replace(/'/g, "\\'") + "'"; }).join(',');
    if (acctList) {
      var ph = wbQ_(
        'SELECT Account__c, Policy__c, Risk_Location__c, From__c, Total_Property_Cover__c ' +
        "FROM Risk_Details__c WHERE RecordType.Name = 'Property' AND Account__c IN (" + acctList + ') ' +
        'ORDER BY From__c'
      );
      valProperty.forEach(function (p, i) {
        var d0 = propDue[i];
        if (!p.sum) return;
        var firstSame = null, seen = 0;
        ph.forEach(function (h) {
          var v = Math.round(h.Total_Property_Cover__c || 0);
          if (!v) return;
          var samePol = d0.pol && h.Policy__c && norm(h.Policy__c) === norm(d0.pol);
          var sameLoc = d0.loc && h.Risk_Location__c &&
            norm(h.Risk_Location__c).slice(0, 14) === norm(d0.loc).slice(0, 14);
          if (!samePol && !sameLoc) return;
          seen++;
          if (v === p.sum) { if (!firstSame) firstSame = h.From__c; }
          else firstSame = null;                               // value moved — restart the run
        });
        if (seen <= 1) p.first = true;
        else if (firstSame) {
          var yrs = Math.floor((new Date() - new Date(firstSame)) / 31557600000);
          if (yrs >= 1) p.years = yrs;
        }
      });
    }
  }

  // ---- the billing month, off TRANSACTIONS__c: this is where payments
  // actually post (Payments_Made__c on risk rows stays empty), and it
  // covers every line of the book, not just motor and property.
  var billingTypes = wbQ_(
    'SELECT RecordType.Name t, COUNT(Id) n, SUM(Total_Premium__c) prem, ' +
    'SUM(Payments_Made__c) paid, SUM(Premium_Owed_Rev__c) owed ' +
    'FROM TRANSACTIONS__c WHERE Renewal_Month__c = ' + (m + 1) +
    ' AND Renewal_Year__c = ' + y + ' GROUP BY RecordType.Name ORDER BY COUNT(Id) DESC'
  ).map(function (r) {
    return { k: String(r.t || '?').replace(/^T-?\s*/i, ''), n: r.n,
             prem: Math.round(r.prem || 0), paid: Math.round(r.paid || 0),
             owed: (r.owed || 0) > 0 ? Math.round(r.owed) : 0 };
  });
  function typePaid(name) {
    var hit = billingTypes.filter(function (x) { return new RegExp(name, 'i').test(x.k); })[0];
    return hit ? hit.paid : 0;
  }
  // per-client payment state for this month's motor/property renewals
  var payTx = wbQ_(
    "SELECT ACCOUNT_NAME__c, Payments_Made__c, Premium_Owed_Rev__c FROM TRANSACTIONS__c " +
    'WHERE Renewal_Month__c = ' + (m + 1) + ' AND Renewal_Year__c = ' + y +
    " AND (RecordType.Name = 'T-MOTOR' OR RecordType.Name = 'T-PROPERTY') LIMIT 200"
  );
  var paidByAcct = {};
  payTx.forEach(function (t) {
    var k = norm(t.ACCOUNT_NAME__c);
    if (!k) return;
    paidByAcct[k] = (paidByAcct[k] || 0) + (t.Payments_Made__c || 0);
  });

  // ---- loyalty + cross-sell per renewal client, from the whole register
  var dueAccts = {};
  due.forEach(function (r) { if (r.Account__c) dueAccts[r.Account__c] = 1; });
  var acctIntel = {};
  var acctNames = Object.keys(dueAccts);
  if (acctNames.length) {
    var inList = acctNames.map(function (a) { return "'" + a.replace(/'/g, "\\'") + "'"; }).join(',');
    wbQ_('SELECT Account__c, RecordType.Name, From__c FROM Risk_Details__c ' +
         'WHERE Account__c IN (' + inList + ') LIMIT 2000')
      .forEach(function (h) {
        var k = norm(h.Account__c);
        var o = acctIntel[k] = acctIntel[k] || { first: '9999', types: {} };
        if (h.From__c && h.From__c < o.first) o.first = h.From__c;
        if (h.RecordType && h.RecordType.Name) o.types[h.RecordType.Name] = 1;
      });
  }
  function intelFor(acct) {
    var o = acctIntel[norm(acct)];
    if (!o) return null;
    var yrs = o.first !== '9999' ? (y - Number(o.first.slice(0, 4))) : 0;
    var gap = (o.types.Motor && !o.types.Property) ? 'home'
            : (o.types.Property && !o.types.Motor) ? 'motor' : '';
    return { yrs: yrs, gap: gap };
  }
  // stamp payment + intel onto the month's rows (live feed only — this
  // never reaches the baked snapshot). acctPaid is the client's payments
  // on this month's motor/property transactions — account level, because
  // a receipt covers the account, not one risk row.
  motor.concat(property).forEach(function (row) {
    var a = row.__acct; delete row.__acct;
    if (!a) return;
    var p = paidByAcct[norm(a)];
    if (p) row.acctPaid = Math.round(p);
    var iv = intelFor(a);
    if (iv) { row.yrs = iv.yrs; if (iv.gap) row.gap = iv.gap; }
  });
  var intelAgg = { clients: acctNames.length, sevenPlus: 0, motorOnly: 0, propertyOnly: 0, healthGap: 0, sumYears: 0 };
  acctNames.forEach(function (a) {
    var iv = intelFor(a);
    if (!iv) return;
    intelAgg.sumYears += iv.yrs;
    if (iv.yrs >= 7) intelAgg.sevenPlus++;
    if (iv.gap === 'home') intelAgg.motorOnly++;
    if (iv.gap === 'motor') intelAgg.propertyOnly++;
    var o = acctIntel[norm(a)];
    if (o && !o.types.Health) intelAgg.healthGap++;
  });

  // ---- the task picture (counts and generic lines only — never raw subjects)
  function one(q) { return (wbQ_(q)[0] || {}).n || 0; }
  var open = one('SELECT COUNT(Id) n FROM Task WHERE IsClosed = false');
  var dueThisMonth = one('SELECT COUNT(Id) n FROM Task WHERE IsClosed = false AND ActivityDate = THIS_MONTH');
  var renewalSubject = one("SELECT COUNT(Id) n FROM Task WHERE IsClosed = false AND Subject LIKE '%renew%'");
  var status = wbQ_('SELECT Status s, COUNT(Id) n FROM Task WHERE IsClosed = false ' +
                    'GROUP BY Status ORDER BY COUNT(Id) DESC')
    .map(function (r) { return { k: r.s === 'In Progress' ? 'In progress'
                                  : r.s === 'Not Started' ? 'Not started' : r.s, n: r.n }; });
  var escalated = status.filter(function (x) { return x.k === 'Escalated'; })
                        .reduce(function (a, x) { return a + x.n; }, 0);
  var ownerRows = wbQ_('SELECT OwnerId oid, COUNT(Id) n FROM Task WHERE IsClosed = false ' +
                       'GROUP BY OwnerId ORDER BY COUNT(Id) DESC LIMIT 8');
  var ids = ownerRows.map(function (r) { return "'" + r.oid + "'"; }).join(',');
  var nameById = {};
  if (ids) wbQ_('SELECT Id, Name FROM User WHERE Id IN (' + ids + ')')
    .forEach(function (u) { nameById[u.Id] = u.Name; });
  var owners = ownerRows.map(function (r) { return { k: nameById[r.oid] || 'Queue', n: r.n }; });

  // renewal chase ladder — payment follow-ups and waiting renewals, genericised
  var chase = wbQ_(
    "SELECT Subject, ActivityDate FROM Task WHERE IsClosed = false " +
    "AND Subject LIKE '%renew%' AND (Subject LIKE '%payment%' OR Subject LIKE '%follow up%' OR Subject LIKE '%due%') " +
    "ORDER BY ActivityDate LIMIT 5"
  ).map(function (r) {
    var s = String(r.Subject || '');
    var line = /FHO|FAR|FCP/i.test(s) ? 'Property' : /AP[UGC]|AOG|APC/i.test(s) ? 'Motor' : 'Renewal';
    var kind = /payment/i.test(s) ? 'Payment follow-up — premium open' : 'Renewal due — waiting on client';
    return { line: line, kind: kind, since: r.ActivityDate };
  });

  // ---- the year so far: motor renewals Jan→now — renewed, lost, who wrote
  // each cycle, what got paid. Lost = date passed, no next-cycle row, vehicle
  // not sold. Same one-to-one matching as the month view, on its own pool.
  var dueY = wbQ_(
    "SELECT Name, Account__c, Contact_First_Name__c, Last_Name__c, Vehicle__c, Policy__c, " +
    "Vehicle_Make__c, Motor_Vehicle_Coverage_Type__c, Vehicle_Status__c, " +
    "Next_Renewal_Date__c, Billing_Premiums__c " +
    "FROM Risk_Details__c WHERE Next_Renewal_Date__c = THIS_YEAR " +
    "AND RecordType.Name = 'Motor' ORDER BY Next_Renewal_Date__c LIMIT 800"
  );
  var cycY = wbQ_(
    "SELECT Vehicle__c, Policy__c, From__c, Billing_Premiums__c, Payments_Made__c, " +
    "Risk_Classification__c, CreatedBy.Name " +
    "FROM Risk_Details__c WHERE From__c >= LAST_N_DAYS:420 " +
    "AND RecordType.Name = 'Motor' ORDER BY From__c LIMIT 900"
  );
  var poolY = cycY.map(function (c) { return c; });
  function succY(r) {
    var d = r.Next_Renewal_Date__c;
    for (var i = 0; i < poolY.length; i++) {
      var s = poolY[i];
      if (s._used || !s.From__c || s.From__c < d) continue;
      var v1 = norm(r.Vehicle__c), v2 = norm(s.Vehicle__c);
      if (v1 && v2) { if (v1 === v2) { s._used = 1; return s; } continue; }
      if (!v1 && !v2 && norm(r.Policy__c) && norm(r.Policy__c) === norm(s.Policy__c)) { s._used = 1; return s; }
    }
    return null;
  }
  var mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var todayIso = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var trendMonths = [], tTot = { due: 0, ren: 0, lost: 0, sold: 0, open: 0, lostPrem: 0, renPrem: 0 };
  for (var mi = 0; mi <= m; mi++) trendMonths.push({ m: mNames[mi], due: 0, ren: 0, lost: 0, sold: 0, open: 0 });
  var lostRows = [], mgrCount = {}, seenLostRegs = {}, payCycles = 0, payAmt = 0;
  dueY.forEach(function (r) {
    var mi = Number(r.Next_Renewal_Date__c.slice(5, 7)) - 1;
    if (mi > m) return;                                       // future months stay out of the trend
    var t = trendMonths[mi];
    t.due++; tTot.due++;
    var s = succY(r);
    var sold = r.Vehicle_Status__c && r.Vehicle_Status__c !== 'Current';
    if (s) {
      t.ren++; tTot.ren++; tTot.renPrem += s.Billing_Premiums__c || 0;
      var by = (s.CreatedBy && s.CreatedBy.Name) || 'Unrecorded';
      mgrCount[by] = mgrCount[by] || { n: 0, prem: 0 };
      mgrCount[by].n++; mgrCount[by].prem += s.Billing_Premiums__c || 0;
      if ((s.Payments_Made__c || 0) > 0) { payCycles++; payAmt += s.Payments_Made__c; }
    } else if (sold) { t.sold++; tTot.sold++; }
    else if (r.Next_Renewal_Date__c < todayIso) {
      t.lost++; tTot.lost++; tTot.lostPrem += r.Billing_Premiums__c || 0;
      lostRows.push(r);
      var k = norm(r.Vehicle__c) || r.Name;
      seenLostRegs[k] = (seenLostRegs[k] || 0) + 1;
    } else { t.open++; tTot.open++; }
  });
  trendMonths.forEach(function (t) {
    var decided = t.due - t.sold - t.open;
    if (decided > 0 && t.open === 0) t.ret = Math.round(t.ren / (t.due - t.sold) * 100);
  });
  var dupRows = 0, distinctLost = 0;
  Object.keys(seenLostRegs).forEach(function (k) { distinctLost++; dupRows += seenLostRegs[k] - 1; });
  // concentration: the account family carrying the most lost rows
  var fam = {};
  lostRows.forEach(function (r) {
    var k = norm(r.Last_Name__c) || norm(r.Account__c);
    fam[k] = fam[k] || { rows: 0, prem: 0, who: wbMask_(r.Contact_First_Name__c, r.Last_Name__c) };
    fam[k].rows++; fam[k].prem += r.Billing_Premiums__c || 0;
  });
  var topFam = { rows: 0, prem: 0, who: '' };
  Object.keys(fam).forEach(function (k) { if (fam[k].rows > topFam.rows) topFam = fam[k]; });
  // recent losses, biggest first — masked names ride the live feed only
  var cutoff = new Date(now.getTime() - 70 * 864e5);
  var recent = lostRows.filter(function (r) { return new Date(r.Next_Renewal_Date__c) >= cutoff; })
    .sort(function (a, b) { return (b.Billing_Premiums__c || 0) - (a.Billing_Premiums__c || 0); })
    .slice(0, 6).map(function (r) {
      return { d: r.Next_Renewal_Date__c,
               what: (r.Vehicle_Make__c || 'Vehicle') + ' · ' +
                     (/comprehensive/i.test(r.Motor_Vehicle_Coverage_Type__c || '') ? 'comprehensive' : 'third party'),
               who: wbMask_(r.Contact_First_Name__c, r.Last_Name__c),
               prem: Math.round(r.Billing_Premiums__c || 0) };
    });
  var gainedN = 0, gainedPrem = 0;
  cycY.forEach(function (s) {
    if (s.Risk_Classification__c === 'New Business' && (s.From__c || '') >= y + '-01-01') {
      gainedN++; gainedPrem += s.Billing_Premiums__c || 0;
    }
  });
  var processed = Object.keys(mgrCount).map(function (k) {
    return { k: k, n: mgrCount[k].n, prem: Math.round(mgrCount[k].prem) };
  }).sort(function (a, b) { return b.n - a.n; }).slice(0, 6);
  // open renewal-subject tasks by owner
  var rtRows = wbQ_("SELECT OwnerId, COUNT(Id) n FROM Task WHERE IsClosed = false " +
                    "AND Subject LIKE '%renew%' GROUP BY OwnerId ORDER BY COUNT(Id) DESC LIMIT 8");
  var rtIds = rtRows.map(function (r) { return "'" + r.OwnerId + "'"; }).join(',');
  var rtName = {};
  if (rtIds) wbQ_('SELECT Id, Name FROM User WHERE Id IN (' + rtIds + ')')
    .forEach(function (u) { rtName[u.Id] = u.Name; });
  var renewalTasks = rtRows.map(function (r) { return { k: rtName[r.OwnerId] || 'Queue', n: r.n }; });

  // ---- next month
  var nm = wbQ_(
    "SELECT RecordType.Name t, COUNT(Id) n, SUM(Billing_Premiums__c) prem FROM Risk_Details__c " +
    "WHERE Next_Renewal_Date__c = NEXT_MONTH AND RecordType.Name IN ('Motor','Property') " +
    "GROUP BY RecordType.Name"
  );
  var nMot = nm.filter(function (r) { return r.t === 'Motor'; })[0] || {};
  var nPro = nm.filter(function (r) { return r.t === 'Property'; })[0] || {};

  return {
    generatedAt: new Date().toISOString(),
    monthLabel: names[m] + ' ' + y,
    monthStart: Utilities.formatDate(new Date(y, m, 1), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    monthDays: new Date(y, m + 1, 0).getDate(),
    motor: motor,
    property: property,
    values: { motor: valMotor, property: valProperty },
    billing: { month: names[m] + ' ' + y, types: billingTypes,
               motorPaid: typePaid('motor'), propPaid: typePaid('property') },
    intel: { clients: intelAgg.clients,
             avgYears: intelAgg.clients ? Math.round(intelAgg.sumYears / intelAgg.clients * 10) / 10 : 0,
             sevenPlus: intelAgg.sevenPlus, motorOnly: intelAgg.motorOnly,
             propertyOnly: intelAgg.propertyOnly, healthGap: intelAgg.healthGap },
    trend: { months: trendMonths,
             totals: { due: tTot.due, ren: tTot.ren, lost: tTot.lost, sold: tTot.sold, open: tTot.open,
                       lostPrem: Math.round(tTot.lostPrem), renPrem: Math.round(tTot.renPrem) },
             distinctLost: distinctLost, dupRows: dupRows,
             gained: { n: gainedN, prem: Math.round(gainedPrem) } },
    losing: { concentration: { label: 'One fleet relationship — ' + topFam.who,
                               rows: topFam.rows, prem: Math.round(topFam.prem) },
              recent: recent },
    managers: { processed: processed, renewalTasks: renewalTasks,
                payments: { cycles: payCycles, amt: Math.round(payAmt), written: Math.round(tTot.renPrem) } },
    tasks: { open: open, dueThisMonth: dueThisMonth, renewalSubject: renewalSubject,
             escalated: escalated, status: status, owners: owners, chase: chase },
    next: { label: names[(m + 1) % 12],
            motorN: nMot.n || 0, motorPrem: Math.round(nMot.prem || 0),
            propN: nPro.n || 0, propPrem: Math.round(nPro.prem || 0) }
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

/* ======================= weekly production report =======================
   Emails a plain summary of the wall's numbers — production incl increases,
   plus held-back API — to MANAGER_EMAIL (Script Properties; comma-separate
   several addresses; falls back to the script owner). To send it every
   Monday morning: Triggers → Add Trigger → wbSendProductionReport →
   time-driven → week timer → Monday 8–9am. Or run it by hand any time. */
function wbSendProductionReport() {
  var p = wbProduction_();
  var to = wbProps_().getProperty('MANAGER_EMAIL') || Session.getEffectiveUser().getEmail();
  function tt(n) { return 'TT$' + Math.round(n).toLocaleString('en-US'); }
  function line(label, o) {
    var all = (o.api || 0) + (o.inc || 0), cnt = (o.n || 0) + (o.incN || 0);
    return label + ': ' + tt(all) + ' across ' + cnt + ' pickups (' +
      tt(o.api || 0) + ' new + ' + tt(o.inc || 0) + ' increases)';
  }
  var hb = p.heldBack, over = hb.bands[hb.bands.length - 1];
  var body = [
    'Production — picked up (new business + increases)',
    '',
    line('This week', p.week),
    line(p.month.label + ' so far', p.month),
    line('Year to date', p.ytd),
    '',
    'Held-back API — apps received this year, not yet picked up',
    '',
    hb.n + ' apps holding ' + tt(hb.api) + ', waiting an average of ' + hb.avgDays + ' days.',
    over.n + ' of them (' + tt(over.api) + ') have waited over two months.',
    '',
    'Held-back by advisor:',
  ].concat(hb.byAgent.map(function (x) {
    return '  ' + x.a + ' — ' + tt(x.api) + ' (' + x.n + ' apps)';
  })).concat([
    '',
    'Live wall: https://rickyrampersadbranch.com/wall/production.html',
  ]).join('\n');
  MailApp.sendEmail({
    to: to,
    subject: 'Production wall — ' + Utilities.formatDate(new Date(),
      Session.getScriptTimeZone(), 'd MMM yyyy'),
    body: body,
  });
}

// Last nine weeks as Monday-start buckets, built from the raw dates so the
// labels can say which week each bar is, whatever Salesforce's locale week is.
function wbWeekly_() {
  var recs = wbQ_(
    'SELECT Production_Picked_up_Date__c, Total_API__c FROM CLIENT_PORTFOLIO__c ' +
    'WHERE Production_Picked_up_Date__c = LAST_N_DAYS:70'
  );
  var buckets = {};
  recs.forEach(function (r) {
    var dt = new Date(r.Production_Picked_up_Date__c + 'T12:00:00Z');
    var day = (dt.getUTCDay() + 6) % 7;                       // Monday = 0
    var mon = new Date(dt.getTime() - day * 864e5);
    var key = Utilities.formatDate(mon, 'UTC', 'yyyy-MM-dd');
    if (!buckets[key]) buckets[key] = { n: 0, api: 0, mon: mon };
    buckets[key].n++; buckets[key].api += (r.Total_API__c || 0);
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
