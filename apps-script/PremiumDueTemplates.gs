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
 *    day 60   RETENTION NOTICE     references the 45-day email, gives the
 *                                  client six one-click choices, and copies
 *                                  the agent, their manager and the BM
 *    every 5 days after 60         client chase, while there is no reply
 *    day 88   final notice         last call before lapse
 *    lapsed   win-back             inside the reinstatement window only
 *    pending  requirements chase   new business stuck in underwriting
 *
 * Retention opens at day 60, not 75. That is 30 days of runway instead
 * of 15, and it puts the manager in the conversation while their
 * decision can still change the outcome.
 *
 * BOTH SIDES ARE ON A CLOCK
 *   day 65      the agent should have filed the retention case
 *   +5 days     the manager should have answered it
 *   every 3 days after that, the manager is chased, and the branch
 *               manager is copied from the second chase onward
 *
 * The point is not to nag. It is that when a policy lapses, the record
 * shows exactly who had the ball and for how long — so "the agent let
 * it go" and "the manager never came back to me" stop being opinions.
 *
 * One send per policy per stage, ever. The log is the memory: before
 * sending, dailyPremiumDueRun() reads back what has already gone out
 * and skips it. Every sequence stops the moment the client replies,
 * the manager answers, or the premium is paid.
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

  // Branch manager — copied on the 60-day notice and on repeat manager chases.
  BRANCH_MANAGER_EMAIL: '',      // e.g. 'ricky.rampersad@myguardiangroup.com'

  // name -> email, for everyone who can be an agent or a manager on a case.
  // Without an entry here that person simply is not copied; nothing breaks.
  STAFF_EMAIL: {
    // 'Ricky Rampersad':   'ricky.rampersad@myguardiangroup.com',
    // 'Kerwyn Ramroach':   '...',
    // 'Tricia Baksh':      '...'
  },

  // agent -> their manager. Mirror of UNITS/HIERARCHY in the engine.
  MANAGER_OF: {
    // 'Tricia Baksh': 'Gary Sookdeo',
  },

  // Copy the client on the INTERNAL chase when a manager has not responded.
  // Off deliberately: those emails say a manager is late, and a client who
  // reads that learns their policy is drifting because of us. Turn it on only
  // if you want that visible to clients.
  COPY_CLIENT_ON_MANAGER_CHASE: false
};

/* The service clocks. These mirror SLA in premium-due/index.html — change both. */
var SLA = {
  RETENTION_OPENS: 60,
  LAPSE: 90,
  AGENT_FILE_BY: 65,
  MANAGER_REPLY_DAYS: 5,
  CLIENT_CHASE_EVERY: 5,
  MANAGER_CHASE_EVERY: 3
};

/* The six choices the 60-day email puts in front of the client. Clicking one
   records the answer against the policy and stops the chase. */
var CLIENT_CHOICES = [
  { k: 'pay',    lab: "I'll pay the full amount" },
  { k: 'plan',   lab: 'I need a payment plan' },
  { k: 'reduce', lab: "Reduce my premium — I can't manage this amount" },
  { k: 'bank',   lab: 'My bank or card details changed' },
  { k: 'call',   lab: 'Please call me to discuss' },
  { k: 'cancel', lab: 'I want to cancel the policy' }
];

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
function pdDaysToLapse_(p) { return Math.max(0, SLA.LAPSE - (Number(p.DaysArrears) || 0)); }

function pdRespondLink_(policy, key) {
  if (!OUT.ENGINE_URL) return '';
  var base = OUT.ENGINE_URL.replace(/#.*$/, '');
  return base + (base.slice(-1) === '/' ? '' : '/') +
    '#respond=' + encodeURIComponent(policy) + '&opt=' + encodeURIComponent(key);
}
function pdStaffEmail_(name) { return pdValidEmail_(OUT.STAFF_EMAIL[name] || ''); }
function pdManagerOf_(agent) { return OUT.MANAGER_OF[agent] || ''; }

/** Agent + their manager + the BM, as a de-duplicated cc list. */
function pdChainCc_(p) {
  var out = [], seen = {};
  var add = function (e) { e = pdValidEmail_(e); if (e && !seen[e]) { seen[e] = 1; out.push(e); } };
  add(pdStaffEmail_(p.Agent));
  add(pdStaffEmail_(pdManagerOf_(p.Agent)));
  add(OUT.BRANCH_MANAGER_EMAIL);
  return out;
}

/** The six one-click options, as a block of buttons. */
function pdChoiceBlock_(p) {
  if (!OUT.ENGINE_URL) {
    return pdNote_('<b>Reply to this email</b> and tell us which of these fits: pay in full · a payment plan · ' +
      'a lower premium · your bank details changed · you would like a call.');
  }
  var rows = CLIENT_CHOICES.map(function (o) {
    return '<tr><td style="padding:5px 0">' +
      '<a href="' + pdRespondLink_(p.Policy, o.k) + '" style="display:block;padding:12px 16px;' +
      'background:#fff;border:1px solid ' + PD_BRAND.teal + ';border-radius:9px;color:' + PD_BRAND.teal2 +
      ';text-decoration:none;font-weight:600;font-size:14px">' + pdEsc_(o.lab) + '</a></td></tr>';
  }).join('');
  return '<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0">' + rows + '</table>' +
    '<p style="font-size:12px;color:#7C8794;text-align:center;margin-top:-4px">' +
    'One tap. No form, no password — it just tells us how to help.</p>';
}

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
    '<div style="border:1px solid ' + PD_BRAND.line + ';border-top:none;padding:20px 22px;border-radius:0 0 10px 10px;background:#FBFAF6;color:' + PD_BRAND.ink + '">' +
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
    ';padding:12px 15px;margin:14px 0;color:' + PD_BRAND.ink + '">' + html + '</div>';
}
function pdFacts_(p) {
  // Every cell states its own colour and background. Table colour inheritance is
  // unreliable across mail clients — Outlook and Gmail's dark mode in particular —
  // so a cell that only sets a background renders as invisible text often enough
  // to matter when the thing being hidden is the policy number.
  var row = function (k, v) {
    return '<tr>' +
      '<td style="padding:7px 12px;background:#F3F0E9;border:1px solid #E8E3D8;width:170px;color:#5A6B7B">' + k + '</td>' +
      '<td style="padding:7px 12px;background:#FFFFFF;border:1px solid #E8E3D8;color:' + PD_BRAND.ink + '">' + v + '</td>' +
      '</tr>';
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

  /* ---- day 60: refers back to the 45-day email, offers a way out, and puts
         the agent, their manager and the BM on the thread ---- */
  s60: function (p) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p), d = Number(p.DaysArrears) || 0;
    var mgr = pdManagerOf_(p.Agent);
    return {
      subject: 'Following up on our last message — policy ' + p.Policy,
      cc: pdChainCc_(p),
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>We wrote to you around day 45 asking what was happening with the premium on policy <b>' +
        pdEsc_(p.Policy) + '</b>, and we have not heard back. We are not writing to chase you — we are writing because ' +
        'the window to fix this without consequences is closing.</p>' +
        pdFacts_(p) +
        pdNote_('The premium is now <b>' + d + ' days</b> outstanding. Cover ends in about <b>' + left + ' days</b>.') +
        '<p><b>Tell us which of these fits and we will do the rest.</b> Every one of them keeps your policy alive — ' +
        'even the last one gets you a proper conversation rather than a silent lapse.</p>' +
        pdChoiceBlock_(p) +
        '<p style="font-size:13px;color:#5A6B7B">Your agent <b>' + pdEsc_(p.Agent) + '</b>' +
        (mgr ? ', their manager <b>' + pdEsc_(mgr) + '</b>' : '') +
        ' and the branch manager are all copied on this message, so whichever you pick, somebody will act on it.</p>' +
        '<p>Or simply call ' + pdEsc_(OUT.BRANCH_PHONE) + '.</p>' + pdSig_(),
        '60-day retention'),
      whatsapp: 'Hi ' + first + ' — ' + OUT.BRANCH_NAME + '. We wrote around day 45 about policy ' + p.Policy +
        " and haven't heard back. It's now " + d + ' days behind, so cover ends in about ' + left +
        ' days. Your agent, their manager and the branch manager are all across this — we would rather fix it than lose it. ' +
        'Which fits: pay in full, a payment plan, a lower premium, a bank detail change, or a call back?'
    };
  },

  /* ---- every 5 days after 60, while the client has said nothing ---- */
  chase: function (p) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p), d = Number(p.DaysArrears) || 0;
    var mgr = pdManagerOf_(p.Agent);
    return {
      subject: 'Still no word — policy ' + p.Policy + ', ' + left + ' days left',
      cc: pdChainCc_(p),
      html: pdWrap_(
        '<p>Dear ' + pdEsc_(first) + ',</p>' +
        '<p>We have written before and have not been able to reach you. Policy <b>' + pdEsc_(p.Policy) +
        '</b> is now <b>' + d + ' days</b> behind, and cover ends in about <b>' + left + ' days</b>.</p>' +
        pdNote_('We do not want this to lapse by silence. If the answer is that you want to stop the policy, ' +
                'tell us that — we will close it properly and make sure you understand what you are giving up.') +
        pdChoiceBlock_(p) +
        (mgr ? '<p style="font-size:13px;color:#5A6B7B"><b>' + pdEsc_(mgr) + '</b> has been asked to reach out to you directly as well.</p>' : '') +
        '<p>Call ' + pdEsc_(OUT.BRANCH_PHONE) + ' any time.</p>' + pdSig_(),
        'Follow-up'),
      whatsapp: 'Hi ' + first + ', following up again on policy ' + p.Policy + '. It is ' + d +
        ' days behind and cover ends in about ' + left +
        " days. I don't want this to lapse by silence — even one line back, including \"I want to stop it\", lets me act."
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

function pdKv_(k, v) {
  return '<tr>' +
    '<td style="padding:6px 12px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B">' + k + '</td>' +
    '<td style="padding:6px 12px;background:#FFFFFF;border:1px solid #E8E3D8;color:' + PD_BRAND.ink + '">' + v + '</td>' +
    '</tr>';
}

function pdEscalateRetention_(d) {
  if (!OUT.ESCALATE_CC.length) return;
  var body =
    '<p><b>' + pdEsc_(d.author) + '</b> filed a 75-day retention case and needs your response.</p>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:12px 0">' +
    pdKv_('Client', pdEsc_(d.client)) + pdKv_('Policy', pdEsc_(d.policy)) +
    pdKv_('Agent',  pdEsc_(d.agent))  + pdKv_('Reason', pdEsc_(d.reason)) +
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
function pdStageDue_(p, state) {
  var d = Number(p.DaysArrears) || 0;
  var desc = String(p.StatusDesc || '').toLowerCase();
  var st = Number(p.Status) || 0;

  if (st === 3 || desc.indexOf('underwriting') > -1) return d >= 21 ? 'pend' : '';
  if (st === 1 || desc === 'lapsed') return d <= OUT.WIN_BACK_MAX_DAYS ? 'winback' : '';
  if (st !== 2) return '';                       // premium paying / terminal — nothing to send

  if (d >= 88 && d < 90) return 's88';

  // the 60-day notice, then a chase every 5 days while the client says nothing
  if (d >= SLA.RETENTION_OPENS) {
    if (state && state.responded) return '';     // they answered — stop
    if (d < SLA.RETENTION_OPENS + 3) return 's60';
    var since = d - SLA.RETENTION_OPENS;
    if (since % SLA.CLIENT_CHASE_EVERY === 0) return 'chase';
    return '';
  }

  if (d >= 52 && d < 55) return 's45r';
  if (d >= 45 && d < 48) return 's45';
  if (d >= 30 && d < 33) return 'od';
  return '';
}

/* ===================== internal accountability chases =====================
   Two clocks run alongside the client sequence. Neither emails the client.

     the agent has not filed by day 65        -> nudge the agent, cc the manager
     the manager has not answered in 5 days   -> nudge the manager, and from the
                                                 second chase cc the branch manager

   Read from the log, so they stop the moment the work is actually done. */

/** Per-policy state assembled from the log in one pass. */
function pdCaseState_() {
  var v = getSheet_().getDataRange().getValues();
  var map = {};
  for (var i = 1; i < v.length; i++) {
    var policy = String(v[i][2] || ''); if (!policy) continue;
    var type = String(v[i][10] || ''), ts = Number(v[i][0]) || 0;
    var s = map[policy] || (map[policy] = { responded: false, retentionTs: 0, verdict: false, chases: {} });
    if (type === 'response') s.responded = true;
    else if (type === 'retention') s.retentionTs = Math.max(s.retentionTs, ts);
    else if (type === 'verdict') s.verdict = true;
    else if (type.indexOf('internal') === 0) {
      var key = String(v[i][11] || '');
      s.chases[key] = Math.max(s.chases[key] || 0, ts);
    }
  }
  return map;
}

function pdDaysSince_(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : 0; }

function pdLogInternal_(p, kind, to, note, sent) {
  getSheet_().appendRow([
    Date.now(), new Date().toISOString(), p.Policy, p.Client, p.ClientNo, p.Agent,
    OUT.BRANCH_NAME, '', 'System', kind,
    sent ? 'internal' : 'internal-dry', kind,
    (sent ? 'Chased ' : 'WOULD CHASE ') + (to || 'no address on file') + ' — ' + note,
    '', '', '', '', '', '', ''
  ]);
}

/** Nudge whoever is holding the case up. Returns 1 if something was sent. */
function pdInternalChase_(p, s) {
  var d = Number(p.DaysArrears) || 0;
  if (d < SLA.RETENTION_OPENS || d >= SLA.LAPSE) return 0;
  var mgrName = pdManagerOf_(p.Agent);

  // --- the agent has not filed ---
  if (!s.retentionTs) {
    if (d < SLA.AGENT_FILE_BY) return 0;
    if (pdDaysSince_(s.chases['agent-file']) < SLA.MANAGER_CHASE_EVERY && s.chases['agent-file']) return 0;
    var aTo = pdStaffEmail_(p.Agent);
    var note = 'Retention case not filed — day ' + d + ' of ' + SLA.LAPSE;
    if (!aTo || OUT.DRY_RUN) { pdLogInternal_(p, 'agent-file', aTo, note, false); return 0; }
    MailApp.sendEmail({
      to: aTo, cc: pdValidEmail_(pdStaffEmail_(mgrName)) || '', name: OUT.FROM_NAME,
      subject: 'Retention case overdue — ' + p.Client + ' (' + p.Policy + ')',
      htmlBody: pdWrap_(
        '<p>Policy <b>' + pdEsc_(p.Policy) + '</b> for <b>' + pdEsc_(p.Client) + '</b> is <b>' + d +
        ' days</b> in arrears and no retention case has been filed. It lapses in ' + pdDaysToLapse_(p) + ' days.</p>' +
        pdNote_('Your manager cannot decide on a case that was never filed. File it with the fact find attached and the ' +
                'decision still has time to change the outcome.') +
        '<p>' + (mgrName ? pdEsc_(mgrName) + ' is copied.' : '') + '</p>', 'Agent — action overdue')
    });
    pdLogInternal_(p, 'agent-file', aTo, note, true);
    return 1;
  }

  // --- the manager has not answered ---
  if (s.verdict) return 0;
  var waiting = pdDaysSince_(s.retentionTs);
  if (waiting < SLA.MANAGER_REPLY_DAYS) return 0;
  var lastChase = s.chases['manager-reply'];
  if (lastChase && pdDaysSince_(lastChase) < SLA.MANAGER_CHASE_EVERY) return 0;

  var mTo = pdStaffEmail_(mgrName);
  var note2 = 'Manager response ' + waiting + ' days outstanding — day ' + d + ' of ' + SLA.LAPSE;
  if (!mTo || OUT.DRY_RUN) { pdLogInternal_(p, 'manager-reply', mTo, note2, false); return 0; }

  var cc = [];
  if (lastChase) { var bm = pdValidEmail_(OUT.BRANCH_MANAGER_EMAIL); if (bm) cc.push(bm); }  // 2nd chase onward
  if (OUT.COPY_CLIENT_ON_MANAGER_CHASE) { var ce = pdValidEmail_(p.Email); if (ce) cc.push(ce); }

  MailApp.sendEmail({
    to: mTo, cc: cc.join(','), name: OUT.FROM_NAME,
    subject: 'Your response is outstanding — ' + p.Client + ' (' + p.Policy + ')',
    htmlBody: pdWrap_(
      '<p><b>' + pdEsc_(p.Agent) + '</b> filed a retention case on policy <b>' + pdEsc_(p.Policy) +
      '</b> for <b>' + pdEsc_(p.Client) + '</b> <b>' + waiting + ' days ago</b> and is waiting on your decision.</p>' +
      pdFacts_(p) +
      pdNote_('The policy lapses in <b>' + pdDaysToLapse_(p) + ' days</b>. Until you respond, the agent cannot ' +
              'offer the client anything — the case is with you, not them.', '#B23A3A') +
      (cc.length ? '<p style="font-size:13px;color:#5A6B7B">The branch manager is copied on this reminder.</p>' : '') +
      '<p>Open the engine and respond — the agent sees it immediately.</p>', 'Manager — response overdue')
  });
  pdLogInternal_(p, 'manager-reply', mTo, note2, true);
  return 1;
}

/** Everything already sent, as a {policy|stage: true} set read back from the log. */
function pdAlreadySent_() {
  var sh = getSheet_();
  var v = sh.getDataRange().getValues();
  var seen = {};
  for (var i = 1; i < v.length; i++) {
    var type = String(v[i][10] || '');
    if (type.indexOf('outbound') !== 0) continue;
    var st = String(v[i][11] || '');
    seen[String(v[i][2]) + '|' + st] = true;                       // policy | stage
    if (st === 'chase') {                                          // chases repeat — key them by day
      var m = String(v[i][12] || '').match(/day (\d+)/);
      if (m) seen[String(v[i][2]) + '|chase|' + m[1]] = true;
    }
  }
  return seen;
}

function pdLogSend_(p, stageKey, tpl, sent) {
  getSheet_().appendRow([
    Date.now(), new Date().toISOString(), p.Policy, p.Client, p.ClientNo, p.Agent,
    OUT.BRANCH_NAME, '', 'System', stageKey,
    sent ? 'outbound' : 'outbound-dry', stageKey,
    (sent ? 'Sent to ' : 'WOULD SEND to ') + (pdValidEmail_(p.Email) || 'no email on file') +
      (tpl.cc && tpl.cc.length ? ' (cc ' + tpl.cc.length + ')' : '') +
      ' — day ' + (Number(p.DaysArrears) || 0) + ' — ' + tpl.subject,
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
  var states = pdCaseState_();
  var count = 0, skippedNoEmail = 0, planned = 0, internal = 0;

  for (var i = 0; i < payload.policies.length; i++) {
    if (count >= OUT.MAX_SENDS_PER_RUN) break;
    var p = payload.policies[i];
    var s = states[String(p.Policy)] || { responded: false, retentionTs: 0, verdict: false, chases: {} };

    internal += pdInternalChase_(p, s);          // agent / manager accountability

    var stageKey = pdStageDue_(p, s);
    if (!stageKey) continue;
    // chases repeat by design; everything else sends once per policy per stage
    if (stageKey !== 'chase' && sent[String(p.Policy) + '|' + stageKey]) continue;
    if (stageKey === 'chase' && sent[String(p.Policy) + '|chase|' + (Number(p.DaysArrears) || 0)]) continue;
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
      var msg = { to: to, name: OUT.FROM_NAME, subject: tpl.subject, htmlBody: tpl.html };
      if (tpl.cc && tpl.cc.length) msg.cc = tpl.cc.join(',');   // agent + manager + BM
      MailApp.sendEmail(msg);
      pdLogSend_(p, stageKey, tpl, true);
      count++;
    } catch (err) {
      pdLogSend_(p, stageKey, { subject: 'FAILED: ' + String(err) }, false);
    }
  }

  Logger.log('Premium due run — %s. planned=%s sent=%s no-email=%s internal-chases=%s',
    OUT.DRY_RUN ? 'DRY RUN, nothing emailed' : 'LIVE', planned, count, skippedNoEmail, internal);
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
  ['od', 's45', 's45r', 's60', 'chase', 's88', 'winback', 'pend', 'thanks'].forEach(function (k) {
    var t = pdRender(k, demo);
    Logger.log('--- %s ---\nSUBJECT: %s\nWHATSAPP: %s\n', k, t.subject, t.whatsapp);
  });
}
