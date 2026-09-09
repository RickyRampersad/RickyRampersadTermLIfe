/**
 * ============================================================================
 * TOKEN MIGRATION — move client portal tokens from the sheet into Salesforce
 * ============================================================================
 * Phase 2 of retiring the Motor Renewal Book sheet. The sheet is the only
 * place the client access tokens live; Salesforce now has Portal_Token__c on
 * Risk_Details__c, so this copies them across and (optionally) mints tokens
 * for the two thirds of the book the sheet never covered.
 *
 * WHY THIS FILE AND NOT A SCRIPT ON MY SIDE: ~1,000 rows need writing.
 * Salesforce's composite API takes 200 records per call, so this does the
 * whole book in a handful of requests.
 *
 * SELF-CONTAINED. It carries its own Salesforce login and query helpers, so
 * it runs whether or not SalesforceSync.gs or WallBoard.gs are in the
 * project. It reads the SAME Script Properties they use — SF_KEY, SF_SECRET,
 * SF_USER, SF_PASS — so there is nothing new to configure if the sync has
 * ever worked here. Every function is prefixed tm so nothing collides.
 * Run tmCheck() first if anything looks off; it diagnoses the connection.
 *
 * ORDER OF OPERATIONS
 *   1. tmDryRun()      — reports exactly what WOULD change. Writes nothing.
 *   2. tmMigrate()     — copies the sheet's tokens onto matching rows.
 *   3. tmMintMissing() — OPTIONAL. Mints tokens for accounts that have none,
 *                        so the portal finally covers the whole book.
 *   4. tmVerify()      — counts what landed and flags anything inconsistent.
 *
 * SAFETY
 *   - Existing tokens are NEVER overwritten (a live client link must not
 *     change). Rows that already carry a token are skipped and counted.
 *   - Matching is on the client ACCOUNT name, normalised — the same rule the
 *     sheet uses ("same client account = same link across all their policies").
 *   - allOrNone is false: one bad row cannot roll back the batch, and every
 *     failure is logged with its reason.
 */

var TM = {
  API: 'v64.0',
  BATCH: 200,          // Salesforce composite limit
  SHEET_ACCOUNT: 'Client Account',
  SHEET_TOKEN: 'Token',
};

/* ===================== Salesforce connection (own copy) =====================
   Deliberately duplicated rather than borrowed: this file must run in a
   project that may not contain SalesforceSync.gs. Same Script Properties,
   same 50-minute token cache, so it shares the session with the sync when
   both are present. */

function tmProps_() { return PropertiesService.getScriptProperties(); }

/**
 * Forgiving property lookup. Script Property names are case- and
 * whitespace-sensitive, and a stray space or a lower-case letter is
 * invisible in the UI — so match exactly first, then fall back to a
 * trimmed, upper-cased comparison across every key in the project.
 */
function tmProp_(name) {
  var p = tmProps_();
  var exact = p.getProperty(name);
  if (exact) return exact;
  var all = p.getProperties();
  var want = String(name).replace(/[^A-Za-z]/g, '').toUpperCase();
  for (var k in all) {
    if (String(k).replace(/[^A-Za-z]/g, '').toUpperCase() === want && all[k]) return all[k];
  }
  return null;
}

function tmToken_() {
  var p = tmProps_();
  var cached = p.getProperty('SF_TOKEN'), when = Number(p.getProperty('SF_TOKEN_AT') || 0);
  if (cached && (new Date().getTime() - when) < 50 * 60 * 1000) return JSON.parse(cached);

  var key = tmProp_('SF_KEY'), secret = tmProp_('SF_SECRET');
  var user = tmProp_('SF_USER'), pass = tmProp_('SF_PASS');
  if (!key || !secret || !user || !pass)
    throw new Error('Salesforce is not set up in this project.\n\nScript Properties need SF_KEY, SF_SECRET, ' +
      'SF_USER and SF_PASS (password + security token, no space between them).\n\n' +
      'Project Settings → Script Properties → Add script property. Run tmCheck() to re-test.');

  var res = UrlFetchApp.fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'password', client_id: key, client_secret: secret,
               username: user, password: pass },
  });
  var body = res.getContentText();
  if (res.getResponseCode() !== 200) {
    var hint = '';
    if (body.indexOf('invalid_grant') > -1)
      hint = '\n\nUsual causes: SF_PASS must be your password with the security token appended (no space), ' +
             'and the Connected App must allow "All users may self-authorize".';
    throw new Error('Salesforce login failed: ' + body + hint);
  }
  var tok = JSON.parse(body);
  p.setProperty('SF_TOKEN', JSON.stringify(tok));
  p.setProperty('SF_TOKEN_AT', String(new Date().getTime()));
  return tok;
}

/** SOQL, following pagination. */
function tmQuery_(soql) {
  var tok = tmToken_();
  var url = tok.instance_url + '/services/data/' + TM.API + '/query?q=' + encodeURIComponent(soql);
  var out = [];
  while (url) {
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + tok.access_token }, muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 401) {                    // token died mid-flight — one retry
      tmProps_().deleteProperty('SF_TOKEN');
      tok = tmToken_();
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

/** Diagnose everything this migration depends on. Run me first if stuck. */
function tmCheck() {
  var lines = [];
  var all = tmProps_().getProperties();
  var names = Object.keys(all).filter(function (k) { return k !== 'SF_TOKEN' && k !== 'SF_TOKEN_AT'; });
  lines.push('Script Properties actually in this project (' + names.length + '):');
  names.forEach(function (k) {
    var v = String(all[k] || '');
    lines.push('   "' + k + '"  =  ' + (v ? v.slice(0, 6) + '…(' + v.length + ' chars)' : '(empty)'));
  });
  lines.push('');
  ['SF_KEY', 'SF_SECRET', 'SF_USER', 'SF_PASS'].forEach(function (k) {
    var v = tmProp_(k);
    lines.push((v ? '✅' : '❌') + ' ' + k + (v && !all[k] ? '  (matched a differently-spelled property — fix the name when you can)' : ''));
  });
  try {
    var tok = tmToken_();
    lines.push('✅ Salesforce login OK — ' + tok.instance_url);
  } catch (e) { lines.push('❌ Salesforce login: ' + e.message); }
  try {
    var n = tmQuery_('SELECT COUNT(Id) n FROM Risk_Details__c WHERE Portal_Token__c != null');
    lines.push('✅ Portal_Token__c exists — ' + ((n[0] && n[0].n) || 0) + ' rows already carry one');
  } catch (e) { lines.push('❌ Portal_Token__c: ' + e.message); }
  try {
    var sh = renewalsSheet_();
    lines.push('✅ Renewals tab found — ' + (sh.getLastRow() - 1) + ' rows');
  } catch (e) { lines.push('❌ Renewals tab: ' + e.message + '  (is this the renewal sheet\'s project?)'); }
  var msg = lines.join('\n');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Token migration — connection check\n\n' + msg); } catch (e) {}
  return msg;
}

/* ============================ the sheet side ============================ */

function tmNorm_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

/** account (normalised) -> token, read from the renewals tab. */
function tmSheetTokens_() {
  var sh = renewalsSheet_();
  var map = headerMap_(sh);
  var cAcct = col_(map, TM.SHEET_ACCOUNT.toLowerCase());
  var cTok = col_(map, TM.SHEET_TOKEN.toLowerCase());
  if (cAcct < 0 || cTok < 0)
    throw new Error('Could not find "' + TM.SHEET_ACCOUNT + '" and "' + TM.SHEET_TOKEN + '" columns on the renewals tab.');
  var last = sh.getLastRow();
  if (last < 2) return {};
  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var out = {}, clash = [];
  vals.forEach(function (r) {
    var a = tmNorm_(r[cAcct]), t = String(r[cTok] || '').trim();
    if (!a || !t) return;
    if (out[a] && out[a] !== t) clash.push(r[cAcct] + ': ' + out[a] + ' vs ' + t);
    out[a] = t;
  });
  if (clash.length) Logger.log('⚠️ accounts carrying more than one token (first wins): ' + clash.join(' · '));
  return out;
}

/* ========================== the Salesforce side ========================== */

function tmRisks_() {
  return tmQuery_(
    'SELECT Id, Account__c, Portal_Token__c FROM Risk_Details__c ' +
    'WHERE Account__c != null ORDER BY Account__c'
  );
}

/** Bulk PATCH via the composite sobjects endpoint, 200 at a time. */
function tmWrite_(updates) {
  if (!updates.length) return { ok: 0, fail: 0, errors: [] };
  var tok = tmToken_();
  var ok = 0, fail = 0, errors = [];
  for (var i = 0; i < updates.length; i += TM.BATCH) {
    var slice = updates.slice(i, i + TM.BATCH);
    var body = {
      allOrNone: false,
      records: slice.map(function (u) {
        return { attributes: { type: 'Risk_Details__c' }, id: u.id, Portal_Token__c: u.token };
      }),
    };
    var res = UrlFetchApp.fetch(tok.instance_url + '/services/data/' + TM.API + '/composite/sobjects', {
      method: 'patch', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + tok.access_token },
      payload: JSON.stringify(body), muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) {
      fail += slice.length;
      errors.push('batch ' + i + ': HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
      continue;
    }
    JSON.parse(res.getContentText()).forEach(function (r) {
      if (r.success) ok++;
      else { fail++; if (errors.length < 12) errors.push((r.errors && r.errors[0] && r.errors[0].message) || 'unknown'); }
    });
    Utilities.sleep(200);                                  // be kind to the API
  }
  return { ok: ok, fail: fail, errors: errors };
}

/* ============================ the operations ============================ */

/** Work out the plan without touching anything. */
function tmPlan_() {
  var tokens = tmSheetTokens_();
  var risks = tmRisks_();
  var updates = [], already = 0, unmatched = {}, matchedAccts = {};
  risks.forEach(function (r) {
    var k = tmNorm_(r.Account__c);
    var t = tokens[k];
    if (!t) { unmatched[r.Account__c] = (unmatched[r.Account__c] || 0) + 1; return; }
    matchedAccts[r.Account__c] = 1;
    if (r.Portal_Token__c) { already++; return; }           // never overwrite a live token
    updates.push({ id: r.Id, token: t });
  });
  return {
    sheetAccounts: Object.keys(tokens).length,
    risks: risks.length,
    updates: updates,
    already: already,
    matchedAccounts: Object.keys(matchedAccts).length,
    unmatched: unmatched,
  };
}

/** 1. Report only — writes nothing. Run this first. */
function tmDryRun() {
  var p = tmPlan_();
  var un = Object.keys(p.unmatched).sort(function (a, b) { return p.unmatched[b] - p.unmatched[a]; });
  var lines = [
    'DRY RUN — nothing was written.',
    '',
    'Sheet accounts carrying a token : ' + p.sheetAccounts,
    'Risk Details rows in Salesforce : ' + p.risks,
    'Accounts matched                : ' + p.matchedAccounts,
    'Rows that WOULD get a token     : ' + p.updates.length,
    'Rows already tokenised (skipped): ' + p.already,
    'Rows with no token available    : ' + un.reduce(function (a, k) { return a + p.unmatched[k]; }, 0) +
      ' across ' + un.length + ' accounts',
    '',
    'Biggest accounts with NO token (tmMintMissing can give them one):',
  ].concat(un.slice(0, 15).map(function (k) { return '  ' + p.unmatched[k] + '  ' + k; }));
  Logger.log(lines.join('\n'));
  try { SpreadsheetApp.getUi().alert(lines.join('\n')); } catch (e) {}
  return lines.join('\n');
}

/** 2. Copy the sheet's tokens onto Salesforce. Safe to re-run. */
function tmMigrate() {
  var p = tmPlan_();
  var res = tmWrite_(p.updates);
  var msg = 'MIGRATION COMPLETE\n\n' +
    'Rows written   : ' + res.ok + '\n' +
    'Failed         : ' + res.fail + '\n' +
    'Already had one: ' + p.already + ' (left untouched)\n' +
    (res.errors.length ? '\nErrors:\n  ' + res.errors.join('\n  ') : '');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/**
 * 3. OPTIONAL — mint a token for every account that has none, so the portal
 * covers the whole book rather than the third the sheet reached. Same format
 * as the existing tokens (8 chars) and unique per client account.
 */
function tmMintMissing() {
  var tokens = tmSheetTokens_();
  var risks = tmRisks_();
  var taken = {};
  Object.keys(tokens).forEach(function (k) { taken[tokens[k]] = 1; });
  risks.forEach(function (r) { if (r.Portal_Token__c) taken[r.Portal_Token__c] = 1; });

  var mint = {}, updates = [];
  risks.forEach(function (r) {
    if (r.Portal_Token__c) return;
    var k = tmNorm_(r.Account__c);
    if (tokens[k]) return;                                  // sheet already has one for this account
    if (!mint[k]) {
      var t;
      do { t = Utilities.getUuid().replace(/-/g, '').slice(0, 8); } while (taken[t]);
      taken[t] = 1; mint[k] = t;
    }
    updates.push({ id: r.Id, token: mint[k] });
  });
  var res = tmWrite_(updates);
  var msg = 'MINTED NEW TOKENS\n\n' +
    'New client accounts given access: ' + Object.keys(mint).length + '\n' +
    'Rows written                    : ' + res.ok + '\n' +
    'Failed                          : ' + res.fail +
    (res.errors.length ? '\n\nErrors:\n  ' + res.errors.join('\n  ') : '');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/** 4. What landed, and does anything disagree with the sheet? */
function tmVerify() {
  var tokens = tmSheetTokens_();
  var risks = tmRisks_();
  var withTok = 0, without = 0, accts = {}, mismatch = [];
  risks.forEach(function (r) {
    if (r.Portal_Token__c) {
      withTok++; accts[r.Portal_Token__c] = 1;
      var expect = tokens[tmNorm_(r.Account__c)];
      if (expect && expect !== r.Portal_Token__c && mismatch.length < 10)
        mismatch.push(r.Account__c + ': sheet ' + expect + ' vs Salesforce ' + r.Portal_Token__c);
    } else without++;
  });
  var msg = 'VERIFY\n\n' +
    'Rows with a token   : ' + withTok + '\n' +
    'Rows without        : ' + without + '\n' +
    'Distinct tokens     : ' + Object.keys(accts).length + '\n' +
    (mismatch.length
      ? '\n⚠️ Disagrees with the sheet (investigate before retiring it):\n  ' + mismatch.join('\n  ')
      : '\n✅ Every token matches the sheet — no client link will break.');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/** Menu — appears under its own heading so it can't be clicked by accident. */
function tmOnOpen() {
  SpreadsheetApp.getUi().createMenu('🔑 Token Migration')
    .addItem('0. Check the connection', 'tmCheck')
    .addItem('1. Dry run (writes nothing)', 'tmDryRun')
    .addItem('2. Migrate sheet tokens → Salesforce', 'tmMigrate')
    .addSeparator()
    .addItem('3. Mint tokens for accounts with none', 'tmMintMissing')
    .addItem('4. Verify', 'tmVerify')
    .addToUi();
}
