// ═══════════════════════════════════════════════════════════════════════════
// RR BRANCH — WALLBOARD FEED
//
// Feeds the screen on the agency wall. That screen is read by clients in the
// waiting area, visitors, and anyone walking past, so this endpoint is built
// so that it CANNOT return client data — not "does not", cannot.
//
// Every field it reads is on WALL_FIELDS below. There is no code path here
// that touches a client name, ID number, date of birth, income, medical note
// or contact detail, because those keys are never read from the row in the
// first place. Adding one would mean editing this list, which is the point:
// the list is the control.
//
// Setup:  run rrbWallSetup() once, then open the URL it logs on the TV.
// ═══════════════════════════════════════════════════════════════════════════

var RRB_WALL_KEY_PROP = 'RRB_WALL_KEY';
var RRB_WALL_CACHE    = 'rrb_wall_payload';
var RRB_WALL_TTL      = 45;   // seconds — the screen polls slower than this

/** The ONLY columns the wallboard may read. Nothing here identifies a client. */
var WALL_FIELDS = [
  'agentCode', 'advisorName', 'reviewerName', 'reviewerKey', 'mgrName', 'status',
  'submittedAt', 'mgrReviewedAt', 'appType', 'repDetected', 'fi_uwEvidence',
  'insuranceNeed_calc', 'cashSurplus_calc',
  'rec1Amt','rec2Amt','rec3Amt','rec4Amt','rec5Amt','rec6Amt',
  'rec1Prem','rec2Prem','rec3Prem','rec4Prem','rec5Prem','rec6Prem',
  'rec1Mode','rec2Mode','rec3Mode','rec4Mode','rec5Mode','rec6Mode',
  // What the client actually took, which is the production number. Amounts and
  // a yes/no — still nothing that identifies anybody.
  'dec1Prem','dec2Prem','dec3Prem','dec4Prem','dec5Prem','dec6Prem',
  'dec1Amt','dec2Amt','dec3Amt','dec4Amt','dec5Amt','dec6Amt',
  'dec1Go','dec2Go','dec3Go','dec4Go','dec5Go','dec6Go',
  'dec1Plan','dec2Plan','dec3Plan','dec4Plan','dec5Plan','dec6Plan',
  'rec1Rec','rec2Rec','rec3Rec','rec4Rec','rec5Rec','rec6Rec',
  // Whether the case actually completed. Without this every intention counts
  // as production and the board overstates the branch permanently.
  'caseOutcome', 'caseOutcomeAt'
];

/**
 * Annual Premium Income.
 *
 * A premium means nothing until you know how often it is paid — $500 monthly
 * and $500 annually are the same figure and twelve times the business. This
 * annualises by mode.
 *
 * Mode is a new field, so every case written before it existed has none. Those
 * are annualised as monthly, which is how premiums are quoted here, and the
 * count of assumed rows travels with the total so nobody mistakes an
 * assumption for a fact.
 */
function rrbApiMultiplier_(mode) {
  var m = _str(mode).toLowerCase();
  if (/annual/.test(m) && !/semi/.test(m)) return 1;
  if (/semi/.test(m)) return 2;
  if (/quarter/.test(m)) return 4;
  if (/month/.test(m)) return 12;
  return 12;                       // unstated — treated as monthly
}
function rrbApiAssumed_(mode) { return _str(mode) === ''; }

/** One-time setup. Prints the URL to open on the TV. */
function rrbWallSetup() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty(RRB_WALL_KEY_PROP);
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty(RRB_WALL_KEY_PROP, key);
    Logger.log('Wallboard key created.');
  } else {
    Logger.log('Wallboard key already exists — reusing it.');
  }
  var url = (typeof RRB_APP_URL === 'string' && RRB_APP_URL) ? RRB_APP_URL : ScriptApp.getService().getUrl();
  Logger.log('Feed URL:  %s?action=wall&k=%s', url, key);
  Logger.log('Put that key into wall.html as WALL_KEY, then open wall.html on the TV.');
  Logger.log('If the key ever leaks, run rrbWallRotateKey() — it exposes no client data either way.');
  return key;
}

/** Issue a new key and invalidate the old one. */
function rrbWallRotateKey() {
  PropertiesService.getScriptProperties().deleteProperty(RRB_WALL_KEY_PROP);
  return rrbWallSetup();
}

/** The sheet holds a mix of RAJIV SOODOO and Varun Seegolam. On a wall that
 *  reads as a fault, so names are normalised on the way out. */
function rrbWallName_(s) {
  var v = _str(s);
  if (!v) return '';
  if (v !== v.toUpperCase() && v !== v.toLowerCase()) return v;   // already mixed
  return v.toLowerCase().replace(/(^|[\s'\-])([a-z])/g, function (m, p, c) {
    return p + c.toUpperCase();
  });
}

function rrbWallDays_(from, to) {
  var a = new Date(from), b = to ? new Date(to) : new Date();
  if (isNaN(a.getTime())) return null;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

/**
 * The wallboard payload. Aggregates and agent names only.
 */
function rrbWall(e) {
  var key = PropertiesService.getScriptProperties().getProperty(RRB_WALL_KEY_PROP);
  var given = _str(e && e.parameter && e.parameter.k);
  if (!key || !given || given !== key) {
    return { ok: false, error: 'This screen is not authorised. Run rrbWallSetup() and check the key.' };
  }

  var cache = CacheService.getScriptCache();
  var hit = cache.get(RRB_WALL_CACHE);
  if (hit) { try { return JSON.parse(hit); } catch (err) {} }

  var sh = SpreadsheetApp.openById(FF_SHEET_ID).getSheetByName(FF_REVISED_TAB);
  if (!sh || sh.getLastRow() < 2) {
    return { ok: true, empty: true, asOf: new Date().toISOString() };
  }

  var values  = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) { return _str(h); });
  var maps    = _ffSchemaMaps();

  // Resolve only the permitted columns. Everything else stays unread.
  var idx = {};
  WALL_FIELDS.forEach(function (k) {
    var lbl = maps.k2l[k];
    var i = lbl ? headers.indexOf(lbl) : -1;
    if (i >= 0) idx[k] = i;
  });
  var get = function (row, k) { return idx[k] === undefined ? '' : row[idx[k]]; };

  var now = new Date();
  var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var dow = now.getDay();                                // Sunday = 0 — the branch week
  var startOfWeek = new Date(startOfDay.getTime() - dow * 86400000);
  var startOfLastWeek = new Date(startOfWeek.getTime() - 7 * 86400000);
  var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // The producer board is read for the year as much as the week — an advisor's
  // year is the number that decides qualification, and it is invisible on a
  // board that only ever looks back a month.
  var startOfYear = new Date(now.getFullYear(), 0, 1);

  var tz = Session.getScriptTimeZone();
  var today = { submitted: 0, approved: 0 };
  var week  = { submitted: 0, approved: 0, premium: 0, need: 0, cover: 0, api: 0 };
  var lastWeek = { submitted: 0 };
  var month = { submitted: 0, approved: 0, premium: 0, need: 0, cover: 0,
                api: 0, apiAssumed: 0 };
  var year  = { submitted: 0, need: 0, cover: 0, api: 0, pickedUp: 0 };
  // Sunday counts. A branch that works the weekend should see it said out loud.
  var weekend = { week: 0, month: 0 }, weekendWho = {};
  // The production board: applications taken, clients, products and API.
  var prod = { mtd: { apps: 0, clients: 0, api: 0, apiRec: 0, subCases: 0,
                      pipeline: 0, stale: 0, staleCases: 0, open: 0, assumed: 0, cases: 0 },
               wtd: { apps: 0, clients: 0, api: 0, pipeline: 0, assumed: 0, cases: 0 } };
  var products = {};
  var agents = {}, monthAgents = {}, yearAgents = {}, managers = {}, approvals = [];

  // Fourteen dated buckets, pre-seeded so quiet days are drawn as gaps rather
  // than skipped — a chart that silently omits its zeros tells a lie.
  var series = {}, seriesOrder = [];
  for (var back = 13; back >= 0; back--) {
    var dd = new Date(startOfDay.getTime() - back * 86400000);
    var kk = Utilities.formatDate(dd, tz, 'yyyy-MM-dd');
    series[kk] = { d: kk, lbl: Utilities.formatDate(dd, tz, 'EEE'),
                   dom: Utilities.formatDate(dd, tz, 'd'), n: 0, a: 0 };
    seriesOrder.push(kk);
  }
  var queue = { pending: 0, oldestDays: 0, oldestWho: '', breaching: 0 };
  // How managers manage: turnaround, and what they send back.
  var mgrPerf = {};
  var mgrOf = function (n) {
    if (!mgrPerf[n]) mgrPerf[n] = { name: n, approved: 0, returned: 0, days: [], pending: 0 };
    return mgrPerf[n];
  };
  var returned = [];
  var flags = { replacements: 0, overCommitted: 0, evidence: 0 };
  var justIn = null;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var agent  = rrbWallName_(get(row, 'advisorName')) || _str(get(row, 'agentCode'));
    var status = _str(get(row, 'status')).toLowerCase();
    var subAt  = get(row, 'submittedAt');
    var sub    = subAt ? new Date(subAt) : null;
    if (sub && isNaN(sub.getTime())) sub = null;

    var prem = 0, amt = 0, api = 0, apiTaken = 0, apps = 0, assumed = 0, sold = 0;
    var outcome = _str(get(row, 'caseOutcome'));
    // Submitted is with head office. Picked up is delivered and paid. Only the
    // second is API — an application can still fail underwriting, be declined,
    // or simply never be collected.
    var isClosed = /^picked up$/i.test(outcome);
    var isSubmitted = /^submitted$/i.test(outcome);
    var isLost   = /^not proceeding$/i.test(outcome);
    var prodSeen = {};
    for (var i = 1; i <= 6; i++) {
      var rp = rrbNum_(get(row, 'rec' + i + 'Prem'));
      var md = get(row, 'rec' + i + 'Mode');
      var mult = rrbApiMultiplier_(md);
      prem += rp;
      amt  += rrbNum_(get(row, 'rec' + i + 'Amt'));
      if (rp > 0) {
        api += rp * mult;
        if (rrbApiAssumed_(md)) assumed++;
      }
      // Production: what the client is actually taking.
      var go = _str(get(row, 'dec' + i + 'Go'));
      if (/^yes$/i.test(go)) {
        apps++;
        var dp = rrbNum_(get(row, 'dec' + i + 'Prem')) || rp;
        sold += rrbNum_(get(row, 'dec' + i + 'Amt')) || rrbNum_(get(row, 'rec' + i + 'Amt'));
        apiTaken += dp * mult;   // intention — pipeline until confirmed
        var pl = _str(get(row, 'dec' + i + 'Plan')) || _str(get(row, 'rec' + i + 'Rec'));
        if (pl) prodSeen[pl] = (prodSeen[pl] || 0) + dp * mult;
      }
    }

    if (sub) {
      if (sub >= startOfDay)   { today.submitted++; }
      if (sub >= startOfWeek)  { week.submitted++;  week.premium  += prem; }
      else if (sub >= startOfLastWeek) { lastWeek.submitted++; }
      if (sub >= startOfMonth) { month.submitted++; month.premium += prem; }

      var dk = Utilities.formatDate(sub, tz, 'yyyy-MM-dd');
      if (series[dk]) series[dk].n++;
      var wd = sub.getDay(), isWeekend = (wd === 0 || wd === 6);

      var need = rrbNum_(get(row, 'insuranceNeed_calc'));

      if (sub >= startOfYear) {
        year.submitted++; year.need += need; year.cover += amt; year.api += api;
        if (isClosed) year.pickedUp += apiTaken;
        if (agent) {
          if (!yearAgents[agent]) yearAgents[agent] =
            { name: agent, count: 0, need: 0, cover: 0, sold: 0,
              apiRec: 0, pickedUp: 0, pipeline: 0, apps: 0, premium: 0 };
          var ya = yearAgents[agent];
          ya.count++; ya.need += need; ya.cover += amt; ya.sold += sold;
          ya.apiRec += api; ya.apps += apps;
          if (isClosed) ya.pickedUp += apiTaken;
          else if (!isLost) ya.pipeline += apiTaken;
        }
      }

      if (sub >= startOfMonth) {
        month.need += need; month.cover += amt; month.api += api;
        month.apiAssumed += assumed;
        if (apps && !isLost) {
          prod.mtd.apps += apps; prod.mtd.clients++;
          if (isClosed) prod.mtd.api += apiTaken;
          else {
            if (isSubmitted) prod.mtd.subCases++;
            prod.mtd.pipeline += apiTaken;
            prod.mtd.open++;
            // How much has been sitting unanswered too long to still be believed.
            var ageD = Math.floor((now.getTime() - sub.getTime()) / 86400000);
            if (ageD >= 14) { prod.mtd.stale += apiTaken; prod.mtd.staleCases++; }
          }
        }
        prod.mtd.apiRec += api;
        prod.mtd.cases++;
        Object.keys(prodSeen).forEach(function (k) {
          if (!products[k]) products[k] = { name: k, apps: 0, api: 0 };
          products[k].api += prodSeen[k]; products[k].apps++;
        });
        if (isWeekend) weekend.month++;
        if (agent) {
          if (!monthAgents[agent]) monthAgents[agent] =
            { name: agent, count: 0, premium: 0, cover: 0, need: 0,
              apiRec: 0, pickedUp: 0, pipeline: 0, apps: 0, sold: 0 };
          monthAgents[agent].count++;
          monthAgents[agent].apiRec  += api;
          monthAgents[agent].sold    += sold;
          monthAgents[agent].premium += prem;
          monthAgents[agent].cover   += amt;
          monthAgents[agent].need    += need;
          // Submitted is not a separate column any more — an application with
          // head office is still money that has not arrived, so it sits in
          // pipeline until it is picked up.
          if (isClosed) monthAgents[agent].pickedUp += apiTaken;
          else if (!isLost) monthAgents[agent].pipeline += apiTaken;
          monthAgents[agent].apps    += apps;
        }
      }
      if (sub >= startOfWeek) {
        week.need += need; week.cover += amt; week.api += api;
        if (apps && !isLost) {
          prod.wtd.apps += apps; prod.wtd.clients++;
          if (isClosed) prod.wtd.api += apiTaken; else prod.wtd.pipeline += apiTaken;
        }
        prod.wtd.cases++;
        if (isWeekend) { weekend.week++; if (agent) weekendWho[agent] = (weekendWho[agent] || 0) + 1; }
        if (agent) {
          if (!agents[agent]) agents[agent] =
            { name: agent, count: 0, premium: 0, cover: 0, need: 0,
              apiRec: 0, pickedUp: 0, pipeline: 0, apps: 0, sold: 0 };
          agents[agent].count++;
          agents[agent].apiRec  += api;
          agents[agent].sold    += sold;
          agents[agent].premium += prem;
          agents[agent].cover   += amt;
          agents[agent].need    += need;
          // Submitted is not a separate column any more — an application with
          // head office is still money that has not arrived, so it sits in
          // pipeline until it is picked up.
          if (isClosed) agents[agent].pickedUp += apiTaken;
          else if (!isLost) agents[agent].pipeline += apiTaken;
          agents[agent].apps    += apps;
        }
      }
      if (!justIn || sub > new Date(justIn.at)) {
        justIn = { agent: agent || 'an advisor', at: sub.toISOString() };
      }
    }

    // Reviewed either way — approved or sent back — is a manager acting.
    if (status === 'approved' || status === 'changes_requested') {
      var rvw = get(row, 'mgrReviewedAt');
      var rvD = rvw ? new Date(rvw) : null;
      var who = rrbWallName_(get(row, 'reviewerName')) || rrbWallName_(get(row, 'mgrName'));
      if (who && rvD && !isNaN(rvD.getTime())) {
        var mp = mgrOf(who);
        if (status === 'approved') mp.approved++; else mp.returned++;
        if (sub) {
          var turn = (rvD.getTime() - sub.getTime()) / 86400000;
          if (turn >= 0 && turn < 400) mp.days.push(turn);
        }
      }
      if (status === 'changes_requested' && rvD && !isNaN(rvD.getTime())) {
        // Deliberately no reason text. dmGuidance and mgrComments are free
        // prose about a client's case — they can name the client, quote their
        // income, or describe their health. That belongs on the signed-in
        // dashboard, never on a screen in the waiting area. The wall shows
        // THAT a case went back and who sent it; the why is a click away.
        returned.push({ manager: who || 'unknown', agent: agent || 'an advisor',
                        at: rvD.toISOString() });
      }
    }

    if (status === 'approved') {
      var rev = get(row, 'mgrReviewedAt');
      var revD = rev ? new Date(rev) : null;
      if (revD && !isNaN(revD.getTime())) {
        if (revD >= startOfDay)  today.approved++;
        if (revD >= startOfWeek) week.approved++;
        if (revD >= startOfMonth) month.approved++;
        var ak = Utilities.formatDate(revD, tz, 'yyyy-MM-dd');
        if (series[ak]) series[ak].a++;
        if (revD >= startOfWeek && agent)
          approvals.push({ agent: agent, at: revD.toISOString() });
      }
    }

    if (status === 'pending_review' || status === 'submitted') {
      queue.pending++;
      var age = sub ? rrbWallDays_(sub, now) : null;
      if (age !== null) {
        if (age > queue.oldestDays) {
          queue.oldestDays = age;
          queue.oldestWho  = rrbWallName_(get(row, 'reviewerName')) || 'unassigned';
        }
        if (age >= 3) queue.breaching++;
      }
      var mgr = rrbWallName_(get(row, 'reviewerName')) || 'Unassigned';
      mgrOf(mgr).pending++;
      if (!managers[mgr]) managers[mgr] = { name: mgr, count: 0, oldestDays: 0 };
      managers[mgr].count++;
      if (age !== null && age > managers[mgr].oldestDays) managers[mgr].oldestDays = age;

      var rep = _str(get(row, 'repDetected'));
      if (rep && !/^(n|no|false|0)$/i.test(rep)) flags.replacements++;
      // Was: any non-empty value. That fired on 10 of 14 pending cases, which
      // is noise, and a flag nobody believes is worse than no flag. Affirmative
      // values only — under-reporting beats crying wolf on a wall.
      var ev = _str(get(row, 'fi_uwEvidence'));
      if (/^(y|yes|true|1|required)$/i.test(ev)) flags.evidence++;
      var surplus = rrbNum_(get(row, 'cashSurplus_calc'));
      if (surplus > 0 && prem > 0 && (prem / surplus) > 0.8) flags.overCommitted++;
    }
  }

  var toList = function (o, sortKey) {
    var a = Object.keys(o).map(function (k) { return o[k]; });
    a.sort(function (x, y) { return (y[sortKey] || 0) - (x[sortKey] || 0); });
    return a;
  };

  var out = {
    ok: true,
    asOf: now.toISOString(),
    today: today,
    week: { submitted: week.submitted, approved: week.approved,
            premium: Math.round(week.premium), lastWeek: lastWeek.submitted,
            need: Math.round(week.need), cover: Math.round(week.cover) },
    weekend: { week: weekend.week, month: weekend.month,
               who: Object.keys(weekendWho).map(function (k) {
                 return { name: k, n: weekendWho[k] }; })
                 .sort(function (a, b) { return b.n - a.n; }) },
    month: { submitted: month.submitted, approved: month.approved,
             premium: Math.round(month.premium), need: Math.round(month.need),
             cover: Math.round(month.cover), api: Math.round(month.api),
             apiAssumed: month.apiAssumed,
             label: Utilities.formatDate(now, tz, 'MMMM') },
    // The production board. API is annualised from the premium mode.
    production: {
      mtd: { apps: prod.mtd.apps, clients: prod.mtd.clients,
             api: Math.round(prod.mtd.api), apiRec: Math.round(prod.mtd.apiRec),
             subCases: prod.mtd.subCases,
             pipeline: Math.round(prod.mtd.pipeline),
             stale: Math.round(prod.mtd.stale), staleCases: prod.mtd.staleCases,
             open: prod.mtd.open, cases: prod.mtd.cases },
      wtd: { apps: prod.wtd.apps, clients: prod.wtd.clients,
             api: Math.round(prod.wtd.api),
             pipeline: Math.round(prod.wtd.pipeline), cases: prod.wtd.cases },
      products: Object.keys(products).map(function (k) {
        return { name: k, apps: products[k].apps, api: Math.round(products[k].api) };
      }).sort(function (a, b) { return b.api - a.api; }).slice(0, 8)
    },
    year: { submitted: year.submitted, need: Math.round(year.need),
            cover: Math.round(year.cover), api: Math.round(year.api),
            pickedUp: Math.round(year.pickedUp),
            label: Utilities.formatDate(now, tz, 'yyyy') },
    yearLeaders: toList(yearAgents, 'pickedUp').slice(0, 8),
    series: seriesOrder.map(function (k) { return series[k]; }),
    leaders: toList(agents, 'count').slice(0, 8),
    monthLeaders: toList(monthAgents, 'count').slice(0, 8),
    approvals: approvals.sort(function (x, y) {
      return new Date(y.at).getTime() - new Date(x.at).getTime();
    }).slice(0, 6),
    queue: queue,
    managers: toList(managers, 'count').slice(0, 6),
    flags: flags,
    // How managers manage. Median, not mean — one case stuck 54 days drags a
    // mean into fiction and the manager stops believing the number.
    managerPerf: Object.keys(mgrPerf).map(function (k) {
      var m = mgrPerf[k], ds = m.days.slice().sort(function (a, b) { return a - b; });
      var med = ds.length ? (ds.length % 2 ? ds[(ds.length - 1) / 2]
                : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2) : null;
      var done = m.approved + m.returned;
      return { name: m.name, approved: m.approved, returned: m.returned, pending: m.pending,
               medianDays: med === null ? null : Math.round(med * 10) / 10,
               returnRate: done ? Math.round(m.returned / done * 100) : null, reviewed: done };
    }).sort(function (a, b) { return b.reviewed - a.reviewed; }),
    // Sent back, and the reason the manager gave. Truncated — this is a wall,
    // and the full guidance lives on the case.
    returned: returned.sort(function (x, y) {
      return new Date(y.at).getTime() - new Date(x.at).getTime();
    }).slice(0, 5).map(function (r) {
      return { manager: r.manager, agent: r.agent, at: r.at };
    }),
    justIn: justIn
  };

  try { cache.put(RRB_WALL_CACHE, JSON.stringify(out), RRB_WALL_TTL); } catch (err) {}
  return out;
}

/** Console check: proves the payload carries no client identifiers. */
function rrbWallCheck() {
  var key = PropertiesService.getScriptProperties().getProperty(RRB_WALL_KEY_PROP);
  if (!key) { Logger.log('No wallboard key yet — run rrbWallSetup() first.'); return; }
  var out = rrbWall({ parameter: { k: key } });
  var blob = JSON.stringify(out);
  Logger.log('Payload: %s bytes, %s agents, %s in queue',
             blob.length, (out.leaders || []).length, out.queue && out.queue.pending);

  // The payload must not carry any of these, under any name.
  var banned = ['clientName','fullName','dob','idNumber','monthlyIncome','medical',
                'email','phone','mobile','occupation','employer','adviceClientName'];
  var found = banned.filter(function (k) { return blob.indexOf('"' + k + '"') >= 0; });
  Logger.log(found.length ? 'FAIL — client fields present: ' + found.join(', ')
                          : 'PASS — no client fields in the wallboard payload.');
  Logger.log(blob.slice(0, 900));
}
