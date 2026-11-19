/* A support case goes to the agent's own support, not to a shared tray.

   A support-type query went to rickyrampersadsalessupport@myguardiangroup.com
   and sendRoutedEmail then deleted that address from the CC. Four people read
   that mailbox and each agent already has one of them assigned, so the request
   had to be picked up before it could be worked.

   In Salesforce the agents are Contacts, not Users, and the Contact's OWNER is
   their support: Premchand Dookran's is owned by Sasha Lalla-Jagassar,
   Fawwaz Mohamed's by Azariah Griffith.

   The data will mislead anyone who trusts it blindly, and these cases are real:
   varun.seegolam@ sits on three contacts — Varun himself, owned by Azariah
   Griffith, and two clients carrying his address, owned by Anita Sankar and
   Nyomi Hutchinson, neither of whom works at this branch. So the address is
   checked against the branch's own list before anything is sent to it.

   Run: node agent-support.test.mjs
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

const MAILBOX = 'rickyrampersadsalessupport@myguardiangroup.com';
const BRANCH = 'support@rickyrampersadbranch.com';
const AZARIAH = 'azariah.griffith@myguardiangroup.com';
const SASHA = 'sasha.lalla-jagassar@myguardiangroup.com';
const PREM = 'premchand.dookran@myguardiangroup.com';
const FAWWAZ = 'fawwaz.mohamed@myguardiangroup.com';

/* The tab as it will be pasted: heading row then rows. */
const TAB = [
  ['Agent Email', 'Agent Name', 'Support Name', 'Support Email', 'Source'],
  [PREM, 'Premchand Dookran', 'Sasha Lalla-Jagassar', SASHA, 'Salesforce Contact.Owner'],
  [FAWWAZ, 'Fawwaz Mohamed', 'Azariah Griffith', AZARIAH, 'Salesforce Contact.Owner'],
  ['varun.seegolam@myguardiangroup.com', 'Varun Seegolam', 'Azariah Griffith', AZARIAH, 'Salesforce'],
  ['azariah.griffith@myguardiangroup.com', 'Azariah Griffith', '', '', 'NOT IN SALESFORCE'],
];

function load(opts) {
  const o = opts || {};
  const rows = o.tab === undefined ? TAB : o.tab;
  const sheet = {
    getLastRow: () => rows.length,
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    getRange(r, c, nr, nc) {
      const bl = [];
      for (let i = 0; i < nr; i++) {
        const src = rows[r - 1 + i] || [];
        const cells = [];
        for (let j = 0; j < nc; j++) cells.push(src[c - 1 + j] === undefined ? '' : src[c - 1 + j]);
        bl.push(cells);
      }
      return { getValues: () => bl };
    },
  };
  let reads = 0;
  const sandbox = {
    SHEET_NAME: 'Queries', RR_SUPPORT: MAILBOX, BRANCH_SUPPORT: BRANCH,
    Logger: { log() {} },
    codeTable_: () => o.codes || [],
    SpreadsheetApp: { getActiveSpreadsheet: () => ({
      getSheetByName: (n) => {
        if (o.sheetThrows) throw new Error('unreadable');
        if (n === 'Agent Support') { reads++; return o.noTab ? null : sheet; }
        return null;
      } }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpAgentSupport_', 'qpSupportRoute_', 'qpSupportStaffOk_', 'qpSupportMap_',
                'qpSupportMapClear_', 'qpSupportAudit', 'qpChaseCc_', 'QP_SUPPORT_STAFF'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return { api, reads: () => reads };
}

const req = (o) => Object.assign({
  agentEmail: PREM, agent: 'Premchand Dookran', client: 'A Client',
  departmentEmail: MAILBOX, department: 'RR Branch Sales Support',
}, o || {});

/* ---------- the lookup ---------------------------------------------------- */
console.log('\nwho supports this agent\n');
{
  const { api } = load({});
  t('an agent on the tab resolves to their own support',
    api.qpAgentSupport_(PREM) === SASHA, api.qpAgentSupport_(PREM));
  t('a different agent resolves to a different person',
    api.qpAgentSupport_(FAWWAZ) === AZARIAH);
  t('letter case in the agent address does not matter',
    api.qpAgentSupport_('PremChand.Dookran@MyGuardianGroup.com') === SASHA);
  t('an agent not on the tab resolves to nothing, not a guess',
    api.qpAgentSupport_('someone.new@myguardiangroup.com') === '');
  t('a row with a blank support column resolves to nothing',
    api.qpAgentSupport_(AZARIAH) === '',
    'Azariah is not in Salesforce as a contact — the tab says so honestly');
  t('an empty agent address resolves to nothing', api.qpAgentSupport_('') === '');
  t('a non-address resolves to nothing', api.qpAgentSupport_('Premchand Dookran') === '');
}

/* ---------- the branch list, which is the guard ------------------------- */
console.log('\nonly this branch\'s support\n');
{
  const tab = TAB.concat([
    ['client.a@example.com', 'Roopchan Boodram', 'Anita Sankar', 'anita.sankar@myguardiangroup.com', 'Salesforce'],
    ['client.b@example.com', 'Natasha Hall', 'Felicia Rampersad', 'felicia.rampersad@myguardiangroup.com', 'Salesforce'],
  ]);
  const { api } = load({ tab });
  t('a support name from another branch is refused',
    api.qpAgentSupport_('client.a@example.com') === '',
    'Anita Sankar owns one of the contacts carrying Varun Seegolam\'s address');
  t('and a second one is refused too',
    api.qpAgentSupport_('client.b@example.com') === '');
  t('the guard is a list, like the department override',
    api.qpSupportStaffOk_(SASHA) === true && api.qpSupportStaffOk_('anita.sankar@myguardiangroup.com') === false);
  t('the list holds the four people who read the mailbox',
    api.QP_SUPPORT_STAFF.length === 4 && api.QP_SUPPORT_STAFF.indexOf(AZARIAH) > -1);
}

/* ---------- the routing itself ------------------------------------------ */
console.log('\nwhere the email goes\n');
{
  const { api } = load({});
  const cc = {};
  cc[MAILBOX.toLowerCase()] = MAILBOX;
  cc[BRANCH.toLowerCase()] = BRANCH;
  cc[PREM.toLowerCase()] = PREM;
  const r = api.qpSupportRoute_(true, req({}), cc);

  t('a support case is addressed to the agent\'s support', r.to === SASHA, r.to);
  t('the shared mailbox is copied, not dropped',
    r.cc.toLowerCase().indexOf(MAILBOX) > -1,
    'four people watch it and the branch record lives there');
  t('the agent is still copied', r.cc.indexOf(PREM) > -1);
  t('branch support is still copied', r.cc.indexOf(BRANCH) > -1);
  t('the To address is not also in CC',
    r.cc.toLowerCase().indexOf(SASHA) === -1, r.cc);
  t('it reports that a name was found', r.named === true);
}
{
  /* The behaviour being replaced, which must still be exactly right. */
  const { api } = load({});
  const cc = {}; cc[BRANCH.toLowerCase()] = BRANCH;
  const r = api.qpSupportRoute_(true, req({ agentEmail: 'nobody@myguardiangroup.com' }), cc);
  t('an unknown agent falls back to the shared mailbox',
    r.to === MAILBOX, r.to);
  t('and the fallback is not reported as named', r.named === false);
  t('the mailbox is not then duplicated into CC',
    r.cc.toLowerCase().indexOf(MAILBOX) === -1, r.cc);
}
{
  const { api } = load({});
  const cc = {}; cc['dept@myguardiangroup.com'] = 'dept@myguardiangroup.com';
  const r = api.qpSupportRoute_(false, req({ departmentEmail: 'glocalterations@myguardiangroup.com' }), cc);
  t('a case that is NOT a support case still goes to its department',
    r.to === 'glocalterations@myguardiangroup.com', r.to);
  t('and its CC is untouched — no mailbox added',
    r.cc.toLowerCase().indexOf(MAILBOX) === -1, r.cc);
}
{
  const { api } = load({ noTab: true });
  const r = api.qpSupportRoute_(true, req({}), {});
  t('with no Agent Support tab at all, everything behaves as it does today',
    r.to === MAILBOX, 'the tab is additive — its absence must change nothing');
}
{
  const { api } = load({ sheetThrows: true });
  const r = api.qpSupportRoute_(true, req({}), {});
  t('an unreadable sheet falls back rather than failing the send',
    r.to === MAILBOX);
}

/* ---------- the chase, which needs no Code.gs edit ---------------------- */
console.log('\nthe follow-up\n');
{
  const { api } = load({});
  const row = Array(29).fill('');
  row[10] = PREM;
  row[14] = 'gloccustomerservice@myguardiangroup.com';
  const cc = api.qpChaseCc_(row, 'akaash.kalladeen@myguardiangroup.com', false);
  t('the agent\'s support is copied on every chase too',
    cc.indexOf(SASHA) > -1, cc);
  t('sales support is still copied', cc.indexOf(MAILBOX) > -1);
  t('the agent is still copied', cc.indexOf(PREM) > -1);
  t('nobody appears twice',
    (() => { const l = cc.split(','); return new Set(l).size === l.length; })(), cc);
}
{
  const { api } = load({});
  const row = Array(29).fill('');
  row[10] = 'unknown.agent@myguardiangroup.com';
  const cc = api.qpChaseCc_(row, '', false);
  t('an unknown agent adds nobody to the chase', cc.indexOf('undefined') === -1 && cc.length > 0, cc);
}

/* ---------- cost ------------------------------------------------------- */
console.log('\nreading the tab\n');
{
  const { api, reads } = load({});
  for (let i = 0; i < 8; i++) api.qpAgentSupport_(PREM);
  t('the tab is read once per run, not once per lookup', reads() === 1, reads() + ' reads');
  api.qpSupportMapClear_();
  api.qpAgentSupport_(PREM);
  t('and the cache can be dropped when the tab is edited', reads() === 2);
}

/* ---------- the audit -------------------------------------------------- */
console.log('\nthe audit\n');
{
  const tab = TAB.concat([['x@myguardiangroup.com', 'X', 'Anita Sankar', 'anita.sankar@myguardiangroup.com', 'SF']]);
  const { api } = load({ tab, codes: [{ email: PREM }, { email: 'never.added@myguardiangroup.com' }] });
  const r = api.qpSupportAudit();
  t('it lists who routes to a named person', r.indexOf(PREM + '  ->  ' + SASHA) > -1);
  t('it names the rows pointing outside the branch', /NOT on the branch list/.test(r));
  t('it says those are ignored rather than used', /IGNORED/.test(r));
  t('it lists Agent Codes people missing from the tab',
    /never\.added@myguardiangroup\.com/.test(r));
  t('it says the fallback is the old behaviour',
    /behaves exactly as it does today/.test(r));
}

/* ---------- shape ------------------------------------------------------ */
console.log('\nthe patch\n');
const section = (name) => {
  const a = PATCH.indexOf(name);
  if (a < 0) return '';
  const rest = PATCH.slice(a + name.length);
  const next = rest.search(/\n\/\* [═=]{10,}/);
  return next > -1 ? PATCH.slice(a, a + name.length + next) : PATCH.slice(a);
};
const S23 = section("23. A SUPPORT CASE GOES TO THE AGENT'S OWN SUPPORT");
t('section 23 exists', S23.length > 1000);
t('it sends no email itself', !/MailApp|GmailApp/.test(S23),
  'it decides an address; sendRoutedEmail still does the sending');
t('it writes no sheet column', !/\.setValue\(/.test(S23));
t('no support address is hard-coded into the routing',
  !/to\s*=\s*['"][^'"]*@/.test(S23),
  'every address comes from the tab and is checked against the branch list');

console.log();
process.exit(fail ? 1 : 0);
