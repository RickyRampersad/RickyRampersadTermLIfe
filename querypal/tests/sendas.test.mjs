/* Who the branch's email comes from, and who is copied on it.

   Every email this system has sent went out as whatever Google account runs
   the script. A Guardian department sees:

       From: RR Branch Query Pal <rampersadricky@gmail.com>
       Cc:   Ricky Rampersad <...>; Support <support@rickyrampersadbranch.com>

   BRANCH_SUPPORT has only ever been `replyTo`. There is not one `from:` in
   Code.gs. So the branch's own address answers replies but never sends.

   MailApp will only set `from` to an address the account has verified under
   Gmail's "Send mail as". support@rickyrampersadbranch.com is a full Microsoft
   365 mailbox on the tenant GoDaddy provisioned for the domain, and the
   domain's MX points at Outlook, so Microsoft carries the branch's mail. The
   address can therefore be verified under "Send mail as" — Google's code
   arrives in Outlook — but it is not verified yet, so qpSendAs_ asks Gmail
   what it may actually send as and uses the branch address only if it is
   really there. It can go in now and starts working by itself once the alias
   exists.

   (This comment first said the address was a GoDaddy forwarder that could not
   send. It is a real mailbox. The MX must stay on Microsoft.)

   Separately: sales support was on the original routed email and fell off
   every chase, because the fallback CC was only agent, manager and branch
   support.

   Run: node sendas.test.mjs
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

const BRANCH = 'support@rickyrampersadbranch.com';
const SALES = 'rickyrampersadsalessupport@myguardiangroup.com';
const ME = 'rampersadricky@gmail.com';

function load(opts) {
  const o = opts || {};
  const sent = [];
  const sandbox = {
    BRANCH_SUPPORT: BRANCH, RR_SUPPORT: SALES, SHEET_NAME: 'Queries',
    Logger: { log() {} },
    Session: { getEffectiveUser: () => ({ getEmail: () => ME }) },
    GmailApp: { getAliases: () => { if (o.aliasThrows) throw new Error('no scope'); return o.aliases || []; } },
    MailApp: { sendEmail: (m) => { sent.push(m); return m; } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpSendAs_', 'qpCanSendAs_', 'qpAliasCheck', 'qpChaseCc_'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return { api, sent };
}

/* ---------- today: the alias does not exist ----------------------------- */
console.log('\nbefore the alias exists\n');
{
  const { api, sent } = load({ aliases: [] });
  api.qpSendAs_({ to: 'dept@myguardiangroup.com', subject: 'x', body: 'y' });
  t('nothing is forced — the email still sends',
    sent.length === 1, 'an unverified From would be rejected by Gmail');
  t('no From is set, so it goes as the script account',
    sent[0].from === undefined, JSON.stringify(sent[0].from));
  t('the branch address is correctly reported as not sendable',
    api.qpCanSendAs_(BRANCH) === false);
}
{
  const { api, sent } = load({ aliasThrows: true });
  api.qpSendAs_({ to: 'd@x.com' });
  t('no Gmail scope is not an error — it just sends',
    sent.length === 1 && sent[0].from === undefined,
    'this must never be the reason an email fails to go');
}

/* ---------- the day it is set up ---------------------------------------- */
console.log('\nonce the alias is verified\n');
{
  const { api, sent } = load({ aliases: [BRANCH] });
  api.qpSendAs_({ to: 'dept@myguardiangroup.com', subject: 'x' });
  t('it sends as the branch, with no further change',
    sent[0].from === BRANCH,
    'the point of checking at run time rather than hard-coding it');
  t('and it reports as sendable', api.qpCanSendAs_(BRANCH) === true);
}
{
  const { api, sent } = load({ aliases: [BRANCH] });
  api.qpSendAs_({ to: 'd@x.com', from: 'someone.else@x.com' });
  t('a From already set by the caller is left alone', sent[0].from === 'someone.else@x.com');
}
{
  const { api } = load({ aliases: ['Support@RickyRampersadBranch.COM'] });
  t('the alias check does not care about letter case', api.qpCanSendAs_(BRANCH) === true);
}
{
  const { api } = load({ aliases: ['someone.else@x.com'] });
  t('another verified alias does not make the branch address sendable',
    api.qpCanSendAs_(BRANCH) === false);
}
{
  const { api } = load({ aliases: [] });
  t('the account can always send as itself', api.qpCanSendAs_(ME) === true);
}

/* ---------- what the check tells him ------------------------------------ */
console.log('\nthe check\n');
{
  const { api } = load({ aliases: [] });
  const r = api.qpAliasCheck();
  t('it names the account actually sending', r.includes(ME));
  t('it says plainly that the branch address cannot send yet', /can send as it\s*: NO/.test(r));
  t('it says where the verification code will arrive',
    /arrive in Outlook/.test(r),
    'the branch address is a Microsoft 365 mailbox, so the code is readable');
  t('it warns against moving the MX, which would cut off the branch',
    /MX must stay on Microsoft/.test(r),
    'advice to point the MX at Google would have destroyed the branch mail');
  t('it says where to fix it', /Send mail as/.test(r));
  t('it says nothing else needs changing afterwards', /starts sending as the branch by itself/.test(r));
}
{
  const { api } = load({ aliases: [BRANCH] });
  t('once verified it says so', /can send as it\s*: YES/.test(api.qpAliasCheck()));
}

/* ---------- sales support on the chase ---------------------------------- */
console.log('\nwho is copied on a chase\n');
{
  const { api } = load({});
  const row = Array(29).fill('');
  row[10] = 'fawwaz.mohamed@myguardiangroup.com';
  row[14] = 'gloccustomerservice@myguardiangroup.com';
  const cc = api.qpChaseCc_(row, 'akaash.kalladeen@myguardiangroup.com', false);

  t('sales support is copied on a chase', cc.includes(SALES),
    'they were on the original routed email and fell off every follow-up');
  t('the agent is still copied', cc.includes('fawwaz.mohamed@myguardiangroup.com'));
  t('the manager is still copied', cc.includes('akaash.kalladeen@myguardiangroup.com'));
  t('branch support is still copied', cc.includes(BRANCH));

  const sup = api.qpChaseCc_(row, 'akaash.kalladeen@myguardiangroup.com', true);
  t('on a support case the department is copied too', sup.includes('gloccustomerservice@myguardiangroup.com'));
  t('nobody appears twice',
    (() => { const l = sup.split(','); return new Set(l).size === l.length; })(), sup);
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
const S21 = section('21. SEND AS THE BRANCH');
t('section 21 exists', S21.length > 1000);
t('the From is never hard-coded past the alias check',
  !/mail\.from\s*=\s*['"]/.test(S21),
  'an unverified From is rejected by Gmail and the email is lost');

console.log();
process.exit(fail ? 1 : 0);
