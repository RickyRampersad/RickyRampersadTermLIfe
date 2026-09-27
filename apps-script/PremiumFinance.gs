/**
 * Premium Bridge — the backend for the premium financing app at
 * rickyrampersadbranch.com/premium-finance/ (Premium Bridge's own brand).
 *
 * Files each application as a row on the "Premium Finance Applications" tab,
 * e-mails Premium Bridge the whole application, and sends the client a copy of
 * the quote they applied on. No figure is trusted from the page: the
 * instalment, cost and total are worked out again here from the premium,
 * deposit and term, and a row whose numbers disagree is flagged for the
 * officer rather than refused.
 *
 * Its own Apps Script project, never beside Service.gs: both define doGet and
 * doPost, and two in one project means only one of them answers.
 *
 * The tab's header colours are set when the tab is first made; an existing tab
 * keeps whatever it was given, so recolour it by hand after a theme change.
 *
 * Setup
 *   1. In the Sheet that should hold the applications: Extensions → Apps Script,
 *      add this file, set PF.TEAM_TO below.
 *   2. Run pfSetup() once (creates the tab, asks for permissions).
 *   3. Deploy → New deployment → Web app, execute as Me, access Anyone.
 *   4. Put the /exec URL in CONFIG.API_URL in premium-finance/index.html.
 *   Later changes: Deploy → Manage deployments → pencil → New version, so the
 *   /exec URL never changes.
 *
 * The page POSTs text/plain, so Apps Script never gets a CORS preflight.
 */

var PF = {
  TAB: 'Premium Finance Applications',
  TEAM_TO: '',                   // who receives each application; blank = the script owner
  TEAM_CC: '',                   // optional, comma-separated
  NAME: 'Premium Bridge',
  CONTACT: 'support@rickyrampersadbranch.com',   // replies from clients; same as CONFIG.CONTACT_EMAIL on the page, until Premium Bridge has its own mailbox
  LOGO: 'https://rickyrampersadbranch.com/premium-finance/logo.png',   // hosted PNG: Gmail strips SVG
  RATE_MONTHLY: 0.02,            // must match CONFIG.RATE_MONTHLY on the page
  TERMS: [6, 8, 10],
  MIN_PREMIUM: 1000,
  MAX_PREMIUM: 500000,
  SEND_CLIENT_COPY: true
};

var PF_COLS = ['Received', 'Ref', 'Status', 'Name', 'Mobile', 'E-mail', 'ID type', 'ID number',
  'Address', 'Insurer', 'Policy no.', 'Policy type', 'Start / renewal', 'Agent',
  'Premium', 'Deposit', 'Financed', 'Term', 'Plan', 'Rate / month', 'Instalment',
  'Cost of financing', 'Total repayable', 'Policy period', 'Short-rate', 'Refund covers',
  'Pay by', 'Check', 'Officer', 'Note'];

function pfSetup() {
  pfSheet_();
  return 'Premium Finance Applications tab is ready.';
}

function doGet(e) {
  return pfJson_({ ok: true, service: 'premium-finance', version: 1 });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (p.action !== 'apply') return pfJson_({ ok: false, error: 'unknown action' });

    var bad = pfValidate_(p);
    if (bad) return pfJson_({ ok: false, error: bad });

    var calc = pfCalc_(Number(p.premium), Number(p.deposit) || 0, Number(p.term));
    var check = [];
    if (Math.abs(calc.instalment - Number(p.instalment)) > 0.02) check.push('instalment differs from page ($' + p.instalment + ')');
    if (Number(p.premium) > PF.MAX_PREMIUM) check.push('above the online limit: quote by hand');
    if (!p.protected) check.push('refund may not cover the balance: review');

    lock.waitLock(20000);
    var sh = pfSheet_();
    var ref = pfRef_(p.ref, sh);
    sh.appendRow([new Date(), ref, 'New', p.name, "'" + p.phone, p.email, p.idType, "'" + p.idNumber,
      p.address, p.insurer, p.policy, p.policyType, p.policyStart, p.agent,
      calc.premium, calc.deposit, calc.financed, calc.term, p.plan, PF.RATE_MONTHLY, calc.instalment,
      calc.cost, calc.total, p.policyPeriod, p.shortRate ? 'Yes' : 'No', p.protected ? 'Yes' : 'Review',
      p.payMethod, check.join('; '), '', '']);
    lock.releaseLock();

    // The row is filed; from here a failed e-mail must not read as a failed application.
    try { pfMailTeam_(ref, p, calc, check); } catch (e) { console.error('team mail', e); }
    var copy = false;
    if (PF.SEND_CLIENT_COPY) { try { pfMailClient_(ref, p, calc); copy = true; } catch (e) { console.error('client mail', e); } }
    return pfJson_({ ok: true, ref: ref, copy: copy });
  } catch (err) {
    try { lock.releaseLock(); } catch (x) {}
    console.error(err);
    return pfJson_({ ok: false, error: 'server' });
  }
}

/* ---------- helpers ---------- */

function pfCalc_(premium, deposit, term) {
  var r = PF.RATE_MONTHLY, F = pfR2_(premium - deposit);
  var pay = pfR2_(F * r / (1 - Math.pow(1 + r, -term)));
  var bal = F, total = 0;
  for (var m = 1; m <= term; m++) {
    var interest = pfR2_(bal * r), p = pay, principal = pfR2_(p - interest);
    if (m === term) { principal = bal; p = pfR2_(principal + interest); }
    bal = pfR2_(Math.max(0, bal - principal));
    total += p;
  }
  total = pfR2_(total);
  return { premium: pfR2_(premium), deposit: pfR2_(deposit), financed: F, term: term,
           instalment: pay, total: total, cost: pfR2_(total - F) };
}

function pfValidate_(p) {
  if (!p.name || String(p.name).trim().split(/\s+/).length < 2) return 'name';
  if (String(p.phone || '').replace(/\D/g, '').length < 7) return 'phone';
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(p.email || ''))) return 'email';
  if (!p.insurer) return 'insurer';
  var prem = Number(p.premium), dep = Number(p.deposit) || 0;
  if (!(prem >= PF.MIN_PREMIUM)) return 'premium';
  if (dep < 0 || dep >= prem) return 'deposit';
  if (PF.TERMS.indexOf(Number(p.term)) < 0) return 'term';
  return '';
}

function pfSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PF.TAB);
  if (!sh) {
    sh = ss.insertSheet(PF.TAB);
    sh.appendRow(PF_COLS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, PF_COLS.length).setFontWeight('bold').setBackground('#08131C').setFontColor('#7DD3FC');
  }
  return sh;
}

function pfRef_(fromPage, sh) {
  var ref = /^PF-\d{4}-[A-Z0-9]{5}$/.test(String(fromPage || '')) ? String(fromPage) : '';
  if (ref) {
    var last = sh.getLastRow();
    if (last > 1) {
      var refs = sh.getRange(2, 2, last - 1, 1).getValues().map(function (r) { return r[0]; });
      if (refs.indexOf(ref) >= 0) ref = '';
    }
  }
  if (!ref) {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 5; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    ref = 'PF-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMM') + '-' + s;
  }
  return ref;
}

function pfMoney_(n) {
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function pfR2_(n) { return Math.round(n * 100) / 100; }
function pfEsc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function pfMailTeam_(ref, p, c, check) {
  var to = PF.TEAM_TO || Session.getEffectiveUser().getEmail();
  var rows = [
    ['Name', p.name], ['Mobile', p.phone], ['E-mail', p.email], ['ID', p.idType + ' ' + p.idNumber],
    ['Address', p.address], ['Insurer', p.insurer], ['Policy', (p.policy || '-') + ' · ' + p.policyType],
    ['Start / renewal', p.policyStart || '-'], ['Agent', p.agent || '-'],
    ['Premium', pfMoney_(c.premium)], ['Deposit', pfMoney_(c.deposit)], ['Financed', pfMoney_(c.financed)],
    ['Plan', p.plan + ' · ' + c.term + ' × ' + pfMoney_(c.instalment)],
    ['Cost of financing', pfMoney_(c.cost)], ['Total repayable', pfMoney_(c.total)],
    ['Refund covers balance', p.protected ? 'Yes' : 'Review'], ['Pay by', p.payMethod]
  ];
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2530">' +
    '<p><b>New premium financing application ' + pfEsc_(ref) + '</b></p>' +
    (check.length ? '<p style="color:#b23b3b"><b>Check:</b> ' + pfEsc_(check.join('; ')) + '</p>' : '') +
    '<table cellpadding="5" style="border-collapse:collapse">' +
    rows.map(function (r) { return '<tr><td style="color:#6d7682">' + pfEsc_(r[0]) + '</td><td><b>' + pfEsc_(r[1]) + '</b></td></tr>'; }).join('') +
    '</table><p style="color:#6d7682;font-size:12px">Internal: contains client details. Do not forward.</p></div>';
  MailApp.sendEmail({ to: to, cc: PF.TEAM_CC || undefined, replyTo: p.email,
    subject: 'Premium Bridge application ' + ref + ' · ' + p.name + ' · ' + pfMoney_(c.premium),
    htmlBody: html });
}

function pfMailClient_(ref, p, c) {
  var first = String(p.name).trim().split(/\s+/)[0];
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d2530;max-width:560px">' +
    '<table cellpadding="0" cellspacing="0"><tr><td><img src="' + PF.LOGO + '" width="44" height="44" alt="" style="display:block;border-radius:11px"></td>' +
    '<td style="padding-left:10px;font-size:20px;font-weight:800;color:#0B1A26">Premium<span style="color:#0E7490">Bridge</span></td></tr></table>' +
    '<p>Thank you, ' + pfEsc_(first) + '. We have your premium financing application.</p>' +
    '<p style="font-size:18px"><b>Ref ' + pfEsc_(ref) + '</b></p>' +
    '<p>' + pfEsc_(p.plan) + ': ' + c.term + ' monthly instalments of <b>' + pfMoney_(c.instalment) + '</b> on a premium of ' +
    pfMoney_(c.premium) + (c.deposit ? ' (deposit ' + pfMoney_(c.deposit) + ')' : '') +
    '. Cost of financing ' + pfMoney_(c.cost) + ', total repayable ' + pfMoney_(c.total) + '.</p>' +
    '<p><b>What happens next</b><br>We check the policy with ' + pfEsc_(p.insurer) +
    ' and may call you for your ID and the insurer\'s invoice or renewal notice. You then receive your agreement to sign, with our bank details for your instalments.</p>' +
    '<p style="color:#6d7682">Bank details only ever come with your signed agreement. If anyone sends you different account details, do not pay: check with us first.</p>' +
    '<p>Questions, or anything that does not look right: reply to this e-mail or write to <a href="mailto:' + PF.CONTACT + '">' + PF.CONTACT + '</a>.</p>' +
    '<p style="color:#6d7682;font-size:12px">These figures are indicative and subject to approval and verification of the policy. This e-mail is for the addressee only; if it reached you in error, please tell us and delete it.</p></div>';
  MailApp.sendEmail({ to: p.email, subject: 'Your Premium Bridge application ' + ref, htmlBody: html,
    name: PF.NAME, replyTo: PF.CONTACT });
}

function pfJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
