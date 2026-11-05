/* A request that never sent needs sending, not chasing.

   RRB/2026/119 was logged at 11:32 on 5 November 2026 and its routed email
   could not be delivered — the day's quota was gone. Section 13 wrote NOT
   EMAILED on the trail, honestly, and then nothing ever sent it. The case
   would have waited for its turnaround to expire and then sent the department
   "following up on the request below — our records still show it open" for a
   request they had never seen.

   The quota was gone because sixteen rows carried a timestamp of epoch zero:
   doPost stores `new Date(d.timestamp)` with nothing in between, so a payload
   with no timestamp field becomes a request from 1970, about fifty-seven
   years overdue, chased every single sweep.

   Those rows are the branch's respond.io test — RRB/2026/109 carries the
   literal {{clientName}} and {{subject}}, respond.io's own template syntax,
   and its payload has no timestamp. So the fix has to make respond.io work,
   not block it: qpStamp_ gives a missing or impossible timestamp the moment
   it arrived, and the request takes a normal place in the loop.

   Run: node resend.test.mjs
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

const DEPT = 'rickyrampersadsalessupport@myguardiangroup.com';
const REF = 'RRB/2026/119/Ricky Rampersad/Premium Request - TO Hol';

function row(o) {
  const r = Array(29).fill('');
  r[0] = o.ref || REF;
  r[2] = o.ts === undefined ? new Date('2026-11-05T15:32:00Z') : o.ts;
  r[3] = 'Open'; r[5] = 'Ricky Rampersad'; r[6] = 'client@example.com';
  r[9] = o.agent || ''; r[10] = o.agentMail || '';
  r[12] = 'Premium Overdue - Conservation Follow-up';
  r[13] = 'RR Branch Sales Support';
  r[14] = o.deptMail === undefined ? DEPT : o.deptMail;
  r[15] = '1 day'; r[16] = 'Escalation';
  r[17] = 'Premium Request - TO Hold'; r[18] = o.desc || 'Please hold the premium.';
  r[28] = 'Azariah Griffith';
  return r;
}

function load(opts) {
  const o = opts || {};
  const CMT = o.comments || [];
  const chased = [];
  const routed = [];
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
  const sandbox = {
    SHEET_NAME: 'Queries', Logger: { log() {} },
    Session: { getScriptTimeZone: () => 'America/Port_of_Spain' },
    Utilities: { formatDate: (d) => '5 Nov 2026' },
    cmtSheet_: () => sheet(CMT),
    sendFollowUp_: (r, n) => chased.push({ ref: r[0], n }),
    sendRoutedEmail: (d) => { if (o.sendThrows) throw new Error('quota'); routed.push(d); },
    MailApp: { getRemainingDailyQuota: () => (o.quota === undefined ? 90 : o.quota) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet(o.rows || []) }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpStamp_', 'qpNeverEmailed_', 'qpChaseOrSend_', 'qpRequestFromRow_',
                'qpUnroutedReport', 'QP_REAL_FROM'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return { api, CMT, chased, routed };
}

const NOT_EMAILED = (ref) => [new Date(), ref, 'Query Pal', 'system',
  '⚠ NOT EMAILED — logged but the routed email did not send.', 'internal'];
const ROUTED = (ref) => [new Date(), ref, 'Query Pal', 'system',
  '✅ ROUTED — the original request reached the department at last.', 'internal'];

/* ---------- the timestamp, which is what respond.io needs --------------- */
console.log('\nthe timestamp\n');
{
  const { api } = load();
  const now = Date.now();

  t('a payload with no timestamp is stamped with now, not 1970',
    Math.abs(api.qpStamp_(undefined).getTime() - now) < 5000,
    'respond.io sends no timestamp field — this is the whole bug');
  t('an empty string is stamped with now',
    Math.abs(api.qpStamp_('').getTime() - now) < 5000);
  t('an unparseable value is stamped with now',
    Math.abs(api.qpStamp_('not a date').getTime() - now) < 5000);
  t('epoch zero is stamped with now',
    Math.abs(api.qpStamp_(new Date(0)).getTime() - now) < 5000,
    'the exact value on all 16 rows');

  const real = '2026-11-05T15:32:00.000Z';
  t('a real ISO timestamp is kept exactly',
    api.qpStamp_(real).toISOString() === real,
    'the app sends this and it must pass through untouched');
  t('a real Date object is kept exactly',
    api.qpStamp_(new Date(real)).toISOString() === real);
  t('a 2025 date is still real', api.qpStamp_('2025-06-01T00:00:00.000Z').getFullYear() === 2025);
}

/* ---------- send the original, not a chase ------------------------------ */
console.log('\nwhat gets sent\n');
{
  const { api, CMT, chased, routed } = load({ comments: [NOT_EMAILED(REF)] });
  const what = api.qpChaseOrSend_(row({}), 1, new Date(), false, null, 0);

  t('a case that never sent gets the original, not a follow-up',
    what === 'sent-original' && routed.length === 1 && chased.length === 0,
    what + ' | routed ' + routed.length + ' | chased ' + chased.length);
  t('it goes to the right department', routed[0] && routed[0].departmentEmail === DEPT);
  t('the request text survives', /Please hold the premium/.test(routed[0].description));
  t('it says why they are only seeing it now',
    /could not be delivered at the time/.test(routed[0].description));
  t('it is honest that attachments are gone',
    /attachments will need to be requested/.test(routed[0].description),
    'they rode on the original POST and were never stored');
  t('ROUTED is written so it is not sent twice',
    CMT.some(c => /ROUTED/.test(String(c[4]))));
}
{
  const { api, chased, routed } = load({ comments: [NOT_EMAILED(REF), ROUTED(REF)] });
  const what = api.qpChaseOrSend_(row({}), 2, new Date(), false, null, 0);
  t('once routed, later chases are ordinary follow-ups',
    what === 'chased' && chased.length === 1 && routed.length === 0, what);
}
{
  const { api, chased, routed } = load({ comments: [] });
  const what = api.qpChaseOrSend_(row({}), 1, new Date(), false, null, 0);
  t('a case that did send is chased as normal',
    what === 'chased' && chased.length === 1 && routed.length === 0, what);
}
{
  const { api, CMT } = load({ comments: [NOT_EMAILED(REF)], sendThrows: true });
  const what = api.qpChaseOrSend_(row({}), 1, new Date(), false, null, 0);
  t('a resend that fails keeps the flag and tries again next sweep',
    what === 'send-failed' && !CMT.some(c => /✅ ROUTED/.test(String(c[4]))),
    what + ' — clearing it on failure would strand the case for good');
}
{
  const { api, chased, routed } = load({ comments: [NOT_EMAILED(REF)] });
  const what = api.qpChaseOrSend_(row({ deptMail: '' }), 1, new Date(), false, null, 0);
  t('with no department address there is nothing to send to, so it chases',
    what === 'chased' && routed.length === 0, what);
}
{
  /* The flag belongs to one case only. */
  const { api, chased, routed } = load({ comments: [NOT_EMAILED('RRB/2026/105/Other/Case')] });
  const what = api.qpChaseOrSend_(row({}), 1, new Date(), false, null, 0);
  t('another case\'s flag does not trigger a resend here',
    what === 'chased' && routed.length === 0, what);
}

/* ---------- the row rebuild --------------------------------------------- */
console.log('\nrebuilding the request\n');
{
  const { api } = load();
  const d = api.qpRequestFromRow_(row({ agent: 'Fawwaz Mohamed', agentMail: 'f@g.com' }));
  for (const [k, v] of [['reference', REF], ['client', 'Ricky Rampersad'],
                        ['departmentEmail', DEPT], ['priority', 'Escalation'],
                        ['turnaround', '1 day'], ['assignedStaff', 'Azariah Griffith'],
                        ['agent', 'Fawwaz Mohamed'], ['subject', 'Premium Request - TO Hold']])
    t('it carries the ' + k, d[k] === v, k + ' = ' + JSON.stringify(d[k]));
}

/* ---------- the report --------------------------------------------------- */
console.log('\nthe report\n');
{
  const rows = [row({}), row({ ref: 'RRB/2026/120/A/B' })];
  const { api } = load({ rows, comments: [NOT_EMAILED(REF)] });
  const r = api.qpUnroutedReport();
  t('it names the case waiting on its original', r.includes('RRB/2026/119'));
  t('it leaves cases that did send out', !r.includes('RRB/2026/120'));
  t('it says what will happen next', /sends each one as the request itself/.test(r));
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
const S20 = section('20. A REQUEST THAT NEVER SENT');
t('section 20 exists', S20.length > 1000);
t('it writes no sheet column', !/\.setValue\(/.test(S20),
  'the row is the branch\'s record — this only decides what to send');
t('the resend goes through section 13, so quota trimming still applies',
  /qpSendRouted_\(d, sh, ref\)/.test(S20));

console.log();
process.exit(fail ? 1 : 0);
