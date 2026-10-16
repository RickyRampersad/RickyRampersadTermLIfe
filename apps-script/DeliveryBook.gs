/**
 * DeliveryBook.gs — the branch's Delivery Book: what was handed to whom,
 * where, and the client told the same day.
 *
 * Asked for on 15 October 2026. The book had been a Jotform feeding the
 * "Delivery Book" Google Sheet. Twelve deliveries in two months, and the
 * column the whole thing was for — "Client's Email" — was empty on every
 * one, so no client was ever told. Half had no signature. The client's name
 * was typed three different ways for one man, so nothing could be matched.
 *
 * What changes:
 *   - The person delivering signs in with their access code and looks the
 *     client up in Salesforce, by policy number or by name. They do not type
 *     the client; they pick them.
 *   - Once the client is picked, every policy they hold is listed by record
 *     type (LIFE, PENSION, MOTOR, PROPERTY, HEALTH …) and the ones being
 *     handed over are ticked. Several can go in one visit. (Asked for in
 *     those words: "allow the user when the first and last name is pulled
 *     access to the different record types and policy numbers the client
 *     has".)
 *   - Collector's full name, their relationship to the client, a signature
 *     and the phone's GPS are required. A photo is required for a cheque.
 *   - The GPS becomes a map pin and a street address, and the distance from
 *     the client's address on file. It is internal: it is never in the
 *     client's e-mail.
 *   - The delivery is logged in Salesforce as a completed Servicing task on
 *     the client, and the client is e-mailed a confirmation.
 *   - A client not in Salesforce is created only when the person logging
 *     says, in so many words, "not in Salesforce". A misspelt name never
 *     creates a contact on its own.
 *
 * ── CONTAINER-BOUND ───────────────────────────────────────────────────────
 * Create this project from the Delivery Book sheet (Extensions → Apps
 * Script). The Jotform's own tab ("Form responses") is left exactly as it is;
 * this writes to its own tabs beside it, and importJotformHistory() copies
 * the old rows across once so the book reads as one.
 *
 * ── SCRIPT PROPERTIES ─────────────────────────────────────────────────────
 *   SF_KEY, SF_SECRET, SF_LOGIN_URL   the KPI tracker's Connected App
 *                                     (client credentials). Copy them; this is
 *                                     a separate project.
 *   DB_MODE          "test" (default) or "live". In test every client e-mail
 *                    goes to DB_TEST_INBOX with a banner naming the client it
 *                    was for, and no Salesforce write is made.
 *   DB_TEST_INBOX    where test e-mails go. Empty: the script owner.
 *   DB_REPLY_TO      reply-to on client e-mails. Default Sales Support.
 *   DB_SF_OWNER      Salesforce User Id that owns a new contact when the
 *                    person logging has none on the Access tab.
 *   DB_FOLDER_ID     created on first use: the Drive folder for signatures
 *                    and photos.
 *
 * Nothing here is client data, and nothing client-identifying may be added
 * to this file: the repository is public.
 */

var DB = {
  API: 'v60.0',
  SESSION_HOURS: 12,
  TABS: {
    DELIV: 'Deliveries',
    ACCESS: 'Access',
    SESS: 'Sessions',
    RATINGS: 'Ratings',
    OLD: 'Form responses',
  },
  SALES_SUPPORT: 'rickyrampersadsalessupport@myguardiangroup.com',
  LOGO: 'https://rickyrampersadbranch.com/logo-mark.png',
  BRAND: 'Ricky Rampersad Branch',
  DOC_TYPES: ['Policy Contract', 'Certificate', 'Cheque', 'Renewal Notice', 'Cover Note',
              'Claim Payment', 'Endorsement', 'Other'],
  RELATIONSHIPS: ['Self', 'Spouse', 'Family', 'Employee', 'Other'],
  METHODS: ['In person', 'Left at office', 'Courier'],
  MAX_PHOTO_KB: 6000,
  MAX_SIG_KB: 400,
  POLICY_LIMIT: 60,
  FAR_KM: 15,          // delivered further than this from the address on file: flagged
};

var DB_COLUMNS = [
  'Reference', 'Item', 'Logged At', 'Delivered At', 'Delivered By', 'Method',
  'Client', 'Client Type', 'Salesforce Contact', 'Client Email', 'Client Mobile',
  'Policy #', 'Record Type', 'Plan', 'Portfolio Id', 'Document', 'Quantity', 'Notes',
  'Collected By', 'Relationship', 'Signature', 'Photo',
  'Latitude', 'Longitude', 'Accuracy (m)', 'Pin', 'Address', 'Distance From Client (km)', 'Location Note',
  'Match', 'Contact Action', 'Salesforce Task', 'Email Status', 'Email Sent At', 'Flags', 'Source',
];

var DB_RATING_COLUMNS = ['Reference', 'Stars', 'Comment', 'Delivered By', 'Client', 'Rated At', 'Updated At', 'Test'];
var DB_ACCESS_COLUMNS = ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'];
var DB_SESS_COLUMNS = ['Token', 'Name', 'Role', 'Salesforce User Id', 'Issued', 'Expires', 'Apps'];

/* ── RR Operations ─────────────────────────────────────────────────────────
 * 15 October 2026: "when Pawan logs in he will also see what apps
 * available … rickyrampersadbranch/rroperations … after this will build the
 * gas receipt tracker, petty cash tracker".
 *
 * So this project is the RR Operations backend, and the Delivery Book is its
 * first app. One sign-in, one Access tab, one Sessions tab; each app is a
 * folder under /rroperations/ on the site. The Access tab's "Apps" column
 * lists the app ids a person may open (comma-separated); blank means every
 * app. An app marked "soon" shows on the launcher greyed out and cannot be
 * opened. The next two are listed now so the team sees what is coming;
 * flip them to live when their files land in this project.            */
var OPS_APPS = [
  { id: 'delivery-book', name: 'Delivery Book', path: '/rroperations/delivery-book/', status: 'live',
    blurb: 'Log a handover; the client is e-mailed and asked to rate it' },
  { id: 'gas-receipts', name: 'Gas Receipt Tracker', path: '/rroperations/gas-receipts/', status: 'soon',
    blurb: 'Snap and log fuel receipts' },
  { id: 'petty-cash', name: 'Petty Cash Tracker', path: '/rroperations/petty-cash/', status: 'soon',
    blurb: 'The float, what was spent and the top-ups' },
];

/* The apps one person sees: those named on their row, or every app when the
   cell is blank. "all" also means every app. */
function opsAppsFor_(cell) {
  var want = String(cell || '').toLowerCase().split(/[,;\s]+/).filter(String);
  var all = !want.length || want.indexOf('all') >= 0;
  return OPS_APPS.filter(function (a) { return all || want.indexOf(a.id) >= 0; })
    .map(function (a) { return { id: a.id, name: a.name, path: a.path, status: a.status, blurb: a.blurb }; });
}

function opsCanUse_(who, id) {
  return (who.apps || []).some(function (a) { return a.id === id && a.status === 'live'; });
}


/* ============================== web entry ============================== */

function doGet(e) {
  var p = (e && e.parameter) || {};
  dbNoteExecUrl_();
  /* A client's star tap. HTML, not JSON: the client is on their phone, in
     their mail app, and has to see that it worked. */
  if (p.rate) {
    try { return dbRatePage_(p); }
    catch (err) {
      Logger.log('rating: ' + err);
      return dbHtml_('<h1>Thank you</h1><p>We could not record that just now. Reply to our e-mail and tell us how we did.</p>');
    }
  }
  if (p.action === 'ping') {
    return dbJson_({ ok: true, service: 'delivery-book', mode: dbMode_(),
                     salesforce: dbSfConfigured_(), docTypes: DB.DOC_TYPES,
                     relationships: DB.RELATIONSHIPS, methods: DB.METHODS });
  }
  return dbJson_({ ok: false, error: 'Unknown action' });
}

/* Every POST is text/plain JSON, so the browser never sends a CORS preflight
   that Apps Script cannot answer. */
function doPost(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return dbJson_({ ok: false, error: 'Could not read request' }); }

  dbNoteExecUrl_();
  var out;
  try {
    if (b.action === 'login') {
      out = dbLogin_(b);
    } else {
      var who = dbSession_(b.token);
      if (!who) return dbJson_({ ok: false, error: 'signed-out' });
      /* The launcher hides an app a person may not open; this is what
         actually stops them. Hiding a tile is not access control. */
      var DELIVERY_ACTIONS = { lookup: 1, policies: 1, submit: 1, book: 1 };
      if (DELIVERY_ACTIONS[b.action] && !opsCanUse_(who, 'delivery-book')) {
        return dbJson_({ ok: false, error: 'The Delivery Book is not on your access. Ask the branch to add it.' });
      }
      switch (b.action) {
        case 'apps':     out = { ok: true, name: who.name, role: who.role, apps: who.apps, mode: dbMode_() }; break;
        case 'lookup':   out = dbLookup_(b, who); break;
        case 'policies': out = dbPolicies_(b, who); break;
        case 'submit':   out = dbSubmit_(b, who); break;
        case 'book':     out = dbBook_(b, who); break;
        case 'signOut':  out = dbSignOut_(b); break;
        default:         out = { ok: false, error: 'Unknown action' };
      }
    }
  } catch (err) {
    Logger.log('delivery book: ' + (err && err.stack || err));
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return dbJson_(out);
}

function dbJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}


/* ============================== settings ============================== */

function dbProps_() { return PropertiesService.getScriptProperties(); }
function dbProp_(k, d) { var v = dbProps_().getProperty(k); return v == null || v === '' ? (d == null ? '' : d) : v; }
function dbMode_() { return String(dbProp_('DB_MODE', 'test')).toLowerCase() === 'live' ? 'live' : 'test'; }
function dbClean_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 200); }
function dbKey_(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function dbIsSfId_(v) { return /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(String(v || '')); }
function dbTz_() {
  try { return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'America/Port_of_Spain'; }
  catch (e) { return 'America/Port_of_Spain'; }
}

function dbSheet_(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Header positions are read, not assumed, so a column someone adds by hand
   in the sheet never shifts the data under the wrong heading. */
function dbHeaderMap_(sh) {
  var lastCol = sh.getLastColumn();
  var head = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var map = {};
  head.forEach(function (h, i) { map[String(h).trim()] = i; });
  return { head: head, map: map };
}

function dbDeliveriesTab_() {
  var sh = dbSheet_(DB.TABS.DELIV, DB_COLUMNS);
  var hm = dbHeaderMap_(sh);
  var missing = DB_COLUMNS.filter(function (c) { return !(c in hm.map); });
  if (missing.length) {
    var start = hm.head.length;
    sh.getRange(1, start + 1, 1, missing.length).setValues([missing]);
  }
  return sh;
}

function dbRowFor_(sh, obj) {
  var hm = dbHeaderMap_(sh);
  var row = hm.head.map(function () { return ''; });
  Object.keys(obj).forEach(function (k) { if (k in hm.map) row[hm.map[k]] = obj[k]; });
  return row;
}


/* ============================== sign-in ============================== */

function dbLogin_(b) {
  var code = dbClean_(b.code, 40).toUpperCase();
  if (!code) throw new Error('Enter your access code.');

  /* Ten wrong codes in ten minutes closes the door for everybody for those
     ten minutes. Crude, and enough: the codes are short. */
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('db_fails') || 0);
  if (fails >= 10) throw new Error('Too many wrong codes. Try again in ten minutes.');

  var sh = dbSheet_(DB.TABS.ACCESS, DB_ACCESS_COLUMNS);
  var hm = dbHeaderMap_(sh);
  var last = sh.getLastRow();
  var rows = last > 1 ? sh.getRange(2, 1, last - 1, hm.head.length).getValues() : [];
  var person = null;
  rows.forEach(function (r) {
    var c = String(r[hm.map['Access Code']] || '').trim().toUpperCase();
    var active = String(r[hm.map['Active']] == null ? 'yes' : r[hm.map['Active']]).trim().toLowerCase();
    if (c && c === code && active !== 'no' && active !== 'false') {
      person = {
        name: String(r[hm.map['Name']] || '').trim(),
        role: String(r[hm.map['Role']] || 'Staff').trim() || 'Staff',
        sfUser: String(r[hm.map['Salesforce User Id']] || '').trim(),
        appsCell: 'Apps' in hm.map ? String(r[hm.map['Apps']] || '') : '',
      };
    }
  });
  if (!person) {
    cache.put('db_fails', String(fails + 1), 600);
    throw new Error('That code is not on the Delivery Book access list.');
  }

  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  var now = new Date();
  var exp = new Date(now.getTime() + DB.SESSION_HOURS * 3600000);
  var ss = dbSheet_(DB.TABS.SESS, DB_SESS_COLUMNS);
  ss.appendRow([token, person.name, person.role, person.sfUser, now, exp, person.appsCell]);
  dbPruneSessions_(ss);
  return { ok: true, token: token, name: person.name, role: person.role, mode: dbMode_(),
           apps: opsAppsFor_(person.appsCell),
           docTypes: DB.DOC_TYPES, relationships: DB.RELATIONSHIPS, methods: DB.METHODS };
}

function dbPruneSessions_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var vals = sh.getRange(2, 1, last - 1, 6).getValues();
  var now = new Date();
  for (var r = vals.length - 1; r >= 0; r--) {
    if (vals[r][5] instanceof Date && vals[r][5] < now) sh.deleteRow(r + 2);
  }
}

function dbSession_(token) {
  token = String(token || '').trim();
  if (!token) return null;
  var sh = dbSheet_(DB.TABS.SESS, DB_SESS_COLUMNS);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, 7).getValues();
  var now = new Date();
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][0]) !== token) continue;
    if (!(vals[r][5] instanceof Date) || vals[r][5] < now) return null;
    return { name: String(vals[r][1]), role: String(vals[r][2] || 'Staff'), sfUser: String(vals[r][3] || ''),
             apps: opsAppsFor_(vals[r][6]) };
  }
  return null;
}

function dbSignOut_(b) {
  var token = String(b.token || '').trim();
  var sh = dbSheet_(DB.TABS.SESS, DB_SESS_COLUMNS);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true };
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var r = vals.length - 1; r >= 0; r--) if (String(vals[r][0]) === token) sh.deleteRow(r + 2);
  return { ok: true };
}


/* ============================== Salesforce ============================== */

function dbSfConfigured_() {
  return !!(dbProp_('SF_KEY') && dbProp_('SF_SECRET'));
}

function dbSfToken_(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) {
    var c = cache.get('db_sf_tok');
    if (c) return JSON.parse(c);
  }
  if (!dbSfConfigured_()) throw new Error('Salesforce is not connected yet (SF_KEY and SF_SECRET).');
  var login = dbProp_('SF_LOGIN_URL', 'https://login.salesforce.com').replace(/\/+$/, '');
  var res = UrlFetchApp.fetch(login + '/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'client_credentials', client_id: dbProp_('SF_KEY'), client_secret: dbProp_('SF_SECRET') },
  });
  var j = JSON.parse(res.getContentText() || '{}');
  if (!j.access_token) throw new Error('Salesforce sign-in failed: ' + (j.error_description || j.error || res.getResponseCode()));
  var tok = { access_token: j.access_token, instance_url: j.instance_url };
  cache.put('db_sf_tok', JSON.stringify(tok), 50 * 60);
  return tok;
}

/* One call with one retry on an expired token. */
function dbSfFetch_(path, opts) {
  opts = opts || {};
  for (var attempt = 0; attempt < 2; attempt++) {
    var tok = dbSfToken_(attempt > 0);
    var res = UrlFetchApp.fetch(tok.instance_url + '/services/data/' + DB.API + path, {
      method: opts.method || 'get', muteHttpExceptions: true, contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + tok.access_token },
      payload: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var code = res.getResponseCode();
    if (code === 401 && attempt === 0) { CacheService.getScriptCache().remove('db_sf_tok'); continue; }
    var text = res.getContentText();
    if (code >= 300) {
      var msg = text;
      try { var e = JSON.parse(text); msg = (e[0] && e[0].message) || msg; } catch (x) {}
      throw new Error('Salesforce: ' + msg);
    }
    return text ? JSON.parse(text) : {};
  }
}

function dbSoql_(q) {
  var out = dbSfFetch_('/query?q=' + encodeURIComponent(q));
  return out.records || [];
}

function dbQuote_(v) { return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

/* SOQL cannot normalise, and the book holds the same pattern spelt every
   way: "TT FCP 0100001", "TTFHO0100002", "TT APU 0100003". So the likely
   spellings are all asked for, and the normalised comparison decides. */
function dbPolicyVariants_(raw) {
  var s = String(raw || '').trim().toUpperCase();
  var compact = s.replace(/[^A-Z0-9]/g, '');
  var v = {};
  [s, compact, s.replace(/[^A-Z0-9]+/g, ' '), s.replace(/[^A-Z0-9]+/g, '-')].forEach(function (x) { if (x) v[x] = 1; });
  var m = compact.match(/^([A-Z]{2})([A-Z]{2,4})(\d{5,})$/);   // TT + line code + number
  if (m) { v[m[1] + ' ' + m[2] + ' ' + m[3]] = 1; v[m[1] + m[2] + ' ' + m[3]] = 1; v[m[1] + '-' + m[2] + '-' + m[3]] = 1; }
  return Object.keys(v);
}

var DB_PORTFOLIO_FIELDS = 'Id, Name, POLICY__c, RecordType.Name, PLAN_NAME__c, Product_Name__c, ' +
  'Policy_Status_Description__c, ISSUE_DATE__c, Street__c, City__c, Contact__c, Contact_Person__c';

var DB_CONTACT_FIELDS = 'Id, Name, FirstName, LastName, Email, Preferred_Email__c, MobilePhone, ' +
  'Contact_Type__c, Account.Name, MailingStreet, MailingCity';

function dbContactOut_(c) {
  var email = String(c.Preferred_Email__c || c.Email || '').trim().toLowerCase();
  return {
    id: c.Id, name: String(c.Name || '').trim(), first: String(c.FirstName || '').trim(),
    last: String(c.LastName || '').trim(), email: email, mobile: String(c.MobilePhone || '').trim(),
    type: String(c.Contact_Type__c || ''), account: String((c.Account || {}).Name || ''),
    town: String(c.MailingCity || ''),
  };
}

/* Two contacts sharing one e-mail address are probably one person filed
   twice. Say so; never pick one silently. */
function dbMarkDuplicates_(list) {
  var byEmail = {};
  list.forEach(function (c) { if (c.email) (byEmail[c.email] = byEmail[c.email] || []).push(c.id); });
  list.forEach(function (c) {
    var same = c.email ? byEmail[c.email].filter(function (id) { return id !== c.id; }) : [];
    c.sameEmailAs = same;
  });
  return list;
}

/** Find the client, by policy number or by name. */
function dbLookup_(b, who) {
  var policy = dbClean_(b.policy, 40);
  var name = dbClean_(b.name, 80);
  if (!policy && !name) throw new Error('Enter a policy number or the client\'s name.');
  if (!dbSfConfigured_()) return { ok: true, via: 'none', clients: [], note: 'Salesforce is not connected yet.' };

  if (policy) {
    var list = dbPolicyVariants_(policy).map(dbQuote_).join(',');
    var recs = dbSoql_('SELECT ' + DB_PORTFOLIO_FIELDS + ', Contact__r.Id, Contact_Person__r.Id ' +
                       'FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN (' + list + ') LIMIT 10');
    var key = dbKey_(policy);
    var hits = recs.filter(function (r) { return dbKey_(r.POLICY__c) === key; });
    var ids = {};
    hits.forEach(function (r) { if (r.Contact__c) ids[r.Contact__c] = 1; if (r.Contact_Person__c) ids[r.Contact_Person__c] = 1; });
    var idList = Object.keys(ids);
    if (idList.length) {
      var cs = dbSoql_('SELECT ' + DB_CONTACT_FIELDS + ' FROM Contact WHERE Id IN (' +
                       idList.map(dbQuote_).join(',') + ')').map(dbContactOut_);
      return { ok: true, via: 'policy', policy: String(hits[0].POLICY__c || ''), clients: dbMarkDuplicates_(cs) };
    }
    if (!name) return { ok: true, via: 'policy', clients: [], note: 'No policy on record with that number. Try the client\'s name.' };
  }

  /* SOSL, because a name is typed from memory and the record may carry a
     middle name, a double-barrelled surname or a different spelling. */
  var term = name.replace(/[?&|!{}\[\]()^~*:\\"'+\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (term.length < 2) throw new Error('Type at least two letters of the name.');
  var words = term.split(' ').map(function (w) { return w + '*'; }).join(' AND ');
  var res = dbSfFetch_('/search?q=' + encodeURIComponent(
    'FIND {' + words + '} IN NAME FIELDS RETURNING Contact(' + DB_CONTACT_FIELDS + ' LIMIT 12)'));
  var cs2 = (res.searchRecords || []).map(dbContactOut_);
  return { ok: true, via: 'name', clients: dbMarkDuplicates_(cs2) };
}

/** Everything the client holds, grouped by record type, so the person
 *  delivering ticks a policy instead of typing one. */
function dbPolicies_(b, who) {
  var ids = [].concat(b.contactIds || b.contactId || []).filter(dbIsSfId_).slice(0, 5);
  if (!ids.length) throw new Error('Pick the client first.');
  if (!dbSfConfigured_()) return { ok: true, groups: [], client: null };
  var inList = ids.map(dbQuote_).join(',');
  var cs = dbSoql_('SELECT ' + DB_CONTACT_FIELDS + ' FROM Contact WHERE Id IN (' + inList + ')').map(dbContactOut_);
  var recs = dbSoql_('SELECT ' + DB_PORTFOLIO_FIELDS + ' FROM CLIENT_PORTFOLIO__c WHERE Contact__c IN (' + inList +
                     ') OR Contact_Person__c IN (' + inList + ') ORDER BY RecordType.Name, POLICY__c LIMIT ' + DB.POLICY_LIMIT);
  var seen = {}, groups = {};
  recs.forEach(function (r) {
    if (seen[r.Id]) return;
    seen[r.Id] = 1;
    var type = String((r.RecordType || {}).Name || 'OTHER').toUpperCase();
    (groups[type] = groups[type] || []).push({
      portfolioId: r.Id, policy: String(r.POLICY__c || ''), record: String(r.Name || ''), type: type,
      plan: String(r.PLAN_NAME__c || r.Product_Name__c || ''),
      status: String(r.Policy_Status_Description__c || ''),
      issued: String(r.ISSUE_DATE__c || ''),
      town: String(r.City__c || ''),
    });
  });
  var order = ['LIFE', 'PENSION', 'HEALTH', 'MOTOR', 'PROPERTY'];
  var keys = Object.keys(groups).sort(function (a, b2) {
    var ia = order.indexOf(a), ib = order.indexOf(b2);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b2);
  });
  return {
    ok: true,
    client: cs.filter(function (c) { return c.id === ids[0]; })[0] || cs[0] || null,
    alsoFiled: cs.filter(function (c) { return c.id !== ids[0]; }),
    groups: keys.map(function (k) { return { type: k, policies: groups[k] }; }),
    capped: recs.length >= DB.POLICY_LIMIT,
  };
}

function dbCreateContact_(nc, who) {
  var first = dbClean_(nc.first, 40), last = dbClean_(nc.last, 80);
  var email = dbClean_(nc.email, 80).toLowerCase(), mobile = dbClean_(nc.mobile, 40);
  if (!last) throw new Error('A new client needs at least a last name.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('That e-mail address does not look right.');

  /* Last check before a record is made: the same e-mail already on file is
     the same client, whatever the name was typed as. */
  if (email) {
    var same = dbSoql_('SELECT ' + DB_CONTACT_FIELDS + ' FROM Contact WHERE Email = ' + dbQuote_(email) + ' LIMIT 1');
    if (same.length) return { contact: dbContactOut_(same[0]), action: 'Matched by e-mail (not created)' };
  }
  var owner = who.sfUser || dbProp_('DB_SF_OWNER');
  var body = { FirstName: first, LastName: last, Contact_Type__c: 'Client',
               Description: 'Created from the Delivery Book by ' + who.name + '.' };
  if (email) body.Email = email;
  if (mobile) body.MobilePhone = mobile;
  if (dbIsSfId_(owner)) body.OwnerId = owner;
  var made = dbSfFetch_('/sobjects/Contact', { method: 'post', body: body });
  return { contact: { id: made.id, name: (first + ' ' + last).trim(), first: first, last: last, email: email, mobile: mobile },
           action: 'Created' };
}

function dbCreateTask_(d, who) {
  var lines = d.items.map(function (it) {
    return '- ' + it.document + (it.quantity > 1 ? ' x' + it.quantity : '') +
      (it.policy ? ' — ' + it.type + ' ' + it.policy : '');
  });
  var desc = [
    'Delivered ' + d.deliveredText + ' by ' + who.name + ' (' + d.method + ').',
    'Collected by ' + d.collector + ' (' + d.relationship + ').',
    '',
    lines.join('\n'),
    '',
    d.pin ? 'Location: ' + (d.address ? d.address + ' — ' : '') + d.pin : 'Location: not captured (' + d.locationNote + ')',
    d.notes ? 'Notes: ' + d.notes : '',
    'Delivery Book reference ' + d.ref + '.',
  ].filter(function (x, i, a) { return x !== '' || (a[i - 1] !== ''); }).join('\n');
  var body = {
    WhoId: d.contactId,
    Subject: 'Delivery: ' + d.items.map(function (it) { return it.document; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') +
      ' — ' + d.clientName + ' (' + d.ref + ')',
    Status: 'Completed', Priority: 'Normal', Task_Type__c: 'Servicing',
    ActivityDate: Utilities.formatDate(d.deliveredAt, dbTz_(), 'yyyy-MM-dd'),
    Description: desc.slice(0, 31000),
  };
  var firstPf = d.items.filter(function (it) { return dbIsSfId_(it.portfolioId); })[0];
  if (firstPf) body.WhatId = firstPf.portfolioId;
  if (dbIsSfId_(who.sfUser)) body.OwnerId = who.sfUser;
  return dbSfFetch_('/sobjects/Task', { method: 'post', body: body }).id;
}


/* ============================== location ============================== */

function dbKm_(a, b) {
  var R = 6371, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function dbPin_(lat, lng) { return 'https://www.google.com/maps?q=' + lat.toFixed(6) + ',' + lng.toFixed(6); }

/* Apps Script's own Maps service: no key, no account. A failure costs the
   address line, never the delivery. */
function dbReverse_(lat, lng) {
  try {
    var r = Maps.newGeocoder().setRegion('tt').reverseGeocode(lat, lng);
    return r && r.results && r.results[0] ? r.results[0].formatted_address : '';
  } catch (e) { return ''; }
}

function dbGeocode_(text) {
  try {
    var r = Maps.newGeocoder().setRegion('tt').geocode(text + ', Trinidad and Tobago');
    var loc = r && r.results && r.results[0] && r.results[0].geometry && r.results[0].geometry.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch (e) { return null; }
}


/* ============================== files ============================== */

function dbFolder_() {
  var id = dbProp_('DB_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('Delivery Book — signatures and photos');
  dbProps_().setProperty('DB_FOLDER_ID', f.getId());
  return f;
}

function dbSaveImage_(dataUrl, name, maxKb) {
  var m = String(dataUrl || '').match(/^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+\/=]+)$/);
  if (!m) return '';
  var bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > maxKb * 1024) throw new Error('That image is too large. Retake it and try again.');
  var file = dbFolder_().createFile(Utilities.newBlob(bytes, m[1], name + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2])));
  return file.getUrl();
}


/* ============================== submit ============================== */

function dbRef_() {
  var tz = dbTz_();
  var day = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd').replace(/-/g, '').slice(2);
  var tail = Utilities.getUuid().replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return 'DB-' + day + '-' + tail;
}

/* Everything is checked before anything is written, so a half-filled
   delivery is either refused whole or recorded whole. */
function dbValidate_(b) {
  var d = b.delivery || {};
  var out = { flags: [] };

  out.method = DB.METHODS.indexOf(d.method) >= 0 ? d.method : 'In person';
  var when = d.deliveredAt ? new Date(d.deliveredAt) : new Date();
  if (isNaN(when.getTime())) when = new Date();
  if (when.getTime() > Date.now() + 10 * 60000) throw new Error('The delivery time is in the future.');
  out.deliveredAt = when;

  var items = (d.items || []).slice(0, 20).map(function (it) {
    var doc = DB.DOC_TYPES.indexOf(it.document) >= 0 ? it.document : '';
    if (!doc) throw new Error('Choose what was delivered for every item.');
    var q = Math.max(1, Math.min(20, parseInt(it.quantity, 10) || 1));
    return {
      document: doc, quantity: q,
      policy: dbClean_(it.policy, 40), type: dbClean_(it.type, 40).toUpperCase(),
      plan: dbClean_(it.plan, 80), portfolioId: dbIsSfId_(it.portfolioId) ? it.portfolioId : '',
      onRecord: !!it.portfolioId,
    };
  });
  if (!items.length) throw new Error('Tick at least one policy or add an item.');
  items.forEach(function (it) {
    if (!it.policy && it.document !== 'Cheque' && it.document !== 'Other') {
      throw new Error('Every ' + it.document.toLowerCase() + ' needs its policy number.');
    }
    if (it.policy && !it.onRecord) out.flags.push('Policy ' + it.policy + ' not on record in Salesforce');
  });
  out.items = items;

  var cf = dbClean_(d.collectorFirst, 40), cl = dbClean_(d.collectorLast, 60);
  if (!cf || !cl) throw new Error('Enter the first and last name of the person who collected it.');
  out.collector = cf + ' ' + cl;
  out.relationship = DB.RELATIONSHIPS.indexOf(d.relationship) >= 0 ? d.relationship : '';
  if (!out.relationship) throw new Error('Say how the collector is related to the client.');
  if (!/^data:image\/png;base64,/.test(String(d.signature || ''))) throw new Error('The collector has to sign.');

  var hasCheque = items.some(function (it) { return it.document === 'Cheque'; });
  if (hasCheque && !/^data:image\//.test(String(d.photo || ''))) throw new Error('A cheque needs a photo of the handover.');

  var lat = Number(d.lat), lng = Number(d.lng), acc = Number(d.accuracy);
  out.locationNote = dbClean_(d.locationNote, 200);
  if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) {
    out.lat = lat; out.lng = lng; out.accuracy = isFinite(acc) ? Math.round(acc) : '';
    if (out.accuracy && out.accuracy > 200) out.flags.push('Weak GPS (±' + out.accuracy + ' m)');
  } else {
    if (!out.locationNote) throw new Error('Turn on location, or say why it could not be captured.');
    out.flags.push('No GPS: ' + out.locationNote);
  }

  out.notes = dbClean_(d.notes, 500);
  out.clientType = ['Individual', 'Group', 'Business'].indexOf(d.clientType) >= 0 ? d.clientType : 'Individual';
  out.contactId = dbIsSfId_(d.contactId) ? d.contactId : '';
  out.newContact = d.newContact && d.notInSalesforce === true ? d.newContact : null;
  if (!out.contactId && !out.newContact) throw new Error('Pick the client from Salesforce, or tick "Not in Salesforce" and enter them.');
  out.typedEmail = dbClean_(d.email, 80).toLowerCase();
  out.signature = d.signature;
  out.photo = d.photo || '';
  return out;
}

function dbSubmit_(b, who) {
  var d = dbValidate_(b);
  var tz = dbTz_();
  var test = dbMode_() !== 'live';
  d.ref = dbRef_();
  d.deliveredText = Utilities.formatDate(d.deliveredAt, tz, "EEEE d MMMM yyyy 'at' h:mm a");

  /* The client. */
  var client = null, contactAction = '', match = '';
  if (d.contactId) {
    var cs = dbSoql_('SELECT ' + DB_CONTACT_FIELDS + ' FROM Contact WHERE Id = ' + dbQuote_(d.contactId) + ' LIMIT 1');
    if (!cs.length) throw new Error('That client is no longer in Salesforce. Look them up again.');
    client = dbContactOut_(cs[0]);
    match = d.items.some(function (it) { return it.onRecord; }) ? 'Picked, policy on record' : 'Picked by name';
    contactAction = 'Existing';
  } else if (test) {
    var nc = d.newContact;
    client = { id: '', name: (dbClean_(nc.first, 40) + ' ' + dbClean_(nc.last, 80)).trim(),
               first: dbClean_(nc.first, 40), email: dbClean_(nc.email, 80).toLowerCase(),
               mobile: dbClean_(nc.mobile, 40) };
    contactAction = 'Would be created (test mode)';
    match = 'Not in Salesforce';
  } else {
    var made = dbCreateContact_(d.newContact, who);
    client = made.contact; contactAction = made.action; match = 'Not in Salesforce';
  }
  d.contactId = client.id;
  d.clientName = client.name;

  /* An e-mail typed on the spot never overwrites one on file. */
  var email = client.email;
  if (!email && d.typedEmail) {
    email = d.typedEmail;
    if (!test && client.id) {
      try { dbSfFetch_('/sobjects/Contact/' + client.id, { method: 'patch', body: { Email: email } }); contactAction += '; e-mail added'; }
      catch (e) { d.flags.push('Could not save e-mail to Salesforce: ' + e.message); }
    }
  } else if (email && d.typedEmail && d.typedEmail !== email) {
    d.flags.push('E-mail typed (' + d.typedEmail + ') differs from Salesforce; sent to the one on file');
  }

  /* Where. */
  d.pin = ''; d.address = ''; var km = '';
  if (d.lat != null) {
    d.pin = dbPin_(d.lat, d.lng);
    d.address = dbReverse_(d.lat, d.lng);
    var homeText = '';
    if (d.items.length && d.contactId) {
      try {
        var pf = dbSoql_('SELECT Street__c, City__c FROM CLIENT_PORTFOLIO__c WHERE Contact__c = ' + dbQuote_(d.contactId) +
                         ' AND City__c != null LIMIT 1');
        if (pf.length) homeText = [pf[0].Street__c, pf[0].City__c].filter(String).join(', ');
      } catch (e) {}
    }
    var home = homeText ? dbGeocode_(homeText) : null;
    if (home) {
      km = Math.round(dbKm_({ lat: d.lat, lng: d.lng }, home) * 10) / 10;
      if (km > DB.FAR_KM) d.flags.push('Delivered ' + km + ' km from the address on file');
    }
  }

  /* Files. */
  var sigUrl = dbSaveImage_(d.signature, d.ref + '-signature', DB.MAX_SIG_KB);
  var photoUrl = d.photo ? dbSaveImage_(d.photo, d.ref + '-photo', DB.MAX_PHOTO_KB) : '';

  /* The record goes down first, so a Salesforce or mail failure never loses
     the delivery. The status cells are filled in after. */
  var sh = dbDeliveriesTab_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var firstRow;
  try {
    firstRow = sh.getLastRow() + 1;
    var now = new Date();
    var rows = d.items.map(function (it, i) {
      return dbRowFor_(sh, {
        'Reference': d.ref, 'Item': i + 1, 'Logged At': now, 'Delivered At': d.deliveredAt,
        'Delivered By': who.name, 'Method': d.method, 'Client': d.clientName, 'Client Type': d.clientType,
        'Salesforce Contact': d.contactId, 'Client Email': email, 'Client Mobile': client.mobile || '',
        'Policy #': it.policy, 'Record Type': it.type, 'Plan': it.plan, 'Portfolio Id': it.portfolioId,
        'Document': it.document, 'Quantity': it.quantity, 'Notes': d.notes,
        'Collected By': d.collector, 'Relationship': d.relationship,
        'Signature': sigUrl, 'Photo': photoUrl,
        'Latitude': d.lat == null ? '' : d.lat, 'Longitude': d.lng == null ? '' : d.lng,
        'Accuracy (m)': d.accuracy == null ? '' : d.accuracy, 'Pin': d.pin, 'Address': d.address,
        'Distance From Client (km)': km, 'Location Note': d.locationNote,
        'Match': match, 'Contact Action': contactAction, 'Salesforce Task': 'pending',
        'Email Status': 'pending', 'Flags': d.flags.join('; '), 'Source': 'App' + (test ? ' (test)' : ''),
      });
    });
    sh.getRange(firstRow, 1, rows.length, rows[0].length).setValues(rows);
  } finally {
    lock.releaseLock();
  }

  /* Salesforce. */
  var taskOut = '';
  if (test) taskOut = 'Skipped (test mode)';
  else if (!d.contactId) taskOut = 'No contact';
  else {
    try { taskOut = dbCreateTask_(d, who); }
    catch (e) { taskOut = 'Failed: ' + e.message; }
  }

  /* The client. */
  var mail = dbSendConfirmation_(d, client, email, who, test);

  dbSetStatus_(sh, firstRow, d.items.length, {
    'Salesforce Task': taskOut, 'Email Status': mail.status,
    'Email Sent At': mail.sentAt || '', 'Flags': d.flags.join('; '),
  });

  return { ok: true, ref: d.ref, mode: test ? 'test' : 'live', client: d.clientName,
           emailStatus: mail.status, task: taskOut, pin: d.pin, address: d.address,
           distanceKm: km, flags: d.flags, contactAction: contactAction };
}

function dbSetStatus_(sh, firstRow, n, obj) {
  var hm = dbHeaderMap_(sh);
  Object.keys(obj).forEach(function (k) {
    if (!(k in hm.map)) return;
    var vals = [];
    for (var i = 0; i < n; i++) vals.push([obj[k]]);
    sh.getRange(firstRow, hm.map[k] + 1, n, 1).setValues(vals);
  });
}


/* ============================== the client e-mail ============================== */

function dbEsc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* What the client reads. No GPS, no pin, no address: those are ours. */
function dbConfirmationHtml_(d, client, who) {
  var first = client.first || String(client.name || '').split(' ')[0] || 'there';
  var rows = d.items.map(function (it) {
    return '<tr><td style="padding:8px 10px;border-bottom:1px solid #e6ebf1">' + dbEsc_(it.document) +
      (it.quantity > 1 ? ' &times; ' + it.quantity : '') + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e6ebf1;white-space:nowrap">' + dbEsc_(it.policy || '—') + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e6ebf1">' + dbEsc_(it.type ? it.type.charAt(0) + it.type.slice(1).toLowerCase() : '') + '</td></tr>';
  }).join('');
  var collector = d.relationship === 'Self' ? 'you' : dbEsc_(d.collector) + ' (' + dbEsc_(d.relationship.toLowerCase()) + ')';
  return '' +
    '<div style="background:#f3f5f8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#13202e">' +
    '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">' +
    '<div style="background:#07131f;padding:18px 22px">' +
    '<img src="' + DB.LOGO + '" width="40" height="40" alt="" style="vertical-align:middle;border-radius:9px">' +
    '<span style="color:#efc24b;font-weight:bold;font-size:16px;margin-left:12px;vertical-align:middle">' + DB.BRAND + '</span></div>' +
    '<div style="padding:24px 22px;font-size:15px;line-height:1.6">' +
    '<p style="margin:0 0 14px">Dear ' + dbEsc_(first) + ',</p>' +
    '<p style="margin:0 0 14px">This confirms the delivery made to you on <b>' + dbEsc_(d.deliveredText) + '</b>.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px">' +
    '<tr style="background:#f6f8fb"><th align="left" style="padding:8px 10px">Item</th><th align="left" style="padding:8px 10px">Policy</th><th align="left" style="padding:8px 10px">Type</th></tr>' +
    rows + '</table>' +
    '<p style="margin:0 0 14px">It was received by ' + collector + ' and delivered by ' + dbEsc_(who.name) + ' of our team.</p>' +
    dbStarsHtml_(d.ref, who.name) +
    '<p style="margin:0 0 14px">If anything here is not right, or you have not received it, reply to this e-mail and we will put it right.</p>' +
    '<p style="margin:0 0 4px">With thanks,</p><p style="margin:0">' + DB.BRAND + '</p></div>' +
    '<div style="padding:12px 22px;background:#f6f8fb;color:#5b6b7f;font-size:12px">Reference ' + dbEsc_(d.ref) + '</div>' +
    '</div></div>';
}

function dbSendConfirmation_(d, client, email, who, test) {
  if (!email) return { status: 'No e-mail on file' };
  var to = email, html = dbConfirmationHtml_(d, client, who);
  var subject = 'Delivery confirmation — ' + d.items.map(function (it) { return it.document; })
    .filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + ' (' + d.ref + ')';
  if (test) {
    to = dbProp_('DB_TEST_INBOX') || Session.getEffectiveUser().getEmail();
    subject = '[TEST] ' + subject;
    html = '<div style="background:#fff4d6;border:1px solid #efc24b;padding:10px 14px;font-family:Arial;font-size:13px">' +
      'TEST — in live mode this would have gone to <b>' + dbEsc_(email) + '</b>.</div>' + html;
  }
  try {
    if (MailApp.getRemainingDailyQuota && MailApp.getRemainingDailyQuota() < 1) {
      return { status: 'Held: daily mail limit reached' };
    }
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: DB.BRAND,
                        replyTo: dbProp_('DB_REPLY_TO', DB.SALES_SUPPORT) });
    return { status: test ? 'Test copy sent' : 'Sent', sentAt: new Date() };
  } catch (e) {
    return { status: 'Failed: ' + e.message };
  }
}


/* ============================== the star rating ============================== */
/*
 * Asked for on 15 October 2026: "create an experience star rating to rate
 * the user, so when the client gets the email they can add a rating of our
 * service". Five stars in the e-mail, each a link. One tap records it and
 * opens a thank-you page where the client can add a comment. Tapping again
 * changes the rating; one delivery holds one rating.
 *
 * Each link is signed with the delivery's reference, so a link cannot be
 * edited into a rating for somebody else's delivery.
 */

function dbNoteExecUrl_() {
  try {
    if (dbProp_('DB_EXEC_URL')) return;
    var u = ScriptApp.getService().getUrl();
    if (u && /\/exec$/.test(u)) dbProps_().setProperty('DB_EXEC_URL', u);
  } catch (e) {}
}

function dbExecUrl_() {
  var u = dbProp_('DB_EXEC_URL');
  if (u) return u;
  try { u = ScriptApp.getService().getUrl(); } catch (e) { u = ''; }
  return u && /\/exec$/.test(u) ? u : '';
}

function dbSecret_() {
  var s = dbProp_('DB_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); dbProps_().setProperty('DB_SECRET', s); }
  return s;
}

function dbSign_(ref) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('rate|' + ref, dbSecret_()))
    .replace(/=+$/, '').slice(0, 22);
}

function dbRateLink_(ref, stars) {
  var u = dbExecUrl_();
  return u ? u + '?rate=' + encodeURIComponent(ref) + '&s=' + stars + '&k=' + dbSign_(ref) : '';
}

/* Five gold stars, each a link, read left to right as 1 to 5. Text stars,
   not images: a mail app that blocks images still shows them. */
function dbStarsHtml_(ref, staffName) {
  if (!dbExecUrl_()) return '';
  var stars = [1, 2, 3, 4, 5].map(function (n) {
    return '<a href="' + dbEsc_(dbRateLink_(ref, n)) + '" title="' + n + ' star' + (n > 1 ? 's' : '') +
      '" style="color:#e2a71e;text-decoration:none;font-size:34px;line-height:1;padding:0 3px">&#9733;</a>';
  }).join('');
  var who = String(staffName || '').split(' ')[0] || 'our team';
  return '<div style="margin:18px 0;padding:16px;border:1px solid #efe2bd;background:#fffaf0;border-radius:10px;text-align:center">' +
    '<div style="font-size:15px;font-weight:bold;margin-bottom:4px">How did ' + dbEsc_(who) + ' do?</div>' +
    '<div style="font-size:13px;color:#5b6b7f;margin-bottom:10px">Tap a star. 1 is poor, 5 is excellent.</div>' +
    '<div>' + stars + '</div></div>';
}

function dbRatingsTab_() { return dbSheet_(DB.TABS.RATINGS, DB_RATING_COLUMNS); }

/* The delivery behind a reference: who delivered it, to whom, test or live. */
function dbDeliveryFor_(ref) {
  var sh = dbDeliveriesTab_();
  var hm = dbHeaderMap_(sh);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var refs = sh.getRange(2, hm.map['Reference'] + 1, last - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]) !== ref) continue;
    var row = sh.getRange(i + 2, 1, 1, hm.head.length).getValues()[0];
    return { by: String(row[hm.map['Delivered By']] || ''), client: String(row[hm.map['Client']] || ''),
             test: /test/i.test(String(row[hm.map['Source']] || '')) };
  }
  return null;
}

function dbSaveRating_(ref, stars, comment) {
  var del = dbDeliveryFor_(ref);
  if (!del) return null;
  var sh = dbRatingsTab_();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var last = sh.getLastRow();
    var refs = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
    var at = -1;
    for (var i = 0; i < refs.length; i++) if (String(refs[i][0]) === ref) { at = i + 2; break; }
    var now = new Date();
    if (at < 0) {
      sh.appendRow([ref, stars || '', comment || '', del.by, del.client, now, now, del.test ? 'yes' : '']);
    } else {
      if (stars) sh.getRange(at, 2).setValue(stars);
      if (comment != null && comment !== '') sh.getRange(at, 3).setValue(comment);
      sh.getRange(at, 7).setValue(now);
    }
  } finally { lock.releaseLock(); }
  return del;
}

function dbHtml_(inner) {
  var page = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + DB.BRAND + '</title><style>' +
    'body{margin:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#13202e}' +
    '.card{max-width:460px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden}' +
    '.top{background:#07131f;padding:16px 20px;color:#efc24b;font-weight:bold}' +
    '.top img{width:36px;height:36px;border-radius:8px;vertical-align:middle;margin-right:10px}' +
    '.in{padding:22px 20px;line-height:1.55}h1{font-size:20px;margin:0 0 10px}' +
    '.stars{font-size:38px;color:#e2a71e;letter-spacing:4px;margin:6px 0 12px}.stars a{color:inherit;text-decoration:none}' +
    '.off{color:#d5dbe3}textarea{width:100%;box-sizing:border-box;min-height:96px;padding:10px;border:1px solid #cdd5df;border-radius:10px;font:inherit}' +
    'button{margin-top:10px;width:100%;padding:13px;border:0;border-radius:10px;background:#07131f;color:#efc24b;font-weight:bold;font-size:15px}' +
    '.muted{color:#5b6b7f;font-size:13px}</style></head><body><div class="card">' +
    '<div class="top"><img src="' + DB.LOGO + '" alt="">' + DB.BRAND + '</div><div class="in">' + inner + '</div></div></body></html>';
  return HtmlService.createHtmlOutput(page).addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle(DB.BRAND);
}

function dbRatePage_(p) {
  var ref = dbClean_(p.rate, 30);
  var ok = ref && String(p.k || '') === dbSign_(ref);
  if (!ok) return dbHtml_('<h1>This link has expired</h1><p>Reply to our e-mail and tell us how we did. We read every reply.</p>');
  var stars = Math.max(0, Math.min(5, parseInt(p.s, 10) || 0));
  var comment = p.c != null ? dbClean_(p.c, 1000) : null;
  var del = dbSaveRating_(ref, stars, comment);
  if (!del) return dbHtml_('<h1>Thank you</h1><p>We could not find that delivery. Reply to our e-mail and tell us how we did.</p>');

  var first = String(del.by || '').split(' ')[0] || 'our team';
  var row = [1, 2, 3, 4, 5].map(function (n) {
    return '<a href="' + dbEsc_(dbRateLink_(ref, n)) + '" class="' + (n <= stars ? '' : 'off') + '">&#9733;</a>';
  }).join('');
  if (comment != null && comment !== '') {
    return dbHtml_('<h1>Thank you</h1><div class="stars">' + row + '</div>' +
      '<p>Your comment has been passed to the branch.</p>');
  }
  var exec = dbExecUrl_();
  return dbHtml_('<h1>Thank you for rating ' + dbEsc_(first) + '</h1>' +
    '<div class="stars">' + row + '</div>' +
    '<p class="muted">Tap a different star to change it.</p>' +
    '<form method="get" action="' + dbEsc_(exec) + '" target="_top">' +
    '<input type="hidden" name="rate" value="' + dbEsc_(ref) + '">' +
    '<input type="hidden" name="s" value="' + stars + '">' +
    '<input type="hidden" name="k" value="' + dbEsc_(String(p.k)) + '">' +
    '<p><b>Anything you would like to add?</b> (optional)</p>' +
    '<textarea name="c" maxlength="1000" placeholder="What went well, or what we could do better"></textarea>' +
    '<button type="submit">Send comment</button></form>');
}

/* Ratings by reference, for the book; and each person's average. */
function dbRatings_() {
  var sh = dbRatingsTab_();
  var last = sh.getLastRow();
  var byRef = {};
  if (last < 2) return byRef;
  sh.getRange(2, 1, last - 1, DB_RATING_COLUMNS.length).getValues().forEach(function (r) {
    var s = Number(r[1]) || 0;
    if (s) byRef[String(r[0])] = { stars: s, comment: String(r[2] || ''), by: String(r[3] || ''), test: r[7] === 'yes' };
  });
  return byRef;
}


/* ============================== the book ============================== */

/** Recent deliveries for the list and the map. Signatures and photos stay
 *  in Drive; the manager gets the links, everybody else whether they exist. */
function dbBook_(b, who) {
  var days = Math.max(1, Math.min(400, parseInt(b.days, 10) || 90));
  var since = new Date(Date.now() - days * 86400000);
  var sh = dbDeliveriesTab_();
  var hm = dbHeaderMap_(sh);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, deliveries: [] };
  var vals = sh.getRange(2, 1, last - 1, hm.head.length).getValues();
  var manager = /manager/i.test(who.role);
  var byRef = {}, order = [];
  vals.forEach(function (r) {
    var g = function (k) { return k in hm.map ? r[hm.map[k]] : ''; };
    var when = g('Delivered At');
    if (!(when instanceof Date) || when < since) return;
    var ref = String(g('Reference'));
    if (!byRef[ref]) {
      byRef[ref] = {
        ref: ref, deliveredAt: when.toISOString(), by: String(g('Delivered By')), method: String(g('Method')),
        client: String(g('Client')), collector: String(g('Collected By')), relationship: String(g('Relationship')),
        lat: g('Latitude') === '' ? null : Number(g('Latitude')), lng: g('Longitude') === '' ? null : Number(g('Longitude')),
        accuracy: g('Accuracy (m)'), pin: String(g('Pin')), address: String(g('Address')),
        km: g('Distance From Client (km)'), email: String(g('Email Status')), task: String(g('Salesforce Task')),
        flags: String(g('Flags')), source: String(g('Source')),
        signed: !!g('Signature'), photo: !!g('Photo'), items: [],
      };
      if (manager) { byRef[ref].signatureUrl = String(g('Signature')); byRef[ref].photoUrl = String(g('Photo')); }
      order.push(ref);
    }
    byRef[ref].items.push({ document: String(g('Document')), policy: String(g('Policy #')),
                            type: String(g('Record Type')), quantity: g('Quantity') || 1 });
  });
  /* Stars are on every row for everybody; what a client wrote is for the
     manager, because it may be about the person reading the list. */
  var ratings = dbRatings_();
  var people = {};
  order.forEach(function (k) {
    var r = ratings[k];
    if (!r) return;
    byRef[k].stars = r.stars;
    if (manager && r.comment) byRef[k].comment = r.comment;
    if (r.test) return;
    var p = people[byRef[k].by] = people[byRef[k].by] || { name: byRef[k].by, n: 0, sum: 0 };
    p.n++; p.sum += r.stars;
  });
  var team = Object.keys(people).map(function (k) {
    var p = people[k];
    return { name: p.name, ratings: p.n, average: Math.round(p.sum / p.n * 10) / 10 };
  }).sort(function (a, c) { return c.ratings - a.ratings; });

  var out = order.map(function (k) { return byRef[k]; })
    .sort(function (a, c) { return a.deliveredAt < c.deliveredAt ? 1 : -1; });
  return { ok: true, deliveries: out, team: team };
}


/* ============================== history ============================== */

/**
 * Copies the Jotform rows into Deliveries once, so the list and the map show
 * the book from its first page. Run it from the editor. Safe to run again:
 * a Jotform submission already copied is skipped. No e-mail, no Salesforce.
 */
function importJotformHistory() {
  var ss = SpreadsheetApp.getActive();
  var old = ss.getSheetByName(DB.TABS.OLD);
  if (!old) return 'No "' + DB.TABS.OLD + '" tab.';
  var oh = dbHeaderMap_(old);
  var last = old.getLastRow();
  if (last < 2) return 'Nothing to import.';
  var vals = old.getRange(2, 1, last - 1, oh.head.length).getValues();
  var sh = dbDeliveriesTab_();
  var hm = dbHeaderMap_(sh);
  var have = {};
  var dl = sh.getLastRow();
  if (dl > 1) sh.getRange(2, hm.map['Reference'] + 1, dl - 1, 1).getValues().forEach(function (r) { have[String(r[0])] = 1; });

  var col = function (r, name, nth) {
    var hits = [];
    oh.head.forEach(function (h, i) { if (String(h).trim() === name) hits.push(i); });
    var i = hits[nth || 0];
    return i == null ? '' : r[i];
  };
  var rows = [];
  vals.forEach(function (r) {
    var id = String(col(r, 'Submission ID') || '').trim();
    if (!id || have['JF-' + id]) return;
    var parsed = dbParseJotformList_(String(col(r, 'Configurable list') || ''));
    var geo = dbParseGeo_(String(col(r, 'Geo Stamp') || ''));
    var when = dbParseJotformDate_(String(col(r, 'Delivery Date & Time') || '')) || col(r, 'Submission Date');
    var cf = String(col(r, 'Person Collected the Documents - First Name') || '').trim();
    var cl = String(col(r, 'Person Collected the Documents - Last Name') || '').trim();
    var flags = [];
    if (!col(r, 'Signature of Person Recieving')) flags.push('No signature');
    if (!cf || !cl) flags.push('Collector name incomplete');
    if (!geo) flags.push('No GPS');
    rows.push(dbRowFor_(sh, {
      'Reference': 'JF-' + id, 'Item': 1, 'Logged At': col(r, 'Submission Date'), 'Delivered At': when,
      'Delivered By': String(col(r, 'Delivered by') || col(r, 'Delivered by ') || '').trim(), 'Method': 'In person',
      'Client': (String(col(r, 'Client Name - First Name') || '') + ' ' + String(col(r, 'Client Name - Last Name') || '')).trim(),
      'Client Email': String(col(r, "Client's Email") || ''),
      'Policy #': parsed.policy, 'Document': parsed.document || 'Other', 'Quantity': 1,
      'Collected By': (cf + ' ' + cl).trim(), 'Signature': String(col(r, 'Signature of Person Recieving') || ''),
      'Photo': String(col(r, 'File Upload') || ''),
      'Latitude': geo ? geo.lat : '', 'Longitude': geo ? geo.lng : '',
      'Pin': geo ? dbPin_(geo.lat, geo.lng) : '', 'Address': geo ? geo.address : '',
      'Match': 'Not matched (imported)', 'Salesforce Task': 'Not logged (imported)', 'Email Status': 'Not sent (imported)',
      'Flags': flags.join('; '), 'Source': 'Jotform',
    }));
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return 'Imported ' + rows.length + ' Jotform deliveries.';
}

/* "Client Name: X , Policy #: TT APU 0100004, Document: Certificate" */
function dbParseJotformList_(s) {
  var pol = (s.match(/Policy\s*#\s*:\s*([^,]+)/i) || [])[1] || '';
  var doc = ((s.match(/Document\s*:\s*([^,]+)/i) || [])[1] || '').trim();
  var known = DB.DOC_TYPES.filter(function (t) { return t.toLowerCase() === doc.toLowerCase(); })[0];
  return { policy: pol.trim(), document: known || (doc ? 'Other' : '') };
}

function dbParseGeo_(s) {
  var lat = (s.match(/Latitude:\s*(-?\d+(?:\.\d+)?)/i) || [])[1];
  var lng = (s.match(/Longitude:\s*(-?\d+(?:\.\d+)?)/i) || [])[1];
  if (lat == null || lng == null) return null;
  var parts = ['Street', 'City', 'Region'].map(function (k) {
    return ((s.match(new RegExp(k + ':\\s*([^\\n]+)', 'i')) || [])[1] || '').trim();
  }).filter(String);
  return { lat: Number(lat), lng: Number(lng), address: parts.join(', ') };
}

/* "08-18-2026 11:53 AM" */
function dbParseJotformDate_(s) {
  var m = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  var h = Number(m[4]) % 12 + (/pm/i.test(m[6]) ? 12 : 0);
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h, Number(m[5]));
}


/* ============================== editor ============================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('RR Operations')
    .addItem('Check setup', 'dbSetupCheck')
    .addItem('Import the Jotform history', 'importJotformHistory')
    .addToUi();
}

/** Makes the tabs and says what is still missing. */
function dbSetupCheck() {
  dbDeliveriesTab_();
  dbSheet_(DB.TABS.ACCESS, DB_ACCESS_COLUMNS);
  dbSheet_(DB.TABS.SESS, DB_SESS_COLUMNS);
  dbRatingsTab_();
  var notes = ['Mode: ' + dbMode_()];
  notes.push(dbExecUrl_() ? 'Star links: ' + dbExecUrl_() : 'Star links: off until the web app is deployed (or set DB_EXEC_URL)');
  notes.push(dbSfConfigured_() ? 'Salesforce: set' : 'Salesforce: SF_KEY / SF_SECRET / SF_LOGIN_URL missing');
  if (dbSfConfigured_()) {
    try { dbSfToken_(true); notes.push('Salesforce sign-in: OK'); }
    catch (e) { notes.push('Salesforce sign-in: ' + e.message); }
  }
  notes.push('Test inbox: ' + (dbProp_('DB_TEST_INBOX') || '(script owner)'));
  notes.push('New-contact owner: ' + (dbProp_('DB_SF_OWNER') || '(the Connected App\'s Run As user)'));
  var msg = notes.join('\n');
  try { SpreadsheetApp.getUi().alert('Delivery Book\n\n' + msg); } catch (e) {}
  return msg;
}
