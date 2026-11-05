/* Rows that are not requests, spending the sending day as though they were.

   On 5 November 2026 a real query was logged — RRB/2026/119 at 11:32 — and no
   email left the building, because the day's hundred recipients were gone.
   Query Pal's own traffic does not come close to a hundred. Sixteen rows did.

   Every one carried a timestamp of 1970-01-01T00:00:00.000Z: epoch zero, what
   `new Date(d.timestamp)` returns when handed nothing it can parse. The app
   always sends an ISO timestamp and nothing in this repo produces the literal
   {{clientName}} sitting in RRB/2026/109's client column, so these were POSTed
   straight at the webhook by something outside the app.

   deadlineAt_ counts working days forward from 1970, so each one is about
   fifty-seven years overdue. Nine were Open. The sweep chased all nine every
   day, and a real client request had nothing left to send with.

   `if (isNaN(logged)) continue` does not catch it — epoch zero is a valid
   Date, just not one this branch existed on.

   Run: node junk.test.mjs
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

/* 0 ref · 2 timestamp · 3 status · 5 client · 13 dept · 17 subject · 18 desc */
function row(o) {
  const r = Array(29).fill('');
  r[0] = o.ref || 'RRB/2026/109/X/Y';
  r[2] = o.ts === undefined ? new Date('2026-11-05T15:32:00Z') : o.ts;
  r[3] = o.status === undefined ? 'Open' : o.status;
  r[5] = o.client === undefined ? 'Rakesh Lochan' : o.client;
  r[13] = o.dept === undefined ? 'Customer Service – Chaguanas' : o.dept;
  r[17] = o.subject === undefined ? 'Tax Statement' : o.subject;
  r[18] = o.desc === undefined ? 'Please provide the 2025 statement' : o.desc;
  return r;
}

function load(rows) {
  const ROWS = rows || [];
  const CMT = [];
  const sheet = (data) => ({
    getLastRow: () => data.length + 1,
    getMaxColumns: () => 29,
    getRange(a, b, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const bl = [];
      for (let i = 0; i < nr; i++) {
        const s = data[a - 2 + i] || [];
        const c = [];
        for (let j = 0; j < nc; j++) c.push(s[b - 1 + j] === undefined ? '' : s[b - 1 + j]);
        bl.push(c);
      }
      return { getValues: () => bl, getValue: () => bl[0][0],
               setValue: (v) => { if (data[a - 2]) data[a - 2][b - 1] = v; } };
    },
    appendRow: (x) => data.push(x),
  });
  const sandbox = {
    SHEET_NAME: 'Queries', Logger: { log() {} },
    cmtSheet_: () => sheet(CMT),
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet(ROWS) }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpRowLooksJunk_', 'qpJunkReport', 'qpQuarantineJunk', 'QP_VOID_STATUS', 'QP_REAL_FROM'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return { api, ROWS, CMT };
}

/* ---------- what counts as junk ----------------------------------------- */
console.log('\nwhat counts as junk\n');
{
  const { api } = load();
  const why = (o) => api.qpRowLooksJunk_(row(o));

  t('epoch zero is not a real date',
    why({ ts: new Date(0) }).join().includes('not a real date'),
    'the exact value on all 16 rows');
  t('an unparseable timestamp is caught', why({ ts: 'not a date' }).length > 0);
  t('a missing timestamp is caught', why({ ts: '' }).length > 0);
  t('an unfilled placeholder is caught',
    why({ client: '{{clientName}}', subject: '{{subject}}' }).join().includes('placeholder'),
    'RRB/2026/109 carried both');
  t('a row with no client and no department is caught',
    why({ client: '', dept: '' }).join().includes('no client and no department'),
    'rows 055 to 060 are empty');

  t('a real request is left alone', why({}).length === 0);
  t('a real request with no client name but a department is left alone',
    why({ client: '' }).length === 0,
    '27 of 115 rows have gaps — a gap is not junk');
  t('a 2025 request is still real', why({ ts: new Date('2025-06-01') }).length === 0);
}

/* ---------- the quarantine ---------------------------------------------- */
console.log('\nvoiding them\n');
{
  const rows = [
    row({ ref: 'RRB/2026/119/Ricky Rampersad/Premium Req' }),            // today's real one
    row({ ref: 'RRB/2026/109/{{clientName}}/{{subject}}', ts: new Date(0), client: '{{clientName}}' }),
    row({ ref: 'RRB/2026/115/Ricky Rampersad/Policy stat', ts: new Date(0) }),
    row({ ref: 'RRB/2026/117/Ricky tan/Motor', ts: new Date(0), status: 'Closed' }),
  ];
  const { api, ROWS, CMT } = load(rows);

  const dry = api.qpQuarantineJunk(true);
  t('a dry run writes nothing',
    ROWS.every(r => r[3] === 'Open' || r[3] === 'Closed') && CMT.length === 0);
  t('a dry run says so', /DRY RUN/.test(dry));
  t('it names the rows it would void', /RRB\/2026\/109/.test(dry) && /RRB\/2026\/115/.test(dry));
  t("it leaves today's real request out", !/RRB\/2026\/119/.test(dry));

  api.qpQuarantineJunk();
  t('the real request is untouched', ROWS[0][3] === 'Open');
  t('the junk rows are Void', ROWS[1][3] === api.QP_VOID_STATUS && ROWS[2][3] === api.QP_VOID_STATUS);
  t('an already-closed junk row is left alone', ROWS[3][3] === 'Closed',
    'closed rows are skipped by the sweep anyway');
  t('each voided row says why on its trail',
    CMT.length === 2 && /Voided/.test(CMT[0][4]) && /sending limit/.test(CMT[0][4]));
  t('the note is internal', CMT.every(c => c[5] === 'internal'));
}
{
  /* Void must not read as closed, or it fires a survey at whatever address is
     sitting in the client column. */
  const { api } = load();
  const v = api.QP_VOID_STATUS.toLowerCase();
  t('Void does not read as closed to the sweep',
    !/closed|resolved|completed/.test(v),
    'isClosed would fire sendSurvey_ at the client column');
  t('Void does not read as open either, so the sweep skips it',
    v.indexOf('open') === -1,
    'autoSweep: if (status && status.indexOf("open") === -1) continue');
}
{
  const { api, ROWS } = load([row({})]);
  api.qpQuarantineJunk();
  t('a log of only real requests is left entirely alone', ROWS[0][3] === 'Open');
  t('and it says so', /Nothing to void/.test(api.qpQuarantineJunk()));
}

/* ---------- the report --------------------------------------------------- */
console.log('\nthe report\n');
{
  const { api, ROWS } = load([
    row({ ref: 'RRB/2026/115/A/B', ts: new Date(0) }),
    row({ ref: 'RRB/2026/060//', ts: new Date(0), client: '', dept: '', status: 'Closed' }),
    row({ ref: 'RRB/2026/119/C/D' }),
  ]);
  const r = api.qpJunkReport();
  t('it counts the open ones the sweep still works on', /1 OPEN row/.test(r), r.split('\n')[2]);
  t('it counts the harmless closed ones separately', /1 already closed/.test(r));
  t('it changes nothing', ROWS.every(x => x[3] === 'Open' || x[3] === 'Closed'));
}

/* ---------- the shape ---------------------------------------------------- */
console.log('\nthe patch\n');
const section = (name) => {
  const a = PATCH.indexOf(name);
  if (a < 0) return '';
  const rest = PATCH.slice(a + name.length);
  const next = rest.search(/\n\/\* [═=]{10,}/);
  return next > -1 ? PATCH.slice(a, a + name.length + next) : PATCH.slice(a);
};
const S19 = section('19. JUNK ROWS DRAIN THE SENDING DAY');
t('section 19 exists', S19.length > 1000);
t('it never sends email', !/MailApp|GmailApp/.test(S19),
  'these rows have addresses in them that must not be written to');
t('the only column it writes is Status',
  (S19.match(/getRange\(([^)]*)\)\.setValue/g) || []).every(w => /,\s*4\)/.test(w)),
  (S19.match(/getRange\(([^)]*)\)\.setValue/g) || []).join(', '));
t('it can be rehearsed', /function qpQuarantineJunk\(dryRun\)/.test(S19));

console.log();
process.exit(fail ? 1 : 0);
