/* ─────────────────── HELP 868: what the WhatsApp assistant may ask of the tracker ───────────────────
 *  Built 2 November 2026, in the Branch Intelligence (tracker) project beside KPI.gs. Asked for by Ricky: the assistant on
 *  the branch's WhatsApp line deals with pendings and queries from what the branch already holds.
 *
 *  respond.io's AI never reads a sheet, the repository or Salesforce. It makes two HTTP calls to this file, and this file
 *  decides what comes back:
 *
 *    help868.pendings  an agent asks where their pending applications stand. Answers only for an agent whose WhatsApp number
 *                      is on the "HELP868 Agents" tab (the tab IS the pilot list), and only about that agent's own cases,
 *                      read from the "Pendings Chase" tab. Counts, days and who has it. Never a client's name, a note's words,
 *                      money, a date of birth or a full policy number (last four digits only).
 *    help868.enquiry   anyone: files an enquiry on the "HELP868 Enquiries" tab with a reference, and tells the owner by e-mail.
 *                      The reference comes from this file, so the assistant can only quote one that exists.
 *
 *  Setup (Script properties): HELP868_KEY, a long random string the respond.io calls send as `key`; HELP868_OWNER, who is
 *  e-mailed about an enquiry (blank = the Branch Manager). Nothing answers until HELP868_KEY is set.
 *  Identity: the WhatsApp number is verified by Meta; it is matched to the tab, and an agent number, if given, must agree.
 *  Not a password and never asked for one. No match = a person takes over; the reply never says which half was wrong. */
var H868 = {
  ALLOW: 'HELP868 Agents', LOG: 'HELP868 Enquiries', CHASE: 'Pendings Chase',
  ALLOW_HEAD: ['Agent no.', 'Name', 'WhatsApp number', 'Active', 'Pendings'],
  LOG_HEAD: ['Reference', 'When', 'Category', 'Who', 'Role', 'Agent no.', 'Summary', 'Owner', 'Status', 'Number ending'],
  CATS: { pending: 'Pending application', payment: 'Premium or payment', general: 'General follow-up', other: 'Other' },
  PER_HOUR: 20, MAX_ROWS: 12, DUPE_MIN: 12, SUMMARY: 400
};

function help868Route_(p) {
  var action = String(p.action || '');
  if (action === 'help868.ping') return { ok: true, on: help868On_(), agents: help868Allow_().length };
  if (!help868On_()) return { ok: false, error: 'HELP 868 is not switched on.' };
  if (!help868KeyOk_(p.key)) return { ok: false, error: 'Not allowed.' };
  var digits = help868Digits_(p.phone);
  if (!digits) return { ok: false, error: 'No WhatsApp number was sent.' };
  if (!help868Rate_(digits)) return { ok: false, error: 'Too many requests from this number. A person will follow up.', limited: true };
  if (action === 'help868.pendings') return help868Pendings_(p, digits);
  if (action === 'help868.enquiry') return help868Enquiry_(p, digits);
  return { ok: false, error: 'Unknown HELP 868 action.' };
}

function help868Prop_(k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim(); } catch (e) { return ''; } }
function help868On_() { return help868Prop_('HELP868_KEY').length >= 16; }
function help868KeyOk_(key) {
  var want = help868Prop_('HELP868_KEY'), got = String(key || '');
  if (!want || want.length !== got.length) return false;
  var diff = 0; for (var i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
/** The last ten digits, which is how a Trinidad number (868 + seven) is compared whatever the formatting. */
function help868Digits_(s) { var d = String(s == null ? '' : s).replace(/\D/g, ''); return d.length >= 7 ? d.slice(-10) : ''; }
function help868AgentNo_(s) { var t = String(s || '').trim().replace(/^[A-Za-z]{1,3}/, '').replace(/\D/g, ''); return t.replace(/^0+/, ''); }
/** At most PER_HOUR calls an hour from one number: a runaway loop in a workflow cannot fill the tab or the inbox. */
function help868Rate_(digits) {
  try {
    var c = CacheService.getScriptCache(), k = 'h868_' + digits, n = Number(c.get(k) || 0) + 1;
    if (n > H868.PER_HOUR) return false;
    c.put(k, String(n), 3600); return true;
  } catch (e) { return true; }
}
function help868Ss_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss && typeof iSs_ === 'function') { try { ss = iSs_(); } catch (e) {} }
  return ss;
}
function help868Tab_(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]); }
  return sh;
}
function help868Allow_() {
  var ss = help868Ss_(), sh = ss && ss.getSheetByName(H868.ALLOW); if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), h = v[0].map(function (x) { return String(x).trim(); }), ix = function (n) { return h.indexOf(n); };
  var cn = ix('Agent no.'), cm = ix('Name'), cp = ix('WhatsApp number'), ca = ix('Active'), cd = ix('Pendings'), out = [];
  v.slice(1).forEach(function (r) {
    var digits = help868Digits_(r[cp]); if (!digits) return;
    if (ca > -1 && /^(no|inactive|false|0)$/i.test(String(r[ca]).trim())) return;
    out.push({ digits: digits, no: help868AgentNo_(r[cn]), name: String(r[cm] || '').trim(), pendings: !(cd > -1 && /^(no|false|0)$/i.test(String(r[cd]).trim())) });
  });
  return out;
}
/** The agent this number belongs to, or null. A supplied agent number must agree with the tab's. */
function help868Agent_(digits, agentNo) {
  var hit = help868Allow_().filter(function (a) { return a.digits === digits; })[0] || null;
  if (!hit) return null;
  var given = help868AgentNo_(agentNo);
  if (given && hit.no && given !== hit.no) return null;
  return hit;
}
function help868NameKey_(s) { return (typeof bkNk_ === 'function' ? bkNk_(s) : String(s || '').toLowerCase().replace(/[^a-z ]/g, '')).split(' ').filter(String); }
/** Same person however the report writes the name: equal, or every word of the shorter inside the longer (two words at least). */
function help868SameName_(a, b) {
  var x = help868NameKey_(a), y = help868NameKey_(b); if (!x.length || !y.length) return false;
  var s = x.length <= y.length ? x : y, l = x.length <= y.length ? y : x;
  if (s.length < 2) return s.join(' ') === l.join(' ');
  return s.every(function (w) { return l.indexOf(w) > -1; });
}
function help868First_(s) { return String(s || '').trim().split(/\s+/)[0] || ''; }

function help868Pendings_(p, digits) {
  var a = help868Agent_(digits, p.agentNo);
  if (!a || !a.pendings) return { ok: true, verified: false, message: 'This number is not set up for pending-application updates. A team member will need to help.' };
  var ss = (typeof iSs_ === 'function' ? (function () { try { return iSs_(); } catch (e) { return null; } })() : null) || help868Ss_();
  var sh = ss && ss.getSheetByName(H868.CHASE);
  if (!sh || sh.getLastRow() < 2) return { ok: true, verified: true, name: help868First_(a.name), ready: false, message: 'The pending list is not ready right now. A team member can check.' };
  var v = sh.getDataRange().getValues(), h = v[0].map(function (x) { return String(x).trim(); }), ix = function (n) { return h.indexOf(n); };
  var cp = ix('Policy'), cg = ix('Agent'), co = ix('Owner'), cdue = ix('Due'), cop = ix('Open tasks'), cov = ix('Overdue'), cla = ix('Last note at'), clb = ix('Last note by'), cu = ix('Updated');
  var mine = v.slice(1).filter(function (r) { return help868SameName_(r[cg], a.name); });
  var rows = mine.map(function (r) {
    var pol = String(r[cp] || '');
    return { policy: '••••' + pol.slice(-4), openTasks: Number(r[cop] || 0) || 0, overdue: Number(r[cov] || 0) || 0, due: String(r[cdue] || ''),
      withTeam: help868First_(r[co]), lastNote: String(r[cla] || ''), lastNoteBy: help868First_(r[clb]) };
  }).sort(function (x, y) { return (y.overdue - x.overdue) || ((x.openTasks ? 0 : 1) - (y.openTasks ? 0 : 1)) || String(x.due || '9').localeCompare(String(y.due || '9')); });
  return { ok: true, verified: true, ready: true, name: help868First_(a.name), updated: cu > -1 && v[1] ? String(v[1][cu] || '') : '',
    total: rows.length, overdue: rows.filter(function (x) { return x.overdue > 0; }).length, noOpenTask: rows.filter(function (x) { return !x.openTasks; }).length,
    shown: Math.min(rows.length, H868.MAX_ROWS), cases: rows.slice(0, H868.MAX_ROWS),
    note: 'Counts, days and who has each case only. Reasons and requirement details need a team member.' };
}

/** Anything that looks like a number, e-mail or link is taken out before it reaches a sheet or an inbox. */
function help868Clean_(s) {
  var t = String(s == null ? '' : s).replace(/https?:\/\/\S+/gi, '[link removed]').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail removed]')
    .replace(/\d[\d\s().-]{5,}\d/g, '[number removed]').replace(/\s+/g, ' ').trim().slice(0, H868.SUMMARY);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}
function help868Enquiry_(p, digits) {
  var summary = help868Clean_(p.summary);
  if (!summary) return { ok: false, error: 'Say in a few words what the enquiry is about.' };
  var cat = H868.CATS[String(p.category || '').toLowerCase()] ? String(p.category).toLowerCase() : 'other';
  var a = help868Agent_(digits, p.agentNo);
  var who = a ? a.name : help868Clean_(p.name).slice(0, 80), role = a ? 'Agent' : 'Not verified';
  var ss = help868Ss_(); if (!ss) return { ok: false, error: 'The enquiry log is not reachable. A person will follow up.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { ok: false, error: 'Busy. Please try again.' }; }
  try {
    var sh = help868Tab_(ss, H868.LOG, H868.LOG_HEAD), now = new Date();
    var day = Utilities.formatDate(now, CONFIG.TZ, 'yyMMdd'), end = '·' + digits.slice(-4);
    var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, H868.LOG_HEAD.length).getValues() : [], n = 0;
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i], ref = String(r[0] || '');
      if (ref.indexOf('H8-' + day + '-') === 0) n++;
      var at = new Date(String(r[1]).replace(' ', 'T'));
      if (String(r[9]) === end && String(r[6]) === summary && !isNaN(at) && now - at < H868.DUPE_MIN * 60000) return { ok: true, ref: ref, filed: true, repeat: true, message: 'Already filed as ' + ref + '.' };
    }
    var reference = 'H8-' + day + '-' + ('00' + (n + 1)).slice(-3), owner = help868Prop_('HELP868_OWNER') || (managerEmails_() || [])[0] || '';
    sh.appendRow([reference, Utilities.formatDate(now, CONFIG.TZ, 'yyyy-MM-dd HH:mm'), H868.CATS[cat], who, role, a ? a.no : '', summary, owner, 'New', end]);
    var mailed = false;
    if (owner) {
      try {
        mailSend_({ to: owner, subject: 'HELP 868 enquiry ' + reference + ' · ' + H868.CATS[cat],
          htmlBody: '<div style="font:14px/1.5 Arial,sans-serif"><p><b>' + esc_(reference) + '</b> · ' + esc_(H868.CATS[cat]) + '</p><p>From ' + esc_(who || 'an unnamed WhatsApp contact') + ' (' + esc_(role) +
            '), number ending ' + esc_(digits.slice(-4)) + ':</p><p style="border-left:3px solid #ccc;padding-left:10px">' + esc_(summary) + '</p>' +
            '<p>Reply to them on WhatsApp in respond.io. Numbers, e-mails and links were removed from the summary.</p><p style="color:#777;font-size:12px">Internal. Do not forward outside the branch.</p></div>' });
        mailed = true;
      } catch (e) { try { runlog_('HELP 868: the owner e-mail did not send for ' + reference + ': ' + (e && e.message)); } catch (e2) {} }
    }
    return { ok: true, filed: true, ref: reference, category: H868.CATS[cat], verifiedAgent: !!a, ownerNotified: mailed,
      message: 'Filed as ' + reference + '. A team member will review it. No time has been promised.' };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
