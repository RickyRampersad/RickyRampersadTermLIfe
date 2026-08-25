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

function headerOf_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
}

function findTabBy_(mustHave) {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var head = headerOf_(sheets[i]).map(function (h) { return h.toLowerCase(); });
    var ok = mustHave.every(function (m) { return head.indexOf(m.toLowerCase()) > -1; });
    if (ok) return sheets[i];
  }
  return null;
}

/** The daily log. Identified by StaffId + KPI1_Actioned. */
function logSheet_() {
  var sh = findTabBy_(['StaffId', 'KPI1_Actioned']);
  if (sh) return ensureLogColumns_(sh);
  sh = ss_().insertSheet(CONFIG.LOG_TAB);
  sh.appendRow(LOG_HEADERS);
  sh.setFrozenRows(1);
  return sh;
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
  return sh;
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
var ROLE_LISTS = { ssa: SSA_ONLY, bma: BMA_ONLY, bm: BM_ONLY, abm: ABM_ONLY, um: UM_ONLY };

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

var BLOCK_IDS = ['KPI1', 'KPI2', 'PM1', 'PM2'];

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
var SCHEDULE = {
  sasha: {
    hours: '8am – 4pm', lunch: '12:30 – 1:30pm',
    blocks: {
      KPI1: { time: '8 – 10am',  focus: 'Premium Dues / Surveys',                    kpi: 'Renewa/PDl/Bill' },
      KPI2: { time: '10 – 12pm', focus: 'Ind. Health Billing Recon / Send Off',      kpi: 'Renewa/PDl/Bill' },
      PM1:  { time: '1 – 3pm',   focus: 'Adopt an Orphan / Service Quest. / Quotations', kpi: 'Orphan Adoption Listing' },
      PM2:  { time: '3 – 4pm',   focus: 'Task Mgmt / Branch Meeting Reports',        kpi: 'Reporting' }
    }
  },
  azariah: {
    hours: '8am – 4pm', lunch: '12:00 – 1:00pm',
    blocks: {
      KPI1: { time: '8 – 10am',  focus: 'Pendings, Increases, Group Apps / Production', kpi: 'Pendings' },
      KPI2: { time: '10 – 12pm', focus: 'Reinstatements / Lapse Mgmt / Reporting',   kpi: 'Renewa/PDl/Bill' },
      PM1:  { time: '1 – 3pm',   focus: 'Query Pal Management / Survey Mgmt',        kpi: 'Surveys / Query Pal' },
      PM2:  { time: '3 – 4pm',   focus: 'Task Mgmt / Branch Meeting Reports',        kpi: 'Reporting' }
    }
  },
  ashley: {
    hours: '9am – 5pm', lunch: '1:00 – 2:00pm',
    blocks: {
      KPI1: { time: '9 – 10am',  focus: 'Client Portfolio creation, Macros, Surveys', kpi: 'Client Portfolios / Macros' },
      KPI2: { time: '10 – 1pm',  focus: 'Scripts / Clawbacks / Servicing Lines',     kpi: 'Scripts/CB' },
      PM1:  { time: '2 – 3pm',   focus: 'Mail Management',                            kpi: 'Mail Management / Contracts' },
      PM2:  { time: '3 – 5pm',   focus: 'Claims / Maturities / Surveys & Task Mgmt', kpi: 'Claims/ Mat' }
    }
  },
  kamla: {
    hours: '8am – 4pm', lunch: 'Flexible',
    blocks: {
      KPI1: { time: '8 – 9am',   focus: 'HR, SA, RECR, CB',                          kpi: 'Lic/Staffing/SA/HR' },
      KPI2: { time: '10 – 12pm', focus: 'BM Client Mgt / RR Oper / General lines',   kpi: 'Administrative Support' },
      PM1:  { time: '1 – 3pm',   focus: 'Escalations / New Recruit Training',        kpi: 'Escalations' },
      PM2:  { time: '3 – 4pm',   focus: 'Task Mgmt / Branch Meeting Reports',        kpi: 'Reporting (Production / RDAR)' }
    }
  },
  elizabeth: {
    hours: '9am – 5pm', lunch: '1:00 – 2:00pm',
    blocks: {
      KPI1: { time: '9 – 11am',  focus: 'Branch Intelligence / Query Pal testing',   kpi: 'Surveys / Query Pal' },
      KPI2: { time: '11 – 1pm',  focus: 'New applications',                          kpi: 'New Application Process' },
      PM1:  { time: '2 – 3:30pm',focus: 'Administrative Support',                    kpi: 'Administrative Support' },
      PM2:  { time: '3:30 – 5pm',focus: 'Task Mgmt / Reporting',                     kpi: 'Reporting' }
    }
  },
  ricky: {
    hours: '8am – 5pm', lunch: 'Flexible',
    blocks: {
      KPI1: { time: '8 – 10am',  focus: 'Recruitment, licensing and staffing',    kpi: 'Lic/Staffing/SA/HR' },
      KPI2: { time: '10 – 12pm', focus: 'Production, pipeline and own book',      kpi: 'Opportunity' },
      PM1:  { time: '1 – 3pm',   focus: 'Agent development and field training',   kpi: 'Training' },
      PM2:  { time: '3 – 5pm',   focus: 'Escalations, reporting and branch team', kpi: 'Reporting (Production / RDAR / Branch Meeting)' }
    }
  },
  kerwyn: {
    hours: '8am – 5pm', lunch: 'Flexible',
    blocks: {
      KPI1: { time: '8 – 10am',  focus: 'Recruitment intake and agent school',  kpi: 'Lic/Staffing/SA/HR' },
      KPI2: { time: '10 – 12pm', focus: 'Unit manager supervision',             kpi: 'Unit Manager Supervision' },
      PM1:  { time: '1 – 3pm',   focus: 'Joint field work and pipeline',        kpi: 'Opportunity' },
      PM2:  { time: '3 – 5pm',   focus: 'Persistency and reporting',            kpi: 'Reporting (Production / RDAR)' }
    }
  },
  akaash: {
    hours: '8am – 4:30pm', lunch: 'Flexible',
    blocks: {
      KPI1: { time: '8 – 10am',  focus: 'Unit activity and pipeline',      kpi: 'Opportunity' },
      KPI2: { time: '10 – 12pm', focus: 'Joint field work',                kpi: 'Joint Field Work' },
      PM1:  { time: '1 – 3pm',   focus: 'Recruitment and agent licensing', kpi: 'Lic/Staffing/SA/HR' },
      PM2:  { time: '3 – 4:30pm',focus: 'Unit persistency and own book',   kpi: 'Pendings' }
    }
  },
  gary: {
    hours: '8am – 4:30pm', lunch: 'Flexible',
    blocks: {
      KPI1: { time: '8 – 10am',  focus: 'Unit activity and pipeline',      kpi: 'Opportunity' },
      KPI2: { time: '10 – 12pm', focus: 'Joint field work',                kpi: 'Joint Field Work' },
      PM1:  { time: '1 – 3pm',   focus: 'Recruitment and agent licensing', kpi: 'Lic/Staffing/SA/HR' },
      PM2:  { time: '3 – 4:30pm',focus: 'Unit persistency and own book',   kpi: 'Pendings' }
    }
  }
};

var DEFAULT_SCHEDULE = {
  hours: '8am – 4pm', lunch: 'Flexible',
  blocks: {
    KPI1: { time: '8 – 10am',  focus: 'KPI Block 1', kpi: '' },
    KPI2: { time: '10 – 12pm', focus: 'KPI Block 2', kpi: '' },
    PM1:  { time: '1 – 3pm',   focus: 'Afternoon 1', kpi: '' },
    PM2:  { time: '3 – 4pm',   focus: 'Afternoon 2', kpi: '' }
  }
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
  sasha: 'kamla', azariah: 'kamla', ashley: 'kamla', elizabeth: 'kamla'
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
var BLOCK_DUE_HOUR = { KPI1: 10, KPI2: 12, PM1: 15, PM2: 16 };

function blockLabel_(p) {
  return { KPI1: 'KPI 1', KPI2: 'KPI 2', PM1: 'Afternoon 1', PM2: 'Afternoon 2' }[p] || p;
}


var LOG_HEADERS = ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status']
  .concat(BLOCK_IDS.reduce(function (a, p) {
    return a.concat([p, p + '_Actioned', p + '_Resolved', p + '_Open', p + '_Blocker']);
  }, []))
  .concat(['Closed', 'Overdue', 'Aged60', 'ValueAdded', 'Innovation', 'SystemFlags', 'Notes',
           'UpdatedAt', 'Revision'])
  .concat(BLOCK_IDS.map(function (p) { return p + '_At'; }));

var TRAINING_HEADERS = ['TrainingDate', 'StaffId', 'Trainer', 'Block', 'Trainee', 'Topic',
                        'Objectives', 'Achieved', 'Test', 'Result', 'Followup', 'LoggedAt'];

/** UpdatedAt and Revision are new. Add them to an existing log without
 *  disturbing a single cell of what is already recorded. */
function ensureLogColumns_(sh) {
  var head = headerOf_(sh);
  ['UpdatedAt', 'Revision']
    .concat(BLOCK_IDS.map(function (p) { return p + '_At'; }))
    .forEach(function (col) {
    if (head.indexOf(col) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
      head.push(col);
    }
  });
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

function roster_() {
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
    var active = String(r[idx['active']] != null ? r[idx['active']] : 'Active').trim();
    out.push({
      email: email,
      name: name,
      staffId: staffIdFor_(name),
      agentNumber: String(r[idx['agent number']] || '').trim(),
      password: String(r[idx['password']] != null ? r[idx['password']] : ''),
      role: String(r[idx['role']] || '').trim(),
      unit: String(r[idx['unit']] || '').trim(),
      grade: idx['grade'] != null ? String(r[idx['grade']] || '').trim() : '',
      active: !/^(no|inactive|false|0)$/i.test(active)
    });
  });
  return out;
}

/** Which KPI list a person gets, read from the Role and Unit columns.
 *  Assistant is checked before manager, because "Branch Manager's Assistant"
 *  contains the word manager and is not one. */
/** The Access tab currently has two people mislabelled: Kamla's Unit reads
 *  SalesSupport and Ashley's reads Branch Managers Assistant, which is the
 *  wrong way round against what each of them has actually been logging since
 *  June. Reading the sheet faithfully would hand them each other's KPI list.
 *
 *  So these two are pinned until the tab is corrected, and checkSchedule()
 *  reports the disagreement rather than letting it pass silently. Delete an
 *  entry the moment its row is fixed. */
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
  if (/assistant branch manager|\babm\b/.test(t)) return 'abm';
  if (/branch manager assistant|\bbma\b/.test(t)) return 'bma';
  if (/branch manager/.test(t)) return 'bm';
  if (/unit manager|sales manager|agency manager|\bmanager\b/.test(t)) return 'um';
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
  return /administrator|\badmin\b/.test(normRole_((person.role || '') + ' ' + (person.unit || '')));
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
  return { ok: true, token: t.token, profile: t.profile,
           roster: publicRoster_(), schedule: SCHEDULE };
}

/** The roster minus the passwords. This is the only shape that leaves here. */
function publicRoster_() {
  return roster_().filter(function (p) { return p.active; }).map(function (p) {
    return {
      staffId: p.staffId, name: p.name, email: p.email,
      agentNumber: p.agentNumber, unit: p.unit, grade: p.grade,
      role: roleFor_(p),
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

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = logSheet_();
    var head = headerOf_(sh);
    var idx = colMap_(sh);
    var now = new Date();

    // Find this person's row for this day.
    var targetRow = 0, revision = 0, firstStamp = now;
    if (sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = 0; i < vals.length; i++) {
        var sid = String(vals[i][idx['StaffId']] || '').trim() ||
                  staffIdFor_(vals[i][idx['Name']]);
        if (sid === staffId && isoDay_(vals[i][idx['Date']]) === date) {
          targetRow = i + 2;
          revision = Number(vals[i][idx['Revision']]) || 0;
          firstStamp = vals[i][idx['Timestamp']] || now;
          break;                                   // first match is the keeper
        }
      }
    }

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
function saveBlock_(payload, profile) {
  var staffId = profile.manager && payload.staffId ? payload.staffId : profile.staffId;
  var date = isoDay_(payload.date);
  var blockId = String(payload.block || '').toUpperCase();
  if (!staffId || !date) return { ok: false, error: 'Missing staff or date.' };
  if (BLOCK_IDS.indexOf(blockId) === -1) return { ok: false, error: 'Unknown block: ' + blockId };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = logSheet_();
    var head = headerOf_(sh);
    var idx = colMap_(sh);
    var now = new Date();
    var d = payload.data || {};

    var targetRow = 0, revision = 0;
    if (sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = 0; i < vals.length; i++) {
        var sid = String(vals[i][idx['StaffId']] || '').trim() || staffIdFor_(vals[i][idx['Name']]);
        if (sid === staffId && isoDay_(vals[i][idx['Date']]) === date) {
          targetRow = i + 2;
          revision = Number(vals[i][idx['Revision']]) || 0;
          break;
        }
      }
    }

    // The block's own cells, plus anything the day carries that came with it.
    var patch = {};
    patch[blockId] = d.kpi || '';
    patch[blockId + '_Actioned'] = d.actioned || '';
    patch[blockId + '_Resolved'] = d.resolved || '';
    patch[blockId + '_Open'] = d.openOwned || '';
    patch[blockId + '_Blocker'] = joinBlocker_(d.blocker, d.blockerOwner);
    patch[blockId + '_At'] = now;
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
      Object.keys(patch).forEach(function (col) {
        if (idx[col] != null) sh.getRange(targetRow, idx[col] + 1).setValue(patch[col]);
      });
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

    var done = blocksSubmittedOn_(staffId, date);
    emailBlockReceipt_(staffId, date, blockId, d, payload, done);

    return {
      ok: true,
      block: blockId,
      at: Utilities.formatDate(now, CONFIG.TZ, 'HH:mm'),
      blocksDone: done.length,
      submitted: done
    };
  } finally {
    lock.releaseLock();
  }
}

/** The day's own fields — task position, value added, the idea, the flag.
 *  They belong to the day rather than to any one block, so they save on their
 *  own and never overwrite a block that has already been reported. */
function saveDay_(payload, profile) {
  var staffId = profile.manager && payload.staffId ? payload.staffId : profile.staffId;
  var date = isoDay_(payload.date);
  if (!staffId || !date) return { ok: false, error: 'Missing staff or date.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = logSheet_();
    var head = headerOf_(sh);
    var idx = colMap_(sh);
    var now = new Date();

    var targetRow = 0, revision = 0;
    if (sh.getLastRow() > 1) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = 0; i < vals.length; i++) {
        var sid = String(vals[i][idx['StaffId']] || '').trim() || staffIdFor_(vals[i][idx['Name']]);
        if (sid === staffId && isoDay_(vals[i][idx['Date']]) === date) {
          targetRow = i + 2;
          revision = Number(vals[i][idx['Revision']]) || 0;
          break;
        }
      }
    }

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

  if (sh.getLastRow() > 1) {
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (String(vals[i][idx['StaffId']] || '').trim() === staffId &&
          isoDay_(vals[i][idx['TrainingDate']]) === date &&
          String(vals[i][idx['Block']] || '').trim() === blockId) {
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

  if (sh.getLastRow() > 1) {
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (String(vals[i][idx['StaffId']] || '').trim() === staffId &&
          isoDay_(vals[i][idx['TrainingDate']]) === date) {
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
  var day = date || todayISO_();
  var people = publicRoster_();
  var byId = {};
  latestEntries_().forEach(function (e) { if (e.Date === day) byId[e.StaffId] = e; });

  // Salesforce is the authority on the task position. What was typed into the
  // sheet is only used where Salesforce could not be reached.
  var sf = sfkMetricsSafe_(day);
  var live = sf.ok ? sf.staff : {};

  var lines = people.map(function (p) {
    var e = byId[p.staffId];
    var done = e ? blocksDone_(e) : 0;
    var L = live[p.staffId];
    return {
      staffId: p.staffId, name: p.name, unit: p.unit,
      status: !e ? 'No entry' : (String(e.Status) === 'Submitted' ? 'Submitted' : 'Draft'),
      blocksDone: done,
      onTrack: done >= 3,
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
  var monday = weekStart_(anyDateInWeek || todayISO_());
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

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    return json_(handle_(p.action || 'rows', p, p.token));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  try {
    return json_(handle_(body.action || 'save', body, body.token));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function handle_(action, data, token) {
  if (action === 'ping') return { ok: true, today: todayISO_() };
  if (action === 'login') return login_(data.who || data.email, data.password);

  var profile = readToken_(token);
  if (!profile) return { ok: false, error: 'Session expired. Sign in again.', authRequired: true };

  switch (action) {
    case 'me':
      return { ok: true, profile: profile, roster: publicRoster_(), schedule: SCHEDULE,
               kpis: allKpiChoices_() };

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

    case 'billing': {
      var bc = sfkBillingCheckSafe_(data.date);
      if (!profile.manager) {
        var m2 = {};
        if (bc[profile.staffId]) m2[profile.staffId] = bc[profile.staffId];
        bc = m2;
      }
      return { ok: true, billing: bc };
    }

    case 'needsReason': {
      var nr = sfkNeedsReasonSafe_(data.date);
      if (!profile.manager) {
        var mine = {};
        if (nr[profile.staffId]) mine[profile.staffId] = nr[profile.staffId];
        nr = mine;
      }
      return { ok: true, needsReason: nr };
    }

    case 'metrics': {
      // Staff see their own position; the manager sees the branch.
      var m = sfkMetricsSafe_(data.date);
      if (m.ok && !profile.manager) {
        var only = {};
        if (m.staff[profile.staffId]) only[profile.staffId] = m.staff[profile.staffId];
        m = { ok: true, date: m.date, staff: only };
      }
      return { ok: true, metrics: m };
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
               metrics: sfkMetricsSafe_(data.date),
               needsReason: sfkNeedsReasonSafe_(data.date),
               billing: sfkBillingCheckSafe_(data.date) };
    }

    case 'training': {
      var tr = trainingRows_();
      if (!profile.manager) {
        tr = tr.filter(function (t) { return t.StaffId === profile.staffId; });
      }
      tr.forEach(function (t) { if (t.LoggedAt) t.LoggedAt = String(t.LoggedAt); });
      return { ok: true, training: tr };
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
  navy: '#16264F', deep: '#0D1838', gold: '#C7A34A', soft: '#E7D9AE',
  ink: '#1F2433', muted: '#6A7180', line: '#E5E1D6', paper: '#F7F5EF',
  green: '#2C7A57', amber: '#B0791C', red: '#AE3A33'
};

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function prettyDate_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return Utilities.formatDate(d, 'UTC', 'EEEE d MMMM yyyy');
}

function shortDate_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return Utilities.formatDate(d, 'UTC', 'EEE d MMM');
}

function shell_(title, sub, inner) {
  return '' +
  '<div style="margin:0;padding:0;background:' + MAIL.paper + ';font-family:Segoe UI,Helvetica,Arial,sans-serif;color:' + MAIL.ink + '">' +
    '<div style="max-width:660px;margin:0 auto;background:' + MAIL.paper + '">' +
      '<div style="background:' + MAIL.navy + ';border-bottom:3px solid ' + MAIL.gold + ';padding:22px 24px">' +
        '<div style="color:' + MAIL.soft + ';font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">Guardian Life</div>' +
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
    if (r.behind.length) parts.push('<b>Behind on blocks:</b> ' + esc_(r.behind.join(', ')));
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
          '<span style="font-size:11px;color:' + MAIL.muted + ';font-weight:600"> · ' + l.blocksDone + '/4 blocks' +
          (l.updatedAt ? ' · last saved ' + esc_(l.updatedAt) : '') + '</span></td>' +
        '<td align="right" style="font-size:11px;font-weight:700;color:' + tone + '">' + esc_(l.status) + '</td>' +
      '</tr></table>' +
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
  var r = checkpointReport_(dateOpt);
  var to = managerEmails_();
  if (!to.length) throw new Error('No manager email configured.');
  MailApp.sendEmail({
    to: to.join(','),
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
          (d.status === 'none' ? '–' : d.blocks + '/4') + '</div>' +
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
  }).join('') : '<div style="font-size:13px;color:' + MAIL.muted + '">No KPI blocks logged.</div>';

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
    to: to.join(','),
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
var MY_TRIGGERS = ['sendCheckpoint', 'sendWeekly', 'remindMidday', 'remindCheckpoint'];

/** Handlers from earlier versions of this tool. Replacing the code does not
 *  remove the triggers that call it — they are stored against the project, not
 *  the file — so a daily digest kept arriving long after the function that
 *  built it had been pasted over. Named here so installTriggers() clears them. */
var RETIRED_TRIGGERS = ['sendDailyDigest', 'dailyDigest', 'sendDigest',
                        'sendDaily', 'dailySummary', 'sendDailySummary'];

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

  // 3pm checkpoint, Monday to Friday. Apps Script fires within the hour, so
  // the mail lands between 3 and 4 — while the last block is still running.
  ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].forEach(function (d) {
    ScriptApp.newTrigger('sendCheckpoint').timeBased()
      .onWeekDay(ScriptApp.WeekDay[d]).atHour(CONFIG.CHECKPOINT_HOUR).create();
  });

  // Staff nudges. Noon for a blank morning, three for an unfinished day.
  ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].forEach(function (d) {
    ScriptApp.newTrigger('remindMidday').timeBased()
      .onWeekDay(ScriptApp.WeekDay[d]).atHour(12).create();
    ScriptApp.newTrigger('remindCheckpoint').timeBased()
      .onWeekDay(ScriptApp.WeekDay[d]).atHour(CONFIG.CHECKPOINT_HOUR).create();
  });

  // Weekly summary, Friday evening once the day is in.
  ScriptApp.newTrigger('sendWeekly').timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(17).create();

  var msg = 'Triggers installed. Staff nudges weekdays at 12:00 and ' +
            CONFIG.CHECKPOINT_HOUR + ':00, branch checkpoint ' + CONFIG.CHECKPOINT_HOUR +
            ':00, weekly summary Friday 17:00 (' + CONFIG.TZ + ').';
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
  var remaining = BLOCK_IDS.filter(function (p) { return done.indexOf(p) === -1; });

  var progress = BLOCK_IDS.map(function (p) {
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

    sectionLabel_('Your day so far') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + progress + '</tr></table>' +
    '<div style="font-size:13px;color:' + MAIL.muted + ';margin-top:12px;line-height:1.5">' +
      (remaining.length
        ? 'Still to come: <b style="color:' + MAIL.ink + '">' +
          esc_(remaining.map(blockLabel_).join(', ')) + '</b>. Submit each one as it ends.'
        : 'All four blocks are in for today. Nothing further needed.') +
    '</div>';

  MailApp.sendEmail({
    to: to,
    subject: 'Your ' + blockLabel_(blockId) + ' report · ' + shortDate_(date) +
             ' · ' + done.length + '/4 blocks in',
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
    subject: heading + ' · ' + shortDate_(date),
    htmlBody: shell_(heading, nameFor_(staffId) + ' · ' + prettyDate_(date),
      '<div style="background:' + MAIL.paper + ';border:1px solid ' + MAIL.gold +
        ';border-radius:10px;padding:13px 15px;font-size:14px;line-height:1.55;margin-bottom:16px">' +
        message + '</div>' +
      sectionLabel_('Outstanding') + rows +
      '<div style="font-size:13px;color:' + MAIL.muted + ';line-height:1.55;margin-top:6px">' +
        'Report each block as it ends — not at four o\'clock from memory. ' +
        'It takes a minute per block and it is what the 3pm branch report reads from.' +
      '</div>')
  });
  return true;
}

/** Noon. Anyone whose morning is still blank hears about it while the
 *  afternoon can still be salvaged. */
function remindMidday() {
  var date = todayISO_();
  var people = publicRoster_();
  var sent = [];

  people.forEach(function (p) {
    var done = blocksSubmittedOn_(p.staffId, date);
    var morning = ['KPI1', 'KPI2'].filter(function (b) { return done.indexOf(b) === -1; });
    if (morning.length === 0) return;                 // up to date; say nothing
    if (nudge_(p.staffId, date, morning, 'KPI blocks outstanding',
        morning.length === 2
          ? 'Nothing has been logged for this morning yet. Both morning blocks are still open.'
          : 'One morning block is still outstanding.')) {
      sent.push(p.name);
    }
  });

  var msg = sent.length
    ? 'Midday reminder sent to: ' + sent.join(', ')
    : 'Midday reminder: everyone is up to date, nothing sent.';
  Logger.log(msg);
  return msg;
}

/** Three o'clock. Blocks 1–3 should be behind them; the last runs to 4.
 *  Whoever is short gets the list, and is asked for the day's close-off. */
function remindCheckpoint() {
  var date = todayISO_();
  var people = publicRoster_();
  var sent = [];

  people.forEach(function (p) {
    var done = blocksSubmittedOn_(p.staffId, date);
    var due = ['KPI1', 'KPI2', 'PM1'].filter(function (b) { return done.indexOf(b) === -1; });
    if (due.length === 0) return;
    if (nudge_(p.staffId, date, due, 'Your daily report is outstanding',
        'It is past three. ' + (done.length
          ? 'You have ' + done.length + ' of 4 blocks in — the ones below are still missing.'
          : 'Nothing has been logged for today at all.') +
        ' Please close these off, and submit your final block before you leave.')) {
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

  function blank() { return { closed: 0, open: 0, overdue: 0, aged60: 0, noDate: 0, byType: {} }; }
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
        out[sid].byType[t] = out[sid].byType[t] || { closed: 0, open: 0, overdue: 0 };
        out[sid].byType[t][field] += n;
      }
    });
  }

  // Closed on the day itself
  add(sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    " AND Status = 'Completed' AND LastModifiedDate >= " + day + 'T00:00:00Z AND ' +
    'LastModifiedDate < ' + shiftDays_(day, 1) + 'T00:00:00Z ' +
    'GROUP BY OwnerId, Task_Type__c'), 'closed', true);

  // Still open, whatever the due date
  add(sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    " AND Status != 'Completed' GROUP BY OwnerId, Task_Type__c"), 'open', true);

  // Open and already past due
  add(sfkQuery_(
    'SELECT OwnerId, Task_Type__c, COUNT(Id) FROM Task WHERE OwnerId IN ' + IN +
    " AND Status != 'Completed' AND ActivityDate < " + day +
    ' GROUP BY OwnerId, Task_Type__c'), 'overdue', true);

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

  var res = { ok: true, date: day, staff: out, users: users };
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

  var recs = sfkQuery_(
    'SELECT Id, OwnerId, Subject, Status, Task_Type__c, ActivityDate, Days_O_S__c ' +
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
      age: Number(r.Days_O_S__c || 0)
    });
  });
  cache.put(key, JSON.stringify(out), SFK.CACHE_MIN * 60);
  return out;
}

function sfkNeedsReasonSafe_(date) {
  if (!sfkConfigured_()) return {};
  try { return sfkNeedsReason_(date); } catch (e) { return {}; }
}

/** Safe wrapper — the tracker must keep working when Salesforce does not. */
function sfkMetricsSafe_(date) {
  if (!sfkConfigured_()) return { ok: false, reason: 'notConfigured' };
  try { return sfkMetrics_(date); }
  catch (e) { return { ok: false, reason: 'error', error: String(e && e.message || e) }; }
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
