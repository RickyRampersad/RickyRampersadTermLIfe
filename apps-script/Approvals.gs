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
 * The client is asked first (15 October 2026, the same evening: "when the
 * agent sign in to request the approval just like the fact find an email
 * trigger should go to the client with the request to concur and list the
 * history, the email should suggest to the client to pay online or credit
 * card and to confirm the reason … not encourage cash collection but not put
 * pressure on the client; if online or ACH etc is selected … sales support
 * … will action as a query; once they insist cash collection then I approve
 * and the email is routed to customer service with the client copied and an
 * email thread to protect all"):
 *   - the client's e-mail is Salesforce's, never typed over by the agent; one
 *     the agent supplies when none is on file is flagged, and an address on
 *     the Access tab is refused, so an agent can never confirm for a client;
 *   - the client's e-mail lists their own history, offers the cashless ways
 *     to pay, and asks whether the reason is right. Each choice opens a page
 *     where the client presses Send: mail scanners open every link, and a
 *     link that recorded an answer would answer for the client;
 *   - a cashless choice closes the request and sends Sales Support a query,
 *     the agent told; "I still prefer cash" puts it in the manager's queue;
 *     "this is not right" puts it there flagged;
 *   - no answer in APR.CLIENT_WAIT_DAYS working days, or no e-mail at all: it
 *     reaches the manager flagged, and approving it needs a note;
 *   - approval is a reply on the client's own e-mail, to GL Customer Service,
 *     the client, the agent and the manager copied: one thread.
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
 *   APR_BM_EMAIL       the manager's Outlook address: copied on every
 *                      approval, and where new requests are announced.
 *   APR_FROM           the mailbox every e-mail goes from. Default
 *                      support@rickyrampersadbranch.com (asked for on 15
 *                      October 2026: "ok so from support@…").
 *   APR_REPLY_TO       reply-to. Blank: APR_FROM.
 *   MS_TENANT, MS_CLIENT, MS_SECRET
 *                      the Entra app the Service Questionnaire project already
 *                      sends support@'s mail with (Graph Mail.Send). Copy the
 *                      three values into this project. Without them nothing
 *                      goes live: test mode falls back to the owner's Gmail.
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
  FROM: 'support@rickyrampersadbranch.com',
  FROM_NAME: 'Ricky Rampersad Branch',
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
  CLIENT_WAIT_DAYS: 2,  // working days for the client's answer before it reaches the manager flagged
  SALES_SUPPORT: 'rickyrampersadsalessupport@myguardiangroup.com',
  /* The client's choices, in the order the e-mail offers them. The cashless
     ways come first and cash last, as an equal option, never a warning. */
  CHOICES: {
    online: { label: 'Pay online or by bank transfer', other: true },
    card:   { label: 'Pay by credit or debit card', other: true },
    auto:   { label: 'Set up automatic payments (standing order or salary deduction)', other: true },
    help:   { label: 'Please call me about another way to pay', other: true },
    cash:   { label: 'I prefer my agent to collect, and the reason is right', other: false },
    wrong:  { label: 'This is not right: I did not ask for this, or the reason is wrong', other: false },
  },
  CHOICE_ORDER: ['online', 'card', 'auto', 'help', 'cash', 'wrong'],
};

var APR_COLUMNS = [
  'Reference', 'Requested At', 'Agent', 'Agent Email', 'Approval Type',
  'Client First Name', 'Client Last Name', 'Policy Number', 'Amount (TT$)',
  'Reason Category', 'Reason', 'What Is Different', 'History Seen',
  'Prior Requests', 'Prior In 90 Days', 'Flags',
  'Status', 'Decided By', 'Decided At', 'Decision Note', 'Agent Reply',
  'GL Email', 'GL Email At', 'Template', 'Mode',
  'Client Email', 'Client Email Source', 'Client Email Sent', 'Client Choice', 'Client Message', 'Client Answered At',
  'Sales Support Told', 'Message Id', 'Conversation Id', 'Client Subject',
];

var APR_STATUS = { PENDING: 'Pending', INFO: 'More info needed', APPROVED: 'Approved', DECLINED: 'Declined',
                   AWAIT: 'Awaiting client', OTHER: 'Client paying another way' };


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
           glSet: !!aprProp_('APR_GL_CS_TO'), from: aprFrom_(), msSet: !!aprMsCreds_() };
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
  var onFile = aprSfEmails_(first, last, policy);
  return { ok: true, client: aprCase_(first) + ' ' + aprCase_(last), emailOnFile: onFile.emails, sf: onFile.sf,
           summary: aprOutSummary_(aprSummary_(h.exact)),
           history: h.exact.map(aprOutRec_), possible: h.possible.map(aprOutRec_),
           flags: flags.filter(function (f) { return !/^Same reason/.test(f); }) };
}

/* The client's e-mail as Salesforce has it: by policy number first, then by
   name, keeping only contacts whose name is the client's. Never fails a
   request: without Salesforce the agent supplies one and it is flagged. */
function aprSfEmails_(first, last, policy) {
  var out = { emails: [], sf: false };
  try {
    if (!dbSfConfigured_()) return out;
    out.sf = true;
    var want = aprNameKey_(first) + aprNameKey_(last), want2 = aprNameKey_(last) + aprNameKey_(first);
    var seen = {};
    var add = function (cs) {
      (cs || []).forEach(function (c) {
        var k = aprNameKey_(c.first) + aprNameKey_(c.last);
        if (c.email && (k === want || k === want2) && !seen[c.email]) { seen[c.email] = 1; out.emails.push(c.email); }
      });
    };
    if (policy) add((dbLookup_({ policy: policy.split(/[\/,;]/)[0] }, {}) || {}).clients);
    if (!out.emails.length) add((dbLookup_({ name: first + ' ' + last }, {}) || {}).clients);
  } catch (e) { Logger.log('approvals sf e-mail: ' + e); }
  return out;
}

/* Every address on the Access tab (the team): never a client's. */
function aprTeamEmails_() {
  var set = {};
  try {
    var sh = dbSheet_(DB.TABS.ACCESS, DB_ACCESS_COLUMNS), hm = dbHeaderMap_(sh), last = sh.getLastRow();
    if (last > 1 && 'Email' in hm.map) sh.getRange(2, 1, last - 1, hm.head.length).getValues()
      .forEach(function (r) { var e = String(r[hm.map['Email']] || '').trim().toLowerCase(); if (e) set[e] = 1; });
  } catch (e) {}
  [APR.BM_EMAIL, APR.FROM, APR.SALES_SUPPORT, aprProp_('APR_BM_EMAIL')].forEach(function (e) { if (e) set[String(e).toLowerCase()] = 1; });
  return set;
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
  var given = dbClean_(b.clientEmail, 120).toLowerCase(), noEmail = !!b.noEmail;

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
  /* The client's address: Salesforce's wins. One the agent gives is used
     only when Salesforce has none, and never one of the team's own. */
  var onFile = aprSfEmails_(first, last, policy), email = '', source = '', extraFlags = [];
  if (onFile.emails.length) { email = onFile.emails[0]; source = 'Salesforce'; }
  else if (given && !noEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(given)) problems.push("the client's e-mail (it does not look like an address)");
    else if (aprTeamEmails_()[given]) problems.push("the client's own e-mail: " + given + ' is on our team list');
    else { email = given; source = 'Given by the agent'; extraFlags.push('Client e-mail given by the agent, not on file'); }
  } else if (!noEmail) problems.push("the client's e-mail, or a tick that they have none");
  else extraFlags.push('Client has no e-mail: not asked');
  if (problems.length) throw new Error('Still needed: ' + problems.join(', ') + '.');

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = aprRequestsTab_();
    var now = new Date();
    var ref = 'APR-' + Utilities.formatDate(now, dbTz_(), 'yyMMdd') + '-' + String(sh.getLastRow()).slice(-4).padStart(4, '0');
    var req = { reasonCategory: cat, amount: amount };
    var flags = aprFlags_(h.exact, req, now).concat(extraFlags);
    var s = aprSummary_(h.exact, now);
    sh.appendRow(dbRowFor_(sh, {
      'Reference': ref, 'Requested At': now, 'Agent': who.name, 'Agent Email': aprAgentEmail_(who.name),
      'Approval Type': type, 'Client First Name': first, 'Client Last Name': last, 'Policy Number': policy,
      'Amount (TT$)': amount || '', 'Reason Category': cat, 'Reason': reason, 'What Is Different': different,
      'History Seen': h.exact.length ? 'Yes — ' + h.exact.length + ' on record' : 'None on record',
      'Prior Requests': s.count, 'Prior In 90 Days': s.in90, 'Flags': flags.join('; '),
      'Status': email ? APR_STATUS.AWAIT : APR_STATUS.PENDING, 'Mode': aprMode_(),
      'Client Email': email, 'Client Email Source': source || 'None',
    }));
  } finally { lock.releaseLock(); }

  if (!email) {
    aprNotifyManager_(ref, who.name, first + ' ' + last, type, amount, flags);
    return { ok: true, ref: ref, flags: flags, prior: h.exact.length, client: 'none' };
  }
  var sh2 = aprRequestsTab_(), row = aprFind_(sh2, ref);
  var mail = aprClientMail_(row);
  var sent = aprSend_(email, mail.subject, mail.html, [], { track: true });
  aprSet_(sh2, row._row, { 'Client Email Sent': sent.status + (sent.sentAt ? ' ' + Utilities.formatDate(sent.sentAt, dbTz_(), 'yyyy-MM-dd HH:mm') : ''),
                           'Message Id': sent.id || '', 'Conversation Id': sent.conversationId || '', 'Client Subject': mail.subject });
  if (!/sent/i.test(sent.status)) {
    /* The client could not be asked: the manager decides without them. */
    aprSet_(sh2, row._row, { 'Status': APR_STATUS.PENDING, 'Flags': flags.concat(['Client e-mail failed: ' + sent.status]).join('; ') });
    aprNotifyManager_(ref, who.name, first + ' ' + last, type, amount, flags.concat(['Client e-mail failed']));
    return { ok: true, ref: ref, flags: flags, prior: h.exact.length, client: 'failed', clientEmail: sent.status };
  }
  return { ok: true, ref: ref, flags: flags, prior: h.exact.length, client: 'asked', email: aprMask_(email) };
}

/* "an***@example.com": the agent sees where it went, not the whole address. */
function aprMask_(e) { var m = String(e).split('@'); return m[0].slice(0, 2) + '***@' + (m[1] || ''); }

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
           glEmail: String(r['GL Email'] || ''), template: String(r['Template'] || ''),
           clientEmail: r['Client Email'] ? aprMask_(r['Client Email']) : '', clientSource: String(r['Client Email Source'] || ''),
           clientChoice: String(r['Client Choice'] || ''), clientMessage: String(r['Client Message'] || ''),
           clientAt: aprDate_(r['Client Answered At']) ? aprDate_(r['Client Answered At']).toISOString() : '',
           clientSent: String(r['Client Email Sent'] || ''), salesTold: String(r['Sales Support Told'] || ''),
           waitingDays: r['Status'] === APR_STATUS.AWAIT ? aprWorkDays_(aprDate_(r['Requested At']), new Date()) : 0 };
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
  /* Waiting on the client: shown apart, and moved up beside the rest once the
     client has had APR.CLIENT_WAIT_DAYS working days. */
  var waiting = rows.filter(function (r) { return r['Status'] === APR_STATUS.AWAIT; });
  var since = Date.now() - 30 * 86400000;
  var done = rows.filter(function (r) {
    var d = aprDate_(r['Decided At']);
    var c = aprDate_(r['Client Answered At']);
    return ((r['Status'] === APR_STATUS.APPROVED || r['Status'] === APR_STATUS.DECLINED) && d && d.getTime() >= since) ||
           (r['Status'] === APR_STATUS.OTHER && c && c.getTime() >= since);
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
  return { ok: true, mode: aprMode_(), glSet: !!aprProp_('APR_GL_CS_TO'), msSet: !!aprMsCreds_(), from: aprFrom_(),
           open: open.map(withHistory), waiting: waiting.map(withHistory), done: done.map(aprOutRow_),
           waitDays: APR.CLIENT_WAIT_DAYS };
}

/* Exactly what GL Customer Service will receive, before it is sent. */
function aprPreview_(b) {
  var sh = aprRequestsTab_();
  var r = aprFind_(sh, b.ref);
  var mail = aprGlMail_(r, { name: APR.BM_NAME }, dbClean_(b.note, 800));
  return { ok: true, subject: mail.subject, html: mail.html, template: mail.template,
           to: aprProp_('APR_GL_CS_TO') || '(GL Customer Service address not set yet)',
           cc: [r['Client Email'] ? 'the client' : '', 'the agent', 'you'].filter(String).join(', '),
           thread: !!r['Message Id'] };
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
  if (decision === 'approve' && aprMode_() === 'live' && !aprMsCreds_()) {
    throw new Error('Sending from ' + aprFrom_() + ' is not set up (MS_TENANT, MS_CLIENT, MS_SECRET). Nothing was sent.');
  }

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var sh, r;
  try {
    sh = aprRequestsTab_();
    r = aprFind_(sh, b.ref);
    if (r['Status'] === APR_STATUS.APPROVED || r['Status'] === APR_STATUS.DECLINED) {
      throw new Error('Already ' + String(r['Status']).toLowerCase() + ' by ' + r['Decided By'] + '.');
    }
    if (r['Status'] === APR_STATUS.OTHER) throw new Error('The client chose to pay another way: Sales Support has it as a query.');
    if (r['Status'] === APR_STATUS.AWAIT && decision === 'approve' && note.length < 5) {
      throw new Error('The client has not answered yet. Add a note saying why you approve without them.');
    }
    var status = decision === 'approve' ? APR_STATUS.APPROVED : decision === 'decline' ? APR_STATUS.DECLINED : APR_STATUS.INFO;
    /* The decision is written before any mail goes, so a mail failure never
       loses the decision; it shows on the row instead. */
    aprSet_(sh, r._row, { 'Status': status, 'Decided By': who.name, 'Decided At': new Date(), 'Decision Note': note });
  } finally { lock.releaseLock(); }

  var out = { ok: true, status: decision };
  if (decision === 'approve') {
    var mail = aprGlMail_(r, who, note);
    /* A reply on the client's own e-mail, so the client, the agent, the
       manager and Customer Service all hold the one thread. */
    var sent = aprSend_(aprProp_('APR_GL_CS_TO'), mail.subject, mail.html,
                        [r['Client Email'], r['Agent Email'], aprProp_('APR_BM_EMAIL', APR.BM_EMAIL)],
                        { replyOn: r['Message Id'], quote: r['Client Email'] ? aprClientMail_(r) : null,
                          quoteAt: aprDate_(r['Requested At']) });
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
  var subject = r['Client Subject'] ? 'Re: ' + r['Client Subject'] + ' — approved'
    : 'Approved: ' + type + ' — ' + client + ' — ' + r['Policy Number'] + ' (' + r['Reference'] + ')';

  var facts = [
    ['Client', client], ['Policy number', r['Policy Number']], ['Approval', type],
    ['Amount', type === 'Cash Collection' ? aprMoney_(aprNum_(r['Amount (TT$)'])) : (r['Amount (TT$)'] ? aprMoney_(aprNum_(r['Amount (TT$)'])) : 'As per cheque')],
    ['Agent', r['Agent'] + (r['Agent Email'] ? ' · ' + r['Agent Email'] : '')],
    ['Reason', r['Reason Category'] + ' — ' + r['Reason']],
  ];
  if (r['What Is Different']) facts.push(['Circumstances this time', r['What Is Different']]);
  var cc = r['Client Choice'] ? (APR.CHOICES[r['Client Choice']] || {}).label : '';
  facts.push(['The client', cc ? 'Answered on ' + aprDay_(aprDate_(r['Client Answered At'])) + ': "' + cc + '"' +
    (r['Client Message'] ? ' — "' + r['Client Message'] + '"' : '')
    : r['Client Email'] ? 'Asked on ' + aprDay_(aprDate_(r['Requested At'])) + '; no answer before approval' : 'No e-mail on file; not asked']);
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
    '<p style="font-size:14px;color:#13202e;margin:0 0 12px">Dear Customer Service Team' +
    (r['Client Email'] ? ' (with ' + aprEsc_(String(r['Client First Name'])) + ' copied)' : '') + ',</p>' +
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

/* Every e-mail goes from support@rickyrampersadbranch.com through Microsoft
   Graph, the way the Service Questionnaire project sends its letters, and is
   kept in that mailbox's Sent Items. The manager's Outlook is copied on every
   approval. In test mode every message goes only to the test inbox, with a
   banner naming who it was for; without the Microsoft 365 properties a test
   falls back to the script owner's Gmail, and live mail is never sent that
   way. */
function aprFrom_() { return aprProp_('APR_FROM', APR.FROM); }

function aprMsCreds_() {
  var c = { tenant: aprProp_('MS_TENANT'), client: aprProp_('MS_CLIENT'), secret: aprProp_('MS_SECRET') };
  return (c.tenant && c.client && c.secret) ? c : null;
}

function aprMsToken_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('apr:ms-token');
  if (hit) return hit;
  var c = aprMsCreds_();
  if (!c) throw new Error('Microsoft 365 is not set up (MS_TENANT, MS_CLIENT, MS_SECRET).');
  var res = UrlFetchApp.fetch('https://login.microsoftonline.com/' + encodeURIComponent(c.tenant) + '/oauth2/v2.0/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { client_id: c.client, client_secret: c.secret, grant_type: 'client_credentials',
               scope: 'https://graph.microsoft.com/.default' },
  });
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !body.access_token) {
    throw new Error('Microsoft 365 refused the sign-in: ' + String(body.error_description || body.error || res.getResponseCode()).split('\n')[0].slice(0, 200));
  }
  try { cache.put('apr:ms-token', body.access_token, Math.max(60, Math.min(3000, (body.expires_in || 3600) - 300))); } catch (e) {}
  return body.access_token;
}

var APR_GRAPH = 'https://graph.microsoft.com/v1.0/users/';

/* One Graph call as support@. Immutable ids, so a message keeps its id when
   it moves from Drafts to Sent Items and can be replied on days later. */
function aprGraph_(method, path, body) {
  var res = UrlFetchApp.fetch(APR_GRAPH + encodeURIComponent(aprFrom_()) + path, {
    method: method, contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + aprMsToken_(), Prefer: 'IdType="ImmutableId"' },
    payload: body ? JSON.stringify(body) : undefined,
  });
  var code = res.getResponseCode(), text = res.getContentText();
  if (code >= 200 && code < 300) { try { return text ? JSON.parse(text) : {}; } catch (e) { return {}; } }
  if (code === 401) { try { CacheService.getScriptCache().remove('apr:ms-token'); } catch (e) {} }
  var why = 'HTTP ' + code;
  try { var err = JSON.parse(text).error; if (err) why = (err.code ? err.code + ': ' : '') + (err.message || ''); } catch (e) {}
  var ex = new Error('Microsoft 365 did not send: ' + why.slice(0, 200)); ex.code = code; throw ex;
}

function aprAddr_(list) {
  return list.filter(String).map(function (a) { return { emailAddress: { address: a } }; });
}

/* Sends one message from support@. With opts.track it is made as a draft
   and sent, so its id is kept for the reply later (needs Mail.ReadWrite;
   without it, sendMail and no id). With opts.replyOn it is a reply-all on
   that message, re-addressed, so it joins the client's thread. Any step that
   fails falls back to a fresh message, and the reply carries the client's
   e-mail quoted beneath it. Returns the ids when there are any. */
function aprMsSend_(to, subject, html, cc, replyTo, opts) {
  opts = opts || {};
  var toList = String(to).split(/\s*,\s*/).filter(String);
  if (opts.replyOn) {
    try {
      var draft = aprGraph_('post', '/messages/' + encodeURIComponent(opts.replyOn) + '/createReplyAll');
      aprGraph_('patch', '/messages/' + encodeURIComponent(draft.id), {
        subject: subject, body: { contentType: 'HTML', content: html + (opts.quoteHtml || '') },
        toRecipients: aprAddr_(toList), ccRecipients: aprAddr_(cc), replyTo: aprAddr_([replyTo]) });
      aprGraph_('post', '/messages/' + encodeURIComponent(draft.id) + '/send');
      return { id: draft.id, conversationId: draft.conversationId || '', threaded: true };
    } catch (e) { Logger.log('approvals reply-all fell back: ' + e.message); }
  }
  var msg = { subject: subject, body: { contentType: 'HTML', content: html + (opts.quoteHtml || '') },
              from: { emailAddress: { name: APR.FROM_NAME, address: aprFrom_() } }, toRecipients: aprAddr_(toList) };
  if (cc.length) msg.ccRecipients = aprAddr_(cc);
  if (replyTo) msg.replyTo = aprAddr_([replyTo]);
  if (opts.track) {
    try {
      var d = aprGraph_('post', '/messages', msg);
      aprGraph_('post', '/messages/' + encodeURIComponent(d.id) + '/send');
      return { id: d.id, conversationId: d.conversationId || '' };
    } catch (e) {
      if (!(e.code === 403 || e.code === 401 || e.code === 404)) throw e;
      Logger.log('approvals: no Mail.ReadWrite, sent without a thread id');
    }
  }
  aprGraph_('post', '/sendMail', { message: msg, saveToSentItems: true });
  return {};
}

/* The client's e-mail, quoted under a reply that could not join the thread. */
function aprQuote_(mail, at) {
  return '<div style="border-left:3px solid #c9d2de;margin:24px 12px 0;padding:4px 0 0 14px;color:#4b5a6b">' +
    '<p style="font-family:Arial;font-size:12px;margin:0 0 8px">On ' + aprEsc_(aprDay_(at)) + ', ' + aprEsc_(aprFrom_()) +
    ' wrote to the client:<br><b>' + aprEsc_(mail.subject) + '</b></p>' + mail.html + '</div>';
}

function aprSend_(to, subject, html, cc, opts) {
  opts = opts || {};
  to = String(to || '').trim();
  cc = (cc || []).map(function (x) { return String(x || '').trim(); })
    .filter(function (x, i, a) { return x && /@/.test(x) && a.indexOf(x) === i && to.toLowerCase().indexOf(x.toLowerCase()) < 0; });
  var test = aprMode_() !== 'live', ms = !!aprMsCreds_();
  var quoteHtml = opts.quote ? aprQuote_(opts.quote, opts.quoteAt) : '';
  if (test) {
    var inbox = aprProp_('APR_TEST_INBOX') || dbProp_('DB_TEST_INBOX') || Session.getEffectiveUser().getEmail();
    html = '<div style="background:#fff4d6;border:1px solid #efc24b;padding:10px 14px;font-family:Arial;font-size:13px">' +
      'TEST — in live mode this goes from <b>' + aprEsc_(aprFrom_()) + '</b> to <b>' + aprEsc_(to || '(not set)') + '</b>' +
      (cc.length ? ', copied to ' + aprEsc_(cc.join(', ')) : '') + '.</div>' + html;
    to = inbox; cc = []; subject = '[TEST] ' + subject;
  }
  if (!to) return { status: 'Not sent: no address' };
  var replyTo = aprProp_('APR_REPLY_TO') || aprFrom_();
  try {
    if (ms) {
      var r = aprMsSend_(to, subject, html, cc, replyTo, { track: opts.track, replyOn: opts.replyOn, quoteHtml: quoteHtml });
      return { status: (test ? 'Test copy sent' : 'Sent') + ' from ' + aprFrom_() + (r.threaded ? ' (on the client’s thread)' : ''),
               sentAt: new Date(), id: r.id || '', conversationId: r.conversationId || '' };
    }
    if (!test) return { status: 'Not sent: ' + aprFrom_() + ' is not set up (MS_TENANT, MS_CLIENT, MS_SECRET)' };
    if (MailApp.getRemainingDailyQuota && MailApp.getRemainingDailyQuota() < 1) return { status: 'Held: daily mail limit reached' };
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html + quoteHtml, name: APR.FROM_NAME, replyTo: replyTo });
    return { status: 'Test copy sent (Gmail: ' + aprFrom_() + ' not set up yet)', sentAt: new Date() };
  } catch (e) {
    return { status: 'Failed: ' + e.message };
  }
}


/* ============================== the client's say ============================== */

function aprWorkDays_(from, to) {
  if (!from) return 0;
  var d = new Date(from.getTime()), n = 0;
  d.setHours(0, 0, 0, 0);
  var end = new Date(to.getTime()); end.setHours(0, 0, 0, 0);
  while (d < end) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

function aprSign_(ref) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('apr|' + ref, dbSecret_()))
    .replace(/=+$/, '').slice(0, 22);
}

function aprLink_(ref, choice) {
  var u = dbExecUrl_();
  return u ? u + '?apr=' + encodeURIComponent(ref) + '&k=' + aprSign_(ref) + (choice ? '&c=' + choice : '') : '';
}

/* The e-mail to the client. Its job is a check, not a sale: it says what the
   agent asked for and why, shows the client their own record, sets out the
   other ways to pay as offers, and leaves cash as an equal answer. */
function aprClientMail_(r) {
  var first = String(r['Client First Name'] || '').trim();
  var client = (first + ' ' + String(r['Client Last Name'] || '')).trim();
  var type = String(r['Approval Type'] || 'Cash Collection');
  var what = type === 'Cheque Collection' ? 'collect a cheque' : 'collect your premium in cash';
  var amount = aprNum_(r['Amount (TT$)']);
  var prior = aprHistoryFor_({ first: r['Client First Name'], last: r['Client Last Name'], policy: r['Policy Number'] },
                             String(r['Reference'])).exact;
  var ref = String(r['Reference']);
  var subject = 'Your premium payment: a quick check (' + ref + ')';
  var btn = function (k, first) {
    var href = aprLink_(ref, k);
    var label = APR.CHOICES[k].label;
    if (!href) return '<li style="margin:6px 0">' + aprEsc_(label) + '</li>';
    return '<a href="' + aprEsc_(href) + '" style="display:block;margin:0 0 8px;padding:12px 14px;border-radius:8px;text-decoration:none;font-size:14px;' +
      (first ? 'background:#07131f;color:#efc24b;font-weight:bold' : 'background:#f4f6fa;color:#13202e;border:1px solid #dfe5ee') + '">' + aprEsc_(label) + '</a>';
  };
  var other = APR.CHOICE_ORDER.filter(function (k) { return APR.CHOICES[k].other; });
  var hist = prior.length
    ? '<p style="font-size:14px;margin:18px 0 6px"><b>Your record with us.</b> We have ' + prior.length + ' earlier request' + (prior.length === 1 ? '' : 's') +
      ' to collect a payment from you in person:</p>' +
      '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e3e8ef">' +
      prior.slice(0, 12).map(function (p, i) {
        return '<tr style="background:' + (i % 2 ? '#fff' : '#f7f9fc') + '"><td style="padding:7px 10px">' + aprEsc_(aprDay_(p.at)) +
          '</td><td style="padding:7px 10px">' + aprEsc_(p.type.replace(' Collection', '')) + '</td><td style="padding:7px 10px">' +
          aprEsc_(String(p.reason || '').split(' — ')[0] || '—') + '</td><td style="padding:7px 10px;text-align:right">' +
          (p.amount ? aprEsc_(aprMoney_(p.amount)) : '') + '</td></tr>';
      }).join('') + '</table>'
    : '<p style="font-size:14px;margin:18px 0 6px">This is the first request of its kind on your record.</p>';
  var html =
    '<div style="background:#eef1f5;padding:24px 12px;font-family:Arial,sans-serif;color:#13202e">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">' +
    '<tr><td style="background:#07131f;padding:18px 24px"><table role="presentation"><tr>' +
    '<td><img src="' + DB.LOGO + '" width="40" height="40" alt="" style="display:block;border-radius:8px"></td>' +
    '<td style="padding-left:12px"><div style="color:#efc24b;font-weight:bold;font-size:16px">' + aprEsc_(DB.BRAND) + '</div>' +
    '<div style="color:#a9bbcf;font-size:12px">Your premium payment</div></td></tr></table></td></tr>' +
    '<tr><td style="padding:24px">' +
    '<p style="font-size:14px;margin:0 0 12px">Dear ' + aprEsc_(first || 'Client') + ',</p>' +
    '<p style="font-size:14px;line-height:1.55;margin:0 0 12px">Your agent, ' + aprEsc_(r['Agent']) + ', has asked the branch to ' + what +
      ' on policy <b>' + aprEsc_(r['Policy Number']) + '</b>' + (amount ? ' (' + aprEsc_(aprMoney_(amount)) + ')' : '') +
      '. The reason given is: <b>' + aprEsc_(String(r['Reason Category'] || '').toLowerCase()) + '</b>.</p>' +
    '<p style="font-size:14px;line-height:1.55;margin:0 0 12px">Before we approve it, we check with you. It takes a moment, and whichever you choose is fine with us.</p>' +
    hist +
    '<p style="font-size:14px;line-height:1.55;margin:18px 0 8px"><b>Easier ways to pay, if they suit you.</b> They give you a record of every payment in your own name, ' +
      'and there is no visit to wait for. Choose one and our sales support team will contact you to set it up.</p>' +
    other.map(function (k, i) { return btn(k, i === 0); }).join('') +
    '<p style="font-size:14px;line-height:1.55;margin:18px 0 8px"><b>Or, if collection still suits you best,</b> tell us the reason is right and the branch manager will review it.</p>' +
    btn('cash', false) + btn('wrong', false) +
    '<p style="font-size:12px;color:#5b6b7d;line-height:1.5;margin:16px 0 0">Each choice opens a short page where you press Send. ' +
      'You can also simply reply to this e-mail. Reference ' + aprEsc_(ref) + '.</p>' +
    '<p style="font-size:14px;margin:20px 0 0">Kind regards,<br><b>' + aprEsc_(APR.BM_NAME) + '</b><br>' + aprEsc_(APR.BM_TITLE) + ' · ' + aprEsc_(DB.BRAND) + '</p>' +
    '<p style="font-size:11px;color:#8090a2;line-height:1.5;margin:20px 0 0;border-top:1px solid #eef1f5;padding-top:12px">' +
      'This e-mail is for ' + aprEsc_(client) + ' alone. If it reached you in error, please tell us and delete it. ' +
      'Your information is used only to look after your policy and is never sold or shared without your consent.</p>' +
    '</td></tr></table></div>';
  return { subject: subject, html: html };
}

/* The page a choice opens. Nothing is recorded until the client presses Send
   (go=1): a mail scanner opening the link records nothing. */
function aprClientPage_(p) {
  var ref = dbClean_(p.apr, 30);
  if (!ref || String(p.k || '') !== aprSign_(ref)) {
    return dbHtml_('<h1>This link has expired</h1><p>Please reply to our e-mail and we will help.</p>');
  }
  var sh = aprRequestsTab_(), r;
  try { r = aprFind_(sh, ref); } catch (e) { return dbHtml_('<h1>We could not find that request</h1><p>Please reply to our e-mail and we will help.</p>'); }
  var first = String(r['Client First Name'] || '');
  var decided = r['Status'] === APR_STATUS.APPROVED || r['Status'] === APR_STATUS.DECLINED;
  if (decided) {
    return dbHtml_('<h1>Thank you, ' + dbEsc_(first) + '</h1><p>This request has already been ' +
      String(r['Status']).toLowerCase() + '. If anything has changed, please reply to our e-mail.</p>');
  }
  var choice = APR.CHOICES[p.c] ? p.c : '';
  if (String(p.go) === '1' && choice) {
    var out = aprClientAnswer_(sh, r, choice, dbClean_(p.m, 600));
    return dbHtml_('<h1>Thank you, ' + dbEsc_(first) + '</h1><p>' + out + '</p><p class="muted">Reference ' + dbEsc_(ref) + '</p>');
  }
  var exec = dbExecUrl_();
  var opts = APR.CHOICE_ORDER.map(function (k) {
    return '<label style="display:block;padding:11px 12px;margin:0 0 8px;border:1px solid #dfe5ee;border-radius:10px">' +
      '<input type="radio" name="c" value="' + k + '"' + (k === choice ? ' checked' : '') + ' style="margin-right:8px">' +
      dbEsc_(APR.CHOICES[k].label) + '</label>';
  }).join('');
  return dbHtml_('<h1>Your premium payment</h1>' +
    '<p>' + dbEsc_(r['Approval Type']) + ' on policy <b>' + dbEsc_(r['Policy Number']) + '</b>' +
      (aprNum_(r['Amount (TT$)']) ? ' · ' + dbEsc_(aprMoney_(aprNum_(r['Amount (TT$)']))) : '') +
      ', asked for by ' + dbEsc_(r['Agent']) + '.</p>' +
    (r['Client Choice'] ? '<p class="muted">You answered: ' + dbEsc_((APR.CHOICES[r['Client Choice']] || {}).label || '') + '. You can change it here.</p>' : '') +
    '<form method="get" action="' + dbEsc_(exec) + '" target="_top">' +
    '<input type="hidden" name="apr" value="' + dbEsc_(ref) + '"><input type="hidden" name="k" value="' + dbEsc_(p.k) + '">' +
    '<input type="hidden" name="go" value="1">' + opts +
    '<p class="muted" style="margin:12px 0 6px">Anything you would like us to know (optional)</p>' +
    '<textarea name="m" maxlength="600"></textarea>' +
    '<button type="submit">Send</button></form>');
}

/* One answer, recorded once; answering again with the same choice changes
   nothing and tells nobody twice. */
function aprClientAnswer_(sh, r, choice, msg) {
  var ref = String(r['Reference']), now = new Date(), c = APR.CHOICES[choice];
  if (r['Client Choice'] === choice && !msg) {
    return c.other ? 'We have your answer. Our sales support team will contact you to set it up.' : 'We have your answer. Thank you.';
  }
  var flags = String(r['Flags'] || '').split('; ').filter(String);
  var set = { 'Client Choice': choice, 'Client Message': msg, 'Client Answered At': now };
  if (c.other) set['Status'] = APR_STATUS.OTHER;
  else {
    set['Status'] = APR_STATUS.PENDING;
    if (choice === 'wrong' && flags.indexOf('Client says this is not right') < 0) flags.push('Client says this is not right');
    set['Flags'] = flags.join('; ');
  }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { aprSet_(sh, r._row, set); } finally { lock.releaseLock(); }
  Object.keys(set).forEach(function (k) { r[k] = set[k]; });
  var client = (r['Client First Name'] + ' ' + r['Client Last Name']).trim();
  if (c.other) {
    var q = aprSalesMail_(r, c.label, msg);
    var sent = aprSend_(aprProp_('APR_SALES_SUPPORT', APR.SALES_SUPPORT), q.subject, q.html, [r['Agent Email']]);
    aprSet_(sh, r._row, { 'Sales Support Told': sent.status });
    return 'You chose: ' + dbEsc_(c.label) + '. Our sales support team will contact you to set it up, and your agent has been told. Nothing will be collected.';
  }
  aprNotifyManager_(ref, r['Agent'], client, r['Approval Type'], aprNum_(r['Amount (TT$)']),
                    choice === 'wrong' ? ['Client says this is not right'] : ['Client confirmed: prefers collection']);
  return choice === 'wrong'
    ? 'Thank you for telling us. The branch manager will look into it, and nothing will be collected until he has.'
    : 'Thank you. The branch manager will review the request, and you will be copied on his decision.';
}

/* The query for Sales Support: a client who will pay another way. */
function aprSalesMail_(r, label, msg) {
  var client = (r['Client First Name'] + ' ' + r['Client Last Name']).trim();
  return {
    subject: 'Query: ' + client + ' wants to pay another way — ' + r['Policy Number'] + ' (' + r['Reference'] + ')',
    html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#13202e">' +
      '<h2 style="color:#07131f;font-size:18px">A client chose to pay another way</h2>' +
      '<p style="font-size:14px"><b>' + aprEsc_(client) + '</b> was asked about a ' + aprEsc_(String(r['Approval Type']).toLowerCase()) +
      ' and chose: <b>' + aprEsc_(label) + '</b>.</p>' +
      (msg ? '<div style="background:#f4f6fa;border-left:4px solid #efc24b;padding:12px 14px;font-size:14px">' + aprEsc_(msg) + '</div>' : '') +
      '<table style="font-size:13px;margin-top:12px">' +
      [['Policy', r['Policy Number']], ['Amount', aprMoney_(aprNum_(r['Amount (TT$)']))], ['Client e-mail', r['Client Email']],
       ['Agent', r['Agent'] + (r['Agent Email'] ? ' · ' + r['Agent Email'] : '')], ['Reference', r['Reference']]]
        .map(function (x) { return '<tr><td style="color:#5b6b7d;padding:3px 12px 3px 0">' + x[0] + '</td><td>' + aprEsc_(x[1]) + '</td></tr>'; }).join('') +
      '</table><p style="font-size:14px">Please contact the client to set it up and log it as a query in Salesforce. ' +
      'The collection request is closed; nothing is to be collected.</p></div>',
  };
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
  notes.push('Sends from: ' + aprFrom_() + (aprMsCreds_() ? '' : ' — NOT SET UP (MS_TENANT, MS_CLIENT, MS_SECRET)'));
  if (aprMsCreds_()) { try { aprMsToken_(); notes.push('Microsoft 365 sign-in: OK'); } catch (e) { notes.push(e.message); } }
  notes.push('Replies go to: ' + (aprProp_('APR_REPLY_TO') || aprFrom_()));
  notes.push('Manager copied: ' + aprProp_('APR_BM_EMAIL', APR.BM_EMAIL));
  notes.push('Approvers: Access-tab Role matching /' + aprProp_('APR_APPROVER_ROLE', 'branch manager') + '/');
  Logger.log(notes.join('\n'));
  try { SpreadsheetApp.getUi().alert('Approvals setup', notes.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return notes;
}
