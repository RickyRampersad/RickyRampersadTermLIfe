// A fake Sheets that counts round trips, so "faster" is a number.
const fs = require('fs'), vm = require('vm');

function makeEnv(opts = {}) {
  const cacheMap = {};
  const cacheStub = { get: k => (k in cacheMap ? cacheMap[k] : null),
                      put: (k, v) => { cacheMap[k] = String(v); },
                      remove: k => { delete cacheMap[k]; },
                      removeAll: ks => ks.forEach(k => delete cacheMap[k]) };
  const calls = { getValues: 0, getValue: 0, setValue: 0, setValues: 0, getLastRow: 0,
                  getLastColumn: 0, appendRow: 0, deleteRow: 0, mail: 0 };
  const sheets = {};

  function mkSheet(name, id, headers, rows) {
    // A sheet that has just been inserted is empty — no rows at all, so the
    // first appendRow lands in row 1 and becomes the header. Modelling it as
    // one blank row put every generated tab's header in row 2, which nothing
    // caught because the tests pre-made their tabs.
    const grid = headers.length ? [headers.slice(), ...rows.map(r => r.slice())]
                                : rows.map(r => r.slice());
    const sh = {
      _grid: grid,
      getName: () => name,
      getSheetId: () => id,
      getLastRow: () => { calls.getLastRow++; return grid.length; },
      getLastColumn: () => { calls.getLastColumn++;
        return grid.length ? Math.max(...grid.map(r => r.length)) : 0; },
      setFrozenRows: () => sh,
      appendRow: r => { calls.appendRow++; grid.push(r.slice()); return sh; },
      deleteRow: n => { calls.deleteRow++; grid.splice(n - 1, 1); return sh; },
      getRange: (r, c, nr = 1, nc = 1) => ({
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
          while (grid.length < r) grid.push([]);
          grid[r - 1][c - 1] = v;
        },
        setValues(vals) {
          calls.setValues++;
          for (let i = 0; i < vals.length; i++) {
            while (grid.length < r + i) grid.push([]);
            for (let j = 0; j < vals[i].length; j++) grid[r - 1 + i][c - 1 + j] = vals[i][j];
          }
        },
        setNumberFormat: () => {}, setFontWeight: () => {}, setBackground: () => {}
      })
    };
    sheets[name] = sh;
    return sh;
  }

  const g = {
    console, JSON, Math, Date, String, Number, Boolean, Object, Array, RegExp, Error, isNaN, parseInt, parseFloat,
    __calls: calls, __sheets: sheets, __mkSheet: mkSheet,
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
    LockService: { getScriptLock: () => ({ waitLock: () => { if (opts.lockBusy) throw new Error('Could not acquire lock'); }, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => cacheStub },
    /* Enough of ContentService to drive doGet and doPost. Most tests call the
       handlers directly, but the web entry points are where two scripts
       sharing one project meet, and that seam is worth testing through. */
    ContentService: {
      MimeType: { JSON: 'application/json', TEXT: 'text/plain', HTML: 'text/html' },
      createTextOutput: t => ({ _t: String(t == null ? '' : t),
                                setMimeType() { return this; },
                                getContent() { return this._t; } })
    },
    /* A real little store, not a pair of stubs: a secret written on first
       use has to read back the same on the second, or every signature the
       script makes is a different one. */
    PropertiesService: (() => { const store = Object.assign({}, opts.props || {});
      const api = { getProperty: k => (k in store ? store[k] : null),
                    setProperty: (k, v) => { store[k] = String(v); return api; },
                    deleteProperty: k => { delete store[k]; return api; },
                    getProperties: () => Object.assign({}, store) };
      return { getScriptProperties: () => api }; })(),
    Session: { getEffectiveUser: () => ({ getEmail: () => 'ricky@example.com' }) },
    MailApp: { sendEmail: () => { calls.mail++; if (opts.mailThrows) throw new Error('Service invoked too many times'); } },
    Utilities: {
      formatDate: (d, tz, f) => {
        const p = n => String(n).padStart(2, '0');
        if (f === 'HH:mm') return p(d.getHours()) + ':' + p(d.getMinutes());
        if (f === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        // Every date a person reads is built in UTC by prettyDate_/shortDate_,
        // so an e-mail's own subject line stayed an ISO timestamp in tests and
        // nothing could assert on it.
        const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        if (f === 'EEE d MMM') return DAY[d.getUTCDay()].slice(0, 3) + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()].slice(0, 3);
        if (f === 'EEEE d MMMM yyyy') return DAY[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
        return d.toISOString();
      },
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2),
      base64Encode: s => Buffer.from(String(s)).toString('base64'),
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
    UrlFetchApp: { fetch: () => { throw new Error('no network in harness'); } },
    /* Enough of HtmlService to read back what a page says. */
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
      createHtmlOutput: html => ({ _h: String(html == null ? '' : html),
                                   addMetaTag() { return this; },
                                   setXFrameOptionsMode() { return this; },
                                   setTitle() { return this; },
                                   getContent() { return this._h; } })
    },
    Logger: { log: () => {} },
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
  new vm.Script(fs.readFileSync(process.env.GS_PATH || (__dirname + '/../apps-script/KPI.gs'), 'utf8'), { filename: 'KPI.gs' }).runInContext(g);
  return g;
}
module.exports = { makeEnv };
