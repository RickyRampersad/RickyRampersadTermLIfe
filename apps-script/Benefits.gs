/**
 * ============================================================
 *  EMPLOYEE BENEFITS — branch backend
 *  Ricky Rampersad Branch · rickyrampersadbranch.com/benefits/
 * ============================================================
 *
 *  The pages under /benefits/ run entirely in the browser until this
 *  script is deployed; then they become a real multi-machine system:
 *
 *    pendings.html   reads the Pendings tab, saves "what is outstanding"
 *    upload.html     staff submit a month for review (documents attached)
 *    review.html     an administrator verifies; APPROVAL IS WHAT SENDS
 *
 *  ── DEPLOY (once, ~5 minutes) ────────────────────────────────────────
 *  1. Open the branch Google Sheet (the one with the Administrators tab).
 *  2. Extensions → Apps Script → paste this file in as Benefits.gs.
 *  3. Run benefitsSetup() once from the editor (authorise when asked).
 *     It creates any missing tabs and default properties, and touches
 *     nothing you already have.
 *  4. Deploy → New deployment → Web app:
 *        Execute as: Me        Who has access: Anyone
 *     Copy the /exec URL.
 *  5. Paste that URL into `const API = ""` near the top of the script in
 *     THREE files: benefits/pendings.html, benefits/upload.html,
 *     benefits/review.html. Commit, push, merge to main — Netlify ships it.
 *
 *  ── SHARING THE PROJECT WITH THE QUOTE ENGINE (Code.gs) ─────────────
 *  This file owns doGet/doPost and passes non-benefits traffic through to
 *  the quote engine. Code.gs must therefore rename two functions:
 *      function doPost(e)  →  function quoteDoPost_(e)
 *      function doGet()    →  function quoteDoGet_()
 *  Nothing else in Code.gs changes. The quote portal's EXISTING deployed
 *  URL keeps working regardless — deployments are pinned to the version
 *  they were made from — and after the rename, one new URL serves both.
 *
 *  ── SAFETY ───────────────────────────────────────────────────────────
 *  TEST MODE IS ON BY DEFAULT: approvals email BEN_NOTIFY (you), never
 *  the client, until you set BEN_TEST_MODE to "off" in Script Properties.
 *
 *  Every request carries an auth code and this script checks it here,
 *  server-side, against the Administrators tab — the browser gate is a
 *  door, this is the lock:
 *      administrators  = codes in the Administrators tab, or BEN_ADMIN_CODE
 *      staff           = BEN_STAFF_CODE (the assistant), or any administrator
 *  Whoever submitted a month cannot approve it — enforced here too, not
 *  only in the page.
 *
 *  ── TABS (benefitsSetup creates the missing ones) ────────────────────
 *  Administrators : Code | Name | Role            ← you maintain this
 *  Groups         : Group ID | Group Name | Lines | Billing Email | Portal Code
 *  Pendings       : Id | Account | Source Name | Member | Line | Policy |
 *                   Issued | Note | Note By | Note At
 *  Submissions    : Id | Group ID | Group Name | Month Key | Month | State |
 *                   Updated | JSON                ← the flow store
 *  Billing        : Group ID | Month | Line | Invoice | Billed | Paid |
 *                   Paid On | Method | Receipt | Note   ← feeds client History
 *  BenefitsActivity : At | By | Code | Did | Group | Month | Note
 *
 *  Uploaded documents are filed in Drive under
 *  Benefits Billing / <group> / <month> and attached to the email the
 *  approval sends.
 */

var BEN = {
  ADMINS_SHEET:   'Administrators',
  GROUPS_SHEET:   'Groups',
  PENDINGS_SHEET: 'Pendings',
  SUBS_SHEET:     'Submissions',
  BILLING_SHEET:  'Billing',
  ACTIVITY_SHEET: 'BenefitsActivity',
  DRIVE_ROOT:     'Benefits Billing',
  FROM_NAME:      'Ricky Rampersad Branch — Employee Benefits'
};

/* ============================ setup ============================ */

function benefitsSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var want = {};
  want[BEN.ADMINS_SHEET]   = ['Code', 'Name', 'Role'];
  want[BEN.GROUPS_SHEET]   = ['Group ID', 'Group Name', 'Lines', 'Billing Email', 'Portal Code'];
  want[BEN.PENDINGS_SHEET] = ['Id', 'Account', 'Source Name', 'Member', 'Line', 'Policy', 'Issued', 'Note', 'Note By', 'Note At'];
  want[BEN.SUBS_SHEET]     = ['Id', 'Group ID', 'Group Name', 'Month Key', 'Month', 'State', 'Updated', 'JSON'];
  want[BEN.BILLING_SHEET]  = ['Group ID', 'Month', 'Line', 'Invoice', 'Billed', 'Paid', 'Paid On', 'Method', 'Receipt', 'Note'];
  want[BEN.ACTIVITY_SHEET] = ['At', 'By', 'Code', 'Did', 'Group', 'Month', 'Note'];
  Object.keys(want).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (name === BEN.ADMINS_SHEET && !sh) {
      /* The branch may already keep its people on a tab of its own naming
         (Access); creating an empty Administrators tab beside it would be
         the one the resolver must then ignore. Skip if any qualifies. */
      try { if (badminsSheet_()) return; } catch (e) {}
    }
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, want[name].length).setValues([want[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('BEN_ADMIN_CODE')) p.setProperty('BEN_ADMIN_CODE', 'RRB-ADMIN-2026');
  if (!p.getProperty('BEN_STAFF_CODE')) p.setProperty('BEN_STAFF_CODE', 'RRB2026');
  if (!p.getProperty('BEN_TEST_MODE'))  p.setProperty('BEN_TEST_MODE', 'on');
  if (!p.getProperty('BEN_NOTIFY'))     p.setProperty('BEN_NOTIFY', Session.getEffectiveUser().getEmail());
  /* Who verifies. Submissions are emailed to the approver with the review
     link, with the branch manager copied. Blank = the manager reviews. */
  if (!p.getProperty('BEN_APPROVER_EMAIL')) p.setProperty('BEN_APPROVER_EMAIL', '');
  if (!p.getProperty('BEN_SITE')) p.setProperty('BEN_SITE', 'https://rickyrampersadbranch.com/benefits/');
}

/* ============================ plumbing ============================ */

function bss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function bsheet_(name) {
  var sh = bss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '" — run benefitsSetup() once.');
  return sh;
}
function bprop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function bjson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function bok_(o) { o = o || {}; o.ok = true; return bjson_(o); }
function berr_(msg) { return bjson_({ ok: false, error: msg }); }

/* Read a tab as objects keyed by lower-cased header words, so the
   Administrators tab you already made matches whether its column says
   Code, AGENT CODE or Agent #. */
function brows_(sh) {
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0].map(function (h) { return String(h).toLowerCase(); });
  return v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, c) { o[h] = r[c]; });
    return o;
  });
}
function bfield_(o, names) {
  var keys = Object.keys(o);
  for (var i = 0; i < names.length; i++) {
    for (var k = 0; k < keys.length; k++) {
      if (keys[k].indexOf(names[i]) !== -1) return o[keys[k]];
    }
  }
  return '';
}

/* ── who is asking ── */

/* The branch keeps its people on the tab IT named — Access — while the
   original setup had created an empty Administrators tab beside it. Reading
   the empty one would lock every real administrator out, so resolve to
   whichever admin-looking tab actually holds people. Recognised names:
   Administrators, Admins, Access (and the odd spelling). BEN_ADMINS_TAB in
   Script Properties overrides everything if the branch renames again. */
function badminsSheet_() {
  var ss = bss_();
  var override = bprop_('BEN_ADMINS_TAB');
  if (override) {
    var o = ss.getSheetByName(override);
    if (o) return o;
  }
  var ok = { administrators:1, administrator:1, admins:1, admin:1, access:1, acess:1, accesstab:1 };
  var cands = ss.getSheets().filter(function (sh) {
    return ok[String(sh.getName()).toLowerCase().replace(/[^a-z]/g, '')] === 1;
  });
  if (!cands.length) throw new Error('No Administrators or Access tab found — run benefitsSetup() once.');
  var withPeople = cands.filter(function (sh) { return sh.getLastRow() > 1; });
  return withPeople[0] || cands[0];
}

function badmin_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  if (code === bprop_('BEN_ADMIN_CODE').toUpperCase()) return { name: 'Branch admin code', code: code };
  var hit = brows_(badminsSheet_()).filter(function (r) {
    return String(bfield_(r, ['code', 'agent', 'number'])).trim().toUpperCase() === code;
  })[0];
  return hit ? { name: String(bfield_(hit, ['name'])).trim() || code, code: code } : null;
}
function bstaff_(code) {
  code = String(code || '').trim().toUpperCase();
  if (code && code === bprop_('BEN_STAFF_CODE').toUpperCase()) return { name: 'Branch staff', code: code };
  return badmin_(code);
}

/* Portal sign-in against the Administrators tab — agent number AND the
   password column the branch maintains there. POST only, so the password
   never sits in a URL. If the tab has no password column, this refuses
   rather than quietly accepting a number alone. */
function benSignin_(b) {
  var sh = badminsSheet_();
  var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
    .map(function (h) { return String(h).toLowerCase(); });
  var hasPw = head.some(function (h) { return h.indexOf('pass') !== -1 || h === 'pw'; });
  if (!hasPw) return berr_('The Administrators tab has no Password column — add one, or sign in with the branch code.');
  var code = String(b.code || '').trim().toUpperCase();
  var pw   = String(b.password || '');
  var hit = brows_(sh).filter(function (r) {
    return String(bfield_(r, ['code', 'agent', 'number'])).trim().toUpperCase() === code &&
           String(bfield_(r, ['password', 'pass', 'pw'])) === pw && pw !== '';
  })[0];
  if (!hit) return berr_('Not on the access list — check the agent number and password.');
  var name = String(bfield_(hit, ['name'])).trim() || code;
  var roleTxt = String(bfield_(hit, ['role', 'title', 'position'])).trim() || 'Administrator';
  /* The Role column decides what the sign-in opens. A row whose role says
     agent gets the agent experience — no Pendings, no Review, no approvals.
     Everything else on the Access tab — administrators, the BMA, sales
     support — gets the administrator doors. Every sign-in lands on the
     activity tab under the person's own name and role, so the branch can
     see who is on and who did what. */
  var isAgent = /agent|advisor/i.test(roleTxt) && !/manager|admin|assist|support/i.test(roleTxt);
  blog_(name, code, 'SIGNIN', '', '', roleTxt);
  return bok_({ name: name, role: isAgent ? 'agent' : 'manager', title: roleTxt });
}

function blog_(by, code, did, group, month, note) {
  bsheet_(BEN.ACTIVITY_SHEET).appendRow([new Date(), by || '', code || '', did || '', group || '', month || '', note || '']);
}

/* ============================ routing ============================

   This project also holds Code.gs, the quote-request engine, and a script
   project can only have ONE doGet and ONE doPost — two files defining them
   fight, and whichever loads last silently wins. So this file owns the two
   entry points and hands anything that is not a benefits call through to
   the quote engine, whose own entry points are renamed quoteDoPost_ /
   quoteDoGet_. One deployed URL then serves both engines: benefits traffic
   carries an `action`, everything else is a quote, enrollment or feedback
   posting exactly as before. */

function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) || '';
    if (a === 'pendings')  return benPendings_(e.parameter);
    if (a === 'monthflow') return benMonthflow_(e.parameter);
    if (a === 'billing')   return benBilling_(e.parameter);
    if (a === 'groups')    return benGroups_(e.parameter);
    if (!a) {
      if (typeof quoteDoGet_ === 'function') return quoteDoGet_();
      return ContentService.createTextOutput('Ricky Rampersad Branch engine is running.');
    }
    return berr_('Unknown action.');
  } catch (err) { return berr_(String(err && err.message || err)); }
}

function doPost(e) {
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (b.action === 'signin')       return benSignin_(b);
    if (b.action === 'pendingnote')  return benPendingNote_(b);
    if (b.action === 'submitmonth')  return benSubmitMonth_(b);
    if (b.action === 'reviewmonth')  return benReviewMonth_(b);
    if (typeof quoteDoPost_ === 'function') return quoteDoPost_(e);
    return berr_('Unknown action.');
  } catch (err) { return berr_(String(err && err.message || err)); }
}

/* ============================ pendings ============================ */

function benPendings_(p) {
  if (!badmin_(p.auth)) return berr_('Administrators only.');
  var rows = brows_(bsheet_(BEN.PENDINGS_SHEET)).map(function (r) {
    return {
      id:        String(bfield_(r, ['id'])),
      account:   String(bfield_(r, ['account'])),
      sourceName:String(bfield_(r, ['source'])) || null,
      member:    String(bfield_(r, ['member'])),
      line:      String(bfield_(r, ['line'])),
      policy:    String(bfield_(r, ['policy'])),
      issued:    bdate_(bfield_(r, ['issued'])),
      note:      String(bfield_(r, ['note']) || ''),
      noteBy:    String(bfield_(r, ['note by', 'noteby']) || ''),
      noteAt:    String(bfield_(r, ['note at', 'noteat']) || '')
    };
  });
  return bok_({ rows: rows });
}

function bdate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

function benPendingNote_(b) {
  var who = badmin_(b.auth);
  if (!who) return berr_('Administrators only.');
  var sh = bsheet_(BEN.PENDINGS_SHEET);
  var rows = brows_(sh);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).toLowerCase(); });
  var col = function (part) {
    for (var i = 0; i < head.length; i++) if (head[i].indexOf(part) !== -1) return i + 1;
    return 0;
  };
  var hit = rows.filter(function (r) { return String(bfield_(r, ['id'])) === String(b.id); })[0];
  if (!hit) return berr_('No pending row with that id.');
  var byName = (who.name === 'Branch admin code' && b.by) ? String(b.by) : who.name;
  if (col('note'))    sh.getRange(hit._row, col('note')).setValue(String(b.text || ''));
  if (col('note by')) sh.getRange(hit._row, col('note by')).setValue(byName);
  if (col('note at')) sh.getRange(hit._row, col('note at')).setValue(new Date());
  blog_(byName, who.code, 'PENDING NOTE', String(bfield_(hit, ['account'])), '', String(b.text || ''));
  return bok_();
}

/* ============================ the month flow ============================ */

function bsubs_() {
  return brows_(bsheet_(BEN.SUBS_SHEET)).map(function (r) {
    try { var o = JSON.parse(String(bfield_(r, ['json'])) || 'null'); }
    catch (e) { o = null; }
    if (o) o._row = r._row;
    return o;
  }).filter(function (x) { return !!x; });
}

function benMonthflow_(p) {
  if (!bstaff_(p.auth)) return berr_('Staff or administrators only.');
  var subs = bsubs_().map(function (s) { delete s._row; delete s._fileIds; return s; });
  if (p.group) subs = subs.filter(function (s) { return s.group && s.group.id === p.group; });
  return bok_({ subs: subs });
}

function benSubmitMonth_(b) {
  var who = bstaff_(b.auth);
  if (!who) return berr_('Staff or administrators only.');
  var sub = b.sub;
  if (!sub || !sub.id || !sub.group || !sub.monthKey) return berr_('That submission is incomplete.');

  /* file the documents in Drive so approval can attach them */
  sub._fileIds = [];
  (b.files || []).forEach(function (f) {
    if (!f || !f.b64 || !f.name) return;
    var blob = Utilities.newBlob(Utilities.base64Decode(f.b64), f.type || 'application/pdf', f.name);
    var folder = bfolder_(sub.group.name, sub.monthKey);
    sub._fileIds.push(folder.createFile(blob).getId());
  });

  var sh = bsheet_(BEN.SUBS_SHEET);
  /* a resubmission replaces what is open for that group and month */
  bsubs_().forEach(function (s) {
    if (s.group.id === sub.group.id && s.monthKey === sub.monthKey &&
        (s.state === 'SUBMITTED' || s.state === 'RETURNED')) {
      sh.deleteRow(s._row);
      if (!sub._fileIds.length && s._fileIds) sub._fileIds = s._fileIds;
    }
  });
  sh.appendRow([sub.id, sub.group.id, sub.group.name, sub.monthKey, sub.monthLabel,
                sub.state, new Date(), JSON.stringify(sub)]);
  var ev = sub.events && sub.events[sub.events.length - 1];
  blog_(ev ? ev.by : who.name, who.code, 'SUBMITTED', sub.group.name, sub.monthLabel, '');

  /* The approver hears about it the moment it lands — no chasing staff for
     links. The branch manager is copied so nothing waits unseen. */
  var notified = '';
  try {
    var approver = bprop_('BEN_APPROVER_EMAIL') || bprop_('BEN_NOTIFY');
    if (approver) {
      var ccMgr = bprop_('BEN_NOTIFY');
      var link = bprop_('BEN_SITE') + 'review.html#' + sub.id;
      var total = 0;
      Object.keys(sub.lineTotals || {}).forEach(function (k) { total += sub.lineTotals[k]; });
      MailApp.sendEmail({
        to: approver,
        cc: (ccMgr && ccMgr !== approver) ? ccMgr : undefined,
        name: BEN.FROM_NAME,
        subject: 'For review: ' + sub.group.name + ' — ' + sub.monthLabel,
        body: (ev ? ev.by : who.name) + ' submitted ' + sub.group.name + ' for ' + sub.monthLabel + '.\n\n'
          + 'This month: TT$' + total.toFixed(2)
          + (sub.arrears && sub.arrears.balance ? '\nPayable balance incl. arrears: TT$' + Number(sub.arrears.balance).toFixed(2) : '')
          + '\n\nReview and decide here (sign in as an administrator):\n' + link
          + '\n\nApproving sends it to the client; returning it sends it back to staff with your reason.'
      });
      notified = approver;
    }
  } catch (mailErr) {}
  return bok_({ id: sub.id, notified: notified });
}

function benReviewMonth_(b) {
  var who = badmin_(b.auth);
  if (!who) return berr_('Administrators only.');
  var byName = (who.name === 'Branch admin code' && b.by) ? String(b.by) : who.name;
  var sub = bsubs_().filter(function (s) { return s.id === String(b.id); })[0];
  if (!sub) return berr_('No submission with that id.');
  if (sub.state !== 'SUBMITTED') return berr_('That month is not waiting for review.');

  /* the server, not the page, is where this rule holds */
  var first = sub.events && sub.events[0] || {};
  if ((first.code && String(first.code).toUpperCase() === who.code) ||
      (first.by && first.by === byName)) {
    return berr_('You submitted this month, so another administrator has to approve it.');
  }

  var now = Date.now();
  if (b.decision === 'approve') {
    sub.state = 'SENT';
    sub.events.push({ at: now, by: byName, code: who.code, did: 'APPROVED' });
    sub.events.push({ at: now, by: byName, code: who.code, did: 'SENT' });
    var sent = bsendMonth_(sub);
    bwrite_(sub);
    blog_(byName, who.code, 'APPROVED', sub.group.name, sub.monthLabel, sent.note);
    bbillingRows_(sub);
    return bok_({ sent: sent.sent, testMode: sent.testMode, note: sent.note });
  }
  if (b.decision === 'return') {
    if (!b.note) return berr_('Returning it needs a reason.');
    sub.state = 'RETURNED';
    sub.events.push({ at: now, by: byName, code: who.code, did: 'RETURNED', note: String(b.note) });
    bwrite_(sub);
    blog_(byName, who.code, 'RETURNED', sub.group.name, sub.monthLabel, String(b.note));
    return bok_();
  }
  return berr_('Decision must be approve or return.');
}

function bwrite_(sub) {
  var sh = bsheet_(BEN.SUBS_SHEET);
  var row = sub._row; delete sub._row;
  var line = [sub.id, sub.group.id, sub.group.name, sub.monthKey, sub.monthLabel,
              sub.state, new Date(), JSON.stringify(sub)];
  if (row) sh.getRange(row, 1, 1, line.length).setValues([line]);
  else sh.appendRow(line);
}

/* Approval writes the month into the Billing tab — one row per line — so
   the client's History view has a record the branch maintains payment
   against. Paid columns stay empty until someone fills them. */
function bbillingRows_(sub) {
  var sh = bsheet_(BEN.BILLING_SHEET);
  Object.keys(sub.lineTotals || {}).forEach(function (label) {
    sh.appendRow([sub.group.id, sub.monthLabel, label, '', sub.lineTotals[label], '', '', '', '', '']);
  });
}

function bfolder_(groupName, monthKey) {
  var root = DriveApp.getFoldersByName(BEN.DRIVE_ROOT);
  root = root.hasNext() ? root.next() : DriveApp.createFolder(BEN.DRIVE_ROOT);
  var g = root.getFoldersByName(groupName);
  g = g.hasNext() ? g.next() : root.createFolder(groupName);
  var m = g.getFoldersByName(monthKey);
  return m.hasNext() ? m.next() : g.createFolder(monthKey);
}

function bsendMonth_(sub) {
  var testMode = bprop_('BEN_TEST_MODE') !== 'off';
  var groups = brows_(bsheet_(BEN.GROUPS_SHEET));
  var g = groups.filter(function (r) {
    return String(bfield_(r, ['group id', 'groupid', 'id'])).trim() === sub.group.id ||
           String(bfield_(r, ['group name', 'groupname'])).trim() === sub.group.name;
  })[0];
  var clientEmail = g ? String(bfield_(g, ['billing email', 'email'])).trim() : '';
  var to = testMode ? bprop_('BEN_NOTIFY') : clientEmail;

  if (!to) {
    return { sent: false, testMode: testMode,
             note: 'Approved, but no billing email is on the Groups tab for ' + sub.group.name + ' — nothing was emailed.' };
  }
  var atts = (sub._fileIds || []).map(function (id) {
    try { return DriveApp.getFileById(id).getBlob(); } catch (e) { return null; }
  }).filter(function (x) { return !!x; });

  var mgrCc = bprop_('BEN_NOTIFY');
  MailApp.sendEmail({
    to: to,
    cc: (!testMode && mgrCc && mgrCc !== to) ? mgrCc : undefined,
    name: BEN.FROM_NAME,
    subject: (testMode ? '[TEST — would go to ' + (clientEmail || 'no address on file') + '] ' : '') + sub.email.subject,
    body: sub.email.body,
    attachments: atts
  });
  return { sent: true, testMode: testMode,
           note: testMode ? 'Test mode — emailed ' + to + ' instead of the client.' : 'Emailed ' + to + '.' };
}

/* The book, for the upload page's group picker — real groups come from the
   Groups tab, so staff choose the actual client and never a sample. Billing
   emails stay server-side; the page only learns whether one is on file. */
function benGroups_(p) {
  if (!bstaff_(p.auth)) return berr_('Staff or administrators only.');
  var groups = brows_(bsheet_(BEN.GROUPS_SHEET)).map(function (r) {
    var lines = String(bfield_(r, ['lines'])).toLowerCase();
    return {
      id:   String(bfield_(r, ['group id', 'groupid', 'id'])).trim(),
      name: String(bfield_(r, ['group name', 'groupname', 'name'])).trim(),
      lines: ['life', 'health', 'pension'].filter(function (l) { return lines.indexOf(l) !== -1; }),
      hasEmail: !!String(bfield_(r, ['billing email', 'email'])).trim()
    };
  }).filter(function (g) { return g.id && g.name; });
  return bok_({ groups: groups });
}

/* ============================ client billing ============================ */

/* group.html asks with the group's portal code, not an admin code — a
   client may read their own months and nothing else. */
function benBilling_(p) {
  var groups = brows_(bsheet_(BEN.GROUPS_SHEET));
  var g = groups.filter(function (r) {
    return String(bfield_(r, ['portal code', 'portalcode'])).trim().toUpperCase() ===
           String(p.auth || '').trim().toUpperCase();
  })[0];
  if (!g && !badmin_(p.auth)) return berr_('That code was not recognised.');
  var gid = g ? String(bfield_(g, ['group id', 'groupid', 'id'])).trim() : String(p.group || '');
  var gname = g ? String(bfield_(g, ['group name', 'groupname', 'name'])).trim() : '';
  var rows = brows_(bsheet_(BEN.BILLING_SHEET)).filter(function (r) {
    return String(bfield_(r, ['group id', 'groupid'])).trim() === gid;
  }).map(function (r) {
    return {
      month:   String(bfield_(r, ['month'])),
      line:    String(bfield_(r, ['line'])),
      invoice: String(bfield_(r, ['invoice'])),
      billed:  Number(bfield_(r, ['billed'])) || 0,
      paid:    Number(bfield_(r, ['paid'])) || 0,
      paidOn:  bdate_(bfield_(r, ['paid on', 'paidon'])),
      method:  String(bfield_(r, ['method'])),
      receipt: String(bfield_(r, ['receipt'])),
      note:    String(bfield_(r, ['note']))
    };
  });
  return bok_({ group: gid, name: gname, rows: rows });
}
