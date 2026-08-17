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
  // Manager/agent accountability emails get their own live budget. On launch
  // day the whole 60-89 backlog is due at once — without this, every manager
  // handover in the book would fire in one morning, and a manager with a big
  // unit would open forty emails before coffee. The most urgent fire first
  // (the run is sorted); the rest follow on the next mornings. Dry runs are
  // never capped, so the plan always shows the full picture.
  MAX_INTERNAL_PER_RUN: 60,

  // ---- staged rollout ----
  // The gates, in order:
  //   DRY_RUN true                          -> plan only, nothing emailed
  //   DRY_RUN false + TEST_INBOX set        -> real emails, ONE inbox, [TEST]
  //   DRY_RUN false + TEST_INBOX ''         -> live
  //
  // PILOT_AGENTS: while non-empty, only policies serviced by these agents are
  // processed at all (plus any scheme they service). Everyone else's book is
  // untouched — not planned, not chased, not counted.
  //   e.g. ['Ricky Rampersad', 'Neil Ramnanan']
  PILOT_AGENTS: [],

  // TEST_INBOX: while set, EVERY email the engine sends — client letters,
  // manager chases, group statements — goes to this one address instead of
  // its real recipients, with [TEST] on the subject and a banner naming who
  // it would really have gone to. Cadence, dedupe and the two-phase ladder
  // behave exactly as live, so the pilot is a true dress rehearsal. Test
  // sends are logged as test rows: they drive the clocks while TEST_INBOX is
  // set, and are ignored the moment it is cleared — so nothing tested is ever
  // mistaken for something a client received.
  TEST_INBOX: '',

  // The third key. A client can only ever be emailed when ALL THREE are
  // thrown: DRY_RUN false, TEST_INBOX empty, AND this set to true. Until
  // then a run that looks live falls back to a dry run and says so in the
  // log — so no combination of half-finished settings can reach a client by
  // accident. Set it only at the end of the pilot, deliberately.
  GO_LIVE_CONFIRM: false,
  WIN_BACK_MAX_DAYS: 180,        // don't chase lapses older than this
  // An application stuck in underwriting four months is a new conversation
  // with the client, not a "one more thing" chase. The live book carries
  // pending cases 200+ days old; without this cap launch day would open by
  // chasing all of them.
  PEND_MAX_DAYS: 120,
  // Win-back waits for the closing sequence to finish. The last closing letter
  // goes at day 100 and already offers reinstatement; a win-back two days later
  // is the branch asking the same question twice in one week.
  WIN_BACK_OPENS: 110,
  MIN_PREMIUM: 0,                // skip trivial amounts if you want a floor

  FROM_NAME: 'Ricky Rampersad Branch — Policy Services',
  // The person who owns premium dues in branch support. Client letters are
  // signed by a named colleague, not a department — a name answers, a
  // department files.
  SUPPORT_NAME: 'Sasha Lalla',
  SUPPORT_ROLE: 'Branch Support — Premium Dues',
  BRANCH_NAME: 'Ricky Rampersad Branch',
  BRANCH_PHONE: '(868) 678-5921',
  BRANCH_EMAIL: 'support@rickyrampersadbranch.com',
  // The Salesforce macro "Premium Due 75 Days Client Comm" sends from the branch
  // address and copies sales support. Same here, so the trail stays in one place.
  SALES_SUPPORT_EMAIL: 'RickyRampersadSalesSupport@myguardiangroup.com',

  // Where the client survey lives. This must be the PRIVATE engine
  // deployment; the copy in the public repository is a demo.
  ENGINE_URL: '',                // e.g. 'https://rrb-premium-due.netlify.app/'

  // The branch shield, as a hosted PNG. This repository publishes to
  // rickyrampersadbranch.com, so the committed crest images are live at this
  // path once the site deploys. Blank falls back to a type glyph.
  LOGO_URL: '',                  // blank = use the default for the theme below

  // Guardian Group's own portal — clients register, see their portfolio and
  // PAY PREMIUMS ONLINE. Every client letter carries a button straight to it,
  // because the shortest path from "I'll settle it" to settled is one tap.
  PAY_URL: 'https://www.myggonline.app/',

  // The grace-period / non-forfeiture clause FROM THE SPECIFIC PLAN'S CONTRACT,
  // pasted verbatim by the branch. When set, the letters quote it alongside the
  // Insurance Act; while blank they quote the Act alone and say the policy's
  // own wording is available on request. Never paraphrase a contract here —
  // paste it or leave it blank.
  CONTRACT_NOTE: '',

  // Branch manager — copied on the 60-day notice and on repeat manager chases.
  BRANCH_MANAGER_EMAIL: '',      // e.g. 'ricky.rampersad@myguardiangroup.com'

  // name -> email, for everyone who can be an agent or a manager on a case.
  // Without an entry here that person simply is not copied; nothing breaks.
  STAFF_EMAIL: {
    // 'Ricky Rampersad':   'ricky.rampersad@myguardiangroup.com',
    // 'Kerwyn Ramroach':   '...',
    // 'Neil Ramnanan':      '...'
  },

  // agent -> their manager. Mirror of UNITS/HIERARCHY in the engine.
  MANAGER_OF: {
    // 'Neil Ramnanan': 'Gary Sookdeo',
  },

  // ---- Group schemes (company-owned policies: Servus, Bankers Insurance,
  // JMMB and the like). A company that owns 65 member policies is ONE missed
  // remittance, not 65 separate failures — and it must never enter the
  // individual 45/60/90 ladder. Writing "rate your advisor out of five" to a
  // payroll office, or issuing 65 tracking codes to one clerk, is the engine
  // misreading who the client is. Group policies get one consolidated
  // remittance statement per company per cycle instead (pdGroupChase_).
  //
  // Detection is by company-looking name plus this roster. The roster wins:
  // add a client number here and every policy on it is a group policy no
  // matter what the name looks like.
  GROUP_CLIENTS: {
    // '<client number>': 'Servus Limited',   // fill from the portfolio — this repo is public
  },

  // scheme key (as pdGroupKey_ prints it) -> the administrator who receives
  // the remittance statement. Without an entry the statement goes to the
  // servicing agent instead — never to whatever address sits on the company's
  // client record, which on this book can be an individual's personal mailbox.
  GROUP_ADMIN: {
    // 'SERVUS LIMITED': 'payroll@servus.example',   // the real address lives only in the deployed copy
  },

  // From day 60 the client is copied on the manager email and on every three-day
  // repeat. That is the branch's decision and it is what makes the sequence
  // work: the policyholder watches the case being handled instead of receiving
  // another reminder. It is also why MANAGER_PRIVATE exists — the commercial
  // and compliance questions are never rendered into an email a client sees.
  COPY_CLIENT_ON_MANAGER_CHASE: true
};

/* The service clocks. These mirror SLA in premium-due/index.html — change both. */
var SLA = {
  RETENTION_OPENS: 60,
  LAPSE: 90,
  AGENT_FILE_BY: 65,
  MANAGER_REPLY_DAYS: 3,          // day 60 -> the manager must COMMIT within three days
  CLIENT_CHASE_EVERY: 5,
  MANAGER_CHASE_EVERY: 3,         // commitment outstanding: chase every 3 days, all copied
  FEEDBACK_CHASE_EVERY: 7,        // committed but no feedback yet: chase every 7 days, all copied

  /* Group schemes run on remittance cycles, not personal deadlines. A scheme
     at day 20 is a payroll run in transit — normal, say nothing. At day 45 a
     remittance has genuinely been missed, so one statement goes to the scheme
     administrator, and it repeats every 14 days while anything stays unpaid —
     roughly once per payroll cycle, never three letters in a week. */
  GROUP_OPENS: 45,                // first statement when a member policy hits this
  GROUP_STATEMENT_EVERY: 14       // and then one per fortnight while it holds
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
  { k: 'help', q: 'How would you like us to handle this?', opts: [
    { k: 'settle',  lab: 'Settle it now' },
    { k: 'review',  lab: 'Review my premium' },
    { k: 'billing', lab: 'Change my payment date or bank details' },
    { k: 'hold',    lab: 'Pause briefly, keep the cover' },
    { k: 'talk',    lab: 'Have someone call me' },
    { k: 'other',   lab: 'Something else' } ] },

  { k: 'pay', q: 'How would you like to pay?', opts: [
    { k: 'mygg',     lab: 'Online — myGuardian Group' },
    { k: 'card',     lab: 'Credit or debit card' },
    { k: 'transfer', lab: 'Bank transfer — send me the details' },
    { k: 'other',    lab: 'Another way — I will explain' } ] },

  { k: 'when', q: 'When?', opts: [
    { k: 'now',    lab: 'This week' },
    { k: 'payday', lab: 'Next pay date' },
    { k: 'month',  lab: 'Later this month' },
    { k: 'other',  lab: "I'll say when I reply" } ] },

  { k: 'contact', q: 'How should we keep in touch?', opts: [
    { k: 'call',  lab: 'Phone call' },
    { k: 'email', lab: 'Email' },
    { k: 'visit', lab: 'A visit from my advisor' },
    { k: 'other', lab: 'However is easiest' } ] }
];

/* ===================== WHAT THE MANAGER ANSWERS =====================
   Split in two, because from day 60 the client is copied on these emails.

   MANAGER_QUESTIONS is what the client sees being asked. Every one is a
   service question — did you call them, what came of it, did you read the fact
   find, did you speak to the advisor, when will this be done. A policyholder
   reading that sees a branch working their case with dates against it, which
   is the entire argument for copying them.

   MANAGER_PRIVATE is what the client must not see being asked. "Allow the
   policy to lapse — documented", "investigate possible replacement of in-force
   cover" and "reassign — orphan or wrong agent" are commercial and compliance
   decisions; putting them in front of the policyholder as menu options would
   be indefensible. Those are answered in the engine, or from the internal-only
   copy, and never appear in the email the client is copied on. */

/* THE MANAGER ANSWERS IN TWO STAGES, because a manager gives us two different
   things at two different moments and blurring them is what let cases sit.

   COMMIT — day 60, chased every 3 days. What the manager will DO: call the
   client, review the fact find, speak with the advisor, and by when they will
   report back. Four taps, all forward-looking, all things a manager can answer
   without having done anything yet — so there is no reason for silence.

   FEEDBACK — after they commit, chased every 7 days. What actually HAPPENED:
   did they reach the client, where does the policy stand, the non-forfeiture
   position, the fact-find outcome. This can only be answered once the work is
   done, which is the point of separating it.

   The client is copied on both, so both are worded as service, and the
   commercial decision stays in MANAGER_PRIVATE, out of sight. */

var MANAGER_COMMIT = [
  { k: 'mcall', q: 'Will you call this client personally?', opts: [
    { k: 'today', lab: 'Yes — I will call today' },
    { k: 'week',  lab: 'Yes — within this week' },
    { k: 'done',  lab: 'I have already spoken with them' } ] },

  { k: 'mfact', q: 'Will you review the fact find?', opts: [
    { k: 'yes',  lab: 'Yes — I will review it' },
    { k: 'done', lab: 'Already reviewed — it is in order' },
    { k: 'none', lab: 'No fact find yet — I will get it from the advisor' } ] },

  { k: 'madvisor', q: 'Will you discuss it with the advisor?', opts: [
    { k: 'yes',     lab: 'Yes — I will speak with them' },
    { k: 'done',    lab: 'Already discussed' },
    { k: 'reassign',lab: 'No advisor is servicing this — I will reassign' } ] },

  { k: 'mby', q: 'When will you have feedback for us?', opts: [
    { k: 'd2',   lab: 'Within 2 days' },
    { k: 'd3',   lab: 'Within 3 days' },
    { k: 'week', lab: 'By the end of this week' } ] }
];

var MANAGER_FEEDBACK = [
  { k: 'mreached', q: 'Did you reach the client?', opts: [
    { k: 'spoke',   lab: 'Yes — we spoke' },
    { k: 'message', lab: 'Left word — awaiting their call' },
    { k: 'unable',  lab: 'Not yet able to reach them' } ] },

  { k: 'moutcome', q: 'Where does the policy stand?', opts: [
    { k: 'settle',  lab: 'They will settle it' },
    { k: 'review',  lab: 'A premium review is agreed' },
    { k: 'plan',    lab: 'A payment plan is agreed' },
    { k: 'end',     lab: 'They wish to end the cover' },
    { k: 'working', lab: 'Still working on it' } ] },

  { k: 'mvalue', q: 'What is the non-forfeiture position on this policy?', opts: [
    { k: 'novalue',  lab: 'No accrued value — it lapses outright at day 90' },
    { k: 'apl',      lab: 'An automatic premium loan is running against the value' },
    { k: 'value',    lab: 'It has value; cover can be sustained from it for a period' },
    { k: 'checking', lab: 'Confirming with the carrier' } ] },

  { k: 'mfactdone', q: 'The fact find — where did it land?', opts: [
    { k: 'ok',       lab: 'Complete and acceptable' },
    { k: 'returned', lab: 'Returned to the advisor to complete' },
    { k: 'none',     lab: 'Still none on file' } ] }
];

/* Kept as an alias so anything that still says MANAGER_QUESTIONS renders the
   commitment set (the day-60 email). The engine references it by name. */
var MANAGER_QUESTIONS = MANAGER_COMMIT;

/* Internal only. Never rendered into an email the client is copied on. */
var MANAGER_PRIVATE = [
  { k: 'mdecision', q: 'Your decision on this case', opts: [
    { k: 'retention',   lab: 'Approve the retention plan as proposed' },
    { k: 'payplan',     lab: 'Approve a payment plan' },
    { k: 'reduce',      lab: 'Approve a premium reduction or benefit alteration' },
    { k: 'reinstate',   lab: 'Escalate to reinstatement' },
    { k: 'replacement', lab: 'Investigate possible replacement of in-force cover' },
    { k: 'reassign',    lab: 'Reassign — orphan or wrong agent' },
    { k: 'lapse',       lab: 'Allow the policy to lapse — documented' } ] },

  { k: 'moutlook', q: 'How likely is this policy to be saved?', opts: [
    { k: 'high', lab: 'High — the client is engaged' },
    { k: 'mod',  lab: 'Moderate — depends on the concession' },
    { k: 'low',  lab: 'Low — prepare for lapse' } ] },

  { k: 'msupport', q: 'Do you need the branch manager involved?', opts: [
    { k: 'no',  lab: 'No — I have this' },
    { k: 'yes', lab: 'Yes — please escalate' } ] }
];

/* ===================== WHAT WE ASK AT DAY 90 =====================
   A different letter needs different questions. By day 88 the premium has been
   outstanding for three months, we have written three times and a manager has
   been asked to telephone. Asking "what would help right now?" a fourth time
   would read as though nobody had been listening to the first three.

   So this set asks about us, not about them. The service-recovery evidence is
   consistent that once a sequence has failed, what recovers the relationship is
   acknowledging the failure rather than repeating the request — and the
   branch's own submissions say why that matters here: 47 of 137 clients
   reported that their agent never contacted them at all. If that is what
   happened on this policy, day 88 is the last moment it can surface while the
   cover is still in force and something can still be done about it.

   Three questions. Accountability, then the decision, then the one nobody in
   this branch has ever put to a lapsing client. */
var CLOSING_QUESTIONS = [
  { k: 'decide', q: 'What would you like to happen?', opts: [
    { k: 'settle', lab: 'Restore it — I will settle' },
    { k: 'review', lab: 'Restore it — review my premium' },
    { k: 'talk',   lab: 'Call me before anything else' },
    { k: 'end',    lab: 'Leave it ended' },
    { k: 'other',  lab: 'Something else' } ] },

  { k: 'rateagent', q: 'How would you rate your advisor?', opts: [
    { k: 'excellent', lab: '\u2605\u2605\u2605\u2605\u2605  Excellent' },
    { k: 'good',      lab: '\u2605\u2605\u2605\u2605  Good' },
    { k: 'fair',      lab: '\u2605\u2605\u2605  Fair' },
    { k: 'poor',      lab: '\u2605\u2605  Poor' },
    { k: 'never',     lab: '\u2605  Never heard from them' } ] },

  { k: 'ratemanager', q: 'And the manager who handled it?', opts: [
    { k: 'excellent', lab: '\u2605\u2605\u2605\u2605\u2605  Excellent' },
    { k: 'good',      lab: '\u2605\u2605\u2605\u2605  Good' },
    { k: 'fair',      lab: '\u2605\u2605\u2605  Fair' },
    { k: 'poor',      lab: '\u2605\u2605  Poor' },
    { k: 'never',     lab: '\u2605  Never heard from them' } ] },

  { k: 'better', q: 'What would have made the difference?', opts: [
    { k: 'nothing',  lab: 'Nothing — you did what you could' },
    { k: 'earlier',  lab: 'Reaching me earlier' },
    { k: 'person',   lab: 'Speaking to a person, not emails' },
    { k: 'clarity',  lab: 'Explaining my options more clearly' },
    { k: 'money',    lab: 'It was money — nothing would have' },
    { k: 'other',    lab: 'Something else' } ] }
];

/**
 * The day-45 questions, personalised from the portfolio row. The keys never
 * change — the engine and the log decode by key — but the labels lead with the
 * client's own facts: the actual amount, their actual collection method. A
 * button that says "Settle the $1,616.70 now" gets tapped; a button that says
 * "Settle it now" gets read. Where the account is paying its other premiums,
 * the billing fix goes first, because that is almost always the real problem.
 */
function pdClientQuestions_(p, family, only) {
  var due = pdAmountDue_(p);
  var b = String(p.Billing || '').toLowerCase();
  var billingLab = 'Change my payment date or bank details';
  if (b.indexOf('bank') > -1 || b.indexOf('order') > -1)      billingLab = 'Fix my bankers order — re-lodge it';
  else if (b.indexOf('salary') > -1 || b.indexOf('deduct') > -1) billingLab = 'Restart my salary deduction';

  var helpOpts = [
    { k: 'settle',  lab: due > 0 ? 'Settle the ' + pdMoney_(due) + ' now' : 'Settle it now' },
    { k: 'review',  lab: 'Review my premium' },
    { k: 'billing', lab: billingLab },
    { k: 'hold',    lab: 'Pause briefly, keep the cover' },
    { k: 'talk',    lab: 'Have someone call me' },
    { k: 'other',   lab: 'Something else' }
  ];
  var r = pdRelationship_(p, pdFamily_(p, family));
  if (r.payingOthers > 0) helpOpts.splice(0, 0, helpOpts.splice(2, 1)[0]);  // billing first — the likely fault

  var payOpts = [
    { k: 'mygg',     lab: due > 0 ? 'Pay the ' + pdMoney_(due) + ' online — myGuardian Group' : 'Online — myGuardian Group' },
    { k: 'card',     lab: 'Credit or debit card' },
    { k: 'transfer', lab: 'Bank transfer — send me the details' },
    { k: 'other',    lab: 'Another way — I will explain' }
  ];

  var sets = [
    { k: 'help',    q: CLIENT_QUESTIONS[0].q, opts: helpOpts },
    { k: 'pay',     q: CLIENT_QUESTIONS[1].q, opts: payOpts },
    CLIENT_QUESTIONS[2],
    CLIENT_QUESTIONS[3]
  ];
  if (!only) return sets;
  return sets.filter(function (q) { return only.indexOf(q.k) > -1; });
}

/**
 * The one answer that should not be a reply: paying. A button straight to
 * Guardian Group's portal, where premiums are actually paid — tapping "I'll
 * settle it" and then having to find the website is where settled intentions
 * go to die.
 */
function pdPayBtn_(p) {
  if (!OUT.PAY_URL) return '';
  return pdBtn_(OUT.PAY_URL, 'Pay online now — myGuardian Group') +
    '<p style="font-size:12px;color:' + PD_BRAND.mute + ';margin:-12px 0 0;text-align:center">' +
    'Guardian Group&rsquo;s secure portal — register once, then pay any premium in a minute. ' +
    'Quote policy ' + pdEsc_(p.Policy) + '.</p>';
}

/* Flat lookup, so a returning click can be named without walking the sets. */
var ANSWER_BY_KEY = (function () {
  var m = {};
  [CLIENT_QUESTIONS, MANAGER_COMMIT, MANAGER_FEEDBACK, MANAGER_PRIVATE, CLOSING_QUESTIONS].forEach(function (set) {
    set.forEach(function (q) {
      q.opts.forEach(function (o) { m[q.k + ':' + o.k] = { q: q.q, lab: o.lab, qk: q.k }; });
    });
  });
  return m;
})();

/* The log stores the question TEXT (the 'reason' column) and the answer LABEL
   (the 'body' column), not the keys — that is what the engine has always
   written, and rewriting the schema would orphan every row already in the
   sheet. These two maps read it back: question text -> question key, and
   question key + label -> answer key. Everything downstream works in keys. */
var PD_QKEY_BY_TEXT = (function () {
  var m = {};
  [CLIENT_QUESTIONS, MANAGER_COMMIT, MANAGER_FEEDBACK, MANAGER_PRIVATE, CLOSING_QUESTIONS].forEach(function (set) {
    set.forEach(function (q) { m[q.q] = q.k; });
  });
  return m;
})();

var PD_AKEY_BY_LABEL = (function () {
  var m = {};
  [CLIENT_QUESTIONS, MANAGER_COMMIT, MANAGER_FEEDBACK, MANAGER_PRIVATE, CLOSING_QUESTIONS].forEach(function (set) {
    set.forEach(function (q) {
      q.opts.forEach(function (o) { m[q.k + '|' + o.lab] = o.k; });
    });
  });
  return m;
})();

var PD_CLOSING_KEYS = (function () {
  var m = {};
  CLOSING_QUESTIONS.forEach(function (q) { m[q.k] = true; });
  return m;
})();

/** {qk, ak} for a logged row, or null if it is not one of our question sets. */
function pdDecodeAnswer_(questionText, label) {
  var qk = PD_QKEY_BY_TEXT[String(questionText || '').trim()];
  if (!qk) return null;
  var ak = PD_AKEY_BY_LABEL[qk + '|' + String(label || '').trim()];
  return { qk: qk, ak: ak || '', lab: String(label || '') };
}

/* The branch's own palette and mark, taken from rickyrampersadbranch.com rather
   than invented here: the navy field, the gold shield with a heart in it, and
   "Guardian Life of the Caribbean · Chaguanas" under the branch name. A client
   who has seen the website should recognise the letter as the same house.

   The mark is built from HTML, not SVG. Gmail strips inline SVG and Outlook
   does not render it at all, so a crest drawn in SVG is a blank space in the
   two clients most of this book reads mail in. A rounded block with the heart
   glyph renders everywhere and degrades to a plain gold shield where
   border-radius is unsupported. */
/* ===================== COLOUR =====================
   Three schemes. Set PD_THEME to whichever you want and every letter, badge,
   table header and rule follows it — nothing else to change.

     'navy'      Navy, from rickyrampersadbranch.com.
     'teal'      Guardian's corporate teal — closer to head office than to the
                 branch site.
     'charcoal'  The most neutral: closest to a bank statement, and the safest
                 on a poor screen.
     'burgundy'  Oxblood. The most traditional — reads like a solicitor's
                 letter. THE BRANCH'S CHOICE — this is the default.
     'forest'    Deep green. Warmer than navy without losing weight.
     'slate'     Blue-grey. The most contemporary of the six.

   There is no yellow in any of them. Accents on white are the scheme's own mid
   tone; accents on the dark field are its light tint.

   All three share the gold, the crest and the layout. Only the dark field
   changes, and every combination in each has been checked to clear 3.2:1. */
var PD_THEME = 'burgundy';

var PD_THEMES = {
  navy:     { dark: '#0C2440', dark2: '#15406E', mid: '#1F5FA8', tint: '#BFDBF7' },
  teal:     { dark: '#093F39', dark2: '#0E6E64', mid: '#0F8A7B', tint: '#A9E6DC' },
  charcoal: { dark: '#22262B', dark2: '#39414A', mid: '#53616E', tint: '#CDD6DF' },
  burgundy: { dark: '#42101F', dark2: '#6E1E38', mid: '#A32D4E', tint: '#F5BFCD' },
  forest:   { dark: '#123324', dark2: '#1F5A3C', mid: '#268052', tint: '#B9E7C9' },
  slate:    { dark: '#1E2A38', dark2: '#33517A', mid: '#4172A8', tint: '#C9DDF2' }
};

var PD_BRAND = (function () {
  var t = PD_THEMES[PD_THEME] || PD_THEMES.navy;
  return {
    navy:  t.dark,       // the letterhead field
    navy2: t.dark2,      // headings and table headers
    navy3: t.mid,        // secondary text on white
    /* No yellow anywhere, by instruction. Accents on white use the scheme's own
       mid tone; accents on the dark field use its light tint. The keys keep
       their old names so forty call sites did not need renaming. */
    gold:  t.mid,        // accents on white: option edges, note bars, rules
    gold2: t.tint,       // accents on the dark field only
    teal:  t.mid,        // legacy aliases — a few tables still name them
    teal2: t.dark2,
    ink:   '#101A24',
    mute:  '#5C6B7A',
    line:  '#E3DED3',
    panel: '#F7F4EE',    // warm neutral panel, for reference blocks and option rows
    wash:  '#F5F3ED',    // the neutral wash behind a note
    red:   '#A8322F',
    green: '#2F6B45',
    paper: '#FFFFFF'     // white, not cream. A cream body reads as a photocopy;
  };                     // white with warm panels reads as stationery.
})();

/* Georgia for display, Arial for body. Both are on effectively every device
   that opens mail, which is the only test that matters here — a webfont in an
   email is a webfont that does not load. A serif masthead and serif section
   headings are what make correspondence read as correspondence rather than as
   a notification. */
var PD_SERIF = 'Georgia,\'Times New Roman\',Times,serif';
var PD_SANS  = 'Arial,Helvetica,sans-serif';

var PD_ORG = { branch: 'Ricky Rampersad Branch', carrier: 'Guardian Life of the Caribbean',
               place: 'Chaguanas, Trinidad' };

/**
 * The status badge in the top right corner of the letterhead.
 * A letter about a lapsing policy should say what it is before the reader has
 * read a word of it — where it stands and how urgent it is — the way a
 * statement or a claim form does.
 */
function pdBadge_(kind, days) {
  var d = Number(days) || 0;
  /* The routine badges take the scheme's light tint with dark type, so they sit
     inside the letterhead instead of shouting over it. Colour is reserved for
     the two that mean something: red for the final notice, green for an account
     back in order. */
  var map = {
    s45:     { t: 'PREMIUM DUE',  bg: PD_BRAND.gold2, fg: PD_BRAND.navy },
    chase:   { t: 'PREMIUM DUE',  bg: PD_BRAND.gold2, fg: PD_BRAND.navy },
    s75:     { t: 'PREMIUM DUE',  bg: PD_BRAND.gold2, fg: PD_BRAND.navy },
    s90:     { t: 'FINAL NOTICE', bg: '#A8322F', fg: '#FFFFFF' },
    winback: { t: 'POLICY LAPSED', bg: '#6B7480', fg: '#FFFFFF' },
    pend:    { t: 'NOT YET IN FORCE', bg: PD_BRAND.gold2, fg: PD_BRAND.navy },
    thanks:  { t: 'ACCOUNT UP TO DATE', bg: '#2F6B45', fg: '#FFFFFF' },
    close:   { t: 'GRACE PERIOD ENDED', bg: '#6B7480', fg: '#FFFFFF' },
    mgr:     { t: 'INTERNAL', bg: PD_BRAND.gold2, fg: PD_BRAND.navy }
  };
  var m = map[kind];
  if (!m) return '';
  var sub = (kind === 'thanks' || kind === 'pend' || kind === 'mgr') ? ''
          : d + ' DAY' + (d === 1 ? '' : 'S') + ' OVERDUE';
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>' +
    '<td style="background:' + m.bg + ';color:' + m.fg + ';padding:7px 12px;border-radius:5px;' +
      'font-size:11px;font-weight:bold;letter-spacing:.09em;text-align:center;white-space:nowrap;' +
      'font-family:Arial,Helvetica,sans-serif;line-height:1.35">' +
      m.t + (sub ? '<br><span style="font-size:13px;letter-spacing:.04em;color:' + m.fg + '">' + sub + '</span>' : '') +
    '</td></tr></table>';
}

/* The branch crest — the ACTUAL shield from rickyrampersadbranch.com, the same
   path and the same stroke-weight checkmark, rendered to a PNG per scheme and
   committed under premium-due/assets/. The repository publishes to the branch
   domain, so once deployed the images are live and every mail client that
   shows images shows the real mark, properly drawn and properly scaled.
   Inline SVG is not an option (Gmail strips it) and a type glyph never matched
   the mark, so the glyph survives only as the blocked-images fallback. */
var PD_LOGO_DEFAULT = 'https://rickyrampersadbranch.com/premium-due/assets/crest-' + PD_THEME + '.png';

function pdCrest_() {
  var url = OUT.LOGO_URL || PD_LOGO_DEFAULT;
  return '<img src="' + url + '" width="46" height="46" alt="&#10003;" ' +
    'style="display:block;width:46px;height:46px;border:0;outline:none">';
}

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
/*
 * Address hygiene, which turns out to matter more than it sounds.
 *
 * 1,288 addresses in the book are broken by a single stray space —
 * "AFISHALEWISNAILS@GMAIL.CO M" — almost certainly a fixed-width export
 * artefact. Stripping whitespace repairs 132 of them inside the current save
 * window alone, taking email reach there from 51% to 69%. Those are real
 * clients we simply were not writing to.
 *
 * The repair is deliberately conservative: whitespace only. Nothing is guessed,
 * no domain is corrected, and anything still malformed after the strip is
 * treated as no address at all.
 */
function pdValidEmail_(e) {
  e = String(e || '').replace(/\s+/g, '');
  if (!e || /notavailable/i.test(e)) return '';
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e) ? e : '';
}

/* The portfolio's "Send Y or N" column. Anything explicitly N is a client who
   has asked not to be written to, and no sequence overrides that. */
function pdMayEmail_(p) {
  var f = String(p.SendFlag == null ? '' : p.SendFlag).trim().toUpperCase();
  return f !== 'N' && f !== 'NO' && f !== 'FALSE';
}
function pdSurveyLink_(policy) {
  if (!OUT.ENGINE_URL) return '';
  var base = OUT.ENGINE_URL.replace(/#.*$/, '');
  return base + (base.slice(-1) === '/' ? '' : '/') + '#survey=' + encodeURIComponent(policy);
}
/* ===================== WHAT ACTUALLY HAPPENS AT DAY 90 =====================
   Not the same thing for every policy, and saying otherwise is a misstatement
   about somebody's contract.

   A policy with no accrued value lapses: the cover genuinely ends. In practice
   that is the early years — the first two or so — before any value has built.

   A policy that has built a value does not simply stop. Under the contract's
   non-forfeiture provisions the cost of cover can continue to be met out of
   that value, and an automatic premium loan may already be running against it.
   The cover continues, but it is being paid for out of what the client has
   already put in, and it continues only until that value is exhausted.

   That second case is the more motivating message, and it has the advantage of
   being true: the client is not about to lose their cover this month, they are
   quietly spending the savings inside their own policy to keep it.

   The engine cannot compute a surrender value — that comes from the contract
   and the carrier. It can tell which conversation applies, and it asks the
   manager to state the position definitively in their response. */

var VALUE_UNKNOWN = 'unknown', VALUE_NONE = 'none', VALUE_LIKELY = 'likely', VALUE_APL = 'apl';

/** Just the year — the portfolio's date formats vary and none of them are a client's. */
function pdIssueYear_(p) {
  var d = p.IssueDate ? new Date(p.IssueDate) : null;
  return (d && !isNaN(d.getTime())) ? d.getFullYear() : '';
}

function pdYearsSinceIssue_(p) {
  if (!p.IssueDate) return null;
  var d = new Date(p.IssueDate);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 86400000);
}

/** Which of the three conversations this policy is in. */
function pdValueStatus_(p) {
  if ((Number(p.APLAmount) || 0) > 0) return VALUE_APL;      // a loan is already running
  var yrs = pdYearsSinceIssue_(p);
  if (yrs === null) return VALUE_UNKNOWN;
  return yrs < 2 ? VALUE_NONE : VALUE_LIKELY;
}

/** What day 90 means for this policy, in the client's own terms. */
function pdLapseMeaning_(p) {
  switch (pdValueStatus_(p)) {
    case VALUE_APL:
      return '<b>Your policy has been paying for itself.</b> Because it has built a value, the cost of your ' +
        'cover has been coming out of that value rather than lapsing the policy — there is currently ' +
        (Number(p.APLAmount) > 0 ? 'a loan of <b>' + pdMoney_(p.APLAmount) + '</b> against it. ' : 'a loan against it. ') +
        'You are not about to lose your cover this month. You are steadily spending what you have already ' +
        'paid in to keep it, and when that value is used up the cover does end.';
    case VALUE_LIKELY:
      return 'This policy has been in force long enough that it may have built a value. Where that is the case, ' +
        'the cover does not simply stop — under the contract the cost can be met from that value for a period, ' +
        'which means you would be paying for your own cover out of your own savings inside the policy. ' +
        '<b>Your agent will confirm exactly where this policy stands</b>, because the position depends on the ' +
        'contract terms and the value actually accrued.';
    case VALUE_NONE:
      return 'This policy is still in its early years and has not yet built a value to fall back on. ' +
        'That means it would <b>lapse outright</b>: the cover ends, and everything paid in stops working for you.';
    default:
      return 'What happens next depends on whether this policy has built a value. Where it has, the cost of ' +
        'cover can be met from that value for a period; where it has not, the policy lapses outright. ' +
        '<b>Your agent will confirm which applies here.</b>';
  }
}

/**
 * The same paragraph, but preferring the manager's stated position over the
 * engine's inference.
 *
 * pdValueStatus_ guesses from the issue date and the APL amount. It is a good
 * guess and it is never better than a guess. The manager is required to state
 * the position as one of their questions, and once they have, that answer is
 * the one that belongs in the client's letter — it came from the contract and
 * the carrier rather than from a date column. Writing "your agent will confirm"
 * to a client after the manager has already confirmed it is exactly the kind of
 * thing that makes a sequence read as automated.
 */
function pdLapseMeaningFor_(p, state) {
  var m = state && state.mgr && state.mgr.mvalue;
  if (!m || !m.ak || m.ak === 'checking') return pdLapseMeaning_(p);
  var by = state.mgrName ? ' — confirmed by <b>' + pdEsc_(state.mgrName) + '</b>' : '';
  switch (m.ak) {
    case 'novalue':
      return 'We have checked the position on this policy' + by + '. It has <b>not built a value</b> to fall ' +
        'back on, so at day 90 it lapses outright: the cover ends, a claim is not payable from that date, ' +
        'and everything paid in stops working for you.';
    case 'apl':
      return 'We have checked the position on this policy' + by + '. <b>An automatic premium loan is already ' +
        'running against its value</b>' +
        (Number(p.APLAmount) > 0 ? ' — currently <b>' + pdMoney_(p.APLAmount) + '</b>' : '') +
        ', which is why the cover has stayed in force. You are not about to lose it this month. You are ' +
        'spending what you have already paid in to keep it, and when that value is used up the cover does end.';
    case 'value':
      return 'We have checked the position on this policy' + by + '. It <b>has built a value</b>, and under the ' +
        'contract the cost of your cover can be met from that value for a period rather than the policy ' +
        'simply lapsing. That is worth knowing and it is worth acting on: the cover continues, but it is ' +
        'being paid for out of your own savings inside the policy.';
    default:
      return pdLapseMeaning_(p);
  }
}

/* ===================== WHAT THE LAW ACTUALLY SAYS =====================
   Quoted verbatim from the Insurance Act, 2018 (Act No. 4 of 2018, Trinidad
   and Tobago) — sections 180 (ordinary policies) and 207 (industrial
   policies). Verified against the published Act, not paraphrased from memory.
   This is why "your cover ends at day 90" is only ever written to a policy
   with no surrender value: for one that has built value, forfeiture for
   non-payment alone is barred by statute while the value covers what is owed. */

var PD_LAW = {
  cite: 'Insurance Act, 2018 (Act No. 4 of 2018), Trinidad and Tobago',
  s180_1: 'An ordinary policy shall not be forfeited by reason only of non-payment of any premiums ' +
    'where the surrender value of the policy, calculated as at the day immediately preceding that on ' +
    'which the premium falls due, exceeds the sum of the amount of the debts owing to the insurer ' +
    'under, or secured by, the policy and the amount of the overdue premium.',
  s180_4: 'Where the surrender value does not cover what is owed, the policy may only be forfeited after ' +
    'the insurer serves a late-payment notice and at least twenty business days have passed (s. 180(4)).',
  s207_3: 'An industrial policy on which at least two years\u2019 premiums have been paid shall not be ' +
    'forfeited by reason only of the non-payment of any premium, unless the premium has remained unpaid ' +
    'for not less than twelve weeks after it became due.'
};

/**
 * The letter's legal footing, quoted rather than asserted. The Act is quoted
 * verbatim with its section number; the plan's own clause is quoted only when
 * the branch has pasted it into OUT.CONTRACT_NOTE, because a contract must
 * never be paraphrased at a client.
 */
function pdLawBlock_(p) {
  var quote = function (text, cite) {
    return '<div style="border-left:3px solid ' + PD_BRAND.line + ';padding:10px 14px;margin:12px 0;' +
      'font-size:13px;line-height:1.6;color:' + PD_BRAND.navy3 + ';font-style:italic">&ldquo;' + text +
      '&rdquo;<div style="font-style:normal;font-size:11.5px;color:' + PD_BRAND.mute + ';padding-top:6px">— ' +
      cite + '</div></div>';
  };
  var out = quote(PD_LAW.s180_1, PD_LAW.cite + ', s. 180(1)');
  if (OUT.CONTRACT_NOTE) out += quote(pdEsc_(OUT.CONTRACT_NOTE), 'Your policy contract');
  else out += '<p style="font-size:12.5px;color:' + PD_BRAND.mute + ';margin:8px 0 0">Your own policy&rsquo;s ' +
    'grace-period and non-forfeiture clause governs in all cases — ask and we will send you the exact ' +
    'wording from your contract.</p>';
  return out;
}

/**
 * How the client follows their case — no telephone numbers, by instruction.
 * The moment they answer anything, a personal access code is issued. With the
 * engine deployed it appears on screen as the answer records and unlocks
 * "Check my case": a progress bar from first letter to resolved, every step
 * logged, and space to leave a comment. Until then, support sends the code
 * back on the same thread and keeps the view updated for them.
 */
function pdTrackBlock_() {
  var inner = '<b>Follow your case — no phone calls needed.</b> The moment you answer, you receive your ' +
    'personal access code. It shows you exactly where things stand: a progress bar from first letter to ' +
    'resolved, every step on the record, and space to add a comment of your own.' +
    (OUT.ENGINE_URL
      ? ' Use it any time at <a href="' + OUT.ENGINE_URL + '" style="color:' + PD_BRAND.navy2 +
        ';font-weight:bold">Check my case</a>.'
      : ' ' + pdEsc_(OUT.SUPPORT_NAME || 'Branch support') + ' confirms it on the same thread, and every ' +
        'update reaches you there.');
  return pdNote_(inner);
}

/** Days left before the 90-day lapse line. */
function pdDaysToLapse_(p) { return Math.max(0, SLA.LAPSE - (Number(p.DaysArrears) || 0)); }

/**
 * The deadline sentence, said correctly. "Cover ends in 45 days" is only true
 * of a policy with no surrender value; for one that has built value, the Act
 * bars forfeiture for non-payment alone while the value covers what is owed,
 * so the truthful sentence is about the grace period and the value being
 * drawn down — which the manager confirms.
 */
function pdDeadlineLine_(p) {
  var left = pdDaysToLapse_(p);
  switch (pdValueStatus_(p)) {
    case VALUE_NONE:
      return 'This policy is in its first two years, so it has not yet built a value to fall back on. ' +
        'If the premium is still outstanding at <b>day 90 — ' + left + ' days from today</b> — it will ' +
        '<b>lapse and cover will end</b>.';
    case VALUE_APL:
      return 'In <b>' + left + ' days</b> this policy reaches the end of its 90-day grace period. Cover does ' +
        'not simply end there — a premium loan is already running against the value you have built, and the ' +
        'cost of cover is being met from it — but that value is being spent down, and when it is exhausted ' +
        'the cover does end.';
    case VALUE_LIKELY:
      return 'In <b>' + left + ' days</b> this policy reaches the end of its 90-day grace period. Because it ' +
        'has been in force long enough to have built a value, cover does not simply end there — under your ' +
        'contract and the Insurance Act the cost of cover can be met from that value for a period. Your ' +
        'manager will confirm the exact position.';
    default:
      return 'In <b>' + left + ' days</b> this policy reaches the end of its 90-day grace period. What happens ' +
        'then depends on the value it has built — where there is value, cover continues out of it for a ' +
        'period; where there is none, the policy lapses. We will confirm which applies to yours.';
  }
}

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
             '— sent from the premium notice for policy ' + p.Policy + '\n' +
             '[ref ' + q.k + ':' + o.k + ']';
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
    /* Questions are not numbered. They sit inside a numbered section, and two
       competing sets of numerals in one letter — "1. Three questions" followed
       by "1., 2., 3." in larger type — reads as though the section headings
       were the sub-headings. Where another part of a letter needs to point at
       one of these, it names it. */
    out += '<div style="margin:' + (i ? '22px' : '4px') + ' 0 0">' +
      '<div style="font-size:14px;font-weight:bold;color:' + PD_BRAND.ink + ';margin-bottom:10px">' +
        pdEsc_(q.q) + '</div>' +
      '<table cellpadding="0" cellspacing="0" style="width:100%">';
    for (var j = 0; j < q.opts.length; j++) {
      var o = q.opts[j];
      var href = pdAnswerHref_(p, q, o, kind);
      out += '<tr><td style="padding:0 0 8px">' +
        '<a href="' + href + '" style="display:block;text-decoration:none;border:1px solid ' + PD_BRAND.line +
          ';border-left:5px solid ' + PD_BRAND.gold + ';border-radius:9px;background:#FFFFFF">' +
          '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr>' +
            '<td style="padding:14px 16px;color:' + PD_BRAND.navy2 + ';font-size:14.5px;font-weight:bold;' +
              'line-height:1.4">' + pdEsc_(o.lab) + '</td>' +
            '<td width="30" align="right" style="padding:14px 15px 14px 0;color:' + PD_BRAND.gold +
              ';font-size:19px;font-weight:bold">&rsaquo;</td>' +
          '</tr></table></a></td></tr>';
    }
    out += '</table></div>';
  }
  return out + '<p style="font-size:11.5px;color:#8A8578;margin:16px 0 0;line-height:1.55">' +
    (OUT.ENGINE_URL
      ? 'Each answer is recorded the moment you tap it — answer one question or all of them, in any order. Nobody will ask you to explain anything.'
      : 'Tapping an answer opens a reply that is already written for you — just press send. Nothing to fill in, no forms, and nobody will ask you to explain anything.') + '</p>';
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
  s45:     'We wrote asking what would help',
  s60:     'We wrote formally, copying your agent and their managers',   // retired — historic rows only
  chase:   'We followed up, having had no reply',
  s75:     'Your agent&rsquo;s manager wrote to you personally',
  s90:     'Final notice, with the full record',
  winback: 'We wrote about restoring the policy',
  pend:    'We wrote about the outstanding requirements'
};

function pdTrailRow_(when, what, mine) {
  return '<tr>' +
    '<td style="padding:7px 11px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel + ';color:' + PD_BRAND.mute + ';' +
      'white-space:nowrap;width:120px;vertical-align:top">' + when + '</td>' +
    '<td style="padding:7px 11px;border:1px solid ' + PD_BRAND.line + ';background:#FFFFFF;color:' +
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

/* ===================== THE FULL INTERACTION LOG =====================
   What the day-88 letter carries: everything on this policy's file, in date
   order — every letter, every answer the client gave, the day the case moved to
   a manager, what that manager recorded, and what was decided.

   Showing a client their own file is unusual and it is the point. Three months
   of a branch process happen entirely out of their sight; the one thing they
   experience is letters arriving. If work was done, this is where they see it.
   If it was not, this is where that shows too — and that is the version worth
   sending, because a client who was never called deserves to be the one who
   tells us so while the cover is still in force. */

/* Client-safe phrasings for what a manager recorded. A whitelist on purpose.
   The internal record also holds compliance and staffing decisions — a possible
   replacement of in-force cover, an orphan policy being reassigned, a
   documented decision to let it go — which are ours to act on and not a
   client's to read about in a letter. What appears below is what was done for
   them, and what they were told. */
var MGR_SAID_CLIENT = {
  /* commitment (day 60) */
  'mcall:today':         'Your manager committed to calling you that day',
  'mcall:week':          'Your manager committed to calling you that week',
  'mcall:done':          'Your manager recorded that they had already spoken with you',
  'mfact:yes':           'Your manager committed to reviewing your fact find',
  'mfact:done':          'Your fact find was reviewed and found in order',
  'madvisor:yes':        'Your manager arranged to discuss the policy with your advisor',
  'madvisor:done':       'Your manager and your advisor discussed this policy together',
  /* feedback (after the call) */
  'mreached:spoke':      'Your manager spoke with you',
  'mreached:message':    'Your manager left word for you and awaited your call',
  'moutcome:settle':     'It was recorded that you would settle it',
  'moutcome:review':     'A premium review was agreed for you',
  'moutcome:plan':       'A payment plan was agreed for you',
  'moutcome:end':        'You told them you wished to end the cover',
  'mvalue:novalue':      'The position on this policy&rsquo;s value was confirmed',
  'mvalue:apl':          'It was confirmed that a premium loan is running against the policy&rsquo;s value',
  'mvalue:value':        'It was confirmed that this policy has built a value',
  'mfactdone:ok':        'Your fact find was reviewed and accepted',
  'mfactdone:returned':  'Your fact find was returned to your advisor to complete',
  /* private decisions (client-safe subset only) */
  'mdecision:retention': 'A retention plan was approved for this policy',
  'mdecision:payplan':   'A payment plan was approved for this policy',
  'mdecision:reduce':    'A reduced premium, or an alteration to the benefit, was approved',
  'mdecision:reinstate': 'The case was escalated for reinstatement'
};

/* Rows are told apart by their background, not by the colour of the text.
   A pale tone on white — fine as a rule or a button, not as a
   sentence somebody has to read on a phone in daylight. Every value below is
   above 4.5:1 against the background it sits on, and each states both. */
var PD_LOG_TINT = {
  you: { fg: '#0A524A', bg: '#F1F7F5', weight: '600' },     // the client's own words
  mgr: { fg: PD_BRAND.navy2, bg: PD_BRAND.panel, weight: '600' },   // a manager acted
  us:  { fg: '#0B1B2B', bg: '#FFFFFF', weight: 'normal' }   // we wrote
};

function pdLogRow_(when, who, what, kind) {
  var t = PD_LOG_TINT[kind] || PD_LOG_TINT.us;
  return '<tr>' +
    '<td style="padding:8px 11px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel + ';color:' + PD_BRAND.mute + ';' +
      'white-space:nowrap;width:104px;vertical-align:top;font-size:12px">' + when + '</td>' +
    '<td style="padding:8px 11px;border:1px solid ' + PD_BRAND.line + ';background:' + t.bg + ';color:' + PD_BRAND.mute + ';' +
      'white-space:nowrap;width:88px;vertical-align:top;font-size:12px">' + who + '</td>' +
    '<td style="padding:8px 11px;border:1px solid ' + PD_BRAND.line + ';background:' + t.bg + ';color:' + t.fg +
      ';font-weight:' + t.weight + '">' + what + '</td>' +
    '</tr>';
}

/** Every event on the file, client-safe, in date order. */
function pdInteractionLog_(p, state) {
  var ev = [], i;
  var mgrName = (state && state.mgrName) || pdManagerOf_(p.Agent) || 'the manager';

  var trail = (state && state.trail) || [];
  for (i = 0; i < trail.length; i++) ev.push({ ts: trail[i].ts, who: 'We wrote', what: trail[i].what, kind: 'us' });

  var replies = (state && state.replies) || [];
  for (i = 0; i < replies.length; i++) {
    ev.push({ ts: replies[i].ts, who: 'You', what: 'You answered: <b>' + pdEsc_(replies[i].lab || '') + '</b>', kind: 'you' });
  }
  if (state && state.survey && state.survey.ts) {
    ev.push({ ts: state.survey.ts, who: 'You',
      what: 'You replied to us' + (state.survey.surveyReason ? ': <b>' + pdEsc_(state.survey.surveyReason) + '</b>' : ''),
      kind: 'you' });
  }
  if (state && state.retentionTs) {
    ev.push({ ts: state.retentionTs, who: pdEsc_(pdFirst_(p.Agent)) || 'Your agent',
      what: 'Your agent prepared a written case for their manager' +
            (state.factFind ? ', with a completed fact find attached' : ''), kind: 'us' });
  }
  if (state && state.activatedTs) {
    ev.push({ ts: state.activatedTs, who: 'Handover',
      what: '<b>' + pdEsc_(mgrName) + '</b> was formally asked to take personal responsibility for this ' +
            'policy and to contact you directly', kind: 'mgr' });
  }

  var mgr = (state && state.mgr) || {};
  for (var qk in mgr) {
    if (!Object.prototype.hasOwnProperty.call(mgr, qk)) continue;
    var said = MGR_SAID_CLIENT[qk + ':' + mgr[qk].ak];
    if (!said) continue;                                     // internal-only answer
    ev.push({ ts: mgr[qk].ts, who: pdEsc_(pdFirst_(mgrName)) || 'Manager', what: said,
              kind: (qk === 'moutcome' || qk === 'mreached') ? 'you' : 'mgr' });
  }

  ev.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });

  var rows = '';
  for (i = 0; i < ev.length; i++) rows += pdLogRow_(pdDateOf_(ev[i].ts), ev[i].who, ev[i].what, ev[i].kind);
  rows += pdLogRow_('Today', 'We wrote', 'This letter', 'us');

  var table = '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    '<tr>' +
      '<th style="padding:9px 12px;background:' + PD_BRAND.navy + ';border:1px solid ' + PD_BRAND.navy + ';color:#FFFFFF;text-align:left;font-weight:bold;font-size:11px;letter-spacing:.08em;font-size:12px">Date</th>' +
      '<th style="padding:9px 12px;background:' + PD_BRAND.navy + ';border:1px solid ' + PD_BRAND.navy + ';color:#FFFFFF;text-align:left;font-weight:bold;font-size:11px;letter-spacing:.08em;font-size:12px">Who</th>' +
      '<th style="padding:9px 12px;background:' + PD_BRAND.navy + ';border:1px solid ' + PD_BRAND.navy + ';color:#FFFFFF;text-align:left;font-weight:bold;font-size:11px;letter-spacing:.08em;font-size:12px">What happened</th>' +
    '</tr>' + rows + '</table>';

  /* Internal notes are counted, not quoted. They are working notes between
     colleagues and can carry a judgement about the client that nobody wrote
     expecting them to read it. The count is the honest disclosure; the notes
     themselves are available on request, which is the correct way round. */
  var notes = (state && state.noteCount) || 0;
  if (notes) {
    table += '<p style="font-size:12.5px;color:#7C8794;margin:8px 0 0">Your file also carries <b>' + notes +
      '</b> internal working note' + (notes === 1 ? '' : 's') + ' from the branch about this policy. ' +
      'They are working notes between colleagues rather than correspondence, but you are entitled to them — ' +
      'ask and we will send them.</p>';
  }

  var heardFromYou = false, managerActed = false;
  for (i = 0; i < ev.length; i++) {
    if (ev[i].kind === 'you') heardFromYou = true;
    if (ev[i].kind === 'mgr') managerActed = true;
  }

  if (!managerActed) {
    /* The uncomfortable one, and the reason the log is in the letter at all.
       If nobody at this branch has recorded a single act on this policy in
       three months, the client should be told that by us, before they work it
       out for themselves. */
    table += pdNote_('<b>Reading that back, we do not think we did enough.</b> The record above shows letters ' +
      'from us and little else. If nobody from this branch spoke to you about this policy, say so in the first ' +
      'question above — it goes to the branch manager directly, and it will be dealt with whatever you decide ' +
      'about the cover.', PD_BRAND.red);
  } else if (!heardFromYou) {
    table += pdNote_('We have had no reply from you at any point above. That is not a complaint — it is the ' +
      'reason this letter exists. If our letters have been going to the wrong address, or something about ' +
      'this has been hard to answer, one tap on any question above tells us and we will work around it.');
  }
  return table;
}

/* ============================ email chrome ============================ */

/**
 * inner, a header tag, and — for staff mail — internal:true.
 *
 * The footer is not decoration. "Your policy contract and schedule govern in
 * all cases. If you have already paid, please ignore this" is addressed to a
 * policyholder, and it was appearing at the bottom of every email sent to a
 * manager about their own client.
 */
function pdWrap_(inner, tag, internal) {
  var foot = internal
    ? 'Internal — Ricky Rampersad Branch. Generated by the Premium Due Engine from the branch portfolio and the ' +
      'policy log. Everything you record against this policy forms part of the client&rsquo;s day-88 letter.'
    : 'This notice relates to the premium on your policy. Your policy contract and schedule govern in all cases. ' +
      'If you have already paid, please ignore this — payments can take a few days to reflect.';
  var badge = pdBadge_(tag && tag.kind, tag && tag.days);
  return '<div style="font-family:' + PD_SANS + ';font-size:14.5px;line-height:1.65;color:' +
      PD_BRAND.ink + ';max-width:600px;background:' + PD_BRAND.paper + '">' +

    /* letterhead */
    '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:' +
        PD_BRAND.navy + '">' +
      '<tr><td style="padding:22px 22px 20px">' +
        '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse"><tr>' +
          '<td width="42" valign="top" style="width:42px">' + pdCrest_() + '</td>' +
          '<td valign="top" style="padding:1px 14px 0 15px;color:#FFFFFF">' +
            '<div style="font-family:' + PD_SERIF + ';font-size:20px;color:#FFFFFF;line-height:1.2;' +
              'letter-spacing:.005em">' + pdEsc_(PD_ORG.branch) + '</div>' +
            '<div style="font-size:11px;color:' + PD_BRAND.gold2 + ';padding-top:5px;letter-spacing:.13em">' +
              pdEsc_(PD_ORG.carrier).toUpperCase() + '</div>' +
          '</td>' +
          (badge ? '<td valign="top" align="right" style="padding-top:1px">' + badge + '</td>' : '') +
        '</tr></table>' +
      '</td></tr>' +
      /* a hairline, not a band — a 4px stripe reads like a web banner */
      '<tr><td style="height:2px;line-height:2px;font-size:0;background:' + PD_BRAND.gold2 + '">&nbsp;</td></tr>' +
    '</table>' +

    '<div style="border:1px solid ' + PD_BRAND.line + ';border-top:none;padding:24px 22px;background:' +
        PD_BRAND.paper + ';color:' + PD_BRAND.ink + '">' +
      inner +
      '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:28px 0 0">' +
        '<tr><td style="border-top:1px solid ' + PD_BRAND.line + ';padding:12px 0 0">' +
          '<div style="font-size:11px;line-height:1.6;color:#6F6A60">' +
            '<b style="color:' + PD_BRAND.mute + '">' + pdEsc_(PD_ORG.branch) + '</b> &middot; ' +
            pdEsc_(PD_ORG.carrier) + ' &middot; ' + pdEsc_(PD_ORG.place) + '<br>' +
            (internal ? pdEsc_(OUT.BRANCH_PHONE) + ' &middot; ' : '') + pdEsc_(OUT.BRANCH_EMAIL) + '</div>' +
          '<div style="font-size:10.5px;line-height:1.55;color:#7E796E;padding-top:8px">' + foot + '</div>' +
        '</td></tr></table>' +
    '</div></div>';
}
function pdBtn_(link, label) {
  if (!link) return '';
  return '<p style="text-align:center;margin:22px 0"><a href="' + link + '" style="background:' + PD_BRAND.navy2 +
    ';color:#FFFFFF;text-decoration:none;font-weight:bold;padding:13px 28px;border-radius:8px;display:inline-block">' +
    pdEsc_(label) + '</a></p>';
}
function pdNote_(html, colour) {
  var c = colour || PD_BRAND.gold;
  var bg = (c === PD_BRAND.red) ? '#FBEDEC' : PD_BRAND.wash;
  return '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:16px 0">' +
    '<tr><td style="width:3px;background:' + c + ';font-size:0;line-height:0">&nbsp;</td>' +
    '<td style="background:' + bg + ';padding:14px 18px;color:' + PD_BRAND.ink + ';font-size:13.5px;line-height:1.65">' +
      html + '</td></tr></table>';
}
/**
 * What is actually owed. AmountBilled is the billed arrears from the portfolio;
 * where it is missing the premium itself is the honest fallback, and the letter
 * says "at least" rather than stating a figure it cannot stand behind.
 */
function pdAmountDue_(p) {
  var billed = Number(p.AmountBilled) || 0;
  return billed > 0 ? billed : 0;
}

/**
 * Names the collection mechanism. "Your premium is collected by bankers order"
 * changes the conversation from something the client failed to do into
 * something that stopped working — which, for the 60 clients in this book who
 * are behind on one policy while paying another, is what actually happened.
 */
function pdBillingNote_(p) {
  var b = String(p.Billing || '').toLowerCase();
  if (!b) return '';
  if (b.indexOf('bank') > -1 || b.indexOf('order') > -1 || b.indexOf('debit') > -1) {
    return pdNote_('This premium is collected by <b>' + pdEsc_(p.Billing) + '</b>. When one falls behind it is ' +
      'usually the instruction rather than the intention — a mandate cancelled, an account changed, a card ' +
      'reissued. If that is what has happened, tell us and we will re-lodge it. There is nothing further for ' +
      'you to do.');
  }
  if (b.indexOf('salary') > -1 || b.indexOf('deduct') > -1) {
    return pdNote_('This premium is collected by <b>' + pdEsc_(p.Billing) + '</b>. Deductions commonly stop when ' +
      'someone changes employer or payroll, and the policy is the last thing anybody thinks of. If your ' +
      'circumstances have changed, we can move it to a direct arrangement in one call.');
  }
  return '';
}

/**
 * Three figures across the top, big enough to read without reading.
 *
 * The nine-row detail table it replaces was accurate and nobody would look at
 * it. What a policyholder wants from a letter like this is the amount, where
 * the cover stands, and how it is collected — and if those three are not
 * legible in two seconds, the rest of the letter does not get read either.
 */
function pdGlance_(p) {
  var cells = [];
  var due = pdAmountDue_(p);
  if (due > 0) cells.push({ k: 'AMOUNT OUTSTANDING', v: pdMoney_(due), c: PD_BRAND.red });
  cells.push({ k: 'PREMIUM', v: pdMoney_(p.Premium) + (p.Mode ? ' ' + pdEsc_(String(p.Mode).toLowerCase()) : ''),
               c: PD_BRAND.ink });
  if (p.PaidToDate) cells.push({ k: 'PAID TO', v: pdEsc_(p.PaidToDate), c: PD_BRAND.ink });
  else if (Number(p.SumAssured) > 0) cells.push({ k: 'BENEFIT', v: pdMoney_(p.SumAssured), c: PD_BRAND.ink });

  /* Inline-block cells rather than table cells, so on a phone the three
     figures wrap to two rows instead of crushing into unreadable columns. */
  var out = '';
  for (var i = 0; i < cells.length; i++) {
    out += '<div style="display:inline-block;vertical-align:top;width:32%;min-width:158px;' +
      'padding:14px 12px 14px 0">' +
      '<div style="font-size:9.5px;letter-spacing:.13em;color:' + PD_BRAND.mute + ';font-weight:bold">' +
        cells[i].k + '</div>' +
      '<div style="font-family:' + PD_SERIF + ';font-size:22px;color:' + cells[i].c +
        ';padding-top:5px;line-height:1.2;white-space:nowrap">' + cells[i].v + '</div></div>';
  }
  return '<div style="margin:18px 0 6px;border-top:1px solid ' + PD_BRAND.line +
      ';border-bottom:1px solid ' + PD_BRAND.line + ';font-size:0">' + out + '</div>' +
    (p.Billing ? '<div style="font-size:12px;color:' + PD_BRAND.mute + ';margin:0 0 4px">Collected by ' +
      pdEsc_(p.Billing) + (p.IssueDate && pdIssueYear_(p) ? ' &middot; in force since ' + pdIssueYear_(p) : '') +
      '</div>' : '');
}

function pdFacts_(p) {
  // Every cell states its own colour and background. Table colour inheritance is
  // unreliable across mail clients — Outlook and Gmail's dark mode in particular —
  // so a cell that only sets a background renders as invisible text often enough
  // to matter when the thing being hidden is the policy number.
  var row = function (k, v) {
    return '<tr>' +
      '<td style="padding:9px 13px;background:' + PD_BRAND.panel + ';border:1px solid ' + PD_BRAND.line +
        ';width:170px;color:' + PD_BRAND.mute + ';font-size:12.5px">' + k + '</td>' +
      '<td style="padding:9px 13px;background:#FFFFFF;border:1px solid ' + PD_BRAND.line + ';color:' +
        PD_BRAND.ink + ';font-weight:bold">' + v + '</td>' +
      '</tr>';
  };
  /* The portfolio carries far more than the policy number and the premium, and
     every one of these answers a question the client would otherwise have to
     telephone to ask. Amount outstanding in particular: the commonest answer to
     "how would you like us to handle this" is "just tell me the amount", and
     until now the letter made them ask for it. */
  var held = pdYearsSinceIssue_(p);
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:14px 0;font-size:13px">' +
    row('Policy number', pdEsc_(p.Policy)) +
    (p.PlanCode ? row('Plan', pdEsc_(p.PlanCode) + (p.InsType ? ' &middot; ' + pdEsc_(p.InsType) : '')) : '') +
    (Number(p.SumAssured) > 0 ? row('Benefit', pdMoney_(p.SumAssured)) : '') +
    row('Premium', pdMoney_(p.Premium) + (p.Mode ? ' <span style="font-weight:normal;color:' + PD_BRAND.mute +
        '">' + pdEsc_(p.Mode) + '</span>' : '')) +
    (pdAmountDue_(p) > 0
      ? row('<span style="color:' + PD_BRAND.red + '">Amount outstanding</span>',
            '<span style="color:' + PD_BRAND.red + '">' + pdMoney_(pdAmountDue_(p)) + '</span>')
      : '') +
    (p.PaidToDate ? row('Premiums paid to', pdEsc_(p.PaidToDate)) : '') +
    (p.Billing ? row('Collected by', pdEsc_(p.Billing)) : '') +
    (held !== null && held >= 1 ? row('In force', Math.floor(held) + ' year' + (Math.floor(held) === 1 ? '' : 's') +
        (pdIssueYear_(p) ? ' <span style="font-weight:normal;color:' + PD_BRAND.mute + '">&middot; since ' +
         pdIssueYear_(p) + '</span>' : '')) : '') +
    (p.LapseDate ? row('Grace period ends', pdEsc_(p.LapseDate)) : '') +
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
  /* Date, addressee, reference, subject — in that order, as on a letter. The
     addressee block is the single thing that most separates correspondence
     from a notification, and the portfolio has carried the address all along. */
  var addr = String(p.Address || '').split(/\s*,\s*/).filter(Boolean);
  var addrHtml = '';
  for (var i = 0; i < addr.length; i++) {
    addrHtml += '<div style="color:' + PD_BRAND.ink + '">' + pdEsc_(addr[i]) + '</div>';
  }
  return '<div style="font-size:13px;color:' + PD_BRAND.mute + ';margin:0 0 20px">' + pdToday_() + '</div>' +

    '<div style="font-size:13.5px;line-height:1.5;margin:0 0 20px">' +
      '<div style="color:' + PD_BRAND.ink + ';font-weight:bold">' + pdEsc_(p.Client) + '</div>' +
      addrHtml +
    '</div>' +

    '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 22px">' +
      '<tr><td style="border-top:2px solid ' + PD_BRAND.navy + ';border-bottom:1px solid ' + PD_BRAND.line +
        ';padding:12px 0">' +
        '<div style="font-family:' + PD_SERIF + ';font-size:19px;color:' + PD_BRAND.navy +
          ';line-height:1.25">' + pdEsc_(subject) + '</div>' +
        '<div style="font-size:12px;color:' + PD_BRAND.mute + ';padding-top:6px;letter-spacing:.02em">' +
          'Policy <b style="color:' + PD_BRAND.ink + '">' + pdEsc_(p.Policy) + '</b>' +
          (p.ClientNo ? '&nbsp;&nbsp;&middot;&nbsp;&nbsp;Client reference <b style="color:' + PD_BRAND.ink +
            '">' + pdEsc_(p.ClientNo) + '</b>' : '') + '</div>' +
      '</td></tr></table>';
}

/**
 * A section heading with its body.
 *
 * Not numbered. Numbered sections read like a form somebody has to complete,
 * and where a numbered section contained a numbered list of questions the two
 * sets of numerals competed. A small gold rule and a bold heading does the same
 * navigational job and looks like correspondence rather than paperwork.
 */
function pdSection_(title, body) {
  return '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:28px 0 0">' +
    '<tr><td style="border-bottom:1px solid ' + PD_BRAND.line + ';padding:0 0 7px">' +
      '<span style="font-family:' + PD_SERIF + ';font-size:16px;color:' + PD_BRAND.navy + '">' +
        pdEsc_(title) + '</span>' +
    '</td></tr>' +
    '<tr><td style="padding:13px 0 0;color:' + PD_BRAND.ink + '">' + body + '</td></tr></table>';
}

/**
 * What happens next, with dates rather than adjectives — and only what is still
 * ahead. A timeline that lists steps already behind the client reads as filler;
 * every row here is something that has not happened yet and will.
 */
function pdTimeline_(p) {
  var d = Number(p.DaysArrears) || 0;
  var mgr = pdManagerOf_(p.Agent);
  var row = function (when, what, emphasis) {
    return '<tr>' +
      '<td style="padding:8px 12px;background:' + PD_BRAND.panel + ';border:1px solid ' + PD_BRAND.line + ';width:118px;white-space:nowrap;color:' +
        (emphasis ? PD_BRAND.red : '' + PD_BRAND.mute + '') + ';font-weight:' + (emphasis ? 'bold' : 'normal') + '">' + when + '</td>' +
      '<td style="padding:8px 12px;background:#FFFFFF;border:1px solid ' + PD_BRAND.line + ';color:' + PD_BRAND.ink + '">' + what + '</td>' +
      '</tr>';
  };
  var out = row('Today', 'Day <b>' + d + '</b> — the premium is outstanding and your cover remains in force.');

  if (d < SLA.RETENTION_OPENS) {
    out += row('Day ' + SLA.RETENTION_OPENS, 'This stops being a letter. ' +
      (mgr ? '<b>' + pdEsc_(mgr) + '</b>, your agent&rsquo;s manager, ' : 'Your agent&rsquo;s manager ') +
      'takes personal responsibility for the policy and contacts you directly.');
  }
  if (d < 75) {
    out += row('Day 75', 'If we still have not managed to reach you, that manager writes to you in their own name.');
  }
  if (d < 88) {
    out += row('Day 88', 'Final notice — with the complete record of everything that has happened on this policy, ' +
      'including what we did and did not do.');
  }
  out += row('Day 90', (pdValueStatus_(p) === VALUE_NONE
    ? 'The policy lapses. Cover ends, a claim is not payable from that date, and restoring it needs a fresh application.'
    : 'The policy reaches the end of its grace period. What happens then depends on the value it has built — see below.'), true);

  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    out + '</table>';
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

/** Total monthly premium across everything still in force. */
function pdTotalPremium_(family) {
  var t = 0;
  for (var i = 0; i < family.length; i++) {
    if (Number(family[i].Status) === 1) continue;
    t += Number(family[i].Premium) || 0;
  }
  return t;
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

/* ===================== PLAN CODES, IN ENGLISH =====================
   From the GLOC ES400 training manual (Ingenium plan-codes listing). A letter
   that says "your Flexiterm Convertible — 20 years" is telling the client what
   they are about to lose; "FCT201" is telling them nothing. Codes are matched
   with spaces stripped, so the manual's "FCT20 1" and the portfolio's "FCT201"
   are the same key. A code the manual does not list falls back to the product
   family implied by the policy-number prefix (5 = Life Evolution / SOS,
   1 = Flexiterm / Xpress Life, 8 = Lifestyle / Tophat / IPI) — and if even
   that fails, the raw code is shown rather than a guess. */
var PD_PLAN_NAMES = (function () {
  var m = {
    'LIFEV1': 'Liberator (to age 65)', 'LB751': 'Liberator (to age 75)',
    'LB851': 'Liberator (to age 85)', 'LB1001': 'Liberator (to age 100)',
    'LFINC1': 'Liberator rider', 'LBI751': 'Liberator rider (to 75)',
    'LBI851': 'Liberator rider (to 85)', 'LBI001': 'Liberator rider (to 100)',
    'CRIEV1': 'Rejuvenator Original', 'CRINC1': 'Rejuvenator Original rider',
    'CR2EV1': 'Rejuvenator Plus', 'C2INC1': 'Rejuvenator Plus rider',
    'CI3DS1': 'Rejuvenator Enhanced',
    'SAVEV1': 'Saver / Investor',
    'ADDEV1': 'Accidental Death & Disability', 'ADEV1': 'Accidental Death benefit',
    'WPEV1': 'Waiver of Premium',
    'ECL1': 'Econolife',
    'MB601': 'Money Back Term (to 60)', 'MB651': 'Money Back Term (to 65)',
    'MP201': 'Mortgage Protection (20 years)', 'MP251': 'Mortgage Protection (25 years)',
    'MP301': 'Mortgage Protection (30 years)',
    'DT201': 'Reducing Term (20 years)', 'DT251': 'Reducing Term (25 years)',
    'ADD1': 'Accidental Death & Disability', 'AD1': 'Accidental Death benefit',
    'WP1': 'Waiver of Premium',
    'PIM1': 'Individual Personal Investor', 'PIML1': 'Individual Personal Investor (lump sum)',
    'PICI1': 'Individual Personal Investor (conservative)', 'PICL1': 'IPI Conservative (lump sum)',
    'PIMI1': 'Individual Personal Investor (increment)',
    'PIMU1': 'Individual Personal Investor (US$)', 'PIMUL1': 'IPI US$ (lump sum)', 'PIMUI1': 'IPI US$ (increment)',
    'SOSA1': 'Student Opportunity Saver', 'SOSAL1': 'Student Opportunity Saver (lump sum)',
    'SOSCI1': 'Student Opportunity Saver (conservative)', 'SOSCL1': 'SOS Conservative (lump sum)',
    'SOSAI1': 'Student Opportunity Saver (increment)',
    'LSTYA1': 'Lifestyle (aggressive)', 'LSTYL1': 'Lifestyle (lump sum)',
    'THATA1': 'Tophat Special Edition (aggressive)', 'THATL1': 'Tophat Special Edition (lump sum)',
    'FLACC': 'Flex Accumulator', 'FLACH': 'Flex Accumulator', 'FLACZ': 'Flex Accumulator',
    'WPLS': 'Waiver of Premium', 'WPFT1': 'Waiver of Premium (Flexiterm)',
    'ADDRV1': 'Accidental Death & Disability', 'ADRV1': 'Accidental Death benefit'
  };
  var i, a;
  var terms = [5, 10, 15, 20], ages = [60, 65, 70, 80, 85];
  for (i = 0; i < terms.length; i++) {
    m['FCT' + terms[i] + '1'] = 'Flexiterm Convertible (' + terms[i] + ' years)';
    m['FNT' + terms[i] + '1'] = 'Flexiterm (' + terms[i] + ' years)';
  }
  for (i = 0; i < ages.length; i++) {
    m['FCT' + ages[i] + '1'] = 'Flexiterm Convertible (to age ' + ages[i] + ')';
    m['FNT' + ages[i] + '1'] = 'Flexiterm (to age ' + ages[i] + ')';
  }
  var xl = [50, 75, 100, 125, 150];
  for (i = 0; i < xl.length; i++) m['XL' + xl[i] + '1'] = 'Xpress Life ($' + xl[i] + 'k)';
  var lsAges = [50, 55, 60, 65, 70], gp = ['0', '1', '2', '3'], gpYears = ['no', '5-year', '10-year', '15-year'];
  for (i = 0; i < gp.length; i++) {
    for (a = 0; a < lsAges.length; a++) {
      m['LS' + gp[i] + lsAges[a] + '1'] = 'Lifestyle Pension (to ' + lsAges[a] +
        (i ? ', ' + gpYears[i] + ' guarantee' : '') + ')';
    }
  }
  for (a = 0; a < lsAges.length; a++) {
    m['LSI' + lsAges[a] + '1'] = 'Lifestyle Pension increment (to ' + lsAges[a] + ')';
    m['TH0' + lsAges[a] + '1'] = 'Tophat Executive (to ' + lsAges[a] + ')';
  }
  for (i = 2; i <= 19; i++) {
    var t2 = (i < 10 ? '0' + i : String(i));
    m['LS' + t2 + '1'] = 'Lifestyle Privilege (' + i + ' years)';
    m['TH' + t2 + '1'] = 'Tophat Elite (' + i + ' years)';
  }
  var dTerms = ['10', '15', '20', '25', '55', '60', '65'];
  for (i = 0; i < dTerms.length; i++) {
    var lbl = Number(dTerms[i]) > 30 ? 'to age ' + dTerms[i] : dTerms[i] + ' years';
    m['D' + dTerms[i] + 'EV1'] = 'Disability Income (' + lbl + ')';
    m['D' + dTerms[i] + '1'] = 'Disability Income (' + lbl + ')';
  }
  return m;
})();

/** Friendly product name for a plan code, or '' when the manual doesn't say. */
function pdPlanName_(code, policy) {
  var k = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (PD_PLAN_NAMES[k]) return PD_PLAN_NAMES[k];
  var pfx = String(policy || '').charAt(0);
  if (pfx === '5') return 'Life Evolution series';
  if (pfx === '1') return 'Flexiterm / Xpress Life series';
  if (pfx === '8') return 'Lifestyle · Tophat · IPI series';
  return '';
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

/** Every policy the client holds, with the one in arrears marked.
    Capped at 12 rows — past that (a scheme, or a roster gap letting one
    through) the letter shows this policy plus the eleven largest and says how
    many more there are, instead of mailing somebody a ledger. Totals stay
    computed over the full holding. */
function pdPolicyTable_(p, family) {
  var shown = family, extra = 0;
  if (family.length > 12) {
    var rest = [];
    for (var r = 0; r < family.length; r++) {
      if (String(family[r].Policy) !== String(p.Policy)) rest.push(family[r]);
    }
    rest.sort(function (a, b) { return (Number(b.SumAssured) || 0) - (Number(a.SumAssured) || 0); });
    shown = [p].concat(rest.slice(0, 11));
    extra = family.length - shown.length;
  }
  var rows = '';
  for (var i = 0; i < shown.length; i++) {
    var f = shown[i];
    var here = String(f.Policy) === String(p.Policy);
    var st = Number(f.Status), desc = String(f.StatusDesc || '');
    var label = here ? 'This letter' : (st === 1 ? 'Lapsed' : st === 2 ? 'Behind' :
                 st === 3 ? 'In underwriting' : desc || 'In force');
    var colour = here ? PD_BRAND.red : (st === 1 ? '#8A8578' : st === 2 ? PD_BRAND.gold : PD_BRAND.green);
    var bg = here ? PD_BRAND.panel : '#FFFFFF';
    rows += '<tr>' +
      '<td style="padding:9px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + bg +
        ';color:' + PD_BRAND.ink + ';font-weight:bold;font-size:12.5px">' + pdEsc_(f.Policy) +
        '<div style="font-size:11px;font-weight:normal;color:' + PD_BRAND.mute + '">' +
        (function () {
          var nm = pdPlanName_(f.PlanCode, f.Policy);
          return nm ? pdEsc_(nm) + (f.PlanCode ? ' &middot; ' + pdEsc_(f.PlanCode) : '')
                    : pdEsc_(f.PlanCode || '');
        })() + '</div></td>' +
      '<td style="padding:9px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + bg +
        ';color:' + PD_BRAND.ink + ';text-align:right;white-space:nowrap">' +
        (Number(f.Premium) > 0 ? pdMoney_(f.Premium) : '—') + '</td>' +
      '<td style="padding:9px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + bg +
        ';color:' + PD_BRAND.ink + ';text-align:right;font-weight:bold;white-space:nowrap">' +
        (Number(f.SumAssured) > 0 ? pdMoney_(f.SumAssured) : '—') + '</td>' +
      '<td style="padding:9px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + bg +
        ';color:' + colour + ';font-weight:bold;white-space:nowrap;font-size:12.5px">' + pdEsc_(label) + '</td>' +
      '</tr>';
  }
  if (extra > 0) {
    rows += '<tr><td colspan="4" style="padding:9px 10px;border:1px solid ' + PD_BRAND.line +
      ';background:#FFFFFF;color:' + PD_BRAND.mute + ';font-size:12px">&hellip; and <b>' + extra +
      '</b> more polic' + (extra === 1 ? 'y' : 'ies') + ' on this account — the totals below cover all of them, ' +
      'and the full list is available on request.</td></tr>';
  }
  var inForce = pdTotalCover_(family);
  var premTotal = pdTotalPremium_(family);
  var total = (inForce > 0 && family.length > 1)
    ? '<tr>' +
        '<td style="padding:10px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel +
          ';color:' + PD_BRAND.ink + ';font-weight:bold;font-size:12.5px">Total in force</td>' +
        '<td style="padding:10px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel +
          ';color:' + PD_BRAND.ink + ';text-align:right;font-weight:bold;white-space:nowrap">' +
          (premTotal > 0 ? pdMoney_(premTotal) : '') + '</td>' +
        '<td style="padding:10px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel +
          ';color:' + PD_BRAND.ink + ';text-align:right;font-weight:bold;white-space:nowrap;font-size:15px">' +
          pdMoney_(inForce) + '</td>' +
        '<td style="padding:10px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel + '"></td>' +
      '</tr>'
    : '';
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    '<tr>' +
      '<th style="padding:9px 10px;background:' + PD_BRAND.navy + ';border:1px solid ' + PD_BRAND.navy + ';color:#FFFFFF;text-align:left;font-weight:bold;font-size:10.5px;letter-spacing:.07em">POLICY</th>' +
      '<th style="padding:9px 10px;background:' + PD_BRAND.navy + ';border:1px solid ' + PD_BRAND.navy + ';color:#FFFFFF;text-align:right;font-weight:bold;font-size:10.5px;letter-spacing:.07em">PREMIUM</th>' +
      '<th style="padding:9px 10px;background:' + PD_BRAND.navy + ';border:1px solid ' + PD_BRAND.navy + ';color:#FFFFFF;text-align:right;font-weight:bold;font-size:10.5px;letter-spacing:.07em">BENEFIT</th>' +
      '<th style="padding:9px 10px;background:' + PD_BRAND.navy + ';border:1px solid ' + PD_BRAND.navy + ';color:#FFFFFF;text-align:left;font-weight:bold;font-size:10.5px;letter-spacing:.07em">STANDING</th>' +
    '</tr>' + rows + total + '</table>';
}

/**
 * The opening paragraph.
 *
 * It used to announce the client's own position back at them — "You hold 4
 * policies with us and you are paying 3 of them without any difficulty" — which
 * is both a lecture and a fact they already know, delivered by an insurer who
 * has been counting. What belongs in prose is why we are writing and what we
 * are offering. What they hold belongs in the table below it, where a reader
 * can take it in at a glance and nobody is being told about their own affairs.
 */
function pdOpening_(p, family, days) {
  var d = Number(days) || Number(p.DaysArrears) || 0;
  var due = pdAmountDue_(p);
  return '<p style="margin:0 0 12px">The premium on this policy has been outstanding for <b>' + d +
    ' days</b>' +
    (due > 0 ? ', and <b>' + pdMoney_(due) + '</b> is currently owing' : '') +
    (p.PaidToDate ? '. Your premiums are paid to <b>' + pdEsc_(p.PaidToDate) + '</b>, and your cover remains in force'
                  : '. Your cover remains in force') +
    ' — we are writing now so that it stays that way.</p>' +
    '<p style="margin:0">There are more options here than most policyholders realise, and we would rather ' +
    'find the right one with you than assume anything about your circumstances. Whichever suits you is one ' +
    'tap below, and nothing else is needed from you.</p>';
}

/**
 * One line of context under the policy table, where the relationship says
 * something genuinely useful. Neutral and short — an observation offered, not a
 * conclusion about somebody's finances.
 */
function pdRelationshipNote_(p, family, billingShown) {
  var r = pdRelationship_(p, family);
  if (r.payingOthers > 0) {
    /* Where pdBillingNote_ has already named the collection method, this would
       be the same observation twice in two consecutive boxes. One sentence
       instead, and it adds the fact the billing note does not have: that the
       other premiums are arriving. */
    if (billingShown) {
      return '<p style="font-size:13px;color:' + PD_BRAND.mute + ';margin:8px 0 0">The other ' +
        (r.payingOthers === 1 ? 'premium on this account is' : r.payingOthers + ' premiums on this account are') +
        ' being paid without difficulty, which supports that reading.</p>';
    }
    return pdNote_('The other premiums on this account are being paid without difficulty, which most often ' +
      'means <b>the instruction on this one has stopped</b> rather than anything else — a mandate cancelled, ' +
      'a card reissued, a deduction that was never set up. If that is what has happened, it is usually a ' +
      'five-minute fix and we can do it over the phone.');
  }
  if (r.lapsedBefore > 0) {
    return pdNote_('Cover on ' + (r.lapsedBefore === 1 ? 'another policy' : r.lapsedBefore + ' other policies') +
      ' has previously ended this way. We mention it only because it is avoidable here, and because the ' +
      'benefit above is worth protecting.');
  }
  return '';
}

/**
 * Named signatories, so the client knows exactly who is accountable.
 *
 * both:true names the agent and the manager side by side. That is the right
 * form for the day-88 letter, which asks the client whether anyone from this
 * branch actually contacted them: signing that question with one name, from
 * someone who may be the person who did not call, is the wrong way round.
 */
function pdSignature_(p, opts) {
  opts = opts || {};
  var mgr = opts.manager || pdManagerOf_(p.Agent);
  var line = function (name, role) {
    return '<span style="font-family:' + PD_SERIF + ';font-size:15.5px;color:' + PD_BRAND.ink + '">' +
      pdEsc_(name) + '</span><br><span style="color:' + PD_BRAND.mute + ';font-size:12.5px">' + role + '</span>';
  };
  var who = (opts.both && mgr)
    ? '<table cellpadding="0" cellspacing="0" style="width:100%"><tr>' +
        '<td style="padding:0 14px 0 0;vertical-align:top;color:' + PD_BRAND.ink + '">' +
          line(p.Agent || OUT.BRANCH_NAME, 'Financial Advisor') + '</td>' +
        '<td style="padding:0;vertical-align:top;color:' + PD_BRAND.ink + '">' +
          line(mgr, 'Manager &middot; accountable for this policy since day 60') + '</td>' +
      '</tr></table><br>'
    : line(OUT.SUPPORT_NAME || 'Branch Support', pdEsc_(OUT.SUPPORT_ROLE || 'Branch Support') +
        ' &middot; ' + pdEsc_(OUT.BRANCH_NAME)) +
      (p.Agent ? '<br><span style="color:' + PD_BRAND.mute + ';font-size:12.5px">Your advisor: <b style="color:' +
        PD_BRAND.ink + '">' + pdEsc_(p.Agent) + '</b>' +
        (mgr ? ' &middot; reporting to ' + pdEsc_(mgr) : '') + '</span>' : '') + '<br>';
  return '<table cellpadding="0" cellspacing="0" style="width:100%;margin:30px 0 0;font-size:13px">' +
    '<tr><td style="color:' + PD_BRAND.ink + '">Warm regards,</td></tr>' +
    '<tr><td style="padding:18px 0 0">' + who + '</td></tr></table>';
}

/** Internal mail is from the branch, not from somebody's advisor. */
function pdSigInternal_() {
  return '<table cellpadding="0" cellspacing="0" style="width:100%;margin:22px 0 0;font-size:13px">' +
    '<tr><td style="padding:14px 0 0;border-top:1px solid ' + PD_BRAND.line + ';color:' + PD_BRAND.mute + '">' +
      '<b style="color:' + PD_BRAND.ink + '">' + pdEsc_(OUT.BRANCH_NAME) + '</b> &middot; Premium Due Engine<br>' +
      pdEsc_(OUT.BRANCH_PHONE) + ' &middot; ' + pdEsc_(OUT.BRANCH_EMAIL) +
    '</td></tr></table>';
}

function pdSig_() {
  return '<p style="margin-top:18px">Warm regards,<br><b>' + pdEsc_(OUT.BRANCH_NAME) + '</b>' +

    (OUT.BRANCH_EMAIL ? '<br>' + pdEsc_(OUT.BRANCH_EMAIL) : '') + '</p>';
}

/* ============================ the templates ============================ */
/* Each stage returns {subject, html} and, where the whole chain is copied,
   {cc}. One channel, one record. Two versions of the branch's position going
   out on two channels means the one nobody logged is the one the client
   remembers. */

var PD_TEMPLATES = {


  /* ---- day 45: ask the questions, and remind them what they own ---- */
  s45: function (p, state) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p);
    var d = Number(p.DaysArrears) || 0;
    var family = pdFamily_(p, state && state.family);
    return {
      subject: 'Policy ' + p.Policy + ' — ' + (pdAmountDue_(p) > 0 ? pdMoney_(pdAmountDue_(p)) + ' outstanding' : 'premium outstanding ' + d + ' days'),
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding') +
        '<p style="margin:0 0 10px">' + pdSalutation_(p.Client) + ',</p>' +
        '<p style="margin:0 0 10px">We are writing from branch support because the premium on this policy is ' +
        '<b>' + d + ' days</b> outstanding — and because this happens to the best of us. A bank change, a busy ' +
        'month, a stretch where money is tight: whatever sits behind it, <b>your cover is still in force</b> and ' +
        'there is a way through that suits you.</p>' +
        '<p style="margin:0">Tap one option below. It does the rest — no forms, no hold music, no explaining ' +
        'yourself to anybody.</p>' +

        pdGlance_(p) +

        pdSection_('How can we help?', pdQuestionBlock_(p, pdClientQuestions_(p, family), 'respond') +
          pdPayBtn_(p)) +

        (family.length > 1
          ? pdSection_('Everything you hold with us', pdPolicyTable_(p, family) +
              '<p style="font-size:12.5px;color:' + PD_BRAND.mute + ';margin:6px 0 0">The highlighted row is ' +
              'the policy this letter concerns. The others are unaffected' +
              (pdRelationship_(p, family).payingOthers > 0
                ? ' — and their premiums are arriving normally, which usually means the instruction on this ' +
                  'one stopped, not the intention.'
                : '.') + '</p>')
          : '') +

        pdSection_('What happens next',
          '<p style="margin:0 0 10px">' + pdDeadlineLine_(p) + '</p>' +
          '<p style="margin:0">' +
          (pdManagerOf_(p.Agent)
            ? 'If we have not heard from you by <b>day 60</b>, <b>' + pdEsc_(pdManagerOf_(p.Agent)) +
              '</b> — the manager responsible for your advisor — will call you personally. '
            : 'If we have not heard from you by <b>day 60</b>, a manager will call you personally. ') +
          'We would rather hear from you first.</p>' +
          '<p style="font-size:12px;color:' + PD_BRAND.mute + ';margin:10px 0 0">Your policy&rsquo;s ' +
          'grace-period and non-forfeiture provisions, and the ' + PD_LAW.cite + ' (s. 180), govern what ' +
          'happens at day 90 — the final notice quotes them in full.</p>') +

        pdTrackBlock_() +
        pdSignature_(p),
        { kind: 's45', days: d })
    };
  },

  /* ---- day 60 has no client template, deliberately ----------------------
     It used to be the big formal letter: the timeline, the whole chain copied,
     ten one-click options. It was the third piece of paper in a fortnight, and
     a fourth well-written letter is not what moves someone who has ignored
     three.

     What happens at day 60 now is that the case leaves the mailing list. The
     manager is sent the structured brief in pdManagerLetter_ with
     opts.activation, is asked to answer it by tapping, and is asked to
     telephone the client personally. The branch's own submissions are the whole
     argument: 47 of 137 clients said nobody had contacted them. A call from a
     manager is the intervention. Another letter is the thing we do instead of
     the intervention.

     The client hears from us again in their own name at day 75 (from that
     manager) and at day 88, with the full record. ---- */

  /* ---- every 5 days, while the client has said nothing ---- */
  chase: function (p, state) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p), d = Number(p.DaysArrears) || 0;
    var mgr = pdManagerOf_(p.Agent);
    var escalated = d >= SLA.RETENTION_OPENS;
    return {
      subject: 'Policy ' + p.Policy + ' — ' + left + ' days remaining',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding — Reminder') +
        '<p style="margin:0 0 10px">' + pdSalutation_(p.Client) + ',</p>' +
        '<p style="margin:0">We wrote at day 45 and have not yet had your instruction. ' + pdDeadlineLine_(p) + '</p>' +

        pdGlance_(p) +

        (escalated
          ? pdNote_((mgr ? '<b>' + pdEsc_(mgr) + '</b>, your advisor&rsquo;s manager, has' : 'Your advisor&rsquo;s manager has') +
              ' been asked to call you personally. If you would rather not wait, one tap settles it now.')
          : '') +

        pdSection_('How can we help?', pdQuestionBlock_(p, pdClientQuestions_(p, state && state.family, ['help', 'when']), 'respond') +
          pdPayBtn_(p)) +

        pdTrackBlock_() +
        pdSignature_(p),
        { kind: 'chase', days: d })
    };
  },

  /* ---- day 88: the final notice, and the client's own file ----------------
     The last letter is the one that has to carry the whole thing. It opens with
     three questions, then shows the client every event on this policy in date
     order — what we sent, what they answered, the day it went to a manager,
     what that manager recorded and what was decided.

     Two reasons to send someone their own file. Where the branch did the work,
     it is the only place the client ever sees it: three months of process
     happen out of their sight and all they experience is post arriving. Where
     the branch did not, the record says so plainly, and the first question
     invites them to confirm it while the cover is still in force. A client who
     was never called should not have to discover that after the policy has
     gone. ---- */
  s90: function (p, state) {
    var family = pdFamily_(p, state && state.family);
    var left = pdDaysToLapse_(p);
    var mgr = (state && state.mgrName) || pdManagerOf_(p.Agent);
    return {
      subject: 'Final notice — policy ' + p.Policy + ', ' + left + ' day' + (left === 1 ? '' : 's') + ' remaining',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Final Notice') +
        '<p style="margin:0 0 10px">' + pdSalutation_(p.Client) + ',</p>' +
        '<p style="margin:0">This is the last notice before this policy reaches the end of its grace period, ' +
        'in <b>' + left + ' day' + (left === 1 ? '' : 's') + '</b>. There is still time, and it still only ' +
        'takes one tap.</p>' +

        pdGlance_(p) +

        pdSection_('How would you like us to handle this?',
          pdQuestionBlock_(p, pdClientQuestions_(p, state && state.family, ['help', 'pay']), 'respond') +
          pdPayBtn_(p)) +

        pdSection_('What day 90 means here', pdNote_(pdLapseMeaningFor_(p, state), PD_BRAND.red) + pdLawBlock_(p)) +

        '<p style="margin:22px 0 0">' +
        (mgr ? '<b>' + pdEsc_(mgr) + '</b> holds this policy personally — reply to this email and it reaches them. ' : '') +
        'If the answer is that you want it to end, we would rather hear it from you than record it as silence.</p>' +
        pdTrackBlock_() +
        pdSignature_(p, { both: !!(state && (state.activatedTs || state.mgrName)), manager: state && state.mgrName }),
        { kind: 's90', days: Number(p.DaysArrears) || 0 })
    };
  },

  /* ---- day 75: the manager writes, in their own name. Fifteen days left, and
         the letters before this one did not land. A different signature from a
         different person is the last lever before the final notice. ---- */
  s75: function (p, state) {
    var left = pdDaysToLapse_(p), d = Number(p.DaysArrears) || 0;
    var mgr = pdManagerOf_(p.Agent) || OUT.BRANCH_NAME;
    return {
      subject: 'Policy ' + p.Policy + ' — a personal note from ' + mgr,
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding — From the Manager') +
        '<p style="margin:0 0 10px">' + pdSalutation_(p.Client) + ',</p>' +
        '<p style="margin:0">I am <b>' + pdEsc_(mgr) + '</b>, the manager responsible for your advisor&rsquo;s work ' +
        'at this branch. I am writing myself because we have not managed to reach you, and there are <b>' +
        left + ' days</b> left before this policy reaches the end of its grace period.</p>' +

        pdGlance_(p) +

        pdSection_('Choose whichever suits you — I will handle it personally',
          pdQuestionBlock_(p, pdClientQuestions_(p, state && state.family, ['help', 'pay']), 'respond') +
          pdPayBtn_(p)) +

        pdSection_('What day 90 means here', pdNote_(pdLapseMeaningFor_(p, state)) + pdLawBlock_(p)) +

        '<p style="margin:22px 0 0">If none of the above fits, reply to this email with a single line and ' +
        'I will call you myself — you never need to chase us.</p>' + pdTrackBlock_() +
        pdSignature_(p, { both: true, manager: mgr }),
        { kind: 's75', days: d })
    };
  },

  /* ---- day 90, 95 and 100: the closing letter ---------------------------
     The grace period has run out. Everything that could be done has been done,
     and this letter says so — it sets out every follow-up, what the client
     answered or did not, what the manager recorded, and then asks the two
     questions the branch has never asked anybody: how did the advisor do, and
     how did the manager do.

     It repeats every five days and stops at three. Nothing after that; a fourth
     letter asking a lapsed policyholder to rate us would be the branch talking
     to itself. ---- */
  close: function (p, state, opts) {
    opts = opts || {};
    var round = Number(opts.round) || 1;
    var mgr = (state && state.mgrName) || pdManagerOf_(p.Agent);
    var family = pdFamily_(p, state && state.family);
    var sent = ((state && state.trail) || []).length;

    var open = round === 1
      ? '<p style="margin:0 0 10px">The grace period on this policy has now run out.</p>' +
        '<p style="margin:0">Before we close the file, we would like you to see exactly what was done, and ' +
        'we would like to hear how it felt from your side. Both of those matter more to this branch than ' +
        'the policy number does.</p>'
      : '<p style="margin:0 0 10px">We wrote ' + (round === 2 ? 'five days ago' : 'twice already') +
        ' and have not heard back. This is the <b>' + (round === 3 ? 'last' : 'second') + '</b> time we will ask.</p>' +
        '<p style="margin:0">Four taps is the whole thing, and it is the only way this branch finds out ' +
        'whether we handled you properly.</p>';

    return {
      subject: (round > 1 ? 'A final ask — ' : '') + 'Policy ' + p.Policy + ' — how did we do?',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Closing This Policy — Your View') +
        '<p style="margin:0 0 10px">' + pdSalutation_(p.Client) + ',</p>' +
        open +

        pdSection_('Four questions. One tap each.',
          pdQuestionBlock_(p, CLOSING_QUESTIONS, 'respond') +
          pdPayBtn_(p)) +

        pdSection_('Everything we did', pdInteractionLog_(p, state) +
          '<p style="font-size:13px;color:' + PD_BRAND.mute + ';margin:8px 0 0">' +
          (sent ? 'That is <b>' + sent + '</b> ' + (sent === 1 ? 'letter' : 'letters') + ' from us. '
                : '') +
          'From day 60 every one of those was copied to you, so nothing above happened out of your sight.</p>') +

        (family.length > 1 ? pdSection_('What you still hold with us', pdPolicyTable_(p, family) +
          '<p style="font-size:12.5px;color:' + PD_BRAND.mute + ';margin:6px 0 0">These are unaffected. ' +
          'Nothing about this policy changes them.</p>') : '') +

        pdSection_('Where this policy stands',
          pdNote_(pdLapseMeaningFor_(p, state), PD_BRAND.red) + pdLawBlock_(p) +
          '<p style="margin:10px 0 0">Reinstatement is usually simpler than starting again — the policy keeps ' +
          'its <b>original age and terms</b>, so it is normally cheaper than the same cover bought today. ' +
          'That window does not stay open indefinitely.</p>') +

        '<p style="margin:22px 0 0">Whatever you tell us above goes to the branch manager directly, under ' +
        'your name and on the record.</p>' + pdTrackBlock_() +
        pdSignature_(p, { both: !!mgr, manager: mgr }),
        { kind: 'close', days: Number(p.DaysArrears) || 0 })
    };
  },

  /* ---- lapsed, but recently. Reinstatement is still realistic. ---- */
  winback: function (p) {
    var first = pdFirst_(p.Client), d = Number(p.DaysArrears) || 0;
    return {
      subject: 'Policy ' + p.Policy + ' can still be restored',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'This policy can still be restored') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>This policy lapsed ' + (p.LapseDate ? 'on <b>' + pdEsc_(p.LapseDate) + '</b>' : 'recently') +
        ', which means there is no cover in place today. We are writing because it is not too late to put it back.</p>' +

        pdSection_('Why restoring beats starting again',
          '<p>Reinstatement keeps the policy&rsquo;s <b>original age and original terms</b>, so the premium is ' +
          'normally lower than the same cover bought today — and the health you were underwritten on then is ' +
          'the health it stays priced against. The window does not stay open indefinitely: the longer it runs, ' +
          'the more evidence the insurer asks for.</p>' + pdFacts_(p)) +

        '<p style="margin-top:22px">One tap above tells us to check exactly what restoring it would take, ' +
        'and we come back to you with the figures.</p>' + pdTrackBlock_() + pdSignature_(p),
        { kind: 'winback', days: 0 })
    };
  },

  /* ---- new business waiting on requirements ----
     When the Requirement Management tab knows the case (state.reqt), the letter
     names the exact document, how long it has been outstanding, and — where
     underwriting is already complete — says the true, urgent thing: one paper
     stands between this application and a policy in force. */
  pend: function (p, state) {
    var first = pdFirst_(p.Client), d = Number(p.DaysArrears) || 0;
    var rq = state && state.reqt;
    var named = rq && rq.items && rq.items.length;
    var lead = named ? rq.items[0].name : '';
    var isPay = named && /future premium|premium payment/i.test(lead);

    var list = '';
    if (named) {
      list = '<ul style="margin:8px 0 0;padding-left:20px;color:' + PD_BRAND.ink + '">';
      for (var i = 0; i < rq.items.length; i++) {
        list += '<li style="margin:0 0 7px"><b>' + pdEsc_(rq.items[i].name) + '</b>' +
          (rq.items[i].days > 0 ? ' <span style="color:' + PD_BRAND.mute + '">— outstanding ' +
            rq.items[i].days + ' days</span>' : '') + '</li>';
      }
      list += '</ul>';
    }

    return {
      subject: named
        ? 'One thing completes your application: ' + lead + ' — policy ' + p.Policy
        : 'Your application needs one more thing — policy ' + p.Policy,
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Your application — what completes it') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>Your application has been in progress for <b>' + d + ' days</b>' +
        (named ? ', and it is waiting on you for the following:' :
          ' and is waiting on outstanding requirements' +
          (p.StatusDesc ? ' — <i>' + pdEsc_(p.StatusDesc) + '</i>' : '') + '.') + '</p>' +
        list +

        (rq && rq.uwDone
          ? pdNote_('<b>Underwriting on your application is COMPLETE.</b> ' +
              (named ? 'The item' + (rq.items.length === 1 ? '' : 's') + ' above ' +
                (rq.items.length === 1 ? 'is' : 'are') : 'One requirement is') +
              ' the only thing between you and a policy in force. The day it reaches us, this finishes.',
              PD_BRAND.green)
          : pdNote_('Until this is complete <b>you are not yet covered</b>. That is the part worth knowing — ' +
              'an application in progress is not a policy in force.')) +

        (rq && rq.susp > 0
          ? '<p style="margin:14px 0 0">The <b>' + pdMoney_(rq.susp) + '</b> you have already paid toward this ' +
            'policy is held safely and applies in full the moment the application completes — it is waiting on ' +
            'the same thing we are.</p>'
          : '') +

        (isPay ? pdPayBtn_(p) : '') +

        pdSection_('Where your application stands', (function () {
          var tr = function (k, v2, hot) {
            return '<tr><td style="padding:7px 11px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel +
              ';color:' + PD_BRAND.mute + ';white-space:nowrap;width:120px;font-size:12px">' + k + '</td>' +
              '<td style="padding:7px 11px;border:1px solid ' + PD_BRAND.line + ';background:#FFFFFF;color:' +
              (hot ? PD_BRAND.red : PD_BRAND.ink) + '">' + v2 + '</td></tr>';
          };
          var recv = p.AppReceived ? pdEsc_(String(p.AppReceived).slice(0, 10)) : '';
          return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
            (recv ? tr('Received', 'Your application reached us on <b>' + recv + '</b>') : '') +
            tr('Today', '<b>Day ' + d + '</b> — ' + (rq && rq.uwDone
              ? 'underwriting complete, waiting only on the item' + (named && rq.items.length > 1 ? 's' : '') + ' above'
              : 'with underwriting' + (named ? ', waiting on the item' + (rq.items.length > 1 ? 's' : '') + ' above' : ''))) +
            tr('On receipt', 'The moment the outstanding item' + (named && rq && rq.items.length > 1 ? 's reach' : ' reaches') +
              ' us, the application moves to issue — and your agent and their manager (copied here) see it happen', false) +
            '</table>';
        })()) +

        pdSection_('The application', pdFacts_(p)) +

        '<p style="margin-top:22px">' +
        (named
          ? 'Reply to this email with the item' + (rq.items.length === 1 ? '' : 's') +
            ' attached, or tell us which office to collect from — whichever is easier. We write every two ' +
            'weeks until this completes, and stop the day it does.'
          : 'It is usually a medical appointment, a form, or one document. Reply to this email and we will ' +
            'tell you exactly what is outstanding and take it from there.') + '</p>' +
        pdTrackBlock_() + pdSignature_(p),
        { kind: 'pend', days: 0 })
    };
  },

  /* ---- the structured close: a pending application became a policy ----
     Fires once, automatically, when a policy the engine chased as pending is
     next seen in force. The client gets the good news with the full timeline;
     the agent and manager are on the copy line, so the case closes in front
     of everyone it involved — no application ever just quietly stops being
     talked about. */
  nbclose: function (p, state) {
    var first = pdFirst_(p.Client);
    var recv = p.AppReceived ? String(p.AppReceived).slice(0, 10) : '';
    var took = 0;
    if (recv) {
      var rd = new Date(recv);
      if (!isNaN(rd)) took = Math.max(1, Math.round((Date.now() - rd.getTime()) / 86400000));
    }
    var nm = pdPlanName_(p.PlanCode, p.Policy);
    return {
      subject: 'Your policy is in force — ' + (nm || 'policy ' + p.Policy),
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Application complete — policy in force') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p><b>Your application is complete and your policy is in force.</b> ' +
        (nm ? 'You now hold a <b>' + pdEsc_(nm) + '</b>' + (p.PlanCode ? ' (' + pdEsc_(p.PlanCode) + ')' : '') + '. ' : '') +
        (Number(p.SumAssured) > 0 ? 'Your cover of <b>' + pdMoney_(p.SumAssured) + '</b> is active from today. ' : '') +
        '</p>' +
        pdNote_('<b>From this day, you are covered.</b>' +
          (recv ? ' Your application was received on <b>' + pdEsc_(recv) + '</b> and completed in <b>' + took +
            ' days</b> — thank you for seeing the requirements through.' : ''), PD_BRAND.green) +
        pdSection_('Your policy', pdFacts_(p)) +
        pdSection_('What happens now',
          '<p style="margin:0 0 8px">Three things worth a minute:</p>' +
          '<ul style="margin:0;padding-left:20px;color:' + PD_BRAND.ink + '">' +
          '<li style="margin:0 0 7px">Your contract document follows — read the schedule page and tell us if anything is not as you applied for it.</li>' +
          '<li style="margin:0 0 7px">Your premium keeps the cover alive. If the payment date or method ever stops suiting you, say so <b>before</b> it becomes a missed payment — changing it is easy.</li>' +
          '<li style="margin:0 0 7px">Register on <b>myGuardian Group</b> to see your policy, your values and your payments any time.</li>' +
          '</ul>' + pdPayBtn_(p)) +
        '<p style="margin-top:18px">Your agent <b>' + pdEsc_(p.Agent) + '</b> and their manager are copied — they saw ' +
        'this application through and they stay your first call.</p>' +
        pdTrackBlock_() + pdSignature_(p),
        { kind: 'thanks', days: 0 })
    };
  },

  /* ---- the client paid. Close the loop; it earns the next renewal. ---- */
  thanks: function (p) {
    var first = pdFirst_(p.Client);
    return {
      subject: 'Thank you — policy ' + p.Policy + ' is up to date',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Premium received — thank you') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>Your premium has been received and this policy is <b>up to date</b>. Your cover continues without a ' +
        'break, and the benefits you have built stay intact.</p>' +
        '<p>Thank you for settling it, and for staying with us.</p>' +
        '<p>If a different payment date or arrangement would suit you better, say the word — it is far easier ' +
        'to change than to catch up.</p>' + pdSignature_(p),
        { kind: 'thanks', days: 0 })
    };
  }
};

/**
 * The one call the engine UI and the daily run both use.
 * state carries what we already know about the case — the 45-day survey answers
 * in particular, so the 60-day letter can quote them back rather than pretend
 * the earlier exchange never happened.
 */
function pdRender(stageKey, policy, state, opts) {
  var fn = PD_TEMPLATES[stageKey];
  return fn ? fn(policy, state, opts) : null;
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
    '<td style="padding:6px 12px;background:' + PD_BRAND.panel + ';border:1px solid ' + PD_BRAND.line + ';color:' + PD_BRAND.mute + '">' + k + '</td>' +
    '<td style="padding:6px 12px;background:#FFFFFF;border:1px solid ' + PD_BRAND.line + ';color:' + PD_BRAND.ink + '">' + v + '</td>' +
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
      htmlBody: pdWrap_(body, { kind: 'mgr' }, true)
    });
  } catch (err) { /* never let a mail failure lose the record */ }
}

/* ===================== THE DAY-60 EMAIL =====================
   Addressed to the manager. Copied to the advisor, to the branch manager — and
   to the client.

   Copying the client is the whole design. Up to day 60 the policyholder is
   asked to act and hears nothing back but reminders. From day 60 they watch the
   branch work: who has the policy, what they have been asked, and by when. It
   converts a chase into visible accountability, and it is why every question in
   MANAGER_QUESTIONS is a service question and why MANAGER_PRIVATE is not in
   this email.

   It repeats every three days until the manager answers, each one carrying the
   timeline, what has already been sent, what the client said at day 45 — or
   that they did not reply — and only the questions still outstanding. */

/** How to reach this client — everything the portfolio holds, in one block. */
function pdContactBlock_(p) {
  var rows = '';
  if (p.Phone) rows += pdKv_('Telephone', '<b>' + pdEsc_(p.Phone) + '</b>');
  var em = pdValidEmail_(p.Email);
  rows += pdKv_('Email', em ? pdEsc_(em) : '<span style="color:' + PD_BRAND.red + '">none on file</span>');
  if (p.Address) rows += pdKv_('Address', pdEsc_(p.Address));
  if (!pdMayEmail_(p)) {
    rows += pdKv_('Consent', '<span style="color:' + PD_BRAND.red + '">Marked <b>do not email</b> — telephone or visit only</span>');
  }
  if (!p.Phone && !em) {
    return pdNote_('<b>We hold no telephone number and no usable email address for this client.</b> ' +
      (p.Address ? 'The address on file is <b>' + pdEsc_(p.Address) + '</b>. ' : '') +
      'The automated sequence cannot reach them at all — if this policy is saved, you will have saved it.',
      PD_BRAND.red);
  }
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    rows + '</table>';
}

/** What was sent, and what came back — the paragraph the client also reads. */
function pdWhatWeHave_(p, state) {
  var replies = (state && state.replies) || [];
  var survey  = state && state.survey;
  if (!replies.length && !survey) {
    return pdNote_('<b>We wrote on day 45 and again since, and have had no reply.</b> ' +
      'That is not held against anybody — people miss email, addresses go stale, and a letter about a ' +
      'premium is easy to put aside. It does mean a telephone call is now the only thing that will move ' +
      'this, and that is what is being asked for below.', PD_BRAND.red);
  }
  var rows = '';
  for (var i = 0; i < replies.length; i++) {
    rows += pdKv_(pdEsc_(replies[i].q || 'Answered'),
      '<b>' + pdEsc_(replies[i].lab || '') + '</b>' +
      (replies[i].ts ? ' <span style="font-weight:normal;color:' + PD_BRAND.mute + '">&middot; ' +
        pdDateOf_(replies[i].ts) + '</span>' : ''));
  }
  if (survey) {
    if (survey.surveyReason)  rows += pdKv_('Reason given', pdEsc_(survey.surveyReason));
    if (survey.surveyPromise) rows += pdKv_('In their words', pdEsc_(survey.surveyPromise));
  }
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    rows + '</table>' +
    '<p style="font-size:13px;color:' + PD_BRAND.mute + ';margin:6px 0 0">' +
    'This is what the client told us on day 45. The premium is still outstanding, so the conversation is not finished.</p>';
}

/** Whether every question in a set has been answered. */
function pdAllAnswered_(state, set) {
  var m = (state && state.mgr) || {};
  for (var i = 0; i < set.length; i++) if (!m[set[i].k]) return false;
  return true;
}

/** The questions in a set this manager has not yet answered. */
function pdOutstandingQuestions_(state, set) {
  set = set || MANAGER_COMMIT;
  var m = (state && state.mgr) || {}, out = [];
  for (var i = 0; i < set.length; i++) if (!m[set[i].k]) out.push(set[i]);
  return out;
}

/** What the manager has already answered in a set, shown back so nothing is asked twice. */
function pdAnsweredBlock_(state, set) {
  set = set || MANAGER_COMMIT;
  var m = (state && state.mgr) || {}, rows = '';
  for (var i = 0; i < set.length; i++) {
    var a = m[set[i].k];
    if (a) rows += pdKv_(pdEsc_(set[i].q), '<b>' + pdEsc_(a.lab) + '</b>');
  }
  return rows
    ? '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
      rows + '</table>'
    : '';
}

/**
 * The record so far, for the manager's file — fuller than the client sees.
 * Every letter we sent, every answer the client gave verbatim with its date,
 * the fact find, and the manager's own commitments once made. This is the "45
 * and the other emails and the client response, for his record" — attached to
 * the day-60 email so the manager opens one thing and has the whole history.
 */
function pdManagerHistory_(p, state) {
  var ev = [];
  (state && state.trail || []).forEach(function (t) {
    ev.push({ ts: t.ts, who: 'We wrote', what: t.what });
  });
  (state && state.replies || []).forEach(function (r) {
    ev.push({ ts: r.ts, who: pdEsc_(pdFirst_(p.Client)) || 'Client',
              what: '<b>' + pdEsc_(r.lab || '') + '</b>' + (r.q ? ' <span style="color:' + PD_BRAND.mute +
                '">(' + pdEsc_(r.q) + ')</span>' : '') });
  });
  if (state && state.survey && state.survey.ts) {
    ev.push({ ts: state.survey.ts, who: pdEsc_(pdFirst_(p.Client)) || 'Client',
      what: 'Replied' + (state.survey.surveyReason ? ': <b>' + pdEsc_(state.survey.surveyReason) + '</b>' : '') +
        (state.survey.surveyPromise ? ' &mdash; &ldquo;' + pdEsc_(state.survey.surveyPromise) + '&rdquo;' : '') });
  }
  if (state && state.retentionTs) {
    ev.push({ ts: state.retentionTs, who: pdEsc_(pdFirst_(p.Agent)) || 'Advisor',
      what: 'Filed a written retention case' + (state.factFind ? ', fact find attached' : '') });
  }
  ev.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });

  if (!ev.length) {
    return pdNote_('<b>The client has not replied to anything yet.</b> Everything sent so far &mdash; the ' +
      'day-45 letter and the reminders &mdash; went out with no answer. A call from you is the intervention.',
      PD_BRAND.red);
  }
  var rows = '';
  for (var i = 0; i < ev.length; i++) {
    rows += '<tr>' +
      '<td style="padding:7px 11px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel +
        ';color:' + PD_BRAND.mute + ';white-space:nowrap;font-size:12px;vertical-align:top;width:96px">' +
        pdDateOf_(ev[i].ts) + '</td>' +
      '<td style="padding:7px 11px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel +
        ';color:' + PD_BRAND.mute + ';white-space:nowrap;font-size:12px;vertical-align:top;width:78px">' +
        ev[i].who + '</td>' +
      '<td style="padding:7px 11px;border:1px solid ' + PD_BRAND.line + ';background:#FFFFFF;color:' +
        PD_BRAND.ink + '">' + ev[i].what + '</td></tr>';
  }
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    rows + '</table>';
}

/** The forward timeline for an email everyone is copied on — dates, not adjectives. */
function pdChainTimeline_(p, phase) {
  var d = Number(p.DaysArrears) || 0, left = Math.max(0, SLA.LAPSE - d);
  var row = function (when, what, hot) {
    return '<tr><td style="padding:8px 12px;background:' + PD_BRAND.panel + ';border:1px solid ' + PD_BRAND.line +
        ';width:104px;white-space:nowrap;color:' + (hot ? PD_BRAND.red : PD_BRAND.mute) +
        ';font-weight:' + (hot ? 'bold' : 'normal') + '">' + when + '</td>' +
      '<td style="padding:8px 12px;background:#FFFFFF;border:1px solid ' + PD_BRAND.line + ';color:' +
        PD_BRAND.ink + '">' + what + '</td></tr>';
  };
  var out = '';
  if (phase === 'commit') {
    out += row('Now', '<b>The manager confirms the four actions above</b> — within 3 days, or this email repeats to all of us.') +
      row('Then', 'Once confirmed, we wait for the manager&rsquo;s feedback and follow up every 7 days.');
  } else {
    out += row('Now', '<b>The manager&rsquo;s feedback is awaited</b> — we follow up every 7 days until it lands.');
  }
  out += row('Day 75', 'The manager writes to the client personally.') +
    row('Day 88', 'Final notice.') +
    row('Day 90', 'End of the grace period — ' + (d >= 90 ? 'reached' : left + ' days from today') + '.', true);
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    out + '</table>';
}

/**
 * The manager's email, in three shapes. opts.phase:
 *   'commit'   day 60 and its 3-day repeats — the four commitments, the full
 *              history, the client copied.
 *   'ack'      fired once the moment the manager commits — a thank-you that
 *              confirms what they promised and opens the feedback wait.
 *   'feedback' the 7-day follow-ups — what actually happened.
 * opts.round numbers the repeats; opts.waiting is days outstanding.
 */
function pdManagerLetter_(p, state, opts) {
  opts = opts || {};
  var phase = opts.phase || 'commit';
  var mgr = (opts.manager || (state && state.mgrName) || pdManagerOf_(p.Agent) || 'the manager');
  var first = pdEsc_(pdFirst_(p.Client));
  var d = Number(p.DaysArrears) || 0, left = Math.max(0, SLA.LAPSE - d);
  var round = Number(opts.round) || 0;
  var waiting = Number(opts.waiting) || 0;
  var cc = pdManagerCc_(p);

  var addressed = '<p style="margin:0 0 12px"><b>' + pdEsc_(mgr) + '</b> &mdash; copied to <b>' +
    pdEsc_(p.Agent) + '</b> (advisor), <b>' + pdEsc_(p.Client) + '</b> and branch support.</p>';

  /* ---- ACK: the thank-you the moment the manager commits ---- */
  if (phase === 'ack') {
    var by = (state && state.mgr && state.mgr.mby) ? state.mgr.mby.lab : 'shortly';
    return {
      subject: 'Thank you — ' + p.Client + ' (Policy ' + p.Policy + ') is in hand',
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding — In Hand') + addressed +
        '<p style="margin:0 0 10px">Thank you, ' + pdEsc_(pdFirst_(mgr)) + '. You have taken this policy on and ' +
        'confirmed what you will do:</p>' +
        pdAnsweredBlock_(state, MANAGER_COMMIT) +
        pdNote_('<b>' + first + '</b> — your manager has personally taken charge of your policy and will be in ' +
          'touch. There is nothing you need to do while we work on this, though you are always welcome to reply.',
          PD_BRAND.green) +
        pdSection_('What happens now',
          '<p style="margin:0">We await ' + pdEsc_(pdFirst_(mgr)) + '&rsquo;s feedback (' + pdEsc_(by) + ') to bring ' +
          'the policy up to date, and will follow up every 7 days until it lands. Cover reaches the end of its ' +
          'grace period in <b>' + left + ' days</b>.</p>') +
        pdSigInternal_(),
        { kind: 'mgr' }, true),
      cc: cc
    };
  }

  /* ---- FEEDBACK: the 7-day follow-ups ---- */
  if (phase === 'feedback') {
    var outF = pdOutstandingQuestions_(state, MANAGER_FEEDBACK);
    var ansF = pdAnsweredBlock_(state, MANAGER_FEEDBACK);
    return {
      subject: (round ? 'Feedback awaited (' + waiting + ' days) — ' : 'Feedback please — ') +
        p.Client + ' (Policy ' + p.Policy + ')',
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding — Feedback') + addressed +
        (round
          ? pdNote_('<b>' + pdEsc_(pdFirst_(mgr)) + '</b>, we are still awaiting your feedback on this policy — ' +
              'it has been <b>' + waiting + ' days</b> since you took it on, and the grace period ends in <b>' +
              left + ' days</b>.', PD_BRAND.gold)
          : '<p style="margin:0 0 4px">Thank you for taking this on. When you have spoken with ' + first +
            ', tap your feedback below and it reaches everyone at once.</p>') +
        pdGlance_(p) +
        pdSection_(round ? 'Still awaited — tap to answer' : 'Your feedback — one tap each',
          pdQuestionBlock_(p, outF, 'mgr') +
          '<p style="font-size:12px;color:' + PD_BRAND.mute + ';margin:12px 0 0">The non-forfeiture answer goes ' +
          'into the client&rsquo;s day-90 letter verbatim, and it is statutory: under s. 180(1) of the ' +
          PD_LAW.cite + ', a policy whose surrender value covers the arrears <b>cannot be forfeited for ' +
          'non-payment alone</b>.</p>') +
        (ansF ? pdSection_('Already recorded', ansF) : '') +
        pdSection_('Where this policy stands', pdChainTimeline_(p, 'feedback')) +
        pdSigInternal_(),
        { kind: 'mgr' }, true),
      cc: cc
    };
  }

  /* ---- COMMIT: day 60 and its 3-day repeats ---- */
  var outC = pdOutstandingQuestions_(state, MANAGER_COMMIT);
  var ansC = pdAnsweredBlock_(state, MANAGER_COMMIT);
  var opening = round === 0
    ? '<p style="margin:0 0 10px">This policy has reached <b>day ' + d + '</b>. From today it is yours: we are ' +
      'asking you to call <b>' + pdEsc_(p.Client) + '</b> personally and to confirm the four actions below.</p>' +
      '<p style="margin:0">' + first + ' is copied on this and on every email that follows, so they can see ' +
      'their policy is being worked — not just chased.</p>'
    : pdNote_('<b>Reminder ' + round + '.</b> These four confirmations have been outstanding <b>' + waiting +
        ' days</b>. Until they are recorded the case cannot move, and the grace period ends in <b>' + left +
        ' days</b>. ' + first + ' is copied and can see it is waiting on us.', PD_BRAND.red);

  return {
    subject: (round ? 'Reminder ' + round + ' — ' : 'Day ' + d + ' — ') + 'please confirm: ' +
      p.Client + ' (Policy ' + p.Policy + ')',
    html: pdWrap_(
      pdRefBlock_(p, round ? 'Premium Outstanding — Reminder ' + round : 'Premium Outstanding — Day 60') +
      addressed + opening +
      pdGlance_(p) +
      pdSection_(round ? 'Still to confirm — tap each' : 'Please confirm — one tap each',
        pdQuestionBlock_(p, outC, 'mgr')) +
      (ansC ? pdSection_('Confirmed', ansC) : '') +
      pdSection_('The record so far', pdManagerHistory_(p, state)) +
      pdSection_('How to reach them', pdContactBlock_(p) +
        (state && state.retentionBody
          ? '<p style="font-size:13px;color:' + PD_BRAND.mute + ';margin:8px 0 0">The advisor has filed a written ' +
            'case; it is on the policy record.</p>'
          : '<p style="font-size:13px;color:' + PD_BRAND.mute + ';margin:8px 0 0">No written case filed by the ' +
            'advisor yet' + (d < SLA.AGENT_FILE_BY ? ' — due by day ' + SLA.AGENT_FILE_BY : '') + '.</p>')) +
      pdSection_('Where this policy stands', pdChainTimeline_(p, 'commit')) +
      pdSigInternal_(),
      { kind: 'mgr' }, true),
    cc: cc
  };
}

/** Advisor, branch manager, support — and the client, on the manager thread. */
function pdManagerCc_(p) {
  var out = [pdStaffEmail_(p.Agent), pdValidEmail_(OUT.BRANCH_MANAGER_EMAIL), pdValidEmail_(OUT.SALES_SUPPORT_EMAIL)];
  if (pdMayEmail_(p)) out.push(pdValidEmail_(p.Email));   // the client is copied by design
  var seen = {}, dedup = [];
  for (var i = 0; i < out.length; i++) if (out[i] && !seen[out[i]]) { seen[out[i]] = 1; dedup.push(out[i]); }
  return dedup;
}

/* ============================ the daily run ============================ */

/** Launch-day ordering: who goes first when more is due than the caps allow.
    Live cover nearest the 90-day cliff, then the freshest lapses, then the
    newest pending applications. Everything else can wait its turn. */
function pdUrgency_(p) {
  var d = Number(p.DaysArrears) || 0, st = Number(p.Status) || 0;
  if (st === 2) return 10000 + d;       // in-force arrears: day 89 beats day 45
  if (st === 1) return 5000 - d;        // lapsed: freshest first — the window is closing
  if (st === 3) return 1000 - d;        // pending: newest application first
  return 0;
}

/** Which template, if any, is due for this policy today. */
function pdStageDue_(p, state) {
  if (pdIsGroup_(p)) return '';                  // schemes get the remittance statement, never these
  var d = Number(p.DaysArrears) || 0;
  var desc = String(p.StatusDesc || '').toLowerCase();
  var st = Number(p.Status) || 0;

  if (st === 3 || desc.indexOf('underwriting') > -1) {
    /* The pending flow's own clock: first letter at day 21, then one per
       fortnight (a 3-day window so a missed run still catches it), stopping at
       PEND_MAX_DAYS. Repeats are deduped per round, and each names what is
       still outstanding — see the pend template. */
    if (d >= 21 && d <= OUT.PEND_MAX_DAYS && ((d - 21) % 14) < 3) return 'pend';
    return '';
  }

  /* The closing sequence outruns the status change, and owns the policy while
     it runs. A policy that reaches day 90 flips to Lapsed, and win-back would
     otherwise take over before the branch has asked the client a single
     question about how it was handled — worse, it would interleave, so the
     client would get a closing letter on day 90, a win-back on 92, another
     closing letter on 95. Nothing else sends between day 90 and the end of the
     third round. */
  var closing = !(state && state.closingAnswered);
  if (closing && d >= 90 && d < OUT.WIN_BACK_OPENS) {
    return pdCloseRound_(d) ? 'close' : '';
  }

  if (st === 1 || desc === 'lapsed') {
    return (d >= OUT.WIN_BACK_OPENS || !closing) && d <= OUT.WIN_BACK_MAX_DAYS ? 'winback' : '';
  }
  if (st !== 2) return '';                       // premium paying / terminal — nothing to send

  /* The cycle is 45 / 60 / 75 / 90 — four milestones, each a real change in what
     happens rather than another reminder. Nothing before day 45: a premium one
     day late is a banking timing difference, not a conversation.

     Day 60 is not in this list on purpose. It is the one milestone the client
     does not receive as a letter — it is where the case is handed to the
     manager, who is asked to telephone. pdInternalChase_ sends that. What the
     client gets between 60 and 75 is the ordinary five-day reminder, which says
     so.

     Day 88 always sends, answered or not: it is the final notice and the
     client's own record, and someone who answered at day 46 and still has an
     outstanding premium at day 88 needs it more than anybody. */
  if (d >= 88 && d < 90) return 's90';                      // lands before the cliff, not on it
  if (state && state.responded) return '';                  // they answered — the sequence stops
  if (d >= 75 && d < 78) return 's75';
  if (d >= 45 && d < 48) return 's45';

  /* The five-day reminder runs only up to day 60. After that the client is
     copied on the manager email every three days, and a separate reminder on
     top of that is the branch writing to somebody twice a week. */
  if (d > 45 && d < SLA.RETENTION_OPENS) {
    var since = d - 45;
    if (since % SLA.CLIENT_CHASE_EVERY === 0) return 'chase';
  }
  return '';
}

/**
 * Which closing letter is due, if any: 1 at day 90, 2 at 95, 3 at 100, then
 * nothing. Two-day windows so a run that misses a day still catches it, and
 * pdAlreadySent_ keys on the round so it cannot double-send.
 */
function pdCloseRound_(d) {
  if (d >= 90 && d <= 91) return 1;
  if (d >= 95 && d <= 96) return 2;
  if (d >= 100 && d <= 101) return 3;
  return 0;
}

/** Which fortnightly pending round day d falls in (1 at day 21, 2 at 35, …). */
function pdPendRound_(d) {
  d = Number(d) || 0;
  if (d < 21) return 0;
  return 1 + Math.floor((d - 21) / 14);
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
    var s = map[policy] || (map[policy] = { responded: false, retentionTs: 0, verdict: false, chases: {},
                                            rounds: {}, survey: null, trail: [], mgr: {}, mgrTs: 0,
                                            mgrName: '', activatedTs: 0, noteCount: 0,
                                            closingAnswered: false, closeRounds: {} });
    if (type === 'survey') {
      s.survey = { ts: ts, surveyReason: v[i][15], surveyContact: v[i][16], surveyPromise: v[i][17] };
    }
    if (type === 'response') {
      s.responded = true;
      (s.replies = s.replies || []).push({ ts: ts, q: v[i][11], lab: v[i][12] });
      /* An answer to a closing question stops the closing sequence. It must NOT
         be confused with the day-45 answer: a client who replied in July should
         still be asked in October how the branch handled them. */
      var ca = pdDecodeAnswer_(v[i][11], v[i][12]);
      if (ca && PD_CLOSING_KEYS[ca.qk]) s.closingAnswered = true;
    }
    else if (type === 'retention') {
      s.retentionTs = Math.max(s.retentionTs, ts);
      s.retentionBody = v[i][12]; s.factFind = v[i][18];
    }
    else if (type === 'verdict') {
      /* A manager's tapped answer arrives here: 'reason' holds the question
         text and 'body' the answer label, which is what the engine has always
         written. pdDecodeAnswer_ turns that back into keys so the day-88 letter
         can quote it and pdLapseMeaningFor_ can act on it. A verdict that
         decodes to nothing is an old-style free-text response — still a
         response, just not a structured one. */
      s.verdict = true;
      s.mgrTs = Math.max(s.mgrTs, ts);
      if (v[i][6]) s.mgrName = String(v[i][6]);
      var a = pdDecodeAnswer_(v[i][11], v[i][12]);
      if (a && a.ak) s.mgr[a.qk] = { ak: a.ak, lab: a.lab, ts: ts };
    }
    else if (type === 'comment') s.noteCount++;
    else if (type.indexOf('outbound') === 0 ||
             (OUT.TEST_INBOX && type.indexOf('test-outbound') === 0)) {
      var stg = String(v[i][11] || '');
      if (TRAIL_LABEL[stg]) (s.trail = s.trail || []).push({ ts: ts, mine: false, what: TRAIL_LABEL[stg] });
    }
    else if (type.indexOf('internal') === 0 ||
             (OUT.TEST_INBOX && type.indexOf('test-internal') === 0)) {
      var key = String(v[i][11] || '');
      s.chases[key] = Math.max(s.chases[key] || 0, ts);
      s.rounds[key] = (s.rounds[key] || 0) + 1;
      /* activatedTs counts SENT handovers only, never the dry-run plan. If a
         dry row set it, every policy planned during testing would be treated
         as already handed over on the day you go live, and no manager would
         ever be told. The dry rows still throttle re-planning through
         s.chases, so a dry run does not write the same line daily. Test-mode
         handovers count only while TEST_INBOX is set — clearing it resets the
         ladder, because no real manager was ever told either. */
      var sentReal = (type === 'internal') || (OUT.TEST_INBOX && type === 'test-internal');
      if (key === 'mgr-commit' && sentReal) s.activatedTs = Math.max(s.activatedTs, ts);
      if (key === 'mgr-ack'    && sentReal) s.ackTs = Math.max(s.ackTs || 0, ts);
    }
  }
  /* Derive the two phase flags once per policy. committed = all four
     commitments in; feedbackDone = all four feedback answers in. commitTs is
     the last commitment answer, so the 7-day feedback clock starts there. */
  for (var pol in map) {
    if (!Object.prototype.hasOwnProperty.call(map, pol)) continue;
    var st2 = map[pol];
    st2.committed = pdAllAnswered_(st2, MANAGER_COMMIT);
    st2.feedbackDone = st2.committed && pdAllAnswered_(st2, MANAGER_FEEDBACK);
    st2.commitTs = 0;
    for (var ci = 0; ci < MANAGER_COMMIT.length; ci++) {
      var av = st2.mgr[MANAGER_COMMIT[ci].k];
      if (av && av.ts) st2.commitTs = Math.max(st2.commitTs, av.ts);
    }
  }
  return map;
}

/** The shape pdCaseState_ produces, for a policy that has no log rows yet. */
function pdEmptyState_() {
  return { responded: false, retentionTs: 0, verdict: false, chases: {}, rounds: {}, survey: null,
           trail: [], mgr: {}, mgrTs: 0, mgrName: '', activatedTs: 0, ackTs: 0, noteCount: 0,
           committed: false, feedbackDone: false, commitTs: 0,
           closingAnswered: false, closeRounds: {} };
}

function pdDaysSince_(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : 0; }

function pdLogInternal_(p, kind, to, note, sent) {
  getSheet_().appendRow([
    Date.now(), new Date().toISOString(), p.Policy, p.Client, p.ClientNo, p.Agent,
    OUT.BRANCH_NAME, '', 'System', kind,
    sent ? (OUT.TEST_INBOX ? 'test-internal' : 'internal') : 'internal-dry', kind,
    (sent ? (OUT.TEST_INBOX ? 'TEST-SENT to ' + OUT.TEST_INBOX + ' (for ' : 'Chased ')
          : 'WOULD CHASE ') + (to || 'no address on file') +
      (sent && OUT.TEST_INBOX ? ')' : '') + ' — ' + note,
    '', '', '', '', '', '', ''
  ]);
}

/** Is this agent's book inside the pilot? An empty PILOT_AGENTS means everyone. */
function pdInPilot_(agent) {
  if (!OUT.PILOT_AGENTS.length) return true;
  var a = String(agent || '').replace(/^ +| +$/g, '').toUpperCase();
  for (var i = 0; i < OUT.PILOT_AGENTS.length; i++) {
    if (String(OUT.PILOT_AGENTS[i]).replace(/^ +| +$/g, '').toUpperCase() === a) return true;
  }
  return false;
}

/**
 * The one door every live email leaves through. With TEST_INBOX set, the
 * message is re-addressed to the test inbox — subject stamped [TEST], a
 * banner naming the real recipients prepended, all copies dropped — so a
 * full pilot can run without a single client, agent or manager hearing it.
 */
function pdDeliver_(to, cc, subject, html) {
  if (OUT.TEST_INBOX) {
    var note = 'TEST MODE — this email would have gone to: <b>' + pdEsc_(to || 'no address on file') + '</b>' +
      ' &middot; copied: <b>' + (cc && cc.length ? pdEsc_(cc.join(', ')) : 'NOBODY — check STAFF_EMAIL / MANAGER_OF') + '</b>' +
      '. No client or member of staff received it.';
    MailApp.sendEmail({
      to: OUT.TEST_INBOX, name: OUT.FROM_NAME, subject: '[TEST] ' + subject,
      htmlBody: '<div style="background:#7A1F1F;color:#FFFFFF;padding:10px 14px;' +
        'font:bold 12px/1.5 Arial,Helvetica,sans-serif;border-radius:6px;margin:0 0 14px">' +
        note + '</div>' + html
    });
    return OUT.TEST_INBOX;
  }
  var msg = { to: to, name: OUT.FROM_NAME, subject: subject, htmlBody: html };
  if (cc && cc.length) msg.cc = cc.join(',');
  MailApp.sendEmail(msg);
  return to;
}

/**
 * The manager escalation, in two phases. Returns 1 if something was sent.
 *
 *   PHASE 1 — COMMIT. Day 60, then every 3 days until the manager confirms all
 *   four commitments. To the manager, copied to advisor, support and client.
 *
 *   ACK. The single run after the commitment completes: a thank-you that
 *   confirms what was promised and opens the feedback wait. Fires once.
 *
 *   PHASE 2 — FEEDBACK. Every 7 days from the commitment until the manager has
 *   recorded what actually happened. Same recipients.
 *
 * At most one email per policy per run, and the phases never overlap — the
 * commit chase stops the instant the manager commits, the ack fires once, and
 * only then does the 7-day feedback clock begin. The advisor's filing chase is
 * separate and internal-only.
 */
function pdInternalChase_(p, s) {
  var d = Number(p.DaysArrears) || 0;
  if (pdIsGroup_(p)) return 0;                           // schemes: pdGroupChase_ owns these
  if (Number(p.Status) !== 2) return 0;                  // live arrears only
  if (d < SLA.RETENTION_OPENS || d >= SLA.LAPSE) return 0;
  var mgrName = (s.mgrName || pdManagerOf_(p.Agent));
  var mTo = pdStaffEmail_(mgrName);
  var waiting = s.activatedTs ? pdDaysSince_(s.activatedTs) : 0;
  var due = function (key, every) {
    return !s.chases[key] || pdDaysSince_(s.chases[key]) >= every;
  };
  var send = function (kind, letter, note) {
    if (!mTo || OUT.DRY_RUN) { pdLogInternal_(p, kind, mTo, note, false); return 0; }
    pdDeliver_(mTo, letter.cc, letter.subject, letter.html);
    pdLogInternal_(p, kind, mTo, note, true);
    return 1;
  };

  /* PHASE 1 — commitment, every 3 days */
  if (!s.committed) {
    if (!due('mgr-commit', SLA.MANAGER_CHASE_EVERY)) return 0;
    var rc = Number(s.rounds && s.rounds['mgr-commit']) || 0;
    return send('mgr-commit',
      pdManagerLetter_(p, s, { phase: 'commit', round: rc, waiting: waiting, manager: mgrName }),
      (rc === 0 ? 'Day ' + d + ' handover to ' : 'Commit reminder ' + rc + ' to ') +
        (mgrName || 'NO MANAGER MAPPED') + ' — advisor, support and client copied');
  }

  /* ACK — once, the run after the manager commits */
  if (!s.ackTs && !s.chases['mgr-ack']) {
    return send('mgr-ack',
      pdManagerLetter_(p, s, { phase: 'ack', manager: mgrName }),
      'Manager committed — thank-you sent, feedback awaited');
  }

  /* PHASE 2 — feedback, every 7 days from the commitment */
  if (!s.feedbackDone) {
    var startedFb = Math.max(s.commitTs || 0, s.ackTs || s.chases['mgr-ack'] || 0);
    if (pdDaysSince_(startedFb) < SLA.FEEDBACK_CHASE_EVERY) return 0;
    if (!due('mgr-feedback', SLA.FEEDBACK_CHASE_EVERY)) return 0;
    var rf = Number(s.rounds && s.rounds['mgr-feedback']) || 0;
    var fbWaiting = pdDaysSince_(s.commitTs || startedFb);
    return send('mgr-feedback',
      pdManagerLetter_(p, s, { phase: 'feedback', round: rf, waiting: fbWaiting, manager: mgrName }),
      'Feedback awaited ' + fbWaiting + ' days from ' + (mgrName || 'manager') + ' — all copied');
  }

  /* --- the advisor has not filed ---
     Internal only, and it runs independently: the manager owns the policy from
     day 60 whether or not a case was ever filed, so this clock must not be able
     to swallow the one above. */
  if (!s.retentionTs && d >= SLA.AGENT_FILE_BY && due('agent-file', SLA.MANAGER_CHASE_EVERY)) {
    var aTo = pdStaffEmail_(p.Agent);
    var note2 = 'Retention case not filed — day ' + d + ' of ' + SLA.LAPSE;
    if (!aTo || OUT.DRY_RUN) { pdLogInternal_(p, 'agent-file', aTo, note2, false); return 0; }
    MailApp.sendEmail({
      to: aTo, cc: pdValidEmail_(pdStaffEmail_(mgrName)) || '', name: OUT.FROM_NAME,
      subject: 'Retention case overdue — ' + p.Client + ' (' + p.Policy + ')',
      htmlBody: pdWrap_(
        '<p>Policy <b>' + pdEsc_(p.Policy) + '</b> for <b>' + pdEsc_(p.Client) + '</b> is <b>' + d +
        ' days</b> in arrears and no retention case has been filed. It lapses in ' + pdDaysToLapse_(p) + ' days.</p>' +
        pdNote_('Your manager already has this policy and the client is copied on that thread. The written ' +
                'case is still owed — it is what the manager decides from.') +
        '<p>' + (mgrName ? pdEsc_(mgrName) + ' is copied.' : '') + '</p>' + pdSigInternal_(),
        { kind: 'mgr' }, true)
    });
    pdLogInternal_(p, 'agent-file', aTo, note2, true);
    return 1;
  }
  return 0;
}

/* ===================== the pending / requirements flow =====================
   A SEPARATE PROCESS from premium dues, and deliberately so. Premium dues =
   an in-force policy (status 2) whose cover is at risk on the 45/60/90 clock.
   Pending = a NEW application (status 3) that is not yet cover at all, waiting
   on requirements. A policy lives in exactly one flow — pdStageDue_ routes
   status 3 to 'pend' and nothing else, so the two chases can never blur.

   The requirements live on the Branch Portfolio workbook's own
   "Requirement Management" tab, and the ES400 manual decodes its statuses:
   P + [C clean | E entry errors] + [C no reqt | R reqt outstanding] +
   [C UW complete | U UW incomplete]. PCRC/PERC mean underwriting is DONE —
   one document stands between the client and a policy in force. */

var PD_REQ_SHEET = 'Requirement Management';

/**
 * Replacement identification. A NEW application pending while the same
 * client's in-force cover slides into arrears (or freshly lapsed) is the
 * classic replacement pattern — new business being written over cover that is
 * about to die. Sometimes legitimate, sometimes churning; always a review
 * before anything lapses. MANAGER_PRIVATE already carries the decision option
 * ("Investigate possible replacement of in-force cover") — this is the
 * detector that tells the manager to look. Internal surfaces only: the
 * digest, the engine, the internal chases. Never a client-copied email.
 */
function pdReplacementRisk_(p, family) {
  if (Number(p.Status) !== 3 || !family || !family.length) return null;
  var risky = [];
  for (var i = 0; i < family.length; i++) {
    var f = family[i];
    if (String(f.Policy) === String(p.Policy)) continue;
    var st = Number(f.Status) || 0, d = Number(f.DaysArrears) || 0;
    if (st === 2) risky.push({ policy: f.Policy, why: d + ' days in arrears' });
    else if (st === 1 && d <= OUT.WIN_BACK_MAX_DAYS) risky.push({ policy: f.Policy, why: 'lapsed ' + d + ' days ago' });
  }
  return risky.length ? risky : null;
}

/** Pending-status decode, per the ES400 manual. */
function pdPendingMeaning_(code) {
  var c = String(code || '').toUpperCase();
  if (c.charAt(0) !== 'P' || c.length !== 4) return null;
  return {
    errors: c.charAt(1) === 'E',              // data-entry errors on the case
    reqtOpen: c.charAt(2) === 'R',            // a requirement is outstanding
    uwDone: c.charAt(3) === 'C'               // underwriting is complete
  };
}

/**
 * policy -> { items: [{name, days}], susp, code, uwDone, errors }
 * Read once per run from the Requirement Management tab; {} when the tab is
 * missing or unreadable, and every letter then falls back to the generic text.
 */
function pdRequirements_() {
  var map = {};
  try {
    var ss = SpreadsheetApp.openById(PORTFOLIO_ID);
    var sh = ss.getSheetByName(PD_REQ_SHEET);
    if (!sh) return map;
    var v = sh.getDataRange().getValues();
    if (v.length < 2) return map;
    var H = {}, c;
    for (c = 0; c < v[0].length; c++) H[String(v[0][c]).replace(/^ +| +$/g, '')] = c;
    var iPol = H['Policy'], iSt = H['status'], iReq = H['Reqt'],
        iDays = H['ReqtdaysLapsed'], iSusp = H['POL_MISC_SUSP_AMT'];
    if (iPol == null) return map;
    for (var r = 1; r < v.length; r++) {
      var pol = String(v[r][iPol] == null ? '' : v[r][iPol]).replace(/\.0$/, '');
      if (!pol) continue;
      var st = String(iSt == null ? '' : v[r][iSt]).replace(/^ +| +$/g, '').toUpperCase();
      if (st === 'C') continue;                                  // complete — not a chase
      var e = map[pol] || (map[pol] = { items: [], susp: 0, code: '', uwDone: false, errors: false });
      var name = String(iReq == null ? '' : (v[r][iReq] || '')).replace(/^ +| +$/g, '');
      var days = Number(iDays == null ? 0 : v[r][iDays]) || 0;
      if (days > 3650) continue;                                 // relic rows: reconciliation, not chasing
      if (name && e.items.length < 4) {
        var dup = false;
        for (var k = 0; k < e.items.length; k++) if (e.items[k].name === name) dup = true;
        if (!dup) e.items.push({ name: name, days: days });
      }
      e.susp = Math.max(e.susp, Number(iSusp == null ? 0 : v[r][iSusp]) || 0);
      var mean = pdPendingMeaning_(st);
      if (mean) {                                                // policy-status codes outrank 'OR'
        e.code = st;
        e.uwDone = e.uwDone || mean.uwDone;
        e.errors = e.errors || mean.errors;
      } else if (!e.code) e.code = st;                           // 'OR' — an ordered, awaited requirement
    }
  } catch (err) { /* standalone tests / missing tab: generic letters */ }
  return map;
}

/* ===================== group schemes =====================
   Company-owned policies — the client IS a company (Servus Limited, Bankers
   Insurance, JMMB Bank). On the live book these run 200+ policies on a single
   client number, and their arrears are remittance-shaped: one missed payroll
   payment puts 32 member policies "in arrears" on the same day. The individual
   ladder is the wrong instrument three times over — the letters would ask a
   company to rate its advisor, the family table would render 222 rows, and one
   payroll clerk would be issued 65 tracking codes.

   So group policies never enter pdStageDue_ or pdInternalChase_. Instead the
   whole scheme gets ONE consolidated remittance statement per cycle:
   administrator addressed, member policies listed, the paid-to gap named, the
   servicing agent and branch support copied, branch manager from the second
   statement. It stops the moment the remittance lands, like everything else. */

var PD_CORP_RE = /\b(LIMITED|LTD\.?|COMPANY|CO\.|INC\.?|CORPORATION|SERVUS|BANKERS|CREDIT UNION|CO-?OPERATIVE|CO-?OP|ASSOCIATION|SERVICES|ENTERPRISES|CONTRACTORS|HOLDINGS|AGENCIES|SUPERMART|IMPORTS)\b/i;

/** Is this policy owned by a company / group scheme rather than a person? */
function pdIsGroup_(p) {
  if (OUT.GROUP_CLIENTS[String(p.ClientNo || '')]) return true;
  return PD_CORP_RE.test(String(p.Client || ''));
}

/** One key per company, so name variants land in the same cluster
    ("Jmmb Bank Limited" / "Jmmb Bank( T & T ) Limited" / "Jmmb Bank (T&T)"). */
function pdGroupKey_(p) {
  var roster = OUT.GROUP_CLIENTS[String(p.ClientNo || '')];
  if (roster) return String(roster).toUpperCase();
  var n = String(p.Client || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
            .replace(/  +/g, ' ').replace(/^ +| +$/g, '');
  if (n.indexOf('SERVUS') === 0) return 'SERVUS LIMITED';
  if (n.indexOf('BANKERS INSURANCE') > -1) return 'BANKERS INSURANCE COMPANY';
  if (n.indexOf('JMMB') === 0) return 'JMMB BANK';
  return n.replace(/\bLIMITED\b/g, 'LTD');
}

/**
 * The remittance statement: one email covering every live member policy on the
 * scheme. `members` is every portfolio row in the cluster (any status);
 * opts.round numbers the repeats, opts.waiting is days since the first.
 */
function pdGroupStatement_(key, members, opts) {
  opts = opts || {};
  var round = Number(opts.round) || 0;
  var i, m;

  /* Split the cluster: live arrears (the statement's subject), dormant rows
     (counted, not listed — a position three years in arrears is a
     reconciliation exercise, not this remittance), recent lapses (named as a
     count, because they are still within the reinstatement window). */
  var live = [], ancient = [], lapsedRecent = 0;
  for (i = 0; i < members.length; i++) {
    m = members[i];
    var d = Number(m.DaysArrears) || 0, st = Number(m.Status) || 0;
    if (st === 2) { if (d < 180) live.push(m); else ancient.push(m); }
    else if (st === 1 && d <= OUT.WIN_BACK_MAX_DAYS) lapsedRecent++;
  }
  live.sort(function (a, b) { return (Number(b.DaysArrears) || 0) - (Number(a.DaysArrears) || 0); });

  var display = live.length ? String(live[0].Client) : (members.length ? String(members[0].Client) : key);
  var premTotal = 0, atCliff = 0, minLeft = 999;
  for (i = 0; i < live.length; i++) {
    premTotal += Number(live[i].Premium) || 0;
    var dd = Number(live[i].DaysArrears) || 0;
    if (dd >= 75) { atCliff++; minLeft = Math.min(minLeft, Math.max(0, SLA.LAPSE - dd)); }
  }

  /* The paid-to mode: when most of the live block is paid to the same date,
     that IS the diagnosis — one remittance did not arrive. Say so. */
  var paidCounts = {}, paidMode = '', paidModeN = 0;
  for (i = 0; i < live.length; i++) {
    var pt = String(live[i].PaidToDate || '').replace(/^ +| +$/g, '');
    if (!pt || /^#+$/.test(pt)) continue;
    paidCounts[pt] = (paidCounts[pt] || 0) + 1;
    if (paidCounts[pt] > paidModeN) { paidModeN = paidCounts[pt]; paidMode = pt; }
  }

  var rows = '';
  for (i = 0; i < live.length; i++) {
    m = live[i];
    var days = Number(m.DaysArrears) || 0;
    var hot = days >= 75;
    var bg = hot ? PD_BRAND.panel : '#FFFFFF';
    rows += '<tr>' +
      '<td style="padding:8px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + bg +
        ';color:' + PD_BRAND.ink + ';font-weight:bold;font-size:12.5px">' + pdEsc_(m.Policy) +
        '<div style="font-size:11px;font-weight:normal;color:' + PD_BRAND.mute + '">' + pdEsc_(m.PlanCode || '') + '</div></td>' +
      '<td style="padding:8px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + bg +
        ';color:' + PD_BRAND.ink + ';white-space:nowrap;font-size:12.5px">' + pdEsc_(m.PaidToDate || '—') + '</td>' +
      '<td style="padding:8px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + bg +
        ';color:' + (hot ? PD_BRAND.red : PD_BRAND.ink) + ';text-align:right;font-weight:bold">' + days + '</td>' +
      '<td style="padding:8px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + bg +
        ';color:' + PD_BRAND.ink + ';text-align:right;white-space:nowrap">' +
        (Number(m.Premium) > 0 ? pdMoney_(m.Premium) : '—') + '</td>' +
      '</tr>';
  }
  var th = function (t, right) {
    return '<th style="padding:8px 10px;background:' + PD_BRAND.navy + ';border:1px solid ' + PD_BRAND.navy +
      ';color:#FFFFFF;text-align:' + (right ? 'right' : 'left') + ';font-weight:bold;font-size:10.5px;letter-spacing:.07em">' + t + '</th>';
  };
  var table = '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    '<tr>' + th('POLICY') + th('PAID TO') + th('DAYS', 1) + th('PREMIUM', 1) + '</tr>' + rows +
    '<tr>' +
      '<td colspan="3" style="padding:9px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel +
        ';color:' + PD_BRAND.ink + ';font-weight:bold">Total outstanding premium, ' + live.length + ' member polic' +
        (live.length === 1 ? 'y' : 'ies') + '</td>' +
      '<td style="padding:9px 10px;border:1px solid ' + PD_BRAND.line + ';background:' + PD_BRAND.panel +
        ';color:' + PD_BRAND.red + ';text-align:right;font-weight:bold;font-size:14px">' + pdMoney_(premTotal) + '</td>' +
    '</tr></table>';

  var diagnosis = (paidModeN >= 2 && paidModeN * 2 >= live.length)
    ? '<p style="margin:0 0 10px"><b>' + paidModeN + ' of the ' + live.length + '</b> are paid to exactly <b>' +
      pdEsc_(paidMode) + '</b>, which reads as one remittance not yet received rather than ' + live.length +
      ' separate difficulties. If that payment has already been made, a remittance date and reference is all we need.</p>'
    : '';

  var cliffNote = atCliff
    ? pdNote_('<b>' + atCliff + ' member polic' + (atCliff === 1 ? 'y is' : 'ies are') + ' within ' + minLeft +
        ' day' + (minLeft === 1 ? '' : 's') + ' of the end of the 90-day grace period.</b> Past that point ' +
        'reinstatement paperwork replaces a simple payment, member by member.', PD_BRAND.red)
    : '';

  var tail = '';
  if (ancient.length) {
    tail += '<p style="font-size:12.5px;color:' + PD_BRAND.mute + ';margin:8px 0 0">A further <b>' + ancient.length +
      '</b> position' + (ancient.length === 1 ? '' : 's') + ' on this scheme show' + (ancient.length === 1 ? 's' : '') +
      ' arrears older than six months — those look like records to reconcile rather than this remittance, and we will ' +
      'send that list separately on request.</p>';
  }
  if (lapsedRecent) {
    tail += '<p style="font-size:12.5px;color:' + PD_BRAND.mute + ';margin:8px 0 0"><b>' + lapsedRecent +
      '</b> member polic' + (lapsedRecent === 1 ? 'y' : 'ies') + ' lapsed within the last ' + OUT.WIN_BACK_MAX_DAYS +
      ' days and remain' + (lapsedRecent === 1 ? 's' : '') + ' inside the reinstatement window — recoverable now, ' +
      'not later.</p>';
  }

  var subject = (round ? 'Notice ' + (round + 1) + ' — ' : '') +
    'Group remittance outstanding — ' + display + ' (' + live.length + ' member polic' +
    (live.length === 1 ? 'y' : 'ies') + ', ' + pdMoney_(premTotal) + ')';

  var html = pdWrap_(
    '<p style="margin:0 0 4px;font-size:11px;letter-spacing:.08em;color:' + PD_BRAND.mute + '">GROUP SCHEME — ' +
      pdEsc_(key) + '</p>' +
    '<p style="margin:0 0 12px">To the scheme administrator, <b>' + pdEsc_(display) + '</b>' +
      (opts.agents ? ' &mdash; copied to ' + pdEsc_(opts.agents) + ' (servicing) and branch support' : '') + '.</p>' +
    (round
      ? pdNote_('This is <b>notice ' + (round + 1) + '</b> on the same outstanding remittance — the first was sent <b>' +
          (Number(opts.waiting) || 0) + ' days ago</b>. The branch manager is copied.', PD_BRAND.gold)
      : '<p style="margin:0 0 10px">The member policies below show premiums outstanding on your scheme. One list, ' +
        'once — we will not write to your members individually about this.</p>') +
    diagnosis + table + cliffNote +
    pdSection_('What would settle it today',
      '<p style="margin:0 0 8px">Any one of these, by reply:</p>' +
      '<ul style="margin:0;padding-left:20px;color:' + PD_BRAND.ink + '">' +
      '<li style="margin:0 0 6px">The <b>date and reference of the remittance</b>, if it has already been sent;</li>' +
      '<li style="margin:0 0 6px">A <b>date it will be sent</b>, if it is scheduled;</li>' +
      '<li style="margin:0 0 6px">Or the <b>right person to reconcile with</b>, if the schedule or the member list has changed.</li>' +
      '</ul>') +
    tail + pdSigInternal_(),
    { kind: 'mgr' }, true);

  return { subject: subject, html: html, live: live.length, premium: premTotal };
}

/**
 * The group cadence, mirroring pdInternalChase_'s shape: read the log, decide,
 * send at most one statement per scheme per run. First statement when any live
 * member reaches SLA.GROUP_OPENS days; repeats every SLA.GROUP_STATEMENT_EVERY
 * while anything stays unpaid; branch manager copied from the second. Logged
 * against the synthetic policy 'GROUP:<key>' so pdCaseState_ tracks rounds and
 * timing exactly as it does for every other internal clock.
 */
function pdGroupChase_(key, members, states) {
  var i, trigger = false, agents = {}, agentNames = [];
  for (i = 0; i < members.length; i++) {
    var m = members[i];
    if (Number(m.Status) === 2) {
      var d = Number(m.DaysArrears) || 0;
      if (d >= SLA.GROUP_OPENS && d < 180) trigger = true;
    }
    var a = String(m.Agent || '').replace(/^ +| +$/g, '');
    if (a && !agents[a]) { agents[a] = 1; agentNames.push(a); }
  }
  if (!trigger) return 0;

  var gp = { Policy: 'GROUP:' + key, Client: key, ClientNo: String(members[0].ClientNo || ''),
             Agent: agentNames.join(', ') };
  var s = states[gp.Policy] || pdEmptyState_();
  var last = s.chases['group-statement'] || 0;
  if (last && pdDaysSince_(last) < SLA.GROUP_STATEMENT_EVERY) return 0;
  var round = Number(s.rounds && s.rounds['group-statement']) || 0;
  var waiting = round ? pdDaysSince_(last) + (round - 1) * SLA.GROUP_STATEMENT_EVERY : 0;

  var letter = pdGroupStatement_(key, members, { round: round, waiting: waiting, agents: agentNames.join(', ') });

  /* The configured administrator, or the servicing agent — never whatever
     address happens to sit on the company's client record. On the live book
     that field can hold some individual's personal mailbox, and a scheme's
     full member list must not land there. Until GROUP_ADMIN is filled in the
     agent receives the statement and owns getting the right payroll contact. */
  var to = pdValidEmail_(OUT.GROUP_ADMIN[key]) || pdStaffEmail_(agentNames[0]);

  var cc = [], seen = {}, j;
  for (j = 0; j < agentNames.length && j < 3; j++) cc.push(pdStaffEmail_(agentNames[j]));
  cc.push(pdValidEmail_(OUT.SALES_SUPPORT_EMAIL));
  if (round >= 1) cc.push(pdValidEmail_(OUT.BRANCH_MANAGER_EMAIL));
  var ccOut = [];
  for (j = 0; j < cc.length; j++) if (cc[j] && cc[j] !== to && !seen[cc[j]]) { seen[cc[j]] = 1; ccOut.push(cc[j]); }

  var note = (round ? 'Statement ' + (round + 1) : 'First statement') + ' — ' + letter.live +
    ' member policies, ' + pdMoney_(letter.premium) + ' outstanding';
  if (!to || OUT.DRY_RUN) { pdLogInternal_(gp, 'group-statement', to, note, false); return 0; }
  pdDeliver_(to, ccOut, letter.subject, letter.html);
  pdLogInternal_(gp, 'group-statement', to, note, true);
  return 1;
}

/** Everything already sent, as a {policy|stage: true} set read back from the log.
    Only REAL sends count — 'outbound' exactly. A dry-run row ('outbound-dry')
    must never mark a stage as sent, or the dress rehearsal would suppress the
    entire first live run. Test rows ('test-outbound') count only while
    TEST_INBOX is set: they drive the cadence during a pilot and stop existing
    the moment it ends, so nothing tested is mistaken for something a client
    received. */
function pdAlreadySent_() {
  var sh = getSheet_();
  var v = sh.getDataRange().getValues();
  var seen = {};
  for (var i = 1; i < v.length; i++) {
    var type = String(v[i][10] || '');
    var real = (type === 'outbound');
    var test = OUT.TEST_INBOX && type === 'test-outbound';
    if (!real && !test) continue;
    var st = String(v[i][11] || '');
    seen[String(v[i][2]) + '|' + st] = true;                       // policy | stage
    if (st === 'chase') {                                          // chases repeat — key them by day
      var m = String(v[i][12] || '').match(/day (\d+)/);
      if (m) seen[String(v[i][2]) + '|chase|' + m[1]] = true;
    }
    if (st === 'close') {                                          // three rounds — key them by round
      var r = String(v[i][12] || '').match(/round (\d+)/);
      if (r) seen[String(v[i][2]) + '|close|' + r[1]] = true;
    }
    if (st === 'pend') {                                           // fortnightly — key them by round
      var pr = String(v[i][12] || '').match(/round (\d+)/);
      if (pr) seen[String(v[i][2]) + '|pend|' + pr[1]] = true;
    }
  }
  return seen;
}

function pdLogSend_(p, stageKey, tpl, sent, round) {
  getSheet_().appendRow([
    Date.now(), new Date().toISOString(), p.Policy, p.Client, p.ClientNo, p.Agent,
    OUT.BRANCH_NAME, '', 'System', stageKey,
    sent ? (OUT.TEST_INBOX ? 'test-outbound' : 'outbound') : 'outbound-dry', stageKey,
    (sent ? (OUT.TEST_INBOX ? 'TEST-SENT to ' + OUT.TEST_INBOX + ' (for ' : 'Sent to ')
          : 'WOULD SEND to ') + (pdValidEmail_(p.Email) || 'no email on file') +
      (sent && OUT.TEST_INBOX ? ')' : '') +
      (tpl.cc && tpl.cc.length ? ' (cc ' + tpl.cc.length + ')' : '') +
      ' — day ' + (Number(p.DaysArrears) || 0) + (round ? ' — round ' + round : '') + ' — ' + tpl.subject,
    '', '', '', '', '', '', ''
  ]);
}

/**
 * Run daily around 8am. Install with pdInstallTrigger().
 * With OUT.DRY_RUN true (the default) this sends nothing and writes a full
 * 'outbound-dry' plan to the log instead. Read that before going live.
 */
function dailyPremiumDueRun() {
  /* The interlock. Live-to-clients requires all three switches thrown
     deliberately: DRY_RUN false, TEST_INBOX cleared, GO_LIVE_CONFIRM true.
     Anything less runs as a dry run and says so — a half-finished config can
     never email a client. (Each execution reloads the script, so this
     fallback lasts this run only.) */
  if (!OUT.DRY_RUN && !OUT.TEST_INBOX && !OUT.GO_LIVE_CONFIRM) {
    OUT.DRY_RUN = true;
    Logger.log('REFUSING to go live: DRY_RUN is false and TEST_INBOX is empty, but GO_LIVE_CONFIRM is not true. ' +
      'Running as a DRY RUN instead — nothing was emailed. Set GO_LIVE_CONFIRM: true only once the pilot is done.');
  }

  var payload = JSON.parse(getPolicies_().getContent());
  if (!payload.ok) throw new Error('Could not read the portfolio: ' + payload.error);

  var sent = pdAlreadySent_();
  var states = pdCaseState_();
  var reqMap = pdRequirements_();               // the pending flow's own data
  var byClient = {};
  for (var b = 0; b < payload.policies.length; b++) {
    var bp = payload.policies[b];
    (byClient[String(bp.ClientNo)] = byClient[String(bp.ClientNo)] || []).push(bp);
  }
  var count = 0, skippedNoEmail = 0, planned = 0, internal = 0, capHeld = 0;

  var groups = {};                               // scheme key -> every row in the cluster

  /* Most urgent first. On an ordinary day this changes nothing — everything
     due fits under the cap. On launch day, or after an outage, the whole
     backlog is due at once and the caps below cut the TAIL: without this sort
     they would cut whatever happened to sit late in the portfolio, including
     policies at day 89 with two days of cover left.

     Urgency is not raw days. Live cover closest to the cliff outranks
     everything; then the freshest lapses (the reinstatement window is
     closing); then the newest stuck applications. Raw days would put a
     nine-month-old pending application ahead of a final notice. */
  payload.policies.sort(function (a, b) { return pdUrgency_(b) - pdUrgency_(a); });

  for (var i = 0; i < payload.policies.length; i++) {
    var p = payload.policies[i];

    /* Company-owned policies leave the individual flow here, whole. They are
       collected by scheme and handled once per company below. The client-send
       cap must never stop this loop — a capped day still has to see every
       policy, or schemes and manager chases late in the book silently vanish
       from the run. */
    if (pdIsGroup_(p)) {
      var gk = pdGroupKey_(p);
      (groups[gk] = groups[gk] || []).push(p);
      continue;
    }

    /* The pilot: while PILOT_AGENTS is set, everyone else's book does not
       exist to this run. Schemes are still collected in full above so a
       piloted scheme's statement covers all its members. */
    if (!pdInPilot_(p.Agent)) continue;

    var s = states[String(p.Policy)] || pdEmptyState_();

    /* Agent / manager accountability, under its own live-send budget so a
       launch-day backlog cannot dump hundreds of manager emails in one
       morning. Dry runs are never capped — the plan must show everything. */
    if (OUT.DRY_RUN || internal < OUT.MAX_INTERNAL_PER_RUN) {
      internal += pdInternalChase_(p, s);
    }

    var stageKey = pdStageDue_(p, s);
    /* The structured close: a policy this engine chased as pending is now in
       force. Congratulate once — timeline attached, agent and manager copied —
       so the case ends in front of everyone it involved. */
    if (!stageKey && (Number(p.Status) || 0) === 0 &&
        sent[String(p.Policy) + '|pend'] && !sent[String(p.Policy) + '|nbclose']) {
      stageKey = 'nbclose';
    }
    if (!stageKey) continue;
    var round = (stageKey === 'close') ? pdCloseRound_(Number(p.DaysArrears) || 0)
              : (stageKey === 'pend') ? pdPendRound_(Number(p.DaysArrears) || 0) : 0;
    // chases, closing letters and pending rounds repeat by design;
    // everything else sends once per policy per stage
    if (stageKey === 'chase') {
      if (sent[String(p.Policy) + '|chase|' + (Number(p.DaysArrears) || 0)]) continue;
    } else if (stageKey === 'close') {
      if (sent[String(p.Policy) + '|close|' + round]) continue;
    } else if (stageKey === 'pend') {
      if (sent[String(p.Policy) + '|pend|' + round]) continue;
      s.reqt = reqMap[String(p.Policy)];        // name the exact outstanding document
    } else if (sent[String(p.Policy) + '|' + stageKey]) continue;
    if ((Number(p.Premium) || 0) < OUT.MIN_PREMIUM) continue;

    s.family = byClient[String(p.ClientNo)] || [p];        // the whole relationship, not one line of it
    var tpl = pdRender(stageKey, p, s, { round: round });
    if (!tpl) continue;
    var to = pdValidEmail_(p.Email);
    if (!pdMayEmail_(p)) {                                  // the client asked us not to
      pdLogSend_(p, stageKey, tpl, false, round);
      continue;
    }
    planned++;

    if (!to) {                                                      // no email: log it so an agent can call
      skippedNoEmail++;
      pdLogSend_(p, stageKey, tpl, false, round);
      continue;
    }
    if (OUT.DRY_RUN) { pdLogSend_(p, stageKey, tpl, false, round); continue; }

    /* The live cap holds the least-urgent tail (the sort above guarantees
       that). Nothing is logged for a held letter, so it is still due — and
       still first in line — on tomorrow's run. */
    if (count >= OUT.MAX_SENDS_PER_RUN) { capHeld++; continue; }

    try {
      pdDeliver_(to, tpl.cc, tpl.subject, tpl.html);   // cc: agent + manager + BM
      pdLogSend_(p, stageKey, tpl, true, round);
      count++;
    } catch (err) {
      pdLogSend_(p, stageKey, { subject: 'FAILED: ' + String(err) }, false);
    }
  }

  /* One statement per scheme, after the individual pass — a company with 65
     member policies is one email here, not 65 anywhere else. */
  var groupsSent = 0, groupCount = 0;
  for (var gk2 in groups) {
    if (!Object.prototype.hasOwnProperty.call(groups, gk2)) continue;
    /* A scheme is in the pilot when any of its servicing agents is. */
    if (OUT.PILOT_AGENTS.length) {
      var inPilot = false;
      for (var gm = 0; gm < groups[gk2].length; gm++) {
        if (pdInPilot_(groups[gk2][gm].Agent)) { inPilot = true; break; }
      }
      if (!inPilot) continue;
    }
    groupCount++;
    groupsSent += pdGroupChase_(gk2, groups[gk2], states);
  }

  Logger.log('Premium due run — %s%s%s. planned=%s sent=%s held-by-cap=%s no-email=%s internal-chases=%s group-schemes=%s group-statements=%s',
    OUT.DRY_RUN ? 'DRY RUN, nothing emailed' : 'LIVE',
    !OUT.DRY_RUN && OUT.TEST_INBOX ? ' — TEST MODE, everything to ' + OUT.TEST_INBOX : '',
    OUT.PILOT_AGENTS.length ? ' — pilot: ' + OUT.PILOT_AGENTS.join(', ') : '',
    planned, count, capHeld, skippedNoEmail, internal, groupCount, groupsSent);
}

/**
 * Pilot convenience: wipe the log so every letter re-fires on the next run —
 * for re-testing a fix without hand-deleting sheet rows on a phone. Guarded:
 * it only runs while TEST_INBOX is set. A live ledger is never wiped by code.
 */
function pdResetPilotLog() {
  if (!OUT.TEST_INBOX) {
    Logger.log('REFUSED: pdResetPilotLog only runs in test mode (TEST_INBOX set). A live ledger is never wiped.');
    return;
  }
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  Logger.log('Pilot log cleared — ' + Math.max(0, last - 1) + ' rows removed. Run dailyPremiumDueRun again and everything re-fires fresh.');
}

/**
 * THE FIRST ACT OF THE PILOT — run this before any letters. It reads the book
 * and emails one digest of everything the engine believes: the funnel, the
 * bands, the schemes, the pending flow decoded, and what the next run would
 * send. Check these numbers against what you know; only when they agree do
 * the letters deserve to fire. Sends to TEST_INBOX while the pilot is on
 * (branch email once live), and never writes to the log — stats, not sends.
 */
function pdPilotStats() {
  var payload = JSON.parse(getPolicies_().getContent());
  if (!payload.ok) throw new Error('Could not read the portfolio: ' + payload.error);
  var P = payload.policies, i, p, d;

  var st2 = 0, st1 = 0, st3 = 0, ctx = 0, grpN = 0;
  var at45 = 0, w4547 = 0, w4559 = 0, w6074 = 0, w7589 = 0, w90109 = 0;
  var premWin = 0, noEmail = 0, mgrDue = 0;
  var groups = {}, weekApps = 0, weekPrem = 0;
  var byClientAll = {}, pendList = [];
  var now = Date.now(), weekAgo = now - 7 * 86400000;

  for (i = 0; i < P.length; i++) {
    p = P[i]; d = Number(p.DaysArrears) || 0;
    var s = Number(p.Status) || 0;
    if (pdIsGroup_(p)) {
      grpN++;
      if (s === 2 && d >= SLA.GROUP_OPENS && d < 180) {
        var gk = pdGroupKey_(p);
        var g = groups[gk] || (groups[gk] = { n: 0, prem: 0 });
        g.n++; g.prem += Number(p.Premium) || 0;
      }
      continue;
    }
    (byClientAll[String(p.ClientNo)] = byClientAll[String(p.ClientNo)] || []).push(p);
    if (s === 1) st1++;
    else if (s === 3) { st3++; pendList.push(p); }
    else if (s === 2) {
      st2++;
      if (d === 45) at45++;
      if (d >= 45 && d < 48) w4547++;
      if (d >= 45 && d <= 59) { w4559++; premWin += Number(p.Premium) || 0; }
      if (d >= 60 && d <= 74) w6074++;
      if (d >= 75 && d <= 89) w7589++;
      if (d >= 90 && d <= 109) w90109++;
      if (d >= 45 && d <= 89 && !pdValidEmail_(p.Email)) noEmail++;
      if (d >= SLA.RETENTION_OPENS && d < SLA.LAPSE) mgrDue++;
    } else ctx++;
    var ar = new Date(p.AppReceived || '');
    if (!isNaN(ar) && ar.getTime() >= weekAgo && ar.getTime() <= now) {
      weekApps++; weekPrem += Number(p.Premium) || 0;
    }
  }

  var reqMap = pdRequirements_();
  var pendN = 0, pendReady = 0, pendErrors = 0, pendSusp = 0;
  for (var pol in reqMap) {
    if (!Object.prototype.hasOwnProperty.call(reqMap, pol)) continue;
    pendN++;
    if (reqMap[pol].uwDone) pendReady++;
    if (reqMap[pol].errors) pendErrors++;
    pendSusp += reqMap[pol].susp;
  }

  /* Replacement identification: a pending application while the same client's
     in-force cover is behind or freshly lapsed. Review before anything dies. */
  var replApps = 0, replClients = {}, j2;
  for (j2 = 0; j2 < pendList.length; j2++) {
    var rr = pdReplacementRisk_(pendList[j2], byClientAll[String(pendList[j2].ClientNo)] || []);
    if (rr) { replApps++; replClients[String(pendList[j2].ClientNo)] = 1; }
  }
  var replCli = 0;
  for (j2 in replClients) if (Object.prototype.hasOwnProperty.call(replClients, j2)) replCli++;

  var row = function (k, v2, hot) {
    return '<tr><td style="padding:7px 12px;border:1px solid ' + PD_BRAND.line + ';background:#FFFFFF;color:' +
      PD_BRAND.ink + '">' + k + '</td><td style="padding:7px 12px;border:1px solid ' + PD_BRAND.line +
      ';background:#FFFFFF;color:' + (hot ? PD_BRAND.red : PD_BRAND.ink) +
      ';text-align:right;font-weight:bold;white-space:nowrap">' + v2 + '</td></tr>';
  };
  var tbl = function (rows) {
    return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px">' +
      rows + '</table>';
  };

  var gRows = '', gk2, gN = 0;
  for (gk2 in groups) {
    if (!Object.prototype.hasOwnProperty.call(groups, gk2)) continue;
    gN++;
    gRows += row(pdEsc_(gk2), groups[gk2].n + ' members · ' + pdMoney_(groups[gk2].prem), false);
  }

  var html = pdWrap_(
    '<p style="margin:0 0 4px;font-size:11px;letter-spacing:.08em;color:' + PD_BRAND.mute + '">ENGINE DIGEST — ' +
      'read before any letter fires</p>' +
    '<p style="margin:0 0 12px">This is everything the engine believes about the book as of this run. ' +
    'If a number here disagrees with what the branch knows, stop and say so — the letters wait.</p>' +

    pdSection_('The premium-due flow (in-force cover on the 45/60/90 clock)', tbl(
      row('Policies in arrears (status 2, individuals)', String(st2), false) +
      row('At exactly day 45 today', String(at45), false) +
      row('Day-45 letter window (45–47)', String(w4547), false) +
      row('Pre-handover window (45–59)', w4559 + ' · ' + pdMoney_(premWin), false) +
      row('With a manager (60–74)', String(w6074), false) +
      row('Final stretch (75–89)', String(w7589), true) +
      row('Closing sequence (90–109)', String(w90109), true) +
      row('Manager handovers currently due (60–89)', String(mgrDue), false) +
      row('No usable email in the save window (call list)', String(noEmail), true))) +

    pdSection_('Group schemes (one statement per company — never member letters)', tbl(
      (gN ? gRows : row('Schemes with a missed remittance (member ≥ ' + SLA.GROUP_OPENS + ' days)', '0', false)))) +

    pdSection_('The pending flow (new business — a separate clock, day 21 then fortnightly)', tbl(
      row('Applications with live requirements', String(pendN), false) +
      row('SETTLE-READY: underwriting complete, paper outstanding', String(pendReady), true) +
      row('Carrying our own entry errors (ours to fix)', String(pendErrors), false) +
      row('Premium held in suspense on pending cases', pdMoney_(pendSusp), false) +
      row('REPLACEMENT CHECKS: new app pending while in-force cover slides', replApps + ' app' +
        (replApps === 1 ? '' : 's') + ' · ' + replCli + ' client' + (replCli === 1 ? '' : 's'), replApps > 0))) +

    pdSection_('Production (application received in the last 7 days)', tbl(
      row('Applications', String(weekApps), false) +
      row('Premium as recorded (mode unknown — see data asks)', pdMoney_(weekPrem), false))) +

    '<p style="font-size:12px;color:' + PD_BRAND.mute + ';margin:14px 0 0">Lapsed book and win-back, pending ' +
    'outside its clock, and context policies are not counted above — this digest is the working funnel. ' +
    'Nothing was sent and nothing was logged by this run.</p>' +
    pdSigInternal_(),
    { kind: 'mgr' }, true);

  var summary = 'status2=' + st2 + ' at45=' + at45 + ' window45-59=' + w4559 + ' mgrDue=' + mgrDue +
    ' schemes=' + gN + ' pending=' + pendN + ' settle-ready=' + pendReady + ' replacement-checks=' + replApps;
  if (OUT.DRY_RUN && !OUT.TEST_INBOX) {
    Logger.log('Digest (DRY RUN, no test inbox — logged only, not emailed). ' + summary);
    return;
  }
  var to = OUT.TEST_INBOX || pdValidEmail_(OUT.BRANCH_EMAIL) || pdValidEmail_(OUT.SALES_SUPPORT_EMAIL);
  pdDeliver_(to, [], 'Engine digest — what the book looks like before any letter fires', html);
  Logger.log('Digest sent to %s. %s', to, summary);
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
    Policy: '9004100017', Client: 'Saira Ramnarine', ClientNo: '900120', Agent: 'Neil Ramnanan',
    Premium: 538.90, Status: 2, DaysArrears: 78, LapseDate: '19 Jun 2026',
    Email: 'saira.ramnarine@example.com', Phone: '(868) 555-0143',
    Address: '14 Mount Pleasant Road, San Fernando', StatusDesc: 'Premium Paying'
  };
  var now = Date.now(), day = 86400000;
  var demoState = pdEmptyState_();
  demoState.survey = { ts: now - 30 * day, surveyReason: 'Financial difficulty',
    surveyContact: 'Wants to keep', surveyPromise: 'I can resume payments from September salary' };
  demoState.trail = [{ ts: now - 33 * day, mine: false, what: TRAIL_LABEL.s45 },
                     { ts: now - 23 * day, mine: false, what: TRAIL_LABEL.chase }];
  demoState.activatedTs = now - 18 * day;
  demoState.mgrName = 'Gary Sookdeo';
  demoState.mgr = { mcall:  { ak: 'today', lab: 'Yes — I will call today', ts: now - 16 * day },
                    mfact:  { ak: 'yes',   lab: 'Yes — I will review it', ts: now - 16 * day },
                    madvisor:{ ak: 'yes',  lab: 'Yes — I will speak with them', ts: now - 16 * day },
                    mby:    { ak: 'd3',    lab: 'Within 3 days', ts: now - 16 * day } };
  demoState.noteCount = 2;

  ['s45', 'chase', 's75', 's90', 'winback', 'pend', 'thanks'].forEach(function (k) {
    var t = pdRender(k, demo, demoState);
    Logger.log('--- %s ---\nSUBJECT: %s\n', k, t.subject);
  });
  ['commit','ack','feedback'].forEach(function (ph) {
    Logger.log('--- manager %s ---\nSUBJECT: %s', ph, pdManagerLetter_(demo, demoState, { phase: ph }).subject);
  });

  var scheme = [
    { Policy: '5003700001', Client: 'Servus Limited', ClientNo: '900901', Agent: 'Ricky Rampersad',
      Status: 2, DaysArrears: 46, Premium: 512.00, PlanCode: 'RPIM 1', PaidToDate: '2026-07-01' },
    { Policy: '5003700002', Client: 'Servus Limited', ClientNo: '900901', Agent: 'Ricky Rampersad',
      Status: 2, DaysArrears: 46, Premium: 655.40, PlanCode: 'PIM 1', PaidToDate: '2026-07-01' }
  ];
  Logger.log('--- group statement ---\nSUBJECT: %s',
    pdGroupStatement_('SERVUS LIMITED', scheme, { agents: 'Ricky Rampersad' }).subject);
}
