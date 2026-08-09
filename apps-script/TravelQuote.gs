/**
 * ═══════════════════════════════════════════════════════════════════
 *  TRAVEL INSURANCE — ONLINE APPLICATIONS
 * ═══════════════════════════════════════════════════════════════════
 *  Receives applications from the travel quote site, logs them to a
 *  Google Sheet, emails them to you (and a colleague), and sends the
 *  client an acknowledgment.
 *
 *  ONE-TIME SETUP
 *  ──────────────
 *   1. Create a Google Sheet named e.g. "Travel Applications".
 *   2. Extensions → Apps Script → paste this whole file.
 *   3. Fill in CONFIG below (EMAIL_TO, EMAIL_CC, BRAND, AGENT_CODE).
 *   4. Run setup() once and authorise the permissions.
 *   5. Deploy → New deployment → Web app
 *        Execute as:     Me
 *        Who has access: Anyone
 *      Copy the /exec URL.
 *   6. Paste that URL into CONFIG.API_URL in travel/index.html.
 *
 *  Until step 6, the site still works — it falls back to opening the
 *  visitor's own mail client with the application pre-filled. Wiring
 *  the endpoint is better: every submission is captured even if the
 *  visitor abandons their mail app, and it all lands in the Sheet.
 *
 *  SECURITY
 *  ────────
 *  Neither the website nor this script collects card numbers, expiry
 *  dates or CVV. Card data must never travel by email or sit in a
 *  spreadsheet — that breaches PCI-DSS. Take payment through the
 *  insurer's portal or a hosted payment page.
 * ═══════════════════════════════════════════════════════════════════
 */

var CONFIG = {
  BRAND:       'TravelInsuranceTT',
  EMAIL_TO:    'rampersadricky@gmail.com',
  EMAIL_CC:    'kamla.dookran@myguardiangroup.com',
  PHONE:       '(868) 678-5921',

  INSURER:     'VUMI® Group, I.I.',
  AGENT_CODE:  '222525',                 // your VUMI agent number

  SHEET_NAME:  'Applications',
  SEND_CLIENT_ACK: true
};

var HEADERS = [
  'Received', 'Status', 'Urgent', 'Agent Code', 'Applicant', 'Email', 'Mobile',
  'Passport', 'DOB', 'Age', 'Address', 'City', 'Country',
  'Structure', 'Annual Plan Days', 'Departure', 'Return', 'Days', 'Annual Start',
  'Non-Medical Rider', 'Trip Cancel Rider',
  'Medical US$', 'Set-up US$', 'NM Rider US$', 'TC Rider US$', 'TOTAL US$',
  'Rate Card', 'Travellers', 'Travelling With', 'Health Declaration',
  'Paid By', 'Payment Method', 'Best Time',
  'Read Conditions', 'Declaration OK',
  'Trips/Year', 'Prepaid Band', 'Pre-existing', 'Checked Bags'
];

/* ═════════════════════════ SETUP ═════════════════════════ */
function setup() {
  getSheet_();
  SpreadsheetApp.getUi().alert(
    'Travel applications are set up.\n\n' +
    'Next: Deploy → New deployment → Web app → Execute as: Me, ' +
    'Who has access: Anyone. Then paste the /exec URL into ' +
    'CONFIG.API_URL in travel/index.html.'
  );
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#10312E').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, Math.min(HEADERS.length, 12));
  }
  return sh;
}

/* ═════════════════════ WEB APP ENDPOINTS ═════════════════════ */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'travel-applications' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    if (p.type !== 'travel-application') throw new Error('Unexpected payload type: ' + p.type);

    logRow_(p);
    emailBranch_(p);
    if (CONFIG.SEND_CLIENT_ACK && p.applicant && p.applicant.email) emailClient_(p);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    try {
      MailApp.sendEmail({
        to: CONFIG.EMAIL_TO,
        subject: '⚠️ Travel application FAILED to process',
        body: 'An application could not be processed.\n\nError: ' + err +
              '\n\nRaw payload:\n' + (e && e.postData ? e.postData.contents : '(none)')
      });
    } catch (ignored) {}
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ═════════════════════════ SHEET ═════════════════════════ */
function logRow_(p) {
  var a = p.applicant || {}, q = p.quote || {}, pay = p.payment || {}, ans = p.answers || {};
  var ack = p.acknowledged || {};
  var others = p.otherTravellers || [];

  var othersText = others.map(function (o) {
    return o.first + ' ' + o.last + ' (DOB ' + o.dob + ', passport ' + o.passport + ')';
  }).join(' | ');

  getSheet_().appendRow([
    new Date(p.submittedAt || new Date()),
    'New',
    (pay.urgent && pay.urgent !== 'No') ? 'YES — 48hrs' : '',
    p.agentCode || CONFIG.AGENT_CODE,
    (a.firstName || '') + ' ' + (a.lastName || ''),
    a.email, a.phone, a.passport, a.dob, a.age,
    a.address, a.city, a.country,
    q.structure, q.annualPlanDays, q.departure, q.returnDate, q.days, q.annualStart,
    q.nonMedicalRider, q.tripCancellationRider,
    q.medicalPremium, q.setupFee, q.nonMedicalPremium, q.cancellationPremium, q.totalPremiumUSD,
    q.rateCard,
    1 + others.length, othersText,
    p.medicalDeclaration,
    pay.payer, pay.method, pay.bestTime,
    ack.conditions ? 'YES' : 'no', ack.declaration ? 'YES' : 'no',
    ans.trips, ans.cost, ans.med, ans.bag
  ]);
}

/* ═══════════════════ EMAIL TO THE BRANCH ═══════════════════ */
function emailBranch_(p) {
  var a = p.applicant || {}, q = p.quote || {}, pay = p.payment || {};
  var others = p.otherTravellers || [];
  var name = (a.firstName || '') + ' ' + (a.lastName || '');
  var urgent = pay.urgent && pay.urgent !== 'No';

  var subject = (urgent ? '🔴 URGENT — ' : '') + 'Travel application — ' + name +
                ' — US$' + Number(q.totalPremiumUSD || 0).toFixed(2);

  var rows = [];
  function r(k, v) { rows.push([k, (v === null || v === undefined || v === '') ? '—' : v]); }
  r('Structure', q.structure + (q.annualPlanDays ? ' · up to ' + q.annualPlanDays + ' days per trip' : ''));
  if (q.structure === 'Single trip') r('Travel dates', q.departure + ' → ' + q.returnDate + ' (' + q.days + ' days)');
  else r('Cover starts', q.annualStart);
  r('Non-medical rider', q.nonMedicalRider);
  r('Trip cancellation rider', q.tripCancellationRider);
  r('Medical premium', 'US$' + Number(q.medicalPremium || 0).toFixed(2));
  if (q.setupFee) r('Set-up fee', 'US$' + Number(q.setupFee).toFixed(2));
  if (q.nonMedicalPremium) r('Non-medical rider', 'US$' + Number(q.nonMedicalPremium).toFixed(2));
  if (q.cancellationPremium) r('Cancellation rider', 'US$' + Number(q.cancellationPremium).toFixed(2));
  r('TOTAL', 'US$' + Number(q.totalPremiumUSD || 0).toFixed(2));
  r('Rate card used', q.rateCard);
  r('Agent code', p.agentCode || CONFIG.AGENT_CODE);

  var people = travellerCard_('Main traveller', {
    first: a.firstName, last: a.lastName, dob: a.dob, age: a.age, passport: a.passport,
    email: a.email, phone: a.phone,
    address: [a.address, a.city, a.country].filter(String).join(', ')
  });
  others.forEach(function (o) { people += travellerCard_('Traveller ' + o.index, o); });

  var ack = p.acknowledged || {};

  var html =
  '<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:660px;color:#10312E">' +
    (urgent ? '<div style="background:#D9503A;color:#fff;padding:12px 18px;border-radius:9px;font-weight:bold;margin-bottom:14px">🔴 Client is travelling within 48 hours — prioritise this one.</div>' : '') +
    '<div style="background:#10312E;padding:20px 24px;border-radius:11px 11px 0 0">' +
      '<div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#7FD4BE;font-weight:bold">New online application</div>' +
      '<div style="font-size:21px;font-weight:bold;color:#fff;margin-top:5px">' + esc_(name) + '</div>' +
    '</div>' +
    '<div style="border:1px solid #E4DACA;border-top:none;padding:22px 24px;border-radius:0 0 11px 11px;background:#fff">' +

      '<h3 style="margin:0 0 12px;font-size:14px">Cover applied for</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
        rows.map(function (x) {
          var strong = x[0] === 'TOTAL';
          return '<tr><td style="padding:7px 0;color:#4A625E;width:200px' + (strong ? ';font-weight:bold' : '') + '">' + esc_(x[0]) + '</td>' +
                 '<td style="padding:7px 0;font-weight:bold' + (strong ? ';font-size:17px;color:#0F6F5C' : '') + '">' + esc_(x[1]) + '</td></tr>';
        }).join('') +
      '</table>' +

      '<h3 style="margin:24px 0 12px;font-size:14px">Travellers</h3>' + people +

      '<h3 style="margin:24px 0 9px;font-size:14px">Health declaration</h3>' +
      '<div style="background:#F4EDE3;border-left:3px solid #0F6F5C;padding:12px 15px;font-size:14px;white-space:pre-wrap;border-radius:0 7px 7px 0">' +
        esc_(p.medicalDeclaration || 'None declared') + '</div>' +

      '<h3 style="margin:24px 0 9px;font-size:14px">Payment</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
        '<tr><td style="padding:7px 0;color:#4A625E;width:200px">Paid by</td><td style="padding:7px 0;font-weight:bold">' + esc_(pay.payer) + '</td></tr>' +
        '<tr><td style="padding:7px 0;color:#4A625E">Preferred method</td><td style="padding:7px 0;font-weight:bold">' + esc_(pay.method) + '</td></tr>' +
        '<tr><td style="padding:7px 0;color:#4A625E">Best time to call</td><td style="padding:7px 0">' + esc_(pay.bestTime) + '</td></tr>' +
      '</table>' +

      '<div style="background:' + (ack.conditions && ack.declaration ? '#E4F0EB' : '#FBEAE5') + ';padding:11px 15px;border-radius:8px;font-size:13px;margin-top:11px">' +
        (ack.conditions && ack.declaration ? '✓' : '⚠') + ' Client ticked <b>read the five conditions</b>: ' +
        (ack.conditions ? 'YES' : 'NO') + ' &nbsp;·&nbsp; <b>declaration confirmed</b>: ' + (ack.declaration ? 'YES' : 'NO') +
        '<br><span style="color:#4A625E">Recorded at ' + esc_(ack.at || p.submittedAt) + '. Keep this email — it is your record that the conditions were shown and accepted.</span>' +
      '</div>' +
      '<div style="background:#FBF0DC;border:1px solid #E8C88A;padding:12px 15px;border-radius:8px;font-size:13px;margin-top:11px">' +
        '🔒 <b>No card details were collected online.</b> Contact the client through the channel above and take payment ' +
        'through the insurer\'s portal or a hosted payment page. Never accept card numbers by email or WhatsApp.' +
      '</div>' +

      '<div style="margin-top:24px;padding-top:17px;border-top:1px solid #E4DACA;font-size:13px;color:#4A625E">' +
        'Next: key this into the insurer\'s portal under agent code <b>' + esc_(p.agentCode || CONFIG.AGENT_CODE) + '</b>, ' +
        'confirm the premium against the current rate table, take payment, and send the client their certificate.' +
      '</div>' +
    '</div>' +
  '</div>';

  var to = [CONFIG.EMAIL_TO];
  if (CONFIG.EMAIL_CC) to.push(CONFIG.EMAIL_CC);

  MailApp.sendEmail({
    to: to.join(','),
    subject: subject,
    htmlBody: html,
    replyTo: a.email || CONFIG.EMAIL_TO,
    name: CONFIG.BRAND + ' — Applications'
  });
}

function travellerCard_(title, t) {
  var bits = [];
  if (t.dob) bits.push('DOB ' + esc_(t.dob) + (t.age != null ? ' (age ' + t.age + ')' : ''));
  if (t.passport) bits.push('Passport <b>' + esc_(t.passport) + '</b>');
  if (t.email) bits.push(esc_(t.email));
  if (t.phone) bits.push(esc_(t.phone));

  return '<div style="border:1px solid #E4DACA;border-radius:9px;padding:13px 15px;margin-bottom:9px">' +
    '<div style="font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#0F6F5C;font-weight:bold">' + esc_(title) + '</div>' +
    '<div style="font-size:16px;font-weight:bold;margin:4px 0 5px">' + esc_((t.first || '') + ' ' + (t.last || '')) + '</div>' +
    '<div style="font-size:13px;color:#4A625E;line-height:1.7">' + bits.join(' &nbsp;·&nbsp; ') + '</div>' +
    (t.address ? '<div style="font-size:13px;color:#4A625E;margin-top:3px">' + esc_(t.address) + '</div>' : '') +
  '</div>';
}

/* ═══════════════════ CLIENT ACKNOWLEDGMENT ═══════════════════ */
function emailClient_(p) {
  var a = p.applicant || {}, q = p.quote || {};
  var urgent = p.payment && p.payment.urgent && p.payment.urgent !== 'No';

  var html =
  '<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;color:#10312E">' +
    '<div style="background:#10312E;padding:26px;border-radius:11px 11px 0 0;text-align:center">' +
      '<div style="color:#fff;font-size:20px;font-weight:bold">' + esc_(CONFIG.BRAND) + '</div>' +
    '</div>' +
    '<div style="border:1px solid #E4DACA;border-top:none;padding:26px 24px;border-radius:0 0 11px 11px;background:#fff">' +
      '<p style="font-size:16px;margin:0 0 15px">Hi ' + esc_(a.firstName) + ',</p>' +
      '<p style="font-size:15px;line-height:1.7;margin:0 0 18px">' +
        'Thank you — we have your travel insurance application and we\'re working on it now. ' +
        'You\'ll hear back within one working day with your certificate and payment instructions.' +
      '</p>' +
      '<div style="background:#F4EDE3;border-radius:10px;padding:17px 19px;font-size:15px;line-height:2">' +
        '<b>Your cover</b><br>' +
        esc_(q.structure) + (q.annualPlanDays ? ' — up to ' + q.annualPlanDays + ' days per trip' : '') + '<br>' +
        (q.structure === 'Single trip'
          ? esc_(q.departure) + ' to ' + esc_(q.returnDate) + ' (' + q.days + ' days)<br>'
          : 'Starting ' + esc_(q.annualStart) + '<br>') +
        (q.nonMedicalRider === 'Yes' ? 'Non-medical benefits rider included<br>' : '') +
        (q.tripCancellationRider === 'Yes' ? 'Trip cancellation rider included<br>' : '') +
        '<b style="font-size:19px;color:#0F6F5C">US$' + Number(q.totalPremiumUSD || 0).toFixed(2) + '</b>' +
      '</div>' +
      '<div style="background:#FBF0DC;border:1px solid #E8C88A;padding:13px 16px;border-radius:9px;font-size:14px;line-height:1.7;margin-top:17px">' +
        '⏳ <b>You are not covered yet.</b> Cover begins once the premium is received and the insurer issues your certificate. ' +
        (urgent
          ? 'We\'ve flagged your application as urgent and will come back to you as a priority.'
          : 'If your plans change or you need this sooner, call us on ' + esc_(CONFIG.PHONE) + '.') +
      '</div>' +
      '<p style="font-size:15px;line-height:1.7;margin:19px 0 0">' +
        'Any questions, just reply to this email or call ' + esc_(CONFIG.PHONE) + '.' +
      '</p>' +
    '</div>' +
    '<div style="text-align:center;font-size:11.5px;color:#7C918D;padding:16px 12px;line-height:1.65">' +
      'Cover is underwritten by ' + esc_(CONFIG.INSURER) + '. ' + esc_(CONFIG.BRAND) + ' is not the insurer. ' +
      'Cover, benefits, limits and exclusions are governed by the policy wording and the certificate issued by the insurer. ' +
      'This email is not a contract of insurance and does not confirm cover.' +
    '</div>' +
  '</div>';

  MailApp.sendEmail({
    to: a.email,
    subject: 'We have your travel insurance application — ' + CONFIG.BRAND,
    htmlBody: html,
    replyTo: CONFIG.EMAIL_TO,
    name: CONFIG.BRAND
  });
}

/* ═════════════════════════ UTIL ═════════════════════════ */
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
