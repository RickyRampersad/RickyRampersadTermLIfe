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
 *                                  client ten grouped one-click options, and copies
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
  // The Salesforce macro "Premium Due 75 Days Client Comm" sends from the branch
  // address and copies sales support. Same here, so the trail stays in one place.
  SALES_SUPPORT_EMAIL: 'RickyRampersadSalesSupport@myguardiangroup.com',

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
  MANAGER_REPLY_DAYS: 3,          // the branch's documented TAT, per the Premium Due Guidelines
  CLIENT_CHASE_EVERY: 5,
  MANAGER_CHASE_EVERY: 3
};

/* ===================== WHAT WE ASK THE CLIENT =====================
   Deliberately NOT the questions from the old JotForm. That form ran for three
   years and drew 152 responses, and its top answer to "what steps do you plan to
   take" was "Other" — because it read like an audit. It asked whether the delay
   was intentional, what the reason was, and what steps the client planned to
   take to bring the account current. Every one of those asks a person to account
   for a failure before we offer them anything.

   These two ask something different. Every answer is a service we provide, not
   a shortcoming they admit. Nobody is asked why they are late, because the
   answer rarely changes what we can do, and asking makes it likelier they say
   nothing at all.

   The evidence behind the shape:

     Empathetic framing rather than demand framing raises voluntary payment by
     up to 20% (CFPB, on debt collection communications).

     A stated commitment — "when would suit you?" — lifts response by about
     5 percentage points over a reminder alone.

     A loss reads roughly twice as strongly as an equivalent gain
     (Kahneman and Tversky), which is why the letter states what is at stake
     before it asks anything, and why one of the options is simply
     "show me exactly what I'd be giving up".

   Two questions. One tap each. No reason required, no browser, no form. */

var CLIENT_QUESTIONS = [
  { k: 'help', q: 'What would help most right now?', opts: [
    { k: 'settle',  lab: "Nothing — I'll clear it. Just tell me the amount." },
    { k: 'lower',   lab: 'A smaller monthly amount I can actually keep up with' },
    { k: 'date',    lab: 'Move the payment date to match my payday' },
    { k: 'bank',    lab: "Fix the bank instruction — it isn't going through" },
    { k: 'pause',   lab: 'A short pause, without losing the cover' },
    { k: 'talk',    lab: 'A conversation with someone before I decide anything' },
    { k: 'show',    lab: "Show me exactly what I'd be giving up" } ] },

  { k: 'when', q: 'When would suit you?', opts: [
    { k: 'today',  lab: 'I can deal with it today' },
    { k: 'payday', lab: 'On my next payday' },
    { k: 'weeks',  lab: 'Within the next couple of weeks' },
    { k: 'call',   lab: "I'm not sure yet — please call me" } ] }
];

/* The questions a manager must answer once an agent files a retention case.
   Previously there were two — a free-text comment and an approval status — and
   three quarters came back empty. These are specific, clickable, and every one
   of them is a thing the agent cannot proceed without. */
var MANAGER_QUESTIONS = [
  { k: 'mcontact', q: 'Have you personally contacted this client?', opts: [
    { k: 'yes',       lab: 'Yes — I have spoken with them' },
    { k: 'attempted', lab: 'Attempted — no response yet' },
    { k: 'notyet',    lab: 'Not yet — I will do so today' } ] },

  { k: 'mdecision', q: 'What is your decision on this case?', opts: [
    { k: 'retention',   lab: 'Approve the retention plan as proposed' },
    { k: 'payplan',     lab: 'Approve a payment plan' },
    { k: 'reduce',      lab: 'Approve a premium reduction or benefit alteration' },
    { k: 'reinstate',   lab: 'Escalate to reinstatement' },
    { k: 'replacement', lab: 'Investigate possible replacement of in-force cover' },
    { k: 'reassign',    lab: 'Reassign — orphan or wrong agent' },
    { k: 'lapse',       lab: 'Allow the policy to lapse — documented' } ] },

  { k: 'mfactfind', q: 'Is the fact find complete and acceptable?', opts: [
    { k: 'yes',      lab: 'Yes — complete' },
    { k: 'returned', lab: 'No — returned to the agent for completion' },
    { k: 'none',     lab: 'No fact find was attached' } ] },

  { k: 'moutlook', q: 'How likely is this policy to be saved?', opts: [
    { k: 'high', lab: 'High — the client is engaged' },
    { k: 'mod',  lab: 'Moderate — depends on the concession' },
    { k: 'low',  lab: 'Low — prepare for lapse' } ] },

  { k: 'msupport', q: 'Do you need the branch manager involved?', opts: [
    { k: 'no',  lab: 'No — I have this' },
    { k: 'yes', lab: 'Yes — please escalate to the branch manager' } ] },

  { k: 'mwhen', q: 'By when will this be resolved?', opts: [
    { k: 'today', lab: 'Today' },
    { k: 'week',  lab: 'Within this week' },
    { k: 'd75',   lab: 'Before day 75' },
    { k: 'd88',   lab: 'Before day 88 — the final notice' } ] }
];

/* Flat lookup, so a returning click can be named without walking the sets. */
var ANSWER_BY_KEY = (function () {
  var m = {};
  [CLIENT_QUESTIONS, MANAGER_QUESTIONS].forEach(function (set) {
    set.forEach(function (q) {
      q.opts.forEach(function (o) { m[q.k + ':' + o.k] = { q: q.q, lab: o.lab, qk: q.k }; });
    });
  });
  return m;
})();

var PD_BRAND = { teal: '#0E6E64', teal2: '#0A524A', gold: '#C9972B', ink: '#0B1B2B', line: '#D9D3C6', red: '#B23A3A' };

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
  add(OUT.SALES_SUPPORT_EMAIL);
  return out;
}

/**
 * The link behind one answer.
 *
 * With the engine deployed this is a one-tap link that records the answer and
 * needs nothing else. Without it — which is the situation today — it is a
 * mailto with the subject and body already written, so the client taps the
 * answer, their mail app opens filled in, and they press send. Two taps, no
 * browser, no form, no password, and it works from any phone on any network.
 *
 * The mailto is not a downgrade to tolerate. It is the version that keeps
 * working when someone is on a bad connection or will not open a web page from
 * an email, which is a large share of the people we are trying to reach.
 */
function pdAnswerHref_(p, q, o, kind) {
  if (OUT.ENGINE_URL) {
    var base = OUT.ENGINE_URL.replace(/#.*$/, '');
    base = base + (base.slice(-1) === '/' ? '' : '/');
    return base + '#' + kind + '=' + encodeURIComponent(p.Policy) +
           '&q=' + encodeURIComponent(q.k) + '&a=' + encodeURIComponent(o.k);
  }
  var to = OUT.BRANCH_EMAIL;
  var subj = 'Policy ' + p.Policy + ' — ' + o.lab;
  var body = 'Policy No. ' + p.Policy + '\n' +
             (p.ClientNo ? 'Client reference ' + p.ClientNo + '\n' : '') +
             (p.Client ? p.Client + '\n' : '') + '\n' +
             q.q + '\n' + o.lab + '\n\n' +
             'Anything you would like to add:\n\n\n' +
             '— sent from the premium notice for policy ' + p.Policy;
  return 'mailto:' + encodeURIComponent(to) +
         '?cc=' + encodeURIComponent(OUT.SALES_SUPPORT_EMAIL || '') +
         '&subject=' + encodeURIComponent(subj) +
         '&body=' + encodeURIComponent(body);
}

/**
 * Renders a question set as clickable answers inside the email itself.
 * kind is 'respond' for the client and 'mgr' for the manager, which is the only
 * difference between the two — same shape, same one-click contract.
 */
function pdQuestionBlock_(p, questions, kind) {
  var out = '';
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    out += '<div style="margin:18px 0 0">' +
      '<div style="font-size:13.5px;font-weight:bold;color:' + PD_BRAND.ink + ';margin-bottom:7px">' +
        (i + 1) + '. ' + pdEsc_(q.q) + '</div>' +
      '<table cellpadding="0" cellspacing="0" style="width:100%">';
    for (var j = 0; j < q.opts.length; j++) {
      var o = q.opts[j];
      var href = pdAnswerHref_(p, q, o, kind);
      out += '<tr><td style="padding:3px 0">' +
        '<a href="' + href + '" style="display:block;padding:10px 14px;background:#FFFFFF;border:1px solid ' +
        PD_BRAND.teal + ';border-radius:7px;color:' + PD_BRAND.teal2 +
        ';text-decoration:none;font-weight:600;font-size:13.5px">' + pdEsc_(o.lab) + '</a></td></tr>';
    }
    out += '</table></div>';
  }
  return out + '<p style="font-size:12px;color:#7C8794;margin:14px 0 0">' +
    (OUT.ENGINE_URL
      ? 'Each answer is recorded against the policy the moment you tap it. You can answer one question or all of them, in any order, and you never leave this email to do it.'
      : 'Tapping an answer opens a reply that is already written for you — just press send. Nothing to fill in, no website to visit, no password.') + '</p>';
}

/** The short form — just the "what will you do" question, for reminder messages. */
function pdChoiceBlock_(p) {
  var steps = CLIENT_QUESTIONS.filter(function (q) { return q.k === 'steps'; });
  return pdQuestionBlock_(p, steps, 'respond');
}

/* ===================== THE CORRESPONDENCE TRAIL =====================
   Every letter we sent, whether they answered, what they chose, and anything
   attached — in date order. It is in the client's letter and not just our file
   for two reasons: it shows we have been keeping track, which changes how the
   last letter in a sequence reads; and where a client did answer and we acted
   on it, saying so is the difference between a follow-up and a form letter
   that ignores them. */

var TRAIL_LABEL = {
  od:      'We wrote about the premium on this policy',
  s45:     'We asked what would help',
  s45r:    'We followed up, having had no reply',
  s60:     'We wrote formally, copying your agent and their managers',
  chase:   'We followed up again',
  s88:     'Final notice',
  winback: 'We wrote about restoring the policy',
  pend:    'We wrote about the outstanding requirements'
};

function pdTrailRow_(when, what, mine) {
  return '<tr>' +
    '<td style="padding:7px 11px;border:1px solid #E8E3D8;background:#F3F0E9;color:#5A6B7B;' +
      'white-space:nowrap;width:120px;vertical-align:top">' + when + '</td>' +
    '<td style="padding:7px 11px;border:1px solid #E8E3D8;background:#FFFFFF;color:' +
      (mine ? PD_BRAND.teal2 : PD_BRAND.ink) + ';font-weight:' + (mine ? '600' : 'normal') + '">' + what + '</td>' +
    '</tr>';
}

function pdTrail_(p, state) {
  var events = (state && state.trail) ? state.trail.slice() : [];

  if (state && state.replies) {
    for (var i = 0; i < state.replies.length; i++) {
      var r = state.replies[i];
      events.push({ ts: r.ts, mine: true, what: 'You told us: <b>' + pdEsc_(r.lab || '') + '</b>' });
    }
  }
  if (state && state.survey && state.survey.ts) {
    events.push({ ts: state.survey.ts, mine: true,
      what: 'You replied to us' + (state.survey.surveyReason ? ': <b>' + pdEsc_(state.survey.surveyReason) + '</b>' : '') });
  }
  if (state && state.retentionTs) {
    events.push({ ts: state.retentionTs, mine: false,
      what: 'Your agent prepared a written case for their manager' +
            (state.factFind ? ', with a completed fact find attached' : '') });
  }
  events.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });

  if (!events.length) {
    return pdNote_('<b>We have written to you about this policy and have had no reply.</b> ' +
      'That is why this letter is more formal than the last one, and why it is copied to your ' +
      'agent&rsquo;s manager and to the branch manager.');
  }

  var rows = '';
  for (var j = 0; j < events.length; j++) rows += pdTrailRow_(pdDateOf_(events[j].ts), events[j].what, events[j].mine);
  rows += pdTrailRow_('Today', 'This letter', false);

  var answered = false;
  for (var m = 0; m < events.length; m++) if (events[m].mine) answered = true;

  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px">' +
      rows + '</table>' +
    (answered
      ? pdNote_('You did come back to us, and we acted on what you said. The premium is still outstanding, ' +
          'so we are writing again — this time with the full timeline, so nothing about what happens next ' +
          'comes as a surprise.')
      : pdNote_('<b>We have had no reply to any of the above.</b> If our letters have been going to the ' +
          'wrong address, or if there is a reason it has been hard to respond, tell us and we will work around it.'));
}

/* ============================ email chrome ============================ */

function pdWrap_(inner, tag) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:' + PD_BRAND.ink + ';max-width:620px">' +
    '<div style="background:' + PD_BRAND.teal + ';color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
      '<table width="100%"><tr>' +
      '<td width="44" valign="middle" style="color:#FFFFFF"><div style="width:36px;height:36px;background:' + PD_BRAND.gold +
        ';border-radius:8px 8px 16px 16px;text-align:center;line-height:36px;font-size:20px;font-weight:bold;color:' + PD_BRAND.teal2 + '">✓</div></td>' +
      '<td valign="middle" style="padding-left:11px;color:#FFFFFF">' +
        '<b style="font-size:17px;color:#FFFFFF">' + pdEsc_(OUT.BRANCH_NAME) + '</b><br>' +
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
/* ===================== standard letter furniture =====================
   Every message uses the same blocks in the same order: reference, numbered
   sections, timeline where relevant, signature. Consistency is what makes a
   sequence read as a branch process rather than as somebody's individual email. */

function pdToday_() {
  return Utilities.formatDate(new Date(), 'America/Port_of_Spain', 'd MMMM yyyy');
}
function pdDateOf_(ts) {
  return ts ? Utilities.formatDate(new Date(Number(ts)), 'America/Port_of_Spain', 'd MMMM yyyy') : '';
}
/**
 * Formal salutation using the full name. Deliberately not "Dear Mr Ramnarine" —
 * the portfolio carries no title and no way to infer one, and addressing a
 * client by the wrong one on a letter about their lapsing policy is a poor
 * way to open. Full name is formal enough and always correct.
 */
function pdSalutation_(name) {
  var n = String(name || '').replace(/\s*\(client\)/i, '').trim();
  return n ? 'Dear ' + n : 'Dear Policyholder';
}

/** Date and reference line, as on a letter. */
function pdRefBlock_(p, subject) {
  return '<table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;font-size:13px">' +
    '<tr><td style="padding:0 0 4px;color:#5A6B7B">' + pdToday_() + '</td></tr>' +
    '<tr><td style="padding:0;color:' + PD_BRAND.ink + '"><b>Re: Policy No. ' + pdEsc_(p.Policy) +
      ' — ' + pdEsc_(subject) + '</b></td></tr>' +
    (p.ClientNo ? '<tr><td style="padding:3px 0 0;color:#5A6B7B">Client reference ' + pdEsc_(p.ClientNo) + '</td></tr>' : '') +
    '</table>';
}

/** A numbered section heading with its body. */
function pdSection_(n, title, body) {
  return '<div style="margin:18px 0 0">' +
    '<div style="font-size:13px;font-weight:bold;color:' + PD_BRAND.teal2 + ';margin-bottom:6px">' +
      n + '. ' + pdEsc_(title) + '</div>' +
    '<div style="color:' + PD_BRAND.ink + '">' + body + '</div></div>';
}

/** What happens next, with dates rather than adjectives. */
function pdTimeline_(p) {
  var d = Number(p.DaysArrears) || 0;
  var row = function (when, what, emphasis) {
    return '<tr>' +
      '<td style="padding:8px 12px;background:#F3F0E9;border:1px solid #E8E3D8;width:118px;white-space:nowrap;color:' +
        (emphasis ? PD_BRAND.red : '#5A6B7B') + ';font-weight:' + (emphasis ? 'bold' : 'normal') + '">' + when + '</td>' +
      '<td style="padding:8px 12px;background:#FFFFFF;border:1px solid #E8E3D8;color:' + PD_BRAND.ink + '">' + what + '</td>' +
      '</tr>';
  };
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    row('Today', 'Day <b>' + d + '</b> — the premium is outstanding and your cover remains in force.') +
    row('Within 3 days', 'Your agent submits a retention case to their manager, who must respond within three working days &mdash; the branch standard.') +
    row('Day 75', 'If we have still not heard from you, your agent&rsquo;s manager contacts you directly.') +
    row('Day 88', 'Final written notice.') +
    row('Day 90', 'Cover ends. From that date a claim is not payable and reinstatement requires a fresh application.', true) +
    '</table>';
}

/* ===================== THE WHOLE RELATIONSHIP =====================
   55% of the clients in the 45/60 window hold more than one policy with us, and
   27% of their cover — $191m across the book — sits on the policies that are
   NOT the one in arrears. Writing to them about a single policy number, as if
   that were the whole relationship, throws all of that away.

   It also tells us which conversation to have. 60 clients are behind on one
   policy while paying another perfectly well: that is a failed mandate, not
   affordability, and saying so is the difference between being helpful and
   sounding like a collections notice. 137 have already lost a policy to lapse
   and are on course to do it again. */

function pdFamily_(p, family) {
  return (family && family.length) ? family : [p];
}

/** Total cover the client holds with us, across everything still in force. */
function pdTotalCover_(family) {
  var t = 0;
  for (var i = 0; i < family.length; i++) {
    var f = family[i];
    if (Number(f.Status) === 1) continue;               // already lapsed, not at stake
    t += Number(f.SumAssured) || 0;
  }
  return t;
}

/** How this client's situation reads, so the letter can say the true thing. */
function pdRelationship_(p, family) {
  var payingOthers = 0, lapsedBefore = 0, alsoBehind = 0, others = 0;
  for (var i = 0; i < family.length; i++) {
    var f = family[i];
    if (String(f.Policy) === String(p.Policy)) continue;
    others++;
    var st = Number(f.Status), desc = String(f.StatusDesc || '').toLowerCase();
    if (st === 1 || desc === 'lapsed') lapsedBefore++;
    else if (st === 2) alsoBehind++;
    else if (desc === 'premium paying') payingOthers++;
  }
  return { others: others, payingOthers: payingOthers, lapsedBefore: lapsedBefore,
           alsoBehind: alsoBehind, cover: pdTotalCover_(family) };
}

/** Every policy the client holds, with the one in arrears marked. */
function pdPolicyTable_(p, family) {
  if (family.length < 2) return '';
  var rows = '';
  for (var i = 0; i < family.length; i++) {
    var f = family[i];
    var here = String(f.Policy) === String(p.Policy);
    var st = Number(f.Status), desc = String(f.StatusDesc || '');
    var label = here ? 'This letter' : (st === 1 ? 'Lapsed' : st === 2 ? 'Behind' :
                 st === 3 ? 'In underwriting' : desc || 'In force');
    var colour = here ? PD_BRAND.red : (st === 1 ? '#8A8578' : st === 2 ? PD_BRAND.gold : PD_BRAND.teal);
    rows += '<tr>' +
      '<td style="padding:8px 11px;border:1px solid #E8E3D8;background:' + (here ? '#F6ECD4' : '#FFFFFF') +
        ';color:' + PD_BRAND.ink + ';font-weight:' + (here ? 'bold' : 'normal') + '">' + pdEsc_(f.Policy) + '</td>' +
      '<td style="padding:8px 11px;border:1px solid #E8E3D8;background:' + (here ? '#F6ECD4' : '#FFFFFF') +
        ';color:' + PD_BRAND.ink + '">' + pdEsc_(f.PlanCode || '—') + '</td>' +
      '<td style="padding:8px 11px;border:1px solid #E8E3D8;background:' + (here ? '#F6ECD4' : '#FFFFFF') +
        ';color:' + PD_BRAND.ink + ';text-align:right">' +
        (Number(f.SumAssured) > 0 ? pdMoney_(f.SumAssured) : '—') + '</td>' +
      '<td style="padding:8px 11px;border:1px solid #E8E3D8;background:' + (here ? '#F6ECD4' : '#FFFFFF') +
        ';color:' + colour + ';font-weight:600;white-space:nowrap">' + pdEsc_(label) + '</td>' +
      '</tr>';
  }
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    '<tr>' +
      '<th style="padding:7px 11px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B;text-align:left;font-weight:600">Policy</th>' +
      '<th style="padding:7px 11px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B;text-align:left;font-weight:600">Plan</th>' +
      '<th style="padding:7px 11px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B;text-align:right;font-weight:600">Benefit</th>' +
      '<th style="padding:7px 11px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B;text-align:left;font-weight:600">Standing</th>' +
    '</tr>' + rows + '</table>';
}

/**
 * The opening line, chosen from what is actually true of this client.
 * The research on lapse behaviour is consistent on one point: a loss reads about
 * twice as strongly as the equivalent gain, so what is stated first should be
 * what they stand to lose — in figures, not adjectives.
 */
function pdStakeOpening_(p, family) {
  var r = pdRelationship_(p, family);
  var cover = r.cover > 0 ? pdMoney_(r.cover) : null;

  if (r.payingOthers > 0) {
    return '<p>You hold <b>' + (r.others + 1) + ' policies</b> with us and you are paying ' +
      (r.payingOthers === 1 ? 'another one' : r.payingOthers + ' of them') + ' without any difficulty. ' +
      'That is usually the sign that this is a <b>banking problem rather than a money problem</b> — a mandate ' +
      'that stopped, a card that expired, a deduction that was never set up. It is normally a five-minute fix, ' +
      'and it is worth making because ' + (cover ? '<b>' + cover + '</b> of cover' : 'your cover') +
      ' is sitting behind these policies.</p>';
  }
  if (r.lapsedBefore > 0) {
    return '<p>Our records show ' + (r.lapsedBefore === 1 ? 'a policy of yours has' : r.lapsedBefore + ' of your policies have') +
      ' already lapsed. We do not raise that to embarrass anybody — we raise it because ' +
      'it means you have been here before, and the policy in this letter is heading the same way. ' +
      (cover ? 'You still hold <b>' + cover + '</b> of cover with us. ' : '') +
      'This is the point where that can still be stopped.</p>';
  }
  if (r.others > 0) {
    return '<p>You hold <b>' + (r.others + 1) + ' policies</b> with us, together worth ' +
      (cover ? '<b>' + cover + '</b> of cover' : 'a substantial benefit') +
      ' to the people who depend on you. One of them is behind, and if nothing changes that part of the ' +
      'protection ends — the rest continues, but the gap is permanent.</p>';
  }
  return '<p>' + (cover
    ? 'This policy pays <b>' + cover + '</b> to the people who depend on you. '
    : 'This policy protects the people who depend on you. ') +
    'It was underwritten on your health as it was when you applied, not as it is today, which is the part ' +
    'most people do not weigh until it is gone.</p>';
}

/** Named signatories, so the client knows exactly who is accountable. */
function pdSignature_(p) {
  var mgr = pdManagerOf_(p.Agent);
  return '<table cellpadding="0" cellspacing="0" style="width:100%;margin:22px 0 0;font-size:13px">' +
    '<tr><td style="padding:14px 0 0;border-top:1px solid #E8E3D8;color:' + PD_BRAND.ink + '">' +
      'Yours sincerely,<br><br>' +
      '<b>' + pdEsc_(p.Agent || OUT.BRANCH_NAME) + '</b><br>' +
      '<span style="color:#5A6B7B">Financial Advisor' + (mgr ? ' &middot; reporting to ' + pdEsc_(mgr) : '') + '</span><br>' +
      '<b>' + pdEsc_(OUT.BRANCH_NAME) + '</b><br>' +
      '<span style="color:#5A6B7B">' + pdEsc_(OUT.BRANCH_PHONE) + ' &middot; ' + pdEsc_(OUT.BRANCH_EMAIL) + '</span>' +
    '</td></tr></table>';
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

  /* ---- day 45: ask the questions, and remind them what they own ---- */
  s45: function (p, state) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p);
    var d = Number(p.DaysArrears) || 0;
    var family = pdFamily_(p, state && state.family);
    return {
      subject: 'Policy No. ' + p.Policy + ' — premium outstanding ' + d + ' days',
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>The premium on the above policy has been outstanding for <b>' + d + ' days</b>. ' +
        'Your cover remains in force, and we are writing now specifically so that it stays that way.</p>' +
        pdStakeOpening_(p, family) +

        pdSection_(1, 'Please answer here — it takes one tap',
          '<p>We would rather understand your situation than assume it, and there are more options ' +
          'available than most policyholders realise. Every one of them needs us to know which problem ' +
          'we are solving.</p>' +
          pdQuestionBlock_(p, CLIENT_QUESTIONS, 'respond')) +

        pdSection_(2, (family.length > 1 ? 'Everything you hold with us' : 'Your policy as it stands'),
          (family.length > 1
            ? '<p>So that you can see the whole picture, not one line of it:</p>' + pdPolicyTable_(p, family) +
              '<p style="font-size:13px;color:#5A6B7B">The highlighted row is the policy this letter is about.</p>'
            : pdFacts_(p))) +

        pdSection_(3, 'Why this one matters',
          '<p>This policy was underwritten on your health <b>as it was when you applied</b>. That is the part most ' +
          'people do not weigh until it is gone: if it lapses and you later reapply, you are underwritten on your ' +
          'health as it is then. Where anything has changed in between, the same cover may cost considerably more, ' +
          'or may not be available at all.</p>' +
          '<p>Nothing you have paid into it transfers anywhere. It simply stops working.</p>') +

        pdSection_(4, 'If we do not hear from you',
          pdNote_('Cover ends <b>' + left + ' days</b> from today if the premium remains outstanding. From that date a ' +
                  'claim is not payable. We will write again at day 60 setting out the full position, and your agent&rsquo;s ' +
                  'manager will be copied at that stage.')) +

        '<p style="margin-top:18px">If you would prefer to talk it through, reply to this email or call ' +
        pdEsc_(OUT.BRANCH_PHONE) + '.</p>' +
        pdSignature_(p),
        '45-day review'),
      whatsapp: 'Good day ' + first + ', this is ' + OUT.BRANCH_NAME + ' regarding policy ' + p.Policy +
        '. The premium is ' + d + ' days outstanding and cover would end in about ' + left + ' days. ' +
        (family.length > 1 ? 'You hold ' + family.length + ' policies with us, so I want to make sure this one does not slip. ' : '') +
        'Just reply with whichever fits and I will take it from there: paying now / already paid / need a payment plan / ' +
        'my bank details changed / premium is too much / please call me.'
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

  /* ---- day 60: the formal position. Quotes the 45-day exchange back, sets out
         the timeline with dates, and puts the whole chain on the record. ---- */
  s60: function (p, state) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p), d = Number(p.DaysArrears) || 0;
    var mgr = pdManagerOf_(p.Agent);
    var answered = !!(state && state.survey);
    var family = pdFamily_(p, state && state.family);
    return {
      subject: 'Policy No. ' + p.Policy + ' — 60 days outstanding, ' + left + ' days to lapse',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding — 60 Days') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>We are writing formally regarding the premium on the above policy, which is now <b>' + d +
        ' days</b> outstanding. This letter is copied to your agent, to their manager and to the branch manager, ' +
        'so that everyone who can act on your behalf is working from the same information.</p>' +
        pdStakeOpening_(p, family) +

        pdSection_(1, 'What we need from you',
          '<p>' + (answered
            ? 'You wrote to us before and we acted on it. If your circumstances have changed since, this is the point to say so.'
            : 'Answer one question or all of them — each one on its own tells us how to help.') +
          '</p>' + pdQuestionBlock_(p, CLIENT_QUESTIONS, 'respond')) +

        pdSection_(2, 'What we have sent, and what you told us', pdTrail_(p, state)) +

        pdSection_(3, (family.length > 1 ? 'Everything you hold with us' : 'Your policy as it stands'),
          (family.length > 1
            ? pdPolicyTable_(p, family) +
              '<p style="font-size:13px;color:#5A6B7B">The highlighted row is the policy this letter is about. ' +
              'The others are shown so that you can see what the relationship looks like as a whole.</p>'
            : pdFacts_(p))) +

        pdSection_(4, 'What happens from here', pdTimeline_(p)) +

        pdSection_(5, 'Who is handling this',
          '<p style="font-size:13.5px">Your agent <b>' + pdEsc_(p.Agent) + '</b>' +
          (mgr ? ' and their manager <b>' + pdEsc_(mgr) + '</b>' : '') +
          ' are both accountable for this policy, and the branch manager is copied. Whichever option you select is ' +
          'recorded against the policy immediately and assigned to them. You do not need to chase anybody.</p>' +
          '<p style="font-size:13.5px">If you would rather speak to someone directly, call <b>' +
          pdEsc_(OUT.BRANCH_PHONE) + '</b> and quote policy number ' + pdEsc_(p.Policy) + '.</p>') +

        pdSignature_(p),
        '60-day retention'),
      whatsapp: 'Good day ' + first + ', ' + OUT.BRANCH_NAME + ' regarding policy ' + p.Policy + '. ' +
        (answered
          ? 'Thank you for replying to us earlier — we held the policy on that basis, but the premium is still outstanding. '
          : 'We wrote at day 45 and have not had a reply. ') +
        'It is now ' + d + ' days outstanding and cover ends in ' + left + ' days. ' +
        'A formal letter is with you setting out the timeline and your options, copied to your agent, their manager and the branch manager. ' +
        'Please open it and select an option, or call ' + OUT.BRANCH_PHONE + '.'
    };
  },

  /* ---- every 5 days after 60, while the client has said nothing ---- */
  chase: function (p, state) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p), d = Number(p.DaysArrears) || 0;
    var mgr = pdManagerOf_(p.Agent);
    return {
      subject: 'Policy No. ' + p.Policy + ' — reminder, ' + left + ' days to lapse',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding — Reminder') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>We wrote to you at day 60 setting out the position on this policy and have not yet had your instruction. ' +
        'The premium is now <b>' + d + ' days</b> outstanding and cover ends in <b>' + left + ' days</b>.</p>' +

        pdSection_(1, 'The remaining timeline', pdTimeline_(p)) +

        pdSection_(2, 'Please select an option',
          '<p>Any one of these keeps the matter open and puts it in front of someone who can act. ' +
          'Selecting the last one is a decision we will respect — but we would rather record it properly than ' +
          'let the policy lapse by silence.</p>' + pdChoiceBlock_(p)) +

        (mgr ? pdNote_('<b>' + pdEsc_(mgr) + '</b> has been asked to contact you directly in addition to this letter.') : '') +

        '<p style="margin-top:18px">Call <b>' + pdEsc_(OUT.BRANCH_PHONE) + '</b> at any time and quote policy number ' +
        pdEsc_(p.Policy) + '.</p>' +
        pdSignature_(p),
        'Reminder'),
      whatsapp: 'Good day ' + first + ', ' + OUT.BRANCH_NAME + ' following up on policy ' + p.Policy + '. It is ' + d +
        ' days outstanding with ' + left + ' days before cover ends. ' +
        (mgr ? mgr + ' has also been asked to contact you. ' : '') +
        'Even a one-line reply — including that you want to stop it — lets us act properly rather than let it lapse.'
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

/**
 * The one call the engine UI and the daily run both use.
 * state carries what we already know about the case — the 45-day survey answers
 * in particular, so the 60-day letter can quote them back rather than pretend
 * the earlier exchange never happened.
 */
function pdRender(stageKey, policy, state) {
  var fn = PD_TEMPLATES[stageKey];
  return fn ? fn(policy, state) : null;
}

/* ==================== internal: escalate to the manager ==================== */
/* The engine's retention form says "Sends to <manager>" but only ever wrote a
   row. This is the send. Call it from doPost when type === 'retention'. */

/* What the client has already told us, for the manager's email. This is the
   detail the old process lost: the manager was asked to act without being shown
   the client's own words, then blamed for a thin decision. */
function pdClientSaidBlock_(state) {
  var s = state && state.survey, r = state && state.replies;
  if (!s && (!r || !r.length)) {
    return pdNote_('<b>The client has not answered anything yet.</b> You are the escalation — a call from ' +
      'a manager lands differently from a fourth email from the branch.');
  }
  var rows = '';
  if (s) {
    rows += pdKv_('Reason given', pdEsc_(s.surveyReason || '—')) +
            pdKv_('Position on keeping it', pdEsc_(s.surveyContact || '—'));
    if (s.surveyPromise) rows += pdKv_('In their words', pdEsc_(s.surveyPromise));
  }
  if (r && r.length) {
    for (var i = 0; i < r.length; i++) rows += pdKv_(pdEsc_(r[i].q || 'Answered'), pdEsc_(r[i].lab || ''));
  }
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    rows + '</table>';
}

function pdKv_(k, v) {
  return '<tr>' +
    '<td style="padding:6px 12px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B">' + k + '</td>' +
    '<td style="padding:6px 12px;background:#FFFFFF;border:1px solid #E8E3D8;color:' + PD_BRAND.ink + '">' + v + '</td>' +
    '</tr>';
}

function pdEscalateRetention_(d) {
  // the full manager letter, sent the moment a case is filed
  var mgrEmail = pdStaffEmail_(pdManagerOf_(d.agent));
  if (mgrEmail && !OUT.DRY_RUN) {
    try {
      var p = { Policy: d.policy, Client: d.client, ClientNo: d.clientNo, Agent: d.agent,
                Premium: 0, DaysArrears: 60, LapseDate: '', Email: '', Phone: '' };
      var letter = pdManagerLetter_(p, { retentionBody: d.body, factFind: d.factFind }, {});
      MailApp.sendEmail({ to: mgrEmail, name: OUT.FROM_NAME, subject: letter.subject, htmlBody: letter.html });
    } catch (e) { /* never let a mail failure lose the record */ }
  }
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

/* ===================== the manager's email =====================
   Sent when a retention case lands, and again on the 3-day chase. The manager
   answers by tapping, exactly as the client does — because Approval Status came
   back blank on 78 of 106 submissions when the only way to answer was to open a
   form and type. */

function pdManagerLetter_(p, state, opts) {
  opts = opts || {};
  var mgr = pdManagerOf_(p.Agent), d = Number(p.DaysArrears) || 0;
  var waiting = opts.waiting || 0;
  var chasing = !!opts.chasing;

  return {
    subject: (chasing ? 'REMINDER ' + waiting + ' days — ' : '') +
      'Your response is required — ' + p.Client + ' (Policy ' + p.Policy + ')',
    html: pdWrap_(
      pdRefBlock_(p, 'Retention Case — Manager Response Required') +
      '<p>' + (mgr ? 'Dear ' + pdEsc_(mgr) : 'Dear Manager') + ',</p>' +

      (chasing
        ? pdNote_('<b>This is reminder ' + Math.max(1, Math.ceil(waiting / SLA.MANAGER_CHASE_EVERY)) +
            '.</b> <b>' + pdEsc_(p.Agent) + '</b> filed this case <b>' + waiting +
            ' days ago</b> and is still waiting on you. Until you answer, they cannot offer the client anything — ' +
            'the case is with you, not with them.', PD_BRAND.red)
        : '<p><b>' + pdEsc_(p.Agent) + '</b> has filed a retention case on this policy and needs your decision. ' +
          'The policy lapses in <b>' + pdDaysToLapse_(p) + ' days</b>.</p>') +

      pdSection_(1, 'Your response — tap your answers',
        '<p>Each one records against the policy immediately and your agent sees it at once. ' +
        'The detail behind the case is below if you want it, but you do not need to read it first.</p>' +
        pdQuestionBlock_(p, MANAGER_QUESTIONS, 'mgr')) +

      pdSection_(2, 'The policy', pdFacts_(p)) +

      pdSection_(3, 'What the client has told us', pdClientSaidBlock_(state)) +

      pdSection_(4, 'What your agent has said',
        (state && state.retentionBody
          ? '<p style="font-style:italic;padding:12px 15px;background:#F3F0E9;border-left:3px solid ' +
            PD_BRAND.teal + ';color:' + PD_BRAND.ink + '">' + pdEsc_(state.retentionBody) + '</p>' +
            (state.factFind ? '<p style="font-size:13px">Fact find: ' + pdEsc_(state.factFind) + '</p>'
                            : '<p style="font-size:13px;color:' + PD_BRAND.red + '">No fact find was attached.</p>')
          : '<p style="color:#5A6B7B">No detail recorded.</p>')) +

      pdSection_(5, 'You are also asked to contact the client',
        '<p>The 60-day letter told <b>' + pdEsc_(p.Client) + '</b> that their agent&rsquo;s manager would be in touch. ' +
        'Across the branch, roughly a third of clients in arrears report that nobody contacted them at all — ' +
        'a call from you is frequently the thing that changes the outcome.</p>' +
        (p.Phone ? '<p style="font-size:14px"><b>' + pdEsc_(p.Phone) + '</b>' +
                   (pdValidEmail_(p.Email) ? ' &middot; ' + pdEsc_(p.Email) : '') + '</p>' : '')) +

      pdSignature_(p),
      'Manager response required'),
    cc: chasing && waiting >= SLA.MANAGER_REPLY_DAYS + SLA.MANAGER_CHASE_EVERY
        ? [pdValidEmail_(OUT.BRANCH_MANAGER_EMAIL)].filter(Boolean) : []
  };
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
    var s = map[policy] || (map[policy] = { responded: false, retentionTs: 0, verdict: false, chases: {}, survey: null, trail: [] });
    if (type === 'survey') {
      s.survey = { ts: ts, surveyReason: v[i][15], surveyContact: v[i][16], surveyPromise: v[i][17] };
    }
    if (type === 'response') {
      s.responded = true;
      (s.replies = s.replies || []).push({ ts: ts, q: v[i][11], lab: v[i][12] });
    }
    else if (type === 'retention') {
      s.retentionTs = Math.max(s.retentionTs, ts);
      s.retentionBody = v[i][12]; s.factFind = v[i][18];
    }
    else if (type === 'verdict') s.verdict = true;
    else if (type.indexOf('outbound') === 0) {
      var stg = String(v[i][11] || '');
      if (TRAIL_LABEL[stg]) (s.trail = s.trail || []).push({ ts: ts, mine: false, what: TRAIL_LABEL[stg] });
    }
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

  var letter = pdManagerLetter_(p, s, { chasing: true, waiting: waiting });
  MailApp.sendEmail({
    to: mTo, cc: cc.concat(letter.cc).filter(Boolean).join(','), name: OUT.FROM_NAME,
    subject: letter.subject, htmlBody: letter.html
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
  var byClient = {};
  for (var b = 0; b < payload.policies.length; b++) {
    var bp = payload.policies[b];
    (byClient[String(bp.ClientNo)] = byClient[String(bp.ClientNo)] || []).push(bp);
  }
  var count = 0, skippedNoEmail = 0, planned = 0, internal = 0;

  for (var i = 0; i < payload.policies.length; i++) {
    if (count >= OUT.MAX_SENDS_PER_RUN) break;
    var p = payload.policies[i];
    var s = states[String(p.Policy)] || { responded: false, retentionTs: 0, verdict: false, chases: {}, survey: null, trail: [] };

    internal += pdInternalChase_(p, s);          // agent / manager accountability

    var stageKey = pdStageDue_(p, s);
    if (!stageKey) continue;
    // chases repeat by design; everything else sends once per policy per stage
    if (stageKey !== 'chase' && sent[String(p.Policy) + '|' + stageKey]) continue;
    if (stageKey === 'chase' && sent[String(p.Policy) + '|chase|' + (Number(p.DaysArrears) || 0)]) continue;
    if ((Number(p.Premium) || 0) < OUT.MIN_PREMIUM) continue;

    s.family = byClient[String(p.ClientNo)] || [p];        // the whole relationship, not one line of it
    var tpl = pdRender(stageKey, p, s);
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
  var demoState = { survey: { ts: Date.now() - 15 * 86400000, surveyReason: 'Financial difficulty',
    surveyContact: 'Wants to keep', surveyPromise: 'I can resume payments from September salary' } };
  ['od', 's45', 's45r', 's60', 'chase', 's88', 'winback', 'pend', 'thanks'].forEach(function (k) {
    var t = pdRender(k, demo, demoState);
    Logger.log('--- %s ---\nSUBJECT: %s\nWHATSAPP: %s\n', k, t.subject, t.whatsapp);
  });
}
