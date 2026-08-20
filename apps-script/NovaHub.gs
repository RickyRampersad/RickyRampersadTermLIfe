/**
 * NovaHub Agent Data API → Google Sheets importer
 *
 * Pulls the branch feeds out of Guardian's NovaHub Agent Data API and lands
 * them on their own tabs, so the manager's book can be filtered, charted and
 * cross-referenced against the renewal pipeline that already lives in this
 * spreadsheet.
 *
 *   Agent Activities   → GetManagerBranchActivities
 *   Agent Opportunities → GetManagerBranchOpportunities
 *
 * WHY A SCRIPT AND NOT =IMPORTDATA()
 *   The sheet formulas (IMPORTDATA, IMPORTXML, IMPORTHTML) cannot send an
 *   API key or a bearer token — they issue a bare anonymous GET. NovaHub is
 *   authenticated, so the request has to come from UrlFetchApp, where the
 *   credentials can travel in the headers.
 *
 * WHERE THE CREDENTIALS LIVE
 *   Script Properties ONLY — never in this file, never in a cell. This
 *   repository is served on the public website, so a key committed here is a
 *   key published to the world (that has already happened once to the staff
 *   key; see CONFIG.STAFF_KEY in Code.gs).
 *
 *     Extensions → Apps Script → Project Settings (⚙) → Script Properties
 *       NOVAHUB_KEY    = your company API key
 *       NOVAHUB_TOKEN  = your company token
 *       NOVAHUB_AUTH   = (optional) the winning style from the probe, e.g. bearer+key
 *
 * HOW NOVAHUB WANTS THEM
 *   Checked against the live service: an unauthenticated call answers
 *     401  WWW-Authenticate: Basic realm="novahub.myguardiangroup.com"
 *     {"Errors":["Basic Authentication required."],"StatusCode":401}
 *   and OPTIONS answers "Allow: GET". So these are plain GET calls carrying
 *   HTTP Basic credentials — your key as the username, your token as the
 *   password. That is what this script sends by default.
 *
 * FIRST RUN
 *   NovaHub menu → "1. Test the connection". It sends Basic first and, if the
 *   pair is rejected, tries the other orderings and header shapes, reports
 *   what each answered, and offers to remember whichever worked. Then run
 *   "2. Import agent activities" and, if you want it unattended,
 *   "4. Install daily sync (7am)".
 */

var NOVA = {
  BASE: 'https://novahub.myguardiangroup.com/AgentDataAPI/rest',

  FEEDS: {
    activities: {
      path: '/Activities/GetManagerBranchActivities',
      sheet: 'Agent Activities',
      label: 'agent activities',
    },
    opportunities: {
      path: '/Opportunities/GetManagerBranchOpportunities',
      sheet: 'Agent Opportunities',
      label: 'agent opportunities',
    },
  },

  // Some NovaHub endpoints want a date window and/or the branch/manager the
  // caller is asking about. Anything set here is sent as a query string on GET
  // and as a JSON body on POST. Leave a value '' and it is omitted entirely.
  // Fill these in only if the API rejects the call without them.
  PARAMS: {
    // branchCode: '',
    // managerId: '',
    // fromDate: '',   // or use NOVA.LOOKBACK_DAYS below
    // toDate: '',
  },

  // If the feed accepts a date window, these fill PARAMS.fromDate/toDate on
  // every run so the daily sync keeps moving forward. 0 = don't send dates.
  LOOKBACK_DAYS: 0,
  DATE_FORMAT: 'yyyy-MM-dd',

  // Confirmed against the live service: OPTIONS returns "Allow: GET", so these
  // routes are GET-only. Kept configurable, and a 405 flips to POST once, in
  // case another NovaHub method differs.
  METHOD: 'get',

  TIMEOUT_NOTE: 'NovaHub did not answer. If this keeps happening the API may ' +
                'only accept calls from inside the Guardian network, which ' +
                'Apps Script is not — ask IT whether Google servers are allowed.',
};

/* ============================ credentials ============================ */

function novaCreds_() {
  var p = PropertiesService.getScriptProperties();
  var key = (p.getProperty('NOVAHUB_KEY') || '').trim();
  var token = (p.getProperty('NOVAHUB_TOKEN') || '').trim();
  if (!key && !token) {
    throw new Error(
      'No NovaHub credentials found.\n\n' +
      'Add them in Project Settings (⚙) → Script Properties:\n' +
      '  NOVAHUB_KEY = your company API key\n' +
      '  NOVAHUB_TOKEN = your company token\n\n' +
      'Never put them in this file or in a cell — this project is published ' +
      'to the public website.');
  }
  return { key: key, token: token };
}

function novaAuthStyle_() {
  return (PropertiesService.getScriptProperties().getProperty('NOVAHUB_AUTH') || '').trim();
}

/* NovaHub states its own requirement: an unauthenticated call answers
 *   401  WWW-Authenticate: Basic realm="novahub.myguardiangroup.com"
 *   {"Errors":["Basic Authentication required."],"StatusCode":401}
 * so HTTP Basic is first and is the default. Your key is the username and
 * your token is the password (if it refuses, swap them — some issuers hand
 * the pair out in the other order).
 *
 * The rest of the list stays as a fallback for other NovaHub methods, or if
 * the gateway is ever changed; the probe walks it and remembers what works. */
var NOVA_AUTH_STYLES = [
  { id: 'basic',        note: 'HTTP Basic — key as username, token as password  ← what NovaHub asks for',
    headers: function (c) { return { 'Authorization': 'Basic ' + Utilities.base64Encode(c.key + ':' + c.token) }; } },
  { id: 'basic-swap',   note: 'HTTP Basic — token as username, key as password',
    headers: function (c) { return { 'Authorization': 'Basic ' + Utilities.base64Encode(c.token + ':' + c.key) }; } },
  { id: 'bearer+key',   note: 'Bearer token + x-api-key',
    headers: function (c) { return { 'Authorization': 'Bearer ' + c.token, 'x-api-key': c.key }; } },
  { id: 'bearer',       note: 'Bearer token only',
    headers: function (c) { return { 'Authorization': 'Bearer ' + c.token }; } },
  { id: 'key',          note: 'x-api-key only',
    headers: function (c) { return { 'x-api-key': c.key }; } },
  { id: 'apikey+token', note: 'apikey + token headers',
    headers: function (c) { return { 'apikey': c.key, 'token': c.token }; } },
  { id: 'authtoken',    note: 'AuthToken header (common on .NET REST services)',
    headers: function (c) { return { 'AuthToken': c.token, 'ApiKey': c.key }; } },
  { id: 'apim',         note: 'Azure API Management subscription key + Bearer',
    headers: function (c) { return { 'Ocp-Apim-Subscription-Key': c.key, 'Authorization': 'Bearer ' + c.token }; } },
  { id: 'query',        note: 'key and token as query-string parameters',
    headers: function () { return {}; },
    query: function (c) { return { key: c.key, token: c.token }; } },
];

function novaStyleById_(id) {
  for (var i = 0; i < NOVA_AUTH_STYLES.length; i++)
    if (NOVA_AUTH_STYLES[i].id === id) return NOVA_AUTH_STYLES[i];
  return null;
}

/* ============================ the request ============================ */

function novaParams_() {
  var out = {};
  for (var k in NOVA.PARAMS) if (String(NOVA.PARAMS[k] || '') !== '') out[k] = NOVA.PARAMS[k];
  if (NOVA.LOOKBACK_DAYS > 0 && !out.fromDate) {
    var tz = Session.getScriptTimeZone();
    var to = new Date();
    var from = new Date(to.getTime() - NOVA.LOOKBACK_DAYS * 86400000);
    out.fromDate = Utilities.formatDate(from, tz, NOVA.DATE_FORMAT);
    out.toDate = Utilities.formatDate(to, tz, NOVA.DATE_FORMAT);
  }
  return out;
}

function novaQueryString_(params) {
  var parts = [];
  for (var k in params)
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
  return parts.length ? '?' + parts.join('&') : '';
}

/* One call. Returns { code, body, url } and never throws on an HTTP error —
 * the caller decides what a non-200 means. Credentials are never logged. */
function novaFetch_(feed, style, method) {
  var creds = novaCreds_();
  var params = novaParams_();
  if (style.query) {
    var q = style.query(creds);
    for (var k in q) params[k] = q[k];
  }

  var url = NOVA.BASE + feed.path;
  var opts = {
    method: method || NOVA.METHOD,
    headers: style.headers(creds),
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true,
  };
  opts.headers['Accept'] = 'application/json';

  if (String(opts.method).toLowerCase() === 'post') {
    opts.contentType = 'application/json';
    opts.payload = JSON.stringify(params);
  } else {
    url += novaQueryString_(params);
  }

  var resp = UrlFetchApp.fetch(url, opts);
  return { code: resp.getResponseCode(), body: resp.getContentText(), url: url };
}

/* GET first; if the service says "method not allowed", try POST once. */
function novaFetchSmart_(feed, style) {
  var r = novaFetch_(feed, style, NOVA.METHOD);
  if (r.code === 405) r = novaFetch_(feed, style, NOVA.METHOD.toLowerCase() === 'get' ? 'post' : 'get');
  return r;
}

/* ============================ shaping the rows ============================ */

/* NovaHub may hand back a bare array, or wrap it — {d:[…]}, {Data:[…]},
 * {Result:{Activities:[…]}}. Find the first array of objects, wherever it is. */
function novaRows_(parsed) {
  if (Array.isArray(parsed)) return parsed;
  var seen = 0;
  function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > 4 || seen++ > 400) return null;
    if (Array.isArray(node))
      return (node.length && typeof node[0] === 'object') ? node : (node.length ? node : null);
    for (var k in node) {
      var hit = walk(node[k], depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  return walk(parsed, 0) || [];
}

/* Nested objects become dotted columns (client.name → "client.name") so no
 * field is silently dropped just because the API nests it. */
function novaFlatten_(obj, prefix, out) {
  out = out || {};
  prefix = prefix || '';
  if (obj === null || typeof obj !== 'object') { out[prefix || 'value'] = obj; return out; }
  for (var k in obj) {
    var v = obj[k];
    var name = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) novaFlatten_(v, name, out);
    else if (Array.isArray(v)) out[name] = v.map(function (x) {
      return (x && typeof x === 'object') ? JSON.stringify(x) : x;
    }).join(' · ');
    else out[name] = v;
  }
  return out;
}

/* Column order follows the first record, then any extra fields later records
 * introduce — so a row with one unusual field can't shift every other column. */
function novaHeaders_(flatRows) {
  var headers = [], seen = {};
  flatRows.forEach(function (r) {
    for (var k in r) if (!seen[k]) { seen[k] = true; headers.push(k); }
  });
  return headers;
}

/* Dates arrive as ISO strings or as .NET "/Date(1699999999000)/" ticks.
 * Convert both, so the columns sort and chart as real dates. */
function novaCell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  var s = String(v);
  var dotNet = s.match(/^\/Date\((-?\d+)([+-]\d{4})?\)\/$/);
  if (dotNet) return new Date(Number(dotNet[1]));
  var iso = s.match(/^(\d{4})-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/);
  // The year guard keeps a hyphenated policy or reference number from being
  // silently converted into a date in the year 1234.
  if (iso && Number(iso[1]) >= 1900 && Number(iso[1]) <= 2200) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return s;
}

/* ============================ the import ============================ */

function importAgentActivities()    { return novaImport_('activities'); }
function importAgentOpportunities() { return novaImport_('opportunities'); }

function novaImport_(feedKey, silent) {
  var feed = NOVA.FEEDS[feedKey];
  if (!feed) throw new Error('Unknown NovaHub feed: ' + feedKey);

  var styleId = novaAuthStyle_();
  var style = styleId ? novaStyleById_(styleId) : null;
  // Nothing remembered yet — use HTTP Basic, which is what NovaHub's own 401
  // asks for, and let the error message point at the probe if it isn't right.
  if (!style) style = NOVA_AUTH_STYLES[0];

  var r = novaFetchSmart_(feed, style);

  if (r.code === 401 || r.code === 403) {
    throw new Error(
      'NovaHub refused the credentials (HTTP ' + r.code + ') using the "' +
      style.id + '" style.\n\nRun NovaHub → "1. Test the connection" to find ' +
      'the style this API expects, or check that the key and token in Script ' +
      'Properties are current.');
  }
  if (r.code !== 200) {
    throw new Error('NovaHub returned HTTP ' + r.code + ' for ' + feed.label +
                    '.\n\n' + novaSnippet_(r.body));
  }

  var parsed;
  try {
    parsed = JSON.parse(r.body);
  } catch (err) {
    throw new Error('NovaHub answered 200 but the body is not JSON — this is ' +
                    'usually a login page, which means the credentials were ' +
                    'not accepted.\n\n' + novaSnippet_(r.body));
  }

  // NovaHub wraps every reply as {..., "Errors": [...], "StatusCode": n} and
  // can report a failure inside a 200, so the envelope is checked too.
  if (parsed && parsed.Errors && parsed.Errors.length) {
    throw new Error('NovaHub reported: ' + parsed.Errors.join(' · ') +
                    (parsed.StatusCode ? ' (StatusCode ' + parsed.StatusCode + ')' : ''));
  }

  var rows = novaRows_(parsed);
  var flat = rows.map(function (x) {
    return (x && typeof x === 'object') ? novaFlatten_(x) : { value: x };
  });
  var headers = novaHeaders_(flat);

  var sh = ss_().getSheetByName(feed.sheet);
  if (!sh) sh = ss_().insertSheet(feed.sheet);
  sh.clear();

  if (!headers.length) {
    sh.getRange(1, 1).setValue('NovaHub returned no ' + feed.label + ' for this request.');
    novaStamp_(feedKey, 0);
    if (!silent) SpreadsheetApp.getUi().alert('NovaHub answered, but there were no ' +
      feed.label + ' in the response.\n\nIf you expected rows, the endpoint may ' +
      'need a branch code or a date range — see NOVA.PARAMS in NovaHub.gs.');
    return 0;
  }

  var body = flat.map(function (rec) {
    return headers.map(function (h) { return novaCell_(rec[h]); });
  });

  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground(BRAND.navy).setFontColor('#ffffff');
  if (body.length) sh.getRange(2, 1, body.length, headers.length).setValues(body);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, Math.min(headers.length, 25));

  novaStamp_(feedKey, body.length);
  if (!silent) SpreadsheetApp.getUi().alert(
    'Imported ' + body.length + ' ' + feed.label + ' row(s) into "' + feed.sheet + '".');
  return body.length;
}

function novaStamp_(feedKey, count) {
  PropertiesService.getScriptProperties().setProperty(
    'NOVAHUB_LAST_' + feedKey.toUpperCase(),
    new Date().toISOString() + ' · ' + count + ' rows');
}

/* Was this response a genuine success? A 200 is not enough on its own: a
 * gateway can return a sign-in page, and NovaHub can report a failure inside
 * a 200 via its Errors array. */
function novaJudge_(r) {
  if (r.code !== 200) return { ok: false, why: '' };
  var b = String(r.body || '');
  if (b.indexOf('<html') !== -1 || b.indexOf('<!DOCTYPE') !== -1)
    return { ok: false, why: 'sign-in page, not data' };
  var parsed;
  try { parsed = JSON.parse(b); }
  catch (err) { return { ok: false, why: 'not JSON' }; }
  if (parsed && parsed.Errors && parsed.Errors.length)
    return { ok: false, why: String(parsed.Errors[0]).slice(0, 60) };
  return { ok: true, why: '', parsed: parsed };
}

/* Error bodies can be long HTML. Show enough to diagnose, never the request. */
function novaSnippet_(body) {
  var s = String(body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, 400) : '(empty response)';
}

/* ============================ connection probe ============================ */

/* Walks the auth styles against the Activities feed and reports what each one
 * answered, so you can see at a glance which shape NovaHub wants. */
function testNovaHubConnection() {
  var ui = SpreadsheetApp.getUi();
  var creds;
  try { creds = novaCreds_(); } catch (err) { ui.alert(String(err.message || err)); return; }

  var feed = NOVA.FEEDS.activities;
  var lines = [], winner = null;

  for (var i = 0; i < NOVA_AUTH_STYLES.length; i++) {
    var style = NOVA_AUTH_STYLES[i];
    if (style.id === 'bearer' && !creds.token) continue;
    if ((style.id === 'key' || style.id === 'apim') && !creds.key) continue;
    var r;
    try {
      r = novaFetchSmart_(feed, style);
    } catch (err) {
      lines.push('• ' + style.note + ' → could not connect (' + String(err.message || err).slice(0, 80) + ')');
      continue;
    }
    var judged = novaJudge_(r);
    lines.push('• ' + style.note + ' → HTTP ' + r.code +
               (judged.ok ? '  ✅' : (judged.why ? '  (' + judged.why + ')' : '')));
    if (judged.ok && !winner) winner = { style: style, parsed: judged.parsed };
  }

  if (!winner) {
    ui.alert('NovaHub connection test',
      'None of the usual key/token styles were accepted.\n\n' + lines.join('\n') +
      '\n\nWhat this usually means:\n' +
      '• 401/403 everywhere — the key or token is wrong, expired, or this ' +
      'endpoint needs a login call first to mint a session token.\n' +
      '• 404 everywhere — the path is right but the method needs parameters ' +
      '(branch code, date range); see NOVA.PARAMS in NovaHub.gs.\n' +
      '• Timeouts — NovaHub may only accept calls from inside the Guardian ' +
      'network. Google\'s servers are outside it; ask IT to allow them.\n\n' +
      'Send your NovaHub API contact this note and they can tell you which ' +
      'header they expect.', ui.ButtonSet.OK);
    return;
  }

  var rows = novaRows_(winner.parsed);
  var sample = rows.length && typeof rows[0] === 'object'
    ? Object.keys(novaFlatten_(rows[0])).slice(0, 12).join(', ')
    : '(no rows in this response)';

  var ans = ui.alert('NovaHub connection test',
    lines.join('\n') + '\n\n' +
    'Working style: ' + winner.style.note + '\n' +
    'Rows in this response: ' + rows.length + '\n' +
    'Fields: ' + sample + '\n\n' +
    'Remember this style for every future sync?', ui.ButtonSet.YES_NO);

  if (ans === ui.Button.YES) {
    PropertiesService.getScriptProperties().setProperty('NOVAHUB_AUTH', winner.style.id);
    ui.alert('Saved. Now run "2. Import agent activities".');
  }
}

/* ============================ automation ============================ */

function dailyNovaHubSync() {
  var out = [];
  ['activities', 'opportunities'].forEach(function (k) {
    try { out.push(k + ': ' + novaImport_(k, true) + ' rows'); }
    catch (err) { out.push(k + ': FAILED — ' + String(err.message || err).slice(0, 200)); }
  });
  Logger.log('NovaHub sync — ' + out.join(' | '));
}

function installNovaHubTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyNovaHubSync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyNovaHubSync').timeBased().atHour(7).everyDays(1).create();
  SpreadsheetApp.getUi().alert('NovaHub will now sync every morning around 7am.');
}

function showNovaHubStatus() {
  var p = PropertiesService.getScriptProperties();
  var style = novaAuthStyle_();
  SpreadsheetApp.getUi().alert('NovaHub sync status',
    'Auth style: ' + (style || '(not set — run the connection test)') + '\n' +
    'Key stored: ' + (p.getProperty('NOVAHUB_KEY') ? 'yes' : 'NO') + '\n' +
    'Token stored: ' + (p.getProperty('NOVAHUB_TOKEN') ? 'yes' : 'NO') + '\n\n' +
    'Last activities sync: ' + (p.getProperty('NOVAHUB_LAST_ACTIVITIES') || 'never') + '\n' +
    'Last opportunities sync: ' + (p.getProperty('NOVAHUB_LAST_OPPORTUNITIES') || 'never'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ============================ menu ============================ */
// Hook this into onOpen in Code.gs, the same way the property menu is hooked:
//   try { if (typeof novaHubMenu_ === 'function') novaHubMenu_(SpreadsheetApp.getUi()).addToUi(); } catch (err) { Logger.log(err); }

function novaHubMenu_(ui) {
  return ui.createMenu('📊 NovaHub')
    .addItem('1. Test the connection', 'testNovaHubConnection')
    .addItem('2. Import agent activities', 'importAgentActivities')
    .addItem('3. Import agent opportunities', 'importAgentOpportunities')
    .addSeparator()
    .addItem('4. Install daily sync (7am)', 'installNovaHubTrigger')
    .addItem('Sync status', 'showNovaHubStatus');
}
