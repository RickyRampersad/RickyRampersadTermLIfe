/**
 * BRANCH PORTAL API — recruit + manager logins for the selection pipeline
 * Ricky Rampersad Branch · Guardian Life of the Caribbean
 *
 * WHY THIS EXISTS
 *   The Recruit Tracker keeps files in one browser. A recruit signing in to
 *   see their own progress, and a manager signing in to see their recruits,
 *   both need the SAME data — so it has to live somewhere shared. This is
 *   that shared place: one Google Sheet, one Apps Script web app in front
 *   of it. No servers, no hosting bill, no new accounts.
 *
 * SETUP (10 minutes, once)
 *   1. script.google.com -> New project. Delete the sample. Paste this in.
 *   2. Project Settings -> Script Properties -> add:
 *        PORTAL_SECRET = any long random string you invent (signs logins)
 *      Optional:
 *        BM_EMAIL      = defaults to Ricky.Rampersad@myguardiangroup.com
 *   3. Run  setupPortal()  once from the editor. It creates the Sheet,
 *      writes the tabs, and prints the Sheet URL in the log.
 *   4. Deploy -> New deployment -> Web app
 *        Execute as: Me        Who has access: Anyone
 *      Copy the /exec URL.
 *   5. Paste that URL into API.BASE in portal/api.js and push.
 *
 * ADDING PEOPLE
 *   Open the Sheet, People tab, add a row. Give them a 6-digit PIN.
 *   role is one of: recruit, RM, BM, BMA.
 *   For a recruit, set managerId to their Recruiting Manager's id.
 *   That is the whole user-management story — deliberately.
 *
 * WHAT THIS IS NOT
 *   PINs in a spreadsheet are not bank-grade security. They are right for a
 *   branch of twenty people sharing non-financial progress data, and wrong
 *   for anything else. Do not put ID numbers, medical details or financial
 *   statements in here — those stay in the Recruit Tracker's selection file.
 */

// ============ CONFIG ============
var SHEET_NAME = 'Branch Portal Data';
var TABS = {
  people:      ['id','role','name','email','phone','pin','active','managerId','branch','createdAt'],
  recruits:    ['id','ref','track','stage','stageEnteredAt','startedAt','talentNestId','agentNumber','rmName','bmName','notes'],
  progress:    ['recruitId','moduleId','sessionId','assignedAt','dueAt','completedAt','checkpointsDone','managerScore','managerNotes'],
  submissions: ['id','recruitId','moduleId','sessionId','submittedAt','payload','selfConfidence','managerScore','managerComments','reviewedBy','reviewedAt','released'],
  scores:      ['recruitId','key','label','value','max','band','updatedAt'],
  events:      ['at','recruitId','actor','type','detail'],
  surveys:     ['id','recruitId','submittedAt','prospectName','prospectEmail','prospectPhone',
                'score','referralNames','warm','contactOk','consentName','thanked','answers']
};
var TOKEN_HOURS = 12;

// ============ ENTRY POINT ============
/* Everything is a POST with Content-Type text/plain. That is deliberate:
   it is a "simple request", so the browser never sends a CORS preflight,
   which Apps Script cannot answer. */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    out = route(req) || { ok: false, error: 'Unknown action: ' + req.action };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Branch portal API is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function route(req) {
  switch (req.action) {
    case 'ping':              return { ok: true, at: new Date().toISOString() };
    case 'login':             return apiLogin(req);
    case 'recruitDashboard':  return apiRecruitDashboard(req);
    case 'managerDashboard':  return apiManagerDashboard(req);
    case 'recruitDetail':     return apiRecruitDetail(req);
    case 'submitDebrief':     return apiSubmitDebrief(req);
    case 'submitSurvey':      return apiSubmitSurvey(req);
    case 'markSession':       return apiMarkSession(req);
    case 'assignSession':     return apiAssignSession(req);
    case 'reviewSubmission':  return apiReviewSubmission(req);
    case 'setStage':          return apiSetStage(req);
    case 'saveScore':         return apiSaveScore(req);
    case 'addRecruit':        return apiAddRecruit(req);
  }
  return null;
}

// ============ SHEET PLUMBING ============
function book() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PORTAL_SHEET_ID');
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty('PORTAL_SHEET_ID', ss.getId());
  }
  return ss;
}

function tab(name) {
  var ss = book();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(TABS[name]);
    sh.getRange(1, 1, 1, TABS[name].length)
      .setFontWeight('bold').setBackground('#07131f').setFontColor('#00CFEA');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Read a tab as objects. One getValues() call per tab per request — the
   whole point of doing it this way rather than cell-by-cell. */
function readAll(name) {
  var sh = tab(name), last = sh.getLastRow();
  if (last < 2) return [];
  var cols = TABS[name];
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  return values.map(function (row, i) {
    var o = { _row: i + 2 };
    for (var c = 0; c < cols.length; c++) o[cols[c]] = row[c];
    return o;
  });
}

function appendRow(name, obj) {
  var cols = TABS[name];
  tab(name).appendRow(cols.map(function (c) { return obj[c] === undefined ? '' : obj[c]; }));
}

function updateRow(name, rowIndex, obj) {
  var cols = TABS[name], sh = tab(name);
  var current = sh.getRange(rowIndex, 1, 1, cols.length).getValues()[0];
  for (var c = 0; c < cols.length; c++) {
    if (obj[cols[c]] !== undefined) current[c] = obj[cols[c]];
  }
  sh.getRange(rowIndex, 1, 1, cols.length).setValues([current]);
}

function logEvent(recruitId, actor, type, detail) {
  appendRow('events', { at: new Date(), recruitId: recruitId, actor: actor, type: type, detail: detail });
}

function newId(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

// ============ AUTH ============
function secret() {
  var s = PropertiesService.getScriptProperties().getProperty('PORTAL_SECRET');
  if (!s) throw new Error('PORTAL_SECRET is not set. Add it in Project Settings > Script Properties.');
  return s;
}

function sign(payload) {
  var raw = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var mac = Utilities.computeHmacSha256Signature(raw, secret());
  return raw + '.' + Utilities.base64EncodeWebSafe(mac);
}

function verify(token) {
  if (!token || token.indexOf('.') < 0) throw new Error('Please sign in again.');
  var parts = token.split('.');
  var expect = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], secret()));
  if (parts[1] !== expect) throw new Error('Please sign in again.');
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (new Date(payload.exp) < new Date()) throw new Error('Your session expired. Please sign in again.');
  return payload;
}

/* Resolve the caller, and refuse anything they are not entitled to see. */
function caller(req, allowedRoles) {
  var p = verify(req.token);
  var me = readAll('people').filter(function (x) { return String(x.id) === String(p.id); })[0];
  if (!me || String(me.active).toLowerCase() === 'no') throw new Error('This account is no longer active.');
  if (allowedRoles && allowedRoles.indexOf(String(me.role)) < 0) {
    throw new Error('You do not have access to that.');
  }
  return me;
}

function isManager(role) { return ['RM', 'BM', 'BMA'].indexOf(String(role)) > -1; }

/* A manager sees their own recruits. BM and BMA see the whole branch. */
function canSee(me, recruit) {
  if (String(me.role) === 'BM' || String(me.role) === 'BMA') return true;
  if (String(me.role) === 'RM') {
    var person = readAll('people').filter(function (x) { return String(x.id) === String(recruit.id); })[0];
    return person && String(person.managerId) === String(me.id);
  }
  return String(me.id) === String(recruit.id);
}

function apiLogin(req) {
  var email = String(req.email || '').trim().toLowerCase();
  var pin = String(req.pin || '').trim();
  if (!email || !pin) return { ok: false, error: 'Enter your email and PIN.' };

  var person = readAll('people').filter(function (x) {
    return String(x.email).trim().toLowerCase() === email && String(x.pin).trim() === pin;
  })[0];

  if (!person) return { ok: false, error: 'That email and PIN do not match. Check with your manager.' };
  if (String(person.active).toLowerCase() === 'no') return { ok: false, error: 'This account is no longer active.' };

  var exp = new Date(Date.now() + TOKEN_HOURS * 3600 * 1000).toISOString();
  logEvent(String(person.role) === 'recruit' ? person.id : '', person.name, 'signin', '');

  return {
    ok: true,
    token: sign({ id: person.id, role: person.role, exp: exp }),
    person: { id: person.id, name: person.name, role: person.role, email: person.email }
  };
}

// ============ RECRUIT VIEW ============
function apiRecruitDashboard(req) {
  var me = caller(req, ['recruit']);
  return { ok: true, data: recruitPayload(me.id) };
}

function recruitPayload(recruitId) {
  var rec = readAll('recruits').filter(function (r) { return String(r.id) === String(recruitId); })[0] || {};
  var person = readAll('people').filter(function (p) { return String(p.id) === String(recruitId); })[0] || {};
  var prog = readAll('progress').filter(function (p) { return String(p.recruitId) === String(recruitId); });
  var subs = readAll('submissions').filter(function (s) { return String(s.recruitId) === String(recruitId); });
  var scores = readAll('scores').filter(function (s) { return String(s.recruitId) === String(recruitId); });
  var events = readAll('events').filter(function (e) { return String(e.recruitId) === String(recruitId); });
  var surveys = readAll('surveys').filter(function (s) { return String(s.recruitId) === String(recruitId); });

  return {
    person: { id: person.id, name: person.name, email: person.email, phone: person.phone },
    recruit: {
      ref: rec.ref, track: rec.track, stage: rec.stage || 'firstInterview',
      stageEnteredAt: iso(rec.stageEnteredAt), startedAt: iso(rec.startedAt),
      rmName: rec.rmName, bmName: rec.bmName, agentNumber: rec.agentNumber,
      daysSinceStart: daysSince(rec.startedAt), daysInStage: daysSince(rec.stageEnteredAt)
    },
    progress: prog.map(function (p) {
      return {
        moduleId: p.moduleId, sessionId: p.sessionId,
        assignedAt: iso(p.assignedAt), dueAt: iso(p.dueAt), completedAt: iso(p.completedAt),
        checkpointsDone: parseJson(p.checkpointsDone, []),
        managerScore: p.managerScore === '' ? null : Number(p.managerScore),
        managerNotes: p.managerNotes
      };
    }),
    /* A recruit only ever sees a score once the manager has released it. */
    submissions: subs.map(function (s) {
      var released = String(s.released).toLowerCase() === 'yes';
      return {
        id: s.id, moduleId: s.moduleId, sessionId: s.sessionId,
        submittedAt: iso(s.submittedAt), selfConfidence: s.selfConfidence,
        managerScore: released && s.managerScore !== '' ? Number(s.managerScore) : null,
        managerComments: released ? s.managerComments : '',
        reviewed: released
      };
    }),
    scores: scores.map(function (s) {
      return { key: s.key, label: s.label, value: s.value, max: s.max, band: s.band, updatedAt: iso(s.updatedAt) };
    }),
    surveys: surveys.map(function (s) {
      return {
        id: s.id, submittedAt: iso(s.submittedAt), prospectName: s.prospectName,
        score: Number(s.score) || 0, referralNames: Number(s.referralNames) || 0,
        warm: String(s.warm).toLowerCase() === 'yes',
        answers: parseJson(s.answers, {})
      };
    }),
    timeline: events.slice(-40).map(function (e) {
      return { at: iso(e.at), actor: e.actor, type: e.type, detail: e.detail };
    })
  };
}

// ============ MANAGER VIEW ============
function apiManagerDashboard(req) {
  var me = caller(req, ['RM', 'BM', 'BMA']);
  var people = readAll('people');
  var recruits = readAll('recruits');
  var prog = readAll('progress');
  var subs = readAll('submissions');

  var mine = recruits.filter(function (r) {
    var person = people.filter(function (p) { return String(p.id) === String(r.id); })[0];
    if (!person || String(person.active).toLowerCase() === 'no') return false;
    if (String(me.role) === 'RM') return String(person.managerId) === String(me.id);
    return true;
  });

  var rows = mine.map(function (r) {
    var person = people.filter(function (p) { return String(p.id) === String(r.id); })[0] || {};
    var mySessions = prog.filter(function (p) { return String(p.recruitId) === String(r.id); });
    var done = mySessions.filter(function (p) { return p.completedAt; }).length;
    var pending = subs.filter(function (s) {
      return String(s.recruitId) === String(r.id) && String(s.released).toLowerCase() !== 'yes';
    }).length;
    var overdue = mySessions.filter(function (p) {
      return !p.completedAt && p.dueAt && new Date(p.dueAt) < new Date();
    }).length;

    return {
      id: r.id, name: person.name, email: person.email, phone: person.phone,
      ref: r.ref, track: r.track, stage: r.stage || 'firstInterview',
      daysInStage: daysSince(r.stageEnteredAt), daysSinceStart: daysSince(r.startedAt),
      sessionsDone: done, sessionsTotal: 21,
      surveys: readAll('surveys').filter(function (s) { return String(s.recruitId) === String(r.id); }).length,
      awaitingReview: pending, overdue: overdue,
      rmName: r.rmName
    };
  });

  return { ok: true, data: { me: { id: me.id, name: me.name, role: me.role }, recruits: rows } };
}

function apiRecruitDetail(req) {
  var me = caller(req, ['RM', 'BM', 'BMA']);
  var rec = readAll('recruits').filter(function (r) { return String(r.id) === String(req.recruitId); })[0];
  if (!rec) return { ok: false, error: 'Recruit not found.' };
  if (!canSee(me, rec)) return { ok: false, error: 'That recruit is not on your team.' };

  var payload = recruitPayload(req.recruitId);
  /* Managers see unreleased scores and the raw answers; recruits never do. */
  payload.submissions = readAll('submissions')
    .filter(function (s) { return String(s.recruitId) === String(req.recruitId); })
    .map(function (s) {
      return {
        id: s.id, moduleId: s.moduleId, sessionId: s.sessionId, submittedAt: iso(s.submittedAt),
        payload: parseJson(s.payload, {}), selfConfidence: s.selfConfidence,
        managerScore: s.managerScore === '' ? null : Number(s.managerScore),
        managerComments: s.managerComments, reviewedBy: s.reviewedBy,
        reviewedAt: iso(s.reviewedAt), released: String(s.released).toLowerCase() === 'yes'
      };
    });
  return { ok: true, data: payload };
}

// ============ RECRUIT ACTIONS ============
function apiSubmitDebrief(req) {
  var me = caller(req, ['recruit']);
  var id = newId('sub');
  appendRow('submissions', {
    id: id, recruitId: me.id, moduleId: req.moduleId, sessionId: req.sessionId,
    submittedAt: new Date(), payload: JSON.stringify(req.answers || {}),
    selfConfidence: req.selfConfidence || '', managerScore: '', managerComments: '',
    reviewedBy: '', reviewedAt: '', released: 'no'
  });

  /* Mark the recruit's own checkpoint ticks against the session row */
  var row = readAll('progress').filter(function (p) {
    return String(p.recruitId) === String(me.id) && String(p.sessionId) === String(req.sessionId);
  })[0];
  if (row) updateRow('progress', row._row, { checkpointsDone: JSON.stringify(req.checkpointsDone || []) });
  else appendRow('progress', {
    recruitId: me.id, moduleId: req.moduleId, sessionId: req.sessionId,
    assignedAt: new Date(), checkpointsDone: JSON.stringify(req.checkpointsDone || [])
  });

  logEvent(me.id, me.name, 'debrief', req.sessionId + ' submitted');
  notifyManagers(me, req.moduleId, req.sessionId);
  return { ok: true, id: id };
}

/* The recruit submits, the manager gets it, the BM is copied — as asked. */
function notifyManagers(recruitPerson, moduleId, sessionId) {
  try {
    var people = readAll('people');
    var rm = people.filter(function (p) { return String(p.id) === String(recruitPerson.managerId); })[0];
    var bmAddr = PropertiesService.getScriptProperties().getProperty('BM_EMAIL')
      || 'Ricky.Rampersad@myguardiangroup.com';
    var to = rm && rm.email ? String(rm.email) : bmAddr;
    var cc = rm && rm.email ? bmAddr : '';
    MailApp.sendEmail({
      to: to, cc: cc,
      subject: '[Portal] ' + recruitPerson.name + ' submitted ' + sessionId + ' (' + moduleId + ')',
      htmlBody:
        '<div style="font-family:Arial,sans-serif;max-width:560px;font-size:15px;line-height:1.6">' +
        '<b>' + recruitPerson.name + '</b> has submitted their debrief for <b>' + sessionId +
        '</b> in module ' + moduleId + '.<br><br>' +
        'Sign in to the branch portal to read it and score it. Nothing is shown back to the recruit ' +
        'until you release the score.<br><br>' +
        '<span style="color:#666;font-size:13px">Ricky Rampersad Branch — recruiting portal</span></div>'
    });
  } catch (err) { /* a failed email must never fail the submission */ }
}

/* ============================================================
   MARKET SURVEY
   The recruit submits; the Unit Manager and BM get it the same
   day; the prospect gets one short thank-you — and only if they
   gave an email AND agreed to be contacted.
   ============================================================ */
function apiSubmitSurvey(req) {
  var me = caller(req, ['recruit']);
  var a = req.answers || {};
  var refs = (a.referrals || []).filter(function (r) { return r && String(r.name || '').trim(); });
  var warm = (a.changes === 'Yes' && (a.ownsIns === 'No' || a.confidence === 'NotConfident'));
  var name = ((a.firstName || '') + ' ' + (a.lastName || '')).trim();
  var id = newId('sv');

  var thanked = 'no';
  if (a.contactOk && a.email) {
    try { thankProspect(me, a); thanked = 'yes'; } catch (err) { thanked = 'failed'; }
  }

  appendRow('surveys', {
    id: id, recruitId: me.id, submittedAt: new Date(),
    prospectName: name, prospectEmail: a.email || '', prospectPhone: a.phone || '',
    score: req.score || 0, referralNames: refs.length,
    warm: warm ? 'yes' : 'no', contactOk: a.contactOk ? 'yes' : 'no',
    consentName: (a.consent && a.consent.name) || '', thanked: thanked,
    answers: JSON.stringify(a)
  });

  logEvent(me.id, me.name, 'survey', 'Market survey — ' + name + ' (' + (req.score || 0) + '/100)'
    + (refs.length ? ', ' + refs.length + ' referral' + (refs.length > 1 ? 's' : '') : ''));

  try { notifySurvey(me, a, req.score || 0, refs, warm); } catch (err) {}
  return { ok: true, id: id, thanked: thanked };
}

/* The thank-you the prospect receives. Deliberately short, says exactly
   what happens next, promises nothing, and sells nothing — the consent
   they signed says no products were offered, and this must stay true. */
function thankProspect(recruitPerson, a) {
  var first = String(a.firstName || '').trim() || 'there';
  var recruit = recruitPerson.name;
  MailApp.sendEmail({
    to: String(a.email).trim(),
    subject: 'Thank you for speaking with ' + recruit,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:560px;font-size:15px;line-height:1.7;color:#222">' +
      '<div style="background:#07131f;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">' +
        '<div style="font-size:11px;letter-spacing:2px;color:#00CFEA;text-transform:uppercase">Ricky Rampersad Branch</div>' +
        '<div style="font-size:18px;font-weight:bold;margin-top:3px">Guardian Life of the Caribbean</div></div>' +
      '<div style="border:1px solid #e2e2e2;border-top:none;padding:20px;border-radius:0 0 10px 10px">' +
      'Dear ' + first + ',<br><br>' +
      'Thank you for taking the time to speak with <b>' + recruit + '</b> and for sharing your thoughts on ' +
      'insurance and financial planning. That conversation was part of our selection process — ' + recruit +
      ' is currently being considered for an advisor role with our Chaguanas branch, and the exercise is ' +
      'designed to show us how they handle a real conversation with someone who knows them.<br><br>' +
      'Nothing was being sold to you, and nothing is being sold to you now.<br><br>' +
      'You indicated you would be happy to hear from us. If ' + recruit + ' completes the process and we ' +
      'accept them, they will be in touch — properly licensed, and able to actually advise you rather than ' +
      'just ask questions. If that takes a while, it is because the process is thorough on purpose.<br><br>' +
      'If you would rather we did not contact you, simply reply to this email and we will remove your details.<br><br>' +
      'With thanks,<br><b>' + BRANCH_NAME + '</b><br>' + bmEmail() +
      '</div></div>'
  });
}

function notifySurvey(recruitPerson, a, score, refs, warm) {
  var people = readAll('people');
  var rm = people.filter(function (p) { return String(p.id) === String(recruitPerson.managerId); })[0];
  var bmAddr = bmEmail();
  var to = rm && rm.email ? String(rm.email) : bmAddr;
  var cc = rm && rm.email ? bmAddr : '';
  var name = ((a.firstName || '') + ' ' + (a.lastName || '')).trim();

  MailApp.sendEmail({
    to: to, cc: cc,
    subject: '[Survey] ' + recruitPerson.name + ' — ' + name + ' — ' + score + '/100'
             + (warm ? ' — WARM' : ''),
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:600px;font-size:14px;line-height:1.65">' +
      '<b>' + recruitPerson.name + '</b> submitted a market survey.<br><br>' +
      '<table style="border-collapse:collapse">' +
      row('Prospect', name + (a.occupation ? ' — ' + a.occupation : '')) +
      row('Contact', (a.phone || '—') + (a.email ? ' · ' + a.email : '')) +
      row('Score', score + '/100') +
      row('Referrals', refs.length ? refs.map(function (r) {
        return r.name + (r.mobile ? ' (' + r.mobile + ')' : ''); }).join(', ') : 'none') +
      row('Owns cover', (a.ownsIns || '—') + (a.confidence ? ' · ' + a.confidence : '')) +
      row('Considering changes', a.changes || '—') +
      '</table>' +
      (warm ? '<div style="margin-top:14px;padding:11px 14px;background:#fff6e6;border-left:3px solid #dca530;' +
              'border-radius:4px"><b>Warm prospect.</b> Considering a change, and either uninsured or not ' +
              'confident in what they have.' +
              (a.contactOk && a.email ? ' They agreed to contact and have been thanked.' : ' No contact consent on file.') +
              '</div>' : '') +
      (a.insights ? '<div style="margin-top:14px;padding:12px 14px;background:#f6f8fa;border-left:3px solid #00A8C5;' +
        'border-radius:4px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;' +
        'margin-bottom:5px">Their read of it</div>' + a.insights + '</div>' : '') +
      '</div>'
  });
}

function row(k, v) {
  return '<tr><td style="padding:5px 14px 5px 0;color:#666;white-space:nowrap;vertical-align:top">' + k +
         '</td><td style="padding:5px 0;color:#111"><b>' + (v || '—') + '</b></td></tr>';
}

// ============ MANAGER ACTIONS ============
function apiAssignSession(req) {
  var me = caller(req, ['RM', 'BM', 'BMA']);
  var existing = readAll('progress').filter(function (p) {
    return String(p.recruitId) === String(req.recruitId) && String(p.sessionId) === String(req.sessionId);
  })[0];
  var patch = { assignedAt: new Date(), dueAt: req.dueAt ? new Date(req.dueAt) : '' };
  if (existing) updateRow('progress', existing._row, patch);
  else appendRow('progress', {
    recruitId: req.recruitId, moduleId: req.moduleId, sessionId: req.sessionId,
    assignedAt: patch.assignedAt, dueAt: patch.dueAt, checkpointsDone: '[]'
  });
  logEvent(req.recruitId, me.name, 'assigned', req.sessionId);
  return { ok: true };
}

function apiMarkSession(req) {
  var me = caller(req, ['RM', 'BM', 'BMA']);
  var existing = readAll('progress').filter(function (p) {
    return String(p.recruitId) === String(req.recruitId) && String(p.sessionId) === String(req.sessionId);
  })[0];
  var patch = {
    completedAt: req.completed ? new Date() : '',
    checkpointsDone: JSON.stringify(req.checkpointsDone || []),
    managerScore: req.managerScore === null || req.managerScore === undefined ? '' : req.managerScore,
    managerNotes: req.managerNotes || ''
  };
  if (existing) updateRow('progress', existing._row, patch);
  else {
    patch.recruitId = req.recruitId; patch.moduleId = req.moduleId;
    patch.sessionId = req.sessionId; patch.assignedAt = new Date();
    appendRow('progress', patch);
  }
  logEvent(req.recruitId, me.name, req.completed ? 'session_complete' : 'session_update', req.sessionId);
  return { ok: true };
}

function apiReviewSubmission(req) {
  var me = caller(req, ['RM', 'BM', 'BMA']);
  var sub = readAll('submissions').filter(function (s) { return String(s.id) === String(req.submissionId); })[0];
  if (!sub) return { ok: false, error: 'Submission not found.' };

  updateRow('submissions', sub._row, {
    managerScore: req.managerScore === null || req.managerScore === undefined ? '' : req.managerScore,
    managerComments: req.managerComments || '',
    reviewedBy: me.name, reviewedAt: new Date(),
    released: req.release ? 'yes' : 'no'
  });
  logEvent(sub.recruitId, me.name, 'reviewed', sub.sessionId + (req.release ? ' — released' : ' — held'));

  if (req.release) {
    try {
      var person = readAll('people').filter(function (p) { return String(p.id) === String(sub.recruitId); })[0];
      if (person && person.email) {
        MailApp.sendEmail({
          to: String(person.email),
          subject: 'Your ' + sub.sessionId + ' feedback is ready',
          htmlBody:
            '<div style="font-family:Arial,sans-serif;max-width:540px;font-size:15px;line-height:1.6">' +
            'Hi ' + String(person.name).split(' ')[0] + ',<br><br>' +
            (me.name || 'Your manager') + ' has reviewed your debrief for <b>' + sub.sessionId + '</b>.<br><br>' +
            'Sign in to the branch portal to read the feedback and see your score.<br><br>' +
            '<span style="color:#666;font-size:13px">Ricky Rampersad Branch</span></div>'
        });
      }
    } catch (err) {}
  }
  return { ok: true };
}

function apiSetStage(req) {
  var me = caller(req, ['RM', 'BM', 'BMA']);
  var rec = readAll('recruits').filter(function (r) { return String(r.id) === String(req.recruitId); })[0];
  if (!rec) return { ok: false, error: 'Recruit not found.' };
  updateRow('recruits', rec._row, { stage: req.stage, stageEnteredAt: new Date() });
  logEvent(req.recruitId, me.name, 'stage', 'moved to ' + req.stage);
  return { ok: true };
}

function apiSaveScore(req) {
  var me = caller(req, ['RM', 'BM', 'BMA']);
  var existing = readAll('scores').filter(function (s) {
    return String(s.recruitId) === String(req.recruitId) && String(s.key) === String(req.key);
  })[0];
  var patch = {
    value: req.value, max: req.max || '', band: req.band || '',
    label: req.label || req.key, updatedAt: new Date()
  };
  if (existing) updateRow('scores', existing._row, patch);
  else {
    patch.recruitId = req.recruitId; patch.key = req.key;
    appendRow('scores', patch);
  }
  logEvent(req.recruitId, me.name, 'score', req.key + ' = ' + req.value);
  return { ok: true };
}

function apiAddRecruit(req) {
  var me = caller(req, ['RM', 'BM', 'BMA']);
  var id = newId('r');
  var pin = String(Math.floor(100000 + Math.random() * 900000));
  appendRow('people', {
    id: id, role: 'recruit', name: req.name, email: String(req.email || '').toLowerCase(),
    phone: req.phone || '', pin: pin, active: 'yes',
    managerId: req.managerId || me.id, branch: 'Chaguanas Regional Centre', createdAt: new Date()
  });
  appendRow('recruits', {
    id: id, ref: req.ref || '', track: req.track || '', stage: req.stage || 'firstInterview',
    stageEnteredAt: new Date(), startedAt: new Date(),
    rmName: req.rmName || me.name, bmName: 'Ricky Rampersad'
  });
  logEvent(id, me.name, 'created', req.name + ' added to the pipeline');
  return { ok: true, id: id, pin: pin };
}

// ============ HELPERS ============
function iso(v) {
  if (!v) return '';
  try { return (v instanceof Date) ? v.toISOString() : new Date(v).toISOString(); }
  catch (err) { return String(v); }
}
function daysSince(v) {
  if (!v) return null;
  var d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
function parseJson(v, fallback) {
  if (!v) return fallback;
  try { return JSON.parse(v); } catch (err) { return fallback; }
}

// ============ ONE-TIME SETUP ============
function setupPortal() {
  var ss = book();
  Object.keys(TABS).forEach(function (t) { tab(t); });

  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  /* Seed the branch roster if People is empty, so you can sign in immediately. */
  if (readAll('people').length === 0) {
    var bm = newId('m');
    appendRow('people', { id: bm, role: 'BM', name: 'Ricky Rampersad',
      email: 'Ricky.Rampersad@myguardiangroup.com', phone: '678-5821', pin: '246810',
      active: 'yes', managerId: '', branch: 'Chaguanas Regional Centre', createdAt: new Date() });
    ['Kerwyn Ramroach', 'Gary Sookdeo', 'Akaash Kalladeen'].forEach(function (n, i) {
      appendRow('people', { id: newId('m'), role: 'RM', name: n, email: '', phone: '',
        pin: String(111111 * (i + 2)).slice(0, 6), active: 'yes', managerId: bm,
        branch: 'Chaguanas Regional Centre', createdAt: new Date() });
    });
    appendRow('people', { id: newId('m'), role: 'BMA', name: 'Kamla', email: '', phone: '',
      pin: '135791', active: 'yes', managerId: bm,
      branch: 'Chaguanas Regional Centre', createdAt: new Date() });
  }

  Logger.log('Portal sheet ready: ' + ss.getUrl());
  Logger.log('Fill in the email column for each manager, change every PIN, then deploy as a web app.');
  return ss.getUrl();
}
