/* Billings Management (24 October 2026): the staff page's guided billing review, one group at a time.
 *
 * "it should be an experience … it guides them what they have to check with life, health, and etc. … asks them to
 * upload the PDF billing, and it verifies our Salesforce records … scrubs all the open tasks … scrubbing the inbox …
 * allows the staff or the manager to place comments on the task, and it goes on to Chatter".
 *
 * The bill is read on this device (billread.js, pdf.js and SheetJS from cdnjs); the figures and member lines go to the
 * backend (GroupBilling.gs), which checks them against Salesforce and keeps them. The PDF itself stays here, in memory,
 * until the bill is sent to the group, when it travels as the attachment. This file holds no client data.
 * It uses the staff page's own helpers ($, esc, api, post, toast, dmy, BOARD, GROUP, openGroup, render). */
let BILL = null, BILL_FILES = {}, BILL_READ = {}, BILL_PREV = {}, BILL_MONTH = '';
const BL_LABEL = { health: 'Group Health', life: 'Group Life', listbill: 'Pensions and life (list bill)' };
const BL_HINT = {
  health: 'The Group Health invoice PDF from Head Office: the summary, the member detail, the credits and the transmittal pages, in one file.',
  life: 'The Group Life pack: the member bill, the Statement of Adjustment and the covering letter. Upload all three together, or one at a time.',
  listbill: 'The pension and life list bill the branch bills through the group’s payroll: the spreadsheet, or build it here from the policies carrying the list bill in Salesforce.'
};
const BL_WHO = { salesforce: 'Salesforce', headoffice: 'Head Office', group: 'The group', us: 'Us' };
const BL_LIB = { pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' };
const BL_LOADED = {};
function blScript(src) {
  if (BL_LOADED[src]) return BL_LOADED[src];
  return BL_LOADED[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src.split('/').pop())); document.head.appendChild(s); });
}
const blMoney = n => { n = Number(n) || 0; return (n < 0 ? '−' : '') + 'TT$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
const BL_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const blMon = m => { const x = /^(\d{4})-(\d{2})/.exec(m || ''); return x ? BL_MON[+x[2] - 1] + ' ' + x[1] : ''; };
const blAddM = (m, n) => { const x = /^(\d{4})-(\d{2})/.exec(m); const d = new Date(Date.UTC(+x[1], +x[2] - 1 + n, 1)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };

/* ── opening the review ── */
async function openBilling(key, month) {
  $('app').innerHTML = '<p class="muted" style="margin:30px 0">Opening the billing review: Salesforce’s billing records, payments, members and tasks…</p>';
  const d = await api(Object.assign({ action: 'gcm.billing', group: key }, month ? { month } : {}));
  if (!d.ok) { toast(d.error || 'Not opened', true); if (GROUP) openGroup(key); else render(); return; }
  VIEW = 'billing'; BILL = d; BILL_MONTH = d.month; drawBilling();
}
function blSteps(s) {
  const steps = [['upload', 'Upload'], ['verify', 'Verify'], ['fixed', 'Fix'], ['reconciled', 'Reconcile'], ['approved', 'Approve'], ['sent', 'Send']];
  let cur = steps.findIndex(([k]) => !s[k]); if (cur < 0) cur = steps.length;
  return '<ol class="steps" aria-label="Where this line stands">' + steps.map(([k, l], i) => '<li class="' + (s[k] ? 'done' : i === cur ? 'now' : '') + '"><span class="n">' + (s[k] ? '✓' : i + 1) + '</span>' + l + (k === 'fixed' && s.open ? '<small>' + s.open + ' open</small>' : '') + '</li>').join('') + '</ol>';
}
function drawBilling() {
  const d = BILL, g = d.group;
  $('mhello').innerHTML = '';
  const months = new Set([d.month, blAddM(d.today.slice(0, 7), 1), d.today.slice(0, 7)]);
  d.lines.forEach(o => { o.stored.forEach(x => months.add(x.month)); o.sf.history.forEach(h => months.add(h.month)); });
  const opts = [...months].filter(Boolean).sort().reverse().map(m => '<option value="' + m + '"' + (m === d.month ? ' selected' : '') + '>' + blMon(m) + '</option>').join('');
  let h = '<button class="back" type="button" id="blBack">← ' + esc(g.name) + '</button>' +
    '<div class="blhead"><div><h2 style="margin:8px 0 2px">Billing review <span class="muted">· ' + esc(g.name) + '</span></h2><p class="small muted" style="margin:0">List bill ' + esc(g.bills.join(', ') || 'none') + ' · letters go to ' + esc(g.contact || g.to.join(', ') || 'nobody yet') + (d.canAct === false ? ' · <b>read only</b>: ' + esc(g.assigned || 'its owner') + ', the assistant branch manager or the branch manager acts here' : '') + '</p></div>' +
    '<div class="blctl"><label class="sel">Month <select id="blMonth">' + opts + '</select></label><button class="btn ghost sm" type="button" id="blFresh">Read Salesforce again</button>' + (d.ai ? '<button class="btn ghost sm" type="button" id="blAi">Read this month with AI</button>' : '') + '</div></div>';
  h += blDayStrip(d.day, d.live);
  if (!d.salesforce) h += '<div class="note bad">Salesforce is not linked, so the bills cannot be checked against the records' + (d.sfError ? ': ' + esc(d.sfError) : '') + '.</div>';
  if (!d.live) h += '<div class="note info"><div><b>Sending is in test mode.</b> A bill sent from here goes to you and the branch, marked TEST, until the branch manager runs gblGoLive in the script editor. Everything else is live: the checks, the Salesforce fixes, the tasks and the Chatter.</div></div>';
  h += '<div class="guide"><h3>What to do next</h3><ol>' + d.guide.map(s => '<li class="g-' + esc(s.kind) + '">' + esc(s.text) + (s.line ? ' <button class="lnk" type="button" data-jump="' + esc(s.line) + '">go</button>' : '') + '</li>').join('') + '</ol></div>' +
    '<div id="blAiBox"></div>';
  h += d.lines.map(blLineCard).join('');
  h += blTasksHtml(d) + blInboxHtml(d) + blChangesHtml(d);
  $('app').innerHTML = h;
  $('blBack').onclick = () => openGroup(g.key);
  $('blMonth').onchange = () => openBilling(g.key, $('blMonth').value);
  $('blFresh').onclick = async () => { $('blFresh').disabled = true; const r = await api({ action: 'gcm.billing', group: g.key, month: d.month, fresh: 'Y' }); if (r.ok) { BILL = r; drawBilling(); toast('Salesforce read again.'); } else { $('blFresh').disabled = false; toast(r.error || 'Not read', true); } };
  if ($('blAi')) $('blAi').onclick = blAi;
  $('app').querySelectorAll('[data-jump]').forEach(b => b.onclick = () => { const el = $('line-' + b.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  blBindLines(); blBindTasks(); blBindChanges();
  window.scrollTo(0, 0);
}

/* ── one line: its steps, the upload, the bill, the findings, Salesforce's history ── */
function blLineCard(o) {
  const d = BILL, b = o.bill, s = o.steps, rec = o.sf.rec, can = d.canAct !== false;
  let h = '<section class="bline" id="line-' + o.line + '"><div class="blt"><h3>' + esc(o.label) + '</h3>' + blSteps(s) + '</div>';
  /* Salesforce this month */
  h += '<div class="sfrow">' + (rec ? '<span class="chip"><i style="background:var(--bar)"></i>Salesforce ' + esc(rec.name) + ': billed ' + esc(blMoney(rec.billed)) + (rec.paid ? ', paid ' + esc(blMoney(rec.paid)) : ', nothing paid yet') + (rec.reconciled ? ' · reconciled' : '') + '</span>' :
    '<span class="chip warn"><i></i>No ' + esc(o.rt) + ' record for ' + esc(d.monthLabel) + ' in Salesforce</span>') + (o.sf.pays.length ? o.sf.pays.map(p => '<span class="chip good"><i></i>' + esc(blMoney(p.amount)) + ' paid ' + esc(dmy(p.paidOn)) + (p.method ? ' by ' + esc(p.method) : '') + '</span>').join('') : '') + '</div>';
  /* the upload */
  if (!b || BILL_READ[o.line]) {
    h += '<div class="upload" id="up-' + o.line + '"><p class="small">' + esc(BL_HINT[o.line]) + '</p>';
    if (can) h += '<div class="uprow"><label class="btn ghost" for="file-' + o.line + '">Choose the file' + (o.line === 'life' ? 's' : '') + '</label><input type="file" id="file-' + o.line + '" data-line="' + o.line + '" accept="' + (o.line === 'listbill' ? '.xlsx,.xls,.csv,.pdf' : '.pdf') + '"' + (o.line === 'life' ? ' multiple' : '') + ' class="hide">' +
      (o.line === 'listbill' && o.fromSalesforce ? '<button class="btn ghost" type="button" data-fromsf="listbill">Build it from Salesforce (' + o.fromSalesforce.count + ' policies, ' + esc(blMoney(o.fromSalesforce.total)) + ')</button>' : '') + '<span class="small muted" id="upmsg-' + o.line + '"></span></div>';
    else h += '<p class="small muted">Only ' + esc(d.group.assigned || 'the owner') + ', the assistant branch manager or the branch manager can upload here.</p>';
    h += '<div id="preview-' + o.line + '">' + (BILL_READ[o.line] ? blPreview(o.line, BILL_READ[o.line]) : '') + '</div></div>';
  }
  if (b) {
    const v = b.variance;
    h += '<div class="tiles bill-tiles"><div class="tile"><b>' + esc(blMoney(b.due)) + '</b><span>due for ' + esc(blMon(b.month)) + (b.dueBy ? ' · by ' + esc(dmy(b.dueBy)) : '') + '</span></div>' +
      '<div class="tile"><b>' + b.members + '</b><span>' + (o.line === 'listbill' ? 'policies' : 'members') + ' on the bill</span></div>' +
      (b.arrears ? '<div class="tile alert"><b>' + esc(blMoney(b.arrears)) + '</b><span>earlier months shown unpaid</span></div>' : '') +
      '<div class="tile' + (Math.abs(v) > 0.05 ? ' alert' : '') + '"><b>' + (b.sfRecord ? esc(blMoney(b.sfBilled)) : '–') + '</b><span>billed in Salesforce' + (b.sfRecord ? (Math.abs(v) > 0.05 ? ' · ' + (v > 0 ? esc(blMoney(v)) + ' more than' : esc(blMoney(-v)) + ' short of') + ' the ' + esc(blMoney(blCharged(o.line, b))) + ' charged' : ' · the same as the ' + esc(blMoney(blCharged(o.line, b))) + ' charged') : ' · no record') + '</span></div></div>' +
      blSfwPanel(o) +
      '<p class="small muted">' + (b.ref ? 'Ref ' + esc(b.ref) + ' · ' : '') + (b.dated ? 'dated ' + esc(dmy(b.dated)) + ' · ' : '') + 'uploaded by ' + esc(b.by) + ' ' + esc(b.checkedAt) + (b.files ? ' · ' + esc(b.files) : '') + (b.reconciledAt ? ' · <b>reconciled ' + esc(b.reconciledAt) + ' by ' + esc(b.reconciledBy) + '</b>' : '') + (b.sentAt ? ' · <b>sent ' + esc(b.sentAt) + '</b>' : '') +
      (can && !BILL_READ[o.line] ? ' · <button class="lnk" type="button" data-reup="' + o.line + '">upload again</button>' : '') + '</p>';
    h += blFindings(o);
    if (can) h += '<div class="blacts">' + (!b.reconciledAt ? '<button class="btn' + (s.fixes ? ' ghost' : '') + '" type="button" data-rec="' + o.line + '"' + (s.fixes && d.role !== 'branch' ? ' disabled title="Fix or resolve the findings marked fix first"' : '') + '>Mark reconciled</button>' : '') +
      blApproveActs(o, b, s, d) + blSendBtn(o, b, s, d) +
      '<button class="btn ghost" type="button" data-pay="' + o.line + '">Record a payment</button></div>';
  }
  h += blLineTasks(o);
  h += blHistory(o);
  if (o.line === 'health') h += blClaims(o, can);
  return h + '</section>';
}
function blPreview(line, read) {
  const p = read.part;
  if (!p) return '<div class="note bad">Nothing readable was found in ' + esc(read.names.join(', ')) + '. ' + esc((read.warnings || []).join(' ')) + '</div>';
  const w = (p.warnings || []).concat(read.warnings || []);
  let h = '<div class="pv"><b>Read from ' + esc(read.names.join(', ')) + '</b>: ' + (p.group ? esc(p.group) + ', ' : '') + (p.ref ? esc(p.ref) + ', ' : '') + esc(blMon(p.month) || 'month not found') + ' · ' + (p.count || (p.members || []).length) + ' ' + (line === 'listbill' ? 'policies' : 'members') + ' · due <b>' + esc(blMoney(p.due)) + '</b>' +
    (line === 'life' && p.has ? ' · ' + ['bill', 'adj', 'letter'].filter(k => p.has[k]).map(k => ({ bill: 'member bill', adj: 'statement', letter: 'letter' })[k]).join(', ') + (p.has.bill && p.has.adj ? '' : ' <span class="chip warn"><i></i>' + (!p.has.bill ? 'no member bill yet' : 'no statement yet') + '</span>') : '') +
    (w.length ? '<ul class="pvw">' + w.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
    '<div class="uprow" style="margin-top:8px">' + (!p.month ? '<label class="sel">Month <input type="month" id="pvm-' + line + '"></label>' : '') + '<button class="btn" type="button" data-store="' + line + '">Store and check against Salesforce</button><button class="btn ghost" type="button" data-cancel="' + line + '">Cancel</button></div></div>';
  return h;
}
function blFindings(o) {
  const b = o.bill, F = b.findings || [], R = b.resolved || {}, can = BILL.canAct !== false;
  if (!F.length) return '<p class="small muted">No findings.</p>';
  const grp = [['fix', 'To fix before this bill is reconciled'], ['check', 'To confirm'], ['note', 'For the record'], ['ok', 'Checks out']];
  let h = '<div class="findings">';
  grp.forEach(([lvl, title]) => {
    const list = F.filter(f => f.level === lvl); if (!list.length) return;
    h += '<h4 class="f-' + lvl + '">' + title + ' <span class="n">' + list.length + '</span></h4>' + list.map(f => {
      const r = R[f.id];
      return '<div class="finding f-' + lvl + (r ? ' resolved' : '') + '"><div class="ft"><span class="who">' + esc(BL_WHO[f.who] || f.who) + '</span>' + esc(f.text) +
        (f.members && f.members.length ? '<details><summary>' + f.members.length + ' named</summary><ul>' + f.members.map(m => '<li>' + esc(m.name) + (m.id ? ' · ' + esc(m.id) : '') + (m.premium != null ? ' · ' + esc(blMoney(m.bill != null ? m.bill : m.premium)) : '') + (m.sf != null ? ' (Salesforce ' + esc(blMoney(m.sf)) + ')' : '') + (m.start ? ' · from ' + esc(dmy(m.start)) : '') + '</li>').join('') + '</ul></details>' : '') + '</div>' +
        (r ? '<div class="fr">Resolved by ' + esc(r.by) + ' ' + esc(r.at) + ': ' + esc(r.note) + '</div>' : can && lvl !== 'ok' ? '<div class="fa">' +
          (f.action === 'sfAmount' ? '<button class="btn sm" type="button" data-fix="sfAmount" data-line="' + o.line + '">Set Salesforce to ' + esc(blMoney(f.data.want)) + '</button>' : '') +
          (f.action === 'sfWrite' ? '<button class="btn sm" type="button" data-fix="sfWrite" data-line="' + o.line + '">' + (f.kind === 'norecord' ? 'Make it in Salesforce from the bill' : 'Bring Salesforce in line with the bill') + '</button>' : '') +
          '<button class="btn sm ghost" type="button" data-task="' + o.line + '" data-f="' + esc(f.id) + '">Open a task for it</button>' +
          (f.action === 'payment' ? '<button class="btn sm ghost" type="button" data-pay="' + o.line + '" data-month="' + esc(f.data.month) + '" data-amount="' + esc(f.data.amount) + '">Record the payment</button>' : '') +
          '<button class="btn sm ghost" type="button" data-resolve="' + esc(f.id) + '" data-line="' + o.line + '">Resolve with a note</button></div>' : '') + '</div>';
    }).join('');
  });
  return h + '</div>';
}
function blHistory(o) {
  const H = o.sf.history;
  if (!H.length) return '<p class="small muted">No billing records for this line in Salesforce for the last ' + 14 + ' months.</p>';
  return '<details class="hist sfhist"><summary>Salesforce, month by month <span class="n">' + H.length + '</span></summary><div class="scroll"><table class="t"><thead><tr><th>Month</th><th class="num">Billed</th><th class="num">Paid</th><th>Paid on</th><th>How</th><th>Keyed</th><th>Record</th></tr></thead><tbody>' +
    H.map(x => '<tr' + (x.month === BILL.month ? ' class="cur"' : '') + '><td>' + esc(x.label) + '</td><td class="num">' + esc(blMoney(x.billed)) + '</td><td class="num' + (x.paid >= x.billed - 0.05 && x.billed ? ' good' : x.paid ? '' : ' bad') + '">' + (x.paid ? esc(blMoney(x.paid)) : '–') + '</td><td>' + esc(dmy(x.paidOn)) + '</td><td>' + esc(x.method) + '</td><td class="small muted">' + (x.keyed ? esc(dmy(x.keyed)) + (x.by ? ' · ' + esc(x.by) : '') : '') + '</td><td class="small muted">' + esc(x.rec) + (x.reconciled ? ' ✓' : '') + '</td></tr>').join('') + '</tbody></table></div></details>';
}
function blClaims(o, can) {
  const c = o.claims;
  let h = '<details class="hist claims"' + (c ? ' open' : '') + '><summary>Claims experience <span class="n">' + (c ? 'to ' + esc(blMon(c.to)) : 'none uploaded') + '</span></summary><div class="claimsbody">';
  if (c) {
    h += (c.note ? '<p class="trend">' + esc(c.note) + '</p>' : '') +
      '<div class="scroll"><table class="t"><thead><tr><th>Plan year</th><th class="num">Months</th><th class="num">Premium billed</th><th class="num">Claims paid</th><th class="num">Loss ratio</th><th class="num">Claims</th><th class="num">Plan pays</th><th class="num">Rate change</th></tr></thead><tbody>' +
      c.planYears.map(y => '<tr><td>' + esc(y.label) + '</td><td class="num">' + y.months + '</td><td class="num">' + esc(blMoney(y.premium)) + '</td><td class="num">' + esc(blMoney(y.paid)) + '</td><td class="num"><b class="' + (y.lossRatio == null ? '' : y.lossRatio > 90 ? 'bad' : y.lossRatio < 65 ? 'good' : '') + '">' + (y.lossRatio == null ? '–' : y.lossRatio + '%') + '</b></td><td class="num">' + y.claims + '</td><td class="num">' + (y.payShare == null ? '–' : y.payShare + '%') + '</td><td class="num">' + (y.rateChange == null ? '' : (y.rateChange > 0 ? '+' : '') + y.rateChange + '%') + '</td></tr>').join('') + '</tbody></table></div>' +
      blMonthBars(c.monthly) + '<p class="small muted">Premium is Salesforce’s Group Billing Premiums by month; a plan year starts where the monthly premium steps up and stays up. The last two months of claims are still filling in. Uploaded ' + esc(c.uploaded || '') + '.</p>';
  } else h += '<p class="small">Upload the claims summary spreadsheet (one row a claim: service date, status, charge, patient responsibility, paid, division). It is aggregated here by month and division before anything leaves this device: no patient’s name reaches the sheet.</p>';
  if (can) h += '<div class="uprow"><label class="btn ghost" for="claims-' + o.line + '">' + (c ? 'Upload a newer claims summary' : 'Upload the claims summary') + '</label><input type="file" id="claims-' + o.line + '" accept=".xlsx,.xls,.csv" class="hide"><span class="small muted" id="claimsmsg"></span></div>';
  return h + '</div></details>';
}
function blMonthBars(list) {
  if (!list || !list.length) return '';
  const max = Math.max(1, ...list.map(m => Math.max(m.paid, m.premium)));
  return '<div class="months" role="list" aria-label="Claims paid against premium, by month" style="grid-template-columns:repeat(' + list.length + ',1fr)">' + list.map(m => {
    const lab = blMon(m.month).slice(0, 3);
    return '<div class="mo" role="listitem" tabindex="0" title="' + lab + ': paid ' + blMoney(m.paid) + ', premium ' + blMoney(m.premium) + '"><b>' + Math.round(m.paid / 1000) + 'k</b><div class="pair"><div class="col prem" style="height:' + Math.round(100 * m.premium / max) + '%"></div><div class="col" style="height:' + Math.round(100 * m.paid / max) + '%"></div></div><span>' + lab + '</span></div>';
  }).join('') + '</div><div class="key2"><span><i style="background:var(--track)"></i>premium billed</span><span><i style="background:var(--bar)"></i>claims paid</span></div>' +
    '<div class="scroll"><table class="t small"><thead><tr><th>Month</th>' + list.map(m => '<th class="num">' + esc(blMon(m.month).slice(0, 3)) + '</th>').join('') + '</tr></thead><tbody>' +
    '<tr><td>Premium</td>' + list.map(m => '<td class="num">' + Math.round(m.premium).toLocaleString() + '</td>').join('') + '</tr><tr><td>Claims paid</td>' + list.map(m => '<td class="num">' + Math.round(m.paid).toLocaleString() + '</td>').join('') + '</tr><tr><td>Claims</td>' + list.map(m => '<td class="num">' + m.claims + '</td>').join('') + '</tr></tbody></table></div>';
}

/* ── the tasks, the inbox, the changes ── */
function blTasksHtml(d) {
  const lines = d.lines.map(o => o.line), list = d.tasks.filter(t => lines.indexOf(t.line) < 0), can = d.canAct !== false;
  let h = '<div class="ltt"><h3 class="blsec">Other open billing tasks in Salesforce <span class="muted small">' + list.length + ' · not tied to one line; each line’s own tasks sit under it</span></h3>' + (can ? '<button class="btn sm" type="button" data-task="">Open a task</button>' : '') + '</div>';
  if (d.feedError) h += '<div class="note bad">Chatter could not be read: ' + esc(d.feedError) + '</div>';
  if (!list.length) return h + '<p class="muted">None.</p>';
  return h + '<div class="items">' + list.map(blTaskCard).join('') + '</div>';
}
function blInboxHtml(d) {
  const ib = d.inbox || { ok: false, mails: [] };
  let h = '<h3 class="blsec">The group’s e-mails to support@ about money <span class="muted small">last 60 days</span></h3>';
  if (!ib.ok) return h + '<p class="small muted">The inbox could not be read' + (ib.error ? ': ' + esc(ib.error) : '') + '.</p>';
  if (!ib.mails.length) return h + '<p class="muted">Nothing from the group about billing or payments in the last 60 days.</p>';
  return h + '<ul class="feed">' + ib.mails.map(m => '<li><b>' + esc(m.at) + '</b> · ' + esc(m.from) + ' · ' + esc(m.subject) + (m.auto ? ' <span class="chip">auto-reply</span>' : '') + '</li>').join('') + '</ul><p class="small muted">Read only: answer them from support@. Each one should be answered before the bill goes.</p>';
}
function blChangesHtml(d) {
  const C = d.changes || [], can = d.canAct !== false;
  const K = { joiner: 'Joined', leaver: 'Left', tier: 'Tier change', dependent: 'Dependent', cover: 'Cover change', payment: 'Payment', query: 'Question', salesforce: 'Salesforce fix', reconciled: 'Reconciled', claims: 'Claims', bill: 'Bill' };
  let h = '<h3 class="blsec">Enrolments, terminations and payments <span class="muted small">everything reported, from the bills, the group’s page and this desk</span></h3>';
  if (can) h += '<div class="drawer chg"><b>Record a change</b><div class="grid4"><label class="sel">What <select id="chKind"><option value="joiner">Joiner</option><option value="leaver">Leaver</option><option value="tier">Tier change</option><option value="dependent">Dependent added or removed</option><option value="query">A question</option></select></label>' +
    '<label class="sel">Line <select id="chLine">' + d.lines.map(o => '<option value="' + o.line + '">' + esc(o.label) + '</option>').join('') + '</select></label>' +
    '<label class="sel">Person <input class="field" id="chMember" placeholder="Surname, first name"></label><label class="sel">Effective <input class="field" type="date" id="chEff"></label></div>' +
    '<textarea class="field" id="chDetail" rows="2" maxlength="800" placeholder="What changed, and how we know (who told us, when)"></textarea><div class="uprow"><button class="btn" type="button" id="chSave">Record it and open the task</button><button class="btn ghost" type="button" data-form="" data-fkind="" data-fform="change">Change form EB0010: fill from Salesforce and send to EB Customer Care</button><button class="btn ghost" type="button" data-form="" data-fkind="" data-fform="enrol">Enrolment form GIO001</button><button class="btn ghost" type="button" data-form="" data-fkind="" data-fform="easi">EASI Collect (claim payment account)</button><span class="small muted">A joiner or leaver opens a Salesforce task for the account owner and goes on the billing task’s Chatter.</span></div></div>';
  if (!C.length) return h + '<p class="muted">Nothing recorded yet.</p>';
  return h + '<div class="scroll"><table class="t"><thead><tr><th>When</th><th>Line</th><th>What</th><th>Who</th><th>Detail</th><th>From</th><th>Status</th></tr></thead><tbody>' +
    C.map(c => '<tr><td class="small">' + esc(c.at) + '</td><td>' + esc(BL_LABEL[c.line] || c.line) + '</td><td><b>' + esc(K[c.kind] || c.kind) + '</b></td><td>' + esc(c.member) + '</td><td class="small">' + esc(c.detail) + (c.effective ? ' · ' + esc(dmy(c.effective)) : '') + (c.task ? ' · <span class="chip good"><i></i>task</span>' : '') + (c.note ? ' · ' + esc(c.note) : '') + '</td><td class="small">' + esc(c.source) + (c.by ? ' · ' + esc(c.by) : '') + '</td><td><span class="chip' + (c.status === 'open' ? ' warn' : c.status === 'done' ? ' good' : '') + '"><i></i>' + esc(c.status) + '</span>' + (can && c.member && /^(joiner|leaver|dependent|tier|address|beneficiary|bank|plan)$/.test(c.kind) && !/^form:/.test(c.note || '') ? ' <button class="lnk" type="button" data-form="' + esc(c.member) + '" data-fkind="' + esc({ leaver: 'terminate', dependent: 'adddep', address: 'address', beneficiary: 'beneficiary', bank: 'bank', tier: 'plan' }[c.kind] || 'terminate') + '">Form</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>';
}

/* ── tasks: a visible place to comment on each one, and a guided way to open one ── */
/* 24 October 2026, after the first sample: "NOT SEEing the place for comment … can the person open a task? and assign to
 * the owner with guided prompts?". Every open billing task sits under its own line with a comment box, one-tap prompts, and
 * a tick that @mentions and e-mails whoever has it. "Open a task" on every finding, on every line and at the foot opens a
 * four-step panel: what it is about, who should act (the account owner first), by when, and what they need to know, with
 * the subject in the branch's pattern and a note template whose [blanks] must be filled before it goes. */
const BL_TASKS = {
  joiner:     { label: 'A member to add', subj: '{line} Member Enrolment – {member} – {group}{eff}', days: 2,
                ask: ['Who is joining: full name and employee or certificate number', 'From when, and their tier (and dependents, if any)', 'Where you saw it: the bill, the group’s page, an e-mail', 'What you want done: add the record, confirm with Head Office'],
                text: 'Please add {member} (employee no. [number]) to {line} from {date}, tier [tier]. Seen on the {month} bill. Confirm when the record is in Salesforce.' },
  leaver:     { label: 'A termination', subj: '{line} Termination – {member} – {group}{eff}', days: 2,
                ask: ['Who left: full name and employee or certificate number', 'The last day covered', 'Where you saw it: the bill’s credit, the group, an e-mail', 'What you want done: end the record, confirm the credit'],
                text: 'Please terminate {member} (employee no. [number]) on {line} as at {date}. Seen on the {month} bill as a credit of TT${amount}. Confirm when the record is ended in Salesforce.' },
  tier:       { label: 'A tier or cover change', subj: '{line} Tier Change – {member} – {group}{eff}', days: 2,
                ask: ['Who, and their employee or certificate number', 'From which tier to which, and from when', 'Who asked for it, and when', 'What you want done'],
                text: 'Please change {member} (employee no. [number]) from [old tier] to [new tier] on {line} from {date}, as [who] asked on [date]. Confirm the new premium.' },
  dependent:  { label: 'A dependent added or removed', subj: '{line} Dependent Change – {member} – {group}{eff}', days: 2,
                ask: ['The employee, and the dependent’s name', 'Added or removed, and from when', 'Who told us, and when'],
                text: 'Please [add/remove] the dependent [dependent name] for {member} (employee no. [number]) on {line} from {date}. Told to us by [who] on [date].' },
  payment:    { label: 'A payment to trace', subj: '{line} Payment Query – {group} – {month}', days: 2,
                ask: ['The amount and the date the group says it paid', 'How it was paid (wire, online, cheque) and the reference', 'Which month it is for', 'What you want done: find it, key it, or ask Head Office'],
                text: 'The group reports TT${amount} paid on [date] by [how], reference [ref], for [month], which is not showing on the {line} account. Please trace it with Head Office and key it on Payments once found.' },
  amount:     { label: 'An amount to correct', subj: '{line} Billing Correction – {group} – {month}', days: 2,
                ask: ['What the bill says, and what Salesforce says', 'Which is right, and how you know', 'What you want corrected, and by whom'],
                text: 'The {month} {line} bill shows TT$[bill amount]; Salesforce shows TT$[salesforce amount]. The bill is right because [why]. Please correct [the record / the bill] and confirm.' },
  backcharge: { label: 'A back-charge or credit to query', subj: '{line} Adjustment Query – {member} – {group} – {month}', days: 3,
                ask: ['The member and the amount of the adjustment', 'The months it covers', 'Why it looks wrong, or what is not on file', 'What you want from Head Office'],
                text: 'The {month} {line} bill carries a [back-charge/credit] of TT${amount} for {member} covering [months]. Nothing on file asked for it. Please query it with Head Office and confirm whether it stands.' },
  rate:       { label: 'A rate query', subj: '{line} Rate Query – {group} – {month}', days: 3,
                ask: ['Which rate or member premium does not match', 'What the bill charges and what the rate should give', 'What you want checked'],
                text: 'On the {month} {line} bill, [member or tier] is charged TT$[charged] where the rate gives TT$[expected]. Please check it with Head Office and confirm the right premium.' },
  group:      { label: 'Something to ask the group', subj: '{line} Billing – {group} – query to the group – {month}', days: 2,
                ask: ['What we need from the group', 'Why: what on the bill or the record prompted it', 'By when'],
                text: 'Please ask {group} for [what we need], because [why]. We need it by [date] so the {month} {line} bill can be reconciled.' },
  other:      { label: 'Something else', subj: '{line} Billing – {group} – {month}', days: 2,
                ask: ['What it is about', 'What you want done, and by when', 'What the person needs to know to do it'],
                text: '[What it is about]. Please [what you want done] by [date]. [What they need to know].' },
  /* the people on the bills (the Billings door, 25 October 2026): a member turning 65, a dependant reaching the dependant age, a record to put right */
  convert:    { label: 'A member turning 65: convert', subj: '{line} Conversion at 65 – {member} – {group}{eff}', days: 5,
                ask: ['Who, and their employee or certificate number', 'The date they turn 65', 'Whether the member has been written to, and how to reach them', 'What you want done: a licensed agent to call with the individual plan options'],
                text: '{member} (employee no. [number]) on {line} turns 65 on {date}, when the group cover ends. Please have a licensed agent call them about converting to an individual plan without a break in cover. Contact: [phone or e-mail]. Confirm when the call is made.' },
  depage:     { label: 'A dependant coming of age', subj: '{line} Dependant Reaching Age Limit – {member} – {group}{eff}', days: 5,
                ask: ['The employee, and the dependant’s name', 'The date the dependant reaches the dependant age', 'Whether the employee has been told, and how to reach them', 'What you want done: offer the dependant a plan of their own, and end the dependant cover on the record'],
                text: 'The dependant [dependant name] of {member} (employee no. [number]) on {line} reaches the dependant age on {date}. Please contact the employee about a plan of their own for the dependant, and end the dependant cover on the record from that date. Contact: [phone or e-mail].' },
  data:       { label: 'A record to put right', subj: '{line} Record Update – {member} – {group}', days: 3,
                ask: ['Who, and their employee or certificate number', 'What is missing or wrong on the record (date of birth, dependants, tier)', 'Where the right information comes from: the group, the bill, the enrolment form', 'What you want done'],
                text: 'The Salesforce record for {member} (employee no. [number]) on {line} needs [what is missing or wrong]. The bill shows [what the bill shows]. Please get it from [the group / the enrolment form] and update the record. Confirm when done.' }
};
const blCmt = month => ['Chased Head Office on [what]; they will answer by [date].', 'The group confirms TT$[amount] paid on [date] by [how], ref [ref]; to be keyed on Payments.', 'Waiting on the group for [what]; chasing again on [date].',
  'Corrected in Salesforce: [what was changed].', 'Checked against the ' + blMon(month) + ' bill: [what agrees, and what differs].', 'Can you confirm [what] by [date]? The ' + blMon(month) + ' bill waits on it.'];
const blBlank = s => /\[[^\]\n]{1,40}\]/.test(String(s || ''));
const blWorkDays = n => { const d = new Date(); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++; } return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
/** Which kind of task a finding most likely wants. */
function blKindOf(f) {
  if (f.data && f.data.kind && BL_TASKS[f.data.kind]) return f.data.kind;
  if (f.action === 'payment') return 'payment';
  if (f.action === 'sfAmount' || f.action === 'sfWrite') return 'amount';
  if (/back-?charge|credit|adjust/i.test(f.text) && f.who !== 'salesforce') return 'backcharge';
  if (/\brate\b|31-day|31 day/i.test(f.text)) return 'rate';
  if (f.who === 'group') return 'group';
  if (f.who === 'headoffice') return 'amount';
  if (f.who === 'salesforce' && /not in Salesforce/i.test(f.text)) return 'joiner';
  if (f.who === 'salesforce' && /not on the bill/i.test(f.text)) return 'leaver';
  return 'other';
}
function blTaskCard(t) {
  const d = BILL, can = d.canAct !== false;
  return '<div class="item' + (t.late ? ' late' : /waiting/i.test(t.status) ? ' wait' : '') + '" id="task-' + esc(t.id) + '"><h4>' + esc(t.title) + '</h4><div class="meta"><b>' + esc(t.owner || '–') + '</b> has it · opened ' + esc(dmy(t.opened)) + ' (<b>' + t.age + ' days</b>) · due ' + (t.due ? esc(dmy(t.due)) + (t.late ? ' <b style="color:var(--badText)">past target</b>' : '') : 'not set') + ' · ' + esc(t.status) + (t.ref ? ' · ' + esc(t.ref) : '') + '</div>' +
    (t.story ? '<div class="story"><b>Why it is still open:</b> ' + esc(t.story.why) + '</div>' : '') +
    '<div class="posts">' + (t.posts.length ? t.posts.map(p => '<div class="post"><span class="who">' + esc(p.by) + '</span> <span class="muted">' + esc(p.when) + '</span>\n' + esc(p.text) + (p.replies || []).map(r => '\n  ↳ ' + esc(r.by) + ': ' + esc(r.text)).join('') + '</div>').join('') : '<div class="small muted">No Chatter on this task yet.</div>') +
    '<div class="cmtrow"><div class="cmtlab">Comment on this task <span class="muted small">· one tap fills it, then change the [blanks]</span></div><div class="chips tpl">' + blCmt(d.month).map(x => '<button type="button" class="chip" data-tpl="' + esc(t.id) + '" data-text="' + esc(x) + '">' + esc(x.replace(/\s*\[.*$/, '').replace(/[:;,]$/, '')) + '…</button>').join('') + '</div>' +
    '<textarea class="field" id="tn-' + esc(t.id) + '" rows="2" maxlength="2000" placeholder="What is happening with it, or a question for ' + esc(t.owner || 'whoever has it') + ' · posted to this task’s Chatter"></textarea>' +
    '<div class="uprow"><label class="toggle small"><input type="checkbox" data-notify="' + esc(t.id) + '" checked> Tell ' + esc(t.owner || 'whoever has it') + ': @mention on Chatter and an e-mail from support@</label></div>' +
    '<div class="uprow"><button class="btn sm" type="button" data-tcmt="' + esc(t.id) + '">Comment for the team</button>' + (can && t.shown ? '<button class="btn sm ghost" type="button" data-tnote="' + esc(t.id) + '">Post for the group</button>' : '') + '</div></div></div>';
}
/** The open billing tasks on one line, each with its comment box, and the way to open one. */
function blLineTasks(o) {
  const d = BILL, can = d.canAct !== false, list = d.tasks.filter(t => t.line === o.line);
  let h = '<div class="ltasks" id="tasks-' + o.line + '"><div class="ltt"><h4>Tasks on this line in Salesforce <span class="n">' + list.length + '</span></h4>' + (can ? '<button class="btn sm" type="button" data-task="' + o.line + '">Open a task</button>' : '') + '</div>';
  h += list.length ? '<div class="items">' + list.map(blTaskCard).join('') + '</div>' : '<p class="small muted">No open billing task on this line' + (can ? ': open one for whoever should act, or for the account owner.' : '.') + '</p>';
  return h + '</div>';
}
/** The guided panel. */
function blTaskPanel(line, fid) {
  const d = BILL, o = d.lines.find(x => x.line === line) || d.lines[0], f = fid && o && o.bill ? (o.bill.findings || []).find(x => x.id === fid) : null;
  line = o ? o.line : 'health';
  const people = d.people || [], owner = people.find(p => p.owner), kind0 = f ? blKindOf(f) : 'other', fd = Object.assign({}, (f && f.data) || {});
  if (!fd.name && f && f.members && f.members.length === 1) { fd.name = f.members[0].name; if (fd.amount == null && f.members[0].premium != null) fd.amount = f.members[0].bill != null ? f.members[0].bill : f.members[0].premium; if (!fd.month && f.members[0].start) fd.month = String(f.members[0].start).slice(0, 7); }
  $('dlgT').textContent = 'Open a task · ' + d.group.name;
  $('dlgB').innerHTML = '<div class="tsteps">' +
    '<section class="tstep"><h4><span class="n">1</span>What is it about?</h4><div class="chips kinds" id="tkKinds">' + Object.keys(BL_TASKS).map(k => '<button type="button" class="chip' + (k === kind0 ? ' on' : '') + '" data-kind="' + k + '">' + esc(BL_TASKS[k].label) + '</button>').join('') + '</div>' +
      '<div class="grid4"><label class="sel">Line <select id="tkLine">' + d.lines.map(x => '<option value="' + x.line + '"' + (x.line === line ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select></label>' +
      '<label class="sel">Person, if it is about one member <input class="field" id="tkMember" value="' + esc(fd.name || '') + '" placeholder="Surname, first name"></label><label class="sel">Effective <input class="field" type="date" id="tkEff" value="' + esc(fd.month ? fd.month + '-01' : '') + '"></label><label class="sel">Amount (TT$) <input class="field" type="number" step="0.01" id="tkAmount" value="' + esc(fd.amount != null ? fd.amount : '') + '"></label></div>' +
      '<label class="sel">Subject, in the branch’s pattern <input class="field" id="tkSubject" maxlength="255"></label></section>' +
    '<section class="tstep"><h4><span class="n">2</span>Who should act on it?</h4><select class="field" id="tkTo">' + (people.length ? people.map(p => '<option value="' + esc(p.id) + '"' + (p.owner ? ' selected' : '') + '>' + esc(p.name) + (p.owner ? ' · looks after this account' : p.me ? ' · you' : '') + '</option>').join('') : '<option value="">Nobody with a Salesforce login was found</option>') + '</select>' +
      (owner ? '<p class="small muted">' + esc(owner.name) + ' looks after this account in Salesforce, so the task goes to them unless you pick someone else.</p>' : '<p class="small muted">' + esc(d.group.assigned || 'The account owner') + ' has no active Salesforce login, so the task cannot go to them: pick someone else.</p>') + '</section>' +
    '<section class="tstep"><h4><span class="n">3</span>By when?</h4><div class="uprow"><label class="sel">Due <input class="field" type="date" id="tkDue"></label><label class="sel">Priority <select id="tkPri"><option>Normal</option><option>High</option></select></label><span class="small muted" id="tkDueWhy"></span></div></section>' +
    '<section class="tstep"><h4><span class="n">4</span>What do they need to know?</h4><ul class="ask" id="tkAsk"></ul><textarea class="field" id="tkText" rows="6" maxlength="4000"></textarea>' + (f ? '<p class="small"><b>From the check:</b> ' + esc(f.text) + '</p>' : '') +
      '<p class="small muted">Fill in every [blank]. The task carries your name, the month and the line, goes onto the account in Salesforce, and the person is told by e-mail from support@.</p></section>' +
    '</div><div class="row"><button class="btn" type="button" id="tkGo">Open the task</button><button class="btn ghost" type="button" id="tkCancel">Cancel</button></div>';
  const touched = { subject: false, text: false };
  const fillers = () => ({ line: BL_LABEL[$('tkLine').value] || 'Billing', group: d.group.name, month: blMon(d.month), member: $('tkMember').value.trim() || '[name]', date: $('tkEff').value ? dmy($('tkEff').value) : '[date]', amount: $('tkAmount').value ? Number($('tkAmount').value).toFixed(2) : '[amount]', eff: $('tkEff').value ? ' – effective ' + dmy($('tkEff').value) : '' });
  const fill = s => { const F = fillers(); return s.replace(/\{(\w+)\}/g, (m, k) => F[k] != null ? F[k] : m); };
  const kindNow = () => { const b = $('tkKinds').querySelector('.chip.on'); return b ? b.dataset.kind : 'other'; };
  const draw = () => {
    const K = BL_TASKS[kindNow()];
    if (!touched.subject) $('tkSubject').value = fill(K.subj);
    if (!touched.text) $('tkText').value = fill(K.text) + (f && !/^(joiner|leaver)$/.test(kindNow()) ? '\n\nWhat the check found: ' + f.text : '');
    $('tkAsk').innerHTML = K.ask.map(x => '<li>' + esc(x) + '</li>').join('');
    $('tkDue').value = blWorkDays(K.days); $('tkDueWhy').textContent = K.days + ' working days, as the branch standard; change it if it must be sooner.';
  };
  $('tkKinds').querySelectorAll('.chip').forEach(b => b.onclick = () => { $('tkKinds').querySelectorAll('.chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); touched.subject = false; touched.text = false; draw(); });
  ['tkLine', 'tkMember', 'tkEff', 'tkAmount'].forEach(id => $(id).oninput = $(id).onchange = draw);
  $('tkSubject').oninput = () => touched.subject = true; $('tkText').oninput = () => touched.text = true;
  $('tkCancel').onclick = () => dlg.close();
  draw();
  if (!dlg.open) dlg.showModal();
  $('tkGo').onclick = async () => {
    const subject = $('tkSubject').value.trim(), text = $('tkText').value.trim();
    if (!subject) return toast('The task needs a subject.', true);
    if (blBlank(subject) || blBlank(text)) return toast('Fill in every [blank] first.', true);
    if (text.length < 20) return toast('Say what the person needs to know.', true);
    if (!$('tkTo').value) return toast('Pick who should act on it.', true);
    $('tkGo').disabled = true;
    const r = await post({ action: 'gcm.billAct', group: d.group.key, line: $('tkLine').value, month: d.month, act: 'task', kind: kindNow(), subject, text, to: $('tkTo').value, due: $('tkDue').value, priority: $('tkPri').value, member: $('tkMember').value, effective: $('tkEff').value, amount: $('tkAmount').value, finding: fid || '' });
    $('tkGo').disabled = false;
    toast(r.ok ? r.said : (r.error || 'Not opened'), !r.ok);
    if (r.ok) { dlg.close(); openBilling(d.group.key, d.month); }
  };
}

/* ── the EB0010 change form, filled from Salesforce: search a member, confirm the change, send to EB Customer Care ── */
const BL_FORM_KINDS = [['terminate', 'Terminate the primary insured'], ['adddep', 'Add dependent(s)'], ['removedep', 'Remove dependent(s)'], ['address', 'Change of address'], ['beneficiary', 'Beneficiary change'], ['bank', 'Bank account for claim payments'], ['plan', 'Policy change (plan, deductible, major medical)']];
let BF = null;
const BL_FORMS = [['change', 'Change or terminate', 'EB0010'], ['enrol', 'Enrol a new member', 'GIO001'], ['easi', 'Claim payment account', 'EASI Collect']];
const BL_EASI = [['change', 'Change the account'], ['enrol', 'Enrol an account'], ['terminate', 'End the arrangement']];
const BL_ENR = [
  ['A', 'first', 'First name', 'text'], ['A', 'last', 'Surname', 'text'], ['A', 'dob', 'Date of birth', 'date'], ['A', 'gender', 'Gender', 'select', ['', 'M', 'F'], ['', 'Male', 'Female']],
  ['A', 'email', 'E-mail', 'email'], ['A', 'telCell', 'Cellular', 'tel'], ['A', 'telHome', 'Telephone (home)', 'tel'], ['A', 'telWork', 'Telephone (work)', 'tel'], ['A', 'telExt', 'Ext', 'text'],
  ['A', 'marital', 'Marital status', 'select', ['', 'SINGLE', 'MARRIED', 'COMMON LAW', 'DIVORCED', 'WIDOWED'], ['', 'Single', 'Married', 'Common law', 'Divorced', 'Widowed']], ['A', 'occupation', 'Occupation', 'text'],
  ['A', 'idType', 'Identification', 'select', ['', 'DP', 'PP', 'ID'], ['', 'Driver’s permit', 'Passport', 'ID card']], ['A', 'idNo', 'ID number', 'text'],
  ['A', 'covHealth', 'Group Health', 'check'], ['A', 'covLife', 'Group Life', 'check'], ['A', 'covVoluntary', 'Voluntary Life', 'check'], ['A', 'covDependentLife', 'Dependent Life', 'check'],
  ['B', 'otherPlan', 'Other medical plan?', 'select', ['', 'no', 'yes'], ['', 'No', 'Yes']], ['B', 'otherPlanName', 'Name of that plan', 'text'], ['B', 'otherInsurer', 'Its insurer', 'text'],
  ['E', 'bankAccount', 'Account number', 'text'], ['E', 'bankType', 'Account type', 'select', ['', 'SAVINGS', 'CHEQUING'], ['', 'Savings', 'Chequing']], ['E', 'bankName', 'Bank', 'text'], ['E', 'bankBranch', 'Branch', 'text'],
  ['F', 'employed', 'Date employed', 'date'], ['F', 'confirmed', 'Date of confirmation', 'date'], ['F', 'effective', 'Effective date of coverage', 'date'], ['F', 'tier', 'Coverage tier', 'select', ['', 'SINGLE', 'EMPLOYEE + ONE', 'EMPLOYEE + FAMILY'], ['', 'Single', 'Employee + one', 'Employee + family']], ['F', 'salary', 'Annual salary TT$ (Life)', 'text'],
  ['F', 'policyHealth', 'Policy no. Health', 'text'], ['F', 'policyLife', 'Policy no. Life', 'text']];
const BL_ENR_SEC = { A: 'Section A · the employee', B: 'Section B · co-ordination of benefits', C: 'Section C · dependents', D: 'Section D · beneficiary (Group Life)', E: 'Section E · claim payments', F: 'Section F · policyholder' };
function blFormPanel(q, kind, member, form) {
  const d = BILL;
  BF = { form: BL_FORMS.some(([k]) => k === form) ? form : 'change', q: q || '', kind: kind && BL_FORM_KINDS.some(([k]) => k === kind) ? kind : 'terminate', easiKind: 'change', results: null, pick: null, member: null, pdf: '', missing: [], blocking: [], effective: '', marital: '', reason: '', admin: d.group.contact || '', copyGroup: false, deps: [], bens: [], address: '', bankName: '', bankAccount: '', bankBranch: '', bankType: '', idType: '', idNo: '', deductible: '', major: '', enrol: {}, policies: null };
  blFormTitle();
  blFormDraw();
  if (!dlg.open) dlg.showModal();
  if (BF.q) blFormSearch();
}
function blFormTitle() { const f = BL_FORMS.find(([k]) => k === BF.form); $('dlgT').textContent = (f ? f[2] + ' · ' + f[1] : 'Guardian form') + ' · ' + BILL.group.name; }
function blDepRows(list, label, n, attr, extra) {
  return '<div class="bdeps"><b>' + label + '</b>' + Array.from({ length: n }, (_, i) => { const x = list[i] || {}; return '<div class="bdep' + (extra === 'ben' ? ' ben' : extra === 'country' ? ' wide' : '') + '">' +
    (extra === 'ben' ? '<input class="field" placeholder="Relationship" data-' + attr + '="rel" data-i="' + i + '" value="' + esc(x.rel || '') + '">' : '<select class="field" data-' + attr + '="rel" data-i="' + i + '">' + ['', 'SPOUSE', 'CHILD'].map(r => '<option' + (x.rel === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>') +
    '<input class="field" placeholder="Full name" data-' + attr + '="name" data-i="' + i + '" value="' + esc(x.name || '') + '"><select class="field" data-' + attr + '="gender" data-i="' + i + '"><option value="">M/F</option><option' + (x.gender === 'M' ? ' selected' : '') + '>M</option><option' + (x.gender === 'F' ? ' selected' : '') + '>F</option></select><input class="field" type="date" data-' + attr + '="dob" data-i="' + i + '" value="' + esc(x.dob || '') + '">' +
    (extra === 'ben' ? '<input class="field" placeholder="%" inputmode="numeric" data-' + attr + '="pct" data-i="' + i + '" value="' + esc(x.pct || '') + '">' + (attr === 'fben' ? '<label class="toggle small"><input type="checkbox" data-' + attr + '="remove" data-i="' + i + '"' + (x.remove ? ' checked' : '') + '> remove</label>' : '') : '') +
    (extra === 'country' ? '<input class="field" placeholder="Country of residence" data-' + attr + '="country" data-i="' + i + '" value="' + esc(x.country || 'TRINIDAD AND TOBAGO') + '">' : '') + '</div>'; }).join('') + '</div>';
}
function blFormTail(label) {
  const d = BILL;
  return '<div class="uprow" style="margin-top:8px"><button class="btn ghost" type="button" id="bfPrev">' + (BF.pdf ? 'Update the preview' : 'Preview the form') + '</button>' + (d.group.to && d.group.to.length ? '<label class="toggle small"><input type="checkbox" id="bfCopy"' + (BF.copyGroup ? ' checked' : '') + '> also copy ' + esc(d.group.contact || d.group.to[0]) + '</label>' : '') + '</div>' +
    (BF.pdf ? '<div class="fprev"><div class="small muted">' + label + '. ' + (BF.missing.length ? 'Not given or not on record: ' + esc(BF.missing.join(', ')) + '. ' : '') + (BF.blocking.length ? '<b class="bad">Needed before it goes: ' + esc(BF.blocking.join(', ')) + '.</b> ' : '') + '<a href="data:application/pdf;base64,' + BF.pdf + '" download="guardian-form.pdf">Download the PDF</a></div><div class="pdfv" id="bfFrame"></div>' +
      '<div class="row"><button class="btn" type="button" id="bfSend"' + (BF.blocking.length ? ' disabled' : '') + '>Send to EB Customer Care' + (d.live ? '' : ' (test)') + '</button><button class="btn ghost" type="button" onclick="dlg.close()">Close</button></div></div>' : '');
}
function blFormDraw() {
  const d = BILL, m = BF.pick, deps = (BF.member && BF.member.deps) || [];
  let h = '<div class="bform"><div class="fsw">' + BL_FORMS.map(([k, l, c]) => '<button type="button" class="fswb' + (BF.form === k ? ' on' : '') + '" data-bform="' + k + '"><b>' + l + '</b><span>' + c + '</span></button>').join('') + '</div>' +
    '<p class="small muted">Guardian Life’s own PDF, filled with the record and what you give here. It goes from support@ to ' + esc(d.to || 'EBCustomercare@myguardiangroup.com') + ', copied to sales support and support@' + (d.live ? '' : ' · <b>test mode</b>: to you and the branch, marked TEST') + '.</p>';
  if (BF.form === 'enrol') {
    const e = BF.enrol, sec = {}; BL_ENR.forEach(f => { (sec[f[0]] = sec[f[0]] || []).push(f); });
    const field = ([, id, label, type, vals, labels]) => { const v = e[id] === undefined ? '' : e[id];
      if (type === 'check') return '<label class="toggle small"><input type="checkbox" data-enr="' + id + '"' + (v ? ' checked' : '') + '> ' + label + '</label>';
      if (type === 'select') return '<label class="sel">' + label + ' <select data-enr="' + id + '">' + vals.map((o, i) => '<option value="' + o + '"' + (String(v) === o ? ' selected' : '') + '>' + (labels[i] || o) + '</option>').join('') + '</select></label>';
      return '<label class="sel">' + label + ' <input class="field" type="' + type + '" data-enr="' + id + '" value="' + esc(v) + '"></label>'; };
    ['A', 'B'].forEach(k => { h += '<div class="esec"><b>' + BL_ENR_SEC[k] + '</b><div class="grid4">' + sec[k].filter(f => f[3] !== 'check').map(field).join('') + '</div>' + (sec[k].some(f => f[3] === 'check') ? '<div class="ticks">' + sec[k].filter(f => f[3] === 'check').map(field).join('') + '</div>' : '') + '</div>'; });
    h += '<div class="esec"><b>' + BL_ENR_SEC.C + '</b>' + blDepRows(BF.deps, 'Spouse first, then children (up to five)', 5, 'fdep', 'country') + '</div>';
    h += '<div class="esec"><b>' + BL_ENR_SEC.D + '</b>' + blDepRows(BF.bens, 'Relationship, name, gender, date of birth, share', 3, 'fenb', 'ben') + '</div>';
    ['E', 'F'].forEach(k => { h += '<div class="esec"><b>' + BL_ENR_SEC[k] + '</b><div class="grid4">' + sec[k].map(field).join('') + '</div></div>'; });
    h += '<div class="grid4"><label class="sel">Plan administrator (F) <input class="field" id="bfAdmin" value="' + esc(BF.admin) + '"></label><label class="sel">Note for the cover e-mail <input class="field" id="bfReason" maxlength="300" value="' + esc(BF.reason) + '"></label></div>' + blFormTail('GIO001 as it will go');
    $('dlgB').innerHTML = h + '</div>'; blFormBind(); return;
  }
  h += '<div class="uprow"><input class="field" id="bfq" placeholder="Search the member by name, policy or certificate" value="' + esc(BF.q) + '" style="flex:1;min-width:220px" autocomplete="off"><button class="btn ghost sm" type="button" id="bfGo">Search</button></div><div id="bfres">' + blFormResults() + '</div>';
  if (m) {
    h += '<div class="bpicked"><b>' + esc(m.name) + '</b> · ' + [m.label, m.policy, m.status || (m.live ? 'on the plan' : ''), m.plan].filter(Boolean).map(esc).join(' · ') + (m.dob ? ' · born ' + esc(dmy(m.dob)) : ' · <span class="bad">no date of birth on record</span>') + '</div>';
    if (BF.form === 'easi') {
      h += '<div class="grid4"><label class="sel">What is this <select id="bfEasi">' + BL_EASI.map(([v, l]) => '<option value="' + v + '"' + (v === BF.easiKind ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
        '<label class="sel">Identification (B) <select id="bfIdt">' + [['', ''], ['national', 'National ID card'], ['permit', 'Driver’s permit'], ['passport', 'Passport']].map(([v, l]) => '<option value="' + v + '"' + (BF.idType === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label><label class="sel">ID number <input class="field" id="bfIdn" value="' + esc(BF.idNo) + '"></label></div>';
      if (BF.easiKind !== 'terminate') h += '<div class="grid4"><label class="sel">Bank (C) <input class="field" id="bfBank" value="' + esc(BF.bankName) + '"></label><label class="sel">Branch <input class="field" id="bfBr" value="' + esc(BF.bankBranch) + '"></label><label class="sel">Account number <input class="field" id="bfAcct" inputmode="numeric" value="' + esc(BF.bankAccount) + '"></label><label class="sel">Type <select id="bfBty">' + [['', ''], ['SAVINGS', 'Savings'], ['CHEQUING', 'Chequing']].map(([v, l]) => '<option value="' + v + '"' + (BF.bankType === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label></div>';
      h += '<label class="sel">Note for the cover e-mail (optional) <input class="field" id="bfReason" maxlength="300" value="' + esc(BF.reason) + '"></label>' + blFormTail('EASI Collect as it will go');
    } else {
      h += '<div class="grid4"><label class="sel">The change <select id="bfKind">' + BL_FORM_KINDS.map(([v, l]) => '<option value="' + v + '"' + (v === BF.kind ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
        '<label class="sel">Effective <input class="field" type="date" id="bfEff" value="' + esc(BF.effective) + '"></label>' +
        '<label class="sel">Marital status (A) <select id="bfMar">' + ['', 'SINGLE', 'MARRIED', 'COMMON LAW', 'DIVORCED', 'WIDOWED'].map(x => '<option value="' + x + '"' + (BF.marital === x ? ' selected' : '') + '>' + (x ? x.charAt(0) + x.slice(1).toLowerCase() : 'Not on record') + '</option>').join('') + '</select></label>' +
        '<label class="sel">Plan administrator (F) <input class="field" id="bfAdmin" value="' + esc(BF.admin) + '" placeholder="The group’s administrator"></label></div>';
      if (BF.kind === 'terminate') h += '<p class="small muted">Section A: the member’s record. Section B (ii): ' + (deps.length ? 'the ' + deps.length + ' dependent' + (deps.length === 1 ? '' : 's') + ' on record, removed on the same date' : 'no dependent on record; the cover note says any dependent under the certificate ends with it') + '.</p>';
      if (BF.kind === 'adddep') h += blDepRows(BF.deps, 'Dependent(s) to be covered (Section B)', 4, 'fdep');
      if (BF.kind === 'removedep') h += blDepRows(BF.deps.length ? BF.deps : deps, 'Dependent(s) to be removed (Section B (ii))', 4, 'fdep');
      if (BF.kind === 'address') h += '<label class="sel">New address (Section D) <input class="field" id="bfAddr" maxlength="240" value="' + esc(BF.address) + '"></label>' + (BF.member && BF.member.address ? '<p class="small muted">On file: ' + esc(BF.member.address) + '</p>' : '');
      if (BF.kind === 'beneficiary') h += blDepRows(BF.bens, 'Beneficiary to add (C), or remove (tick)', 3, 'fben', 'ben');
      if (BF.kind === 'bank') h += '<div class="grid4"><label class="sel">Name of bank (E) <input class="field" id="bfBank" value="' + esc(BF.bankName) + '"></label><label class="sel">Account number <input class="field" id="bfAcct" value="' + esc(BF.bankAccount) + '"></label><label class="sel">Branch <input class="field" id="bfBr" value="' + esc(BF.bankBranch) + '"></label></div>';
      if (BF.kind === 'plan') h += '<div class="grid4"><label class="sel">Deductible (D) <select id="bfDed"><option value="">–</option>' + ['$500', '$1,000', '$2,500'].map(x => '<option' + (BF.deductible === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label><label class="sel">Major medical <select id="bfMaj"><option value="">–</option>' + ['Increase $250,000', 'Increase $500,000', 'Increase $1,000,000', 'Decrease $250,000', 'Decrease $500,000', 'Decrease $1,000,000'].map(x => '<option' + (BF.major === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label></div>';
      h += '<label class="sel">Reason, for the cover note (optional) <input class="field" id="bfReason" maxlength="300" value="' + esc(BF.reason) + '"></label>' + blFormTail('EB0010 as it will go');
    }
  }
  $('dlgB').innerHTML = h + '</div>';
  blFormBind();
}
function blFormResults() {
  if (BF.results === 'busy') return '<p class="small muted">Reading Salesforce…</p>';
  if (!BF.results) return '';
  if (!BF.results.length) return '<p class="small muted">No member of this group matches. Try the surname alone.</p>';
  return '<div class="bres">' + BF.results.map(m => '<button type="button" class="bpick' + (BF.pick && BF.pick.id === m.id ? ' on' : '') + '" data-bpick="' + esc(m.id) + '"><b>' + esc(m.name) + '</b><span>' + [m.label, m.policy, m.status || (m.live ? 'on the plan' : ''), m.since ? 'since ' + dmy(m.since) : '', m.deps ? m.deps + ' dependent' + (m.deps === 1 ? '' : 's') + ' on record' : ''].filter(Boolean).map(esc).join(' · ') + '</span></button>').join('') + '</div>' + (BF.results.more ? '<p class="small muted">More match: add another word.</p>' : '');
}
function blFormRead() {
  const g = id => $(id) ? $(id).value.trim() : '';
  if ($('bfKind')) BF.kind = $('bfKind').value;
  if ($('bfEasi')) BF.easiKind = $('bfEasi').value;
  BF.effective = g('bfEff'); BF.marital = g('bfMar'); BF.admin = g('bfAdmin'); BF.reason = g('bfReason'); BF.address = g('bfAddr'); BF.bankName = g('bfBank'); BF.bankAccount = g('bfAcct'); BF.bankBranch = g('bfBr'); BF.bankType = g('bfBty'); BF.idType = g('bfIdt'); BF.idNo = g('bfIdn'); BF.deductible = g('bfDed'); BF.major = g('bfMaj'); BF.copyGroup = $('bfCopy') ? $('bfCopy').checked : false;
  document.querySelectorAll('[data-enr]').forEach(el => { BF.enrol[el.dataset.enr] = el.type === 'checkbox' ? (el.checked ? 'Y' : '') : el.value.trim(); });
  const rows = (attr, n) => { const out = []; for (let i = 0; i < n; i++) { const o = {}; document.querySelectorAll('[data-' + attr + '][data-i="' + i + '"]').forEach(el => { o[el.dataset[attr]] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); if (o.name) out.push(o); } return out; };
  if (document.querySelector('[data-fdep]')) BF.deps = rows('fdep', 5);
  if (document.querySelector('[data-fben]')) BF.bens = rows('fben', 3);
  if (document.querySelector('[data-fenb]')) BF.bens = rows('fenb', 3);
}
function blFormBody(act) {
  const b = { action: 'gcm.billAct', group: BILL.group.key, line: BF.pick ? BF.pick.line : '', month: BILL.month, act, member: BF.pick ? BF.pick.id : '', reason: BF.reason, admin: BF.admin, deps: JSON.stringify(BF.deps), bens: JSON.stringify(BF.bens), copyGroup: BF.copyGroup ? 'Y' : '' };
  if (BF.form === 'enrol') return Object.assign(b, BF.enrol);
  Object.assign(b, { kind: BF.kind, effective: BF.effective, marital: BF.marital, address: BF.address, bankName: BF.bankName, bankAccount: BF.bankAccount, bankBranch: BF.bankBranch, deductible: BF.deductible, major: BF.major });
  if (BF.form === 'easi') Object.assign(b, { easiKind: BF.easiKind, idType: BF.idType, idNo: BF.idNo, bankType: BF.bankType });
  return b;
}
function blFormActs() { return BF.form === 'enrol' ? ['enrol', 'enrolSend'] : BF.form === 'easi' ? ['easi', 'easiSend'] : ['form', 'formSend']; }
async function blFormSearch() {
  BF.q = $('bfq').value.trim(); if (BF.q.length < 2) { BF.results = null; BF.pick = null; blFormDraw(); return; }
  BF.results = 'busy'; $('bfres').innerHTML = blFormResults();
  const r = await post({ action: 'gcm.billAct', group: BILL.group.key, act: 'members', q: BF.q });
  if (!r.ok) { BF.results = []; toast(r.error || 'Not read', true); $('bfres').innerHTML = blFormResults(); return; }
  BF.results = r.members || []; BF.results.more = !!r.more; $('bfres').innerHTML = blFormResults(); blFormBind();
}
async function blFormPreview(quiet) {
  blFormRead();
  const r = await post(blFormBody(blFormActs()[0]));
  if (!r.ok) return toast(r.error || 'Not filled', true);
  if (BF.form === 'change') {
    BF.member = Object.assign({}, r.data.member, { deps: (r.data.kind === 'terminate' ? r.data.removeDeps : []).concat([]), address: r.data.addressOnFile, bens: r.data.bensOnFile });
    if (r.data.kind === 'terminate') BF.member.deps = r.data.removeDeps; else if (!BF.deps.length && r.data.kind === 'removedep') BF.deps = r.data.removeDeps;
  }
  if (r.policies) { BF.policies = r.policies; if (!BF.enrol.policyHealth) BF.enrol.policyHealth = r.policies.health || ''; if (!BF.enrol.policyLife) BF.enrol.policyLife = r.policies.life || ''; }
  BF.pdf = r.pdf || ''; BF.missing = r.missing || []; BF.blocking = r.blocking || []; BILL.live = r.live; BILL.to = r.to;
  if (!BF.pdf) toast(r.pdfError ? 'The PDF could not be filled: ' + r.pdfError : 'The PDF could not be filled', true);
  blFormDraw();
  if (!quiet) { const f = $('bfFrame'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
async function blFormSend() {
  blFormRead();
  if (BF.form === 'change' && !BF.effective) return toast('Give the effective date.', true);
  if (BF.form === 'enrol' && !BF.enrol.effective) return toast('Give the effective date of coverage (Section F).', true);
  if (BF.form !== 'easi' && !BF.admin) return toast('Name the plan administrator for Section F.', true);
  $('bfSend').disabled = true;
  const r = await post(blFormBody(blFormActs()[1]));
  $('bfSend').disabled = false;
  toast(r.ok ? r.said : (r.error || 'Not sent'), !r.ok);
  if (r.ok) { dlg.close(); openBilling(BILL.group.key, BILL.month); }
}
async function blPdfPages(el, b64) {
  el.innerHTML = '<p class="small muted">Drawing the form…</p>';
  try {
    await blScript(BL_LIB.pdf); pdfjsLib.GlobalWorkerOptions.workerSrc = BL_LIB.worker;
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    el.innerHTML = ''; const width = Math.min(el.clientWidth || 700, 900), dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), v0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: width / v0.width * dpr });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.setAttribute('aria-label', 'Page ' + n + ' of the form');
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; el.appendChild(c);
    }
  } catch (e) { el.innerHTML = '<p class="small muted">The preview could not be drawn here; download the PDF above to see it.</p>'; }
}
function blFormBind() {
  const box = $('dlgB');
  box.querySelectorAll('[data-bform]').forEach(b => b.onclick = () => { if (BF.form === b.dataset.bform) return; blFormRead(); const keep = { admin: BF.admin, q: BF.q }; blFormPanel(keep.q, '', null, b.dataset.bform); BF.admin = keep.admin; blFormDraw(); });
  if ($('bfq')) { let t; $('bfq').oninput = () => { clearTimeout(t); t = setTimeout(blFormSearch, 350); }; $('bfq').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); blFormSearch(); } }; }
  if ($('bfGo')) $('bfGo').onclick = blFormSearch;
  box.querySelectorAll('[data-bpick]').forEach(b => b.onclick = () => { BF.pick = BF.results.find(m => m.id === b.dataset.bpick); BF.member = null; BF.pdf = ''; BF.deps = []; BF.bens = []; blFormDraw(); if (BF.form === 'change') blFormPreview(true); });
  if ($('bfKind')) $('bfKind').onchange = () => { blFormRead(); BF.pdf = ''; BF.deps = []; BF.bens = []; blFormDraw(); };
  if ($('bfEasi')) $('bfEasi').onchange = () => { blFormRead(); BF.pdf = ''; blFormDraw(); };
  if ($('bfPrev')) $('bfPrev').onclick = () => blFormPreview(false);
  if ($('bfSend')) $('bfSend').onclick = blFormSend;
  if ($('bfFrame') && BF.pdf) blPdfPages($('bfFrame'), BF.pdf);
}

/* ── reading a file on this device ── */
async function blReadFiles(line, files) {
  const msg = $('upmsg-' + line); if (msg) msg.textContent = 'Reading…';
  const parts = [], names = [], warnings = [], keep = [];
  try {
    for (const f of files) {
      const buf = await f.arrayBuffer(); names.push(f.name);
      keep.push({ name: f.name, type: f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : 'application/octet-stream'), b64: blB64(buf) });
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
        await blScript(BL_LIB.pdf); pdfjsLib.GlobalWorkerOptions.workerSrc = BL_LIB.worker;
        const lines = await BillRead.lines(buf.slice(0));
        const part = BillRead.read(lines);
        if (part.kind === 'unknown') warnings.push(f.name + ': ' + (part.warnings || []).join(' '));
        else parts.push(part);
      } else {
        await blScript(BL_LIB.xlsx);
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
        parts.push(BillRead.sheet(rows));
      }
    }
  } catch (e) { warnings.push(String(e && e.message ? e.message : e)); }
  const c = BillRead.combine(parts);
  let part = line === 'health' ? c.health : line === 'life' ? c.life : c.listbill;
  const other = Object.keys(c).filter(k => c[k] && k !== (line === 'listbill' ? 'listbill' : line));
  if (!part && other.length) warnings.push('This reads as a ' + other.map(k => BL_LABEL[k] || k).join(' and ') + ' document, not ' + BL_LABEL[line] + '. Upload it under that line.');
  BILL_READ[line] = { part: part || null, names, warnings };
  if (part) BILL_FILES[line] = keep;
  if (msg) msg.textContent = '';
  const box = $('preview-' + line); if (box) { box.innerHTML = blPreview(line, BILL_READ[line]); blBindLines(); }
}
function blB64(buf) { let s = '', u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
async function blStore(line, fromSf) {
  const read = BILL_READ[line], bill = fromSf ? null : (read && read.part);
  if (!fromSf && !bill) return toast('Nothing read yet.', true);
  const mi = $('pvm-' + line), month = bill && !bill.month && mi ? mi.value : (bill ? bill.month : BILL.month);
  if (!month) return toast('Which month is this bill for? Choose it first.', true);
  const btn = $('app').querySelector('[data-store="' + line + '"], [data-fromsf="' + line + '"]'); if (btn) { btn.disabled = true; btn.textContent = 'Checking against Salesforce…'; }
  const r = await post({ action: 'gcm.billUpload', group: BILL.group.key, line, month, bill: bill || undefined, fromSalesforce: fromSf ? 'Y' : '', files: read ? read.names.join(', ') : 'built from Salesforce' });
  if (!r.ok) { toast(r.error || 'Not stored', true); if (btn) { btn.disabled = false; btn.textContent = 'Store and check against Salesforce'; } return; }
  delete BILL_READ[line];
  toast(r.said || 'Stored and checked.');
  openBilling(BILL.group.key, month);
}
function blBindLines() {
  const app = $('app');
  app.querySelectorAll('input[type=file][data-line]').forEach(i => i.onchange = () => { if (i.files.length) blReadFiles(i.dataset.line, [...i.files]); });
  app.querySelectorAll('[data-store]').forEach(b => b.onclick = () => blStore(b.dataset.store, false));
  app.querySelectorAll('[data-fromsf]').forEach(b => b.onclick = () => blStore(b.dataset.fromsf, true));
  app.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { delete BILL_READ[b.dataset.cancel]; drawBilling(); });
  app.querySelectorAll('[data-reup]').forEach(b => b.onclick = () => { BILL_READ[b.dataset.reup] = { part: null, names: [], warnings: [], again: true }; drawBilling(); const box = $('preview-' + b.dataset.reup); if (box) box.innerHTML = ''; });
  app.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => blFix(b));
  app.querySelectorAll('[data-resolve]').forEach(b => b.onclick = () => blResolve(b.dataset.line, b.dataset.resolve));
  app.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => blReconcile(b.dataset.rec));
  app.querySelectorAll('[data-send]').forEach(b => b.onclick = () => blSend(b.dataset.send));
  app.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => blApprove(b.dataset.approve));
  app.querySelectorAll('[data-unapprove]').forEach(b => b.onclick = () => blUnapprove(b.dataset.unapprove));
  app.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => blPayment(b.dataset.pay, b.dataset.month, b.dataset.amount));
  const cl = app.querySelector('input[type=file][id^=claims-]'); if (cl) cl.onchange = () => { if (cl.files.length) blClaimsFile(cl.files[0]); };
}
async function blFix(b) {
  const line = b.dataset.line, act = b.dataset.fix;
  b.disabled = true;
  if (act === 'sfAmount' || act === 'sfWrite') {
    const t0 = b.textContent; b.textContent = 'Writing to Salesforce…';
    const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line, month: BILL.month, act });
    toast(r.ok ? r.said : (r.error || 'Not written'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month); else { b.disabled = false; b.textContent = t0; }
  }
}
/** What the bill charged before credits: what the team keys as Group Billing Premiums (health's current month, life's gross). */
function blCharged(line, b) { return line === 'listbill' ? b.due : (b.current || b.due); }
const BL_SFW_HEAD = { created: 'Made in Salesforce from this bill', updated: 'Salesforce brought into line with this bill', same: 'Salesforce already matches this bill', held: 'Salesforce not written yet' };
/** What the upload wrote in Salesforce (27 October 2026): the month's billing record, made or brought into line with the
 *  bill, every field it changed with what it was, and the tasks it opened. One press does it again. */
function blSfwPanel(o) {
  const b = o.bill; if (!b || (o.line !== 'health' && o.line !== 'life')) return '';
  const w = b.sfWrite, can = BILL.canAct !== false, done = w && /^(created|updated|same)$/.test(w.action);
  let h = '<div class="sfw' + (w && w.errors && w.errors.length ? ' err' : done ? ' ok' : '') + '"><div class="sfw-h"><span class="tag">' + (done ? 'Salesforce' : 'Salesforce: to do') + '</span><b>' + esc(w ? (BL_SFW_HEAD[w.action] || 'Salesforce not written') : 'Not written to Salesforce yet') + '</b>' +
    (w && w.name ? ' · ' + (w.url ? '<a href="' + esc(w.url) + '" target="_blank" rel="noopener">' + esc(w.name) + '</a>' : esc(w.name)) : '') + (w && w.by ? ' <span class="small muted">' + esc(w.by) + ', ' + esc(w.at) + '</span>' : '') + '</div>';
  if (w && w.why) h += '<p class="small">' + esc(w.why) + '</p>';
  if (w && w.changed && w.changed.length) h += '<details><summary>' + w.changed.length + ' field' + (w.changed.length === 1 ? '' : 's') + ' written, from the bill</summary><div class="scroll"><table class="t small"><thead><tr><th>Field</th><th>Was</th><th>Now</th></tr></thead><tbody>' +
    w.changed.map(c => '<tr><td>' + esc(c.label) + '</td><td class="muted">' + (w.action === 'created' ? '–' : esc(c.from)) + '</td><td><b>' + esc(c.to) + '</b></td></tr>').join('') + '</tbody></table></div></details>';
  if (w && w.tasks && w.tasks.length) h += '<div class="small sfw-t"><b>' + w.tasks.length + ' task' + (w.tasks.length === 1 ? '' : 's') + ' opened for the account owner</b><ul>' +
    w.tasks.map(t => '<li><span class="tag">' + esc({ leaver: 'Termination', leavers: 'Terminations', tier: 'Tier change', adjust: 'Adjustments' }[t.kind] || 'Task') + '</span>' + (t.url ? '<a href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.subject) + '</a>' : esc(t.subject)) + '</li>').join('') + '</ul></div>';
  if (w && w.skipped && w.skipped.length) h += '<details class="small"><summary>' + w.skipped.length + ' already in Salesforce, not opened again</summary><ul>' + w.skipped.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>';
  if (w && w.errors && w.errors.length) h += '<p class="small bad">' + w.errors.map(esc).join('<br>') + '</p>';
  if (can) h += '<button class="btn sm' + (done ? ' ghost' : '') + '" type="button" data-fix="sfWrite" data-line="' + o.line + '">' + (done ? 'Check Salesforce against the bill again' : 'Bring Salesforce in line with the bill') + '</button>';
  return h + '</div>';
}
async function blResolve(line, id) {
  const note = prompt('What was done, or why this is not a problem?'); if (note == null) return;
  if (!note.trim()) return toast('A note is needed.', true);
  const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line, month: BILL.month, act: 'resolve', finding: id, note });
  toast(r.ok ? 'Resolved.' : (r.error || 'Not resolved'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month);
}
async function blReconcile(line) {
  const o = BILL.lines.find(x => x.line === line);
  const note = prompt('Mark the ' + blMon(BILL.month) + ' ' + o.label.toLowerCase() + ' bill reconciled against Salesforce? Add a note for the task’s Chatter (optional):', ''); if (note == null) return;
  const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line, month: BILL.month, act: 'reconciled', note, force: BILL.role === 'branch' ? 'Y' : '' });
  toast(r.ok ? r.said : (r.error || 'Not reconciled'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month);
}
/* the billing day (24 October 2026; for a few hours on 25 October a Tuesday, then back the same day: "I would leave it for
   the 26th of the month, excepting when it falls on a holiday or a weekend … on the 25th in the afternoon, I get the
   report … at 1 o'clock"): the strip under the title, the Approve button on a reconciled line, and the state once
   approved. The PDF read in this session travels with the approval and waits in the branch's Drive folder for the 10:00 run. */
function blDayStrip(day, live) {
  if (!day) return '';
  const when = day.isDay ? '<b>today, ' + esc(day.label) + '</b>' : '<b>' + esc(day.label) + '</b>' + (day.daysTo ? ' (in ' + day.daysTo + ' day' + (day.daysTo === 1 ? '' : 's') + ')' : '');
  const moved = day.moved ? ' The ' + (day.dayOfMonth || 26) + 'th is a weekend or a public holiday this month, so they go the next working day.' : '';
  const late = day.late && day.run ? ' <b>The billing day has passed:</b> a bill approved now is a late bill and goes on ' + esc(day.runLabel) + '.' : '';
  return '<div class="note info blday"><div><b>The bills go out by themselves on ' + when + '.</b>' + moved + ' Before then, on each line: upload the bill, verify it against Salesforce, fix what is marked fix, mark it reconciled and press <b>Approve</b> with the PDF attached. ' +
    'At ' + (day.reportHour || 13) + ':00 on ' + esc(day.reportLabel ? day.reportLabel.replace(/, \d+:\d+$/, '') : 'the ' + ((day.dayOfMonth || 26) - 1) + 'th') + ' the branch manager has the report of who has worked each group. A line approved after the ' + day.hour + ':00 run goes at ' + day.hour + ':00 the next working day, or when you press Send now. Send now works only on an approved bill, and after the cut-off Approve and Send now each ask why it was not done by ' + day.hour + ':00; at 10:30 on the billing day the branch manager is told which groups had no bill, and asks why.' + late +
    (live ? '' : ' <span class="muted">The bills are in test mode: the run sends each approved bill to its approver and the branch, marked TEST, until the branch manager runs gblGoLive.</span>') +
    (day.drive ? '' : ' <b>The Drive folder is not linked yet</b> (the GCM_FORMS_FOLDER Script property, GROUP-CLIENTS-SETUP.md), so a bill cannot be approved with its PDF yet, and Send now needs an approved bill.') + '</div></div>';
}
function blApproveActs(o, b, s, d) {
  if (!b.reconciledAt || b.sentAt) return '';
  const day = d.day || {};
  if (s.held) return '<span class="chip bad"><i></i>Approved, held at the run: ' + esc(s.held) + '</span><button class="btn ghost" type="button" data-unapprove="' + o.line + '">Cancel the approval</button>';
  if (s.status === 'approved') return '<span class="chip good"><i></i>Approved for ' + esc(blDayLabel(s.approvedFor)) + ' by ' + esc(s.approvedBy) + '</span><button class="btn ghost" type="button" data-unapprove="' + o.line + '">Cancel the approval</button>';
  if (s.status === 'tested') return '<span class="chip"><i style="background:var(--bar)"></i>Went as a test copy in the last run</span><button class="btn" type="button" data-approve="' + o.line + '"' + (day.drive === false ? ' disabled title="The Drive folder is not linked yet: the branch manager sets GCM_FORMS_FOLDER"' : '') + '>Approve for the next run</button>';
  return '<button class="btn" type="button" data-approve="' + o.line + '"' + (day.drive === false ? ' disabled title="The Drive folder is not linked yet: the branch manager sets GCM_FORMS_FOLDER"' : '') + '>Approve for ' + esc(day.run ? blDayLabel(day.run) : day.date || 'the billing day') + '</button>';
}
const BL_DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function blDayLabel(ymd) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ''); if (!m) return ymd || ''; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); const dow = d.getUTCDay() || 7; return BL_DAYS[dow] + ' ' + (+m[3]) + ' ' + BL_MON[+m[2] - 1].slice(0, 3); }
async function blApprove(line, reason) {
  const o = BILL.lines.find(x => x.line === line), files = BILL_FILES[line] || [], day = BILL.day || {};
  const who = BILL.live ? 'the group (' + (BILL.group.contact || BILL.group.to.join(', ')) + ')' : 'you, marked TEST (test mode)';
  const what = 'the ' + blMon(BILL.month) + ' ' + o.label.toLowerCase() + ' bill to go by itself on ' + (day.runLabel || day.label || 'the billing day at 10:00') + ' to ' + who + (files.length ? ', with ' + files.map(f => f.name).join(', ') + ' attached' : ', with NO file attached (upload the PDF again in this session to attach it)');
  /* after the cut-off: why it was not done by then, in the box (it stands for the confirmation) */
  if (reason === undefined && o.cut && o.cut.past) return blLateAsk(o, 'approve', 'Approve ' + what + '.');
  if (reason === undefined && !confirm('Approve ' + what + '?')) return;
  const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line, month: BILL.month, act: 'approve', attachments: files, reason: reason || '', force: BILL.role === 'branch' ? 'Y' : '' });
  if (!r.ok && r.needReason && reason === undefined) return blLateAsk(Object.assign({}, o, { cut: Object.assign({}, o.cut || {}, { day: r.cutoff, label: r.cutoffLabel }) }), 'approve', 'Approve ' + what + '.');
  if (reason !== undefined) { if (!r.ok) return blLateErr(r.error || 'Not approved'); dlg.close(); }
  toast(r.ok ? r.said : (r.error || 'Not approved'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month);
}
async function blUnapprove(line) {
  const o = BILL.lines.find(x => x.line === line);
  if (!confirm('Cancel the approval of the ' + blMon(BILL.month) + ' ' + o.label.toLowerCase() + ' bill? It stays reconciled; nothing goes until it is approved again or sent now.')) return;
  const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line, month: BILL.month, act: 'unapprove' });
  toast(r.ok ? r.said : (r.error || 'Not cancelled'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month);
}
async function blSend(line, reason) {
  const o = BILL.lines.find(x => x.line === line), files = BILL_FILES[line] || [], b = o.bill || {};
  const who = BILL.live ? 'the group (' + (BILL.group.contact || BILL.group.to.join(', ')) + ')' : 'you, marked TEST';
  const what = 'the ' + blMon(BILL.month) + ' ' + o.label.toLowerCase() + ' bill to ' + who + ' from support@' + (files.length ? ', with ' + files.map(f => f.name).join(', ') + ' attached' : b.kept ? ', with the PDF kept at the approval' : ', with no file attached (upload the PDF again in this session to attach it)');
  /* Send now after the cut-off asks why it was not done by then; a reason given at a late approval is offered again */
  if (reason === undefined && !b.sentAt && o.cut && o.cut.missed) return blLateAsk(o, 'send', 'Send ' + what + '.');
  if (reason === undefined && !confirm('Send ' + what + '?')) return;
  const r = await post({ action: 'gcm.billSend', group: BILL.group.key, month: BILL.month, lines: line, attachments: files, reason: reason || '' });
  if (!r.ok && r.needReason && reason === undefined) return blLateAsk(Object.assign({}, o, { cut: Object.assign({}, o.cut || {}, { day: r.cutoff, label: r.cutoffLabel, reason: r.had || '' }) }), 'send', 'Send ' + what + '.');
  if (reason !== undefined) { if (!r.ok) return blLateErr(r.error || 'Not sent'); dlg.close(); }
  toast(r.ok ? r.said : (r.error || 'Not sent'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month);
}
/* Send now (25 October 2026: "staff has to keep send now but has to have the approval and reasons why it was not done at
   the specified cut off time"): the button only on an approved bill, and after the cut-off a box asking why. */
function blSendBtn(o, b, s, d) {
  if (!b.reconciledAt) return '';
  const t = d.live ? '' : ' (test)', why = o.cut && o.cut.reason ? '<span class="chip warn" title="Why it missed the cut-off"><i></i>Late: ' + esc(o.cut.reason) + '</span>' : '';
  if (b.sentAt) return why + '<button class="btn ghost" type="button" data-send="' + o.line + '">Send to the group again' + t + '</button>';
  if (!b.approvedAt) return why + '<span class="small muted blwait">Send now opens once the bill is approved.</span>';
  return why + '<button class="btn' + (s.status === 'approved' ? ' ghost' : '') + '" type="button" data-send="' + o.line + '">Send now' + t + '</button>' +
    (o.cut && o.cut.missed && !o.cut.reason ? '<span class="small muted blwait">' + (d.reasonNeeded === false ? 'It missed the cut-off: a reason is asked, yours is optional' : 'It missed the cut-off: you will be asked why') + '</span>' : '');
}
const BL_LATE_PICKS = ['Head Office’s bill reached us after the cut-off.', 'Salesforce had to be corrected before the bill could go.',
  'We were waiting on the group to confirm a joiner, a leaver or a payment.', 'The bill needed a correction from Head Office before it could go.', 'I was out of office and it was not covered.'];
/** The box: why it was not done by the cut-off, with one-tap starts; it stands for the confirmation. */
function blLateAsk(o, kind, what) {
  const cut = o.cut || {}, opt = BILL.reasonNeeded === false, min = BILL.lateMin || 15;
  const held = o.steps && o.steps.held ? 'It was held at the 10:00 run: ' + o.steps.held + '.' : '';
  const picks = (held ? [held] : []).concat(BL_LATE_PICKS);
  $('dlgT').textContent = (kind === 'send' ? 'Send now' : 'Approve') + ' · after the cut-off';
  $('dlgB').innerHTML = '<p>The ' + esc(blMon(BILL.month)) + ' ' + esc(o.label.toLowerCase()) + ' bill missed the ' + esc((BILL.day && BILL.day.hour) || 10) + ':00 cut-off on <b>' + esc(cut.label ? cut.label.replace(/, \d+:\d+$/, '') : 'the billing day') + '</b>. ' +
    '<b>Why was it not done by then?</b> ' + (opt ? 'As branch manager you may leave this out.' : 'Your reason goes on the bill, its Chatter and to Mr Rampersad.') + '</p>' +
    '<div class="chips tpl" style="margin:0 0 10px">' + picks.map((x, i) => '<button type="button" class="chip" data-lpick="' + i + '">' + esc(x) + '</button>').join('') + '</div>' +
    '<textarea class="field" id="lateWhy" rows="3" maxlength="600" placeholder="What held it up, and what was done about it">' + esc(cut.reason || '') + '</textarea>' +
    '<p class="small muted" id="lateMsg" style="margin:6px 0 10px">' + esc(what) + '</p>' +
    '<div class="row"><button class="btn" type="button" id="lateGo">' + (kind === 'send' ? 'Send now' : 'Approve') + (opt ? '' : ' with this reason') + '</button><button class="btn ghost" type="button" id="lateX">Cancel</button></div>';
  if (!dlg.open) dlg.showModal();
  const box = $('lateWhy');
  $('dlgB').querySelectorAll('[data-lpick]').forEach(b => b.onclick = () => { box.value = picks[+b.dataset.lpick]; box.focus(); });
  $('lateX').onclick = () => dlg.close();
  $('lateGo').onclick = async () => {
    const v = box.value.trim();
    if (!opt && v.length < min) return blLateErr(v ? 'Say a little more: what held it up, and what was done about it.' : 'Say why it was not done by then.');
    if (/\[[^\]]*\]/.test(v)) return blLateErr('Fill in the [blank] first.');
    $('lateGo').disabled = true;
    if (kind === 'send') await blSend(o.line, v); else await blApprove(o.line, v);
    const g = $('lateGo'); if (g) g.disabled = false;
  };
  setTimeout(() => box.focus(), 50);
}
function blLateErr(t) { const m = $('lateMsg'); if (m) { m.textContent = t; m.className = 'small'; m.style.color = 'var(--badText, #B42318)'; } else toast(t, true); }
async function blPayment(line, month, amount) {
  $('dlgT').textContent = 'Record a payment · ' + BILL.group.name;
  $('dlgB').innerHTML = '<div class="grid4"><label class="sel">Line <select id="pLine">' + BILL.lines.map(o => '<option value="' + o.line + '"' + (o.line === line ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select></label>' +
    '<label class="sel">For the month <input class="field" type="month" id="pMonth" value="' + esc(month || BILL.month) + '"></label><label class="sel">Amount (TT$) <input class="field" type="number" step="0.01" id="pAmount" value="' + esc(amount || '') + '"></label><label class="sel">Date paid <input class="field" type="date" id="pDate"></label>' +
    '<label class="sel">How <select id="pMethod"><option>Wire Transfer</option><option>Online</option><option>Cheque</option><option>Cash</option><option>Linx</option></select></label><label class="sel">Bank or reference <input class="field" id="pRef"></label></div>' +
    '<label class="toggle" style="margin:10px 0"><input type="checkbox" id="pSf" checked> Key it in Salesforce as a Payments row on the month’s billing record</label>' +
    '<textarea class="field" id="pNote" rows="2" placeholder="Anything for the task’s Chatter (optional)"></textarea><div class="row"><button class="btn" type="button" id="pGo">Record the payment</button></div>';
  if (!dlg.open) dlg.showModal();
  $('pGo').onclick = async () => {
    $('pGo').disabled = true;
    const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line: $('pLine').value, month: BILL.month, act: 'payment', amount: $('pAmount').value, paidOn: $('pDate').value, method: $('pMethod').value, ref: $('pRef').value, forMonth: $('pMonth').value, toSalesforce: $('pSf').checked ? 'Y' : '', note: $('pNote').value });
    $('pGo').disabled = false;
    toast(r.ok ? r.said : (r.error || 'Not recorded'), !r.ok);
    if (r.ok) { dlg.close(); openBilling(BILL.group.key, BILL.month); }
  };
}
function blBindTasks() {
  const app = $('app');
  const go = async (id, forGroup) => {
    const t = $('tn-' + id); if (!t.value.trim()) return toast('Write it first.', true);
    const n = app.querySelector('[data-notify="' + id + '"]');
    const r = await post({ action: 'gcm.billAct', group: BILL.group.key, act: 'note', task: id, text: t.value, forGroup: forGroup ? 'Y' : '', notify: !forGroup && n && n.checked ? 'Y' : '' });
    toast(r.ok ? (forGroup ? 'Posted to Chatter, and shown to the group.' : (r.said || 'Posted to the task’s Chatter for the team.')) : (r.error || 'Not posted'), !r.ok);
    if (r.ok) openBilling(BILL.group.key, BILL.month);
  };
  app.querySelectorAll('[data-tcmt]').forEach(b => b.onclick = () => go(b.dataset.tcmt, false));
  app.querySelectorAll('[data-task]').forEach(b => b.onclick = () => blTaskPanel(b.dataset.task, b.dataset.f || ''));
  app.querySelectorAll('[data-form]').forEach(b => b.onclick = () => blFormPanel(b.dataset.form, b.dataset.fkind, null, b.dataset.fform || 'change'));
  app.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => { const t = $('tn-' + b.dataset.tpl); if (!t) return; t.value = (t.value.trim() ? t.value.trim() + ' ' : '') + b.dataset.text; t.focus(); const i = t.value.indexOf('['); if (i >= 0) { const j = t.value.indexOf(']', i); t.setSelectionRange(i, j + 1); } });
  app.querySelectorAll('[data-tnote]').forEach(b => b.onclick = () => go(b.dataset.tnote, true));
}
function blBindChanges() {
  const b = $('chSave'); if (!b) return;
  b.onclick = async () => {
    b.disabled = true;
    const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line: $('chLine').value, month: BILL.month, act: 'change', kind: $('chKind').value, member: $('chMember').value, effective: $('chEff').value, detail: $('chDetail').value });
    b.disabled = false;
    toast(r.ok ? r.said : (r.error || 'Not recorded'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month);
  };
}
/* the claims summary: aggregated here by month and division; names never leave the device */
async function blClaimsFile(file) {
  const msg = $('claimsmsg'); if (msg) msg.textContent = 'Reading…';
  try {
    await blScript(BL_LIB.xlsx);
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
    let rows = null;
    for (const n of wb.SheetNames) { const r = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' }); if (r.length && Object.keys(r[0]).some(k => /service date/i.test(k)) && Object.keys(r[0]).some(k => /^paid$/i.test(k))) { rows = r; break; } }
    if (!rows) throw new Error('No sheet with a Service Date and a Paid column was found.');
    const key = (o, re) => { const k = Object.keys(o).find(k => re.test(k)); return k ? o[k] : ''; };
    const agg = {};
    rows.forEach(r => {
      const d = key(r, /service date/i), dt = d instanceof Date ? d : new Date(d); if (isNaN(dt)) return;
      const month = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'), div = String(key(r, /^division$/i) || 'ALL').trim().toUpperCase() || 'ALL', st = String(key(r, /^status$/i) || '').toUpperCase();
      const a = agg[month + '|' + div] = agg[month + '|' + div] || { month, division: div, claims: 0, charge: 0, member: 0, paid: 0 };
      a.claims++; a.charge += Number(key(r, /^charge$/i)) || 0; a.member += Number(key(r, /patient responsibility/i)) || 0;
      if (/PAID|PENDING/.test(st)) a.paid += Number(key(r, /^paid$/i)) || 0;
    });
    const out = Object.values(agg).sort((x, y) => x.month < y.month ? -1 : 1);
    if (msg) msg.textContent = out.length + ' month rows from ' + rows.length + ' claims. Storing…';
    const r = await post({ action: 'gcm.claimsUpload', group: BILL.group.key, rows: out });
    toast(r.ok ? 'Claims experience stored: ' + rows.length + ' claims, as counts and amounts only.' : (r.error || 'Not stored'), !r.ok);
    if (r.ok) openBilling(BILL.group.key, BILL.month);
  } catch (e) { toast(String(e && e.message ? e.message : e), true); if (msg) msg.textContent = ''; }
}
async function blAi() {
  const box = $('blAiBox'), b = $('blAi'); b.disabled = true; b.textContent = 'Reading…';
  box.innerHTML = '<div class="drawer ai"><p class="muted">Reading this month’s billing: the findings as counts, the Salesforce figures, the open tasks…</p></div>';
  const r = await api({ action: 'gcm.billAi', group: BILL.group.key, month: BILL.month });
  b.disabled = false; b.textContent = 'Read this month with AI';
  if (!r.ok) { box.innerHTML = '<div class="note bad">' + esc(r.error) + '</div>'; return; }
  box.innerHTML = '<div class="drawer ai"><h3 style="margin-top:0">Where this month stands <span class="muted small">AI read for staff; no name left this page</span></h3><p>' + esc(r.where) + '</p>' +
    (r.first.length ? '<p><b>First:</b></p><ol>' + r.first.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') + (r.careful ? '<p><b>Careful:</b> ' + esc(r.careful) + '</p>' : '') + (r.say ? '<p><b>To the group:</b> “' + esc(r.say) + '”</p>' : '') + '</div>';
}
/* the board's chip and filter, from gblBoard_'s block on the board answer */
function blBoardChip(g) {
  const b = BOARD && BOARD.billing ? BOARD.billing[g.key] : null;
  if (!BOARD || !BOARD.billing) return '';
  if (!b || !b.lines) return '<div><span class="chip warn"><i></i>Billing: nothing uploaded for ' + esc(blMon(b ? b.month : BOARD.today.slice(0, 7))) + '</span></div>';
  return '<div><span class="chip' + (b.fixes || b.held ? ' bad' : blDone(g) ? ' good' : '') + '"><i></i>Billing ' + esc(blMon(b.month).slice(0, 3)) + ': ' + b.lines + ' line' + (b.lines === 1 ? '' : 's') + (b.fixes ? ' · ' + b.fixes + ' to fix' : '') + (b.checks ? ' · ' + b.checks + ' to confirm' : '') + ' · ' + b.reconciled + ' reconciled' + (b.approved ? ' · ' + b.approved + ' approved' : '') + (b.held ? ' · ' + b.held + ' held' : '') + ' · ' + b.sent + ' sent</span></div>';
}
/* every billed line approved for the run or already sent */
function blDone(g) {
  const b = BOARD && BOARD.billing ? BOARD.billing[g.key] : null;
  return !!(b && b.lines && !b.held && (b.sent + (b.approved || 0)) >= b.lines);
}
function blTodo(g) {
  const b = BOARD && BOARD.billing ? BOARD.billing[g.key] : null;
  return !!(BOARD && BOARD.billing) && (!b || !b.lines || b.fixes > 0 || b.held > 0 || (b.sent + (b.approved || 0)) < b.lines);
}
