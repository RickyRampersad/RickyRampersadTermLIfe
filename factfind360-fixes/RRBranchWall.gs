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
  'agentCode', 'advisorName', 'reviewerName', 'reviewerKey', 'status',
  'submittedAt', 'mgrReviewedAt', 'appType', 'repDetected', 'fi_uwEvidence',
  'insuranceNeed_calc', 'cashSurplus_calc',
  'rec1Amt','rec2Amt','rec3Amt','rec4Amt','rec5Amt','rec6Amt',
  'rec1Prem','rec2Prem','rec3Prem','rec4Prem','rec5Prem','rec6Prem'
];

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
  var dow = (now.getDay() + 6) % 7;                       // Monday = 0
  var startOfWeek = new Date(startOfDay.getTime() - dow * 86400000);
  var startOfLastWeek = new Date(startOfWeek.getTime() - 7 * 86400000);
  var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  var today = { submitted: 0, approved: 0 };
  var week  = { submitted: 0, approved: 0, premium: 0 };
  var lastWeek = { submitted: 0 };
  var month = { submitted: 0, premium: 0 };
  var agents = {}, managers = {};
  var queue = { pending: 0, oldestDays: 0, oldestWho: '', breaching: 0 };
  var flags = { replacements: 0, overCommitted: 0, evidence: 0 };
  var justIn = null;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var agent  = _str(get(row, 'advisorName')) || _str(get(row, 'agentCode'));
    var status = _str(get(row, 'status')).toLowerCase();
    var subAt  = get(row, 'submittedAt');
    var sub    = subAt ? new Date(subAt) : null;
    if (sub && isNaN(sub.getTime())) sub = null;

    var prem = 0, amt = 0;
    for (var i = 1; i <= 6; i++) {
      prem += rrbNum_(get(row, 'rec' + i + 'Prem'));
      amt  += rrbNum_(get(row, 'rec' + i + 'Amt'));
    }

    if (sub) {
      if (sub >= startOfDay)   { today.submitted++; }
      if (sub >= startOfWeek)  { week.submitted++;  week.premium  += prem; }
      else if (sub >= startOfLastWeek) { lastWeek.submitted++; }
      if (sub >= startOfMonth) { month.submitted++; month.premium += prem; }

      if (sub >= startOfWeek && agent) {
        if (!agents[agent]) agents[agent] = { name: agent, count: 0, premium: 0, cover: 0 };
        agents[agent].count++;
        agents[agent].premium += prem;
        agents[agent].cover   += amt;
      }
      if (!justIn || sub > new Date(justIn.at)) {
        justIn = { agent: agent || 'an advisor', at: sub.toISOString() };
      }
    }

    if (status === 'approved') {
      var rev = get(row, 'mgrReviewedAt');
      var revD = rev ? new Date(rev) : null;
      if (revD && !isNaN(revD.getTime())) {
        if (revD >= startOfDay)  today.approved++;
        if (revD >= startOfWeek) week.approved++;
      }
    }

    if (status === 'pending_review' || status === 'submitted') {
      queue.pending++;
      var age = sub ? rrbWallDays_(sub, now) : null;
      if (age !== null) {
        if (age > queue.oldestDays) {
          queue.oldestDays = age;
          queue.oldestWho  = _str(get(row, 'reviewerName')) || 'unassigned';
        }
        if (age >= 3) queue.breaching++;
      }
      var mgr = _str(get(row, 'reviewerName')) || 'Unassigned';
      if (!managers[mgr]) managers[mgr] = { name: mgr, count: 0, oldestDays: 0 };
      managers[mgr].count++;
      if (age !== null && age > managers[mgr].oldestDays) managers[mgr].oldestDays = age;

      var rep = _str(get(row, 'repDetected'));
      if (rep && !/^(n|no|false|0)$/i.test(rep)) flags.replacements++;
      var ev = _str(get(row, 'fi_uwEvidence'));
      if (ev && !/^(n|no|false|0)$/i.test(ev)) flags.evidence++;
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
            premium: Math.round(week.premium), lastWeek: lastWeek.submitted },
    month: { submitted: month.submitted, premium: Math.round(month.premium) },
    leaders: toList(agents, 'count').slice(0, 8),
    queue: queue,
    managers: toList(managers, 'count').slice(0, 6),
    flags: flags,
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
