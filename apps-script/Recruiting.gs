/**
 * RRB · Recruit Tracker — backend
 * =============================================================================
 * Bound to the "RRB Recruit Tracker" workbook. Serves the tracker at
 * /recruiting/ on rickyrampersadbranch.com.
 *
 * Why this exists. The tracker arrived from the Project as a Netlify bundle
 * that kept every candidate in the browser's IndexedDB and carried the branch's
 * production figures, POP scores and coaching notes inside the page. Two things
 * were wrong with that. Kerwyn's laptop and Gary's laptop held separate copies
 * that never met, so no branch-wide view could be right for anyone. And the
 * page was about to be served from a public repository, which would have
 * published one candidate's police certificate and eighteen people's scores.
 *
 * So the page now holds the app and nothing else. Everything personal lives in
 * this workbook and in a private Drive folder, and leaves here only to somebody
 * who has signed in against the Access tab.
 *
 *   Access       who may sign in, their role, their password
 *   Candidates   one row per candidate: the index columns, then the record as
 *                JSON in 45,000-character chunks (a cell holds 50,000)
 *   Documents    one row per uploaded file: candidate, item number, Drive id
 *   Production   agent production — the PRODUCTION_DATA the page used to carry
 *   Cohort       POP scores by recruit and year — COHORT_DATA
 *   ManagerPulse weekly coaching summary per manager — MANAGER_PULSE_SUMMARY
 *   Variance     projected against actual by agent and month
 *   MarketSurveys market survey quality by agent
 *   AiLog        every call to Claude: who asked, for whom, what it cost
 *
 * The files themselves go to Drive, not to cells: a POP report is 1.5 MB and a
 * cell holds 50 KB. The folder is created on first use and its id kept in the
 * Script Property RT_DOC_FOLDER.
 *
 * Setup lives in RECRUITING-SETUP.md at the repo root.
 * =============================================================================
 */

/* Same reasoning as KPI.gs: from outside you cannot tell whether a paste-and-
   redeploy took. Bump this in the same commit as any change to this file; the
   page shows it, and `ping` returns it. */
var SCRIPT_VERSION = '2026-09-06b';

var CONFIG = {
  TZ: 'America/Port_of_Spain',
  /* CacheService will not hold anything longer than six hours, whatever number
     is passed. KPI.gs asks for twelve and gets six. Ask for what is granted. */
  TOKEN_HOURS: 6,
  CHUNK: 45000,
  TABS: {
    access: 'Access',
    candidates: 'Candidates',
    documents: 'Documents',
    production: 'Production',
    cohort: 'Cohort',
    managerPulse: 'ManagerPulse',
    variance: 'Variance',
    marketSurveys: 'MarketSurveys',
    aiLog: 'AiLog'
  },
  DOC_FOLDER_PROP: 'RT_DOC_FOLDER',
  DOC_FOLDER_NAME: 'RRB Recruit Tracker — Documents',
  AI_MODEL: 'claude-opus-5'
};

/* Every tab's header row. A tab that is missing is created with these; a tab
   that exists is read by header name, so columns may be reordered freely. */
var HEADERS = {
  access:       ['Name', 'Role', 'Password', 'Email', 'Active'],
  candidates:   ['Id', 'Name', 'Stage', 'RecruitingManager', 'Updated', 'Created', 'CreatedBy', 'Chunks', 'Json1'],
  documents:    ['CandidateId', 'DocKey', 'FileId', 'Filename', 'MediaType', 'SizeKB', 'UploadedAt', 'UploadedBy'],
  production:   ['agentId', 'name', 'apps', 'settledAPI', 'lapsedCount', 'lapsedAPI', 'note', 'terminated'],
  cohort:       ['name', 'year', 'rm', 'PS', 'EP', 'AP', 'IP', 'SD', 'LM', 'CR', 'finalRating', 'light',
                 'probSuccess', 'decision', 'outcome', 'agentId', 'hireDate', 'termDate', 'employmentStatus', 'flag'],
  managerPulse: ['manager', 'submissions', 'on_pace', 'slightly_behind', 'behind', 'missed_weeks', 'started',
                 'coaching_method', 'agents_named', 'repeat_offenders', 'pattern'],
  variance:     ['key', 'agent', 'month', 'rm', 'income_proj', 'income_actual', 'income_var_pct', 'leads_proj',
                 'leads_actual', 'leads_var_pct', 'ff_proj', 'ff_actual', 'ff_var_pct', 'close_proj', 'close_actual',
                 'close_var_pct', 'apps_proj', 'apps_actual', 'api_actual', 'note'],
  marketSurveys:['name', 'count', 'avg', 'zeros', 'range', 'manager', 'flag', 'note'],
  aiLog:        ['When', 'Who', 'Kind', 'Candidate', 'Model', 'InputTokens', 'OutputTokens', 'Status']
};

function ss_() { return SpreadsheetApp.getActive(); }
function nowIso_() { return new Date().toISOString(); }
function todayISO_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'); }

// ---------------------------------------------------------------------------
//  Tabs
// ---------------------------------------------------------------------------

/** Run once from the editor after pasting. Makes every tab, the Drive folder,
 *  and an Access row for whoever runs it, then logs what to do next. Safe to
 *  run again — nothing that exists is touched. */
function setup() {
  Object.keys(HEADERS).forEach(function (k) { tab_(k); });
  docFolder_();
  var access = tab_('access');
  if (access.getLastRow() < 2) {
    var me = Session.getEffectiveUser().getEmail();
    access.appendRow(['Ricky Rampersad', 'Branch Manager', 'change-me', me, 'Yes']);
    Logger.log('Access tab made with one row for ' + me + '. Change its password before anyone signs in.');
  }
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  Logger.log(key ? 'ANTHROPIC_API_KEY is set.' : 'No ANTHROPIC_API_KEY yet — the three AI buttons will say so until it is.');
  Logger.log('Documents folder: ' + docFolder_().getUrl());
  Logger.log('Now Deploy > New deployment > Web app > Execute as Me > Anyone, and paste the URL into recruiting/app.js.');
}

var _tabMemo = {};
function tab_(key) {
  if (_tabMemo[key]) return _tabMemo[key];
  var name = CONFIG.TABS[key];
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[key].length).setValues([HEADERS[key]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  _tabMemo[key] = sh;
  return sh;
}

var _headMemo = {};
function headerOf_(sh) {
  var id = sh.getSheetId();
  if (_headMemo[id]) return _headMemo[id];
  var head = [];
  if (sh.getLastColumn() >= 1) {
    head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h || '').trim(); });
  }
  _headMemo[id] = head;
  return head;
}

/** Column index (0-based) of a header, matched without regard to case. -1 if
 *  the tab does not carry it. */
function col_(sh, name) {
  var head = headerOf_(sh), want = String(name).toLowerCase();
  for (var i = 0; i < head.length; i++) if (head[i].toLowerCase() === want) return i;
  return -1;
}

/** Every data row of a tab as an object keyed by header. Dates come back as
 *  yyyy-MM-dd strings, because Sheets turns "2026-01-13" into a Date the moment
 *  it is pasted, and a Date is not what the page was written to read. */
function readObjects_(sh) {
  if (sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return vals.map(function (r) {
    var o = {};
    head.forEach(function (h, i) { if (h) o[h] = cell_(r[i]); });
    return o;
  }).filter(function (o) {
    return Object.keys(o).some(function (k) { return o[k] !== '' && o[k] != null; });
  });
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'yyyy-MM-dd');
  return v == null ? '' : v;
}
function num_(v) {
  if (v === '' || v == null) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}
function str_(v) { return v == null ? '' : String(v); }
function strOrNull_(v) { var s = str_(v).trim(); return s ? s : null; }
function splitList_(v) {
  return str_(v).split(/[,;]\s*/).map(function (s) { return s.trim(); }).filter(String);
}

/** Find the sheet row (1-based) whose column `colName` equals `value`. */
function findRow_(sh, colName, value) {
  var c = col_(sh, colName);
  if (c < 0 || sh.getLastRow() < 2) return -1;
  var vals = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return -1;
}

// ---------------------------------------------------------------------------
//  Who is who — the Access tab
//
//  Same shape as KPI.gs. The password column never leaves the server; the
//  check happens here, a token goes back, and the token is what every later
//  request carries.
// ---------------------------------------------------------------------------

var _rosterMemo = null;
function roster_() {
  if (_rosterMemo) return _rosterMemo;
  var out = readObjects_(tab_('access')).map(function (r) {
    var active = str_(r.Active || r.active || 'Yes').trim();
    return {
      name: str_(r.Name || r.name).trim(),
      role: str_(r.Role || r.role).trim(),
      password: str_(r.Password != null ? r.Password : r.password).trim(),
      email: str_(r.Email || r.email).trim().toLowerCase(),
      active: !/^(no|inactive|false|0)$/i.test(active)
    };
  }).filter(function (p) { return p.name || p.email; });
  _rosterMemo = out;
  return out;
}

/** Nobody types "Assistant Branch Manager" into a spreadsheet. They type
 *  "Assit Branch Mgr". Same expansion as KPI.gs so the two tabs can be written
 *  the same way. */
function normRole_(t) {
  return String(t || '').toLowerCase()
    .replace(/[‘’'`]s\b/g, 's')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\b(?:managers|manager|mgrs|mgr|mngr|mgnr|manger|managr|mananger|mgt)\b/g, 'manager')
    .replace(/\b(?:assistant|assistants|assistent|assitant|assistan|assit|asst|assis|asstt|ast)\b/g, 'assistant')
    .replace(/\s+/g, ' ').trim();
}

/* The page knows four roles: BM, BMA, RM and INV. The branch has five jobs.
   Kerwyn is the Assistant Branch Manager and also recruits, so he is an RM who
   sees the whole branch; Gary and Akaash are Unit Managers, RMs who see their
   own unit. `scope` is the part that matters for the data. */
function appRole_(person) {
  var t = normRole_(person.role);
  if (/assistant branch manager|\babm\b/.test(t))        return { role: 'RM',  scope: 'all', title: 'Assistant Branch Manager' };
  if (/branch manager assistant|\bbma\b|assistant/.test(t)) return { role: 'BMA', scope: 'all', title: 'Branch Manager Assistant' };
  if (/branch manager|\bbm\b/.test(t))                    return { role: 'BM',  scope: 'all', title: 'Branch Manager' };
  if (/investigat|\binv\b|inspect/.test(t))               return { role: 'INV', scope: 'all', title: 'Investigator' };
  if (/unit manager|sales manager|\bum\b|\bmanager\b/.test(t)) return { role: 'RM', scope: 'own', title: 'Unit Manager' };
  return { role: 'RM', scope: 'own', title: person.role || 'Recruiting Manager' };
}

function profileOf_(person) {
  var r = appRole_(person);
  return { name: person.name, email: person.email, role: r.role, scope: r.scope, title: r.title };
}

function issueToken_(person) {
  var token = Utilities.getUuid();
  var profile = profileOf_(person);
  CacheService.getScriptCache().put('rt_' + token, JSON.stringify(profile), CONFIG.TOKEN_HOURS * 3600);
  return { token: token, profile: profile };
}

function readToken_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('rt_' + String(token));
  return raw ? JSON.parse(raw) : null;
}

/** Five wrong tries buys a fifteen-minute wait. */
var LOGIN_MAX_TRIES = 5, LOGIN_LOCK_SECONDS = 900;
function failKey_(key) { return 'rtfail_' + key; }
function tooManyTries_(key) {
  return (Number(CacheService.getScriptCache().get(failKey_(key))) || 0) >= LOGIN_MAX_TRIES;
}
function noteFailure_(key) {
  var c = CacheService.getScriptCache();
  c.put(failKey_(key), String((Number(c.get(failKey_(key))) || 0) + 1), LOGIN_LOCK_SECONDS);
}
function clearFailures_(key) { CacheService.getScriptCache().remove(failKey_(key)); }

/** Identity is the name as it appears on the Access tab, or the email. Five
 *  people sign in here; nobody should have to remember an agent number. */
function login_(who, password) {
  var key = String(who || '').trim().toLowerCase();
  var pass = String(password == null ? '' : password).trim();
  if (!key) return { ok: false, error: 'Enter your name.' };
  if (tooManyTries_(key)) {
    return { ok: false, error: 'Too many attempts. Wait fifteen minutes, or ask the Branch Manager.' };
  }
  var person = null, people = roster_();
  for (var i = 0; i < people.length; i++) {
    var p = people[i];
    if (p.name.toLowerCase() === key || (p.email && p.email === key)) { person = p; break; }
  }
  if (!person) { noteFailure_(key); return { ok: false, error: 'Not recognised. Use your name exactly as it is on the Access tab.' }; }
  if (!person.active) return { ok: false, error: 'That account is not active. Speak to the Branch Manager.' };
  if (person.password !== pass) { noteFailure_(key); return { ok: false, error: 'Wrong password.' }; }
  clearFailures_(key);
  var t = issueToken_(person);
  return sessionPayload_(t.profile, t.token);
}

/** What the page needs to start: who you are, the roster minus passwords,
 *  and the datasets you are allowed to see. One round trip, not four. */
function sessionPayload_(profile, token) {
  var out = {
    ok: true,
    profile: profile,
    roster: publicRoster_(),
    datasets: datasetsFor_(profile),
    version: SCRIPT_VERSION,
    aiEnabled: !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY')
  };
  if (token) out.token = token;
  return out;
}

function publicRoster_() {
  return roster_().filter(function (p) { return p.active; }).map(function (p) {
    var r = appRole_(p);
    return { name: p.name, role: r.role, scope: r.scope, title: r.title };
  });
}

// ---------------------------------------------------------------------------
//  Names
//
//  The data writes managers three ways: "Gary", "Gary Sookdeo", and in one
//  place "Gary " with a space. First names match when the full names do not.
//  That is safe while no two managers share a first name; the day they do,
//  put the full name in every column and tighten this to a full match.
// ---------------------------------------------------------------------------

function firstName_(s) { return String(s || '').trim().toLowerCase().split(/[\s.]+/)[0] || ''; }
function samePerson_(a, b) {
  var x = String(a || '').trim().toLowerCase(), y = String(b || '').trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || firstName_(x) === firstName_(y);
}

/** Can this profile see this candidate? Everyone with scope `all` can. A Unit
 *  Manager sees the candidates they recruit and the ones they created — the
 *  second half matters because a new candidate has no recruiting manager yet. */
function canSee_(profile, rec) {
  if (profile.scope === 'all') return true;
  return samePerson_(rec.recruitingManager, profile.name) || samePerson_(rec.createdBy, profile.name);
}

// ---------------------------------------------------------------------------
//  Candidates
// ---------------------------------------------------------------------------

/** Every candidate row as {id, name, stage, recruitingManager, updated,
 *  created, createdBy, json}. Reads the tab once. */
function allCandidates_() {
  var sh = tab_('candidates');
  if (sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  var idx = {};
  head.forEach(function (h, i) { idx[h.toLowerCase()] = i; });
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var out = [];
  vals.forEach(function (r, i) {
    var id = str_(r[idx['id']]).trim();
    if (!id) return;
    var chunks = Number(r[idx['chunks']]) || 0, json = '';
    for (var c = 1; c <= chunks; c++) {
      var ci = idx['json' + c];
      if (ci == null) break;
      json += str_(r[ci]);
    }
    out.push({
      row: i + 2,
      id: id,
      name: str_(r[idx['name']]),
      stage: str_(r[idx['stage']]),
      recruitingManager: str_(r[idx['recruitingmanager']]),
      updated: str_(cell_(r[idx['updated']])),
      created: str_(cell_(r[idx['created']])),
      createdBy: str_(r[idx['createdby']]),
      json: json
    });
  });
  return out;
}

function list_(profile) {
  var mine = allCandidates_().filter(function (c) { return canSee_(profile, c); });
  var records = {};
  mine.forEach(function (c) { records[c.id] = c.json; });
  return {
    ok: true,
    list: mine.map(function (c) {
      return { id: c.id, name: c.name, currentStage: c.stage, updated: c.updated };
    }),
    candidates: records
  };
}

function get_(profile, id) {
  var c = allCandidates_().filter(function (x) { return x.id === id; })[0];
  if (!c) return { ok: false, error: 'No candidate with id ' + id };
  if (!canSee_(profile, c)) return { ok: false, error: 'That candidate is not in your unit.' };
  return { ok: true, id: id, json: c.json };
}

/* Two managers saving at once, or one manager's page firing two saves in a
   row, must not append two rows for one candidate. The KPI log did exactly
   that for a month before anyone noticed. The lock makes the find-then-write
   one step. */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function save_(profile, data) {
  var id = str_(data.id).trim();
  var json = str_(data.json);
  if (!id || !json) return { ok: false, error: 'Nothing to save.' };
  var rec;
  try { rec = JSON.parse(json); } catch (e) { return { ok: false, error: 'The record is not valid JSON.' }; }
  if (!rec || rec.id !== id) return { ok: false, error: 'Record id does not match.' };

  /* A file arriving inside the record goes to Drive, whatever the page did.
     The page blanks these before sending; this is the belt to that brace. */
  var moved = spillBlobs_(profile, id, rec);
  if (moved) json = JSON.stringify(rec);

  var meta = rec.meta || {};
  return withLock_(function () {
    var sh = tab_('candidates');
    var row = findRow_(sh, 'Id', id);
    var existing = row > 0 ? allCandidates_().filter(function (c) { return c.id === id; })[0] : null;
    if (existing && !canSee_(profile, existing)) return { ok: false, error: 'That candidate is not in your unit.' };

    var createdBy = existing ? existing.createdBy : profile.name;
    var created = existing && existing.created ? existing.created : (rec.created || nowIso_());
    var chunks = [];
    for (var i = 0; i < json.length; i += CONFIG.CHUNK) chunks.push(json.slice(i, i + CONFIG.CHUNK));

    ensureJsonColumns_(sh, chunks.length);
    var head = headerOf_(sh);
    var out = head.map(function () { return ''; });
    var put = function (name, v) { var c = col_(sh, name); if (c >= 0) out[c] = v; };
    put('Id', id);
    put('Name', str_(meta.name));
    put('Stage', str_(meta.currentStage));
    put('RecruitingManager', str_(meta.recruitingManager));
    put('Updated', str_(rec.updated || nowIso_()));
    put('Created', created);
    put('CreatedBy', createdBy);
    put('Chunks', chunks.length);
    chunks.forEach(function (ch, i) { put('Json' + (i + 1), ch); });

    if (row > 0) sh.getRange(row, 1, 1, out.length).setValues([out]);
    else sh.appendRow(out);
    return { ok: true, id: id, updated: out[col_(sh, 'Updated')] };
  });
}

/** A record can grow past one chunk; the tab grows with it. */
function ensureJsonColumns_(sh, n) {
  var head = headerOf_(sh), added = false;
  for (var i = 1; i <= n; i++) {
    if (col_(sh, 'Json' + i) < 0) {
      sh.getRange(1, head.length + 1).setValue('Json' + i).setFontWeight('bold');
      head.push('Json' + i);
      added = true;
    }
  }
  if (added) delete _headMemo[sh.getSheetId()];
}

function delete_(profile, id) {
  if (profile.role !== 'BM') return { ok: false, error: 'Only the Branch Manager can delete a candidate.' };
  return withLock_(function () {
    var sh = tab_('candidates');
    var row = findRow_(sh, 'Id', id);
    if (row < 0) return { ok: true, id: id, note: 'Already gone.' };
    sh.deleteRow(row);
    /* The files stay in Drive. Deleting a row is a click; a police certificate
       is not something to lose to a click. Tidy the folder by hand. */
    return { ok: true, id: id };
  });
}

// ---------------------------------------------------------------------------
//  Documents — Drive, not cells
// ---------------------------------------------------------------------------

function docFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CONFIG.DOC_FOLDER_PROP);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* folder gone — make another */ }
  }
  var it = DriveApp.getFoldersByName(CONFIG.DOC_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.DOC_FOLDER_NAME);
  props.setProperty(CONFIG.DOC_FOLDER_PROP, folder.getId());
  return folder;
}

function candidateFolder_(candidateId) {
  var root = docFolder_();
  var it = root.getFoldersByName(candidateId);
  return it.hasNext() ? it.next() : root.createFolder(candidateId);
}

/** Store one file. `docKey` is the item number on the selection file ("3",
 *  "6.a", "13") or "pop" for the POP 7 report. Replacing a file trashes the
 *  old one rather than leaving two in the folder. */
function docPut_(profile, data) {
  var candidateId = str_(data.candidateId).trim(), docKey = str_(data.docKey).trim();
  if (!candidateId || !docKey) return { ok: false, error: 'Which candidate, which item?' };
  var cand = allCandidates_().filter(function (c) { return c.id === candidateId; })[0];
  if (cand && !canSee_(profile, cand)) return { ok: false, error: 'That candidate is not in your unit.' };
  var b64 = str_(data.base64);
  if (!b64) return { ok: false, error: 'No file content.' };
  var mediaType = str_(data.mediaType) || 'application/pdf';
  var filename = str_(data.filename) || (docKey + '.' + (mediaType.split('/')[1] || 'bin'));

  return withLock_(function () {
    var bytes = Utilities.base64Decode(b64);
    var blob = Utilities.newBlob(bytes, mediaType, docKey + ' — ' + filename);
    var file = candidateFolder_(candidateId).createFile(blob);

    var sh = tab_('documents');
    var row = docRow_(sh, candidateId, docKey);
    if (row > 0) {
      var oldId = str_(sh.getRange(row, col_(sh, 'FileId') + 1).getValue());
      if (oldId && oldId !== file.getId()) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch (e) {} }
    }
    var head = headerOf_(sh);
    var out = head.map(function () { return ''; });
    var put = function (name, v) { var c = col_(sh, name); if (c >= 0) out[c] = v; };
    put('CandidateId', candidateId);
    put('DocKey', docKey);
    put('FileId', file.getId());
    put('Filename', filename);
    put('MediaType', mediaType);
    put('SizeKB', Math.round(bytes.length / 1024));
    put('UploadedAt', nowIso_());
    put('UploadedBy', str_(data.uploadedBy) || profile.name);
    if (row > 0) sh.getRange(row, 1, 1, out.length).setValues([out]);
    else sh.appendRow(out);
    return { ok: true, fileId: file.getId(), sizeKB: Math.round(bytes.length / 1024) };
  });
}

function docRow_(sh, candidateId, docKey) {
  if (sh.getLastRow() < 2) return -1;
  var ci = col_(sh, 'CandidateId'), ki = col_(sh, 'DocKey');
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][ci]) === candidateId && String(vals[i][ki]) === docKey) return i + 2;
  }
  return -1;
}

function docGet_(profile, data) {
  var candidateId = str_(data.candidateId).trim(), docKey = str_(data.docKey).trim();
  var cand = allCandidates_().filter(function (c) { return c.id === candidateId; })[0];
  if (cand && !canSee_(profile, cand)) return { ok: false, error: 'That candidate is not in your unit.' };
  var sh = tab_('documents');
  var row = docRow_(sh, candidateId, docKey);
  if (row < 0) return { ok: false, error: 'No such file.', missing: true };
  var fileId = str_(sh.getRange(row, col_(sh, 'FileId') + 1).getValue());
  var mediaType = str_(sh.getRange(row, col_(sh, 'MediaType') + 1).getValue()) || 'application/pdf';
  try {
    var bytes = DriveApp.getFileById(fileId).getBlob().getBytes();
    return { ok: true, base64: Utilities.base64Encode(bytes), mediaType: mediaType };
  } catch (e) {
    return { ok: false, error: 'The file is no longer in Drive.', missing: true };
  }
}

function docDelete_(profile, data) {
  var candidateId = str_(data.candidateId).trim(), docKey = str_(data.docKey).trim();
  var cand = allCandidates_().filter(function (c) { return c.id === candidateId; })[0];
  if (cand && !canSee_(profile, cand)) return { ok: false, error: 'That candidate is not in your unit.' };
  return withLock_(function () {
    var sh = tab_('documents');
    var row = docRow_(sh, candidateId, docKey);
    if (row < 0) return { ok: true };
    var fileId = str_(sh.getRange(row, col_(sh, 'FileId') + 1).getValue());
    try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    sh.deleteRow(row);
    return { ok: true };
  });
}

/** Files that arrived inside a record are moved to Drive and blanked in the
 *  record. Returns true if anything moved. */
function spillBlobs_(profile, id, rec) {
  var moved = false;
  var uploads = rec.stages && rec.stages.selectionFile && rec.stages.selectionFile.documentUploads;
  if (uploads) {
    Object.keys(uploads).forEach(function (k) {
      var u = uploads[k];
      if (u && u.base64) {
        var r = docPut_(profile, { candidateId: id, docKey: k, base64: u.base64, mediaType: u.mediaType,
                                   filename: u.filename, uploadedBy: u.uploadedBy });
        if (r.ok) { u.base64 = ''; u.hasBlob = true; moved = true; }
      }
    });
  }
  var pop = rec.stages && rec.stages.pop7Review && rec.stages.pop7Review.uploadedReport;
  if (pop && pop.base64) {
    var r2 = docPut_(profile, { candidateId: id, docKey: 'pop', base64: pop.base64, mediaType: pop.mediaType,
                                filename: pop.filename });
    if (r2.ok) { pop.base64 = ''; pop.hasBlob = true; moved = true; }
  }
  return moved;
}

// ---------------------------------------------------------------------------
//  Datasets — the figures the page used to carry
//
//  Read by header so the tabs can be maintained in the sheet by hand. Shaped
//  here into exactly what the page's components were written against, so the
//  components did not have to change.
// ---------------------------------------------------------------------------

function datasetsFor_(profile) {
  var own = profile.scope !== 'all';
  var me = profile.name;

  var cohort = readObjects_(tab_('cohort')).map(function (r) {
    return {
      name: str_(r.name), year: num_(r.year), rm: str_(r.rm),
      PS: num_(r.PS), EP: num_(r.EP), AP: num_(r.AP), IP: num_(r.IP), SD: num_(r.SD), LM: num_(r.LM), CR: num_(r.CR),
      finalRating: num_(r.finalRating), light: strOrNull_(r.light), probSuccess: num_(r.probSuccess),
      decision: strOrNull_(r.decision), outcome: strOrNull_(r.outcome), agentId: strOrNull_(r.agentId),
      hireDate: strOrNull_(r.hireDate), termDate: strOrNull_(r.termDate),
      employmentStatus: strOrNull_(r.employmentStatus), flag: str_(r.flag)
    };
  }).filter(function (c) { return c.name && (!own || samePerson_(c.rm, me)); });

  var myAgents = {};
  cohort.forEach(function (c) { if (c.agentId) myAgents[c.agentId] = true; });

  var production = {};
  readObjects_(tab_('production')).forEach(function (r) {
    var id = str_(r.agentId).trim();
    if (!id) return;
    if (own && !myAgents[id]) return;
    var o = { name: str_(r.name), apps: num_(r.apps) || 0, settledAPI: num_(r.settledAPI) || 0,
              lapsedCount: num_(r.lapsedCount) || 0, lapsedAPI: num_(r.lapsedAPI) || 0 };
    if (str_(r.note)) o.note = str_(r.note);
    if (r.terminated !== '' && r.terminated != null) o.terminated = r.terminated;
    production[id] = o;
  });

  var pulse = {};
  readObjects_(tab_('managerPulse')).forEach(function (r) {
    var m = str_(r.manager).trim();
    if (!m) return;
    if (own && !samePerson_(m, me)) return;
    pulse[m] = {
      submissions: num_(r.submissions) || 0, on_pace: num_(r.on_pace) || 0,
      slightly_behind: num_(r.slightly_behind) || 0, behind: num_(r.behind) || 0,
      missed_weeks: num_(r.missed_weeks) || 0, started: str_(r.started),
      coaching_method: str_(r.coaching_method), agents_named: splitList_(r.agents_named),
      repeat_offenders: splitList_(r.repeat_offenders), pattern: str_(r.pattern)
    };
  });

  var variance = {};
  readObjects_(tab_('variance')).forEach(function (r) {
    var agent = str_(r.agent).trim();
    if (!agent) return;
    if (own && !samePerson_(r.rm, me)) return;
    var key = str_(r.key).trim() || (agent + ' (' + str_(r.month) + ')');
    var o = { agent: agent, month: str_(r.month), rm: str_(r.rm) };
    ['income_proj', 'income_actual', 'income_var_pct', 'leads_proj', 'leads_actual', 'leads_var_pct',
     'ff_proj', 'ff_actual', 'ff_var_pct', 'close_proj', 'close_actual', 'close_var_pct',
     'apps_proj', 'apps_actual', 'api_actual'].forEach(function (k) { o[k] = num_(r[k]); });
    o.note = str_(r.note);
    variance[key] = o;
  });

  var surveys = {};
  readObjects_(tab_('marketSurveys')).forEach(function (r) {
    var n = str_(r.name).trim();
    if (!n) return;
    if (own && !samePerson_(r.manager, me)) return;
    surveys[n] = { count: num_(r.count) || 0, avg: num_(r.avg) || 0, zeros: num_(r.zeros) || 0,
                   range: str_(r.range), manager: str_(r.manager), flag: str_(r.flag), note: str_(r.note) };
  });

  return { production: production, cohort: cohort, managerPulse: pulse, variance: variance, marketSurveys: surveys };
}

// ---------------------------------------------------------------------------
//  Claude — the three AI features, with the key kept here
//
//  The page used to call api.anthropic.com directly with no key, which works
//  inside a claude.ai artifact and nowhere else. A key cannot go in a public
//  page, so the call is made from here with ANTHROPIC_API_KEY from Script
//  Properties. The prompts are the ones the page shipped with.
// ---------------------------------------------------------------------------

var AI_URL = 'https://api.anthropic.com/v1/messages';

function ai_(profile, data) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return { ok: false, error: 'No ANTHROPIC_API_KEY in Script Properties. See RECRUITING-SETUP.md.' };

  var req = aiRequest_(data);
  if (!req) return { ok: false, error: 'Unknown AI request.' };

  /* claude-opus-5 with Anthropic's server-side fallback, so a request the
     model's safety classifiers decline is re-run on a suitable model rather
     than coming back empty. That needs the beta header below. */
  var body = {
    model: CONFIG.AI_MODEL,
    max_tokens: req.maxTokens,
    fallbacks: 'default',
    messages: [{ role: 'user', content: req.content }]
  };
  var res = UrlFetchApp.fetch(AI_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01'
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode(), text = res.getContentText();
  if (code !== 200) {
    aiLog_(profile, data, null, 'HTTP ' + code);
    return { ok: false, error: 'Claude API ' + code + ': ' + text.slice(0, 300) };
  }
  var msg = JSON.parse(text);
  if (msg.stop_reason === 'refusal') {
    aiLog_(profile, data, msg, 'refusal');
    var why = msg.stop_details && msg.stop_details.explanation;
    return { ok: false, error: 'The model declined this request' + (why ? ': ' + why : '.') };
  }
  var out = (msg.content || []).filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; }).join('\n').trim();
  aiLog_(profile, data, msg, msg.stop_reason || 'ok');
  return { ok: true, text: out, model: msg.model, stopReason: msg.stop_reason };
}

function aiLog_(profile, data, msg, status) {
  try {
    var u = (msg && msg.usage) || {};
    tab_('aiLog').appendRow([nowIso_(), profile.name, str_(data.kind), str_(data.candidateName),
                             (msg && msg.model) || CONFIG.AI_MODEL, u.input_tokens || '', u.output_tokens || '', status]);
  } catch (e) { /* a log that fails must not fail the answer */ }
}

/* max_tokens is a ceiling, not a target: nothing is charged for tokens that are
   not produced. The two analyses are bounded JSON; the brief is capped at 280
   words by its own prompt. */
function aiRequest_(d) {
  var name = str_(d.candidateName) || 'the candidate';
  var rm = str_(d.recruitingManager) || 'their manager';

  if (d.kind === 'popPdf') {
    if (!d.base64) return null;
    return {
      maxTokens: 8000,
      content: [
        { type: 'document', source: { type: 'base64', media_type: str_(d.mediaType) || 'application/pdf', data: str_(d.base64) } },
        { type: 'text', text: popPrompt_(name, rm) }
      ]
    };
  }
  if (d.kind === 'popText') {
    var pasted = str_(d.text).slice(0, 80000);
    if (!pasted.trim()) return null;
    return {
      maxTokens: 8000,
      content: 'You are analysing pasted text from a POP 7.0 (Predictor of Potential) report for ' + name +
        ', an insurance sales candidate in Trinidad. The pasted text follows. Apply the same structured analysis as if you were reading the PDF — focus on interview responses, hedge words, vague answers, school-vs-professional examples, and dependency signals.\n\nPasted POP 7 content:\n---\n' +
        pasted + '\n---\n\nRespond with the same JSON structure (summary, overallVerdict, verdictRationale, dimensions for EP/AP/IP/PO/AO/MR/CR/CSC, coachingPriorities, interviewerProbes). JSON only, no preamble.'
    };
  }
  if (d.kind === 'brief') {
    if (!d.profile) return null;
    return {
      maxTokens: 2000,
      content: 'You are a senior insurance branch manager coaching another manager on a candidate.\nHere is the candidate\'s profile (JSON):\n\n' +
        JSON.stringify(d.profile, null, 2) +
        '\n\nProvide a focused 4-paragraph coaching brief for the recruiting manager:\n1. The single most important risk in this candidate\'s profile.\n2. The most important strength to leverage.\n3. Two specific coaching actions for the next 30 days.\n4. The single signal to watch for that would change your assessment.\n\nBe direct, candid, and practical. Use Trinidadian insurance industry context (POP 7.0, GSAP V4, 7-month probation with $105k API / 25 apps quota). Maximum 280 words total.'
    };
  }
  return null;
}

function popPrompt_(name, rm) {
  return 'You are analysing a POP 7.0 (Predictor of Potential) report from SMG Self Management Group for an insurance sales candidate in Trinidad. Your task is to drill into the candidate\'s WRITTEN INTERVIEW RESPONSES on pages 7-14 of the report and assess what they reveal about coachability, motivation, dependency, and fit for the sales career.\n\n' +
    'Candidate: ' + name + '\nRecruiting Manager: ' + rm + '\n\n' +
    'Read the report and produce a STRUCTURED JSON response with these exact fields:\n\n' +
    '{\n  "summary": "<2-3 sentence headline assessment>",\n' +
    '  "overallVerdict": "<one of: \'STRONG_PROCEED\' | \'PROCEED_WITH_COACHING\' | \'PROCEED_WITH_RESERVATIONS\' | \'HOLD\' | \'DECLINE\'>",\n' +
    '  "verdictRationale": "<2 sentences explaining the verdict>",\n' +
    '  "dimensions": {\n' +
    '    "EP": { "scoreInterpretation": "<...>", "responseQuality": "<STRONG | ADEQUATE | WEAK | CONCERNING>", "redFlags": ["<...>"], "tellingPhrases": ["<exact quote 1>", "<exact quote 2>"], "drillDown": "<2-3 sentence analysis of what the EP responses reveal>" },\n' +
    '    "AP": { ... same shape ... },\n    "IP": { ... same shape ... },\n    "PO": { ... same shape ... },\n    "AO": { ... same shape ... },\n' +
    '    "MR": { "scoreInterpretation": "<Managing Rejection>", ... },\n' +
    '    "CR": { "scoreInterpretation": "<Call Reluctance>", ... },\n' +
    '    "CSC": { "scoreInterpretation": "<Commitment to Sales Career>", ... }\n  },\n' +
    '  "coachingPriorities": [\n' +
    '    { "priority": 1, "area": "<...>", "specificAction": "<...>", "watchPoint": "<...>" },\n' +
    '    { "priority": 2, "area": "<...>", "specificAction": "<...>", "watchPoint": "<...>" },\n' +
    '    { "priority": 3, "area": "<...>", "specificAction": "<...>", "watchPoint": "<...>" }\n  ],\n' +
    '  "interviewerProbes": ["<question the RM should ask to test concerning response 1>", "<...question 2>", "<...question 3>"]\n}\n\n' +
    'CRITICAL ANALYTICAL NOTES:\n' +
    '- Watch for responses that revert to SCHOOL/STUDENT examples instead of professional examples — this indicates limited recent professional experience and is a coaching concern.\n' +
    '- Watch for VAGUE responses ("I would focus on", "I am proactive") that lack concrete examples.\n' +
    '- Watch for HEDGE words ("might", "could", "would try to") which indicate uncertainty.\n' +
    '- IP (Independence Potential) below -10 means high dependency; the responses should be probed for explicit self-direction language.\n' +
    '- Strong responses give specific names, dates, dollar amounts, or measurable outcomes.\n\n' +
    'Respond with ONLY the JSON object, no preamble.';
}

// ---------------------------------------------------------------------------
//  The door
// ---------------------------------------------------------------------------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function resetRequestMemo_() { _tabMemo = {}; _headMemo = {}; _rosterMemo = null; }

function doGet(e) {
  resetRequestMemo_();
  var p = (e && e.parameter) || {};
  if (!p.action) return ContentService.createTextOutput('Ricky Rampersad Branch — Recruit Tracker backend ' + SCRIPT_VERSION + ' is running.');
  try { return json_(handle_(p.action, p, p.token)); }
  catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function doPost(e) {
  resetRequestMemo_();
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  try { return json_(handle_(body.action || 'ping', body, body.token)); }
  catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function handle_(action, data, token) {
  if (action === 'ping') return { ok: true, today: todayISO_(), version: SCRIPT_VERSION };
  if (action === 'login') return login_(data.who, data.password);

  var profile = readToken_(token);
  if (!profile) return { ok: false, error: 'Session expired. Sign in again.', authRequired: true };

  switch (action) {
    case 'me':        return sessionPayload_(profile, null);
    case 'list':      return list_(profile);
    case 'get':       return get_(profile, str_(data.id));
    case 'save':      return save_(profile, data);
    case 'delete':    return delete_(profile, str_(data.id));
    case 'docPut':    return docPut_(profile, data);
    case 'docGet':    return docGet_(profile, data);
    case 'docDelete': return docDelete_(profile, data);
    case 'datasets':  return { ok: true, datasets: datasetsFor_(profile) };
    case 'ai':        return ai_(profile, data);
    default:          return { ok: false, error: 'Unknown action: ' + action };
  }
}
