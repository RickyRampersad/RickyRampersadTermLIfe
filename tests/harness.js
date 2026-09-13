// A fake Sheets that counts round trips, so "faster" is a number.
//
// Two scripts run against this: KPI.gs, which needs Sheets and mail, and
// Recruiting.gs, which also needs Drive, Properties, a lock it can see the
// state of, a cache that expires, and an outbound fetch. Everything the second
// one needs was added without changing what the first one sees — the additions
// are either new services or opt-in through opts, so the tests that guard
// somebody's afternoon still measure exactly what they measured before.
//
//   makeEnv()                       — KPI.gs, as it always was
//   makeEnv({ gs: '…/Recruiting.gs', strictGrid: true, properties: {…} })
//
// opts:
//   gs            which script to load (or set GS_PATH)
//   strictGrid    enforce Google's real limits: a new sheet is 1000x26, a
//                 getRange past the grid throws rather than growing it, and a
//                 cell holds 50,000 characters. Off by default, because the
//                 KPI tests pre-make wide tabs and were written without it.
//   properties    seed for PropertiesService
//   fetchHandler  (url, params) => ({ code, body }) for UrlFetchApp
//   now           starting clock for cache expiry, with __advance(seconds)
//   lockBusy      waitLock throws, as when another execution holds it
//   mailThrows    sendEmail throws, as when the daily quota is gone
const fs = require('fs'), vm = require('vm');

const MAX_CELL = 50000, DEFAULT_ROWS = 1000, DEFAULT_COLS = 26;

function makeEnv(opts = {}) {
  const strict = !!opts.strictGrid;
  let now = opts.now ? new Date(opts.now).getTime() : Date.now();

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
    removeAll: ks => ks.forEach(k => delete cacheMap[k])
  };

  const calls = { getValues: 0, setValue: 0, setValues: 0, getLastRow: 0,
                  getLastColumn: 0, appendRow: 0, deleteRow: 0, mail: 0, fetch: 0 };
  const sheets = {};
  const logs = [], fetches = [];
  let lockHeld = false;

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
      getRange: (r, c, nr = 1, nc = 1) => {
        bounds(r, c, nr, nc);
        return {
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
            calls.getValues++;
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
        };
      }
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
  function mkFile(id, bytes, type, fname, folder) {
    const f = { id, bytes, type, fname, folder, trashed: false,
      getId: () => id, getName: () => fname,
      getBlob: () => { if (f.trashed) throw new Error('File is in the trash.'); return mkBlob(bytes, type, fname); },
      setTrashed: v => { f.trashed = !!v; return f; } };
    return f;
  }
  function mkBlob(bytes, type, fname) {
    return { getBytes: () => bytes, getName: () => fname, getContentType: () => type };
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

  const propMap = Object.assign({}, opts.properties || {});

  const g = {
    console, JSON, Math, Date, String, Number, Boolean, Object, Array, RegExp, Error, isNaN, parseInt, parseFloat, Buffer,
    __calls: calls, __sheets: sheets, __mkSheet: mkSheet,
    __logs: logs, __fetches: fetches, __props: propMap, __drive: drive,
    __advance: sec => { now += sec * 1000; },
    __lockHeld: () => lockHeld,
    // Every data row of a tab as an object keyed by its header.
    __rows: name => {
      const sh = sheets[name];
      if (!sh || sh._grid.length < 2) return [];
      const head = sh._grid[0];
      return sh._grid.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
    },
    SpreadsheetApp: {
      getActive: () => ({
        getSheets: () => Object.values(sheets),
        getSheetByName: n => sheets[n] || null,
        insertSheet: n => mkSheet(n, Object.keys(sheets).length + 100, [], []),
        getSpreadsheetTimeZone: () => 'America/Port_of_Spain'
      })
    },
    DriveApp: {
      createFolder: n => { const f = mkFolder(driveId(), n); drive.roots.push(f); drive.folders.set(f.id, f); return f; },
      getFoldersByName: n => iter(drive.roots.filter(f => f.name === n)),
      getFolderById: id => { const f = drive.folders.get(id); if (!f) throw new Error('No item with the given ID could be found: ' + id); return f; },
      getFileById: id => { const f = drive.files.get(id); if (!f || f.trashed) throw new Error('No item with the given ID could be found: ' + id); return f; }
    },
    LockService: { getScriptLock: () => ({
      waitLock: ms => { if (opts.lockBusy) throw new Error('Could not acquire lock');
                        if (lockHeld) throw new Error('Could not obtain lock within ' + ms + 'ms.');
                        lockHeld = true; },
      releaseLock: () => { lockHeld = false; },
      hasLock: () => lockHeld }) },
    CacheService: { getScriptCache: () => cacheStub },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in propMap ? propMap[k] : null),
      setProperty: (k, v) => { propMap[k] = String(v); },
      deleteProperty: k => { delete propMap[k]; } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => opts.email || 'ricky@example.com' }),
               getActiveUser: () => ({ getEmail: () => opts.email || 'ricky@example.com' }) },
    Logger: { log: m => logs.push(String(m)) },
    MailApp: { sendEmail: () => { calls.mail++; if (opts.mailThrows) throw new Error('Service invoked too many times'); } },
    ContentService: {
      MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
      createTextOutput: s => { let mime = 'text/plain';
        return { getContent: () => s, getMimeType: () => mime, setMimeType(m) { mime = m; return this; } }; }
    },
    Utilities: {
      formatDate: (d, tz, f) => {
        const p = n => String(n).padStart(2, '0');
        if (f === 'HH:mm') return p(d.getHours()) + ':' + p(d.getMinutes());
        if (f === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        return d.toISOString();
      },
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2),
      base64Encode: s => Buffer.from(Array.isArray(s) ? s : String(s)).toString('base64'),
      base64Decode: s => Array.from(Buffer.from(String(s), 'base64')),
      newBlob: (bytes, type, name) => mkBlob(bytes, type, name),
      computeHmacSha256Signature: () => [1, 2, 3]
    },
    UrlFetchApp: { fetch: (url, params) => {
      calls.fetch++;
      fetches.push({ url, params });
      if (!opts.fetchHandler) throw new Error('no network in harness');
      const r = opts.fetchHandler(url, params);
      return { getResponseCode: () => r.code, getContentText: () => r.body };
    } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => {} }) }) }) }) }
  };
  g.globalThis = g;
  vm.createContext(g);
  const gs = opts.gs || process.env.GS_PATH || (__dirname + '/../apps-script/KPI.gs');
  new vm.Script(fs.readFileSync(gs, 'utf8'), { filename: require('path').basename(gs) }).runInContext(g);
  return g;
}
module.exports = { makeEnv };
