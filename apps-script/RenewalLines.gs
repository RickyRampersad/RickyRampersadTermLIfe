/**
 * ============================================================================
 * RENEWAL LINES — value guidance + payment follow-ups
 * ============================================================================
 * Three lines, three different jobs, so the client is asked the right thing:
 *
 *   MOTOR · COMPREHENSIVE   the vehicle DEPRECIATES. Show the client the value
 *                           they have carried year by year, work out what their
 *                           own car has actually been doing, and put a guide
 *                           range beside an editable field. They type the
 *                           figure; we never file one for them.
 *
 *   MOTOR · THIRD PARTY     nothing to value. Confirm the vehicle, confirm the
 *                           driver details, done. The only offers are windscreen
 *                           cover and a comprehensive comparison.
 *
 *   PROPERTY                rebuilding cost RISES. Show how long since the sums
 *                           insured were last reviewed, what that gap is likely
 *                           to have cost, and explain AVERAGE on the client's
 *                           own numbers before asking for the figure.
 *
 * ── WHY A RANGE AND NOT A NUMBER ────────────────────────────────────────────
 * Putting a single figure in front of a client reads as advice, and if it is
 * low their claim gets averaged down on our number. So this file produces a
 * GUIDE — built from that vehicle's own history where we have it — and the
 * client confirms or overrides. The declaration they tick says the figure is
 * theirs. Salesforce's Depreciation__c is 25 on every record: that is the
 * policy's parts-depreciation clause, not an annual rate, and it is never
 * used here.
 *
 * ── PAYMENT FOLLOW-UPS ──────────────────────────────────────────────────────
 * A renewed policy with money still owed gets a spaced, softening-to-firm
 * ladder: day 3, day 10, day 21, then it stops emailing and raises a call
 * task. Paying, or the balance reaching zero, stops it immediately.
 */

var LINES = {
  // observed on this book: comprehensive values fall ~2–12% a year depending on
  // age and segment. Used only when a vehicle has no history of its own.
  DEFAULT_DEP_LOW: 0.06,
  DEFAULT_DEP_HIGH: 0.12,
  // rebuilding cost drift used to flag stale property sums insured
  PROPERTY_DRIFT: 0.05,
  PROPERTY_STALE_YEARS: 2,
  // payment chase ladder, in days after the renewal date
  PAY_STEPS: [3, 10, 21],
};

/** comprehensive | third-party | property */
function lineOf_(coverage, policy) {
  var c = String(coverage || '').toLowerCase();
  var p = String(policy || '').toUpperCase().replace(/\s+/g, '');
  if (/comprehensive/.test(c)) return 'comprehensive';
  if (/third\s*party|^tp$/.test(c)) return 'third-party';
  if (/FAR|FHO|FCP|FSP/.test(p)) return 'property';
  return c ? 'third-party' : 'property';
}

/**
 * Value guidance for a comprehensive vehicle, built from its own history.
 * Returns null when there is nothing honest to say.
 *   { current, low, high, basis, rate, years, stale }
 */
function motorValueGuide_(history, current) {
  current = Number(current) || 0;
  if (!current) return null;
  var pts = (history || []).map(function (h) {
    var v = Number(String(h.value).replace(/[^0-9.]/g, ''));
    var d = asDate_(h.when);
    return (v && d) ? { v: v, d: d } : null;
  }).filter(Boolean).sort(function (a, b) { return a.d - b.d; });

  var low, high, basis, rate = null, years = 0, stale = false;
  if (pts.length >= 2) {
    var first = pts[0], last = pts[pts.length - 1];
    years = (last.d - first.d) / 31557600000;
    if (years >= 0.9 && first.v > 0) {
      rate = Math.pow(last.v / first.v, 1 / years) - 1;      // negative = falling
      // how long since the figure last moved?
      var lastChange = last.d;
      for (var i = pts.length - 1; i > 0; i--) {
        if (Math.abs(pts[i].v - pts[i - 1].v) > 1) { lastChange = pts[i].d; break; }
        lastChange = pts[i - 1].d;
      }
      var sinceChange = (new Date() - lastChange) / 31557600000;
      stale = sinceChange >= 1.8;
      var r = Math.min(Math.max(-rate, 0.02), 0.20);          // sane band
      low = Math.round(current * (1 - r * 1.15) / 500) * 500;
      high = Math.round(current * (1 - r * 0.85) / 500) * 500;
      basis = 'your own value history — this vehicle has moved about ' +
              Math.abs(Math.round(rate * 1000) / 10) + '% a year with us';
    }
  }
  if (low === undefined) {
    low = Math.round(current * (1 - LINES.DEFAULT_DEP_HIGH) / 500) * 500;
    high = Math.round(current * (1 - LINES.DEFAULT_DEP_LOW) / 500) * 500;
    basis = 'typical movement on this book, as we have no value history for this vehicle yet';
  }
  if (low >= high) low = Math.max(0, high - 500);
  return { current: current, low: low, high: high, basis: basis,
           rate: rate, years: Math.round(years * 10) / 10, stale: stale };
}

/** Property: how stale are the sums insured, and what has that likely cost? */
function propertyValueGuide_(total, lastReviewed) {
  total = Number(total) || 0;
  if (!total) return null;
  var d = asDate_(lastReviewed);
  var years = d ? (new Date() - d) / 31557600000 : null;
  if (years === null) {
    return { total: total, years: null, stale: true, suggested: null,
             note: 'We have no record of when these sums insured were last reviewed.' };
  }
  var suggested = Math.round(total * Math.pow(1 + LINES.PROPERTY_DRIFT, years) / 1000) * 1000;
  return {
    total: total, years: Math.round(years * 10) / 10,
    stale: years >= LINES.PROPERTY_STALE_YEARS,
    suggested: suggested,
    shortfallPct: total > 0 ? Math.round((1 - total / suggested) * 100) : 0,
    note: 'Rebuilding costs have moved since ' + fmtDate_(d) + '.',
  };
}

/** What a claim actually pays once average is applied. */
function averageOutcome_(insured, replacement, claim) {
  insured = Number(insured) || 0; replacement = Number(replacement) || 0;
  claim = Number(claim) || 100000;
  if (!insured || !replacement) return null;
  var pct = Math.min(insured / replacement, 1);
  return { pct: Math.round(pct * 1000) / 10, claim: claim,
           pays: Math.round(claim * pct), shortfall: Math.round(claim * (1 - pct)) };
}

/* ============================ payment follow-ups ============================ */

/**
 * Chases premium that is still owed after a policy has renewed. Spaced, and it
 * stops the moment the balance clears. Runs from the daily trigger.
 */
function dailyPaymentFollowUps() {
  var sh = renewalsSheet_();
  var map = ensureRenewalCols_();
  var cRem = col_(map, 'reminders sent');
  var sent = 0, tasked = 0;

  allRenewals_().forEach(function (r) {
    if (!r.token || !r.email) return;
    var owed = Number(r.balance) || 0;
    if (owed <= 0) return;                                   // nothing outstanding
    var renewed = /RENEWED/i.test(r.renewalStatus) || r.renewedDate;
    var instructed = /—/.test(r.renewalStatus);
    if (!renewed && !instructed) return;                     // not their bill yet

    var since = r.renewedDate ? -daysUntil_(r.renewedDate)
              : (r.days !== null ? -r.days : null);
    if (since === null || since < LINES.PAY_STEPS[0]) return;

    var stamps = String(r.remindersSent || '');
    function has(code) { return new RegExp('(^|[;\\s])' + code + '@').test(stamps); }

    var step = null;
    for (var i = LINES.PAY_STEPS.length - 1; i >= 0; i--) {
      var d = LINES.PAY_STEPS[i];
      if (since >= d && !has('pay' + d)) { step = d; break; }
    }
    if (step === null) {
      // past the last email: hand it to a human, once
      if (since >= LINES.PAY_STEPS[LINES.PAY_STEPS.length - 1] + 7 && !has('paycall')) {
        createTask_('Call ' + (r.contact || r.client) + ' — ' + fmtMoney_(owed) +
                    ' outstanding ' + since + ' days after renewal' + (r.mobile ? ' (' + r.mobile + ')' : ''),
                    '', r.assignedTo || '', r.client, r.token, 'system');
        if (!testMode_()) sh.getRange(r.rowIndex, cRem + 1)
          .setValue((stamps ? stamps + '; ' : '') + 'paycall@' + nowStamp_());
        logActivity_(r.token, r.client, 'payment-escalated', 'system',
                     fmtMoney_(owed) + ' owed, ' + since + ' days — call task raised');
        tasked++;
      }
      return;
    }

    sendPaymentReminder_(r, owed, since, step);
    if (!testMode_()) sh.getRange(r.rowIndex, cRem + 1)
      .setValue((stamps ? stamps + '; ' : '') + 'pay' + step + '@' + nowStamp_());
    logActivity_(r.token, r.client, 'payment-reminder', 'system',
                 'day ' + step + ' · ' + fmtMoney_(owed) + ' owed');
    sent++;
  });

  Logger.log('dailyPaymentFollowUps: %s reminders, %s call tasks', sent, tasked);
  return { sent: sent, tasked: tasked };
}

/** Warm at day 3, plain at day 10, firm-but-kind at day 21. */
function sendPaymentReminder_(r, owed, since, step) {
  var link = portalLink_(r.token);
  var first = esc_((r.contact || r.client).split(' ')[0] || 'there');
  var body, subject;

  if (step === LINES.PAY_STEPS[0]) {
    subject = 'Your renewal is done — just the premium to settle';
    body = '<p>Dear ' + first + ',</p>' +
      '<p>Your <b>' + esc_(r.coverage) + '</b> renewal' + polRef_(r) + ' is in place — thank you.</p>' +
      eduBox_('There is <b>' + fmtMoney_(owed) + '</b> outstanding on the premium. ' +
              'Settling it keeps everything clean on your file.') +
      '<p>You can pay by bank transfer, LINX or card — reply to this email and we will send you ' +
      'the details, or call us and we will take it over the phone.</p>';
  } else if (step === LINES.PAY_STEPS[1]) {
    subject = 'A reminder — ' + fmtMoney_(owed) + ' outstanding on your renewal';
    body = '<p>Dear ' + first + ',</p>' +
      '<p>A friendly reminder that <b>' + fmtMoney_(owed) + '</b> is still outstanding on your ' +
      esc_(r.coverage) + ' renewal' + polRef_(r) + ', now ' + since + ' days on.</p>' +
      eduBox_('If you have already paid, ignore this and send us the receipt reference so we can ' +
              'clear it off your record.') +
      '<p>If something has changed, tell us — we would rather arrange something with you than ' +
      'leave it sitting.</p>';
  } else {
    subject = 'Please let us hear from you — premium outstanding';
    body = '<p>Dear ' + first + ',</p>' +
      '<p><b>' + fmtMoney_(owed) + '</b> has been outstanding on your ' + esc_(r.coverage) +
      ' policy' + polRef_(r) + ' for ' + since + ' days.</p>' +
      '<div style="background:#fbe9e7;border-left:4px solid #b3261e;padding:12px 16px;margin:14px 0">' +
      '<b>Why this matters.</b> An unpaid premium can affect how a claim is handled, and in time ' +
      'the insurer can cancel the cover. We do not want you caught by that.</div>' +
      '<p>Call us on ' + esc_(CONFIG.AGENT_PHONE) + ' and we will sort it out today — including a ' +
      'payment arrangement if that is what is needed.</p>';
  }

  sendMail_({
    to: r.email, name: CONFIG.FROM_NAME, subject: subject,
    htmlBody: brandWrap_(body + ctaBtn_(link, 'View my policy') + sig_(), 'Premium outstanding'),
  });
}

/** Property version — same ladder, driven off the property sheet. */
function dailyPropertyPaymentFollowUps() {
  if (typeof allProperties_ !== 'function') return { sent: 0 };
  var sent = 0;
  allProperties_().forEach(function (r) {
    if (!r.email || !r.token) return;
    var owed = Number(r.premium) - Number(r.paid || 0);
    if (!(owed > 0) || r.stage !== 'issued') return;
    var since = r.stageUpdated ? -daysUntil_(r.stageUpdated) : null;
    if (since === null) return;
    var stamps = String(r.remindersSent || '');
    var step = null;
    for (var i = LINES.PAY_STEPS.length - 1; i >= 0; i--) {
      var d = LINES.PAY_STEPS[i];
      if (since >= d && stamps.indexOf('pay' + d + '@') < 0) { step = d; break; }
    }
    if (step === null) return;
    sendPaymentReminder_({ contact: r.contact, client: r.client, email: r.email,
                           coverage: 'property', policy: r.policy, token: r.token,
                           mobile: r.mobile }, owed, since, step);
    if (!testMode_()) setPropCell_(r.rowIndex, 'reminders sent',
      (stamps ? stamps + '; ' : '') + 'pay' + step + '@' + nowStamp_());
    logActivity_(r.token, r.client, 'payment-reminder', 'system',
                 'property · day ' + step + ' · ' + fmtMoney_(owed) + ' owed');
    sent++;
  });
  return { sent: sent };
}

/** Menu helper: what would go out today, without sending anything. */
function previewPaymentFollowUps() {
  var due = [];
  allRenewals_().forEach(function (r) {
    var owed = Number(r.balance) || 0;
    if (owed <= 0 || !r.email) return;
    var renewed = /RENEWED/i.test(r.renewalStatus) || r.renewedDate;
    if (!renewed && !/—/.test(r.renewalStatus)) return;
    var since = r.renewedDate ? -daysUntil_(r.renewedDate) : (r.days !== null ? -r.days : null);
    if (since === null || since < LINES.PAY_STEPS[0]) return;
    due.push('• ' + r.client + ' — ' + fmtMoney_(owed) + ' owed, ' + since + ' days');
  });
  SpreadsheetApp.getUi().alert(
    due.length
      ? 'These clients have premium outstanding and would be chased:\n\n' + due.join('\n') +
        '\n\nThe ladder emails at day 3, 10 and 21, then raises a call task. ' +
        'Paying stops it immediately.'
      : 'Nothing outstanding — no payment reminders would go out today.');
}
