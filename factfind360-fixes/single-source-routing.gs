// ═════════════════════════════════════════════════════════════════════════════
//  ONE SHEET, ONE TRUTH — point the fact find at the Access tab
//
//  Project : "RR Branch FF System"   File : Code.gs
//
//  Today the fact find reads staff data from a Salesforce export in a SECOND
//  workbook (1K65acMFF…, the "Agent Count" tab). That export is not yours to
//  control — its tab name has a typo, its unit column is called "Units" where
//  the code looks for "hierachy", and another tab in the same workbook is
//  mistaken for the roster and read instead. The net effect is that the roster
//  loads EMPTY, and routing silently falls back to the Branch Manager.
//
//  After this change the fact find reads staff data from the Access tab in its
//  own workbook (1iytBbnETQ…) and never opens the other file. One sheet. The
//  same sheet that controls sign-in, so a missing agent is noticed the day they
//  cannot log in rather than nine cases later.
//
//  TWO edits. Both in Code.gs. Then redeploy and clear the cache — see the end.
// ═════════════════════════════════════════════════════════════════════════════


/* ─────────────────────────────────────────────────────────────────────────────
   EDIT 1 of 2 — replace the WHOLE of ffLoadRoster_()

   In Code.gs, select the entire existing function — it starts at

       function ffLoadRoster_() {

   and ends at the closing brace just before the comment
   "── Helper: determine Direct Manager from agent code via Roster unit ─"
   (roughly 48 lines) — and paste this in its place.

   Every one of the 12 places that call ffLoadRoster_() keeps working, because
   this returns the identical shape: { AGENTCODE: {name, email, unit} }.
   ───────────────────────────────────────────────────────────────────────────── */

function ffLoadRoster_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("rrb_ff_roster");
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  // The Access tab, in THIS workbook, is the branch's record of who works here,
  // what they are, and who they report to. It is the same tab that decides who
  // may sign in — which is the point. A person missing from it cannot log in,
  // so somebody reports it immediately; the old Salesforce export could go
  // stale for months and the only symptom was mail quietly going to the wrong
  // manager.
  var roster = {};
  var rows;
  try {
    rows = rrbAccessSheet_();
  } catch (err) {
    // Never throw from here — a dozen callers depend on this and a submission
    // in flight must not die because a tab was renamed. Say so loudly instead.
    Logger.log('ffLoadRoster_: cannot read the Access tab — %s', err && err.message);
    return {};
  }

  rows.forEach(function (p) {
    if (!p.active) return;
    var code = _str(p.code).toUpperCase().trim();
    if (!/^A\d{4,6}$/.test(code)) return;
    roster[code] = {
      name:  p.name,
      email: p.email,
      unit:  p.unit      // a manager's NAME, e.g. "Akaash Kalladeen"
    };
  });

  if (!Object.keys(roster).length) {
    Logger.log('ffLoadRoster_: the Access tab produced no usable agents. ' +
               'Check the Agent Number and Active columns.');
  }

  try { cache.put("rrb_ff_roster", JSON.stringify(roster), 1800); } catch (e) {}
  return roster;
}


/* ─────────────────────────────────────────────────────────────────────────────
   EDIT 2 of 2 — the last five lines of ffLookupDirectManager_()

   Leave the ROSTER_UNIT_TO_KEY and AGENT_TO_KEY blocks exactly as they are.
   Only the tail changes. FIND these five lines at the end of the function:

       var code = String(agentCode || "").toUpperCase().trim();
       // Static map from the branch report is authoritative; roster manager-name match is backup
       if (AGENT_TO_KEY[code]) return AGENT_TO_KEY[code];
       var roster = ffLoadRoster_();
       var ag = roster[code];
       if (ag && ag.unit && ROSTER_UNIT_TO_KEY[ag.unit]) return ROSTER_UNIT_TO_KEY[ag.unit];
       return "ricky"; // default fallback (Branch Direct)

   REPLACE them with this. The order is deliberately inverted: the sheet you
   maintain now beats the list hardcoded here, which is what let A14158 route
   to the wrong manager for nine cases.
   ───────────────────────────────────────────────────────────────────────────── */

//  var code = String(agentCode || "").toUpperCase().trim();
//
//  // The Access tab wins. It is edited by the branch and is the same record
//  // that grants sign-in, so it is the one most likely to be correct.
//  var roster = ffLoadRoster_();
//  var ag = roster[code];
//  if (ag && ag.unit && ROSTER_UNIT_TO_KEY[ag.unit]) return ROSTER_UNIT_TO_KEY[ag.unit];
//
//  // Safety net while Access is being verified. Delete this block once you are
//  // happy every agent carries a Unit — it is the map that went stale before.
//  if (AGENT_TO_KEY[code]) {
//    Logger.log('ffLookupDirectManager_: %s not resolved from Access — used the ' +
//               'old static map (%s). Give them a Unit on the Access tab.',
//               code, AGENT_TO_KEY[code]);
//    return AGENT_TO_KEY[code];
//  }
//
//  // Nobody knows this agent. This used to happen in complete silence.
//  Logger.log('ffLookupDirectManager_: %s is UNMAPPED — routing to the Branch ' +
//             'Manager. Add them to the Access tab with a Unit.', code);
//  rrbNoteUnmapped_(code);
//  return "ricky";
//}

/*  ↑ uncomment the block above when pasting — the comment markers are only so
    this file does not declare a duplicate function while you are reading it.  */


/* ─────────────────────────────────────────────────────────────────────────────
   Paste this small helper anywhere in Code.gs — it is what makes an unmapped
   agent visible instead of silent. Keeps a rolling list you can read any time
   with rrbShowUnmapped(), and the digest can surface it later.
   ───────────────────────────────────────────────────────────────────────────── */

function rrbNoteUnmapped_(code) {
  try {
    var props = PropertiesService.getScriptProperties();
    var seen = JSON.parse(props.getProperty('RRB_UNMAPPED') || '{}');
    seen[code] = { last: new Date().toISOString(), count: (seen[code] && seen[code].count || 0) + 1 };
    props.setProperty('RRB_UNMAPPED', JSON.stringify(seen));
  } catch (e) { /* never let bookkeeping break a submission */ }
}

/** Run by hand any time: who has submitted without a Unit on the Access tab. */
function rrbShowUnmapped() {
  var seen = {};
  try { seen = JSON.parse(PropertiesService.getScriptProperties().getProperty('RRB_UNMAPPED') || '{}'); }
  catch (e) {}
  var codes = Object.keys(seen);
  if (!codes.length) { Logger.log('No unmapped agents recorded. Everyone resolves from Access.'); return {}; }
  codes.forEach(function (c) {
    Logger.log('%s — %s submission(s), last %s', c, seen[c].count, seen[c].last);
  });
  return seen;
}

/** Clears the list, e.g. after fixing the Access tab. */
function rrbClearUnmapped() {
  PropertiesService.getScriptProperties().deleteProperty('RRB_UNMAPPED');
  Logger.log('Unmapped list cleared.');
}


/* ─────────────────────────────────────────────────────────────────────────────
   AFTER PASTING — in this order

   1. Deploy ▸ Manage deployments ▸ Edit (pencil) ▸ New version ▸ Deploy.
      Keep the SAME deployment so the /exec URL does not change.

   2. CLEAR THE CACHE. This matters. ffLoadRoster_() caches for 30 minutes, and
      the currently cached value is the empty roster from the old code. Until it
      is cleared the new code returns that same empty result and nothing looks
      fixed. Either open

          <your /exec URL>?action=clear_cache

      or just wait half an hour.

   3. Check it worked — run this in the editor:

          function checkRouting() {
            ['A14158','A10428','A12001','A13777'].forEach(function (c) {
              Logger.log('%s -> %s', c, ffLookupDirectManager_(c));
            });
          }

      Expected: A14158 akaash, A10428 ricky, A12001 akaash, A13777 gary.
      A14158 and A13777 are the only two that change; the other 32 agents keep
      exactly the manager they have today.

   4. Once you are happy, delete the AGENT_TO_KEY block and its safety-net
      lines. The Access tab is then the only thing deciding where mail goes.

   The other workbook (1K65acMFF…) is still used for production, portfolio and
   settled reporting. This change only stops the FACT FIND reading staff data
   from it.
   ───────────────────────────────────────────────────────────────────────────── */
