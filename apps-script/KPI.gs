/**
 * RRB · Daily KPI & Innovation Tracker — backend
 * =============================================================================
 * Bound to the KPI workbook. Serves the tracker at /kpi/ and sends the
 * 3pm checkpoint and the Friday weekly summary.
 *
 * What changed versus the first version of this script:
 *   1. The upsert on (StaffId, Date) actually matches now. The old script
 *      compared String(cell) against the posted "2026-06-22" — but Sheets had
 *      parsed that text into a date cell, so String(cell) read
 *      "Mon Jun 22 2026 00:00:00 GMT-0400 (…)" and never matched. Every save
 *      appended instead of updating: one day could hold five copies of itself
 *      and every total downstream was inflated. See isoDay_ below.
 *   2. Staff sign in. The Access tab holds the credentials; the check happens
 *      here, on the server. The password column is never served to a browser.
 *   3. Training records are kept. The form has always collected them; there
 *      was nowhere to put them, so they were dropped on save.
 *   4. Reports: a 3pm checkpoint and a weekly rollup, on screen and by email.
 *
 * Setup lives in KPI-SETUP.md at the repo root.
 * =============================================================================
 */

/* The deployed script is the only one that matters, and from outside it is
   invisible — you cannot tell by looking at the site whether a paste-and-
   redeploy actually took. That cost us a day: Kamla redeployed, it was still
   slow, and nobody could say whether the new code was running or the old.
   
   So the script now says who it is. Bump this in the same commit as any
   change to this file, and /redeploy will tell whoever did the deployment
   whether it worked, without them having to ask anybody. */
var SCRIPT_VERSION = '2026-10-18c';

var CONFIG = {
  TZ: 'America/Port_of_Spain',
  TOKEN_HOURS: 12,
  CHECKPOINT_HOUR: 15,          // the 3pm cut
  LOG_TAB: 'KPI Log',           // created if header-detection finds nothing
  TRAINING_TAB: 'KPI Training',
  ACCESS_TAB: 'Access'
};

/** Manager recipients. Script Property MANAGER_EMAIL (comma-separated) wins;
 *  otherwise the workbook owner, which is the branch manager. */
function managerEmails_() {
  var p = PropertiesService.getScriptProperties().getProperty('MANAGER_EMAIL');
  if (p && p.trim()) {
    return p.split(',').map(function (s) { return s.trim(); }).filter(String);
  }
  var me = Session.getEffectiveUser().getEmail();
  return me ? [me] : [];
}

function ss_() { return SpreadsheetApp.getActive(); }

// ---------------------------------------------------------------------------
//  Tab discovery
//  The workbook's tabs are named however they were named. Rather than hardcode
//  a guess, find each one by the columns it carries.
// ---------------------------------------------------------------------------

/* The header row is read over and over inside a single save: logSheet_ reads
   it to check the columns exist, saveBlock_ reads it to build the row, and
   colMap_ reads it again to find the column numbers. Three round trips for a
   row that cannot change mid-request. Remember it like the tab name. */
var _headMemo = {};
function headerOf_(sheet) {
  var key;
  try { key = sheet.getSheetId(); } catch (e) { key = null; }
  if (key != null && _headMemo.hasOwnProperty(key)) return _headMemo[key];
  var head = [];
  if (sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 1) {
    head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h || '').trim(); });
  }
  if (key != null) _headMemo[key] = head;
  return head;
}

/** A column was just appended, so the remembered header is now a row short. */
function forgetHeader_(sheet) {
  try { delete _headMemo[sheet.getSheetId()]; } catch (e) { _headMemo = {}; }
}

/* Finding a tab means reading the header row of every sheet in the workbook,
   and each of those is a round trip to Sheets. Doing it once is fine. Doing it
   once per call is what made signing in take eight seconds: login_ reads the
   roster, publicRoster_ reads it again, and each read rescanned the workbook.
   Four scans for one sign-in, which on a phone reads as "could not reach the
   sheet" because the request outlives the browser's patience.

   Memoised per execution. Apps Script gives every request a fresh global
   scope, so this cannot serve a stale tab to the next request — it only stops
   one request asking the same question four times. */
var _tabMemo = {};

/* Remember which tab answered last time, so the scan does not have to happen
   at all. Discovery costs three Sheets calls per sheet — getLastRow,
   getLastColumn, getRange — so a six-tab workbook is around eighteen round
   trips, and that was still most of the eight seconds after memoising the
   scan down to one per request.

   The tab's NAME is cached across requests instead. A named lookup is one
   call, and the header is checked against it so a renamed or restructured tab
   falls back to the full scan and re-caches. Nothing is trusted that is not
   verified. */
function tabNameCache_() { return CacheService.getScriptCache(); }

function findTabBy_(mustHave) {
  var key = mustHave.join('|').toLowerCase();
  if (_tabMemo.hasOwnProperty(key)) return _tabMemo[key];

  var cache = null, remembered = null;
  try { cache = tabNameCache_(); remembered = cache.get('tab_' + key); } catch (e) {}

  if (remembered) {
    var quick = ss_().getSheetByName(remembered);
    if (quick && headerMatches_(quick, mustHave)) { _tabMemo[key] = quick; return quick; }
  }

  var sheets = ss_().getSheets();
  var found = null;
  for (var i = 0; i < sheets.length; i++) {
    if (headerMatches_(sheets[i], mustHave)) { found = sheets[i]; break; }
  }
  if (found && cache) {
    try { cache.put('tab_' + key, found.getName(), 6 * 3600); } catch (e) {}
  }
  // A miss is not remembered. A tab that is missing now is usually one about
  // to be created — remembering the miss meant the creator looked again,
  // found nothing, and made a second tab, silently discarding what the first
  // call had just written. Cheap to re-scan; expensive to get wrong.
  if (found) _tabMemo[key] = found;
  return found;
}

/** Tell the finder about a tab that has just been created, so the next call
 *  in the same execution gets it instead of making another one. */
function rememberTab_(mustHave, sh) {
  _tabMemo[mustHave.join('|').toLowerCase()] = sh;
  try { tabNameCache_().put('tab_' + mustHave.join('|').toLowerCase(), sh.getName(), 6 * 3600); } catch (e) {}
  return sh;
}

function headerMatches_(sheet, mustHave) {
  var head = headerOf_(sheet).map(function (h) { return h.toLowerCase(); });
  return mustHave.every(function (m) { return head.indexOf(m.toLowerCase()) > -1; });
}


/** The daily log. Identified by StaffId + KPI1_Actioned. */
function logSheet_() {
  var sh = findTabBy_(['StaffId', 'KPI1_Actioned']);
  if (sh) return ensureLogColumns_(sh);
  sh = ss_().insertSheet(CONFIG.LOG_TAB);
  sh.appendRow(LOG_HEADERS);
  sh.setFrozenRows(1);
  return rememberTab_(['StaffId', 'KPI1_Actioned'], sh);
}

/** The credentials tab. Identified by Email + Password. */
function accessSheet_() {
  var sh = findTabBy_(['Email', 'Password']);
  if (!sh) throw new Error('No Access tab found — it needs Email and Password columns.');
  return sh;
}

/** The training register. Created on first use. */
function trainingSheet_() {
  var sh = findTabBy_(['TrainingDate', 'Trainee']);
  if (sh) return sh;
  sh = ss_().insertSheet(CONFIG.TRAINING_TAB);
  sh.appendRow(TRAINING_HEADERS);
  sh.setFrozenRows(1);
  return rememberTab_(['TrainingDate', 'Trainee'], sh);
}

// ---------------------------------------------------------------------------
//  The job document, and the quarter measured against it
//
//  The documents themselves live in the workbook, not in this file and not in
//  the repository — the repository is public and these are Guardian Group's
//  internal HR documents. A "Job Docs" tab holds them as rows, which also
//  means Human Capital can revise a document and somebody updates a row
//  instead of waiting on a redeployment.
//
//  Tab: Role | Section | Order | Item | Detail
//    Role     ssa, bma, bm, abm, um — the same role keys the roster uses
//    Section  Header · Overview · Responsibility · Core value ·
//             Performance expectation
// ---------------------------------------------------------------------------

var JOB_TAB = 'Job Docs';
var APPRAISAL_HEADERS = ['StaffId', 'Quarter', 'Value', 'SelfRating', 'SelfNote',
                         'MgrRating', 'MgrNote', 'UpdatedAt'];

function jobDocsSheet_() { return findTabBy_(['Role', 'Section', 'Item']); }

/** Any tab as plain objects, keyed by its header row. */
function sheetObjects_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    .map(function (r) {
      var o = {};
      head.forEach(function (h, c) { if (h) o[h] = r[c]; });
      return o;
    });
}

/** The role on the roster, for a manager opening somebody else's document. */
function roleFor_id_(staffId) {
  var hit = publicRoster_().filter(function (p) { return p.staffId === staffId; })[0];
  return hit ? hit.role : '';
}

/** One role's document, grouped by section and in the order the paper is in. */
function jobDoc_(role) {
  var sh = jobDocsSheet_();
  if (!sh) return null;
  var mine = sheetObjects_(sh).filter(function (r) {
    return String(r.Role || '').trim().toLowerCase() === String(role || '').trim().toLowerCase();
  });
  if (!mine.length) return null;
  mine.sort(function (a, b) { return (Number(a.Order) || 0) - (Number(b.Order) || 0); });
  var out = {};
  mine.forEach(function (r) {
    var sec = String(r.Section || 'Other').trim();
    (out[sec] = out[sec] || []).push({ item: String(r.Item || ''), detail: String(r.Detail || '') });
  });
  return out;
}

/** Staff see their own document. The manager may open anyone's, because
 *  holding a one-to-one without the paper in front of you is the thing this
 *  is meant to stop. */
function jobDocFor_(profile, data) {
  var wantRole = (profile.manager && data && data.role) ? data.role : profile.role;
  var doc = jobDoc_(wantRole);
  return doc ? { ok: true, role: wantRole, doc: doc }
             : { ok: false, error: 'No job document on file for ' + wantRole +
                 '. Add its rows to the "Job Docs" tab of the workbook.' };
}

/** Which quarter a date falls in, as the branch would say it. */
function quarterOf_(iso) {
  var d = iso ? new Date(iso + 'T12:00:00') : new Date();
  return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
}

function quarterRange_(q) {
  var bits = String(q).split('-Q');
  var y = Number(bits[0]), n = Number(bits[1] || 1);
  var from = new Date(Date.UTC(y, (n - 1) * 3, 1));
  var to = new Date(Date.UTC(y, n * 3, 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function appraisalSheet_() {
  var sh = findTabBy_(['StaffId', 'Quarter', 'Value']);
  if (sh) return sh;
  sh = ss_().insertSheet('Appraisals');
  sh.appendRow(APPRAISAL_HEADERS);
  sh.setFrozenRows(1);
  return rememberTab_(['StaffId', 'Quarter', 'Value'], sh);
}

/** A quarter for one person: the document, what they wrote, and the ratings.
 *
 *  Two of the six core values — Continuous Improvement and Curiosity — have no
 *  number anywhere in the job document. What they do have is a quarter of
 *  Value Added and Innovation entries that nobody has ever read together, so
 *  those are gathered here as the evidence for exactly those two.
 */
function appraisal_(staffId, quarter, role) {
  var q = quarter || quarterOf_();
  var span = quarterRange_(q);
  var rows = allEntries_().filter(function (r) {
    var d = String(r.Date || '').slice(0, 10);
    return String(r.StaffId) === String(staffId) && d >= span.from && d < span.to;
  });

  var evidence = { valueAdded: [], innovation: [], blocks: 0, met: { met: 0, partly: 0, no: 0 } };
  rows.forEach(function (r) {
    if (isSubstantive_(r.ValueAdded)) evidence.valueAdded.push({ date: String(r.Date).slice(0, 10), text: String(r.ValueAdded) });
    if (isSubstantive_(r.Innovation)) evidence.innovation.push({ date: String(r.Date).slice(0, 10), text: String(r.Innovation) });
    BLOCK_IDS.forEach(function (p) {
      if (String(r[p + '_Actioned'] || '').trim()) evidence.blocks++;
      var m = String(r[p + '_Met'] || '').trim();
      if (evidence.met[m] != null) evidence.met[m]++;
    });
  });

  var saved = sheetObjects_(appraisalSheet_()).filter(function (r) {
    return String(r.StaffId) === String(staffId) && String(r.Quarter) === q;
  });
  var ratings = {};
  saved.forEach(function (r) {
    ratings[String(r.Value)] = {
      selfRating: String(r.SelfRating || ''), selfNote: String(r.SelfNote || ''),
      mgrRating: String(r.MgrRating || ''), mgrNote: String(r.MgrNote || '')
    };
  });

  return { ok: true, quarter: q, from: span.from, to: span.to,
           doc: jobDoc_(role), evidence: evidence, ratings: ratings, days: rows.length };
}

/** "None today" is an honest entry and must not be counted as evidence. */
function isSubstantive_(v) {
  var t = String(v || '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (/^(none|none today|n\/?a|nil|-+|\.+)$/i.test(t)) return false;
  return t.split(' ').length >= 3;
}

/** The person writes theirs first; the manager writes the other half.
 *
 *  Nobody may write the other's column. That is not only a permission — an
 *  appraisal where the manager can edit the self-assessment is not a
 *  self-assessment.
 */
function saveAppraisal_(data, profile) {
  var staffId = String(data.staffId || profile.staffId);
  var q = String(data.quarter || quarterOf_());
  var value = String(data.value || '');
  if (!value) return { ok: false, error: 'Which core value?' };

  var asManager = !!profile.manager;
  if (!asManager && staffId !== profile.staffId) {
    return { ok: false, error: 'You can only write your own half of an appraisal.' };
  }

  /* Stamped before the lock, so it is true even while this submission is
     queued behind another one. The wall's rebuild reads it and stands
     down; nothing a member of staff does waits on the wall. */
  markStaffWrite_();
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    var sh = appraisalSheet_();
    var idx = colMap_(sh);
    var rows = sheetObjects_(sh);
    var at = -1;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].StaffId) === staffId && String(rows[i].Quarter) === q &&
          String(rows[i].Value) === value) { at = i + 2; break; }
    }
    var patch = { UpdatedAt: new Date() };
    if (asManager) {
      patch.MgrRating = String(data.rating || '');
      patch.MgrNote = String(data.note || '');
    } else {
      patch.SelfRating = String(data.rating || '');
      patch.SelfNote = String(data.note || '');
    }
    if (at < 0) {
      var row = APPRAISAL_HEADERS.map(function (h) {
        if (h === 'StaffId') return staffId;
        if (h === 'Quarter') return q;
        if (h === 'Value') return value;
        return patch[h] != null ? patch[h] : '';
      });
      sh.appendRow(row);
    } else {
      writeRow_(sh, at, idx, patch);
    }
    return { ok: true, saved: value };
  } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------------------
//  What a KPI actually is
//  Ten of these are the Task_Type__c picklist in Salesforce — the field the
//  branch already tags every task with. Picking one here means the app can
//  count that person's real open, overdue and closed tasks for it, instead of
//  asking them to type a number they will guess or leave blank.
//
//  The rest are responsibilities that appear in the job documents but are not
//  tracked as Salesforce tasks. They are logged in words only, and marked so
//  nobody expects a number against them.
// ---------------------------------------------------------------------------
var SF_TYPES = {
  'Pendings':             'Pendings · pending, lapse and follow-ups',
  'Renewa/PDl/Bill':      'Renewals / Premium Dues / Billing',
  'Servicing':            'Servicing lines',
  'Claims/ Mat':          'Claims / Maturities',
  'Scripts/CB':           'Scripts / Clawbacks',
  'Opportunity':          'Opportunity',
  'Lic/Staffing/SA/HR':   'Licensing / Staffing / Sales Admin / HR',
  'RR Operations':        'RR Operations',
  'Training':             'Training delivered',
  'Innovation&Creativity':'Innovation & Creativity'
};

/** Salesforce-backed first — those are the ones that carry live numbers. */
function sfTypeList_() { return Object.keys(SF_TYPES); }

/** In the job documents, not in Salesforce. Words only, no counts. */
var SSA_ONLY = [
  'New Application Process',
  'Client Portfolios / Macros',
  'Document Management (Scan / Classify / Verify)',
  'Reporting',
  'Administrative Support',
  'Mail Management / Contracts',
  'Quotations & Proposals',
  'Orphan Adoption Listing',
  'OFT Collation',
  'Surveys / Query Pal',
  'Task Management'
];

/** Branch Manager. An agency BM is not a senior administrator — the job is
 *  building and running a salesforce. Recruitment, development, production,
 *  persistency and compliance are the accountabilities; the admin is what
 *  supports them. Six of these carry live Salesforce numbers. */
var BM_ONLY = [
  'Recruitment & Selection',
  'Agent Development & Field Training',
  'Production & Pipeline Management',
  'Activity Management (one-on-ones, joint field work)',
  'Persistency & Conservation',
  'Compliance, Licensing & Market Conduct',
  'Budget & Expense Management',
  'People Management (branch team)',
  'Personal Production & Own Book',
  'Client Escalations',
  'Reporting (Production / RDAR / Branch Meeting)',
  'Business Planning'
];

/** Assistant Branch Manager. Deputises for the Branch Manager and carries the
 *  programmes — recruitment intake, agent school, licensing — while running the
 *  unit managers beneath. Broader than a unit, narrower than the branch. */
var ABM_ONLY = [
  'Recruitment Intake & Selection',
  'Agent School & Onboarding',
  'Unit Manager Supervision',
  'Joint Field Work',
  'Production & Pipeline Management',
  'Persistency & Conservation',
  'Agent Licensing & Compliance',
  'Personal Production & Own Book',
  'Client Escalations',
  'Reporting (Production / RDAR)',
  'Deputising for the Branch Manager'
];

/** Unit Manager. The same shape one level down: their unit's recruits, their
 *  unit's activity, their unit's persistency, and their own book. */
var UM_ONLY = [
  'Unit Recruitment',
  'Joint Field Work',
  'Unit Production & Activity',
  'Agent Licensing & Development',
  'Unit Persistency',
  'Personal Production & Own Book',
  'Unit Meeting & Coaching',
  'Client Escalations'
];

var BMA_ONLY = [
  'New Application Oversight',
  'Surveys / Query Pal',
  'Pending / Re-date / Persistency',
  'New Agent Activity (Recruitment / OFT / Licensing)',
  'Reporting (Production / RDAR)',
  'Budget & Expense Management',
  'People Management (Staff Leadership)',
  'Orphan Policy Management',
  'Issues Resolution / Future Payments',
  'Administrative Support',
  'Escalations',
  'Task Distribution'
];

/** The list a person sees, and whether each entry carries live numbers. */
/* The Branch Manager's personal assistant. Not sales support and not a BMA —
   the work is the Branch Manager's own diary, his mail, his contracts and the
   errands that keep a branch moving. It has never been written down, which is
   why none of the existing lists fitted it. */
var PA_ONLY = [
  'Mail Management / Contracts',
  'Document delivery & collection',
  'Diary, appointments & travel',
  'Branch Manager support',
  'Scripts & transmittals',
  'Banking, errands & office runs',
  'Office supplies & facilities',
  'Meeting prep & branch events'
];

var ROLE_LISTS = { ssa: SSA_ONLY, bma: BMA_ONLY, bm: BM_ONLY, abm: ABM_ONLY,
                   um: UM_ONLY, pa: PA_ONLY };

function allKpiChoices_() {
  var out = {};
  Object.keys(ROLE_LISTS).forEach(function (r) { out[r] = kpiChoicesFor_(r); });
  return out;
}

function kpiChoicesFor_(role) {
  var out = sfTypeList_().map(function (t) {
    return { value: t, label: SF_TYPES[t], salesforce: true };
  });
  (ROLE_LISTS[role] || SSA_ONLY).forEach(function (t) {
    out.push({ value: t, label: t, salesforce: false });
  });
  return out;
}

/* FIVE BLOCKS, FIVE TO MIDNIGHT — the wall's own bands.
   "The time blocks need to be adjusted consistent with the wall, because the
   wall is streaming. The wall starts from five to ten and it goes until
   twelve a.m. Five time blocks. So it needs to be consistent." (17 September
   2026.) The wall's fifth band was read from Salesforce and filed by nobody;
   it is a real block now, because the person who asked for it works into it:
   "extend the block beyond 4pm as I work round the clock."

   EVE IS FILEABLE BY EVERYONE AND OWED BY NOBODY BUT THOSE SCHEDULED FOR IT.
   Support staff work eight to four. A fifth block counted against them every
   night would make the whole branch look short every day, which is the
   fastest way to have a tracker ignored. Whether a block is owed comes from
   the person's own schedule below, never from this list. */
var BLOCK_IDS = ['KPI1', 'KPI2', 'PM1', 'PM2', 'EVE'];

// ---------------------------------------------------------------------------
//  The branch day
//  Straight off the DILO tables the BMA has been emailing out every morning.
//  Holding it here means the app can show each person their own blocks and
//  what each one is for — so the schedule stops being retyped into a mail
//  every day, and the report lines up with the block it belongs to.
//
//  'focus' is what that block is for, in the words the team already uses.
//  'kpi' is the matching entry in the person's KPI list, pre-selected on the
//  form so a block is a confirmation rather than a blank page.
// ---------------------------------------------------------------------------
/* NO MORE TIME BLOCKS (Ricky, 17 October 2026): "These are assuming that the
   time blocks are there ... we have changed that. On mornings it's where they
   plan their days, and on the evening what they have achieved, and a weekly
   progress report on a Friday ... it's no longer working in time blocks, as the
   system does the work for persons." Every morning the system reads Salesforce,
   Query Pal and the inbox, reallocates the work, and each person plans the day
   and presses the morning check; no check and the day is taken as absent and the
   work is shared out (REBALANCE). So each person's day is ONE plan: block KPI1,
   spanning their hours, labelled "Your day". The other block columns stay on the
   log so history reads, but no schedule names them and nothing is owed in them.
   'focus' is the work of the role in the words of the job document. */
var SCHEDULE = {
  sasha: {
    // Sales Support 1. In the office 7 to 2 (Ricky, 14 and 17 October 2026).
    hours: '7am – 2pm', lunch: '12:00 – 12:30pm',
    blocks: { KPI1: { time: '7am – 2pm', focus: 'Premium dues and surveys, health billing, orphan adoption, quotations, branch meeting reports', kpi: 'Renewa/PDl/Bill' } }
  },
  azariah: {
    // Sales Support 3. 8 to 4, lunch 1 to 2.
    hours: '8am – 4pm', lunch: '1:00 – 2:00pm',
    blocks: { KPI1: { time: '8am – 4pm', focus: 'Pendings, increases and group apps, reinstatements and lapses, Query Pal and surveys, reports', kpi: 'Pendings' } }
  },
  kamla: {
    // The BMA: 8 to 5 (Ricky, 17 October 2026). She manages Sales Support 1, 2
    // and 3 and is in charge of agents, licensing, training and branch
    // operations; her plan goes out at 7:30.
    hours: '8am – 5pm', lunch: '12:00 – 1:00pm',
    blocks: { KPI1: { time: '8am – 5pm', focus: 'Sales support, agents, licensing, training and branch operations; escalations and reporting', kpi: 'Lic/Staffing/SA/HR' } }
  },
  // The Branch Manager's personal assistant: the mail run, contracts to agents,
  // deliveries and the diary.
  pawan: {
    hours: '8am – 4pm', lunch: '12:00 – 1:00pm',
    blocks: { KPI1: { time: '8am – 4pm', focus: 'Mail and contracts, deliveries and collections, the Branch Manager\'s diary, scripts and transmittals', kpi: 'Mail Management / Contracts' } }
  },
  ashley: {
    hours: '9am – 5pm', lunch: '1:00 – 2:00pm',
    blocks: { KPI1: { time: '9am – 5pm', focus: 'Client portfolios and macros, scripts and clawbacks, renewals and billing, reporting', kpi: 'Scripts/CB' } }
  },
  elizabeth: {
    // Sales Support 2. 7 to 3, lunch 12 to 1.
    hours: '7am – 3pm', lunch: '12:00 – 1:00pm',
    blocks: { KPI1: { time: '7am – 3pm', focus: 'Branch intelligence and Query Pal, new applications, administrative support, reporting', kpi: 'New Application Process' } }
  },
  ricky: {
    /* 5am to 3pm (Ricky, 17 October 2026): the plan at 5, the midday check at
       11, the close-out at 3. */
    hours: '5am – 3pm', lunch: '12:00 – 1:00pm',
    blocks: { KPI1: { time: '5am – 3pm', focus: 'Recruitment and licensing, production and pipeline, agent development, escalations and the branch team', kpi: 'Opportunity' } }
  },
  kerwyn: {
    hours: '8am – 5pm', lunch: 'Flexible',
    blocks: { KPI1: { time: '8am – 5pm', focus: 'Recruitment intake and agent school, unit manager supervision, field work, persistency', kpi: 'Lic/Staffing/SA/HR' } }
  },
  akaash: {
    // Unit Manager: 6 to 6, with his progress report at 11 (Ricky, 17 October 2026).
    hours: '6am – 6pm', lunch: '12:00 – 1:00pm',
    blocks: { KPI1: { time: '6am – 6pm', focus: 'Unit activity and pipeline, joint field work, recruitment and licensing, persistency and own book', kpi: 'Opportunity' } }
  },
  gary: {
    hours: '8am – 4:30pm', lunch: 'Flexible',
    blocks: { KPI1: { time: '8am – 4:30pm', focus: 'Unit activity and pipeline, joint field work, recruitment and licensing, persistency', kpi: 'Opportunity' } }
  }
};

// Which Salesforce Task_Type__c a scheduled block's work lands in, so a
// screen can put "closed 4 pendings" beside the block that was for pendings.
//
// Six of the labels in SCHEDULE are Task_Type__c values letter for letter and
// map to themselves. Every other label is work Salesforce does not type —
// reporting, escalations, the mail run, joint field work — and maps to '', so
// nothing tries to count it. The list is complete on purpose: checkSchedule()
// refuses a block whose label is missing here, because a block added without
// deciding its type would show as untyped work and nobody would know whether
// that was a decision or an oversight. Add the label; put '' if it has no type.
var BLOCK_TYPE = {
  'Renewa/PDl/Bill':                                 'Renewa/PDl/Bill',
  'Pendings':                                        'Pendings',
  'Scripts/CB':                                      'Scripts/CB',
  'Lic/Staffing/SA/HR':                              'Lic/Staffing/SA/HR',
  'Opportunity':                                     'Opportunity',
  'Training':                                        'Training',
  'Orphan Adoption Listing':                         '',
  'Reporting':                                       '',
  'Surveys / Query Pal':                             '',
  'Administrative Support':                          '',
  'Escalations':                                     '',
  'Reporting (Production / RDAR)':                   '',
  'Mail Management / Contracts':                     '',
  'Document delivery & collection':                  '',
  'Branch Manager support':                          '',
  'Scripts & transmittals':                          '',
  'Client Portfolios / Macros':                      '',
  'New Application Process':                         '',
  'Reporting (Production / RDAR / Branch Meeting)':  '',
  'Unit Manager Supervision':                        '',
  'Joint Field Work':                                ''
};

function blockTypeFor_(label) { return BLOCK_TYPE[label] || ''; }

var DEFAULT_SCHEDULE = {
  hours: '8am – 4pm', lunch: 'Flexible',
  blocks: { KPI1: { time: '8am – 4pm', focus: 'Your day', kpi: '' } }
};

/** The reporting line, so the branch reads as a structure rather than a list.
 *      Ricky — Branch Manager
 *        ├─ Kerwyn — Assistant Branch Manager
 *        │    └─ Gary — Unit Manager
 *        └─ Akaash — Unit Manager
 *  Support staff report to the BMA, who reports to the Branch Manager. */
var REPORTS_TO = {
  kerwyn: 'ricky', akaash: 'ricky', gary: 'kerwyn',
  kamla: 'ricky',
  sasha: 'kamla', azariah: 'kamla', elizabeth: 'kamla', ashley: 'kamla',
  pawan: 'ricky'      // and works to Kamla day to day; see TIER below
};

function scheduleFor_(staffId) { return SCHEDULE[staffId] || DEFAULT_SCHEDULE; }

/** Every scheduled KPI must be one a person can actually pick. Run from the
 *  editor after editing SCHEDULE — a typo here shows up as a blank dropdown
 *  and nothing else, which is a miserable thing to debug. */
function checkSchedule() {
  // Build from ROLE_LISTS itself, so adding a role can never leave this check
  // silently comparing against the wrong list.
  var lists = {};
  Object.keys(ROLE_LISTS).forEach(function (r) {
    lists[r] = {};
    kpiChoicesFor_(r).forEach(function (c) { lists[r][c.value] = 1; });
  });
  var roleBy = {};
  try {
    publicRoster_().forEach(function (p) { roleBy[p.staffId] = p.role; });
  } catch (e) { /* no Access tab yet — fall back below */ }
  var bad = [];
  Object.keys(SCHEDULE).forEach(function (sid) {
    var list = lists[roleBy[sid] || 'ssa'] || lists.ssa;
    BLOCK_IDS.forEach(function (b) {
      var k = (SCHEDULE[sid].blocks[b] || {}).kpi;
      if (k && !list[k]) bad.push(sid + ' ' + b + ': "' + k + '" is not on their KPI list');
      // Every label must have decided its Task_Type__c — an empty string is a
      // decision, a missing entry is not. See BLOCK_TYPE.
      if (k && !Object.prototype.hasOwnProperty.call(BLOCK_TYPE, k)) {
        bad.push(sid + ' ' + b + ': "' + k + '" has no BLOCK_TYPE entry — add it, with \'\' if Salesforce does not type it');
      }
    });
  });
  var notes = [];
  try {
    roster_().forEach(function (p) {
      var pinned = ROLE_PINNED[p.staffId];
      if (!pinned) return;
      // What the sheet alone would say, with the pin taken out of the way.
      var sheetSays = roleFor_({ role: p.role, unit: p.unit, grade: p.grade, staffId: '' });
      if (sheetSays !== pinned) {
        notes.push(p.name + ': the Access tab says "' + (p.unit || p.role) +
          '" but their entries are ' + pinned.toUpperCase() +
          ' work. Using ' + pinned.toUpperCase() + '. Correct the tab and remove the pin.');
      }
    });
  } catch (e) { /* no Access tab yet */ }

  var msg = bad.length ? 'Schedule problems:\n  ' + bad.join('\n  ')
                       : 'Schedule is consistent — every block points at a KPI that exists.';
  if (notes.length) msg += '\n\nRoster to correct:\n  ' + notes.join('\n  ');
  Logger.log(msg);
  return msg;
}

/** Blocks that should be behind a person by this hour of the branch day.
 *  The morning pair are due by noon; the third by 3, when the checkpoint runs. */
var BLOCK_DUE_HOUR = { KPI1: 10, KPI2: 12, PM1: 15, PM2: 16, EVE: 24 };

function blockLabel_(p) {
  // KPI1 is the whole day now (see SCHEDULE); the rest only name old entries.
  return { KPI1: 'Your day', KPI2: 'KPI 2', PM1: 'Afternoon 1', PM2: 'Afternoon 2', EVE: 'After four' }[p] || p;
}


var LOG_HEADERS = ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status']
  .concat(BLOCK_IDS.reduce(function (a, p) {
    return a.concat([p, p + '_Actioned', p + '_Resolved', p + '_Open', p + '_Blocker']);
  }, []))
  .concat(['Closed', 'Overdue', 'Aged60', 'ValueAdded', 'Innovation', 'SystemFlags', 'Notes',
           'UpdatedAt', 'Revision'])
  .concat(BLOCK_IDS.map(function (p) { return p + '_At'; }))
  .concat(BLOCK_IDS.map(function (p) { return p + '_Quality'; }))
  // Set in the morning, answered at the close. Four equal two-hour blocks are
  // a shape nobody in the branch actually works — 62% of the week's task
  // activity lands before noon, and no two people have the same day — so what
  // is measured is the person's own estimate against their own answer, not
  // the clock against a grid.
  .concat(BLOCK_IDS.map(function (p) { return p + '_Plan'; }))
  .concat(BLOCK_IDS.map(function (p) { return p + '_Met'; }))
  // The mail sweep, morning and afternoon: "08:25|bm:done,abm:none,…".
  .concat(['MailAM', 'MailPM']);

var TRAINING_HEADERS = ['TrainingDate', 'StaffId', 'Trainer', 'Block', 'Trainee', 'Topic',
                        'Objectives', 'Achieved', 'Test', 'Result', 'Followup', 'LoggedAt'];

/** UpdatedAt and Revision are new. Add them to an existing log without
 *  disturbing a single cell of what is already recorded. */
/** Columns the log has grown since it was created, added to an existing tab.
 *
 *  One write and one cache drop for all of them together. Adding them a cell
 *  at a time cost a round trip and a header re-read each — invisible while it
 *  was two columns, and the bench guard caught it the moment it was ten.
 */
function ensureLogColumns_(sh) {
  var head = headerOf_(sh);
  /* A BLOCK'S OWN FIVE COLUMNS TOO, not only the derived ones. This list
     used to start at _At, because the four original blocks were already in
     the branch's sheet when the script first ran. The fifth block is not, so
     adding one to BLOCK_IDS silently gave it a timestamp and a plan with
     nowhere to write the work itself. */
  var want = ['UpdatedAt', 'Revision']
    .concat(BLOCK_IDS)
    .concat(BLOCK_IDS.map(function (p) { return p + '_Actioned'; }))
    .concat(BLOCK_IDS.map(function (p) { return p + '_Resolved'; }))
    .concat(BLOCK_IDS.map(function (p) { return p + '_Open'; }))
    .concat(BLOCK_IDS.map(function (p) { return p + '_Blocker'; }))
    .concat(BLOCK_IDS.map(function (p) { return p + '_At'; }))
    .concat(BLOCK_IDS.map(function (p) { return p + '_Quality'; }))
    .concat(BLOCK_IDS.map(function (p) { return p + '_Plan'; }))
    .concat(BLOCK_IDS.map(function (p) { return p + '_Met'; }))
    .concat(['MailAM', 'MailPM']);
  var missing = want.filter(function (col) { return head.indexOf(col) === -1; });
  if (!missing.length) return sh;
  sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]);
  forgetHeader_(sh);
  return sh;
}

function colMap_(sh) {
  var m = {}, head = headerOf_(sh);
  head.forEach(function (h, i) { if (h) m[h] = i; });
  return m;
}

// ---------------------------------------------------------------------------
//  Dates
//  Dates arrive as text (2026-08-24) and as real Date cells. Normalise both to
//  the ISO day in branch time, or comparisons quietly fail across midnight.
// ---------------------------------------------------------------------------

/** A date cell comes back as a Date at midnight in the SPREADSHEET's zone, so
 *  that is the zone to read the calendar day back in. Reading it in any other
 *  zone can shift it by a day.
 *
 *  This is what broke the old script. It compared String(cell) against the
 *  posted "2026-06-22"; once Sheets had parsed that text into a date cell,
 *  String(cell) read "Mon Jun 22 2026 00:00:00 GMT-0400 (…)" and never matched
 *  again — so every save appended instead of updating the day it belonged to. */
var _ssTz = null;
function ssTz_() {
  if (_ssTz) return _ssTz;
  try { _ssTz = ss_().getSpreadsheetTimeZone() || CONFIG.TZ; }
  catch (e) { _ssTz = CONFIG.TZ; }
  return _ssTz;
}

function isoDay_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, ssTz_(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var d = new Date(s);
  return isNaN(d.getTime()) ? s : Utilities.formatDate(d, ssTz_(), 'yyyy-MM-dd');
}

function todayISO_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'); }

/* Which day a report is for, when the caller may not be a person.
   Apps Script hands a time-based trigger its own event object as the first
   argument — {authMode, triggerUid, 'day-of-month', …} — not a date. Taken as
   "which day", it matches no entry, so every desk reads as silent, and the
   header formats an unparseable value as the epoch. That is exactly how the
   3pm checkpoint went out on 7 September dated Thursday 1 January 1970 with
   the whole branch marked "No entry", on a day the branch had closed 33 tasks.
   Only a string or a Date that resolves to a real day counts; anything else is
   nothing, and the caller falls back to today. */
function dayArg_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : isoDay_(v);
  }
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  var s = isoDay_(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function shiftDays_(iso, n) {
  var p = iso.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing iso. The branch week runs Monday to Friday. */
function weekStart_(iso) {
  var p = iso.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  var dow = d.getUTCDay();                  // 0 Sun .. 6 Sat
  var back = dow === 0 ? 6 : dow - 1;
  return shiftDays_(iso, -back);
}

function weekDays_(monday) {
  var out = [];
  for (var i = 0; i < 5; i++) out.push(shiftDays_(monday, i));
  return out;
}

// ---------------------------------------------------------------------------
//  Sign-in
// ---------------------------------------------------------------------------

function normEmail_(s) { return String(s || '').trim().toLowerCase(); }

/** "Sasha Lalla-Jagassar" -> "sasha". The StaffId the log has always used is
 *  the first name, lowercased. Keep it, so old rows still join to new logins. */
function staffIdFor_(name) {
  return String(name || '').trim().toLowerCase().split(/[\s.]+/)[0] || '';
}

/* Same reasoning as findTabBy_: the Access tab is read several times in a
   single request and it cannot change mid-request. */
var _rosterMemo = null;
function roster_() {
  if (_rosterMemo) return _rosterMemo;
  var sh = accessSheet_();
  if (sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  var idx = {};
  head.forEach(function (h, i) { idx[h.trim().toLowerCase()] = i; });
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var out = [];
  vals.forEach(function (r) {
    var email = normEmail_(r[idx['email']]);
    var name = String(r[idx['name']] || '').trim();
    if (!email && !name) return;
    // Active is decided by what the cell SAYS, not by what it fails to say.
    // Until 16 September 2026 a person stayed on the wall unless the cell was
    // exactly no / inactive / false / 0 — and a departed member of staff was
    // still up there because her cell said something that list did not
    // recognise. So the rule is inverted: blank means active (the column was
    // never filled in for most rows), an explicit yes means active, and any
    // other word at all — "Left", "Resigned", "x" — means gone. A new way of
    // saying no can never keep somebody on the screen again. The raw cell is
    // kept beside the decision so a screen can show why a person is off it.
    var activeRaw = idx['active'] != null && r[idx['active']] != null
      ? String(r[idx['active']]).trim() : '';
    out.push({
      email: email,
      name: name,
      staffId: staffIdFor_(name),
      agentNumber: String(r[idx['agent number']] || '').trim(),
      password: String(r[idx['password']] != null ? r[idx['password']] : ''),
      role: String(r[idx['role']] || '').trim(),
      unit: String(r[idx['unit']] || '').trim(),
      grade: idx['grade'] != null ? String(r[idx['grade']] || '').trim() : '',
      activeRaw: activeRaw,
      active: activeRaw === '' || /^(yes|y|active|true|1)$/i.test(activeRaw)
    });
  });
  _rosterMemo = out;
  return out;
}

/** Which KPI list a person gets, read from the Role and Unit columns.
 *  Assistant is checked before manager, because "Branch Manager's Assistant"
 *  contains the word manager and is not one. */
// A pin overrides the Access tab for one person. It is the escape hatch for a
// row that is wrong, not a place to keep the real answer — checkSchedule()
// names everyone pinned so the pin gets removed once the tab is corrected.
//
// Nobody is pinned. Every role now comes from the Role column, which is where
// it belongs: change somebody's job in the sheet and the tool follows without
// anyone editing this file.
var ROLE_PINNED = {};

/** Nobody types "Assistant Branch Manager" into a spreadsheet. They type
 *  "Assit Branch Mgr". Expand the abbreviations and the usual near-misses
 *  before matching, so the Role column can be written the way a person writes
 *  it rather than the way the code would prefer. */
function normRole_(t) {
  return String(t || '').toLowerCase()
    .replace(/[\u2018\u2019'`]s\b/g, 's')            // manager's -> managers
    .replace(/[^a-z]+/g, ' ')
    .replace(/\b(?:managers|manager|mgrs|mgr|mngr|mgnr|manger|managr|mananger|mgt)\b/g, 'manager')
    .replace(/\b(?:assistant|assistants|assistent|assitant|assistan|assit|asst|assis|asstt|ast)\b/g, 'assistant')
    .replace(/\b(?:snr|sr)\b/g, 'senior')
    .replace(/\s+/g, ' ').trim();
}

function roleFor_(person) {
  if (ROLE_PINNED[person.staffId]) return ROLE_PINNED[person.staffId];
  var t = normRole_((person.role || '') + ' ' + (person.unit || '') + ' ' + (person.grade || ''));
  // Order matters. "Assistant Branch Manager" contains both "assistant" and
  // "branch manager", and is neither a BMA nor the Branch Manager — so it is
  // tested first, before either of the words it happens to contain.
  if (/personal assistant|\bpa\b|assistant to the branch manager/.test(t)) return 'pa';
  if (/assistant branch manager|\babm\b/.test(t)) return 'abm';
  if (/branch manager assistant|\bbma\b/.test(t)) return 'bma';
  if (/branch manager/.test(t)) return 'bm';
  if (/unit manager|sales manager|agency manager|\bmanager\b/.test(t)) return 'um';
  // "Sales Support Assistant" is the title on the job document, the appraisal
  // form and the manual. It contains the word assistant and is not a BMA —
  // the fallback below would have handed a support desk the BMA's KPI list
  // the first time the Access tab was written the way HR writes it.
  if (/sales support|support assistant|\bssa\b/.test(t)) return 'ssa';
  if (/assistant/.test(t)) return 'bma';
  return 'ssa';
}

/** Manager rights: Role or Unit says so, or the address is on MANAGER_EMAIL. */
function isManager_(person) {
  if (!person) return false;
  var mgrs = managerEmails_().map(normEmail_);
  if (mgrs.indexOf(normEmail_(person.email)) > -1) return true;
  // Ask roleFor_ rather than reading the same cells again here. Two places
  // deriving the same answer from the same words is how "Branch Mgr" managed to
  // be a Branch Manager for the KPI list and a Sales Support Assistant for the
  // reports.
  //
  // The Branch Manager alone sees the branch. Not the Assistant Branch Manager,
  // not a Unit Manager, not the BMA — everyone else sees their own entries and
  // their own Salesforce position, whatever their title says. Seeing the whole
  // branch is one person's job here, and it is a separate question from
  // seniority: roleFor_ decides the KPI list, this decides the reach.
  var r = roleFor_(person);
  if (r === 'bm') return true;
  // "Administrator" in the Role column is the workbook's owner standing in.
  // It used to be any "admin" in the Role OR the Unit — and Sales Admin is a
  // support unit, so a Sales Support Assistant whose Unit cell said "Sales
  // Admin" signed in and saw the whole branch. Role, and the whole word.
  return /\badministrator\b/.test(normRole_(person.role || ''));
}

function issueToken_(person) {
  var token = Utilities.getUuid();
  var payload = {
    staffId: person.staffId,
    name: person.name,
    email: person.email,
    manager: isManager_(person)
  };
  CacheService.getScriptCache().put('kpi_' + token, JSON.stringify(payload),
                                    CONFIG.TOKEN_HOURS * 3600);
  return { token: token, profile: payload };
}

function readToken_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('kpi_' + String(token));
  return raw ? JSON.parse(raw) : null;
}

/** Five wrong tries buys a fifteen-minute wait. The passwords on the Access
 *  tab are short, and without this the whole roster is minutes of guessing
 *  away from anyone who finds the page. */
var LOGIN_MAX_TRIES = 5, LOGIN_LOCK_SECONDS = 900;

function failKey_(key) { return 'kpifail_' + key; }

function tooManyTries_(key) {
  var n = Number(CacheService.getScriptCache().get(failKey_(key))) || 0;
  return n >= LOGIN_MAX_TRIES;
}

function noteFailure_(key) {
  var c = CacheService.getScriptCache();
  var n = (Number(c.get(failKey_(key))) || 0) + 1;
  c.put(failKey_(key), String(n), LOGIN_LOCK_SECONDS);
}

function clearFailures_(key) { CacheService.getScriptCache().remove(failKey_(key)); }

/** Identity is email or agent number; either is fine. Passwords are compared
 *  as trimmed strings so a numeric cell (1) matches typed text ("1"). */
function login_(who, password) {
  var key = String(who || '').trim().toLowerCase();
  var pass = String(password == null ? '' : password).trim();
  if (!key) return { ok: false, error: 'Enter your email or agent number.' };

  if (tooManyTries_(key)) {
    return { ok: false, error: 'Too many attempts. Wait fifteen minutes, or ask the Branch Manager.' };
  }

  var people = roster_();
  var person = null;
  for (var i = 0; i < people.length; i++) {
    var p = people[i];
    if (normEmail_(p.email) === key || p.agentNumber.toLowerCase() === key) { person = p; break; }
  }
  if (!person) {
    noteFailure_(key);
    return { ok: false, error: 'Not recognised. Check your email or agent number.' };
  }
  if (!person.active) return { ok: false, error: 'That account is not active. Speak to the Branch Manager.' };
  if (String(person.password).trim() !== pass) {
    noteFailure_(key);
    return { ok: false, error: 'Wrong password.' };
  }

  clearFailures_(key);
  var t = issueToken_(person);
  // Signing in is the attendance register. The profile carries today's
  // record so the browser knows whether this is the first sign-in of the day.
  try { t.profile.attendance = recordAttendance_(t.profile); } catch (e) {}
  t.profile.leads = leads_(t.profile);
  return { ok: true, token: t.token, profile: t.profile,
           roster: publicRoster_(), schedule: SCHEDULE,
           offRoster: isManager_(person) ? offRoster_() : undefined };
}

/** Who is on the Access tab but off the roster, and what their Active cell
 *  says. The Branch Manager alone gets this, so that a person who is missing
 *  from every screen is explained on his: a cell reading "Left", "Maternity"
 *  or "x" takes somebody off, and until now nothing said so anywhere. The
 *  name and the cell, nothing else. */
function offRoster_() {
  return roster_().filter(function (p) { return !p.active; }).map(function (p) {
    return { name: p.name, says: p.activeRaw };
  });
}

/** The roster minus the passwords. This is the only shape that leaves here. */
/* What the branch looks like, rather than what a spreadsheet column says.
   A wall that lists nine names alphabetically teaches nobody anything; one
   that groups them teaches the structure without a word of explanation. */
var TIER = {
  bm:  { key: 'management', label: 'Management',                    order: 1 },
  abm: { key: 'management', label: 'Management',                    order: 1 },
  um:  { key: 'management', label: 'Management',                    order: 1 },
  bma: { key: 'bma',        label: "Branch Manager's Assistant",    order: 2 },
  pa:  { key: 'pa',         label: 'Personal Assistant',            order: 3 },
  ssa: { key: 'support',    label: 'Sales Support',                 order: 4 }
};
function tierFor_(role) { return TIER[role] || TIER.ssa; }

function publicRoster_() {
  return roster_().filter(function (p) { return p.active; }).map(function (p) {
    return {
      staffId: p.staffId, name: p.name, email: p.email,
      agentNumber: p.agentNumber, unit: p.unit, grade: p.grade,
      role: roleFor_(p),
      tier: tierFor_(roleFor_(p)).key,
      tierLabel: tierFor_(roleFor_(p)).label,
      tierOrder: tierFor_(roleFor_(p)).order,
      reportsTo: REPORTS_TO[p.staffId] || '',
      manager: isManager_(p)
    };
  });
}

// ---------------------------------------------------------------------------
//  Reading entries
// ---------------------------------------------------------------------------

function allEntries_() {
  var sh = logSheet_();
  if (sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var out = [];
  vals.forEach(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, c) { if (h) o[h] = r[c]; });
    o.Date = isoDay_(o.Date);
    if (!o.StaffId && !o.Name) return;
    if (!o.StaffId) o.StaffId = staffIdFor_(o.Name);
    out.push(o);
  });
  return out;
}

/** One entry per person per day — the latest write wins.
 *  Until the backfill in dedupeLog() is run the sheet still holds the old
 *  duplicates, so collapse them on read too. Reports must not double-count. */
function latestEntries_() {
  var best = {};
  allEntries_().forEach(function (e) {
    var k = e.StaffId + '|' + e.Date;
    var seen = best[k];
    if (!seen) { best[k] = e; return; }
    var a = new Date(e.UpdatedAt || e.Timestamp || 0).getTime() || e._row;
    var b = new Date(seen.UpdatedAt || seen.Timestamp || 0).getTime() || seen._row;
    if (a >= b) best[k] = e;
  });
  return Object.keys(best).map(function (k) { return best[k]; });
}

function trainingRows_() {
  var sh = trainingSheet_();
  if (sh.getLastRow() < 2) return [];
  var head = headerOf_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return vals.map(function (r) {
    var o = {};
    head.forEach(function (h, c) { if (h) o[h] = r[c]; });
    o.TrainingDate = isoDay_(o.TrainingDate);
    return o;
  }).filter(function (o) { return o.TrainingDate; });
}

// ---------------------------------------------------------------------------
//  Writing entries — upsert, not append
// ---------------------------------------------------------------------------

function saveEntry_(payload, profile) {
  var staffId = profile.manager && payload.staffId ? payload.staffId : profile.staffId;
  var date = isoDay_(payload.date);
  if (!staffId || !date) return { ok: false, error: 'Missing staff or date.' };

  /* Stamped before the lock, so it is true even while this submission is
     queued behind another one. The wall's rebuild reads it and stands
     down; nothing a member of staff does waits on the wall. */
  markStaffWrite_();
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    var sh = logSheet_();
    var head = headerOf_(sh);
    var idx = colMap_(sh);
    var now = new Date();

    // Find this person's row for this day.
    var found = findDayRow_(sh, idx, staffId, date);
    var targetRow = found.row, revision = found.revision;
    var firstStamp = found.stamp || now;

    var b = payload.blocks || {};
    var vals2 = {
      Timestamp: firstStamp,
      Date: date,
      StaffId: staffId,
      Name: payload.name || profile.name,
      Grade: payload.grade || '',
      Status: payload.submitted ? 'Submitted' : 'Draft',
      Closed: numOrBlank_(payload.metrics && payload.metrics.closed),
      Overdue: numOrBlank_(payload.metrics && payload.metrics.overdue),
      Aged60: numOrBlank_(payload.metrics && payload.metrics.aged60),
      ValueAdded: payload.valueAdded || '',
      Innovation: payload.innovation || '',
      SystemFlags: payload.systemFlags || '',
      Notes: payload.notes || '',
      UpdatedAt: now,
      Revision: revision + 1
    };
    BLOCK_IDS.forEach(function (p) {
      var d = b[blockKey_(p)] || {};
      vals2[p] = d.kpi || '';
      vals2[p + '_Actioned'] = d.actioned || '';
      vals2[p + '_Resolved'] = d.resolved || '';
      vals2[p + '_Open'] = d.openOwned || '';
      vals2[p + '_Blocker'] = joinBlocker_(d.blocker, d.blockerOwner);
      vals2[p + '_Plan'] = d.planMins || '';
      vals2[p + '_Met'] = d.met || '';
    });

    var row = head.map(function (h) { return (h in vals2) ? vals2[h] : ''; });
    if (targetRow) sh.getRange(targetRow, 1, 1, head.length).setValues([row]);
    else sh.appendRow(row);

    saveTraining_(staffId, date, vals2.Name, b, now);
    return { ok: true, upserted: !!targetRow, revision: vals2.Revision };
  } finally {
    lock.releaseLock();
  }
}

/** One block, submitted on its own, the moment it ends.
 *
 *  This is the change the Branch Manager has been asking for since 21 August:
 *  reporting after each KPI block, not a single entry typed from memory at
 *  4pm. Each block writes only its own five columns and stamps its own time,
 *  so the day builds up as it is worked and the 3pm checkpoint reads what
 *  actually happened by 3pm rather than what someone recalls afterwards.
 *
 *  The day's row is still one row. A block never disturbs its neighbours. */
// ---------------------------------------------------------------------------
//  Does the entry actually say anything?
//
//  The tracker measured whether a block was submitted, never whether what was
//  written in it meant anything. "Actioned remaining tasks", "3 tasks", "2" and
//  a bare client name all satisfied it completely, so that is what it started
//  getting back.
//
//  The bar is the branch's own, and it is one question: does this say HOW MANY
//  or WHICH ONE. A count, or a case. Everything below is that question asked
//  five ways, and each answer is a sentence a person can act on rather than a
//  score they have to interpret.
//
//  Only "Actioned" and "Resolved" are read, and they are read together — the
//  honest answer to Resolved is often "None today" and that must never be held
//  against a block whose Actioned line is full. Blocker and Waiting-on are
//  never judged: "None" is the right answer there most days.
// ---------------------------------------------------------------------------

/* Words that fill a box without answering it. */
var FILLER_RE = /^(?:\W|none|n\/?a|nil|nothing|no|yes|ok|okay|done|complete[d]?|finish(?:ed)?|task[s]?|work(?:ing|ed)?|action(?:ed|s)?|remaining|outstanding|same|as\s+above|see\s+above|ditto|all|various|misc(?:ellaneous)?|general|usual|normal|routine|etc|and|the|my|daily)*$/i;

/* A number, written either way. */
var COUNT_RE   = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen)\b/i;
var COUNT_STRIP = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen)\b/gi;

/* Something done, rather than something merely present. */
var VERB_RE = /\b(?:sent|send|sending|process(?:ed|ing)?|chas(?:ed|ing)|chase|resolv(?:ed|ing)|escalat(?:ed|ing)|submit(?:ted|ting)?|upload(?:ed)?|correct(?:ed)?|amend(?:ed)?|follow(?:ed)?[\s-]?up|call(?:ed)?|email(?:ed)?|reconcil(?:ed|ing|iation)?|issu(?:ed)?|prepar(?:ed)?|review(?:ed)?|updat(?:ed)?|clos(?:ed)?|logg?(?:ed)?|fil(?:ed|ing)|scan(?:ned)?|print(?:ed)?|deliver(?:ed)?|collect(?:ed)?|verif(?:ied|y)|approv(?:ed)?|declin(?:ed)?|quot(?:ed)?|renew(?:ed)?|transmit(?:ted)?|receiv(?:ed)?|request(?:ed)?|book(?:ed)?|arrang(?:ed)?|confirm(?:ed)?|check(?:ed)?|contact(?:ed)?|advis(?:ed)?|refer(?:red)?|rais(?:ed)?|cancel(?:led|ed)?|reinstat(?:ed)?|surrender(?:ed)?|paid|pay|banked|deposit(?:ed)?)\b/i;

/* A policy number, a quote reference, a code — something you could look up. */
var REF_RE = /\b(?:[A-Z]{2,}[-\/]?\d{2,}|\d{5,}|#\s*\d+)\b/;

function wordsOf_(t) {
  return String(t || '').trim().split(/\s+/).filter(function (w) { return /[a-z0-9]/i.test(w); });
}

/** A capitalised word that is not simply the first word of the sentence —
 *  a person, a company, a product. Weak on its own, which is the point:
 *  "just putting in random names" is exactly the entry this has to catch. */
function hasProperName_(t) {
  var w = String(t || '').split(/\s+/);
  for (var i = 1; i < w.length; i++) {
    if (/^[A-Z][a-z]{2,}/.test(w[i])) return true;
  }
  return /^[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}/.test(String(t || '').trim());
}

/** One block, read. Returns { level: 'full'|'thin', reason: '' }.
 *  `others` is the same day's other blocks, so a block copied from the one
 *  before it can be named as what it is. */
function readSubstance_(d, others) {
  d = d || {};
  var actioned = String(d.actioned || '').trim();
  var resolved = String(d.resolved || '').trim();
  var both = (actioned + ' ' + resolved).trim();
  var words = wordsOf_(both);

  if (!words.length)            return { level: 'thin', reason: 'nothing written' };
  if (FILLER_RE.test(both))     return { level: 'thin', reason: 'no answer, only filler' };
  if (words.length < 3)         return { level: 'thin', reason: 'too short to say anything' };

  // A number attached to nothing. "3 tasks" counts something without ever
  // saying what, and it was the single most common entry in the branch —
  // so take the numbers out and see whether anything is left standing.
  if (FILLER_RE.test(both.replace(COUNT_STRIP, ' '))) {
    return { level: 'thin', reason: 'a count, but nothing named' };
  }

  var hasCount = COUNT_RE.test(both);
  var hasRef   = REF_RE.test(both);
  var hasVerb  = VERB_RE.test(both);
  var hasName  = hasProperName_(both);

  // A name on its own is the entry that started this. It is not an answer.
  if (hasName && !hasCount && !hasRef && !hasVerb) {
    return { level: 'thin', reason: 'a name, but nothing done with it' };
  }
  if (!hasCount && !hasRef && !hasName) {
    return { level: 'thin', reason: 'no count or case named' };
  }

  // The same words in two blocks means one of them was not written today.
  var norm = both.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (norm.length > 8 && others) {
    for (var i = 0; i < others.length; i++) {
      var o = String(others[i] || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      if (o && o === norm) return { level: 'thin', reason: 'same words as another block today' };
    }
  }

  return { level: 'full', reason: '' };
}

/** The branch's written standards, checked rather than merely printed.
 *  These are breaches of a rule the team already agreed, so they are named
 *  separately from thinness — a full entry can still breach one. */
function readStandards_(d, payload) {
  var out = [];
  d = d || {}; payload = payload || {};

  var owner = String(d.blockerOwner || '').trim();
  if (owner && !/\d/.test(owner)) {
    out.push('waiting on ' + owner + ' with no date last chased');
  }
  var open = String(d.openOwned || '').trim();
  if (COUNT_RE.test(open) && !String(d.blocker || '').trim()) {
    out.push('carrying work forward with no blocker named');
  }
  return out;
}

/** How the whole day reads, for the checkpoint and the wall. */
function daySubstance_(row, idx) {
  var full = 0, thin = [], texts = [];
  BLOCK_IDS.forEach(function (p) {
    var q = idx && idx[p + '_Quality'] != null ? String(row[idx[p + '_Quality']] || '') : '';
    if (!q) return;
    if (q === 'auto') return;            // filed by the closer, not written by the person
    if (q.indexOf('thin') === 0) thin.push({ block: p, reason: q.replace(/^thin:\s*/, '') });
    else full++;
  });
  return { full: full, thin: thin, written: full + thin.length };
}

/** Write a patch of named columns into one row.
 *
 *  One setValues per run of adjacent columns, instead of one setValue per
 *  column. A block save touches up to sixteen cells; written one at a time
 *  that is sixteen round trips to Sheets — and every one of them happens
 *  while the script lock is held and the rest of the branch is queued behind
 *  it. The block's own five columns sit together in the header, so in
 *  practice this is about five writes instead of sixteen.
 *
 *  Only the named columns are touched. Nothing is read back and rewritten,
 *  so a cell this block does not own cannot be disturbed. */
function writeRow_(sh, row, idx, patch) {
  var byIndex = {}, cols = [];
  Object.keys(patch).forEach(function (col) {
    if (idx[col] == null) return;
    byIndex[idx[col]] = patch[col];
    cols.push(idx[col]);
  });
  if (!cols.length) return;
  cols.sort(function (a, b) { return a - b; });

  var run = [cols[0]];
  for (var i = 1; i <= cols.length; i++) {
    if (i < cols.length && cols[i] === cols[i - 1] + 1) { run.push(cols[i]); continue; }
    sh.getRange(row, run[0] + 1, 1, run.length)
      .setValues([run.map(function (c) { return byIndex[c]; })]);
    if (i < cols.length) run = [cols[i]];
  }
}

/** ══════════════════════════════════════════════════════════════════════════
 *  FINDING ONE ROW WITHOUT READING THE WHOLE LOG.
 *
 *  Every write path used to pull the entire KPI Log — every row and every
 *  column — inside the script lock, to find the one row it was about to
 *  patch. The columns that identify a row are three; the rest is the payload
 *  of forty-odd fields per block that nobody needs in order to find it.
 *
 *  Reported from the branch on 17 September 2026: a member of staff filed the
 *  eleven-to-one block, the sheet did not answer after four tries over about
 *  two minutes, and she had to resubmit after lunch. Nothing was lost — the
 *  typed words are kept on the phone — but that is four minutes of somebody's
 *  day and a message to the group asking whether the tracker is broken.
 *
 *  These read three columns and then the single row they matched, and they
 *  keep FIRST-MATCH semantics deliberately: the log can carry a duplicate day
 *  row (that is what dedupeLog is for), and the first one is the keeper, so a
 *  faster search must not quietly start writing to the other one.
 *  ══════════════════════════════════════════════════════════════════════════ */
/** The columns that identify a row, in ONE read: the span between the
 *  leftmost and the rightmost of them. In both logs those columns sit beside
 *  each other — Date, StaffId, Name; TrainingDate, StaffId, Trainer, Block —
 *  so this is three or four columns instead of fifty, and it is one round
 *  trip rather than one per column. Round trips were measured long before
 *  cells were, and neither is worth trading for the other. */
function keySpan_(sh, idx, names, rows) {
  var cols = names.map(function (n) { return idx[n]; })
    .filter(function (c) { return c !== undefined && c !== null; });
  if (!cols.length) return null;
  var lo = Math.min.apply(null, cols), hi = Math.max.apply(null, cols);
  var vals = sh.getRange(2, lo + 1, rows, hi - lo + 1).getValues();
  return {
    get: function (i, name) {
      var c = idx[name];
      if (c === undefined || c === null) return '';
      var v = (vals[i] || [])[c - lo];
      return v === undefined ? '' : v;
    }
  };
}

/** The row for one person on one day: { row, revision, vals, stamp }.
 *  `row` is 0 when there is none. `vals` is that row in full, read only once
 *  it is found, because the callers need the day's other blocks out of it. */
function findDayRow_(sh, idx, staffId, date, dateCol) {
  var out = { row: 0, revision: 0, vals: null, stamp: null };
  var rows = sh.getLastRow() - 1;
  if (rows < 1) return out;
  var dc = dateCol || 'Date';
  if (idx[dc] === undefined || idx[dc] === null) return out;
  var key = keySpan_(sh, idx, ['StaffId', 'Name', dc], rows);
  if (!key) return out;
  for (var i = 0; i < rows; i++) {
    var raw = key.get(i, 'StaffId');
    var s = String(raw == null ? '' : raw).trim() || staffIdFor_(key.get(i, 'Name'));
    if (s !== staffId || isoDay_(key.get(i, dc)) !== date) continue;
    out.row = i + 2;
    out.vals = sh.getRange(out.row, 1, 1, sh.getLastColumn()).getValues()[0];
    out.revision = Number(out.vals[idx['Revision']]) || 0;
    out.stamp = out.vals[idx['Timestamp']] || null;
    return out;
  }
  return out;
}

/** SOMEBODY IS FILING RIGHT NOW — stamped before the lock is taken, so it is
 *  true even while a submission is queued behind another one.
 *
 *  The wall's hourly pending rebuild lives in the same script project and
 *  reads fifty-thousand-row extracts for about two minutes at a time, six
 *  times inside the working day, at whatever minute Apps Script decides. A
 *  submission that lands on top of one waits on the same document and can
 *  time out. The rebuild is the half of that pair which can afford to wait:
 *  it has a night copy behind it and another go in two hours. So it asks
 *  this, and stands down. A member of staff never waits on the wall. */
function markStaffWrite_() {
  try {
    PropertiesService.getScriptProperties()
      .setProperty('KPI_LAST_WRITE', String(Date.now()));
  } catch (e) {}
}
function staffWroteWithin_(ms) {
  try {
    var at = Number(PropertiesService.getScriptProperties().getProperty('KPI_LAST_WRITE') || 0);
    return at > 0 && (Date.now() - at) < ms;
  } catch (e) { return false; }
}

/** Take the script lock, or say plainly that the branch is busy.
 *
 *  One lock covers every submission in the branch, so at four o'clock — when
 *  the whole team files its last block within the same few minutes — people
 *  queue behind each other. When the wait runs out, waitLock throws a Google
 *  error with wording no member of staff should ever be shown, and the tracker
 *  treated it as a final answer.
 *
 *  _retry tells the browser to come back on its own. The person sees nothing
 *  but a slightly slower save. */
function takeLock_() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    return lock;
  } catch (e) {
    return null;
  }
}

var BUSY_ = { ok: false, _retry: true,
  error: 'Another submission is going in just now. Trying again…' };

function saveBlock_(payload, profile) {
  var staffId = profile.manager && payload.staffId ? payload.staffId : profile.staffId;
  var date = isoDay_(payload.date);
  var blockId = String(payload.block || '').toUpperCase();
  if (!staffId || !date) return { ok: false, error: 'Missing staff or date.' };
  if (BLOCK_IDS.indexOf(blockId) === -1) return { ok: false, error: 'Unknown block: ' + blockId };

  var d = payload.data || {};
  var now = new Date();
  var done = [];
  var quality = null, standards = [];

  /* Stamped before the lock, so it is true even while this submission is
     queued behind another one. The wall's rebuild reads it and stands
     down; nothing a member of staff does waits on the wall. */
  markStaffWrite_();
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    var sh = logSheet_();
    var head = headerOf_(sh);
    var idx = colMap_(sh);

    var found = findDayRow_(sh, idx, staffId, date);
    var targetRow = found.row, revision = found.revision, rowVals = found.vals;

    // The block's own cells, plus anything the day carries that came with it.
    var patch = {};
    patch[blockId] = d.kpi || '';
    patch[blockId + '_Actioned'] = d.actioned || '';
    patch[blockId + '_Resolved'] = d.resolved || '';
    patch[blockId + '_Open'] = d.openOwned || '';
    patch[blockId + '_Plan'] = d.planMins || '';
    patch[blockId + '_Met'] = d.met || '';
    patch[blockId + '_Blocker'] = joinBlocker_(d.blocker, d.blockerOwner);
    patch[blockId + '_At'] = now;

    // What the day's other blocks say, so a block copied from the one before
    // it can be named as what it is rather than counted as work.
    var others = [];
    if (rowVals) {
      BLOCK_IDS.forEach(function (pfx) {
        if (pfx === blockId) return;
        var a = idx[pfx + '_Actioned'] != null ? rowVals[idx[pfx + '_Actioned']] : '';
        var r = idx[pfx + '_Resolved'] != null ? rowVals[idx[pfx + '_Resolved']] : '';
        var t = (String(a || '') + ' ' + String(r || '')).trim();
        if (t) others.push(t);
      });
    }
    quality = readSubstance_(d, others);
    standards = readStandards_(d, payload);
    patch[blockId + '_Quality'] = quality.level === 'full' ? 'full' : 'thin: ' + quality.reason;

    patch.UpdatedAt = now;
    patch.Revision = revision + 1;
    patch.Status = 'Submitted';

    // Day-level fields ride along with whichever block carries them.
    ['valueAdded:ValueAdded', 'innovation:Innovation', 'systemFlags:SystemFlags', 'notes:Notes']
      .forEach(function (pair) {
        var k = pair.split(':');
        if (payload[k[0]] != null && String(payload[k[0]]).trim() !== '') patch[k[1]] = payload[k[0]];
      });
    if (payload.metrics) {
      if (payload.metrics.closed !== '' && payload.metrics.closed != null) patch.Closed = numOrBlank_(payload.metrics.closed);
      if (payload.metrics.overdue !== '' && payload.metrics.overdue != null) patch.Overdue = numOrBlank_(payload.metrics.overdue);
      if (payload.metrics.aged60 !== '' && payload.metrics.aged60 != null) patch.Aged60 = numOrBlank_(payload.metrics.aged60);
    }

    if (targetRow) {
      // Touch only the columns this block owns; leave every other cell alone.
      writeRow_(sh, targetRow, idx, patch);
    } else {
      patch.Timestamp = now;
      patch.Date = date;
      patch.StaffId = staffId;
      patch.Name = payload.name || profile.name;
      patch.Grade = payload.grade || '';
      sh.appendRow(head.map(function (h) { return (h in patch) ? patch[h] : ''; }));
      targetRow = sh.getLastRow();
    }

    saveBlockTraining_(staffId, date, payload.name || profile.name, blockId, d, now);

    // Which blocks are in, counted from the row already in memory. Asking
    // blocksSubmittedOn_ meant reading the whole log back a second time to
    // learn something this request had just finished deciding.
    BLOCK_IDS.forEach(function (pfx) {
      if (pfx === blockId) { done.push(pfx); return; }
      if (!rowVals) return;
      var at  = idx[pfx + '_At'] != null ? rowVals[idx[pfx + '_At']] : '';
      var kpi = idx[pfx] != null ? rowVals[idx[pfx]] : '';
      var act = idx[pfx + '_Actioned'] != null ? rowVals[idx[pfx + '_Actioned']] : '';
      if (at || hasText_(kpi) || hasText_(act)) done.push(pfx);
    });
  } finally {
    lock.releaseLock();
  }

  // The receipt is the slowest thing in a save and it needs no lock. Sending
  // it while holding one put every other member of staff behind a mail server.
  // And a receipt that fails must not report a saved block as unsaved — that
  // is what makes somebody type their afternoon out twice.
  // The first block of the day is the morning plan, whatever the person meant
  // by it. That is the moment the day-start e-mail goes, copied to the Branch
  // Manager and sales support. Once a day; its own failure is never the save's.
  if (done.length === 1) {
    try { sendDayStart_(staffId, date, 'first'); } catch (dsErr) {}
  }

  try {
    emailBlockReceipt_(staffId, date, blockId, d, payload, done);
  } catch (mailErr) {
    return {
      ok: true,
      block: blockId,
      at: Utilities.formatDate(now, CONFIG.TZ, 'HH:mm'),
      blocksDone: done.length,
      submitted: done,
      quality: quality,
      standards: standards,
      warning: 'Saved. The emailed copy did not go out.'
    };
  }

  return {
    ok: true,
    block: blockId,
    at: Utilities.formatDate(now, CONFIG.TZ, 'HH:mm'),
    blocksDone: done.length,
    submitted: done,
    quality: quality,
    standards: standards
  };
}

/** The day's own fields — task position, value added, the idea, the flag.
 *  They belong to the day rather than to any one block, so they save on their
 *  own and never overwrite a block that has already been reported. */
function saveDay_(payload, profile) {
  var staffId = profile.manager && payload.staffId ? payload.staffId : profile.staffId;
  var date = isoDay_(payload.date);
  if (!staffId || !date) return { ok: false, error: 'Missing staff or date.' };

  /* Stamped before the lock, so it is true even while this submission is
     queued behind another one. The wall's rebuild reads it and stands
     down; nothing a member of staff does waits on the wall. */
  markStaffWrite_();
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    var sh = logSheet_();
    var head = headerOf_(sh);
    var idx = colMap_(sh);
    var now = new Date();

    var found = findDayRow_(sh, idx, staffId, date);
    var targetRow = found.row, revision = found.revision;

    var m = payload.metrics || {};
    var patch = {
      Closed: numOrBlank_(m.closed), Overdue: numOrBlank_(m.overdue), Aged60: numOrBlank_(m.aged60),
      ValueAdded: payload.valueAdded || '', Innovation: payload.innovation || '',
      SystemFlags: payload.systemFlags || '', Notes: payload.notes || '',
      UpdatedAt: now, Revision: revision + 1
    };

    if (targetRow) {
      Object.keys(patch).forEach(function (col) {
        if (idx[col] != null) sh.getRange(targetRow, idx[col] + 1).setValue(patch[col]);
      });
    } else {
      patch.Timestamp = now; patch.Date = date; patch.StaffId = staffId;
      patch.Name = payload.name || profile.name; patch.Grade = payload.grade || '';
      patch.Status = 'Submitted';
      sh.appendRow(head.map(function (h) { return (h in patch) ? patch[h] : ''; }));
    }
    return { ok: true, saved: 'day' };
  } finally {
    lock.releaseLock();
  }
}

/** Which blocks carry a submission stamp for this person and day. */
function blocksSubmittedOn_(staffId, date) {
  var out = [];
  latestEntries_().forEach(function (e) {
    if (e.StaffId !== staffId || e.Date !== date) return;
    BLOCK_IDS.forEach(function (p) {
      if (e[p + '_At'] || hasText_(e[p]) || hasText_(e[p + '_Actioned'])) out.push(p);
    });
  });
  return out;
}

/** Training for one block only — the other blocks' sessions stay put. */
function saveBlockTraining_(staffId, date, trainer, blockId, d, now) {
  var sh = trainingSheet_();
  var head = headerOf_(sh);
  var idx = colMap_(sh);

  var rows = sh.getLastRow() - 1;
  if (rows > 0) {
    var key = keySpan_(sh, idx, ['StaffId', 'TrainingDate', 'Block'], rows);
    for (var i = rows - 1; key && i >= 0; i--) {
      if (String(key.get(i, 'StaffId')).trim() === staffId &&
          isoDay_(key.get(i, 'TrainingDate')) === date &&
          String(key.get(i, 'Block')).trim() === blockId) {
        sh.deleteRow(i + 2);
      }
    }
  }

  var any = d.tr_trainee || d.tr_topic || d.tr_objectives || d.tr_achieved ||
            d.tr_test || d.tr_result || d.tr_followup;
  if (!any) return;
  var o = {
    TrainingDate: date, StaffId: staffId, Trainer: trainer, Block: blockId,
    Trainee: d.tr_trainee || '', Topic: d.tr_topic || '',
    Objectives: d.tr_objectives || '', Achieved: d.tr_achieved || '',
    Test: d.tr_test || '', Result: d.tr_result || '',
    Followup: d.tr_followup || '', LoggedAt: now
  };
  sh.appendRow(head.map(function (h) { return (h in o) ? o[h] : ''; }));
}

/** Client block ids are kpi1/kpi2/pm1/pm2; columns are KPI1/KPI2/PM1/PM2. */
function blockKey_(p) { return p.toLowerCase(); }

function numOrBlank_(v) {
  if (v === '' || v == null) return '';
  var n = Number(v);
  return isNaN(n) ? '' : n;
}

function joinBlocker_(blocker, owner) {
  var b = String(blocker || '').trim(), o = String(owner || '').trim();
  if (b && o) return b + ' · ' + o;
  return b || o;
}

/** Training is one row per session in its own register, so "who trained whom
 *  on what" is a list you can read, not something buried across 28 columns.
 *  A re-save replaces that person's rows for that day rather than piling up. */
function saveTraining_(staffId, date, trainer, blocks, now) {
  var sh = trainingSheet_();
  var head = headerOf_(sh);
  var idx = colMap_(sh);

  var trows = sh.getLastRow() - 1;
  if (trows > 0) {
    var tkey = keySpan_(sh, idx, ['StaffId', 'TrainingDate'], trows);
    for (var i = trows - 1; tkey && i >= 0; i--) {
      if (String(tkey.get(i, 'StaffId')).trim() === staffId &&
          isoDay_(tkey.get(i, 'TrainingDate')) === date) {
        sh.deleteRow(i + 2);
      }
    }
  }

  BLOCK_IDS.forEach(function (p) {
    var d = blocks[blockKey_(p)] || {};
    var any = d.tr_trainee || d.tr_topic || d.tr_objectives || d.tr_achieved ||
              d.tr_test || d.tr_result || d.tr_followup;
    if (d.kpi !== 'Training delivered' && !any) return;
    if (!any) return;
    var o = {
      TrainingDate: date, StaffId: staffId, Trainer: trainer, Block: p,
      Trainee: d.tr_trainee || '', Topic: d.tr_topic || '',
      Objectives: d.tr_objectives || '', Achieved: d.tr_achieved || '',
      Test: d.tr_test || '', Result: d.tr_result || '',
      Followup: d.tr_followup || '', LoggedAt: now
    };
    sh.appendRow(head.map(function (h) { return (h in o) ? o[h] : ''; }));
  });
}

// ---------------------------------------------------------------------------
//  Maintenance: collapse the duplicates already in the sheet
//  Run once from the editor. Keeps the newest row for each person and day.
// ---------------------------------------------------------------------------

function dedupeLog() {
  var sh = logSheet_();
  if (sh.getLastRow() < 3) return 'Nothing to do.';
  var idx = colMap_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  var keep = {};
  vals.forEach(function (r, i) {
    var sid = String(r[idx['StaffId']] || '').trim() || staffIdFor_(r[idx['Name']]);
    var k = sid + '|' + isoDay_(r[idx['Date']]);
    var stamp = new Date(r[idx['UpdatedAt']] || r[idx['Timestamp']] || 0).getTime() || 0;
    // Later timestamp wins; on a tie the lower row loses, so the last one stands.
    if (!keep[k] || stamp >= keep[k].stamp) keep[k] = { row: i + 2, stamp: stamp };
  });

  var survivors = {};
  Object.keys(keep).forEach(function (k) { survivors[keep[k].row] = true; });

  var removed = 0;
  for (var r = sh.getLastRow(); r >= 2; r--) {
    if (!survivors[r]) { sh.deleteRow(r); removed++; }
  }
  var msg = 'Removed ' + removed + ' duplicate row(s); ' +
            Object.keys(keep).length + ' entries remain.';
  Logger.log(msg);
  return msg;
}

// ---------------------------------------------------------------------------
//  Reporting
// ---------------------------------------------------------------------------

function n_(v) {
  if (v === '' || v == null) return null;
  var x = Number(v);
  return isNaN(x) ? null : x;
}

function hasText_(v) { return !!String(v == null ? '' : v).trim(); }

function isRealValueAdd_(v) {
  var s = String(v || '').trim().toLowerCase();
  return !!s && s !== 'none today' && s !== 'none' && s !== 'n/a' && s !== 'na' && s !== '-';
}

/** How many blocks this person is OWED — the ones their own schedule names.
 *  Support staff work eight to four, and only the Branch Manager is scheduled
 *  into the four-to-midnight block, so counting BLOCK_IDS would tell the whole
 *  branch it was a block short every evening. Four is the floor for anybody
 *  whose schedule is not on the list yet, which is what the day said before
 *  there was a fifth block to be wrong about. */
function blocksOwed_(staffId) {
  var sc = SCHEDULE[String(staffId || '').trim()];
  var b = sc && sc.blocks;
  if (!b) return 1;          // one plan a day for anyone (no time blocks, 17 October 2026)
  var n = 0;
  BLOCK_IDS.forEach(function (p) { if (b[p] && b[p].time) n++; });
  return n || 1;
}

function blocksDone_(e) {
  var n = 0;
  BLOCK_IDS.forEach(function (p) { if (hasText_(e[p]) || hasText_(e[p + '_Actioned'])) n++; });
  return n;
}

/** Training sessions in a set of days. The register only fills from now on,
 *  so count the blocks logged as "Training delivered" — that is the record
 *  that goes back to June. */
function countTraining_(rows) {
  var n = 0;
  rows.forEach(function (e) {
    BLOCK_IDS.forEach(function (p) {
      if (String(e[p] || '').trim() === 'Training delivered') n++;
    });
  });
  return n;
}

function openBlockers_(e) {
  var out = [];
  BLOCK_IDS.forEach(function (p) {
    if (hasText_(e[p + '_Blocker'])) {
      out.push({ block: p, kpi: e[p] || '', text: String(e[p + '_Blocker']) });
    }
  });
  return out;
}

/** The 3pm cut. Blocks 1-3 are done by then; the last block is not, so it is
 *  reported as outstanding rather than as a gap. */
function checkpointReport_(date) {
  var day = dayArg_(date) || todayISO_();
  var people = publicRoster_();
  var byId = {};
  latestEntries_().forEach(function (e) { if (e.Date === day) byId[e.StaffId] = e; });

  // Salesforce is the authority on the task position. What was typed into the
  // sheet is only used where Salesforce could not be reached.
  var sf = sfkMetricsSafe_(day);
  var live = sf.ok ? sf.staff : {};
  var att = {};
  try { attendanceFor_({ staffId: '', manager: true }, day, shiftDays_(day, 1)).forEach(function (o) { att[o.staffId] = o; }); } catch (e) {}

  var lines = people.map(function (p) {
    var e = byId[p.staffId];
    var done = e ? blocksDone_(e) : 0;
    var L = live[p.staffId];
    var a = att[p.staffId];
    return {
      staffId: p.staffId, name: p.name, unit: p.unit,
      signedIn: a && a.at ? a.at : '',
      signedOut: a && a.out ? a.out : '',
      absent: a && a.status === 'absent' ? (a.reason || 'not in') : '',
      late: a ? a.late : 0,
      mailAM: (e && parseMail_(e.MailAM) || {}).at || '',
      mailPM: (e && parseMail_(e.MailPM) || {}).at || '',
      status: !e ? 'No entry' : (String(e.Status) === 'Submitted' ? 'Submitted' : 'Draft'),
      blocksDone: done,
      onTrack: done >= Math.min(3, blocksOwed_(p.staffId)),
      fromSalesforce: !!L,
      closed: L ? L.closed : (e ? n_(e.Closed) : null),
      overdue: L ? L.overdue : (e ? n_(e.Overdue) : null),
      aged60: L ? L.aged60 : (e ? n_(e.Aged60) : null),
      noDate: L ? L.noDate : null,
      openNow: L ? L.open : null,
      valueAdded: e && isRealValueAdd_(e.ValueAdded) ? String(e.ValueAdded) : '',
      innovation: e && hasText_(e.Innovation) ? String(e.Innovation) : '',
      systemFlags: e && hasText_(e.SystemFlags) ? String(e.SystemFlags) : '',
      notes: e && hasText_(e.Notes) ? String(e.Notes) : '',
      blockers: e ? openBlockers_(e) : [],
      blockTimes: BLOCK_IDS.map(function (b) {
        return {
          block: b, label: blockLabel_(b),
          at: e && e[b + '_At'] ? Utilities.formatDate(new Date(e[b + '_At']), CONFIG.TZ, 'HH:mm') : '',
          filled: !!(e && (hasText_(e[b]) || hasText_(e[b + '_Actioned'])))
        };
      }),
      updatedAt: e && e.UpdatedAt ? Utilities.formatDate(new Date(e.UpdatedAt), CONFIG.TZ, 'HH:mm') : ''
    };
  });

  var tot = { closed: 0, overdue: 0, aged60: 0 };
  lines.forEach(function (l) {
    tot.closed += l.closed || 0; tot.overdue += l.overdue || 0; tot.aged60 += l.aged60 || 0;
  });

  return {
    date: day,
    cutHour: CONFIG.CHECKPOINT_HOUR,
    headcount: people.length,
    reported: lines.filter(function (l) { return l.status !== 'No entry'; }).length,
    submitted: lines.filter(function (l) { return l.status === 'Submitted'; }).length,
    silent: lines.filter(function (l) { return l.status === 'No entry'; })
                 .map(function (l) { return l.name; }),
    behind: lines.filter(function (l) { return l.status !== 'No entry' && !l.onTrack; })
                 .map(function (l) { return l.name; }),
    totals: tot,
    lines: lines
  };
}

/** Training sessions with their detail. The register only holds sessions
 *  logged since it was added, so anything older is rebuilt from the block it
 *  was recorded in — otherwise the list reads "nothing logged" underneath a
 *  count that says three. */
function trainingDetail_(rows, register, days) {
  var out = [], seen = {};
  register.filter(function (tr) { return days.indexOf(tr.TrainingDate) > -1; })
    .forEach(function (tr) {
      seen[tr.StaffId + '|' + tr.TrainingDate + '|' + tr.Block] = true;
      out.push({ date: tr.TrainingDate, trainer: tr.Trainer, trainee: tr.Trainee,
                 topic: tr.Topic, test: tr.Test, result: tr.Result,
                 followup: tr.Followup, fromRegister: true });
    });
  rows.forEach(function (e) {
    BLOCK_IDS.forEach(function (p) {
      if (String(e[p] || '').trim() !== 'Training delivered') return;
      if (seen[e.StaffId + '|' + e.Date + '|' + p]) return;
      out.push({ date: e.Date, trainer: e.Name, trainee: '',
                 topic: String(e[p + '_Actioned'] || '').trim(),
                 achieved: String(e[p + '_Resolved'] || '').trim(),
                 test: '', result: '', followup: '', fromRegister: false });
    });
  });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

/** The week, Monday to Friday, with last week alongside it for direction. */
function weeklyReport_(anyDateInWeek) {
  var monday = weekStart_(dayArg_(anyDateInWeek) || todayISO_());
  var days = weekDays_(monday);
  var prevDays = weekDays_(shiftDays_(monday, -7));
  var entries = latestEntries_();
  var training = trainingRows_();
  var people = publicRoster_();

  function slice(dayList) {
    var set = {};
    dayList.forEach(function (d) { set[d] = true; });
    return entries.filter(function (e) { return set[e.Date]; });
  }

  function totals(rows) {
    var t = { closed: 0, overdue: 0, aged60: 0, daysLogged: 0, submitted: 0,
              valueAdds: 0, ideas: 0, blockers: 0, flags: 0, training: 0 };
    rows.forEach(function (e) {
      t.daysLogged++;
      if (String(e.Status) === 'Submitted') t.submitted++;
      t.closed += n_(e.Closed) || 0;
      t.overdue += n_(e.Overdue) || 0;
      t.aged60 += n_(e.Aged60) || 0;
      if (isRealValueAdd_(e.ValueAdded)) t.valueAdds++;
      if (hasText_(e.Innovation) && isRealValueAdd_(e.Innovation)) t.ideas++;
      t.blockers += openBlockers_(e).length;
      if (hasText_(e.SystemFlags)) t.flags++;
      t.training += countTraining_([e]);
    });
    return t;
  }

  var thisRows = slice(days), prevRows = slice(prevDays);
  var thisTot = totals(thisRows), prevTot = totals(prevRows);

  // Per person
  var perPerson = people.map(function (p) {
    var mine = thisRows.filter(function (e) { return e.StaffId === p.staffId; });
    var prev = prevRows.filter(function (e) { return e.StaffId === p.staffId; });
    var t = totals(mine), pt = totals(prev);
    var byDay = days.map(function (d) {
      var e = mine.filter(function (x) { return x.Date === d; })[0];
      return {
        date: d,
        status: !e ? 'none' : (String(e.Status) === 'Submitted' ? 'submitted' : 'draft'),
        closed: e ? n_(e.Closed) : null,
        overdue: e ? n_(e.Overdue) : null,
        blocks: e ? blocksDone_(e) : 0
      };
    });
    return {
      staffId: p.staffId, name: p.name, unit: p.unit,
      totals: t, prevTotals: pt, byDay: byDay,
      trainingSessions: countTraining_(mine)
    };
  });

  // What the week actually produced, in his words not mine
  function harvest(field, test) {
    var out = [];
    thisRows.forEach(function (e) {
      if (test(e[field])) {
        out.push({ name: e.Name, staffId: e.StaffId, date: e.Date, text: String(e[field]).trim() });
      }
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  var kpiMix = {};
  thisRows.forEach(function (e) {
    BLOCK_IDS.forEach(function (p) {
      var k = String(e[p] || '').trim();
      if (k) kpiMix[k] = (kpiMix[k] || 0) + 1;
    });
  });
  var mix = Object.keys(kpiMix).map(function (k) { return { kpi: k, count: kpiMix[k] }; })
    .sort(function (a, b) { return b.count - a.count; });

  var blockers = [];
  thisRows.forEach(function (e) {
    openBlockers_(e).forEach(function (b) {
      blockers.push({ name: e.Name, date: e.Date, kpi: b.kpi, text: b.text });
    });
  });

  return {
    weekStart: monday,
    weekEnd: days[days.length - 1],
    days: days,
    headcount: people.length,
    expectedReports: people.length * days.length,
    totals: thisTot,
    prevTotals: prevTot,
    perPerson: perPerson,
    kpiMix: mix,
    valueAdds: harvest('ValueAdded', isRealValueAdd_),
    innovations: harvest('Innovation', isRealValueAdd_),
    systemFlags: harvest('SystemFlags', hasText_),
    blockers: blockers,
    training: trainingDetail_(thisRows, training, days)
  };
}

// ---------------------------------------------------------------------------
//  Web endpoints
// ---------------------------------------------------------------------------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Apps Script gives each request a fresh global scope, so the memos below
   would reset on their own here. Clearing them explicitly at the door makes
   that a property of the code rather than of the runtime — which matters
   because the test harness runs many simulated requests in one process, and a
   memo that outlives its request is a memo serving yesterday's roster. */
function resetRequestMemo_() { _tabMemo = {}; _rosterMemo = null; _headMemo = {}; _hrMemo = {}; _rankMemo = null; }

/* Branch Intelligence lives in this project too, and a script project may
   declare doGet and doPost exactly once — so Intelligence.gs ships with its
   own pair at the foot of the file, to be deleted when it joins a project that
   already has a router. These two hand its actions over.
   intelRoute_ does its own authentication: the five wall reads are
   unauthenticated on purpose, because a screen on a wall has nobody to sign it
   in, and in exchange they return aggregates only; everything else goes
   through iSession_. So they are routed before the tracker's token check,
   which would otherwise refuse them — which is exactly what the wall got on
   7 September, "Session expired" to a television.
   Both are guarded on typeof, so the tracker still runs in a project that has
   no Intelligence.gs in it. */
function doGet(e) {
  resetRequestMemo_();
  var p = (e && e.parameter) || {};
  // A survey link in a client's e-mail is a GET and nothing else answers it.
  if (typeof iSurveyClick_ === 'function') {
    try { var page = iSurveyClick_(e); if (page) return page; } catch (err) {}
  }
  // And so is a tick from the quarter-to-four close-out.
  try { var co = closeoutClick_(e); if (co) return co; } catch (err) {}
  // And the links in the e-mail a block sends when it closes itself.
  try { var bc = blockClick_(e); if (bc) return bc; } catch (err) {}
  // And the answer pages behind the morning, progress and before-you-leave mails.
  if (p.rs) {
    try { var rs = replyClick_(e); if (rs) return rs; }
    catch (err) { return replyPage_('That page did not open.', esc_(String(err && err.message || err)), ''); }
  }
  try {
    return json_(handle_(p.action || 'rows', p, p.token));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  resetRequestMemo_();
  // The reason form behind a block's e-mail posts form-encoded, not JSON.
  if (e && e.parameter && e.parameter.bk && e.parameter.why != null) {
    try { var bp = blockReasonPost_(e); if (bp) return bp; }
    catch (err) { return closeoutPage_('That did not record.', String(err && err.message || err), null); }
  }
  // A Save from one of the answer pages, form-encoded.
  if (e && e.parameter && e.parameter.rs) {
    try { var rp = replyPost_(e); if (rp) return rp; }
    catch (err) { return replyPage_('That did not save.', esc_(String(err && err.message || err)) + '. Go back and press Save again.', ''); }
  }
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  if (typeof intelRoute_ === 'function') {
    try {
      var hit = intelRoute_(body);      // null for anything not an intel.* action
      if (hit) return hit;
    } catch (err) {
      return json_({ ok: false, error: String(err && err.message || err) });
    }
  }
  try {
    return json_(handle_(body.action || 'save', body, body.token));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function handle_(action, data, token) {
  /* Which files this project actually has in it. The tracker runs with any of
     the three missing, and each absence shows up somewhere else entirely —
     "Editing tasks is not switched on" under a Close button, a wall that says
     no feed. On 7 September closing a task from the tracker did nothing and
     there was no way to ask the script what it was carrying. Now there is. */
  if (action === 'ping') {
    return { ok: true, today: todayISO_(), version: SCRIPT_VERSION,
             has: { write:   typeof updateTask_ === 'function',
                    waiting: typeof sfkWaitingSafe_ === 'function',
                    intel:   typeof intelRoute_ === 'function',
                    salesforce: sfkConfigured_() } };
  }
  if (action === 'login') return login_(data.who || data.email, data.password);

  var profile = readToken_(token);
  if (!profile) return { ok: false, error: 'Session expired. Sign in again.', authRequired: true };

  switch (action) {
    case 'me':
      // Resuming a session is a sign-in for the register's purposes: the
      // first activity of the day is the start of the day.
      try { profile.attendance = recordAttendance_(profile); } catch (e) {}
      profile.leads = leads_(profile);
      return { ok: true, profile: profile, roster: publicRoster_(), schedule: SCHEDULE,
               kpis: allKpiChoices_(),
               offRoster: profile.manager ? offRoster_() : undefined };

    case 'absent':
      return markAbsent_(data, profile);

    case 'signOut':
      return signOutDay_(data, profile);

    case 'closeout': {
      var coWho = String(data.staffId || profile.staffId);
      if (coWho !== profile.staffId && !isLeadOf_(profile, coWho) && !profile.manager) {
        return { ok: false, error: 'Not yours to read.' };
      }
      var coP = rosterPerson_(coWho);
      if (!coP) return { ok: false, error: 'Not on the register.' };
      return closeoutFor_(coP, data.date);
    }

    case 'tickCloseout':
      return tickCloseout_(data, profile);

    // The block that closes itself: what it is for, and what was missed.
    case 'plan':        return plansFor_(profile, data);
    case 'savePlan':    return savePlan_(data, profile);
    case 'blockReason': return blockReason_(data, profile);
    case 'createTask': return createTask_(data, profile);

    case 'standing':
      return standing_(profile, data.staffId);

    case 'saveMail':
      return saveMail_(data, profile);

    case 'noteMoment':
      return noteMoment_(data, profile);

    case 'attendance': {
      var aFrom = isoDay_(data.from) || weekStart_(todayISO_());
      var aTo = isoDay_(data.to) || shiftDays_(todayISO_(), 1);
      return { ok: true, from: aFrom, to: aTo, attendance: attendanceFor_(profile, aFrom, aTo),
               people: attVisible_(profile) };
    }

    case 'updateTask':
      if (typeof updateTask_ !== 'function') {
        return { ok: false, error: 'Editing tasks is not switched on. Add KPI-Write.gs to this project.' };
      }
      return updateTask_(data, profile);

    case 'waiting': {
      if (typeof sfkWaitingSafe_ !== 'function') {
        return { ok: false, error: 'Add KPI-Waiting.gs to this project.' };
      }
      return { ok: true, waiting: profile.manager
        ? sfkWaitingSafe_(data.date)
        : sfkWaitingFor_(profile.staffId, data.date) };
    }

    case 'billing':
      return { ok: true, billing: billingFor_(profile, data.date) };

    case 'openBook':
      return { ok: true, book: openBookFor_(profile, data.date) };

    // Performance: the form, the evidence, the two halves.
    case 'hr':            return hrBundle_(profile);
    case 'review':        return review_(profile, String(data.reviewId || ''));
    case 'openReview':    return openReview_(data, profile);
    case 'saveRating':    return saveReviewRating_(data, profile);
    case 'saveComment':   return saveReviewComment_(data, profile);
    case 'saveDevelopment': return saveDevelopment_(data, profile);
    case 'saveTraining':  return saveTraining_(data, profile);

    case 'needsReason': {
      var nr = needsReasonFor_(profile, data.date);
      return { ok: true, needsReason: nr };
    }

    case 'jobDoc':
      return jobDocFor_(profile, data);

    case 'appraisal': {
      var who = profile.manager && data.staffId ? String(data.staffId) : profile.staffId;
      var whoRole = who === profile.staffId ? profile.role
                  : (roleFor_id_(who) || profile.role);
      return appraisal_(who, data.quarter, whoRole);
    }

    case 'saveAppraisal':
      return saveAppraisal_(data, profile);

    case 'metrics': {
      // Staff see their own position; the manager sees the branch.
      return { ok: true, metrics: metricsFor_(profile, data.date) };
    }

    case 'rows': {
      // Staff see their own days. The manager sees the branch.
      var rows = latestEntries_();
      if (!profile.manager) {
        rows = rows.filter(function (r) { return r.StaffId === profile.staffId; });
      }
      rows.forEach(function (r) {
        delete r._row;
        if (r.UpdatedAt) r.UpdatedAt = String(r.UpdatedAt);
        if (r.Timestamp) r.Timestamp = String(r.Timestamp);
      });
      var tr = trainingRows_();
      if (!profile.manager) {
        tr = tr.filter(function (t) { return t.StaffId === profile.staffId; });
      }
      tr.forEach(function (t) { if (t.LoggedAt) t.LoggedAt = String(t.LoggedAt); });
      return { ok: true, rows: rows, training: tr, profile: profile,
               roster: publicRoster_(), schedule: SCHEDULE,
               kpis: allKpiChoices_(),
               metrics: metricsFor_(profile, data.date),
               needsReason: needsReasonFor_(profile, data.date),
               billing: billingFor_(profile, data.date),
               openBook: openBookFor_(profile, data.date),
               attendance: attendanceToday_(profile),
               mail: mailToday_(profile, data.date), ranks: RANKS };
    }

    case 'training': {
      var tr = trainingRows_();
      if (!profile.manager) {
        tr = tr.filter(function (t) { return t.StaffId === profile.staffId; });
      }
      tr.forEach(function (t) { if (t.LoggedAt) t.LoggedAt = String(t.LoggedAt); });
      return { ok: true, training: tr };
    }

    // The office wall. Manager only: it carries client names and everybody's
    // book, which is the Branch Manager's view and nobody else's.
    case 'wall': {
      if (!profile.manager) return { ok: false, error: 'Branch Manager only.' };
      var w = wallDataSafe_();
      return w ? { ok: true, tasks: w }
               : { ok: true, tasks: null,
                   note: 'Salesforce did not answer. The wall keeps the last figures it had.' };
    }

    case 'checkpoint':
      if (!profile.manager) return { ok: false, error: 'Branch Manager only.' };
      return { ok: true, report: checkpointReport_(data.date) };

    case 'weekly':
      if (!profile.manager) return { ok: false, error: 'Branch Manager only.' };
      return { ok: true, report: weeklyReport_(data.date) };

    case 'saveBlock':
      return saveBlock_(data, profile);

    case 'saveDay':
      return saveDay_(data, profile);

    case 'save':
      return saveEntry_(data, profile);

    default:
      return { ok: false, error: 'Unknown action: ' + action };
  }
}

// ---------------------------------------------------------------------------
//  Email reports
//  The 3pm checkpoint lands while there is still a working hour left to use it.
//  The weekly summary lands Friday evening.
// ---------------------------------------------------------------------------

var MAIL = {
  // the film's palette: indigo, electric cyan, mint, amber, coral
  navy: '#141C4A', deep: '#0B1230', gold: '#0EA5C9', soft: '#A5F3FC',
  ink: '#111633', muted: '#6B7AA3', line: '#DCE3F4', paper: '#F3F6FC',
  green: '#1E9E78', amber: '#D97A06', red: '#DC3F3F'
};

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Neither of these may invent a date. Given something that is not a day they
   return it unchanged: a header reading "[object Object]" is obviously broken,
   where "Thursday 1 January 1970" reads like a real report about a quiet day. */
function prettyDate_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  if (isNaN(d.getTime())) return String(iso);
  return Utilities.formatDate(d, 'UTC', 'EEEE d MMMM yyyy');
}

function shortDate_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  if (isNaN(d.getTime())) return String(iso);
  return Utilities.formatDate(d, 'UTC', 'EEE d MMM');
}

function shell_(title, sub, inner) {
  return '' +
  '<div style="margin:0;padding:0;background:' + MAIL.paper + ';font-family:Segoe UI,Helvetica,Arial,sans-serif;color:' + MAIL.ink + '">' +
    '<div style="max-width:660px;margin:0 auto;background:' + MAIL.paper + '">' +
      '<div style="background:' + MAIL.navy + ';background-image:linear-gradient(135deg,#0B1230 0%,#1C2A6E 100%);border-bottom:3px solid ' + MAIL.gold + ';padding:22px 24px">' +
        '<div style="color:' + MAIL.soft + ';font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">Ricky Rampersad Branch</div>' +
        '<div style="color:#fff;font-size:15px;font-weight:800;margin-top:2px">Ricky Rampersad\'s Branch</div>' +
        '<div style="color:#fff;font-size:21px;font-weight:800;margin-top:14px">' + esc_(title) + '</div>' +
        '<div style="color:' + MAIL.soft + ';font-size:13px;margin-top:3px">' + esc_(sub) + '</div>' +
      '</div>' +
      '<div style="padding:20px 24px 34px">' + inner + '</div>' +
      '<div style="padding:0 24px 26px;color:' + MAIL.muted + ';font-size:11px">' +
        '9–13 Endeavour 1st Street, Chaguanas · generated automatically from the Daily KPI &amp; Innovation Tracker' +
      '</div>' +
    '</div>' +
  '</div>';
}

function statTiles_(tiles) {
  var cells = tiles.map(function (t) {
    return '<td style="width:' + Math.floor(100 / tiles.length) + '%;background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:13px 8px;text-align:center">' +
      '<div style="font-size:23px;font-weight:800;line-height:1;color:' + (t.color || MAIL.navy) + '">' + esc_(t.value) + '</div>' +
      '<div style="font-size:10.5px;color:' + MAIL.muted + ';font-weight:600;margin-top:5px">' + esc_(t.label) + '</div>' +
    '</td>';
  }).join('<td style="width:8px"></td>');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px"><tr>' + cells + '</tr></table>';
}

function sectionLabel_(text) {
  return '<div style="margin:24px 0 10px;font-size:11px;font-weight:800;letter-spacing:1.1px;' +
    'text-transform:uppercase;color:' + MAIL.navy + ';border-bottom:1px solid ' + MAIL.gold + ';padding-bottom:6px">' +
    esc_(text) + '</div>';
}

function bullets_(items, accent) {
  if (!items.length) {
    return '<div style="font-size:13px;color:' + MAIL.muted + '">Nothing logged.</div>';
  }
  return items.map(function (it) {
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (accent || MAIL.gold) + ';border-radius:9px;padding:11px 13px;margin-bottom:8px">' +
      '<div style="font-size:11.5px;font-weight:700;color:' + MAIL.navy + '">' + esc_(it.head) + '</div>' +
      '<div style="font-size:13px;line-height:1.5;margin-top:3px">' + esc_(it.body) + '</div>' +
    '</div>';
  }).join('');
}

// ---- 3pm checkpoint -------------------------------------------------------

function checkpointHtml_(r) {
  var tiles = statTiles_([
    { label: 'Reported', value: r.reported + '/' + r.headcount,
      color: r.reported === r.headcount ? MAIL.green : MAIL.amber },
    { label: 'Closed', value: r.totals.closed, color: MAIL.green },
    { label: 'Overdue', value: r.totals.overdue, color: r.totals.overdue > 0 ? MAIL.amber : MAIL.green },
    { label: '60+ days', value: r.totals.aged60, color: r.totals.aged60 > 0 ? MAIL.red : MAIL.green }
  ]);

  var chase = '';
  if (r.silent.length || r.behind.length) {
    var parts = [];
    if (r.silent.length) parts.push('<b>Nothing logged yet:</b> ' + esc_(r.silent.join(', ')));
    if (r.behind.length) parts.push('<b>Day not reported:</b> ' + esc_(r.behind.join(', ')));
    chase = '<div style="background:#FBE9E7;border:1px solid ' + MAIL.red + ';border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;color:#7A2A24;margin-bottom:6px">' +
      'To chase before close of business —<br>' + parts.join('<br>') + '</div>';
  } else {
    chase = '<div style="background:#E9F3EE;border:1px solid ' + MAIL.green + ';border-radius:10px;padding:12px 14px;font-size:13px;color:#1E5B40;margin-bottom:6px">' +
      'Everyone has logged and is on track at the 3pm cut.</div>';
  }

  var rowsHtml = r.lines.map(function (l) {
    var tone = l.status === 'No entry' ? MAIL.red : (l.status === 'Submitted' ? MAIL.green : MAIL.amber);
    var detail = [];
    l.blockers.forEach(function (b) {
      detail.push('<div style="font-size:12px;color:' + MAIL.red + ';margin-top:4px"><b>Blocked' +
        (b.kpi ? ' · ' + esc_(b.kpi) : '') + ':</b> ' + esc_(b.text) + '</div>');
    });
    if (l.noDate) {
      detail.push('<div style="font-size:12px;color:' + MAIL.amber + ';margin-top:4px"><b>No due date:</b> ' +
        l.noDate + ' open task' + (l.noDate === 1 ? '' : 's') +
        ' carrying no due date — invisible to every overdue report.</div>');
    }
    if (l.systemFlags) {
      detail.push('<div style="font-size:12px;color:' + MAIL.red + ';margin-top:3px"><b>Flag:</b> ' + esc_(l.systemFlags) + '</div>');
    }
    if (l.notes) {
      detail.push('<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:3px"><b>Note:</b> ' + esc_(l.notes) + '</div>');
    }
    if (l.valueAdded) {
      detail.push('<div style="font-size:12px;margin-top:3px"><b style="color:' + MAIL.gold + '">Value added:</b> ' + esc_(l.valueAdded) + '</div>');
    }
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:12px 14px;margin-bottom:9px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="font-size:14px;font-weight:700">' + esc_(l.name) +
          '<span style="font-size:11px;color:' + MAIL.muted + ';font-weight:600"> · ' + (l.blocksDone >= blocksOwed_(l.staffId) ? 'day logged' : 'day not logged') +
          (l.updatedAt ? ' · last saved ' + esc_(l.updatedAt) : '') + '</span></td>' +
        '<td align="right" style="font-size:11px;font-weight:700;color:' + tone + '">' + esc_(l.status) + '</td>' +
      '</tr></table>' +
      '<div style="font-size:12px;color:' + (l.absent ? MAIL.amber : MAIL.muted) + ';margin-top:5px">' +
        (l.absent ? 'Not in — ' + esc_(l.absent)
                  : l.signedIn ? 'In at ' + esc_(l.signedIn) + (l.late ? ' · ' + l.late + ' min after their start' : '') +
                                 (l.signedOut ? ' · out at ' + esc_(l.signedOut) : '')
                  : 'No sign-in today') + '</div>' +
      '<div style="font-size:12px;color:' + (l.mailAM || l.mailPM ? MAIL.muted : MAIL.amber) + ';margin-top:3px">' +
        (l.mailAM || l.mailPM
          ? 'Mail: morning ' + (l.mailAM ? esc_(l.mailAM) : '—') + ' · afternoon ' + (l.mailPM ? esc_(l.mailPM) : '—')
          : 'No mail sweep recorded') + '</div>' +
      '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:5px">' +
        'Closed ' + (l.closed == null ? '—' : l.closed) +
        ' · Open ' + (l.openNow == null ? '—' : l.openNow) +
        ' · Overdue ' + (l.overdue == null ? '—' : l.overdue) +
        ' · 60+ ' + (l.aged60 == null ? '—' : l.aged60) +
        (l.fromSalesforce ? ' <span style="color:' + MAIL.green + '">· live from Salesforce</span>' : '') +
        '</div>' +
      detail.join('') +
    '</div>';
  }).join('');

  return shell_('3pm Checkpoint', prettyDate_(r.date),
    tiles + chase + sectionLabel_('Where each person stands') + rowsHtml);
}

function sendCheckpoint(dateOpt) {
  if (nothingToReport_(dateOpt)) return 'Nobody signed in and nothing was filed — no checkpoint.';
  var r = checkpointReport_(dateOpt);
  var to = managerEmails_();
  if (!to.length) throw new Error('No manager email configured.');
  MailApp.sendEmail({
    to: to.join(','), cc: salesSupportCc_(to.join(',')),
    subject: 'RRB 3pm Checkpoint · ' + shortDate_(r.date) + ' · ' +
             r.reported + '/' + r.headcount + ' logged',
    htmlBody: checkpointHtml_(r)
  });
  var msg = 'Sent to ' + to.join(', ');
  Logger.log(msg);
  return msg;
}

// ---- weekly summary -------------------------------------------------------

/** A delta is only worth showing when there is a week behind it to compare
 *  against. With nothing logged last week, "▲ 69 vs last week" says nothing. */
function delta_(now, was, comparable) {
  if (!comparable) return '';
  var d = (now || 0) - (was || 0);
  if (!was && !now) return '';
  var arrow = d > 0 ? '▲' : (d < 0 ? '▼' : '—');
  var col = d === 0 ? MAIL.muted : MAIL.ink;
  return '<span style="font-size:10.5px;color:' + col + ';font-weight:600"> ' + arrow +
         (d === 0 ? '' : ' ' + Math.abs(d)) + ' vs last week</span>';
}

function weeklyHtml_(r) {
  var t = r.totals, p = r.prevTotals;
  var coverage = r.expectedReports ? Math.round((t.daysLogged / r.expectedReports) * 100) : 0;

  var tiles = statTiles_([
    { label: 'Reports in', value: t.daysLogged + '/' + r.expectedReports,
      color: coverage >= 90 ? MAIL.green : coverage >= 70 ? MAIL.amber : MAIL.red },
    { label: 'Closed', value: t.closed, color: MAIL.green },
    { label: 'Value adds', value: t.valueAdds, color: MAIL.gold },
    { label: 'Ideas', value: t.ideas, color: MAIL.navy }
  ]);

  var comparable = p.daysLogged > 0;
  var movement =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;margin-bottom:6px">' +
    [['Tasks closed', t.closed, p.closed],
     ['Overdue at week end', t.overdue, p.overdue],
     ['Aged 60+ days', t.aged60, p.aged60],
     ['Value added logged', t.valueAdds, p.valueAdds],
     ['Ideas logged', t.ideas, p.ideas],
     ['Training delivered', t.training, p.training],
     ['Blockers raised', t.blockers, p.blockers]
    ].map(function (row, i) {
      return '<tr>' +
        '<td style="padding:9px 14px;font-size:13px;' + (i ? 'border-top:1px solid ' + MAIL.line : '') + '">' + esc_(row[0]) + '</td>' +
        '<td align="right" style="padding:9px 14px;font-size:14px;font-weight:800;' + (i ? 'border-top:1px solid ' + MAIL.line : '') + '">' +
          row[1] + delta_(row[1], row[2], comparable) + '</td>' +
      '</tr>';
    }).join('') + '</table>';

  // Per person, with the week's shape at a glance
  var people = r.perPerson.map(function (pp) {
    var strip = pp.byDay.map(function (d) {
      var bg = d.status === 'submitted' ? MAIL.green : d.status === 'draft' ? MAIL.amber : '#E4E0D6';
      return '<td align="center" style="padding:0 3px">' +
        '<div style="background:' + bg + ';border-radius:5px;height:26px;line-height:26px;color:' +
          (d.status === 'none' ? MAIL.muted : '#fff') + ';font-size:11px;font-weight:700">' +
          (d.status === 'none' ? '–' : (d.blocks ? '✓' : '·')) + '</div>' +
        '<div style="font-size:9px;color:' + MAIL.muted + ';margin-top:3px">' +
          shortDate_(d.date).slice(0, 3) + '</div></td>';
    }).join('');
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:12px 14px;margin-bottom:9px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="font-size:14px;font-weight:700">' + esc_(pp.name) + '</td>' +
        '<td align="right" style="font-size:11.5px;color:' + MAIL.muted + '">' +
          pp.totals.daysLogged + '/5 days · ' + pp.totals.closed + ' closed' +
          (pp.trainingSessions ? ' · ' + pp.trainingSessions + ' training' : '') + '</td>' +
      '</tr></table>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:9px"><tr>' + strip + '</tr></table>' +
    '</div>';
  }).join('');

  var mix = r.kpiMix.slice(0, 8);
  var maxMix = mix.length ? mix[0].count : 1;
  var mixHtml = mix.length ? mix.map(function (m) {
    var w = Math.max(4, Math.round((m.count / maxMix) * 100));
    return '<div style="margin-bottom:7px">' +
      '<div style="font-size:12px;display:block">' + esc_(m.kpi) +
        '<span style="color:' + MAIL.muted + ';font-weight:700"> · ' + m.count + '</span></div>' +
      '<div style="background:#EDE9DE;border-radius:4px;height:7px;margin-top:3px">' +
        '<div style="background:' + MAIL.navy + ';width:' + w + '%;height:7px;border-radius:4px"></div></div>' +
    '</div>';
  }).join('') : '<div style="font-size:13px;color:' + MAIL.muted + '">Nothing logged.</div>';

  var inner =
    tiles +
    sectionLabel_('Movement on last week') +
      (comparable ? '' :
        '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin-bottom:8px">' +
        'Nothing was logged the week before, so there is nothing to compare against.</div>') +
      movement +
    sectionLabel_('The week, person by person') + people +
    sectionLabel_('Where the time went') + mixHtml +
    sectionLabel_('Value added') +
      bullets_(r.valueAdds.map(function (v) {
        return { head: v.name + ' · ' + shortDate_(v.date), body: v.text };
      }), MAIL.gold) +
    sectionLabel_('Innovations & ideas') +
      bullets_(r.innovations.map(function (v) {
        return { head: v.name + ' · ' + shortDate_(v.date), body: v.text };
      }), MAIL.navy) +
    sectionLabel_('Training delivered') +
      bullets_(r.training.map(function (tr) {
        var body = (tr.topic || '') +
          (tr.achieved ? ' · ' + tr.achieved : '') +
          (tr.test ? ' · Test: ' + tr.test + (tr.result ? ' (' + tr.result + ')' : '') : '') +
          (tr.followup ? ' · Next: ' + tr.followup : '');
        var head = tr.trainee
          ? (tr.trainer || '?') + ' → ' + tr.trainee + ' · ' + shortDate_(tr.date)
          : (tr.trainer || '?') + ' · ' + shortDate_(tr.date);
        return { head: head, body: body || '—' };
      }), MAIL.green) +
    sectionLabel_('Blockers raised') +
      bullets_(r.blockers.map(function (b) {
        return { head: b.name + ' · ' + shortDate_(b.date) + (b.kpi ? ' · ' + b.kpi : ''), body: b.text };
      }), MAIL.red) +
    sectionLabel_('System flags') +
      bullets_(r.systemFlags.map(function (f) {
        return { head: f.name + ' · ' + shortDate_(f.date), body: f.text };
      }), MAIL.red);

  return shell_('Weekly Summary', shortDate_(r.weekStart) + ' – ' + shortDate_(r.weekEnd), inner);
}

function sendWeekly(dateOpt) {
  var r = weeklyReport_(dateOpt);
  var to = managerEmails_();
  if (!to.length) throw new Error('No manager email configured.');
  MailApp.sendEmail({
    to: to.join(','), cc: salesSupportCc_(to.join(',')),
    subject: 'RRB Weekly Summary · ' + shortDate_(r.weekStart) + ' – ' + shortDate_(r.weekEnd) +
             ' · ' + r.totals.closed + ' closed, ' + r.totals.valueAdds + ' value adds',
    htmlBody: weeklyHtml_(r)
  });
  var msg = 'Sent to ' + to.join(', ');
  Logger.log(msg);
  return msg;
}

// ---- triggers -------------------------------------------------------------

/** Run once from the editor. Safe to re-run: it clears its own triggers first. */
/** Everything this tool installs. Anything else in the project is somebody
 *  else's and is left alone. */
var MY_TRIGGERS = ['sendCheckpoint', 'sendWeekly', 'remindMidday', 'remindCheckpoint',
                   'sendCloseout', 'sendBranchPulse', 'keepWarm', 'closeBlocks'];

/** Handlers from earlier versions of this tool. Replacing the code does not
 *  remove the triggers that call it — they are stored against the project, not
 *  the file — so a daily digest kept arriving long after the function that
 *  built it had been pasted over. Named here so installTriggers() clears them. */
var RETIRED_TRIGGERS = ['sendWeeklyRollup', 'sendDailyDigest', 'dailyDigest',
                        'sendDigest', 'sendDaily', 'dailySummary', 'sendDailySummary'];

/** What is actually scheduled in this project, whoever put it there. Run this
 *  when something arrives that you did not expect. */
function listTriggers() {
  var all = ScriptApp.getProjectTriggers();
  if (!all.length) { Logger.log('No triggers installed.'); return 'No triggers installed.'; }
  var out = ['This project has ' + all.length + ' trigger(s):', ''];
  all.forEach(function (t) {
    var fn = t.getHandlerFunction();
    var who = MY_TRIGGERS.indexOf(fn) > -1 ? 'the tracker'
            : RETIRED_TRIGGERS.indexOf(fn) > -1 ? 'RETIRED — installTriggers() will remove it'
            : typeof this[fn] === 'function' ? 'something else in this project'
            : 'ORPHAN — the function no longer exists, so it fails every time';
    out.push('  ' + pad_(fn, 26) + who);
  });
  out.push('', 'To remove one by hand: the clock icon in the left bar, then the');
  out.push('three dots beside the trigger, then Delete.');
  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}

/** Keep the container awake during working hours.
 *
 *  Apps Script puts a project to sleep when nobody has touched it, and the
 *  next person to arrive pays the start-up. Measured on 3 September: a bare
 *  ping — a function that only returns today's date — took 26 seconds cold,
 *  then 2.1 and 1.4 warm. Almost everybody in a nine-person branch arrives
 *  cold, because nobody logs in twice in five minutes.
 *
 *  This does the cheapest possible thing often enough that the project never
 *  goes cold between eight and six. It reads one cell and stops.
 *
 *  It is not a guarantee — Google does not promise a warm container — but it
 *  costs one trivial execution every ten minutes and the alternative is a
 *  member of staff staring at "Signing in" for half a minute. */
/* Whether a timed run has anything to report.

   THE CALENDAR NO LONGER DECIDES. This used to skip Saturday and Sunday
   outright, which is a rule about office hours and not about this branch —
   the branch works around the clock, and a Saturday somebody actually worked
   deserves its checkpoint every bit as much as a Tuesday. So the day's own
   record decides instead: nobody signed in and nothing filed means there is
   nothing to send, on any day of the week; one person at a desk means there
   is, on any day of the week.

   That is also the rule that was really wanted when the weekday copies were
   collapsed. A script project carries at most twenty triggers, and this one
   used to spend fifteen on five weekday copies each of the checkpoint and the
   two nudges — so the day Branch Intelligence joined, its six could not be
   installed. Each of the three now runs once a day and asks this.

   If the record cannot be read, the mail goes out: a checkpoint nobody needed
   is a smaller failure than a day that went unreported. A person running the
   function from the editor is never turned away. */
function nothingToReport_(e) {
  if (!e || !e.triggerUid) return false;    // a person, not the clock
  var day = todayISO_();
  try {
    var att = attendanceFor_({ staffId: '', manager: true }, day, shiftDays_(day, 1)) || [];
    if (att.some(function (o) { return o.at || o.status === 'absent'; })) return false;
  } catch (err) { return false; }
  try {
    if (allEntries_().some(function (r) { return String(r.Date || '').slice(0, 10) === day; })) return false;
  } catch (err2) { return false; }
  return true;
}

/* Every ten minutes, every hour, every day of the week. It used to stand down
   overnight and at weekends, which meant the container was cold at exactly the
   times somebody working late or on a Saturday came to sign in — half a minute
   of "Signing in" for the person least able to ask anybody about it. It reads
   one cell; running it round the clock costs nothing worth counting. */
function keepWarm() {
  try { ss_().getSheets()[0].getRange(1, 1).getValue(); } catch (e) {}
  // Housekeeping rides on this ten-minute trigger rather than adding one.
  try { housekeepingTick_(); } catch (e) {}
}

function installTriggers() {
  var removed = [];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    // Ours, so it can be reinstalled cleanly; or a retired handler from an
    // earlier version that is still sending mail nobody asked for.
    if (MY_TRIGGERS.indexOf(fn) > -1 || RETIRED_TRIGGERS.indexOf(fn) > -1) {
      ScriptApp.deleteTrigger(t);
      if (RETIRED_TRIGGERS.indexOf(fn) > -1) removed.push(fn);
    }
  });

  // 3pm checkpoint. Apps Script fires within the hour, so the mail lands
  // between 3 and 4 — while the last block is still running. One trigger a
  // day, not one per weekday: the function turns a weekend fire away itself
  // (nothingToReport_), and the twenty-trigger limit on a project is shared
  // with Branch Intelligence.
  ScriptApp.newTrigger('sendCheckpoint').timeBased()
    .everyDays(1).atHour(CONFIG.CHECKPOINT_HOUR).create();

  // Staff nudges. Noon for a blank morning, three for an unfinished day.
  ScriptApp.newTrigger('remindMidday').timeBased().everyDays(1).atHour(12).create();
  ScriptApp.newTrigger('remindCheckpoint').timeBased().everyDays(1).atHour(CONFIG.CHECKPOINT_HOUR).create();

  // Two o'clock: the branch's own message, written and handed over ready to
  // send. Two hours left in the day, which is what makes it a prompt rather
  // than a report.
  ScriptApp.newTrigger('sendBranchPulse').timeBased().everyDays(1).atHour(PULSE_HOUR).create();

  // Before you leave, at a quarter to four. Late enough that the answer is
  // the day's, early enough that a person can still act on what is missing —
  // nearMinute is Apps Script's word for "about then", which is as close as
  // a time-based trigger gets.
  ScriptApp.newTrigger('sendCloseout').timeBased()
    .everyDays(1).atHour(CLOSEOUT_HOUR).nearMinute(CLOSEOUT_MINUTE).create();

  // Weekly summary, Friday evening once the day is in.
  ScriptApp.newTrigger('sendWeekly').timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(17).create();

  // And one that keeps the project awake, so nobody pays the cold start.
  ScriptApp.newTrigger('keepWarm').timeBased().everyMinutes(10).create();

  // Every hour, the blocks that have ended close themselves — read from
  // Salesforce, filed if nobody filed them, e-mailed only when something on
  // the plan was missed. Apps Script fires an hourly trigger somewhere inside
  // the hour, so a block that ends at ten is closed by eleven.
  ScriptApp.newTrigger('closeBlocks').timeBased().everyHours(1).create();

  var msg = 'Eight triggers installed. Warm-up every 10 minutes and the day closer every hour, round the clock. Staff nudges at 12:00 and ' +
            CONFIG.CHECKPOINT_HOUR + ':00, branch checkpoint ' + CONFIG.CHECKPOINT_HOUR +
            ':00, the branch message at ' + PULSE_HOUR + ':00, before-you-leave close-out ' +
            CLOSEOUT_HOUR + ':' + CLOSEOUT_MINUTE +
            ', weekly summary Friday 17:00 (' + CONFIG.TZ + '). The daily ones turn a day nobody ' +
            'opened away themselves. Eight here and Branch Intelligence\'s twelve is twenty, ' +
            'which is the project limit — the next trigger anybody adds has to replace one.';
  if (removed.length) {
    msg += '\n\nStopped ' + removed.length + ' retired trigger(s) from the previous ' +
           'version: ' + removed.join(', ') + '.';
  }
  msg += '\n\nRun listTriggers() to see everything scheduled in this project — ' +
         'anything still arriving that you did not ask for will be named there.';
  Logger.log(msg);
  return msg;
}

/** Preview either report in the editor without emailing anyone. */
function previewCheckpoint() { Logger.log(checkpointHtml_(checkpointReport_())); }
function previewWeekly() { Logger.log(weeklyHtml_(weeklyReport_())); }

// ---------------------------------------------------------------------------
//  What the staff member gets back
//  A block is submitted and the record of it lands in their own inbox. It is
//  their copy — the thing to forward, or to paste into the branch group —
//  without anybody re-typing what they just wrote.
// ---------------------------------------------------------------------------

function emailFor_(staffId) {
  var p = roster_().filter(function (x) { return x.staffId === staffId; })[0];
  return p && p.email ? p.email : '';
}

function nameFor_(staffId) {
  var p = roster_().filter(function (x) { return x.staffId === staffId; })[0];
  return p && p.name ? p.name : staffId;
}

function line_(label, value, tone) {
  if (!hasText_(value)) return '';
  return '<div style="margin-top:7px">' +
    '<div style="font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' +
      (tone || MAIL.muted) + '">' + esc_(label) + '</div>' +
    '<div style="font-size:13.5px;line-height:1.5;color:' + MAIL.ink + '">' + esc_(value) + '</div>' +
  '</div>';
}

function emailBlockReceipt_(staffId, date, blockId, d, payload, done) {
  var to = emailFor_(staffId);
  if (!to) return;

  var sched = scheduleFor_(staffId).blocks[blockId] || {};
  // Only what this person's own schedule names: one plan a day now.
  var owedIds = BLOCK_IDS.filter(function (p) { return scheduleFor_(staffId).blocks[p]; });
  var remaining = owedIds.filter(function (p) { return done.indexOf(p) === -1; });
  var doneOwed = owedIds.filter(function (p) { return done.indexOf(p) > -1; }).length;

  var progress = owedIds.map(function (p) {
    var on = done.indexOf(p) > -1;
    return '<td align="center" style="padding:0 3px">' +
      '<div style="background:' + (on ? MAIL.green : '#E4E0D6') + ';border-radius:5px;height:26px;' +
        'line-height:26px;color:' + (on ? '#fff' : MAIL.muted) + ';font-size:10.5px;font-weight:700">' +
        (on ? '✓' : '–') + '</div>' +
      '<div style="font-size:9px;color:' + MAIL.muted + ';margin-top:3px">' + esc_(blockLabel_(p)) + '</div></td>';
  }).join('');

  var body =
    '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.gold +
      ';border-radius:10px;padding:14px 16px">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.gold + '">' +
        esc_(blockLabel_(blockId)) + (sched.time ? ' · ' + esc_(sched.time) : '') + '</div>' +
      '<div style="font-size:16px;font-weight:800;margin-top:3px">' + esc_(d.kpi || sched.focus || '—') + '</div>' +
      line_('Actioned', d.actioned) +
      line_('Resolved / closed', d.resolved, MAIL.green) +
      line_('Still open & owned by you', d.openOwned, MAIL.amber) +
      line_('Blocked', joinBlocker_(d.blocker, d.blockerOwner), MAIL.red) +
      (d.tr_trainee || d.tr_topic
        ? line_('Training delivered', (d.tr_trainee || '?') + ' — ' + (d.tr_topic || '') +
            (d.tr_test ? ' · Test: ' + d.tr_test + (d.tr_result ? ' (' + d.tr_result + ')' : '') : ''), MAIL.green)
        : '') +
    '</div>' +

    (payload && (hasText_(payload.valueAdded) || hasText_(payload.innovation) || hasText_(payload.systemFlags))
      ? '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:12px 16px;margin-top:9px">' +
          line_('Value added', payload.valueAdded, MAIL.gold) +
          line_('Idea', payload.innovation, MAIL.navy) +
          line_('System flag', payload.systemFlags, MAIL.red) +
        '</div>'
      : '') +

    (owedIds.length > 1 ? sectionLabel_('Your day so far') +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + progress + '</tr></table>' : '') +
    '<div style="font-size:13px;color:' + MAIL.muted + ';margin-top:12px;line-height:1.5">' +
      (remaining.length
        ? 'Still to come: <b style="color:' + MAIL.ink + '">' + esc_(remaining.map(blockLabel_).join(', ')) + '</b>.'
        : 'Your day is logged. Your progress check comes before lunch, and the close-out half an hour before you leave.') +
    '</div>';

  MailApp.sendEmail({
    to: to, cc: salesSupportCc_(to),
    subject: blockLabel_(blockId) + ' · logged · ' + shortDate_(date) +
             (owedIds.length > 1 ? ' · ' + doneOwed + '/' + owedIds.length + ' in' : ''),
    htmlBody: shell_(blockLabel_(blockId) + ' logged', nameFor_(staffId) + ' · ' + prettyDate_(date), body)
  });
}

// ---------------------------------------------------------------------------
//  Nudges
//  Two, and only two. A quiet morning gets one at noon; an unfinished day gets
//  one at three. Anyone already up to date is not written to at all — a
//  reminder that arrives when you have done the thing teaches people to ignore
//  reminders.
// ---------------------------------------------------------------------------

function nudge_(staffId, date, missing, heading, message) {
  var to = emailFor_(staffId);
  if (!to) return false;
  var sched = scheduleFor_(staffId);

  var rows = missing.map(function (p) {
    var b = sched.blocks[p] || {};
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.amber +
      ';border-radius:9px;padding:11px 14px;margin-bottom:8px">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + MAIL.amber + '">' +
        esc_(blockLabel_(p)) + (b.time ? ' · ' + esc_(b.time) : '') + '</div>' +
      '<div style="font-size:14px;margin-top:2px">' + esc_(b.focus || '') + '</div>' +
    '</div>';
  }).join('');

  MailApp.sendEmail({
    to: to,
    cc: dayStartCc_(to).join(',') || undefined,
    subject: heading + ' · ' + shortDate_(date),
    htmlBody: shell_(heading, nameFor_(staffId) + ' · ' + prettyDate_(date),
      '<div style="background:' + MAIL.paper + ';border:1px solid ' + MAIL.gold +
        ';border-radius:10px;padding:13px 15px;font-size:14px;line-height:1.55;margin-bottom:16px">' +
        message + '</div>' +
      sectionLabel_('Outstanding') + rows +
      '<div style="font-size:13px;color:' + MAIL.muted + ';line-height:1.55;margin-top:6px">' +
        'Plan the day in the morning and press the morning check, give your progress at midday, and close the day off before you leave. ' +
        'No morning check reads as absent, and your work is shared out to whoever is in.' +
      '</div>')
  });
  return true;
}

/* NO TIME BLOCKS (17 October 2026). The day is one plan: planned in the
   morning with the morning check, progress before lunch, closed off before
   leaving, the week on Friday. So the two nudges ask about the day, not about
   blocks, and say nothing to anyone already up to date or marked absent. */

/** Who is marked absent today, from the register. */
function absentToday_(day) {
  var out = {};
  try {
    (hrRows_(ATT, true) || []).forEach(function (r) {
      if (isoDay_(r.Date) === day && String(r.Status || '').toLowerCase() === 'absent') out[String(r.StaffId)] = 1;
    });
  } catch (e) {}
  return out;
}

/** Noon. Anyone in whose day is still not planned hears about it while the
 *  afternoon can still be used. */
function remindMidday(e) {
  if (nothingToReport_(e)) return 'Nobody signed in and nothing was filed — nobody nudged.';
  var date = todayISO_();
  var people = publicRoster_();
  var away = absentToday_(date);
  var sent = [];

  people.forEach(function (p) {
    if (away[String(p.staffId)]) return;
    var owed = BLOCK_IDS.filter(function (b) { return scheduleFor_(p.staffId).blocks[b]; });
    var done = blocksSubmittedOn_(p.staffId, date);
    var missing = owed.filter(function (b) { return done.indexOf(b) === -1; });
    if (missing.length === 0) return;                 // up to date; say nothing
    if (nudge_(p.staffId, date, missing, 'Your day is not planned',
        'Nothing has been planned or logged for today yet. Open your plan, pick the work, and save it: that is your morning check.')) {
      sent.push(p.name);
    }
  });

  var msg = sent.length
    ? 'Midday reminder sent to: ' + sent.join(', ')
    : 'Midday reminder: everyone is up to date, nothing sent.';
  Logger.log(msg);
  return msg;
}

/** Three o'clock. Anyone still at work with nothing logged for the day gets
 *  one line asking for it before they leave. A desk whose day has already
 *  ended had its close-out notice half an hour before it did. */
function remindCheckpoint(e) {
  if (nothingToReport_(e)) return 'Nobody signed in and nothing was filed — nobody nudged.';
  var date = todayISO_();
  var people = publicRoster_();
  var away = absentToday_(date);
  var nowM = minutesOf_(hhmm_(new Date()));
  var sent = [];

  people.forEach(function (p) {
    if (away[String(p.staffId)]) return;
    var sp = parseSpan_(scheduleFor_(p.staffId).hours || '');
    if (sp && sp.end <= nowM + 30) return;            // their close-out is already out
    var owed = BLOCK_IDS.filter(function (b) { return scheduleFor_(p.staffId).blocks[b]; });
    var done = blocksSubmittedOn_(p.staffId, date);
    var due = owed.filter(function (b) { return done.indexOf(b) === -1; });
    if (due.length === 0) return;
    if (nudge_(p.staffId, date, due, 'Your day is not logged',
        'It is past three and nothing is logged for today. Write what you have done against your plan, and close the day off before you leave.')) {
      sent.push(p.name);
    }
  });

  var msg = sent.length
    ? '3pm chase sent to: ' + sent.join(', ')
    : '3pm chase: everyone is up to date, nothing sent.';
  Logger.log(msg);
  return msg;
}

// ---------------------------------------------------------------------------
//  The day start
//
//  "The first email that goes out, copy the sales support, is thanking the
//  staff for logging in. We know the time. And looking at how their day has
//  been planned ... if the model on their email sees it does not, it builds
//  in the other things that are pending. So they will have to go back and
//  redo." (Ricky, 14 October 2026.)
//
//  Two e-mails, each once a day per person, each copied to the Branch Manager
//  and sales support:
//    'first' — on the first block filed that day, which is how the morning is
//              actually used. It thanks them, gives the sign-in time, shows
//              each block as filed and, beside it, what Salesforce has due or
//              overdue for that block's work and is not yet in the plan.
//    'plan'  — the first time that day a block is planned with Salesforce
//              tasks picked into it: "Plan received", with what is still
//              missing.
//  Nothing here invents work. Every line under "Salesforce has" is a real
//  task the person can open.
//
//  Copy list: managerEmails_() plus Script Property DAYSTART_CC
//  (comma-separated); if DAYSTART_CC is unset, sales support.
// ---------------------------------------------------------------------------

var DAYSTART_CC_DEFAULT = 'rickyrampersadsalessupport@myguardiangroup.com';
var DAYSTART_LIST_MAX = 6;
var DAYSTART_REPLAN_MIN = 30;
var PLANNER_URL = 'https://rickyrampersadbranch.com/kpi/';

/* Sales support is copied on everything the day mail sends, Pawan's included
   ("ensure sales support is copied", Ricky, 14 October 2026). DAYSTART_CC
   adds addresses; it can never take sales support off. PRIVATE_DESKS is
   kept, empty, so a desk can be made Branch-Manager-only again by name. */
var PRIVATE_DESKS = [];

/** Sales support, for the mails that are built for the managers alone. */
function salesSupportCc_(to) {
  return normEmail_(to || '').indexOf(normEmail_(DAYSTART_CC_DEFAULT)) > -1 ? undefined : DAYSTART_CC_DEFAULT;
}

function dayStartCc_(to, sid) {
  var p = PropertiesService.getScriptProperties().getProperty('DAYSTART_CC');
  var extra = [DAYSTART_CC_DEFAULT].concat((p && p.trim()) ? p.split(',') : []);
  var priv = PRIVATE_DESKS.some(function (d) {
    if (sid && String(sid) === d) return true;
    var e = ''; try { e = emailFor_(d); } catch (err) {}
    return !!(to && e && normEmail_(to) === normEmail_(e));
  });
  if (priv) extra = [];
  var seen = {}; seen[normEmail_(to)] = true;
  return managerEmails_().concat(extra).map(function (s) { return String(s).trim(); })
    .filter(function (s) { var k = normEmail_(s); if (!s || seen[k]) return false; seen[k] = true; return true; });
}

/** "07:05" -> "7:05am". */
function twelve_(hhmm) {
  var m = minutesOf_(hhmm);
  if (m == null) return String(hhmm || '');
  var h = Math.floor(m / 60), mi = m % 60, ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return h + ':' + (mi < 10 ? '0' : '') + mi + ap;
}

/** The Salesforce types a block's work lands in: the one the schedule set,
 *  plus any typed label the person chose for it on the form. */
function blockSfTypes_(schedKpi, chosen) {
  var out = {}, sf = {};
  sfTypeList_().forEach(function (t) { sf[t] = 1; });
  var t0 = blockTypeFor_(schedKpi);
  if (t0) out[t0] = 1;
  String(chosen || '').split(',').forEach(function (l) {
    l = l.trim();
    if (sf[l]) out[l] = 1;
    else if (blockTypeFor_(l)) out[blockTypeFor_(l)] = 1;
  });
  return Object.keys(out);
}

function dayStartTaskLine_(t, date) {
  var when = t.late ? 'overdue since ' + shortDate_(t.due) : (t.due === date ? 'due today' : '');
  return '<div style="font-size:12.5px;line-height:1.45;padding:3px 0;border-top:1px solid ' + MAIL.line + '">' +
    payoffTag_(t).replace(/^ /, '') + (payoffOf_(t).label ? ' ' : '') + esc_(t.subject) + (when ? ' <span style="color:' + (t.late ? MAIL.red : MAIL.amber) + ';font-weight:700">· ' + esc_(when) + '</span>' : '') +
    (t.needs ? ' <span style="color:' + MAIL.muted + '">· untouched ' + t.touched + ' days</span>' : '') +
  '</div>';
}

function sendDayStart_(staffId, date, kind, opt) {
  opt = opt || {};
  var props = PropertiesService.getScriptProperties();
  var onceKey = 'daystart_' + kind + '_' + staffId + '_' + date;
  var had = props.getProperty(onceKey);
  if (kind === 'plan') {
    // The first plan, then each fix: a save from the answer page always
    // mails (up to PLAN_MAIL_MAX); a save from the tracker, which saves one
    // block at a time, mails at most every twenty minutes.
    var pm = String(had || '').split('|'), n = Number(pm[0]) || 0, last = Number(pm[1]) || 0;
    if (n >= PLAN_MAIL_MAX || (had && !opt.force && Date.now() - last < 20 * 60000)) return false;
    var to = emailFor_(staffId);
    if (!to) return false;
    props.setProperty(onceKey, (n + 1) + '|' + Date.now());
  } else {
    if (had) return false;
    var to = emailFor_(staffId);
    if (!to) return false;
    props.setProperty(onceKey, hhmm_(new Date()));
  }
  // The assistant's day is a calendar of errands and deliveries, not KPI
  // blocks, so it has a mail of its own.
  if (staffId === 'pawan') return kind === 'first' ? sendPawanDay_(date, 'first') : false;

  var sched = scheduleFor_(staffId);
  var name = nameFor_(staffId), first = String(name).split(' ')[0];

  var signIn = '';
  try { var a = attRow_(sheetObjects_(attSheet_()), date, staffId); if (a) signIn = timeStr_(a.row.FirstSignIn); } catch (e) {}

  var vals = null, idx = {};
  try { var sh = logSheet_(); idx = colMap_(sh); vals = findDayRow_(sh, idx, staffId, date).vals; } catch (e) {}
  var cell = function (n) { return (vals && idx[n] != null) ? vals[idx[n]] : ''; };

  var plans = {};
  try { plans = planRows_(staffId, date); } catch (e) {}

  var sfOk = sfkConfigured_(), book = {};
  if (sfOk) { try { book = (sfkOpenBook_(date) || {})[staffId] || {}; } catch (e) { sfOk = false; } }

  var overdue = 0, dueToday = 0;
  Object.keys(book).forEach(function (ty) {
    book[ty].forEach(function (t) { if (t.late) overdue++; else if (t.due === date) dueToday++; });
  });

  // Each block's types, then each due or overdue task given to ONE block: the
  // block whose scheduled work is that type, else the first block that took
  // it on, else "not in any block". A task listed under every block that
  // mentions Servicing is the same task four times, not four tasks.
  var blocks = [], plannedAll = {};
  BLOCK_IDS.forEach(function (b) {
    var sb = sched.blocks[b];
    if (!sb) return;
    var chosen = String(cell(b) || '').trim();
    var planned = {};
    if (plans[b]) planItemsOf_(plans[b].Items).forEach(function (it) { if (it.k === 'sf') { planned[it.id] = it; plannedAll[it.id] = 1; } });
    blocks.push({ id: b, sb: sb, chosen: chosen, own: blockTypeFor_(sb.kpi), types: blockSfTypes_(sb.kpi, chosen), planned: planned, waiting: [] });
  });
  var loose = [];
  Object.keys(book).forEach(function (ty) {
    book[ty].forEach(function (t) {
      if (!(t.late || t.due === date) || plannedAll[t.id]) return;
      var home = blocks.filter(function (x) { return x.own === ty; })[0] ||
                 blocks.filter(function (x) { return x.types.indexOf(ty) > -1; })[0];
      t.ty = ty;
      if (home) home.waiting.push(t); else loose.push({ t: t, ty: ty });
    });
  });

  // Thursday's innovation hour: no ordinary tasks in that block.
  var innoB = innovationBlock_(staffId, date), inno = null;
  if (sfOk) { try { inno = (sfkInnovation_(date) || {})[staffId] || { open: [], lastClosed: '' }; } catch (e) { inno = null; } }
  var suggestBlocks = blocks;
  if (innoB) {
    blocks.forEach(function (x) {
      if (x.id !== innoB) return;
      x.waiting.forEach(function (t) { loose.push({ t: t, ty: t.ty }); });
      x.waiting = []; x.inno = true;
    });
    suggestBlocks = blocks.filter(function (x) { return x.id !== innoB; });
  }

  // What the record shows, and today's number put into the blocks by name.
  var intel = null;
  try { intel = intelFor_(staffId, date); } catch (e) { intel = null; }
  var waitingAll = loose.length + blocks.reduce(function (a, x) { return a + x.waiting.length; }, 0);
  var plannedCount = Object.keys(plannedAll).length;
  var target = sfOk ? plannedCount + intelTarget_(intel, dueToday, overdue, waitingAll) : 0;
  // "Plan received" reads against the morning's number, and shows the plan
  // as made rather than a second suggestion on top of it.
  if (kind === 'plan') target = Number(props.getProperty(intelTargetKey_(staffId, date)) || 0) || target;
  var suggest = (sfOk && kind === 'first') ? suggestPlan_(staffId, suggestBlocks, loose.map(function (x) { return x.t; }), Math.max(0, target - plannedCount)) : {};
  var suggested = {};
  Object.keys(suggest).forEach(function (b) { suggest[b].forEach(function (x) { suggested[x.t.id] = 1; }); });
  if (sfOk && kind === 'first') {
    try {
      props.setProperty(intelTargetKey_(staffId, date), String(target));
      props.setProperty('intel_plan_' + staffId + '_' + date, JSON.stringify(Object.keys(suggested)));
    } catch (e) {}
    saveIntelModel_(staffId, date, blocks, suggest, loose.map(function (x) { return x.t; }), innoB ? { block: innoB, open: (inno && inno.open) || [] } : null);
  }
  var check = (sfOk && kind === 'plan') ? planCheck_(staffId, date, book, intel) : null;

  var plannedTotal = 0, missingTotal = loose.length, cards = [];
  blocks.forEach(function (x) {
    var b = x.id, sb = x.sb, chosen = x.chosen, planned = x.planned, waiting = x.waiting;
    if (x.inno) { plannedTotal += Object.keys(planned).length; cards.push(innovationCard_(staffId, date, b, sb, inno)); return; }
    var span = blockSpan_(staffId, b);
    var wrote = String(cell(b + '_Actioned') || '').trim();
    var at = cell(b + '_At');
    var atText = (at && Object.prototype.toString.call(at) === '[object Date]') ? hhmm_(at) : timeStr_(at);
    var early = atText && span && minutesOf_(atText) < span.start;
    var nPlanned = Object.keys(planned).length;
    plannedTotal += nPlanned;
    waiting.sort(function (a, c) { return String(a.due || '9999').localeCompare(String(c.due || '9999')); });
    missingTotal += waiting.length;

    var lines = '';
    lines += '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin-top:4px">Your work today: ' + esc_(sb.focus || '') + (sb.kpi ? ' (' + esc_(sb.kpi) + ')' : '') + '</div>';
    if (chosen || wrote || atText) {
      lines += '<div style="font-size:13px;margin-top:6px">You filed ' + (atText ? 'at ' + esc_(twelve_(atText)) : '') +
        (chosen ? ': <b>' + esc_(chosen) + '</b>' : '') + '. ' +
        (wrote ? 'You wrote: "' + esc_(shorten_(wrote, 160)) + '"' : '<span style="color:' + MAIL.red + '">Nothing written yet for what was done.</span>') + '</div>';
      if (early) lines += '<div style="font-size:12.5px;color:' + MAIL.amber + ';margin-top:4px">Filed before your day starts at ' + esc_(twelve_(mmText_(span.start))) + '. That is a plan, so make it a real one: pick the tasks.</div>';
    } else {
      lines += '<div style="font-size:13px;margin-top:6px;color:' + MAIL.muted + '">Not filed yet.</div>';
    }
    lines += '<div style="font-size:13px;margin-top:6px">' + (nPlanned
      ? '<b style="color:' + MAIL.green + '">' + nPlanned + ' Salesforce task' + (nPlanned === 1 ? '' : 's') + ' planned.</b>'
      : '<b style="color:' + MAIL.red + '">No Salesforce tasks planned for today.</b>') + '</div>';
    if (nPlanned && kind === 'plan') {
      Object.keys(planned).slice(0, DAYSTART_LIST_MAX).forEach(function (id) {
        lines += '<div style="font-size:12.5px;padding:3px 0;border-top:1px solid ' + MAIL.line + '">' + esc_(planned[id].subject || id) + '</div>';
      });
    }
    var sug = suggest[b] || [];
    if (sfOk && sug.length) {
      var brought = sug.filter(function (x) { return x.brought; }).length;
      lines += '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + MAIL.red + ';margin-top:9px">' +
        'Suggested for today: ' + sug.length + ' (' +
        (waiting.length ? (sug.length - brought) + ' of the ' + waiting.length + ' due or overdue for its work' + (brought ? ', ' : '') : '') +
        (brought ? brought + ' brought in from elsewhere' + (waiting.length ? '' : ': nothing is due for its own work') : '') + ')</div>';
      lines += suggestLines_(sug, date, kind === 'first' ? 3 : INTEL_SHOW);
    } else if (sfOk && waiting.length) {
      lines += '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + MAIL.red + ';margin-top:9px">' +
        'Salesforce has ' + waiting.length + ' due or overdue for your work, not in your plan</div>';
      waiting.slice(0, DAYSTART_LIST_MAX).forEach(function (t) { lines += dayStartTaskLine_(t, date); });
      if (waiting.length > DAYSTART_LIST_MAX) lines += '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:3px">and ' + (waiting.length - DAYSTART_LIST_MAX) + ' more in the planner.</div>';
    } else if (sfOk) {
      lines += '<div style="font-size:12.5px;color:' + MAIL.green + ';margin-top:6px">Nothing due or overdue in Salesforce for your work.</div>';
    }
    if (kind === 'first') lines += srcBlockLines_(staffId, date, b);
    cards.push('<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (waiting.length || sug.length || !nPlanned ? MAIL.amber : MAIL.green) +
      ';border-radius:10px;padding:13px 15px;margin-bottom:10px">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.gold + '">' + esc_(blockLabel_(b)) + (sb.time ? ' · ' + esc_(sb.time) : '') + '</div>' +
      lines + '</div>');
    if (x === blocks[blocks.length - 1] && sched.lunch) {
      cards.push('<div style="background:' + MAIL.paper + ';border:1px dashed ' + MAIL.gold + ';border-radius:10px;padding:10px 15px;margin-bottom:10px;font-size:13px">' +
        '<b>Lunch · ' + esc_(sched.lunch) + '</b>. If it is different today, post the time in the branch admin group before you go.</div>');
    }
  });


  // Plan by half an hour after the start, or after now if the day is under way.
  var startM = (parseSpan_(sched.hours || '') || { start: 480 }).start;
  var replanBy = twelve_(mmText_(Math.max(minutesOf_(hhmm_(new Date())), startM) + DAYSTART_REPLAN_MIN));
  var intro = kind === 'plan'
    ? 'Thank you, ' + esc_(first) + '. Your plan is in' + (signIn ? ' (signed in at ' + esc_(twelve_(signIn)) + ')' : '') + '. Below: whether it holds up against your record, the day as planned, and what Salesforce still has waiting.'
    : 'Good morning, ' + esc_(first) + (signIn
        ? ', and thank you for signing in at <b>' + esc_(twelve_(signIn)) + '</b>. '
        : '. Your day starts at <b>' + esc_(twelve_(mmText_(startM))) + '</b>. Review your plan below, then open the button and save it: saving signs you in, and that is the attendance register. ' +
          'In after ' + esc_(twelve_(mmText_(startM + ATT_GRACE_MIN))) + ' is late; no sign-in by <b>' + esc_(twelve_(mmText_(startM + ABSENT_AFTER_MIN))) + '</b> marks you absent and your due work goes to colleagues. ') +
      'Below is what your record shows over the last ' + INTEL_DAYS + ' working days, your day as you have filed it, and a plan for the day built from what Salesforce, Query Pal and the inbox have waiting.';

  var ask = kind === 'plan'
    ? (missingTotal
        ? 'There are still <b>' + missingTotal + '</b> due or overdue tasks not in your plan. Add them in the planner, or note in each why it waits.'
        : 'Everything due or overdue is in your plan. Your progress check comes before lunch; close the day off before you leave.')
    : (missingTotal || !plannedTotal
        ? 'Your plan is not complete. ' +
          (target ? 'Below is a suggested plan: <b>' + target + ' tasks</b> for today, high-payoff work first, then the oldest overdue' +
            (intel && intel.pace != null ? ', sized from your own record (' + intel.pace + ' closed a day over the last ' + intel.days + ' working days)' : '') + '. ' +
            'Review it with the button below: keep these, untick what you will not do with a reason, add your own, and save,' : 'Open the planner and pick the Salesforce tasks into your day') +
          (replanBy ? ' by <b>' + esc_(replanBy) + '</b>' : '') + '. Saving is your morning check: no check and the day reads as absent, and your work is shared out to whoever is in. ' +
          'A "Plan received" copy goes to Mr Rampersad and sales support when you do.'
        : 'Your plan covers what Salesforce has due. Your progress check comes before lunch; close the day off before you leave.');

  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + intro + '</div>' +
    (kind === 'first' ? backCard_(staffId, date) : '') +
    (kind === 'first' ? queryCard_(staffId) : '') +
    (kind === 'first' ? branchCards_(staffId, date) : '') +
    statTiles_([
      { value: signIn ? twelve_(signIn) : '—', label: signIn ? 'signed in' : 'not signed in' },
      { value: sfOk ? overdue : '—', label: 'overdue', color: overdue ? MAIL.red : MAIL.navy },
      { value: sfOk ? dueToday : '—', label: 'due today', color: dueToday ? MAIL.amber : MAIL.navy },
      { value: plannedTotal, label: 'tasks planned', color: plannedTotal ? MAIL.green : MAIL.red },
      { value: sfOk ? target : '—', label: 'suggested today', color: MAIL.navy }
    ]) +
    (check ? '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (check.ok ? MAIL.green : MAIL.red) + ';border-radius:10px;padding:10px 15px;margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:' + (check.ok ? MAIL.green : MAIL.red) + '">' +
          (check.ok ? 'Your plan holds up' : 'Your plan does not hold up yet') + '</div>' +
        check.lines.map(function (l) { return '<div style="font-size:13.5px;line-height:1.55;padding:5px 0;border-top:1px solid ' + MAIL.line + '"><span style="color:' + (l.bad ? MAIL.red : MAIL.green) + ';font-weight:800">' + (l.bad ? '&#9679;' : '&#10003;') + '</span> ' + l.html + '</div>'; }).join('') +
        (check.ok ? '' : replyButton_(replyUrl_(staffId, date, 'plan'), 'Fix my plan', 'Opens your plan with today\'s suggestion ticked. Change it and save; no sign-in.')) + '</div>' : '') +
    '<div style="background:#fff;border:1px solid ' + MAIL.gold + ';border-radius:10px;padding:12px 15px;font-size:14px;line-height:1.55;margin-bottom:6px">' + ask +
      (kind === 'first' && sfOk && target ? replyButton_(replyUrl_(staffId, date, 'plan'), 'Review and save this plan', 'One tap opens it ticked. Untick what you will not do, add your own, save. No sign-in.') : '') +
      '<div style="margin-top:9px"><a href="' + PLANNER_URL + '" style="font-size:12.5px;color:' + MAIL.navy + ';font-weight:700">or open the planner</a></div></div>' +
    (kind === 'first' ? '<div style="background:' + MAIL.paper + ';border:1px dashed ' + MAIL.gold + ';border-radius:10px;padding:11px 15px;margin:10px 0 4px;font-size:13.5px;line-height:1.55">' +
        '<b>First fifteen minutes: the scrub.</b> Go through your inbox and the branch WhatsApp. Anything from Mr Rampersad, a manager, an agent or a client that needs doing goes in the scrub box on your plan page, and becomes a Salesforce task in your name before you start. ' +
        '<b>High-payoff work goes first:</b> new business, then orphan adoption, then retention.</div>' : '') +
    (function () {
      if (kind !== 'first') return '';
      var first3 = [];
      blocks.forEach(function (x) { (suggest[x.id] || []).forEach(function (s) { if (first3.length < 3) first3.push({ s: s, b: x.id }); }); });
      if (!first3.length) return '';
      return '<div style="background:' + MAIL.navy + ';border-radius:10px;padding:13px 15px;margin:12px 0 4px;color:#fff">' +
        '<div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:' + MAIL.soft + '">Start here · ' + esc_(blockLabel_(first3[0].b)) + '</div>' +
        first3.map(function (x, i) {
          return '<div style="font-size:13.5px;line-height:1.45;padding:7px 0;' + (i ? 'border-top:1px solid rgba(255,255,255,.15);' : '') + '"><b style="color:' + MAIL.gold + '">' + (i + 1) + '.</b> ' +
            esc_(x.s.t.subject) + (payoffOf_(x.s.t).label ? ' <span style="color:' + MAIL.soft + ';font-size:11px;font-weight:800">· ' + esc_(payoffOf_(x.s.t).label.toUpperCase()) + '</span>' : '') +
            (x.s.t.late ? ' <span style="color:#F2B8B3;font-size:12px">· overdue since ' + esc_(shortDate_(x.s.t.due)) + '</span>' : '') + '</div>';
        }).join('') + '<div style="font-size:12px;color:' + MAIL.soft + ';margin-top:4px">Do the first one before anything else. Close it with your note.</div></div>';
    })() +
    (kind === 'first' && intel ? intelBox_([creditLine_(intel)].concat(intelLines_(intel).filter(function (l) { return l.bad; }).slice(0, 4)).concat([innovationLine_(inno, date, staffId)]).filter(Boolean), 'What the record shows · last ' + intel.days + ' working days') + periodTable_(intel) : '') +
    sectionLabel_('Your day · ' + (sched.hours || '') + (target ? ' · suggested plan of ' + target : '')) + cards.join('') +
    (function () {
      var rest = loose.filter(function (x) { return !suggested[x.t.id]; });
      if (!rest.length) return '';
      if (kind === 'first') return '<div style="font-size:13px;color:' + MAIL.muted + ';margin:6px 0 0">' + rest.length + ' more due or overdue are not in today\'s plan. They are on your plan page, under "Not in today\'s plan".</div>';
      return sectionLabel_('Due or overdue, not in today\'s plan (' + rest.length + ')') +
        '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.red + ';border-radius:10px;padding:11px 15px">' +
          rest.slice(0, kind === 'first' ? 5 : DAYSTART_LIST_MAX * 2).map(function (x) { return dayStartTaskLine_(x.t, date); }).join('') +
          (rest.length > (kind === 'first' ? 5 : DAYSTART_LIST_MAX * 2) ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:3px">and ' + (rest.length - (kind === 'first' ? 5 : DAYSTART_LIST_MAX * 2)) + ' more on your plan page.</div>' : '') +
        '</div>';
    })() +
    (sfOk ? '' : '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin-top:12px">Salesforce did not answer this morning, so the tasks are not listed. The planner shows them.</div>') +
    '<div style="font-size:12.5px;color:' + MAIL.muted + ';line-height:1.55;margin-top:16px">' +
      'Your day is built on your job description. Every morning the system reads Salesforce, Query Pal and the inbox and shares out the work; you plan the day and press the morning check, give your progress before lunch, and close the day off before you leave. Log every task at the point of work.</div>' +
    '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">' +
      'Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';

  var subject = kind === 'plan'
    ? 'Plan received · ' + name + ' · ' + shortDate_(date) + ' · ' + plannedTotal + ' planned' + (missingTotal ? ', ' + missingTotal + ' still to add' : '')
    : 'Your day · ' + name + ' · ' + shortDate_(date) + (signIn ? ' · in at ' + twelve_(signIn) : '') +
      ' · ' + plannedTotal + ' planned' + (sfOk ? ', ' + missingTotal + ' waiting, ' + target + ' suggested' : '');

  var mail = {
    to: to,
    subject: subject,
    htmlBody: shell_(kind === 'plan' ? 'Plan received' : 'Good morning · your day', name + ' · ' + prettyDate_(date), body)
  };
  var cc = dayStartCc_(to);
  if (cc.length) mail.cc = cc.join(',');
  MailApp.sendEmail(mail);
  return true;
}

/** From the editor: send today's day-start for one person to yourself only,
 *  to see it before anybody else does. Does not mark it sent. */
function previewDayStart(staffId) {
  staffId = staffId || 'elizabeth';
  var date = todayISO_();
  var props = PropertiesService.getScriptProperties();
  var key = 'daystart_first_' + staffId + '_' + date;
  var had = props.getProperty(key);
  var realEmailFor = emailFor_;
  var me = Session.getEffectiveUser().getEmail();
  props.deleteProperty(key);
  emailFor_ = function () { return me; };
  var realCc = dayStartCc_;
  dayStartCc_ = function () { return []; };
  try { sendDayStart_(staffId, date, 'first'); }
  finally {
    emailFor_ = realEmailFor; dayStartCc_ = realCc;
    if (had) props.setProperty(key, had); else props.deleteProperty(key);
  }
  return 'Preview of ' + staffId + "'s day start sent to " + me;
}

// ---------------------------------------------------------------------------
//  Housekeeping, half an hour before each person leaves
//
//  "Half an hour before they leave ... proper housekeeping rules daily. Have
//  you verified all the tasks that are checked and a percentage of the day
//  completed? Is it done? If it's not done, a reason why. Have the emails,
//  your inbox been scrubbed ... from the branch manager, WhatsApp, or clients
//  ... agents, or the managers that require an urgent response. And three,
//  are all the tasks understood? ... if no task open created today, verify
//  the inbox." (Ricky, 14 October 2026.)
//
//  Timed off each person's own finishing time in SCHEDULE, not a fixed 3:45,
//  so Liz hears at 2:30 and Azariah at 3:30. Run from keepWarm, which already
//  fires every ten minutes, so it costs no new trigger (the project is at the
//  twenty-trigger limit). Once a day per person, only for somebody signed in
//  and not marked absent. Copied to the Branch Manager and sales support.
//
//  The three questions are also lines on the tracker's close-out list
//  (Closeout Items, added once by ensureHousekeepingItems_), so the answers
//  and any "not done, because ..." are logged against the day.
// ---------------------------------------------------------------------------

var HK_LEAD_MIN = 30;          // minutes before the finishing time
var HK_WINDOW_MIN = 20;        // keepWarm runs every 10; a 20-minute window catches one run
var HK_ITEMS = [
  { ItemId: 'hk_tasks', Item: 'Tasks verified: every task touched today has my note, and anything planned and not done has a reason',
    Who: 'All', Auto: '', Order: 5, Active: 'Yes', Note: 'Housekeeping, 14 Oct 2026. Asked half an hour before the finishing time.' },
  { ItemId: 'hk_inbox', Item: 'Inbox and branch WhatsApp scrubbed: nothing urgent from the Branch Manager, a manager, an agent or a client left without a reply or a task',
    Who: 'All', Auto: '', Order: 6, Active: 'Yes', Note: 'Housekeeping, 14 Oct 2026.' },
  { ItemId: 'hk_understood', Item: 'Open tasks understood: I know what each task due tomorrow needs, and anything that came in by e-mail today is a task',
    Who: 'All', Auto: '', Order: 7, Active: 'Yes', Note: 'Housekeeping, 14 Oct 2026.' },
  { ItemId: 'hk_systems', Item: 'Branch systems closed off: Query Pal, the log book, the call list, group, claims and benefits sheets, every line in my name checked and updated',
    Who: 'All', Auto: '', Order: 8, Active: 'Yes', Note: 'Ricky, 16 Oct 2026: the Drive systems are to be closed off before leaving.' },
  { ItemId: 'hk_desk', Item: 'Desk and surroundings cleared: every document filed, logged or handed over; nothing left loose',
    Who: 'All', Auto: '', Order: 9, Active: 'Yes', Note: 'Ricky, 16 Oct 2026.' }
];


/* ───────────────────────────── The mailbag ─────────────────────────────
 *  Agents submit documents through the digital log book; staff verify and
 *  collect them (MAIL PREP and BU in the Log Book Digital workbook); one
 *  staff member a week routes the bag. The rota is weekly, Monday to Friday:
 *  Elizabeth, then Azariah, then Sasha, then round again, anchored on the
 *  week of 12 October 2026 (Ricky, 16 October 2026). Script Properties
 *  MAILBAG_ROTA (comma-separated staff ids) and MAILBAG_ANCHOR (a Monday)
 *  override. If the router is absent the next person in the rota who is in
 *  carries the bag that day.
 *
 *  Half an hour before leaving, the router sees the documents collected
 *  today by each staff member and the backlog not yet sent, and confirms the
 *  bag went; if not, a reason from the list. Everyone else confirms what they
 *  collected was handed to the router. Answers go to the close-out, the
 *  Mailbag Log tab, and the copy to the Branch Manager and sales support. */
var MAILBAG = {
  ROTA: ['elizabeth', 'azariah', 'sasha'], ANCHOR: '2026-10-12', BACKLOG_DAYS: 21,
  REASONS: ['No courier or mail run today', 'Documents still being verified', 'Waiting on an agent signature', 'Bag held for tomorrow with the Branch Manager\'s knowledge', 'Sent by another staff member', 'Out of office in the afternoon', 'Other (say below)']
};
var MAILLOG = { must: ['Date', 'Router', 'Sent'], name: 'Mailbag Log',
  head: ['Date', 'Router', 'By', 'CollectedToday', 'Backlog', 'Sent', 'Reason', 'Note', 'At', 'Source'] };
function mailbagRota_() {
  var props = PropertiesService.getScriptProperties();
  var rota = String(props.getProperty('MAILBAG_ROTA') || '').split(',').map(function (x) { return x.trim(); }).filter(String);
  return { rota: rota.length ? rota : MAILBAG.ROTA, anchor: props.getProperty('MAILBAG_ANCHOR') || MAILBAG.ANCHOR };
}
/** Who routes the bag on a day: the rota by week, skipping anyone absent that day. */
function mailbagRouter_(day, absent) {
  var r = mailbagRota_(), weeks = Math.floor(daysBetween_(r.anchor, day) / 7), i = ((weeks % r.rota.length) + r.rota.length) % r.rota.length;
  var sched = r.rota[i], who = sched;
  for (var k = 0; k < r.rota.length && absent && absent[who]; k++) who = r.rota[(i + k + 1) % r.rota.length];
  return { scheduled: sched, router: who, week: weeks + 1, next: r.rota[(i + 1) % r.rota.length] };
}
/** The day's log-book picture: collected today by staff, and the unsent backlog by staff. */
function mailbagToday_(day) {
  var out = { today: {}, backlog: {}, todayN: 0, backlogN: 0, oldest: null, byRouting: {} };
  var since = shiftDays_(day, -MAILBAG.BACKLOG_DAYS);
  var who = function (r) { var w = String(r['Support Staff Verified'] || r['Prepared By'] || r['Sent by Whom'] || '').replace(/^please select:?/i, '').trim(); return (w.split(/[\s,]+/)[0] || 'unassigned'); };
  var dayOf = function (v) { var m = String(v || '').match(/(\d{1,2})-(\d{1,2})-(\d{4})/); if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2); return sfkDay_(v); };
  [BOOKS.LOG.prep, BOOKS.LOG.bu].forEach(function (tab) {
    bookRows_('LOG', tab).forEach(function (r) {
      var d = dayOf(r['Submitted Date']); if (!d || d.length !== 10) return;
      var sent = String(r['Date Sent'] || '').trim(), w = who(r), routing = String(r['Routing'] || '').replace(/^routing:\s*/i, '').trim();
      if (d === day) { out.today[w] = (out.today[w] || 0) + 1; out.todayN++; if (routing) out.byRouting[routing] = (out.byRouting[routing] || 0) + 1; }
      if (!sent && d >= since && d <= day) { out.backlog[w] = (out.backlog[w] || 0) + 1; out.backlogN++; if (!out.oldest || d < out.oldest) out.oldest = d; }
    });
  });
  return out;
}
function mailbagLog_(row) {
  try { var sh = hrTab_(MAILLOG, true); sh.appendRow(headerOf_(sh).map(function (h) { return row[h] != null ? row[h] : ''; })); forgetHr_(MAILLOG); } catch (e) {}
}
/** The mailbag card for the before-you-leave e-mail. */
function mailbagCard_(sid, day) {
  var absent = {}; try { (hrRows_(ATT, true) || []).forEach(function (r) { if (isoDay_(r.Date) === day && String(r.Status || '').toLowerCase() === 'absent') absent[String(r.StaffId)] = 1; }); } catch (e) {}
  var rt = mailbagRouter_(day, absent), mb = mailbagToday_(day), me = String(nameFor_(sid)).split(' ')[0];
  var isRouter = rt.router === sid, mine = 0;
  Object.keys(mb.today).forEach(function (w) { if (w.toLowerCase() === me.toLowerCase()) mine += mb.today[w]; });
  var row = function (h) { return '<div style="font-size:13px;line-height:1.5;padding:4px 0;border-top:1px solid ' + MAIL.line + '">' + h + '</div>'; };
  var table = Object.keys(mb.today).sort().map(function (w) { return row('<b>' + esc_(w) + '</b> collected <b>' + mb.today[w] + '</b> today'); }).join('') || row('<span style="color:' + MAIL.muted + '">Nothing logged in the log book today.</span>');
  var backlog = mb.backlogN ? row('<b style="color:' + (mb.backlogN > 10 ? MAIL.red : MAIL.amber) + '">' + mb.backlogN + ' document' + (mb.backlogN === 1 ? '' : 's') + ' logged and not yet sent</b>' +
      (mb.oldest ? ', oldest ' + esc_(shortDate_(mb.oldest)) : '') + ' · ' + Object.keys(mb.backlog).sort().map(function (w) { return esc_(w) + ' ' + mb.backlog[w]; }).join(', ')) : row('Nothing waiting from earlier days.');
  var head = isRouter
    ? '<b>You route the mailbag this week</b> (week ' + rt.week + ' of the rota' + (rt.scheduled !== sid ? ', covering for ' + esc_(nameFor_(rt.scheduled).split(' ')[0]) : '') + '). Confirm on the page that today\'s bag went, or why not.'
    : '<b>' + esc_(nameFor_(rt.router).split(' ')[0]) + ' routes the mailbag this week.</b> You collected <b>' + mine + '</b> document' + (mine === 1 ? '' : 's') + ' today; confirm on the page they were handed over.';
  return { html: '<div style="font-size:13.5px;line-height:1.55;margin-top:6px">' + head + '</div>' + table + backlog +
      (Object.keys(mb.byRouting).length ? row('<span style="color:' + MAIL.muted + '">By routing today: ' + Object.keys(mb.byRouting).map(function (k) { return esc_(k) + ' ' + mb.byRouting[k]; }).join(' · ') + '</span>') : ''),
    ok: !isRouter, isRouter: isRouter, router: rt.router, mine: mine, data: mb };
}
/** The mailbag block on the close-out page: router confirms the bag went; everyone else the hand-over. */
function mailbagPageCard_(sid, day) {
  try {
    var m = mailbagCard_(sid, day), prev = ((progAnswers_(sid, day, 'leave') || {})._mailbag || {});
    var sel = '<select name="mbr" id="mbr" style="display:none;width:100%;padding:10px;border:1px solid #DCE3F4;border-radius:10px;font:inherit;margin-top:6px"><option value="">Why?</option>' +
      MAILBAG.REASONS.map(function (r) { return '<option value="' + esc_(r) + '"' + (prev.r && String(prev.r).indexOf(r) === 0 ? ' selected' : '') + '>' + esc_(r) + '</option>'; }).join('') + '</select>';
    var js = '<script>function mb(i){var s=document.getElementById("mbr");var no=/Not/.test(i.value);s.style.display=no?"block":"none";s.required=no}</script>';
    var rname = esc_(nameFor_(m.router).split(' ')[0]);
    if (m.isRouter) return '<div class="card" style="border-left:4px solid #0EA5C9"><div class="bh">The mailbag · you route it this week</div>' +
      '<div class="ln">' + m.data.todayN + ' collected today' + (m.data.backlogN ? ' · <b>' + m.data.backlogN + ' not yet sent</b>' : '') + '</div>' +
      '<div class="seg"><label><input type="radio" name="mb" value="Sent" required onchange="mb(this)"><span>Bag sent today</span></label>' +
      '<label><input type="radio" name="mb" value="Not sent" onchange="mb(this)"><span>Not sent</span></label></div>' + sel +
      '<input type="text" name="mbn" placeholder="Note: tracking number, courier, or what is still to go" style="margin-top:6px"></div>' + js;
    return '<div class="card"><div class="bh">The mailbag · ' + rname + ' routes it this week</div>' +
      '<div class="ln">You collected <b>' + m.mine + '</b> document' + (m.mine === 1 ? '' : 's') + ' today.</div>' +
      '<div class="seg"><label><input type="radio" name="mb" value="Handed over" required onchange="mb(this)"><span>All handed to ' + rname + '</span></label>' +
      '<label><input type="radio" name="mb" value="Not handed over" onchange="mb(this)"><span>Some still with me</span></label></div>' + sel +
      '<input type="text" name="mbn" placeholder="Note" style="margin-top:6px"></div>' + js;
  } catch (e) { return ''; }
}

function ensureHousekeepingItems_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('hk_items_v1')) return;
  var sh = closeoutSheet_();
  var have = {};
  (hrRows_(CLO, true) || []).forEach(function (r) { have[String(r.ItemId || '').trim()] = 1; });
  var head = headerOf_(sh);
  HK_ITEMS.forEach(function (it) {
    if (have[it.ItemId]) return;
    sh.appendRow(head.map(function (h) { return it[h] != null ? it[h] : ''; }));
  });
  forgetHr_(CLO);
  props.setProperty('hk_items_v1', '1');
}

/** "8am – 4:30pm" -> 990, minutes from midnight. */
function endFor_(staffId) {
  var sp = parseSpan_(scheduleFor_(staffId).hours || '');
  return sp ? sp.end : 16 * 60;
}

/** Called from keepWarm, every ten minutes. Cheap when there is nothing to do.
 *
 *  The day runs on the clock, not on anybody signing in (Ricky, 14 October
 *  2026: "they no longer log in, but we pull the intelligence and guide them
 *  via email"):
 *    5:00           the Branch Manager's day (sendBranchManagerDay_)
 *    6:00           the Unit Manager's unit (sendUnitManagerMorning_)
 *    start - 30     the morning e-mail, every desk (3 a run)
 *    12:00, 18:00   the Branch Manager's progress (sendBranchManagerProgress_)
 *    17:00          the Unit Manager's account of his day
 *    start + 60     no sign-in: absent, and the work covered (autoAbsentTick_, coverTick_)
 *    9:15           the attendance report
 *    10:00          the workload balance (rebalanceTick_)
 *    before lunch   the progress check
 *    30 min to go   before you leave
 *  Anybody marked absent is skipped. A person who has not signed in still
 *  gets the progress check and before-you-leave once their morning e-mail
 *  has gone, because signing in now happens from the e-mail itself. */

/** A timed send that may fail: mark it done only when it went. A failure is
 *  logged under Script Property FAIL_<key> and retried on later runs, up to
 *  three times, so a cold start or a slow Salesforce answer does not cost the
 *  day's e-mail. runlog_ keeps the last 40 outcomes under RUNLOG for showRunLog. */
function timedSend_(props, key, now, fn) {
  var fk = 'FAIL_' + key, tries = Number(props.getProperty(fk) || 0);
  if (tries >= 3) return false;
  try {
    var ok = fn();
    props.setProperty(key, hhmm_(now));
    if (tries) props.deleteProperty(fk);
    runlog_(key + ' sent ' + hhmm_(now) + (ok === false ? ' (nothing to send)' : ''));
    return true;
  } catch (e) {
    props.setProperty(fk, String(tries + 1));
    runlog_(key + ' FAILED ' + hhmm_(now) + ' try ' + (tries + 1) + ': ' + (e && e.message));
    return false;
  }
}
function runlog_(line) {
  try { var props = PropertiesService.getScriptProperties(), cur = String(props.getProperty('RUNLOG') || '').split('\n').filter(String); cur.push(todayISO_() + ' ' + line); props.setProperty('RUNLOG', cur.slice(-40).join('\n')); } catch (e) {}
}
/** Run from the editor: the last 40 timed sends and failures, with reasons. */
function showRunLog() { Logger.log(PropertiesService.getScriptProperties().getProperty('RUNLOG') || 'No timed sends recorded yet.'); }

function housekeepingTick_() {
  var now = new Date();
  var dow = Number(Utilities.formatDate(now, CONFIG.TZ, 'u'));   // 1 Mon .. 7 Sun
  if (dow > 5) return '';
  var mins = minutesOf_(hhmm_(now));
  if (mins < MORNING_MAIL_AT || mins > 19 * 60) return '';
  var day = todayISO_(), props = PropertiesService.getScriptProperties(), sent = [];
  var present = {}, absent = {};
  try {
    (hrRows_(ATT, true) || []).forEach(function (r) {
      if (isoDay_(r.Date) !== day) return;
      if (String(r.Status || 'in').toLowerCase() === 'absent') { absent[String(r.StaffId)] = 1; return; }
      if (timeStr_(r.FirstSignIn)) present[String(r.StaffId)] = timeStr_(r.FirstSignIn);
    });
  } catch (e) { return ''; }
  var people = publicRoster_().filter(function (p) {
    var sid = String(p.staffId);
    return SCHEDULE[sid] && DAY_MAIL_DESKS.indexOf(sid) > -1 && !absent[sid];
  });
  var expected = function (sid) { return present[sid] || props.getProperty('daystart_first_' + sid + '_' + day); };

  // The morning e-mail, half an hour before each desk's start (Ricky, 15
  // October 2026: "all will receive the email 30 minutes before they get in
  // and they are to review; if a staff does not open and save, it is assumed
  // they are absent"). Three a run; a desk the runs missed still gets it up to
  // twenty minutes after its start.
  var morningSent = 0;
  people.forEach(function (p) {
    var sid = String(p.staffId), sp = parseSpan_(scheduleFor_(sid).hours || '');
    if (!sp || mins < sp.start - STAFF_MAIL_LEAD || mins > sp.start + 20 || morningSent >= MORNING_MAIL_PER_RUN) return;
    if (props.getProperty('daystart_first_' + sid + '_' + day)) return;
    try { if (sendDayStart_(sid, day, 'first')) { sent.push(p.name + ' (morning)'); morningSent++; } } catch (e) {}
  });

  // 5:00, the Branch Manager's own day; 11:00 his progress; 15:00 he closes out the day.
  if (mins >= BM_MAIL_AT && mins <= 11 * 60 && !morningSent && !props.getProperty('bmday_' + day)) {
    if (timedSend_(props, 'bmday_' + day, now, function () { return sendBranchManagerDay_(day); })) sent.push('Branch Manager');
  }
  BM_PROGRESS_AT.forEach(function (at) {
    var key = 'bmprog_' + at + '_' + day;
    if (mins < at || mins > at + HK_WINDOW_MIN || props.getProperty(key)) return;
    if (timedSend_(props, key, now, function () { return sendBranchManagerProgress_(day, at >= 15 * 60 ? 'eve' : 'mid'); })) sent.push('Branch Manager progress');
  });

  // The Unit Managers: 5:30 their unit, 11:00 their progress, 17:30 the account of their day.
  UM_DESKS.forEach(function (sid) {
    if (absent[sid]) return;
    if (mins >= UM_PROGRESS_AT && mins <= UM_PROGRESS_AT + HK_WINDOW_MIN && !props.getProperty('um_md_' + sid + '_' + day)) {
      props.setProperty('um_md_' + sid + '_' + day, hhmm_(now));
      try { if (sendUnitManagerProgress_(sid, day)) sent.push(nameFor_(sid) + ' (progress)'); } catch (e) {}
    }
    if (mins >= UM_MORNING_AT && mins <= 10 * 60 && !props.getProperty('um_am_' + sid + '_' + day)) {
      props.setProperty('um_am_' + sid + '_' + day, hhmm_(now));
      try { if (sendUnitManagerMorning_(sid, day)) sent.push(nameFor_(sid) + ' (unit)'); } catch (e) {}
    }
    if (mins >= UM_EVENING_AT && mins <= UM_EVENING_AT + HK_WINDOW_MIN && !props.getProperty('um_pm_' + sid + '_' + day)) {
      props.setProperty('um_pm_' + sid + '_' + day, hhmm_(now));
      try { if (sendUnitManagerEvening_(sid, day)) sent.push(nameFor_(sid) + ' (account)'); } catch (e) {}
    }
  });

  // The agents: 7:00 their day, 17:00 the close-off, eight a run, never in a
  // run that is already carrying staff morning mail.
  if (!morningSent) { try { agentTick_(day, mins).forEach(function (s) { sent.push(s); }); } catch (e) {} }
  // The fact-find chase: Monday ask, Wednesday reminder, Friday the week.
  if (!morningSent) { try { ffChaseTick_(day, mins).forEach(function (s) { sent.push(s); }); } catch (e) {} }

  // The register: an hour after the start with no sign-in is absent, and an
  // absent desk's untouched work is covered by whoever is in.
  try { autoAbsentTick_(day, mins, present, absent).forEach(function (s) { sent.push(nameFor_(s) + ' marked absent'); }); } catch (e) {}
  try { coverTick_(day, mins, present, absent).forEach(function (s) { sent.push(s); }); } catch (e) {}

  // 9:15, the attendance report.
  if (mins >= ATT_REPORT_AT && mins <= ATT_REPORT_AT + HK_WINDOW_MIN && !props.getProperty('attrep_' + day)) {
    props.setProperty('attrep_' + day, hhmm_(now));
    try { if (sendAttendanceReport_(day)) sent.push('attendance report'); } catch (e) {}
  }

  // Friday 7:30, before the branch meeting: the innovation board.
  if (dow === 5 && mins >= 7 * 60 + 30 && mins <= 7 * 60 + 30 + HK_WINDOW_MIN && !props.getProperty('innoboard_' + day)) {
    props.setProperty('innoboard_' + day, hhmm_(now));
    try { if (sendInnovationBoard_(day)) sent.push('innovation board'); } catch (e) {}
  }
  // 9:15, the BMA's team board.
  if (mins >= 9 * 60 + 15 && mins <= 9 * 60 + 15 + HK_WINDOW_MIN && !props.getProperty('teamboard_' + day)) {
    props.setProperty('teamboard_' + day, hhmm_(now));
    try { if (sendTeamBoard_(day)) sent.push('team board'); } catch (e) {}
  }

  // The workload balance, once, at ten (moved off 8:30, 15 October 2026:
  // that was the minute everybody opened their plan, and pages timed out).
  if (mins >= REBALANCE_AT && mins <= REBALANCE_AT + HK_WINDOW_MIN) {
    try { var rb = rebalanceTick_(day, present, absent); if (rb) sent.push(rb); } catch (e) {}
  }

  // The progress check, half an hour before each person's lunch.
  people.forEach(function (p) {
    var sid = String(p.staffId);
    if (!expected(sid)) return;
    var at = middayAt_(sid);
    if (mins < at || mins > at + HK_WINDOW_MIN) return;
    var key = 'md_' + sid + '_' + day;
    if (props.getProperty(key)) return;
    if (timedSend_(props, key, now, function () { if (sid === 'pawan') sendPawanDay_(day, 'midday'); else sendMidday_(p, day, present[sid] || ''); })) sent.push(p.name + ' (progress)');
  });

  // Before you leave, half an hour before each person's finish.
  people.forEach(function (p) {
    var sid = String(p.staffId);
    if (!expected(sid)) return;
    var at = endFor_(sid) - HK_LEAD_MIN;
    if (mins < at || mins > at + HK_WINDOW_MIN) return;
    var key = 'hkv2_' + sid + '_' + day;   // the official close-out (16 Oct); an earlier version's send does not stop it
    if (props.getProperty(key)) return;
    if (timedSend_(props, key, now, function () { if (sid === 'pawan') sendPawanDay_(day, 'leave'); else sendHousekeeping_(p, day, present[sid] || ''); })) sent.push(p.name);
  });
  // At the finish, half an hour after the notice: signed out by the tracker.
  people.forEach(function (p) {
    var sid = String(p.staffId), endM = endFor_(sid);
    if (!present[sid] || mins < endM || mins > endM + 60 || props.getProperty('autoout_' + sid + '_' + day)) return;
    try { if (autoSignOut_(sid, day, endM)) sent.push(p.name + ' (signed out at finish)'); props.setProperty('autoout_' + sid + '_' + day, hhmm_(now)); } catch (e) {}
  });
  // The BMA's 4pm report.
  if (mins >= BMA_REPORT_AT && mins <= BMA_REPORT_AT + HK_WINDOW_MIN && !props.getProperty('bmarep_' + day)) {
    if (timedSend_(props, 'bmarep_' + day, now, function () { sendBmaReport_(day); })) sent.push('BMA 4pm report');
  }
  return sent.length ? 'Day mail sent: ' + sent.join(', ') : '';
}

/** Run from the editor on the morning the new code goes in, or any morning
 *  the e-mail was missed: sends today's morning e-mail now to every desk whose
 *  day has started and who has not had it. Safe to run twice; nobody gets two. */
/** Run from the editor when the before-you-leave mail was missed: sends it now
 *  to every desk that is past (finish − 30) today, signed in, not absent, and
 *  has not had it. Safe to run twice; nobody gets two. */
/** Run by hand: every close-out and every manager report, now, whatever the time.
 *  Each staff close-out is marked sent, so the ten-minute run does not send it again. */
function sendEverythingNow() {
  var day = todayISO_(), props = PropertiesService.getScriptProperties(), now = new Date(), out = [], present = {};
  try { (hrRows_(ATT, true) || []).forEach(function (r) {
    if (isoDay_(r.Date) !== day || String(r.Status || 'in').toLowerCase() === 'absent') return;
    if (timeStr_(r.FirstSignIn)) present[String(r.StaffId)] = timeStr_(r.FirstSignIn); }); } catch (e) {}
  publicRoster_().forEach(function (p) {
    var sid = String(p.staffId);
    if (DAY_MAIL_DESKS.indexOf(sid) < 0) return;
    if (!present[sid]) { out.push(nameFor_(sid) + ': not signed in today, nothing sent'); return; }
    var key = 'hkv2_' + sid + '_' + day;
    if (props.getProperty(key)) { out.push(nameFor_(sid) + ': close-out already sent at ' + props.getProperty(key)); return; }
    try { if (sid === 'pawan') sendPawanDay_(day, 'leave'); else sendHousekeeping_(p, day, present[sid]);
      props.setProperty(key, hhmm_(now)); out.push(nameFor_(sid) + ': close-out sent'); }
    catch (e) { out.push(nameFor_(sid) + ': FAILED ' + (e && e.message)); }
  });
  try { sendBranchManagerProgress_(day, 'eve'); out.push('Branch Manager report: sent'); } catch (e) { out.push('Branch Manager report: FAILED ' + (e && e.message)); }
  try { UM_DESKS.forEach(function (s) { out.push(nameFor_(s) + ' unit report: ' + (sendUnitManagerEvening_(s, day) ? 'sent' : 'not sent')); }); } catch (e) { out.push('Unit Manager report: FAILED ' + (e && e.message)); }
  try { sendBmaReport_(day); props.setProperty('bmarep_' + day, hhmm_(now)); out.push('Kamla branch report: sent'); } catch (e) { out.push('Kamla branch report: FAILED ' + (e && e.message)); }
  Logger.log(out.join('\n'));
  return out.join('\n');
}

function sendHousekeepingNow() {
  var day = todayISO_(), props = PropertiesService.getScriptProperties(), out = [];
  var now = new Date(), mins = minutesOf_(hhmm_(now));
  var present = {}, absent = {};
  try { (hrRows_(ATT, true) || []).forEach(function (r) { if (isoDay_(r.Date) !== day) return;
    if (String(r.Status || 'in').toLowerCase() === 'absent') { absent[String(r.StaffId)] = 1; return; }
    if (timeStr_(r.FirstSignIn)) present[String(r.StaffId)] = timeStr_(r.FirstSignIn); }); } catch (e) {}
  publicRoster_().forEach(function (p) {
    var sid = String(p.staffId);
    if (!SCHEDULE[sid] || DAY_MAIL_DESKS.indexOf(sid) < 0 || absent[sid]) return;
    if (!(present[sid] || props.getProperty('daystart_first_' + sid + '_' + day))) { out.push(sid + ': not signed in, no morning mail'); return; }
    if (mins < endFor_(sid) - HK_LEAD_MIN) { out.push(sid + ': not yet (' + twelve_(mmText_(endFor_(sid) - HK_LEAD_MIN)) + ')'); return; }
    var key = 'hkv2_' + sid + '_' + day;   // the official close-out (16 Oct); an earlier version's send does not stop it
    if (props.getProperty(key)) { out.push(sid + ': already sent ' + props.getProperty(key)); return; }
    try { if (sid === 'pawan') sendPawanDay_(day, 'leave'); else sendHousekeeping_(p, day, present[sid] || ''); props.setProperty(key, hhmm_(now)); out.push(sid + ': sent'); }
    catch (e) { out.push(sid + ' FAILED: ' + (e && e.message)); }
  });
  Logger.log(out.join('\n')); return out.join('\n');
}

function sendMorningNow() {
  var day = todayISO_(), props = PropertiesService.getScriptProperties(), out = [];
  var nowM = minutesOf_(hhmm_(new Date()));
  var absent = {};
  try { (hrRows_(ATT, true) || []).forEach(function (r) { if (isoDay_(r.Date) === day && String(r.Status || '').toLowerCase() === 'absent') absent[String(r.StaffId)] = 1; }); } catch (e) {}
  DAY_MAIL_DESKS.forEach(function (sid) {
    if (absent[sid] || props.getProperty('daystart_first_' + sid + '_' + day)) return;
    var sp = parseSpan_(scheduleFor_(sid).hours || '');
    if (sp && nowM < sp.start - 10) return;          // their day has not started; the clock will send it
    try { if (sendDayStart_(sid, day, 'first')) out.push(sid); } catch (e) { out.push(sid + ' FAILED: ' + (e && e.message)); }
  });
  var msg = out.length ? 'Morning e-mail sent: ' + out.join(', ') : 'Nothing to send: everyone due has had it.';
  Logger.log(msg);
  return msg;
}

// ---------------------------------------------------------------------------
//  The attendance register on the clock, cover for an absent desk, and the
//  Branch Manager's own day
//
//  Ricky, 15 October 2026: "when they sign in ... it logs them, and if they
//  are not in it logs them as absent, so it produces an attendance report,
//  who is late and who is out ... this will be our attendance register. If a
//  person is absent, then the second email will generate." And: "include me
//  as well, as I am the Branch Manager ... tasks assigned to me, or items that
//  I need to chatter on."
//
//    5:00am         the Branch Manager's day: the team, his own tasks, what
//                   is waiting on his Chatter, his instructions not actioned
//    start - 30     each desk's morning e-mail (three a run). Opening it and
//                   saving the plan signs the desk in
//    start          signing in is the register. In within ten minutes of the
//                   start is on time; after that is late, by the minute
//    start + 60     nobody signed in and nobody marked them out: absent,
//                   automatically. Their untouched due and overdue work goes
//                   to whoever is in, each task with a Chatter note; the people
//                   covering get a "Covering for" e-mail, the Branch Manager
//                   the list with Undo. Tasks they keep that carry no note of
//                   theirs get an ACTION REQUIRED post, and the morning they
//                   are back their e-mail opens with what they owe
//    9:15am         the attendance report: in, late, out, and the month so far
//    10:00am        the workload balance, moved off 8:30, when everybody was
//                   opening their plan at once
//
//  Signing in late after the automatic absence turns the day back to "in",
//  late by the minute. What was covered stays covered; the Branch Manager's
//  Undo sends it back.
//  Script Property AUTO_ABSENT = off stops the automatic absence and the cover.
// ---------------------------------------------------------------------------

var MORNING_MAIL_AT = 5 * 60;          // the day's first run: 5:00am
var STAFF_MAIL_LEAD = 30;              // a desk's morning e-mail, half an hour before its start
var MORNING_MAIL_PER_RUN = 3;
var BM_MAIL_AT = 5 * 60;               // 5:00am, the Branch Manager's operations review
var ABSENT_AFTER_MIN = 60;             // no sign-in by start + 60 is absent
var ATT_REPORT_AT = 9 * 60 + 15;       // after the eight o'clock desks' hour has run
var REBALANCE_AT = 10 * 60;
var BM_SF_DEFAULT = '005A0000001NfJGIA0';   // the Branch Manager's Salesforce user
var COVER = {
  POOL: ['sasha', 'azariah', 'elizabeth', 'kamla'],   // whose work is covered
  RECEIVERS: ['sasha', 'elizabeth', 'azariah', 'kamla'],
  MONEY: ['Renewa/PDl/Bill', 'Claims/ Mat'],          // to the BMA first: money and claims
  KAMLA_ONLY_MONEY: true,                              // the BMA takes money work only
  PER_RECEIVER: 20, PER_DAY: 40, ASK_MAX: 25
};

var AUTO_ABSENT_FROM = '2026-10-16';   // the staff are told on the 15th; the clock marks from the 16th

/** Off with Script Property AUTO_ABSENT = off; not before AUTO_ABSENT_FROM
 *  (Script Property of the same name wins), so nobody is marked absent by a
 *  rule they were not told about. */
function autoAbsentOn_(day) {
  var props = PropertiesService.getScriptProperties();
  if (String(props.getProperty('AUTO_ABSENT') || '').toLowerCase() === 'off') return false;
  return String(day || todayISO_()) >= String(props.getProperty('AUTO_ABSENT_FROM') || AUTO_ABSENT_FROM);
}

/** Next working day after `day`. */
function nextWorkday_(day) {
  var d = day;
  do { d = shiftDays_(d, 1); } while ([0, 6].indexOf(new Date(d + 'T12:00:00Z').getUTCDay()) > -1);
  return d;
}

/** The register row, written by the tracker itself. */
function writeAutoAbsent_(sid, day, startM) {
  var sh = attSheet_(), rows = sheetObjects_(sh), now = new Date();
  var found = attRow_(rows, day, sid);
  if (found && timeStr_(found.row.FirstSignIn)) return false;          // in after all
  if (found && String(found.row.Status || '').toLowerCase() === 'absent') return false;
  var patch = { Status: 'absent', Reason: 'No sign-in by ' + twelve_(mmText_(startM + ABSENT_AFTER_MIN)) + ' (automatic)',
                MarkedBy: 'tracker', UpdatedAt: now };
  if (found) writeRow_(sh, found.at, colMap_(sh), patch);
  else {
    var o = Object.assign({ Date: day, StaffId: sid, Name: nameFor_(sid), FirstSignIn: '', LastSeen: '', SignedOut: '' }, patch);
    sh.appendRow(headerOf_(sh).map(function (h) { return o[h] != null ? o[h] : ''; }));
  }
  forgetHr_(ATT);
  try { CacheService.getScriptCache().remove('att_' + sid + '_' + day); } catch (e) {}
  return true;
}

/** Start + 60 and no sign-in: absent. Returns the desks marked this run. */
function autoAbsentTick_(day, mins, present, absent) {
  if (!autoAbsentOn_(day)) return [];
  var props = PropertiesService.getScriptProperties(), out = [];
  DAY_MAIL_DESKS.forEach(function (sid) {
    if (present[sid] || absent[sid]) return;
    var sp = parseSpan_(scheduleFor_(sid).hours || '');
    if (!sp || mins < sp.start + ABSENT_AFTER_MIN) return;
    var key = 'autoabs_' + sid + '_' + day;
    if (props.getProperty(key)) return;
    props.setProperty(key, hhmm_(new Date()));
    try { if (writeAutoAbsent_(sid, day, sp.start)) { absent[sid] = 1; out.push(sid); } } catch (e) {}
  });
  return out;
}

/** Of these task ids, the ones the owner has written a note on. */
function ownerNoted_(ids, ownerSfId) {
  var noted = {};
  for (var i = 0; i < ids.length; i += 150) {
    var chunk = ids.slice(i, i + 150);
    try {
      sfkQuery_("SELECT ParentId FROM FeedItem WHERE Type = 'TextPost' AND CreatedById = '" + ownerSfId +
        "' AND ParentId IN (" + chunk.map(function (x) { return "'" + x + "'"; }).join(',') + ') LIMIT 2000')
        .forEach(function (r) { noted[r.ParentId] = 1; });
    } catch (e) {}
  }
  return noted;
}

/** Who takes what from an absent desk. Reads only. */
function coverPlan_(day, sid, present, absent) {
  var users = sfkUsers_() || {}, me = users[sid];
  if (!me) return null;
  var book = (sfkOpenBook_(day) || {})[sid] || {}, all = [];
  Object.keys(book).forEach(function (ty) { book[ty].forEach(function (t) { t.ty = ty; all.push(t); }); });
  var tomorrow = nextWorkday_(day);
  var due = all.filter(function (t) { return t.late || t.due === day; });
  var next = all.filter(function (t) { return t.due === tomorrow; });
  var noted = ownerNoted_(due.concat(next).map(function (t) { return t.id; }), me.id);

  var name = nameFor_(sid), first = String(name).split(' ')[0];
  var recv = COVER.RECEIVERS.filter(function (r) {
    return r !== sid && users[r] && present[r] && !absent[r];
  }).map(function (r) { return { sid: r, name: nameFor_(r), got: 0 }; });

  var moves = [], kept = [];
  due.filter(function (t) { return !noted[t.id]; }).sort(intelOrder_).forEach(function (t) {
    if (moves.length >= COVER.PER_DAY) { kept.push(t); return; }
    var money = COVER.MONEY.indexOf(t.ty) > -1;
    var pool = recv.filter(function (r) {
      if (r.got >= COVER.PER_RECEIVER) return false;
      if (r.sid === 'kamla' && COVER.KAMLA_ONLY_MONEY && !money) return false;
      return true;
    });
    if (money && pool.some(function (r) { return r.sid === 'kamla'; })) pool = pool.filter(function (r) { return r.sid === 'kamla'; });
    pool.sort(function (a, b) { return a.got - b.got; });
    var r = pool[0];
    if (!r) { kept.push(t); return; }
    r.got++;
    moves.push({ t: t, from: sid, to: r.sid, fromName: name, toName: r.name,
      why: first + ' is absent today and this was ' + (t.late ? 'overdue' : 'due today') + ' with no note from ' + first,
      note: 'MOVED ' + shortDate_(day) + '. ' + name + ' is absent today. This task is now with ' + r.name + '.\n\n' +
        (t.late ? 'Overdue since ' + shortDate_(t.due) : 'Due today') + ', with no written note from ' + first + ' on it.\n\n' +
        String(r.name).split(' ')[0] + ': work it today. Note what was done in the client\'s words, then close it or set the next step.\n' +
        first + ': when you return, post here anything you did on this that is not recorded.' });
  });
  var ask = next.filter(function (t) { return !noted[t.id]; }).slice(0, COVER.ASK_MAX);
  return { sid: sid, name: name, first: first, moves: moves, kept: kept, ask: ask,
           noted: due.filter(function (t) { return noted[t.id]; }).length, receivers: recv };
}

/** Cover every absent desk once, from its start time. */
function coverTick_(day, mins, present, absent) {
  if (!autoAbsentOn_(day) || !sfkConfigured_()) return [];
  var props = PropertiesService.getScriptProperties(), out = [];
  COVER.POOL.forEach(function (sid) {
    if (!absent[sid]) return;
    var sp = parseSpan_(scheduleFor_(sid).hours || '');
    if (!sp || mins < sp.start) return;
    var key = 'cover_' + sid + '_' + day;
    if (props.getProperty(key)) return;
    props.setProperty(key, hhmm_(new Date()));
    try {
      var plan = coverPlan_(day, sid, present, absent);
      if (!plan) return;
      var done = plan.moves.length ? rebalanceApply_(day, plan.moves) : [];
      var asked = [];
      plan.ask.forEach(function (t) {
        try {
          sfkInsert_('FeedItem', { ParentId: t.id, Body: 'ACTION REQUIRED · ' + plan.name + '. Posted ' + shortDate_(day) + '.\n\n' +
            'This task is due ' + prettyDate_(t.due) + ' and carries no written note from you. A status alone does not tell the branch what was done.\n\n' +
            'Before 10am on your return, post where it stands: who, when, how and what, in the client\'s words. Then close it or set the next step.' });
          asked.push(t);
        } catch (e) {}
      });
      props.setProperty('cover_back_' + sid, JSON.stringify({
        day: day, moved: done.filter(function (m) { return m.ok; }).length,
        owe: asked.map(function (t) { return { id: t.id, s: shorten_(t.subject, 90), due: t.due }; }).slice(0, 25)
      }).slice(0, 8900));
      try { coverMail_(day, plan, done, asked); } catch (e) {}
      out.push(plan.first + ' covered (' + done.filter(function (m) { return m.ok; }).length + ' moved)');
    } catch (e) { out.push(sid + ' cover FAILED: ' + (e && e.message)); }
  });
  return out;
}

function coverMail_(day, plan, done, asked) {
  var ok = done.filter(function (m) { return m.ok; });
  var sign = '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">' +
    'Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';
  var by = {};
  ok.forEach(function (m) { (by[m.to] = by[m.to] || []).push(m); });
  Object.keys(by).forEach(function (sid) {
    var to = emailFor_(sid);
    if (!to) return;
    var first = String(nameFor_(sid)).split(' ')[0];
    MailApp.sendEmail({ to: to, cc: dayStartCc_(to, sid).join(',') || undefined,
      subject: 'Covering for ' + plan.first + ' today · ' + by[sid].length + ' task' + (by[sid].length === 1 ? '' : 's') + ' · ' + shortDate_(day),
      htmlBody: shell_('Covering for ' + plan.first + ' today', nameFor_(sid) + ' · ' + prettyDate_(day),
        '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">' + esc_(first) + ', ' + esc_(plan.name) + ' is absent today. ' +
          'These were due or overdue with nothing written on them, so the client is waiting. They are in your name in Salesforce now, each with a note. ' +
          'Work them today, high-payoff first, and note every call in the client\'s words before you close it.</div>' +
        moveLines_(by[sid], day) + replyButton_(replyUrl_(sid, day, 'plan'), 'Add them to my plan', 'They are at the top of your plan page, under "Not in today\'s plan".') + sign) });
  });
  var absentTo = emailFor_(plan.sid);
  if (absentTo) {
    MailApp.sendEmail({ to: absentTo, cc: dayStartCc_(absentTo, plan.sid).join(',') || undefined,
      subject: 'While you are out · ' + ok.length + ' covered, ' + asked.length + ' need your note · ' + shortDate_(day),
      htmlBody: shell_('While you are out', plan.name + ' · ' + prettyDate_(day),
        '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">' + esc_(plan.first) + ', you are marked absent today. ' +
          ok.length + ' of your due and overdue tasks had nothing written on them and have gone to colleagues so no client waits. ' +
          (asked.length ? asked.length + ' due on your return carry no note from you; each now has an ACTION REQUIRED post. Answer them before 10am the day you are back. ' : '') +
          'If you are in after all, sign in now: the register will show you as late, not absent.</div>' +
        (ok.length ? sectionLabel_('Covered by colleagues') + moveLines_(ok, day) : '') +
        (asked.length ? sectionLabel_('Waiting for your note') + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.red + ';border-radius:10px;padding:11px 15px">' +
          asked.map(function (t) { return dayStartTaskLine_(t, day); }).join('') + '</div>' : '') + sign) });
  }
  var mgr = managerEmails_();
  if (!mgr.length) return;
  var kam = emailFor_('kamla');
  var cc = [DAYSTART_CC_DEFAULT].concat(kam && plan.sid !== 'kamla' ? [kam] : []);
  var counts = Object.keys(by).map(function (s) { return String(nameFor_(s)).split(' ')[0] + ' ' + by[s].length; }).join(', ');
  MailApp.sendEmail({ to: mgr.join(','), cc: cc.join(','),
    subject: plan.first + ' absent · ' + ok.length + ' covered' + (counts ? ' (' + counts + ')' : '') + ' · ' + shortDate_(day),
    htmlBody: shell_(plan.name + ' is absent today', prettyDate_(day) + ' · ' + hhmm_(new Date()),
      statTiles_([
        { value: ok.length, label: 'moved to cover', color: MAIL.navy },
        { value: plan.noted, label: 'kept: has her note', color: MAIL.green },
        { value: plan.kept.length, label: 'kept: no one free', color: plan.kept.length ? MAIL.red : MAIL.navy },
        { value: asked.length, label: 'due next: note asked', color: asked.length ? MAIL.amber : MAIL.navy }
      ]) +
      '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">Due and overdue work with no note from ' + esc_(plan.first) +
        ' went to whoever is in, money and claims to the BMA first. Work she has written on stays with her. Every move has a Chatter note.</div>' +
      moveLines_(done, day) +
      replyButton_(replyUrl_('ricky', day, 'undo'), 'Undo any of these', 'Tick what should go back. Script Property AUTO_ABSENT = off stops the automatic absence and cover.')) });
}

/** The morning a desk is back: what was covered, and what she owes. Once. */

/** Query Pal queries still open and assigned to this desk: a card for the morning e-mail. */
function queryCard_(sid) {
  var me = nameFor_(sid), list = [];
  try { list = openQueries_().filter(function (x) { return bkNk_(x.assigned) === bkNk_(me) || (bkNk_(x.assigned).split(' ')[0] === bkNk_(me).split(' ')[0] && bkNk_(x.assigned).split(' ')[0]); }); } catch (e) { return ''; }
  if (!list.length) return '';
  return sectionLabel_('Client queries open in Query Pal · assigned to you (' + list.length + ')') +
    '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.amber + ';border-radius:10px;padding:8px 15px;margin-bottom:14px">' +
    list.slice(0, 8).map(function (x) {
      return '<div style="font-size:12.5px;line-height:1.45;padding:5px 0;border-top:1px solid ' + MAIL.line + '"><b>' + esc_(x.ref) + '</b> · ' + esc_(shorten_(x.subject || x.type, 70)) +
        (x.agent ? ' · agent ' + esc_(x.agent.split(' ')[0]) : '') + ' · <span style="color:' + (x.days > 3 ? MAIL.red : MAIL.muted) + ';font-weight:700">' + x.days + ' days open</span>' +
        (x.days > 3 ? ' · past the 3-day turnaround: close it or note why on the trail today' : '') + '</div>'; }).join('') +
    (list.length > 8 ? '<div style="font-size:12px;color:' + MAIL.muted + '">and ' + (list.length - 8) + ' more in Query Pal.</div>' : '') + '</div>';
}

function backCard_(sid, day) {
  var props = PropertiesService.getScriptProperties(), raw = props.getProperty('cover_back_' + sid);
  if (!raw) return '';
  var b = null;
  try { b = JSON.parse(raw); } catch (e) { props.deleteProperty('cover_back_' + sid); return ''; }
  if (!b || !b.day || b.day >= day) return '';
  props.deleteProperty('cover_back_' + sid);
  var owe = b.owe || [];
  return '<div style="background:#fff;border:1px solid ' + MAIL.red + ';border-left:4px solid ' + MAIL.red + ';border-radius:10px;padding:12px 15px;margin-bottom:12px">' +
    '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.red + '">Welcome back · before you start</div>' +
    '<div style="font-size:13.5px;line-height:1.55;margin-top:6px">You were absent on ' + esc_(prettyDate_(b.day)) + '. ' +
      (b.moved ? b.moved + ' of your tasks were covered by colleagues; they keep them. ' : '') +
      (owe.length ? 'These ' + owe.length + ' carry an ACTION REQUIRED post: write where each stands, in the client\'s words, before 10am.' : 'Nothing is waiting for your note.') + '</div>' +
    owe.map(function (t) { return '<div style="font-size:12.5px;line-height:1.45;padding:3px 0;border-top:1px solid ' + MAIL.line + '">' + esc_(t.s) +
      (t.due ? ' <span style="color:' + MAIL.muted + '">· due ' + esc_(shortDate_(t.due)) + '</span>' : '') + '</div>'; }).join('') +
  '</div>';
}

// ---- the 9:15 attendance report ----------------------------------------------

function attendanceReport_(day) {
  var rows = hrRows_(ATT, true) || [], month = day.slice(0, 7);
  var line = function (sid) {
    var sp = parseSpan_(scheduleFor_(sid).hours || '') || { start: 480 };
    var today = attRow_(rows, day, sid), st, color;
    if (today && String(today.row.Status || '').toLowerCase() === 'absent') {
      var auto = String(today.row.MarkedBy || '') === 'tracker';
      st = 'Absent · ' + (auto ? 'no sign-in (automatic)' : (String(today.row.Reason || '') || 'marked') + ' (' + String(today.row.MarkedBy || '') + ')');
      color = MAIL.red;
    } else if (today && timeStr_(today.row.FirstSignIn)) {
      var at = timeStr_(today.row.FirstSignIn), late = lateBy_(sid, at);
      st = 'In at ' + twelve_(at) + (late ? ' · late ' + late + ' min' : ' · on time');
      color = late ? MAIL.amber : MAIL.green;
    } else { st = 'Not signed in'; color = MAIL.red; }
    var mLate = 0, mAbs = 0, mIn = 0, sum = 0, seen = {};
    rows.forEach(function (r) {
      var d = isoDay_(r.Date);
      if (String(r.StaffId) !== sid || d.slice(0, 7) !== month || d > day || seen[d]) return;
      var a = attRow_(rows, d, sid); if (!a) return;
      seen[d] = 1;
      if (String(a.row.Status || '').toLowerCase() === 'absent') { mAbs++; return; }
      var t = timeStr_(a.row.FirstSignIn); if (!t) return;
      mIn++; sum += minutesOf_(t);
      if (lateBy_(sid, t)) mLate++;
    });
    return { sid: sid, name: nameFor_(sid), start: twelve_(mmText_(sp.start)), st: st, color: color,
             late: mLate, abs: mAbs, avg: mIn ? twelve_(mmText_(Math.round(sum / mIn))) : '—', days: mIn };
  };
  return DAY_MAIL_DESKS.map(line);
}

function sendAttendanceReport_(day) {
  var list = attendanceReport_(day), mgr = managerEmails_();
  if (!mgr.length) return false;
  var nIn = list.filter(function (x) { return /^In/.test(x.st); }).length;
  var nLate = list.filter(function (x) { return /late/.test(x.st); }).length;
  var nOut = list.filter(function (x) { return !/^In/.test(x.st); }).length;
  var td = 'padding:7px 6px;font-size:13px;border-top:1px solid ' + MAIL.line + ';';
  var table = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr><td style="padding:7px 6px;font-size:10.5px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + '">Desk</td>' +
    '<td style="padding:7px 6px;font-size:10.5px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + '">Today</td>' +
    '<td style="padding:7px 6px;font-size:10.5px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right">Month: late · out · avg in</td></tr>' +
    list.map(function (x) {
      return '<tr><td style="' + td + '"><b>' + esc_(x.name) + '</b><div style="font-size:11.5px;color:' + MAIL.muted + '">starts ' + esc_(x.start) + '</div></td>' +
        '<td style="' + td + 'color:' + x.color + ';font-weight:700">' + esc_(x.st) + '</td>' +
        '<td style="' + td + 'text-align:right">' + x.late + ' · ' + x.abs + ' · ' + esc_(x.avg) + '</td></tr>';
    }).join('') + '</table>';
  var kam = emailFor_('kamla');
  MailApp.sendEmail({ to: mgr.join(','), cc: [DAYSTART_CC_DEFAULT].concat(kam ? [kam] : []).join(','),
    subject: 'Attendance · ' + shortDate_(day) + ' · ' + nIn + ' in' + (nLate ? ', ' + nLate + ' late' : '') + (nOut ? ', ' + nOut + ' out' : ''),
    htmlBody: shell_('Attendance register', prettyDate_(day) + ' · ' + hhmm_(new Date()),
      statTiles_([{ value: nIn, label: 'in', color: MAIL.green }, { value: nLate, label: 'late', color: nLate ? MAIL.amber : MAIL.navy },
                  { value: nOut, label: 'out or not signed in', color: nOut ? MAIL.red : MAIL.navy }]) +
      '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">Signing in is the register: from the morning e-mail\'s button, the plan page or the tracker. ' +
        'In more than ' + ATT_GRACE_MIN + ' minutes after the start is late; no sign-in an hour after the start is absent, and the work is covered.</div>' +
      table) });
  return true;
}

// ---- the Branch Manager's own day ----------------------------------------------

function bmSfId_() {
  var u = (sfkUsers_() || {}).ricky;
  return (u && u.id) || PropertiesService.getScriptProperties().getProperty('BM_SF_ID') || BM_SF_DEFAULT;
}

/** What waits on the Branch Manager: his own tasks, the team's notes that ask
 *  him something he has not answered, and his instructions nobody has acted on. */
function bmWaiting_(day) {
  var me = bmSfId_(), users = sfkUsers_() || {}, out = { mine: [], ask: [], ignored: [], byOwner: {} };
  var desk = {}, deskIds = [];
  DAY_MAIL_DESKS.concat(['ricky']).forEach(function (s) { if (users[s] && s !== 'ricky') { desk[users[s].id] = s; deskIds.push("'" + users[s].id + "'"); } });

  // 1. In his name, due or overdue.
  out.mine = sfkQuery_("SELECT Id, Subject, ActivityDate, Task_Type__c FROM Task WHERE OwnerId = '" + me +
    "' AND IsClosed = false AND ActivityDate <= " + day + " AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') ORDER BY ActivityDate ASC LIMIT 200")
    .map(function (r) { return { id: r.Id, subject: shorten_(r.Subject, 95), due: r.ActivityDate || '', late: !!(r.ActivityDate && r.ActivityDate < day), ty: r.Task_Type__c || '' }; });

  if (!deskIds.length) return out;
  // 2. The team's last three working days of notes: any that names him, with no
  //    post from him on that task after it.
  var since = sfkUtcAt_(lastWorkdays_(day, 3)[0], 0);
  var posts = sfkQuery_("SELECT ParentId, CreatedById, CreatedDate, Body FROM FeedItem WHERE Type = 'TextPost' AND CreatedDate >= " + since +
    ' AND (CreatedById IN (' + deskIds.join(',') + ") OR CreatedById = '" + me + "') ORDER BY CreatedDate ASC LIMIT 2000");
  var lastMine = {}, asks = {};
  posts.forEach(function (p) {
    if (String(p.ParentId).slice(0, 3) !== '00T') return;
    if (p.CreatedById === me) { lastMine[p.ParentId] = p.CreatedDate; return; }
    if (/\b(Mr\.?\s*Rampersad|Ricky|Branch Manager|BM)\b/i.test(String(p.Body || '').replace(/<[^>]+>/g, ' ')))
      asks[p.ParentId] = { at: p.CreatedDate, by: desk[p.CreatedById], body: String(p.Body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
  });
  var askIds = Object.keys(asks).filter(function (id) { return !lastMine[id] || lastMine[id] < asks[id].at; });
  if (askIds.length) {
    var subj = {};
    try {
      sfkQuery_('SELECT Id, Subject, IsClosed FROM Task WHERE Id IN (' + askIds.slice(0, 150).map(function (x) { return "'" + x + "'"; }).join(',') + ')')
        .forEach(function (r) { if (!r.IsClosed) subj[r.Id] = r.Subject; });
    } catch (e) {}
    out.ask = askIds.filter(function (id) { return subj[id]; }).map(function (id) {
      return { id: id, subject: shorten_(subj[id], 90), by: nameFor_(asks[id].by), said: shorten_(asks[id].body, 160), at: asks[id].at };
    }).sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  }

  // 3. His instructions: tasks he created in a desk's name, overdue, with no
  //    note from that desk.
  var given = sfkQuery_("SELECT Id, Subject, OwnerId, ActivityDate FROM Task WHERE CreatedById = '" + me + "' AND OwnerId IN (" + deskIds.join(',') +
    ') AND IsClosed = false AND ActivityDate < ' + day + ' ORDER BY ActivityDate ASC LIMIT 400');
  var noted = {};
  for (var i = 0; i < given.length; i += 150) {
    var chunk = given.slice(i, i + 150).map(function (r) { return "'" + r.Id + "'"; });
    try {
      sfkQuery_("SELECT ParentId, CreatedById FROM FeedItem WHERE Type = 'TextPost' AND ParentId IN (" + chunk.join(',') + ') LIMIT 2000')
        .forEach(function (p) { noted[p.ParentId + '|' + p.CreatedById] = 1; });
    } catch (e) {}
  }
  given.forEach(function (r) {
    if (noted[r.Id + '|' + r.OwnerId]) return;
    var s = desk[r.OwnerId];
    out.byOwner[s] = (out.byOwner[s] || 0) + 1;
    out.ignored.push({ id: r.Id, subject: shorten_(r.Subject, 90), due: r.ActivityDate || '', late: true, owner: nameFor_(s) });
  });
  return out;
}

function sendBranchManagerDay_(day) {
  var mgr = managerEmails_();
  if (!mgr.length) return false;
  var team = DAY_MAIL_DESKS.map(function (sid) {
    var it = null; try { it = intelFor_(sid, day); } catch (e) {}
    var y = (it && it.yesterday) || {};
    return { sid: sid, name: nameFor_(sid), hours: scheduleFor_(sid).hours || '', it: it,
             overdue: it ? it.overdueNow : null, closed: y.closed, noted: y.noted, payoff: y.payoff,
             late: it ? it.lateDays : null, early: it ? it.earlyDays : null, planned: it ? it.plannedDays : null };
  });
  var w = { mine: [], ask: [], ignored: [], byOwner: {} }, sfOk = true;
  try { w = bmWaiting_(day); } catch (e) { sfOk = false; }
  var absentToday = {};
  try { (hrRows_(ATT, true) || []).forEach(function (r) { if (isoDay_(r.Date) === day && String(r.Status || '').toLowerCase() === 'absent') absentToday[String(r.StaffId)] = String(r.Reason || 'marked out'); }); } catch (e) {}

  var td = 'padding:7px 6px;font-size:12.5px;border-top:1px solid ' + MAIL.line + ';';
  var th = 'padding:7px 6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right';
  var teamTable = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr><td style="' + th + ';text-align:left">Desk</td><td style="' + th + '">Overdue</td><td style="' + th + '">Closed yday</td><td style="' + th + '">With note</td><td style="' + th + '">Late · early-filed · planned (10 days)</td></tr>' +
    team.map(function (t) {
      var n = function (v) { return v == null ? '—' : String(v); };
      return '<tr><td style="' + td + '"><b>' + esc_(t.name) + '</b><div style="font-size:11px;color:' + MAIL.muted + '">' + esc_(t.hours) +
        (absentToday[t.sid] ? ' · <span style="color:' + MAIL.red + ';font-weight:700">out: ' + esc_(absentToday[t.sid]) + '</span>' : '') + '</div></td>' +
        '<td style="' + td + 'text-align:right;' + (t.overdue ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + n(t.overdue) + '</td>' +
        '<td style="' + td + 'text-align:right">' + n(t.closed) + '</td>' +
        '<td style="' + td + 'text-align:right;' + (t.closed && t.noted < t.closed ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + n(t.noted) + '</td>' +
        '<td style="' + td + 'text-align:right">' + n(t.late) + ' · ' + n(t.early) + ' · ' + n(t.planned) + '</td></tr>';
    }).join('') + '</table>';

  var list = function (items, render, max) {
    if (!items.length) return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:10px 15px;font-size:13px;color:' + MAIL.green + '">Nothing waiting.</div>';
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.red + ';border-radius:10px;padding:10px 15px">' +
      items.slice(0, max).map(render).join('') +
      (items.length > max ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:4px">and ' + (items.length - max) + ' more in Salesforce.</div>' : '') + '</div>';
  };
  if (sfOk) { try { saveBmItems_(day, w); } catch (e) {} }
  try { PropertiesService.getScriptProperties().setProperty(umItemsKey_('ricky', day), JSON.stringify(w.mine.slice(0, 30).map(function (t) { return { id: t.id, s: t.subject, a: '', due: t.due, late: t.late, k: t.ty === 'Pendings' ? 'pend' : t.ty === 'Opportunity' ? 'new' : 'other' }; })).slice(0, 8900)); } catch (e) {}
  var base = '';
  try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var open = function (id) { return base ? ' <a href="' + esc_(base + id) + '" style="color:' + MAIL.navy + ';font-weight:700;font-size:12px">open &rarr;</a>' : ''; };
  var answer = (w.ask.length || w.mine.length || w.ignored.length)
    ? replyButton_(replyUrl_('ricky', day, 'bm'), 'Respond to these', 'One page: type under any item and send. Each reply goes on that task\'s Chatter; a tick closes one of your own.')
    : '';
  var row = function (inner) { return '<div style="font-size:12.5px;line-height:1.45;padding:5px 0;border-top:1px solid ' + MAIL.line + '">' + inner + '</div>'; };
  var mineLate = w.mine.filter(function (t) { return t.late; }).length;
  var owners = Object.keys(w.byOwner).map(function (s) { return String(nameFor_(s)).split(' ')[0] + ' ' + w.byOwner[s]; }).join(', ');

  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">Good morning, Mr Rampersad. Your operations review: where each desk stands, then what is waiting on you. ' +
      'There are no time blocks: every morning the system reads Salesforce, Query Pal and the inbox and shares out the work. The team\'s plans go out half an hour before each start: Akaash and the agents at 5:30, Sasha and Liz at 6:30, Kamla, Azariah and Pawan at 7:30. No morning check reads as absent, and that desk\'s work is shared out. The attendance report follows at 9:15, your progress at 11:00, and you close out the day at 3:00pm.</div>' +
    statTiles_([
      { value: sfOk ? w.mine.length : '—', label: 'your tasks due', color: w.mine.length ? MAIL.amber : MAIL.navy },
      { value: sfOk ? mineLate : '—', label: 'of them overdue', color: mineLate ? MAIL.red : MAIL.navy },
      { value: sfOk ? w.ask.length : '—', label: 'notes asking you', color: w.ask.length ? MAIL.red : MAIL.navy },
      { value: sfOk ? w.ignored.length : '—', label: 'your instructions, no note', color: w.ignored.length ? MAIL.red : MAIL.navy }
    ]) + cmdButton_('ricky', day) + replyButton_(replyUrl_('ricky', day, 'um'), 'Plan my day and sign in', 'One tap, no password. Comment on your own tasks, set your numbers for the day; saving signs you in.') + answer +
    mgrDayCard_('ricky', day, bmDayItems_(day, w), 'Your day, filled with what is outstanding: your own tasks, what is waiting on you, the orphans to assign, and the agents who need you. Plan it from the first button; saving signs you in.') +
    sectionLabel_('The branch in full') +
    bmBranchCards_(day) +
    bmFFCard_(day) +
    sectionLabel_('The team this morning') + teamTable +
    '<div style="font-size:11.5px;color:' + MAIL.muted + ';margin-top:5px">Closed yesterday and closed with the owner\'s own note. A closed task without a note is not closed.</div>' +
    sectionLabel_('Waiting on your Chatter (' + w.ask.length + ')') +
    list(w.ask, function (a) { return row('<b>' + esc_(a.by) + '</b> on ' + esc_(a.subject) + open(a.id) + '<div style="color:' + MAIL.muted + ';margin-top:2px">"' + esc_(a.said) + '"</div>'); }, 8) +
    sectionLabel_('In your name, due or overdue (' + w.mine.length + ')') +
    list(w.mine, function (t) { return row(payoffTag_(t).replace(/^ /, '') + ' ' + esc_(t.subject) + (t.late ? ' <span style="color:' + MAIL.red + ';font-weight:700">· overdue since ' + esc_(shortDate_(t.due)) + '</span>' : ' <span style="color:' + MAIL.amber + ';font-weight:700">· due today</span>') + open(t.id)); }, 10) +
    sectionLabel_('Your instructions with no note from the desk (' + w.ignored.length + ')') +
    (owners ? '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin-bottom:6px">By desk: ' + esc_(owners) + '</div>' : '') +
    list(w.ignored, function (t) { return row(esc_(t.subject) + ' <span style="color:' + MAIL.muted + '">· ' + esc_(t.owner) + '</span> <span style="color:' + MAIL.red + ';font-weight:700">· overdue since ' + esc_(shortDate_(t.due)) + '</span>' + open(t.id)); }, 10) +
    answer +
    (sfOk ? '' : '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin-top:12px">Salesforce did not answer this morning, so your lists are not shown.</div>');

  MailApp.sendEmail({ to: mgr.join(','), cc: DAYSTART_CC_DEFAULT,
    subject: 'Your day · Branch Manager · ' + shortDate_(day) + (sfOk ? ' · ' + w.mine.length + ' yours due, ' + w.ask.length + ' asking you, ' + w.ignored.length + ' instructions not actioned' : ''),
    htmlBody: shell_('Good morning · the branch today', 'Branch Manager · ' + prettyDate_(day), body) });
  return true;
}

/** From the editor: send this morning's Branch Manager e-mail now. */
function sendBranchManagerNow() {
  var day = todayISO_();
  PropertiesService.getScriptProperties().setProperty('bmday_' + day, hhmm_(new Date()));
  var ok = sendBranchManagerDay_(day);
  Logger.log(ok ? 'Branch Manager e-mail sent.' : 'No manager address on file.');
  return ok;
}

/** From the editor: today's attendance report now. */
function sendAttendanceNow() {
  var ok = sendAttendanceReport_(todayISO_());
  Logger.log(ok ? 'Attendance report sent.' : 'No manager address on file.');
  return ok;
}

// ---- answering from the Branch Manager's e-mail ---------------------------------
//
//  "I also want to click in the email, as the Branch Manager, on items that I
//  need to respond on." (15 October 2026.) Every item in his morning e-mail
//  opens in Salesforce; one button opens a page with a box under each item.
//  What he types goes on that task's Chatter, headed as his. A tick on one of
//  his own tasks closes it, with what he typed as the note. GET only shows the
//  page; only the POST writes, so a mail scanner opening the link cannot
//  answer for him.

function sfkRecordUrl_(id) {
  try { return sfkToken_().instance_url + '/' + id; } catch (e) { return ''; }
}

function sfkPatchTask_(taskId, body) {
  function send(tok) {
    return UrlFetchApp.fetch(tok.instance_url + '/services/data/' + SFK.API + '/sobjects/Task/' + taskId, {
      method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok.access_token }, payload: JSON.stringify(body) });
  }
  var res = send(sfkToken_());
  if (res.getResponseCode() === 401) { sfkProps_().deleteProperty('SFK_TOKEN'); res = send(sfkToken_()); }
  var code = res.getResponseCode();
  if (code !== 204 && code !== 200) throw new Error(sfkSaid_(res.getContentText()));
  return true;
}

function bmItemsKey_(day) { return 'bm_items_' + day; }

/** The morning's items, kept for the answer page. */
function saveBmItems_(day, w) {
  var items = [];
  (w.ask || []).slice(0, 12).forEach(function (a) { items.push({ id: a.id, k: 'ask', s: a.subject, by: a.by, said: shorten_(a.said, 140) }); });
  (w.mine || []).slice(0, 12).forEach(function (t) { items.push({ id: t.id, k: 'mine', s: t.subject, due: t.due, late: t.late }); });
  (w.ignored || []).slice(0, 10).forEach(function (t) { items.push({ id: t.id, k: 'ignored', s: t.subject, due: t.due, owner: t.owner }); });
  var json = JSON.stringify(items);
  while (json.length > 8900 && items.length) { items.pop(); json = JSON.stringify(items); }
  PropertiesService.getScriptProperties().setProperty(bmItemsKey_(day), json);
  return items;
}

function bmReplyPage_(person, day, error, notice) {
  var items = [];
  try { items = JSON.parse(PropertiesService.getScriptProperties().getProperty(bmItemsKey_(day)) || '[]'); } catch (e) {}
  var head = { ask: 'Waiting on your Chatter', mine: 'In your name, due or overdue', ignored: 'Your instructions with no note from the desk' };
  var groups = ['ask', 'mine', 'ignored'].map(function (k) {
    var list = items.filter(function (it) { return it.k === k; });
    if (!list.length) return '';
    return '<div class="card"><div class="bh">' + esc_(head[k]) + '</div>' + list.map(function (it) {
      var url = sfkRecordUrl_(it.id);
      return '<div style="padding:10px 0;border-top:1px solid #E5E1D6">' +
        '<div style="font-size:14px"><b>' + esc_(it.s) + '</b>' +
          (it.owner ? ' <span class="br2">· ' + esc_(it.owner) + '</span>' : '') +
          (it.due ? ' <span class="br2">· ' + (it.late ? 'overdue since ' : 'due ') + esc_(shortDate_(it.due)) + '</span>' : '') +
          (url ? ' · <a href="' + esc_(url) + '" target="_blank">open</a>' : '') + '</div>' +
        (it.said ? '<div class="bf" style="margin:3px 0">' + esc_(it.by || '') + ': "' + esc_(it.said) + '"</div>' : '') +
        '<textarea name="c_' + esc_(it.id) + '" rows="2" placeholder="' + (k === 'ignored' ? 'e.g. Kamla, chase this today and note it by 2pm' : 'Your reply, posted to Chatter on this task') + '"></textarea>' +
        (k === 'mine' ? '<label class="t" style="margin-top:4px"><input type="checkbox" name="done" value="' + esc_(it.id) + '"><span>Done: close it with my reply as the note</span></label>' : '') +
      '</div>';
    }).join('') + '</div>';
  }).join('');
  return replyPage_('Respond · ' + prettyDate_(day), 'Type under any item and send. Each reply goes on that task\'s Chatter as yours. Leave the rest blank.',
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    (notice ? '<div class="card ok">' + esc_(notice) + '</div>' : '') +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_('ricky', day, 'bm') + groups +
    '<div class="card"><div class="bh">Log what you did</div><div class="bf">One line each: every line becomes a Salesforce task in your name for today, with the line as its note.</div>' +
      '<textarea name="log" rows="4" placeholder="e.g. Met NovaHub board on group life renewal; pricing agreed in principle"></textarea>' +
      '<select name="log_type">' + Object.keys(SF_TYPES).map(function (k) { return '<option value="' + esc_(k) + '"' + (k === 'RR Operations' ? ' selected' : '') + '>' + esc_(SF_TYPES[k]) + '</option>'; }).join('') + '</select>' +
      '<label class="t" style="margin-top:6px"><input type="checkbox" name="log_done" value="1" checked><span>Already done: log them as completed</span></label></div>' +
    '<button type="submit">Send my replies and log</button></form>');
}

function bmReplySave_(person, day, p, all) {
  var items = [];
  try { items = JSON.parse(PropertiesService.getScriptProperties().getProperty(bmItemsKey_(day)) || '[]'); } catch (e) {}
  var done = all('done'), out = [], at = hhmm_(new Date());
  items.forEach(function (it) {
    var txt = String(p['c_' + it.id] || '').trim(), close = done.indexOf(it.id) > -1;
    if (!txt && !close) return;
    var res = '';
    try {
      if (txt) sfkInsert_('FeedItem', { ParentId: it.id, Body: 'Branch Manager · ' + shortDate_(day) + ' ' + twelve_(at) + '\n\n' + txt });
      if (close) {
        if (!txt) throw new Error('Write the note first: a closed task without a note is not closed.');
        sfkPatchTask_(it.id, { Status: 'Completed' });
      }
      res = close ? 'replied and closed' : 'replied';
    } catch (e) { res = 'NOT SAVED: ' + String(e && e.message || e).slice(0, 160); }
    out.push({ s: it.s, res: res, ok: !/^NOT/.test(res) });
  });
  var logLines = String(p.log || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length >= 4; }).slice(0, 15);
  var logType = SF_TYPES[String(p.log_type || '')] ? String(p.log_type) : 'RR Operations', logDone = String(p.log_done || '') === '1';
  logLines.forEach(function (l) {
    var res = '';
    try {
      var id = sfkInsert_('Task', { Subject: l.slice(0, 255), OwnerId: bmSfId_(), ActivityDate: day,
        Status: logDone ? 'Completed' : 'In Progress', Task_Type__c: logType });
      try { sfkInsert_('FeedItem', { ParentId: id, Body: 'Branch Manager · ' + shortDate_(day) + ' ' + twelve_(at) + '\n\n' + l }); } catch (e) {}
      res = logDone ? 'logged, completed' : 'logged, in progress';
    } catch (e) { res = 'NOT SAVED: ' + String(e && e.message || e).slice(0, 160); }
    out.push({ s: l, res: res, ok: !/^NOT/.test(res) });
  });
  if (!out.length) return bmReplyPage_(person, day, 'Nothing typed. Write under the items you want to answer, or log what you did.');
  sfkForgetDay_(day);
  return replyPage_('Sent: ' + out.filter(function (o) { return o.ok; }).length + ' of ' + out.length, 'Each reply is on the task\'s Chatter now.',
    '<div class="card ' + (out.every(function (o) { return o.ok; }) ? 'ok' : 'bad') + '">' + out.map(function (o) {
      return '<div class="ln">' + (o.ok ? '&#10003; ' : '&#9888; ') + esc_(o.s) + ' · ' + esc_(o.res) + '</div>';
    }).join('') + '</div>' +
    '<form method="get" action="' + esc_(execBase_()) + '" target="_top">' +
      ['rs', 'ricky', 'd', day, 'f', 'bm', 'k', replySig_('ricky', day, 'bm')].reduce(function (a, v, i, arr) {
        return i % 2 ? a : a + '<input type="hidden" name="' + arr[i] + '" value="' + esc_(arr[i + 1]) + '">'; }, '') +
      '<button type="submit">Back to the list</button></form>');
}

// ---------------------------------------------------------------------------
//  The managers' day: the Branch Manager's progress, and the Unit Manager
//
//  Ricky, 15 October 2026: "build a model to also include your unit manager
//  and yourself ... the objective is not to go online but on the fly."
//    Branch Manager   5am: operations, his assignments, what he is to action.
//                     12pm and 6pm: his progress and what is happening, with
//                     the ability to log and Chatter from the e-mail.
//    Unit Manager     6am: his unit, filtered to the agents in his unit,
//                     pendings first; any comment he makes goes on Chatter;
//                     and his day as a manager planned against the manager's
//                     KPIs (recruiting new names, coaching, performance
//                     management ...). 5pm: an account of his day and his
//                     unit's progress, with comments. Copied to Ricky.
//
//  The unit is read from the Unit column of the Access tab (Branch
//  Intelligence's iBuildUnits_): Salesforce carries no unit on an agent.
//  Script Property UNIT_FOR_<sid> names the unit if it is not obvious from the
//  manager's name; UNIT_AGENTS_<sid> (comma-separated names) overrides it.
// ---------------------------------------------------------------------------

var BM_PROGRESS_AT = [11 * 60, 15 * 60];   // 11am progress across the team; 3pm, close out the day
var UM_DESKS = ['akaash'];
var UM_MORNING_AT = 5 * 60 + 30;     // half an hour before his 6am start
var UM_PROGRESS_AT = 11 * 60;        // his progress report: the support he is getting, and what his agents are doing
var UM_EVENING_AT = 17 * 60 + 30;    // the account of the day, half an hour before 6pm
var UM_LIST_MAX = 10;

/** The manager's KPIs, asked as a plan in the morning and as an account at five. */
var UM_CHECKS = [
  { id: 'recruit',  q: 'Recruitment: new names added to the pipeline',           note: 'Names, and where each came from' },
  { id: 'interview',q: 'Recruitment: interviews or career presentations held',   note: 'Who' },
  { id: 'coach',    q: 'Coaching: agents coached one to one',                    note: 'Who, and on what' },
  { id: 'perf',     q: 'Performance management: agents spoken to on activity, production or persistency', note: 'Who, and the action agreed' },
  { id: 'field',    q: 'Joint field work: client meetings with an agent',        note: 'Agent and client' },
  { id: 'pendings', q: 'Unit pendings moved to a next step',                     note: '' },
  { id: 'persist',  q: 'Persistency: lapses and premium dues called in the unit', note: '' },
  { id: 'licence',  q: 'Licensing and development: study, exams, contracts moved', note: 'Who' },
  { id: 'own',      q: 'Own production: appointments and applications',          note: '' },
  { id: 'escal',    q: 'Client escalations handled',                             note: '' }
];

var MGRDAY = { must: ['Date', 'StaffId', 'Kind', 'Item'], name: 'Manager Day',
               head: ['Date', 'StaffId', 'Kind', 'Item', 'Question', 'Planned', 'Done', 'Note', 'At'] };

function soqlStr_(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

/** The agents in a manager's unit, the manager included. */
function unitAgents_(sid) {
  var props = PropertiesService.getScriptProperties();
  var forced = props.getProperty('UNIT_AGENTS_' + sid);
  if (forced) return forced.split(',').map(function (s) { return s.trim(); }).filter(String);
  var me = nameFor_(sid), out = [me];
  try {
    var sb = skillBank_(), mine = [];
    Object.keys(sb).forEach(function (k) { var p = sb[k]; if (p.isAgent && p.active && bkNk_(p.unit) === bkNk_(me)) mine.push(p.name); });
    if (mine.length) return out.concat(mine);
  } catch (e) {}
  if (typeof iBuildUnits_ !== 'function') return out;
  var units = {};
  try { units = iBuildUnits_() || {}; } catch (e) { return out; }
  var key = props.getProperty('UNIT_FOR_' + sid) || '', parts = String(me).toLowerCase().split(/\s+/);
  var norm = function (s) { return typeof iNameKey_ === 'function' ? iNameKey_(s) : String(s || '').toLowerCase().trim(); };
  if (!key) Object.keys(units).forEach(function (u) {
    if (key) return;
    var lu = u.toLowerCase();
    if (parts.some(function (p) { return p.length > 3 && lu.indexOf(p) > -1; })) { key = u; return; }
    if ((units[u] || []).some(function (m) { return norm(m.name) === norm(me) && /manager/i.test(m.role || ''); })) key = u;
  });
  if (!key || !units[key]) return out;
  units[key].forEach(function (m) { if (m.name && out.indexOf(m.name) === -1) out.push(m.name); });
  return out;
}

/** Open and recently closed tasks for the unit's agents. */
function unitBook_(sid, day) {
  var agents = unitAgents_(sid);
  var inList = agents.map(soqlStr_).join(',');
  var open = sfkQuery_('SELECT Id, Subject, Task_Type__c, ActivityDate, Status, Owner.Name, Agent__r.Name, What.Name, LastModifiedDate FROM Task' +
    ' WHERE IsClosed = false AND Agent__r.Name IN (' + inList + ") AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') ORDER BY ActivityDate ASC NULLS LAST LIMIT 500");
  var since = sfkUtcAt_(lastWorkdays_(day, 1)[0], 0);
  var closed = sfkQuery_('SELECT Id, Subject, Task_Type__c, CompletedDateTime, Owner.Name, Agent__r.Name FROM Task' +
    ' WHERE IsClosed = true AND Agent__r.Name IN (' + inList + ') AND CompletedDateTime >= ' + since + ' LIMIT 500');
  var t = function (r) {
    return { id: r.Id, subject: shorten_(r.Subject, 95), ty: r.Task_Type__c || '', due: r.ActivityDate || '',
             late: !!(r.ActivityDate && r.ActivityDate < day), agent: (r.Agent__r && r.Agent__r.Name) || '',
             owner: (r.Owner && r.Owner.Name) || '', touched: daysSince_(r.LastModifiedDate), status: r.Status || '', account: (r.What && r.What.Name) || '' };
  };
  var todayFrom = sfkUtcAt_(day, 0);
  return { agents: agents, open: open.map(t),
           closedYday: closed.filter(function (r) { return String(r.CompletedDateTime) < todayFrom; }).length,
           closedToday: closed.filter(function (r) { return String(r.CompletedDateTime) >= todayFrom; })
             .map(function (r) { return { id: r.Id, subject: shorten_(r.Subject, 95), agent: (r.Agent__r && r.Agent__r.Name) || '', ty: r.Task_Type__c || '', owner: (r.Owner && r.Owner.Name) || '' }; }) };
}

/** Pendings first, then new business, then retention, then the rest overdue. */
function unitSections_(book) {
  var pend = book.open.filter(function (t) { return t.ty === 'Pendings'; });
  var rest = book.open.filter(function (t) { return t.ty !== 'Pendings'; });
  var nb = rest.filter(function (t) { return payoffOf_(t).key === 'new'; });
  var ret = rest.filter(function (t) { var k = payoffOf_(t).key; return k === 'retention' || k === 'orphan'; });
  var other = rest.filter(function (t) { var k = payoffOf_(t).key; return k !== 'new' && k !== 'retention' && k !== 'orphan' && t.late; });
  var byDue = function (a, b) { return String(a.due || '9999').localeCompare(String(b.due || '9999')); };
  return [
    { k: 'pend', label: 'Pendings', list: pend.sort(byDue) },
    { k: 'new', label: 'New business', list: nb.sort(byDue) },
    { k: 'ret', label: 'Retention and orphan adoption', list: ret.sort(byDue) },
    { k: 'other', label: 'Everything else overdue', list: other.sort(byDue) }
  ];
}

function umItemsKey_(sid, day) { return 'um_items_' + sid + '_' + day; }

function umTaskLine_(t, day, base) {
  return '<div style="font-size:12.5px;line-height:1.45;padding:5px 0;border-top:1px solid ' + MAIL.line + '">' +
    '<b>' + esc_(t.agent || '—') + '</b> · ' + esc_(t.subject) +
    (t.late ? ' <span style="color:' + MAIL.red + ';font-weight:700">· overdue since ' + esc_(shortDate_(t.due)) + '</span>'
            : (t.due ? ' <span style="color:' + MAIL.muted + '">· due ' + esc_(shortDate_(t.due)) + '</span>' : '')) +
    (t.touched >= 7 ? ' <span style="color:' + MAIL.amber + '">· untouched ' + t.touched + ' days</span>' : '') +
    (base ? ' <a href="' + esc_(base + t.id) + '" style="color:' + MAIL.navy + ';font-weight:700;font-size:12px">open &rarr;</a>' : '') + '</div>';
}

function mgrRows_(sid, day, kind) {
  var out = {};
  (hrRows_(MGRDAY, true) || []).forEach(function (r) {
    if (isoDay_(r.Date) !== day || String(r.StaffId) !== sid || String(r.Kind) !== kind) return;
    out[String(r.Item)] = r;
  });
  return out;
}

function mgrWrite_(sid, day, kind, rows) {
  var sh = hrTab_(MGRDAY, true), head = headerOf_(sh), at = hhmm_(new Date());
  rows.forEach(function (o) {
    o.Date = day; o.StaffId = sid; o.Kind = kind; o.At = at;
    sh.appendRow(head.map(function (h) { return o[h] != null ? o[h] : ''; }));
  });
  forgetHr_(MGRDAY);
}

// ---- the Unit Manager: 6am --------------------------------------------------

function sendUnitManagerMorning_(sid, day) {
  var to = emailFor_(sid);
  if (!to) return false;
  var name = nameFor_(sid), first = String(name).split(' ')[0], book = null;
  try { book = unitBook_(sid, day); } catch (e) {}
  var base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var secs = book ? unitSections_(book) : [];
  var items = [];
  secs.forEach(function (s) { s.list.slice(0, UM_LIST_MAX).forEach(function (t) { items.push({ id: t.id, s: t.subject, a: t.agent, due: t.due, late: t.late, k: s.k }); }); });
  try { PropertiesService.getScriptProperties().setProperty(umItemsKey_(sid, day), JSON.stringify(items).slice(0, 8900)); } catch (e) {}

  var perAgent = {};
  if (book) book.open.forEach(function (t) {
    var a = perAgent[t.agent] || (perAgent[t.agent] = { open: 0, late: 0, pend: 0 });
    a.open++; if (t.late) a.late++; if (t.ty === 'Pendings') a.pend++;
  });
  var td = 'padding:6px;font-size:12.5px;border-top:1px solid ' + MAIL.line + ';';
  var agentTable = book && book.open.length ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr><td style="padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + '">Agent</td>' +
    ['Open', 'Overdue', 'Pendings'].map(function (h) { return '<td style="padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right">' + h + '</td>'; }).join('') + '</tr>' +
    Object.keys(perAgent).sort(function (a, b) { return perAgent[b].late - perAgent[a].late; }).map(function (a) {
      var x = perAgent[a];
      return '<tr><td style="' + td + '">' + esc_(a) + '</td><td style="' + td + 'text-align:right">' + x.open + '</td>' +
        '<td style="' + td + 'text-align:right;' + (x.late ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + x.late + '</td>' +
        '<td style="' + td + 'text-align:right">' + x.pend + '</td></tr>';
    }).join('') + '</table>' : '';

  var nLate = book ? book.open.filter(function (t) { return t.late; }).length : 0;
  var nPend = secs.length ? secs[0].list.length : 0;
  var btn = replyButton_(replyUrl_(sid, day, 'um'), 'Plan my day and sign in', 'One tap, no password. A box under each item goes on its Chatter; set your numbers for the manager\'s KPIs; saving signs you in.');
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">Good morning, ' + esc_(first) + '. This is your unit as Salesforce has it this morning' +
      (book ? ' (' + book.agents.length + ' agent' + (book.agents.length === 1 ? '' : 's') + ', you included)' : '') +
      ', pendings first. Comment on anything that needs a push: your comment goes on that task\'s Chatter, headed as yours. ' +
      'Then set your day as a manager. At 5:30pm you will be asked for the account of it.</div>' +
    statTiles_([
      { value: book ? book.open.length : '—', label: 'open in your unit' },
      { value: book ? nLate : '—', label: 'overdue', color: nLate ? MAIL.red : MAIL.navy },
      { value: book ? nPend : '—', label: 'pendings', color: nPend ? MAIL.amber : MAIL.navy },
      { value: book ? book.closedYday : '—', label: 'closed yesterday', color: MAIL.green }
    ]) + btn + cmdButton_(sid, day) +
    mgrDayCard_(sid, day, umDayItems_(sid, day, book), 'Your day is built on the Unit Manager\'s job: your unit\'s outstanding work and your manager KPIs. Open the button, set your numbers and save: <b>saving is your morning check</b>, and that is your attendance for the day. Your progress report comes at 11, the account of the day at 5:30.') +
    sectionLabel_('Your unit in full') +
    (book ? secs.map(function (s) {
      if (!s.list.length) return '';
      return sectionLabel_(s.label + ' (' + s.list.length + ')') +
        '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (s.k === 'pend' ? MAIL.amber : MAIL.navy) + ';border-radius:10px;padding:8px 15px">' +
        s.list.slice(0, UM_LIST_MAX).map(function (t) { return umTaskLine_(t, day, base); }).join('') +
        (s.list.length > UM_LIST_MAX ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:4px">and ' + (s.list.length - UM_LIST_MAX) + ' more in Salesforce.</div>' : '') + '</div>';
    }).join('') + (agentTable ? sectionLabel_('By agent') + agentTable : '')
         : '<div style="font-size:13px;color:' + MAIL.muted + '">Salesforce did not answer this morning, so the unit is not listed.</div>') +
    umLetters_(sid, day) +
    umFFCard_(sid, day) +
    sectionLabel_('Your day as a manager') +
    '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:10px 15px;font-size:13px;line-height:1.6">' +
      UM_CHECKS.map(function (c) { return '<div>&#9675; ' + esc_(c.q) + '</div>'; }).join('') +
      '<div style="color:' + MAIL.muted + ';margin-top:6px">Put a number against each on the page: what you will do today. At 5:30pm you give the actual.</div></div>' +
    btn +
    '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';
  MailApp.sendEmail({ to: to, cc: dayStartCc_(to, sid).join(',') || undefined,
    subject: 'Your unit · ' + name + ' · ' + shortDate_(day) + (book ? ' · ' + nPend + ' pendings, ' + nLate + ' overdue' : ''),
    htmlBody: shell_('Good morning · your unit', name + ' · Unit Manager · ' + prettyDate_(day), body) });
  return true;
}

function umReplyPage_(person, day, error) {
  var sid = String(person.staffId), items = [];
  try { items = JSON.parse(PropertiesService.getScriptProperties().getProperty(umItemsKey_(sid, day)) || '[]'); } catch (e) {}
  var base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var head = { pend: 'Pendings', 'new': 'New business', ret: 'Retention and orphan adoption', other: 'Everything else overdue' };
  var plan = mgrRows_(sid, day, 'plan');
  var groups = ['pend', 'new', 'ret', 'other'].map(function (k) {
    var list = items.filter(function (it) { return it.k === k; });
    if (!list.length) return '';
    return '<div class="card"><div class="bh">' + esc_(head[k]) + '</div>' + list.map(function (it) {
      return '<div style="padding:9px 0;border-top:1px solid #E5E1D6"><div style="font-size:14px"><b>' + esc_(it.a || '') + '</b> · ' + esc_(it.s) +
        (it.due ? ' <span class="br2">· ' + (it.late ? 'overdue since ' : 'due ') + esc_(shortDate_(it.due)) + '</span>' : '') +
        (base ? ' · <a href="' + esc_(base + it.id) + '" target="_blank">open</a>' : '') + '</div>' +
        '<textarea name="c_' + esc_(it.id) + '" rows="2" placeholder="Your comment, posted to Chatter on this task"></textarea></div>';
    }).join('') + '</div>';
  }).join('');
  var checks = '<div class="card"><div class="bh">Your day as a manager · what you will do today</div>' + UM_CHECKS.map(function (c) {
    var r = plan[c.id] || {};
    return '<div style="padding:8px 0;border-top:1px solid #E5E1D6"><div style="font-size:14px">' + esc_(c.q) + '</div>' +
      '<input type="number" min="0" name="p_' + c.id + '" value="' + esc_(r.Planned || '') + '" style="width:90px" placeholder="0"> ' +
      '<input type="text" name="n_' + c.id + '" value="' + esc_(r.Note || '') + '" style="width:calc(100% - 110px)" placeholder="' + esc_(c.note || 'Note') + '"></div>';
  }).join('') + '</div>';
  return replyPage_('Your unit · ' + prettyDate_(day), 'Comment under any task; each comment goes on its Chatter as yours. Then set your numbers for the day. Saving signs you in. Leave blank what needs nothing.',
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(sid, day, 'um') + groups + checks +
    '<button type="submit">Save my comments and my plan</button></form>');
}

function umReplySave_(person, day, p) {
  var sid = String(person.staffId), name = nameFor_(sid), items = [], at = hhmm_(new Date()), done = [];
  try { items = JSON.parse(PropertiesService.getScriptProperties().getProperty(umItemsKey_(sid, day)) || '[]'); } catch (e) {}
  items.forEach(function (it) {
    var txt = String(p['c_' + it.id] || '').trim();
    if (!txt) return;
    var res = 'posted';
    try { sfkInsert_('FeedItem', { ParentId: it.id, Body: 'Unit Manager · ' + name + ' · ' + shortDate_(day) + ' ' + twelve_(at) + '\n\n' + txt }); }
    catch (e) { res = 'NOT SAVED: ' + String(e && e.message || e).slice(0, 140); }
    done.push({ s: (it.a ? it.a + ' · ' : '') + it.s, txt: txt, res: res });
  });
  var rows = UM_CHECKS.map(function (c) {
    return { Item: c.id, Question: c.q, Planned: String(p['p_' + c.id] || '').trim(), Note: String(p['n_' + c.id] || '').trim() };
  }).filter(function (r) { return r.Planned !== '' || r.Note; });
  if (!done.length && !rows.length) return umReplyPage_(person, day, 'Nothing filled in. Comment on a task or set at least one number for your day.');
  if (rows.length) mgrWrite_(sid, day, 'plan', rows);
  var signed = null; try { signed = signInFromPage_(person); } catch (e) {}
  if (sid !== 'ricky') { try { umCopy_(sid, day, 'plan', done, rows); } catch (e) {} }
  return replyPage_('Saved' + (signed ? ' · signed in ' + twelve_(signed.at) : ''), done.length + ' comment' + (done.length === 1 ? '' : 's') + ' on Chatter; your plan for the day is in' + (sid === 'ricky' ? '.' : '. Mr Rampersad has a copy.'),
    '<div class="card ok">' + done.map(function (d) { return '<div class="ln">' + (/^NOT/.test(d.res) ? '&#9888; ' : '&#10003; ') + esc_(d.s) + ' · ' + esc_(d.res) + '</div>'; }).join('') +
    rows.map(function (r) { return '<div class="ln">&#9675; ' + esc_(r.Question) + ': <b>' + esc_(r.Planned || '—') + '</b>' + (r.Note ? ' · ' + esc_(r.Note) : '') + '</div>'; }).join('') + '</div>');
}

/** The copy to the Branch Manager: comments made, and the plan or the account. */
function umCopy_(sid, day, kind, comments, rows) {
  var mgr = managerEmails_();
  if (!mgr.length) return;
  var name = nameFor_(sid), plan = kind === 'eve' ? mgrRows_(sid, day, 'plan') : {};
  var td = 'padding:6px;font-size:12.5px;border-top:1px solid ' + MAIL.line + ';';
  var table = rows.length ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr><td style="padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + '">Manager KPI</td>' +
    (kind === 'eve' ? '<td style="padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right">Planned</td>' : '') +
    '<td style="padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right">' + (kind === 'eve' ? 'Done' : 'Planned') + '</td></tr>' +
    rows.map(function (r) {
      var pl = kind === 'eve' ? String((plan[r.Item] || {}).Planned || '') : '';
      var short = kind === 'eve' && pl !== '' && Number(r.Done || 0) < Number(pl);
      return '<tr><td style="' + td + '">' + esc_(r.Question) + (r.Note ? '<div style="color:' + MAIL.muted + ';font-size:11.5px">' + esc_(r.Note) + '</div>' : '') + '</td>' +
        (kind === 'eve' ? '<td style="' + td + 'text-align:right">' + esc_(pl || '—') + '</td>' : '') +
        '<td style="' + td + 'text-align:right;font-weight:700;' + (short ? 'color:' + MAIL.red : '') + '">' + esc_(kind === 'eve' ? (r.Done || '0') : (r.Planned || '—')) + '</td></tr>';
    }).join('') + '</table>' : '';
  MailApp.sendEmail({ to: mgr.join(','), cc: DAYSTART_CC_DEFAULT,
    subject: (kind === 'eve' ? 'Day accounted · ' : 'Plan received · ') + name + ' · Unit Manager · ' + shortDate_(day) +
      ' · ' + comments.length + ' comment' + (comments.length === 1 ? '' : 's'),
    htmlBody: shell_(kind === 'eve' ? 'The Unit Manager\'s day' : 'The Unit Manager\'s plan', name + ' · ' + prettyDate_(day) + ' · ' + hhmm_(new Date()),
      (table ? sectionLabel_(kind === 'eve' ? 'Planned against done' : 'His plan for the day') + table : '') +
      (comments.length ? sectionLabel_('His comments, now on Chatter') + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:8px 15px">' +
        comments.map(function (c) { return '<div style="font-size:12.5px;padding:5px 0;border-top:1px solid ' + MAIL.line + '"><b>' + esc_(c.s) + '</b><div style="color:' + MAIL.ink + '">' + esc_(c.txt) + '</div></div>'; }).join('') + '</div>' : '')) });
}

// ---- the Unit Manager: 5pm ----------------------------------------------------

/** Eleven o'clock (Ricky, 17 October 2026): "an 11am progress report on what
 *  support he's getting from his team, as well as feedback from what the
 *  agents are doing." Who in the branch has moved his unit's work today and
 *  what is still with whom, then each agent's plan so far. */
function sendUnitManagerProgress_(sid, day) {
  var to = emailFor_(sid);
  if (!to) return false;
  var name = nameFor_(sid), first = String(name).split(' ')[0], book = null;
  try { book = unitBook_(sid, day); } catch (e) {}
  var plan = mgrRows_(sid, day, 'plan'), planned = Object.keys(plan).length;
  var by = {};
  if (book) {
    book.closedToday.forEach(function (t) { var o = t.owner || '—'; (by[o] = by[o] || { closed: 0, open: 0, late: 0 }).closed++; });
    book.open.forEach(function (t) { var o = t.owner || '—'; var x = (by[o] = by[o] || { closed: 0, open: 0, late: 0 }); x.open++; if (t.late) x.late++; });
  }
  var owners = Object.keys(by).sort(function (a, b) { return (by[b].closed - by[a].closed) || (by[b].late - by[a].late) || (by[b].open - by[a].open); });
  var nLate = book ? book.open.filter(function (t) { return t.late; }).length : 0;
  var td = 'padding:6px;font-size:12.5px;border-top:1px solid ' + MAIL.line + ';';
  var th = 'padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right';
  var support = owners.length ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr><td style="' + th + ';text-align:left">With</td><td style="' + th + '">Closed today</td><td style="' + th + '">Open</td><td style="' + th + '">Overdue</td></tr>' +
    owners.slice(0, 10).map(function (o) { var x = by[o];
      return '<tr><td style="' + td + '"><b>' + esc_(o) + '</b></td><td style="' + td + 'text-align:right;color:' + (x.closed ? MAIL.green : MAIL.muted) + '">' + x.closed + '</td>' +
        '<td style="' + td + 'text-align:right">' + x.open + '</td><td style="' + td + 'text-align:right;' + (x.late ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + x.late + '</td></tr>'; }).join('') +
    '</table>' : '';
  var btn = replyButton_(replyUrl_(sid, day, 'um'), planned ? 'Update my plan' : 'Plan my day and sign in', 'Your plan and a comment on anything in your unit; comments go on Chatter. No password.');
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + esc_(first) + ', it is eleven o\'clock. Your progress so far: the support your unit is getting from the branch, and what your agents are doing' +
      (planned ? '.' : '. <b style="color:' + MAIL.red + '">No plan was set this morning.</b>') + ' The account of your day comes at 5:30.</div>' +
    statTiles_([
      { value: book ? book.closedToday.length : '—', label: 'closed in your unit today', color: MAIL.green },
      { value: book ? book.open.length : '—', label: 'still open' },
      { value: book ? nLate : '—', label: 'overdue', color: nLate ? MAIL.red : MAIL.navy },
      { value: planned ? 'yes' : 'no', label: 'your plan today', color: planned ? MAIL.green : MAIL.red }
    ]) + btn +
    (support ? sectionLabel_('Support from the branch · your unit\'s work, by who has it') + support +
      '<div style="font-size:11.5px;color:' + MAIL.muted + ';margin-top:5px">Closed since midnight, and what is still open, by the person it sits with in Salesforce.</div>' : '') +
    (function () { var t = ''; try { t = agentSummaryTable_(agentDaySummary_(day, unitAgents_(sid).filter(function (n) { return n !== name; }))); } catch (e) {}
      return t ? sectionLabel_('Your agents so far') + t + '<div style="font-size:11.5px;color:' + MAIL.muted + ';margin-top:5px">No plan by ' + esc_(twelve_(mmText_(AGENT_ABSENT_AT))) + ' reads as absent.</div>' : ''; })() +
    btn;
  MailApp.sendEmail({ to: to, cc: dayStartCc_(to, sid).join(',') || undefined,
    subject: 'Progress at eleven · ' + name + ' · ' + shortDate_(day) + (book ? ' · unit closed ' + book.closedToday.length + ', ' + nLate + ' overdue' : ''),
    htmlBody: shell_('Your progress at eleven', name + ' · Unit Manager · ' + prettyDate_(day), body) });
  return true;
}

function sendUnitManagerEvening_(sid, day) {
  var to = emailFor_(sid);
  if (!to) return false;
  var name = nameFor_(sid), first = String(name).split(' ')[0], book = null;
  try { book = unitBook_(sid, day); } catch (e) {}
  var base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var plan = mgrRows_(sid, day, 'plan'), planned = Object.keys(plan).length;
  var secs = book ? unitSections_(book) : [];
  var items = [];
  secs.forEach(function (s) { s.list.slice(0, 6).forEach(function (t) { items.push({ id: t.id, s: t.subject, a: t.agent, due: t.due, late: t.late, k: s.k }); }); });
  try { PropertiesService.getScriptProperties().setProperty(umItemsKey_(sid, day) + '_eve', JSON.stringify(items).slice(0, 8900)); } catch (e) {}
  var perAgent = {};
  if (book) book.closedToday.forEach(function (t) { perAgent[t.agent] = (perAgent[t.agent] || 0) + 1; });
  var nLate = book ? book.open.filter(function (t) { return t.late; }).length : 0;
  var btn = replyButton_(replyUrl_(sid, day, 'umeve'), 'Account for my day', 'One page: what you did against each manager KPI, and a comment on anything in your unit. No sign-in.');
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + esc_(first) + ', it is half past five. Account for your day as a manager: what you did against each KPI' +
      (planned ? ', against the plan you set this morning' : ' (no plan was set this morning)') + ', and where your unit stands. It goes to Mr Rampersad.</div>' +
    statTiles_([
      { value: book ? book.closedToday.length : '—', label: 'closed in your unit today', color: MAIL.green },
      { value: book ? book.open.length : '—', label: 'still open' },
      { value: book ? nLate : '—', label: 'overdue', color: nLate ? MAIL.red : MAIL.navy },
      { value: planned, label: 'KPIs planned this morning', color: planned ? MAIL.green : MAIL.red }
    ]) + btn +
    (book && book.closedToday.length ? sectionLabel_('Closed in your unit today') +
      '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.green + ';border-radius:10px;padding:8px 15px;font-size:12.5px">' +
      Object.keys(perAgent).map(function (a) { return '<div style="padding:4px 0;border-top:1px solid ' + MAIL.line + '"><b>' + esc_(a) + '</b> · ' + perAgent[a] + '</div>'; }).join('') + '</div>' : '') +
    (planned ? sectionLabel_('Your plan this morning') + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:8px 15px;font-size:12.5px;line-height:1.6">' +
      UM_CHECKS.filter(function (c) { return plan[c.id]; }).map(function (c) { return '<div>' + esc_(c.q) + ': <b>' + esc_(plan[c.id].Planned || '—') + '</b></div>'; }).join('') + '</div>' : '') +
    (function () { var t = ''; try { t = agentSummaryTable_(agentDaySummary_(day, unitAgents_(sid).filter(function (n) { return n !== name; }))); } catch (e) {}
      return t ? sectionLabel_('Your agents today') + t + '<div style="font-size:11.5px;color:' + MAIL.muted + ';margin-top:5px">No plan by ' + esc_(twelve_(mmText_(AGENT_ABSENT_AT))) + ' reads as absent; no close-off by tomorrow reads as nothing done.</div>' : ''; })() +
    (secs.length && secs[0].list.length ? sectionLabel_('Pendings still open (' + secs[0].list.length + ')') +
      '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.amber + ';border-radius:10px;padding:8px 15px">' +
      secs[0].list.slice(0, 6).map(function (t) { return umTaskLine_(t, day, base); }).join('') + '</div>' : '') +
    btn;
  MailApp.sendEmail({ to: to, cc: dayStartCc_(to, sid).join(',') || undefined,
    subject: 'Account for your day · ' + name + ' · ' + shortDate_(day) + (book ? ' · unit closed ' + book.closedToday.length + ', ' + nLate + ' overdue' : ''),
    htmlBody: shell_('Your day as a manager', name + ' · Unit Manager · ' + prettyDate_(day), body) });
  return true;
}

function umEveReplyPage_(person, day, error) {
  var sid = String(person.staffId), items = [], plan = mgrRows_(sid, day, 'plan'), had = mgrRows_(sid, day, 'eve');
  try { items = JSON.parse(PropertiesService.getScriptProperties().getProperty(umItemsKey_(sid, day) + '_eve') || '[]'); } catch (e) {}
  var base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var checks = '<div class="card"><div class="bh">Your day as a manager · what you did</div>' + UM_CHECKS.map(function (c) {
    var pl = (plan[c.id] || {}).Planned, r = had[c.id] || {};
    return '<div style="padding:8px 0;border-top:1px solid #E5E1D6"><div style="font-size:14px">' + esc_(c.q) +
      (pl !== undefined && pl !== '' ? ' <span class="br2">· planned ' + esc_(pl) + '</span>' : '') + '</div>' +
      '<input type="number" min="0" name="d_' + c.id + '" value="' + esc_(r.Done || '') + '" style="width:90px" placeholder="0"> ' +
      '<input type="text" name="n_' + c.id + '" value="' + esc_(r.Note || '') + '" style="width:calc(100% - 110px)" placeholder="' + esc_(c.note || 'Note') + '"></div>';
  }).join('') + '<div class="bf" style="margin-top:8px">The day in a line or two, for Mr Rampersad:</div><textarea name="summary" rows="3"></textarea></div>';
  var list = items.length ? '<div class="card"><div class="bh">Your unit · comment on anything (goes to Chatter)</div>' + items.map(function (it) {
    return '<div style="padding:9px 0;border-top:1px solid #E5E1D6"><div style="font-size:14px"><b>' + esc_(it.a || '') + '</b> · ' + esc_(it.s) +
      (it.late ? ' <span class="br2">· overdue since ' + esc_(shortDate_(it.due)) + '</span>' : '') + (base ? ' · <a href="' + esc_(base + it.id) + '" target="_blank">open</a>' : '') + '</div>' +
      '<textarea name="c_' + esc_(it.id) + '" rows="2" placeholder="Your comment, posted to Chatter on this task"></textarea></div>';
  }).join('') + '</div>' : '';
  return replyPage_('Your day · ' + prettyDate_(day), 'A number against each KPI, with names where it asks. Mr Rampersad gets the account.',
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(sid, day, 'umeve') + checks + list +
    '<button type="submit">Send my account</button></form>');
}

function umEveReplySave_(person, day, p) {
  var sid = String(person.staffId), name = nameFor_(sid), items = [], at = hhmm_(new Date()), done = [];
  try { items = JSON.parse(PropertiesService.getScriptProperties().getProperty(umItemsKey_(sid, day) + '_eve') || '[]'); } catch (e) {}
  var rows = UM_CHECKS.map(function (c) {
    return { Item: c.id, Question: c.q, Done: String(p['d_' + c.id] || '').trim(), Note: String(p['n_' + c.id] || '').trim() };
  });
  var filled = rows.filter(function (r) { return r.Done !== ''; }).length;
  if (filled < UM_CHECKS.length) return umEveReplyPage_(person, day, 'Put a number against every KPI, 0 where nothing was done. ' + (UM_CHECKS.length - filled) + ' left blank.');
  items.forEach(function (it) {
    var txt = String(p['c_' + it.id] || '').trim();
    if (!txt) return;
    var res = 'posted';
    try { sfkInsert_('FeedItem', { ParentId: it.id, Body: 'Unit Manager · ' + name + ' · ' + shortDate_(day) + ' ' + twelve_(at) + '\n\n' + txt }); }
    catch (e) { res = 'NOT SAVED: ' + String(e && e.message || e).slice(0, 140); }
    done.push({ s: (it.a ? it.a + ' · ' : '') + it.s, txt: txt, res: res });
  });
  var summary = String(p.summary || '').trim();
  if (summary) rows.push({ Item: 'summary', Question: 'The day', Done: '', Note: summary });
  mgrWrite_(sid, day, 'eve', rows);
  try { umCopy_(sid, day, 'eve', done, rows.filter(function (r) { return r.Item !== 'summary'; }).concat(summary ? [{ Item: 'summary', Question: 'In his words', Done: '', Note: summary }] : [])); } catch (e) {}
  return replyPage_('Your day is in', 'Mr Rampersad has the account. Thank you.',
    '<div class="card ok">' + rows.map(function (r) { return '<div class="ln">' + esc_(r.Question) + ': <b>' + esc_(r.Done || '') + '</b>' + (r.Note ? ' · ' + esc_(r.Note) : '') + '</div>'; }).join('') +
    done.map(function (d) { return '<div class="ln">' + (/^NOT/.test(d.res) ? '&#9888; ' : '&#10003; ') + esc_(d.s) + ' · ' + esc_(d.res) + '</div>'; }).join('') + '</div>');
}

// ---- the Branch Manager: 12pm and 6pm -------------------------------------------

/** Today so far, per desk: closed, closed with the owner's note, notes written. */
function deskToday_(day) {
  var users = sfkUsers_() || {}, bySf = {}, ids = [], out = {};
  var who = DAY_MAIL_DESKS.concat(['ricky']);
  who.forEach(function (s) {
    out[s] = { closed: 0, noted: 0, notes: 0, list: [] };
    var id = s === 'ricky' ? bmSfId_() : (users[s] && users[s].id);
    if (id) { bySf[id] = s; ids.push("'" + id + "'"); }
  });
  if (!ids.length) return out;
  var since = sfkUtcAt_(day, 0);
  var closed = sfkQuery_('SELECT Id, OwnerId, Subject FROM Task WHERE OwnerId IN (' + ids.join(',') + ") AND IsClosed = true AND CompletedDateTime >= " + since + " AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') LIMIT 1000");
  sfkQuery_("SELECT ParentId, CreatedById FROM FeedItem WHERE Type = 'TextPost' AND CreatedById IN (" + ids.join(',') + ') AND CreatedDate >= ' + since + ' LIMIT 2000')
    .forEach(function (p) { var s = bySf[p.CreatedById]; if (s) out[s].notes++; });
  var noted = {};
  for (var i = 0; i < closed.length; i += 150) {
    var chunk = closed.slice(i, i + 150).map(function (r) { return "'" + r.Id + "'"; });
    try { sfkQuery_("SELECT ParentId, CreatedById FROM FeedItem WHERE Type = 'TextPost' AND ParentId IN (" + chunk.join(',') + ') LIMIT 2000')
      .forEach(function (p) { noted[p.ParentId + '|' + p.CreatedById] = 1; }); } catch (e) {}
  }
  closed.forEach(function (r) {
    var s = bySf[r.OwnerId]; if (!s) return;
    out[s].closed++; if (noted[r.Id + '|' + r.OwnerId]) out[s].noted++;
    out[s].list.push(shorten_(r.Subject, 80));
  });
  return out;
}

function sendBranchManagerProgress_(day, which) {
  var mgr = managerEmails_();
  if (!mgr.length) return false;
  var props = PropertiesService.getScriptProperties();
  var today = {}, w = { mine: [], ask: [], ignored: [], byOwner: {} }, sfOk = true;
  try { today = deskToday_(day); w = bmWaiting_(day); saveBmItems_(day, w); } catch (e) { sfOk = false; }
  var att = {};
  try { attendanceReport_(day).forEach(function (x) { att[x.sid] = x; }); } catch (e) {}
  var moves = 0;
  try { moves = (hrRows_(MOVES, true) || []).filter(function (r) { return isoDay_(r.Date) === day && /^OK/.test(String(r.Result || '')); }).length; } catch (e) {}

  var td = 'padding:6px;font-size:12.5px;border-top:1px solid ' + MAIL.line + ';';
  var th = 'padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right';
  var rows = DAY_MAIL_DESKS.map(function (s) {
    var d = today[s] || { closed: 0, noted: 0, notes: 0 }, a = att[s] || {};
    var target = Number(props.getProperty('intel_target_' + s + '_' + day) || 0);
    var planned = !!props.getProperty('daystart_plan_' + s + '_' + day);
    var pct = target ? Math.round(100 * d.closed / target) : null;
    return '<tr><td style="' + td + '"><b>' + esc_(nameFor_(s)) + '</b><div style="font-size:11px;color:' + (a.color || MAIL.muted) + '">' + esc_(a.st || '') + '</div></td>' +
      '<td style="' + td + 'text-align:right;' + (planned ? '' : 'color:' + MAIL.red + ';font-weight:700') + '">' + (planned ? 'yes' : 'no') + '</td>' +
      '<td style="' + td + 'text-align:right">' + d.closed + (target ? ' / ' + target : '') + (pct != null ? ' <span style="color:' + (pct >= 50 ? MAIL.green : MAIL.red) + '">(' + pct + '%)</span>' : '') + '</td>' +
      '<td style="' + td + 'text-align:right;' + (d.closed > d.noted ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + d.noted + '</td>' +
      '<td style="' + td + 'text-align:right">' + d.notes + '</td></tr>';
  }).join('');
  var table = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr><td style="' + th + ';text-align:left">Desk</td><td style="' + th + '">Plan saved</td><td style="' + th + '">Closed / target</td><td style="' + th + '">With note</td><td style="' + th + '">Notes written</td></tr>' + rows + '</table>';

  var um = UM_DESKS.map(function (s) {
    var pl = mgrRows_(s, day, 'plan'), ev = mgrRows_(s, day, 'eve');
    var line = Object.keys(ev).length ? 'day accounted' : (Object.keys(pl).length ? 'plan set, day not yet accounted' : 'no plan set');
    return '<div style="font-size:12.5px;padding:4px 0;border-top:1px solid ' + MAIL.line + '"><b>' + esc_(nameFor_(s)) + '</b> · Unit Manager · <span style="color:' + (Object.keys(pl).length ? MAIL.green : MAIL.red) + '">' + esc_(line) + '</span></div>';
  }).join('');

  var me = today.ricky || { closed: 0, noted: 0, notes: 0, list: [] };
  var label = which === 'eve' ? 'Three o\'clock · close out the day' : 'Eleven o\'clock · progress';
  var answer = replyButton_(replyUrl_('ricky', day, 'bm'), 'Respond and log', 'Reply on Chatter to anything waiting on you, close your own with a note, and log what you did today.');
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + (which === 'eve' ? 'Three o\'clock, Mr Rampersad. Time to close out the day: where the branch stands at the close, and where you stand.' : 'Eleven o\'clock, Mr Rampersad. Where the team stands so far (support, the BMA, the Unit Manager and the agents), what is urgent, and where you stand. Comment on anything as you go.') + '</div>' +
    statTiles_([
      { value: sfOk ? me.closed : '—', label: 'you closed today', color: MAIL.green },
      { value: sfOk ? me.notes : '—', label: 'your Chatter today' },
      { value: sfOk ? w.mine.length : '—', label: 'yours still due', color: w.mine.length ? MAIL.amber : MAIL.navy },
      { value: sfOk ? w.ask.length : '—', label: 'notes asking you', color: w.ask.length ? MAIL.red : MAIL.navy }
    ]) + answer +
    sectionLabel_('The team today') + table +
    '<div style="font-size:11.5px;color:' + MAIL.muted + ';margin-top:5px">Closed today against the morning\'s suggested target; closed with the owner\'s own note. ' + (moves ? moves + ' task' + (moves === 1 ? '' : 's') + ' moved between desks today.' : '') + '</div>' +
    (um ? sectionLabel_('Unit Managers') + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:6px 15px">' + um + '</div>' : '') +
    (function () { var t = ''; try { if (agentMode_() !== 'off') t = agentSummaryTable_(agentDaySummary_(day)); } catch (e) {}
      return t ? sectionLabel_('Agents today' + (agentMode_() === 'preview' ? ' (preview mode: agents are not being mailed yet)' : '')) + t : ''; })() +
    (w.ask.length ? sectionLabel_('Still waiting on your Chatter (' + w.ask.length + ')') +
      '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.red + ';border-radius:10px;padding:8px 15px">' +
      w.ask.slice(0, 6).map(function (a) { return '<div style="font-size:12.5px;padding:5px 0;border-top:1px solid ' + MAIL.line + '"><b>' + esc_(a.by) + '</b> on ' + esc_(a.subject) + '<div style="color:' + MAIL.muted + '">"' + esc_(a.said) + '"</div></div>'; }).join('') + '</div>' : '') +
    (me.list.length ? sectionLabel_('What you closed today') + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.green + ';border-radius:10px;padding:8px 15px;font-size:12.5px">' +
      me.list.slice(0, 10).map(function (s) { return '<div style="padding:3px 0">&#10003; ' + esc_(s) + '</div>'; }).join('') + '</div>' : '') +
    answer;
  MailApp.sendEmail({ to: mgr.join(','), cc: DAYSTART_CC_DEFAULT,
    subject: label + ' · Branch Manager · ' + shortDate_(day) + (sfOk ? ' · you closed ' + me.closed + ', ' + w.ask.length + ' asking you' : ''),
    htmlBody: shell_(label + ' · the branch and you', 'Branch Manager · ' + prettyDate_(day) + ' · ' + hhmm_(new Date()), body) });
  return true;
}

/** From the editor. */
function sendUnitManagerNow() { var d = todayISO_(); return UM_DESKS.map(function (s) { return s + ': ' + sendUnitManagerMorning_(s, d); }).join(', '); }
function sendUnitManagerProgressNow() { var d = todayISO_(); return UM_DESKS.map(function (s) { return s + ': ' + sendUnitManagerProgress_(s, d); }).join(', '); }
function sendUnitManagerEveningNow() { var d = todayISO_(); return UM_DESKS.map(function (s) { return s + ': ' + sendUnitManagerEvening_(s, d); }).join(', '); }
function sendBranchManagerProgressNow() { return sendBranchManagerProgress_(todayISO_(), minutesOf_(hhmm_(new Date())) >= 15 * 60 ? 'eve' : 'mid'); }
function checkUnitAgents() { var out = UM_DESKS.map(function (s) { return s + ': ' + unitAgents_(s).join(', '); }).join('\n'); Logger.log(out); return out; }


// ---------------------------------------------------------------------------
//  The agents' day: a morning e-mail to plan, a five o'clock e-mail to close
//
//  Ricky, 15 October 2026: "can an agent be sent a morning and afternoon email
//  to account for their day; if there is no response it will be assumed they
//  are absent ... the email should show what staff is or will be actioning
//  today and by whom and allow them to comment, which will be in the Chatter,
//  also what are their plans today, and pull in insights on their premium
//  dues, their pendings etc from the portfolio ... aged fact finds ... in the
//  afternoon at 5pm they get another email to click to close off the day; if
//  they don't respond it will show as absent or nothing done ... for agents
//  their respective manager copied, and sales support."
//
//  Where it reads:
//    who the agents are, and their manager   Branch Intelligence's directory
//                                            (the Access tabs: role, e-mail,
//                                            manager e-mail, unit)
//    what the branch is doing for them       Salesforce tasks whose Agent is
//                                            them, open and due by today
//    premium dues, lapses, pendings stuck    Branch Intelligence's cache
//    fact finds                              Salesforce Fact Finding
//                                            Interviews, by the agent's e-mail
//
//  Script Property AGENT_DAY: 'preview' (the default) sends a sample of three
//  agents' mail to the Branch Manager only, marked with who it was for;
//  'live' sends to the agents; 'off' stops it.
// ---------------------------------------------------------------------------

/* Agents work six to six (Ricky, 17 October 2026): the morning check in the
   e-mail half an hour before, a progress report at midday, and the evening
   sign-off half an hour before six. */
var AGENT_AM_AT = 5 * 60 + 30;     // 5:30am
var AGENT_MD_AT = 12 * 60;         // midday progress
var AGENT_PM_AT = 17 * 60 + 30;    // 5:30pm
var AGENT_PER_RUN = 8;             // agents a ten-minute run; the rest follow
var AGENT_PREVIEW_MAX = 3;         // in preview, three samples a day to the Branch Manager
var AGENT_ABSENT_AT = 10 * 60 + 30; // no plan by 10:30 reads as absent
var AGENT_LIST_MAX = 8;

/* ───────────────────────── FactFind360 ─────────────────────────
 *  factfind360.com holds the branch's live fact finds; the Salesforce
 *  Fact_Finding_Interviews object stopped in March 2026. The wall feed
 *  (?action=wall&k=) is what the television polls: per-agent counts for
 *  the week, month and year, money picked up, pipeline, and the review
 *  queue. Script Properties FACTFIND_WALL_URL / FACTFIND_WALL_KEY win;
 *  the defaults are the ones printed in wall.html itself. */
var FF360 = {
  URL: 'https://script.google.com/macros/s/AKfycbx776ORwmwhm2u4vx2YGQPC6bRR9gTQ-Y-Yc1up0FNGkCKGaQdet-APT1PJsrAxxJ3dsQ/exec',
  KEY: '8ef87867eacb4812b455fb3124dde161', CACHE_SEC: 600
};
function ff360Feed_() {
  var cache = CacheService.getScriptCache();
  try { var hit = cache.get('ff360'); if (hit) return JSON.parse(hit); } catch (e) {}
  var props = PropertiesService.getScriptProperties();
  var url = String(props.getProperty('FACTFIND_WALL_URL') || FF360.URL), key = String(props.getProperty('FACTFIND_WALL_KEY') || FF360.KEY);
  try {
    var res = UrlFetchApp.fetch(url + '?action=wall&k=' + encodeURIComponent(key) + '&_=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return null;
    var d = JSON.parse(res.getContentText()); if (!d || d.ok === false) return null;
    try { cache.put('ff360', JSON.stringify(d).slice(0, 95000), FF360.CACHE_SEC); } catch (e) {}
    return d;
  } catch (e) { Logger.log('FactFind360 unreachable: ' + e); return null; }
}
/** One agent's FactFind360 line: { week, month, year, pickedUp, pipeline, apps } or null. */
function ff360Agent_(feed, names) {
  if (!feed) return null;
  var nk = function (s) { return String(s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim(); };
  var want = {}; (names || []).forEach(function (n) { if (n) want[nk(n)] = 1; });
  var pick = function (list) { var hit = null; (list || []).forEach(function (x) { if (!hit && want[nk(x.name)]) hit = x; }); return hit; };
  var w = pick(feed.leaders), m = pick(feed.monthLeaders), y = pick(feed.yearLeaders);
  if (!w && !m && !y) return { week: 0, month: 0, year: 0, pickedUp: 0, pipeline: 0, apps: 0, known: false };
  var n = function (x, f) { return x ? Number(x[f] || 0) : 0; };
  return { week: n(w, 'count'), month: n(m, 'count'), year: n(y, 'count'),
           pickedUp: Math.max(n(w, 'pickedUp'), n(m, 'pickedUp'), n(y, 'pickedUp')),
           pipeline: Math.max(n(w, 'pipeline'), n(m, 'pipeline'), n(y, 'pipeline')),
           apps: Math.max(n(w, 'apps'), n(m, 'apps'), n(y, 'apps')), known: true };
}
function ff360Money_(v) { v = Number(v || 0); return v >= 1000 ? '$' + Math.round(v / 1000).toLocaleString() + 'k' : '$' + Math.round(v).toLocaleString(); }
function checkFactFind360() {
  var d = ff360Feed_();
  if (!d) { Logger.log('FactFind360: not reachable (check FACTFIND_WALL_URL / FACTFIND_WALL_KEY)'); return; }
  Logger.log('FactFind360 as of ' + (d.asOf || '?') + ' · week leaders: ' + (d.leaders || []).length + ' · month: ' + (d.monthLeaders || []).length + ' · year: ' + (d.yearLeaders || []).length);
  (d.yearLeaders || []).slice(0, 40).forEach(function (x) { Logger.log('  ' + x.name + ' · year ' + x.count + ' · picked up ' + ff360Money_(x.pickedUp) + ' · pipeline ' + ff360Money_(x.pipeline)); });
  if (d.queue) Logger.log('Review queue: ' + JSON.stringify(d.queue));
}

var AGENT_METRICS = [
  { id: 'calls',   q: 'Calls made' },
  { id: 'appts',   q: 'Appointments set' },
  { id: 'ff',      q: 'Fact finds done' },
  { id: 'close',   q: 'Closing interviews' },
  { id: 'apps',    q: 'Applications written' },
  { id: 'dues',    q: 'Premium due and lapse clients called' },
  { id: 'pend',    q: 'Pendings moved (requirements chased or delivered)' }
];
var AGDAY = { must: ['Date', 'Agent', 'Kind', 'Item'], name: 'Agent Day',
              head: ['Date', 'Agent', 'Email', 'Manager', 'Kind', 'Item', 'Question', 'Planned', 'Done', 'Note', 'At'] };

function agentMode_() {
  var m = String(PropertiesService.getScriptProperties().getProperty('AGENT_DAY') || 'preview').toLowerCase();
  return m === 'live' || m === 'off' ? m : 'preview';
}

function agSlug_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

/** Every active agent with an e-mail, keyed a-<name>. Managers and staff are not agents here. */

/* ───────────────── Branch workbooks: Skill Bank, Query Pal, FY27 goals ─────────────────
 *  The agents log in everywhere with their agent code, and the Agent Skill Bank
 *  is the one roster that carries code, unit, e-mail and Active. Query Pal holds
 *  every client query with the agent on it and the staff member it is assigned to.
 *  The fact-find workbook holds each advisor's FY27 goal plan (the year began
 *  1 October 2026) and their weekly check-ins. Script Properties override the ids. */
var BOOKS = {
  SKILL: { id: '1-NGk9kWAlmx6BA1DwNjsddwV6IMiTXQNZ61InwyVC0s', tab: 'Agent Skill Bank', households: 'Household Assignments', responses: 'Client Responses' },
  QPAL:  { id: '1jrbysTBHwOkWiWJUKVI92z4jikdZDf4MYmK7aHRvmmI', tab: 'Queries' },
  FF:    { id: '1iytBbnETQFRmkveDSxadjsAfN07aMTW9E2slcA5qaWI', plans: 'FY27 Goal Plans', checks: 'FY27 Check-ins' },
  LOG:   { id: '1VjVoMMxVRsMsXQHmIAYmmK8h8P4Poiqad1yE9a6gVRk', prep: 'MAIL PREP', bu: 'BU' },
  FY_START: '2026-10-01', CACHE_SEC: 900
};
function bookId_(k) { try { return PropertiesService.getScriptProperties().getProperty('BOOK_' + k) || BOOKS[k].id; } catch (e) { return BOOKS[k].id; } }
/** Rows of a tab as objects keyed by header (trimmed). Cached per tab. */
var _bookMemo = {};
function bookRows_(k, tab) {
  var ck = 'book_' + k + '_' + tab;
  if (_bookMemo[ck]) return _bookMemo[ck];
  try { var hit = CacheService.getScriptCache().get(ck); if (hit) return (_bookMemo[ck] = JSON.parse(hit)); } catch (e) {}
  var out = [];
  try {
    var sh = SpreadsheetApp.openById(bookId_(k)).getSheetByName(tab);
    if (sh && sh.getLastRow() > 1) {
      var v = sh.getDataRange().getValues(), h = v[0].map(function (x) { return String(x || '').trim(); });
      for (var i = 1; i < v.length; i++) {
        if (!v[i].some(function (c) { return c !== '' && c != null; })) continue;
        var o = {}; h.forEach(function (c, j) { if (!c) return; var val = v[i][j] instanceof Date ? Utilities.formatDate(v[i][j], CONFIG.TZ, 'yyyy-MM-dd HH:mm') : v[i][j]; if (o[c] === undefined || o[c] === '' || o[c] === null) o[c] = val; });
        out.push(o);
      }
    }
  } catch (e) { Logger.log('bookRows_ ' + k + '/' + tab + ': ' + e); return []; }
  try { var js = JSON.stringify(out); if (js.length < 95000) CacheService.getScriptCache().put(ck, js, BOOKS.CACHE_SEC); } catch (e) {}
  _bookMemo[ck] = out;
  return out;
}
function bkNk_(s) { return String(s || '').toLowerCase().replace(/^[a-z]{1,3}[\s-]*\d{3,6}\s*-\s*/, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim(); }
/** The Skill Bank roster: { code, name, role, unit, email, active, manager } by name key. */
function skillBank_() {
  var out = {};
  bookRows_('SKILL', BOOKS.SKILL.tab).forEach(function (r) {
    var raw = String(r['Agent'] || ''), code = String(r['Agent no.'] || '').trim();
    var name = raw.replace(/^[A-Za-z]{1,3}[\s-]*\d{3,6}\s*-\s*/, '').trim(); if (!name) return;
    var email = String(r['Email'] || '').trim().toLowerCase();
    var role = String(r['Role'] || '').trim(), unit = String(r['Unit'] || '').trim();
    var active = !/^(no|inactive|false|0)$/i.test(String(r['Active'] || 'Active').trim());
    out[bkNk_(name)] = { code: code, name: name, role: role, unit: unit, email: email, active: active,
      isAgent: /^agent$/i.test(role), isUM: /unit manager/i.test(role), isStaff: /staff|support|assistant/i.test(role) };
  });
  return out;
}
/** Open Query Pal queries, oldest first: { ref, when, days, client, agent, assigned, subject, dept, type }. */
function openQueries_() {
  var day = todayISO_();
  return bookRows_('QPAL', BOOKS.QPAL.tab).filter(function (r) { return r['Reference'] && !/closed/i.test(String(r['Status'] || '')); })
    .map(function (r) {
      var when = String(r['Timestamp'] || ''), d = when ? daysBetween_(sfkDay_(when), day) : null;
      return { ref: String(r['Reference'] || ''), when: when, days: d, client: String(r['Client/Name'] || ''), agent: String(r['Agent'] || ''),
        assigned: String(r['Assigned To'] || ''), subject: String(r['Subject'] || ''), dept: String(r['Department'] || ''), type: String(r['Query Type'] || ''), status: String(r['Status'] || '') };
    }).sort(function (a, b) { return (b.days || 0) - (a.days || 0); });
}
function sfkDay_(s) { var m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2); return String(s || '').slice(0, 10); }
function daysBetween_(a, b) { try { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); } catch (e) { return null; } }
/** FY27 goal plan and latest check-in for one advisor (by name or code). */
function goalFor_(name, code) {
  var plans = bookRows_('FF', BOOKS.FF.plans), checks = bookRows_('FF', BOOKS.FF.checks), nk = bkNk_(name), plan = null, last = null;
  plans.forEach(function (r) { if ((code && String(r['Code'] || '').trim() === code) || bkNk_(r['Name']) === nk) plan = r; });
  checks.forEach(function (r) { if ((code && String(r['Code'] || '').trim() === code) || bkNk_(r['Name']) === nk) if (!last || Number(r['Week']) >= Number(last['Week'])) last = r; });
  if (!plan) return null;
  var n = function (k) { return Number(plan[k] || 0) || 0; };
  var weeks = Math.max(1, Math.round(daysBetween_(BOOKS.FY_START, todayISO_()) / 7));
  return { api: n('API Goal'), fyc: n('FYC Goal'), apps: n('Apps Goal'), contactsWk: n('Contacts / wk'), apptsWk: n('Appointments / wk'), ffWk: n('Fact finds / wk'), appsWk: n('Apps / wk'),
    title: String(plan['Title Goal'] || ''), submitted: String(plan['Submitted At'] || '').slice(0, 10), weeksIn: weeks,
    paceApi: Math.round(n('API Goal') * Math.min(1, weeks / 52)),
    last: last ? { week: last['Week'], contacts: Number(last['Contacts'] || 0), appts: Number(last['Appointments'] || 0), ff: Number(last['Fact finds'] || 0), apps: Number(last['Apps'] || 0), win: String(last['Win'] || ''), way: String(last['In The Way'] || ''), help: String(last['Help'] || '') } : null };
}
/** Orphan work assigned to an agent: households assigned, and client call-backs waiting. */
function orphanFor_(name) {
  var nk = bkNk_(name), hh = 0, calls = 0;
  bookRows_('SKILL', BOOKS.SKILL.households).forEach(function (r) { if (bkNk_(r['Agent assigned']) === nk) hh++; });
  bookRows_('SKILL', BOOKS.SKILL.responses).forEach(function (r) { if (bkNk_(r['Assigned to']) === nk && /open/i.test(String(r['Status'] || ''))) calls++; });
  return { households: hh, callbacks: calls };
}

/* ─────────────────── All the branch's sources, into each person's day ───────────────────
 *  Ricky, 15–16 October 2026: the plan each person gets must read every place
 *  work arrives, not only Salesforce. Each workbook below is read live at send
 *  time (cached ten minutes) and turned into a short card for the person whose
 *  name is on the row. Ids can be overridden with Script Property BOOK_<KEY>. */
BOOKS.GROUP  = { id: '1BljjYLcj-pYbrekW2NT_7x_489ey90diCy_MM6T0PHg', tasks: 'Group Tasks', responses: 'Group Responses', register: 'Group Register', milestones: 'Group Milestones' };
BOOKS.CLAIMS = { id: '1IZm2dRTk9zpwJa2Oh4n2mMFZ6FaR0vXYieZEFOYq3s8', tab: 'Claims' };
BOOKS.MOTOR  = { id: '1joDyJMrF0RrQCqt3A6iuFjbC2uzXB7P1ZhOxqyyjAkM', tab: 'Motor' };
BOOKS.PPM    = { id: '12uHVzd9o5k50KDZEM3UybjFI7gGf3MRM67zZeezxaBA', letters: 'Letters', escalations: 'Escalations' };
BOOKS.EB     = { id: '1v6iDusLyaX-1HNP-hKShO83W6IYDozJucuyr-1MwlYI', requests: 'Requests' };
BOOKS.SKILL.calls = 'Call List';
var SRC_DESK = { claims: 'elizabeth', eb: 'kamla' };   // Script Properties CLAIMS_DESK, EB_DESK override
function srcDesk_(k) { try { return PropertiesService.getScriptProperties().getProperty(k.toUpperCase() + '_DESK') || SRC_DESK[k]; } catch (e) { return SRC_DESK[k]; } }
/** Any date the sheets hold, as yyyy-MM-dd: ISO, M/D/YYYY, or D/M/YYYY when dmy is set. */
function anyIso_(v, dmy) {
  var s = String(v || '').trim(); if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if (!m) return '';
  var a = dmy ? m[2] : m[1], b = dmy ? m[1] : m[2];
  return m[3] + '-' + ('0' + a).slice(-2) + '-' + ('0' + b).slice(-2);
}
function firstOf_(s) { return bkNk_(s).split(' ')[0] || ''; }
function sameDesk_(cell, sid) { var f = firstOf_(cell), me = firstOf_(nameFor_(sid)); return !!f && f === me; }
function srcCard_(title, color, lines, more) {
  if (!lines.length) return '';
  return sectionLabel_(title) + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + color + ';border-radius:10px;padding:8px 15px;margin-bottom:12px">' +
    lines.map(function (h) { return '<div style="font-size:12.5px;line-height:1.45;padding:5px 0;border-top:1px solid ' + MAIL.line + '">' + h + '</div>'; }).join('') +
    (more ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:4px">' + more + '</div>' : '') + '</div>';
}
function lateTag_(iso, day) { if (!iso) return ''; var d = daysBetween_(iso, day); return d > 0 ? ' <span style="color:' + MAIL.red + ';font-weight:700">· ' + d + 'd overdue</span>' : d === 0 ? ' <span style="color:' + MAIL.amber + '">· due today</span>' : ' <span style="color:' + MAIL.muted + '">· due ' + esc_(shortDate_(iso)) + '</span>'; }

/** The staff member's cards: call list, group clients, claims, log book, benefits requests. */
function branchCards_(sid, day) {
  var out = '';
  // 1. The client call list (Service Questionnaires · Call List)
  try {
    var calls = bookRows_('SKILL', BOOKS.SKILL.calls).filter(function (r) { return sameDesk_(r['Caller'], sid); });
    if (calls.length) {
      var open = calls.filter(function (r) { return !String(r['Done'] || '').trim(); });
      var back = open.filter(function (r) { return String(r['Call-back'] || '').trim(); });
      var why = {}; open.forEach(function (r) { var k = String(r['Call for'] || 'Call').trim(); why[k] = (why[k] || 0) + 1; });
      var top = Object.keys(why).sort(function (a, b) { return why[b] - why[a]; }).slice(0, 3).map(function (k) { return esc_(k) + ' <b>' + why[k] + '</b>'; }).join(' · ');
      out += srcCard_('Your client call list (' + open.length + ' of ' + calls.length + ' still to call)', MAIL.gold,
        [ '<b>' + (calls.length - open.length) + '</b> done · <b>' + open.length + '</b> to go' + (top ? ' · ' + top : ''),
          back.length ? '<b style="color:' + MAIL.red + '">' + back.length + ' call-back' + (back.length === 1 ? '' : 's') + ' promised</b> and not yet done: these first' : '' ].filter(String),
        'Work top to bottom on your tab of Client Support calls. Mark Done as each one is made.');
    }
  } catch (e) {}
  // 2. Group clients (Group Client Management · Group Tasks, Group Responses)
  try {
    var gt = bookRows_('GROUP', BOOKS.GROUP.tasks).filter(function (r) { return sameDesk_(r['Owner'], sid) && /^y/i.test(String(r['Open'] || '')) ; });
    var since = shiftDays_(day, -14);
    var gr = bookRows_('GROUP', BOOKS.GROUP.responses).filter(function (r) { return sameDesk_(r['Staff'], sid) && /change|notours/i.test(String(r['Verdict'] || '')) && anyIso_(r['When']) >= since; });
    var lines = [];
    gt.sort(function (a, b) { return String(anyIso_(a['Due'])).localeCompare(String(anyIso_(b['Due']))); }).slice(0, 5).forEach(function (r) {
      lines.push('<b>' + esc_(shorten_(r['Group'], 32)) + '</b> · ' + esc_(shorten_(r['Subject'], 70)) + lateTag_(anyIso_(r['Due']), day)); });
    gr.slice(0, 4).forEach(function (r) {
      lines.push('<b style="color:' + MAIL.red + '">Client said "' + esc_(r['Verdict']) + '"</b> · ' + esc_(shorten_(r['Group'], 28)) + ' · ' + esc_(shorten_(r['Task'], 50)) + (r['Note'] ? ' · <i>' + esc_(shorten_(r['Note'], 80)) + '</i>' : '') + ': reply and correct the task'); });
    var late = gt.filter(function (r) { var d = anyIso_(r['Due']); return d && d < day; }).length;
    out += srcCard_('Group clients · ' + gt.length + ' open with you' + (late ? ', ' + late + ' overdue' : ''), MAIL.navy, lines,
      gt.length > 5 ? 'and ' + (gt.length - 5) + ' more on the group register.' : '');
  } catch (e) {}
  // 3. Claims payment pending (Claims), for the claims desk
  try {
    if (sid === srcDesk_('claims')) {
      var pend = bookRows_('CLAIMS', BOOKS.CLAIMS.tab).filter(function (r) { return /pending/i.test(String(r['Status'] || '')); });
      if (pend.length) {
        var byG = {}, oldest = '';
        pend.forEach(function (r) { var g = String(r['GROUP NAME'] || 'No group').trim() || 'No group'; byG[g] = (byG[g] || 0) + 1; var d = anyIso_(r['Service Date'], true); if (d && (!oldest || d < oldest)) oldest = d; });
        out += srcCard_('Health claims payment pending (' + pend.length + ')', MAIL.amber,
          [ Object.keys(byG).map(function (g) { return esc_(g) + ' <b>' + byG[g] + '</b>'; }).join(' · '),
            oldest ? 'Oldest service date <b>' + esc_(shortDate_(oldest)) + '</b> (' + daysBetween_(oldest, day) + ' days): chase it with EB Customer Care today' : '' ].filter(String), '');
      }
    }
  } catch (e) {}
  // 4. Log book: documents verified by this desk and not yet sent
  try {
    var mb = mailbagToday_(day), me = firstOf_(nameFor_(sid)), n = 0;
    Object.keys(mb.backlog).forEach(function (w) { if (firstOf_(w) === me) n += mb.backlog[w]; });
    if (n) out += srcCard_('Log book · documents you verified, not yet sent (' + n + ')', n > 5 ? MAIL.red : MAIL.amber,
      [ 'Logged in the last ' + MAILBAG.BACKLOG_DAYS + ' days with no Date Sent. Hand them to <b>' + esc_(nameFor_(mailbagRouter_(day, {}).router).split(' ')[0]) + '</b> for this week\'s bag, or put the Date Sent in the log book.' ], '');
  } catch (e) {}
  // 5. Employee benefits requests (Employee Benefits · Requests), for the benefits desk
  try {
    if (sid === srcDesk_('eb')) {
      var rq = bookRows_('EB', BOOKS.EB.requests).filter(function (r) { return /^new$/i.test(String(r['Status'] || '').trim()); });
      if (rq.length) {
        var blank = rq.filter(function (r) { return !String(r['Company'] || '').trim(); }).length;
        out += srcCard_('Employee benefits requests still New (' + rq.length + ')', MAIL.red,
          rq.filter(function (r) { return String(r['Company'] || '').trim(); }).slice(0, 4).map(function (r) {
            return '<b>' + esc_(r['Company']) + '</b> · ' + esc_(shorten_(r['Benefits requested'], 60)) + ' · chased <b>' + esc_(String(r['Chasers sent'] || 0)) + '</b> times, received ' + esc_(shortDate_(anyIso_(r['Received']))); })
            .concat(blank ? ['<b style="color:' + MAIL.red + '">' + blank + ' with no company name</b> are still being chased: close them or complete them'] : []), 'Move each to Contacted or Quoted on the Requests tab once it is moving.');
      }
    }
  } catch (e) {}
  // 6. Group milestones in the next 60 days (conversions at 65, missing birth dates), for the group's owner
  try {
    var owners = {}; bookRows_('GROUP', BOOKS.GROUP.register).forEach(function (r) { owners[bkNk_(r['Group'])] = r['Owner in Salesforce']; });
    var horizon = shiftDays_(day, 60);
    var ms = bookRows_('GROUP', BOOKS.GROUP.milestones).filter(function (r) { var d = anyIso_(r['Date']); return sameDesk_(owners[bkNk_(r['Group'])], sid) && d && d >= day && d <= horizon && !String(r['Task'] || '').trim(); });
    out += srcCard_('Group members reaching a milestone in 60 days (' + ms.length + ')', MAIL.navy,
      ms.slice(0, 4).map(function (r) { return esc_(r['Person']) + ' · ' + esc_(shorten_(r['Group'], 28)) + ' · ' + esc_(r['Kind'] === 'convert65' ? 'turns 65: conversion letter' : r['Kind']) + ' on ' + esc_(shortDate_(anyIso_(r['Date']))) + ' · no task yet'; }),
      ms.length > 4 ? 'and ' + (ms.length - 4) + ' more. Log a task for each.' : 'Log a task for each.');
  } catch (e) {}
  return out;
}

/** The performance letters (Productive Performance Management): every one, or only a unit's. */
function ppmLetters_(names) {
  var want = names ? {} : null; (names || []).forEach(function (n) { want[bkNk_(n)] = 1; });
  return bookRows_('PPM', BOOKS.PPM.letters).filter(function (r) { return r['Letter ID'] && (!want || want[bkNk_(r['Agent Name'])]) && !/complet|closed|resolved/i.test(String(r['Status'] || '')); });
}
function ppmCard_(list, day, title) {
  if (!list.length) return '';
  var unopened = list.filter(function (r) { return /assigned/i.test(String(r['Status'] || '')); });
  var esc = {}; try { bookRows_('PPM', BOOKS.PPM.escalations).forEach(function (e) { if (!String(e['Resolved Date'] || '').trim()) esc[e['Letter ID']] = e; }); } catch (e) {}
  var lines = list.slice().sort(function (a, b) { return String(anyIso_(a['Due Date'])).localeCompare(String(anyIso_(b['Due Date']))); }).slice(0, 6).map(function (r) {
    var e = esc[r['Letter ID']];
    return '<b>' + esc_(r['Agent Name']) + '</b> · ' + esc_(r['Performance Period']) + ' · ' + esc_(r['Status']) + lateTag_(anyIso_(r['Due Date']), day) + (e ? ' · <b style="color:' + MAIL.red + '">' + esc_(e['Current Status']) + '</b>' : ''); });
  return srcCard_(title + ' (' + list.length + ' open' + (unopened.length ? ', ' + unopened.length + ' never opened' : '') + ')', MAIL.red, lines, list.length > 6 ? 'and ' + (list.length - 6) + ' more.' : '');
}
/** The Branch Manager's extra cards at 5am. */
function bmBranchCards_(day) {
  var out = '';
  try { out += ppmCard_(ppmLetters_(null), day, 'Performance letters'); } catch (e) {}
  try { out += qpMailCard_('ricky', day); } catch (e) {}
  try {
    var seen = {}, waiting = bookRows_('SKILL', BOOKS.SKILL.responses).filter(function (r) {
      if (!/open/i.test(String(r['Status'] || '')) || String(r['Assigned to'] || '').trim()) return false;
      var t = String(r['Token'] || '') + '|' + String(r['Response'] || ''); if (seen[t]) return false; seen[t] = 1; return true; });
    var clients = {}; waiting.forEach(function (r) { clients[String(r['Token'] || '')] = 1; });
    if (waiting.length) {
      var kinds = {}; waiting.forEach(function (r) { var k = String(r['Response'] || 'response'); kinds[k] = (kinds[k] || 0) + 1; });
      out += srcCard_('Orphan clients who answered, waiting for you to name an agent (' + Object.keys(clients).length + ' clients)', MAIL.red,
        [ Object.keys(kinds).sort(function (a, b) { return kinds[b] - kinds[a]; }).slice(0, 5).map(function (k) { return esc_(k) + ' <b>' + kinds[k] + '</b>'; }).join(' · '),
          'Assign on the Ricky assigns tab: the agent gets the brief and the client the call they asked for.' ], '');
    }
  } catch (e) {}
  try {
    var calls = bookRows_('SKILL', BOOKS.SKILL.calls), by = {};
    calls.forEach(function (r) { var c = firstOf_(r['Caller']); if (!c) return; by[c] = by[c] || { n: 0, d: 0 }; by[c].n++; if (String(r['Done'] || '').trim()) by[c].d++; });
    var ks = Object.keys(by); if (ks.length) out += srcCard_('Client call list · progress', MAIL.gold, [ks.map(function (c) { return '<b>' + esc_(c.charAt(0).toUpperCase() + c.slice(1)) + '</b> ' + by[c].d + ' of ' + by[c].n; }).join(' · ')], '');
  } catch (e) {}
  try {
    var q = openQueries_(), late = q.filter(function (x) { return x.days > 3; });
    if (q.length) out += srcCard_('Query Pal · ' + q.length + ' open, ' + late.length + ' past 3 days', late.length ? MAIL.red : MAIL.amber,
      q.slice(0, 5).map(function (x) { return esc_(x.ref.split('/').slice(0, 4).join('/')) + ' · ' + esc_(shorten_(x.subject || x.type, 50)) + ' · ' + esc_(String(x.assigned || 'unassigned').split(' ')[0]) + ' · <b>' + x.days + 'd</b>'; }), '');
  } catch (e) {}
  try {
    var mb = mailbagToday_(shiftDays_(day, -1)), rt = mailbagRouter_(day, {});
    out += srcCard_('Mailbag', MAIL.navy, ['<b>' + esc_(nameFor_(rt.router).split(' ')[0]) + '</b> routes it this week · <b>' + mb.backlogN + '</b> logged and not sent' + (mb.oldest ? ', oldest ' + esc_(shortDate_(mb.oldest)) : '')], '');
  } catch (e) {}
  return out;
}
/* ─────────── Fact finds and goals, for the managers (16 Oct 2026) ───────────
 *  Ricky: the agents' FactFind360 work and FY27 goals feed the agents' own
 *  mornings; the Unit Manager sees his unit's, the Branch Manager the branch's,
 *  so each can guide in the morning and comment to Chatter. */
function teamFFCard_(names, title, day, limit) {
  var feed = null; try { feed = ff360Feed_(); } catch (e) {}
  var sb = {}; try { sb = skillBank_(); } catch (e) {}
  var codeOf = function (n) { var p = sb[bkNk_(n)]; return p && p.code ? String(p.code) : ''; };
  var rows = [], noPlan = [], noFF = [], behind = [], help = [];
  (names || []).forEach(function (n) {
    if (!n) return;
    var f = ff360Agent_(feed, [n]) || { week: 0, month: 0, year: 0, pickedUp: 0, known: false };
    var g = null; try { g = goalFor_(n, codeOf(n)); } catch (e) {}
    var first = String(n).split(' ')[0];
    if (!g) noPlan.push(first);
    if (feed && !f.week) noFF.push(first);
    if (g && g.paceApi && f.pickedUp < g.paceApi) behind.push(first);
    if (g && g.last && (g.last.help || g.last.way)) help.push('<b>' + esc_(first) + '</b>: ' + esc_(shorten_(g.last.help || g.last.way, 70)));
    rows.push({ n: n, f: f, g: g });
  });
  if (!rows.length) return '';
  rows.sort(function (a, b) { return (b.f.month - a.f.month) || (b.f.year - a.f.year); });
  var td = 'padding:6px;font-size:12px;border-top:1px solid ' + MAIL.line + ';';
  var th = function (h, r) { return '<td style="padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + (r ? ';text-align:right' : '') + '">' + h + '</td>'; };
  var shown = rows.slice(0, limit || 40);
  var table = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px;margin-bottom:10px"><tr>' +
    th('Agent') + th('FF wk', 1) + th('FF mth', 1) + th('FF yr', 1) + th('Picked up', 1) + th('Pace', 1) + th('Check-in', 1) + '</tr>' +
    shown.map(function (r) {
      var g = r.g, f = r.f, low = g && g.paceApi && f.pickedUp < g.paceApi;
      return '<tr><td style="' + td + '">' + esc_(r.n) + '</td>' +
        '<td style="' + td + 'text-align:right;' + (feed && !f.week ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + f.week + '</td>' +
        '<td style="' + td + 'text-align:right">' + f.month + '</td><td style="' + td + 'text-align:right">' + f.year + '</td>' +
        '<td style="' + td + 'text-align:right;' + (low ? 'color:' + MAIL.red + ';font-weight:700' : g ? 'color:' + MAIL.green + ';font-weight:700' : '') + '">' + ff360Money_(f.pickedUp) + '</td>' +
        '<td style="' + td + 'text-align:right">' + (g ? ff360Money_(g.paceApi) : '<span style="color:' + MAIL.amber + '">no goals</span>') + '</td>' +
        '<td style="' + td + 'text-align:right">' + (g && g.last ? 'wk ' + esc_(String(g.last.week)) : '—') + '</td></tr>';
    }).join('') + '</table>' +
    (rows.length > shown.length ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin:-4px 0 10px">and ' + (rows.length - shown.length) + ' more on the FactFind360 wall.</div>' : '');
  var flags = [];
  if (noFF.length) flags.push('<b style="color:' + MAIL.red + '">No fact find this week (' + noFF.length + ')</b>: ' + esc_(noFF.slice(0, 12).join(', ')) + (noFF.length > 12 ? ' …' : ''));
  if (behind.length) flags.push('<b style="color:' + MAIL.red + '">Behind API pace (' + behind.length + ')</b>: ' + esc_(behind.slice(0, 12).join(', ')) + (behind.length > 12 ? ' …' : ''));
  if (noPlan.length) flags.push('<b style="color:' + MAIL.amber + '">No FY27 goal plan (' + noPlan.length + ')</b>: ' + esc_(noPlan.slice(0, 12).join(', ')) + (noPlan.length > 12 ? ' …' : ''));
  help.slice(0, 6).forEach(function (h) { flags.push('Asked for help · ' + h); });
  return sectionLabel_(title) + table + srcCard_('Who to guide this morning', MAIL.gold, flags.length ? flags : ['Everyone has a fact find this week and is on pace.'],
    'FY27 began 1 October: week ' + Math.max(1, Math.round(daysBetween_(BOOKS.FY_START, day) / 7)) + ' of 52. Comment on their tasks from the button above: it goes to Chatter as yours.');
}
function umFFCard_(sid, day) { try { return teamFFCard_(unitAgents_(sid), 'Your unit · fact finds and FY27 goals', day, 30); } catch (e) { return ''; } }
function bmFFCard_(day) {
  try {
    var ap = agentPeople_(), names = Object.keys(ap).map(function (k) { return ap[k].agentName || ap[k].name; });
    return teamFFCard_(names, 'Branch · fact finds and FY27 goals', day, 25);
  } catch (e) { return ''; }
}
/* ─────────── The managers' day builder (16 Oct 2026) ───────────
 *  Ricky: "this is to be our day builder ... is this done for us as well?"
 *  The Branch Manager and the Unit Manager get what the desks get: their day
 *  in their own time blocks, each block filled with what is outstanding for
 *  it, "start here", and one button that plans the day and signs them in.  */
var MGR_BLOCK_RULES = [
  { re: /recruit|licens|staff/i,               keys: ['Lic/Staffing/SA/HR', 'recruit', 'interview', 'licence', 'orphans', 'letters'] },
  { re: /field|production|pipeline|activity/i, keys: ['Opportunity', 'field', 'own', 'perf', 'noff', 'behind'] },
  { re: /develop|training/i,                   keys: ['Training', 'coach', 'help'] },
  { re: /persist|pending|own book/i,           keys: ['Pendings', 'Renewa/PDl/Bill', 'Servicing', 'Claims/ Mat', 'persist', 'pendings'] },
  { re: /escal|report|branch team/i,           keys: ['Reporting', 'escal', 'ask', 'ignored', 'query', 'mailbag'] }
];
/** Which of the person's blocks a kind of work belongs in: the first block whose focus matches the rule that names it. */
function mgrBlockFor_(blocks, key) {
  var ids = Object.keys(blocks), hit = '';
  MGR_BLOCK_RULES.forEach(function (r) {
    if (hit || r.keys.indexOf(key) < 0) return;
    ids.forEach(function (b) { if (!hit && r.re.test(blocks[b].focus + ' ' + (blocks[b].kpi || ''))) hit = b; });
  });
  return hit || ids.filter(function (b) { return b !== 'EVE'; }).slice(-1)[0];
}
/** Fact-find flags for a set of agents: no fact find this week, behind pace, asked for help. */
function ffFlags_(names) {
  var feed = null; try { feed = ff360Feed_(); } catch (e) {}
  var sb = {}; try { sb = skillBank_(); } catch (e) {}
  var out = { noff: [], behind: [], help: [], noplan: [] };
  (names || []).forEach(function (n) {
    var p = sb[bkNk_(n)], g = null; try { g = goalFor_(n, p && p.code ? String(p.code) : ''); } catch (e) {}
    var f = ff360Agent_(feed, [n]) || {}, first = String(n).split(' ')[0];
    if (feed && !f.week) out.noff.push(first);
    if (g && g.paceApi && Number(f.pickedUp || 0) < g.paceApi) out.behind.push(first);
    if (!g) out.noplan.push(first);
    if (g && g.last && (g.last.help || g.last.way)) out.help.push(first + ': ' + shorten_(g.last.help || g.last.way, 60));
  });
  return out;
}
/** The day, block by block. items: [{key, html}] placed by key; returns the HTML. */
function mgrDayCard_(sid, day, items, intro) {
  var sch = scheduleFor_(sid), blocks = sch.blocks || {}, by = {};
  Object.keys(blocks).forEach(function (b) { by[b] = []; });
  items.forEach(function (it) { var b = it.block || mgrBlockFor_(blocks, it.key); (by[b] = by[b] || []).push(it); });
  var first3 = [];
  Object.keys(blocks).forEach(function (b) { by[b].forEach(function (it) { if (it.top && first3.length < 3) first3.push(it); }); });
  if (first3.length < 3) Object.keys(blocks).forEach(function (b) { by[b].forEach(function (it) { if (!it.top && first3.length < 3 && it.late) first3.push(it); }); });
  var start = first3.length ? '<div style="background:' + MAIL.navy + ';color:#fff;border-radius:10px;padding:12px 16px;margin:10px 0 12px">' +
    '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:' + MAIL.soft + '">Start here</div>' +
    first3.map(function (it, i) { return '<div style="font-size:13.5px;line-height:1.5;padding:4px 0">' + (i + 1) + '. ' + it.html.replace(/ <a [^>]*>open &rarr;<\/a>/, '') + '</div>'; }).join('') + '</div>' : '';
  var cap = Object.keys(blocks).length > 1 ? 7 : 12;
  var cards = Object.keys(blocks).map(function (b) {
    var x = blocks[b], list = by[b] || [];
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (list.some(function (i) { return i.late; }) ? MAIL.red : list.length ? MAIL.amber : MAIL.green) +
      ';border-radius:10px;padding:11px 15px;margin-bottom:10px">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.gold + '">' + esc_(x.time) + ' · ' + esc_(x.focus) + '</div>' +
      '<div style="font-size:11.5px;color:' + MAIL.muted + ';margin:2px 0 4px">Today\'s KPI: ' + esc_(x.kpi || x.focus) + '</div>' +
      (list.length ? list.slice(0, cap).map(function (it) { return '<div style="font-size:12.5px;line-height:1.45;padding:5px 0;border-top:1px solid ' + MAIL.line + '">' + it.html + '</div>'; }).join('') +
        (list.length > cap ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:3px">and ' + (list.length - cap) + ' more below.</div>' : '')
        : '<div style="font-size:12.5px;color:' + MAIL.green + ';padding-top:4px">Nothing outstanding. Use the day for your own KPIs.</div>') + '</div>';
  }).join('');
  return sectionLabel_('Your day · ' + esc_(sch.hours || '')) +
    '<div style="font-size:13px;line-height:1.55;margin-bottom:6px">' + intro + '</div>' + start + cards;
}
/** Akaash: his unit's outstanding work and his manager KPIs, placed in his blocks. */
function umDayItems_(sid, day, book) {
  var items = [], base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var open = function (id) { return base ? ' <a href="' + esc_(base + id) + '" style="color:' + MAIL.navy + ';font-weight:700;font-size:12px">open &rarr;</a>' : ''; };
  if (book) book.open.slice().sort(function (a, b) { return String(a.due || '9999').localeCompare(String(b.due || '9999')); }).forEach(function (t) {
    if (!(t.late || t.due === day || t.ty === 'Pendings' || t.touched >= 14)) return;
    items.push({ key: t.ty || 'Servicing', late: t.late, top: t.late && t.ty === 'Pendings',
      html: '<b>' + esc_(t.agent || '—') + '</b> · ' + esc_(t.subject) + lateTag_(t.due, day) + (t.touched >= 14 ? ' <span style="color:' + MAIL.amber + '">· untouched ' + t.touched + ' days</span>' : '') + open(t.id) });
  });
  var fl = ffFlags_(unitAgents_(sid));
  if (fl.noff.length) items.push({ key: 'noff', top: true, html: '<b style="color:' + MAIL.red + '">Fact finds:</b> none this week from ' + esc_(fl.noff.join(', ')) + '. Book one with each.' });
  if (fl.behind.length) items.push({ key: 'field', html: '<b style="color:' + MAIL.red + '">Joint field work:</b> behind API pace: ' + esc_(fl.behind.join(', ')) + '. Go out with one of them.' });
  fl.help.forEach(function (h) { items.push({ key: 'coach', top: true, html: '<b>Asked for help</b> · ' + esc_(h) }); });
  if (fl.noplan.length) items.push({ key: 'perf', html: '<b style="color:' + MAIL.amber + '">No FY27 goal plan:</b> ' + esc_(fl.noplan.join(', ')) + '. Sit with them and get it in.' });
  UM_CHECKS.forEach(function (c) { if (['recruit', 'interview', 'licence', 'persist', 'own'].indexOf(c.id) > -1) items.push({ key: c.id, html: '&#9675; ' + esc_(c.q) + ' <span style="color:' + MAIL.muted + '">· set your number on the page</span>' }); });
  return items;
}
/** The Branch Manager: his own work, what waits on him, and the branch's open items, placed in his blocks. */
function bmDayItems_(day, w) {
  var items = [], base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var open = function (id) { return base ? ' <a href="' + esc_(base + id) + '" style="color:' + MAIL.navy + ';font-weight:700;font-size:12px">open &rarr;</a>' : ''; };
  (w.mine || []).forEach(function (t) { items.push({ key: t.ty || 'Reporting', late: t.late, top: t.late && /Staffing|Claims/.test(t.ty || ''), html: esc_(t.subject) + lateTag_(t.due, day) + open(t.id) }); });
  if ((w.ask || []).length) items.push({ key: 'ask', top: true, late: true, html: '<b style="color:' + MAIL.red + '">' + w.ask.length + ' notes asking you</b> on Chatter: ' + esc_(w.ask.slice(0, 3).map(function (a) { return String(a.by).split(' ')[0] + ' on ' + shorten_(a.subject, 40); }).join('; ')) + (w.ask.length > 3 ? ' …' : '') });
  if ((w.ignored || []).length) items.push({ key: 'ignored', late: true, html: '<b style="color:' + MAIL.red + '">' + w.ignored.length + ' of your instructions</b> with no note from the desk: ' + esc_(Object.keys(w.byOwner || {}).map(function (s) { return String(nameFor_(s)).split(' ')[0] + ' ' + w.byOwner[s]; }).join(', ')) });
  try {
    var seen = {}, n = 0; bookRows_('SKILL', BOOKS.SKILL.responses).forEach(function (r) {
      if (!/open/i.test(String(r['Status'] || '')) || String(r['Assigned to'] || '').trim()) return; var t = String(r['Token'] || ''); if (!seen[t]) { seen[t] = 1; n++; } });
    if (n) items.push({ key: 'orphans', top: true, html: '<b>' + n + ' orphan clients</b> answered and wait for you to name an agent. Assign on the Ricky assigns tab.' });
  } catch (e) {}
  try { var q = openQueries_().filter(function (x) { return x.days > 3; }); if (q.length) items.push({ key: 'query', html: '<b>Query Pal</b> · ' + q.length + ' open past 3 days, oldest ' + q.reduce(function (a, x) { return Math.max(a, x.days); }, 0) + ' days' }); } catch (e) {}
  try {
    var ap = agentPeople_(), fl = ffFlags_(Object.keys(ap).map(function (k) { return ap[k].agentName || ap[k].name; }));
    if (fl.behind.length) items.push({ key: 'behind', html: '<b style="color:' + MAIL.red + '">Behind API pace:</b> ' + esc_(fl.behind.join(', ')) });
    if (fl.noff.length) items.push({ key: 'noff', html: '<b style="color:' + MAIL.red + '">No fact find this week (' + fl.noff.length + '):</b> ' + esc_(fl.noff.slice(0, 10).join(', ')) + (fl.noff.length > 10 ? ' …' : '') });
    fl.help.forEach(function (h) { items.push({ key: 'help', html: '<b>Asked for help</b> · ' + esc_(h) }); });
  } catch (e) {}
  return items;
}
/* ─────────── Command centre (16 Oct 2026) ───────────
 *  Ricky: "make it easy so you could look at it, what's not getting attention,
 *  look at the block, and with a click of a button it can be reassigned ...
 *  asking for feedback." One page, read live when it opens, of everything in
 *  Salesforce and in the branch's own workbooks that has gone quiet. Each row
 *  can be moved to another desk, given a new date, or sent a question; every
 *  move is a Salesforce write with a Chatter note, so nothing leaves the record.
 *  Work that lives only in a sheet (an approval, a log-book line, a receipt)
 *  becomes a Salesforce task in the chosen person's name, so it is tracked
 *  and closed like everything else.  */
BOOKS.APPROVE  = { id: '1KMHY_PZraICOMjI4h26Jv98RrkrZ0CwXXWrx1U-yFn0', tab: 'Form responses' };
BOOKS.DELIVERY = { id: '1EAc0X0648Im2HQJMB-jTVNZFWr5Y1hKh9Ok2a_472uo', log: 'Log Book', transmittals: 'Transmittals', deliveries: 'Deliveries' };
BOOKS.PETTY    = { id: '1lpOZD0hv31dyd9EtD_vrqEPg7Gm78AsUtwezXeCUe2o', tab: 'Form responses' };
var CMD = { QUIET_DAYS: 5, MAX: 60, APPROVE_DAYS: 30 };
function cmdKey_(sid, day) { return 'cmd_items_' + sid + '_' + day; }
/** Who work can be moved to: the desks Salesforce knows, plus the Unit Manager if he is a user. */
function cmdTargets_() {
  var u = {}; try { u = sfkUsers_() || {}; } catch (e) {}
  return DAY_MAIL_DESKS.concat(UM_DESKS, ['ricky']).filter(function (s, i, a) { return a.indexOf(s) === i && u[s]; })
    .map(function (s) { return { sid: s, id: u[s].id, name: nameFor_(s) }; });
}
/** Everything that has gone quiet, for the Branch Manager (scope 'all'), the BMA ('desks') or a Unit Manager ('unit'). */
function cmdItems_(sid, day) {
  var scope = sid === 'ricky' ? 'all' : UM_DESKS.indexOf(sid) > -1 ? 'unit' : 'desks', items = [];
  var push = function (o) { items.push(o); };
  // 1. Salesforce: the desks' open work nobody has touched, worst first.
  if (scope !== 'unit') {
    try {
      var ob = sfkOpenBook_(day) || {};
      Object.keys(ob).forEach(function (desk) {
        if (scope === 'desks' && desk === 'ricky') return;
        Object.keys(ob[desk]).forEach(function (ty) {
          ob[desk][ty].forEach(function (t) {
            if (!(t.touched >= CMD.QUIET_DAYS && (t.late || !t.due))) return;
            push({ k: 'sf', id: t.id, src: 'Salesforce', key: ty, who: desk, title: t.subject, age: t.touched, st: t.status || '', client: t.account || '',
                   why: 'untouched ' + t.touched + ' days' + (t.late ? ', overdue since ' + shortDate_(t.due) : ''), agent: t.agent || '' });
          });
        });
      });
    } catch (e) {}
  } else {
    try {
      var bk = unitBook_(sid, day);
      bk.open.forEach(function (t) { if (t.touched >= CMD.QUIET_DAYS || t.late) push({ k: 'sf', id: t.id, src: 'Salesforce', key: t.ty || 'Servicing', who: '', ownerName: t.owner, title: t.subject, age: t.touched, st: t.status || '', client: t.account || '',
        why: (t.late ? 'overdue since ' + shortDate_(t.due) + ', ' : '') + 'untouched ' + t.touched + ' days', agent: t.agent }); });
    } catch (e) {}
  }
  if (scope === 'all') {
    // 2. His instructions with no note from the desk.
    try { var w = bmWaiting_(day);
      w.ignored.forEach(function (t) { push({ k: 'sf', id: t.id, src: 'Your instruction', key: 'ignored', who: '', ownerName: t.owner, title: t.subject, age: daysBetween_(t.due, day), why: 'no note from ' + String(t.owner).split(' ')[0] + ' since ' + shortDate_(t.due) }); });
    } catch (e) {}
  }
  if (scope !== 'unit') {
    // 3. Query Pal past three days.
    try { openQueries_().filter(function (q) { return q.days > 3; }).forEach(function (q) {
      push({ k: 'sheet', id: 'qp:' + q.ref, src: 'Query Pal', key: 'query', who: '', ownerName: q.assigned, title: q.ref + ' · ' + (q.subject || q.type), age: q.days, st: q.status || '', ref: q.ref, client: q.client || '', why: q.days + ' days open, ' + (q.assigned ? 'with ' + q.assigned : 'unassigned') }); });
    } catch (e) {}
    // 4. Cash and cheque approvals with no BM decision.
    try { bookRows_('APPROVE', BOOKS.APPROVE.tab).forEach(function (r, i) {
      var d = anyIso_(r['Submission Date']); if (!d || daysBetween_(d, day) > CMD.APPROVE_DAYS || String(r['BM Cash Approval'] || '').trim()) return;
      var who = String(r['Agent Name'] || ''), cl = (String(r['Client Name - First Name'] || '') + ' ' + String(r['Client Name - Last Name'] || '')).trim();
      push({ k: 'sheet', id: 'ap:' + (r['Submission ID'] || i), src: 'BM approval', key: 'ask', who: '', ownerName: who, client: cl, title: String(r['Approval Type'] || 'Approval') + ' · ' + cl + ' · ' + String(r['Policy Number'] || ''), age: daysBetween_(d, day), why: 'no BM decision recorded' + (r['Reason For Cheque/Cash Collection'] ? ', reason: ' + r['Reason For Cheque/Cash Collection'] : '') });
    }); } catch (e) {}
    // 5. Log book lines logged and not sent on.
    try { bookRows_('DELIVERY', BOOKS.DELIVERY.log).forEach(function (r) {
      if (!/logged|received/i.test(String(r['Status'] || '')) || String(r['Sent At'] || '').trim()) return;
      var d = anyIso_(r['Logged At']); var age = d ? daysBetween_(d, day) : 0; if (age < 1) return;
      push({ k: 'sheet', id: 'lb:' + r['Line Id'], src: 'Log book', key: 'mailbag', who: '', ownerName: String(r['Logged By'] || ''), client: String(r['Client'] || ''), title: String(r['Document'] || '') + ' · ' + String(r['Client'] || '') + ' · ' + String(r['Policy #'] || '') + ' → ' + String(r['Department'] || ''), age: age, why: 'logged ' + shortDate_(d) + ', not sent' + (r['Salesforce Task'] ? '' : ', no task') });
    }); } catch (e) {}
    // 6. Petty cash spent with no receipt, or not reviewed.
    try { bookRows_('PETTY', BOOKS.PETTY.tab).forEach(function (r) {
      if (!/spent/i.test(String(r['Request Type'] || ''))) return;
      var d = anyIso_(r['Date']) || anyIso_(r['Submission Date']); if (!d || daysBetween_(d, day) > 45) return;
      var noRec = !String(r['Copy of Receipt Upload'] || '').trim(), unrev = !String(r['Cash Management'] || '').trim();
      if (!noRec && !unrev) return;
      push({ k: 'sheet', id: 'pc:' + (r['Submission ID'] || d), src: 'Petty cash', key: 'escal', who: '', ownerName: String(r['Staff Spending Cash'] || ''), title: '$' + (r['Amount Spent'] || '?') + ' · ' + String(r['Purpose of Transaction'] || '').replace(/\s+/g, ' ').slice(0, 70), age: daysBetween_(d, day), why: noRec ? 'no receipt uploaded' : 'not reviewed' });
    }); } catch (e) {}
  }
  // 7. Performance letters past due (the managers').
  if (scope !== 'desks') {
    try { (ppmLetters_(scope === 'unit' ? unitAgents_(sid) : null) || []).forEach(function (l) {
      var due = anyIso_(l['Due Date']); if (!due || due >= day) return;
      push({ k: 'sheet', id: 'pl:' + l['Letter ID'], src: 'Performance letter', key: 'perf', who: '', ownerName: String(l['Agent Name'] || ''), title: String(l['Agent Name'] || '') + ' · ' + String(l['Performance Period'] || '') + ' · ' + String(l['Letter Type'] || 'letter'), age: daysBetween_(due, day), why: 'past due since ' + shortDate_(due),
             st: String(l['Status'] || ''), ref: String(l['Letter ID'] || ''), opened: anyIso_(l['Date Opened']), mgr: String(l['Manager Email'] || ''), period: String(l['Performance Period'] || ''), drive: String(l['Drive File ID'] || '') });
    }); } catch (e) {}
  }
  items.sort(function (a, b) { return (b.age || 0) - (a.age || 0); });
  return items.slice(0, CMD.MAX);
}
function cmdButton_(sid, day) {
  return replyButton_(replyUrl_(sid, day, 'cmd'), 'What is not getting attention', 'One page, read live: everything gone quiet in Salesforce and the branch sheets. Move it, re-date it or ask for feedback, a tap each.');
}
/* ─────────── Command centre: status, history, advice (18 Oct 2026) ───────────
 *  Ricky: "the ability to close off task ... pull in the field status so I can
 *  close. Also add the Chatter history, if there are any comments, and build
 *  in further intelligence."
 *  Every row now carries:
 *    · its STATUS, set from the record's own list: Salesforce's Task status
 *      picklist (read from TaskStatus, so it is the org's list and knows which
 *      ones close), and the performance letter's own statuses from its sheet.
 *      Closing needs a note — a closed task without a note is not closed — and
 *      a task where the client asked for an agent cannot be closed at all.
 *    · its HISTORY: the Chatter on a task (posts and replies, newest first);
 *      the e-mail trail, the escalation, the agent's response and your last
 *      comment on a letter; the comments on a query.
 *    · what the system SUGGESTS, read from that history: it looks done, nobody
 *      has written, your note is unanswered, the desk is not in, the agent has
 *      left, the letter was never opened. A summary at the top counts each.  */
var CMD_STATUS_FALLBACK = [{ v: 'Not Started', closed: false }, { v: 'In Progress', closed: false },
  { v: 'Waiting on someone else', closed: false }, { v: 'Deferred', closed: false }, { v: 'Completed', closed: true }];
var CMD_DONE_RE = /\b(done|completed?|processed|submitted|sent|resolved|issued|paid|received|uploaded|closed|signed|delivered|confirmed)\b/i;
var CMD_NOT_DONE_RE = /\b(not|no|yet|pending|waiting|awaiting|still|follow(ing)? up|chase|will)\b/i;
var CMD_AGENT_WANTED_RE = /\b(wants?|needs?|request(s|ed|ing)?|asking for|asked for|would like)\b[^.]{0,40}\b(agent|advisor|adviser)\b/i;
var PPM_CLOSE_STATUS = 'Completed';

/** Salesforce's own Task status list, with the ones that close a task marked. */
function sfTaskStatuses_() {
  var c = CacheService.getScriptCache();
  try { var hit = c.get('sf_task_statuses'); if (hit) return JSON.parse(hit); } catch (e) {}
  var out = [];
  try {
    out = sfkQuery_('SELECT MasterLabel, IsClosed FROM TaskStatus ORDER BY SortOrder')
      .map(function (r) { return { v: String(r.MasterLabel || ''), closed: !!r.IsClosed }; }).filter(function (s) { return s.v; });
  } catch (e) {}
  if (!out.length) return CMD_STATUS_FALLBACK;
  try { c.put('sf_task_statuses', JSON.stringify(out), 21600); } catch (e) {}
  return out;
}
function sfStatusClosed_(v) {
  var hit = sfTaskStatuses_().filter(function (s) { return s.v === v; })[0];
  return hit ? hit.closed : /complet|closed/i.test(String(v || ''));
}
/** The letter statuses the sheet itself uses, and Completed to close one. */
function ppmStatuses_() {
  var seen = {}, out = [];
  bookRows_('PPM', BOOKS.PPM.letters).map(function (r) { return String(r['Status'] || '').trim(); }).concat([PPM_CLOSE_STATUS])
    .forEach(function (s) { var k = s.toLowerCase(); if (s && !seen[k]) { seen[k] = 1; out.push({ v: s, closed: /complet|closed|resolved/i.test(s) }); } });
  return out;
}
function ppmClosing_(s) { return /complet|closed|resolved/i.test(String(s || '')); }

/** Chatter on a set of tasks: posts and replies, newest first, with names. */
function cmdChatter_(ids) {
  var out = {}; if (!ids.length) return out;
  var names = {};
  try { var u = sfkUsers_() || {}; Object.keys(u).forEach(function (s) { names[u[s].id] = nameFor_(s); }); } catch (e) {}
  var rows = [];
  for (var i = 0; i < ids.length; i += 150) {
    var inList = ids.slice(i, i + 150).map(function (x) { return "'" + String(x).replace(/'/g, '') + "'"; }).join(',');
    try {
      sfkQuery_("SELECT ParentId, CreatedById, CreatedDate, Body FROM FeedItem WHERE Type = 'TextPost' AND ParentId IN (" + inList + ') ORDER BY CreatedDate DESC LIMIT 1000')
        .forEach(function (r) { rows.push({ p: r.ParentId, by: r.CreatedById, at: r.CreatedDate, text: r.Body }); });
    } catch (e) {}
    try {
      sfkQuery_('SELECT ParentId, CreatedById, CreatedDate, CommentBody FROM FeedComment WHERE ParentId IN (' + inList + ') ORDER BY CreatedDate DESC LIMIT 1000')
        .forEach(function (r) { rows.push({ p: r.ParentId, by: r.CreatedById, at: r.CreatedDate, text: r.CommentBody, reply: true }); });
    } catch (e) {}
  }
  var unknown = {};
  rows.forEach(function (r) { if (r.by && !names[r.by]) unknown[r.by] = 1; });
  var uk = Object.keys(unknown);
  if (uk.length) {
    try { sfkQuery_('SELECT Id, Name FROM User WHERE Id IN (' + uk.slice(0, 150).map(function (x) { return "'" + x + "'"; }).join(',') + ')')
      .forEach(function (r) { names[r.Id] = r.Name; }); } catch (e) {}
  }
  rows.forEach(function (r) {
    var t = String(r.text || '').replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' ').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim();
    if (!t) return;
    var l = sfLocal_(r.at);
    (out[r.p] = out[r.p] || []).push({ at: String(r.at || ''), day: l ? l.day : '', by: names[r.by] || 'Someone', byId: r.by || '', text: t, reply: !!r.reply });
  });
  Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }); });
  return out;
}

/** Everything the performance-letter workbook knows about each letter. */
function ppmIntel_() {
  var out = {};
  var get = function (id) { id = String(id || '').trim(); return id ? (out[id] = out[id] || { trail: 0, last: null, resp: '', bm: null, esc: null, weekly: '' }) : null; };
  try { bookRows_('PPM', 'Communication Trail').forEach(function (r) {
    var x = get(r['Letter ID']); if (!x) return; x.trail++;
    var d = anyIso_(r['Sent Date']);
    if (d && (!x.last || d >= x.last.d)) x.last = { d: d, type: String(r['Email Type'] || 'e-mail'), status: String(r['Status'] || ''), to: String(r['Recipient Name'] || '') };
  }); } catch (e) {}
  try { bookRows_('PPM', 'Responses').concat(bookRows_('PPM', 'Initial Reviews')).forEach(function (r) {
    var x = get(r['Letter ID']); if (!x) return; var d = anyIso_(r['Submitted Date']) || 'on file'; if (!x.resp || d > x.resp) x.resp = d;
  }); } catch (e) {}
  try { bookRows_('PPM', 'BM Comments').forEach(function (r) {
    var x = get(r['Letter ID']); if (!x || !String(r['Comment'] || '').trim()) return; var d = anyIso_(r['Comment Date']);
    if (!x.bm || d >= x.bm.d) x.bm = { d: d, text: String(r['Comment']) };
  }); } catch (e) {}
  try { bookRows_('PPM', BOOKS.PPM.escalations).forEach(function (r) {
    if (String(r['Resolved Date'] || '').trim()) return; var x = get(r['Letter ID']); if (!x) return;
    x.esc = { status: String(r['Current Status'] || 'escalated'), count: Number(r['Reminder Count'] || 0), next: anyIso_(r['Next Action Date']) };
  }); } catch (e) {}
  try { bookRows_('PPM', 'Weekly Updates').forEach(function (r) {
    var x = get(r['Letter ID']); if (!x) return; var d = anyIso_(r['Week Ending']) || anyIso_(r['Submitted Date']); if (d > x.weekly) x.weekly = d;
  }); } catch (e) {}
  return out;
}
/** A Query Pal reference's comments, newest first, keyed by the reference number. */
function qpCode_(ref) { var m = String(ref || '').match(/^\s*([A-Z]+\/\d{4}\/\d+)/i); return m ? m[1].toUpperCase() : String(ref || '').trim().toUpperCase(); }
function qpComments_() {
  var out = {};
  try { bookRows_('QPAL', 'Comments').forEach(function (r) {
    var k = qpCode_(r['Reference']), t = String(r['Comment'] || '').trim(); if (!k || !t) return;
    (out[k] = out[k] || []).push({ day: anyIso_(r['When']), at: String(r['When'] || ''), by: String(r['Author'] || ''), text: t });
  }); } catch (e) {}
  Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return String(b.day).localeCompare(String(a.day)); }); });
  return out;
}
/** A person's name from a Guardian address: the roster first, then the address itself. */
function nameFromEmail_(email) {
  var e = normEmail_(email || ''); if (!e) return '';
  var p = roster_().filter(function (x) { return x.email && normEmail_(x.email) === e; })[0];
  if (p) return p.name;
  return e.split('@')[0].split(/[._-]/).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
}
/** "Q2 2026" is older than the last finished quarter. */
function cmdOldPeriod_(period, day) {
  var m = String(period || '').match(/Q([1-4])\s*(\d{4})/i); if (!m) return false;
  var y = Number(day.slice(0, 4)), q = Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1;   // this quarter
  var lastY = q === 1 ? y - 1 : y, lastQ = q === 1 ? 4 : q - 1;                             // the last finished one
  return Number(m[2]) * 4 + Number(m[1]) < lastY * 4 + lastQ;
}

/** What the record says to do with one item. { tone: done|act|warn|info, tag, text } or null. */
function cmdAdvise_(it, ctx) {
  var first = function (s) { return String(s || '').split(' ')[0]; };
  if (it.k === 'sf') {
    var ch = ctx.chatter[it.id] || [], last = ch[0];
    var said = it.title + ' ' + ch.slice(0, 6).map(function (c) { return c.text; }).join(' ');
    if (CMD_AGENT_WANTED_RE.test(said)) return { tone: 'warn', tag: 'agent', text: 'The client asked for an agent, so this task cannot be closed. Give the client an agent and note who.' };
    if (it.who && ctx.away[it.who]) return { tone: 'act', tag: 'away', text: first(nameFor_(it.who)) + ' is not in today: move it to whoever is in.' };
    if (it.agent && ctx.left(it.agent)) return { tone: 'act', tag: 'orphan', text: it.agent + ' is no longer active: the client is an orphan. Assign an agent before anything else.' };
    // Read everything written since your own last note, newest first.
    var since = []; for (var j = 0; j < ch.length && ch[j].byId !== ctx.me; j++) since.push(ch[j]);
    var doneNote = since.slice(0, 3).filter(function (c) { return CMD_DONE_RE.test(c.text) && !CMD_NOT_DONE_RE.test(c.text); })[0];
    if (doneNote) return { tone: 'done', tag: 'done', note: 'Done, per ' + first(doneNote.by) + '\'s note of ' + shortDate_(doneNote.day) + '.',
      text: first(doneNote.by) + ' wrote "' + shorten_(doneNote.text, 90) + '" on ' + shortDate_(doneNote.day) + '. It reads as done: close it with your note.' };
    if (!ch.length) return { tone: 'act', tag: 'silent', text: 'Nobody has written on this task. Ask for feedback before you move it.' };
    if (last.byId === ctx.me) {
      var wait = daysBetween_(last.day, ctx.day);
      if (wait >= 2) return { tone: 'act', tag: 'unanswered', text: 'Your note of ' + shortDate_(last.day) + ' has had no reply in ' + wait + ' days: move it, or ask again with a date.' };
      return { tone: 'info', text: 'Waiting on a reply to your note of ' + shortDate_(last.day) + '.' };
    }
    if ((it.age || 0) >= 60) return { tone: 'act', tag: 'old', text: 'Two months and more without a touch: close it with the reason, or give it a new date and an owner.' };
    return { tone: 'info', text: 'Last word from ' + first(last.by) + ' on ' + shortDate_(last.day) + ', ' + daysBetween_(last.day, ctx.day) + ' days ago. Ask for the next step and a date.' };
  }
  if (it.src === 'Performance letter') {
    var p = ctx.ppm[it.ref] || {}, who = first(it.ownerName), mgr = it.mgr && normEmail_(it.mgr) !== normEmail_(ctx.myEmail) ? nameFromEmail_(it.mgr) : '';
    var stale = cmdOldPeriod_(it.period, ctx.day) ? ' The ' + it.period + ' letter is a quarter behind: decide whether it still stands, or close it with the outcome.' : '';
    if (p.resp) return { tone: 'done', tag: 'done', note: 'Response reviewed with ' + who + '; letter closed.', text: who + ' has responded' + (/^\d{4}/.test(p.resp) ? ' (' + shortDate_(p.resp) + ')' : '') + '. Review it, then close the letter with your note.' };
    if (!it.opened && /assign/i.test(it.st))
      return { tone: 'act', tag: 'unopened', text: 'Never opened, ' + it.age + ' days past due' + (p.trail ? ', after ' + p.trail + ' e-mail' + (p.trail === 1 ? '' : 's') : '') + '. E-mail is not working: call ' + who + (mgr ? ' and have ' + first(mgr) + ' sit with them this week' : '') + '.' + stale };
    return { tone: 'act', tag: 'unsigned', text: 'Opened' + (it.opened ? ' ' + shortDate_(it.opened) : '') + ' but no signed response' + (p.esc ? ' (' + p.esc.status + ', ' + p.esc.count + ' reminders)' : '') + '. Meet ' + who + ' and get it signed, or close it with the outcome.' + stale };
  }
  if (it.src === 'Query Pal') {
    var qc = ctx.qp[qpCode_(it.ref)] || [];
    if (!it.ownerName) return { tone: 'act', tag: 'silent', text: 'Unassigned: give it to a desk.' };
    if (!qc.length) return { tone: 'act', tag: 'silent', text: 'No comment on the trail in ' + it.age + ' days. Ask ' + first(it.ownerName) + ' where it stands; close it in Query Pal so the client is told.' };
    return { tone: 'info', text: 'Last comment by ' + first(qc[0].by) + ' on ' + shortDate_(qc[0].day) + '. Close it in Query Pal once answered, so the client is told.' };
  }
  return null;
}

/** The history lines under one item, newest first. */
function cmdHistory_(it, ctx) {
  var out = [];
  if (it.k === 'sf') {
    (ctx.chatter[it.id] || []).forEach(function (c) { out.push({ d: c.day, by: c.by + (c.reply ? ' (reply)' : ''), text: c.text }); });
  } else if (it.src === 'Performance letter') {
    var p = ctx.ppm[it.ref] || {};
    if (p.bm) out.push({ d: p.bm.d, by: 'Your comment', text: p.bm.text });
    out.push({ d: p.resp && /^\d{4}/.test(p.resp) ? p.resp : '', by: 'Agent', text: p.resp ? 'Signed response on file.' : 'No response from the agent.' });
    if (p.esc) out.push({ d: p.esc.next, by: 'Escalation', text: p.esc.status + ' · ' + p.esc.count + ' reminders' + (p.esc.next ? ' · next chase ' + shortDate_(p.esc.next) : '') });
    if (p.trail) out.push({ d: p.last ? p.last.d : '', by: 'E-mail trail', text: p.trail + ' e-mail' + (p.trail === 1 ? '' : 's') + (p.last ? '; the last, ' + p.last.type.toLowerCase() + ' to ' + p.last.to + ' (' + p.last.status + ')' : '') });
    if (it.opened) out.push({ d: it.opened, by: 'Letter', text: 'Opened by the agent.' });
    if (p.weekly) out.push({ d: p.weekly, by: 'Weekly update', text: 'Last weekly update from the agent.' });
  } else if (it.src === 'Query Pal') {
    (ctx.qp[qpCode_(it.ref)] || []).forEach(function (c) { out.push({ d: c.day, by: c.by, text: c.text }); });
  }
  return out;
}

/* The page's items are kept between the page and its save. One Script
   Property holds 9 KB, and sixty items run past it, so they are kept in
   chunks; the save finds each item by its id, not by its place, so a page
   opened twice cannot apply a move to the wrong row. */
function cmdStore_(sid, day, arr) {
  var props = PropertiesService.getScriptProperties(), base = cmdKey_(sid, day), js = JSON.stringify(arr);
  try { Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf('cmd_items_' + sid + '_') === 0 && k.indexOf(base) !== 0) props.deleteProperty(k); }); } catch (e) {}
  var n = Math.max(1, Math.ceil(js.length / 8000));
  for (var i = 0; i < n; i++) props.setProperty(base + (i ? '_' + i : ''), js.slice(i * 8000, (i + 1) * 8000));
  props.setProperty(base + '_n', String(n));
}
function cmdLoad_(sid, day) {
  var props = PropertiesService.getScriptProperties(), base = cmdKey_(sid, day), n = Number(props.getProperty(base + '_n') || 1), js = '';
  for (var i = 0; i < n; i++) js += props.getProperty(base + (i ? '_' + i : '')) || '';
  try { return JSON.parse(js || '[]'); } catch (e) { return []; }
}

/* ─────────── Risk and the client in one view (18 Oct 2026) ───────────
 *  "A priority score per item" and "one view per client" (Ricky: ok).
 *  Every client named on an item is looked up across the branch's records:
 *  the open Salesforce book, Query Pal, the log book, and from Branch
 *  Intelligence the premiums overdue, the pending business and last night's
 *  lapses. A name matches on all its words in any order ("KHAN, Jamil" is
 *  "Jamil Khan"), or, failing that, on two words of four letters or more.
 *  The score (0 to 100) then ranks the page by what is at stake rather than
 *  by age, and says why in a few words. It weighs, in order: what the work
 *  is (new business, orphan adoption, retention: the branch's own payoff
 *  order); how long it has waited; a client waiting or unhappy; the client's
 *  money at risk (a premium past 60 days, a lapse, business pending); the
 *  same client open in more than one place; and what the record says (the
 *  client asked for an agent, your note unanswered, the desk out, the agent
 *  gone). An item that reads as done drops down: it needs a close, not a chase. */
var CLIENT_TITLES = /^(mr|mrs|miss|ms|dr|rev|mstr|master|the)$/;
var RISK_WAITING_RE = /\b(complain\w*|urgent|client waiting|escalat\w*|ombuds\w*|unhappy|angry|upset|cancel\w*|surrender\w*|threat\w*|lawyer|legal)\b/i;
function clientTokens_(s) {
  return String(s || '').toLowerCase().replace(/[‘’'`-]/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter(function (w) { return w.length >= 2 && !CLIENT_TITLES.test(w); });
}
function clientKeys_(s) {
  var t = clientTokens_(s); if (t.length < 2 || t.length > 6) return { full: '', pairs: [] };
  var long = t.filter(function (w) { return w.length >= 4; }), pairs = [];
  for (var i = 0; i < long.length; i++) for (var j = i + 1; j < long.length; j++) pairs.push([long[i], long[j]].sort().join(' '));
  return { full: t.slice().sort().join(' '), pairs: pairs };
}
/** Everything open for every client the branch's records name, looked up by name. */
function cmdClientIndex_(day) {
  var full = {}, pair = {}, n = 0;
  var add = function (client, e) {
    var k = clientKeys_(client); if (!k.full) return;
    e.client = String(client); n++;
    (full[k.full] = full[k.full] || []).push(e);
    k.pairs.forEach(function (p) { (pair[p] = pair[p] || []).push(e); });
  };
  try { var ob = sfkOpenBook_(day) || {};
    Object.keys(ob).forEach(function (desk) { Object.keys(ob[desk]).forEach(function (ty) { ob[desk][ty].forEach(function (t) {
      if (t.account) add(t.account, { src: 'Salesforce', id: t.id, text: t.subject + ' · ' + String(nameFor_(desk)).split(' ')[0] + (t.late ? ' · overdue since ' + shortDate_(t.due) : ''), late: t.late, payoff: payoffOf_({ subject: t.subject, ty: ty }).key });
    }); }); });
  } catch (e) {}
  try { openQueries_().forEach(function (q) { add(q.client, { src: 'Query Pal', id: 'qp:' + q.ref, text: qpCode_(q.ref) + ' · ' + (q.subject || q.type) + ' · ' + q.days + ' days open', days: q.days }); }); } catch (e) {}
  try { bookRows_('DELIVERY', BOOKS.DELIVERY.log).forEach(function (r) {
    if (!/logged|received/i.test(String(r['Status'] || '')) || String(r['Sent At'] || '').trim()) return;
    add(r['Client'], { src: 'Log book', id: 'lb:' + r['Line Id'], text: String(r['Document'] || 'Document') + ' → ' + String(r['Department'] || '') + ', not sent on' });
  }); } catch (e) {}
  var cache = null; try { cache = typeof iLoadCache_ === 'function' ? iLoadCache_() : null; } catch (e) {}
  if (cache) {
    try { ((cache.dues || {}).chase || []).forEach(function (x) {
      add(x.client, { src: 'Premium', id: 'du:' + (x.policy || x.clientNo), days: x.days, modal: x.modal,
        text: 'premium ' + x.days + ' days overdue' + (x.policy ? ' on ' + x.policy : '') + (x.modal ? ' (TT$' + Math.round(x.modal).toLocaleString() + ' a premium)' : '') + (x.lapseOn ? ', lapses ' + shortDate_(x.lapseOn) : '') });
    }); } catch (e) {}
    try { ((cache.pending || {}).rows || []).forEach(function (x) {
      add(x.client, { src: 'Pending', id: 'pe:' + x.policy, text: 'new business pending' + (x.policy ? ' on ' + x.policy : '') + (x.requirement ? ': ' + x.requirement : (x.status ? ': ' + x.status : '')) + (x.age != null ? ', ' + x.age + ' days' : '') });
    }); } catch (e) {}
    try { if (cache.movements && !cache.movements.first) (cache.movements.lapsed || []).forEach(function (x) {
      add(x.client, { src: 'Lapsed', id: 'la:' + x.policy, text: 'lapsed last night' + (x.policy ? ': ' + x.policy : '') });
    }); } catch (e) {}
  }
  return {
    size: n,
    lookup: function (name, selfId) {
      var k = clientKeys_(name); if (!k.full) return [];
      var hits = full[k.full] || [];
      if (!hits.length) { var seen = {}; k.pairs.forEach(function (p) { (pair[p] || []).forEach(function (e) { if (!seen[e.id]) { seen[e.id] = 1; hits.push(e); } }); }); }
      return hits.filter(function (e) { return e.id !== selfId; });
    }
  };
}
/** The client a work item is about, when its record names one. */
function cmdClientOf_(it) {
  var c = String(it.client || '').trim();
  return /^[A-Za-z][A-Za-z .,'’-]+$/.test(c) && clientTokens_(c).length >= 2 ? c : '';
}
/** 0–100, and why. */
function cmdRisk_(it, ctx) {
  var s = 0, why = [];
  var pay = it.k === 'sf' ? payoffOf_({ subject: it.title, ty: it.key }).key : '';
  var base = it.k === 'sf' ? ({ 'new': 30, orphan: 25, retention: 22 }[pay] || 10)
           : it.src === 'Query Pal' ? (/urgent/i.test(it.why + ' ' + (it.st || '')) ? 25 : 15)
           : it.src === 'BM approval' ? 22 : it.src === 'Performance letter' ? (it.opened ? 15 : 20) : it.src === 'Log book' ? 15 : it.src === 'Petty cash' ? 8 : 12;
  s += base;
  if (pay === 'new') why.push('new business'); else if (pay === 'orphan') why.push('orphan adoption'); else if (pay === 'retention') why.push('retention');
  else if (it.src === 'BM approval') why.push('money waiting on your decision');
  var age = it.age || 0; s += Math.min(25, Math.round(age * 0.6)); if (age >= 14) why.push(age + ' days');
  var said = it.title + ' ' + (it.k === 'sf' ? (ctx.chatter[it.id] || []).slice(0, 5).map(function (c) { return c.text; }).join(' ') : '');
  if (RISK_WAITING_RE.test(said)) { s += 12; why.push('client waiting or unhappy'); }
  var c = it.c360 || [];
  var due = c.filter(function (e) { return e.src === 'Premium'; }).sort(function (a, b) { return b.days - a.days; })[0];
  if (due && due.days >= 60) { s += 15; why.push('premium ' + due.days + ' days overdue'); } else if (due && due.days >= 30) { s += 8; why.push('premium ' + due.days + ' days overdue'); }
  if (c.some(function (e) { return e.src === 'Lapsed'; })) { s += 10; why.push('a policy lapsed last night'); }
  if (c.some(function (e) { return e.src === 'Pending'; })) { s += 8; why.push('business pending'); }
  var places = {}; c.forEach(function (e) { places[e.src] = 1; }); delete places.Premium; delete places.Pending; delete places.Lapsed;
  var nPlaces = Object.keys(places).length;
  if (nPlaces) { s += Math.min(10, 5 * nPlaces); why.push('open in ' + (nPlaces + 1) + ' places'); }
  var tag = it.adv && it.adv.tag;
  if (tag === 'agent') { s += 10; why.push('client asked for an agent'); }
  else if (tag === 'orphan') { s += 8; why.push('agent has left'); }
  else if (tag === 'unanswered') { s += 6; why.push('your note unanswered'); }
  else if (tag === 'away') { s += 6; why.push('holder out today'); }
  else if (tag === 'silent') s += 4;
  else if (tag === 'unopened') { s += 6; why.push('never opened'); }
  if (tag === 'done') { s -= 20; why.unshift('reads as done: close it'); }
  s = Math.max(0, Math.min(100, s));
  return { score: s, band: s >= 70 ? 'high' : s >= 45 ? 'med' : 'low', why: why.slice(0, 4) };
}

var CMD_GROUPS = ['Your instruction', 'Salesforce', 'Performance letter', 'Query Pal', 'BM approval', 'Log book', 'Petty cash'];
var CMD_GROUP_LABEL = { 'Your instruction': 'Your instructions with no note', 'Salesforce': 'Salesforce tasks gone quiet', 'Performance letter': 'Performance letters past due',
  'Query Pal': 'Query Pal past three days', 'BM approval': 'Approvals waiting on you', 'Log book': 'Log book lines not sent on', 'Petty cash': 'Petty cash' };

function cmdReplyPage_(person, day, error, notice) {
  var sid = String(person.staffId), items = cmdItems_(sid, day), targets = cmdTargets_();
  var ctx = { day: day, me: '', myEmail: emailFor_(sid), chatter: {}, ppm: {}, qp: {}, away: absentToday_(day), left: function () { return false; } };
  try { ctx.me = sid === 'ricky' ? bmSfId_() : (((sfkUsers_() || {})[sid] || {}).id || ''); } catch (e) {}
  var sfIds = items.filter(function (it) { return it.k === 'sf'; }).map(function (it) { return it.id; });
  try { ctx.chatter = cmdChatter_(sfIds); } catch (e) {}
  if (items.some(function (it) { return it.src === 'Performance letter'; })) { try { ctx.ppm = ppmIntel_(); } catch (e) {} }
  if (items.some(function (it) { return it.src === 'Query Pal'; })) { try { ctx.qp = qpComments_(); } catch (e) {} }
  try { var bank = skillBank_(); ctx.left = function (n) { var a = bank[bkNk_(n)]; return !!(a && !a.active); }; } catch (e) {}
  var sfSt = sfIds.length ? sfTaskStatuses_() : [], plSt = items.some(function (it) { return it.src === 'Performance letter'; }) ? ppmStatuses_() : [];

  items.forEach(function (it) { it.adv = cmdAdvise_(it, ctx); it.hist = cmdHistory_(it, ctx); it.nc = !!(it.adv && it.adv.tag === 'agent'); });
  // The client in one view, and the risk that ranks the page.
  try { ctx.clients = items.length ? cmdClientIndex_(day) : null; } catch (e) { ctx.clients = null; }
  items.forEach(function (it) {
    var cl = cmdClientOf_(it);
    it.cname = cl.replace(/^\s*(mr|mrs|miss|ms|dr|rev)\.?\s+/i, ''); it.c360 = cl && ctx.clients ? ctx.clients.lookup(cl, it.id) : [];
    it.risk = cmdRisk_(it, ctx);
  });
  items.sort(function (a, b) { return (b.risk.score - a.risk.score) || ((b.age || 0) - (a.age || 0)); });
  try { cmdStore_(sid, day, items.map(function (it) { return { k: it.k, id: it.id, src: it.src, t: String(it.title).slice(0, 120), who: it.who, on: it.ownerName || '', why: it.why, st: it.st || '', ref: it.ref || '', nc: it.nc ? 1 : 0 }; })); } catch (e) {}

  var base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var opts = '<option value="">Leave where it is</option>' + targets.map(function (t) { return '<option value="' + esc_(t.sid) + '">Move to ' + esc_(t.name) + '</option>'; }).join('');
  var tone = { done: '#2C7A57', act: '#141C4A', warn: '#DC3F3F', info: '#6A7180' };
  var badgeOf = { done: 'g', warn: 'r', act: 'a', info: '' };
  var tagLabel = { done: 'Reads as done', agent: 'Cannot close', unanswered: 'Your note unanswered', silent: 'Nothing written', away: 'Holder not in',
                   orphan: 'Agent has left', unopened: 'Never opened', unsigned: 'Not signed', old: '60+ days' };
  var holder = function (it) { return String(it.who ? nameFor_(it.who) : (it.ownerName || 'Unassigned')).split(' ')[0] || 'Unassigned'; };
  var pct = function (a, b) { return b ? Math.round(100 * a / b) : 0; };

  // ── Insight ───────────────────────────────────────────────────────────────
  var tags = {}; items.forEach(function (it) { if (it.adv && it.adv.tag) tags[it.adv.tag] = (tags[it.adv.tag] || 0) + 1; });
  var oldest = items.reduce(function (m, it) { return Math.max(m, it.age || 0); }, 0);
  var nHigh = items.filter(function (it) { return it.risk.band === 'high'; }).length;
  // Clients with work in more than one place: each client once, their items and what else is open.
  var cseen = {}, multi = [];
  items.forEach(function (it, i) {
    if (!it.cname || !it.c360.length) return;
    var k = clientKeys_(it.cname).full; if (cseen[k]) { cseen[k].items.push(i); cseen[k].score = Math.max(cseen[k].score, it.risk.score); return; }
    cseen[k] = { name: it.cname, items: [i], other: it.c360, score: it.risk.score }; multi.push(cseen[k]);
  });
  multi.sort(function (a, b) { return b.score - a.score; });
  var sfNoWord = items.filter(function (it) { return it.k === 'sf' && !(ctx.chatter[it.id] || []).length; }).length;
  var tiles = '<div class="tiles">' +
    '<div class="tile"><div class="v">' + items.length + '</div><div class="l">gone quiet</div></div>' +
    '<div class="tile g"><div class="v">' + (tags.done || 0) + '</div><div class="l">quick wins: read as done</div></div>' +
    '<div class="tile' + (oldest > 30 ? ' r' : '') + '"><div class="v">' + oldest + 'd</div><div class="l">the oldest</div></div>' +
    '<div class="tile' + (sfNoWord ? ' a' : '') + '"><div class="v">' + pct(sfNoWord, sfIds.length) + '%</div><div class="l">of tasks with nothing written</div></div>' +
    '<div class="tile' + (nHigh ? ' r' : ' g') + '"><div class="v">' + nHigh + '</div><div class="l">high risk: do these first</div></div>' +
    '<div class="tile' + (multi.length ? ' a' : '') + '"><div class="v">' + multi.length + '</div><div class="l">clients open in more than one place</div></div></div>';
  // Where it is stuck, by who holds it.
  var by = {};
  items.forEach(function (it) { var h = holder(it); var x = by[h] = by[h] || { n: 0, old: 0, done: 0 }; x.n++; x.old = Math.max(x.old, it.age || 0); if (it.adv && it.adv.tag === 'done') x.done++; });
  var hs = Object.keys(by).sort(function (a, b) { return by[b].n - by[a].n; }), maxN = hs.length ? by[hs[0]].n : 1;
  var stuck = hs.slice(0, 8).map(function (h) { return '<div class="bar"><span class="n">' + esc_(h) + '</span><span class="t"><i style="width:' + Math.max(4, pct(by[h].n, maxN)) + '%"' + (by[h].old > 30 ? ' class="r"' : '') + '></i></span><span class="c">' + by[h].n + ' · ' + by[h].old + 'd</span></div>'; }).join('');
  // Your notes, answered or not, by who holds the task.
  var ans = {};
  items.forEach(function (it) {
    if (it.k !== 'sf' || !ctx.me) return;
    var ch = (ctx.chatter[it.id] || []).slice().reverse(), h = holder(it);
    ch.forEach(function (c, i) {
      if (c.byId !== ctx.me) return;
      var x = ans[h] = ans[h] || { asked: 0, answered: 0 }; x.asked++;
      if (ch.slice(i + 1).some(function (d) { return d.byId !== ctx.me; })) x.answered++;
    });
  });
  var ansKeys = Object.keys(ans).sort(function (a, b) { return pct(ans[a].answered, ans[a].asked) - pct(ans[b].answered, ans[b].asked); });
  var answered = ansKeys.map(function (h) { var x = ans[h], p = pct(x.answered, x.asked);
    return '<div class="bar"><span class="n">' + esc_(h) + '</span><span class="t"><i class="' + (p < 50 ? 'r' : 'g') + '" style="width:' + Math.max(4, p) + '%"></i></span><span class="c">' + x.answered + ' of ' + x.asked + '</span></div>'; }).join('');
  var sees = [
    tags.done ? '<b style="color:#2C7A57">' + tags.done + ' read as done.</b> The desk or the agent has answered: close each with your note. Start here.' : '',
    tags.agent ? '<b style="color:#DC3F3F">' + tags.agent + ' cannot be closed:</b> the client asked for an agent.' : '',
    tags.unanswered ? '<b>' + tags.unanswered + '</b> carry your note with no reply.' : '',
    tags.silent ? '<b>' + tags.silent + '</b> have nothing written on them at all.' : '',
    tags.away ? '<b>' + tags.away + '</b> sit with someone who is not in today.' : '',
    tags.orphan ? '<b>' + tags.orphan + '</b> belong to an agent who has left.' : '',
    tags.unopened ? '<b>' + tags.unopened + '</b> performance letter' + (tags.unopened === 1 ? ' was' : 's were') + ' never opened.' : '',
    hs.length ? '<b>' + esc_(hs[0]) + '</b> holds the most (' + by[hs[0]].n + ', the oldest ' + by[hs[0]].old + ' days).' : ''
  ].filter(String);
  var extra = '';
  try { if (sid === 'ricky' || sid === 'kamla') extra += cmdQpSnapshot_(sid, day); } catch (e) {}
  try { if (sid === 'ricky' || UM_DESKS.indexOf(sid) > -1) extra += cmdFfSnapshot_(sid, day); } catch (e) {}
  var first5 = items.map(function (it, i) { return { it: it, i: i }; }).filter(function (x) { return x.it.risk.band !== 'low' && !(x.it.adv && x.it.adv.tag === 'done'); }).slice(0, 5);
  var riskCls = function (b) { return b === 'high' ? 'r' : b === 'med' ? 'a' : ''; };
  var doFirst = first5.length ? '<div class="card"><div class="bh">Do these first · highest risk</div>' + first5.map(function (x) {
      return '<a href="#it' + x.i + '" data-open="' + x.i + '" style="display:flex;gap:9px;align-items:flex-start;padding:9px 0;border-top:1px solid #EEE;text-decoration:none;font-weight:400;color:#1F2433">' +
        '<span class="age ' + riskCls(x.it.risk.band) + '">' + x.it.risk.score + '</span><span style="flex:1;font-size:14px;line-height:1.35"><b>' + esc_(shorten_(x.it.title, 80)) + '</b>' +
        '<small style="display:block;color:#6A7180;font-size:12.5px;margin-top:2px">' + esc_(holder(x.it)) + ' · ' + esc_(x.it.risk.why.join(' · ')) + '</small></span></a>'; }).join('') +
      '<div class="bf" style="margin-top:6px">The score weighs the work (new business first), how long it has waited, a client waiting, the client\'s money at risk, and the same client open elsewhere.</div></div>' : '';
  var clientsCard = multi.length ? '<details class="card"' + (multi.length <= 3 ? ' open' : '') + '><summary class="bh" style="padding:0">Clients open in more than one place (' + multi.length + ')</summary>' + multi.slice(0, 8).map(function (m) {
      return '<div class="ln"><b>' + esc_(m.name) + '</b> · ' + m.items.map(function (i) { return '<a href="#it' + i + '" data-open="' + i + '">' + esc_(items[i].src) + '</a>'; }).join(', ') +
        m.other.slice(0, 4).map(function (e) { return '<div style="font-size:13px;color:#6A7180;margin-top:2px">' + esc_(e.src) + ': ' + esc_(shorten_(e.text, 120)) + '</div>'; }).join('') + '</div>'; }).join('') + '</details>' : '';
  var insight = items.length ? tiles + doFirst + '<details class="card" open><summary class="bh" style="padding:0">What the system sees</summary>' +
      sees.map(function (s) { return '<div class="ln">' + s + '</div>'; }).join('') +
      (stuck ? '<div class="bf" style="margin-top:10px">Where it is stuck · items and the oldest</div>' + stuck : '') +
      (answered ? '<div class="bf" style="margin-top:10px">Your notes answered, by who holds the task</div>' + answered : '') + '</details>' + clientsCard + extra
    : extra;

  // ── Filter chips ──────────────────────────────────────────────────────────
  var fcount = {};
  items.forEach(function (it, i) {
    it.f = ['all', 'src-' + it.src.replace(/\W+/g, ''), 'who-' + holder(it).replace(/\W+/g, ''), 'risk-' + it.risk.band].concat(it.adv && it.adv.tag ? ['tag-' + it.adv.tag] : []).concat(it.c360.length ? ['client-multi'] : []);
    it.f.forEach(function (f) { fcount[f] = (fcount[f] || 0) + 1; });
  });
  var chip = function (f, label, on) { return fcount[f] ? '<button type="button" class="chip' + (on ? ' on' : '') + '" data-f="' + esc_(f) + '">' + esc_(label) + '<i>' + fcount[f] + '</i></button>' : ''; };
  var chips = items.length ? '<div class="chips">' + chip('all', 'All', true) + chip('risk-high', 'High risk') + chip('client-multi', 'Client open elsewhere') +
    ['done', 'agent', 'unanswered', 'silent', 'away', 'orphan', 'unopened', 'old'].map(function (t) { return chip('tag-' + t, tagLabel[t]); }).join('') +
    CMD_GROUPS.map(function (g) { return chip('src-' + g.replace(/\W+/g, ''), g); }).join('') +
    hs.map(function (h) { return chip('who-' + h.replace(/\W+/g, ''), h); }).join('') + '</div>' : '';

  // ── The rows: folded to one line each, opened with a tap ─────────────────
  var row = function (it, i) {
    var owner = it.who ? nameFor_(it.who) : (it.ownerName || '—');
    var link = it.k === 'sf' && base ? '<a href="' + esc_(base + it.id) + '" target="_blank" rel="noopener">Open in Salesforce</a>'
             : it.drive ? '<a href="https://drive.google.com/file/d/' + esc_(it.drive) + '/view" target="_blank" rel="noopener">Open the letter</a>' : '';
    var list = it.k === 'sf' ? sfSt : it.src === 'Performance letter' ? plSt : null;
    var closer = list ? (list.filter(function (s) { return s.closed; })[0] || {}).v : '';
    var stSel = list ? '<select name="st_' + i + '"><option value="">Status: ' + esc_(it.st || '—') + ' (leave)</option>' +
      list.filter(function (s) { return s.v !== it.st && !(it.nc && s.closed); }).map(function (s) { return '<option value="' + esc_(s.v) + '">Set to ' + esc_(s.v) + (s.closed ? ' (closes it)' : '') + '</option>'; }).join('') + '</select>' : '';
    var hist = it.hist || [], shown = hist.slice(0, 2), more = hist.slice(2);
    var hl = function (h) { return '<div style="font-size:13px;line-height:1.45;padding:5px 0;border-top:1px dashed #E5E1D6">' + (h.d ? '<span style="color:#6A7180">' + esc_(shortDate_(h.d)) + '</span> · ' : '') + '<b>' + esc_(h.by) + '</b>: ' + esc_(shorten_(h.text, 240)) + '</div>'; };
    var histHtml = it.k === 'sf' && !hist.length ? '<div style="font-size:13px;color:#6A7180;padding:4px 0">No Chatter on this task.</div>'
      : hist.length ? '<div style="margin:2px 0 6px">' + shown.map(hl).join('') + (more.length ? '<details><summary>' + more.length + ' earlier</summary>' + more.map(hl).join('') + '</details>' : '') + '</div>' : '';
    var adv = it.adv ? '<div style="font-size:13.5px;line-height:1.45;margin:6px 0 8px;padding:8px 10px;border-radius:8px;background:#F7F5EF;border-left:3px solid ' + tone[it.adv.tone] + ';color:' + tone[it.adv.tone] + '"><b>Suggested:</b> ' + esc_(it.adv.text) + '</div>' : '';
    var doneNote = it.adv && it.adv.note ? it.adv.note : '';
    var quick = '<div class="quick">' +
      (closer && !it.nc ? '<button type="button" class="' + (it.adv && it.adv.tag === 'done' ? 'go' : '') + '" data-close="' + esc_(closer) + '" data-note="' + esc_(doneNote) + '">Close it</button>' : '') +
      '<button type="button" data-ask="Where does this stand? Please note the next step and the date.">Ask for an update</button></div>';
    var ph = it.k === 'sf' ? 'Your note (goes on Chatter)' : it.src === 'Performance letter' ? 'Your comment (goes on the letter)' : 'Instruction for the task this becomes';
    var ageCls = (it.age || 0) > 30 ? ' r' : (it.age || 0) > 7 ? ' a' : '';
    var rb = it.risk.band === 'high' ? 'r' : it.risk.band === 'med' ? 'a' : '';
    var c360 = it.c360.length ? '<div style="margin:4px 0 8px;padding:8px 10px;border:1px solid #E5E1D6;border-radius:8px;background:#fff">' +
        '<div class="bf" style="margin:0 0 4px;font-weight:700;color:#141C4A">' + esc_(it.cname) + ' · also open</div>' +
        it.c360.slice(0, 6).map(function (e) { return '<div style="font-size:13px;line-height:1.45;padding:3px 0;border-top:1px dashed #E5E1D6"><b>' + esc_(e.src) + '</b>: ' + esc_(shorten_(e.text, 150)) + '</div>'; }).join('') +
        (it.c360.length > 6 ? '<div class="bf">and ' + (it.c360.length - 6) + ' more</div>' : '') + '</div>' : '';
    return '<details class="it" id="it' + i + '" data-f="' + esc_(it.f.join(' ')) + '"><summary><div class="hd"><span class="age' + ageCls + '">' + (it.age || 0) + 'd</span>' +
        '<div class="tt">' + esc_(shorten_(it.title, 110)) + '<small>' + esc_(owner) + ' · ' + esc_(it.why) + (it.st ? ' · ' + esc_(it.st) : '') + '</small>' +
        '<span class="badge ' + rb + '">Risk ' + it.risk.score + '</span> ' +
        (it.adv && it.adv.tag ? '<span class="badge ' + badgeOf[it.adv.tone] + '">' + esc_(tagLabel[it.adv.tag] || '') + '</span>' : '') +
        (it.c360.length ? ' <span class="badge">' + esc_(it.cname.split(' ')[0]) + ': ' + it.c360.length + ' more open</span>' : '') + '</div></div></summary>' +
      (it.risk.why.length ? '<div style="font-size:12.5px;color:#6A7180;margin:-2px 0 6px">Why this score: ' + esc_(it.risk.why.join(' · ')) + '</div>' : '') + c360 +
      '<input type="hidden" name="id_' + i + '" value="' + esc_(it.id) + '">' +
      (link ? '<div style="font-size:13.5px;margin:0 0 4px">' + link + '</div>' : '') + histHtml + adv + quick + stSel +
      '<select name="to_' + i + '">' + opts + '</select>' +
      '<input type="text" name="q_' + i + '" placeholder="' + esc_(ph) + '">' +
      '<div style="display:flex;gap:8px;align-items:center;margin:6px 0 10px;font-size:14px">New date <input type="date" name="d_' + i + '" style="flex:1"></div></details>';
  };
  var groups = CMD_GROUPS.concat(items.map(function (it) { return it.src; }).filter(function (s, i, a) { return CMD_GROUPS.indexOf(s) < 0 && a.indexOf(s) === i; }));
  var cards = groups.map(function (g) {
    var idx = []; items.forEach(function (it, i) { if (it.src === g) idx.push(i); });
    if (!idx.length) return '';
    return '<div class="card grp"><div class="bh">' + esc_(CMD_GROUP_LABEL[g] || g) + ' (' + idx.length + ')</div>' + idx.map(function (i) { return row(items[i], i); }).join('') + '</div>';
  }).join('');
  var js = '<script>(function(){' +
    'var chips=document.querySelectorAll(".chip"),items=document.querySelectorAll("details.it");' +
    'function apply(f){for(var i=0;i<items.length;i++){var d=items[i];d.style.display=(" "+d.getAttribute("data-f")+" ").indexOf(" "+f+" ")>-1?"":"none";}' +
      'var g=document.querySelectorAll(".grp");for(var j=0;j<g.length;j++){var any=false,ds=g[j].querySelectorAll("details.it");for(var k=0;k<ds.length;k++)if(ds[k].style.display!=="none")any=true;g[j].style.display=any?"":"none";}}' +
    'for(var c=0;c<chips.length;c++)chips[c].addEventListener("click",function(){for(var x=0;x<chips.length;x++)chips[x].className="chip";this.className="chip on";apply(this.getAttribute("data-f"));window.scrollTo(0,document.querySelector(".chips").offsetTop);});' +
    'var btn=document.getElementById("send");' +
    'function count(){var n=0;for(var i=0;i<items.length;i++){var d=items[i],ch=false,els=d.querySelectorAll("select,input[type=text],input[type=date]");for(var k=0;k<els.length;k++)if(els[k].value)ch=true;d.classList.toggle("changed",ch);if(ch)n++;}' +
      'if(btn)btn.textContent=n?("Send "+n+" change"+(n===1?"":"s")):"Send these changes";}' +
    'if(btn&&btn.form){btn.form.addEventListener("input",count);btn.form.addEventListener("change",count);}' +
    'var os=document.querySelectorAll("[data-open]");for(var o=0;o<os.length;o++)os[o].addEventListener("click",function(ev){var d=document.getElementById("it"+this.getAttribute("data-open"));if(!d)return;ev.preventDefault();' +
      'for(var x=0;x<chips.length;x++)chips[x].className="chip";if(chips[0])chips[0].className="chip on";apply("all");d.open=true;d.scrollIntoView({behavior:"smooth",block:"start"});});' +
    'var qs=document.querySelectorAll("[data-close],[data-ask]");for(var q=0;q<qs.length;q++)qs[q].addEventListener("click",function(){' +
      'var d=this.closest("details.it"),s=d.querySelector("select[name^=st_]"),t=d.querySelector("input[name^=q_]");' +
      'if(this.hasAttribute("data-close")&&s)s.value=this.getAttribute("data-close");' +
      'var note=this.getAttribute("data-note")||this.getAttribute("data-ask")||"";if(t&&!t.value&&note)t.value=note;if(t)t.focus();count();});' +
    '})();</script>';
  var srcCount = {}; items.forEach(function (it) { srcCount[it.src] = (srcCount[it.src] || 0) + 1; });
  return replyPage_('Not getting attention · ' + prettyDate_(day),
    items.length ? items.length + ' item' + (items.length === 1 ? '' : 's') + ' gone quiet, highest risk first. Tap one to see its history and the client\'s other open work, then close it, move it or ask; untouched rows are left as they are.' : '',
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') + (notice ? '<div class="card ok">' + notice + '</div>' : '') + insight +
    (items.length ? '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(sid, day, 'cmd') + chips + cards + '<button type="submit" id="send">Send these changes</button></form>' + js
                  : '<div class="card ok">Nothing has gone quiet. Every item has been touched in the last ' + CMD.QUIET_DAYS + ' days.</div>'));
}

/** Set fields on every row of a branch workbook tab whose keyCol is keyVal (and that passes onlyIf). */
function bookUpdate_(k, tab, keyCol, keyVal, patch, onlyIf) {
  var sh = SpreadsheetApp.openById(bookId_(k)).getSheetByName(tab);
  if (!sh) throw new Error('No "' + tab + '" tab in that workbook.');
  var lr = sh.getLastRow(), lc = sh.getLastColumn(); if (lr < 2) return 0;
  var head = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var kc = head.indexOf(keyCol); if (kc < 0) throw new Error('No "' + keyCol + '" column on ' + tab + '.');
  var vals = sh.getRange(2, 1, lr - 1, lc).getValues(), n = 0;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][kc]).trim() !== String(keyVal).trim()) continue;
    if (onlyIf) { var o = {}; head.forEach(function (h, j) { o[h] = vals[i][j]; }); if (!onlyIf(o)) continue; }
    Object.keys(patch).forEach(function (f) { var c = head.indexOf(f); if (c > -1) sh.getRange(i + 2, c + 1).setValue(patch[f]); });
    n++;
  }
  bookForget_(k, tab);
  return n;
}
function bookAppend_(k, tab, obj) {
  var sh = SpreadsheetApp.openById(bookId_(k)).getSheetByName(tab);
  if (!sh || sh.getLastColumn() < 1) return false;
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
  sh.appendRow(head.map(function (h) { return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : ''; }));
  bookForget_(k, tab);
  return true;
}
function bookForget_(k, tab) {
  var ck = 'book_' + k + '_' + tab; delete _bookMemo[ck];
  try { CacheService.getScriptCache().remove(ck); } catch (e) {}
}

/** A letter's status set from the tracker: the letter, its open escalation, your comment and the audit log. */
function ppmSetStatus_(letterId, status, note, who) {
  var now = new Date(), closing = ppmClosing_(status), patch = { Status: status };
  if (closing) patch['Date Completed'] = now;
  if (!bookUpdate_('PPM', BOOKS.PPM.letters, 'Letter ID', letterId, patch)) throw new Error('Letter ' + letterId + ' is not on the sheet any more.');
  if (closing) {
    try { bookUpdate_('PPM', BOOKS.PPM.escalations, 'Letter ID', letterId, { 'Resolved Date': now, 'Current Status': 'Resolved', 'Resolution Notes': note },
      function (o) { return !String(o['Resolved Date'] || '').trim(); }); } catch (e) {}
  }
  if (note) ppmComment_(letterId, note, who, closing ? 'Closed: ' + status : 'Status: ' + status, true);
  try { bookAppend_('PPM', 'Audit Log', { Timestamp: now, Email: who.email, Role: who.role, Action: 'STATUS CHANGE', 'Letter ID': letterId,
    Details: 'Set to "' + status + '" from the KPI tracker by ' + who.name + (note ? ': ' + note : '') }); } catch (e) {}
}
/** A comment on a letter's record: the BM Comments tab for the Branch Manager; the audit log for anyone else. */
function ppmComment_(letterId, note, who, action, quiet) {
  var now = new Date();
  if (who.role === 'Branch Manager') {
    bookAppend_('PPM', 'BM Comments', { 'Comment ID': 'BMC-' + String(Utilities.getUuid()).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase(), 'Letter ID': letterId,
      'BM Email': who.email, 'BM Name': who.name, 'Comment Date': now, 'Comment': note, 'Action Required': action || '' });
  } else if (!quiet) {
    bookAppend_('PPM', 'Audit Log', { Timestamp: now, Email: who.email, Role: who.role, Action: 'COMMENT', 'Letter ID': letterId, Details: note });
  }
}

function cmdReplySave_(person, day, p) {
  var sid = String(person.staffId), at = hhmm_(new Date()), out = [], me = nameFor_(sid);
  var stored = cmdLoad_(sid, day), byId = {};
  stored.forEach(function (it) { byId[it.id] = it; });
  var targets = {}; cmdTargets_().forEach(function (t) { targets[t.sid] = t; });
  var role = sid === 'ricky' ? 'Branch Manager' : UM_DESKS.indexOf(sid) > -1 ? 'Unit Manager' : 'BMA';
  var who = { name: me, email: emailFor_(sid), role: role };
  var head = (sid === 'ricky' ? 'Branch Manager' : role + ' · ' + me) + ' · ' + shortDate_(day) + ' ' + twelve_(at);
  // Rows as the page numbered them, each found by its id.
  var rows = [];
  for (var i = 0; i < 200; i++) {
    var hasId = p['id_' + i] != null && String(p['id_' + i]) !== '';
    if (!hasId && i >= stored.length) break;
    var it = hasId ? byId[String(p['id_' + i])] : stored[i];
    if (it) { rows.push({ it: it, i: i }); continue; }
    if (p['to_' + i] || String(p['q_' + i] || '').trim() || p['d_' + i] || p['st_' + i])
      out.push({ s: String(p['id_' + i] || 'An item'), res: 'NOT SAVED: it is no longer on the list. Open the page again and redo it.' });
  }
  rows.forEach(function (r) {
    var it = r.it, i = r.i;
    var to = String(p['to_' + i] || ''), q = String(p['q_' + i] || '').trim(), nd = String(p['d_' + i] || '').trim(), st = String(p['st_' + i] || '').trim();
    if (st === it.st) st = '';
    if (!to && !q && !nd && !st) return;
    var tgt = targets[to] || null, res = '';
    try {
      if (it.k === 'sf') {
        var closing = !!st && sfStatusClosed_(st);
        if (closing && it.nc) throw new Error('The client asked for an agent: this task cannot be closed. Give the client an agent first.');
        if (closing && !q) throw new Error('Write the note first: a closed task without a note is not closed.');
        var patch = {};
        if (tgt) patch.OwnerId = tgt.id;
        if (/^\d{4}-\d{2}-\d{2}$/.test(nd)) patch.ActivityDate = nd;
        if (st) patch.Status = st;
        var body = head + '\n\n' + (tgt ? 'Moved from ' + (it.who ? nameFor_(it.who) : it.on || 'the desk') + ' to ' + tgt.name + '. ' : '') +
          (patch.ActivityDate ? 'New date ' + shortDate_(nd) + '. ' : '') + (st ? (closing ? 'Closed (' + st + '). ' : 'Status set to ' + st + '. ') : '') +
          (q ? (tgt || closing ? '' : 'Feedback wanted: ') + q : (tgt ? 'Please note on this task what you will do and by when.' : ''));
        // The note goes on before the task closes, so no task is ever closed without one.
        if (closing) { sfkInsert_('FeedItem', { ParentId: it.id, Body: body.trim() }); sfkPatchTask_(it.id, patch); }
        else { if (Object.keys(patch).length) sfkPatchTask_(it.id, patch); if (body.trim() !== head) sfkInsert_('FeedItem', { ParentId: it.id, Body: body.trim() }); }
        res = [tgt ? 'moved to ' + tgt.name.split(' ')[0] : '', patch.ActivityDate ? 're-dated' : '', closing ? 'closed' : (st ? 'set to ' + st : ''), q && !closing ? 'asked' : ''].filter(String).join(', ');
      } else if (it.src === 'Performance letter' && !tgt && (st || q)) {
        if (st) {
          if (ppmClosing_(st) && !q) throw new Error('Write the note first: say why the letter is closed.');
          ppmSetStatus_(it.ref, st, q, who);
          res = ppmClosing_(st) ? 'letter closed' : 'letter set to ' + st;
        } else { ppmComment_(it.ref, q, who, 'Comment'); res = 'comment on the letter'; }
      } else {
        var owner = tgt || targets['kamla'] || targets[sid] || null;
        if (!owner) throw new Error('No one to give it to: choose a desk.');
        var id = sfkInsert_('Task', { Subject: ('[' + it.src + '] ' + it.t).slice(0, 255), OwnerId: owner.id, ActivityDate: /^\d{4}-\d{2}-\d{2}$/.test(nd) ? nd : day,
          Status: 'In Progress', Task_Type__c: 'RR Operations',
          Description: it.src + ' · ' + it.id.replace(/^[a-z]{2}:/, '') + '\nWhy it is here: ' + it.why + (it.on ? '\nWas with: ' + it.on : '') + (q ? '\n\nInstruction: ' + q : '') });
        try { sfkInsert_('FeedItem', { ParentId: id, Body: head + '\n\n' + (q || 'From the command centre: ' + it.why + '. Note what you did, then close.') }); } catch (e) {}
        res = 'task for ' + owner.name.split(' ')[0];
      }
    } catch (e) { res = 'NOT SAVED: ' + String(e && e.message || e).slice(0, 160); }
    out.push({ s: it.src + ' · ' + it.t, res: res });
  });
  if (!out.length) return cmdReplyPage_(person, day, 'Nothing chosen. Set a status, pick a desk or a date, or type a note under an item.');
  try { runlog_('cmd ' + sid + ' ' + out.length + ' actions'); } catch (e) {}
  return cmdReplyPage_(person, day, '', '<b>' + out.filter(function (o) { return !/^NOT/.test(o.res); }).length + ' of ' + out.length + ' done.</b>' +
    out.map(function (o) { return '<div class="ln">' + (/^NOT/.test(o.res) ? '&#9888; ' : '&#10003; ') + esc_(o.s) + ' · <b>' + esc_(o.res) + '</b></div>'; }).join(''));
}
/* ─────────── Query Pal deep dive (18 Oct 2026) ───────────
 *  Ricky: "also in Query Pal, a deep dive." One page, read live from the Query
 *  Pal workbook (Queries and Comments): what is open and over its own
 *  turnaround, who holds it, which departments are slow to reply, what
 *  clients ask most, how queries arrive, what clients score us, how many
 *  chases a query takes, and whether the backlog is growing. The top of the
 *  page says it in sentences; the rest is the evidence. Read only: queries
 *  are closed in Query Pal, so the client is told.  */
var QP_DIVE = { WINDOW: 90, QUIET: 5, LIST: 12 };
function qpTurn_(s) { var t = String(s || ''), m = t.match(/(\d+)\s*(working\s*)?days?/i); return m ? Number(m[1]) : /same/i.test(t) ? 0 : 3; }
function qpDive_(day) {
  var comments = qpComments_();
  var q = bookRows_('QPAL', BOOKS.QPAL.tab).filter(function (r) { return String(r['Reference'] || '').trim(); }).map(function (r) {
    var opened = sfkDay_(r['Timestamp']), closed = anyIso_(r['Date Closed']), isOpen = !/closed/i.test(String(r['Status'] || ''));
    var turn = qpTurn_(r['Turnaround']), dtc = r['Days to Close'];
    var days = isOpen ? daysBetween_(opened, day) : (dtc !== '' && dtc != null && !isNaN(Number(dtc)) ? Number(dtc) : (closed ? daysBetween_(opened, closed) : null));
    var lb = String(r['Logged By'] || ''), c = comments[qpCode_(r['Reference'])] || [];
    return { ref: String(r['Reference']), code: qpCode_(r['Reference']), opened: opened, closed: closed, open: isOpen, status: String(r['Status'] || ''),
      channel: /^client/i.test(lb) ? 'Client (online)' : /^staff/i.test(lb) ? 'Staff' : /agent/i.test(lb) ? 'Agent' : 'Other',
      agent: String(r['Agent'] || '').trim(), client: String(r['Client/Name'] || ''), type: String(r['Query Type'] || r['Category'] || 'Other'),
      dept: String(r['Department'] || 'Unknown'), turn: turn, urgent: /urgent/i.test(String(r['Priority'] || '')), subject: String(r['Subject'] || ''),
      desk: String(r['Assigned To'] || '').trim() || 'Unassigned', days: days, over: days != null && days > turn, fu: Number(r['Follow-ups'] || 0) || 0,
      score: r['Score'] === '' || r['Score'] == null || isNaN(Number(r['Score'])) ? null : Number(r['Score']), survey: anyIso_(r['Survey Sent']),
      deptReplied: anyIso_(r['Dept Replied']), feedback: String(r['Feedback'] || ''), last: c[0] || null, comments: c.length };
  });
  var since = shiftDays_(day, -QP_DIVE.WINDOW), m30 = shiftDays_(day, -30), m60 = shiftDays_(day, -60);
  var open = q.filter(function (x) { return x.open; });
  var recent = q.filter(function (x) { return x.opened >= since; });
  var closedIn = function (from, to) { return q.filter(function (x) { return !x.open && x.closed && x.closed >= from && x.closed < to && x.days != null; }); };
  var c30 = closedIn(m30, shiftDays_(day, 1)), cPrev = closedIn(m60, m30), c90 = closedIn(since, shiftDays_(day, 1));
  var avg = function (l, f) { var v = l.map(f).filter(function (n) { return n != null && !isNaN(n); }); return v.length ? Math.round(10 * v.reduce(function (a, b) { return a + b; }, 0) / v.length) / 10 : null; };
  var group = function (list, key) { var g = {}; list.forEach(function (x) { var k = x[key] || 'Unknown'; (g[k] = g[k] || []).push(x); }); return g; };
  var weeks = [];
  for (var w = 5; w >= 0; w--) {
    var to = shiftDays_(day, -7 * w + 1), from = shiftDays_(day, -7 * w - 6);
    weeks.push({ from: from, opened: q.filter(function (x) { return x.opened >= from && x.opened < to; }).length, closed: q.filter(function (x) { return x.closed && x.closed >= from && x.closed < to; }).length });
  }
  var d = {
    q: q, open: open, over: open.filter(function (x) { return x.over; }).sort(function (a, b) { return (b.days - b.turn) - (a.days - a.turn); }),
    urgent: open.filter(function (x) { return x.urgent; }), quiet: open.filter(function (x) { return !x.last || daysBetween_(x.last.day, day) >= QP_DIVE.QUIET; }),
    unassigned: open.filter(function (x) { return x.desk === 'Unassigned'; }),
    avg30: avg(c30, function (x) { return x.days; }), avgPrev: avg(cPrev, function (x) { return x.days; }),
    onTime30: c30.length ? Math.round(100 * c30.filter(function (x) { return !x.over; }).length / c30.length) : null, closed30: c30.length,
    ages: [['0–1 days', 0, 1], ['2–3', 2, 3], ['4–7', 4, 7], ['8–14', 8, 14], ['15–30', 15, 30], ['31+', 31, 1e9]].map(function (b) { return { l: b[0], n: open.filter(function (x) { return x.days >= b[1] && x.days <= b[2]; }).length }; }),
    desks: [], depts: [], types: [], channels: [], agents: [], weeks: weeks,
    scored: c90.filter(function (x) { return x.score != null; }), surveyed: c90.filter(function (x) { return x.survey; }).length, c90: c90.length,
    heavy: c90.concat(open).filter(function (x) { return x.fu >= 3; }).sort(function (a, b) { return b.fu - a.fu; }), avgFu: avg(c90, function (x) { return x.fu; })
  };
  d.avgScore = avg(d.scored, function (x) { return x.score; });
  d.low = d.scored.filter(function (x) { return x.score <= 3; });
  var gd = group(open.concat(c90), 'desk');
  d.desks = Object.keys(gd).map(function (k) { var l = gd[k], cl = l.filter(function (x) { return !x.open; });
    return { k: k, open: l.filter(function (x) { return x.open; }).length, over: l.filter(function (x) { return x.open && x.over; }).length, closed: cl.length,
             avg: avg(cl, function (x) { return x.days; }), onTime: cl.length ? Math.round(100 * cl.filter(function (x) { return !x.over; }).length / cl.length) : null }; })
    .sort(function (a, b) { return (b.open - a.open) || (b.closed - a.closed); });
  var gp = group(open.concat(c90), 'dept');
  d.depts = Object.keys(gp).map(function (k) { var l = gp[k], cl = l.filter(function (x) { return !x.open; });
    var ts = l.map(function (x) { return x.turn; }), lo = Math.min.apply(null, ts), hi = Math.max.apply(null, ts);
    return { k: k, n: l.length, open: l.filter(function (x) { return x.open; }).length, noReply: l.filter(function (x) { return x.open && !x.deptReplied; }).length,
             avg: avg(cl, function (x) { return x.days; }), turn: hi, turnText: lo === hi ? String(hi) : lo + '–' + hi,
             onTime: cl.length ? Math.round(100 * cl.filter(function (x) { return !x.over; }).length / cl.length) : null }; })
    .sort(function (a, b) { return (b.avg || 0) - (a.avg || 0); });
  var gt = group(recent, 'type');
  d.types = Object.keys(gt).map(function (k) { return { k: k, n: gt[k].length }; }).sort(function (a, b) { return b.n - a.n; });
  var gc = group(recent, 'channel');
  d.channels = Object.keys(gc).map(function (k) { return { k: k, n: gc[k].length }; }).sort(function (a, b) { return b.n - a.n; });
  var ga = group(recent.filter(function (x) { return x.agent; }), 'agent');
  d.agents = Object.keys(ga).map(function (k) { return { k: k, n: ga[k].length }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 6);
  d.recent = recent.length;
  // What it says, in sentences.
  var says = [];
  var o7 = weeks[5].opened, cl7 = weeks[5].closed;
  says.push(o7 > cl7 ? 'The backlog is growing: ' + o7 + ' opened and ' + cl7 + ' closed in the last seven days.' : o7 < cl7 ? 'The backlog is coming down: ' + cl7 + ' closed against ' + o7 + ' opened in the last seven days.' : 'Steady: ' + o7 + ' opened and ' + cl7 + ' closed in the last seven days.');
  if (d.over.length) { var od = group(d.over, 'desk'), top = Object.keys(od).sort(function (a, b) { return od[b].length - od[a].length; })[0];
    says.push(d.over.length + ' of ' + open.length + ' open queries are past their own turnaround; ' + top + ' holds ' + od[top].length + '. The worst is ' + d.over[0].code + ', ' + d.over[0].days + ' days on a ' + d.over[0].turn + '-day turnaround.'); }
  var slow = d.depts.filter(function (x) { return x.avg != null && x.avg > x.turn; })[0];
  if (slow) says.push(slow.k + ' is the slowest: ' + slow.avg + ' days on average against a ' + slow.turnText + '-day turnaround' + (slow.noReply ? ', and ' + slow.noReply + ' open quer' + (slow.noReply === 1 ? 'y has' : 'ies have') + ' had no reply from them' : '') + '. Escalate to the department head.');
  if (d.types.length && d.recent) { var tp = Math.round(100 * d.types[0].n / d.recent); if (tp >= 20) says.push('"' + d.types[0].k + '" is ' + tp + '% of what clients ask (' + d.types[0].n + ' of ' + d.recent + ' in ' + QP_DIVE.WINDOW + ' days). A ready answer, or a self-serve page on querymypolicy.com, would take that volume off the desks.'); }
  if (d.avg30 != null && d.avgPrev != null && d.avg30 !== d.avgPrev) says.push('Average time to close is ' + d.avg30 + ' days this month, ' + (d.avg30 < d.avgPrev ? 'down' : 'up') + ' from ' + d.avgPrev + ' the month before.');
  if (d.quiet.length) says.push(d.quiet.length + ' open quer' + (d.quiet.length === 1 ? 'y has' : 'ies have') + ' had no comment on the trail in ' + QP_DIVE.QUIET + ' days or more. A client waiting in silence is the complaint we can prevent.');
  if (d.low.length) says.push(d.low.length + ' client' + (d.low.length === 1 ? '' : 's') + ' scored us 3 or under in ' + QP_DIVE.WINDOW + ' days. Call each one back.');
  if (d.c90 && d.scored.length < d.c90 / 3) says.push('Only ' + d.scored.length + ' of ' + d.c90 + ' closed queries came back with a score. Ask for the score when the query closes.');
  if (d.unassigned.length) says.push(d.unassigned.length + ' open quer' + (d.unassigned.length === 1 ? 'y is' : 'ies are') + ' not assigned to anyone.');
  d.says = says;
  return d;
}

function qpBars_(list, label, value, opt) {
  opt = opt || {};
  var max = list.reduce(function (m, x) { return Math.max(m, value(x)); }, 0) || 1;
  // Long names (departments, query types) sit on their own line above the bar, so a phone shows them whole.
  return list.map(function (x) { var v = value(x), w = v > 0 ? Math.max(3, Math.round(100 * v / max)) : 0;
    return '<div class="bar' + (opt.stack ? ' s' : '') + '"><span class="n" title="' + esc_(label(x)) + '">' + esc_(label(x)) + '</span><span class="t"><i' + (opt.cls ? ' class="' + opt.cls(x) + '"' : '') + ' style="width:' + w + '%"></i></span><span class="c">' + esc_(opt.text ? opt.text(x) : String(v)) + '</span></div>'; }).join('');
}

function qpDivePage_(person, day) {
  var d;
  try { d = qpDive_(day); } catch (e) { return replyPage_('Query Pal deep dive', 'Query Pal could not be read just now: ' + esc_(String(e && e.message || e)), ''); }
  var tile = function (v, l, cls) { return '<div class="tile' + (cls ? ' ' + cls : '') + '"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>'; };
  var trend = d.avg30 != null && d.avgPrev != null ? (d.avg30 < d.avgPrev ? ' ↓' : d.avg30 > d.avgPrev ? ' ↑' : '') : '';
  var tiles = '<div class="tiles">' + tile(d.open.length, 'open now') + tile(d.over.length, 'past their turnaround', d.over.length ? 'r' : 'g') +
    tile(d.urgent.length, 'urgent, client waiting', d.urgent.length ? 'a' : '') + tile(d.avg30 == null ? '—' : d.avg30 + 'd' + trend, 'average to close, 30 days') +
    tile(d.onTime30 == null ? '—' : d.onTime30 + '%', 'closed on time, 30 days', d.onTime30 != null && d.onTime30 < 70 ? 'r' : 'g') +
    tile(d.avgScore == null ? '—' : d.avgScore + '/5', 'client score (' + d.scored.length + ')', d.avgScore != null && d.avgScore < 4 ? 'a' : '') +
    tile(d.quiet.length, 'open, silent ' + QP_DIVE.QUIET + '+ days', d.quiet.length ? 'a' : '') + tile(d.recent, 'raised in ' + QP_DIVE.WINDOW + ' days') + '</div>';
  var says = '<div class="card"><div class="bh">What it says</div>' + d.says.map(function (s) { return '<div class="ln">' + esc_(s) + '</div>'; }).join('') + '</div>';
  var qRow = function (x) {
    return '<details class="it"><summary><div class="hd"><span class="age ' + (x.over ? 'r' : '') + '">' + x.days + 'd</span><div class="tt">' + esc_(x.code) + ' · ' + esc_(shorten_(x.subject || x.type, 70)) +
      '<small>' + esc_(x.desk) + ' · ' + esc_(x.dept) + ' · ' + x.turn + '-day turnaround' + (x.urgent ? ' · urgent' : '') + '</small></div></div></summary>' +
      '<div class="ln">Client: <b>' + esc_(x.client) + '</b>' + (x.agent ? ' · agent ' + esc_(x.agent) : '') + ' · opened ' + esc_(shortDate_(x.opened)) + ' · ' + esc_(x.status) + '</div>' +
      '<div class="ln">Department reply: ' + (x.deptReplied ? esc_(shortDate_(x.deptReplied)) : '<b style="color:#DC3F3F">none yet</b>') + ' · chased ' + x.fu + ' time' + (x.fu === 1 ? '' : 's') + '</div>' +
      '<div class="ln">' + (x.last ? 'Last comment ' + esc_(shortDate_(x.last.day)) + ', ' + esc_(x.last.by) + ': ' + esc_(shorten_(x.last.text, 160)) : '<b style="color:#DC3F3F">No comment on the trail.</b>') + '</div></details>';
  };
  var act = d.over.length ? '<div class="card"><div class="bh">Act now · past their turnaround (' + d.over.length + ')</div>' + d.over.slice(0, QP_DIVE.LIST).map(qRow).join('') +
    (d.over.length > QP_DIVE.LIST ? '<div class="bf">and ' + (d.over.length - QP_DIVE.LIST) + ' more.</div>' : '') + '</div>' : '';
  var rest = d.open.filter(function (x) { return !x.over; }).sort(function (a, b) { return b.days - a.days; });
  var openCard = rest.length ? '<div class="card"><div class="bh">Open, within turnaround (' + rest.length + ')</div>' + rest.slice(0, QP_DIVE.LIST).map(qRow).join('') + '</div>' : '';
  var ages = '<div class="card"><div class="bh">Open, by age</div>' + qpBars_(d.ages, function (x) { return x.l; }, function (x) { return x.n; }, { cls: function (x) { return /15|31/.test(x.l) ? 'r' : ''; } }) + '</div>';
  var desks = d.desks.length ? '<div class="card"><div class="bh">By desk · open now, and closed in ' + QP_DIVE.WINDOW + ' days</div>' +
    qpBars_(d.desks, function (x) { return x.k.split(' ')[0]; }, function (x) { return x.open; }, { cls: function (x) { return x.over ? 'r' : ''; }, text: function (x) { return x.open + ' open' + (x.over ? ', ' + x.over + ' late' : ''); } }) +
    d.desks.filter(function (x) { return x.closed; }).map(function (x) { return '<div class="ln" style="font-size:13px">' + esc_(x.k) + ': closed <b>' + x.closed + '</b>, average <b>' + x.avg + (x.avg === 1 ? ' day' : ' days') + '</b>, on time <b' + (x.onTime < 70 ? ' style="color:#DC3F3F"' : '') + '>' + x.onTime + '%</b></div>'; }).join('') + '</div>' : '';
  var depts = d.depts.length ? '<div class="card"><div class="bh">Departments · average days to close, slowest first</div>' +
    qpBars_(d.depts.filter(function (x) { return x.avg != null; }).slice(0, 8), function (x) { return x.k; }, function (x) { return x.avg; }, { stack: true, cls: function (x) { return x.avg > x.turn ? 'r' : 'g'; }, text: function (x) { return x.avg + 'd / ' + x.turnText + 'd'; } }) +
    d.depts.filter(function (x) { return x.noReply; }).map(function (x) { return '<div class="ln" style="font-size:13px"><b>' + esc_(x.k) + '</b>: ' + x.noReply + ' open with no reply from the department</div>'; }).join('') + '</div>' : '';
  var types = d.types.length ? '<div class="card"><div class="bh">What clients ask · ' + QP_DIVE.WINDOW + ' days</div>' + qpBars_(d.types.slice(0, 8), function (x) { return x.k; }, function (x) { return x.n; }, { stack: true, text: function (x) { return x.n + ' · ' + Math.round(100 * x.n / d.recent) + '%'; } }) + '</div>' : '';
  var chans = d.channels.length ? '<div class="card"><div class="bh">How queries arrive</div>' + qpBars_(d.channels, function (x) { return x.k; }, function (x) { return x.n; }, { text: function (x) { return Math.round(100 * x.n / d.recent) + '%'; } }) + '</div>' : '';
  var wk = '<div class="card"><div class="bh">Six weeks · opened and closed</div>' + d.weeks.map(function (w) {
    var m = Math.max(1, d.weeks.reduce(function (a, x) { return Math.max(a, x.opened, x.closed); }, 0));
    return '<div class="bar"><span class="n">w/c ' + esc_(shortDate_(w.from).replace(/^\w+ /, '')) + '</span><span class="t" style="display:flex;flex-direction:column;gap:2px;height:auto;background:none"><i style="height:6px;width:' + (w.opened ? Math.max(3, Math.round(100 * w.opened / m)) : 0) + '%"></i><i class="g" style="height:6px;width:' + (w.closed ? Math.max(3, Math.round(100 * w.closed / m)) : 0) + '%"></i></span><span class="c">' + w.opened + ' in · ' + w.closed + ' out</span></div>'; }).join('') +
    '<div class="bf">Dark: opened. Green: closed.</div></div>';
  var sat = '<div class="card"><div class="bh">Client satisfaction · ' + QP_DIVE.WINDOW + ' days</div><div class="ln">Surveys sent on <b>' + d.surveyed + '</b> of ' + d.c90 + ' closed; <b>' + d.scored.length + '</b> scored' + (d.avgScore != null ? ', average <b>' + d.avgScore + ' / 5</b>' : '') + '.</div>' +
    d.low.map(function (x) { return '<div class="ln" style="font-size:13px"><b style="color:#DC3F3F">' + x.score + '/5</b> · ' + esc_(x.code) + ' · ' + esc_(x.client) + ' · ' + esc_(x.desk) + (x.feedback ? ' · "' + esc_(shorten_(x.feedback, 120)) + '"' : '') + '</div>'; }).join('') + '</div>';
  var fu = d.heavy.length || d.avgFu ? '<div class="card"><div class="bh">Chasing · follow-ups a query takes</div><div class="ln">Average <b>' + (d.avgFu || 0) + '</b> follow-ups per closed query.</div>' +
    d.heavy.slice(0, 8).map(function (x) { return '<div class="ln" style="font-size:13px"><b>' + x.fu + ' chases</b> · ' + esc_(x.code) + ' · ' + esc_(x.dept) + (x.open ? ' · <b style="color:#DC3F3F">still open</b>' : ' · closed in ' + x.days + ' days') + '</div>'; }).join('') + '</div>' : '';
  var ag = d.agents.length ? '<div class="card"><div class="bh">Agents raising the most · ' + QP_DIVE.WINDOW + ' days</div>' + qpBars_(d.agents, function (x) { return x.k; }, function (x) { return x.n; }) + '</div>' : '';
  return replyPage_('Query Pal deep dive · ' + prettyDate_(day), 'Read live from Query Pal. Close queries in Query Pal itself, so the client is told.',
    tiles + says + act + ages + desks + depts + types + chans + wk + sat + fu + ag + openCard);
}
/** The command centre's Query Pal card, with the way into the deep dive. */
function cmdQpSnapshot_(sid, day) {
  var d = qpDive_(day);
  return '<div class="card"><div class="bh">Query Pal</div><div class="ln"><b>' + d.open.length + '</b> open · <b style="color:' + (d.over.length ? '#DC3F3F' : '#2C7A57') + '">' + d.over.length + '</b> past turnaround · <b>' + d.urgent.length + '</b> urgent' +
    (d.avg30 != null ? ' · ' + d.avg30 + ' days to close' : '') + '</div>' + (d.says[1] ? '<div class="ln" style="font-size:13px">' + esc_(d.says[1]) + '</div>' : '') +
    '<a href="' + esc_(replyUrl_(sid, day, 'qp')) + '" target="_top" style="display:block;text-align:center;padding:12px;margin-top:6px;border:1.5px solid #141C4A;border-radius:10px;text-decoration:none">Query Pal deep dive &rarr;</a></div>';
}
/** The same, for the 5am e-mail. */
function qpMailCard_(sid, day) {
  var d = qpDive_(day);
  return srcCard_('Query Pal · ' + d.open.length + ' open, ' + d.over.length + ' past turnaround', d.over.length ? MAIL.red : MAIL.green,
    d.says.slice(0, 3).map(esc_), '') + replyButton_(replyUrl_(sid, day, 'qp'), 'Query Pal deep dive', 'Who holds what, which departments are slow, what clients ask, and what they score us.');
}

/* ─────────── Fact finds: none done, a response is asked for (18 Oct 2026) ───────────
 *  Ricky: "in the agents' fact find, if a person is not doing it, it should
 *  trigger an e-mail requesting a response."
 *  Monday from 7:00: every agent with no fact find in FF_CHASE.DAYS days (the
 *  Fact Finding Interviews in Salesforce, and nothing this week on FactFind360)
 *  is asked by e-mail for a response: what stopped them, and how many they will
 *  complete by Friday. One page, no sign-in, and the link is good all week.
 *  The answer is kept on the Fact Find Responses tab, sent back to the agent
 *  with sales support and their Unit Manager copied, and when they ask for help
 *  (appointments, names to call, the fact find itself) it becomes a Salesforce
 *  task for their manager. Wednesday from 7:00, whoever has not answered is
 *  reminded, their manager copied. Friday from 7:00, the Branch Manager and the
 *  Unit Managers get the week: who was asked, who answered, what each committed
 *  and what they have done since.
 *  Script Property FF_CHASE: 'live' sends to the agents; 'preview' sends the
 *  Branch Manager one sample and the list instead; 'off' stops it. Unset, it
 *  follows AGENT_DAY. Every send checks the day's e-mail quota first.  */
var FF_CHASE = { DAYS: 14, AT: 7 * 60, WINDOW: 150, PER_RUN: 6, QUOTA_FLOOR: 25 };
var FFRESP = { must: ['Week', 'Agent', 'Reason'], name: 'Fact Find Responses',
  head: ['Week', 'Agent', 'Name', 'Email', 'Manager', 'Last Fact Find', 'Reason', 'Commit', 'Who When', 'Help', 'Note', 'At'] };
var FF_REASONS = [
  { id: 'booked', label: 'I have fact finds booked this week' },
  { id: 'unlogged', label: 'I did them, but they are not on FactFind360' },
  { id: 'appts', label: 'I cannot get appointments: I need help getting in front of clients', help: true },
  { id: 'leads', label: 'I need names to call', help: true },
  { id: 'skills', label: 'I need help with the fact find itself', help: true },
  { id: 'leave', label: 'I am on leave or not working this week' },
  { id: 'other', label: 'Something else' }
];
function ffMode_() {
  var p = ''; try { p = String(PropertiesService.getScriptProperties().getProperty('FF_CHASE') || '').trim().toLowerCase(); } catch (e) {}
  return /^(live|preview|off)$/.test(p) ? p : agentMode_();
}
function ffWeek_(day) { return shiftDays_(day, 1 - isoDow_(day)); }
function ffReason_(id) { return FF_REASONS.filter(function (r) { return r.id === id; })[0] || null; }

/** Fact finds per agent e-mail from Salesforce: { email: { last, n14, week } }. */
function ffSalesforce_(emails, day) {
  var out = {}, week = ffWeek_(day);
  for (var i = 0; i < emails.length; i += 100) {
    try {
      sfkQuery_('SELECT Agent_Email__c, Date_of_Interview__c, CreatedDate FROM Fact_Finding_Interviews__c WHERE Agent_Email__c IN (' +
        emails.slice(i, i + 100).map(soqlStr_).join(',') + ') ORDER BY CreatedDate DESC LIMIT 2000').forEach(function (r) {
        var e = String(r.Agent_Email__c || '').toLowerCase(), on = String(r.Date_of_Interview__c || r.CreatedDate || '').slice(0, 10); if (!e || !on) return;
        var x = out[e] = out[e] || { last: '', n14: 0, week: 0 };
        if (on > x.last) x.last = on;
        if (daysBetween_(on, day) <= FF_CHASE.DAYS) x.n14++;
        if (on >= week) x.week++;
      });
    } catch (e) {}
  }
  return out;
}
/** Every agent's fact-find position, the ones gone longest first. */
function ffStatus_(day, onlyKey) {
  var people = agentPeople_(), keys = Object.keys(people).filter(function (k) { return !onlyKey || k === onlyKey; });
  var sf = ffSalesforce_(keys.map(function (k) { return String(people[k].email).toLowerCase(); }), day);
  var feed = null; try { feed = ff360Feed_(); } catch (e) {}
  return keys.map(function (k) {
    var a = people[k], x = sf[String(a.email).toLowerCase()] || { last: '', n14: 0, week: 0 }, f3 = feed ? ff360Agent_(feed, [a.agentName, a.name]) : null, g = null;
    try { g = goalFor_(a.agentName, a.code || a.agentId); } catch (e) {}
    var since = x.last ? daysBetween_(x.last, day) : null;
    return { a: a, last: x.last, since: since, n14: x.n14, weekSf: x.week, f3: f3, goalWk: g ? g.ffWk : 0,
             weekDone: Math.max(x.week, f3 && f3.known ? f3.week : 0),
             active: (since != null && since <= FF_CHASE.DAYS) || !!(f3 && f3.known && f3.week > 0) };
  }).sort(function (p, q) { return (p.active - q.active) || ((q.since == null ? 9999 : q.since) - (p.since == null ? 9999 : p.since)); });
}
function ffResponses_(week) {
  var out = {};
  (hrRows_(FFRESP, false) || []).forEach(function (r) { if (isoDay_(r.Week) === week) out[String(r.Agent)] = r; });
  return out;
}
function ffFromList_(x, a) { return { a: a, last: x.last, since: x.since, goalWk: x.g || 0, f3: x.m == null ? null : { known: true, month: x.m, year: x.y } }; }

function ffAskMail_(s, week, kind) {
  var a = s.a, first = String(a.name).split(' ')[0];
  var lastTxt = s.last ? 'Your last fact find on record is from <b>' + esc_(shortDate_(s.last)) + '</b>, ' + s.since + ' days ago.' : 'There is <b>no fact find on record</b> under your name.';
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + (kind === 'remind' ? esc_(first) + ', your response on fact finds is still outstanding. ' : 'Good morning, ' + esc_(first) + '. ') +
      lastTxt + ' Every sale starts with a fact find, and the branch needs to know what is in the way. Tell us what stopped them, and how many you will complete by Friday.</div>' +
    statTiles_([
      { value: s.since == null ? '—' : s.since + 'd', label: 'since your last fact find', color: MAIL.red },
      { value: s.f3 && s.f3.known ? s.f3.month : '—', label: 'this month on FactFind360' },
      { value: s.f3 && s.f3.known ? s.f3.year : '—', label: 'this year' },
      { value: s.goalWk || '—', label: 'your own weekly goal' }
    ]) +
    replyButton_(replyUrl_(a.key, week, 'agff'), 'Give my response', 'One page, two minutes, no sign-in. The link is good all week.') +
    '<div style="font-size:13px;color:' + MAIL.muted + ';line-height:1.55;margin-top:10px">Your answer goes to your Unit Manager and sales support. If you need help (appointments, names to call, or the fact find itself), say so and your manager gets it as a task.' +
      (kind === 'remind' ? ' No response by Friday goes to Mr Rampersad.' : '') + '</div>' +
    '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';
  return { subject: (kind === 'remind' ? 'Reminder: ' : '') + 'Fact finds: your response is required · ' + a.name,
           html: shell_(kind === 'remind' ? 'Your response is outstanding' : 'Fact finds: your response', a.name + ' · week of ' + prettyDate_(week), body) };
}
function ffQuotaOk_() { try { return MailApp.getRemainingDailyQuota() > FF_CHASE.QUOTA_FLOOR; } catch (e) { return true; } }

/** From the ten-minute tick, weekdays: ask on Monday (Tuesday for any the quota held back), remind on Wednesday, the week on Friday. */
function ffChaseTick_(day, mins) {
  var mode = ffMode_(); if (mode === 'off') return [];
  if (mins < FF_CHASE.AT || mins > FF_CHASE.AT + FF_CHASE.WINDOW) return [];
  var dow = isoDow_(day), week = ffWeek_(day), props = PropertiesService.getScriptProperties(), out = [];
  var list = null; try { list = JSON.parse(props.getProperty('ff_list_' + week) || 'null'); } catch (e) {}
  if (!list && dow === 1) {
    list = ffStatus_(day).filter(function (s) { return !s.active; }).map(function (s) {
      return { k: s.a.key, last: s.last, since: s.since, m: s.f3 && s.f3.known ? s.f3.month : null, y: s.f3 && s.f3.known ? s.f3.year : null, g: s.goalWk }; });
    props.setProperty('ff_list_' + week, JSON.stringify(list).slice(0, 8900));
  }
  if (!list) return [];
  var people = agentPeople_(), resp = null, sent = 0;
  if (dow === 1 || dow === 2) {
    if (mode === 'preview') {
      if (dow !== 1 || props.getProperty('ff_prev_' + week) || !list.length) return [];
      props.setProperty('ff_prev_' + week, hhmm_(new Date()));
      if (ffPreview_(list, people, week)) out.push('fact-find preview, ' + list.length + ' agents');
      return out;
    }
    list.forEach(function (x) {
      var a = people[x.k];
      if (sent >= FF_CHASE.PER_RUN || !a || props.getProperty('ffq_' + x.k + '_' + week) || !ffQuotaOk_()) return;
      var mail = ffAskMail_(ffFromList_(x, a), week, 'ask');
      props.setProperty('ffq_' + x.k + '_' + week, hhmm_(new Date()));
      try { MailApp.sendEmail({ to: a.email, cc: DAYSTART_CC_DEFAULT, subject: mail.subject, htmlBody: mail.html }); sent++; out.push(a.name + ' (fact finds asked)'); }
      catch (e) { out.push(a.name + ' fact-find ask FAILED: ' + (e && e.message)); }
    });
  } else if (dow === 3 && mode === 'live') {
    resp = ffResponses_(week);
    list.forEach(function (x) {
      var a = people[x.k];
      if (sent >= FF_CHASE.PER_RUN || !a || resp[x.k] || !props.getProperty('ffq_' + x.k + '_' + week) || props.getProperty('ffr_' + x.k + '_' + week) || !ffQuotaOk_()) return;
      var mail = ffAskMail_(ffFromList_(x, a), week, 'remind'), cc = [DAYSTART_CC_DEFAULT], mgr = agentManagerEmail_(a);
      if (mgr && cc.indexOf(mgr) < 0) cc.push(mgr);
      props.setProperty('ffr_' + x.k + '_' + week, hhmm_(new Date()));
      try { MailApp.sendEmail({ to: a.email, cc: cc.join(','), subject: mail.subject, htmlBody: mail.html }); sent++; out.push(a.name + ' (fact finds reminded)'); }
      catch (e) { out.push(a.name + ' fact-find reminder FAILED: ' + (e && e.message)); }
    });
  } else if (dow === 5 && !props.getProperty('ff_sum_' + week)) {
    props.setProperty('ff_sum_' + week, hhmm_(new Date()));
    try { if (ffWeekSummary_(week, day, mode, list)) out.push('fact-find week'); } catch (e) { out.push('fact-find week FAILED: ' + (e && e.message)); }
  }
  return out;
}

function ffPreview_(list, people, week) {
  var mgr = managerEmails_(); if (!mgr.length || !list.length) return false;
  var first = people[list[0].k], sample = first ? ffAskMail_(ffFromList_(list[0], first), week, 'ask') : null;
  var rows = list.map(function (x) { var a = people[x.k]; return a ? '<div style="font-size:12.5px;padding:4px 0;border-top:1px solid ' + MAIL.line + '"><b>' + esc_(a.name) + '</b> · ' + (x.last ? 'last ' + esc_(shortDate_(x.last)) + ' (' + x.since + ' days)' : 'none on record') + (x.m != null ? ' · ' + x.m + ' this month' : '') + '</div>' : ''; }).join('');
  MailApp.sendEmail({ to: mgr.join(','), cc: DAYSTART_CC_DEFAULT, subject: '[Preview] Fact finds: ' + list.length + ' agent' + (list.length === 1 ? '' : 's') + ' with none in ' + FF_CHASE.DAYS + ' days',
    htmlBody: '<div style="background:#EEF9FD;border:1px solid #0EA5C9;padding:10px 14px;font:600 13px Segoe UI,Arial;margin:0 0 8px">Preview. In live mode each of these agents is asked for a response this morning, reminded on Wednesday, and you get the week on Friday. ' +
      'Switch on with Script Property FF_CHASE = live.</div>' + shell_('Fact finds: who would be asked', 'Week of ' + prettyDate_(week), rows) + (sample ? '<div style="margin-top:16px;font:600 12px Segoe UI,Arial;color:#6A7180">The e-mail ' + esc_(first.name) + ' would get:</div>' + sample.html : '') });
  return true;
}

/** Friday: the week, to the Branch Manager and the Unit Managers. */
function ffWeekSummary_(week, day, mode, list) {
  var mgr = managerEmails_(); if (!mgr.length) return false;
  var people = agentPeople_(), resp = ffResponses_(week), props = PropertiesService.getScriptProperties(), now = {};
  try { ffStatus_(day).forEach(function (s) { now[s.a.key] = s; }); } catch (e) {}
  var rows = list.filter(function (x) { return people[x.k]; }).map(function (x) {
    var a = people[x.k], r = resp[x.k], s = now[x.k] || {}, asked = mode === 'preview' || !!props.getProperty('ffq_' + x.k + '_' + week);
    var commit = r ? Number(r.Commit || 0) : null, done = s.weekDone || 0, rs = r ? ffReason_(String(r.Reason)) : null;
    return { a: a, asked: asked, r: r, commit: commit, done: done, kept: commit != null && done >= commit && commit > 0, why: rs ? rs.label : '' };
  });
  var answered = rows.filter(function (x) { return x.r; }), silent = rows.filter(function (x) { return x.asked && !x.r; });
  var committed = answered.reduce(function (n, x) { return n + (x.commit || 0); }, 0), done = rows.reduce(function (n, x) { return n + x.done; }, 0);
  var line = function (x) {
    return '<div style="font-size:12.5px;line-height:1.45;padding:6px 0;border-top:1px solid ' + MAIL.line + '"><b>' + esc_(x.a.name) + '</b> · ' +
      (x.r ? esc_(x.why) + ' · committed <b>' + x.commit + '</b>, done <b style="color:' + (x.kept ? MAIL.green : MAIL.red) + '">' + x.done + '</b>' + (x.r.Help ? ' · help asked: ' + esc_(shorten_(String(x.r.Help), 90)) : '')
           : '<b style="color:' + MAIL.red + '">no response</b>' + (x.done ? ' · ' + x.done + ' done this week' : '')) + '</div>';
  };
  var body = '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">The fact-find chase for the week of ' + esc_(prettyDate_(week)) + ': who had none in ' + FF_CHASE.DAYS + ' days on Monday, what they answered, and what they have done since.' + (mode === 'preview' ? ' <b>Preview mode: the agents were not e-mailed.</b>' : '') + '</div>' +
    statTiles_([
      { value: rows.length, label: 'asked for a response' },
      { value: answered.length, label: 'answered', color: MAIL.green },
      { value: silent.length, label: 'no response', color: silent.length ? MAIL.red : MAIL.navy },
      { value: done + (committed ? ' / ' + committed : ''), label: 'done this week / committed' }
    ]) +
    (silent.length ? sectionLabel_('No response · call them today (' + silent.length + ')') + silent.map(line).join('') : '') +
    (answered.length ? sectionLabel_('Answered (' + answered.length + ')') + answered.map(line).join('') : '') +
    '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:8px">Done: fact finds since Monday, the higher of Salesforce and FactFind360.</div>';
  var to = mgr.slice();
  if (mode === 'live') UM_DESKS.forEach(function (s) { var e = emailFor_(s); if (e && to.indexOf(e) < 0) to.push(e); });
  MailApp.sendEmail({ to: to.join(','), cc: DAYSTART_CC_DEFAULT, subject: 'Fact finds this week · ' + answered.length + ' of ' + rows.length + ' answered, ' + done + ' done' + (committed ? ' of ' + committed + ' committed' : ''),
    htmlBody: shell_('Fact finds · the week', 'Week of ' + prettyDate_(week), body) });
  return true;
}

/** The agent's page: what the record shows, and the response. */
function ffReplyPage_(person, week, error, notice) {
  var a = person.agent, first = String(a.name).split(' ')[0], day = todayISO_(), s = null, had = null;
  try { s = ffStatus_(day, a.key)[0]; } catch (e) {}
  try { had = ffResponses_(week)[a.key] || null; } catch (e) {}
  var tile = function (v, l, cls) { return '<div class="tile' + (cls ? ' ' + cls : '') + '"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>'; };
  var tiles = s ? '<div class="tiles">' + tile(s.since == null ? '—' : s.since + 'd', 'since your last fact find', 'r') + tile(s.weekDone, 'done this week') +
    tile(s.f3 && s.f3.known ? s.f3.month : '—', 'this month on FactFind360') + tile(s.goalWk || '—', 'your own weekly goal') + '</div>' : '';
  var v = function (k) { return had ? String(had[k] == null ? '' : had[k]) : ''; };
  var reasons = FF_REASONS.map(function (r) {
    return '<label class="t"><input type="radio" name="reason" value="' + r.id + '"' + (v('Reason') === r.id ? ' checked' : '') + ' required><span>' + esc_(r.label) + '</span></label>'; }).join('');
  return replyPage_('Your fact finds · week of ' + prettyDate_(week),
    'Two minutes. Your answer goes to your Unit Manager and sales support' + (s && s.last ? '; your last fact find on record is from ' + esc_(shortDate_(s.last)) : '') + '.',
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') + (notice ? '<div class="card ok">' + notice + '</div>' : '') +
    (had && !notice ? '<div class="card ok">You answered on ' + esc_(String(had.At || '')) + '. Sending again replaces it.</div>' : '') + tiles +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(a.key, week, 'agff') +
      '<div class="card"><div class="bh">What has stopped the fact finds?</div>' + reasons + '</div>' +
      '<div class="card"><div class="bh">Your commitment</div><div class="bf">Fact finds you will complete by Friday</div>' +
        '<input type="number" name="commit" min="0" max="50" inputmode="numeric" required value="' + esc_(v('Commit')) + '" style="width:120px">' +
        '<div class="bf" style="margin-top:10px">Who, and when (for the ones booked or done)</div><input type="text" name="who" value="' + esc_(v('Who When')) + '" placeholder="e.g. Ann Client, Tuesday 4pm">' +
        '<div class="bf" style="margin-top:10px">What help do you want from your manager or the branch?</div><input type="text" name="help" value="' + esc_(v('Help')) + '" placeholder="Leave blank if none">' +
        '<div class="bf" style="margin-top:10px">Anything else</div><textarea name="note" rows="3">' + esc_(v('Note')) + '</textarea></div>' +
      '<button type="submit">Send my response</button></form>');
}

function ffReplySave_(person, week, p) {
  var a = person.agent, reason = String(p.reason || ''), rs = ffReason_(reason), commit = String(p.commit == null ? '' : p.commit).trim();
  var who = String(p.who || '').trim(), help = String(p.help || '').trim(), note = String(p.note || '').trim();
  if (!rs) return ffReplyPage_(person, week, 'Choose what has stopped the fact finds.');
  if (!/^\d{1,2}$/.test(commit)) return ffReplyPage_(person, week, 'Put the number of fact finds you will complete by Friday; 0 if none.');
  if ((reason === 'booked' || reason === 'unlogged') && !who) return ffReplyPage_(person, week, 'Say who and when, for the ones booked or done.');
  if (reason === 'other' && !note) return ffReplyPage_(person, week, 'Say what has stopped them.');
  var s = null; try { s = ffStatus_(todayISO_(), a.key)[0]; } catch (e) {}
  var mgr = agentManagerEmail_(a), at = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm');
  var sh = hrTab_(FFRESP, true), head = headerOf_(sh);
  var row = { Week: week, Agent: a.key, Name: a.name, Email: a.email, Manager: mgr, 'Last Fact Find': s && s.last ? s.last : '', Reason: reason, Commit: Number(commit), 'Who When': who, Help: help, Note: note, At: at };
  sh.appendRow(head.map(function (h) { return row[h] != null ? row[h] : ''; }));
  forgetHr_(FFRESP);
  // Help asked for becomes the manager's task.
  var task = '';
  if (rs.help || help) {
    try {
      var users = sfkUsers_() || {}, owner = '';
      Object.keys(users).forEach(function (sid) { if (!owner && mgr && normEmail_(emailFor_(sid)) === normEmail_(mgr)) owner = users[sid].id; });
      owner = owner || bmSfId_();
      sfkInsert_('Task', { Subject: ('[Fact finds] ' + a.name + ': ' + rs.label.replace(/^I /, '') + ' · commits ' + commit + ' by Friday').slice(0, 255), OwnerId: owner,
        ActivityDate: shiftDays_(todayISO_(), isoDow_(todayISO_()) >= 5 ? 8 - isoDow_(todayISO_()) : 1), Status: 'Not Started', Task_Type__c: 'RR Operations',
        Description: a.name + ' answered the fact-find chase for the week of ' + week + '.\nReason: ' + rs.label + '\nCommitment: ' + commit + ' by Friday' + (who ? '\nWho and when: ' + who : '') + (help ? '\nHelp asked for: ' + help : '') + (note ? '\n\n' + note : '') });
      task = 'Your manager has it as a task.';
    } catch (e) { task = ''; }
  }
  var body = '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">Thank you, ' + esc_(String(a.name).split(' ')[0]) + '. Your response is in.</div>' +
    srcCard_('Your response · week of ' + prettyDate_(week), MAIL.green, [ '<b>' + esc_(rs.label) + '</b>', 'Committed: <b>' + esc_(commit) + '</b> fact finds by Friday' ]
      .concat(who ? ['Who and when: ' + esc_(who)] : []).concat(help ? ['Help asked for: ' + esc_(help)] : []).concat(note ? [esc_(note)] : []), task);
  var mail = { subject: 'Fact finds: response received · ' + a.name + ' · ' + commit + ' by Friday', html: shell_('Your fact-find response', a.name + ' · week of ' + prettyDate_(week), body) };
  try {
    var mode = ffMode_(), cc = [DAYSTART_CC_DEFAULT]; if (mgr && cc.indexOf(mgr) < 0) cc.push(mgr);
    if (mode === 'live') MailApp.sendEmail({ to: a.email, cc: cc.join(','), subject: mail.subject, htmlBody: mail.html });
    else if (mode === 'preview') { var m = managerEmails_(); if (m.length) MailApp.sendEmail({ to: m.join(','), subject: '[Preview] ' + mail.subject, htmlBody: mail.html }); }
  } catch (e) {}
  return replyPage_('Thank you · your response is in', 'Your Unit Manager and sales support have it. ' + task,
    '<div class="card ok"><div class="ln"><b>' + esc_(rs.label) + '</b></div><div class="ln">Committed: <b>' + esc_(commit) + '</b> by Friday</div>' +
      (who ? '<div class="ln">Who and when: ' + esc_(who) + '</div>' : '') + (help ? '<div class="ln">Help asked for: ' + esc_(help) + '</div>' : '') + '</div>' +
    '<div class="card"><div class="bf">Log each fact find on FactFind360 the day you do it, so the branch sees it.</div></div>');
}

/** The command centre's fact-find card: this week's chase. */
function cmdFfSnapshot_(sid, day) {
  var week = ffWeek_(day), props = PropertiesService.getScriptProperties(), list = null;
  try { list = JSON.parse(props.getProperty('ff_list_' + week) || 'null'); } catch (e) {}
  if (!list || !list.length) return '';
  var people = agentPeople_(), resp = ffResponses_(week), mine = UM_DESKS.indexOf(sid) > -1 ? normEmail_(emailFor_(sid)) : '';
  list = list.filter(function (x) { var a = people[x.k]; return a && (!mine || normEmail_(agentManagerEmail_(a)) === mine); });
  if (!list.length) return '';
  var ans = list.filter(function (x) { return resp[x.k]; }), silent = list.filter(function (x) { return !resp[x.k]; });
  var committed = ans.reduce(function (n, x) { return n + Number(resp[x.k].Commit || 0); }, 0);
  return '<div class="card"><div class="bh">Fact finds · this week\'s chase' + (ffMode_() === 'preview' ? ' (preview: agents not e-mailed)' : '') + '</div>' +
    '<div class="ln"><b>' + list.length + '</b> with none in ' + FF_CHASE.DAYS + ' days · <b style="color:#2C7A57">' + ans.length + '</b> answered, committing <b>' + committed + '</b> · <b style="color:' + (silent.length ? '#DC3F3F' : '#2C7A57') + '">' + silent.length + '</b> silent</div>' +
    (silent.length ? '<div class="ln" style="font-size:13px">No response: ' + esc_(silent.map(function (x) { return people[x.k].name; }).join(', ')) + '</div>' : '') +
    ans.filter(function (x) { return resp[x.k].Help; }).map(function (x) { return '<div class="ln" style="font-size:13px"><b>' + esc_(people[x.k].name) + '</b> asks for help: ' + esc_(shorten_(String(resp[x.k].Help), 120)) + '</div>'; }).join('') + '</div>';
}

/** The Unit Manager: his agents' open performance letters. */
function umLetters_(sid, day) { try { return ppmCard_(ppmLetters_(unitAgents_(sid)), day, 'Performance letters in your unit'); } catch (e) { return ''; } }
/** An agent's own open performance letter. */
function agLetter_(a, day) {
  try {
    var l = ppmLetters_([a.agentName, a.name]); if (!l.length) return '';
    var r = l[0];
    return srcCard_('Your performance letter · ' + esc_(r['Performance Period']), MAIL.red,
      [ esc_(r['Letter Type']) + ' · ' + esc_(r['Status']) + lateTag_(anyIso_(r['Due Date']), day),
        'Target API <b>' + ff360Money_(r['Target API']) + '</b> · submitted <b>' + ff360Money_(r['Submitted API']) + '</b> · settled <b>' + ff360Money_(r['Settled API']) + '</b>',
        'Open it and submit your signed response; this line stays in your morning e-mail until you do.' ], '');
  } catch (e) { return ''; }
}
/** Pawan: motor renewals in the next 30 days, and balances owing. */
function motorCard_(day) {
  try {
    var horizon = shiftDays_(day, 30);
    var rows = bookRows_('MOTOR', BOOKS.MOTOR.tab).filter(function (r) { var d = anyIso_(r['Next Due']); return d && d >= shiftDays_(day, -7) && d <= horizon && !/renewed/i.test(String(r['Renewal Status'] || '')); })
      .sort(function (a, b) { return String(anyIso_(a['Next Due'])).localeCompare(String(anyIso_(b['Next Due']))); });
    var owing = bookRows_('MOTOR', BOOKS.MOTOR.tab).filter(function (r) { return /owing/i.test(String(r['Payment Status'] || '')); });
    var lines = rows.slice(0, 8).map(function (r) { return '<b>' + esc_(shorten_(r['Client Account'], 32)) + '</b> · ' + esc_(r['Policy #']) + lateTag_(anyIso_(r['Next Due']), day) + (Number(r['Balance Owing (TT$)'] || 0) > 0 ? ' · owing <b>TT$' + Math.round(Number(r['Balance Owing (TT$)'])).toLocaleString() + '</b>' : '') + (r['Reminders Sent'] ? ' · ' + esc_(String(r['Reminders Sent'])) + ' reminders' : ' · <span style="color:' + MAIL.red + '">no reminder sent</span>'); });
    if (owing.length) lines.push('<b style="color:' + MAIL.red + '">' + owing.length + ' motor polic' + (owing.length === 1 ? 'y' : 'ies') + ' with a balance owing</b> on the renewal book');
    return srcCard_('Motor renewals · next 30 days (' + rows.length + ')', MAIL.amber, lines, rows.length > 8 ? 'and ' + (rows.length - 8) + ' more on the Motor Renewal Book.' : '');
  } catch (e) { return ''; }
}

/** The day builder beyond Salesforce: each source's work for this person, put
 *  into the block whose focus fits it (by the block's focus and KPI words), so
 *  the morning plan says what to do in each block from every source, not only
 *  the Salesforce tasks. Display in the e-mail; the Salesforce items stay the
 *  plan's checkable rows. */
var _srcPlanMemo = {};
function srcPlan_(sid, day) {
  var mk = sid + '|' + day; if (_srcPlanMemo[mk]) return _srcPlanMemo[mk];
  var blocks = (scheduleFor_(sid) || {}).blocks || {}, ids = Object.keys(blocks), out = {};
  ids.forEach(function (b) { out[b] = []; });
  if (!ids.length) return (_srcPlanMemo[mk] = out);
  var place = function (re, fallback, html) {
    var hit = ids.filter(function (b) { return re.test(String(blocks[b].focus || '') + ' ' + String(blocks[b].kpi || '')); })[0];
    out[hit || (fallback === 'last' ? ids[ids.length - 1] : ids[0])].push(html);
  };
  var tag = function (t) { return '<span style="font-size:10.5px;font-weight:800;letter-spacing:.06em;color:' + MAIL.gold + '">' + t + '</span> '; };
  // Query Pal: assigned to me, oldest first
  try {
    var me = nameFor_(sid);
    openQueries_().filter(function (x) { return firstOf_(x.assigned) === firstOf_(me); }).slice(0, 3).forEach(function (x) {
      place(/quer|issue|service line|task mgmt|escalat/i, 'first', tag('QUERY PAL') + esc_(x.client) + ' · ' + esc_(shorten_(x.subject || x.type, 55)) + ' · <b style="color:' + (x.days > 3 ? MAIL.red : MAIL.amber) + '">' + x.days + 'd open</b>: close it or note the trail');
    });
  } catch (e) {}
  // Client call list: call-backs first, then the next calls
  try {
    var calls = bookRows_('SKILL', BOOKS.SKILL.calls).filter(function (r) { return sameDesk_(r['Caller'], sid) && !String(r['Done'] || '').trim(); });
    var back = calls.filter(function (r) { return String(r['Call-back'] || '').trim(); });
    if (calls.length) place(/survey|orphan|service quest|call|retention|premium due/i, 'first', tag('CALL LIST') + (back.length ? '<b style="color:' + MAIL.red + '">' + back.length + ' promised call-back' + (back.length === 1 ? '' : 's') + '</b>, then ' : '') +
      'the next <b>' + Math.min(10, calls.length) + '</b> of ' + calls.length + ' on your call list (' + esc_(String(calls[0]['Call for'] || 'call')) + ' first)');
  } catch (e) {}
  // Group clients: overdue or due within three days
  try {
    var soon = shiftDays_(day, 3);
    bookRows_('GROUP', BOOKS.GROUP.tasks).filter(function (r) { var d = anyIso_(r['Due']); return sameDesk_(r['Owner'], sid) && /^y/i.test(String(r['Open'] || '')) && d && d <= soon; })
      .sort(function (a, b) { return String(anyIso_(a['Due'])).localeCompare(String(anyIso_(b['Due']))); }).slice(0, 3).forEach(function (r) {
        place(/group|billing|recon|renewa|pension|benefit/i, 'first', tag('GROUP') + '<b>' + esc_(shorten_(r['Group'], 28)) + '</b> · ' + esc_(shorten_(r['Subject'], 55)) + lateTag_(anyIso_(r['Due']), day));
      });
  } catch (e) {}
  // Claims pending, for the claims desk
  try {
    if (sid === srcDesk_('claims')) {
      var pend = bookRows_('CLAIMS', BOOKS.CLAIMS.tab).filter(function (r) { return /pending/i.test(String(r['Status'] || '')); });
      if (pend.length) place(/claim|health|eb |customer care/i, 'first', tag('CLAIMS') + '<b>' + pend.length + '</b> payment pending: chase the oldest with EB Customer Care');
    }
  } catch (e) {}
  // Benefits requests, for the benefits desk
  try {
    if (sid === srcDesk_('eb')) {
      var rq = bookRows_('EB', BOOKS.EB.requests).filter(function (r) { return /^new$/i.test(String(r['Status'] || '').trim()) && String(r['Company'] || '').trim(); });
      rq.slice(0, 2).forEach(function (r) { place(/benefit|group|new business|opportun|quot/i, 'first', tag('BENEFITS') + '<b>' + esc_(r['Company']) + '</b> still New after ' + esc_(String(r['Chasers sent'] || 0)) + ' chasers: call ' + esc_(r['Contact'] || 'the contact') + ' and move it on'); });
    }
  } catch (e) {}
  // Log book and the mailbag
  try {
    var mb = mailbagToday_(day), mine = 0, myF = firstOf_(nameFor_(sid));
    Object.keys(mb.backlog).forEach(function (w) { if (firstOf_(w) === myF) mine += mb.backlog[w]; });
    var rt = mailbagRouter_(day, {});
    if (rt.router === sid) place(/task mgmt|report|mail|admin|document|send off/i, 'last', tag('MAILBAG') + 'You route the bag this week: <b>' + mb.backlogN + '</b> logged and not sent' + (mb.oldest ? ', oldest ' + esc_(shortDate_(mb.oldest)) : '') + '. Collect from each desk and send before you leave');
    else if (mine) place(/task mgmt|report|mail|admin|document|send off/i, 'last', tag('LOG BOOK') + '<b>' + mine + '</b> document' + (mine === 1 ? '' : 's') + ' you verified are not sent: hand them to ' + esc_(nameFor_(rt.router).split(' ')[0]));
  } catch (e) {}
  return (_srcPlanMemo[mk] = out);
}
function srcBlockLines_(sid, day, b) {
  var list = []; try { list = srcPlan_(sid, day)[b] || []; } catch (e) {}
  if (!list.length) return '';
  return '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + MAIL.navy + ';margin-top:9px">Also today, from the branch\'s other systems</div>' +
    list.map(function (h) { return '<div style="font-size:12.5px;line-height:1.45;padding:3px 0;border-top:1px solid ' + MAIL.line + '">' + h + '</div>'; }).join('');
}

function checkSources() {
  var day = todayISO_();
  ['sasha', 'elizabeth', 'azariah', 'kamla'].forEach(function (sid) { var h = branchCards_(sid, day); Logger.log(sid + ': ' + (h.match(/text-transform:uppercase[^>]*>([^<]+)</g) || []).map(function (x) { return x.replace(/.*>/, ''); }).join(' | ')); });
  Logger.log('BM: ' + (bmBranchCards_(day).match(/text-transform:uppercase[^>]*>([^<]+)</g) || []).map(function (x) { return x.replace(/.*>/, ''); }).join(' | '));
  Logger.log('Pawan motor: ' + (motorCard_(day) ? 'yes' : 'none'));
}

function checkMailbag() {
  var day = todayISO_(), rt = mailbagRouter_(day, {}), mb = mailbagToday_(day);
  Logger.log('Mailbag ' + day + ': router ' + rt.router + ' (scheduled ' + rt.scheduled + ', rota week ' + rt.week + ', next ' + rt.next + ')');
  Logger.log('Collected today ' + mb.todayN + ' ' + JSON.stringify(mb.today) + ' · backlog ' + mb.backlogN + ' ' + JSON.stringify(mb.backlog) + ' oldest ' + mb.oldest);
}
function checkBooks() {
  var sb = skillBank_(), names = Object.keys(sb);
  Logger.log('Skill Bank: ' + names.length + ' rows · agents ' + names.filter(function (k) { return sb[k].isAgent && sb[k].active; }).length);
  names.forEach(function (k) { var p = sb[k]; Logger.log('  ' + p.code + ' · ' + p.name + ' · ' + p.role + ' · unit ' + p.unit + ' · ' + p.email + (p.active ? '' : ' · INACTIVE')); });
  var q = openQueries_(); Logger.log('Query Pal open: ' + q.length); q.forEach(function (x) { Logger.log('  ' + x.ref + ' · ' + x.days + 'd · agent ' + (x.agent || '—') + ' · assigned ' + (x.assigned || '—')); });
  Logger.log('FY27 plans: ' + bookRows_('FF', BOOKS.FF.plans).length + ' · check-ins: ' + bookRows_('FF', BOOKS.FF.checks).length);
}

function agentPeople_() {
  var sb = {}; try { sb = skillBank_(); } catch (e) {}
  var fromBank = {};
  Object.keys(sb).forEach(function (k) {
    var p = sb[k]; if (!p.isAgent || !p.active || !p.email) return;
    var key = 'a-' + agSlug_(p.name);
    fromBank[key] = { key: key, name: p.name, agentName: p.name, agentId: p.code, email: p.email, role: 'Agent', manager: '', unit: p.unit, code: p.code };
  });
  if (Object.keys(fromBank).length) {
    // the Unit Manager's e-mail from the bank, when the unit names one
    Object.keys(fromBank).forEach(function (key) { var u = bkNk_(fromBank[key].unit); var um = sb[u]; if (um && um.isUM && um.email) fromBank[key].manager = um.email; });
    return fromBank;
  }
  if (typeof iAgentDirectory_ !== 'function') return {};
  var dir = {}, out = {}, skip = {};
  try { dir = iAgentDirectory_() || {}; } catch (e) { return {}; }
  try { skip = typeof iExcluded_ === 'function' ? iExcluded_() : {}; } catch (e) {}
  Object.keys(dir).forEach(function (k) {
    var p = dir[k];
    if (!p || !p.email) return;
    var role = typeof iRoleOf_ === 'function' ? iRoleOf_(p.role) : (/manager|staff|support/i.test(p.role || '') ? 'other' : 'agent');
    if (role !== 'agent') return;
    if (typeof iExcludes_ === 'function' && iExcludes_(skip, p.agentName || p.name || '')) return;
    var key = 'a-' + agSlug_(p.agentName || p.name);
    out[key] = { key: key, name: p.name, agentName: p.agentName || p.name, agentId: p.agentId || '', email: p.email,
                 role: p.role || '', manager: p.manager || '' };
  });
  return out;
}

function agentBySid_(sid) {
  var a = agentPeople_()[sid];
  return a ? { staffId: sid, name: a.name, agent: a } : null;
}

/** The agent's manager: the Access tab's manager e-mail; else the Unit Manager
 *  whose unit lists them; else the Branch Manager. */
function agentManagerEmail_(a) {
  if (a.manager) return a.manager;
  var nk = function (s) { return typeof iNameKey_ === 'function' ? iNameKey_(s) : String(s || '').toLowerCase(); };
  for (var i = 0; i < UM_DESKS.length; i++) {
    var names = [];
    try { names = unitAgents_(UM_DESKS[i]); } catch (e) {}
    if (names.some(function (n) { return nk(n) === nk(a.agentName) || nk(n) === nk(a.name); })) return emailFor_(UM_DESKS[i]);
  }
  return (managerEmails_() || [])[0] || '';
}

/** Salesforce for a batch of agents: open tasks for them, closed today, fact finds. */
function agentBatchData_(list, day) {
  var names = [], emails = [];
  list.forEach(function (a) {
    [a.agentName, a.name].forEach(function (n) { if (n && names.indexOf(n) === -1) names.push(n); });
    emails.push(String(a.email).toLowerCase());
  });
  var out = { open: {}, closed: {}, ff: {}, f360: {}, feed: null };
  var nk = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  try { out.feed = ff360Feed_(); } catch (e) {}
  list.forEach(function (a) { out.f360[a.key] = ff360Agent_(out.feed, [a.agentName, a.name]); });
  out.q = {}; out.goal = {}; out.orphan = {};
  var allQ = []; try { allQ = openQueries_(); } catch (e) {}
  list.forEach(function (a) {
    var nk2 = bkNk_(a.agentName);
    out.q[a.key] = allQ.filter(function (x) { return bkNk_(x.agent) === nk2; });
    try { out.goal[a.key] = goalFor_(a.agentName, a.code || a.agentId); } catch (e) { out.goal[a.key] = null; }
    try { out.orphan[a.key] = orphanFor_(a.agentName); } catch (e) { out.orphan[a.key] = null; }
  });
  var who = {};
  list.forEach(function (a) { who[nk(a.agentName)] = a.key; who[nk(a.name)] = a.key; out.open[a.key] = []; out.closed[a.key] = []; out.ff[a.key] = []; });
  if (!names.length) return out;
  var inList = names.map(soqlStr_).join(',');
  try {
    sfkQuery_('SELECT Id, Subject, Task_Type__c, ActivityDate, Status, Owner.Name, Agent__r.Name, LastModifiedDate FROM Task' +
      ' WHERE IsClosed = false AND Agent__r.Name IN (' + inList + ') AND ActivityDate <= ' + day + " AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%')" +
      ' ORDER BY ActivityDate ASC LIMIT 1500').forEach(function (r) {
        var k = who[nk(r.Agent__r && r.Agent__r.Name)]; if (!k) return;
        out.open[k].push({ id: r.Id, subject: shorten_(r.Subject, 95), ty: r.Task_Type__c || '', due: r.ActivityDate || '',
          late: !!(r.ActivityDate && r.ActivityDate < day), owner: (r.Owner && r.Owner.Name) || '', status: r.Status || '' });
      });
  } catch (e) {}
  try {
    sfkQuery_('SELECT Id, Subject, Owner.Name, Agent__r.Name FROM Task WHERE IsClosed = true AND Agent__r.Name IN (' + inList +
      ') AND CompletedDateTime >= ' + sfkUtcAt_(day, 0) + ' LIMIT 1000').forEach(function (r) {
        var k = who[nk(r.Agent__r && r.Agent__r.Name)]; if (!k) return;
        out.closed[k].push({ id: r.Id, subject: shorten_(r.Subject, 95), owner: (r.Owner && r.Owner.Name) || '' });
      });
  } catch (e) {}
  try {
    var byEmail = {}; list.forEach(function (a) { byEmail[String(a.email).toLowerCase()] = a.key; });
    sfkQuery_('SELECT Agent_Email__c, Full_Name__c, Occupation__c, Date_of_Interview__c, CreatedDate FROM Fact_Finding_Interviews__c' +
      ' WHERE Agent_Email__c IN (' + emails.map(soqlStr_).join(',') + ') ORDER BY CreatedDate DESC LIMIT 2000').forEach(function (r) {
        var k = byEmail[String(r.Agent_Email__c || '').toLowerCase()]; if (!k) return;
        out.ff[k].push({ name: r.Full_Name__c || '', occ: r.Occupation__c || '', on: r.Date_of_Interview__c || String(r.CreatedDate || '').slice(0, 10) });
      });
  } catch (e) {}
  return out;
}

/** The agent's book from Branch Intelligence: premium dues, lapses, pendings. */
function agentBook_(a, cache) {
  if (!cache || typeof iScope_ !== 'function') return null;
  try {
    var mine = iScope_(cache, { role: 'agent', agentName: a.agentName, agentId: a.agentId, name: a.name });
    var chase = (mine.dues && mine.dues.chase) || [];
    var mv = mine.movements || {};
    return {
      urgent: chase.filter(function (x) { return x.days >= 60; }),
      chase: chase,
      lapsed: mv.first ? [] : (mv.lapsed || []),
      slipped: mv.first ? [] : (mv.slipped || []),
      pend: ((mine.pending && mine.pending.rows) || []).filter(function (x) { return x.suspense > 0 || (x.age || 0) > 60 || x.chase === 'never'; }),
      follow: typeof iDueFollowUps_ === 'function' ? iDueFollowUps_(a.name) : []
    };
  } catch (e) { return null; }
}

function agRows_(key, day, kind) {
  var out = {};
  (hrRows_(AGDAY, true) || []).forEach(function (r) {
    if (isoDay_(r.Date) !== day || String(r.Agent) !== key || String(r.Kind) !== kind) return;
    out[String(r.Item)] = r;
  });
  return out;
}

function agWrite_(a, day, kind, rows) {
  var sh = hrTab_(AGDAY, true), head = headerOf_(sh), at = hhmm_(new Date()), mgr = agentManagerEmail_(a);
  rows.forEach(function (o) {
    o.Date = day; o.Agent = a.key; o.Email = a.email; o.Manager = mgr; o.Kind = kind; o.At = at;
    sh.appendRow(head.map(function (h) { return o[h] != null ? o[h] : ''; }));
  });
  forgetHr_(AGDAY);
}

/** Send to the agent, or in preview to the Branch Manager marked with who it was for. */
function agSend_(a, subject, html, ccList) {
  var mode = agentMode_();
  if (mode === 'off') return false;
  if (mode === 'preview') {
    var mgr = managerEmails_();
    if (!mgr.length) return false;
    MailApp.sendEmail({ to: mgr.join(','), subject: '[Preview] ' + subject,
      htmlBody: '<div style="background:#EEF9FD;border:1px solid #0EA5C9;padding:10px 14px;font:600 13px Segoe UI,Arial;margin:0 0 8px">' +
        'Preview. In live mode this goes to ' + esc_(a.email) + (ccList && ccList.length ? ', copied to ' + esc_(ccList.join(', ')) : '') +
        '. Switch on with Script Property AGENT_DAY = live.</div>' + html });
    return true;
  }
  var mail = { to: a.email, subject: subject, htmlBody: html };
  if (ccList && ccList.length) mail.cc = ccList.join(',');
  MailApp.sendEmail(mail);
  return true;
}

function agLine_(inner) { return '<div style="font-size:12.5px;line-height:1.45;padding:5px 0;border-top:1px solid ' + MAIL.line + '">' + inner + '</div>'; }
function agCard_(color, inner) { return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + color + ';border-radius:10px;padding:8px 15px">' + inner + '</div>'; }

function agentMorningMail_(a, day, data, cache) {
  var first = String(a.name).split(' ')[0];
  var open = (data.open[a.key] || []).slice().sort(function (x, y) { return (x.late === y.late ? 0 : x.late ? -1 : 1) || String(x.due).localeCompare(String(y.due)); });
  var ff = data.ff[a.key] || [];
  var book = agentBook_(a, cache);
  var lastFF = ff.length ? ff[0].on : '';
  var ffDays = lastFF ? daysSince_(lastFF) : null;
  var ff30 = ff.filter(function (f) { return f.on && daysSince_(f.on) <= 30; }).length;
  var f3 = (data.f360 || {})[a.key] || null;
  var g = (data.goal || {})[a.key] || null, qs = (data.q || {})[a.key] || [], orp = (data.orphan || {})[a.key] || null;
  var base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var items = open.slice(0, AGENT_LIST_MAX * 2).map(function (t) { return { id: t.id, s: t.subject, o: t.owner, due: t.due, late: t.late }; });
  try { PropertiesService.getScriptProperties().setProperty('ag_items_' + a.key + '_' + day, JSON.stringify(items).slice(0, 8900)); } catch (e) {}

  var btn = replyButton_(replyUrl_(a.key, day, 'ag'), 'Plan my day and comment', 'One page: your plan in numbers, and a comment on anything below. Comments go on Chatter. No sign-in.');
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">Good morning, ' + esc_(first) + '. Here is what the branch is working on for your clients today, what your book says, and where your fact finds stand. ' +
      'Set your plan for the day from the button: no plan by ' + esc_(twelve_(mmText_(AGENT_ABSENT_AT))) + ' reads as not working today. At midday you get your progress so far, and at 5:30 you close the day off.</div>' +
    statTiles_([
      { value: open.length, label: 'being worked for you', color: MAIL.navy },
      { value: book ? book.urgent.length : '—', label: 'premiums 60+ days', color: book && book.urgent.length ? MAIL.red : MAIL.navy },
      { value: book ? book.pend.length : '—', label: 'pendings stuck', color: book && book.pend.length ? MAIL.amber : MAIL.navy },
      (f3 && f3.known ? { value: f3.month, label: 'fact finds this month', color: f3.month ? MAIL.green : MAIL.red }
        : { value: ffDays == null ? '—' : ffDays + 'd', label: 'since last fact find', color: ffDays == null || ffDays > 30 ? MAIL.red : MAIL.green })
    ]) + btn +
    sectionLabel_('What the branch is actioning for you today (' + open.length + ')') +
    (open.length ? agCard_(MAIL.navy, open.slice(0, AGENT_LIST_MAX).map(function (t) {
      return agLine_('<b>' + esc_(String(t.owner).split(' ')[0] || '—') + '</b> · ' + esc_(t.subject) +
        (t.late ? ' <span style="color:' + MAIL.red + ';font-weight:700">· overdue since ' + esc_(shortDate_(t.due)) + '</span>' : ' <span style="color:' + MAIL.amber + '">· due today</span>') +
        (base ? ' <a href="' + esc_(base + t.id) + '" style="color:' + MAIL.navy + ';font-weight:700;font-size:12px">open &rarr;</a>' : ''));
    }).join('') + (open.length > AGENT_LIST_MAX ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:4px">and ' + (open.length - AGENT_LIST_MAX) + ' more on the page.</div>' : ''))
      : '<div style="font-size:13px;color:' + MAIL.muted + '">Nothing due for your clients today.</div>') +
    (book ? sectionLabel_('Your book') + agCard_(MAIL.red,
        (book.lapsed.length ? agLine_('<b style="color:' + MAIL.red + '">Lapsed last night: ' + book.lapsed.length + '</b> · ' + esc_(book.lapsed.slice(0, 4).map(function (x) { return x.client; }).join(', '))) : '') +
        (book.slipped.length ? agLine_('<b style="color:' + MAIL.amber + '">Slipped into arrears: ' + book.slipped.length + '</b> · ' + esc_(book.slipped.slice(0, 4).map(function (x) { return x.client; }).join(', '))) : '') +
        agLine_('<b>Premiums past 60 days: ' + book.urgent.length + '</b>' + (book.urgent.length ? ' · oldest: ' + esc_(book.urgent.slice(0, 4).map(function (x) { return x.client + ' (' + x.days + 'd)'; }).join(', ')) : '')) +
        agLine_('<b>Premium dues to chase: ' + book.chase.length + '</b>') +
        agLine_('<b>Pending business holding money: ' + book.pend.length + '</b>' + (book.pend.length ? ' · ' + esc_(book.pend.slice(0, 3).map(function (x) { return x.client + ' (' + (x.requirement || x.status || 'pending') + ')'; }).join(', ')) : '')) +
        (book.follow.length ? agLine_('<b>Follow-ups you promised, due: ' + book.follow.length + '</b> · ' + esc_(book.follow.slice(0, 3).map(function (x) { return x.client; }).join(', '))) : '')) : '') +
    (g ? sectionLabel_('Your FY27 goals · week ' + g.weeksIn + ' of 52') + agCard_(MAIL.gold,
        agLine_('<b>API goal ' + ff360Money_(g.api) + '</b> · by now you should be at <b>' + ff360Money_(g.paceApi) + '</b>' + (f3 && f3.known ? ' · picked up so far <b style="color:' + (f3.pickedUp >= g.paceApi ? MAIL.green : MAIL.red) + '">' + ff360Money_(f3.pickedUp) + '</b>' : '') + (g.title ? ' · aiming for <b>' + esc_(g.title) + '</b>' : '')) +
        agLine_('Your own weekly numbers: <b>' + g.contactsWk + '</b> contacts · <b>' + g.apptsWk + '</b> appointments · <b>' + g.ffWk + '</b> fact finds · <b>' + g.appsWk + '</b> apps' + (f3 && f3.known ? ' · this week so far: <b>' + f3.week + '</b> fact find' + (f3.week === 1 ? '' : 's') : '')) +
        (g.last ? agLine_('Last check-in (week ' + esc_(String(g.last.week)) + '): ' + g.last.contacts + ' contacts · ' + g.last.appts + ' appts · ' + g.last.ff + ' fact finds · ' + g.last.apps + ' apps' + (g.last.way ? ' · in the way: <i>' + esc_(shorten_(g.last.way, 90)) + '</i>' : '')) : agLine_('<span style="color:' + MAIL.red + ';font-weight:700">No weekly check-in yet.</span> Your plan is on factfind360.com; the check-in takes two minutes.')))
      : sectionLabel_('Your FY27 goals') + agCard_(MAIL.red, agLine_('<b>No goal plan on record for FY27.</b> The year began 1 October. Submit yours on factfind360.com today; the branch wall shows every advisor\'s API race.'))) +
    (qs.length ? sectionLabel_('Your clients\' open queries · Query Pal (' + qs.length + ')') + agCard_(MAIL.amber, qs.slice(0, 5).map(function (x) {
        return agLine_('<b>' + esc_(x.client) + '</b> · ' + esc_(shorten_(x.subject || x.type, 60)) + ' · with <b>' + esc_(String(x.assigned || 'unassigned').split(' ')[0]) + '</b> · <span style="color:' + (x.days > 3 ? MAIL.red : MAIL.muted) + '">' + x.days + ' days open</span>'); }).join('') +
        (qs.length > 5 ? '<div style="font-size:12px;color:' + MAIL.muted + '">and ' + (qs.length - 5) + ' more.</div>' : '')) : '') +
    (orp && (orp.households || orp.callbacks) ? sectionLabel_('Orphan clients assigned to you') + agCard_(MAIL.navy,
        agLine_('<b>' + orp.households + '</b> household' + (orp.households === 1 ? '' : 's') + ' assigned to you' + (orp.callbacks ? ' · <b style="color:' + MAIL.red + '">' + orp.callbacks + '</b> asked for a call and are still waiting' : ''))) : '') +
    agLetter_(a, day) +
    sectionLabel_('Fact finds' + (data.feed ? ' · FactFind360' : '')) + agCard_(f3 && f3.known ? (f3.month ? MAIL.green : MAIL.red) : (ffDays == null || ffDays > 30 ? MAIL.red : MAIL.green),
      (data.feed ? agLine_(f3 && f3.known ? '<b>' + f3.week + '</b> this week · <b>' + f3.month + '</b> this month · <b>' + f3.year + '</b> this year · picked up <b>' + ff360Money_(f3.pickedUp) + '</b> · pipeline <b>' + ff360Money_(f3.pipeline) + '</b>' +
          (f3.month ? '' : ' <span style="color:' + MAIL.red + ';font-weight:700">· none this month</span>')
        : '<b>No fact finds on FactFind360 this year</b> under your name.') : '') +
      (data.feed && data.feed.queue && Number(data.feed.queue.pending) ? agLine_('Branch review queue: <b>' + Number(data.feed.queue.pending) + '</b> waiting' + (Number(data.feed.queue.breaching) ? ', <b style="color:' + MAIL.red + '">' + Number(data.feed.queue.breaching) + ' past 3 days</b>' : '')) : '') +
      agLine_(ff.length ? '<b>' + ff.length + '</b> on record · <b>' + ff30 + '</b> in the last 30 days · last on <b>' + esc_(shortDate_(lastFF)) + '</b> (' + ffDays + ' days ago)' : '<b>No fact finds in Salesforce</b> under your e-mail.') +
      ff.slice(0, 3).map(function (f) { return agLine_(esc_(f.name || '—') + (f.occ ? ' · ' + esc_(f.occ) : '') + ' · ' + esc_(shortDate_(f.on)) + ' <span style="color:' + MAIL.muted + '">(' + daysSince_(f.on) + ' days: has it moved to a closing interview?)</span>'); }).join('')) +
    sectionLabel_('Your plan today') + agCard_(MAIL.gold, AGENT_METRICS.map(function (m) { return '<div style="font-size:13px;padding:2px 0">&#9675; ' + esc_(m.q) + '</div>'; }).join('') +
      '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:6px">A number against each on the page. At 5:30 you give what was done.</div>') + btn +
    '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';
  return agSend_(a, 'Your day · ' + a.name + ' · ' + shortDate_(day) + ' · ' + open.length + ' being worked for you' + (book ? ', ' + book.urgent.length + ' premiums 60+ days' : ''),
    shell_('Good morning · your day', a.name + ' · ' + prettyDate_(day), body), []);
}

/** Midday: how the day is going against the morning's plan, and what the
 *  branch has closed and still has open for the agent's clients. */
function agentMiddayMail_(a, day, data) {
  var first = String(a.name).split(' ')[0], plan = agRows_(a.key, day, 'plan'), planned = Object.keys(plan).length;
  var closed = data.closed[a.key] || [], open = data.open[a.key] || [];
  var late = open.filter(function (t) { return t.late; }).length;
  var btn = replyButton_(replyUrl_(a.key, day, 'ag'), planned ? 'Update my plan' : 'Plan my day now',
    planned ? 'Your plan from this morning, to change if the day has moved. Comments go on Chatter. No sign-in.' : 'No plan is in yet. One page, no sign-in.');
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + esc_(first) + ', it is midday. Here is your progress so far' +
      (planned ? ', against the plan you set this morning' : ': <b style="color:' + MAIL.red + '">no plan was set this morning</b>') + '. At 5:30 you close the day off.</div>' +
    statTiles_([
      { value: closed.length, label: 'the branch closed for you today', color: MAIL.green },
      { value: open.length, label: 'still open, due', color: open.length ? MAIL.amber : MAIL.navy },
      { value: late, label: 'of them overdue', color: late ? MAIL.red : MAIL.navy },
      { value: planned ? 'yes' : 'no', label: 'plan set today', color: planned ? MAIL.green : MAIL.red }
    ]) + btn +
    (planned ? sectionLabel_('Your plan this morning') + agCard_(MAIL.gold, AGENT_METRICS.filter(function (m) { return plan[m.id]; }).map(function (m) {
      return '<div style="font-size:13px;padding:2px 0">' + esc_(m.q) + ': <b>' + esc_(plan[m.id].Planned || '—') + '</b></div>'; }).join('')) : '') +
    (closed.length ? sectionLabel_('Done for your clients so far') + agCard_(MAIL.green, closed.slice(0, AGENT_LIST_MAX).map(function (t) {
      return agLine_('&#10003; <b>' + esc_(String(t.owner).split(' ')[0]) + '</b> · ' + esc_(t.subject)); }).join('')) : '') +
    (open.length ? sectionLabel_('Still open for your clients (' + open.length + ')') + agCard_(MAIL.amber, open.slice(0, AGENT_LIST_MAX).map(function (t) {
      return agLine_('<b>' + esc_(String(t.owner).split(' ')[0] || '—') + '</b> · ' + esc_(t.subject) +
        (t.late ? ' <span style="color:' + MAIL.red + ';font-weight:700">· overdue since ' + esc_(shortDate_(t.due)) + '</span>' : '')); }).join('')) : '');
  return agSend_(a, 'Midday progress · ' + a.name + ' · ' + shortDate_(day) + ' · ' + closed.length + ' closed, ' + open.length + ' open',
    shell_('Midday progress', a.name + ' · ' + prettyDate_(day), body), []);
}

function agentEveningMail_(a, day, data) {
  var first = String(a.name).split(' ')[0], plan = agRows_(a.key, day, 'plan'), planned = Object.keys(plan).length;
  var closed = data.closed[a.key] || [], open = data.open[a.key] || [];
  var btn = replyButton_(replyUrl_(a.key, day, 'agc'), 'Close off my day', 'One page: what you did against your plan, in numbers. No answer reads as nothing done today.');
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + esc_(first) + ', it is half past five. Close off your day' +
      (planned ? ' against the plan you set this morning' : ' (no plan was set this morning)') + '. It goes to your manager and sales support.</div>' +
    statTiles_([
      { value: closed.length, label: 'the branch closed for you', color: MAIL.green },
      { value: open.length, label: 'still open, due', color: open.length ? MAIL.amber : MAIL.navy },
      { value: planned ? 'yes' : 'no', label: 'plan set today', color: planned ? MAIL.green : MAIL.red }
    ]) + btn +
    (closed.length ? sectionLabel_('Done for your clients today') + agCard_(MAIL.green, closed.slice(0, AGENT_LIST_MAX).map(function (t) {
      return agLine_('&#10003; <b>' + esc_(String(t.owner).split(' ')[0]) + '</b> · ' + esc_(t.subject)); }).join('')) : '') +
    (planned ? sectionLabel_('Your plan this morning') + agCard_(MAIL.gold, AGENT_METRICS.filter(function (m) { return plan[m.id]; }).map(function (m) {
      return '<div style="font-size:13px;padding:2px 0">' + esc_(m.q) + ': <b>' + esc_(plan[m.id].Planned || '—') + '</b></div>'; }).join('')) : '') + btn;
  return agSend_(a, 'Close off your day · ' + a.name + ' · ' + shortDate_(day), shell_('Close off your day', a.name + ' · ' + prettyDate_(day), body), []);
}

/** Runs from the day tick: the morning check from 5:30, the midday progress from 12:00, the sign-off from 17:30. */
function agentTick_(day, mins) {
  var mode = agentMode_();
  if (mode === 'off') return [];
  var props = PropertiesService.getScriptProperties(), out = [];
  var kind = mins >= AGENT_AM_AT && mins <= 10 * 60 ? 'am'
           : (mins >= AGENT_MD_AT && mins <= AGENT_MD_AT + 90 ? 'md'
           : (mins >= AGENT_PM_AT && mins <= 19 * 60 ? 'pm' : ''));
  if (!kind) return [];
  var people = agentPeople_(), keys = Object.keys(people).sort();
  var done = function (k) { return props.getProperty('ag_' + kind + '_' + k + '_' + day); };
  if (mode === 'preview') {
    var n = Number(props.getProperty('ag_prev_' + kind + '_' + day) || 0);
    if (n >= AGENT_PREVIEW_MAX) return [];
    keys = keys.slice(0, AGENT_PREVIEW_MAX);
  }
  var batch = keys.filter(function (k) { return !done(k); }).slice(0, AGENT_PER_RUN).map(function (k) { return people[k]; });
  if (!batch.length) return [];
  var data = agentBatchData_(batch, day);
  var cache = null;
  if (kind === 'am') { try { cache = typeof iLoadCache_ === 'function' ? iLoadCache_() : null; } catch (e) {} }
  batch.forEach(function (a) {
    props.setProperty('ag_' + kind + '_' + a.key + '_' + day, hhmm_(new Date()));
    try {
      var ok = kind === 'am' ? agentMorningMail_(a, day, data, cache) : kind === 'md' ? agentMiddayMail_(a, day, data) : agentEveningMail_(a, day, data);
      if (ok) out.push(a.name + ' (agent ' + kind + ')');
    } catch (e) { out.push(a.name + ' agent mail FAILED: ' + (e && e.message)); }
  });
  if (mode === 'preview') props.setProperty('ag_prev_' + kind + '_' + day, String(Number(props.getProperty('ag_prev_' + kind + '_' + day) || 0) + batch.length));
  return out;
}

// ---- the agent's pages ------------------------------------------------------------

function agReplyPage_(person, day, kind, error) {
  var a = person.agent, items = [], plan = agRows_(a.key, day, 'plan'), had = agRows_(a.key, day, kind === 'agc' ? 'close' : 'plan');
  try { items = JSON.parse(PropertiesService.getScriptProperties().getProperty('ag_items_' + a.key + '_' + day) || '[]'); } catch (e) {}
  var base = ''; try { base = sfkToken_().instance_url + '/'; } catch (e) {}
  var eve = kind === 'agc';
  var metrics = '<div class="card"><div class="bh">' + (eve ? 'What you did today' : 'Your plan today') + '</div>' + AGENT_METRICS.map(function (m) {
    var pl = (plan[m.id] || {}).Planned, r = had[m.id] || {};
    return '<div style="padding:8px 0;border-top:1px solid #E5E1D6"><div style="font-size:14px">' + esc_(m.q) +
      (eve && pl !== undefined && pl !== '' ? ' <span class="br2">· planned ' + esc_(pl) + '</span>' : '') + '</div>' +
      '<input type="number" min="0" name="m_' + m.id + '" value="' + esc_(eve ? (r.Done || '') : (r.Planned || '')) + '" style="width:90px" placeholder="0"> ' +
      '<input type="text" name="n_' + m.id + '" value="' + esc_(r.Note || '') + '" style="width:calc(100% - 110px)" placeholder="Who, or a note"></div>';
  }).join('') + '<div class="bf" style="margin-top:8px">' + (eve ? 'The day in a line or two:' : 'Your plan in words: who you are seeing, what you are closing:') + '</div>' +
    '<textarea name="summary" rows="3"></textarea></div>';
  var list = items.length ? '<div class="card"><div class="bh">Being worked for your clients · comment on anything (goes to Chatter)</div>' + items.map(function (it) {
    return '<div style="padding:9px 0;border-top:1px solid #E5E1D6"><div style="font-size:14px"><b>' + esc_(String(it.o || '').split(' ')[0]) + '</b> · ' + esc_(it.s) +
      (it.late ? ' <span class="br2">· overdue since ' + esc_(shortDate_(it.due)) + '</span>' : '') + (base ? ' · <a href="' + esc_(base + it.id) + '" target="_blank">open</a>' : '') + '</div>' +
      '<textarea name="c_' + esc_(it.id) + '" rows="2" placeholder="Your comment for the team, posted to Chatter on this task"></textarea></div>';
  }).join('') + '</div>' : '';
  return replyPage_((eve ? 'Close off your day · ' : 'Your day · ') + prettyDate_(day),
    eve ? 'A number against each, 0 where nothing was done. Your manager and sales support get it.' : 'Set your plan in numbers and comment on anything the team is working for you. One save at the bottom.',
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(a.key, day, kind) + metrics + list +
    '<button type="submit">' + (eve ? 'Close off my day' : 'Save my plan') + '</button></form>');
}

function agReplySave_(person, day, kind, p) {
  var a = person.agent, eve = kind === 'agc', items = [], at = hhmm_(new Date()), comments = [];
  try { items = JSON.parse(PropertiesService.getScriptProperties().getProperty('ag_items_' + a.key + '_' + day) || '[]'); } catch (e) {}
  var rows = AGENT_METRICS.map(function (m) {
    var v = String(p['m_' + m.id] || '').trim();
    return eve ? { Item: m.id, Question: m.q, Done: v, Note: String(p['n_' + m.id] || '').trim() }
               : { Item: m.id, Question: m.q, Planned: v, Note: String(p['n_' + m.id] || '').trim() };
  });
  var filled = rows.filter(function (r) { return (eve ? r.Done : r.Planned) !== ''; }).length;
  if (filled < AGENT_METRICS.length) return agReplyPage_(person, day, kind, 'Put a number against every line, 0 where there is none. ' + (AGENT_METRICS.length - filled) + ' left blank.');
  items.forEach(function (it) {
    var txt = String(p['c_' + it.id] || '').trim();
    if (!txt) return;
    var res = 'posted';
    try { sfkInsert_('FeedItem', { ParentId: it.id, Body: 'Agent · ' + a.name + ' · ' + shortDate_(day) + ' ' + twelve_(at) + '\n\n' + txt }); }
    catch (e) { res = 'NOT SAVED: ' + String(e && e.message || e).slice(0, 140); }
    comments.push({ s: it.s, txt: txt, res: res });
  });
  var summary = String(p.summary || '').trim();
  if (summary) rows.push({ Item: 'summary', Question: eve ? 'The day' : 'The plan', Note: summary });
  agWrite_(a, day, eve ? 'close' : 'plan', rows);
  try { agCopy_(a, day, eve, rows, comments); } catch (e) {}
  return replyPage_(eve ? 'Your day is closed off' : 'Your plan is in', 'Your manager and sales support have a copy. Thank you.',
    '<div class="card ok">' + rows.map(function (r) { return '<div class="ln">' + esc_(r.Question) + ': <b>' + esc_(eve ? (r.Done || '') : (r.Planned || '')) + '</b>' + (r.Note ? ' · ' + esc_(r.Note) : '') + '</div>'; }).join('') +
    comments.map(function (c) { return '<div class="ln">' + (/^NOT/.test(c.res) ? '&#9888; ' : '&#10003; ') + esc_(c.s) + ' · ' + esc_(c.res) + '</div>'; }).join('') + '</div>');
}

function agCopy_(a, day, eve, rows, comments) {
  var mgr = agentManagerEmail_(a), to = [mgr || (managerEmails_() || [])[0]].filter(String);
  if (!to.length) return;
  var plan = eve ? agRows_(a.key, day, 'plan') : {};
  var td = 'padding:6px;font-size:12.5px;border-top:1px solid ' + MAIL.line + ';';
  var table = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    rows.filter(function (r) { return r.Item !== 'summary'; }).map(function (r) {
      var pl = eve ? String((plan[r.Item] || {}).Planned || '') : '';
      var short = eve && pl !== '' && Number(r.Done || 0) < Number(pl);
      return '<tr><td style="' + td + '">' + esc_(r.Question) + (r.Note ? '<div style="color:' + MAIL.muted + ';font-size:11.5px">' + esc_(r.Note) + '</div>' : '') + '</td>' +
        (eve ? '<td style="' + td + 'text-align:right">' + esc_(pl || '—') + '</td>' : '') +
        '<td style="' + td + 'text-align:right;font-weight:700;' + (short ? 'color:' + MAIL.red : '') + '">' + esc_(eve ? r.Done : r.Planned) + '</td></tr>';
    }).join('') + '</table>';
  var sum = rows.filter(function (r) { return r.Item === 'summary'; })[0];
  agSendCopy_(to, [DAYSTART_CC_DEFAULT], (eve ? 'Day closed off · ' : 'Plan received · ') + a.name + ' · Agent · ' + shortDate_(day),
    shell_(eve ? 'The agent\'s day' : 'The agent\'s plan', a.name + ' · ' + prettyDate_(day) + ' · ' + hhmm_(new Date()),
      table + (sum ? '<div style="font-size:13.5px;margin-top:10px">"' + esc_(sum.Note) + '"</div>' : '') +
      (comments.length ? sectionLabel_('Comments, now on Chatter') + comments.map(function (c) { return agLine_('<b>' + esc_(c.s) + '</b><div>' + esc_(c.txt) + '</div>'); }).join('') : '')), a);
}

function agSendCopy_(to, cc, subject, html, a) {
  if (agentMode_() === 'preview') {
    MailApp.sendEmail({ to: (managerEmails_() || []).join(','), subject: '[Preview] ' + subject,
      htmlBody: '<div style="background:#EEF9FD;border:1px solid #0EA5C9;padding:10px 14px;font:600 13px Segoe UI,Arial;margin:0 0 8px">Preview. In live mode this goes to ' +
        esc_(to.concat(cc).join(', ')) + '.</div>' + html });
    return;
  }
  MailApp.sendEmail({ to: to.join(','), cc: cc.join(','), subject: subject, htmlBody: html });
}

/** For the managers' mail: each agent's day so far. Absent = no plan by 10:30; nothing done = no close-off. */
function agentDaySummary_(day, filterNames) {
  var people = agentPeople_(), rows = hrRows_(AGDAY, true) || [], nowM = minutesOf_(hhmm_(new Date()));
  var nk = function (s) { return typeof iNameKey_ === 'function' ? iNameKey_(s) : String(s || '').toLowerCase(); };
  var want = filterNames ? filterNames.map(nk) : null;
  return Object.keys(people).sort().map(function (k) {
    var a = people[k];
    if (want && want.indexOf(nk(a.agentName)) === -1 && want.indexOf(nk(a.name)) === -1) return null;
    var plan = {}, close = {};
    rows.forEach(function (r) {
      if (isoDay_(r.Date) !== day || String(r.Agent) !== k) return;
      if (String(r.Kind) === 'plan') plan[String(r.Item)] = r;
      if (String(r.Kind) === 'close') close[String(r.Item)] = r;
    });
    var hasPlan = Object.keys(plan).length > 0, hasClose = Object.keys(close).length > 0;
    var status = hasClose ? 'closed off' : hasPlan ? 'plan in' : (nowM >= AGENT_ABSENT_AT ? 'absent (no plan)' : 'no plan yet');
    var sum = function (o, f) { return AGENT_METRICS.reduce(function (s, m) { return s + Number((o[m.id] || {})[f] || 0); }, 0); };
    return { key: k, name: a.name, status: status, planned: sum(plan, 'Planned'), done: sum(close, 'Done'),
             ff: Number((close.ff || {}).Done || 0), apps: Number((close.apps || {}).Done || 0), hasPlan: hasPlan, hasClose: hasClose };
  }).filter(Boolean);
}

function agentSummaryTable_(list) {
  if (!list.length) return '';
  var td = 'padding:6px;font-size:12.5px;border-top:1px solid ' + MAIL.line + ';';
  var th = 'padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr><td style="' + th + ';text-align:left">Agent</td><td style="' + th + '">Today</td><td style="' + th + '">Planned · done</td><td style="' + th + '">FF · apps</td></tr>' +
    list.map(function (x) {
      var c = /absent/.test(x.status) ? MAIL.red : x.hasClose ? MAIL.green : x.hasPlan ? MAIL.navy : MAIL.amber;
      return '<tr><td style="' + td + '">' + esc_(x.name) + '</td><td style="' + td + 'text-align:right;color:' + c + ';font-weight:700">' + esc_(x.status) + '</td>' +
        '<td style="' + td + 'text-align:right">' + (x.hasPlan ? x.planned : '—') + ' · ' + (x.hasClose ? x.done : '—') + '</td>' +
        '<td style="' + td + 'text-align:right">' + (x.hasClose ? x.ff + ' · ' + x.apps : '—') + '</td></tr>';
    }).join('') + '</table>';
}

/** From the editor. */
function sendAgentPreviewNow() {
  var day = todayISO_(), people = agentPeople_(), keys = Object.keys(people).sort().slice(0, AGENT_PREVIEW_MAX);
  var batch = keys.map(function (k) { return people[k]; }), data = agentBatchData_(batch, day), cache = null;
  try { cache = iLoadCache_(); } catch (e) {}
  var save = PropertiesService.getScriptProperties().getProperty('AGENT_DAY');
  PropertiesService.getScriptProperties().setProperty('AGENT_DAY', 'preview');
  try { batch.forEach(function (a) { agentMorningMail_(a, day, data, cache); }); }
  finally { if (save) PropertiesService.getScriptProperties().setProperty('AGENT_DAY', save); else PropertiesService.getScriptProperties().deleteProperty('AGENT_DAY'); }
  var msg = 'Preview sent for: ' + batch.map(function (a) { return a.name; }).join(', ') + ' (of ' + Object.keys(people).length + ' agents found).';
  Logger.log(msg); return msg;
}
function listAgents() { var p = agentPeople_(); var out = Object.keys(p).sort().map(function (k) { return p[k].name + ' · ' + p[k].email + ' · manager ' + (agentManagerEmail_(p[k]) || '—'); }).join('\n'); Logger.log(out); return out; }
function mailQuotaLeft() { var n = MailApp.getRemainingDailyQuota(); Logger.log('E-mail recipients left today: ' + n); return n; }


/** The desks the day mail runs for: the support staff, the BMA, and the
 *  Branch Manager's assistant. Not the managers, and not anybody who has left
 *  but is still marked active on the Access tab. */
var DAY_MAIL_DESKS = ['sasha', 'elizabeth', 'azariah', 'kamla', 'pawan'];

/** What Salesforce says about one person's day, for the housekeeping e-mail. */
function sfkDayFor_(staffId, day) {
  var u = (sfkUsers_() || {})[staffId];
  if (!u) return null;
  var from = sfkUtcAt_(day, 0), to = sfkUtcAt_(shiftDays_(day, 1), 0);
  var closed = sfkQuery_(
    "SELECT Id, Subject, LastModifiedDate FROM Task WHERE OwnerId = '" + u.id + "' AND IsClosed = true" +
    ' AND LastModifiedDate >= ' + from + ' AND LastModifiedDate < ' + to +
    " AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') ORDER BY LastModifiedDate ASC LIMIT 200");
  var created = sfkQuery_(
    "SELECT Id FROM Task WHERE CreatedById = '" + u.id + "' AND CreatedDate >= " + from +
    ' AND CreatedDate < ' + to + " AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') LIMIT 200");
  var noted = {};
  if (closed.length) {
    var ids = closed.map(function (t) { return "'" + t.Id + "'"; }).join(',');
    sfkQuery_("SELECT ParentId FROM FeedItem WHERE ParentId IN (" + ids + ") AND CreatedById = '" + u.id +
              "' AND Type IN ('TextPost','ContentPost','LinkPost') LIMIT 1000")
      .forEach(function (f) { noted[f.ParentId] = 1; });
  }
  // The last thing she did in Salesforce today: a closure or a note.
  var last = null;
  var mark = function (iso) { var l = sfLocal_(iso); if (l && l.day === day && (last == null || l.min > last)) last = l.min; };
  closed.forEach(function (t) { mark(t.LastModifiedDate); });
  var notesToday = sfkQuery_("SELECT CreatedDate FROM FeedItem WHERE CreatedById = '" + u.id + "' AND CreatedDate >= " + from +
    ' AND CreatedDate < ' + to + " AND Type IN ('TextPost','ContentPost','LinkPost') LIMIT 500");
  notesToday.forEach(function (f) { mark(f.CreatedDate); });
  return {
    closed: closed.map(function (t) { return { id: t.Id, subject: t.Subject || '', noted: !!noted[t.Id] }; }),
    created: created.length,
    notes: notesToday.length,
    lastAt: last
  };
}

/* ─────────── The official close-out, the weekly report, the BMA's 4pm (16 Oct 2026) ───────────
 *  Ricky: "30 minutes prior to leaving they are officially written ... comment
 *  on the blocks, on things that remain outstanding, scrubbing emails, their
 *  inbox and their general surroundings ... Let them know the last task on
 *  Salesforce that is actioned ... the time logged out will be 30 minutes
 *  after the reminder; the system will automatically log the person off ...
 *  On Friday a weekly progress report: areas of concern and what should have
 *  been done. Kamla gets her report at 4pm, a deeper dive."  */
var BMA_REPORT_AT = 16 * 60;
/** The last thing done in Salesforce today, by subject and time. */
function lastSfAction_(sid, day) {
  var u = (sfkUsers_() || {})[sid]; if (!u) return null;
  var r = sfkQuery_("SELECT Id, Subject, IsClosed, LastModifiedDate FROM Task WHERE OwnerId = '" + u.id + "' AND LastModifiedDate >= " + sfkUtcAt_(day, 0) +
    " AND LastModifiedDate < " + sfkUtcAt_(shiftDays_(day, 1), 0) + " AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') ORDER BY LastModifiedDate DESC LIMIT 1")[0];
  if (!r) return { none: true };
  var l = sfLocal_(r.LastModifiedDate);
  return { id: r.Id, subject: r.Subject || '', closed: !!r.IsClosed, at: l ? twelve_(mmText_(l.min)) : '' };
}
/** Open work by block: each block's own type, late or due today, for the comment on each. */
function hkBlockOutstanding_(sid, day, book) {
  var blocks = scheduleFor_(sid).blocks || {}, plans = {}, seen = {}, out = [], byId = {};
  try { plans = planRows_(sid, day); } catch (e) {}
  Object.keys(book).forEach(function (t) { book[t].forEach(function (x) { byId[x.id] = x; x.ty = x.ty || t; }); });
  var rows = BLOCK_IDS.filter(function (b) { return blocks[b]; }).map(function (b) {
    var kpi = blocks[b].kpi, own = blockTypeFor_(kpi), types = [];
    try { types = blockSfTypes_(kpi, '') || []; } catch (e) {}
    var row = { b: b, time: blocks[b].time, focus: blocks[b].focus, list: [], own: own, types: types };
    // What she planned for this block and has not closed comes first.
    if (plans[b]) planItemsOf_(plans[b].Items).forEach(function (it) { if (it.k === 'sf' && byId[it.id] && !seen[it.id]) { seen[it.id] = 1; var x = byId[it.id]; x.planned = true; row.list.push(x); } });
    return row;
  });
  var due = []; Object.keys(book).forEach(function (t) { book[t].forEach(function (x) { if (!seen[x.id] && (x.late || x.due === day)) due.push({ x: x, t: t }); }); });
  due.forEach(function (d) {
    var home = rows.filter(function (r) { return r.own && r.own === d.t; })[0] || rows.filter(function (r) { return r.types.indexOf(d.t) > -1; })[0] ||
      rows.filter(function (r) { return r.b === mgrBlockFor_(blocks, d.t); })[0];
    if (home) { seen[d.x.id] = 1; home.list.push(d.x); }
  });
  rows.forEach(function (r) { out.push(r); });
  var rest = due.filter(function (d) { return !seen[d.x.id]; }).map(function (d) { return d.x; });
  if (rest.length) out.push({ b: 'OTHER', time: '', focus: 'Outside your plan', list: rest });
  return out;
}
/** The branch sheets with lines still in this person's name. */
function hkSystems_(sid, day) {
  var html = '';
  try { html += branchCards_(sid, day); } catch (e) {}
  try { html += queryCard_(sid); } catch (e) {}
  try {
    var me = bkNk_(nameFor_(sid)), first = me.split(' ')[0];
    var lines = bookRows_('DELIVERY', BOOKS.DELIVERY.log).filter(function (r) {
      return /logged|received/i.test(String(r['Status'] || '')) && !String(r['Sent At'] || '').trim() && bkNk_(r['Logged By']).indexOf(first) > -1; });
    if (lines.length) html += srcCard_('Log book · ' + lines.length + ' line' + (lines.length === 1 ? '' : 's') + ' you logged, not sent on', MAIL.amber,
      lines.slice(0, 6).map(function (r) { return esc_(r['Document']) + ' · ' + esc_(r['Client']) + ' · ' + esc_(r['Policy #']) + ' → ' + esc_(r['Department']); }), lines.length > 6 ? 'and ' + (lines.length - 6) + ' more.' : '');
  } catch (e) {}
  return html;
}
/** Monday to today of this week, working days. */
function weekToDate_(day) {
  var dow = new Date(day + 'T12:00:00Z').getUTCDay() || 7, mon = shiftDays_(day, 1 - dow), out = [];
  for (var i = 0; i < 5; i++) { var d = shiftDays_(mon, i); if (d <= day) out.push(d); }
  return out;
}
/** One person's week: per day, and the concerns that follow from it. */
function weekFor_(sid, day) {
  var days = weekToDate_(day), owed = blocksOwed_(sid), rows = [], u = (sfkUsers_() || {})[sid];
  var att = {}; try { sheetObjects_(attSheet_()).forEach(function (r) { if (String(r.StaffId) === sid) att[isoDay_(r.Date)] = r; }); } catch (e) {}
  var startM = (parseSpan_(scheduleFor_(sid).hours || '') || { start: 480 }).start;
  var closedBy = {}, noted = {}, created = {}, cl = [];
  if (u) {
    try {
      var from = sfkUtcAt_(days[0], 0), to = sfkUtcAt_(shiftDays_(day, 1), 0);
      cl = sfkQuery_("SELECT Id, Subject, Task_Type__c, LastModifiedDate FROM Task WHERE OwnerId = '" + u.id + "' AND IsClosed = true AND LastModifiedDate >= " + from + ' AND LastModifiedDate < ' + to + " AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') LIMIT 1000");
      cl.forEach(function (t) { var l = sfLocal_(t.LastModifiedDate); if (l) (closedBy[l.day] = closedBy[l.day] || []).push(t.Id); });
      for (var i = 0; i < cl.length; i += 150) sfkQuery_("SELECT ParentId FROM FeedItem WHERE CreatedById = '" + u.id + "' AND Type IN ('TextPost','ContentPost','LinkPost') AND ParentId IN (" + cl.slice(i, i + 150).map(function (t) { return "'" + t.Id + "'"; }).join(',') + ') LIMIT 2000').forEach(function (f) { noted[f.ParentId] = 1; });
      sfkQuery_("SELECT CreatedDate FROM Task WHERE CreatedById = '" + u.id + "' AND CreatedDate >= " + from + ' AND CreatedDate < ' + to + " AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') LIMIT 1000")
        .forEach(function (t) { var l = sfLocal_(t.CreatedDate); if (l) created[l.day] = (created[l.day] || 0) + 1; });
    } catch (e) {}
  }
  days.forEach(function (d) {
    var a = att[d] || {}, inAt = timeStr_(a.FirstSignIn), status = String(a.Status || '').toLowerCase();
    var plans = {}; try { plans = planRows_(sid, d); } catch (e) {}
    var of = 0, ach = 0; Object.keys(plans).forEach(function (b) { of += n_(plans[b].Of) || 0; ach += n_(plans[b].Achieved) || 0; });
    var ids = closedBy[d] || [], nn = ids.filter(function (id) { return !noted[id]; }).length;
    rows.push({ d: d, inAt: inAt, out: timeStr_(a.SignedOut), absent: status === 'absent', late: inAt ? minutesOf_(inAt) > startM + 10 : false,
      blocks: blocksSubmittedOn_(sid, d).length, owed: owed, of: of, ach: ach, closed: ids.length, unnoted: nn, created: created[d] || 0 });
  });
  var still = []; try { var bk = (sfkOpenBook_(day) || {})[sid] || {}; Object.keys(bk).forEach(function (t) { bk[t].forEach(function (x) { if (x.due && x.due >= days[0] && x.due <= day) still.push(x); }); }); } catch (e) {}
  var overdue = 0; try { var b2 = (sfkOpenBook_(day) || {})[sid] || {}; Object.keys(b2).forEach(function (t) { b2[t].forEach(function (x) { if (x.late) overdue++; }); }); } catch (e) {}
  var sum = function (k) { return rows.reduce(function (a, r) { return a + (r[k] || 0); }, 0); };
  // What was done: every closure this week, by type, the ones with a note first.
  var byType = {}, done = [];
  cl.forEach(function (t) {
    var ty = String(t.Task_Type__c || 'Other'), l = sfLocal_(t.LastModifiedDate);
    byType[ty] = (byType[ty] || 0) + 1;
    done.push({ subject: String(t.Subject || ''), type: ty, day: l ? l.day : '', noted: !!noted[t.Id] });
  });
  done.sort(function (a, b) { return (b.noted - a.noted) || (b.day < a.day ? -1 : b.day > a.day ? 1 : 0); });
  var concerns = [];
  var lateDays = rows.filter(function (r) { return r.late; }).length, absentDays = rows.filter(function (r) { return r.absent; }).length;
  if (absentDays) concerns.push(absentDays + ' day' + (absentDays === 1 ? '' : 's') + ' absent');
  if (lateDays) concerns.push('signed in late on ' + lateDays + ' day' + (lateDays === 1 ? '' : 's'));
  var shortBlocks = rows.filter(function (r) { return !r.absent && r.owed && r.blocks < r.owed; }).length;
  if (shortBlocks) concerns.push('the day not reported on ' + shortBlocks + ' day' + (shortBlocks === 1 ? '' : 's'));
  if (sum('of') && sum('ach') / sum('of') < 0.8) concerns.push('only ' + Math.round(100 * sum('ach') / sum('of')) + '% of the planned tasks done');
  if (sum('unnoted')) concerns.push(sum('unnoted') + ' task' + (sum('unnoted') === 1 ? '' : 's') + ' closed without a note');
  var noCreate = rows.filter(function (r) { return !r.absent && !r.created; }).length;
  if (noCreate) concerns.push('no task logged at the point of work on ' + noCreate + ' day' + (noCreate === 1 ? '' : 's'));
  if (still.length) concerns.push(still.length + ' task' + (still.length === 1 ? '' : 's') + ' due this week still open');
  if (overdue > 10) concerns.push(overdue + ' overdue in total');
  return { rows: rows, still: still, overdue: overdue, concerns: concerns, byType: byType, done: done, totals: { closed: sum('closed'), unnoted: sum('unnoted'), of: sum('of'), ach: sum('ach'), created: sum('created') } };
}
function weekCard_(sid, day, w, title) {
  var td = 'padding:5px;font-size:12px;border-top:1px solid ' + MAIL.line + ';text-align:right;', th = 'padding:5px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right';
  var table = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px;margin-bottom:10px"><tr>' +
    ['Day', 'In', 'Out', 'Reported', 'Plan', 'Closed', 'No note', 'Logged'].map(function (h, i) { return '<td style="' + th + (i ? '' : ';text-align:left') + '">' + h + '</td>'; }).join('') + '</tr>' +
    w.rows.map(function (r) {
      return '<tr><td style="' + td + 'text-align:left">' + esc_(shortDate_(r.d)) + '</td>' +
        (r.absent ? '<td colspan="7" style="' + td + 'text-align:left;color:' + MAIL.red + ';font-weight:700">Absent</td>' :
        '<td style="' + td + (r.late ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + esc_(r.inAt ? twelve_(r.inAt) : '—') + '</td>' +
        '<td style="' + td + '">' + esc_(r.out ? twelve_(r.out) : '—') + '</td>' +
        '<td style="' + td + (r.blocks < r.owed ? 'color:' + MAIL.amber + ';font-weight:700' : '') + '">' + (r.blocks >= r.owed ? 'yes' : 'no') + '</td>' +
        '<td style="' + td + '">' + (r.of ? r.ach + '/' + r.of : '—') + '</td>' +
        '<td style="' + td + '">' + r.closed + '</td>' +
        '<td style="' + td + (r.unnoted ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + r.unnoted + '</td>' +
        '<td style="' + td + (!r.created ? 'color:' + MAIL.amber : '') + '">' + r.created + '</td>') + '</tr>';
    }).join('') + '</table>';
  var t = w.totals, bt = w.byType || {}, done = w.done || [];
  var types = Object.keys(bt).sort(function (a, b) { return bt[b] - bt[a]; });
  var doneCard = done.length ? srcCard_('What you got done this week (' + done.length + ' closed)', MAIL.green,
      ['<b>By type:</b> ' + types.map(function (ty) { return esc_(ty) + ' ' + bt[ty]; }).join(' · ')].concat(
      done.slice(0, 12).map(function (x) { return '<span style="color:' + MAIL.muted + '">' + esc_(x.day ? shortDate_(x.day).split(' ')[0] : '') + '</span> ' + esc_(x.subject) +
        (x.noted ? ' <span style="color:' + MAIL.green + '">· noted</span>' : ' <span style="color:' + MAIL.red + '">· no note</span>'); })),
      (done.length > 12 ? 'and ' + (done.length - 12) + ' more. ' : '') + (done.length - t.unnoted) + ' of ' + done.length + ' carry your note on the trail.') : '';
  return sectionLabel_(title) + table + doneCard +
    srcCard_('Areas of concern', w.concerns.length ? MAIL.red : MAIL.green, w.concerns.length ? w.concerns.map(function (c) { return esc_(c); }) : ['None this week. Well done.'],
      'Week total: ' + t.closed + ' closed, ' + t.unnoted + ' without a note, ' + (t.of ? t.ach + ' of ' + t.of + ' planned' : 'no plan') + ', ' + t.created + ' logged at the point of work. ' + w.overdue + ' overdue now.') +
    (w.still.length ? srcCard_('What should have been done this week, and is still open (' + w.still.length + ')', MAIL.amber,
      w.still.slice(0, 10).map(function (x) { return esc_(x.subject) + lateTag_(x.due, day); }), w.still.length > 10 ? 'and ' + (w.still.length - 10) + ' more.' : '') : '');
}
/** At the finish: whoever has not signed out is signed out, and the close-out state goes to the managers. */
function autoSignOut_(sid, day, endM) {
  var sh = attSheet_(), rows = sheetObjects_(sh), found = attRow_(rows, day, sid);
  if (!found || !timeStr_(found.row.FirstSignIn) || timeStr_(found.row.SignedOut)) return false;
  var at = mmText_(endM);
  writeRow_(sh, found.at, colMap_(sh), { SignedOut: at, LastSeen: timeStr_(found.row.LastSeen) || at, UpdatedAt: new Date(),
    Reason: (String(found.row.Reason || '') ? found.row.Reason + '; ' : '') + 'Signed out automatically at ' + twelve_(at) });
  forgetHr_(ATT);
  try { CacheService.getScriptCache().remove('att_' + sid + '_' + day); } catch (e) {}
  try { signOutNotice_(sid, day, at); } catch (e) {}
  return true;
}
/** The BMA's 4pm: every desk's day, deeper; on Friday the week as well. */
function sendBmaReport_(day) {
  var to = emailFor_('kamla'); if (!to) return false;
  var friday = new Date(day + 'T12:00:00Z').getUTCDay() === 5, desks = DAY_MAIL_DESKS.filter(function (s) { return s !== 'kamla'; });
  var att = {}; try { sheetObjects_(attSheet_()).forEach(function (r) { if (isoDay_(r.Date) === day) att[String(r.StaffId)] = r; }); } catch (e) {}
  var td = 'padding:6px;font-size:12px;border-top:1px solid ' + MAIL.line + ';text-align:right;', th = 'padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right';
  var ob = {}; try { ob = sfkOpenBook_(day) || {}; } catch (e) {}
  var concerns = [], sysHtml = '';
  var rows = desks.map(function (sid) {
    var a = att[sid] || {}, d1 = null, last = null, of = 0, ach = 0;
    try { d1 = sfkDayFor_(sid, day); } catch (e) {}
    try { last = lastSfAction_(sid, day); } catch (e) {}
    try { var pl = planRows_(sid, day); Object.keys(pl).forEach(function (b) { of += n_(pl[b].Of) || 0; ach += n_(pl[b].Achieved) || 0; }); } catch (e) {}
    var book = ob[sid] || {}, over = 0, quiet = 0; Object.keys(book).forEach(function (t) { book[t].forEach(function (x) { if (x.late) over++; if (x.touched >= 5) quiet++; }); });
    var blocks = blocksSubmittedOn_(sid, day).length, owed = blocksOwed_(sid), un = d1 ? d1.closed.filter(function (t) { return !t.noted; }).length : 0;
    var nm = String(nameFor_(sid)).split(' ')[0], absent = String(a.Status || '').toLowerCase() === 'absent';
    if (absent) concerns.push(nm + ' is out today' + (a.Reason ? ' (' + a.Reason + ')' : ''));
    else {
      if (blocks < owed) concerns.push(nm + ': day not reported');
      if (un) concerns.push(nm + ': ' + un + ' closed without a note');
      if (of && ach / of < 0.6) concerns.push(nm + ': ' + ach + ' of ' + of + ' planned done');
      if (d1 && !d1.created) concerns.push(nm + ': nothing logged at the point of work today');
      if (last && last.none) concerns.push(nm + ': no Salesforce action at all today');
    }
    try { var sy = hkSystems_(sid, day); if (sy) sysHtml += '<div style="font-size:12px;font-weight:800;color:' + MAIL.navy + ';margin:10px 0 2px">' + esc_(nameFor_(sid)) + '</div>' + sy; } catch (e) {}
    return '<tr><td style="' + td + 'text-align:left"><b>' + esc_(nameFor_(sid)) + '</b><div style="font-size:11px;color:' + MAIL.muted + '">' + esc_(scheduleFor_(sid).hours || '') + '</div></td>' +
      (absent ? '<td colspan="7" style="' + td + 'text-align:left;color:' + MAIL.red + ';font-weight:700">Absent' + (a.Reason ? ' · ' + esc_(a.Reason) : '') + '</td>' :
      '<td style="' + td + '">' + esc_(timeStr_(a.FirstSignIn) ? twelve_(timeStr_(a.FirstSignIn)) : '—') + '</td>' +
      '<td style="' + td + (blocks < owed ? 'color:' + MAIL.amber + ';font-weight:700' : '') + '">' + (blocks >= owed ? 'yes' : 'no') + '</td>' +
      '<td style="' + td + '">' + (of ? ach + '/' + of : '—') + '</td>' +
      '<td style="' + td + '">' + (d1 ? d1.closed.length : '—') + '</td>' +
      '<td style="' + td + (un ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + un + '</td>' +
      '<td style="' + td + (over ? 'color:' + MAIL.red : '') + '">' + over + ' · ' + quiet + '</td>' +
      '<td style="' + td + 'text-align:left;font-size:11.5px">' + (last && !last.none ? esc_(last.at) + ' · ' + esc_(shorten_(last.subject, 38)) : '<span style="color:' + MAIL.red + '">none today</span>') + '</td>') + '</tr>';
  });
  var table = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px"><tr>' +
    ['Desk', 'In', 'Reported', 'Plan', 'Closed', 'No note', 'Overdue · quiet', 'Last Salesforce action'].map(function (h, i) { return '<td style="' + th + (i && i < 7 ? '' : ';text-align:left') + '">' + h + '</td>'; }).join('') + '</tr>' + rows.join('') + '</table>';
  var week = '';
  if (friday) desks.forEach(function (sid) { try { week += weekCard_(sid, day, weekFor_(sid, day), 'The week · ' + nameFor_(sid)); } catch (e) {} });
  var body = '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">Kamla, the branch at 4pm: where each desk stands before the close-outs go out, what has gone quiet, and what is still open in the branch sheets. ' +
      'Chase what is below before each person\'s before-you-leave; anything you move from the command centre goes on its Chatter.' + (friday ? ' It is Friday, so each desk\'s week follows.' : '') + '</div>' +
    cmdButton_('kamla', day) +
    sectionLabel_('Every desk today') + table +
    '<div style="font-size:11.5px;color:' + MAIL.muted + ';margin-top:5px">Quiet: open and untouched five days or more.</div>' +
    srcCard_('Areas of concern today (' + concerns.length + ')', concerns.length ? MAIL.red : MAIL.green, concerns.length ? concerns.map(function (c) { return esc_(c); }) : ['Every desk is on track.'], '') +
    (sysHtml ? sectionLabel_('Branch sheets still open, by desk') + sysHtml : '') + week;
  MailApp.sendEmail({ to: to, cc: [DAYSTART_CC_DEFAULT].concat(managerEmails_()).join(','),
    subject: (friday ? 'The branch at 4pm and the week · ' : 'The branch at 4pm · ') + shortDate_(day) + ' · ' + concerns.length + ' concern' + (concerns.length === 1 ? '' : 's'),
    htmlBody: shell_(friday ? 'The branch at 4pm · and the week' : 'The branch at 4pm', 'For the BMA · ' + prettyDate_(day), body) });
  return true;
}
function sendBmaReportNow() { return sendBmaReport_(todayISO_()); }

function sendHousekeeping_(person, day, signIn) {
  var sid = String(person.staffId);
  var to = emailFor_(sid);
  if (!to) return false;
  ensureHousekeepingItems_();
  var sched = scheduleFor_(sid), name = nameFor_(sid), first = String(name).split(' ')[0];
  var endText = twelve_(mmText_(endFor_(sid)));

  // Blocks and the plan
  var owed = blocksOwed_(sid), done = blocksSubmittedOn_(sid, day).length;
  var plans = {}, of = 0, achieved = 0;
  try { plans = planRows_(sid, day); } catch (e) {}
  Object.keys(plans).forEach(function (b) { of += n_(plans[b].Of) || 0; achieved += n_(plans[b].Achieved) || 0; });
  var pct = of ? Math.round(100 * achieved / of) : null;
  var blockPct = owed ? Math.round(100 * Math.min(done, owed) / owed) : 0;

  // Blocks filed before their own window opened were a plan, not a report.
  var early = 0;
  try {
    var lsh = logSheet_(), lidx = colMap_(lsh), lv = findDayRow_(lsh, lidx, sid, day).vals;
    if (lv) Object.keys(sched.blocks || {}).forEach(function (b) {
      var at = lidx[b + '_At'] != null ? lv[lidx[b + '_At']] : '';
      var t = (at && Object.prototype.toString.call(at) === '[object Date]') ? hhmm_(at) : timeStr_(at);
      var sp = blockSpan_(sid, b);
      if (t && sp && minutesOf_(t) < sp.start) early++;
    });
  } catch (e) {}

  // Salesforce
  var sfOk = sfkConfigured_(), day1 = null, book = {};
  if (sfOk) {
    try { day1 = sfkDayFor_(sid, day); } catch (e) { day1 = null; }
    try { book = (sfkOpenBook_(day) || {})[sid] || {}; } catch (e) { sfOk = false; }
  }
  var tomorrow = shiftDays_(day, 1), dueOpen = [], dueTomorrow = [], overdue = 0;
  Object.keys(book).forEach(function (ty) {
    book[ty].forEach(function (t) {
      if (t.late) overdue++;
      if (t.due === day) dueOpen.push(t);
      if (t.due === tomorrow) dueTomorrow.push(t);
    });
  });
  var closed = day1 ? day1.closed : [], unnoted = closed.filter(function (t) { return !t.noted; });

  var list = function (items, max, colour) {
    if (!items.length) return '';
    return items.slice(0, max).map(function (t) {
      return '<div style="font-size:12.5px;line-height:1.45;padding:3px 0;border-top:1px solid ' + MAIL.line + ';color:' + (colour || MAIL.ink) + '">' + esc_(t.subject) + '</div>';
    }).join('') + (items.length > max ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:3px">and ' + (items.length - max) + ' more</div>' : '');
  };
  var check = function (n, title, bodyHtml, ok) {
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (ok ? MAIL.green : MAIL.amber) +
      ';border-radius:10px;padding:13px 15px;margin-bottom:10px">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.gold + '">' + n + ' · ' + esc_(title) + '</div>' +
      bodyHtml + '</div>';
  };
  var p = function (h) { return '<div style="font-size:13.5px;line-height:1.55;margin-top:6px">' + h + '</div>'; };

  var c1 =
    p((done >= owed ? '<b>Your day is reported</b>' : '<b style="color:' + MAIL.red + '">Your day is not reported yet</b>: write what was done against your plan') +
      (early ? ', but <b style="color:' + MAIL.red + '">it was filed before your day started</b>, so it is a plan, not a report. Update it with what was actually done' : '') + '. ' +
      (of ? '<b>' + achieved + ' of ' + of + ' planned tasks done</b> (' + pct + '%).' : '<span style="color:' + MAIL.red + '">No Salesforce tasks were planned today.</span>')) +
    (sfOk && day1 ? p('Closed today: <b>' + closed.length + '</b>' + (unnoted.length ? ', of which <b style="color:' + MAIL.red + '">' + unnoted.length + ' have no note from you</b>. A task closed without a note is not closed:' : ', every one with your note.')) + list(unnoted, 8, MAIL.red) : '') +
    (sfOk && dueOpen.length ? p('Due today and still open: <b>' + dueOpen.length + '</b>. Each needs your note on what happened and when it will be done:') + list(dueOpen, 8) : '');
  var c2 =
    p('Scrub your inbox and the branch WhatsApp before you go. Anything urgent from <b>Mr Rampersad</b>, a manager, an agent or a client gets a reply or a task today, not tomorrow.') +
    p('Clients who wrote to us in their own words go to support@ with a person replying, not a template.') +
    p('Then your surroundings: every document on your desk filed, logged in the log book or handed to the router. Nothing left loose overnight.');
  var c3 =
    (sfOk ? p('Due tomorrow: <b>' + dueTomorrow.length + '</b>. Open each one and be sure you know what it needs.') + list(dueTomorrow, 8) : '') +
    (sfOk && day1 && day1.created === 0
      ? p('<b style="color:' + MAIL.amber + '">You created no task today.</b> Check your inbox again: anything that came in by e-mail and needs doing is a task, logged at the point of work.')
      : (sfOk && day1 ? p('You logged <b>' + day1.created + '</b> new task' + (day1.created === 1 ? '' : 's') + ' at the point of work today.') : ''));

  // Today against the morning's number and her own average, then the trend.
  var intel = null;
  try { intel = intelFor_(sid, day); } catch (e) { intel = null; }
  var target = Number(PropertiesService.getScriptProperties().getProperty(intelTargetKey_(sid, day)) || 0);
  var today = [];
  if (sfOk && day1) {
    var tp = target ? Math.round(100 * closed.length / target) : null;
    today.push({ bad: target ? closed.length < target : false,
      html: 'Today you closed <b>' + closed.length + '</b>' + (target ? ' of this morning\'s <b>' + target + '</b> (<b' + (tp < 100 ? ' style="color:' + MAIL.red + '"' : '') + '>' + tp + '%</b>)' : '') +
        (intel && intel.pace != null ? '. Your ' + intel.days + '-day average is ' + intel.pace + ' a day' : '') + '.' +
        (day1.lastAt != null ? ' Last Salesforce entry ' + esc_(twelve_(mmText_(day1.lastAt))) + '.' : '') });
  }
  var trend = intel ? intelLines_(intel).filter(function (l) { return l.bad; }).slice(0, 3) : [];
  try {
    var innoX = (sfkInnovation_(day) || {})[sid];
    if (innovationBlock_(sid, day)) today.push({ bad: true, html: '<b>Innovation hour today.</b> The close-out page asks what it moved; that answer goes on Friday\'s board.' });
    var il = innovationLine_(innoX, day, sid); if (il && il.bad) trend.push(il);
  } catch (e) {}

  var body =
    '<div style="background:' + MAIL.navy + ';color:#fff;border-radius:10px;padding:13px 16px;margin-bottom:14px;font-size:14px;line-height:1.55">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:' + MAIL.soft + '">Official close-out notice · ' + esc_(twelve_(hhmm_(new Date()))) + '</div>' +
      esc_(first) + ', your day ends at <b>' + esc_(endText) + '</b>. <b>You will be signed out automatically at ' + esc_(endText) + '</b>. ' +
      'Before then: comment on every task still open below, scrub your inbox and WhatsApp, close off the branch sheets in your name, clear your desk, and save the close-out. ' +
      'If the close-out is not saved by ' + esc_(endText) + ', Mr Rampersad and Mrs Dookran are told, with what was left.</div>' +
    statTiles_([
      { value: signIn ? twelve_(signIn) : '—', label: 'signed in' },
      { value: blockPct >= 100 ? 'yes' : 'no', label: 'day reported', color: blockPct < 100 ? MAIL.amber : MAIL.green },
      { value: pct == null ? '—' : pct + '%', label: 'planned done', color: pct == null ? MAIL.red : (pct < 100 ? MAIL.amber : MAIL.green) },
      { value: sfOk ? overdue : '—', label: 'overdue', color: overdue ? MAIL.red : MAIL.navy }
    ]) +
    intelBox_(today.concat(trend), 'Today, and what the record shows') + periodTable_(intel) +
    replyButton_(replyUrl_(sid, day, 'hk'), 'Close my day here', 'A comment on each task still open, the checks, and sign out. No password.') +
    (function () { try { var la = lastSfAction_(sid, day); return la ? sectionLabel_('Your last Salesforce action today') +
      '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (la.none ? MAIL.red : MAIL.navy) + ';border-radius:10px;padding:10px 15px;font-size:13px">' +
      (la.none ? '<b style="color:' + MAIL.red + '">Nothing in Salesforce today.</b> Every task you worked needs its note before you go.' :
        '<b>' + esc_(la.at) + '</b> · ' + esc_(la.subject) + ' · ' + (la.closed ? 'closed' : 'updated, still open')) + '</div>' : ''; } catch (e) { return ''; } })() +
    (sfOk ? (function () { var bo = hkBlockOutstanding_(sid, day, book); return sectionLabel_('Your day · what is still outstanding') + bo.map(function (x) {
      return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (x.list.length ? MAIL.amber : MAIL.green) + ';border-radius:10px;padding:10px 15px;margin-bottom:8px">' +
        '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.gold + '">' + esc_(x.time ? x.time + ' · ' : '') + esc_(x.focus) + '</div>' +
        (x.list.length ? x.list.slice(0, 8).map(function (t) { return '<div style="font-size:12.5px;padding:4px 0;border-top:1px solid ' + MAIL.line + '">' + (t.planned ? '<b style="color:' + MAIL.navy + '">Planned · </b>' : '') + esc_(t.subject) + lateTag_(t.due, day) + '</div>'; }).join('') + (x.list.length > 8 ? '<div style="font-size:12px;color:' + MAIL.muted + '">and ' + (x.list.length - 8) + ' more on the close-out page.</div>' : '') +
          '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:4px">Comment on each on the close-out page: what was done, what is left, and when.</div>'
          : '<div style="font-size:12.5px;color:' + MAIL.green + ';padding-top:3px">Nothing outstanding.</div>') + '</div>'; }).join(''); })() : '') +
    (function () { var sy = hkSystems_(sid, day); return sy ? sectionLabel_('Branch sheets to close off before you go') + sy : ''; })() +
    (new Date(day + 'T12:00:00Z').getUTCDay() === 5 ? (function () { try { return weekCard_(sid, day, weekFor_(sid, day), 'Your week · Monday to today'); } catch (e) { return ''; } })() : '') +
    check(1, 'Tasks verified', c1, !unnoted.length && !dueOpen.length && blockPct === 100) +
    check(2, 'Inbox and WhatsApp scrubbed', c2, false) +
    check(3, 'Open tasks understood', c3, sfOk && day1 && day1.created > 0) +
    (function () { try { var m = mailbagCard_(sid, day); return check(4, m.isRouter ? 'The mailbag · you route it this week' : 'The mailbag · handed over', m.html, m.ok); } catch (e) { return ''; } })() +
    replyButton_(replyUrl_(sid, day, 'hk'), 'Close my day here', '') +
    (sfOk ? '' : '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin-top:12px">Salesforce did not answer, so the task lists are not shown. The tracker has them.</div>') +
    '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">' +
      'Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';

  var mail = {
    to: to,
    subject: (new Date(day + 'T12:00:00Z').getUTCDay() === 5 ? 'Close-out and your week · ' : 'Close-out notice · ') + name + ' · ' + shortDate_(day) + ' · signed out at ' + endText + ' · ' + (blockPct >= 100 ? 'day reported' : 'day not reported') +
             (of ? ', ' + pct + '% of plan' : ', no plan') + (unnoted.length ? ', ' + unnoted.length + ' closed without a note' : ''),
    htmlBody: shell_('Before you leave', name + ' · ' + prettyDate_(day) + ' · finishing ' + endText, body)
  };
  var cc = dayStartCc_(to);
  if (cc.length) mail.cc = cc.join(',');
  MailApp.sendEmail(mail);
  return true;
}

/** Sign-out with the close-out not finished: the Branch Manager and sales
 *  support are told, with the reasons given. The sign-out itself goes ahead. */
function signOutNotice_(sid, day, at) {
  var person = rosterPerson_(sid) || { staffId: sid, name: nameFor_(sid) };
  var state = closeoutFor_(person, day);
  if (!state.of || state.complete) return false;
  var left = state.items.filter(function (r) { return !r.done; });
  var cc = dayStartCc_('', sid);
  if (!cc.length) return false;
  var rows = left.map(function (r) {
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.amber + ';border-radius:9px;padding:10px 13px;margin-bottom:8px">' +
      '<div style="font-size:13px;font-weight:700">' + esc_(r.item) + '</div>' +
      '<div style="font-size:12.5px;color:' + (r.reason ? MAIL.ink : MAIL.red) + ';margin-top:3px">' + esc_(r.reason ? 'Not done: ' + r.reason : 'No answer given') + '</div></div>';
  }).join('');
  MailApp.sendEmail({
    to: cc.join(','),
    subject: 'Signed out with close-out open · ' + (person.name || sid) + ' · ' + shortDate_(day) + ' · ' + at + ' · ' + left.length + ' of ' + state.of + ' not done',
    htmlBody: shell_('Signed out with the close-out open', (person.name || sid) + ' · ' + prettyDate_(day) + ' · ' + at,
      '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + esc_(person.name || sid) + ' signed out at <b>' + esc_(twelve_(at)) +
        '</b> with ' + left.length + ' of ' + state.of + ' close-out items not done.</div>' + rows)
  });
  return true;
}

// ---------------------------------------------------------------------------
//  Intelligence: what the record shows, and a plan built from it
//
//  "Where is the email with intelligence to redo, having looked at what is
//  being done, observing the trends on open tasks, blocks and time
//  management, and if something can be done on a time block to include, and
//  her to redo her blocks?" (Ricky, 14 October 2026.)
//
//  intelFor_      the last INTEL_DAYS working days for one person, as plain
//                 numbers: overdue then and now, work in, work closed, closed
//                 with no note, the day most was closed, work done after the
//                 finishing time, sign-in, blocks filed before they started,
//                 days with a plan. Salesforce plus the tracker's own sheets.
//  intelLines_    those numbers as sentences, each one checkable.
//  intelTarget_   today's number, from her own pace: half again her average,
//                 never more than what is due today plus the overdue spread
//                 over two weeks, never more than what is waiting.
//  suggestPlan_   that number put into her blocks by name. Each block takes
//                 the work its schedule sets first; a block with room takes
//                 the oldest overdue from outside its type, marked as such.
//
//  Used by the morning e-mail, the progress check before lunch and the
//  before-you-leave e-mail. Nothing is estimated that the record does not
//  show; where Salesforce does not answer, the lines that need it are left out.
// ---------------------------------------------------------------------------

var INTEL_DAYS = 10;          // working days looked back over
var INTEL_CLEAR_DAYS = 10;    // the overdue spread over two working weeks
var INTEL_STRETCH = 1.5;      // today's plan: half again the average day
var INTEL_SHOW = 8;           // tasks named per block in the suggested plan

/** "2026-10-12T12:53:07.000+0000" (UTC) -> { day, min } in branch time. */
function sfLocal_(s) {
  var m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  var mins = Number(m[2]) * 60 + Number(m[3]) - 240, d = m[1];
  if (mins < 0) { mins += 1440; d = shiftDays_(d, -1); }
  return { day: d, min: mins };
}

/** The n weekdays before day, oldest first. */
function lastWorkdays_(day, n) {
  var out = [], d = day;
  while (out.length < n) {
    d = shiftDays_(d, -1);
    var dow = new Date(d + 'T12:00:00Z').getUTCDay();
    if (dow >= 1 && dow <= 5) out.unshift(d);
  }
  return out;
}

/** Salesforce, raw: every task in her name that was open, overdue, created or
 *  closed in the window, and every note she wrote in it. Two queries. */
function sfkIntelRaw_(staffId, day, from) {
  var u = (sfkUsers_() || {})[staffId];
  if (!u) return null;
  var since = sfkUtcAt_(from, 0);
  var tasks = sfkQuery_(
    'SELECT Id, Subject, Task_Type__c, IsClosed, ActivityDate, CreatedDate, CompletedDateTime, LastModifiedDate, CreatedById FROM Task' +
    " WHERE OwnerId = '" + u.id + "' AND (NOT Subject LIKE 'Email:%') AND (NOT Subject LIKE '%Email: Happy Birthday%') AND (CreatedDate >= " + since +
    ' OR (IsClosed = true AND LastModifiedDate >= ' + since + ')' +
    ' OR (IsClosed = false AND ActivityDate < ' + day + ')) LIMIT 2000');
  var notes = sfkQuery_(
    "SELECT ParentId, CreatedDate FROM FeedItem WHERE CreatedById = '" + u.id + "' AND CreatedDate >= " + since +
    " AND Type IN ('TextPost','ContentPost','LinkPost') LIMIT 2000");
  return {
    uid: u.id,
    tasks: tasks.map(function (t) {
      return { id: t.Id, c: !!t.IsClosed, due: t.ActivityDate || '', made: t.CreatedDate,
               done: t.IsClosed ? (t.CompletedDateTime || t.LastModifiedDate) : '', by: t.CreatedById,
               s: shorten_(t.Subject || '', 90), ty: t.Task_Type__c || '' };
    }),
    notes: notes.map(function (f) { return { p: f.ParentId, at: f.CreatedDate }; })
  };
}

/** The tracker, raw: sign-in minutes, blocks filed and how many before they
 *  started, and whether a block was planned with Salesforce tasks, per day. */
function trackerIntelRaw_(staffId, days) {
  var set = {}, sign = {}, filed = {}, planned = {};
  days.forEach(function (d) { set[d] = 1; });
  try {
    (hrRows_(ATT, true) || []).forEach(function (r) {
      var d = isoDay_(r.Date);
      if (!set[d] || String(r.StaffId) !== String(staffId)) return;
      if (String(r.Status || '').toLowerCase() === 'absent') return;
      var t = timeStr_(r.FirstSignIn);
      if (t && minutesOf_(t) != null) sign[d] = minutesOf_(t);
    });
  } catch (e) {}
  try {
    latestEntries_().forEach(function (e) {
      if (String(e.StaffId) !== String(staffId) || !set[e.Date]) return;
      var n = 0, early = 0;
      BLOCK_IDS.forEach(function (b) {
        var at = e[b + '_At'];
        if (!at) return;
        var t = Object.prototype.toString.call(at) === '[object Date]' ? hhmm_(at) : timeStr_(at);
        var sp = blockSpan_(staffId, b);
        if (!t || !sp) return;
        n++;
        if (minutesOf_(t) < sp.start) early++;
      });
      if (n) filed[e.Date] = { n: n, early: early };
    });
  } catch (e) {}
  try {
    (hrRows_(BPLAN, true) || []).forEach(function (r) {
      var d = isoDay_(r.Date);
      if (!set[d] || String(r.StaffId) !== String(staffId)) return;
      if (planItemsOf_(r.Items).some(function (it) { return it.k === 'sf'; })) planned[d] = 1;
    });
  } catch (e) {}
  return { sign: sign, filed: filed, planned: planned };
}

function intelFor_(staffId, day) {
  var cache = CacheService.getScriptCache(), key = 'intel_' + staffId + '_' + day;
  try { var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) {}

  var days = lastWorkdays_(day, INTEL_DAYS), from = days[0], inWin = {};
  days.forEach(function (d) { inWin[d] = 1; });
  var sched = scheduleFor_(staffId);
  var hrs = parseSpan_(sched.hours || '') || { start: 8 * 60, end: 16 * 60 };
  // The week, the month and the quarter are read from the same pull, so it
  // reaches back to whichever starts first.
  var periods = intelPeriods_(day), reach = from;
  periods.forEach(function (pp) { if (pp.from < reach) reach = pp.from; });
  var raw = null;
  if (sfkConfigured_()) { try { raw = sfkIntelRaw_(staffId, day, reach); } catch (e) { raw = null; } }
  var allDays = [];
  for (var dd = reach; dd < day; dd = shiftDays_(dd, 1)) {
    var dw = new Date(dd + 'T12:00:00Z').getUTCDay();
    if (dw >= 1 && dw <= 5) allDays.push(dd);
  }
  var trAll = trackerIntelRaw_(staffId, allDays);
  var tr = { sign: {}, filed: {}, planned: {} };
  ['sign', 'filed', 'planned'].forEach(function (k) {
    Object.keys(trAll[k]).forEach(function (d) { if (inWin[d]) tr[k][d] = trAll[k][d]; });
  });

  var r = { from: from, to: days[days.length - 1], days: days.length, sf: !!raw, start: hrs.start, end: hrs.end };
  var worked = {};
  Object.keys(tr.sign).forEach(function (d) { worked[d] = 1; });

  if (raw) {
    var noted = {}, perDay = {}, actions = 0, after = 0, closed = 0, unnoted = 0, arrived = 0, self = 0;
    var yday = days[days.length - 1], y = { day: yday, closed: 0, noted: 0, payoff: 0 };
    raw.notes.forEach(function (n) {
      noted[n.p] = 1;
      var l = sfLocal_(n.at);
      if (!l || !inWin[l.day]) return;
      worked[l.day] = 1; actions++;
      if (l.min >= hrs.end) after++;
    });
    raw.tasks.forEach(function (t) {
      var mk = sfLocal_(t.made), dn = t.c ? sfLocal_(t.done) : null;
      if (mk && inWin[mk.day]) { arrived++; if (t.by === raw.uid) self++; }
      if (dn && inWin[dn.day]) {
        closed++; perDay[dn.day] = (perDay[dn.day] || 0) + 1;
        if (!noted[t.id]) unnoted++;
        if (dn.day === yday) { y.closed++; if (noted[t.id]) y.noted++; if (payoffOf_(t).rank < 9) y.payoff++; }
        worked[dn.day] = 1; actions++;
        if (dn.min >= hrs.end) after++;
      }
    });
    // Overdue as a day began: due before it, in her name by then, not closed
    // before it. Tasks moved to her later are counted from when they arrived.
    var overdueOn = function (d) {
      return raw.tasks.filter(function (t) {
        if (!t.due || t.due >= d) return false;
        var mk = sfLocal_(t.made);
        if (mk && mk.day > d) return false;
        if (!t.c) return true;
        var dn = sfLocal_(t.done);
        return !!(dn && dn.day >= d);
      }).length;
    };
    r.overdueStart = overdueOn(from);
    r.overdueNow = overdueOn(day);
    r.arrived = arrived; r.self = self; r.closed = closed; r.unnoted = unnoted;
    r.actions = actions; r.after = after; r.yesterday = y;
    var peak = { day: '', n: 0 };
    Object.keys(perDay).forEach(function (d) { if (perDay[d] > peak.n) peak = { day: d, n: perDay[d] }; });
    r.peak = peak;
    var counts = Object.keys(worked).map(function (d) { return perDay[d] || 0; }).sort(function (a, b) { return a - b; });
    r.median = counts.length ? (counts.length % 2 ? counts[(counts.length - 1) / 2]
      : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2) : 0;
    r.zeroDays = counts.filter(function (c) { return c === 0; }).length;
  }
  r.worked = Object.keys(worked).length;
  r.pace = r.sf && r.worked ? Math.round(10 * r.closed / r.worked) / 10 : null;
  r.periods = raw ? periods.map(function (pp) { return intelPeriodStats_(raw, trAll, pp, day, hrs); }) : [];

  var signs = Object.keys(tr.sign).map(function (d) { return tr.sign[d]; });
  r.signDays = signs.length;
  r.signAvg = signs.length ? Math.round(signs.reduce(function (a, b) { return a + b; }, 0) / signs.length) : null;
  r.lateDays = signs.filter(function (m) { return m > hrs.start + ATT_GRACE_MIN; }).length;
  var fd = Object.keys(tr.filed);
  r.filedDays = fd.length;
  r.earlyDays = fd.filter(function (d) { return tr.filed[d].early >= 2; }).length;
  r.plannedDays = Object.keys(tr.planned).length;

  try { cache.put(key, JSON.stringify(r), 6 * 3600); } catch (e) {}
  return r;
}

/** This week, this month, this quarter, each up to yesterday. On a Monday
 *  the week is last week, so it has something in it. */
function intelPeriods_(day) {
  var y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7));
  var q0 = Math.floor((m - 1) / 3) * 3 + 1;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var wk = weekStart_(day), wLabel = 'This week';
  if (wk === day) { wk = shiftDays_(wk, -7); wLabel = 'Last week'; }
  var mo = day.slice(0, 8) + '01', mLabel = 'This month';
  if (mo === day) { mo = (m === 1 ? (y - 1) + '-12' : y + '-' + pad(m - 1)) + '-01'; mLabel = 'Last month'; }
  var qu = y + '-' + pad(q0) + '-01', qLabel = 'This quarter';
  if (qu === day) { var pq = q0 - 3, py = y; if (pq < 1) { pq += 12; py--; } qu = py + '-' + pad(pq) + '-01'; qLabel = 'Last quarter'; }
  return [
    { key: 'week', label: wLabel, from: wk, to: wLabel === 'Last week' ? shiftDays_(wk, 7) : day },
    { key: 'month', label: mLabel, from: mo, to: day },
    { key: 'quarter', label: qLabel, from: qu, to: day }
  ];
}

function intelPeriodStats_(raw, tr, pp, day, hrs) {
  var inP = function (d) { return d && d >= pp.from && d < pp.to; };
  var noted = {}, worked = {}, closed = 0, withNote = 0, payoff = 0, arrived = 0, after = 0, acts = 0;
  raw.notes.forEach(function (n) {
    noted[n.p] = 1;
    var l = sfLocal_(n.at);
    if (l && inP(l.day)) { worked[l.day] = 1; acts++; if (l.min >= hrs.end) after++; }
  });
  Object.keys(tr.sign || {}).forEach(function (d) { if (inP(d)) worked[d] = 1; });
  raw.tasks.forEach(function (t) {
    var mk = sfLocal_(t.made), dn = t.c ? sfLocal_(t.done) : null;
    if (mk && inP(mk.day)) arrived++;
    if (dn && inP(dn.day)) {
      closed++; worked[dn.day] = 1; acts++;
      if (dn.min >= hrs.end) after++;
      if (noted[t.id]) withNote++;
      if (payoffOf_(t).rank < 9) payoff++;
    }
  });
  var w = Object.keys(worked).length;
  var overdueOn = function (d) {
    return raw.tasks.filter(function (t) {
      if (!t.due || t.due >= d) return false;
      var mk = sfLocal_(t.made);
      if (mk && mk.day > d) return false;
      if (!t.c) return true;
      var dn = sfLocal_(t.done);
      return !!(dn && dn.day >= d);
    }).length;
  };
  return { key: pp.key, label: pp.label, from: pp.from, to: pp.to, worked: w, closed: closed,
           perDay: w ? Math.round(10 * closed / w) / 10 : 0,
           notePct: closed ? Math.round(100 * withNote / closed) : null,
           payoff: closed ? Math.round(100 * payoff / closed) : null,
           arrived: arrived, overdueFrom: overdueOn(pp.from), overdueTo: overdueOn(pp.to),
           afterPct: acts ? Math.round(100 * after / acts) : 0 };
}

/** The three periods side by side. */
function periodTable_(r) {
  if (!r || !r.periods || !r.periods.length) return '';
  var P = r.periods;
  var th = function (x) { return '<td style="padding:7px 6px;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:' + MAIL.navy + ';text-align:right">' + esc_(x) + '</td>'; };
  var td = function (x, bad) { return '<td style="padding:7px 6px;font-size:13px;text-align:right;border-top:1px solid ' + MAIL.line + ';' + (bad ? 'color:' + MAIL.red + ';font-weight:700' : '') + '">' + x + '</td>'; };
  var lab = function (x) { return '<td style="padding:7px 6px;font-size:12.5px;color:' + MAIL.muted + ';border-top:1px solid ' + MAIL.line + '">' + esc_(x) + '</td>'; };
  var row = function (name, f) { return '<tr>' + lab(name) + P.map(f).join('') + '</tr>'; };
  return sectionLabel_('Your week, month and quarter') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr><td></td>' + P.map(function (p) { return th(p.label); }).join('') + '</tr>' +
    row('Closed (a day)', function (p) { return td('<b>' + p.closed + '</b> (' + p.perDay + ')'); }) +
    row('Closed with your note', function (p) { return td(p.notePct == null ? '—' : p.notePct + '%', p.notePct != null && p.notePct < 80); }) +
    row('High-payoff share', function (p) { return td(p.payoff == null ? '—' : p.payoff + '%'); }) +
    row('Came in', function (p) { return td(p.arrived, p.arrived > p.closed); }) +
    row('Overdue, start → now', function (p) { return td(p.overdueFrom + ' → ' + p.overdueTo, p.overdueTo > p.overdueFrom); }) +
    row('After your finish', function (p) { return td(p.afterPct + '%', p.afterPct >= 15); }) +
    '</table>' +
    '<div style="font-size:11.5px;color:' + MAIL.muted + ';margin-top:5px">Up to yesterday. High payoff is new business, orphan adoption and retention.</div>';
}

/** The numbers as sentences. Each line: { html, bad }. */
function intelLines_(r, first) {
  var out = [], b = function (x) { return '<b>' + esc_(x) + '</b>'; };
  var red = function (x) { return '<b style="color:' + MAIL.red + '">' + esc_(x) + '</b>'; };
  var span = shortDate_(r.from) + ' to ' + shortDate_(r.to);
  if (r.sf) {
    var up = r.overdueNow - r.overdueStart;
    out.push({ bad: up > 0 || r.overdueNow > 0,
      html: 'Overdue tasks in your name went from ' + b(r.overdueStart) + ' to ' + (up > 0 ? red(r.overdueNow) : b(r.overdueNow)) +
        ' over the last ' + r.days + ' working days (' + esc_(span) + ')' +
        (up > 0 ? ', up ' + up + '.' : (up < 0 ? ', down ' + (-up) + '. Keep that going.' : '.')) });
    var net = r.arrived - r.closed;
    out.push({ bad: net > 0,
      html: b(r.arrived) + ' tasks came into your name (' + r.self + ' logged by you) and you closed ' + b(r.closed) + '. ' +
        (net > 0 ? 'The pile grew by ' + red(net) + ', about ' + Math.round(net / Math.max(1, r.worked)) + ' a working day.'
                 : 'You closed more than came in.') });
    if (r.worked) {
      var batch = r.peak.n >= 10 && r.peak.n >= 2 * Math.max(1, r.median);
      out.push({ bad: batch || r.zeroDays > 1,
        html: 'Across ' + r.worked + ' days worked you closed ' + b(r.pace) + ' a day on average; a typical day was ' + b(r.median) + '.' +
          (batch ? ' ' + red(r.peak.n) + ' of the ' + r.closed + ' were closed on one day (' + esc_(shortDate_(r.peak.day)) +
            '). Close each task when it is done, not in a batch.' : '') +
          (r.zeroDays ? ' On ' + (r.zeroDays > 1 ? red(r.zeroDays + ' days') : b('1 day')) + ' nothing was closed.' : '') });
    }
    if (r.unnoted) out.push({ bad: true,
      html: red(r.unnoted) + ' of the ' + r.closed + ' you closed have no note from you. A closed task without a note is not closed.' });
    if (r.actions) {
      var ap = Math.round(100 * r.after / r.actions);
      if (ap >= 15) out.push({ bad: true,
        html: b(ap + '%') + ' of your Salesforce work (' + r.after + ' of ' + r.actions + ' closures and notes) was after your ' +
          esc_(twelve_(mmText_(r.end))) + ' finish. Work planned into the day is work done in the day.' });
    }
  }
  // Only said when it happened: a report filed before the day it reports on.
  if (r.filedDays && r.earlyDays) {
    out.push({ bad: true,
      html: 'On ' + red(r.earlyDays + ' of ' + r.filedDays) + ' days the report was filed before the work it reports on. The plan is made in the morning; what was done is written at the close.' });
  }
  out.push({ bad: r.plannedDays < Math.max(1, r.signDays),
    html: 'You planned Salesforce tasks into your day on ' + (r.plannedDays ? b(r.plannedDays) : red('0')) + ' of ' + (r.signDays || r.worked || r.days) + ' days.' });
  if (r.signAvg != null) {
    out.push({ bad: r.lateDays > 1,
      html: 'You signed in at ' + b(twelve_(mmText_(r.signAvg))) + ' on average; your day starts at ' + esc_(twelve_(mmText_(r.start))) + '.' +
        (r.lateDays ? ' Later than ' + esc_(twelve_(mmText_(r.start + ATT_GRACE_MIN))) + ' on ' + (r.lateDays > 1 ? red(r.lateDays) : b(r.lateDays)) + ' of ' + r.signDays + ' days.' : '') });
  }
  return first ? out.slice(0, first) : out;
}

/** Credit where due: yesterday, against her own average. */
function creditLine_(r) {
  if (!r || !r.sf || !r.yesterday) return null;
  var y = r.yesterday, good = r.pace != null && y.closed >= r.pace && (!y.closed || y.noted / y.closed >= 0.8);
  var b_ = function (x) { return '<b>' + esc_(x) + '</b>'; };
  return { bad: !good, html: (good ? '<b style="color:' + MAIL.green + '">Thank you.</b> ' : '') + 'Yesterday (' + esc_(shortDate_(y.day)) + ') you closed ' + b_(y.closed) +
    (y.closed ? ', ' + b_(y.noted) + ' with your note, ' + b_(y.payoff) + ' high payoff' : '') +
    (r.pace != null ? ', against your average of ' + esc_(r.pace) + ' a day' : '') + '.' + (good ? ' That is the standard.' : '') };
}

function intelBox_(lines, title) {
  if (!lines.length) return '';
  return sectionLabel_(title) +
    '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:6px 15px 8px">' +
    lines.map(function (l, i) {
      return '<div style="font-size:13.5px;line-height:1.55;padding:7px 0 7px 14px;position:relative;' + (i ? 'border-top:1px solid ' + MAIL.line + ';' : '') + '">' +
        '<span style="position:absolute;left:0;top:14px;width:7px;height:7px;border-radius:7px;background:' + (l.bad ? MAIL.red : MAIL.green) + '"></span>' +
        l.html + '</div>';
    }).join('') + '</div>';
}

/** Today's number. */
function intelTarget_(r, dueToday, overdue, waiting) {
  var need = dueToday + Math.ceil(overdue / INTEL_CLEAR_DAYS);
  var stretch = r && r.pace ? Math.ceil(r.pace * INTEL_STRETCH) : need;
  return Math.max(0, Math.min(waiting, need, Math.max(stretch, 1)));
}

/* High-payoff work: what brings business in or keeps it on the books, in
   the order Ricky ranked it on 14 October 2026 — new business, orphan
   adoption, retention. It goes first in every block. Task_Type__c alone
   cannot tell (most tasks are typed Servicing or not typed), so the subject
   is read too. */
var PAYOFF = [
  { key: 'new', label: 'New business', rank: 1, types: ['Pendings', 'Opportunity'],
    re: /new app|application|proposal|pending|requirement|increase|quot|underwrit|medical|\bPMAR\b|\bAPS\b|new business|enrol/i },
  { key: 'orphan', label: 'Orphan adoption', rank: 2, types: [],
    re: /orphan|service questionnaire|\bSQ\b|adopt/i },
  { key: 'retention', label: 'Retention', rank: 3, types: ['Renewa/PDl/Bill'],
    re: /premium|lapse|reinstat|renewal|billing|direct debit|\bDD\b|stop payment|arrears|paid, not showing|call back|conserv/i }
];

var PAYOFF_NOT = ['Lic/Staffing/SA/HR', 'Training', 'RR Operations'];   // a licence "application" is not new business

function payoffOf_(t) {
  var subj = String((t && (t.subject || t.s)) || ''), ty = String((t && (t.ty || t.type)) || '');
  var byWords = PAYOFF_NOT.indexOf(ty) === -1;
  for (var i = 0; i < PAYOFF.length; i++) {
    var p = PAYOFF[i];
    if ((byWords && p.re.test(subj)) || p.types.indexOf(ty) > -1) return p;
  }
  return { key: 'other', label: '', rank: 9 };
}

/** High payoff first, then overdue before due today, then the oldest. */
function intelOrder_(a, b) {
  var ra = payoffOf_(a).rank, rb = payoffOf_(b).rank;
  if (ra !== rb) return ra - rb;
  if (!!a.late !== !!b.late) return a.late ? -1 : 1;
  return String(a.due || '9999').localeCompare(String(b.due || '9999'));
}

/** Oldest first, payoff or not: what has waited longest. */
function oldestOrder_(a, b) {
  return String(a.due || '9999').localeCompare(String(b.due || '9999'));
}

function payoffTag_(t) {
  var p = payoffOf_(t);
  return p.label ? ' <span style="display:inline-block;background:#E8F1EC;color:' + MAIL.green + ';font-size:10.5px;font-weight:800;letter-spacing:.04em;padding:1px 6px;border-radius:5px">' + esc_(p.label.toUpperCase()) + '</span>' : '';
}

/** blocks: [{ id, sb, waiting:[task] }] in day order, each task once.
 *  loose: [task] with no block of its own. Returns { id: [{ t, brought }] }. */
function suggestPlan_(staffId, blocks, loose, target) {
  var out = {}, mins = {}, total = 0;
  blocks.forEach(function (x) {
    var sp = blockSpan_(staffId, x.id);
    mins[x.id] = sp ? Math.max(0, sp.end - sp.start) : 60;
    total += mins[x.id];
    out[x.id] = [];
  });
  if (!target || !total) return out;
  var quota = {}, given = 0;
  blocks.forEach(function (x) { quota[x.id] = Math.floor(target * mins[x.id] / total); given += quota[x.id]; });
  // Every block gets at least one when the day's number allows it: a
  // suggestion that leaves a block empty fails its own plan check.
  if (target >= blocks.length) {
    blocks.forEach(function (x) { if (!quota[x.id]) { quota[x.id] = 1; given++; } });
    var big = blocks.slice().sort(function (a, b) { return quota[b.id] - quota[a.id]; });
    for (var j = 0; given > target && j < big.length * target; j++) { var bb = big[j % big.length]; if (quota[bb.id] > 1) { quota[bb.id]--; given--; } }
  }
  // Hand out the rounding to the longest blocks.
  var bySize = blocks.slice().sort(function (a, b) { return mins[b.id] - mins[a.id]; });
  for (var i = 0; given < target && bySize.length; i = (i + 1) % bySize.length) { quota[bySize[i].id]++; given++; }

  var used = {}, pool = [];
  blocks.forEach(function (x) {
    var own = x.waiting.slice().sort(intelOrder_);
    own.forEach(function (t, k) {
      if (k < quota[x.id]) { out[x.id].push({ t: t, brought: '' }); used[t.id] = 1; }
      else pool.push({ t: t, from: blockLabel_(x.id) });
    });
  });
  loose.forEach(function (t) { pool.push({ t: t, from: 'no block' }); });
  pool.sort(function (a, b) { return intelOrder_(a.t, b.t); });
  blocks.forEach(function (x) {
    while (out[x.id].length < quota[x.id] && pool.length) {
      var p = pool.shift();
      if (used[p.t.id]) continue;
      used[p.t.id] = 1;
      out[x.id].push({ t: p.t, brought: p.from });
    }
  });
  return out;
}

function suggestLines_(list, date, max) {
  max = max || INTEL_SHOW;
  return list.slice(0, max).map(function (s) {
    return dayStartTaskLine_(s.t, date).replace('</div>',
      (s.brought ? ' <span style="color:' + MAIL.navy + ';font-size:11.5px">· brought in from ' + esc_(s.brought) + '</span>' : '') + '</div>');
  }).join('') +
  (list.length > max ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:3px">and ' + (list.length - max) + ' more on your plan page.</div>' : '');
}

function intelTargetKey_(sid, day) { return 'intel_target_' + sid + '_' + day; }

// ---------------------------------------------------------------------------
//  The progress check, half an hour before lunch
//
//  "During the day, the email that's triggered with % completed and insights."
//  Half an hour before each person's lunch (11:30 for a flexible lunch), from
//  keepWarm like the housekeeping mail: where the day stands against the
//  morning's number, the pace it is running at, what has gone quiet, and
//  the afternoon's blocks with the work that is left put into them.
// ---------------------------------------------------------------------------

var MIDDAY_LEAD_MIN = 30;

function middayAt_(staffId) {
  var sp = parseSpan_(scheduleFor_(staffId).lunch || '');
  return sp ? sp.start - MIDDAY_LEAD_MIN : 11 * 60 + 30;
}

/** Working minutes between the start of the day and m, lunch left out. */
function workedMins_(staffId, m) {
  var sc = scheduleFor_(staffId), hrs = parseSpan_(sc.hours || '') || { start: 480, end: 960 };
  var lu = parseSpan_(sc.lunch || '');
  var upto = Math.max(hrs.start, Math.min(m, hrs.end)), w = upto - hrs.start;
  if (lu) w -= Math.max(0, Math.min(upto, lu.end) - lu.start);
  return Math.max(0, w);
}

function sendMidday_(person, day, signIn, nowOpt) {
  var sid = String(person.staffId), to = emailFor_(sid);
  if (!to) return false;
  var now = nowOpt || new Date(), nowM = minutesOf_(hhmm_(now));
  var sched = scheduleFor_(sid), name = nameFor_(sid), first = String(name).split(' ')[0];
  var hrs = parseSpan_(sched.hours || '') || { start: 480, end: 960 };
  var sfOk = sfkConfigured_(), day1 = null, book = {}, r = null;
  if (sfOk) {
    try { day1 = sfkDayFor_(sid, day); } catch (e) { day1 = null; }
    try { book = (sfkOpenBook_(day) || {})[sid] || {}; } catch (e) { sfOk = false; }
  }
  try { r = intelFor_(sid, day); } catch (e) { r = null; }

  var overdue = 0, dueOpen = [], all = [];
  Object.keys(book).forEach(function (ty) {
    book[ty].forEach(function (t) {
      if (t.late) overdue++;
      if (t.due === day) dueOpen.push(t);
      if (t.late || t.due === day) all.push({ t: t, ty: ty });
    });
  });
  var closed = day1 ? day1.closed.length : 0, unnoted = day1 ? day1.closed.filter(function (t) { return !t.noted; }) : [];
  var props = PropertiesService.getScriptProperties();
  var target = Number(props.getProperty(intelTargetKey_(sid, day)) || 0);
  if (!target) target = closed + intelTarget_(r, dueOpen.length, overdue, all.length);
  var pct = target ? Math.round(100 * closed / target) : null;
  var done = workedMins_(sid, nowM), whole = workedMins_(sid, hrs.end);
  var dayPct = whole ? Math.round(100 * done / whole) : 0;
  var proj = done ? Math.round(closed * whole / done) : 0;
  var behind = pct != null && pct < dayPct;

  // Blocks that have ended: was a report filed after the block, or only before?
  var vals = null, idx = {};
  try { var sh = logSheet_(); idx = colMap_(sh); vals = findDayRow_(sh, idx, sid, day).vals; } catch (e) {}
  var cell = function (n) { return (vals && idx[n] != null) ? vals[idx[n]] : ''; };
  var ended = [], unreported = [];
  BLOCK_IDS.forEach(function (b) {
    var sp = blockSpan_(sid, b);
    if (!sched.blocks[b] || !sp || sp.end > nowM) return;
    ended.push(b);
    var at = cell(b + '_At');
    var t = (at && Object.prototype.toString.call(at) === '[object Date]') ? hhmm_(at) : timeStr_(at);
    if (!t || minutesOf_(t) < sp.end - 15) unreported.push({ b: b, at: t });
  });

  var lines = [], b_ = function (x) { return '<b>' + esc_(x) + '</b>'; }, red = function (x) { return '<b style="color:' + MAIL.red + '">' + esc_(x) + '</b>'; };
  if (sfOk && day1) {
    lines.push({ bad: behind,
      html: 'You have closed ' + b_(closed) + ' of today\'s ' + b_(target) + ' (' + (behind ? red(pct + '%') : b_(pct + '%')) + ') with ' +
        b_(dayPct + '%') + ' of the working day gone. At this pace the day ends at ' + (proj < target ? red(proj) : b_(proj)) + '.' });
    if (day1.lastAt != null) {
      var gap = nowM - day1.lastAt;
      lines.push({ bad: gap > 60,
        html: 'Your last Salesforce entry was at ' + b_(twelve_(mmText_(day1.lastAt))) + (gap > 60 ? ', ' + red(Math.floor(gap / 60) + 'h ' + (gap % 60) + 'm') + ' ago. Log at the point of work.' : '.') });
    } else {
      lines.push({ bad: true, html: red('Nothing logged in Salesforce yet today.') + ' Log at the point of work.' });
    }
    if (unnoted.length) lines.push({ bad: true, html: red(unnoted.length) + ' closed today with no note from you.' });
    var morning = [];
    try { morning = JSON.parse(props.getProperty('intel_plan_' + sid + '_' + day) || '[]'); } catch (e) {}
    if (morning.length) {
      var shut = {}; day1.closed.forEach(function (t) { shut[t.id] = 1; });
      var hit = morning.filter(function (id) { return shut[id]; }).length;
      lines.push({ bad: hit < morning.length * dayPct / 100,
        html: 'Of the ' + b_(morning.length) + ' tasks suggested this morning, ' + (hit ? b_(hit) : red('none')) + (hit === 1 ? ' is' : ' are') + ' closed.' });
    }
  }
  if (ended.length) {
    lines.push({ bad: unreported.length > 0,
      html: unreported.length
        ? unreported.map(function (u) { return esc_(blockLabel_(u.b)); }).join(' and ') + (unreported.length > 1 ? ' have' : ' has') + ' ended with no report after ' +
          (unreported.length > 1 ? 'they' : 'it') + ' ended' + (unreported.some(function (u) { return u.at; }) ? ' (what is on file was filed before)' : '') + '. Write what was actually done.'
        : 'Everything that has ended has its report. Thank you.' });
  }
  if (r && r.sf && r.overdueNow != null) lines.push({ bad: overdue > 0, html: 'Overdue right now: ' + (overdue ? red(overdue) : b_(0)) + '. Due today and still open: ' + b_(dueOpen.length) + '.' });

  // The afternoon: what is left of the target, put into the blocks still to come.
  var left = Math.max(0, target - closed), later = [], seen = {};
  BLOCK_IDS.forEach(function (b) {
    var sp = blockSpan_(sid, b);
    if (sched.blocks[b] && sp && sp.end > nowM) later.push({ id: b, sb: sched.blocks[b], own: blockTypeFor_(sched.blocks[b].kpi),
      types: blockSfTypes_(sched.blocks[b].kpi, String(cell(b) || '')), waiting: [] });
  });
  var loose = [];
  all.forEach(function (x) {
    if (seen[x.t.id]) return; seen[x.t.id] = 1;
    var home = later.filter(function (y) { return y.own === x.ty; })[0] ||
               later.filter(function (y) { return y.types.indexOf(x.ty) > -1; })[0];
    if (home) home.waiting.push(x.t); else loose.push(x.t);
  });
  var innoNow = innovationBlock_(sid, day);
  var plan = suggestPlan_(sid, later.filter(function (x) { return x.id !== innoNow; }), loose.concat([].concat.apply([], later.filter(function (x) { return x.id === innoNow; }).map(function (x) { return x.waiting; }))), Math.min(left, all.length));
  var cards = later.map(function (x) {
    if (x.id === innoNow) {
      return '<div style="background:#EEF9FD;border:1px solid ' + MAIL.gold + ';border-left:4px solid ' + MAIL.gold + ';border-radius:10px;padding:13px 15px;margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.gold + '">' + esc_(blockLabel_(x.id)) + (x.sb.time ? ' · ' + esc_(x.sb.time) : '') + ' · Innovation hour · protected</div>' +
        '<div style="font-size:12.5px;margin-top:4px">Keep it clear. Move your innovation forward and say what moved before you leave.</div></div>';
    }
    var list = plan[x.id] || [];
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (list.length ? MAIL.amber : MAIL.green) + ';border-radius:10px;padding:13px 15px;margin-bottom:10px">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.gold + '">' + esc_(blockLabel_(x.id)) + (x.sb.time ? ' · ' + esc_(x.sb.time) : '') + ' · ' + list.length + ' suggested</div>' +
      '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin:4px 0 4px">' + esc_(x.sb.focus || '') + '</div>' +
      (list.length ? suggestLines_(list, day) : '<div style="font-size:12.5px;color:' + MAIL.green + '">Nothing due or overdue left for today.</div>') + '</div>';
  }).join('');

  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + esc_(first) + ', it is ' + esc_(twelve_(hhmm_(now))) +
      '. Here is where your day stands against this morning\'s plan, and what is left for ' + (later.length ? 'the rest of the day' : 'tomorrow') + '.</div>' +
    statTiles_([
      { value: pct == null ? '—' : pct + '%', label: 'of today\'s plan', color: behind ? MAIL.red : MAIL.green },
      { value: dayPct + '%', label: 'of the day gone' },
      { value: sfOk && day1 ? closed + ' / ' + target : '—', label: 'closed / target', color: behind ? MAIL.amber : MAIL.navy },
      { value: sfOk ? overdue : '—', label: 'overdue', color: overdue ? MAIL.red : MAIL.navy }
    ]) +
    intelBox_(lines, 'Where the day stands') +
    replyButton_(replyUrl_(sid, day, 'prog'), 'Answer: where each task stands', 'Working on it, later today, or not today with a reason. Takes a minute; no sign-in.') +
    (later.length ? sectionLabel_('The rest of the day · ' + left + ' to close') + cards : '') +
    '<div style="margin-top:6px"><a href="' + PLANNER_URL + '" style="font-size:12.5px;color:' + MAIL.navy + ';font-weight:700">or update your plan in the planner</a></div>' +
    '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">' +
      'Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';

  var mail = {
    to: to,
    subject: 'Progress check · ' + name + ' · ' + shortDate_(day) + ' · ' + (sfOk && day1 ? closed + ' of ' + target + ' closed (' + pct + '%)' : dayPct + '% of the day') +
             (unreported.length ? ', not reported' : ''),
    htmlBody: shell_('Progress check', name + ' · ' + prettyDate_(day) + ' · ' + twelve_(hhmm_(now)), body)
  };
  var cc = dayStartCc_(to);
  if (cc.length) mail.cc = cc.join(',');
  MailApp.sendEmail(mail);
  return true;
}

// ---------------------------------------------------------------------------
//  Answering from the e-mail
//
//  "Should the responses not be captured in the email instead of they logging
//  back in? ... make it very interactive and relevant and easy to do for
//  all." (Ricky, 14 October 2026.)
//
//  Each of the three e-mails carries one button. It opens a page for that
//  person and that day, already filled in; Save writes the answer to the
//  sheet. Nobody signs in: the link is signed over the person, the day and
//  the page, so it opens one person's page for one day and nothing else.
//
//    plan  the morning's suggested plan, ticked, block by block. Untick what
//          you will not do (with a reason), tick anything else, add your own
//          lines, confirm lunch. Save writes the plan and sends "Plan
//          received", which checks whether the plan holds up.
//    prog  the progress check: each planned or suggested task still open,
//          Working on it / Later today / Not today with a reason.
//    hk    before you leave: a reason for each planned task still open, and
//          the three close-out checks, Done or Not done with a reason. Can
//          sign the day out.
//
//  Opening a link never writes. Mail scanners (Outlook's Safe Links among
//  them) open every link in a message before the person does; a link that
//  recorded on opening would record for the scanner. Only Save writes.
//  Every answer is copied to the Branch Manager and sales support.
// ---------------------------------------------------------------------------

var PROG = { must: ['Date', 'StaffId', 'Check', 'TaskId'], name: 'Progress Answers',
             head: ['Date', 'StaffId', 'Name', 'Check', 'TaskId', 'Subject', 'Answer', 'Reason', 'At'] };
var REPLY_PAGES = { plan: 'Your plan', prog: 'Where each task stands', hk: 'Before you leave', 'in': 'Sign in',
                    errand: 'Your errands', undo: 'Workload moves', nudge: 'Nudge', bm: 'Respond', um: 'Your unit', umeve: 'Your day as a manager',
                    ag: 'Your day', agc: 'Close off your day', cmd: 'Not getting attention', qp: 'Query Pal deep dive', agff: 'Your fact finds' };

/** Today's sign-in time for a person, or ''. */
function signedInAt_(sid, day) {
  try { var a = attRow_(sheetObjects_(attSheet_()), day || todayISO_(), sid); return a ? timeStr_(a.row.FirstSignIn) : ''; }
  catch (e) { return ''; }
}

/** Sign in from a page: the register's first sign-in, if there is none yet. */
function signInFromPage_(person) {
  var at = signedInAt_(person.staffId);
  if (at) return { at: at, first: false };
  var out = recordAttendance_(person) || {};
  return { at: signedInAt_(person.staffId) || hhmm_(new Date()), first: true };
}
var PLAN_MAIL_MAX = 4;   // "Plan received" e-mails a day: the first plan and up to three fixes

function replySig_(sid, day, f) {
  var raw = Utilities.computeHmacSha256Signature(
    String(sid) + '|' + String(day) + '|' + String(f) + '|reply', closeoutSecret_());
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '').slice(0, 22);
}

function replyUrl_(sid, day, f) {
  return execBase_() + '?rs=' + encodeURIComponent(sid) + '&d=' + encodeURIComponent(day) +
    '&f=' + encodeURIComponent(f) + '&k=' + encodeURIComponent(replySig_(sid, day, f));
}

/** The big button in an e-mail. */
function replyButton_(href, label, sub) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 4px"><tr><td style="background:' + MAIL.gold +
    ';border-radius:9px"><a href="' + esc_(href) + '" style="display:inline-block;padding:13px 22px;color:' + MAIL.deep +
    ';text-decoration:none;font-weight:800;font-size:15px">' + esc_(label) + ' &rarr;</a></td></tr></table>' +
    (sub ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-bottom:4px">' + esc_(sub) + '</div>' : '');
}

// ---- the morning's model, kept for the pages ---------------------------------

function intelModelKey_(sid, day) { return 'intel_model_' + sid + '_' + day; }

/** What the morning e-mail suggested, block by block, with a few more of each
 *  block's waiting work, so the plan page can be built without asking
 *  Salesforce again. Kept small: a Script Property holds 9 KB. */
function saveIntelModel_(sid, day, blocks, suggest, loose, innov) {
  var slim = function (t) {
    return { id: t.id, s: shorten_(t.subject, 95), ty: shorten_(t.ty || '', 30), due: t.due || '', late: !!t.late };
  };
  var model = { b: {}, order: [] }, taken = {};
  blocks.forEach(function (x) {
    var sug = (suggest[x.id] || []).map(function (s) { taken[s.t.id] = 1; var o = slim(s.t); o.br = s.brought || ''; return o; });
    model.b[x.id] = { sug: sug, more: [] };
    model.order.push(x.id);
  });
  blocks.forEach(function (x) {
    x.waiting.filter(function (t) { return !taken[t.id]; }).slice(0, 6)
      .forEach(function (t) { taken[t.id] = 1; model.b[x.id].more.push(slim(t)); });
  });
  model.loose = (loose || []).filter(function (t) { return !taken[t.id]; }).slice(0, 8).map(slim);
  if (innov && model.b[innov.block]) {
    model.inno = innov.block;
    model.b[innov.block] = { sug: innov.open.slice(0, 3).map(function (t) { var o = slim(t); o.br = ''; return o; }), more: [] };
  }
  var json = JSON.stringify(model);
  while (json.length > 8500 && model.loose.length) { model.loose.pop(); json = JSON.stringify(model); }
  model.order.slice().reverse().forEach(function (b) {
    while (json.length > 8500 && model.b[b].more.length) { model.b[b].more.pop(); json = JSON.stringify(model); }
  });
  try { PropertiesService.getScriptProperties().setProperty(intelModelKey_(sid, day), json); } catch (e) {}
}

function intelModel_(sid, day) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(intelModelKey_(sid, day)) || 'null'); }
  catch (e) { return null; }
}

/** Every task the model knows, by Id. */
function modelTasks_(model) {
  var out = {};
  if (!model) return out;
  Object.keys(model.b || {}).forEach(function (b) {
    model.b[b].sug.concat(model.b[b].more).forEach(function (t) { out[t.id] = t; });
  });
  (model.loose || []).forEach(function (t) { out[t.id] = t; });
  return out;
}

// ---- does the plan hold up? -----------------------------------------------

/** The plan as saved, read against the record. { ok, lines, total, target }.
 *  ok is false when a block that has not ended is empty, when the oldest
 *  overdue are mostly left out, or when the plan is well under her own pace. */
function planCheck_(sid, day, book, intel, nowM) {
  var sched = scheduleFor_(sid), plans = {};
  try { plans = planRows_(sid, day); } catch (e) {}
  var target = Number(PropertiesService.getScriptProperties().getProperty(intelTargetKey_(sid, day)) || 0);
  if (nowM == null) nowM = minutesOf_(hhmm_(new Date()));

  var where = {}, total = 0, empty = [], own = 0;
  BLOCK_IDS.forEach(function (b) {
    if (!sched.blocks[b]) return;
    var items = plans[b] ? planItemsOf_(plans[b].Items) : [];
    var sp = blockSpan_(sid, b);
    var sf = items.filter(function (it) { return it.k === 'sf'; });
    own += items.length - sf.length;
    sf.forEach(function (it) { where[it.id] = b; total++; });
    if (!items.length && !(sp && sp.end <= nowM)) empty.push(b);
  });

  var all = [], homeOf = {};
  Object.keys(book || {}).forEach(function (ty) {
    book[ty].forEach(function (t) { t.ty = ty; if (t.late || t.due === day) all.push(t); });
  });
  BLOCK_IDS.forEach(function (b) {
    var sb = sched.blocks[b], ty = sb && blockTypeFor_(sb.kpi);
    if (ty && !homeOf[ty]) homeOf[ty] = b;
  });
  var oldest = all.filter(function (t) { return t.late; }).sort(oldestOrder_).slice(0, 5);
  var covered = oldest.filter(function (t) { return where[t.id]; }).length;
  var dueOut = all.filter(function (t) { return t.due === day && !where[t.id]; });
  var misplaced = all.filter(function (t) { return where[t.id] && homeOf[t.ty] && homeOf[t.ty] !== where[t.id]; });

  var b_ = function (x) { return '<b>' + esc_(x) + '</b>'; }, red = function (x) { return '<b style="color:' + MAIL.red + '">' + esc_(x) + '</b>'; };
  var lines = [], major = false;
  var light = target && total < Math.round(target * 0.7);
  var heavy = intel && intel.pace && total > Math.max(target * 1.5, intel.pace * 2);
  lines.push({ bad: light || heavy,
    html: 'You planned ' + (light ? red(total) : b_(total)) + ' Salesforce task' + (total === 1 ? '' : 's') + (own ? ' and ' + own + ' line' + (own === 1 ? '' : 's') + ' of your own' : '') +
      (target ? ' against today\'s suggested ' + b_(target) : '') + '. ' +
      (light ? 'That is well under your own pace' + (intel && intel.pace ? ' (' + intel.pace + ' a day)' : '') + '. Add from what is waiting.'
       : heavy ? 'That is more than twice what you close in a day. Plan what you will finish, and give the rest a date.'
       : 'That is a day you can do.') });
  if (light) major = true;
  if (oldest.length) {
    var thin = covered < Math.min(3, oldest.length);
    lines.push({ bad: thin,
      html: (thin ? red(covered + ' of your ' + oldest.length + ' oldest overdue') : b_(covered + ' of your ' + oldest.length + ' oldest overdue')) + ' are in the plan' +
        (thin ? '. The oldest go first: ' + oldest.filter(function (t) { return !where[t.id]; }).slice(0, 3).map(function (t) { return esc_(shorten_(t.subject, 60)); }).join('; ') + '.' : '.') });
    if (thin) major = true;
  }
  if (empty.length) {
    major = true;
    lines.push({ bad: true, html: red(empty.map(blockLabel_).join(', ')) + (empty.length > 1 ? ' have' : ' has') + ' nothing planned. The day gets its work, or a line saying what it is for today.' });
  }
  if (dueOut.length) lines.push({ bad: true, html: red(dueOut.length) + ' due today ' + (dueOut.length === 1 ? 'is' : 'are') + ' not in the plan. Each goes in, or gets a new date with a reason.' });
  if (misplaced.length) lines.push({ bad: true,
    html: misplaced.slice(0, 3).map(function (t) { return esc_(shorten_(t.subject, 50)) + ' is ' + esc_(t.ty) + ' work, set for ' + esc_(blockLabel_(homeOf[t.ty])) + ', planned in ' + esc_(blockLabel_(where[t.id])); }).join('; ') +
      '. Fine if there is a reason; otherwise move it.' });
  if (!lines.some(function (l) { return l.bad; })) lines.push({ bad: false, html: 'This plan holds up. Progress before lunch; close the day off before you leave.' });
  return { ok: !major, lines: lines, total: total, target: target };
}

// ---- the pages ----------------------------------------------------------------

function replyPage_(title, sub, inner) {
  var html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc_(title) + '</title>' +
    '<style>' +
      'body{margin:0;background:#F7F5EF}' +
      '.w{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:600px;margin:0 auto;padding:26px 16px 60px;color:#1F2433}' +
      '.br{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0EA5C9}' +
      'h1{font-size:22px;margin:6px 0 4px;color:#141C4A}.sub{color:#6A7180;margin:0 0 16px}' +
      '.card{background:#fff;border:1px solid #E5E1D6;border-radius:12px;padding:14px 14px 10px;margin-bottom:12px}' +
      '.bh{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0EA5C9}' +
      '.bf{font-size:12.5px;color:#6A7180;margin:2px 0 6px}' +
      'label.t{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid #EEE;font-size:14px;cursor:pointer}' +
      'label.t input{width:20px;height:20px;margin:1px 0 0;flex:none;accent-color:#141C4A}' +
      '.tag{font-size:12px;font-weight:700}.late{color:#DC3F3F}.today{color:#D97A06}.br2{color:#141C4A;font-size:11.5px}' +
      /* PHONES FIRST (18 Oct 2026). The old rule was "font:14px/1.4 inherit",
         which is not valid CSS (inherit cannot sit inside the shorthand), so
         every box fell back to the browser's 13px, and an iPhone zooms the
         page in on any box under 16px. 16px, 44px tall, and the page stays put. */
      'textarea,input[type=text],input[type=number],input[type=date],select{box-sizing:border-box;padding:10px 12px;border:1.5px solid #DDE4EC;border-radius:10px;font-family:inherit;font-size:16px;line-height:1.35;background:#fff;color:#1F2433;min-height:44px}' +
      'textarea,input[type=text]{width:100%}select{width:100%;margin-bottom:6px}' +
      '.seg{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.seg label{flex:1;min-width:92px;text-align:center;border:1.5px solid #DDE4EC;border-radius:9px;padding:8px 6px;font-size:13px;font-weight:700;cursor:pointer;background:#fff}' +
      '.seg input{display:none}.seg input:checked+span{color:#fff}.seg label:has(input:checked){background:#141C4A;border-color:#141C4A;color:#fff}' +
      '.task{padding:10px 0;border-top:1px solid #EEE;font-size:14px}' +
      'details summary{cursor:pointer;color:#141C4A;font-weight:700;font-size:13px;padding:8px 0}' +
      'button{width:100%;padding:15px;border:0;border-radius:11px;background:#141C4A;color:#fff;font-family:inherit;font-weight:800;font-size:16px;cursor:pointer;margin-top:8px}' +
      // The one save stays in view: Sasha, 15 Oct, typed a note under KPI 1 and
      // could not see how to save it without scrolling to the foot of the page.
      'form>button[type=submit]:last-of-type{position:sticky;bottom:calc(10px + env(safe-area-inset-bottom));box-shadow:0 6px 18px rgba(13,24,56,.25);z-index:5}' +
      // Shared pieces for the pages read on a phone: filter chips, tiles, bars, folding rows.
      '.chips{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;position:sticky;top:0;z-index:6;background:#F7F5EF;margin:0 -16px 8px;padding:8px 16px 10px}' +
      '.chip{flex:none;width:auto;margin:0;border:1.5px solid #DDE4EC;background:#fff;border-radius:999px;padding:8px 13px;font-size:13.5px;font-weight:700;color:#141C4A;white-space:nowrap;min-height:38px}' +
      '.chip.on{background:#141C4A;border-color:#141C4A;color:#fff}.chip i{font-style:normal;opacity:.7;margin-left:5px}' +
      '.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0 0 12px}@media(min-width:520px){.tiles{grid-template-columns:repeat(4,1fr)}}' +
      '.tile{background:#fff;border:1px solid #E5E1D6;border-radius:12px;padding:11px 12px}.tile .v{font-size:24px;font-weight:800;line-height:1.1;color:#141C4A}' +
      '.tile .l{font-size:12px;color:#6A7180;margin-top:3px;line-height:1.3}.tile.r .v{color:#DC3F3F}.tile.g .v{color:#2C7A57}.tile.a .v{color:#C26A04}' +
      '.bar{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13.5px}.bar .n{width:104px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.bar .t{flex:1;background:#EEEBE3;border-radius:6px;height:10px;overflow:hidden}.bar .t i{display:block;height:100%;background:#141C4A;border-radius:6px}.bar .t i.r{background:#DC3F3F}.bar .t i.g{background:#2C7A57}' +
      '.bar .c{width:74px;flex:none;text-align:right;font-weight:700;font-size:12.5px;color:#6A7180}' +
      '.bar.s{flex-wrap:wrap;row-gap:3px}.bar.s .n{width:100%;white-space:normal;font-size:13px}' +
      'details.it{border-top:1px solid #EEE;scroll-margin-top:72px}details.it>summary{list-style:none;padding:12px 0;cursor:pointer}details.it>summary::-webkit-details-marker{display:none}' +
      '.hd{display:flex;gap:9px;align-items:flex-start}.hd .tt{flex:1;font-size:14.5px;line-height:1.35}.hd .tt small{display:block;color:#6A7180;font-size:12.5px;margin-top:2px}' +
      '.age{flex:none;min-width:34px;text-align:center;font-size:12px;font-weight:800;color:#fff;border-radius:8px;padding:5px 6px;background:#6A7180}.age.r{background:#DC3F3F}.age.a{background:#C26A04}' +
      '.badge{display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:#EEEBE3;color:#141C4A;white-space:nowrap;margin-top:4px}' +
      '.badge.r{background:#FBE5E3;color:#B4322B}.badge.g{background:#E3F1E8;color:#1F6B47}.badge.a{background:#FDF0DC;color:#9A5A05}' +
      '.changed>summary .tt{color:#141C4A}.changed{box-shadow:inset 3px 0 0 #D9A21B;padding-left:8px}' +
      '.quick{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px}.quick button{width:auto;flex:1;min-width:130px;padding:11px 12px;margin:0;font-size:14px;background:#fff;color:#141C4A;border:1.5px solid #141C4A}' +
      '.quick button.go{background:#2C7A57;border-color:#2C7A57;color:#fff}' +
      'a{color:#141C4A;font-weight:700}' +
      '.ok{border-left:4px solid #2C7A57}.bad{border-left:4px solid #DC3F3F}.warn{color:#DC3F3F;font-weight:700;font-size:13px;display:none;margin-top:6px}' +
      '.ln{padding:6px 0;border-top:1px solid #EEE;font-size:14px}.ln:first-child{border-top:0}' +
    '</style>' +
    '<div class="w"><div class="br">Ricky Rampersad Branch</div><h1>' + esc_(title) + '</h1>' +
    (sub ? '<p class="sub">' + sub + '</p>' : '') + inner + '</div>';
  return HtmlService.createHtmlOutput(html)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function replyHidden_(sid, day, f) {
  return ['rs', sid, 'd', day, 'f', f, 'k', replySig_(sid, day, f)].reduce(function (a, v, i, arr) {
    return i % 2 ? a : a + '<input type="hidden" name="' + arr[i] + '" value="' + esc_(arr[i + 1]) + '">';
  }, '');
}

function taskTag_(t, day) {
  return payoffTag_(t) + (t.late ? ' <span class="tag late">overdue since ' + esc_(shortDate_(t.due)) + '</span>'
       : (t.due === day ? ' <span class="tag today">due today</span>' : (t.due ? ' <span class="tag">due ' + esc_(shortDate_(t.due)) + '</span>' : '')));
}

function linesHtml_(lines) {
  return lines.map(function (l) {
    return '<div class="ln"><span style="color:' + (l.bad ? '#DC3F3F' : '#2C7A57') + ';font-weight:800">' + (l.bad ? '&#9679;' : '&#10003;') + '</span> ' + l.html + '</div>';
  }).join('');
}

/** The fact-find link is for the week: good from its Monday to the Sunday after. */
function replyWeekLink_(f, day) { var d = daysBetween_(day, todayISO_()); return f === 'agff' && d != null && d >= 0 && d <= 6; }
/** Who a reply link is for: the register, or the Branch Manager, a Unit Manager or an agent for their own pages. */
function replyPerson_(sid, f) {
  return rosterPerson_(sid) || ((f === 'undo' || f === 'bm' || f === 'cmd' || f === 'qp') && sid === 'ricky' ? { staffId: 'ricky', name: 'Ricky Rampersad' } : null) ||
    ((f === 'um' || f === 'umeve' || f === 'cmd') && (UM_DESKS.indexOf(sid) > -1 || sid === 'ricky') ? { staffId: sid, name: nameFor_(sid) } : null) ||
    ((f === 'ag' || f === 'agc' || f === 'agff') && /^a-/.test(sid) ? agentBySid_(sid) : null);
}

/** GET: show a page. Never writes. */
function replyClick_(e) {
  var p = (e && e.parameter) || {};
  var sid = String(p.rs || '').trim();
  if (!sid) return null;
  var day = isoDay_(p.d) || todayISO_(), f = String(p.f || '');
  if (!REPLY_PAGES[f] || String(p.k || '') !== replySig_(sid, day, f)) {
    return replyPage_('That link has expired.', 'These links are good for the day they were sent. Open the tracker instead.', '');
  }
  if (day !== todayISO_() && !replyWeekLink_(f, day)) return replyPage_('That link was for ' + prettyDate_(day) + '.', 'Today\'s e-mail has today\'s link.', '');
  var person = replyPerson_(sid, f);
  if (!person) return replyPage_('That link has expired.', 'The desk is no longer on the register.', '');
  if (f === 'plan' || f === 'in') return planReplyPage_(person, day, '');
  if (f === 'prog') return progReplyPage_(person, day, '');
  if (f === 'errand') return errandReplyPage_(person, day, String(p.c || 'progress'), '');
  if (f === 'undo') return undoReplyPage_(person, day, '');
  if (f === 'bm') return bmReplyPage_(person, day, '');
  if (f === 'cmd') return cmdReplyPage_(person, day, '', '');
  if (f === 'qp') return qpDivePage_(person, day);
  if (f === 'agff') return ffReplyPage_(person, day, '');
  if (f === 'um') return umReplyPage_(person, day, '');
  if (f === 'umeve') return umEveReplyPage_(person, day, '');
  if (f === 'ag' || f === 'agc') return agReplyPage_(person, day, f, '');
  if (f === 'nudge') return nudgeReplyPage_(person, day, '');
  return hkReplyPage_(person, day, '');
}

/** POST: write, then show what was written. */
function replyPost_(e) {
  var p = (e && e.parameter) || {}, ps = (e && e.parameters) || {};
  var sid = String(p.rs || '').trim();
  if (!sid) return null;
  var day = isoDay_(p.d) || todayISO_(), f = String(p.f || '');
  if (!REPLY_PAGES[f] || String(p.k || '') !== replySig_(sid, day, f) || (day !== todayISO_() && !replyWeekLink_(f, day))) {
    return replyPage_('That link has expired.', 'Nothing was saved. Open the tracker instead.', '');
  }
  var person = replyPerson_(sid, f);
  if (!person) return replyPage_('That link has expired.', 'The desk is no longer on the register.', '');
  var all = function (name) { var v = ps[name]; return v ? (Array.isArray(v) ? v : [v]) : []; };
  if (f === 'in') {
    var si = signInFromPage_(person);
    return planReplyPage_(person, day, '', (si.first ? 'Signed in at ' : 'You were already signed in at ') + twelve_(si.at) + '. Now plan your day.');
  }
  if (f === 'plan') return planReplySave_(person, day, p, all);
  if (f === 'prog') return progReplySave_(person, day, p, all);
  if (f === 'errand') return errandReplySave_(person, day, p, all);
  if (f === 'undo') return undoReplySave_(person, day, p, all);
  if (f === 'bm') return bmReplySave_(person, day, p, all);
  if (f === 'cmd') return cmdReplySave_(person, day, p);
  if (f === 'qp') return qpDivePage_(person, day);
  if (f === 'agff') return ffReplySave_(person, day, p);
  if (f === 'um') return umReplySave_(person, day, p);
  if (f === 'umeve') return umEveReplySave_(person, day, p);
  if (f === 'ag' || f === 'agc') return agReplySave_(person, day, f, p);
  if (f === 'nudge') return nudgeReplySave_(person, day, p, all);
  return hkReplySave_(person, day, p, all);
}

// ---- plan -------------------------------------------------------------------

function planReplyPage_(person, day, error, notice) {
  var sid = String(person.staffId), sched = scheduleFor_(sid), model = intelModel_(sid, day);
  var signed = signedInAt_(sid, day);
  var plans = {};
  try { plans = planRows_(sid, day); } catch (e) {}
  if (!model) {
    return replyPage_('Your plan', 'This morning\'s suggestion is not on file, so there is nothing to fill in here.',
      '<p><a href="' + PLANNER_URL + '">Open the planner</a> and pick your tasks there.</p>');
  }
  var nowM = minutesOf_(hhmm_(new Date())), sugIds = [];
  var cards = BLOCK_IDS.filter(function (b) { return sched.blocks[b]; }).map(function (b) {
    var sb = sched.blocks[b], m = model.b[b] || { sug: [], more: [] }, sp = blockSpan_(sid, b);
    var row = plans[b], have = row ? planItemsOf_(row.Items) : [];
    var haveIds = {}; have.forEach(function (it) { if (it.k === 'sf') haveIds[it.id] = 1; });
    var isInno = model.inno === b;
    var head = '<div class="bh">' + esc_(blockLabel_(b)) + (sb.time ? ' · ' + esc_(sb.time) : '') + (isInno ? ' · Innovation hour · protected' : '') + '</div>' +
      '<div class="bf">' + (isInno ? 'Move your innovation forward. No ordinary tasks here today; bring what moved to Friday\'s branch meeting.' : esc_(sb.focus || '')) + '</div>';
    if (row && String(row.ClosedAt || '').trim()) return '<div class="card">' + head + '<div class="bf">Your day has closed.</div></div>';
    if (sp && sp.end <= nowM) return '<div class="card">' + head + '<div class="bf">Your day has ended.</div></div>';
    var box = function (t, checked, suggested) {
      if (suggested) sugIds.push(t.id);
      return '<label class="t"><input type="checkbox" name="t_' + b + '" value="' + esc_(t.id) + '"' + (checked ? ' checked' : '') +
        (suggested ? ' data-sug="1"' : '') + '><span>' + esc_(t.s) + taskTag_(t, day) +
        (t.br ? ' <span class="br2">· brought in from ' + esc_(t.br) + '</span>' : '') + '</span></label>';
    };
    var shown = {};
    var rows = m.sug.map(function (t) { shown[t.id] = 1; return box(t, true, true); }).join('');
    // Already planned in the tracker, not in the suggestion: keep them ticked.
    have.forEach(function (it) {
      if (it.k === 'sf' && !shown[it.id]) { shown[it.id] = 1; rows += box({ id: it.id, s: it.subject || it.id, due: '' }, true, false); }
    });
    var more = m.more.filter(function (t) { return !shown[t.id]; });
    var ownLines = have.filter(function (it) { return it.k === 'own'; }).map(function (it) { return it.label; }).join('\n');
    return '<div class="card">' + head + (rows || '<div class="bf">Nothing suggested for today.</div>') +
      (more.length ? '<details><summary>' + more.length + ' more waiting</summary>' + more.map(function (t) { return box(t, !!haveIds[t.id], false); }).join('') + '</details>' : '') +
      '<div style="margin-top:8px"><textarea name="own_' + b + '" rows="2" placeholder="' + (isInno ? 'What will you move in your innovation hour?' : 'Anything else you will do today, one per line') + '">' + esc_(ownLines) + '</textarea></div></div>';
  }).join('');
  var loose = (model.loose || []).length
    ? '<div class="card"><div class="bh">Not in today\'s plan</div><div class="bf">Tick one to add it to today.</div>' +
      model.loose.map(function (t) { return '<label class="t"><input type="checkbox" name="t_any" value="' + esc_(t.id) + '"><span>' + esc_(t.s) + taskTag_(t, day) + '</span></label>'; }).join('') + '</div>'
    : '';
  var openBlocks = BLOCK_IDS.filter(function (b) {
    var sp = blockSpan_(sid, b), row = plans[b];
    return sched.blocks[b] && !(row && String(row.ClosedAt || '').trim()) && !(sp && sp.end <= nowM);
  });
  var inner =
    (notice ? '<div class="card ok"><b style="color:#2C7A57">' + esc_(notice) + '</b></div>' : '') +
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    (signed ? '' : '<form method="post" action="' + esc_(execBase_()) + '" target="_top" class="card">' + replyHidden_(sid, day, 'in') +
      '<div class="bh">Not signed in yet</div><div class="bf">Saving your plan signs you in at the time you save. At your desk now? Sign in first.</div>' +
      '<button type="submit" style="background:#2C7A57;margin-top:4px">I am at my desk</button></form>') +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top" onsubmit="return chk()">' + replyHidden_(sid, day, 'plan') +
    '<div class="card"><div class="bh">The scrub · inbox and WhatsApp</div>' +
      '<div class="bf">Anything that needs doing, one per line. Each becomes a Salesforce task in your name, due today, in today\'s plan.</div>' +
      '<textarea name="scrub" rows="3" placeholder="e.g. Agent Persad asked for the Mohammed medical requirements"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px"><select name="scrub_type" style="flex:1;padding:9px;border:1.5px solid #DDE4EC;border-radius:9px;font:14px inherit">' +
        sfTypeList_().map(function (t) { return '<option value="' + esc_(t) + '"' + (t === 'Servicing' ? ' selected' : '') + '>' + esc_(SF_TYPES[t]) + '</option>'; }).join('') + '</select>' +
      '<select name="scrub_block" style="flex:1;padding:9px;border:1.5px solid #DDE4EC;border-radius:9px;font:14px inherit">' +
        openBlocks.map(function (b) { return '<option value="' + b + '">' + esc_(blockLabel_(b)) + '</option>'; }).join('') + '</select></div></div>' +
    cards + loose +
    '<div class="card"><div class="bh">Lunch today</div><input type="text" name="lunch" value="' + esc_(sched.lunch || '') + '"></div>' +
    '<div class="card"><div class="bh">Left a suggested task out?</div><div class="bf">Say why, in one line. It goes with the plan.</div>' +
      '<textarea name="why" id="why" rows="2" placeholder="e.g. waiting on the agent for the form; given a new date"></textarea>' +
      '<div class="warn" id="warn">You left out suggested tasks. Say why before you save.</div></div>' +
    '<div class="card"><div class="bh">Comment for Mr Rampersad</div><textarea name="comment" rows="2" placeholder="Anything he should know about today"></textarea></div>' +
    '<button type="submit">Save my plan</button></form>' +
    '<script>function chk(){var off=[].slice.call(document.querySelectorAll("input[data-sug]")).filter(function(i){return !i.checked}).length;' +
      'if(off&&!document.getElementById("why").value.trim()){document.getElementById("warn").style.display="block";document.getElementById("why").focus();return false}return true}</script>';
  return replyPage_('Your plan · ' + prettyDate_(day),
    esc_(String(person.name || sid).split(' ')[0]) + ', this morning\'s suggestion is ticked below, high-payoff work first. Untick what you will not do today, tick anything else, add your own lines, then press Save once: the button at the bottom saves every block and every note on this page. Report each block when it ends.',
    inner);
}

function planReplySave_(person, day, p, all) {
  var sid = String(person.staffId), sched = scheduleFor_(sid), model = intelModel_(sid, day);
  var known = modelTasks_(model), plans = planRows_(sid, day);
  var nowM = minutesOf_(hhmm_(new Date()));
  var open = BLOCK_IDS.filter(function (b) {
    var sp = blockSpan_(sid, b), row = plans[b];
    return sched.blocks[b] && !(row && String(row.ClosedAt || '').trim()) && !(sp && sp.end <= nowM);
  });
  var chosen = {}, seen = {};
  open.forEach(function (b) {
    chosen[b] = all('t_' + b).filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; });
  });
  // Ticked from "not in any block": into the open block with the fewest.
  all('t_any').forEach(function (id) {
    if (seen[id] || !open.length) return;
    seen[id] = 1;
    var b = open.slice().sort(function (a, c) { return chosen[a].length - chosen[c].length; })[0];
    chosen[b].push(id);
  });
  var sugIds = [];
  if (model) Object.keys(model.b).forEach(function (b) { if (open.indexOf(b) > -1) model.b[b].sug.forEach(function (t) { sugIds.push(t.id); }); });
  var dropped = sugIds.filter(function (id) { return !seen[id]; });
  var why = String(p.why || '').trim().slice(0, REASON_MAX);
  if (dropped.length && !why) return planReplyPage_(person, day, 'You left out ' + dropped.length + ' suggested task' + (dropped.length === 1 ? '' : 's') + '. Say why, then save.');

  var lock = takeLock_();
  if (!lock) return planReplyPage_(person, day, 'Another save was going in just then. Press Save again.');
  try {
    markStaffWrite_();
    open.forEach(function (b) {
      var have = plans[b] ? planItemsOf_(plans[b].Items) : [];
      var haveSf = {}; have.forEach(function (it) { if (it.k === 'sf') haveSf[it.id] = it; });
      var items = chosen[b].map(function (id) {
        var t = known[id], h = haveSf[id];
        return { k: 'sf', id: id, subject: t ? t.s : (h ? h.subject : id), type: t ? t.ty : (h ? h.type : '') };
      });
      String(p['own_' + b] || '').split(/\r?\n/).forEach(function (l) { if (l.trim()) items.push({ k: 'own', label: l.trim() }); });
      var clean = cleanPlanItems_(items);
      if (clean.error) clean = cleanPlanItems_(items.slice(0, PLAN_MAX_ITEMS));
      var patch = { Items: clean.list };
      if (b === open[0]) {
        var lunch = String(p.lunch || '').trim(), notes = [];
        if (lunch && lunch !== String(sched.lunch || '')) notes.push('Lunch today: ' + lunch);
        if (dropped.length) notes.push('Left out ' + dropped.length + ' suggested: ' + why);
        patch.Note = notes.join(' · ').slice(0, REASON_MAX);   // a fresh save replaces the last one's note
      }
      planWrite_(person, day, b, patch);
    });
  } finally { lock.releaseLock(); }

  // Saving the plan is the start of the day: sign in if not already.
  var si = null;
  try { si = signInFromPage_(person); } catch (e) {}
  // The scrub: each line a Salesforce task in her name, due today, on the plan.
  var made = [], failed = [];
  var scrubType = SF_TYPES[String(p.scrub_type || '')] ? String(p.scrub_type) : 'Servicing';
  var scrubBlock = open.indexOf(String(p.scrub_block || '')) > -1 ? String(p.scrub_block) : open[0];
  String(p.scrub || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); })
    .filter(function (l) { return l.length >= 4; }).slice(0, 10).forEach(function (l) {
      try {
        var ct = createTask_({ staffId: sid, subject: l, type: scrubType, due: day, date: day, block: scrubBlock }, { staffId: sid, name: person.name });
        if (ct && ct.ok) made.push(l); else failed.push(l + (ct && ct.error ? ' (' + ct.error + ')' : ''));
      } catch (e) { failed.push(l); }
    });
  var comment = String(p.comment || '').trim().slice(0, REASON_MAX);
  if (comment) {
    try { progWrite_(person, day, 'comment', [{ id: '_plan', s: 'Comment with the plan', a: 'note', r: comment }]); } catch (e) {}
    try { replyCopy_(person, day, 'Plan comment', [{ id: '_plan', s: 'With the plan', a: 'note', r: comment }], { note: 'Comment' }); } catch (e) {}
  }
  try { sendDayStart_(sid, day, 'plan', { force: true }); } catch (e) {}
  var book = {}, intel = null;
  try { book = (sfkOpenBook_(day) || {})[sid] || {}; } catch (e) {}
  try { intel = intelFor_(sid, day); } catch (e) {}
  var chk = planCheck_(sid, day, book, intel, nowM);
  return replyPage_(chk.ok ? 'Plan saved. It holds up.' : 'Plan saved, but it does not hold up yet.',
    'A "Plan received" e-mail is on its way to you, copied to Mr Rampersad and sales support.' +
      (si ? ' ' + (si.first ? 'Signed in at ' : 'Signed in since ') + esc_(twelve_(si.at)) + '.' : ''),
    (made.length || failed.length ? '<div class="card ' + (failed.length ? 'bad' : 'ok') + '"><div class="bh">From your scrub</div>' +
      made.map(function (l) { return '<div class="ln">&#10003; Task created: ' + esc_(l) + '</div>'; }).join('') +
      failed.map(function (l) { return '<div class="ln" style="color:#DC3F3F">Not created: ' + esc_(l) + '. Add it in Salesforce.</div>'; }).join('') + '</div>' : '') +
    '<div class="card ' + (chk.ok ? 'ok' : 'bad') + '">' + linesHtml_(chk.lines) + '</div>' +
    (chk.ok ? '' : '<a href="' + esc_(replyUrl_(sid, day, 'plan')) + '" style="display:block;text-align:center;padding:14px;border-radius:11px;background:#0EA5C9;color:#0B1230;font-weight:800;text-decoration:none">Fix my plan</a>'));
}

// ---- progress -----------------------------------------------------------------

/** Planned and suggested Salesforce tasks for the day, with whether each is
 *  closed yet. */
function dayTasks_(sid, day) {
  var model = intelModel_(sid, day), known = modelTasks_(model), list = [], seen = {};
  var plans = {};
  try { plans = planRows_(sid, day); } catch (e) {}
  BLOCK_IDS.forEach(function (b) {
    (plans[b] ? planItemsOf_(plans[b].Items) : []).forEach(function (it) {
      if (it.k !== 'sf' || seen[it.id]) return;
      seen[it.id] = 1;
      var t = known[it.id] || {};
      list.push({ id: it.id, s: it.subject || t.s || it.id, due: t.due || '', late: !!t.late, b: b, planned: true });
    });
  });
  if (model) Object.keys(model.b).forEach(function (b) {
    model.b[b].sug.forEach(function (t) {
      if (seen[t.id]) return; seen[t.id] = 1;
      list.push({ id: t.id, s: t.s, due: t.due, late: t.late, b: b, planned: false });
    });
  });
  var states = {};
  if (sfkConfigured_() && list.length) { try { states = sfkTaskStates_(list.map(function (t) { return t.id; })); } catch (e) {} }
  list.forEach(function (t) { t.closed = /^(completed|closed)/i.test(states[t.id] || ''); });
  return list;
}

function progAnswers_(sid, day, check) {
  var m = {};
  (hrRows_(PROG, true) || []).forEach(function (r) {
    if (isoDay_(r.Date) === day && String(r.StaffId) === String(sid) && String(r.Check) === check) {
      m[String(r.TaskId)] = { a: String(r.Answer || ''), r: String(r.Reason || '') };
    }
  });
  return m;
}

function progWrite_(person, day, check, rows) {
  var sh = hrTab_(PROG, true), have = sheetObjects_(sh), at = hhmm_(new Date()), idx = colMap_(sh);
  rows.forEach(function (x) {
    var row = 0;
    have.forEach(function (r, i) {
      if (isoDay_(r.Date) === day && String(r.StaffId) === String(person.staffId) && String(r.Check) === check && String(r.TaskId) === x.id) row = i + 2;
    });
    var o = { Date: day, StaffId: person.staffId, Name: person.name || person.staffId, Check: check, TaskId: x.id,
              Subject: x.s, Answer: x.a, Reason: x.r || '', At: at };
    if (row) writeRow_(sh, row, idx, o);
    else sh.appendRow(PROG.head.map(function (h) { return o[h] != null ? o[h] : ''; }));
  });
  forgetHr_(PROG);
}

var PROG_CHOICES = [['now', 'Working on it'], ['later', 'Later today'], ['not', 'Not today']];

function progReplyPage_(person, day, error) {
  var sid = String(person.staffId), tasks = dayTasks_(sid, day), had = progAnswers_(sid, day, 'progress');
  var done = tasks.filter(function (t) { return t.closed; }), open = tasks.filter(function (t) { return !t.closed; });
  if (!tasks.length) {
    return replyPage_('Where each task stands', 'There is no plan or suggestion on file for today.',
      '<p><a href="' + PLANNER_URL + '">Open the planner</a> and plan the rest of the day.</p>');
  }
  var rows = open.map(function (t) {
    var h = had[t.id] || {};
    return '<div class="task"><div>' + esc_(t.s) + taskTag_(t, day) + ' <span class="br2">· ' + esc_(blockLabel_(t.b)) + (t.planned ? '' : ', suggested') + '</span></div>' +
      '<div class="seg">' + PROG_CHOICES.map(function (c) {
        return '<label><input type="radio" name="a_' + esc_(t.id) + '" value="' + c[0] + '"' + (h.a === c[0] ? ' checked' : '') + ' onchange="sh(this)"><span>' + c[1] + '</span></label>';
      }).join('') + '</div>' +
      '<input type="text" name="r_' + esc_(t.id) + '" value="' + esc_(h.r || '') + '" placeholder="Why not today, and when it will be done" style="display:' + (h.a === 'not' ? 'block' : 'none') + '"></div>';
  }).join('');
  var inner = (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    '<div class="card ok"><div class="bh">Closed in Salesforce</div>' +
      (done.length ? done.map(function (t) { return '<div class="ln">&#10003; ' + esc_(t.s) + '</div>'; }).join('') : '<div class="ln" style="color:#6A7180">None of today\'s tasks yet.</div>') + '</div>' +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(sid, day, 'prog') +
    '<div class="card"><div class="bh">Still open · ' + open.length + '</div>' + (rows || '<div class="ln">Nothing left open. Well done.</div>') + '</div>' +
    '<div class="card"><div class="bh">Anything stopping you? A comment for Mr Rampersad</div><textarea name="blocker" rows="2" placeholder="Something Mr Rampersad should know or can unblock">' + esc_((had._blocker || {}).r || '') + '</textarea></div>' +
    '<button type="submit">Send my progress</button></form>' +
    '<script>function sh(i){var r=document.getElementsByName("r_"+i.name.slice(2))[0];if(r){r.style.display=i.value==="not"?"block":"none";r.required=i.value==="not"}}</script>';
  return replyPage_('Where each task stands',
    'Mark each open task. A task you close in Salesforce shows here as done on its own; answering here does not close it.', inner);
}

function progReplySave_(person, day, p, all) {
  var sid = String(person.staffId), tasks = dayTasks_(sid, day), rows = [], missing = 0;
  var label = { note: 'Comment' }; PROG_CHOICES.forEach(function (c) { label[c[0]] = c[1]; }); label.done = 'Closed';
  tasks.forEach(function (t) {
    if (t.closed) { rows.push({ id: t.id, s: t.s, a: 'done', r: 'closed in Salesforce' }); return; }
    var a = String(p['a_' + t.id] || ''), r = String(p['r_' + t.id] || '').trim().slice(0, REASON_MAX);
    if (!label[a]) return;
    if (a === 'not' && !r) { missing++; return; }
    rows.push({ id: t.id, s: t.s, a: a, r: r });
  });
  if (missing) return progReplyPage_(person, day, missing + ' marked "Not today" with no reason. Say why for each.');
  var blocker = String(p.blocker || '').trim().slice(0, REASON_MAX);
  if (blocker) rows.push({ id: '_blocker', s: 'Anything stopping you', a: 'note', r: blocker });
  var lock = takeLock_();
  if (!lock) return progReplyPage_(person, day, 'Another save was going in just then. Press Send again.');
  try { markStaffWrite_(); progWrite_(person, day, 'progress', rows); } finally { lock.releaseLock(); }
  try { replyCopy_(person, day, 'Progress', rows, label); } catch (e) {}
  var n = function (a) { return rows.filter(function (x) { return x.a === a; }).length; };
  return replyPage_('Thank you. Your progress is in.',
    'Copied to Mr Rampersad and sales support.',
    '<div class="card ok">' +
      '<div class="ln">Closed: <b>' + n('done') + '</b></div><div class="ln">Working on it: <b>' + n('now') + '</b></div>' +
      '<div class="ln">Later today: <b>' + n('later') + '</b></div><div class="ln">Not today: <b>' + n('not') + '</b></div></div>' +
    '<p class="sub">Close each one in Salesforce with your note as you finish it.</p>');
}

/** The answers, to the Branch Manager and sales support. */
function replyCopy_(person, day, what, rows, label) {
  var cc = dayStartCc_('', person.staffId);
  if (!cc.length) return;
  var body = rows.map(function (x) {
    var bad = x.a === 'not' || x.a === 'Not done';
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (bad ? MAIL.red : (x.a === 'done' || x.a === 'Done' ? MAIL.green : MAIL.amber)) +
      ';border-radius:9px;padding:9px 13px;margin-bottom:7px"><div style="font-size:13px"><b>' + esc_(label[x.a] || x.a) + '</b> · ' + esc_(x.s) + '</div>' +
      (x.r ? '<div style="font-size:12.5px;color:' + MAIL.muted + ';margin-top:2px">' + esc_(x.r) + '</div>' : '') + '</div>';
  }).join('');
  var notToday = rows.filter(function (x) { return x.a === 'not' || x.a === 'Not done'; }).length;
  var word = what === 'Progress' ? 'not today' : 'not done';
  MailApp.sendEmail({
    to: cc.join(','),
    subject: what + ' answered · ' + (person.name || person.staffId) + ' · ' + shortDate_(day) + ' · ' + hhmm_(new Date()) +
      (notToday ? ' · ' + notToday + ' ' + word : ''),
    htmlBody: shell_(what + ' answered', (person.name || person.staffId) + ' · ' + prettyDate_(day), body || '<div>No answers given.</div>')
  });
}

// ---- before you leave ---------------------------------------------------------

/** The day's tasks for the close-out: what was planned, or, with no plan,
 *  what was suggested. */
function hkTasks_(sid, day) {
  var all = dayTasks_(sid, day), planned = all.filter(function (t) { return t.planned; });
  return planned.length ? planned : all;
}

function hkReplyPage_(person, day, error) {
  var sid = String(person.staffId), tasks = hkTasks_(sid, day);
  var had = progAnswers_(sid, day, 'leave'), state = closeoutFor_(person, day);
  var open = tasks.filter(function (t) { return !t.closed; }), done = tasks.filter(function (t) { return t.closed; });
  var pct = tasks.length ? Math.round(100 * done.length / tasks.length) : null;
  var hk = state.items.filter(function (r) { return /^hk_/.test(r.id); });
  var taskRows = open.map(function (t) {
    return '<div class="task"><div>' + esc_(t.s) + taskTag_(t, day) + '</div>' +
      '<input type="text" name="r_' + esc_(t.id) + '" required value="' + esc_((had[t.id] || {}).r || '') + '" placeholder="Not done because..., and when it will be"></div>';
  }).join('');
  var checks = hk.map(function (r) {
    var isDone = r.done, isNot = !r.done && r.reason;
    return '<div class="task"><div><b>' + esc_(r.item) + '</b></div><div class="seg">' +
      '<label><input type="radio" name="c_' + r.id + '" value="Done"' + (isDone ? ' checked' : '') + ' onchange="sc(this)" required><span>Done</span></label>' +
      '<label><input type="radio" name="c_' + r.id + '" value="Not done"' + (isNot ? ' checked' : '') + ' onchange="sc(this)"><span>Not done</span></label></div>' +
      '<input type="text" name="cr_' + r.id + '" value="' + esc_(r.reason || '') + '" placeholder="What is left, and why" style="display:' + (isNot ? 'block' : 'none') + '"></div>';
  }).join('');
  var inner = (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    '<div class="card ' + (pct === 100 ? 'ok' : 'bad') + '"><div class="bh">Today\'s tasks</div>' +
      '<div class="ln">' + (pct == null ? 'No plan today.' : '<b>' + done.length + ' of ' + tasks.length + '</b> ' + (tasks.some(function (t) { return t.planned; }) ? 'planned' : 'suggested') + ' tasks closed (<b>' + pct + '%</b>).') + '</div>' +
      done.map(function (t) { return '<div class="ln">&#10003; ' + esc_(t.s) + '</div>'; }).join('') + '</div>' +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(sid, day, 'hk') +
    (open.length ? '<div class="card"><div class="bh">Not done · a reason for each</div>' + taskRows + '</div>' : '') +
    '<div class="card"><div class="bh">The three checks</div>' + checks + '</div>' +
    mailbagPageCard_(sid, day) +
    (innovationBlock_(sid, day) ? '<div class="card" style="border-left:4px solid #0EA5C9"><div class="bh">Innovation hour · what moved?</div>' +
      '<div class="bf">One or two lines. It goes on Friday\'s innovation board for the branch meeting. Put the same on the task\'s Chatter.</div>' +
      '<textarea name="inno" rows="2" required placeholder="What you built, tested or found, and the next step">' + esc_(((progAnswers_(sid, day, 'innovation') || {})._inno || {}).r || '') + '</textarea></div>' : '') +
    '<div class="card"><div class="bh">Comment for Mr Rampersad</div><textarea name="comment" rows="2" placeholder="Anything he should know before tomorrow"></textarea></div>' +
    '<div class="card"><label class="t" style="border:0"><input type="checkbox" name="out" value="1"><span>Sign me out now</span></label></div>' +
    '<button type="submit">Close my day</button></form>' +
    '<script>function sc(i){var r=document.getElementsByName("cr_"+i.name.slice(2))[0];if(r){r.style.display=i.value==="Not done"?"block":"none";r.required=i.value==="Not done"}}</script>';
  return replyPage_('Before you leave · ' + prettyDate_(day),
    'Answer here; it goes straight into the close-out. Nothing to open in the tracker.', inner);
}

function hkReplySave_(person, day, p, all) {
  var sid = String(person.staffId), tasks = hkTasks_(sid, day).filter(function (t) { return !t.closed; });
  var state = closeoutFor_(person, day), hk = state.items.filter(function (r) { return /^hk_/.test(r.id); });
  var rows = [], missing = 0, checks = [];
  tasks.forEach(function (t) {
    var r = String(p['r_' + t.id] || '').trim().slice(0, REASON_MAX);
    if (!r) { missing++; return; }
    rows.push({ id: t.id, s: t.s, a: 'Not done', r: r });
  });
  hk.forEach(function (it) {
    var v = String(p['c_' + it.id] || ''), r = String(p['cr_' + it.id] || '').trim().slice(0, REASON_MAX);
    if (v !== 'Done' && v !== 'Not done') { missing++; return; }
    if (v === 'Not done' && !r) { missing++; return; }
    checks.push({ id: it.id, s: it.item, a: v, r: r });
  });
  if (missing) return hkReplyPage_(person, day, missing + ' answer' + (missing === 1 ? ' is' : 's are') + ' missing. Every planned task not done needs a reason, and every check an answer.');
  var lock = takeLock_();
  if (!lock) return hkReplyPage_(person, day, 'Another save was going in just then. Press Close my day again.');
  var hkComment = String(p.comment || '').trim().slice(0, REASON_MAX);
  if (hkComment) rows.push({ id: '_comment', s: 'Comment', a: 'note', r: hkComment });
  var mbA = String(p.mb || '').trim(), mbR = String(p.mbr || '').trim(), mbN = String(p.mbn || '').trim().slice(0, REASON_MAX), mbCard = null;
  try { mbCard = mailbagCard_(sid, day); } catch (e) {}
  if (mbCard) {
    if (!mbA) return hkReplyPage_(person, day, 'Answer the mailbag question.');
    if (/Not/.test(mbA) && !mbR) return hkReplyPage_(person, day, 'Pick the reason the mailbag ' + (mbCard.isRouter ? 'was not sent' : 'was not handed over') + '.');
    rows.push({ id: '_mailbag', s: mbCard.isRouter ? 'Mailbag routed' : 'Mailbag handed over', a: mbA, r: (mbR ? mbR + (mbN ? ': ' + mbN : '') : mbN) });
    mailbagLog_({ Date: day, Router: nameFor_(mbCard.router), By: nameFor_(sid), CollectedToday: mbCard.isRouter ? mbCard.data.todayN : mbCard.mine, Backlog: mbCard.data.backlogN,
      Sent: mbA, Reason: mbR, Note: mbN, At: hhmm_(new Date()), Source: 'email' });
  }
  var innoSaid = String(p.inno || '').trim().slice(0, REASON_MAX);
  if (innovationBlock_(sid, day)) {
    if (!innoSaid) return hkReplyPage_(person, day, 'Say what your innovation hour moved. One line is enough.');
    rows.push({ id: '_inno', s: 'Innovation hour', a: 'note', r: innoSaid });
  }
  try {
    markStaffWrite_();
    progWrite_(person, day, 'leave', rows.filter(function (x) { return x.id !== '_inno'; }));
    if (innoSaid) progWrite_(person, day, 'innovation', [{ id: '_inno', s: 'Innovation hour', a: 'note', r: innoSaid }]);
    checks.forEach(function (c) { closeoutWrite_(person, day, c.id, c.a, c.r, 'email'); });
  } finally { lock.releaseLock(); }
  var out = '';
  if (p.out) { try { var so = signOutDay_({}, person); if (so && so.ok) out = so.out; } catch (e) {} }
  try { replyCopy_(person, day, 'Close-out', checks.concat(rows), { Done: 'Done', 'Not done': 'Not done', note: 'Comment', Sent: 'Mailbag sent', 'Not sent': 'Mailbag NOT sent', 'Handed over': 'Mailbag handed over', 'Not handed over': 'Mailbag NOT handed over' }); } catch (e) {}
  return replyPage_('Your day is closed. Thank you.',
    'Copied to Mr Rampersad and sales support.' + (out ? ' Signed out at ' + esc_(twelve_(out)) + '.' : ''),
    '<div class="card ok">' + checks.map(function (c) { return '<div class="ln">' + (c.a === 'Done' ? '&#10003;' : '&#9679;') + ' ' + esc_(c.s) + (c.r ? ' · ' + esc_(c.r) : '') + '</div>'; }).join('') +
    (rows.length ? '<div class="ln"><b>' + rows.length + '</b> planned task' + (rows.length === 1 ? '' : 's') + ' carried, each with your reason.</div>' : '') + '</div>');
}

// ---------------------------------------------------------------------------
//  The workload balance, half past eight
//
//  "Reassign if possible to balance things." Ricky chose on 14 October 2026:
//  move automatically, tell him after. So at 8:30, once the morning's people
//  are in, the tracker reads every support desk's due and overdue work against
//  that person's own pace, and moves tasks from whoever is furthest behind to
//  whoever has room, within these limits:
//
//    · only between the support desks (Sasha, Azariah, Liz), and from the BMA
//      only her service work, never HR, licensing, operations or training;
//      the BMA receives nothing, and Pawan and the Branch Manager are never in it
//    · only to somebody signed in today and not marked absent
//    · only work the receiver's job covers (orphan adoption only to the desks
//      that run it)
//    · never a task in the giver's plan or this morning's suggestion, and never
//      one she has touched in the last three days, unless she is absent
//    · only while the giver has 1.5 times the receiver's days of work, and at
//      least two days of it, and only to somebody who will still have no more
//      than three days of work after it
//    · six received and eight given per person, fifteen moved in all, a day
//
//  High-payoff work moves first, because it is what most needs a free pair of
//  hands. Every move: the owner is changed in Salesforce, a Chatter note on
//  the task says from whom, to whom and why, a row goes on the Workload
//  Moves tab, and both people are e-mailed. The Branch Manager and sales
//  support get the list with an Undo button. Script Property REBALANCE=off
//  stops it.
// ---------------------------------------------------------------------------

var REBALANCE = {
  POOL: ['sasha', 'azariah', 'elizabeth', 'kamla'],
  TAKES: { sasha: ['new', 'orphan', 'retention', 'other'],
           azariah: ['new', 'orphan', 'retention', 'other'],
           elizabeth: ['new', 'retention', 'other'] },
  KAMLA_GIVES: ['Servicing', 'Renewa/PDl/Bill', 'Pendings', 'Claims/ Mat', 'Untyped'],
  IDLE_DAYS: 3, PER_RECEIVER: 6, PER_GIVER: 8, PER_DAY: 15, RATIO: 1.5, MIN_DAYS: 2, MIN_PACE: 3,
  MAX_RECV_DAYS: 3      // a receiver ends the move with no more than three days of work
};
var MOVES = { must: ['Date', 'TaskId', 'From', 'To'], name: 'Workload Moves',
              head: ['Date', 'At', 'TaskId', 'Subject', 'Type', 'From', 'To', 'Why', 'Result', 'UndoneAt'] };

function rebalanceTick_(day, present, absent) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('rebal_' + day)) return '';
  props.setProperty('rebal_' + day, hhmm_(new Date()));
  if (String(props.getProperty('REBALANCE') || '').toLowerCase() === 'off') return 'Workload balance is switched off';
  if (!sfkConfigured_()) return '';
  var plan = rebalancePlan_(day, present || {}, absent || {});
  if (!plan.moves.length) return 'Workload balance: nothing to move';
  var done = rebalanceApply_(day, plan.moves);
  try { rebalanceMail_(day, plan, done); } catch (e) {}
  return 'Workload balance: ' + done.filter(function (m) { return m.ok; }).length + ' moved';
}

/** Who has what, and which tasks would move where. Reads only. */
function rebalancePlan_(day, present, absent) {
  var props = PropertiesService.getScriptProperties();
  var users = sfkUsers_() || {}, book = sfkOpenBook_(day) || {}, ppl = {};
  REBALANCE.POOL.forEach(function (sid) {
    if (!users[sid] || !SCHEDULE[sid]) return;
    var b = book[sid] || {}, list = [];
    Object.keys(b).forEach(function (ty) {
      b[ty].forEach(function (t) { if (t.late || t.due === day) { t.ty = ty; list.push(t); } });
    });
    var intel = null;
    try { intel = intelFor_(sid, day); } catch (e) {}
    var protect = {};
    try { JSON.parse(props.getProperty('intel_plan_' + sid + '_' + day) || '[]').forEach(function (id) { protect[id] = 1; }); } catch (e) {}
    try {
      var pr = planRows_(sid, day);
      Object.keys(pr).forEach(function (k) { planItemsOf_(pr[k].Items).forEach(function (it) { if (it.k === 'sf') protect[it.id] = 1; }); });
    } catch (e) {}
    ppl[sid] = { sid: sid, name: nameFor_(sid), first: String(nameFor_(sid)).split(' ')[0], load: list.length, start: list.length,
                 pace: Math.max(REBALANCE.MIN_PACE, (intel && intel.pace) || 0), list: list, protect: protect,
                 present: !!present[sid], absent: !!absent[sid], got: 0, gave: 0 };
  });
  var all = Object.keys(ppl).map(function (k) { return ppl[k]; });
  var days = function (x) { return x.load / x.pace; };
  var movable = function (g, t) {
    if (t._moved) return false;
    if (!g.absent && g.protect[t.id]) return false;
    if (!g.absent && (t.touched || 0) < REBALANCE.IDLE_DAYS) return false;
    if (g.sid === 'kamla' && REBALANCE.KAMLA_GIVES.indexOf(t.ty) === -1) return false;
    return true;
  };
  var moves = [];
  while (moves.length < REBALANCE.PER_DAY) {
    var givers = all.filter(function (g) { return g.gave < REBALANCE.PER_GIVER; }).sort(function (a, b) { return days(b) - days(a); });
    var made = false;
    for (var i = 0; i < givers.length && !made; i++) {
      var g = givers[i], gd = days(g);
      if (!g.absent && gd < REBALANCE.MIN_DAYS) continue;
      var recv = all.filter(function (r) {
        return r.sid !== g.sid && REBALANCE.TAKES[r.sid] && r.present && !r.absent && r.got < REBALANCE.PER_RECEIVER;
      }).sort(function (a, b) { return days(a) - days(b); });
      for (var j = 0; j < recv.length && !made; j++) {
        var r = recv[j], rd = days(r);
        if ((r.load + 1) / r.pace > REBALANCE.MAX_RECV_DAYS) continue;
        if (!g.absent && gd < REBALANCE.RATIO * Math.max(rd, 0.5)) continue;
        var cand = g.list.filter(function (t) { return movable(g, t) && REBALANCE.TAKES[r.sid].indexOf(payoffOf_(t).key) > -1; }).sort(intelOrder_);
        if (!cand.length) continue;
        var t = cand[0];
        t._moved = 1;
        moves.push({ t: t, from: g.sid, to: r.sid, fromName: g.name, toName: r.name,
          why: (g.absent ? g.first + ' is marked absent today; ' : '') +
               g.first + ' had ' + g.load + ' due or overdue (' + gd.toFixed(1) + ' days at ' + 'her' + ' pace); ' +
               r.first + ' had ' + r.load + ' (' + rd.toFixed(1) + ' days)' });
        g.load--; r.load++; g.gave++; r.got++;
        made = true;
      }
    }
    if (!made) break;
  }
  return { moves: moves, people: all };
}

function sfkSetOwner_(taskId, ownerId) {
  function send(tok) {
    return UrlFetchApp.fetch(tok.instance_url + '/services/data/' + SFK.API + '/sobjects/Task/' + taskId, {
      method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok.access_token }, payload: JSON.stringify({ OwnerId: ownerId }) });
  }
  var res = send(sfkToken_());
  if (res.getResponseCode() === 401) { sfkProps_().deleteProperty('SFK_TOKEN'); res = send(sfkToken_()); }
  var code = res.getResponseCode();
  if (code !== 204 && code !== 200) throw new Error(sfkSaid_(res.getContentText()));
  return true;
}

function moveLog_(row) {
  try {
    var sh = hrTab_(MOVES, true);
    sh.appendRow(headerOf_(sh).map(function (h) { return row[h] != null ? row[h] : ''; }));
    forgetHr_(MOVES);
  } catch (e) {}
}

/** Make the moves. Each one is checked against Salesforce first: still open,
 *  still the giver's. */
function rebalanceApply_(day, moves) {
  var users = sfkUsers_() || {}, at = hhmm_(new Date()), out = [];
  var now = {};
  try {
    sfkQuery_('SELECT Id, OwnerId, IsClosed FROM Task WHERE Id IN (' + moves.map(function (m) { return "'" + m.t.id + "'"; }).join(',') + ')')
      .forEach(function (r) { now[r.Id] = r; });
  } catch (e) { return out; }
  moves.forEach(function (m) {
    var cur = now[m.t.id], res = '';
    if (!cur || cur.IsClosed || cur.OwnerId !== users[m.from].id) res = 'SKIPPED: changed since it was planned';
    else {
      try {
        sfkSetOwner_(m.t.id, users[m.to].id);
        res = 'OK';
        try {
          sfkInsert_('FeedItem', { ParentId: m.t.id, Body:
            m.note || ('Moved from ' + m.fromName + ' to ' + m.toName + ' by the branch workload balance, ' + at + ' ' + shortDate_(day) + '. ' +
            m.why + '. ' + String(m.toName).split(' ')[0] + ', it is yours from here: note what you do on it, as always.') });
        } catch (e) { res = 'OK, Chatter note failed'; }
      } catch (e) { res = 'FAILED: ' + String(e && e.message || e).slice(0, 180); }
    }
    if (typeof audit_ === 'function') audit_({ staffId: 'system', name: 'Workload balance' }, m.t.id, 'owner', m.from, m.to, res);
    moveLog_({ Date: day, At: at, TaskId: m.t.id, Subject: m.t.subject, Type: m.t.ty || '', From: m.from, To: m.to, Why: m.why, Result: res });
    m.ok = /^OK/.test(res); m.result = res;
    out.push(m);
  });
  sfkForgetDay_(day);
  // The receiver's plan page can offer what arrived.
  out.filter(function (m) { return m.ok; }).forEach(function (m) {
    var model = intelModel_(m.to, day);
    if (!model) return;
    model.loose = model.loose || [];
    model.loose.unshift({ id: m.t.id, s: shorten_('Moved to you: ' + m.t.subject, 95), ty: m.t.ty || '', due: m.t.due || '', late: !!m.t.late });
    try { PropertiesService.getScriptProperties().setProperty(intelModelKey_(m.to, day), JSON.stringify(model).slice(0, 8900)); } catch (e) {}
  });
  return out;
}

function moveLines_(list, day) {
  return list.map(function (m) {
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (m.ok ? MAIL.green : MAIL.red) + ';border-radius:9px;padding:9px 13px;margin-bottom:7px">' +
      '<div style="font-size:13px">' + payoffTag_(m.t).replace(/^ /, '') + ' ' + esc_(m.t.subject) +
        (m.t.late ? ' <span style="color:' + MAIL.red + ';font-weight:700">· overdue since ' + esc_(shortDate_(m.t.due)) + '</span>' : (m.t.due === day ? ' <span style="color:' + MAIL.amber + ';font-weight:700">· due today</span>' : '')) + '</div>' +
      '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:2px">' + esc_(m.fromName) + ' &rarr; ' + esc_(m.toName) + (m.ok ? '' : ' · ' + esc_(m.result)) + '</div></div>';
  }).join('');
}

function rebalanceMail_(day, plan, done) {
  var ok = done.filter(function (m) { return m.ok; });
  var by = function (k) { var o = {}; ok.forEach(function (m) { (o[m[k]] = o[m[k]] || []).push(m); }); return o; };
  var toMe = by('to'), fromMe = by('from');
  var sign = '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">' +
    'Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';
  Object.keys(toMe).forEach(function (sid) {
    var to = emailFor_(sid);
    if (!to) return;
    var first = String(nameFor_(sid)).split(' ')[0];
    MailApp.sendEmail({ to: to, cc: dayStartCc_(to, sid).join(',') || undefined,
      subject: 'Moved to you this morning · ' + toMe[sid].length + ' task' + (toMe[sid].length === 1 ? '' : 's') + ' · ' + shortDate_(day),
      htmlBody: shell_('Moved to you this morning', nameFor_(sid) + ' · ' + prettyDate_(day),
        '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">' + esc_(first) + ', you have room today, so these have come to you from colleagues who are further behind. ' +
          'They are in your name in Salesforce now, each with a note saying why. Put them into your plan; high-payoff first.</div>' +
        moveLines_(toMe[sid], day) + replyButton_(replyUrl_(sid, day, 'plan'), 'Add them to my plan', 'They are at the top of your plan page, under "Not in today\'s plan".') + sign) });
  });
  Object.keys(fromMe).forEach(function (sid) {
    var to = emailFor_(sid);
    if (!to) return;
    var first = String(nameFor_(sid)).split(' ')[0];
    MailApp.sendEmail({ to: to, cc: dayStartCc_(to, sid).join(',') || undefined,
      subject: 'Moved off your list today · ' + fromMe[sid].length + ' task' + (fromMe[sid].length === 1 ? '' : 's') + ' · ' + shortDate_(day),
      htmlBody: shell_('Moved off your list today', nameFor_(sid) + ' · ' + prettyDate_(day),
        '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">' + esc_(first) + ', your due and overdue work is more than your pace can clear, so these have gone to a colleague with room. ' +
          'Your plan is untouched. Hand over anything they need to know in the task\'s Chatter.</div>' + moveLines_(fromMe[sid], day) + sign) });
  });
  var cc = dayStartCc_('');
  if (!cc.length) return;
  var table = plan.people.map(function (p) {
    return '<tr><td style="padding:6px;font-size:13px;border-top:1px solid ' + MAIL.line + '">' + esc_(p.name) + (p.absent ? ' (absent)' : (p.present ? '' : ' (not signed in)')) + '</td>' +
      '<td style="padding:6px;font-size:13px;text-align:right;border-top:1px solid ' + MAIL.line + '">' + p.start + ' → <b>' + p.load + '</b></td>' +
      '<td style="padding:6px;font-size:13px;text-align:right;border-top:1px solid ' + MAIL.line + '">' + (p.load / p.pace).toFixed(1) + ' days</td></tr>';
  }).join('');
  MailApp.sendEmail({ to: cc.join(','),
    subject: 'Workload balanced · ' + shortDate_(day) + ' · ' + ok.length + ' moved' + (done.length > ok.length ? ', ' + (done.length - ok.length) + ' not' : ''),
    htmlBody: shell_('Workload balanced', prettyDate_(day) + ' · ' + hhmm_(new Date()),
      '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">Due and overdue work, before → after, and how many days of work that is at each person\'s own pace.</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px;margin-bottom:12px">' + table + '</table>' +
      moveLines_(done, day) +
      replyButton_(replyUrl_('ricky', day, 'undo'), 'Undo any of these', 'Opens today\'s moves; tick what should go back. Switch it off with Script Property REBALANCE = off.')) });
}

function undoReplyPage_(person, day, error) {
  var rows = (hrRows_(MOVES, true) || []).filter(function (r) {
    return isoDay_(r.Date) === day && /^OK/.test(String(r.Result || '')) && !String(r.UndoneAt || '').trim();
  });
  var list = rows.map(function (r) {
    return '<label class="t"><input type="checkbox" name="u" value="' + esc_(r.TaskId) + '"><span>' + esc_(r.Subject) +
      ' <span class="br2">· ' + esc_(nameFor_(String(r.From))) + ' &rarr; ' + esc_(nameFor_(String(r.To))) + '</span></span></label>';
  }).join('');
  return replyPage_('Workload moves · ' + prettyDate_(day), 'Tick a move to send the task back to who had it. A Chatter note says you moved it back.',
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    (rows.length ? '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(person.staffId, day, 'undo') +
      '<div class="card">' + list + '</div><button type="submit">Move these back</button></form>' : '<div class="card">Nothing moved today, or all of it already moved back.</div>'));
}

function undoReplySave_(person, day, p, all) {
  var ids = all('u'), users = sfkUsers_() || {}, back = [];
  if (!ids.length) return undoReplyPage_(person, day, 'Tick at least one.');
  var sh = hrTab_(MOVES, true), rows = sheetObjects_(sh), idx = colMap_(sh), at = hhmm_(new Date());
  rows.forEach(function (r, i) {
    if (isoDay_(r.Date) !== day || ids.indexOf(String(r.TaskId)) === -1 || String(r.UndoneAt || '').trim() || !/^OK/.test(String(r.Result || ''))) return;
    var from = String(r.From);
    try {
      sfkSetOwner_(String(r.TaskId), users[from].id);
      try { sfkInsert_('FeedItem', { ParentId: String(r.TaskId), Body: 'Moved back to ' + nameFor_(from) + ' by Mr Rampersad, ' + at + ' ' + shortDate_(day) + '.' }); } catch (e) {}
      writeRow_(sh, i + 2, idx, { UndoneAt: at });
      back.push(String(r.Subject));
    } catch (e) {}
  });
  forgetHr_(MOVES); sfkForgetDay_(day);
  return replyPage_('Moved back: ' + back.length, '', '<div class="card ok">' + back.map(function (s) { return '<div class="ln">&#10003; ' + esc_(s) + '</div>'; }).join('') + '</div>');
}

// ---------------------------------------------------------------------------
//  Pawan's day: the calendar
//
//  "Pawan is my personal assistant; he is to be treated differently, as he
//  manages the general insurance lines as well as my personal stuff and going
//  on errands and delivery, so his calendar is important." (14 October 2026.)
//  His errands live on his Salesforce calendar (Events he owns). His mails
//  read that calendar, his general insurance expiring in the next fortnight
//  (Risk_Details__c, by To__c) and his tasks, and go to the Branch Manager
//  and sales support, like everybody else's.
// ---------------------------------------------------------------------------

var PAWAN_GI_DAYS = 14;

function sfkEventsFor_(sid, fromDay, toDay) {
  var u = (sfkUsers_() || {})[sid];
  if (!u) return [];
  return sfkQuery_('SELECT Id, Subject, StartDateTime, EndDateTime, Location, IsAllDayEvent, What.Name, Who.Name FROM Event' +
    " WHERE OwnerId = '" + u.id + "' AND StartDateTime >= " + sfkUtcAt_(fromDay, 0) + ' AND StartDateTime < ' + sfkUtcAt_(toDay, 0) +
    ' ORDER BY StartDateTime ASC LIMIT 100').map(function (e) {
      var a = sfLocal_(e.StartDateTime), b = sfLocal_(e.EndDateTime);
      return { id: e.Id, s: shorten_(e.Subject || '', 120), day: a ? a.day : '', start: a ? a.min : null, end: b ? b.min : null,
               where: e.Location || '', what: (e.What && e.What.Name) || '', who: (e.Who && e.Who.Name) || '', allDay: !!e.IsAllDayEvent };
    });
}

function sfkGiExpiring_(day, n) {
  return sfkQuery_('SELECT Id, Account__c, Policy__c, Vehicle__c, Carrier__c, To__c FROM Risk_Details__c WHERE To__c >= ' + day +
    ' AND To__c <= ' + shiftDays_(day, n) + ' ORDER BY To__c ASC LIMIT 40').map(function (r) {
      return { id: r.Id, s: (r.Account__c || '') + ' · ' + (r.Policy__c || '') + (r.Vehicle__c ? ' · ' + r.Vehicle__c : ''), due: r.To__c || '', carrier: r.Carrier__c || '' };
    });
}

function eventLine_(e) {
  var t = e.allDay ? 'All day' : twelve_(mmText_(e.start)) + (e.end != null ? ' – ' + twelve_(mmText_(e.end)) : '');
  return '<div style="font-size:13px;line-height:1.45;padding:6px 0;border-top:1px solid ' + MAIL.line + '"><b style="color:' + MAIL.navy + '">' + esc_(t) + '</b> · ' + esc_(e.s) +
    (e.where ? ' <span style="color:' + MAIL.muted + '">· ' + esc_(e.where) + '</span>' : '') +
    (e.what || e.who ? '<div style="font-size:12px;color:' + MAIL.muted + '">' + esc_([e.what, e.who].filter(String).join(' · ')) + '</div>' : '') + '</div>';
}

function pawanItems_(day) {
  var ev = [], tasks = [];
  try { ev = sfkEventsFor_('pawan', day, shiftDays_(day, 1)); } catch (e) {}
  try {
    var b = (sfkOpenBook_(day) || {}).pawan || {};
    Object.keys(b).forEach(function (ty) { b[ty].forEach(function (t) { if (t.late || t.due === day) { t.ty = ty; tasks.push(t); } }); });
  } catch (e) {}
  tasks.sort(intelOrder_);
  return { events: ev, tasks: tasks };
}

function sendPawanDay_(day, kind) {
  var sid = 'pawan', to = emailFor_(sid);
  if (!to) return false;
  var name = nameFor_(sid), first = String(name).split(' ')[0], sched = scheduleFor_(sid);
  var it = pawanItems_(day), tomorrow = [], gi = [], week = [];
  try { tomorrow = sfkEventsFor_(sid, shiftDays_(day, 1), shiftDays_(day, 2)); } catch (e) {}
  try { gi = sfkGiExpiring_(day, PAWAN_GI_DAYS); } catch (e) {}
  try { week = sfkEventsFor_(sid, weekStart_(day), shiftDays_(weekStart_(day), 7)); } catch (e) {}
  var answers = {};
  try { answers = progAnswers_(sid, day, 'errand-progress'); var la = progAnswers_(sid, day, 'errand-leave'); Object.keys(la).forEach(function (k) { answers[k] = la[k]; }); } catch (e) {}
  var signIn = signedInAt_(sid, day), nowM = minutesOf_(hhmm_(new Date()));

  // What the calendar says.
  var lines = [], b_ = function (x) { return '<b>' + esc_(x) + '</b>'; }, red = function (x) { return '<b style="color:' + MAIL.red + '">' + esc_(x) + '</b>'; };
  if (!it.events.length) lines.push({ bad: true, html: red('Nothing on your Salesforce calendar today.') + ' Every errand, delivery, collection and pick-up goes on it, with the place, before you set out. That is how Mr Rampersad knows where you are.' });
  else lines.push({ bad: false, html: b_(it.events.length) + ' on your calendar today, first at ' + b_(twelve_(mmText_(it.events[0].start))) + '.' });
  var clash = [];
  for (var i = 1; i < it.events.length; i++) {
    var a = it.events[i - 1], c = it.events[i];
    if (a.end != null && c.start != null && c.start < a.end) clash.push(twelve_(mmText_(c.start)) + ' (' + shorten_(a.s, 30) + ' / ' + shorten_(c.s, 30) + ')');
  }
  if (clash.length) lines.push({ bad: true, html: red(clash.length + ' clash' + (clash.length > 1 ? 'es' : '')) + ': ' + esc_(clash.join('; ')) + '. Move one, or tell Mr Rampersad which comes first.' });
  var noPlace = it.events.filter(function (e) { return !e.where; }).length;
  if (noPlace) lines.push({ bad: true, html: red(noPlace) + ' with no place on it. Put the location on every errand.' });
  if (it.tasks.length) lines.push({ bad: it.tasks.some(function (t) { return t.late; }), html: b_(it.tasks.length) + ' Salesforce task' + (it.tasks.length === 1 ? '' : 's') + ' due or overdue, ' + it.tasks.filter(function (t) { return t.late; }).length + ' overdue.' });
  if (gi.length) lines.push({ bad: false, html: b_(gi.length) + ' general insurance polic' + (gi.length === 1 ? 'y expires' : 'ies expire') + ' in the next ' + PAWAN_GI_DAYS + ' days, first on ' + b_(shortDate_(gi[0].due)) + '. Each needs its renewal notice sent and a call.' });
  try { var pil = innovationLine_((sfkInnovation_(day) || {})[sid], day, sid); if (pil) lines.push(pil); } catch (e) {}
  var past = week.filter(function (e) { return e.day < day; }).length;
  lines.push({ bad: false, html: 'This week so far: ' + b_(past) + ' errand' + (past === 1 ? '' : 's') + ' on the calendar before today, ' + b_(week.length - past) + ' from today on.' });
  if (kind !== 'first') {
    var all = it.events.concat(it.tasks), ans = all.filter(function (x) { return answers[x.id]; }).length;
    var doneN = all.filter(function (x) { return answers[x.id] && answers[x.id].a === 'done'; }).length;
    lines.unshift({ bad: ans < all.length, html: 'Answered ' + b_(ans + ' of ' + all.length) + ' for today; ' + b_(doneN) + ' done.' });
  }

  var head = kind === 'first' ? 'Good morning · your day' : kind === 'midday' ? 'Progress check' : 'Before you leave';
  var intro = kind === 'first'
    ? 'Good morning, ' + esc_(first) + (signIn ? ', and thank you for signing in at <b>' + esc_(twelve_(signIn)) + '</b>.' : '. Your day starts at <b>' + esc_(twelve_(mmText_((parseSpan_(sched.hours || '') || { start: 480 }).start))) + '</b>.') +
      ' Here is today\'s run from your Salesforce calendar, your tasks, and the general insurance coming up. Confirm the run from the button; say what needs moving.'
    : kind === 'midday'
      ? esc_(first) + ', it is ' + esc_(twelve_(hhmm_(new Date()))) + '. Mark what is done and what has moved, so Mr Rampersad knows where the day stands.'
      : esc_(first) + ', your day ends at <b>' + esc_(twelve_(mmText_(endFor_(sid)))) + '</b>. Mark each errand and task done or not, with a reason, and put tomorrow\'s errands on the calendar before you go.';
  var later = it.events.filter(function (e) { return kind === 'first' || e.end == null || e.end > nowM; });
  var body =
    '<div style="font-size:14px;line-height:1.55;margin-bottom:14px">' + intro + '</div>' +
    statTiles_([
      { value: signIn ? twelve_(signIn) : '—', label: signIn ? 'signed in' : 'not signed in' },
      { value: it.events.length, label: 'on the calendar', color: it.events.length ? MAIL.navy : MAIL.red },
      { value: it.tasks.length, label: 'tasks due', color: it.tasks.length ? MAIL.amber : MAIL.navy },
      { value: gi.length, label: 'GI expiring ' + PAWAN_GI_DAYS + 'd' }
    ]) +
    replyButton_(replyUrl_(sid, day, 'errand') + '&c=' + (kind === 'leave' ? 'leave' : 'progress'),
      kind === 'first' ? 'Confirm today\'s run' : kind === 'midday' ? 'Mark what is done' : 'Close my day here',
      'One tap per errand: done, on it, needs another day, or can\'t. No sign-in.') +
    intelBox_(lines, 'What the calendar shows') +
    sectionLabel_('Today\'s run' + (kind === 'first' ? '' : ' · still to come')) +
    '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 15px 8px">' +
      (later.length ? later.map(eventLine_).join('') : '<div style="font-size:13px;color:' + MAIL.muted + ';padding:8px 0">Nothing on the calendar.</div>') + '</div>' +
    (it.tasks.length ? sectionLabel_('Tasks due or overdue') + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 15px 8px">' +
      it.tasks.slice(0, 10).map(function (t) { return dayStartTaskLine_(t, day); }).join('') + '</div>' : '') +
    (gi.length ? sectionLabel_('General insurance expiring · next ' + PAWAN_GI_DAYS + ' days') + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 15px 8px">' +
      gi.slice(0, 12).map(function (g) { return '<div style="font-size:12.5px;padding:4px 0;border-top:1px solid ' + MAIL.line + '"><b>' + esc_(shortDate_(g.due)) + '</b> · ' + esc_(g.s) + (g.carrier ? ' <span style="color:' + MAIL.muted + '">· ' + esc_(g.carrier) + '</span>' : '') + '</div>'; }).join('') + '</div>' : '') +
    (kind === 'first' ? motorCard_(day) : '') +
    (kind !== 'midday' ? sectionLabel_('Tomorrow') + '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 15px 8px">' +
      (tomorrow.length ? tomorrow.map(eventLine_).join('') : '<div style="font-size:13px;color:' + (kind === 'leave' ? MAIL.red : MAIL.muted) + ';padding:8px 0">Nothing on tomorrow\'s calendar yet.</div>') + '</div>' : '') +
    '<div style="font-size:13px;line-height:1.55;margin-top:18px;border-top:1px solid ' + MAIL.line + ';padding-top:12px">' +
      'Ricky Rampersad<br><span style="color:' + MAIL.muted + '">Branch Manager · Ricky Rampersad Branch</span></div>';
  var mail = { to: to,
    subject: (kind === 'first' ? 'Your day' : kind === 'midday' ? 'Progress check' : 'Before you leave') + ' · ' + name + ' · ' + shortDate_(day) +
      ' · ' + it.events.length + ' on the calendar, ' + it.tasks.length + ' task' + (it.tasks.length === 1 ? '' : 's'),
    htmlBody: shell_(head, name + ' · ' + prettyDate_(day), body) };
  var cc = dayStartCc_(to, sid);
  if (cc.length) mail.cc = cc.join(',');
  MailApp.sendEmail(mail);
  return true;
}

var ERRAND_CHOICES = {
  progress: [['done', 'Done'], ['now', 'On it'], ['move', 'Needs another day'], ['not', 'Can\'t do']],
  leave: [['done', 'Done'], ['move', 'Moved to another day'], ['not', 'Not done']]
};

function errandReplyPage_(person, day, c, error) {
  c = ERRAND_CHOICES[c] ? c : 'progress';
  var sid = String(person.staffId), it = pawanItems_(day), had = progAnswers_(sid, day, 'errand-' + c);
  var row = function (x, isEvent) {
    var h = had[x.id] || {};
    var label = isEvent ? '<b>' + esc_(x.allDay ? 'All day' : twelve_(mmText_(x.start))) + '</b> · ' + esc_(x.s) + (x.where ? ' <span class="br2">· ' + esc_(x.where) + '</span>' : '')
                        : esc_(x.subject) + taskTag_(x, day);
    return '<div class="task"><div>' + label + '</div><div class="seg">' + ERRAND_CHOICES[c].map(function (o) {
        return '<label><input type="radio" name="a_' + esc_(x.id) + '" value="' + o[0] + '"' + (h.a === o[0] ? ' checked' : '') + ' onchange="sh(this)"><span>' + o[1] + '</span></label>';
      }).join('') + '</div><input type="text" name="r_' + esc_(x.id) + '" value="' + esc_(h.r || '') + '" placeholder="Why, and when it will be done" style="display:' + (h.a === 'move' || h.a === 'not' ? 'block' : 'none') + '"></div>';
  };
  var inner = (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(sid, day, 'errand') + '<input type="hidden" name="c" value="' + c + '">' +
    '<div class="card"><div class="bh">On the calendar today · ' + it.events.length + '</div>' + (it.events.length ? it.events.map(function (e) { return row(e, true); }).join('') : '<div class="ln" style="color:#DC3F3F">Nothing on your Salesforce calendar today. Put every errand on it.</div>') + '</div>' +
    (it.tasks.length ? '<div class="card"><div class="bh">Tasks due or overdue · ' + it.tasks.length + '</div>' + it.tasks.slice(0, 12).map(function (t) { return row(t, false); }).join('') + '</div>' : '') +
    '<div class="card"><div class="bh">Anything new from Mr Rampersad, or for him</div><textarea name="comment" rows="2" placeholder="New errands, deliveries, or anything he should know"></textarea></div>' +
    (c === 'leave' ? '<div class="card"><label class="t" style="border:0"><input type="checkbox" name="out" value="1"><span>Sign me out now</span></label></div>' : '') +
    '<button type="submit">' + (c === 'leave' ? 'Close my day' : 'Send') + '</button></form>' +
    '<script>function sh(i){var r=document.getElementsByName("r_"+i.name.slice(2))[0];if(r){var n=i.value==="move"||i.value==="not";r.style.display=n?"block":"none";r.required=n}}</script>';
  return replyPage_(c === 'leave' ? 'Before you leave · ' + prettyDate_(day) : 'Your errands · ' + prettyDate_(day),
    'Answer each one. It goes to Mr Rampersad and sales support.', inner);
}

function errandReplySave_(person, day, p, all) {
  var c = ERRAND_CHOICES[String(p.c)] ? String(p.c) : 'progress';
  var sid = String(person.staffId), it = pawanItems_(day), rows = [], missing = 0, label = { note: 'Comment' };
  ERRAND_CHOICES[c].forEach(function (o) { label[o[0]] = o[1]; });
  it.events.map(function (e) { return { id: e.id, s: (e.allDay ? 'All day' : twelve_(mmText_(e.start))) + ' · ' + e.s }; })
    .concat(it.tasks.slice(0, 12).map(function (t) { return { id: t.id, s: t.subject }; }))
    .forEach(function (x) {
      var a = String(p['a_' + x.id] || ''), r = String(p['r_' + x.id] || '').trim().slice(0, REASON_MAX);
      if (!label[a] || a === 'note') return;
      if ((a === 'move' || a === 'not') && !r) { missing++; return; }
      rows.push({ id: x.id, s: x.s, a: a, r: r });
    });
  if (missing) return errandReplyPage_(person, day, c, missing + ' need a reason: why, and when it will be done.');
  var cm = String(p.comment || '').trim().slice(0, REASON_MAX);
  if (cm) rows.push({ id: '_comment', s: 'Comment', a: 'note', r: cm });
  var lock = takeLock_();
  if (!lock) return errandReplyPage_(person, day, c, 'Another save was going in just then. Press it again.');
  try { markStaffWrite_(); progWrite_(person, day, 'errand-' + c, rows); } finally { lock.releaseLock(); }
  if (!signedInAt_(sid, day)) { try { signInFromPage_(person); } catch (e) {} }
  var out = '';
  if (c === 'leave' && p.out) { try { var so = signOutDay_({}, person); if (so && so.ok) out = so.out; } catch (e) {} }
  try { replyCopy_(person, day, c === 'leave' ? 'Errands closed' : 'Errands', rows, label); } catch (e) {}
  return replyPage_('Thank you. That is with Mr Rampersad.', out ? 'Signed out at ' + esc_(twelve_(out)) + '.' : '',
    '<div class="card ok">' + rows.map(function (x) { return '<div class="ln"><b>' + esc_(label[x.a] || x.a) + '</b> · ' + esc_(x.s) + (x.r ? ' · ' + esc_(x.r) : '') + '</div>'; }).join('') + '</div>');
}

// ---------------------------------------------------------------------------
//  Innovation hour, every Thursday
//
//  "Innovation tasks continue to drag and you are to ensure time is set for
//  this as well." (Ricky, 14 October 2026.) Since 1 October one new
//  innovation item had been closed in the whole team, and two people had
//  never had one. So one block on Thursday is protected for it, the day
//  before the branch meeting, so there is something to show on the Friday:
//    · the morning e-mail puts no ordinary tasks in that block; it puts the
//      person's open innovation task in it, or tells them they have none
//    · before you leave asks what moved, and an answer is required
//    · Friday at 7:30 the Branch Manager and the BMA get the board
//  Every morning, whatever the day, says where the person's innovation stands.
//  What to improve is theirs to propose, in their own job area; the tracker
//  only makes the time and keeps the record.
// ---------------------------------------------------------------------------

var INNOVATION = {
  DOW: 4,                       // Thursday (1 Monday .. 7 Sunday)
  TYPE: 'Innovation&Creativity',
  /* No protected block any more: the day is one plan (see SCHEDULE, 17
     October 2026), so the innovation hour is Thursday's own time, asked about
     in the close-out. Name a block here again only if the day is split. */
  BLOCKS: {},
  STALE: 7
};

function isoDow_(day) { var d = new Date(day + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; }

/** The block protected for innovation today, or ''. */
function innovationBlock_(sid, day) {
  return isoDow_(day) === INNOVATION.DOW ? (INNOVATION.BLOCKS[sid] || '') : '';
}

/** Open innovation tasks per desk, and when each last closed one. */
function sfkInnovation_(day) {
  var cache = CacheService.getScriptCache(), key = 'sfk_inno_' + day;
  try { var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  var users = sfkUsers_() || {}, byId = {}, ids = [];
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; ids.push("'" + users[k].id + "'"); });
  if (!ids.length) return {};
  var out = {};
  Object.keys(users).forEach(function (k) { out[k] = { open: [], lastClosed: '', lastSubject: '' }; });
  sfkQuery_("SELECT Id, OwnerId, Subject, ActivityDate, LastModifiedDate FROM Task WHERE Task_Type__c = '" + INNOVATION.TYPE +
    "' AND IsClosed = false AND OwnerId IN (" + ids.join(',') + ') ORDER BY CreatedDate ASC LIMIT 200').forEach(function (r) {
      var sid = byId[r.OwnerId]; if (!sid) return;
      out[sid].open.push({ id: r.Id, subject: shorten_(r.Subject || '', 120), due: r.ActivityDate || '', late: !!(r.ActivityDate && r.ActivityDate < day),
                           touched: daysSince_(r.LastModifiedDate), ty: INNOVATION.TYPE });
    });
  sfkQuery_("SELECT OwnerId, Subject, CompletedDateTime FROM Task WHERE Task_Type__c = '" + INNOVATION.TYPE +
    "' AND IsClosed = true AND OwnerId IN (" + ids.join(',') + ') ORDER BY CompletedDateTime DESC LIMIT 200').forEach(function (r) {
      var sid = byId[r.OwnerId]; if (!sid || out[sid].lastClosed) return;
      var l = sfLocal_(r.CompletedDateTime);
      out[sid].lastClosed = l ? l.day : ''; out[sid].lastSubject = shorten_(r.Subject || '', 90);
    });
  try { cache.put(key, JSON.stringify(out), 3600); } catch (e) {}
  return out;
}

/** One line for the morning's record. */
function innovationLine_(inno, day, sid) {
  if (!inno) return null;
  var b_ = function (x) { return '<b>' + esc_(x) + '</b>'; }, red = function (x) { return '<b style="color:' + MAIL.red + '">' + esc_(x) + '</b>'; };
  var nextThu = day; while (isoDow_(nextThu) !== INNOVATION.DOW) nextThu = shiftDays_(nextThu, 1);
  var when = innovationBlock_(sid, day) ? 'today' : shortDate_(nextThu);
  var blk = INNOVATION.BLOCKS[sid] ? blockLabel_(INNOVATION.BLOCKS[sid]) + ' (' + (scheduleFor_(sid).blocks[INNOVATION.BLOCKS[sid]] || {}).time + ')' : 'Thursday';
  if (!inno.open.length) {
    return { bad: true, html: red('You have no innovation task open.') +
      (inno.lastClosed ? ' Your last was closed on ' + esc_(shortDate_(inno.lastClosed)) + ': "' + esc_(inno.lastSubject) + '".' : ' There is none on record.') +
      ' Propose your next one in your own job area: put it in the scrub box as Innovation &amp; Creativity. Your innovation hour is ' + esc_(when) + ', ' + esc_(blk) + '.' };
  }
  var t = inno.open[0], stale = (t.touched || 0) >= INNOVATION.STALE;
  return { bad: stale || t.late, html: 'Your innovation: ' + b_(t.subject) + ' · ' +
    (stale ? red('untouched ' + t.touched + ' days') : 'last touched ' + (t.touched ? t.touched + ' day' + (t.touched === 1 ? '' : 's') + ' ago' : 'today')) +
    (t.late ? ', ' + red('overdue since ' + shortDate_(t.due)) : (t.due ? ', due ' + esc_(shortDate_(t.due)) : ', ' + red('no due date'))) +
    '. Innovation hour: ' + esc_(when) + ', ' + esc_(blk) + '; show it at Friday\'s branch meeting.' };
}

/** The card for the protected block in the morning e-mail. */
function innovationCard_(sid, day, b, sb, inno) {
  var list = inno && inno.open.length
    ? inno.open.slice(0, 3).map(function (t) { return dayStartTaskLine_(t, day); }).join('')
    : '<div style="font-size:13px;color:' + MAIL.red + ';font-weight:700;margin-top:6px">No innovation task open. Propose one in your own job area and put it in the scrub box as Innovation &amp; Creativity before this block starts.</div>';
  return '<div style="background:#EEF9FD;border:1px solid ' + MAIL.gold + ';border-left:4px solid ' + MAIL.gold + ';border-radius:10px;padding:13px 15px;margin-bottom:10px">' +
    '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:' + MAIL.gold + '">' + esc_(blockLabel_(b)) + (sb.time ? ' · ' + esc_(sb.time) : '') + ' · Innovation hour · protected</div>' +
    '<div style="font-size:13px;line-height:1.5;margin:5px 0 4px">No ordinary tasks go in this block today. Move your innovation forward, write on the task what moved, and bring it to Friday\'s branch meeting.</div>' +
    list + '</div>';
}

/** Friday, before the branch meeting: the board, to the Branch Manager and the BMA. */
function sendInnovationBoard_(day) {
  var cc = managerEmails_(), kamla = '';
  try { kamla = emailFor_('kamla'); } catch (e) {}
  if (!cc.length && !kamla) return false;
  var inno = {};
  try { inno = sfkInnovation_(day) || {}; } catch (e) {}
  var thu = shiftDays_(day, -1);
  var rows = DAY_MAIL_DESKS.map(function (sid) {
    var x = inno[sid] || { open: [] }, said = {};
    try { said = progAnswers_(sid, thu, 'innovation'); } catch (e) {}
    var ans = said._inno ? said._inno.r : '';
    var t = x.open[0];
    var stale = t && ((t.touched || 0) >= INNOVATION.STALE || t.late);
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + (!t ? MAIL.red : stale ? MAIL.amber : MAIL.green) + ';border-radius:9px;padding:10px 13px;margin-bottom:8px">' +
      '<div style="font-size:13.5px;font-weight:800;color:' + MAIL.navy + '">' + esc_(nameFor_(sid)) + '</div>' +
      '<div style="font-size:13px;margin-top:3px">' + (t ? esc_(t.subject) + ' <span style="color:' + (stale ? MAIL.red : MAIL.muted) + '">· touched ' + (t.touched || 0) + ' days ago' + (t.due ? (t.late ? ' · overdue since ' : ' · due ') + esc_(shortDate_(t.due)) : ' · no due date') + '</span>'
        : '<span style="color:' + MAIL.red + ';font-weight:700">No innovation task open.</span>' + (x.lastClosed ? ' <span style="color:' + MAIL.muted + '">Last closed ' + esc_(shortDate_(x.lastClosed)) + ': ' + esc_(x.lastSubject) + '</span>' : ' <span style="color:' + MAIL.muted + '">None on record.</span>')) + '</div>' +
      '<div style="font-size:12.5px;color:' + (ans ? MAIL.ink : MAIL.red) + ';margin-top:4px">Thursday\'s hour: ' + (ans ? '"' + esc_(ans) + '"' : 'nothing said') + '</div></div>';
  }).join('');
  var ccList = [kamla, DAYSTART_CC_DEFAULT].filter(function (e, i, a) { return e && a.indexOf(e) === i; });
  MailApp.sendEmail({ to: (cc.length ? cc : [kamla]).join(','), cc: ccList.join(',') || undefined,
    subject: 'Innovation board · ' + shortDate_(day) + ' · for the branch meeting',
    htmlBody: shell_('Innovation board', prettyDate_(day) + ' · before the branch meeting',
      '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">Each desk\'s innovation, how long since it moved, and what they said their Thursday hour moved.</div>' + rows) });
  return true;
}

// ---------------------------------------------------------------------------
//  The BMA's board, a quarter past nine
//
//  The BMA supervises the support staff (14 October 2026). By 9:15 every
//  morning e-mail has gone and the first block is under way, so she gets one
//  page: each desk, signed in or not, plan in or not and whether it holds up,
//  what is due and overdue, and one button to nudge whoever has not planned.
//  Copied to the Branch Manager.
// ---------------------------------------------------------------------------

function teamRows_(day) {
  var book = {}, props = PropertiesService.getScriptProperties();
  try { book = sfkOpenBook_(day) || {}; } catch (e) {}
  return DAY_MAIL_DESKS.filter(function (s) { return s !== 'kamla'; }).map(function (sid) {
    var b = book[sid] || {}, overdue = 0, due = 0;
    Object.keys(b).forEach(function (ty) { b[ty].forEach(function (t) { if (t.late) overdue++; else if (t.due === day) due++; }); });
    var plans = {}, planned = 0;
    try { plans = planRows_(sid, day); } catch (e) {}
    Object.keys(plans).forEach(function (k) { planned += planItemsOf_(plans[k].Items).length; });
    var target = Number(props.getProperty(intelTargetKey_(sid, day)) || 0), chk = null;
    if (sid !== 'pawan' && planned) { try { chk = planCheck_(sid, day, b, intelFor_(sid, day)); } catch (e) {} }
    var ev = null;
    if (sid === 'pawan') { try { ev = sfkEventsFor_(sid, day, shiftDays_(day, 1)).length; } catch (e) {} }
    return { sid: sid, name: nameFor_(sid), signIn: signedInAt_(sid, day), planned: planned, target: target,
             holds: chk ? chk.ok : null, overdue: overdue, due: due, events: ev, absent: false };
  });
}

function sendTeamBoard_(day) {
  var to = '';
  try { to = emailFor_('kamla'); } catch (e) {}
  var cc = dayStartCc_(to || '');
  if (!to && !cc.length) return false;
  var rows = teamRows_(day), unplanned = rows.filter(function (r) { return r.sid !== 'pawan' && !r.planned; });
  var cell = function (x, col) { return '<td style="padding:7px 6px;font-size:12.5px;border-top:1px solid ' + MAIL.line + ';' + (col ? 'color:' + col + ';font-weight:700' : '') + '">' + x + '</td>'; };
  var table = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ' + MAIL.line + ';border-radius:10px;padding:4px 8px">' +
    '<tr>' + ['Desk', 'In', 'Plan', 'Overdue', 'Due today'].map(function (h) { return '<td style="padding:7px 6px;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:' + MAIL.navy + '">' + h + '</td>'; }).join('') + '</tr>' +
    rows.map(function (r) {
      var plan = r.sid === 'pawan' ? (r.events == null ? '—' : r.events + ' on calendar') :
        (r.planned ? r.planned + (r.target ? ' of ' + r.target : '') + (r.holds === false ? ' · does not hold up' : r.holds ? ' · holds up' : '') : 'none');
      return '<tr>' + cell(esc_(r.name)) + cell(r.signIn ? esc_(twelve_(r.signIn)) : 'not in', r.signIn ? '' : MAIL.red) +
        cell(esc_(plan), (r.sid === 'pawan' ? !r.events : !r.planned) || r.holds === false ? MAIL.red : MAIL.green) +
        cell(r.overdue, r.overdue ? MAIL.red : '') + cell(r.due) + '</tr>';
    }).join('') + '</table>';
  MailApp.sendEmail({ to: to || cc.join(','), cc: to && cc.length ? cc.join(',') : undefined,
    subject: 'Team board · ' + shortDate_(day) + ' · ' + (unplanned.length ? unplanned.length + ' without a plan' : 'every plan in'),
    htmlBody: shell_('Team board', prettyDate_(day) + ' · ' + twelve_(hhmm_(new Date())),
      '<div style="font-size:14px;line-height:1.55;margin-bottom:12px">Kamla, here is the team as the morning runs. ' +
        (unplanned.length ? '<b>' + unplanned.map(function (r) { return esc_(String(r.name).split(' ')[0]); }).join(', ') + '</b> ' + (unplanned.length === 1 ? 'has' : 'have') + ' no plan in yet.' : 'Every plan is in.') + '</div>' +
      table + (unplanned.length ? replyButton_(replyUrl_('kamla', day, 'nudge'), 'Nudge who has not planned', 'Sends each a short e-mail with their plan button, copied to you and Mr Rampersad.') : '')) });
  return true;
}

function nudgeReplyPage_(person, day, error) {
  var rows = teamRows_(day).filter(function (r) { return r.sid !== 'pawan' && !r.planned; });
  return replyPage_('Nudge · ' + prettyDate_(day), 'Tick who gets a nudge. Each gets their plan button again, copied to you and Mr Rampersad.',
    (error ? '<div class="card bad"><b style="color:#DC3F3F">' + esc_(error) + '</b></div>' : '') +
    (rows.length ? '<form method="post" action="' + esc_(execBase_()) + '" target="_top">' + replyHidden_(person.staffId, day, 'nudge') +
      '<div class="card">' + rows.map(function (r) {
        return '<label class="t"><input type="checkbox" name="n" value="' + esc_(r.sid) + '" checked><span>' + esc_(r.name) + ' <span class="br2">· ' + (r.signIn ? 'in at ' + esc_(twelve_(r.signIn)) : 'not signed in') + ' · ' + r.overdue + ' overdue</span></span></label>';
      }).join('') + '</div><div class="card"><div class="bh">A line from you (optional)</div><input type="text" name="line" placeholder="e.g. Plan in by 9:45, please"></div><button type="submit">Send the nudge</button></form>'
      : '<div class="card ok">Every plan is in.</div>'));
}

function nudgeReplySave_(person, day, p, all) {
  var who = all('n'), line = String(p.line || '').trim().slice(0, 200), sent = [];
  if (!who.length) return nudgeReplyPage_(person, day, 'Tick at least one.');
  who.forEach(function (sid) {
    if (DAY_MAIL_DESKS.indexOf(sid) === -1) return;
    var to = emailFor_(sid);
    if (!to) return;
    var first = String(nameFor_(sid)).split(' ')[0];
    var cc = [emailFor_(person.staffId)].concat(dayStartCc_(to, sid)).filter(function (e, i, a) { return e && a.indexOf(e) === i && e !== to; });
    MailApp.sendEmail({ to: to, cc: cc.join(',') || undefined,
      subject: 'Your plan is not in yet · ' + shortDate_(day),
      htmlBody: shell_('Your plan is not in yet', nameFor_(sid) + ' · ' + prettyDate_(day),
        '<div style="font-size:14px;line-height:1.55;margin-bottom:8px">' + esc_(first) + ', your day has started and your plan is not in. ' +
          'It is ready for you: one tap, untick what you will not do, save.</div>' +
        (line ? '<div style="font-size:14px;line-height:1.55;margin:8px 0;padding:10px 13px;background:' + MAIL.paper + ';border-radius:9px">' + esc_(line) + '<br><span style="color:' + MAIL.muted + ';font-size:12.5px">' + esc_(person.name || 'Kamla') + '</span></div>' : '') +
        replyButton_(replyUrl_(sid, day, 'plan'), 'Open my plan', 'No sign-in.')) });
    sent.push(nameFor_(sid));
  });
  return replyPage_('Nudged: ' + sent.length, '', '<div class="card ok">' + sent.map(function (n) { return '<div class="ln">&#10003; ' + esc_(n) + '</div>'; }).join('') + '</div>');
}

// ---------------------------------------------------------------------------
//  Salesforce
//  The three numbers on the form — closed, overdue, sixty-plus — were being
//  typed by hand, and the sheet shows how that went: Closed filled on 47 rows
//  out of 63, Overdue on 30. A number somebody guesses at four o'clock is not
//  a measurement.
//
//  Salesforce already knows all three, per person, to the minute. So it is
//  asked, and the form shows what came back. Nobody types anything.
//
//  Credentials live in Script Properties, never in this file:
//    SF_KEY, SF_SECRET   — from the Connected App
//    SF_USER, SF_PASS    — password with the security token appended, no space
//  The same four the renewal sheet uses. Run sfKpiTest() once to check.
// ---------------------------------------------------------------------------

var SFK = { API: 'v64.0', LOGIN: 'https://login.salesforce.com', CACHE_MIN: 12 };

/** Where to authenticate. Orgs that enforce My Domain refuse
 *  login.salesforce.com outright, so this is a Script Property (SF_LOGIN_URL)
 *  rather than something you have to come in here and edit. */
function sfkLoginUrl_() {
  var u = sfkProps_().getProperty('SF_LOGIN_URL');
  return (u ? String(u).trim().replace(/\/+$/, '') : SFK.LOGIN);
}

function sfkProps_() { return PropertiesService.getScriptProperties(); }

/** Which OAuth flow to use.
 *
 *  Salesforce has removed the username-password flow from the External Client
 *  App model — it is not in the Flow Enablement list at all, and an org that has
 *  moved to that model records "Username-Password Flow Disabled" in Login
 *  History no matter what the credentials are.
 *
 *  Client credentials is the better fit anyway. The app authenticates as itself
 *  against a Run As user set on the app, so there is no password in a script
 *  property, no security token to go stale when the password changes, and no
 *  refresh token to rotate. Set SF_KEY and SF_SECRET and leave SF_USER and
 *  SF_PASS unset, and this is what runs. */
function sfkAuthMode_() {
  var p = sfkProps_();
  var m = (p.getProperty('SF_AUTH') || '').trim().toLowerCase();
  if (m === 'client_credentials' || m === 'password') return m;
  return p.getProperty('SF_PASS') ? 'password' : 'client_credentials';
}

function sfkConfigured_() {
  var p = sfkProps_();
  if (!p.getProperty('SF_KEY') || !p.getProperty('SF_SECRET')) return false;
  if (sfkAuthMode_() === 'client_credentials') return true;
  return !!(p.getProperty('SF_USER') && p.getProperty('SF_PASS'));
}

function sfkAuthPayload_() {
  var p = sfkProps_();
  var base = { client_id: p.getProperty('SF_KEY'), client_secret: p.getProperty('SF_SECRET') };
  if (sfkAuthMode_() === 'client_credentials') {
    base.grant_type = 'client_credentials';
  } else {
    base.grant_type = 'password';
    base.username = p.getProperty('SF_USER');
    base.password = p.getProperty('SF_PASS');
  }
  return base;
}

/** Say what the error means for the flow actually in use, rather than repeating
 *  advice about a security token to somebody who is not using one. */
function sfkAuthHint_(body) {
  var cc = sfkAuthMode_() === 'client_credentials';
  if (body.indexOf('invalid_client') > -1)
    return 'The Consumer Key or Secret is wrong, or the app has not finished ' +
           'propagating yet — Salesforce needs about ten minutes after you save it.';
  if (body.indexOf('inactive user') > -1 || body.indexOf('inactive org') > -1)
    return cc ? 'The Run As user on the app is inactive.' : 'That login is disabled.';
  if (body.indexOf('unsupported_grant_type') > -1)
    return cc ? 'Tick "Enable Client Credentials Flow" on the app.'
              : 'This org has retired the username-password flow. Use client credentials.';
  if (body.indexOf('invalid_grant') > -1) {
    return cc
      ? 'Client credentials needs a Run As user. Open the app, Policies, and set ' +
        '"Run As" to a user with API access — without one Salesforce has no ' +
        'identity to issue the token for.'
      : 'The key was accepted and the credentials refused. Check Login History ' +
        'in Setup: if it says "Username-Password Flow Disabled" then no password ' +
        'will work and you want client credentials instead.';
  }
  return 'Run sfLoginCheck() to see each part tested separately.';
}

function sfkToken_() {
  var p = sfkProps_();
  var cached = p.getProperty('SFK_TOKEN'), when = Number(p.getProperty('SFK_TOKEN_AT') || 0);
  if (cached && (new Date().getTime() - when) < 50 * 60 * 1000) return JSON.parse(cached);

  var res = UrlFetchApp.fetch(sfkLoginUrl_() + '/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true, payload: sfkAuthPayload_()
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Salesforce login failed: ' + res.getContentText() +
      '\n\n' + sfkAuthHint_(res.getContentText()));
  }
  var tok = JSON.parse(res.getContentText());
  p.setProperty('SFK_TOKEN', JSON.stringify(tok));
  p.setProperty('SFK_TOKEN_AT', String(new Date().getTime()));
  return tok;
}

function sfkQuery_(soql) {
  var tok = sfkToken_();
  var url = tok.instance_url + '/services/data/' + SFK.API + '/query?q=' + encodeURIComponent(soql);
  var out = [], guard = 0;
  while (url && guard++ < 40) {
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok.access_token }
    });
    if (res.getResponseCode() === 401) {
      sfkProps_().deleteProperty('SFK_TOKEN');
      tok = sfkToken_();
      continue;
    }
    if (res.getResponseCode() !== 200) throw new Error('Salesforce query failed: ' + res.getContentText());
    var j = JSON.parse(res.getContentText());
    out = out.concat(j.records || []);
    url = j.nextRecordsUrl ? tok.instance_url + j.nextRecordsUrl : null;
  }
  return out;
}

/** Branch staff, matched to their Salesforce user by email.
 *
 *  Three traps live here, all real in this org. Kamla has two user records on
 *  the same address and only kdookran@gloc.biz is active; a user can be flagged
 *  inactive while still owning this month's work; and ricky.rampersad@ is
 *  shared by five users, four of them active Site Guest Users that own nothing
 *  — the real account, owning 5,934 tasks, is the one SOQL returns last.
 *
 *  So: drop guests by UserType, which is what actually says so, rather than by
 *  a name that can be edited; then prefer the active record, but never drop
 *  somebody just because the flag says inactive. */
function sfkUsers_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('sfk_users');
  if (hit) return JSON.parse(hit);

  var emails = roster_().filter(function (p) { return p.email; })
    .map(function (p) { return "'" + p.email.replace(/'/g, "\\'") + "'"; });
  if (!emails.length) return {};

  var recs = sfkQuery_(
    'SELECT Id, Name, Email, IsActive, UserType FROM User WHERE Email IN (' + emails.join(',') + ')');

  var byStaff = {};
  roster_().forEach(function (p) {
    var mine = recs.filter(function (r) {
      return normEmail_(r.Email) === normEmail_(p.email) &&
             r.UserType !== 'Guest' && !/Site Guest User/i.test(r.Name || '');
    });
    if (!mine.length) return;
    var pick = mine.filter(function (r) { return r.IsActive; })[0] || mine[0];
    byStaff[p.staffId] = { id: pick.Id, name: pick.Name, active: !!pick.IsActive, all: mine.length };
  });

  cache.put('sfk_users', JSON.stringify(byStaff), 3600);
  return byStaff;
}

function sfkCount_(soql) {
  var r = sfkQuery_(soql);
  return r.length ? Number(r[0].expr0 || 0) : 0;
}

/** Everyone's task position, in one round trip per question rather than one
 *  per person. Cached for a few minutes so a page refresh is not a new query. */
/** What this person is allowed to see of the branch's Salesforce position.
 *
 *  Everyone gets the per-type roll-up and their own card. Only the manager
 *  gets everyone's cards. This used to be decided in two places that
 *  disagreed — the metrics action filtered and the rows action did not — so
 *  the filtering was doing nothing. One function now, called by both.
 */
function metricsFor_(profile, date) {
  var m = sfkMetricsSafe_(date);
  if (!m || !m.ok || profile.manager) return m;
  var only = {};
  if (m.staff && m.staff[profile.staffId]) only[profile.staffId] = m.staff[profile.staffId];
  // The same cut for the period figures: your own week, month and year, and
  // the branch's, but not the person's at the next desk.
  var periods = null;
  if (m.periods) {
    var mine = {};
    if (m.periods.staff && m.periods.staff[profile.staffId]) mine[profile.staffId] = m.periods.staff[profile.staffId];
    periods = { staff: mine, branch: m.periods.branch };
  }
  return { ok: true, date: m.date, staff: only, branch: m.branch, periods: periods };
}

/* How long an open task can sit untouched before it stops being work in
   progress and becomes work again.

   Seven days, and it is the most useful number in this file. Kamla holds
   seventy open tasks and nine of them have not been touched in a week; Sasha
   holds thirty-seven and the same nine. Elizabeth holds six and none. The open
   count frightens people and tells them nothing about their morning — "you
   have thirty-seven" and "three of these need you" are the same book read two
   ways, and only one of them can be acted on. */
var STALE_DAYS = 7;

/* The window the rate is measured over, and roughly how many working days
   fall inside it. Sixty calendar days is about forty-three working ones. */
var RATE_DAYS = 60, RATE_WORKING_DAYS = 43;

/* A working day of case work. Eight to four less an hour for lunch — not
   everybody's day, and it is only ever used to turn a per-day rate into "how
   many of these fit in a focused couple of hours". Precision here would be
   false: Salesforce records WHEN a task was closed, never how long it took. */
var WORK_HOURS = 7;

/* Under this many closures in the window, the rate is noise and no estimate is
   offered at all. Two closures in sixty days is not a measurement, and a tool
   that dresses one up as one gets stopped being believed. */
var RATE_MIN_SAMPLE = 8;

function sfkMetrics_(date) {
  var day = date || todayISO_();
  var cache = CacheService.getScriptCache();
  var key = 'sfk_m_' + day;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var users = sfkUsers_();
  var ids = Object.keys(users).map(function (k) { return "'" + users[k].id + "'"; });
  if (!ids.length) return { ok: false, error: 'No branch staff matched a Salesforce user.' };
  var IN = '(' + ids.join(',') + ')';
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  function blank() {
    return { closed: 0, open: 0, overdue: 0, aged60: 0, noDate: 0, needs: 0, touched: 0, byType: {},
             eveClosed: 0, eveTouched: 0 };
  }
  var out = {};
  Object.keys(users).forEach(function (k) { out[k] = blank(); });

  function add(recs, field, typed) {
    recs.forEach(function (r) {
      var sid = byId[r.OwnerId];
      if (!sid) return;
      var n = Number(r.expr0 || 0);
      out[sid][field] += n;
      if (typed) {
        var t = r.Task_Type__c || 'Untyped';
        out[sid].byType[t] = out[sid].byType[t] ||
          { closed: 0, open: 0, overdue: 0, needs: 0, touched: 0 };
        out[sid].byType[t][field] += n;
      }
    });
  }

  // The branch day in Salesforce's clock. Port of Spain is UTC-4 all year —
  // no daylight saving — so local midnight is 04:00Z, and a day that starts
  // at T00:00:00Z starts at 8pm the evening before. Until 16 September 2026
  // "closed today" used that UTC window, so anything closed after 8pm sat in
  // tomorrow's column and anything closed before 8pm yesterday sat in
  // today's. Every window below is a local day.
  var dayFrom = day + 'T04:00:00Z', dayTo = shiftDays_(day, 1) + 'T04:00:00Z';

  // Closed on the day itself.
  //
  // This is the time the task was COMPLETED, not the time it was last edited.
  // The old query asked for completed tasks with a LastModifiedDate today,
  // which counted a task closed in March and re-saved this morning as closed
  // today, and missed nothing else in a way anybody could see — so it stood
  // for months. CompletedDateTime is populated on every completed task in
  // this org. The birthday automation is left out, as it is everywhere else
  // a closure is counted; a machine wishing 550 clients a happy birthday is
  // not a person's morning.
  add(sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    ' AND CompletedDateTime >= ' + dayFrom + ' AND CompletedDateTime < ' + dayTo +
    " AND (NOT Subject LIKE '%Happy Birthday%') " +
    'GROUP BY OwnerId, Task_Type__c'), 'closed', true);

  // Touched on the day, per type — every task this person saved today,
  // closed or not. The wall's live feed had this and the per-person position
  // did not, so the block screen could say "closed 0" of a morning spent
  // moving forty pendings along. Same local-day window as the closures.
  add(sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    ' AND LastModifiedDate >= ' + dayFrom + ' AND LastModifiedDate < ' + dayTo +
    ' GROUP BY OwnerId, Task_Type__c'), 'touched', true);

  // AFTER HOURS. "Extend the block beyond 4pm — I work round the clock, and it
  // should reflect 24/7 so people can see what is being done" (17 September).
  // The day's four blocks are filed; this one is measured: what Salesforce saw
  // each desk close and touch from four in the afternoon to midnight, local.
  // 16:00 in Port of Spain is 20:00Z, no DST. Anything after midnight is the
  // next day's first block, which is where the day so far already starts.
  // Guarded like the period windows: an evening read that fails leaves the
  // after-hours block empty, not the day.
  var eveFrom = day + 'T20:00:00Z';
  try {
    add(sfkQuery_(
      'SELECT OwnerId, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
      ' AND CompletedDateTime >= ' + eveFrom + ' AND CompletedDateTime < ' + dayTo +
      " AND (NOT Subject LIKE '%Happy Birthday%') " +
      'GROUP BY OwnerId'), 'eveClosed', false);
    add(sfkQuery_(
      'SELECT OwnerId, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
      ' AND LastModifiedDate >= ' + eveFrom + ' AND LastModifiedDate < ' + dayTo +
      ' GROUP BY OwnerId'), 'eveTouched', false);
  } catch (eEve) {}

  // Still open, whatever the due date
  add(sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    " AND Status != 'Completed' GROUP BY OwnerId, Task_Type__c"), 'open', true);

  // Open and already past due
  add(sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    " AND Status != 'Completed' AND ActivityDate < " + day +
    ' GROUP BY OwnerId, Task_Type__c'), 'overdue', true);

  // Open, and not touched in a week.
  //
  // This is the one that decides what the morning is actually for. An open
  // task modified yesterday is in somebody's hands; the same task untouched
  // for three weeks is not, whatever its due date says. Age cannot tell those
  // two apart and the open count certainly cannot.
  add(sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    " AND Status != 'Completed' AND LastModifiedDate < LAST_N_DAYS:" + STALE_DAYS +
    ' GROUP BY OwnerId, Task_Type__c'), 'needs', true);

  // Open with no due date at all. These can never be overdue, so they never
  // appear in an overdue report — they simply sit there. Worth seeing.
  add(sfkQuery_(
    'SELECT OwnerId, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    " AND Status != 'Completed' AND ActivityDate = NULL GROUP BY OwnerId"), 'noDate', false);

  // Open, past due, and sixty days or more old
  add(sfkQuery_(
    'SELECT OwnerId, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    " AND Status != 'Completed' AND ActivityDate < " + shiftDays_(day, -60) +
    ' GROUP BY OwnerId'), 'aged60', false);

  // How many of each person's overdue tasks carry no reason.
  try {
    var nr = sfkNeedsReason_(day);
    Object.keys(out).forEach(function (k) { out[k].needsReason = (nr[k] || []).length; });
  } catch (e) { /* the position is still worth returning without it */ }

  // What this person actually gets through, per type, from their own history.
  //
  // Sasha closed 401 renewals and 40 pendings in the same sixty days. Same
  // person, same desk, ten times the rate — a renewal is a send-and-file and a
  // pending is real work. Nothing in the branch has ever seen that difference,
  // so every block got the same two hours regardless.
  //
  // Bulk servicing runs are measured on their own line and not in this one.
  // That is not the exclusion this file made before and then had to undo: the
  // servicing book is counted in full, in `closed` and on the wall. It is kept
  // out of THIS number because this number sizes hand work, and an automation
  // that contacts 550 clients at once would say a person clears nine servicing
  // tasks an hour. Two kinds of work, two measurements — mixing them is the
  // mistake, in either direction.
  try {
    var rate = {};
    sfkQuery_(
      'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
      " AND Status = 'Completed' AND LastModifiedDate = LAST_N_DAYS:" + RATE_DAYS +
      " AND (NOT Subject LIKE '%Happy Birthday%') " +
      'GROUP BY OwnerId, Task_Type__c').forEach(function (r) {
        var sid = byId[r.OwnerId];
        if (!sid) return;
        (rate[sid] = rate[sid] || {})[r.Task_Type__c || 'Untyped'] = Number(r.expr0 || 0);
      });
    Object.keys(out).forEach(function (sid) {
      var mine = rate[sid] || {};
      var total = 0;

      // Per type, this is VOLUME and nothing else: how much of this kind of
      // work this person happens to do. It is shown as context and must never
      // be divided into a backlog to make a time.
      //
      // Dividing by it is wrong and the branch's own numbers say so. Azariah
      // closed 26 renewals in sixty days, so her per-type renewal rate is 0.6
      // a day — divide her three untouched renewals by that and the screen
      // claims thirty-five hours. It does not take her thirty-five hours. She
      // simply does not spend her week on renewals.
      out[sid].rate = {};
      Object.keys(mine).forEach(function (t) {
        total += mine[t];
        out[sid].rate[t] = { closed: mine[t], days: RATE_DAYS };
      });

      // The time estimate comes from the whole desk instead: what this person
      // actually clears in a working day, across everything. Sasha 17 a day,
      // Kamla 3 — and Kamla's three is not slowness, it is that her work is
      // escalations and licensing while Sasha's is renewals. Sizing a morning
      // against a person's own overall pace is defensible. Claiming to know
      // the minutes in one licensing email is not.
      out[sid].rateAll = {
        closed: total,
        days: RATE_DAYS,
        enough: total >= RATE_MIN_SAMPLE,
        perDay: Math.round((total / RATE_WORKING_DAYS) * 100) / 100,
        perHour: Math.round((total / RATE_WORKING_DAYS / WORK_HOURS) * 100) / 100
      };
    });
  } catch (e) { /* the position is still worth returning without a rate */ }

  // The branch's position per task type, with who holds it. Everyone sees this
  // — it is the answer to "my block is licensing and there are three of them,
  // is that the whole picture or my corner of it". Names are already on the
  // wall in the office, so this is not new exposure; what it replaces is
  // walking over to ask.
  //
  // The per-person cards below carry more (closed today, 60-day ageing, tasks
  // with no due date) and stay manager-only.
  var branch = { byType: {} };
  Object.keys(out).forEach(function (sid) {
    var name = (users[sid] && users[sid].name) || sid;
    Object.keys(out[sid].byType || {}).forEach(function (t) {
      var src = out[sid].byType[t];
      var b = branch.byType[t] ||
        (branch.byType[t] = { open: 0, overdue: 0, closed: 0, needs: 0, touched: 0, who: [] });
      b.open += src.open || 0;
      b.overdue += src.overdue || 0;
      b.closed += src.closed || 0;
      b.needs += src.needs || 0;
      b.touched += src.touched || 0;
      if (src.open || src.overdue) {
        b.who.push({ n: name, open: src.open || 0, overdue: src.overdue || 0 });
      }
    });
  });
  Object.keys(branch.byType).forEach(function (t) {
    branch.byType[t].who.sort(function (a, b) { return b.open - a.open; });
  });

  var res = { ok: true, date: day, staff: out, users: users, branch: branch };
  cache.put(key, JSON.stringify(res), SFK.CACHE_MIN * 60);
  return res;
}

/** Overdue tasks with nothing in Task_Update_Reason__c.
 *
 *  The branch built that field for exactly this: when a due date passes, the
 *  owner says why. It is filled on 5% of overdue tasks. So the number is only
 *  half the story — an overdue task with a reason is work in progress, and an
 *  overdue task without one is a task nobody has looked at. The app should
 *  tell people which of theirs are which, by name, so the answer is a
 *  sentence rather than a search. */
function sfkNeedsReason_(date) {
  var day = date || todayISO_();
  var cache = CacheService.getScriptCache();
  var key = 'sfk_nr_' + day;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var users = sfkUsers_();
  var ids = Object.keys(users).map(function (k) { return "'" + users[k].id + "'"; });
  if (!ids.length) return {};
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  // Agent__c is who the work is for. It is set on about six in ten open
  // tasks, and until now nothing has ever shown it to the person doing the
  // work — so "six of these are for one agent" was never a thing anyone
  // could see, and chasing them one at a time was the only option.
  var recs = sfkQuery_(
    'SELECT Id, OwnerId, Subject, Status, Task_Type__c, ActivityDate, Days_O_S__c, ' +
    'Agent__r.Name ' +
    'FROM Task WHERE OwnerId IN (' + ids.join(',') + ") AND Status != 'Completed' " +
    'AND ActivityDate < ' + day + ' AND Task_Update_Reason_c__c = NULL ' +
    'ORDER BY Days_O_S__c DESC NULLS LAST LIMIT 400');

  var out = {};
  recs.forEach(function (r) {
    var sid = byId[r.OwnerId];
    if (!sid) return;
    (out[sid] = out[sid] || []).push({
      id: r.Id, subject: r.Subject, status: r.Status,
      type: r.Task_Type__c || 'No type', due: r.ActivityDate,
      age: Number(r.Days_O_S__c || 0),
      agent: (r.Agent__r && r.Agent__r.Name) || '',
      rank: rankOf_(r.Agent__r && r.Agent__r.Name),
      'for': rankLabel_(rankOf_(r.Agent__r && r.Agent__r.Name))
    });
  });
  Object.keys(out).forEach(function (sid) {
    out[sid].sort(function (a, b) { return a.rank !== b.rank ? a.rank - b.rank : b.age - a.age; });
  });
  cache.put(key, JSON.stringify(out), SFK.CACHE_MIN * 60);
  return out;
}

// ---------------------------------------------------------------------------
//  The open book
//
//  Every other Salesforce read here counts. This one names.
//
//  The morning screen told a person how many tasks they held and not one of
//  their titles, because the only list it had was overdue-with-no-reason.
//  Three of the four support staff carry no overdue at all — their work is
//  dated ahead, not late — so three of the four opened the tracker to a
//  scoreboard: "Pendings · 16 open", and nothing to act on. A number you
//  cannot click is not an assignment.
//
//  So: the whole open book, grouped by the type it is filed under, in the
//  order it falls due. The same shape for everybody, whether their book is
//  late or clean.
// ---------------------------------------------------------------------------

/* Subjects carry a policy number, a client and sometimes a branch. They are
   read in a list, not a document, so they are bounded here rather than in the
   browser — the whole book goes through CacheService, which stops at 100KB,
   and one unbounded field is all it takes to silently lose the cache. */
var OPEN_SUBJECT_MAX = 110;

function sfkOpenBook_(date) {
  var day = date || todayISO_();
  var cache = CacheService.getScriptCache();
  var key = 'sfk_ob_' + day;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var users = sfkUsers_();
  var ids = Object.keys(users).map(function (k) { return "'" + users[k].id + "'"; });
  if (!ids.length) return {};
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  var recs = sfkQuery_(
    'SELECT Id, OwnerId, Subject, Status, Task_Type__c, ActivityDate, Days_O_S__c, ' +
    'LastModifiedDate, Agent__r.Name, What.Name, Task_Update_Reason_c__c ' +
    'FROM Task WHERE OwnerId IN (' + ids.join(',') + ") AND Status != 'Completed' " +
    'ORDER BY ActivityDate ASC NULLS LAST LIMIT 600');

  var out = {};
  recs.forEach(function (r) {
    var sid = byId[r.OwnerId];
    if (!sid) return;
    var type = r.Task_Type__c || 'Untyped';
    var book = out[sid] || (out[sid] = {});
    (book[type] = book[type] || []).push({
      id: r.Id,
      subject: shorten_(r.Subject, OPEN_SUBJECT_MAX),
      status: r.Status || '',
      due: r.ActivityDate || '',
      // Compared against the branch's own day, not the browser's. A phone in
      // another timezone must not colour Monday's work red on Sunday night.
      late: !!(r.ActivityDate && r.ActivityDate < day),
      age: Number(r.Days_O_S__c || 0),
      // When it was last actually done, which is a different question from how
      // old it is. A forty-day task worked yesterday is in hand; a nine-day
      // task nobody has opened in three weeks is not.
      touched: daysSince_(r.LastModifiedDate),
      needs: daysSince_(r.LastModifiedDate) >= STALE_DAYS,
      agent: (r.Agent__r && r.Agent__r.Name) || '',
      rank: rankOf_(r.Agent__r && r.Agent__r.Name),
      'for': rankLabel_(rankOf_(r.Agent__r && r.Agent__r.Name)),
      account: (r.What && r.What.Name) || '',
      hasReason: !!String(r.Task_Update_Reason_c__c || '').trim()
    });
  });

  // The ones nobody has touched come first — this list is a queue, and the
  // top of it should be the work that is actually waiting. Within that, the
  // earliest due date. A task with no date sorts last rather than first: it
  // has no claim on today over one that has a date and has passed it.
  Object.keys(out).forEach(function (sid) {
    Object.keys(out[sid]).forEach(function (t) { orderBook_(out[sid][t]); });
  });

  // A book that will not fit the cache is still a book. Serve it, just do not
  // remember it — the alternative is throwing away the whole read.
  try { cache.put(key, JSON.stringify(out), SFK.CACHE_MIN * 60); } catch (e) {}
  return out;
}

function sfkOpenBookSafe_(date) {
  if (!sfkConfigured_()) return {};
  try { return sfkOpenBook_(date); } catch (e) { return {}; }
}

/** Who may see whose book. The same rule as metricsFor_, and deliberately in
 *  one place: staff see their own, the Branch Manager sees the branch. Two
 *  functions deciding this separately is what made the filtering a no-op the
 *  first time. */
function openBookFor_(profile, date) {
  return onlyMine_(sfkOpenBookSafe_(date), profile);
}

/* Every one of these reads is keyed by staffId and every one of them is
   filtered by the same rule, so the rule is written once.

   It was not, and the cost was real: the `metrics` action filtered while the
   `rows` response did not, so the filtering did nothing at all until that was
   found. needsReason and billing were left behind by that fix and carried the
   same hole for longer — the rows response has been handing every member of
   staff the whole branch's overdue and billing books, client names and policy
   numbers included, on every sign-in. Nobody noticed because the screen only
   ever renders your own.

   A screen that does not draw the data is not the same thing as a server that
   does not send it. */
function onlyMine_(byStaff, profile) {
  if (profile.manager) return byStaff;
  var mine = {};
  if (byStaff && byStaff[profile.staffId]) mine[profile.staffId] = byStaff[profile.staffId];
  return mine;
}

function needsReasonFor_(profile, date) {
  return onlyMine_(sfkNeedsReasonSafe_(date), profile);
}

function billingFor_(profile, date) {
  return onlyMine_(sfkBillingCheckSafe_(date), profile);
}

// ---------------------------------------------------------------------------
//  Performance: the form, the evidence, and the two halves
//
//  Guardian's Performance Evaluation form (Administration v8.3) has three
//  parts: weighted performance goals rated 1 to 5, eight behavioural
//  competencies rated 1 to 5, and development goals on the 70-20-10 model.
//  A signed one for this branch showed the arithmetic exactly: a goal scores
//  weight x rating / 4, so "Meets Expectations" is the whole weight and a 5
//  is a quarter over; competencies are the mean rating / 4; and the overall
//  rating is 80% goals and 20% competencies, against a minimum of 72.
//
//  What this adds to that paper is evidence. The ten goals for a Sales
//  Support Assistant are the same work the tracker already counts — new
//  applications, premium dues, contracts and scripts, mail by three,
//  reporting — so for any review period the daily record can say, per goal:
//  blocks worked and how many landed, tasks of that kind closed in the
//  period, and what is open, untouched or late right now. That sits beside
//  the goal. The rating is still a person's; the evidence is what they rate
//  against instead of recollection.
//
//  Two rules that are not conveniences. The form's contents are Guardian's
//  HR papers and live in the workbook, never in this public repository, so
//  the goals and the dictionary are read from tabs and their absence is a
//  plain answer. And each side writes its own half and only its own half —
//  a review where the People Leader can edit the self-assessment is not a
//  self-assessment. The People Leader is whoever the person reports to.
// ---------------------------------------------------------------------------

var HR = {
  GOALS:     { must: ['Role', 'Goal', 'Weight'],          name: 'Goals' },
  COMPS:     { must: ['Competency', 'Definition'],        name: 'Competencies' },
  REVIEWS:   { must: ['ReviewId', 'StaffId', 'Type'],     name: 'Reviews',
               head: ['ReviewId', 'StaffId', 'Type', 'From', 'To', 'Status', 'OpenedBy',
                      'SelfComment', 'PLComment', 'SelfSignedAt', 'PLSignedAt', 'CreatedAt', 'UpdatedAt'] },
  RGOALS:    { must: ['ReviewId', 'Goal', 'SelfRating'],  name: 'Review Goals',
               head: ['ReviewId', 'Goal', 'Actual', 'SelfRating', 'SelfNote', 'PLRating', 'PLNote', 'UpdatedAt'] },
  RCOMPS:    { must: ['ReviewId', 'Competency', 'SelfRating'], name: 'Review Competencies',
               head: ['ReviewId', 'Competency', 'SelfRating', 'SelfNote', 'PLRating', 'PLNote', 'UpdatedAt'] },
  DEVELOP:   { must: ['StaffId', 'Source', 'Action'],     name: 'Development',
               head: ['DevId', 'StaffId', 'ReviewId', 'Source', 'Action', 'Why', 'Success', 'Status', 'UpdatedAt'] },
  TRAINING:  { must: ['StaffId', 'Activity', 'Objective'], name: 'Training Plan',
               head: ['StaffId', 'Order', 'Activity', 'Objective', 'Facilitator', 'Dates', 'Venue',
                      'Evidence', 'Evaluation', 'SignedOff', 'UpdatedAt'] }
};

/* The form's own numbers. Not tunable from the browser: they are Guardian's. */
var OPR_GOALS_SHARE = 0.8, OPR_COMPS_SHARE = 0.2, OPR_MIN = 0.72, RATING_FULL = 4;

/* The assessment types on the form, plus the branch's quarterly rhythm. */
var REVIEW_TYPES = ['Mid Probation', 'End of Probation', 'Quarterly', 'Mid Year', 'End of Year',
                    'End of Contract'];

var SOURCES = ['Experiential', 'Social', 'Formal'];

/** A tab the app writes is created on first use. A tab the branch pastes in
 *  (Goals, Competencies) is not — an empty one would read as "no goals", which
 *  is a different thing from "not set up yet". */
function hrTab_(spec, create) {
  var sh = findTabBy_(spec.must);
  if (sh || !create) return sh;
  sh = ss_().insertSheet(spec.name);
  sh.appendRow(spec.head);
  sh.setFrozenRows(1);
  return rememberTab_(spec.must, sh);
}

var _hrMemo = {};
function hrRows_(spec, create) {
  var k = spec.name;
  if (_hrMemo[k]) return _hrMemo[k];
  var sh = hrTab_(spec, create);
  return (_hrMemo[k] = sh ? sheetObjects_(sh) : null);
}
function forgetHr_(spec) { delete _hrMemo[spec.name]; }

function goalsFor_(role) {
  var rows = hrRows_(HR.GOALS, false);
  if (!rows) return null;
  var r = String(role || '').trim().toLowerCase();
  return rows.filter(function (g) { return String(g.Role || '').trim().toLowerCase() === r; })
    .sort(function (a, b) { return (Number(a.Order) || 0) - (Number(b.Order) || 0); })
    .map(function (g) {
      return { goal: String(g.Goal || ''), description: String(g.Description || ''),
               targetType: String(g.TargetType || ''), weight: Number(g.Weight) || 0,
               target: g.Target === '' || g.Target == null ? '' : Number(g.Target),
               kpiTypes: String(g.KpiTypes || '').split(',').map(function (t) { return t.trim(); }).filter(String) };
    });
}

function competencies_() {
  var rows = hrRows_(HR.COMPS, false);
  if (!rows) return null;
  return rows.filter(function (c) { return String(c.Competency || '').trim(); })
    .sort(function (a, b) { return (Number(a.Order) || 0) - (Number(b.Order) || 0); })
    .map(function (c) {
      return { competency: String(c.Competency), definition: String(c.Definition || ''),
               behaviours: String(c.Behaviours || '').split(/\s*·\s*|\n/).map(function (b) { return b.trim(); }).filter(String) };
    });
}

// ---- who may see and write what -------------------------------------------

/** Who this person is People Leader to. The Branch Manager leads everyone. */
function leads_(profile) {
  var all = publicRoster_().map(function (p) { return p.staffId; });
  if (profile.manager) return all.filter(function (s) { return s !== profile.staffId; });
  return all.filter(function (s) { return REPORTS_TO[s] === profile.staffId; });
}
function isLeadOf_(profile, staffId) {
  return staffId !== profile.staffId && leads_(profile).indexOf(staffId) > -1;
}
function canSee_(profile, staffId) {
  return staffId === profile.staffId || isLeadOf_(profile, staffId);
}
/** Which half a person writes on somebody's review: their own, their report's, or none. */
function sideFor_(profile, staffId) {
  if (staffId === profile.staffId) return 'self';
  if (isLeadOf_(profile, staffId)) return 'pl';
  return '';
}

// ---- the evidence -----------------------------------------------------------

/** Tasks closed in a period, by type, for one person. Cached by the period,
 *  so a review page does not re-ask Salesforce on every rating saved. */
function sfkClosedInPeriod_(staffId, from, to) {
  var users = sfkUsers_();
  var u = users[staffId];
  if (!u) return {};
  var cache = CacheService.getScriptCache();
  var key = 'sfk_cp_' + staffId + '_' + from + '_' + to;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var out = {};
  sfkQuery_("SELECT Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId = '" + u.id + "' " +
    "AND Status = 'Completed' AND LastModifiedDate >= " + from + 'T00:00:00Z AND LastModifiedDate < ' +
    to + "T00:00:00Z AND (NOT Subject LIKE '%Happy Birthday%') GROUP BY Task_Type__c")
    .forEach(function (r) { out[r.Task_Type__c || 'Untyped'] = Number(r.expr0 || 0); });
  try { cache.put(key, JSON.stringify(out), SFK.CACHE_MIN * 60); } catch (e) {}
  return out;
}
function sfkClosedInPeriodSafe_(staffId, from, to) {
  if (!sfkConfigured_()) return null;
  try { return sfkClosedInPeriod_(staffId, from, to); } catch (e) { return null; }
}

/** What the record says about one goal over a period. Nothing here is a
 *  rating. It is what the person and the People Leader rate against. */
function goalEvidence_(staffId, from, to, kpiTypes, entries, closedByType, nowByType) {
  var types = {};
  (kpiTypes || []).forEach(function (t) { types[t] = 1; });
  var ev = { blocks: 0, planned: 0, met: { met: 0, partly: 0, no: 0 }, lines: [],
             closed: null, open: null, needs: null, late: null };
  entries.forEach(function (r) {
    BLOCK_IDS.forEach(function (p) {
      var picked = String(r[p] || '').split(',').map(function (t) { return t.trim(); });
      if (!picked.some(function (t) { return types[t]; })) return;
      ev.blocks++;
      ev.planned += Number(r[p + '_Plan']) || 0;
      var m = String(r[p + '_Met'] || '').trim();
      if (ev.met[m] != null) ev.met[m]++;
      var a = String(r[p + '_Actioned'] || '').trim();
      if (a && ev.lines.length < 3) ev.lines.push({ date: String(r.Date).slice(0, 10), text: a.slice(0, 140) });
    });
  });
  if (closedByType) {
    ev.closed = 0;
    Object.keys(types).forEach(function (t) { ev.closed += closedByType[t] || 0; });
  }
  if (nowByType) {
    ev.open = 0; ev.needs = 0; ev.late = 0;
    Object.keys(types).forEach(function (t) {
      var b = nowByType[t]; if (!b) return;
      ev.open += b.open || 0; ev.needs += b.needs || 0; ev.late += b.overdue || 0;
    });
  }
  return ev;
}

// ---- the arithmetic, exactly as the form does it ---------------------------

function ratingNum_(v) { var n = Number(String(v || '').trim()); return n >= 1 && n <= 5 ? n : 0; }

/** goals: [{weight, selfRating, plRating}]  comps: [{selfRating, plRating}] */
function scoreReview_(goals, comps) {
  function side(k) {
    var goal = 0, wsum = 0, rated = 0;
    goals.forEach(function (g) {
      var r = ratingNum_(g[k]);
      wsum += g.weight || 0;
      if (r) { rated++; goal += (g.weight || 0) / 100 * r / RATING_FULL; }
    });
    var csum = 0, cn = 0;
    comps.forEach(function (c) { var r = ratingNum_(c[k]); if (r) { csum += r; cn++; } });
    var comp = cn ? (csum / cn) / RATING_FULL : 0;
    var opr = OPR_GOALS_SHARE * goal + OPR_COMPS_SHARE * comp;
    return { goalScore: round4_(goal), compScore: round4_(comp), opr: round4_(opr),
             goalsRated: rated, goalsTotal: goals.length, compsRated: cn, compsTotal: comps.length,
             weightsSum: wsum, meetsStandard: opr >= OPR_MIN };
  }
  return { self: side('selfRating'), pl: side('plRating'), standard: OPR_MIN };
}
function round4_(x) { return Math.round(x * 10000) / 10000; }

// ---- reviews ------------------------------------------------------------------

function reviewsFor_(profile, staffId) {
  if (!canSee_(profile, staffId)) return [];
  var rows = hrRows_(HR.REVIEWS, true) || [];
  return rows.filter(function (r) { return String(r.StaffId) === staffId; })
    .map(function (r) { return reviewHeader_(r); })
    .sort(function (a, b) { return String(b.from).localeCompare(String(a.from)); });
}
function reviewHeader_(r) {
  return { id: String(r.ReviewId), staffId: String(r.StaffId), type: String(r.Type || ''),
           from: isoDay_(r.From), to: isoDay_(r.To), status: String(r.Status || 'open'),
           selfSigned: r.SelfSignedAt ? String(r.SelfSignedAt) : '',
           plSigned: r.PLSignedAt ? String(r.PLSignedAt) : '' };
}
function findReview_(reviewId) {
  var rows = hrRows_(HR.REVIEWS, true) || [];
  for (var i = 0; i < rows.length; i++) if (String(rows[i].ReviewId) === String(reviewId)) return rows[i];
  return null;
}

/** The People Leader opens a review for somebody they lead. */
function openReview_(data, profile) {
  var staffId = String(data.staffId || '');
  if (!isLeadOf_(profile, staffId)) return { ok: false, error: 'Only the People Leader opens a review.' };
  var type = String(data.type || '').trim();
  if (REVIEW_TYPES.indexOf(type) === -1) return { ok: false, error: 'Which kind of review? ' + REVIEW_TYPES.join(', ') + '.' };
  var from = isoDay_(data.from), to = isoDay_(data.to);
  if (!from || !to || to <= from) return { ok: false, error: 'The period needs a start and an end, in that order.' };
  var id = staffId + '-' + from + '-' + type.toLowerCase().replace(/[^a-z]+/g, '-');
  if (findReview_(id)) return { ok: true, id: id, existed: true };
  /* Stamped before the lock, so it is true even while this submission is
     queued behind another one. The wall's rebuild reads it and stands
     down; nothing a member of staff does waits on the wall. */
  markStaffWrite_();
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    var sh = hrTab_(HR.REVIEWS, true), now = new Date();
    var o = { ReviewId: id, StaffId: staffId, Type: type, From: from, To: to, Status: 'open',
              OpenedBy: profile.staffId, CreatedAt: now, UpdatedAt: now };
    sh.appendRow(HR.REVIEWS.head.map(function (h) { return o[h] != null ? o[h] : ''; }));
    forgetHr_(HR.REVIEWS);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

/** One review, whole: the goals with their evidence and both halves, the
 *  competencies with the dictionary and both halves, development actions,
 *  the training plan, and the scores. */
function review_(profile, reviewId) {
  var r = findReview_(reviewId);
  if (!r) return { ok: false, error: 'No such review.' };
  var staffId = String(r.StaffId);
  if (!canSee_(profile, staffId)) return { ok: false, error: 'Not yours to see.' };
  var head = reviewHeader_(r);
  var role = roleFor_id_(staffId);
  var goals = goalsFor_(role), comps = competencies_();
  if (!goals) return { ok: false, error: 'No "Goals" tab in the workbook yet. Paste the goals for each role into it.' };
  if (!comps) return { ok: false, error: 'No "Competencies" tab in the workbook yet.' };
  if (!goals.length) return { ok: false, error: 'No goals on the Goals tab for role "' + role + '".' };

  var entries = allEntries_().filter(function (e) {
    var d = String(e.Date || '').slice(0, 10);
    return String(e.StaffId) === staffId && d >= head.from && d < head.to;
  });
  var closed = sfkClosedInPeriodSafe_(staffId, head.from, head.to);
  var mm = sfkMetricsSafe_();
  var nowByType = (mm && mm.ok && mm.staff && mm.staff[staffId] && mm.staff[staffId].byType) || null;

  var savedG = {};
  (hrRows_(HR.RGOALS, true) || []).forEach(function (x) { if (String(x.ReviewId) === head.id) savedG[String(x.Goal)] = x; });
  var savedC = {};
  (hrRows_(HR.RCOMPS, true) || []).forEach(function (x) { if (String(x.ReviewId) === head.id) savedC[String(x.Competency)] = x; });

  var outGoals = goals.map(function (g) {
    var s = savedG[g.goal] || {};
    return { goal: g.goal, description: g.description, targetType: g.targetType, weight: g.weight,
             target: g.target, kpiTypes: g.kpiTypes,
             actual: s.Actual == null ? '' : String(s.Actual),
             selfRating: String(s.SelfRating || ''), selfNote: String(s.SelfNote || ''),
             plRating: String(s.PLRating || ''), plNote: String(s.PLNote || ''),
             evidence: goalEvidence_(staffId, head.from, head.to, g.kpiTypes, entries, closed, nowByType) };
  });
  var needsNow = (sfkNeedsReasonSafe_(todayISO_()) || {})[staffId] || null;
  var billingNow = ((sfkBillingCheckSafe_(todayISO_()) || {})[staffId] || {}).items || null;
  var facts = facts_(staffId, head.from, head.to, entries, closed,
                     (mm && mm.ok && mm.staff && mm.staff[staffId]) || null, needsNow, billingNow);
  var moments = momentsFor_(staffId, head.from, head.to);
  var outComps = comps.map(function (c) {
    var s = savedC[c.competency] || {};
    return { competency: c.competency, definition: c.definition, behaviours: c.behaviours,
             selfRating: String(s.SelfRating || ''), selfNote: String(s.SelfNote || ''),
             plRating: String(s.PLRating || ''), plNote: String(s.PLNote || ''),
             signals: competencySignals_(c.competency, facts), lines: competencyLines_(c.competency, facts),
             moments: moments.filter(function (m) { return m.competency === c.competency; }) };
  });
  var dev = (hrRows_(HR.DEVELOP, true) || []).filter(function (d) {
    return String(d.StaffId) === staffId && (!d.ReviewId || String(d.ReviewId) === head.id);
  }).map(devRow_);
  var training = trainingFor_(staffId);

  return { ok: true, review: head, role: role, side: sideFor_(profile, staffId),
           selfComment: String(r.SelfComment || ''), plComment: String(r.PLComment || ''),
           goals: outGoals, competencies: outComps, development: dev, training: training,
           scores: scoreReview_(outGoals, outComps), days: entries.length,
           salesforce: !!closed, types: REVIEW_TYPES, sources: SOURCES };
}

function devRow_(d) {
  return { id: String(d.DevId || ''), reviewId: String(d.ReviewId || ''), source: String(d.Source || ''),
           action: String(d.Action || ''), why: String(d.Why || ''), success: String(d.Success || ''),
           status: String(d.Status || 'planned') };
}
function trainingFor_(staffId) {
  return (hrRows_(HR.TRAINING, true) || []).filter(function (t) { return String(t.StaffId) === staffId; })
    .sort(function (a, b) { return (Number(a.Order) || 0) - (Number(b.Order) || 0); })
    .map(function (t) {
      return { order: Number(t.Order) || 0, activity: String(t.Activity || ''), objective: String(t.Objective || ''),
               facilitator: String(t.Facilitator || ''), dates: String(t.Dates || ''), venue: String(t.Venue || ''),
               evidence: String(t.Evidence || ''), evaluation: String(t.Evaluation || ''),
               signedOff: String(t.SignedOff || '') };
    });
}

/** Upsert one row of a review tab, writing only the columns the side owns. */
function writeHalf_(spec, keyCols, keyVals, patch) {
  /* Stamped before the lock, so it is true even while this submission is
     queued behind another one. The wall's rebuild reads it and stands
     down; nothing a member of staff does waits on the wall. */
  markStaffWrite_();
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    var sh = hrTab_(spec, true);
    var idx = colMap_(sh), rows = sheetObjects_(sh), at = -1;
    for (var i = 0; i < rows.length; i++) {
      var hit = keyCols.every(function (k, j) { return String(rows[i][k]) === String(keyVals[j]); });
      if (hit) { at = i + 2; break; }
    }
    patch.UpdatedAt = new Date();
    if (at < 0) {
      var o = {}; keyCols.forEach(function (k, j) { o[k] = keyVals[j]; });
      Object.keys(patch).forEach(function (k) { o[k] = patch[k]; });
      sh.appendRow(spec.head.map(function (h) { return o[h] != null ? o[h] : ''; }));
    } else {
      writeRow_(sh, at, idx, patch);
    }
    forgetHr_(spec);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** A rating and a note, on one goal or one competency, from one side. */
function saveReviewRating_(data, profile) {
  var r = findReview_(String(data.reviewId || ''));
  if (!r) return { ok: false, error: 'No such review.' };
  if (String(r.Status) === 'signed') return { ok: false, error: 'This review is signed off. Nothing on it changes now.' };
  var side = sideFor_(profile, String(r.StaffId));
  if (!side) return { ok: false, error: 'Not yours to write.' };
  var rating = String(data.rating || '').trim();
  if (rating && !ratingNum_(rating)) return { ok: false, error: 'A rating is 1 to 5.' };
  var patch = {};
  if (side === 'self') { patch.SelfRating = rating; patch.SelfNote = String(data.note || ''); }
  else { patch.PLRating = rating; patch.PLNote = String(data.note || '');
         if (data.actual != null && data.kind === 'goal') patch.Actual = String(data.actual); }
  var res = data.kind === 'competency'
    ? writeHalf_(HR.RCOMPS, ['ReviewId', 'Competency'], [r.ReviewId, String(data.name || '')], patch)
    : writeHalf_(HR.RGOALS, ['ReviewId', 'Goal'], [r.ReviewId, String(data.name || '')], patch);
  if (res.ok) res.side = side;
  return res;
}

/** The overall comment, and the signature. Signing is per side; the review
 *  is "signed" when both have. */
function saveReviewComment_(data, profile) {
  var r = findReview_(String(data.reviewId || ''));
  if (!r) return { ok: false, error: 'No such review.' };
  var side = sideFor_(profile, String(r.StaffId));
  if (!side) return { ok: false, error: 'Not yours to write.' };
  var patch = {};
  if (side === 'self') patch.SelfComment = String(data.comment || '');
  else patch.PLComment = String(data.comment || '');
  if (data.sign) {
    if (side === 'self') patch.SelfSignedAt = new Date(); else patch.PLSignedAt = new Date();
    var other = side === 'self' ? r.PLSignedAt : r.SelfSignedAt;
    patch.Status = other ? 'signed' : (side === 'self' ? 'self-signed' : 'pl-signed');
  }
  return writeHalf_(HR.REVIEWS, ['ReviewId'], [r.ReviewId], patch);
}

/** A development action on the 70-20-10 model. The People Leader writes
 *  them, in the framework's three parts — what, why, what success looks
 *  like. The person may mark one done. */
function saveDevelopment_(data, profile) {
  var staffId = String(data.staffId || profile.staffId);
  var side = sideFor_(profile, staffId);
  if (!side) return { ok: false, error: 'Not yours to write.' };
  var id = String(data.id || '');
  if (side === 'self') {
    if (!id) return { ok: false, error: 'Your People Leader writes the action; you mark it done.' };
    // The id alone is not proof of ownership — ids are a staffId and a
    // timestamp, which is guessable. The row has to be this person's.
    var own = (hrRows_(HR.DEVELOP, true) || []).some(function (d) {
      return String(d.DevId) === id && String(d.StaffId) === profile.staffId;
    });
    if (!own) return { ok: false, error: 'Not yours to mark.' };
    return writeHalf_(HR.DEVELOP, ['DevId'], [id], { Status: String(data.status || 'planned') });
  }
  if (SOURCES.indexOf(String(data.source)) === -1) return { ok: false, error: 'Experiential, Social or Formal.' };
  if (!String(data.action || '').trim() || !String(data.why || '').trim() || !String(data.success || '').trim()) {
    return { ok: false, error: 'Say what they will do, why, and what success looks like.' };
  }
  if (!id) id = staffId + '-' + new Date().getTime();
  return writeHalf_(HR.DEVELOP, ['DevId'], [id], {
    StaffId: staffId, ReviewId: String(data.reviewId || ''), Source: String(data.source),
    Action: String(data.action), Why: String(data.why), Success: String(data.success),
    Status: String(data.status || 'planned') });
}

/** A training-plan row: the People Leader keeps it; sign-off is theirs. */
function saveTraining_(data, profile) {
  var staffId = String(data.staffId || '');
  if (!isLeadOf_(profile, staffId)) return { ok: false, error: 'The People Leader keeps the training plan.' };
  var order = Number(data.order) || 0;
  if (!order) return { ok: false, error: 'Which row?' };
  var patch = {};
  ['Activity', 'Objective', 'Facilitator', 'Dates', 'Venue', 'Evidence', 'Evaluation', 'SignedOff']
    .forEach(function (k) { var v = data[k.toLowerCase()]; if (v != null) patch[k] = String(v); });
  return writeHalf_(HR.TRAINING, ['StaffId', 'Order'], [staffId, order], patch);
}

/** Everything the performance screen needs on open: this person's goals and
 *  competencies, their reviews, development and training, and — if they lead
 *  anyone — those people with the state of their latest review. */
function hrBundle_(profile) {
  var goals = goalsFor_(profile.role), comps = competencies_();
  var me = { staffId: profile.staffId, role: profile.role,
             goals: goals || [], competencies: comps || [],
             reviews: reviewsFor_(profile, profile.staffId),
             development: (hrRows_(HR.DEVELOP, true) || []).filter(function (d) { return String(d.StaffId) === profile.staffId; }).map(devRow_),
             training: trainingFor_(profile.staffId) };
  var reports = leads_(profile).map(function (sid) {
    var p = publicRoster_().filter(function (x) { return x.staffId === sid; })[0] || {};
    var rv = reviewsFor_(profile, sid);
    return { staffId: sid, name: p.name || sid, role: p.role || '', latest: rv[0] || null, reviews: rv };
  });
  return { ok: true, me: me, reports: reports, types: REVIEW_TYPES, sources: SOURCES,
           momentKinds: MOMENT_KINDS, momentSources: MOMENT_SOURCES,
           setup: { goals: !!goals, competencies: !!comps }, standard: OPR_MIN };
}

// ---------------------------------------------------------------------------
//  The order of service
//
//  Whatever the KPI, the work is served in this order: the Branch Manager,
//  the Assistant Branch Manager, the Unit Managers, the Executive Agents,
//  then the agents. It is a flow the branch follows, not a preference, so
//  every list the tracker hands a person is sorted by it and says who each
//  item is for.
//
//  Salesforce cannot say who is who — its contact titles read "Sales
//  Representative", "Salesman", "INSURANCE AGENT" and blank — so the rank
//  comes from the branch: the roster for the managers, and a "Ranks" tab
//  (Name | Rank) for the Executive Agents and anyone the roster does not
//  cover. Nobody named anywhere is an agent.
// ---------------------------------------------------------------------------

var RANKS = ['Branch Manager', 'Assistant Branch Manager', 'Unit Manager', 'Executive Agent', 'Agent'];
var RANK_TAB = { must: ['Name', 'Rank'], name: 'Ranks', head: ['Name', 'Rank'] };
var ROLE_RANK = { bm: 0, abm: 1, um: 2 };

/** "Exec. Agent", "unit mgr", "BM" -> the index into RANKS. */
function rankIndex_(label) {
  var t = normRole_(label);
  if (!t) return 4;
  if (/assistant branch manager|\babm\b/.test(t)) return 1;
  if (/branch manager assistant|\bbma\b/.test(t)) return 4;
  if (/branch manager|\bbm\b/.test(t)) return 0;
  if (/unit manager|\bum\b/.test(t)) return 2;
  if (/exec/.test(t)) return 3;
  return 4;
}

var _rankMemo = null;
/** Lower-cased full name -> rank index. The roster first, the tab over it. */
function rankTable_() {
  if (_rankMemo) return _rankMemo;
  var t = {};
  try {
    publicRoster_().forEach(function (p) {
      if (ROLE_RANK[p.role] != null && p.name) t[p.name.toLowerCase().trim()] = ROLE_RANK[p.role];
    });
  } catch (e) {}
  try {
    (hrRows_(RANK_TAB, false) || []).forEach(function (r) {
      var n = String(r.Name || '').toLowerCase().trim();
      if (n) t[n] = rankIndex_(r.Rank);
    });
  } catch (e) {}
  return (_rankMemo = t);
}

/** Who a task is for, ranked. An unnamed or unknown requester is an agent. */
function rankOf_(agentName) {
  var n = String(agentName || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!n) return 4;
  var t = rankTable_();
  if (t[n] != null) return t[n];
  var keys = Object.keys(t), best = 4;
  keys.forEach(function (k) {
    if (k.length > 5 && (n.indexOf(k) > -1 || k.indexOf(n) > -1) && t[k] < best) best = t[k];
  });
  return best;
}
function rankLabel_(i) { return i < 4 ? RANKS[i] : ''; }

/** A list of tasks in the order the branch serves them: the ones nobody has
 *  touched first, then by who they are for, then by due date. */
function orderBook_(list) {
  return list.sort(function (a, b) {
    if (!!a.needs !== !!b.needs) return a.needs ? -1 : 1;
    var ra = a.rank == null ? 4 : a.rank, rb = b.rank == null ? 4 : b.rank;
    if (ra !== rb) return ra - rb;
    return String(a.due || '9999-99-99').localeCompare(String(b.due || '9999-99-99'));
  });
}

// ---------------------------------------------------------------------------
//  Correspondence — the mail sweep, twice a day, in the same order
//
//  Answering the morning's mail in the order of service, and again after
//  lunch, is a core competency here and it has never been on any record.
//  The tracker cannot read a mailbox; it can record that the sweep was done,
//  when, and what each rank got — answered, or nothing waiting. That is a
//  time-stamped claim by the person, like a block, and it sits under
//  Responsiveness and Courtesy in the quarter.
// ---------------------------------------------------------------------------

var MAIL_KEYS = ['bm', 'abm', 'um', 'ea', 'ag'];
var MAIL_STATES = { done: 1, none: 1 };

function parseMail_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return null;
  var bits = s.split('|');
  var at = timeStr_(bits[0]), ranks = {};
  String(bits[1] || '').split(',').forEach(function (kv) {
    var p = kv.split(':');
    if (p[0] && MAIL_STATES[p[1]]) ranks[p[0].trim()] = p[1].trim();
  });
  return at ? { at: at, ranks: ranks } : null;
}

/** Mark the morning or afternoon sweep on the day's row. */
function saveMail_(payload, profile) {
  var staffId = profile.manager && payload.staffId ? String(payload.staffId) : profile.staffId;
  var date = isoDay_(payload.date) || todayISO_();
  var when = String(payload.when || '').toLowerCase();
  if (when !== 'am' && when !== 'pm') return { ok: false, error: 'Morning or afternoon?' };
  var ranks = {}, given = payload.ranks || {};
  for (var i = 0; i < MAIL_KEYS.length; i++) {
    var v = String(given[MAIL_KEYS[i]] || '').toLowerCase();
    if (!MAIL_STATES[v]) return { ok: false, error: 'Every rank needs an answer — answered, or nothing waiting.' };
    ranks[MAIL_KEYS[i]] = v;
  }
  var now = new Date(), at = hhmm_(now);
  var col = when === 'am' ? 'MailAM' : 'MailPM';
  var cell = at + '|' + MAIL_KEYS.map(function (k) { return k + ':' + ranks[k]; }).join(',');

  /* Stamped before the lock, so it is true even while this submission is
     queued behind another one. The wall's rebuild reads it and stands
     down; nothing a member of staff does waits on the wall. */
  markStaffWrite_();
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    var sh = logSheet_();
    var head = headerOf_(sh), idx = colMap_(sh);
    var targetRow = 0, revision = 0;
    if (sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var r = 0; r < vals.length; r++) {
        var sid = String(vals[r][idx['StaffId']] || '').trim() || staffIdFor_(vals[r][idx['Name']]);
        if (sid === staffId && isoDay_(vals[r][idx['Date']]) === date) {
          targetRow = r + 2; revision = Number(vals[r][idx['Revision']]) || 0; break;
        }
      }
    }
    var patch = { UpdatedAt: now, Revision: revision + 1 };
    patch[col] = cell;
    if (targetRow) writeRow_(sh, targetRow, idx, patch);
    else {
      patch.Timestamp = now; patch.Date = date; patch.StaffId = staffId;
      patch.Name = payload.name || profile.name; patch.Status = 'Draft';
      sh.appendRow(head.map(function (h) { return (h in patch) ? patch[h] : ''; }));
    }
  } finally { lock.releaseLock(); }
  return { ok: true, when: when, at: at, ranks: ranks, date: date };
}

/** Today's sweeps for the people this person may see, keyed by staffId. */
function mailToday_(profile, date) {
  var day = isoDay_(date) || todayISO_(), who = {};
  attVisible_(profile).forEach(function (s) { who[s] = 1; });
  var out = {};
  latestEntries_().forEach(function (e) {
    if (e.Date !== day || !who[e.StaffId]) return;
    var am = parseMail_(e.MailAM), pm = parseMail_(e.MailPM);
    if (am || pm) out[e.StaffId] = { am: am, pm: pm };
  });
  return out;
}

// ---------------------------------------------------------------------------
//  Standing: the quarter so far, on the form's own terms
//
//  The appraisal form asks two questions — what did you deliver against each
//  weighted goal, and how did you show each competency. The tracker already
//  holds most of the answer: the blocks worked and whether they landed, what
//  Salesforce closed, the days in and the days not, the value-added and the
//  innovation lines, the training given and received. This reads all of it
//  for the quarter so far and lays it under the goals and competencies, so
//  the quarterly is a read-off rather than a memory test.
//
//  What the record cannot see — a client calmed down, a colleague helped at
//  four o'clock — the person or their People Leader notes as a "moment"
//  against the competency it showed, on the day it happened.
// ---------------------------------------------------------------------------

var MOM = { must: ['MomentId', 'StaffId', 'Competency'], name: 'Moments',
            head: ['MomentId', 'StaffId', 'Date', 'Competency', 'What',
                   'Kind', 'Source', 'About', 'By', 'UpdatedAt'] };
var MOMENT_MAX = 300;
var MOMENT_ABOUT_MAX = 80;

/* WHAT A PERSON WAS WRITTEN TO ABOUT, AND WHAT THEY WERE THANKED FOR.
   A moment used to be one thing: a line against a competency. The branch's
   own question on 8 September was sharper than that — Elizabeth had been
   reminded four times that morning about the same spreadsheet, and nothing
   in the record could say so. What is missing from a bare line is who it
   came from, whether it was an ask or a thank-you, and what it was about.

   The last of those is the one that matters most, because it is what makes a
   repeat countable. A person will never write "this is the fourth reminder";
   they will write "the spreadsheet" four times, and the tracker can count. */
/* Four kinds, and the fourth is the one the branch asked for by name: a
   person saying where they fell short themselves, before anybody writes to
   them about it. It is not the same as being asked — an ask comes from
   outside and a shortfall is owned — and a record that only holds what other
   people noticed is a record of supervision rather than of a person's
   quarter. It reads against the same competency and the same job document. */
var MOMENT_KINDS = [
  { v: 'Asked',   label: 'Asked or reminded' },
  { v: 'Short',   label: 'Where I fell short' },
  { v: 'Thanked', label: 'Thanked or commended' },
  { v: 'Noted',   label: 'Noted for the record' }
];
var MOMENT_SOURCES = ['Branch Manager', 'Unit Manager', 'Head office',
                      'A client', 'A colleague', 'Myself'];

/* The Moments tab predates Kind, Source and About, so they are added to the
   end of whatever is there rather than assumed — the same way the register
   gained SignedOut. Every write goes through the header, never a fixed
   position, so a tab somebody has reordered by hand still lands correctly. */
function ensureMomentColumns_(sh) {
  var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var add = [];
  ['Kind', 'Source', 'About'].forEach(function (c) { if (head.indexOf(c) < 0) add.push(c); });
  if (add.length) {
    sh.getRange(1, head.length + 1, 1, add.length).setValues([add]);
    head = head.concat(add);
  }
  return head;
}

function appendByHead_(sh, head, obj) {
  sh.appendRow(head.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; }));
}

/* The same thing asked more than once. One line saying "asked four times,
   from the Branch Manager" is the fact an appraisal needs, and counting is
   the only honest way to get it. Grouped on a normalised subject so
   "Morning spreadsheet" and "morning spreadsheet." are one thing. */
function momentAsks_(moments, kind) {
  var want = kind || 'Asked';
  var by = {};
  (moments || []).forEach(function (m) {
    if (m.kind !== want) return;
    var k = String(m.about || m.what || '').toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!k) return;
    var g = by[k] || (by[k] = { about: m.about || m.what, n: 0, dates: [],
                                competency: m.competency, sources: {} });
    g.n++;
    g.dates.push(m.date);
    if (m.source) g.sources[m.source] = 1;
  });
  return Object.keys(by).map(function (k) {
    var g = by[k];
    g.dates.sort();
    g.last = g.dates[g.dates.length - 1];
    g.from = Object.keys(g.sources);
    delete g.sources;
    return g;
  }).sort(function (a, b) { return b.n - a.n || String(b.last).localeCompare(String(a.last)); });
}

/** Mondays to Fridays in [from, to). */
function workdays_(from, to) {
  var n = 0, d = from;
  while (d < to) {
    var dow = new Date(d + 'T12:00:00Z').getUTCDay();
    if (dow >= 1 && dow <= 5) n++;
    d = shiftDays_(d, 1);
  }
  return n;
}

function momentsFor_(staffId, from, to) {
  return (hrRows_(MOM, true) || []).filter(function (m) {
    var d = isoDay_(m.Date);
    return String(m.StaffId) === staffId && d >= from && d < to;
  }).map(function (m) {
    return { id: String(m.MomentId || ''), date: isoDay_(m.Date), competency: String(m.Competency || ''),
             what: String(m.What || ''), by: String(m.By || ''),
             /* Rows written before these columns existed read as 'Noted',
                which is what they were: a line against a competency. */
             kind: String(m.Kind || '') || 'Noted',
             source: String(m.Source || ''), about: String(m.About || '') };
  }).sort(function (a, b) { return b.date.localeCompare(a.date); });
}

/** A line about a competency, by the person or their People Leader. */
function noteMoment_(data, profile) {
  var staffId = String(data.staffId || profile.staffId);
  if (!canSee_(profile, staffId)) return { ok: false, error: 'Not yours to note.' };
  var comps = competencies_();
  if (!comps) return { ok: false, error: 'No "Competencies" tab in the workbook yet.' };
  var name = String(data.competency || '').trim();
  if (!comps.some(function (c) { return c.competency === name; })) return { ok: false, error: 'Pick one of the competencies on the form.' };
  var what = String(data.what || '').replace(/\s+/g, ' ').trim();
  if (what.split(' ').length < 3) return { ok: false, error: 'Say what happened — a line, not a word.' };
  what = what.slice(0, MOMENT_MAX);

  var kind = String(data.kind || 'Noted').trim();
  if (!MOMENT_KINDS.some(function (k) { return k.v === kind; })) {
    return { ok: false, error: 'Say whether you were asked, thanked, or noting it for the record.' };
  }
  var source = String(data.source || '').trim();
  if (source && MOMENT_SOURCES.indexOf(source) < 0) return { ok: false, error: 'Pick who it came from from the list.' };
  /* An ask with no subject cannot be counted against the next one, and the
     count is the whole point — so it is required for an ask and optional for
     the rest. */
  var about = String(data.about || '').replace(/\s+/g, ' ').trim().slice(0, MOMENT_ABOUT_MAX);
  /* A shortfall is counted the same way an ask is, and for the same reason:
     the second time the same thing is missed is the finding, not the first. */
  if ((kind === 'Asked' || kind === 'Short') && !about) {
    return { ok: false, error: 'Say what it was about in a few words — that is what counts a repeat.' };
  }

  var day = isoDay_(data.date) || todayISO_();
  var id = staffId + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  var sh = hrTab_(MOM, true), now = new Date();
  appendByHead_(sh, ensureMomentColumns_(sh), {
    MomentId: id, StaffId: staffId, Date: day, Competency: name, What: what,
    Kind: kind, Source: source, About: about, By: profile.staffId, UpdatedAt: now
  });
  forgetHr_(MOM);
  return { ok: true, id: id, date: day, competency: name, what: what,
           kind: kind, source: source, about: about, by: profile.staffId };
}

/** Training logged in the period: sessions this person gave, and sessions
 *  where they were the trainee. The trainee column is typed, so it is
 *  matched on the first name or the staff id. */
function trainingLog_(staffId, from, to) {
  var out = { given: 0, received: 0, sessions: [], taught: [] };
  var sh;
  try { sh = trainingSheet_(); } catch (e) { return out; }
  if (!sh) return out;
  var p = publicRoster_().filter(function (x) { return x.staffId === staffId; })[0] || {};
  var first = String(p.name || staffId).split(' ')[0].toLowerCase();
  sheetObjects_(sh).forEach(function (r) {
    var d = isoDay_(r.TrainingDate);
    if (!d || d < from || d >= to) return;
    if (String(r.StaffId) === staffId) {
      out.given++;
      out.taught.push({ date: d, topic: String(r.Topic || ''), trainee: String(r.Trainee || '') });
    }
    var t = String(r.Trainee || '').toLowerCase();
    if (t && (t.indexOf(first) > -1 || t.indexOf(staffId.toLowerCase()) > -1)) {
      out.received++;
      out.sessions.push({ date: d, topic: String(r.Topic || ''), trainer: String(r.Trainer || ''),
                          achieved: String(r.Achieved || ''), result: String(r.Result || '') });
    }
  });
  out.sessions.sort(function (a, b) { return b.date.localeCompare(a.date); });
  out.taught.sort(function (a, b) { return b.date.localeCompare(a.date); });
  return out;
}

/** What a person was trained on this period, and what is still to be
 *  covered: the plan's open rows and the development actions not yet done.
 *  The same three tabs the review reads, so the landing and the appraisal
 *  never disagree. */
function trainingStanding_(staffId, from, to) {
  var log = trainingLog_(staffId, from, to);
  var plan = trainingFor_(staffId);
  var dev = (hrRows_(HR.DEVELOP, true) || []).filter(function (d) { return String(d.StaffId) === staffId; }).map(devRow_);
  return {
    covered: log.sessions.slice(0, 6),
    taught: log.taught.slice(0, 4),
    planned: plan.filter(function (t) { return !t.signedOff; }).map(function (t) {
      return { activity: t.activity, objective: t.objective, dates: t.dates, facilitator: t.facilitator }; }),
    signedOff: plan.filter(function (t) { return !!t.signedOff; }).length,
    planTotal: plan.length,
    actions: dev.filter(function (d) { return d.status !== 'done' && d.action; }).map(function (d) {
      return { action: d.action, source: d.source, why: d.why }; }),
    actionsDone: dev.filter(function (d) { return d.status === 'done'; }).length
  };
}

/** Everything the record holds about one person over a period, in one
 *  object. Both the standing and a review read from it. */
function facts_(staffId, from, to, entries, closedByType, nowBlock, needs, billing) {
  var f = { blocks: 0, met: 0, partly: 0, no: 0, planned: 0, landed: null,
            valueAdded: [], innovation: [],
            /* What a full day is FOR THIS PERSON. Counting BLOCK_IDS told
               support staff they owed the four-to-midnight block, which only
               the Branch Manager is scheduled for. */
            owed: blocksOwed_(staffId),
            daysIn: 0, absent: 0, late: 0, daysLogged: 0,
            closed: null, servicing: null, open: null, needs: null, lateTasks: null, noReason: null, billingFlags: null,
            trainingGiven: 0, trainingReceived: 0, devDone: 0, devTotal: 0 };
  entries.forEach(function (r) {
    var logged = false;
    BLOCK_IDS.forEach(function (p) {
      if (!hasText_(r[p + '_Actioned']) && !hasText_(r[p])) return;
      logged = true;
      f.blocks++;
      f.planned += Number(r[p + '_Plan']) || 0;
      var m = String(r[p + '_Met'] || '').trim();
      if (m === 'met') f.met++; else if (m === 'partly') f.partly++; else if (m === 'no') f.no++;
    });
    if (logged) f.daysLogged++;
    var d = String(r.Date || '').slice(0, 10);
    if (isSubstantive_(r.ValueAdded) && f.valueAdded.length < 3) f.valueAdded.push({ date: d, text: String(r.ValueAdded).slice(0, 140) });
    if (isSubstantive_(r.Innovation) && f.innovation.length < 3) f.innovation.push({ date: d, text: String(r.Innovation).slice(0, 140) });
  });
  f.mailAm = 0; f.mailAmEarly = 0; f.mailPm = 0; f.mailDays = 0;
  var startPlusHour = startFor_(staffId) + 60;
  entries.forEach(function (r) {
    var am = parseMail_(r.MailAM), pm = parseMail_(r.MailPM);
    if (am || pm) f.mailDays++;
    if (am) { f.mailAm++; var m = minutesOf_(am.at); if (m != null && m <= startPlusHour) f.mailAmEarly++; }
    if (pm) f.mailPm++;
  });
  f.workDays = entries.length;
  f.valueAddedN = entries.filter(function (r) { return isSubstantive_(r.ValueAdded); }).length;
  f.innovationN = entries.filter(function (r) { return isSubstantive_(r.Innovation); }).length;
  var rated = f.met + f.partly + f.no;
  f.landed = rated ? Math.round(f.met / rated * 100) / 100 : null;

  try {
    attendanceFor_({ staffId: staffId, manager: false }, from, to).forEach(function (a) {
      if (a.staffId !== staffId) return;
      if (a.status === 'absent') f.absent++;
      else if (a.at) { f.daysIn++; if (a.late) f.late++; }
    });
  } catch (e) {}

  if (closedByType) {
    f.closed = 0;
    Object.keys(closedByType).forEach(function (t) { f.closed += closedByType[t] || 0; });
    f.servicing = closedByType.Servicing || 0;
  }
  if (nowBlock) {
    f.open = nowBlock.open || 0; f.needs = nowBlock.needs || 0; f.lateTasks = nowBlock.overdue || 0;
  }
  if (needs) f.noReason = needs.length;
  if (billing) f.billingFlags = billing.length;

  var tl = trainingLog_(staffId, from, to);
  f.trainingGiven = tl.given; f.trainingReceived = tl.received;
  (hrRows_(HR.DEVELOP, true) || []).forEach(function (d) {
    if (String(d.StaffId) !== staffId) return;
    f.devTotal++;
    if (String(d.Status || '') === 'done') f.devDone++;
  });
  return f;
}

/** What the record says about one competency, read by the competency's
 *  name. A name that matches nothing gets moments only, and says so. */
function competencySignals_(name, f) {
  var n = String(name || '').toLowerCase(), s = [];
  function sig(label, value, tone) { s.push({ label: label, value: value, tone: tone || '' }); }
  var pc = function (x) { return Math.round(x * 100) + '%'; };
  if (/reliab|attend|punctual|depend/.test(n)) {
    sig('Days in', f.daysIn); sig('Not in', f.absent, f.absent ? 'amber' : 'green');
    sig('After your start', f.late, f.late ? 'amber' : 'green');
    if (f.daysIn) {
      // One plan a day now: days logged against days in.
      sig('Days reported', Math.min(f.daysLogged, f.daysIn) + ' of ' + f.daysIn, f.daysLogged >= f.daysIn * 0.8 ? 'green' : 'amber');
    }
  }
  if (/respons|timel|follow.?up/.test(n)) {
    if (f.workDays) {
      sig('Morning mail sweep', f.mailAm + ' of ' + f.workDays + ' days', f.mailAm >= f.workDays * 0.8 ? 'green' : 'amber');
      sig('Within an hour of start', f.mailAmEarly);
      sig('Afternoon sweep', f.mailPm + ' of ' + f.workDays + ' days', f.mailPm >= f.workDays * 0.8 ? 'green' : 'amber');
    }
    if (f.needs != null) sig('Untouched 7+ days', f.needs, f.needs ? 'amber' : 'green');
    if (f.lateTasks != null) sig('Late', f.lateTasks, f.lateTasks ? 'amber' : 'green');
    if (f.noReason != null) sig('Late with no reason', f.noReason, f.noReason ? 'amber' : 'green');
    if (f.closed != null) sig('Closed this quarter', f.closed);
  }
  if (/quality|accura|detail/.test(n)) {
    if (f.landed != null) sig('Reports landed', pc(f.landed), f.landed >= 0.8 ? 'green' : 'amber');
    if (f.noReason != null) sig('Late with no reason', f.noReason, f.noReason ? 'amber' : 'green');
    if (f.billingFlags != null) sig('Billing flags', f.billingFlags, f.billingFlags ? 'amber' : 'green');
  }
  if (/customer|service|client/.test(n)) {
    sig('Value-added lines', f.valueAddedN);
    if (f.servicing != null) sig('Servicing closed', f.servicing);
    if (f.closed != null) sig('Closed this quarter', f.closed);
  }
  if (/growth|learn|develop/.test(n)) {
    sig('Training received', f.trainingReceived);
    sig('Development actions done', f.devDone + ' of ' + f.devTotal, f.devTotal && f.devDone < f.devTotal ? 'amber' : '');
  }
  if (/innovat|creativ|improve/.test(n)) sig('Innovation lines', f.innovationN, f.innovationN ? 'green' : '');
  if (/courtesy|interpersonal|positive|energy|team|collab/.test(n)) {
    if (/courtesy|interpersonal/.test(n) && f.workDays) sig('Mail sweeps done', f.mailAm + f.mailPm);
    sig('Training given', f.trainingGiven);
  }
  return s;
}
function competencyLines_(name, f) {
  var n = String(name || '').toLowerCase();
  if (/customer|service|client/.test(n)) return f.valueAdded;
  if (/innovat|creativ|improve/.test(n)) return f.innovation;
  return [];
}

/** The quarter so far for one person: every goal with what the record says
 *  under it, every competency with its signals and moments. */
function standing_(profile, staffId) {
  staffId = String(staffId || profile.staffId);
  if (!canSee_(profile, staffId)) return { ok: false, error: 'Not yours to see.' };
  var today = todayISO_(), q = quarterOf_(today), qr = quarterRange_(q);
  var from = qr.from, to = shiftDays_(today, 1);
  var role = staffId === profile.staffId ? profile.role : roleFor_id_(staffId);
  var goals = goalsFor_(role), comps = competencies_();

  var entries = allEntries_().filter(function (e) {
    var d = String(e.Date || '').slice(0, 10);
    return String(e.StaffId) === staffId && d >= from && d < to;
  });
  var closed = sfkClosedInPeriodSafe_(staffId, from, to);
  var mm = sfkMetricsSafe_();
  var nowBlock = (mm && mm.ok && mm.staff && mm.staff[staffId]) || null;
  var needs = (sfkNeedsReasonSafe_(today) || {})[staffId] || null;
  var billing = ((sfkBillingCheckSafe_(today) || {})[staffId] || {}).items || null;
  var f = facts_(staffId, from, to, entries, closed, nowBlock, needs, billing);
  var moments = momentsFor_(staffId, from, to);

  var outGoals = (goals || []).map(function (g) {
    var ev = goalEvidence_(staffId, from, to, g.kpiTypes, entries, closed, nowBlock && nowBlock.byType);
    var rated = ev.met.met + ev.met.partly + ev.met.no;
    return { goal: g.goal, description: g.description, targetType: g.targetType, weight: g.weight,
             target: g.target, kpiTypes: g.kpiTypes, evidence: ev,
             landed: rated ? Math.round(ev.met.met / rated * 100) / 100 : null };
  });
  var outComps = (comps || []).map(function (c) {
    return { competency: c.competency, definition: c.definition, behaviours: c.behaviours,
             signals: competencySignals_(c.competency, f), lines: competencyLines_(c.competency, f),
             moments: moments.filter(function (m) { return m.competency === c.competency; }) };
  });
  /* What was asked of this person more than once, and what they were thanked
     for — read off the same moments, so the quarter view and the appraisal
     cannot disagree about either. */
  var asks = momentAsks_(moments);
  /* Owned before anybody had to write about it — kept apart from the asks,
     because in a review those two sentences are not the same sentence. */
  var shortfalls = momentAsks_(moments, 'Short');
  return { ok: true, staffId: staffId, role: role, quarter: q, from: from, to: to, today: today,
           daysIn: workdays_(from, to), daysLeft: workdays_(to, qr.to),
           goals: outGoals, competencies: outComps, facts: f,
           asks: asks, shortfalls: shortfalls,
           thanked: moments.filter(function (m) { return m.kind === 'Thanked'; }),
           written: moments.filter(function (m) { return m.kind !== 'Noted'; }).length,
           training: trainingStanding_(staffId, from, to),
           jobDoc: !!jobDoc_(role),
           salesforce: !!closed, setup: { goals: !!goals, competencies: !!comps },
           side: sideFor_(profile, staffId) };
}

// ---------------------------------------------------------------------------
//  Attendance
//
//  Signing in is the attendance register. The first sign-in of the day is the
//  time the person started; every later one only refreshes "last seen". There
//  is no second form to fill: the JotForm register this replaces asked people
//  to sign in twice, and a register nobody signs is a register with holes.
//
//  Somebody who is not in signs in anyway and says so — "not in today", and
//  why. Their People Leader may mark it for them if they phoned in. The start
//  time is read against the person's own hours from the schedule, so an
//  eight o'clock desk and a nine o'clock desk are each measured against their
//  own day and nobody is "late" for a start that was never theirs.
// ---------------------------------------------------------------------------

var ATT = { must: ['Date', 'StaffId', 'FirstSignIn'], name: 'Attendance',
            head: ['Date', 'StaffId', 'Name', 'FirstSignIn', 'LastSeen', 'SignedOut', 'Status',
                   'Reason', 'MarkedBy', 'UpdatedAt'] };
var ATT_GRACE_MIN = 10;

/** "8am – 4pm" -> 480. The first token of the hours string, in minutes. */
function startFor_(staffId) {
  var h = String(scheduleFor_(staffId).hours || '8am');
  var m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(h);
  if (!m) return 8 * 60;
  var hr = Number(m[1]) % 12, mn = Number(m[2] || 0);
  if ((m[3] || 'am').toLowerCase() === 'pm') hr += 12;
  return hr * 60 + mn;
}
function hhmm_(d) { return Utilities.formatDate(d, CONFIG.TZ, 'HH:mm'); }
function minutesOf_(hhmm) {
  var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function lateBy_(staffId, at) {
  var mins = minutesOf_(at);
  if (mins == null) return 0;
  var over = mins - startFor_(staffId);
  return over > ATT_GRACE_MIN ? over : 0;
}

function attSheet_() {
  var sh = hrTab_(ATT, false);
  if (sh) return ensureAttColumns_(sh);
  sh = hrTab_(ATT, true);
  // "08:07" typed into a fresh cell becomes a time value; kept as text the
  // register reads back exactly what was written. D to F: in, last seen, out.
  try { sh.getRange('D:F').setNumberFormat('@'); } catch (e) {}
  return sh;
}

/** A register written before sign-out existed has no SignedOut column, and a
 *  write to a column that is not there is silently dropped. Added once, on the
 *  end, so the columns a person already reads keep their places. */
function ensureAttColumns_(sh) {
  var head = headerOf_(sh);
  var missing = ATT.head.filter(function (c) { return head.indexOf(c) === -1; });
  if (!missing.length) return sh;
  var at = sh.getLastColumn() + 1;
  sh.getRange(1, at, 1, missing.length).setValues([missing]);
  try { sh.getRange(2, at, Math.max(sh.getMaxRows() - 1, 1), missing.length).setNumberFormat('@'); } catch (e) {}
  forgetHeader_(sh);
  forgetHr_(ATT);
  return sh;
}

/** A time cell, whichever shape the sheet hands back: the text that was
 *  written, or a time value the sheet made of it. */
function timeStr_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(v.getHours()) + ':' + p(v.getMinutes());
  }
  var m = /^(\d{1,2}):(\d{2})/.exec(String(v).trim());
  return m ? (m[1].length < 2 ? '0' : '') + m[1] + ':' + m[2] : String(v).trim();
}

/** Today's row for one person, earliest sign-in winning if two devices raced. */
function attRow_(rows, day, staffId) {
  var best = null;
  rows.forEach(function (r, i) {
    if (isoDay_(r.Date) !== day || String(r.StaffId) !== staffId) return;
    var t = timeStr_(r.FirstSignIn) || '99:99', b = best ? timeStr_(best.row.FirstSignIn) || '99:99' : null;
    if (!best || t < b) best = { row: r, at: i + 2 };
  });
  return best;
}

function attOut_(r, staffId) {
  var at = timeStr_(r.FirstSignIn);
  return { at: at, lastSeen: timeStr_(r.LastSeen), out: timeStr_(r.SignedOut),
           status: String(r.Status || 'in'), reason: String(r.Reason || ''),
           late: at ? lateBy_(staffId, at) : 0 };
}

/** Called on sign-in and on session resume. Cheap on repeats: the day's
 *  answer is cached for half an hour, so the read only happens once. */
function recordAttendance_(profile) {
  var day = todayISO_(), sid = profile.staffId;
  var cache = null, key = 'att_' + sid + '_' + day;
  try { cache = CacheService.getScriptCache(); var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) {}

  var sh = attSheet_(), rows = sheetObjects_(sh), now = new Date();
  var found = attRow_(rows, day, sid), out;
  if (found && !timeStr_(found.row.FirstSignIn) && String(found.row.MarkedBy || '') === 'tracker') {
    // Marked absent by the clock, and here after all: in, late by the minute.
    var back = { FirstSignIn: hhmm_(now), LastSeen: hhmm_(now), Status: 'in', MarkedBy: sid, UpdatedAt: now,
                 Reason: 'Signed in at ' + twelve_(hhmm_(now)) + ', after the automatic absence' };
    writeRow_(sh, found.at, colMap_(sh), back);
    out = attOut_(Object.assign({}, found.row, back), sid); out.first = true;
  } else if (found) {
    writeRow_(sh, found.at, colMap_(sh), { LastSeen: hhmm_(now), UpdatedAt: now });
    out = attOut_(found.row, sid); out.first = false;
  } else {
    var o = { Date: day, StaffId: sid, Name: profile.name || sid, FirstSignIn: hhmm_(now),
              LastSeen: hhmm_(now), SignedOut: '', Status: 'in', Reason: '', MarkedBy: sid,
              UpdatedAt: now };
    // In the sheet's own column order. Writing in ATT.head's order put every
    // value one or more columns over once SignedOut had been added on the end:
    // 114 of 122 rows had the sign-in time sitting in SignedOut.
    sh.appendRow(headerOf_(sh).map(function (h) { return o[h] != null ? o[h] : ''; }));
    out = attOut_(o, sid); out.first = true;
  }
  forgetHr_(ATT);
  // The cached copy says "not first" — a second sign-in five minutes later
  // must land on the day, not the plan.
  try { cache.put(key, JSON.stringify(Object.assign({}, out, { first: false })), 1800); } catch (e) {}
  return out;
}

/** Closing the day. The other half of the register: signing in opens the day,
 *  this closes it, and the two times are the hours the person was here.
 *
 *  Only ever your own — a manager may mark somebody absent, because that is a
 *  fact they can know, but nobody else can say when you finished.
 *
 *  Coming back and signing out again simply moves the time later, which is
 *  what a person who stepped out and returned would want it to say. */
function signOutDay_(data, profile) {
  var day = todayISO_(), sid = profile.staffId;
  var sh = attSheet_(), rows = sheetObjects_(sh), now = new Date(), at = hhmm_(now);
  var found = attRow_(rows, day, sid);
  if (!found) {
    // No row at all: the register would otherwise show a day that was closed
    // but never opened. Open it first, at the same minute, and say so.
    recordAttendance_(profile);
    rows = sheetObjects_(attSheet_());
    found = attRow_(rows, day, sid);
  }
  if (!found) return { ok: false, error: 'The register did not answer. Try once more.' };
  writeRow_(sh, found.at, colMap_(sh), { SignedOut: at, LastSeen: at, UpdatedAt: now });
  forgetHr_(ATT);
  try { CacheService.getScriptCache().remove('att_' + sid + '_' + day); } catch (e) {}

  try { signOutNotice_(sid, day, at); } catch (e) {}

  var done = blocksSubmittedOn_(sid, day);
  return { ok: true, date: day, staffId: sid, out: at,
           blocksDone: done.length,
           blocksLeft: Math.max(0, blocksOwed_(sid) - done.length) };
}

/** "Not in today", with the reason. Self, or the People Leader for a report. */
function markAbsent_(data, profile) {
  var staffId = String(data.staffId || profile.staffId);
  if (staffId !== profile.staffId && !isLeadOf_(profile, staffId)) return { ok: false, error: 'Not yours to mark.' };
  var day = isoDay_(data.date) || todayISO_();
  var reason = String(data.reason || '').trim();
  if (!reason) return { ok: false, error: 'Say why — sick, on leave, or what it is.' };
  var sh = attSheet_(), rows = sheetObjects_(sh), now = new Date();
  var found = attRow_(rows, day, staffId);
  var patch = { Status: 'absent', Reason: reason, MarkedBy: profile.staffId, UpdatedAt: now };
  if (found) writeRow_(sh, found.at, colMap_(sh), patch);
  else {
    var name = (publicRoster_().filter(function (p) { return p.staffId === staffId; })[0] || {}).name || staffId;
    var o = Object.assign({ Date: day, StaffId: staffId, Name: name, FirstSignIn: '', LastSeen: '', SignedOut: '' }, patch);
    sh.appendRow(headerOf_(sh).map(function (h) { return o[h] != null ? o[h] : ''; }));
  }
  forgetHr_(ATT);
  try { CacheService.getScriptCache().remove('att_' + staffId + '_' + day); } catch (e) {}
  return { ok: true, date: day, staffId: staffId, status: 'absent', reason: reason };
}

/** Who a person may see the register for: themselves, the people they lead,
 *  everyone for the Branch Manager. */
function attVisible_(profile) {
  var v = [profile.staffId].concat(leads_(profile));
  var seen = {}; return v.filter(function (s) { if (seen[s]) return false; seen[s] = true; return true; });
}

/** The register for a date range. */
function attendanceFor_(profile, from, to) {
  var who = {}; attVisible_(profile).forEach(function (s) { who[s] = 1; });
  var out = [];
  (hrRows_(ATT, true) || []).forEach(function (r) {
    var d = isoDay_(r.Date), sid = String(r.StaffId);
    if (!who[sid] || d < from || d >= to) return;
    var o = attOut_(r, sid); o.date = d; o.staffId = sid; o.markedBy = String(r.MarkedBy || '');
    out.push(o);
  });
  // Two rows for one day (two devices raced) collapse to the earliest sign-in.
  var byKey = {};
  out.forEach(function (o) {
    var k = o.date + '|' + o.staffId, cur = byKey[k];
    if (!cur || (o.at && (!cur.at || o.at < cur.at))) byKey[k] = o;
  });
  return Object.keys(byKey).map(function (k) { return byKey[k]; })
    .sort(function (a, b) { return a.date === b.date ? a.staffId.localeCompare(b.staffId) : b.date.localeCompare(a.date); });
}

/** Today, keyed by staffId, for the rows response. */
function attendanceToday_(profile) {
  var day = todayISO_(), m = {};
  attendanceFor_(profile, day, shiftDays_(day, 1)).forEach(function (o) { m[o.staffId] = o; });
  return m;
}

// ---------------------------------------------------------------------------
//  Two o'clock: the branch's own message, written and ready to send
//
//  WHY THE LAST TAP IS A PERSON'S, AND CANNOT BE ANYTHING ELSE.
//  There is no way for this script to post into a WhatsApp group. Meta's
//  WhatsApp Business API sends to individual numbers and has never supported
//  groups; the same is true of every reseller built on it. The libraries that
//  do post to groups drive a logged-in copy of WhatsApp Web from a server,
//  which is against WhatsApp's terms and gets the number banned — and the
//  number here is the branch's. So this writes the message and hands it over
//  ready: an e-mail at two with the text, and a link that opens WhatsApp with
//  it already typed. Pick the group, press send. Two taps, and nothing about
//  the branch's number is at risk.
//
//  WHAT IT SAYS, AND WHY IT IS ONE THING.
//  The house rules for a message to the branch group are in CLAUDE.md and the
//  first one is the one that keeps getting broken: under about 120 words. A
//  280-word message is a memo, and a memo in a WhatsApp group is scrolled
//  past. So the message leads with the number nobody in the room already
//  knows, names the person in front — not the people behind, because a daily
//  naming of who is last is corrosive and would be read once — carries ONE
//  finding, and ends with an ask that can be answered in a line.
//
//  Two o'clock and not three: the 3pm checkpoint is the manager's read of the
//  day. This is the branch's, and it lands with two working hours left in it,
//  which is the difference between a prompt and a report.
// ---------------------------------------------------------------------------

var PULSE_HOUR = 14;

/** The strongest true thing about the day so far, and the ask that follows
 *  from it. One finding — whichever of these is first and real. */
function pulseFinding_(r) {
  var t = r.totals || {};
  if (t.overdue > 0) {
    return { text: t.overdue + ' tasks across the branch are overdue right now. A line of reason on each is ' +
                   'the fastest hour anybody will spend today — a task with a reason on it stops being chased.',
             ask: 'Reply with one you are clearing before four.' };
  }
  if (r.silent && r.silent.length) {
    return { text: r.silent.length + ' of ' + r.headcount + (r.silent.length === 1 ? ' desks has' : ' desks have') +
                   ' logged nothing at all yet today. ' +
                   'The three o’clock branch report reads what is in the sheet, not what was done.',
             ask: 'Reply when yours is in.' };
  }
  if (t.aged60 > 0) {
    return { text: t.aged60 + ' tasks have not been touched in sixty days. Those are the ones a client ' +
                   'remembers, and the ones nobody opens.',
             ask: 'Reply with one sixty-day task you are opening this afternoon.' };
  }
  if (r.behind && r.behind.length) {
    return { text: (r.behind.length === 1 ? 'One of us is' : r.behind.length + ' of us are') +
                   ' still to log the day with two hours left. ' +
                   'A day written at the close from memory is not the same record as one written as it went.',
             ask: 'Reply when your day is logged.' };
  }
  return { text: 'Every desk has reported and nothing is overdue. That is a first, and it is worth saying out loud.',
           ask: 'Reply with the one client you are calling before you leave.' };
}

/** The message itself. WhatsApp bold is *single asterisks* and it reflows its
 *  own lines, so a paragraph is one line here — wrapped text arrives ragged
 *  on a phone. */
function branchPulseText_(r) {
  var t = r.totals || {}, live = (r.lines || []).filter(function (l) { return l.fromSalesforce; }).length > 0;
  var ranked = (r.lines || []).filter(function (l) { return (l.closed || 0) > 0; })
    .sort(function (a, b) { return (b.closed || 0) - (a.closed || 0); });
  var first = ranked[0], second = ranked[1];

  var head = live && t.closed
    ? '*Two o’clock — ' + t.closed + ' closed so far today.*'
    : '*Two o’clock.*';

  var lead = first
    ? firstName_(first.name) + ' is in front with ' + first.closed +
      (second && second.closed ? ', ' + firstName_(second.name) + ' right behind on ' + second.closed + '.' : '.')
    : (r.reported ? r.reported + ' of ' + r.headcount + ' desks have reported so far.' : '');

  var f = pulseFinding_(r);
  return [head, lead, f.text, f.ask].filter(Boolean).join('\n\n');
}

function firstName_(n) { return String(n || '').trim().split(/\s+/)[0] || String(n || ''); }

/** Open WhatsApp with the message already typed. wa.me with no number is the
 *  share sheet: pick the group, press send. */
function pulseWaLink_(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

/** Written by hand from the editor, to read it before anybody else does. */
function branchPulse(dateOpt) {
  var text = branchPulseText_(checkpointReport_(dateOpt));
  Logger.log(text);
  return text;
}

/** Two o'clock. The message, the link that sends it, and nothing else — this
 *  is a prompt to press send, not a report to read. */
function sendBranchPulse(dateOpt) {
  if (nothingToReport_(dateOpt)) return 'Nobody signed in and nothing was filed — no two o’clock message.';
  var r = checkpointReport_(dateOpt);
  var text = branchPulseText_(r);
  var words = text.split(/\s+/).filter(Boolean).length;

  MailApp.sendEmail({
    to: managerEmails_().join(','), cc: salesSupportCc_(managerEmails_().join(',')),
    subject: 'For the branch group · ' + shortDate_(r.date) + ' · ' + words + ' words',
    htmlBody: shell_('Ready for the group', prettyDate_(r.date) + ' · two o’clock',
      '<a href="' + esc_(pulseWaLink_(text)) + '" ' +
        'style="display:block;text-align:center;padding:14px 18px;border-radius:10px;background:#25D366;' +
        'color:#06301a;text-decoration:none;font-size:16px;font-weight:800;margin-bottom:14px">' +
        'Open WhatsApp with this typed →</a>' +
      '<div style="font-size:12.5px;color:' + MAIL.muted + ';text-align:center;margin:-6px 0 16px">' +
        'Pick the Branch Admin group and press send. WhatsApp has no way to let a script post ' +
        'to a group itself — that last tap has to be yours.</div>' +
      sectionLabel_('The message · ' + words + ' words') +
      '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.gold +
        ';border-radius:9px;padding:14px 16px;font-size:14.5px;line-height:1.6;white-space:pre-wrap;' +
        'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif">' + esc_(text) + '</div>' +
      '<div style="font-size:13px;color:' + MAIL.muted + ';line-height:1.55;margin-top:14px">' +
        'Written from the day’s own record at two, so the number in the first line is one ' +
        'nobody in the group has seen yet. Change any of it before you send — it is a draft, ' +
        'not a broadcast.</div>')
  });
  Logger.log(text);
  return 'Two o’clock message ready (' + words + ' words), sent to ' + managerEmails_().join(', ') + '.';
}

// ---------------------------------------------------------------------------
//  Before you leave — the close-out
//
//  The register says a person was here. It has never said what they left
//  behind them. Signing in opens the day, signing out closes it, and between
//  those two times the only record was whatever they chose to type into a
//  block. The branch's question on 10 September was the right one: gauge what
//  was actually done, and ask it while the person is still at the desk.
//
//  So the last thing a day does is ask. A short list, the same one every
//  evening, of the things that have to be true before somebody leaves.
//
//  Two rules make it worth answering.
//
//  The first: THE LIST NEVER ASKS WHAT IT CAN ALREADY SEE. Blocks reported,
//  the afternoon mail sweep, anything written to you today — the sheet holds
//  all three, so those tick themselves and show their own evidence. A
//  checklist that makes a person re-assert what the system already knows is a
//  checklist they learn to tick without reading, and then it is worth
//  nothing. Only what cannot be seen is actually asked.
//
//  The second: THE LIST IS THE BRANCH'S, NOT THIS FILE'S. It lives on the
//  Closeout Items tab, so the Branch Manager adds "upload the branch
//  portfolio" the morning after the fourth reminder, without a deployment.
//  closeoutAdd() does it from the editor in one line.
//
//  It is asked in two places, and the same tick answers both. On the screen,
//  under Close the day, while the person is signing out. And at a quarter to
//  four by e-mail, because the people who most need the question are the ones
//  who have not opened the tracker since lunch — every unticked line is a
//  link, and clicking it records it and shows what is left.
//
//  Nobody who did not sign in is asked anything. A day that was never opened
//  is absent, and an absent day has nothing to close.
// ---------------------------------------------------------------------------

var CLO  = { must: ['ItemId', 'Item', 'Who'], name: 'Closeout Items',
             head: ['ItemId', 'Item', 'Who', 'Auto', 'Order', 'Active', 'Note'] };
var CLOG = { must: ['Date', 'StaffId', 'ItemId'], name: 'Closeout Log',
             head: ['Date', 'StaffId', 'Name', 'ItemId', 'Item', 'Status', 'Reason', 'At', 'Source'] };

var CLOSEOUT_HOUR = 15, CLOSEOUT_MINUTE = 45;   // a quarter to four

/* What the tab is seeded with the first time it is opened.
   The three that check themselves are the three the sheet already answers.
   The fourth ships switched off on purpose: it is the shape of a branch rule
   rather than a branch rule, and a checklist that tells somebody to do
   something nobody asked of them is worse than a short checklist. Switch it
   on, edit it, or add your own — Who takes a role (bm, um, bma, sales
   support), a name, or a staff id, and All means everybody. */
var CLOSEOUT_SEED = [
  { ItemId: 'blocks',    Item: 'The day reported',
    Who: 'All', Auto: 'blocks', Order: 10, Active: 'Yes',
    Note: 'Checks itself against the day’s entries.' },
  { ItemId: 'mail',      Item: 'Afternoon mail sweep cleared',
    Who: 'All', Auto: 'mail', Order: 20, Active: 'Yes',
    Note: 'Checks itself against the PM sweep on the day’s row.' },
  { ItemId: 'written',   Item: 'Anything you were written to about, or fell short on, noted',
    Who: 'All', Auto: 'written', Order: 30, Active: 'Yes',
    Note: 'Checks itself against Moments dated today.' },
  { ItemId: 'portfolio', Item: 'Branch portfolio uploaded',
    Who: 'All', Auto: '', Order: 40, Active: 'No',
    Note: 'An example. Set Active to Yes, narrow Who to the desk it belongs to, or write your own.' }
];

function closeoutSheet_() {
  var sh = hrTab_(CLO, false);
  if (sh) return sh;
  sh = hrTab_(CLO, true);
  CLOSEOUT_SEED.forEach(function (s) {
    sh.appendRow(CLO.head.map(function (h) { return s[h] != null ? s[h] : ''; }));
  });
  forgetHr_(CLO);
  return sh;
}

function closeoutLogSheet_() { return hrTab_(CLOG, true); }

/** Does one line of the list apply to one person? Who is read generously:
 *  blank or All is everybody, and anything else is matched against the role
 *  key, the words of the title, the staff id and the name — because the
 *  person editing that column is typing what they call the desk, not a key
 *  from this file. */
function closeoutApplies_(who, person) {
  var w = String(who == null ? '' : who).trim().toLowerCase();
  if (!w || w === 'all' || w === 'everyone' || w === 'everybody') return true;
  var sid = String(person.staffId || '').toLowerCase();
  var name = String(person.name || '').toLowerCase();
  var key = String(person.role || '').toLowerCase();          // publicRoster_ already resolved it
  var title = normRole_((person.unit || '') + ' ' + (person.grade || ''));
  return w.split(/\s*[,;|]\s*/).filter(String).some(function (p) {
    return p === sid || p === name || p === key ||
           name.indexOf(p) > -1 || title.indexOf(p) > -1;
  });
}

/** The list for one person, in order, actives only. */
function closeoutItems_(person) {
  closeoutSheet_();
  return (hrRows_(CLO, true) || [])
    .filter(function (r) {
      var on = String(r.Active == null ? 'yes' : r.Active).trim().toLowerCase();
      if (on === 'no' || on === 'false' || on === '0') return false;
      return String(r.Item || '').trim() && closeoutApplies_(r.Who, person);
    })
    .sort(function (a, b) { return (Number(a.Order) || 0) - (Number(b.Order) || 0); })
    .map(function (r) {
      return { id: String(r.ItemId || r.Item).trim(), item: String(r.Item).trim(),
               auto: String(r.Auto || '').trim().toLowerCase() };
    });
}

/** The three the sheet can answer on its own, with the evidence each one
 *  reads from — the evidence is the point, not the tick. */
function closeoutAuto_(staffId, day) {
  var out = {};

  var due = Object.keys(scheduleFor_(staffId).blocks || {});
  if (!due.length) due = BLOCK_IDS.slice();
  var done = blocksSubmittedOn_(staffId, day).filter(function (p) { return due.indexOf(p) > -1; });
  out.blocks = { ok: done.length >= due.length,
                 detail: due.length === 1 ? (done.length ? 'your day is reported' : 'your day is not reported yet')
                                          : done.length + ' of ' + due.length + ' reported' };

  var pm = null;
  latestEntries_().forEach(function (e) {
    if (e.Date === day && String(e.StaffId) === String(staffId)) pm = parseMail_(e.MailPM);
  });
  out.mail = { ok: !!pm, detail: pm ? 'swept at ' + pm.at : 'not swept' };

  var n = momentsFor_(String(staffId), day, shiftDays_(day, 1)).length;
  out.written = { ok: n > 0, detail: n ? (n === 1 ? '1 noted today' : n + ' noted today')
                                      : 'nothing noted today' };
  return out;
}

/** What has already been answered by hand, keyed by item. */
function closeoutTicks_(staffId, day) {
  var m = {};
  (hrRows_(CLOG, true) || []).forEach(function (r) {
    if (isoDay_(r.Date) !== day || String(r.StaffId) !== String(staffId)) return;
    m[String(r.ItemId)] = { status: String(r.Status || ''), reason: String(r.Reason || ''),
                            at: timeStr_(r.At) || String(r.At || ''), source: String(r.Source || '') };
  });
  return m;
}

/** One person's close-out for one day: every line, whether it is answered,
 *  and how it came to be answered. */
function closeoutFor_(person, date) {
  var day = isoDay_(date) || todayISO_();
  var sid = String(person.staffId);
  var items = closeoutItems_(person);
  var auto = closeoutAuto_(sid, day);
  var ticks = closeoutTicks_(sid, day);

  var rows = items.map(function (it) {
    var a = it.auto ? auto[it.auto] : null;
    var t = ticks[it.id];
    /* An automatic line the sheet can see is done, is done — a person cannot
       be asked to tick what is already true, and cannot untick it either.
       An automatic line that is NOT satisfied still takes a hand tick, so
       somebody who did the thing outside the tracker can say so. */
    if (a && a.ok) {
      return { id: it.id, item: it.item, auto: it.auto, done: true,
               detail: a.detail, by: 'checked', at: '', reason: '' };
    }
    if (t && /^done$/i.test(t.status)) {
      /* A person has said an automatic line is done while the sheet still
         says otherwise — they did it somewhere the tracker cannot see. The
         line reads as their word, not as the count that disagrees with it,
         because "Every block reported ✓ · 0 of 4 reported" is a sentence
         nobody can act on. */
      return { id: it.id, item: it.item, auto: it.auto, done: true,
               detail: a ? ('said done' + (t.at ? ' at ' + t.at : '')) : '',
               by: t.source || 'ticked', at: t.at, reason: '' };
    }
    return { id: it.id, item: it.item, auto: it.auto, done: false,
             detail: a ? a.detail : '',
             by: t ? (t.source || 'answered') : '', at: t ? t.at : '',
             reason: t && /^not done$/i.test(t.status) ? (t.reason || 'not done') : '' };
  });

  var left = rows.filter(function (r) { return !r.done; }).length;
  return { ok: true, date: day, staffId: sid, name: person.name || sid,
           items: rows, of: rows.length, left: left, complete: rows.length > 0 && left === 0 };
}

/** Record one answer. Written in place, so the log reads as a day's register
 *  rather than a stream of every time somebody changed their mind. */
function closeoutWrite_(person, day, itemId, status, reason, source) {
  var sh = closeoutLogSheet_(), rows = sheetObjects_(sh), now = new Date();
  var sid = String(person.staffId), at = hhmm_(now);
  var found = null;
  rows.forEach(function (r, i) {
    if (isoDay_(r.Date) === day && String(r.StaffId) === sid && String(r.ItemId) === String(itemId)) {
      found = i + 2;
    }
  });
  var label = '';
  closeoutItems_(person).forEach(function (it) { if (it.id === String(itemId)) label = it.item; });
  var patch = { Date: day, StaffId: sid, Name: person.name || sid, ItemId: String(itemId),
                Item: label, Status: status, Reason: reason || '', At: at, Source: source || 'screen' };
  if (found) writeRow_(sh, found, colMap_(sh), patch);
  else sh.appendRow(CLOG.head.map(function (h) { return patch[h] != null ? patch[h] : ''; }));
  forgetHr_(CLOG);
  return at;
}

function tickCloseout_(data, profile) {
  var person = rosterPerson_(profile.staffId) || profile;
  var day = isoDay_(data.date) || todayISO_();
  var itemId = String(data.itemId || '').trim();
  if (!itemId) return { ok: false, error: 'Which one?' };
  var status = /^not/i.test(String(data.status || '')) ? 'Not done' : 'Done';
  var reason = String(data.reason || '').trim();
  if (status === 'Not done' && !reason) return { ok: false, error: 'Say what stopped it — one line is enough.' };
  var known = closeoutItems_(person).some(function (it) { return it.id === itemId; });
  if (!known) return { ok: false, error: 'That is not on your list.' };
  closeoutWrite_(person, day, itemId, status, reason, 'screen');
  return closeoutFor_(person, day);
}

/** The roster row behind a signed-in profile, so Who can be matched against
 *  the title and not only the id. */
function rosterPerson_(staffId) {
  var hit = null;
  publicRoster_().forEach(function (p) { if (String(p.staffId) === String(staffId)) hit = p; });
  return hit;
}

// ---- the link in the e-mail ----------------------------------------------
//  A tick has to work from the phone that opened the mail, with nobody
//  signed in — so the link carries its own proof. It is a signature over the
//  person and the day, which means it opens one person's list, for one day,
//  and is worth nothing tomorrow.

function closeoutSecret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('CLOSEOUT_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('CLOSEOUT_SECRET', s); }
  return s;
}

function closeoutSig_(staffId, day) {
  var raw = Utilities.computeHmacSha256Signature(String(staffId) + '|' + String(day), closeoutSecret_());
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '').slice(0, 22);
}

function closeoutUrl_(staffId, day, itemId) {
  var base = PropertiesService.getScriptProperties().getProperty('KPI_EXEC_URL') ||
             ScriptApp.getService().getUrl() || '';
  return base + '?co=' + encodeURIComponent(staffId) + '&d=' + encodeURIComponent(day) +
         '&k=' + encodeURIComponent(closeoutSig_(staffId, day)) +
         (itemId ? '&i=' + encodeURIComponent(itemId) : '');
}

/** The GET behind every tick link. Returns a page, or null when the request
 *  is not one of ours — doGet hands it every GET before falling through to
 *  the JSON API. */
function closeoutClick_(e) {
  var p = (e && e.parameter) || {};
  var sid = String(p.co || '').trim();
  if (!sid) return null;
  var day = isoDay_(p.d) || todayISO_();
  if (String(p.k || '') !== closeoutSig_(sid, day)) {
    return closeoutPage_('That link has expired.',
      'Close-out links are good for the day they were sent. Open the tracker and close the day there.', null);
  }
  var person = rosterPerson_(sid);
  if (!person) return closeoutPage_('That link has expired.', 'The desk is no longer on the register.', null);

  var itemId = String(p.i || '').trim();
  if (itemId && closeoutItems_(person).some(function (it) { return it.id === itemId; })) {
    closeoutWrite_(person, day, itemId, 'Done', '', 'email');
  }
  var state = closeoutFor_(person, day);
  return closeoutPage_(
    state.complete ? 'That is the day closed.' : 'Recorded.',
    state.complete
      ? 'Everything on your list is in for ' + prettyDate_(day) + '. Nothing further tonight.'
      : 'Tap anything else you have done. What is left is below.',
    state);
}

function closeoutPage_(head, body, state) {
  var rows = !state ? '' : state.items.map(function (r) {
    if (r.done) {
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:11px 0;border-bottom:1px solid #e8eaf0">' +
        '<span style="color:#2C7A57;font-weight:800">&#10003;</span>' +
        '<span><b style="color:#1F2433">' + esc_(r.item) + '</b>' +
        (r.detail ? '<span style="color:#6A7180"> &middot; ' + esc_(r.detail) + '</span>' : '') + '</span></div>';
    }
    return '<div style="padding:11px 0;border-bottom:1px solid #e8eaf0">' +
      '<a href="' + esc_(closeoutUrl_(state.staffId, state.date, r.id)) + '" ' +
        'style="display:block;text-decoration:none;color:#141C4A"><b>' + esc_(r.item) + '</b>' +
      (r.detail ? '<span style="color:#6A7180"> &middot; ' + esc_(r.detail) + '</span>' : '') +
      '<div style="margin-top:5px;font-size:13px;font-weight:700;color:#D97A06">Tap to mark it done &rarr;</div>' +
      '</a></div>';
  }).join('');

  var html = '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Before you leave</title>' +
    '<div style="font:15px/1.55 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
      'max-width:560px;margin:0 auto;padding:34px 20px;color:#1F2433">' +
    '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0EA5C9">' +
      'Ricky Rampersad Branch</div>' +
    '<h1 style="font-size:23px;margin:6px 0 8px;color:#141C4A">' + esc_(head) + '</h1>' +
    '<p style="margin:0 0 18px;color:#6A7180">' + esc_(body) + '</p>' +
    (rows ? '<div style="border-top:1px solid #e8eaf0">' + rows + '</div>' : '') +
    '</div>';
  return HtmlService.createHtmlOutput(html)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---- the quarter-to-four mail ---------------------------------------------

function closeoutMailHtml_(state) {
  var rows = state.items.map(function (r) {
    if (r.done) {
      return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.green +
        ';border-radius:9px;padding:11px 14px;margin-bottom:8px">' +
        '<span style="color:' + MAIL.green + ';font-weight:700">&#10003;</span> ' +
        '<span style="font-size:14px">' + esc_(r.item) + '</span>' +
        (r.detail ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:2px">' + esc_(r.detail) + '</div>' : '') +
        '</div>';
    }
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.amber +
      ';border-radius:9px;padding:11px 14px;margin-bottom:8px">' +
      '<div style="font-size:14px">' + esc_(r.item) + '</div>' +
      (r.detail ? '<div style="font-size:12px;color:' + MAIL.muted + ';margin-top:2px">' + esc_(r.detail) + '</div>' : '') +
      '<a href="' + esc_(closeoutUrl_(state.staffId, state.date, r.id)) + '" ' +
        'style="display:inline-block;margin-top:8px;padding:7px 15px;border-radius:999px;background:' + MAIL.navy +
        ';color:#fff;text-decoration:none;font-size:12.5px;font-weight:700">Mark it done</a>' +
      '</div>';
  }).join('');

  var lead = state.complete
    ? 'Everything on your list is already in. Nothing to do — this is the receipt.'
    : (state.left === state.of
        ? 'None of it is in yet. There is a working hour left; tap each one as you finish it.'
        : state.left + ' of ' + state.of + ' still to go. Tap each one as you finish it.');

  return shell_('Before you leave', esc_(state.name) + ' · ' + prettyDate_(state.date),
    '<div style="background:' + MAIL.paper + ';border:1px solid ' + MAIL.gold +
      ';border-radius:10px;padding:13px 15px;font-size:14px;line-height:1.55;margin-bottom:16px">' +
      lead + '</div>' +
    sectionLabel_('Your list') + rows +
    '<div style="font-size:13px;color:' + MAIL.muted + ';line-height:1.55;margin-top:6px">' +
      'Tapping records it against today, on the register, at the minute you tapped. ' +
      'The list is the branch’s — if something on it is not yours, say so and it comes off.' +
    '</div>');
}

/** Quarter to four, to everybody whose day is open. Nobody who did not sign
 *  in is written to: an unopened day is an absent day, and there is nothing
 *  in it to close. */
function sendCloseout(dateOpt) {
  // The fixed 3:45 mail went to everybody at once, including Liz who leaves at
  // 3. Each person now gets "Before you leave" half an hour before their own
  // finishing time (housekeepingTick_). Run by hand, this still works.
  if (dateOpt && dateOpt.triggerUid) return 'Replaced by the per-person housekeeping e-mail.';
  var day = isoDay_(dateOpt && dateOpt.date) || isoDay_(dateOpt) || todayISO_();
  if (nothingToReport_(dateOpt)) return 'Nobody signed in — no close-out sent.';

  var open = {};
  (hrRows_(ATT, true) || []).forEach(function (r) {
    if (isoDay_(r.Date) !== day) return;
    var st = String(r.Status || 'in').toLowerCase();
    if (st === 'absent') return;
    if (timeStr_(r.FirstSignIn)) open[String(r.StaffId)] = true;
  });

  var sent = [], clear = [];
  publicRoster_().forEach(function (p) {
    if (!open[String(p.staffId)]) return;
    var to = emailFor_(p.staffId);
    if (!to) return;
    var state = closeoutFor_(p, day);
    if (!state.of) return;                       // an empty list is not worth an e-mail
    if (state.complete) { clear.push(p.name); return; }
    MailApp.sendEmail({
      to: to, cc: dayStartCc_(to).join(',') || undefined,
      subject: 'Before you leave · ' + shortDate_(day) + ' · ' + state.left +
               (state.left === 1 ? ' thing left' : ' things left'),
      htmlBody: closeoutMailHtml_(state)
    });
    sent.push(p.name + ' (' + state.left + ')');
  });

  var msg = (sent.length ? 'Close-out sent to: ' + sent.join(', ') : 'Close-out: nobody had anything outstanding')
          + (clear.length ? '. Already clear: ' + clear.join(', ') : '') + '.';
  Logger.log(msg);
  return msg;
}

// ---- editing the list from the editor -------------------------------------

/** Add a line to the close-out. closeoutAdd('Upload the branch portfolio')
 *  puts it in front of everybody tonight; a second argument narrows it to a
 *  desk — a role (bma, um, bm, sales support), a name, or a staff id. */
function closeoutAdd(item, who) {
  var text = String(item || '').trim();
  if (!text) throw new Error('closeoutAdd("what has to be true before they leave", "who")');
  var sh = closeoutSheet_(), rows = hrRows_(CLO, true) || [];
  var id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  var taken = {}; rows.forEach(function (r) { taken[String(r.ItemId)] = 1; });
  var base = id, n = 2; while (taken[id]) id = base + '-' + (n++);
  var order = rows.reduce(function (a, r) { return Math.max(a, Number(r.Order) || 0); }, 0) + 10;
  sh.appendRow(CLO.head.map(function (h) {
    return { ItemId: id, Item: text, Who: String(who || 'All'), Auto: '', Order: order,
             Active: 'Yes', Note: '' }[h];
  }));
  forgetHr_(CLO);
  return 'Added "' + text + '" for ' + (who || 'All') + '. It is on the list from this evening.';
}

/** What is on the list, and who each line is for. */
function closeoutList() {
  closeoutSheet_();
  var out = (hrRows_(CLO, true) || []).map(function (r) {
    return (String(r.Active).toLowerCase() === 'no' ? '  ·  ' : '  ✓  ') +
      String(r.Item) + '   [' + String(r.Who || 'All') + ']' +
      (r.Auto ? '   checks itself (' + r.Auto + ')' : '');
  }).join('\n');
  Logger.log(out);
  return out;
}

/** What the whole branch left behind on a day — the manager's read. */
function closeoutDay(dateOpt) {
  var day = isoDay_(dateOpt) || todayISO_();
  var lines = publicRoster_().map(function (p) {
    var s = closeoutFor_(p, day);
    if (!s.of) return null;
    return p.name + ': ' + (s.of - s.left) + ' of ' + s.of +
      (s.left ? '  — left: ' + s.items.filter(function (r) { return !r.done; })
                                      .map(function (r) { return r.item; }).join('; ') : '');
  }).filter(Boolean).join('\n');
  Logger.log(lines);
  return lines;
}

// ---------------------------------------------------------------------------
//  The block that closes itself
//
//  "At the end of the time block the system should automatically log, as it
//  reads the Salesforce environment, and send the email at the end of the
//  time block with the % achieved — what I selected to have completed and
//  what was achieved. If not achieved, in the email I am to respond to each
//  as to why, and the responses stored." (17 September 2026.)
//
//  So a block has three moments now, and only the first needs the person:
//
//    PLAN    before or during the block they say what it is for — tasks
//            picked off their own Salesforce book, and anything Salesforce
//            cannot see (a recruit interviewed, a coaching session) typed in.
//    CLOSE   when the block's own end time has passed, the hourly closer
//            reads Salesforce: which of the picked tasks are completed now,
//            and what else was closed or moved inside the window. A block
//            the person never filed is filed for them from that, and marked
//            as filed that way. One they filed themselves is left alone.
//    ANSWER  only when something was missed does an e-mail go out, and every
//            missed item on it carries a link to say why. The answer is kept
//            against the item and the day, and shows in the tracker. A clean
//            block passes in silence — an e-mail that arrives when nothing is
//            wrong teaches people to stop opening them.
//
//  What the closer will not do: overwrite a block the person filed; count a
//  task as done that Salesforce says is open; write to anybody whose day was
//  never opened, or about a block that ended before they signed in; or write
//  at all when Salesforce did not answer — "not achieved" has to be a fact
//  before it is put to somebody as one.
// ---------------------------------------------------------------------------

var BPLAN = { must: ['Date', 'StaffId', 'Block', 'Items'], name: 'Block Plans',
              head: ['Date', 'StaffId', 'Name', 'Block', 'Items', 'PlannedAt', 'UpdatedAt',
                     'ClosedAt', 'Achieved', 'Of', 'Pct', 'SFClosed', 'SFMoved', 'Emailed',
                     'Filed', 'Note'] };
var BREASON = { must: ['Date', 'StaffId', 'Block', 'Item'], name: 'Block Reasons',
                head: ['Date', 'StaffId', 'Name', 'Block', 'Item', 'Label', 'Reason', 'At', 'Source'] };
var PLAN_MAX_ITEMS = 30, PLAN_TEXT_MAX = 160, REASON_MAX = 600;

/** '8 – 10am' -> { start: 480, end: 600 }, minutes from midnight.
 *
 *  The schedule writes the end with its am/pm and usually leaves it off the
 *  start — '1 – 3pm', '11 – 1pm', '10 – 12pm'. A bare start hour could be
 *  either, so the reading that makes the shorter block wins: '1 – 3pm' is
 *  two hours, not fourteen. '12am' as an END is midnight, the close of the
 *  day, which is where the Branch Manager's after-four block runs to. */
function parseSpan_(time) {
  var m = String(time || '').match(
    /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i);
  if (!m) return null;
  var eh = Number(m[4]) % 12, em = Number(m[5] || 0), es = m[6].toLowerCase();
  var end = (es === 'am' && Number(m[4]) === 12) ? 24 * 60
          : (es === 'pm' ? eh + 12 : eh) * 60 + em;
  var sh = Number(m[1]) % 12, sm = Number(m[2] || 0), ss = (m[3] || '').toLowerCase();
  var cands = ss ? [(ss === 'pm' ? sh + 12 : sh) * 60 + sm] : [sh * 60 + sm, (sh + 12) * 60 + sm];
  var start = null;
  cands.forEach(function (c) { if (c < end && (start === null || end - c < end - start)) start = c; });
  return start === null ? null : { start: start, end: end };
}

/** This person's block, as minutes. A block the schedule does not time is
 *  not a block the closer can close, so there is no guess here. */
function blockSpan_(staffId, blockId) {
  var sc = scheduleFor_(staffId);
  var b = sc && sc.blocks && sc.blocks[blockId];
  return b && b.time ? parseSpan_(b.time) : null;
}

function mmText_(m) {
  if (m == null) return '';
  var h = Math.floor(m / 60) % 24, mi = m % 60;
  return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
}

/* Port of Spain is UTC-4 all year, as sfkMetrics_ already assumes. The day
   can roll: the after-four block ends at local midnight, which is 04:00Z the
   next morning. */
function sfkUtcAt_(day, minutes) {
  var m = minutes + 240, d = day;
  while (m >= 1440) { d = shiftDays_(d, 1); m -= 1440; }
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d + 'T' + p(Math.floor(m / 60)) + ':' + p(m % 60) + ':00Z';
}

// ---- the plan ---------------------------------------------------------------

function planItemsOf_(v) {
  try { var a = JSON.parse(String(v == null || v === '' ? '[]' : v)); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}

/** This person's plan rows for a day, keyed by block. The Items cell stays
 *  as the sheet holds it; planItemsOf_ reads it. */
function planRows_(staffId, date) {
  var out = {};
  (hrRows_(BPLAN, true) || []).forEach(function (r) {
    if (isoDay_(r.Date) !== date || String(r.StaffId) !== String(staffId)) return;
    out[String(r.Block || '').toUpperCase()] = r;
  });
  return out;
}

/** Upsert one block's row. The caller holds the lock. */
function planWrite_(person, date, blockId, patch) {
  var sh = hrTab_(BPLAN, true), rows = sheetObjects_(sh), now = new Date(), at = 0;
  for (var i = 0; i < rows.length; i++) {
    if (isoDay_(rows[i].Date) === date && String(rows[i].StaffId) === String(person.staffId) &&
        String(rows[i].Block || '').toUpperCase() === blockId) { at = i + 2; break; }
  }
  var p = {};
  Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
  if (p.Items != null && typeof p.Items !== 'string') p.Items = JSON.stringify(p.Items);
  p.UpdatedAt = now;
  if (at) writeRow_(sh, at, colMap_(sh), p);
  else {
    var o = { Date: date, StaffId: person.staffId, Name: person.name || person.staffId,
              Block: blockId, PlannedAt: now };
    Object.keys(p).forEach(function (k) { o[k] = p[k]; });
    sh.appendRow(BPLAN.head.map(function (h) { return o[h] != null ? o[h] : ''; }));
  }
  forgetHr_(BPLAN);
}

function spanOut_(sp) {
  return sp ? { start: sp.start, end: sp.end, startText: mmText_(sp.start), endText: mmText_(sp.end) } : null;
}

/** One block's plan as the screen and the e-mail read it. */
function planOut_(r, staffId, blockId) {
  return {
    block: blockId,
    items: r ? planItemsOf_(r.Items) : [],
    closedAt: r ? (timeStr_(r.ClosedAt) || '') : '',
    achieved: r ? n_(r.Achieved) : null,
    of: r ? n_(r.Of) : null,
    pct: r ? n_(r.Pct) : null,
    sfClosed: r ? n_(r.SFClosed) : null,
    sfMoved: r ? n_(r.SFMoved) : null,
    filed: r ? String(r.Filed || '') : '',
    emailed: !!(r && String(r.Emailed || '').trim()),
    note: r ? String(r.Note || '') : '',
    span: spanOut_(blockSpan_(staffId, blockId))
  };
}

/** What a plan may hold: a Salesforce task by its Id, or a line of the
 *  person's own words. Anything else is dropped rather than refused, so a
 *  stale screen cannot stop a save. */
function cleanPlanItems_(raw) {
  var list = Array.isArray(raw) ? raw : [];
  if (list.length > PLAN_MAX_ITEMS) return { error: 'Thirty things is a week, not a day. Pick fewer.' };
  var out = [], seen = {};
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    if (it.k === 'sf') {
      var id = String(it.id || '').trim();
      if (!/^[A-Za-z0-9]{15,18}$/.test(id) || seen['sf:' + id]) continue;
      seen['sf:' + id] = 1;
      out.push({ k: 'sf', id: id, subject: shorten_(it.subject, PLAN_TEXT_MAX),
                 type: shorten_(it.type, 40) });
    } else if (it.k === 'own') {
      var label = String(it.label || '').replace(/\s+/g, ' ').trim();
      if (!label || seen['own:' + label.toLowerCase()]) continue;
      seen['own:' + label.toLowerCase()] = 1;
      out.push({ k: 'own', label: shorten_(label, PLAN_TEXT_MAX), done: it.done === true });
    }
  }
  return { list: out };
}

function planScope_(profile, data) {
  var staffId = String((profile.manager || !data.staffId) ? (data.staffId || profile.staffId) : profile.staffId);
  if (staffId !== profile.staffId && !profile.manager && !isLeadOf_(profile, staffId)) return null;
  return staffId;
}

/** The day's plans and every block's window, for the screen. */
function plansFor_(profile, data) {
  var staffId = planScope_(profile, data || {});
  if (!staffId) return { ok: false, error: 'Not yours to read.' };
  var date = isoDay_((data || {}).date) || todayISO_();
  var rows = planRows_(staffId, date), plans = {}, spans = {};
  BLOCK_IDS.forEach(function (b) {
    var sp = blockSpan_(staffId, b);
    if (sp) spans[b] = spanOut_(sp);
    if (rows[b]) plans[b] = planOut_(rows[b], staffId, b);
  });
  return { ok: true, staffId: staffId, date: date, plans: plans, spans: spans, now: hhmm_(new Date()) };
}

/** Say what a block is for. Until it closes it can be changed as often as
 *  the person likes; after that the answer is a reason, not a new plan. */
function savePlan_(data, profile) {
  var staffId = planScope_(profile, data);
  if (!staffId || (staffId !== profile.staffId && !profile.manager)) return { ok: false, error: 'Not yours to plan.' };
  var date = isoDay_(data.date) || todayISO_();
  var blockId = String(data.block || '').toUpperCase();
  if (BLOCK_IDS.indexOf(blockId) === -1) return { ok: false, error: 'Unknown block: ' + blockId };
  var items = cleanPlanItems_(data.items);
  if (items.error) return { ok: false, error: items.error };
  var person = rosterPerson_(staffId) || { staffId: staffId, name: profile.name };
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    var have = planRows_(staffId, date)[blockId];
    if (have && String(have.ClosedAt || '').trim()) {
      return { ok: false, error: 'Your day has closed. Answer what was missed rather than re-planning it.',
               plan: planOut_(have, staffId, blockId) };
    }
    markStaffWrite_();
    planWrite_(person, date, blockId, { Items: items.list });
    var saved = planOut_(planRows_(staffId, date)[blockId], staffId, blockId);
    lock.releaseLock(); lock = null;
    // A real plan, with Salesforce tasks picked into it, gets its own e-mail
    // once a day: "Plan received", copied the same way as the day start.
    if (items.list.some(function (it) { return it.k === 'sf'; })) {
      try { sendDayStart_(staffId, date, 'plan'); } catch (dsErr) {}
    }
    return { ok: true, plan: saved };
  } finally { if (lock) lock.releaseLock(); }
}

// ---------------------------------------------------------------------------
//  A line of the plan, made into a Salesforce task
//
//  "If it is asking for any task that they are doing that is not related to
//  Salesforce, can't our system add it to Salesforce ... a subject line,
//  assigned to the user, and asking the due date, so the task is created —
//  because everything is driven by task." (18 September 2026.)
//
//  A line somebody types is a promise only they can confirm. The same line as
//  a task is one the closer reads back out of Salesforce at the end of the
//  block, and one that shows up in the open book, the checkpoint, the
//  reports and the wall like every other piece of work. So the plan offers to
//  create it, and then carries the task rather than the words.
//
//  The write is here rather than in KPI-Write.gs so the whole of this lands in
//  one paste. It still goes through that file's audit trail when it is
//  present: every write this tool makes to Salesforce is on the record.
// ---------------------------------------------------------------------------

/** POST one record. Returns its Id. Throws with Salesforce's own words. */
function sfkInsert_(object, body) {
  function send(tok) {
    return UrlFetchApp.fetch(
      tok.instance_url + '/services/data/' + SFK.API + '/sobjects/' + object,
      { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + tok.access_token },
        payload: JSON.stringify(body) });
  }
  var tok = sfkToken_();
  var res = send(tok);
  if (res.getResponseCode() === 401) {          // the token aged out mid-write
    sfkProps_().deleteProperty('SFK_TOKEN');
    res = send(sfkToken_());
  }
  var code = res.getResponseCode(), text = res.getContentText();
  if (code !== 201 && code !== 200) throw new Error(sfkSaid_(text));
  var out = {};
  try { out = JSON.parse(text); } catch (e) {}
  if (!out.id) throw new Error(sfkSaid_(text));
  return String(out.id);
}

/** The first sentence Salesforce actually said, rather than its JSON. */
function sfkSaid_(text) {
  var t = String(text || '').trim();
  try {
    var j = JSON.parse(t);
    var one = Array.isArray(j) ? j[0] : j;
    if (one && one.message) {
      var f = one.fields && one.fields.length ? ' (' + one.fields.join(', ') + ')' : '';
      return String(one.message) + f;
    }
  } catch (e) {}
  return t.length > 300 ? t.slice(0, 300) : t;
}

/** Whatever the branch's own day depends on, forgotten, so a task created at
 *  nine is in the nine-o'clock book and not the one cached at eight. */
function sfkForgetDay_(day) {
  try {
    CacheService.getScriptCache().removeAll(
      ['sfk_m_' + day, 'sfk_nr_' + day, 'sfk_ob_' + day, 'sfk_cw_' + day,
       'sfk_bill_' + day, 'sfk_wall']);
  } catch (e) {}
}

/** Create one task for the person planning the block, and put it on the plan
 *  in place of the line it came from. */
function createTask_(data, profile) {
  if (typeof sfkConfigured_ !== 'function' || !sfkConfigured_())
    return { ok: false, error: 'Salesforce is not connected, so a task cannot be created yet.' };

  // Own plan only. A manager can read anybody's day, but a task in somebody
  // else's name, created from a screen they are not looking at, is a task
  // nobody owns.
  var staffId = String(data.staffId || profile.staffId);
  if (staffId !== profile.staffId)
    return { ok: false, error: 'A task can only be created on your own plan.' };

  var subject = String(data.subject || '').replace(/\s+/g, ' ').trim();
  if (subject.length < 4) return { ok: false, error: 'Give the task a subject.' };
  if (subject.length > 255) subject = subject.slice(0, 255);

  var type = String(data.type || '').trim();
  if (!SF_TYPES[type]) return { ok: false, error: 'Pick a type Salesforce knows.' };

  var due = isoDay_(data.due) || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: 'Give it a due date.' };

  var users = sfkUsers_();
  var u = users[staffId];
  if (!u || !u.id)
    return { ok: false, error: 'No Salesforce user is matched to you yet. Ask the Branch Manager to run sfKpiTest.' };

  var id;
  try {
    id = sfkInsert_('Task', {
      Subject: subject, OwnerId: u.id, ActivityDate: due,
      // In Progress, not Not Started: it is on a block of today's plan, which
      // is somebody saying they are working it now.
      Status: 'In Progress', Task_Type__c: type
    });
  } catch (e) {
    if (typeof audit_ === 'function') audit_(profile, '', 'create', '', subject, 'FAILED: ' + e.message);
    return { ok: false, error: 'Salesforce refused it: ' + e.message };
  }
  if (typeof audit_ === 'function')
    audit_(profile, id, 'create', '', subject + ' \u00b7 ' + type + ' \u00b7 due ' + due, 'OK');
  sfkForgetDay_(todayISO_());
  if (due !== todayISO_()) sfkForgetDay_(due);

  var item = { k: 'sf', id: id, subject: subject, type: type };
  var out = { ok: true, id: id, item: item, due: due, type: type, subject: subject, swapped: false };

  // Put it on the plan. The line it replaces is found by the words that were
  // typed, not by where it sat, so a screen that has since reordered cannot
  // swap the wrong one.
  var date = isoDay_(data.date) || todayISO_();
  var blockId = String(data.block || '').toUpperCase();
  if (BLOCK_IDS.indexOf(blockId) === -1) return out;
  var label = String(data.label || '').replace(/\s+/g, ' ').trim();
  var lock = takeLock_();
  if (!lock) { out.note = 'The task is in Salesforce. The plan was busy — it will show on the next read.'; return out; }
  try {
    var row = planRows_(staffId, date)[blockId];
    if (row && String(row.ClosedAt || '').trim()) {
      out.note = 'The task is in Salesforce. Your day has already closed, so the plan was left as it was.';
      return out;
    }
    var items = row ? planItemsOf_(row.Items) : [];
    var next = [], swapped = false;
    items.forEach(function (x) {
      if (!swapped && x.k === 'own' && label &&
          String(x.label || '').toLowerCase() === label.toLowerCase()) {
        next.push(item); swapped = true;
      } else next.push(x);
    });
    if (!swapped) next.push(item);
    var clean = cleanPlanItems_(next);
    if (clean.error) { out.note = clean.error; return out; }
    var person = rosterPerson_(staffId) || { staffId: staffId, name: profile.name };
    markStaffWrite_();
    planWrite_(person, date, blockId, { Items: clean.list });
    out.swapped = swapped;
    out.plan = planOut_(planRows_(staffId, date)[blockId], staffId, blockId);
    return out;
  } finally { lock.releaseLock(); }
}

/** The types a task can carry, for the screen that offers to create one. */
function sfTaskTypes_() {
  return sfTypeList_().map(function (t) { return { value: t, label: SF_TYPES[t] }; });
}


// ---- what Salesforce saw ----------------------------------------------------

/** Every task this person touched inside the block, split by how it was
 *  left. Null when Salesforce is not wired; throws when it does not answer,
 *  and the closer treats the two differently. */
function sfkBlockActivity_(staffId, day, span) {
  if (!sfkConfigured_()) return null;
  var u = sfkUsers_()[staffId];
  if (!u) return null;
  var from = sfkUtcAt_(day, span.start), to = sfkUtcAt_(day, span.end);
  var recs = sfkQuery_(
    'SELECT Id, Subject, Status, Task_Type__c, CompletedDateTime, LastModifiedDate FROM Task' +
    " WHERE OwnerId = '" + u.id + "' AND LastModifiedDate >= " + from + ' AND LastModifiedDate < ' + to +
    " AND (NOT Subject LIKE '%Happy Birthday%') ORDER BY LastModifiedDate LIMIT 200");
  var closed = [], moved = [], touched = {};
  recs.forEach(function (r) {
    var it = { id: String(r.Id), subject: shorten_(r.Subject, 110), type: String(r.Task_Type__c || '') };
    var done = String(r.Status) === 'Completed';
    touched[it.id] = done ? 'done' : 'moved';
    (done ? closed : moved).push(it);
  });
  return { closed: closed, moved: moved, touched: touched, from: from, to: to };
}

/** Where the picked tasks stand now, by Id. */
function sfkTaskStates_(ids) {
  var out = {};
  if (!ids.length) return out;
  sfkQuery_('SELECT Id, Status FROM Task WHERE Id IN (' +
    ids.map(function (i) { return "'" + String(i).replace(/'/g, '') + "'"; }).join(',') + ')')
    .forEach(function (r) { out[String(r.Id)] = String(r.Status || ''); });
  return out;
}

// ---- the closer -------------------------------------------------------------

/** Hourly. Closes every block whose end has passed for everybody whose day is
 *  open, once. In the small hours it also looks at yesterday, because the
 *  after-four block ends at midnight. Run it from the editor to close what
 *  is due now. */
function closeBlocks(e) {
  var now = new Date(), day = todayISO_();
  var nowMin = minutesOf_(hhmm_(now)) || 0;
  var lines = [], days = [day];
  if (nowMin < 3 * 60) days.unshift(shiftDays_(day, -1));
  days.forEach(function (d) {
    var att = {};
    try {
      attendanceFor_({ staffId: '', manager: true }, d, shiftDays_(d, 1))
        .forEach(function (o) { att[o.staffId] = o; });
    } catch (err) {}
    publicRoster_().forEach(function (p) {
      var a = att[p.staffId];
      if (!a || a.status === 'absent' || !a.at) return;      // a day never opened has nothing to close
      var inAt = minutesOf_(a.at) || 0;
      var sc = scheduleFor_(p.staffId), plans = null;
      BLOCK_IDS.forEach(function (b) {
        var blk = sc.blocks && sc.blocks[b];
        if (!blk || !blk.time) return;
        var span = blockSpan_(p.staffId, b);
        if (!span) return;
        if (d === day && span.end > nowMin) return;           // still running
        if (!plans) plans = planRows_(p.staffId, d);
        if (plans[b] && String(plans[b].ClosedAt || '').trim()) return;   // closed already
        var line = closeBlock_(p, d, b, span, plans[b] || null, now, inAt);
        if (line) lines.push(line);
      });
    });
  });
  var msg = lines.length ? lines.join('\n') : 'Nothing to close at ' + hhmm_(now) + '.';
  Logger.log(msg);
  return msg;
}

/** One block, closed: the verdict on the plan, the filing if there was none,
 *  the record, and the e-mail only if something was missed. */
function closeBlock_(p, day, b, span, planRow, now, inAt) {
  var sid = p.staffId, at = hhmm_(now), tag = sid + ' ' + b + ' (' + mmText_(span.start) + '–' + mmText_(span.end) + ')';
  var items = planRow ? planItemsOf_(planRow.Items) : [];
  var sfIds = items.filter(function (i) { return i.k === 'sf'; }).map(function (i) { return i.id; });
  var lateIn = inAt > span.end;

  var act = null, states = null;
  if (sfkConfigured_()) {
    try {
      act = sfkBlockActivity_(sid, day, span);
      states = sfkTaskStates_(sfIds);
    } catch (err) {
      /* Not a verdict. Left open, so the next hour asks again. */
      return tag + ': Salesforce did not answer (' + String(err && err.message || err).slice(0, 80) + '), next hour';
    }
  }

  var done = 0, known = 0, missed = 0;
  items.forEach(function (it) {
    if (it.k === 'own') it.state = it.done ? 'done' : 'unconfirmed';
    else if (!states) it.state = 'unknown';
    else if (states[it.id] === 'Completed') it.state = 'done';
    else if (act && act.touched[it.id]) it.state = 'moved';
    else it.state = 'open';
    if (it.state === 'unknown') return;
    known++;
    if (it.state === 'done') done++; else missed++;
  });
  var of = items.length, pct = known ? Math.round(done / known * 100) : null;
  var saw = !!(act && (act.closed.length || act.moved.length));

  var filedBy = '', note = '';
  var lock = takeLock_();
  if (!lock) return tag + ': the sheet is busy, next hour';
  try {
    var sh = logSheet_(), idx = colMap_(sh), head = headerOf_(sh);
    var found = findDayRow_(sh, idx, sid, day), v = found.vals;
    var filed = !!(v && (hasText_(v[idx[b + '_Actioned']]) || (idx[b + '_At'] != null && v[idx[b + '_At']])));
    if (filed) filedBy = 'person';
    else if (saw || items.length) {
      var missedLabels = items.filter(function (it) { return it.state !== 'done'; })
        .map(function (it) { return it.k === 'sf' ? it.subject : it.label; });
      var patch = {};
      patch[b] = String((scheduleFor_(sid).blocks[b] || {}).kpi || '');
      patch[b + '_Actioned'] = 'Closed automatically at ' + at +
        (act ? ' from Salesforce: ' + act.closed.length + ' closed, ' + act.moved.length + ' moved' : '') +
        (of ? ' · planned ' + of + ', done ' + done : '') + '.';
      patch[b + '_Resolved'] = act ? act.closed.map(function (t) { return t.subject; }).join('; ') : '';
      patch[b + '_Open'] = missedLabels.join('; ');
      patch[b + '_Quality'] = 'auto';
      patch[b + '_At'] = now;
      if (of && pct != null) patch[b + '_Met'] = pct >= 100 ? 'met' : pct > 0 ? 'partly' : 'no';
      patch.UpdatedAt = now; patch.Revision = found.revision + 1; patch.Status = 'Submitted';
      if (found.row) writeRow_(sh, found.row, idx, patch);
      else {
        patch.Timestamp = now; patch.Date = day; patch.StaffId = sid; patch.Name = p.name || sid;
        sh.appendRow(head.map(function (h) { return (h in patch) ? patch[h] : ''; }));
      }
      filedBy = 'auto';
    }
    var nothing = !items.length && !filed && !saw;
    if (nothing) note = 'nothing planned, filed, closed or moved';
    if (!sfkConfigured_() && sfIds.length) note = (note ? note + '; ' : '') + 'Salesforce not wired, picked tasks unverified';
    var ask = !lateIn && (missed > 0 || nothing);
    if (lateIn) note = (note ? note + '; ' : '') + 'ended before sign-in at ' + mmText_(inAt);
    planWrite_(p, day, b, { Items: items, ClosedAt: at, Achieved: done, Of: of,
                            Pct: pct == null ? '' : pct,
                            SFClosed: act ? act.closed.length : '', SFMoved: act ? act.moved.length : '',
                            Emailed: ask ? at : '', Filed: filedBy, Note: note });
  } finally { lock.releaseLock(); }

  var mailed = '';
  if (ask) {
    try { mailed = emailBlockClose_(p, day, b, span, items, act, done, of, pct, at, nothing) ? ', e-mailed' : ', no address to e-mail'; }
    catch (mailErr) { mailed = ', e-mail failed'; }
  }
  return tag + ': ' + (of ? done + '/' + of + ' done' : 'no plan') +
    (act ? ', Salesforce closed ' + act.closed.length + ' moved ' + act.moved.length : ', Salesforce not read') +
    (filedBy === 'auto' ? ', filed for them' : filedBy === 'person' ? ', they filed it' : ', nothing to file') +
    (lateIn ? ', ended before sign-in' : mailed || ', clean');
}

// ---- the e-mail, and the links in it ----------------------------------------

function execBase_() {
  return PropertiesService.getScriptProperties().getProperty('KPI_EXEC_URL') ||
         ScriptApp.getService().getUrl() || '';
}

function blockSig_(staffId, day, blockId) {
  var raw = Utilities.computeHmacSha256Signature(
    String(staffId) + '|' + String(day) + '|' + String(blockId) + '|block', closeoutSecret_());
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '').slice(0, 22);
}

function blockUrl_(staffId, day, blockId, item, action) {
  return execBase_() + '?bk=' + encodeURIComponent(staffId) + '&d=' + encodeURIComponent(day) +
         '&b=' + encodeURIComponent(blockId) + '&i=' + encodeURIComponent(item) +
         '&a=' + encodeURIComponent(action) + '&k=' + encodeURIComponent(blockSig_(staffId, day, blockId));
}

function itemLabel_(it) { return it.k === 'sf' ? (it.subject || 'a Salesforce task') : (it.label || ''); }
function stateWord_(it) {
  return { done: 'done', moved: 'moved, not closed', open: 'still open', unconfirmed: 'not ticked',
           unknown: 'not checked', explained: 'reason given' }[it.state] || it.state || '';
}

function emailBlockClose_(p, day, b, span, items, act, done, of, pct, at, nothing) {
  var to = emailFor_(p.staffId);
  if (!to) return false;
  var lab = blockLabel_(b), when = mmText_(span.start) + '–' + mmText_(span.end);
  var left = of - done;
  var lead = nothing
    ? 'Nothing was recorded for your day — no plan, nothing filed, and Salesforce saw nothing ' +
      'closed or moved between ' + when + '. Say what you were on and it goes on the record.'
    : done + ' of ' + of + ' done — <b>' + pct + '%</b>. ' +
      (left === 1 ? 'One thing' : left + ' things') + ' below did not land. Tap each one and say ' +
      'why; the answer is kept with the day, and nothing else is needed.';

  var btn = function (href, text, bg) {
    return '<a href="' + esc_(href) + '" style="display:inline-block;margin:8px 8px 0 0;padding:8px 15px;' +
      'border-radius:999px;background:' + bg + ';color:#fff;text-decoration:none;font-size:12.5px;font-weight:700">' +
      esc_(text) + '</a>';
  };
  var rows = items.map(function (it, i) {
    var ok = it.state === 'done';
    var tone = ok ? MAIL.green : it.state === 'unknown' ? MAIL.muted : MAIL.amber;
    var links = '';
    if (!ok && it.state !== 'unknown') {
      if (it.k === 'own') links += btn(blockUrl_(p.staffId, day, b, i, 'done'), 'Done ✓', MAIL.green);
      links += btn(blockUrl_(p.staffId, day, b, i, 'why'), 'Say why →', MAIL.navy);
    }
    return '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + tone +
      ';border-radius:9px;padding:11px 14px;margin-bottom:8px">' +
      '<div style="font-size:14px">' + (ok ? '<span style="color:' + MAIL.green + ';font-weight:700">&#10003;</span> ' : '') +
      esc_(itemLabel_(it)) + '</div>' +
      '<div style="font-size:12px;color:' + tone + ';margin-top:2px;font-weight:700">' + esc_(stateWord_(it)) +
      (it.k === 'sf' && !ok ? '<span style="color:' + MAIL.muted + ';font-weight:500"> · close it in Salesforce and it counts</span>' : '') +
      '</div>' + links + '</div>';
  }).join('');
  if (nothing) {
    rows = '<div style="background:#fff;border:1px solid ' + MAIL.line + ';border-left:4px solid ' + MAIL.amber +
      ';border-radius:9px;padding:11px 14px;margin-bottom:8px"><div style="font-size:14px">' + esc_(lab) +
      ' · ' + esc_(when) + '</div>' + btn(blockUrl_(p.staffId, day, b, 'block', 'why'), 'Say what you were on →', MAIL.navy) + '</div>';
  }

  var saw = '';
  if (act) {
    var named = act.closed.slice(0, 6).map(function (t) { return esc_(t.subject); }).join('<br>');
    saw = sectionLabel_('What Salesforce saw today') +
      '<div style="font-size:13px;color:' + MAIL.muted + ';line-height:1.55">' +
      act.closed.length + ' closed · ' + act.moved.length + ' moved' +
      (named ? '<div style="color:' + MAIL.ink + ';margin-top:5px">' + named +
        (act.closed.length > 6 ? '<br>and ' + (act.closed.length - 6) + ' more' : '') + '</div>' : '') + '</div>';
  }

  MailApp.sendEmail({
    to: to,
    cc: dayStartCc_(to).join(',') || undefined,
    subject: lab + ' closed · ' + shortDate_(day) + ' · ' +
             (of ? done + ' of ' + of + ' done' : 'nothing recorded'),
    htmlBody: shell_(lab + ' closed itself', nameFor_(p.staffId) + ' · ' + prettyDate_(day) + ' · ' + when,
      '<div style="background:' + MAIL.paper + ';border:1px solid ' + MAIL.gold +
        ';border-radius:10px;padding:13px 15px;font-size:14px;line-height:1.55;margin-bottom:16px">' + lead + '</div>' +
      sectionLabel_(of ? 'What you planned' : 'Your day') + rows + saw +
      '<div style="font-size:12.5px;color:' + MAIL.muted + ';line-height:1.55;margin-top:14px">' +
        'Closed automatically at ' + esc_(at) + ' from what Salesforce recorded. Nothing is needed for ' +
        'anything ticked. The answers you give here show against your day in the tracker.</div>')
  });
  return true;
}

/** An answer on one item: "done" on a line of the person's own, or a reason
 *  on anything. Kept on the plan row, and on its own tab so the day's
 *  reasons read as a list. */
function blockAnswer_(person, day, blockId, item, ans, source) {
  var row = planRows_(person.staffId, day)[blockId];
  if (!row) return { ok: false, error: 'Nothing was planned for that day.' };
  var items = planItemsOf_(row.Items), now = new Date(), at = hhmm_(now);
  var patch = { Items: items };
  var label = '', reason = String(ans.reason || '').replace(/\s+/g, ' ').trim().slice(0, REASON_MAX);
  if (String(item) === 'block') {
    if (!reason) return { ok: false, error: 'Say what you were on — one line is enough.' };
    label = blockLabel_(blockId);
    patch.Note = reason;
  } else {
    var i = Number(item);
    var it = items[i];
    if (!it) return { ok: false, error: 'That line is not on the plan.' };
    label = itemLabel_(it);
    if (ans.done) {
      if (it.k !== 'own') return { ok: false, error: 'A Salesforce task counts when it is closed in Salesforce.' };
      it.done = true; it.state = 'done';
    } else {
      if (!reason) return { ok: false, error: 'Say why — one line is enough.' };
      /* A reason on a line that landed is a note, not a downgrade. */
      it.reason = reason;
      if (it.state !== 'done') it.state = 'explained';
    }
    if (String(row.ClosedAt || '').trim()) {
      var done = 0, known = 0;
      items.forEach(function (x) { if (x.state === 'unknown') return; known++; if (x.state === 'done') done++; });
      patch.Achieved = done;
      patch.Pct = known ? Math.round(done / known * 100) : '';
    }
  }
  planWrite_(person, day, blockId, patch);
  if (reason) {
    var sh = hrTab_(BREASON, true);
    sh.appendRow(BREASON.head.map(function (h) {
      return { Date: day, StaffId: person.staffId, Name: person.name || person.staffId, Block: blockId,
               Item: String(item), Label: label, Reason: reason, At: at, Source: source || 'screen' }[h];
    }));
    forgetHr_(BREASON);
  }
  return { ok: true, plan: planOut_(planRows_(person.staffId, day)[blockId], person.staffId, blockId) };
}

/** From the tracker: done, or why. */
function blockReason_(data, profile) {
  var staffId = planScope_(profile, data);
  if (!staffId || (staffId !== profile.staffId && !profile.manager)) return { ok: false, error: 'Not yours to answer.' };
  var date = isoDay_(data.date) || todayISO_();
  var blockId = String(data.block || '').toUpperCase();
  if (BLOCK_IDS.indexOf(blockId) === -1) return { ok: false, error: 'Unknown block: ' + blockId };
  var person = rosterPerson_(staffId) || { staffId: staffId, name: profile.name };
  var lock = takeLock_();
  if (!lock) return BUSY_;
  try {
    markStaffWrite_();
    return blockAnswer_(person, date, blockId, data.item, { done: !!data.done, reason: data.reason }, 'screen');
  } finally { lock.releaseLock(); }
}

/** The GET behind every link in the e-mail. Null when the request is not
 *  one of ours. */
function blockClick_(e) {
  var p = (e && e.parameter) || {};
  var sid = String(p.bk || '').trim();
  if (!sid) return null;
  var day = isoDay_(p.d) || todayISO_(), b = String(p.b || '').toUpperCase();
  if (String(p.k || '') !== blockSig_(sid, day, b)) {
    return closeoutPage_('That link has expired.', 'Answer it from the tracker instead.', null);
  }
  var person = rosterPerson_(sid);
  if (!person) return closeoutPage_('That link has expired.', 'The desk is no longer on the register.', null);
  var a = String(p.a || ''), i = String(p.i || '');
  if (a === 'why') return blockWhyPage_(person, day, b, i, p);
  if (a === 'done') {
    var r = blockAnswer_(person, day, b, i, { done: true }, 'email');
    return blockPage_(person, day, b, r.ok ? 'Recorded as done.' : 'That did not record.', r.ok ? '' : r.error);
  }
  return blockPage_(person, day, b, 'Here is your day.', '');
}

/** The form post from the page above. */
function blockReasonPost_(e) {
  var p = (e && e.parameter) || {};
  var sid = String(p.bk || '').trim();
  if (!sid || p.why == null) return null;
  var day = isoDay_(p.d) || todayISO_(), b = String(p.b || '').toUpperCase();
  if (String(p.k || '') !== blockSig_(sid, day, b)) {
    return closeoutPage_('That link has expired.', 'Answer it from the tracker instead.', null);
  }
  var person = rosterPerson_(sid);
  if (!person) return closeoutPage_('That link has expired.', 'The desk is no longer on the register.', null);
  var r = blockAnswer_(person, day, b, String(p.i || ''), { reason: p.why }, 'email');
  return blockPage_(person, day, b, r.ok ? 'Thank you — that is on the record.' : 'That did not record.',
                    r.ok ? '' : r.error);
}

function blockWhyPage_(person, day, b, i, p) {
  var row = planRows_(person.staffId, day)[b];
  var items = row ? planItemsOf_(row.Items) : [];
  var what = String(i) === 'block' ? blockLabel_(b) + ' · nothing recorded'
           : (items[Number(i)] ? itemLabel_(items[Number(i)]) : 'that line');
  var html = '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Say why</title>' +
    '<div style="font:15px/1.55 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
      'max-width:560px;margin:0 auto;padding:34px 20px;color:#1F2433">' +
    '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0EA5C9">' +
      'Ricky Rampersad Branch</div>' +
    '<h1 style="font-size:23px;margin:6px 0 8px;color:#141C4A">' + esc_(what) + '</h1>' +
    '<p style="margin:0 0 14px;color:#6A7180">' + esc_(blockLabel_(b)) + ' · ' + esc_(prettyDate_(day)) +
      '. One line is enough. It is kept with the day and shows in the tracker.</p>' +
    '<form method="post" action="' + esc_(execBase_()) + '">' +
    '<input type="hidden" name="bk" value="' + esc_(person.staffId) + '">' +
    '<input type="hidden" name="d" value="' + esc_(day) + '">' +
    '<input type="hidden" name="b" value="' + esc_(b) + '">' +
    '<input type="hidden" name="i" value="' + esc_(String(i)) + '">' +
    '<input type="hidden" name="k" value="' + esc_(String(p.k || '')) + '">' +
    '<textarea name="why" rows="4" required maxlength="' + REASON_MAX + '" ' +
      'placeholder="What stopped it, or what you were on instead" ' +
      'style="width:100%;padding:12px;border:1.5px solid #dde4ec;border-radius:10px;font:15px/1.5 inherit;resize:vertical"></textarea>' +
    '<button type="submit" style="margin-top:12px;width:100%;padding:14px;border:0;border-radius:10px;' +
      'background:#141C4A;color:#fff;font:700 15px inherit;cursor:pointer">Send</button></form></div>';
  return HtmlService.createHtmlOutput(html)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function blockPage_(person, day, b, head, body) {
  var row = planRows_(person.staffId, day)[b];
  var out = row ? planOut_(row, person.staffId, b) : null;
  var lines = !out ? '' : out.items.map(function (it, i) {
    var ok = it.state === 'done' || it.state === 'explained';
    var link = ok ? '' :
      '<div style="margin-top:5px;font-size:13px;font-weight:700">' +
      (it.k === 'own' ? '<a href="' + esc_(blockUrl_(person.staffId, day, b, i, 'done')) + '" style="color:#2C7A57;margin-right:14px">Done &#10003;</a>' : '') +
      '<a href="' + esc_(blockUrl_(person.staffId, day, b, i, 'why')) + '" style="color:#D97A06">Say why &rarr;</a></div>';
    return '<div style="padding:11px 0;border-bottom:1px solid #e8eaf0">' +
      '<span style="color:' + (ok ? '#2C7A57' : '#D97A06') + ';font-weight:800">' + (ok ? '&#10003;' : '&#8226;') + '</span> ' +
      '<b style="color:#1F2433">' + esc_(itemLabel_(it)) + '</b>' +
      '<span style="color:#6A7180"> &middot; ' + esc_(stateWord_(it)) + '</span>' +
      (it.reason ? '<div style="color:#6A7180;font-size:13px;margin-top:3px">' + esc_(it.reason) + '</div>' : '') + link + '</div>';
  }).join('');
  var sum = !out ? '' : (out.closedAt ? 'Closed at ' + out.closedAt : 'Not closed yet') +
    (out.of ? ' · ' + out.achieved + ' of ' + out.of + ' done' + (out.pct != null ? ' · ' + out.pct + '%' : '') : '') +
    (out.note ? ' · ' + out.note : '');
  var html = '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc_(blockLabel_(b)) + '</title>' +
    '<div style="font:15px/1.55 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
      'max-width:560px;margin:0 auto;padding:34px 20px;color:#1F2433">' +
    '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0EA5C9">' +
      'Ricky Rampersad Branch</div>' +
    '<h1 style="font-size:23px;margin:6px 0 8px;color:#141C4A">' + esc_(head) + '</h1>' +
    '<p style="margin:0 0 6px;color:#6A7180">' + esc_(body || (blockLabel_(b) + ' · ' + prettyDate_(day))) + '</p>' +
    (sum ? '<p style="margin:0 0 18px;color:#6A7180;font-weight:700">' + esc_(sum) + '</p>' : '') +
    (lines ? '<div style="border-top:1px solid #e8eaf0">' + lines + '</div>' : '') + '</div>';
  return HtmlService.createHtmlOutput(html)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------------------------------------------------------------------------
//  The wall's data, live
//
//  Everything on slides 5 to 12 used to be a constant in wall/index.html with
//  an asOf date on it. It was refreshed by hand, which meant it was right on
//  the day it was written and wrong every day after — on 3 September the wall
//  was still showing 26 August and reading 132 overdue when the real number
//  was 144. A photograph presented as a window.
//
//  This answers all of it in one pass and caches for ten minutes. The wall
//  polls every five, so most requests never leave Apps Script.
//
//  It must never take the wall down. Every branch is guarded and the whole
//  thing is wrapped: if Salesforce is slow, unreachable, or a query changes
//  shape, this returns null and the wall keeps showing the last good data it
//  had. A blank slide is worse than a stale one, but a wrong one is worst.
// ---------------------------------------------------------------------------

/** Subjects that must never appear on a screen in an open office.
 *  Pay, conduct and contract are between a person and their manager. The item
 *  is still counted and still aged — only the words are withheld. */
var MASK_RE = /salary|pay\s*review|remuneration|disciplin|grievance|contract\s*review|warning\s*letter|termination|probation\s*review/i;

function maskSubject_(subject) {
  return MASK_RE.test(String(subject || '')) ? null : String(subject || '');
}

function wallData_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('sfk_wall');
  if (hit) return JSON.parse(hit);
  if (!sfkConfigured_()) return null;

  var users = sfkUsers_();
  var ids = [], byId = {}, firstName = {};
  Object.keys(users).forEach(function (k) {
    ids.push("'" + users[k].id + "'");
    byId[users[k].id] = k;
    firstName[k] = k.charAt(0).toUpperCase() + k.slice(1);
  });
  if (!ids.length) return null;
  var IN = '(' + ids.join(',') + ')';
  var who = function (id) { return firstName[byId[id]] || null; };

  var out = { asOf: todayISO_(), live: true };

  // --- the overdue book, by owner and type -------------------------------
  out.overdue = [];
  sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) n FROM Task ' +
    "WHERE Status != 'Completed' AND ActivityDate < TODAY AND OwnerId IN " + IN +
    ' GROUP BY OwnerId, Task_Type__c'
  ).forEach(function (r) {
    var n = who(r.OwnerId);
    if (n) out.overdue.push({ who: n, type: r.Task_Type__c || '', n: Number(r.n) || 0 });
  });

  // --- how old that book is, per person ----------------------------------
  // Two bands and the single oldest. Never a sum of days.
  var band = function (clause) {
    var m = {};
    sfkQuery_('SELECT OwnerId, COUNT(Id) n FROM Task ' +
      "WHERE Status != 'Completed' AND OwnerId IN " + IN + ' AND ' + clause +
      ' GROUP BY OwnerId').forEach(function (r) {
      var n = who(r.OwnerId); if (n) m[n] = Number(r.n) || 0;
    });
    return m;
  };
  var over30 = band('ActivityDate < LAST_N_DAYS:30');
  var over60 = band('ActivityDate < LAST_N_DAYS:60');
  var oldest = {};
  sfkQuery_('SELECT OwnerId, ActivityDate FROM Task ' +
    "WHERE Status != 'Completed' AND ActivityDate < TODAY AND OwnerId IN " + IN +
    ' ORDER BY ActivityDate ASC LIMIT 400').forEach(function (r) {
    var n = who(r.OwnerId);
    if (n && !oldest[n] && r.ActivityDate) oldest[n] = r.ActivityDate;
  });
  out.age = {};
  Object.keys(firstName).forEach(function (k) {
    var n = firstName[k];
    if (!over30[n] && !over60[n] && !oldest[n]) return;
    out.age[n] = { over30: over30[n] || 0, over60: over60[n] || 0,
                   oldestDays: oldest[n] ? daysSince_(oldest[n]) : 0,
                   oldestSince: oldest[n] ? prettyDay_(oldest[n]) : '' };
  });

  // --- the open book, and how much of it is late -------------------------
  out.byPerson = {};
  sfkQuery_('SELECT OwnerId, COUNT(Id) n FROM Task ' +
    "WHERE Status != 'Completed' AND OwnerId IN " + IN + ' GROUP BY OwnerId')
    .forEach(function (r) {
      var n = who(r.OwnerId);
      if (n) out.byPerson[n] = { open: Number(r.n) || 0, overdue: 0 };
    });
  out.overdue.forEach(function (o) {
    if (out.byPerson[o.who]) out.byPerson[o.who].overdue += o.n;
  });

  // --- worked today, by the state each task was left in -------------------
  // A task that was moved is work. Counting only closures showed two people
  // as zero on a day they each moved three or four.
  var w = {};
  var seed = function (n) {
    if (!w[n]) w[n] = { n: n, worked: 0, closed: 0, moving: 0, waiting: 0, written: 0, types: {} };
    return w[n];
  };
  sfkQuery_('SELECT OwnerId, Status, COUNT(Id) n FROM Task ' +
    'WHERE LastModifiedDate = TODAY AND OwnerId IN ' + IN + ' GROUP BY OwnerId, Status')
    .forEach(function (r) {
      var n = who(r.OwnerId); if (!n) return;
      var c = Number(r.n) || 0, row = seed(n);
      row.worked += c;
      if (r.Status === 'Completed') row.closed += c;
      else if (/waiting/i.test(r.Status || '')) row.waiting += c;
      else row.moving += c;
    });
  sfkQuery_('SELECT OwnerId, Task_Type__c, COUNT(Id) n FROM Task ' +
    'WHERE LastModifiedDate = TODAY AND OwnerId IN ' + IN + ' GROUP BY OwnerId, Task_Type__c')
    .forEach(function (r) {
      var n = who(r.OwnerId); if (!n) return;
      seed(n).types[r.Task_Type__c || ''] = Number(r.n) || 0;
    });

  // Written up. Description cannot be filtered in SOQL, so the tasks touched
  // today are read back and checked here; Chatter is counted alongside it,
  // because that is where half this branch actually writes and counting only
  // one of the two put a false accusation on the wall once already.
  try {
    sfkQuery_('SELECT OwnerId, Description FROM Task ' +
      'WHERE LastModifiedDate = TODAY AND OwnerId IN ' + IN + ' LIMIT 300')
      .forEach(function (r) {
        var n = who(r.OwnerId);
        if (n && String(r.Description || '').trim()) seed(n).written++;
      });
    var posted = {};
    sfkQuery_("SELECT CreatedById FROM FeedItem WHERE Type = 'TextPost' " +
      'AND CreatedDate = TODAY LIMIT 200').forEach(function (r) {
        posted[r.CreatedById] = (posted[r.CreatedById] || 0) + 1;
      });
    Object.keys(posted).forEach(function (uid) {
      var n = who(uid);
      if (n) seed(n).chatter = posted[uid];
    });
  } catch (e) { /* the counts stand without it */ }
  out.worked = Object.keys(w).map(function (k) { return w[k]; })
    .sort(function (a, b) { return b.worked - a.worked; });

  // --- thirty days in against out ----------------------------------------
  // The card that says how to read the others, and it has to answer two
  // different questions without folding one into the other.
  //
  // A client servicing run is real work and a real contact the client
  // receives: 550 clients in a month, one task each, every one typed
  // Servicing, and triggered by the Branch Manager rather than by nobody.
  // The first version of this card subtracted it and printed "robot
  // excluded", which took the branch's largest servicing book off the wall
  // and told the room its author had closed one thing in thirty days.
  //
  // So it is counted and named, never netted away. `in` and `out` are the
  // case book — work opened and carried to a close one at a time. `serviced`
  // is the contact book, reported beside it. Two kinds of work, two figures,
  // neither one hidden inside the other.
  var flowIn = {}, flowOut = {};
  sfkQuery_('SELECT OwnerId, COUNT(Id) n FROM Task ' +
    'WHERE CreatedDate = LAST_N_DAYS:30 AND OwnerId IN ' + IN + ' GROUP BY OwnerId')
    .forEach(function (r) { var n = who(r.OwnerId); if (n) flowIn[n] = Number(r.n) || 0; });
  sfkQuery_('SELECT OwnerId, COUNT(Id) n FROM Task ' +
    "WHERE Status = 'Completed' AND LastModifiedDate = LAST_N_DAYS:30 AND OwnerId IN " + IN +
    ' GROUP BY OwnerId').forEach(function (r) {
      var n = who(r.OwnerId); if (n) flowOut[n] = Number(r.n) || 0;
    });
  var serviced = {}, servedClients = {};
  sfkQuery_('SELECT OwnerId, COUNT(Id) n, COUNT_DISTINCT(WhoId) c FROM Task ' +
    "WHERE CreatedDate = LAST_N_DAYS:30 AND Task_Type__c = 'Servicing' " +
    "AND Subject LIKE '%Happy Birthday%' AND OwnerId IN " + IN + ' GROUP BY OwnerId')
    .forEach(function (r) {
      var n = who(r.OwnerId);
      if (!n) return;
      serviced[n] = Number(r.n) || 0;
      servedClients[n] = Number(r.c) || 0;      // one contact per client, counted
    });
  out.flow = Object.keys(firstName).map(function (k) {
    var n = firstName[k], sv = serviced[n] || 0;
    var row = { n: n, in: Math.max((flowIn[n] || 0) - sv, 0),
                out: Math.max((flowOut[n] || 0) - sv, 0), serviced: sv };
    if (sv) row.clients = servedClients[n] || sv;
    return row;
  }).filter(function (r) { return r.in || r.out || r.serviced; })
    .sort(function (a, b) { return (b.in + b.serviced) - (a.in + a.serviced); });

  // --- who we are waiting on ---------------------------------------------
  out.waitingOn = [];
  sfkQuery_('SELECT Who.Name, OwnerId, COUNT(Id) n FROM Task ' +
    "WHERE Status = 'Waiting on someone else' AND Who.Name != null AND OwnerId IN " + IN +
    ' GROUP BY Who.Name, OwnerId ORDER BY COUNT(Id) DESC LIMIT 12')
    .forEach(function (r) {
      var n = who(r.OwnerId);
      if (n && r.Name) out.waitingOn.push({ who: r.Name, agent: n, n: Number(r.n) || 0, days: 0 });
    });

  // --- before you leave ---------------------------------------------------
  out.endOfDay = { inHand: [], waitingDueToday: 0, neverStarted: [] };
  sfkQuery_('SELECT OwnerId, Subject, Status FROM Task ' +
    "WHERE Status != 'Completed' AND ActivityDate = TODAY AND OwnerId IN " + IN + ' LIMIT 40')
    .forEach(function (r) {
      var n = who(r.OwnerId); if (!n) return;
      if (/waiting/i.test(r.Status || '')) { out.endOfDay.waitingDueToday++; return; }
      out.endOfDay.inHand.push({ who: n, what: shorten_(maskSubject_(r.Subject) || 'a private matter', 64),
                                 state: r.Status });
    });
  sfkQuery_('SELECT OwnerId, Subject, ActivityDate FROM Task ' +
    "WHERE Status = 'Not Started' AND ActivityDate < TODAY AND OwnerId IN " + IN +
    ' ORDER BY ActivityDate ASC LIMIT 20').forEach(function (r) {
      var n = who(r.OwnerId); if (!n) return;
      var clean = maskSubject_(r.Subject);
      out.endOfDay.neverStarted.push({
        who: n, days: daysSince_(r.ActivityDate),
        what: clean ? shorten_(clean, 64) : 'a staffing matter',
        masked: clean ? undefined : true });
    });

  // --- the untyped inbound pile ------------------------------------------
  var inb = sfkQuery_('SELECT OwnerId, Status, COUNT(Id) n FROM Task ' +
    "WHERE Status != 'Completed' AND Task_Type__c = null AND ActivityDate < TODAY " +
    'AND OwnerId IN ' + IN + ' GROUP BY OwnerId, Status');
  var best = null, tot = {}, wait = {};
  inb.forEach(function (r) {
    var n = who(r.OwnerId); if (!n) return;
    var c = Number(r.n) || 0;
    tot[n] = (tot[n] || 0) + c;
    if (/waiting/i.test(r.Status || '')) wait[n] = (wait[n] || 0) + c;
  });
  Object.keys(tot).forEach(function (n) { if (!best || tot[n] > tot[best]) best = n; });
  if (best) {
    out.inbound = { who: best, total: tot[best], waiting: wait[best] || 0,
                    notStarted: tot[best] - (wait[best] || 0),
                    oldestDays: (out.age[best] || {}).oldestDays || 0,
                    oldestSince: (out.age[best] || {}).oldestSince || '' };
  }

  cache.put('sfk_wall', JSON.stringify(out), 600);
  return out;
}

/** Never lets the wall fall over. Stale beats blank; blank beats wrong. */
function wallDataSafe_() {
  try { return wallData_(); } catch (e) { return null; }
}

function daysSince_(iso) {
  if (!iso) return 0;
  var then = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return Math.max(0, Math.round((new Date() - then) / 864e5));
}

function prettyDay_(iso) {
  if (!iso) return '';
  return Utilities.formatDate(new Date(String(iso).slice(0, 10) + 'T12:00:00'),
                              CONFIG.TZ, 'd MMMM');
}

function shorten_(t, n) {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function sfkNeedsReasonSafe_(date) {
  if (!sfkConfigured_()) return {};
  try { return sfkNeedsReason_(date); } catch (e) { return {}; }
}

/** Closures per person over the week, the month and the year so far.
 *
 *  Three queries for the whole branch, not three per person. sfkClosedInPeriod_
 *  asks one question per member of staff because a review page only ever needs
 *  one of them; a screen that shows everybody would turn that into thirty round
 *  trips, and Salesforce would answer the thirtieth after the wall had given
 *  up. GROUP BY OwnerId gives the same figures in one.
 *
 *  Same rules as "closed today": CompletedDateTime, in the branch's own clock
 *  (04:00Z is local midnight), the birthday automation left out, and only the
 *  users sfkMetrics_ itself counts. The windows run from Monday, the first of
 *  the month and the first of January up to the end of the day asked for —
 *  which for today is "to now", and for a day in the past is what the screen
 *  would have said on that day rather than a figure that keeps growing.
 *
 *  Returns { staff: { sid: { week, month, ytd } }, branch: { week, month, ytd } }. */
function sfkClosedWindows_(date) {
  var day = date || todayISO_();
  var cache = CacheService.getScriptCache();
  var key = 'sfk_cw_' + day;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var users = sfkUsers_();
  var ids = Object.keys(users).map(function (k) { return "'" + users[k].id + "'"; });
  var staff = {}, branch = { week: 0, month: 0, ytd: 0 };
  Object.keys(users).forEach(function (k) { staff[k] = { week: 0, month: 0, ytd: 0 }; });
  if (!ids.length) return { staff: staff, branch: branch };
  var IN = '(' + ids.join(',') + ')';
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  var to = shiftDays_(day, 1) + 'T04:00:00Z';
  var from = {
    week:  weekStart_(day) + 'T04:00:00Z',
    month: day.slice(0, 7) + '-01T04:00:00Z',
    ytd:   day.slice(0, 4) + '-01-01T04:00:00Z'
  };
  Object.keys(from).forEach(function (w) {
    sfkQuery_(
      'SELECT OwnerId, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
      ' AND CompletedDateTime >= ' + from[w] + ' AND CompletedDateTime < ' + to +
      " AND (NOT Subject LIKE '%Happy Birthday%') GROUP BY OwnerId").forEach(function (r) {
        var sid = byId[r.OwnerId];
        if (!sid) return;
        var n = Number(r.expr0 || 0);
        staff[sid][w] += n;
        branch[w] += n;
      });
  });

  var res = { staff: staff, branch: branch };
  try { cache.put(key, JSON.stringify(res), SFK.CACHE_MIN * 60); } catch (e) {}
  return res;
}

/** Safe wrapper — the tracker must keep working when Salesforce does not.
 *
 *  The period figures ride along as m.periods, in their own try: a screen
 *  that cannot get the week's total should still get this morning's. */
function sfkMetricsSafe_(date) {
  if (!sfkConfigured_()) return { ok: false, reason: 'notConfigured' };
  var m;
  try { m = sfkMetrics_(date); }
  catch (e) { return { ok: false, reason: 'error', error: String(e && e.message || e) }; }
  if (m && m.ok) {
    try { m.periods = sfkClosedWindows_(m.date); }
    catch (e) { m.periods = null; }
  }
  return m;
}

/** Run once from the editor to check the connection and see what it reads. */
function sfKpiTest() {
  if (!sfkConfigured_()) {
    var msg = 'Salesforce is not set up. Add SF_KEY, SF_SECRET, SF_USER and SF_PASS ' +
              'to Script Properties — the same four the renewal sheet uses.';
    Logger.log(msg); return msg;
  }
  var users = sfkUsers_();
  var lines = ['Matched ' + Object.keys(users).length + ' branch staff to Salesforce users:'];
  Object.keys(users).forEach(function (k) {
    lines.push('  ' + k + ' → ' + users[k].name + (users[k].active ? '' : '  (user flagged INACTIVE)') +
      (users[k].all > 1 ? '  (' + users[k].all + ' user records on this address)' : ''));
  });
  var m = sfkMetrics_(todayISO_());
  lines.push('', 'Task position for ' + m.date + ':');
  Object.keys(m.staff).forEach(function (k) {
    var s = m.staff[k];
    lines.push('  ' + k.padEnd ? k : k, '');
    lines[lines.length - 2] = '  ' + k + ':  closed ' + s.closed + '  open ' + s.open +
      '  overdue ' + s.overdue + '  60+ ' + s.aged60;
    lines.pop();
  });
  var msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}

// ---------------------------------------------------------------------------
//  The billing reference check
//
//  Renewals, premium dues and billing is the branch's second-largest category
//  and its most repetitive. The open book shows why that matters: the same
//  company can carry four separate open billing tasks — T-LIFE for March,
//  April, May and June, plus T-HEALTH for July, all still open on one account.
//  Each was sent. None was checked back.
//
//  So the block does not just say "send it". It lists what is open against
//  each account, and puts the repeats at the top — because the same client
//  appearing three times is not three jobs, it is one job nobody closed.
// ---------------------------------------------------------------------------

var BILLING_TYPE = 'Renewa/PDl/Bill';

function sfkBillingCheck_(date) {
  var day = date || todayISO_();
  var cache = CacheService.getScriptCache();
  var key = 'sfk_bill_' + day;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var users = sfkUsers_();
  var ids = Object.keys(users).map(function (k) { return "'" + users[k].id + "'"; });
  if (!ids.length) return {};
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  var recs = sfkQuery_(
    'SELECT Id, OwnerId, Subject, Status, ActivityDate, Days_O_S__c, ' +
    'What.Name, Task_Update_Reason_c__c ' +
    'FROM Task WHERE OwnerId IN (' + ids.join(',') + ") AND Status != 'Completed' " +
    "AND Task_Type__c = '" + BILLING_TYPE + "' " +
    'ORDER BY Days_O_S__c DESC NULLS LAST LIMIT 400');

  var out = {};
  recs.forEach(function (r) {
    var sid = byId[r.OwnerId];
    if (!sid) return;
    out[sid] = out[sid] || { items: [], accounts: {} };
    var acct = accountOf_(r.Subject, r.What ? r.What.Name : '');
    out[sid].items.push({
      id: r.Id, subject: r.Subject, status: r.Status, due: r.ActivityDate,
      age: Number(r.Days_O_S__c || 0), account: acct,
      hasReason: !!(r.Task_Update_Reason_c__c || '').trim()
    });
    out[sid].accounts[acct] = (out[sid].accounts[acct] || 0) + 1;
  });

  // Anything open more than once against the same account is the thing to
  // look at first: it was sent again before the last one was reconciled.
  Object.keys(out).forEach(function (sid) {
    var a = out[sid].accounts;
    out[sid].repeats = Object.keys(a).filter(function (k) { return a[k] > 1; })
      .map(function (k) { return { account: k, open: a[k] }; })
      .sort(function (x, y) { return y.open - x.open; });
    out[sid].items.forEach(function (it) { it.repeat = a[it.account] > 1; });
    out[sid].items.sort(function (x, y) {
      if (x.repeat !== y.repeat) return x.repeat ? -1 : 1;
      return y.age - x.age;
    });
  });

  cache.put(key, JSON.stringify(out), SFK.CACHE_MIN * 60);
  return out;
}

/** The client or company a billing task belongs to.
 *  Group work names the company at the end of the subject after the last
 *  dash; premium-due mail names the client the same way. Fall back to the
 *  related record, which is a portfolio or transaction reference. */
function accountOf_(subject, whatName) {
  var s = String(subject || '');
  var m = s.match(/-\s*([^-]+)$/);
  if (m) {
    var tail = m[1].trim().replace(/\s+/g, ' ');
    if (tail && tail.length > 2 && !/^\d+$/.test(tail)) return tail;
  }
  return whatName || 'Unattributed';
}

function sfkBillingCheckSafe_(date) {
  if (!sfkConfigured_()) return {};
  try { return sfkBillingCheck_(date); } catch (e) { return {}; }
}


/** Why the Salesforce login is failing, without printing the credentials.
 *
 *  invalid_grant tells you almost nothing on its own — it is returned for a
 *  wrong password, a stale security token, an SSO-only user, a flow the org has
 *  switched off, and a host that refuses to authenticate at all. So rather than
 *  guessing which, this tries the combinations separately and prints what
 *  Salesforce says to each. The answer is usually obvious once they sit side by
 *  side.
 *
 *  Prints lengths, never values. */
function sfLoginCheck() {
  var p = sfkProps_();
  var key = p.getProperty('SF_KEY'), sec = p.getProperty('SF_SECRET');
  var user = p.getProperty('SF_USER'), pass = p.getProperty('SF_PASS') || '';
  var mode = sfkAuthMode_();
  var out = [];

  out.push('Flow in use: ' + mode +
    (mode === 'client_credentials'
      ? '  (no password involved — the app authenticates as itself)'
      : '  (set SF_AUTH to client_credentials to switch)'));
  out.push('');
  out.push('What is set');
  out.push('  SF_KEY     ' + (key ? key.length + ' chars, starts ' + key.slice(0, 8) + '…' : 'MISSING'));
  out.push('  SF_SECRET  ' + (sec ? sec.length + ' chars' : 'MISSING'));
  if (mode === 'password') {
    out.push('  SF_USER    ' + (user || 'MISSING'));
    out.push('  SF_PASS    ' + (pass ? pass.length + ' chars' : 'MISSING'));
    if (pass && pass.length <= 24) out.push('             too short to contain a 24-character token');
    if (/\s/.test(pass)) out.push('             WARNING: contains a space — join them with nothing between');
  }
  if (!key || !sec) { Logger.log(out.join('\n')); return out.join('\n'); }

  var hosts = [sfkLoginUrl_()];
  ['https://rickyrampersadbranch.my.salesforce.com', SFK.LOGIN].forEach(function (h) {
    if (hosts.indexOf(h) < 0) hosts.push(h);
  });

  var attempts = mode === 'client_credentials'
    ? [['client credentials', { grant_type: 'client_credentials', client_id: key, client_secret: sec }]]
    : [['password + token as stored',
        { grant_type: 'password', client_id: key, client_secret: sec, username: user, password: pass }],
       ['password only, token stripped', pass.length > 24
        ? { grant_type: 'password', client_id: key, client_secret: sec,
            username: user, password: pass.slice(0, -24) } : null]];

  out.push('', 'What Salesforce says');
  var won = null;
  hosts.forEach(function (h) {
    out.push('  ' + h);
    attempts.forEach(function (a) {
      if (!a[1]) return;
      var r, body = {};
      try {
        r = UrlFetchApp.fetch(h + '/services/oauth2/token',
              { method: 'post', muteHttpExceptions: true, payload: a[1] });
      } catch (e) { out.push('    ' + a[0] + ' → ' + e); return; }
      try { body = JSON.parse(r.getContentText()); } catch (e) {}
      if (r.getResponseCode() === 200) {
        won = won || h;
        out.push('    ' + a[0] + ' → SUCCESS' +
          (body.instance_url ? '   instance ' + body.instance_url : ''));
      } else {
        out.push('    ' + a[0] + ' → ' + (body.error || r.getResponseCode()) +
          ': ' + (body.error_description || ''));
      }
    });
  });

  out.push('');
  if (won) {
    out.push('Working. ' + (won === sfkLoginUrl_() ? 'Nothing further to set.'
      : 'Set SF_LOGIN_URL to ' + won + ' so the rest of the script uses it.'));
    out.push('Run sfKpiTest() to map the branch to Salesforce users.');
  } else {
    out.push('Nothing succeeded. What each answer means:');
    out.push('  invalid_client         key or secret wrong, or the app has not');
    out.push('                         propagated yet — Salesforce needs ten minutes');
    out.push('  invalid_grant, and     client credentials has no Run As user. Open the');
    out.push('  client credentials     app, Policies, set Run As to a user with API');
    out.push('                         access. That is the usual one');
    out.push('  unsupported_grant_type the flow is not ticked on the app');
    out.push('  invalid_grant, and     check Login History in Setup. If it says');
    out.push('  password flow          "Username-Password Flow Disabled" then no');
    out.push('                         password will ever work here — use client');
    out.push('                         credentials instead');
    out.push('');
    out.push('Setup > Identity > Login History shows Salesforce\'s own reason for');
    out.push('every attempt above, which beats reading the error text.');
  }

  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}
