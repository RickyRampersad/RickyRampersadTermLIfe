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
                  'SF Record', 'SF Billed', 'SF Due', 'SF Paid', 'Variance', 'Findings', 'Resolved', 'Status', 'By', 'Checked at', 'Reconciled at', 'Reconciled by', 'Sent at', 'Files', 'Summary',
                  'Approved at', 'Approved by', 'Approved e-mail', 'Approved for', 'Files kept', 'Answers', 'Sent by', 'Late reason'],
  'Group Bill Lines': ['Group', 'Line', 'Month', 'Member Id', 'Name', 'Division', 'Tier', 'Start', 'Eff', 'Premium', 'Kind', 'For month', 'Cover'],
  'Group Changes': ['When', 'Group', 'Line', 'Kind', 'Member', 'Detail', 'Effective', 'Amount', 'Source', 'By', 'Status', 'SF Task', 'SF Id', 'Note', 'Form'],
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
/* A month is kept as "2026-10", and Google Sheets turns "2026-10" written into a cell into the date 1 October 2026, which
 * reads back as "2026-10-01" (27 October 2026: the first bill stored live, Xtra Foods' October health bill, was then never
 * found again: the page said nothing was uploaded, looked in Salesforce for a "2026-10-01" record that cannot exist, and
 * each upload added a row where it should have replaced one). Every Month and For month cell is read back as yyyy-MM, in
 * the sheet's own time zone so the 1st never slips to the 30th, and written as text so the sheet keeps it as written. */
var GBL_MONTH_COLS = { 'Month': true, 'For month': true };
var GBL_SS_TZ = '';
function gblMon_(x) {
  if (x instanceof Date) {
    if (isNaN(x.getTime())) return '';
    if (!GBL_SS_TZ) { try { GBL_SS_TZ = gcmSS_().getSpreadsheetTimeZone() || tTz_(); } catch (e) { GBL_SS_TZ = tTz_(); } }
    return Utilities.formatDate(x, GBL_SS_TZ, 'yyyy-MM');
  }
  var s = gcmText_(x).replace(/^'/, '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(0, 7) : s;
}
function gblCell_(h, v) {
  if (v === undefined || v === null) return '';
  if (GBL_MONTH_COLS[h]) { var m = gblMon_(v); return /^\d{4}-\d{2}$/.test(m) ? "'" + m : m; }
  return v;
}
function gblRows_(name) {
  if (!gcmSS_().getSheetByName(name)) return [];
  var rows = gcmRows_(name);
  rows.forEach(function (r) { for (var h in GBL_MONTH_COLS) if (h in r) r[h] = gblMon_(r[h]); });
  /* one stored bill a group, line and month, the newest: the rows the month bug added are passed over */
  if (name === GBL.BILLS) {
    var last = {}, key = function (r) { return gcmCodeKey_(r.Group) + '|' + gcmText_(r.Line) + '|' + r.Month; };
    rows.forEach(function (r, i) { last[key(r)] = i; });
    rows = rows.filter(function (r, i) { return last[key(r)] === i; });
  }
  return rows;
}
function gblAppend_(name, rows) {
  if (!rows.length) return;
  var sh = gblSheet_(name), head = GBL_HEAD[name];
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, head.length).setValues(rows.map(function (o) {
    return head.map(function (h) { return gblCell_(h, o[h]); });
  }));
}
/** Rewrite a tab without the rows `drop` picks, then with `add` after them. Whole, so a reader never meets it half written. */
function gblReplace_(name, drop, add) {
  var sh = gblSheet_(name), head = GBL_HEAD[name];
  var keep = gblRows_(name).filter(function (r) { return !drop(r); });
  var rows = keep.concat(add || []).map(function (o) { return head.map(function (h) { return gblCell_(h, o[h]); }); });
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
    reconciledAt: gcmText_(r['Reconciled at']), reconciledBy: gcmText_(r['Reconciled by']), sentAt: gcmText_(r['Sent at']), files: gcmText_(r.Files), summary: gblJ_(r.Summary, {}), at: gcmWhen_(r.When),
    approvedAt: gcmText_(r['Approved at']), approvedBy: gcmText_(r['Approved by']), approvedEmail: gcmText_(r['Approved e-mail']), approvedFor: gcmYmd_(r['Approved for']), kept: gcmText_(r['Files kept']), answers: gblJ_(r.Answers, {}),
    sentBy: gcmText_(r['Sent by']), lateReason: gcmText_(r['Late reason']), atYmd: gcmYmd_(r.When), atHour: r.When instanceof Date ? Number(Utilities.formatDate(r.When, tTz_(), 'H')) : 0 };
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
  if (!b) return { upload: false, verify: false, fixed: false, reconciled: false, approved: false, sent: false, open: 0 };
  var fixes = b.findings.filter(function (f) { return f.level === 'fix' && !b.resolved[f.id]; }).length;
  var checks = b.findings.filter(function (f) { return f.level === 'check' && !b.resolved[f.id]; }).length;
  /* "Fix" is done when nothing marked fix is open; a check left open is the reconciler's call, and reconciling closes the step */
  return { upload: true, verify: !!b.checkedAt, fixed: fixes === 0, reconciled: !!b.reconciledAt, approved: !!b.sentAt || b.status === 'approved' || /^held/i.test(b.status), sent: !!b.sentAt, open: fixes + checks, fixes: fixes, checks: checks,
    status: b.status, approvedFor: b.approvedFor || '', approvedBy: b.approvedBy || '', approvedAt: b.approvedAt || '', held: /^held/i.test(b.status) ? b.status.replace(/^held:\s*/i, '') : '' };
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
  var out = { ok: true, role: who.role, title: who.title || '', me: who.name, today: today, month: month, reasonNeeded: who.role !== 'branch', lateMin: GBL_LATE.MIN, monthLabel: gblMonthLabel_(month), canAct: gcmMine_(who, g), live: gblLive_(), ai: !!gcmAiKey_(), salesforce: sf.ok, sfError: sf.error,
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
    if (b) { var cutD = gblCutoffOf_(b), nowD = gblNow_(); o.cut = { day: cutD, label: cutD ? gblDayLabel_(cutD) : '', past: gblPast_(cutD, nowD), missed: !!gblMissed_(b, nowD), reason: gblLateText_(b.lateReason) }; }
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
  out.day = gblDayInfo_();
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
    else if (s.held) steps.push({ line: o.line, text: lab + ' was approved but held at the run: ' + s.held + '. Put it right and press Send now.', kind: 'held' });
    else if (s.status === 'tested') steps.push({ line: o.line, text: lab + ' went as a test copy in the ' + (v.day ? v.day.date : 'last') + ' run (test mode). Approve it again for the next run once the bills are live, or send it now.', kind: 'approve' });
    else if (s.approved) steps.push({ line: o.line, text: lab + ' is approved by ' + s.approvedBy + ': it goes by itself on ' + gblDayLabel_(s.approvedFor) + '.', kind: 'approved' });
    else if (s.reconciled) steps.push({ line: o.line, text: lab + ' is reconciled: approve it for ' + (v.day ? v.day.label : 'the billing day') + ', or send it to the group now.', kind: 'approve' });
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
  if (act === 'approve' || act === 'unapprove') { if (!bill) return { ok: false, error: 'No bill is stored for that month.' }; return gblApprove_(g, who, bill, b, L); }
  if (act === 'change') return gblChange_(g, who, line, b, 'staff');
  if (act === 'task') return gblTaskOpen_(g, who, line, month, b);
  /* the door (25 October 2026): an answer to a question, an update on last month's task, a letter to a member */
  if (act === 'answer') return gblAnswer_(g, who, b, L);
  if (act === 'taskUpdate') return gblTaskUpdate_(g, who, b);
  if (act === 'memberLetter') return gblMemberLetter_(g, who, b, L);
  if (['members', 'form', 'formSend', 'enrol', 'enrolSend', 'easi', 'easiSend'].indexOf(act) >= 0) return gblFormAct_(g, who, b);
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
function gblChange_(g, who, line, b, source, extra) {
  var kind = String(b.kind || '').toLowerCase(), member = String(b.member || '').trim().slice(0, 120), detail = String(b.detail || '').trim().slice(0, 800), eff = gcmYmd_(b.effective || '') || '';
  if (['joiner', 'leaver', 'tier', 'query', 'dependent', 'address', 'beneficiary', 'bank', 'plan'].indexOf(kind) < 0) return { ok: false, error: 'What kind of change: a joiner, a leaver, a tier change, a dependent, or a question?' };
  if (kind !== 'query' && !member) return { ok: false, error: 'Whose change is it? Give the person’s name.' };
  if (kind === 'query' && !detail) return { ok: false, error: 'Write the question first.' };
  var lab = GBL.LABEL[line] || 'Billing', taskId = '', taskNote = '';
  if (tSfOn_() && kind !== 'query') {
    var ownerId = gblOwnerId_(g), acct = (g.acctsFull || g.accts)[0] || null;
    var subj = (kind === 'leaver' ? lab + ' Termination – ' : kind === 'joiner' ? lab + ' Member Enrolment – ' : kind === 'dependent' ? lab + ' Dependent Change – ' : kind === 'address' ? lab + ' Change of Address – ' : kind === 'beneficiary' ? lab + ' Beneficiary Change – ' : kind === 'bank' ? lab + ' ACH Details Change – ' : kind === 'plan' ? lab + ' Plan Change – ' : lab + ' Tier Change – ') + member + ' – ' + g.name + (eff ? ' – effective ' + tDmy_(eff) : '');
    var rec = { Subject: subj.slice(0, 255), WhatId: acct, ActivityDate: gcmAddDays_(gcmToday_(), 2), Status: 'Not Started', Priority: 'Normal',
      Description: (source === 'client' ? 'Reported by the group on their service page' : 'Recorded by ' + who.name + ' on the billing review') + (b.name ? ' (' + String(b.name).slice(0, 80) + ')' : '') + '.\n' + detail };
    if (ownerId) rec.OwnerId = ownerId;
    try { var res = tSfSend_('post', '/sobjects/Task', Object.assign({ Task_Type__c: 'Servicing' }, rec)); taskId = String(res.id || ''); }
    catch (e) { try { var res2 = tSfSend_('post', '/sobjects/Task', rec); taskId = String(res2.id || ''); } catch (e2) { taskNote = 'Salesforce task not opened: ' + String(e2 && e2.message ? e2.message : e2).slice(0, 120); } }
  }
  gblAppend_(GBL.CHANGES, [Object.assign({ When: new Date(), Group: g.name, Line: line, Kind: kind, Member: member, Detail: detail, Effective: eff, Amount: Number(b.amount) || 0, Source: source, By: source === 'client' ? String(b.name || 'the group').slice(0, 80) : who.name,
    Status: 'open', 'SF Task': taskId, 'SF Id': '', Note: taskNote }, extra || {})]);
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
var GBL_TASK = { DUE_DAYS: 2, MIN_TEXT: 20, CACHE_S: 600, KINDS: ['joiner', 'leaver', 'tier', 'dependent', 'payment', 'amount', 'backcharge', 'rate', 'group', 'other', 'convert', 'depage', 'data'],
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
  var month = String(b.month || ''), now = gblNow_();
  var lines = String(b.lines || 'health,life,listbill').split(',').map(gblLine_).filter(String);
  var bills = gblBillRows_(g).filter(function (x) { return x.month === month && lines.indexOf(x.line) >= 0; });
  if (!bills.length) return { ok: false, error: 'No bill is stored for ' + gblMonthLabel_(month) + '.' };
  var names = function (list) { return list.map(function (x) { return GBL.LABEL[x.line]; }).join(' and ') + ' ' + (list.length === 1 ? 'is' : 'are'); };
  var notRec = bills.filter(function (x) { return !x.reconciledAt; });
  if (notRec.length && !(who.role === 'branch' && gcmYes_(b.force))) return { ok: false, error: names(notRec) + ' not reconciled yet. Reconcile first, so nothing goes to the group that a person has not checked.' };
  /* Send now goes only on an approved bill (25 October 2026); a bill already sent goes again with no question */
  var fresh = bills.filter(function (x) { return !x.sentAt; }), again = !fresh.length;
  var notApp = fresh.filter(function (x) { return !x.approvedAt; });
  if (notApp.length) return { ok: false, needApproval: true, error: names(notApp) + ' not approved yet. Approve it first: Send now goes only on an approved bill.' };
  /* after the cut-off: why it was not done by then (a reason given at a late approval is offered again) */
  var cut = again ? '' : gblLateOf_(fresh, now), lr = { reason: '' }, had = '';
  if (cut) {
    had = fresh.map(function (x) { return gblLateText_(x.lateReason); }).filter(String)[0] || '';
    lr = gblLateReason_(b.reason || had, who.role !== 'branch');
    if (lr.error) return { ok: false, needReason: true, cutoff: cut, cutoffLabel: gblDayLabel_(cut), had: had, error: 'This bill missed ' + gblCutWords_(cut) + '. ' + lr.error };
  }
  var why = gcmCannotMail_(g);
  if (why) return { ok: false, error: 'Cannot send: ' + why + '.' };
  if (!tMsCreds_()) return { ok: false, error: 'Microsoft 365 is not set up on this project, so nothing can go from support@.' };
  var live = gblLive_(), test = !live;
  var to = test ? [who.email || gcmDayManager_()].filter(String) : g.to.slice(0, 1);
  if (!to.length) return { ok: false, error: 'No address to send the test to: your e-mail is not on the Agent Skill Bank.' };
  var cc = test ? (TRANSITION.CC || []).slice() : gcmCc_(g);
  var files = Array.isArray(b.attachments) ? b.attachments : [];
  var blobs = [], keptUsed = false;
  files.slice(0, 6).forEach(function (f) {
    try { var bytes = Utilities.base64Decode(String(f.b64 || '')); if (bytes.length && bytes.length < 3000000) blobs.push(Utilities.newBlob(bytes, String(f.type || 'application/pdf'), String(f.name || 'bill.pdf').replace(/[^\w.\- ]/g, '_').slice(0, 80))); } catch (e) {}
  });
  if (!blobs.length && fresh.length) {   // nothing read in this session: the PDFs kept in Drive at the approval
    var kb = gblKeptBlobs_(fresh);
    if (kb.missing.length) return { ok: false, error: 'The PDF kept at the approval of the ' + kb.missing.join(' and ').toLowerCase() + ' bill is gone from Drive. Upload the bill again here and press Send now.' };
    blobs = kb.blobs; keptUsed = blobs.length > 0;
  }
  var mail = gblBillMail_(g, month, bills, who, test, L), stmtBlob = gblStatementBlob_(g, month, bills, L);
  if (stmtBlob) blobs.push(stmtBlob);
  try { tMsSend_(to[0], (test ? '[TEST] ' : '') + mail.subject, mail.html, { cc: cc.concat(to.slice(1)), attachments: blobs, replyTo: TRANSITION.MS_FROM }); }
  catch (e) { return { ok: false, error: 'Not sent: ' + String(e && e.message ? e.message : e).slice(0, 200) }; }
  var at = gcmWhen_(now), stamp = lr.reason ? lr.reason + GBL_LATE.BY + who.name + ', ' + at : '';
  gcmAppend_(GCM.SENDS, [{ When: now, Group: g.name, Staff: gcmSigner_(who, g), To: to.join(', '), Cc: cc.join(', '), Subject: mail.subject, Items: bills.length, 'Task Ids': bills.map(function (x) { return x.line + ':' + x.month; }).join(' '),
    Letter: mail.text.slice(0, 40000), Via: 'support@, Send now' + (again ? ', sent again' : '') + (cut ? ', late (cut-off ' + cut + ')' : '') + (blobs.length ? ', ' + blobs.length + ' file' + (blobs.length === 1 ? '' : 's') : ''), Status: test ? 'bill test' : 'bill sent', Html: gcmKeepHtml_(mail.html) }]);
  bills.forEach(function (x) {
    var p = test ? {} : { 'Sent at': at, Status: 'sent', 'Sent by': who.name };
    if (stamp && fresh.indexOf(x) >= 0) p['Late reason'] = stamp;
    if (Object.keys(p).length) gblBillPatch_(x, p);
    if (!test && fresh.indexOf(x) >= 0) (x.kept || '').split(',').map(function (s) { return s.trim(); }).filter(String).forEach(function (id) { var f = gblFileById_(id); if (f) { try { f.moveTo(gblSubfolder_(GBL_DAY.SENT)); } catch (e) {} } });
  });
  var lateSay = cut ? ' It went after ' + gblCutWords_(cut) + (lr.reason ? '. Why: ' + lr.reason : ', no reason given') + '.' : '';
  bills.forEach(function (x) { gblPostBilling_(g, x.line, month, (test ? 'TEST of the ' : 'The ') + gblMonthLabel_(month) + ' ' + GBL.LABEL[x.line].toLowerCase() + ' bill ' + (test ? 'was sent to ' + to.join(', ') : 'was sent to the group (' + to.join(', ') + ')') + ' from support@ by Send now' + (blobs.length ? ' with the PDF attached' : '') + '.' + (fresh.indexOf(x) >= 0 ? lateSay : ''), who); });
  var task = '';
  if (cut) {
    gblAppend_(GBL.CHANGES, fresh.map(function (x) {
      return { When: now, Group: g.name, Line: x.line, Kind: 'late send', Member: '', Detail: GBL.LABEL[x.line] + ' ' + gblMonthLabel_(month) + (test ? ' sent as a TEST copy' : ' sent to the group') + ' by Send now at ' + at + ', after ' + gblCutWords_(cut) + '.',
        Effective: month + '-01', Amount: x.due || 0, Source: 'staff', By: who.name, Status: test ? 'test' : 'done', 'SF Task': '', 'SF Id': '', Note: lr.reason || '' };
    }));
    if (!test) task = gblLateTask_(g, cut, who.name + ': the ' + gblMonthLabel_(month) + ' ' + fresh.map(function (x) { return GBL.LABEL[x.line].toLowerCase(); }).join(' and ') + ' bill went to the group by Send now at ' + at + '. Why it missed ' + gblCutWords_(cut) + ': ' + (lr.reason || 'no reason given') + '.');
    if (who.role !== 'branch') { try { gblLateMail_(g, fresh, who, { cut: cut, reason: lr.reason, at: at, to: to.join(', '), test: test, task: task }); } catch (e) {} }
  }
  var lateTail = cut ? ' The reason is on the bill and its Chatter' + (task ? ', it answers and closes the 10:30 task' : '') + (who.role !== 'branch' ? ', and the branch manager has it.' : '.') : '';
  return { ok: true, test: test, to: to, at: at, kept: keptUsed, late: cut ? { cutoff: cut, reason: lr.reason, task: task } : null,
    said: (test ? 'Test sent to ' + to.join(', ') + '. Nothing went to the group: run gblGoLive from the editor when the branch is ready.' : 'Sent to ' + to.join(', ') + ' from support@ at ' + at + '.') + (keptUsed ? ' The PDF kept at the approval went with it.' : '') + lateTail };
}
function gblLive_() { try { return !!PropertiesService.getScriptProperties().getProperty(GBL.LIVE_PROP); } catch (e) { return false; } }
/** The editor's Run button (the branch manager): from now on a bill sent from the review page goes to the group. */
function gblGoLive() { PropertiesService.getScriptProperties().setProperty(GBL.LIVE_PROP, gcmWhen_(new Date())); return tSay_('Bills sent from the billing review now go to the groups, from support@, copied to sales support. gblStop ends that.'); }
function gblStop() { PropertiesService.getScriptProperties().deleteProperty(GBL.LIVE_PROP); return tSay_('Bills now go only to the staff member and the branch, marked TEST.'); }
/** The cover note: the figures per line, what changed, how to pay, their page. Tables and inline styles, so any mail app shows it. */
function gblBillMail_(g, month, bills, who, test, L) {
  var E = tEsc_, label = gblMonthLabel_(month), signer = gcmSigner_(who, g), total = gblR_(bills.reduce(function (s, x) { return s + x.due; }, 0));
  var changes = gblBillChanges_(g, month, bills);
  var dueBy = bills.map(function (x) { return x.dueBy; }).filter(String).sort()[0] || '';
  var lineRows = bills.map(function (x) {
    var what = GBL.LABEL[x.line] + (x.ref ? ' (' + x.ref + ')' : '');
    var extra = x.line === 'health' && x.summary && x.summary.divisions ? x.summary.divisions.map(function (d) { return d.name.replace(new RegExp(g.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(/^[\s\-–]+/, '') + ': ' + d.employees + ' employees'; }).join('; ') : x.members ? x.members + ' ' + (x.line === 'listbill' ? 'policies' : 'members') : '';
    return { what: what, extra: extra, due: x.due, arrears: x.arrears };
  });
  var subject = 'Your ' + label + ' billing: ' + g.name + ' (' + gcmMoney_(total) + ')';
  var stmt = '';
  try { stmt = gblStatementHtml_(g, gblStatementData_(g, month, L, gblSf_(g), bills), { inline: true }); } catch (e) { stmt = ''; }
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
    stmt +
    '<p style="margin:0 0 6px"><a href="' + GCM.SITE + 'client.html?from=bill" style="display:inline-block;background:#1d5bc4;color:#fff;text-decoration:none;font:700 14px Arial,sans-serif;padding:11px 18px;border-radius:8px">Open your service page</a></p>' +
    '<p style="margin:0 0 16px;font:13px/1.5 Arial,sans-serif;color:#5a687d">Sign in with your list bill <b>' + E(g.bills[0] || '') + '</b> and your access code <b>' + E(g.code || '(not set)') + '</b>.</p>' +
    '<p style="margin:0">Warm regards,<br><b>' + E(signer) + '</b><br>Ricky Rampersad Branch, Guardian Life of the Caribbean<br><span style="color:#5a687d">9-13 Endeavour 1st Street, Chaguanas · (868) 226-6461</span></p></td></tr></table></div>';
  return { subject: subject, text: text, html: html };
}

/* ── the EB0010 Group and Individual Policy Change Form, filled from our records ─────── */
/* 24 October 2026: "the form … GROUP AND INDIVIDUAL POLICY CHANGE FORM is filled as we do have the data and always sent to
 * EBCustomercare@myguardiangroup.com and copy rickyrampersadsalessupport@myguardiangroup.com as well
 * support@rickyrampersadbranch.com", then "when a client wants to terminate they should be able to search the name and all
 * the data mapped onto the form populated as it's pulled from our data … all data should be on the forms exactly".
 * A group (on its service page) or a staff member (on the billing review) searches a member by name, the member's record
 * fills Section A of Guardian's form EB0010 (2024/3) exactly as the form lays it out, the change goes in its own section,
 * the form is rendered as a PDF and e-mailed from support@ to EB Customer Care with the two copies; logged on Group
 * Changes with the form kept, noted on the billing task, and a task opened for the account owner. Test mode until
 * gblGoLive: to the staff member (or the account owner, for a group's submission) and the branch, marked TEST. */
var GBL_FORM = { CODE: 'EB0010', VERSION: '2024/3', TO: 'EBCustomercare@myguardiangroup.com',
  CC: ['rickyrampersadsalessupport@myguardiangroup.com', 'support@rickyrampersadbranch.com'], CACHE_S: 600, MAX: 12,
  KINDS: { terminate: 'Termination of the primary insured', adddep: 'Dependent(s) to be covered', removedep: 'Dependent(s) to be removed',
    address: 'Change of address', beneficiary: 'Beneficiary change', bank: 'Account for payment of claims', plan: 'Policy change' },
  CHANGE: { terminate: 'leaver', adddep: 'dependent', removedep: 'dependent', address: 'address', beneficiary: 'beneficiary', bank: 'bank', plan: 'plan' } };
/** The group's members on Group Health and Group Life, with everything the form asks for: read from Salesforce in one
 *  query, their dependents from Relationship Groups in a second, kept ten minutes. */
function gblMembers_(g, fresh) {
  var key = 'gbl-mem-' + g.key.slice(0, 40), cache = null;
  try { cache = CacheService.getScriptCache(); if (!fresh) { var c = cache.get(key); if (c) return JSON.parse(c); } } catch (e) {}
  var out = { ok: tSfOn_(), members: [], error: '' };
  if (!out.ok) { out.error = 'Salesforce is not linked to this project.'; return out; }
  try {
    var accts = g.acctsFull && g.acctsFull.length ? g.acctsFull : g.accts, bills = [];
    g.bills.forEach(function (b) { [b, b.replace(/\s+/g, ''), b.replace(/^([A-Za-z]+)\s*(\d+)$/, '$1 $2')].forEach(function (v) { if (bills.indexOf(v) < 0) bills.push(v); }); });
    var where = [];
    if (accts.length) where.push('Account__c IN (' + gcmIn_(accts) + ')');
    if (bills.length) where.push('List_Bill__c IN (' + gcmIn_(bills) + ')');
    if (!where.length) return out;
    var F = 'Id, POLICY__c, Certificate__c, RecordType.Name, Policy_Status_Description__c, Date_Of_Birth__c, Birthdate__c, FIRST_NAME__c, LAST_NAME__c, Email__c, Client_Email__c, ' +
      'Home_Phone__c, Home_Tele__c, Work__c, Work_Number__c, Business_Phone__c, Mobile__c, Cell__c, Mobile_R__c, PLAN_NAME__c, Plan_Description__c, Product_Name__c, ISSUE_DATE__c, ' +
      'Address_1__c, Address_2__c, Address_3__c, Street__c, City__c, Mailing_Address_1__c, Benificiary_1__c, Benificiary_2__c, Benificiary_3__c, Status_Change_Date__c, ' +
      'Contact__c, Contact__r.Name, Contact__r.FirstName, Contact__r.LastName, Contact__r.Birthdate, Contact__r.Gender__c, Contact__r.Email, Contact__r.Preferred_Email__c, ' +
      'Contact__r.Phone, Contact__r.MobilePhone, Contact__r.HomePhone, Contact__r.Business_Phone__c, Contact__r.MailingStreet, Contact__r.MailingCity, Account__r.Name';
    var domain = gblGroupDomain_(g), byContact = {};
    gcmQuery_('SELECT ' + F + ' FROM CLIENT_PORTFOLIO__c WHERE (' + where.join(' OR ') + ") AND RecordType.Name IN ('HEALTH (GROUP)', 'LIFE(GROUP)') ORDER BY Contact__r.Name").forEach(function (p) {
      var c = p.Contact__r || {}, rt = gcmName_(p, 'RecordType'), st = String(p.Policy_Status_Description__c || '');
      var emails = [], tel = function () { for (var i = 0; i < arguments.length; i++) { var v = gblTel_(arguments[i]); if (v) return v; } return ''; };
      [c.Email, p.Email__c, p.Client_Email__c, c.Preferred_Email__c].forEach(function (e) { e = String(e || '').trim().toLowerCase(); if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && emails.indexOf(e) < 0) emails.push(e); });
      var work = emails.filter(function (e) { return domain && e.split('@')[1] === domain; })[0] || '', personal = emails.filter(function (e) { return e !== work; })[0] || '';
      var addr = [p.Address_1__c, p.Address_2__c, p.Address_3__c].map(function (x) { return String(x || '').replace(/\s+/g, ' ').trim(); }).filter(String).join(', ') || String(c.MailingStreet || '').replace(/\s+/g, ' ').trim();
      var city = String(p.City__c || c.MailingCity || '').trim();
      var name = gcmName_(p, 'Contact__r') || [p.FIRST_NAME__c, p.LAST_NAME__c].filter(String).join(' ');
      var m = { id: String(p.Id), contactId: String(p.Contact__c || ''), line: rt === GBL.POL.health ? 'health' : 'life', rt: rt, policy: String(p.POLICY__c || '').trim(), cert: String(p.Certificate__c || '').trim(),
        name: gblTitle_(name), first: String(c.FirstName || p.FIRST_NAME__c || ''), last: String(c.LastName || p.LAST_NAME__c || ''), status: st, live: !GBL.GONE.test(st),
        dob: gcmYmd_(p.Date_Of_Birth__c) || gcmYmd_(c.Birthdate) || gcmYmd_(p.Birthdate__c) || '', gender: gblGender_(c.Gender__c), emailPersonal: personal, emailWork: work,
        telHome: tel(p.Home_Phone__c, p.Home_Tele__c, c.HomePhone), telWork: tel(p.Work__c, p.Work_Number__c, p.Business_Phone__c, c.Phone, c.Business_Phone__c), telCell: tel(p.Cell__c, p.Mobile__c, p.Mobile_R__c, c.MobilePhone),
        address: addr, city: city, plan: String(p.PLAN_NAME__c || p.Plan_Description__c || p.Product_Name__c || '').trim(), issued: gcmYmd_(p.ISSUE_DATE__c), changed: gcmYmd_(p.Status_Change_Date__c),
        bens: [p.Benificiary_1__c, p.Benificiary_2__c, p.Benificiary_3__c].map(function (x) { return String(x || '').trim(); }).filter(String), deps: [], acct: gcmName_(p, 'Account__r') };
      out.members.push(m);
      if (m.contactId) (byContact[gcmId15_(m.contactId)] = byContact[gcmId15_(m.contactId)] || []).push(m);
    });
    var ids = Object.keys(byContact);
    for (var i = 0; i < ids.length; i += GCM.CHUNK) {
      gcmQuery_('SELECT Primary_Name__c, Secondary_Name__r.Name, Secondary_Name__r.Gender__c, Secondary_DOB__c, Child_1__r.Name, Child_1__r.Gender__c, DOB1__c, Child_2__r.Name, Child_2__r.Gender__c, DOB2__c, ' +
        'Child_3__r.Name, Child_3__r.Gender__c, DOB3__c, Dependent_1__r.Name, Dependent_1__r.Gender__c, DOBD1__c, Relationship_1__c, Dependent_2__r.Name, Dependent_2__r.Gender__c, DOBD2__c, Relationship_2__c, ' +
        'Dependent_3__r.Name, Dependent_3__r.Gender__c, DOBD3__c, Relationship_3__c FROM Relationship_Groups__c WHERE Primary_Name__c IN (' + gcmIn_(ids.slice(i, i + GCM.CHUNK)) + ')').forEach(function (r) {
        var deps = [], add = function (rel, who, dob) { var n = who && who.Name ? gblTitle_(who.Name) : ''; if (n) deps.push({ rel: rel, name: n, gender: gblGender_(who.Gender__c), dob: gcmYmd_(dob) || '' }); };
        add('SPOUSE', r.Secondary_Name__r, r.Secondary_DOB__c); add('CHILD', r.Child_1__r, r.DOB1__c); add('CHILD', r.Child_2__r, r.DOB2__c); add('CHILD', r.Child_3__r, r.DOB3__c);
        add(String(r.Relationship_1__c || 'DEPENDENT').toUpperCase(), r.Dependent_1__r, r.DOBD1__c); add(String(r.Relationship_2__c || 'DEPENDENT').toUpperCase(), r.Dependent_2__r, r.DOBD2__c); add(String(r.Relationship_3__c || 'DEPENDENT').toUpperCase(), r.Dependent_3__r, r.DOBD3__c);
        (byContact[gcmId15_(r.Primary_Name__c)] || []).forEach(function (m) { m.deps = m.deps.concat(deps); });
      });
    }
    try { if (cache) cache.put(key, JSON.stringify(out), GBL_FORM.CACHE_S); } catch (e2) {}
  } catch (e) { out.ok = false; out.error = String(e && e.message ? e.message : e).slice(0, 200); }
  return out;
}
function gblGroupDomain_(g) {
  var d = '';
  (g.to || []).concat(g.cc || []).forEach(function (e) { e = String(e || '').toLowerCase(); var m = /@([^@\s]+)$/.exec(e); if (!d && m && !/gmail|yahoo|hotmail|outlook|live\.|icloud|aol\./.test(m[1])) d = m[1]; });
  return d;
}
function gblTel_(v) { v = String(v || '').replace(/[^\d+()\-\s]/g, '').replace(/\s+/g, ' ').trim(); return v.replace(/\D/g, '').length >= 7 ? v : ''; }
function gblGender_(v) { v = String(v || '').trim().toUpperCase(); return /^F/.test(v) ? 'F' : /^M/.test(v) ? 'M' : ''; }
/** Members whose name, policy or certificate carries every word typed, the live ones first; at most GBL_FORM.MAX. */
function gblMemberSearch_(g, q, fresh) {
  var M = gblMembers_(g, fresh); if (!M.ok) return M;
  var words = String(q || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(String);
  if (!words.length) return { ok: true, members: [], total: M.members.length };
  var hits = M.members.filter(function (m) {
    var hay = (m.name + ' ' + m.policy + ' ' + m.cert).toLowerCase(), parts = hay.split(/[\s,;-]+/);
    return words.every(function (w) { return parts.some(function (p) { return p.indexOf(w) === 0; }) || hay.indexOf(w) >= 0; });
  }).sort(function (a, b) { return (b.live - a.live) || a.name.localeCompare(b.name); });
  return { ok: true, total: M.members.length, members: hits.slice(0, GBL_FORM.MAX).map(function (m) {
    return { id: m.id, name: m.name, line: m.line, label: GBL.LABEL[m.line], policy: m.policy, cert: m.cert, status: m.status, live: m.live, dob: m.dob, plan: m.plan, since: m.issued, deps: m.deps.length };
  }), more: hits.length > GBL_FORM.MAX };
}
function gblMemberById_(g, id, fresh) {
  var M = gblMembers_(g, fresh); if (!M.ok) return null;
  return M.members.filter(function (m) { return gcmId15_(m.id) === gcmId15_(id); })[0] || null;
}
/** What goes on the form: the member's record in Section A, the change in its own section, and who is submitting it. */
function gblFormData_(g, m, b, who) {
  var kind = String(b.kind || 'terminate').toLowerCase(); if (!GBL_FORM.KINDS[kind]) kind = 'terminate';
  var eff = gcmYmd_(b.effective || '') || '', today = gcmToday_();
  var deps = gblFormDeps_(b.deps), bens = gblFormDeps_(b.bens, true);
  var d = { code: GBL_FORM.CODE, version: GBL_FORM.VERSION, kind: kind, kindLabel: GBL_FORM.KINDS[kind], effective: eff, reason: String(b.reason || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    policy: m.policy + (m.cert && m.cert !== m.policy ? ' / ' + m.cert : ''), line: m.line, lineLabel: GBL.LABEL[m.line], holder: g.name, insured: m.name.toUpperCase(), dob: m.dob,
    emailPersonal: m.emailPersonal, emailWork: m.emailWork, telHome: m.telHome, telWork: m.telWork, telExt: '', telCell: m.telCell, marital: gblMarital_(b.marital), planType: 'GROUP',
    addDeps: kind === 'adddep' ? deps.map(function (x) { x.reason = x.reason || String(b.reason || '').slice(0, 60); x.on = x.on || eff; return x; }) : [],
    removeDeps: kind === 'removedep' ? deps.map(function (x) { x.on = x.on || eff; return x; }) : kind === 'terminate' ? m.deps.map(function (x) { return { rel: x.rel, name: x.name, gender: x.gender, dob: x.dob, on: eff }; }) : [],
    addBens: kind === 'beneficiary' ? bens.filter(function (x) { return !x.remove; }) : [], removeBens: kind === 'beneficiary' ? bens.filter(function (x) { return x.remove; }).map(function (x) { x.on = x.on || eff; return x; }) : [],
    bensOnFile: who.role === 'client' ? [] : m.bens, plan: { name: m.plan, provisor: /provisor/i.test(m.plan), global: /global/i.test(m.plan), deductible: String(b.deductible || ''), major: String(b.major || ''), mode: '' },
    address: kind === 'address' ? String(b.address || '').replace(/\s+/g, ' ').trim().slice(0, 240) : '', addressOnFile: [m.address, m.city].filter(String).join(', '),
    bank: kind === 'bank' ? { name: String(b.bankName || '').slice(0, 80), account: String(b.bankAccount || '').replace(/[^\d\-]/g, '').slice(0, 40), branch: String(b.bankBranch || '').slice(0, 80) } : { name: '', account: '', branch: '' },
    admin: { name: String(b.admin || '').replace(/\s+/g, ' ').trim().slice(0, 80), date: today }, submitted: { by: who.name, role: who.role === 'client' ? 'the group’s plan administrator, on the group’s service page' : 'Ricky Rampersad Branch', when: gcmWhen_(new Date()) },
    member: { id: m.id, name: m.name, line: m.line, status: m.status, plan: m.plan }, missing: [] };
  if (!d.dob) d.missing.push('date of birth');
  if (!d.emailPersonal && !d.emailWork) d.missing.push('an e-mail address');
  if (!d.telHome && !d.telWork && !d.telCell) d.missing.push('a telephone number');
  if (!d.marital) d.missing.push('marital status');
  if (!eff) d.missing.push('the effective date');
  if (kind === 'adddep' && !d.addDeps.length) d.missing.push('the dependent(s) to be covered');
  if (kind === 'removedep' && !d.removeDeps.length) d.missing.push('the dependent(s) to be removed');
  if (kind === 'address' && !d.address) d.missing.push('the new address');
  if (kind === 'bank' && (!d.bank.name || !d.bank.account)) d.missing.push('the bank and the account number');
  if (kind === 'beneficiary' && !d.addBens.length && !d.removeBens.length) d.missing.push('the beneficiary to add or remove');
  if (!d.admin.name) d.missing.push('the plan administrator’s name (Section F)');
  d.blocking = d.missing.filter(function (x) { return !/date of birth|e-mail|telephone|marital/.test(x); });
  return d;
}
function gblMarital_(v) { v = String(v || '').trim().toUpperCase(); return ['SINGLE', 'MARRIED', 'COMMON LAW', 'DIVORCED', 'WIDOWED'].indexOf(v) >= 0 ? v : ''; }
function gblFormDeps_(list, ben) {
  if (typeof list === 'string') list = gblJ_(list, []);
  return (Array.isArray(list) ? list : []).map(function (x) {
    x = x || {};
    var o = { rel: String(x.rel || '').toUpperCase().slice(0, 20), name: String(x.name || '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 80), gender: gblGender_(x.gender), dob: gcmYmd_(x.dob || '') || '', on: gcmYmd_(x.on || '') || '' };
    if (ben) { o.pct = Number(x.pct) || 0; o.remove = gcmYes_(x.remove); } else o.reason = String(x.reason || '').slice(0, 60);
    return o;
  }).filter(function (o) { return o.name; }).slice(0, 4);
}
/** The form, exactly as EB0010 (2024/3) lays it out, with the record in its boxes. Letter size, two pages. */
function gblFormHtml_(d) {
  var E = tEsc_, dmy = function (y) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(y || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
  var box = function (on, label) { return '<span class="cb">' + (on ? '&#9746;' : '&#9744;') + '</span> ' + E(label); };
  var cell = function (v, w) { return '<td' + (w ? ' style="width:' + w + '"' : '') + '><span class="v">' + E(v || '') + '</span></td>'; };
  var rows = function (list, rels, cols) {
    var out = ''; var fixed = rels.slice();
    for (var i = 0; i < fixed.length; i++) { var x = list[i] || {}; out += '<tr><td class="rel">' + E(x.rel || fixed[i]) + '</td>' + cols(x) + '</tr>'; }
    return out;
  };
  var depCols = function (x) { return cell(x.name) + cell(x.gender, '9%') + cell(dmy(x.dob), '15%') + cell(x.reason, '18%') + cell(dmy(x.on), '15%'); };
  var remCols = function (x) { return cell(x.name) + cell(x.gender, '9%') + cell(dmy(x.dob), '15%') + cell(dmy(x.on), '18%'); };
  var benCols = function (x) { return cell(x.name) + cell(x.gender, '9%') + cell(dmy(x.dob), '15%') + cell(x.pct ? x.pct + '%' : '', '18%'); };
  var head = '<div class="hd"><div class="l">' + E(d.version) + ' – ' + E(d.code) + '</div><div class="t">GROUP AND INDIVIDUAL POLICY CHANGE FORM</div><div class="s">PLEASE COMPLETE IN BLOCK LETTERS</div></div>';
  var note = '<div class="note"><b>Change requested:</b> ' + E(d.kindLabel) + (d.effective ? ', effective ' + E(dmy(d.effective)) : '') + (d.reason ? ' · ' + E(d.reason) : '') +
    '<br>Pre-filled from Guardian Life of the Caribbean’s records by Ricky Rampersad Branch for ' + E(d.holder) + ' (' + E(d.lineLabel) + ') · submitted by ' + E(d.submitted.by) + ', ' + E(d.submitted.role) + ', ' + E(d.submitted.when) + '.</div>';
  var css = '<style>@page{size:letter;margin:12mm}body{font:10.5px/1.3 Arial,Helvetica,sans-serif;color:#000;margin:0}.pg{page-break-after:always}.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:6px}.hd .l{font-size:9px}.hd .t{font-weight:700;font-size:15px;letter-spacing:.02em}.hd .s{font-size:9px;font-weight:700}' +
    '.note{border:1px solid #1d5bc4;background:#eef4fc;padding:5px 8px;margin:0 0 8px;font-size:9.5px}h3{background:#d9d9d9;font-size:10.5px;margin:9px 0 4px;padding:3px 6px;letter-spacing:.03em}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #000;padding:4px 5px;vertical-align:top;font-size:10px;text-align:left}th{background:#f2f2f2;font-weight:700;font-size:9px}' +
    '.v{font-weight:700;text-transform:uppercase}.lab{font-weight:400;font-size:9px;display:block;color:#222}.rel{font-weight:700;width:14%}.cb{font-size:13px;line-height:1}.cbs span.cb{margin-left:6px}.small{font-size:8.5px;margin:3px 0 0}.sig td{height:30px}.blank{height:34px}.stamp{border:1px dashed #000;height:70px;display:flex;align-items:center;justify-content:center;font-size:9px}.pol{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:2px 0 6px;font-weight:700}.pol .v{border-bottom:1px solid #000;min-width:220px;display:inline-block;padding:0 6px}</style>';
  var a = '<h3>SECTION A – POLICYHOLDER/PRIMARY INSURED INFORMATION</h3><table>' +
    '<tr><td style="width:50%"><span class="lab">POLICYHOLDER:</span><span class="v">' + E(d.holder) + '</span></td><td><span class="lab">NAME OF PRIMARY INSURED:</span><span class="v">' + E(d.insured) + '</span></td></tr>' +
    '<tr><td><span class="lab">DATE OF BIRTH: (dd/mm/yyyy)</span><span class="v">' + E(dmy(d.dob)) + '</span></td><td><span class="lab">EMAIL ADDRESS (Personal):</span><span class="v" style="text-transform:none">' + E(d.emailPersonal) + '</span></td></tr>' +
    '<tr><td><span class="lab">EMAIL ADDRESS (Work):</span><span class="v" style="text-transform:none">' + E(d.emailWork) + '</span></td><td><span class="lab">TELEPHONE (Home):</span><span class="v">' + E(d.telHome) + '</span> &nbsp; <span class="lab" style="display:inline">(Work):</span> <span class="v">' + E(d.telWork) + '</span> &nbsp; <span class="lab" style="display:inline">Ext:</span> <span class="v">' + E(d.telExt) + '</span> &nbsp; <span class="lab" style="display:inline">(Cellular):</span> <span class="v">' + E(d.telCell) + '</span></td></tr>' +
    '<tr><td class="cbs"><span class="lab">MARITAL STATUS:</span>' + ['SINGLE', 'MARRIED', 'COMMON LAW', 'DIVORCED', 'WIDOWED'].map(function (k) { return box(d.marital === k, k.charAt(0) + k.slice(1).toLowerCase()); }).join(' ') + '</td>' +
    '<td class="cbs"><span class="lab">TYPE OF PLAN:</span>' + box(d.planType === 'GROUP', 'GROUP') + ' &nbsp; ' + box(d.planType === 'INDIVIDUAL', 'INDIVIDUAL') + '</td></tr></table>';
  var b1 = '<h3>SECTION B – DEPENDENT(S) TO BE COVERED</h3><table><tr><th style="width:14%">RELATIONSHIP</th><th>NAME OF DEPENDENT/S</th><th style="width:9%">GENDER (M/F)</th><th style="width:15%">DATE OF BIRTH (dd/mm/yyyy)</th><th style="width:18%">REASON FOR CHANGE</th><th style="width:15%">DATE CHANGE OCCURRED (dd/mm/yyyy)</th></tr>' +
    rows(d.addDeps, ['SPOUSE', 'CHILD', 'CHILD', 'CHILD', 'CHILD'], depCols) + '</table>' +
    '<p class="small">*An eligible dependent is your lawful spouse, unmarried children, stepchildren or legally adopted children under the age of twenty-two (22). *Extended Coverage is provided to unmarried sons and daughters, stepchildren, legally adopted children that are full-time students at an accredited College or University. A school letter is required every academic year for children attending full-time Tertiary school from age 22 to attainment of age 25.</p>';
  var b2 = '<h3>SECTION B (ii) – DEPENDENT(S) TO BE REMOVED</h3><table><tr><th style="width:14%">RELATIONSHIP</th><th>NAME OF DEPENDENT/S</th><th style="width:9%">GENDER (M/F)</th><th style="width:15%">DATE OF BIRTH (dd/mm/yyyy)</th><th style="width:18%">EFFECTIVE DATE (dd/mm/yyyy)</th></tr>' +
    rows(d.removeDeps, ['SPOUSE', 'CHILD', 'CHILD', 'CHILD'], remCols) + '</table>';
  var c1 = '<h3>SECTION C – BENEFICIARY TO BE ADDED</h3><table><tr><th style="width:14%">RELATIONSHIP</th><th>NAME OF BENEFICIARY</th><th style="width:9%">GENDER (M/F)</th><th style="width:15%">DATE OF BIRTH (dd/mm/yyyy)</th><th style="width:18%">% (total must equal 100%)</th></tr>' +
    rows(d.addBens, ['SPOUSE', 'CHILD', 'CHILD', 'CHILD'], benCols) + '</table>';
  var c2 = '<h3>SECTION C (ii) – BENEFICIARY TO BE REMOVED</h3><table><tr><th style="width:14%">RELATIONSHIP</th><th>NAME OF BENEFICIARY</th><th style="width:9%">GENDER (M/F)</th><th style="width:15%">DATE OF BIRTH (dd/mm/yyyy)</th><th style="width:18%">EFFECTIVE DATE (dd/mm/yyyy)</th></tr>' +
    rows(d.removeBens, ['SPOUSE', 'CHILD', 'CHILD', 'CHILD'], remCols) + '</table>' + (d.bensOnFile.length ? '<p class="small">On file with Guardian Life: ' + E(d.bensOnFile.join('; ')) + '.</p>' : '');
  var dd = '<h3>SECTION D – POLICY CHANGES</h3><table><tr><td class="cbs" style="width:50%"><span class="lab">PLAN TYPE:</span>' + box(d.plan.provisor, 'PROVISOR') + ' &nbsp; ' + box(d.plan.global, 'GLOBAL CARE PLUS') + (d.plan.name ? ' <span class="small">(on record: ' + E(d.plan.name) + ')</span>' : '') + '</td>' +
    '<td class="cbs"><span class="lab">DEDUCTIBLE:</span>' + ['$500', '$1,000', '$2,500'].map(function (k) { return box(d.plan.deductible === k, k); }).join(' ') + ' &nbsp; Global Care: <span class="v">' + E(d.plan.deductible && ['$500', '$1,000', '$2,500'].indexOf(d.plan.deductible) < 0 ? d.plan.deductible : '') + '</span></td></tr>' +
    '<tr><td class="cbs"><span class="lab">MAJOR MEDICAL:</span>' + box(/^inc/i.test(d.plan.major), 'INCREASE') + ' ' + box(/^dec/i.test(d.plan.major), 'DECREASE') + ' &nbsp; ' + ['$250,000', '$500,000', '$1,000,000'].map(function (k) { return box(d.plan.major.indexOf(k) >= 0, k); }).join(' ') + '</td>' +
    '<td class="cbs"><span class="lab">PREMIUM MODE:</span>' + box(d.plan.mode === 'ANNUAL', 'ANNUAL') + ' &nbsp; ' + box(d.plan.mode === 'SEMI-ANNUAL', 'SEMI-ANNUAL') + '</td></tr>' +
    '<tr><td colspan="2"><span class="lab">CHANGE OF ADDRESS (Proof of address required – copy of a utility bill not older than three months in the name of the primary insured):</span><span class="v">' + E(d.address) + '</span>' + (d.addressOnFile && d.kind === 'address' ? '<span class="small">On file: ' + E(d.addressOnFile) + '</span>' : '') + '</td></tr></table>';
  var e = '<h3>SECTION E – ACCOUNT INFORMATION FOR PAYMENT OF CLAIMS CHANGE</h3><table><tr><td style="width:50%"><span class="lab">NAME OF BANK:</span><span class="v">' + E(d.bank.name) + '</span></td><td><span class="lab">ACCOUNT NUMBER: (confirm with copy of bank statement)</span><span class="v">' + E(d.bank.account) + '</span></td></tr>' +
    '<tr><td colspan="2"><span class="lab">PLEASE ATTACH A COPY OF BANK STATEMENT SHOWING INSURED’S NAME AND BANK ACCOUNT NUMBER (The header (top) of the Bank Statement displaying name and account number is acceptable)</span></td></tr>' +
    '<tr><td colspan="2"><span class="lab">NAME OF BRANCH:</span><span class="v">' + E(d.bank.branch) + '</span></td></tr></table>' +
    '<p class="small">I, the undersigned, do hereby authorize Guardian Life of the Caribbean to effect action as requested above with respect to the modification of records applicable to the dispatch of my Health Claim payments via ACH, and to initiate contact with me via the email address and/or cellular telephone number stated herein. I acknowledge Guardian Life of the Caribbean is not liable for any incorrect information submitted on this form. I understand that the ACH banking information stated herein supersedes any and all other ACH banking information previously submitted.</p>' +
    '<p class="small">I hereby declare that the above information is true and complete and shall form part of my application to Guardian Life of the Caribbean Limited.</p>' +
    '<table class="sig"><tr><td style="width:60%"><span class="lab">PRIMARY INSURED’S SIGNATURE:</span></td><td><span class="lab">DATE: (dd/mm/yyyy)</span></td></tr><tr><td><span class="lab">SPOUSE’S SIGNATURE:</span></td><td><span class="lab">DATE: (dd/mm/yyyy)</span></td></tr><tr><td><span class="lab">WITNESS (Applicable for beneficiary changes only):</span></td><td><span class="lab">DATE: (dd/mm/yyyy)</span></td></tr></table>';
  var f = '<h3>SECTION F – FOR OFFICIAL USE ONLY (TO BE COMPLETED BY THE GROUP POLICY HOLDER)</h3><table><tr><td style="width:50%"><span class="lab">PLAN ADMINISTRATOR: NAME:</span><span class="v">' + E(d.admin.name) + '</span></td><td><span class="lab">SIGNATURE:</span><span class="blank"></span></td></tr>' +
    '<tr><td><span class="lab">DATE: (dd/mm/yyyy)</span><span class="v">' + E(dmy(d.admin.date)) + '</span></td><td><div class="stamp">PLACE COMPANY STAMP HERE</div></td></tr></table>';
  var pol = '<div class="pol">POLICY NO. / CERTIFICATE NO. <span class="v">' + E(d.policy) + '</span></div>';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + E(d.code) + ' Policy Change Form – ' + E(d.insured) + '</title>' + css + '</head><body>' +
    '<div class="pg">' + head + note + pol + a + b1 + b2 + c1 + '</div><div>' + head + c2 + dd + e + f + '</div></body></html>';
}
/* ── Guardian's own PDF forms, filled exactly (24 October 2026) ───────────────────────────────────────────────────────── */
/* "Forms have to be exactly on the forms I've uploaded to you. Enrollments, everything. It needs to be exact." So the form
 * that goes to EB Customer Care is Guardian's PDF itself with the values typed into its own boxes, never a redrawn page.
 * EB0010 (2024/3) and GIO001 (V.1/10-2016) are fillable PDFs: each box is an AcroForm field, and GBL_EB0010 / GBL_GIO001
 * name the field for each value (EB0010's field names are random strings, so they were mapped box by box from the form).
 * The EASI Collect form is flat, so GBL_EASI holds where each value is drawn. pdf-lib does the filling, inside one call:
 * a web app cannot await, and pdf-lib only ever waits on the CPU, so it runs under a Promise that settles at once
 * (gblSyncPromise_). The blank forms are read from the site (groupclientmanagement/forms/<file>); a file of the same
 * name in the Drive folder the GCM_FORMS_FOLDER Script property names wins, so a new edition from Guardian is a file
 * swap, and the sent copies are kept there too. Nothing is flattened: a box can still be corrected in Reader. */
var GBL_PDF = {
  FOLDER_PROP: 'GCM_FORMS_FOLDER', SITE: 'https://rickyrampersadbranch.com/groupclientmanagement/forms/',
  LIB: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', LIB_NAME: 'pdf-lib.min.js',
  FILES: { EB0010: 'EB0010-2024-3.pdf', GIO001: 'GIO001.pdf', EASI: 'EASI-Collect.pdf' },
  TITLES: { EB0010: 'Policy Change Form', GIO001: 'Group Health and Life Application Form', EASI: 'Collect Enrolment/Change Form' }, /* code + title is the subject line */
  VERSIONS: { EB0010: '2024/3', GIO001: 'V.1/10-2016', EASI: '' },
  SENT: 'Sent forms', MAXSIZE: 11, MINSIZE: 6
};
var GBL_EB0010 = {
  policy: 'Text-wc1J3leoBl', holder: 'Text-XhJgZzV4Ti', insured: 'Text-6kWiTbOxVO', dob: 'Text-OObtBFgSBC', emailPersonal: 'Text-EKwsAgkyf2', emailWork: 'Text-p7lMqK9-jQ',
  telHome: 'Text-0IF2JNW4ug', telWork: 'Text-I4PLLjo5Fo', telExt: 'Text-kkwuSjKsdM', telCell: 'Text-_1fi1VB9Bf',
  marital: { 'SINGLE': 'CheckBox-R8PTwSoOac', 'MARRIED': 'CheckBox-NXxr7iepzM', 'COMMON LAW': 'CheckBox-Os4d_GRunA', 'DIVORCED': 'CheckBox-NchEBm4LvC', 'WIDOWED': 'CheckBox-oWtnIZPROc' },
  plan: { 'GROUP': 'CheckBox-Qllbo8mRdN', 'INDIVIDUAL': 'CheckBox-Wf6g832N2D' },
  addDeps: [{ name: 'Text-9hUgcLWcYc', gender: 'Text--r_si-0zYx', dob: 'Text-CjEDRrr4a6', reason: 'Text-2hSlAJsAmx', on: 'Text-XBeLncxZtl' }, { name: 'Text-goqP5R5KNd', gender: 'Text-7x8cjbCgxM', dob: 'Text-Lslfh8MpDe', reason: 'Text-3G6B3RZUpg', on: 'Text-9Nl6QVCXTl' }, { name: 'Text-wmvCj1NuTy', gender: 'Text-V22FRY4aZw', dob: 'Text-khHjlVesWU', reason: 'Text-0z3ymrOn1s', on: 'Text-b9GaztJwpv' }, { name: 'Text-nd-6nX7fGo', gender: 'Text-mYUmNpERwz', dob: 'Text-N_bJPj563B', reason: 'Text-J9BG_e9ACD', on: 'Text-uVLT8sAZrX' }, { name: 'Text-xY9blr2_y9', gender: 'Text-2gxD6rFs_5', dob: 'Text-mZm29DB0bl', reason: 'Text-2m62Jdpp9j', on: 'Text-2NFi7GcwR5' }],
  removeDeps: [{ name: 'Text-0nSXJyOrWH', gender: 'Text-y8zys2z1NT', dob: 'Text-njWnL4YWLX', on: 'Text-AmZQyewNjy' }, { name: 'Text-Zf9SVAjlYQ', gender: 'Text-_FRP1X9R9W', dob: 'Text-1zuUOmwF4-', on: 'Text-gjiYn0XpTj' }, { name: 'Text-Utl47KhDhr', gender: 'Text-sAgGFb-Xwi', dob: 'Text-wmNhpg9mOY', on: 'Text-BtpkUI0h44' }, { name: 'Text-tjIaLlTFtI', gender: 'Text-aUmbbIjJL_', dob: 'Text-CVWOZhwH0N', on: 'Text-16hkICvv6f' }],
  addBens: [{ name: 'Text-LuWzomYHzG', gender: 'Text-m3CCxxihGx', dob: 'Text-KcmMj_4fFx', pct: 'Text-FsLnSx4yZ8' }, { name: 'Text-BWFf8hmOxb', gender: 'Text-lS5gRXjE7x', dob: 'Text-COu5ZXARgO', pct: 'Text-jo98ozwsiE' }, { name: 'Text-STwW2TZfDt', gender: 'Text-o02bNPyaDo', dob: 'Text-sGOR-fiFDB', pct: 'Text-LukiyK9ar3' }, { name: 'Text-NwChspsDtz', gender: 'Text-W-SBWCqvT7', dob: 'Text-tFmJeSRJJx', pct: 'Text-Al0ANORVW4' }],
  removeBens: [{ name: 'Text-CcxKAfyGWI', gender: 'Text-iN3y7TRdY6', dob: 'Text-h8BNkStE7j', on: 'Text-woVQVof5nl' }, { name: 'Text-0gtJrOhdJL', gender: 'Text-x8EHPkxz59', dob: 'Text-4qkyMwtJuX', on: 'Text-Nj3WOZ6YLD' }, { name: 'Text-JtwXNXGRXP', gender: 'Text-2gjyC8HcQQ', dob: 'Text-VgKU9A7bZq', on: 'Text-jNdPU3H97Y' }, { name: 'Text-21MMOyCJ0c', gender: 'Text-jmM9iMjNH0', dob: 'Text-we3sA2uCpP', on: 'Text-IHoYZ4zjRx' }],
  planType: { 'PROVISOR': 'CheckBox-78nsj7zlMD', 'GLOBAL CARE PLUS': 'CheckBox-3fjaSJNrI6' }, deductible: { '500': 'CheckBox-bnZxZ0JVEV', '1000': 'CheckBox-Ipv3oIPlTS', '2500': 'CheckBox-Vyu3phUZ9Q' }, globalCare: { check: 'CheckBox-o1jKe-gJZn', text: 'Text-hLhxJZUVem' },
  major: { 'INCREASE': 'CheckBox-tvwWkPJgmV', 'DECREASE': 'CheckBox-vXArtB3MXt', '250000': 'CheckBox-TRE0hEEy2i', '500000': 'CheckBox-oTyDMgk8ZW', '1000000': 'CheckBox-pPQeRTKoeZ' }, mode: { 'ANNUAL': 'CheckBox-QOuAWT1Xi_', 'SEMI-ANNUAL': 'CheckBox-223Y6wDYSn' },
  address: 'Paragraph-GTVy2UvWTn', bankChange: 'CheckBox-xlkJQmlahn', bankName: 'Text-naSrEKUKJa', bankBranch: 'Text-fq30i5X7NT', bankAccount: 'Text-wmjhDspcT0',
  accountCells: { page: 2, x0: 28.5, step: 17.3, y: 376, size: 11, n: 16 },
  signatures: { insured: 'Text-sna6F88dFP', insuredDate: 'Text-EYIVpivQXN', spouse: 'Text-1f7jXh8R4P', spouseDate: 'Text-PBD5WTqstg', witness: 'Text-JwcrdRp6w6', witnessDate: 'Text-JdctaN0dOL' },
  admin: { name: 'Text-Ys8UhtgDOE', signature: 'Text-MGtx5HI8uw', date: 'Text-8BOP7FtYWw', stamp: 'Paragraph-0TBGkU12FO' }
};
/* GIO001: Guardian's own field names; a radio option is its group's name plus the choice. */
var GBL_GIO001 = {
  policyLife: 'POLICY NO LIFE', policyHealth: 'POLICY NO HEALTH', holder: 'NAME OF POLICYHOLDER', employee: 'NAME OF EMPLOYEEINSURED', dob: 'DATE OF BIRTHddmmyyyy',
  email: 'EMAIL ADDRESS', gender: { group: 'DATE OF BIRTHddmmyyyy-0', M: 'DATE OF BIRTHddmmyyyy_MALE_On', F: 'DATE OF BIRTHddmmyyyy_FEMALE_On' },
  telHome: 'TELEPHONE Home', telWork: 'Work', telExt: 'Ext', telCell: 'Cellular',
  marital: { group: 'Work Ext', 'SINGLE': 'Work Ext_Single_On', 'MARRIED': 'Work Ext_Married_On', 'COMMON LAW': 'Work Ext_Common Law_On', 'DIVORCED': 'Work Ext_Divorced_On', 'WIDOWED': 'Work Ext_Widowed_On' },
  occupation: 'OCCUPATION', idType: { DP: 'DP', PP: 'PP', ID: 'ID' }, idNo: 'Please attach a copy Number',
  coverage: { health: 'GROUP HEALTH', life: 'GROUP LIFE', voluntary: 'VOLUNTARY LIFE', dependentLife: 'DEPENDENT LIFE' },
  otherPlan: { group: 'SECTION B  COORDINATION OF BENEFITS', yes: 'SECTION B  COORDINATION OF BENEFITS_Yes_On', no: 'SECTION B  COORDINATION OF BENEFITS_No_On' },
  otherPlanName: 'If Yes please give a NAME OF PLAN', otherInsurer: 'b NAME OF INSURANCE COMPANY',
  deps: [{ name: 'NAME OF DEPENDENTS', gender: 'GENDER MF', dob: 'DATE OF BIRTH ddmmyyyy', on: 'EFFECTIVE DATE ddmmyyyy', country: 'COUNTRY OF RESIDENCE' },
    { name: 'NAME OF DEPENDENTS-0', gender: 'GENDER MF-0', dob: 'DATE OF BIRTH ddmmyyyy-0', on: 'EFFECTIVE DATE ddmmyyyy-0', country: 'COUNTRY OF RESIDENCE-0' },
    { name: 'NAME OF DEPENDENTS-1', gender: 'GENDER MF-1', dob: 'DATE OF BIRTH ddmmyyyy-1', on: 'EFFECTIVE DATE ddmmyyyy-1', country: 'COUNTRY OF RESIDENCE-1' },
    { name: 'NAME OF DEPENDENTS-2', gender: 'GENDER MF-2', dob: 'DATE OF BIRTH ddmmyyyy-2', on: 'EFFECTIVE DATE ddmmyyyy-2', country: 'COUNTRY OF RESIDENCE-2' },
    { name: 'NAME OF DEPENDENTS-3', gender: 'GENDER MF-3', dob: 'DATE OF BIRTH ddmmyyyy-3', on: 'EFFECTIVE DATE ddmmyyyy-3', country: 'COUNTRY OF RESIDENCE-3' }],
  bens: [{ rel: 'RELATIONSHIP', name: 'NAME OF BENEFICIARY', gender: 'GENDER MF-4', dob: 'DATE OF BIRTH ddmmyyyy-4', pct: 'PERCENTAGE' },
    { rel: 'RELATIONSHIP-0', name: 'NAME OF BENEFICIARY-0', gender: 'GENDER MF-5', dob: 'DATE OF BIRTH ddmmyyyy-5', pct: 'PERCENTAGE-0' },
    { rel: 'RELATIONSHIP-1', name: 'NAME OF BENEFICIARY-1', gender: 'GENDER MF-6', dob: 'DATE OF BIRTH ddmmyyyy-6', pct: 'PERCENTAGE-1' },
    { rel: 'RELATIONSHIP-2', name: 'NAME OF BENEFICIARY-2', gender: 'GENDER MF-7', dob: 'DATE OF BIRTH ddmmyyyy-7', pct: 'PERCENTAGE-2' },
    { rel: 'RELATIONSHIP-3', name: 'NAME OF BENEFICIARY-3', gender: 'GENDER MF-8', dob: 'DATE OF BIRTH ddmmyyyy-8', pct: 'PERCENTAGE-3' }],
  account: 'Textfield', accountType: { SAVINGS: 'SAVINGS', CHEQUING: 'CHEQUING' }, bankName: 'NAME OF BANK', bankBranch: 'NAME OF BRANCH',
  employeeSignature: 'EMPLOYEE SIGNATURE', signedOn: 'DATE ddmmyyyy',
  employed: 'DATE EMPLOYED ddmmyyyy', confirmed: 'DATE OF CONFIRMATION ddmmyyyy', effective: 'EFFECTIVE DATE OF COVERAGE ddmmyyyy',
  tier: { group: 'COVERAGE TIER tick as applicable', SINGLE: 'COVERAGE TIER tick as applicable_SINGLE_On', 'EMPLOYEE + ONE': 'COVERAGE TIER tick as applicable_EMPLOYEE  ONE_On', 'EMPLOYEE + FAMILY': 'COVERAGE TIER tick as applicable_EMPLOYEE  FAMILY_On' },
  salary: 'BD', admin: { name: 'NAME', signature: 'SIGNATURE', stamp: 'PLACE COMPANY STAMP HERE' }
};
/* EASI Collect (flat): where each value is drawn, in PDF points from the bottom-left of the Letter page. */
var GBL_EASI = { page: 1, size: 10, mark: 'X', markSize: 12,
  kind: { enrol: [73, 669], change: [235, 669], terminate: [412, 669] },
  first: [72, 618], middle: [222, 618], last: [360, 618], email: [72, 571], cell: [375, 571],
  plan: { group: [78, 535], individual: [248, 535], provider: [380, 535] }, company: [76, 497], policy: [250, 497], providerName: [375, 497],
  idType: { national: [78, 436], permit: [244, 436], passport: [411, 436] }, idNo: [90, 408],
  bank: [76, 334], branch: [307, 334], account: { x0: 82, step: 31.2, y: 278, size: 13, n: 16 }, accountType: { savings: [78, 202], chequing: [249, 202] } };

/** A Promise that settles and runs its callbacks at once: pdf-lib never waits on I/O, so under it the library runs to
 *  the end inside one call, which is what a web app (no event loop to await on) needs. */
function gblSyncPromise_() {
  function P(executor) {
    var self = this; self.s = 0; self.v = undefined; self.q = [];
    function settle(state, value) {
      if (self.s) return;
      if (state === 1 && value && typeof value.then === 'function') { value.then(function (v) { settle(1, v); }, function (e) { settle(2, e); }); return; }
      self.s = state; self.v = value; var q = self.q; self.q = []; q.forEach(function (f) { f(); });
    }
    try { executor(function (v) { settle(1, v); }, function (e) { settle(2, e); }); } catch (e) { settle(2, e); }
  }
  P.prototype.then = function (onF, onR) {
    var self = this;
    return new P(function (resolve, reject) {
      function run() {
        try {
          if (self.s === 1) resolve(typeof onF === 'function' ? onF(self.v) : self.v);
          else if (typeof onR === 'function') resolve(onR(self.v)); else reject(self.v);
        } catch (e) { reject(e); }
      }
      if (self.s) run(); else self.q.push(run);
    });
  };
  P.prototype['catch'] = function (onR) { return this.then(undefined, onR); };
  P.prototype['finally'] = function (f) { return this.then(function (v) { f(); return v; }, function (e) { f(); throw e; }); };
  P.resolve = function (v) { return new P(function (r) { r(v); }); };
  P.reject = function (e) { return new P(function (r, j) { j(e); }); };
  P.all = function (arr) { return new P(function (resolve, reject) { var list = Array.prototype.slice.call(arr), out = [], n = 0; if (!list.length) return resolve(out); list.forEach(function (p, i) { P.resolve(p).then(function (v) { out[i] = v; if (++n === list.length) resolve(out); }, reject); }); }); };
  P.race = function (arr) { return new P(function (resolve, reject) { Array.prototype.slice.call(arr).forEach(function (p) { P.resolve(p).then(resolve, reject); }); }); };
  return P;
}
var GBL_PDFLIB_ = null;
/** pdf-lib, loaded once per execution: the Drive copy if the forms folder holds one, else cdnjs. */
function gblPdfLib_() {
  if (GBL_PDFLIB_) return GBL_PDFLIB_;
  var text = '', blob = gblFormFile_(GBL_PDF.LIB_NAME, true);
  if (blob) text = blob.getDataAsString();
  else { var res = UrlFetchApp.fetch(GBL_PDF.LIB, { muteHttpExceptions: true }); if (res.getResponseCode() !== 200) throw new Error('pdf-lib could not be fetched (HTTP ' + res.getResponseCode() + ')'); text = res.getContentText(); }
  var P = gblSyncPromise_();
  var lib = (new Function('Promise', 'setTimeout', 'self', 'window', 'exports', 'module', 'define', text + '\n;return (typeof PDFLib !== "undefined" ? PDFLib : this.PDFLib);'))(P, function (f) { f(); }, undefined, undefined, undefined, undefined, undefined);
  if (!lib || !lib.PDFDocument) throw new Error('pdf-lib did not load');
  GBL_PDFLIB_ = lib;
  return lib;
}
/** A blank form (or the library) as a Blob: the Drive folder's copy first, then the site's. */
function gblFormFile_(name, optional) {
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty(GBL_PDF.FOLDER_PROP) || ''; } catch (e) {}
  if (id) { try { var it = DriveApp.getFolderById(id).getFilesByName(name); if (it.hasNext()) return it.next().getBlob(); } catch (e) {} }
  if (optional) return null;
  var res = UrlFetchApp.fetch(GBL_PDF.SITE + name, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('The blank form ' + name + ' is neither in the forms folder nor on the site (HTTP ' + res.getResponseCode() + ').');
  return res.getBlob();
}
function gblU8_(bytes) { var u = new Uint8Array(bytes.length); for (var i = 0; i < bytes.length; i++) u[i] = bytes[i] & 255; return u; }
function gblSigned_(u8) { var a = new Array(u8.length); for (var i = 0; i < u8.length; i++) a[i] = u8[i] > 127 ? u8[i] - 256 : u8[i]; return a; }
function gblSync_(promise, what) {
  var out = { done: false, value: null, error: null };
  promise.then(function (v) { out.done = true; out.value = v; }, function (e) { out.done = true; out.error = e; });
  if (!out.done) throw new Error(what + ' did not finish inside the call');
  if (out.error) throw new Error(what + ': ' + String(out.error && out.error.message ? out.error.message : out.error).slice(0, 200));
  return out.value;
}
/** The form `code` filled: fill = { text: {field: value}, check: [field], radio: {group: option}, size: {field: pt},
 *  draw: [{page, x, y, text, size}] }. A text that would not fit its box is set smaller, down to MINSIZE. */
function gblPdfFill_(code, fill, name) {
  var lib = gblPdfLib_(), blank = gblFormFile_(GBL_PDF.FILES[code]);
  var doc = gblSync_(lib.PDFDocument.load(gblU8_(blank.getBytes()), { ignoreEncryption: true, updateMetadata: false }), 'Reading ' + code);
  var font = gblSync_(doc.embedFont(lib.StandardFonts.Helvetica), 'The font'), form = doc.getForm(), pages = doc.getPages(), notes = [];
  Object.keys(fill.text || {}).forEach(function (k) {
    var v = fill.text[k]; if (v === undefined || v === null || v === '') return;
    v = String(v);
    try {
      var f = form.getTextField(k), w = f.acroField.getWidgets()[0], width = w ? w.getRectangle().width - 4 : 0, size = (fill.size || {})[k] || 0;
      if (!size) { size = GBL_PDF.MAXSIZE; if (width > 0 && !f.isMultiline()) while (size > GBL_PDF.MINSIZE && font.widthOfTextAtSize(v, size) > width) size -= 0.5; }
      f.setFontSize(size); f.setText(v);
    } catch (e) { notes.push(k + ': ' + String(e && e.message ? e.message : e).slice(0, 80)); }
  });
  (fill.check || []).forEach(function (k) { try { form.getCheckBox(k).check(); } catch (e) { notes.push(k + ': ' + String(e && e.message ? e.message : e).slice(0, 80)); } });
  Object.keys(fill.radio || {}).forEach(function (k) { try { form.getRadioGroup(k).select(fill.radio[k]); } catch (e) { notes.push(k + ': ' + String(e && e.message ? e.message : e).slice(0, 80)); } });
  (fill.draw || []).forEach(function (t) { var p = pages[(t.page || 1) - 1]; if (p && t.text !== '' && t.text !== undefined) p.drawText(String(t.text), { x: t.x, y: t.y, size: t.size || GBL_PDF.MAXSIZE, font: font }); });
  try { form.updateFieldAppearances(font); } catch (e) {}
  var bytes = gblSync_(doc.save({ useObjectStreams: false, updateFieldAppearances: false }), 'Writing ' + code);
  var blob = Utilities.newBlob(gblSigned_(bytes), 'application/pdf', name + '.pdf');
  blob.notes = notes;
  return blob;
}
function gblPdfB64_(blob) { return Utilities.base64Encode(blob.getBytes()); }
function gblDmy_(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(ymd || ''); }
/** A sent form kept in the forms folder's "Sent forms", when the folder is set: its link goes on the register. */
function gblKeepSent_(blob, g) {
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty(GBL_PDF.FOLDER_PROP) || ''; } catch (e) {}
  if (!id) return '';
  try {
    var root = DriveApp.getFolderById(id), it = root.getFoldersByName(GBL_PDF.SENT), sent = it.hasNext() ? it.next() : root.createFolder(GBL_PDF.SENT);
    var f = sent.createFile(blob.copyBlob ? blob.copyBlob() : blob); f.setName(gcmWhen_(new Date()).replace(/[^\w]+/g, '-') + ' ' + blob.getName());
    return f.getUrl();
  } catch (e) { return ''; }
}

/* ── EB0010 from the change data gblFormData_ builds ─── */
function gblEb0010Fill_(d) {
  var M = GBL_EB0010, text = {}, check = [], draw = [], dmy = gblDmy_;
  text[M.policy] = d.policy; text[M.holder] = d.holder; text[M.insured] = d.insured; text[M.dob] = dmy(d.dob);
  text[M.emailPersonal] = d.emailPersonal; text[M.emailWork] = d.emailWork; text[M.telHome] = d.telHome; text[M.telWork] = d.telWork; text[M.telExt] = d.telExt; text[M.telCell] = d.telCell;
  if (d.marital && M.marital[d.marital]) check.push(M.marital[d.marital]);
  check.push(M.plan[d.planType === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'GROUP']);
  function rows(list, slots, extra) {
    var spouse = null, others = [];
    list.forEach(function (x) { if (/SPOUSE|WIFE|HUSBAND|PARTNER/.test(x.rel) && !spouse) spouse = x; else others.push(x); });
    var seq = [spouse].concat(others);
    seq.forEach(function (x, i) { if (!x || !slots[i]) return; var s = slots[i]; text[s.name] = String(x.name || '').toUpperCase(); text[s.gender] = x.gender; text[s.dob] = dmy(x.dob); if (s.on) text[s.on] = dmy(x.on); if (s.reason) text[s.reason] = x.reason; if (s.pct) text[s.pct] = x.pct ? String(x.pct) + '%' : ''; extra && extra(x, s); });
  }
  rows(d.addDeps || [], M.addDeps); rows(d.removeDeps || [], M.removeDeps); rows(d.addBens || [], M.addBens); rows(d.removeBens || [], M.removeBens);
  if (d.kind === 'plan' && d.plan) {
    if (d.plan.global) check.push(M.planType['GLOBAL CARE PLUS']); else if (d.plan.provisor) check.push(M.planType.PROVISOR);
    if (M.deductible[String(d.plan.deductible || '').replace(/[^\d]/g, '')]) check.push(M.deductible[String(d.plan.deductible).replace(/[^\d]/g, '')]);
    var mj = String(d.plan.major || '').toUpperCase().replace(/[^\dA-Z]/g, '');
    if (/^INC/.test(mj)) check.push(M.major.INCREASE); else if (/^DEC/.test(mj)) check.push(M.major.DECREASE);
    if (M.major[mj.replace(/[A-Z]/g, '')]) check.push(M.major[mj.replace(/[A-Z]/g, '')]);
    if (d.plan.mode && M.mode[String(d.plan.mode).toUpperCase()]) check.push(M.mode[String(d.plan.mode).toUpperCase()]);
  }
  if (d.address) text[M.address] = d.address;
  if (d.kind === 'bank' && d.bank && (d.bank.name || d.bank.account)) {
    check.push(M.bankChange); text[M.bankName] = d.bank.name; text[M.bankBranch] = d.bank.branch;
    var c = M.accountCells, digits = String(d.bank.account || '').replace(/[^\dA-Za-z]/g, '').slice(0, c.n);
    for (var i = 0; i < digits.length; i++) draw.push({ page: c.page, x: c.x0 + c.step * i + 5, y: c.y, text: digits.charAt(i), size: c.size });
  }
  text[M.admin.name] = d.admin.name; text[M.admin.date] = dmy(d.admin.date);
  return { text: text, check: check, draw: draw, size: {} };
}
/** The filled EB0010 as a PDF Blob; if Guardian's PDF cannot be filled, the HTML rendering, with the reason on d.fallback. */
function gblFormPdf_(d) {
  var name = gblFormName_(d);
  try { var b = gblPdfFill_('EB0010', gblEb0010Fill_(d), name); d.fallback = ''; d.fillNotes = b.notes || []; return b; }
  catch (e) {
    d.fallback = String(e && e.message ? e.message : e).slice(0, 200);
    var blob = Utilities.newBlob(gblFormHtml_(d), 'text/html', name + '.html');
    try { return blob.getAs('application/pdf').setName(name + '.pdf'); } catch (e2) { return blob; }
  }
}

/* ── the cover e-mail, the register row, the owner's task: one path for every form ─── */
/** pack = { code, title, kindLabel, member, line, effective, reason, blob, lines[], missing[], blocking[], changeKind, name } */
function gblSendPack_(g, who, pack, opt) {
  opt = opt || {};
  if (pack.blocking.length) return { ok: false, error: 'Still needed before it can go: ' + pack.blocking.join(', ') + '.' };
  if (!tMsCreds_()) return { ok: false, error: 'Microsoft 365 is not set up on this project, so nothing can go from support@.' };
  var live = gblLive_(), test = !live;
  var to = test ? [who.role === 'client' ? (g.ownerEmail || gcmDayManager_()) : (who.email || gcmDayManager_())].filter(String) : [GBL_FORM.TO];
  if (!to.length) return { ok: false, error: 'No address to send the test to.' };
  var cc = test ? (TRANSITION.CC || []).slice() : GBL_FORM.CC.slice(), gto = (g.to || [])[0] || '';
  if (!test && gcmYes_(opt.copyGroup) && gto && !gcmOurAddress_(gto)) cc.push(gto);
  var E = tEsc_;
  var body = '<div style="font:15px/1.6 Arial,sans-serif;color:#142033;max-width:640px">' + (test ? '<p style="background:#fdf1e1;padding:8px 12px;font-weight:700;color:#a64b05">TEST: this would go to ' + E(GBL_FORM.TO) + ', copied to ' + E(GBL_FORM.CC.join(', ')) + '. Nothing has reached Guardian Life.</p>' : '') +
    '<p>Dear EB Customer Care,</p>' + pack.lines.map(function (l) { return '<p>' + l + '</p>'; }).join('') +
    '<p>Kind regards,<br><b>' + E(who.role === 'client' ? 'Ricky Rampersad Branch, for ' + g.name : gcmSigner_(who, g)) + '</b><br>Ricky Rampersad Branch, Guardian Life of the Caribbean<br>9-13 Endeavour 1st Street, Chaguanas · (868) 226-6461</p>' +
    '<p style="color:#777;font-size:12px">' + E(tInternal_(null)) + '</p></div>';
  var subject = (test ? '[TEST] ' : '') + pack.code + ' ' + pack.title + ' – ' + g.name + ' – ' + pack.member + ' – ' + pack.kindLabel;
  try { tMsSend_(to[0], subject, body, { cc: cc.concat(to.slice(1)), attachments: [pack.blob], replyTo: who.role === 'client' ? TRANSITION.MS_FROM : (who.email || TRANSITION.MS_FROM) }); }
  catch (e) { return { ok: false, error: 'Microsoft would not send it: ' + String(e && e.message ? e.message : e).slice(0, 200) }; }
  var kept = gblKeepSent_(pack.blob, g);
  var detail = (test ? '[TEST] ' : '') + pack.code + ' sent to ' + (test ? to[0] : 'EB Customer Care') + ' ' + gcmWhen_(new Date()) + ': ' + pack.kindLabel + (pack.reason ? '. ' + pack.reason : '');
  var r = gblChange_(g, who, pack.line, { kind: pack.changeKind, member: pack.member, effective: pack.effective, detail: detail, name: who.role === 'client' ? who.name : '' }, who.role === 'client' ? 'client' : 'staff', { Form: kept || ('pdf ' + pack.blob.getName()), Note: 'form: ' + (test ? 'test' : 'sent') });
  return { ok: true, test: test, to: to, cc: cc, task: r.task || '', kept: kept, said: test ? 'Test copy sent to ' + to[0] + ' with the form attached; nothing reached Guardian Life. Run gblGoLive to send for real.' : 'Sent to EB Customer Care with the form attached, copied to sales support and support@' + (r.task ? '; a task is open for our team to see it through' : '') + '.' };
}

/* ── GIO001: a new member enrolled, from what the group (or staff) types, on Guardian's own application form ─── */
var GBL_ENROL = { ID: { DP: 'DP', PP: 'PP', ID: 'ID' }, TIERS: ['SINGLE', 'EMPLOYEE + ONE', 'EMPLOYEE + FAMILY'], FOLLOWS: ['the Declaration of Insurability, completed and signed by the employee', 'a copy of the identification ticked in Section A', 'the top of a bank statement showing the name and account number (Section E)', 'the employee’s signature on the form, and the plan administrator’s signature and stamp (Section F)'] };
/** The group's own policy numbers per line, read off its members' certificates (the part before the first dash). */
function gblGroupPolicyNos_(g) {
  var out = { health: '', life: '' };
  try {
    var M = gblMembers_(g); if (!M.ok) return out;
    ['health', 'life'].forEach(function (ln) {
      var count = {};
      M.members.forEach(function (m) { if (m.line !== ln || !m.policy) return; var p = String(m.policy).split(/[-\/]/)[0].trim(); if (p) count[p] = (count[p] || 0) + 1; });
      var best = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
      out[ln] = best || '';
    });
  } catch (e) {}
  return out;
}
function gblEnrolData_(g, b, who) {
  var today = gcmToday_(), clean = function (v, n) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, n || 80); }, up = function (v, n) { return clean(v, n).toUpperCase(); };
  var cov = { health: gcmYes_(b.covHealth), life: gcmYes_(b.covLife), voluntary: gcmYes_(b.covVoluntary), dependentLife: gcmYes_(b.covDependentLife) };
  var nos = gblGroupPolicyNos_(g), idType = up(b.idType, 2); if (!GBL_ENROL.ID[idType]) idType = '';
  var tier = up(b.tier, 20).replace(/\s*\+\s*/g, ' + '); if (GBL_ENROL.TIERS.indexOf(tier) < 0) tier = '';
  var other = String(b.otherPlan || '').toLowerCase(); other = other === 'yes' || other === 'y' ? 'yes' : other === 'no' || other === 'n' ? 'no' : '';
  var e = { code: 'GIO001', version: GBL_PDF.VERSIONS.GIO001, holder: g.name, policyLife: cov.life ? (clean(b.policyLife, 30).toUpperCase() || nos.life) : '', policyHealth: cov.health ? (clean(b.policyHealth, 30).toUpperCase() || nos.health) : '',
    employee: up(b.employee || ((b.first || '') + ' ' + (b.last || ''))), dob: gcmYmd_(b.dob || '') || '', email: clean(b.email, 80).toLowerCase(), gender: gblGender_(b.gender),
    telHome: clean(b.telHome, 20), telWork: clean(b.telWork, 20), telExt: clean(b.telExt, 8), telCell: clean(b.telCell, 20), marital: gblMarital_(b.marital), occupation: up(b.occupation, 60),
    idType: idType, idNo: up(b.idNo, 30), coverage: cov, otherPlan: other, otherPlanName: up(b.otherPlanName, 60), otherInsurer: up(b.otherInsurer, 60),
    deps: gblFormDeps_(b.deps).map(function (x) { var src = (typeof b.deps === 'string' ? gblJ_(b.deps, []) : (b.deps || [])).filter(function (y) { return up((y || {}).name) === x.name; })[0] || {}; x.on = x.on || gcmYmd_(b.effective || '') || ''; x.country = up(src.country || 'TRINIDAD AND TOBAGO', 40); return x; }).slice(0, 5),
    bens: gblFormDeps_(b.bens, true).filter(function (x) { return !x.remove; }).slice(0, 5),
    bank: { account: String(b.bankAccount || '').replace(/[^\dA-Za-z]/g, '').slice(0, 15), type: /^C/i.test(String(b.bankType || '')) ? 'CHEQUING' : /^S/i.test(String(b.bankType || '')) ? 'SAVINGS' : '', name: up(b.bankName, 60), branch: up(b.bankBranch, 60) },
    employed: gcmYmd_(b.employed || '') || '', confirmed: gcmYmd_(b.confirmed || '') || '', effective: gcmYmd_(b.effective || '') || '', tier: tier,
    salary: String(b.salary || '').replace(/[^\d.,]/g, '').slice(0, 15),
    admin: { name: clean(b.admin, 80), date: today }, submitted: { by: who.name, role: who.role === 'client' ? 'the group’s plan administrator, on the group’s service page' : 'Ricky Rampersad Branch', when: gcmWhen_(new Date()) },
    reason: clean(b.reason, 300), missing: [], blocking: [] };
  if (!e.employee) e.blocking.push('the employee’s name');
  if (!e.dob) e.blocking.push('the date of birth');
  if (!e.gender) e.blocking.push('the gender');
  if (!cov.health && !cov.life) e.blocking.push('the coverage applied for (Group Health, Group Life)');
  if (!e.effective) e.blocking.push('the effective date of coverage (Section F)');
  if (!e.admin.name) e.blocking.push('the plan administrator’s name (Section F)');
  if (!e.email) e.missing.push('an e-mail address');
  if (!e.telHome && !e.telWork && !e.telCell) e.missing.push('a telephone number');
  if (!e.marital) e.missing.push('marital status');
  if (!e.occupation) e.missing.push('occupation');
  if (!e.idType || !e.idNo) e.missing.push('the identification and its number');
  if (!e.otherPlan) e.missing.push('whether another medical plan covers them (Section B)');
  if (cov.life && !e.bens.length) e.missing.push('a beneficiary for the Group Life (Section D)');
  if (cov.life && !e.salary) e.missing.push('the annual salary (Section F, Group Life)');
  if (!e.bank.account) e.missing.push('the account for claim payments (Section E)');
  if (!e.tier) e.missing.push('the coverage tier (Section F)');
  if (!e.employed) e.missing.push('the date employed (Section F)');
  return e;
}
function gblGio001Fill_(e) {
  var M = GBL_GIO001, text = {}, check = [], radio = {}, dmy = gblDmy_;
  text[M.policyLife] = e.policyLife; text[M.policyHealth] = e.policyHealth; text[M.holder] = e.holder; text[M.employee] = e.employee; text[M.dob] = dmy(e.dob); text[M.email] = e.email;
  if (e.gender) radio[M.gender.group] = M.gender[e.gender];
  text[M.telHome] = e.telHome; text[M.telWork] = e.telWork; text[M.telExt] = e.telExt; text[M.telCell] = e.telCell;
  if (e.marital) radio[M.marital.group] = M.marital[e.marital];
  text[M.occupation] = e.occupation; if (e.idType) check.push(M.idType[e.idType]); text[M.idNo] = e.idNo;
  if (e.coverage.health) check.push(M.coverage.health); if (e.coverage.life) check.push(M.coverage.life); if (e.coverage.voluntary) check.push(M.coverage.voluntary); if (e.coverage.dependentLife) check.push(M.coverage.dependentLife);
  if (e.otherPlan) radio[M.otherPlan.group] = M.otherPlan[e.otherPlan];
  text[M.otherPlanName] = e.otherPlanName; text[M.otherInsurer] = e.otherInsurer;
  var spouse = null, others = [];
  e.deps.forEach(function (x) { if (/SPOUSE|WIFE|HUSBAND|PARTNER/.test(x.rel) && !spouse) spouse = x; else others.push(x); });
  [spouse].concat(others).forEach(function (x, i) { if (!x || !M.deps[i]) return; var s = M.deps[i]; text[s.name] = x.name; text[s.gender] = x.gender; text[s.dob] = dmy(x.dob); text[s.on] = dmy(x.on); text[s.country] = x.country; });
  e.bens.forEach(function (x, i) { if (!M.bens[i]) return; var s = M.bens[i]; text[s.rel] = x.rel; text[s.name] = x.name; text[s.gender] = x.gender; text[s.dob] = dmy(x.dob); text[s.pct] = x.pct ? String(x.pct) + '%' : ''; });
  text[M.account] = e.bank.account; if (e.bank.type) check.push(M.accountType[e.bank.type]); text[M.bankName] = e.bank.name; text[M.bankBranch] = e.bank.branch;
  text[M.employed] = dmy(e.employed); text[M.confirmed] = dmy(e.confirmed); text[M.effective] = dmy(e.effective);
  if (e.tier) radio[M.tier.group] = M.tier[e.tier];
  text[M.salary] = e.salary ? 'TT$ ' + e.salary : ''; text[M.admin.name] = e.admin.name;
  return { text: text, check: check, radio: radio, draw: [], size: {} };
}
function gblEnrolName_(e) { return ('GIO001 Application - ' + e.employee + ' - ' + e.holder).replace(/[^\w\s\-&.]/g, '').replace(/\s+/g, ' ').slice(0, 120); }
function gblEnrolPdf_(e) { var b = gblPdfFill_('GIO001', gblGio001Fill_(e), gblEnrolName_(e)); e.fillNotes = b.notes || []; return b; }
function gblEnrolSend_(g, who, e, opt) {
  var E = tEsc_, lines = [], covs = [];
  if (e.coverage.health) covs.push('Group Health'); if (e.coverage.life) covs.push('Group Life'); if (e.coverage.voluntary) covs.push('Voluntary Life'); if (e.coverage.dependentLife) covs.push('Dependent Life');
  lines.push('Please find attached Guardian Life’s form GIO001 (' + e.version + '), the application of <b>' + E(e.employee) + '</b> for ' + E(covs.join(' and ')) + ' under <b>' + E(e.holder) + '</b>' + (e.policyHealth || e.policyLife ? ' (policy ' + E([e.policyHealth, e.policyLife].filter(String).join(' / ')) + ')' : '') + ', effective <b>' + E(tDmy_(e.effective)) + '</b>' + (e.tier ? ', ' + E(e.tier.toLowerCase()) : '') + '.');
  if (e.deps.length) lines.push('Section C lists ' + e.deps.length + ' dependent' + (e.deps.length === 1 ? '' : 's') + ' to be covered: ' + E(e.deps.map(function (x) { return x.name + ' (' + x.rel.toLowerCase() + ')'; }).join(', ')) + '.');
  if (e.reason) lines.push('Note from the group: ' + E(e.reason) + '.');
  lines.push('To follow from the employee and the group: ' + E(GBL_ENROL.FOLLOWS.join('; ')) + '.');
  lines.push('The form carries what the group gave us' + (e.missing.length ? ' (not given: ' + E(e.missing.join(', ')) + ')' : '') + '. It was submitted by ' + E(e.submitted.by) + ', ' + E(e.submitted.role) + ', on ' + E(e.submitted.when) + '; the plan administrator named in Section F is ' + E(e.admin.name) + '.');
  var blob;
  try { blob = gblEnrolPdf_(e); } catch (err) { return { ok: false, error: 'The application form could not be filled: ' + String(err && err.message ? err.message : err).slice(0, 160) }; }
  return gblSendPack_(g, who, { code: 'GIO001', title: GBL_PDF.TITLES.GIO001, kindLabel: 'Enrolment: ' + covs.join(' and '), member: gblTitle_(e.employee), line: e.coverage.health ? 'health' : 'life', effective: e.effective, reason: e.reason, blob: blob, lines: lines, missing: e.missing, blocking: e.blocking, changeKind: 'joiner' }, opt);
}

/* ── EASI Collect: the ACH details for claim payments, on Guardian's flat form, drawn at its printed positions ─── */
var GBL_EASI_KINDS = { enrol: 'ACH enrolment', change: 'ACH change', terminate: 'ACH termination' };
function gblEasiData_(g, m, b, who) {
  var clean = function (v, n) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, n || 80); };
  var kind = String(b.easiKind || b.kind || 'change').toLowerCase(); if (!GBL_EASI_KINDS[kind]) kind = 'change';
  var idType = String(b.idType || '').toLowerCase(); idType = /nat|^id/.test(idType) ? 'national' : /perm|dp|driv/.test(idType) ? 'permit' : /pass|pp/.test(idType) ? 'passport' : '';
  var x = { code: 'EASI', version: '', kind: kind, kindLabel: GBL_EASI_KINDS[kind], holder: g.name, first: String(m.first || m.name.split(' ')[0] || '').toUpperCase(), middle: clean(b.middle, 30).toUpperCase(), last: String(m.last || m.name.split(' ').slice(1).join(' ') || '').toUpperCase(),
    email: (m.emailPersonal || m.emailWork || clean(b.email, 80)).toLowerCase(), cell: m.telCell || clean(b.cell, 20), plan: 'group', company: g.name, policy: m.policy + (m.cert && m.cert !== m.policy ? ' / ' + m.cert : ''),
    idType: idType, idNo: clean(b.idNo, 30).toUpperCase(), bank: { name: clean(b.bankName, 60), branch: clean(b.bankBranch, 60), account: String(b.bankAccount || '').replace(/[^\dA-Za-z]/g, '').slice(0, 16), type: /^C/i.test(String(b.bankType || '')) ? 'chequing' : /^S/i.test(String(b.bankType || '')) ? 'savings' : '' },
    member: { id: m.id, name: m.name, line: m.line, status: m.status, plan: m.plan }, line: m.line, reason: clean(b.reason, 300),
    submitted: { by: who.name, role: who.role === 'client' ? 'the group’s plan administrator, on the group’s service page' : 'Ricky Rampersad Branch', when: gcmWhen_(new Date()) }, missing: [], blocking: [] };
  if (kind !== 'terminate') {
    if (!x.bank.name || !x.bank.account) x.blocking.push('the bank and the account number');
    if (!x.bank.type) x.blocking.push('the type of account');
    if (!x.idType || !x.idNo) x.blocking.push('the identification and its number');
  }
  if (!x.email) x.missing.push('an e-mail address'); if (!x.cell) x.missing.push('a cell number');
  return x;
}
function gblEasiFill_(x) {
  var P = GBL_EASI, draw = [], at = function (pos, text, size) { if (pos && text) draw.push({ page: P.page, x: pos[0], y: pos[1], text: text, size: size || P.size }); };
  at(P.kind[x.kind], P.mark, P.markSize);
  at(P.first, x.first); at(P.middle, x.middle); at(P.last, x.last); at(P.email, x.email); at(P.cell, x.cell);
  at(P.plan[x.plan], P.mark, P.markSize); at(P.company, x.company); at(P.policy, x.policy);
  if (x.idType) at(P.idType[x.idType], P.mark, P.markSize); at(P.idNo, x.idNo);
  if (x.kind !== 'terminate') {
    at(P.bank, x.bank.name); at(P.branch, x.bank.branch);
    for (var i = 0; i < Math.min(x.bank.account.length, P.account.n); i++) draw.push({ page: P.page, x: P.account.x0 + P.account.step * i + 8, y: P.account.y, text: x.bank.account.charAt(i), size: P.account.size });
    if (x.bank.type) at(P.accountType[x.bank.type], P.mark, P.markSize);
  }
  return { text: {}, check: [], radio: {}, draw: draw, size: {} };
}
function gblEasiName_(x) { return ('EASI Collect - ' + x.member.name + ' - ' + x.holder).replace(/[^\w\s\-&.]/g, '').replace(/\s+/g, ' ').slice(0, 120); }
function gblEasiPdf_(x) { var b = gblPdfFill_('EASI', gblEasiFill_(x), gblEasiName_(x)); x.fillNotes = b.notes || []; return b; }
function gblEasiSend_(g, who, x, opt) {
  var E = tEsc_, lines = [];
  lines.push('Please find attached Guardian Life’s EASI Collect form, ' + E(x.kindLabel.toLowerCase()) + ' for the claim payments of <b>' + E(x.member.name) + '</b>, ' + E(GBL.LABEL[x.line].toLowerCase()) + ' under <b>' + E(x.holder) + '</b> (policy / certificate ' + E(x.policy) + ').');
  if (x.kind !== 'terminate') lines.push('The account is in Section C; a copy of the identification and the top of the bank statement follow from the insured.');
  if (x.reason) lines.push('Note: ' + E(x.reason) + '.');
  lines.push('Section A is from the policy record' + (x.missing.length ? ' (not on record: ' + E(x.missing.join(', ')) + ')' : '') + '. It was submitted by ' + E(x.submitted.by) + ', ' + E(x.submitted.role) + ', on ' + E(x.submitted.when) + '. The insured’s signature follows on the signed copy.');
  var blob;
  try { blob = gblEasiPdf_(x); } catch (err) { return { ok: false, error: 'The EASI form could not be filled: ' + String(err && err.message ? err.message : err).slice(0, 160) }; }
  return gblSendPack_(g, who, { code: 'EASI', title: GBL_PDF.TITLES.EASI, kindLabel: x.kindLabel, member: x.member.name, line: x.line, effective: '', reason: x.reason, blob: blob, lines: lines, missing: x.missing, blocking: x.blocking, changeKind: 'bank' }, opt);
}
function gblFormName_(d) { return (d.code + ' Policy Change - ' + d.member.name + ' - ' + d.holder).replace(/[^\w\s\-&.]/g, '').replace(/\s+/g, ' ').slice(0, 120); }
/** The cover e-mail to EB Customer Care, with the form attached; test mode to the sender and the branch, marked TEST. */
function gblFormSend_(g, who, d, opt) {
  var E = tEsc_, lines = [];
  lines.push('Please find attached Guardian Life’s form ' + d.code + ' (' + d.version + '), ' + GBL_FORM.KINDS[d.kind].toLowerCase() + ' for <b>' + E(d.member.name) + '</b>, ' + E(d.lineLabel.toLowerCase()) + ' under <b>' + E(d.holder) + '</b> (policy / certificate ' + E(d.policy) + ')' + (d.effective ? ', effective <b>' + E(tDmy_(d.effective)) + '</b>' : '') + '.');
  if (d.kind === 'terminate') lines.push('Please terminate the primary insured' + (d.removeDeps.length ? ' and the ' + d.removeDeps.length + ' dependent' + (d.removeDeps.length === 1 ? '' : 's') + ' listed in Section B (ii)' : ' and any dependent covered under this certificate') + ' as at that date, and confirm the credit on the next billing.');
  if (d.kind === 'adddep') lines.push('Please add the dependent' + (d.addDeps.length === 1 ? '' : 's') + ' in Section B: ' + E(d.addDeps.map(function (x) { return x.name + ' (' + x.rel.toLowerCase() + ')'; }).join(', ')) + '.');
  if (d.kind === 'removedep') lines.push('Please remove the dependent' + (d.removeDeps.length === 1 ? '' : 's') + ' in Section B (ii): ' + E(d.removeDeps.map(function (x) { return x.name; }).join(', ')) + '.');
  if (d.kind === 'address') lines.push('Please change the primary insured’s address as in Section D' + (d.addressOnFile ? ' (on file: ' + E(d.addressOnFile) + ')' : '') + '.');
  if (d.kind === 'beneficiary') lines.push('Please record the beneficiary change in Section C.');
  if (d.kind === 'bank') lines.push('Please update the account for claim payments as in Section E; the bank statement follows from the insured.');
  if (d.kind === 'plan') lines.push('Please apply the plan change ticked in Section D.');
  if (d.reason) lines.push('Reason given: ' + E(d.reason) + '.');
  lines.push('The form is pre-filled from the policy records; Section A is as held' + (d.missing.length ? ' (not on record: ' + E(d.missing.join(', ')) + ')' : '') + '. It was submitted by ' + E(d.submitted.by) + ', ' + E(d.submitted.role) + ', on ' + E(d.submitted.when) + (d.admin.name ? '; the plan administrator named in Section F is ' + E(d.admin.name) : '') + '. The signed and stamped copy follows on request.');
  if (d.blocking.length) return { ok: false, error: 'Still needed before it can go: ' + d.blocking.join(', ') + '.' };
  var blob = gblFormPdf_(d);
  if (d.fallback) lines.push('<i>Note: Guardian Life’s PDF could not be filled on our side (' + E(d.fallback) + '), so this copy is our rendering of the same form.</i>');
  return gblSendPack_(g, who, { code: d.code, title: GBL_PDF.TITLES.EB0010, kindLabel: GBL_FORM.KINDS[d.kind], member: d.member.name, line: d.line, effective: d.effective, reason: d.reason, blob: blob, lines: lines, missing: d.missing, blocking: d.blocking, changeKind: GBL_FORM.CHANGE[d.kind] }, opt);
}
function gcmOurAddress_(e) { e = String(e || '').toLowerCase(); return /@(myguardiangroup\.com|rickyrampersadbranch\.com)$/.test(e); }
/* staff: act=members (search), act=form (fill and preview), act=formSend */
function gblFormAct_(g, who, b) {
  var act = String(b.act || '');
  if (act === 'members') return gblMemberSearch_(g, b.q, gcmYes_(b.fresh));
  if (act === 'enrol' || act === 'enrolSend') {
    var e = gblEnrolData_(g, b, who);
    if (act === 'enrol') { var pb = null, perr = ''; try { pb = gblEnrolPdf_(e); } catch (x) { perr = String(x && x.message ? x.message : x).slice(0, 200); } return { ok: true, data: e, pdf: pb ? gblPdfB64_(pb) : '', pdfError: perr, missing: e.missing, blocking: e.blocking, live: gblLive_(), to: GBL_FORM.TO, cc: GBL_FORM.CC, group: (g.to || [])[0] || '', policies: { health: e.policyHealth, life: e.policyLife } }; }
    return gblEnrolSend_(g, who, e, { copyGroup: b.copyGroup });
  }
  var m = gblMemberById_(g, b.member, gcmYes_(b.fresh));
  if (!m) return { ok: false, error: 'Pick a member of the group first.' };
  if (act === 'easi' || act === 'easiSend') {
    var x = gblEasiData_(g, m, b, who);
    if (act === 'easi') { var xb = null, xerr = ''; try { xb = gblEasiPdf_(x); } catch (y) { xerr = String(y && y.message ? y.message : y).slice(0, 200); } return { ok: true, data: x, pdf: xb ? gblPdfB64_(xb) : '', pdfError: xerr, missing: x.missing, blocking: x.blocking, live: gblLive_(), to: GBL_FORM.TO, cc: GBL_FORM.CC, group: (g.to || [])[0] || '' }; }
    return gblEasiSend_(g, who, x, { copyGroup: b.copyGroup });
  }
  var d = gblFormData_(g, m, b, who);
  if (act === 'form') { var fb = gblFormPdf_(d); return { ok: true, data: d, pdf: gblPdfB64_(fb), fallback: d.fallback || '', missing: d.missing, blocking: d.blocking, live: gblLive_(), to: GBL_FORM.TO, cc: GBL_FORM.CC, group: (g.to || [])[0] || '' }; }
  if (act === 'formSend') return gblFormSend_(g, who, d, { copyGroup: b.copyGroup });
  return { ok: false, error: 'Unknown action.' };
}
/* the group's page: search its own members, fill and preview, submit */
function gblClientForm_(p) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, p.lb, p.code);
  if (!a.ok) return a;
  var g = a.g, who = { role: 'client', name: String(p.name || 'the group').slice(0, 80), email: '' }, form = String(p.form || 'change').toLowerCase();
  if (form === 'enrol') {
    var e = gblEnrolData_(g, p, who), pb = null, perr = '';
    try { pb = gblEnrolPdf_(e); } catch (x) { perr = String(x && x.message ? x.message : x).slice(0, 200); }
    return { ok: true, pdf: pb ? gblPdfB64_(pb) : '', pdfError: perr, missing: e.missing, blocking: e.blocking, policies: { health: e.policyHealth, life: e.policyLife }, follows: GBL_ENROL.FOLLOWS, tiers: GBL_ENROL.TIERS };
  }
  if (p.member) {
    var m = gblMemberById_(g, p.member);
    if (!m) return { ok: false, error: 'That person is not on your plan with us.' };
    var mem = { name: m.name, policy: m.policy + (m.cert && m.cert !== m.policy ? ' / ' + m.cert : ''), line: m.line, label: GBL.LABEL[m.line], deps: m.deps.map(function (x) { return { rel: x.rel, name: x.name, gender: x.gender, dob: x.dob }; }) };
    if (form === 'easi') {
      var x = gblEasiData_(g, m, p, who), xb = null, xerr = '';
      try { xb = gblEasiPdf_(x); } catch (y) { xerr = String(y && y.message ? y.message : y).slice(0, 200); }
      return { ok: true, pdf: xb ? gblPdfB64_(xb) : '', pdfError: xerr, missing: x.missing, blocking: x.blocking, kind: x.kind, member: mem };
    }
    var d = gblFormData_(g, m, p, who), fb = gblFormPdf_(d);
    return { ok: true, pdf: gblPdfB64_(fb), fallback: d.fallback || '', missing: d.missing, blocking: d.blocking, kind: d.kind, member: mem };
  }
  var s = gblMemberSearch_(g, p.q);
  if (!s.ok) return { ok: false, error: 'Our records are not available right now. Please try again shortly, or e-mail us.' };
  return { ok: true, members: s.members.map(function (x) { return { id: x.id, name: x.name, line: x.line, label: x.label, policy: x.policy, status: x.live ? 'on the plan' : x.status, live: x.live, since: x.since, deps: x.deps }; }), total: s.total, more: s.more, kinds: GBL_FORM.KINDS, easiKinds: GBL_EASI_KINDS };
}
function gblClientFormSend_(b) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, b.lb, b.code);
  if (!a.ok) return a;
  var g = a.g, who = { role: 'client', name: String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80), email: '' }, form = String(b.form || 'change').toLowerCase();
  if (!who.name) return { ok: false, error: 'Please give your name.' };
  if (!gcmYes_(b.authorised)) return { ok: false, error: 'Please confirm you are authorised to submit this for ' + g.name + '.' };
  b.admin = b.admin || who.name;
  if (form === 'enrol') {
    var e = gblEnrolData_(g, b, who), re = gblEnrolSend_(g, who, e, {});
    if (!re.ok) return re;
    try { gblTellOwner_(g, who.name, 'joiner', e.coverage.health ? 'health' : 'life', { member: e.employee, effective: e.effective, detail: 'GIO001 application: ' + (e.coverage.health ? 'Group Health ' : '') + (e.coverage.life ? 'Group Life' : '') }); } catch (err) {}
    return { ok: true, said: 'Thank you. The application form for ' + gblTitle_(e.employee) + ' has gone to Guardian Life’s EB Customer Care with our branch copied' + (re.task ? ', and our team has a task to see it through' : '') + '. Please send the signed form and the papers listed with it to the same address.' };
  }
  var m = gblMemberById_(g, b.member);
  if (!m) return { ok: false, error: 'That person is not on your plan with us.' };
  if (form === 'easi') {
    var x = gblEasiData_(g, m, b, who), rx = gblEasiSend_(g, who, x, {});
    if (!rx.ok) return rx;
    try { gblTellOwner_(g, who.name, 'bank', m.line, { member: m.name, effective: '', detail: 'EASI Collect: ' + x.kindLabel }); } catch (err) {}
    return { ok: true, said: 'Thank you. The EASI Collect form for ' + m.name + ' has gone to Guardian Life’s EB Customer Care with our branch copied' + (rx.task ? ', and our team has a task to see it through' : '') + '. The signed copy and the bank statement follow from the insured.' };
  }
  var d = gblFormData_(g, m, b, who), r = gblFormSend_(g, who, d, {});
  if (!r.ok) return r;
  try { gblTellOwner_(g, who.name, GBL_FORM.CHANGE[d.kind], d.line, { member: m.name, effective: d.effective, detail: GBL_FORM.KINDS[d.kind] + (d.reason ? ': ' + d.reason : '') }); } catch (e) {}
  return { ok: true, said: 'Thank you. The change form for ' + m.name + ' has gone to Guardian Life’s EB Customer Care with our branch copied' + (r.task ? ', and our team has a task to see it through' : '') + '. You will see it under “What you have told us”.' };
}

/* ── the follow-up: the owner's task, chased on Chatter every three working days until EB Customer Care answers ─── */
/* 24 October 2026: "a task is opened assigned to the account owner to advise to follow up if no response on Salesforce,
 * this is automated by Chatter comments every 3 working days". The form's send opens the task (gblChange_, owned by the
 * account owner). Each working day the group day (10:30) runs gblFormChase_: a form sent live whose task is still open
 * and that EB Customer Care has not answered at support@ gets, every GBL_FORM.CHASE.DAYS working days, one Chatter post on
 * the task headed Branch Intelligence with the owner @mentioned, and the owner an e-mail from support@; after CHASE.MAX
 * the branch manager is told. EB's reply (from a Guardian address, not the branch's own, naming the member or the form)
 * is noted on the task and ends it; so does the task being closed. Test sends are never chased. */
GBL_FORM.CHASE = { DAYS: 3, MAX: 5, HEAD: 'Branch Intelligence' };
function gblWorkDays_(from, to) {
  var a = new Date(from), b = new Date(to), n = 0; a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
  while (a < b) { a.setDate(a.getDate() + 1); var d = a.getDay(); if (d !== 0 && d !== 6) n++; }
  return n;
}
/** Every message in support@'s inbox since a time: who it is from, its subject, when. */
function gblInboxSince_(sinceTs) {
  var out = { ok: true, mails: [], error: '' };
  if (!tMsCreds_()) return { ok: false, mails: [], error: 'Microsoft 365 is not set up' };
  try {
    var token = tMsToken_(), since = new Date(sinceTs).toISOString().replace(/\.\d+Z$/, 'Z');
    var url = 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(TRANSITION.MS_FROM) + '/mailFolders/inbox/messages' +
      '?$select=id,subject,from,receivedDateTime&$orderby=receivedDateTime%20desc&$top=100&$filter=' + encodeURIComponent('receivedDateTime ge ' + since);
    for (var pages = 0; url && pages < 25; pages++) {
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
      if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
      var j = JSON.parse(res.getContentText());
      (j.value || []).forEach(function (m) { out.mails.push({ from: String(((m.from || {}).emailAddress || {}).address || '').toLowerCase(), subject: String(m.subject || ''), ts: new Date(m.receivedDateTime).getTime() }); });
      url = j['@odata.nextLink'] || '';
    }
  } catch (e) { return { ok: false, mails: [], error: String(e && e.message ? e.message : e).slice(0, 200) }; }
  return out;
}
function gblOurMail_(a) {
  a = String(a || '').toLowerCase();
  if (!a || /@rickyrampersadbranch\.com$/.test(a)) return true;
  var ours = (TRANSITION.CC || []).concat(GBL_FORM.CC, [gcmDayManager_()]).map(function (x) { return String(x || '').toLowerCase(); });
  if (ours.indexOf(a) >= 0) return true;
  try { if (tTeam_().people.some(function (p) { return String(p.email || '').toLowerCase() === a; })) return true; } catch (e) {}
  return false;
}
function gblFormChase_(o) {
  o = o || {};
  var out = { ok: true, chased: [], answered: [], closed: [], waiting: [], errors: [], said: '' }, today = gcmToday_(), now = new Date();
  var rows = gblRows_(GBL.CHANGES).filter(function (r) { return /^form: sent/.test(gcmText_(r.Note)) && (gcmText_(r.Status) || 'open') === 'open' && gcmText_(r['SF Task']); });
  if (!rows.length) { out.said = 'No change form is waiting on EB Customer Care.'; return out; }
  var ids = rows.map(function (r) { return gcmText_(r['SF Task']); }), tasks = {};
  if (tSfOn_()) {
    try { gcmQuery_('SELECT Id, IsClosed, Status, OwnerId, Owner.Name, Owner.Email, Subject FROM Task WHERE Id IN (' + gcmIn_(ids) + ')').forEach(function (t) { tasks[gcmId15_(t.Id)] = t; }); }
    catch (e) { out.errors.push('Salesforce: ' + String(e && e.message ? e.message : e).slice(0, 120)); }
  }
  var oldest = Math.min.apply(null, rows.map(function (r) { return r.When instanceof Date ? r.When.getTime() : now.getTime(); }));
  var inbox = gblInboxSince_(oldest - 86400000), sh = gblSheet_(GBL.CHANGES), head = GBL_HEAD[GBL.CHANGES];
  var patch = function (r, f) { if (o.test) return; Object.keys(f).forEach(function (h) { var c = head.indexOf(h); if (c >= 0) sh.getRange(r._n, c + 1).setValue(f[h]); }); };
  rows.forEach(function (r) {
    var member = gcmText_(r.Member), group = gcmText_(r.Group), note = gcmText_(r.Note), sentTs = r.When instanceof Date ? r.When.getTime() : now.getTime();
    var t = tasks[gcmId15_(gcmText_(r['SF Task']))] || null, chases = (note.match(/chased /g) || []).length, lastTs = sentTs;
    var m = note.match(/chased (\d{4}-\d{2}-\d{2})(?!.*chased)/); if (m) lastTs = new Date(m[1] + 'T12:00:00Z').getTime();
    var item = { group: group, member: member, kind: gcmText_(r.Kind), sent: gcmYmd_(r.When), chases: chases, task: gcmText_(r['SF Task']), owner: t ? gcmName_(t, 'Owner') : '' };
    if (t && t.IsClosed) { patch(r, { Status: 'done', Note: note + '; task closed ' + today }); out.closed.push(item); return; }
    /* EB's reply names the member (every word of the name, in any order), from a Guardian address that is not one of ours */
    var nameWords = member.toLowerCase().split(/[\s,]+/).filter(function (w) { return w.length > 1; });
    var reply = inbox.ok && nameWords.length ? inbox.mails.filter(function (x) {
      var subj = x.subject.toLowerCase();
      return x.ts > sentTs && /@myguardiangroup\.com$/.test(x.from) && !gblOurMail_(x.from) && nameWords.every(function (w) { return subj.indexOf(w) >= 0; });
    })[0] : null;
    if (reply) {
      item.reply = { from: reply.from, subject: reply.subject, at: gcmWhen_(new Date(reply.ts)) };
      if (!o.test) {
        patch(r, { Status: 'answered', Note: note + '; EB replied ' + today });
        try { tSfSend_('post', '/sobjects/FeedItem', { ParentId: item.task, Body: GBL_FORM.CHASE.HEAD + ' · ' + tDmy_(today) + ': EB Customer Care replied at support@ on ' + item.reply.at + ' (' + reply.from + '): "' + reply.subject.slice(0, 120) + '". Please read it, update the record, and close this task with what was agreed.' }); } catch (e) {}
      }
      out.answered.push(item); return;
    }
    var days = gblWorkDays_(lastTs, now.getTime());
    item.days = days;
    if (days < GBL_FORM.CHASE.DAYS || chases >= GBL_FORM.CHASE.MAX) { out.waiting.push(item); return; }
    var n = chases + 1, since = gblWorkDays_(sentTs, now.getTime());
    var kindKey = Object.keys(GBL_FORM.CHANGE).filter(function (k) { return GBL_FORM.CHANGE[k] === item.kind; })[0];
    var text = 'No reply from EB Customer Care yet on form ' + GBL_FORM.CODE + ' for ' + member + ' (' + (kindKey ? GBL_FORM.KINDS[kindKey].toLowerCase() : item.kind) + ', sent ' + tDmy_(item.sent) + ', ' + since + ' working days ago; follow-up ' + n + ' of ' + GBL_FORM.CHASE.MAX + '). ' +
      'Please follow up with ' + GBL_FORM.TO + ', quoting the form, and note their answer here. This task closes when they confirm the change; the branch sees it on the billing review.';
    item.text = text;
    if (!o.test) {
      var posted = '';
      if (t && t.OwnerId) { try { var res = tSfSend_('post', '/chatter/feed-elements', { feedElementType: 'FeedItem', subjectId: item.task, body: { messageSegments: [{ type: 'Text', text: GBL_FORM.CHASE.HEAD + ' · ' + tDmy_(today) + ': ' }, { type: 'Mention', id: String(t.OwnerId) }, { type: 'Text', text: ' ' + text }] } }); posted = String(res.id || ''); } catch (e) {} }
      if (!posted) { try { tSfSend_('post', '/sobjects/FeedItem', { ParentId: item.task, Body: GBL_FORM.CHASE.HEAD + ' · ' + tDmy_(today) + ': ' + text }); posted = 'plain'; } catch (e2) { out.errors.push(member + ': the post did not go'); } }
      var ownerMail = t && t.Owner && t.Owner.Email ? String(t.Owner.Email) : '';
      if (ownerMail) gblInternalMail_(ownerMail, 'Follow up with EB Customer Care · ' + member + ' · ' + group, '<p>' + tEsc_(gcmName_(t, 'Owner').split(' ')[0]) + ', ' + tEsc_(text) + '</p>' + (gblSfUrl_(item.task) ? '<p><a href="' + gblSfUrl_(item.task) + '">Open the task</a></p>' : '') + '<p style="color:#777;font-size:12px">' + tEsc_(tInternal_(null)) + '</p>');
      if (n >= GBL_FORM.CHASE.MAX && gcmDayManager_()) gblInternalMail_(gcmDayManager_(), 'EB Customer Care has not answered: ' + member + ' · ' + group, '<p>Form ' + GBL_FORM.CODE + ' for <b>' + tEsc_(member) + '</b> (' + tEsc_(group) + ') went to EB Customer Care on ' + tEsc_(tDmy_(item.sent)) + ' and has had ' + n + ' follow-ups on the task' + (item.owner ? ' of ' + tEsc_(item.owner) : '') + ' with no reply at support@. This was the last automatic one.</p><p style="color:#777;font-size:12px">' + tEsc_(tInternal_(null)) + '</p>');
      patch(r, { Note: note + '; chased ' + today });
    }
    out.chased.push(item);
  });
  out.said = (out.chased.length ? out.chased.length + ' chased on Chatter (' + out.chased.map(function (x) { return x.member; }).join(', ') + ')' : 'nothing to chase') +
    (out.answered.length ? '; EB replied on ' + out.answered.length : '') + (out.closed.length ? '; ' + out.closed.length + ' closed' : '') + (out.waiting.length ? '; ' + out.waiting.length + ' waiting' : '') + (out.errors.length ? '; ' + out.errors.join('; ') : '') + '.';
  return out;
}
function gblFormChaseNow() { return tSay_(JSON.stringify(gblFormChase_({}))); }
function gblFormChasePreview() { return tSay_(JSON.stringify(gblFormChase_({ test: true }))); }

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
  try { var nd = gblNextBillDay_(); out.nextBill = { day: nd, label: tDmy_(nd), dayOfMonth: gblDayOfMonth_() }; } catch (e) {}
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
    /* the statement (25 October 2026): the latest month with a bill sent or reconciled, as the group reads it */
    var stM = bills.filter(function (x) { return x.sentAt || x.reconciledAt; }).map(function (x) { return x.month; }).sort().pop();
    if (stM) { var sb = bills.filter(function (x) { return x.month === stM && (x.sentAt || x.reconciledAt); }), sd = gblStatementData_(g, stM, L, sf, sb); out.statement = { month: stM, label: sd.label, total: sd.total, dueBy: sd.dueBy, owed: sd.owed, owedTotal: sd.owedTotal, grand: sd.grand, changes: sd.changes, lines: sd.lines.map(function (l) { return { line: l.line, label: l.label, due: l.due, members: l.members }; }), html: gblStatementHtml_(g, sd, { inline: true }) }; }
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

/* ── the group's people: who is on the plans, who came off this year, who is pending (25 October 2026) ──────────────
 * "a drop down to see the members that are active and members who have come off this year and members who are pending,
 * who they have an application in … very easy for the customer to just look at what is pending, who is having it, and
 * the ability to comment, because they must have what is opened on it from our end … driven by task. When they post a
 * comment, it goes on to the respective chatter and task. If there's nothing on it, … the ability to post something …
 * Remember, we upload the billing and the Salesforce data."
 * The list is built from both: the group's Group Health and Group Life records in Salesforce, and the latest bill
 * uploaded on each line (with this year's bills for who came off). Each person carries the items open on them that the
 * group may see: the applications and increases still pending (their requirements in the words the pending panel uses,
 * a medical requirement's details kept between the person insured and us), and any other open item about them the
 * group is shown. A post goes onto the item's own task in Salesforce, with its owner mentioned and e-mailed; on a person
 * with nothing open it opens a task for the account owner, so every word the group writes is on a task someone owns.
 * What the group reads: names, the plans, the tier on the bill, the dates. Never a date of birth, an e-mail, a phone,
 * a beneficiary, a claim or a health detail. */
var GBL_ROSTER = { MIN_TEXT: 8, MAX_TEXT: 1500, DUE_DAYS: 2, SAME_MIN: 10, MAX_DAY: 40, LINES: ['health', 'life'] };
function gblPersonKey_(name) {
  return String(name || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(String).sort().join('-').slice(0, 80);
}
/** Is this person named in a task's subject: their first and last names both appear as whole words. */
function gblNamedIn_(name, subject) {
  var w = String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (x) { return x.length >= 2; });
  if (w.length < 2) return false;
  var s = ' ' + String(subject || '').toLowerCase().replace(/[^a-z]+/g, ' ') + ' ';
  return s.indexOf(' ' + w[0] + ' ') >= 0 && s.indexOf(' ' + w[w.length - 1] + ' ') >= 0;
}
/** The group's people. forGroup true: what the group may read. */
function gblRoster_(g, L, forGroup) {
  var today = L.today, yr = today.slice(0, 4) + '-01-01', people = [];
  var display = function (n) { n = String(n || '').trim(); return /[,;]/.test(n) || n === n.toUpperCase() ? gblNice_(n) : n; };
  var find = function (n) { return people.filter(function (x) { return gblSamePerson_(x.raw, n); })[0] || null; };
  var get = function (n) {
    n = String(n || '').trim();
    if (!n) return null;
    var p = find(n);
    if (!p) { p = { raw: n, name: display(n), lines: {}, off: [], leaving: [], joining: [], pending: null, items: [], posts: [], sfId: '', contactId: '' }; people.push(p); }
    return p;
  };
  var line = function (p, ln) { return p.lines[ln] = p.lines[ln] || { line: ln, label: GBL.LABEL[ln], onBill: '', sfLive: false, tier: '', since: '' }; };
  /* Salesforce: who is live on the group's plans, and who came off this year */
  var M = { ok: false, members: [] };
  try { M = gblMembers_(g); } catch (e) {}
  (M.members || []).forEach(function (m) {
    if (GBL_ROSTER.LINES.indexOf(m.line) < 0) return;
    if (m.live) {
      var p = get(m.name), l = line(p, m.line);
      l.sfLive = true;
      if (m.issued && (!l.since || m.issued < l.since)) l.since = m.issued;
      p.sfId = p.sfId || m.id; p.contactId = p.contactId || m.contactId;
    } else if (m.changed && m.changed >= yr) {
      var q = get(m.name);
      q.off.push({ line: m.line, label: GBL.LABEL[m.line], date: m.changed, why: /TERMINAT|CANCEL/i.test(m.status) ? 'terminated' : '', src: 'record' });
      q.sfId = q.sfId || m.id; q.contactId = q.contactId || m.contactId;
    }
  });
  /* the bills: who is on the latest bill of each line, and who this year's bills took off */
  var bills = gblBillRows_(g), lineRows = {};
  gblRows_(GBL.LINES).forEach(function (r) {
    if (gcmCodeKey_(r.Group) !== g.key) return;
    var k = gcmText_(r.Line) + '|' + gcmText_(r.Month);
    (lineRows[k] = lineRows[k] || []).push({ name: gcmText_(r.Name), tier: gcmText_(r.Tier), start: gcmText_(r.Start), eff: gcmText_(r.Eff), kind: gcmText_(r.Kind) || 'member', forMonth: gcmText_(r['For month']) });
  });
  GBL_ROSTER.LINES.forEach(function (ln) {
    var mine = bills.filter(function (b) { return b.line === ln; }), last = mine[mine.length - 1];
    if (last) (lineRows[ln + '|' + last.month] || []).forEach(function (r) {
      if (r.kind !== 'member') return;
      var p = get(r.name), l = line(p, ln);
      l.onBill = gblMonthLabel_(last.month);
      if (r.tier) l.tier = r.tier;
      if (r.start && !l.since) l.since = r.start;
    });
    mine.filter(function (b) { return b.month >= yr.slice(0, 7); }).forEach(function (b) {
      (lineRows[ln + '|' + b.month] || []).forEach(function (r) {
        if (r.kind !== 'cancel' && r.kind !== 'left') return;
        var p = get(r.name), d = r.kind === 'left' ? r.eff : (r.forMonth || b.month) + '-01';
        if (!p.off.some(function (o) { return o.line === ln; })) p.off.push({ line: ln, label: GBL.LABEL[ln], date: d, why: 'terminated', src: 'bill', bill: gblMonthLabel_(b.month) });
      });
    });
  });
  /* what the group and our team have recorded: a leaver reported, a joiner being enrolled, and the group's own posts */
  var changes = [];
  try { changes = gblChanges_(g); } catch (e2) {}
  changes.forEach(function (c) {
    if (!c.member) return;
    var lnk = GBL_ROSTER.LINES.indexOf(c.line) >= 0 ? c.line : 'health';
    if (c.kind === 'leaver' && c.source !== 'bill' && (c.effective || c.when) >= yr) { var p = get(c.member); p.leaving.push({ line: lnk, label: GBL.LABEL[lnk], date: c.effective, reported: c.when, by: c.source === 'client' ? 'you' : 'us', task: c.task, done: c.status === 'done' }); }
    else if (c.kind === 'joiner' && c.source !== 'bill' && c.when >= yr && c.status !== 'done') { var q = get(c.member); q.joining.push({ line: lnk, label: GBL.LABEL[lnk], date: c.effective, reported: c.when, by: c.source === 'client' ? 'you' : 'us', task: c.task }); }
    else if (c.kind === 'post' && c.source === 'client') { var r = get(c.member); r.posts.push({ at: c.at, ts: c.ts, by: c.by, text: c.detail, on: c.note, feed: c.sfId, task: c.task }); }
  });
  /* the applications and increases still pending, in the pending panel's own words */
  var cards = [];
  try { cards = gcmPending_(g, today, forGroup); } catch (e3) {}
  cards.forEach(function (c) {
    var p = get(c.applicant || 'An employee (name not on our record)');
    p.pending = { since: c.since, days: c.days, late: c.late, lines: c.lines, apps: c.apps, incs: c.incs, last: c.last ? c.last.text : '', applied: c.applied, incSince: c.incSince };
    c.items.forEach(function (x) { p.items.push(Object.assign({ pending: true }, x)); });
  });
  /* any other open item about the person that the group is shown */
  g.tasks.forEach(function (t) {
    if (!t.open || t.app) return;
    if (forGroup && (!gcmShown_(g, t) || t.priv || GCM_PRIVATE.test(t.subject))) return;
    var p = people.filter(function (x) { return (t.who && gblSamePerson_(x.raw, t.who)) || gblNamedIn_(x.name, t.subject); })[0];
    if (!p || p.items.some(function (i) { return i.id === t.id15; })) return;
    p.items.push({ id: t.id15, kind: 'task', what: gcmTitle_(t.subject, g.name), owner: t.owner || 'Our branch team', status: forGroup ? (GCM_STATUS[String(t.status).toLowerCase()] || 'In progress with us') : t.status,
      opened: t.opened, days: gcmDays_(t.opened, today), due: t.due, late: !!(t.due && t.due < today) });
  });
  /* the notes our team shared with the group on those items. Never the rest of the Chatter, replies under the group's own
     post included: staff write Chatter as the team's own, and only a note shared for the group is the group's to read. */
  var taskIds = [];
  people.forEach(function (p) { p.items.forEach(function (i) { if (i.kind !== 'increase') { var t = g.tasks.filter(function (x) { return x.id15 === i.id; })[0]; if (t) taskIds.push(t.id); } }); });
  var feed = taskIds.length ? gcmFeed_(taskIds) : {};
  people.forEach(function (p) { p.items.forEach(function (i) { i.notes = (feed[i.id] || []).filter(function (f) { return g.shares.post[f.id]; }).map(gcmShared_); }); });
  /* where each person stands */
  var out = people.map(function (p) {
    var lines = Object.keys(p.lines).map(function (k) {
      var l = p.lines[k], offAfter = p.off.some(function (o) { return o.line === k && (!l.since || o.date >= l.since); });
      l.active = !!l.onBill || (l.sfLive && !offAfter);
      return l;
    });
    var active = lines.filter(function (l) { return l.active; });
    var offNow = p.off.filter(function (o) { return !(p.lines[o.line] && p.lines[o.line].active); });
    var joining = p.joining.filter(function (j) { return !(p.lines[j.line] && p.lines[j.line].active); });
    var leaving = p.leaving.filter(function (x) { return !x.done && !offNow.some(function (o) { return o.line === x.line; }); });
    var first = String(p.name).split(/\s+/)[0];
    var o = { key: gblPersonKey_(p.name), name: p.name, first: first, active: active.length > 0, offYear: offNow.length > 0, pendingNow: !!p.pending || joining.length > 0,
      lines: active.map(function (l) { return { label: l.label, tier: l.tier, since: l.since, onBill: l.onBill }; }),
      off: offNow.map(function (x) { return { label: x.label, date: x.date, why: x.why, bill: x.bill || '' }; }),
      leaving: leaving.map(function (x) { return { label: x.label, date: x.date, reported: x.reported, by: x.by }; }),
      joining: joining.map(function (x) { return { label: x.label, date: x.date, reported: x.reported, by: x.by }; }),
      pending: p.pending, items: p.items, posts: p.posts.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 10).map(function (x) { return { at: x.at, by: x.by, text: x.text, opened: /^new task:/.test(x.on || ''), on: /^on /.test(x.on || '') ? String(x.on).slice(3) : '' }; }) };
    o._sf = { id: p.sfId, contact: p.contactId };   // for a post's task; gblClientPeople_ takes it off before the page reads it
    return o;
  }).filter(function (o) { return o.active || o.offYear || o.pendingNow || o.items.length || o.posts.length; });
  out.sort(function (a, b) { return (b.pendingNow - a.pendingNow) || ((b.pending ? b.pending.days : 0) - (a.pending ? a.pending.days : 0)) || a.name.localeCompare(b.name); });
  return { ok: true, asAt: L.refreshed || tDmy_(today), people: out, sf: !!M.ok,
    counts: { active: out.filter(function (o) { return o.active; }).length, off: out.filter(function (o) { return o.offYear; }).length, pending: out.filter(function (o) { return o.pendingNow; }).length, all: out.length },
    bills: GBL_ROSTER.LINES.map(function (ln) { var b = bills.filter(function (x) { return x.line === ln; }).pop(); return b ? { label: GBL.LABEL[ln], month: gblMonthLabel_(b.month) } : null; }).filter(Boolean),
    year: today.slice(0, 4) };
}
/** The route the group's page calls for "Your people". */
function gblClientPeople_(p) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, p.lb, p.code);
  if (!a.ok) return a;
  var R = gblRoster_(a.g, L, true);
  R.people.forEach(function (o) { delete o._sf; });
  return R;
}
/** A group's post about one of its people: onto the open item's task in Salesforce (its owner mentioned and e-mailed), or,
 *  with nothing open on them, onto a new task for the account owner. Filed on Group Changes as the group's own post. */
function gblClientPost_(b) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, b.lb, b.code);
  if (!a.ok) return a;
  var g = a.g, today = L.today, name = String(b.name || '').trim().slice(0, 80), role = String(b.role || '').trim().slice(0, 80);
  var text = String(b.text || '').trim().slice(0, GBL_ROSTER.MAX_TEXT);
  if (!name) return { ok: false, error: 'Add your name, so our team knows who wrote.' };
  if (text.replace(/\s+/g, ' ').length < GBL_ROSTER.MIN_TEXT) return { ok: false, error: 'Write a little more, so the person handling it knows what you need.' };
  var R = gblRoster_(g, L, true), p = R.people.filter(function (x) { return x.key === String(b.person || ''); })[0];
  if (!p) return { ok: false, error: 'That person is not on your list any more. Refresh the page and try again.' };
  var mine = [];
  try { mine = gblChanges_(g).filter(function (c) { return c.kind === 'post' && c.source === 'client'; }); } catch (e) {}
  if (mine.some(function (c) { return gblSamePerson_(c.member, p.name) && c.detail === text && c.ts > Date.now() - GBL_ROSTER.SAME_MIN * 60000; })) return { ok: true, dup: true, said: 'We already have this one. Thank you.' };
  if (mine.filter(function (c) { return c.when === today; }).length >= GBL_ROSTER.MAX_DAY) return { ok: false, error: 'That is a lot of messages for one day. Please e-mail ' + (GCM.TELL_CC[0] || 'our sales support team') + ' and we will pick them up.' };
  if (!tSfOn_()) return { ok: false, error: 'Our system is being updated. Please e-mail ' + (GCM.TELL_CC[0] || 'our sales support team') + ' instead.' };
  var item = b.item ? p.items.filter(function (i) { return i.id === gcmId15_(b.item); })[0] : null;
  if (b.item && !item) return { ok: false, error: 'That item is no longer open. Refresh the page to see where it stands.' };
  var task = item && item.kind !== 'increase' ? g.tasks.filter(function (t) { return t.id15 === item.id; })[0] || null : null;
  var head = 'From ' + g.name + ' on their service page (' + name + (role ? ', ' + role : '') + '), about ' + p.name + (item ? ', on "' + item.what + '"' : '') + ':';
  var taskId = '', feedId = '', owner = null, subject = '';
  if (task) {
    taskId = task.id;
    owner = gblTaskOwner_(task.id);
    feedId = gblClientFeed_(task.id, head, text, owner);
    if (!feedId) return { ok: false, error: 'Our system would not take the message just now. Please try again in a minute.' };
  } else {
    /* nothing open on them (or an increase whose requirements have no task): a task for the account owner, on the group's
       account so the group sees it on its page, and on the person by their contact */
    var inc = item && item.kind === 'increase' ? g.incs.filter(function (n) { return n.id15 === item.id; })[0] : null;
    var acct = (g.acctsFull || g.accts)[0] || null, ownerId = gblOwnerId_(g), first = p.first;
    subject = (p.pendingNow ? (inc ? inc.line + ' increase' : 'Pending application') : p.offYear && !p.active ? 'Member who came off' : 'Member query') + ' – ' + p.name + ' – ' + g.name + ' – the group asks';
    var rec = { Subject: subject.slice(0, 255), WhatId: inc ? inc.id : acct, ActivityDate: gcmAddDays_(today, GBL_ROSTER.DUE_DAYS), Status: 'Not Started', Priority: 'Normal',
      Description: head + '\n' + text + '\n\nOpened from the group\'s service page' + (item ? ' on the ' + item.what.toLowerCase() : ', because nothing was open on ' + first) + '. Answer on the Chatter, and share a note for the group so they read the reply on their page.' };
    if (p._sf && p._sf.contact) rec.WhoId = p._sf.contact;
    if (ownerId) rec.OwnerId = ownerId;
    try { taskId = String(tSfSend_('post', '/sobjects/Task', Object.assign({ Task_Type__c: 'Servicing' }, rec)).id || ''); }
    catch (e1) {
      try { taskId = String(tSfSend_('post', '/sobjects/Task', rec).id || ''); }
      catch (e2) { return { ok: false, error: 'Our system would not take the message just now. Please try again, or e-mail ' + (GCM.TELL_CC[0] || 'our sales support team') + '.' }; }
    }
    feedId = gblClientFeed_(taskId, head, text, null);
    owner = { name: g.assigned, email: g.ownerEmail };
  }
  gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: 'health', Kind: 'post', Member: p.name, Detail: text, Effective: today, Amount: 0, Source: 'client', By: name + (role ? ', ' + role : ''),
    Status: 'open', 'SF Task': taskId, 'SF Id': feedId, Note: item ? 'on ' + item.what : 'new task: ' + subject }]);
  try { gblPostMail_(g, name, role, p, item, text, taskId, owner, !task); } catch (e3) {}
  var who = owner && owner.name ? String(owner.name) : 'our team';
  return { ok: true, task: taskId ? gcmId15_(taskId) : '', opened: !task,
    said: task ? 'Sent. It is on the item for ' + who + ', who has been told.' : 'Sent. Nothing was open on ' + p.first + ', so we opened an item for ' + who + '. It shows here once it is in our records, within the hour.' };
}
/** The group's words onto a task's Chatter: through Connect with the owner mentioned, so Salesforce tells them; a plain
 *  post when the mention is refused. Returns the feed item's id, or ''. */
function gblClientFeed_(taskId, head, text, owner) {
  if (!taskId) return '';
  if (owner && owner.id) {
    try { return String(tSfSend_('post', '/chatter/feed-elements', { feedElementType: 'FeedItem', subjectId: taskId, body: { messageSegments: [{ type: 'Text', text: head + ' ' }, { type: 'Mention', id: owner.id }, { type: 'Text', text: '\n' + text }] } }).id || ''); } catch (e) {}
  }
  try { return String(tSfSend_('post', '/sobjects/FeedItem', { ParentId: taskId, Body: head + '\n' + text }).id || ''); } catch (e2) { return ''; }
}
/** The person who has it hears at once, sales support copied, from support@ (Gmail if Microsoft refuses). */
function gblPostMail_(g, name, role, p, item, text, taskId, owner, opened) {
  var to = [];
  if (owner && owner.email) to.push(String(owner.email));
  if (g.ownerEmail && to.map(function (x) { return x.toLowerCase(); }).indexOf(g.ownerEmail.toLowerCase()) < 0) to.push(g.ownerEmail);
  GCM.TELL_CC.forEach(function (x) { if (to.map(function (y) { return y.toLowerCase(); }).indexOf(x.toLowerCase()) < 0) to.push(x); });
  if (!to.length) return false;
  var url = gblSfUrl_(taskId);
  var body = '<p><b>' + tEsc_(g.name) + '</b> (' + tEsc_(name + (role ? ', ' + role : '')) + ') wrote on their service page about <b>' + tEsc_(p.name) + '</b>' + (item ? ', on <b>' + tEsc_(item.what) + '</b>' : '') + ':</p>' +
    '<div style="background:#fff;border:1px solid #e2e7ef;border-left:4px solid #13408F;border-radius:10px;padding:11px 15px;white-space:pre-wrap">' + tEsc_(text) + '</div>' +
    '<p>' + (opened ? 'Nothing was open on ' + tEsc_(p.first) + ', so a task was opened' + (owner && owner.name ? ' for ' + tEsc_(owner.name) : '') + ', due ' + tEsc_(tDmy_(gcmAddDays_(gcmToday_(), GBL_ROSTER.DUE_DAYS))) + '.' : 'It is on the task’s Chatter.') +
    ' Answer there, and share a note for the group so they read the reply on their page.</p>' +
    (url ? '<p><a href="' + url + '" style="display:inline-block;background:#1d5bc4;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px">Open the task</a></p>' : '') +
    '<p style="color:#777;font-size:12px">' + tEsc_(tInternal_(null)) + '</p>';
  var subject = 'Group wrote: ' + g.name + ' · about ' + p.name + (opened ? ' · task opened' : '');
  try { if (tMsCreds_()) { tMsSend_(to[0], subject, body, { cc: to.slice(1), replyTo: TRANSITION.MS_FROM }); return true; } } catch (e) {}
  try { MailApp.sendEmail({ to: to.join(','), subject: subject, htmlBody: body, name: 'Ricky Rampersad Branch' }); return true; } catch (e2) { return false; }
}

/* ── the board: one line a group, for the staff page's accounts table ───────────────── */
/** Where each group's billing stands this month, for the team dashboard: lines uploaded, open fixes, reconciled, sent. */
/* ── The billing day: the 26th at 10:00, the next working day when the 26th is a weekend or a holiday ───────────────────
 *  24 October 2026: "On the 26th group billings go out, and weekly on a Monday at 10am the queries go out, but staff has
 *  to approve." On 25 October it went to a Tuesday for a few hours, and back the same day: "I would leave it for the 26th
 *  of the month, excepting when it falls on a holiday or a weekend … We get the billings on the 25th, but on the 25th, we
 *  check it and verify it … And on the 25th in the afternoon, I get the report … So at 1 o'clock, I have a report."
 *  Head Office's bills come in on the 25th; staff upload, verify against Salesforce, reconcile and press Approve for the
 *  26th; the PDF waits in the Drive folder; at 10:00 on the 26th (or the next working day: never a Saturday, a Sunday or
 *  a public holiday, GBL_DAY.HOLIDAYS and the GCM_BILL_HOLIDAYS Script property) every approved bill goes from support@
 *  with its PDF. A bill approved after that run, within LATE_DAYS of it, is a late bill and goes at 10:00 the next working
 *  day, so it never waits a month. At 13:00 on the 25th (the last working day before it when the 25th is not one) the
 *  branch manager gets the report of who has worked each group's bills and what is left (gblMondayReport_, its old name
 *  kept), the staff copied. At 10:30 on the billing day the group day asks each staff member whose group had no bill why,
 *  and opens the KPI task. When the 26th is a Monday the bills and the weekly letters both go at 10:00 that morning. */
var GBL_DAY = {
  DAY: 26,                      // the bills go on this day (the GCM_BILL_DAY Script property overrides, 1 to 28)
  HOUR: 10,                     // at 10:00, as the Monday letters
  REPORT_HOUR: 13,              // the report on the day before (the 25th), while the staff are still in (the first goes home at 2)
  LATE_DAYS: 14,                // a bill approved this many days after the billing day is late, and goes the next working day
  REPORT_PROP: 'GCM_BILL_REPORT_LAST',
  DAY_PROP: 'GCM_BILL_DAY', TASKS_PROP: 'GCM_BILL_TASKS', HOLIDAYS_PROP: 'GCM_BILL_HOLIDAYS',
  QUEUE: 'Bills to send',       // Drive subfolder (of GCM_FORMS_FOLDER) where an approved bill's PDF waits
  SENT: 'Sent bills',           // where it goes once sent
  TASK_TAG: 'GROUP BILL NOT SENT',
  // Trinidad and Tobago's public holidays. MM-dd recurs every year; a holiday on a Sunday is kept on the Monday after.
  // The moveable ones are listed per year (Claims.gs keeps the same list): add the next year's each January, or set
  // GCM_BILL_HOLIDAYS (yyyy-MM-dd or MM-dd, comma separated) for any day the branch is closed.
  HOLIDAYS: [
    '01-01', '03-30', '05-30', '06-19', '08-01', '08-31', '09-24', '12-25', '12-26',
    '2026-02-16', '2026-02-17', '2026-03-20', '2026-04-03', '2026-04-06', '2026-06-04', '2026-11-08',
    '2027-02-08', '2027-02-09', '2027-03-10', '2027-03-26', '2027-03-29', '2027-05-27', '2027-10-29'
  ],
  TRAIN: [
    ['Billings Management', 'The bills go out on the 26th at 10:00, or the next working day when the 26th is a weekend or a public holiday. Head Office’s bills come in on the 25th: that day upload the month’s bill on each line, verify it against Salesforce, fix or resolve what is marked fix, mark it reconciled, and press Approve with the PDF attached.'],
    ['Billings Management', 'At 13:00 on the 25th the branch manager has the report of who has worked each group’s bills and what is left. At 10:00 on the billing day every approved bill goes by itself from support@, with its PDF, copied to sales support. A bill approved after that goes at 10:00 the next working day, or when you press Send now.'],
    ['Billings Management', 'Send now works only on an approved bill. After the 10:00 cut-off, Approve and Send now each ask why the bill was not done by then: the reason goes on the bill, its Chatter and to the branch manager.'],
    ['Billings Management', 'Reconciled is a person’s tick: nothing goes to a group that a person has not checked against Salesforce.']
  ]
};
function gblDayOfMonth_() { try { var v = Number(PropertiesService.getScriptProperties().getProperty(GBL_DAY.DAY_PROP)); if (v >= 1 && v <= 28) return v; } catch (e) {} return GBL_DAY.DAY; }
/** The days the branch is closed in a year, as yyyy-MM-dd: the list, the Script property, and a Sunday holiday's Monday. */
var GBL_HOL_ = null;   // read once a run: the Script property and each year's set
function gblHolidaysReset_() { GBL_HOL_ = null; }
function gblHolidays_(year) {
  var key = String(year);
  if (!GBL_HOL_) {
    var raw = '';
    try { raw = String(PropertiesService.getScriptProperties().getProperty(GBL_DAY.HOLIDAYS_PROP) || ''); } catch (e) {}
    GBL_HOL_ = { extra: raw.split(/[\s,;]+/).filter(String), years: {} };
  }
  if (GBL_HOL_.years[key]) return GBL_HOL_.years[key];
  var extra = GBL_HOL_.extra, set = {};
  GBL_DAY.HOLIDAYS.concat(extra).forEach(function (h) {
    if (/^\d{2}-\d{2}$/.test(h)) set[key + '-' + h] = true;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(h) && h.slice(0, 4) === key) set[h] = true;
  });
  Object.keys(set).sort().forEach(function (d) {
    if (gcmDow_(d) !== 7) return;
    var m = gcmAddDays_(d, 1);
    while (set[m] || gcmDow_(m) > 5) m = gcmAddDays_(m, 1);
    if (m.slice(0, 4) === key) set[m] = true;
  });
  GBL_HOL_.years[key] = set;
  return set;
}
/** A day the bills can go: Monday to Friday and not a public holiday. */
function gblWorkingDay_(ymd) { return gcmDow_(ymd) <= 5 && !gblHolidays_(ymd.slice(0, 4))[ymd]; }
function gblNextWorkingDay_(ymd) { var d = gcmAddDays_(ymd, 1); while (!gblWorkingDay_(d)) d = gcmAddDays_(d, 1); return d; }
/** The billing day of a month (yyyy-MM): the 26th, or the next working day after it. December 2026's is Monday 28th. */
function gblBillDayOf_(ym) {
  var d = ym + '-' + ('0' + gblDayOfMonth_()).slice(-2);
  while (!gblWorkingDay_(d)) d = gcmAddDays_(d, 1);
  return d;
}
/** The report's day for a billing day: the day before the 26th (the 25th), or the last working day before it. */
function gblReportDayOf_(billDay) {
  var d = billDay.slice(0, 7) + '-' + ('0' + (gblDayOfMonth_() - 1)).slice(-2);
  if (d >= billDay) d = gcmAddDays_(billDay, -1);
  while (!gblWorkingDay_(d)) d = gcmAddDays_(d, -1);
  return d;
}
/** The billing days around today, oldest first: two months back to next month. */
function gblBillDays_(today) { var m = today.slice(0, 7); return [-2, -1, 0, 1].map(function (k) { return gblBillDayOf_(gblAddMonths_(m, k)); }); }
/** The next billing day from now: the day itself counts before HOUR. */
function gblNextBillDay_(now) {
  now = now || new Date();
  var today = gcmYmd_(now), h = Number(Utilities.formatDate(now, tTz_(), 'H'));
  return gblBillDays_(today).filter(function (d) { return d > today || (d === today && h < GBL_DAY.HOUR); })[0];
}
/** The run an approval made now goes on: the next billing day, unless the last one's run has gone in the past LATE_DAYS,
 *  when it is a late bill and goes at 10:00 on the next working day (today, before 10:00 on a working day). */
function gblNextRunDay_(now) {
  now = now || new Date();
  var today = gcmYmd_(now), h = Number(Utilities.formatDate(now, tTz_(), 'H'));
  var last = gblBillDays_(today).filter(function (d) { return d < today || (d === today && h >= GBL_DAY.HOUR); }).pop();
  if (!last || gcmDays_(last, today) > GBL_DAY.LATE_DAYS) return gblNextBillDay_(now);
  if (gblWorkingDay_(today) && h < GBL_DAY.HOUR) return today;
  return gblNextWorkingDay_(today);
}
/** The cycle the chase reads: its billing day (today when today is one, else the next) and the billing day before it,
 *  after which a bill counts. */
function gblCycle_(now) {
  now = now || new Date();
  var today = gcmYmd_(now), days = gblBillDays_(today), isDay = days.indexOf(today) >= 0;
  var end = isDay ? today : gblNextBillDay_(now), i = days.indexOf(end);
  return { end: end, start: i > 0 ? days[i - 1] : gblBillDayOf_(gblAddMonths_(end.slice(0, 7), -2)), isDay: isDay, today: today };
}
function gblDayLabel_(ymd) { return GCM_DAYS[gcmDow_(ymd)] + ' ' + tDmy_(ymd).replace(/ \d{4}$/, '') + ', ' + GBL_DAY.HOUR + ':00'; }
/** What the pages show: the next billing day, how far off, whether today is one, when an approval made now goes, the
 *  report's day, and whether a PDF has somewhere to wait. */
function gblDayInfo_(now) {
  now = now || new Date();
  var today = gcmYmd_(now), next = gblNextBillDay_(now), c = gblCycle_(now), run = gblNextRunDay_(now), rep = gblReportDayOf_(next);
  var moved = next.slice(8) !== ('0' + gblDayOfMonth_()).slice(-2);
  return { next: next, label: gblDayLabel_(next), date: tDmy_(next), daysTo: gcmDays_(today, next), isDay: c.isDay, dayOfMonth: gblDayOfMonth_(), hour: GBL_DAY.HOUR, drive: !!gblFolderId_(), live: gblLive_(),
    run: run, runLabel: gblDayLabel_(run), late: run !== next, moved: moved, report: rep, reportLabel: GCM_DAYS[gcmDow_(rep)] + ' ' + tDmy_(rep).replace(/ \d{4}$/, '') + ', ' + GBL_DAY.REPORT_HOUR + ':00', reportHour: GBL_DAY.REPORT_HOUR };
}
function gblFolderId_() { try { return PropertiesService.getScriptProperties().getProperty(GBL_PDF.FOLDER_PROP) || ''; } catch (e) { return ''; } }
function gblSubfolder_(name) {
  var id = gblFolderId_();
  if (!id) return null;
  var root = DriveApp.getFolderById(id), it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}
/** The approved bill's PDFs, into the Drive queue; returns the file ids. */
function gblKeepQueued_(g, bill, blobs) {
  var q = gblSubfolder_(GBL_DAY.QUEUE), ids = [];
  if (!q) return ids;
  blobs.forEach(function (b) {
    var f = q.createFile(b.copyBlob ? b.copyBlob() : b);
    f.setName(gblMonthLabel_(bill.month) + ' · ' + g.name + ' · ' + GBL.LABEL[bill.line] + ' · ' + b.getName());
    ids.push(f.getId());
  });
  return ids;
}
function gblFileById_(id) { try { return DriveApp.getFileById(id); } catch (e) { return null; } }
function gblDropKept_(bill) {
  (bill.kept || '').split(',').map(function (s) { return s.trim(); }).filter(String).forEach(function (id) { var f = gblFileById_(id); if (f) { try { f.setTrashed(true); } catch (e) {} } });
}
/** The staff member's e-mail, for the test copy and the run's summary: the signed-in person's, else from the Agent Skill Bank. */
function gblStaffEmail_(name) {
  try { return tTeam_().people.filter(function (t) { return gcmSameName_(t.name, name); }).map(function (t) { return t.email; }).filter(String)[0] || ''; } catch (e) { return ''; }
}

/* ── After the cut-off: Send now needs the approval, and the reason (25 October 2026) ───────────────────────────────
 *  "Staff has to keep Send now but has to have the approval and reasons why it was not done at the specified cut off
 *  time." Send now goes only on an approved bill; a bill already sent goes again with no question. Each bill's cut-off is
 *  10:00 on the billing day it was meant for (gblCutoffOf_). After it, Approve and Send now both ask why it was not done
 *  by then: staff and the deputy must answer, the branch manager may. The reason is kept on the bill (Late reason), on
 *  Group Changes ('late send'), on the billing task's Chatter and in the run's summary; when the bill reaches the group it
 *  answers and closes that cycle's GROUP BILL NOT SENT task, and the branch manager has an e-mail at once. A late send
 *  is marked with its cut-off on Group Sends, so it never counts as the next cycle's bill. */
var GBL_LATE = { MIN: 15, MAX: 600, BY: ' · given by ' };
var GBL_NOW_ = null;   // the tests' clock; never set in use
function gblNow_() { return GBL_NOW_ ? new Date(GBL_NOW_.getTime()) : new Date(); }
function gblTestClock_(d) { GBL_NOW_ = d || null; }
/** The billing day a bill was meant for: the one before its month (Head Office bills a month ahead, so November's bill
 *  goes on 26 October); when it came in more than LATE_DAYS after that day, the line is billed in its own month, so that
 *  month's billing day. */
function gblCutoffOf_(bill) {
  if (!bill || !/^\d{4}-\d{2}$/.test(String(bill.month || ''))) return '';
  var before = gblBillDayOf_(gblAddMonths_(bill.month, -1)), up = bill.atYmd || '';
  if (!up || up < before || (up === before && (bill.atHour || 0) < GBL_DAY.HOUR)) return before;
  return gcmDays_(before, up) <= GBL_DAY.LATE_DAYS ? before : gblBillDayOf_(bill.month);
}
/** Whether 10:00 on a day has passed. */
function gblPast_(day, now) {
  if (!day) return false;
  var today = gcmYmd_(now), h = Number(Utilities.formatDate(now, tTz_(), 'H'));
  return today > day || (today === day && h >= GBL_DAY.HOUR);
}
/** The earliest cut-off a bill missed, else ''. A bill missed its cut-off when 10:00 that day has passed and it was not
 *  approved for that run (approved later, or not at all), or it was held at the run. One approved in time that the run
 *  has not reached yet did not miss it. */
function gblMissed_(bill, now) {
  var cut = gblCutoffOf_(bill);
  if (!cut || !gblPast_(cut, now)) return '';
  return !bill.approvedFor || bill.approvedFor > cut || /^held/i.test(bill.status || '') ? cut : '';
}
function gblLateOf_(bills, now) { return bills.map(function (b) { return gblMissed_(b, now); }).filter(String).sort()[0] || ''; }
function gblCutWords_(cut) { return 'the ' + GBL_DAY.HOUR + ':00 cut-off on ' + gblDayLabel_(cut).replace(/, \d+:\d+$/, ''); }
/** The reason as typed: no [blank] left in, long enough to say something. need: refused when empty. */
function gblLateReason_(raw, need) {
  var r = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, GBL_LATE.MAX);
  if (!r) return need ? { error: 'Say why it was not done by then.' } : { reason: '' };
  if (/\[[^\]]*\]/.test(r)) return { error: 'Fill in the [blank] in the reason first.' };
  if (r.length < GBL_LATE.MIN) return { error: 'Say a little more: what held it up, and what was done about it.' };
  return { reason: r };
}
/** The reason alone, from the Late reason cell ("<reason> · given by <name>, <when>"). */
function gblLateText_(cell) { var c = String(cell || ''), i = c.lastIndexOf(GBL_LATE.BY); return (i >= 0 ? c.slice(0, i) : c).trim(); }
/** A late send marked on Group Sends: "late (cut-off yyyy-MM-dd)" in Via. True when that cut-off is before `end`. */
function gblLateBefore_(via, end) { var m = /cut-off (\d{4}-\d{2}-\d{2})/.exec(String(via || '')); return !!(m && m[1] < end); }
/** The PDFs kept in Drive at the approval, for Send now when none was read in this session. */
function gblKeptBlobs_(bills) {
  var blobs = [], missing = [];
  bills.forEach(function (b) {
    (b.kept || '').split(',').map(function (x) { return x.trim(); }).filter(String).forEach(function (id) {
      var f = gblFileById_(id);
      if (!f) { missing.push(GBL.LABEL[b.line]); return; }
      try { var bl = f.getBlob(); bl.setName(String(f.getName()).split(' · ').pop()); blobs.push(bl); } catch (e) { missing.push(GBL.LABEL[b.line]); }
    });
  });
  return { blobs: blobs, missing: missing };
}
/** That cycle's GROUP BILL NOT SENT task for the group (opened at 10:30 on the cut-off day): the reason posted on its
 *  Chatter and the task closed, now the bill has gone to the group. Returns the task id, or ''. */
function gblLateTask_(g, cut, text) {
  if (!tSfOn_()) return '';
  var kept = gcmParse_(PropertiesService.getScriptProperties().getProperty(GBL_DAY.TASKS_PROP), {});
  var id = kept && kept.cycle === cut && kept.tasks ? kept.tasks[g.key] : '';
  if (!id) return '';
  try { tSfSend_('post', '/sobjects/FeedItem', { ParentId: id, Body: text }); } catch (e) {}
  try { tSfSend_('patch', '/sobjects/Task/' + id, { Status: 'Completed' }); return id; } catch (e2) { return ''; }
}
/** The late sends since a day, from Group Changes, newest first: for the branch manager's summary. */
function gblLateSends_(since) {
  return gblRows_(GBL.CHANGES).filter(function (r) { return gcmText_(r.Kind) === 'late send' && gcmYmd_(r.When) >= since; }).map(function (r) {
    return { group: gcmText_(r.Group), line: GBL.LABEL[gcmText_(r.Line)] || gcmText_(r.Line), by: gcmText_(r.By), at: gcmWhen_(r.When), detail: gcmText_(r.Detail), reason: gcmText_(r.Note), test: gcmText_(r.Status) === 'test' };
  }).reverse();
}
/** The branch manager's e-mail when a bill goes by Send now after its cut-off: who, when, to whom, and why. */
function gblLateMail_(g, bills, who, o) {
  var me = gcmDayManager_(), E = tEsc_;
  if (!me) return false;
  var lines = bills.map(function (x) { return GBL.LABEL[x.line]; }).join(' and '), month = gblMonthLabel_(bills[0].month);
  var subject = (o.test ? '[TEST] ' : '') + 'Late bill: ' + g.name + ' · ' + month + ' ' + lines.toLowerCase() + ' · sent by ' + who.name;
  var html = '<div style="font:15px/1.6 Arial,sans-serif;color:#142033;max-width:640px">' +
    (o.test ? '<p style="background:#FFF4D6;border:2px solid #E0A800;padding:10px 14px"><b>TEST.</b> The bills are in test mode: this copy of the bill went to ' + E(o.to) + ', not to the group.</p>' : '') +
    '<p><b>' + E(who.name) + '</b> sent the <b>' + E(month) + ' ' + E(lines.toLowerCase()) + '</b> bill for <b>' + E(g.name) + '</b> by Send now at ' + E(o.at) + ', after ' + E(gblCutWords_(o.cut)) + '.</p>' +
    '<p style="margin:0 0 4px;font-weight:700">Why it was not done by then</p>' +
    '<div style="background:#FFF8E6;border-left:4px solid #E0A800;padding:10px 14px;margin:0 0 14px">' + (o.reason ? E(o.reason) : '<i>No reason given.</i>') + '</div>' +
    '<p>' + (o.test ? 'A TEST copy went to ' : 'It went to ') + E(o.to) + '. The reason is on the bill, on Group Changes and on the billing task’s Chatter' +
      (o.task ? '; the ' + E(GBL_DAY.TASK_TAG) + ' task for this cycle is answered with it and closed (' + E(o.task) + ')' : '') + '.</p>' +
    '<p><a href="' + GCM.SITE + 'billing.html?g=' + encodeURIComponent(g.key) + '&m=' + encodeURIComponent(bills[0].month) + '" style="color:#1D5BC4;font-weight:700">Open the group’s billing</a></p>' +
    '<p style="color:#777;font-size:12px">' + E(tInternal_(null)) + '</p></div>';
  return gblInternalMail_(me, subject, html, who.email || me);
}

/** Approve (gblAct_ act 'approve'): the reconciled bill, with its PDFs, waits for its run (gblNextRunDay_: the billing day, or
 *  the next working day for a late bill); 'unapprove' takes it back. */
function gblApprove_(g, who, bill, b, L) {
  var line = bill.line, month = bill.month, now = gblNow_(), E = tEsc_;
  var log = function (kind, detail) {
    gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: line, Kind: kind, Member: '', Detail: detail, Effective: month + '-01', Amount: bill.due || 0, Source: 'staff', By: who.name, Status: 'done', 'SF Task': '', 'SF Id': '', Note: '' }]);
  };
  if (b.act === 'unapprove') {
    if (bill.status !== 'approved') return { ok: false, error: 'This bill is not approved.' };
    gblDropKept_(bill);
    gblBillPatch_(bill, { Status: bill.reconciledAt ? 'reconciled' : 'checked', 'Approved at': '', 'Approved by': '', 'Approved e-mail': '', 'Approved for': '', 'Files kept': '' });
    log('unapproved', GBL.LABEL[line] + ' ' + gblMonthLabel_(month) + ': the approval for ' + gblDayLabel_(bill.approvedFor) + ' was taken back.');
    return { ok: true, said: 'The approval is cancelled. The bill stays reconciled; approve it again, or press Send now.', steps: gblSteps_(gblBillRows_(g).filter(function (x) { return x.line === line && x.month === month; })[0]) };
  }
  if (bill.sentAt) return { ok: false, error: 'This bill went to the group on ' + bill.sentAt + '. To send it again, press Send now.' };
  if (bill.status === 'approved') return { ok: false, error: 'Already approved for ' + gblDayLabel_(bill.approvedFor) + ' by ' + bill.approvedBy + '. Cancel that approval first to change it.' };
  var st = gblSteps_(bill);
  if (!bill.reconciledAt && !(who.role === 'branch' && gcmYes_(b.force))) return { ok: false, error: 'Reconcile it first, so nothing goes to the group that a person has not checked against Salesforce.' };
  if (st.fixes && !gcmYes_(b.force)) return { ok: false, error: st.fixes + ' finding' + (st.fixes === 1 ? '' : 's') + ' marked “fix” ' + (st.fixes === 1 ? 'is' : 'are') + ' still open. Fix or resolve each one first.' };
  var why = gcmCannotMail_(g);
  if (why) return { ok: false, error: 'Cannot approve: ' + why + '.' };
  var files = Array.isArray(b.attachments) ? b.attachments : [], blobs = [];
  files.slice(0, 6).forEach(function (f) {
    try { var bytes = Utilities.base64Decode(String(f.b64 || '')); if (bytes.length && bytes.length < 3000000) blobs.push(Utilities.newBlob(bytes, String(f.type || 'application/pdf'), String(f.name || 'bill.pdf').replace(/[^\w.\- ]/g, '_').slice(0, 80))); } catch (e) {}
  });
  if (blobs.length && !gblFolderId_()) return { ok: false, error: 'The PDF has nowhere to wait until ' + gblDayLabel_(gblNextRunDay_(now)) + ': the branch manager sets the ' + GBL_PDF.FOLDER_PROP + ' Script property to the Drive folder (GROUP-CLIENTS-SETUP.md). Until then no bill can be approved with its PDF.' };
  /* after the cut-off: why it was not done by then (staff and the deputy must say; the branch manager may) */
  var cut = gblPast_(gblCutoffOf_(bill), now) ? gblCutoffOf_(bill) : '', lr = { reason: '' };
  if (cut) {
    lr = gblLateReason_(b.reason, who.role !== 'branch');
    if (lr.error) return { ok: false, needReason: true, cutoff: cut, cutoffLabel: gblDayLabel_(cut), error: 'This bill missed ' + gblCutWords_(cut) + '. ' + lr.error };
  }
  var lateSay = cut ? ' After ' + gblCutWords_(cut) + (lr.reason ? '. Why: ' + lr.reason : ', no reason given') + '.' : '';
  var ids = [];
  try { ids = gblKeepQueued_(g, bill, blobs); } catch (e) { return { ok: false, error: 'Drive would not keep the PDF: ' + String(e && e.message ? e.message : e).slice(0, 160) }; }
  var forDay = gblNextRunDay_(now), at = gcmWhen_(now), email = who.email || gblStaffEmail_(who.name);
  var patch = { Status: 'approved', 'Approved at': at, 'Approved by': who.name, 'Approved e-mail': email, 'Approved for': forDay, 'Files kept': ids.join(',') };
  if (lr.reason) patch['Late reason'] = lr.reason + GBL_LATE.BY + who.name + ', ' + at;
  gblBillPatch_(bill, patch);
  log('approved', GBL.LABEL[line] + ' ' + gblMonthLabel_(month) + ' approved for the ' + gblDayLabel_(forDay) + ' run' + (blobs.length ? ' with ' + blobs.map(function (x) { return x.getName(); }).join(', ') : ' with no file attached') + '.' + lateSay);
  gblPostBilling_(g, line, month, 'The ' + gblMonthLabel_(month) + ' ' + GBL.LABEL[line].toLowerCase() + ' bill (' + gcmMoney_(bill.due) + ') is approved by ' + who.name + ' to go to the group on ' + gblDayLabel_(forDay) + (blobs.length ? ' with the PDF' : '') + '.' + lateSay, who);
  var live = gblLive_();
  return { ok: true, approvedFor: forDay, label: gblDayLabel_(forDay), files: blobs.length, late: cut ? { cutoff: cut, reason: lr.reason } : null,
    said: 'Approved' + (cut ? ' (after ' + gblCutWords_(cut) + (lr.reason ? '; your reason is on the bill' : '') + ')' : '') + '. It goes by itself on ' + gblDayLabel_(forDay) + (live ? ' to ' + g.to.join(', ') + ', from support@, copied to sales support' : ' as a TEST to you and the branch (the bills are in test mode until the branch manager runs gblGoLive)') + (blobs.length ? ', with ' + blobs.length + ' file' + (blobs.length === 1 ? '' : 's') + ' attached.' : ', with no file attached.'),
    steps: gblSteps_(gblBillRows_(g).filter(function (x) { return x.line === line && x.month === month; })[0]) };
}

/** The run at 10:00 on the billing day (from the hourly refresh, and first thing in the 10:30 group day): every approved bill
 *  whose day has come, group by group, with its PDFs from Drive. o.rehearse sends every approved bill as a TEST to its approver
 *  and marks nothing; o.auto (the hourly run) says nothing when nothing is due; o.now and o.force are for tests. */
function gblDayRun_(o) {
  o = o || {};
  var now = o.now || new Date(), today = gcmYmd_(now), h = Number(Utilities.formatDate(now, tTz_(), 'H'));
  var rows = gblRows_(GBL.BILLS).map(gblBillOf_).filter(function (b) { return b.status === 'approved' && b.approvedFor && !b.sentAt; });
  var due = rows.filter(function (b) { return o.rehearse || o.force || b.approvedFor < today || (b.approvedFor === today && h >= GBL_DAY.HOUR); });
  if (!due.length) return { ok: true, sent: [], held: [], said: o.auto ? '' : (o.rehearse ? 'No bill is approved yet: nothing to rehearse.' : 'No approved bill is due.') };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(120000)) return { ok: false, sent: [], held: [], error: 'Busy: the next hourly run sends them.', said: 'busy: the next hourly run sends them.' };
  var sent = [], held = [], approvers = [], t0 = Date.now();
  try {
    var L = gcmLoad_(), live = gblLive_(), test = !live || !!o.rehearse, mail = !!tMsCreds_(), groups = {}, order = [];
    due.forEach(function (b) { var k = gcmCodeKey_(b.group) + '|' + b.month; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(b); });
    order.forEach(function (k) {
      if (Date.now() - t0 > 240000) return;   // the next hourly run takes the rest
      var bills = groups[k], g = L.byName[gcmCodeKey_(bills[0].group)], month = bills[0].month;
      var who = { role: 'staff', name: bills[0].approvedBy || 'the team', email: bills[0].approvedEmail || gblStaffEmail_(bills[0].approvedBy) };
      if (who.email && approvers.indexOf(who.email.toLowerCase()) < 0) approvers.push(who.email.toLowerCase());
      var why = !g ? 'the group is no longer on the Group Register' : !mail ? 'Microsoft 365 is not set up on the backend' : gcmCannotMail_(g);
      var blobs = [];
      if (!why) bills.forEach(function (b) {
        (b.kept || '').split(',').map(function (s) { return s.trim(); }).filter(String).forEach(function (id) {
          var f = gblFileById_(id);
          if (!f) { why = 'the PDF kept for the ' + GBL.LABEL[b.line].toLowerCase() + ' bill is gone from Drive: approve it again with the file'; return; }
          try { var bl = f.getBlob(); bl.setName(String(f.getName()).split(' · ').pop()); blobs.push(bl); } catch (e) { why = 'Drive would not give back the PDF (' + String(e && e.message ? e.message : e).slice(0, 100) + ')'; }
        });
      });
      var hold = function (text) {
        if (!o.rehearse) bills.forEach(function (b) { gblBillPatch_(b, { Status: 'held: ' + text }); });
        held.push({ group: bills[0].group, month: month, lines: bills.map(function (b) { return GBL.LABEL[b.line]; }), by: who.name, email: who.email, why: text });
      };
      if (why) { hold(why); return; }
      var m = gblBillMail_(g, month, bills, who, test, L), to, cc, html = m.html, subject = m.subject, stB = gblStatementBlob_(g, month, bills, L);
      if (stB) blobs.push(stB);
      if (test) {
        to = [who.email || gcmDayManager_()].filter(String); cc = (TRANSITION.CC || []).slice();
        html = '<div style="background:#FFF4D6;border:2px solid #E0A800;padding:12px 16px;margin:0 0 14px;font:14px/1.5 Arial,sans-serif;color:#3D2E00"><b>TEST of the ' + tEsc_(gblDayLabel_(bills[0].approvedFor)) + ' run.</b> This is the ' + tEsc_(gblMonthLabel_(month)) + ' bill exactly as it would go to <b>' + tEsc_(g.to.join(', ')) + '</b>' +
          (gcmCc_(g).length ? ' (copied to ' + tEsc_(gcmCc_(g).join(', ')) + ')' : '') + ', approved by ' + tEsc_(who.name) + '. ' + (o.rehearse ? 'It has not gone to the group, and nothing is marked as sent.' : 'The bills are in test mode (gblGoLive switches them on): nothing has reached the group.') + '</div>' + html;
        subject = '[TEST] ' + subject;
      } else { to = g.to.slice(0, 1); cc = gcmCc_(g); }
      if (!to.length) { hold('no address to send the test copy to: the approver is not on the Agent Skill Bank with an e-mail'); return; }
      try { tMsSend_(to[0], subject, html, { cc: cc.concat(to.slice(1)), attachments: blobs, replyTo: TRANSITION.MS_FROM }); }
      catch (e) { hold('Microsoft 365 refused it (' + String(e && e.message ? e.message : e).slice(0, 160) + ')'); return; }
      var at = gcmWhen_(new Date());
      /* a bill approved after its cut-off goes in the next run: marked late, with the reason given at the approval */
      var cut = gblLateOf_(bills, now), why2 = bills.map(function (b) { return gblLateText_(b.lateReason); }).filter(String)[0] || '';
      if (!o.rehearse) {
        gcmAppend_(GCM.SENDS, [{ When: new Date(), Group: g.name, Staff: gcmSigner_(who, g), To: to.join(', '), Cc: cc.join(', '), Subject: m.subject, Items: bills.length, 'Task Ids': bills.map(function (x) { return x.line + ':' + x.month; }).join(' '),
          Letter: m.text.slice(0, 40000), Via: 'support@, billing run' + (cut ? ', late (cut-off ' + cut + ')' : '') + (blobs.length ? ', ' + blobs.length + ' file' + (blobs.length === 1 ? '' : 's') : ''), Status: test ? 'bill test' : 'bill sent', Html: gcmKeepHtml_(m.html) }]);
        if (cut) {
          gblAppend_(GBL.CHANGES, bills.map(function (b) {
            return { When: new Date(), Group: g.name, Line: b.line, Kind: 'late send', Member: '', Detail: GBL.LABEL[b.line] + ' ' + gblMonthLabel_(month) + (test ? ' went as a TEST copy' : ' went to the group') + ' in the ' + gblDayLabel_(b.approvedFor) + ' run, approved by ' + (b.approvedBy || 'the team') + ' after ' + gblCutWords_(cut) + '.',
              Effective: month + '-01', Amount: b.due || 0, Source: 'staff', By: b.approvedBy || '', Status: test ? 'test' : 'done', 'SF Task': '', 'SF Id': '', Note: why2 };
          }));
          if (!test) gblLateTask_(g, cut, (bills[0].approvedBy || 'The team') + ': the ' + gblMonthLabel_(month) + ' bill went to the group in the ' + gblDayLabel_(bills[0].approvedFor) + ' run. Why it missed ' + gblCutWords_(cut) + ': ' + (why2 || 'no reason given') + '.');
        }
        bills.forEach(function (b) {
          gblBillPatch_(b, test ? { Status: 'tested' } : { Status: 'sent', 'Sent at': at });
          gblPostBilling_(g, b.line, month, (test ? 'TEST of the ' : 'The ') + gblMonthLabel_(month) + ' ' + GBL.LABEL[b.line].toLowerCase() + ' bill went ' + (test ? 'to ' + to.join(', ') : 'to the group (' + to.join(', ') + ')') + ' from support@ in the ' + gblDayLabel_(b.approvedFor) + ' run' + (blobs.length ? ', with the PDF attached' : '') + '.', who);
          if (!test) (b.kept || '').split(',').map(function (s) { return s.trim(); }).filter(String).forEach(function (id) { var f = gblFileById_(id); if (f) { try { f.moveTo(gblSubfolder_(GBL_DAY.SENT)); } catch (e) {} } });
        });
      }
      sent.push({ group: g.name, month: month, lines: bills.map(function (b) { return GBL.LABEL[b.line]; }), by: who.name, email: who.email, to: to.join(', '), files: blobs.length, test: test, late: cut ? { cutoff: cut, reason: why2 } : null });
    });
  } finally { try { lock.releaseLock(); } catch (e) {} }
  try { gblDayTell_(sent, held, { rehearse: !!o.rehearse, approvers: approvers }); } catch (e) {}
  var test2 = sent.length && sent[0].test;
  return { ok: true, sent: sent, held: held, rehearse: !!o.rehearse,
    said: o.rehearse ? 'Rehearsal: ' + sent.length + ' bill e-mail' + (sent.length === 1 ? '' : 's') + ' would go, each sent to its approver and the branch marked TEST; ' + held.length + ' would wait. Nothing reached a group.'
      : sent.length + ' bill e-mail' + (sent.length === 1 ? '' : 's') + (test2 ? ' sent as TEST copies to the approvers (test mode)' : ' sent to the groups') + ', ' + held.length + ' waiting.' };
}
/** One internal e-mail a run: what went and what waited and why, to the branch manager and to whoever approved a bill that waited. */
function gblDayTell_(sent, held, o) {
  o = o || {};
  if (!sent.length && !held.length) return;
  var me = gcmDayManager_(), E = tEsc_, to = [me], cc = [];
  held.forEach(function (x) { if (x.email && to.concat(cc).map(function (a) { return a.toLowerCase(); }).indexOf(x.email.toLowerCase()) < 0) cc.push(x.email); });
  if (o.rehearse) (o.approvers || []).forEach(function (a) { if (to.concat(cc).map(function (x) { return x.toLowerCase(); }).indexOf(a) < 0) cc.push(a); });
  var li = function (x, what) { return '<li><b>' + E(x.group) + '</b> · ' + E(gblMonthLabel_(x.month)) + ' · ' + E(x.lines.join(', ')) + ' · ' + what + ' · approved by ' + E(x.by) + '</li>'; };
  var subject = (o.rehearse ? '[TEST] ' : '') + 'Group bills, the ' + GBL_DAY.HOUR + ':00 run: ' + sent.length + ' sent' + (held.length ? ', ' + held.length + ' waiting' : '');
  var html = '<div style="font:15px/1.6 Arial,sans-serif;color:#142033;max-width:720px">' +
    (o.rehearse ? '<p><b>Rehearsal.</b> Each approved bill was sent to its approver and the branch, marked TEST. Nothing reached a group and nothing is marked as sent.</p>' : '') +
    (sent.length ? '<p style="margin:0 0 6px;font-weight:700">Went</p><ul>' + sent.map(function (x) { return li(x, (x.test ? 'TEST copy to ' : 'to ') + E(x.to) + (x.files ? ', ' + x.files + ' file' + (x.files === 1 ? '' : 's') : ', no file') +
      (x.late ? ' · <b>late</b>, after ' + E(gblCutWords_(x.late.cutoff)) + ': ' + (x.late.reason ? E(x.late.reason) : '<i>no reason given</i>') : '')); }).join('') + '</ul>' : '') +
    (held.length ? '<p style="margin:12px 0 6px;font-weight:700">Waited</p><ul>' + held.map(function (x) { return li(x, 'held: ' + E(x.why)); }).join('') + '</ul><p>A held bill stays approved with the reason on its row: put it right and press Send now, or approve it again.</p>' : '') +
    '<p style="color:#777;font-size:12px">' + E(tInternal_(null)) + '</p></div>';
  if (tMsCreds_()) tMsSend_(to[0], subject, html, { cc: cc, replyTo: me });
  else MailApp.sendEmail({ to: to[0], cc: cc.join(','), subject: subject, htmlBody: html, name: 'Ricky Rampersad Branch' });
}
/** The editor's Run buttons. */
function gblDayNow() { var r = gblDayRun_({ force: true }); return tSay_(r.said || r.error || ''); }
function gblDayRehearse() { var r = gblDayRun_({ rehearse: true }); return tSay_(r.said || r.error || ''); }

/** Which lines each group is billed on this cycle: a Salesforce billing record for the cycle's month or the one after
 *  (one query over every account, kept an hour), plus any bill stored for those months. Without Salesforce, the lines
 *  with a bill stored in the last 70 days. */
function gblExpected_(L, cycle) {
  var m1 = cycle.end.slice(0, 7), m2 = gblAddMonths_(m1, 1), m0 = gblAddMonths_(m1, -1), out = {}, add = function (key, line) { if (!line) return; (out[key] = out[key] || []); if (out[key].indexOf(line) < 0) out[key].push(line); };
  var byAcct = {};
  L.reg.forEach(function (g) { (g.acctsFull && g.acctsFull.length ? g.acctsFull : g.accts).forEach(function (a) { byAcct[gcmId15_(a)] = g.key; }); });
  var accts = Object.keys(byAcct);
  if (tSfOn_() && accts.length) {
    var key = 'gbl-expected-' + m1, cache = CacheService.getScriptCache(), recs = null;
    try { var c = cache.get(key); if (c) recs = JSON.parse(c); } catch (e) {}
    if (!recs) {
      recs = [];
      try {
        gcmQuery_('SELECT Account__c, RecordType.Name, Renewal_Date__c FROM TRANSACTIONS__c WHERE Account__c IN (' + gcmIn_(accts) + ') AND Renewal_Date__c >= ' + m0 + '-01 AND Renewal_Date__c <= ' + m2 + '-28')
          .forEach(function (t) { recs.push({ a: gcmId15_(t.Account__c), line: gblLineOfRt_(gcmName_(t, 'RecordType')), month: gblMonthOf_(t.Renewal_Date__c) }); });
        try { cache.put(key, JSON.stringify(recs), 3600); } catch (e2) {}
      } catch (e) { recs = null; }
    }
    if (recs) recs.forEach(function (t) { if (t.month === m1 || t.month === m2) add(byAcct[t.a], t.line); });
  }
  var since = gcmAddDays_(cycle.end, -70);
  gblRows_(GBL.BILLS).map(gblBillOf_).forEach(function (b) {
    var g = L.byName[gcmCodeKey_(b.group)];
    if (!g) return;
    if (b.month === m1 || b.month === m2 || (!tSfOn_() && b.at.slice(0, 10) >= since)) add(g.key, b.line);
  });
  return out;
}
/** The cycle, group by group, by who looks after them: the bills that went since the last billing day, the ones that did not
 *  and why, and the groups that cannot have one. */
function gblChaseList_(L, now) {
  var cycle = gblCycle_(now), exp = gblExpected_(L, cycle), by = {}, order = [], all = gblRows_(GBL.BILLS).map(gblBillOf_);
  var m1 = cycle.end.slice(0, 7), m2 = gblAddMonths_(m1, 1);
  L.reg.forEach(function (g) {
    var lines = exp[g.key] || [];
    if (!lines.length) return;
    var key = gcmCodeKey_(g.ownerEmail || g.assigned || 'nobody');
    if (!by[key]) { by[key] = { name: g.assigned || '', email: g.ownerEmail || '', active: !!(g.assigned && g.ownerActive), missed: [], sent: [], notReady: [] }; order.push(key); }
    var o = by[key];
    var went = (g.billSends || []).filter(function (x) { return /^bill (sent|test)$/i.test(x.status) && x.when > cycle.start && x.when <= cycle.end && !gblLateBefore_(x.via, cycle.end); });
    if (went.length) { o.sent.push({ g: g, at: went[went.length - 1].at, n: went.length, lines: lines, test: went.every(function (x) { return /test/i.test(x.status); }) }); return; }
    var no = gcmCannotMail_(g);
    if (no) { o.notReady.push({ g: g, why: no, lines: lines }); return; }
    /* where each billed line stands for the cycle's month (or the one after) */
    var states = lines.map(function (ln) {
      var b = all.filter(function (x) { return gcmCodeKey_(x.group) === g.key && x.line === ln && (x.month === m1 || x.month === m2); }).sort(function (a, c) { return a.month < c.month ? 1 : -1; })[0];
      var lab = GBL.LABEL[ln];
      if (!b) return { line: ln, state: 'none', why: lab + ': nothing uploaded', todo: 'upload the bill, verify, reconcile and approve it' };
      if (/^held/i.test(b.status)) return { line: ln, state: 'held', why: lab + ': approved, held at the run (' + b.status.replace(/^held:\s*/i, '') + ')', todo: 'put it right and press Send now' };
      if (b.status === 'approved' && b.approvedFor > cycle.end) return { line: ln, state: 'later', why: lab + ': approved by ' + b.approvedBy + ' after the run, so it waits for ' + gblDayLabel_(b.approvedFor), todo: 'if it should go now, press Send now' };
      if (b.status === 'approved') return { line: ln, state: 'queued', why: '', todo: '' };
      if (b.reconciledAt) return { line: ln, state: 'reconciled', why: lab + ': reconciled, not approved', todo: 'press Approve (it asks why it missed the cut-off), then Send now if it cannot wait for the next run' };
      var s = gblSteps_(b);
      if (s.fixes) return { line: ln, state: 'fix', why: lab + ': uploaded, ' + s.fixes + ' to fix', todo: 'fix or resolve each finding, reconcile, approve' };
      return { line: ln, state: 'check', why: lab + ': uploaded, not reconciled', todo: 'confirm the checks, mark it reconciled, approve' };
    });
    if (states.every(function (s) { return s.state === 'queued'; })) return;   // approved for this run, not sent yet: it goes
    var open = states.filter(function (s) { return s.state !== 'queued'; });
    o.missed.push({ g: g, lines: lines, states: states, why: open.map(function (s) { return s.why; }).join('; '), todo: open.map(function (s) { return s.todo; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).join('; ') });
  });
  return { cycle: cycle, owners: order.map(function (k) { return by[k]; }), month: gblMonthLabel_(m1) };
}
/** One staff member's e-mail on the billing day. */
function gblChaseMail_(o, list, tasks) {
  var E = tEsc_, first = String(o.name || '').split(/\s+/)[0] || 'team', n = o.missed.length, day = gblDayLabel_(list.cycle.end);
  var subject = 'Group bills: ' + n + ' of your groups had no bill for ' + list.month + ' · reply by ' + GCM_DAY.REPLY_BY;
  var th = 'style="text-align:left;padding:7px 10px;border-bottom:2px solid #13408F;font:700 13px Arial,sans-serif;color:#13408F"';
  var td = 'style="padding:8px 10px;border-bottom:1px solid #E2E7EF;font:14px/1.45 Arial,sans-serif;color:#142033;vertical-align:top"';
  var table = function (head, rows) { return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 16px"><tr>' +
    head.map(function (h) { return '<th ' + th + '>' + E(h) + '</th>'; }).join('') + '</tr>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td ' + td + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>'; };
  var html = '<div style="font:15px/1.6 Arial,sans-serif;color:#142033;max-width:720px">' +
    '<p>Good morning, ' + E(first) + '.</p>' +
    '<p>The group bills went at ' + GBL_DAY.HOUR + ':00 today, ' + E(day.replace(/, \d+:\d+$/, '')) + '. <b>' + n + ' of your groups had none.</b> Approve it today and it goes by itself at ' + GBL_DAY.HOUR + ':00 on ' +
      E(gblDayLabel_(gblNextWorkingDay_(list.cycle.end)).replace(/, \d+:\d+$/, '')) + ', or press Send now to send it at once. Each asks why it was not done by 10:00, and your reason comes to Mr Rampersad.</p>' +
    table(['Group', 'Where it stands', 'Do this today'], o.missed.map(function (m) {
      var t = tasks && tasks[m.g.key];
      return ['<b>' + E(m.g.name) + '</b>' + (t && t.id ? '<br><span style="color:#4B586C;font-size:12.5px">Salesforce task ' + E(t.id) + '</span>' : ''), m.states.filter(function (s) { return s.state !== 'queued'; }).map(function (s) { return E(s.why); }).join('<br>'), E(m.todo)];
    })) +
    (tasks && Object.keys(tasks).length ? '<p>A Salesforce task (' + E(GCM_DAY.TASK_TYPE) + ') is open for each one in your name. Close it with your reason in its comments.</p>' : '') +
    '<p style="background:#FFF4D6;border-left:4px solid #E0A800;padding:10px 14px"><b>Please reply to this e-mail by ' + E(GCM_DAY.REPLY_BY) + '</b> with why each bill was not approved by ' + GBL_DAY.HOUR + ':00, and when it will go. Your reply goes to Mr Rampersad.</p>' +
    '<p style="margin:16px 0 6px;font-weight:700">From your training: Billings Management</p>' +
    GBL_DAY.TRAIN.map(function (t) { return '<p style="margin:0 0 8px;padding:8px 12px;background:#F4F7FA;border-left:3px solid #1D5BC4"><i>“' + E(t[1]) + '”</i><br><span style="font-size:12.5px;color:#4B586C">' + E(t[0]) + '</span></p>'; }).join('') +
    '<p><a href="' + GCM.SITE + '" style="color:#1D5BC4;font-weight:700">Open group client management</a></p>' +
    (o.sent.length ? '<p style="margin:18px 0 6px;font-weight:700">Your groups whose bill went this cycle</p>' +
      table(['Group', 'Sent', 'Lines'], o.sent.map(function (x) { return ['<b>' + E(x.g.name) + '</b>', E(x.at) + (x.test ? ' (test copy)' : ''), E(x.lines.map(function (l) { return GBL.LABEL[l]; }).join(', '))]; })) : '') +
    (o.notReady.length ? '<p style="margin:18px 0 6px;font-weight:700">Your groups that cannot have a bill yet</p>' +
      table(['Group', 'What is missing'], o.notReady.map(function (x) { return ['<b>' + E(x.g.name) + '</b>', E(x.why)]; })) : '') +
    '<p style="color:#777;font-size:12px">' + E(tInternal_(null)) + '</p></div>';
  var text = ['Good morning, ' + first + '.', '', n + ' of your groups had no bill for ' + list.month + ':']
    .concat(o.missed.map(function (m) { return '- ' + m.g.name + ': ' + m.why + '. ' + m.todo; }))
    .concat(['', 'Please reply by ' + GCM_DAY.REPLY_BY + ' with why each was not approved by ' + GBL_DAY.HOUR + ':00, and when it will go.']).join('\n');
  return { subject: subject, html: html, text: text };
}
/** The staff part of the billing day: a task for each group that missed, then one e-mail to each staff member, from support@,
 *  the branch manager copied and replies to him. o.test sends each to the branch manager instead and opens nothing. */
function gblChaseRun_(o) {
  o = o || {};
  var L = gcmLoad_(), list = gblChaseList_(L, o.now), me = gcmDayManager_(), E = tEsc_, sent = [], failed = [];
  var tasks = gcmChaseTasks_(list.owners, list.cycle.end, list.cycle.today, !!o.test,
    { tag: GBL_DAY.TASK_TAG, prop: GBL_DAY.TASKS_PROP, label: list.month + ' bills', train: GBL_DAY.TRAIN, why: 'not approved by ' + gblDayLabel_(list.cycle.end) });
  list.owners.forEach(function (ow) {
    if (!ow.missed.length) return;
    var mine = {};
    ow.missed.forEach(function (m) { if (tasks[m.g.key]) mine[m.g.key] = tasks[m.g.key]; });
    var m = gblChaseMail_(ow, list, mine), to = ow.active && ow.email ? ow.email : me, html = m.html;
    if (o.test) {
      html = '<div style="background:#FFF4D6;border:2px solid #E0A800;padding:12px 16px;margin:0 0 14px;font:14px/1.5 Arial,sans-serif;color:#3D2E00"><b>TEST.</b> This goes to <b>' + E(to) + '</b>, copied to you, at 10:30 on the billing day. Tasks it would open:<br>' +
        ow.missed.map(function (x) { return '· ' + E((tasks[x.g.key] || {}).subject || x.g.name); }).join('<br>') + '</div>' + html;
      to = me;
    }
    try {
      if (tMsCreds_()) tMsSend_(to, (o.test ? '[TEST] ' : '') + m.subject, html, { cc: o.test || to === me ? [] : [me], replyTo: me });
      else MailApp.sendEmail({ to: to, cc: o.test || to === me ? '' : me, replyTo: me, subject: (o.test ? '[TEST] ' : '') + m.subject, htmlBody: html, name: 'Ricky Rampersad Branch' });
      sent.push((ow.name || 'nobody') + ' (' + ow.missed.length + ')');
    } catch (e) { failed.push((ow.name || 'nobody') + ': ' + String(e && e.message ? e.message : e).slice(0, 140)); }
  });
  return { ok: true, list: list, tasks: tasks, sent: sent, failed: failed,
    said: (sent.length ? sent.length + ' staff e-mail' + (sent.length === 1 ? '' : 's') + (o.test ? ' (tests to ' + me + ')' : '') + ': ' + sent.join(', ') : 'every billed group had its bill this cycle: no staff e-mail') + (failed.length ? '; did not go: ' + failed.join('; ') : '') + '.' };
}
/** The bills' part of the 10:30 group day (gcmDay_): on the billing day, the run (if 10:00 did not reach it) and then the
 *  staff asked why; every day, the block for the branch manager's summary. o.test rehearses both to the branch manager. */
function gblDay_(o) {
  o = o || {};
  var now = o.now || new Date(), cycle = gblCycle_(now), info = gblDayInfo_(now), out = { info: info, cycle: cycle, run: null, chase: null, said: '', html: '' }, said = [];
  if (cycle.isDay || o.test) {
    try { out.run = gblDayRun_(o.test ? { rehearse: true, now: now } : { now: now }); if (out.run.said) said.push(out.run.said); } catch (e) { out.run = { sent: [], held: [], said: String(e && e.message ? e.message : e).slice(0, 160) }; said.push(out.run.said); }
    if (gblLive_() || o.test) {
      try { out.chase = gblChaseRun_({ test: !!o.test, now: now }); said.push('staff: ' + out.chase.said); } catch (e) { out.chase = { sent: [], failed: [], said: String(e && e.message ? e.message : e).slice(0, 160) }; said.push('staff: ' + out.chase.said); }
    } else {
      // Test mode: the bills reach nobody but their approvers, so nobody is asked why one did not go, and no KPI task opens. The summary still says what would have been asked.
      var heldList = null; try { heldList = gblChaseList_(gcmLoad_(), now); } catch (e) {}
      out.chase = { ok: true, held: true, list: heldList, tasks: {}, sent: [], failed: [], said: 'nobody asked and no task opened: the bills are in test mode until gblGoLive.' };
      said.push('staff: ' + out.chase.said);
    }
  }
  try { out.html = gblDayHtml_(out, o); } catch (e) { out.html = ''; }
  if (!said.length) {
    var L = gcmLoad_(), list = gblChaseList_(L, now), n = 0, miss = 0;
    list.owners.forEach(function (ow) { n += ow.sent.length + ow.missed.length; miss += ow.missed.length; });
    said.push('the next billing day is ' + info.label + (info.daysTo ? ', in ' + info.daysTo + ' day' + (info.daysTo === 1 ? '' : 's') : '') + ': ' + (n - miss) + ' of ' + n + ' billed groups sent or approved.');
  }
  out.said = said.join(' ');
  return out;
}
/** The bills block of the branch manager's daily summary. */
function gblDayHtml_(d, o) {
  var E = tEsc_, L = gcmLoad_(), list = (d.chase && d.chase.list) || gblChaseList_(L, o && o.now), info = d.info;
  var td = 'style="padding:7px 10px;border-bottom:1px solid #E2E7EF;font:14px/1.45 Arial,sans-serif;vertical-align:top"';
  var row = function (cells) { return '<tr>' + cells.map(function (c) { return '<td ' + td + '>' + c + '</td>'; }).join('') + '</tr>'; };
  var head = function (cells) { return '<tr>' + cells.map(function (c) { return '<th style="text-align:left;padding:7px 10px;border-bottom:2px solid #13408F;font:700 13px Arial,sans-serif;color:#13408F">' + E(c) + '</th>'; }).join('') + '</tr>'; };
  var tbl = function (h, rows) { return rows.length ? '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 16px">' + head(h) + rows.join('') + '</table>' : ''; };
  var sentG = [], missed = [], notReady = [];
  list.owners.forEach(function (ow) { ow.sent.forEach(function (x) { sentG.push({ ow: ow, x: x }); }); ow.missed.forEach(function (x) { missed.push({ ow: ow, x: x }); }); ow.notReady.forEach(function (x) { notReady.push({ ow: ow, x: x }); }); });
  var n = sentG.length + missed.length, tasks = (d.chase && d.chase.tasks) || {};
  var h = '<h3 style="margin:18px 0 6px;font:700 16px Arial,sans-serif;color:#13408F">Group bills: ' + E(gblDayLabel_(d.cycle.end)) + '</h3>';
  if (d.cycle.isDay || (o && o.test)) {
    var r = d.run || { sent: [], held: [] };
    h += '<p><b>' + sentG.length + ' of ' + n + '</b> billed groups had their ' + E(list.month) + ' bill' + (sentG.length && sentG.every(function (s) { return s.x.test; }) ? ' (test copies: the bills are in test mode until gblGoLive)' : '') + '. ' +
      'The ' + GBL_DAY.HOUR + ':00 run' + (o && o.test ? ' (rehearsed)' : '') + ': ' + r.sent.length + ' bill' + (r.sent.length === 1 ? '' : 's') + ' went, ' + r.held.length + ' waited.' + (r.held.length ? ' Waiting: ' + r.held.map(function (x) { return E(x.group) + ' (' + E(x.why) + ')'; }).join('; ') + '.' : '') + '</p>' +
      (missed.length ? '<p style="margin:12px 0 6px;font-weight:700">No bill this cycle</p>' + tbl(['Group', 'Looked after by', 'Where it stands', 'Task'], missed.map(function (a) {
        var t = tasks[a.x.g.key] || {};
        return row(['<b>' + E(a.x.g.name) + '</b>', E(a.ow.name || 'nobody'), E(a.x.why), E(t.id ? (t.existing ? 'open since earlier: ' : 'opened: ') + t.id : t.test ? 'would open' : d.chase && d.chase.held ? 'would open after gblGoLive' : t.error || '–')]); })) : '') +
      '<p><b>Staff asked why:</b> ' + E(d.chase ? d.chase.said : 'not run') + '</p>';
  } else {
    h += '<p>The next billing day is <b>' + E(info.label) + '</b>' + (info.daysTo ? ' (in ' + info.daysTo + ' day' + (info.daysTo === 1 ? '' : 's') + ')' : '') + '. ' +
      '<b>' + (n - missed.length) + ' of ' + n + '</b> billed groups have their ' + E(list.month) + ' bill sent or approved' + (info.drive ? '' : '. <b>The Drive folder is not set</b> (' + GBL_PDF.FOLDER_PROP + '), so a bill cannot be approved with its PDF, and Send now needs an approved bill') + '.</p>' +
      (missed.length ? tbl(['Group', 'Looked after by', 'Where it stands'], missed.map(function (a) { return row(['<b>' + E(a.x.g.name) + '</b>', E(a.ow.name || 'nobody'), E(a.x.why)]); })) : '');
  }
  if (sentG.length && (d.cycle.isDay || (o && o.test))) h += '<p style="margin:12px 0 6px;font-weight:700">Had their bill</p>' + tbl(['Group', 'Looked after by', 'Sent', 'Lines'], sentG.map(function (a) { return row(['<b>' + E(a.x.g.name) + '</b>', E(a.ow.name), E(a.x.at) + (a.x.test ? ' (test copy)' : ''), E(a.x.lines.map(function (l) { return GBL.LABEL[l]; }).join(', '))]); }));
  if (notReady.length) h += '<p style="margin:12px 0 6px;font-weight:700">Cannot have a bill yet</p>' + tbl(['Group', 'Looked after by', 'What is missing'], notReady.map(function (a) { return row(['<b>' + E(a.x.g.name) + '</b>', E(a.ow.name || 'nobody'), E(a.x.why)]); }));
  /* the bills that went after their cut-off since the last billing day, each with the reason given */
  var late = []; try { late = gblLateSends_(d.cycle.isDay ? d.cycle.end : d.cycle.start); } catch (e) {}
  if (late.length) h += '<p style="margin:12px 0 6px;font-weight:700">Sent after the ' + GBL_DAY.HOUR + ':00 cut-off</p>' + tbl(['Group', 'Line', 'By', 'When', 'Why it was late'], late.map(function (x) {
    return row(['<b>' + E(x.group) + '</b>', E(x.line), E(x.by || '–'), E(x.at) + (x.test ? ' (test copy)' : ''), x.reason ? E(x.reason) : '<i style="color:#B42318">no reason given</i>']); }));
  return h;
}
/** Editor Run: the billing day rehearsed to the branch manager (the approved bills as TEST copies to their approvers, the staff
 *  e-mails and the summary block to him), with nothing marked and no task opened. */
function gblDayTest() { var r = gblDay_({ test: true }); try { gcmDaySummary_({ test: true, bills: r }); } catch (e) {} return tSay_(r.said); }

/* ── The report on the 25th: who has worked the bills, the day before they go (25 October 2026) ─────────────────────
 *  "On the 25th in the afternoon, I get the report, because during the day on the 25th, reference is made to that billing
 *  in the morning. So at 1 o'clock, I have a report." At 13:00 on the 25th (the last working day before it when the 25th
 *  is a weekend or a holiday), while the staff are still in: every billed group, each line where it stands and who did each
 *  step (uploaded, reconciled, approved), and what is left before 10:00 on the billing day. To the branch manager, the staff
 *  who look after the groups copied. Internal only: nothing reaches a group. */
function gblReportRows_(L, now) {
  var cycle = gblCycle_(now), exp = gblExpected_(L, cycle), all = gblRows_(GBL.BILLS).map(gblBillOf_), m1 = cycle.end.slice(0, 7), m2 = gblAddMonths_(m1, 1), rows = [];
  L.reg.forEach(function (g) {
    var lines = exp[g.key] || [];
    if (!lines.length) return;
    var cannot = gcmCannotMail_(g);
    var states = lines.map(function (ln) {
      var lab = GBL.LABEL[ln], b = all.filter(function (x) { return gcmCodeKey_(x.group) === g.key && x.line === ln && (x.month === m1 || x.month === m2); }).sort(function (a, c) { return a.month < c.month ? 1 : -1; })[0];
      if (!b) return { label: lab, stage: 'Nothing uploaded', who: '', left: 'Upload the bill, verify it, reconcile and approve it', ready: false, worked: false };
      var who = [], s = gblSteps_(b);
      if (b.by) who.push('uploaded by ' + b.by + (b.at ? ', ' + b.at : ''));
      if (b.reconciledAt) who.push('reconciled by ' + b.reconciledBy);
      if (b.approvedBy) who.push('approved by ' + b.approvedBy);
      var o = { label: lab, month: gblMonthLabel_(b.month), who: who.join('; '), worked: true };
      if (b.lateReason) o.late = gblLateText_(b.lateReason);
      if (b.sentAt) return Object.assign(o, { stage: 'Sent ' + b.sentAt + (b.sentBy ? ' by ' + b.sentBy : ''), left: '', ready: true });
      if (/^held/i.test(b.status)) return Object.assign(o, { stage: 'Approved, held at a run: ' + b.status.replace(/^held:\s*/i, ''), left: 'Put it right and press Send now', ready: false });
      if (b.status === 'approved') return Object.assign(o, { stage: 'Approved for ' + gblDayLabel_(b.approvedFor), left: b.approvedFor <= cycle.end ? '' : 'Approved for a later run: press Send now if it should go', ready: b.approvedFor <= cycle.end });
      if (b.reconciledAt) return Object.assign(o, { stage: 'Reconciled, not approved', left: 'Press Approve', ready: false });
      if (s.fixes) return Object.assign(o, { stage: 'Uploaded, ' + s.fixes + ' to fix', left: 'Fix or resolve each finding, reconcile, approve', ready: false });
      return Object.assign(o, { stage: 'Uploaded, not reconciled', left: 'Confirm the checks, mark it reconciled, approve', ready: false });
    });
    rows.push({ g: g, owner: g.assigned || 'nobody', email: g.ownerActive && g.ownerEmail ? g.ownerEmail : '', states: states, cannot: cannot,
      ready: !cannot && states.every(function (x) { return x.ready; }), started: states.some(function (x) { return x.worked; }) });
  });
  rows.sort(function (a, b) { return a.owner.localeCompare(b.owner) || a.g.name.localeCompare(b.g.name); });
  return { cycle: cycle, rows: rows };
}
function gblBillReport_(o) {
  o = o || {};
  var now = o.now || new Date(), today = gcmYmd_(now), h = Number(Utilities.formatDate(now, tTz_(), 'H'));
  var day = gblNextBillDay_(now), repDay = gblReportDayOf_(day), props = PropertiesService.getScriptProperties();
  if (o.auto) {
    if (today !== repDay || h < GBL_DAY.REPORT_HOUR) return { ok: true, said: '' };
    if (props.getProperty(GBL_DAY.REPORT_PROP) === today) return { ok: true, said: '' };
  }
  var L = gcmLoad_(), R = gblReportRows_(L, now), rows = R.rows, E = tEsc_, me = gcmDayManager_(), live = gblLive_();
  if (!rows.length) { if (o.auto) props.setProperty(GBL_DAY.REPORT_PROP, today); return { ok: true, said: o.auto ? '' : 'No group is billed this cycle: no report.' }; }
  var ready = rows.filter(function (r) { return r.ready; }), notStarted = rows.filter(function (r) { return !r.started && !r.cannot; }), left = rows.filter(function (r) { return !r.ready; });
  var when = gblDayLabel_(day), dayWords = when.replace(/, \d+:\d+$/, '');
  var subject = (o.test ? '[TEST] ' : '') + 'Group bills go ' + (gcmDays_(today, day) === 1 ? 'tomorrow, ' : '') + dayWords + ' at ' + GBL_DAY.HOUR + ':00: ' + ready.length + ' of ' + rows.length + ' groups ready';
  var th = 'style="text-align:left;padding:7px 10px;border-bottom:2px solid #13408F;font:700 13px Arial,sans-serif;color:#13408F"';
  var td = 'style="padding:8px 10px;border-bottom:1px solid #E2E7EF;font:14px/1.45 Arial,sans-serif;color:#142033;vertical-align:top"';
  var tile = function (n, what, bad) { return '<td style="padding:10px 12px;border:1px solid #E2E7EF;border-top:4px solid ' + (bad ? '#D03B3B' : '#1D5BC4') + ';font:13px/1.4 Arial,sans-serif;color:#4B586C;width:33%"><b style="display:block;font:700 22px Arial,sans-serif;color:' + (bad ? '#B42318' : '#142033') + '">' + n + '</b>' + what + '</td>'; };
  var owners = [], cc = [];
  rows.forEach(function (r) { if (owners.indexOf(r.owner) < 0) owners.push(r.owner); if (r.email && r.email.toLowerCase() !== String(me).toLowerCase() && cc.map(function (x) { return x.toLowerCase(); }).indexOf(r.email.toLowerCase()) < 0) cc.push(r.email); });
  var html = '<div style="font:15px/1.6 Arial,sans-serif;color:#142033;max-width:760px">' +
    (o.test ? '<div style="background:#FFF4D6;border:2px solid #E0A800;padding:12px 16px;margin:0 0 14px;font:14px/1.5 Arial,sans-serif;color:#3D2E00"><b>TEST.</b> This report goes by itself at ' + GBL_DAY.REPORT_HOUR + ':00 on the ' + (gblDayOfMonth_() - 1) + 'th, or the working day before it (this cycle: ' + E(gblDayLabel_(repDay).replace(/, \d+:\d+$/, '')) + '), to you, copied to ' + E(cc.join(', ') || 'nobody') + '.</div>' : '') +
    '<p>The group bills go by themselves <b>' + E(when) + '</b>: every line reconciled and approved by then, from support@ with its PDF' + (live ? '' : ' (in test mode: a TEST copy to whoever approved it, until gblGoLive)') + '. Here is who has worked each billed group, and what is left.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:6px 0;margin:0 0 16px"><tr>' +
    tile(ready.length + ' of ' + rows.length, 'groups ready for ' + E(dayWords)) + tile(left.length, 'with work left before ' + GBL_DAY.HOUR + ':00', left.length > 0) + tile(notStarted.length, 'not started: nothing uploaded', notStarted.length > 0) + '</tr></table>' +
    owners.map(function (ow) {
      var mine = rows.filter(function (r) { return r.owner === ow; });
      /* one column, a block a group and a line under it, so it reads on a phone as well as at a desk */
      return '<p style="margin:18px 0 6px;font-weight:700;font-size:16px;color:#13408F;border-bottom:2px solid #13408F;padding:0 0 4px">' + E(ow) + ' · ' + mine.filter(function (r) { return r.ready; }).length + ' of ' + mine.length + ' ready</p>' +
        mine.map(function (r) {
          var head = '<div style="font:700 15px/1.4 Arial,sans-serif;color:#142033;margin:12px 0 4px">' + E(r.g.name) + (r.ready ? ' <span style="color:#067647;font-size:12.5px">✓ ready</span>' : '') + '</div>';
          if (r.cannot) return head + '<div style="border-left:4px solid #E0A800;background:#FFF8E6;padding:8px 12px;margin:0 0 6px;font:14px/1.45 Arial,sans-serif">Cannot have a bill yet: ' + E(r.cannot) + '</div>';
          return head + r.states.map(function (x) {
            var c = x.ready ? '#12B76A' : x.worked ? '#E0A800' : '#D03B3B';
            return '<div style="border-left:4px solid ' + c + ';background:#F7F9FC;padding:8px 12px;margin:0 0 6px;font:14px/1.45 Arial,sans-serif;color:#142033">' +
              '<b>' + E(x.label) + '</b>' + (x.month ? ' <span style="color:#4B586C;font-size:12.5px">' + E(x.month) + '</span>' : '') + '<br>' + E(x.stage) +
              '<br><span style="color:#4B586C">Who worked it:</span> ' + (x.who ? E(x.who) : '<span style="color:#B42318;font-weight:700">nobody yet</span>') +
              (x.left ? '<br><span style="color:#4B586C">Left before ' + GBL_DAY.HOUR + ':00:</span> <b>' + E(x.left) + '</b>' : '') +
              (x.late ? '<br><span style="color:#4B586C">Why it was late:</span> ' + E(x.late) : '') + '</div>';
          }).join('');
        }).join('');
    }).join('') +
    '<p>A line approved after ' + E(when) + ' is a late bill and goes at ' + GBL_DAY.HOUR + ':00 the next working day, or when someone presses Send now; either way the approval or the send asks why it missed ' + GBL_DAY.HOUR + ':00. At 10:30 on ' + E(dayWords) + ' each staff member whose group had no bill is asked why, and a task opens' + (live ? '' : ' once the bills are live') + '.</p>' +
    '<p><a href="' + GCM.SITE + 'billing.html" style="color:#1D5BC4;font-weight:700">Open Billings Management</a></p>' +
    '<p style="color:#777;font-size:12px">' + E(tInternal_(null)) + '</p></div>';
  var to = me;
  try {
    if (tMsCreds_()) tMsSend_(to, subject, html, { cc: o.test ? [] : cc, replyTo: me });
    else MailApp.sendEmail({ to: to, cc: o.test ? '' : cc.join(','), subject: subject, htmlBody: html, name: 'Ricky Rampersad Branch' });
  } catch (e) { return { ok: false, error: 'The report did not go: ' + String(e && e.message ? e.message : e).slice(0, 160) }; }
  if (!o.test) props.setProperty(GBL_DAY.REPORT_PROP, today);
  return { ok: true, rows: rows, ready: ready.length, left: left.length, cc: cc, subject: subject,
    said: 'The billing report went to ' + to + (o.test ? ' (TEST)' : cc.length ? ', copied to ' + cc.join(', ') : '') + ': ' + ready.length + ' of ' + rows.length + ' groups ready for ' + dayWords + '.' };
}
/** The editor's Run buttons: the report now, marked TEST and to the branch manager alone; or now for real. */
function gblBillReportTest() { var r = gblBillReport_({ test: true }); return tSay_(r.said || r.error || ''); }
function gblBillReportNow() { var r = gblBillReport_({}); return tSay_(r.said || r.error || ''); }
/** The name it had for a day, when it went on the Monday before a Tuesday: a GroupClients.gs pasted before this one calls it. */
function gblMondayReport_(o) { return gblBillReport_(o); }

function gblBoard_(L) {
  var out = {}, month = L.today.slice(0, 7), prevM = gblAddMonths_(month, -1);
  var rows = gblRows_(GBL.BILLS);
  L.reg.forEach(function (g) {
    var mine = rows.filter(function (r) { return gcmCodeKey_(r.Group) === g.key; }).map(gblBillOf_);
    var cur = mine.filter(function (b) { return b.month === month; }), m = cur.length ? month : prevM;
    var set = mine.filter(function (b) { return b.month === m; });
    out[g.key] = { month: m, lines: set.length, fixes: set.reduce(function (s, b) { return s + gblSteps_(b).fixes; }, 0), checks: set.reduce(function (s, b) { return s + gblSteps_(b).checks; }, 0),
      reconciled: set.filter(function (b) { return b.reconciledAt; }).length, approved: set.filter(function (b) { return b.status === 'approved'; }).length, held: set.filter(function (b) { return /^held/i.test(b.status); }).length,
      sent: set.filter(function (b) { return b.sentAt; }).length, due: gblR_(set.reduce(function (s, b) { return s + b.due; }, 0)) };
  });
  return out;
}

/* ── the Billings door (25 October 2026): the AI asks, last month's tasks are updated, the people, the statement ── */
/* "the objective is to upload the November 2026 group health, life and pension billing and the claims experience, also
 * build in intelligence from AI to ask the questions and run the analysis … produce Guardian Life billings as well, read
 * the old invoices that are owed. Tasks opened for last month in October billing: an analysis, deep insight, history …
 * to post on Chatter for an update, as well any terminations … make it much more simple and interactive, a site that will
 * pop and not confuse the weekly query and task update", then "the analysis for all persons re dependants and persons
 * coming of age to convert". The door is groupclientmanagement/billing.html (billing-door.js); these are its routes.
 * Nothing here carries a member's name to the AI: the facts go as counts and kinds, the names stay on the page. */
var GBL_ASK = { MAX: 16, AI_MAX: 4, CACHE_S: 21600 };
var GBL_UPD = { CACHE_S: 21600, MAX: 14, POSTS: 3 };
var GBL_PEOPLE = { AHEAD: 183, AFTER: 60, DEP_TIER: /FAMILY|SPOUSE|CHILD|DEPEND|\+\s*(ONE|1|2|3|FAM|SP|CH)/i, SINGLE_TIER: /EMPLOYEE\s*ONLY|^SINGLE$|^EMPLOYEE$|^EE$/i };

/* ── the questions ── */
/** The answers kept on a bill row (the Answers column, by question id). */
function gblAnswers_(bills) {
  var out = {};
  bills.forEach(function (b) { Object.keys(b.answers || {}).forEach(function (k) { out[k] = b.answers[k]; }); });
  return out;
}
/** One question from one finding: what only a person can settle, with the answers as taps. Each option says what the
 *  backend does with it (resolve the finding, post to Chatter) and what the page opens next (a task, a form, the payment
 *  box, the one-tap fix). A finding whose kind is for the record only asks nothing. */
function gblQuestionOf_(g, line, f, month) {
  if (!f || f.level === 'ok') return null;
  var lab = GBL.LABEL[line] || 'Billing', ml = gblMonthLabel_(month), M = f.members || [], n = M.length, names = M.slice(0, 6).map(function (m) { return gblNice_(m.name); }).join(', ') + (n > 6 ? ' and ' + (n - 6) + ' more' : '');
  var mem = f.member || (n === 1 ? M[0].name : ''), d = f.data || {}, money = gcmMoney_;
  var O = function (v, label, o) { var x = { v: v, label: label }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
  var task = function (kind, extra) { var t = { kind: 'task', task: kind, line: line, member: mem }; if (extra) Object.keys(extra).forEach(function (k) { t[k] = extra[k]; }); return t; };
  var unsure = O('unsure', 'Not sure yet', { post: 'still being checked' });
  var q = { id: f.id, line: line, label: lab, kind: f.kind, level: f.level, who: f.who, finding: f.text, member: mem, members: M.map(function (m) { return { id: m.id, name: m.name, premium: m.premium }; }), text: '', why: f.text, options: [] };
  switch (f.kind) {
    case 'read': q.text = 'The reader warned about this file. Is the ' + lab.toLowerCase() + ' bill still right to use?'; q.options = [O('yes', 'Yes, use it as read', { resolve: true }), O('no', 'No: upload it again', { next: { kind: 'reup', line: line } }), unsure]; break;
    case 'norecord': q.text = 'There is no ' + GBL.RT[line] + ' billing record for ' + ml + ' in Salesforce. Who creates it?'; q.options = [O('done', 'I have created it', { resolve: true, post: 'the billing record is now in Salesforce' }), O('task', 'Open a task for someone to create it', { next: task('amount') }), unsure]; break;
    case 'amount': q.text = 'Salesforce and the bill disagree on the ' + ml + ' amount. Which is right?'; q.options = [O('bill', 'The bill: set Salesforce to it', { next: { kind: 'fix', fix: 'sfAmount', line: line } }), O('sf', 'Salesforce: query the bill with Head Office', { next: task('amount'), post: 'the bill is queried with Head Office' }), unsure]; break;
    case 'arrears':
      if (f.who === 'headoffice') { q.text = 'The bill still shows ' + gblMonthLabel_(f.month || '') + ' as unpaid, but Salesforce has it paid. Has Group Health premium accounting applied the payment?'; q.options = [O('yes', 'Yes, applied: the group need not pay it again', { resolve: true, post: 'Head Office confirms the payment is applied; the arrears line is not owed' }), O('no', 'No: chase Head Office', { next: task('payment', { month: f.month, amount: d.amount }) }), unsure]; }
      else if (f.who === 'salesforce') { q.text = 'The bill shows ' + gblMonthLabel_(f.month || '') + ' unpaid and Salesforce has no record for that month at all. Create it?'; q.options = [O('done', 'I have created it', { resolve: true, post: 'the missing month\'s record is now in Salesforce' }), O('task', 'Open a task for it', { next: task('amount', { month: f.month }) }), unsure]; }
      else if (f.level === 'fix') { q.text = gblMonthLabel_(f.month || '') + ' is shown unpaid (' + money(d.amount || 0) + ') and no payment is keyed. Has the group paid it?'; q.options = [O('paid', 'Yes: record the payment', { next: { kind: 'pay', line: line, month: f.month, amount: d.amount } }), O('no', 'No: ask the group for it', { next: task('group', { month: f.month, amount: d.amount }), post: 'the group is asked for ' + gblMonthLabel_(f.month || '') }), unsure]; }
      else { q.text = 'Part of ' + gblMonthLabel_(f.month || '') + ' is still outstanding on the bill. Is the rest in hand?'; q.options = [O('yes', 'Yes: a payment is on its way', { resolve: true, post: 'the balance of ' + gblMonthLabel_(f.month || '') + ' is on its way' }), O('no', 'No: ask the group', { next: task('group', { month: f.month }) }), unsure]; }
      break;
    case 'unpaid': q.text = 'Several recent months have no payment keyed in Salesforce. Is the group behind, or are the payments not being keyed?'; q.options = [O('behind', 'The group is behind: chase it', { next: task('group') }), O('notkeyed', 'Payments were made and never keyed: key them', { next: { kind: 'pay', line: line } }), unsure]; break;
    case 'status': q.text = gblNice_(mem) + ' is on the bill, and Salesforce shows the policy as ended. Which is right?'; q.options = [O('covered', 'Still covered: put the record right', { next: task('other'), post: 'the policy record is to be reinstated' }), O('left', 'Left: query the charge with Head Office', { next: task('backcharge') }), unsure]; break;
    case 'notInSf': q.text = n + ' on the bill ' + (n === 1 ? 'has' : 'have') + ' no record in Salesforce (' + names + '). ' + (n === 1 ? 'A new joiner?' : 'New joiners?'); q.options = [O('joiners', 'Yes: add the records', { next: task('joiner') }), O('wrong', 'No: they should not be billed', { next: task('backcharge'), post: 'the charge is queried with Head Office' }), unsure]; break;
    case 'inSfOnly': q.text = n + ' live in Salesforce ' + (n === 1 ? 'is' : 'are') + ' not on the bill (' + names + '). Did they leave?'; q.options = [O('left', 'Yes, left: send the termination forms', { next: { kind: 'leavers', line: line, members: M.map(function (m) { return m.name; }) } }), O('dropped', 'No: Head Office dropped them', { next: task('other'), post: 'Head Office is asked why the members are off the bill' }), unsure]; break;
    case 'tier': q.text = 'The premium differs from Salesforce for ' + n + ' member' + (n === 1 ? '' : 's') + '. A tier change?'; q.options = [O('tier', 'Yes: record the tier change', { next: task('tier') }), O('rate', 'No: a rate error, query Head Office', { next: task('rate') }), unsure]; break;
    case 'nomembers': q.text = 'Salesforce holds no ' + GBL.POL[line] + ' member records for this group, so the bill cannot be checked member by member. Add them?'; q.options = [O('task', 'Open a task to add the records', { next: task('joiner') }), O('ok', 'Not needed for this group', { resolve: true }), unsure]; break;
    case 'credit': q.text = gblNice_(mem) + ' has a back-dated change on the bill with no task recording it. Did the group ask for it?'; q.options = [O('yes', 'Yes: open the task that records it', { next: task(d.kind === 'leaver' ? 'leaver' : 'joiner', { month: d.month, amount: d.amount }) }), O('no', 'No: query it with Head Office', { next: task('backcharge', { month: d.month, amount: d.amount }) }), unsure]; break;
    case 'jump': q.text = 'The bill has moved sharply against last month. A renewal rate?'; q.options = [O('renewal', 'Yes, a renewal: the new rate stands', { resolve: true, post: 'the step in the bill is the renewal rate' }), O('error', 'No: query Head Office', { next: task('rate') }), unsure]; break;
    case 'rate': q.text = 'A member is charged off the rate on the life bill. Query it?'; q.options = [O('query', 'Query Head Office', { next: task('rate') }), O('ok', 'It is right as charged', { resolve: true }), unsure]; break;
    case 'adj': if (!/after the effective date/.test(f.text)) return null; q.text = 'A life change was reported after the 31-day window. Was evidence of insurability asked for?'; q.options = [O('yes', 'Yes', { resolve: true, post: 'evidence of insurability was requested' }), O('no', 'No: ask the group for it', { next: task('group') }), unsure]; break;
    case 'hvl': q.text = n + ' on the health bill ' + (n === 1 ? 'is' : 'are') + ' not on the life bill. Not yet added to life, or health only?'; q.options = [O('add', 'Add them to life', { next: task('joiner', { line: 'life' }) }), O('healthonly', 'Health only: nothing to do', { resolve: true }), unsure]; break;
    case 'left': q.text = n + ' came off the bill since last month (' + names + '). Does each have a termination on file?'; q.options = [O('yes', 'Yes, all done', { resolve: true }), O('forms', 'Send the termination forms', { next: { kind: 'leavers', line: line, members: M.map(function (m) { return m.name; }) } }), unsure]; break;
    case 'notTagged': q.text = n + ' polic' + (n === 1 ? 'y' : 'ies') + ' on the list ' + (n === 1 ? 'does' : 'do') + ' not carry the list bill in Salesforce. Tag them?'; q.options = [O('done', 'Done', { resolve: true, post: 'the policies now carry the list bill' }), O('task', 'Open a task for it', { next: task('other') }), unsure]; break;
    case 'extra': q.text = n + ' polic' + (n === 1 ? 'y' : 'ies') + ' carr' + (n === 1 ? 'ies' : 'y') + ' the list bill in Salesforce but ' + (n === 1 ? 'is' : 'are') + ' not on the list. Left the group?'; q.options = [O('left', 'Yes: take the list bill off', { next: task('leaver') }), O('bill', 'No: they should be billed', { next: task('other'), post: 'the list is to be corrected to include them' }), unsure]; break;
    case 'premDiff': q.text = 'Premiums differ between the list and Salesforce for ' + n + '. Which is right?'; q.options = [O('list', 'The list: correct Salesforce', { next: task('other') }), O('sf', 'Salesforce: correct the list', { resolve: true, post: 'the list is to be corrected to Salesforce\'s premiums' }), unsure]; break;
    case 'paidTo': q.text = 'Paid-to dates are behind on ' + n + ' list bill polic' + (n === 1 ? 'y' : 'ies') + '. Is the allocation behind, or are the dates not maintained?'; q.options = [O('behind', 'The allocation is behind: trace the payments', { next: task('payment') }), O('dates', 'The dates are not maintained: fix them', { next: task('other') }), unsure]; break;
    default: return null;
  }
  return q.text ? q : null;
}
/** The month's questions: one from each open finding a person must settle, then up to GBL_ASK.AI_MAX from the AI on what
 *  the rules did not ask (counts and kinds only), answered ones marked. */
function gblQuestions_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(p.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  var month = String(p.month || ''), bills = gblBillRows_(g).filter(function (x) { return x.month === month; });
  if (!bills.length) return { ok: true, month: month, questions: [], answered: 0, total: 0, said: 'Upload a bill for ' + gblMonthLabel_(month) + ' first: the questions come from what the checks find.' };
  var answers = gblAnswers_(bills), qs = [];
  bills.forEach(function (b) {
    b.findings.forEach(function (f) { if (b.resolved[f.id]) return; var q = gblQuestionOf_(g, b.line, f, month); if (q) qs.push(q); });
  });
  var aiError = '';
  if (gcmAiKey_() && !gcmYes_(p.noai)) { try { qs = qs.concat(gblAiQuestions_(g, month, bills, qs)); } catch (e) { aiError = String(e && e.message ? e.message : e).slice(0, 160); } }
  qs.forEach(function (q) { if (answers[q.id]) q.answered = answers[q.id]; });
  var order = { fix: 0, check: 1, note: 2, ai: 3 };
  qs.sort(function (a, b) { return ((a.answered ? 1 : 0) - (b.answered ? 1 : 0)) || ((order[a.level] || 2) - (order[b.level] || 2)); });
  qs = qs.slice(0, GBL_ASK.MAX);
  var done = qs.filter(function (q) { return q.answered; }).length;
  return { ok: true, month: month, monthLabel: gblMonthLabel_(month), questions: qs, answered: done, total: qs.length, ai: !!gcmAiKey_(), aiError: aiError,
    said: !qs.length ? 'Nothing to ask for ' + gblMonthLabel_(month) + ': the bills check out, or every question is settled.' : done === qs.length ? 'Every question for ' + gblMonthLabel_(month) + ' is answered.' : (qs.length - done) + ' question' + (qs.length - done === 1 ? '' : 's') + ' to answer for ' + gblMonthLabel_(month) + '.' };
}
/** The facts the AI reads: amounts, counts, finding kinds, task ages, the claims note. Never a member's name. */
function gblAiFacts_(g, month, bills, sf, L) {
  var facts = [];
  bills.forEach(function (b) {
    var sm = gblSfMonth_(sf, b.line, b.month);
    facts.push(GBL.LABEL[b.line] + ' ' + gblMonthLabel_(b.month) + ': bill ' + gcmMoney_(b.due) + ' for ' + b.members + ' ' + (b.line === 'listbill' ? 'policies' : 'members') + (b.arrears ? ', earlier months shown unpaid ' + gcmMoney_(b.arrears) : '') +
      '; Salesforce ' + (sm.rec ? gcmMoney_(sm.rec.billed) + (sm.rec.paid ? ', paid ' + gcmMoney_(sm.rec.paid) : ', nothing paid yet') : 'has no record') + '.');
    b.findings.filter(function (f) { return !b.resolved[f.id] && f.level !== 'ok'; }).slice(0, GBL.AI_MAX_FINDINGS).forEach(function (f) { facts.push('[' + f.level + ', ' + f.who + ', ' + f.kind + '] ' + (f.aiText || '').replace(/[A-Z][a-z]+ [A-Z][a-z\-]+/g, 'a member')); });
    var hist = sf.trans.filter(function (t) { return t.line === b.line; }).slice(0, 6).map(function (t) { return gblMonthLabel_(t.month).slice(0, 3) + ' ' + gcmMoney_(t.billed) + (t.paid ? ' paid' : ' unpaid'); });
    if (hist.length) facts.push(GBL.LABEL[b.line] + ' last months: ' + hist.join(', ') + '.');
  });
  g.tasks.filter(function (t) { return t.open && gblIsBillingTask_(t); }).forEach(function (t) { facts.push('Open billing task, ' + gcmDays_(t.opened, L.today) + ' days, ' + t.status + (t.due && t.due < L.today ? ', past target' : '') + ': ' + gcmTitle_(t.subject, g.name).replace(/[A-Z][a-z]+ [A-Z][a-z\-]+/g, 'a member') + '.'); });
  var ex = gblExperience_(g, sf, true);
  if (ex && ex.note) facts.push('Claims: ' + ex.note);
  return facts;
}
function gblAiKey_(prefix, g, month, facts) {
  return prefix + g.key.slice(0, 30) + '-' + month + '-' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, facts.join('|'), Utilities.Charset.UTF_8)).slice(0, 16).replace(/[^A-Za-z0-9]/g, '');
}
function gblAiJson_(text) {
  try { return JSON.parse(text); } catch (e) {}
  try { return JSON.parse(text.replace(/^[^{\[]*/, '').replace(/[^}\]]*$/, '')); } catch (e2) {}
  return null;
}
/** Up to GBL_ASK.AI_MAX questions the rules did not ask. The AI reads counts and kinds, never a name; its questions are
 *  kept six hours for the same facts, and an answer to one is recorded and posted like any other. */
function gblAiQuestions_(g, month, bills, ruleQs) {
  var L = gcmLoad_(), sf = gblSf_(g), facts = gblAiFacts_(g, month, bills, sf, L);
  facts.push('Already asked by the rules: ' + (ruleQs.map(function (q) { return q.kind; }).join(', ') || 'nothing') + '.');
  var key = gblAiKey_('gbl-ask-', g, month, facts), cache = CacheService.getScriptCache();
  try { var c = cache.get(key); if (c) return JSON.parse(c); } catch (e) {}
  var system = 'You help a Trinidad insurance branch reconcile a group client\'s monthly bills (group health, group life, a pension list bill) against its Salesforce records before the bills go to the employer. ' +
    'From the facts, write the questions only a person at the branch can answer and that the rule checks listed as already asked have not covered: at most ' + GBL_ASK.AI_MAX + ', each short and specific, each with two or three answers as taps (plain labels, no punctuation at the end). ' +
    'Answer as JSON: {"questions":[{"text":"…","why":"one sentence on what the answer settles","options":["…","…","Not sure yet"]}]}. Never invent a figure, a name or a date. Staff are not licensed advisers: never ask them to advise the group on cover. If nothing is worth asking, answer {"questions":[]}.';
  var text = gcmClaude_(system, 'Group: a client of the branch (name withheld). Month: ' + gblMonthLabel_(month) + '.\n\n' + facts.join('\n'));
  var j = gblAiJson_(text), out = [];
  ((j && j.questions) || []).slice(0, GBL_ASK.AI_MAX).forEach(function (q, i) {
    var opts = (q.options || []).map(String).filter(String).slice(0, 4);
    if (!q.text || opts.length < 2) return;
    out.push({ id: 'a' + (i + 1), line: '', label: 'The AI asks', kind: 'ai', level: 'ai', who: 'us', finding: '', member: '', members: [], text: String(q.text).slice(0, 300), why: String(q.why || '').slice(0, 300),
      options: opts.map(function (o, k) { return { v: 'o' + (k + 1), label: o.slice(0, 80), post: /not sure/i.test(o) ? 'still being checked' : '' }; }) });
  });
  try { cache.put(key, JSON.stringify(out), GBL_ASK.CACHE_S); } catch (e2) {}
  return out;
}
/** An answer: kept on the bill row, filed on Group Changes, posted on the line's billing task, the finding resolved when the
 *  answer settles it. What the page opens next (a task, a form, the payment box) comes back as `next`. */
function gblAnswer_(g, who, b, L) {
  var month = String(b.month || ''), qid = String(b.q || '').trim(), v = String(b.v || '').trim(), note = String(b.note || '').trim().slice(0, 600);
  var bills = gblBillRows_(g).filter(function (x) { return x.month === month; });
  if (!bills.length) return { ok: false, error: 'No bill is stored for that month.' };
  if (!qid || !v) return { ok: false, error: 'Which question, and which answer?' };
  var q = null, bill = null;
  if (/^a\d+$/.test(qid)) {
    /* the AI's question travels back with its answer: the page sends the words it showed, so no second AI call is made */
    bill = bills[0]; q = { id: qid, line: '', kind: 'ai', member: '', text: String(b.text || 'A question from the AI').slice(0, 300), options: [{ v: v, label: String(b.label || v).slice(0, 80), post: /unsure|not sure/i.test(String(b.label || v)) ? 'still being checked' : '' }] };
  } else {
    bills.forEach(function (x) { if (q) return; var f = x.findings.filter(function (y) { return y.id === qid; })[0]; if (f) { q = gblQuestionOf_(g, x.line, f, month); bill = x; } });
  }
  if (!q || !bill) return { ok: false, error: 'That question is no longer open: the finding it came from is resolved or gone.' };
  var opt = q.options.filter(function (o) { return o.v === v; })[0];
  if (!opt) return { ok: false, error: 'That answer is not one of the question\'s options.' };
  var at = gcmWhen_(new Date()), rec = { v: v, label: opt.label, by: who.name, at: at, note: note };
  bill.answers = bill.answers || {}; bill.answers[q.id] = rec;
  var patch = { Answers: JSON.stringify(bill.answers).slice(0, 49000) }, resolved = false;
  if (opt.resolve && !/^a\d+$/.test(q.id)) {
    var f2 = bill.findings.filter(function (y) { return y.id === q.id; })[0];
    if (f2) { bill.resolved[f2.id] = { by: who.name, at: at, note: 'Answered: ' + opt.label + (note ? '. ' + note : '') }; patch.Resolved = JSON.stringify(bill.resolved).slice(0, 49000); patch.Status = gblSteps_(bill).open ? bill.status : 'checked'; resolved = true; }
  }
  gblBillPatch_(bill, patch);
  gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: q.line || bill.line, Kind: 'answer', Member: q.member || '', Detail: q.text + ' → ' + opt.label + (note ? '. ' + note : ''), Effective: month + '-01', Amount: 0, Source: 'staff', By: who.name, Status: 'done', 'SF Task': '', 'SF Id': '', Note: q.id }]);
  var posted = gblPostBilling_(g, q.line || bill.line, month, 'Billing question for ' + gblMonthLabel_(month) + ', answered by ' + who.name + ': "' + q.text + '" → ' + opt.label + (opt.post ? ' (' + opt.post + ')' : '') + (note ? '. ' + note : ''), who);
  var left = gblQuestions_({ code: b.code, who: b.who, group: b.group, month: month, noai: 'Y' });
  return { ok: true, answered: rec, resolved: resolved, posted: posted, next: opt.next || null, steps: gblSteps_(bill), left: left.ok ? left.total - left.answered : null,
    said: 'Answered' + (resolved ? ', and the finding is resolved' : '') + (posted ? '; noted on the billing task' : '') + '.' };
}

/* ── last month's tasks, read against this month's bill ── */
function gblMonthInSubject_(s) {
  var m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(s || '');
  if (m) return m[3] + '-' + String(m[1]).padStart(2, '0');
  var names = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  var m2 = new RegExp('\\b(' + names.join('|') + ')\\b(?:\\s+(\\d{4}))?', 'i').exec(s || '');
  if (m2) { var y = m2[2] || gcmToday_().slice(0, 4); return y + '-' + String(names.indexOf(m2[1].toLowerCase()) + 1).padStart(2, '0'); }
  return '';
}
/** The open billing tasks, each with what this month's bills and Salesforce say about it, a verdict (cleared, open, worse)
 *  and an update ready to post: the AI writes it from the task's history and the evidence (no names reach it), the rules
 *  write it when the AI is off. Kept six hours for the same facts. */
function gblTaskUpdates_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(p.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  var month = String(p.month || ''), ml = gblMonthLabel_(month), today = L.today, sf = gblSf_(g);
  var bills = gblBillRows_(g).filter(function (x) { return x.month === month; }), prevM = gblAddMonths_(month, -1);
  var tasks = g.tasks.filter(function (t) { return t.open && gblIsBillingTask_(t); }).sort(function (a, b) { return (a.opened < b.opened ? -1 : 1); }).slice(0, GBL_UPD.MAX);
  var feed = gcmFeed_(tasks.map(function (t) { return t.id; }));
  var lines = {};
  bills.forEach(function (b) { lines[b.line] = { bill: b, members: gblLines_(g, b.line, month), prev: gblLines_(g, b.line, prevM) }; });
  var out = tasks.map(function (t) {
    var subj = String(t.subject || ''), line = gblLineOfRt_(subj), ev = [], verdict = 'open', kind = 'other';
    var tm = gblMonthInSubject_(subj), money = gcmMoney_;
    if (/terminat|cancel|remov|left|leaver|resign/i.test(subj)) kind = 'leaver'; else if (/enrol|add|join|new member/i.test(subj)) kind = 'joiner'; else if (/payment|arrear|outstanding|unpaid|owed|receipt|received/i.test(subj)) kind = 'payment';
    else if (/renewal|rate/i.test(subj)) kind = 'renewal'; else if (/bill|billing|variance|reconcil/i.test(subj)) kind = 'bill';
    var L2 = line ? lines[line] : null, on = [], off = [], cr = [];
    Object.keys(lines).forEach(function (ln) {
      var x = lines[ln];
      x.members.filter(function (m) { return m.kind === 'member' && gblSamePerson_(subj, m.name); }).forEach(function (m) { on.push({ line: ln, m: m }); });
      x.prev.filter(function (m) { return m.kind === 'member' && gblSamePerson_(subj, m.name) && !x.members.some(function (c) { return c.kind === 'member' && gblSamePerson_(c.name, m.name); }); }).forEach(function (m) { off.push({ line: ln, m: m }); });
      x.members.filter(function (m) { return m.kind !== 'member' && gblSamePerson_(subj, m.name); }).forEach(function (m) { cr.push({ line: ln, m: m }); });
    });
    on.forEach(function (x) { ev.push('On the ' + ml + ' ' + GBL.LABEL[x.line].toLowerCase() + ' bill as ' + (x.m.tier || 'a member') + ', ' + money(x.m.premium) + (x.m.start ? ', from ' + tDmy_(x.m.start) : '') + '.'); });
    off.forEach(function (x) { ev.push('Off the ' + ml + ' ' + GBL.LABEL[x.line].toLowerCase() + ' bill (was on the ' + gblMonthLabel_(prevM) + ' bill).'); });
    cr.forEach(function (x) { ev.push((x.m.kind === 'cancel' ? 'A credit' : 'A back-charge') + ' on the ' + ml + ' ' + GBL.LABEL[x.line].toLowerCase() + ' bill for ' + gblMonthLabel_(x.m.forMonth || '') + ': ' + money(x.m.premium) + '.'); });
    if (L2) { var b = L2.bill; ev.push('The ' + ml + ' ' + GBL.LABEL[line].toLowerCase() + ' bill: ' + money(b.due) + ' for ' + b.members + ' ' + (line === 'listbill' ? 'policies' : 'members') + (b.arrears ? ', ' + money(b.arrears) + ' of earlier months shown unpaid' : '') + (b.reconciledAt ? ', reconciled ' + b.reconciledAt : '') + (b.sentAt ? ', sent ' + b.sentAt : '') + '.'); }
    if (tm) { var sm = gblSfMonth_(sf, line || 'health', tm); if (sm.rec) ev.push('Salesforce for ' + gblMonthLabel_(tm) + ': billed ' + money(sm.rec.billed) + ', ' + (sm.rec.paid ? 'paid ' + money(sm.rec.paid) + (sm.pays.length ? ' on ' + tDmy_(sm.pays[0].paidOn) : '') : 'nothing paid yet') + (sm.rec.reconciled ? ', reconciled' : '') + '.'); }
    var am = /\$\s?([\d,]+\.\d{2})/.exec(subj);
    if (am) { var amt = Number(am[1].replace(/,/g, '')), pay = sf.pays.filter(function (q) { return Math.abs(q.amount - amt) < 0.05; })[0]; if (pay) ev.push('A payment of ' + money(amt) + ' is keyed in Salesforce, dated ' + tDmy_(pay.paidOn) + (pay.method ? ' by ' + pay.method : '') + '.'); }
    if (kind === 'leaver') verdict = off.length || (!on.length && Object.keys(lines).length) ? 'cleared' : 'open';
    else if (kind === 'joiner') verdict = on.length ? 'cleared' : 'open';
    else if (kind === 'payment') { var smp = tm ? gblSfMonth_(sf, line || 'health', tm) : { rec: null, pays: [] }; verdict = smp.rec && smp.rec.paid >= smp.rec.billed - 0.05 && smp.rec.billed ? 'cleared' : (L2 && L2.bill.arrears > 0 ? 'worse' : 'open'); }
    else if (kind === 'bill' && L2 && L2.bill.sentAt) verdict = 'cleared';
    else if (kind === 'renewal' && L2) verdict = L2.bill.findings.some(function (f) { return f.kind === 'jump' && !L2.bill.resolved[f.id]; }) ? 'open' : 'open';
    if (!ev.length) ev.push('Nothing on the ' + ml + ' bills names this task: it stands as it was.');
    var posts = (feed[t.id15] || []).slice(0, GBL_UPD.POSTS);
    return { id: t.id, id15: t.id15, title: gcmTitle_(t.subject, g.name), subject: t.subject, owner: t.owner, opened: t.opened, age: gcmDays_(t.opened, today), due: t.due, late: !!(t.due && t.due < today), status: t.status, open: true, line: line, kind: kind,
      posts: posts, lastPost: posts[0] || null, evidence: ev, verdict: verdict, canClose: verdict === 'cleared', shown: gcmShown_(g, t), update: '' };
  });
  var aiError = '';
  if (out.length && gcmAiKey_() && !gcmYes_(p.noai)) { try { gblTaskUpdatesAi_(g, month, out); } catch (e) { aiError = String(e && e.message ? e.message : e).slice(0, 160); } }
  out.forEach(function (u) {
    if (!u.update) u.update = 'Update from the ' + ml + ' billing review: ' + u.evidence.join(' ') + (u.verdict === 'cleared' ? ' This looks settled: closing unless anyone objects.' : u.verdict === 'worse' ? ' The position has got worse since the task was opened: chasing it this week.' : ' Still open; next step to follow.');
  });
  return { ok: true, month: month, monthLabel: ml, tasks: out, ai: !!gcmAiKey_(), aiError: aiError, feedError: feed._error || '',
    said: !out.length ? 'No open billing task on this group.' : out.length + ' open billing task' + (out.length === 1 ? '' : 's') + ': ' + out.filter(function (u) { return u.verdict === 'cleared'; }).length + ' look' + (out.filter(function (u) { return u.verdict === 'cleared'; }).length === 1 ? 's' : '') + ' settled by the ' + ml + ' bills.' };
}
/** One AI call for every task: the subject with names taken out, the last posts, the evidence; back comes the update in the
 *  staff member's voice and a verdict. Kept six hours for the same facts. */
function gblTaskUpdatesAi_(g, month, list) {
  var scrub = function (s) { return String(s || '').replace(new RegExp(g.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'the group').replace(/[A-Z][a-z]+,?\s[A-Z][a-z\-]+/g, 'a member').replace(/\b[A-Z]{3,},\s*[A-Z]{3,}\b/g, 'a member'); };
  var facts = list.map(function (u, i) { return '[' + (i + 1) + '] ' + scrub(u.title) + ' · opened ' + u.age + ' days ago, ' + u.status + (u.late ? ', past target' : '') + '. Last posts: ' + (u.posts.length ? u.posts.map(function (p) { return scrub(p.text).slice(0, 200); }).join(' | ') : 'none') + '. This month: ' + u.evidence.map(scrub).join(' ') + ' Rule verdict: ' + u.verdict + '.'; });
  var key = gblAiKey_('gbl-upd-', g, month, facts), cache = CacheService.getScriptCache(), j = null;
  try { var c = cache.get(key); if (c) j = JSON.parse(c); } catch (e) {}
  if (!j) {
    var system = 'You write Chatter updates for a Trinidad insurance branch\'s open billing tasks on a group client, from what this month\'s bills and Salesforce show. For each numbered task answer with {"n":<number>,"update":"two or three plain sentences in the first person plural (we), saying what the new bill shows about it and the next step","verdict":"cleared|open|worse"}. ' +
      'cleared means the bill proves the task\'s work is done; worse means the position deteriorated. Never invent a figure, a name or a date; refer to people as "the member". Answer as JSON: {"updates":[…]}.';
    var text = gcmClaude_(system, 'Month: ' + gblMonthLabel_(month) + '.\n\n' + facts.join('\n'));
    j = gblAiJson_(text) || {};
    try { cache.put(key, JSON.stringify(j), GBL_UPD.CACHE_S); } catch (e2) {}
  }
  ((j && j.updates) || []).forEach(function (u) {
    var i = Number(u.n) - 1; if (!(i >= 0 && i < list.length)) return;
    if (u.update) list[i].update = String(u.update).slice(0, 1500);
    if (/^(cleared|open|worse)$/.test(String(u.verdict || ''))) { list[i].verdict = u.verdict; list[i].canClose = u.verdict === 'cleared'; }
    list[i].byAi = true;
  });
}
/** Post an update on a task (the owner mentioned and e-mailed) and, when asked, close it in Salesforce. */
function gblTaskUpdate_(g, who, b) {
  var text = String(b.text || '').trim().slice(0, 2000);
  if (!text) return { ok: false, error: 'Write the update first.' };
  var t = g.tasks.filter(function (x) { return x.id15 === gcmId15_(b.task); })[0];
  if (!t) return { ok: false, error: 'That task is not on this group.' };
  var r = gblNoteTask_(g, who, { code: b.code, who: b.who, group: b.group, task: b.task, text: text, notify: b.notify, forGroup: '' });
  if (!r.ok) return r;
  var closed = false, closeNote = '';
  if (gcmYes_(b.close)) {
    if (!tSfOn_()) closeNote = 'Salesforce is not linked, so the task was not closed.';
    else { try { tSfSend_('patch', '/sobjects/Task/' + t.id, { Status: 'Completed' }); closed = true; } catch (e) { closeNote = 'Salesforce would not close it: ' + String(e && e.message ? e.message : e).slice(0, 140); } }
    if (closed) { try { t.open = false; t.status = 'Completed'; } catch (e2) {} }
  }
  /* every update is on the register, closed or not, so the door can show which of last month's tasks this month has dealt with */
  gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: gblLineOfRt_(t.subject) || '', Kind: closed ? 'taskclosed' : 'taskupdate', Member: '', Detail: gcmTitle_(t.subject, g.name) + (closed ? ' closed after the billing review' : ': update posted after the billing review') + ': ' + text.slice(0, 400), Effective: String(b.month || '') ? String(b.month) + '-01' : '', Amount: 0, Source: 'staff', By: who.name, Status: closed ? 'done' : 'open', 'SF Task': t.id, 'SF Id': '', Note: closeNote }]);
  return { ok: true, closed: closed, said: r.said + (closed ? ' The task is closed.' : closeNote ? ' ' + closeNote : '') };
}

/* ── the people: everyone on the bills, their dependants, who is coming of age and who is turning 65 ── */
/** Every member on the month's health and life bills matched to their Salesforce record (date of birth, dependants from the
 *  Relationship Group), with what the dates say: turning 65 (convert to an individual plan), a dependant reaching the
 *  dependant age, a family tier with nobody on record, no date of birth. The pension list and what the records hold for
 *  members not on these bills come from the Group Milestones tab. Counts only go to the group's page. */
function gblPeopleStep_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(p.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  var month = String(p.month || ''), today = L.today, mem = gblMembers_(g, gcmYes_(p.fresh)), depAge = gcmLifeNum_('GCM_DEP_AGE', GCM_LIFE.DEP_AGE);
  var people = [], byKey = {};
  var find = function (name) { return people.filter(function (x) { return gblSamePerson_(x.name, name); })[0]; };
  var sfOf = function (line, l) {
    var k = line === 'health' ? gblMemberKey_(l.id) : gblCertKey_(l.id), hit = null;
    if (k) hit = mem.members.filter(function (m) { return m.line === line && (line === 'health' ? gblMemberKey_(m.policy) : gblCertKey_(m.cert || m.policy)) === k; })[0];
    return hit || mem.members.filter(function (m) { return gblSamePerson_(m.name, l.name); })[0] || null;
  };
  ['health', 'life'].forEach(function (line) {
    gblLines_(g, line, month).filter(function (l) { return l.kind === 'member'; }).forEach(function (l) {
      var per = find(l.name), sfm = sfOf(line, l);
      if (!per) { per = { name: gblNice_(l.name), raw: l.name, ids: {}, lines: [], tier: '', premium: 0, sf: !!sfm, dob: '', age: null, gender: '', deps: [], flags: [] }; people.push(per); }
      per.lines.push(line); per.ids[line] = l.id; per.premium = gblR_(per.premium + (l.premium || 0));
      if (line === 'health') per.tier = l.tier || per.tier;
      if (sfm) { per.sf = true; per.dob = per.dob || sfm.dob || ''; per.gender = per.gender || sfm.gender || ''; if (sfm.deps && sfm.deps.length && !per.deps.length) per.deps = sfm.deps.map(function (x) { return { rel: x.rel, name: x.name, dob: x.dob, gender: x.gender }; }); per.email = per.email || sfm.emailPersonal || sfm.emailWork || ''; per.contactId = per.contactId || sfm.contactId || ''; }
    });
  });
  /* the records: the Group Milestones tab for this group, matched by name onto the people, the rest listed apart */
  var life = (g.life || []).filter(function (r) { return r.kind !== 'summary'; }), onRecord = [];
  life.forEach(function (r) {
    var per = find(r.person) || (r.member ? find(r.member) : null);
    var row = { kind: r.kind, person: r.person, member: r.member, line: r.line, date: r.date, inDays: r.date ? gcmDays_(today, r.date) : null, age: r.ageAt, ownership: r.ownership, task: r.task, assumed: r.assumed === 'Y' };
    if (per) { per.record = per.record || []; per.record.push(row); if (!per.dob && r.born) per.dob = r.born; } else onRecord.push(row);
  });
  var counts = { members: people.length, matched: 0, convert: 0, over65: 0, depAge: 0, depOver: 0, tierDeps: 0, tierSingle: 0, nodob: 0, nosf: 0, retire: 0, deps: 0 };
  people.forEach(function (per) {
    if (per.sf) counts.matched++; else { counts.nosf++; per.flags.push({ kind: 'nosf', level: 'data', text: 'No record in Salesforce for this member: see the findings on the bill.' }); }
    if (per.dob) {
      per.age = gcmAgeOn_(per.dob, today);
      var at65 = gcmAddYears_(per.dob, GCM_LIFE.CONVERT_AGE), d65 = gcmDays_(today, at65);
      if (d65 !== null && d65 <= GBL_PEOPLE.AHEAD && d65 >= -GBL_PEOPLE.AFTER) { counts.convert++; per.flags.push({ kind: 'convert', level: 'act', date: at65, text: (d65 >= 0 ? 'Turns ' : 'Turned ') + GCM_LIFE.CONVERT_AGE + ' on ' + tDmy_(at65) + ': group cover ends at ' + GCM_LIFE.CONVERT_AGE + '. Time to offer an individual plan.' }); }
      else if (d65 !== null && d65 < -GBL_PEOPLE.AFTER && per.lines.indexOf('health') >= 0) { counts.over65++; per.flags.push({ kind: 'over65', level: 'check', date: at65, text: 'Aged ' + per.age + ' and still on the group health bill: check eligibility with Head Office.' }); }
    } else if (per.sf) { counts.nodob++; per.flags.push({ kind: 'nodob', level: 'data', text: 'No date of birth on record: ask the group for it.' }); }
    per.deps.forEach(function (dp) {
      counts.deps++;
      if (!dp.dob) return;
      dp.age = gcmAgeOn_(dp.dob, today);
      var atD = gcmAddYears_(dp.dob, depAge), dd = gcmDays_(today, atD);
      if (/SPOUSE|WIFE|HUSBAND|PARTNER/i.test(dp.rel || '')) return;
      if (dd !== null && dd <= GBL_PEOPLE.AHEAD && dd >= -GBL_PEOPLE.AFTER) { counts.depAge++; dp.coming = atD; per.flags.push({ kind: 'depage', level: 'act', date: atD, dep: dp.name, text: dp.name + ' (' + String(dp.rel || 'dependant').toLowerCase() + ') ' + (dd >= 0 ? 'turns ' : 'turned ') + depAge + ' on ' + tDmy_(atD) + ': comes off the plan. Offer a plan of their own.' }); }
      else if (dd !== null && dd < -GBL_PEOPLE.AFTER) { counts.depOver++; per.flags.push({ kind: 'depover', level: 'check', date: atD, dep: dp.name, text: dp.name + ' is ' + dp.age + ', past the dependant age of ' + depAge + ', and still on record: check the plan.' }); }
    });
    if (per.tier && per.sf) {
      if (GBL_PEOPLE.DEP_TIER.test(per.tier) && !per.deps.length) { counts.tierDeps++; per.flags.push({ kind: 'tierdeps', level: 'check', text: 'Tier "' + per.tier + '" but no dependant on record in Salesforce: add them to the Relationship Group.' }); }
      else if (GBL_PEOPLE.SINGLE_TIER.test(per.tier) && per.deps.length) { counts.tierSingle++; per.flags.push({ kind: 'tiersingle', level: 'check', text: per.deps.length + ' dependant' + (per.deps.length === 1 ? '' : 's') + ' on record but the tier is "' + per.tier + '": check the tier with the group.' }); }
    }
    (per.record || []).forEach(function (r) { if (r.kind === 'retire') { counts.retire++; per.flags.push({ kind: 'retire', level: 'act', date: r.date, text: 'Retires ' + tDmy_(r.date) + ' at ' + r.age + ' on ' + (r.ownership === 'Company' ? 'the company' : 'a personal') + ' pension' + (r.assumed ? ' (age assumed: confirm it)' : '') + (r.task ? '; projection task open' : '; projection task to open') + '.' }); } });
    per.flags.sort(function (a, b) { return ({ act: 0, check: 1, data: 2 })[a.level] - ({ act: 0, check: 1, data: 2 })[b.level]; });
  });
  people.sort(function (a, b) { return (b.flags.filter(function (f) { return f.level === 'act'; }).length - a.flags.filter(function (f) { return f.level === 'act'; }).length) || (b.flags.length - a.flags.length) || (a.name < b.name ? -1 : 1); });
  var forGroup = { convert: counts.convert + onRecord.filter(function (r) { return r.kind === 'convert65'; }).length, depAge: counts.depAge + onRecord.filter(function (r) { return r.kind === 'dependent'; }).length, retire: counts.retire + onRecord.filter(function (r) { return r.kind === 'retire' && r.ownership === 'Company'; }).length, nodob: counts.nodob + onRecord.filter(function (r) { return r.kind === 'nodob'; }).length, depAgeAt: depAge, convertAge: GCM_LIFE.CONVERT_AGE };
  return { ok: true, month: month, monthLabel: gblMonthLabel_(month), salesforce: mem.ok, sfError: mem.error || '', depAge: depAge, convertAge: GCM_LIFE.CONVERT_AGE, people: people, onRecord: onRecord, counts: counts, forGroup: forGroup, live: gblLive_(),
    said: !people.length ? 'Upload the health or life bill first: the people come from the bill.' : people.length + ' on the bills, ' + counts.matched + ' matched to a record; ' + counts.convert + ' turning ' + GCM_LIFE.CONVERT_AGE + ', ' + counts.depAge + ' dependant' + (counts.depAge === 1 ? '' : 's') + ' coming of age, ' + (counts.tierDeps + counts.tierSingle) + ' tier' + (counts.tierDeps + counts.tierSingle === 1 ? '' : 's') + ' to check, ' + counts.nodob + ' with no date of birth.' };
}
/** A letter to a member about a conversion or a dependant coming of age: drafted here, previewed by staff, sent only on a
 *  press by someone who may act for the group, from support@, in test mode to the staff member until gblGoLive. */
function gblMemberLetter_(g, who, b, L) {
  var kind = String(b.kind || 'convert'), name = String(b.member || '').trim().slice(0, 120), dep = String(b.dep || '').trim().slice(0, 120), date = gcmYmd_(b.date || '') || '', email = String(b.email || '').trim().toLowerCase();
  if (!name) return { ok: false, error: 'Whose letter is it?' };
  var first = name.split(/[\s,]+/).filter(String), fn = /,/.test(name) ? (name.split(',')[1] || '').trim().split(/\s+/)[0] : first[0];
  fn = fn ? fn.charAt(0).toUpperCase() + fn.slice(1).toLowerCase() : 'there';
  var E = tEsc_, signer = gcmSigner_(who, g), age = GCM_LIFE.CONVERT_AGE, depAge = gcmLifeNum_('GCM_DEP_AGE', GCM_LIFE.DEP_AGE);
  var subject, paras;
  if (kind === 'depage') {
    subject = 'Keeping ' + (dep || 'your dependant') + ' covered beyond ' + depAge;
    paras = ['Your group health plan through ' + g.name + ' covers a dependant up to the age of ' + depAge + '. ' + (dep || 'Your dependant') + (date ? ' reaches that age on ' + tDmy_(date) : ' is reaching that age') + ', and the group cover for them ends then.',
      'Nothing has to lapse. Guardian Life of the Caribbean offers individual health plans a young adult can move onto without a break in cover, and our branch arranges it with you.',
      'Reply to this e-mail, or call us on (868) 226-6461, and a licensed agent from our branch will go through the options with you. There is no charge for the conversation.'];
  } else {
    subject = 'Your group cover at ' + age + ', and what comes next';
    paras = ['Your group cover through ' + g.name + ' runs to age ' + age + '. ' + (date ? 'You reach it on ' + tDmy_(date) + '.' : 'You are reaching it soon.'),
      'Nothing has to lapse. Guardian Life of the Caribbean offers individual plans you can convert to without a break in cover, and our branch arranges the move with you in good time.',
      'Reply to this e-mail, or call us on (868) 226-6461, and a licensed agent from our branch will go through the options with you. There is no charge for the conversation.'];
  }
  var html = '<div style="background:#f3f5f9;padding:20px 0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse;border:1px solid #e2e7ef">' +
    '<tr><td style="padding:18px 26px;border-bottom:3px solid #1d5bc4"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="' + GCM.SITE + 'gcm-mark.png" width="40" height="40" alt="Ricky Rampersad Branch" style="display:block;border-radius:9px"></td>' +
    '<td style="padding-left:12px;font:700 15px/1.2 Arial,sans-serif;color:#142033">Ricky Rampersad Branch<div style="font:400 12px/1.4 Arial,sans-serif;color:#5a687d">Guardian Life of the Caribbean</div></td></tr></table></td></tr>' +
    '<tr><td style="padding:22px 26px 0;font:700 22px/1.3 Arial,sans-serif;color:#142033">' + E(subject) + '</td></tr>' +
    '<tr><td style="padding:16px 26px 22px;font:15px/1.6 Arial,sans-serif;color:#142033"><p style="margin:0 0 12px">Dear ' + E(fn) + ',</p>' + paras.map(function (x) { return '<p style="margin:0 0 12px">' + E(x) + '</p>'; }).join('') +
    '<p style="margin:0">Warm regards,<br><b>' + E(signer) + '</b><br>Ricky Rampersad Branch, Guardian Life of the Caribbean<br><span style="color:#5a687d">9-13 Endeavour 1st Street, Chaguanas · (868) 226-6461</span></p></td></tr></table></div>';
  if (!gcmYes_(b.send)) return { ok: true, preview: true, subject: subject, html: html, to: email, live: gblLive_(), said: email ? 'Preview. It goes to ' + email + (gblLive_() ? '' : ' once the bills are live; in test mode to you') + '.' : 'Preview. No e-mail is on record for this member: add it in Salesforce, or send the letter through the group.' };
  if (!tMsCreds_()) return { ok: false, error: 'Microsoft 365 is not set up on this project, so nothing can go from support@.' };
  var live = gblLive_(), test = !live, to = test ? [who.email || gcmDayManager_()].filter(String) : [email].filter(String);
  if (!to.length) return { ok: false, error: test ? 'Your e-mail is not on the Agent Skill Bank, so the test copy has nowhere to go.' : 'No e-mail is on record for this member.' };
  var body = (test ? '<div style="background:#FFF4D6;border:2px solid #E0A800;padding:12px 16px;margin:0 0 14px;font:14px/1.5 Arial,sans-serif;color:#3D2E00"><b>TEST.</b> This letter would go to <b>' + E(email || 'no address on record') + '</b>. The bills are in test mode (gblGoLive switches them on): nothing has reached the member.</div>' : '') + html;
  try { tMsSend_(to[0], (test ? '[TEST] ' : '') + subject, body, { cc: test ? (TRANSITION.CC || []).slice() : gcmCc_(g), replyTo: TRANSITION.MS_FROM }); }
  catch (e) { return { ok: false, error: 'Not sent: ' + String(e && e.message ? e.message : e).slice(0, 200) }; }
  gblAppend_(GBL.CHANGES, [{ When: new Date(), Group: g.name, Line: 'health', Kind: 'letter', Member: name, Detail: subject + (test ? ' (TEST to ' + to.join(', ') + ')' : ' sent to ' + to.join(', ')), Effective: date, Amount: 0, Source: 'staff', By: who.name, Status: test ? 'test' : 'done', 'SF Task': '', 'SF Id': '', Note: kind }]);
  gcmAppend_(GCM.SENDS, [{ When: new Date(), Group: g.name, Staff: signer, To: to.join(', '), Cc: '', Subject: subject, Items: 0, 'Task Ids': kind + ':' + name, Letter: paras.join('\n\n').slice(0, 20000), Via: 'support@', Status: test ? 'member letter test' : 'member letter sent', Html: gcmKeepHtml_(html) }]);
  return { ok: true, test: test, to: to, said: test ? 'Test copy sent to ' + to.join(', ') + '. Nothing reached the member.' : 'Sent to ' + to.join(', ') + ' from support@.' };
}

/* ── the statement: one page for the group, this month's lines and what is still owed from earlier invoices ── */
/** The statement's figures: the month's bills, each line's amount; the earlier months Salesforce shows as unpaid or part
 *  paid (and what Head Office's own invoice shows as outstanding, when it differs); what changed since last month, as counts;
 *  what is attached. Counts only: no member's name. */
function gblStatementData_(g, month, L, sf, bills) {
  var lines = [], owed = [], total = 0, changes = { joined: 0, left: 0, moved: 0 };
  var moves = gblBillChanges_(g, month, bills);
  bills.forEach(function (b) {
    total = gblR_(total + b.due);
    var m = (b.findings || []).filter(function (x) { return x.kind === 'moved'; }).reduce(function (s, x) { return s + ((x.members || []).length || 1); }, 0);
    var j = moves.filter(function (c) { return c.line === b.line && c.kind === 'joiner'; }).length, l = moves.filter(function (c) { return c.line === b.line && c.kind === 'leaver'; }).length;
    changes.joined += j; changes.left += l; changes.moved += m;
    lines.push({ line: b.line, label: GBL.LABEL[b.line], ref: b.ref, due: b.due, dueBy: b.dueBy, members: b.members, arrears: b.arrears, joined: j, left: l, moved: m, files: b.files, status: b.status, sentAt: b.sentAt });
  });
  var owedTotal = 0, invoiceOwed = 0;
  bills.forEach(function (b) { invoiceOwed = gblR_(invoiceOwed + (b.arrears || 0)); });
  sf.trans.filter(function (t) { return t.month < month && t.month >= gblAddMonths_(month, -14) && t.billed > 0; }).forEach(function (t) {
    var pays = sf.pays.filter(function (q) { return q.trans === t.id15; }), paid = Math.max(t.paid, pays.reduce(function (s, q) { return s + q.amount; }, 0));
    if (paid < t.billed - 0.05) { var o = gblR_(t.billed - paid); owedTotal = gblR_(owedTotal + o); owed.push({ line: t.line, label: GBL.LABEL[t.line] || t.rt, month: t.month, monthLabel: gblMonthLabel_(t.month), billed: t.billed, paid: paid, owed: o, status: paid > 0 ? 'Part paid' : 'Open' }); }
  });
  owed.sort(function (a, b) { return a.month < b.month ? -1 : a.month > b.month ? 1 : 0; });
  /* Head Office's arrears against ours, line by line: a health invoice is compared with what Salesforce shows owed on
   * health alone, never with every line's arrears added together */
  var arrearsDiff = [];
  bills.forEach(function (b) {
    /* only a health invoice prints its outstanding balances; a life bill or a list bill carries none, so it is never
     * read as Head Office showing nothing owed */
    if (b.line !== 'health' && !(b.arrears > 0)) return;
    var ours = gblR_(owed.filter(function (x) { return x.line === b.line; }).reduce(function (s, x) { return s + x.owed; }, 0)), theirs = gblR_(b.arrears || 0);
    if (Math.abs(theirs - ours) > 0.05 && (theirs > 0 || ours > 0)) arrearsDiff.push({ line: b.line, label: GBL.LABEL[b.line], invoice: theirs, ours: ours });
  });
  var dueBy = bills.map(function (x) { return x.dueBy; }).filter(String).sort()[0] || '';
  return { month: month, label: gblMonthLabel_(month), group: g.name, listBill: g.bills[0] || '', lines: lines, total: total, dueBy: dueBy, owed: owed, owedTotal: owedTotal, invoiceOwed: invoiceOwed, arrearsDiff: arrearsDiff,
    grand: gblR_(total + owedTotal), changes: changes, attachments: bills.map(function (b) { return b.files; }).filter(String), asAt: tDmy_(L.today), today: L.today };
}
/** The joiners and leavers this month's bills show, for the lines given: each bill's own findings (who joined or left
 *  since last month's bill), its credits and back-charges, and a life statement's adjustments, one entry per person and
 *  kind. Read from the month's own bill, never from Group Changes, which keeps no month: a joiner charged on October's
 *  bill is October's change and is not counted again on November's. The cover note names them and the statement counts
 *  them, so the two never disagree. */
function gblBillChanges_(g, month, bills) {
  var out = [];
  var add = function (line, kind, member, effective) {
    if (!member || out.some(function (c) { return c.line === line && c.kind === kind && gblSamePerson_(c.member, member); })) return;
    out.push({ line: line, kind: kind, member: member, effective: effective || '' });
  };
  bills.forEach(function (b) {
    (b.findings || []).forEach(function (f) {
      if (f.kind === 'joined' || f.kind === 'left') (f.members || []).forEach(function (x) { add(b.line, f.kind === 'joined' ? 'joiner' : 'leaver', x.name, x.start || ''); });
    });
    var rows = [];
    try { rows = gblLines_(g, b.line, b.month || month); } catch (e) {}
    rows.forEach(function (r) {
      if (r.kind === 'cancel' || r.kind === 'left') add(b.line, 'leaver', r.name, r.kind === 'cancel' ? (r.forMonth ? r.forMonth + '-01' : '') : r.eff);
      else if (r.kind === 'adjust' || r.kind === 'joined') add(b.line, 'joiner', r.name, r.kind === 'adjust' ? (r.forMonth ? r.forMonth + '-01' : '') : r.eff);
    });
  });
  return out;
}
/** The statement as a page: a table of the month's lines, the earlier months still owed, what changed, what is attached.
 *  Tables and inline styles only, so it reads in any mail app and renders to PDF. */
function gblStatementHtml_(g, d, o) {
  o = o || {};
  var E = tEsc_, money = gcmMoney_, td = 'style="padding:9px 10px;border-bottom:1px solid #e2e7ef;font:14px Arial,sans-serif;color:#142033"', tdr = 'style="padding:9px 10px;border-bottom:1px solid #e2e7ef;font:14px Arial,sans-serif;color:#142033;text-align:right;white-space:nowrap"';
  var th = 'style="text-align:left;padding:8px 10px;border-bottom:2px solid #1d5bc4;font:700 12px Arial,sans-serif;color:#1d5bc4;text-transform:uppercase;letter-spacing:.04em"', thr = th.replace('text-align:left', 'text-align:right');
  var h = '<div style="background:#f3f5f9;padding:' + (o.inline ? '0' : '20px 0') + '"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;margin:0 auto;background:#ffffff;border-collapse:collapse;border:1px solid #e2e7ef">';
  if (!o.inline) h += '<tr><td style="padding:18px 26px;border-bottom:3px solid #1d5bc4"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="' + GCM.SITE + 'gcm-mark.png" width="40" height="40" alt="Ricky Rampersad Branch" style="display:block;border-radius:9px"></td>' +
    '<td style="padding-left:12px;font:700 15px/1.2 Arial,sans-serif;color:#142033">Ricky Rampersad Branch<div style="font:400 12px/1.4 Arial,sans-serif;color:#5a687d">Guardian Life of the Caribbean · Group billing</div></td></tr></table></td>' +
    '<td style="text-align:right;font:12px/1.5 Arial,sans-serif;color:#5a687d">Statement of account<br>as at ' + E(d.asAt) + '</td></tr></table></td></tr>';
  h += '<tr><td style="padding:' + (o.inline ? '8px 0 0' : '22px 26px 0') + '"><div style="font:700 ' + (o.inline ? '17' : '22') + 'px/1.3 Arial,sans-serif;color:#142033">' + (o.inline ? 'Statement of account · ' : '') + E(d.label) + ' billing' + (o.inline ? '' : ' · statement of account') + '</div>' +
    '<div style="font:14px/1.4 Arial,sans-serif;color:#5a687d;margin-top:6px">' + E(d.group) + (d.listBill ? ' · list bill ' + E(d.listBill) : '') + (d.dueBy ? ' · payable by ' + E(tDmy_(d.dueBy)) : '') + '</div></td></tr>';
  h += '<tr><td style="padding:' + (o.inline ? '12px 0 0' : '18px 26px 0') + '"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr><th ' + th + '>This month</th><th ' + thr + '>Members</th><th ' + thr + '>Due</th></tr>' +
    d.lines.map(function (l) { return '<tr><td ' + td + '>' + E(l.label) + (l.ref ? '<div style="font:12px Arial,sans-serif;color:#5a687d">Ref ' + E(l.ref) + '</div>' : '') + '</td><td ' + tdr + '>' + (l.members || '') + '</td><td ' + tdr + '>' + E(money(l.due)) + '</td></tr>'; }).join('') +
    '<tr><td ' + td.replace('color:#142033', 'color:#142033;font-weight:700;background:#ebf2fd') + ' colspan="2">Total for ' + E(d.label) + '</td><td ' + tdr.replace('color:#142033', 'color:#1d5bc4;font-weight:700;background:#ebf2fd') + '>' + E(money(d.total)) + '</td></tr></table></td></tr>';
  /* In the e-mail (o.inline) the earlier invoices are two columns, billed and received under the invoice's name, so the
     statement fits a phone: four columns of amounts ran 60px past one on 25 October 2026. The PDF keeps all four. */
  var span = o.inline ? '1' : '3';
  if (d.owed.length) h += '<tr><td style="padding:' + (o.inline ? '14px 0 0' : '18px 26px 0') + '"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr><th ' + th + '>Still owed from earlier invoices</th>' + (o.inline ? '' : '<th ' + thr + '>Billed</th><th ' + thr + '>Received</th>') + '<th ' + thr + '>Owed</th></tr>' +
    d.owed.map(function (x) {
      if (o.inline) return '<tr><td ' + td + '>' + E(x.label) + ' · ' + E(x.monthLabel) + '<div style="font:12.5px/1.4 Arial,sans-serif;color:#5a687d">billed ' + E(money(x.billed)) + ' · received ' + (x.paid ? E(money(x.paid)) : 'nothing yet') + '</div></td><td ' + tdr + '>' + E(money(x.owed)) + '</td></tr>';
      return '<tr><td ' + td + '>' + E(x.label) + ' · ' + E(x.monthLabel) + '</td><td ' + tdr + '>' + E(money(x.billed)) + '</td><td ' + tdr + '>' + (x.paid ? E(money(x.paid)) : '–') + '</td><td ' + tdr + '>' + E(money(x.owed)) + '</td></tr>';
    }).join('') +
    '<tr><td ' + td.replace('color:#142033', 'color:#142033;font-weight:700;background:#fdf1e1') + ' colspan="' + span + '">Earlier months still owed</td><td ' + tdr.replace('color:#142033', 'color:#a64b05;font-weight:700;background:#fdf1e1') + '>' + E(money(d.owedTotal)) + '</td></tr>' +
    '<tr><td ' + td.replace('color:#142033', 'color:#142033;font-weight:700') + ' colspan="' + span + '">Total to bring the account up to date</td><td ' + tdr.replace('color:#142033', 'color:#142033;font-weight:700') + '>' + E(money(d.grand)) + '</td></tr></table>' +
    gblArrearsNote_(d, E, money) + '</td></tr>';
  else h += '<tr><td style="padding:' + (o.inline ? '12px 0 0' : '16px 26px 0') + ';font:14px/1.5 Arial,sans-serif;color:#067647"><b>Nothing is owed from earlier months.</b> Thank you.' + (d.invoiceOwed ? ' Head Office\'s ' + E(gblArrearsLines_(d)) + ' invoice still shows ' + E(money(d.invoiceOwed)) + ' outstanding: our records show it paid, and we are having it cleared.' : '') + '</td></tr>';
  var ch = [];
  if (d.changes.joined) ch.push(d.changes.joined + ' joined');
  if (d.changes.left) ch.push(d.changes.left + ' left');
  if (d.changes.moved) ch.push(d.changes.moved + ' changed tier or premium');
  h += '<tr><td style="padding:' + (o.inline ? '12px 0 0' : '16px 26px 0') + ';font:14px/1.5 Arial,sans-serif;color:#142033"><b>Changes on this billing:</b> ' + (ch.length ? E(ch.join(', ')) + '. The names are on the attached bills.' : 'no one joined or left, and no premium changed.') + '</td></tr>';
  if (d.attachments.length) h += '<tr><td style="padding:' + (o.inline ? '8px 0 0' : '10px 26px 0') + ';font:13px/1.5 Arial,sans-serif;color:#5a687d"><b>Attached:</b> ' + E(d.attachments.join('; ')) + '.</td></tr>';
  if (!o.inline) h += '<tr><td style="padding:18px 26px 22px;font:13px/1.5 Arial,sans-serif;color:#5a687d">Please pay as you do today and quote the invoice reference. Tell us about a payment, a joiner or a leaver on your service page, or reply to this e-mail.<br>Ricky Rampersad Branch, Guardian Life of the Caribbean · 9-13 Endeavour 1st Street, Chaguanas · (868) 226-6461</td></tr>';
  return h + '</table></div>';
}
/** The line under the earlier months: each line whose Head Office invoice shows a different figure from our records. */
function gblArrearsNote_(d, E, money) {
  var diff = d.arrearsDiff || [];
  if (!diff.length) return '';
  return '<p style="margin:8px 0 0;font:12px/1.5 Arial,sans-serif;color:#5a687d">' + diff.map(function (x) {
    var l = String(x.label).toLowerCase();
    return 'Head Office\'s ' + E(l) + ' invoice shows ' + E(money(x.invoice)) + ' outstanding from earlier months; our records show ' + E(money(x.ours)) + ' for ' + E(l) + '.';
  }).join(' ') + ' If you have paid any of it, tell us and we will have the payment matched.</p>';
}
function gblArrearsLines_(d) {
  var l = d.lines.filter(function (x) { return x.arrears > 0; }).map(function (x) { return String(x.label).toLowerCase(); });
  return l.length ? l.join(' and ') : 'group';
}
/** The statement as a PDF blob, or null where the conversion is not available. */
function gblStatementPdf_(html, name) {
  try { var pdf = Utilities.newBlob('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">' + html + '</body></html>', 'text/html', name + '.html').getAs('application/pdf'); pdf.setName(name + '.pdf'); return pdf; } catch (e) { return null; }
}
function gblStatementName_(g, month) { return ('Statement - ' + g.name + ' - ' + gblMonthLabel_(month)).replace(/[^\w\s\-]/g, '').replace(/\s+/g, ' ').slice(0, 90); }
/** The statement route: the figures, the page, and the PDF when it can be made. */
function gblStatement_(p) {
  var who = gcmWho_(p);
  if (!who.ok) return who;
  var L = gcmLoad_(), g = L.byName[gcmCodeKey_(p.group)];
  if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  var month = String(p.month || ''), bills = gblBillRows_(g).filter(function (x) { return x.month === month; });
  if (!bills.length) return { ok: true, month: month, data: null, html: '', pdf: '', said: 'Upload a bill for ' + gblMonthLabel_(month) + ' first: the statement is written from the bills.' };
  var sf = gblSf_(g), d = gblStatementData_(g, month, L, sf, bills), html = gblStatementHtml_(g, d, {});
  var pdf = gcmYes_(p.pdf) ? gblStatementPdf_(html, gblStatementName_(g, month)) : null;
  return { ok: true, month: month, data: d, html: html, pdf: pdf ? gblPdfB64_(pdf) : '', pdfName: gblStatementName_(g, month) + '.pdf', live: gblLive_(),
    said: d.owed.length ? gcmMoney_(d.owedTotal) + ' still owed from ' + d.owed.length + ' earlier month' + (d.owed.length === 1 ? '' : 's') + '; ' + gcmMoney_(d.total) + ' this month.' : gcmMoney_(d.total) + ' this month, nothing owed from earlier months.' };
}
/** The statement's PDF for a send, or null. */
function gblStatementBlob_(g, month, bills, L) {
  try { var d = gblStatementData_(g, month, L, gblSf_(g), bills); return gblStatementPdf_(gblStatementHtml_(g, d, {}), gblStatementName_(g, month)); } catch (e) { return null; }
}
