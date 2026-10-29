// A fake Sheets that counts round trips, so "faster" is a number.
const fs = require('fs'), vm = require('vm');

// Sheets PARSES a value on the way in: the string '0000' is stored as the
// number 0 and reads back as 0, and '2026-10' becomes a date. The fake kept
// whatever it was given, so a whole family of live bugs could never be
// reproduced here (the guest number read back as 0 and no guest could sign
// in; see CLAUDE.md on the month read back as a month). SHEETS_PARSE=1 makes
// the fake behave, so a test can pin one. A cell set to the text format with
// setNumberFormat('@') keeps its string, as in Sheets.
const PARSE = process.env.SHEETS_PARSE === '1';
function asSheets(v, isText) {
  if (!PARSE || isText) return v;
  if (typeof v !== 'string' || v.trim() === '') return v;
  return /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : v;
}

function makeEnv(opts = {}) {
  const cacheMap = {};
  const cacheStub = { get: k => (k in cacheMap ? cacheMap[k] : null),
                      put: (k, v) => { cacheMap[k] = String(v); },
                      remove: k => { delete cacheMap[k]; },
                      removeAll: ks => ks.forEach(k => delete cacheMap[k]),
                      putAll: o => Object.keys(o).forEach(k => { cacheMap[k] = String(o[k]); }),
                      getAll: ks => { const r = {}; ks.forEach(k => { if (k in cacheMap) r[k] = cacheMap[k]; }); return r; } };
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
    const textCells = {};              // 'r,c' -> true, set by setNumberFormat('@')
    const sh = {
      _grid: grid,
      _textCells: textCells,
      getName: () => name,
      getSheetId: () => id,
      getLastRow: () => { calls.getLastRow++; return grid.length; },
      getLastColumn: () => { calls.getLastColumn++;
        return grid.length ? Math.max(...grid.map(r => r.length)) : 0; },
      setFrozenRows: () => sh, setColumnWidth: () => sh, setColumnWidths: () => sh,
      autoResizeColumn: () => sh, autoResizeColumns: () => sh, hideColumns: () => sh,
      setTabColor: () => sh, clearFormats: () => sh, getMaxColumns: () => 60,
      getMaxRows: () => Math.max(grid.length, 1000), insertColumns: () => sh,
      appendRow: r => { calls.appendRow++; grid.push(r.map(v => asSheets(v, false))); return sh; },
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
          grid[r - 1][c - 1] = asSheets(v, textCells[r + ',' + c]);
        },
        setNumberFormat(fmt) {
          for (let i = 0; i < nr; i++) {
            for (let j = 0; j < nc; j++) {
              if (String(fmt) === '@') textCells[(r + i) + ',' + (c + j)] = true;
              else delete textCells[(r + i) + ',' + (c + j)];
            }
          }
          return this;
        },
        setValues(vals) {
          calls.setValues++;
          for (let i = 0; i < vals.length; i++) {
            while (grid.length < r + i) grid.push([]);
            for (let j = 0; j < vals[i].length; j++) {
              grid[r - 1 + i][c - 1 + j] =
                asSheets(vals[i][j], textCells[(r + i) + ',' + (c + j)]);
            }
          }
        },
        /* Chainable, because real formatting calls are written as one
           chain (setFontWeight(..).setBackground(..).setFontColor(..))
           and a stub returning undefined breaks on the second link. */
        setFontWeight() { return this; },
        setBackground() { return this; }, setFontColor() { return this; },
        setFontSize() { return this; }, setWrap() { return this; },
        setHorizontalAlignment() { return this; }, setVerticalAlignment() { return this; },
        setBorder() { return this; }, setFontStyle() { return this; },
        setDataValidation() { return this; }, clearDataValidations() { return this; },
        setNote() { return this; }, merge() { return this; }
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
    Session: { getEffectiveUser: () => ({ getEmail: () => 'ricky@example.com' }),
               getScriptTimeZone: () => 'America/Port_of_Spain' },
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
  // GS_PATH may list several files, comma-separated, for a project of more
  // than one script (the RR Operations project is DeliveryBook.gs and LogBook.gs).
  String(process.env.GS_PATH || (__dirname + '/../apps-script/KPI.gs')).split(',').forEach(f =>
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
