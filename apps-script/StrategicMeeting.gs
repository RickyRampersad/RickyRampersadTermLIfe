/* ── The strategic meeting page: rickyrampersadbranch.com/strategic-meeting ─────────────────────────────────────────
   20 October 2026, two days before the Joint Sales Managers' Strategic Meeting (Hyatt Regency, 22–23 October 2026):
   "build a framework with all you have under rickyrampersadbranch/strategic meeting so you can have the days and
   topics and make a contribution, you and Akaash can log in to contribute items and business intelligence can guide
   you". The page carries the two days and every session with its guiding question, what the branch's own record says
   under each, and the contributions the branch manager and the unit manager log against a session. This file keeps
   those contributions on the Strategic Meeting tab, signs people in as the assignment board does (tWho_: the branch
   code, or an agent number and password from the Agent Skill Bank), gathers the live counts the page shows beside the
   notes (never a client's name), and, when ANTHROPIC_API_KEY is set, asks Claude for three points a person could make
   in a session, from the facts alone. A fourth file in the Service Questionnaire project, routed by two lines in
   Service.gs (sm.*), the way GroupClients.gs is.

   Who may write: the branch manager (the branch code, or a Branch Manager or Assistant Branch Manager sign-in) and a
   unit manager. Staff and agents may read. Nothing here holds a client's name: a contribution is what a person typed,
   and the live facts are counts. */

var SM = {
  TAB: 'Strategic Meeting',
  HEAD: ['When', 'Id', 'Day', 'Session', 'Session title', 'Kind', 'Point', 'Evidence', 'Ask', 'By', 'Role', 'Status', 'Removed by'],
  KINDS: ['fact', 'position', 'question', 'recommendation', 'definition', 'note'],
  MAX: 2000,              // characters kept of each field
  LIST_MAX: 400,          // rows the page is sent
  FACTS_CACHE_S: 600,     // the live counts, kept ten minutes
  GUIDE_CACHE_S: 1800,    // one AI read per session and set of contributions, kept half an hour
  AI_MAX_CONTRIB: 12,     // contributions the AI is shown
  VERSION: 1,
};

function smDoGet_(p) {
  try {
    switch (String(p.action || '')) {
      case 'sm.ping':  return { ok: true, sm: SM.VERSION, ai: smAiOn_() };
      case 'sm.me':    return smMe_(p);
      case 'sm.list':  return smList_(p);
      case 'sm.facts': return smFactsFor_(p);
    }
    return { ok: false, error: 'Unknown action' };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) };
  }
}

function smDoPost_(b) {
  try {
    switch (String(b.action || '')) {
      case 'sm.add':    return smAdd_(b);
      case 'sm.remove': return smRemove_(b);
      case 'sm.guide':  return smGuide_(b);
    }
    return { ok: false, error: 'Unknown action' };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) };
  }
}

/* ── who ────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The board's sign-in, with what this page needs: the name, the role word and whether they may write. */
function smWho_(p) {
  var w = tWho_(p.code, p.who);
  if (!w || !w.ok) return w || { ok: false, refused: true, error: 'Sign in first.' };
  var me = w.me || null;
  return { ok: true, role: w.role, name: me ? String(me.name || '') : 'Branch', title: me && me.title ? String(me.title) : (w.role === 'branch' ? 'Branch Manager' : ''),
    canWrite: smCanWrite_(w), viaBranch: !!w.viaBranch };
}
function smCanWrite_(w) { return !!w && !!w.ok && (w.role === 'branch' || w.role === 'unit'); }
function smMe_(p) {
  var w = smWho_(p);
  if (!w.ok) return w;
  return { ok: true, me: { name: w.name, role: w.role, title: w.title, canWrite: w.canWrite }, ai: smAiOn_() };
}
function smAiOn_() { try { return typeof gcmAiKey_ === 'function' && !!gcmAiKey_(); } catch (e) { return false; } }

/* ── the tab ────────────────────────────────────────────────────────────────────────────────────────────────────── */

function smSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(SM.TAB);
  if (!sh) {
    sh = ss.insertSheet(SM.TAB);
    sh.getRange(1, 1, 1, SM.HEAD.length).setValues([SM.HEAD]);
    try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, SM.HEAD.length).setFontWeight('bold'); } catch (e) {}
  }
  return sh;
}
function smText_(v, max) {
  return String(v === null || v === undefined ? '' : v).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim().slice(0, max || SM.MAX);
}
function smKey_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function smRows_() {
  var sh = ss_().getSheetByName(SM.TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(), head = v[0].map(function (h) { return String(h).trim(); }), out = [];
  v.slice(1).forEach(function (r, i) {
    var o = { _n: i + 2 };
    head.forEach(function (h, j) { if (h) o[h] = r[j]; });
    out.push(o);
  });
  return out;
}
function smWhen_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  var tz = typeof tTz_ === 'function' ? tTz_() : Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'd MMM HH:mm');
}
function smItem_(o) {
  return { id: String(o.Id || ''), when: smWhen_(o.When), day: Number(o.Day) || 0, session: String(o.Session || ''), title: String(o['Session title'] || ''),
    kind: String(o.Kind || 'note'), point: String(o.Point || ''), evidence: String(o.Evidence || ''), ask: String(o.Ask || ''),
    by: String(o.By || ''), role: String(o.Role || '') };
}

/** Every contribution not removed, oldest first, for anyone signed in. */
function smList_(p) {
  var w = smWho_(p);
  if (!w.ok) return w;
  var rows = smRows_().filter(function (o) { return !/^removed/i.test(String(o.Status || '')); }).map(smItem_);
  if (rows.length > SM.LIST_MAX) rows = rows.slice(rows.length - SM.LIST_MAX);
  return { ok: true, items: rows, me: { name: w.name, role: w.role, canWrite: w.canWrite }, ai: smAiOn_() };
}

/** One contribution against a session: a kind, the point, the evidence it rests on and what it asks of the room. */
function smAdd_(b) {
  var w = smWho_(b);
  if (!w.ok) return w;
  if (!w.canWrite) return { ok: false, error: 'Only the branch manager and a unit manager log contributions here. You can read them.' };
  var point = smText_(b.point), session = smText_(b.session, 40), day = Number(b.day) || 0;
  if (!session || !/^[a-z0-9-]+$/i.test(session)) return { ok: false, error: 'Which session is this for?' };
  if (!point) return { ok: false, error: 'Write the point first.' };
  var kind = String(b.kind || 'note').toLowerCase().trim();
  if (SM.KINDS.indexOf(kind) < 0) kind = 'note';
  var id = 'SM-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
  var row = [new Date(), id, day, session, smText_(b.title, 160), kind, point, smText_(b.evidence), smText_(b.ask), w.name, w.role, 'logged', ''];
  smSheet_().appendRow(row);
  try { CacheService.getScriptCache().remove('sm:guide:' + smKey_(session)); } catch (e) {}
  return { ok: true, id: id, item: smItem_({ When: row[0], Id: id, Day: day, Session: session, 'Session title': row[4], Kind: kind, Point: point, Evidence: row[7], Ask: row[8], By: w.name, Role: w.role }) };
}

/** A contribution taken back: its own writer's, or any by the branch. The row stays, marked removed. */
function smRemove_(b) {
  var w = smWho_(b);
  if (!w.ok) return w;
  if (!w.canWrite) return { ok: false, error: 'Only the branch manager and a unit manager change contributions here.' };
  var id = smText_(b.id, 30), hit = null;
  smRows_().forEach(function (o) { if (!hit && String(o.Id || '') === id) hit = o; });
  if (!hit) return { ok: false, error: 'That contribution is not on the tab any more.' };
  if (w.role !== 'branch' && smKey_(hit.By) !== smKey_(w.name)) return { ok: false, error: 'Only the person who logged it, or the branch, can take it back.' };
  var sh = smSheet_(), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var cS = head.indexOf('Status') + 1, cR = head.indexOf('Removed by') + 1;
  if (cS) sh.getRange(hit._n, cS).setValue('removed ' + smWhen_(new Date()));
  if (cR) sh.getRange(hit._n, cR).setValue(w.name);
  try { CacheService.getScriptCache().remove('sm:guide:' + smKey_(hit.Session)); } catch (e) {}
  return { ok: true, id: id };
}

/* ── the live facts: counts only, never a client ────────────────────────────────────────────────────────────────── */

/** What the branch's systems can say today, as numbers and sentences, for the page to put beside the notes. Each source
 *  is optional and read inside its own try, so a tab that is not there leaves a gap, never an error. Kept ten minutes. */
function smFactsFor_(p) {
  var w = smWho_(p);
  if (!w.ok) return w;
  return { ok: true, facts: smFacts_() };
}
function smFacts_() {
  var cache = null, key = 'sm:facts:' + SM.VERSION;
  try { cache = CacheService.getScriptCache(); var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) { cache = null; }
  var f = { at: smWhen_(new Date()), campaign: null, claims: null, team: null, lines: [] };
  /* the orphan transition campaign, from the stream's own answer (counts, no names), cached three minutes there */
  try {
    if (typeof tStream_ === 'function') {
      var s = typeof tServeCached_ === 'function' && typeof T_STREAM !== 'undefined' ? tServeCached_(T_STREAM, function () { return tStream_(); }) : tStream_();
      if (s && s.ok) {
        var hh = s.hh || {}, auto = s.auto || {}, people = s.people || {}, cl = s.clients || {};
        f.campaign = { households: Number(hh.all) || 0, householdsAnswered: Number(hh.answered) || 0, clients: Number(cl.all) || 0, clientsAnswered: Number(cl.answered) || 0,
          letters: Number(auto.letters) || 0, reminders: Number(auto.reminders) || 0, afterReminder: Number(auto.afterReminder) || 0,
          outcomesWeek: Number(people.week) || 0, reachedWeek: Number(people.reachedWeek) || 0, at: String(s.at || '') };
        (s.lines || []).forEach(function (l) { if (f.lines.length < 8) f.lines.push(String(l)); });
      }
    }
  } catch (e) { f.campaignError = String(e && e.message ? e.message : e).slice(0, 120); }
  /* the TT$200 retention claims: found, sent, paid */
  try {
    if (typeof T_CLAIM !== 'undefined') {
      var sh = ss_().getSheetByName(T_CLAIM.TAB);
      if (sh && sh.getLastRow() > 1) {
        var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(), head = v[0].map(function (h) { return String(h).trim(); });
        var iS = head.indexOf('Status'), iP = head.indexOf('Paid'), iSub = head.indexOf('Submitted');
        var c = { found: 0, sent: 0, paid: 0 };
        v.slice(1).forEach(function (r) {
          var st = iS >= 0 ? String(r[iS] || '') : '';
          if (/^(void|declined|withdrawn|cancel)/i.test(st)) return;
          c.found++;
          if (iSub >= 0 && r[iSub]) c.sent++;
          if ((iP >= 0 && r[iP]) || /^paid/i.test(st)) c.paid++;
        });
        f.claims = c;
      }
    }
  } catch (e) { f.claimsError = String(e && e.message ? e.message : e).slice(0, 120); }
  /* the team on the Agent Skill Bank: active, by role */
  try {
    if (typeof tTeam_ === 'function' && typeof tFormer_ === 'function') {
      var team = tTeam_(), former = tFormer_(), t = { active: 0, agents: 0, unitManagers: 0, staff: 0, units: {} };
      team.people.forEach(function (x) {
        if (!x.active || former[tNameKey_(x.name)]) return;
        t.active++;
        if (x.role === 'um') t.unitManagers++;
        else if (x.role === 'staff' || x.role === 'bm' || x.role === 'abm') { if (x.role === 'staff') t.staff++; }
        else { t.agents++; if (x.unit) t.units[x.unit] = (t.units[x.unit] || 0) + 1; }
      });
      t.unitList = Object.keys(t.units).map(function (u) { return { unit: u, agents: t.units[u] }; }).sort(function (a, b) { return b.agents - a.agents; });
      delete t.units;
      f.team = t;
    }
  } catch (e) { f.teamError = String(e && e.message ? e.message : e).slice(0, 120); }
  try { if (cache) cache.put(key, JSON.stringify(f), SM.FACTS_CACHE_S); } catch (e) {}
  return f;
}

/* ── the AI guide: three points a person could make, from the facts alone ───────────────────────────────────────── */

var SM_GUIDE_SYSTEM = [
  'You help a branch manager of Guardian Life of the Caribbean (Trinidad and Tobago) prepare a contribution for one session of the company\'s Joint Sales Managers\' Strategic Meeting.',
  'You are given the session (its title, its brief and its guiding question), what the branch\'s own record says, the branch\'s live counts, and the contributions already logged.',
  'Suggest three points the branch manager could make in the room. Each point rests on a fact that is in the material; invent nothing, and never add a number that is not given.',
  'Write in plain, short sentences. State the fact and trust it. No selling, no adjectives about people, nothing about why anyone left the company.',
  'Never name a client. Never name a former agent. Colleagues may be named only as the material names them.',
  'Answer with JSON only, no prose around it: {"points":[{"kind":"fact|position|question|recommendation","point":"one or two sentences","evidence":"the fact it rests on, from the material","ask":"what it asks of the room, one sentence"}],"caution":"one sentence on what the material cannot support, or an empty string"}',
].join('\n');

/** Three points for a session, from the page's notes for it, the live facts and the contributions so far. One read per
 *  session and set of contributions, kept half an hour. Without ANTHROPIC_API_KEY the answer says so and offers nothing. */
function smGuide_(b) {
  var w = smWho_(b);
  if (!w.ok) return w;
  if (!smAiOn_()) return { ok: false, error: 'The AI guide is not linked: add the ANTHROPIC_API_KEY Script property to the Service Questionnaire project.' };
  var session = smText_(b.session, 40), title = smText_(b.title, 200), brief = smText_(b.brief, 600), question = smText_(b.question, 400), notes = smText_(b.notes, 6000);
  if (!session || !title) return { ok: false, error: 'Which session?' };
  var contribs = smRows_().filter(function (o) { return !/^removed/i.test(String(o.Status || '')) && String(o.Session || '') === session; }).map(smItem_);
  var defs = smRows_().filter(function (o) { return !/^removed/i.test(String(o.Status || '')) && String(o.Kind || '') === 'definition'; }).map(smItem_);
  var stamp = contribs.concat(defs).map(function (c) { return c.id; }).join(',');
  var cache = null, key = 'sm:guide:' + smKey_(session), hit = null;
  try { cache = CacheService.getScriptCache(); hit = cache.get(key); } catch (e) { cache = null; }
  if (hit) { try { var h = JSON.parse(hit); if (h && h.stamp === stamp) return { ok: true, cached: true, points: h.points, caution: h.caution }; } catch (e) {} }
  var facts = smFacts_(), lines = [];
  lines.push('SESSION: ' + title);
  if (brief) lines.push('BRIEF: ' + brief);
  if (question) lines.push('GUIDING QUESTION: ' + question);
  lines.push('');
  lines.push('WHAT THE BRANCH\'S RECORD SAYS:');
  lines.push(notes || '(nothing noted for this session)');
  lines.push('');
  lines.push('LIVE COUNTS (as at ' + facts.at + '):');
  if (facts.campaign) {
    var c = facts.campaign;
    lines.push('- Orphan transition campaign: ' + c.householdsAnswered + ' of ' + c.households + ' households answered; ' + c.letters + ' letters and ' + c.reminders + ' reminders sent; ' +
      c.afterReminder + ' clients answered after the reminder; ' + c.outcomesWeek + ' outcomes logged on the board in the last seven days.');
    (facts.lines || []).forEach(function (l) { lines.push('- ' + l); });
  } else lines.push('- The campaign counts could not be read today.');
  if (facts.claims) lines.push('- TT$200 retention claims: ' + facts.claims.found + ' found, ' + facts.claims.sent + ' submitted, ' + facts.claims.paid + ' paid.');
  if (facts.team) lines.push('- Team on the Agent Skill Bank: ' + facts.team.agents + ' active agents, ' + facts.team.unitManagers + ' unit managers, ' + facts.team.staff + ' staff' +
    (facts.team.unitList && facts.team.unitList.length ? ' (' + facts.team.unitList.map(function (u) { return u.unit + ': ' + u.agents; }).join('; ') + ')' : '') + '.');
  lines.push('');
  if (defs.length) {
    lines.push('DEFINITIONS LOGGED BY THE BRANCH:');
    defs.slice(0, 4).forEach(function (d) { lines.push('- ' + d.point); });
    lines.push('');
  }
  lines.push('CONTRIBUTIONS ALREADY LOGGED FOR THIS SESSION (' + contribs.length + '):');
  if (!contribs.length) lines.push('(none yet)');
  contribs.slice(-SM.AI_MAX_CONTRIB).forEach(function (x) { lines.push('- [' + x.kind + ', ' + x.by + '] ' + x.point + (x.evidence ? ' Evidence: ' + x.evidence : '') + (x.ask ? ' Ask: ' + x.ask : '')); });
  var text = gcmClaude_(SM_GUIDE_SYSTEM, lines.join('\n')), parsed = smParseGuide_(text);
  if (!parsed) return { ok: false, error: 'The AI answered in a shape the page cannot read. Try once more.' };
  try { if (cache) cache.put(key, JSON.stringify({ stamp: stamp, points: parsed.points, caution: parsed.caution }), SM.GUIDE_CACHE_S); } catch (e) {}
  return { ok: true, points: parsed.points, caution: parsed.caution };
}
function smParseGuide_(text) {
  var s = String(text || '').trim(), m = /\{[\s\S]*\}/.exec(s.replace(/^```(?:json)?/i, '').replace(/```$/, ''));
  if (!m) return null;
  var j = null;
  try { j = JSON.parse(m[0]); } catch (e) { return null; }
  if (!j || !Array.isArray(j.points)) return null;
  var points = j.points.slice(0, 5).map(function (x) {
    var kind = String((x && x.kind) || 'position').toLowerCase().trim();
    if (SM.KINDS.indexOf(kind) < 0 || kind === 'definition') kind = 'position';
    return { kind: kind, point: smText_(x && x.point, 600), evidence: smText_(x && x.evidence, 600), ask: smText_(x && x.ask, 300) };
  }).filter(function (x) { return x.point; });
  if (!points.length) return null;
  return { points: points, caution: smText_(j.caution, 400) };
}

/** Editor: makes the tab, and says whether the AI guide is linked. */
function smSetup() {
  smSheet_();
  var msg = 'Strategic Meeting tab ready. AI guide: ' + (smAiOn_() ? 'linked' : 'not linked (set ANTHROPIC_API_KEY)') + '.';
  Logger.log(msg);
  return msg;
}
