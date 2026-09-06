// A fake Sheets that counts round trips, so "faster" is a number.
const fs = require('fs'), vm = require('vm');

function makeEnv(opts = {}) {
  const cacheMap = {};
  const cacheStub = { get: k => (k in cacheMap ? cacheMap[k] : null),
                      put: (k, v) => { cacheMap[k] = String(v); },
                      remove: k => { delete cacheMap[k]; },
                      removeAll: ks => ks.forEach(k => delete cacheMap[k]) };
  const calls = { getValues: 0, setValue: 0, setValues: 0, getLastRow: 0,
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
      getActive: () => ({
        getSheets: () => Object.values(sheets),
        getSheetByName: n => sheets[n] || null,
        insertSheet: n => mkSheet(n, Object.keys(sheets).length + 100, [], []),
        getSpreadsheetTimeZone: () => 'America/Port_of_Spain'
      })
    },
    LockService: { getScriptLock: () => ({ waitLock: () => { if (opts.lockBusy) throw new Error('Could not acquire lock'); }, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => cacheStub },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'ricky@example.com' }) },
    MailApp: { sendEmail: () => { calls.mail++; if (opts.mailThrows) throw new Error('Service invoked too many times'); } },
    Utilities: {
      formatDate: (d, tz, f) => {
        const p = n => String(n).padStart(2, '0');
        if (f === 'HH:mm') return p(d.getHours()) + ':' + p(d.getMinutes());
        if (f === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        return d.toISOString();
      },
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2),
      base64Encode: s => Buffer.from(String(s)).toString('base64'),
      computeHmacSha256Signature: () => [1, 2, 3]
    },
    UrlFetchApp: { fetch: () => { throw new Error('no network in harness'); } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => {} }) }) }) }) }
  };
  g.globalThis = g;
  vm.createContext(g);
  new vm.Script(fs.readFileSync(process.env.GS_PATH || (__dirname + '/../apps-script/KPI.gs'), 'utf8'), { filename: 'KPI.gs' }).runInContext(g);
  return g;
}
module.exports = { makeEnv };
