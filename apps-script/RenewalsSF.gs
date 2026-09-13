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

  var pick = function (names) {
    for (var i = 0; i < names.length; i++) {
      var v = p.getProperty(names[i]);
      if (v && String(v).trim()) return String(v).trim();
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
 * Sold vehicles are excluded, and so is anything with Send_Renewal_Reminder__c
 * explicitly false — that flag is the client's opt-out and it is honoured.
 */
function rsfRows_() {
  var soql =
    'SELECT Id, Name, Policy__c, Next_Renewal_Date__c, Motor_Vehicle_Coverage_Type__c, ' +
    'Property_Coverage_Type__c, Cover1__c, Premium_Due__c, Premium_Owed__c, Total_Premiums__c, ' +
    'Email__c, Portal_Token__c, Account__c, Contact_First_Name__c, Last_Name__c, Salutation__c, ' +
    'Vehicle_Make__c, Model__c, Vehicle_Status__c, Send_Renewal_Reminder__c ' +
    'FROM Risk_Details__c ' +
    'WHERE Next_Renewal_Date__c >= ' + rsfIso_(rsfShift_(-RSF.LOOKBACK)) + ' ' +
    'AND Next_Renewal_Date__c <= ' + rsfIso_(rsfShift_(RSF.LOOKAHEAD)) + ' ' +
    "AND (Vehicle_Status__c = null OR Vehicle_Status__c != 'Sold') " +
    'ORDER BY Next_Renewal_Date__c';

  var today = new Date(); today.setHours(0, 0, 0, 0);

  return rsfQ_(soql).map(function (r) {
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
      balance: r.Premium_Owed__c || r.Premium_Due__c || 0,
      token: String(r.Portal_Token__c || '').trim(),
      optOut: r.Send_Renewal_Reminder__c === false,
    };
  });
}

/** The stage a row is owed today, or null. Same ladder as Code.gs. */
function rsfStage_(days) {
  if (days === null) return null;
  if (days <= -7)                  return 'od7';
  if (days <= -3 && days > -30)    return 'od3';
  if (days === 0)                  return '0d';
  if (days <= 7  && days > 0)      return '7d';
  if (days <= 14 && days > 7)      return '14d';
  if (days <= 30 && days > 14)     return '30d';
  return null;
}

/**
 * What has already gone out, read back off Salesforce Tasks.
 * Returns { riskId: { '30d': true, ... } }.
 */
function rsfAlreadySent_(ids) {
  var sent = {};
  if (!ids.length) return sent;
  for (var i = 0; i < ids.length; i += 200) {
    var chunk = ids.slice(i, i + 200)
      .map(function (x) { return "'" + x + "'"; }).join(',');
    rsfQ_("SELECT WhatId, Subject FROM Task WHERE WhatId IN (" + chunk + ") " +
          "AND Subject LIKE '" + RSF.TASK_TAG + "%'")
      .forEach(function (t) {
        var m = /\[(\w+)\]/.exec(t.Subject || '');
        if (!m) return;
        (sent[t.WhatId] = sent[t.WhatId] || {})[m[1]] = true;
      });
  }
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

/* ============================ the run ============================ */

/**
 * Decide what today's run would do. Pure — touches nothing.
 * Returns { send: [...], skip: [...] }.
 */
function rsfPlan_() {
  var rows = rsfRows_();
  var sent = rsfAlreadySent_(rows.map(function (r) { return r.id; }));
  var send = [], skip = [];

  rows.forEach(function (r) {
    var stage = rsfStage_(r.days);
    var why =
      r.optOut          ? 'opted out (Send_Renewal_Reminder__c is false)' :
      !r.email          ? 'no email address on the risk' :
      !r.token          ? 'no portal token — nothing to link them to' :
      !stage            ? 'not at a reminder stage today (' + r.days + ' days out)' :
      (sent[r.id] && sent[r.id][stage]) ? stage + ' already sent' : '';
    if (why) skip.push({ row: r, why: why });
    else     send.push({ row: r, stage: stage });
  });

  return { send: send, skip: skip, total: rows.length };
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
  L.push('WOULD SEND (' + p.send.length + ')');
  if (!p.send.length) L.push('  — nothing due today');
  p.send.forEach(function (s) {
    L.push('  [' + s.stage + '] ' + (s.row.nextDue || '?') + '  ' +
           (s.row.client || '').slice(0, 34) + '  ' + s.row.email);
  });

  var by = {};
  p.skip.forEach(function (s) { by[s.why] = (by[s.why] || 0) + 1; });
  L.push('');
  L.push('SKIPPED (' + p.skip.length + ')');
  Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })
    .forEach(function (w) { L.push('  ' + by[w] + '  ' + w); });

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

  p.send.slice(0, RSF.MAX_PER_RUN).forEach(function (s) {
    try {
      sendStageEmail_(s.row, s.stage);
      // In test mode nothing reached a client, so nothing is stamped —
      // a rehearsal must never burn a real reminder.
      if (!testMode_()) rsfStamp_(s.row, s.stage);
      if (typeof logActivity_ === 'function')
        logActivity_(s.row.token, s.row.client, 'reminder-' + s.stage, 'salesforce', s.row.policy || '');
      done++;
    } catch (err) {
      failed++;
      Logger.log('FAILED ' + s.row.id + ' (' + s.stage + '): ' + err);
    }
  });

  var msg = 'Renewal ladder: ' + done + ' sent, ' + failed + ' failed, ' +
            p.skip.length + ' skipped, ' + p.total + ' in window' +
            (testMode_() ? ' — TEST MODE, all rerouted to ' + testInbox_() : '');
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
  var has = function (names) {
    for (var i = 0; i < names.length; i++) {
      var v = p.getProperty(names[i]);
      if (v && String(v).trim()) return names[i] + ' (' + String(v).trim().length + ' chars)';
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
