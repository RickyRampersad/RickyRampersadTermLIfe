/**
 * ============================================================================
 * SALESFORCE SYNC — Ricky Rampersad Branch
 * ============================================================================
 * Pulls the book straight from Salesforce into the renewal sheet. No exports,
 * no CSVs, no copy-paste. One menu click, or nightly on its own.
 *
 * WHAT IT SYNCS
 *   • Property Renewals  ← Risk_Details__c property risks (FAR/FHO/FCP/FSP)
 *   • Risk Details       ← Risk_Details__c motor risks (every vehicle)
 *   • Emails             ← filled from any record that carries one
 *
 * IT NEVER DESTROYS YOUR WORK. Rows are matched on policy + risk location
 * (property) or registration (motor) and UPDATED in place, so tokens, portal
 * links, stages, client instructions and staff notes always survive a sync.
 * New risks are appended; nothing is deleted.
 *
 * ── SETUP (once, ~5 minutes) ────────────────────────────────────────────────
 * 1. In Salesforce: Setup → App Manager → New Connected App
 *      Name: Renewal Platform · Enable OAuth Settings ✔
 *      Callback URL: https://login.salesforce.com/services/oauth2/success
 *      Scopes: "Manage user data via APIs (api)" + "Perform requests at any time (refresh_token)"
 *      Save, then Manage Consumer Details → copy the Consumer Key and Secret.
 *      Under Manage → Edit Policies → Permitted Users: "All users may self-authorize".
 * 2. Get your security token: Salesforce → your avatar → Settings →
 *      My Personal Information → Reset My Security Token (it emails you one).
 * 3. In the sheet: ☁ Salesforce → "Set up connection", paste the four values.
 * 4. ☁ Salesforce → "Test connection" — it should say how many records it sees.
 *
 * Credentials live in Script Properties (never in this file, never on GitHub).
 */

var SF = {
  API: 'v64.0',
  LOGIN: 'https://login.salesforce.com',      // sandbox: https://test.salesforce.com
  PROP_SHEET: 'Property Renewals',
  RISK_SHEET: 'Risk Details',
  // a risk is "property" when its policy carries one of these
  PROP_PREFIXES: ['FAR', 'FHO', 'FCP', 'FSP'],
};

/* ============================ credentials ============================ */

function sfProps_() { return PropertiesService.getScriptProperties(); }

function sfSetup() {
  var ui = SpreadsheetApp.getUi();
  var p = sfProps_();
  function ask(key, label, current) {
    var shown = current ? ' (currently set — leave blank to keep)' : '';
    var r = ui.prompt('Salesforce connection', label + shown, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) throw new Error('cancelled');
    var v = String(r.getResponseText()).trim();
    if (v) p.setProperty(key, v);
    else if (!current) throw new Error('“' + label + '” is required.');
  }
  try {
    ask('SF_KEY', 'Consumer Key (from your Connected App)', p.getProperty('SF_KEY'));
    ask('SF_SECRET', 'Consumer Secret', p.getProperty('SF_SECRET'));
    ask('SF_USER', 'Salesforce username (your login email)', p.getProperty('SF_USER'));
    ask('SF_PASS', 'Password + security token, joined with no space', p.getProperty('SF_PASS'));
  } catch (err) {
    if (String(err.message) !== 'cancelled') ui.alert(err.message);
    return;
  }
  sfProps_().deleteProperty('SF_TOKEN');
  ui.alert('Saved. Now run ☁ Salesforce → Test connection.');
}

/** Access token via the OAuth username-password flow. Cached ~50 minutes. */
function sfToken_() {
  var p = sfProps_();
  var cached = p.getProperty('SF_TOKEN'), when = Number(p.getProperty('SF_TOKEN_AT') || 0);
  if (cached && (new Date().getTime() - when) < 50 * 60 * 1000) return JSON.parse(cached);

  var key = p.getProperty('SF_KEY'), secret = p.getProperty('SF_SECRET');
  var user = p.getProperty('SF_USER'), pass = p.getProperty('SF_PASS');
  if (!key || !secret || !user || !pass)
    throw new Error('Salesforce is not set up yet — run ☁ Salesforce → Set up connection.');

  var res = UrlFetchApp.fetch(SF.LOGIN + '/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'password', client_id: key, client_secret: secret,
               username: user, password: pass },
  });
  var body = res.getContentText();
  if (res.getResponseCode() !== 200) {
    var hint = '';
    if (body.indexOf('invalid_grant') > -1)
      hint = '\n\nUsual causes: the password field must be your password with the security token stuck on the end (no space), and the Connected App must allow "All users may self-authorize".';
    throw new Error('Salesforce login failed: ' + body + hint);
  }
  var tok = JSON.parse(body);
  p.setProperty('SF_TOKEN', JSON.stringify(tok));
  p.setProperty('SF_TOKEN_AT', String(new Date().getTime()));
  return tok;
}

/** Runs a SOQL query, following pagination until everything is in. */
function sfQuery_(soql) {
  var tok = sfToken_();
  var url = tok.instance_url + '/services/data/' + SF.API + '/query?q=' + encodeURIComponent(soql);
  var out = [], guard = 0;
  while (url && guard++ < 60) {
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok.access_token },
    });
    if (res.getResponseCode() === 401) {           // token expired mid-run
      sfProps_().deleteProperty('SF_TOKEN');
      tok = sfToken_();
      continue;
    }
    if (res.getResponseCode() !== 200) throw new Error('Salesforce query failed: ' + res.getContentText());
    var j = JSON.parse(res.getContentText());
    out = out.concat(j.records || []);
    url = j.nextRecordsUrl ? tok.instance_url + j.nextRecordsUrl : null;
  }
  return out;
}

function sfTest() {
  var ui = SpreadsheetApp.getUi();
  try {
    var n = sfQuery_('SELECT COUNT(Id) c FROM Risk_Details__c');
    var tok = sfToken_();
    ui.alert('✅ Connected to Salesforce\n\nOrg: ' + tok.instance_url +
             '\nRisk Details records visible: ' + (n[0] ? n[0].c : '?') +
             '\n\nYou can now run the two sync options in this menu.');
  } catch (err) { ui.alert('❌ ' + err.message); }
}

/* ============================ helpers ============================ */

function sfDate_(v) {
  if (!v) return '';
  var d = new Date(v);
  return isNaN(d.getTime()) ? '' : d;
}
function sfIsProperty_(policy) {
  var p = String(policy || '').toUpperCase().replace(/\s+/g, '');
  for (var i = 0; i < SF.PROP_PREFIXES.length; i++)
    if (p.indexOf(SF.PROP_PREFIXES[i]) > -1) return true;
  return false;
}
/** Latest record wins when the same risk appears across renewal periods. */
function sfNewer_(a, b) {
  var da = String(a.From__c || a.Renewal_Date__c || '');
  var db = String(b.From__c || b.Renewal_Date__c || '');
  return da >= db ? a : b;
}
/** Next anniversary of a renewal date, so the ladder always has a future date. */
function sfNextRenewal_(v) {
  var d = sfDate_(v);
  if (!d) return '';
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var out = new Date(d.getTime()); out.setHours(0, 0, 0, 0);
  var guard = 0;
  while (out < today && guard++ < 25) out.setFullYear(out.getFullYear() + 1);
  return out;
}

/* ============================ property sync ============================ */

function syncPropertyFromSalesforce() {
  var ui = SpreadsheetApp.getUi();
  var sh, map;
  try {
    sh = (typeof propSheet_ === 'function') ? propSheet_() : ss_().getSheetByName(SF.PROP_SHEET);
    if (!sh) throw new Error('The "' + SF.PROP_SHEET + '" tab does not exist yet — run 🏠 Property Renewals → Fill property portal links once.');
    map = headerMap_(sh);
  } catch (err) { ui.alert(String(err.message || err)); return; }

  var recs;
  try {
    recs = sfQuery_(
      "SELECT Account__c, Contact__c, Email__c, Policy__c, Carrier__c, Risk_Location__c, Occupancy__c, " +
      "Cover1__c, Stock__c, General_Contents__c, Plant_Equipment_Machinery__c, Electronic_Equipment__c, " +
      "Total_Value__c, Total_Premiums_Gov_t_Inclusive__c, Renewal_Date__c, From__c, To__c " +
      "FROM Risk_Details__c WHERE Policy__c != null AND Renewal_Date__c >= LAST_N_YEARS:6 " +
      "ORDER BY Renewal_Date__c ASC");
  } catch (err) { ui.alert('❌ ' + err.message); return; }

  // keep property risks only, newest record per policy+location, and build history
  var best = {}, hist = {}, emails = {};
  recs.forEach(function (r) {
    if (!sfIsProperty_(r.Policy__c)) return;
    var k = String(r.Policy__c).replace(/\s+/g, '').toUpperCase() + '|' +
            String(r.Risk_Location__c || '').trim().toUpperCase();
    best[k] = best[k] ? sfNewer_(best[k], r) : r;
    var yr = String(r.Renewal_Date__c || '').slice(0, 4);
    var prem = Number(r.Total_Premiums_Gov_t_Inclusive__c || 0);
    if (yr && prem) { hist[k] = hist[k] || {}; hist[k][yr] = prem; }
    var acct = String(r.Account__c || '');
    if (acct && r.Email__c && !emails[acct]) emails[acct] = String(r.Email__c).trim();
  });

  // index existing rows so nothing already on the sheet is lost
  var last = sh.getLastRow();
  var existing = {}, rows = [];
  if (last > 1) {
    rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    rows.forEach(function (row, i) {
      var k = String(row[col_(map, 'policy #')] || '').replace(/\s+/g, '').toUpperCase() + '|' +
              String(row[col_(map, 'risk location')] || '').trim().toUpperCase();
      existing[k] = i + 2;
    });
  }

  function put(rowIndex, name, value) {
    var c = col_(map, name);
    if (c >= 0 && value !== '' && value !== null && value !== undefined)
      sh.getRange(rowIndex, c + 1).setValue(value);
  }

  var added = 0, updated = 0, filledEmail = 0;
  Object.keys(best).forEach(function (k) {
    var r = best[k];
    var target = existing[k];
    if (!target) {
      sh.appendRow([]);
      target = sh.getLastRow();
      added++;
    } else updated++;

    put(target, 'renewal date', sfNextRenewal_(r.Renewal_Date__c || r.To__c));
    put(target, 'client', r.Account__c || '');
    put(target, 'contact', r.Contact__c || '');
    put(target, 'risk location', r.Risk_Location__c || '');
    put(target, 'occupancy', r.Occupancy__c || '');
    put(target, 'policy #', r.Policy__c || '');
    put(target, 'carrier', r.Carrier__c || 'Guardian General');
    put(target, 'building cover', r.Cover1__c || '');
    put(target, 'stock', r.Stock__c || '');
    put(target, 'general contents', r.General_Contents__c || '');
    put(target, 'plant, equipment & machinery', r.Plant_Equipment_Machinery__c || '');
    put(target, 'electronic equipment', r.Electronic_Equipment__c || '');
    put(target, 'total value', r.Total_Value__c || '');
    put(target, 'premium', r.Total_Premiums_Gov_t_Inclusive__c || '');

    // email: from this record, else any record for the same account
    var cEmail = col_(map, 'email');
    if (cEmail >= 0) {
      var have = String(sh.getRange(target, cEmail + 1).getValue() || '').trim();
      var found = String(r.Email__c || emails[String(r.Account__c || '')] || '').trim();
      if (!have && found) { sh.getRange(target, cEmail + 1).setValue(found); filledEmail++; }
    }

    // premium history, e.g. "2024:38382.45|2025:63992.05"
    var h = hist[k];
    if (h) {
      var s = Object.keys(h).sort().map(function (y) { return y + ':' + h[y]; }).join('|');
      put(target, 'premium history', s);
      var years = Object.keys(h).sort();
      if (years.length) {
        put(target, 'insured since', years[0] + '-01-01');
        put(target, 'years insured',
            Math.round((new Date().getFullYear() - Number(years[0])) * 10) / 10);
      }
    }
  });

  var msg = '☁ Property sync complete.\n\n' +
            added + ' new risk(s) added\n' + updated + ' existing row(s) refreshed\n' +
            filledEmail + ' email address(es) filled\n\n' +
            'Tokens, portal links, stages and client instructions were left untouched.';
  try { if (typeof fillPropertyLinks === 'function') { fillPropertyLinks(); msg += '\nPortal links regenerated for any new rows.'; } } catch (e) {}
  logActivity_('', 'SYSTEM', 'sf-sync-property', Session.getEffectiveUser().getEmail(),
               added + ' added, ' + updated + ' updated, ' + filledEmail + ' emails');
  ui.alert(msg);
}

/* ============================ motor / vehicle sync ============================ */

function syncRiskDetailsFromSalesforce() {
  var ui = SpreadsheetApp.getUi();
  var HDRS = ['Client', 'Email', 'Mobile', 'Address', 'Vehicle Reg', 'Make', 'Model', 'Year',
              'Chassis #', 'Engine #', 'Coverage Type', 'Insured Value (TT$)', 'NCD %',
              'Windscreen (TT$)', 'Depreciation %', 'Policy #', 'Carrier', 'From', 'To',
              'Vehicle Status', 'Premium (TT$)', 'Vehicle First Insured', 'Years Insured', 'Token'];
  var sh = ss_().getSheetByName(SF.RISK_SHEET);
  if (!sh) { sh = ss_().insertSheet(SF.RISK_SHEET); sh.appendRow(HDRS); sh.setFrozenRows(1); }
  var map = headerMap_(sh);
  if (col_(map, 'token') < 0) { sh.getRange(1, sh.getLastColumn() + 1).setValue('Token'); map = headerMap_(sh); }

  var recs;
  try {
    recs = sfQuery_(
      "SELECT Account__c, Email__c, Vehicle__c, Vehicle_Make__c, Model__c, Year_of_Manufacture__c, " +
      "Chassis__c, Engine__c, Motor_Vehicle_Coverage_Type__c, Cover_Type__c, Cover1__c, NCD__c, " +
      "Windscreen__c, Depreciation__c, Policy__c, Carrier__c, From__c, To__c, Vehicle_Status__c, " +
      "Total_Premiums_Gov_t_Inclusive__c, Address__c " +
      "FROM Risk_Details__c WHERE Vehicle__c != null AND From__c >= LAST_N_YEARS:8 ORDER BY From__c ASC");
  } catch (err) { ui.alert('❌ ' + err.message); return; }

  // newest record per registration, plus first-insured date and email
  var best = {}, first = {}, emails = {};
  recs.forEach(function (r) {
    var reg = String(r.Vehicle__c || '').replace(/\s+/g, '').toUpperCase();
    if (!reg) return;
    best[reg] = best[reg] ? sfNewer_(best[reg], r) : r;
    var f = String(r.From__c || '');
    if (f && (!first[reg] || f < first[reg])) first[reg] = f;
    var acct = String(r.Account__c || '');
    if (acct && r.Email__c && !emails[acct]) emails[acct] = String(r.Email__c).trim();
  });

  // token per client, taken from the motor renewals tab
  var tokens = {};
  try {
    allRenewals_().forEach(function (m) {
      if (!m.token) return;
      var n = normName_(m.client);
      if (n && !tokens[n]) tokens[n] = m.token;
    });
  } catch (e) {}

  var last = sh.getLastRow();
  var existing = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().forEach(function (row, i) {
      var reg = String(row[col_(map, 'vehicle reg')] || '').replace(/\s+/g, '').toUpperCase();
      if (reg) existing[reg] = i + 2;
    });
  }

  var out = [], added = 0, updated = 0;
  Object.keys(best).forEach(function (reg) {
    var r = best[reg];
    var acct = String(r.Account__c || '');
    var yrs = '';
    if (first[reg]) {
      var d0 = new Date(first[reg]);
      if (!isNaN(d0.getTime())) yrs = Math.round((new Date() - d0) / 31557600000 * 10) / 10;
    }
    var row = {
      'client': acct,
      'email': String(r.Email__c || emails[acct] || ''),
      'address': String(r.Address__c || ''),
      'vehicle reg': String(r.Vehicle__c || ''),
      'make': String(r.Vehicle_Make__c || ''),
      'model': String(r.Model__c || ''),
      'year': r.Year_of_Manufacture__c || '',
      'chassis #': String(r.Chassis__c || ''),
      'engine #': String(r.Engine__c || ''),
      'coverage type': String(r.Motor_Vehicle_Coverage_Type__c || r.Cover_Type__c || ''),
      'insured value (tt$)': r.Cover1__c || '',
      'ncd %': r.NCD__c || '',
      'windscreen (tt$)': r.Windscreen__c || '',
      'depreciation %': r.Depreciation__c || '',
      'policy #': String(r.Policy__c || ''),
      'carrier': String(r.Carrier__c || ''),
      'from': sfDate_(r.From__c),
      'to': sfDate_(r.To__c),
      'vehicle status': String(r.Vehicle_Status__c || ''),
      'premium (tt$)': r.Total_Premiums_Gov_t_Inclusive__c || '',
      'vehicle first insured': sfDate_(first[reg]),
      'years insured': yrs,
      'token': tokens[normName_(acct)] || '',
    };
    var target = existing[reg];
    if (target) {
      updated++;
      Object.keys(row).forEach(function (h) {
        var c = col_(map, h);
        if (c < 0) return;
        if (h === 'token') {                       // never overwrite a token already set
          if (String(sh.getRange(target, c + 1).getValue() || '').trim()) return;
        }
        if (row[h] !== '' && row[h] !== null) sh.getRange(target, c + 1).setValue(row[h]);
      });
    } else {
      added++;
      var hdrs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      out.push(hdrs.map(function (h) {
        var k = String(h).trim().toLowerCase();
        return (k in row) ? row[k] : '';
      }));
    }
  });
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  _riskMap = null;

  logActivity_('', 'SYSTEM', 'sf-sync-motor', Session.getEffectiveUser().getEmail(),
               added + ' added, ' + updated + ' updated');
  ui.alert('☁ Vehicle sync complete.\n\n' + added + ' new vehicle(s) added\n' +
           updated + ' existing row(s) refreshed\n\nExisting tokens were preserved. ' +
           'Run 🔗 Link Risk Details to portal tokens to connect any new clients.');
}

/* ============================ everything, one click ============================ */

function syncEverythingFromSalesforce() {
  syncRiskDetailsFromSalesforce();
  syncPropertyFromSalesforce();
  try { if (typeof linkRiskDetails === 'function') linkRiskDetails(); } catch (e) {}
}

/** Optional nightly refresh — install once from the menu. */
function installSalesforceNightly() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'nightlySalesforceSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('nightlySalesforceSync').timeBased().everyDays(1).atHour(5).create();
  SpreadsheetApp.getUi().alert('Nightly Salesforce sync installed — runs about 5am, before the 8am renewal automation.');
}

function nightlySalesforceSync() {
  try { syncRiskDetailsFromSalesforce(); } catch (err) { Logger.log('motor sync: ' + err); }
  try { syncPropertyFromSalesforce(); } catch (err) { Logger.log('property sync: ' + err); }
}

function salesforceMenu_(ui) {
  return ui.createMenu('☁ Salesforce')
    .addItem('Set up connection', 'sfSetup')
    .addItem('Test connection', 'sfTest')
    .addSeparator()
    .addItem('⬇ Sync everything now', 'syncEverythingFromSalesforce')
    .addItem('🏠 Sync property book only', 'syncPropertyFromSalesforce')
    .addItem('🚗 Sync vehicles only', 'syncRiskDetailsFromSalesforce')
    .addSeparator()
    .addItem('🌙 Install nightly sync (5am)', 'installSalesforceNightly');
}
