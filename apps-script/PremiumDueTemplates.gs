/******************************************************************
 * RRB PREMIUM DUE — CLIENT OUTREACH
 * ----------------------------------------------------------------
 * The templates the client actually receives, and the daily run that
 * sends them at the right point in the lapse clock. Paste this into
 * the SAME Apps Script project as PremiumDue.gs — it reuses that
 * file's getSheet_(), getPolicies_() and HEADERS.
 *
 * The lifecycle, and what the client gets at each point:
 *
 *    day 30   overdue nudge        "a premium didn't reach us"
 *    day 45   survey invite        the 45-day survey link
 *    day 52   survey reminder      only if they haven't answered
 *    day 75   retention notice     "your cover ends in 15 days"
 *    day 88   final notice         last call before lapse
 *    lapsed   win-back             inside the reinstatement window only
 *    pending  requirements chase   new business stuck in underwriting
 *
 * One send per policy per stage, ever. The log is the memory: before
 * sending, dailyPremiumDueRun() reads back what has already gone out
 * and skips it. No daily spam — the same discipline as the renewal
 * platform, where after the final email the pipeline goes human,
 * because a phone call beats an inbox.
 *
 * ⚠️  READ THIS BEFORE INSTALLING THE TRIGGER
 *
 *  - DRY_RUN is true. Nothing is emailed. Every intended send is
 *    written to the log with type 'outbound-dry' so you can inspect a
 *    full run before a single client hears from you. Set it to false
 *    only once you've read a dry run and agree with it.
 *  - MAX_SENDS_PER_RUN caps a live run. The book holds ~6,000 lapsed
 *    policies; without a cap one misconfigured run would mail all of
 *    them.
 *  - Gmail sends about 100 emails/day on a consumer account, 1,500 on
 *    Workspace. The cap keeps you inside that.
 *  - WIN_BACK_MAX_DAYS stops the win-back mailing someone whose policy
 *    lapsed in 2014. Only recent lapses are a live conversation.
 ******************************************************************/

var OUT = {
  DRY_RUN: true,                 // <-- false only after you've read a dry run
  MAX_SENDS_PER_RUN: 60,
  WIN_BACK_MAX_DAYS: 180,        // don't chase lapses older than this
  MIN_PREMIUM: 0,                // skip trivial amounts if you want a floor

  FROM_NAME: 'Ricky Rampersad Branch — Policy Services',
  BRANCH_NAME: 'Ricky Rampersad Branch',
  BRANCH_PHONE: '(868) 678-5921',
  BRANCH_EMAIL: 'support@rickyrampersadbranch.com',

  // Where the client survey lives. This must be the PRIVATE engine
  // deployment; the copy in the public repository is a demo.
  ENGINE_URL: '',                // e.g. 'https://rrb-premium-due.netlify.app/'

  // Managers who receive the retention escalation.
  ESCALATE_CC: []                // e.g. ['ricky.rampersad@myguardiangroup.com']
};

var PD_BRAND = { teal: '#0E6E64', teal2: '#0A524A', gold: '#C9972B', ink: '#0B1B2B', line: '#D9D3C6' };

/* ============================ small helpers ============================ */

function pdEsc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pdFirst_(name) {
  return String(name || '').replace(/\s*\(client\)/i, '').trim().split(/\s+/)[0] || 'there';
}
function pdMoney_(v) {
  var n = Number(v) || 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pdValidEmail_(e) {
  e = String(e || '').trim();
  if (!e || /not available/i.test(e)) return '';
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e) ? e : '';
}
function pdSurveyLink_(policy) {
  if (!OUT.ENGINE_URL) return '';
  var base = OUT.ENGINE_URL.replace(/#.*$/, '');
  return base + (base.slice(-1) === '/' ? '' : '/') + '#survey=' + encodeURIComponent(policy);
}
/** Days left before the 90-day lapse line. */
function pdDaysToLapse_(p) { return Math.max(0, 90 - (Number(p.DaysArrears) || 0)); }

/* ============================ email chrome ============================ */

function pdWrap_(inner, tag) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:' + PD_BRAND.ink + ';max-width:620px">' +
    '<div style="background:' + PD_BRAND.teal + ';color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
      '<table width="100%"><tr>' +
      '<td width="44" valign="middle"><div style="width:36px;height:36px;background:' + PD_BRAND.gold +
        ';border-radius:8px 8px 16px 16px;text-align:center;line-height:36px;font-size:20px;font-weight:bold;color:' + PD_BRAND.teal2 + '">✓</div></td>' +
      '<td valign="middle" style="padding-left:11px"><b style="font-size:17px">' + pdEsc_(OUT.BRANCH_NAME) + '</b><br>' +
        '<span style="color:#BFD8D3;font-size:12px">' + pdEsc_(tag || 'Policy services') + '</span></td>' +
      '</tr></table>' +
    '</div>' +
    '<div style="border:1px solid ' + PD_BRAND.line + ';border-top:none;padding:20px 22px;border-radius:0 0 10px 10px;background:#FBFAF6">' +
      inner +
      '<p style="color:#8A8578;font-size:11px;border-top:1px solid #E8E3D8;padding-top:11px;margin-top:20px">' +
      'This notice relates to the premium on your policy. Your policy contract and schedule govern in all cases. ' +
      'If you have already paid, please ignore this — payments can take a few days to reflect.</p>' +
    '</div></div>';
}
function pdBtn_(link, label) {
  if (!link) return '';
  return '<p style="text-align:center;margin:22px 0"><a href="' + link + '" style="background:' + PD_BRAND.gold +
    ';color:' + PD_BRAND.ink + ';text-decoration:none;font-weight:bold;padding:13px 28px;border-radius:8px;display:inline-block">' +
    pdEsc_(label) + '</a></p>';
}
function pdNote_(html, colour) {
  return '<div style="background:#F6ECD4;border-left:4px solid ' + (colour || PD_BRAND.gold) +
    ';padding:12px 15px;margin:14px 0">' + html + '</div>';
}
function pdFacts_(p) {
  var row = function (k, v) {
    return '<tr><td style="padding:7px 12px;background:#F3F0E9;border:1px solid #E8E3D8;width:170px;color:#5A6B7B">' +
      k + '</td><td style="padding:7px 12px;border:1px solid #E8E3D8">' + v + '</td></tr>';
  };
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:14px 0;font-size:13px">' +
    row('Policy', '<b>' + pdEsc_(p.Policy) + '</b>') +
    row('Premium', pdMoney_(p.Premium)) +
    (p.LapseDate ? row('Cover ends', pdEsc_(p.LapseDate)) : '') +
    '</table>';
}
function pdSig_() {
  return '<p style="margin-top:18px">Warm regards,<br><b>' + pdEsc_(OUT.BRANCH_NAME) + '</b>' +
    (OUT.BRANCH_PHONE ? '<br>' + pdEsc_(OUT.BRANCH_PHONE) : '') +
    (OUT.BRANCH_EMAIL ? '<br>' + pdEsc_(OUT.BRANCH_EMAIL) : '') + '</p>';
}

/* ============================ the templates ============================ */
/* Each stage returns {subject, html, whatsapp}. The WhatsApp text is the
   one an agent copies out of the engine — in this market it gets read
   when an email doesn't. Keep it short, personal and free of jargon. */

var PD_TEMPLATES = {

  /* ---- day 30: a premium missed, said plainly and without alarm ---- */
  od: function (p) {
    var first = pdFirst_(p.Client), link = pdSurveyLink_(p.Policy);
    return {
      subject: 'A premium on policy ' + p.Policy + " hasn't reached us",
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>A premium of <b>' + pdMoney_(p.Premium) + '</b> on your policy has not reached us yet. ' +
        'It is usually something small — a change of bank, a card that expired, or a payment we simply have not matched up.</p>' +
        pdFacts_(p) +
        '<p>Your cover is <b>still in force</b>. Bringing the premium up to date keeps it that way, and keeps the benefits you have already built.</p>' +
        pdBtn_(link, 'Tell us what happened') +
        '<p>If you have already paid, thank you — nothing further is needed.</p>' + pdSig_(),
        'Premium reminder'),
      whatsapp: 'Hi ' + first + ', this is ' + OUT.BRANCH_NAME + '. A premium of ' + pdMoney_(p.Premium) +
        ' on policy ' + p.Policy + " hasn't reached us. Your cover is still active. Usually it's a bank or card change — can you let me know what suits you? " +
        (link ? link : '')
    };
  },

  /* ---- day 45: ask why, don't lecture. This is the survey. ---- */
  s45: function (p) {
    var first = pdFirst_(p.Client), link = pdSurveyLink_(p.Policy), left = pdDaysToLapse_(p);
    return {
      subject: first + ', we would like to understand — policy ' + p.Policy,
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>The premium on your policy has been outstanding for about six weeks. Before this goes any further we would rather hear from you than guess.</p>' +
        pdFacts_(p) +
        '<p><b>Thirty seconds, three questions.</b> Whatever the reason — money is tight, the billing broke, or the policy is no longer what you need — ' +
        'tell us and we will work with it. There are more options than most people realise, and they all need you to still be inside the window.</p>' +
        pdBtn_(link, 'Answer 3 quick questions') +
        pdNote_('<b>Where this is heading:</b> if nothing changes, cover ends in about <b>' + left + ' days</b>. ' +
                'From that point a claim would not be paid, and restoring the policy needs a fresh application — sometimes fresh medical evidence.') +
        '<p>Prefer to talk? Reply to this email or call ' + pdEsc_(OUT.BRANCH_PHONE) + '.</p>' + pdSig_(),
        '45-day review'),
      whatsapp: 'Hi ' + first + ", it's " + OUT.BRANCH_NAME + '. Your premium on policy ' + p.Policy +
        ' has been outstanding about 6 weeks, and cover would end in roughly ' + left +
        " days if nothing changes. Before that happens I'd like to understand what's going on — 3 quick questions, 30 seconds: " +
        (link ? link : '') + ' Or just reply here and we can sort it out.'
    };
  },

  /* ---- day 52: they didn't answer. One nudge, then we stop asking. ---- */
  s45r: function (p) {
    var first = pdFirst_(p.Client), link = pdSurveyLink_(p.Policy), left = pdDaysToLapse_(p);
    return {
      subject: 'Still here when you are — policy ' + p.Policy,
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>We wrote last week about the outstanding premium on policy <b>' + pdEsc_(p.Policy) + '</b> and have not heard back. ' +
        'That is completely fine — life gets busy. We are following up once, then we will leave you alone.</p>' +
        pdNote_('Cover ends in about <b>' + left + ' days</b> if the premium stays outstanding.') +
        pdBtn_(link, 'Take 30 seconds now') +
        '<p>If the honest answer is that you want to stop the policy, tell us that too. We would rather close it properly than have it lapse quietly.</p>' + pdSig_(),
        '45-day review'),
      whatsapp: 'Hi ' + first + ", just following up on policy " + p.Policy + '. Cover ends in about ' + left +
        " days. Even if the answer is you want to stop it, tell me — I'd rather sort it properly than let it lapse. " + (link ? link : '')
    };
  },

  /* ---- day 75: the tone changes. Specific, urgent, still human. ---- */
  s75: function (p) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p);
    return {
      subject: 'Action needed — cover on policy ' + p.Policy + ' ends in ' + left + ' days',
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>This one needs your attention. The premium on your policy has been outstanding for <b>' +
        (Number(p.DaysArrears) || 0) + ' days</b>, and cover ends in about <b>' + left + ' days</b>.</p>' +
        pdFacts_(p) +
        pdNote_('<b>What ending cover actually means.</b> A claim after that date would not be paid. ' +
                'Restarting is a new application — new underwriting, and where health has changed since you took the policy out, ' +
                'the cover you have now may not be available again at any price.',
                '#B23A3A') +
        '<p><b>Your agent is going to call you.</b> Before they do, it helps to know: we can often reduce the premium, ' +
        'change the payment date, agree a catch-up plan, or adjust the benefit so it fits what you can carry now. ' +
        'Ending the policy is the last resort, not the first.</p>' +
        '<p>You can reach us directly on ' + pdEsc_(OUT.BRANCH_PHONE) + '.</p>' + pdSig_(),
        '75-day retention'),
      whatsapp: 'Hi ' + first + ' — ' + OUT.BRANCH_NAME + '. Policy ' + p.Policy + ' is ' + (Number(p.DaysArrears) || 0) +
        ' days behind and cover ends in about ' + left + " days. After that a claim wouldn't be paid, and restarting means new underwriting. " +
        "I'd like to call you today — we can look at a lower premium, a different payment date, or a catch-up plan. When suits you?"
    };
  },

  /* ---- day 88: last call ---- */
  s88: function (p) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p);
    return {
      subject: 'Final notice — policy ' + p.Policy + ' lapses in ' + left + ' day' + (left === 1 ? '' : 's'),
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>This is the last notice we will send before your policy lapses.</p>' +
        pdFacts_(p) +
        pdNote_('Once the policy lapses, the cover stops and any claim from that date is not payable. ' +
                'Everything you have paid into it stops working for you.', '#B23A3A') +
        '<p>If there is any way we can keep this in place — a smaller premium, a payment plan, a different date — ' +
        'call ' + pdEsc_(OUT.BRANCH_PHONE) + ' today. It takes one conversation.</p>' + pdSig_(),
        'Final notice'),
      whatsapp: 'Hi ' + first + ' — final notice on policy ' + p.Policy + '. It lapses in ' + left + ' day' + (left === 1 ? '' : 's') +
        ' and after that a claim is not payable. If there is any way to keep it — smaller premium, payment plan, different date — call me today on ' +
        OUT.BRANCH_PHONE + '.'
    };
  },

  /* ---- lapsed, but recently. Reinstatement is still realistic. ---- */
  winback: function (p) {
    var first = pdFirst_(p.Client), d = Number(p.DaysArrears) || 0;
    return {
      subject: 'Policy ' + p.Policy + ' can still be restored',
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>Your policy lapsed ' + (p.LapseDate ? 'on <b>' + pdEsc_(p.LapseDate) + '</b>' : 'recently') +
        ', which means there is no cover in place today. We are writing because it is not too late to put it back.</p>' +
        pdFacts_(p) +
        '<p>Reinstatement is usually simpler than starting again: the policy keeps its original age and terms, ' +
        'so the premium is normally lower than a brand-new policy bought today. The window does not stay open indefinitely — ' +
        'the longer it runs, the more evidence the insurer asks for.</p>' +
        pdBtn_(pdSurveyLink_(p.Policy), 'Ask us about restoring it') +
        '<p>One call tells you exactly what it would take: ' + pdEsc_(OUT.BRANCH_PHONE) + '.</p>' + pdSig_(),
        'Reinstatement'),
      whatsapp: 'Hi ' + first + ', ' + OUT.BRANCH_NAME + ' here. Policy ' + p.Policy + ' lapsed ' +
        (p.LapseDate ? 'on ' + p.LapseDate : d + ' days ago') +
        ", so there's no cover in place right now. It can still be reinstated — it keeps its original age and terms, so it's usually cheaper than starting fresh. Want me to check what it would take?"
    };
  },

  /* ---- new business stuck in underwriting ---- */
  pend: function (p) {
    var first = pdFirst_(p.Client), d = Number(p.DaysArrears) || 0;
    return {
      subject: 'Your application needs one more thing — policy ' + p.Policy,
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>Your application has been with underwriting for <b>' + d + ' days</b> and is waiting on outstanding requirements' +
        (p.StatusDesc ? ' — <i>' + pdEsc_(p.StatusDesc) + '</i>' : '') + '.</p>' +
        pdFacts_(p) +
        pdNote_('Until this is complete <b>you are not yet covered</b>. That is the part worth knowing — ' +
                'an application in progress is not a policy in force.') +
        '<p>Usually it is a medical appointment, a form, or a document. Reply to this email or call ' +
        pdEsc_(OUT.BRANCH_PHONE) + ' and we will tell you exactly what is outstanding and take it from there.</p>' + pdSig_(),
        'Application in progress'),
      whatsapp: 'Hi ' + first + ', your application on policy ' + p.Policy + ' has been in underwriting ' + d +
        " days waiting on requirements. Worth knowing: you're not covered until it completes. Usually it's a medical or one form — can I call you to sort it?"
    };
  },

  /* ---- the client paid. Close the loop; it earns the next renewal. ---- */
  thanks: function (p) {
    var first = pdFirst_(p.Client);
    return {
      subject: 'Thank you — policy ' + p.Policy + ' is up to date',
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>Your premium has been received and policy <b>' + pdEsc_(p.Policy) + '</b> is up to date. ' +
        'Your cover continues without a break, and the benefits you have built stay intact.</p>' +
        '<p>Thank you for sorting it out — and for staying with us.</p>' +
        '<p>If the payment date or amount would work better differently, say the word. It is easier to change than to catch up.</p>' + pdSig_(),
        'Payment received'),
      whatsapp: 'Hi ' + first + ' — payment received, policy ' + p.Policy +
        ' is up to date and your cover continues. Thank you. If a different payment date would suit you better, just say.'
    };
  }
};

/** The one call the engine UI and the daily run both use. */
function pdRender(stageKey, policy) {
  var fn = PD_TEMPLATES[stageKey];
  return fn ? fn(policy) : null;
}

/* ==================== internal: escalate to the manager ==================== */
/* The engine's retention form says "Sends to <manager>" but only ever wrote a
   row. This is the send. Call it from doPost when type === 'retention'. */

function pdEscalateRetention_(d) {
  if (!OUT.ESCALATE_CC.length) return;
  var body =
    '<p><b>' + pdEsc_(d.author) + '</b> filed a 75-day retention case and needs your response.</p>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:12px 0">' +
    '<tr><td style="padding:6px 12px;background:#F3F0E9;border:1px solid #E8E3D8">Client</td><td style="padding:6px 12px;border:1px solid #E8E3D8">' + pdEsc_(d.client) + '</td></tr>' +
    '<tr><td style="padding:6px 12px;background:#F3F0E9;border:1px solid #E8E3D8">Policy</td><td style="padding:6px 12px;border:1px solid #E8E3D8">' + pdEsc_(d.policy) + '</td></tr>' +
    '<tr><td style="padding:6px 12px;background:#F3F0E9;border:1px solid #E8E3D8">Agent</td><td style="padding:6px 12px;border:1px solid #E8E3D8">' + pdEsc_(d.agent) + '</td></tr>' +
    '<tr><td style="padding:6px 12px;background:#F3F0E9;border:1px solid #E8E3D8">Reason</td><td style="padding:6px 12px;border:1px solid #E8E3D8">' + pdEsc_(d.reason) + '</td></tr>' +
    '</table>' +
    '<p>' + pdEsc_(d.body) + '</p>' +
    (d.factFind ? '<p><b>Fact find:</b> ' + pdEsc_(d.factFind) + '</p>' : '') +
    '<p>Open the engine to respond — the agent sees your decision immediately.</p>';
  try {
    MailApp.sendEmail({
      to: OUT.ESCALATE_CC.join(','),
      name: OUT.FROM_NAME,
      subject: 'Retention case awaiting your response — ' + d.client + ' (' + d.policy + ')',
      htmlBody: pdWrap_(body, 'Manager escalation')
    });
  } catch (err) { /* never let a mail failure lose the record */ }
}

/* ============================ the daily run ============================ */

/** Which template, if any, is due for this policy today. */
function pdStageDue_(p) {
  var d = Number(p.DaysArrears) || 0;
  var desc = String(p.StatusDesc || '').toLowerCase();
  var st = Number(p.Status) || 0;

  if (st === 3 || desc.indexOf('underwriting') > -1) return d >= 21 ? 'pend' : '';
  if (st === 1 || desc === 'lapsed') return d <= OUT.WIN_BACK_MAX_DAYS ? 'winback' : '';
  if (st !== 2) return '';                       // premium paying / terminal — nothing to send

  if (d >= 88 && d < 90) return 's88';
  if (d >= 75 && d < 78) return 's75';
  if (d >= 52 && d < 55) return 's45r';
  if (d >= 45 && d < 48) return 's45';
  if (d >= 30 && d < 33) return 'od';
  return '';
}

/** Everything already sent, as a {policy|stage: true} set read back from the log. */
function pdAlreadySent_() {
  var sh = getSheet_();
  var v = sh.getDataRange().getValues();
  var seen = {};
  for (var i = 1; i < v.length; i++) {
    var type = String(v[i][10] || '');
    if (type.indexOf('outbound') !== 0) continue;
    seen[String(v[i][2]) + '|' + String(v[i][11] || '')] = true;   // policy | reason(stage)
  }
  return seen;
}

function pdLogSend_(p, stageKey, tpl, sent) {
  getSheet_().appendRow([
    Date.now(), new Date().toISOString(), p.Policy, p.Client, p.ClientNo, p.Agent,
    OUT.BRANCH_NAME, '', 'System', stageKey,
    sent ? 'outbound' : 'outbound-dry', stageKey,
    (sent ? 'Sent to ' : 'WOULD SEND to ') + (pdValidEmail_(p.Email) || 'no email on file') + ' — ' + tpl.subject,
    '', '', '', '', '', '', ''
  ]);
}

/**
 * Run daily around 8am. Install with pdInstallTrigger().
 * With OUT.DRY_RUN true (the default) this sends nothing and writes a full
 * 'outbound-dry' plan to the log instead. Read that before going live.
 */
function dailyPremiumDueRun() {
  var payload = JSON.parse(getPolicies_().getContent());
  if (!payload.ok) throw new Error('Could not read the portfolio: ' + payload.error);

  var sent = pdAlreadySent_();
  var count = 0, skippedNoEmail = 0, planned = 0;

  for (var i = 0; i < payload.policies.length; i++) {
    if (count >= OUT.MAX_SENDS_PER_RUN) break;
    var p = payload.policies[i];
    var stageKey = pdStageDue_(p);
    if (!stageKey) continue;
    if (sent[String(p.Policy) + '|' + stageKey]) continue;         // one send per policy per stage, ever
    if ((Number(p.Premium) || 0) < OUT.MIN_PREMIUM) continue;

    var tpl = pdRender(stageKey, p);
    if (!tpl) continue;
    var to = pdValidEmail_(p.Email);
    planned++;

    if (!to) {                                                      // no email: log it so an agent can call
      skippedNoEmail++;
      pdLogSend_(p, stageKey, tpl, false);
      continue;
    }
    if (OUT.DRY_RUN) { pdLogSend_(p, stageKey, tpl, false); continue; }

    try {
      MailApp.sendEmail({ to: to, name: OUT.FROM_NAME, subject: tpl.subject, htmlBody: tpl.html });
      pdLogSend_(p, stageKey, tpl, true);
      count++;
    } catch (err) {
      pdLogSend_(p, stageKey, { subject: 'FAILED: ' + String(err) }, false);
    }
  }

  Logger.log('Premium due run — %s. planned=%s sent=%s no-email=%s',
    OUT.DRY_RUN ? 'DRY RUN, nothing emailed' : 'LIVE', planned, count, skippedNoEmail);
}

function pdInstallTrigger() {
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'dailyPremiumDueRun') ScriptApp.deleteTrigger(all[i]);
  }
  ScriptApp.newTrigger('dailyPremiumDueRun').timeBased().atHour(8).everyDays(1).create();
  Logger.log(OUT.DRY_RUN
    ? 'Installed — daily at 8am, DRY RUN. Nothing will be emailed until OUT.DRY_RUN = false.'
    : 'Installed — daily at 8am, LIVE. Capped at ' + OUT.MAX_SENDS_PER_RUN + ' sends per run.');
}

/** Preview one template in the log without touching the book. */
function pdPreview() {
  var demo = {
    Policy: '9004100017', Client: 'Saira Ramnarine', ClientNo: '900120', Agent: 'Tricia Baksh',
    Premium: 538.90, Status: 2, DaysArrears: 78, LapseDate: '19 Jun 2026',
    Email: 'saira.ramnarine@example.com', StatusDesc: 'Premium Paying'
  };
  ['od', 's45', 's45r', 's75', 's88', 'winback', 'pend', 'thanks'].forEach(function (k) {
    var t = pdRender(k, demo);
    Logger.log('--- %s ---\nSUBJECT: %s\nWHATSAPP: %s\n', k, t.subject, t.whatsapp);
  });
}
