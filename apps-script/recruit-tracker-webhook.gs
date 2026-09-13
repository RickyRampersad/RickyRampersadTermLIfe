/**
 * RECRUIT TRACKER — Email + Google Sheet webhook
 * Ricky Rampersad's Branch · works with Recruit Tracker build B5+
 *
 * WHAT IT DOES
 *  - Receives a POST from the tracker whenever a candidate's section reaches 100%
 *  - Appends a row to a Google Sheet ("Recruit Tracker Log" — auto-created on first use)
 *  - Emails the candidate, the BMA, the Recruiting Manager, and cc's the BM
 *  - Optional: sends the candidate email THROUGH TalentNest instead of Gmail
 *    (so candidate comms stay on company branding) — see TALENTNEST BRIDGE below.
 *
 * SETUP (5 minutes) — see SETUP-GUIDE.txt in the deploy zip.
 */

// ============ CONFIG ============
var SHEET_FILE_NAME = 'Recruit Tracker Log';   // Google Sheet file (auto-created)
var LOG_TAB = 'Stage Log';

// ============ ENTRY POINT ============
function doPost(e) {
  var out = { ok: false };
  try {
    var p = JSON.parse(e.postData.contents);
    if (p.type === 'test') {
      var sheetUrl = appendRow(['TEST', new Date(), 'Test notification from Recruit Tracker', '', '', '']);
      var to = [p.bmEmail, p.bmaEmail].filter(String).join(',');
      if (to) {
        MailApp.sendEmail({
          to: to,
          subject: 'Recruit Tracker — test notification ✓',
          htmlBody: 'Your Recruit Tracker webhook is working.<br><br>' +
                    'Google Sheet log: <a href="' + sheetUrl + '">' + sheetUrl + '</a>'
        });
      }
      out.ok = true;
    } else if (p.type === 'stage_complete') {
      var sheetUrl2 = '';
      if (p.autoSheet !== false) {
        sheetUrl2 = appendRow([
          p.candidateName, new Date(p.at), p.stageLabel, p.recruitingManager,
          p.agentNumber || '', p.talentNestId || ''
        ]);
      }
      if (p.autoEmail !== false) {
        sendStageEmails(p, sheetUrl2);
      }
      out.ok = true;
    }
  } catch (err) {
    out.error = String(err);
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ SHEET LOG ============
function getSheetFile() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_FILE_NAME);
    props.setProperty('SHEET_ID', ss.getId());
    var sh = ss.getSheets()[0];
    sh.setName(LOG_TAB);
    sh.appendRow(['Candidate', 'Completed at', 'Section', 'Recruiting Manager', 'Agent #', 'TalentNest App ID']);
    sh.getRange('A1:F1').setFontWeight('bold').setBackground('#1F3A5F').setFontColor('#ffffff');
  }
  return ss;
}
function appendRow(values) {
  var ss = getSheetFile();
  var sh = ss.getSheetByName(LOG_TAB) || ss.insertSheet(LOG_TAB);
  sh.appendRow(values);
  return ss.getUrl();
}

// ============ EMAILS ============
function sendStageEmails(p, sheetUrl) {
  var candFirst = (p.candidateName || '').split(' ')[0];

  // 1) Candidate — friendly, short. Via TalentNest if bridge configured, else Gmail.
  if (p.candidateEmail) {
    var cSubject = 'Update on your application — ' + p.stageLabel + ' completed';
    var cBody = 'Dear ' + candFirst + ',<br><br>' +
      'Good news — the <b>' + p.stageLabel + '</b> step of your selection process has been completed.<br>' +
      'Your Recruiting Manager (' + (p.recruitingManager || 'your manager') + ') will be in touch with the next step.<br><br>' +
      'Regards,<br>Ricky Rampersad\'s Branch — Chaguanas Regional Centre';
    if (!sendViaTalentNest(p, cSubject, cBody)) {
      MailApp.sendEmail({ to: p.candidateEmail, subject: cSubject, htmlBody: cBody });
    }
  }

  // 2) Internal — BMA + RM, cc BM. Detail + sheet link.
  var to = [p.bmaEmail, p.rmEmail].filter(String).join(',');
  var cc = p.bmEmail || '';
  if (to || cc) {
    MailApp.sendEmail({
      to: to || cc,
      cc: to ? cc : '',
      subject: '[Recruit Tracker] ' + p.candidateName + ' — ' + p.stageLabel + ' complete',
      htmlBody: '<b>' + p.candidateName + '</b> has completed <b>' + p.stageLabel + '</b>.<br>' +
        'Recruiting Manager: ' + (p.recruitingManager || '—') + '<br>' +
        'Current stage: ' + (p.currentStage || '—') + '<br>' +
        (p.agentNumber ? 'Agent #: ' + p.agentNumber + '<br>' : '') +
        (p.talentNestId ? 'TalentNest application: ' + p.talentNestId + '<br>' : '') +
        (sheetUrl ? '<br>Log: <a href="' + sheetUrl + '">' + sheetUrl + '</a>' : '')
    });
  }
}

// ============ TALENTNEST BRIDGE (optional) ============
// To send candidate emails through TalentNest (company-branded, logged on the
// application record), set two Script Properties (Project Settings → Script Properties):
//   TN_SUBDOMAIN = your TalentNest subdomain (e.g. guardiangroup)
//   TN_API_KEY   = your TalentNest API key (ask head office / support@talentnest.com)
// The tracker sends talentNestId (candidate ID) with each notification.
function sendViaTalentNest(p, subject, htmlBody) {
  try {
    var props = PropertiesService.getScriptProperties();
    var sub = props.getProperty('TN_SUBDOMAIN');
    var key = props.getProperty('TN_API_KEY');
    var candidateId = p.talentNestCandidateId || '';
    if (!sub || !key || !candidateId) return false;
    var url = 'https://' + sub + '.talentnest.com/api/v1/candidates/' + candidateId + '/email';
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Basic ' + Utilities.base64Encode(key + ':') },
      payload: JSON.stringify({ subject: subject, body: htmlBody }),
      muteHttpExceptions: true
    });
    return res.getResponseCode() < 300;
  } catch (e) { return false; }
}
