/**
 * ============================================================
 *  MOTOR QUOTE — backend
 *  Ricky Rampersad Branch · rickyrampersadbranch.com/motor-quote/
 * ============================================================
 *
 *  Replaces the " Motor Quotation" JotForm (21 October 2026: "Motor Quotes
 *  was previous a jot form and now need to enhance this to create the client
 *  experience, so a client logs in, the data read from Salesforce if he is
 *  an existing client by his email, if not a contact is created, then asks
 *  data that will generate a motor quote as this goes to
 *  CRMSQuotes@guardianonline.onmicrosoft.com").
 *
 *  THE JOURNEY
 *   1. The client types their e-mail. A six-digit code goes to that inbox
 *      (no passwords anywhere: the claims portal's pattern).
 *   2. The code opens a session. Salesforce is asked for the Contact with
 *      that e-mail, their motor policies (CLIENT_PORTFOLIO__c, MOTOR record
 *      type) and their vehicles (Risk_Details__c). An existing client sees
 *      their own vehicles and picks one, or adds a new one; what we already
 *      hold (name, mobile, occupation, date of birth, make, model, year,
 *      cover, sum insured, no-claim history) is filled in for them.
 *   3. The page asks only what the quote needs that we do not hold. Every
 *      question the old JotForm asked is still asked, in a short flow.
 *   4. Send: one row on the "Motor Quotes" tab (MQ-yyMMdd-nnn), the permit
 *      and certified copy into Drive, one e-mail to CRMSQuotes from
 *      support@rickyrampersadbranch.com with the branch copied and the
 *      documents attached, one receipt to the client with the reference,
 *      and one Salesforce task on the Contact so the quote is chased until
 *      it comes back. A client not in Salesforce gets a Contact created at
 *      this point, when we hold a name, never on the sign-in alone.
 *   5. A client who signs in again sees every request they have made and
 *      where each stands (the Status column, kept by staff).
 *
 *  THIS IS ITS OWN PROJECT (own Google Sheet, own /exec), like the Delivery
 *  Book and the essay workshop. Do not paste it beside Claims.gs or
 *  Service.gs: each has its own doGet/doPost.
 *
 *  SETUP: MOTOR-QUOTE-SETUP.md.
 *
 *  TEST MODE IS THE DEFAULT (MQ_MODE unset): every e-mail goes to the test
 *  inbox with a banner saying who it was for, and Salesforce is read but
 *  never written. Set MQ_MODE = live when the manager says so.
 * ============================================================
 */

var MQ = {
  VERSION: '2026-10-21a',
  BRAND: 'Ricky Rampersad Branch',
  LOGO: 'https://rickyrampersadbranch.com/logo-mark.png',   // hosted PNG: Gmail strips SVG and data URIs
  SITE: 'https://rickyrampersadbranch.com/motor-quote/',

  /* Where a quote request goes. Guardian General's quotes desk, as the
     JotForm had it. */
  QUOTES_TO: 'CRMSQuotes@guardianonline.onmicrosoft.com',
  /* Always copied: sales support and the branch mailbox, so the branch holds
     the thread and a reply reaches a person. */
  CC: ['rickyrampersadsalessupport@myguardiangroup.com', 'support@rickyrampersadbranch.com'],
  SUPPORT_FROM: 'support@rickyrampersadbranch.com',
  BRANCH_TEL: '(868) 226-6461',

  /* The page sends this with every request. Not a secret (it is in the
     page): it only stops a stale copy of the page talking to a new script. */
  SITE_KEY: 'rrb-motor-quote-1',

  SF_API: 'v60.0',
  SF_LOGIN: 'https://login.salesforce.com',

  CODE_TTL_MIN: 10, CODE_MAX_TRIES: 5, CODE_SENDS_PER_HOUR: 4,
  SESSION_DAYS: 30,
  MAX_FILE_BYTES: 6 * 1024 * 1024, MAX_FILES: 3,
  TASK_DUE_DAYS: 2,

  TABS: { quotes: 'Motor Quotes', files: 'Quote Files', log: 'Quote Log', sessions: 'Sessions' },
};

var MQ_COLS = ['Ref', 'Received', 'Status', 'Client', 'Email', 'Mobile', 'Contact Id', 'Contact action',
  'Agent', 'Agent e-mail', 'Owner type', 'Company', 'Company e-mail',
  'Vehicle #', 'Make', 'Model', 'Year', 'Body type', 'Seating', 'CC', 'Value', 'New or used', 'Mortgaged', 'Institution',
  'Cover', 'Windscreen', 'Existing policy', 'Existing GG vehicles', 'Previous insurer', 'NCD', 'Driving years',
  'Gender', 'Date of birth', 'Occupation', 'Permit #', 'Permit issued', 'Permit expires', 'Accidents', 'Accident details',
  'Notes', 'Files', 'Drive folder', 'SF task', 'Sent to', 'Mail result', 'Quoted on', 'Quoted premium', 'Staff note'];

/* The questions, in the order the e-mail to the quotes desk lists them. Each
   key is a field the page sends; the label is what the desk reads. */
var MQ_FIELDS = [
  ['section', 'The client'],
  ['name', 'Client name'], ['email', 'E-mail'], ['mobile', 'Mobile'], ['gender', 'Gender'], ['dob', 'Date of birth'],
  ['occupation', 'Occupation'], ['ownerType', 'Vehicle owned by'], ['company', 'Company name'], ['companyEmail', 'Company e-mail'],
  ['agent', 'Agent'], ['agentEmail', 'Agent e-mail'],
  ['section', 'The vehicle'],
  ['reg', 'Vehicle #'], ['make', 'Make'], ['model', 'Model'], ['year', 'Year of manufacture'], ['body', 'Body type'],
  ['seating', 'Seating'], ['cc', 'CC rating'], ['value', 'Vehicle value (TT$)'], ['condition', 'New or used'],
  ['mortgaged', 'Mortgaged'], ['institution', 'Financial institution'],
  ['section', 'The cover'],
  ['cover', 'Cover type'], ['windscreen', 'Windscreen cover'], ['existingPolicy', 'Adding to existing policy'],
  ['existingVehicles', 'Existing vehicles with Guardian General'], ['prevInsurer', 'Previous insurer'],
  ['ncd', 'No claim discount'], ['drivingYears', 'Years driving'],
  ['section', 'The driver'],
  ['permit', "Driver's permit #"], ['permitIssued', 'Permit issued'], ['permitExpires', 'Permit expires'],
  ['accidents', 'Any accidents'], ['accidentDetails', 'Accident details'],
  ['section', 'Anything else'],
  ['notes', 'Other notes'],
];

var MQ_REQUIRED = ['name', 'email', 'mobile', 'reg', 'make', 'model', 'year', 'value', 'cover', 'permit', 'drivingYears'];

/* ============================== web ============================== */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'ping') return mqJson_(mqPing_());
  return HtmlService.createHtmlOutput('<p style="font-family:Arial">Motor quote backend ' + MQ.VERSION +
    '. The page is <a href="' + MQ.SITE + '">' + MQ.SITE + '</a>.</p>');
}

function doPost(e) {
  var b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return mqJson_({ ok: false, error: 'Could not read the request.' }); }
  if (mqClean_(b.siteKey, 80) !== MQ.SITE_KEY) {
    return mqJson_({ ok: false, error: 'This page is out of date. Refresh it and try again.' });
  }
  var out;
  try {
    switch (b.action) {
      case 'ping':        out = mqPing_(); break;
      case 'requestCode': out = mqRequestCode_(b); break;
      case 'verifyCode':  out = mqVerifyCode_(b); break;
      case 'me':          out = mqMe_(b); break;
      case 'submit':      out = mqSubmit_(b); break;
      case 'signOut':     out = mqSignOut_(b); break;
      default:            out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    mqLog_('(error)', b.action || '?', String(err && err.stack || err));
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return mqJson_(out);
}

function mqPing_() {
  return { ok: true, version: MQ.VERSION, mode: mqMode_(), salesforce: mqSfReady_(), graph: mqGraphReady_(),
           quotesTo: MQ.QUOTES_TO };
}

function mqJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================== settings ============================== */

function mqProps_() { return PropertiesService.getScriptProperties(); }
function mqProp_(k, d) { var v = mqProps_().getProperty(k); return v == null || v === '' ? (d == null ? '' : d) : v; }
function mqMode_() { return String(mqProp_('MQ_MODE', 'test')).toLowerCase() === 'live' ? 'live' : 'test'; }
function mqTestInbox_() { return mqProp_('MQ_TEST_INBOX') || Session.getEffectiveUser().getEmail(); }
function mqQuotesTo_() { return mqProp_('MQ_QUOTES_TO', MQ.QUOTES_TO); }
function mqCc_() {
  var extra = mqProp_('MQ_CC');
  return MQ.CC.concat(extra ? extra.split(/[,;\s]+/) : []).filter(function (x) { return /@/.test(x); });
}
function mqClean_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 200); }
function mqEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function mqEmailOk_(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(e || '')); }
function mqNormEmail_(e) { return mqClean_(e, 120).toLowerCase(); }
function mqTz_() {
  try { return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'America/Port_of_Spain'; }
  catch (e) { return 'America/Port_of_Spain'; }
}
function mqHash_(s) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return raw.map(function (b) { b = b < 0 ? b + 256 : b; return (b < 16 ? '0' : '') + b.toString(16); }).join('');
}
function mqToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}
function mqDate_(d, f) { return Utilities.formatDate(d || new Date(), mqTz_(), f || 'd MMMM yyyy, h:mm a'); }
function mqIsSfId_(v) { return /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(String(v || '')); }

/* ============================== sheet ============================== */

function mqSs_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function mqSheet_(name, headers) {
  var ss = mqSs_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); }
  if (sh.getLastRow() === 0 && headers && headers.length) {
    sh.appendRow(headers);
    try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold'); } catch (e) {}
  }
  return sh;
}
function mqQuotesSheet_() { return mqSheet_(MQ.TABS.quotes, MQ_COLS); }
function mqFilesSheet_() { return mqSheet_(MQ.TABS.files, ['Ref', 'Name', 'Kind', 'Bytes', 'Drive id', 'Uploaded']); }
function mqLogSheet_() { return mqSheet_(MQ.TABS.log, ['When', 'Ref', 'Event', 'Details']); }
function mqSessionsSheet_() { return mqSheet_(MQ.TABS.sessions, ['Token hash', 'Email', 'Created', 'Expires', 'Contact Id', 'Name']); }

function mqLog_(ref, event, details) {
  try { mqLogSheet_().appendRow([new Date(), ref, event, String(details || '').slice(0, 2000)]); } catch (e) {}
}

function mqHeaderMap_(sh) {
  var h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0], m = {};
  h.forEach(function (n, i) { m[String(n).trim()] = i; });
  return m;
}

/** MQ-yyMMdd-nnn: the day's count read off the tab, under the script lock. */
function mqNewRef_() {
  var day = mqDate_(new Date(), 'yyMMdd');
  var sh = mqQuotesSheet_(), n = 0;
  if (sh.getLastRow() > 1) {
    var refs = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    refs.forEach(function (r) { if (String(r[0]).indexOf('MQ-' + day + '-') === 0) n++; });
  }
  return 'MQ-' + day + '-' + ('00' + (n + 1)).slice(-3);
}

/* ============================== sign-in ============================== */

/** Anyone may sign in with their e-mail: a new client is welcome. The code
 *  goes to the address typed, and the answer is the same whatever the
 *  address, so nothing says who is or is not a client. */
function mqRequestCode_(b) {
  var email = mqNormEmail_(b.email);
  if (!mqEmailOk_(email)) return { ok: false, error: 'Please type a full e-mail address.' };
  var cache = CacheService.getScriptCache(), slot = 'mq.sends.' + mqHash_(email);
  var generic = { ok: true, sent: true, message: 'Your sign-in code is on its way to ' + email + '. It works for ' + MQ.CODE_TTL_MIN + ' minutes.' };
  if (Number(cache.get(slot) || 0) >= MQ.CODE_SENDS_PER_HOUR) return generic;
  var code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('mq.code.' + mqHash_(email), JSON.stringify({ code: code, tries: 0 }), MQ.CODE_TTL_MIN * 60);
  cache.put(slot, String(Number(cache.get(slot) || 0) + 1), 3600);
  mqMail_({
    to: [email], subject: code + ' is your motor quote sign-in code',
    html: mqWrap_('Your sign-in code',
      '<p>Your sign-in code for the motor quote is:</p>' +
      '<p style="background:#f6f1e3;border:1px solid #e3d3a6;border-radius:10px;padding:16px;text-align:center">' +
      '<b style="font-size:30px;letter-spacing:8px;color:#07131f">' + code + '</b></p>' +
      '<p>It works for ' + MQ.CODE_TTL_MIN + ' minutes. If you did not ask for it, ignore this e-mail: nobody can get in without the code in your inbox.</p>'),
    client: true,
  });
  return generic;
}

function mqVerifyCode_(b) {
  var email = mqNormEmail_(b.email);
  if (!mqEmailOk_(email)) return { ok: false, error: 'Please type the e-mail you asked the code for.' };
  var cache = CacheService.getScriptCache(), slot = 'mq.code.' + mqHash_(email);
  var raw = cache.get(slot);
  if (!raw) return { ok: false, error: 'That code has expired. Ask for a fresh one.' };
  var rec = JSON.parse(raw);
  if (rec.tries >= MQ.CODE_MAX_TRIES) { cache.remove(slot); return { ok: false, error: 'Too many tries. Ask for a fresh code.' }; }
  if (String(b.code || '').replace(/\D/g, '') !== rec.code) {
    rec.tries++;
    cache.put(slot, JSON.stringify(rec), MQ.CODE_TTL_MIN * 60);
    return { ok: false, error: 'That code did not match. Check the e-mail and try again.' };
  }
  cache.remove(slot);
  var me = mqLookup_(email);
  var token = mqNewSession_(email, me.contactId, me.name);
  mqLog_('(sign-in)', me.found ? 'client-signed-in' : 'new-signed-in', email + (me.found ? ' · ' + me.name : ''));
  return { ok: true, token: token, me: me, requests: mqRequests_(email), mode: mqMode_() };
}

function mqNewSession_(email, contactId, name) {
  var token = mqToken_(), now = new Date();
  mqSessionsSheet_().appendRow([mqHash_(token), email, now, new Date(now.getTime() + MQ.SESSION_DAYS * 86400000),
    contactId || '', name || '']);
  mqPruneSessions_();
  return token;
}

function mqSession_(token) {
  token = mqClean_(token, 80);
  if (token.length < 20) return null;
  var sh = mqSessionsSheet_();
  if (sh.getLastRow() < 2) return null;
  var h = mqHash_(token), rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues(), now = new Date().getTime();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]) === h) {
      var exp = new Date(rows[i][3]).getTime();
      if (exp && exp < now) return null;
      return { row: i + 2, email: String(rows[i][1]).toLowerCase(), contactId: String(rows[i][4] || ''), name: String(rows[i][5] || '') };
    }
  }
  return null;
}

function mqPruneSessions_() {
  var sh = mqSessionsSheet_();
  if (sh.getLastRow() < 200) return;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues(), now = new Date().getTime();
  for (var i = rows.length - 1; i >= 0; i--) {
    var exp = new Date(rows[i][3]).getTime();
    if (exp && exp < now) sh.deleteRow(i + 2);
  }
}

function mqSignOut_(b) {
  var s = mqSession_(b.token);
  if (s) mqSessionsSheet_().deleteRow(s.row);
  return { ok: true };
}

/** Everything the signed-in page needs, read again. */
function mqMe_(b) {
  var s = mqSession_(b.token);
  if (!s) return { ok: false, error: 'Please sign in again.', signedOut: true };
  var me = mqLookup_(s.email);
  return { ok: true, me: me, requests: mqRequests_(s.email), mode: mqMode_() };
}

/* ============================== Salesforce ============================== */

/* Client credentials, as the KPI Tracker and the Service Questionnaire sign
   in (the org retired the username-password flow). SF_KEY, SF_SECRET and
   SF_LOGIN_URL (the My Domain address) are Script properties, copied from
   the KPI Tracker. */
function mqSfReady_() { return !!(mqProp_('SF_KEY') && mqProp_('SF_SECRET')); }

function mqSfToken_(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) { var c = cache.get('mq_sf_tok'); if (c) return JSON.parse(c); }
  var payload = { grant_type: 'client_credentials', client_id: mqProp_('SF_KEY'), client_secret: mqProp_('SF_SECRET') };
  if (mqProp_('SF_PASS')) {
    payload = { grant_type: 'password', client_id: mqProp_('SF_KEY'), client_secret: mqProp_('SF_SECRET'),
                username: mqProp_('SF_USER'), password: mqProp_('SF_PASS') };
  }
  var login = String(mqProp_('SF_LOGIN_URL', MQ.SF_LOGIN)).replace(/\/+$/, '');
  var res = UrlFetchApp.fetch(login + '/services/oauth2/token', { method: 'post', muteHttpExceptions: true, payload: payload });
  if (res.getResponseCode() !== 200) throw new Error('Salesforce login failed: ' + res.getContentText().slice(0, 300));
  var tok = JSON.parse(res.getContentText());
  cache.put('mq_sf_tok', JSON.stringify(tok), 50 * 60);
  return tok;
}

function mqSfFetch_(path, opts) {
  opts = opts || {};
  for (var attempt = 0; attempt < 2; attempt++) {
    var tok = mqSfToken_(attempt > 0);
    var res = UrlFetchApp.fetch(tok.instance_url + '/services/data/' + MQ.SF_API + path, {
      method: opts.method || 'get', muteHttpExceptions: true, contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + tok.access_token },
      payload: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var code = res.getResponseCode();
    if (code === 401 && attempt === 0) { CacheService.getScriptCache().remove('mq_sf_tok'); continue; }
    var text = res.getContentText();
    if (code >= 300) {
      var msg = text;
      try { var e = JSON.parse(text); msg = (e[0] && e[0].message) || e.message || msg; } catch (x) {}
      throw new Error('Salesforce: ' + String(msg).slice(0, 300));
    }
    return text ? JSON.parse(text) : {};
  }
}

function mqSoql_(q) { return (mqSfFetch_('/query?q=' + encodeURIComponent(q)).records) || []; }
function mqQ_(v) { return "'" + String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

var MQ_CONTACT_FIELDS = 'Id, Name, FirstName, LastName, Email, Preferred_Email__c, MobilePhone, Phone, Title, Birthdate, Contact_Type__c';

/** Who signed in, by e-mail: the Contact, their motor policies and vehicles.
 *  Nothing here is written. Every read is inside its own try, so a field the
 *  org does not have leaves a gap, never a refusal to sign in. */
function mqLookup_(email) {
  var me = { found: false, email: email, contactId: '', name: '', first: '', last: '', mobile: '', occupation: '', dob: '',
             vehicles: [], policies: [], salesforce: mqSfReady_() };
  if (!mqSfReady_()) return me;
  var contacts = [];
  try {
    contacts = mqSoql_('SELECT ' + MQ_CONTACT_FIELDS + ' FROM Contact WHERE Email = ' + mqQ_(email) +
      ' OR Preferred_Email__c = ' + mqQ_(email) + ' ORDER BY LastModifiedDate DESC LIMIT 5');
  } catch (e) { mqLog_('(lookup)', 'contact-failed', String(e)); }
  if (contacts.length) {
    var c = contacts[0];
    me.found = true; me.contactId = c.Id; me.name = c.Name || ''; me.first = c.FirstName || ''; me.last = c.LastName || '';
    me.mobile = c.MobilePhone || c.Phone || ''; me.occupation = mqNiceTitle_(c.Title); me.dob = c.Birthdate || '';
  }
  var ids = contacts.map(function (c) { return c.Id; });
  var inIds = ids.length ? ids.map(mqQ_).join(',') : '';
  try {
    var pq = 'SELECT POLICY__c, Product_Name__c, Expiry_Date__c, Date_Of_Birth__c, Occupation__c, Contact__c, RecordType.Name ' +
      'FROM CLIENT_PORTFOLIO__c WHERE (Email__c = ' + mqQ_(email) + (inIds ? ' OR Contact__c IN (' + inIds + ')' : '') + ')' +
      " AND RecordType.Name LIKE '%MOTOR%' ORDER BY Expiry_Date__c DESC NULLS LAST LIMIT 50";
    me.policies = mqSoql_(pq).map(function (r) {
      if (!me.dob && r.Date_Of_Birth__c) me.dob = r.Date_Of_Birth__c;
      if (!me.occupation && r.Occupation__c) me.occupation = mqNiceTitle_(r.Occupation__c);
      return { policy: r.POLICY__c || '', product: r.Product_Name__c || '', expires: r.Expiry_Date__c || '' };
    });
  } catch (e) { mqLog_('(lookup)', 'policies-failed', String(e)); }
  try {
    var vq = 'SELECT Policy__c, Vehicle__c, Vehicle_Make__c, Model__c, Year_of_Manufacture__c, Chassis__c, Engine__c, ' +
      'Motor_Vehicle_Coverage_Type__c, Cover1__c, Windscreen__c, Carrier__c, From__c, To__c, Vehicle_Status__c ' +
      'FROM Risk_Details__c WHERE Vehicle__c != null AND (Email__c = ' + mqQ_(email) +
      (inIds ? ' OR Insured__c IN (' + inIds + ')' : '') + ') ORDER BY To__c DESC NULLS LAST LIMIT 100';
    var byReg = {}, order = [];
    mqSoql_(vq).forEach(function (r) {
      var key = String(r.Vehicle__c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!key) return;
      if (!byReg[key]) { byReg[key] = { reg: r.Vehicle__c }; order.push(key); }
      var v = byReg[key];
      /* Newest cover first; a blank never erases what an older year knew. */
      var take = function (field, from) { if (!v[field] && r[from] != null && String(r[from]).trim() !== '') v[field] = r[from]; };
      take('make', 'Vehicle_Make__c'); take('model', 'Model__c'); take('year', 'Year_of_Manufacture__c');
      take('chassis', 'Chassis__c'); take('engine', 'Engine__c'); take('cover', 'Motor_Vehicle_Coverage_Type__c');
      take('sumInsured', 'Cover1__c'); take('windscreen', 'Windscreen__c'); take('carrier', 'Carrier__c');
      take('from', 'From__c'); take('to', 'To__c'); take('status', 'Vehicle_Status__c'); take('policy', 'Policy__c');
    });
    me.vehicles = order.map(function (k) { return byReg[k]; });
  } catch (e) { mqLog_('(lookup)', 'vehicles-failed', String(e)); }
  return me;
}

/* "TEACHER" and "POLICE OFFICER" in capitals on the Contact's Title; courtesy
   titles and placeholders are not occupations (the board's rule). */
function mqNiceTitle_(t) {
  t = mqClean_(t, 80);
  if (!t || /^(mr|mrs|ms|miss|dr|unknown|not on list|n\/a|none)\.?$/i.test(t)) return '';
  if (t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s\-\/(])(\w)/g, function (m, a, b) { return a + b.toUpperCase(); });
  return t;
}

/** A new client becomes a Contact when their request is sent, when a name is
 *  held. The same e-mail already on file is the same client, whatever the
 *  name was typed as. Never in test mode. */
function mqEnsureContact_(d, s) {
  if (s.contactId && mqIsSfId_(s.contactId)) return { id: s.contactId, action: 'Existing' };
  if (!mqSfReady_()) return { id: '', action: 'Salesforce not linked' };
  try {
    var same = mqSoql_('SELECT Id, Name FROM Contact WHERE Email = ' + mqQ_(d.email) + ' OR Preferred_Email__c = ' + mqQ_(d.email) + ' LIMIT 1');
    if (same.length) return { id: same[0].Id, action: 'Matched by e-mail' };
    if (mqMode_() !== 'live') return { id: '', action: 'Would be created (test mode)' };
    var parts = d.name.split(/\s+/), first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '', last = parts[parts.length - 1];
    var body = { FirstName: first.slice(0, 40), LastName: last.slice(0, 80), Email: d.email, Contact_Type__c: 'Prospect',
                 Description: 'Created from the motor quote page, ' + mqDate_() + '.' };
    if (d.mobile) body.MobilePhone = d.mobile;
    if (d.occupation) body.Title = d.occupation.slice(0, 128);
    if (d.dob && /^\d{4}-\d{2}-\d{2}$/.test(d.dob)) body.Birthdate = d.dob;
    var owner = mqProp_('MQ_SF_OWNER');
    if (mqIsSfId_(owner)) body.OwnerId = owner;
    var made = mqSfFetch_('/sobjects/Contact', { method: 'post', body: body });
    return { id: made.id, action: 'Created' };
  } catch (e) {
    mqLog_('(contact)', 'create-failed', String(e));
    return { id: '', action: 'Not created: ' + String(e.message || e).slice(0, 120) };
  }
}

/** One open task on the Contact, so the quote is chased until it is back. */
function mqTask_(d, ref, contactId) {
  if (!contactId || !mqSfReady_() || mqMode_() !== 'live') return '';
  try {
    var due = new Date(); var n = 0;
    while (n < MQ.TASK_DUE_DAYS) { due.setDate(due.getDate() + 1); if (due.getDay() !== 0 && due.getDay() !== 6) n++; }
    var body = {
      WhoId: contactId,
      Subject: 'Motor quote ' + ref + ': ' + [d.year, d.make, d.model].filter(Boolean).join(' ') + ' (' + d.reg + ') · ' + d.cover,
      Status: 'In Progress', Priority: 'Normal',
      ActivityDate: Utilities.formatDate(due, mqTz_(), 'yyyy-MM-dd'),
      Description: ('Quote requested on ' + MQ.SITE + ' and sent to ' + mqQuotesTo_() + ' on ' + mqDate_() + '.\n\n' +
        mqFieldsText_(d) + '\n\nReference ' + ref + '. Close this task when the quote has reached the client.').slice(0, 31000),
    };
    var owner = mqProp_('MQ_SF_OWNER');
    if (mqIsSfId_(owner)) body.OwnerId = owner;
    var tt = mqProp_('MQ_SF_TASK_TYPE', 'New Business');
    if (tt) body.Task_Type__c = tt;
    try { return mqSfFetch_('/sobjects/Task', { method: 'post', body: body }).id || ''; }
    catch (e) {
      /* A picklist the org refuses is left off and tried once more. */
      if (/Task_Type__c|picklist/i.test(String(e))) { delete body.Task_Type__c; return mqSfFetch_('/sobjects/Task', { method: 'post', body: body }).id || ''; }
      throw e;
    }
  } catch (e) { mqLog_('(task)', 'task-failed', String(e)); return ''; }
}

/* ============================== the request ============================== */

function mqSubmit_(b) {
  var s = mqSession_(b.token);
  if (!s) return { ok: false, error: 'Your sign-in has expired. Sign in again; what you typed is kept on this device.', signedOut: true };
  var d = mqRead_(b.quote || {}, s);
  var missing = MQ_REQUIRED.filter(function (k) { return !d[k]; });
  if (missing.length) {
    var labels = {}; MQ_FIELDS.forEach(function (f) { labels[f[0]] = f[1]; });
    return { ok: false, error: 'Still needed: ' + missing.map(function (k) { return labels[k] || k; }).join(', ') + '.' };
  }
  if (d.ownerType === 'Company' && !d.company) return { ok: false, error: 'Please give the company name.' };
  if (d.mortgaged === 'Yes' && !d.institution) return { ok: false, error: 'Please name the financial institution.' };
  if (d.accidents === 'Yes' && !d.accidentDetails) return { ok: false, error: 'Please say a little about the accident.' };
  var files = mqFiles_(b.files);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var ref;
  try {
    ref = mqNewRef_();
    var contact = mqEnsureContact_(d, s);
    var folder = mqStoreFiles_(ref, d, files);
    var row = mqRow_(ref, d, contact, files, folder);
    mqQuotesSheet_().appendRow(MQ_COLS.map(function (c) { return row[c] == null ? '' : row[c]; }));
  } finally { lock.releaseLock(); }
  mqLog_(ref, 'received', d.email + ' · ' + d.reg + ' · ' + d.cover);

  /* The e-mail to the quotes desk, with the documents attached. */
  var sent = mqMail_({
    to: [mqQuotesTo_()], cc: mqCc_().concat(d.agentEmail && mqEmailOk_(d.agentEmail) ? [d.agentEmail] : []),
    replyTo: MQ.SUPPORT_FROM,
    subject: 'Motor quote request ' + ref + ': ' + [d.year, d.make, d.model].filter(Boolean).join(' ') + ' (' + d.reg + ') · ' + d.cover + ' · ' + d.name,
    html: mqDeskMail_(ref, d, contact, folder),
    attachments: files.map(function (f) { return f.blob; }),
  });
  mqSet_(ref, 'Mail result', sent);
  mqSet_(ref, 'Sent to', mqQuotesTo_());

  /* The receipt to the client. */
  mqMail_({
    to: [d.email], subject: 'We have your motor quote request, ' + (d.first || d.name) + ' (' + ref + ')',
    html: mqReceipt_(ref, d), client: true,
  });

  var taskId = mqTask_(d, ref, contact.id);
  if (taskId) mqSet_(ref, 'SF task', taskId);
  mqLog_(ref, 'sent', sent + (taskId ? ' · task ' + taskId : ''));

  return { ok: true, ref: ref, mode: mqMode_(), sentTo: mqQuotesTo_(), contact: contact.action, mail: sent,
           requests: mqRequests_(s.email) };
}

/** What the page sent, cleaned. The signed-in e-mail is the client's e-mail,
 *  whatever the form says. */
function mqRead_(q, s) {
  var g = function (k, n) { return mqClean_(q[k], n || 160); };
  var yn = function (k) { var v = g(k, 10).toLowerCase(); return v === 'yes' ? 'Yes' : v === 'no' ? 'No' : ''; };
  var d = {
    name: g('name', 120), email: s.email, mobile: g('mobile', 40), gender: g('gender', 20), dob: g('dob', 10),
    occupation: g('occupation', 120), ownerType: /company/i.test(g('ownerType')) ? 'Company' : 'Individual',
    company: g('company', 120), companyEmail: mqNormEmail_(g('companyEmail', 120)),
    agent: g('agent', 120), agentEmail: mqNormEmail_(g('agentEmail', 120)),
    reg: g('reg', 20).toUpperCase(), make: g('make', 60), model: g('model', 60), year: g('year', 4).replace(/\D/g, ''),
    body: g('body', 40), seating: g('seating', 3).replace(/\D/g, ''), cc: g('cc', 6).replace(/\D/g, ''),
    value: g('value', 14).replace(/[^0-9.]/g, ''), condition: g('condition', 10),
    mortgaged: yn('mortgaged'), institution: g('institution', 120),
    cover: g('cover', 60), windscreen: yn('windscreen'), existingPolicy: g('existingPolicy', 40),
    existingVehicles: g('existingVehicles', 200), prevInsurer: g('prevInsurer', 80), ncd: g('ncd', 40),
    drivingYears: g('drivingYears', 3).replace(/\D/g, ''),
    permit: g('permit', 40), permitIssued: g('permitIssued', 10), permitExpires: g('permitExpires', 10),
    accidents: yn('accidents'), accidentDetails: g('accidentDetails', 600), notes: g('notes', 1000),
    sfVehicle: g('sfVehicle', 40),
  };
  if (d.ownerType !== 'Company') { d.company = ''; d.companyEmail = ''; }
  if (d.mortgaged !== 'Yes') d.institution = '';
  if (d.accidents !== 'Yes') d.accidentDetails = '';
  if (d.companyEmail && !mqEmailOk_(d.companyEmail)) d.companyEmail = '';
  if (d.agentEmail && !mqEmailOk_(d.agentEmail)) d.agentEmail = '';
  if (d.value) { var v = Number(d.value); d.value = isNaN(v) ? '' : String(Math.round(v)); }
  if (d.year && (Number(d.year) < 1950 || Number(d.year) > new Date().getFullYear() + 1)) d.year = '';
  d.first = d.name.split(/\s+/)[0] || '';
  return d;
}

/** The uploads: base64 in the request, each under MAX_FILE_BYTES, images or
 *  PDFs only, at most MAX_FILES. Anything else is refused whole. */
function mqFiles_(list) {
  if (!list || !list.length) return [];
  if (list.length > MQ.MAX_FILES) throw new Error('Please attach no more than ' + MQ.MAX_FILES + ' files.');
  return list.map(function (f) {
    var kind = mqClean_(f.kind, 40) || 'document', name = mqClean_(f.name, 120).replace(/[\\\/:*?"<>|]/g, '_') || 'file';
    var type = mqClean_(f.type, 80).toLowerCase();
    if (!/^(image\/(jpeg|jpg|png|heic|heif|webp)|application\/pdf)$/.test(type)) throw new Error('"' + name + '" is not a photo or a PDF.');
    var data = String(f.data || '').replace(/^data:[^,]*,/, '');
    var bytes = Utilities.base64Decode(data);
    if (bytes.length > MQ.MAX_FILE_BYTES) throw new Error('"' + name + '" is too large. Please send a photo under 6 MB.');
    return { kind: kind, name: name, type: type, bytes: bytes.length, blob: Utilities.newBlob(bytes, type, kind + ' - ' + name) };
  });
}

/** Motor Quotes / <year> / <ref> — <client> in Drive; the ids on Quote Files.
 *  Drive refusing never stops the request: the documents still travel on the
 *  e-mail. */
function mqStoreFiles_(ref, d, files) {
  if (!files.length) return '';
  try {
    var rootId = mqProp_('MQ_DRIVE_FOLDER'), root;
    if (rootId) root = DriveApp.getFolderById(rootId);
    else {
      var it = DriveApp.getFoldersByName('Motor Quotes');
      root = it.hasNext() ? it.next() : DriveApp.createFolder('Motor Quotes');
      mqProps_().setProperty('MQ_DRIVE_FOLDER', root.getId());
    }
    var year = mqDate_(new Date(), 'yyyy'), yi = root.getFoldersByName(year), yf = yi.hasNext() ? yi.next() : root.createFolder(year);
    var folder = yf.createFolder(ref + ' — ' + d.name.replace(/[\\\/:*?"<>|]/g, ' '));
    files.forEach(function (f) {
      var file = folder.createFile(f.blob);
      mqFilesSheet_().appendRow([ref, f.name, f.kind, f.bytes, file.getId(), new Date()]);
    });
    return folder.getUrl();
  } catch (e) { mqLog_(ref, 'drive-failed', String(e)); return ''; }
}

function mqRow_(ref, d, contact, files, folder) {
  return {
    'Ref': ref, 'Received': new Date(), 'Status': 'Sent to quotes desk', 'Client': d.name, 'Email': d.email, 'Mobile': d.mobile,
    'Contact Id': contact.id, 'Contact action': contact.action, 'Agent': d.agent, 'Agent e-mail': d.agentEmail,
    'Owner type': d.ownerType, 'Company': d.company, 'Company e-mail': d.companyEmail,
    'Vehicle #': d.reg, 'Make': d.make, 'Model': d.model, 'Year': d.year, 'Body type': d.body, 'Seating': d.seating, 'CC': d.cc,
    'Value': d.value, 'New or used': d.condition, 'Mortgaged': d.mortgaged, 'Institution': d.institution,
    'Cover': d.cover, 'Windscreen': d.windscreen, 'Existing policy': d.existingPolicy, 'Existing GG vehicles': d.existingVehicles,
    'Previous insurer': d.prevInsurer, 'NCD': d.ncd, 'Driving years': d.drivingYears,
    'Gender': d.gender, 'Date of birth': d.dob, 'Occupation': d.occupation, 'Permit #': d.permit, 'Permit issued': d.permitIssued,
    'Permit expires': d.permitExpires, 'Accidents': d.accidents, 'Accident details': d.accidentDetails,
    'Notes': d.notes, 'Files': files.map(function (f) { return f.kind + ': ' + f.name; }).join('; '), 'Drive folder': folder,
    'SF task': '', 'Sent to': '', 'Mail result': '', 'Quoted on': '', 'Quoted premium': '', 'Staff note': '',
  };
}

function mqSet_(ref, col, value) {
  try {
    var sh = mqQuotesSheet_(), m = mqHeaderMap_(sh);
    if (!(col in m) || sh.getLastRow() < 2) return;
    var refs = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = refs.length - 1; i >= 0; i--) if (String(refs[i][0]) === ref) { sh.getRange(i + 2, m[col] + 1).setValue(value); return; }
  } catch (e) {}
}

/** The client's own requests, newest first: what they see when they sign in. */
function mqRequests_(email) {
  var sh = mqQuotesSheet_();
  if (sh.getLastRow() < 2) return [];
  var m = mqHeaderMap_(sh), rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues(), out = [];
  rows.forEach(function (r) {
    if (String(r[m['Email']] || '').toLowerCase() !== email) return;
    var when = r[m['Received']];
    out.push({ ref: String(r[m['Ref']]), when: when instanceof Date ? mqDate_(when, 'd MMM yyyy') : String(when),
      vehicle: [r[m['Year']], r[m['Make']], r[m['Model']]].filter(Boolean).join(' '), reg: String(r[m['Vehicle #']] || ''),
      cover: String(r[m['Cover']] || ''), status: String(r[m['Status']] || ''),
      quotedOn: r[m['Quoted on']] instanceof Date ? mqDate_(r[m['Quoted on']], 'd MMM yyyy') : String(r[m['Quoted on']] || ''),
      premium: String(r[m['Quoted premium']] || '') });
  });
  return out.reverse();
}

/* ============================== e-mail ============================== */

function mqFieldsRows_(d) {
  var out = [];
  MQ_FIELDS.forEach(function (f) {
    if (f[0] === 'section') { out.push({ section: f[1] }); return; }
    var v = d[f[0]];
    if (v === '' || v == null) return;
    if (f[0] === 'value') v = 'TT$ ' + Number(v).toLocaleString('en-US');
    out.push({ label: f[1], value: String(v) });
  });
  return out;
}

function mqFieldsText_(d) {
  return mqFieldsRows_(d).map(function (r) { return r.section ? '\n' + r.section.toUpperCase() : r.label + ': ' + r.value; }).join('\n').trim();
}

function mqFieldsHtml_(d) {
  var h = '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">';
  var rows = mqFieldsRows_(d), inSection = false;
  rows.forEach(function (r, i) {
    if (r.section) {
      /* A section with nothing under it is not printed. */
      var next = rows[i + 1]; if (!next || next.section) return;
      h += '<tr><td colspan="2" style="padding:14px 0 6px;color:#c9942c;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase">' + mqEsc_(r.section) + '</td></tr>';
      return;
    }
    h += '<tr><td style="padding:6px 10px 6px 0;color:#5d7186;border-top:1px solid #e6edf2;width:42%;vertical-align:top">' + mqEsc_(r.label) +
      '</td><td style="padding:6px 0;color:#12202e;border-top:1px solid #e6edf2;font-weight:600;vertical-align:top">' + mqEsc_(r.value).replace(/\n/g, '<br>') + '</td></tr>';
  });
  return h + '</table>';
}

function mqDeskMail_(ref, d, contact, folder) {
  var intro = '<p>Good day,</p><p>Please quote for the following, requested by the client on the branch website (' +
    '<a href="' + MQ.SITE + '" style="color:#07606f">' + MQ.SITE.replace('https://', '') + '</a>). ' +
    'Reply to this e-mail and the quote reaches the branch and the client together.</p>';
  var tail = '<p style="margin-top:18px;font-size:13px;color:#5d7186">Reference <b>' + mqEsc_(ref) + '</b>' +
    (contact.id ? ' · Salesforce contact ' + mqEsc_(contact.id) + ' (' + mqEsc_(contact.action) + ')' : ' · ' + mqEsc_(contact.action)) +
    (folder ? ' · <a href="' + mqEsc_(folder) + '" style="color:#07606f">documents in Drive</a>' : '') +
    '. The driver\'s permit and the certified copy, where the client attached them, are attached to this e-mail.</p>';
  return mqWrap_('Motor quote request ' + ref, intro + mqFieldsHtml_(d) + tail, true);
}

function mqReceipt_(ref, d) {
  var veh = [d.year, d.make, d.model].filter(Boolean).join(' ') + ' (' + d.reg + ')';
  return mqWrap_('We have your request, ' + mqEsc_(d.first || d.name) + '.',
    '<p>Thank you. Your motor quote request for <b>' + mqEsc_(veh) + '</b>, ' + mqEsc_(d.cover) + ', went to Guardian General\'s quotes desk at ' +
    mqDate_(new Date(), 'h:mm a') + ' today, with our branch copied.</p>' +
    '<p><b>What happens next</b></p><ol style="padding-left:20px;margin:6px 0 12px">' +
    '<li>The quotes desk prices the cover from what you told us.</li>' +
    '<li>The quote comes back to our branch and to you at this address, usually within two working days.</li>' +
    '<li>A member of our team calls you to go through it and, if you wish, to put the cover in place.</li></ol>' +
    '<p>Your reference is <b style="color:#07131f">' + mqEsc_(ref) + '</b>. Sign in again at <a href="' + MQ.SITE + '" style="color:#07606f">' +
    MQ.SITE.replace('https://', '') + '</a> any time to see where it stands.</p>' +
    '<p>If anything you told us needs correcting, reply to this e-mail or call the branch on ' + MQ.BRANCH_TEL + '.</p>' +
    mqFieldsHtml_(d));
}

/* The letters' shell: the hosted gold shield in the masthead, tables and
   inline styles only, so any mail app shows it. */
function mqWrap_(title, body, internal) {
  return '<div style="background:#eef4f7;padding:18px 0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#33465a;font-size:15px;line-height:1.55">' +
    '<table cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #d7e3ea">' +
    '<tr><td style="background:#07131f;padding:16px 22px;border-bottom:3px solid #efc24b">' +
    '<table cellpadding="0" cellspacing="0"><tr><td style="width:40px;height:40px;border-radius:10px;background:#07131f;vertical-align:middle">' +
    '<img src="' + MQ.LOGO + '" width="40" height="40" alt="" style="display:block;border-radius:10px"></td>' +
    '<td style="padding-left:12px;color:#eaf4ff;font-weight:800;font-size:15px;line-height:1.25">' + MQ.BRAND +
    '<span style="display:block;font-weight:500;font-size:12px;color:#8fd8e6">Motor quotes</span></td></tr></table></td></tr>' +
    '<tr><td style="padding:22px 22px 8px"><h1 style="margin:0 0 10px;font-size:21px;line-height:1.3;color:#12202e">' + title + '</h1>' + body + '</td></tr>' +
    '<tr><td style="padding:14px 22px 18px;font-size:12px;color:#5d7186;border-top:1px solid #e6edf2">' +
    (internal ? 'Internal: this e-mail carries a client\'s details. Do not forward it outside Guardian and the branch.'
              : 'This e-mail is for you alone. Your information is used only to prepare and look after your cover, is never sold, and is never disclosed without your express consent. ' +
                'You may ask what we hold and have it corrected. Ricky Rampersad Branch, Guardian Group, Chaguanas · ' + MQ.BRANCH_TEL) +
    '</td></tr></table></div>';
}

/** Every e-mail goes from support@ through Microsoft Graph when the three MS_*
 *  properties are here (copied from the Service Questionnaire project), else
 *  from this script's Google account with support@ as the reply address.
 *  Test mode: everything to the test inbox with a banner naming who it was
 *  for; the quotes desk never hears from a test. */
function mqMail_(m) {
  var clean = function (l) {
    var seen = {};
    return (l || []).map(function (x) { return String(x || '').trim(); })
      .filter(function (x) { var k = x.toLowerCase(); if (!mqEmailOk_(x) || seen[k]) return false; seen[k] = 1; return true; });
  };
  var to = clean(m.to), lower = to.map(function (x) { return x.toLowerCase(); });
  var cc = clean(m.cc).filter(function (x) { return lower.indexOf(x.toLowerCase()) < 0; });
  if (!to.length) return 'No address';
  var subject = m.subject, html = m.html;
  if (mqMode_() !== 'live') {
    html = '<div style="background:#fff7df;border:1px solid #efc24b;padding:10px 14px;font-family:Arial;font-size:13px;color:#5c3d00">' +
      'TEST MODE: in live mode this would go to <b>' + mqEsc_(to.join(', ')) + '</b>' + (cc.length ? ', copied to ' + mqEsc_(cc.join(', ')) : '') + '.</div>' + html;
    to = [mqTestInbox_()]; cc = []; subject = '[TEST] ' + subject;
  }
  var atts = (m.attachments || []).filter(Boolean);
  if (mqGraphReady_()) {
    try {
      if (mqGraphSend_(to, cc, subject, html, m.replyTo || MQ.SUPPORT_FROM, atts)) return 'Sent from ' + MQ.SUPPORT_FROM;
    } catch (e) { mqLog_('(mail)', 'graph-failed', String(e)); }
  }
  var o = { to: to.join(','), subject: subject, htmlBody: html, name: MQ.BRAND, replyTo: m.replyTo || MQ.SUPPORT_FROM };
  if (cc.length) o.cc = cc.join(',');
  if (atts.length) o.attachments = atts;
  MailApp.sendEmail(o);
  return 'Sent from this account (reply to ' + MQ.SUPPORT_FROM + ')';
}

function mqGraphReady_() { return !!(mqProp_('MS_TENANT') && mqProp_('MS_CLIENT') && mqProp_('MS_SECRET')); }

function mqGraphToken_() {
  var cache = CacheService.getScriptCache(), c = cache.get('mq_ms_tok');
  if (c) return c;
  var res = UrlFetchApp.fetch('https://login.microsoftonline.com/' + mqProp_('MS_TENANT') + '/oauth2/v2.0/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'client_credentials', client_id: mqProp_('MS_CLIENT'), client_secret: mqProp_('MS_SECRET'),
               scope: 'https://graph.microsoft.com/.default' } });
  var j = JSON.parse(res.getContentText() || '{}');
  if (!j.access_token) throw new Error('Microsoft sign-in failed: ' + (j.error_description || j.error || res.getResponseCode()));
  cache.put('mq_ms_tok', j.access_token, 50 * 60);
  return j.access_token;
}

function mqGraphSend_(to, cc, subject, html, replyTo, atts) {
  var addr = function (l) { return l.map(function (a) { return { emailAddress: { address: a } }; }); };
  var message = { subject: subject, body: { contentType: 'HTML', content: html },
    toRecipients: addr(to), ccRecipients: addr(cc || []), replyTo: addr([replyTo || MQ.SUPPORT_FROM]) };
  if (atts && atts.length) {
    message.attachments = atts.map(function (b) {
      return { '@odata.type': '#microsoft.graph.fileAttachment', name: b.getName(), contentType: b.getContentType(),
               contentBytes: Utilities.base64Encode(b.getBytes()) };
    });
  }
  var res = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(MQ.SUPPORT_FROM) + '/sendMail', {
    method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + mqGraphToken_() },
    payload: JSON.stringify({ message: message, saveToSentItems: true }) });
  if (res.getResponseCode() === 202) return true;
  mqLog_('(mail)', 'graph-' + res.getResponseCode(), res.getContentText().slice(0, 300));
  return false;
}

/* ============================== editor ============================== */

/** Run once from the editor: makes the tabs, says what is set. */
function mqSetup() {
  mqQuotesSheet_(); mqFilesSheet_(); mqLogSheet_(); mqSessionsSheet_();
  var p = mqPing_();
  var msg = 'Motor quote backend ' + MQ.VERSION + '\n\nMode: ' + p.mode + (p.mode === 'test' ? ' (every e-mail goes to ' + mqTestInbox_() + ')' : '') +
    '\nSalesforce: ' + (p.salesforce ? 'linked' : 'NOT linked: set SF_KEY, SF_SECRET and SF_LOGIN_URL') +
    '\nMicrosoft 365: ' + (p.graph ? 'sending as ' + MQ.SUPPORT_FROM : 'not set: e-mails go from this Google account, reply-to ' + MQ.SUPPORT_FROM) +
    '\nQuotes go to: ' + mqQuotesTo_() + '\n\nDeploy as a web app (Execute as Me, Anyone) and paste the /exec address into motor-quote/index.html.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/** Sends the owner one request as the quotes desk would see it, and the
 *  receipt, in test mode. Marks nothing on the tab. */
function mqPreviewToMe() {
  var d = mqRead_({ name: 'Sample Client', mobile: '868-555-0100', gender: 'Female', dob: '1988-04-12', occupation: 'Teacher',
    reg: 'PDX 1234', make: 'Toyota', model: 'Aqua', year: '2019', body: 'Hatchback', seating: '5', cc: '1500', value: '95000',
    condition: 'Used', mortgaged: 'Yes', institution: 'Sample Credit Union', cover: 'Comprehensive', windscreen: 'Yes',
    prevInsurer: 'Another Insurer Ltd', ncd: '3 years (35%)', drivingYears: '9', permit: 'DP-000000', permitIssued: '2017-05-01',
    permitExpires: '2027-05-01', accidents: 'No', notes: 'Sample request from mqPreviewToMe().' }, { email: Session.getEffectiveUser().getEmail() });
  var me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: me, subject: '[PREVIEW] Motor quote request MQ-SAMPLE: what the quotes desk sees', htmlBody: mqDeskMail_('MQ-SAMPLE', d, { id: '', action: 'Preview' }, '') });
  MailApp.sendEmail({ to: me, subject: '[PREVIEW] The client\'s receipt', htmlBody: mqReceipt_('MQ-SAMPLE', d) });
  return 'Two previews sent to ' + me;
}

function mqGoLive() { mqProps_().setProperty('MQ_MODE', 'live'); return 'Live: requests now go to ' + mqQuotesTo_(); }
function mqTestMode() { mqProps_().setProperty('MQ_MODE', 'test'); return 'Test mode: every e-mail goes to ' + mqTestInbox_(); }
