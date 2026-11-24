/* ═══════════════════════════════════════════════════════════════════════
   OPPORTUNITIES — maturities, riders ending and milestones, every day
   (tracker project, beside KPI.gs and Intelligence.gs)

   Asked for on 24 November 2026: "an opportunity dashboard ... on maturities
   for in-force policies, riders falling off etc and insights where we push to
   agents daily on milestones etc that requires reviews ... this must be pulled
   from the branch portfolio ... daily the agent needs to act on this", then
   "place this on the agent dash as well".

   Where the figures come from:
   - the Branch Portfolio's in-force tab (iTabInforce_): maturity date, plan,
     the client's birth date, fund value, the servicing agent. Salesforce's
     Maturity_Date__c is filled on fewer than one policy in ten and carries
     1930s dates on premium-paying policies, so it is never the source here;
   - Salesforce CLIENT_PORTFOLIO__c for the riders: Critical_Illness_Expiry__c,
     WP_Expiry__c, ADDAP_Expiry_Date__c, Life_Coverage_Expiry__c. Filled where
     filled; a blank is not an opportunity and nothing is guessed.

   Built once a day (oppBuild_, from keepWarm's first run after 5:00 or by
   hand: opportunitiesBuildNow) and kept in pieces (bigPut_). The agent's My
   day reads their own slice (oppForAgent_); the Branch Manager's My workday
   reads the roll-up (oppBranch_). A tap (act=opp) writes one row on the
   Opportunity Log tab, which is what "acted on" counts.

   Facts and next steps only: the guidelines tell the agent why to call and
   what to ask, never what a client should buy, cancel or replace.
   ═══════════════════════════════════════════════════════════════════════ */

var OPP = {
  AHEAD: 90,                 // days ahead an agent sees a maturity or a cover ending
  RIDER_AHEAD: 120,          // riders: a little longer, a replacement needs underwriting time
  BACK: 30,                  // a cover that ended in the last 30 days is still a call
  AGES: [40, 50, 60, 65],    // milestone birthdays
  AGE_AHEAD: 45,             // see the milestone this many days before the birthday
  TODAY_MAX: 5,              // what My day shows as "act on these today"
  KEY: 'opp_build',          // bigPut_ key for the day's build
  LOG: { name: 'Opportunity Log', head: ['When', 'Agent', 'Key', 'Kind', 'Policy', 'Outcome', 'Note', 'By'] }
};

/* One guideline per kind: why it matters, and what to say first. */
var OPP_GUIDE = {
  maturity: { l: 'Matures',            why: 'The payment is coming. Book the review before the cheque is paid.',
              say: 'Your policy matures soon. Before the payment comes through, can we sit for twenty minutes on what you want that money to do, and what cover you will have after?' },
  ci:       { l: 'Critical illness ends', why: 'Replacement cover is easiest while the client is still well.',
              say: 'Your critical illness benefit is coming to an end. Let us look at what you will be covered for after, while you are in good health.' },
  wp:       { l: 'Waiver ends',        why: 'Premiums stop being protected if the client cannot work.',
              say: 'The benefit that pays your premiums if you are unable to work is ending. Let us check what that means for your policy.' },
  addap:    { l: 'Accident cover ends', why: 'Accident benefit falls off; check the family is still protected.',
              say: 'Your accident benefit ends shortly. A quick review makes sure nothing important falls away.' },
  life:     { l: 'Life cover ends',    why: 'The death benefit stops. Review while the client is insurable.',
              say: 'Your life cover ends soon. Let us look at it while you are still in good health.' },
  age:      { l: 'Turns',              why: 'A milestone birthday is a natural reason to review.',
              say: 'Happy early birthday. This is a good time to look at what your policies still need to do for you.' }
};

function oppKeyOf_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^A0*/, 'A'); }

/* ── The daily build ── */
function oppBuild_(today) {
  today = today || iToday_();
  var out = { at: new Date().toISOString(), day: iIso_(today), items: [], errors: [] };
  // 1. Maturities and milestones from the Branch Portfolio's in-force tab.
  try {
    var sh = iTabInforce_();
    if (!sh) out.errors.push('No in-force tab in the Branch Portfolio.');
    else {
      var d = iReadCols_(sh, {
        policy: ['policy id'], given: ['given name'], sur: ['surname'], plan: ['plan'],
        mat: ['policy maturity date'], fund: ['fund value'], annual: ['annual premium'],
        birth: ['client birth date'], clientId: ['client id'],
        agent: ['servcing agent name', 'servicing agent name'], agentId: ['servicing agent id']
      });
      var skip = {}; try { skip = iExcluded_(); } catch (e) {}
      var seenAge = {};
      for (var r = 0; r < d.rows; r++) {
        var pol = String(d.get('policy', r)).trim(); if (!pol) continue;
        var agent = String(d.get('agent', r)).trim(); if (iExcludes_(skip, agent)) continue;
        var base = { pol: pol, plan: String(d.get('plan', r)).trim(), c: (String(d.get('given', r)).trim() + ' ' + String(d.get('sur', r)).trim()).trim(),
                     agent: agent, aid: oppKeyOf_(d.get('agentId', r)), fund: iNum_(d.get('fund', r)), annual: iNum_(d.get('annual', r)) };
        var mat = iDate_(d.get('mat', r)), dm = mat ? iDays_(today, mat) : null;
        // A maturity before 1990 or more than 70 years out is a keying error, not an opportunity.
        if (mat && mat.getFullYear() > 1990 && dm !== null && dm >= -OPP.BACK && dm <= OPP.AHEAD)
          out.items.push(oppItem_(base, 'maturity', mat, dm));
        var b = iDate_(d.get('birth', r)), cid = String(d.get('clientId', r)).trim() || base.c;
        if (b && !seenAge[cid]) {
          var y = today.getFullYear(), next = new Date(y, b.getMonth(), b.getDate());
          if (iDays_(today, next) < 0) next = new Date(y + 1, b.getMonth(), b.getDate());
          var turns = next.getFullYear() - b.getFullYear(), dd = iDays_(today, next);
          if (OPP.AGES.indexOf(turns) > -1 && dd <= OPP.AGE_AHEAD) { seenAge[cid] = 1; var it = oppItem_(base, 'age', next, dd); it.turns = turns; out.items.push(it); }
        }
      }
    }
  } catch (e) { out.errors.push('Branch Portfolio: ' + String(e && e.message || e).slice(0, 160)); }
  // 2. Riders and cover ending, from Salesforce, where the dates are filled.
  try {
    var F = { ci: 'Critical_Illness_Expiry__c', wp: 'WP_Expiry__c', addap: 'ADDAP_Expiry_Date__c', life: 'Life_Coverage_Expiry__c' };
    var win = function (f) { return '(' + f + ' >= LAST_N_DAYS:' + OPP.BACK + ' AND ' + f + ' <= NEXT_N_DAYS:' + OPP.RIDER_AHEAD + ')'; };
    var rows = sfkQuery_('SELECT POLICY__c, PLAN_NAME__c, Contact__r.Name, AgentName__c, ' + Object.keys(F).map(function (k) { return F[k]; }).join(', ') +
      ' FROM CLIENT_PORTFOLIO__c WHERE (Policy_Status_Description__c LIKE \'PREMIUM PAYING%\' OR Policy_Status_Description__c LIKE \'PAID UP%\' OR Policy_Status_Description__c LIKE \'WAIVER%\')' +
      ' AND (' + Object.keys(F).map(function (k) { return win(F[k]); }).join(' OR ') + ') LIMIT 5000');
    var tz = Session.getScriptTimeZone();
    rows.forEach(function (x) {
      var an = String(x.AgentName__c || ''), m = an.match(/^\s*(A?\d+)\s*-\s*(.*)$/);
      var base = { pol: String(x.POLICY__c || ''), plan: String(x.PLAN_NAME__c || ''), c: x.Contact__r ? String(x.Contact__r.Name || '') : '',
                   agent: m ? m[2].trim() : an, aid: m ? oppKeyOf_(m[1]) : '', fund: 0, annual: 0 };
      if (!base.pol) return;
      Object.keys(F).forEach(function (k) {
        var v = x[F[k]]; if (!v) return;
        var dt = new Date(String(v) + 'T12:00:00'), dd = iDays_(today, dt);
        if (dd < -OPP.BACK || dd > OPP.RIDER_AHEAD) return;
        // Life cover ending on the maturity day is the maturity itself, already listed from the Portfolio.
        if (k === 'life' && out.items.some(function (i) { return i.pol === base.pol && i.k === 'maturity'; })) return;
        out.items.push(oppItem_(base, k, dt, dd));
      });
    });
  } catch (e) { out.errors.push('Salesforce: ' + String(e && e.message || e).slice(0, 160)); }
  out.items.sort(function (a, b) { return oppRank_(a) - oppRank_(b); });
  bigPut_(OPP.KEY, out);
  try { runlog_('opportunities built: ' + out.items.length + (out.errors.length ? ' · ' + out.errors.join(' | ') : '')); } catch (e) {}
  return out;
}

function oppItem_(base, k, when, days) {
  var g = OPP_GUIDE[k];
  return { id: k + ':' + base.pol, k: k, pol: base.pol, plan: base.plan, c: base.c, agent: base.agent, aid: base.aid,
           when: iIso_(when), days: days, fund: base.fund, annual: base.annual, why: g.why, say: g.say, l: g.l };
}

/* Most urgent first: a cover already gone, then the soonest; maturities lead a tie (money moving). */
function oppRank_(i) { return (i.days < 0 ? -1000 : i.days) + (i.k === 'maturity' ? 0 : i.k === 'age' ? 3 : 1); }

function oppGet_() {
  var b = null; try { b = bigGet_(OPP.KEY, null); } catch (e) {}
  if (!b || b.day !== iIso_(iToday_())) { try { b = oppBuild_(); } catch (e) { b = b || { items: [], errors: [String(e && e.message || e)] }; } }
  return b;
}

function oppLogRows_() {
  var sh = ss_().getSheetByName(OPP.LOG.name); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, OPP.LOG.head.length).getValues();
}
function oppActed_() { var m = {}; oppLogRows_().forEach(function (r) { m[String(r[2])] = String(r[5]); }); return m; }

function oppLabel_(i) { return i.k === 'age' ? 'Turns ' + i.turns : i.days < 0 ? i.l + 'ed ' + (-i.days) + ' days ago' : i.l + ' in ' + i.days + ' days'; }

/* ── One agent's slice, for My day ── */
function oppForAgent_(a) {
  var b = oppGet_(), id = oppKeyOf_(a.agentId || a.code), nk = String(a.name || '').toLowerCase().replace(/[^a-z]/g, '');
  var acted = oppActed_();
  var mine = (b.items || []).filter(function (i) {
    return (id && i.aid === id) || (nk && String(i.agent).toLowerCase().replace(/[^a-z]/g, '') === nk);
  });
  var open = mine.filter(function (i) { return !acted[i.id]; });
  var q = function (lo, hi) { return mine.filter(function (i) { return i.days >= lo && i.days <= hi; }).length; };
  return {
    total: mine.length, open: open.length, acted: mine.length - open.length,
    booked: mine.filter(function (i) { return acted[i.id] === 'Review booked'; }).length,
    soon: mine.filter(function (i) { return i.days <= 30; }).length,
    bands: [{ l: 'Gone or this month', n: q(-OPP.BACK, 30) }, { l: '31–60 days', n: q(31, 60) }, { l: '61–90 days', n: q(61, 90) }, { l: '91 days +', n: q(91, 999) }],
    today: open.slice(0, OPP.TODAY_MAX).map(function (i) { return { id: i.id, k: i.k, t: oppLabel_(i), plan: i.plan, pol: i.pol, c: i.c, when: shortDate_(i.when), why: i.why, say: i.say }; }),
    built: b.at || '', errors: b.errors || []
  };
}

/* ── The branch roll-up, for the Branch Manager ── */
function oppBranch_() {
  var b = oppGet_(), acted = oppActed_(), by = {}, kinds = {}, untouched = 0, fund = 0;
  var people = {}; try { people = agentPeople_(); } catch (e) {}
  var known = {}; Object.keys(people).forEach(function (k) { known[oppKeyOf_(people[k].agentId || people[k].code)] = people[k].name; });
  (b.items || []).forEach(function (i) {
    var who = known[i.aid] || (i.agent ? 'Orphan books / not on the roll' : 'No agent'), r = by[who] || (by[who] = { a: who, due: 0, acted: 0, booked: 0, cold: 0 });
    r.due++; kinds[i.k] = (kinds[i.k] || 0) + 1;
    var o = acted[i.id]; if (o) { r.acted++; if (o === 'Review booked') r.booked++; }
    else if (i.days <= 30) { r.cold++; untouched++; }
    if (i.k === 'maturity' && i.days >= 0) fund += i.fund || 0;
  });
  var rows = Object.keys(by).map(function (k) { return by[k]; }).sort(function (x, y) { return y.cold - x.cold || y.due - x.due; });
  return { total: (b.items || []).length, untouched: untouched, acted: rows.reduce(function (s, r) { return s + r.acted; }, 0),
           booked: rows.reduce(function (s, r) { return s + r.booked; }, 0), fund: Math.round(fund),
           kinds: Object.keys(OPP_GUIDE).map(function (k) { return { k: k, l: k === 'age' ? 'Age milestones' : OPP_GUIDE[k].l, n: kinds[k] || 0 }; }),
           agents: rows, built: b.at || '', errors: b.errors || [] };
}

/* ── A tap from My day ── */
function oppAct_(a, p, by) {
  var id = String(p.id || '').slice(0, 80), out = String(p.outcome || '');
  if (['Review booked', 'Called', 'Not interested', 'Already done'].indexOf(out) < 0) return { ok: false, error: 'Pick what happened.' };
  var it = (oppGet_().items || []).filter(function (i) { return i.id === id; })[0];
  if (!it) return { ok: false, error: 'That opportunity is no longer on the list.' };
  var mine = oppKeyOf_(a.agentId || a.code);
  if (it.aid && mine && it.aid !== mine && by !== 'ricky') return { ok: false, error: 'That one is on another agent\'s book.' };
  var sh = ss_().getSheetByName(OPP.LOG.name);
  if (!sh) { sh = ss_().insertSheet(OPP.LOG.name); sh.getRange(1, 1, 1, OPP.LOG.head.length).setValues([OPP.LOG.head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  sh.appendRow([new Date(), a.name, id, it.k, "'" + it.pol, out, String(p.note || '').slice(0, 500), by || a.key]);
  return { ok: true };
}

/* Editor: build now and say what came back. */
function opportunitiesBuildNow() {
  var b = oppBuild_();
  var n = {}; b.items.forEach(function (i) { n[i.k] = (n[i.k] || 0) + 1; });
  Logger.log('Opportunities: ' + b.items.length + ' ' + JSON.stringify(n) + (b.errors.length ? '\nProblems: ' + b.errors.join(' | ') : ''));
  return b.items.length;
}
