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

  /* The one that makes the call worth making. A client who never opened an
     email still has a position, and this is where it gets recorded — in the
     same vocabulary the client is offered, so the two are comparable and the
     day-90 letter can quote it back accurately. */
  { k: 'mclientsays', q: 'What did the client tell you?', opts: [
    { k: 'clear',     lab: 'They will clear it' },
    { k: 'lower',     lab: 'They need a smaller premium' },
    { k: 'date',      lab: 'They need a different payment date' },
    { k: 'bank',      lab: 'Their bank instruction failed' },
    { k: 'pause',     lab: 'They asked for a short pause' },
    { k: 'end',       lab: 'They no longer want the cover' },
    { k: 'nocontact', lab: 'I have not been able to speak with them' } ] },

  { k: 'mdecision', q: 'What is your decision on this case?', opts: [
    { k: 'retention',   lab: 'Approve the retention plan as proposed' },
    { k: 'payplan',     lab: 'Approve a payment plan' },
    { k: 'reduce',      lab: 'Approve a premium reduction or benefit alteration' },
    { k: 'reinstate',   lab: 'Escalate to reinstatement' },
    { k: 'replacement', lab: 'Investigate possible replacement of in-force cover' },
    { k: 'reassign',    lab: 'Reassign — orphan or wrong agent' },
    { k: 'lapse',       lab: 'Allow the policy to lapse — documented' } ] },

  { k: 'mvalue', q: 'What is the non-forfeiture position on this policy?', opts: [
    { k: 'novalue',  lab: 'No accrued value — it lapses outright at day 90' },
    { k: 'apl',      lab: 'An automatic premium loan is running against the value' },
    { k: 'value',    lab: 'It has value; cover can be sustained from it for a period' },
    { k: 'checking', lab: 'Confirming with the carrier — I will come back on this' } ] },

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
  { k: 'reached', q: 'Before anything else — did anyone from us actually reach you?', opts: [
    { k: 'agent',   lab: 'Yes — my agent spoke with me' },
    { k: 'manager', lab: 'Yes — a manager called me' },
    { k: 'letters', lab: 'Only these letters. Nobody called.' },
    { k: 'nothing', lab: 'This is the first I am hearing of it' } ] },

  { k: 'decide', q: 'What would you like to happen with this policy?', opts: [
    { k: 'clear',   lab: "Keep it — I'll clear the premium" },
    { k: 'afford',  lab: 'Keep it, at an amount I can manage' },
    { k: 'talk',    lab: 'Hold it — I want to speak to someone first' },
    { k: 'explain', lab: "I'm ready to let it go, but tell me what I lose" },
    { k: 'end',     lab: 'End it. I have decided.' } ] },

  { k: 'us', q: 'If we got something wrong, what was it?', opts: [
    { k: 'nothing', lab: 'Nothing — this was handled well' },
    { k: 'unclear', lab: 'Nobody explained what would actually happen' },
    { k: 'nobody',  lab: 'It was too hard to reach a person' },
    { k: 'unmet',   lab: 'I asked for something and never got an answer' },
    { k: 'money',   lab: 'The problem was money, and nothing offered helped' } ] }
];

/* Flat lookup, so a returning click can be named without walking the sets. */
var ANSWER_BY_KEY = (function () {
  var m = {};
  [CLIENT_QUESTIONS, MANAGER_QUESTIONS, CLOSING_QUESTIONS].forEach(function (set) {
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
  [CLIENT_QUESTIONS, MANAGER_QUESTIONS, CLOSING_QUESTIONS].forEach(function (set) {
    set.forEach(function (q) { m[q.q] = q.k; });
  });
  return m;
})();

var PD_AKEY_BY_LABEL = (function () {
  var m = {};
  [CLIENT_QUESTIONS, MANAGER_QUESTIONS, CLOSING_QUESTIONS].forEach(function (set) {
    set.forEach(function (q) {
      q.opts.forEach(function (o) { m[q.k + '|' + o.lab] = o.k; });
    });
  });
  return m;
})();

/** {qk, ak} for a logged row, or null if it is not one of our question sets. */
function pdDecodeAnswer_(questionText, label) {
  var qk = PD_QKEY_BY_TEXT[String(questionText || '').trim()];
  if (!qk) return null;
  var ak = PD_AKEY_BY_LABEL[qk + '|' + String(label || '').trim()];
  return { qk: qk, ak: ak || '', lab: String(label || '') };
}

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
    /* Questions are not numbered. They sit inside a numbered section, and two
       competing sets of numerals in one letter — "1. Three questions" followed
       by "1., 2., 3." in larger type — reads as though the section headings
       were the sub-headings. Where another part of a letter needs to point at
       one of these, it names it. */
    out += '<div style="margin:18px 0 0">' +
      '<div style="font-size:13.5px;font-weight:bold;color:' + PD_BRAND.ink + ';margin-bottom:7px">' +
        pdEsc_(q.q) + '</div>' +
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
  'mcontact:yes':        'Your agent&rsquo;s manager recorded that they spoke with you',
  'mcontact:attempted':  'Your agent&rsquo;s manager recorded an attempt to reach you',
  'mcontact:notyet':     'Your agent&rsquo;s manager recorded that they would contact you',
  'mclientsays:clear':   'You told them you would clear the premium',
  'mclientsays:lower':   'You told them you needed a smaller premium',
  'mclientsays:date':    'You told them you needed a different payment date',
  'mclientsays:bank':    'You told them your bank instruction had failed',
  'mclientsays:pause':   'You asked for a short pause',
  'mclientsays:end':     'You told them you no longer wanted the cover',
  'mdecision:retention': 'A retention plan was approved for this policy',
  'mdecision:payplan':   'A payment plan was approved for this policy',
  'mdecision:reduce':    'A reduced premium, or an alteration to the benefit, was approved',
  'mdecision:reinstate': 'The case was escalated for reinstatement',
  'mvalue:novalue':      'The position on this policy&rsquo;s value was confirmed',
  'mvalue:apl':          'It was confirmed that a premium loan is running against the policy&rsquo;s value',
  'mvalue:value':        'It was confirmed that this policy has built a value',
  'msupport:yes':        'The case was escalated to the branch manager'
};

/* Rows are told apart by their background, not by the colour of the text.
   PD_BRAND.gold reads at 2.6:1 on white — fine as a rule or a button, not as a
   sentence somebody has to read on a phone in daylight. Every value below is
   above 4.5:1 against the background it sits on, and each states both. */
var PD_LOG_TINT = {
  you: { fg: '#0A524A', bg: '#F1F7F5', weight: '600' },     // the client's own words
  mgr: { fg: '#6B4E0A', bg: '#FBF4E4', weight: '600' },     // a manager acted
  us:  { fg: '#0B1B2B', bg: '#FFFFFF', weight: 'normal' }   // we wrote
};

function pdLogRow_(when, who, what, kind) {
  var t = PD_LOG_TINT[kind] || PD_LOG_TINT.us;
  return '<tr>' +
    '<td style="padding:8px 11px;border:1px solid #E8E3D8;background:#F3F0E9;color:#5A6B7B;' +
      'white-space:nowrap;width:104px;vertical-align:top;font-size:12px">' + when + '</td>' +
    '<td style="padding:8px 11px;border:1px solid #E8E3D8;background:' + t.bg + ';color:#5A6B7B;' +
      'white-space:nowrap;width:88px;vertical-align:top;font-size:12px">' + who + '</td>' +
    '<td style="padding:8px 11px;border:1px solid #E8E3D8;background:' + t.bg + ';color:' + t.fg +
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
              kind: qk === 'mclientsays' ? 'you' : 'mgr' });
  }

  ev.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });

  var rows = '';
  for (i = 0; i < ev.length; i++) rows += pdLogRow_(pdDateOf_(ev[i].ts), ev[i].who, ev[i].what, ev[i].kind);
  rows += pdLogRow_('Today', 'We wrote', 'This letter — the final notice', 'us');

  var table = '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    '<tr>' +
      '<th style="padding:7px 11px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B;text-align:left;font-weight:600;font-size:12px">Date</th>' +
      '<th style="padding:7px 11px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B;text-align:left;font-weight:600;font-size:12px">Who</th>' +
      '<th style="padding:7px 11px;background:#F3F0E9;border:1px solid #E8E3D8;color:#5A6B7B;text-align:left;font-weight:600;font-size:12px">What happened</th>' +
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
      foot + '</p>' +
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
      '<td style="padding:8px 12px;background:#F3F0E9;border:1px solid #E8E3D8;width:118px;white-space:nowrap;color:' +
        (emphasis ? PD_BRAND.red : '#5A6B7B') + ';font-weight:' + (emphasis ? 'bold' : 'normal') + '">' + when + '</td>' +
      '<td style="padding:8px 12px;background:#FFFFFF;border:1px solid #E8E3D8;color:' + PD_BRAND.ink + '">' + what + '</td>' +
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
    return '<b>' + pdEsc_(name) + '</b><br><span style="color:#5A6B7B">' + role + '</span>';
  };
  var who = (opts.both && mgr)
    ? '<table cellpadding="0" cellspacing="0" style="width:100%"><tr>' +
        '<td style="padding:0 14px 0 0;vertical-align:top;color:' + PD_BRAND.ink + '">' +
          line(p.Agent || OUT.BRANCH_NAME, 'Financial Advisor') + '</td>' +
        '<td style="padding:0;vertical-align:top;color:' + PD_BRAND.ink + '">' +
          line(mgr, 'Manager &middot; accountable for this policy since day 60') + '</td>' +
      '</tr></table><br>'
    : line(p.Agent || OUT.BRANCH_NAME,
           'Financial Advisor' + (mgr ? ' &middot; reporting to ' + pdEsc_(mgr) : '')) + '<br>';
  return '<table cellpadding="0" cellspacing="0" style="width:100%;margin:22px 0 0;font-size:13px">' +
    '<tr><td style="padding:14px 0 0;border-top:1px solid #E8E3D8;color:' + PD_BRAND.ink + '">' +
      'Yours sincerely,<br><br>' + who +
      '<b>' + pdEsc_(OUT.BRANCH_NAME) + '</b><br>' +
      '<span style="color:#5A6B7B">' + pdEsc_(OUT.BRANCH_PHONE) + ' &middot; ' + pdEsc_(OUT.BRANCH_EMAIL) + '</span>' +
    '</td></tr></table>';
}

/** Internal mail is from the branch, not from somebody's advisor. */
function pdSigInternal_() {
  return '<table cellpadding="0" cellspacing="0" style="width:100%;margin:22px 0 0;font-size:13px">' +
    '<tr><td style="padding:14px 0 0;border-top:1px solid #E8E3D8;color:#5A6B7B">' +
      '<b style="color:' + PD_BRAND.ink + '">' + pdEsc_(OUT.BRANCH_NAME) + '</b> &middot; Premium Due Engine<br>' +
      pdEsc_(OUT.BRANCH_PHONE) + ' &middot; ' + pdEsc_(OUT.BRANCH_EMAIL) +
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

        pdSection_(3, 'What happens if this is not settled',
          '<p>' + pdLapseMeaning_(p) + '</p>' +
          '<p>Either way, this policy was underwritten on your health <b>as it was when you applied</b>. If it ends ' +
          'and you later reapply, you are underwritten on your health as it is then. Where anything has changed in ' +
          'between, the same cover may cost considerably more, or may not be available at all.</p>') +

        pdSection_(4, 'If we do not hear from you',
          pdNote_('Cover ends <b>' + left + ' days</b> from today if the premium remains outstanding, and from that ' +
                  'date a claim is not payable. If we have not heard from you by <b>day 60</b>, this stops being a ' +
                  'letter: ' + (pdManagerOf_(p.Agent) ? '<b>' + pdEsc_(pdManagerOf_(p.Agent)) + '</b>, your agent&rsquo;s manager'
                                                      : 'your agent&rsquo;s manager') +
                  ', takes personal responsibility for the policy and contacts you directly. ' +
                  'One tap above is enough to make that unnecessary.')) +

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
      subject: 'Policy No. ' + p.Policy + ' — reminder, ' + left + ' days to lapse',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding — Reminder') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>We wrote to you at day 45 about this policy and have not yet had your instruction. ' +
        'The premium is now <b>' + d + ' days</b> outstanding and cover ends in <b>' + left + ' days</b>.</p>' +

        (escalated
          ? pdNote_('<b>This is no longer sitting with your agent alone.</b> ' +
              (mgr ? '<b>' + pdEsc_(mgr) + '</b>, their manager, has' : 'Their manager has') +
              ' been formally asked to take this policy on and to telephone you personally. ' +
              'If you would rather not wait for that call, one tap below settles it now.')
          : '') +

        pdSection_(1, 'Please select an option',
          '<p>Any one of these keeps the matter open and puts it in front of someone who can act. ' +
          'Selecting the last one is a decision we will respect — but we would rather record it properly than ' +
          'let the policy lapse by silence.</p>' + pdChoiceBlock_(p)) +

        pdSection_(2, 'The remaining timeline', pdTimeline_(p)) +

        '<p style="margin-top:18px">Call <b>' + pdEsc_(OUT.BRANCH_PHONE) + '</b> at any time and quote policy number ' +
        pdEsc_(p.Policy) + '.</p>' +
        pdSignature_(p),
        'Reminder'),
      whatsapp: 'Good day ' + first + ', ' + OUT.BRANCH_NAME + ' following up on policy ' + p.Policy + '. It is ' + d +
        ' days outstanding with ' + left + ' days before cover ends. ' +
        (escalated && mgr ? mgr + ', the manager responsible for your agent, has been asked to call you personally. ' : '') +
        'Even a one-line reply — including that you want to stop it — lets us act properly rather than let it lapse.'
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
      subject: 'Final notice — policy ' + p.Policy + ', ' + left + ' day' + (left === 1 ? '' : 's') +
        ' remaining, and the full record',
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Final Notice — Premium Outstanding') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>This is the last notice we will send before this policy reaches the end of its grace period, in <b>' +
        left + ' day' + (left === 1 ? '' : 's') + '</b>. Everything this branch has recorded about it is set out ' +
        'below — what we sent, what you told us, and what was done about it.</p>' +

        pdSection_(1, 'Three questions, one tap each',
          '<p>We have asked you what would help twice already, so we are not asking a third time. These are ' +
          'different questions, and the first two matter more than anything else in this letter.</p>' +
          pdQuestionBlock_(p, CLOSING_QUESTIONS, 'respond')) +

        pdSection_(2, 'Everything that has happened on this policy', pdInteractionLog_(p, state)) +

        pdSection_(3, (family.length > 1 ? 'Everything you hold with us' : 'The policy'),
          (family.length > 1
            ? pdPolicyTable_(p, family) +
              '<p style="font-size:13px;color:#5A6B7B">The highlighted row is the policy this letter is about. ' +
              'Nothing here affects the others.</p>'
            : pdFacts_(p))) +

        pdSection_(4, 'What day 90 actually means for this policy',
          pdNote_(pdLapseMeaningFor_(p, state), PD_BRAND.red) +
          '<p style="font-size:13.5px">Whatever it is worth today, this policy was underwritten on your health ' +
          '<b>as it was when you applied</b>. If it ends and you later reapply, you are underwritten on your ' +
          'health as it is then — and where something has changed in between, the same cover may cost ' +
          'considerably more, or may not be available at all. That is the part that cannot be bought back.</p>') +

        pdSection_(5, 'If you would rather just talk to someone',
          '<p>Call <b>' + pdEsc_(OUT.BRANCH_PHONE) + '</b> and quote policy number ' + pdEsc_(p.Policy) + '. ' +
          (mgr ? 'Ask for <b>' + pdEsc_(mgr) + '</b> — this policy is theirs. ' : '') +
          'There is still time for one conversation to change the outcome, and if the answer is that you want ' +
          'it to end, we would rather hear it from you than record it as silence.</p>') +

        pdSignature_(p, { both: !!(state && (state.activatedTs || state.mgrName)), manager: state && state.mgrName }),
        'Final notice'),
      whatsapp: 'Good day ' + pdFirst_(p.Client) + ' — final notice on policy ' + p.Policy + '. It reaches the end of its ' +
        'grace period in ' + left + ' day' + (left === 1 ? '' : 's') + '. I have sent you the complete record of ' +
        'everything on this policy — every letter, every reply, and what we did about it. ' +
        'Two things I want to ask you directly: did anyone from us actually call you, and what would you like ' +
        'to happen with the policy? Call ' + OUT.BRANCH_PHONE + ' or reply here.'
    };
  },

  /* ---- day 75: the manager writes, in their own name. Fifteen days left, and
         the two letters before this one did not land. A different signature from
         a different person is the last lever before the final notice. ---- */
  s75: function (p, state) {
    var first = pdFirst_(p.Client), left = pdDaysToLapse_(p), d = Number(p.DaysArrears) || 0;
    var mgr = pdManagerOf_(p.Agent) || OUT.BRANCH_NAME;
    var family = pdFamily_(p, state && state.family);
    return {
      subject: 'Policy No. ' + p.Policy + ' — ' + left + ' days remaining, from ' + mgr,
      cc: pdChainCc_(p),
      html: pdWrap_(
        pdRefBlock_(p, 'Premium Outstanding — 75 Days') +
        '<p>' + pdSalutation_(p.Client) + ',</p>' +
        '<p>I am <b>' + pdEsc_(mgr) + '</b>, the manager responsible for your agent&rsquo;s work at this branch. ' +
        'I am writing personally because we have now written to you twice about this policy and have not been ' +
        'able to reach you, and there are <b>' + left + ' days</b> left before it reaches the end of its grace period.</p>' +
        pdStakeOpening_(p, family) +

        pdSection_(1, 'One tap is all this needs',
          '<p>You do not need to write anything or call anybody. Choose whichever is closest and I will personally ' +
          'make sure it is dealt with.</p>' + pdQuestionBlock_(p, CLIENT_QUESTIONS, 'respond')) +

        pdSection_(2, 'What we have sent, and what you told us', pdTrail_(p, state)) +

        pdSection_(3, 'What happens at day 90', pdTimeline_(p) +
          '<div style="margin-top:12px">' + pdNote_(pdLapseMeaning_(p)) + '</div>') +

        pdSection_(4, 'My commitment to you',
          '<p>If none of the options above fits, reply to this email with a single line and I will call you myself. ' +
          'I would rather spend ten minutes on the phone than write to you again.</p>' +
          '<p style="font-size:14px"><b>' + pdEsc_(OUT.BRANCH_PHONE) + '</b> &middot; quote policy ' + pdEsc_(p.Policy) + '</p>') +

        pdSignature_(p),
        '75-day — manager'),
      whatsapp: 'Good day ' + first + '. This is ' + mgr + ', the manager at ' + OUT.BRANCH_NAME +
        ' responsible for your agent. We have written twice about policy ' + p.Policy + ' and I wanted to reach you myself. ' +
        'There are ' + left + ' days left before it reaches the end of its grace period. ' +
        'Tell me what would help — clearing it, a smaller amount, a different payment date, fixing the bank instruction, ' +
        'or a short pause — and I will handle it personally.'
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
      htmlBody: pdWrap_(body, 'Manager escalation', true)
    });
  } catch (err) { /* never let a mail failure lose the record */ }
}

/* ===================== the manager's email =====================
   Sent in three situations, all the same letter with a different opening:

     activation — day 60. The client comes off the letter sequence and this
                  policy becomes the manager's, whether or not the agent has
                  filed anything.
     filing     — the agent filed a retention case and needs a decision.
     chasing    — three days have passed and the manager has not answered.

   The manager answers by tapping, exactly as the client does. Approval Status
   came back blank on 78 of 106 filed cases when the only way to answer was to
   open a form and type; the fix is not to ask people to try harder. */

/** How to reach this client — everything the portfolio holds, in one block. */
function pdContactBlock_(p) {
  var rows = '';
  if (p.Phone) rows += pdKv_('Telephone', '<b>' + pdEsc_(p.Phone) + '</b>');
  var em = pdValidEmail_(p.Email);
  rows += pdKv_('Email', em ? pdEsc_(em) : '<span style="color:' + PD_BRAND.red + '">none on file</span>');
  if (p.Address) rows += pdKv_('Address', pdEsc_(p.Address));
  if (!pdMayEmail_(p)) {
    rows += pdKv_('Consent', '<span style="color:' + PD_BRAND.red + '">Marked <b>do not email</b> in the portfolio — ' +
      'telephone or visit only</span>');
  }
  if (!p.Phone && !em) {
    return pdNote_('<b>We hold no telephone number and no usable email address for this client.</b> ' +
      (p.Address ? 'The address on file is <b>' + pdEsc_(p.Address) + '</b>. ' : '') +
      'They cannot be reached by the automated sequence at all — if this policy is going to be saved, ' +
      'it is going to be saved by you.', PD_BRAND.red);
  }
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">' +
    rows + '</table>';
}

function pdManagerLetter_(p, state, opts) {
  opts = opts || {};
  var mgr = pdManagerOf_(p.Agent), d = Number(p.DaysArrears) || 0;
  var waiting = opts.waiting || 0;
  var chasing = !!opts.chasing;
  var activation = !!opts.activation;
  var filed = !!(state && state.retentionTs);

  var subject = activation
    ? 'Day ' + d + ' — this policy is now yours: ' + p.Client + ' (Policy ' + p.Policy + ')'
    : (chasing ? 'REMINDER ' + waiting + ' days — ' : '') +
      'Your response is required — ' + p.Client + ' (Policy ' + p.Policy + ')';

  var opening;
  if (activation) {
    opening =
      pdNote_('<b>This policy has reached day ' + d + ' and has come off the client letter sequence.</b> ' +
        '<b>' + pdEsc_(p.Client) + '</b> will not receive another letter from us until day 88. ' +
        'Between now and then the contact they get is the contact <b>you</b> make — that is the whole design, ' +
        'and it is why this email exists.') +
      '<p>The premium is <b>' + d + ' days</b> outstanding and the policy reaches the end of its grace period in <b>' +
      pdDaysToLapse_(p) + ' days</b>. ' +
      (filed ? 'Your agent <b>' + pdEsc_(p.Agent) + '</b> has already filed a retention case, set out below.'
             : 'Your agent <b>' + pdEsc_(p.Agent) + '</b> has not filed a retention case yet and has until day ' +
               SLA.AGENT_FILE_BY + '. Do not wait for it — the two things run in parallel.') + '</p>';
  } else if (chasing) {
    opening = pdNote_('<b>This is reminder ' + Math.max(1, Math.ceil(waiting / SLA.MANAGER_CHASE_EVERY)) +
      '.</b> This policy came to you <b>' + waiting + ' days ago</b> and nothing has been recorded against it. ' +
      (filed ? '<b>' + pdEsc_(p.Agent) + '</b> filed the case and cannot offer the client anything until you answer — ' +
               'the case is with you, not with them. '
             : '') +
      'The policy lapses in <b>' + pdDaysToLapse_(p) + ' days</b>.', PD_BRAND.red);
  } else {
    opening = '<p><b>' + pdEsc_(p.Agent) + '</b> has filed a retention case on this policy and needs your decision. ' +
      'The policy lapses in <b>' + pdDaysToLapse_(p) + ' days</b>.</p>';
  }

  return {
    subject: subject,
    html: pdWrap_(
      pdRefBlock_(p, activation ? 'Day 60 — Manager Ownership' : 'Retention Case — Manager Response Required') +
      '<p>' + (mgr ? 'Dear ' + pdEsc_(mgr) : 'Dear Manager') + ',</p>' +

      opening +

      pdSection_(1, 'Call this client — then record what happened',
        '<p>Across this branch, <b>47 of 137</b> clients whose policies were in arrears reported that nobody had ' +
        'contacted them at all. That is the single number this whole process exists to change, and a call from a ' +
        'manager is what changes it. Not another letter.</p>' +
        pdContactBlock_(p)) +

      pdSection_(2, 'Your response — tap your answers',
        '<p>Each one records against the policy immediately and your agent sees it at once. ' +
        '<b>&ldquo;What did the client tell you?&rdquo;</b> is their answer from the call, offered in the same ' +
        'words the client is offered themselves, so the two are directly comparable. ' +
        '<b>&ldquo;What is the non-forfeiture position?&rdquo;</b> goes into the client&rsquo;s day-88 letter ' +
        '<b>as your answer</b>, replacing what the engine infers from the issue date — so it needs to be right.</p>' +
        pdQuestionBlock_(p, MANAGER_QUESTIONS, 'mgr')) +

      pdSection_(3, 'The policy', pdFacts_(p)) +

      pdSection_(4, 'What the client has told us', pdClientSaidBlock_(state)) +

      pdSection_(5, 'What your agent has said',
        (state && state.retentionBody
          ? '<p style="font-style:italic;padding:12px 15px;background:#F3F0E9;border-left:3px solid ' +
            PD_BRAND.teal + ';color:' + PD_BRAND.ink + '">' + pdEsc_(state.retentionBody) + '</p>' +
            (state.factFind ? '<p style="font-size:13px">Fact find: ' + pdEsc_(state.factFind) + '</p>'
                            : '<p style="font-size:13px;color:' + PD_BRAND.red + '">No fact find was attached.</p>')
          : '<p style="color:#5A6B7B">Nothing filed yet' +
            (d < SLA.AGENT_FILE_BY ? ' — due by day ' + SLA.AGENT_FILE_BY + '.' : ', and it is past day ' +
             SLA.AGENT_FILE_BY + '.') + '</p>')) +

      pdSection_(6, 'What the client sees next',
        '<p style="font-size:13.5px">At <b>day 75</b> a letter goes to ' + pdEsc_(p.Client) + ' <b>over your name</b>. ' +
        'At <b>day 88</b> they receive the final notice, and it carries the complete record of this policy — ' +
        'every letter, every reply, the day it came to you, and everything you record above. ' +
        'It also asks them directly whether anyone from this branch actually called them.</p>') +

      pdSigInternal_(),
      activation ? 'Day 60 — manager ownership' : 'Manager response required', true),

    /* The agent is copied when the case is handed over, so they know it left
       their desk. The branch manager joins from the second chase onward — one
       missed reply is a busy week, two is a pattern. */
    cc: (function () {
      var out = [];
      if (activation) out.push(pdStaffEmail_(p.Agent));
      if (chasing && waiting >= SLA.MANAGER_REPLY_DAYS + SLA.MANAGER_CHASE_EVERY) {
        out.push(pdStaffEmail_(p.Agent));
        out.push(pdValidEmail_(OUT.BRANCH_MANAGER_EMAIL));
      }
      var seen = {}, dedup = [];
      for (var i = 0; i < out.length; i++) {
        if (out[i] && !seen[out[i]]) { seen[out[i]] = 1; dedup.push(out[i]); }
      }
      return dedup;
    })()
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
  if (d >= 88 && d < 91) return 's90';                      // lands before the cliff, not on it
  if (state && state.responded) return '';                  // they answered — the sequence stops
  if (d >= 75 && d < 78) return 's75';
  if (d >= 45 && d < 48) return 's45';

  // between the milestones, while there is still silence
  if (d > 45 && d < SLA.LAPSE) {
    var since = d - 45;
    if (since % SLA.CLIENT_CHASE_EVERY === 0) return 'chase';
  }
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
    var s = map[policy] || (map[policy] = { responded: false, retentionTs: 0, verdict: false, chases: {},
                                            survey: null, trail: [], mgr: {}, mgrTs: 0, mgrName: '',
                                            activatedTs: 0, noteCount: 0 });
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
    else if (type.indexOf('outbound') === 0) {
      var stg = String(v[i][11] || '');
      if (TRAIL_LABEL[stg]) (s.trail = s.trail || []).push({ ts: ts, mine: false, what: TRAIL_LABEL[stg] });
    }
    else if (type.indexOf('internal') === 0) {
      var key = String(v[i][11] || '');
      s.chases[key] = Math.max(s.chases[key] || 0, ts);
      /* activatedTs counts SENT handovers only, never the dry-run plan. If a
         dry row set it, every policy planned during testing would be treated
         as already handed over on the day you go live, and no manager would
         ever be told. The dry rows still throttle re-planning through
         s.chases, so a dry run does not write the same line daily. */
      if (key === 'manager-60' && type === 'internal') s.activatedTs = Math.max(s.activatedTs, ts);
    }
  }
  return map;
}

/** The shape pdCaseState_ produces, for a policy that has no log rows yet. */
function pdEmptyState_() {
  return { responded: false, retentionTs: 0, verdict: false, chases: {}, survey: null, trail: [],
           mgr: {}, mgrTs: 0, mgrName: '', activatedTs: 0, noteCount: 0 };
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

/** Hand over at day 60, then nudge whoever is holding the case up. Returns 1 if something was sent. */
function pdInternalChase_(p, s) {
  var d = Number(p.DaysArrears) || 0;
  if (Number(p.Status) !== 2) return 0;                  // live arrears only — a 2014 lapse has nobody late on it
  if (d < SLA.RETENTION_OPENS || d >= SLA.LAPSE) return 0;
  var mgrName = pdManagerOf_(p.Agent);

  /* --- day 60: the handover ------------------------------------------------
     The client comes off the letter sequence here and the policy becomes the
     manager's, whether or not the agent has filed. Waiting for the filing was
     the old design and it is why cases sat: the agent had until day 65, the
     manager had three days after that, and a client who never heard from
     anybody was the normal outcome rather than the exception. */
  if (!s.activatedTs) {
    var lastPlan = s.chases['manager-60'];
    if (!lastPlan || pdDaysSince_(lastPlan) >= SLA.MANAGER_CHASE_EVERY) {
      var mTo0 = pdStaffEmail_(mgrName);
      var note0 = 'Day ' + d + ' — handover to ' + (mgrName || 'NO MANAGER MAPPED') +
                  '; client leaves the letter sequence until day 88';
      if (!mTo0 || OUT.DRY_RUN) { pdLogInternal_(p, 'manager-60', mTo0, note0, false); return 0; }
      var act = pdManagerLetter_(p, s, { activation: true });
      MailApp.sendEmail({
        to: mTo0, cc: act.cc.join(','), name: OUT.FROM_NAME,
        subject: act.subject, htmlBody: act.html
      });
      pdLogInternal_(p, 'manager-60', mTo0, note0, true);
      return 1;
    }
    return 0;
  }

  /* --- the agent has not filed ---
     Note the fall-through. The two clocks are independent now: the manager owns
     the policy from day 60 whether or not a case was ever filed, so an agent
     who is not yet late must not swallow the manager's deadline on the way
     past. Before the handover existed the manager clock only started at filing
     and an early return here was harmless. It is not harmless now. */
  var due = function (key) {
    return !s.chases[key] || pdDaysSince_(s.chases[key]) >= SLA.MANAGER_CHASE_EVERY;
  };
  if (!s.retentionTs && d >= SLA.AGENT_FILE_BY && due('agent-file')) {
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
        '<p>' + (mgrName ? pdEsc_(mgrName) + ' is copied.' : '') + '</p>' + pdSigInternal_(), 'Agent — action overdue', true)
    });
    pdLogInternal_(p, 'agent-file', aTo, note, true);
    return 1;
  }

  /* --- the manager has not answered ---
     The clock runs from whichever came first: the day-60 handover or the day
     the agent filed. Before, it ran only from the filing, so a manager who was
     handed a case and never received one from their agent had no deadline at
     all. */
  if (s.verdict) return 0;
  var startedTs = (s.activatedTs && s.retentionTs) ? Math.min(s.activatedTs, s.retentionTs)
                                                   : (s.activatedTs || s.retentionTs);
  if (!startedTs) return 0;
  var waiting = pdDaysSince_(startedTs);
  if (waiting < SLA.MANAGER_REPLY_DAYS) return 0;
  if (!due('manager-reply')) return 0;
  var lastChase = s.chases['manager-reply'];

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
    var s = states[String(p.Policy)] || pdEmptyState_();

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
    if (!pdMayEmail_(p)) {                                  // the client asked us not to
      pdLogSend_(p, stageKey, tpl, false);
      continue;
    }
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
  demoState.mgr = { mcontact:    { ak: 'yes',  lab: 'Yes — I have spoken with them', ts: now - 16 * day },
                    mclientsays: { ak: 'lower', lab: 'They need a smaller premium',  ts: now - 16 * day },
                    mvalue:      { ak: 'value', lab: 'It has value; cover can be sustained from it for a period', ts: now - 15 * day } };
  demoState.noteCount = 2;

  ['s45', 'chase', 's75', 's90', 'winback', 'pend', 'thanks'].forEach(function (k) {
    var t = pdRender(k, demo, demoState);
    Logger.log('--- %s ---\nSUBJECT: %s\nWHATSAPP: %s\n', k, t.subject, t.whatsapp);
  });
  Logger.log('--- manager day-60 handover ---\nSUBJECT: %s',
    pdManagerLetter_(demo, demoState, { activation: true }).subject);
}
