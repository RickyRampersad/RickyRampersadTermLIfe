/* Who may read and write a case.

   On 10 October 2026 the agent dashboard's three read endpoints were tested
   against the live backend with no sign-in at all:

     GET …/exec?action=replies
       -> {"ok":true,"replied":{…}}  every open reference waiting on a department
     GET …/exec?action=comments&ref=<one of them>
       -> nine comments, every one of them mode:"internal"
     GET …/exec?action=casehistory&ref=<the same>
       -> fifteen events, nine of them those same internal notes

   A reference was never meant to be a credential. The client portal knew it —
   qpClientHistory_ says in as many words that casehistory "must never be what
   the portal calls" — but nothing stopped a browser calling it directly, and
   the first call handed out the references the second one needed.

   addcomment had the matching gap: a valid code, but no check that the case
   belonged to the person holding it, so any signed-in agent could write onto
   anybody's case and push it to the client on the trail.

   These tests fail if any of that comes back.

   Run: node scope.test.mjs
*/
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const APP = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
const PATCH = fs.readFileSync(path.join(HERE, '..', 'QueryPalPatch.gs'), 'utf8');

let fail = 0;
const t = (label, ok, detail) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (!ok && detail ? '\n          ' + detail : ''));
  if (!ok) fail++;
};

/* ---------- the page carries a credential ------------------------------- */
console.log('\nthe page\n');

t('the page has one place that builds the credential',
  /const qpCred=\(\)=>agentAuth\?'&code='\+encodeURIComponent\(agentAuth\.code\):''/.test(APP));

for (const [what, rx] of [
  ['the case timeline', /action=casehistory&ref='\+encodeURIComponent\(btn\.dataset\.ref\)\+qpCred\(\)/],
  ['the trail summary', /action=comments&ref='\+encodeURIComponent\(ref\.ref\)\+qpCred\(\)/],
  ['the comment thread', /action=comments&ref='\+encodeURIComponent\(ref\)\+qpCred\(\)/],
  ['the department-reply map', /action=replies'\+qpCred\(\)/],
]) t(what + ' says who is asking', rx.test(APP), 'it used to travel on a reference alone');

/* Every real call, not just the four known ones: a fifth call site added later
   would otherwise keep the hole open quietly. Only fetches count — the design
   notes further down the file mention these action names in prose. */
{
  const naked = [];
  const rx = /SHEET_WEBHOOK_URL\+'\?action=(comments|casehistory|replies)\b/g;
  let m;
  while ((m = rx.exec(APP)) !== null) {
    const stmt = APP.slice(m.index, APP.indexOf('\n', m.index));
    if (!stmt.includes('qpCred()')) naked.push(m[1] + ' at char ' + m.index);
  }
  t('no staff read of a case is left unscoped', naked.length === 0, naked.join('; '));
}

t('a refusal is not reported as a glitch',
  /not one of your cases'\?'That case is not on your list'/.test(APP)
  && /d\.err==='not one of your cases'\?'That case is not on your list\.'/.test(APP),
  '"Couldn\'t send — try again" invites a retry that fails identically');

/* ---------- the server decides ------------------------------------------ */
console.log('\nthe server\n');

/* Enough of Apps Script to run section 14 honestly. normName_ is the
   line-1231 version, which is what edit 26 makes the live one. */
function load() {
  const calls = [];
  const cache = new Map();
  const ROWS = [
    //  0 ref              3 status  9 agent             10 email          27 replied     28 assigned
    ['RRB/2026/001/A', '', '', 'Open',   '', '', '', '', '', 'Azaria Charles',   'azaria@g.com', ...Array(16).fill(''), new Date('2026-10-08'), ''],
    ['RRB/2026/002/B', '', '', 'Open',   '', '', '', '', '', 'Fawaaz Mohammed',  'fawaaz@g.com', ...Array(16).fill(''), new Date('2026-10-09'), 'Sasha Lalla'],
    ['RRB/2026/003/C', '', '', 'Closed', '', '', '', '', '', 'Azaria Charles',   'azaria@g.com', ...Array(16).fill(''), new Date('2026-10-07'), ''],
  ];
  const sheet = {
    getLastRow: () => ROWS.length + 1,
    getMaxColumns: () => 29,
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const block = [];
      for (let i = 0; i < nr; i++) {
        const row = ROWS[r - 2 + i] || [];
        const cells = [];
        for (let j = 0; j < nc; j++) cells.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
        block.push(cells);
      }
      return { getValues: () => block, getValue: () => block[0][0] };
    }
  };
  const PEOPLE = {
    B1: { code: 'B1', name: 'Ricky Rampersad', email: 'ricky@g.com', role: 'branch', cells: ['Ricky Rampersad'] },
    A1: { code: 'A1', name: 'Azaria Charles', email: 'azaria@g.com', role: 'agent', cells: ['Azaria Charles', 'azaria@g.com'] },
    A2: { code: 'A2', name: 'Fawaaz Mohammed', email: 'fawaaz@g.com', role: 'agent', cells: ['Fawaaz Mohammed', 'fawaaz@g.com'] },
    M1: { code: 'M1', name: 'Nicole Manager', email: 'nicole@g.com', role: 'manager', cells: ['Nicole Manager', 'nicole@g.com'] },
    M2: { code: 'M2', name: 'Emailless Manager', email: '', role: 'manager', cells: ['Emailless Manager'] },
    S1: { code: 'S1', name: 'Sasha Lalla', email: 's@g.com', role: 'staff', cells: ['Sasha Lalla'] },
    C1: { code: 'C1', name: 'A Client', email: 'c@g.com', role: 'client', cells: ['A Client'] },
  };
  const sandbox = {
    SHEET_NAME: 'Queries',
    CMT_TAB: 'Comments',
    AGENT_ACCESS: { B1: ['Ricky Rampersad', 'ricky@g.com', 'branch'] },
    AGENT_MANAGER: { 'Azaria Charles': 'nicole@g.com' },
    Logger: { log() {} },
    Session: { getScriptTimeZone: () => 'America/Port_of_Spain' },
    json: (o) => ({ getContent: () => JSON.stringify(o), _o: o }),
    normName_: (s) => String(s || '').toLowerCase().replace(/[-.]/g, ' ').replace(/\s+/g, ' ').trim(),
    roleWord_: (v) => (/^(branch|manager|agent|staff)$/i.test(String(v || '')) ? String(v).toLowerCase() : null),
    findAgent_: (code) => PEOPLE[String(code || '').toUpperCase()] || null,
    codeTable_: () => [],
    codeRows_: () => [],
    cmtSheet_: () => ({ getLastRow: () => 1, appendRow: () => {} }),
    comments_: () => { calls.push('comments_'); return { _o: { ok: true, items: ['internal note'] } }; },
    history_: () => { calls.push('history_'); return { _o: { ok: true, events: ['note'] } }; },
    addComment_: () => { calls.push('addComment_'); return { _o: { ok: true } }; },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, v),
      })
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpWhoAsks_', 'qpCaseOwner_', 'qpMaySeeCase_', 'qpComments_',
                'qpHistory_', 'qpAddComment_', 'qpReplies_', 'QP_TRAIL_ROLES'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return { api, calls, PEOPLE };
}

const REF = { a: 'RRB/2026/001/A', b: 'RRB/2026/002/B', closed: 'RRB/2026/003/C' };
const ev = (p) => ({ parameter: p });
const out = (res) => (res && res._o) || {};

/* who may see what */
{
  const { api, PEOPLE } = load();
  const may = (who, ref) => api.qpMaySeeCase_(PEOPLE[who], api.qpCaseOwner_(ref));

  t('the branch sees every case', may('B1', REF.a) && may('B1', REF.b));
  t('an agent sees their own case', may('A1', REF.a));
  t('an agent does not see another agent\'s case', !may('A1', REF.b),
    'this is the whole point of the fix');
  t('a manager sees a case belonging to their unit', may('M1', REF.a),
    'AGENT_MANAGER maps Azaria Charles to this manager');
  t('a manager does not see a case outside their unit', !may('M1', REF.b));
  t('a staff member sees what is assigned to them', may('S1', REF.b));
  t('a staff member does not see a case assigned to nobody', !may('S1', REF.a),
    'staff scope is the Assigned To column, exactly as myQueries_ has it');
  t('a reference that does not exist is refused like any other',
    !may('A1', 'RRB/2026/999/Z'),
    'whether a reference is real is itself worth not confirming');
}

/* the endpoints */
{
  const { api, calls } = load();

  t('comments with no credential is refused',
    out(api.qpComments_(ev({ ref: REF.a }))).err === 'sign-in required');
  t('casehistory with no credential is refused',
    out(api.qpHistory_(ev({ ref: REF.a }))).err === 'sign-in required');
  t('addcomment with no credential is refused',
    out(api.qpAddComment_(ev({ ref: REF.a, text: 'x' }))).err === 'sign-in required');
  t('nothing reached the original handlers', calls.length === 0, calls.join(', '));
}
{
  const { api, calls } = load();
  t('a client code cannot open a staff trail',
    out(api.qpComments_(ev({ ref: REF.a, code: 'C1' }))).err === 'sign-in required'
    && calls.length === 0,
    'internal notes stay inside the branch — the portal has its own endpoints');
  t('client is not a role the trail accepts', !api.QP_TRAIL_ROLES.client);
}
{
  const { api, calls } = load();
  t('an agent opens their own trail and the original handler runs',
    out(api.qpComments_(ev({ ref: REF.a, code: 'A1' }))).ok === true
    && calls.includes('comments_'));
  t('an agent is refused another agent\'s trail',
    out(api.qpComments_(ev({ ref: REF.b, code: 'A1' }))).err === 'not one of your cases');
  t('an agent is refused another agent\'s timeline',
    out(api.qpHistory_(ev({ ref: REF.b, code: 'A1' }))).err === 'not one of your cases');
  t('an agent cannot write onto another agent\'s case',
    out(api.qpAddComment_(ev({ ref: REF.b, code: 'A1', text: 'x' }))).err === 'not one of your cases',
    'with mode=trail this reached the client and the department');
  t('a refused write never reaches addComment_', !calls.includes('addComment_'));
}
{
  const { api } = load();
  t('the branch may comment on any case',
    out(api.qpAddComment_(ev({ ref: REF.b, code: 'B1', text: 'x' }))).ok === true,
    'the branch manager is the last resort and must not be locked out');
}

/* the reply map */
{
  const { api } = load();
  const refs = (code) => Object.keys(out(api.qpReplies_(ev(code ? { code } : {}))).replied || {});

  t('the reply map tells a stranger nothing', refs().length === 0,
    'this was the call that handed out the references');
  t('a signed-out tab gets an empty map, not an error',
    out(api.qpReplies_(ev({}))).ok === true,
    'the dashboard draws fine without it and must not throw');
  t('the branch sees every open case waiting on a department',
    refs('B1').join() === [REF.a, REF.b].join());
  t('a closed case is not in the reply map', !refs('B1').includes(REF.closed));
  t('an agent sees only their own', refs('A1').join() === REF.a);
  t('a manager sees their unit', refs('M1').join() === REF.a);
  t('a staff member sees what is assigned to them', refs('S1').join() === REF.b);
}

/* the manager who looks like an agent — edit 26 */
{
  const { api, PEOPLE } = load();
  const keys = api.qpWhoAsks_({ code: 'M2' });
  t('a manager with no email on file still resolves as a manager',
    keys && keys.role === 'manager');
  t('…but sees only their own book until the email is on file',
    !api.qpMaySeeCase_(PEOPLE.M2, api.qpCaseOwner_(REF.a)),
    'qpAuditTrailScope() is what shows this before anyone notices in the app');
}

/* ---------- the shape of the patch -------------------------------------- */
console.log('\nthe patch\n');

const S14 = PATCH.slice(PATCH.indexOf('14. A REFERENCE IS NOT A CREDENTIAL'));
t('section 14 exists', S14.length > 1000);

t('every wrapper guards before it delegates',
  ['qpComments_', 'qpHistory_', 'qpAddComment_'].every(fn => {
    const i = S14.indexOf('function ' + fn);
    const body = S14.slice(i, S14.indexOf('}', i));
    return /qpGuardTrail_\(e\)/.test(body) && /g\.err \|\|/.test(body);
  }),
  'a wrapper that calls the original first has guarded nothing');

t('section 14 replaces no Code.gs function',
  !/^function (comments_|history_|addComment_|replies_|normName_)\b/m.test(S14),
  'Code.gs is the source of truth and stays the branch\'s');

t('nothing in section 14 writes to a sheet',
  !/\.setValue\(|\.appendRow\(/.test(S14),
  'these are read guards — the writing stays in the handlers they wrap');

t('the audit helper prints no case text',
  !/row\[17\]|\[5\]\s*\]|getValues\(\)\[0\]\[17\]/.test(
    S14.slice(S14.indexOf('function qpAuditTrailScope'))),
  'it reports roles and counts, never a client or a request');

console.log();
process.exit(fail ? 1 : 0);
