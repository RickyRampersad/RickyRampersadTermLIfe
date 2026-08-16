/**
 * Company pension register — the data behind the "who's signing in?" doors on
 * pensionplantt.com.
 *
 * The wizard itself is a static page: it computes, it fills forms, it holds a
 * case in the agent's own browser. It has no idea what a company's other
 * employees are doing. This file is the part that knows — one sheet the branch
 * keeps, and a read-only endpoint the site can ask.
 *
 *   Employer signs in with the company code  → their whole schedule.
 *   Employee signs in with their own code    → their own line, and nothing else.
 *
 * A code IS the credential, so the rules are deliberately blunt:
 *   - nothing is ever returned without a code that matches a row,
 *   - an employee code returns exactly one employee,
 *   - an employer code never returns anybody's access code, and
 *   - every lookup, successful or not, is written to the log tab.
 *
 * Read-only by design. Nothing here writes to the register — changes are made
 * in the sheet by the branch.
 *
 * Endpoint (same web app as the renewal portal):
 *   WEBAPP_URL?pension=1&code=CODE   → JSON
 *
 * Set up from the Guardian Renewals menu: "Pension — create register tabs",
 * then "Pension — issue missing codes".
 */

var PENSION = {
  COMPANIES_SHEET: 'Pension Companies',
  EMPLOYEES_SHEET: 'Pension Employees',
  LOG_SHEET: 'Pension Access Log',

  /* A code shorter than this is refused outright rather than looked up, so a
     half-typed code can never match a short one somebody put in by hand. */
  MIN_CODE: 6,
};

var PENSION_COMPANY_HEADERS = [
  'Company Code', 'Company', 'BIR File #', 'Contact', 'Contact Email', 'Contact Mobile',
  'Agent', 'Notes',
];

var PENSION_EMPLOYEE_HEADERS = [
  'Access Code', 'Company Code', 'Company', 'Employee', 'Position', 'Plan',
  'Company Annual (TT$)', 'Company Lump Sum (TT$)', 'Employee Monthly (TT$)',
  'Commencement', 'Stage', 'BIR Status', 'Policy #', 'Beneficiaries', 'Agent',
  'Email', 'Mobile', 'Updated', 'Notes',
];

function pensionCompaniesSheet_() { return namedSheet_(PENSION.COMPANIES_SHEET, PENSION_COMPANY_HEADERS); }
function pensionEmployeesSheet_() { return namedSheet_(PENSION.EMPLOYEES_SHEET, PENSION_EMPLOYEE_HEADERS); }
function pensionLogSheet_() {
  return namedSheet_(PENSION.LOG_SHEET, ['Timestamp', 'Code (masked)', 'Result', 'Matched', 'From']);
}

/* ---------- reading the register ---------- */

function pensionRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  var map = headerMap_(sheet);
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return data.map(function (r) {
    var o = { _row: 0 };
    for (var key in map) o[key] = r[map[key]];
    return o;
  }).map(function (o, i) { o._row = i + 2; return o; });
}

/** Codes are compared with case and spacing thrown away — clients retype them. */
function codeKey_(v) { return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase(); }

function pensionCompanies_() { return pensionRows_(pensionCompaniesSheet_()); }
function pensionEmployees_() { return pensionRows_(pensionEmployeesSheet_()); }

/** What an employer is shown about one of their people. No access code. */
function pensionEmployeeForEmployer_(e) {
  return {
    name: String(e['employee'] || ''),
    position: String(e['position'] || ''),
    plan: String(e['plan'] || ''),
    companyAnnual: Number(e['company annual (tt$)'] || 0),
    companyLump: Number(e['company lump sum (tt$)'] || 0),
    employeeMonthly: Number(e['employee monthly (tt$)'] || 0),
    commencement: fmtDate_(e['commencement']),
    stage: String(e['stage'] || ''),
    birStatus: String(e['bir status'] || ''),
    policy: String(e['policy #'] || ''),
    updated: fmtDate_(e['updated']),
  };
}

/** What an employee is shown about themselves. Their own line, in full. */
function pensionEmployeeForSelf_(e) {
  var self = pensionEmployeeForEmployer_(e);
  self.company = String(e['company'] || '');
  self.beneficiaries = String(e['beneficiaries'] || '');
  self.agent = String(e['agent'] || '');
  self.notes = String(e['notes'] || '');
  return self;
}

function pensionCompanyPublic_(c) {
  return {
    name: String(c['company'] || ''),
    bir: String(c['bir file #'] || ''),
    contact: String(c['contact'] || ''),
    agent: String(c['agent'] || ''),
  };
}

/**
 * The whole of the access rule, in one function.
 * Company codes are tried first so a company code can never be read as an
 * employee's, whatever somebody types into the sheet.
 */
function pensionLookup_(code) {
  var key = codeKey_(code);
  if (key.length < PENSION.MIN_CODE) return { ok: false, error: 'That does not look like an access code.' };

  var companies = pensionCompanies_();
  var employees = pensionEmployees_();

  var company = companies.filter(function (c) { return codeKey_(c['company code']) === key; })[0];
  if (company) {
    var mine = employees.filter(function (e) {
      return codeKey_(e['company code']) === codeKey_(company['company code']);
    });
    var totals = mine.reduce(function (t, e) {
      t.annual += Number(e['company annual (tt$)'] || 0);
      t.lump += Number(e['company lump sum (tt$)'] || 0);
      t.own += Number(e['employee monthly (tt$)'] || 0) * 12;
      return t;
    }, { annual: 0, lump: 0, own: 0 });
    /* Live enrolments for this company — each with its own timeline, so the
       employer can see exactly which of their people is holding things up. */
    var enrols = [];
    try {
      enrols = penrolAll_()
        .filter(function (e) { return codeKey_(e['company code']) === codeKey_(company['company code']); })
        .map(penrolForEmployer_);
    } catch (err) { /* the register still works before the flow tabs exist */ }

    return {
      ok: true, kind: 'employer',
      company: pensionCompanyPublic_(company),
      employees: mine.map(pensionEmployeeForEmployer_),
      enrolments: enrols,
      totals: totals,
      asOf: nowStamp_(),
      matched: 'company:' + String(company['company'] || '').slice(0, 40),
    };
  }

  var employee = employees.filter(function (e) { return codeKey_(e['access code']) === key; })[0];
  if (employee) {
    var theirs = companies.filter(function (c) {
      return codeKey_(c['company code']) === codeKey_(employee['company code']);
    })[0];
    return {
      ok: true, kind: 'employee',
      employee: pensionEmployeeForSelf_(employee),
      company: theirs ? pensionCompanyPublic_(theirs) : { name: String(employee['company'] || '') },
      asOf: nowStamp_(),
      matched: 'employee:' + String(employee['employee'] || '').slice(0, 40),
    };
  }

  /* An enrolment code — issued when the employer completed their part. This is
     the code in the invitation email, and it is how an employee gets in before
     they are on the register proper. */
  var enrol;
  try {
    enrol = penrolAll_().filter(function (e) { return codeKey_(e['employee code']) === key; })[0];
  } catch (err) { enrol = null; }
  if (enrol) {
    var co = companies.filter(function (c) {
      return codeKey_(c['company code']) === codeKey_(enrol['company code']);
    })[0];
    return {
      ok: true, kind: 'employee',
      employee: {
        name: enrol['employee'], company: enrol['company'], plan: enrol['plan'],
        companyAnnual: Number(enrol['company annual (tt$)'] || 0),
        companyLump: Number(enrol['company lump sum (tt$)'] || 0),
        employeeMonthly: Number(enrol['employee monthly (tt$)'] || 0),
        commencement: fmtDate_(enrol['commencement']),
        stage: penrolStageName_(enrol), birStatus: '',
        policy: enrol['policy #'] || '',
        beneficiaries: enrol['beneficiaries'] || '',
        agent: enrol['agent'] || '',
        notes: '',
      },
      enrolment: penrolForEmployee_(enrol),
      company: co ? pensionCompanyPublic_(co) : { name: String(enrol['company'] || '') },
      asOf: nowStamp_(),
      matched: 'enrolment:' + String(enrol['id'] || ''),
    };
  }

  return { ok: false, error: 'That code was not recognised. Check it with the branch — codes are issued by us, not by your employer.' };
}

/* ---------- the endpoint ---------- */

/** Keeps the tail of a code out of the log — enough to trace, not enough to reuse. */
function maskCode_(code) {
  var k = codeKey_(code);
  if (!k) return '(blank)';
  return k.slice(0, 4) + '…' + String(k.length);
}

function pensionApi_(p) {
  var code = String(p.code || '');
  var out;
  try {
    out = pensionLookup_(code);
  } catch (err) {
    out = { ok: false, error: 'The register could not be read. Please tell the branch.' };
    console.error('pensionApi_: ' + err);
  }
  try {
    pensionLogSheet_().appendRow([
      new Date(), maskCode_(code), out.ok ? 'found' : 'no match',
      out.matched || '', String(p.from || 'site').slice(0, 60),
    ]);
  } catch (err) { /* a log failure must never cost the client their answer */ }

  delete out.matched;
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- setting it up ---------- */

/** Creates both register tabs with their headings, and the log. */
function setupPensionTabs() {
  pensionCompaniesSheet_();
  pensionEmployeesSheet_();
  pensionLogSheet_();
  SpreadsheetApp.getUi().alert(
    'Pension register ready.\n\n' +
    '"' + PENSION.COMPANIES_SHEET + '" — one row per company.\n' +
    '"' + PENSION.EMPLOYEES_SHEET + '" — one row per employee case.\n\n' +
    'Fill in the companies and employees, then run "Pension — issue missing codes".');
}

/** Unambiguous alphabet: no O/0, no I/1, no S/5 — these get read aloud. */
var PENSION_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXY2346789';

function pensionCode_(prefix) {
  var s = '';
  for (var i = 0; i < 8; i++) s += PENSION_ALPHABET.charAt(Math.floor(Math.random() * PENSION_ALPHABET.length));
  return prefix + '-' + s.slice(0, 4) + '-' + s.slice(4);
}

/**
 * Fills every blank Company Code and Access Code with a fresh one. Existing
 * codes are never touched — a code already given to a client keeps working.
 */
function issuePensionCodes() {
  var used = {};
  var issued = 0;

  var cs = pensionCompaniesSheet_(), cmap = headerMap_(cs);
  var ccol = col_(cmap, 'company code') + 1;
  var es = pensionEmployeesSheet_(), emap = headerMap_(es);
  var ecol = col_(emap, 'access code') + 1;

  function claim(v) { var k = codeKey_(v); if (k) used[k] = true; }
  function fresh(prefix) {
    for (var i = 0; i < 200; i++) {
      var c = pensionCode_(prefix);
      if (!used[codeKey_(c)]) { used[codeKey_(c)] = true; return c; }
    }
    throw new Error('Could not find an unused code.');
  }

  if (cs.getLastRow() > 1) cs.getRange(2, ccol, cs.getLastRow() - 1, 1).getValues().forEach(function (r) { claim(r[0]); });
  if (es.getLastRow() > 1) es.getRange(2, ecol, es.getLastRow() - 1, 1).getValues().forEach(function (r) { claim(r[0]); });

  [[cs, ccol, 'CO'], [es, ecol, 'EM']].forEach(function (t) {
    var sh = t[0], colIndex = t[1], prefix = t[2];
    if (sh.getLastRow() < 2) return;
    var range = sh.getRange(2, colIndex, sh.getLastRow() - 1, 1);
    var vals = range.getValues();
    for (var i = 0; i < vals.length; i++) {
      if (codeKey_(vals[i][0])) continue;
      // don't stamp a code onto an entirely blank row
      if (!String(sh.getRange(i + 2, 1, 1, sh.getLastColumn()).getValues()[0].join('')).trim()) continue;
      vals[i][0] = fresh(prefix);
      issued++;
    }
    range.setValues(vals);
  });

  SpreadsheetApp.getUi().alert(issued
    ? issued + ' new code' + (issued === 1 ? '' : 's') + ' issued. Existing codes were left alone.'
    : 'Every row already has a code.');
}

/** Shows the sign-in address to give clients, so nobody has to remember it. */
function showPensionPortalLink() {
  requireUrl_();
  SpreadsheetApp.getUi().alert(
    'Employers and employees sign in at:\n\n' +
    'https://pensionplantt.com/\n\n' +
    'Choose "I\'m the employer" or "I\'m the employee" and enter the code from ' +
    'the register.\n\nA direct link that fills the code in for them:\n\n' +
    'https://pensionplantt.com/?code=THEIR-CODE');
}
