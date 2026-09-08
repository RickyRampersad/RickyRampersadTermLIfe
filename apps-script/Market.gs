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
  { symbol: 'DJI',   google: 'INDEXDJX:.DJI',       name: 'Dow Jones Industrial Average' },
  { symbol: 'IXIC',  google: 'INDEXNASDAQ:.IXIC',   name: 'Nasdaq Composite' },
  { symbol: 'INX',   google: 'INDEXSP:.INX',        name: 'S&P 500' }
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
  { symbol: 'DIA',    google: 'DIA',    name: 'Dow Jones (DIA fund)',      group: 'Index trackers' },
  { symbol: 'QQQ',    google: 'QQQ',    name: 'Nasdaq 100 (QQQ fund)',     group: 'Index trackers' },
  { symbol: 'SPY',    google: 'SPY',    name: 'S&P 500 (SPY fund)',        group: 'Index trackers' },

  { symbol: 'AAPL',   google: 'AAPL',   name: 'Apple',                     group: 'Dow Jones 30' },
  { symbol: 'AMGN',   google: 'AMGN',   name: 'Amgen',                     group: 'Dow Jones 30' },
  { symbol: 'AMZN',   google: 'AMZN',   name: 'Amazon',                    group: 'Dow Jones 30' },
  { symbol: 'AXP',    google: 'AXP',    name: 'American Express',          group: 'Dow Jones 30' },
  { symbol: 'BA',     google: 'BA',     name: 'Boeing',                    group: 'Dow Jones 30' },
  { symbol: 'CAT',    google: 'CAT',    name: 'Caterpillar',               group: 'Dow Jones 30' },
  { symbol: 'CRM',    google: 'CRM',    name: 'Salesforce',                group: 'Dow Jones 30' },
  { symbol: 'CSCO',   google: 'CSCO',   name: 'Cisco',                     group: 'Dow Jones 30' },
  { symbol: 'CVX',    google: 'CVX',    name: 'Chevron',                   group: 'Dow Jones 30' },
  { symbol: 'DIS',    google: 'DIS',    name: 'Walt Disney',               group: 'Dow Jones 30' },
  { symbol: 'GS',     google: 'GS',     name: 'Goldman Sachs',             group: 'Dow Jones 30' },
  { symbol: 'HD',     google: 'HD',     name: 'Home Depot',                group: 'Dow Jones 30' },
  { symbol: 'HON',    google: 'HON',    name: 'Honeywell',                 group: 'Dow Jones 30' },
  { symbol: 'IBM',    google: 'IBM',    name: 'IBM',                       group: 'Dow Jones 30' },
  { symbol: 'JNJ',    google: 'JNJ',    name: 'Johnson & Johnson',         group: 'Dow Jones 30' },
  { symbol: 'JPM',    google: 'JPM',    name: 'JPMorgan Chase',            group: 'Dow Jones 30' },
  { symbol: 'KO',     google: 'KO',     name: 'Coca-Cola',                 group: 'Dow Jones 30' },
  { symbol: 'MCD',    google: 'MCD',    name: "McDonald's",                group: 'Dow Jones 30' },
  { symbol: 'MMM',    google: 'MMM',    name: '3M',                        group: 'Dow Jones 30' },
  { symbol: 'MRK',    google: 'MRK',    name: 'Merck',                     group: 'Dow Jones 30' },
  { symbol: 'MSFT',   google: 'MSFT',   name: 'Microsoft',                 group: 'Dow Jones 30' },
  { symbol: 'NKE',    google: 'NKE',    name: 'Nike',                      group: 'Dow Jones 30' },
  { symbol: 'NVDA',   google: 'NVDA',   name: 'NVIDIA',                    group: 'Dow Jones 30' },
  { symbol: 'PG',     google: 'PG',     name: 'Procter & Gamble',          group: 'Dow Jones 30' },
  { symbol: 'SHW',    google: 'SHW',    name: 'Sherwin-Williams',          group: 'Dow Jones 30' },
  { symbol: 'TRV',    google: 'TRV',    name: 'Travelers',                 group: 'Dow Jones 30' },
  { symbol: 'UNH',    google: 'UNH',    name: 'UnitedHealth',              group: 'Dow Jones 30' },
  { symbol: 'V',      google: 'V',      name: 'Visa',                      group: 'Dow Jones 30' },
  { symbol: 'VZ',     google: 'VZ',     name: 'Verizon',                   group: 'Dow Jones 30' },
  { symbol: 'WMT',    google: 'WMT',    name: 'Walmart',                   group: 'Dow Jones 30' },

  { symbol: 'ABNB',   google: 'ABNB',   name: 'Airbnb',                    group: 'Nasdaq 100' },
  { symbol: 'ADBE',   google: 'ADBE',   name: 'Adobe',                     group: 'Nasdaq 100' },
  { symbol: 'ADI',    google: 'ADI',    name: 'Analog Devices',            group: 'Nasdaq 100' },
  { symbol: 'ADP',    google: 'ADP',    name: 'ADP',                       group: 'Nasdaq 100' },
  { symbol: 'ADSK',   google: 'ADSK',   name: 'Autodesk',                  group: 'Nasdaq 100' },
  { symbol: 'AEP',    google: 'AEP',    name: 'American Electric Power',   group: 'Nasdaq 100' },
  { symbol: 'AMAT',   google: 'AMAT',   name: 'Applied Materials',         group: 'Nasdaq 100' },
  { symbol: 'AMD',    google: 'AMD',    name: 'AMD',                       group: 'Nasdaq 100' },
  { symbol: 'ANSS',   google: 'ANSS',   name: 'Ansys',                     group: 'Nasdaq 100' },
  { symbol: 'APP',    google: 'APP',    name: 'AppLovin',                  group: 'Nasdaq 100' },
  { symbol: 'ARM',    google: 'ARM',    name: 'Arm Holdings',              group: 'Nasdaq 100' },
  { symbol: 'ASML',   google: 'ASML',   name: 'ASML',                      group: 'Nasdaq 100' },
  { symbol: 'AVGO',   google: 'AVGO',   name: 'Broadcom',                  group: 'Nasdaq 100' },
  { symbol: 'AXON',   google: 'AXON',   name: 'Axon Enterprise',           group: 'Nasdaq 100' },
  { symbol: 'AZN',    google: 'AZN',    name: 'AstraZeneca',               group: 'Nasdaq 100' },
  { symbol: 'BIIB',   google: 'BIIB',   name: 'Biogen',                    group: 'Nasdaq 100' },
  { symbol: 'BKNG',   google: 'BKNG',   name: 'Booking Holdings',          group: 'Nasdaq 100' },
  { symbol: 'BKR',    google: 'BKR',    name: 'Baker Hughes',              group: 'Nasdaq 100' },
  { symbol: 'CDNS',   google: 'CDNS',   name: 'Cadence Design',            group: 'Nasdaq 100' },
  { symbol: 'CDW',    google: 'CDW',    name: 'CDW',                       group: 'Nasdaq 100' },
  { symbol: 'CEG',    google: 'CEG',    name: 'Constellation Energy',      group: 'Nasdaq 100' },
  { symbol: 'CHTR',   google: 'CHTR',   name: 'Charter Communications',    group: 'Nasdaq 100' },
  { symbol: 'CMCSA',  google: 'CMCSA',  name: 'Comcast',                   group: 'Nasdaq 100' },
  { symbol: 'COST',   google: 'COST',   name: 'Costco',                    group: 'Nasdaq 100' },
  { symbol: 'CPRT',   google: 'CPRT',   name: 'Copart',                    group: 'Nasdaq 100' },
  { symbol: 'CRWD',   google: 'CRWD',   name: 'CrowdStrike',               group: 'Nasdaq 100' },
  { symbol: 'CSGP',   google: 'CSGP',   name: 'CoStar Group',              group: 'Nasdaq 100' },
  { symbol: 'CSX',    google: 'CSX',    name: 'CSX',                       group: 'Nasdaq 100' },
  { symbol: 'CTAS',   google: 'CTAS',   name: 'Cintas',                    group: 'Nasdaq 100' },
  { symbol: 'CTSH',   google: 'CTSH',   name: 'Cognizant',                 group: 'Nasdaq 100' },
  { symbol: 'DASH',   google: 'DASH',   name: 'DoorDash',                  group: 'Nasdaq 100' },
  { symbol: 'DDOG',   google: 'DDOG',   name: 'Datadog',                   group: 'Nasdaq 100' },
  { symbol: 'DXCM',   google: 'DXCM',   name: 'DexCom',                    group: 'Nasdaq 100' },
  { symbol: 'EA',     google: 'EA',     name: 'Electronic Arts',           group: 'Nasdaq 100' },
  { symbol: 'EXC',    google: 'EXC',    name: 'Exelon',                    group: 'Nasdaq 100' },
  { symbol: 'FANG',   google: 'FANG',   name: 'Diamondback Energy',        group: 'Nasdaq 100' },
  { symbol: 'FAST',   google: 'FAST',   name: 'Fastenal',                  group: 'Nasdaq 100' },
  { symbol: 'FTNT',   google: 'FTNT',   name: 'Fortinet',                  group: 'Nasdaq 100' },
  { symbol: 'GEHC',   google: 'GEHC',   name: 'GE HealthCare',             group: 'Nasdaq 100' },
  { symbol: 'GFS',    google: 'GFS',    name: 'GlobalFoundries',           group: 'Nasdaq 100' },
  { symbol: 'GILD',   google: 'GILD',   name: 'Gilead Sciences',           group: 'Nasdaq 100' },
  { symbol: 'GOOGL',  google: 'GOOGL',  name: 'Alphabet (Google)',         group: 'Nasdaq 100' },
  { symbol: 'IDXX',   google: 'IDXX',   name: 'IDEXX Laboratories',        group: 'Nasdaq 100' },
  { symbol: 'INTC',   google: 'INTC',   name: 'Intel',                     group: 'Nasdaq 100' },
  { symbol: 'INTU',   google: 'INTU',   name: 'Intuit',                    group: 'Nasdaq 100' },
  { symbol: 'ISRG',   google: 'ISRG',   name: 'Intuitive Surgical',        group: 'Nasdaq 100' },
  { symbol: 'KDP',    google: 'KDP',    name: 'Keurig Dr Pepper',          group: 'Nasdaq 100' },
  { symbol: 'KHC',    google: 'KHC',    name: 'Kraft Heinz',               group: 'Nasdaq 100' },
  { symbol: 'KLAC',   google: 'KLAC',   name: 'KLA Corporation',           group: 'Nasdaq 100' },
  { symbol: 'LIN',    google: 'LIN',    name: 'Linde',                     group: 'Nasdaq 100' },
  { symbol: 'LRCX',   google: 'LRCX',   name: 'Lam Research',              group: 'Nasdaq 100' },
  { symbol: 'LULU',   google: 'LULU',   name: 'Lululemon',                 group: 'Nasdaq 100' },
  { symbol: 'MAR',    google: 'MAR',    name: 'Marriott',                  group: 'Nasdaq 100' },
  { symbol: 'MCHP',   google: 'MCHP',   name: 'Microchip Technology',      group: 'Nasdaq 100' },
  { symbol: 'MDLZ',   google: 'MDLZ',   name: 'Mondelez',                  group: 'Nasdaq 100' },
  { symbol: 'MELI',   google: 'MELI',   name: 'MercadoLibre',              group: 'Nasdaq 100' },
  { symbol: 'META',   google: 'META',   name: 'Meta (Facebook)',           group: 'Nasdaq 100' },
  { symbol: 'MNST',   google: 'MNST',   name: 'Monster Beverage',          group: 'Nasdaq 100' },
  { symbol: 'MRVL',   google: 'MRVL',   name: 'Marvell Technology',        group: 'Nasdaq 100' },
  { symbol: 'MU',     google: 'MU',     name: 'Micron Technology',         group: 'Nasdaq 100' },
  { symbol: 'NFLX',   google: 'NFLX',   name: 'Netflix',                   group: 'Nasdaq 100' },
  { symbol: 'NXPI',   google: 'NXPI',   name: 'NXP Semiconductors',        group: 'Nasdaq 100' },
  { symbol: 'ODFL',   google: 'ODFL',   name: 'Old Dominion Freight',      group: 'Nasdaq 100' },
  { symbol: 'ON',     google: 'ON',     name: 'ON Semiconductor',          group: 'Nasdaq 100' },
  { symbol: 'ORLY',   google: 'ORLY',   name: "O'Reilly Automotive",       group: 'Nasdaq 100' },
  { symbol: 'PANW',   google: 'PANW',   name: 'Palo Alto Networks',        group: 'Nasdaq 100' },
  { symbol: 'PAYX',   google: 'PAYX',   name: 'Paychex',                   group: 'Nasdaq 100' },
  { symbol: 'PCAR',   google: 'PCAR',   name: 'PACCAR',                    group: 'Nasdaq 100' },
  { symbol: 'PDD',    google: 'PDD',    name: 'PDD Holdings',              group: 'Nasdaq 100' },
  { symbol: 'PEP',    google: 'PEP',    name: 'PepsiCo',                   group: 'Nasdaq 100' },
  { symbol: 'PLTR',   google: 'PLTR',   name: 'Palantir',                  group: 'Nasdaq 100' },
  { symbol: 'PYPL',   google: 'PYPL',   name: 'PayPal',                    group: 'Nasdaq 100' },
  { symbol: 'QCOM',   google: 'QCOM',   name: 'Qualcomm',                  group: 'Nasdaq 100' },
  { symbol: 'REGN',   google: 'REGN',   name: 'Regeneron',                 group: 'Nasdaq 100' },
  { symbol: 'ROP',    google: 'ROP',    name: 'Roper Technologies',        group: 'Nasdaq 100' },
  { symbol: 'ROST',   google: 'ROST',   name: 'Ross Stores',               group: 'Nasdaq 100' },
  { symbol: 'SBUX',   google: 'SBUX',   name: 'Starbucks',                 group: 'Nasdaq 100' },
  { symbol: 'SNPS',   google: 'SNPS',   name: 'Synopsys',                  group: 'Nasdaq 100' },
  { symbol: 'TEAM',   google: 'TEAM',   name: 'Atlassian',                 group: 'Nasdaq 100' },
  { symbol: 'TMUS',   google: 'TMUS',   name: 'T-Mobile',                  group: 'Nasdaq 100' },
  { symbol: 'TSLA',   google: 'TSLA',   name: 'Tesla',                     group: 'Nasdaq 100' },
  { symbol: 'TTD',    google: 'TTD',    name: 'The Trade Desk',            group: 'Nasdaq 100' },
  { symbol: 'TTWO',   google: 'TTWO',   name: 'Take-Two Interactive',      group: 'Nasdaq 100' },
  { symbol: 'TXN',    google: 'TXN',    name: 'Texas Instruments',         group: 'Nasdaq 100' },
  { symbol: 'VRSK',   google: 'VRSK',   name: 'Verisk Analytics',          group: 'Nasdaq 100' },
  { symbol: 'VRTX',   google: 'VRTX',   name: 'Vertex Pharmaceuticals',    group: 'Nasdaq 100' },
  { symbol: 'WBD',    google: 'WBD',    name: 'Warner Bros. Discovery',    group: 'Nasdaq 100' },
  { symbol: 'WDAY',   google: 'WDAY',   name: 'Workday',                   group: 'Nasdaq 100' },
  { symbol: 'XEL',    google: 'XEL',    name: 'Xcel Energy',               group: 'Nasdaq 100' },
  { symbol: 'ZS',     google: 'ZS',     name: 'Zscaler',                   group: 'Nasdaq 100' }
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
