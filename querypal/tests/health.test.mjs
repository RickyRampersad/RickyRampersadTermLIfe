/* The ten-second check, and the one line in it that used to lie.

   On the morning of 6 November 2026 the health check read

       OK   Autopilot installed       autoSweep

   while the comments trail had not gained a single row overnight and three
   open cases — 098, 119, 120 — had still never reached a department. Both
   facts can be true at once, because "installed" only ever meant the trigger
   exists. A sweep that runs every night and does nothing, because
   AUTOPILOT_ON is false, looks exactly like a healthy one from here.

   That is the fault Query Pal exists to stop: a process you cannot see. So
   the switch is reported next to the trigger, and the agent-survey trigger
   with them, since its absence is why no agent has been asked to rate
   anything.

   Run: node health.test.mjs
*/
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PATCH = fs.readFileSync(path.join(HERE, '..', 'QueryPalPatch.gs'), 'utf8');

let fail = 0;
const t = (label, ok, detail) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (!ok && detail ? '\n          ' + detail : ''));
  if (!ok) fail++;
};

function load(opts) {
  const o = opts || {};
  const sheet = (rows) => ({
    getLastRow: () => rows + 1, getMaxColumns: () => 29,
    getRange: () => ({ getValues: () => [[]], getValue: () => '', setValue: () => {} }),
    appendRow: () => {},
  });
  const trig = (o.triggers === undefined ? ['autoSweep'] : o.triggers)
    .map(n => ({ getHandlerFunction: () => n }));
  const sandbox = {
    SHEET_NAME: 'Queries',
    getVersion: () => 'v10.3-HARDENED',
    Logger: { log() {} },
    AGENT_ACCESS: { A00427: {}, A01066: {} },
    codeTable_: () => new Array(o.codeRows === undefined ? 39 : o.codeRows).fill({}),
    cmtSheet_: () => sheet(757),
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet(128) }) },
    ScriptApp: { getProjectTriggers: () => trig },
    MailApp: { getRemainingDailyQuota: () => (o.quota === undefined ? 55 : o.quota) },
    GmailApp: { search: () => { if (o.gmailThrows) throw new Error('not authorised'); return []; } },
  };
  /* AUTOPILOT_ON has to be genuinely absent to test the absent case — a
     parameter that is passed is defined, whatever value it holds. */
  if (o.autopilot !== 'absent') sandbox.AUTOPILOT_ON = o.autopilot === undefined ? true : o.autopilot;
  const names = Object.keys(sandbox);
  const api = new Function(...names, PATCH + '\n;return {qpHealth_};')(
    ...names.map(n => sandbox[n]));
  return api.qpHealth_();
}

const pick = (h, name) => h.checks.filter(c => c.name === name)[0];

/* ---------- the switch, which is the point ------------------------------- */
console.log('\nwhether the autopilot is actually doing anything\n');
{
  const h = load({ autopilot: false });
  const c = pick(h, 'Autopilot switched on');
  t('a sweep that is switched off is reported as a failure',
    c && c.ok === false, JSON.stringify(c));
  t('and it says so in words, not just a red light',
    c && /does NOTHING/.test(c.note), c && c.note);
  t('the whole check goes red, so the phone shows it', h.ok === false);
  t('the trigger is still reported as present, because it is',
    pick(h, 'Autopilot trigger').ok === true,
    'these are two different facts and were one line before');
}
{
  const h = load({ autopilot: true });
  t('a sweep that is on reads green', pick(h, 'Autopilot switched on').ok === true);
  t('and says which flag it read', /AUTOPILOT_ON = true/.test(pick(h, 'Autopilot switched on').note));
}
{
  const h = load({ autopilot: 'absent' });
  const c = pick(h, 'Autopilot switched on');
  t('a flag that cannot be found is not reported as switched off',
    c.ok === true && /not found/.test(c.note),
    'an older Code.gs may not have the flag at all — that is not a failure');
}

/* ---------- the trigger, and the one that is missing --------------------- */
console.log('\nthe triggers\n');
{
  const h = load({ triggers: [] });
  t('no trigger at all is a failure', pick(h, 'Autopilot trigger').ok === false);
  t('and it says what to run', /setupTriggers/.test(pick(h, 'Autopilot trigger').note));
}
{
  const h = load({ triggers: ['autoSweep'] });
  const c = pick(h, 'Agent survey trigger');
  t('the agent survey being uninstalled is now visible',
    c.ok === false && /qpSetupAgentSurvey/.test(c.note),
    'this is the live state on 6 November and nothing said so');
}
{
  const h = load({ triggers: ['autoSweep', 'qpAgentSurveySweep'] });
  t('once installed it reads green', pick(h, 'Agent survey trigger').ok === true);
}

/* ---------- the rest, which must not have moved -------------------------- */
console.log('\nthe other checks\n');
{
  const h = load({ triggers: ['autoSweep', 'qpAgentSurveySweep'] });
  t('the version is reported', h.version === 'v10.3-HARDENED');
  t('the row count is reported', /128 rows/.test(pick(h, 'Queries sheet').note));
  t('the sign-in list counts both sources',
    /2 in script, 39 in the sheet/.test(pick(h, 'Sign-in list').note));
  t('the routing table is read from the patch itself',
    pick(h, 'Routing table').ok === true && /\d+ request types/.test(pick(h, 'Routing table').note));
  t('everything green means ok', h.ok === true, JSON.stringify(h.checks.filter(c => !c.ok)));
}
{
  const h = load({ quota: 0 });
  t('no quota left is a failure', pick(h, 'Email quota').ok === false);
  t('a low quota is a failure too, before it runs out',
    load({ quota: 11 }).checks.filter(c => c.name === 'Email quota')[0].ok === false,
    '11 left is what RRB/2026/113 was logged on');
  t('a healthy quota is fine', load({ quota: 55 }).checks.filter(c => c.name === 'Email quota')[0].ok === true);
}
{
  const h = load({ gmailThrows: true });
  t('losing Gmail access is a failure, since threading dies with it',
    pick(h, 'Gmail access (threading)').ok === false);
  t('and it says how to fix it', /run any function once/.test(pick(h, 'Gmail access (threading)').note));
}

/* ---------- it must never be the thing that breaks ---------------------- */
console.log('\nwhen the sheet itself is broken\n');
{
  const names = ['SHEET_NAME', 'getVersion', 'Logger', 'AGENT_ACCESS', 'codeTable_',
                 'cmtSheet_', 'SpreadsheetApp', 'ScriptApp', 'MailApp', 'GmailApp'];
  const vals = ['Queries', () => 'v', { log() {} }, {}, () => { throw new Error('x'); },
                () => { throw new Error('x'); },
                { getActiveSpreadsheet: () => { throw new Error('x'); } },
                { getProjectTriggers: () => { throw new Error('x'); } },
                { getRemainingDailyQuota: () => { throw new Error('x'); } },
                { search: () => { throw new Error('x'); } }];
  const api = new Function(...names, PATCH + '\n;return {qpHealth_};')(...vals);
  let h = null, threw = false;
  try { h = api.qpHealth_(); } catch (e) { threw = true; }
  t('a health check on a broken script still answers rather than throwing',
    !threw && h && h.ok === false,
    'it is the thing you reach for when everything else is wrong');
  t('and every failure is named', h && h.checks.every(c => c.note !== undefined));
}

console.log();
process.exit(fail ? 1 : 0);
