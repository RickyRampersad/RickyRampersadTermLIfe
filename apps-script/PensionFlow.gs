/**
 * Company pension enrolment — the two-sided process, and everything the branch
 * sends while it is running.
 *
 * THE SHAPE OF IT
 *   The employer goes first. They complete the company-owned Section 134 part
 *   for one employee — the plan, the premium, the lump sum, the commencement.
 *   The moment they finish, the employee is written to and told: your employer
 *   has set this up for you, here is what it is, and here is the part only you
 *   can complete.
 *
 *   The employee completes theirs and uploads their documents. That closes the
 *   enrolment, and both sides are thanked and told it is going to the B.I.R.
 *   for approval of the company's plan and their own.
 *
 *   From there the branch moves it along — with B.I.R., approved, issued,
 *   delivered — and both sides can watch it move.
 *
 * WHAT GOES OUT, WITHOUT ANYBODY REMEMBERING TO SEND IT
 *   - the invitation to the employee, the moment the employer finishes
 *   - a reminder to the employee every morning at 9, until they are done,
 *     carrying the list of everything already sent
 *   - a thank-you to both sides when the enrolment closes
 *   - a progress note to both sides every 10 days until the policy is delivered
 *   - a note the day it is delivered
 *
 *   Every one of them copies the branch and the team, and every one after the
 *   first is a reply on the same email thread, so nobody is ever reading a
 *   message without its history underneath it.
 *
 * Set up from the Guardian Renewals menu: "Pension — install the 9am automation".
 */

var PFLOW = {
  SHEET: 'Pension Enrollments',
  LOG: 'Pension Activity',

  /* Everyone here is copied on every message about every enrolment. */
  BRANCH_EMAIL: 'support@rickyrampersadbranch.com',
  TEAM: [
    'ricky.rampersad@myguardiangroup.com',
    // add the rest of the team here — one quoted address per line
  ],

  /* Where the client goes to watch it move. */
  SITE: 'https://pensionplantt.com',

  REMIND_HOUR: 9,          // the employee's daily reminder
  PROGRESS_EVERY_DAYS: 10, // the progress note to both sides
  REMIND_STOP_AFTER: 45,   // a person is not chased for ever — see below
};

var PBRAND = { navy: '#1A1D24', deep: '#0E1013', gold: '#D33F49', goldl: '#E85F6A', ink: '#17191F', mut: '#5C616C' };

/* Between them, the employer's part and the employee's part collect every field
   the four printed forms need — Declaration 1, Declaration 2, the Salary
   Deduction authority and the B.I.R. request. The employer supplies what an
   employer knows (the job, the payroll dates, the commercial terms); the
   employee supplies what only they know (date of birth, B.I.R. file number,
   home address). Anything about the company itself comes off the company's own
   row, so nobody retypes it per employee. */
var PENROL_HEADERS = [
  'ID', 'Created', 'Company Code', 'Company', 'Company Contact', 'Company Email',
  'Employee', 'Employee Email', 'Employee Mobile', 'Employee Code', 'Agent', 'Agent No.',
  'Position', 'Department', 'Employed Since',
  'Plan', 'Company Annual (TT$)', 'Company Lump Sum (TT$)', 'Commencement', 'Salary (TT$)',
  'Maturity Age', 'Guarantee (yrs)', 'First Deduction', 'Employer Part Done', 'Employer By',
  'Date of Birth', 'Employee B.I.R. File #', 'Employee Address', 'Marital Status',
  'Employee Monthly (TT$)', 'Employee Plan', 'Retirement Age', 'Employee Guarantee', 'Beneficiaries',
  'Documents', 'Employee Part Done',
  'BIR Sent', 'BIR Approved', 'Policy #', 'Policy Issued', 'Delivered',
  'Stage', 'Reminders Sent', 'Last Reminder', 'Last Progress Note', 'Thread Id', 'Notes',
];

function penrolSheet_() { return namedSheet_(PFLOW.SHEET, PENROL_HEADERS); }
function pactSheet_() { return namedSheet_(PFLOW.LOG, ['Timestamp', 'ID', 'Employee', 'Event', 'To', 'Detail']); }

function pact_(id, who, event, to, detail) {
  try {
    pactSheet_().appendRow([new Date(), id, who || '', event, to || '', String(detail || '').slice(0, 900)]);
  } catch (err) { /* the log must never cost a client their email */ }
}

/* ─────────────────────────── the timeline ─────────────────────────── */

/**
 * The five steps, in order. This is the single definition — the emails, the
 * website and the sheet all read the timeline from here, so they cannot drift
 * apart and tell a client three different stories.
 */
var PSTEPS = [
  { key: 'employer', col: 'employer part done', label: 'The employer’s part',
    doing: 'The company is completing its part of the plan.',
    done: 'The company has completed its part.' },
  { key: 'employee', col: 'employee part done', label: 'The employee’s part',
    doing: 'Waiting on the employee’s details, beneficiaries and documents.',
    done: 'The employee has completed their part.' },
  { key: 'bir', col: 'bir approved', label: 'B.I.R. approval',
    doing: 'With the Board of Inland Revenue for approval of both plans.',
    done: 'The B.I.R. has approved the contributions.' },
  { key: 'issued', col: 'policy issued', label: 'Policy issued',
    doing: 'Guardian is issuing the policy and assigning the policy number.',
    done: 'The policy has been issued.' },
  { key: 'delivered', col: 'delivered', label: 'Policy delivered',
    doing: 'The policy is on its way to you.',
    done: 'Delivered. The plan is in force.' },
];

/** Where an enrolment has reached, as a list the website can draw directly. */
function ptimeline_(r) {
  var steps = PSTEPS.map(function (s) {
    var at = r[s.col];
    return { key: s.key, label: s.label, done: !!at, at: at ? fmtDate_(at) : '', note: '' };
  });
  var current = -1;
  for (var i = 0; i < steps.length; i++) if (!steps[i].done) { current = i; break; }
  steps.forEach(function (st, i) {
    var s = PSTEPS[i];
    st.now = (i === current);
    st.note = st.done ? s.done : (st.now ? s.doing : '');
  });
  return {
    steps: steps,
    stage: current < 0 ? 'delivered' : PSTEPS[current].key,
    stageLabel: current < 0 ? 'Delivered — the plan is in force' : PSTEPS[current].label,
    complete: current < 0,
    pct: Math.round(((current < 0 ? PSTEPS.length : current) / PSTEPS.length) * 100),
  };
}

function penrolStageName_(r) { return ptimeline_(r).stageLabel; }

/* ─────────────────────────── reading rows ─────────────────────────── */

function penrolAll_() { return pensionRows_(penrolSheet_()); }

function penrolById_(id) {
  var all = penrolAll_();
  for (var i = 0; i < all.length; i++) if (String(all[i]['id']) === String(id)) return all[i];
  return null;
}

/** Writes one field back to the row the object came from. */
function penrolSet_(r, header, value) {
  var sh = penrolSheet_(), map = headerMap_(sh);
  var c = col_(map, header.toLowerCase());
  if (c < 0) throw new Error('No such column: ' + header);
  sh.getRange(r._row, c + 1).setValue(value);
  r[header.toLowerCase()] = value;
}

function penrolSetMany_(r, pairs) {
  var sh = penrolSheet_(), map = headerMap_(sh);
  for (var h in pairs) {
    var c = col_(map, h.toLowerCase());
    if (c < 0) continue;
    sh.getRange(r._row, c + 1).setValue(pairs[h]);
    r[h.toLowerCase()] = pairs[h];
  }
}

function pnewId_() {
  return 'EN-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMdd') + '-' +
    Math.floor(Math.random() * 9000 + 1000);
}

/* ─────────────────────────── the emails ─────────────────────────── */

function pwrap_(inner, tag) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:' + PBRAND.ink + ';max-width:640px">' +
    '<div style="background:' + PBRAND.deep + ';padding:22px 24px;border-radius:12px 12px 0 0">' +
      '<div style="color:' + PBRAND.goldl + ';font-size:11px;letter-spacing:3px;font-weight:bold">RAMPERSAD BRANCH · GUARDIAN LIFE</div>' +
      '<div style="color:#fff;font-size:21px;font-weight:bold;margin-top:7px">' + esc_(tag || 'Company pension') + '</div>' +
    '</div>' +
    '<div style="border:1px solid #e2e7f0;border-top:none;padding:24px;border-radius:0 0 12px 12px;background:#fff">' + inner +
    '<p style="color:#8b96ad;font-size:11.5px;border-top:1px solid #eceff5;padding-top:12px;margin-top:22px">' +
      'Ricky Rampersad — CFD, MFA · Branch Manager · 23× MDRT · ' + esc_(CONFIG.AGENT_PHONE) + '<br>' +
      'This is a plain-language summary. The policy contract governs in all cases, and contributions are subject to B.I.R. approval.</p>' +
    '</div></div>';
}

function pbtn_(href, label) {
  return '<p style="text-align:center;margin:26px 0"><a href="' + href + '" style="background:' + PBRAND.gold +
    ';color:#FFF6F6;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:9px;display:inline-block">' +
    esc_(label) + '</a></p>';
}

function pnote_(html) {
  return '<div style="background:#FCEFF0;border-left:4px solid ' + PBRAND.gold + ';padding:13px 17px;margin:16px 0">' + html + '</div>';
}

/** The timeline, drawn into an email so it reads the same as the website. */
function ptimelineHtml_(r) {
  var t = ptimeline_(r);
  var out = '<table cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0">';
  t.steps.forEach(function (s) {
    var mark = s.done ? '✓' : (s.now ? '●' : '○');
    var colour = s.done ? '#13845b' : (s.now ? PBRAND.gold : '#c2c9d6');
    var weight = s.now ? 'bold' : 'normal';
    out += '<tr>' +
      '<td width="26" valign="top" style="color:' + colour + ';font-size:16px;padding:7px 0">' + mark + '</td>' +
      '<td valign="top" style="padding:7px 0">' +
        '<span style="font-weight:' + weight + ';color:' + (s.done || s.now ? PBRAND.ink : '#98a2b6') + '">' + esc_(s.label) + '</span>' +
        (s.at ? '<span style="color:#8b96ad;font-size:12.5px"> — ' + esc_(s.at) + '</span>' : '') +
        (s.note ? '<br><span style="color:' + PBRAND.mut + ';font-size:13px">' + esc_(s.note) + '</span>' : '') +
      '</td></tr>';
  });
  return out + '</table>';
}

/** Everything already sent on this enrolment — so a reminder is never bare. */
function phistoryHtml_(id) {
  var rows;
  try { rows = pensionRows_(pactSheet_()); } catch (err) { return ''; }
  var mine = rows.filter(function (a) { return String(a['id']) === String(id) && /^sent:/.test(String(a['event'])); });
  if (!mine.length) return '';
  var items = mine.slice(-8).map(function (a) {
    return '<li style="margin-bottom:4px">' + esc_(fmtDate_(a['timestamp'])) + ' — ' +
      esc_(String(a['event']).replace(/^sent:\s*/, '')) + '</li>';
  }).join('');
  return '<div style="margin-top:22px;padding-top:14px;border-top:1px solid #eceff5">' +
    '<div style="font-size:12px;letter-spacing:1.4px;color:#8b96ad;font-weight:bold">WHAT WE HAVE SENT SO FAR</div>' +
    '<ul style="color:' + PBRAND.mut + ';font-size:13px;margin:9px 0 0 18px;padding:0">' + items + '</ul></div>';
}

function pRecipients_(r) {
  var cc = [PFLOW.BRANCH_EMAIL].concat(PFLOW.TEAM).filter(String);
  var coEmail = String(r['company email'] || '').trim();
  if (coEmail) cc.push(coEmail);
  return { cc: cc.filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(',') };
}

function plink_(code) {
  return PFLOW.SITE + '/?code=' + encodeURIComponent(code || '');
}

/**
 * Sends the first message of an enrolment and remembers its thread, so every
 * later message can be a reply on it rather than a fresh email with no history.
 */
function pSendFirst_(r, subject, html, toOverride) {
  var to = toOverride || String(r['employee email'] || '').trim();
  if (!to) throw new Error('No employee email on ' + r['id']);
  var opts = { htmlBody: html, cc: pRecipients_(r).cc, name: 'Ricky Rampersad — Rampersad Branch' };
  var plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  var threadId = '';
  try {
    var msg = GmailApp.createDraft(to, subject, plain, opts).send();
    threadId = msg.getThread().getId();
  } catch (err) {
    // Gmail scope unavailable — still send, just without threading.
    MailApp.sendEmail(Object.assign({ to: to, subject: subject }, opts));
  }
  return threadId;
}

/** A reply on the enrolment's own thread, keeping everyone who is already on it. */
function pReply_(r, subject, html) {
  var id = String(r['thread id'] || '');
  var plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  if (id) {
    try {
      GmailApp.getThreadById(id).replyAll(plain, { htmlBody: html, cc: pRecipients_(r).cc });
      return id;
    } catch (err) { /* thread deleted or no scope — fall through to a fresh mail */ }
  }
  return pSendFirst_(r, subject, html);
}

/* ─────────────────────────── the five messages ─────────────────────────── */

function pMailEmployeeInvite_(r) {
  var first = String(r['employee'] || '').trim().split(/\s+/)[0] || 'there';
  var subject = 'Your company pension with ' + (r['company'] || 'your employer') + ' — your part is needed';
  var html = pwrap_(
    '<p>Dear ' + esc_(first) + ',</p>' +
    '<p><b>' + esc_(r['company']) + ' has set up a pension for you</b>, and their part of it is now complete. ' +
    'Congratulations — this is a real and valuable thing for your employer to do.</p>' +

    pnote_(
      '<b>What has been set up</b><br>' +
      'A <b>company-owned plan under Section 134 of the Income Tax Act</b>' +
      (r['plan'] ? ' — the <b>' + esc_(r['plan']) + '</b>' : '') + '. ' +
      'The company owns the policy and pays into it, and <b>you are the person it pays out to</b>. ' +
      'It is held for you and your estate.' +
      (r['company annual (tt$)'] ? '<br><br>The company is contributing <b>' + fmtMoney_(r['company annual (tt$)']) + ' a year</b>' +
        (r['company lump sum (tt$)'] ? ', plus a lump sum of <b>' + fmtMoney_(r['company lump sum (tt$)']) + '</b>' : '') + '.' : '') +
      (r['commencement'] ? '<br>Commencing <b>' + esc_(fmtDate_(r['commencement'])) + '</b>.' : '')
    ) +

    '<p><b>Now we need your part</b> — and only you can give it to us:</p>' +
    '<ul style="margin:10px 0 0 18px;padding:0;color:' + PBRAND.mut + '">' +
      '<li style="margin-bottom:6px">Your own details, and whether you want to add anything from your salary (this is <b>your</b> money, and it lowers the income tax you pay)</li>' +
      '<li style="margin-bottom:6px">Who you want the money to go to — your beneficiaries, and their shares</li>' +
      '<li style="margin-bottom:6px">A valid photo ID, a utility bill in your name under six months old, and a recent pay slip</li>' +
    '</ul>' +

    pbtn_(plink_(r['employee code']), 'Complete my part →') +
    '<p style="text-align:center;color:' + PBRAND.mut + ';font-size:13px;margin-top:-12px">' +
      'Your access code is <b style="letter-spacing:1px">' + esc_(r['employee code']) + '</b>. It shows your record and nobody else’s.</p>' +

    '<p>It takes about ten minutes. Nothing else moves until it is done — so the sooner you can, the sooner your plan is in force.</p>' +
    '<p><b>Ask us anything.</b> There is a guide built into the page, and you can simply reply to this email — the whole branch is copied on it.</p>' +

    '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #eceff5">' +
      '<div style="font-size:12px;letter-spacing:1.4px;color:#8b96ad;font-weight:bold">WHERE IT HAS REACHED</div>' +
      ptimelineHtml_(r) + '</div>',
    'Your pension — your part is needed');
  return { subject: subject, html: html };
}

function pMailEmployeeReminder_(r) {
  var first = String(r['employee'] || '').trim().split(/\s+/)[0] || 'there';
  var n = Number(r['reminders sent'] || 0) + 1;
  var subject = 'Reminder — your pension with ' + (r['company'] || 'your employer') + ' is waiting on you';
  var html = pwrap_(
    '<p>Good morning ' + esc_(first) + ',</p>' +
    '<p>Your employer’s part of your pension has been complete since <b>' +
      esc_(fmtDate_(r['employer part done'])) + '</b>. <b>Yours is the only thing outstanding.</b></p>' +
    pnote_('It is about ten minutes: your details, who you want the money to go to, and three documents — ' +
      'a photo ID, a utility bill under six months old, and a recent pay slip.') +
    pbtn_(plink_(r['employee code']), 'Complete my part now →') +
    '<p style="text-align:center;color:' + PBRAND.mut + ';font-size:13px;margin-top:-12px">Your code: <b style="letter-spacing:1px">' + esc_(r['employee code']) + '</b></p>' +
    '<p>If something is stopping you — a document you cannot find, a question about the plan, a beneficiary you are unsure of — ' +
      '<b>reply to this email and say so</b>. We would far rather help than keep sending reminders.</p>' +
    ptimelineHtml_(r) +
    phistoryHtml_(r['id']),
    'Reminder ' + n + ' · your part is needed');
  return { subject: subject, html: html };
}

function pMailBothComplete_(r) {
  var first = String(r['employee'] || '').trim().split(/\s+/)[0] || 'there';
  var subject = 'Thank you — your pension enrolment is complete and going to the B.I.R.';
  var html = pwrap_(
    '<p>Dear ' + esc_(first) + ',</p>' +
    '<p><b>Thank you — that is your part done, and the enrolment is complete.</b> ' +
      'Everything we need from you and from ' + esc_(r['company']) + ' is now in.</p>' +

    pnote_('<b>What happens next</b><br>' +
      'The application goes to the <b>Board of Inland Revenue</b> for approval of the contributions — ' +
      'the company’s Section 134 plan and your own. That approval is what makes the company’s contribution ' +
      'deductible and your own contribution allowable against your income tax.<br><br>' +
      'Once approved, Guardian issues the policy and assigns the policy number, and we deliver it to you. ' +
      'We will write to you both at every step — you will not have to chase us.') +

    '<p><b>What you have:</b></p>' +
    '<ul style="margin:10px 0 0 18px;padding:0;color:' + PBRAND.mut + '">' +
      (r['plan'] ? '<li style="margin-bottom:6px">The <b>' + esc_(r['plan']) + '</b>, owned by the company, with you as the person it pays out to</li>' : '') +
      (r['company annual (tt$)'] ? '<li style="margin-bottom:6px">A company contribution of <b>' + fmtMoney_(r['company annual (tt$)']) + ' a year</b></li>' : '') +
      (r['employee monthly (tt$)'] ? '<li style="margin-bottom:6px">Your own contribution of <b>' + fmtMoney_(r['employee monthly (tt$)']) + ' a month</b>, out of salary</li>' : '') +
      (r['beneficiaries'] ? '<li style="margin-bottom:6px">Your beneficiaries: ' + esc_(r['beneficiaries']) + '</li>' : '') +
    '</ul>' +

    pbtn_(plink_(r['employee code']), 'Watch it move →') +
    '<p style="text-align:center;margin-top:-14px"><a href="' + PFLOW.SITE + '/launch" style="color:#8a6d1f;font-size:13.5px">Questions about your plan? Start here →</a></p>' +

    ptimelineHtml_(r) +
    '<p>Any question at all, reply to this email — the branch and the team are copied.</p>',
    'Enrolment complete — thank you');
  return { subject: subject, html: html };
}

function pMailProgress_(r) {
  var t = ptimeline_(r);
  var subject = 'Progress on the pension for ' + (r['employee'] || 'your employee') + ' — ' + t.stageLabel;
  var html = pwrap_(
    '<p>A short note so you both know exactly where this stands.</p>' +
    '<p><b>' + esc_(r['employee']) + '</b> · ' + esc_(r['company']) + (r['plan'] ? ' · ' + esc_(r['plan']) : '') + '</p>' +
    ptimelineHtml_(r) +
    pnote_('<b>Right now:</b> ' + esc_(t.stageLabel) + '.' +
      (t.stage === 'bir' ? ' B.I.R. approval is outside our hands and is the step that usually takes longest — we chase it.' : '') +
      (t.stage === 'issued' ? ' Guardian is issuing the policy and assigning the number.' : '')) +
    '<p>Nothing is needed from either of you at this step. We will write again in about ' + PFLOW.PROGRESS_EVERY_DAYS +
      ' days, or sooner if it moves.</p>' +
    pbtn_(plink_(r['employee code']), 'See it for yourself →'),
    'Progress · ' + t.stageLabel);
  return { subject: subject, html: html };
}

function pMailDelivered_(r) {
  var first = String(r['employee'] || '').trim().split(/\s+/)[0] || 'there';
  var subject = 'Delivered — the pension for ' + (r['employee'] || '') + ' is in force';
  var html = pwrap_(
    '<p>Dear ' + esc_(first) + ' and ' + esc_(r['company']) + ',</p>' +
    '<p><b>It is done.</b> The policy has been delivered and the plan is in force' +
      (r['policy #'] ? ', under policy number <b>' + esc_(r['policy #']) + '</b>' : '') + '.</p>' +
    pnote_('Keep the policy document somewhere safe. If anything changes — an address, a beneficiary, ' +
      'a contribution you want to raise — tell us and we will handle it. Reviewing it once a year is a good habit, ' +
      'and we will remind you.') +
    ptimelineHtml_(r) +
    '<p>Thank you both. It has been a pleasure to put this in place.</p>',
    'Delivered — the plan is in force');
  return { subject: subject, html: html };
}

/* ─────────────────────────── the two submissions ─────────────────────────── */

function pstr_(v, n) { return String(v == null ? '' : v).slice(0, n || 200).trim(); }
function pnum_(v) { var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? '' : n; }

/**
 * The employer's part. Creates the enrolment, issues the employee's access
 * code, and writes to the employee straight away.
 */
function penrolEmployerSubmit_(p) {
  var companyCode = codeKey_(p.companyCode);
  var company = pensionCompanies_().filter(function (c) { return codeKey_(c['company code']) === companyCode; })[0];
  if (!company) return { ok: false, error: 'That company code was not recognised.' };

  var employeeEmail = pstr_(p.employeeEmail, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(employeeEmail)) {
    return { ok: false, error: 'We need a valid email address for the employee — that is how they are invited.' };
  }
  if (!pstr_(p.employee)) return { ok: false, error: 'The employee’s name is needed.' };

  var used = {};
  penrolAll_().forEach(function (r) { used[codeKey_(r['employee code'])] = true; });
  pensionEmployees_().forEach(function (r) { used[codeKey_(r['access code'])] = true; });
  var code = '';
  for (var i = 0; i < 200 && !code; i++) { var c = pensionCode_('EM'); if (!used[codeKey_(c)]) code = c; }

  var id = pnewId_();
  var now = new Date();
  var sh = penrolSheet_();
  var map = headerMap_(sh);
  var row = new Array(sh.getLastColumn()).fill('');
  function put(h, v) { var c = col_(map, h.toLowerCase()); if (c >= 0) row[c] = v; }
  put('id', id); put('created', now);
  put('company code', company['company code']); put('company', company['company']);
  put('company contact', company['contact']); put('company email', company['contact email']);
  put('employee', pstr_(p.employee)); put('employee email', employeeEmail);
  put('employee mobile', pstr_(p.employeeMobile, 60)); put('employee code', code);
  put('agent', pstr_(p.agent) || company['agent'] || CONFIG.AGENT_NAME);
  put('agent no.', company['agent no.'] || '');
  put('position', pstr_(p.position, 80));
  put('department', pstr_(p.department, 80));
  put('employed since', pstr_(p.employedSince, 40));
  put('first deduction', pstr_(p.firstDeduction, 40));
  put('plan', pstr_(p.plan, 80));
  put('company annual (tt$)', pnum_(p.companyAnnual));
  put('company lump sum (tt$)', pnum_(p.companyLump));
  put('commencement', pstr_(p.commencement, 40));
  put('salary (tt$)', pnum_(p.salary));
  put('maturity age', pstr_(p.maturityAge, 10));
  put('guarantee (yrs)', pstr_(p.guarantee, 10));
  put('employer part done', now);
  put('employer by', pstr_(p.submittedBy, 120));
  put('stage', 'Awaiting the employee');
  put('reminders sent', 0);
  sh.appendRow(row);

  var r = penrolById_(id);
  var mail = pMailEmployeeInvite_(r);
  var threadId = pSendFirst_(r, mail.subject, mail.html);
  penrolSetMany_(r, { 'Thread Id': threadId, 'Last Reminder': now });
  pact_(id, r['employee'], 'sent: invitation to the employee', r['employee email'], mail.subject);
  pact_(id, r['employee'], 'employer part complete', pstr_(p.submittedBy), r['plan']);

  return { ok: true, id: id, employeeCode: code, stage: penrolStageName_(r) };
}

/**
 * The employee's part. Closes the enrolment and thanks both sides.
 * Documents arrive as data: URLs and are filed in Drive, never in the sheet.
 */
function penrolEmployeeSubmit_(p) {
  var r = penrolAll_().filter(function (x) { return codeKey_(x['employee code']) === codeKey_(p.code); })[0];
  if (!r) return { ok: false, error: 'That code was not recognised.' };
  if (r['employee part done']) return { ok: false, error: 'Your part is already complete — thank you. Nothing more is needed.' };

  var docs = '';
  try { docs = pfileDocs_(r, p.documents || []); }
  catch (err) { docs = 'Upload failed — ' + err; }

  if (!pstr_(p.dob)) return { ok: false, error: 'Your date of birth is needed — the declarations cannot be completed without it.' };

  var now = new Date();
  penrolSetMany_(r, {
    'Date of Birth': pstr_(p.dob, 40),
    'Employee B.I.R. File #': pstr_(p.employeeBir, 40),
    'Employee Address': pstr_(p.employeeAddress, 200),
    'Marital Status': pstr_(p.marital, 30),
    'Employee Monthly (TT$)': pnum_(p.employeeMonthly),
    'Employee Plan': pstr_(p.employeePlan, 80),
    'Retirement Age': pstr_(p.retirementAge, 10),
    'Employee Guarantee': pstr_(p.employeeGuarantee, 10),
    'Beneficiaries': pstr_(p.beneficiaries, 500),
    'Employee Mobile': pstr_(p.employeeMobile, 60) || r['employee mobile'],
    'Documents': docs,
    'Employee Part Done': now,
    'Stage': 'With the B.I.R.',
    'BIR Sent': now,
  });

  var mail = pMailBothComplete_(r);
  pReply_(r, mail.subject, mail.html);
  pact_(r['id'], r['employee'], 'sent: enrolment complete, going to B.I.R.', r['employee email'], mail.subject);
  pact_(r['id'], r['employee'], 'employee part complete', r['employee email'], docs);

  return { ok: true, id: r['id'], stage: penrolStageName_(r) };
}

/** Files whatever the employee uploaded into a folder of their own. */
function pfileDocs_(r, list) {
  if (!list || !list.length) return '';
  var root;
  var folders = DriveApp.getFoldersByName('Pension Enrolments');
  root = folders.hasNext() ? folders.next() : DriveApp.createFolder('Pension Enrolments');
  var name = r['id'] + ' — ' + r['employee'];
  var subs = root.getFoldersByName(name);
  var folder = subs.hasNext() ? subs.next() : root.createFolder(name);
  var urls = [];
  list.slice(0, 8).forEach(function (d) {
    var m = /^data:([^;]+);base64,(.+)$/.exec(String(d.data || ''));
    if (!m) return;
    var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], pstr_(d.name, 80) || 'document');
    urls.push(folder.createFile(blob).getUrl());
  });
  return urls.join('\n');
}

/* ─────────────────────────── the 9am automation ─────────────────────────── */

function pdaysSince_(v) {
  var d = asDate_(v);
  if (!d) return null;
  return Math.floor((new Date() - d) / 86400000);
}

/**
 * Runs every morning. Chases the employee daily until their part is in, and
 * tells both sides where things stand every ten days until it is delivered.
 */
function pensionDaily() {
  var rows = penrolAll_();
  var reminded = 0, progressed = 0, delivered = 0;

  rows.forEach(function (r) {
    if (!r['id']) return;
    var t = ptimeline_(r);

    /* 1. the employee has not done their part — every morning, until they have */
    if (r['employer part done'] && !r['employee part done']) {
      var sinceLast = pdaysSince_(r['last reminder']);
      var sinceStart = pdaysSince_(r['employer part done']);
      if (sinceLast !== null && sinceLast < 1) return;      // already written today
      if (sinceStart !== null && sinceStart > PFLOW.REMIND_STOP_AFTER) {
        // Past this point a daily email is noise, not service. Hand it to a person.
        if (String(r['stage']).indexOf('stalled') < 0) {
          penrolSet_(r, 'Stage', 'Stalled — needs a phone call');
          pact_(r['id'], r['employee'], 'reminders stopped, handed to the team', '', sinceStart + ' days with no response');
        }
        return;
      }
      var m = pMailEmployeeReminder_(r);
      pReply_(r, m.subject, m.html);
      penrolSetMany_(r, { 'Reminders Sent': Number(r['reminders sent'] || 0) + 1, 'Last Reminder': new Date() });
      pact_(r['id'], r['employee'], 'sent: reminder ' + (Number(r['reminders sent'] || 0)), r['employee email'], m.subject);
      reminded++;
      return;
    }

    /* 2. delivered today — say so once, then leave them alone */
    if (t.complete) {
      if (String(r['stage']) !== 'Delivered') {
        var d = pMailDelivered_(r);
        pReply_(r, d.subject, d.html);
        penrolSetMany_(r, { 'Stage': 'Delivered', 'Last Progress Note': new Date() });
        pact_(r['id'], r['employee'], 'sent: delivered', r['employee email'], d.subject);
        delivered++;
      }
      return;
    }

    /* 3. in flight — a progress note to both sides every ten days */
    if (r['employee part done']) {
      var sinceNote = pdaysSince_(r['last progress note']);
      if (sinceNote === null || sinceNote >= PFLOW.PROGRESS_EVERY_DAYS) {
        var pmail = pMailProgress_(r);
        pReply_(r, pmail.subject, pmail.html);
        penrolSetMany_(r, { 'Last Progress Note': new Date(), 'Stage': t.stageLabel });
        pact_(r['id'], r['employee'], 'sent: progress note', r['employee email'], t.stageLabel);
        progressed++;
      }
    }
  });

  return { reminded: reminded, progressed: progressed, delivered: delivered };
}

function installPensionTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pensionDaily') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pensionDaily').timeBased().everyDays(1).atHour(PFLOW.REMIND_HOUR).create();
  penrolSheet_(); pactSheet_(); pensionCompaniesSheet_(); pensionEmployeesSheet_();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Pension automation installed — runs at ' + PFLOW.REMIND_HOUR + 'am daily.');
}

/** Runs the morning pass now, for testing, and says what it did. */
function pensionRunNow() {
  var out = pensionDaily();
  SpreadsheetApp.getUi().alert(
    'Pension automation ran.\n\n' +
    out.reminded + ' employee reminder(s)\n' +
    out.progressed + ' progress note(s)\n' +
    out.delivered + ' delivery note(s)');
}

/* ─────────────────────────── moving it along ─────────────────────────── */

/**
 * The branch marks the next step done on the selected row. Everything the
 * clients see updates from this, and the next progress note carries it.
 */
function pensionAdvanceSelected() {
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== PFLOW.SHEET) {
    SpreadsheetApp.getUi().alert('Open the "' + PFLOW.SHEET + '" tab and put the cursor on the enrolment first.');
    return;
  }
  var rowIndex = sh.getActiveRange().getRow();
  if (rowIndex < 2) { SpreadsheetApp.getUi().alert('Put the cursor on an enrolment row.'); return; }
  var all = penrolAll_();
  var r = all.filter(function (x) { return x._row === rowIndex; })[0];
  if (!r) { SpreadsheetApp.getUi().alert('That row is not an enrolment.'); return; }

  var t = ptimeline_(r);
  if (t.complete) { SpreadsheetApp.getUi().alert('This one is already delivered.'); return; }
  var next = PSTEPS.filter(function (s) { return !r[s.col]; })[0];
  if (next.key === 'employee') {
    SpreadsheetApp.getUi().alert('The employee has not completed their part yet — that step is theirs to finish, ' +
      'not ours to mark. They are being reminded every morning.');
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('Mark "' + next.label + '" done for ' + r['employee'] + '?',
    'Both sides are told at the next progress note, or immediately if this is delivery.', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;

  var when = new Date();
  var header = PSTEPS.filter(function (s) { return s.key === next.key; })[0].col;
  penrolSet_(r, header, when);
  if (next.key === 'issued' && !r['policy #']) {
    var resp = ui.prompt('Policy number', 'Type the policy number Guardian assigned (or leave blank).', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() === ui.Button.OK && resp.getResponseText()) {
      penrolSet_(r, 'Policy #', resp.getResponseText().trim());
    }
  }
  var t2 = ptimeline_(r);
  penrolSet_(r, 'Stage', t2.stageLabel);
  pact_(r['id'], r['employee'], 'advanced to ' + next.label, '', '');

  if (t2.complete) {
    var d = pMailDelivered_(r);
    pReply_(r, d.subject, d.html);
    penrolSetMany_(r, { 'Stage': 'Delivered', 'Last Progress Note': when });
    pact_(r['id'], r['employee'], 'sent: delivered', r['employee email'], d.subject);
    ui.alert('Marked delivered, and both sides have been told.');
  } else {
    ui.alert('Marked "' + next.label + '". Now at: ' + t2.stageLabel + '.');
  }
}

/* ─────────────────────────── what the website reads ─────────────────────────── */

/** One enrolment, as the employer's schedule shows it. */
function penrolForEmployer_(r) {
  var t = ptimeline_(r);
  return {
    id: r['id'], name: r['employee'], plan: r['plan'],
    companyAnnual: Number(r['company annual (tt$)'] || 0),
    companyLump: Number(r['company lump sum (tt$)'] || 0),
    employeeMonthly: Number(r['employee monthly (tt$)'] || 0),
    commencement: fmtDate_(r['commencement']),
    policy: r['policy #'] || '',
    stage: t.stageLabel, pct: t.pct, steps: t.steps,
    waitingOnEmployee: !!(r['employer part done'] && !r['employee part done']),
    remindersSent: Number(r['reminders sent'] || 0),
  };
}

/**
 * A completed enrolment, in exactly the shape the wizard's own case file uses.
 * This is the point of collecting the fields in the first place: an agent
 * loads it in Step 1 and every form — Declaration 1, Declaration 2, the salary
 * deduction authority and the B.I.R. request — prints out filled, without
 * anybody retyping what two people already typed.
 */
function penrolCase_(r) {
  var co = pensionCompanies_().filter(function (c) {
    return codeKey_(c['company code']) === codeKey_(r['company code']);
  })[0] || {};
  return {
    coName: String(r['company'] || ''),
    coInc: fmtDate_(co['incorporated']),
    coBir: String(co['bir file #'] || ''),
    coAddr: String(co['address'] || ''),
    empName: String(r['employee'] || ''),
    empDob: fmtDate_(r['date of birth']),
    empBir: String(r['employee b.i.r. file #'] || ''),
    empAddr: String(r['employee address'] || ''),
    empPhone: String(r['employee mobile'] || ''),
    empEmail: String(r['employee email'] || ''),
    empMarital: String(r['marital status'] || ''),
    empJob: String(r['position'] || ''),
    empDept: String(r['department'] || ''),
    empEmpDate: fmtDate_(r['employed since']),
    salary: String(r['salary (tt$)'] || ''),
    co6a: String(r['company annual (tt$)'] || ''),
    co6b: String(r['company lump sum (tt$)'] || ''),
    planStart: fmtDate_(r['commencement']),
    firstPay: fmtDate_(r['first deduction']),
    employerPlan: String(r['plan'] || ''),
    employerVestAge: String(r['maturity age'] || ''),
    employerGuarantee: String(r['guarantee (yrs)'] || ''),
    empPortion: String(r['employee monthly (tt$)'] || ''),
    employeePlan: String(r['employee plan'] || ''),
    empRetAge: String(r['retirement age'] || ''),
    empGuarantee: String(r['employee guarantee'] || ''),
    agentName: String(r['agent'] || ''),
    agentNo: String(r['agent no.'] || ''),
    beneficiariesText: String(r['beneficiaries'] || ''),
  };
}

/** One enrolment, as the employee sees their own. */
function penrolForEmployee_(r) {
  var e = penrolForEmployer_(r);
  e.company = r['company'];
  e.beneficiaries = r['beneficiaries'] || '';
  e.agent = r['agent'] || '';
  e.yourPartDone = !!r['employee part done'];
  return e;
}
