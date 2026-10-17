/* Which thread a chase attaches itself to.

   On 17 October 2026 the branch manager opened follow-up 1 of 3 for
   RRB/2026/092 and found it under the subject

       Re: We are working on your Direct Debit payment not actioned. request

   That is sendClientUpdate_'s subject line, not the department's. The chase
   had replied inside the CLIENT's keep-warm thread, so text written for a
   department — "our records still show it open, kindly reply to this thread
   with a status or completion confirmation" — was delivered to the client.

   Two faults, both in deptThread_ and both copied into qpFindThread_:

     1. `blob.indexOf('myguardiangroup.com') > -1` counted as proof the thread
        was the department's. The script SENDS from that domain, so every
        thread it has ever created matched itself — the keep-warm note
        included.
     2. When nothing matched it returned threads[0] regardless. Gmail returns
        newest first, so a keep-warm note sent today outranked the real
        department thread from four days earlier.

   The same root cause ran through reply detection: the newest thread's newest
   non-us message was recorded as "Department replied", so a client's own words
   could be fed to classifyReply_ and auto-close their case.

   Run: node thread-match.test.mjs
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

const ME = 'ricky.rampersad@myguardiangroup.com';          // the script's own account
const DEPT = 'gloc.premium@myguardiangroup.com';
const CLIENT = 'vijay.rooplal@gmail.com';
const OFFICER = 'anita.boodram@myguardiangroup.com';       // a real department officer

const msg = (o) => ({
  getTo: () => o.to || '', getCc: () => o.cc || '', getFrom: () => o.from || '',
  getDate: () => o.at || new Date('2026-10-13'),
  getPlainBody: () => o.body || '', getBody: () => o.body || '',
});
const thread = (name, msgs) => ({ _name: name, getMessages: () => msgs });

/* The two threads that exist for case 092, newest first — which is the order
   GmailApp.search returns and the order that caused this. */
const KEEPWARM = thread('keep-warm', [
  msg({ from: ME, to: CLIENT, at: new Date('2026-10-17T09:00:00Z'),
        body: 'We are working on your request.' }),
]);
const DEPTTHREAD = thread('department', [
  msg({ from: ME, to: DEPT, cc: CLIENT + ',' + ME, at: new Date('2026-10-13T06:16:00Z'),
        body: 'New Direct Debit request' }),
  msg({ from: OFFICER, to: ME, at: new Date('2026-10-13T11:00:00Z'),
        body: 'Received, we are checking the mandate.' }),
]);

function load(searchResults) {
  const sandbox = {
    SHEET_NAME: 'Queries',
    Logger: { log() {} },
    clean: (s) => String(s || '').replace(/[\/\\]/g, ' ').replace(/\s+/g, ' ').trim(),
    Session: { getEffectiveUser: () => ({ getEmail: () => ME }) },
    GmailApp: { search: () => searchResults },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpFindThread_', 'qpExternalReply_', 'qpMe_', 'qpThreadQueries_'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return api;
}

const row092 = (() => {
  const r = Array(29).fill('');
  r[0] = 'RRB/2026/092/Vijay Rooplal/Direct Debit September R';
  r[5] = 'Vijay Rooplal'; r[6] = CLIENT;
  r[13] = 'GLOC Premium Query'; r[14] = DEPT;
  r[17] = 'Direct Debit September R';
  return r;
})();

/* ---------- picking the thread ------------------------------------------ */
console.log('\npicking the thread\n');
{
  /* The exact situation: Gmail lists the keep-warm first. */
  const api = load([KEEPWARM, DEPTTHREAD]);
  const f = api.qpFindThread_(row092[0], DEPT, 'Vijay Rooplal - Direct Debit September R');
  t('the client keep-warm thread is not mistaken for the department',
    f.thread && f.thread._name === 'department',
    'picked: ' + (f.thread ? f.thread._name : 'null') + ' (' + f.how + ')');
}
{
  const api = load([KEEPWARM]);
  const f = api.qpFindThread_(row092[0], DEPT, 'x');
  t('with only a client thread, it finds nothing rather than guessing',
    f.thread === null && f.how === 'no-department-thread',
    'got: ' + f.how + ' — the fallback to threads[0] is what delivered a chase to the client');
}
{
  /* Our own From carries the corporate domain. That must never qualify. */
  const ours = thread('ours-only', [msg({ from: ME, to: CLIENT })]);
  const api = load([ours]);
  t('our own address on the corporate domain proves nothing',
    api.qpFindThread_(row092[0], DEPT, 'x').thread === null,
    'this self-match is why every thread the script sent looked like the department');
}
{
  /* A department officer replying from an address we never wrote to. */
  const replied = thread('officer', [msg({ from: OFFICER, to: ME })]);
  const api = load([replied]);
  const f = api.qpFindThread_(row092[0], DEPT, 'x');
  t('a genuine reply from the department is still recognised',
    f.thread !== null && /reply-from-dept/.test(f.how), f.how);
}
{
  const api = load([DEPTTHREAD]);
  t('the department thread is found by its address even when the client is CC\'d',
    api.qpFindThread_(row092[0], DEPT, 'x').thread !== null,
    'sendRoutedEmail CCs the client, so their presence must not disqualify it');
}
{
  /* TERM routes to two addresses at once. */
  const pair = 'GIA.TaskRequest@myguardiangroup.com,Ricardo.Seereeram@myguardiangroup.com';
  const second = thread('second-of-pair', [msg({ from: ME, to: 'ricardo.seereeram@myguardiangroup.com' })]);
  const api = load([second]);
  t('a comma-separated department list matches on any one of them',
    api.qpFindThread_(row092[0], pair, 'x').thread !== null);
}
{
  const api = load([]);
  t('no search results is not an error', api.qpFindThread_(row092[0], DEPT, 'x').thread === null);
}

/* ---------- reply detection --------------------------------------------- */
console.log('\nwhose reply it is\n');
{
  const api = load([KEEPWARM, DEPTTHREAD]);
  const r = api.qpExternalReply_(row092);
  t('the department officer is read as the reply',
    r && /checking the mandate/.test(r.text), JSON.stringify(r && r.text));
}
{
  /* The client answers their own keep-warm note. */
  const clientReplied = thread('keep-warm', [
    msg({ from: ME, to: CLIENT, at: new Date('2026-10-17T09:00:00Z') }),
    msg({ from: CLIENT, to: ME, at: new Date('2026-10-17T10:00:00Z'),
          body: 'Thanks, that is sorted now.' }),
  ]);
  const api = load([clientReplied]);
  t('a client answering their own update is NOT a department reply',
    api.qpExternalReply_(row092) === null,
    'classifyReply_ reads "that is sorted" as resolved and auto-closes the case');
}
{
  const onlyUs = thread('department', [msg({ from: ME, to: DEPT })]);
  const api = load([onlyUs]);
  t('our own message is never counted as a reply',
    api.qpExternalReply_(row092) === null);
}
{
  const api = load([KEEPWARM]);
  t('no department thread means no reply, not a guessed one',
    api.qpExternalReply_(row092) === null,
    'silence is the honest answer');
}

/* ---------- the shape of the fix ---------------------------------------- */
console.log('\nthe patch\n');
{
  const fn = PATCH.slice(PATCH.indexOf('function qpFindThread_'),
                         PATCH.indexOf('function qpMe_') > PATCH.indexOf('function qpFindThread_')
                           ? PATCH.length : PATCH.indexOf('\nfunction ', PATCH.indexOf('function qpFindThread_') + 10));
  const body = PATCH.slice(PATCH.indexOf('function qpFindThread_'),
                           PATCH.indexOf('function qpExternalReply_'));

  t('the bare domain test is gone',
    !/\(want && blob\.indexOf\(want\) > -1\) \|\| blob\.indexOf\('myguardiangroup\.com'\)/.test(body),
    'it matched our own From on every thread we ever sent');

  t('there is no fallback to the first search result',
    !/return \{ thread: threads\[0\]/.test(body),
    'threads[0] is the newest, which once a keep-warm exists is the client');

  t('a corporate From only counts when it is not ours',
    /from\.indexOf\('myguardiangroup\.com'\) > -1 && \(!me \|\| from\.indexOf\(me\) === -1\)/.test(body));

  t('failing to find a thread is stated, not papered over',
    /no-department-thread/.test(body));
}
t('section 16 never sends anything',
  !/MailApp|\.replyAll\(|\.reply\(/.test(PATCH.slice(PATCH.indexOf('16. A CLIENT'))),
  'it decides whose reply it is — the sending stays where it was');

console.log();
process.exit(fail ? 1 : 0);
