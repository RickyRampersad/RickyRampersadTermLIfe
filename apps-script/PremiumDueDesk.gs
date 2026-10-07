/******************************************************************************
 * PREMIUM DUE DESK — the 45-day line, worked by a person instead of a trigger
 * ============================================================================
 * INSTALL — two steps.
 *
 *   1. Apps Script editor → Files → + → Script. Name it: PremiumDueDesk
 *      Delete the myFunction it creates, paste this whole file, Save.
 *
 *   2. In Intelligence.gs, find the authenticated switch in intelRoute_ — the
 *      one BELOW `var session = iSession_(b.token)`, which reads
 *      "case 'intel.data':" — and add these three lines inside it:
 *
 *          case 'intel.pdd.list':    return pddList_(b, session);
 *          case 'intel.pdd.preview': return pddPreview_(b, session);
 *          case 'intel.pdd.send':    return pddSend_(b, session);
 *
 *      That is the only edit to an existing file. Nothing else changes.
 *
 *      THE NAMES MUST START WITH `intel.`. intelRoute_ opens with
 *          if (action.indexOf('intel.') !== 0) return null;
 *      so a bare `pdd.list` never reaches the switch at all: it falls through
 *      to handle_ in KPI.gs, which owns this project's doPost, and dies there
 *      on an unknown action. The first cut of this file said `pdd.list`, so
 *      the three cases were dead code against a live deployment and the desk
 *      answered "Session expired" to a signed-in user. Probed from outside,
 *      every pdd.* action returned KPI.gs's own refusal, never this file's.
 *
 * WHY THIS EXISTS. intelSurveySend(45) already finds today's 45-day cohort and
 * writes to all of them at once, from the script editor. That is the right
 * machine and the wrong hand on it: nobody at the branch sees who is about to
 * be written to, nobody checks a row before it goes, and the only way to send
 * to four people instead of forty is to not run it at all.
 *
 * This desk puts the same machine behind a screen. Staff sign in, see exactly
 * who is on today's line, read the letter that would go to any one of them,
 * tick the ones they have checked, and send only those.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 *   It does not decide who is due. iSurveyPool_ does that, and this calls it,
 *   so the desk and the nightly run can never disagree about who is on the
 *   line. One definition, two doors.
 *
 *   It does not build its own letter. The preview is iSurveyHtml_ — the same
 *   function the send uses, on the same row. A preview that renders through
 *   different code is not a preview, it is a second letter nobody checked.
 *
 *   It does not bypass the approval gate. iSurveyBlocked_ is re-checked on the
 *   way out, server-side, after the browser has had its say. A conduct rule
 *   that a web page can talk its way past is not a rule.
 *
 *   It does not widen anybody's view. An agent sees their own rows; staff and
 *   managers see the branch, exactly as every other screen in this system.
 ******************************************************************************/

var PDD = {
  STAGE: 45,
  MAX_PER_SEND: 40      // one person, one sitting. More than this is a cohort, not a day.
};

/* ──────────────────────────────────────────────────────────────────────────
   WHAT THE DESK SHOWS
   ──────────────────────────────────────────────────────────────────────────
   Everything a person needs to decide "yes, write to this one" without
   opening another tab: who they are, what they hold, how they pay, how long
   they have been with us, when the cover actually lapses, and anything about
   the row that should give them pause.
   ────────────────────────────────────────────────────────────────────────── */
function pddList_(b, session) {
  var stage = Math.round(iNum_(b && b.stage)) || PDD.STAGE;
  var pool = iSurveyPool_(stage);
  if (pool.error) return iErr_(pool.error);

  var mine = pddScope_(pool.rows || [], session);
  var out = mine.map(function (d) { return pddRow_(d); });

  /* Most urgent first: the soonest to lapse, then the largest premium. A desk
     sorted by whatever order the tab happens to be in is a desk worked from
     the top until the day runs out. */
  out.sort(function (x, y) {
    if (x.lapseSort !== y.lapseSort) return x.lapseSort - y.lapseSort;
    return y.premium - x.premium;
  });

  return iOk_({
    stage: stage,
    today: Utilities.formatDate(iToday_(), iTz_(), 'd MMMM yyyy'),
    rows: out,
    skipped: pool.skipped || {},
    mail: iMailState_(),
    blocked: iSurveyBlocked_(),          // '' when the wording is approved and current
    approvedBy: iProp_('INTEL_SURVEY_APPROVED_BY') || '',
    cap: PDD.MAX_PER_SEND,
    you: { name: session.name, role: session.role, branchWide: iSeesBranch_(session.role) }
  });
}

/* An agent sees their own book and nobody else's. Staff, the branch manager
   and their supervisor work every agent's cases, so they get the branch. A
   unit manager gets their unit. Same rule the rest of the system uses. */
function pddScope_(rows, session) {
  if (iSeesBranch_(session.role)) return rows;
  var me = iNameKey_(session.agentName || session.name);
  if (!me) return [];
  if (session.role === 'unit') {
    var team = {};
    var members = (iBuildUnits_() || {})[String(session.unit || '').trim()] || [];
    members.forEach(function (m) { var k = iNameKey_(m.name); if (k) team[k] = 1; });
    team[me] = 1;
    return rows.filter(function (d) { return team[iNameKey_(d.agent)]; });
  }
  return rows.filter(function (d) { return iNameKey_(d.agent) === me; });
}

/* One row, as the screen needs it. No letter HTML here — that is a separate
   call, because forty rendered letters is a payload nobody asked for. */
function pddRow_(d) {
  var lapse = pddDate_(pddLapseMap_()[String(d.policy || '')] || d.lapseDate || '');
  var flags = [];
  var roster = pddRoster_(), who = iNameKey_(d.agent);

  /* Who the letter is sent in the name of. The branch-wide switch for an agent
     who has gone is INTEL_EXCLUDE_AGENTS (intelExclude), which takes their book
     off every wall at once; these two only catch what that switch has not been
     told about yet, and they show the client rather than hiding them. */
  if (who && roster.known[who] && !roster.active[who]) {
    flags.push('Their adviser is marked not active on the access list. Do not ask this client '
             + 'to rate them \u2014 this is a reassignment call, not a 45-day letter.');
  }
  if (d.unit === 'Unassigned') {
    flags.push('This adviser is not on any unit. Check who looks after this client before '
             + 'anything goes out in their name.');
  }
  if (who && who === iNameKey_(d.client)) {
    flags.push('The client and the adviser are the same person \u2014 this is the adviser\u2019s own '
             + 'policy, not a client\u2019s. It should not get a letter asking them to rate themselves.');
  }

  /* The things worth a second's thought before a letter goes. Each one is a
     real pattern in this book, not a hypothetical. */
  if (pddLooksLikeCompany_(d.client)) {
    flags.push('Reads like a company. A scheme gets one remittance note, not a letter asking it to rate its adviser.');
  }
  if (!d.premium) {
    flags.push('No premium on the row.');
  }
  if (!d.billing) {
    flags.push('No billing route on file, so the letter cannot say how the payment stopped.');
  }
  if (iNum_(d.years) < 1) {
    flags.push('With us under a year — check this is not a first collection that simply failed.');
  }

  return {
    policy:   String(d.policy || ''),
    clientNo: String(d.clientNo || ''),
    client:   String(d.client || ''),
    agent:    String(d.agent || ''),
    unit:     String(d.unit || ''),
    email:    String(d.email || ''),
    premium:  iNum_(d.premium),
    years:    iNum_(d.years),
    billing:  String(d.billing || ''),
    lapse:    lapse ? Utilities.formatDate(lapse, iTz_(), 'd MMM yyyy') : '',
    lapseSort: lapse ? lapse.getTime() : 8640000000000,
    subject:  (d.tpl && d.tpl.subject) ? d.tpl.subject(d) : '',
    flags:    flags
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   THE LAPSE DATE
   ──────────────────────────────────────────────────────────────────────────
   iSurveyPool_ reads ten columns off the dues tab and the projected lapse
   date is not one of them, so the desk's first live run showed "no lapse
   date" against all twenty-two clients while the Branch Portfolio held one
   for every single row. The letter leads on that date and the desk sorts by
   it, so an empty one is not cosmetic: it sorts the day by nothing.

   Read here rather than by widening iSurveyPool_, because that function
   feeds the nightly send too and this file is meant to add nothing to it.
   One read per run, memoised.
   ────────────────────────────────────────────────────────────────────────── */
var PDD_LAPSE = null;
function pddLapseMap_() {
  if (PDD_LAPSE) return PDD_LAPSE;
  var map = {};
  try {
    var sh = iTabDues_();
    if (sh) {
      var d = iReadCols_(sh, { number: ['number'], lapse: ['projected lapse date'] });
      if (d.has('number') && d.has('lapse')) {
        for (var r = 0; r < d.rows; r++) {
          /* Keyed exactly as iSurveyPool_ keys its own policy field, because a
             join that is one trim apart from the thing it joins to silently
             matches nothing and reads as missing data. */
          var pol = String(d.get('number', r) || '').replace(/^\s+|\s+$/g, '');
          var v = d.get('lapse', r);
          if (!pol || v === '' || v == null) continue;
          map[pol] = v;
          var bare = pol.replace(/\.0$/, '');
          if (bare !== pol && !map[bare]) map[bare] = v;
        }
      }
    }
  } catch (e) { /* no tab, no column: the desk still works, just without dates */ }
  return (PDD_LAPSE = map);
}

/* ──────────────────────────────────────────────────────────────────────────
   WHO IS STILL HERE
   ──────────────────────────────────────────────────────────────────────────
   The access tabs carry an Active column, and the sign-in already refuses
   anyone it marks no/inactive/disabled/off. The desk has to read it too: a
   letter asking a client to rate the service they had from an adviser who
   has resigned is the worst letter this branch could send, and on the first
   live run six of the twenty-two were exactly that.
   ────────────────────────────────────────────────────────────────────────── */
var PDD_ROSTER = null;
function pddRoster_() {
  if (PDD_ROSTER) return PDD_ROSTER;
  var active = {}, known = {};
  try {
    iAccessTabs_().forEach(function (sh) {
      var head = iHeaders_(sh), last = sh.getLastRow();
      if (last < 2) return;
      var cName = iCol_(head, ['agent name (exactly as in data)', 'agent', 'name']),
          cAct  = iCol_(head, ['active']);
      if (cName < 0) return;
      sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().forEach(function (row) {
        var k = iNameKey_(row[cName]);
        if (!k) return;
        known[k] = 1;
        var off = cAct >= 0 && /^(no|inactive|disabled|off|resigned|terminated)$/i
                    .test(String(row[cAct]).replace(/^ +| +$/g, ''));
        if (!off) active[k] = 1;
      });
    });
  } catch (e) { /* no access tab: everyone reads as known, nothing is flagged */ }
  return (PDD_ROSTER = { active: active, known: known });
}

function pddDate_(v) {
  if (v instanceof Date) return v;
  var s = String(v || '').trim();
  if (!s) return null;
  var t = new Date(s);
  return isNaN(t.getTime()) ? null : t;
}

function pddLooksLikeCompany_(name) {
  return /\b(limited|ltd|company|services|holdings|enterprises?|inc|group|school|church|association|credit union|farms)\b/i
    .test(String(name || ''));
}

/* ──────────────────────────────────────────────────────────────────────────
   THE PREVIEW IS THE LETTER
   ──────────────────────────────────────────────────────────────────────────
   Rendered by iSurveyHtml_, the same function the send calls, on the same row
   out of the same pool. The only difference is that this one carries a
   preview token, so a tap from a preview can never be mistaken for a client's
   answer.
   ────────────────────────────────────────────────────────────────────────── */
function pddPreview_(b, session) {
  var stage = Math.round(iNum_(b && b.stage)) || PDD.STAGE;
  var policy = String((b && b.policy) || '').trim();
  if (!policy) return iErr_('Which policy? Pass policy.');

  var pool = iSurveyPool_(stage);
  if (pool.error) return iErr_(pool.error);
  var mine = pddScope_(pool.rows || [], session);
  var d = null;
  for (var i = 0; i < mine.length; i++) {
    if (String(mine[i].policy) === policy) { d = mine[i]; break; }
  }
  if (!d) return iErr_('That policy is not on today’s ' + stage + '-day line, or it is not yours to see.');

  d.token = 'preview';
  d.base  = iSurveyBase_();
  return iOk_({
    policy: policy,
    client: String(d.client || ''),
    to:     String(d.email || ''),
    cc:     pddCc_(d).join(', '),
    subject: (d.tpl && d.tpl.subject) ? d.tpl.subject(d) : '',
    html:   iSurveyHtml_(d)
  });
}

/* Agent, desk and unit manager, de-duplicated — the same chain the nightly
   send copies, read off the access list rather than typed in here. */
function pddCc_(d) {
  var support = iSurveySupport_();
  return [d.agentEmail, support.desk, support.managerFor(d.unit)]
    .filter(function (x) { return x; })
    .filter(function (x, i, a) { return a.indexOf(x) === i; });
}

/* ──────────────────────────────────────────────────────────────────────────
   THE SEND
   ──────────────────────────────────────────────────────────────────────────
   Only the policies the person actually ticked, each one re-read from the
   pool rather than trusted from the browser. The row that lands in the
   Survey tab records who authorised it by name, because "live" in a log
   column does not tell anybody in six months' time who pressed the button.
   ────────────────────────────────────────────────────────────────────────── */
function pddSend_(b, session) {
  var stage = Math.round(iNum_(b && b.stage)) || PDD.STAGE;
  var want = (b && b.policies) || [];
  if (!want.length) return iErr_('Nothing was ticked.');
  if (want.length > PDD.MAX_PER_SEND) {
    return iErr_(want.length + ' at once is over the ' + PDD.MAX_PER_SEND + ' cap for one sitting. '
      + 'Send the most urgent, then come back to the rest.');
  }

  var live = String(iProp_('INTEL_SURVEY_LIVE') || '').trim().toLowerCase() === ISURVEY.LIVE_PHRASE;
  var test = iProp_('INTEL_TEST_TO');

  /* The gate, checked here and not only on the screen. */
  var blocked = iSurveyBlocked_();
  if (live && blocked) return iErr_('STOPPED — ' + blocked);

  var pool = iSurveyPool_(stage);
  if (pool.error) return iErr_(pool.error);
  var mine = pddScope_(pool.rows || [], session);
  var byPolicy = {};
  mine.forEach(function (d) { byPolicy[String(d.policy)] = d; });

  var sh = iSurveyTab_(), base = iSurveyBase_();
  var mode = live ? 'live' : (test ? 'test' : 'dry');
  var sent = [], missed = [];

  want.forEach(function (p) {
    var d = byPolicy[String(p).trim()];
    if (!d) { missed.push(String(p)); return; }

    d.token = Utilities.getUuid().replace(/-/g, '');
    d.base = base;
    var html = iSurveyHtml_(d);
    var cc = pddCc_(d).join(',');
    var subject = (d.tpl && d.tpl.subject) ? d.tpl.subject(d) : 'Your policy with us';

    if (mode === 'live') {
      MailApp.sendEmail({ to: d.email, cc: cc, name: 'Ricky Rampersad Branch',
                          subject: subject, htmlBody: html });
    } else if (mode === 'test') {
      MailApp.sendEmail({ to: test, name: 'Branch Intelligence',
        subject: '[TEST] ' + subject,
        htmlBody: '<div style="background:#E8A020;color:#00254d;padding:10px 14px;'
          + 'font:700 13px sans-serif;border-radius:8px;margin-bottom:14px">TEST MODE — this would '
          + 'have gone to ' + iEsc_(d.email) + ', copying ' + iEsc_(cc || 'nobody') + '. Released by '
          + iEsc_(session.name) + ' at the premium due desk.</div>' + html });
    }

    sh.appendRow([d.token, new Date(), d.clientNo, d.client, d.email, d.policy, d.agent,
                  d.unit, d.years, d.tpl ? d.tpl.id : '', d.billing, d.premium,
                  d.tpl ? d.tpl.id : '',
                  '', '', '', '',
                  mode + ' · desk · released by ' + session.name
                       + (live ? ' · cleared ' + iSurveyHash_() + ' by ' + iProp_('INTEL_SURVEY_APPROVED_BY') : ''),
                  '', '', '', '', '', '', '',
                  '', '', '', '',
                  stage]);
    sent.push(String(d.policy));
  });

  return iOk_({
    mode: mode,
    sent: sent.length,
    policies: sent,
    missed: missed,
    by: session.name,
    says: mode === 'live'
      ? sent.length + ' letter' + (sent.length === 1 ? '' : 's') + ' sent, copying the agent, the desk and the unit manager.'
      : mode === 'test'
        ? sent.length + ' built and routed to ' + test + '. No client was written to.'
        : sent.length + ' built and logged. Nothing was delivered — client mail is held. '
          + 'Set INTEL_SURVEY_LIVE to "' + ISURVEY.LIVE_PHRASE + '" when you mean it.'
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   FROM THE EDITOR — read today's line without sending anything.
   ────────────────────────────────────────────────────────────────────────── */
function pddToday() {
  var pool = iSurveyPool_(PDD.STAGE);
  if (pool.error) { Logger.log(pool.error); return pool.error; }
  var rows = (pool.rows || []).map(pddRow_);
  rows.sort(function (x, y) { return x.lapseSort - y.lapseSort; });
  /* Say whether the joins worked, not just what they produced. "No lapse date"
     against every client read as a data problem for a day when it was a column
     this file never asked for; a line that counts the join turns the next one
     of those into a measurement instead of a guess. */
  var lapses = pddLapseMap_(), nLapse = 0, roster = pddRoster_(), nKnown = 0, flagged = 0;
  rows.forEach(function (r) {
    if (r.lapse) nLapse++;
    if (roster.known[iNameKey_(r.agent)]) nKnown++;
    if (r.flags.length) flagged++;
  });
  var out = ['Day-' + PDD.STAGE + ' line, ' + Utilities.formatDate(iToday_(), iTz_(), 'd MMMM yyyy'),
             rows.length + ' client' + (rows.length === 1 ? '' : 's') + ' on it, '
               + flagged + ' with something to check.',
             'Client mail: ' + iMailState_().clients + '.',
             (iSurveyBlocked_() ? 'WORDING: ' + iSurveyBlocked_() : 'Wording approved by '
               + (iProp_('INTEL_SURVEY_APPROVED_BY') || '(nobody)')),
             'Joins: lapse date on ' + nLapse + '/' + rows.length + ' (book holds '
               + Object.keys(lapses).length + '), adviser on the access list '
               + nKnown + '/' + rows.length + '.',
             'Off every report (INTEL_EXCLUDE_AGENTS): '
               + (String(iProp_('INTEL_EXCLUDE_AGENTS') || '').replace(/^\s+|\s+$/g, '') || 'nobody'),
             ''];
  rows.slice(0, 40).forEach(function (r) {
    out.push([r.policy, r.client, r.agent, '$' + r.premium, r.billing,
              r.lapse ? 'lapses ' + r.lapse : 'no lapse date'].join('  ·  '));
    /* The flags in full. A count tells you something is wrong; it does not tell
       you the adviser resigned a fortnight ago, which is the bit that stops a
       letter going out this morning. */
    r.flags.forEach(function (f) { out.push('        ** ' + f); });
  });
  if (rows.length > 40) out.push('… and ' + (rows.length - 40) + ' more.');
  /* Logged, not just returned. The Run button shows what a function LOGS; a
     returned string goes nowhere, so the first run of this spent 77 seconds
     reading the whole book and printed an empty log. */
  var text = out.join('\n');
  Logger.log(text);
  return text;
}
