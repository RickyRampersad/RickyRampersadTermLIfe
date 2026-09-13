/**
 * RenewalsSF.gs — the renewal reminder ladder, reading Salesforce.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * dailyAutomation() in Code.gs reads the renewals tab of this sheet. That
 * tab holds 122 rows and was last touched in August; Salesforce holds the
 * live book. The gap that matters: 109 renewals fall due in November and
 * the sheet cannot see one of them.
 *
 * This file reads Risk_Details__c instead, runs the same six-stage ladder,
 * and sends through the same sendMail_() gate — so test mode still reroutes
 * everything to you and nothing can reach a client until you turn it off.
 *
 * THE DATE FIELD, WHICH IS EASY TO GET WRONG
 * ------------------------------------------
 *   Renewal_Date__c       the cycle ALREADY WRITTEN  (last year's)
 *   Next_Renewal_Date__c  the one COMING UP          ← this file uses this
 *
 * Reading the first one is why an earlier cut of the wall reported one
 * renewal for October when the real answer was nineteen.
 *
 * HOW "ALREADY SENT" IS REMEMBERED
 * --------------------------------
 * Not in a hidden cell. Each send writes a completed Salesforce Task
 * against the risk, exactly like the ones Pawan and Sasha raise by hand.
 * The ladder reads those Tasks back to decide what is still owed. So the
 * record of a reminder lives where the branch already looks, it survives a
 * sheet being rebuilt, and the task counts on the wall become real.
 *
 * START HERE
 * ----------
 *   rsfPreview()   dry run. Sends NOTHING. Logs exactly who would get
 *                  what, and who is skipped and why. Run this first.
 *   rsfInstall()   moves the 8am trigger onto this version.
 *   rsfDailyAutomation()   the live run (still obeys test mode).
 */

var RSF = {
  API: 'v64.0',
  LOOKAHEAD: 45,          // days forward to pull
  LOOKBACK: 90,           // days back, for the overdue stages
  TASK_TAG: 'Auto-reminder',   // how a stamped Task is recognised
  MAX_PER_RUN: 200,       // belt and braces against a runaway loop
};

/* ============================ salesforce ============================ */

function rsfProps_() { return PropertiesService.getScriptProperties(); }

/**
 * Access token.
 *
 * Two things here are deliberate and were learned the hard way:
 *
 *  1. The refresh_token grant is tried FIRST. This org refuses the
 *     username-password flow — it answers invalid_grant — so the password
 *     path is only a fallback for a differently configured org.
 *
 *  2. The result is cached under RSF_ACCESS, never under SF_TOKEN.
 *     SF_TOKEN in this project holds the Salesforce SECURITY TOKEN. Writing
 *     an access token over it breaks every other script that logs in.
 *     WallBoard.gs currently does exactly that, which is one of two reasons
 *     the live feed has never worked.
 */
function rsfToken_() {
  var p = rsfProps_();
  var cached = p.getProperty('RSF_ACCESS'), when = Number(p.getProperty('RSF_ACCESS_AT') || 0);
  if (cached && (new Date().getTime() - when) < 50 * 60 * 1000) return JSON.parse(cached);

  /* Property names drift. This project stores the consumer key as SFKEY with
     no underscore, while other scripts in the same family write SF_KEY — an
     exact-match lookup reports "credentials are missing" when they are
     sitting right there. Match on letters and digits alone, so SFKEY, SF_KEY,
     sf-key and Sf_Key all resolve to the same thing. TokenMigration.gs solves
     this the same way, for the same reason. */
  var norm = function (s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  var all = {};
  p.getKeys().forEach(function (k) {
    var v = p.getProperty(k);
    if (v && String(v).trim()) all[norm(k)] = String(v).trim();
  });
  var pick = function (names) {
    for (var i = 0; i < names.length; i++) {
      var v = all[norm(names[i])];
      if (v) return v;
    }
    return '';
  };
  var id      = pick(['SF_CLIENT_ID', 'SF_KEY', 'SF_CONSUMER_KEY']);
  var secret  = pick(['SF_CLIENT_SECRET', 'SF_SECRET', 'SF_CONSUMER_SECRET']);
  var refresh = pick(['SF_REFRESH_TOKEN']);
  var login   = (pick(['SF_LOGIN_URL', 'SF_INSTANCE_URL']) || 'https://login.salesforce.com')
                  .replace(/\/+$/, '');

  if (!id || !secret)
    throw new Error('Salesforce client credentials are missing. Expected SF_CLIENT_ID (or SF_KEY) and ' +
                    'SF_CLIENT_SECRET (or SF_SECRET) in Script Properties.');

  var payload;
  if (refresh) {
    payload = { grant_type: 'refresh_token', client_id: id, client_secret: secret, refresh_token: refresh };
  } else {
    var user = pick(['SF_USERNAME', 'SF_USER']), pass = pick(['SF_PASSWORD', 'SF_PASS']);
    var sec  = pick(['SF_SECURITY_TOKEN', 'SF_TOKEN']);
    if (!user || !pass)
      throw new Error('No SF_REFRESH_TOKEN, and no username/password either. This org needs the refresh ' +
                      'token — re-run whatever authorised this project to mint one.');
    payload = { grant_type: 'password', client_id: id, client_secret: secret,
                username: user, password: pass + (sec || '') };
  }

  var res = UrlFetchApp.fetch(login + '/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true, payload: payload,
  });
  if (res.getResponseCode() !== 200) {
    var body = res.getContentText();
    var hint = /invalid_grant|expired access\/refresh token/.test(body)
      ? '\n\nThe stored SF_REFRESH_TOKEN looks expired or revoked. Mint a fresh one and store it again.'
      : '';
    throw new Error('Salesforce login failed: ' + body.slice(0, 300) + hint);
  }
  var tok = JSON.parse(res.getContentText());
  p.setProperty('RSF_ACCESS', JSON.stringify(tok));
  p.setProperty('RSF_ACCESS_AT', String(new Date().getTime()));
  return tok;
}

function rsfQ_(soql) {
  var tok = rsfToken_();
  var url = tok.instance_url + '/services/data/' + RSF.API + '/query?q=' + encodeURIComponent(soql);
  var out = [];
  while (url) {
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + tok.access_token }, muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 401) {              // token died mid-flight — one retry
      rsfProps_().deleteProperty('RSF_ACCESS');
      tok = rsfToken_();
      res = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + tok.access_token }, muteHttpExceptions: true });
    }
    if (res.getResponseCode() !== 200)
      throw new Error('SOQL failed (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 300));
    var j = JSON.parse(res.getContentText());
    out = out.concat(j.records || []);
    url = j.nextRecordsUrl ? tok.instance_url + j.nextRecordsUrl : null;
  }
  return out;
}

function rsfCreate_(sobject, fields) {
  var tok = rsfToken_();
  var res = UrlFetchApp.fetch(
    tok.instance_url + '/services/data/' + RSF.API + '/sobjects/' + sobject,
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok.access_token },
      payload: JSON.stringify(fields) });
  if (res.getResponseCode() >= 300)
    throw new Error('Create ' + sobject + ' failed: ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

/* ============================ reading the book ============================ */

function rsfIso_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function rsfShift_(days) {
  var d = new Date(); d.setDate(d.getDate() + days); return d;
}

/**
 * Renewals falling due in the window, normalised into the shape
 * sendStageEmail_() already expects.
 *
 * Sold vehicles are excluded.
 *
 * Send_Renewal_Reminder__c is handled adaptively, and this matters. It is a
 * Salesforce checkbox, so it reads false when nobody has ever ticked it —
 * there is no null to tell "declined" apart from "never set". Right now it
 * is false on every record in the org, so reading false as an opt-out would
 * skip the entire book and the run would report nothing to send, which looks
 * like the ladder working rather than the ladder blocked.
 *
 * So: if no row in the window has it true, the field is not in use and it is
 * ignored. The moment anyone starts ticking it, false becomes a real
 * decision and is honoured from then on, with no code change.
 */
function rsfRows_() {
  var soql =
    'SELECT Id, Name, Policy__c, Next_Renewal_Date__c, Motor_Vehicle_Coverage_Type__c, ' +
    'Property_Coverage_Type__c, Cover1__c, Premium_Due__c, Payments_Made__c, Total_Premiums__c, ' +
    'Email__c, Portal_Token__c, Account__c, Contact_First_Name__c, Last_Name__c, Salutation__c, ' +
    'Vehicle_Make__c, Model__c, Vehicle_Status__c, Send_Renewal_Reminder__c ' +
    'FROM Risk_Details__c ' +
    'WHERE Next_Renewal_Date__c >= ' + rsfIso_(rsfShift_(-RSF.LOOKBACK)) + ' ' +
    'AND Next_Renewal_Date__c <= ' + rsfIso_(rsfShift_(RSF.LOOKAHEAD)) + ' ' +
    "AND (Vehicle_Status__c = null OR Vehicle_Status__c != 'Sold') " +
    'ORDER BY Next_Renewal_Date__c';

  var today = new Date(); today.setHours(0, 0, 0, 0);

  var rows = rsfQ_(soql).map(function (r) {
    var due = r.Next_Renewal_Date__c ? new Date(r.Next_Renewal_Date__c + 'T00:00:00') : null;
    var days = due ? Math.round((due - today) / 86400000) : null;
    var cover = r.Motor_Vehicle_Coverage_Type__c || r.Property_Coverage_Type__c || 'policy';
    var who = [r.Salutation__c, r.Contact_First_Name__c, r.Last_Name__c]
                .filter(function (x) { return x; }).join(' ').trim();
    return {
      id: r.Id,
      client: r.Account__c || who || 'Valued client',
      contact: r.Contact_First_Name__c || who || '',
      email: String(r.Email__c || '').trim(),
      policy: r.Policy__c || '',
      coverage: cover,
      vehicle: [r.Vehicle_Make__c, r.Model__c].filter(function (x) { return x; }).join(' '),
      nextDue: due ? Utilities.formatDate(due, Session.getScriptTimeZone(), 'd MMM yyyy') : '',
      dueIso: r.Next_Renewal_Date__c || '',
      days: days,
      sumInsured: r.Cover1__c || 0,
      balance: r.Premium_Due__c || Math.max(0, (r.Total_Premiums__c || 0) - (r.Payments_Made__c || 0)),
      token: String(r.Portal_Token__c || '').trim(),
      flag: r.Send_Renewal_Reminder__c === true,
      optOut: false,           // set below, once we know if the flag is in use
    };
  });

  var flagInUse = rows.some(function (r) { return r.flag; });
  if (flagInUse) rows.forEach(function (r) { r.optOut = !r.flag; });
  return rows;
}

/**
 * The stage a row is owed today, or null.
 *
 * Two deliberate differences from the ladder in Code.gs:
 *
 *  1. od3 starts at -1, not -3. The old bounds left days -1 and -2 matching
 *     nothing at all: a policy that lapsed yesterday got no email, and by the
 *     time it reached -3 the client had been uninsured for three days. The
 *     preview caught a live client sitting in that hole.
 *
 *  2. od7 stops at -30. It used to be unbounded, so a policy 80 days lapsed
 *     still drew "one of our team will call you shortly". Past a month it is
 *     not a reminder, it is a lapse for someone to work by hand.
 */
function rsfStage_(days) {
  if (days === null) return null;
  if (days <= -7 && days > -30)    return 'od7';
  if (days <= -1 && days > -7)     return 'od3';
  if (days === 0)                  return '0d';
  if (days <= 7  && days > 0)      return '7d';
  if (days <= 14 && days > 7)      return '14d';
  if (days <= 30 && days > 14)     return '30d';
  return null;
}

/* ======================= what kind of policy is this? ======================= */

/**
 * Property_Coverage_Type__c is null on every record in the org — all 87 in the
 * current window. So the coverage-type fields cannot tell a house from a car,
 * and the only reliable classifier left is the policy prefix.
 *
 *   TT A**   motor      APU APG APC APF AOG ACF ...
 *   TT FHO   home       householders / homeowners
 *   TT FAR   property   fire all risks (business premises and contents)
 *   TT FCP   property   fire commercial property
 *   TT C**   liability  CEL CPL CLC
 *   anything else -> generic wording, no cross-sell
 *
 * This matters because every subject line in Code.gs says "motor policy". Left
 * alone, the Fire All Risks client gets "One week left — your motor policy
 * renews", a body reading "your policy policy", and a cross-sell for windscreen
 * cover and a No Claim Discount on a car we do not insure.
 */
function rsfClass_(policy) {
  var p = rsfPolKey_(policy);
  if (/^TTA/.test(p))            return 'motor';
  if (/^TTFHO/.test(p))          return 'home';
  if (/^TTF(AR|CP)/.test(p))     return 'property';
  if (/^TTC/.test(p))            return 'liability';
  return 'other';
}

/**
 * A policy number reduced to something two spellings of it agree on.
 *
 * The same policy is written "TTAPU0994275" on one risk and "TT APU 0994275"
 * on the next, so spacing has to go. And one live record carries a CYRILLIC
 * capital O (U+041E) inside "TT FHO 1431625" — it looks identical on screen,
 * it never matches a search, and without folding it here that risk would form
 * a group of its own and earn the client a second email.
 */
function rsfPolKey_(policy) {
  return String(policy || '')
    .replace(/О/g, 'O').replace(/А/g, 'A').replace(/С/g, 'C')
    .replace(/Е/g, 'E').replace(/Р/g, 'P').replace(/Т/g, 'T')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

/**
 * What has already gone out, read back off Salesforce Tasks.
 * Returns { riskId: { '30d': true, ... } }.
 *
 * Queried by subject tag and recency, NOT by a list of record ids. A
 * WHERE Id IN (...) clause holding 200 eighteen-character ids URL-encodes
 * to well over Apps Script's 2 kB UrlFetch ceiling and throws
 * "Limit Exceeded: URLFetch URL Length". This URL is a fixed short length
 * however large the book grows, it is one request instead of several, and
 * auto-reminder tasks are a small set by construction. The ids are used to
 * filter in memory afterwards.
 */
function rsfAlreadySent_(ids) {
  var sent = {};
  if (!ids.length) return sent;
  var want = {};
  ids.forEach(function (x) { want[x] = 1; });

  rsfQ_("SELECT WhatId, Subject FROM Task WHERE Subject LIKE '" + RSF.TASK_TAG + "%' " +
        'AND CreatedDate = LAST_N_DAYS:' + (RSF.LOOKBACK + RSF.LOOKAHEAD))
    .forEach(function (t) {
      if (!want[t.WhatId]) return;
      var m = /\[(\w+)\]/.exec(t.Subject || '');
      if (!m) return;
      (sent[t.WhatId] = sent[t.WhatId] || {})[m[1]] = true;
    });
  return sent;
}

/* The [stage] in the subject is what rsfAlreadySent_ reads back — keep it. */
function rsfStamp_(row, stage) {
  rsfCreate_('Task', {
    Subject: RSF.TASK_TAG + ' [' + stage + '] ' +
             (row.policy || row.vehicle || 'renewal') + ' — due ' + row.nextDue,
    WhatId: row.id,
    Status: 'Completed',
    Priority: 'Normal',
    ActivityDate: rsfIso_(new Date()),
    Description: 'Sent automatically to ' + row.email + ' by the renewal ladder.',
  });
}

/* ======================= one policy, one email ======================= */

/* Most urgent first. A group takes the most urgent stage any member is at. */
var RSF_URGENCY = { od7: 0, od3: 1, '0d': 2, '7d': 3, '14d': 4, '30d': 5 };

/**
 * Decide what today's run would do. Pure — touches nothing.
 *
 * WHY THIS GROUPS
 * ---------------
 * Risk_Details__c holds one row per insured thing, not per policy. Gurudutt
 * Maharaj has three vehicles on TT APU 0854814 and Advanced Investments has
 * four on TT APU 0994275. Sending per row put three identical "your renewal
 * date has passed" emails in one inbox inside the same second, and the first
 * measured run would have sent 22 emails to 15 people.
 *
 * So rows are grouped on client address plus policy number, the group takes
 * the most urgent stage any of its risks is at, and the email lists every
 * vehicle or premises on that policy. One policy, one email, one day.
 */
function rsfPlan_() {
  var rows = rsfRows_();
  var sent = rsfAlreadySent_(rows.map(function (r) { return r.id; }));
  var eligible = [], skip = [];

  // Stage is tested FIRST, and that ordering is the whole point of this list.
  // Tested last, a policy 80 days lapsed with no email address was reported as
  // "no email address on the risk" — so the window's 90 days of history piled
  // into the reachability counts and made the book look far worse than it is.
  // The first run read 37 missing tokens and 19 missing addresses; only 17 of
  // those were risks the ladder would otherwise have written to today.
  // Reachability is now only reported for a record that was actually owed an
  // email, which turns this from a statistic into a list someone can work.
  rows.forEach(function (r) {
    var stage = rsfStage_(r.days);
    var why =
      !stage   ? 'not at a reminder stage today (' + r.days + ' days out)' :
      r.optOut ? 'opted out (Send_Renewal_Reminder__c unticked, and the flag is in use)' :
      !r.email ? 'DUE TODAY but no email address on the risk' :
      !r.token ? 'DUE TODAY but no portal token — nothing to link them to' : '';
    if (why) skip.push({ row: r, why: why });
    else     eligible.push({ row: r, stage: stage });
  });

  var byKey = {}, order = [];
  eligible.forEach(function (e) {
    var key = e.row.email.toLowerCase() + '|' + rsfPolKey_(e.row.policy);
    if (!byKey[key]) { byKey[key] = { rows: [], stage: e.stage, key: key }; order.push(key); }
    var g = byKey[key];
    g.rows.push(e.row);
    if (RSF_URGENCY[e.stage] < RSF_URGENCY[g.stage]) g.stage = e.stage;
  });

  var send = [];
  order.forEach(function (k) {
    var g = byKey[k];
    g.lead = g.rows[0];
    g.cls = rsfClass_(g.lead.policy);
    // Already sent only if EVERY risk on the policy carries this stage. A risk
    // added to the policy mid-cycle has never been told, so the group still goes.
    var all = g.rows.every(function (r) { return sent[r.id] && sent[r.id][g.stage]; });
    if (all) g.rows.forEach(function (r) { skip.push({ row: r, why: g.stage + ' already sent' }); });
    else send.push(g);
  });

  return { send: send, skip: skip, total: rows.length, risks: eligible.length };
}

/* ======================= the email ======================= */

/**
 * Subject and opening line per class. Everything in Code.gs's STAGES says
 * "motor policy", which is right for the 58 motor risks in the window and
 * wrong for the other 29.
 */
var RSF_COPY = {
  motor: {
    noun: 'motor policy', nouns: 'motor policies',
    '30d': 'renews on {d}. Renewal takes two minutes in our secure portal — review your cover, tell us about any changes, and send your instruction.',
    '14d': 'renews on {d} — two weeks away. It takes two minutes online.',
    '7d':  'renews on {d}, one week away. Renewing before the date keeps your cover and your No Claim Discount seamless.',
    '0d':  'renews today. Send your instruction now and your protection continues without a break.',
    'od3': 'reached its renewal date on {d}. A gap in motor cover, even a short one, leaves you personally exposed and can affect your No Claim Discount. It takes two minutes to put right.',
    'od7': 'renewal of {d} is still open. This is our final email reminder. One of our team will call you shortly, or beat us to it and renew online now.',
  },
  home: {
    noun: 'home policy', nouns: 'home policies',
    '30d': 'renews on {d}. Renewal takes two minutes in our secure portal — check the sum insured still reflects what it would cost to rebuild today, and send your instruction.',
    '14d': 'renews on {d} — two weeks away. Two minutes online is all it takes.',
    '7d':  'renews on {d}, one week away. Renewing before the date keeps your home covered without a break.',
    '0d':  'renews today. Send your instruction now and your cover continues without a gap.',
    'od3': 'reached its renewal date on {d}. An uninsured home is an uninsured home from the first day, and fire does not wait. It takes two minutes to put right.',
    'od7': 'renewal of {d} is still open. This is our final email reminder. One of our team will call you shortly, or renew online now.',
  },
  property: {
    noun: 'property policy', nouns: 'property policies',
    '30d': 'renews on {d}. Renewal takes two minutes in our secure portal — check the sum insured against what rebuilding and restocking would cost today, and send your instruction.',
    '14d': 'renews on {d} — two weeks away. Two minutes online is all it takes.',
    '7d':  'renews on {d}, one week away. Renewing before the date keeps the premises covered without a break.',
    '0d':  'renews today. Send your instruction now and your cover continues without a gap.',
    'od3': 'reached its renewal date on {d}. Trading from uninsured premises puts the stock, the building and the income all on the same bet. It takes two minutes to put right.',
    'od7': 'renewal of {d} is still open. This is our final email reminder. One of our team will call you shortly, or renew online now.',
  },
  liability: {
    noun: 'liability policy', nouns: 'liability policies',
    '30d': 'renews on {d}. Renewal takes two minutes in our secure portal — check the limit still matches the size of the work you are taking on, and send your instruction.',
    '14d': 'renews on {d} — two weeks away. Two minutes online is all it takes.',
    '7d':  'renews on {d}, one week away. Renewing before the date keeps the cover continuous, which matters if a contract asks you to evidence it.',
    '0d':  'renews today. Send your instruction now and your cover continues without a gap.',
    'od3': 'reached its renewal date on {d}. A claim arising during a gap is yours to meet, and most contracts require unbroken cover. It takes two minutes to put right.',
    'od7': 'renewal of {d} is still open. This is our final email reminder. One of our team will call you shortly, or renew online now.',
  },
  other: {
    noun: 'policy', nouns: 'policies',
    '30d': 'renews on {d}. Review your cover and send your instruction in our secure portal.',
    '14d': 'renews on {d} — two weeks away.',
    '7d':  'renews on {d}, one week away.',
    '0d':  'renews today. Send your instruction now and your cover continues without a break.',
    'od3': 'reached its renewal date on {d}. It takes two minutes to put right.',
    'od7': 'renewal of {d} is still open. This is our final email reminder. One of our team will call you shortly.',
  },
};

var RSF_SUBJECT = {
  '30d': function (c, d) { return 'Your ' + c.noun + ' renews on ' + d + ' — review & renew online'; },
  '14d': function (c, d) { return 'Two weeks to go — renew your ' + c.noun + ' by ' + d; },
  '7d':  function (c, d) { return 'One week left — your ' + c.noun + ' renews ' + d; },
  '0d':  function (c)    { return 'Your ' + c.noun + ' renews TODAY — one click to stay covered'; },
  'od3': function (c)    { return 'Your ' + c.noun + ' renewal date has passed — let’s keep you covered'; },
  'od7': function (c)    { return 'Final reminder — your ' + c.noun + ' needs attention'; },
};

/** The things on the policy, as a list the client will recognise. */
function rsfSchedule_(g) {
  if (g.rows.length < 2 && !g.rows[0].vehicle) return '';
  var items = g.rows.map(function (r) {
    var what = r.vehicle || r.coverage || 'Item';
    var cov = r.vehicle && r.coverage && r.coverage !== 'policy' ? ' — ' + esc_(r.coverage) : '';
    return '<li style="margin:3px 0">' + esc_(what) + cov +
           (Number(r.sumInsured) > 0 ? ' <span style="color:#8a97a8">· insured ' +
            fmtMoney_(r.sumInsured) + '</span>' : '') + '</li>';
  }).join('');
  return '<p style="margin-bottom:4px"><b>On this policy' +
         (g.rows.length > 1 ? ' (' + g.rows.length + ')' : '') + ':</b></p>' +
         '<ul style="margin-top:0;padding-left:20px">' + items + '</ul>';
}

/** Education and cross-sell, chosen by class. */
function rsfEdu_(g) {
  var anyComp = g.rows.some(function (r) { return /comprehensive/i.test(r.coverage); });
  var anyTPO  = g.rows.some(function (r) { return /third party/i.test(r.coverage); });
  var si = g.rows.reduce(function (a, r) { return a + (Number(r.sumInsured) || 0); }, 0);

  if (g.cls === 'motor') {
    var out = '';
    if (anyComp) out +=
      eduBox_('<b style="color:#9a6d0b">💡 Vehicles depreciate.</b> Your cover is written for ' +
        (si ? '<b>' + fmtMoney_(si) + '</b>' : 'its declared value') +
        '. A comprehensive claim settles at the market value or the sum insured, <b>whichever is lower</b> — so a figure left too high costs you premium without buying you anything. Update it in the portal.') +
      eduBox_('<b style="color:#9a6d0b">⚠️ Change from Guardian General:</b> the <b>Waiver of Excess</b> is no longer included free after three claim-free years. It is now an optional benefit you buy, and it waives your excess if you claim. One tick in the portal.');
    if (anyTPO) out +=
      eduBox_('<b style="color:#9a6d0b">💡 Third party covers other people — not your own vehicle.</b> ' +
        'Comprehensive adds accident, fire and theft cover for your car, plus a No Claim Discount that grows to 60%. Tick one box in the portal for a free comparison quote.') +
      eduBox_('<b style="color:#9a6d0b">🆕 New benefit:</b> <b>windscreen cover</b> can now be added to Private Third Party policies — a cracked windscreen no longer comes out of your pocket.');
    return out;
  }

  if (g.cls === 'home' || g.cls === 'property') {
    var thing = g.cls === 'home' ? 'your home' : 'the premises';
    return eduBox_('<b style="color:#9a6d0b">⚠️ The one thing worth checking: your sum insured.</b> ' +
        'This policy carries an <b>average clause</b>. If ' + thing + ' is insured for less than 85% of what it ' +
        'would cost to rebuild, a claim is reduced by the same proportion you are underinsured — and that applies ' +
        'to <b>every</b> claim, not just a total loss.' +
        (si ? ' You are currently insured for <b>' + fmtMoney_(si) + '</b>.' : '') +
        '<br><br>A partial claim of $100,000 on a property insured at half its rebuilding cost pays <b>$50,000</b>. ' +
        'Building costs have moved; the figure on your schedule may not have. Tell us in the portal and we will review it.') +
      (g.cls === 'home'
        ? eduBox_('<b style="color:#9a6d0b">💡 Worth knowing:</b> contents are usually covered under ' +
            'sub-limits per category, and jewellery, cash and items taken outside the home are often capped well ' +
            'below what people expect. If you have acquired anything significant this year, say so when you renew.')
        : eduBox_('<b style="color:#9a6d0b">💡 The cover most businesses find out about too late:</b> ' +
            '<b>business interruption</b>. Fire cover rebuilds the building and replaces the stock — it does not ' +
            'replace the income lost while you are closed. Ask us for a quote when you renew.'));
  }

  if (g.cls === 'liability') {
    return eduBox_('<b style="color:#9a6d0b">💡 Check the limit, not just the premium.</b> ' +
      (si ? 'Your limit is <b>' + fmtMoney_(si) + '</b>. ' : '') +
      'A liability limit set years ago against a smaller operation is the commonest gap we find at renewal — ' +
      'and many contracts now specify a minimum. Tell us in the portal if the work has grown.');
  }
  return '';
}

/**
 * Send one email for one policy. Goes through sendMail_(), so test mode
 * reroutes it to you and strips cc/bcc/reply-to.
 */
function rsfSendGroup_(g) {
  var c = RSF_COPY[g.cls] || RSF_COPY.other;
  var lead = g.lead;
  var subject = (RSF_SUBJECT[g.stage] || RSF_SUBJECT['30d'])(c, lead.nextDue);
  var line = (c[g.stage] || c['30d']).replace('{d}', '<b>' + lead.nextDue + '</b>');
  var ref = lead.policy ? ' <b>' + esc_(lead.policy) + '</b>' : '';
  var bal = g.rows.reduce(function (a, r) { return a + (Number(r.balance) || 0); }, 0);

  sendMail_({
    to: lead.email, name: CONFIG.FROM_NAME,
    subject: subject,
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_((lead.contact || lead.client).split(' ')[0] || 'Valued Client') + ',</p>' +
      '<p>Your ' + esc_(c.noun) + ref + ' ' + line + '</p>' +
      rsfSchedule_(g) +
      ctaBtn_(portalLink_(lead.token), 'Review & renew my policy') +
      rsfEdu_(g) +
      (bal > 0 ? '<div style="background:#fbe9e7;border-left:4px solid #b3261e;padding:12px 16px;margin:14px 0">' +
        'A balance of <b>' + fmtMoney_(bal) + '</b> shows on this policy. Settling it keeps your renewal seamless.</div>' : '') +
      '<p>Prefer to talk it through? Just reply to this email' +
        (CONFIG.AGENT_PHONE ? ' or call ' + esc_(CONFIG.AGENT_PHONE) : '') + '.</p>' + sig_(),
      'Policy renewal'),
  });
}

/**
 * DRY RUN. Sends nothing, writes nothing, creates no tasks.
 * Run this from the editor and read the log before you go anywhere near live.
 */
function rsfPreview() {
  var p = rsfPlan_();
  var L = [];
  L.push('RENEWAL LADDER — DRY RUN, nothing sent');
  L.push('window: ' + rsfIso_(rsfShift_(-RSF.LOOKBACK)) + ' to ' + rsfIso_(rsfShift_(RSF.LOOKAHEAD)) +
         ' on Next_Renewal_Date__c');
  L.push('risks in window: ' + p.total);
  L.push('');
  var risks = p.send.reduce(function (a, g) { return a + g.rows.length; }, 0);
  L.push('WOULD SEND (' + p.send.length + ' emails, covering ' + risks + ' risks)');
  if (!p.send.length) L.push('  — nothing due today');
  p.send.forEach(function (g) {
    L.push('  [' + g.stage + '] ' + g.cls.toUpperCase() +
           '  ' + (g.lead.nextDue || '?') +
           '  ' + (g.lead.client || '').slice(0, 30) +
           '  ' + g.lead.email +
           (g.rows.length > 1 ? '   (' + g.rows.length + ' risks on ' + g.lead.policy + ')' : ''));
  });

  var byCls = {};
  p.send.forEach(function (g) { byCls[g.cls] = (byCls[g.cls] || 0) + 1; });
  L.push('');
  L.push('  by class: ' + Object.keys(byCls).map(function (k) {
    return k + ' ' + byCls[k]; }).join(' · '));

  var by = {};
  p.skip.forEach(function (s) { by[s.why] = (by[s.why] || 0) + 1; });
  L.push('');
  L.push('SKIPPED (' + p.skip.length + ')');
  Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })
    .forEach(function (w) { L.push('  ' + by[w] + '  ' + w); });

  // These are the ones worth somebody's morning: owed an email today, and we
  // have no way to send it. Named, so they can be chased rather than counted.
  var blocked = p.skip.filter(function (s) { return /^DUE TODAY/.test(s.why); });
  if (blocked.length) {
    L.push('');
    L.push('COULD NOT REACH — owed a reminder today (' + blocked.length + ')');
    blocked.sort(function (a, b) { return (a.row.dueIso < b.row.dueIso) ? -1 : 1; })
      .forEach(function (s) {
        L.push('  ' + (s.row.nextDue || '?') + '  ' + rsfClass_(s.row.policy).toUpperCase() +
               '  ' + (s.row.client || '').slice(0, 30) +
               '  ' + (s.row.policy || '') +
               '  — ' + (s.row.email ? 'no token' : 'no email address'));
      });
  }

  L.push('');
  L.push(testMode_()
    ? 'Test mode is ON — a live run would reroute every one of these to ' + testInbox_() + '.'
    : 'TEST MODE IS OFF — a live run would email these clients for real.');
  Logger.log(L.join('\n'));
  return L.join('\n');
}

/**
 * The real run. Still goes through sendMail_(), so test mode reroutes
 * everything to you and strips cc/bcc/reply-to.
 */
function rsfDailyAutomation() {
  var p = rsfPlan_();
  var done = 0, failed = 0;

  p.send.slice(0, RSF.MAX_PER_RUN).forEach(function (g) {
    try {
      rsfSendGroup_(g);
      // In test mode nothing reached a client, so nothing is stamped —
      // a rehearsal must never burn a real reminder.
      // Every risk on the policy is stamped, not just the one that led the
      // group, so tomorrow's dedupe holds however the group re-forms.
      if (!testMode_()) g.rows.forEach(function (r) { rsfStamp_(r, g.stage); });
      if (typeof logActivity_ === 'function')
        logActivity_(g.lead.token, g.lead.client, 'reminder-' + g.stage, 'salesforce', g.lead.policy || '');
      done++;
    } catch (err) {
      failed++;
      Logger.log('FAILED ' + g.lead.id + ' (' + g.stage + '): ' + err);
    }
  });

  var msg = 'Renewal ladder: ' + done + ' emails sent, ' + failed + ' failed, ' +
            p.skip.length + ' risks skipped, ' + p.total + ' in window' +
            (testMode_() ? ' — TEST MODE, all rerouted to ' + testInbox_()
                         : ' — LIVE, these reached clients');
  Logger.log(msg);
  return msg;
}

/** Move the daily 8am trigger onto the Salesforce version. */
function rsfInstall() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'rsfDailyAutomation' || f === 'dailyAutomation') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rsfDailyAutomation').timeBased().everyDays(1).atHour(8).create();
  var m = 'Daily renewal ladder installed — runs ~8am, reading Salesforce.' +
          (testMode_() ? ' Test mode is ON, so it will email only you.'
                       : ' TEST MODE IS OFF — it will email clients.');
  try { SpreadsheetApp.getActiveSpreadsheet().toast(m); } catch (e) {}
  Logger.log(m);
  return m;
}

/** Is the trigger actually scheduled? The wall asks this. */
function rsfAutomationOn_() {
  return ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'rsfDailyAutomation';
  });
}

/* ============================ menu ============================ */

/**
 * Appears under its own menu when this file is installed. Code.gs's onOpen
 * calls this the same way it calls propertyMenu_ — guarded, so the sheet
 * still opens cleanly if this file is ever removed.
 */
function renewalsSFMenu_(ui) {
  var t = testMode_();
  return ui.createMenu('☁ Renewals (Salesforce)')
    .addItem('1. Preview today — sends nothing', 'rsfPreview')
    .addItem(t ? '2. Run now (🧪 test — emails only you)'
               : '2. Run now (LIVE — emails clients)', 'rsfDailyAutomation')
    .addSeparator()
    .addItem('Install the daily 8am run', 'rsfInstall')
    .addItem('Is the daily run scheduled?', 'rsfShowStatus');
}

function rsfShowStatus() {
  var on = rsfAutomationOn_();
  var msg = on ? '✅ The daily renewal ladder IS scheduled (about 8am).'
               : '❌ The daily renewal ladder is NOT scheduled — nothing is going out. Run "Install the daily 8am run".';
  msg += '\n\n' + (testMode_()
    ? '🧪 Test mode is ON — everything reroutes to ' + testInbox_() + '.'
    : '⚠️ Test mode is OFF — emails reach clients.');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

/* ============================ preflight ============================ */

/**
 * Run this before anything else. It touches nothing — no Salesforce call,
 * no email, no write — and answers the two questions that actually block a
 * first run:
 *
 *   1. Is Code.gs complete? A part-pasted Code.gs is easy to end up with,
 *      and the failure looks like "Script function not found" from a menu
 *      item rather than anything obviously related.
 *   2. Are the Salesforce credentials in THIS project? Script Properties do
 *      not travel between projects, so credentials set up for another script
 *      are not visible here.
 */
function rsfSelfCheck() {
  var L = ['PREFLIGHT — nothing was sent, called or written', ''];

  var needed = {
    'Code.gs — menu targets': ['fillPortalLinks', 'installTriggers', 'toggleTestMode',
                               'showStaffLink', 'showMyLink', 'linkRiskDetails', 'requireUrl_'],
    'Code.gs — used by this file': ['sendStageEmail_', 'sendMail_', 'testMode_',
                                    'testInbox_', 'logActivity_', 'portalLink_'],
  };
  var missing = [];
  Object.keys(needed).forEach(function (group) {
    L.push(group);
    needed[group].forEach(function (fn) {
      var ok = false;
      try { ok = (typeof this[fn] === 'function'); } catch (e) {}
      if (!ok) { try { ok = (eval('typeof ' + fn) === 'function'); } catch (e) { ok = false; } }
      L.push('  ' + (ok ? 'OK  ' : 'MISSING  ') + fn);
      if (!ok) missing.push(fn);
    });
    L.push('');
  });
  var stagesOk = false;
  try { stagesOk = (typeof STAGES === 'object' && !!STAGES['30d']); } catch (e) {}
  L.push('  ' + (stagesOk ? 'OK  ' : 'MISSING  ') + 'STAGES (the reminder ladder text)');
  if (!stagesOk) missing.push('STAGES');
  L.push('');

  var p = PropertiesService.getScriptProperties();
  var norm = function (s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  var all = {};
  p.getKeys().forEach(function (k) {
    var v = p.getProperty(k);
    if (v && String(v).trim()) all[norm(k)] = { name: k, val: String(v).trim() };
  });
  var has = function (names) {
    for (var i = 0; i < names.length; i++) {
      var hit = all[norm(names[i])];
      if (hit) return hit.name + ' (' + hit.val.length + ' chars)';
    }
    return '';
  };
  var creds = [
    ['client id',     ['SF_CLIENT_ID', 'SF_KEY', 'SF_CONSUMER_KEY'],           true],
    ['client secret', ['SF_CLIENT_SECRET', 'SF_SECRET', 'SF_CONSUMER_SECRET'], true],
    ['refresh token', ['SF_REFRESH_TOKEN'],                                     true],
    ['login url',     ['SF_LOGIN_URL', 'SF_INSTANCE_URL'],                     false],
  ];
  L.push('Salesforce credentials in THIS project');
  var credMissing = [];
  creds.forEach(function (c) {
    var found = has(c[1]);
    L.push('  ' + (found ? 'OK  ' + c[0] + ' <- ' + found
                         : (c[2] ? 'MISSING  ' : 'optional, absent  ') + c[0] +
                           ' (looked for ' + c[1].join(' / ') + ')'));
    if (!found && c[2]) credMissing.push(c[0]);
  });
  L.push('');
  L.push('All Script Property names present: ' + (p.getKeys().sort().join(', ') || '(none)'));
  L.push('');

  if (missing.length)
    L.push('✗ Code.gs is incomplete — ' + missing.length + ' missing: ' + missing.join(', ') +
           '\n  Paste the rest of Code.gs back in before going further.');
  else L.push('✓ Code.gs is complete.');

  if (credMissing.length)
    L.push('✗ Salesforce credentials missing here: ' + credMissing.join(', ') +
           '\n  Copy them from whichever project TokenMigration.gs runs in ' +
           '(Project Settings -> Script Properties). They do not travel between projects.');
  else L.push('✓ Salesforce credentials are present. rsfPreview() can run.');

  L.push('');
  L.push(testMode_() ? '🧪 Test mode is ON.' : '⚠️ Test mode is OFF — a live run would email clients.');

  Logger.log(L.join('\n'));
  return L.join('\n');
}
