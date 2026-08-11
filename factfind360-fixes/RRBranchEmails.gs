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

  var h = rrbHead_(client + ' &mdash; Specific Need Only',
                   'From ' + advisor + ' &middot; due back by ' + rrbDueDate_(d.submittedAt));
  h += '<p style="margin:0 0 15px">Hi ' + mgrFirst + ',</p>';

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

  h += rrbButton_('Approve this recommendation', link);
  h += '<p style="text-align:center;font-size:12.5px;color:#64748B;margin:2px 0 0">' +
       'Limited scope &mdash; the review is short.</p>';
  h += rrbFoot_(_str(d.submissionId));
  return h;
}
