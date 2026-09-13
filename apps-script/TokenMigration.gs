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

/* Property-name aliases. Different scripts in this estate were written with
   different conventions — SF_KEY vs SF_CLIENT_ID, SF_PASS vs SF_PASSWORD —
   so accept any of them rather than demanding one house style. First match
   with a value wins. */
var TM_ALIAS = {
  clientId:     ['SF_CLIENT_ID', 'SF_KEY', 'SF_CONSUMER_KEY'],
  clientSecret: ['SF_CLIENT_SECRET', 'SF_SECRET', 'SF_CONSUMER_SECRET'],
  username:     ['SF_USERNAME', 'SF_USER'],
  password:     ['SF_PASSWORD', 'SF_PASS'],
  secToken:     ['SF_SECURITY_TOKEN', 'SF_TOKEN'],
  refresh:      ['SF_REFRESH_TOKEN'],
  loginUrl:     ['SF_LOGIN_URL', 'SF_INSTANCE_URL'],
};
function tmAny_(kind) {
  var names = TM_ALIAS[kind] || [];
  for (var i = 0; i < names.length; i++) {
    var v = tmProp_(names[i]);
    if (v) return v;
  }
  return null;
}

/**
 * Get an access token. Prefers the refresh-token grant, because that is what
 * this project already has working and it survives password changes and MFA.
 * Falls back to the username-password grant (password + security token
 * concatenated) when no refresh token is stored.
 *
 * NB the cache is kept under TM_ACCESS, not SF_TOKEN — SF_TOKEN here holds
 * the Salesforce SECURITY TOKEN, and overwriting it would break the other
 * scripts in this project.
 */
function tmToken_() {
  var p = tmProps_();
  var cached = p.getProperty('TM_ACCESS'), when = Number(p.getProperty('TM_ACCESS_AT') || 0);
  if (cached && (new Date().getTime() - when) < 50 * 60 * 1000) return JSON.parse(cached);

  var id = tmAny_('clientId'), secret = tmAny_('clientSecret');
  var login = (tmAny_('loginUrl') || 'https://login.salesforce.com').replace(/\/+$/, '');
  var refresh = tmAny_('refresh');
  if (!id || !secret)
    throw new Error('Salesforce client credentials not found.\n\nExpected one of ' +
      TM_ALIAS.clientId.join(' / ') + ' and ' + TM_ALIAS.clientSecret.join(' / ') +
      ' in Script Properties. Run tmCheck() to see what is actually stored.');

  var payload, mode;
  if (refresh) {
    mode = 'refresh_token';
    payload = { grant_type: 'refresh_token', client_id: id, client_secret: secret, refresh_token: refresh };
  } else {
    var user = tmAny_('username'), pass = tmAny_('password'), sec = tmAny_('secToken');
    if (!user || !pass)
      throw new Error('No refresh token, and no username/password either.\n\nStore SF_REFRESH_TOKEN, ' +
        'or SF_USERNAME plus SF_PASSWORD (and SF_TOKEN for the security token). Run tmCheck().');
    mode = 'password';
    payload = { grant_type: 'password', client_id: id, client_secret: secret,
                username: user, password: pass + (sec || '') };
  }

  var res = UrlFetchApp.fetch(login + '/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true, payload: payload,
  });
  var body = res.getContentText();
  if (res.getResponseCode() !== 200) {
    var hint = '';
    if (body.indexOf('expired access/refresh token') > -1 || body.indexOf('invalid_grant') > -1) {
      hint = mode === 'refresh_token'
        ? '\n\nThe stored SF_REFRESH_TOKEN is expired or revoked — re-run whatever authorises this project ' +
          '(sfAuth, in the script that set it up) to mint a fresh one.'
        : '\n\nFor the password grant, SF_PASSWORD must be the password and SF_TOKEN the security token — ' +
          'this code joins them for you. Also check the org allows username-password flows.';
    }
    throw new Error('Salesforce login failed (' + mode + ' grant): ' + body + hint);
  }
  var tok = JSON.parse(body);
  if (!tok.instance_url) tok.instance_url = login;           // refresh grant may omit it
  p.setProperty('TM_ACCESS', JSON.stringify(tok));
  p.setProperty('TM_ACCESS_AT', String(new Date().getTime()));
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
      // TM_ACCESS is this file's own cached ACCESS token, and it is the only
      // thing that may be cleared here. SF_TOKEN holds the Salesforce SECURITY
      // TOKEN, which is a permanent credential shared with SalesforceSync.gs,
      // WallBoard.gs and KPI.gs — deleting it on a routine 401 (which this used
      // to do) silently breaks the password grant for every one of them, and
      // the value cannot be recovered without reissuing it from Salesforce.
      tmProps_().deleteProperty('TM_ACCESS');
      tmProps_().deleteProperty('TM_ACCESS_AT');
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
  var names = Object.keys(all).filter(function (k) { return k.indexOf('TM_ACCESS') !== 0; });
  lines.push('Script Properties in this project (' + names.length + ') — values masked:');
  names.sort().forEach(function (k) {
    var v = String(all[k] || '');
    lines.push('   "' + k + '"  =  ' + (v ? v.slice(0, 4) + '…(' + v.length + ' chars)' : '(empty)'));
  });
  lines.push('');
  lines.push('What the migration needs, and where it found it:');
  [['clientId', 'consumer key'], ['clientSecret', 'consumer secret'],
   ['refresh', 'refresh token (preferred)'], ['username', 'username'],
   ['password', 'password'], ['secToken', 'security token'], ['loginUrl', 'login URL']]
    .forEach(function (pair) {
      var kind = pair[0], found = null;
      (TM_ALIAS[kind] || []).forEach(function (n) { if (!found && tmProp_(n)) found = n; });
      lines.push((found ? '✅' : (kind === 'refresh' || kind === 'loginUrl' || kind === 'secToken' ? '·' : '❌')) +
        ' ' + pair[1] + (found ? '  ← ' + found : '  (none of: ' + (TM_ALIAS[kind] || []).join(', ') + ')'));
    });
  lines.push('');
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

/**
 * account (normalised) -> the token that account already answers to.
 *
 * Where an account carries more than one, the one on the most rows wins and
 * the disagreement is logged. That happens when a client was tokenised twice
 * by different routes, and picking the commonest keeps the most existing
 * client links working.
 */
function tmAccountTokens_(risks) {
  var counts = {};
  risks.forEach(function (r) {
    if (!r.Portal_Token__c) return;
    var k = tmNorm_(r.Account__c);
    (counts[k] = counts[k] || {})[r.Portal_Token__c] =
      (counts[k][r.Portal_Token__c] || 0) + 1;
  });
  var out = {}, split = [];
  Object.keys(counts).forEach(function (k) {
    var toks = Object.keys(counts[k]);
    toks.sort(function (a, b) { return counts[k][b] - counts[k][a]; });
    out[k] = toks[0];
    if (toks.length > 1) split.push(k + ': ' + toks.map(function (t) {
      return t + '×' + counts[k][t]; }).join(', '));
  });
  if (split.length)
    Logger.log('⚠️ accounts carrying more than one token (commonest wins): ' + split.join(' · '));
  return out;
}

/* ================= tokens for the forward renewal book only =================
 *
 * tmMintMissing() writes to every row in Risk_Details__c — the whole history,
 * thousands of rows, in one irreversible pass. That is the right tool for a
 * one-off migration and the wrong one for closing a gap in the renewals the
 * ladder is about to write to.
 *
 * These two functions do the same job across a date window: everything the
 * renewal ladder could reach in the next year, and a month of recently lapsed
 * business behind it. Same safety rules — an existing token is never
 * overwritten, an account already tokenised anywhere keeps the token it has.
 */

function tmRenewalWindow_() {
  var back = new Date(); back.setDate(back.getDate() - 30);
  var fwd  = new Date(); fwd.setDate(fwd.getDate() + 400);
  var iso = function (d) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); };
  return { from: iso(back), to: iso(fwd) };
}

function tmRenewalPlan_() {
  var w = tmRenewalWindow_();
  var due = tmQuery_(
    'SELECT Id, Account__c, Policy__c, Next_Renewal_Date__c, Portal_Token__c, Email__c ' +
    'FROM Risk_Details__c WHERE Account__c != null ' +
    'AND Next_Renewal_Date__c >= ' + w.from + ' AND Next_Renewal_Date__c <= ' + w.to + ' ' +
    'ORDER BY Next_Renewal_Date__c');

  // Existing tokens are read from the WHOLE book, not just the window: an
  // account's token often sits on a policy that renewed months ago.
  var byAccount = tmAccountTokens_(tmRisks_());

  var taken = {};
  Object.keys(byAccount).forEach(function (k) { taken[byAccount[k]] = 1; });
  var sheet = {};
  try { sheet = tmSheetTokens_(); } catch (e) { Logger.log('no sheet tokens available: ' + e); }
  Object.keys(sheet).forEach(function (k) { taken[sheet[k]] = 1; });

  var mint = {}, updates = [], reuse = [], already = 0, noEmail = 0;
  due.forEach(function (r) {
    if (r.Portal_Token__c) { already++; return; }
    if (!r.Email__c) noEmail++;                 // still tokenised; the address is a separate gap
    var k = tmNorm_(r.Account__c);
    var have = byAccount[k] || sheet[k];
    if (have) { updates.push({ id: r.Id, token: have }); reuse.push(r); return; }
    if (!mint[k]) {
      var t;
      do { t = Utilities.getUuid().replace(/-/g, '').slice(0, 8); } while (taken[t]);
      taken[t] = 1; mint[k] = t;
    }
    updates.push({ id: r.Id, token: mint[k] });
  });

  return { window: w, due: due, updates: updates, reuse: reuse,
           mint: mint, already: already, noEmail: noEmail };
}

/** Report what tokenising the forward renewal book would do. Writes nothing. */
function tmRenewalMintDryRun() {
  var p = tmRenewalPlan_();
  var fresh = p.updates.length - p.reuse.length;
  var L = [
    'DRY RUN — nothing was written.',
    'window: ' + p.window.from + ' to ' + p.window.to + ' on Next_Renewal_Date__c',
    '',
    'Renewals in window          : ' + p.due.length,
    'Already carry a token       : ' + p.already + ' (left untouched)',
    'Would be given a token      : ' + p.updates.length,
    '  reusing the account’s own : ' + p.reuse.length + '  (no new link for that client)',
    '  newly minted              : ' + fresh + '  across ' + Object.keys(p.mint).length + ' accounts',
    '',
    'Of those, with no email address: ' + p.noEmail + ' — tokenised, but still unreachable',
  ];
  if (p.reuse.length) {
    L.push('');
    L.push('REUSING AN EXISTING CLIENT LINK (' + Math.min(p.reuse.length, 20) + ' of ' + p.reuse.length + ')');
    p.reuse.slice(0, 20).forEach(function (r) {
      L.push('  ' + r.Next_Renewal_Date__c + '  ' + String(r.Account__c).slice(0, 30) +
             '  ' + (r.Policy__c || ''));
    });
  }
  Logger.log(L.join('\n'));
  try { SpreadsheetApp.getUi().alert(L.join('\n')); } catch (e) {}
  return L.join('\n');
}

/** Write them. Safe to re-run — an existing token is never replaced. */
function tmRenewalMint() {
  var p = tmRenewalPlan_();
  var res = tmWrite_(p.updates);
  var msg = 'RENEWAL BOOK TOKENISED\n\n' +
    'Rows written            : ' + res.ok + '\n' +
    'Failed                  : ' + res.fail + '\n' +
    'Reused an existing link : ' + p.reuse.length + '\n' +
    'New client accounts     : ' + Object.keys(p.mint).length + '\n' +
    'Already had one         : ' + p.already + ' (left untouched)' +
    (res.errors.length ? '\n\nErrors:\n  ' + res.errors.join('\n  ') : '');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
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

  // An account already tokenised ANYWHERE in Salesforce keeps that token.
  // A token is one client's front door, not one policy's: Brimis Court's two
  // policies both answer to cCQvTKYZ and RPM's three to 1ulQEgqu. Minting a
  // fresh one for a row that merely happens to be blank would hand a client a
  // second, different link to the same portal — and the old one stays live, so
  // nothing visibly breaks and the client simply sees half their book.
  // Kamus Muffler, Nu-Iron and Jin Xia are all in exactly that state today.
  var byAccount = tmAccountTokens_(risks);

  var mint = {}, updates = [], reused = 0;
  risks.forEach(function (r) {
    if (r.Portal_Token__c) return;
    var k = tmNorm_(r.Account__c);
    if (byAccount[k]) { updates.push({ id: r.Id, token: byAccount[k] }); reused++; return; }
    if (tokens[k]) { updates.push({ id: r.Id, token: tokens[k] }); reused++; return; }
    if (!mint[k]) {
      var t;
      do { t = Utilities.getUuid().replace(/-/g, '').slice(0, 8); } while (taken[t]);
      taken[t] = 1; mint[k] = t;
    }
    updates.push({ id: r.Id, token: mint[k] });
  });
  Logger.log('reusing an existing token on ' + reused + ' rows; minting for ' +
             Object.keys(mint).length + ' accounts that have none anywhere');
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
    .addItem('Renewal book — dry run (writes nothing)', 'tmRenewalMintDryRun')
    .addItem('Renewal book — give every renewal a token', 'tmRenewalMint')
    .addSeparator()
    .addItem('3. Mint tokens for the WHOLE book', 'tmMintMissing')
    .addItem('4. Verify', 'tmVerify')
    .addToUi();
}
