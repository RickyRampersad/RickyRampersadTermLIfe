/**
 * ============================================================================
 * THE RENEWALS API — what rickyrampersadbranch.com/renewals talks to
 * ============================================================================
 * Paste into the SAME Apps Script project as Code.gs, Property.gs,
 * SalesforceSync.gs and RenewalBoard.gs.
 *
 * The board used to be an HtmlService page served from the /exec URL, which
 * meant the link itself carried the shared staff key and the address was
 * forty characters of Google. It is now a page on the branch's own site, the
 * way /app, /logbook and /orphanmanagement already are, and this file is the
 * JSON it asks.
 *
 * THREE THINGS THAT CHANGE BECAUSE THE PAGE IS PUBLIC
 *
 * 1. No shared key. A page on the open web can carry no secret, so signing in
 *    is the person's own e-mail and their own access code from the Staff tab.
 *    Two people cannot share one credential, which the link always allowed.
 *
 * 2. A BLANK ACCESS CODE IS REFUSED. requireStaff_ in Code.gs treats a blank
 *    code as "no code required", which is tolerable behind a secret link and
 *    is an open door on a public address. Here a person with no code cannot
 *    sign in at all, and is told to ask for one.
 *
 * 3. Ten wrong tries closes an e-mail for fifteen minutes, because a public
 *    address can be guessed at all night.
 *
 * WHERE THE RENEWALS COME FROM
 *
 * Salesforce, live, grouped BY POLICY. The sheet-backed board was one row per
 * risk line, so a fleet client appeared sixty-one times in November — one
 * client, one conversation, sixty-one rows. What the branch has DONE about a
 * renewal still comes from the sheet (the token, who it is assigned to,
 * whether it is renewed), because Salesforce does not carry those.
 */

var RN = {
  /** How far ahead the board looks, and how far back it still shows. */
  AHEAD_DAYS: 120,
  BEHIND_DAYS: 90,
  /** A renewal this near is "now"; nearer than nothing is past. */
  SOON_DAYS: 14,
  /** The board never hands over more than this at once. */
  FIRST: 80,
  /** Fresh for this long; a last-good answer is kept six hours behind it. */
  CACHE_MIN: 10,
  LASTGOOD_HOURS: 6,
  /** Wrong tries before an e-mail is closed, and for how long. */
  TRIES: 10,
  LOCK_MIN: 15,
  /** Bumped when the page and this file must agree on something new. */
  VERSION: 1,
};

/* ========================== the route ========================== */

/**
 * Every rn.* action, answered as JSON.
 *
 * Called from doGet and doPost in Code.gs. The page POSTs text/plain, which
 * is what stops the browser asking Apps Script for a CORS preflight it cannot
 * answer — the same reason every other front end on this branch does it.
 */
function rnApi_(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents) || {};
  } catch (err) { /* a malformed body is simply an empty one */ }
  var p = (e && e.parameter) || {};
  var action = String(body.action || p.action || '');
  var out;
  try {
    out = rnRun_(action, body, p);
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function rnRun_(action, body, p) {
  switch (action) {
    case 'rn.ping':
      return { ok: true, version: RN.VERSION, salesforce: rnSfReady_(),
               test: (typeof testMode_ === 'function') ? !!testMode_() : false };
    case 'rn.in':
    case 'rn.board': {
      var who = rnWho_(body.email || p.email, body.code || p.code);
      if (action === 'rn.in' && typeof logActivity_ === 'function')
        logActivity_('', who.name, 'login', who.email, 'Opened /renewals (' + who.role + ')');
      return rnBoard_(who, String(body.fresh || p.fresh || '') === '1');
    }
    case 'rn.act':
      return rnAct_(rnWho_(body.email || p.email, body.code || p.code), body);
    default:
      throw new Error('Unknown action.');
  }
}

/* ========================== who is asking ========================== */

function rnNorm_(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

/**
 * Signs a person in on their e-mail and their own access code.
 *
 * Deliberately NOT requireStaff_: that takes the shared link key and lets a
 * blank code through. On an address anybody can type, both are wrong.
 */
function rnWho_(email, code) {
  email = rnNorm_(email);
  code = (typeof normPin_ === 'function') ? normPin_(code) : String(code || '').trim();
  if (!email || email.indexOf('@') < 1) throw new Error('Your work e-mail, please.');

  var cache = CacheService.getScriptCache();
  var lockKey = 'rn-lock-' + Utilities.base64EncodeWebSafe(email).slice(0, 40);
  var tries = Number(cache.get(lockKey) || 0);
  if (tries >= RN.TRIES)
    throw new Error('Too many tries. This e-mail is closed for ' + RN.LOCK_MIN +
      ' minutes — ask the branch for your code.');

  var found = (typeof staffList_ === 'function' ? staffList_() : [])
    .filter(function (s) { return s.email === email; })[0];

  // One message for "not on the tab" and "wrong code", so the page can never
  // be used to find out who works here.
  function refuse() {
    cache.put(lockKey, String(tries + 1), RN.LOCK_MIN * 60);
    throw new Error('That e-mail and code do not match. ' +
      (RN.TRIES - tries - 1 > 0 ? (RN.TRIES - tries - 1) + ' tries left.' : 'No tries left.'));
  }
  if (!found) refuse();

  // The one place this is stricter than the old board, and the reason is in
  // the header: a blank code is an open door on a public address.
  if (!found.pin) throw new Error('You have no access code yet, so this page cannot let you in. ' +
    'Ask the branch to run "Who can sign in → Issue somebody a new access code".');
  if (found.pin !== code) refuse();

  cache.remove(lockKey);
  var role = String(found.role || 'staff').toLowerCase();
  var branch = /admin|manager/.test(role);
  var agent = /agent/.test(role) && !branch;
  return { email: found.email, name: found.name, role: role,
           branch: branch, agent: agent, staff: !agent };
}

/* ========================== Salesforce ========================== */

function rnSfReady_() {
  try {
    var p = PropertiesService.getScriptProperties();
    return !!(p.getProperty('SF_KEY') && p.getProperty('SF_SECRET'));
  } catch (err) { return false; }
}

function rnDate_(v) {
  if (!v) return null;
  var d = new Date(String(v).length <= 10 ? String(v) + 'T00:00:00' : v);
  return isNaN(d.getTime()) ? null : d;
}
function rnDay_(d) { var x = new Date(d.getTime()); x.setHours(0, 0, 0, 0); return x; }
function rnPlus_(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function rnIso_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function rnNice_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'd MMM yyyy'); }

/**
 * A policy number, compared the way the org actually stores it.
 *
 * "TT FCP 0100001" and "TTFCP0100001" are one policy, and on the live book
 * "TT APG 1443286" and "TTAPG 1443286" are two spellings of one thing that
 * read as two policies until this.
 */
function rnKey_(policy) {
  return String(policy || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * When a risk line falls due.
 *
 * Next_Renewal_Date__c is what the org fills and what puts a line in its
 * month; To__c is blank on most lines of a multi-item policy, so it is only
 * the fallback.
 */
function rnDue_(r) {
  var n = rnDate_(r.Next_Renewal_Date__c);
  if (n) return rnDay_(n);
  var to = rnDate_(r.To__c);
  if (to) return rnDay_(rnPlus_(to, 1));
  return null;
}

/**
 * What a policy's renewal premium really is.
 *
 * Total_Premiums_Gov_t_Inclusive__c is per-LINE on some policies and
 * per-POLICY on others, and the board summed it either way. Measured against
 * the live November book on 26 October 2026: that read TT$847,324 where the
 * true figure is about TT$556,000, because one policy's four wheel loaders
 * each carried the whole policy's TT$93,851.77.
 *
 * The rule, which is the only one the data supports: when every line of a
 * policy carries the SAME figure it is the policy's, so count it once; when
 * they differ it is each line's, so add them up. Premium_Due__c is the
 * fallback, and it is nil on a good many lines, so it is never the first
 * choice.
 */
function rnPremium_(lines) {
  var vals = lines.map(function (r) { return Number(r.Total_Premiums_Gov_t_Inclusive__c) || 0; })
    .filter(function (n) { return n > 0; });
  if (vals.length) {
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) return { premium: max, how: 'once' };
    return { premium: vals.reduce(function (a, b) { return a + b; }, 0), how: 'summed' };
  }
  var due = lines.reduce(function (a, r) { return a + (Number(r.Premium_Due__c) || 0); }, 0);
  return { premium: due, how: due ? 'due' : 'none' };
}

/** The sum insured on a line, rollup first — see sfSumInsured_ for why. */
function rnCover_(r) {
  var tries = [r.Total_Value__c, r.Total_Property_Cover__c, r.Cover1__c];
  for (var i = 0; i < tries.length; i++) { var n = Number(tries[i]); if (n > 0) return n; }
  return 0;
}

/**
 * A policy's sum insured, under the same rule as its premium and for the same
 * reason: on the four-loader policy every line carries the identical
 * 6,743,659.68, and adding them up claimed TT$26,974,639 of cover on a
 * policy that very likely insures 6.7m in all. Identical across every line
 * means it is the policy's figure, so count it once; different per line means
 * each line has its own, so add them.
 */
function rnCoverOf_(lines) {
  var vals = lines.map(rnCover_).filter(function (n) { return n > 0; });
  if (!vals.length) return 0;
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  if (min === max) return max;
  return vals.reduce(function (a, b) { return a + b; }, 0);
}

/** What a line is, and what a whole policy is when its lines disagree. */
function rnLine_(r) {
  if (typeof lineOf_ === 'function') return lineOf_(r.Motor_Vehicle_Coverage_Type__c, r.Policy__c);
  var c = String(r.Motor_Vehicle_Coverage_Type__c || '').toLowerCase();
  if (/comprehensive/.test(c)) return 'comprehensive';
  if (/third\s*party/.test(c)) return 'third-party';
  return 'property';
}

/** How a risk names itself to a person: a registration, a chassis, a serial. */
function rnItem_(r) {
  return String(r.Vehicle__c || r.Chassis__c || r.Serial_1__c || r.Engine__c || '').trim();
}

/**
 * Every renewal in the window, live from Salesforce, one entry per POLICY.
 *
 * Grouping is the whole point. One fleet policy was sixty-one rows on the old
 * board and is one card here, with its vehicles inside it — which is also how
 * the conversation with that client actually happens.
 */
function rnLive_() {
  if (!rnSfReady_())
    throw new Error('Salesforce is not connected in this project. An admin sets SF_KEY and ' +
      'SF_SECRET in Script Properties (Salesforce → Set up connection).');

  var today = rnDay_(new Date());
  var from = rnIso_(rnPlus_(today, -RN.BEHIND_DAYS));
  var to = rnIso_(rnPlus_(today, RN.AHEAD_DAYS));

  var rows = sfQuery_(
    'SELECT Id, Policy__c, Account__c, Contact__c, Email__c, Carrier__c, ' +
    'Risk_Location__c, Occupancy__c, Motor_Vehicle_Coverage_Type__c, ' +
    'Vehicle__c, Chassis__c, Engine__c, Serial_1__c, Make_Model_Category_1__c, ' +
    'Cover1__c, Total_Value__c, Total_Property_Cover__c, ' +
    'Total_Premiums_Gov_t_Inclusive__c, Premium_Due__c, ' +
    'From__c, To__c, Renewal_Date__c, Next_Renewal_Date__c, ' +
    'Agent__c, Agent_Email__c, Risk_Classification__c ' +
    'FROM Risk_Details__c ' +
    'WHERE Next_Renewal_Date__c >= ' + from + ' AND Next_Renewal_Date__c <= ' + to + ' ' +
    'ORDER BY Next_Renewal_Date__c ASC');

  // group by policy, then by the day it falls due: one policy can carry two
  // renewal dates a day apart, and those are two conversations.
  var by = {}, order = [];
  rows.forEach(function (r) {
    var due = rnDue_(r);
    if (!due) return;
    var key = rnKey_(r.Policy__c) + '|' + rnIso_(due);
    if (!by[key]) { by[key] = []; order.push(key); }
    by[key].push(r);
  });

  var out = [];
  order.forEach(function (key) {
    var lines = by[key], head = lines[0];
    var due = rnDue_(head);
    var prem = rnPremium_(lines);

    // the policy's line is whichever its lines mostly are, by count
    var tally = {};
    lines.forEach(function (r) { var l = rnLine_(r); tally[l] = (tally[l] || 0) + 1; });
    var line = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0];

    var items = lines.map(rnItem_).filter(Boolean);
    var cover = rnCoverOf_(lines);
    var agent = '', agentEmail = '';
    lines.some(function (r) {
      if (r.Agent__c || r.Agent_Email__c) {
        agent = (typeof sfAgentName_ === 'function') ? sfAgentName_(r.Agent__c) : String(r.Agent__c || '');
        agentEmail = rnNorm_(r.Agent_Email__c);
        return true;
      }
      return false;
    });
    var email = '';
    lines.some(function (r) { if (r.Email__c) { email = String(r.Email__c).trim(); return true; } return false; });

    out.push({
      key: key,
      policy: String(head.Policy__c || '').trim(),
      pkey: rnKey_(head.Policy__c),
      client: String(head.Account__c || head.Contact__c || '').trim(),
      contact: String(head.Contact__c || '').trim(),
      email: email,
      carrier: String(head.Carrier__c || '').trim(),
      line: line,
      risks: lines.length,
      items: items.slice(0, 40),
      location: String(head.Risk_Location__c || '').trim(),
      due: rnIso_(due),
      dueNice: rnNice_(due),
      days: Math.round((due - rnDay_(new Date())) / 86400000),
      premium: Math.round(prem.premium),
      premiumHow: prem.how,
      cover: Math.round(cover),
      agent: agent,
      agentEmail: agentEmail,
      fresh: /new/i.test(String(head.Risk_Classification__c || '')),
    });
  });
  return out;
}

/* ===================== what the branch has done ===================== */

/**
 * The sheet's side of a renewal, keyed by policy: the token that a client's
 * own page hangs on, who it is with, and whether it is already renewed.
 * Salesforce carries none of that.
 */
function rnSheet_() {
  var by = {};
  function take(r, kind) {
    var k = rnKey_(r.policy);
    if (!k) return;
    var cur = by[k];
    var renewed = /renew/i.test(String(r.renewalStatus || r.status || '')) || !!r.renewedDate;
    var o = {
      kind: kind, token: r.token || '', rowIndex: r.rowIndex,
      assignedTo: r.assignedTo || '', renewed: renewed,
      balance: Number(r.balance) || 0, mobile: r.mobile || '', email: r.email || '',
    };
    // A policy on both sheets, or twice on one, keeps whichever says more.
    if (!cur || (!cur.token && o.token) || (!cur.renewed && o.renewed)) by[k] = o;
  }
  try { (typeof allRenewals_ === 'function' ? allRenewals_() : []).forEach(function (r) { take(r, 'motor'); }); }
  catch (err) { /* the tab may not exist yet */ }
  try { (typeof allProperties_ === 'function' ? allProperties_() : []).forEach(function (r) { take(r, 'property'); }); }
  catch (err) { /* same */ }
  return by;
}

/** When each client was last sent their renewal template. */
function rnInvites_() {
  return (typeof rbInvites_ === 'function') ? rbInvites_() : {};
}

/* ========================== the board ========================== */

/** Is this renewal this person's to see? Same rule as the old board. */
function rnMine_(r, who) {
  if (!who.agent) return true;
  if (r.agentEmail) return r.agentEmail === who.email;
  return !!r.agent && (typeof rbSameName_ === 'function') && rbSameName_(r.agent, who.name);
}

/** What this renewal still needs, in the words of whoever is reading it. */
function rnAsk_(r, who) {
  var soon = r.days <= RN.SOON_DAYS;
  if (r.renewed && r.balance > 0)
    return { key: 'owed', tone: 'late', urgent: true,
      staff: 'Renewed, premium still owed', agent: 'Renewed. Premium still to settle.' };
  if (r.renewed)
    return { key: 'done', tone: 'ok', urgent: false,
      staff: 'Renewed and settled', agent: 'Renewed — nothing outstanding' };
  if (r.days < 0)
    return { key: 'past', tone: 'late', urgent: true,
      staff: 'Past its renewal date and not renewed',
      agent: 'Cover has lapsed or is about to — call today' };
  if (r.line === 'comprehensive')
    return { key: 'value', tone: soon ? 'soon' : 'ok', urgent: soon,
      staff: r.risks > 1 ? 'Needs values confirmed on ' + r.risks + ' vehicles'
                         : 'Needs the vehicle value confirmed',
      agent: 'Confirm what it is worth now — it has fallen since last year' };
  if (r.line === 'property')
    return { key: 'sums', tone: soon ? 'soon' : 'ok', urgent: soon,
      staff: 'Needs the sums insured checked against rebuilding cost',
      agent: 'Check the sums insured — under-insured means every claim is cut' };
  return { key: 'confirm', tone: soon ? 'soon' : 'ok', urgent: soon,
    staff: r.risks > 1 ? 'Straightforward — confirm ' + r.risks + ' risks and collect'
                       : 'Straightforward — confirm and collect',
    agent: 'Nothing changes. Confirm and take the premium.' };
}

function rnWeight_(r) {
  var w = 0;
  if (r.ask.urgent) w += 100;
  if (r.ask.key === 'past') w += 80;
  if (r.ask.key === 'owed') w += 60;
  if (r.ask.key === 'done') w -= 200;
  w += Math.max(0, 60 - Math.abs(r.days));
  w += Math.min(40, r.premium / 1000);
  return Math.round(w);
}

/**
 * The board, cached.
 *
 * A Salesforce read of the whole window takes seconds and several screens
 * poll at once, so the answer is kept for RN.CACHE_MIN and a last-good copy
 * is kept behind it for hours. A screen must never be left with nothing
 * because Salesforce was slow — the wall learned that twice.
 */
function rnBoard_(who, fresh) {
  var cache = CacheService.getScriptCache();
  var all = null, stale = false, readAt = '';

  if (!fresh) {
    var hit = rnCacheGet_(cache, 'rn-live');
    if (hit) { all = hit.rows; readAt = hit.at; }
  }
  if (!all) {
    try {
      all = rnLive_();
      readAt = rnNice_(new Date()) + ' ' +
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
      rnCachePut_(cache, 'rn-live', { rows: all, at: readAt });
    } catch (err) {
      var last = rnCacheGet_(cache, 'rn-last');
      if (!last) throw err;
      all = last.rows; readAt = last.at; stale = true;
    }
  }

  var sheet = rnSheet_(), sent = rnInvites_();
  var today = rnDay_(new Date());

  var rows = all.map(function (r) {
    var s = sheet[r.pkey] || {};
    var o = {};
    for (var k in r) o[k] = r[k];
    o.token = s.token || '';
    o.rowIndex = s.rowIndex || 0;
    o.kind = s.kind || (r.line === 'property' ? 'property' : 'motor');
    o.assignedTo = s.assignedTo || '';
    o.renewed = !!s.renewed;
    o.balance = s.balance || 0;
    o.mobile = s.mobile || '';
    if (!o.email) o.email = s.email || '';
    var inv = o.token ? sent[o.token] : null;
    if (inv) { var d = rnDay_(inv.when); o.invited = Math.round((today - d) / 86400000); }
    else o.invited = null;
    o.invitable = !!o.email && !!o.token;
    return o;
  }).filter(function (r) { return rnMine_(r, who); });

  rows.forEach(function (r) { r.ask = rnAsk_(r, who); r.w = rnWeight_(r); });
  rows.sort(function (a, b) { return b.w - a.w; });

  var open = rows.filter(function (r) { return r.ask.key !== 'done'; });
  var owed = rows.filter(function (r) { return r.ask.key === 'owed'; });
  var counts = {
    all: rows.length,
    policies: rows.length,
    risks: rows.reduce(function (a, r) { return a + r.risks; }, 0),
    act: rows.filter(function (r) { return r.ask.urgent; }).length,
    past: rows.filter(function (r) { return r.ask.key === 'past'; }).length,
    owed: owed.length,
    owedTotal: owed.reduce(function (a, r) { return a + r.balance; }, 0),
    done: rows.filter(function (r) { return r.ask.key === 'done'; }).length,
    comprehensive: rows.filter(function (r) { return r.line === 'comprehensive'; }).length,
    thirdParty: rows.filter(function (r) { return r.line === 'third-party'; }).length,
    property: rows.filter(function (r) { return r.line === 'property'; }).length,
    toInvite: open.filter(function (r) { return r.invited === null && r.invitable; }).length,
    noEmail: open.filter(function (r) { return !r.email; }).length,
    premium: open.reduce(function (a, r) { return a + r.premium; }, 0),
    soon: open.filter(function (r) { return r.days >= 0 && r.days <= RN.SOON_DAYS; }).length,
  };

  // The ladder: the next weeks, each with what falls due in it. This is the
  // one picture of the book — the shape of the work, not a list of it.
  var weeks = [], wk = {};
  open.forEach(function (r) {
    if (r.days < 0 || r.days > RN.AHEAD_DAYS) return;
    var w = Math.floor(r.days / 7);
    if (!wk[w]) wk[w] = { w: w, n: 0, premium: 0, act: 0,
      from: rnNice_(rnPlus_(today, w * 7)), comprehensive: 0, 'third-party': 0, property: 0 };
    wk[w].n++; wk[w].premium += r.premium;
    if (r.ask.urgent) wk[w].act++;
    wk[w][r.line]++;
  });
  for (var i = 0; i <= Math.floor(RN.AHEAD_DAYS / 7); i++) {
    weeks.push(wk[i] || { w: i, n: 0, premium: 0, act: 0,
      from: rnNice_(rnPlus_(today, i * 7)), comprehensive: 0, 'third-party': 0, property: 0 });
  }

  var byAgent = [];
  if (!who.agent) {
    var m = {};
    rows.forEach(function (r) {
      var k = r.agent || '(nobody named)';
      if (!m[k]) m[k] = { agent: k, n: 0, act: 0, premium: 0 };
      m[k].n++; if (r.ask.urgent) m[k].act++; m[k].premium += r.premium;
    });
    byAgent = Object.keys(m).map(function (k) { return m[k]; })
      .sort(function (a, b) { return b.act - a.act || b.premium - a.premium; });
  }

  return {
    ok: true, version: RN.VERSION,
    who: { name: who.name, email: who.email, role: who.role,
           agent: who.agent, branch: who.branch },
    test: (typeof testMode_ === 'function') ? !!testMode_() : false,
    readAt: readAt, stale: stale, ahead: RN.AHEAD_DAYS,
    counts: counts, weeks: weeks, byAgent: byAgent,
    rows: rows.slice(0, RN.FIRST),
    more: Math.max(0, rows.length - RN.FIRST),
  };
}

/* ---- the cache, which has a 100 KB ceiling per value ---- */

function rnCachePut_(cache, name, obj) {
  try {
    var s = JSON.stringify(obj);
    // Gzip first: the orphan wall outgrew the 100 KB ceiling, the put threw,
    // the throw was swallowed, and every screen then read the sheet on every
    // refresh. Compressed, a full book is a few tens of KB.
    var z = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(s)).getBytes());
    if (z.length > 95000) return;          // too big even gzipped: serve live
    cache.put(name, z, RN.CACHE_MIN * 60);
    cache.put('rn-last', z, RN.LASTGOOD_HOURS * 3600);
  } catch (err) { /* a cache that will not take it is not a failure */ }
}
function rnCacheGet_(cache, name) {
  try {
    var z = cache.get(name);
    if (!z) return null;
    var blob = Utilities.newBlob(Utilities.base64Decode(z), 'application/x-gzip');
    return JSON.parse(Utilities.ungzip(blob).getDataAsString());
  } catch (err) { return null; }
}

/* ========================== the actions ========================== */

/**
 * Everything a person can do from the page, scope-checked on the server. A
 * page that hides a button is a courtesy; this is the rule.
 */
function rnAct_(who, body) {
  var what = String(body.what || '');
  var token = String(body.token || '').trim();
  var rowIndex = Number(body.rowIndex) || 0;
  if (!token) throw new Error('That renewal is not on the sheet yet, so there is nothing to write to. ' +
    'Run the Salesforce sync so it has a row of its own.');

  // Find it on the board this person is allowed to see, so an agent cannot
  // act on a client who is not theirs by sending a token.
  var board = rnBoard_(who, false);
  var row = board.rows.filter(function (r) {
    return r.token === token && (!rowIndex || r.rowIndex === rowIndex);
  })[0];
  if (!row) throw new Error('That renewal is not on your board.');

  switch (what) {
    case 'note': {
      var note = String(body.note || '').trim();
      if (note.length < 10)
        throw new Error('Write a line on what happened — a note of under ten characters tells the next person nothing.');
      logActivity_(token, row.client, 'note', who.name, note);
      return { ok: true, said: 'Noted on ' + row.client + '.' };
    }
    case 'invite': {
      if (!who.staff) throw new Error('Only the branch and staff send renewal templates.');
      if (!row.email) throw new Error(row.client + ' has no e-mail on file — this one is a call.');
      // The page hides the button on these; this is the rule behind it. A
      // template asks a client to renew, and one already renewed has done it.
      if (row.renewed) throw new Error(row.client + ' has already renewed' +
        (row.balance > 0 ? ' — the outstanding premium is a payment chase, not a renewal template.' : '.'));
      if (row.kind === 'property') {
        if (typeof sendPropertyInviteByToken_ !== 'function')
          throw new Error('Property.gs is not installed, so the property template cannot be sent.');
        sendPropertyInviteByToken_(token, who.name);
      } else {
        var motor = (typeof rowsForToken_ === 'function' ? rowsForToken_(token) : [])
          .filter(function (x) { return !row.rowIndex || x.rowIndex === row.rowIndex; })[0];
        if (!motor) throw new Error('That renewal has moved on the sheet — refresh and try again.');
        sendStageEmail_(motor, 'manual');
      }
      logActivity_(token, row.client, 'invite', who.name,
        'Renewal template sent (' + row.line + ') to ' + row.email);
      var test = (typeof testMode_ === 'function') && testMode_();
      return { ok: true, said: test
        ? 'Test mode — ' + row.client + '’s template went to the test inbox, not to them.'
        : 'Sent to ' + row.client + ' at ' + row.email + '.' };
    }
    default:
      throw new Error('Unknown action.');
  }
}

/* ========================== the menu ========================== */

function renewalsMenu_(ui) {
  return ui.createMenu('🌐 /renewals')
    .addItem('Show the address to share', 'rnShowLink')
    .addItem('Check the page will work', 'rnCheck');
}

function rnShowLink() {
  SpreadsheetApp.getUi().alert('The renewals board',
    'https://rickyrampersadbranch.com/renewals\n\n' +
    'Everybody opens the same address. There is no key in it: each person ' +
    'signs in with their own work e-mail and their own access code from the ' +
    'Staff tab, and what they see is decided by their Role.\n\n' +
    'Somebody with no access code cannot sign in here at all — issue them one ' +
    'from "Who can sign in".', SpreadsheetApp.getUi().ButtonSet.OK);
}

function rnCheck() {
  var ui = SpreadsheetApp.getUi();
  var out = [];
  out.push((rnSfReady_() ? '✅' : '❌') + '  Salesforce ' +
    (rnSfReady_() ? 'is connected' : 'is NOT connected — the page has nothing to read'));

  var n = 0, err = '';
  try { n = rnLive_().length; } catch (e) { err = String(e.message || e); }
  out.push((n ? '✅' : '❌') + '  ' + (err ? err : n + ' policies renewing between ' +
    RN.BEHIND_DAYS + ' days back and ' + RN.AHEAD_DAYS + ' days ahead'));

  var people = (typeof staffList_ === 'function') ? staffList_() : [];
  var withCode = people.filter(function (p) { return !!p.pin; });
  out.push((withCode.length ? '✅' : '❌') + '  ' + withCode.length + ' of ' + people.length +
    ' on the Staff tab can sign in' +
    (withCode.length < people.length ? ' — the rest have no access code' : ''));
  people.forEach(function (p) {
    out.push('   ' + (p.pin ? '✅' : '⚠️') + ' ' + p.name + ' · ' + p.role +
      (p.pin ? '' : ' — no code, cannot sign in here'));
  });

  /**
   * What each agent would actually find.
   *
   * Salesforce carries the agent's e-mail on the risk, and the Staff tab
   * carries the one they sign in with. When those differ for the same person
   * their board is empty and NOTHING ON SCREEN SAYS WHY — the rule that
   * another agent's e-mail beats a matching name is right and must not be
   * loosened, so the mismatch is reported here instead.
   */
  var agents = people.filter(function (p) { return /agent/i.test(p.role); });
  if (agents.length) {
    out.push('', 'What each agent would find:');
    agents.forEach(function (p) {
      var n = 0, why = '';
      try {
        n = rnBoard_({ email: p.email, name: p.name, role: p.role,
                       agent: true, staff: false, branch: false }, false).rows.length;
      } catch (e) { why = ' (' + e.message + ')'; }
      out.push('   ' + (n ? '✅' : '⚠️') + ' ' + p.name + ' — ' + n + ' polic' +
        (n === 1 ? 'y' : 'ies') + why +
        (n ? '' : '. Check the e-mail on their Staff row is the one Salesforce ' +
          'has on their risks: if the two differ they see nothing and are told nothing.'));
    });
  }

  var sheet = rnSheet_();
  out.push('', Object.keys(sheet).length + ' policies have a row on the sheet (that is what ' +
    'carries the client’s own page and who it is with)');

  ui.alert('Will /renewals work?', out.join('\n'), ui.ButtonSet.OK);
}
