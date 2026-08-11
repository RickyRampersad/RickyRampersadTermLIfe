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
function rrbSendClientDraftNow_(d) {
  var to = _str(d.email) || _str(d.clientEmail);
  if (!to || to.indexOf('@') < 0) {
    Logger.log('rrbSendClientDraftNow_: no client email on %s — nothing sent. ' +
               'Capture the client email on the fact find to close this gap.', d.submissionId);
    return;
  }
  var adv = _str(d.advisorName).split(' ')[0] || 'your advisor';
  var subject = '[DRAFT] Thank you for meeting ' + adv + ' — your plan is being reviewed';
  var html = rrbWithDraft_(rrbClientDraftHtml_(d),
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

  return { bio: bio, concerns: concerns, adviceOnly: adviceOnly };
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
  return h + '</table></div>';
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
