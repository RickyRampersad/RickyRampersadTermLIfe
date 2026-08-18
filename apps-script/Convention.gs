/**
 * Convention 2028 tracker — backend.
 *
 * Deployed to Google Apps Script against a PRIVATE spreadsheet. Nothing in
 * here holds agent figures; the numbers live in the sheet and reach the page
 * at runtime behind a per-agent PIN.
 *
 * Qualification is measured on FYC and on persistency expressed as the
 * percentage of API still in force. API is NOT a target in its own right —
 * it appears only as the denominator of that ratio. (The branch moved away
 * from API qualification; the Guardian awards still use it, the Convention
 * does not.)
 *
 * Setup:  run setupConvention() once, then Deploy > New deployment > Web app
 *         (Execute as: Me · Who has access: Anyone) and paste the /exec URL
 *         into convention/index.html.
 */

var CONV = {
  TITLE: '24th Overseas Sales Convention',

  // Production period. Everything settled inside it counts.
  PERIOD_START: '2026-04-01',
  PERIOD_END:   '2027-09-30',

  // Persistency is tested twice: at the close of production, and again six
  // months later. An agent can hit target in September and lose the trip in
  // March, so the dashboard stays live until the second date.
  PERSISTENCY_MIN:   87.5,
  PERSISTENCY_CHECK: '2027-09-30',
  PERSISTENCY_HOLD:  '2028-03-31',

  // Early Bird side trip — settled production only, closes 31 Dec 2026.
  EARLY_BIRD_END:    '2026-12-31',
  EARLY_BIRD_SINGLE: 540000,
  EARLY_BIRD_DOUBLE: 740000,

  // At most 15% of a category quota may come from new Group and Individual
  // Health and Group Life. Anything above the ceiling is written but does
  // not count toward qualification.
  HEALTH_GROUP_CAP_PCT: 15,

  // Net FYC and minimum distinct lives. Both gates must be met — note the
  // money rises as the lives requirement falls.
  CATEGORIES: [
    { key: 'shared',    label: 'Agent (Shared)',                 fyc:  525000, lives: 90 },
    { key: 'own',       label: 'Agent (Own)',                    fyc:  675000, lives: 90 },
    { key: 'double',    label: 'Agent & Spouse (Double)',        fyc:  925000, lives: 80 },
    { key: 'bc_single', label: 'Agent Single (Business Class)',  fyc: 1600000, lives: 60 },
    { key: 'bc_double', label: 'Agent & Spouse (Business Class)', fyc: 2100000, lives: 60 }
  ],

  // Never qualified, or not for the last three conventions. Only the top
  // five who meet the criteria travel, so rank matters, not just the number.
  ASPIRANT: { fyc: 325000, lives: 67, places: 5 },

  // Highest producer above this takes superior accommodation.
  SUPERIOR_ABOVE: 1600000,

  TAB_AGENTS:      'Convention Agents',
  TAB_PRODUCTION:  'Convention Production',
  TAB_PERSISTENCY: 'Convention Persistency',
  TAB_IMPORTS:     'Convention Imports',

  PIN_MIN: 4,
  PIN_MAX: 8,
  MAX_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,

  // Yours only — clears a PIN, records an import. Set it in the Apps Script
  // editor, never in the public repository.
  ADMIN_PIN: 'CHANGE-ME-in-Apps-Script-only'
};


/* ============================ setup ============================ */

function setupConvention() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  convTab_(ss, CONV.TAB_AGENTS, [
    'Token', 'Name', 'Email', 'PIN hash', 'Salt', 'Failed attempts', 'Locked until',
    'Target category', 'Aspirant eligible', 'Previously aspirant',
    'Financial standing', 'Conduct status', 'Contracted', 'Active', 'Joined', 'Last seen']);

  convTab_(ss, CONV.TAB_PRODUCTION, [
    'Statement date', 'Settle date', 'Agent', 'Policy ref', 'Life ID',
    'New or increase', 'Product class', 'Net FYC', 'Gross FYC', 'API', 'Status']);

  convTab_(ss, CONV.TAB_PERSISTENCY, [
    'Agent', 'As at', 'API in force', 'Gross API settled', 'Rate %']);

  convTab_(ss, CONV.TAB_IMPORTS, [
    'Timestamp', 'By', 'Statement date', 'Rows added', 'Total net FYC', 'Notes']);

  ss.toast('Convention tracker ready. Deploy as a web app, then paste the /exec URL into convention/index.html.',
    'Setup complete', 12);
}

function convTab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}


/* ============================ routing ============================ */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'rules';
  var out;
  try {
    switch (action) {
      case 'rules':       out = { ok: true, rules: publicRules_() }; break;
      case 'me':          out = apiMe_(e.parameter.token); break;
      case 'leaderboard': out = apiLeaderboard_(e.parameter.token); break;
      default:            out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return convJson_(out);
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return convJson_({ ok: false, error: 'Could not read request' });
  }

  var out;
  try {
    switch (body.action) {
      case 'login':     out = apiLogin_(body); break;
      case 'setPin':    out = apiSetPin_(body); break;
      case 'resetPin':  out = apiResetPin_(body); break;
      default:          out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return convJson_(out);
}

function convJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** The rule constants are published in the Committee's document, so the page may hold them. */
function publicRules_() {
  return {
    title: CONV.TITLE,
    periodStart: CONV.PERIOD_START,
    periodEnd: CONV.PERIOD_END,
    persistencyMin: CONV.PERSISTENCY_MIN,
    persistencyCheck: CONV.PERSISTENCY_CHECK,
    persistencyHold: CONV.PERSISTENCY_HOLD,
    earlyBirdEnd: CONV.EARLY_BIRD_END,
    earlyBirdSingle: CONV.EARLY_BIRD_SINGLE,
    earlyBirdDouble: CONV.EARLY_BIRD_DOUBLE,
    healthGroupCapPct: CONV.HEALTH_GROUP_CAP_PCT,
    categories: CONV.CATEGORIES,
    aspirant: CONV.ASPIRANT,
    superiorAbove: CONV.SUPERIOR_ABOVE
  };
}


/* ============================ sign in ============================ */

function convHash_(pin, salt) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(salt) + '::' + String(pin), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ((b < 0 ? b + 256 : b) + 0x100).toString(16).slice(1);
  }).join('');
}

function convToken_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 20); }

function convName_(v) { return String(v || '').trim().replace(/\s+/g, ' '); }

function checkConvPin_(pin) {
  pin = String(pin || '');
  if (!/^\d+$/.test(pin)) return 'Your PIN must be digits only.';
  if (pin.length < CONV.PIN_MIN || pin.length > CONV.PIN_MAX) {
    return 'Your PIN must be ' + CONV.PIN_MIN + ' to ' + CONV.PIN_MAX + ' digits.';
  }
  return '';
}

function readAgents_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONV.TAB_AGENTS);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 16).getValues();
  return values.map(function (r, i) {
    return {
      rowIndex: i + 2,
      token: String(r[0] || ''),
      name: convName_(r[1]),
      email: String(r[2] || ''),
      pinHash: String(r[3] || ''),
      salt: String(r[4] || ''),
      failed: Number(r[5]) || 0,
      lockedUntil: r[6] ? new Date(r[6]) : null,
      category: String(r[7] || '').trim().toLowerCase(),
      aspirantEligible: String(r[8]).toUpperCase() === 'Y',
      previouslyAspirant: String(r[9]).toUpperCase() === 'Y',
      financialStanding: String(r[10] || '').trim(),
      conductStatus: String(r[11] || '').trim(),
      contracted: String(r[12]).toUpperCase() !== 'N',
      active: String(r[13]).toUpperCase() !== 'N'
    };
  }).filter(function (a) { return a.name && a.active; });
}

function findAgentByToken_(token) {
  if (!token) return null;
  return readAgents_().filter(function (a) { return a.token === token; })[0] || null;
}

function findAgentByName_(name) {
  var wanted = convName_(name).toLowerCase();
  return readAgents_().filter(function (a) { return a.name.toLowerCase() === wanted; })[0] || null;
}

function apiLogin_(body) {
  var name = convName_(body.name);
  var pin = String(body.pin || '').trim();
  if (!name || !pin) return { ok: false, error: 'Enter your name and your PIN.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var agent = findAgentByName_(name);

    // The same message either way, so this cannot be used to find out
    // who is on the branch list.
    var wrong = { ok: false, error: 'That name and PIN do not match.' };
    if (!agent) return wrong;

    if (agent.lockedUntil && agent.lockedUntil > new Date()) {
      var mins = Math.ceil((agent.lockedUntil - new Date()) / 60000);
      return { ok: false, error: 'Too many wrong PINs. Try again in ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.' };
    }

    // A row added by the branch but not yet claimed, or one you have reset.
    if (!agent.pinHash) return { ok: false, error: 'no-pin-set', name: agent.name };

    if (convHash_(pin, agent.salt) !== agent.pinHash) {
      registerConvFailure_(agent);
      return wrong;
    }

    // A fresh token on every sign-in, so an old device stops working.
    var token = convToken_();
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONV.TAB_AGENTS);
    sh.getRange(agent.rowIndex, 1).setValue(token);
    sh.getRange(agent.rowIndex, 6, 1, 2).setValues([[0, '']]);
    sh.getRange(agent.rowIndex, 16).setValue(new Date());

    return { ok: true, token: token, name: agent.name };
  } finally {
    lock.releaseLock();
  }
}

function registerConvFailure_(agent) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONV.TAB_AGENTS);
  var failed = agent.failed + 1;
  var until = '';
  if (failed >= CONV.MAX_ATTEMPTS) {
    until = new Date(Date.now() + CONV.LOCKOUT_MINUTES * 60000);
    failed = 0;
  }
  sh.getRange(agent.rowIndex, 6, 1, 2).setValues([[failed, until]]);
}

/** Claims an unclaimed row, or changes a known PIN. */
function apiSetPin_(body) {
  var name = convName_(body.name);
  var oldPin = String(body.oldPin || '').trim();
  var newPin = String(body.newPin || '').trim();

  var bad = checkConvPin_(newPin);
  if (bad) return { ok: false, error: bad };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var agent = findAgentByName_(name);
    if (!agent) return { ok: false, error: 'That name is not on the branch list — ask the branch to add you.' };

    if (agent.pinHash) {
      if (agent.lockedUntil && agent.lockedUntil > new Date()) {
        return { ok: false, error: 'Too many wrong PINs. Try again shortly.' };
      }
      if (convHash_(oldPin, agent.salt) !== agent.pinHash) {
        registerConvFailure_(agent);
        return { ok: false, error: 'Your current PIN is not correct.' };
      }
    }

    var salt = Utilities.getUuid();
    var token = convToken_();
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONV.TAB_AGENTS);
    sh.getRange(agent.rowIndex, 1).setValue(token);
    sh.getRange(agent.rowIndex, 4, 1, 4).setValues([[convHash_(newPin, salt), salt, 0, '']]);
    sh.getRange(agent.rowIndex, 15).setValue(agent.rowIndex ? new Date() : new Date());

    return { ok: true, token: token, name: agent.name };
  } finally {
    lock.releaseLock();
  }
}

/** Yours: clears a PIN so the agent can choose a new one. Figures untouched. */
function apiResetPin_(body) {
  if (String(body.adminPin || '') !== CONV.ADMIN_PIN) return { ok: false, error: 'Not authorised.' };
  var agent = findAgentByName_(body.name);
  if (!agent) return { ok: false, error: 'No such agent.' };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONV.TAB_AGENTS);
  sh.getRange(agent.rowIndex, 4, 1, 4).setValues([['', '', 0, '']]);
  sh.getRange(agent.rowIndex, 1).setValue('');
  return { ok: true, name: agent.name };
}


/* ============================ the numbers ============================ */

function convDate_(v) {
  if (!v) return null;
  var d = (v instanceof Date) ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function convNum_(v) {
  var n = Number(String(v == null ? 0 : v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function daysBetween_(a, b) {
  return Math.round((convDate_(b) - convDate_(a)) / 86400000);
}

/**
 * Every settled row for one agent inside the production period.
 * Cases that lapsed, were not taken, not proceeded with, postponed or
 * declined are excluded from production — and are what the next
 * convention deducts, which is why the sheet keeps them rather than
 * dropping the row.
 */
function productionFor_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONV.TAB_PRODUCTION);
  if (!sh || sh.getLastRow() < 2) return { rows: [], statementDate: null };

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  var start = convDate_(CONV.PERIOD_START);
  var end = convDate_(CONV.PERIOD_END);
  var wanted = convName_(name).toLowerCase();
  var statementDate = null;
  var rows = [];

  values.forEach(function (r) {
    if (convName_(r[2]).toLowerCase() !== wanted) return;
    var stmt = convDate_(r[0]);
    if (stmt && (!statementDate || stmt > statementDate)) statementDate = stmt;

    var settled = convDate_(r[1]);
    if (!settled || settled < start || settled > end) return;
    if (String(r[10] || 'settled').trim().toLowerCase() !== 'settled') return;

    rows.push({
      settled: settled,
      lifeId: String(r[4] || '').trim(),
      productClass: String(r[6] || 'individual_life').trim().toLowerCase(),
      netFyc: convNum_(r[7]),
      grossFyc: convNum_(r[8]),
      api: convNum_(r[9])
    });
  });

  return { rows: rows, statementDate: statementDate };
}

/** The latest persistency measurement on file for an agent. */
function persistencyFor_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONV.TAB_PERSISTENCY);
  if (!sh || sh.getLastRow() < 2) return null;

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  var wanted = convName_(name).toLowerCase();
  var latest = null;

  values.forEach(function (r) {
    if (convName_(r[0]).toLowerCase() !== wanted) return;
    var asAt = convDate_(r[1]);
    if (!asAt) return;
    if (!latest || asAt > latest.asAt) {
      latest = { asAt: asAt, apiInForce: convNum_(r[2]), grossApi: convNum_(r[3]) };
    }
  });

  if (!latest) return null;

  // The rate is the share of settled API still in force. API is not a
  // target here — it is only the denominator of this ratio.
  latest.rate = latest.grossApi > 0 ? (latest.apiInForce / latest.grossApi) * 100 : 0;

  // What an agent actually wants to know: how much more may lapse before
  // the ratio breaks the floor.
  latest.floorApi = latest.grossApi * (CONV.PERSISTENCY_MIN / 100);
  latest.headroom = latest.apiInForce - latest.floorApi;
  latest.meetsFloor = latest.rate >= CONV.PERSISTENCY_MIN;
  return latest;
}

/**
 * Everything one agent's dashboard needs. Kept server-side so the page is
 * presentation only and no rule constant can drift between the two.
 */
function standingFor_(agent, today) {
  today = convDate_(today) || new Date();

  var prod = productionFor_(agent.name);
  var start = convDate_(CONV.PERIOD_START);
  var end = convDate_(CONV.PERIOD_END);
  var ebEnd = convDate_(CONV.EARLY_BIRD_END);

  var netFyc = 0, grossFyc = 0, healthGroupFyc = 0, earlyBirdFyc = 0;
  var lives = {};

  prod.rows.forEach(function (r) {
    netFyc += r.netFyc;
    grossFyc += r.grossFyc;
    if (r.productClass === 'health' || r.productClass === 'group_life' || r.productClass === 'group_health') {
      healthGroupFyc += r.netFyc;
    }
    if (r.settled <= ebEnd) earlyBirdFyc += r.netFyc;
    if (r.lifeId) lives[r.lifeId] = true;   // the same life is never counted twice
  });

  var liveCount = Object.keys(lives).length;
  var pers = persistencyFor_(agent.name);

  // Where we are on the clock.
  var periodDays = daysBetween_(start, end);
  var elapsed = Math.max(0, Math.min(periodDays, daysBetween_(start, today)));
  var remaining = Math.max(0, daysBetween_(today, end));

  var ebDays = daysBetween_(start, ebEnd);
  var ebRemaining = daysBetween_(today, ebEnd);
  var ebOpen = ebRemaining > 0;

  // Every category, both gates, and the ceiling that applies to it.
  var categories = CONV.CATEGORIES.map(function (c) {
    var cap = c.fyc * (CONV.HEALTH_GROUP_CAP_PCT / 100);
    var counted = netFyc - Math.max(0, healthGroupFyc - cap);   // excess above the ceiling does not count
    return {
      key: c.key,
      label: c.label,
      fycTarget: c.fyc,
      livesTarget: c.lives,
      fycNow: counted,
      livesNow: liveCount,
      fycPct: c.fyc ? Math.min(100, (counted / c.fyc) * 100) : 0,
      livesPct: c.lives ? Math.min(100, (liveCount / c.lives) * 100) : 0,
      fycShort: Math.max(0, c.fyc - counted),
      livesShort: Math.max(0, c.lives - liveCount),
      capAllowance: cap,
      capUsed: Math.min(healthGroupFyc, cap),
      capExceededBy: Math.max(0, healthGroupFyc - cap),
      // Both gates, and persistency, or it is not a qualification.
      qualified: counted >= c.fyc && liveCount >= c.lives && !!(pers && pers.meetsFloor)
    };
  });

  // The nearest rung still open — what the agent should be aiming at today.
  var next = categories.filter(function (c) { return !(c.fycNow >= c.fycTarget && c.livesNow >= c.livesTarget); })[0] || null;

  // Which gate is actually holding them. Agents track the money and miss
  // the lives, so this is stated in words on the page.
  var binding = null;
  if (next) {
    if (next.fycShort > 0 && next.livesShort > 0) binding = 'both';
    else if (next.livesShort > 0) binding = 'lives';
    else if (next.fycShort > 0) binding = 'fyc';
  }

  var aspirant = null;
  if (agent.aspirantEligible && !agent.previouslyAspirant) {
    aspirant = {
      fycTarget: CONV.ASPIRANT.fyc,
      livesTarget: CONV.ASPIRANT.lives,
      places: CONV.ASPIRANT.places,
      fycNow: netFyc,
      livesNow: liveCount,
      fycPct: Math.min(100, (netFyc / CONV.ASPIRANT.fyc) * 100),
      livesPct: Math.min(100, (liveCount / CONV.ASPIRANT.lives) * 100),
      fycShort: Math.max(0, CONV.ASPIRANT.fyc - netFyc),
      livesShort: Math.max(0, CONV.ASPIRANT.lives - liveCount),
      meets: netFyc >= CONV.ASPIRANT.fyc && liveCount >= CONV.ASPIRANT.lives
    };
  }

  return {
    name: agent.name,
    statementDate: prod.statementDate ? Utilities.formatDate(prod.statementDate, Session.getScriptTimeZone(), 'd MMMM yyyy') : null,

    // FYC accumulated since the start of the production period. This is the
    // qualification measure.
    fyc: {
      net: netFyc,
      gross: grossFyc,
      healthGroup: healthGroupFyc,
      perDayAchieved: elapsed > 0 ? netFyc / elapsed : 0
    },

    lives: liveCount,

    // Persistency as the share of settled API still in force, with the
    // headroom that makes it actionable.
    persistency: pers ? {
      asAt: Utilities.formatDate(pers.asAt, Session.getScriptTimeZone(), 'd MMMM yyyy'),
      rate: pers.rate,
      floor: CONV.PERSISTENCY_MIN,
      apiInForce: pers.apiInForce,
      grossApi: pers.grossApi,
      floorApi: pers.floorApi,
      headroom: pers.headroom,
      meetsFloor: pers.meetsFloor
    } : null,

    clock: {
      periodDays: periodDays,
      elapsed: elapsed,
      remaining: remaining,
      pctElapsed: periodDays ? (elapsed / periodDays) * 100 : 0
    },

    earlyBird: {
      open: ebOpen,
      daysRemaining: Math.max(0, ebRemaining),
      windowDays: ebDays,
      fycNow: earlyBirdFyc,
      single: CONV.EARLY_BIRD_SINGLE,
      double: CONV.EARLY_BIRD_DOUBLE,
      singleShort: Math.max(0, CONV.EARLY_BIRD_SINGLE - earlyBirdFyc),
      doubleShort: Math.max(0, CONV.EARLY_BIRD_DOUBLE - earlyBirdFyc),
      singlePct: Math.min(100, (earlyBirdFyc / CONV.EARLY_BIRD_SINGLE) * 100),
      doublePct: Math.min(100, (earlyBirdFyc / CONV.EARLY_BIRD_DOUBLE) * 100),
      onPaceSingle: CONV.EARLY_BIRD_SINGLE * (Math.min(ebDays, daysBetween_(start, today)) / ebDays),
      perDaySingle: ebRemaining > 0 ? Math.max(0, CONV.EARLY_BIRD_SINGLE - earlyBirdFyc) / ebRemaining : 0,
      perDayDouble: ebRemaining > 0 ? Math.max(0, CONV.EARLY_BIRD_DOUBLE - earlyBirdFyc) / ebRemaining : 0
    },

    categories: categories,
    next: next,
    binding: binding,
    aspirant: aspirant,

    // Production alone does not carry an agent to the airport.
    standing: {
      financial: agent.financialStanding || 'Not recorded',
      conduct: agent.conductStatus || 'Not recorded',
      contracted: agent.contracted
    }
  };
}

function apiMe_(token) {
  var agent = findAgentByToken_(token);
  if (!agent) return { ok: false, error: 'Please sign in again.' };
  return { ok: true, rules: publicRules_(), me: standingFor_(agent, new Date()) };
}

/**
 * Ranked by share of own target rather than raw FYC, so the board stays
 * worth opening for everybody and not only the two agents at the top.
 * Other agents' dollar figures are never returned.
 */
function apiLeaderboard_(token) {
  var me = findAgentByToken_(token);
  if (!me) return { ok: false, error: 'Please sign in again.' };

  var target = function (a) {
    var cat = CONV.CATEGORIES.filter(function (c) { return c.key === a.category; })[0];
    return cat || CONV.CATEGORIES[0];
  };

  var board = readAgents_().map(function (a) {
    var s = standingFor_(a, new Date());
    var t = target(a);
    return {
      name: a.name,
      isMe: a.token === token,
      category: t.label,
      fycPct: t.fyc ? Math.min(100, (s.fyc.net / t.fyc) * 100) : 0,
      livesPct: t.lives ? Math.min(100, (s.lives / t.lives) * 100) : 0,
      persistencyOk: !!(s.persistency && s.persistency.meetsFloor)
    };
  });

  // The lower of the two gates is the honest measure of where somebody is.
  board.forEach(function (b) { b.overallPct = Math.min(b.fycPct, b.livesPct); });
  board.sort(function (x, y) { return y.overallPct - x.overallPct; });
  board.forEach(function (b, i) { b.rank = i + 1; });

  return { ok: true, board: board, count: board.length };
}


/* ============================ importing ============================ */

/**
 * Records an official import. Call from the sheet after pasting a
 * production statement, so every figure on the dashboard can be traced
 * back to the statement it came from.
 */
function logConventionImport(statementDate, rowsAdded, totalNetFyc, notes) {
  var sh = convTab_(SpreadsheetApp.getActiveSpreadsheet(), CONV.TAB_IMPORTS,
    ['Timestamp', 'By', 'Statement date', 'Rows added', 'Total net FYC', 'Notes']);
  sh.appendRow([new Date(), Session.getActiveUser().getEmail() || 'unknown',
    statementDate, rowsAdded, totalNetFyc, notes || '']);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Convention 2028')
    .addItem('Set up the tracker', 'setupConvention')
    .addToUi();
}
