/******************************************************************************
 * PREMIUM DUE DESK — four lines, 45, 60, 75 and 90 days: checked by a person, sent at ten
 * ============================================================================
 * INSTALL, in the Branch Intelligence project (the tracker's).
 *
 *   1. Paste this whole file over PremiumDueDesk.gs, and Intelligence.gs over
 *      Intelligence.gs (all over, not at the bottom). Save.
 *   2. Deploy → Manage deployments → pencil → Version: New version → Deploy,
 *      so the desk's page reaches the new code. The ten o'clock send runs
 *      from the saved code and needs nothing more.
 *   3. The letters' wording changed on 13 October 2026, so the approval on
 *      file no longer matches: read the four letters, then run
 *      intelSurveyApprove("<reviewer>"). Until then live sends stop; test
 *      copies still go.
 *
 *   That is all. intelRoute_ in Intelligence.gs hands every intel.pdd.* action
 *   to pddRoute_ below, and intelPendingRefresh, the hourly trigger the
 *   project already has, calls the ten o'clock send. The three case lines this
 *   file once asked to be typed into intelRoute_ by hand are in Intelligence.gs
 *   itself now, so a paste of it can no longer lose them. A ping to the web
 *   app answers `desk` with this file's version, or '' when it is missing.
 *
 * WHAT CHANGED ON 7 OCTOBER 2026. Asked for in these words: "a trigger go out
 * when a client premium is 45 days due with built in responses for them to
 * select", then "a staff has to do a check mark to ensure due diligence is
 * done, once they check it goes out", then "a time at 10am". So:
 *
 *   A TICK IS A CHECK, recorded the moment it is made, on the Premium Due
 *   Checks tab: who checked which client, when, and anything flagged on the
 *   row that they ticked through. The tick is enabled only once that client's
 *   letter has been opened on the desk. There is no send button and no "tick
 *   all" any more: one tick is one person saying they checked one client.
 *   A client they decide against is marked "Do not send", with the reason,
 *   so the decision is on the record too and the row stops asking.
 *
 *   THE LETTERS GO AT TEN, on a working day, Monday to Friday. Ticked before
 *   ten, a letter goes that morning; ticked after, at ten on the next working
 *   day. The send runs inside intelPendingRefresh, the hourly trigger, from
 *   the ten o'clock hour, because the project is one trigger short of its
 *   twenty; a firing Apps Script misses at ten is caught up at eleven.
 *
 *   THE LINE IS A WEEK WIDE: 45 to 51 days. The old line was the 45th day
 *   exactly, so a client who reached it on a Saturday was never on a weekday's
 *   line, and a tick made after ten would have found its client at 46 the
 *   next morning and gone nowhere. A client already written to at 45 in this
 *   episode is still off the line, so a wider line never means a second letter.
 *
 *   THE RESPONSES ARE THE LETTER'S OWN: the rating out of five, and the five
 *   taps under it (a review of my cover, something is not right, write to the
 *   branch manager privately, talk about my options, do not contact me
 *   again).
 *
 * WHAT CHANGED ON 13 OCTOBER 2026. "45 days, 60 days, 75 days and 90 days
 * for staff to check … the same thing we did for groups, whereby you have the
 * tabs and you have filters and you have the agents", in test mode while the
 * branch trains; and "build a lot of intelligence around the data we have, as
 * there was a lot of servicing work". So:
 *
 *   FOUR LINES, each a week wide (PDD.STAGES), read in one pass. Each has its
 *   own letter (ISURVEY_STAGES in Intelligence.gs): the rating is asked once,
 *   on the first letter a client gets; the 75 names the day the cover stops;
 *   the 90 sets out the options. A check belongs to the line it was made on.
 *
 *   WHAT WE KNOW about each client, beside their letter (pddIntel_): their
 *   policies, the others behind or lapsed, every letter this episode and the
 *   answer, and the branch team's work for them in Salesforce. And, for the
 *   branch, what happened after the letters (pddOutcomes_).
 *
 * WHAT THE TEN O'CLOCK SEND CHECKS, AGAIN, AT TEN.
 *
 *   It reads the line afresh, never the desk's copy, and sends only a client
 *   who is still on it: still unpaid on the extract, still with an address,
 *   not opted out, not written to since. The address and the agent must be
 *   the ones that were checked; if either has changed, it does not go, and
 *   the desk says why. A tick withdrawn before ten never goes.
 *
 *   It sends to clients only when client mail is live (INTEL_SURVEY_LIVE,
 *   and no INTEL_TEST_TO) and the wording is approved. In test mode each
 *   ticked letter goes to the test inbox instead, tagged, and the client is
 *   not marked as written to. Held, nothing goes and the ticks wait.
 *
 *   It keeps inside the day's mail allowance. A consumer Google account may
 *   e-mail about a hundred recipients a day, every copy counted, and each of
 *   these letters copies the agent, the desk and the unit manager. When the
 *   allowance runs short the rest wait for the next working day, oldest first.
 *
 *   A letter is logged on Intel Surveys before it is sent and the log is
 *   taken back if the mail fails, so a client is never written to twice and
 *   never marked as written to by a letter that did not go.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 *   It does not decide who is due. iSurveyPool_ does that, and this calls it,
 *   so the desk and the editor's run can never disagree about who is on the
 *   line. One definition, two doors.
 *
 *   It does not build its own letter. The preview is iSurveyHtml_, the same
 *   function the send uses, on the same row.
 *
 *   It does not bypass the approval gate. iSurveyBlocked_ is checked again
 *   at ten, server-side.
 *
 *   It does not widen anybody's view. An agent sees their own rows and a unit
 *   manager their unit's, and neither ticks: the letter asks the client to
 *   rate their agent, so who gets one is not the agent's call. Staff and the
 *   branch manager see the branch and tick.
 ******************************************************************************/

var PDD = {
  VERSION: '2026-10-13a',
  STAGE: 45,            // the first line; the page and the editor helpers read it as the default
  STAGES: [45, 60, 75, 90],   // the four lines (13 October 2026: "45 days, 60 days, 75 days and 90 days")
  LATE: 6,              // days past each stage a client stays on its line: 45 to 51, 60 to 66, 75 to 81, 90 to 96
  HOUR: 10,             // the send, ten in the morning, Monday to Friday
  MAX_PER_RUN: 60,      // ISURVEY.MAX_RUN: more than this in a morning is a cohort, not a day
  RESERVE: 10,          // recipients of the day's mail allowance kept for the branch's own mail
  BUDGET_MS: 240000,    // four minutes of sending; the rest go at the next hour's firing
  KEEP_DAYS: 14,        // how long a check still speaks for a client on the line
  POOL_TTL: 600,        // seconds the desk keeps the line it read; the send always reads afresh
  TAB: 'Premium Due Checks'
};

var PDD_HEAD = ['Checked at', 'Goes on', 'Policy', 'Client number', 'Client', 'E-mail', 'Agent',
                'Days due', 'Checked by', 'Decision', 'Reason', 'Status', 'Done at', 'Token', 'Note'];
var PCOL = { AT: 1, GOES: 2, POLICY: 3, CLIENTNO: 4, CLIENT: 5, EMAIL: 6, AGENT: 7, DAYS: 8,
             BY: 9, DECISION: 10, REASON: 11, STATUS: 12, DONE: 13, TOKEN: 14, NOTE: 15 };

/* What a check's Status can say, in the words the tab shows:
     waiting      ticked, for the next ten o'clock send
     sending      being sent this minute
     sent         gone to the client
     test copy    gone to the test inbox; the client was not written to
     not sent     the send found a reason not to; the Note says which
     withdrawn    unticked before it went
     not sending  a person decided against it; the Reason says why
     undone       that decision taken back                                 */

/* ──────────────────────────────────────────────────────────────────────────
   THE DOOR
   ────────────────────────────────────────────────────────────────────────── */
function pddRoute_(action, b, session) {
  pddRememberUrl_();
  switch (action) {
    case 'intel.pdd.list':    return pddList_(b, session);
    case 'intel.pdd.preview': return pddPreview_(b, session);
    case 'intel.pdd.tick':    return pddTick_(b, session);
    case 'intel.pdd.skip':    return pddSkip_(b, session);
    case 'intel.pdd.send':    return pddSend_(b, session);
  }
  return iErr_('Unknown action: ' + action);
}

/* Staff and the branch manager tick. An agent never does: the letter asks the
   client to rate them. */
function pddCanTick_(session) {
  return !!session && iSeesBranch_(session.role);
}

/* The taps in a letter point at this web app's /exec address. A trigger
   cannot be relied on to know it (Apps Script hands a time trigger the /dev
   address, which only the project's editors can open), so the desk notes it
   whenever a person uses the desk, and the ten o'clock send reads it back.
   INTEL_EXEC_URL, when set, wins. */
function pddRememberUrl_() {
  try {
    var u = String(ScriptApp.getService().getUrl() || '');
    if (/\/exec$/.test(u) && iProp_('PDD_EXEC_URL') !== u) iSetProp_('PDD_EXEC_URL', u);
  } catch (e) { /* not a web request */ }
}
function pddBase_() {
  var u = String(iProp_('INTEL_EXEC_URL') || '').trim();
  if (/\/exec$/.test(u)) return u;
  u = String(iProp_('PDD_EXEC_URL') || '').trim();
  if (/\/exec$/.test(u)) return u;
  try { u = String(ScriptApp.getService().getUrl() || ''); } catch (e) { u = ''; }
  return /\/exec$/.test(u) ? u : '';
}

/* ──────────────────────────────────────────────────────────────────────────
   THE CLOCK
   Everything here is on the workbook's own clock (iTz_), the clock the
   branch reads.
   ────────────────────────────────────────────────────────────────────────── */
function pddFmt_(d, f) { return Utilities.formatDate(d, iTz_(), f); }
function pddDay_(d) { return pddFmt_(d, 'yyyy-MM-dd'); }
function pddHour_(d) { return Number(pddFmt_(d, 'H')); }
function pddWorkday_(d) { var u = Number(pddFmt_(d, 'u')); return u >= 1 && u <= 5; }
function pddNextWorkday_(d) {
  var x = new Date(d.getTime());
  do { x = new Date(x.getTime() + 86400000); } while (!pddWorkday_(x));
  return x;
}
/* An ISO day as a moment inside it: noon in Trinidad, four hours behind UTC. */
function pddNoon_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 16)) : null;
}
function pddIsoGap_(a, b) {
  var x = pddNoon_(a), y = pddNoon_(b);
  return x && y ? Math.round((y.getTime() - x.getTime()) / 86400000) : 0;
}
function pddIso_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : pddDay_(v);
  var s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/* The ten o'clock send a check made at `at` belongs to: that morning's when it
   was made before ten on a working day, otherwise the next working day's. */
function pddGoesFor_(at) {
  if (pddWorkday_(at) && pddHour_(at) < PDD.HOUR) return pddDay_(at);
  return pddDay_(pddNextWorkday_(at));
}
/* The next send that has not gone yet: today's until it has gone, then the
   next working day's. */
function pddNextSend_(now) {
  if (pddWorkday_(now) && iProp_('PDD_SENT_ON') !== pddDay_(now)) return pddDay_(now);
  return pddDay_(pddNextWorkday_(now));
}
function pddDayWords_(iso, now) {
  var today = pddDay_(now), gap = pddIsoGap_(today, iso);
  if (gap === 0) return 'today';
  if (gap === 1) return 'tomorrow';
  var d = pddNoon_(iso);
  return d ? pddFmt_(d, 'EEEE d MMMM') : iso;
}
function pddWhen_(d, now) {
  if (!(d instanceof Date)) return '';
  return pddDay_(d) === pddDay_(now) ? pddFmt_(d, 'HH:mm') : pddFmt_(d, 'EEE d MMM, HH:mm');
}

/* ──────────────────────────────────────────────────────────────────────────
   THE CHECKS TAB
   ────────────────────────────────────────────────────────────────────────── */
/* Beside Intel Surveys in the branch workbook. That workbook reached Google's
   ten-million-cell ceiling on 21 September 2026, and the nightly build has
   reported it every night since; a new tab there may be refused for the same
   reason, so when it is, the checks go to the tracker's own workbook instead.
   Either way the tab is trimmed to its fifteen columns, because every empty
   cell of a new tab counts against that ceiling. */
function pddTab_() {
  var ss = iSs_(), sh = ss.getSheetByName(PDD.TAB);
  if (sh) return sh;
  var own = null;
  try { own = SpreadsheetApp.getActive(); } catch (e) { own = null; }
  if (own && own.getId && own.getId() === ss.getId()) own = null;
  if (own) {
    sh = own.getSheetByName(PDD.TAB);
    if (sh) return sh;
  }
  try {
    sh = ss.insertSheet(PDD.TAB);
  } catch (e2) {
    if (!own) throw e2;
    sh = own.insertSheet(PDD.TAB);
  }
  try {
    var extra = sh.getMaxColumns() - PDD_HEAD.length;
    if (extra > 0) sh.deleteColumns(PDD_HEAD.length + 1, extra);
    if (sh.getMaxRows() > 200) sh.deleteRows(201, sh.getMaxRows() - 200);
  } catch (e3) { /* a full-size tab still works */ }
  /* Days and numbers stay text. "2026-10-08" would become a date and a
     policy number with a leading zero would lose it, and a check that no
     longer matches its policy is a check that never sends. */
  sh.getRange(1, PCOL.GOES, sh.getMaxRows(), 3).setNumberFormat('@');
  sh.getRange(1, 1, 1, PDD_HEAD.length).setValues([PDD_HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

function pddPolKey_(p) { return String(p == null ? '' : p).replace(/^\s+|\s+$/g, '').replace(/\.0$/, ''); }

/* Which line a client, or a check, is on: the highest stage its days have
   reached. A check's own Days due says it, so the tab needs no new column, and
   the 45-day checks written before 13 October read as the 45-day line they were. */
function pddStageOf_(days) {
  var n = iNum_(days), out = PDD.STAGES[0];
  PDD.STAGES.forEach(function (st) { if (n >= st) out = st; });
  return out;
}

function pddChecks_() {
  var sh = pddTab_(), last = sh.getLastRow();
  var vals = last > 1 ? sh.getRange(2, 1, last - 1, PDD_HEAD.length).getValues() : [];
  return { sh: sh, rows: vals.map(function (v, i) { return pddCheckOf_(v, i + 2); }) };
}
function pddCheckOf_(v, rowNum) {
  return {
    row: rowNum,
    at: v[PCOL.AT - 1] instanceof Date ? v[PCOL.AT - 1] : pddDate_(v[PCOL.AT - 1]),
    goes: pddIso_(v[PCOL.GOES - 1]),
    policy: pddPolKey_(v[PCOL.POLICY - 1]),
    clientNo: String(v[PCOL.CLIENTNO - 1]).trim(),
    client: String(v[PCOL.CLIENT - 1] || ''),
    email: String(v[PCOL.EMAIL - 1] || '').trim(),
    agent: String(v[PCOL.AGENT - 1] || ''),
    days: iNum_(v[PCOL.DAYS - 1]),
    by: String(v[PCOL.BY - 1] || ''),
    decision: String(v[PCOL.DECISION - 1] || '').trim(),
    reason: String(v[PCOL.REASON - 1] || ''),
    status: String(v[PCOL.STATUS - 1] || '').trim(),
    done: v[PCOL.DONE - 1] instanceof Date ? v[PCOL.DONE - 1] : null,
    token: String(v[PCOL.TOKEN - 1] || ''),
    note: String(v[PCOL.NOTE - 1] || '')
  };
}

/* What stands for a policy now: the newest check of the last fortnight that
   was not withdrawn or undone, by the moment it was made rather than by where
   it sits, because a person can sort the tab. Anything older belongs to an
   earlier episode. */
function pddCurrent_(rows, policy, now, stage) {
  var cut = now.getTime() - PDD.KEEP_DAYS * 86400000, cur = null;
  rows.forEach(function (r) {
    if (r.policy !== policy) return;
    /* a check speaks for its own line: a 45-day letter sent last week is not a tick on the 60-day line */
    if (stage && pddStageOf_(r.days) !== stage) return;
    if (r.status === 'withdrawn' || r.status === 'undone' || !r.status) return;
    if (!(r.at instanceof Date) || r.at.getTime() < cut) return;
    if (!cur || r.at.getTime() >= cur.at.getTime()) cur = r;
  });
  return cur;
}

/* A check, as the page shows it. */
function pddState_(c, now) {
  if (!c) return null;
  var out = { by: c.by, at: pddWhen_(c.at, now), note: c.note };
  if (c.status === 'waiting' || c.status === 'sending') {
    var goes = c.goes || pddGoesFor_(c.at), next = pddNextSend_(now);
    if (goes < next) goes = next;
    out.kind = c.status === 'sending' ? 'sending' : 'ticked';
    out.goes = goes;
    out.goesWords = pddDayWords_(goes, now);
    /* Ten has passed and today's send has not run yet: it is going any minute. */
    out.due = goes === pddDay_(now) && pddHour_(now) >= PDD.HOUR;
    out.flags = c.reason;
    return out;
  }
  if (c.status === 'not sending') { out.kind = 'skipped'; out.why = c.reason; return out; }
  out.when = pddWhen_(c.done, now);
  if (c.status === 'sent')      { out.kind = 'sent'; return out; }
  if (c.status === 'test copy') { out.kind = 'tested'; return out; }
  if (c.status === 'not sent')  { out.kind = 'notsent'; out.why = c.note; return out; }
  return null;
}

/* Where a check lives now. Rows are only ever appended here, but a person
   can sort the tab, and on 30 September a sorted tab is exactly how a run
   would have stamped other clients' rows. So the row is confirmed by its
   policy and the moment it was checked before anything is written to it. */
function pddSame_(v, r) {
  var at = v[PCOL.AT - 1] instanceof Date ? v[PCOL.AT - 1].getTime() : -1;
  return pddPolKey_(v[PCOL.POLICY - 1]) === r.policy && r.at instanceof Date && at === r.at.getTime();
}
function pddAt_(sh, r) {
  var last = sh.getLastRow();
  if (r.row >= 2 && r.row <= last && pddSame_(sh.getRange(r.row, 1, 1, PDD_HEAD.length).getValues()[0], r)) return r.row;
  if (last < 2) return 0;
  var all = sh.getRange(2, 1, last - 1, PDD_HEAD.length).getValues();
  for (var i = 0; i < all.length; i++) if (pddSame_(all[i], r)) return (r.row = i + 2);
  return 0;
}
function pddMark_(sh, r, status, token, note) {
  var at = pddAt_(sh, r);
  if (!at) return false;
  sh.getRange(at, PCOL.STATUS, 1, 4).setValues([[status, status === 'waiting' ? '' : new Date(),
                                                  token || '', String(note || '').slice(0, 500)]]);
  r.status = status; r.note = note || '';
  return true;
}
/* The ten o'clock send writes a check only while it still reads what the send
   last saw, under the lock the desk's untick takes. So a tick withdrawn a
   second before is never sent, never revived by a note the send writes on its
   way past, and a letter being sent can no longer be withdrawn.

   The lock is the project's one script lock, which the tracker's own
   submissions queue on (KPI.gs, takeLock_), so it is held for the write and
   nothing else: a fraction of a second, never the length of a send. */
function pddMarkIf_(sh, r, expect, status, token, note) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return 'busy';
  try {
    var at = pddAt_(sh, r);
    if (!at) return 'gone';
    if (String(sh.getRange(at, PCOL.STATUS).getValue()).trim() !== expect) return 'gone';
    if (status === 'sending') {
      sh.getRange(at, PCOL.STATUS).setValue('sending');
      sh.getRange(at, PCOL.TOKEN).setValue(token);
      r.status = 'sending'; r.token = token;
      return 'ok';
    }
    pddMark_(sh, r, status, token, note);
    return 'ok';
  } finally {
    lock.releaseLock();
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   THE LINE, AS THE DESK READS IT
   iSurveyPool_ reads the whole dues extract, and a desk that read it for
   every letter opened would make a person wait a minute a click. So the desk
   keeps what it read for ten minutes, in the script cache. The ten o'clock
   send never uses this copy; it always reads the line afresh.
   ────────────────────────────────────────────────────────────────────────── */
function pddPool_(fresh) {
  if (!fresh) {
    var hit = pddCacheGet_('pdd_line');
    if (hit && hit.late === PDD.LATE && hit.v === PDD.VERSION) return hit;
  }
  var pool = iSurveyPool_(PDD.STAGES, PDD.LATE);
  if (pool.error) return pool;
  pddDress_(pool.rows || []);
  var out = {
    rows: (pool.rows || []).map(function (d) { return { row: pddRow_(d), d: pddPlain_(d) }; }),
    skipped: pool.skipped || {},
    at: new Date().getTime(),
    late: PDD.LATE,
    v: PDD.VERSION
  };
  pddCachePut_('pdd_line', out, PDD.POOL_TTL);
  return out;
}

/* A pool row without its functions, so it can be kept and rebuilt. */
function pddPlain_(d) {
  return {
    clientNo: d.clientNo, client: d.client, greeting: d.greeting, email: d.email,
    policy: pddPolKey_(d.policy), agent: d.agent, agentEmail: d.agentEmail, unit: d.unit,
    years: d.years, yWord: d.yWord, months: d.months, issued: d.issued,
    billing: d.billing, premium: d.premium, branchPhone: d.branchPhone,
    stage: d.stage, days: d.days, tpl: d.tpl ? d.tpl.id : '',
    hist: d.hist ? { when: d.hist.when, said: d.hist.said, count: d.hist.count || 1 } : null,
    lapseWords: d.lapseWords || '', svc: d.svc || null
  };
}

/* What a letter needs beyond the line itself: the date the cover stops, for the
   75-day letter, and what the branch team has done for the client, for the
   panel every letter carries. Both are left out when they are not known. */
function pddDress_(rows) {
  var lapses = pddLapseMap_();
  rows.forEach(function (d) {
    var l = pddDate_(lapses[pddPolKey_(d.policy)] || '');
    d.lapseWords = l ? pddFmt_(l, 'd MMMM yyyy') : '';
  });
  var intel = {};
  try { intel = pddIntel_(rows); } catch (e) { intel = {}; }
  rows.forEach(function (d) { var x = intel[pddPolKey_(d.policy)]; if (x) { d.intel = x; d.svc = x.svc || null; } });
}
function pddLive_(p) {
  var d = JSON.parse(JSON.stringify(p)), tpl = null;
  ISURVEY_TEMPLATES.forEach(function (t) { if (t.id === p.tpl) tpl = t; });
  d.tpl = tpl || iSurveyTemplate_(iNum_(d.years));
  return d;
}

/* The script cache holds 100 KB a key, so a long line is kept in pieces. */
function pddCachePut_(key, obj, ttl) {
  try {
    var s = JSON.stringify(obj), size = 45000, n = Math.max(1, Math.ceil(s.length / size)), m = {};
    if (n > 20) return;
    for (var i = 0; i < n; i++) m[key + '_' + i] = s.slice(i * size, (i + 1) * size);
    m[key] = String(n);
    CacheService.getScriptCache().putAll(m, ttl);
  } catch (e) { /* a desk without the cache is slower, not wrong */ }
}
function pddCacheGet_(key) {
  try {
    var c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
    if (!n) return null;
    var ks = [];
    for (var i = 0; i < n; i++) ks.push(key + '_' + i);
    var got = c.getAll(ks), s = '';
    for (var j = 0; j < n; j++) {
      if (got[ks[j]] == null) return null;
      s += got[ks[j]];
    }
    return JSON.parse(s);
  } catch (e) { return null; }
}
function pddCacheDrop_(key) {
  try { CacheService.getScriptCache().remove(key); } catch (e) {}
}

/* ──────────────────────────────────────────────────────────────────────────
   WHAT THE DESK SHOWS
   ──────────────────────────────────────────────────────────────────────────
   Everything a person needs to decide "yes, write to this one" without
   opening another tab: who they are, what they hold, how they pay, how long
   they have been with us, how many days behind, when the cover actually
   lapses, anything about the row that should give them pause, and whether
   somebody has already checked them.
   ────────────────────────────────────────────────────────────────────────── */
function pddList_(b, session) {
  var pool = pddPool_(!!(b && b.fresh));
  if (pool.error) return iErr_(pool.error);
  var now = new Date();
  var checks = pddChecks_();

  var mine = pddScope_(pool.rows.map(function (x) { return x.row; }), session);
  var out = mine.map(function (r0) {
    var r = {};
    Object.keys(r0).forEach(function (k) { r[k] = r0[k]; });
    r.state = pddState_(pddCurrent_(checks.rows, r.policy, now, r.stage), now);
    r.intel = pddIntelFor_(r.intel, session);
    return r;
  });

  /* Those still to decide first, then the ticked, then the declined. Inside
     each, the client closest to falling off the line, then the soonest to
     lapse, then the largest premium. */
  var rank = function (r) {
    var k = r.state && r.state.kind;
    return k === 'ticked' || k === 'sending' ? 1 : k === 'skipped' ? 2 : 0;
  };
  out.sort(function (x, y) {
    var a = rank(x), c = rank(y);
    if (a !== c) return a - c;
    if (x.stage !== y.stage) return y.stage - x.stage;
    if (x.days !== y.days) return y.days - x.days;
    if (x.lapseSort !== y.lapseSort) return x.lapseSort - y.lapseSort;
    return y.premium - x.premium;
  });

  var support = iSurveySupport_();
  var deskN = support.desk ? support.desk.split(',').length : 0;
  var last = null;
  try { last = JSON.parse(iProp_('PDD_LAST_RUN') || 'null'); } catch (e) { last = null; }
  var next = pddNextSend_(now), tickGoes = pddGoesFor_(now);
  if (tickGoes < next) tickGoes = next;

  return iOk_({
    v: PDD.VERSION,
    stage: PDD.STAGE, late: PDD.LATE, upTo: PDD.STAGE + PDD.LATE,
    stages: PDD.STAGES.map(function (st) { return { stage: st, upTo: st + PDD.LATE }; }),
    outcomes: iSeesBranch_(session.role) ? pddOutcomes_(now) : null,
    today: pddFmt_(now, 'EEEE d MMMM yyyy'),
    asOf: pddFmt_(new Date(pool.at || now.getTime()), 'HH:mm'),
    rows: out,
    recent: pddRecent_(checks.rows, now, session),
    skipped: pool.skipped || {},
    mail: iMailState_(),
    blocked: iSurveyBlocked_(),          // '' when the wording is approved and current
    approvedBy: iProp_('INTEL_SURVEY_APPROVED_BY') || '',
    send: {
      hour: PDD.HOUR,
      next: next, nextWords: pddDayWords_(next, now),
      tickGoes: tickGoes, tickWords: pddDayWords_(tickGoes, now),
      goneToday: iProp_('PDD_SENT_ON') === pddDay_(now),
      workday: pddWorkday_(now),
      base: !!pddBase_(),
      last: last
    },
    quota: { left: pddQuota_(), perLetter: 3 + deskN, reserve: PDD.RESERVE },
    you: { name: session.name, role: session.role, branchWide: iSeesBranch_(session.role),
           canTick: pddCanTick_(session) }
  });
}

/* What went, and what did not, over the last week: the desk's own record of
   its ten o'clock sends, scoped like the line. */
function pddRecent_(rows, now, session) {
  var cut = now.getTime() - 7 * 86400000;
  var done = rows.filter(function (r) {
    return (r.status === 'sent' || r.status === 'test copy' || r.status === 'not sent') &&
           r.done instanceof Date && r.done.getTime() >= cut;
  });
  done = pddScope_(done, session);
  done.sort(function (a, b) { return b.done.getTime() - a.done.getTime(); });
  return done.slice(0, 150).map(function (r) {
    return { when: pddWhen_(r.done, now), client: r.client, policy: r.policy, agent: r.agent,
             by: r.by, status: r.status, note: r.note, stage: pddStageOf_(r.days) };
  });
}

/* What a client told us is the branch's to read. An agent, or a unit manager,
   sees that a letter went and whether it was answered, never the rating they
   gave their agent or what they asked for: a client who asked to write to the
   branch manager privately, about their agent, is never shown to that agent. */
function pddIntelFor_(x, session) {
  if (!x) return null;
  var y = JSON.parse(JSON.stringify(x)), wide = iSeesBranch_(session && session.role);
  y.letters = (y.letters || []).map(function (l) {
    return { when: l.when, stage: l.stage, answered: !!(l.rating || l.askedKey), open: l.open, optOut: l.optOut,
             rating: wide ? l.rating : 0, heard: wide ? l.heard : '', asked: wide ? l.asked : '' };
  });
  if (!wide) y.notes = (y.notes || []).filter(function (n) { return !/^(Rated us|Asked us)/.test(n); });
  return y;
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
  var lapse = pddDate_(pddLapseMap_()[pddPolKey_(d.policy)] || d.lapseDate || '');
  var flags = [];
  var roster = pddRoster_(), who = iNameKey_(d.agent);

  /* Who the letter is sent in the name of. The branch-wide switch for an agent
     who has gone is INTEL_EXCLUDE_AGENTS (intelExclude), which takes their book
     off every wall at once; these two only catch what that switch has not been
     told about yet, and they show the client rather than hiding them. */
  if (who && roster.known[who] && !roster.active[who]) {
    flags.push('Their adviser is marked not active on the access list. Do not write in their '
             + 'name: this is a reassignment call, not a premium letter.');
  }
  if (d.unit === 'Unassigned') {
    flags.push('This adviser is not on any unit. Check who looks after this client before '
             + 'anything goes out in their name.');
  }
  if (who && who === iNameKey_(d.client)) {
    flags.push('The client and the adviser are the same person — this is the adviser’s own '
             + 'policy, not a client’s. It should not get a letter asking them to rate themselves.');
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
    policy:   pddPolKey_(d.policy),
    clientNo: String(d.clientNo || ''),
    client:   String(d.client || ''),
    agent:    String(d.agent || ''),
    unit:     String(d.unit || ''),
    email:    String(d.email || ''),
    premium:  iNum_(d.premium),
    years:    iNum_(d.years),
    days:     iNum_(d.days) || PDD.STAGE,
    stage:    Number(d.stage) || PDD.STAGE,
    intel:    d.intel || null,
    billing:  String(d.billing || ''),
    lapse:    lapse ? Utilities.formatDate(lapse, iTz_(), 'd MMM yyyy') : '',
    lapseSort: lapse ? lapse.getTime() : 8640000000000,
    subject:  d.tpl ? iSurveySubject_(d) : '',
    flags:    flags
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   WHAT WE KNOW ABOUT THE CLIENT
   ──────────────────────────────────────────────────────────────────────────
   Asked for on 13 October 2026: "build a lot of intelligence around the data
   we have, as there was a lot of servicing work". Four sources, each read once
   for the whole line and each optional: a missing one leaves its part out and
   never stops the desk.
   - The in-force book: every policy the client holds, its plan, a year's
     premium and its paid-to date.
   - The dues extract: their other policies that are behind, or lapsed.
   - Intel Surveys: every letter this episode, and what they answered.
   - Salesforce: the requests the branch team handled for them in twelve
     months, and what is open now. Logged e-mails and the birthday flow are
     not work and are never counted (the rule GroupClients.gs keeps as
     GCM_LOGGED). Kept six hours in the cache, a policy at a time.
   Only what the records show, never advice.
   ────────────────────────────────────────────────────────────────────────── */
var PDD_INTEL = { SF_TTL: 21600, SF_CHUNK: 40, TASK_DAYS: 365, RECENT: 4 };
var PDD_NOT_WORK = /^\s*(<p>)?\W*(Email|Re|Fwd?)\s*:|\$Record\.|Happy Birthday|birthday e-?mail/i;

function pddCno_(v) {
  var x = String(v == null ? '' : v).trim(), d = x.replace(/\D/g, '');
  return d.length >= 5 ? d.replace(/^0+/, '') : x.toUpperCase();
}

function pddIntel_(rows) {
  var out = {}, want = {}, today = iToday_(), DAY = 86400000;
  rows.forEach(function (d) {
    var k = pddPolKey_(d.policy);
    out[k] = { book: null, behind: [], lapsed: 0, letters: [], sf: null, notes: [], svc: null };
    var c = pddCno_(d.clientNo);
    if (c) (want[c] = want[c] || []).push(k);
  });
  if (!rows.length) return out;

  /* The in-force book, by client. */
  var books = {};
  try {
    var inf = iTabInforce_();
    if (inf) {
      var b = iReadCols_(inf, {
        policy: ['policy id'], clientId: ['client id'], plan: ['plan'], annual: ['annual premium'],
        modal: ['modal premium'], paidTo: ['policy paid to date'], overdue: ['daysoverdue'],
        bill: ['policy bill type'], eff: ['policy effective date']
      });
      for (var r = 0; r < b.rows; r++) {
        var c1 = pddCno_(b.get('clientId', r));
        if (!c1 || !want[c1]) continue;
        var pt = iDate_(b.get('paidTo', r)), ef = iDate_(b.get('eff', r));
        (books[c1] = books[c1] || []).push({
          policy: pddPolKey_(b.get('policy', r)),
          plan: String(b.get('plan', r) || '').replace(/\s+/g, ' ').trim(),
          annual: Math.round(iNum_(b.get('annual', r)) * 100) / 100,
          paidTo: pt ? pddFmt_(pt, 'd MMM yyyy') : '',
          behind: iNum_(b.get('overdue', r)) > 0 ? Math.round(iNum_(b.get('overdue', r))) : 0,
          bill: String(b.get('bill', r) || '').trim(),
          since: ef ? pddFmt_(ef, 'yyyy') : ''
        });
      }
    }
  } catch (e) { books = {}; }

  /* Their other policies on the dues extract. */
  var dues = {};
  try {
    var dsh = iTabDues_();
    if (dsh) {
      var q = iReadCols_(dsh, { number: ['number'], clientNo: ['client number'], status: ['status'],
                                paidTo: ['paid to date'], plan: ['plan code'], desc: ['status description'] });
      for (var r2 = 0; r2 < q.rows; r2++) {
        var c2 = pddCno_(q.get('clientNo', r2));
        if (!c2 || !want[c2]) continue;
        var p2 = iDate_(q.get('paidTo', r2));
        (dues[c2] = dues[c2] || []).push({
          policy: pddPolKey_(q.get('number', r2)), status: String(q.get('status', r2)).trim(),
          plan: String(q.get('plan', r2) || '').trim(), desc: String(q.get('desc', r2) || '').trim(),
          days: p2 ? Math.round((today - p2) / DAY) : 0
        });
      }
    }
  } catch (e) { dues = {}; }

  /* Every letter this episode, and what came back. */
  var letters = {};
  try {
    var sh = iSurveyTab_(), last = sh.getLastRow();
    if (last > 1) {
      var opt = {};
      ISURVEY_OPTIONS.forEach(function (o) { opt[o.key] = o.label; });
      sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), ISCOL.STAGE)).getValues().forEach(function (v) {
        var c3 = pddCno_(v[ISCOL.CLIENTNO - 1]), sent = v[ISCOL.SENT - 1];
        if (!c3 || !want[c3] || !(sent instanceof Date)) return;
        if ((today - sent) / DAY > ISURVEY.EPISODE) return;
        var asked = String(v[ISCOL.ASKED - 1] || '').trim();
        (letters[c3] = letters[c3] || []).push({
          at: sent.getTime(), when: pddFmt_(sent, 'd MMM'),
          stage: Number(v[ISCOL.STAGE - 1]) || 45,
          mode: String(v[ISCOL.MODE - 1] || '').trim(),
          rating: iNum_(v[ISCOL.RATING - 1]) || 0,
          heard: String(v[ISCOL.HEARD - 1] || '').trim(),
          asked: asked ? (opt[asked] || asked) : '',
          askedKey: asked,
          optOut: !!String(v[ISCOL.OPTOUT - 1] || '').trim(),
          open: !!String(v[ISCOL.FOLLOWUP - 1]).trim() && !String(v[ISCOL.CLOSED - 1]).trim()
        });
      });
    }
  } catch (e) { letters = {}; }

  var sf = {};
  try { sf = pddSfService_(rows.map(function (d) { return pddPolKey_(d.policy); })); } catch (e) { sf = {}; }

  rows.forEach(function (d) {
    var k = pddPolKey_(d.policy), c = pddCno_(d.clientNo), x = out[k];
    var held = books[c] || [];
    if (held.length) {
      var annual = 0;
      held.forEach(function (h) { annual += h.annual; });
      x.book = { policies: held.length, annual: Math.round(annual), list: held.slice(0, 12) };
    }
    (dues[c] || []).forEach(function (q2) {
      if (q2.policy === k) return;
      if (q2.status === '2') x.behind.push({ policy: q2.policy, plan: q2.plan, days: q2.days });
      else if (q2.status === '1') x.lapsed++;
    });
    x.letters = (letters[c] || []).sort(function (a, b2) { return a.at - b2.at; });
    x.sf = sf[k] || null;

    var policies = x.book ? x.book.policies : 0;
    x.svc = (x.sf && x.sf.done) || policies > 1
      ? { done: x.sf ? x.sf.done : 0, lastDone: x.sf ? x.sf.lastMonth : '', policies: policies } : null;
    x.notes = pddNotes_(d, x);
  });
  return out;
}

/* The facts worth a second's thought, in plain words, most pressing first. */
function pddNotes_(d, x) {
  var n = [];
  var lapse = pddDate_(pddLapseMap_()[pddPolKey_(d.policy)] || '');
  if (lapse) {
    var left = Math.round((lapse.getTime() - iToday_().getTime()) / 86400000);
    if (left >= 0 && left <= 14) n.push('Cover stops in ' + left + ' day' + (left === 1 ? '' : 's') + ' (' + pddFmt_(lapse, 'd MMM') + ').');
    else if (left < 0) n.push('The projected lapse date (' + pddFmt_(lapse, 'd MMM') + ') has passed.');
  }
  var asked = x.letters.filter(function (l) { return l.askedKey && l.askedKey !== 'stop'; });
  if (x.letters.some(function (l) { return l.open; })) n.push('A follow-up from an earlier letter is still open.');
  if (asked.length) n.push('Asked us: "' + asked[asked.length - 1].asked + '" (' + asked[asked.length - 1].when + ').');
  if (x.behind.length) n.push('Also behind on ' + x.behind.length + ' other ' + (x.behind.length === 1 ? 'policy' : 'policies') + '.');
  if (x.lapsed) n.push(x.lapsed + ' other ' + (x.lapsed === 1 ? 'policy has' : 'policies have') + ' lapsed.');
  if (/salary|payroll|deduct|military/i.test(d.billing || '')) n.push('Paid by salary deduction: a change of job or a payroll error stops it.');
  else if (/bank|standing|debit|card/i.test(d.billing || '')) n.push('Paid by bank or card: a changed account or an expired card stops it.');
  if (x.sf && x.sf.open) n.push(x.sf.open + ' Salesforce task' + (x.sf.open === 1 ? '' : 's') + ' open for this client.');
  if (x.sf && x.sf.done) n.push('The branch team handled ' + x.sf.done + ' request' + (x.sf.done === 1 ? '' : 's') + ' for them in twelve months.');
  if (x.book && x.book.policies > 1) n.push('Holds ' + x.book.policies + ' policies with us, TT$' + pddMoney_(x.book.annual) + ' a year in all.');
  var rated = x.letters.filter(function (l) { return l.rating; });
  if (rated.length) n.push('Rated us ' + rated[rated.length - 1].rating + ' out of 5 on ' + rated[rated.length - 1].when + '.');
  if (x.letters.length && !x.letters.some(function (l) { return l.rating || l.askedKey; })) {
    n.push(x.letters.length === 1 ? 'No answer to the letter of ' + x.letters[0].when + '.' : 'No answer to ' + x.letters.length + ' letters this episode.');
  }
  return n;
}
function pddMoney_(v) { return String(Math.round(iNum_(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/* Salesforce: the policy records, then the tasks on them or on the client. */
function pddSfService_(policies) {
  var out = {}, need = [];
  if (!iSfHelper_()) return out;
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  var uniq = policies.filter(function (p, i, a) { return p && a.indexOf(p) === i; });
  if (cache) {
    var keys = uniq.map(function (p) { return 'pdd_sf_' + p; }), got = {};
    for (var i0 = 0; i0 < keys.length; i0 += 100) {
      var part = cache.getAll(keys.slice(i0, i0 + 100));
      Object.keys(part).forEach(function (k) { got[k] = part[k]; });
    }
    uniq.forEach(function (p) {
      var hit = got['pdd_sf_' + p];
      if (hit) { try { out[p] = JSON.parse(hit); return; } catch (e) {} }
      need.push(p);
    });
  } else need = uniq;
  if (!need.length) return out;

  var q = function (s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; };
  var recOf = {}, polOfRec = {}, polsOfContact = {};
  for (var i = 0; i < need.length; i += PDD_INTEL.SF_CHUNK) {
    var chunk = need.slice(i, i + PDD_INTEL.SF_CHUNK);
    iSfQuery_('SELECT Id, POLICY__c, Contact__c FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN ('
      + chunk.map(q).join(',') + ')').forEach(function (rec) {
      var p = pddPolKey_(rec.POLICY__c), id = String(rec.Id).slice(0, 15);
      recOf[id] = 1; polOfRec[id] = p;
      if (rec.Contact__c) { var c = String(rec.Contact__c).slice(0, 15); (polsOfContact[c] = polsOfContact[c] || []).push(p); }
    });
  }
  var stats = {};
  need.forEach(function (p) { stats[p] = { done: 0, open: 0, last: 0, lastMonth: '', recent: [], seen: {} }; });
  var add = function (t, pols) {
    var subj = String(t.Subject || '').trim();
    if (t.TaskSubtype === 'Email' || PDD_NOT_WORK.test(subj)) return;
    var when = new Date(t.IsClosed ? (t.LastModifiedDate || t.CreatedDate) : t.CreatedDate);
    pols.forEach(function (p) {
      var st = stats[p];
      if (!st || st.seen[t.Id]) return;
      st.seen[t.Id] = 1;
      if (t.IsClosed) {
        st.done++;
        if (when.getTime() > st.last) { st.last = when.getTime(); st.lastMonth = pddFmt_(when, 'MMMM yyyy'); }
      } else st.open++;
      st.recent.push({ at: when.getTime(), when: pddFmt_(when, 'd MMM yyyy'), subject: subj.slice(0, 120),
                       who: (t.Owner && t.Owner.Name) || '', open: !t.IsClosed });
    });
  };
  var sel = 'SELECT Id, Subject, IsClosed, Status, TaskSubtype, CreatedDate, LastModifiedDate, WhatId, WhoId, Owner.Name FROM Task WHERE ';
  var since = ' AND CreatedDate = LAST_N_DAYS:' + PDD_INTEL.TASK_DAYS;
  var recIds = Object.keys(recOf), conIds = Object.keys(polsOfContact);
  for (var a = 0; a < recIds.length; a += PDD_INTEL.SF_CHUNK) {
    iSfQuery_(sel + 'WhatId IN (' + recIds.slice(a, a + PDD_INTEL.SF_CHUNK).map(q).join(',') + ')' + since)
      .forEach(function (t) { add(t, [polOfRec[String(t.WhatId).slice(0, 15)]]); });
  }
  for (var c2 = 0; c2 < conIds.length; c2 += PDD_INTEL.SF_CHUNK) {
    iSfQuery_(sel + 'WhoId IN (' + conIds.slice(c2, c2 + PDD_INTEL.SF_CHUNK).map(q).join(',') + ')' + since)
      .forEach(function (t) { add(t, polsOfContact[String(t.WhoId).slice(0, 15)] || []); });
  }
  var put = {};
  need.forEach(function (p) {
    var st = stats[p];
    st.recent.sort(function (x, y) { return y.at - x.at; });
    out[p] = { done: st.done, open: st.open, lastMonth: st.lastMonth,
               recent: st.recent.slice(0, PDD_INTEL.RECENT).map(function (r) { return { when: r.when, subject: r.subject, who: r.who, open: r.open }; }) };
    put['pdd_sf_' + p] = JSON.stringify(out[p]);
  });
  if (cache) { try { cache.putAll(put, PDD_INTEL.SF_TTL); } catch (e) {} }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
   WHAT HAPPENED AFTER THE LETTERS
   ──────────────────────────────────────────────────────────────────────────
   Every letter sent in the last 120 days, by stage, read against today's dues
   extract: back in good standing (the policy is no longer behind), paid some
   (still behind, but its paid-to date has moved), still behind, lapsed, or no
   longer on the extract. Test copies are never on Intel Surveys, so in test
   mode this counts only letters that really went. Branch only.
   ────────────────────────────────────────────────────────────────────────── */
function pddOutcomes_(now) {
  var hit = pddCacheGet_('pdd_out');
  if (hit && hit.v === PDD.VERSION) return hit;
  var out = { v: PDD.VERSION, days: 120, stages: {}, total: null };
  try {
    var today = iToday_(), DAY = 86400000;
    var dues = {}, dsh = iTabDues_();
    if (dsh) {
      var q = iReadCols_(dsh, { number: ['number'], status: ['status'], paidTo: ['paid to date'] });
      for (var r = 0; r < q.rows; r++) {
        var p = pddPolKey_(q.get('number', r));
        if (p) dues[p] = { status: String(q.get('status', r)).trim(), paidTo: iDate_(q.get('paidTo', r)) };
      }
    }
    var blank = function () { return { sent: 0, answered: 0, paid: 0, part: 0, behind: 0, lapsed: 0, gone: 0 }; };
    var total = blank();
    PDD.STAGES.forEach(function (st) { out.stages[st] = blank(); });
    var sh = iSurveyTab_(), last = sh.getLastRow();
    if (last > 1) {
      sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), ISCOL.STAGE)).getValues().forEach(function (v) {
        var sent = v[ISCOL.SENT - 1];
        if (!(sent instanceof Date) || (today - sent) / DAY > out.days) return;
        var stage = Number(v[ISCOL.STAGE - 1]) || 45, b = out.stages[stage];
        if (!b) return;
        var pol = pddPolKey_(v[ISCOL.POLICY - 1]), now2 = dues[pol];
        var answered = !!(iNum_(v[ISCOL.RATING - 1]) || String(v[ISCOL.ASKED - 1] || '').trim());
        var paidThen = new Date(sent.getTime() - stage * DAY);
        var kind = !now2 ? 'gone'
          : now2.status === '1' ? 'lapsed'
          : now2.status !== '2' ? 'paid'
          : (now2.paidTo && now2.paidTo.getTime() > paidThen.getTime() + 15 * DAY) ? 'part' : 'behind';
        [b, total].forEach(function (t) { t.sent++; if (answered) t.answered++; t[kind]++; });
      });
    }
    out.total = total;
  } catch (e) { out.error = String(e && e.message || e); }
  pddCachePut_('pdd_out', out, PDD.POOL_TTL);
  return out;
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
   feeds the editor's send too and this file is meant to add nothing to it.
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
          /* Keyed exactly as the desk keys its own policy field, because a
             join that is one trim apart from the thing it joins to silently
             matches nothing and reads as missing data. */
          var pol = pddPolKey_(d.get('number', r));
          var v = d.get('lapse', r);
          if (!pol || v === '' || v == null) continue;
          map[pol] = v;
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
   Rendered by iSurveyHtml_, the same function the send calls, from the same
   pool row. The only difference is that this one carries a preview token, so
   a tap from a preview can never be mistaken for a client's answer.
   ────────────────────────────────────────────────────────────────────────── */
function pddPreview_(b, session) {
  var policy = pddPolKey_(b && b.policy);
  if (!policy) return iErr_('Which policy? Pass policy.');
  var pool = pddPool_(false);
  if (pool.error) return iErr_(pool.error);
  var hit = null;
  pool.rows.forEach(function (x) { if (x.row.policy === policy) hit = x; });
  if (!hit || !pddScope_([hit.row], session).length) {
    return iErr_('That policy is not on any of the lines any more, or it is not yours to see.');
  }
  var d = pddLive_(hit.d);
  d.token = 'preview';
  d.base  = pddBase_() || iSurveyBase_();
  return iOk_({
    policy: policy,
    client: String(d.client || ''),
    to:     String(d.email || ''),
    cc:     pddCc_(d).join(', '),
    subject: iSurveySubject_(d),
    stage:  d.stage,
    html:   iSurveyHtml_(d)
  });
}

/* Agent, desk and unit manager, de-duplicated — the same chain the editor's
   send copies, read off the access list rather than typed in here. */
function pddCc_(d) {
  var support = iSurveySupport_();
  return [d.agentEmail].concat(String(support.desk || '').split(','), [support.managerFor(d.unit)])
    .map(function (x) { return String(x || '').trim(); })
    .filter(function (x) { return x; })
    .filter(function (x, i, a) { return a.indexOf(x) === i; });
}

/* ──────────────────────────────────────────────────────────────────────────
   THE TICK
   ──────────────────────────────────────────────────────────────────────────
   One person, one client, one check, written down the moment it is made.
   The desk sends what it showed: the client's address and agent as they
   were on the line the person checked, so that at ten the send can tell
   whether either changed since. The row the desk read is preferred to what
   the page says, when the desk still has it.
   ────────────────────────────────────────────────────────────────────────── */
function pddTick_(b, session) {
  if (!pddCanTick_(session)) {
    return iErr_('Staff and the branch manager check and tick these. You can read each letter.');
  }
  var policy = pddPolKey_(b && b.policy);
  if (!policy) return iErr_('Which policy?');
  var on = !(b && (b.on === false || b.on === 'false' || b.on === 0 || b.on === '0'));
  var found = {};
  if (on) {
    found = pddFound_(policy);
    if (!found) return iErr_('This client is no longer on the line. Refresh the desk.');
  }
  var stage = Number(found.stage) || pddStageOf_((b && (b.days || b.stage)) || PDD.STAGE);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return iErr_('The desk is busy for a moment. Tick it again.');
  try {
    var now = new Date(), c = pddChecks_(), cur = pddCurrent_(c.rows, policy, now, stage);
    var stamp = session.name + ' at ' + pddFmt_(now, 'd MMM HH:mm');
    if (!on) {
      if (cur && cur.status === 'sending') return iErr_('This letter is going out right now. It can no longer be withdrawn.');
      if (cur && cur.status === 'sent') return iErr_('This letter has already gone.');
      if (!cur || cur.status !== 'waiting') return iOk_({ policy: policy, state: pddState_(cur, now) });
      pddMark_(c.sh, cur, 'withdrawn', '', 'withdrawn by ' + stamp);
      return iOk_({ policy: policy, state: null });
    }
    if (cur && (cur.status === 'waiting' || cur.status === 'sending')) {
      return iOk_({ policy: policy, state: pddState_(cur, now) });
    }
    if (cur && cur.status === 'sent') return iErr_('This letter has already gone.');
    if (cur && cur.status === 'not sending') pddMark_(c.sh, cur, 'undone', '', 'ticked to send by ' + stamp);
    var flags = (found.flags && found.flags.length ? found.flags : [].concat((b && b.flags) || []))
      .map(function (f) { return String(f); });
    var row = pddNewRow_(now, pddGoesFor_(now), policy, found, b, session, 'send',
      flags.length ? 'ticked with ' + flags.length + ' flagged: ' + flags.join(' | ') : '', 'waiting');
    c.sh.appendRow(row);
    return iOk_({ policy: policy, state: pddState_(pddCheckOf_(row, 0), now) });
  } finally {
    lock.releaseLock();
  }
}

/* "Do not send", with the reason. A tick waiting for ten is withdrawn by it.
   `undo` takes the decision back. */
function pddSkip_(b, session) {
  if (!pddCanTick_(session)) {
    return iErr_('Staff and the branch manager decide these. You can read each letter.');
  }
  var policy = pddPolKey_(b && b.policy);
  if (!policy) return iErr_('Which policy?');
  var undo = !!(b && b.undo);
  var why = String((b && b.why) || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!undo && !why) return iErr_('Say why it is not going, so the next person knows.');
  var found = undo ? {} : (pddFound_(policy) || {});
  var stage = Number(found.stage) || pddStageOf_((b && (b.days || b.stage)) || PDD.STAGE);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return iErr_('The desk is busy for a moment. Try again.');
  try {
    var now = new Date(), c = pddChecks_(), cur = pddCurrent_(c.rows, policy, now, stage);
    var stamp = session.name + ' at ' + pddFmt_(now, 'd MMM HH:mm');
    if (undo) {
      if (cur && cur.status === 'not sending') pddMark_(c.sh, cur, 'undone', '', 'undone by ' + stamp);
      return iOk_({ policy: policy, state: null });
    }
    if (cur && cur.status === 'sending') return iErr_('This letter is going out right now.');
    if (cur && cur.status === 'sent') return iErr_('This letter has already gone.');
    if (cur && cur.status === 'waiting') pddMark_(c.sh, cur, 'withdrawn', '', 'marked not to send by ' + stamp);
    if (cur && cur.status === 'not sending') pddMark_(c.sh, cur, 'undone', '', 'replaced by ' + stamp);
    var row = pddNewRow_(now, '', policy, found, b, session, 'do not send', why, 'not sending');
    c.sh.appendRow(row);
    return iOk_({ policy: policy, state: pddState_(pddCheckOf_(row, 0), now) });
  } finally {
    lock.releaseLock();
  }
}

/* A row for the checks tab. What the client looked like is the desk's own
   copy of the line when it has one, and what the page showed when it has not. */
function pddNewRow_(now, goes, policy, found, b, session, decision, reason, status) {
  var pick = function (k, n) { return String(found[k] || (b && b[k]) || '').slice(0, n); };
  return [now, goes, policy, pick('clientNo', 40), pick('client', 200), pick('email', 200),
          pick('agent', 200), iNum_(found.days || (b && (b.days || b.stage))) || PDD.STAGE,
          session.name, decision, String(reason || '').slice(0, 500), status, '', '', ''];
}

/* The desk's own copy of a row on the line: the one it keeps when it has it,
   a fresh read (kept for the next ten minutes) when it has not. A client who
   is not on it is not ticked: the record of a check has to say who was
   checked, and the desk has nothing to say about a client it cannot see. */
function pddFound_(policy) {
  var pool = pddCacheGet_('pdd_line');
  if (!pool || !pool.rows || pool.late !== PDD.LATE || pool.v !== PDD.VERSION) pool = pddPool_(false);
  if (!pool || pool.error || !pool.rows) return null;
  var out = null;
  pool.rows.forEach(function (x) { if (x.row && x.row.policy === policy) out = x.row; });
  return out;
}

/* The old send button. There is no sending from the page any more. */
function pddSend_(b, session) {
  return iErr_('The desk sends at ten now. Reload this page, then tick each client once you have checked them.');
}

/* ──────────────────────────────────────────────────────────────────────────
   THE TEN O'CLOCK SEND
   ────────────────────────────────────────────────────────────────────────── */
function pddQuota_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (e) { return 100; }
}

/* Called every hour by intelPendingRefresh. Returns { did, text }: `did` when
   letters went, so the pending copy can stand down that hour. */
function pddRun_(opt) {
  opt = opt || {};
  var now = new Date(), today = pddDay_(now);
  if (!opt.force) {
    if (!pddWorkday_(now)) return { did: false, text: 'premium due: not a working day' };
    if (pddHour_(now) < PDD.HOUR) return { did: false, text: 'premium due: before ten' };
    if (iProp_('PDD_SENT_ON') === today) return { did: false, text: 'premium due: today\'s send has gone' };
  }
  var busy = Number(iProp_('PDD_RUNNING') || 0);
  if (busy && now.getTime() - busy < 7 * 60000) return { did: false, text: 'premium due: a send is already running' };
  iSetProp_('PDD_RUNNING', String(now.getTime()));
  try {
    return pddRunNow_(now, today);
  } finally {
    try { PropertiesService.getScriptProperties().deleteProperty('PDD_RUNNING'); } catch (e) {}
  }
}

function pddRunNow_(now, today) {
  var t0 = new Date().getTime();
  var checks = pddChecks_(), sh = checks.sh;
  pddRecover_(checks);
  var due = checks.rows.filter(function (r) {
    return r.status === 'waiting' && r.decision === 'send' && r.at instanceof Date &&
           (r.goes || pddGoesFor_(r.at)) <= today;
  });
  var at = pddFmt_(now, 'HH:mm');
  if (!due.length) {
    iSetProp_('PDD_SENT_ON', today);
    pddLastRun_({ at: now.toISOString(), when: pddFmt_(now, 'EEE d MMM, HH:mm'), mode: '', sent: 0,
                  test: 0, notSent: 0, waiting: 0, note: 'nothing was ticked' });
    return { did: false, text: 'premium due: nothing ticked for today' };
  }

  var mode = iMailState_().clients;        // live, test or held
  var sum = { mode: mode, sent: [], test: [], notSent: [], waiting: [], why: '' };

  /* Every write the send makes holds only while the check still reads what
     the send last saw (pddMarkIf_), so one withdrawn meanwhile simply drops
     out. A letter that went is reported as gone even if the desk was too busy
     to stamp it: the next send's recovery stamps it from the log. */
  var put = function (r, list, status, note, token) {
    var expect = r.status;
    var got = pddMarkIf_(sh, r, expect, status, token || '', note);
    if (got === 'ok') { list.push(r); return; }
    if (got === 'busy') {
      if (expect === 'sending' && status !== 'waiting') { r.note = note; list.push(r); return; }
      r.note = 'the desk was busy at ' + pddFmt_(new Date(), 'HH:mm') + '; it goes at the next send';
      sum.waiting.push(r);
    }
  };
  var daysNow = function (r) { return r.days + pddIsoGap_(pddDay_(r.at), today); };
  var upToOf = function (r) { return pddStageOf_(r.days) + PDD.LATE; };

  /* Nothing can go: client mail held, the wording not approved, or no address
     for the taps. Ticks wait, and a client who has passed the line meanwhile
     is let go, with the reason. */
  var blocked = mode === 'live' ? iSurveyBlocked_() : '';
  var base = pddBase_();
  var hold = mode === 'held' ? 'client mail is held'
           : blocked ? 'the wording is not approved: ' + blocked
           : mode === 'live' && !base ? 'the web app\'s /exec address is not known, so the taps in the letter would not open (set INTEL_EXEC_URL)'
           : '';
  if (hold) {
    due.forEach(function (r) {
      if (daysNow(r) > upToOf(r)) put(r, sum.notSent, 'not sent', 'it passed ' + upToOf(r) + ' days while ' + hold);
      else put(r, sum.waiting, 'waiting', 'held at ' + at + ': ' + hold);
    });
    sum.why = hold;
    iSetProp_('PDD_SENT_ON', today);
    pddFinish_(now, sum);
    return { did: false, text: 'premium due: ' + due.length + ' ticked, none sent: ' + hold };
  }

  var pool = iSurveyPool_(PDD.STAGES, PDD.LATE);
  if (pool.error) {
    due.forEach(function (r) { put(r, sum.waiting, 'waiting', 'held at ' + at + ': ' + pool.error); });
    sum.why = pool.error;
    iSetProp_('PDD_SENT_ON', today);
    pddFinish_(now, sum);
    return { did: false, text: 'premium due: ' + pool.error };
  }
  var byPolicy = {};
  (pool.rows || []).forEach(function (d) { byPolicy[pddPolKey_(d.policy)] = d; });
  /* the letter's extras for the clients going today only, not the whole line */
  pddDress_(due.map(function (r) { return byPolicy[r.policy]; }).filter(Boolean));

  /* Oldest first: the client nearest the end of the line cannot wait for the
     next send. Then the soonest to lapse. */
  var lapses = pddLapseMap_();
  var lapseOf = function (r) { var l = pddDate_(lapses[r.policy]); return l ? l.getTime() : 8640000000000; };
  due.sort(function (x, y) {
    var dx = byPolicy[x.policy] ? byPolicy[x.policy].days : daysNow(x);
    var dy = byPolicy[y.policy] ? byPolicy[y.policy].days : daysNow(y);
    return dx !== dy ? dy - dx : lapseOf(x) - lapseOf(y);
  });

  var surveys = iSurveyTab_(), test = iProp_('INTEL_TEST_TO');
  var hash = mode === 'live' ? iSurveyHash_() : '', approver = iProp_('INTEL_SURVEY_APPROVED_BY');
  var left = pddQuota_(), stoppedFor = '';
  for (var i = 0; i < due.length; i++) {
    var r = due[i];
    if (!stoppedFor && new Date().getTime() - t0 > PDD.BUDGET_MS) {
      stoppedFor = 'the send ran out of time at ' + pddFmt_(new Date(), 'HH:mm') + '; it goes in the next hour';
    }
    if (!stoppedFor && sum.sent.length + sum.test.length >= PDD.MAX_PER_RUN) {
      stoppedFor = 'more than ' + PDD.MAX_PER_RUN + ' in one morning; it goes at the next send';
    }
    if (stoppedFor) { put(r, sum.waiting, 'waiting', stoppedFor); continue; }

    var d = byPolicy[r.policy], stageR = pddStageOf_(r.days);
    if (d && Number(d.stage) !== stageR) {
      put(r, sum.notSent, 'not sent', 'it moved to the ' + d.stage + '-day line before it could go: check it again there');
      continue;
    }
    if (!d) {
      put(r, sum.notSent, 'not sent', daysNow(r) > upToOf(r)
        ? 'it passed ' + upToOf(r) + ' days before it could go'
        : 'no longer on the ' + stageR + '-day line at ten: most likely paid since it was checked, '
          + 'or written to, opted out or taken off the line since');
      continue;
    }
    if (iEmail_(d.email) !== iEmail_(r.email)) {
      put(r, sum.notSent, 'not sent', 'the e-mail on file changed after it was checked ('
        + (r.email || 'none') + ' then, ' + (d.email || 'none') + ' now): check it again');
      continue;
    }
    if (iNameKey_(d.agent) !== iNameKey_(r.agent)) {
      put(r, sum.notSent, 'not sent', 'the agent on file changed after it was checked ('
        + r.agent + ' then, ' + d.agent + ' now): check it again');
      continue;
    }
    var cc = mode === 'live' ? pddCc_(d) : [];
    var need = mode === 'live' ? 1 + cc.length : 1;
    if (left - need < PDD.RESERVE) {
      stoppedFor = 'today\'s mail allowance ran short at ' + pddFmt_(new Date(), 'HH:mm') + ' ('
        + left + ' left); it goes at the next send';
      put(r, sum.waiting, 'waiting', stoppedFor);
      continue;
    }

    var token = Utilities.getUuid().replace(/-/g, '');
    var claim = pddMarkIf_(sh, r, 'waiting', 'sending', token, '');
    if (claim === 'busy') {
      r.note = 'the desk was busy at ' + pddFmt_(new Date(), 'HH:mm') + '; it goes at the next send';
      sum.waiting.push(r);
      continue;
    }
    if (claim !== 'ok') continue;                  // withdrawn a moment ago
    d.token = token;
    d.base = base || iSurveyBase_();
    var html = iSurveyHtml_(d), subject = iSurveySubject_(d);
    var checked = 'checked by ' + r.by + ' ' + pddFmt_(r.at, 'd MMM HH:mm');
    try {
      if (mode === 'live') {
        var logged = pddLogLetter_(surveys, d, 'sending · desk · ' + checked);
        try {
          MailApp.sendEmail({ to: d.email, cc: cc.join(','), name: 'Ricky Rampersad Branch',
                              subject: subject, htmlBody: html });
        } catch (sendErr) {
          pddUnlog_(surveys, logged, token);
          throw sendErr;
        }
        if (logged) surveys.getRange(logged, ISCOL.MODE).setValue('live · desk · ' + checked
          + ' · sent at ten · cleared ' + hash + ' by ' + approver);
        put(r, sum.sent, 'sent', 'to ' + d.email + (cc.length ? ', copying ' + cc.join(', ') : ''), token);
      } else {
        MailApp.sendEmail({ to: test, name: 'Branch Intelligence', subject: '[TEST] ' + subject,
          htmlBody: '<div style="background:#E8A020;color:#00254d;padding:10px 14px;'
            + 'font:700 13px sans-serif;border-radius:8px;margin-bottom:14px">TEST MODE — the ' + iEsc_(String(d.stage))
            + '-day letter. At ten this would have gone to ' + iEsc_(d.email) + ', copying ' + iEsc_(pddCc_(d).join(', ') || 'nobody')
            + '. Checked by ' + iEsc_(r.by) + ' ' + iEsc_(pddFmt_(r.at, 'd MMM HH:mm'))
            + ' on the Premium Due Desk. The client was not written to.</div>' + html });
        put(r, sum.test, 'test copy', 'went to the test inbox at ' + pddFmt_(new Date(), 'HH:mm')
          + '; the client was not written to');
      }
      left -= need;
    } catch (err) {
      var msg = String(err && err.message || err);
      put(r, sum.waiting, 'waiting', 'the mail did not go at ' + pddFmt_(new Date(), 'HH:mm')
        + ' (' + msg + '); it is tried again at the next send');
      if (/too many|quota|limit/i.test(msg)) stoppedFor = 'the mail allowance ran out; it goes at the next send';
    }
  }

  /* A send that ran out of time is not today's send done: the next hour's
     firing carries on with what is left. */
  if (!/out of time/.test(stoppedFor)) iSetProp_('PDD_SENT_ON', today);
  pddCacheDrop_('pdd_line');
  sum.left = pddQuota_();
  pddFinish_(now, sum);
  var n = sum.sent.length + sum.test.length;
  return { did: n > 0,
           text: 'premium due: ' + (mode === 'live' ? sum.sent.length + ' sent' : sum.test.length + ' test copies')
                 + ', ' + sum.notSent.length + ' not sent, ' + sum.waiting.length + ' waiting' };
}

/* A send cut off mid-letter, by the six-minute ceiling or anything else,
   leaves a check reading "sending". If Intel Surveys has its token, the
   letter was logged, and may have gone: it is counted as sent, because a
   second letter is worse than an unconfirmed first. If not, it never got that
   far and waits for the next send. */
function pddRecover_(checks) {
  var stuck = checks.rows.filter(function (r) { return r.status === 'sending'; });
  if (!stuck.length) return;
  var sh = iSurveyTab_(), last = sh.getLastRow(), seen = {};
  if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (v) { seen[String(v[0])] = 1; });
  stuck.forEach(function (r) {
    if (r.token && seen[r.token]) {
      pddMarkIf_(checks.sh, r, 'sending', 'sent', r.token, 'logged, and the send stopped before it was confirmed');
    } else {
      pddMarkIf_(checks.sh, r, 'sending', 'waiting', '', 'the last send stopped before this one went');
    }
  });
}

/* The letter's row on Intel Surveys, written before the mail goes. Returns
   the row it landed on. */
function pddLogLetter_(sh, d, mode) {
  sh.appendRow([d.token, new Date(), d.clientNo, d.client, d.email, d.policy, d.agent,
                d.unit, d.years, d.tpl ? d.tpl.id : '', d.billing, d.premium,
                d.tpl ? d.tpl.id : '',
                '', '', '', '',
                mode,
                '', '', '', '', '', '', '',
                '', '', '', '',
                Number(d.stage) || PDD.STAGE]);
  var last = sh.getLastRow();
  for (var i = last; i >= Math.max(2, last - 25); i--) {
    if (String(sh.getRange(i, ISCOL.TOKEN).getValue()) === d.token) return i;
  }
  return 0;
}
function pddUnlog_(sh, row, token) {
  try {
    if (row && String(sh.getRange(row, ISCOL.TOKEN).getValue()) === token) sh.deleteRow(row);
  } catch (e) {}
}

function pddLastRun_(o) {
  try { iSetProp_('PDD_LAST_RUN', JSON.stringify(o)); } catch (e) {}
}

/* After a send: what the desk shows as the last run, and one e-mail to the
   branch manager saying what went, what did not and why. Internal, so it
   carries names, and it goes the way every internal mail here goes: to the
   test inbox in test mode. */
function pddFinish_(now, sum) {
  pddLastRun_({ at: now.toISOString(), when: pddFmt_(now, 'EEE d MMM, HH:mm'), mode: sum.mode,
                sent: sum.sent.length, test: sum.test.length, notSent: sum.notSent.length,
                waiting: sum.waiting.length, note: sum.why || '' });
  var to = iHoldTo_();
  if (!to) return;
  var head = sum.mode === 'live'
    ? sum.sent.length + ' letter' + (sum.sent.length === 1 ? '' : 's') + ' went to clients at ten, copying their agents, the desk and the unit managers.'
    : sum.mode === 'test'
      ? 'Client mail is in test mode, so ' + sum.test.length + ' test cop' + (sum.test.length === 1 ? 'y' : 'ies')
        + ' went to the test inbox. No client was written to.'
      : 'No letter went: ' + sum.why + '.';
  var line = function (r, what) {
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8ee">' + iEsc_(r.client) + '</td>'
      + '<td style="padding:6px 10px;border-bottom:1px solid #e2e8ee;font-family:monospace">' + iEsc_(r.policy) + '</td>'
      + '<td style="padding:6px 10px;border-bottom:1px solid #e2e8ee">' + iEsc_(r.agent) + '</td>'
      + '<td style="padding:6px 10px;border-bottom:1px solid #e2e8ee">' + iEsc_(r.by) + '</td>'
      + '<td style="padding:6px 10px;border-bottom:1px solid #e2e8ee">' + iEsc_(what) + '</td></tr>';
  };
  var rows = [];
  sum.sent.forEach(function (r) { rows.push(line(r, 'Sent')); });
  sum.test.forEach(function (r) { rows.push(line(r, 'Test copy')); });
  sum.notSent.forEach(function (r) { rows.push(line(r, 'Not sent: ' + r.note)); });
  sum.waiting.forEach(function (r) { rows.push(line(r, 'Waiting: ' + r.note)); });
  var html = '<div style="font:14px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#16202b;max-width:760px">'
    + '<p style="margin:0 0 12px"><b>Premium Due Desk, the ten o\'clock send, ' + iEsc_(pddFmt_(now, 'EEEE d MMMM')) + '.</b></p>'
    + '<p style="margin:0 0 14px">' + iEsc_(head) + '</p>'
    + '<table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="text-align:left;color:#5c6b7a">'
    + '<th style="padding:6px 10px">Client</th><th style="padding:6px 10px">Policy</th><th style="padding:6px 10px">Agent</th>'
    + '<th style="padding:6px 10px">Checked by</th><th style="padding:6px 10px">What happened</th></tr>'
    + rows.join('') + '</table>'
    + (sum.left != null ? '<p style="margin:14px 0 0;color:#5c6b7a">Mail allowance left today: ' + sum.left + ' recipients.</p>' : '')
    + '<p style="margin:14px 0 0;color:#8b98a6;font-size:12px">Internal: it names clients. Do not forward outside the branch.</p></div>';
  var subject = 'Premium due, ten o\'clock: ' + (sum.mode === 'live' ? sum.sent.length + ' sent'
    : sum.mode === 'test' ? sum.test.length + ' test copies' : 'held')
    + (sum.notSent.length ? ', ' + sum.notSent.length + ' not sent' : '')
    + (sum.waiting.length ? ', ' + sum.waiting.length + ' waiting' : '');
  try { iSend_(to, subject, html); } catch (e) { /* the desk shows it anyway */ }
}

/* ──────────────────────────────────────────────────────────────────────────
   FROM THE EDITOR
   ────────────────────────────────────────────────────────────────────────── */
/* The ten o'clock send by hand, now, whatever the hour: everything ticked for
   today or before. For a morning the hourly trigger did not fire. */
function pddSendNow() {
  var r = pddRun_({ force: true });
  Logger.log(r.text);
  return r.text;
}

/* What the next send would do, without sending anything. */
function pddStatus() {
  var now = new Date(), c = pddChecks_();
  var waiting = c.rows.filter(function (r) { return r.status === 'waiting'; });
  var next = pddNextSend_(now);
  var text = ['Premium Due Desk ' + PDD.VERSION,
    'Next send: ten o\'clock ' + pddDayWords_(next, now) + ' (' + next + ').',
    'Ticked and waiting: ' + waiting.length + '.',
    'Client mail: ' + iMailState_().clients + '. Wording: ' + (iSurveyBlocked_() || 'approved') + '.',
    'Address for the letters\' taps: ' + (pddBase_() || 'NOT KNOWN: open the desk once, or set INTEL_EXEC_URL') + '.',
    'Mail allowance left today: ' + pddQuota_() + '.',
    'Checks tab: ' + PDD.TAB + ', ' + Math.max(0, c.sh.getLastRow() - 1) + ' rows.'].join('\n');
  Logger.log(text);
  return text;
}

/* Today's line without sending anything. */
function pddToday() {
  var pool = pddPool_(true);
  if (pool.error) { Logger.log(pool.error); return pool.error; }
  var rows = pool.rows.map(function (x) { return x.row; });
  rows.sort(function (x, y) { return y.stage - x.stage || y.days - x.days || x.lapseSort - y.lapseSort; });
  /* Say whether the joins worked, not just what they produced. "No lapse date"
     against every client read as a data problem for a day when it was a column
     this file never asked for; a line that counts the join turns the next one
     of those into a measurement instead of a guess. */
  var lapses = pddLapseMap_(), nLapse = 0, roster = pddRoster_(), nKnown = 0, flagged = 0, nIntel = 0, nSf = 0, by = {};
  rows.forEach(function (r) {
    if (r.lapse) nLapse++;
    if (roster.known[iNameKey_(r.agent)]) nKnown++;
    if (r.flags.length) flagged++;
    if (r.intel && r.intel.book) nIntel++;
    if (r.intel && r.intel.sf) nSf++;
    by[r.stage] = (by[r.stage] || 0) + 1;
  });
  var out = ['The four lines, ' + Utilities.formatDate(new Date(), iTz_(), 'd MMMM yyyy') + ': '
               + PDD.STAGES.map(function (st) { return st + ' to ' + (st + PDD.LATE) + ' days: ' + (by[st] || 0); }).join(' · '),
             rows.length + ' client' + (rows.length === 1 ? '' : 's') + ' in all, '
               + flagged + ' with something to check.',
             'Client mail: ' + iMailState_().clients + '.',
             (iSurveyBlocked_() ? 'WORDING: ' + iSurveyBlocked_() : 'Wording approved by '
               + (iProp_('INTEL_SURVEY_APPROVED_BY') || '(nobody)')),
             'Joins: lapse date on ' + nLapse + '/' + rows.length + ' (book holds '
               + Object.keys(lapses).length + '), adviser on the access list '
               + nKnown + '/' + rows.length + ', in-force book ' + nIntel + '/' + rows.length
               + ', Salesforce ' + (iSfHelper_() ? nSf + '/' + rows.length : 'no helper in this project') + '.',
             'Off every report (INTEL_EXCLUDE_AGENTS): '
               + (String(iProp_('INTEL_EXCLUDE_AGENTS') || '').replace(/^\s+|\s+$/g, '') || 'nobody'),
             ''];
  rows.slice(0, 40).forEach(function (r) {
    out.push([r.stage + '-day', r.policy, r.client, r.agent, r.days + ' days', '$' + r.premium, r.billing,
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
