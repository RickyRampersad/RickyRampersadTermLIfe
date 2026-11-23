// Move.gs: carrying the Service Questionnaire project from one Google account to
// another. A copy of the sheet carries the tabs and the code but no Script
// property and no timed job, so moveExport writes them onto a hidden tab the
// copy carries across, and moveImport rebuilds them on the other side.
//
// Part A runs Move.gs in two fake projects, the old one and its copy.
// Part B loads Move.gs beside the real project files, to prove every installer
// it calls exists there under that name.
const fs = require('fs'), vm = require('vm'), path = require('path');
const AS = path.join(__dirname, '..', 'apps-script');
const SRC = fs.readFileSync(path.join(AS, 'Move.gs'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

/* ── a fake project: one spreadsheet, its properties, its triggers, a Drive ───────────── */
function mkSheet(name, rows) {
  const grid = rows.map(r => r.slice()); const text = {}; let hidden = false;
  const sh = {
    _grid: grid, _hidden: () => hidden,
    getName: () => name,
    getLastRow: () => { let n = grid.length; while (n && grid[n - 1].every(v => v === '' || v == null)) n--; return n; },
    clear: () => { grid.length = 0; return sh; },
    hideSheet: () => { hidden = true; return sh; },
    getRange: (r, c, nr, nc) => ({
      setNumberFormat: f => { if (f === '@') for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) text[(r + i) + ',' + (c + j)] = 1; },
      setValues: v => { v.forEach((row, i) => { const R = r - 1 + i; grid[R] = grid[R] || [];
        row.forEach((x, j) => {
          // Sheets parses what is not text: a string of digits comes back a number, and = is a formula
          const t = text[(r + i) + ',' + (c + j)];
          grid[R][c - 1 + j] = (!t && typeof x === 'string' && /^-?\d+$/.test(x)) ? Number(x) : x;
        }); }); },
      getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = grid[r - 1 + i] || [];
        const o = []; for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] == null ? '' : row[c - 1 + j]); out.push(o); } return out; }
    }),
    appendRow: row => { grid.push(row.slice()); }
  };
  return sh;
}

function mkProject(id, sheets, props, triggers, reachable, stubs) {
  const store = Object.assign({}, props);
  const trig = triggers.map(t => ({ getHandlerFunction: () => t.fn, getTriggerSource: () => t.src || 'CLOCK',
                                    getEventType: () => t.ev || 'CLOCK', chain: [] }));
  const ss = {
    _sheets: sheets,
    getId: () => id,
    getSheets: () => sheets.slice(),
    getSheetByName: n => sheets.find(s => s.getName() === n) || null,
    insertSheet: n => { const s = mkSheet(n, []); sheets.push(s); return s; },
    deleteSheet: s => { const i = sheets.indexOf(s); if (i > -1) sheets.splice(i, 1); }
  };
  const said = [];
  const builder = fn => { const chain = []; const b = new Proxy({}, { get: (_, k) => k === 'create'
    ? () => { const rec = { getHandlerFunction: () => fn, getTriggerSource: () => (chain.some(c => /^forSpreadsheet/.test(c)) ? 'SPREADSHEET' : 'CLOCK'),
                            getEventType: () => 'CLOCK', chain }; trig.push(rec); return rec; }
    : (...a) => { chain.push(k + '(' + a.map(x => (x && x.getId) ? x.getId() : String(x)).join(',') + ')'); return b; } }); return b; };
  const g = {
    console, JSON, Math, Date, String, Number, Object, Array, RegExp, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({ alert: m => said.push(m) }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperties: () => Object.assign({}, store),
      getProperty: k => (k in store ? store[k] : null),
      setProperty: (k, v) => { store[k] = String(v); },
      setProperties: (o, del) => { if (del) Object.keys(store).forEach(k => delete store[k]); Object.keys(o).forEach(k => { store[k] = String(o[k]); }); }
    }) },
    ScriptApp: { getProjectTriggers: () => trig.slice(),
                 deleteTrigger: t => { const i = trig.indexOf(t); if (i > -1) trig.splice(i, 1); },
                 newTrigger: fn => builder(fn) },
    DriveApp: { getFileById: x => { if (reachable.file.includes(x)) return { getName: () => 'file ' + x }; throw new Error('No item'); },
                getFolderById: x => { if (reachable.folder.includes(x)) return { getName: () => 'folder ' + x }; throw new Error('No item'); } },
    Session: { getEffectiveUser: () => ({ getEmail: () => (stubs && stubs.email) || 'old@example.com' }), getScriptTimeZone: () => 'America/Port_of_Spain' },
    Logger: { log: () => {} }
  };
  Object.assign(g, (stubs && stubs.globals) ? stubs.globals(g) : {});
  vm.createContext(g);
  new vm.Script(SRC, { filename: 'Move.gs' }).runInContext(g);
  return { g, ss, store, trig, said };
}

/* the project's own installers, as the copy will have them: each builds what the real one builds */
const installers = g => ({
  TRANSITION: { DIGEST_HOURS: [8, 12] }, T_FIND: { HOUR: 17 }, LETTERS: { EVERY_MIN: 10, FOLDER: 'LETTERSFOLDERxxxxxxxxxxxxxxxxxx' },
  tTz_: () => 'America/Port_of_Spain',
  installTriggers_: () => g.ScriptApp.newTrigger('dailyServiceFollowUp').timeBased().atHour(8).everyDays(1).create(),
  tWeeklyTrigger_: () => g.ScriptApp.newTrigger('transitionWeekly').timeBased().onWeekDay('MONDAY').atHour(7).create(),
  tBookTrigger_: () => g.ScriptApp.newTrigger('transitionBuildClientBook').timeBased().atHour(6).everyDays(1).create(),
  tSendTrigger_: () => g.ScriptApp.newTrigger('transitionSendBatch').timeBased().everyMinutes(30).create(),
  gcmMondayTrigger_: () => g.ScriptApp.newTrigger('gcmMondaySend').timeBased().onWeekDay('MONDAY').atHour(10).create(),
  gcmDayTrigger_: () => g.ScriptApp.newTrigger('gcmDay1030').timeBased().atHour(10).nearMinute(30).everyDays(1).create(),
  tBookId_: () => 'BOOKWORKBOOKxxxxxxxxxxxxxxxxxxxxxx'
});

console.log('Part A: two projects');
const OLD_PROPS = {
  MS_TENANT: '11111111-2222-3333-4444-555555555555',       // GUID-shaped, but a secret's key: never opened as a file
  MS_SECRET: 'abc~secret.value',
  SF_SECRET: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',     // id-shaped, secret key: never tried
  GCM_SHEET_ID: 'GCMSHEETxxxxxxxxxxxxxxxxxxxxxxxxxx',
  GCM_FORMS_FOLDER: 'FORMSFOLDERxxxxxxxxxxxxxxxxxxxxxx',
  CALLS_SHEET_ID: 'CALLSSHEETxxxxxxxxxxxxxxxxxxxxxxx',      // not shared with the new owner
  claims_seq: '0000',                                       // Sheets would read this as 0
  month: '2026-10',
  formulaish: '=SUM(A1:A3)',
  sf_agents: '{"a":[1,2,3],"at":"2026-11-23"}',
  multiline: 'line one\nline two',
  MOVE_STOPPED: 'from an earlier attempt'                   // the move's own mark never travels
};
const OLD_TRIG = [
  { fn: 'transitionDigest' }, { fn: 'transitionDigest' }, { fn: 'transitionInbox' }, { fn: 'transitionReceipts' },
  { fn: 'transitionWeekly' }, { fn: 'transitionSendBatch' }, { fn: 'gcmRefreshTick' }, { fn: 'gcmMondaySend' },
  { fn: 'gcmDay1030' }, { fn: 'lettersAttachTick' }, { fn: 'transitionFindings' },
  { fn: 'gcmWelcomeTick' },                                 // a one-off: listed for a person, never guessed
  { fn: 'onSheetEdit', src: 'SPREADSHEET', ev: 'ON_EDIT' }
];
const oldSheets = [mkSheet('Client Responses', [['When', 'Token'], ['a', 't1'], ['b', 't2']]),
                   mkSheet('Transition Send', [['Token'], ['t1'], ['t2'], ['t3']])];
const OLD = mkProject('OLD-ID', oldSheets, OLD_PROPS, OLD_TRIG, { file: [], folder: [] }, { email: 'personal@gmail.example' });

let r = OLD.g.moveStopOld();
ok(/Run moveExport first/.test(r), 'moveStopOld refuses before moveExport');
ok(OLD.trig.length === OLD_TRIG.length, 'and deletes nothing');

r = OLD.g.moveExport();
const tab = OLD.ss.getSheetByName('_move');
ok(!!tab, 'moveExport writes a _move tab');
ok(tab && tab._hidden(), 'the tab is hidden');
ok(/11 settings, 13 timed jobs and 2 tabs/.test(r), 'it says what it wrote: ' + r.split('\n')[0]);
ok(!tab._grid.some(row => row[1] === 'MOVE_STOPPED'), 'the move\'s own mark is not written');
ok(tab._grid.slice(1).every(row => typeof row[2] === 'string' && row[2].indexOf('v:') === 0), 'every value is stored as text after v:');

r = OLD.g.moveImport();
ok(/This is the old project/.test(r), 'moveImport refuses in the old project');

r = OLD.g.moveStopOld();
ok(OLD.trig.length === 0, 'moveStopOld deletes every timed job in the old project');
ok(/Stopped: 13 timed jobs deleted/.test(r), 'and says how many: ' + r.split('\n')[0]);
ok(!!OLD.store.MOVE_STOPPED, 'the old project is marked stopped');

// File → Make a copy, as the new owner: the tabs (hidden ones too) and the code, nothing else
const copySheets = OLD.ss.getSheets().map(s => { const c = mkSheet(s.getName(), s._grid); if (s._hidden()) c.hideSheet(); return c; });
const NEW = mkProject('NEW-ID', copySheets, {}, [],
  { file: ['GCMSHEETxxxxxxxxxxxxxxxxxxxxxxxxxx', 'BOOKWORKBOOKxxxxxxxxxxxxxxxxxxxxxx'], folder: ['FORMSFOLDERxxxxxxxxxxxxxxxxxxxxxx', 'LETTERSFOLDERxxxxxxxxxxxxxxxxxx'] },
  { email: 'support@branch.example', globals: installers });

r = NEW.g.moveStopOld();
ok(/This is the copy/.test(r), 'moveStopOld refuses in the copy');

r = NEW.g.moveImport();
const want = Object.assign({}, OLD_PROPS); delete want.MOVE_STOPPED;
Object.keys(want).forEach(k => ok(NEW.store[k] === want[k], 'setting ' + k + ' arrives exactly (' + JSON.stringify(NEW.store[k]) + ')'));
ok(!('MOVE_STOPPED' in NEW.store), 'the old project\'s stop mark is not carried');
ok(/from personal@gmail\.example/.test(NEW.store.MOVE_IMPORTED || ''), 'the copy records where it came from');

const count = fn => NEW.trig.filter(t => t.getHandlerFunction() === fn).length;
ok(count('transitionDigest') === 2, 'the digest is rebuilt at both hours, not twice per hour');
ok(NEW.trig.filter(t => t.getHandlerFunction() === 'transitionDigest').map(t => t.chain.join('.')).join('|').match(/atHour\(8\)[\s\S]*atHour\(12\)/), 'at 8 and at 12');
['transitionInbox', 'transitionReceipts', 'transitionWeekly', 'transitionSendBatch', 'gcmRefreshTick', 'gcmMondaySend', 'gcmDay1030', 'lettersAttachTick', 'transitionFindings']
  .forEach(fn => ok(count(fn) === 1, fn + ' is rebuilt once'));
ok(NEW.trig.find(t => t.getHandlerFunction() === 'transitionInbox').chain.join('.') === 'timeBased().everyMinutes(5)', 'the inbox reads every five minutes, as before');
ok(NEW.trig.find(t => t.getHandlerFunction() === 'gcmRefreshTick').chain.join('.') === 'timeBased().everyHours(1)', 'the group refresh runs hourly, as before');
ok(NEW.trig.find(t => t.getHandlerFunction() === 'transitionFindings').chain.join('.').includes('atHour(17)'), 'the findings keep their hour');
ok(count('gcmWelcomeTick') === 0 && /set up again by hand: gcmWelcomeTick/.test(r), 'a one-off job is named for a person, not guessed');
const edit = NEW.trig.find(t => t.getHandlerFunction() === 'onSheetEdit');
ok(edit && edit.chain.join('.') === 'forSpreadsheet(NEW-ID).onEdit()', 'a sheet trigger is rebuilt on the copy, not the old sheet');
ok(NEW.trig.length === 12, 'thirteen jobs in: twelve rebuilt and the one-off left for a person (' + NEW.trig.length + ')');
ok(!NEW.ss.getSheetByName('_move'), 'the copy\'s _move tab, with the secrets on it, is deleted');
ok(/cannot open: CALLS_SHEET_ID \(CALLSSHEET/.test(r), 'a sheet the new owner cannot open is named, by its setting');
ok(!/SF_SECRET|MS_TENANT|MS_SECRET/.test(r), 'a secret is never tried as a file or printed');
ok(/Share each with support@branch\.example/.test(r), 'and it says who to share it with');
ok(/Deploy → New deployment → Web app/.test(r), 'and what to do next');

r = NEW.g.moveImport();
ok(/no "_move" tab/.test(r), 'a second moveImport finds nothing to do');
r = NEW.g.moveCheck();
ok(/Still cannot open: CALLS_SHEET_ID/.test(r), 'moveCheck says what is still not shared');

// after the copy, a client tap lands on the old sheet before the pages are re-pointed
OLD.ss.getSheetByName('Client Responses').appendRow(['c', 't3']);
OLD.ss.getSheetByName('Client Responses').appendRow(['d', 't4']);
r = OLD.g.moveCatchUp();
ok(/Client Responses: rows 4 to 5/.test(r), 'moveCatchUp names the rows written after the copy: ' + r.replace(/\n/g, ' | '));
ok(!/Transition Send/.test(r), 'and only those');
r = OLD.g.moveCleanUp();
ok(!OLD.ss.getSheetByName('_move'), 'moveCleanUp deletes the old _move tab');
r = OLD.g.moveCatchUp();
ok(/no "_move" tab/.test(r), 'and catch-up then says there is nothing to compare');

/* ── Part B: beside the real project files ────────────────────────────────────────────── */
console.log('Part B: the real project');
const FILES = ['Service.gs', 'Transition.gs', 'ServiceSalesforce.gs', 'GroupClients.gs', 'GroupBilling.gs', 'GIRenewals.gs',
               'StrategicMeeting.gs', 'Quotes.gs', 'Help868.gs', 'Letters.gs', 'Move.gs'].filter(f => fs.existsSync(path.join(AS, f)));
process.env.GS_PATH = FILES.map(f => path.join(AS, f)).join(',');
const { makeEnv } = require('./harness');
let env = null;
try { env = makeEnv(); } catch (e) { ok(false, 'the project loads with Move.gs beside it: ' + e.message); }
if (env) {
  ok(true, 'the project loads with Move.gs beside it');
  ['installTriggers_', 'tWeeklyTrigger_', 'tBookTrigger_', 'tSendTrigger_', 'gcmMondayTrigger_', 'gcmDayTrigger_', 'tTz_', 'tBookId_']
    .forEach(fn => ok(typeof env[fn] === 'function', fn + ' exists in the project'));
  ok(Array.isArray(env.TRANSITION && env.TRANSITION.DIGEST_HOURS), 'TRANSITION.DIGEST_HOURS exists');
  ok(env.T_FIND && typeof env.T_FIND.HOUR === 'number', 'T_FIND.HOUR exists');
  ok(env.LETTERS && env.LETTERS.EVERY_MIN, 'LETTERS.EVERY_MIN exists');
  // every handler the project schedules has a way back, or is a one-off named for a person
  const all = FILES.filter(f => f !== 'Move.gs').map(f => fs.readFileSync(path.join(AS, f), 'utf8')).join('\n');
  const scheduled = [...new Set([...all.matchAll(/newTrigger\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]))];
  const mapped = Object.keys(env.moveInstallers_());
  const oneOff = ['gcmWelcomeTick', 'gcmRehearseTick'];
  scheduled.forEach(fn => ok(mapped.includes(fn) || oneOff.includes(fn), fn + ' is rebuilt by moveImport, or is a one-off'));
  // no function of Move.gs shadows one already in the project (the last definition wins)
  const mine = [...SRC.matchAll(/^function ([A-Za-z0-9_]+)/gm)].map(m => m[1]);
  mine.forEach(fn => ok(!new RegExp('^function ' + fn + '\\b', 'm').test(all), fn + ' is a new name in the project'));
}

console.log((fail ? 'FAILED ' : 'ok ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
