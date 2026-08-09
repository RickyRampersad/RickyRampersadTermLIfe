/**
 * ============================================================
 *  TRAVEL VIP APPLICATIONS — Ricky Rampersad Branch
 * ============================================================
 *  Receives applications from https://rickyrampersadbranch.com/travel
 *  and emails them to Ricky and Kamla, logs them to a Google Sheet,
 *  and sends the client an acknowledgment.
 *
 *  ONE-TIME SETUP
 *  --------------
 *   1. Create a new Google Sheet called "Travel VIP Applications".
 *   2. Extensions → Apps Script → paste this whole file.
 *   3. Fill in CONFIG below (especially KAMLA_EMAIL).
 *   4. Run setup() once and authorise the permissions it asks for.
 *   5. Deploy → New deployment → Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Copy the /exec URL.
 *   6. Paste that URL into CONFIG.API_URL in travel/index.html.
 *
 *  Until step 6 is done the website still works — it falls back to
 *  opening the visitor's own email client with the application
 *  pre-filled. The Apps Script route is better because it captures
 *  every submission even if the visitor abandons their mail app.
 *
 *  SECURITY NOTE
 *  -------------
 *  The website deliberately does NOT collect card numbers, expiry
 *  dates or CVV, and neither does this script. Card data must never
 *  travel by email or sit in a spreadsheet — that breaches PCI-DSS.
 *  Take payment through the VUMI portal or a hosted payment page.
 * ============================================================
 */

var CONFIG = {
  // --- Who receives applications ----------------------------------------
  AGENT_NAME:   'Ricky Rampersad',
  AGENT_EMAIL:  'ricky.rampersad@myguardiangroup.com',
  KAMLA_EMAIL:  '',                    // ← TODO: Kamla's email address
  AGENT_PHONE:  '(868) 678-5921',

  // --- Sheet -------------------------------------------------------------
  SHEET_NAME:   'Applications',

  // --- Client acknowledgment --------------------------------------------
  SEND_CLIENT_ACK: true,
  BRAND_NAME:   'Ricky Rampersad Branch',
  SITE_URL:     'https://rickyrampersadbranch.com/travel/'
};

var HEADERS = [
  'Received', 'Status', 'Applicant', 'Email', 'Mobile', 'Passport', 'DOB', 'Age',
  'Address', 'Trip Type', 'Region', 'Departure', 'Return', 'Days',
  'Max Days/Trip', 'Excess', 'Non-Medical Rider', 'Trip Cancellation Rider',
  'Premium USD', 'Indicative', 'Travellers', 'Other Travellers',
  'Medical Declaration', 'Payment Method', 'Name on Card', 'Best Time',
  'Beneficiary', 'Trips This Year', 'Prepaid Cost Band', 'Pre-existing', 'Priority'
];

/* ══════════════════════════════════════════════════════════════════════
   SETUP
   ══════════════════════════════════════════════════════════════════════ */
function setup() {
  var sheet = getSheet_();
  SpreadsheetApp.getUi().alert(
    'Travel VIP applications are set up.\n\n' +
    'Next: Deploy → New deployment → Web app → Execute as Me, ' +
    'Who has access: Anyone. Then paste the /exec URL into ' +
    'CONFIG.API_URL in travel/index.html.'
  );
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#07131f').setFontColor('#efc24b');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ══════════════════════════════════════════════════════════════════════
   WEB APP ENDPOINTS
   ══════════════════════════════════════════════════════════════════════ */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'travel-vip-applications' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.type !== 'travel-vip-application') {
      throw new Error('Unrecognised payload type: ' + payload.type);
    }

    logToSheet_(payload);
    emailBranch_(payload);
    if (CONFIG.SEND_CLIENT_ACK && payload.applicant && payload.applicant.email) {
      emailClient_(payload);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // Still tell the branch something came in, even if parsing failed.
    try {
      MailApp.sendEmail({
        to: CONFIG.AGENT_EMAIL,
        subject: 'Travel VIP — application FAILED to process',
        body: 'An application could not be processed.\n\nError: ' + err +
              '\n\nRaw payload:\n' + (e && e.postData ? e.postData.contents : '(none)')
      });
    } catch (ignored) {}

    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   SHEET LOGGING
   ══════════════════════════════════════════════════════════════════════ */
function logToSheet_(p) {
  var sheet = getSheet_();
  var a = p.applicant || {};
  var q = p.quote || {};
  var pay = p.payment || {};
  var g = p.guidance || {};
  var others = p.otherTravellers || [];

  var otherText = others.map(function (o) {
    return o.first + ' ' + o.last + ' (DOB ' + o.dob + ', passport ' + o.passport +
           (o.relationship ? ', ' + o.relationship : '') + ')';
  }).join(' | ');

  sheet.appendRow([
    new Date(p.submittedAt || new Date()),
    'New',
    a.firstName + ' ' + a.lastName,
    a.email, a.phone, a.passport, a.dob, a.age,
    [a.address, a.city, a.country].filter(String).join(', '),
    q.tripType, q.region, q.departure, q.returnDate, q.days,
    q.maxDaysPerTrip, q.deductible, q.nonMedicalRider, q.tripCancellationRider,
    q.totalPremiumUSD, q.indicative ? 'Yes' : 'No',
    1 + others.length, otherText,
    p.medicalDeclaration, pay.method, pay.nameOnCard, pay.bestTimeToCall,
    a.beneficiary + (a.beneficiaryRelationship ? ' (' + a.beneficiaryRelationship + ')' : ''),
    g.trips, g.tripCost, g.preEx, g.budget
  ]);
}

/* ══════════════════════════════════════════════════════════════════════
   EMAIL TO THE BRANCH
   ══════════════════════════════════════════════════════════════════════ */
function emailBranch_(p) {
  var a = p.applicant || {};
  var q = p.quote || {};
  var pay = p.payment || {};
  var others = p.otherTravellers || [];

  var name = a.firstName + ' ' + a.lastName;
  var subject = 'VUMI Travel VIP application — ' + name + ' — US$' + Number(q.totalPremiumUSD).toFixed(2);

  var rows = [];
  function row(k, v) { rows.push([k, v == null || v === '' ? '—' : v]); }

  row('Plan', q.product + ' · ' + q.tripType);
  row('Region', q.region);
  if (q.tripType === 'Single Trip') {
    row('Travel dates', q.departure + ' → ' + q.returnDate + ' (' + q.days + ' days)');
  } else {
    row('Start date', q.annualStart);
    row('Max days per trip', q.maxDaysPerTrip);
  }
  row('Excess', q.deductible);
  row('Non-Medical Rider', q.nonMedicalRider);
  row('Trip Cancellation Rider', q.tripCancellationRider);
  row('PREMIUM', 'US$' + Number(q.totalPremiumUSD).toFixed(2) + (q.indicative ? '  ⚠️ INDICATIVE — confirm in the VUMI portal' : ''));

  var travellerRows = '';
  travellerRows += travellerBlock_('Main applicant', {
    first: a.firstName, last: a.lastName, dob: a.dob, age: a.age,
    passport: a.passport, address: [a.address, a.city, a.country].filter(String).join(', '),
    relationship: '', email: a.email, phone: a.phone, nationality: a.nationality
  });
  others.forEach(function (o, i) {
    travellerRows += travellerBlock_('Traveller ' + o.index, o);
  });

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:660px;color:#1a2733">' +
      '<div style="background:#07131f;color:#efc24b;padding:18px 22px;border-radius:10px 10px 0 0">' +
        '<div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#00CFEA">New online application</div>' +
        '<div style="font-size:20px;font-weight:bold;margin-top:4px">VUMI Travel VIP — ' + esc_(name) + '</div>' +
      '</div>' +
      '<div style="border:1px solid #dde5ee;border-top:none;padding:20px 22px;border-radius:0 0 10px 10px">' +

        '<h3 style="margin:0 0 10px;font-size:14px;color:#07131f">Cover applied for</h3>' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
          rows.map(function (r) {
            return '<tr><td style="padding:7px 0;color:#5c7089;width:190px">' + esc_(r[0]) + '</td>' +
                   '<td style="padding:7px 0;font-weight:bold">' + esc_(r[1]) + '</td></tr>';
          }).join('') +
        '</table>' +

        '<h3 style="margin:22px 0 10px;font-size:14px;color:#07131f">Travellers</h3>' +
        travellerRows +

        '<h3 style="margin:22px 0 8px;font-size:14px;color:#07131f">Medical declaration</h3>' +
        '<div style="background:#f5f8fb;border-left:3px solid #00CFEA;padding:11px 14px;font-size:14px;white-space:pre-wrap">' +
          esc_(p.medicalDeclaration || 'None declared') + '</div>' +

        '<h3 style="margin:22px 0 8px;font-size:14px;color:#07131f">Payment</h3>' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
          '<tr><td style="padding:7px 0;color:#5c7089;width:190px">Method</td><td style="padding:7px 0;font-weight:bold">' + esc_(pay.method) + '</td></tr>' +
          '<tr><td style="padding:7px 0;color:#5c7089">Name on card / account</td><td style="padding:7px 0">' + esc_(pay.nameOnCard || '—') + '</td></tr>' +
          '<tr><td style="padding:7px 0;color:#5c7089">Best time to call</td><td style="padding:7px 0">' + esc_(pay.bestTimeToCall) + '</td></tr>' +
        '</table>' +
        '<div style="background:#fff6e6;border:1px solid #f0d090;padding:11px 14px;border-radius:7px;font-size:13px;margin-top:10px">' +
          '🔒 <b>No card details were collected online.</b> Contact the client through the channel above and take payment ' +
          'through the VUMI portal or a hosted payment page. Never accept card numbers by email or WhatsApp.' +
        '</div>' +

        '<div style="margin-top:22px;padding-top:16px;border-top:1px solid #dde5ee;font-size:13px;color:#5c7089">' +
          'Next step: key this into the VUMI agent portal, confirm the real premium, take payment, and send the client their certificate.' +
        '</div>' +
      '</div>' +
    '</div>';

  var to = [CONFIG.AGENT_EMAIL];
  if (CONFIG.KAMLA_EMAIL) to.push(CONFIG.KAMLA_EMAIL);

  MailApp.sendEmail({
    to: to.join(','),
    subject: subject,
    htmlBody: html,
    replyTo: a.email || CONFIG.AGENT_EMAIL,
    name: CONFIG.BRAND_NAME + ' — Travel Quotes'
  });
}

function travellerBlock_(title, t) {
  var bits = [];
  if (t.dob) bits.push('DOB ' + t.dob + (t.age != null ? ' (age ' + t.age + ')' : ''));
  if (t.passport) bits.push('Passport <b>' + esc_(t.passport) + '</b>');
  if (t.nationality) bits.push(esc_(t.nationality));
  if (t.relationship) bits.push(esc_(t.relationship));
  if (t.email) bits.push(esc_(t.email));
  if (t.phone) bits.push(esc_(t.phone));

  return '<div style="border:1px solid #dde5ee;border-radius:8px;padding:12px 14px;margin-bottom:9px">' +
           '<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#00A8C5;font-weight:bold">' + esc_(title) + '</div>' +
           '<div style="font-size:15px;font-weight:bold;margin:3px 0 5px">' + esc_((t.first || '') + ' ' + (t.last || '')) + '</div>' +
           '<div style="font-size:13px;color:#5c7089;line-height:1.7">' + bits.join(' &nbsp;·&nbsp; ') + '</div>' +
           (t.address ? '<div style="font-size:13px;color:#5c7089;margin-top:3px">' + esc_(t.address) + '</div>' : '') +
         '</div>';
}

/* ══════════════════════════════════════════════════════════════════════
   CLIENT ACKNOWLEDGMENT
   ══════════════════════════════════════════════════════════════════════ */
function emailClient_(p) {
  var a = p.applicant || {};
  var q = p.quote || {};

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#1a2733">' +
      '<div style="background:#07131f;padding:22px;border-radius:10px 10px 0 0;text-align:center">' +
        '<div style="color:#efc24b;font-size:19px;font-weight:bold">' + esc_(CONFIG.BRAND_NAME) + '</div>' +
        '<div style="color:#a9bbcf;font-size:13px;margin-top:5px">VUMI® Travel VIP</div>' +
      '</div>' +
      '<div style="border:1px solid #dde5ee;border-top:none;padding:24px 22px;border-radius:0 0 10px 10px">' +
        '<p style="font-size:15px;margin:0 0 14px">Hi ' + esc_(a.firstName) + ',</p>' +
        '<p style="font-size:14px;line-height:1.7;margin:0 0 16px">' +
          'Thank you — we have your travel insurance application and we\'re working on it now. ' +
          'You\'ll hear from us within one working day with your VUMI certificate and payment instructions.' +
        '</p>' +
        '<div style="background:#f5f8fb;border-radius:9px;padding:16px 18px;font-size:14px;line-height:2">' +
          '<b>Your cover</b><br>' +
          esc_(q.tripType) + '<br>' +
          esc_(q.region) + '<br>' +
          (q.tripType === 'Single Trip'
            ? esc_(q.departure) + ' → ' + esc_(q.returnDate) + ' (' + q.days + ' days)<br>'
            : 'From ' + esc_(q.annualStart) + ', up to ' + q.maxDaysPerTrip + ' days per trip<br>') +
          esc_(q.deductible) + ' excess<br>' +
          '<b style="color:#07131f;font-size:17px">US$' + Number(q.totalPremiumUSD).toFixed(2) + '</b>' +
          (q.indicative ? ' <span style="color:#b07d20;font-size:12px">(indicative — confirmed by VUMI)</span>' : '') +
        '</div>' +
        '<div style="background:#fff6e6;border:1px solid #f0d090;padding:12px 15px;border-radius:8px;font-size:13px;line-height:1.7;margin-top:16px">' +
          '⚠️ <b>Your cover is not active yet.</b> It starts once VUMI receives the premium and issues your certificate. ' +
          'If you are travelling within 48 hours, call us on ' + esc_(CONFIG.AGENT_PHONE) + ' so we can push it through immediately.' +
        '</div>' +
        '<p style="font-size:14px;line-height:1.7;margin:18px 0 0">' +
          'Any questions, just reply to this email or call ' + esc_(CONFIG.AGENT_PHONE) + '.' +
        '</p>' +
        '<p style="font-size:14px;margin:16px 0 0">' + esc_(CONFIG.AGENT_NAME) + '<br>' +
          '<span style="color:#5c7089;font-size:13px">' + esc_(CONFIG.BRAND_NAME) + '</span></p>' +
      '</div>' +
      '<div style="text-align:center;font-size:11px;color:#8a9bb0;padding:14px 10px;line-height:1.6">' +
        'VUMI® and Travel VIP® are trademarks of VIP Universal Medical Insurance Group. ' +
        esc_(CONFIG.BRAND_NAME) + ' places this cover as an appointed intermediary and is not the insurer. ' +
        'Cover, benefits and exclusions are governed by the policy wording and certificate issued by VUMI.' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: a.email,
    subject: 'We have your travel insurance application — ' + CONFIG.BRAND_NAME,
    htmlBody: html,
    replyTo: CONFIG.AGENT_EMAIL,
    name: CONFIG.BRAND_NAME
  });
}

/* ══════════════════════════════════════════════════════════════════════
   UTIL
   ══════════════════════════════════════════════════════════════════════ */
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
