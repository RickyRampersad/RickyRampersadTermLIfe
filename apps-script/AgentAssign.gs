/**
 * ================================================================
 *  AGENT REASSIGNMENT — "You don't have an active agent" programme
 *  Ricky Rampersad Branch · Guardian Life of the Caribbean
 * ================================================================
 *
 *  WHAT THIS DOES
 *  --------------
 *  1. Reads the "Branch Portfolio" sheet and works out which policies
 *     are being serviced by an agent who is NO LONGER ACTIVE — i.e. the
 *     servicing agent's name does not match an Active person on the
 *     Users roster. Those clients are "orphaned".
 *  2. Builds a "Reassign" queue — ONE row per client (not per policy),
 *     each with a private token and a personal portal link.
 *  3. Sends the client a personal invitation from the Branch Manager.
 *  4. The client opens their portal, sees their own policies, and answers
 *     a short profiling form (in-house vs. personal agent + what their
 *     previous agent actually did for them).
 *  5. On submit: client gets an instant recap, Sales Support gets the full
 *     answers plus a psychological read of the client.
 *  6. When an "Appointed Agent" is written on the Reassign tab, the client
 *     is told who their new agent is (with the agent's profile), and the
 *     agent is briefed and CC'd — with a 1 working-day contact promise.
 *  7. The agent must file a first-contact report. Chasers escalate to the
 *     Branch Manager if they don't.
 *
 *  DESIGN NOTE — this is a STANDALONE script (not bound to the sheet), so
 *  it cannot collide with the doGet/doPost/onOpen of any script already
 *  installed on the Branch Portfolio spreadsheet. It reaches the sheet by
 *  ID. The Branch Manager drives everything from the web dashboard.
 *
 *  SAFETY — TEST_MODE is ON by default: every email is redirected to the
 *  Branch Manager, with a banner showing who it *would* have gone to.
 *  Nothing reaches a real client until you set TEST_MODE to false.
 *
 *  SETUP: see ASSIGN-SETUP.md in the repository.
 * ================================================================
 */

var CONFIG = {
  /* ---- The spreadsheet that holds everything ------------------------ */
  // Google Sheet ID of "Branch Portfolio" (from its URL, between /d/ and /edit)
  SPREADSHEET_ID: '1T1SG3mgs5QV5LuF3JTpmn1zFldhGjOQNoe0YCMhWxjs',

  /* ---- Who is writing to the client --------------------------------- */
  MANAGER_NAME:  'Ricky Rampersad',
  MANAGER_TITLE: 'Branch Manager',
  MANAGER_EMAIL: 'ricky.rampersad@myguardiangroup.com',
  MANAGER_PHONE: '(868) 678-5921',
  MANAGER_YEARS: 35,          // years in the industry — used in the intro copy
  BRANCH_NAME:   'Ricky Rampersad Branch',
  BRANCH_AREA:   'Chaguanas, Trinidad',

  /* ---- Where the internal notifications go -------------------------- */
  // ⚠ SET THIS. Every client submission is emailed here for action.
  SALES_SUPPORT_EMAIL: '',    // e.g. 'branchsupport@myguardiangroup.com'

  /* ---- The website -------------------------------------------------- */
  // The client's token is appended, producing e.g.
  //   https://rickyrampersadbranch.com/assign/?t=AbCd1234
  // If you register a dedicated domain later, change this one line.
  PORTAL_BASE: 'https://rickyrampersadbranch.com/assign/?t=',
  AGENT_PORTAL: 'https://rickyrampersadbranch.com/assign/agent.html',

  /* ---- Safety ------------------------------------------------------- */
  TEST_MODE: true,            // true = every email goes to MANAGER_EMAIL only
  AUTO_INVITE: false,         // true = the daily job also sends new invitations

  // Most invitations to send in one run. The portfolio is ~20,000 policies, so
  // the orphaned list can be long — this paces it and keeps you inside Gmail's
  // daily cap. Each run resumes exactly where the last one stopped.
  MAX_INVITES_PER_RUN: 60,

  /* ---- Cadence (days) ----------------------------------------------- */
  APPOINT_BY_DAYS:  3,        // promise: an agent appointed within 3 days
  AGENT_CONTACT_DAYS: 1,      // promise: the agent calls within 1 working day
  AGENT_CHASE_DAYS: 3,        // escalate to the manager after this long

  /**
   * Agency and brokerage channels, not departed individuals.
   *
   * The book names these as the "agent" on ~840 clients. They are almost
   * certainly serviced by the broker, not orphaned — but that is a commercial
   * judgement, not a data one, so it is yours to make. Names matched here are
   * treated as SERVICED and left out of the queue entirely.
   *
   * Delete a line to pull that channel's clients INTO the outreach.
   * Run listInactiveAgents() to see the full list before you decide.
   */
  EXCLUDE_AGENTS: [
    'Ignatius And Company Limited',
    'Alm Insurance Services Limited',
    'V.I.P.S. Financial Services Ltd',
    'Agentsatlange Trinidad',
    'Cera Financial Services Ltd',
  ],

  /* ---- Tabs --------------------------------------------------------- */
  // The portfolio lives on the "Export" tab (~20,000 rows). Leave this set —
  // if it is blank the script auto-detects, and auto-detection can land on a
  // smaller working tab that happens to share the same headers.
  PORTFOLIO_SHEET: 'Export',
  USERS_SHEET:     'Users',         // existing roster — the source of truth for "active"
  REASSIGN_SHEET:  'Reassign',
  RESPONSES_SHEET: 'Reassign Responses',
  PROFILES_SHEET:  'Agent Profiles',
  LOG_SHEET:       'Reassign Log',
};

/* Portfolio column headers, exactly as they appear on the sheet. */
var P = {
  AGENT: 'Agent', POLICY: 'Number', CLIENT_NO: 'Client Number', CLIENT: 'Client',
  PREMIUM: 'Premium', ISSUE: 'Issue Date', STATUS_DESC: 'Status Description',
  SUM_ASSURED: 'Sum Assured', PLAN: 'Plan Code', BILLING: 'Billing type',
  PAID_TO: 'Paid To Date', ADDRESS: 'Address', PHONE: 'Phone', EMAIL: 'email',
};

/* Reassign queue column headers (created automatically). */
var R = {
  CLIENT_NO: 'Client No', CLIENT: 'Client', FORMER: 'Former Agent',
  EMAIL: 'Email', PHONE: 'Phone', POLICIES: 'Policies', PREMIUM: 'Annual Premium (TT$)',
  COVER: 'Sum Assured (TT$)', TOKEN: 'Token', LINK: 'Portal Link', STATUS: 'Status',
  INVITED: 'Invited', RESPONDED: 'Responded', PREFERENCE: 'Client Preference',
  APPOINTED: 'Appointed Agent', APPOINTED_AT: 'Appointed On',
  AGENT_NOTIFIED: 'Agent Notified', AGENT_CONTACT: 'Agent First Contact',
  AGENT_UPDATE: 'Agent Update', CLOSED: 'Closed',
  POLICIES_JSON: 'Policies JSON',
};

/* Policy statuses that mean "do not contact about servicing". */
var DEAD_STATUSES = ['death', 'file closed', 'not proceeded with', 'declined', 'matured'];

/**
 * ---------------------------------------------------------------------------
 * SCALE
 * ---------------------------------------------------------------------------
 * The portfolio is ~20,000 policy rows. Reading that sheet is expensive, and
 * Apps Script kills any execution that runs past six minutes — so the rule
 * throughout this file is:
 *
 *   ONLY buildReassignQueue() and reportInactiveAgents() may touch the
 *   portfolio sheet. Everything else reads the small Reassign tab.
 *
 * That works because the queue builder denormalises each orphaned client's
 * policies into the "Policies JSON" column as it goes. Portal page loads,
 * emails and dashboards then never scan 20,000 rows.
 *
 * Within a single execution, CACHE_ memoises the roster, the active/inactive
 * decision per distinct agent name, and the response index.
 */
var CACHE_ = { roster: null, activeMemo: {}, responses: null };

/* ==================== ONE-TIME SETUP ==================== */

/**
 * Run this ONCE from the Apps Script editor (Run → setup), then authorise.
 * It creates every tab it needs, seeds agent profiles, builds the queue,
 * and installs the triggers. It sends NOTHING.
 */
function setup() {
  ensureReassignSheet_();
  ensureResponsesSheet_();
  ensureProfilesSheet_();
  ensureLogSheet_();
  seedAgentProfiles_();
  var n = buildReassignQueue();
  installTriggers();

  var weak = 0;
  readTable_(ss_().getSheetByName(CONFIG.USERS_SHEET)).forEach(function (u) {
    if (String(u['Password'] || '').trim().length < MIN_CODE_LENGTH) weak++;
  });

  Logger.log('Setup complete. ' + n.added + ' orphaned clients queued (' + n.total +
             ' in the queue). TEST_MODE is ' + (CONFIG.TEST_MODE ? 'ON — emails go to you only.'
             : 'OFF — emails go to real clients.'));
  if (weak) {
    Logger.log('⚠ SECURITY: ' + weak + ' user(s) on the Users tab still have a weak access ' +
               'code (fewer than ' + MIN_CODE_LENGTH + ' characters). They CANNOT sign in ' +
               'until you run rotateAccessCodes() — which issues strong codes and emails ' +
               'each person their own.');
  }
  if (!CONFIG.SALES_SUPPORT_EMAIL) {
    Logger.log('⚠ SALES_SUPPORT_EMAIL is empty — client submissions will go to ' +
               CONFIG.MANAGER_EMAIL + ' until you set it.');
  }
}

/** Installs the appointment watcher and the daily cadence job. */
function installTriggers() {
  removeTriggers_();
  ScriptApp.newTrigger('onAppointmentEdit')
    .forSpreadsheet(CONFIG.SPREADSHEET_ID).onEdit().create();
  ScriptApp.newTrigger('dailyCadence')
    .timeBased().atHour(8).everyDays(1).create();
  Logger.log('Triggers installed: appointment watcher + daily 8am cadence.');
}

function removeTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'onAppointmentEdit' || f === 'dailyCadence') ScriptApp.deleteTrigger(t);
  });
}

/* ============ STEP 1 — WHO HAS NO ACTIVE AGENT? ============ */

/**
 * The core question. An agent counts as ACTIVE when their name matches a
 * row on the Users roster whose "Active" column says Active. Every policy
 * whose servicing agent fails that test belongs to an orphaned client.
 *
 * Returns { added, total, agents } and refreshes the Reassign tab.
 */
function buildReassignQueue() {
  var t0 = new Date().getTime();
  var roster = activeRoster_();
  var sh = ensureReassignSheet_();

  // Which clients are already queued? Read this BEFORE the big scan.
  var existing = readTable_(sh);
  var seen = {};
  existing.forEach(function (e) { seen[String(e[R.CLIENT_NO]).trim()] = true; });

  // ---- the one and only pass over the portfolio -------------------------
  // Streamed in blocks so a 20,000-row sheet never lands in memory at once.
  var psh = portfolioSheet_();
  var lastRow = psh.getLastRow(), lastCol = psh.getLastColumn();
  var headers = psh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var col = {};
  Object.keys(P).forEach(function (k) { col[k] = headers.indexOf(P[k]); });
  if (col.CLIENT_NO < 0 || col.AGENT < 0) {
    throw new Error('The portfolio tab is missing an "Agent" or "Client Number" column.');
  }

  var BLOCK = 2000, orphans = {}, scanned = 0;
  for (var start = 2; start <= lastRow; start += BLOCK) {
    var n = Math.min(BLOCK, lastRow - start + 1);
    var block = psh.getRange(start, 1, n, lastCol).getValues();
    for (var b = 0; b < block.length; b++) {
      scanned++;
      var row = block[b];
      var clientNo = String(row[col.CLIENT_NO] || '').trim();
      var agent = String(row[col.AGENT] || '').trim();
      if (!clientNo || !/^\d+$/.test(clientNo) || !agent) continue;
      if (isActiveAgent_(agent, roster)) continue;                   // still serviced
      var statusDesc = col.STATUS_DESC >= 0 ? String(row[col.STATUS_DESC] || '').trim() : '';
      if (DEAD_STATUSES.indexOf(statusDesc.toLowerCase()) !== -1) continue;

      var o = orphans[clientNo] || (orphans[clientNo] = {
        clientNo: clientNo, client: '', formers: {},
        email: '', phone: '', policies: 0, premium: 0, cover: 0, list: [],
      });
      o.formers[agent] = true;
      o.policies++;
      o.premium += num_(row[col.PREMIUM]);
      o.cover += num_(row[col.SUM_ASSURED]);
      if (!o.client && row[col.CLIENT]) o.client = String(row[col.CLIENT]);
      if (!o.email && isEmail_(row[col.EMAIL])) {
        o.email = String(row[col.EMAIL]).replace(/\s+/g, '').toLowerCase();
      }
      if (!o.phone && isPhone_(row[col.PHONE])) o.phone = String(row[col.PHONE]).trim();
      // Denormalise the policy so nothing downstream ever rescans this sheet.
      if (o.list.length < 60) {
        o.list.push({
          policy: String(row[col.POLICY] || ''), plan: String(row[col.PLAN] || ''),
          premium: num_(row[col.PREMIUM]), cover: num_(row[col.SUM_ASSURED]),
          issued: dateStr_(row[col.ISSUE]), status: statusDesc || 'In force',
          billing: String(row[col.BILLING] || ''), agent: agent,
          lapsed: /laps/i.test(statusDesc),
        });
      }
    }
  }

  // ---- merge into the queue, leaving in-flight rows alone ----------------
  var toAdd = [];
  Object.keys(orphans).forEach(function (k) {
    if (seen[k]) return;
    var o = orphans[k];
    var token = makeToken_();
    toAdd.push([
      o.clientNo, o.client, Object.keys(o.formers).join(', '), o.email, o.phone,
      o.policies, round2_(o.premium), o.cover, token, CONFIG.PORTAL_BASE + token,
      o.email ? 'Queued' : 'No email — call this client', '', '', '', '', '', '', '', '', '',
      JSON.stringify(o.list).slice(0, 45000),
    ]);
  });
  for (var i = 0; i < toAdd.length; i += 500) {              // bulk write in chunks
    var slice = toAdd.slice(i, i + 500);
    sh.getRange(sh.getLastRow() + 1, 1, slice.length, slice[0].length).setValues(slice);
  }

  var secs = Math.round((new Date().getTime() - t0) / 1000);
  var msg = 'Scanned ' + scanned + ' policy rows in ' + secs + 's · ' +
            Object.keys(orphans).length + ' orphaned clients found · ' +
            toAdd.length + ' newly added to the queue';
  log_('QUEUE', '', '', msg);
  Logger.log(msg);
  return { added: toAdd.length, total: existing.length + toAdd.length,
           orphans: Object.keys(orphans).length, scanned: scanned, seconds: secs };
}

/** The Users roster, reduced to the people who are genuinely active. */
function activeRoster_() {
  if (CACHE_.roster) return CACHE_.roster;        // built once per execution
  return (CACHE_.roster = readActiveRoster_());
}

function readActiveRoster_() {
  var sh = ss_().getSheetByName(CONFIG.USERS_SHEET);
  if (!sh) throw new Error('Cannot find the "' + CONFIG.USERS_SHEET + '" tab — that roster ' +
                           'is what tells us who is still active.');
  var out = [];
  readTable_(sh).forEach(function (u) {
    var active = String(u['Active'] || '').trim().toLowerCase();
    if (active && active !== 'active' && active !== 'yes' && active !== 'y' && active !== 'true') return;
    var name = String(u['Name'] || '').replace(/^A\d+\s*-\s*/, '').trim();
    if (!name) return;
    out.push({
      name: name, key: nameKey_(name), email: String(u['Email'] || '').trim(),
      number: String(u['Agent Number'] || '').trim(), role: String(u['Role'] || '').trim(),
      unit: String(u['Unit'] || '').trim(), code: String(u['Password'] || '').trim(),
    });
  });
  return out;
}

/**
 * Fuzzy name match — the portfolio and the roster spell names differently.
 *
 * Memoised per distinct agent name. Across 20,000 policy rows there are only a
 * few hundred distinct names, so this turns ~20,000 × 37 string comparisons
 * into a few hundred — the difference between finishing and timing out.
 */
function isActiveAgent_(agentName, roster) {
  var key = nameKey_(agentName);
  if (!key) return false;
  if (CACHE_.activeMemo.hasOwnProperty(key)) return CACHE_.activeMemo[key];

  // Agency/brokerage channels count as serviced — see CONFIG.EXCLUDE_AGENTS.
  for (var x = 0; x < CONFIG.EXCLUDE_AGENTS.length; x++) {
    if (nameKey_(CONFIG.EXCLUDE_AGENTS[x]) === key) return (CACHE_.activeMemo[key] = true);
  }

  var parts = key.split(' '), hit = false;
  for (var i = 0; i < roster.length; i++) {
    var rk = roster[i].key;
    if (rk === key) { hit = true; break; }
    var rp = rk.split(' ');
    if (sharedTokens_(parts, rp) >= 2) { hit = true; break; }   // two names in common
    if (parts.length >= 2 && rp.length >= 2 &&
        parts[0] === rp[0] && parts[parts.length - 1] === rp[rp.length - 1]) { hit = true; break; }
  }
  return (CACHE_.activeMemo[key] = hit);
}

function nameKey_(n) {
  return String(n || '').replace(/^A\d+\s*-\s*/, '').toLowerCase()
    .replace(/[^a-z ]/g, ' ').split(/\s+/).filter(String).join(' ');
}
function sharedTokens_(a, b) {
  var c = 0;
  a.forEach(function (x) { if (x.length > 2 && b.indexOf(x) !== -1) c++; });
  return c;
}

/**
 * Every policy belonging to one client.
 *
 * Reads the snapshot that buildReassignQueue() stored on the client's own
 * Reassign row. This is deliberate: portal page loads, emails and dashboards
 * must NEVER scan the 20,000-row portfolio. Pass the Reassign row when you
 * already have it; otherwise it is looked up from the (small) Reassign tab.
 *
 * Falls back to a live scan only when the snapshot is missing — e.g. a row
 * added by hand. Re-run buildReassignQueue() to refresh snapshots.
 */
function policiesFor_(clientNo, row) {
  if (!row) {
    var found = findByClientNo_(clientNo);
    row = found && found.row;
  }
  if (row && row[R.POLICIES_JSON]) {
    try {
      var parsed = JSON.parse(row[R.POLICIES_JSON]);
      if (parsed && parsed.length) return parsed;
    } catch (e) { /* fall through to the live scan */ }
  }
  return policiesLive_(clientNo);
}

/** Last resort — a targeted scan of the portfolio for one client. */
function policiesLive_(clientNo) {
  var psh = portfolioSheet_();
  var lastRow = psh.getLastRow(), lastCol = psh.getLastColumn();
  var headers = psh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var col = {};
  Object.keys(P).forEach(function (k) { col[k] = headers.indexOf(P[k]); });
  if (col.CLIENT_NO < 0) return [];

  var want = String(clientNo).trim(), out = [], BLOCK = 2000;
  for (var start = 2; start <= lastRow; start += BLOCK) {
    var n = Math.min(BLOCK, lastRow - start + 1);
    var block = psh.getRange(start, 1, n, lastCol).getValues();
    for (var b = 0; b < block.length; b++) {
      if (String(block[b][col.CLIENT_NO] || '').trim() !== want) continue;
      var status = col.STATUS_DESC >= 0 ? String(block[b][col.STATUS_DESC] || '').trim() : '';
      out.push({
        policy: String(block[b][col.POLICY] || ''), plan: String(block[b][col.PLAN] || ''),
        premium: num_(block[b][col.PREMIUM]), cover: num_(block[b][col.SUM_ASSURED]),
        issued: dateStr_(block[b][col.ISSUE]), status: status || 'In force',
        billing: String(block[b][col.BILLING] || ''),
        agent: String(block[b][col.AGENT] || ''), lapsed: /laps/i.test(status),
      });
      if (out.length >= 60) return out;
    }
  }
  return out;
}

function findByClientNo_(clientNo) {
  var rows = readTable_(ensureReassignSheet_()), out = null;
  rows.forEach(function (r, i) {
    if (String(r[R.CLIENT_NO]).trim() === String(clientNo).trim()) out = { row: r, index: i };
  });
  return out;
}

/* ============ STEP 2 — THE INVITATION ============ */

/**
 * Sends the invitation to every queued client who has an email and has not
 * been invited yet. Returns how many went out.
 */
function sendInvitations(limit) {
  var sh = ensureReassignSheet_();
  var rows = readTable_(sh);

  // Gmail caps daily sends (≈100 on a personal account, ≈1,500 on Workspace).
  // A 20,000-policy book can orphan more clients than one day allows, so stop
  // cleanly with a reserve left rather than dying half-way through a send.
  var quota = MailApp.getRemainingDailyQuota();
  var room = Math.max(0, quota - 20);              // keep 20 back for alerts
  var cap = Math.min(limit || CONFIG.MAX_INVITES_PER_RUN, room);
  if (cap <= 0) {
    var msg = 'Daily email quota exhausted (' + quota + ' left). Nothing sent — ' +
              'run this again tomorrow and it will pick up exactly where it stopped.';
    Logger.log(msg); log_('INVITE', '', '', msg);
    return { sent: 0, remaining: 0, quota: quota, note: msg };
  }

  var sent = 0, pending = 0, t0 = new Date().getTime();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r[R.INVITED] || !isEmail_(r[R.EMAIL])) continue;
    pending++;
    if (sent >= cap) continue;                     // count the rest, send none
    if (new Date().getTime() - t0 > 300000) break; // 5 min — stay under the limit
    sendInvitation_(r);
    setCell_(sh, i, R.INVITED, new Date());
    setCell_(sh, i, R.STATUS, 'Invited — awaiting reply');
    sent++;
    Utilities.sleep(300);
  }

  var left = Math.max(0, pending - sent);
  var summary = 'Sent ' + sent + ' invitation(s); ' + left + ' still waiting; ' +
                MailApp.getRemainingDailyQuota() + ' emails left in today\'s quota';
  log_('INVITE', '', '', summary);
  Logger.log(summary);
  return { sent: sent, remaining: left, quota: MailApp.getRemainingDailyQuota() };
}

/** Send (or re-send) the invitation for one client number. */
function sendInvitationTo(clientNo) {
  var sh = ensureReassignSheet_(), rows = readTable_(sh);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][R.CLIENT_NO]).trim() === String(clientNo).trim()) {
      sendInvitation_(rows[i]);
      setCell_(sh, i, R.INVITED, new Date());
      setCell_(sh, i, R.STATUS, 'Invited — awaiting reply');
      return true;
    }
  }
  return false;
}

function sendInvitation_(r) {
  var first = firstName_(r[R.CLIENT]);
  var pols = policiesFor_(r[R.CLIENT_NO], r);
  var link = r[R.LINK] || (CONFIG.PORTAL_BASE + r[R.TOKEN]);

  var body =
    p_('Dear ' + esc_(first) + ',') +
    p_('My name is <b>' + esc_(CONFIG.MANAGER_NAME) + '</b> and I am the ' +
       esc_(CONFIG.MANAGER_TITLE) + ' of the ' + esc_(CONFIG.BRANCH_NAME) + ' in ' +
       esc_(CONFIG.BRANCH_AREA) + '. I have spent ' + CONFIG.MANAGER_YEARS +
       ' years in this industry, and in that time I have learned that a policy is only ' +
       'as good as the person standing behind it.') +
    p_('I am writing to you personally because of something our records turned up, and ' +
       'I would rather you hear it from me than discover it at claim time:') +
    calloutBox_('The agent who was servicing your policy is no longer active with us. ' +
                'That means that, right now, no one has been formally looking after your file.') +
    p_('You have done nothing wrong, and <b>your cover has not been affected in any way</b>. ' +
       'But you have been paying premiums without the service that is supposed to come ' +
       'with them, and I am not comfortable leaving it that way.') +
    (pols.length ? p_('<b>What we currently have on file for you:</b>') + policyTable_(pols) : '') +
    p_('So that we place the right person with you — rather than simply assigning a name — ' +
       'I would be grateful if you would take about <b>ninety seconds</b> to answer a few ' +
       'short questions. It tells us how you would like to be looked after, and what your ' +
       'previous agent did (or did not) do for you.') +
    button_(link, 'Review my portfolio & tell us what you need') +
    p_('Here is my commitment to you: an agent will be appointed within <b>' +
       CONFIG.APPOINT_BY_DAYS + ' days</b> of your reply, and that agent will contact you ' +
       'within <b>one working day</b> of being appointed. You will get their name, their ' +
       'photograph and their speciality before they ever call you.') +
    p_('If you would prefer to speak to me directly, my line is ' +
       esc_(CONFIG.MANAGER_PHONE) + ' and I answer it myself.') +
    signature_();

  send_(r[R.EMAIL], 'A personal note about your Guardian policy — from ' + CONFIG.MANAGER_NAME,
        emailShell_('Your policy no longer has an active agent', body),
        { name: CONFIG.MANAGER_NAME, replyTo: CONFIG.MANAGER_EMAIL });
  log_('INVITE', r[R.CLIENT_NO], r[R.CLIENT], 'Invitation sent to ' + r[R.EMAIL]);
}

/* ============ STEP 3 — THE WEB APP (portal API) ============ */

function doGet(e) {
  var q = (e && e.parameter) || {};
  try {
    if (q.action === 'agentLogin')  return json_(agentLogin_(q.code));
    if (q.action === 'agentBoard')  return json_(agentBoard_(q.code));
    if (q.action === 'managerBoard')return json_(managerBoard_(q.code));
    return json_(clientView_(q.token || q.t));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/** Everything the client portal shows for one token. */
function clientView_(token) {
  if (!token) return { ok: false, error: 'No access code supplied.' };
  var found = findByToken_(token);
  if (!found) return { ok: false, error: 'We could not find that link. Please use the link in your email, or call ' + CONFIG.MANAGER_PHONE + '.' };
  var r = found.row;
  var appointed = String(r[R.APPOINTED] || '').trim();
  return {
    ok: true,
    client: { name: r[R.CLIENT], clientNo: r[R.CLIENT_NO], email: r[R.EMAIL], phone: r[R.PHONE] },
    formerAgent: r[R.FORMER],
    policies: policiesFor_(r[R.CLIENT_NO], r),
    totals: { policies: num_(r[R.POLICIES]), premium: num_(r[R.PREMIUM]), cover: num_(r[R.COVER]) },
    responded: !!r[R.RESPONDED],
    preference: r[R.PREFERENCE] || '',
    appointedAgent: appointed ? agentProfile_(appointed) : null,
    timeline: timeline_(r),
    manager: {
      name: CONFIG.MANAGER_NAME, title: CONFIG.MANAGER_TITLE,
      phone: CONFIG.MANAGER_PHONE, email: CONFIG.MANAGER_EMAIL,
      years: CONFIG.MANAGER_YEARS, branch: CONFIG.BRANCH_NAME,
    },
    promise: { appointDays: CONFIG.APPOINT_BY_DAYS, contactDays: CONFIG.AGENT_CONTACT_DAYS },
  };
}

/** The four-step progress tracker the client sees. */
function timeline_(r) {
  var appointed = String(r[R.APPOINTED] || '').trim();
  return [
    { key: 'invited',   label: 'We contacted you',        done: !!r[R.INVITED],
      at: dateStr_(r[R.INVITED]) },
    { key: 'responded', label: 'You told us what you need', done: !!r[R.RESPONDED],
      at: dateStr_(r[R.RESPONDED]) },
    { key: 'appointed', label: 'Your agent is appointed',  done: !!appointed,
      at: dateStr_(r[R.APPOINTED_AT]), detail: appointed },
    { key: 'contacted', label: 'Your agent has contacted you', done: !!r[R.AGENT_CONTACT],
      at: dateStr_(r[R.AGENT_CONTACT]) },
  ];
}

function doPost(e) {
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (p.action === 'agentReport')  return json_(saveAgentReport_(p));
    if (p.action === 'appoint')      return json_(appointFromDashboard_(p));
    if (p.action === 'invite')       return json_({ ok: sendInvitationTo(p.clientNo) });
    if (p.action === 'rebuild')      return json_(requireManager_(p.code) && buildReassignQueue());
    return json_(saveClientResponse_(p));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ============ STEP 4 — THE CLIENT REPLIES ============ */

function saveClientResponse_(p) {
  var found = findByToken_(p.token);
  if (!found) return { ok: false, error: 'That link is no longer valid.' };
  var sh = ensureReassignSheet_(), r = found.row, i = found.index;

  // 1. Log the raw answers.
  ensureResponsesSheet_().appendRow([
    new Date(), r[R.CLIENT_NO], r[R.CLIENT], r[R.EMAIL], r[R.FORMER],
    p.preference || '', arr_(p.pastService), arr_(p.priorities), p.confidence || '',
    p.contactMethod || '', p.contactTime || '', p.notes || '', p.consent ? 'Yes' : 'No',
  ]);

  // 2. Move the queue row on.
  setCell_(sh, i, R.RESPONDED, new Date());
  setCell_(sh, i, R.PREFERENCE, p.preference || '');
  setCell_(sh, i, R.STATUS, 'Responded — ' + (p.preference || 'no preference given'));

  // 3. Thank the client and recap everything they told us.
  sendClientRecap_(r, p);
  // 4. Hand the intelligence to Sales Support.
  sendSupportBrief_(r, p);

  log_('RESPONSE', r[R.CLIENT_NO], r[R.CLIENT], 'Client replied: ' + (p.preference || '—'));
  return { ok: true, preference: p.preference || '', timeline: timeline_(readTable_(sh)[i]) };
}

function sendClientRecap_(r, p) {
  if (!isEmail_(r[R.EMAIL])) return;
  var first = firstName_(r[R.CLIENT]);
  var inHouse = /in-house|branch service/i.test(p.preference || '');

  var body =
    p_('Dear ' + esc_(first) + ',') +
    p_('Thank you — that is genuinely helpful, and it means the next person who speaks to ' +
       'you will already understand your situation instead of starting from zero.') +
    p_('<b>Here is exactly what you told us:</b>') +
    statTable_([
      ['How you would like to be looked after', p.preference || '—'],
      ['What your previous agent did for you', arr_(p.pastService) || '—'],
      ['What matters to you now', arr_(p.priorities) || '—'],
      ['How you feel about your cover today', confidenceLabel_(p.confidence)],
      ['Best way to reach you', (p.contactMethod || '—') + (p.contactTime ? ' · ' + p.contactTime : '')],
    ]) +
    (p.notes ? p_('<b>And in your own words:</b>') + quote_(p.notes) : '') +
    p_('<b>What happens next.</b> ' + (inHouse
        ? 'You have asked us to handle your policy in-house. Our Branch Service Desk will ' +
          'take direct ownership of your file, and I will personally oversee it.'
        : 'We will match you with an agent whose speciality fits what you have just told us — ' +
          'not simply whoever is next on a list.')) +
    numberedSteps_([
      'Within ' + CONFIG.APPOINT_BY_DAYS + ' days you will receive an email naming the person ' +
        'appointed to you, with their photograph, their speciality and their direct contact details.',
      'That person will contact you within one working day of being appointed.',
      'You can check the progress of all of this at any time using your private link below.',
    ]) +
    button_(r[R.LINK] || (CONFIG.PORTAL_BASE + r[R.TOKEN]), 'Track my progress') +
    p_('If anything changes in the meantime, reply to this email or call me on ' +
       esc_(CONFIG.MANAGER_PHONE) + '.') +
    signature_();

  send_(r[R.EMAIL], 'Thank you — here is what you told us, ' + first,
        emailShell_('We have got everything, thank you', body),
        { name: CONFIG.MANAGER_NAME, replyTo: CONFIG.MANAGER_EMAIL });
}

/** The internal brief — answers plus a read on the client. */
function sendSupportBrief_(r, p) {
  var to = CONFIG.SALES_SUPPORT_EMAIL || CONFIG.MANAGER_EMAIL;
  var read = psychRead_(p, r);
  var pols = policiesFor_(r[R.CLIENT_NO], r);

  var body =
    p_('<b>' + esc_(r[R.CLIENT]) + '</b> (client ' + esc_(r[R.CLIENT_NO]) + ') has replied to the ' +
       'inactive-agent outreach. This file needs an agent appointed within ' +
       CONFIG.APPOINT_BY_DAYS + ' days.') +
    calloutBox_('<b>Read on this client:</b> ' + read.summary +
                '<br/><b>Priority:</b> ' + read.priority + ' &nbsp;·&nbsp; <b>Churn risk:</b> ' + read.risk +
                '<br/><b>Suggested speciality:</b> ' + read.speciality) +
    p_('<b>Their answers</b>') +
    statTable_([
      ['Preference', p.preference || '—'],
      ['Former agent', r[R.FORMER] || '—'],
      ['What the former agent did', arr_(p.pastService) || '—'],
      ['Priorities now', arr_(p.priorities) || '—'],
      ['Confidence in cover', confidenceLabel_(p.confidence)],
      ['Contact preference', (p.contactMethod || '—') + (p.contactTime ? ' · ' + p.contactTime : '')],
      ['Email', r[R.EMAIL] || '—'],
      ['Phone', r[R.PHONE] || '—'],
    ]) +
    (p.notes ? p_('<b>Client\'s own words</b>') + quote_(p.notes) : '') +
    p_('<b>Portfolio on file</b> — ' + pols.length + ' policies, TT$' +
       money_(num_(r[R.PREMIUM])) + ' annual premium, TT$' + money_(num_(r[R.COVER])) + ' sum assured') +
    policyTable_(pols) +
    p_('<b>Action required:</b> write the appointed agent\'s name into the <i>Appointed Agent</i> ' +
       'column on the Reassign tab. The client and the agent are notified automatically the ' +
       'moment you do.') +
    button_(CONFIG.AGENT_PORTAL, 'Open the branch dashboard');

  send_(to, '[ACTION] ' + r[R.CLIENT] + ' needs an agent — ' + read.priority,
        emailShell_('New reassignment response', body),
        { cc: CONFIG.MANAGER_EMAIL, name: CONFIG.BRANCH_NAME });
}

/**
 * Turns the answers into something a human can act on. This is the part
 * that makes the difference between a form and actual intelligence.
 */
function psychRead_(p, r) {
  var past = (arr_(p.pastService) || '').toLowerCase();
  var pri  = (arr_(p.priorities) || '').toLowerCase();
  var conf = parseInt(p.confidence, 10) || 0;
  var pref = String(p.preference || '').toLowerCase();
  var premium = num_(r[R.PREMIUM]);

  var neglected = /never heard|only contacted me when|not sure who/.test(past);
  var served    = /reviewed my policy|helped me at claim/.test(past);
  var signals = [];

  if (neglected) signals.push('was effectively unserviced by the previous agent');
  if (served)    signals.push('had a real relationship before and will expect that standard again');
  if (conf && conf <= 2) signals.push('is not confident in their cover right now');
  if (conf >= 4) signals.push('feels good about their cover — this is a retention and growth call, not a rescue');
  if (/reducing|managing what i pay/.test(pri)) signals.push('is price-sensitive — lead with value, not upsell');
  if (/increasing|family is properly covered/.test(pri)) signals.push('is open to additional cover');
  if (/claim/.test(pri)) signals.push('has claims on their mind — handle with care');
  if (/beneficiar/.test(pri)) signals.push('needs a beneficiary update — quick, concrete first win');

  var risk = (neglected && conf <= 2) ? 'HIGH' : (neglected || conf <= 2) ? 'MEDIUM' : 'LOW';
  var priority = (risk === 'HIGH' || premium > 5000) ? 'URGENT — call first' : 'Standard';

  var speciality = /retirement|saving/.test(pri) ? 'Retirement & investment planning'
    : /family is properly covered|increasing/.test(pri) ? 'Life & family protection'
    : /claim/.test(pri) ? 'Claims-experienced servicing agent'
    : /reducing|managing/.test(pri) ? 'Policy review & premium restructuring'
    : /health/.test(pri) ? 'Health & critical illness'
    : 'General servicing & annual review';

  if (/in-house|branch service/.test(pref)) speciality = 'Branch Service Desk (client asked for in-house handling)';

  return {
    summary: signals.length ? 'This client ' + signals.join('; ') + '.'
                            : 'No strong signals — treat as a standard servicing reconnection.',
    risk: risk, priority: priority, speciality: speciality,
  };
}

/* ============ STEP 5 — APPOINTING THE AGENT ============ */

/**
 * Fires when anyone types into the "Appointed Agent" column on the
 * Reassign tab. That single edit sends both notification emails.
 */
function onAppointmentEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== CONFIG.REASSIGN_SHEET) return;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var col = headers.indexOf(R.APPOINTED) + 1;
    if (col === 0 || e.range.getColumn() !== col) return;
    var name = String(e.range.getValue() || '').trim();
    if (!name) return;
    var i = e.range.getRow() - 2;                 // 0-based data index
    if (i < 0) return;
    if (readTable_(sh)[i][R.AGENT_NOTIFIED]) return;   // already told them
    notifyAppointment_(i, name);
  } catch (err) {
    log_('ERROR', '', '', 'onAppointmentEdit: ' + err);
  }
}

/** Appoint from the manager dashboard (same effect as editing the sheet). */
function appointFromDashboard_(p) {
  requireManager_(p.code);
  var sh = ensureReassignSheet_(), rows = readTable_(sh);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][R.CLIENT_NO]).trim() === String(p.clientNo).trim()) {
      setCell_(sh, i, R.APPOINTED, p.agent);
      notifyAppointment_(i, p.agent);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Client not found in the queue.' };
}

/** Tells the client who they got, and briefs the agent. Agent is CC'd on both. */
function notifyAppointment_(i, agentName) {
  var sh = ensureReassignSheet_();
  var r = readTable_(sh)[i];
  var prof = agentProfile_(agentName);

  setCell_(sh, i, R.APPOINTED_AT, new Date());
  setCell_(sh, i, R.STATUS, 'Agent appointed — ' + agentName);

  sendAppointmentToClient_(r, prof);
  sendBriefToAgent_(r, prof);

  setCell_(sh, i, R.AGENT_NOTIFIED, new Date());
  log_('APPOINT', r[R.CLIENT_NO], r[R.CLIENT], 'Appointed ' + agentName +
       ' (' + (prof.email || 'no email on file') + ')');
}

function sendAppointmentToClient_(r, prof) {
  if (!isEmail_(r[R.EMAIL])) return;
  var first = firstName_(r[R.CLIENT]);
  var body =
    p_('Dear ' + esc_(first) + ',') +
    p_('Thank you again for taking the time to tell us what you needed. I promised you an ' +
       'agent within ' + CONFIG.APPOINT_BY_DAYS + ' days, and I am pleased to introduce them.') +
    agentCard_(prof) +
    p_('<b>' + esc_(prof.name) + '</b> will contact you within <b>one working day</b>. They ' +
       'have already been given everything you told us, so you will not have to repeat ' +
       'yourself — they know what your previous agent did, what matters to you now, and ' +
       'how you prefer to be contacted.') +
    p_('They are copied on this email, so you can simply reply here and reach us both.') +
    button_(r[R.LINK] || (CONFIG.PORTAL_BASE + r[R.TOKEN]), 'View my portfolio & progress') +
    p_('If for any reason ' + esc_(firstName_(prof.name)) + ' has not been in touch within one ' +
       'working day, I want to know about it. Call me directly on ' +
       esc_(CONFIG.MANAGER_PHONE) + ' — that is a personal commitment, not a call centre.') +
    signature_();

  send_(r[R.EMAIL], first + ', meet your new agent — ' + prof.name,
        emailShell_('Your agent has been appointed', body),
        { cc: prof.email || '', name: CONFIG.MANAGER_NAME, replyTo: CONFIG.MANAGER_EMAIL });
}

function sendBriefToAgent_(r, prof) {
  if (!isEmail_(prof.email)) {
    log_('WARN', r[R.CLIENT_NO], r[R.CLIENT], 'No email on file for agent ' + prof.name);
    return;
  }
  var resp = lastResponse_(r[R.CLIENT_NO]) || {};
  var read = psychRead_(resp, r);
  var pols = policiesFor_(r[R.CLIENT_NO], r);

  var body =
    p_('Hello ' + esc_(firstName_(prof.name)) + ',') +
    p_('You have been appointed to <b>' + esc_(r[R.CLIENT]) + '</b>. This client was orphaned ' +
       'when ' + esc_(r[R.FORMER] || 'their previous agent') + ' left, and they have just told ' +
       'us what they need. <b>They are expecting your call within one working day.</b>') +
    calloutBox_('<b>Read on this client:</b> ' + read.summary +
                '<br/><b>Churn risk:</b> ' + read.risk + ' &nbsp;·&nbsp; <b>Priority:</b> ' + read.priority) +
    p_('<b>What they told us</b>') +
    statTable_([
      ['Wants', resp.preference || 'Not stated'],
      ['Previous agent did', arr_(resp.pastService) || 'Not stated'],
      ['Priorities now', arr_(resp.priorities) || 'Not stated'],
      ['Confidence in cover', confidenceLabel_(resp.confidence)],
      ['Contact by', (resp.contactMethod || 'Not stated') +
         (resp.contactTime ? ' · ' + resp.contactTime : '')],
      ['Phone', r[R.PHONE] || '—'],
      ['Email', r[R.EMAIL] || '—'],
    ]) +
    (resp.notes ? p_('<b>In their own words</b>') + quote_(resp.notes) : '') +
    p_('<b>Their portfolio</b>') + policyTable_(pols) +
    p_('<b>What I need back from you.</b> After you have spoken to them, file a first-contact ' +
       'report on the dashboard — what happened, what they want, and what you are recommending. ' +
       'I review these personally.') +
    button_(CONFIG.AGENT_PORTAL, 'File my first-contact report') +
    p_('The client has been introduced to you by name and knows to expect you. Please do not ' +
       'let that promise slip — it is the whole point of this exercise.') +
    signature_();

  send_(prof.email, '[APPOINTED] ' + r[R.CLIENT] + ' — contact within 1 working day',
        emailShell_('You have a new client', body),
        { cc: CONFIG.MANAGER_EMAIL, name: CONFIG.BRANCH_NAME, replyTo: CONFIG.MANAGER_EMAIL });
}

/* ============ STEP 6 — THE AGENT REPORTS BACK ============ */

function saveAgentReport_(p) {
  var who = agentByCode_(p.code);
  if (!who) return { ok: false, error: 'Not signed in.' };
  var sh = ensureReassignSheet_(), rows = readTable_(sh);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][R.CLIENT_NO]).trim() !== String(p.clientNo).trim()) continue;
    var summary = [p.outcome, p.notes].filter(String).join(' — ');
    setCell_(sh, i, R.AGENT_CONTACT, new Date());
    setCell_(sh, i, R.AGENT_UPDATE, summary);
    setCell_(sh, i, R.STATUS, 'Agent contacted client — ' + (p.outcome || 'reported'));
    if (p.closed) setCell_(sh, i, R.CLOSED, new Date());

    var body =
      p_('<b>' + esc_(who.name) + '</b> has filed a first-contact report for <b>' +
         esc_(rows[i][R.CLIENT]) + '</b> (client ' + esc_(rows[i][R.CLIENT_NO]) + ').') +
      statTable_([
        ['Outcome', p.outcome || '—'],
        ['Client intention', p.intention || '—'],
        ['Follow-up date', p.followUp || '—'],
        ['Agent notes', p.notes || '—'],
        ['File closed?', p.closed ? 'Yes' : 'No — still in progress'],
      ]);
    send_(CONFIG.MANAGER_EMAIL, '[REPORT] ' + rows[i][R.CLIENT] + ' — ' + (p.outcome || 'contacted'),
          emailShell_('First-contact report', body), { name: CONFIG.BRANCH_NAME });
    log_('AGENT-REPORT', rows[i][R.CLIENT_NO], rows[i][R.CLIENT], who.name + ': ' + summary);
    return { ok: true };
  }
  return { ok: false, error: 'Client not found.' };
}

/* ============ STEP 7 — THE DAILY CADENCE ============ */

/**
 * Runs every morning. Keeps every promise the programme has made:
 *  · chases the manager when a responded client still has no agent at day 3
 *  · chases the agent who has not made contact within a working day
 *  · escalates to the manager when the agent still has not moved
 */
function dailyCadence() {
  var sh = ensureReassignSheet_(), rows = readTable_(sh);
  var now = new Date(), unassigned = [], lateAgents = [];

  rows.forEach(function (r, i) {
    if (r[R.CLOSED]) return;
    var appointed = String(r[R.APPOINTED] || '').trim();

    if (r[R.RESPONDED] && !appointed &&
        daysBetween_(r[R.RESPONDED], now) >= CONFIG.APPOINT_BY_DAYS) {
      unassigned.push(r);
    }
    if (appointed && r[R.AGENT_NOTIFIED] && !r[R.AGENT_CONTACT]) {
      var d = daysBetween_(r[R.AGENT_NOTIFIED], now);
      if (d >= CONFIG.AGENT_CONTACT_DAYS) lateAgents.push({ row: r, days: d, index: i });
    }
  });

  if (unassigned.length) {
    var b = p_('<b>' + unassigned.length + ' client(s)</b> replied ' + CONFIG.APPOINT_BY_DAYS +
               '+ days ago and still have no agent appointed. We promised them ' +
               CONFIG.APPOINT_BY_DAYS + ' days.') +
      listTable_(unassigned.map(function (r) {
        return [r[R.CLIENT], r[R.PREFERENCE] || '—', dateStr_(r[R.RESPONDED])];
      }), ['Client', 'Wants', 'Replied']) +
      button_(CONFIG.AGENT_PORTAL, 'Appoint agents now');
    send_(CONFIG.MANAGER_EMAIL, '[OVERDUE] ' + unassigned.length + ' client(s) still without an agent',
          emailShell_('Appointments overdue', b), { name: CONFIG.BRANCH_NAME });
  }

  lateAgents.forEach(function (x) {
    var r = x.row, prof = agentProfile_(String(r[R.APPOINTED]).trim());
    if (x.days >= CONFIG.AGENT_CHASE_DAYS) {
      send_(CONFIG.MANAGER_EMAIL, '[ESCALATION] ' + prof.name + ' has not contacted ' + r[R.CLIENT],
            emailShell_('Escalation — no contact after ' + x.days + ' days',
              p_('<b>' + esc_(prof.name) + '</b> was appointed to <b>' + esc_(r[R.CLIENT]) +
                 '</b> ' + x.days + ' days ago and has not filed a first-contact report. ' +
                 'The client was promised contact within one working day.')),
            { name: CONFIG.BRANCH_NAME });
    } else if (isEmail_(prof.email)) {
      send_(prof.email, 'Reminder — ' + r[R.CLIENT] + ' is expecting your call',
            emailShell_('Your new client is waiting',
              p_('Hello ' + esc_(firstName_(prof.name)) + ', a quick reminder that <b>' +
                 esc_(r[R.CLIENT]) + '</b> was appointed to you and we promised them contact ' +
                 'within one working day. Please call them today and file your report.') +
              button_(CONFIG.AGENT_PORTAL, 'File my report')),
            { cc: CONFIG.MANAGER_EMAIL, name: CONFIG.BRANCH_NAME });
    }
  });

  if (CONFIG.AUTO_INVITE) sendInvitations(40);
  log_('CADENCE', '', '', unassigned.length + ' unassigned, ' + lateAgents.length + ' late agents');
}

/* ============ AGENT / MANAGER SIGN-IN ============ */

function agentLogin_(code) {
  var who = agentByCode_(code);
  if (!who) return { ok: false, error: 'That access code was not recognised.' };
  return { ok: true, name: who.name, role: who.role, email: who.email,
           isManager: isManagerRole_(who.role) };
}

function agentBoard_(code) {
  var who = agentByCode_(code);
  if (!who) return { ok: false, error: 'Not signed in.' };
  var mine = [];
  readTable_(ensureReassignSheet_()).forEach(function (r) {
    if (nameKey_(r[R.APPOINTED]) !== nameKey_(who.name)) return;
    mine.push(clientCard_(r, true));
  });
  return { ok: true, name: who.name, role: who.role, isManager: isManagerRole_(who.role),
           clients: mine };
}

/**
 * The manager pipeline. The funnel is counted across EVERY row, but only the
 * rows that need a decision are sent to the browser — a 20,000-policy book can
 * orphan thousands of clients, and shipping all of them would stall the page.
 * Clients needing attention (replied, or appointed but not yet contacted) come
 * first; the payload is capped and the page is told what was left out.
 */
function managerBoard_(code) {
  var who = agentByCode_(code);
  if (!who || !isManagerRole_(who.role)) return { ok: false, error: 'Manager access only.' };
  var rows = readTable_(ensureReassignSheet_());
  var funnel = { queued: 0, invited: 0, responded: 0, appointed: 0, contacted: 0, closed: 0 };

  var urgent = [], rest = [];
  rows.forEach(function (r) {
    var appointed = String(r[R.APPOINTED] || '').trim();
    if (r[R.CLOSED]) { funnel.closed++; rest.push(r); }
    else if (r[R.AGENT_CONTACT]) { funnel.contacted++; rest.push(r); }
    else if (appointed) { funnel.appointed++; urgent.push(r); }
    else if (r[R.RESPONDED]) { funnel.responded++; urgent.unshift(r); }   // needs an agent now
    else if (r[R.INVITED]) { funnel.invited++; rest.push(r); }
    else { funnel.queued++; rest.push(r); }
  });

  var CAP = 250;
  var shown = urgent.concat(rest).slice(0, CAP);
  return {
    ok: true, name: who.name, isManager: true, funnel: funnel,
    clients: shown.map(function (r) { return clientCard_(r, false); }),
    total: rows.length,
    truncated: Math.max(0, rows.length - shown.length),
    agents: activeRoster_().map(function (a) {
      return { name: a.name, role: a.role, email: a.email };
    }),
  };
}

function clientCard_(r, withAnswers) {
  var card = {
    clientNo: r[R.CLIENT_NO], client: r[R.CLIENT], formerAgent: r[R.FORMER],
    email: r[R.EMAIL], phone: r[R.PHONE], policies: num_(r[R.POLICIES]),
    premium: num_(r[R.PREMIUM]), cover: num_(r[R.COVER]), status: r[R.STATUS],
    preference: r[R.PREFERENCE], appointed: r[R.APPOINTED],
    invited: dateStr_(r[R.INVITED]), responded: dateStr_(r[R.RESPONDED]),
    appointedAt: dateStr_(r[R.APPOINTED_AT]), contactedAt: dateStr_(r[R.AGENT_CONTACT]),
    update: r[R.AGENT_UPDATE], closed: !!r[R.CLOSED],
  };
  if (withAnswers) {
    var resp = lastResponse_(r[R.CLIENT_NO]);
    if (resp) {
      card.answers = resp;
      card.read = psychRead_(resp, r);
      card.policyList = policiesFor_(r[R.CLIENT_NO], r);
    }
  }
  return card;
}

/**
 * Minimum access-code length. The Users tab currently holds sequential
 * numbers (1, 2, 3 …) as passwords — those are trivially guessable, and this
 * dashboard exposes client names, phone numbers and premiums. Codes shorter
 * than this are refused outright. Run rotateAccessCodes() to fix the roster.
 */
var MIN_CODE_LENGTH = 8;

function agentByCode_(code) {
  code = String(code || '').trim();
  if (code.length < MIN_CODE_LENGTH) return null;   // refuse weak/guessable codes
  var found = null;
  activeRoster_().forEach(function (a) {
    if (a.code && String(a.code).trim().length >= MIN_CODE_LENGTH &&
        String(a.code).trim() === code) found = a;
  });
  return found;
}

/**
 * ONE-TIME SECURITY STEP — replaces every weak password on the Users tab with
 * a strong random access code, and emails each person their own new code.
 * Codes that are already strong are left alone. Run this before you let
 * anyone sign in to the dashboard.
 */
function rotateAccessCodes() {
  var sh = ss_().getSheetByName(CONFIG.USERS_SHEET);
  if (!sh) throw new Error('No "' + CONFIG.USERS_SHEET + '" tab found.');
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var pwCol = headers.indexOf('Password') + 1;
  if (!pwCol) throw new Error('No "Password" column on the Users tab.');

  var rows = readTable_(sh), changed = 0;
  rows.forEach(function (u, i) {
    var current = String(u['Password'] || '').trim();
    if (current.length >= MIN_CODE_LENGTH) return;          // already strong
    var email = String(u['Email'] || '').trim();
    var name = String(u['Name'] || '').replace(/^A\d+\s*-\s*/, '').trim();
    var code = strongCode_();
    sh.getRange(i + 2, pwCol).setValue(code);
    changed++;
    if (isEmail_(email)) {
      send_(email, 'Your new branch dashboard access code',
        emailShell_('Your access code has changed',
          p_('Hello ' + esc(firstName_(name)) + ',') +
          p_('The branch dashboard now holds client contact details, so the old numeric ' +
             'sign-in codes have been replaced with proper ones. Yours is below.') +
          statTable_([['Your access code', code]]) +
          p_('Please keep it private — it opens client information. If you think anyone ' +
             'else has it, tell me and I will reset it immediately.') +
          button_(CONFIG.AGENT_PORTAL, 'Open the dashboard') +
          signature_()),
        { name: CONFIG.BRANCH_NAME, replyTo: CONFIG.MANAGER_EMAIL });
    }
  });
  Logger.log('Rotated ' + changed + ' weak access code(s) out of ' + rows.length + ' users.');
  log_('SECURITY', '', '', 'Rotated ' + changed + ' weak access codes');
  return changed;
}

function strongCode_() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no look-alike characters
  var bytes = Utilities.getUuid().replace(/-/g, '');
  var out = '';
  for (var i = 0; i < 10; i++) {
    out += alphabet.charAt(parseInt(bytes.substr(i * 2, 2), 16) % alphabet.length);
  }
  return out;
}
function isManagerRole_(role) { return /manager/i.test(String(role || '')); }
function requireManager_(code) {
  var w = agentByCode_(code);
  if (!w || !isManagerRole_(w.role)) throw new Error('Manager access only.');
  return true;
}

/* ============ AGENT PROFILES ============ */

function ensureProfilesSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(CONFIG.PROFILES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.PROFILES_SHEET);
    sh.appendRow(['Agent Name', 'Email', 'Role', 'Speciality', 'Short Profile',
                  'Years of Service', 'Photo URL', 'Direct Line']);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Puts every active agent into the profiles tab so Ricky only has to edit text. */
function seedAgentProfiles_() {
  var sh = ensureProfilesSheet_();
  var have = {};
  readTable_(sh).forEach(function (r) { have[nameKey_(r['Agent Name'])] = true; });
  var add = [];
  activeRoster_().forEach(function (a) {
    if (have[a.key]) return;
    add.push([a.name, a.email, a.role,
      defaultSpeciality_(a.role),
      a.name + ' is part of the ' + CONFIG.BRANCH_NAME + ' team, based in ' +
        CONFIG.BRANCH_AREA + '.', '', '', '']);
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
  return add.length;
}

function defaultSpeciality_(role) {
  if (/branch manager/i.test(role)) return 'Portfolio reviews & complex cases';
  if (/unit manager/i.test(role))   return 'Family protection & team servicing';
  if (/staff/i.test(role))          return 'Branch service desk & policy administration';
  return 'Life, health & retirement planning';
}

function agentProfile_(name) {
  var key = nameKey_(name), out = null;
  readTable_(ensureProfilesSheet_()).forEach(function (r) {
    if (nameKey_(r['Agent Name']) === key) {
      out = { name: r['Agent Name'], email: r['Email'], role: r['Role'],
              speciality: r['Speciality'], profile: r['Short Profile'],
              years: r['Years of Service'], photo: r['Photo URL'], phone: r['Direct Line'] };
    }
  });
  if (out) return out;
  var roster = null;
  activeRoster_().forEach(function (a) { if (a.key === key) roster = a; });
  return { name: roster ? roster.name : String(name || '').trim(),
           email: roster ? roster.email : '', role: roster ? roster.role : '',
           speciality: defaultSpeciality_(roster ? roster.role : ''),
           profile: '', years: '', photo: '', phone: '' };
}

/* ============ SHEET PLUMBING ============ */

function ss_() { return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }

/**
 * Finds the portfolio tab.
 *
 * Prefers the tab named in CONFIG. Falling back to auto-detection, it picks the
 * LARGEST matching tab, not the first — this workbook has several tabs carrying
 * the same headers, and landing on a small working copy would silently analyse
 * a fraction of the book and report it as the whole thing.
 */
function portfolioSheet_() {
  var ss = ss_();
  if (CONFIG.PORTFOLIO_SHEET) {
    var named = ss.getSheetByName(CONFIG.PORTFOLIO_SHEET);
    if (named) return named;
    Logger.log('⚠ No tab named "' + CONFIG.PORTFOLIO_SHEET + '" — falling back to the ' +
               'largest tab with portfolio headers. Run listTabs() to see the real names.');
  }
  var sheets = ss.getSheets(), best = null;
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getLastRow() < 2) continue;
    var h = sheets[i].getRange(1, 1, 1, sheets[i].getLastColumn()).getValues()[0]
      .map(function (x) { return String(x).trim(); });
    if (h.indexOf(P.AGENT) !== -1 && h.indexOf(P.CLIENT_NO) !== -1 && h.indexOf(P.CLIENT) !== -1) {
      if (!best || sheets[i].getLastRow() > best.getLastRow()) best = sheets[i];
    }
  }
  if (best) return best;
  throw new Error('Could not find the portfolio tab (needs "Agent", "Client Number" and ' +
                  '"Client" headers). Run listTabs() and set CONFIG.PORTFOLIO_SHEET.');
}

/** Diagnostic: prints every tab, its size, and whether it looks like the portfolio. */
function listTabs() {
  var sheets = ss_().getSheets();
  Logger.log('Tabs in "' + ss_().getName() + '":');
  sheets.forEach(function (s) {
    var h = s.getLastColumn()
      ? s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]
          .map(function (x) { return String(x).trim(); })
      : [];
    var isPortfolio = h.indexOf(P.AGENT) !== -1 && h.indexOf(P.CLIENT_NO) !== -1;
    Logger.log('  ' + (isPortfolio ? '★ ' : '  ') + '"' + s.getName() + '" — ' +
               (s.getLastRow() - 1) + ' data rows, ' + s.getLastColumn() + ' columns' +
               (isPortfolio ? '   ← portfolio headers' : ''));
  });
  Logger.log('★ = a tab the detector would accept. CONFIG.PORTFOLIO_SHEET is currently "' +
             (CONFIG.PORTFOLIO_SHEET || '(auto-detect)') + '".');
}

function ensureReassignSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(CONFIG.REASSIGN_SHEET);
  var COLS = [R.CLIENT_NO, R.CLIENT, R.FORMER, R.EMAIL, R.PHONE, R.POLICIES, R.PREMIUM,
    R.COVER, R.TOKEN, R.LINK, R.STATUS, R.INVITED, R.RESPONDED, R.PREFERENCE,
    R.APPOINTED, R.APPOINTED_AT, R.AGENT_NOTIFIED, R.AGENT_CONTACT, R.AGENT_UPDATE,
    R.CLOSED, R.POLICIES_JSON];
  if (!sh) {
    sh = ss.insertSheet(CONFIG.REASSIGN_SHEET);
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold')
      .setBackground('#0E2A47').setFontColor('#ffffff');
    sh.setColumnWidth(15, 190);
    sh.hideColumns(COLS.length);            // Policies JSON is machinery, not for reading
  } else {
    // Migrate a sheet created before a column was added.
    var have = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    COLS.forEach(function (c) {
      if (have.indexOf(c) === -1) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(c)
          .setFontWeight('bold').setBackground('#0E2A47').setFontColor('#ffffff');
      }
    });
  }
  return sh;
}

function ensureResponsesSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(CONFIG.RESPONSES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.RESPONSES_SHEET);
    sh.appendRow(['Timestamp', 'Client No', 'Client', 'Email', 'Former Agent', 'Preference',
      'What Previous Agent Did', 'Priorities Now', 'Confidence (1-5)', 'Contact Method',
      'Best Time', 'Client Notes', 'Consent to Contact']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function ensureLogSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.LOG_SHEET);
    sh.appendRow(['Timestamp', 'Stage', 'Client No', 'Client', 'Detail']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function log_(stage, clientNo, client, detail) {
  try { ensureLogSheet_().appendRow([new Date(), stage, clientNo, client, detail]); }
  catch (e) { Logger.log('log_ failed: ' + e); }
}

/** Reads a sheet as an array of header-keyed objects. */
function readTable_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(1, 1, last, sh.getLastColumn()).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1).map(function (row) {
    var o = {};
    headers.forEach(function (h, i) { if (h) o[h] = row[i]; });
    return o;
  });
}

/** Writes one cell on the Reassign tab by header name (i is 0-based data index). */
function setCell_(sh, i, header, value) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var col = headers.indexOf(header) + 1;
  if (col > 0) sh.getRange(i + 2, col).setValue(value);
}

function findByToken_(token) {
  token = String(token || '').trim();
  if (!token) return null;
  var rows = readTable_(ensureReassignSheet_()), out = null;
  rows.forEach(function (r, i) {
    if (String(r[R.TOKEN]).trim() === token) out = { row: r, index: i };
  });
  return out;
}

/**
 * The client's most recent form submission.
 *
 * Indexed once per execution — the dashboards ask for this once per client,
 * and rescanning the whole Responses tab each time would be quadratic.
 */
function lastResponse_(clientNo) {
  if (!CACHE_.responses) {
    var idx = {};
    readTable_(ensureResponsesSheet_()).forEach(function (r) {
      var k = String(r['Client No']).trim();
      if (!k) return;
      idx[k] = {                                   // later rows overwrite earlier ones
        preference: r['Preference'], pastService: r['What Previous Agent Did'],
        priorities: r['Priorities Now'], confidence: r['Confidence (1-5)'],
        contactMethod: r['Contact Method'], contactTime: r['Best Time'],
        notes: r['Client Notes'], at: dateStr_(r['Timestamp']),
      };
    });
    CACHE_.responses = idx;
  }
  return CACHE_.responses[String(clientNo).trim()] || null;
}

/* ============ EMAIL SENDING ============ */

/**
 * All mail goes through here. In TEST_MODE everything is redirected to the
 * manager with a banner showing the real recipient — so the whole programme
 * can be rehearsed end-to-end without touching a client.
 */
function send_(to, subject, html, opts) {
  opts = opts || {};
  if (!isEmail_(to)) { log_('SKIP', '', '', 'No valid address for: ' + subject); return; }
  var realTo = to, realCc = opts.cc || '';
  if (CONFIG.TEST_MODE) {
    html = testBanner_(realTo, realCc) + html;
    to = CONFIG.MANAGER_EMAIL;
    realCc = '';
    subject = '[TEST] ' + subject;
  }
  var payload = { to: to, subject: subject, htmlBody: html,
                  name: opts.name || CONFIG.BRANCH_NAME };
  if (realCc) payload.cc = realCc;
  if (opts.replyTo) payload.replyTo = opts.replyTo;
  MailApp.sendEmail(payload);
}

function testBanner_(to, cc) {
  return '<div style="background:#FFF4D6;border:1px solid #E8C86A;color:#6B4E00;padding:12px 16px;' +
    'font-family:Arial,sans-serif;font-size:13px;max-width:600px;margin:0 auto 10px;border-radius:10px">' +
    '<b>TEST MODE.</b> This email was not sent to the client. It would have gone to <b>' +
    esc_(to) + '</b>' + (cc ? ' (cc ' + esc_(cc) + ')' : '') +
    '.<br/>Set <code>TEST_MODE: false</code> in the script when you are ready to go live.</div>';
}

/* ============ HTML EMAIL BUILDING BLOCKS ============ */

function emailShell_(title, bodyHtml) {
  return '' +
  '<div style="background:#F4F8FB;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E3EDF5">' +
      '<div style="background:linear-gradient(135deg,#07131f,#0E8C8C);padding:28px 32px">' +
        '<div style="color:#00CFEA;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:bold">' +
          esc_(CONFIG.BRANCH_NAME) + '</div>' +
        '<div style="color:#ffffff;font-size:21px;font-weight:bold;margin-top:8px;line-height:1.3">' +
          esc_(title) + '</div>' +
      '</div>' +
      '<div style="padding:30px 32px;color:#152435;font-size:15px;line-height:1.65">' + bodyHtml + '</div>' +
      '<div style="padding:18px 32px;background:#F4F8FB;border-top:1px solid #E3EDF5;font-size:11px;color:#7a8ca0;line-height:1.6">' +
        esc_(CONFIG.MANAGER_NAME) + ' · ' + esc_(CONFIG.MANAGER_TITLE) + ' · ' +
        esc_(CONFIG.MANAGER_PHONE) + ' · ' + esc_(CONFIG.MANAGER_EMAIL) +
        '<br/>Figures shown are from our branch records and are indicative; your official ' +
        'Guardian policy documents remain the binding record of your cover.' +
      '</div>' +
    '</div>' +
  '</div>';
}

function p_(html) { return '<p style="margin:0 0 15px">' + html + '</p>'; }

function calloutBox_(html) {
  return '<div style="background:#EAF8FB;border-left:4px solid #00CFEA;padding:14px 18px;' +
    'border-radius:0 10px 10px 0;margin:0 0 16px;font-size:14px;line-height:1.6;color:#0E2A47">' +
    html + '</div>';
}

function quote_(text) {
  return '<div style="background:#F7FAFC;border:1px solid #E3EDF5;border-radius:10px;' +
    'padding:14px 18px;margin:0 0 16px;font-style:italic;color:#3B5268">“' +
    esc_(text) + '”</div>';
}

function statTable_(pairs) {
  return '<table style="width:100%;border-collapse:collapse;margin:6px 0 18px">' +
    pairs.map(function (p) {
      return '<tr>' +
        '<td style="padding:10px 12px;background:#F4F8FB;border:1px solid #E3EDF5;font-size:12px;color:#5B7186;font-weight:bold;width:40%;vertical-align:top">' + esc_(p[0]) + '</td>' +
        '<td style="padding:10px 12px;border:1px solid #E3EDF5;font-size:14px;color:#152435">' + esc_(p[1]) + '</td>' +
      '</tr>';
    }).join('') + '</table>';
}

function listTable_(rows, headers) {
  return '<table style="width:100%;border-collapse:collapse;margin:6px 0 18px;font-size:13px">' +
    '<tr>' + headers.map(function (h) {
      return '<th style="padding:9px 10px;background:#0E2A47;color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.6px">' + esc_(h) + '</th>';
    }).join('') + '</tr>' +
    rows.map(function (r) {
      return '<tr>' + r.map(function (c) {
        return '<td style="padding:9px 10px;border:1px solid #E3EDF5;color:#152435">' + esc_(c) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</table>';
}

function policyTable_(pols) {
  if (!pols || !pols.length) return '';
  return '<table style="width:100%;border-collapse:collapse;margin:6px 0 18px;font-size:13px">' +
    '<tr>' + ['Policy', 'Plan', 'Sum assured', 'Premium', 'Status'].map(function (h) {
      return '<th style="padding:9px 10px;background:#0E2A47;color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.6px">' + h + '</th>';
    }).join('') + '</tr>' +
    pols.map(function (x) {
      var tone = x.lapsed ? 'color:#B4471F;font-weight:bold' : 'color:#152435';
      return '<tr>' +
        '<td style="padding:9px 10px;border:1px solid #E3EDF5;color:#152435">' + esc_(x.policy) + '</td>' +
        '<td style="padding:9px 10px;border:1px solid #E3EDF5;color:#152435">' + esc_(x.plan) + '</td>' +
        '<td style="padding:9px 10px;border:1px solid #E3EDF5;color:#152435">' + (x.cover ? 'TT$' + money_(x.cover) : '—') + '</td>' +
        '<td style="padding:9px 10px;border:1px solid #E3EDF5;color:#152435">TT$' + money_(x.premium) + '</td>' +
        '<td style="padding:9px 10px;border:1px solid #E3EDF5;' + tone + '">' + esc_(x.status) + '</td>' +
      '</tr>';
    }).join('') + '</table>';
}

function agentCard_(prof) {
  var photo = prof.photo
    ? '<img src="' + esc_(prof.photo) + '" width="72" height="72" style="border-radius:50%;display:block;object-fit:cover"/>'
    : '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#0E8C8C,#00CFEA);color:#fff;font-size:26px;font-weight:bold;text-align:center;line-height:72px">' +
      esc_(initials_(prof.name)) + '</div>';
  return '<table style="width:100%;border-collapse:collapse;background:#F7FBFD;border:1px solid #D9EAF2;border-radius:14px;margin:6px 0 20px">' +
    '<tr>' +
      '<td style="padding:20px 8px 20px 20px;width:92px;vertical-align:top">' + photo + '</td>' +
      '<td style="padding:20px 20px 20px 8px;vertical-align:top">' +
        '<div style="font-size:18px;font-weight:bold;color:#0E2A47">' + esc_(prof.name) + '</div>' +
        '<div style="font-size:12px;color:#0E8C8C;font-weight:bold;text-transform:uppercase;letter-spacing:.7px;margin-top:3px">' +
          esc_(prof.speciality || prof.role || 'Servicing agent') + '</div>' +
        (prof.profile ? '<div style="font-size:13px;color:#3B5268;margin-top:9px;line-height:1.55">' + esc_(prof.profile) + '</div>' : '') +
        '<div style="font-size:13px;color:#152435;margin-top:10px">' +
          (prof.phone ? '📞 ' + esc_(prof.phone) + '<br/>' : '') +
          (prof.email ? '✉️ ' + esc_(prof.email) : '') +
        '</div>' +
      '</td>' +
    '</tr></table>';
}

function numberedSteps_(steps) {
  return '<table style="width:100%;border-collapse:collapse;margin:4px 0 18px">' +
    steps.map(function (s, i) {
      return '<tr>' +
        '<td style="padding:5px 12px 5px 0;vertical-align:top;width:30px">' +
          '<div style="width:24px;height:24px;border-radius:50%;background:#00CFEA;color:#07131f;font-weight:bold;font-size:12px;text-align:center;line-height:24px">' + (i + 1) + '</div>' +
        '</td>' +
        '<td style="padding:5px 0;font-size:14px;color:#152435;line-height:1.6">' + s + '</td>' +
      '</tr>';
    }).join('') + '</table>';
}

function button_(href, label) {
  return '<div style="text-align:center;margin:24px 0 10px">' +
    '<a href="' + esc_(href) + '" style="display:inline-block;background:linear-gradient(135deg,#00CFEA,#0E8C8C);color:#04212b;font-weight:bold;font-size:15px;text-decoration:none;padding:15px 34px;border-radius:999px">' +
    esc_(label) + '</a>' +
    '<div style="font-size:11px;color:#7a8ca0;margin-top:11px;word-break:break-all">Or copy this link: ' + esc_(href) + '</div>' +
  '</div>';
}

function signature_() {
  return '<div style="margin-top:22px;padding-top:18px;border-top:1px solid #E3EDF5">' +
    '<div style="font-size:14px;color:#152435">Warm regards,</div>' +
    '<div style="font-size:17px;font-weight:bold;color:#0E2A47;margin-top:6px">' + esc_(CONFIG.MANAGER_NAME) + '</div>' +
    '<div style="font-size:12px;color:#5B7186">' + esc_(CONFIG.MANAGER_TITLE) + ' · ' + esc_(CONFIG.BRANCH_NAME) + '</div>' +
    '<div style="font-size:12px;color:#5B7186;margin-top:3px">' + esc_(CONFIG.MANAGER_PHONE) + ' · ' + esc_(CONFIG.MANAGER_EMAIL) + '</div>' +
  '</div>';
}

/* ============ SMALL HELPERS ============ */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function arr_(v) { return Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v); }
function num_(v) {
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}
function round2_(n) { return Math.round(n * 100) / 100; }
function money_(v) { return num_(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function isEmail_(v) { return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(v || '').replace(/\s+/g, '')); }
function isPhone_(v) { return /\d{6,}/.test(String(v || '').replace(/\D/g, '')); }
function firstName_(name) {
  var n = String(name || '').replace(/,/g, ' ').trim().split(/\s+/)[0] || 'there';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}
function initials_(name) {
  var parts = String(name || '').replace(/^A\d+\s*-\s*/, '').trim().split(/\s+/);
  return ((parts[0] || '')[0] || '' ) + ((parts[parts.length - 1] || '')[0] || '');
}
function dateStr_(d) {
  if (!d) return '';
  var dt = (d instanceof Date) ? d : new Date(d);
  return isNaN(dt.getTime()) ? String(d)
    : Utilities.formatDate(dt, Session.getScriptTimeZone(), 'd MMM yyyy');
}
function daysBetween_(a, b) {
  var d1 = (a instanceof Date) ? a : new Date(a);
  if (isNaN(d1.getTime())) return 0;
  return Math.floor((b.getTime() - d1.getTime()) / 86400000);
}
function confidenceLabel_(c) {
  var n = parseInt(c, 10);
  return ({ 1: '1 — Not confident at all', 2: '2 — Slightly unsure',
            3: '3 — Neutral', 4: '4 — Fairly confident',
            5: '5 — Very confident' })[n] || 'Not answered';
}
function makeToken_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

/* ============ REHEARSAL ============ */

/** Sends yourself one of each email so you can see the whole journey. */
function previewAllEmails() {
  var demo = {};
  demo[R.CLIENT_NO] = '000000'; demo[R.CLIENT] = 'SAMPLE, Client';
  demo[R.FORMER] = 'A Former Agent'; demo[R.EMAIL] = CONFIG.MANAGER_EMAIL;
  demo[R.PHONE] = '868-000-0000'; demo[R.POLICIES] = 3; demo[R.PREMIUM] = 4820.55;
  demo[R.COVER] = 1500000; demo[R.TOKEN] = 'PREVIEW'; demo[R.LINK] = CONFIG.PORTAL_BASE + 'PREVIEW';
  var answers = {
    preference: 'Appoint a personal agent to me',
    pastService: ['Sold me the policy and I never heard from them again',
                  'Only contacted me when a payment was due'],
    priorities: ['Making sure my family is properly covered', 'Reviewing my beneficiaries'],
    confidence: '2', contactMethod: 'WhatsApp', contactTime: 'Evenings after 5pm',
    notes: 'I have moved house and I am not sure my beneficiary details are still right.',
  };
  var prof = agentProfile_(CONFIG.MANAGER_NAME);
  sendInvitation_(demo);
  sendClientRecap_(demo, answers);
  sendSupportBrief_(demo, answers);
  sendAppointmentToClient_(demo, prof);
  sendBriefToAgent_(demo, prof);
  Logger.log('Five preview emails sent to ' + CONFIG.MANAGER_EMAIL);
}

/**
 * Prints the real, full-book analysis to the log. Changes nothing, sends
 * nothing. Run this first — it tells you the true size of the problem before
 * you queue or email anybody.
 */
function reportInactiveAgents() {
  var t0 = new Date().getTime();
  var roster = activeRoster_();
  var psh = portfolioSheet_();
  var lastRow = psh.getLastRow(), lastCol = psh.getLastColumn();
  var headers = psh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var col = {};
  Object.keys(P).forEach(function (k) { col[k] = headers.indexOf(P[k]); });

  var byAgent = {}, orphanClients = {}, activeClients = {}, contactable = {};
  var scanned = 0, premium = 0, BLOCK = 2000;

  for (var start = 2; start <= lastRow; start += BLOCK) {
    var n = Math.min(BLOCK, lastRow - start + 1);
    var block = psh.getRange(start, 1, n, lastCol).getValues();
    for (var b = 0; b < block.length; b++) {
      var row = block[b];
      var a = String(row[col.AGENT] || '').trim();
      var c = String(row[col.CLIENT_NO] || '').trim();
      if (!a || !/^\d+$/.test(c)) continue;
      scanned++;
      if (isActiveAgent_(a, roster)) { activeClients[c] = true; continue; }
      var sd = col.STATUS_DESC >= 0 ? String(row[col.STATUS_DESC] || '').trim().toLowerCase() : '';
      if (DEAD_STATUSES.indexOf(sd) !== -1) continue;
      byAgent[a] = (byAgent[a] || 0) + 1;
      orphanClients[c] = true;
      premium += num_(row[col.PREMIUM]);
      if (isEmail_(row[col.EMAIL])) contactable[c] = true;
    }
  }

  var names = Object.keys(byAgent).sort(function (x, y) { return byAgent[y] - byAgent[x]; });
  var orphanCount = Object.keys(orphanClients).length;
  var mailable = Object.keys(contactable).length;

  Logger.log('================ INACTIVE AGENT ANALYSIS ================');
  Logger.log('Policy rows scanned ............ ' + scanned);
  Logger.log('Active roster .................. ' + roster.length + ' people');
  Logger.log('Inactive servicing agents ...... ' + names.length);
  Logger.log('ORPHANED CLIENTS ............... ' + orphanCount);
  Logger.log('  · reachable by email ......... ' + mailable);
  Logger.log('  · phone only (must be called)  ' + (orphanCount - mailable));
  Logger.log('Premium under inactive agents .. TT$' + money_(premium));
  Logger.log('Clients with an active agent ... ' + Object.keys(activeClients).length);
  Logger.log('--------------------------------------------------------');
  names.forEach(function (nm) { Logger.log('  ' + byAgent[nm] + ' policies — ' + nm); });
  Logger.log('Completed in ' + Math.round((new Date().getTime() - t0) / 1000) + 's');

  if (mailable > 0) {
    var runs = Math.ceil(mailable / Math.max(1, CONFIG.MAX_INVITES_PER_RUN));
    Logger.log('At ' + CONFIG.MAX_INVITES_PER_RUN + ' invitations per run, reaching all ' +
               mailable + ' takes about ' + runs + ' run(s). Check your Gmail daily cap ' +
               '(currently ' + MailApp.getRemainingDailyQuota() + ' left today).');
  }
  if (orphanCount - mailable > 0) {
    Logger.log('⚠ ' + (orphanCount - mailable) + ' orphaned clients have NO email address. ' +
               'They cannot be reached by this programme at all — use the "Call list" tab ' +
               'on the dashboard, or run exportCallList() to get them as a sheet.');
  }
  if (CONFIG.EXCLUDE_AGENTS.length) {
    Logger.log('Note: ' + CONFIG.EXCLUDE_AGENTS.length + ' agency/brokerage channel(s) are ' +
               'being treated as serviced and excluded — see CONFIG.EXCLUDE_AGENTS.');
  }
  return { orphans: orphanCount, mailable: mailable, agents: names.length, scanned: scanned };
}

/**
 * Builds a "Reassign Call List" tab of every orphaned client with a phone
 * number but no email — the ones this programme cannot reach.
 *
 * Most of the orphaned book falls into this bucket. Staff work the list, and
 * whenever they capture an email address they write it into the Email column
 * of the Reassign tab; that client then joins the normal invitation flow on
 * the next sendInvitations() run.
 */
function exportCallList() {
  var rows = readTable_(ensureReassignSheet_());
  var out = [];
  rows.forEach(function (r) {
    if (isEmail_(r[R.EMAIL]) || r[R.CLOSED]) return;
    out.push([r[R.CLIENT_NO], r[R.CLIENT], r[R.PHONE] || 'NO PHONE EITHER', r[R.FORMER],
              num_(r[R.POLICIES]), num_(r[R.PREMIUM]), r[R.STATUS], '', '']);
  });
  out.sort(function (a, b) { return b[5] - a[5]; });        // highest premium first

  var ss = ss_(), name = 'Reassign Call List';
  var sh = ss.getSheetByName(name);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(name);
  sh.appendRow(['Client No', 'Client', 'Phone', 'Former Agent', 'Policies',
                'Annual Premium (TT$)', 'Status', 'Called By / Outcome', 'Email Captured']);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0E2A47').setFontColor('#ffffff');
  for (var i = 0; i < out.length; i += 500) {
    var slice = out.slice(i, i + 500);
    sh.getRange(sh.getLastRow() + 1, 1, slice.length, slice[0].length).setValues(slice);
  }
  Logger.log('Call list built: ' + out.length + ' clients with no email address, ' +
             'highest premium first. Write any email you capture into the Reassign tab ' +
             'and they join the normal flow.');
  log_('CALLLIST', '', '', 'Built call list of ' + out.length + ' clients');
  return out.length;
}

/** Diagnostic: every inactive agent, so you can decide who is genuinely gone. */
function listInactiveAgents() {
  var res = reportInactiveAgents();
  Logger.log('Review the list above. Anything that is an agency or brokerage rather than ' +
             'a departed individual should be added to CONFIG.EXCLUDE_AGENTS — those ' +
             'clients are being serviced, just not by one of your people.');
  return res;
}
