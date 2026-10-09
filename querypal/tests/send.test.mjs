/* The submit path, both ends of it.

   On 9 October 2026 the branch's site was posted on Facebook with 25 of the
   day's 100 email recipients left. The page did not check whether the backend
   had succeeded: it read `d.reference` and showed the success screen either
   way. So the failure that was hours away looked like this — the row is
   written, the routed email throws on the quota, doPost answers
   {ok:false}, and the client is shown a reference and told their request is
   with a department that has never heard of it.

   These tests fail if that silence ever comes back.

   Run: node send.test.mjs
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

/* ---------- the page ---------------------------------------------------- */
console.log('\nthe page\n');

t('the submit handler checks d.ok before claiming success',
  /if\s*\(\s*d\s*&&\s*d\.ok\s*===\s*false\s*\)\s*return\s+sendFailed/.test(APP),
  'a backend answering {ok:false} must not reach renderSuccess');

t('a network failure is not treated as a send',
  /\.catch\(\(\)=>\{clearTimeout\(to\);sendFailed\(/.test(APP),
  'the catch used to call finish(), which showed the success screen');

t('the failure card names the branch, not a guess',
  APP.includes('sendFailed') && /tel:\+18686653279/.test(APP.slice(APP.indexOf('function sendFailed'))),
  'the card must carry the same number the rest of the site carries');

t('a failed attempt does not trip the duplicate guard on retry',
  /m\[window\._dupfp\]=\{at:Date\.now\(\),failed:true\}/.test(APP) && /hit\.failed/.test(APP),
  'the client must be able to press Send again without a scary confirm');

t('a logged-but-unrouted case still shows a real reference',
  /p\._mailed===false/.test(APP) && APP.includes('notMailed'),
  'the reference is real even when the email did not go - do not withhold it');

t('the summary does not claim copies that were never sent',
  /Not yet \\u2014 branch will route by hand/.test(APP),
  '"Copied to: You, agent & branch support" was printed unconditionally');

t('a public flood cannot take the branch sending day with it',
  /if\(state\.who==='Client'\)\{/.test(APP) && /qprate/.test(APP) && /st\.length>=6/.test(APP),
  'the client path has no sign-in, so the quota is what a joker can drain');

t('the throttle never applies to agents or staff',
  /if\(state\.who==='Client'\)\{[\s\S]{0,900}?qprate/.test(APP),
  'logging many requests is an agent\'s job');

/* ---------- the backend ------------------------------------------------- */
console.log('\nthe backend\n');

/* Load the patch with just enough of Apps Script around it. */
function load(opts) {
  const o = opts || {};
  const comments = [];
  const painted = [];
  const sandbox = {
    SHEET_NAME: 'Queries',
    CMT_TAB: 'Comments',
    Logger: { log() {} },
    MailApp: {
      getRemainingDailyQuota() {
        if (o.quotaThrows) throw new Error('no quota service');
        return o.quota;
      }
    },
    sendRoutedEmail(d) {
      if (o.sendThrows) throw new Error('Service invoked too many times for one day: email.');
      o.sent = d;
    },
    cmtSheet_: () => ({ appendRow: (r) => comments.push(r) }),
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) }
  };
  const sheet = {
    getLastRow: () => 3,
    getRange: () => ({
      getValues: () => [['Reference'], ['RRB/2026/001/X'], ['RRB/2026/002/Y']],
      setValue: () => {},
      setBackground: (c) => { painted.push(c); return {}; }
    }),
    getDataRange: () => ({ getValues: () => [['Reference'], ['RRB/2026/002/Y']] })
  };
  const names = Object.keys(sandbox);
  const body = PATCH + '\n;return {' +
    ['qpTrimCcForQuota_', 'qpSendRouted_', 'qpQuotaLeft_', 'qpFlagUnsent_'].join(',') + '};';
  const api = new Function(...names, body)(...names.map(n => sandbox[n]));
  return { api, comments, painted, sheet, opts: o };
}

const CC = 'rickyrampersadsalessupport@myguardiangroup.com,support@rickyrampersadbranch.com,'
         + 'agent@myguardiangroup.com,client@gmail.com';
const req = () => ({ cc: CC, email: 'client@gmail.com', departmentEmail: 'dept@myguardiangroup.com' });

{
  const { api } = load({ quota: 80 });
  const d = req();
  const note = api.qpTrimCcForQuota_(d);
  t('with quota in hand nothing is trimmed', note === '' && d.cc === CC, 'cc became: ' + d.cc);
}
{
  const { api } = load({ quota: 10 });
  const d = req();
  api.qpTrimCcForQuota_(d);
  t('running low, the internal copies go and the client keeps theirs',
    d.cc === 'client@gmail.com', 'cc became: ' + d.cc);
}
{
  const { api } = load({ quota: 3 });
  const d = req();
  api.qpTrimCcForQuota_(d);
  t('nearly out, the department alone', d.cc === '', 'cc became: ' + d.cc);
}
{
  const { api } = load({ quota: 1 });
  const d = req();
  api.qpTrimCcForQuota_(d);
  t('the department address is never what gets dropped',
    d.departmentEmail === 'dept@myguardiangroup.com');
}
{
  const { api } = load({ quotaThrows: true });
  const d = req();
  api.qpTrimCcForQuota_(d);
  t('an unreadable quota is not a reason to drop anybody', d.cc === CC, 'cc became: ' + d.cc);
}
{
  const l = load({ quota: 80 });
  const ok = l.api.qpSendRouted_(req(), l.sheet, 'RRB/2026/002/Y');
  t('a good send answers true and writes no note',
    ok === true && l.comments.length === 0, JSON.stringify(l.comments));
}
{
  const l = load({ quota: 80, sendThrows: true });
  let threw = false, ok = null;
  try { ok = l.api.qpSendRouted_(req(), l.sheet, 'RRB/2026/002/Y'); } catch (e) { threw = true; }
  t('a failed send never throws out of doPost', !threw, 'doPost would lose the reference');
  t('a failed send answers false', ok === false);
  t('a failed send is flagged on the trail',
    l.comments.length === 1 && /NOT EMAILED/.test(l.comments[0][4]));
  t('the flag is an internal note, never client-visible',
    l.comments.length === 1 && l.comments[0][5] === 'internal',
    JSON.stringify(l.comments[0]));
}
{
  const l = load({ quota: 10 });
  l.api.qpSendRouted_(req(), l.sheet, 'RRB/2026/002/Y');
  t('held-back copies are recorded, so nobody wonders why they got no copy',
    l.comments.length === 1 && /Sending limit low/.test(l.comments[0][4]),
    JSON.stringify(l.comments));
}

/* The autopilot owns columns 23-29. A note written into the Follow-ups count
   would stop every chase in the branch, which is how the first draft of this
   was wrong. */
t('nothing in section 13 writes to the autopilot columns',
  !/getRange\([^)]*,\s*2[3-9]\)\s*\.setValue/.test(PATCH.slice(PATCH.indexOf('13. THE DEPARTMENT EMAIL'))),
  'columns 23-29 are Follow-ups, Last Follow-up, Survey Sent, Score, Feedback, Dept Replied, Assigned To');

console.log();
process.exit(fail ? 1 : 0);
