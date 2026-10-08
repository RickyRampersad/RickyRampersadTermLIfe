/**
 * ============================================================
 *  TRAVEL INSURANCE — proposal intake
 *  Ricky Rampersad Branch · Guardian General form GG-TIN-PRO-10/2023
 * ============================================================
 *
 *  The backend behind travel/index.html. A client completes the
 *  travel insurance proposal form on the site; this script
 *
 *   1. files one row per proposal on the "Travel Proposals" tab
 *      and one row per insured person on "Travel Persons";
 *   2. renders the proposal as a PDF laid out like Guardian
 *      General's own form (sections 1 to 9) and saves it in a
 *      Drive folder per proposal;
 *   3. e-mails the branch (and the travel desk, once it is set)
 *      the summary with the PDF attached, and the client an
 *      acknowledgement carrying the reference and the same PDF.
 *
 *  Nothing is bound here. The branch rates the trip and sends
 *  the premium; the client pays Guardian General; cover starts
 *  when the premium is paid.
 *
 *  SETUP (ten minutes, once) — the steps are in TRAVEL-SETUP.md:
 *   1. New Google Sheet "Travel Proposals". Extensions -> Apps Script.
 *   2. Paste this file, save. Edit TRAVEL below (SITE_KEY at least).
 *   3. Run setupTravel() once; grant Sheets, Drive, Gmail.
 *   4. Deploy -> New deployment -> Web app (Execute as Me, Anyone).
 *   5. Paste the /exec URL into CONFIG.API_URL in travel/index.html
 *      and set CONFIG.SITE_KEY there to the same SITE_KEY.
 *
 *  An Apps Script project may hold one doGet and one doPost, so
 *  this file lives in its OWN project with its own sheet. Do not
 *  paste it beside Service.gs, Claims.gs or Code.gs.
 * ============================================================
 */

var TRAVEL = {
  // Guardian General's travel desk. Leave blank until the branch has the
  // address confirmed: until then every proposal goes to the branch alone,
  // and the e-mail says so.
  DESK: '',

  // Copied on every proposal.
  MAIL_CC: [
    'rickyrampersadsalessupport@myguardiangroup.com',   // sales support
    'ricky.rampersad@myguardiangroup.com',              // the branch manager
    'support@rickyrampersadbranch.com',                 // branch support inbox
  ],

  FROM_NAME: 'Ricky Rampersad Branch — Travel',
  AGENT_NAME: 'Ricky Rampersad',
  BRANCH_PHONE: '(868) 226-6461',
  SUPPORT: 'support@rickyrampersadbranch.com',

  // Must match CONFIG.SITE_KEY in travel/index.html. Change both together.
  SITE_KEY: 'rrb-travel-2026',

  DRIVE_ROOT: 'Travel Proposals — Ricky Rampersad Branch',
  SHEET: 'Travel Proposals',
  PERSONS_SHEET: 'Travel Persons',
  LOG_SHEET: 'Travel Log',

  // Blank = the script owner's address.
  TEST_INBOX: '',

  STATUSES: ['Received', 'Quoted', 'Awaiting payment', 'Bound', 'Declined', 'Withdrawn'],

  /* Salesforce, for prefilling an existing client's details. Three Script
     properties, the same three the Service Questionnaire project holds:
     SF_KEY, SF_SECRET and SF_LOGIN_URL (the My Domain address). Nothing in
     the code, because the .gs files are public. Without them the page never
     shows the "find my details" panel. */
  SF_API: 'v60.0',
  SF_LOGIN: 'https://login.salesforce.com',
};

/* Guardian General's logo as it sits on form GG-TIN-PRO-10/2023, embedded so the PDF
   never depends on a fetch. The PDF is Guardian's form, so it carries no branch mark. */
var GG_LOGO = 'data:image/png;base64,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';
var GG_LOGO_URL = 'https://rickyrampersadbranch.com/travel/gg-logo.png';

var TBRAND = { navy: '#07131f', navy2: '#163553', gold: '#efc24b', teal: '#00CFEA', light: '#e6fafd',
  logo: 'https://rickyrampersadbranch.com/logo-mark.png' };   // hosted PNG: Gmail strips SVG and blocks data URIs

var PACKAGES = {
  economy: { name: 'Economy',      pa: 50000,  baggage: 2500, addl: 500,  medical: 10000, money: 1500, deposits: 2500 },
  plus:    { name: 'Economy Plus', pa: 100000, baggage: 5000, addl: 750,  medical: 15000, money: 3000, deposits: 2500 },
  elite:   { name: 'Elite',        pa: 250000, baggage: 7500, addl: 1000, medical: 25000, money: 5000, deposits: 2500 },
};

var COLUMNS = [
  'Timestamp', 'Reference', 'Status', 'Proposer', 'Proposer type', 'Entity type', 'Title', 'First name', 'Surname',
  'Company', 'Date of birth / incorporation', 'Place of birth / incorporation', 'Nationality', 'Country of residence',
  'Marital status', 'Residential / registered address', 'Mailing address', 'Contact numbers', 'Email',
  'Occupation', 'Employer and business activity', 'PEP',
  'Countries to be visited', 'Purpose of trip', 'Period from', 'Period to', 'Days', 'Persons accompanying',
  'Cover for each person', 'Travelling dependants', 'Dependant health details',
  'Package', 'Suggested package', 'Beneficiary (PA)', 'Sums insured', 'Specified items',
  'Sound health', 'Health details', 'Infectious contact (21 days)', 'Contact details',
  'Declaration', 'Existing client', 'Client number', 'Policy on file', 'Prefilled from Salesforce', 'Flags', 'Premium quoted (TT$)', 'Quoted on', 'Paid on', 'Policy number',
  'Proposal PDF', 'Drive folder', 'Assigned to', 'Internal notes', 'Page',
];
var PERSON_COLUMNS = [
  'Timestamp', 'Reference', 'Proposer', 'Role', 'Name', 'Date of birth', 'Age on departure', 'Occupation',
  'Sound health', 'Free from defects', 'Personal accident', 'PA beneficiary', 'Baggage & travel documents',
  'Additional expenses (passport / licence)', 'Medical expenses', 'Loss of money', 'Loss of tickets',
  'Deposits, curtailment & missed connections',
];

/* ============================ test mode ============================ */

function testMode_() { return PropertiesService.getScriptProperties().getProperty('TEST_MODE') === 'on'; }
function testInbox_() { return TRAVEL.TEST_INBOX || Session.getEffectiveUser().getEmail(); }

/** Single gate for all outgoing mail. Live: straight through. */
function sendMail_(opts) {
  if (!testMode_()) { MailApp.sendEmail(opts); return; }
  var would = 'To: ' + (opts.to || '(none)') + (opts.cc ? ' · CC: ' + opts.cc : '');
  var o = {}; for (var k in opts) o[k] = opts[k];
  delete o.cc; delete o.bcc; delete o.replyTo;
  o.to = testInbox_(); o.subject = '[TEST] ' + (opts.subject || '');
  if (o.htmlBody) {
    o.htmlBody = '<div style="background:#b3261e;color:#fff;padding:10px 16px;border-radius:6px;margin:0 0 14px;font-family:Arial,sans-serif;font-size:13px">' +
      '<b>TEST MODE</b> — nothing was sent to the real recipients.<br>Would have gone to — ' + esc_(would) + '</div>' + o.htmlBody;
  }
  MailApp.sendEmail(o);
}
function testModeOn_() { PropertiesService.getScriptProperties().setProperty('TEST_MODE', 'on'); SpreadsheetApp.getUi().alert('Test mode is ON. Every e-mail now goes to ' + testInbox_() + ' with a [TEST] banner.'); }
function testModeOff_() { PropertiesService.getScriptProperties().deleteProperty('TEST_MODE'); SpreadsheetApp.getUi().alert('Test mode is OFF. E-mails go to the real recipients again.'); }

/* ============================ sheet ============================ */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function namedSheet_(name, headers) {
  var sh = ss_().getSheetByName(name);
  if (!sh) { sh = ss_().insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold'); }
  return sh;
}
function sheet_() { return namedSheet_(TRAVEL.SHEET, COLUMNS); }
function personsSheet_() { return namedSheet_(TRAVEL.PERSONS_SHEET, PERSON_COLUMNS); }
function logSheet_() { return namedSheet_(TRAVEL.LOG_SHEET, ['Timestamp', 'Reference', 'Event', 'Details']); }
function log_(ref, event, details) { logSheet_().appendRow([new Date(), ref, event, details || '']); }

function headerMap_(sh) {
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], m = {};
  hdr.forEach(function (h, i) { m[String(h).trim().toLowerCase()] = i; });
  return m;
}
function appendRow_(sh, headers, vals) {
  var map = headerMap_(sh), row = [];
  headers.forEach(function (h) { var i = map[h.toLowerCase()]; if (i !== undefined) row[i] = vals[h] === undefined ? '' : vals[h]; });
  for (var i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
  sh.appendRow(row);
  return sh.getLastRow();
}
function findRef_(ref) {
  var sh = sheet_(), map = headerMap_(sh), col = map['reference'];
  if (col === undefined || sh.getLastRow() < 2) return null;
  var vals = sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === ref) return { sh: sh, row: i + 2, map: map };
  return null;
}
function setField_(hit, field, value) { var c = hit.map[field.toLowerCase()]; if (c !== undefined) hit.sh.getRange(hit.row, c + 1).setValue(value); }

/* ============================ drive ============================ */

function rootFolder_() {
  var it = DriveApp.getFoldersByName(TRAVEL.DRIVE_ROOT);
  return it.hasNext() ? it.next() : DriveApp.createFolder(TRAVEL.DRIVE_ROOT);
}
function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function proposalFolder_(ref, name) {
  var year = childFolder_(rootFolder_(), String(new Date().getFullYear()));
  return childFolder_(year, ref + ' — ' + safeName_(name));
}
function safeName_(s) { return String(s || '').replace(/[\\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Proposal'; }

/* ============================ references ============================ */

/** TRV-YYMM-NNNN, checked against the sheet so it is never reused. */
function newReference_() {
  var d = new Date();
  var stamp = String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2);
  for (var attempt = 0; attempt < 40; attempt++) {
    var ref = 'TRV-' + stamp + '-' + String(Math.floor(1000 + Math.random() * 9000));
    if (!findRef_(ref)) return ref;
  }
  return 'TRV-' + stamp + '-' + String(d.getTime()).slice(-6);
}

/* ============================ small helpers ============================ */

function esc_(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function clean_(v, max) { return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 300); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function tz_() { return Session.getScriptTimeZone() || 'America/Port_of_Spain'; }
function nowStamp_() { return Utilities.formatDate(new Date(), tz_(), 'dd MMM yyyy, h:mm a'); }
function fmtDate_(iso) {
  if (!iso) return '';
  var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return String(iso);
  return Utilities.formatDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), tz_(), 'dd MMM yyyy');
}
function money_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'string' && !/\d/.test(v)) return v;           // "included"
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return String(v);
  return '$' + n.toLocaleString('en-US');
}
function daysBetween_(a, b) {
  var x = new Date(a + 'T00:00:00'), y = new Date(b + 'T00:00:00');
  if (isNaN(x) || isNaN(y)) return '';
  return Math.round((y - x) / 86400000) + 1;
}
function ageOn_(dob, on) {
  if (!dob) return '';
  var a = new Date(dob + 'T00:00:00'), b = on ? new Date(on + 'T00:00:00') : new Date();
  if (isNaN(a) || isNaN(b)) return '';
  var y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth();
  if (m < 0 || (m === 0 && b.getDate() < a.getDate())) y--;
  return y;
}
function ccList_() { return TRAVEL.MAIL_CC.filter(String).join(','); }
function yn_(v) { return v === 'Yes' ? 'YES ☑ &nbsp; NO ☐' : v === 'No' ? 'YES ☐ &nbsp; NO ☑' : 'YES ☐ &nbsp; NO ☐'; }

/* ============================ web app routing ============================ */

function doGet(e) {
  var p = (e && e.parameter) || {}, out;
  try {
    switch (p.action) {
      case 'ping': out = { ok: true, service: 'travel', version: 2, desk: !!TRAVEL.DESK, prefill: sfReady_(), test: testMode_() }; break;
      default: out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) { out = { ok: false, error: String(err && err.message ? err.message : err) }; }
  return json_(out);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Could not read the request.' }); }
  if (clean_(body.siteKey, 80) !== TRAVEL.SITE_KEY) {
    return json_({ ok: false, error: 'This form is out of date. Please refresh the page and try again.' });
  }
  var out;
  try {
    switch (body.action) {
      case 'propose': out = apiPropose_(body); break;
      case 'lookup':  out = apiLookup_(body); break;
      default: out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) { out = { ok: false, error: String(err && err.message ? err.message : err) }; }
  return json_(out);
}

/* ============================ the proposal ============================ */

function apiPropose_(b) {
  var t = b.trip || {}, p = b.proposer || {}, h = b.health || {};
  var biz = p.kind === 'business';
  var name = clean_(biz ? p.company : [p.title, p.first, p.surname].filter(String).join(' '), 160);
  if (!name) throw new Error('Please tell us the name of the proposer.');
  var email = clean_(p.email, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Please give an e-mail address we can send your reference to.');
  if (!clean_(t.from, 20) || !clean_(t.to, 20)) throw new Error('Please give the period of insurance.');
  if (!b.declared) throw new Error('Please accept the declaration.');

  var deps = (b.deps || []).slice(0, 4).map(function (d) {
    return { name: clean_(d.name, 120), dob: clean_(d.dob, 20), occupation: clean_(d.occupation, 120), health: clean_(d.health, 5), defects: clean_(d.defects, 5) };
  }).filter(function (d) { return d.name || d.dob; });
  var items = (b.items || []).slice(0, 30).map(function (i) { return { desc: clean_(i.desc, 200), value: clean_(i.value, 30) }; }).filter(function (i) { return i.desc || i.value; });
  var pkg = PACKAGES[b.pkg] || null;
  var sugg = PACKAGES[b.suggested] ? PACKAGES[b.suggested].name : b.suggested === 'custom' ? 'Cover outside the packages' : '';
  var pkgName = pkg ? pkg.name : b.pkg === 'custom' ? 'Cover outside the packages' : clean_(b.pkgName, 60);

  // persons as the page sent them, with the package limits already applied
  var persons = (b.persons || []).slice(0, 5).map(function (x, i) {
    var s = x.sums || {};
    return {
      role: clean_(x.role, 30) || (i ? 'Dependant ' + i : 'Proposer'), name: clean_(x.name, 120), dob: clean_(x.dob, 20),
      occupation: clean_(x.occupation, 120), health: clean_(x.health, 5), defects: clean_(x.defects, 5),
      pa: clean_(s.pa, 30), ben: clean_(s.ben, 120), baggage: clean_(s.baggage, 30), addl: clean_(s.addl, 30),
      medical: clean_(s.medical, 30), money: clean_(s.money, 30), tickets: clean_(s.tickets, 30), deposits: clean_(s.deposits, 30),
    };
  });
  if (!persons.length) persons = [{ role: 'Proposer', name: name, dob: clean_(p.dob, 20), occupation: clean_(p.occupation, 120), health: clean_(h.sound, 5), defects: clean_(h.sound, 5) }];

  var days = daysBetween_(clean_(t.from, 20), clean_(t.to, 20));
  var flags = [];
  if (days && days > 14) flags.push('Trip over 14 days: outside the packages');
  if (Number(t.companions) > 4 && t.coverEach !== 'No') flags.push('More than five persons: details taken for four');
  persons.forEach(function (x) { var a = ageOn_(x.dob, clean_(t.from, 20)); if (a !== '' && (a < 5 || a > 75)) flags.push(x.name + ': age ' + a + ', outside 5 to 75'); });
  if (p.pep === 'Yes') flags.push('PEP: memorandum required');
  if (h.sound === 'No' || h.contact === 'Yes' || deps.some(function (d) { return d.health === 'No' || d.defects === 'No'; })) flags.push('Health disclosure: underwriter to consider');
  if (b.pkg === 'custom') flags.push('Sums insured stated by the client: rate individually');
  if (sugg && sugg !== pkgName) flags.push('Chose ' + pkgName + '; the page suggested ' + sugg);
  var ex = b.existing && typeof b.existing === 'object' ? b.existing : null;
  var existing = ex ? { clientNumber: clean_(ex.clientNumber, 20), policy: clean_(ex.policy, 20), prefilled: (ex.prefilled || []).slice(0, 20).map(function (k) { return clean_(k, 20); }) } : null;

  var ref = newReference_();
  var folder = proposalFolder_(ref, name);

  var prop = {
    ref: ref, name: name, biz: biz, kind: biz ? 'Business' : 'Person', entity: clean_(p.entity, 40),
    title: clean_(p.title, 20), first: clean_(p.first, 80), surname: clean_(p.surname, 80), company: clean_(p.company, 160),
    dob: clean_(p.dob, 20), pob: clean_(p.pob, 120), nationality: clean_(p.nationality, 80), residence: clean_(p.residence, 80),
    marital: clean_(p.marital, 30), address: clean_(p.address, 300), mailing: clean_(p.mailing, 300), phone: clean_(p.phone, 80),
    email: email, occupation: clean_(p.occupation, 160), employer: clean_(p.employer, 200), pep: clean_(p.pep, 5),
    countries: clean_(t.countries, 300), purpose: clean_(t.purpose, 200), from: clean_(t.from, 20), to: clean_(t.to, 20), days: days,
    companions: clean_(t.companions, 5), coverEach: clean_(t.coverEach, 5), deps: deps, depDetails: clean_(b.depDetails, 2000),
    pkg: b.pkg, pkgName: pkgName, pkgLimits: pkg, suggested: sugg, beneficiary: clean_(b.beneficiary, 200), persons: persons, items: items,
    sound: clean_(h.sound, 5), soundDetails: clean_(h.soundDetails, 2000), contact: clean_(h.contact, 5), contactDetails: clean_(h.contactDetails, 2000),
    flags: flags, page: clean_(b.page, 300), folder: folder.getUrl(), existing: existing,
  };

  var row = appendRow_(sheet_(), COLUMNS, {
    'Timestamp': new Date(), 'Reference': ref, 'Status': 'Received', 'Proposer': name, 'Proposer type': prop.kind,
    'Entity type': prop.entity, 'Title': prop.title, 'First name': prop.first, 'Surname': prop.surname, 'Company': prop.company,
    'Date of birth / incorporation': prop.dob, 'Place of birth / incorporation': prop.pob, 'Nationality': prop.nationality,
    'Country of residence': prop.residence, 'Marital status': prop.marital, 'Residential / registered address': prop.address,
    'Mailing address': prop.mailing, 'Contact numbers': prop.phone, 'Email': prop.email, 'Occupation': prop.occupation,
    'Employer and business activity': prop.employer, 'PEP': prop.pep, 'Countries to be visited': prop.countries,
    'Purpose of trip': prop.purpose, 'Period from': prop.from, 'Period to': prop.to, 'Days': days, 'Persons accompanying': prop.companions,
    'Cover for each person': prop.coverEach,
    'Travelling dependants': deps.map(function (d) { return [d.name, d.dob ? 'born ' + fmtDate_(d.dob) : '', d.occupation, 'health ' + d.health, 'defects-free ' + d.defects].filter(String).join(' · '); }).join('\n'),
    'Dependant health details': prop.depDetails, 'Package': pkgName, 'Suggested package': sugg, 'Beneficiary (PA)': prop.beneficiary,
    'Sums insured': persons.map(function (x) { return x.name + ': PA ' + money_(x.pa) + ' · baggage ' + money_(x.baggage) + ' · passport ' + money_(x.addl) + ' · medical ' + money_(x.medical) + ' · money ' + money_(x.money) + ' · tickets ' + money_(x.tickets) + ' · deposits ' + money_(x.deposits) + (x.ben ? ' · beneficiary ' + x.ben : ''); }).join('\n'),
    'Specified items': items.map(function (i) { return i.desc + (i.value ? ' · ' + money_(i.value) : ''); }).join('\n'),
    'Sound health': prop.sound, 'Health details': prop.soundDetails, 'Infectious contact (21 days)': prop.contact, 'Contact details': prop.contactDetails,
    'Declaration': 'Accepted online ' + nowStamp_(), 'Existing client': existing ? 'Yes' : 'No',
    'Client number': existing ? existing.clientNumber : '', 'Policy on file': existing ? existing.policy : '',
    'Prefilled from Salesforce': existing ? existing.prefilled.join(', ') : '', 'Flags': flags.join('\n'), 'Drive folder': prop.folder, 'Page': prop.page,
  });
  var hit = { sh: sheet_(), row: row, map: headerMap_(sheet_()) };

  persons.forEach(function (x) {
    appendRow_(personsSheet_(), PERSON_COLUMNS, {
      'Timestamp': new Date(), 'Reference': ref, 'Proposer': name, 'Role': x.role, 'Name': x.name, 'Date of birth': x.dob,
      'Age on departure': ageOn_(x.dob, prop.from), 'Occupation': x.occupation, 'Sound health': x.health, 'Free from defects': x.defects,
      'Personal accident': x.pa, 'PA beneficiary': x.ben, 'Baggage & travel documents': x.baggage,
      'Additional expenses (passport / licence)': x.addl, 'Medical expenses': x.medical, 'Loss of money': x.money,
      'Loss of tickets': x.tickets, 'Deposits, curtailment & missed connections': x.deposits,
    });
  });

  var pdf = null;
  try {
    pdf = formPdf_(b.formHtml, ref) || proposalPdf_(prop);
    var saved = folder.createFile(pdf);
    setField_(hit, 'Proposal PDF', saved.getUrl());
  } catch (err) { log_(ref, 'pdf-failed', String(err)); }

  try { notifyBranch_(prop, pdf); } catch (err) { log_(ref, 'branch-mail-failed', String(err)); }
  try { ackClient_(prop, pdf); } catch (err) { log_(ref, 'client-mail-failed', String(err)); }
  log_(ref, 'received', name + ' · ' + pkgName + ' · ' + prop.countries);

  return { ok: true, ref: ref, flags: flags };
}

/* ============================ Salesforce: prefill for an existing client ============================
 * A client gives any policy number or their client number plus their date of
 * birth. Only when the date of birth matches the record is anything handed
 * back, and five wrong tries on one number close it for fifteen minutes, as
 * on the claims page. What comes back is what the proposal form asks for:
 * name, date of birth, address, phones, e-mail, occupation, employer.
 * =================================================================================================== */

function sfProps_() { return PropertiesService.getScriptProperties(); }
function sfReady_() { var p = sfProps_(); return !!(p.getProperty('SF_KEY') && p.getProperty('SF_SECRET')); }
function sfLit_(s) { return String(s === null || s === undefined ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function sfToken_() {
  var p = sfProps_();
  var cached = p.getProperty('TRV_SF_TOKEN'), when = Number(p.getProperty('TRV_SF_TOKEN_AT') || 0);
  if (cached && (new Date().getTime() - when) < 50 * 60 * 1000) return JSON.parse(cached);
  var payload = { grant_type: 'client_credentials', client_id: p.getProperty('SF_KEY'), client_secret: p.getProperty('SF_SECRET') };
  if (p.getProperty('SF_PASS')) { payload.grant_type = 'password'; payload.username = p.getProperty('SF_USER'); payload.password = p.getProperty('SF_PASS'); }
  var login = String(p.getProperty('SF_LOGIN_URL') || TRAVEL.SF_LOGIN).trim().replace(/\/+$/, '');
  var res = UrlFetchApp.fetch(login + '/services/oauth2/token', { method: 'post', muteHttpExceptions: true, payload: payload });
  if (res.getResponseCode() !== 200) throw new Error('Salesforce login failed: ' + res.getContentText().slice(0, 200));
  var tok = JSON.parse(res.getContentText());
  p.setProperty('TRV_SF_TOKEN', JSON.stringify(tok)); p.setProperty('TRV_SF_TOKEN_AT', String(new Date().getTime()));
  return tok;
}
function sfQuery_(soql) {
  var tok = sfToken_();
  var go = function () { return UrlFetchApp.fetch(tok.instance_url + '/services/data/' + TRAVEL.SF_API + '/query?q=' + encodeURIComponent(soql), { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok.access_token } }); };
  var res = go();
  if (res.getResponseCode() === 401) { sfProps_().deleteProperty('TRV_SF_TOKEN'); tok = sfToken_(); res = go(); }
  if (res.getResponseCode() !== 200) throw new Error('Salesforce query failed: ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText()).records || [];
}

var SF_LOOKUP_FIELDS = [
  'POLICY__c', 'Client_Number__c', 'FIRST_NAME__c', 'LAST_NAME__c', 'Date_Of_Birth__c', 'Email__c', 'Mobile__c', 'Home_Phone__c',
  'Occupation__c', 'Address_1__c', 'Address_2__c', 'Address_3__c', 'PLAN_NAME__c', 'Policy_Status_Description__c',
  'Contact__r.Salutation', 'Contact__r.FirstName', 'Contact__r.LastName', 'Contact__r.Birthdate', 'Contact__r.Email',
  'Contact__r.MobilePhone', 'Contact__r.HomePhone', 'Contact__r.MailingStreet', 'Contact__r.MailingCity', 'Contact__r.Title', 'Contact__r.Employer__c',
];

/** Five wrong dates on one number inside fifteen minutes and it stops answering. */
function lookupThrottle_(key, spend) {
  var cache = CacheService.getScriptCache(), slot = 'trv-lk-' + key;
  var used = Number(cache.get(slot) || 0);
  if (used >= 5) return false;
  if (spend) cache.put(slot, String(used + 1), 900);
  return true;
}
function dobKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyyMMdd');
  var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + m[2] + m[3] : '';
}
function phoneNice_(v) { var d = String(v || '').replace(/\D/g, ''); if (d.length < 7) return ''; if (d.length === 7) d = '868' + d; if (d.length === 11 && d[0] === '1') d = d.slice(1); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : String(v); }
function titleCase_(s) { return String(s || '').toLowerCase().replace(/(^|[\s\-'/(])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(T&tec|Wasa|Ngc|Ttps|Ttec)\b/g, function (m) { return m.toUpperCase(); }); }
function jobTitle_(t) { t = String(t || '').trim(); return /^(mr|mrs|ms|miss|dr|unknown|not on list|n\/a|none)\.?$/i.test(t) ? '' : t; }
function addrNice_(rec, c) {
  var v = function (x) { return x === null || x === undefined ? '' : String(x); };
  var town = v(rec.Address_2__c || c.MailingCity).replace(/\s+/g, ' ').trim(), a3 = v(rec.Address_3__c).replace(/\s+/g, ' ').trim();
  var a1 = v(rec.Address_1__c || c.MailingStreet).replace(/\s*[\r\n]+\s*/g, ', ').replace(/\s+/g, ' ').trim();
  return titleCase_([a1, town, /trinidad|tobago|w\.?i\.?$/i.test(a3) ? '' : a3].filter(Boolean).join(', '));
}

function apiLookup_(b) {
  if (!sfReady_()) throw new Error('Prefill is not switched on yet.');
  var first = clean_(b.first, 60), last = clean_(b.surname, 60), dob = dobKey_(clean_(b.dob, 20));
  if (!first || !last) throw new Error('Give your first name and surname first.');
  if (dob.length !== 8) throw new Error('Give your date of birth first.');
  var key = (last + dob).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!lookupThrottle_(key, false)) throw new Error('Too many tries. Please wait fifteen minutes.');
  // the policy record's own name, or the Contact's: the branch types both
  var recs = sfQuery_('SELECT ' + SF_LOOKUP_FIELDS.join(', ') + " FROM CLIENT_PORTFOLIO__c WHERE ((FIRST_NAME__c = '" + sfLit_(first) + "' AND LAST_NAME__c = '" + sfLit_(last) + "') OR (Contact__r.FirstName = '" + sfLit_(first) + "' AND Contact__r.LastName = '" + sfLit_(last) + "')) LIMIT 60");
  var hits = recs.filter(function (r) { var c = r.Contact__r || {}; var k1 = dobKey_(r.Date_Of_Birth__c), k2 = dobKey_(c.Birthdate); return (k1 && k1 === dob) || (k2 && k2 === dob); });
  if (!hits.length) {
    lookupThrottle_(key, true);
    log_('(lookup)', 'prefill-miss', recs.length ? 'name known, date of birth did not match' : 'name not on file');
    throw new Error('We could not find you on file with that name and date of birth.');
  }
  // the newest in force, else the first
  var rec = hits.filter(function (r) { return /premium paying|paid up|in force/i.test(String(r.Policy_Status_Description__c || '')); })[0] || hits[0];
  var c = rec.Contact__r || {}, v = function (x) { return x === null || x === undefined ? '' : String(x).trim(); };
  var prefill = {
    address: addrNice_(rec, c),
    phone: [phoneNice_(c.MobilePhone || rec.Mobile__c), phoneNice_(rec.Home_Phone__c || c.HomePhone)].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' · '),
    email: v(rec.Email__c || c.Email).toLowerCase(),
    occupation: titleCase_(v(rec.Occupation__c) || jobTitle_(c.Title)),
    employer: titleCase_(jobTitle_(c.Employer__c)),
  };
  var cno = v(rec.Client_Number__c) || v(hits[0].Client_Number__c);
  log_('(lookup)', 'prefill', 'client ' + (cno || '?') + ' · ' + hits.length + ' record(s)');
  return { ok: true, prefill: prefill, clientNumber: cno, policies: hits.length };
}

/* ============================ the PDF: Guardian General's form, as the page rendered it ============================ */

/**
 * The page sends the completed form as one HTML document, Guardian General's
 * GG-TIN-PRO-10/2023 laid out as printed. Scripts and event attributes are cut,
 * the logo is embedded, and the converter makes the PDF. Returns null when the
 * page sent nothing usable, and the script's own rendering stands in.
 */
function formPdf_(html, ref) {
  html = String(html || '');
  if (html.length < 2000 || html.indexOf('TRAVEL INSURANCE PROPOSAL FORM') < 0 || html.length > 400000) return null;
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '').replace(/<object[\s\S]*?<\/object>/gi, '').replace(/<embed[^>]*>/gi, '')
    .replace(/javascript:/gi, '');
  html = html.split(GG_LOGO_URL).join(GG_LOGO).replace(/src="gg-logo\.png"/g, 'src="' + GG_LOGO + '"');
  return Utilities.newBlob(html, MimeType.HTML, 'Travel Proposal ' + ref + '.pdf').getAs(MimeType.PDF);
}

/* ============================ the PDF: the form, sections 1 to 9 ============================ */

function fr_(k, v) {
  return '<div style="display:flex;gap:8px;margin:5px 0;align-items:baseline"><span style="flex:none;color:#333">' + k +
    '</span><span style="flex:1;border-bottom:1px solid #777;min-height:15px;padding:0 4px;font-weight:bold">' + esc_(v) + '</span></div>';
}
function th_(s) { return '<th style="border:1px solid #777;padding:4px 6px;text-align:left;background:#eee;font-size:10px;vertical-align:top">' + s + '</th>'; }
function td_(s) { return '<td style="border:1px solid #777;padding:4px 6px;font-size:10.5px;vertical-align:top">' + s + '</td>'; }
function h3_(s) { return '<div style="font-weight:bold;font-size:12px;margin:14px 0 6px;text-transform:uppercase">' + s + '</div>'; }

function proposalPdf_(x) {
  var pk = x.pkgLimits;
  var tick = function (label, on) { return (on ? '☑ ' : '☐ ') + label; };
  var html =
    '<html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11.5px;line-height:1.4;margin:0">' +
    '<table width="100%" style="border-collapse:collapse;margin-bottom:14px"><tr>' +
      '<td style="width:210px;padding:0 14px 8px 0"><img src="' + GG_LOGO + '" width="200" style="border:1px solid #ddd"></td>' +
      '<td style="font-size:10.5px;color:#333;padding:0 0 8px;vertical-align:top"><b>Head Office:</b> Newtown Centre, 30-34 Maraval Road, St.Clair, NEWTOWN, 190133, TRINIDAD &amp; TOBAGO<br>' +
      '<b>Telephone:</b> (868) 226-myGG (6944) &#9642; Fax: (868) 622-9994<br><b>Branch Office:</b> 31-33 Independence Avenue, SAN FERNANDO, 600202, TRINIDAD &amp; TOBAGO<br>' +
      '<b>Telephone:</b> (868) 226-myGG (6944) &#9642; Fax: (868) 652-5228<br><b>Website:</b> www.myguardiangroup.com</td>' +
    '</tr></table>' +
    '<div style="text-align:center;font-weight:bold;font-size:15px;letter-spacing:1px;margin:6px 0 12px">TRAVEL INSURANCE PROPOSAL FORM</div>' +
    h3_('1. Personal information') +
    fr_('(a) Name of proposer(s) / company (in full)', x.name) +
    '<table width="100%" style="border-collapse:collapse"><tr><td style="width:50%;padding-right:12px;vertical-align:top">' +
      fr_('(b) Date of ' + (x.biz ? 'incorporation' : 'birth'), fmtDate_(x.dob)) + fr_('Nationality', x.nationality) + (x.biz ? '' : fr_('Marital status', x.marital)) +
    '</td><td style="width:50%;vertical-align:top">' +
      fr_('Place of ' + (x.biz ? 'incorporation' : 'birth'), x.pob) + fr_('Country of residence', x.residence) +
    '</td></tr></table>' +
    fr_('(c) ' + (x.biz ? 'Registered' : 'Residential') + ' address of proposer', x.address) +
    fr_('(d) Mailing address (if different)', x.mailing) +
    '<table width="100%" style="border-collapse:collapse"><tr><td style="width:50%;padding-right:12px">' + fr_('(e) Contact no(s)', x.phone) + '</td><td>' + fr_('Email address', x.email) + '</td></tr></table>' +
    fr_('(f) Trade, occupation, profession (include part-time)', x.occupation) +
    fr_('(g) Name of employer, and business activity', x.employer) +
    fr_('(h) If business entity, are you?', x.biz ? x.entity : 'Not a business entity') +
    '<div style="margin:6px 0">(i) Are you a Politically Exposed Person (PEP) or an immediate family member of a PEP? &nbsp; <b>' + yn_(x.pep) + '</b>' +
      (x.pep === 'Yes' ? '<br><b>A PEP Memorandum accompanies this proposal.</b>' : '') + '</div>' +
    fr_('(j) Countries to be visited', x.countries) +
    fr_('(k) Purpose of trip', x.purpose) +
    '<table width="100%" style="border-collapse:collapse"><tr><td style="width:50%;padding-right:12px">' + fr_('(l) Period of insurance from', fmtDate_(x.from)) + '</td><td>' + fr_('to', fmtDate_(x.to) + (x.days ? ' (' + x.days + ' days)' : '')) + '</td></tr></table>' +
    '<p style="font-size:9.5px;color:#333;margin:4px 0">If you are unable to complete your trip within the specified period of insurance due to accident, misfortune, injury, sickness or disease, cover will automatically continue without additional premium until such completion, up to a maximum of 30 days.</p>' +

    h3_('2. Persons accompanying you') +
    '<table width="100%" style="border-collapse:collapse"><tr><td style="width:50%;padding-right:12px">' + fr_('(a) How many persons will accompany you on the trip?', x.companions) + '</td>' +
      '<td>(b) Is cover required for each person? &nbsp; <b>' + yn_(Number(x.companions) > 0 ? x.coverEach : '') + '</b></td></tr></table>';

  if (x.deps.length) {
    html += '<table width="100%" style="border-collapse:collapse;margin:6px 0"><tr>' + th_('#') + th_('Name') + th_('Date of birth') + th_('Occupation') + th_('Of sound mental and bodily health') + th_('Free from physical defects or infirmity') + '</tr>' +
      x.deps.map(function (d, i) { return '<tr>' + td_(i + 1) + td_(esc_(d.name)) + td_(esc_(fmtDate_(d.dob))) + td_(esc_(d.occupation)) + td_(yn_(d.health)) + td_(yn_(d.defects)) + '</tr>'; }).join('') + '</table>' +
      fr_("(c) If 'No' to (i) or (ii) above, full details", x.depDetails);
  }

  html += h3_('3. Package required') +
    '<div style="margin:4px 0"><b>' + tick('Economy', x.pkg === 'economy') + ' &nbsp; ' + tick('Economy Plus', x.pkg === 'plus') + ' &nbsp; ' + tick('Elite', x.pkg === 'elite') + ' &nbsp; ' + tick('Cover outside the packages', x.pkg === 'custom') + '</b></div>' +
    (pk ? '<p style="font-size:9.5px;color:#333;margin:4px 0">Maximum limit per person: personal accident ' + money_(pk.pa) + '; baggage, personal effects &amp; travel documents ' + money_(pk.baggage) + '; additional expenses due to loss of passport and/or driver\'s licence ' + money_(pk.addl) + '; medical expenses ' + money_(pk.medical) + '; loss of money and tickets ' + money_(pk.money) + '; loss of deposits, curtailment and missed connections ' + money_(pk.deposits) + '. Subject to a maximum of five persons and fourteen days any one trip.</p>' : '') +
    fr_('4. Beneficiary in the event of death under Personal Accident cover', x.beneficiary) +
    h3_('5 and 6. Sums insured: maximum limits required') +
    '<table width="100%" style="border-collapse:collapse"><tr>' + th_('Proposer &amp; other persons to be insured') + th_('Personal accident') + th_('Beneficiary in the event of death under PA cover') + th_('Baggage, personal effects &amp; travel documents') + th_('Additional expenses: passport &amp; driver\'s licence') + th_('Medical expenses') + th_('Loss of money &amp; tickets') + th_('Loss of deposits, curtailment &amp; missed connections') + '</tr>' +
    x.persons.map(function (p, i) {
      return '<tr>' + td_((i + 1) + '. ' + esc_(p.name)) + td_(esc_(money_(p.pa))) + td_(esc_(p.ben || (i === 0 ? x.beneficiary : ''))) + td_(esc_(money_(p.baggage))) + td_(esc_(money_(p.addl))) + td_(esc_(money_(p.medical))) +
        td_((p.money ? 'a) ' + esc_(money_(p.money)) : '') + (p.tickets ? '<br>b) ' + esc_(money_(p.tickets)) : '')) + td_(esc_(money_(p.deposits))) + '</tr>';
    }).join('') + '</table>' +

    h3_('7. Specified items (baggage, personal effects &amp; travel documents)') +
    (x.items.length
      ? '<table width="100%" style="border-collapse:collapse"><tr>' + th_('Item of jewellery or baggage valued over $1,000') + th_('Value') + '</tr>' + x.items.map(function (i) { return '<tr>' + td_(esc_(i.desc)) + td_(esc_(money_(i.value))) + '</tr>'; }).join('') + '</table>'
      : '<p style="font-size:10px;color:#333">None declared.</p>') +

    h3_('8. Health') +
    '<div>Are you of sound mental and bodily health and free from physical defects or infirmity? &nbsp; <b>' + yn_(x.sound) + '</b></div>' +
    (x.sound === 'No' ? fr_("If 'No', details", x.soundDetails) : '') +
    h3_('9. Infectious or communicable disease') +
    '<div>Have you and/or any persons accompanying you on the trip been in known contact within the last 21 days with anyone suffering from an infectious or communicable disease? &nbsp; <b>' + yn_(x.contact) + '</b></div>' +
    (x.contact === 'Yes' ? fr_("If 'Yes', details", x.contactDetails) : '') +

    '<p style="font-size:9.5px;color:#333;margin-top:14px"><b>Declaration.</b> I declare that the statements and particulars given above are true and complete to the best of my knowledge and belief, that I have not withheld any material fact, and that this proposal is the basis of the contract between me and Guardian General Insurance Limited. Declared online on ' + nowStamp_() + ' against reference ' + esc_(x.ref) + '.</p>' +
    '<table width="100%" style="margin-top:22px;font-size:10px;color:#333"><tr><td style="width:45%;border-top:1px solid #333;padding-top:4px">Signature of proposer</td><td style="width:10%"></td><td style="border-top:1px solid #333;padding-top:4px">Date</td></tr></table>' +
    '<p style="font-size:9.5px;color:#333;margin-top:18px;font-family:Times New Roman,Times,serif">GG-TIN-PRO-10/2023</p>' +
    '</body></html>';

  return Utilities.newBlob(html, MimeType.HTML, 'Travel Proposal ' + x.ref + '.pdf').getAs(MimeType.PDF);
}

/* ============================ e-mail ============================ */

function tr_(k, v) {
  return '<tr><td style="padding:7px 12px;background:#f4f7fa;border:1px solid #e3eaf2;width:200px;color:#5a6b80;vertical-align:top">' + k +
    '</td><td style="padding:7px 12px;border:1px solid #e3eaf2">' + (v || '<span style="color:#9fb2c4">—</span>') + '</td></tr>';
}
function brandWrap_(inner, tag) {
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433;max-width:640px">' +
    '<div style="background:' + TBRAND.navy + ';color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
    '<table width="100%"><tr><td width="46" valign="middle"><img src="' + TBRAND.logo + '" width="40" height="40" style="display:block;border-radius:10px"></td>' +
    '<td valign="middle" style="padding-left:10px"><b style="font-size:18px;color:' + TBRAND.gold + '">Travel Insurance</b><br>' +
    '<span style="color:#b7c9de;font-size:12px">' + (tag || 'Proposal') + ' · Ricky Rampersad Branch · Guardian Group</span></td></tr></table></div>' +
    '<div style="border:1px solid #dde5ee;border-top:none;padding:20px 22px;border-radius:0 0 10px 10px">' + inner +
    '<p style="color:#8a97a8;font-size:11px;border-top:1px solid #e3eaf2;padding-top:10px;margin-top:18px">' +
    'A proposal is not a policy. Cover is subject to acceptance by Guardian General Insurance Limited and to payment of the premium, and the policy wording governs in all cases. ' +
    'This e-mail and its attachment are for the person it is addressed to. If it reached you in error, please tell us and delete it. Your information is used only to arrange and look after this insurance.</p></div></div>';
}
function sig_() { return '<p>Warm regards,<br><b>' + esc_(TRAVEL.AGENT_NAME) + '</b><br>Ricky Rampersad Branch · Guardian Group<br>' + esc_(TRAVEL.BRANCH_PHONE) + ' · ' + esc_(TRAVEL.SUPPORT) + '</p>'; }

function summaryTable_(x) {
  return '<table style="border-collapse:collapse;width:100%;font-size:13px;margin:10px 0">' +
    tr_('Reference', '<b>' + esc_(x.ref) + '</b>') +
    tr_('Proposer', esc_(x.name) + (x.biz ? ' (' + esc_(x.entity || 'business') + ')' : '')) +
    (x.existing ? tr_('Existing client', 'Client number ' + esc_(x.existing.clientNumber || '—') + ' · details prefilled from Salesforce') : '') +
    (x.suggested ? tr_('Page suggested', esc_(x.suggested) + (x.suggested === x.pkgName ? ' (chosen)' : ' (the client chose ' + esc_(x.pkgName) + ')')) : '') +
    tr_('Contact', esc_(x.phone) + ' · ' + esc_(x.email)) +
    tr_('Trip', esc_(x.countries) + ' · ' + esc_(x.purpose)) +
    tr_('Period', esc_(fmtDate_(x.from)) + ' to ' + esc_(fmtDate_(x.to)) + (x.days ? ' · ' + x.days + ' days' : '')) +
    tr_('Travellers', (1 + x.deps.length) + ' insured' + (Number(x.companions) ? ' · ' + esc_(x.companions) + ' accompanying, cover for each: ' + esc_(x.coverEach || '—') : '')) +
    tr_('Package', esc_(x.pkgName)) +
    tr_('Beneficiary (PA)', esc_(x.beneficiary)) +
    (x.items.length ? tr_('Specified items', x.items.map(function (i) { return esc_(i.desc) + (i.value ? ' · ' + esc_(money_(i.value)) : ''); }).join('<br>')) : '') +
    tr_('Health', 'Sound health: ' + esc_(x.sound) + (x.soundDetails ? ' — ' + esc_(x.soundDetails) : '') + '<br>Infectious contact: ' + esc_(x.contact) + (x.contactDetails ? ' — ' + esc_(x.contactDetails) : '')) +
    tr_('PEP', esc_(x.pep)) +
    '</table>';
}

function notifyBranch_(x, pdf) {
  var to = TRAVEL.DESK || TRAVEL.MAIL_CC[0];
  var cc = TRAVEL.DESK ? ccList_() : TRAVEL.MAIL_CC.slice(1).filter(String).join(',');
  var flags = x.flags.length
    ? '<div style="background:#fdf3e7;border-left:4px solid #e08b1e;padding:12px 16px;margin:14px 0"><b>To check before quoting</b><ul style="margin:6px 0 0;padding-left:18px">' + x.flags.map(function (f) { return '<li>' + esc_(f) + '</li>'; }).join('') + '</ul></div>'
    : '<div style="background:#eaf7f0;border-left:4px solid #2f9e62;padding:12px 16px;margin:14px 0">Nothing flagged: within the packages, within the age limits, no disclosure.</div>';
  var inner =
    '<p>A travel insurance proposal came in from the website' + (TRAVEL.DESK ? '' : '. <b>The Guardian General travel desk is not set in this script</b>, so it has gone to the branch alone') + '.</p>' +
    summaryTable_(x) + flags +
    '<p><b>Persons to be insured</b></p><ul style="padding-left:18px">' + x.persons.map(function (p) { var a = ageOn_(p.dob, x.from); return '<li>' + esc_(p.name) + ' (' + esc_(p.role) + (a !== '' ? ', age ' + a : '') + ')' + (p.pa ? ' · PA ' + esc_(money_(p.pa)) + ' · medical ' + esc_(money_(p.medical)) : '') + '</li>'; }).join('') + '</ul>' +
    '<p><b>Next:</b> rate the trip, reply to the client with the premium, and set the row to <i>Quoted</i> on the sheet. The completed proposal form is attached and filed at <a href="' + esc_(x.folder) + '">the proposal\'s Drive folder</a>.</p>' +
    '<p style="color:#8a97a8;font-size:12px">Internal: carries a client\'s details. Do not forward outside the branch.</p>';
  sendMail_({
    to: to, cc: cc, name: TRAVEL.FROM_NAME, replyTo: x.email,
    subject: 'Travel proposal ' + x.ref + ' — ' + x.name + ' · ' + x.pkgName + ' · ' + fmtDate_(x.from) + (x.flags.length ? ' · ' + x.flags.length + ' to check' : ''),
    htmlBody: brandWrap_(inner, 'New proposal'), attachments: pdf ? [pdf] : [],
  });
}

function ackClient_(x, pdf) {
  var first = x.biz ? x.name : (x.first || x.name);
  var inner =
    '<p>Thank you, ' + esc_(first) + '. We have received your travel insurance proposal.</p>' +
    '<p>Your reference is <b style="font-size:17px;letter-spacing:1px">' + esc_(x.ref) + '</b>. Quote it if you call.</p>' +
    summaryTable_(x) +
    '<p><b>What happens next</b></p><ol style="padding-left:18px">' +
    '<li>The branch rates your trip and sends you the premium, usually the same working day.</li>' +
    '<li>You pay the premium to Guardian General; we tell you how. Cover starts when the premium is paid, never before.</li>' +
    '<li>Your policy and the claims numbers come to this address. Keep them on your phone while you travel.</li></ol>' +
    (x.pep === 'Yes' ? '<p>Because you answered yes to the PEP question, Guardian General asks for a short PEP Memorandum with your proposal. We send it to you to complete; nothing else changes.</p>' : '') +
    (x.days && x.days > 14 ? '<p>Your trip is longer than the fourteen days a package covers, so we quote it on its own. Nothing to do on your side.</p>' : '') +
    '<p>Your completed proposal form is attached. If anything on it is wrong, reply to this e-mail or call us on ' + esc_(TRAVEL.BRANCH_PHONE) + ' and we put it right before we quote.</p>' + sig_();
  sendMail_({
    to: x.email, cc: ccList_(), name: TRAVEL.FROM_NAME, replyTo: TRAVEL.SUPPORT,
    subject: 'Your travel insurance proposal ' + x.ref + ' — we have it',
    htmlBody: brandWrap_(inner, 'Thank you'), attachments: pdf ? [pdf] : [],
  });
}

/* ============================ the quote, from the sheet ============================ */

/**
 * Menu: e-mail the client their premium. Select a row on Travel Proposals,
 * type the premium in "Premium quoted (TT$)", then run this. Sets Status
 * to Quoted and stamps Quoted on.
 */
function emailQuote() {
  var sh = sheet_(), ui = SpreadsheetApp.getUi();
  if (ss_().getActiveSheet().getName() !== TRAVEL.SHEET) { ui.alert('Select a row on the ' + TRAVEL.SHEET + ' tab first.'); return; }
  var row = sh.getActiveRange().getRow(); if (row < 2) { ui.alert('Select the client\'s row, not the header.'); return; }
  var map = headerMap_(sh), vals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  var g = function (k) { var i = map[k.toLowerCase()]; return i === undefined ? '' : vals[i]; };
  var ref = String(g('Reference')), email = String(g('Email')), premium = g('Premium quoted (TT$)');
  var n = Number(String(premium).replace(/[^0-9.]/g, ''));
  if (!ref || !email) { ui.alert('That row has no reference or e-mail.'); return; }
  if (!n) { ui.alert('Type the premium in "Premium quoted (TT$)" first.'); return; }
  var first = String(g('First name') || g('Proposer'));
  var inner =
    '<p>Hello ' + esc_(first) + ',</p>' +
    '<p>Your premium for travel insurance under proposal <b>' + esc_(ref) + '</b> is <b style="font-size:17px">TT$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</b>.</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:13px;margin:10px 0">' +
    tr_('Trip', esc_(g('Countries to be visited')) + ' · ' + esc_(g('Purpose of trip'))) +
    tr_('Period', esc_(fmtDate_(g('Period from'))) + ' to ' + esc_(fmtDate_(g('Period to')))) +
    tr_('Package', esc_(g('Package'))) + '</table>' +
    '<p>Reply to this e-mail or call us on ' + esc_(TRAVEL.BRANCH_PHONE) + ' to pay and we issue your policy. Cover starts when the premium is paid, so please allow a working day before you leave.</p>' + sig_();
  sendMail_({ to: email, cc: ccList_(), name: TRAVEL.FROM_NAME, replyTo: TRAVEL.SUPPORT,
    subject: 'Your travel insurance premium — proposal ' + ref, htmlBody: brandWrap_(inner, 'Your premium') });
  var hit = { sh: sh, row: row, map: map };
  setField_(hit, 'Status', 'Quoted'); setField_(hit, 'Quoted on', new Date());
  log_(ref, 'quoted', 'TT$' + n);
  ui.alert('Premium e-mailed to ' + email + ' for ' + ref + '.');
}

/* ============================ setup ============================ */

function setupTravel() {
  var sh = sheet_(); personsSheet_(); logSheet_();
  var root = rootFolder_();
  var map = headerMap_(sh);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(TRAVEL.STATUSES, true).build();
  sh.getRange(2, map['status'] + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  ['sums insured', 'travelling dependants', 'specified items', 'flags'].forEach(function (k) { if (map[k] !== undefined) sh.setColumnWidth(map[k] + 1, 300); });
  SpreadsheetApp.getUi().alert(
    'Travel proposals are ready.\n\n' +
    'Tabs: ' + TRAVEL.SHEET + ', ' + TRAVEL.PERSONS_SHEET + ', ' + TRAVEL.LOG_SHEET + '\n' +
    'Drive folder: ' + root.getUrl() + '\n' +
    'Travel desk: ' + (TRAVEL.DESK || 'not set — proposals go to the branch alone') + '\n' +
    'Prefill from Salesforce: ' + (sfReady_() ? 'on' : 'off — set SF_KEY, SF_SECRET and SF_LOGIN_URL in Script properties') + '\n\n' +
    'Next: Deploy → New deployment → Web app (execute as Me, access Anyone), then paste the /exec URL into CONFIG.API_URL in travel/index.html.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Travel')
    .addItem('1. Set up / repair everything', 'setupTravel')
    .addSeparator()
    .addItem('E-mail the selected client their premium', 'emailQuote')
    .addItem('Open the proposals Drive folder', 'openTravelFolder')
    .addSeparator()
    .addItem('Turn test mode ON (e-mails only reach you)', 'testModeOn_')
    .addItem('Turn test mode OFF (live e-mails)', 'testModeOff_')
    .addToUi();
}
function openTravelFolder() { SpreadsheetApp.getUi().alert('Proposals are filed here:\n\n' + rootFolder_().getUrl()); }
