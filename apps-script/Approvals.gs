/**
 * Approvals.gs — the Branch Manager's cash and cheque collection approvals,
 * an RR Operations app (/rroperations/approvals/, short link /approvals).
 *
 * Asked for on 15 October 2026, replacing the "Branch Managers Approval"
 * Jotform. That form had taken 2,267 requests since November 2022 and:
 *   - the "BM Cash Approval" column was blank on every row, so the sheet
 *     showed who asked but never what was decided;
 *   - the reason was a pick-list ("Card Problem", "MPOS Device Not
 *     Working" …), so nobody ever explained anything;
 *   - nobody saw the client's history at the moment of asking, so the same
 *     client came back month after month with the same reason.
 *
 * The new order, in the manager's words: "when the agent seeks approvals …
 * the client name is placed, they are to give a reason after you have given
 * the history of approvals, once you are ok with the reason then you
 * approve and the email goes to GL customer service". And for that e-mail:
 * "research all the instances where approvals was given to the agent on the
 * same client with a nice template, and if never given then a nice approval
 * template".
 *
 *   1. The agent types the client's name (and policy, if they have it). The
 *      client's whole history comes back first: every earlier request in the
 *      old Jotform sheet and in this app, who asked, why, how much.
 *   2. Only then does the agent write the reason, in their own words. A
 *      client with history needs a second answer: what is different now.
 *   3. The request waits in the manager's review queue with the history and
 *      flags beside it. Approve, decline, or send it back for more.
 *   4. Approve sends GL Customer Service one of two e-mails: the history
 *      template (every earlier request in a table) or the first-time
 *      template. The agent and the manager are copied. The decision is
 *      written on the row, so the record is finally complete.
 *
 * Flag rule, chosen 15 October 2026: three or more requests for one client
 * inside 90 days (this one counted) is flagged before the manager decides.
 *
 * ── WHERE IT LIVES ────────────────────────────────────────────────────────
 * The same RR Operations Apps Script project as DeliveryBook.gs: one
 * sign-in, one Access tab. doPost there hands every action starting "apr"
 * to aprRoute_ here. Requests are written to a tab of the Branch Managers
 * Approval spreadsheet itself, beside the Jotform's own tab, so the history
 * stays in one book.
 *
 * ── SCRIPT PROPERTIES ─────────────────────────────────────────────────────
 *   APR_MODE           "test" (default) or "live". In test every e-mail goes
 *                      to APR_TEST_INBOX with a banner naming who it was for.
 *   APR_TEST_INBOX     test e-mails. Empty: DB_TEST_INBOX, then the owner.
 *   APR_GL_CS_TO       GL Customer Service address(es), comma-separated.
 *                      Live approval is refused until this is set.
 *   APR_BM_EMAIL       the manager's Outlook address: reply-to and copy on
 *                      every approval, and where new requests are announced.
 *   APR_HISTORY_ID     the Branch Managers Approval spreadsheet.
 *   APR_HISTORY_TAB    the Jotform's tab in it. Default "Form responses".
 *   APR_APPROVER_ROLE  a pattern for the Access tab's Role column that may
 *                      decide. Default "branch manager".
 *
 * Nothing here is client data, and nothing client-identifying may be added
 * to this file: the repository is public.
 */

var APR = {
  HISTORY_ID: '1KMHY_PZraICOMjI4h26Jv98RrkrZ0CwXXWrx1U-yFn0',
  HISTORY_TAB: 'Form responses',
  REQUESTS_TAB: 'Approval Requests',
  BM_EMAIL: 'Ricky.Rampersad@myguardiangroup.com',
  BM_NAME: 'Ricky Rampersad',
  BM_TITLE: 'Branch Manager',
  SITE: 'https://rickyrampersadbranch.com/approvals/',
  FLAG_DAYS: 90,
  FLAG_COUNT: 3,        // this request included
  REPEAT_DAYS: 7,       // asked again within a week: flagged
  TYPES: ['Cash Collection', 'Cheque Collection'],
  REASONS: ['Client does not have a card', 'Card problem', 'MPOS device not working', 'Internet problems',
            'Client does not have cheques', 'No bank account', 'Client insists on cash', 'Other'],
  MIN_REASON: 25,       // characters: a sentence, not a word
};

var APR_COLUMNS = [
  'Reference', 'Requested At', 'Agent', 'Agent Email', 'Approval Type',
  'Client First Name', 'Client Last Name', 'Policy Number', 'Amount (TT$)',
  'Reason Category', 'Reason', 'What Is Different', 'History Seen',
  'Prior Requests', 'Prior In 90 Days', 'Flags',
  'Status', 'Decided By', 'Decided At', 'Decision Note', 'Agent Reply',
  'GL Email', 'GL Email At', 'Template', 'Mode',
];

var APR_STATUS = { PENDING: 'Pending', INFO: 'More info needed', APPROVED: 'Approved', DECLINED: 'Declined' };


/* ============================== routing ============================== */

/* Called from doPost in DeliveryBook.gs for every action starting "apr". */
function aprRoute_(b, who) {
  if (!opsCanUse_(who, 'approvals')) {
    return { ok: false, error: 'Approvals is not on your access. Ask the branch to add it.' };
  }
  switch (b.action) {
    case 'aprStart':   return aprStart_(who);
    case 'aprHistory': return aprHistory_(b);
    case 'aprSubmit':  return aprSubmit_(b, who);
    case 'aprMine':    return aprMine_(who);
    case 'aprReply':   return aprReply_(b, who);
    case 'aprQueue':   aprMustApprove_(who); return aprQueue_(b);
    case 'aprPreview': aprMustApprove_(who); return aprPreview_(b);
    case 'aprDecide':  aprMustApprove_(who); return aprDecide_(b, who);
  }
  return { ok: false, error: 'Unknown action' };
}

function aprProp_(k, d) { return dbProp_(k, d); }
function aprMode_() { return String(aprProp_('APR_MODE', 'test')).toLowerCase() === 'live' ? 'live' : 'test'; }
function aprIsApprover_(who) {
  var pat = aprProp_('APR_APPROVER_ROLE', 'branch manager');
  try { return new RegExp(pat, 'i').test(String(who.role || '')); } catch (e) { return /branch manager/i.test(who.role); }
}
function aprMustApprove_(who) {
  if (!aprIsApprover_(who)) throw new Error('Only the Branch Manager can review approvals.');
}

function aprStart_(who) {
  return { ok: true, approver: aprIsApprover_(who), mode: aprMode_(), types: APR.TYPES, reasons: APR.REASONS,
           minReason: APR.MIN_REASON, flagDays: APR.FLAG_DAYS, flagCount: APR.FLAG_COUNT,
           glSet: !!aprProp_('APR_GL_CS_TO') };
}


/* ============================== the books ============================== */

function aprBook_() {
  return SpreadsheetApp.openById(aprProp_('APR_HISTORY_ID', APR.HISTORY_ID));
}

function aprRequestsTab_() {
  var ss = aprBook_();
  var sh = ss.getSheetByName(APR.REQUESTS_TAB);
  if (!sh) { sh = ss.insertSheet(APR.REQUESTS_TAB); sh.appendRow(APR_COLUMNS); sh.setFrozenRows(1); }
  var hm = dbHeaderMap_(sh);
  var missing = APR_COLUMNS.filter(function (c) { return !(c in hm.map); });
  if (missing.length) sh.getRange(1, hm.head.length + 1, 1, missing.length).setValues([missing]);
  return sh;
}

function aprRows_(sh) {
  var hm = dbHeaderMap_(sh), last = sh.getLastRow();
  if (last < 2 || !hm.head.length) return [];
  return sh.getRange(2, 1, last - 1, hm.head.length).getValues().map(function (r, i) {
    var o = { _row: i + 2 };
    Object.keys(hm.map).forEach(function (k) { o[k] = r[hm.map[k]]; });
    return o;
  });
}

/* Names are matched letters-only and case-blind, so "RADICIA JULAL",
   "Radicia Julal " and "Radicia  Ju-lal" are one client. */
function aprNameKey_(v) { return String(v || '').toLowerCase().replace(/[^a-z]/g, ''); }
function aprPolicyKeys_(v) {
  return (String(v || '').toUpperCase().match(/[A-Z]{0,6}\s*\d[\d\s-]{4,}\d/g) || [])
    .map(function (p) { return p.replace(/[^A-Z0-9]/g, ''); })
    .filter(function (p) { return p.replace(/\D/g, '').length >= 6; });
}
function aprNum_(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : null;
}
function aprDate_(v) {
  if (v instanceof Date) return v;
  var d = new Date(String(v || '').replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

/* A row that is plainly a test: "test", "John Doe", a policy number of
   "Test". Kept out of every count, so a test never flags a real client. */
function aprIsTest_(first, last, policy) {
  var f = aprNameKey_(first), l = aprNameKey_(last), p = String(policy || '').toLowerCase();
  return /^test/.test(f) || /^test/.test(l) || (f === 'john' && l === 'doe') || /^test/.test(p);
}

/* Every request on record, old and new, in one shape. */
function aprAllRecords_() {
  var out = [];
  var ss = aprBook_();
  var old = ss.getSheetByName(aprProp_('APR_HISTORY_TAB', APR.HISTORY_TAB));
  if (old) {
    aprRows_(old).forEach(function (r) {
      var first = r['Client Name - First Name'], last = r['Client Name - Last Name'];
      if (!aprNameKey_(first) && !aprNameKey_(last)) return;
      var policy = String(r['Policy Number'] || '');
      if (aprIsTest_(first, last, policy)) return;
      var decided = String(r['BM Cash Approval'] || '').trim();
      out.push({
        source: 'Jotform', ref: String(r['Submission ID'] || ''), at: aprDate_(r['Submission Date']),
        agent: aprAgentLabel_(r['Agent Name'], r['Agent Email']), type: String(r['Approval Type'] || '').trim() || 'Not stated',
        first: String(first || '').trim(), last: String(last || '').trim(), policy: policy.trim().slice(0, 80),
        amount: aprNum_(r['Cash Amount']), reason: String(r['Reason For Cheque/Cash Collection'] || '').trim(),
        status: decided ? 'Approved' : 'Decision not recorded',
      });
    });
  }
  aprRows_(aprRequestsTab_()).forEach(function (r) {
    if (!r['Reference']) return;
    out.push({
      source: 'RR Operations', ref: String(r['Reference']), at: aprDate_(r['Requested At']),
      agent: String(r['Agent'] || ''), type: String(r['Approval Type'] || ''),
      first: String(r['Client First Name'] || ''), last: String(r['Client Last Name'] || ''),
      policy: String(r['Policy Number'] || ''), amount: aprNum_(r['Amount (TT$)']),
      reason: String(r['Reason Category'] || '') + (r['Reason'] ? ' — ' + r['Reason'] : ''),
      status: String(r['Status'] || APR_STATUS.PENDING), decidedBy: String(r['Decided By'] || ''),
      decidedAt: aprDate_(r['Decided At']),
    });
  });
  return out;
}

/* The old form kept the agent's first name in one column and later their
   e-mail in the same column. Show the name either way. */
function aprAgentLabel_(name, email) {
  var n = String(name || '').trim();
  if (/@/.test(n)) n = '';
  if (!n && email) n = String(email).split('@')[0].replace(/[._-]+/g, ' ');
  return n.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || 'Unknown';
}

/* Same client: same first and last name (letters only, either order), or a
   policy number in common. A same-surname, same-initial row is offered as
   "possible", never counted. */
function aprMatch_(rec, q) {
  var f = aprNameKey_(rec.first), l = aprNameKey_(rec.last);
  var qf = aprNameKey_(q.first), ql = aprNameKey_(q.last);
  var both = f + l, qboth = qf + ql;
  if (qf && ql && (both === qboth || (l + f) === qboth)) return 'exact';
  if (q.policies.length) {
    var mine = aprPolicyKeys_(rec.policy);
    if (mine.some(function (p) { return q.policies.indexOf(p) >= 0; })) return 'exact';
  }
  if (ql && l === ql && qf && f && f.charAt(0) === qf.charAt(0)) return 'possible';
  return '';
}

function aprHistoryFor_(q, excludeRef) {
  q = { first: q.first, last: q.last, policies: aprPolicyKeys_(q.policy) };
  var exact = [], possible = [];
  aprAllRecords_().forEach(function (r) {
    if (excludeRef && r.ref === excludeRef) return;
    var m = aprMatch_(r, q);
    if (m === 'exact') exact.push(r); else if (m === 'possible') possible.push(r);
  });
  var byDate = function (a, b) { return (b.at ? b.at.getTime() : 0) - (a.at ? a.at.getTime() : 0); };
  exact.sort(byDate); possible.sort(byDate);
  return { exact: exact, possible: possible.slice(0, 15) };
}

/* What the manager sees in a line before anything else. */
function aprSummary_(list, now) {
  now = now || new Date();
  var since = now.getTime() - APR.FLAG_DAYS * 86400000;
  var in90 = list.filter(function (r) { return r.at && r.at.getTime() >= since; });
  var agents = {}, reasons = {}, total = 0;
  list.forEach(function (r) {
    agents[r.agent] = (agents[r.agent] || 0) + 1;
    var why = String(r.reason || '').split(' — ')[0];
    if (why) reasons[why] = (reasons[why] || 0) + 1;
    if (r.amount) total += r.amount;
  });
  var top = function (o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; })
    .map(function (k) { return { name: k, count: o[k] }; }); };
  return {
    count: list.length, in90: in90.length, first: list.length ? list[list.length - 1].at : null,
    last: list.length ? list[0].at : null, agents: top(agents), reasons: top(reasons), total: total,
    approved: list.filter(function (r) { return r.status === 'Approved'; }).length,
  };
}

/* The flags the manager decides with. `prior` excludes the request itself. */
function aprFlags_(prior, req, now) {
  now = now || new Date();
  var flags = [];
  var s = aprSummary_(prior, now);
  if (s.in90 + 1 >= APR.FLAG_COUNT) flags.push((s.in90 + 1) + ' requests in ' + APR.FLAG_DAYS + ' days');
  var lastAt = prior.length && prior[0].at;
  if (lastAt && now.getTime() - lastAt.getTime() <= APR.REPEAT_DAYS * 86400000) flags.push('Asked again within a week');
  /* The old form's pick-list ("Card Problem") and this app's ("Card problem")
     are one reason; compared letters-only against the last 90 days. */
  var why = aprNameKey_(req.reasonCategory);
  if (why && prior.some(function (r) { return aprNameKey_(String(r.reason || '').split(' — ')[0]) === why &&
      r.at && now.getTime() - r.at.getTime() <= APR.FLAG_DAYS * 86400000; })) flags.push('Same reason given before');
  if (req.amount && prior.some(function (r) { return r.amount && Math.abs(r.amount - req.amount) < 0.01 &&
      r.at && now.getTime() - r.at.getTime() <= APR.FLAG_DAYS * 86400000; })) flags.push('Same amount already requested');
  var denied = prior.filter(function (r) { return r.status === APR_STATUS.DECLINED; }).length;
  if (denied) flags.push(denied + ' declined before');
  return flags;
}

function aprOutRec_(r) {
  return { source: r.source, ref: r.ref, at: r.at ? r.at.toISOString() : '', agent: r.agent, type: r.type,
           client: (r.first + ' ' + r.last).trim(), policy: r.policy, amount: r.amount, reason: r.reason, status: r.status };
}

function aprOutSummary_(s) {
  return { count: s.count, in90: s.in90, approved: s.approved, total: s.total,
           first: s.first ? s.first.toISOString() : '', last: s.last ? s.last.toISOString() : '',
           agents: s.agents.slice(0, 6), reasons: s.reasons.slice(0, 6) };
}


/* ============================== agent: history first ============================== */

function aprHistory_(b) {
  var first = dbClean_(b.first, 60), last = dbClean_(b.last, 80), policy = dbClean_(b.policy, 120);
  if (aprNameKey_(first).length < 2 || aprNameKey_(last).length < 2) {
    throw new Error("Enter the client's first and last name.");
  }
  var h = aprHistoryFor_({ first: first, last: last, policy: policy });
  var flags = aprFlags_(h.exact, { reasonCategory: '', amount: null });
  return { ok: true, client: aprCase_(first) + ' ' + aprCase_(last), summary: aprOutSummary_(aprSummary_(h.exact)),
           history: h.exact.map(aprOutRec_), possible: h.possible.map(aprOutRec_),
           flags: flags.filter(function (f) { return !/^Same reason/.test(f); }) };
}

/* "anika pretend" and "ANIKA PRETEND" are written "Anika Pretend": the name
   goes into an e-mail to Customer Service. Mixed case is left as typed. */
function aprCase_(v) {
  v = String(v || '').trim().replace(/\s+/g, ' ');
  if (v !== v.toLowerCase() && v !== v.toUpperCase()) return v;
  return v.toLowerCase().replace(/(^|[\s'-])([a-z])/g, function (m, a, c) { return a + c.toUpperCase(); });
}

function aprSubmit_(b, who) {
  var first = aprCase_(dbClean_(b.first, 60)), last = aprCase_(dbClean_(b.last, 80));
  var type = APR.TYPES.indexOf(b.type) >= 0 ? b.type : '';
  var policy = dbClean_(b.policy, 120), amount = aprNum_(b.amount);
  var cat = APR.REASONS.indexOf(b.reasonCategory) >= 0 ? b.reasonCategory : '';
  var reason = dbClean_(b.reason, 1500), different = dbClean_(b.different, 1500);

  var problems = [];
  if (aprNameKey_(first).length < 2 || aprNameKey_(last).length < 2) problems.push("the client's first and last name");
  if (!type) problems.push('cash or cheque');
  if (!policy) problems.push('the policy number');
  if (type === 'Cash Collection' && !(amount > 0)) problems.push('the cash amount');
  if (!cat) problems.push('the reason');
  if (reason.length < APR.MIN_REASON) problems.push('the reason in your own words (a full sentence)');

  /* History is looked up again here, not trusted from the page: the
     manager decides on what the books say, not on what the phone showed. */
  var h = aprHistoryFor_({ first: first, last: last, policy: policy });
  if (h.exact.length) {
    if (!b.historySeen) problems.push("a tick to say you have read this client's history");
    if (different.length < APR.MIN_REASON) problems.push('what is different this time');
  }
  if (problems.length) throw new Error('Still needed: ' + problems.join(', ') + '.');

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = aprRequestsTab_();
    var now = new Date();
    var ref = 'APR-' + Utilities.formatDate(now, dbTz_(), 'yyMMdd') + '-' + String(sh.getLastRow()).slice(-4).padStart(4, '0');
    var req = { reasonCategory: cat, amount: amount };
    var flags = aprFlags_(h.exact, req, now);
    var s = aprSummary_(h.exact, now);
    sh.appendRow(dbRowFor_(sh, {
      'Reference': ref, 'Requested At': now, 'Agent': who.name, 'Agent Email': aprAgentEmail_(who.name),
      'Approval Type': type, 'Client First Name': first, 'Client Last Name': last, 'Policy Number': policy,
      'Amount (TT$)': amount || '', 'Reason Category': cat, 'Reason': reason, 'What Is Different': different,
      'History Seen': h.exact.length ? 'Yes — ' + h.exact.length + ' on record' : 'None on record',
      'Prior Requests': s.count, 'Prior In 90 Days': s.in90, 'Flags': flags.join('; '),
      'Status': APR_STATUS.PENDING, 'Mode': aprMode_(),
    }));
  } finally { lock.releaseLock(); }

  aprNotifyManager_(ref, who.name, first + ' ' + last, type, amount, flags);
  return { ok: true, ref: ref, flags: flags, prior: h.exact.length };
}

function aprAgentEmail_(name) {
  try {
    var sh = dbSheet_(DB.TABS.ACCESS, DB_ACCESS_COLUMNS), hm = dbHeaderMap_(sh), last = sh.getLastRow();
    if (last < 2 || !('Email' in hm.map)) return '';
    var rows = sh.getRange(2, 1, last - 1, hm.head.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][hm.map['Name']]).trim().toLowerCase() === String(name).trim().toLowerCase()) {
        return String(rows[i][hm.map['Email']] || '').trim();
      }
    }
  } catch (e) {}
  return '';
}

function aprMine_(who) {
  var me = String(who.name).trim().toLowerCase();
  var rows = aprRows_(aprRequestsTab_()).filter(function (r) {
    return r['Reference'] && String(r['Agent']).trim().toLowerCase() === me;
  }).reverse().slice(0, 60);
  return { ok: true, requests: rows.map(aprOutRow_) };
}

function aprOutRow_(r) {
  var at = aprDate_(r['Requested At']), dec = aprDate_(r['Decided At']);
  return { ref: String(r['Reference']), at: at ? at.toISOString() : '', agent: String(r['Agent'] || ''),
           type: String(r['Approval Type'] || ''), first: String(r['Client First Name'] || ''),
           last: String(r['Client Last Name'] || ''), policy: String(r['Policy Number'] || ''),
           amount: aprNum_(r['Amount (TT$)']), category: String(r['Reason Category'] || ''),
           reason: String(r['Reason'] || ''), different: String(r['What Is Different'] || ''),
           flags: String(r['Flags'] || '').split('; ').filter(String), status: String(r['Status'] || APR_STATUS.PENDING),
           decidedBy: String(r['Decided By'] || ''), decidedAt: dec ? dec.toISOString() : '',
           note: String(r['Decision Note'] || ''), reply: String(r['Agent Reply'] || ''),
           glEmail: String(r['GL Email'] || ''), template: String(r['Template'] || '') };
}

/* "More info needed" goes back to the agent; their answer returns it to
   the queue. */
function aprReply_(b, who) {
  var text = dbClean_(b.reply, 1500);
  if (text.length < 10) throw new Error('Write your answer for the Branch Manager.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var r;
  try {
    var sh = aprRequestsTab_();
    r = aprFind_(sh, b.ref);
    if (String(r['Agent']).trim().toLowerCase() !== String(who.name).trim().toLowerCase()) throw new Error('That request is not yours.');
    if (r['Status'] !== APR_STATUS.INFO) throw new Error('That request is not waiting on you.');
    var stamp = Utilities.formatDate(new Date(), dbTz_(), 'yyyy-MM-dd HH:mm');
    aprSet_(sh, r._row, { 'Agent Reply': (r['Agent Reply'] ? r['Agent Reply'] + '\n' : '') + stamp + ': ' + text,
                          'Status': APR_STATUS.PENDING });
  } finally { lock.releaseLock(); }
  aprNotifyManager_(b.ref, who.name, r['Client First Name'] + ' ' + r['Client Last Name'], r['Approval Type'],
                    aprNum_(r['Amount (TT$)']), ['Agent answered your question']);
  return { ok: true };
}

function aprFind_(sh, ref) {
  ref = String(ref || '').trim();
  var hit = aprRows_(sh).filter(function (r) { return String(r['Reference']) === ref; })[0];
  if (!hit) throw new Error('Request ' + ref + ' was not found.');
  return hit;
}

function aprSet_(sh, row, obj) {
  var hm = dbHeaderMap_(sh);
  Object.keys(obj).forEach(function (k) { if (k in hm.map) sh.getRange(row, hm.map[k] + 1).setValue(obj[k]); });
}


/* ============================== manager: review ============================== */

function aprQueue_(b) {
  var rows = aprRows_(aprRequestsTab_()).filter(function (r) { return r['Reference']; });
  var open = rows.filter(function (r) { return r['Status'] === APR_STATUS.PENDING || r['Status'] === APR_STATUS.INFO; });
  var since = Date.now() - 30 * 86400000;
  var done = rows.filter(function (r) {
    var d = aprDate_(r['Decided At']);
    return (r['Status'] === APR_STATUS.APPROVED || r['Status'] === APR_STATUS.DECLINED) && d && d.getTime() >= since;
  }).reverse().slice(0, 40);
  var all = aprAllRecords_();
  var withHistory = function (r) {
    var out = aprOutRow_(r);
    var q = { first: out.first, last: out.last, policies: aprPolicyKeys_(out.policy) };
    var prior = all.filter(function (x) { return x.ref !== out.ref && aprMatch_(x, q) === 'exact'; })
      .sort(function (a, c) { return (c.at ? c.at.getTime() : 0) - (a.at ? a.at.getTime() : 0); });
    out.summary = aprOutSummary_(aprSummary_(prior));
    out.history = prior.map(aprOutRec_);
    return out;
  };
  return { ok: true, mode: aprMode_(), glSet: !!aprProp_('APR_GL_CS_TO'),
           open: open.map(withHistory), done: done.map(aprOutRow_) };
}

/* Exactly what GL Customer Service will receive, before it is sent. */
function aprPreview_(b) {
  var sh = aprRequestsTab_();
  var r = aprFind_(sh, b.ref);
  var mail = aprGlMail_(r, { name: APR.BM_NAME }, dbClean_(b.note, 800));
  return { ok: true, subject: mail.subject, html: mail.html, template: mail.template,
           to: aprProp_('APR_GL_CS_TO') || '(GL Customer Service address not set yet)' };
}

function aprDecide_(b, who) {
  var decision = String(b.decision || '');
  var note = dbClean_(b.note, 800);
  if (['approve', 'decline', 'info'].indexOf(decision) < 0) throw new Error('Approve, decline or ask for more.');
  if (decision !== 'approve' && note.length < 5) {
    throw new Error(decision === 'info' ? 'Say what you need from the agent.' : 'Give the agent the reason for declining.');
  }
  if (decision === 'approve' && aprMode_() === 'live' && !aprProp_('APR_GL_CS_TO')) {
    throw new Error('GL Customer Service address is not set (APR_GL_CS_TO). Nothing was sent.');
  }

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var sh, r;
  try {
    sh = aprRequestsTab_();
    r = aprFind_(sh, b.ref);
    if (r['Status'] === APR_STATUS.APPROVED || r['Status'] === APR_STATUS.DECLINED) {
      throw new Error('Already ' + String(r['Status']).toLowerCase() + ' by ' + r['Decided By'] + '.');
    }
    var status = decision === 'approve' ? APR_STATUS.APPROVED : decision === 'decline' ? APR_STATUS.DECLINED : APR_STATUS.INFO;
    /* The decision is written before any mail goes, so a mail failure never
       loses the decision; it shows on the row instead. */
    aprSet_(sh, r._row, { 'Status': status, 'Decided By': who.name, 'Decided At': new Date(), 'Decision Note': note });
  } finally { lock.releaseLock(); }

  var out = { ok: true, status: decision };
  if (decision === 'approve') {
    var mail = aprGlMail_(r, who, note);
    var sent = aprSend_(aprProp_('APR_GL_CS_TO'), mail.subject, mail.html,
                        [r['Agent Email'], aprProp_('APR_BM_EMAIL', APR.BM_EMAIL)]);
    aprSet_(sh, r._row, { 'GL Email': sent.status, 'GL Email At': sent.sentAt || '', 'Template': mail.template });
    out.email = sent.status; out.template = mail.template;
  } else {
    var m = aprAgentMail_(r, decision, note, who);
    out.email = aprSend_(r['Agent Email'], m.subject, m.html, []).status;
  }
  return out;
}


/* ============================== the e-mails ============================== */

function aprEsc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function aprMoney_(n) {
  if (n == null || n === '') return '—';
  return 'TT$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function aprDay_(d) { return d ? Utilities.formatDate(d, dbTz_(), 'd MMM yyyy') : '—'; }

/* The one approval e-mail, in two forms. With history: every earlier request
   on this client in a table, newest first, and a line that sums it up. With
   none: a short first-time approval. Both read as a record of a decision, not
   as instructions to Customer Service. */
function aprGlMail_(r, who, note) {
  var client = (String(r['Client First Name']) + ' ' + String(r['Client Last Name'])).trim();
  var prior = aprHistoryFor_({ first: r['Client First Name'], last: r['Client Last Name'], policy: r['Policy Number'] },
                             String(r['Reference'])).exact;
  var s = aprSummary_(prior);
  var type = String(r['Approval Type'] || 'Cash Collection');
  var what = type === 'Cheque Collection' ? 'cheque collection' : 'cash collection';
  var template = prior.length ? 'History' : 'First-time';
  var subject = 'Approved: ' + type + ' — ' + client + ' — ' + r['Policy Number'] + ' (' + r['Reference'] + ')';

  var facts = [
    ['Client', client], ['Policy number', r['Policy Number']], ['Approval', type],
    ['Amount', type === 'Cash Collection' ? aprMoney_(aprNum_(r['Amount (TT$)'])) : (r['Amount (TT$)'] ? aprMoney_(aprNum_(r['Amount (TT$)'])) : 'As per cheque')],
    ['Agent', r['Agent'] + (r['Agent Email'] ? ' · ' + r['Agent Email'] : '')],
    ['Reason', r['Reason Category'] + ' — ' + r['Reason']],
  ];
  if (r['What Is Different']) facts.push(['Circumstances this time', r['What Is Different']]);
  if (note) facts.push(["Branch Manager's note", note]);
  facts.push(['Reference', r['Reference']], ['Approved', aprDay_(new Date()) + ' by ' + (who.name || APR.BM_NAME)]);

  var factRows = facts.map(function (f) {
    return '<tr><td style="padding:8px 12px;color:#5b6b7d;font-size:13px;width:38%;vertical-align:top;border-bottom:1px solid #eef1f5">' +
      aprEsc_(f[0]) + '</td><td style="padding:8px 12px;font-size:14px;color:#13202e;border-bottom:1px solid #eef1f5">' +
      aprEsc_(f[1]) + '</td></tr>';
  }).join('');

  var lead, history = '';
  if (prior.length) {
    lead = 'This confirms my approval of the ' + what + ' for <b>' + aprEsc_(client) + '</b>, requested by ' +
      aprEsc_(r['Agent']) + '. Before approving, I reviewed the client\'s full approval history with the branch: ' +
      '<b>' + s.count + ' earlier request' + (s.count === 1 ? '' : 's') + '</b> since ' + aprDay_(s.first) +
      (s.in90 ? ', ' + s.in90 + ' of them in the last ' + APR.FLAG_DAYS + ' days' : '') + '. It is set out below for your file.';
    var hrows = prior.slice(0, 40).map(function (p, i) {
      var bg = i % 2 ? '#ffffff' : '#f7f9fc';
      return '<tr style="background:' + bg + '">' + [aprDay_(p.at), p.agent, p.type.replace(' Collection', ''),
        String(p.reason || '').split(' — ')[0] || '—', p.amount ? aprMoney_(p.amount) : '—', p.policy || '—', p.status]
        .map(function (c) { return '<td style="padding:7px 9px;font-size:12px;color:#13202e;border-bottom:1px solid #eef1f5">' + aprEsc_(c) + '</td>'; }).join('') + '</tr>';
    }).join('');
    history =
      '<h3 style="font-family:Arial,sans-serif;font-size:14px;color:#07131f;margin:26px 0 8px">Approval history — ' + aprEsc_(client) + '</h3>' +
      '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e3e8ef;border-radius:8px;font-family:Arial,sans-serif">' +
      '<tr style="background:#07131f">' + ['Date', 'Agent', 'Type', 'Reason given', 'Amount', 'Policy', 'Status']
        .map(function (h) { return '<th align="left" style="padding:8px 9px;font-size:11px;color:#efc24b;letter-spacing:.4px">' + h + '</th>'; }).join('') +
      '</tr>' + hrows + '</table>' +
      (prior.length > 40 ? '<p style="font-size:12px;color:#5b6b7d">Showing the latest 40 of ' + prior.length + '.</p>' : '') +
      '<p style="font-size:12px;color:#5b6b7d;margin-top:8px">Requests made on the earlier form before October 2026 did not record the decision; they show as "Decision not recorded".</p>';
  } else {
    lead = 'This confirms my approval of the ' + what + ' for <b>' + aprEsc_(client) + '</b>, requested by ' +
      aprEsc_(r['Agent']) + '. I checked the branch\'s records before approving: this is the <b>first ' + what +
      ' request on record</b> for this client.';
  }

  var html =
    '<div style="background:#eef1f5;padding:24px 12px;font-family:Arial,sans-serif">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">' +
    '<tr><td style="background:#07131f;padding:18px 24px"><table role="presentation"><tr>' +
    '<td><img src="' + DB.LOGO + '" width="40" height="40" alt="" style="display:block;border-radius:8px"></td>' +
    '<td style="padding-left:12px"><div style="color:#efc24b;font-weight:bold;font-size:16px">' + aprEsc_(DB.BRAND) + '</div>' +
    '<div style="color:#a9bbcf;font-size:12px">' + (prior.length ? 'Collection approval · with client history' : 'Collection approval · first request') + '</div></td>' +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:24px">' +
    '<p style="font-size:14px;color:#13202e;margin:0 0 12px">Dear Customer Service Team,</p>' +
    '<p style="font-size:14px;color:#13202e;line-height:1.55;margin:0 0 18px">' + lead + '</p>' +
    '<div style="display:inline-block;background:' + (prior.length ? '#fff4d6;color:#7a5600' : '#e7f8ee;color:#16683a') +
    ';font-size:12px;font-weight:bold;padding:5px 10px;border-radius:99px;margin-bottom:14px">' +
    (prior.length ? s.count + ' earlier request' + (s.count === 1 ? '' : 's') + ' on record' : 'First request on record') + '</div>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e3e8ef;border-radius:8px">' + factRows + '</table>' +
    history +
    '<p style="font-size:14px;color:#13202e;margin:22px 0 0">Regards,</p>' +
    '<p style="font-size:14px;color:#13202e;margin:4px 0 0"><b>' + aprEsc_(APR.BM_NAME) + '</b><br>' + aprEsc_(APR.BM_TITLE) +
    ' · ' + aprEsc_(DB.BRAND) + '<br><span style="color:#5b6b7d">' + aprEsc_(aprProp_('APR_BM_EMAIL', APR.BM_EMAIL)) + ' · 678-5921</span></p>' +
    '</td></tr></table></div>';
  return { subject: subject, html: html, template: template };
}

function aprAgentMail_(r, decision, note, who) {
  var client = (r['Client First Name'] + ' ' + r['Client Last Name']).trim();
  var head = decision === 'decline' ? 'Not approved' : 'More information needed';
  var body = decision === 'decline'
    ? 'Your request for ' + aprEsc_(client) + ' (' + aprEsc_(r['Reference']) + ') was not approved.'
    : 'Your request for ' + aprEsc_(client) + ' (' + aprEsc_(r['Reference']) + ') is on hold until you answer the question below. ' +
      'Answer it in Approvals → My requests.';
  return {
    subject: head + ': ' + r['Approval Type'] + ' — ' + client + ' (' + r['Reference'] + ')',
    html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#13202e">' +
      '<h2 style="color:#07131f;font-size:18px">' + head + '</h2><p style="font-size:14px">' + body + '</p>' +
      '<div style="background:#f4f6fa;border-left:4px solid #efc24b;padding:12px 14px;font-size:14px">' + aprEsc_(note) + '</div>' +
      '<p style="font-size:14px;margin-top:18px"><a href="' + APR.SITE + '" style="color:#0a6ed1">Open Approvals</a></p>' +
      '<p style="font-size:13px;color:#5b6b7d">' + aprEsc_(who.name) + ' · ' + aprEsc_(DB.BRAND) + '</p></div>',
  };
}

function aprNotifyManager_(ref, agent, client, type, amount, flags) {
  var html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#13202e">' +
    '<h2 style="color:#07131f;font-size:18px">Approval request ' + aprEsc_(ref) + '</h2>' +
    '<p style="font-size:14px"><b>' + aprEsc_(agent) + '</b> asks for ' + aprEsc_(type) + ' for <b>' + aprEsc_(client) + '</b>' +
    (amount ? ' — ' + aprMoney_(amount) : '') + '.</p>' +
    (flags.length ? '<p style="font-size:14px;color:#9a3b00"><b>' + flags.map(aprEsc_).join(' · ') + '</b></p>' : '') +
    '<p><a href="' + APR.SITE + '?review=' + encodeURIComponent(ref) + '" style="display:inline-block;background:#efc24b;color:#1d1503;' +
    'padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Review with history</a></p></div>';
  aprSend_(aprProp_('APR_BM_EMAIL', APR.BM_EMAIL), 'Approval request: ' + client + ' — ' + type + ' (' + ref + ')', html, []);
}

/* Sent under the manager's name with his Outlook address as reply-to and in
   copy, so every approval sits in his Outlook. In test mode every message
   goes only to the test inbox, with a banner naming who it was for. */
function aprSend_(to, subject, html, cc) {
  to = String(to || '').trim();
  cc = (cc || []).map(function (x) { return String(x || '').trim(); })
    .filter(function (x, i, a) { return x && /@/.test(x) && a.indexOf(x) === i && x.toLowerCase() !== to.toLowerCase(); });
  var test = aprMode_() !== 'live';
  if (test) {
    var inbox = aprProp_('APR_TEST_INBOX') || dbProp_('DB_TEST_INBOX') || Session.getEffectiveUser().getEmail();
    html = '<div style="background:#fff4d6;border:1px solid #efc24b;padding:10px 14px;font-family:Arial;font-size:13px">' +
      'TEST — in live mode this goes to <b>' + aprEsc_(to || '(not set)') + '</b>' +
      (cc.length ? ', copied to ' + aprEsc_(cc.join(', ')) : '') + '.</div>' + html;
    to = inbox; cc = []; subject = '[TEST] ' + subject;
  }
  if (!to) return { status: 'Not sent: no address' };
  try {
    if (MailApp.getRemainingDailyQuota && MailApp.getRemainingDailyQuota() < 1) return { status: 'Held: daily mail limit reached' };
    var opts = { to: to, subject: subject, htmlBody: html, name: APR.BM_NAME + ' — ' + APR.BM_TITLE,
                 replyTo: aprProp_('APR_BM_EMAIL', APR.BM_EMAIL) };
    if (cc.length) opts.cc = cc.join(',');
    MailApp.sendEmail(opts);
    return { status: test ? 'Test copy sent' : 'Sent', sentAt: new Date() };
  } catch (e) {
    return { status: 'Failed: ' + e.message };
  }
}

/* RR Operations → Check approvals setup. */
function aprSetupCheck() {
  var notes = [];
  try { var ss = aprBook_(); notes.push('Approval book: ' + ss.getName()); }
  catch (e) { notes.push('Approval book: NOT OPEN — ' + e.message); }
  try { notes.push('Requests on record (old and new, tests left out): ' + aprAllRecords_().length); }
  catch (e) { notes.push('Reading history failed: ' + e.message); }
  notes.push('Mode: ' + aprMode_());
  notes.push('GL Customer Service: ' + (aprProp_('APR_GL_CS_TO') || 'NOT SET (APR_GL_CS_TO)'));
  notes.push('Manager copy and reply-to: ' + aprProp_('APR_BM_EMAIL', APR.BM_EMAIL));
  notes.push('Approvers: Access-tab Role matching /' + aprProp_('APR_APPROVER_ROLE', 'branch manager') + '/');
  Logger.log(notes.join('\n'));
  try { SpreadsheetApp.getUi().alert('Approvals setup', notes.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return notes;
}
