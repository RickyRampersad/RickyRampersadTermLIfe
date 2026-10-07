/**
 * ============================================================
 *  GROUP CLIENT MANAGEMENT — the employers' weekly service report
 *  Ricky Rampersad Branch · rickyrampersadbranch.com/groupclientmanagement/
 * ============================================================
 *
 *  Asked for on 7 October 2026: "staff logs in … on the days that we send off
 *  clients group, they actually see the groups that they assign … the account
 *  pulls up with the task that more or less opens with the employees … when
 *  they click send, they can preview the template before sending … all of
 *  these things are logged on that date … the group logs in with the code and
 *  sees … the task, but underneath can read the comment, verify if it's
 *  correct … the manager's login view … the number of groups and how it's
 *  being serviced, the ratios, the responses, and the star ratings by staff …
 *  it builds into the group management wall."
 *
 *  Four pages, one backend (this file, beside Service.gs, Transition.gs and
 *  ServiceSalesforce.gs in the Service Questionnaire project):
 *    groupclientmanagement/index.html   staff (their groups) and the manager (every group, the analytics)
 *    groupclientmanagement/client.html  a group signs in with its list bill and its code
 *    groupclientmanagement/wall.html    the group management wall, on the branch code
 *  The pages hold no client data: everything comes from here, to a person
 *  who signed in, so nothing about a group ever sits in the public repository.
 *
 *  The group tabs live in their own spreadsheet, "Group Client Management" (asked
 *  for the same day: "if this is the sheet for managing groups why import into
 *  the service questionnaire"). The script stays in the Service Questionnaire
 *  project, where the sign-in (Agent Skill Bank), the Salesforce login, the
 *  support@ mailbox and the web address already are, and opens the group sheet
 *  by its ID in the GCM_SHEET_ID Script property. The ID is never in this file:
 *  the .gs files are public. Without the property, the tabs are looked for in
 *  the Service Questionnaire spreadsheet itself.
 *
 *  Where it reads:
 *    Group Register   the groups: name, Salesforce account(s), list bills,
 *                     match words, the client contact, the group's code. Kept
 *                     by hand; imported once. Who a group is assigned to is
 *                     NOT here: it is the account's owner in Salesforce, read
 *                     by the refresh (asked for on 7 October 2026: "read who is
 *                     the account owner in Salesforce instead of a spreadsheet").
 *    Salesforce       through ServiceSalesforce.gs's sign-in (the SF_* Script
 *                     properties). gcmRefresh_ reads every task on a group's
 *                     account, its billing records, its employees' policies
 *                     (by account or list bill) and their contact records, plus
 *                     any task naming the group, and writes the Group Tasks tab.
 *                     An hourly trigger keeps it fresh in working hours; staff
 *                     can refresh by hand. Chatter is read live when a group is
 *                     opened.
 *  Where it writes:
 *    Group Tasks      the snapshot above (rewritten whole, never edited by hand)
 *    Group Sends      every letter: when, who, to whom, what it said, which items
 *    Group Responses  every answer a group gives: per item, and the rating
 *    Group Shares     which items and which Chatter comments a group may see
 *    Salesforce       a group's note on an item, and a staff note for the group,
 *                     are posted to that task's Chatter
 *
 *  Rules that are not optional:
 *    - An employer never sees a member's health or a claim (GCM_PRIVATE): those
 *      items stay with staff, whatever is ticked.
 *    - An item reached only through an employee (their own policy or contact
 *      record) is the staff's to see; it reaches the group only when a person
 *      ticks it. Items on the group's own account, its billing, or naming the
 *      group are shown unless a person unticks them.
 *    - A Chatter comment reaches the group only when a person ticks it: Chatter
 *      is where staff write to each other.
 *    - A copy of an e-mail Salesforce logged as a task, and the birthday flow's
 *      e-mails, are not work and are never counted (GCM_LOGGED).
 *    - A list bill is printed on every bill, so it is the group's sign-in name,
 *      never its password: the group's own code is the password.
 *
 *  Setup (once): paste this file into the project; add the two gcm lines to
 *  Service.gs's doGet and doPost (they are in the repository copy); run
 *  gcmSetup from the editor; import the Group Register; Deploy → Manage
 *  deployments → New version. GROUP-CLIENTS-SETUP.md has the steps.
 */

var GCM = {
  REGISTER: 'Group Register',
  TASKS: 'Group Tasks',
  SENDS: 'Group Sends',
  RESPONSES: 'Group Responses',
  SHARES: 'Group Shares',
  SEND_DAY: 2,              // Tuesday (1 Monday … 7 Sunday): the day staff send the week's letters
  RESPOND_DAY: 5,           // the letter asks for an answer by Friday of the same week
  SITE: 'https://rickyrampersadbranch.com/groupclientmanagement/',
  COPY: ['rickyrampersadsalessupport@myguardiangroup.com'],   // a blind copy of every letter: the record of what went
  TRIES: 8, LOCK_S: 900,    // wrong codes on one list bill before it closes for fifteen minutes
  MIN_CODE: 10,             // a group code shorter than this opens nothing
  HOURS: [6, 18],           // the hourly refresh runs from 6:00 to 18:00, Monday to Saturday
  CHUNK: 150               // ids in one Chatter read
};

var GCM_HEAD = {
  'Group Register':  ['Group', 'Account Ids', 'List bills', 'Match words', 'Owner in Salesforce', 'Owner active', 'Owner e-mail', 'To', 'Cc', 'Greeting', 'Code', 'Enabled', 'Note'],
  'Group Tasks':     ['Group', 'Task Id', 'Subject', 'Task type', 'Category', 'Status', 'Open', 'Due', 'Opened', 'Completed', 'Owner', 'For', 'Ref', 'Level', 'Private'],
  'Group Sends':     ['When', 'Group', 'Staff', 'To', 'Cc', 'Subject', 'Items', 'Task Ids', 'Letter', 'Via', 'Status'],
  'Group Responses': ['When', 'Group', 'Name', 'Role', 'Task Id', 'Task', 'Verdict', 'Note', 'Rating', 'Comment', 'Staff', 'Chatter'],
  'Group Shares':    ['When', 'Group', 'Task Id', 'Kind', 'Value', 'By']
};

/* The order a group's page lists its items in, and the client's words for a status. */
var GCM_CATS = ['Group Life', 'Group Health', 'Group Pensions', 'Member enrolments', 'Member terminations', 'Claims', 'Audit and confirmations'];
var GCM_STATUS = { 'waiting on someone else': 'Awaiting your confirmation', 'not started': 'Scheduled',
                   'in progress': 'In progress with us', 'deferred': 'On hold' };
/* An employer sees its plan's administration, never a member's health. */
var GCM_PRIVATE = /MEDICAL|CLAIM|DIAGNOS|HOSPITAL|SURGER|CARDIO|\bECG\b|\bLAB\b|BLOOD|PRESCRIPTION|DOCTOR|\bAPS\b|\bPMAR\b|CERTIFICATE OF HEALTH/i;
/* Salesforce logs every e-mail as a closed task, and the birthday flow does the same: they close the moment they are
   logged. In 2026 they were 615 of the groups' 1,176 completed tasks; counted, they show an on-time record the work
   does not have. */
var GCM_LOGGED = /^\s*(<p>)?\W*(Email|Re|Fwd?)\s*:|\$Record\.|Happy Birthday/i;
/* Internal items: the branch's own reminders to itself, and staff matters. */
var GCM_EXCLUDE = [/^ACTION THIS MORNING/i, /^HR\s*-/i, /\bINTERNAL\b/i, /release letter to/i];
var GCM_EXCLUDE_TYPES = ['HR', 'Lic/Staffing/SA/HR'];

/* ── routes (Service.gs's doGet and doPost hand every gcm.* action here) ─────────────────── */

function gcmDoGet_(p) {
  try {
    switch (String(p.action || '')) {
      case 'gcm.ping':    return { ok: true, gcm: 1, salesforce: tSfOn_(), mail: !!tMsCreds_(), refreshed: gcmRefreshed_() };
      case 'gcm.board':   return gcmBoard_(p);
      case 'gcm.group':   return gcmGroupView_(p);
      case 'gcm.preview': return gcmPreview_(p);
      case 'gcm.refresh': return gcmRefreshAsked_(p);
      case 'gcm.client':  return gcmClient_(p);
      case 'gcm.wall':    return gcmWall_(p);
    }
    return { ok: false, error: 'Unknown action' };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) };
  }
}

function gcmDoPost_(b) {
  try {
    switch (String(b.action || '')) {
      case 'gcm.send':   return gcmSend_(b);
      case 'gcm.share':  return gcmShare_(b);
      case 'gcm.review': return gcmReview_(b);
    }
    return { ok: false, error: 'Unknown action' };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) };
  }
}

/* ── setup ──────────────────────────────────────────────────────── */

/** Run once from the editor: makes the five tabs (touching none that exist) and the hourly refresh. */
function gcmSetup() {
  Object.keys(GCM_HEAD).forEach(function (n) { gcmSheet_(n); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'gcmRefreshTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('gcmRefreshTick').timeBased().everyHours(1).create();
  var on = tSfOn_(), gs = gcmSS_(), own = gs.getId() === ss_().getId();
  return tSay_('Group client management is set up in "' + gs.getName() + '"' + (own ? ' (this spreadsheet: set GCM_SHEET_ID to keep the group tabs in a sheet of their own)' : '') +
    ': the five Group tabs exist and the refresh runs every hour from ' +
    GCM.HOURS[0] + ':00 to ' + GCM.HOURS[1] + ':00, Monday to Saturday.\n\n' +
    (on ? 'Salesforce is linked. Run gcmRefresh once now to fill the Group Tasks tab.'
        : 'Salesforce is NOT linked to this project yet: copy SF_KEY, SF_SECRET and SF_LOGIN_URL from the KPI Tracker into Project Settings → Script properties, then run gcmRefresh.'));
}

/** The editor's Run button, and the hourly trigger. */
function gcmRefresh() { var r = gcmRefreshLocked_(); return tSay_(r.ok ? r.said : ('Not refreshed: ' + r.error)); }
function gcmRefreshTick() {
  var tz = tTz_(), now = new Date(), h = Number(Utilities.formatDate(now, tz, 'H')), d = Number(Utilities.formatDate(now, tz, 'u'));
  if (d === 7 || h < GCM.HOURS[0] || h > GCM.HOURS[1]) return;
  gcmRefreshLocked_();
}

/* ── sheet plumbing ─────────────────────────────────────────────── */

/** The group sheet: the spreadsheet whose ID is the GCM_SHEET_ID Script property, else this project's own. Opened once
 *  a run. */
var GCM_SS = null;
function gcmSS_() {
  if (GCM_SS) return GCM_SS;
  var id = String(PropertiesService.getScriptProperties().getProperty('GCM_SHEET_ID') || '').trim();
  var m = /\/d\/([A-Za-z0-9_-]{20,})/.exec(id);   // a whole link pasted in works too
  if (m) id = m[1];
  if (!id) return (GCM_SS = ss_());
  try { GCM_SS = SpreadsheetApp.openById(id); }
  catch (e) { throw new Error('The group sheet in GCM_SHEET_ID could not be opened (' + String(e && e.message ? e.message : e).slice(0, 120) + '): check the ID, and that the script owner can edit that sheet.'); }
  return GCM_SS;
}

function gcmSheet_(name) {
  var ss = gcmSS_(), sh = ss.getSheetByName(name), head = GCM_HEAD[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** A tab as objects keyed by header, each with _n, its sheet row. */
function gcmRows_(name) {
  var sh = gcmSS_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getDataRange().getValues(), head = vals[0].map(function (h) { return String(h).trim(); });
  return vals.slice(1).map(function (r, i) {
    var o = { _n: i + 2 };
    head.forEach(function (h, j) { if (h) o[h] = r[j]; });
    return o;
  });
}

function gcmAppend_(name, rows) {
  if (!rows.length) return;
  var sh = gcmSheet_(name), head = GCM_HEAD[name];
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, head.length).setValues(rows.map(function (o) {
    return head.map(function (h) { var v = o[h]; return v === undefined || v === null ? '' : v; });
  }));
}

function gcmText_(x) { return x === null || x === undefined ? '' : (x instanceof Date ? gcmYmd_(x) : String(x).trim()); }
function gcmList_(x) { return gcmText_(x).split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s; }); }
function gcmYes_(x) { return x === true || /^(y|yes|true|1|x)$/i.test(gcmText_(x)); }

/** A date as yyyy-MM-dd in the sheet's zone; '' for nothing. Takes a Date, a Salesforce date or date-time, or yyyy-MM-dd. */
function gcmYmd_(x) {
  if (!x) return '';
  if (x instanceof Date) return isNaN(x.getTime()) ? '' : Utilities.formatDate(x, tTz_(), 'yyyy-MM-dd');
  var s = String(x);
  if (/T\d{2}:\d{2}/.test(s)) { var d = new Date(s.replace(/\+0000$/, 'Z')); return isNaN(d.getTime()) ? s.slice(0, 10) : Utilities.formatDate(d, tTz_(), 'yyyy-MM-dd'); }
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[0] : '';
}
function gcmDays_(a, b) {   // whole days from yyyy-MM-dd a to b
  var p = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
  var n = Math.round((p(b) - p(a)) / 86400000);
  return isNaN(n) ? null : n;
}
function gcmToday_() { return gcmYmd_(new Date()); }
/** Monday of the week a yyyy-MM-dd falls in, and the day of the week (1 Monday … 7 Sunday). */
function gcmDow_(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd); var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay(); return d === 0 ? 7 : d; }
function gcmAddDays_(ymd, n) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd); var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)); return d.toISOString().slice(0, 10); }
function gcmMonday_(ymd) { return gcmAddDays_(ymd, 1 - gcmDow_(ymd)); }
function gcmWhen_(x) {   // a date-time as the pages print it
  var d = x instanceof Date ? x : new Date(String(x || '').replace(/\+0000$/, 'Z'));
  return isNaN(d.getTime()) ? gcmText_(x) : Utilities.formatDate(d, tTz_(), 'd MMM yyyy, h:mm a');
}

/** A list bill as a key: letters and digits only, so "TGM 1099" and "TGM1099", "PIND - 067" and "PIND067" are one. */
function gcmBillKey_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function gcmCodeKey_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function gcmId15_(s) { return String(s || '').slice(0, 15); }

/* ── the register ───────────────────────────────────────────────── */

/** Every enabled group: { key, name, accts (15-character ids), acctsFull, bills, billKeys, match, assigned, ownerActive,
 *  to, cc, greeting, code, note }. `assigned` is the account's owner in Salesforce, which the refresh writes onto the
 *  register as a mirror: to move a group to someone else, change the account owner in Salesforce. There is no column
 *  that overrides it, so the board and Salesforce can never disagree about who looks after a group. */
function gcmRegister_() {
  return gcmRows_(GCM.REGISTER).filter(function (r) {
    return gcmText_(r.Group) && !/^(n|no|false|0)$/i.test(gcmText_(r.Enabled));
  }).map(function (r) {
    var accts = gcmList_(r['Account Ids']), bills = gcmList_(r['List bills']);
    var owner = gcmText_(r['Owner in Salesforce']);
    return {
      _n: r._n, key: gcmCodeKey_(r.Group), name: gcmText_(r.Group),
      accts: accts.map(gcmId15_), acctsFull: accts, bills: bills, billKeys: bills.map(gcmBillKey_),
      match: gcmList_(r['Match words']), assigned: owner, owner: owner, ownerActive: !/^(n|no|false)$/i.test(gcmText_(r['Owner active'])),
      ownerEmail: gcmText_(r['Owner e-mail']).toLowerCase(),
      to: gcmList_(r.To), cc: gcmList_(r.Cc), greeting: gcmText_(r.Greeting), code: gcmText_(r.Code), note: gcmText_(r.Note)
    };
  });
}

/* ── Salesforce ─────────────────────────────────────────────────── */

/** A SOQL query, every page of it. The first page goes through the composite resource (a POST), so a long query never
 *  meets URL Fetch's limit on the length of an address; the next pages are short addresses Salesforce gives back. */
function gcmQuery_(soql) {
  var tok = svcSfToken_(), out = [];
  var go = function (fn) {
    var r = fn(tok);
    if (r.getResponseCode() === 401) { svcSfProps_().deleteProperty('SVC_SF_TOKEN'); tok = svcSfToken_(); r = fn(tok); }
    return r;
  };
  var res = go(function (t) {
    return UrlFetchApp.fetch(t.instance_url + '/services/data/' + SVCSF.API + '/composite', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t.access_token },
      payload: JSON.stringify({ allOrNone: false, compositeRequest: [{ method: 'GET', referenceId: 'q',
        url: '/services/data/' + SVCSF.API + '/query?q=' + encodeURIComponent(soql) }] })
    });
  });
  if (res.getResponseCode() !== 200) throw new Error('Salesforce did not answer: HTTP ' + res.getResponseCode());
  var sub = (JSON.parse(res.getContentText()).compositeResponse || [])[0] || {};
  if (sub.httpStatusCode !== 200) {
    var b = sub.body && sub.body[0] ? sub.body[0] : {};
    throw new Error('Salesforce refused a query: ' + String(b.message || b.errorCode || sub.httpStatusCode).slice(0, 200));
  }
  var page = sub.body;
  for (;;) {
    out = out.concat(page.records || []);
    if (!page.nextRecordsUrl) break;
    var next = page.nextRecordsUrl;
    var r2 = go(function (t) { return UrlFetchApp.fetch(t.instance_url + next, { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t.access_token } }); });
    if (r2.getResponseCode() !== 200) throw new Error('Salesforce stopped part-way through a query: HTTP ' + r2.getResponseCode());
    page = JSON.parse(r2.getContentText());
  }
  return out;
}
function gcmIn_(list) { return list.map(function (x) { return "'" + svcSoqlLit_(x) + "'"; }).join(','); }
function gcmName_(rec, key) { var v = rec && rec[key]; return v && typeof v === 'object' ? String(v.Name || '') : ''; }

/** Whether a task names the group: a match word starting a word in its subject or record name. A single match word must
 *  also end one ("ACME" never matches "Acmeline"); a name of several words may run on ("ACME & CO" matches "ACME &
 *  COMPANY"). SOQL LIKE finds the word inside other words too: a short match word inside a medical term once put
 *  another person's medical requirement on a group's page. */
function gcmNames_(t, g) {
  var text = (t.Subject || '') + ' ' + gcmName_(t, 'What');
  return g.match.some(function (w) {
    w = w.trim();
    if (!w) return false;
    var end = /\s/.test(w) ? '' : '(?![A-Za-z0-9])';
    return new RegExp('(?:^|[^A-Za-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + end, 'i').test(text);
  });
}

function gcmExcluded_(subject, type) {
  if (GCM_LOGGED.test(subject)) return 'logged e-mail';
  if (GCM_EXCLUDE_TYPES.indexOf(type) >= 0) return 'internal';
  for (var i = 0; i < GCM_EXCLUDE.length; i++) if (GCM_EXCLUDE[i].test(subject)) return 'internal';
  return '';
}

function gcmCategory_(subject, type) {
  var s = String(subject || '').toUpperCase();
  if (/T-\s*LIFE|GROUP LIFE/.test(s)) return 'Group Life';
  if (/T-\s*HEALTH|GROUP HEALTH/.test(s)) return 'Group Health';
  if (/PENSION/.test(s)) return 'Group Pensions';
  if (/AUDIT|CONFIRMATION/.test(s)) return 'Audit and confirmations';
  if (/ENROL|JOINER|NEW MEMBER|JOINING/.test(s)) return 'Member enrolments';
  if (/TERMINAT|RESIGN|LEAVER/.test(s)) return 'Member terminations';
  if (/CLAIM/.test(s)) return 'Claims';
  return 'Other service items';
}

/** A task's subject as a group reads it: the billing subjects in words, the group's own name taken out. */
function gcmTitle_(subject, groupName) {
  var s = tPlain_(subject).replace(/\s+/g, ' ');
  var m = /T-\s*(LIFE|HEALTH|PENSIONS)\s*GROUP-?\s*(Renewal|Billing)\s*Date\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(s);
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (m) {
    var kind = { LIFE: 'Group Life', HEALTH: 'Group Health', PENSIONS: 'Group Pensions' }[m[1].toUpperCase()];
    return kind + ' ' + (m[2].toLowerCase() === 'renewal' ? 'renewal billing' : 'billing') + ', ' + MONTHS[Number(m[3]) - 1] + ' ' + m[5];
  }
  s = s.replace(/^(DRAFT:|URGENT:)\s*/i, '');
  if (groupName) s = s.split(new RegExp(groupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).join('');
  s = s.replace(/\s*[-–|]\s*([-–|]\s*)+/g, ' – ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–|:]+|[\s\-–|:]+$/g, '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Service item';
}

function gcmDoneText_(cat, status) {
  var st = String(status || '').toLowerCase();
  if (GCM_CATS.slice(0, 3).indexOf(cat) >= 0) return /waiting/.test(st) ? 'Billing prepared and issued to you. Waiting for your confirmation.'
    : 'Billing being reconciled by our team before it is confirmed with you.';
  if (cat === 'Audit and confirmations') return 'Request received. Our team is preparing the confirmation.';
  if (/waiting/.test(st)) return 'Our part is complete. Waiting for information or confirmation from you.';
  return 'Our team is working on this item.';
}

/** Rebuild the Group Tasks tab from Salesforce. One at a time: a second run waits for the first, or gives up after 30s. */
function gcmRefreshLocked_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, error: 'A refresh is already running. Try again in a minute.' };
  try { return gcmRefresh_(); } finally { lock.releaseLock(); }
}

function gcmRefresh_() {
  if (!tSfOn_()) return { ok: false, error: 'Salesforce is not linked to this project: copy SF_KEY, SF_SECRET and SF_LOGIN_URL from the KPI Tracker into Project Settings → Script properties.' };
  var reg = gcmRegister_();
  if (!reg.length) return { ok: false, error: 'The Group Register tab has no groups yet.' };
  var byAcct = {}, byBill = {}, accts = [], bills = [];
  reg.forEach(function (g, gi) {
    g.acctsFull.forEach(function (a) { if (!byAcct[gcmId15_(a)]) { byAcct[gcmId15_(a)] = gi; accts.push(a); } });
    g.bills.forEach(function (b) {
      var k = gcmBillKey_(b);
      if (byBill[k] === undefined) byBill[k] = gi;
      /* the sheet types one list bill several ways ("TGM 1099", "TGM1099"): ask for each spelling we know of */
      [b, b.replace(/\s+/g, ''), b.replace(/^([A-Za-z]+)\s*(\d+)$/, '$1 $2')].forEach(function (v) { if (bills.indexOf(v) < 0) bills.push(v); });
    });
  });

  /* who each group is assigned to: its account's owner in Salesforce, and whether that user is still active */
  var owners = {};
  if (accts.length) gcmQuery_('SELECT Id, Owner.Name, Owner.Email, Owner.IsActive FROM Account WHERE Id IN (' + gcmIn_(accts) + ')').forEach(function (a) {
    owners[gcmId15_(a.Id)] = { name: gcmName_(a, 'Owner'), email: String((a.Owner && a.Owner.Email) || ''), active: !(a.Owner && a.Owner.IsActive === false) };
  });

  /* the employees: every policy on the group's account or carrying its list bill, and the contact behind it */
  var polWhere = [];
  if (accts.length) polWhere.push('Account__c IN (' + gcmIn_(accts) + ')');
  if (bills.length) polWhere.push('List_Bill__c IN (' + gcmIn_(bills) + ')');
  var polGroup = {}, contactGroup = {};
  if (polWhere.length) gcmQuery_('SELECT Id, Account__c, List_Bill__c, Contact__c FROM CLIENT_PORTFOLIO__c WHERE ' + polWhere.join(' OR ')).forEach(function (p) {
    var gi = byAcct[gcmId15_(p.Account__c)];
    if (gi === undefined) gi = byBill[gcmBillKey_(p.List_Bill__c)];
    if (gi === undefined) return;
    polGroup[gcmId15_(p.Id)] = gi;
    if (p.Contact__c && contactGroup[gcmId15_(p.Contact__c)] === undefined) contactGroup[gcmId15_(p.Contact__c)] = gi;
  });
  var transGroup = {};
  if (accts.length) gcmQuery_('SELECT Id, Account__c FROM TRANSACTIONS__c WHERE Account__c IN (' + gcmIn_(accts) + ') AND CreatedDate = LAST_N_DAYS:800').forEach(function (t) {
    var gi = byAcct[gcmId15_(t.Account__c)]; if (gi !== undefined) transGroup[gcmId15_(t.Id)] = gi;
  });

  /* the tasks: open, or opened this year. Salesforce takes a subquery only at the top of a WHERE, never inside an OR,
     so each way in is its own query, and a task found twice is kept once (the first way in wins: the group's own
     account, its billing, its name, then its employees) */
  var F = 'Id, Subject, Type, Task_Type__c, Status, IsClosed, ActivityDate, CreatedDate, CompletedDateTime, LastModifiedDate, WhatId, WhoId, Owner.Name, Who.Name, What.Name, What.Type';
  var W = ' AND (IsClosed = false OR CreatedDate = THIS_YEAR)';
  var polSub = polWhere.length ? '(SELECT Id FROM CLIENT_PORTFOLIO__c WHERE ' + polWhere.join(' OR ') + ')' : '';
  var conSub = polWhere.length ? '(SELECT Contact__c FROM CLIENT_PORTFOLIO__c WHERE ' + polWhere.join(' OR ') + ')' : '';
  var seen = {}, rows = [], excluded = 0;
  var take = function (t, gi, level) {
    var id = gcmId15_(t.Id);
    if (seen[id] || gi === undefined) return;
    seen[id] = true;
    var subject = String(t.Subject || ''), type = String(t.Task_Type__c || t.Type || '');
    if (gcmExcluded_(subject, type)) { excluded++; return; }
    var cat = gcmCategory_(subject, type);
    rows.push([reg[gi].name, t.Id, subject.slice(0, 500), type, cat, String(t.Status || ''), t.IsClosed ? 'N' : 'Y',
      gcmYmd_(t.ActivityDate), gcmYmd_(t.CreatedDate), t.IsClosed ? gcmYmd_(t.CompletedDateTime || t.LastModifiedDate) : '',
      gcmName_(t, 'Owner'), gcmName_(t, 'Who'), gcmName_(t, 'What') && /TRANSACTIONS__c/.test((t.What || {}).Type || '') ? gcmName_(t, 'What') : '',
      level, GCM_PRIVATE.test(subject) ? 'Y' : '']);
  };
  if (accts.length) gcmQuery_('SELECT ' + F + ' FROM Task WHERE WhatId IN (' + gcmIn_(accts) + ')' + W).forEach(function (t) { take(t, byAcct[gcmId15_(t.WhatId)], 'group'); });
  if (accts.length) gcmQuery_('SELECT ' + F + ' FROM Task WHERE WhatId IN (SELECT Id FROM TRANSACTIONS__c WHERE Account__c IN (' + gcmIn_(accts) + '))' + W)
    .forEach(function (t) { take(t, transGroup[gcmId15_(t.WhatId)], 'group'); });
  var words = [];
  reg.forEach(function (g) { g.match.forEach(function (w) { if (w.trim()) words.push(w.trim()); }); });
  if (words.length) {
    var like = words.map(function (w) { var l = svcSoqlLit_(w).replace(/%/g, '\\%').replace(/_/g, '\\_'); return "Subject LIKE '%" + l + "%' OR What.Name LIKE '%" + l + "%'"; }).join(' OR ');
    gcmQuery_('SELECT ' + F + ' FROM Task WHERE (' + like + ')' + W).forEach(function (t) {
      for (var gi = 0; gi < reg.length; gi++) if (gcmNames_(t, reg[gi])) { take(t, gi, 'group'); return; }
    });
  }
  if (polSub) {
    gcmQuery_('SELECT ' + F + ' FROM Task WHERE WhatId IN ' + polSub + W).forEach(function (t) { take(t, polGroup[gcmId15_(t.WhatId)], 'member'); });
    gcmQuery_('SELECT ' + F + ' FROM Task WHERE WhoId IN ' + conSub + W).forEach(function (t) { take(t, contactGroup[gcmId15_(t.WhoId)], 'member'); });
  }

  /* write: the tab whole, new over old, so a reader never meets it empty */
  var sh = gcmSheet_(GCM.TASKS), head = GCM_HEAD[GCM.TASKS];
  if (rows.length) {
    sh.getRange(2, 1, rows.length, head.length).setNumberFormat('@').setValues(rows);
  }
  var extra = sh.getLastRow() - 1 - rows.length;
  if (extra > 0) sh.getRange(rows.length + 2, 1, extra, head.length).clearContent();
  /* the owners onto the register, as a mirror of Salesforce (the two columns are added if the tab lacks them) */
  var regSh = gcmSS_().getSheetByName(GCM.REGISTER);
  var regHead = regSh.getRange(1, 1, 1, regSh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  ['Owner in Salesforce', 'Owner active', 'Owner e-mail'].forEach(function (h) {
    if (regHead.indexOf(h) < 0) { regSh.getRange(1, regHead.length + 1).setValue(h).setFontWeight('bold'); regHead.push(h); }
  });
  var ocol = regHead.indexOf('Owner in Salesforce') + 1, acol = regHead.indexOf('Owner active') + 1, ecol = regHead.indexOf('Owner e-mail') + 1;
  reg.forEach(function (g) {
    /* a group on two accounts takes the first owner still active in Salesforce, else the first owner */
    var cand = g.accts.map(function (a) { return owners[a]; }).filter(function (x) { return x && x.name; });
    var o = cand.filter(function (x) { return x.active; })[0] || cand[0];
    if (!o) return;
    regSh.getRange(g._n, ocol).setValue(o.name);
    regSh.getRange(g._n, acol).setValue(o.active ? 'Y' : 'N');
    regSh.getRange(g._n, ecol).setValue(o.email);
  });
  var when = gcmWhen_(new Date());
  PropertiesService.getScriptProperties().setProperty('gcm_refreshed', when);
  try { CacheService.getScriptCache().remove('gcm-load'); } catch (e) {}
  var open = rows.filter(function (r) { return r[6] === 'Y'; }).length;
  return { ok: true, tasks: rows.length, open: open, excluded: excluded, refreshed: when,
    said: 'Group Tasks refreshed ' + when + ': ' + rows.length + ' tasks across ' + reg.length + ' groups (' + open + ' open); ' + excluded + ' logged e-mails and internal items left out.' };
}
function gcmRefreshed_() { return PropertiesService.getScriptProperties().getProperty('gcm_refreshed') || ''; }

/** Chatter on some tasks: { taskId15: [{ id, by, when, text, replies: [...] }] }, newest first. Never throws. */
function gcmFeed_(ids) {
  var out = {};
  if (!ids.length || !tSfOn_()) return out;
  try {
    for (var i = 0; i < ids.length; i += GCM.CHUNK) {
      gcmQuery_('SELECT Id, ParentId, Body, CreatedDate, CreatedBy.Name, (SELECT CommentBody, CreatedDate, CreatedBy.Name FROM FeedComments ORDER BY CreatedDate ASC LIMIT 10) ' +
        'FROM FeedItem WHERE ParentId IN (' + gcmIn_(ids.slice(i, i + GCM.CHUNK)) + ") AND Type = 'TextPost' ORDER BY CreatedDate DESC").forEach(function (f) {
        (out[gcmId15_(f.ParentId)] = out[gcmId15_(f.ParentId)] || []).push({ id: f.Id, by: gcmName_(f, 'CreatedBy'), when: gcmWhen_(f.CreatedDate),
          text: tPlain_(f.Body).slice(0, 1500),
          replies: ((f.FeedComments && f.FeedComments.records) || []).map(function (c) { return { by: gcmName_(c, 'CreatedBy'), when: gcmWhen_(c.CreatedDate), text: tPlain_(c.CommentBody).slice(0, 800) }; }) });
      });
    }
  } catch (e) { out._error = String(e && e.message ? e.message : e).slice(0, 200); }
  return out;
}

/* ── everything the pages read, assembled once a request ─────────── */

function gcmLoad_() {
  var reg = gcmRegister_(), byName = {};
  reg.forEach(function (g) { byName[g.key] = g; g.tasks = []; g.sends = []; g.resps = []; g.shares = { show: {}, post: {} }; });
  gcmRows_(GCM.TASKS).forEach(function (r) {
    var g = byName[gcmCodeKey_(r.Group)];
    if (!g || !gcmText_(r['Task Id'])) return;
    g.tasks.push({ id: gcmText_(r['Task Id']), id15: gcmId15_(gcmText_(r['Task Id'])), subject: gcmText_(r.Subject), type: gcmText_(r['Task type']),
      cat: gcmText_(r.Category) || 'Other service items', status: gcmText_(r.Status), open: gcmText_(r.Open) === 'Y',
      due: gcmYmd_(r.Due), opened: gcmYmd_(r.Opened), done: gcmYmd_(r.Completed), owner: gcmText_(r.Owner), who: gcmText_(r.For),
      ref: gcmText_(r.Ref), level: gcmText_(r.Level) || 'group', priv: gcmText_(r.Private) === 'Y' });
  });
  gcmRows_(GCM.SENDS).forEach(function (r) {
    var g = byName[gcmCodeKey_(r.Group)];
    if (g) g.sends.push({ when: gcmYmd_(r.When), at: gcmWhen_(r.When), staff: gcmText_(r.Staff), subject: gcmText_(r.Subject), items: Number(r.Items) || 0, via: gcmText_(r.Via), status: gcmText_(r.Status) });
  });
  gcmRows_(GCM.RESPONSES).forEach(function (r) {
    var g = byName[gcmCodeKey_(r.Group)];
    if (g) g.resps.push({ when: gcmYmd_(r.When), at: gcmWhen_(r.When), name: gcmText_(r.Name), role: gcmText_(r.Role), task: gcmId15_(gcmText_(r['Task Id'])),
      title: gcmText_(r.Task), verdict: gcmText_(r.Verdict), note: gcmText_(r.Note), rating: Number(r.Rating) || 0, comment: gcmText_(r.Comment), staff: gcmText_(r.Staff) });
  });
  gcmRows_(GCM.SHARES).forEach(function (r) {   // the newest row for a task or a post wins
    var g = byName[gcmCodeKey_(r.Group)];
    if (!g) return;
    var kind = gcmText_(r.Kind), task = gcmId15_(gcmText_(r['Task Id'])), v = gcmText_(r.Value);
    if (kind === 'show') g.shares.show[task] = gcmYes_(v);
    if (kind === 'post') { var m = /^(\S+)\s+(Y|N)$/.exec(v); if (m) g.shares.post[m[1]] = m[2] === 'Y'; }
  });
  return { reg: reg, byName: byName, today: gcmToday_(), refreshed: gcmRefreshed_() };
}

/** Whether a group sees an item: never a member's health or a claim; an item on the group itself unless a person
 *  unticked it; an item reached only through an employee only when a person ticked it. */
function gcmShown_(g, t) {
  if (t.priv) return false;
  var s = g.shares.show[t.id15];
  return s === undefined ? t.level === 'group' : s;
}

/** The numbers for one group, as at today. */
function gcmGroupStats_(g, today) {
  var monday = gcmMonday_(today), yearStart = today.slice(0, 4) + '-01-01';
  var s = { open: 0, late: 0, waiting: 0, oldest: 0, done: 0, withDue: 0, onTime: 0, days: 0, doneWeek: 0, doneToday: 0, shown: 0 };
  g.tasks.forEach(function (t) {
    if (t.open) {
      s.open++;
      if (t.due && t.due < today) s.late++;
      if (/waiting/i.test(t.status)) s.waiting++;
      var age = gcmDays_(t.opened, today); if (age !== null && age > s.oldest) s.oldest = age;
      if (gcmShown_(g, t)) s.shown++;
    } else if (t.done && t.done >= yearStart) {
      s.done++;
      if (t.due) { s.withDue++; if (t.done <= t.due) s.onTime++; }
      var d = gcmDays_(t.opened, t.done); if (d !== null && d >= 0) s.days += d;
      if (t.done >= monday) s.doneWeek++;
      if (t.done === today) s.doneToday++;
    }
  });
  s.onTimePct = s.withDue ? Math.round(100 * s.onTime / s.withDue) : null;
  s.avgDays = s.done ? Math.round(s.days / s.done) : null;
  var sent = g.sends.filter(function (x) { return x.when >= monday && !/failed/i.test(x.status); });
  s.sentThisWeek = sent.length ? sent[sent.length - 1].at : '';
  s.lastSent = g.sends.length ? g.sends[g.sends.length - 1].at : '';
  var dow = gcmDow_(today);
  s.week = sent.length ? 'sent' : (dow >= GCM.SEND_DAY && dow <= 6 ? 'due' : 'upcoming');
  var rated = g.resps.filter(function (r) { return r.rating; });
  s.ratings = rated.length;
  s.rating = rated.length ? Math.round(10 * rated.reduce(function (a, r) { return a + r.rating; }, 0) / rated.length) / 10 : null;
  s.lastRating = rated.length ? rated[rated.length - 1].rating : null;
  s.verdicts = { correct: 0, change: 0, notours: 0 };
  g.resps.forEach(function (r) { if (s.verdicts[r.verdict] !== undefined) s.verdicts[r.verdict]++; });
  s.lastResponse = g.resps.length ? g.resps[g.resps.length - 1].at : '';
  s.ready = !!(g.to.length && g.code && g.bills.length);
  s.why = !g.to.length ? 'No client contact on the register' : !g.code ? 'No code on the register' : !g.bills.length ? 'No list bill on the register' : '';
  return s;
}

/* ── staff and the manager ───────────────────────────────────────── */

/** Who is asking, by their agent number and password (or the branch code): the branch manager and the assistant branch
 *  manager see every group; staff see the groups assigned to them. Agents and unit managers are not this page's. */
function gcmWho_(p) {
  var w = tWho_(p.code, p.who);
  if (!w.ok) return w;
  if (w.role === 'branch') return { ok: true, role: 'branch', name: w.me ? w.me.name : 'Branch', email: w.me ? w.me.email : '' };
  if (w.role === 'staff') return { ok: true, role: 'staff', name: w.me.name, email: w.me.email };
  return { ok: false, refused: true, error: 'Group client management is for the branch’s staff and the branch manager.' };
}
/** Whether a group is this person's: the branch sees every group; staff the groups whose account they own in Salesforce,
 *  matched by e-mail first, then by name. The Agent Skill Bank and Salesforce do not always spell a person the same way
 *  (on 7 October 2026 one staff member was "SASHA LALLA" on the one and "Sasha Lalla-Jagassar" on the other, and her
 *  board was empty). */
function gcmMine_(who, g) {
  if (who.role === 'branch') return true;
  var em = String(who.email || '').trim().toLowerCase();
  if (em && g.ownerEmail && em === g.ownerEmail) return true;
  return gcmSameName_(g.assigned, who.name);
}
/** One person under two spellings: the same first name, and every other part of the shorter name inside the longer
 *  ("Sasha Lalla" and "Sasha Lalla-Jagassar"). A first name alone matches only itself. */
function gcmSameName_(a, b) {
  var t = function (s) { return String(s || '').toLowerCase().split(/[^a-z]+/).filter(String); };
  var x = t(a), y = t(b);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  if (x[0] !== y[0] || Math.min(x.length, y.length) < 2) return false;
  var short = x.length <= y.length ? x : y, long = short === x ? y : x;
  return short.slice(1).every(function (p) { return long.indexOf(p) > 0; });
}
/** The name a letter is signed with: the staff member's own, as Salesforce has it, else as the sign-in gives it, out of
 *  capitals ("SASHA LALLA" reads "Sasha Lalla"). */
function gcmSigner_(who, g) {
  if (who.role === 'staff' && g.assigned && gcmMine_(who, g)) return g.assigned;
  var n = String(who.name || '').trim();
  return n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[\s'-])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); }) : n;
}

function gcmBoard_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  var L = gcmLoad_(), today = L.today;
  var groups = L.reg.filter(function (g) { return gcmMine_(who, g); }).map(function (g) {
    var s = gcmGroupStats_(g, today);
    return { key: g.key, name: g.name, assigned: g.assigned, ownerActive: g.ownerActive, bills: g.bills, stats: s,
      doneToday: g.tasks.filter(function (t) { return !t.open && t.done === today; }).map(function (t) { return { title: gcmTitle_(t.subject, g.name), type: t.type || t.cat, by: t.owner }; }).slice(0, 12) };
  });
  var urgency = function (x) { return (x.stats.week === 'due' ? 1000 : 0) + x.stats.late * 10 + x.stats.waiting * 5 + Math.min(x.stats.oldest, 99) / 100; };
  groups.sort(function (a, b) { return urgency(b) - urgency(a); });
  var out = { ok: true, role: who.role, me: who.name, today: today, sendDay: GCM.SEND_DAY, dow: gcmDow_(today), refreshed: L.refreshed,
    salesforce: tSfOn_(), mail: !!tMsCreds_(), groups: groups };
  if (who.role === 'branch') out.analytics = gcmAnalytics_(L);
  return out;
}

/** The manager's view: the branch, by staff, by task type, week by week, and what to act on. */
function gcmAnalytics_(L) {
  var today = L.today, monday = gcmMonday_(today), yearStart = today.slice(0, 4) + '-01-01';
  var staff = {}, types = {}, weeks = [], resp = [], act = [];
  var S = function (n) { var k = tNameKey_(n) || 'unassigned'; return staff[k] = staff[k] || { name: n || 'Not assigned', groups: 0, due: 0, sent: 0, open: 0, late: 0, done: 0, withDue: 0, onTime: 0, days: 0, ratings: 0, ratingSum: 0, verdicts: 0, correct: 0, responses: 0 }; };
  for (var w = 7; w >= 0; w--) weeks.push({ from: gcmAddDays_(monday, -7 * w), done: 0, withDue: 0, onTime: 0, sent: 0, responses: 0 });
  var weekOf = function (ymd) { for (var i = weeks.length - 1; i >= 0; i--) if (ymd >= weeks[i].from) return weeks[i]; return null; };
  var tot = { groups: L.reg.length, open: 0, late: 0, waiting: 0, done: 0, withDue: 0, onTime: 0, days: 0, sentWeek: 0, dueWeek: 0, responsesWeek: 0, ratings: 0, ratingSum: 0, doneToday: 0 };
  L.reg.forEach(function (g) {
    var s = gcmGroupStats_(g, today), a = S(g.assigned);
    a.groups++;
    if (s.week === 'sent') { a.sent++; tot.sentWeek++; } else if (s.week === 'due') { a.due++; tot.dueWeek++; }
    tot.open += s.open; tot.late += s.late; tot.waiting += s.waiting; tot.doneToday += s.doneToday;
    g.tasks.forEach(function (t) {
      /* the Task Type field as Salesforce has it; a task without one says so, because untyped work cannot be measured by type */
      var tk = t.type || 'Not typed in Salesforce';
      var o = S(t.owner), ty = types[tk] = types[tk] || { type: tk, open: 0, done: 0, withDue: 0, onTime: 0, days: 0 };
      if (t.open) { o.open++; ty.open++; if (t.due && t.due < today) o.late++; return; }
      if (!t.done || t.done < yearStart) return;
      var d = gcmDays_(t.opened, t.done);
      o.done++; ty.done++; tot.done++;
      if (d !== null && d >= 0) { o.days += d; ty.days += d; tot.days += d; }
      if (t.due) { o.withDue++; ty.withDue++; tot.withDue++; if (t.done <= t.due) { o.onTime++; ty.onTime++; tot.onTime++; } }
      var wk = weekOf(t.done); if (wk) { wk.done++; if (t.due) { wk.withDue++; if (t.done <= t.due) wk.onTime++; } }
    });
    g.sends.forEach(function (x) { var wk = weekOf(x.when); if (wk && !/failed/i.test(x.status)) wk.sent++; });
    g.resps.forEach(function (r) {
      var st = S(r.staff || g.assigned), wk = weekOf(r.when);
      if (r.rating) { st.ratings++; st.ratingSum += r.rating; tot.ratings++; tot.ratingSum += r.rating; }
      if (r.verdict) { st.verdicts++; if (r.verdict === 'correct') st.correct++; }
      st.responses++;
      if (wk) wk.responses++;
      if (r.when >= monday) tot.responsesWeek++;
      if (r.when >= gcmAddDays_(today, -30) && (r.verdict === 'change' || r.verdict === 'notours' || (r.rating && r.rating <= 3) || r.comment || r.note))
        resp.push({ group: g.name, at: r.at, when: r.when, name: r.name, task: r.title, verdict: r.verdict, note: r.note, rating: r.rating, comment: r.comment, staff: r.staff || g.assigned });
    });
    if (s.week === 'due') act.push({ group: g.name, what: 'This week’s letter has not gone', who: g.assigned, kind: 'send' });
    if (s.late) act.push({ group: g.name, what: s.late + ' item' + (s.late > 1 ? 's' : '') + ' past target', who: g.assigned, kind: 'late' });
    if (s.lastRating !== null && s.lastRating <= 3) act.push({ group: g.name, what: 'Rated us ' + s.lastRating + ' of 5', who: g.assigned, kind: 'rating' });
    if (!s.ready) act.push({ group: g.name, what: s.why, who: g.assigned, kind: 'setup' });
    if (!g.assigned) act.push({ group: g.name, what: 'No account owner in Salesforce: give the account an owner', who: '', kind: 'owner' });
    else if (!g.ownerActive) act.push({ group: g.name, what: 'Its account owner in Salesforce is no longer an active user: change the account owner', who: g.assigned, kind: 'owner' });
  });
  var pct = function (a, b) { return b ? Math.round(100 * a / b) : null; };
  var avg = function (a, b) { return b ? Math.round(a / b) : null; };
  resp.sort(function (a, b) { return a.when < b.when ? 1 : -1; });
  return {
    totals: { groups: tot.groups, open: tot.open, late: tot.late, waiting: tot.waiting, done: tot.done, onTimePct: pct(tot.onTime, tot.withDue),
      avgDays: avg(tot.days, tot.done), sentWeek: tot.sentWeek, dueWeek: tot.dueWeek, responsesWeek: tot.responsesWeek, doneToday: tot.doneToday,
      rating: tot.ratings ? Math.round(10 * tot.ratingSum / tot.ratings) / 10 : null, ratings: tot.ratings },
    staff: Object.keys(staff).map(function (k) { var a = staff[k]; return { name: a.name, groups: a.groups, sent: a.sent, due: a.due, open: a.open, late: a.late, done: a.done,
      onTimePct: pct(a.onTime, a.withDue), avgDays: avg(a.days, a.done), rating: a.ratings ? Math.round(10 * a.ratingSum / a.ratings) / 10 : null, ratings: a.ratings,
      accuracy: pct(a.correct, a.verdicts), verdicts: a.verdicts, responses: a.responses }; })
      .filter(function (a) { return a.groups || a.done || a.open || a.responses; })
      .sort(function (a, b) { return (b.groups - a.groups) || (b.done - a.done); }),
    types: Object.keys(types).map(function (k) { var t = types[k]; return { type: t.type, open: t.open, done: t.done, onTimePct: pct(t.onTime, t.withDue), avgDays: avg(t.days, t.done) }; })
      .sort(function (a, b) { return (b.done + b.open) - (a.done + a.open); }),
    weeks: weeks.map(function (w) { return { from: w.from, done: w.done, onTimePct: pct(w.onTime, w.withDue), sent: w.sent, responses: w.responses }; }),
    responses: resp.slice(0, 30),
    act: act.sort(function (a, b) { var o = ['owner', 'send', 'rating', 'late', 'setup']; return o.indexOf(a.kind) - o.indexOf(b.kind); })
  };
}

/** One group, for staff to check before the letter: every item with its Chatter, what the group sees, the record, the
 *  letters sent and the answers given. */
function gcmGroupView_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(p.group)];
  if (!g || !gcmMine_(who, g)) return { ok: false, error: 'That group is not on your list.' };
  var today = L.today, open = g.tasks.filter(function (t) { return t.open; });
  var feed = gcmFeed_(open.map(function (t) { return t.id; }));
  var mine = {};
  g.resps.forEach(function (r) { if (r.task) mine[r.task] = r; });
  var items = open.map(function (t) {
    return { id: t.id, title: gcmTitle_(t.subject, g.name), subject: t.subject, type: t.type || t.cat, cat: t.cat, status: t.status,
      clientStatus: GCM_STATUS[t.status.toLowerCase()] || 'In progress with us', owner: t.owner, who: t.who, ref: t.ref,
      opened: t.opened, age: gcmDays_(t.opened, today), due: t.due, late: !!(t.due && t.due < today), level: t.level, priv: t.priv,
      shown: gcmShown_(g, t), posts: (feed[t.id15] || []).map(function (f) { f.shared = !!g.shares.post[f.id]; return f; }),
      answer: mine[t.id15] ? { verdict: mine[t.id15].verdict, note: mine[t.id15].note, by: mine[t.id15].name, at: mine[t.id15].at } : null };
  }).sort(function (a, b) { return (b.late - a.late) || ((b.age || 0) - (a.age || 0)); });
  var weekAgo = gcmAddDays_(today, -7);
  return { ok: true, role: who.role, me: who.name, today: today, refreshed: L.refreshed, feedError: feed._error || '',
    group: { key: g.key, name: g.name, assigned: g.assigned, ownerActive: g.ownerActive, bills: g.bills, to: g.to, cc: g.cc, greeting: g.greeting, hasCode: !!g.code, note: g.note },
    stats: gcmGroupStats_(g, today), items: items, record: gcmRecord_(g, today),
    doneWeek: g.tasks.filter(function (t) { return !t.open && t.done >= weekAgo; }).map(function (t) {
      return { title: gcmTitle_(t.subject, g.name), type: t.type || t.cat, by: t.owner, done: t.done, shown: gcmShown_(g, t) }; }),
    sends: g.sends.slice(-10).reverse(), responses: g.resps.slice(-25).reverse() };
}

/** A group's year, by category, counting only what the group may see. */
function gcmRecord_(g, today) {
  var yearStart = today.slice(0, 4) + '-01-01', rows = {};
  g.tasks.forEach(function (t) {
    if (t.priv) return;
    var r = rows[t.cat] = rows[t.cat] || { type: t.cat, done: 0, withDue: 0, onTime: 0, days: 0, open: 0 };
    if (t.open) { if (gcmShown_(g, t)) r.open++; return; }
    if (!t.done || t.done < yearStart || t.level !== 'group') return;
    r.done++;
    if (t.due) { r.withDue++; if (t.done <= t.due) r.onTime++; }
    var d = gcmDays_(t.opened, t.done); if (d !== null && d >= 0) r.days += d;
  });
  var order = GCM_CATS.concat(['Other service items']);
  return Object.keys(rows).map(function (k) { var r = rows[k]; return { type: r.type, done: r.done, open: r.open,
    onTimePct: r.withDue ? Math.round(100 * r.onTime / r.withDue) : null, avgDays: r.done ? Math.round(r.days / r.done) : null }; })
    .filter(function (r) { return r.done || r.open; })
    .sort(function (a, b) { return order.indexOf(a.type) - order.indexOf(b.type); });
}

/* ── the letter ─────────────────────────────────────────────────── */

/** The week's letter for one group, written from its own numbers: the headline is the thing that most needs the
 *  group's attention, and the body says what was done, what is open and what we need from them. */
function gcmLetter_(g, today, staffName, intro) {
  var s = gcmGroupStats_(g, today), rec = gcmRecord_(g, today);
  var shown = g.tasks.filter(function (t) { return t.open && gcmShown_(g, t); });
  var waiting = shown.filter(function (t) { return /waiting/i.test(t.status); });
  var late = shown.filter(function (t) { return t.due && t.due < today; });
  var joiners = shown.filter(function (t) { return t.cat === 'Member enrolments'; }).length;
  var leavers = shown.filter(function (t) { return t.cat === 'Member terminations'; }).length;
  var weekAgo = gcmAddDays_(today, -7);
  var doneWeek = g.tasks.filter(function (t) { return !t.open && t.level === 'group' && !t.priv && t.done >= weekAgo; }).length;
  var yr = rec.reduce(function (a, r) { a.done += r.done; return a; }, { done: 0 });
  var onT = s.onTimePct;
  var respondBy = gcmAddDays_(gcmMonday_(today), GCM.RESPOND_DAY - 1);
  if (respondBy < today) respondBy = gcmAddDays_(respondBy, 7);
  var dmy = function (ymd) { return tDmy_(ymd); };
  var headline = waiting.length ? waiting.length + (waiting.length === 1 ? ' item is' : ' items are') + ' waiting on your confirmation'
    : late.length ? 'Where your ' + late.length + ' longer-running item' + (late.length === 1 ? ' stands' : 's stand')
    : shown.length ? 'Your ' + shown.length + ' open item' + (shown.length === 1 ? '' : 's') + ', and where each one stands'
    : 'Nothing open: here is what we completed for you';
  var subject = 'Your weekly service report: ' + g.name;
  var lines = [];
  if (doneWeek) lines.push('This week our team completed ' + doneWeek + ' item' + (doneWeek === 1 ? '' : 's') + ' for you.');
  if (shown.length) lines.push('We have ' + shown.length + ' item' + (shown.length === 1 ? '' : 's') + ' open for ' + g.name + (s.oldest ? ', the oldest opened ' + s.oldest + ' days ago' : '') + '.');
  if (waiting.length) lines.push(waiting.length === 1 ? 'One needs your confirmation before we can close it.' : waiting.length + ' need your confirmation before we can close them.');
  if (late.length) lines.push(late.length === 1 ? 'One has run past its target date; your page shows why and who is on it.' : late.length + ' have run past their target dates; your page shows why and who is on each.');
  if (joiners || leavers) lines.push('Members: ' + [joiners ? joiners + ' joining' : '', leavers ? leavers + ' leaving' : ''].filter(String).join(', ') + '. Please check the names on your page.');
  if (yr.done) lines.push('So far this year we have completed ' + yr.done + ' item' + (yr.done === 1 ? '' : 's') + ' for you' + (onT !== null ? ', ' + onT + '% of them by their target date' : '') + '.');
  var greet = 'Dear ' + (g.greeting || 'Sir or Madam') + ',';
  var text = [greet, '', intro ? intro + '\n' : '', headline + '.', '', lines.join(' '), '',
    'Your service page shows every item: what it is, who on our team is handling it, how long it has been open, its target date and our latest note. ' +
    'Please tell us on the page whether each one is correct, add a note where something needs our attention, and rate our service.', '',
    'Your page: ' + GCM.SITE + 'client.html', 'Sign in with your list bill (' + g.bills[0] + ') and your access code: ' + (g.code || '(not set)'), '',
    'We would be grateful for your answers by ' + dmy(respondBy) + '.', '', 'Warm regards,', staffName, 'Ricky Rampersad Branch, Guardian Life of the Caribbean',
    '9-13 Endeavour 1st Street, Chaguanas · (868) 226-6461'].join('\n').replace(/\n{3,}/g, '\n\n');
  var E = tEsc_;
  var tile = function (n, label, warn) { return '<td style="padding:10px 8px;text-align:center;border:1px solid #e3e6ea;width:25%"><div style="font:700 24px/1.1 Arial,sans-serif;color:' + (warn ? '#b3261e' : '#07131f') + '">' + E(String(n)) + '</div><div style="font:12px/1.3 Arial,sans-serif;color:#5b6573;margin-top:4px">' + E(label) + '</div></td>'; };
  var list = function (arr) { return arr.slice(0, 8).map(function (t) { return '<li style="margin:4px 0">' + E(gcmTitle_(t.subject, g.name)) + (t.owner ? ' <span style="color:#5b6573">· ' + E(t.owner) + '</span>' : '') + '</li>'; }).join('') + (arr.length > 8 ? '<li style="color:#5b6573">and ' + (arr.length - 8) + ' more on your page</li>' : ''); };
  var html = '<div style="background:#f4f5f7;padding:20px 0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse">' +
    '<tr><td style="background:#07131f;padding:22px 26px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td><img src="https://rickyrampersadbranch.com/logo-mark.png" width="44" height="44" alt="" style="display:block;border-radius:12px"></td>' +
    '<td style="padding-left:12px;font:700 15px/1.2 Arial,sans-serif;color:#ffffff">Ricky Rampersad Branch<div style="font:400 12px/1.4 Arial,sans-serif;color:#efc24b">Group client service report</div></td></tr></table>' +
    '<div style="font:700 24px/1.25 Arial,sans-serif;color:#ffffff;margin-top:18px">' + E(headline) + '</div>' +
    '<div style="font:14px/1.4 Arial,sans-serif;color:#c8d0da;margin-top:6px">' + E(g.name) + ' · as at ' + E(dmy(today)) + '</div></td></tr>' +
    '<tr><td style="padding:22px 26px;font:15px/1.6 Arial,sans-serif;color:#1f2933">' +
    '<p style="margin:0 0 12px">' + E(greet) + '</p>' + (intro ? '<p style="margin:0 0 12px">' + E(intro).replace(/\n/g, '<br>') + '</p>' : '') +
    '<p style="margin:0 0 16px">' + E(lines.join(' ')) + '</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 18px"><tr>' +
    tile(shown.length, 'open items') + tile(waiting.length, 'waiting on you', waiting.length > 0) + tile(late.length, 'past target', late.length > 0) +
    tile(onT === null ? '–' : onT + '%', 'on time this year') + '</tr></table>' +
    (waiting.length ? '<p style="margin:0 0 4px;font-weight:700">Waiting on your confirmation</p><ul style="margin:0 0 14px;padding-left:20px">' + list(waiting) + '</ul>' : '') +
    (late.length ? '<p style="margin:0 0 4px;font-weight:700">Past target</p><ul style="margin:0 0 14px;padding-left:20px">' + list(late) + '</ul>' : '') +
    '<p style="margin:0 0 16px">Your service page shows every item: what it is, who on our team is handling it, how long it has been open, its target date and our latest note. Tell us whether each one is correct, add a note where something needs our attention, and rate our service.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td style="background:#07131f;border-radius:6px"><a href="' + GCM.SITE + 'client.html" style="display:inline-block;padding:13px 22px;font:700 15px Arial,sans-serif;color:#ffffff;text-decoration:none">Open your service page</a></td></tr></table>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border:1px dashed #c9942c;background:#fbf6ea;margin:0 0 18px"><tr><td style="padding:10px 14px;font:14px/1.5 Arial,sans-serif">' +
    'List bill: <b>' + E(g.bills[0] || '') + '</b><br>Access code: <b style="letter-spacing:.08em">' + E(g.code || '(not set)') + '</b></td></tr></table>' +
    '<p style="margin:0 0 18px">We would be grateful for your answers by <b>' + E(dmy(respondBy)) + '</b>.</p>' +
    '<p style="margin:0;border-top:2px solid #efc24b;padding-top:12px">Warm regards,<br><b>' + E(staffName) + '</b><br>Ricky Rampersad Branch, Guardian Life of the Caribbean<br>9-13 Endeavour 1st Street, Chaguanas · (868) 226-6461</p>' +
    tLegal_(null) + '</td></tr></table></div>';
  return { subject: subject, html: html, text: text, headline: headline, items: shown.map(function (t) { return t.id; }), respondBy: respondBy,
    waiting: waiting.length, late: late.length, open: shown.length };
}

function gcmPreview_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(p.group)];
  if (!g || !gcmMine_(who, g)) return { ok: false, error: 'That group is not on your list.' };
  var s = gcmGroupStats_(g, L.today), letter = gcmLetter_(g, L.today, gcmSigner_(who, g), String(p.intro || '').slice(0, 1200));
  return { ok: true, letter: letter, to: g.to, cc: g.cc, copy: GCM.COPY, ready: s.ready, why: s.why, mail: !!tMsCreds_() };
}

/** Send the week's letter, and log it. The letter is written here again from the sheet, never taken from the page.
 *  Without Microsoft 365 set up, nothing is sent from here: the page gets the plain letter to open in Outlook, and the
 *  row says so. */
function gcmSend_(b) {
  var who = gcmWho_(b);
  if (!who.ok) return who;
  if (!b.checked) return { ok: false, error: 'Tick that you have checked every item before it goes.' };
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(b.group)];
  if (!g || !gcmMine_(who, g)) return { ok: false, error: 'That group is not on your list.' };
  var s = gcmGroupStats_(g, L.today);
  if (!s.ready) return { ok: false, error: s.why + ': nothing was sent.' };
  var letter = gcmLetter_(g, L.today, gcmSigner_(who, g), String(b.intro || '').slice(0, 1200));
  var row = { When: new Date(), Group: g.name, Staff: who.name, To: g.to.join(', '), Cc: g.cc.join(', '), Subject: letter.subject,
    Items: letter.items.length, 'Task Ids': letter.items.join(' ').slice(0, 45000), Letter: letter.text.slice(0, 45000) };
  if (!tMsCreds_() || b.outlook) {
    row.Via = 'Outlook, by ' + who.name; row.Status = 'opened in Outlook';
    gcmAppend_(GCM.SENDS, [row]);
    return { ok: true, outlook: { to: g.to, cc: g.cc, bcc: GCM.COPY, subject: letter.subject, body: letter.text } };
  }
  try {
    tMsSend_(g.to[0], letter.subject, letter.html, { cc: g.to.slice(1).concat(g.cc), bcc: GCM.COPY, replyTo: TRANSITION.MS_FROM });
    row.Via = TRANSITION.MS_FROM; row.Status = 'sent';
    gcmAppend_(GCM.SENDS, [row]);
    return { ok: true, sent: true, at: gcmWhen_(row.When) };
  } catch (e) {
    row.Via = TRANSITION.MS_FROM; row.Status = 'failed: ' + String(e && e.message ? e.message : e).slice(0, 200);
    gcmAppend_(GCM.SENDS, [row]);
    return { ok: false, error: row.Status };
  }
}

/** Staff decide what the group sees: an item shown or not, a Chatter comment shared or not, and a note for the group,
 *  posted to the task's Chatter and shared at once. */
function gcmShare_(b) {
  var who = gcmWho_(b);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(b.group)];
  if (!g || !gcmMine_(who, g)) return { ok: false, error: 'That group is not on your list.' };
  var t = g.tasks.filter(function (x) { return x.id15 === gcmId15_(b.task); })[0];
  if (!t) return { ok: false, error: 'That item is not on this group.' };
  var row = { When: new Date(), Group: g.name, 'Task Id': t.id, By: who.name };
  if (b.kind === 'show') {
    if (t.priv && gcmYes_(b.value)) return { ok: false, error: 'This item names a member’s health or a claim: it stays with staff.' };
    row.Kind = 'show'; row.Value = gcmYes_(b.value) ? 'Y' : 'N';
  } else if (b.kind === 'post') {
    if (!/^[A-Za-z0-9]{15,18}$/.test(String(b.post || ''))) return { ok: false, error: 'Which comment?' };
    if (t.priv) return { ok: false, error: 'This item stays with staff.' };
    row.Kind = 'post'; row.Value = b.post + ' ' + (gcmYes_(b.value) ? 'Y' : 'N');
  } else if (b.kind === 'note') {
    var text = String(b.text || '').trim().slice(0, 2000);
    if (!text) return { ok: false, error: 'Write the note first.' };
    if (t.priv) return { ok: false, error: 'This item stays with staff.' };
    if (!tSfOn_()) return { ok: false, error: 'Salesforce is not linked to this project, so the note cannot go onto the task.' };
    var res = tSfSend_('post', '/sobjects/FeedItem', { ParentId: t.id, Body: 'For ' + g.name + ' (shown on their service page), from ' + gcmSigner_(who, g) + ':\n' + text });
    row.Kind = 'post'; row.Value = String(res.id || '') + ' Y';
  } else return { ok: false, error: 'Unknown change.' };
  gcmAppend_(GCM.SHARES, [row]);
  return { ok: true };
}

/* ── the group's own page ────────────────────────────────────────── */

/** A group signs in with its list bill and its code, both. Eight wrong codes on one list bill close it for fifteen
 *  minutes; a refusal never says which of the two was wrong. */
function gcmClientAuth_(L, lb, code) {
  var bk = gcmBillKey_(lb), ck = gcmCodeKey_(code);
  if (!bk || !ck) return { ok: false, error: 'Enter your list bill and your access code.' };
  var tk = 'gcm-tries-' + bk.slice(0, 30);
  if (tTries_(tk) >= GCM.TRIES) return { ok: false, error: 'Too many tries. Wait fifteen minutes, or ask our sales support team for your code.' };
  var g = L.reg.filter(function (x) { return x.billKeys.indexOf(bk) >= 0 && x.code && gcmCodeKey_(x.code).length >= GCM.MIN_CODE && gcmCodeKey_(x.code) === ck; })[0];
  if (!g) { tTriesAdd_(tk); return { ok: false, error: 'That list bill and access code do not match. Check both against the e-mail we sent.' }; }
  tTriesClear_(tk);
  return { ok: true, g: g };
}

function gcmClient_(p) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, p.lb, p.code);
  if (!a.ok) return a;
  var g = a.g, today = L.today;
  var shown = g.tasks.filter(function (t) { return t.open && gcmShown_(g, t); });
  var feed = gcmFeed_(shown.map(function (t) { return t.id; }));
  var mine = {};
  g.resps.forEach(function (r) { if (r.task) mine[r.task] = r; });
  var respondBy = gcmAddDays_(gcmMonday_(today), GCM.RESPOND_DAY - 1);
  if (respondBy < today) respondBy = gcmAddDays_(respondBy, 7);
  var weekAgo = gcmAddDays_(today, -7);
  return { ok: true, group: g.name, staff: g.ownerActive ? g.assigned : '', asAt: L.refreshed || tDmy_(today), today: today, respondBy: respondBy,
    items: shown.map(function (t) {
      return { id: t.id15, title: gcmTitle_(t.subject, g.name), type: t.type || t.cat, cat: t.cat, status: GCM_STATUS[t.status.toLowerCase()] || 'In progress with us',
        done: gcmDoneText_(t.cat, t.status), owner: t.owner, who: t.who, ref: t.ref, opened: t.opened, age: gcmDays_(t.opened, today), due: t.due,
        late: !!(t.due && t.due < today),
        comments: (feed[t.id15] || []).filter(function (f) { return g.shares.post[f.id]; }).map(gcmShared_),
        answer: mine[t.id15] ? { verdict: mine[t.id15].verdict, note: mine[t.id15].note, at: mine[t.id15].at } : null };
    }).sort(function (x, y) { return (y.late - x.late) || ((y.age || 0) - (x.age || 0)); }),
    record: gcmRecord_(g, today),
    doneWeek: g.tasks.filter(function (t) { return !t.open && t.level === 'group' && !t.priv && t.done >= weekAgo; }).length,
    rated: g.resps.filter(function (r) { return r.rating && r.when >= gcmMonday_(today); }).length > 0,
    contact: 'rickyrampersadsalessupport@myguardiangroup.com' };
}

/** A shared comment as the group reads it. A note staff wrote on this site is posted by the integration's login, so its
 *  first line names who wrote it ("For <group> …, from <name>:"): that name is the author, and the line is not shown. */
function gcmShared_(f) {
  var m = /^For [^\n]*?, from ([^:\n]+):\n([\s\S]*)$/.exec(f.text);
  return m ? { by: m[1], when: f.when, text: m[2] } : { by: f.by, when: f.when, text: f.text };
}

/** A group's answers: each item correct, needing a change or not theirs, with a note, posted to the task's Chatter;
 *  and the rating. Logged on Group Responses, and the staff member and the branch are told. */
function gcmReview_(b) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, b.lb, b.code);
  if (!a.ok) return a;
  var g = a.g, name = String(b.name || '').trim().slice(0, 80), role = String(b.role || '').trim().slice(0, 80);
  if (!name) return { ok: false, error: 'Add your name, so our team knows who answered.' };
  var shown = {};
  g.tasks.forEach(function (t) { if (t.open && gcmShown_(g, t)) shown[t.id15] = t; });
  var V = { correct: 'Correct', change: 'Needs a change', notours: 'Not ours' };
  var rows = [], posted = 0, failed = 0, now = new Date();
  (b.items || []).slice(0, 200).forEach(function (it) {
    var t = shown[gcmId15_(it.id)], v = V[it.v] ? it.v : '', note = String(it.note || '').trim().slice(0, 1500);
    if (!t || (!v && !note)) return;
    var chatter = '';
    if (tSfOn_()) {
      try {
        var res = tSfSend_('post', '/sobjects/FeedItem', { ParentId: t.id, Body: 'Group review from ' + name + (role ? ', ' + role : '') + ' (' + g.name + '), on their service page: ' +
          (v ? V[v] : 'a note') + (note ? '\n' + note : '') });
        chatter = String(res.id || ''); posted++;
      } catch (e) { failed++; chatter = 'not posted: ' + String(e && e.message ? e.message : e).slice(0, 120); }
    }
    rows.push({ When: now, Group: g.name, Name: name, Role: role, 'Task Id': t.id, Task: gcmTitle_(t.subject, g.name), Verdict: v, Note: note, Staff: g.assigned, Chatter: chatter });
  });
  var rating = Math.round(Number(b.rating) || 0), comment = String(b.comment || '').trim().slice(0, 2000);
  if (rating >= 1 && rating <= 5 || comment) rows.push({ When: now, Group: g.name, Name: name, Role: role, Rating: rating >= 1 && rating <= 5 ? rating : '', Comment: comment, Staff: g.assigned });
  if (!rows.length) return { ok: false, error: 'Mark at least one item, or rate our service, before you send.' };
  gcmAppend_(GCM.RESPONSES, rows);
  try { gcmTell_(g, name, rows, rating, comment); } catch (e) {}
  return { ok: true, saved: rows.length, posted: posted, failed: failed };
}

/** The staff member the group is assigned to, and the branch, hear at once: an internal note, with what changed. */
function gcmTell_(g, name, rows, rating, comment) {
  var to = [];
  if (g.ownerEmail) to.push(g.ownerEmail);
  else tTeam_().people.forEach(function (p) { if (gcmSameName_(p.name, g.assigned) && p.email) to.push(p.email); });
  if (TRANSITION.CC && TRANSITION.CC.length) to = to.concat(TRANSITION.CC);
  if (!to.length) return;
  var V = { correct: 'Correct', change: 'Needs a change', notours: 'Not ours' };
  var flag = rows.filter(function (r) { return r.Verdict === 'change' || r.Verdict === 'notours' || r.Note; });
  var body = '<p><b>' + tEsc_(g.name) + '</b> answered on their service page (' + tEsc_(name) + ').</p>' +
    (rating ? '<p>Rating: <b>' + rating + ' of 5</b>' + (comment ? ' — “' + tEsc_(comment) + '”' : '') + '</p>' : (comment ? '<p>“' + tEsc_(comment) + '”</p>' : '')) +
    (flag.length ? '<p>To act on:</p><ul>' + flag.map(function (r) { return '<li>' + tEsc_(r.Task) + ': <b>' + (V[r.Verdict] || 'a note') + '</b>' + (r.Note ? ' — “' + tEsc_(r.Note) + '”' : '') + '</li>'; }).join('') + '</ul>'
      : '<p>Every item they marked is correct.</p>') +
    '<p>Each note is also on the task’s Chatter in Salesforce. <a href="' + GCM.SITE + '">Open group client management</a></p>' +
    '<p style="color:#777;font-size:12px">' + tEsc_(tInternal_(null)) + '</p>';
  MailApp.sendEmail({ to: to.join(','), subject: 'Group review in: ' + g.name + (rating ? ' · ' + rating + '/5' : '') + (flag.length ? ' · ' + flag.length + ' to act on' : ''), htmlBody: body, name: 'Ricky Rampersad Branch' });
}

/* ── the wall, on the branch code ────────────────────────────────── */

function gcmWall_(p) {
  var ok = tCodeOk_(p.code);
  if (!ok.ok) return { ok: false, refused: ok.configured, error: ok.configured ? 'That is not the branch code.' : 'Not open yet: the branch code is not set in Service.gs (TEAM_CODE).' };
  var L = gcmLoad_(), today = L.today;
  return { ok: true, today: today, dow: gcmDow_(today), sendDay: GCM.SEND_DAY, refreshed: L.refreshed, analytics: gcmAnalytics_(L),
    groups: L.reg.map(function (g) { var s = gcmGroupStats_(g, today); return { name: g.name, assigned: g.assigned, ownerActive: g.ownerActive, open: s.open, late: s.late, waiting: s.waiting, oldest: s.oldest,
      week: s.week, rating: s.rating, lastRating: s.lastRating, onTimePct: s.onTimePct, done: s.done }; }) };
}

function gcmRefreshAsked_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  return gcmRefreshLocked_();
}
