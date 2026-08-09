/**
 * ============================================================
 *  BRANCH TRADING LEAGUE — backend
 *  Ricky Rampersad Branch
 * ============================================================
 *
 *  A play-money investing game for the branch team. Everyone
 *  starts with the same imaginary balance and buys/sells real
 *  listed instruments at real (delayed) market prices. Nobody
 *  deposits or withdraws anything — there is no real money and
 *  no real brokerage account anywhere in this system.
 *
 *  WHAT THIS SCRIPT DOES
 *   1. Prices — keeps a "Prices" tab full of GOOGLEFINANCE
 *      formulas and reads the values back. No API key, no
 *      signup, no rate limit to manage.
 *   2. Storage — players, holdings and trades live in tabs of
 *      the same spreadsheet.
 *   3. API — doGet/doPost serve JSON to market/index.html.
 *
 *  SETUP (about ten minutes, once):
 *   1. Make a new Google Sheet. Extensions → Apps Script.
 *   2. Paste this file in, save.
 *   3. Run setupMarket() once and grant the permissions it asks
 *      for. It builds every tab and loads the price formulas.
 *   4. Deploy → New deployment → Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Copy the /exec URL.
 *   5. Paste that URL into CONFIG.API_URL in market/index.html.
 *   6. Set your league PIN and admin PIN below before deploying.
 *
 *  Prices from GOOGLEFINANCE are delayed (up to ~20 minutes for
 *  US listings) and are not a trading feed. That is fine for a
 *  game and is stated plainly on the page.
 * ============================================================
 */

var MARKET = {
  // Typed once, when someone opens an account. It stops
  // strangers opening accounts; it is not the sign-in credential.
  LEAGUE_PIN: 'BRANCH',

  // Yours only. Resets the league and clears a forgotten PIN.
  ADMIN_PIN: 'CHANGE-ME',

  // Each player picks their own PIN of this length to sign in.
  PIN_MIN: 4,
  PIN_MAX: 8,

  // Wrong PIN this many times in a row and the account is held
  // shut for a while, so nobody can sit and guess four digits.
  MAX_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,

  // Play money each player starts with. No currency conversion
  // happens anywhere — prices are USD, so treat this as USD.
  STARTING_CASH: 100000,

  // Charged on every trade so people cannot churn for free.
  COMMISSION: 5,

  // Seconds a quote set is reused before the sheet is read again.
  QUOTE_CACHE_SECONDS: 45,

  TAB_PLAYERS:  'Players',
  TAB_HOLDINGS: 'Holdings',
  TAB_TRADES:   'Trades',
  TAB_PRICES:   'Prices'
};

/**
 * The index levels shown in the ticker across the top of the page.
 * These are read-only — an index is not a thing you can buy, so
 * these are displayed, never traded.
 */
var INDICES = [
  { symbol: 'DJI',  google: 'INDEXDJX:.DJI',      name: 'Dow Jones Industrial Average' },
  { symbol: 'IXIC', google: 'INDEXNASDAQ:.IXIC',  name: 'Nasdaq Composite' },
  { symbol: 'NDX',  google: 'INDEXNASDAQ:.NDX',   name: 'Nasdaq 100' },
  { symbol: 'INX',  google: 'INDEXSP:.INX',       name: 'S&P 500' }
];

/**
 * What players may actually buy. The first three are the funds
 * that track the indices above — buying DIA is how you "invest
 * in the Dow", buying QQQ is how you "invest in the Nasdaq".
 * The rest are large, heavily traded names people recognise.
 *
 * Add or remove rows freely, then run setupMarket() again.
 */
var UNIVERSE = [
  { symbol: 'DIA',  google: 'NYSEARCA:DIA',  name: 'Dow Jones (DIA fund)',    group: 'Index trackers' },
  { symbol: 'QQQ',  google: 'NASDAQ:QQQ',    name: 'Nasdaq 100 (QQQ fund)',   group: 'Index trackers' },
  { symbol: 'SPY',  google: 'NYSEARCA:SPY',  name: 'S&P 500 (SPY fund)',      group: 'Index trackers' },

  { symbol: 'AAPL', google: 'NASDAQ:AAPL',   name: 'Apple',                   group: 'Technology' },
  { symbol: 'MSFT', google: 'NASDAQ:MSFT',   name: 'Microsoft',               group: 'Technology' },
  { symbol: 'NVDA', google: 'NASDAQ:NVDA',   name: 'NVIDIA',                  group: 'Technology' },
  { symbol: 'GOOGL',google: 'NASDAQ:GOOGL',  name: 'Alphabet (Google)',       group: 'Technology' },
  { symbol: 'AMZN', google: 'NASDAQ:AMZN',   name: 'Amazon',                  group: 'Technology' },
  { symbol: 'META', google: 'NASDAQ:META',   name: 'Meta (Facebook)',         group: 'Technology' },
  { symbol: 'TSLA', google: 'NASDAQ:TSLA',   name: 'Tesla',                   group: 'Technology' },

  { symbol: 'JPM',  google: 'NYSE:JPM',      name: 'JPMorgan Chase',          group: 'Financial' },
  { symbol: 'BRK.B',google: 'NYSE:BRK.B',    name: 'Berkshire Hathaway B',    group: 'Financial' },
  { symbol: 'V',    google: 'NYSE:V',        name: 'Visa',                    group: 'Financial' },
  { symbol: 'GS',   google: 'NYSE:GS',       name: 'Goldman Sachs',           group: 'Financial' },

  { symbol: 'JNJ',  google: 'NYSE:JNJ',      name: 'Johnson & Johnson',       group: 'Healthcare & consumer' },
  { symbol: 'KO',   google: 'NYSE:KO',       name: 'Coca-Cola',               group: 'Healthcare & consumer' },
  { symbol: 'MCD',  google: 'NYSE:MCD',      name: "McDonald's",              group: 'Healthcare & consumer' },
  { symbol: 'WMT',  google: 'NYSE:WMT',      name: 'Walmart',                 group: 'Healthcare & consumer' },
  { symbol: 'DIS',  google: 'NYSE:DIS',      name: 'Walt Disney',             group: 'Healthcare & consumer' },

  { symbol: 'XOM',  google: 'NYSE:XOM',      name: 'Exxon Mobil',             group: 'Energy & industry' },
  { symbol: 'CAT',  google: 'NYSE:CAT',      name: 'Caterpillar',             group: 'Energy & industry' },
  { symbol: 'BA',   google: 'NYSE:BA',       name: 'Boeing',                  group: 'Energy & industry' }
];


/* ============================================================
 *  SETUP
 * ========================================================== */

/**
 * Builds every tab and loads the price formulas. Safe to run
 * again after editing UNIVERSE — it rebuilds the Prices tab
 * only, and leaves players, holdings and trades alone.
 */
function setupMarket() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureTab_(ss, MARKET.TAB_PLAYERS,
    ['Token', 'Name', 'Email', 'Cash', 'Joined', 'Last seen',
     'PIN hash', 'Salt', 'Failed attempts', 'Locked until']);

  // Adds the sign-in columns to a Players tab built before logins
  // existed, without disturbing anybody's cash.
  ensureColumns_(ss, MARKET.TAB_PLAYERS,
    ['PIN hash', 'Salt', 'Failed attempts', 'Locked until']);
  ensureTab_(ss, MARKET.TAB_HOLDINGS,
    ['Token', 'Symbol', 'Quantity', 'Average cost']);
  ensureTab_(ss, MARKET.TAB_TRADES,
    ['Timestamp', 'Token', 'Player', 'Side', 'Symbol', 'Quantity', 'Price', 'Value', 'Commission', 'Cash after']);

  buildPricesTab_();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Trading league ready. Deploy as a web app, then paste the /exec URL into market/index.html.',
    'Setup complete', 12);
}

function ensureTab_(ss, name, headers) {
  var s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#163553').setFontColor('#ffffff');
    s.setFrozenRows(1);
  }
  return s;
}

/** Appends any of `wanted` that the header row does not already carry. */
function ensureColumns_(ss, tabName, wanted) {
  var s = ss.getSheetByName(tabName);
  if (!s) return;

  var width = Math.max(s.getLastColumn(), 1);
  var headers = s.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h || '').trim();
  });

  var missing = wanted.filter(function (w) { return headers.indexOf(w) === -1; });
  if (!missing.length) return;

  s.getRange(1, width + 1, 1, missing.length).setValues([missing])
    .setFontWeight('bold').setBackground('#163553').setFontColor('#ffffff');
}

/**
 * Writes one row per instrument with live GOOGLEFINANCE formulas.
 * The formulas stay in the sheet and Google refreshes them on its
 * own schedule, so serving a quote is just reading cell values.
 */
function buildPricesTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(MARKET.TAB_PRICES);
  if (!s) s = ss.insertSheet(MARKET.TAB_PRICES);
  s.clear();

  s.getRange(1, 1, 1, 7)
    .setValues([['Symbol', 'Google ticker', 'Name', 'Group', 'Price', 'Prev close', 'Tradeable']])
    .setFontWeight('bold').setBackground('#163553').setFontColor('#ffffff');
  s.setFrozenRows(1);

  var rows = [];
  var formulas = [];

  INDICES.concat(UNIVERSE).forEach(function (item) {
    var tradeable = item.group ? 'yes' : 'no'; // indices carry no group and are display-only
    rows.push([item.symbol, item.google, item.name, item.group || 'Index', '', '', tradeable]);
    formulas.push([
      '=IFERROR(GOOGLEFINANCE("' + item.google + '","price"),"")',
      '=IFERROR(GOOGLEFINANCE("' + item.google + '","closeyest"),"")'
    ]);
  });

  s.getRange(2, 1, rows.length, 7).setValues(rows);
  s.getRange(2, 5, formulas.length, 2).setFormulas(formulas);
  s.getRange(2, 5, formulas.length, 2).setNumberFormat('#,##0.00');
  s.autoResizeColumns(1, 7);

  SpreadsheetApp.flush();
}


/* ============================================================
 *  PRICES
 * ========================================================== */

/**
 * Reads the Prices tab into a lookup keyed by symbol. Cached for
 * a few seconds so a page full of widgets does not re-read the
 * sheet a dozen times.
 */
function getQuotes_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('quotes');
  if (hit) {
    try { return JSON.parse(hit); } catch (err) { /* fall through and rebuild */ }
  }

  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PRICES);
  if (!s || s.getLastRow() < 2) return {};

  var data = s.getRange(2, 1, s.getLastRow() - 1, 7).getValues();
  var out = {};

  data.forEach(function (r) {
    var symbol = String(r[0] || '').trim();
    if (!symbol) return;
    var price = num_(r[4]);
    var prev  = num_(r[5]);
    if (price <= 0) return; // formula still loading, or a bad ticker

    var change = prev > 0 ? price - prev : 0;
    out[symbol] = {
      symbol: symbol,
      name: String(r[2] || symbol),
      group: String(r[3] || ''),
      price: round2_(price),
      prevClose: round2_(prev),
      change: round2_(change),
      pct: prev > 0 ? round2_((change / prev) * 100) : 0,
      tradeable: String(r[6] || '').toLowerCase() === 'yes'
    };
  });

  cache.put('quotes', JSON.stringify(out), MARKET.QUOTE_CACHE_SECONDS);
  return out;
}

function priceOf_(quotes, symbol) {
  var q = quotes[symbol];
  return q ? q.price : 0;
}


/* ============================================================
 *  API
 * ========================================================== */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'league';
  var out;

  try {
    switch (action) {
      case 'quotes':    out = apiQuotes_(); break;
      case 'league':    out = apiLeague_(); break;
      case 'me':        out = apiMe_(e.parameter.token); break;
      default:          out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }

  return json_(out);
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Could not read request' });
  }

  var out;
  try {
    switch (body.action) {
      case 'register':  out = apiRegister_(body); break;
      case 'login':     out = apiLogin_(body); break;
      case 'changePin': out = apiChangePin_(body); break;
      case 'resetPin':  out = apiResetPin_(body); break;
      case 'trade':     out = apiTrade_(body); break;
      case 'reset':     out = apiReset_(body); break;
      default:          out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }

  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/** Every instrument and index, with current prices. */
function apiQuotes_() {
  var quotes = getQuotes_();
  var indices = [];
  var instruments = [];

  INDICES.forEach(function (i) {
    if (quotes[i.symbol]) indices.push(quotes[i.symbol]);
  });
  UNIVERSE.forEach(function (u) {
    if (quotes[u.symbol]) instruments.push(quotes[u.symbol]);
  });

  return {
    ok: true,
    indices: indices,
    instruments: instruments,
    startingCash: MARKET.STARTING_CASH,
    commission: MARKET.COMMISSION,
    asOf: new Date().toISOString()
  };
}


/** The leaderboard: every player valued at current prices. */
function apiLeague_() {
  var quotes = getQuotes_();
  var players = readPlayers_();
  var holdings = readHoldings_();

  var rows = players.map(function (p) {
    var mine = holdings.filter(function (h) { return h.token === p.token; });
    var invested = 0;
    mine.forEach(function (h) { invested += h.qty * priceOf_(quotes, h.symbol); });

    var total = p.cash + invested;
    var pnl = total - MARKET.STARTING_CASH;

    return {
      name: p.name,
      cash: round2_(p.cash),
      invested: round2_(invested),
      total: round2_(total),
      pnl: round2_(pnl),
      pct: round2_((pnl / MARKET.STARTING_CASH) * 100),
      positions: mine.length,
      joined: p.joined
    };
  });

  rows.sort(function (a, b) { return b.total - a.total; });
  rows.forEach(function (r, i) { r.rank = i + 1; });

  var indices = [];
  INDICES.forEach(function (i) { if (quotes[i.symbol]) indices.push(quotes[i.symbol]); });

  return {
    ok: true,
    players: rows,
    indices: indices,
    startingCash: MARKET.STARTING_CASH,
    asOf: new Date().toISOString()
  };
}


/** One player's own cash, positions and trade history. */
function apiMe_(token) {
  token = String(token || '').trim();
  if (!token) return { ok: false, error: 'Missing token' };

  var player = findPlayer_(token);
  if (!player) return { ok: false, error: 'unknown-player' };

  var quotes = getQuotes_();
  var mine = readHoldings_().filter(function (h) { return h.token === token; });

  var invested = 0;
  var positions = mine.map(function (h) {
    var price = priceOf_(quotes, h.symbol);
    var value = h.qty * price;
    var cost = h.qty * h.avgCost;
    invested += value;
    return {
      symbol: h.symbol,
      name: (quotes[h.symbol] && quotes[h.symbol].name) || h.symbol,
      qty: h.qty,
      avgCost: round2_(h.avgCost),
      price: round2_(price),
      value: round2_(value),
      pnl: round2_(value - cost),
      pct: cost > 0 ? round2_(((value - cost) / cost) * 100) : 0
    };
  });

  positions.sort(function (a, b) { return b.value - a.value; });

  var total = player.cash + invested;

  touchPlayer_(token);

  return {
    ok: true,
    player: { name: player.name, email: player.email, joined: player.joined },
    cash: round2_(player.cash),
    invested: round2_(invested),
    total: round2_(total),
    pnl: round2_(total - MARKET.STARTING_CASH),
    pct: round2_(((total - MARKET.STARTING_CASH) / MARKET.STARTING_CASH) * 100),
    positions: positions,
    trades: readTrades_(token, 40),
    asOf: new Date().toISOString()
  };
}


/**
 * Opens an account. Needs the league code once, then the player
 * chooses the PIN they will sign in with from then on.
 */
function apiRegister_(body) {
  var name = cleanName_(body.name);
  var email = String(body.email || '').trim();
  var pin = String(body.pin || '').trim();
  var leaguePin = String(body.leaguePin || '').trim();

  if (name.length < 2) return { ok: false, error: 'Please enter your name.' };
  if (leaguePin.toUpperCase() !== String(MARKET.LEAGUE_PIN).toUpperCase()) {
    return { ok: false, error: 'That league code is not right.' };
  }

  var bad = checkPin_(pin);
  if (bad) return { ok: false, error: bad };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (findPlayerByName_(name)) {
      return { ok: false, error: 'There is already an account in that name. Sign in instead, or use your full name.' };
    }

    var token = makeToken_();
    var salt = Utilities.getUuid();
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PLAYERS)
      .appendRow([token, name, email, MARKET.STARTING_CASH, new Date(), new Date(),
                  hashPin_(pin, salt), salt, 0, '']);

    return { ok: true, token: token, name: name };
  } finally {
    lock.releaseLock();
  }
}


/** Signs an existing player in with their own PIN. */
function apiLogin_(body) {
  var name = cleanName_(body.name);
  var pin = String(body.pin || '').trim();

  if (!name || !pin) return { ok: false, error: 'Enter your name and your PIN.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var player = findPlayerByName_(name);

    // Same message either way, so this cannot be used to find out
    // who is in the league.
    var wrong = { ok: false, error: 'That name and PIN do not match.' };
    if (!player) return wrong;

    if (player.lockedUntil && player.lockedUntil > new Date()) {
      var mins = Math.ceil((player.lockedUntil - new Date()) / 60000);
      return { ok: false, error: 'Too many wrong PINs. Try again in ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.' };
    }

    // An account created before logins existed, or one Ricky has reset.
    if (!player.pinHash) {
      return { ok: false, error: 'no-pin-set', name: player.name };
    }

    if (hashPin_(pin, player.salt) !== player.pinHash) {
      registerFailure_(player);
      return wrong;
    }

    // Fresh token on every sign-in, so an old device stops working
    // once they sign in somewhere else.
    var token = makeToken_();
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PLAYERS);
    s.getRange(player.rowIndex, 1).setValue(token);
    s.getRange(player.rowIndex, 6).setValue(new Date());
    s.getRange(player.rowIndex, 9, 1, 2).setValues([[0, '']]);

    return { ok: true, token: token, name: player.name };
  } finally {
    lock.releaseLock();
  }
}


/**
 * Sets a PIN. Used both to change a known one and to claim an
 * account whose PIN Ricky has cleared.
 */
function apiChangePin_(body) {
  var name = cleanName_(body.name);
  var oldPin = String(body.oldPin || '').trim();
  var newPin = String(body.newPin || '').trim();

  var bad = checkPin_(newPin);
  if (bad) return { ok: false, error: bad };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var player = body.token ? findPlayer_(body.token) : findPlayerByName_(name);
    if (!player) return { ok: false, error: 'That name and PIN do not match.' };

    if (player.pinHash) {
      if (player.lockedUntil && player.lockedUntil > new Date()) {
        return { ok: false, error: 'Too many wrong PINs. Try again shortly.' };
      }
      if (hashPin_(oldPin, player.salt) !== player.pinHash) {
        registerFailure_(player);
        return { ok: false, error: 'That name and PIN do not match.' };
      }
    } else {
      // Claiming an account whose PIN was cleared. Without this the
      // account would sit unprotected between the reset and the player
      // getting to it, and a colleague could take it over by name alone.
      if (String(body.leaguePin || '').trim().toUpperCase() !== String(MARKET.LEAGUE_PIN).toUpperCase()) {
        return { ok: false, error: 'Enter the league code to set a new PIN.' };
      }
    }

    var salt = Utilities.getUuid();
    var token = makeToken_();
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PLAYERS);
    s.getRange(player.rowIndex, 1).setValue(token);
    s.getRange(player.rowIndex, 7, 1, 4).setValues([[hashPin_(newPin, salt), salt, 0, '']]);

    return { ok: true, token: token, name: player.name };
  } finally {
    lock.releaseLock();
  }
}


/**
 * Yours: clears a player's PIN so they can set a new one at the
 * next sign-in. Their cash and positions are untouched.
 */
function apiResetPin_(body) {
  if (String(body.adminPin || '') !== String(MARKET.ADMIN_PIN)) {
    return { ok: false, error: 'Admin code is not right.' };
  }

  var name = cleanName_(body.name);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var player = findPlayerByName_(name);
    if (!player) return { ok: false, error: 'No one by that name.' };

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PLAYERS)
      .getRange(player.rowIndex, 7, 1, 4).setValues([['', '', 0, '']]);

    return { ok: true, message: player.name + ' can now set a new PIN at sign-in.' };
  } finally {
    lock.releaseLock();
  }
}


/* ---- sign-in helpers ---- */

function cleanName_(v) {
  return String(v || '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

function checkPin_(pin) {
  if (!/^\d+$/.test(pin)) return 'Your PIN must be numbers only.';
  if (pin.length < MARKET.PIN_MIN || pin.length > MARKET.PIN_MAX) {
    return 'Your PIN must be ' + MARKET.PIN_MIN + ' to ' + MARKET.PIN_MAX + ' digits.';
  }
  if (/^(\d)\1+$/.test(pin)) return 'Please choose a less obvious PIN.';
  return '';
}

/** Salted SHA-256 — the sheet never holds anybody's PIN in the clear. */
function hashPin_(pin, salt) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(salt) + '::' + String(pin), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ((b < 0 ? b + 256 : b) + 0x100).toString(16).slice(1);
  }).join('');
}

function registerFailure_(player) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PLAYERS);
  var failed = player.failed + 1;
  var until = '';

  if (failed >= MARKET.MAX_ATTEMPTS) {
    until = new Date(Date.now() + MARKET.LOCKOUT_MINUTES * 60000);
    failed = 0;
  }
  s.getRange(player.rowIndex, 9, 1, 2).setValues([[failed, until]]);
}


/** Buys or sells, at the current price, against the player's cash. */
function apiTrade_(body) {
  var token = String(body.token || '').trim();
  var side = String(body.side || '').toLowerCase();
  var symbol = String(body.symbol || '').trim().toUpperCase();
  var qty = Math.floor(num_(body.qty));

  if (side !== 'buy' && side !== 'sell') return { ok: false, error: 'Choose buy or sell.' };
  if (!(qty > 0)) return { ok: false, error: 'Enter a whole number of shares.' };
  if (qty > 1000000) return { ok: false, error: 'That quantity is too large.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var player = findPlayer_(token);
    if (!player) return { ok: false, error: 'unknown-player' };

    var quotes = getQuotes_();
    var quote = quotes[symbol];
    if (!quote || !quote.tradeable) return { ok: false, error: 'That symbol is not in the league.' };
    if (!(quote.price > 0)) return { ok: false, error: 'No price available for ' + symbol + ' right now.' };

    var price = quote.price;
    var value = round2_(qty * price);
    var commission = MARKET.COMMISSION;
    var holding = findHolding_(token, symbol);

    if (side === 'buy') {
      var cost = value + commission;
      if (cost > player.cash + 0.005) {
        return {
          ok: false,
          error: 'Not enough cash. That costs ' + money_(cost) + ' and you have ' + money_(player.cash) + '.'
        };
      }
      setCash_(player.rowIndex, player.cash - cost);

      if (holding) {
        var newQty = holding.qty + qty;
        var newAvg = ((holding.qty * holding.avgCost) + value) / newQty;
        setHolding_(holding.rowIndex, newQty, newAvg);
      } else {
        addHolding_(token, symbol, qty, price);
      }
      player.cash -= cost;

    } else {
      if (!holding || holding.qty < qty) {
        return { ok: false, error: 'You only hold ' + (holding ? holding.qty : 0) + ' share(s) of ' + symbol + '.' };
      }
      var proceeds = value - commission;
      setCash_(player.rowIndex, player.cash + proceeds);

      var left = holding.qty - qty;
      if (left === 0) removeHolding_(holding.rowIndex);
      else setHolding_(holding.rowIndex, left, holding.avgCost);
      player.cash += proceeds;
    }

    logTrade_(token, player.name, side, symbol, qty, price, value, commission, player.cash);

    return {
      ok: true,
      side: side,
      symbol: symbol,
      qty: qty,
      price: price,
      value: value,
      commission: commission,
      cash: round2_(player.cash)
    };
  } finally {
    lock.releaseLock();
  }
}


/** Wipes players, holdings and trades so a new round can start. */
function apiReset_(body) {
  if (String(body.pin || '') !== String(MARKET.ADMIN_PIN)) {
    return { ok: false, error: 'Admin code is not right.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    [MARKET.TAB_PLAYERS, MARKET.TAB_HOLDINGS, MARKET.TAB_TRADES].forEach(function (name) {
      var s = ss.getSheetByName(name);
      if (s && s.getLastRow() > 1) {
        s.deleteRows(2, s.getLastRow() - 1);
      }
    });
    return { ok: true, message: 'League reset. Everyone starts again at ' + money_(MARKET.STARTING_CASH) + '.' };
  } finally {
    lock.releaseLock();
  }
}


/* ============================================================
 *  SHEET HELPERS
 * ========================================================== */

function readPlayers_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PLAYERS);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 10).getValues().map(function (r, i) {
    return {
      rowIndex: i + 2,
      token: String(r[0] || ''),
      name: String(r[1] || ''),
      email: String(r[2] || ''),
      cash: num_(r[3]),
      joined: r[4] ? new Date(r[4]).toISOString() : '',
      pinHash: String(r[6] || ''),
      salt: String(r[7] || ''),
      failed: num_(r[8]),
      lockedUntil: r[9] ? new Date(r[9]) : null
    };
  }).filter(function (p) { return p.name; });
}

function findPlayer_(token) {
  token = String(token || '').trim();
  if (!token) return null;
  var found = readPlayers_().filter(function (p) { return p.token === token; });
  return found.length ? found[0] : null;
}

function findPlayerByName_(name) {
  var lower = name.toLowerCase();
  var found = readPlayers_().filter(function (p) { return p.name.toLowerCase() === lower; });
  return found.length ? found[0] : null;
}

function setCash_(rowIndex, cash) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PLAYERS)
    .getRange(rowIndex, 4).setValue(round2_(cash));
}

function touchPlayer_(token) {
  var p = findPlayer_(token);
  if (!p) return;
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_PLAYERS)
    .getRange(p.rowIndex, 6).setValue(new Date());
}

function readHoldings_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_HOLDINGS);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 4).getValues().map(function (r, i) {
    return {
      rowIndex: i + 2,
      token: String(r[0] || ''),
      symbol: String(r[1] || '').toUpperCase(),
      qty: num_(r[2]),
      avgCost: num_(r[3])
    };
  }).filter(function (h) { return h.token && h.symbol && h.qty > 0; });
}

function findHolding_(token, symbol) {
  var found = readHoldings_().filter(function (h) {
    return h.token === token && h.symbol === symbol;
  });
  return found.length ? found[0] : null;
}

function addHolding_(token, symbol, qty, avgCost) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_HOLDINGS)
    .appendRow([token, symbol, qty, round2_(avgCost)]);
}

function setHolding_(rowIndex, qty, avgCost) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_HOLDINGS)
    .getRange(rowIndex, 3, 1, 2).setValues([[qty, round2_(avgCost)]]);
}

function removeHolding_(rowIndex) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_HOLDINGS)
    .deleteRow(rowIndex);
}

function logTrade_(token, name, side, symbol, qty, price, value, commission, cashAfter) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_TRADES)
    .appendRow([new Date(), token, name, side.toUpperCase(), symbol, qty,
                round2_(price), round2_(value), commission, round2_(cashAfter)]);
}

function readTrades_(token, limit) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MARKET.TAB_TRADES);
  if (!s || s.getLastRow() < 2) return [];

  var all = s.getRange(2, 1, s.getLastRow() - 1, 10).getValues();
  var mine = [];

  for (var i = all.length - 1; i >= 0 && mine.length < limit; i--) {
    if (String(all[i][1]) !== token) continue;
    mine.push({
      at: all[i][0] ? new Date(all[i][0]).toISOString() : '',
      side: String(all[i][3] || ''),
      symbol: String(all[i][4] || ''),
      qty: num_(all[i][5]),
      price: round2_(num_(all[i][6])),
      value: round2_(num_(all[i][7]))
    });
  }
  return mine;
}


/* ============================================================
 *  SMALL HELPERS
 * ========================================================== */

function makeToken_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 20);
}

function num_(v) {
  var n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

function round2_(n) {
  return Math.round(num_(n) * 100) / 100;
}

function money_(v) {
  return '$' + num_(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}


/* ============================================================
 *  CHECKS — run these from the editor, not from the web app
 * ========================================================== */

/** Confirms GOOGLEFINANCE is returning prices for everything. */
function testPrices() {
  var quotes = getQuotes_();
  var expected = INDICES.concat(UNIVERSE);
  var missing = expected.filter(function (i) { return !quotes[i.symbol]; })
                        .map(function (i) { return i.symbol; });

  Logger.log('Priced: %s of %s', Object.keys(quotes).length, expected.length);
  if (missing.length) {
    Logger.log('No price yet for: %s', missing.join(', '));
    Logger.log('Give the sheet a minute to calculate, then run this again.');
  } else {
    Logger.log('Every instrument has a price.');
  }
  Object.keys(quotes).forEach(function (k) {
    Logger.log('%s  %s  %s%%', k, money_(quotes[k].price), quotes[k].pct);
  });
}

/** Prints the leaderboard as the web app would return it. */
function testLeague() {
  Logger.log(JSON.stringify(apiLeague_(), null, 2));
}
