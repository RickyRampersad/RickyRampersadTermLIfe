// ═════════════════════════════════════════════════════════════════════════════
//  RR BRANCH — EMAIL STANDARDISATION
//
//  Paste as a NEW script file named  RRBranchEmails  in "RR Branch FF System",
//  then make the three edits described under INSTALL below.
//
//  What this fixes
//  ───────────────
//  1. The agent's copy was the only email sent as PLAIN TEXT — every other
//     message uses the branded rrbHead_/rrbFoot_ shell. That is why two emails
//     about the same submission looked like they came from different systems.
//     It now uses the same shell as the manager's.
//
//  2. The client received nothing at submission. rrbSendClientDraft() and
//     rrbClientDraftHtml_() were both fully written — the wiring was left as a
//     COMMENT in RRB_Additions.gs and never connected. It is connected here.
//
//  3. Nothing said DRAFT. Every pre-approval message now carries the same
//     banner and a [DRAFT] subject prefix, so nobody mistakes a submitted fact
//     find for an approved one.
//
//  4. Every message now ends with the same standardised action button.
//
//  ── INSTALL ────────────────────────────────────────────────────────────────
//  (a) RRB_Additions.gs — function ffSendAgentCopyEmail_(d, nextReviewer, skipped)
//      Replace its ENTIRE body with:
//          return rrbSendAgentCopy_(d, nextReviewer, skipped);
//
//  (b) RRB_Additions.gs — function ffSendReviewEmail_(d, reviewer, role, dmInfo)
//      Find:      var html = rrbManagerReviewHtml_(d, link);
//      Replace:   var html = rrbWithDraft_(rrbManagerReviewHtml_(d, link));
//      and change the subject line assignment from
//                 var subject = "Fact find for review — "
//      to         var subject = "[DRAFT] Fact find for review — "
//
//  (c) Code.gs — function ffProcessAgentSubmit(data), immediately after the
//      existing agent-copy block:
//
//          // Agent's own copy — instant confirmation with view link + FI snapshot
//          try { ffSendAgentCopyEmail_(data, nextReviewer, skipsDirectStage); }
//          catch (err) { Logger.log("Agent copy email failed: " + err); }
//
//      add:
//
//          // The client's draft acknowledgement. Written long ago, never wired up.
//          try { rrbSendClientDraftNow_(data); }
//          catch (err) { Logger.log("Client draft email failed: " + err); }
//
//  Run  rrbEmailPreview()  afterwards to see every template in the log without
//  sending anything, and  rrbEmailTest('you@example.com')  to send yourself one
//  of each.
// ═════════════════════════════════════════════════════════════════════════════


// ── The DRAFT marker ────────────────────────────────────────────────────────
// One banner, one wording, used by every pre-approval message. A fact find that
// has been submitted is not a recommendation the client can rely on, and saying
// so plainly is cheaper than explaining it later.

function rrbDraftBanner_(note) {
  return '<table role="presentation" width="100%" style="border-collapse:collapse;' +
    'background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;margin:0 0 18px">' +
    '<tr><td style="padding:12px 14px">' +
      '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;' +
        'font-weight:800;color:#B45309">Draft &middot; not yet approved</div>' +
      '<div style="font-size:13px;color:#78350F;margin-top:4px;line-height:1.5">' +
        (note || 'This fact find is with a manager for review. Nothing here is final, ' +
                 'and no plan should be presented as approved until the branch confirms it.') +
      '</div>' +
    '</td></tr></table>';
}

/**
 * Inserts the draft banner into any message built with rrbHead_, without having
 * to edit that template. rrbHead_ ends by opening the content div; the banner
 * goes immediately inside it. If the shell ever changes shape the marker is not
 * found and the message is returned untouched rather than corrupted.
 */
function rrbWithDraft_(html, note) {
  var marker = '<div style="padding:20px 22px;background:';
  var i = String(html).indexOf(marker);
  if (i < 0) return html;
  var j = html.indexOf('">', i);
  if (j < 0) return html;
  return html.slice(0, j + 2) + rrbDraftBanner_(note) + html.slice(j + 2);
}

/** The one action button. Same shape everywhere — agent, manager, client. */
function rrbButton_(label, url, colour) {
  return '<div style="text-align:center;margin:22px 0 6px">' +
    '<a href="' + url + '" style="display:inline-block;background:' + (colour || '#0D9488') +
      ';color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;' +
      'font-weight:800;font-size:15px">' + label + '</a>' +
    '</div>';
}

/** Small label/value row, so every template presents facts the same way. */
function rrbRow_(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return '<tr>' +
    '<td style="padding:6px 12px 6px 0;color:#64748B;font-size:13px;white-space:nowrap">' + label + '</td>' +
    '<td style="padding:6px 0;font-size:13.5px;font-weight:600;color:#0F172A">' + value + '</td>' +
  '</tr>';
}

// Money formatting deliberately reuses the project's existing rrbMoney_ rather
// than defining another one — a second copy would shadow it and the templates
// would start disagreeing about how figures look.


// ── The agent's copy, in the same shell as everything else ──────────────────

function rrbAgentCopyHtml_(d, nextReviewer) {
  var client = _str(d.clientName) || 'your client';
  var mgr    = (nextReviewer && nextReviewer.name) || 'your Direct Manager';

  var h = rrbHead_('Submitted &mdash; ' + client,
                   'Your copy. This case is now with ' + mgr + '.');
  h += rrbDraftBanner_('You submitted this fact find. It is a draft until ' + mgr +
                       ' reviews and signs it off. Please do not present it to the client as approved.');

  h += '<table role="presentation" style="border-collapse:collapse;margin:0 0 6px">';
  h += rrbRow_('Client', _str(d.clientName));
  h += rrbRow_('Submitted', _str(d.submittedAt).substring(0, 10));
  h += rrbRow_('With', mgr);
  h += rrbRow_('Insurance need', rrbMoney_(d.insuranceNeed_calc));
  h += rrbRow_('Cover recommended', rrbMoney_(d.fi_packageTotal));
  h += rrbRow_('Decision', _str(d.finalDecide));
  h += '</table>';

  // Anything the manager is going to ask about, surfaced before they ask.
  var flags = [];
  if (rrbTruthy_(d.repDetected))   flags.push('Replacement of existing cover detected &mdash; the declaration must be raised.');
  if (rrbTruthy_(d.fi_uwEvidence)) flags.push('Medical evidence will be required &mdash; expect an underwriting delay.');
  var prem = 0;
  for (var i = 1; i <= 6; i++) prem += parseFloat(String(d['rec' + i + 'Prem'] || '').replace(/[^0-9.]/g, '')) || 0;
  var surplus = parseFloat(String(d.cashSurplus_calc || '').replace(/[^0-9.\-]/g, '')) || 0;
  if (prem > 0 && surplus > 0 && prem / surplus >= 0.5) {
    flags.push('Recommended premium is ' + Math.round(100 * prem / surplus) +
               '% of the client\'s stated monthly surplus. Above 80% these rarely persist.');
  }
  if (flags.length) {
    h += '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px 14px;margin:14px 0">' +
         '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#B91C1C">' +
         'Expect questions on</div><ul style="margin:8px 0 0 18px;padding:0;font-size:13px;color:#7F1D1D;line-height:1.55">' +
         flags.map(function (f) { return '<li style="margin:3px 0">' + f + '</li>'; }).join('') +
         '</ul></div>';
  }

  h += '<p style="font-size:14px;color:#334155;line-height:1.6;margin:14px 0 0">' +
       'You will be emailed again the moment ' + mgr + ' records a decision. ' +
       'Until then the case sits in the review queue and the client has been sent a draft acknowledgement.' +
       '</p>';

  h += rrbButton_('Open this case', ffViewLink_(d.submissionId));
  h += rrbFoot_(_str(d.submissionId));
  return h;
}

/** Body of ffSendAgentCopyEmail_. Same shell, same branding, PDF still attached. */
function rrbSendAgentCopy_(d, nextReviewer, skipped) {
  if (!d || !d.agentEmail) { Logger.log('rrbSendAgentCopy_: no agent email on %s', d && d.submissionId); return; }
  nextReviewer = nextReviewer || MAIL_CONFIG.managers[d.directManagerKey || d.reviewerKey || 'ricky'] ||
                 MAIL_CONFIG.managers.ricky;

  var subject = '[DRAFT] Your copy — ' + (_str(d.clientName) || 'fact find');
  var html = rrbAgentCopyHtml_(d, nextReviewer);
  var att = ffBuildPdfAttachment_(d);

  var opts = { to: d.agentEmail, subject: subject, htmlBody: html, name: 'RR Branch Fact Find' };
  if (att) {
    try { opts.attachments = [att]; MailApp.sendEmail(opts); return; }
    catch (e) {
      Logger.log('Agent copy with attachment failed, retrying without: %s', e);
      delete opts.attachments;
      opts.subject = subject + ' (PDF too large to attach — open the link)';
    }
  }
  MailApp.sendEmail(opts);
}


// ── The client's draft acknowledgement, finally connected ───────────────────

/**
 * Wraps the existing rrbSendClientDraft() so the draft banner is applied and a
 * missing client email is logged rather than silent. Call this from
 * ffProcessAgentSubmit — see INSTALL (c).
 */
/** Every field the client's address can arrive in. */
function rrbClientEmail_(d) {
  // A Specific Need Only case captures the client in section 1, so the address
  // lands in adviceClientEmail and neither of the other two is set. Reading
  // only email and clientEmail meant every limited-scope client silently got
  // nothing — the fact find sent, the manager was told, and the person it was
  // about heard nothing.
  var tries = [d.email, d.clientEmail, d.adviceClientEmail, d.clientEmailAddress];
  for (var i = 0; i < tries.length; i++) {
    var v = _str(tries[i]);
    if (v && v.indexOf('@') > 0) return v;
  }
  return '';
}

function rrbSendClientDraftNow_(d) {
  var to = rrbClientEmail_(d);
  if (!to) {
    Logger.log('rrbSendClientDraftNow_: no client email on %s — nothing sent. ' +
               'Capture the client email on the fact find to close this gap.', d.submissionId);
    return;
  }
  var adv = _str(d.advisorName).split(' ')[0] || 'your advisor';
  var subject = '[DRAFT] Thank you for meeting ' + adv + ' — your plan is being reviewed';
  var html = rrbWithDraft_(rrbClientDraftHtml_(d) + rrbClientConfirmBlock_(d),
    'This is a summary of what you discussed with ' + adv + '. It is being reviewed by a ' +
    'branch manager and is not final. You will receive the approved version once that review is complete.');
  rrbMail_(to, subject, html, RRB_ALWAYS_CC);
  Logger.log('Client draft sent to %s for %s', to, d.submissionId);
}

function rrbTruthy_(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined || v === '') return false;
  var s = String(v).trim().toLowerCase();
  return !(s === 'no' || s === 'n' || s === 'false' || s === '0' || s === '-');
}


// ── Check it before anyone else sees it ─────────────────────────────────────

function rrbEmailSample_() {
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  if (sheet.getLastRow() < 2) return null;
  return ffReadRow_(sheet, headers, sheet.getLastRow());
}

/** Logs which templates build cleanly, against a real row. Sends nothing. */
function rrbEmailPreview() {
  var d = rrbEmailSample_();
  if (!d) { Logger.log('No rows in ffRevised to preview against.'); return; }
  Logger.log('Previewing against submission %s (%s)', d.submissionId, d.clientName);
  var rev = MAIL_CONFIG.managers[d.directManagerKey || d.reviewerKey || 'ricky'] || MAIL_CONFIG.managers.ricky;

  function tryOne(name, fn) {
    try {
      var h = fn();
      var draft = String(h).indexOf('Draft &middot; not yet approved') > -1;
      Logger.log('  %-24s %6s chars   draft banner: %s', name, String(h).length, draft ? 'yes' : 'no');
    } catch (e) { Logger.log('  %-24s FAILED: %s', name, e.message); }
  }
  tryOne('agent copy',      function () { return rrbAgentCopyHtml_(d, rev); });
  tryOne('manager review',  function () { return rrbWithDraft_(rrbManagerReviewHtml_(d, ffReviewLink_(d.submissionId, 'manager'))); });
  tryOne('client draft',    function () { return rrbWithDraft_(rrbClientDraftHtml_(d)); });
  tryOne('agent approved',  function () { return rrbAgentApprovedHtml_(d); });
  tryOne('agent declined',  function () { return rrbAgentDeclinedHtml_(d); });
  tryOne('client approved', function () { return rrbClientApprovedHtml_(d); });
  Logger.log('The three pre-approval templates should show a draft banner; the ' +
             'three post-approval ones should not.');
}

/** Sends one of each to an address you name, so you can see them side by side. */
function rrbEmailTest(to) {
  if (!to || String(to).indexOf('@') < 0) { Logger.log('Pass an email address: rrbEmailTest("you@example.com")'); return; }
  var d = rrbEmailSample_();
  if (!d) { Logger.log('No rows in ffRevised to test with.'); return; }
  var rev = MAIL_CONFIG.managers[d.directManagerKey || d.reviewerKey || 'ricky'] || MAIL_CONFIG.managers.ricky;

  MailApp.sendEmail({ to: to, subject: '[TEST 1/3 DRAFT] Agent copy',
    htmlBody: rrbAgentCopyHtml_(d, rev), name: 'RR Branch Fact Find' });
  MailApp.sendEmail({ to: to, subject: '[TEST 2/3 DRAFT] Manager review',
    htmlBody: rrbWithDraft_(rrbManagerReviewHtml_(d, ffReviewLink_(d.submissionId, 'manager'))), name: 'RR Branch Fact Find' });
  MailApp.sendEmail({ to: to, subject: '[TEST 3/3 DRAFT] Client acknowledgement',
    htmlBody: rrbWithDraft_(rrbClientDraftHtml_(d)), name: 'RR Branch Fact Find' });
  Logger.log('Three test emails sent to %s using submission %s.', to, d.submissionId);
}


// ═══════════════════════════════════════════════════════════════════════════
// SPECIFIC NEED ONLY
//
// A client may ask to be advised on one need without disclosing their whole
// financial position. The Insurance Act 2018, Schedule 11 allows it, and the
// form already honours it — sections 2-9 are hidden and their validation is
// waived.
//
// The emails did not honour it. They ran the full needs analysis over a client
// who disclosed nothing, so the manager received "no sums assured entered",
// "occupation not recorded", "$0 income" — every one of them presented as a
// failing by the advisor, when in fact each one is the client's recorded
// choice. That is what made these reviews confusing to answer.
//
// So the scope overrides everything downstream of it, the same way it
// overrides the form.
// ═══════════════════════════════════════════════════════════════════════════

/** True when the client elected Specific Need Only. */
function rrbIsAdviceOnly_(d) {
  return /^advice$/i.test(_str(d && d.appType));
}

/**
 * The review subject line. A manager triaging an inbox should be able to tell
 * a limited-scope approval from a full one without opening anything.
 */
function rrbReviewSubject_(d) {
  var client  = _str(d.clientName) || _str(d.fullName) || 'Client';
  var advisor = _str(d.advisorName) || _str(d.agentCode) || '';
  var who     = advisor ? ' (' + advisor + ')' : '';
  return rrbIsAdviceOnly_(d)
    ? '[DRAFT] Specific Need Only — approval required — ' + client + who
    : '[DRAFT] Fact find for review — ' + client + who;
}

/** The recommendation lines, as entered by the advisor. */
function rrbRecLines_(d) {
  var out = [];
  for (var i = 1; i <= 6; i++) {
    var plan = _str(d['rec' + i + 'Rec']);
    if (!plan) continue;
    out.push({
      need:   _str(d['rec' + i + 'Need']),
      plan:   plan,
      reason: _str(d['rec' + i + 'Reason']),
      amt:    rrbNum_(d['rec' + i + 'Amt']),
      prem:   rrbNum_(d['rec' + i + 'Prem'])
    });
  }
  return out;
}

/**
 * The manager's review email for a Specific Need Only case.
 *
 * Deliberately short. There is no needs analysis to check the recommendation
 * against, so presenting dials and shortfalls would be presenting zeroes as
 * findings. What is left is the only question that can actually be answered:
 * does this product suit the need the client described, and is the reason on
 * file good enough to stand behind.
 */
function rrbAdviceReviewHtml_(d, link) {
  var mgrFirst = _str(d.reviewerName).split(' ')[0] || 'there';
  var client   = _str(d.clientName) || _str(d.adviceClientName) || '(client)';
  var advisor  = _str(d.advisorName) || '(advisor)';
  var advFirst = advisor.split(' ')[0] || 'the advisor';
  var recs     = rrbRecLines_(d);

  var chk = rrbChecks_(d);

  var h = rrbHead_(client + ' &mdash; Specific Need Only',
                   'From ' + advisor + ' &middot; due back by ' + rrbDueDate_(d.submittedAt));
  h += '<p style="margin:0 0 15px">Hi ' + mgrFirst + ',</p>';

  // The decision sits above everything. A manager who already knows this case
  // should not have to scroll past the reasoning to record it.
  h += rrbDecisionBlock_(d, { name: d.reviewerName, email: d.reviewerEmail });
  h += '<div style="height:1px;background:#E2E8F0;margin:20px 0 16px"></div>';


  // ── Why this review looks different from the others in the inbox.
  h += '<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:11px;' +
       'padding:13px 16px;margin-bottom:15px;font-size:13.5px;color:#78350F;line-height:1.6">' +
       '<strong>The client declined full financial disclosure.</strong> Under the Insurance ' +
       'Act 2018, Schedule 11, a client may ask to be advised on one specific need without ' +
       'disclosing their wider position. ' + client + ' chose that, so sections 2&ndash;9 were ' +
       'not completed.' +
       '<div style="margin-top:8px">That is a client decision on the record &mdash; not a gap ' +
       'in ' + advFirst + '&rsquo;s work. There is no needs analysis here to check the ' +
       'recommendation against, so please do not read the blank sections as findings.</div>' +
       '</div>';

  // Bio data is checkable even when the finances are not — confirming it is
  // exactly what a manager can usefully do on a limited-scope case. The notice
  // above frames these, so it has to come first.
  h += rrbBioBlock_(chk);
  h += rrbConcernsBlock_(chk);

  // ── The whole substance of the case.
  if (!recs.length) {
    h += '<div style="background:#fff;border:1px solid #FCA5A5;border-radius:11px;padding:14px 16px;' +
         'margin-bottom:15px;font-size:13.5px;color:#991B1B">' +
         'No recommendation has been recorded. A Specific Need Only case is <em>only</em> the ' +
         'need, the product and the reason &mdash; with none of them entered there is nothing ' +
         'to approve. Worth sending back to ' + advFirst + '.</div>';
  } else {
    var premTotal = 0;
    h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:11px;padding:4px 16px 14px;margin-bottom:15px">' +
         '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;' +
         'font-weight:700;margin:13px 0 4px">What is being recommended</div>';
    recs.forEach(function (r, i) {
      premTotal += r.prem;
      h += '<div style="padding:11px 0' + (i ? '' : '') +
           ';border-top:1px solid ' + (i ? '#F1F5F9' : 'transparent') + '">' +
           '<div style="font-size:15px;font-weight:700;color:#0F172A">' + r.plan +
             (r.amt ? ' <span style="font-weight:600;color:#0F766E">' + rrbMoney_(r.amt) + '</span>' : '') +
           '</div>' +
           (r.need ? '<div style="font-size:13px;color:#475569;margin-top:3px">For: ' + r.need + '</div>' : '') +
           (r.prem ? '<div style="font-size:13px;color:#475569;margin-top:2px">Premium: ' + rrbMoney_(r.prem) + ' a month</div>' : '') +
           '<div style="font-size:13px;color:' + (r.reason ? '#334155' : '#B45309') + ';margin-top:6px;line-height:1.55">' +
             (r.reason ? '<strong style="color:#64748B;font-weight:600">Reason given:</strong> ' + r.reason
                       : 'No reason recorded for this recommendation &mdash; that is the one thing a limited-scope file must carry.') +
           '</div></div>';
    });
    if (premTotal) {
      h += '<div style="border-top:1px solid #E2E8F0;padding-top:10px;margin-top:4px;font-size:13.5px;color:#0F172A">' +
           '<strong>Total premium: ' + rrbMoney_(premTotal) + ' a month.</strong> ' +
           '<span style="color:#64748B">Affordability cannot be checked here &mdash; the client ' +
           'did not disclose income or outgoings.</span></div>';
    }
    h += '</div>';
  }

  // ── What the manager is actually being asked to attest to.
  h += '<div style="background:#F8FAFC;border-left:4px solid #0D9488;border-radius:0 10px 10px 0;' +
       'padding:13px 16px;margin-bottom:6px;font-size:13.5px;color:#134E4A;line-height:1.65">' +
       '<strong>Three things to satisfy yourself on:</strong>' +
       '<div style="margin-top:7px">1. The product suits the need the client actually described.</div>' +
       '<div style="margin-top:4px">2. The client was told that a policy bought without a full ' +
       'fact find may not suit their wider needs (Market Conduct Guideline).</div>' +
       '<div style="margin-top:4px">3. The reason on file would stand up if this case were ' +
       'inspected.</div></div>';

  h += rrbFoot_(_str(d.submissionId));
  return h;
}


// ═══════════════════════════════════════════════════════════════════════════
// DECIDE FROM THE EMAIL
//
// The review used to be: read a notification, open a link, load a long form,
// clear every finding, fill nine fields, sign, submit. On a phone, standing in
// a corridor, that does not happen — so cases sat.
//
// The email now carries the decision. The insights that justify it are in the
// message, only genuine concerns are raised, and the verdict is one tap. The
// full application is still one link away for a case that deserves it.
//
// What a tap records: the verdict, the reviewer named in the token, the
// timestamp, and the token's own id. That is the attestation. It replaces the
// drawn signature FOR EMAIL APPROVALS ONLY — opening the form and signing
// still works and still records a drawn signature. Authenticated, timestamped
// and attributable to one person, which is what the evidence has to be.
// ═══════════════════════════════════════════════════════════════════════════

/** Base URL of this web app. */
function rrbAppUrl_() {
  // APP_URL and RRB_APP_URL both point at the Netlify FORM — correct for a
  // review link a manager opens, wrong for anything that calls this script.
  // Trusting them sent the Approve buttons to Netlify, where they did nothing.
  // The running deployment is the authority; a constant is used only if it
  // actually looks like a web-app URL.
  var isExec = function (u) {
    return typeof u === 'string' &&
           /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/.test(u);
  };
  try { var u = ScriptApp.getService().getUrl(); if (isExec(u)) return u; } catch (e) {}
  try { if (isExec(RRB_APP_URL)) return RRB_APP_URL; } catch (e) {}
  try { if (isExec(APP_URL))     return APP_URL; } catch (e) {}
  try { return ScriptApp.getService().getUrl(); } catch (e) {}
  return '';
}

function rrbEsc_(s) {
  return _str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Stamp a token as spent so the link cannot be replayed. */
function rrbMarkTokenUsed_(row) {
  try { rrbTokenSheet_().getRange(row, 8).setValue(new Date()); } catch (e) {
    Logger.log('rrbMarkTokenUsed_ failed on row %s: %s', row, e && e.message);
  }
}

/**
 * The identity facts a manager verifies at a glance, and the concerns worth
 * raising. Everything else stays out of the email.
 *
 * Blank fields on a Specific Need Only case are reported as "not disclosed",
 * never as concerns — the client chose that, and dressing it as a finding is
 * what made these reviews unanswerable.
 */
function rrbChecks_(d) {
  var adviceOnly = rrbIsAdviceOnly_(d);
  var bio = [], concerns = [];

  function fact(label, value, criticalWhenFull) {
    var v = _str(value);
    if (v) { bio.push({ k: label, v: v, missing: false }); return; }
    bio.push({ k: label, v: adviceOnly ? 'not disclosed' : 'not recorded', missing: true });
    if (criticalWhenFull && !adviceOnly)
      concerns.push({ sev: 'bad', t: label + ' is missing',
                      why: 'Underwriting will bounce the application back without it.' });
  }

  fact('Client', _str(d.clientName) || _str(d.fullName) || _str(d.adviceClientName), true);
  fact('Date of birth', d.dob, true);
  fact('ID / DP / PP number', d.idNumber, true);
  if (!adviceOnly) {
    fact('Occupation', d.occupation, true);
    fact('Employer', d.employer, false);
    var inc = rrbNum_(d.monthlyIncomeTotal || d.monthlyIncome);
    fact('Monthly income', inc ? rrbMoney_(inc) : '', true);
    fact('Marital status', d.maritalStatus, false);
  } else {
    fact('Contact number', d.adviceClientPhone || d.phone || d.mobile, false);
    fact('Email', d.adviceClientEmail || d.email, false);
  }

  // ── Concerns that apply whatever the scope ──
  var recs = rrbRecLines_(d);
  if (!recs.length) {
    concerns.push({ sev: 'bad', t: 'No recommendation recorded',
                    why: 'There is nothing to approve.' });
  } else {
    var noReason = recs.filter(function (r) { return !r.reason; }).length;
    if (noReason) concerns.push({
      sev: 'bad', t: noReason + ' recommendation' + (noReason === 1 ? '' : 's') + ' with no reason given',
      why: adviceOnly ? 'On a limited-scope file the reason is the file.'
                      : 'The reason is what shows the advice was suitable.' });
  }

  if (/^(y|yes|true|1)$/i.test(_str(d.repDetected)) || /replac/i.test(_str(d.repDetected))) {
    concerns.push({ sev: 'bad', t: 'Existing cover is being replaced',
                    why: 'Replacement needs your eyes before this moves — this is the one that becomes a regulatory matter.' });
  }

  if (/^(y|yes|true|1)$/i.test(_str(d.fi_uwEvidence)) || _str(d.medical)) {
    var med = _str(d.medical);
    if (med && !/^(none|n\/a|no)$/i.test(med))
      concerns.push({ sev: 'warn', t: 'Medical evidence likely required',
                      why: rrbEsc_(med.slice(0, 120)) });
  }

  // ── Concerns that need disclosed data, so full-disclosure cases only ──
  if (!adviceOnly) {
    var need = rrbNum_(d.insuranceNeed_calc);
    var recTotal = recs.reduce(function (a, r) { return a + r.amt; }, 0);
    if (need > 0 && recTotal > 0) {
      var pct = Math.round((recTotal / need) * 100);
      if (pct < 80) concerns.push({ sev: 'warn', t: 'Recommendation covers ' + pct + '% of the assessed need',
                    why: 'If that is deliberate — budget, or staged — it should be written on the file.' });
      else if (pct > 125) concerns.push({ sev: 'warn', t: 'Recommendation is ' + pct + '% of the assessed need',
                    why: 'Worth confirming what justifies the extra.' });
    }
    var surplus = rrbNum_(d.cashSurplus_calc);
    var prem = recs.reduce(function (a, r) { return a + r.prem; }, 0);
    if (surplus > 0 && prem > 0) {
      var ratio = prem / surplus;
      if (ratio > 0.8) concerns.push({ sev: 'bad',
        t: 'Premium is ' + Math.round(ratio * 100) + '% of the client’s monthly surplus',
        why: 'This will not persist. Better rewritten than lapsed after the clawback.' });
      else if (ratio > 0.5) concerns.push({ sev: 'warn',
        t: 'Premium is ' + Math.round(ratio * 100) + '% of monthly surplus',
        why: 'Fragile — expect lapse on any income shock.' });
    }
  }

  return { bio: bio, concerns: concerns, adviceOnly: adviceOnly,
           clientEmail: rrbClientEmail_(d) };
}

/** The bio-data card. Shown on every review, whatever the scope. */
function rrbBioBlock_(chk) {
  var h = '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:11px;padding:13px 16px;margin-bottom:13px">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin-bottom:8px">' +
          'Check this is right</div><table role="presentation" width="100%" style="border-collapse:collapse">';
  chk.bio.forEach(function (b) {
    h += '<tr><td style="padding:4px 14px 4px 0;color:#64748B;font-size:12.5px;white-space:nowrap;vertical-align:top">' + rrbEsc_(b.k) + '</td>' +
         '<td style="padding:4px 0;font-size:13px;font-weight:600;color:' + (b.missing ? '#94A3B8' : '#0F172A') + '">' +
         rrbEsc_(b.v) + '</td></tr>';
  });
  h += '</table>';
  // Whether the person this is all about actually received their copy. A
  // manager approving a plan should not have to wonder.
  h += '<div style="margin-top:9px;padding:8px 11px;border-radius:7px;font-size:12px;' +
       (chk.clientEmail
         ? 'background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46">Draft copy sent to the client at ' +
           rrbEsc_(chk.clientEmail) + '.'
         : 'background:#FEF2F2;border:1px solid #FCA5A5;color:#991B1B"><strong>The client has been sent nothing.</strong> ' +
           'No email address was captured, so they are waiting on a copy that will never arrive.') +
       '</div>';
  return h + '</div>';
}

/** Concerns only. Silence when there is nothing wrong is the point. */
function rrbConcernsBlock_(chk) {
  if (!chk.concerns.length) {
    return '<div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:11px;padding:12px 16px;' +
           'margin-bottom:13px;font-size:13.5px;color:#065F46">' +
           '<strong>Nothing flagged.</strong> The checks RAI runs on this case all came back clean.</div>';
  }
  var h = '<div style="background:#fff;border:1px solid #FCD34D;border-radius:11px;padding:13px 16px;margin-bottom:13px">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#B45309;font-weight:700;margin-bottom:9px">' +
          chk.concerns.length + ' thing' + (chk.concerns.length === 1 ? '' : 's') + ' to look at</div>';
  chk.concerns.forEach(function (c, i) {
    var red = c.sev === 'bad';
    h += '<div style="padding:9px 0;border-top:1px solid ' + (i ? '#F1F5F9' : 'transparent') + '">' +
         '<div style="font-size:13.5px;font-weight:700;color:' + (red ? '#991B1B' : '#B45309') + '">' +
         (red ? '&#9679; ' : '&#9675; ') + rrbEsc_(c.t) + '</div>' +
         '<div style="font-size:12.5px;color:#475569;margin-top:2px;line-height:1.5">' + c.why + '</div></div>';
  });
  return h + '</div>';
}

/** Approve / request changes, as two taps in the message itself. */
function rrbDecisionBlock_(d, reviewer) {
  var tok;
  try {
    tok = rrbMintToken(d.submissionId, 'decide', reviewer || { name: d.reviewerName, email: d.reviewerEmail });
  } catch (err) {
    Logger.log('rrbDecisionBlock_: no token (%s) — falling back to the form link', err && err.message);
    return rrbButton_('Open and review', ffReviewLink_(d.submissionId, 'manager'));
  }
  var base = rrbAppUrl_() + '?action=decide&t=' + encodeURIComponent(tok) + '&v=';
  return '<table role="presentation" width="100%" style="border-collapse:collapse;margin:18px 0 6px"><tr>' +
    '<td style="padding-right:6px" width="50%"><a href="' + base + 'approve' + '" ' +
      'style="display:block;text-align:center;background:#0F766E;color:#fff;padding:15px 10px;border-radius:10px;' +
      'text-decoration:none;font-weight:800;font-size:15px">Approve</a></td>' +
    '<td style="padding-left:6px" width="50%"><a href="' + base + 'changes' + '" ' +
      'style="display:block;text-align:center;background:#fff;color:#B45309;border:2px solid #F59E0B;' +
      'padding:13px 10px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px">Request changes</a></td>' +
    '</tr></table>' +
    '<p style="text-align:center;font-size:12.5px;color:#64748B;margin:4px 0 0">' +
      'One tap records it. You can add a comment on the next screen &mdash; ' +
      '<a href="' + ffReviewLink_(d.submissionId, 'manager') + '" style="color:#0D9488">or open the full application</a>.</p>';
}


/** Shared chrome for the small pages a tap lands on. Sized for a phone. */
function rrbPage_(title, bodyHtml, tone) {
  var bar = tone === 'bad' ? '#B45309' : tone === 'err' ? '#B91C1C' : '#0F766E';
  var h = '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + rrbEsc_(title) + '</title></head>' +
    '<body style="margin:0;background:#EEF2F7;font:16px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;color:#0F172A">' +
    '<div style="max-width:520px;margin:0 auto;padding:18px 14px 40px">' +
    '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden">' +
    '<div style="height:4px;background:' + bar + '"></div>' +
    '<div style="padding:20px 20px 24px">' + bodyHtml + '</div></div>' +
    '<p style="color:#94A3B8;font-size:11.5px;text-align:center;margin-top:14px;line-height:1.5">' +
    'Ricky Rampersad Branch &middot; Guardian Life of the Caribbean Limited</p>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(h)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * A manager tapped Approve or Request changes in their email.
 *
 * The verdict rides in the URL rather than the signature because the token is
 * already single-use and bound to this submission and this reviewer — anyone
 * able to alter the verdict could simply have used the link.
 */
function rrbDecide(e) {
  var p = (e && e.parameter) || {};
  var v = /^appro/i.test(_str(p.v)) ? 'Agree' : 'Do not agree';

  var chk = rrbVerifyToken(p.t);
  if (!chk.ok) {
    return rrbPage_('Cannot record this',
      '<div style="font-size:19px;font-weight:800;margin-bottom:8px">This link no longer works</div>' +
      '<p style="color:#475569;margin:0 0 14px">' + rrbEsc_(chk.error) + '</p>' +
      '<p style="color:#64748B;font-size:13.5px;margin:0">If the case still needs a decision, open the ' +
      'dashboard and review it there, or ask for a fresh link.</p>', 'err');
  }

  var pay = chk.payload;
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, pay.id);
  if (!row) {
    return rrbPage_('Not found',
      '<div style="font-size:19px;font-weight:800;margin-bottom:8px">That fact find is not on the sheet</div>' +
      '<p style="color:#475569;margin:0">Nothing was recorded. Please tell the branch office.</p>', 'err');
  }

  var d = ffReadRow_(sheet, headers, row);
  var now = new Date().toISOString();
  var agreed = (v === 'Agree');

  var merged = {};
  Object.keys(d).forEach(function (k) { merged[k] = d[k]; });
  merged.mgrAgree      = v;
  merged.mgrName       = _str(pay.nm) || _str(d.reviewerName);
  merged.mgrEmail      = _str(pay.em) || _str(d.reviewerEmail);
  merged.mgrReviewedAt = now;
  merged.mgrSigDate    = now.slice(0, 10);
  merged.status        = agreed ? 'approved' : 'changes_requested';
  merged.approvedAt    = agreed ? now : '';
  merged.lastUpdated   = now;

  // The attestation, and how it was given. A drawn signature is not collected
  // on this path, so the record has to say so rather than imply one exists.
  merged.mgrVerData = merged.mgrVerRatios = merged.mgrVerSuit = merged.mgrVerCompliance = true;
  merged.mgrSignatureMethod = 'Email one-tap';
  merged.mgrSignatureRef    = _str(pay.jti);
  merged.dmResponded        = true;
  if (!_str(merged.dmName)) merged.dmName = merged.mgrName;

  ffWriteRow_(sheet, headers, merged, row);
  rrbMarkTokenUsed_(chk.row);

  try { ffSendApprovalEmail_(merged); }
  catch (err) { Logger.log('rrbDecide: approval email failed — %s', err && err.message); }

  // A fresh single-use token so a comment can follow the decision.
  var noteTok = '';
  try { noteTok = rrbMintToken(pay.id, 'note', { name: merged.mgrName, email: merged.mgrEmail }); }
  catch (err) { Logger.log('rrbDecide: note token failed — %s', err && err.message); }

  var client = rrbEsc_(_str(d.clientName) || _str(d.fullName) || 'this client');
  var body =
    '<div style="font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:' +
      (agreed ? '#0F766E' : '#B45309') + '">' + (agreed ? 'Approved' : 'Changes requested') + '</div>' +
    '<div style="font-size:21px;font-weight:800;margin:6px 0 4px">' + client + '</div>' +
    '<p style="color:#475569;margin:0 0 16px;font-size:14px">Recorded against your name at ' +
      rrbEsc_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'h:mm a, d MMMM')) +
      '. ' + rrbEsc_(_str(d.advisorName) || 'The advisor') + ' has been told.</p>';

  if (noteTok) {
    body +=
      '<form action="' + rrbAppUrl_() + '" method="get" style="margin:0">' +
      '<input type="hidden" name="action" value="decide_note">' +
      '<input type="hidden" name="t" value="' + rrbEsc_(noteTok) + '">' +
      '<label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px">' +
        'Anything to tell ' + rrbEsc_((_str(d.advisorName) || 'the advisor').split(' ')[0]) + '? (optional)</label>' +
      '<textarea name="note" rows="4" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;' +
        'border-radius:9px;padding:11px;font:15px/1.5 inherit;resize:vertical" ' +
        'placeholder="Your guidance to the agent&hellip;"></textarea>' +
      '<button type="submit" style="width:100%;margin-top:10px;background:#0D9488;color:#fff;border:0;' +
        'border-radius:9px;padding:14px;font-size:15px;font-weight:800;cursor:pointer">Send this comment</button>' +
      '</form>' +
      '<p style="color:#94A3B8;font-size:12.5px;margin:12px 0 0;text-align:center">' +
        'Your decision is already saved. This is only if you want to add something.</p>';
  }
  return rrbPage_(agreed ? 'Approved' : 'Changes requested', body, agreed ? 'ok' : 'bad');
}

/** The optional comment that can follow a one-tap decision. */
function rrbDecideNote(e) {
  var p = (e && e.parameter) || {};
  var note = _str(p.note);
  var chk = rrbVerifyToken(p.t);
  if (!chk.ok) {
    return rrbPage_('Comment not saved',
      '<div style="font-size:19px;font-weight:800;margin-bottom:8px">This comment link has already been used</div>' +
      '<p style="color:#475569;margin:0">Your decision was saved. Only the comment did not go through.</p>', 'err');
  }
  if (!note) {
    return rrbPage_('Nothing to save',
      '<div style="font-size:19px;font-weight:800;margin-bottom:8px">No comment entered</div>' +
      '<p style="color:#475569;margin:0">Your decision is saved either way.</p>', 'ok');
  }

  var pay = chk.payload;
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, pay.id);
  if (!row) return rrbPage_('Not found', '<p>That fact find is no longer on the sheet.</p>', 'err');

  var d = ffReadRow_(sheet, headers, row);
  var merged = {};
  Object.keys(d).forEach(function (k) { merged[k] = d[k]; });
  var prior = _str(merged.dmGuidance);
  merged.dmGuidance  = prior ? prior + '\n\n' + note : note;
  merged.mgrComments = merged.dmGuidance;
  merged.lastUpdated = new Date().toISOString();
  ffWriteRow_(sheet, headers, merged, row);
  rrbMarkTokenUsed_(chk.row);

  return rrbPage_('Comment saved',
    '<div style="font-size:19px;font-weight:800;margin-bottom:8px">Sent</div>' +
    '<p style="color:#475569;margin:0 0 12px;font-size:14px">Your comment is on the file and goes to ' +
      rrbEsc_(_str(d.advisorName) || 'the advisor') + ' with the decision.</p>' +
    '<div style="background:#F8FAFC;border-left:3px solid #0D9488;padding:10px 13px;border-radius:0 8px 8px 0;' +
      'font-size:13.5px;color:#334155;white-space:pre-wrap">' + rrbEsc_(note) + '</div>', 'ok');
}


// ═══════════════════════════════════════════════════════════════════════════
// THE CLIENT'S SIDE
//
// Two emails reach a client: the draft when the advisor submits, and the
// approval once a manager signs it off. Both were one-way — the client could
// read them and had no way to say "that isn't what I said" or "that advisor
// was excellent".
//
// The draft now asks them to confirm the record is right, which is worth more
// than politeness: a client who has confirmed the facts in writing is the
// strongest evidence there is that the advice was based on what they actually
// told us. The approval asks what they thought of the service.
//
// Both use the same single-use signed links as the manager's buttons.
// ═══════════════════════════════════════════════════════════════════════════

function rrbClientLink_(d, action) {
  var tok;
  try {
    tok = rrbMintToken(d.submissionId, 'client',
      { name: _str(d.clientName), email: rrbClientEmail_(d) });
  } catch (err) {
    Logger.log('rrbClientLink_: no token (%s)', err && err.message);
    return '';
  }
  return rrbAppUrl_() + '?action=' + action + '&t=' + encodeURIComponent(tok) + '&v=';
}

/** "Is this right?" — two buttons on the draft. */
function rrbClientConfirmBlock_(d) {
  var base = rrbClientLink_(d, 'cconfirm');
  if (!base) return '';
  return '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:11px;' +
    'padding:15px 17px;margin:18px 0 4px">' +
    '<div style="font-size:15px;font-weight:800;margin-bottom:4px">Is this right?</div>' +
    '<div style="font-size:13.5px;color:#475569;line-height:1.55;margin-bottom:12px">' +
      'Please check the details above are what you told us. Advice is only as good as the ' +
      'information behind it, so if anything is wrong or missing we would rather know now ' +
      'than after a plan is in place.</div>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse"><tr>' +
      '<td width="50%" style="padding-right:5px"><a href="' + base + 'ok" ' +
        'style="display:block;text-align:center;background:#0F766E;color:#fff;padding:13px 8px;' +
        'border-radius:9px;text-decoration:none;font-weight:800;font-size:14.5px">Yes, that\'s correct</a></td>' +
      '<td width="50%" style="padding-left:5px"><a href="' + base + 'changes" ' +
        'style="display:block;text-align:center;background:#fff;color:#B45309;border:2px solid #F59E0B;' +
        'padding:11px 8px;border-radius:9px;text-decoration:none;font-weight:800;font-size:14.5px">Something needs changing</a></td>' +
    '</tr></table></div>';
}

/** Five stars on the approval email. */
function rrbClientRateBlock_(d) {
  var base = rrbClientLink_(d, 'crate');
  if (!base) return '';
  var adv = _str(d.advisorName) || 'your advisor';
  var star = function (n) {
    return '<td style="padding:0 3px"><a href="' + base + n + '" ' +
      'style="display:block;width:44px;height:44px;line-height:44px;text-align:center;' +
      'border:1px solid #E2E8F0;border-radius:9px;text-decoration:none;font-size:20px;' +
      'background:#fff;color:#F5B935">&#9733;</a>' +
      '<div style="text-align:center;font-size:10px;color:#94A3B8;margin-top:3px">' + n + '</div></td>';
  };
  return '<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:11px;' +
    'padding:15px 17px;margin:18px 0 4px;text-align:center">' +
    '<div style="font-size:15px;font-weight:800;margin-bottom:3px">How did ' + rrbEsc_(adv) + ' do?</div>' +
    '<div style="font-size:13px;color:#78350F;margin-bottom:11px">One tap. It goes to the branch manager, ' +
      'and it genuinely counts.</div>' +
    '<table role="presentation" align="center" style="border-collapse:collapse;margin:0 auto"><tr>' +
      star(1) + star(2) + star(3) + star(4) + star(5) +
    '</tr></table></div>';
}

/** The client says the record is right, or asks for a change. */
function rrbClientConfirm(e) {
  var p = (e && e.parameter) || {};
  var v = _str(p.v);
  var wantsChange = /^chang/i.test(v);
  var saving      = /^save$/i.test(v);
  var chk = rrbVerifyToken(p.t);
  if (!chk.ok) {
    return rrbPage_('Link expired',
      '<div style="font-size:19px;font-weight:800;margin-bottom:8px">This link has already been used</div>' +
      '<p style="color:#475569;margin:0">If you still need to change something, please reply to the ' +
      'email or call your advisor directly.</p>', 'err');
  }

  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, chk.payload.id);
  if (!row) return rrbPage_('Not found', '<p>We could not find that record.</p>', 'err');
  var d = ffReadRow_(sheet, headers, row);
  var now = new Date().toISOString();

  // The client sent their words. Record them, tell the advisor and the manager.
  if (saving) {
    var note = _str(p.note);
    var m2 = {};
    Object.keys(d).forEach(function (k) { m2[k] = d[k]; });
    m2.clientConfirmed  = 'Changes requested';
    m2.clientConfirmedAt = now;
    m2.clientChangeNote = note;
    m2.lastUpdated = now;
    ffWriteRow_(sheet, headers, m2, row);
    rrbMarkTokenUsed_(chk.row);

    try {
      var who = [_str(d.agentEmail), _str(d.reviewerEmail)].filter(String).join(',');
      if (who) rrbMail_(who,
        'Client asked for a change — ' + (_str(d.clientName) || 'client'),
        rrbHead_('The client has asked for a change',
                 (_str(d.clientName) || 'The client') + ' reviewed their draft') +
        '<p style="margin:0 0 12px">In their own words:</p>' +
        '<div style="background:#FFFBEB;border-left:4px solid #F59E0B;padding:12px 15px;' +
          'border-radius:0 9px 9px 0;font-size:14px;color:#78350F;white-space:pre-wrap">' +
          rrbEsc_(note || '(nothing written)') + '</div>' +
        '<p style="margin:14px 0 0;font-size:13.5px;color:#475569">The fact find has not been ' +
          'changed automatically. Please correct it and resubmit.</p>' +
        rrbFoot_(_str(d.submissionId)), RRB_ALWAYS_CC);
    } catch (err) { Logger.log('client-change notice failed: %s', err && err.message); }

    return rrbPage_('Sent',
      '<div style="font-size:21px;font-weight:800;margin-bottom:8px">Thank you &mdash; that is on its way</div>' +
      '<p style="color:#475569;margin:0;font-size:14.5px">' +
      rrbEsc_(_str(d.advisorName) || 'Your advisor') + ' and the branch manager have both been told. ' +
      'Nothing will go ahead until it is right.</p>', 'ok');
  }

  if (!wantsChange) {
    var merged = {};
    Object.keys(d).forEach(function (k) { merged[k] = d[k]; });
    merged.clientConfirmed = 'Yes';
    merged.clientConfirmedAt = now;
    merged.lastUpdated = now;
    ffWriteRow_(sheet, headers, merged, row);
    rrbMarkTokenUsed_(chk.row);
    return rrbPage_('Thank you',
      '<div style="font-size:21px;font-weight:800;margin-bottom:8px">Thank you</div>' +
      '<p style="color:#475569;margin:0 0 12px;font-size:14.5px">You have confirmed the details are ' +
      'correct. ' + rrbEsc_(_str(d.advisorName) || 'Your advisor') + ' will be in touch once the ' +
      'branch has completed its review.</p>' +
      '<p style="color:#64748B;font-size:13px;margin:0">Nothing is final yet — you are not committed ' +
      'to anything by confirming this.</p>', 'ok');
  }

  // Asking for a change needs their words, so the token stays alive for the form.
  return rrbPage_('What needs changing?',
    '<div style="font-size:20px;font-weight:800;margin-bottom:6px">What needs changing?</div>' +
    '<p style="color:#475569;margin:0 0 14px;font-size:14px">Tell us in your own words. This goes ' +
    'straight to ' + rrbEsc_(_str(d.advisorName) || 'your advisor') + ' and the branch manager.</p>' +
    '<form action="' + rrbAppUrl_() + '" method="get" style="margin:0">' +
    '<input type="hidden" name="action" value="cconfirm">' +
    '<input type="hidden" name="v" value="save">' +
    '<input type="hidden" name="t" value="' + rrbEsc_(_str(p.t)) + '">' +
    '<textarea name="note" rows="5" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;' +
      'border-radius:9px;padding:11px;font:15px/1.5 inherit;resize:vertical" ' +
      'placeholder="For example: my income is different, or I have cover you did not list&hellip;"></textarea>' +
    '<button type="submit" style="width:100%;margin-top:10px;background:#B45309;color:#fff;border:0;' +
      'border-radius:9px;padding:14px;font-size:15px;font-weight:800;cursor:pointer">Send this</button>' +
    '</form>', 'bad');
}

/** The optional words after a star rating. Rated by id — the star link was
 *  single-use and is already spent by the time this form appears. */
function rrbClientRateNote(e) {
  var p = (e && e.parameter) || {};
  var note = _str(p.note), id = _str(p.id);
  if (!note || !id) {
    return rrbPage_('Thank you',
      '<div style="font-size:20px;font-weight:800">Thank you</div>' +
      '<p style="color:#475569;margin:8px 0 0">Your rating is recorded.</p>', 'ok');
  }
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, id);
  if (!row) return rrbPage_('Thank you', '<p>Your rating is recorded.</p>', 'ok');
  var d = ffReadRow_(sheet, headers, row);
  // Only accept words against a rating that exists, so this cannot be used to
  // write comments onto arbitrary cases by guessing an id.
  if (!_str(d.clientRating)) {
    return rrbPage_('Thank you', '<p>Your rating is recorded.</p>', 'ok');
  }
  var merged = {};
  Object.keys(d).forEach(function (k) { merged[k] = d[k]; });
  merged.clientFeedback = note;
  merged.lastUpdated = new Date().toISOString();
  ffWriteRow_(sheet, headers, merged, row);
  return rrbPage_('Thank you',
    '<div style="font-size:20px;font-weight:800;margin-bottom:6px">Thank you</div>' +
    '<p style="color:#475569;margin:0 0 12px;font-size:14.5px">The branch manager will read this.</p>' +
    '<div style="background:#F8FAFC;border-left:3px solid #0D9488;padding:10px 13px;' +
      'border-radius:0 8px 8px 0;font-size:13.5px;color:#334155;white-space:pre-wrap">' +
      rrbEsc_(note) + '</div>', 'ok');
}

/** The client's rating of the advisor. */
function rrbClientRate(e) {
  var p = (e && e.parameter) || {};
  var stars = parseInt(_str(p.v), 10);
  if (!(stars >= 1 && stars <= 5)) stars = 0;
  var chk = rrbVerifyToken(p.t);
  if (!chk.ok) {
    return rrbPage_('Already answered',
      '<div style="font-size:19px;font-weight:800;margin-bottom:8px">Thank you &mdash; we already have your rating</div>' +
      '<p style="color:#475569;margin:0">This link can only be used once.</p>', 'err');
  }
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, chk.payload.id);
  if (!row) return rrbPage_('Not found', '<p>We could not find that record.</p>', 'err');
  var d = ffReadRow_(sheet, headers, row);
  var now = new Date().toISOString();

  var merged = {};
  Object.keys(d).forEach(function (k) { merged[k] = d[k]; });
  merged.clientRating = String(stars);
  merged.clientRatingAt = now;
  merged.lastUpdated = now;
  ffWriteRow_(sheet, headers, merged, row);
  rrbMarkTokenUsed_(chk.row);

  var adv = rrbEsc_(_str(d.advisorName) || 'your advisor');
  var line = stars >= 4 ? 'That means a great deal to ' + adv + ' and to the branch.'
           : stars === 3 ? 'Thank you for being straight with us — it is how we improve.'
           : 'Thank you for telling us. The branch manager will look into this personally.';
  return rrbPage_('Thank you',
    '<div style="font-size:34px;color:#F5B935;letter-spacing:3px;margin-bottom:6px">' +
      new Array(stars + 1).join('&#9733;') + '</div>' +
    '<div style="font-size:20px;font-weight:800;margin-bottom:6px">Thank you</div>' +
    '<p style="color:#475569;margin:0 0 14px;font-size:14.5px">' + line + '</p>' +
    '<form action="' + rrbAppUrl_() + '" method="get" style="margin:0">' +
    '<input type="hidden" name="action" value="crate_note">' +
    '<input type="hidden" name="id" value="' + rrbEsc_(_str(chk.payload.id)) + '">' +
    '<label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px">' +
      'Anything you would like to add? (optional)</label>' +
    '<textarea name="note" rows="3" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;' +
      'border-radius:9px;padding:11px;font:15px/1.5 inherit"></textarea>' +
    '<button type="submit" style="width:100%;margin-top:9px;background:#0D9488;color:#fff;border:0;' +
      'border-radius:9px;padding:13px;font-size:14.5px;font-weight:800;cursor:pointer">Send</button>' +
    '</form>', stars >= 3 ? 'ok' : 'bad');
}


// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE → CLOSED
//
// A client saying "I'll take it" at the kitchen table is an intention. The
// application still has to be written, underwritten, issued and paid. Counting
// that as production overstates the branch by everything that never completes,
// and the first time the board is challenged against head office figures it
// loses its credibility permanently.
//
// So the premium sits in PIPELINE until an advisor confirms otherwise. The
// confirmation is one tap in an email that chases itself — nobody has to
// remember to go and update anything.
// ═══════════════════════════════════════════════════════════════════════════

var RRB_CHASE_AFTER_DAYS = 14;   // how long a case may sit unanswered
var RRB_CHASE_EVERY_DAYS = 7;    // and how often to ask again after that

/** One tap from the advisor: issued, still working, or not proceeding. */
function rrbCaseOutcome(e) {
  var p = (e && e.parameter) || {};
  var v = _str(p.v).toLowerCase();
  var chk = rrbVerifyToken(p.t);
  if (!chk.ok) {
    return rrbPage_('Link expired',
      '<div style="font-size:19px;font-weight:800;margin-bottom:8px">This link has already been used</div>' +
      '<p style="color:#475569;margin:0">Each update link works once. The next chase email will carry a fresh one.</p>',
      'err');
  }
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, chk.payload.id);
  if (!row) return rrbPage_('Not found', '<p>That case is no longer on the sheet.</p>', 'err');
  var d = ffReadRow_(sheet, headers, row);

  // Three real stages, because submitted and picked up are not the same thing.
  // An application with head office is not money; a policy delivered and paid
  // for is. Counting the first as production is how a branch reports a number
  // it later has to walk back.
  var label = v === 'pickedup' ? 'Picked up'
            : v === 'submitted' ? 'Submitted'
            : v === 'lost' ? 'Not proceeding'
            : 'Still working';
  var now = new Date().toISOString();
  var merged = {};
  Object.keys(d).forEach(function (k) { merged[k] = d[k]; });
  merged.caseOutcome   = label;
  merged.caseOutcomeAt = now;
  merged.caseOutcomeBy = _str(chk.payload.nm) || _str(d.advisorName);
  merged.lastUpdated   = now;
  ffWriteRow_(sheet, headers, merged, row);
  rrbMarkTokenUsed_(chk.row);

  var client = rrbEsc_(_str(d.clientName) || 'this client');

  if (v === 'pickedup') {
    // A policy number is what makes this reconcilable against head office.
    var noteTok = '';
    try { noteTok = rrbMintToken(chk.payload.id, 'policy',
      { name: merged.caseOutcomeBy, email: _str(d.agentEmail) }); } catch (err) {}
    return rrbPage_('Recorded',
      '<div style="font-size:13px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#0F766E">Picked up</div>' +
      '<div style="font-size:21px;font-weight:800;margin:6px 0 4px">' + client + '</div>' +
      '<p style="color:#475569;margin:0 0 16px;font-size:14px">Delivered and paid. This is now ' +
      'closed API on the branch board.</p>' +
      (noteTok
        ? '<form action="' + rrbAppUrl_() + '" method="get" style="margin:0">' +
          '<input type="hidden" name="action" value="outcome">' +
          '<input type="hidden" name="v" value="policy">' +
          '<input type="hidden" name="t" value="' + rrbEsc_(noteTok) + '">' +
          '<label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px">' +
            'Policy number (optional, but it is what lets this be checked against head office)</label>' +
          '<input name="note" type="text" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;' +
            'border-radius:9px;padding:11px;font:15px inherit" placeholder="Policy number">' +
          '<button type="submit" style="width:100%;margin-top:10px;background:#0D9488;color:#fff;border:0;' +
            'border-radius:9px;padding:13px;font-size:15px;font-weight:800;cursor:pointer">Save it</button>' +
          '</form>'
        : ''), 'ok');
  }

  if (v === 'policy') {
    var m2 = {};
    Object.keys(d).forEach(function (k) { m2[k] = d[k]; });
    m2.policyNumber = _str(p.note);
    m2.lastUpdated = now;
    ffWriteRow_(sheet, headers, m2, row);
    return rrbPage_('Saved',
      '<div style="font-size:20px;font-weight:800;margin-bottom:6px">Saved</div>' +
      '<p style="color:#475569;margin:0;font-size:14.5px">Policy ' + rrbEsc_(_str(p.note)) +
      ' recorded against ' + client + '.</p>', 'ok');
  }

  var says = v === 'submitted'
      ? 'Recorded as with head office. It counts as submitted, not yet as API &mdash; ' +
        'we will ask again once it should have been delivered.'
    : v === 'lost'
      ? 'Recorded. The premium comes out of the branch pipeline, which keeps the board honest.'
      : 'Recorded. It stays in pipeline and we will check again in a week.';
  return rrbPage_(label,
    '<div style="font-size:13px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:' +
      (v === 'lost' ? '#B45309' : v === 'submitted' ? '#0369A1' : '#475569') + '">' + rrbEsc_(label) + '</div>' +
    '<div style="font-size:21px;font-weight:800;margin:6px 0 4px">' + client + '</div>' +
    '<p style="color:#475569;margin:0;font-size:14px">' + says + '</p>',
    v === 'lost' ? 'bad' : 'ok');
}

/**
 * The chase. Runs daily; emails an advisor about any case where the client
 * said yes and nobody has confirmed what happened since.
 *
 * Install with rrbInstallChase(). Nobody has to remember anything — that is
 * the whole point, because "remember to update the system" is exactly the
 * instruction that never survives a busy fortnight.
 */
function rrbChaseOpenCases() {
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var last = sheet.getLastRow();
  if (last < 2) { Logger.log('Nothing to chase.'); return; }

  var now = new Date(), byAgent = {}, checked = 0;
  for (var r = 2; r <= last; r++) {
    var d = ffReadRow_(sheet, headers, r);
    if (!d || !d.submissionId) continue;

    // Only cases the client actually said yes to.
    var apps = 0, api = 0;
    for (var i = 1; i <= 6; i++) {
      if (!/^yes$/i.test(_str(d['dec' + i + 'Go']))) continue;
      apps++;
      var pr = rrbNum_(d['dec' + i + 'Prem']) || rrbNum_(d['rec' + i + 'Prem']);
      api += pr * rrbApiMultiplier_(d['rec' + i + 'Mode']);
    }
    if (!apps) continue;

    var outcome = _str(d.caseOutcome);
    // Picked up is finished. Not proceeding is finished. Submitted is not —
    // an application sitting with head office still needs to be delivered, and
    // that is exactly where cases quietly die.
    if (/^picked up$/i.test(outcome) || /^not proceeding$/i.test(outcome)) continue;

    var sub = d.submittedAt ? new Date(d.submittedAt) : null;
    if (!sub || isNaN(sub.getTime())) continue;
    var age = Math.floor((now.getTime() - sub.getTime()) / 86400000);
    if (age < RRB_CHASE_AFTER_DAYS) continue;

    var lastChased = d.caseChasedAt ? new Date(d.caseChasedAt) : null;
    if (lastChased && !isNaN(lastChased.getTime())) {
      var since = Math.floor((now.getTime() - lastChased.getTime()) / 86400000);
      if (since < RRB_CHASE_EVERY_DAYS) continue;
    }

    var to = _str(d.agentEmail);
    if (!to) continue;
    if (!byAgent[to]) byAgent[to] = { name: _str(d.advisorName), rows: [] };
    byAgent[to].rows.push({ row: r, d: d, age: age, api: api, apps: apps });
    checked++;
  }

  Object.keys(byAgent).forEach(function (to) {
    var a = byAgent[to];
    try {
      MailApp.sendEmail({
        to: to,
        cc: [_str(a.rows[0].d.reviewerEmail), RRB_ALWAYS_CC].filter(String).join(','),
        subject: a.rows.length === 1
          ? 'Did this close? ' + (_str(a.rows[0].d.clientName) || 'one case') + ' — ' + a.rows[0].age + ' days'
          : a.rows.length + ' cases waiting on an answer — did they close?',
        htmlBody: rrbChaseHtml_(a),
        name: 'RR Branch Fact Find'
      });
      // Stamp them so nobody is asked again for a week.
      a.rows.forEach(function (x) {
        var m = {};
        Object.keys(x.d).forEach(function (k) { m[k] = x.d[k]; });
        m.caseChasedAt = new Date().toISOString();
        m.caseChaseCount = String((parseInt(_str(x.d.caseChaseCount), 10) || 0) + 1);
        ffWriteRow_(sheet, headers, m, x.row);
      });
    } catch (err) { Logger.log('chase to %s failed: %s', to, err && err.message); }
  });

  Logger.log('Chased %s case(s) across %s advisor(s).', checked, Object.keys(byAgent).length);
}

function rrbChaseHtml_(a) {
  var first = (a.name || '').split(' ')[0] || 'there';
  var total = a.rows.reduce(function (s, x) { return s + x.api; }, 0);
  var h = rrbHead_(a.rows.length === 1 ? 'Did this one close?' : a.rows.length + ' cases need an answer',
                   big_(total) + ' of premium is sitting in pipeline against your name');
  h += '<p style="margin:0 0 14px">Hi ' + rrbEsc_(first) + ',</p>';
  h += '<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">' +
       'Your client said yes to these, and nothing has told us what happened since. ' +
       'Until somebody says, the branch board has to count them as pipeline rather than ' +
       'production &mdash; so one tap each keeps the numbers real.</p>';

  a.rows.forEach(function (x) {
    var base = '';
    try {
      base = rrbAppUrl_() + '?action=outcome&t=' +
             encodeURIComponent(rrbMintToken(x.d.submissionId, 'outcome',
               { name: a.name, email: _str(x.d.agentEmail) })) + '&v=';
    } catch (err) { return; }
    h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:11px;padding:13px 15px;margin-bottom:11px">' +
      '<div style="font-size:15.5px;font-weight:800">' + rrbEsc_(_str(x.d.clientName) || 'Client') + '</div>' +
      '<div style="font-size:12.5px;color:#64748B;margin-top:2px">' + x.apps + ' application' +
        (x.apps === 1 ? '' : 's') + ' &middot; ' + big_(x.api) + ' API &middot; ' +
        x.age + ' days since the fact find</div>' +
      '<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:11px"><tr>' +
        '<td width="50%" style="padding-right:4px"><a href="' + base + 'pickedup" ' +
          'style="display:block;text-align:center;background:#0F766E;color:#fff;padding:11px 4px;' +
          'border-radius:8px;text-decoration:none;font-weight:800;font-size:13.5px">Picked up</a></td>' +
        '<td width="50%" style="padding-left:4px"><a href="' + base + 'submitted" ' +
          'style="display:block;text-align:center;background:#fff;color:#0369A1;border:2px solid #7DD3FC;' +
          'padding:9px 4px;border-radius:8px;text-decoration:none;font-weight:800;font-size:13.5px">Submitted</a></td>' +
      '</tr><tr>' +
        '<td style="padding:6px 4px 0 0"><a href="' + base + 'pending" ' +
          'style="display:block;text-align:center;background:#fff;color:#475569;border:2px solid #CBD5E1;' +
          'padding:9px 4px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12.5px">Still working</a></td>' +
        '<td style="padding:6px 0 0 4px"><a href="' + base + 'lost" ' +
          'style="display:block;text-align:center;background:#fff;color:#B45309;border:2px solid #F59E0B;' +
          'padding:9px 4px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12.5px">Not proceeding</a></td>' +
      '</tr></table>' +
      '<div style="font-size:11.5px;color:#94A3B8;margin-top:8px;line-height:1.45">' +
        '<strong>Submitted</strong> means it is with head office. <strong>Picked up</strong> means ' +
        'the client has taken delivery and paid &mdash; only that counts as API.</div></div>';
  });

  h += '<p style="font-size:12.5px;color:#64748B;margin:14px 0 0">Nothing here is a reprimand. ' +
       '"Not proceeding" is a perfectly good answer and takes the premium out of the pipeline, ' +
       'which is what keeps the branch numbers worth reading.</p>';
  h += rrbFoot_('');
  return h;
}

function big_(n) {
  n = Math.round(n || 0);
  if (n >= 1000000) return 'TT$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return 'TT$' + Math.round(n / 1000) + 'k';
  return 'TT$' + n;
}

/** Install the daily chase. Safe to run more than once. */
function rrbInstallChase() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rrbChaseOpenCases') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rrbChaseOpenCases').timeBased().atHour(9).everyDays(1).create();
  Logger.log('Chase installed — runs daily at 9am, asking about anything older than %s days.',
             RRB_CHASE_AFTER_DAYS);
}
