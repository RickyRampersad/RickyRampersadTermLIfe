/**
 * ============================================================
 *  BILLINGS MANAGEMENT — the groups' monthly bills, checked against Salesforce
 *  Ricky Rampersad Branch · a fifth file in the Service Questionnaire project, beside GroupClients.gs
 * ============================================================
 *
 *  Asked for on 24 October 2026: "on the 26th the billings go out … create a section called Billings Management as well
 *  include in this section Terminations and Enrollments", then "the staff log in … upload the group health, then life,
 *  then pensions if any and do the reconciliation … the client has a list bill so it pulls the pension … using
 *  intelligence and data to guide", then "it should be an experience … it guides them what they have to check with
 *  life, health, and etc. … asks them to upload the PDF billing, and it verifies our Salesforce records … it scrubs all
 *  the open tasks on the group's billings … scrubbing the inbox … allows the staff or the manager to place comments on
 *  the task, and it goes on to Chatter … on the client's side … they see on the group health, their billing, the group
 *  life … and the group pensions plus any concerns, all the tasks that are opened, the history".
 *
 *  What happens, line by line (health, then life, then the list bill):
 *    1. The staff member opens a group's Billing review on the staff page and uploads the month's bill. The PDF is read
 *       on their own device (groupclientmanagement/billread.js): what reaches here is the figures and the member lines,
 *       never the file. The branch's own pension and life list bill is a spreadsheet, read the same way; it can also be
 *       built here from Salesforce by the group's list bill, which is what "it pulls the pension" means.
 *    2. gblCheck_ verifies it against Salesforce: the month's billing record (TRANSACTIONS__c) and its amount, the
 *       payments keyed (Payments__c) against the arrears the bill shows, every member on the bill against the group's
 *       member policies (CLIENT_PORTFOLIO__c), the changes since last month's bill, health against life, the life
 *       rates, the 31-day rule on life changes, and the list bill against the policies carrying it. Each finding says
 *       what is wrong, whose it is to fix (Salesforce, Head Office, the group, or us) and, where this script can, offers
 *       the fix: set the Salesforce amount, record a payment, open a task, post a note.
 *    3. The review page also shows the open billing tasks with their Chatter, the group's e-mails to support@ about
 *       billing, and an AI read of where things stand. A comment typed there goes onto the task's Chatter.
 *    4. Reconciled means a person ticked it: the Salesforce record is marked Reconciled, the task gets the note, and the
 *       bill can be sent to the group from support@ with the PDFs attached and a cover note that says what changed.
 *       Nothing goes to a group until GCM_BILL_LIVE is set: until then a send goes to the staff member and the branch,
 *       marked TEST.
 *    5. The group's own page gets a Billing tab per line: the latest bill, what Salesforce holds as billed and paid for
 *       the last twelve months, their open billing items, and a form to tell us about a payment made or a person joining
 *       or leaving. What they send is filed on Group Changes, posted to the task's Chatter and e-mailed to the account
 *       owner; a joiner or leaver also opens a Salesforce task.
 *
 *  Where it writes (all in the Group Client Management sheet, GCM_SHEET_ID):
 *    Group Bills        one row a group, line and month: the figures, the Salesforce figures, the variance, the findings,
 *                       who checked and reconciled it, when it was sent
 *    Group Bill Lines   one row a member on a bill (the premium, the tier, the division; for life the sums assured)
 *    Group Changes      every joiner, leaver, tier change, payment or query, from a bill, from the group's page or from
 *                       staff, with the Salesforce task it opened
 *    Group Claims       a group's claims experience by month and division, as counts and amounts only: the claims
 *                       summary is aggregated on the staff member's device, so no patient's name ever reaches here
 *
 *  Rules:
 *    - No member's name goes to the AI, into a Chatter post the group reads, or onto the group's page from here.
 *    - A Salesforce write happens only on a signed-in person's press (an amount, a payment, a task, a note), never from
 *      the upload itself, and is logged on Group Changes with who pressed it.
 *    - The 30-day reason rule, who may act on a group (owner, deputy, branch) and the sign-in are GroupClients.gs's.
 */

var GBL = {
  BILLS: 'Group Bills', LINES: 'Group Bill Lines', CHANGES: 'Group Changes', CLAIMS: 'Group Claims',
  LIVE_PROP: 'GCM_BILL_LIVE',          // set by gblGoLive: until then a bill goes only to the staff member and the branch, marked TEST
  MONTHS: 14,                           // months of billing records read from Salesforce
  KEYED_DAYS: 21,                       // a payment keyed more than this many days after it was paid is a note
  REPORT_DAYS: 31,                      // the group life policy's own rule: a change reported later needs evidence of insurability
  RATE_JUMP: 0.12,                      // a month's premium this much above the month before, kept the month after, is a renewal
  RT: { health: 'T-HEALTH GROUP', life: 'T-LIFE GROUP', listbill: 'T- PENSIONS GROUP' },
  POL: { health: 'HEALTH (GROUP)', life: 'LIFE(GROUP)' },
  LABEL: { health: 'Group Health', life: 'Group Life', listbill: 'Pensions and life (list bill)' },
  GONE: /LAPSED|TERMINAT|CANCEL|SURRENDER|NPW|NOT PROCEED|EXPIRED|DECEASED|DEATH|^X$|^0$/i,
  CACHE_S: 600,
  AI_MAX_FINDINGS: 40
};
var GBL_HEAD = {
  'Group Bills': ['When', 'Group', 'Line', 'Month', 'Ref', 'Dated', 'Due by', 'Members', 'Current', 'Adjustments', 'Due', 'Arrears shown', 'Payable',
                  'SF Record', 'SF Billed', 'SF Due', 'SF Paid', 'Variance', 'Findings', 'Resolved', 'Status', 'By', 'Checked at', 'Reconciled at', 'Reconciled by', 'Sent at', 'Files', 'Summary'],
  'Group Bill Lines': ['Group', 'Line', 'Month', 'Member Id', 'Name', 'Division', 'Tier', 'Start', 'Eff', 'Premium', 'Kind', 'For month', 'Cover'],
  'Group Changes': ['When', 'Group', 'Line', 'Kind', 'Member', 'Detail', 'Effective', 'Amount', 'Source', 'By', 'Status', 'SF Task', 'SF Id', 'Note'],
  'Group Claims': ['Group', 'Month', 'Division', 'Claims', 'Charge', 'Member share', 'Paid', 'Uploaded', 'By']
};

/* ── sheets (the group sheet's tabs, made on first use) ─────────────────────────────── */
function gblSheet_(name) {
  var ss = gcmSS_(), sh = ss.getSheetByName(name), head = GBL_HEAD[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < head.length) {
    var have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (h) { return String(h).trim(); });
    if (have.every(function (h, i) { return !h || h === head[i]; })) sh.getRange(1, have.length + 1, 1, head.length - have.length).setValues([head.slice(have.length)]).setFontWeight('bold');
  }
  return sh;
}
function gblRows_(name) { return gcmSS_().getSheetByName(name) ? gcmRows_(name) : []; }
function gblAppend_(name, rows) {
  if (!rows.length) return;
  var sh = gblSheet_(name), head = GBL_HEAD[name];
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, head.length).setValues(rows.map(function (o) {
    return head.map(function (h) { var v = o[h]; return v === undefined || v === null ? '' : v; });
  }));
}
/** Rewrite a tab without the rows `drop` picks, then with `add` after them. Whole, so a reader never meets it half written. */
function gblReplace_(name, drop, add) {
  var sh = gblSheet_(name), head = GBL_HEAD[name];
  var keep = gblRows_(name).filter(function (r) { return !drop(r); });
  var rows = keep.concat(add || []).map(function (o) { return head.map(function (h) { var v = o[h]; return v === undefined || v === null ? '' : v; }); });
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, head.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
}
function gblJ_(x, fb) { try { var v = JSON.parse(gcmText_(x) || 'null'); return v === null ? fb : v; } catch (e) { return fb; } }
function gblArr_(x) { return Array.isArray(x) ? x : []; }
function gblNum_(x) { var n = Number(String(x === null || x === undefined ? '' : x).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
function gblR_(x) { return Math.round((Number(x) || 0) * 100) / 100; }
function gblMonthOf_(ymd) { return String(ymd || '').slice(0, 7); }
function gblMonthLabel_(m) {
  var M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var x = /^(\d{4})-(\d{2})/.exec(String(m || ''));
  return x ? M[Number(x[2]) - 1] + ' ' + x[1] : String(m || '');
}
function gblAddMonths_(m, n) {
  var x = /^(\d{4})-(\d{2})/.exec(m); if (!x) return m;
  var d = new Date(Date.UTC(+x[1], +x[2] - 1 + n, 1));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
}
function gblLine_(s) { s = String(s || '').toLowerCase(); return s === 'health' || s === 'life' ? s : s === 'pension' || s === 'pensions' || s === 'listbill' ? 'listbill' : ''; }
/** A member's key on a health bill or policy record: "TPG0278-00126-00" and "TPG0278-00126-0001-Jul-2016" are one person. */
function gblMemberKey_(s) {
  var m = /^([A-Z]{2,5}\s?\d{3,6})\s*-\s*(\d{3,6})/i.exec(String(s || '').trim());
  if (m) return (m[1] + '-' + m[2]).toUpperCase().replace(/\s+/g, '');
  var d = String(s || '').replace(/\D/g, '');
  return d ? String(Number(d)) : String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function gblCertKey_(s) { var d = String(s || '').replace(/\D/g, ''); return d ? String(Number(d)) : ''; }
/** One person under two spellings: a first name in common (a cut-off one counts) and a surname in common. Mirrors
 *  BillRead.samePerson so the page and the backend agree. */
function gblSamePerson_(a, b) {
  var parts = function (s) {
    s = String(s || '').toUpperCase().replace(/\(.*?\)/g, ' ').replace(/[^A-Z,;\- ']/g, ' ').trim();
    var m = /^(.+?)\s*[,;]\s*(.*)$/.exec(s), w = function (x) { return x.replace(/-/g, ' ').split(/[\s']+/).filter(String); };
    if (m) return { last: w(m[1]), first: w(m[2]) };
    var all = w(s); return { last: all.slice(-1), first: all.slice(0, -1), loose: all };
  };
  var x = parts(a), y = parts(b);
  var firstOk = function (f1, f2) { return f1.some(function (u) { return f2.some(function (v) { return u === v || (u.length >= 3 && v.length >= 3 && (u.indexOf(v) === 0 || v.indexOf(u) === 0)); }); }); };
  var lastOk = function (l1, l2) {
    var j1 = l1.join(''), j2 = l2.join('');
    if (j1 && j1 === j2) return true;
    return l1.some(function (u) { return u.length > 2 && (l2.indexOf(u) >= 0 || j2.indexOf(u) >= 0); }) || l2.some(function (v) { return v.length > 2 && j1.indexOf(v) >= 0; });
  };
  var xf = x.loose ? x.loose.slice(0, -1) : x.first, yf = y.loose ? y.loose.slice(0, -1) : y.first;
  var xa = x.loose || x.last.concat(x.first), ya = y.loose || y.last.concat(y.first);
  return firstOk(xf, yf) && (lastOk(x.last, y.last) || lastOk(x.last, ya) || lastOk(y.last, xa));
}

/* ── Salesforce: what the branch holds about a group's billing ───────────────────────── */
function gblSf_(g, fresh) {
  var key = 'gbl-sf-' + g.key.slice(0, 40), cache = CacheService.getScriptCache();
  if (!fresh) { try { var c = cache.get(key); if (c) return JSON.parse(c); } catch (e) {} }
  var out = { ok: tSfOn_(), trans: [], pays: [], health: [], life: [], list: [], users: {}, error: '' };
  if (!out.ok) { out.error = 'Salesforce is not linked to this project.'; return out; }
  try {
    var since = gblAddMonths_(gcmToday_(), -GBL.MONTHS) + '-01';
    var accts = g.acctsFull && g.acctsFull.length ? g.acctsFull : g.accts;
    if (accts.length) {
      gcmQuery_('SELECT Id, Name, RecordType.Name, Renewal_Date__c, Group_Billing_Premiums__c, Premium_Due__c, Payments_Made__c, Premium_Owed__c, Days_O_S__c, Reconciled__c, ' +
        'Payment_Date__c, Payment_Method__c, Employee_Div_1__c, CreatedDate FROM TRANSACTIONS__c WHERE Account__c IN (' + gcmIn_(accts) + ') AND Renewal_Date__c >= ' + since + ' ORDER BY Renewal_Date__c DESC')
        .forEach(function (t) {
          out.trans.push({ id: t.Id, id15: gcmId15_(t.Id), name: t.Name, rt: gcmName_(t, 'RecordType'), line: gblLineOfRt_(gcmName_(t, 'RecordType')), month: gblMonthOf_(t.Renewal_Date__c),
            billed: Number(t.Group_Billing_Premiums__c) || 0, due: Number(t.Premium_Due__c) || 0, paid: Number(t.Payments_Made__c) || 0, owed: Number(t.Premium_Owed__c) || 0,
            days: Number(t.Days_O_S__c) || 0, reconciled: !!t.Reconciled__c, paidOn: gcmYmd_(t.Payment_Date__c), method: String(t.Payment_Method__c || ''), created: gcmYmd_(t.CreatedDate) });
        });
      gcmQuery_('SELECT Id, PMTS__c, Payment_Made__c, Date_Paid__c, Payment_Type__c, Bank__c, Renewal_Date__c, Policy__c, Transaction_Record_Type__c, CreatedDate, CreatedBy.Name ' +
        'FROM Payments__c WHERE PMTS__r.Account__c IN (' + gcmIn_(accts) + ') AND (Date_Paid__c >= ' + since + ' OR CreatedDate = LAST_N_DAYS:450) ORDER BY Date_Paid__c DESC')
        .forEach(function (p) {
          out.pays.push({ id: p.Id, trans: gcmId15_(p.PMTS__c), amount: Number(p.Payment_Made__c) || 0, paidOn: gcmYmd_(p.Date_Paid__c), method: String(p.Payment_Type__c || ''), bank: String(p.Bank__c || ''),
            forMonth: gblMonthOf_(p.Renewal_Date__c), ref: String(p.Policy__c || ''), rt: String(p.Transaction_Record_Type__c || ''), keyed: gcmYmd_(p.CreatedDate), by: gcmName_(p, 'CreatedBy') });
        });
    }
    /* the members: the group's health and life member policies, by account or by any of its list bills */
    var bills = [];
    g.bills.forEach(function (b) { [b, b.replace(/\s+/g, ''), b.replace(/^([A-Za-z]+)\s*(\d+)$/, '$1 $2')].forEach(function (v) { if (bills.indexOf(v) < 0) bills.push(v); }); });
    var where = [];
    if (accts.length) where.push('Account__c IN (' + gcmIn_(accts) + ')');
    if (bills.length) where.push('List_Bill__c IN (' + gcmIn_(bills) + ')');
    if (where.length) {
      var F = 'Id, POLICY__c, RecordType.Name, Policy_Status_Description__c, Contact__r.Name, INSURED__c, ISSUE_DATE__c, Total_Premiums__c, Life_Premium__c, Pension_Premiums__c, Paid_To_Date__c, List_Bill__c, Account__c, Account__r.Name, Status_Change_Date__c';
      gcmQuery_('SELECT ' + F + ' FROM CLIENT_PORTFOLIO__c WHERE (' + where.join(' OR ') + ") AND RecordType.Name IN ('HEALTH (GROUP)', 'LIFE(GROUP)', 'PENSION', 'LIFE')").forEach(function (p) {
        var rt = gcmName_(p, 'RecordType'), st = String(p.Policy_Status_Description__c || '');
        var row = { id: p.Id, policy: String(p.POLICY__c || ''), rt: rt, status: st, gone: GBL.GONE.test(st), name: gcmName_(p, 'Contact__r') || String(p.INSURED__c || ''),
          issued: gcmYmd_(p.ISSUE_DATE__c), premium: Number(p.Total_Premiums__c) || 0, life: Number(p.Life_Premium__c) || 0, pension: Number(p.Pension_Premiums__c) || 0,
          paidTo: gcmYmd_(p.Paid_To_Date__c), listBill: String(p.List_Bill__c || ''), onAccount: accts.map(gcmId15_).indexOf(gcmId15_(p.Account__c)) >= 0, acct: gcmName_(p, 'Account__r'),
          changed: gcmYmd_(p.Status_Change_Date__c) };
        if (rt === GBL.POL.health) out.health.push(row);
        else if (rt === GBL.POL.life) out.life.push(row);
        else if (p.List_Bill__c) out.list.push(row);   // a personal pension or life policy paid through the group's payroll
      });
    }
  } catch (e) { out.error = String(e && e.message ? e.message : e).slice(0, 200); }
  try { cache.put(key, JSON.stringify(out), GBL.CACHE_S); } catch (e2) {}
  return out;
}
function gblLineOfRt_(rt) {
  var u = String(rt || '').toUpperCase().replace(/\s+/g, '');
  return /HEALTH/.test(u) ? 'health' : /LIFE/.test(u) ? 'life' : /PENSION/.test(u) ? 'listbill' : '';
}
/** The month's billing record for a line, and the payments keyed against it. */
function gblSfMonth_(sf, line, month) {
  var t = sf.trans.filter(function (x) { return x.line === line && x.month === month; })[0] || null;
  var pays = t ? sf.pays.filter(function (p) { return p.trans === t.id15; }) : [];
  return { rec: t, pays: pays };
}
/** The list bill as Salesforce would bill it this month: every live pension and personal life policy carrying the group's list bill. */
function gblListFromSf_(g, sf) {
  var members = sf.list.filter(function (p) { return !p.gone; }).map(function (p) {
    return { id: p.policy, policy: p.policy, name: p.name, issue: p.issued, premium: p.premium, line: /PENSION/i.test(p.rt) ? 'Pension' : 'Life', section: p.rt, paidTo: p.paidTo, onAccount: p.onAccount, acct: p.acct };
  }).sort(function (a, b) { return (a.line < b.line ? -1 : a.line > b.line ? 1 : 0) || (a.name < b.name ? -1 : 1); });
  var subtotals = {};
  members.forEach(function (m) { subtotals[m.line] = gblR_((subtotals[m.line] || 0) + m.premium); });
  var total = gblR_(members.reduce(function (s, m) { return s + m.premium; }, 0));
  return { kind: 'listbill', line: 'listbill', source: 'salesforce', ref: g.bills[0] || '', month: gcmToday_().slice(0, 7), members: members, subtotals: subtotals, total: total, due: total, count: members.length, warnings: [] };
}

/* ── the stored bills ───────────────────────────────────────────────────────────────── */
function gblBillRows_(g) {
  return gblRows_(GBL.BILLS).filter(function (r) { return gcmCodeKey_(r.Group) === g.key; }).map(gblBillOf_)
    .sort(function (a, b) { return a.month < b.month ? -1 : a.month > b.month ? 1 : 0; });
}
function gblBillOf_(r) {
  return { _n: r._n, group: gcmText_(r.Group), line: gcmText_(r.Line), month: gcmText_(r.Month), ref: gcmText_(r.Ref), dated: gcmText_(r.Dated), dueBy: gcmText_(r['Due by']),
    members: gblNum_(r.Members), current: gblNum_(r.Current), adjustments: gblNum_(r.Adjustments), due: gblNum_(r.Due), arrears: gblNum_(r['Arrears shown']), payable: gblNum_(r.Payable),
    sfRecord: gcmText_(r['SF Record']), sfBilled: gblNum_(r['SF Billed']), sfDue: gblNum_(r['SF Due']), sfPaid: gblNum_(r['SF Paid']), variance: gblNum_(r.Variance),
    findings: gblJ_(r.Findings, []), resolved: gblJ_(r.Resolved, {}), status: gcmText_(r.Status), by: gcmText_(r.By), checkedAt: gcmText_(r['Checked at']),
    reconciledAt: gcmText_(r['Reconciled at']), reconciledBy: gcmText_(r['Reconciled by']), sentAt: gcmText_(r['Sent at']), files: gcmText_(r.Files), summary: gblJ_(r.Summary, {}), at: gcmWhen_(r.When) };
}
function gblLines_(g, line, month) {
  return gblRows_(GBL.LINES).filter(function (r) { return gcmCodeKey_(r.Group) === g.key && gcmText_(r.Line) === line && gcmText_(r.Month) === month; }).map(function (r) {
    return { id: gcmText_(r['Member Id']), name: gcmText_(r.Name), division: gcmText_(r.Division), tier: gcmText_(r.Tier), start: gcmText_(r.Start), eff: gcmText_(r.Eff),
      premium: gblNum_(r.Premium), kind: gcmText_(r.Kind) || 'member', forMonth: gcmText_(r['For month']), cover: gblJ_(r.Cover, null) };
  });
}
/** The last stored bill of a line before `month`. */
function gblPrevious_(g, line, month) {
  var prev = gblBillRows_(g).filter(function (b) { return b.line === line && b.month < month; }).pop();
  return prev ? { bill: prev, lines: gblLines_(g, line, prev.month) } : null;
}
function gblChanges_(g) {
  return gblRows_(GBL.CHANGES).filter(function (r) { return gcmCodeKey_(r.Group) === g.key; }).map(function (r) {
    return { _n: r._n, at: gcmWhen_(r.When), when: gcmYmd_(r.When), ts: r.When instanceof Date ? r.When.getTime() : 0, line: gcmText_(r.Line), kind: gcmText_(r.Kind), member: gcmText_(r.Member),
      detail: gcmText_(r.Detail), effective: gcmText_(r.Effective), amount: gblNum_(r.Amount), source: gcmText_(r.Source), by: gcmText_(r.By), status: gcmText_(r.Status) || 'open',
      task: gcmText_(r['SF Task']), sfId: gcmText_(r['SF Id']), note: gcmText_(r.Note) };
  });
}

/* ── the checks ─────────────────────────────────────────────────────────────────────── */
/** Every finding: { id, level: fix | check | note | ok, who: salesforce | headoffice | group | us, text, action, data }.
 *  `fix` is something this script can put right or that must be put right before the bill is reconciled; `check` needs a
 *  person to confirm; `note` is for the record. Names appear in `text` for staff; `aiText` carries the same finding with
 *  no name, for the AI read. */
function gblCheck_(g, line, bill, sf, prev, today) {
  var F = [], n = 0;
  var add = function (level, who, text, extra) {
    var f = { id: line.charAt(0) + (++n), level: level, who: who, text: text };
    if (extra) Object.keys(extra).forEach(function (k) { f[k] = extra[k]; });
    if (!f.aiText) f.aiText = text;
    F.push(f); return f;
  };
  var money = gcmMoney_;
  (bill.warnings || []).forEach(function (w) { add('check', 'us', 'The bill as read: ' + w, { kind: 'read' }); });

  /* 1. the month's billing record in Salesforce, and its amount */
  var sm = gblSfMonth_(sf, line, bill.month), rec = sm.rec;
  if (!sf.ok) add('check', 'salesforce', 'Salesforce could not be read' + (sf.error ? ' (' + sf.error + ')' : '') + ': the record checks are not done.', { kind: 'sf' });
  else if (!rec) add('fix', 'salesforce', 'There is no ' + GBL.RT[line] + ' billing record for ' + gblMonthLabel_(bill.month) + ' in Salesforce. Create it for ' + money(bill.due) + ' before the bill goes.', { kind: 'norecord' });
  else {
    var diff = gblR_(rec.billed - bill.due);
    if (Math.abs(diff) > 0.05) add('fix', 'salesforce', 'Salesforce has ' + money(rec.billed) + ' for ' + gblMonthLabel_(bill.month) + '; the bill says ' + money(bill.due) + ' (' + (diff > 0 ? money(diff) + ' too high' : money(-diff) + ' short') + ').',
      { kind: 'amount', action: 'sfAmount', data: { rec: rec.id, want: bill.due, have: rec.billed } });
    else add('ok', 'salesforce', 'Salesforce has the month at ' + money(rec.billed) + ', the same as the bill.', { kind: 'amount' });
    if (line === 'health' && bill.divisions && bill.divisions.length > 1 && rec.due && Math.abs(rec.due - bill.divisions[0].total) > 0.05)
      add('note', 'salesforce', 'Premium Due on the record is ' + money(rec.due) + '; the first division on the bill (' + bill.divisions[0].name + ') is ' + money(bill.divisions[0].total) + '.', { kind: 'division', aiText: 'The staff division figure on the record differs from the bill.' });
    if (rec.reconciled) add('note', 'us', 'The Salesforce record is already marked Reconciled.', { kind: 'reconciled' });
  }

  /* 2. what the bill says is still owed from earlier months, against the payments keyed in Salesforce */
  var arrears = bill.outstanding || [];
  if (line === 'health' && arrears.length) {
    var byMonth = {};
    arrears.forEach(function (o) { byMonth[o.month] = gblR_((byMonth[o.month] || 0) + o.amount); });
    Object.keys(byMonth).sort().forEach(function (m) {
      var r2 = gblSfMonth_(sf, line, m), paidSf = r2.rec ? Math.max(r2.rec.paid, r2.pays.reduce(function (s, p) { return s + p.amount; }, 0)) : 0;
      var payDates = r2.pays.map(function (p) { return tDmy_(p.paidOn) + (p.keyed && gcmDays_(p.paidOn, p.keyed) > GBL.KEYED_DAYS ? ' (keyed ' + tDmy_(p.keyed) + ')' : ''); });
      if (!r2.rec) add('check', 'salesforce', 'The bill shows ' + gblMonthLabel_(m) + ' unpaid (' + money(byMonth[m]) + '), and Salesforce has no billing record for that month at all.', { kind: 'arrears', month: m });
      else if (paidSf >= byMonth[m] - 0.05) add('check', 'headoffice', 'The bill shows ' + gblMonthLabel_(m) + ' unpaid (' + money(byMonth[m]) + '), but Salesforce has ' + money(paidSf) + ' paid' + (payDates.length ? ' on ' + payDates.join(', ') : '') +
        '. Confirm with Group Health premium accounting that the payment was applied before the group is asked for it.', { kind: 'arrears', month: m, aiText: 'A month the bill shows unpaid is recorded as paid in Salesforce.' });
      else if (paidSf > 0) add('check', 'group', gblMonthLabel_(m) + ': the bill shows ' + money(byMonth[m]) + ' still owed; Salesforce has ' + money(paidSf) + ' paid. Part of the month is outstanding.', { kind: 'arrears', month: m });
      else add('fix', 'group', gblMonthLabel_(m) + ' is unpaid: ' + money(byMonth[m]) + ' outstanding, and no payment is keyed in Salesforce. Chase it, or record the payment if it was made.', { kind: 'arrears', month: m, action: 'payment', data: { month: m, amount: byMonth[m] } });
    });
  }
  /* no payment keyed for a long while, on a line Head Office does not show arrears for */
  var recent = sf.trans.filter(function (t) { return t.line === line && t.month < bill.month; }).slice(0, 6);
  var unpaid = recent.filter(function (t) { return !t.paid && !sf.pays.some(function (p) { return p.trans === t.id15; }); });
  if (recent.length >= 3 && unpaid.length >= 3) add('check', 'us', unpaid.length + ' of the last ' + recent.length + ' months have no payment keyed in Salesforce (' + unpaid.map(function (t) { return gblMonthLabel_(t.month).slice(0, 3); }).join(', ') + '). Either the payments are not being keyed, or the group is behind: check with ' + (line === 'health' ? 'Group Health' : line === 'life' ? 'Group Life' : 'Pensions') + ' billing.', { kind: 'unpaid' });

  /* 3. the people: the bill against Salesforce's member policies (health and life), and against last month's bill */
  var members = bill.members || [];
  if (line === 'health' || line === 'life') {
    var pols = line === 'health' ? sf.health : sf.life;
    var keyOf = line === 'health' ? function (x) { return gblMemberKey_(x.id || x.policy); } : function (x) { return gblCertKey_(x.cert || x.id || x.policy); };
    var polKey = {}, used = {};
    pols.forEach(function (p) { var k = line === 'health' ? gblMemberKey_(p.policy) : gblCertKey_(p.policy); if (k && !polKey[k]) polKey[k] = p; });
    var notInSf = [], tierDiff = [];
    members.forEach(function (m) {
      var k = line === 'health' ? gblMemberKey_(m.id) : gblCertKey_(m.cert || m.id), p = k ? polKey[k] : null;
      if (!p) { var byName = pols.filter(function (q) { return gblSamePerson_(q.name, m.name); })[0]; if (byName) { p = byName; k = line === 'health' ? gblMemberKey_(byName.policy) : gblCertKey_(byName.policy); } }
      if (!p) { notInSf.push(m); return; }
      used[k] = true;
      if (p.gone) add('check', 'salesforce', gblNice_(m.name) + ' is on the bill but Salesforce shows the policy as ' + (p.status || 'ended') + '. One of them is wrong.', { kind: 'status', member: m.name, aiText: 'A member on the bill is recorded as ended in Salesforce.' });
      if (line === 'health' && p.premium && Math.abs(p.premium - m.premium) > 0.05) tierDiff.push({ m: m, p: p });
    });
    if (sf.ok && pols.length) {
      if (notInSf.length) add('fix', 'salesforce', notInSf.length + ' on the bill ' + (notInSf.length === 1 ? 'is' : 'are') + ' not in Salesforce as a member of this group: ' + notInSf.map(function (m) { return gblNice_(m.name); }).join(', ') + '. Add the ' + (notInSf.length === 1 ? 'record' : 'records') + ', or they will never be chased, serviced or seen on the page.',
        { kind: 'notInSf', members: notInSf.map(function (m) { return { id: m.id, name: m.name, start: m.start, tier: m.tier, premium: m.premium }; }), aiText: notInSf.length + ' members on the bill have no policy record in Salesforce.' });
      var inSfOnly = pols.filter(function (p) { var k = line === 'health' ? gblMemberKey_(p.policy) : gblCertKey_(p.policy); return !p.gone && !used[k] && (p.onAccount || p.listBill); });
      if (inSfOnly.length) add('check', 'salesforce', inSfOnly.length + ' in Salesforce as live ' + (inSfOnly.length === 1 ? 'member is' : 'members are') + ' not on the bill: ' + inSfOnly.slice(0, 12).map(function (p) { return gblNice_(p.name); }).join(', ') + (inSfOnly.length > 12 ? ' and ' + (inSfOnly.length - 12) + ' more' : '') +
        '. If they left, mark the policies; if they should be covered, Head Office has dropped them.', { kind: 'inSfOnly', members: inSfOnly.map(function (p) { return { id: p.policy, name: p.name, premium: p.premium, issued: p.issued }; }), aiText: inSfOnly.length + ' live member records in Salesforce are not on the bill.' });
      if (tierDiff.length) add('check', 'salesforce', tierDiff.length + ' member ' + (tierDiff.length === 1 ? 'premium differs' : 'premiums differ') + ' from Salesforce: ' + tierDiff.slice(0, 8).map(function (x) { return gblNice_(x.m.name) + ' ' + money(x.m.premium) + ' (SF ' + money(x.p.premium) + ')'; }).join('; ') + (tierDiff.length > 8 ? '; and ' + (tierDiff.length - 8) + ' more' : '') + '. A tier change, or a rate Salesforce never got.',
        { kind: 'tier', members: tierDiff.map(function (x) { return { id: x.m.id, name: x.m.name, bill: x.m.premium, sf: x.p.premium }; }), aiText: tierDiff.length + ' member premiums differ between the bill and Salesforce.' });
    } else if (sf.ok && members.length) add('check', 'salesforce', 'Salesforce holds no ' + GBL.POL[line] + ' member records for this group, so the ' + members.length + ' members on the bill cannot be checked one by one.', { kind: 'nomembers' });

    /* month on month */
    if (prev && prev.lines.length) {
      var pk = {}, ck = {};
      prev.lines.filter(function (l) { return l.kind === 'member'; }).forEach(function (l) { pk[keyOf(l)] = l; });
      members.forEach(function (m) { ck[keyOf(m)] = m; });
      var joined = members.filter(function (m) { return !pk[keyOf(m)]; }), left = prev.lines.filter(function (l) { return l.kind === 'member' && !ck[keyOf(l)]; });
      var moved = members.filter(function (m) { var o = pk[keyOf(m)]; return o && Math.abs(o.premium - m.premium) > 0.05; });
      if (joined.length) add('note', 'us', 'Joined since the ' + gblMonthLabel_(prev.bill.month) + ' bill: ' + joined.map(function (m) { return gblNice_(m.name) + (m.start ? ' (from ' + tDmy_(m.start) + ')' : ''); }).join(', ') + '.', { kind: 'joined', members: joined.map(function (m) { return { id: m.id, name: m.name, start: m.start, tier: m.tier, premium: m.premium }; }), aiText: joined.length + ' joined since last month.' });
      if (left.length) add('note', 'us', 'Off the bill since ' + gblMonthLabel_(prev.bill.month) + ': ' + left.map(function (l) { return gblNice_(l.name); }).join(', ') + '. Make sure each one has a termination task and the policy is marked.', { kind: 'left', members: left.map(function (l) { return { id: l.id, name: l.name, premium: l.premium }; }), aiText: left.length + ' came off the bill since last month.' });
      if (moved.length) add('note', 'us', 'Premium changed since ' + gblMonthLabel_(prev.bill.month) + ': ' + moved.map(function (m) { return gblNice_(m.name) + ' ' + money(pk[keyOf(m)].premium) + ' → ' + money(m.premium); }).join('; ') + '.', { kind: 'moved', aiText: moved.length + ' members changed tier or premium.' });
      if (prev.bill.due && Math.abs(bill.due - prev.bill.due) / prev.bill.due > GBL.RATE_JUMP) add('check', 'headoffice', 'The bill is ' + Math.round(100 * (bill.due - prev.bill.due) / prev.bill.due) + '% ' + (bill.due > prev.bill.due ? 'above' : 'below') + ' last month (' + money(prev.bill.due) + '). A renewal rate, or an error: read the rates.', { kind: 'jump' });
    }
    /* the credits and adjustments on a health bill: each is a change that should have a task */
    (bill.credits || []).forEach(function (c) {
      var hit = g.tasks.filter(function (t) { return gblSamePerson_(t.subject, c.name) || (c.name && t.subject.toUpperCase().indexOf(c.name.split(/[,;]/)[0].trim().toUpperCase()) >= 0); });
      var what = c.kind === 'cancel' ? 'taken off from ' + gblMonthLabel_(c.month) : 'charged for ' + gblMonthLabel_(c.month) + (c.tier ? ' as ' + c.tier : '');
      if (!hit.length) add('check', 'us', gblNice_(c.name) + ' is ' + what + ' (' + money(c.premium) + ') and no Salesforce task records that change. Open one, or confirm the group asked for it.', { kind: 'credit', member: c.name, action: 'task', data: { name: c.name, kind: c.kind === 'cancel' ? 'leaver' : 'joiner', month: c.month, amount: c.premium }, aiText: 'A back-dated change on the bill has no task recording it.' });
      else add('note', 'us', gblNice_(c.name) + ' ' + what + ' (' + money(c.premium) + '): task on file (' + gcmTitle_(hit[0].subject, g.name) + ').', { kind: 'credit', member: c.name, aiText: 'A back-dated change on the bill has a task.' });
    });
  }

  /* 4. life: the rates, the statement, the 31-day rule */
  if (line === 'life') {
    (bill.offRate || []).forEach(function (x) { add('check', 'headoffice', 'Cert ' + x.cert + ' (' + gblNice_(x.name) + '): ' + x.why + '.', { kind: 'rate', member: x.name, aiText: 'A member is charged off the rate.' }); });
    gblArr_(bill.adjustments).forEach(function (a) {
      var late = a.asAt && bill.dated ? gcmDays_(a.asAt, bill.dated) : null;
      var hit = g.tasks.filter(function (t) { return gblSamePerson_(t.subject, a.name); });
      var txt = gblNice_(a.name) + ' (cert ' + a.cert + ') ' + (a.kind === 'left' ? 'terminated' : a.kind === 'joined' ? 'added' : 'changed') + (a.asAt ? ' as at ' + tDmy_(a.asAt) : '') + ', ' + (a.premium < 0 ? 'credit ' : '') + money(Math.abs(a.premium)) + (a.periods > 1 ? ' over ' + a.periods + ' months' : '') + '.';
      if (late !== null && late > GBL.REPORT_DAYS && a.kind !== 'left') add('check', 'us', txt + ' Reported ' + late + ' days after the effective date: the policy asks for changes within ' + GBL.REPORT_DAYS + ' days, or evidence of insurability.', { kind: 'adj', member: a.name, aiText: 'A life change was reported after the 31-day window.' });
      else add('note', 'us', txt + (hit.length ? ' Task on file.' : ' No Salesforce task records it.'), { kind: 'adj', member: a.name, action: hit.length ? '' : 'task', data: { name: a.name, kind: a.kind === 'left' ? 'leaver' : 'joiner', month: gblMonthOf_(a.asAt), amount: a.premium }, aiText: 'A life statement adjustment' + (hit.length ? ' with a task.' : ' with no task.') });
    });
    /* on health but not on life, and the other way: eligibility differs, so a check, not a fix */
    var hb = gblBillRows_(g).filter(function (b) { return b.line === 'health' && b.month === bill.month; })[0];
    if (hb) {
      var hl = gblLines_(g, 'health', bill.month).filter(function (l) { return l.kind === 'member'; });
      var onlyH = hl.filter(function (h) { return !members.some(function (m) { return gblSamePerson_(m.name, h.name); }); });
      var onlyL = members.filter(function (m) { return !hl.some(function (h) { return gblSamePerson_(m.name, h.name); }); });
      if (onlyH.length) add('check', 'group', onlyH.length + ' on the health bill ' + (onlyH.length === 1 ? 'is' : 'are') + ' not on the life bill: ' + onlyH.map(function (h) { return gblNice_(h.name); }).join(', ') + '. A new joiner not yet added to life, or a name spelt differently.', { kind: 'hvl', aiText: onlyH.length + ' on health are not on life.' });
      if (onlyL.length) add('note', 'group', onlyL.length + ' on the life bill ' + (onlyL.length === 1 ? 'is' : 'are') + ' not on health: ' + onlyL.map(function (m) { return gblNice_(m.name); }).join(', ') + '.', { kind: 'lvh', aiText: onlyL.length + ' on life are not on health.' });
    }
    if (bill.reportDays && bill.reportDays !== GBL.REPORT_DAYS) add('note', 'us', 'The covering letter gives ' + bill.reportDays + ' days to report changes.', { kind: 'letter' });
  }

  /* 5. the list bill: what the group pays through its payroll, against the policies carrying its list bill */
  if (line === 'listbill' && sf.ok) {
    var fromSf = gblListFromSf_(g, sf), sfBy = {};
    fromSf.members.forEach(function (m) { sfBy[String(m.policy).replace(/\D/g, '')] = m; });
    var seen = {}, notTagged = [], premDiff = [];
    members.filter(function (m) { return m.line !== 'Terminated'; }).forEach(function (m) {
      var k = String(m.policy || m.id).replace(/\D/g, ''), p = sfBy[k];
      if (!p) { notTagged.push(m); return; }
      seen[k] = true;
      if (Math.abs(p.premium - m.premium) > 0.05) premDiff.push({ m: m, p: p });
      if (p.line !== m.line && m.line !== 'Other') add('note', 'salesforce', gblNice_(m.name) + ' ' + m.policy + ' is ' + m.line.toLowerCase() + ' on the list and ' + p.section + ' in Salesforce.', { kind: 'rt', aiText: 'A policy’s record type differs from the list.' });
    });
    if (notTagged.length) add('fix', 'salesforce', notTagged.length + ' on the list ' + (notTagged.length === 1 ? 'does' : 'do') + ' not carry the list bill ' + (g.bills[0] || '') + ' in Salesforce: ' + notTagged.map(function (m) { return gblNice_(m.name) + ' ' + m.policy; }).join(', ') + '. Put the list bill on the policy, or the next list built here will leave them out.',
      { kind: 'notTagged', members: notTagged.map(function (m) { return { id: m.policy, name: m.name, premium: m.premium }; }), aiText: notTagged.length + ' policies on the list bill are not tagged with it in Salesforce.' });
    var extra = fromSf.members.filter(function (m) { return !seen[String(m.policy).replace(/\D/g, '')]; });
    if (extra.length && members.length) add('check', 'group', extra.length + ' ' + (extra.length === 1 ? 'policy carries' : 'policies carry') + ' the list bill in Salesforce but ' + (extra.length === 1 ? 'is' : 'are') + ' not on the list: ' + extra.map(function (m) { return gblNice_(m.name) + ' ' + m.policy + ' (' + money(m.premium) + ')'; }).join(', ') + '. If the person has left, take the list bill off the policy; if not, ' + money(extra.reduce(function (s, m) { return s + m.premium; }, 0)) + ' a month is not being billed.',
      { kind: 'extra', members: extra.map(function (m) { return { id: m.policy, name: m.name, premium: m.premium }; }), aiText: extra.length + ' policies carry the list bill but are not on the list.' });
    if (premDiff.length) add('check', 'salesforce', premDiff.length + ' ' + (premDiff.length === 1 ? 'premium differs' : 'premiums differ') + ' between the list and Salesforce: ' + premDiff.map(function (x) { return gblNice_(x.m.name) + ' ' + x.m.policy + ' ' + money(x.m.premium) + ' (SF ' + money(x.p.premium) + ')'; }).join('; ') + '.', { kind: 'premDiff', aiText: premDiff.length + ' premiums differ between the list and Salesforce.' });
    var behind = sf.list.filter(function (p) { return !p.gone && p.paidTo && gcmDays_(p.paidTo, today) > 60; });
    if (behind.length) add('check', 'us', behind.length + ' of the list bill’s policies ' + (behind.length === 1 ? 'is' : 'are') + ' paid to more than two months ago in Salesforce: ' + behind.slice(0, 10).map(function (p) { return gblNice_(p.name) + ' ' + p.policy + ' (to ' + tDmy_(p.paidTo) + ')'; }).join(', ') + (behind.length > 10 ? ' and ' + (behind.length - 10) + ' more' : '') + '. The group pays the list as one sum, so either the allocation is behind or the paid-to dates are not maintained.', { kind: 'paidTo', aiText: behind.length + ' list bill policies show paid-to dates over two months old.' });
  }

  /* 6. the payments keyed: dates that do not read right */
  sf.pays.filter(function (p) { var t = sf.trans.filter(function (x) { return x.id15 === p.trans; })[0]; return t && t.line === line; }).forEach(function (p) {
    if (p.paidOn && p.keyed && gcmDays_(p.paidOn, p.keyed) < -1) add('note', 'salesforce', 'A payment of ' + money(p.amount) + ' for ' + gblMonthLabel_(p.forMonth) + ' is dated ' + tDmy_(p.paidOn) + ', after it was keyed (' + tDmy_(p.keyed) + '): check the date.', { kind: 'payDate', aiText: 'A payment is dated after the day it was keyed.' });
    else if (p.paidOn && p.keyed && gcmDays_(p.paidOn, p.keyed) > 60) add('note', 'salesforce', 'A payment of ' + money(p.amount) + ' for ' + gblMonthLabel_(p.forMonth) + ' was keyed ' + gcmDays_(p.paidOn, p.keyed) + ' days after it was paid.', { kind: 'payLate', aiText: 'A payment was keyed long after it was made.' });
  });
  return F;
}
function gblNice_(s) {
  s = String(s || '').replace(/\s*;\s*/, ', ').trim();
  var m = /^(.+?),\s*(.+)$/.exec(s);
  var cap = function (x) { return x.toLowerCase().replace(/(^|[\s'-])([a-z])/g, function (q, p, c) { return p + c.toUpperCase(); }); };
  return m ? cap(m[2]) + ' ' + cap(m[1]) : cap(s);
}

/* ── the steps of a review, for the page ────────────────────────────────────────────── */
function gblSteps_(b) {
  if (!b) return { upload: false, verify: false, fixed: false, reconciled: false, sent: false, open: 0 };
  var fixes = b.findings.filter(function (f) { return f.level === 'fix' && !b.resolved[f.id]; }).length;
  var checks = b.findings.filter(function (f) { return f.level === 'check' && !b.resolved[f.id]; }).length;
  /* "Fix" is done when nothing marked fix is open; a check left open is the reconciler's call, and reconciling closes the step */
  return { upload: true, verify: !!b.checkedAt, fixed: fixes === 0, reconciled: !!b.reconciledAt, sent: !!b.sentAt, open: fixes + checks, fixes: fixes, checks: checks };
}

/* ── routes ─────────────────────────────────────────────────────────────────────────── */
/** The group's billing review: the lines it has, each line's latest bill with its findings and steps, Salesforce's
 *  records and payments for the last months, the open billing tasks with their Chatter, the group's e-mails about
 *  billing, the changes register and the claims experience. */
function gblView_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(p.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  var today = L.today, sf = gblSf_(g, gcmYes_(p.fresh));
  var bills = gblBillRows_(g), month = /^\d{4}-\d{2}$/.test(String(p.month || '')) ? p.month : gblDefaultMonth_(bills, sf, today);
  var lines = gblLinesOf_(g, sf, bills);
  var out = { ok: true, role: who.role, me: who.name, today: today, month: month, monthLabel: gblMonthLabel_(month), canAct: gcmMine_(who, g), live: gblLive_(), ai: !!gcmAiKey_(), salesforce: sf.ok, sfError: sf.error,
    group: { key: g.key, name: g.name, assigned: g.assigned, bills: g.bills, to: g.to, contact: g.contact }, lines: [] };
  lines.forEach(function (ln) {
    var b = bills.filter(function (x) { return x.line === ln && x.month === month; })[0] || null;
    var sm = gblSfMonth_(sf, ln, month);
    var hist = sf.trans.filter(function (t) { return t.line === ln; }).slice(0, 13).map(function (t) {
      var pays = sf.pays.filter(function (q) { return q.trans === t.id15; });
      return { month: t.month, label: gblMonthLabel_(t.month), billed: t.billed, due: t.due, paid: Math.max(t.paid, pays.reduce(function (s, q) { return s + q.amount; }, 0)), paidOn: pays.length ? pays[0].paidOn : t.paidOn, method: pays.length ? pays[0].method : t.method,
        keyed: pays.length ? pays[0].keyed : '', by: pays.length ? pays[0].by : '', reconciled: t.reconciled, rec: t.name, days: t.days };
    });
    var stored = bills.filter(function (x) { return x.line === ln; }).map(function (x) { return { month: x.month, label: gblMonthLabel_(x.month), due: x.due, members: x.members, status: x.status, sentAt: x.sentAt, reconciledAt: x.reconciledAt, by: x.by }; });
    var o = { line: ln, label: GBL.LABEL[ln], rt: GBL.RT[ln], bill: b ? gblBillOut_(b, who) : null, steps: gblSteps_(b), sf: { rec: sm.rec, pays: sm.pays, history: hist }, stored: stored };
    if (ln === 'listbill') o.fromSalesforce = sf.ok ? gblListFromSf_(g, sf) : null;
    if (ln === 'health') o.claims = gblExperience_(g, sf, true);
    out.lines.push(o);
  });
  /* the open billing tasks, with their Chatter: what Salesforce says is happening with the money */
  var tasks = g.tasks.filter(function (t) { return t.open && gblIsBillingTask_(t); });
  var feed = gcmFeed_(tasks.map(function (t) { return t.id; }));
  out.tasks = tasks.map(function (t) {
    return { id: t.id, title: gcmTitle_(t.subject, g.name), subject: t.subject, cat: t.cat, line: gblLineOfRt_(t.ref ? t.subject : t.subject), status: t.status, owner: t.owner, opened: t.opened, age: gcmDays_(t.opened, today), due: t.due, late: !!(t.due && t.due < today), ref: t.ref,
      posts: (feed[t.id15] || []).slice(0, 8), story: gcmStory_(g, t, today, false), shown: gcmShown_(g, t) };
  }).sort(function (a, b) { return (b.late - a.late) || ((b.age || 0) - (a.age || 0)); });
  out.feedError = feed._error || '';
  /* the group's e-mails to support@ about money, the last 60 days */
  out.inbox = gblInbox_(L, g);
  out.people = gblPeople_(g, who);
  out.changes = gblChanges_(g).slice(-40).reverse();
  out.claimsUploaded = gblClaimsRows_(g).length > 0;
  out.guide = gblGuide_(out);
  return out;
}
function gblBillOut_(b, who) {
  var o = {};
  Object.keys(b).forEach(function (k) { if (k !== '_n') o[k] = b[k]; });
  o.monthLabel = gblMonthLabel_(b.month);
  return o;
}
/** The month a review opens on: the newest bill stored or billed in Salesforce, else this month. */
function gblDefaultMonth_(bills, sf, today) {
  var m = today.slice(0, 7);
  var newest = bills.map(function (b) { return b.month; }).concat(sf.trans.map(function (t) { return t.month; })).filter(function (x) { return x && x <= gblAddMonths_(m, 1); }).sort().pop();
  return newest || m;
}
/** The lines a group has: a line with a billing record in Salesforce, a stored bill, or (for the list bill) policies carrying its list bill. */
function gblLinesOf_(g, sf, bills) {
  var has = {};
  sf.trans.forEach(function (t) { if (t.line) has[t.line] = true; });
  bills.forEach(function (b) { has[b.line] = true; });
  if (sf.health.length) has.health = true;
  if (sf.life.length) has.life = true;
  if (sf.list.length) has.listbill = true;
  var order = ['health', 'life', 'listbill'];
  var out = order.filter(function (l) { return has[l]; });
  return out.length ? out : order;
}
function gblIsBillingTask_(t) {
  return /Renewa|Bill/i.test(t.type || '') || /T-\s*(LIFE|HEALTH|PENSIONS)\s*GROUP|BILLING|RENEWAL DATE|PAYMENT RECEIVED|PREMIUM|RECONCIL|ARREARS/i.test(t.subject) || GCM_CATS.slice(0, 3).indexOf(t.cat) >= 0;
}
/** The group's e-mails to support@ that read as billing: a subject with bill, premium, payment, invoice, statement or the
 *  line in it, from the contact or the company's domain, in the last 60 days. Read through the inbox reader the star
 *  reminder uses; never thrown. */
function gblInbox_(L, g) {
  try {
    var m = gcmMailIn_(L, Date.now() - 60 * 86400000);
    if (!m.ok) return { ok: false, error: m.error, mails: [] };
    var mails = (m.by[g.key] || []).filter(function (x) { return /bill|premium|payment|paid|invoice|statement|arrear|receipt|wire|transfer|cheque|pension|life|health/i.test(x.subject); }).slice(0, 12);
    return { ok: true, mails: mails };
  } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 120), mails: [] }; }
}
/** What to do next, in order, from where the lines stand: the page shows it at the top. */
function gblGuide_(v) {
  var steps = [];
  v.lines.forEach(function (o) {
    var s = o.steps, lab = o.label;
    if (!s.upload) steps.push({ line: o.line, text: 'Upload the ' + v.monthLabel + ' ' + lab.toLowerCase() + (o.line === 'listbill' ? ' list, or build it from Salesforce' : ' bill') + '.', kind: 'upload' });
    else if (s.sent) return;
    else if (s.reconciled) steps.push({ line: o.line, text: lab + ' is reconciled: send the bill to the group.', kind: 'send' });
    else if (s.fixes) steps.push({ line: o.line, text: lab + ': ' + s.fixes + ' to fix before it can be reconciled.', kind: 'fix' });
    else if (s.checks) steps.push({ line: o.line, text: lab + ': ' + s.checks + ' to confirm, then mark it reconciled.', kind: 'check' });
    else steps.push({ line: o.line, text: lab + ' checks out against Salesforce: mark it reconciled.', kind: 'reconcile' });
  });
  var late = v.tasks.filter(function (t) { return t.late; }).length;
  if (late) steps.push({ line: '', text: late + ' billing task' + (late === 1 ? '' : 's') + ' past target: read the Chatter and post where each stands.', kind: 'tasks' });
  else if (v.tasks.length) steps.push({ line: '', text: v.tasks.length + ' open billing task' + (v.tasks.length === 1 ? '' : 's') + ': post where each stands, or ask the person who has it.', kind: 'tasks' });
  if (v.inbox && v.inbox.mails && v.inbox.mails.length) steps.push({ line: '', text: v.inbox.mails.length + ' e-mail' + (v.inbox.mails.length === 1 ? '' : 's') + ' from the group about money in the last 60 days: make sure each was answered.', kind: 'inbox' });
  if (!steps.length) steps.push({ line: '', text: 'Everything for ' + v.monthLabel + ' is uploaded, reconciled and sent. Nothing to do here until the next bills.', kind: 'done' });
  return steps;
}

/** A bill uploaded from the page: stored, checked, and the findings returned. The browser sends the figures BillRead made;
 *  the member lines are kept on Group Bill Lines; a bill for the same group, line and month replaces the one before. */
function gblUpload_(b) {
  var who = gcmWho_(b);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(b.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  if (!gcmMine_(who, g)) return gcmNotYours_(g);
  var line = gblLine_(b.line);
  if (!line) return { ok: false, error: 'Which line: health, life or the list bill?' };
  var bill = typeof b.bill === 'string' ? gblJ_(b.bill, null) : b.bill;
  var sf = gblSf_(g, true);
  if (!bill && line === 'listbill' && gcmYes_(b.fromSalesforce)) {
    if (!sf.ok) return { ok: false, error: 'Salesforce is not linked, so the list cannot be built from it.' };
    bill = gblListFromSf_(g, sf);
    if (b.month && /^\d{4}-\d{2}$/.test(b.month)) bill.month = b.month;
  }
  if (!bill || typeof bill !== 'object') return { ok: false, error: 'Nothing was read from the file.' };
  var month = /^\d{4}-\d{2}$/.test(String(b.month || '')) ? b.month : bill.month;
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return { ok: false, error: 'The bill’s month could not be read. Choose it on the page.' };
  bill.month = month;
  /* the bill names a group: it must be this one */
  if (bill.group && g.match.length && !g.match.some(function (w) { return String(bill.group).toUpperCase().indexOf(String(w).toUpperCase()) >= 0; }) &&
      String(bill.group).toUpperCase().replace(/[^A-Z]/g, '').indexOf(g.name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)) < 0)
    return { ok: false, error: 'This bill is for "' + bill.group + '", not ' + g.name + '. Open the right group.' };
  if (bill.ref && line !== 'listbill' && g.bills.length && !g.bills.some(function (x) { return gcmBillKey_(x) === gcmBillKey_(bill.ref) || gcmBillKey_(bill.ref).indexOf(gcmBillKey_(x)) >= 0 || gcmBillKey_(x).indexOf(gcmBillKey_(bill.ref)) >= 0; }))
    gblNote_(bill, 'The bill’s reference ' + bill.ref + ' is not one of the group’s list bills on the register (' + g.bills.join(', ') + ').');
  var prev = gblPrevious_(g, line, month), today = L.today;
  var findings = gblCheck_(g, line, bill, sf, prev, today);
  var sm = gblSfMonth_(sf, line, month), rec = sm.rec;
  var members = (bill.members || []).map(function (m) {
    return { Group: g.name, Line: line, Month: month, 'Member Id': m.id || m.cert || m.policy || '', Name: m.name || '', Division: m.division || m.line || '', Tier: m.tier || m.section || '', Start: m.start || m.issue || '', Eff: m.eff || '',
      Premium: m.premium || 0, Kind: 'member', 'For month': '', Cover: line === 'life' ? JSON.stringify({ basic: m.basic, add: m.add, newLife: m.newLife }) : '' };
  }).concat((bill.credits || []).map(function (c) {
    return { Group: g.name, Line: line, Month: month, 'Member Id': c.id || '', Name: c.name || '', Division: c.division || '', Tier: c.tier || '', Start: c.start || '', Eff: c.eff || '', Premium: c.premium || 0, Kind: c.kind || 'adjust', 'For month': c.month || '', Cover: '' };
  })).concat(gblArr_(bill.adjustments).map(function (a) {
    return { Group: g.name, Line: line, Month: month, 'Member Id': a.cert || '', Name: a.name || '', Division: '', Tier: '', Start: '', Eff: a.asAt || '', Premium: a.premium || 0, Kind: a.kind || 'adjust', 'For month': '', Cover: JSON.stringify({ basic: a.basic, add: a.add, newLife: a.newLife }) };
  }));
  var same = function (r) { return gcmCodeKey_(r.Group) === g.key && gcmText_(r.Line) === line && gcmText_(r.Month) === month; };
  gblReplace_(GBL.LINES, same, members);
  var summary = gblSummary_(line, bill);
  var sfPaid = rec ? Math.max(rec.paid, sm.pays.reduce(function (s, q) { return s + q.amount; }, 0)) : 0;
  var row = { When: new Date(), Group: g.name, Line: line, Month: month, Ref: bill.ref || '', Dated: bill.dated || '', 'Due by': bill.dueBy || '', Members: bill.count || (bill.members || []).length,
    Current: bill.current || bill.gross || bill.total || 0, Adjustments: typeof bill.adjustments === 'number' ? bill.adjustments : (line === 'life' ? gblR_(gblArr_(bill.adjustments).reduce(function (s, a) { return s + a.premium; }, 0)) : 0),
    Due: bill.due || 0, 'Arrears shown': bill.outstandingTotal || 0, Payable: bill.payable || bill.due || 0,
    'SF Record': rec ? rec.name : '', 'SF Billed': rec ? rec.billed : '', 'SF Due': rec ? rec.due : '', 'SF Paid': sfPaid, Variance: rec ? gblR_(rec.billed - (bill.due || 0)) : '',
    Findings: JSON.stringify(findings).slice(0, 49000), Resolved: '{}', Status: findings.some(function (f) { return f.level === 'fix'; }) ? 'to fix' : findings.some(function (f) { return f.level === 'check'; }) ? 'to check' : 'checked',
    By: who.name, 'Checked at': gcmWhen_(new Date()), 'Reconciled at': '', 'Reconciled by': '', 'Sent at': '', Files: String(b.files || '').slice(0, 400), Summary: JSON.stringify(summary).slice(0, 49000) };
  gblReplace_(GBL.BILLS, same, [row]);
  /* the changes the bill itself shows go on the register, once each */
  gblChangesFromBill_(g, line, month, bill, findings, who);
  var stored = gblBillRows_(g).filter(function (x) { return x.line === line && x.month === month; })[0];
  return { ok: true, line: line, month: month, monthLabel: gblMonthLabel_(month), bill: stored ? gblBillOut_(stored, who) : null, steps: gblSteps_(stored), findings: findings, said: gblSaid_(findings) };
}
function gblNote_(bill, text) { bill.warnings = (bill.warnings || []).concat([text]); }
function gblSaid_(F) {
  var fix = F.filter(function (f) { return f.level === 'fix'; }).length, chk = F.filter(function (f) { return f.level === 'check'; }).length;
  return !fix && !chk ? 'Checked against Salesforce: nothing to fix.' : (fix ? fix + ' to fix' : '') + (fix && chk ? ', ' : '') + (chk ? chk + ' to confirm' : '') + '.';
}
/** What a bill is, in numbers alone: for the Group Bills row, the AI and the group's page. */
function gblSummary_(line, bill) {
  var s = { line: line, month: bill.month, ref: bill.ref || '', dated: bill.dated || '', dueBy: bill.dueBy || '', due: bill.due || 0, count: bill.count || (bill.members || []).length };
  if (line === 'health') {
    s.current = bill.current; s.adjustments = bill.adjustments; s.arrears = bill.outstandingTotal; s.payable = bill.payable;
    s.divisions = (bill.divisions || []).map(function (d) { return { name: d.name, employees: d.employees, total: d.total, tiers: d.tiers }; });
    s.credits = (bill.credits || []).length; s.cancels = (bill.credits || []).filter(function (c) { return c.kind === 'cancel'; }).length;
    var tiers = {}; (bill.members || []).forEach(function (m) { tiers[m.tier] = (tiers[m.tier] || 0) + 1; }); s.tiers = tiers;
  }
  if (line === 'life') { s.gross = bill.gross; s.totals = bill.totals; s.rates = bill.rates; s.adjustments = gblArr_(bill.adjustments).length; s.left = gblArr_(bill.adjustments).filter(function (a) { return a.kind === 'left'; }).length; s.joined = gblArr_(bill.adjustments).filter(function (a) { return a.kind === 'joined'; }).length; }
  if (line === 'listbill') { s.subtotals = bill.subtotals || {}; s.source = bill.source || 'upload'; }
  return s;
}
/** The joiners, leavers and back-charges a bill shows, onto Group Changes, once per person, line and month. */
function gblChangesFromBill_(g, line, month, bill, findings, who) {
  var have = gblChanges_(g), rows = [];
  /* once per person and kind within a quarter: the same joiner shows on the bill, its credits and the statement */
  var near = function (eff) { var m = gcmText_(eff).slice(0, 7); return !m || (m >= gblAddMonths_(month, -3) && m <= gblAddMonths_(month, 3)); };
  var has = function (kind, member) { return have.some(function (c) { return c.line === line && c.kind === kind && near(c.effective) && gblSamePerson_(c.member, member); }) || rows.some(function (r) { return r.Kind === kind && gblSamePerson_(r.Member, member); }); };
  findings.forEach(function (f) {
    if (f.kind === 'joined' || f.kind === 'left') (f.members || []).forEach(function (m) {
      var kind = f.kind === 'joined' ? 'joiner' : 'leaver';
      if (!has(kind, m.name)) rows.push({ When: new Date(), Group: g.name, Line: line, Kind: kind, Member: m.name, Detail: (kind === 'joiner' ? 'On the bill from ' + gblMonthLabel_(month) : 'Off the bill from ' + gblMonthLabel_(month)) + (m.tier ? ' as ' + m.tier : '') + (m.premium ? ', ' + gcmMoney_(m.premium) : ''), Effective: m.start || month + '-01', Amount: m.premium || 0, Source: 'bill', By: who.name, Status: 'noted', 'SF Task': '', 'SF Id': '', Note: '' });
    });
  });
  (bill.credits || []).forEach(function (c) {
    var kind = c.kind === 'cancel' ? 'leaver' : 'joiner';
    if (!has(kind, c.name)) rows.push({ When: new Date(), Group: g.name, Line: line, Kind: kind, Member: c.name, Detail: (c.kind === 'cancel' ? 'Taken off ' : 'Charged for ') + gblMonthLabel_(c.month) + (c.tier ? ' as ' + c.tier : '') + ' on the ' + gblMonthLabel_(month) + ' bill, ' + gcmMoney_(c.premium), Effective: (c.month || month) + '-01', Amount: c.premium, Source: 'bill', By: who.name, Status: 'noted', 'SF Task': '', 'SF Id': '', Note: '' });
  });
  gblArr_(bill.adjustments).forEach(function (a) {
    var kind = a.kind === 'left' ? 'leaver' : a.kind === 'joined' ? 'joiner' : 'cover';
    if (!has(kind, a.name)) rows.push({ When: new Date(), Group: g.name, Line: line, Kind: kind, Member: a.name, Detail: (a.kind === 'left' ? 'Terminated' : a.kind === 'joined' ? 'Added' : 'Cover changed') + (a.asAt ? ' as at ' + tDmy_(a.asAt) : '') + ' on the ' + gblMonthLabel_(month) + ' statement, ' + gcmMoney_(a.premium), Effective: a.asAt || month + '-01', Amount: a.premium, Source: 'bill', By: who.name, Status: 'noted', 'SF Task': '', 'SF Id': '', Note: '' });
  });
  gblAppend_(GBL.CHANGES, rows);
}

/** An action on a stored bill: set the Salesforce amount, mark reconciled, resolve a finding, record a payment, open a
 *  task for a change, or post a note on a billing task. Each Salesforce write is a signed-in person's press, logged. */
function gblAct_(b) {
  var who = gcmWho_(b);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(b.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  var act = String(b.act || ''), line = gblLine_(b.line), month = String(b.month || '');
  if (act === 'note') return gblNoteTask_(g, who, b);
  if (act !== 'comment' && !gcmMine_(who, g)) return gcmNotYours_(g);
  var bill = gblBillRows_(g).filter(function (x) { return x.line === line && x.month === month; })[0];
  var sf = gblSf_(g);
  var log = function (kind, member, detail, amount, sfId, status) {
    gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: line, Kind: kind, Member: member || '', Detail: detail, Effective: month ? month + '-01' : '', Amount: amount || 0, Source: 'staff', By: who.name, Status: status || 'done', 'SF Task': '', 'SF Id': sfId || '', Note: '' }]);
  };
  if (act === 'resolve') {
    if (!bill) return { ok: false, error: 'No bill is stored for that month.' };
    var f = bill.findings.filter(function (x) { return x.id === b.finding; })[0];
    if (!f) return { ok: false, error: 'Which finding?' };
    var why = String(b.note || '').trim().slice(0, 500);
    if (!why) return { ok: false, error: 'Say why it is resolved, or what was done.' };
    bill.resolved[f.id] = { by: who.name, at: gcmWhen_(new Date()), note: why };
    gblBillPatch_(bill, { Resolved: JSON.stringify(bill.resolved).slice(0, 49000), Status: gblSteps_(bill).open ? bill.status : 'checked' });
    return { ok: true, steps: gblSteps_(bill), resolved: bill.resolved };
  }
  if (act === 'sfAmount') {
    if (!bill) return { ok: false, error: 'No bill is stored for that month.' };
    if (!sf.ok) return { ok: false, error: 'Salesforce is not linked.' };
    var rec = gblSfMonth_(sf, line, month).rec;
    if (!rec) return { ok: false, error: 'There is no Salesforce billing record for that month to set. Create it in Salesforce first.' };
    var body = { Group_Billing_Premiums__c: bill.due };
    if (line === 'health' && bill.summary && bill.summary.divisions && bill.summary.divisions.length > 1) body.Premium_Due__c = bill.summary.divisions[0].total;
    try { tSfSend_('patch', '/sobjects/TRANSACTIONS__c/' + rec.id, body); } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 200) }; }
    log('salesforce', '', 'Group Billing Premiums on ' + rec.name + ' set to ' + gcmMoney_(bill.due) + ' (was ' + gcmMoney_(rec.billed) + ')', bill.due, rec.id);
    gblSf_(g, true);
    var F2 = gblCheck_(g, line, gblRebuild_(g, bill), gblSf_(g), gblPrevious_(g, line, month), L.today);
    bill.findings = F2; gblBillPatch_(bill, { Findings: JSON.stringify(F2).slice(0, 49000), 'SF Billed': bill.due, Variance: 0, Status: gblSteps_(bill).open ? bill.status : 'checked' });
    return { ok: true, said: 'Salesforce now has ' + gcmMoney_(bill.due) + ' for ' + gblMonthLabel_(month) + '.', findings: F2, steps: gblSteps_(bill) };
  }
  if (act === 'reconciled') {
    if (!bill) return { ok: false, error: 'No bill is stored for that month.' };
    var st = gblSteps_(bill);
    if (st.fixes && !gcmYes_(b.force)) return { ok: false, error: st.fixes + ' finding' + (st.fixes === 1 ? '' : 's') + ' marked “fix” ' + (st.fixes === 1 ? 'is' : 'are') + ' still open. Fix or resolve each one first.' };
    var rec2 = sf.ok ? gblSfMonth_(sf, line, month).rec : null, sfNote = '';
    if (rec2) { try { tSfSend_('patch', '/sobjects/TRANSACTIONS__c/' + rec2.id, { Reconciled__c: true }); sfNote = 'Salesforce record ' + rec2.name + ' marked Reconciled.'; } catch (e) { sfNote = 'Salesforce would not take the Reconciled tick: ' + String(e && e.message ? e.message : e).slice(0, 120); } }
    var posted = gblPostBilling_(g, line, month, 'Reconciled the ' + gblMonthLabel_(month) + ' ' + GBL.LABEL[line].toLowerCase() + ' bill (' + gcmMoney_(bill.due) + ', ' + bill.members + ' members) against Salesforce. ' + gblSaid_(bill.findings.filter(function (x) { return !bill.resolved[x.id]; })) + (b.note ? ' ' + String(b.note).slice(0, 600) : ''), who);
    gblBillPatch_(bill, { Status: 'reconciled', 'Reconciled at': gcmWhen_(new Date()), 'Reconciled by': who.name });
    log('reconciled', '', GBL.LABEL[line] + ' ' + gblMonthLabel_(month) + ' reconciled. ' + sfNote, bill.due, rec2 ? rec2.id : '');
    return { ok: true, said: 'Reconciled. ' + sfNote + (posted ? ' Noted on the billing task’s Chatter.' : ''), steps: gblSteps_(gblBillRows_(g).filter(function (x) { return x.line === line && x.month === month; })[0]) };
  }
  if (act === 'payment') {
    var amount = Number(b.amount), paidOn = gcmYmd_(b.paidOn || ''), method = String(b.method || '').slice(0, 40), forMonth = /^\d{4}-\d{2}$/.test(String(b.forMonth || '')) ? b.forMonth : month;
    if (!amount || !paidOn) return { ok: false, error: 'The amount and the date paid are needed.' };
    var rec3 = sf.ok ? gblSfMonth_(sf, line, forMonth).rec : null, made = '';
    if (rec3 && gcmYes_(b.toSalesforce)) {
      try {
        var res = tSfSend_('post', '/sobjects/Payments__c', { PMTS__c: rec3.id, Payment_Made__c: amount, Date_Paid__c: paidOn, Payment_Type__c: method || null, Bank__c: String(b.bank || '') || null,
          Renewal_Date__c: forMonth + '-01', Policy__c: String(b.ref || g.bills[0] || '').slice(0, 80), Transaction_Record_Type__c: GBL.RT[line].replace(/[\s-]+/g, '_').replace(/^_/, '').toUpperCase().replace('T_PENSIONS_GROUP', 'T_PENSIONS_GROUP') });
        made = String(res.id || '');
      } catch (e) { return { ok: false, error: 'Salesforce would not take the payment: ' + String(e && e.message ? e.message : e).slice(0, 200) }; }
    }
    log('payment', '', gcmMoney_(amount) + ' paid ' + tDmy_(paidOn) + (method ? ' by ' + method : '') + ' for ' + gblMonthLabel_(forMonth) + (made ? ', recorded in Salesforce' : ', noted here' + (rec3 ? '' : ' (no billing record for that month in Salesforce)')), amount, made);
    gblPostBilling_(g, line, forMonth, 'Payment of ' + gcmMoney_(amount) + ' received ' + tDmy_(paidOn) + (method ? ' by ' + method : '') + ' for ' + gblMonthLabel_(forMonth) + (made ? '; keyed on Payments.' : '.') + (b.note ? ' ' + String(b.note).slice(0, 400) : ''), who);
    if (made) gblSf_(g, true);
    return { ok: true, said: made ? 'Payment recorded in Salesforce and noted on the task.' : 'Payment noted on the register and the task.' + (rec3 ? '' : ' There is no Salesforce billing record for that month to key it against.') };
  }
  if (act === 'change') return gblChange_(g, who, line, b, 'staff');
  if (act === 'task') return gblTaskOpen_(g, who, line, month, b);
  return { ok: false, error: 'Unknown action.' };
}
function gblBillPatch_(bill, fields) {
  var sh = gblSheet_(GBL.BILLS), head = GBL_HEAD[GBL.BILLS];
  Object.keys(fields).forEach(function (h) { var c = head.indexOf(h); if (c >= 0) sh.getRange(bill._n, c + 1).setValue(fields[h]); });
}
/** The stored bill as the checks want it, from its summary and lines (the PDF is not kept). */
function gblRebuild_(g, bill) {
  var lines = gblLines_(g, bill.line, bill.month), s = bill.summary || {};
  var out = { kind: bill.line, line: bill.line, month: bill.month, ref: bill.ref, dated: bill.dated, dueBy: bill.dueBy, due: bill.due, count: bill.members, warnings: [],
    members: lines.filter(function (l) { return l.kind === 'member'; }).map(function (l) { return { id: l.id, cert: l.id, policy: l.id, name: l.name, division: l.division, tier: l.tier, start: l.start, eff: l.eff, premium: l.premium, line: l.division }; }),
    credits: lines.filter(function (l) { return l.kind === 'cancel' || l.kind === 'adjust'; }).map(function (l) { return { id: l.id, name: l.name, division: l.division, tier: l.tier, kind: l.kind, month: l.forMonth, premium: l.premium }; }),
    adjustments: lines.filter(function (l) { return l.kind === 'left' || l.kind === 'joined' || l.kind === 'cover'; }).map(function (l) { var c = l.cover || {}; return { cert: l.id, name: l.name, kind: l.kind, asAt: l.eff, premium: l.premium, periods: 1, basic: c.basic, add: c.add, newLife: c.newLife }; }),
    divisions: s.divisions || [], current: s.current || 0, adjustmentsTotal: s.adjustments, outstanding: [], outstandingTotal: bill.arrears, payable: bill.payable, gross: s.gross, totals: s.totals, rates: s.rates, offRate: [], reportDays: null, subtotals: s.subtotals };
  if (bill.line === 'health') out.adjustments = s.adjustments || 0;
  return out;
}
/** A note onto the Chatter of the line's open billing task for the month (else the line's newest open billing task, else
 *  the group's newest billing task). Returns true when posted. */
function gblPostBilling_(g, line, month, text, who) {
  if (!tSfOn_()) return false;
  var t = gblTaskFor_(g, line, month);
  if (!t) return false;
  try { tSfSend_('post', '/sobjects/FeedItem', { ParentId: t.id, Body: 'Billing review by ' + gcmSigner_(who, g) + ' (group client management):\n' + text }); return true; } catch (e) { return false; }
}
function gblTaskFor_(g, line, month) {
  var mm = /^(\d{4})-(\d{2})$/.exec(month || ''), mdy = mm ? Number(mm[2]) + '/1/' + mm[1] : '';
  var billing = g.tasks.filter(gblIsBillingTask_), ofLine = billing.filter(function (t) { return !line || gblLineOfRt_(t.subject) === line; });
  var exact = ofLine.filter(function (t) { return t.open && mdy && t.subject.indexOf(mdy) >= 0; })[0];
  return exact || ofLine.filter(function (t) { return t.open; }).sort(function (a, b) { return a.opened < b.opened ? 1 : -1; })[0] || billing.filter(function (t) { return t.open; })[0] || null;
}
/** A comment from the review page onto a task's Chatter: for the team (never shown), or a note the group reads, through
 *  the sharing rules GroupClients.gs keeps. */
/** A change a person reports: a joiner, a leaver, a tier change, a query. Filed on Group Changes; a joiner or leaver opens
 *  a Salesforce task for the account owner, in the branch's own subject pattern; the note goes on the line's billing task. */
function gblChange_(g, who, line, b, source) {
  var kind = String(b.kind || '').toLowerCase(), member = String(b.member || '').trim().slice(0, 120), detail = String(b.detail || '').trim().slice(0, 800), eff = gcmYmd_(b.effective || '') || '';
  if (['joiner', 'leaver', 'tier', 'query', 'dependent'].indexOf(kind) < 0) return { ok: false, error: 'What kind of change: a joiner, a leaver, a tier change, a dependent, or a question?' };
  if (kind !== 'query' && !member) return { ok: false, error: 'Whose change is it? Give the person’s name.' };
  if (kind === 'query' && !detail) return { ok: false, error: 'Write the question first.' };
  var lab = GBL.LABEL[line] || 'Billing', taskId = '', taskNote = '';
  if (tSfOn_() && kind !== 'query') {
    var ownerId = gblOwnerId_(g), acct = (g.acctsFull || g.accts)[0] || null;
    var subj = (kind === 'leaver' ? lab + ' Termination – ' : kind === 'joiner' ? lab + ' Member Enrolment – ' : kind === 'dependent' ? lab + ' Dependent Change – ' : lab + ' Tier Change – ') + member + ' – ' + g.name + (eff ? ' – effective ' + tDmy_(eff) : '');
    var rec = { Subject: subj.slice(0, 255), WhatId: acct, ActivityDate: gcmAddDays_(gcmToday_(), 2), Status: 'Not Started', Priority: 'Normal',
      Description: (source === 'client' ? 'Reported by the group on their service page' : 'Recorded by ' + who.name + ' on the billing review') + (b.name ? ' (' + String(b.name).slice(0, 80) + ')' : '') + '.\n' + detail };
    if (ownerId) rec.OwnerId = ownerId;
    try { var res = tSfSend_('post', '/sobjects/Task', Object.assign({ Task_Type__c: 'Servicing' }, rec)); taskId = String(res.id || ''); }
    catch (e) { try { var res2 = tSfSend_('post', '/sobjects/Task', rec); taskId = String(res2.id || ''); } catch (e2) { taskNote = 'Salesforce task not opened: ' + String(e2 && e2.message ? e2.message : e2).slice(0, 120); } }
  }
  gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: line, Kind: kind, Member: member, Detail: detail, Effective: eff, Amount: Number(b.amount) || 0, Source: source, By: source === 'client' ? String(b.name || 'the group').slice(0, 80) : who.name,
    Status: 'open', 'SF Task': taskId, 'SF Id': '', Note: taskNote }]);
  var posted = gblPostBilling_(g, line, gblMonthOf_(eff) || gcmToday_().slice(0, 7), (source === 'client' ? 'From ' + g.name + ' on their service page' + (b.name ? ' (' + String(b.name).slice(0, 80) + ')' : '') : 'Recorded by ' + who.name) + ': ' +
    (kind === 'query' ? 'question about billing. ' : kind + (member ? ' ' + member : '') + (eff ? ', effective ' + tDmy_(eff) : '') + '. ') + detail + (taskId ? ' Task opened.' : ''), who);
  return { ok: true, task: taskId, posted: posted, said: (kind === 'query' ? 'Your question is with our team.' : 'Noted' + (taskId ? ', and a task is open for our team' : '') + '.') + (taskNote ? ' ' + taskNote : '') };
}
/** The account owner's Salesforce user id: a standard, active user with the owner's e-mail (the branch manager's address is
 *  also on site guest users, which must never own a task). */
function gblOwnerId_(g) {
  if (!g.ownerEmail || !tSfOn_()) return '';
  try { var u = gcmQuery_("SELECT Id FROM User WHERE IsActive = true AND UserType = 'Standard' AND Email = '" + svcSoqlLit_(g.ownerEmail) + "' LIMIT 1")[0]; return u ? String(u.Id) : ''; } catch (e) { return ''; }
}

/* ── opening a task, and telling its owner ──────────────────────────────────────────── */
/* 24 October 2026, after the first sample: "can the person open a task? and assign to the owner with guided prompts?".
 * A task can be opened from any finding, from a line, or from the foot of the review, for the account owner by default or
 * for anyone on the team with a Salesforce login; the page guides what to say (its kinds, prompts and [blanks] are in
 * billing-ui.js), and the backend refuses a [blank] left in. The person is told by e-mail from support@. A comment on a
 * task can @mention its owner through Connect and e-mail them too, so a question reaches the person who has it. */
var GBL_TASK = { DUE_DAYS: 2, MIN_TEXT: 20, CACHE_S: 600, KINDS: ['joiner', 'leaver', 'tier', 'dependent', 'payment', 'amount', 'backcharge', 'rate', 'group', 'other'],
  CHANGE: { joiner: 'joiner', leaver: 'leaver', tier: 'tier', dependent: 'dependent' }, ROLES: ['staff', 'abm', 'bm', 'um'] };
/** Who a task can go to: the account's owner in Salesforce first, then everyone on the Agent Skill Bank who is staff or a
 *  manager and has an active Salesforce login, resolved by e-mail. Never an agent, never a site guest user. */
function gblPeople_(g, who) {
  var want = {}, order = [];
  var add = function (email, name, owner) { email = String(email || '').toLowerCase().trim(); if (!email || want[email]) return; want[email] = { name: name, owner: !!owner }; order.push(email); };
  if (g.ownerEmail) add(g.ownerEmail, g.assigned, true);
  try { tTeam_().people.forEach(function (p) { if (p.active && p.email && GBL_TASK.ROLES.indexOf(p.role) >= 0) add(p.email, gblTitle_(p.name)); }); } catch (e) {}
  var users = gblUsersByEmail_(order), me = String(who && who.email || '').toLowerCase(), out = [];
  order.forEach(function (e) { if (!users[e]) return; out.push({ id: users[e].id, name: want[e].name || users[e].name, email: e, owner: want[e].owner, me: e === me }); });
  out.sort(function (a, b) { return (b.owner - a.owner) || (b.me - a.me) || a.name.localeCompare(b.name); });
  return out;
}
function gblTitle_(n) { n = String(n || '').trim(); return n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[\s'-])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); }) : n; }
/** Active standard Salesforce users by e-mail (lower case), kept ten minutes. */
function gblUsersByEmail_(emails) {
  var out = {}, want = emails.map(function (e) { return String(e || '').toLowerCase(); }).filter(String);
  if (!want.length || !tSfOn_()) return out;
  var joined = want.slice().sort().join('|'), h = 5381;
  for (var i = 0; i < joined.length; i++) h = ((h * 33) ^ joined.charCodeAt(i)) >>> 0;
  var cache = null, key = 'gbl_users_' + want.length + '_' + h.toString(36);
  try { cache = CacheService.getScriptCache(); var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  try {
    gcmQuery_("SELECT Id, Name, Email FROM User WHERE IsActive = true AND UserType = 'Standard' AND Email IN (" + gcmIn_(want) + ')').forEach(function (u) {
      var e = String(u.Email || '').toLowerCase(); if (e && !out[e]) out[e] = { id: String(u.Id), name: String(u.Name || '') };
    });
    try { if (cache) cache.put(key, JSON.stringify(out), GBL_TASK.CACHE_S); } catch (e2) {}
  } catch (e3) {}
  return out;
}
function gblBlank_(s) { return /\[[^\]\n]{1,40}\]/.test(String(s || '')); }
function gblSfUrl_(id) { if (!id) return ''; try { return svcSfToken_().instance_url + '/' + id; } catch (e) { return ''; } }
/** Opens a Salesforce task from the billing review for the person chosen (the account owner by default), with the subject in
 *  the branch's pattern and what the person needs to know; logs it on Group Changes (as the enrolment or termination it
 *  records, when it is one), notes it on the line's billing task, resolves the finding it came from, and e-mails the person. */
function gblTaskOpen_(g, who, line, month, b) {
  var kind = String(b.kind || 'other').toLowerCase();
  if (GBL_TASK.KINDS.indexOf(kind) < 0) return { ok: false, error: 'What is the task about? Pick one of the kinds.' };
  var subject = String(b.subject || '').replace(/\s+/g, ' ').trim().slice(0, 255), text = String(b.text || '').trim().slice(0, 4000);
  if (!subject) return { ok: false, error: 'The task needs a subject.' };
  if (gblBlank_(subject) || gblBlank_(text)) return { ok: false, error: 'Fill in every [blank] before the task is opened.' };
  if (text.replace(/\s+/g, ' ').length < GBL_TASK.MIN_TEXT) return { ok: false, error: 'Say what the person needs to know: who, what, the month and the amount, and what you want done.' };
  var today = gcmToday_(), due = gcmYmd_(b.due || '') || gcmAddDays_(today, GBL_TASK.DUE_DAYS);
  if (due < today) return { ok: false, error: 'The due date is in the past.' };
  var priority = /^high$/i.test(String(b.priority || '')) ? 'High' : 'Normal';
  if (!tSfOn_()) return { ok: false, error: 'Salesforce is not linked to this project, so no task can be opened.' };
  var people = gblPeople_(g, who), to = String(b.to || 'owner');
  var person = people.filter(function (p) { return to === 'owner' ? p.owner : to === 'me' ? p.me : p.id === to; })[0] || null;
  if (!person && to === 'owner') return { ok: false, error: (g.assigned || 'The account owner') + ' has no active Salesforce login, so the task cannot go to them. Pick someone else.' };
  if (!person) return { ok: false, error: 'Who should act on it? Pick a person from the list.' };
  var acct = (g.acctsFull || g.accts)[0] || null, member = String(b.member || '').trim().slice(0, 120), eff = gcmYmd_(b.effective || '') || '';
  var head = 'Opened by ' + who.name + ' from the ' + gblMonthLabel_(month) + ' ' + (GBL.LABEL[line] || 'billing').toLowerCase() + ' review' + (b.finding ? ', on a finding the check raised' : '') + '.';
  var rec = { Subject: subject, WhatId: acct, OwnerId: person.id, ActivityDate: due, Status: 'Not Started', Priority: priority, Description: head + '\n\n' + text }, taskId = '';
  try { var res = tSfSend_('post', '/sobjects/Task', Object.assign({ Task_Type__c: 'Servicing' }, rec)); taskId = String(res.id || ''); }
  catch (e) { try { var res2 = tSfSend_('post', '/sobjects/Task', rec); taskId = String(res2.id || ''); } catch (e2) { return { ok: false, error: 'Salesforce would not open the task: ' + String(e2 && e2.message ? e2.message : e2).slice(0, 160) }; } }
  gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: line, Kind: GBL_TASK.CHANGE[kind] || 'task', Member: member, Detail: subject + ' — ' + text.slice(0, 500), Effective: eff, Amount: Number(b.amount) || 0,
    Source: 'staff', By: who.name, Status: 'open', 'SF Task': taskId, 'SF Id': '', Note: 'for ' + person.name + ', due ' + tDmy_(due) }]);
  var bt = gblTaskFor_(g, line, month), posted = false;
  if (bt && gcmId15_(bt.id) !== gcmId15_(taskId)) posted = gblPostBilling_(g, line, month, 'Task opened for ' + person.name + ', due ' + tDmy_(due) + ': ' + subject, who);
  var bill = gblBillRows_(g).filter(function (x) { return x.line === line && x.month === month; })[0], f = null;
  if (bill && b.finding) {
    f = bill.findings.filter(function (x) { return x.id === b.finding; })[0];
    if (f) { bill.resolved[f.id] = { by: who.name, at: gcmWhen_(new Date()), note: 'Task opened for ' + person.name + ', due ' + tDmy_(due) + (taskId ? ' (' + taskId + ')' : '') }; gblBillPatch_(bill, { Resolved: JSON.stringify(bill.resolved).slice(0, 49000), Status: gblSteps_(bill).open ? bill.status : 'checked' }); }
  }
  var told = !person.me && gblTaskMail_(g, who, person, subject, text, due, priority, taskId);
  return { ok: true, task: taskId, url: gblSfUrl_(taskId), to: person.name, told: !!told, resolved: !!f,
    said: 'Task opened for ' + person.name + ', due ' + tDmy_(due) + (told ? '; they have it by e-mail' : '') + (posted ? '; noted on the billing task' : '') + '.' };
}
function gblInternalMail_(to, subject, html, replyTo) {
  try { if (tMsCreds_()) { tMsSend_(to, subject, html, { replyTo: replyTo || TRANSITION.MS_FROM }); return true; } } catch (e) {}
  try { MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'Ricky Rampersad Branch' }); return true; } catch (e2) { return false; }
}
function gblTaskMail_(g, who, person, subject, text, due, priority, taskId) {
  if (!person.email) return false;
  var url = gblSfUrl_(taskId), first = String(person.name || '').split(' ')[0];
  var body = '<p>' + tEsc_(first) + ', <b>' + tEsc_(who.name) + '</b> has opened a task for you on <b>' + tEsc_(g.name) + '</b>' + (priority === 'High' ? ' (<b>high priority</b>)' : '') + ', due <b>' + tEsc_(tDmy_(due)) + '</b>:</p>' +
    '<p style="font-size:16px"><b>' + tEsc_(subject) + '</b></p><div style="background:#fff;border:1px solid #e2e7ef;border-left:4px solid #13408F;border-radius:10px;padding:11px 15px;white-space:pre-wrap">' + tEsc_(text) + '</div>' +
    (url ? '<p><a href="' + url + '" style="display:inline-block;background:#1d5bc4;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px">Open the task</a></p>' : '') +
    '<p>Answer on the task’s Chatter: what you will do, and by when. It is also on the group’s billing review in <a href="' + GCM.SITE + '">group client management</a>.</p><p style="color:#777;font-size:12px">' + tEsc_(tInternal_(null)) + '</p>';
  return gblInternalMail_(person.email, who.name + ' opened a task for you · ' + subject.slice(0, 80), body, who.email);
}
/** A comment for the team that also reaches the task's owner: posted through Connect with an @mention, so Salesforce tells
 *  them, and e-mailed from support@. A plain comment when the mention is refused; nothing twice. */
function gblNoteTask_(g, who, b) {
  var kind = gcmYes_(b.forGroup) ? 'note' : 'comment';
  if (kind !== 'comment' || !gcmYes_(b.notify)) return gcmShare_({ code: b.code, who: b.who, group: b.group, kind: kind, task: b.task, text: b.text });
  var t = g.tasks.filter(function (x) { return x.id15 === gcmId15_(b.task); })[0], said = String(b.text || '').trim().slice(0, 2000);
  if (!t) return { ok: false, error: 'That item is not on this group.' };
  if (!said) return { ok: false, error: 'Write the comment first.' };
  if (!tSfOn_()) return { ok: false, error: 'Salesforce is not linked to this project, so the comment cannot go onto the task.' };
  var o = gblTaskOwner_(t.id), id = '';
  if (o && o.id) {
    try { var res = tSfSend_('post', '/chatter/feed-elements', { feedElementType: 'FeedItem', subjectId: t.id, body: { messageSegments: [{ type: 'Text', text: 'Comment for the team from ' + who.name + ' (not shown to the group): ' }, { type: 'Mention', id: o.id }, { type: 'Text', text: '\n' + said }] } }); id = String(res.id || ''); } catch (e) {}
  }
  if (id) gcmAppend_(GCM.SHARES, [{ When: new Date(), Group: g.name, 'Task Id': t.id, Kind: 'comment', Value: id, By: who.name }]);
  else { var plain = gcmShare_({ code: b.code, who: b.who, group: b.group, kind: 'comment', task: b.task, text: said }); if (!plain.ok) return plain; }
  var told = !!(o && o.email && String(o.email).toLowerCase() !== String(who.email || '').toLowerCase()) && gblCommentMail_(g, who, o, t, said);
  return { ok: true, mentioned: !!id, told: !!told, said: 'Posted to the task’s Chatter' + (id ? ', with ' + (o.name || 'its owner') + ' mentioned' : '') + (told ? ', and e-mailed to them' : '') + '.' };
}
function gblTaskOwner_(id) {
  try { var u = gcmQuery_("SELECT OwnerId, Owner.Name, Owner.Email FROM Task WHERE Id = '" + svcSoqlLit_(id) + "' LIMIT 1")[0]; return u ? { id: String(u.OwnerId || ''), name: u.Owner && u.Owner.Name ? String(u.Owner.Name) : '', email: u.Owner && u.Owner.Email ? String(u.Owner.Email) : '' } : null; } catch (e) { return null; }
}
function gblCommentMail_(g, who, o, t, said) {
  var url = gblSfUrl_(t.id), first = String(o.name || '').split(' ')[0];
  var body = '<p>' + tEsc_(first) + ', <b>' + tEsc_(who.name) + '</b> wrote on your task <b>' + tEsc_(t.subject) + '</b> (' + tEsc_(g.name) + '):</p>' +
    '<div style="background:#fff;border:1px solid #e2e7ef;border-left:4px solid #13408F;border-radius:10px;padding:11px 15px;white-space:pre-wrap">' + tEsc_(said) + '</div>' +
    (url ? '<p><a href="' + url + '" style="display:inline-block;background:#1d5bc4;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px">Open the task</a></p>' : '') +
    '<p>Answer on the task’s Chatter: what you will do, and by when.</p><p style="color:#777;font-size:12px">' + tEsc_(tInternal_(null)) + '</p>';
  return gblInternalMail_(o.email, who.name + ' on your task · ' + String(t.subject || '').slice(0, 70), body, who.email);
}

/** The bill to the group: from support@, the PDFs attached, a cover note with the figures, what changed, how to pay and
 *  their page; copied to sales support; logged on Group Sends as a bill, never as the weekly letter. Until GCM_BILL_LIVE
 *  is set it goes to the staff member and the branch alone, marked TEST. */
function gblSend_(b) {
  var who = gcmWho_(b);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(b.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  if (!gcmMine_(who, g)) return gcmNotYours_(g);
  var month = String(b.month || '');
  var lines = String(b.lines || 'health,life,listbill').split(',').map(gblLine_).filter(String);
  var bills = gblBillRows_(g).filter(function (x) { return x.month === month && lines.indexOf(x.line) >= 0; });
  if (!bills.length) return { ok: false, error: 'No bill is stored for ' + gblMonthLabel_(month) + '.' };
  var notRec = bills.filter(function (x) { return !x.reconciledAt; });
  if (notRec.length && !gcmYes_(b.force)) return { ok: false, error: notRec.map(function (x) { return GBL.LABEL[x.line]; }).join(' and ') + ' ' + (notRec.length === 1 ? 'is' : 'are') + ' not reconciled yet. Reconcile first, so nothing goes to the group that a person has not checked.' };
  var why = gcmCannotMail_(g);
  if (why) return { ok: false, error: 'Cannot send: ' + why + '.' };
  if (!tMsCreds_()) return { ok: false, error: 'Microsoft 365 is not set up on this project, so nothing can go from support@.' };
  var live = gblLive_(), test = !live;
  var to = test ? [who.email || gcmDayManager_()].filter(String) : g.to.slice(0, 1);
  if (!to.length) return { ok: false, error: 'No address to send the test to: your e-mail is not on the Agent Skill Bank.' };
  var cc = test ? (TRANSITION.CC || []).slice() : gcmCc_(g);
  var files = Array.isArray(b.attachments) ? b.attachments : [];
  var blobs = [];
  files.slice(0, 6).forEach(function (f) {
    try { var bytes = Utilities.base64Decode(String(f.b64 || '')); if (bytes.length && bytes.length < 3000000) blobs.push(Utilities.newBlob(bytes, String(f.type || 'application/pdf'), String(f.name || 'bill.pdf').replace(/[^\w.\- ]/g, '_').slice(0, 80))); } catch (e) {}
  });
  var mail = gblBillMail_(g, month, bills, who, test, L);
  try { tMsSend_(to[0], (test ? '[TEST] ' : '') + mail.subject, mail.html, { cc: cc.concat(to.slice(1)), attachments: blobs, replyTo: TRANSITION.MS_FROM }); }
  catch (e) { return { ok: false, error: 'Not sent: ' + String(e && e.message ? e.message : e).slice(0, 200) }; }
  var at = gcmWhen_(new Date());
  gcmAppend_(GCM.SENDS, [{ When: new Date(), Group: g.name, Staff: gcmSigner_(who, g), To: to.join(', '), Cc: cc.join(', '), Subject: mail.subject, Items: bills.length, 'Task Ids': bills.map(function (x) { return x.line + ':' + x.month; }).join(' '),
    Letter: mail.text.slice(0, 40000), Via: 'support@' + (blobs.length ? ', ' + blobs.length + ' file' + (blobs.length === 1 ? '' : 's') : ''), Status: test ? 'bill test' : 'bill sent', Html: gcmKeepHtml_(mail.html) }]);
  if (!test) bills.forEach(function (x) { gblBillPatch_(x, { 'Sent at': at, Status: 'sent' }); });
  bills.forEach(function (x) { gblPostBilling_(g, x.line, month, (test ? 'TEST of the ' : 'The ') + gblMonthLabel_(month) + ' ' + GBL.LABEL[x.line].toLowerCase() + ' bill ' + (test ? 'was sent to ' + to.join(', ') : 'was sent to the group (' + to.join(', ') + ')') + ' from support@' + (blobs.length ? ' with the PDF attached' : '') + '.', who); });
  return { ok: true, test: test, to: to, at: at, said: test ? 'Test sent to ' + to.join(', ') + '. Nothing went to the group: run gblGoLive from the editor when the branch is ready.' : 'Sent to ' + to.join(', ') + ' from support@ at ' + at + '.' };
}
function gblLive_() { try { return !!PropertiesService.getScriptProperties().getProperty(GBL.LIVE_PROP); } catch (e) { return false; } }
/** The editor's Run button (the branch manager): from now on a bill sent from the review page goes to the group. */
function gblGoLive() { PropertiesService.getScriptProperties().setProperty(GBL.LIVE_PROP, gcmWhen_(new Date())); return tSay_('Bills sent from the billing review now go to the groups, from support@, copied to sales support. gblStop ends that.'); }
function gblStop() { PropertiesService.getScriptProperties().deleteProperty(GBL.LIVE_PROP); return tSay_('Bills now go only to the staff member and the branch, marked TEST.'); }
/** The cover note: the figures per line, what changed, how to pay, their page. Tables and inline styles, so any mail app shows it. */
function gblBillMail_(g, month, bills, who, test, L) {
  var E = tEsc_, label = gblMonthLabel_(month), signer = gcmSigner_(who, g), total = gblR_(bills.reduce(function (s, x) { return s + x.due; }, 0));
  var changes = gblChanges_(g).filter(function (c) { return c.source === 'bill' && gcmText_(c.effective).slice(0, 7) >= gblAddMonths_(month, -2) && (c.kind === 'joiner' || c.kind === 'leaver'); });
  var dueBy = bills.map(function (x) { return x.dueBy; }).filter(String).sort()[0] || '';
  var lineRows = bills.map(function (x) {
    var what = GBL.LABEL[x.line] + (x.ref ? ' (' + x.ref + ')' : '');
    var extra = x.line === 'health' && x.summary && x.summary.divisions ? x.summary.divisions.map(function (d) { return d.name.replace(new RegExp(g.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(/^[\s\-–]+/, '') + ': ' + d.employees + ' employees'; }).join('; ') : x.members ? x.members + ' ' + (x.line === 'listbill' ? 'policies' : 'members') : '';
    return { what: what, extra: extra, due: x.due, arrears: x.arrears };
  });
  var subject = 'Your ' + label + ' billing: ' + g.name + ' (' + gcmMoney_(total) + ')';
  var greet = 'Dear ' + (g.greeting || 'Sir or Madam') + ',';
  var paras = ['Please find attached your ' + label + ' billing' + (bills.length > 1 ? 's' : '') + ' for ' + bills.map(function (x) { return GBL.LABEL[x.line].toLowerCase(); }).join(', ').replace(/, ([^,]*)$/, ' and $1') + '. The total due is ' + gcmMoney_(total) + (dueBy ? ', payable by ' + tDmy_(dueBy) : '') + '.'];
  var arrears = bills.filter(function (x) { return x.arrears > 0; });
  if (arrears.length) paras.push('The ' + arrears.map(function (x) { return GBL.LABEL[x.line].toLowerCase(); }).join(' and ') + ' bill' + (arrears.length === 1 ? '' : 's') + ' also show' + (arrears.length === 1 ? 's' : '') + ' earlier months as outstanding (' + gcmMoney_(arrears.reduce(function (s, x) { return s + x.arrears; }, 0)) + '). If you have paid these, please send us the payment details and we will have them applied.');
  if (changes.length) paras.push('Changes on this billing: ' + changes.map(function (c) { return (c.kind === 'joiner' ? 'added ' : 'removed ') + gblNice_(c.member) + (c.effective ? ' (' + tDmy_(c.effective) + ')' : ''); }).join('; ') + '. Please tell us if anyone is missing or should not be there.');
  paras.push('We have checked each bill against our records before sending it. Your service page shows your billing and payments for the last twelve months, every open item on your account, and a form to tell us about a payment made or a person joining or leaving.');
  var text = [greet, '', paras.join('\n\n'), '', lineRows.map(function (r) { return r.what + ': ' + gcmMoney_(r.due) + (r.extra ? ' (' + r.extra + ')' : ''); }).join('\n'), '',
    'Your page: ' + GCM.SITE + 'client.html?from=bill', 'Sign in with your list bill (' + (g.bills[0] || '') + ') and your access code: ' + (g.code || '(not set)'), '',
    'Warm regards,', signer, 'Ricky Rampersad Branch, Guardian Life of the Caribbean', '9-13 Endeavour 1st Street, Chaguanas · (868) 226-6461'].join('\n');
  var rows = lineRows.map(function (r) { return '<tr><td style="padding:9px 10px;border-bottom:1px solid #e2e7ef;font:14px Arial,sans-serif;color:#142033">' + E(r.what) + (r.extra ? '<div style="font:12px Arial,sans-serif;color:#5a687d">' + E(r.extra) + '</div>' : '') + '</td><td style="padding:9px 10px;border-bottom:1px solid #e2e7ef;font:700 14px Arial,sans-serif;color:#142033;text-align:right;white-space:nowrap">' + E(gcmMoney_(r.due)) + '</td></tr>'; }).join('');
  var html = '<div style="background:#f3f5f9;padding:20px 0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse;border:1px solid #e2e7ef">' +
    (test ? '<tr><td style="padding:10px 26px;background:#fdf1e1;font:700 13px Arial,sans-serif;color:#a64b05">TEST: this would go to ' + E(g.to.join(', ') || 'nobody') + '. Nothing has reached the group.</td></tr>' : '') +
    '<tr><td style="padding:18px 26px;border-bottom:3px solid #1d5bc4"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="' + GCM.SITE + 'gcm-mark.png" width="40" height="40" alt="Ricky Rampersad Branch" style="display:block;border-radius:9px"></td>' +
    '<td style="padding-left:12px;font:700 15px/1.2 Arial,sans-serif;color:#142033">Ricky Rampersad Branch<div style="font:400 12px/1.4 Arial,sans-serif;color:#5a687d">Group billing</div></td></tr></table></td></tr>' +
    '<tr><td style="padding:22px 26px 0"><div style="font:700 22px/1.3 Arial,sans-serif;color:#142033">Your ' + E(label) + ' billing</div><div style="font:14px/1.4 Arial,sans-serif;color:#5a687d;margin-top:6px">' + E(g.name) + (dueBy ? ' · payable by ' + E(tDmy_(dueBy)) : '') + '</div></td></tr>' +
    '<tr><td style="padding:18px 26px 22px;font:15px/1.6 Arial,sans-serif;color:#142033"><p style="margin:0 0 12px">' + E(greet) + '</p>' + paras.map(function (p) { return '<p style="margin:0 0 12px">' + E(p) + '</p>'; }).join('') +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e2e7ef;margin:6px 0 16px">' + rows +
    '<tr><td style="padding:10px;font:700 14px Arial,sans-serif;color:#142033;background:#ebf2fd">Total due</td><td style="padding:10px;font:700 16px Arial,sans-serif;color:#1d5bc4;background:#ebf2fd;text-align:right">' + E(gcmMoney_(total)) + '</td></tr></table>' +
    '<p style="margin:0 0 6px"><a href="' + GCM.SITE + 'client.html?from=bill" style="display:inline-block;background:#1d5bc4;color:#fff;text-decoration:none;font:700 14px Arial,sans-serif;padding:11px 18px;border-radius:8px">Open your service page</a></p>' +
    '<p style="margin:0 0 16px;font:13px/1.5 Arial,sans-serif;color:#5a687d">Sign in with your list bill <b>' + E(g.bills[0] || '') + '</b> and your access code <b>' + E(g.code || '(not set)') + '</b>.</p>' +
    '<p style="margin:0">Warm regards,<br><b>' + E(signer) + '</b><br>Ricky Rampersad Branch, Guardian Life of the Caribbean<br><span style="color:#5a687d">9-13 Endeavour 1st Street, Chaguanas · (868) 226-6461</span></p></td></tr></table></div>';
  return { subject: subject, text: text, html: html };
}

/* ── claims experience ──────────────────────────────────────────────────────────────── */
/** The claims summary, aggregated on the staff member's device by month and division (counts and amounts; no name), onto
 *  Group Claims, replacing what was there for the group. Returns the experience against the premiums in Salesforce. */
function gblClaims_(b) {
  var who = gcmWho_(b);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(b.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  if (!gcmMine_(who, g)) return gcmNotYours_(g);
  var rows = typeof b.rows === 'string' ? gblJ_(b.rows, []) : (b.rows || []);
  rows = rows.filter(function (r) { return r && /^\d{4}-\d{2}$/.test(String(r.month || '')); });
  if (!rows.length) return { ok: false, error: 'No monthly figures were read from the claims file.' };
  gblReplace_(GBL.CLAIMS, function (r) { return gcmCodeKey_(r.Group) === g.key; }, rows.map(function (r) {
    return { Group: g.name, Month: r.month, Division: String(r.division || '').slice(0, 60), Claims: Number(r.claims) || 0, Charge: gblR_(r.charge), 'Member share': gblR_(r.member), Paid: gblR_(r.paid), Uploaded: gcmWhen_(new Date()), By: who.name };
  }));
  gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: 'health', Kind: 'claims', Member: '', Detail: 'Claims summary uploaded: ' + rows.length + ' month-division rows', Effective: '', Amount: 0, Source: 'staff', By: who.name, Status: 'done', 'SF Task': '', 'SF Id': '', Note: '' }]);
  return { ok: true, said: rows.length + ' rows stored.', claims: gblExperience_(g, gblSf_(g), true) };
}
function gblClaimsRows_(g) {
  return gblRows_(GBL.CLAIMS).filter(function (r) { return gcmCodeKey_(r.Group) === g.key; }).map(function (r) {
    return { month: gcmText_(r.Month), division: gcmText_(r.Division), claims: gblNum_(r.Claims), charge: gblNum_(r.Charge), member: gblNum_(r['Member share']), paid: gblNum_(r.Paid), uploaded: gcmText_(r.Uploaded) };
  });
}
/** The health plan's experience: the premiums billed (every T-HEALTH GROUP record in Salesforce, read whole for this) against
 *  the claims paid, by plan year. A plan year starts where the monthly premium steps up by GBL.RATE_JUMP and stays there: the
 *  renewal lands on the March or April bill for most groups, not January. Staff get the loss ratios; the group's page gets
 *  what the plan paid for its people by calendar year and how many claims. */
function gblExperience_(g, sf, forStaff) {
  var rows = gblClaimsRows_(g);
  if (!rows.length) return null;
  var prem = {};
  try {
    var accts = g.acctsFull && g.acctsFull.length ? g.acctsFull : g.accts;
    if (sf.ok && accts.length) gcmQuery_("SELECT Renewal_Date__c, Group_Billing_Premiums__c FROM TRANSACTIONS__c WHERE Account__c IN (" + gcmIn_(accts) + ") AND RecordType.Name = 'T-HEALTH GROUP' AND Renewal_Date__c >= 2019-01-01 ORDER BY Renewal_Date__c")
      .forEach(function (t) { var m = gblMonthOf_(t.Renewal_Date__c); prem[m] = gblR_((prem[m] || 0) + (Number(t.Group_Billing_Premiums__c) || 0)); });
  } catch (e) {}
  var byM = {};
  rows.forEach(function (r) { var o = byM[r.month] = byM[r.month] || { paid: 0, claims: 0, charge: 0, div: {} }; o.paid += r.paid; o.claims += r.claims; o.charge += r.charge; o.div[r.division] = (o.div[r.division] || 0) + r.paid; });
  var months = Object.keys(byM).sort(), first = months[0], last = months[months.length - 1];
  /* plan years from the premium steps */
  var pm = Object.keys(prem).sort(), starts = [];
  for (var i = 1; i < pm.length; i++) {
    var a = prem[pm[i - 1]], c = prem[pm[i]], d = prem[pm[i + 1]];
    if (a && c && (c - a) / a > GBL.RATE_JUMP && (d === undefined || Math.abs(d - c) / c < 0.1) && pm[i] >= first) starts.push(pm[i]);
  }
  var edges = [first].concat(starts.filter(function (s) { return s > first && s <= last; })).concat([gblAddMonths_(last, 1)]);
  var years = [];
  for (var k = 0; k < edges.length - 1; k++) {
    var from = edges[k], to = gblAddMonths_(edges[k + 1], -1), p = 0, paid = 0, n = 0, ch = 0, ms = 0;
    for (var m = from; m <= to; m = gblAddMonths_(m, 1)) { ms++; p += prem[m] || 0; if (byM[m]) { paid += byM[m].paid; n += byM[m].claims; ch += byM[m].charge; } }
    years.push({ from: from, to: to, label: gblMonthLabel_(from).slice(0, 3) + ' ' + from.slice(0, 4) + ' to ' + gblMonthLabel_(to).slice(0, 3) + ' ' + to.slice(0, 4), months: ms, premium: gblR_(p), paid: gblR_(paid), claims: n, charge: gblR_(ch),
      lossRatio: p ? Math.round(100 * paid / p) : null, payShare: ch ? Math.round(100 * paid / ch) : null, rateChange: k > 0 && prem[gblAddMonths_(from, -1)] ? Math.round(100 * (prem[from] - prem[gblAddMonths_(from, -1)]) / prem[gblAddMonths_(from, -1)]) : null });
  }
  var cal = {};
  months.forEach(function (m) { var y = m.slice(0, 4), o = cal[y] = cal[y] || { year: y, paid: 0, claims: 0 }; o.paid = gblR_(o.paid + byM[m].paid); o.claims += byM[m].claims; });
  var out = { from: first, to: last, uploaded: rows[0].uploaded, byYear: Object.keys(cal).sort().map(function (y) { return cal[y]; }), monthly: months.slice(-14).map(function (m) { return { month: m, paid: gblR_(byM[m].paid), claims: byM[m].claims, premium: prem[m] || 0 }; }) };
  if (forStaff) {
    out.planYears = years; out.renewals = starts;
    var cur = years[years.length - 1];
    out.note = cur && cur.lossRatio !== null ? 'Since ' + gblMonthLabel_(cur.from) + (cur.rateChange ? ' (rates ' + (cur.rateChange > 0 ? 'up ' : 'down ') + Math.abs(cur.rateChange) + '%)' : '') + ' the plan has paid out ' + cur.lossRatio + '% of premium' + (years.length > 1 && years[years.length - 2].lossRatio !== null ? ', against ' + years[years.length - 2].lossRatio + '% the plan year before' : '') + '. The last two months are still filling in.' : '';
  }
  return out;
}

/* ── the AI read ────────────────────────────────────────────────────────────────────── */
/** Where the month's billing stands and what to do first, from the findings with every name taken out, the Salesforce
 *  figures and the open tasks' ages. For staff, never a client. */
function gblAi_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  if (!gcmAiKey_()) return { ok: false, error: 'The AI key is not set on this project (ANTHROPIC_API_KEY).' };
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(p.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  var month = String(p.month || ''), bills = gblBillRows_(g).filter(function (x) { return x.month === month; });
  if (!bills.length) return { ok: false, error: 'Upload a bill for the month first.' };
  var sf = gblSf_(g), facts = [];
  bills.forEach(function (b) {
    var sm = gblSfMonth_(sf, b.line, b.month);
    facts.push(GBL.LABEL[b.line] + ' ' + gblMonthLabel_(b.month) + ': bill ' + gcmMoney_(b.due) + ' for ' + b.members + ' ' + (b.line === 'listbill' ? 'policies' : 'members') + (b.arrears ? ', earlier months shown unpaid ' + gcmMoney_(b.arrears) : '') +
      '; Salesforce ' + (sm.rec ? gcmMoney_(sm.rec.billed) + (sm.rec.paid ? ', paid ' + gcmMoney_(sm.rec.paid) : ', nothing paid yet') : 'has no record') + '.');
    b.findings.filter(function (f) { return !b.resolved[f.id] && f.level !== 'ok'; }).slice(0, GBL.AI_MAX_FINDINGS).forEach(function (f) { facts.push('[' + f.level + ', ' + f.who + '] ' + (f.aiText || '').replace(/[A-Z][a-z]+ [A-Z][a-z\-]+/g, 'a member')); });
    var hist = sf.trans.filter(function (t) { return t.line === b.line; }).slice(0, 6).map(function (t) { return gblMonthLabel_(t.month).slice(0, 3) + ' ' + gcmMoney_(t.billed) + (t.paid ? ' paid' : ' unpaid'); });
    if (hist.length) facts.push(GBL.LABEL[b.line] + ' last months: ' + hist.join(', ') + '.');
  });
  g.tasks.filter(function (t) { return t.open && gblIsBillingTask_(t); }).forEach(function (t) { facts.push('Open billing task, ' + gcmDays_(t.opened, L.today) + ' days, ' + t.status + (t.due && t.due < L.today ? ', past target' : '') + ': ' + gcmTitle_(t.subject, g.name).replace(/[A-Z][a-z]+ [A-Z][a-z\-]+/g, 'a member') + '.'); });
  var ex = gblExperience_(g, sf, true);
  if (ex && ex.note) facts.push('Claims: ' + ex.note);
  var key = 'gbl-ai-' + g.key.slice(0, 30) + '-' + month + '-' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, facts.join('|'), Utilities.Charset.UTF_8)).slice(0, 16);
  try { var c = CacheService.getScriptCache().get(key); if (c) return JSON.parse(c); } catch (e) {}
  var system = 'You read a Trinidad insurance branch\'s monthly group billing review and tell the staff member where it stands. You are given facts only: amounts, counts, findings with no names, task ages. ' +
    'Answer as JSON with keys: where (two sentences on where the month stands), first (an array of up to four short actions, most pressing first, each naming who does it: Salesforce fix, Head Office, the group, or us), careful (one sentence on what to be careful of), say (two sentences the staff member could say to the group about this month\'s billing, warm and factual). ' +
    'Never invent a figure, a name or a date. Staff are not licensed advisers: never advise on cover. Plain words, no jargon, no bullet characters inside strings.';
  var text;
  try { text = gcmClaude_(system, 'Group: a client of the branch (name withheld). Month: ' + gblMonthLabel_(month) + '.\n\n' + facts.join('\n')); } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 200) }; }
  var out = { ok: true, where: '', first: [], careful: '', say: '' };
  try { var j = JSON.parse(text.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); out.where = String(j.where || ''); out.first = (j.first || []).map(String).slice(0, 4); out.careful = String(j.careful || ''); out.say = String(j.say || ''); }
  catch (e2) { out.where = text.slice(0, 900); }
  try { CacheService.getScriptCache().put(key, JSON.stringify(out), 6 * 3600); } catch (e3) {}
  return out;
}

/* ── the group's own page ───────────────────────────────────────────────────────────── */
/** What a group sees under Billing, one block a line: the latest bill we sent or checked (figures and counts, never a member's
 *  name), what Salesforce holds as billed and paid for the last twelve months, the open billing items, the changes they told
 *  us about, and for health what the plan paid for their people by year. */
function gblClientBlock_(g, L) {
  var out = { lines: [], contact: GCM.TELL_CC[0] || '' };
  try {
    var sf = gblSf_(g), bills = gblBillRows_(g), changes = gblChanges_(g).filter(function (c) { return c.source === 'client'; }).slice(-10).reverse();
    gblLinesOf_(g, sf, bills).forEach(function (ln) {
      var sent = bills.filter(function (x) { return x.line === ln && (x.sentAt || x.reconciledAt); }).pop() || null;
      var hist = sf.trans.filter(function (t) { return t.line === ln; }).slice(0, 12).map(function (t) {
        var pays = sf.pays.filter(function (q) { return q.trans === t.id15; }), paid = Math.max(t.paid, pays.reduce(function (s, q) { return s + q.amount; }, 0));
        return { month: t.month, label: gblMonthLabel_(t.month), billed: t.billed, paid: paid, paidOn: pays.length ? pays[0].paidOn : t.paidOn, status: paid >= t.billed - 0.05 && t.billed ? 'Paid' : paid > 0 ? 'Part paid' : t.month >= L.today.slice(0, 7) ? 'Current' : 'Open' };
      });
      var owed = hist.filter(function (h) { return h.status === 'Open' || h.status === 'Part paid'; }).reduce(function (s, h) { return s + h.billed - h.paid; }, 0);
      var items = g.tasks.filter(function (t) { return t.open && gblIsBillingTask_(t) && gcmShown_(g, t) && (gblLineOfRt_(t.subject) === ln || !gblLineOfRt_(t.subject)); }).length;
      var o = { line: ln, label: GBL.LABEL[ln], bill: sent ? { month: sent.month, label: gblMonthLabel_(sent.month), due: sent.due, dueBy: sent.dueBy, members: sent.members, arrears: sent.arrears, sentAt: sent.sentAt,
        divisions: ln === 'health' && sent.summary && sent.summary.divisions ? sent.summary.divisions.map(function (d) { return { name: d.name, employees: d.employees, total: d.total }; }) : null,
        joined: ln === 'life' && sent.summary ? sent.summary.joined || 0 : (sent.summary && sent.summary.credits ? sent.summary.credits - (sent.summary.cancels || 0) : 0), left: ln === 'life' && sent.summary ? sent.summary.left || 0 : (sent.summary ? sent.summary.cancels || 0 : 0) } : null,
        history: hist, owed: gblR_(owed), openItems: items, changes: changes.filter(function (c) { return c.line === ln; }).map(function (c) { return { at: c.at, kind: c.kind, member: c.member, detail: c.detail, status: c.status === 'done' ? 'Done' : 'With our team' }; }) };
      if (ln === 'health') { var ex = gblExperience_(g, sf, false); if (ex) o.claims = ex; }
      out.lines.push(o);
    });
  } catch (e) { out.error = String(e && e.message ? e.message : e).slice(0, 160); }
  return out;
}
/** What a group tells us from its page: a payment made, a joiner, a leaver, a dependent, a question. Signed in as the client
 *  page signs in; filed, posted to Chatter, e-mailed to the account owner; a joiner or leaver opens a task. */
function gblClientTell_(b) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, b.lb, b.code);
  if (!a.ok) return a;
  var g = a.g, line = gblLine_(b.line) || 'health', who = { role: 'client', name: String(b.name || 'the group').slice(0, 80), email: '' };
  var kind = String(b.kind || '').toLowerCase(), r;
  if (kind === 'payment') {
    var amount = Number(b.amount), paidOn = gcmYmd_(b.paidOn || ''), method = String(b.method || '').slice(0, 40), ref = String(b.ref || '').slice(0, 80), forMonth = /^\d{4}-\d{2}$/.test(String(b.forMonth || '')) ? b.forMonth : '';
    if (!amount || !paidOn) return { ok: false, error: 'Please give the amount and the date you paid.' };
    gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: line, Kind: 'payment', Member: '', Detail: gcmMoney_(amount) + ' paid ' + tDmy_(paidOn) + (method ? ' by ' + method : '') + (ref ? ', ref ' + ref : '') + (forMonth ? ' for ' + gblMonthLabel_(forMonth) : ''), Effective: paidOn, Amount: amount, Source: 'client', By: who.name, Status: 'open', 'SF Task': '', 'SF Id': '', Note: '' }]);
    gblPostBilling_(g, line, forMonth || gblMonthOf_(paidOn), 'From ' + g.name + ' on their service page (' + who.name + '): payment of ' + gcmMoney_(amount) + ' made ' + tDmy_(paidOn) + (method ? ' by ' + method : '') + (ref ? ', ref ' + ref : '') + (forMonth ? ' for ' + gblMonthLabel_(forMonth) : '') + '. Please confirm receipt and key it.', who);
    r = { ok: true, said: 'Thank you. Our team will confirm the payment against our records and let you know.' };
  } else r = gblChange_(g, who, line, b, 'client');
  if (r.ok) { try { gblTellOwner_(g, who.name, kind, line, b); } catch (e) {} }
  return r;
}
function gblTellOwner_(g, name, kind, line, b) {
  var to = [];
  if (g.ownerEmail) to.push(g.ownerEmail);
  GCM.TELL_CC.forEach(function (a) { if (to.indexOf(a) < 0) to.push(a); });
  if (!to.length) return;
  var what = kind === 'payment' ? 'a payment of ' + gcmMoney_(Number(b.amount)) + ' made ' + tDmy_(gcmYmd_(b.paidOn || '')) : kind + (b.member ? ' ' + String(b.member).slice(0, 80) : '') + (b.effective ? ' effective ' + tDmy_(gcmYmd_(b.effective)) : '');
  var body = '<p><b>' + tEsc_(g.name) + '</b> (' + tEsc_(name) + ') told us on their service page about <b>' + tEsc_(what) + '</b> on ' + tEsc_(GBL.LABEL[line] || line) + '.</p>' +
    (b.detail ? '<p>“' + tEsc_(String(b.detail).slice(0, 800)) + '”</p>' : '') + '<p>It is on the billing task’s Chatter and on Group Changes. <a href="' + GCM.SITE + '">Open group client management</a></p>' +
    '<p style="color:#777;font-size:12px">' + tEsc_(tInternal_(null)) + '</p>';
  var subject = 'Group billing: ' + g.name + ' · ' + (kind === 'payment' ? 'payment advised' : kind);
  try { if (tMsCreds_()) { tMsSend_(to[0], subject, body, { cc: to.slice(1), replyTo: TRANSITION.MS_FROM }); return; } } catch (e) {}
  try { MailApp.sendEmail({ to: to.join(','), subject: subject, htmlBody: body, name: 'Ricky Rampersad Branch' }); } catch (e2) {}
}

/* ── the board: one line a group, for the staff page's accounts table ───────────────── */
/** Where each group's billing stands this month, for the team dashboard: lines uploaded, open fixes, reconciled, sent. */
function gblBoard_(L) {
  var out = {}, month = L.today.slice(0, 7), prevM = gblAddMonths_(month, -1);
  var rows = gblRows_(GBL.BILLS);
  L.reg.forEach(function (g) {
    var mine = rows.filter(function (r) { return gcmCodeKey_(r.Group) === g.key; }).map(gblBillOf_);
    var cur = mine.filter(function (b) { return b.month === month; }), m = cur.length ? month : prevM;
    var set = mine.filter(function (b) { return b.month === m; });
    out[g.key] = { month: m, lines: set.length, fixes: set.reduce(function (s, b) { return s + gblSteps_(b).fixes; }, 0), checks: set.reduce(function (s, b) { return s + gblSteps_(b).checks; }, 0),
      reconciled: set.filter(function (b) { return b.reconciledAt; }).length, sent: set.filter(function (b) { return b.sentAt; }).length, due: gblR_(set.reduce(function (s, b) { return s + b.due; }, 0)) };
  });
  return out;
}
