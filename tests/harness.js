// A fake Sheets that counts round trips, so "faster" is a number.
//
// Two kinds of script run against this: KPI.gs and its neighbours, which need
// Sheets and mail, and Recruiting.gs, which also needs Drive, a lock it can
// see the state of, a cache that expires, and an outbound fetch. Everything
// the second needs was added without changing what the first sees — the
// additions are either new services or opt-in through opts, so the tests that
// guard somebody's afternoon still measure what they measured before.
//
// opts:
//   gs            which script to load (or set GS_PATH; both take a
//                 comma-separated list for a project of several files)
//   strictGrid    enforce Google's real limits: a new sheet is 1000x26, a
//                 getRange past the grid throws rather than growing it, and a
//                 cell holds 50,000 characters. OFF by default, because the
//                 older tests pre-make wide tabs and were written without it.
//   props         seed for PropertiesService (alias: properties)
//   fetchHandler  (url, params) => ({ code, body }) for UrlFetchApp
//   now           starting clock for cache expiry, with __advance(seconds)
//   lockBusy      waitLock throws, as when another execution holds it
//   mailThrows    sendEmail throws, as when the daily quota is gone
const fs = require('fs'), vm = require('vm');

const MAX_CELL = 50000, DEFAULT_ROWS = 1000, DEFAULT_COLS = 26;

function makeEnv(opts = {}) {
  const strict = !!opts.strictGrid;
  let now = opts.now ? new Date(opts.now).getTime() : Date.now();
  const logs = [], fetches = [];
  const propMap = Object.assign({}, opts.props || opts.properties || {});
  let lockHeld = false;
  const cacheMap = {};
  const cacheStub = {
    get: k => {
      if (!(k in cacheMap)) return null;
      if (cacheMap[k].until <= now) { delete cacheMap[k]; return null; }
      return cacheMap[k].v;
    },
    // Google caps an entry at six hours however long you ask for. A token
    // written for twelve is gone at six, and a session that was supposed to
    // last the day ends halfway through the afternoon.
    put: (k, v, sec) => {
      const ttl = Math.min(Number(sec) || 21600, 21600);
      cacheMap[k] = { v: String(v), until: now + ttl * 1000 };
    },
    remove: k => { delete cacheMap[k]; },
    removeAll: ks => ks.forEach(k => delete cacheMap[k]),
    // bigPut_/bigGet_ and the wall cache write and read in batches; they go
    // through put/get so a batched entry expires exactly like a single one.
    putAll: (o, sec) => Object.keys(o).forEach(k => cacheStub.put(k, o[k], sec)),
    getAll: ks => { const r = {}; ks.forEach(k => { const v = cacheStub.get(k);
                    if (v !== null) r[k] = v; }); return r; }
  };
  const calls = { getValues: 0, getValue: 0, setValue: 0, setValues: 0, getLastRow: 0,
                  getLastColumn: 0, appendRow: 0, deleteRow: 0, mail: 0, fetch: 0 };
  const sheets = {};

  function mkSheet(name, id, headers, rows) {
    // A sheet that has just been inserted is empty — no rows at all, so the
    // first appendRow lands in row 1 and becomes the header. Modelling it as
    // one blank row put every generated tab's header in row 2, which nothing
    // caught because the tests pre-made their tabs.
    const grid = headers.length ? [headers.slice(), ...rows.map(r => r.slice())]
                                : rows.map(r => r.slice());
    // A tab somebody made by hand is as wide as its headers; one this script
    // inserts starts at Google's 26.
    let maxCols = Math.max(DEFAULT_COLS, headers.length);
    const bounds = (r, c, nr, nc) => {
      if (!strict) return;
      if (r < 1 || c < 1) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      if (c + nc - 1 > maxCols || r + nr - 1 > DEFAULT_ROWS) {
        throw new Error(`Range (${r},${c},${nr},${nc}) exceeds the grid limits (${DEFAULT_ROWS}x${maxCols}) of "${name}".`);
      }
    };
    const cap = (v, r, c) => {
      if (strict && typeof v === 'string' && v.length > MAX_CELL) {
        throw new Error(`Cell (${r},${c}) of "${name}": ${v.length} characters exceeds the 50,000 character limit.`);
      }
      return v;
    };
    const sh = {
      _grid: grid,
      getName: () => name,
      getSheetId: () => id,
      getLastRow: () => { calls.getLastRow++; return grid.length; },
      getLastColumn: () => { calls.getLastColumn++;
        return grid.length ? Math.max(...grid.map(r => r.length)) : 0; },
      getMaxColumns: () => maxCols,
      getMaxRows: () => DEFAULT_ROWS,
      insertColumnsAfter: (after, howMany) => {
        if (after < 1 || after > maxCols) throw new Error(`insertColumnsAfter: column ${after} is outside the grid.`);
        if (!(howMany >= 1)) throw new Error('insertColumnsAfter: howMany must be at least 1.');
        maxCols += howMany;
        return sh;
      },
      setFrozenRows: () => sh,
      appendRow: r => {
        calls.appendRow++;
        if (strict && r.length > maxCols) {
          throw new Error(`appendRow: ${r.length} values but "${name}" has ${maxCols} columns.`);
        }
        r.forEach((v, i) => cap(v, grid.length + 1, i + 1));
        grid.push(r.slice());
        return sh;
      },
      deleteRow: n => { calls.deleteRow++; grid.splice(n - 1, 1); return sh; },
      getRange: (r, c, nr = 1, nc = 1) => (bounds(r, c, nr, nc), {
        getValues() {
          calls.getValues++;
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = grid[r - 1 + i] || [];
            const seg = [];
            for (let j = 0; j < nc; j++) seg.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
            out.push(seg);
          }
          return out;
        },
        getValue() {
          calls.getValue++;
          const row = grid[r - 1] || [];
          return row[c - 1] === undefined ? '' : row[c - 1];
        },
        setValue(v) {
          calls.setValue++;
          cap(v, r, c);
          while (grid.length < r) grid.push([]);
          grid[r - 1][c - 1] = v;
          return this;
        },
        setValues(vals) {
          calls.setValues++;
          for (let i = 0; i < vals.length; i++) {
            while (grid.length < r + i) grid.push([]);
            for (let j = 0; j < vals[i].length; j++) {
              cap(vals[i][j], r + i, c + j);
              grid[r - 1 + i][c - 1 + j] = vals[i][j];
            }
          }
          return this;
        },
        setNumberFormat: () => {}, setFontWeight: () => {}, setBackground: () => {}
      })
    };
    sheets[name] = sh;
    return sh;
  }

  // ---- Drive ------------------------------------------------------------
  // Files are bytes in a map. What matters to the tests is that a file put
  // there comes back byte-for-byte, that replacing one trashes the old, and
  // that a trashed file is gone.
  const drive = { seq: 0, folders: new Map(), files: new Map(), roots: [] };
  const driveId = () => 'drive-' + (++drive.seq);
  function mkBlob(bytes, type, fname) {
    return { getBytes: () => bytes, getName: () => fname, getContentType: () => type };
  }
  function mkFile(id, bytes, type, fname, folder) {
    const f = { id, bytes, type, fname, folder, trashed: false,
      getId: () => id, getName: () => fname,
      getBlob: () => { if (f.trashed) throw new Error('File is in the trash.'); return mkBlob(bytes, type, fname); },
      setTrashed: v => { f.trashed = !!v; return f; } };
    return f;
  }
  function mkFolder(id, name) {
    const fo = { id, name, folders: [], files: [],
      getId: () => id, getName: () => name,
      getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      createFolder: n => { const c = mkFolder(driveId(), n); fo.folders.push(c); drive.folders.set(c.id, c); return c; },
      getFoldersByName: n => iter(fo.folders.filter(x => x.name === n)),
      createFile: blob => { const f = mkFile(driveId(), blob.getBytes(), blob.getContentType(), blob.getName(), fo);
        fo.files.push(f); drive.files.set(f.id, f); return f; } };
    return fo;
  }
  const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };

  const g = {
    console, JSON, Math, Date, String, Number, Boolean, Object, Array, RegExp, Error, isNaN, parseInt, parseFloat,
    Buffer,
    __calls: calls, __sheets: sheets, __mkSheet: mkSheet,
    __logs: logs, __fetches: fetches, __drive: drive, __props: propMap,
    __advance: sec => { now += sec * 1000; },
    __lockHeld: () => lockHeld,
    // Every data row of a tab as an object keyed by its header.
    __rows: name => {
      const sh = sheets[name];
      if (!sh || sh._grid.length < 2) return [];
      const head = sh._grid[0];
      return sh._grid.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
    },
    DriveApp: {
      createFolder: n => { const f = mkFolder(driveId(), n); drive.roots.push(f); drive.folders.set(f.id, f); return f; },
      getFoldersByName: n => iter(drive.roots.filter(f => f.name === n)),
      getFolderById: id => { const f = drive.folders.get(id); if (!f) throw new Error('No item with the given ID could be found: ' + id); return f; },
      getFileById: id => { const f = drive.files.get(id); if (!f || f.trashed) throw new Error('No item with the given ID could be found: ' + id); return f; }
    },
    SpreadsheetApp: {
      // Two names for one thing, and the two scripts use one each.
      getActiveSpreadsheet: () => g.SpreadsheetApp.getActive(),
      // Opening another workbook by ID hands back this same one, and says so.
      openById: id => { calls.openById = (calls.openById || []).concat(id); return g.SpreadsheetApp.getActive(); },
      getActive: () => ({
        getSheets: () => Object.values(sheets),
        getSheetByName: n => sheets[n] || null,
        insertSheet: n => mkSheet(n, Object.keys(sheets).length + 100, [], []),
        getSpreadsheetTimeZone: () => 'America/Port_of_Spain'
      })
    },
    LockService: { getScriptLock: () => ({
      waitLock: ms => { if (opts.lockBusy) throw new Error('Could not acquire lock');
                        if (lockHeld) throw new Error('Could not obtain lock within ' + ms + 'ms.');
                        lockHeld = true; },
      releaseLock: () => { lockHeld = false; },
      hasLock: () => lockHeld }) },
    CacheService: { getScriptCache: () => cacheStub },
    /* Enough of ContentService to drive doGet and doPost. Most tests call the
       handlers directly, but the web entry points are where two scripts
       sharing one project meet, and that seam is worth testing through. */
    ContentService: {
      MimeType: { JSON: 'application/json', TEXT: 'text/plain', HTML: 'text/html' },
      createTextOutput: t => ({ _t: String(t == null ? '' : t), _m: 'text/plain',
                                setMimeType(m) { this._m = m; return this; },
                                getMimeType() { return this._m; },
                                getContent() { return this._t; } })
    },
    /* A real little store, not a pair of stubs: a secret written on first
       use has to read back the same on the second, or every signature the
       script makes is a different one. */
    PropertiesService: (() => { const store = propMap;
      const api = { getProperty: k => (k in store ? store[k] : null),
                    setProperty: (k, v) => { store[k] = String(v); return api; },
                    deleteProperty: k => { delete store[k]; return api; },
                    getProperties: () => Object.assign({}, store) };
      return { getScriptProperties: () => api }; })(),
    Session: { getEffectiveUser: () => ({ getEmail: () => opts.email || 'ricky@example.com' }),
               getActiveUser:    () => ({ getEmail: () => opts.email || 'ricky@example.com' }) },
    MailApp: { sendEmail: () => { calls.mail++; if (opts.mailThrows) throw new Error('Service invoked too many times'); } },
    Utilities: {
      formatDate: (d, tz, f) => {
        const p = n => String(n).padStart(2, '0');
        if (f === 'HH:mm') return p(d.getHours()) + ':' + p(d.getMinutes());
        if (f === 'h a') { const h = d.getHours(); return ((h % 12) || 12) + ' ' + (h < 12 ? 'AM' : 'PM'); }
        if (f === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        // The day of the week, 1 Monday .. 7 Sunday, as housekeepingTick_ reads it.
        if (f === 'u') return String(d.getDay() || 7);
        // Every date a person reads is built in UTC by prettyDate_/shortDate_,
        // so an e-mail's own subject line stayed an ISO timestamp in tests and
        // nothing could assert on it.
        const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        if (f === 'EEE d MMM') return DAY[d.getUTCDay()].slice(0, 3) + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()].slice(0, 3);
        if (f === 'EEEE d MMMM yyyy') return DAY[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
        return d.toISOString();
      },
      parseDate: (s, tz, f) => new Date(String(s).replace(' ', 'T') + (String(s).length <= 16 ? ':00' : '')),
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2),
      base64Encode: s => Buffer.from(Array.isArray(s) ? s : String(s)).toString('base64'),
      base64Decode: s => Array.from(Buffer.from(String(s), 'base64')),
      newBlob: (bytes, type, name) => mkBlob(bytes, type, name),
      base64EncodeWebSafe: b => Buffer.from(Array.isArray(b) ? b : String(b))
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      /* Not real HMAC — a deterministic digest of the message and the key,
         which is what a signature has to be for a test to tell a good link
         from a forged one. */
      computeHmacSha256Signature: (msg, key) => {
        const s = String(key) + '|' + String(msg); const out = [];
        for (let i = 0; i < 32; i++) {
          let n = i * 31 + 7;
          for (let j = 0; j < s.length; j++) n = (n * 33 + s.charCodeAt(j) + i) & 0xff;
          out.push(n);
        }
        return out;
      }
    },
    UrlFetchApp: { fetch: (url, params) => {
      calls.fetch++;
      fetches.push({ url, params });
      if (!opts.fetchHandler) throw new Error('no network in harness');
      const r = opts.fetchHandler(url, params);
      return { getResponseCode: () => r.code, getContentText: () => r.body };
    } },
    /* Enough of HtmlService to read back what a page says. */
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
      createHtmlOutput: html => ({ _h: String(html == null ? '' : html),
                                   addMetaTag() { return this; },
                                   setXFrameOptionsMode() { return this; },
                                   setTitle() { return this; },
                                   getContent() { return this._h; } })
    },
    Logger: { log: m => logs.push(String(m)) },
    /* Enough of ScriptApp to count what an installer installs. Every builder
       method is accepted and remembered, so a test can say "five triggers,
       three of them daily" rather than only "it did not throw". */
    ScriptApp: (() => {
      const triggers = [];
      const builder = handler => {
        const t = { handler, chain: [] };
        const b = new Proxy({}, { get: (_, k) => k === 'create'
          ? () => { const rec = { getHandlerFunction: () => t.handler, chain: t.chain }; triggers.push(rec); return rec; }
          : (...a) => { t.chain.push(k + '(' + a.map(String).join(',') + ')'); return b; } });
        return b;
      };
      return {
        WeekDay: { MONDAY:'MONDAY', TUESDAY:'TUESDAY', WEDNESDAY:'WEDNESDAY', THURSDAY:'THURSDAY', FRIDAY:'FRIDAY', SATURDAY:'SATURDAY', SUNDAY:'SUNDAY' },
        getService: () => ({ getUrl: () => 'https://script.example/exec' }),
        getProjectTriggers: () => triggers.slice(),
        deleteTrigger: t => { const i = triggers.indexOf(t); if (i > -1) triggers.splice(i, 1); },
        newTrigger: handler => builder(handler)
      };
    })()
  };
  g.globalThis = g;
  vm.createContext(g);
  // GS_PATH may list several files, comma-separated, for a project of more
  // than one script (the RR Operations project is DeliveryBook.gs and LogBook.gs).
  String(opts.gs || process.env.GS_PATH || (__dirname + '/../apps-script/KPI.gs')).split(',').forEach(f =>
    new vm.Script(fs.readFileSync(f, 'utf8'), { filename: require('path').basename(f) }).runInContext(g));
  return g;
}
/* THE LIVE ORG'S OWN REFUSAL, kept so a test cannot pass a query the org
   would reject. Unit__c and AgentName__c on the portfolio objects are
   formula fields, and Salesforce will not GROUP BY a formula. The groups
   feed shipped on 17 September 2026 with three such queries, every test
   green, and the slide came up empty. A fake sfQuery_ calls this first. */
function refuseUngroupable(soql) {
  const m = String(soql).match(/GROUP BY\s+(.+)$/i);
  if (!m) return;
  const fields = m[1].split(/\s+(?:ORDER|LIMIT|HAVING)\b/i)[0].split(',').map(f => f.trim());
  const bad = fields.find(f => /^(Unit__c|AgentName__c)$/i.test(f));
  if (bad) throw new Error('Salesforce query failed: [{"message":"\\nERROR at Row:1:Column:1\\nfield \'' +
                           bad + '\' can not be grouped in a query call","errorCode":"MALFORMED_QUERY"}]');
}

module.exports = { makeEnv, refuseUngroupable };
