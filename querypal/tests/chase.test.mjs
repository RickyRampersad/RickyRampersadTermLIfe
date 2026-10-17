/* The chase that missed the department.

   Case RRB/2026/081 — a health claim routed to EB Customer Care on 17
   September — fired reminder 5 of 10 on 11 October. The branch manager read
   the email and asked why it had neither the trail nor the department on it.
   Both answers were in the email itself.

   The department: sendFollowUp_ replies inside the original Gmail thread when
   it can find it, which reaches everyone the request went to. When the search
   misses it sends a fresh email instead, and that fallback addressed
   `to: (sup ? RR_SUPPORT : row[14])` with `cc: [row[10], mgr, BRANCH_SUPPORT]`.
   For a health or claims case `sup` is true, so column 15 — the department
   email — appeared nowhere at all. The cases chased ten times instead of three
   were exactly the ones where the department was dropped.

   The trail: the client keep-warm block read its counter from `row[18]`
   (column 19, Description) and wrote it back to `getRange(r + 1, 18)`
   (column 18, Subject). Reading one column and writing the next meant the
   counter never advanced — eleven progress updates to one client, every one
   headed "#1" — and the Subject was overwritten with the Description plus
   ` | client-updates:1`. The reminder printed the same sentence twice, the
   second time with the marker still on it. And because the chase subject is
   built from column 18, every chase carried a different subject from the
   request it was chasing, so nothing about it looked like a reply.

   Run: node chase.test.mjs
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

const DEPT = 'ebcustomercare@myguardiangroup.com';
const AGENT = 'agent@myguardiangroup.com';
const MGR = 'nicole.manager@myguardiangroup.com';
const SUPPORT = 'support@rickyrampersadbranch.com';

/* A row as the sheet holds it: 0-indexed, so row[17] is column 18. */
function row(o) {
  const r = Array(29).fill('');
  r[0] = o.ref || 'RRB/2026/081/Sharleen Dean/Explanation for a claim';
  r[3] = o.status || 'Open';
  r[10] = o.agentEmail === undefined ? AGENT : o.agentEmail;
  r[12] = o.qtype || 'Query - Health Claim';
  r[13] = o.dept || 'EB Customer Care';
  r[14] = o.deptEmail === undefined ? DEPT : o.deptEmail;
  r[17] = o.subject === undefined ? 'Explanation for a claim' : o.subject;
  r[18] = o.description === undefined ? 'A claim for the client\'s son was deemed ineligible.' : o.description;
  r[22] = o.followups || 0;
  return r;
}

function load() {
  const written = [];
  const ROWS = [];
  const sheet = {
    getLastRow: () => ROWS.length + 1,
    getMaxColumns: () => 29,
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const block = [];
      for (let i = 0; i < nr; i++) {
        const src = ROWS[r - 2 + i] || [];
        const cells = [];
        for (let j = 0; j < nc; j++) cells.push(src[c - 1 + j] === undefined ? '' : src[c - 1 + j]);
        block.push(cells);
      }
      return {
        getValues: () => block,
        getValue: () => block[0][0],
        setValue: (v) => { written.push({ row: r, col: c, value: v }); if (ROWS[r - 2]) ROWS[r - 2][c - 1] = v; },
      };
    }
  };
  const sandbox = {
    SHEET_NAME: 'Queries',
    BRANCH_SUPPORT: SUPPORT,
    RR_SUPPORT: 'rickyrampersadsalessupport@myguardiangroup.com',
    Logger: { log() {} },
    json: (o) => ({ getContent: () => JSON.stringify(o), _o: o }),
    isSupportCase_: (a, b, c) => /health & medical|health claim|claims health/i.test(
      String(a || '') + ' ' + String(b || '') + ' ' + String(c || '')),
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpChaseCc_', 'qpSubjectFromRef_', 'qpSubjectDamaged_',
                'qpRepairSubjects', 'qpChaseAudit', 'qpFoldChases_'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return { api, ROWS, written };
}

/* ---------- the department is on every chase ---------------------------- */
console.log('\nthe recipients\n');
{
  const { api } = load();
  const cc = api.qpChaseCc_(row({}), MGR, true);

  t('a support chase now carries the department', cc.includes(DEPT),
    'this is the whole bug — EB Customer Care got none of the five reminders');
  t('it still carries the agent, the manager and branch support',
    cc.includes(AGENT) && cc.includes(MGR) && cc.includes(SUPPORT), cc);

  const plain = api.qpChaseCc_(row({ qtype: 'Query - Policy Change' }), MGR, false);
  t('an ordinary chase is unchanged — the department is already in To',
    !plain.includes(DEPT) && plain.includes(AGENT) && plain.includes(SUPPORT), plain);
}
{
  const { api } = load();
  t('a blank servicing agent does not put an empty address on the email',
    !/,,|^,|,$/.test(api.qpChaseCc_(row({ agentEmail: '' }), MGR, true)),
    'case 081 has no servicing agent at all');
  t('a case with no department email does not break the chase',
    api.qpChaseCc_(row({ deptEmail: '' }), MGR, true).includes(SUPPORT));
  t('nobody is copied twice',
    (() => { const l = api.qpChaseCc_(row({ agentEmail: SUPPORT }), SUPPORT, true).split(',');
             return new Set(l).size === l.length; })(),
    'every duplicate CC spends another of the day\'s hundred recipients');
}

/* ---------- the damaged subject ----------------------------------------- */
console.log('\nthe subject\n');
{
  const { api } = load();
  t('the subject is recoverable from the reference',
    api.qpSubjectFromRef_('RRB/2026/081/Sharleen Dean/Explanation for a claim')
      === 'Explanation for a claim');
  t('a reference with no subject segment recovers nothing',
    api.qpSubjectFromRef_('RRB/2026/081/Sharleen Dean') === '',
    'returning a guess would write junk into the sheet');
  t('the TERM reference shape is not mistaken for a subject',
    api.qpSubjectFromRef_('RRB/2026/1011/143022/TERM') === 'TERM');

  const desc = 'A claim for the client\'s son was deemed ineligible.';
  t('a subject carrying the keep-warm marker is damaged',
    api.qpSubjectDamaged_(desc + ' | client-updates:1', desc));
  t('a subject carrying the conversion marker is damaged',
    api.qpSubjectDamaged_(desc + ' | conv-reminders:2', desc));
  t('a subject overwritten before any marker is damaged',
    api.qpSubjectDamaged_(desc, desc),
    'the first write copies the description with no marker yet');
  t('a real subject is left alone',
    !api.qpSubjectDamaged_('Explanation for a claim', desc));
  t('an empty subject is not called damaged',
    !api.qpSubjectDamaged_('', desc),
    'a blank subject is a logging gap, not keep-warm damage');
}

/* ---------- the repair -------------------------------------------------- */
console.log('\nthe repair\n');
{
  const { api, ROWS, written } = load();
  const desc = 'A claim for the client\'s son was deemed ineligible.';
  ROWS.push(row({ subject: desc + ' | client-updates:1', description: desc }));
  ROWS.push(row({ ref: 'RRB/2026/082/Anil Singh/Tax statement', subject: 'Tax statement' }));
  ROWS.push(row({ ref: 'RRB/2026/083/No Subject Here', subject: desc, description: desc }));

  const dry = api.qpRepairSubjects(true);
  t('a dry run writes nothing', written.length === 0, JSON.stringify(written));
  t('a dry run says so', /DRY RUN/.test(dry));
  t('the dry run names the row it would repair', /RRB\/2026\/081/.test(dry));
  t('the dry run leaves the healthy row out', !/RRB\/2026\/082/.test(dry));
  t('a row it cannot recover is reported, not guessed at',
    /RRB\/2026\/083/.test(dry) && /by hand/.test(dry));

  const real = api.qpRepairSubjects();
  t('the repair writes only the subject column',
    written.length === 1 && written[0].col === 18, JSON.stringify(written));
  t('the repair restores the subject from the reference',
    written[0].value === 'Explanation for a claim', String(written[0].value));
  t('the repair says the truncation is the reference\'s own',
    /24 characters/.test(real),
    'a long subject comes back short and the branch should know why');

  const again = api.qpRepairSubjects();
  t('running it twice changes nothing more', written.length === 1);
  t('the second run says there is nothing to do', /No damaged subjects found/.test(again));
}

/* ---------- the audit --------------------------------------------------- */
{
  const { api, ROWS } = load();
  const desc = 'A claim for the client\'s son was deemed ineligible.';
  ROWS.push(row({ subject: desc + ' | client-updates:1', description: desc, followups: 5 }));
  ROWS.push(row({ ref: 'RRB/2026/082/Anil Singh/Tax statement', subject: 'Tax statement', followups: 2 }));
  const a = api.qpChaseAudit();
  t('the audit counts the chases that could not thread', /chases sent on those rows\s*: 5/.test(a), a);
  t('the audit separates the support cases, where the department was dropped',
    /of those, support cases\s*: 5/.test(a));
  t('the audit leaves healthy rows out of the count',
    /subjects overwritten\s*: 1/.test(a));
}

/* ---------- the timeline stops inventing dates -------------------------- */
console.log('\nthe timeline\n');
{
  const { api } = load();
  const folded = api.qpFoldChases_({
    ok: true,
    events: [
      { kind: 'logged', when: '2026-09-17T10:00:00.000Z', text: 'Request logged' },
      { kind: 'chase', when: '2026-10-10T10:00:00.000Z', text: 'Follow-up 1' },
      { kind: 'chase', when: '2026-10-10T10:00:00.000Z', text: 'Follow-up 2' },
      { kind: 'chase', when: '2026-10-10T10:00:00.000Z', text: 'Follow-up 3' },
      { kind: 'chase', when: '2026-10-10T10:00:00.000Z', text: 'Follow-up 4' },
      { kind: 'chase', when: '2026-10-10T10:00:00.000Z', text: 'Final escalation' },
      { kind: 'reply', when: '2026-10-05T09:00:00.000Z', text: 'Department replied on the trail' },
    ]
  });
  const chases = folded.events.filter(e => e.kind === 'chase');
  t('five chases on one date become one event', chases.length === 1,
    chases.length + ' chase events');
  t('the event states the real count', /5 follow-ups sent/.test(chases[0].text));
  t('it says the individual dates are not recorded',
    /not recorded/.test(chases[0].text),
    'five identical dates read as five chases in one day');
  t('a final escalation is still called one', /final escalation/i.test(chases[0].text));
  t('the other events survive',
    folded.events.some(e => e.kind === 'logged') && folded.events.some(e => e.kind === 'reply'));
  t('the timeline is still in order',
    folded.events.map(e => e.when).join() ===
    folded.events.map(e => e.when).sort().join());
}
{
  const { api } = load();
  const none = api.qpFoldChases_({ ok: true, events: [{ kind: 'logged', when: 'a', text: 'x' }] });
  t('a case never chased gains no chase event',
    !none.events.some(e => e.kind === 'chase'));
  const empty = api.qpFoldChases_({ ok: true, events: [] });
  t('an empty timeline survives the fold', Array.isArray(empty.events) && empty.events.length === 0);
}

/* ---------- the shape of section 15 ------------------------------------- */
console.log('\nthe patch\n');

/* Bounded at the next section. An unbounded slice audits later sections as if
   they were this one — which is how this went red when section 16 arrived. */
const S15 = (() => {
  const a = PATCH.indexOf('15. THE CHASE THAT MISSED THE DEPARTMENT');
  const b = PATCH.indexOf('16. A CLIENT\'S REPLY IS NOT A DEPARTMENT\'S REPLY');
  return PATCH.slice(a, b > a ? b : undefined);
})();
t('section 15 exists and is bounded', S15.length > 1000 && S15.length < 12000,
  S15.length + ' chars');
t('nothing in section 15 sends email', !/MailApp|GmailApp/.test(S15),
  'these decide recipients and repair cells — the sending stays in Code.gs');
{
  const writes = S15.match(/getRange\(([^)]*)\)\.setValue/g) || [];
  t('section 15 writes exactly one cell, and it is the subject',
    writes.length === 1 && /,\s*18\)/.test(writes[0]),
    writes.length + ' write(s): ' + writes.join(', ')
      + ' — column 19 is the description and 23-29 are the autopilot\'s');
}
t('the repair can be rehearsed before it runs', /function qpRepairSubjects\(dryRun\)/.test(S15));

console.log();
process.exit(fail ? 1 : 0);
