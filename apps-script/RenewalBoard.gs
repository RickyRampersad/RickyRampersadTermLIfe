/**
 * ============================================================================
 * THE RENEWAL BOARD — one board, two experiences
 * ============================================================================
 * Paste into the SAME Apps Script project as Code.gs, Property.gs and
 * RenewalLines.gs. It adds one route (?board=KEY) and reads the sheets those
 * files already keep; nothing here owns data of its own.
 *
 * WHO SEES WHAT, and why it is one rule rather than two pages:
 *
 *   admin / manager   the branch: every renewal, every figure, who is on it
 *   staff             every renewal to work, every figure, no agent's ratings
 *   agent             their own clients and nobody else's
 *
 * The difference between the staff experience and the agent experience is not
 * a different screen — it is the same board answering "what is mine, and what
 * does it need from me". Staff are asked to move the work; an agent is asked
 * to have the conversation. So the scope, the order and the asks change, and
 * the page is one page. Two pages drift apart: the orphan board learned that.
 *
 * WHOSE CLIENT IT IS comes from Salesforce's Agent__c on the risk, carried
 * onto the sheets by SalesforceSync as 'Agent' and 'Agent Email'. An agent is
 * matched on the e-mail first and the name second, never on a first name
 * alone. A renewal with no agent on it belongs to the branch: it is shown to
 * staff and to nobody's agent list, because guessing would put one agent's
 * client in another agent's hands.
 */

var RB = {
  // A renewal this far out is still "coming", nearer than this is "now".
  SOON_DAYS: 14,
  // A premium owed this long after renewal is chased by a person, not a mail.
  OWED_CALL_DAYS: 28,
  // The board never asks for more than this at once: a list of 400 renewals
  // is a list nobody works. The rest are there, behind the filters.
  FIRST: 60,
};

/* ================================ the page ================================ */

function boardPage_(p) {
  var t = HtmlService.createTemplateFromFile('Board');
  var want = staffKey_();
  var ok = !!want && String(p.board) === want;
  t.payload = JSON.stringify({
    ok: ok, key: ok ? want : '',
    why: want ? '' : 'This board has no staff key set. An admin must add ' +
      STAFF_KEY_PROP + ' to Script Properties — until then nobody can sign in.',
  });
  return t.evaluate().setTitle('Renewals — your board')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ============================== who is asking ============================== */

/**
 * What this person may see. One place, read by the data and by every action,
 * so a view and a write can never disagree about scope.
 */
function rbScope_(staff) {
  var role = String(staff.role || 'staff').toLowerCase();
  var branch = /admin|manager/.test(role);
  var agent = /agent/.test(role) && !branch;
  return {
    role: role,
    branch: branch,
    staff: !agent,                 // staff and the branch both work the queue
    agent: agent,
    email: String(staff.email || '').trim().toLowerCase(),
    name: String(staff.name || '').trim(),
    // An agent sees money on their own clients: it is their book. What they
    // never see is another agent's anything, which the filter below enforces.
    money: true,
  };
}

/** Is this renewal this person's to see? */
function rbMine_(r, scope) {
  if (!scope.agent) return true;                 // staff and the branch see all
  var e = String(r.agentEmail || '').trim().toLowerCase();
  if (e) return e === scope.email;
  // No e-mail on the row: fall back to the name, and only to a full match.
  // A first name alone is how one agent ends up holding another's client.
  return !!r.agent && rbSameName_(r.agent, scope.name);
}

/** "SASHA LALLA" and "Sasha Lalla-Jagassar" are one person; "Neil" is nobody. */
function rbSameName_(a, b) {
  var A = rbWords_(a), B = rbWords_(b);
  if (!A.length || !B.length) return false;
  if (A[0] !== B[0]) return false;               // the first name must match
  var short = A.length <= B.length ? A : B, long = A.length <= B.length ? B : A;
  if (short.length < 2) return false;            // a first name alone matches nobody
  return short.every(function (w) { return long.indexOf(w) >= 0; });
}
function rbWords_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/).filter(function (w) { return w.length > 1; });
}

/* ============================== the renewals ============================== */

/** Every renewal, motor and property, in one shape the board can read. */
function rbAll_() {
  var out = [];

  (typeof allRenewals_ === 'function' ? allRenewals_() : []).forEach(function (r) {
    var line = (typeof lineOf_ === 'function') ? lineOf_(r.coverage, r.policy) : 'third-party';
    out.push({
      kind: 'motor', line: line,
      rowIndex: r.rowIndex, token: r.token,
      client: r.client, policy: r.policy, detail: r.coverage,
      due: r.nextDue, days: r.days,
      premium: Number(r.premium) || 0, paid: Number(r.paid) || 0,
      balance: Number(r.balance) || 0, payStatus: r.payStatus,
      status: r.renewalStatus, stage: '',
      email: r.email, mobile: r.mobile,
      assignedTo: r.assignedTo, agent: r.agent, agentEmail: r.agentEmail,
      sumInsured: Number(r.sumInsured) || 0,
      renewedDate: r.renewedDate,
    });
  });

  (typeof allProperties_ === 'function' ? allProperties_() : []).forEach(function (r) {
    out.push({
      kind: 'property', line: 'property',
      rowIndex: r.rowIndex, token: r.token,
      client: r.client, policy: r.policy, detail: r.location || r.occupancy || '',
      due: r.renewalDate, days: r.days,
      premium: Number(r.premium) || 0, paid: 0, balance: 0, payStatus: '',
      status: r.status, stage: r.stage,
      email: r.email, mobile: r.mobile,
      assignedTo: r.assignedTo, agent: r.agent, agentEmail: r.agentEmail,
      sumInsured: Number(r.total) || 0,
      renewedDate: '',
    });
  });

  return out;
}

/**
 * What this renewal needs next, in the words of whoever is reading it.
 *
 * Each line asks a different question, which is the whole point of grouping
 * by line: a comprehensive vehicle needs a value confirmed, a third party
 * needs nothing but a yes, and a property needs its rebuilding cost looked
 * at. The ask is never advice, only what the record shows is outstanding.
 */
function rbAsk_(r, scope) {
  var renewed = /renew/i.test(r.status || '') || !!r.renewedDate;
  var owed = r.balance > 0;
  // Two levels, not one. A third party due in ten days and a policy that
  // lapsed last week both need doing, but marking them the same red is how a
  // board stops meaning anything: if everything is urgent, nothing is read.
  // 'late' is something already gone wrong; 'soon' is work with a date on it.
  var soon = r.days !== null && r.days <= RB.SOON_DAYS;

  if (renewed && owed) {
    var long = r.days !== null && r.days < -RB.OWED_CALL_DAYS;
    return { key: 'owed', tone: long ? 'late' : 'soon', urgent: true,
      staff: 'Renewed, premium still owed — ' + rbMoney_(r.balance)
        + (long ? ' · past the point where an e-mail will do it' : ''),
      agent: 'Renewed. ' + rbMoney_(r.balance) + ' still to settle.' };
  }
  if (renewed) {
    return { key: 'done', tone: 'ok', urgent: false,
      staff: 'Renewed and paid', agent: 'Renewed and paid — nothing outstanding' };
  }
  if (r.days !== null && r.days < 0) {
    return { key: 'past', tone: 'late', urgent: true,
      staff: 'Past its renewal date and not renewed',
      agent: 'Cover has lapsed or is about to — call today' };
  }
  if (r.line === 'comprehensive') {
    return { key: 'value', tone: soon ? 'soon' : 'ok', urgent: soon,
      staff: 'Needs the vehicle value confirmed',
      agent: 'Confirm what the vehicle is worth now — it has fallen since last year' };
  }
  if (r.line === 'property') {
    return { key: 'sums', tone: soon ? 'soon' : 'ok', urgent: soon,
      staff: 'Needs the sums insured checked against rebuilding cost',
      agent: 'Check the sums insured — under-insured means every claim is cut' };
  }
  return { key: 'confirm', tone: soon ? 'soon' : 'ok', urgent: soon,
    staff: 'Straightforward — confirm and collect',
    agent: 'Nothing changes. Confirm and take the premium.' };
}

function rbMoney_(n) {
  n = Number(n) || 0;
  return 'TT$' + Math.round(n).toLocaleString('en-US');
}

/** Most pressing first: what is late, then what is owed, then what is near. */
function rbWeight_(r) {
  var w = 0;
  if (r.ask.urgent) w += 100;
  if (r.ask.key === 'past') w += 80;
  if (r.ask.key === 'owed') w += 60;
  if (r.ask.key === 'done') w -= 100;
  if (r.days !== null) w += Math.max(0, 60 - Math.abs(r.days));
  w += Math.min(40, r.premium / 1000);
  return Math.round(w);
}

/* ================================ the board ================================ */

function renewalBoardData(key, me, isLogin, pin) {
  var staff = requireStaff_(key, me, pin);
  var scope = rbScope_(staff);
  if (isLogin && typeof logActivity_ === 'function') {
    logActivity_('', staff.name, 'login', staff.email,
      'Opened the renewal board (' + scope.role + ')');
  }

  var rows = rbAll_().filter(function (r) { return rbMine_(r, scope); });
  rows.forEach(function (r) { r.ask = rbAsk_(r, scope); r.w = rbWeight_(r); });
  rows.sort(function (a, b) { return b.w - a.w; });

  var lines = { comprehensive: [], 'third-party': [], property: [] };
  rows.forEach(function (r) { (lines[r.line] || lines['third-party']).push(r); });

  var owed = rows.filter(function (r) { return r.ask.key === 'owed'; });
  var counts = {
    all: rows.length,
    act: rows.filter(function (r) { return r.ask.urgent; }).length,
    owed: owed.length,
    owedTotal: owed.reduce(function (a, r) { return a + r.balance; }, 0),
    done: rows.filter(function (r) { return r.ask.key === 'done'; }).length,
    comprehensive: lines.comprehensive.length,
    thirdParty: lines['third-party'].length,
    property: lines.property.length,
  };

  // Who is carrying what — the branch and staff only. An agent reading their
  // own board has no business seeing another agent's load.
  var byAgent = [];
  if (!scope.agent) {
    var m = {};
    rows.forEach(function (r) {
      var k = r.agent || '(nobody named)';
      if (!m[k]) m[k] = { agent: k, n: 0, act: 0, owed: 0 };
      m[k].n++;
      if (r.ask.urgent) m[k].act++;
      m[k].owed += r.balance;
    });
    byAgent = Object.keys(m).map(function (k) { return m[k]; })
      .sort(function (a, b) { return b.act - a.act || b.n - a.n; });
  }

  return {
    ok: true,
    who: { name: staff.name, email: staff.email, role: scope.role,
           agent: scope.agent, branch: scope.branch },
    counts: counts,
    byAgent: byAgent,
    rows: rows.slice(0, RB.FIRST),
    more: Math.max(0, rows.length - RB.FIRST),
    asOf: (typeof nowStamp_ === 'function') ? nowStamp_() : new Date().toISOString(),
  };
}

/* =============================== the actions =============================== */

/**
 * Everything a person can do from the board goes through here, so each one is
 * scope-checked on the server. A page that hides a button is a courtesy; this
 * is the rule.
 */
function renewalBoardAct(key, me, pin, act) {
  var staff = requireStaff_(key, me, pin);
  var scope = rbScope_(staff);
  act = act || {};
  var token = String(act.token || '').trim();

  var row = rbAll_().filter(function (r) { return r.token === token; })[0];
  if (!row) throw new Error('That renewal is not on this board.');
  if (!rbMine_(row, scope)) throw new Error('That client is not yours.');

  switch (String(act.what || '')) {
    case 'note': {
      var note = String(act.note || '').trim();
      if (note.length < 10) throw new Error('Write a line on what happened — a note of under ten characters tells the next person nothing.');
      logActivity_(token, row.client, 'note', staff.name, note);
      return { ok: true, said: 'Noted on ' + row.client + '.' };
    }
    case 'assign': {
      if (!scope.staff) throw new Error('Only the branch and staff assign renewals.');
      var to = String(act.to || '').trim();
      if (row.kind === 'property') setPropCell_(row.rowIndex, 'Assigned To', to);
      else setRenewalCell_(row.rowIndex, 'Assigned To', to);
      logActivity_(token, row.client, 'assign', staff.name, 'Assigned to ' + (to || '(nobody)'));
      return { ok: true, said: (to ? 'Assigned to ' + to : 'Assignment cleared') + '.' };
    }
    default:
      throw new Error('Unknown action.');
  }
}
