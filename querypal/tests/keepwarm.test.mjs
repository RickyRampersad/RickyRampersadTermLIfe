/* Do not reassure a client about a request nobody received.

   RRB/2026/098 — Shaun Ali — was logged on 21 October 2026 and its routed
   email never sent. Then the branch told him three times, on 27 and 29 October
   and 3 November, that it was working on it. No department had ever seen the
   request. Fifteen days.

   The keep-warm gate was `CLIENT_UPDATE_ON && row[6]`: updates are on, and the
   client has an address. Nothing asked whether the request had reached anybody,
   so the one case that most needed somebody to notice was the one being
   papered over — and the papering over is what stopped anybody noticing.

   Run: node keepwarm.test.mjs
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

const REF = 'RRB/2026/098/Shaun Ali/Opportunity — Cash Value';
const CLIENT = 'shaun.ali@example.com';

function row(o) {
  const r = Array(29).fill('');
  r[0] = o.ref === undefined ? REF : o.ref;
  r[2] = new Date('2026-10-21T13:32:00Z');
  r[3] = o.status === undefined ? 'Open' : o.status;
  r[5] = 'Shaun Ali';
  r[6] = o.mail === undefined ? CLIENT : o.mail;
  r[13] = 'RR Branch Sales Support';
  r[14] = 'rickyrampersadsalessupport@myguardiangroup.com';
  r[18] = o.desc === undefined ? 'Cash value opportunity | client-updates:3' : o.desc;
  return r;
}

const NOT_EMAILED = (ref) => [new Date('2026-10-21T13:32:51Z'), ref, 'System', 'system',
  '⚠ NOT EMAILED — logged but the routed email did not send.', 'internal'];
const ROUTED = (ref) => [new Date('2026-11-05T09:00:00Z'), ref, 'Query Pal', 'system',
  '✅ ROUTED — the original request reached RR Branch Sales Support at last.', 'internal'];
const UPDATE = (ref, n) => [new Date(), ref, 'System', 'system',
  '✉️ Client progress update #' + n + ' sent (we are working on it)', 'internal'];

function load(opts) {
  const o = opts || {};
  const CMT = o.comments ? o.comments.slice() : [];
  const ROWS = o.rows || [];
  const sheet = (data) => ({
    getLastRow: () => data.length + 1, getMaxColumns: () => 29,
    getRange(a, b, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const bl = [];
      for (let i = 0; i < nr; i++) {
        const s = data[a - 2 + i] || [];
        const c = [];
        for (let j = 0; j < nc; j++) c.push(s[b - 1 + j] === undefined ? '' : s[b - 1 + j]);
        bl.push(c);
      }
      return { getValues: () => bl, getValue: () => bl[0][0], setValue: () => {} };
    },
    appendRow: (x) => data.push(x),
  });
  let reads = 0;
  const sandbox = {
    SHEET_NAME: 'Queries', Logger: { log() {} },
    cmtSheet_: () => { reads++; return sheet(CMT); },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet(ROWS) }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpKeepClientWarm_', 'qpRouteState_', 'qpRouteStateClear_',
                'qpWarmHeldReport', 'QP_WARM_HELD_MARK'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return { api, CMT, ROWS, reads: () => reads };
}

/* ---------- the case itself ---------------------------------------------- */
console.log('\nShaun Ali\n');
{
  const { api, CMT } = load({ comments: [NOT_EMAILED(REF), UPDATE(REF, 1), UPDATE(REF, 2), UPDATE(REF, 3)] });
  t('a client whose request never reached a department is not told it is in hand',
    api.qpKeepClientWarm_(row({})) === false,
    'three of these went out over fifteen days');
  t('and the trail says why, so the silence is visible',
    CMT.some(c => String(c[4]).includes(api.QP_WARM_HELD_MARK)),
    'a case nobody is updating needs somebody to know');
  t('the note is internal, never a client view',
    CMT.filter(c => String(c[4]).includes(api.QP_WARM_HELD_MARK)).every(c => c[5] === 'internal'));
  t('it says the request will be sent, not that it was abandoned',
    CMT.some(c => /sends as the original request/.test(String(c[4]))));
}
{
  const { api, CMT } = load({ comments: [NOT_EMAILED(REF)] });
  api.qpKeepClientWarm_(row({}));
  const first = CMT.length;
  api.qpKeepClientWarm_(row({}));
  api.qpKeepClientWarm_(row({}));
  t('the held-back note is written once, not every sweep',
    CMT.length === first, CMT.length + ' notes after three sweeps');
}

/* ---------- the ordinary case, which must not change --------------------- */
console.log('\nevery other case\n');
{
  const { api, CMT } = load({ comments: [] });
  t('a case that reached its department is updated exactly as before',
    api.qpKeepClientWarm_(row({})) === true);
  t('and nothing is written to its trail', CMT.length === 0);
}
{
  const { api } = load({ comments: [NOT_EMAILED(REF), ROUTED(REF)] });
  t('a case that was unrouted and has since been sent is updated again',
    api.qpKeepClientWarm_(row({})) === true,
    'ROUTED is the later word on the trail, so it wins');
}
{
  const { api } = load({ comments: [NOT_EMAILED('RRB/2026/119/Someone/Else')] });
  t("another case's failure does not hold this client's update",
    api.qpKeepClientWarm_(row({})) === true);
}
{
  const { api } = load({ comments: [NOT_EMAILED(REF)] });
  t('a row with no reference is left to the existing gate',
    api.qpKeepClientWarm_(row({ ref: '' })) === true);
}
{
  /* The sheet failing must not silence every client at once. */
  const api = new Function('SHEET_NAME', 'Logger', 'cmtSheet_', 'SpreadsheetApp',
    PATCH + '\n;return {qpKeepClientWarm_};')(
    'Queries', { log() {} }, () => { throw new Error('unreadable'); },
    { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) });
  t('an unreadable trail leaves the keep-warm alone rather than muting it',
    api.qpKeepClientWarm_(row({})) === true,
    'failing closed here would stop every client update in the branch');
}

/* ---------- the cost, which is why the cache exists ---------------------- */
console.log('\nreading the trail\n');
{
  /* Six ordinary cases: the trail is scanned once and never again. */
  const { api, reads } = load({ comments: [NOT_EMAILED('RRB/2026/900/Not/Here')] });
  for (let i = 0; i < 6; i++) api.qpKeepClientWarm_(row({ ref: 'RRB/2026/00' + i + '/A/B' }));
  t('the trail is scanned once for the whole sweep, not once per case',
    reads() === 1, reads() + ' reads for six cases — 757 rows each time');
}
{
  /* A held case costs one append on top, once, however many sweeps run. */
  const { api, reads } = load({ comments: [NOT_EMAILED(REF)] });
  for (let i = 0; i < 6; i++) api.qpKeepClientWarm_(row({}));
  t('a held case costs one scan and one note, not one of each per sweep',
    reads() === 2, reads() + ' reads — the second is appending the note');
}
{
  const { api, reads } = load({ comments: [NOT_EMAILED(REF)] });
  api.qpKeepClientWarm_(row({}));
  api.qpRouteStateClear_();
  api.qpKeepClientWarm_(row({}));
  t('routing a case clears the cache, so it is not held back on stale state',
    reads() > 1, 'qpChaseOrSend_ calls this after it sends an original');
}

/* ---------- the report --------------------------------------------------- */
console.log('\nthe report\n');
{
  const rows = [row({}), row({ ref: 'RRB/2026/120/Natasha Griffith/Direct debit' })];
  const { api } = load({ rows, comments: [NOT_EMAILED(REF)] });
  const r = api.qpWarmHeldReport();
  t('it names the client being told nothing', r.includes('RRB/2026/098'));
  t('it shows how many updates already went out untruthfully', /3 progress update/.test(r));
  t('it leaves cases that did reach their department out', !r.includes('RRB/2026/120'));
  t('it says what fixes it', /edit 32/.test(r));
}
{
  const { api } = load({ rows: [row({})], comments: [] });
  t('a branch with nothing held back is told so plainly',
    /Nothing is being held back/.test(api.qpWarmHeldReport()));
}

/* ---------- the shape --------------------------------------------------- */
console.log('\nthe patch\n');
const section = (name) => {
  const a = PATCH.indexOf(name);
  if (a < 0) return '';
  const rest = PATCH.slice(a + name.length);
  const next = rest.search(/\n\/\* [═=]{10,}/);
  return next > -1 ? PATCH.slice(a, a + name.length + next) : PATCH.slice(a);
};
const S22 = section('22. DO NOT REASSURE A CLIENT');
t('section 22 exists', S22.length > 1000);
t('it sends no email of its own', !/MailApp|GmailApp/.test(S22),
  'it decides whether an email goes, it does not send one');
t('it writes no sheet column', !/\.setValue\(/.test(S22),
  'the row is the branch\'s record');
t('qpChaseOrSend_ drops the cache when it routes a case',
  /qpRouteStateClear_\(\)/.test(PATCH.slice(PATCH.indexOf('function qpChaseOrSend_'))));

console.log();
process.exit(fail ? 1 : 0);
