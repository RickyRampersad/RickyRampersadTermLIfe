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
  const steps = [['upload', 'Upload'], ['verify', 'Verify'], ['fixed', 'Fix'], ['reconciled', 'Reconcile'], ['sent', 'Send']];
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
      '<div class="tile' + (Math.abs(v) > 0.05 ? ' alert' : '') + '"><b>' + (b.sfRecord ? esc(blMoney(b.sfBilled)) : '–') + '</b><span>in Salesforce' + (b.sfRecord ? (Math.abs(v) > 0.05 ? ' · ' + (v > 0 ? esc(blMoney(v)) + ' too high' : esc(blMoney(-v)) + ' short') : ' · agrees') : ' · no record') + '</span></div></div>' +
      '<p class="small muted">' + (b.ref ? 'Ref ' + esc(b.ref) + ' · ' : '') + (b.dated ? 'dated ' + esc(dmy(b.dated)) + ' · ' : '') + 'uploaded by ' + esc(b.by) + ' ' + esc(b.checkedAt) + (b.files ? ' · ' + esc(b.files) : '') + (b.reconciledAt ? ' · <b>reconciled ' + esc(b.reconciledAt) + ' by ' + esc(b.reconciledBy) + '</b>' : '') + (b.sentAt ? ' · <b>sent ' + esc(b.sentAt) + '</b>' : '') +
      (can && !BILL_READ[o.line] ? ' · <button class="lnk" type="button" data-reup="' + o.line + '">upload again</button>' : '') + '</p>';
    h += blFindings(o);
    if (can) h += '<div class="blacts">' + (!b.reconciledAt ? '<button class="btn' + (s.fixes ? ' ghost' : '') + '" type="button" data-rec="' + o.line + '"' + (s.fixes && d.role !== 'branch' ? ' disabled title="Fix or resolve the findings marked fix first"' : '') + '>Mark reconciled</button>' : '') +
      (b.reconciledAt ? '<button class="btn" type="button" data-send="' + o.line + '">' + (b.sentAt ? 'Send to the group again' : 'Send to the group') + (d.live ? '' : ' (test)') + '</button>' : '') +
      '<button class="btn ghost" type="button" data-pay="' + o.line + '">Record a payment</button></div>';
  }
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
          (f.action === 'task' ? '<button class="btn sm ghost" type="button" data-fix="task" data-line="' + o.line + '" data-f="' + esc(f.id) + '">Open a task for it</button>' : '') +
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
  let h = '<h3 class="blsec">Open billing tasks in Salesforce <span class="muted small">' + d.tasks.length + ' · what is happening with the money, with every Chatter note</span></h3>';
  if (d.feedError) h += '<div class="note bad">Chatter could not be read: ' + esc(d.feedError) + '</div>';
  if (!d.tasks.length) return h + '<p class="muted">No open billing task on this group.</p>';
  return h + '<div class="items">' + d.tasks.map(t => '<div class="item' + (t.late ? ' late' : /waiting/i.test(t.status) ? ' wait' : '') + '"><h4>' + esc(t.title) + '</h4><div class="meta"><b>' + esc(t.owner || '–') + '</b> · opened ' + esc(dmy(t.opened)) + ' (<b>' + t.age + ' days</b>) · due ' + (t.due ? esc(dmy(t.due)) + (t.late ? ' <b style="color:var(--badText)">past target</b>' : '') : 'not set') + ' · ' + esc(t.status) + (t.ref ? ' · ' + esc(t.ref) : '') + '</div>' +
    (t.story ? '<div class="story"><b>Why it is still open:</b> ' + esc(t.story.why) + '</div>' : '') +
    '<div class="posts">' + (t.posts.length ? t.posts.map(p => '<div class="post"><span class="who">' + esc(p.by) + '</span> <span class="muted">' + esc(p.when) + '</span>\n' + esc(p.text) + (p.replies || []).map(r => '\n  ↳ ' + esc(r.by) + ': ' + esc(r.text)).join('') + '</div>').join('') : '<div class="small muted">No Chatter on this task.</div>') +
    '<div class="uprow" style="margin-top:6px"><textarea class="field" id="tn-' + esc(t.id) + '" rows="2" maxlength="2000" placeholder="A comment for the team, posted to this task’s Chatter" style="flex:1;min-width:200px;min-height:44px;padding:8px 10px"></textarea>' +
    '<button class="btn ghost" type="button" data-tcmt="' + esc(t.id) + '">Comment for the team</button>' + (d.canAct !== false && t.shown ? '<button class="btn ghost" type="button" data-tnote="' + esc(t.id) + '">Post for the group</button>' : '') + '</div></div></div>').join('') + '</div>';
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
    '<textarea class="field" id="chDetail" rows="2" maxlength="800" placeholder="What changed, and how we know (who told us, when)"></textarea><div class="uprow"><button class="btn" type="button" id="chSave">Record it and open the task</button><span class="small muted">A joiner or leaver opens a Salesforce task for the account owner and goes on the billing task’s Chatter.</span></div></div>';
  if (!C.length) return h + '<p class="muted">Nothing recorded yet.</p>';
  return h + '<div class="scroll"><table class="t"><thead><tr><th>When</th><th>Line</th><th>What</th><th>Who</th><th>Detail</th><th>From</th><th>Status</th></tr></thead><tbody>' +
    C.map(c => '<tr><td class="small">' + esc(c.at) + '</td><td>' + esc(BL_LABEL[c.line] || c.line) + '</td><td><b>' + esc(K[c.kind] || c.kind) + '</b></td><td>' + esc(c.member) + '</td><td class="small">' + esc(c.detail) + (c.effective ? ' · ' + esc(dmy(c.effective)) : '') + (c.task ? ' · <span class="chip good"><i></i>task</span>' : '') + (c.note ? ' · ' + esc(c.note) : '') + '</td><td class="small">' + esc(c.source) + (c.by ? ' · ' + esc(c.by) : '') + '</td><td><span class="chip' + (c.status === 'open' ? ' warn' : c.status === 'done' ? ' good' : '') + '"><i></i>' + esc(c.status) + '</span></td></tr>').join('') + '</tbody></table></div>';
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
  app.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => blPayment(b.dataset.pay, b.dataset.month, b.dataset.amount));
  const cl = app.querySelector('input[type=file][id^=claims-]'); if (cl) cl.onchange = () => { if (cl.files.length) blClaimsFile(cl.files[0]); };
}
async function blFix(b) {
  const line = b.dataset.line, act = b.dataset.fix;
  b.disabled = true;
  if (act === 'sfAmount') {
    const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line, month: BILL.month, act: 'sfAmount' });
    toast(r.ok ? r.said : (r.error || 'Not set'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month); else b.disabled = false;
  } else if (act === 'task') {
    const o = BILL.lines.find(x => x.line === line), f = o && o.bill.findings.find(x => x.id === b.dataset.f);
    if (!f) return;
    const r = await post({ action: 'gcm.billAct', group: BILL.group.key, line, month: BILL.month, act: 'change', kind: f.data.kind, member: f.data.name, effective: f.data.month ? f.data.month + '-01' : '', detail: 'From the ' + blMon(BILL.month) + ' bill: ' + f.text, amount: f.data.amount });
    toast(r.ok ? 'Recorded' + (r.task ? ', and a Salesforce task is open' : '') + '.' : (r.error || 'Not recorded'), !r.ok);
    if (r.ok) { const r2 = await post({ action: 'gcm.billAct', group: BILL.group.key, line, month: BILL.month, act: 'resolve', finding: f.id, note: 'Task opened' + (r.task ? ' (' + r.task + ')' : '') }); if (r2.ok) openBilling(BILL.group.key, BILL.month); } else b.disabled = false;
  }
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
async function blSend(line) {
  const o = BILL.lines.find(x => x.line === line), files = BILL_FILES[line] || [];
  const who = BILL.live ? 'the group (' + (BILL.group.contact || BILL.group.to.join(', ')) + ')' : 'you, marked TEST';
  if (!confirm('Send the ' + blMon(BILL.month) + ' ' + o.label.toLowerCase() + ' bill to ' + who + ' from support@' + (files.length ? ', with ' + files.map(f => f.name).join(', ') + ' attached' : ', with no file attached (upload the PDF again in this session to attach it)') + '?')) return;
  const r = await post({ action: 'gcm.billSend', group: BILL.group.key, month: BILL.month, lines: line, attachments: files });
  toast(r.ok ? r.said : (r.error || 'Not sent'), !r.ok); if (r.ok) openBilling(BILL.group.key, BILL.month);
}
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
    const r = await post({ action: 'gcm.billAct', group: BILL.group.key, act: 'note', task: id, text: t.value, forGroup: forGroup ? 'Y' : '' });
    toast(r.ok ? (forGroup ? 'Posted to Chatter, and shown to the group.' : 'Posted to the task’s Chatter for the team.') : (r.error || 'Not posted'), !r.ok);
    if (r.ok) openBilling(BILL.group.key, BILL.month);
  };
  app.querySelectorAll('[data-tcmt]').forEach(b => b.onclick = () => go(b.dataset.tcmt, false));
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
  return '<div><span class="chip' + (b.fixes ? ' bad' : b.sent === b.lines ? ' good' : '') + '"><i></i>Billing ' + esc(blMon(b.month).slice(0, 3)) + ': ' + b.lines + ' line' + (b.lines === 1 ? '' : 's') + (b.fixes ? ' · ' + b.fixes + ' to fix' : '') + (b.checks ? ' · ' + b.checks + ' to confirm' : '') + ' · ' + b.reconciled + ' reconciled · ' + b.sent + ' sent</span></div>';
}
function blTodo(g) {
  const b = BOARD && BOARD.billing ? BOARD.billing[g.key] : null;
  return !!(BOARD && BOARD.billing) && (!b || !b.lines || b.fixes > 0 || b.sent < b.lines);
}
