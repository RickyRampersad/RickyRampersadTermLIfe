/**
 * ============================================================
 *  CLAIMS TT — backend
 *  Ricky Rampersad Branch
 * ============================================================
 *
 *  The custom claims intake + document upload service behind
 *  claims/index.html. A client picks their claim type, answers
 *  the questions that matter for that type, photographs or
 *  attaches their documents, and submits. Nothing is emailed
 *  back and forth and nobody has to walk into the branch with
 *  a folder of paper.
 *
 *  WHAT THIS SCRIPT DOES
 *   1. Storage — every claim becomes its own Google Drive
 *      folder (Claims TT / YEAR / CLM-XXXX — Client — Type)
 *      holding the uploaded documents, plus one row on the
 *      "Claims" tab and one row per file on the "Claim Files"
 *      tab.
 *   2. Upload — files arrive in chunks so a large PDF or an
 *      uncompressed phone photo cannot blow the request limit.
 *      Chunks are reassembled server-side.
 *   3. Notification — the claims desk for that line of business
 *      gets a full summary email (with the Drive folder link),
 *      the client gets an acknowledgement carrying their claim
 *      reference and a list of anything still outstanding.
 *   4. Status — a client can come back later and check where
 *      their claim stands using their reference plus the last
 *      four digits of the mobile number they filed with.
 *
 *  SETUP (about ten minutes, once):
 *   1. Make a new Google Sheet — call it "Claims TT".
 *      Extensions -> Apps Script.
 *   2. Paste this file in, save.
 *   3. Edit the CLAIMS config below — at minimum the claims
 *      desk email addresses and SITE_KEY.
 *   4. Run setupClaims() once and grant the permissions it
 *      asks for (Sheets, Drive, Gmail). It builds every tab and
 *      creates the Drive folder.
 *   5. Deploy -> New deployment -> Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Copy the /exec URL.
 *   6. Paste that URL into CONFIG.API_URL in claims/index.html
 *      and set CONFIG.SITE_KEY there to the same SITE_KEY.
 *
 *  NOTE ON doGet / doPost: an Apps Script project may only have
 *  one of each, so this file belongs in its OWN project with
 *  its own spreadsheet — do not paste it alongside Code.gs or
 *  Market.gs.
 * ============================================================
 */

var CLAIMS = {
  /* ---- where notifications go ---------------------------- */

  // The claims desk for each line of business. Any line left
  // blank falls back to DESK_DEFAULT.
  DESK: {
    motor:    'GuardianGeneralClaims@myguardiangroup.com',
    property: 'GuardianGeneralClaims@myguardiangroup.com',
    health:   'healthclaims@myguardiangroup.com',
    life:     'lifeclaims@myguardiangroup.com',
    pension:  'pensions@myguardiangroup.com',
  },
  DESK_DEFAULT: 'GuardianGeneralClaims@myguardiangroup.com',

  // Copied on every claim, whatever the type.
  MAIL_CC: [
    'ricky.rampersad@myguardiangroup.com',   // you
    'salessupport@myguardiangroup.com',      // sales support team
    'support@rickyrampersadbranch.com',      // branch support inbox
  ],

  FROM_NAME: 'Ricky Rampersad — Claims TT',
  AGENT_NAME: 'Ricky Rampersad',
  AGENT_PHONE: '(868) 678-5921',
  BRANCH_HOURS: 'Monday to Friday, 8:00am – 4:00pm',

  /* ---- storage ------------------------------------------- */

  DRIVE_ROOT: 'Claims TT — Ricky Rampersad Branch',
  CLAIMS_SHEET: 'Claims',
  FILES_SHEET: 'Claim Files',
  LOG_SHEET: 'Claim Log',

  // Built by data/build-vehicle-register.py from the Salesforce export and
  // imported here. This is what lets a claimant type a number plate instead
  // of hunting for their chassis number at the roadside.
  REGISTER_SHEET: 'Vehicle Register',

  /* ---- automated follow-up ------------------------------- */

  // Days after filing to chase the client for outstanding documents.
  // The sequence stops the moment nothing is outstanding, or the claim
  // reaches a closed status.
  CHASE_DAYS: [3, 7, 14, 21, 30],

  // Days with no movement before the *desk* gets nudged about a claim
  // that is still open.
  DESK_NUDGE_DAYS: [10, 25, 45],

  // Statuses that end all follow-up.
  CLOSED_STATUSES: ['Settled', 'Declined', 'Closed'],

  /* ---- limits -------------------------------------------- */

  MAX_FILE_MB: 15,        // per document, after the browser compresses photos
  MAX_FILES: 30,          // per claim
  CHUNK_TTL_MINUTES: 60,  // abandoned upload parts are swept after this

  /* ---- light abuse control ------------------------------- */

  // Shared with claims/index.html. This travels in the page's
  // JavaScript so it is NOT a secret — it only stops drive-by
  // posting from bots that never loaded the page. Change both
  // sides together.
  SITE_KEY: 'claims-tt-2026-rrb',

  // Statuses used on the Claims tab and shown to the client.
  STATUSES: ['Received', 'Under review', 'Awaiting documents', 'With adjuster',
             'Approved', 'Settled', 'Declined', 'Closed'],
};

var CBRAND = { navy: '#0E2A47', blue: '#1C4E80', teal: '#0E8C8C', gold: '#F2B33D', light: '#E9F7F6' };

/** Human labels for the claim types the site offers. */
var CLAIM_TYPES = {
  motor:    { label: 'Motor',                   icon: '🚗' },
  health:   { label: 'Health / Medical',        icon: '🏥' },
  property: { label: 'Home / Property',         icon: '🏠' },
  life:     { label: 'Life / Critical Illness', icon: '🕊️' },
  pension:  { label: 'Pension / Annuity',       icon: '📈' },
};


/* ============================ sheet plumbing ============================ */

function cs_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function namedSheet_(name, headers) {
  var sh = cs_().getSheetByName(name);
  if (!sh) {
    sh = cs_().insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground(CBRAND.light);
  }
  return sh;
}

var CLAIM_COLUMNS = [
  'Timestamp', 'Reference', 'Status', 'Claim Type', 'Sub-type',
  'Client Name', 'Policy #', 'Mobile', 'Email', 'National ID',
  'Incident Date', 'Incident Time', 'Location', 'Description',
  'Estimated Amount (TT$)', 'Police Report #', 'Police Station',
  'Third Party', 'Bank Details', 'Files', 'Missing Documents',
  'Drive Folder', 'Claim Form PDF', 'Assigned To', 'Internal Notes',
  'Follow-ups Sent', 'Last Updated',
];

function claimsSheet_() {
  var sh = namedSheet_(CLAIMS.CLAIMS_SHEET, CLAIM_COLUMNS);
  ensureClaimCols_(sh);
  return sh;
}

/** Add any column this version of the script expects but the sheet lacks. */
function ensureClaimCols_(sh) {
  var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  CLAIM_COLUMNS.forEach(function (name) {
    if (headers.indexOf(name) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(name).setFontWeight('bold').setBackground(CBRAND.light);
      headers.push(name);
    }
  });
}

/** Append a claim by header name, so column order never has to be remembered. */
function appendClaim_(vals) {
  var sh = claimsSheet_();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(headers.map(function (h) { return (h in vals) ? vals[h] : ''; }));
}

function filesSheet_() {
  return namedSheet_(CLAIMS.FILES_SHEET,
    ['Timestamp', 'Reference', 'Document', 'File Name', 'Size (KB)', 'Type', 'Drive Link']);
}

function logSheet_() {
  return namedSheet_(CLAIMS.LOG_SHEET, ['Timestamp', 'Reference', 'Event', 'By', 'Details']);
}

function logClaim_(ref, event, by, details) {
  logSheet_().appendRow([new Date(), ref, event, by || 'client', String(details || '').slice(0, 900)]);
}

function headerMap_(sheet) {
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var m = {};
  h.forEach(function (name, i) { m[String(name).trim().toLowerCase()] = i; });
  return m;
}

/** Find a claim's row on the Claims tab. Returns {row, values, map} or null. */
function findClaim_(ref) {
  ref = String(ref || '').trim().toUpperCase();
  if (!ref) return null;
  var sh = claimsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var map = headerMap_(sh);
  var col = map['reference'] + 1;
  var refs = sh.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]).trim().toUpperCase() === ref) {
      var row = i + 2;
      return { row: row, values: sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0], map: map, sheet: sh };
    }
  }
  return null;
}

function setClaimField_(hit, field, value) {
  var idx = hit.map[String(field).toLowerCase()];
  if (idx === undefined) return;
  hit.sheet.getRange(hit.row, idx + 1).setValue(value);
  hit.values[idx] = value;
}

function claimField_(hit, field) {
  var idx = hit.map[String(field).toLowerCase()];
  return idx === undefined ? '' : hit.values[idx];
}


/* ============================ Drive plumbing ============================ */

/** The one root folder that holds every claim, remembered by id. */
function rootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CLAIMS_ROOT_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* deleted — rebuild below */ }
  }
  var it = DriveApp.getFoldersByName(CLAIMS.DRIVE_ROOT);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(CLAIMS.DRIVE_ROOT);
  props.setProperty('CLAIMS_ROOT_ID', folder.getId());
  return folder;
}

function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** Claims TT / 2026 / CLM-2608-4821 — Jane Doe — Motor */
function claimFolder_(ref, clientName, type) {
  var year = String(new Date().getFullYear());
  var yearFolder = childFolder_(rootFolder_(), year);
  var label = (CLAIM_TYPES[type] && CLAIM_TYPES[type].label) || 'Claim';
  var name = ref + ' — ' + safeName_(clientName || 'Client') + ' — ' + label;
  return childFolder_(yearFolder, name);
}

/** Scratch space for in-flight upload chunks. */
function partsFolder_() {
  return childFolder_(rootFolder_(), '_upload-parts');
}

function safeName_(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}


/* ============================ references ============================ */

/** CLM-YYMM-NNNN, checked against the sheet so it is never reused. */
function newReference_() {
  var d = new Date();
  var stamp = String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2);
  for (var attempt = 0; attempt < 40; attempt++) {
    var ref = 'CLM-' + stamp + '-' + String(Math.floor(1000 + Math.random() * 9000));
    if (!findClaim_(ref)) return ref;
  }
  // Vanishingly unlikely — fall back to a timestamp tail.
  return 'CLM-' + stamp + '-' + String(d.getTime()).slice(-6);
}


/* ============================ small helpers ============================ */

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtMoney_(v) {
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  if (!v || isNaN(n) || !n) return '';
  return 'TT$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clean_(v, max) {
  return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 300);
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Port_of_Spain', 'dd MMM yyyy, h:mm a');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function typeLabel_(type) {
  return (CLAIM_TYPES[type] && CLAIM_TYPES[type].label) || 'Claim';
}

function deskFor_(type) {
  return CLAIMS.DESK[type] || CLAIMS.DESK_DEFAULT;
}

function ccList_() {
  return CLAIMS.MAIL_CC.filter(String).join(',');
}

/** Last four digits of a mobile number, used to gate status lookups. */
function last4_(mobile) {
  var digits = String(mobile || '').replace(/\D/g, '');
  return digits.slice(-4);
}


/* ============================ web app routing ============================ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try {
    switch (p.action) {
      case 'ping':       out = { ok: true, service: 'claims-tt', maxFileMb: CLAIMS.MAX_FILE_MB, maxFiles: CLAIMS.MAX_FILES }; break;
      case 'status':     out = apiStatus_(p.ref, p.last4); break;
      case 'findPolicy': out = apiFindPolicy_(p.q); break;
      default:           out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return json_(out);
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Could not read request' });
  }

  if (clean_(body.siteKey, 80) !== CLAIMS.SITE_KEY) {
    return json_({ ok: false, error: 'This form is out of date. Please refresh the page and try again.' });
  }

  var out;
  try {
    switch (body.action) {
      case 'claimStart':   out = apiClaimStart_(body); break;
      case 'claimFile':    out = apiClaimFile_(body); break;
      case 'claimFinish':  out = apiClaimFinish_(body); break;
      case 'verifyPolicy': out = apiVerifyPolicy_(body); break;
      default:             out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return json_(out);
}


/* ============================ claim intake API ============================ */

/**
 * Step 1 — open the claim. Everything the client typed is written
 * to the sheet immediately, so a failed upload never loses the claim
 * itself. Returns the reference the client keeps.
 */
function apiClaimStart_(b) {
  var type = clean_(b.type, 20).toLowerCase();
  if (!CLAIM_TYPES[type]) throw new Error('Please choose what kind of claim you are making.');

  var name = clean_(b.name, 120);
  var mobile = clean_(b.mobile, 40);
  if (!name) throw new Error('Please tell us your name.');
  if (last4_(mobile).length < 4) throw new Error('Please give a mobile number we can reach you on.');

  var ref = newReference_();
  var folder = claimFolder_(ref, name, type);

  var thirdParty = [
    b.tpName ? 'Name: ' + clean_(b.tpName, 120) : '',
    b.tpVehicle ? 'Vehicle: ' + clean_(b.tpVehicle, 120) : '',
    b.tpInsurer ? 'Insurer: ' + clean_(b.tpInsurer, 120) : '',
    b.tpContact ? 'Contact: ' + clean_(b.tpContact, 120) : '',
  ].filter(String).join(' · ');

  var bank = [
    b.bankName ? clean_(b.bankName, 80) : '',
    b.bankBranch ? clean_(b.bankBranch, 80) : '',
    b.bankAccount ? 'A/C ' + clean_(b.bankAccount, 60) : '',
    b.bankType ? '(' + clean_(b.bankType, 30) + ')' : '',
  ].filter(String).join(' · ');

  appendClaim_({
    'Timestamp': new Date(), 'Reference': ref, 'Status': 'Received',
    'Claim Type': typeLabel_(type), 'Sub-type': clean_(b.subtype, 80),
    'Client Name': name, 'Policy #': clean_(b.policy, 60), 'Mobile': mobile,
    'Email': clean_(b.email, 160), 'National ID': clean_(b.nationalId, 40),
    'Incident Date': clean_(b.incidentDate, 30), 'Incident Time': clean_(b.incidentTime, 20),
    'Location': clean_(b.location, 250), 'Description': clean_(b.description, 4000),
    'Estimated Amount (TT$)': clean_(b.amount, 40),
    'Police Report #': clean_(b.policeReport, 60), 'Police Station': clean_(b.policeStation, 120),
    'Third Party': thirdParty, 'Bank Details': bank, 'Files': 0,
    'Missing Documents': '', 'Drive Folder': folder.getUrl(),
    'Claim Form PDF': '', 'Assigned To': '', 'Internal Notes': '',
    'Follow-ups Sent': '', 'Last Updated': new Date(),
  });

  logClaim_(ref, 'claim-opened', 'client',
    typeLabel_(type) + (b.subtype ? ' · ' + clean_(b.subtype, 80) : '') + ' · ' + name);

  return {
    ok: true, ref: ref, folder: folder.getUrl(),
    maxFileMb: CLAIMS.MAX_FILE_MB, maxFiles: CLAIMS.MAX_FILES,
  };
}

/**
 * Step 2 — one document, possibly split across several calls.
 * The client slices the *base64 string* so the parts concatenate
 * back into exactly the original encoding.
 */
function apiClaimFile_(b) {
  var ref = clean_(b.ref, 30).toUpperCase();
  var hit = findClaim_(ref);
  if (!hit) throw new Error('We could not find that claim reference.');

  var uploadId = clean_(b.uploadId, 60);
  var part = Number(b.part) || 0;
  var parts = Number(b.parts) || 1;
  var data = String(b.data || '');
  if (!uploadId) throw new Error('Upload is missing its id.');
  if (!data) throw new Error('That document arrived empty — please try again.');

  var scratch = partsFolder_();

  // Not the last slice: park it and wait for the rest.
  if (part < parts - 1) {
    scratch.createFile(Utilities.newBlob(data, 'text/plain', partName_(ref, uploadId, part)));
    return { ok: true, buffered: true, part: part };
  }

  // Last slice: gather everything in order and rebuild the file.
  var b64 = '';
  for (var i = 0; i < parts - 1; i++) {
    var it = scratch.getFilesByName(partName_(ref, uploadId, i));
    if (!it.hasNext()) throw new Error('Part ' + (i + 1) + ' of that document did not arrive — please re-attach it.');
    var f = it.next();
    b64 += f.getBlob().getDataAsString();
    f.setTrashed(true);
  }
  b64 += data;

  var bytes = Utilities.base64Decode(b64);
  var sizeKb = Math.round(bytes.length / 1024);
  if (bytes.length > CLAIMS.MAX_FILE_MB * 1024 * 1024) {
    throw new Error('That document is larger than ' + CLAIMS.MAX_FILE_MB + 'MB.');
  }

  var docLabel = clean_(b.doc, 120) || 'Document';
  var fileName = safeName_(b.name) || (docLabel + '.dat');
  var mime = clean_(b.mime, 100) || 'application/octet-stream';

  var folderUrl = String(claimField_(hit, 'Drive Folder') || '');
  var folder = folderFromUrl_(folderUrl) ||
    claimFolder_(ref, String(claimField_(hit, 'Client Name') || ''), typeKeyFromLabel_(claimField_(hit, 'Claim Type')));

  var saved = folder.createFile(Utilities.newBlob(bytes, mime, docLabel + ' — ' + fileName));

  filesSheet_().appendRow([new Date(), ref, docLabel, fileName, sizeKb, mime, saved.getUrl()]);

  var count = Number(claimField_(hit, 'Files') || 0) + 1;
  setClaimField_(hit, 'Files', count);
  setClaimField_(hit, 'Last Updated', new Date());

  return { ok: true, name: fileName, sizeKb: sizeKb, link: saved.getUrl(), files: count };
}

function partName_(ref, uploadId, part) {
  return ref + '.' + uploadId + '.' + ('000' + part).slice(-4) + '.part';
}

function folderFromUrl_(url) {
  var m = String(url || '').match(/folders\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try { return DriveApp.getFolderById(m[1]); } catch (err) { return null; }
}

function typeKeyFromLabel_(label) {
  var l = String(label || '').toLowerCase();
  for (var k in CLAIM_TYPES) {
    if (CLAIM_TYPES[k].label.toLowerCase() === l) return k;
  }
  return 'motor';
}

/**
 * Step 3 — everything is in. Notify the claims desk, acknowledge
 * the client, and record whatever they still owe us.
 */
function apiClaimFinish_(b) {
  var ref = clean_(b.ref, 30).toUpperCase();
  var hit = findClaim_(ref);
  if (!hit) throw new Error('We could not find that claim reference.');

  var missing = (b.missing || []).map(function (m) { return clean_(m, 120); }).filter(String);
  setClaimField_(hit, 'Missing Documents', missing.join('; '));
  setClaimField_(hit, 'Last Updated', new Date());

  var files = filesForRef_(ref);
  var claim = claimObject_(hit);

  // The desk works from a form, so render one and file it with the documents.
  var form = null;
  try { form = saveClaimForm_(hit, claim, files, missing); }
  catch (err) { logClaim_(ref, 'claim-form-failed', 'system', String(err)); }

  try { notifyDesk_(claim, files, missing, form); } catch (err) { logClaim_(ref, 'desk-email-failed', 'system', String(err)); }
  if (claim.email) {
    try { ackClient_(claim, files, missing, form); } catch (err) { logClaim_(ref, 'ack-email-failed', 'system', String(err)); }
  }

  logClaim_(ref, 'claim-submitted', 'client',
    files.length + ' document(s)' + (missing.length ? ' · outstanding: ' + missing.join(', ') : ''));

  return { ok: true, ref: ref, files: files.length, missing: missing };
}

function filesForRef_(ref) {
  var sh = filesSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, 7).getValues();
  return rows.filter(function (r) { return String(r[1]).trim().toUpperCase() === ref; })
    .map(function (r) { return { doc: r[2], name: r[3], sizeKb: r[4], mime: r[5], link: r[6] }; });
}

function claimObject_(hit) {
  var g = function (f) { return String(claimField_(hit, f) || ''); };
  return {
    ref: g('Reference'), status: g('Status'), type: g('Claim Type'), subtype: g('Sub-type'),
    name: g('Client Name'), policy: g('Policy #'), mobile: g('Mobile'), email: g('Email'),
    nationalId: g('National ID'), incidentDate: g('Incident Date'), incidentTime: g('Incident Time'),
    location: g('Location'), description: g('Description'), amount: g('Estimated Amount (TT$)'),
    policeReport: g('Police Report #'), policeStation: g('Police Station'),
    thirdParty: g('Third Party'), bank: g('Bank Details'), folder: g('Drive Folder'),
  };
}


/* ============================ policy prefill ============================

 * Nobody can produce a chassis number standing at the roadside, and making
 * them try is most of why claim forms get abandoned. The register knows it
 * already — the job is to hand it over to the right person and nobody else.
 *
 * Two stages, because a number plate is public information:
 *
 *   1. findPolicy  — returns ONLY what is visible from the pavement anyway
 *                    (year, make, model) so the claimant can say "yes, that
 *                    is my car", plus which question they must answer next.
 *                    No name, no contact details, no policy number.
 *   2. verifyPolicy — they answer with the last four digits of the mobile we
 *                    hold, or their policy number. Only then does the record
 *                    come back.
 *
 * Without the split, anyone could type a stranger's plate and collect their
 * name, home email and phone number. With it, a plate alone yields nothing
 * the person standing behind the car cannot already see.
 * ====================================================================== */

function registerSheet_() {
  return namedSheet_(CLAIMS.REGISTER_SHEET, [
    'Reg Key', 'Vehicle Reg', 'Policy Key', 'Policy #', 'Client', 'Email', 'Mobile',
    'Make', 'Model', 'Year', 'Chassis #', 'Engine #', 'Coverage Type',
    'Insured Value (TT$)', 'Windscreen (TT$)', 'Carrier', 'Cover From', 'Cover To',
    'Vehicle Status', 'Years Insured',
  ]);
}

function normKey_(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Every register row, cached for a few minutes — this is read on every lookup. */
function registerRows_() {
  var sh = registerSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  var values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  return values.map(function (row) {
    var o = {};
    headers.forEach(function (h, i) { o[h] = row[i]; });
    return o;
  });
}

/** Match on the plate or the policy number — claimants have one or the other. */
function findVehicle_(query) {
  var key = normKey_(query);
  if (key.length < 4) return null;
  var rows = registerRows_();
  for (var i = 0; i < rows.length; i++) {
    if (normKey_(rows[i]['Reg Key'] || rows[i]['Vehicle Reg']) === key) return rows[i];
  }
  for (var j = 0; j < rows.length; j++) {
    if (normKey_(rows[j]['Policy Key'] || rows[j]['Policy #']) === key) return rows[j];
  }
  return null;
}

/**
 * Five wrong answers on the same plate within fifteen minutes and it stops
 * talking. Enough to stop someone working through last-four-digit guesses,
 * loose enough that a client fumbling their own number never notices.
 */
function verifyThrottle_(key, spend) {
  var cache = CacheService.getScriptCache();
  var slot = 'vfy-' + normKey_(key);
  var used = Number(cache.get(slot) || 0);
  if (used >= 5) return false;
  if (spend) cache.put(slot, String(used + 1), 900);
  return true;
}

/** Stage 1 — confirm the vehicle without giving anything away. */
function apiFindPolicy_(query) {
  var row = findVehicle_(query);
  if (!row) {
    return { ok: true, found: false,
      message: 'We could not match that. Check the plate or policy number — or just fill the form in by hand, it only takes a little longer.' };
  }

  var mobile4 = last4_(row['Mobile']);
  var policyKey = normKey_(row['Policy Key'] || row['Policy #']);
  var descr = [row['Year'], row['Make'], row['Model']].filter(String).join(' ').trim();

  var methods = [];
  if (mobile4.length === 4) {
    methods.push({ id: 'mobile', label: 'The last 4 digits of your mobile number',
      hint: 'The number we have on file for this policy.' });
  }
  if (policyKey.length >= 5) {
    methods.push({ id: 'policy', label: 'Your policy number',
      hint: 'On your certificate of insurance or renewal notice.' });
  }
  if (!methods.length) {
    return { ok: true, found: false,
      message: 'We found the vehicle but have no way to confirm it is yours online. Fill the form in by hand and we will match it up at our end.' };
  }

  return {
    ok: true, found: true,
    vehicle: descr || 'Vehicle on file',
    coverage: String(row['Coverage Type'] || ''),
    methods: methods,
  };
}

/** Stage 2 — they answered; hand over the record. */
function apiVerifyPolicy_(b) {
  var query = clean_(b.query, 40);
  var row = findVehicle_(query);
  if (!row) return { ok: false, error: 'We could not match that policy.' };

  if (!verifyThrottle_(query, false)) {
    return { ok: false, error: 'Too many attempts on this policy. Please wait fifteen minutes, or simply fill the form in by hand.' };
  }

  var answer = clean_(b.answer, 60);
  var method = clean_(b.method, 20);
  var ok = false;

  if (method === 'mobile') {
    var given = String(answer).replace(/\D/g, '').slice(-4);
    ok = given.length === 4 && given === last4_(row['Mobile']);
  } else if (method === 'policy') {
    var pk = normKey_(row['Policy Key'] || row['Policy #']);
    ok = pk.length >= 5 && normKey_(answer) === pk;
  }

  if (!ok) {
    verifyThrottle_(query, true);
    return { ok: false, error: 'That did not match what we have on file. Try again, or fill the form in by hand.' };
  }

  var val = function (f) { return String(row[f] === null || row[f] === undefined ? '' : row[f]).trim(); };
  logClaim_('(lookup)', 'policy-prefill', 'client', 'Matched ' + val('Vehicle Reg') + ' via ' + method);

  return {
    ok: true,
    prefill: {
      vehicleReg: val('Vehicle Reg'), vehicleMake: [val('Make'), val('Model')].filter(String).join(' '),
      vehicleYear: val('Year'), chassis: val('Chassis #'), engine: val('Engine #'),
      policy: val('Policy #'), coverage: val('Coverage Type'),
      insuredValue: val('Insured Value (TT$)'), windscreen: val('Windscreen (TT$)'),
      carrier: val('Carrier'), coverFrom: val('Cover From'), coverTo: val('Cover To'),
      name: val('Client'), email: val('Email'), mobile: val('Mobile'),
    },
  };
}


/* ============================ status lookup ============================ */

/**
 * A client checking back on their claim. The reference alone is not
 * enough — they also have to know the last four digits of the mobile
 * number the claim was filed with.
 */
function apiStatus_(ref, last4) {
  var hit = findClaim_(clean_(ref, 30));
  var given = String(last4 || '').replace(/\D/g, '').slice(-4);
  if (!hit || given.length < 4 || last4_(claimField_(hit, 'Mobile')) !== given) {
    // Same answer either way, so the endpoint cannot be used to probe references.
    return { ok: false, error: 'We could not match that reference and mobile number. Please check both, or call us.' };
  }
  var claim = claimObject_(hit);
  var files = filesForRef_(claim.ref);
  var missing = String(claimField_(hit, 'Missing Documents') || '')
    .split(';').map(function (s) { return s.trim(); }).filter(String);

  return {
    ok: true,
    ref: claim.ref,
    status: claim.status || 'Received',
    type: claim.type,
    subtype: claim.subtype,
    filedOn: Utilities.formatDate(new Date(claimField_(hit, 'Timestamp')),
      Session.getScriptTimeZone() || 'America/Port_of_Spain', 'dd MMM yyyy'),
    documents: files.map(function (f) { return f.doc; }),
    missing: missing,
    agent: { name: CLAIMS.AGENT_NAME, phone: CLAIMS.AGENT_PHONE },
  };
}


/* ============================ emails ============================ */

function tr_(k, v) {
  return '<tr><td style="padding:7px 12px;background:#f4f7fa;border:1px solid #e3eaf2;width:190px;color:#5a6b80">' +
    k + '</td><td style="padding:7px 12px;border:1px solid #e3eaf2">' + v + '</td></tr>';
}

function brandWrap_(inner, tag) {
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433;max-width:640px">' +
    '<div style="background:' + CBRAND.navy + ';color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
    '<table width="100%"><tr>' +
    '<td width="46" valign="middle"><table cellpadding="0" cellspacing="0"><tr><td style="width:38px;height:38px;background:' + CBRAND.gold + ';border-radius:8px 8px 14px 14px;text-align:center;font-size:20px;font-weight:bold;color:' + CBRAND.navy + '">🛡</td></tr></table></td>' +
    '<td valign="middle" style="padding-left:10px"><b style="font-size:18px">Claims TT</b><br>' +
    '<span style="color:#b7c9de;font-size:12px">' + (tag || 'Claim submission') + ' · by ' + esc_(CLAIMS.AGENT_NAME) + '</span></td>' +
    '<td align="right" style="color:' + CBRAND.gold + ';font-size:11px;letter-spacing:2px"><b>CLAIMS</b></td></tr></table></div>' +
    '<div style="border:1px solid #dde5ee;border-top:none;padding:20px 22px;border-radius:0 0 10px 10px">' + inner +
    '<p style="color:#8a97a8;font-size:11px;border-top:1px solid #e3eaf2;padding-top:10px;margin-top:18px">' +
    'Submitting a claim is not an admission of liability by the insurer and does not guarantee payment. ' +
    'Cover and settlement are decided under your policy wording and schedule, which govern in all cases.</p>' +
    '</div></div>';
}

function noteBox_(html) {
  return '<div style="background:#fdf6e9;border-left:4px solid ' + CBRAND.gold + ';padding:12px 16px;margin:14px 0">' + html + '</div>';
}

function sig_() {
  return '<p>Warm regards,<br><b>' + esc_(CLAIMS.AGENT_NAME) + '</b><br>Guardian Group' +
    (CLAIMS.AGENT_PHONE ? '<br>' + esc_(CLAIMS.AGENT_PHONE) : '') + '</p>';
}

function fileListHtml_(files) {
  if (!files.length) return '<p style="color:#8a97a8">No documents were attached.</p>';
  return '<ul style="padding-left:18px;margin:8px 0">' + files.map(function (f) {
    return '<li style="margin:4px 0"><b>' + esc_(f.doc) + '</b> — <a href="' + esc_(f.link) + '">' +
      esc_(f.name) + '</a> <span style="color:#8a97a8">(' + f.sizeKb + ' KB)</span></li>';
  }).join('') + '</ul>';
}

function notifyDesk_(claim, files, missing, form) {
  var type = typeKeyFromLabel_(claim.type);
  var subject = 'NEW CLAIM — ' + claim.ref + ' — ' + claim.type +
    (claim.subtype ? ' (' + claim.subtype + ')' : '') + ' — ' + claim.name;

  MailApp.sendEmail({
    to: deskFor_(type), cc: ccList_(), replyTo: claim.email || undefined, name: CLAIMS.FROM_NAME,
    subject: subject,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433">' +
      '<div style="background:' + CBRAND.navy + ';color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">' +
      '<b>New claim submitted online — ' + esc_(claim.ref) + '</b></div>' +
      '<table style="border-collapse:collapse;width:100%;max-width:680px">' +
      tr_('<b>Reference</b>', '<b>' + esc_(claim.ref) + '</b>') +
      tr_('Claim type', esc_(claim.type) + (claim.subtype ? ' — ' + esc_(claim.subtype) : '')) +
      tr_('Client', esc_(claim.name)) +
      tr_('Policy #', esc_(claim.policy || '(not given)')) +
      tr_('Mobile', esc_(claim.mobile)) +
      tr_('Email', esc_(claim.email || '(none)')) +
      (claim.nationalId ? tr_('National ID', esc_(claim.nationalId)) : '') +
      tr_('Incident', esc_(claim.incidentDate || '(not given)') + (claim.incidentTime ? ' at ' + esc_(claim.incidentTime) : '')) +
      (claim.location ? tr_('Location', esc_(claim.location)) : '') +
      (claim.amount ? tr_('Estimated amount', esc_(fmtMoney_(claim.amount) || claim.amount)) : '') +
      (claim.policeReport ? tr_('Police report #', esc_(claim.policeReport)) : '') +
      (claim.policeStation ? tr_('Police station', esc_(claim.policeStation)) : '') +
      (claim.thirdParty ? tr_('Third party', esc_(claim.thirdParty)) : '') +
      (claim.bank ? tr_('Settlement bank', esc_(claim.bank)) : '') +
      tr_('<b>What happened</b>', esc_(claim.description).replace(/\n/g, '<br>')) +
      '</table>' +
      '<h3 style="margin:20px 0 4px;font-size:15px">Documents received (' + files.length + ')</h3>' +
      fileListHtml_(files) +
      (missing.length
        ? '<div style="background:#fbe9e7;border-left:4px solid #b3261e;padding:12px 16px;margin:14px 0">' +
          '<b>Client flagged as still outstanding:</b><br>' + esc_(missing.join(', ')) + '</div>'
        : '') +
      '<p style="margin:16px 0"><a href="' + esc_(claim.folder) + '" style="background:' + CBRAND.gold +
      ';color:' + CBRAND.navy + ';text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:8px;display:inline-block">' +
      'Open the document folder</a></p>' +
      '<p style="color:#5a6b80;font-size:12px">Submitted through Claims TT on ' + nowStamp_() + '.' +
      (form ? ' The completed claim form is attached and saved in the folder.' : '') + '</p></div>',
    attachments: form ? [form] : [],
  });
}

function ackClient_(claim, files, missing, form) {
  var first = String(claim.name).split(' ')[0] || 'there';
  MailApp.sendEmail({
    to: claim.email, name: CLAIMS.FROM_NAME,
    subject: 'We have your claim — ' + claim.ref,
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_(first) + ',</p>' +
      '<p>Thank you — your <b>' + esc_(claim.type).toLowerCase() + '</b> claim has been received and is now with our claims team.</p>' +
      '<p style="background:' + CBRAND.light + ';border:1px solid #CBEAE8;border-radius:10px;padding:14px 18px;text-align:center;font-size:16px">' +
      'Your claim reference<br><b style="font-size:22px;letter-spacing:1px;color:' + CBRAND.navy + '">' + esc_(claim.ref) + '</b></p>' +
      '<p>Please quote that reference in any call or email about this claim.</p>' +
      '<h3 style="font-size:15px;margin:20px 0 4px">What we received</h3>' +
      fileListHtml_(files) +
      (missing.length
        ? noteBox_('<b style="color:#a05e03">Still needed:</b> ' + esc_(missing.join(', ')) +
            '. Reply to this email with these attached — or upload them at any time — and we will add them to your file. ' +
            'Your claim can only be assessed once they are in.')
        : noteBox_('<b style="color:#a05e03">Nothing outstanding.</b> You have given us everything we asked for at this stage. ' +
            'If the assessor needs anything more, we will contact you.')) +
      '<h3 style="font-size:15px;margin:20px 0 4px">What happens next</h3>' +
      '<ol style="padding-left:18px;color:#3c4a5c">' +
      '<li style="margin:6px 0">Our claims team reviews the file and confirms your cover.</li>' +
      '<li style="margin:6px 0">Where an inspection is needed, an adjuster or approved assessor contacts you directly to arrange it.</li>' +
      '<li style="margin:6px 0">We tell you what is covered, what your excess is, and what the settlement looks like.</li>' +
      '</ol>' +
      noteBox_('<b style="color:#a05e03">Please do not start repairs</b> until the claim has been inspected or you have written approval — ' +
        'work done beforehand may not be reimbursed.') +
      (form ? '<p>Your completed <b>claim form</b> is attached — keep it for your records. You do not need to print, sign or return it; you completed and declared it online.</p>' : '') +
      '<p>Any question at all, call me on <b>' + esc_(CLAIMS.AGENT_PHONE) + '</b> (' + esc_(CLAIMS.BRANCH_HOURS) + ').</p>' +
      sig_(),
      'Claim acknowledgement'),
    attachments: form ? [form] : [],
  });
}

/* ============================ the claim form PDF ============================

 * The desk has always worked from a form, not from an email body, and the
 * adjuster's file needs a document that can be printed and filed. So every
 * claim renders one: the answers laid out as a form, on branded paper, saved
 * beside the documents in the claim's Drive folder and attached to the desk
 * email.
 *
 * Where Guardian's own PDF for a line of business is a fillable AcroForm, the
 * long-run answer is to push the values straight into its named fields. Apps
 * Script cannot do that on its own — see CLAIMS-SETUP.md for how that step
 * gets bolted on. This renderer is what runs today, and it is what keeps the
 * desk working on day one.
 * ======================================================================== */

function pdfRow_(label, value, wide) {
  return '<tr>' +
    '<td style="width:170px;padding:6px 9px;background:#EEF3F8;border:1px solid #C9D8E6;font-size:10.5px;color:#41576E;vertical-align:top">' +
      esc_(label) + '</td>' +
    '<td colspan="' + (wide ? 3 : 1) + '" style="padding:6px 9px;border:1px solid #C9D8E6;font-size:11px;vertical-align:top">' +
      (value ? String(value) : '<span style="color:#9FB2C4">—</span>') + '</td>' +
  '</tr>';
}

function pdfSection_(title) {
  return '<tr><td colspan="4" style="padding:12px 9px 5px;font-size:10px;font-weight:bold;letter-spacing:1.4px;' +
    'text-transform:uppercase;color:' + CBRAND.teal + ';border:none">' + esc_(title) + '</td></tr>';
}

/** The claim, as a form. Returns a PDF blob. */
function claimFormBlob_(claim, files, missing) {
  var nl = function (s) { return esc_(s).replace(/\n/g, '<br>'); };

  var html =
    '<html><body style="font-family:Helvetica,Arial,sans-serif;color:#152435;margin:0">' +
    '<table width="100%" style="border-collapse:collapse;margin-bottom:14px">' +
      '<tr><td style="background:' + CBRAND.navy + ';color:#fff;padding:16px 18px">' +
        '<div style="font-size:19px;font-weight:bold">Claim Form — ' + esc_(claim.type) + '</div>' +
        '<div style="font-size:11px;color:#B7C9DE;margin-top:3px">Claims TT · Ricky Rampersad Branch · Guardian Group</div>' +
      '</td>' +
      '<td style="background:' + CBRAND.navy + ';color:' + CBRAND.gold + ';padding:16px 18px;text-align:right;vertical-align:middle">' +
        '<div style="font-size:9px;letter-spacing:2px;color:#B7C9DE">REFERENCE</div>' +
        '<div style="font-size:19px;font-weight:bold;letter-spacing:1px">' + esc_(claim.ref) + '</div>' +
      '</td></tr>' +
    '</table>' +

    '<table width="100%" style="border-collapse:collapse">' +
      pdfSection_('The claim') +
      pdfRow_('Claim type', esc_(claim.type) + (claim.subtype ? ' — ' + esc_(claim.subtype) : ''), true) +
      pdfRow_('Date filed', nowStamp_(), true) +
      pdfRow_('Status', esc_(claim.status || 'Received'), true) +

      pdfSection_('The claimant') +
      pdfRow_('Name', esc_(claim.name), true) +
      pdfRow_('Policy number', esc_(claim.policy), true) +
      pdfRow_('Mobile', esc_(claim.mobile), true) +
      pdfRow_('Email', esc_(claim.email), true) +
      pdfRow_('National ID', esc_(claim.nationalId), true) +

      pdfSection_('The incident') +
      pdfRow_('Date', esc_(claim.incidentDate) + (claim.incidentTime ? ' at ' + esc_(claim.incidentTime) : ''), true) +
      pdfRow_('Location', esc_(claim.location), true) +
      pdfRow_('Estimated amount', esc_(fmtMoney_(claim.amount) || claim.amount), true) +
      (claim.policeReport || claim.policeStation
        ? pdfRow_('Police report', esc_([claim.policeStation, claim.policeReport].filter(String).join(' · ')), true) : '') +
      (claim.thirdParty ? pdfRow_('Third party', esc_(claim.thirdParty), true) : '') +
      pdfRow_('What happened', nl(claim.description), true) +

      (claim.bank ? pdfSection_('Settlement') + pdfRow_('Bank details', esc_(claim.bank), true) : '') +

      pdfSection_('Documents received (' + files.length + ')') +
      pdfRow_('Attached', files.length
        ? files.map(function (f) { return esc_(f.doc) + ' — ' + esc_(f.name); }).join('<br>')
        : '', true) +
      (missing.length ? pdfRow_('Outstanding', '<b style="color:#B3261E">' + esc_(missing.join('<br>')) + '</b>', true) : '') +
    '</table>' +

    '<table width="100%" style="border-collapse:collapse;margin-top:26px">' +
      '<tr>' +
        '<td style="width:55%;padding-top:26px;border-top:1px solid #41576E;font-size:10px;color:#41576E">' +
          'Claimant\'s signature<br><span style="font-size:9px;color:#7A8FA3">Declared true and complete online on ' + nowStamp_() + '</span></td>' +
        '<td style="width:8%"></td>' +
        '<td style="padding-top:26px;border-top:1px solid #41576E;font-size:10px;color:#41576E">Date</td>' +
      '</tr>' +
    '</table>' +

    '<p style="font-size:9px;color:#7A8FA3;margin-top:20px;line-height:1.5">' +
      'Submitted through Claims TT. Filing a claim is not an admission of liability by the insurer and does not ' +
      'guarantee payment; cover and settlement are determined under the policy wording and schedule, which govern ' +
      'in all cases. The claimant accepted the declaration, information-sharing authority and liability notice online ' +
      'at the time of filing; the audit record is held against reference ' + esc_(claim.ref) + '.' +
    '</p></body></html>';

  return Utilities.newBlob(html, MimeType.HTML, 'Claim Form — ' + claim.ref + '.pdf').getAs(MimeType.PDF);
}

/** Render the form, file it beside the documents, and remember where it went. */
function saveClaimForm_(hit, claim, files, missing) {
  var pdf = claimFormBlob_(claim, files, missing);
  var folder = folderFromUrl_(claim.folder);
  if (folder) {
    var saved = folder.createFile(pdf);
    setClaimField_(hit, 'Claim Form PDF', saved.getUrl());
  }
  return pdf;
}


/* ============================ automated follow-up ============================

 * A claim stalls in one of two places: the client never sends the document
 * they said they would, or the file sits on a desk. This runs daily and
 * pushes on both, and it stops the moment the claim closes — nobody gets
 * chased about a claim that has already settled.
 * ========================================================================= */

function daysSince_(value) {
  var d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return -1;
  return Math.floor((new Date().getTime() - d.getTime()) / 86400000);
}

function isClosed_(status) {
  return CLAIMS.CLOSED_STATUSES.indexOf(String(status || '').trim()) >= 0;
}

/** Follow-ups already sent, as a set of markers like "chase-7" / "desk-25". */
function sentMarkers_(hit) {
  return String(claimField_(hit, 'Follow-ups Sent') || '')
    .split(',').map(function (s) { return s.trim(); }).filter(String);
}
function markSent_(hit, marker) {
  var all = sentMarkers_(hit);
  all.push(marker);
  setClaimField_(hit, 'Follow-ups Sent', all.join(', '));
}

/** Install from the menu. Runs ~9am daily. */
function claimsFollowUp() {
  var sh = claimsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return { chased: 0, nudged: 0 };

  var map = headerMap_(sh);
  var chased = 0, nudged = 0;

  for (var r = 2; r <= last; r++) {
    var hit = { row: r, values: sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0], map: map, sheet: sh };
    var claim = claimObject_(hit);
    if (!claim.ref || isClosed_(claim.status)) continue;

    var age = daysSince_(claimField_(hit, 'Timestamp'));
    var quiet = daysSince_(claimField_(hit, 'Last Updated'));
    if (age < 0) continue;

    var missing = String(claimField_(hit, 'Missing Documents') || '')
      .split(';').map(function (s) { return s.trim(); }).filter(String);
    var sent = sentMarkers_(hit);

    // 1. The client owes us something.
    if (missing.length && claim.email) {
      for (var i = 0; i < CLAIMS.CHASE_DAYS.length; i++) {
        var day = CLAIMS.CHASE_DAYS[i];
        var marker = 'chase-' + day;
        if (age >= day && sent.indexOf(marker) < 0) {
          try {
            sendChase_(claim, missing, i + 1, CLAIMS.CHASE_DAYS.length);
            markSent_(hit, marker);
            if (String(claim.status) === 'Received') setClaimField_(hit, 'Status', 'Awaiting documents');
            logClaim_(claim.ref, 'auto-chase', 'system', 'Reminder ' + (i + 1) + ' · ' + missing.join(', '));
            chased++;
          } catch (err) {
            logClaim_(claim.ref, 'auto-chase-failed', 'system', String(err));
          }
          break;   // one email per claim per day, never a burst
        }
      }
    }

    // 2. Nothing has moved on our side.
    for (var k = 0; k < CLAIMS.DESK_NUDGE_DAYS.length; k++) {
      var nday = CLAIMS.DESK_NUDGE_DAYS[k];
      var nmark = 'desk-' + nday;
      if (quiet >= nday && sent.indexOf(nmark) < 0) {
        try {
          sendDeskNudge_(claim, age, quiet, missing);
          markSent_(hit, nmark);
          logClaim_(claim.ref, 'auto-desk-nudge', 'system', quiet + ' days without movement');
          nudged++;
        } catch (err) {
          logClaim_(claim.ref, 'auto-desk-nudge-failed', 'system', String(err));
        }
        break;
      }
    }
  }
  return { chased: chased, nudged: nudged };
}

function sendChase_(claim, missing, n, total) {
  var closing = n >= total
    ? '<p>This is our last automatic reminder — from here we will call you instead. If these documents are hard to get, tell us and we will work around it; claims have been settled on less.</p>'
    : '<p>If any of these are hard to get hold of, reply and say so. There is almost always another way, and we would rather solve it than have your claim sit still.</p>';

  MailApp.sendEmail({
    to: claim.email, cc: ccList_(), name: CLAIMS.FROM_NAME,
    subject: 'Reminder ' + n + ' — documents needed for claim ' + claim.ref,
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_(String(claim.name).split(' ')[0] || 'there') + ',</p>' +
      '<p>Your <b>' + esc_(String(claim.type).toLowerCase()) + '</b> claim <b>' + esc_(claim.ref) +
      '</b> is open and waiting on you for:</p>' +
      '<ul style="padding-left:18px">' + missing.map(function (m) {
        return '<li style="margin:5px 0"><b>' + esc_(m) + '</b></li>';
      }).join('') + '</ul>' +
      noteBox_('<b style="color:#a05e03">The quickest way:</b> reply to this email with a photo of each one attached. ' +
        'A phone photo is fine — flat, good light, whole page in frame.') +
      closing +
      '<p>Any question, call me on <b>' + esc_(CLAIMS.AGENT_PHONE) + '</b>.</p>' + sig_(),
      'Documents outstanding'),
  });
}

function sendDeskNudge_(claim, age, quiet, missing) {
  MailApp.sendEmail({
    to: deskFor_(typeKeyFromLabel_(claim.type)), cc: ccList_(), name: CLAIMS.FROM_NAME,
    subject: 'Still open after ' + age + ' days — claim ' + claim.ref + ' — ' + claim.name,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2433">' +
      '<div style="background:' + CBRAND.navy + ';color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">' +
      '<b>Open claim with no movement — ' + esc_(claim.ref) + '</b></div>' +
      '<table style="border-collapse:collapse;width:100%;max-width:640px">' +
      tr_('Reference', '<b>' + esc_(claim.ref) + '</b>') +
      tr_('Client', esc_(claim.name) + ' · ' + esc_(claim.mobile)) +
      tr_('Claim type', esc_(claim.type) + (claim.subtype ? ' — ' + esc_(claim.subtype) : '')) +
      tr_('Filed', age + ' days ago') +
      tr_('<b>No movement for</b>', '<b>' + quiet + ' days</b>') +
      tr_('Current status', esc_(claim.status)) +
      (missing.length ? tr_('Waiting on client for', esc_(missing.join(', '))) : tr_('Outstanding from client', 'Nothing — this one is with us')) +
      '</table>' +
      '<p style="margin:16px 0"><a href="' + esc_(claim.folder) + '" style="background:' + CBRAND.gold +
      ';color:' + CBRAND.navy + ';text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:8px;display:inline-block">' +
      'Open the claim folder</a></p>' +
      '<p style="color:#5a6b80;font-size:12px">Automatic reminder from Claims TT. It stops as soon as the claim reaches ' +
      esc_(CLAIMS.CLOSED_STATUSES.join(', ')) + '.</p></div>',
  });
}

function runFollowUpNow() {
  var out = claimsFollowUp();
  SpreadsheetApp.getUi().alert('Follow-up run complete.\n\n' +
    out.chased + ' client reminder(s) sent\n' + out.nudged + ' desk nudge(s) sent');
}


/** Menu action: nudge a client about documents still outstanding. */
function chaseMissingDocuments() {
  var sh = claimsSheet_();
  var sel = sh.getActiveRange();
  if (!sel || sel.getRow() < 2) {
    SpreadsheetApp.getUi().alert('Select the claim row (or rows) you want to chase, then run this again.');
    return;
  }
  var map = headerMap_(sh);
  var sent = 0, skipped = [];
  for (var r = sel.getRow(); r < sel.getRow() + sel.getNumRows(); r++) {
    var values = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
    var hit = { row: r, values: values, map: map, sheet: sh };
    var claim = claimObject_(hit);
    var missing = String(claimField_(hit, 'Missing Documents') || '')
      .split(';').map(function (s) { return s.trim(); }).filter(String);

    if (!claim.email) { skipped.push(claim.ref + ' (no email)'); continue; }
    if (!missing.length) { skipped.push(claim.ref + ' (nothing outstanding)'); continue; }

    MailApp.sendEmail({
      to: claim.email, cc: ccList_(), name: CLAIMS.FROM_NAME,
      subject: 'Documents still needed for your claim — ' + claim.ref,
      htmlBody: brandWrap_(
        '<p>Dear ' + esc_(String(claim.name).split(' ')[0] || 'there') + ',</p>' +
        '<p>We are working on your <b>' + esc_(String(claim.type).toLowerCase()) + '</b> claim <b>' + esc_(claim.ref) +
        '</b>, but it cannot move forward until we receive:</p>' +
        '<ul style="padding-left:18px">' + missing.map(function (m) {
          return '<li style="margin:4px 0"><b>' + esc_(m) + '</b></li>';
        }).join('') + '</ul>' +
        '<p>Simply reply to this email with clear photos or scans attached — a phone photo is perfectly acceptable as long as the whole document is in frame and readable.</p>' +
        sig_(), 'Documents outstanding'),
    });
    setClaimField_(hit, 'Status', 'Awaiting documents');
    setClaimField_(hit, 'Last Updated', new Date());
    logClaim_(claim.ref, 'chased-documents', Session.getActiveUser().getEmail() || 'staff', missing.join(', '));
    sent++;
  }
  SpreadsheetApp.getUi().alert('Chased ' + sent + ' claim(s).' +
    (skipped.length ? '\n\nSkipped: ' + skipped.join(', ') : ''));
}

/** Menu action: tell the client their status changed. */
function notifyStatusChange() {
  var sh = claimsSheet_();
  var sel = sh.getActiveRange();
  if (!sel || sel.getRow() < 2) {
    SpreadsheetApp.getUi().alert('Select the claim row you want to update, then run this again.');
    return;
  }
  var map = headerMap_(sh);
  var hit = { row: sel.getRow(), values: sh.getRange(sel.getRow(), 1, 1, sh.getLastColumn()).getValues()[0], map: map, sheet: sh };
  var claim = claimObject_(hit);
  if (!claim.email) { SpreadsheetApp.getUi().alert('That claim has no email address on file — please call the client.'); return; }

  MailApp.sendEmail({
    to: claim.email, cc: ccList_(), name: CLAIMS.FROM_NAME,
    subject: 'Update on your claim — ' + claim.ref,
    htmlBody: brandWrap_(
      '<p>Dear ' + esc_(String(claim.name).split(' ')[0] || 'there') + ',</p>' +
      '<p>Your claim <b>' + esc_(claim.ref) + '</b> has moved to:</p>' +
      '<p style="background:' + CBRAND.light + ';border:1px solid #CBEAE8;border-radius:10px;padding:14px 18px;text-align:center">' +
      '<b style="font-size:19px;color:' + CBRAND.navy + '">' + esc_(claim.status) + '</b></p>' +
      '<p>We will be in touch as soon as there is more to tell you. Call me on <b>' + esc_(CLAIMS.AGENT_PHONE) +
      '</b> if you would like to talk it through.</p>' + sig_(), 'Claim update'),
  });
  setClaimField_(hit, 'Last Updated', new Date());
  logClaim_(claim.ref, 'status-emailed', Session.getActiveUser().getEmail() || 'staff', claim.status);
  SpreadsheetApp.getUi().alert('Update sent to ' + claim.email + '.');
}


/* ============================ housekeeping ============================ */

/** Sweep upload parts abandoned by a client who closed the tab mid-upload. */
function sweepAbandonedParts() {
  var cutoff = new Date().getTime() - CLAIMS.CHUNK_TTL_MINUTES * 60 * 1000;
  var files = partsFolder_().getFiles();
  var removed = 0;
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated().getTime() < cutoff) { f.setTrashed(true); removed++; }
  }
  return removed;
}


/* ============================ setup & menu ============================ */

function setupClaims() {
  filesSheet_(); logSheet_(); registerSheet_();
  var root = rootFolder_();

  // Status column gets a dropdown so the desk cannot invent new statuses.
  var sh = claimsSheet_();
  var map = headerMap_(sh);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(CLAIMS.STATUSES, true).build();
  sh.getRange(2, map['status'] + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  sh.setColumnWidth(map['description'] + 1, 380);

  ['sweepAbandonedParts', 'claimsFollowUp'].forEach(function (fn) {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
    });
  });
  ScriptApp.newTrigger('sweepAbandonedParts').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('claimsFollowUp').timeBased().everyDays(1).atHour(9).create();

  var vehicles = Math.max(registerSheet_().getLastRow() - 1, 0);
  SpreadsheetApp.getUi().alert(
    'Claims TT is ready.\n\n' +
    'Tabs: ' + CLAIMS.CLAIMS_SHEET + ', ' + CLAIMS.FILES_SHEET + ', ' +
      CLAIMS.LOG_SHEET + ', ' + CLAIMS.REGISTER_SHEET + '\n' +
    'Drive folder: ' + root.getUrl() + '\n' +
    'Automatic follow-up: installed, runs daily ~9am\n' +
    'Vehicle register: ' + vehicles + ' vehicle(s)' +
      (vehicles ? '' : ' — import data/vehicle-register.csv to switch on policy prefill') + '\n\n' +
    'Next: Deploy → New deployment → Web app (execute as Me, access Anyone), ' +
    'then paste the /exec URL into CONFIG.API_URL in claims/index.html.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Claims TT')
    .addItem('1. Set up / repair everything', 'setupClaims')
    .addSeparator()
    .addItem('Open the claims Drive folder', 'openClaimsFolder')
    .addItem('Email the client their new status', 'notifyStatusChange')
    .addItem('Chase outstanding documents now', 'chaseMissingDocuments')
    .addSeparator()
    .addItem('Run the follow-up sweep now (test)', 'runFollowUpNow')
    .addItem('Clean up abandoned uploads', 'cleanupNow')
    .addToUi();
}

function openClaimsFolder() {
  SpreadsheetApp.getUi().alert('Claims documents live here:\n\n' + rootFolder_().getUrl());
}

function cleanupNow() {
  SpreadsheetApp.getUi().alert('Removed ' + sweepAbandonedParts() + ' abandoned upload part(s).');
}
