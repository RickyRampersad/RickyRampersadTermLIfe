/**
 * CAREERS INTAKE — webhook for careers/apply.html
 * Ricky Rampersad Branch · Guardian Life of the Caribbean
 *
 * WHAT IT DOES
 *  - Receives one POST per completed branch intake from the careers site
 *  - Appends a flat, readable row to a Google Sheet ("Branch Careers Intake")
 *  - Keeps the full Recruit Tracker record on a second tab, one per candidate
 *  - Emails the BM (cc BMA) a briefing they can read on a phone before calling
 *  - Emails the candidate an acknowledgement carrying their reference code
 *  - Serves a Recruit Tracker import file on demand (see doGet below)
 *
 * SETUP (5 minutes, free, one time)
 *  1. script.google.com -> New project. Delete the sample. Paste this file in.
 *  2. Project Settings -> Script Properties -> add:
 *       EXPORT_KEY  =  any long random string you invent (protects the export URL)
 *     Optional:
 *       BMA_EMAIL   =  the Branch Manager's Assistant's address
 *       BM_EMAIL    =  overrides the default below
 *  3. Deploy -> New deployment -> type: Web app
 *       Execute as: Me      Who has access: Anyone
 *     Deploy, authorise, and copy the /exec URL.
 *  4. Paste that URL into CONFIG.WEBHOOK_URL in careers/apply.html and push.
 *  5. Run testIntake() once from the editor to create the sheet and prove email works.
 *
 * PULLING CANDIDATES INTO THE RECRUIT TRACKER
 *   Open, in a browser:
 *     <your /exec URL>?export=new&key=<EXPORT_KEY>
 *   That returns a JSON file in exactly the shape the tracker's Import button
 *   expects. Save it, hit Import in the tracker, and every candidate arrives
 *   with their name, contact, source, background and five of Form A's eight
 *   rows already filled in. Exported candidates are marked so the next
 *   export=new call only returns ones you have not pulled yet.
 *   Use ?export=all to re-pull everything, or ?export=ref&ref=RRB-XXXXXX for one.
 */

// ============ CONFIG ============
var SHEET_FILE_NAME = 'Branch Careers Intake';
var TAB_INTAKE  = 'Intake';
var TAB_RECORDS = 'Tracker Records';
var DEFAULT_BM_EMAIL = 'Ricky.Rampersad@myguardiangroup.com';
var BRANCH_NAME = "Ricky Rampersad Branch — Chaguanas Regional Centre";

var HEADERS = [
  'Ref', 'Received', 'Name', 'Email', 'Phone', 'Area',
  'Track', 'Age', 'Age band', 'Household status', 'Education',
  'Commitment', 'Can start', 'Vehicle', 'Devices', 'Household backing',
  'Year-1 income needed',
  'Exp: company', 'Exp: years', 'Exp: 12m API', 'Exp: licence', 'Exp: contracted',
  'Exp: portability', 'Exp: why leaving',
  'New: occupation', 'New: years in role', 'New: runway', 'New: why now',
  'Network size', 'Approachable', 'Referral ability',
  'Heard about us', 'Referred by', 'Self-test', 'Candidate note',
  'Consent', 'Pulled into tracker'
];

// ============ ENTRY POINTS ============
function doPost(e) {
  var out = { ok: false };
  try {
    var p = JSON.parse(e.postData.contents);
    if (p.type === 'careers_intake') {
      var url = recordIntake(p);
      try { emailBranch(p, url); } catch (err) { out.emailError = String(err); }
      try { emailCandidate(p); }  catch (err) { out.candidateEmailError = String(err); }
      out.ok = true;
      out.ref = p.ref;
    } else if (p.type === 'test') {
      out.ok = true;
      out.sheet = getSheetFile().getUrl();
    }
  } catch (err) {
    out.error = String(err);
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Serves Recruit Tracker import files. Key-protected — this is candidate data. */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var wanted = params.export || '';
  var key = PropertiesService.getScriptProperties().getProperty('EXPORT_KEY') || '';

  if (!wanted) {
    return ContentService.createTextOutput('Careers intake endpoint is live.')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  if (!key || params.key !== key) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorised' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var bundle = buildExport(wanted, params.ref || '');
  return ContentService.createTextOutput(JSON.stringify(bundle, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ SHEET ============
function getSheetFile() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CAREERS_SHEET_ID');
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_FILE_NAME);
    props.setProperty('CAREERS_SHEET_ID', ss.getId());
  }
  if (!ss.getSheetByName(TAB_INTAKE)) {
    var sh = ss.getSheets()[0];
    sh.setName(TAB_INTAKE);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold').setBackground('#07131f').setFontColor('#00CFEA');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 110);
    sh.setColumnWidth(3, 170);
  }
  if (!ss.getSheetByName(TAB_RECORDS)) {
    var rec = ss.insertSheet(TAB_RECORDS);
    rec.appendRow(['Ref', 'Name', 'Received', 'Tracker record (JSON)']);
    rec.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#07131f').setFontColor('#00CFEA');
    rec.setFrozenRows(1);
  }
  return ss;
}

function recordIntake(p) {
  var ss = getSheetFile();
  var sh = ss.getSheetByName(TAB_INTAKE);
  var c = p.candidate || {}, ex = p.experienced || {}, nw = p.newToIndustry || {},
      pr = p.practical || {}, mk = p.market || {}, src = p.source || {}, q = p.selfAssessment;

  sh.appendRow([
    p.ref, new Date(p.at), c.name, c.email, c.phone, c.area,
    p.track === 'experienced' ? 'Experienced' : 'New to industry',
    c.ageYears, c.ageBand, c.maritalStatus, c.education,
    pr.commitment, pr.startWhen, pr.vehicle, pr.byod, pr.household, pr.incomeTarget,
    ex.company || '', ex.years || '', ex.production || '', ex.licence || '', ex.contracted || '',
    ex.portability || '', ex.whyLeaving || '',
    nw.occupation || '', nw.employmentYears || '', nw.runway || '', nw.whyNow || '',
    mk.networkSize, mk.approachability, mk.referAbility,
    src.referralPath, src.referralName || '',
    q ? (q.score + '/' + (q.of || 5) + ' ' + q.band) : 'not taken',
    p.notes || '', p.consent ? 'Yes' : 'No', ''
  ]);

  if (p.trackerCandidate) {
    ss.getSheetByName(TAB_RECORDS)
      .appendRow([p.ref, c.name, new Date(p.at), JSON.stringify(p.trackerCandidate)]);
  }
  return ss.getUrl();
}

// ============ EXPORT FOR THE RECRUIT TRACKER ============
function buildExport(mode, ref) {
  var ss = getSheetFile();
  var rec = ss.getSheetByName(TAB_RECORDS);
  var intake = ss.getSheetByName(TAB_INTAKE);
  var last = rec.getLastRow();
  var out = [], pulledRefs = [];
  if (last < 2) return { exportedAt: new Date().toISOString(), candidates: [] };

  var rows = rec.getRange(2, 1, last - 1, 4).getValues();
  var pulledCol = HEADERS.indexOf('Pulled into tracker') + 1;
  var intakeRows = intake.getLastRow() > 1
    ? intake.getRange(2, 1, intake.getLastRow() - 1, HEADERS.length).getValues() : [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], rowRef = String(r[0]);
    if (mode === 'ref' && rowRef !== ref) continue;
    if (mode === 'new') {
      var alreadyPulled = false;
      for (var j = 0; j < intakeRows.length; j++) {
        if (String(intakeRows[j][0]) === rowRef && intakeRows[j][pulledCol - 1]) { alreadyPulled = true; break; }
      }
      if (alreadyPulled) continue;
    }
    try { out.push(JSON.parse(r[3])); pulledRefs.push(rowRef); } catch (err) {}
  }

  // Stamp what we just handed over, so export=new stays meaningful
  var stamp = new Date();
  for (var k = 0; k < intakeRows.length; k++) {
    if (pulledRefs.indexOf(String(intakeRows[k][0])) > -1 && !intakeRows[k][pulledCol - 1]) {
      intake.getRange(k + 2, pulledCol).setValue(stamp);
    }
  }

  return { exportedAt: new Date().toISOString(), source: 'Branch careers intake', candidates: out };
}

// ============ EMAILS ============
function bmEmail() {
  return PropertiesService.getScriptProperties().getProperty('BM_EMAIL') || DEFAULT_BM_EMAIL;
}
function bmaEmail() {
  return PropertiesService.getScriptProperties().getProperty('BMA_EMAIL') || '';
}

function emailBranch(p, sheetUrl) {
  var c = p.candidate || {}, ex = p.experienced || {}, nw = p.newToIndustry || {},
      pr = p.practical || {}, mk = p.market || {}, src = p.source || {}, q = p.selfAssessment;
  var isExp = p.track === 'experienced';

  var rows = [
    ['Reference', p.ref],
    ['Track', isExp ? 'Experienced advisor' : 'New to the industry'],
    ['Contact', c.phone + ' &nbsp;·&nbsp; ' + c.email],
    ['Lives', c.area],
    ['Age', c.ageYears + ' (' + c.ageBand + ')'],
    ['Household', c.maritalStatus + ' — backing: ' + pr.household],
    ['Education', c.education],
    ['Commitment', pr.commitment + ' · can start ' + pr.startWhen],
    ['Vehicle / devices', pr.vehicle + ' / ' + pr.byod],
    ['Year-1 income needed', pr.incomeTarget],
    ['Network', mk.networkSize + ' known · approachable ' + mk.approachability + ' · referrals ' + mk.referAbility],
    ['Heard about us', src.referralPath + (src.referralName ? ' — ' + src.referralName : '')],
    ['Self-test', q ? (q.score + '/' + (q.of || 5) + ' — ' + q.band) : 'not taken']
  ];
  if (isExp) {
    rows.splice(2, 0,
      ['Company', ex.company + ' · ' + ex.years],
      ['12-month API', ex.production],
      ['Licence', ex.licence + ' · ' + ex.contracted],
      ['Clients would follow', ex.portability]);
  } else {
    rows.splice(2, 0,
      ['Now doing', nw.occupation + ' · ' + nw.employmentYears],
      ['Runway if slow', nw.runway]);
  }

  var table = '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">';
  for (var i = 0; i < rows.length; i++) {
    table += '<tr>' +
      '<td style="padding:6px 14px 6px 0;color:#666;white-space:nowrap;vertical-align:top">' + rows[i][0] + '</td>' +
      '<td style="padding:6px 0;color:#111"><b>' + (rows[i][1] || '—') + '</b></td></tr>';
  }
  table += '</table>';

  var freeText = isExp ? ex.whyLeaving : nw.whyNow;
  var body =
    '<div style="font-family:Arial,sans-serif;max-width:640px">' +
    '<div style="background:#07131f;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">' +
      '<div style="font-size:11px;letter-spacing:2px;color:#00CFEA;text-transform:uppercase">New branch intake</div>' +
      '<div style="font-size:22px;font-weight:bold;margin-top:4px">' + c.name + '</div>' +
      '<div style="font-size:13px;color:#a9bbcf;margin-top:2px">' + p.ref + '</div>' +
    '</div>' +
    '<div style="border:1px solid #e2e2e2;border-top:none;padding:18px 20px;border-radius:0 0 10px 10px">' +
      table +
      (freeText ? '<div style="margin-top:16px;padding:12px 14px;background:#f6f8fa;border-left:3px solid #00A8C5;border-radius:4px">' +
        '<div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">' +
        (isExp ? 'Why they are looking' : 'Why this, why now') + '</div>' +
        '<div style="font-size:14px;color:#111;white-space:pre-wrap">' + freeText + '</div></div>' : '') +
      (p.notes ? '<div style="margin-top:12px;font-size:13px;color:#444"><b>Their note:</b> ' + p.notes + '</div>' : '') +
      '<div style="margin-top:18px;font-size:12px;color:#666;line-height:1.7">' +
        'Every line above is the candidate&rsquo;s own answer, given before any interview. Nothing here is verified.<br>' +
        (sheetUrl ? 'Full log: <a href="' + sheetUrl + '">' + sheetUrl + '</a>' : '') +
      '</div>' +
    '</div></div>';

  var to = bmEmail();
  var cc = bmaEmail();
  MailApp.sendEmail({
    to: to, cc: cc,
    subject: '[Careers] ' + c.name + ' — ' + (isExp ? 'experienced' : 'new') + ' — ' + p.ref,
    htmlBody: body
  });
}

function emailCandidate(p) {
  var c = p.candidate || {};
  if (!c.email) return;
  var first = String(c.name || '').split(' ')[0];
  MailApp.sendEmail({
    to: c.email,
    subject: 'We have your details — reference ' + p.ref,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:560px;font-size:15px;line-height:1.65;color:#222">' +
      'Dear ' + first + ',<br><br>' +
      'Thank you for your interest in joining the ' + BRANCH_NAME + '.<br><br>' +
      'Your branch reference is <b style="font-size:19px;letter-spacing:2px">' + p.ref + '</b>. ' +
      'Quote it on any call or email with us.<br><br>' +
      '<b>What happens next</b><br>' +
      '1. Complete the official Guardian Life application if you have not already — it is the formal application; this intake is not.<br>' +
      '2. A Recruiting Manager reviews your answers and calls you, normally within 48 hours.<br>' +
      '3. If we both want to continue, you sit a structured first interview and then the POP 7.0 assessment.<br><br>' +
      'You will be told where you stand at each step. If we decide not to proceed, we will tell you that too, and why.<br><br>' +
      'Regards,<br>' + BRANCH_NAME + '<br>' + bmEmail() +
      '</div>'
  });
}

// ============ TEST ============
function testIntake() {
  var sample = {
    type: 'careers_intake', ref: 'RRB-TEST01', at: new Date().toISOString(),
    candidate: { name: 'Test Candidate', email: bmEmail(), phone: '868 000 0000', area: 'Chaguanas',
                 dob: '1990-01-01', ageYears: '36', ageBand: '25 – 44 yrs',
                 maritalStatus: 'Married, with children', education: 'BSc / BA Degree' },
    track: 'inexperienced',
    newToIndustry: { occupation: 'Teacher', employmentYears: '7 years', runway: '6 – 12 months',
                     whyNow: 'This is a test row — delete it.' },
    practical: { commitment: 'full_time', startWhen: 'Immediately', vehicle: 'Yes',
                 byod: 'Yes — both', household: 'Yes — fully behind it', incomeTarget: '12,000/mo' },
    market: { networkSize: '100 – 200', approachability: 'Fairly easily', referAbility: 'Good' },
    source: { referralPath: 'Social media', referralName: '' },
    selfAssessment: { score: 4, of: 5, band: 'strong' },
    notes: '', consent: true, trackerCandidate: null
  };
  var url = recordIntake(sample);
  emailBranch(sample, url);
  Logger.log('Sheet: ' + url);
}
