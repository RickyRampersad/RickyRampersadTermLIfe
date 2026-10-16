// Approvals — apps-script/Approvals.gs, inside the RR Operations project.
//
// What it promises, held here:
//   - the client's history comes from the old Jotform tab and this app's own
//     requests, matched by name (letters only, either order) or a shared
//     policy number, and test rows never count;
//   - an agent cannot file a request without a reason in their own words, and
//     a client with history needs "what is different this time" and a tick;
//   - three or more in 90 days (this one included) is flagged;
//   - only the Branch Manager decides; a decline or a question needs a note;
//   - approval sends GL Customer Service the history template or the
//     first-time template, copied to the agent and the manager, and in test
//     mode only the test inbox ever receives anything;
//   - live approval is refused while the GL address is unset.
//
// Invented names and numbers throughout. The repository is public.
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'rrops-approvals.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/DeliveryBook.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Approvals.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const OLD_HEAD = ['Submission Date', 'Approval Type', 'Agent Name', 'Agent Email', 'Client Name - First Name',
  'Client Name - Last Name', 'Reason For Cheque/Cash Collection', 'Cash Amount', 'Policy Number',
  'Claim Discharge Status ', 'BM Cash Approval ', 'Submission IP', 'Submission URL', 'Submission Edit URL',
  'Last Update Date', 'Submission ID'];
const oldRow = (d, type, agent, first, last, reason, amt, pol, id) =>
  [d, type, agent, agent.toLowerCase() + '@example.com', first, last, reason, amt, pol, '', '', '', '', '', '', id];

function world(props) {
  const env = makeEnv({ props: Object.assign({ APR_TEST_INBOX: 'test@example.com', APR_HISTORY_TAB: 'History' }, props || {}) });
  env.__mail = [];
  env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 50 };
  env.Utilities.formatDate = (d, tz, f) => f === 'yyMMdd' ? '261015' : d.toISOString().slice(0, 10);
  env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'], [
    ['Pat Agent', 'pat@example.com', 'PAT1', 'Agent', '', 'Yes', 'approvals'],
    ['Mo Manager', 'mo@example.com', 'MGR9', 'Branch Manager', '', 'Yes', ''],
    ['Del Only', 'del@example.com', 'DEL1', 'Staff', '', 'Yes', 'delivery-book'],
  ]);
  env.__mkSheet('History', 2, OLD_HEAD, [
    oldRow(day(400), 'Cash Collection', 'Pat', 'Anika', 'Pretend', 'Card Problem', '', '5009990001', '1001'),
    oldRow(day(60), 'Cash Collection', 'Pat', 'ANIKA', 'PRETEND ', 'Card Problem', '700', '5009990001', '1002'),
    oldRow(day(20), 'Cash Collection', 'Pat', 'Anika', 'Pretend', 'Card Problem', '700', '5009990001', '1003'),
    oldRow(day(10), 'Cheque Collection', 'Lee', 'Pretend', 'Anika', '', '', '', '1004'),
    oldRow(day(5), 'Cash Collection', 'Lee', 'test', 'test', 'MPOS Device Not Working', '', 'Test', '1005'),
    oldRow(day(5), 'Cash Collection', 'Lee', 'Arun', 'Pretend', 'Card Problem', '', '', '1006'),
    oldRow(day(5), 'Cash Collection', 'Lee', 'Dev', 'Madeup', 'Internet Problems', '300', '8000000001', '1007'),
  ]);
  return env;
}
const login = (env, code) => env.dbLogin_({ code }).token;
const post = (env, body) => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());

/* ── access ─────────────────────────────────────────────────────────── */
{
  const env = world();
  const del = login(env, 'DEL1');
  const r = post(env, { action: 'aprStart', token: del });
  ok('someone without Approvals on their access is refused', !r.ok && /not on your access/.test(r.error));
  const pat = login(env, 'PAT1');
  const s = post(env, { action: 'aprStart', token: pat });
  ok('an agent with it opens the app, not as approver', s.ok && s.approver === false && s.mode === 'test');
  const q = post(env, { action: 'aprQueue', token: pat });
  ok('an agent cannot open the review queue', !q.ok && /Only the Branch Manager/.test(q.error));
  const m = post(env, { action: 'aprStart', token: login(env, 'MGR9') });
  ok('the Branch Manager is the approver', m.ok && m.approver === true);
  ok('the launcher lists Approvals live', env.opsAppsFor_('').some(a => a.id === 'approvals' && a.status === 'live'));
}

/* ── history first ─────────────────────────────────────────────────── */
{
  const env = world();
  const pat = login(env, 'PAT1');
  const h = post(env, { action: 'aprHistory', token: pat, first: 'anika', last: 'pretend' });
  ok('history finds every spelling and the reversed order', h.ok && h.history.length === 4, 'got ' + (h.history || []).length);
  ok('test rows never count', !h.history.some(r => /test/i.test(r.client)));
  ok('same surname, same initial is "possible", never counted',
     h.possible.some(r => /Arun/.test(r.client)) && !h.history.some(r => /Arun/.test(r.client)));
  ok('newest first', h.history[0].ref === '1004');
  ok('three in 90 days already: flagged for the next one', h.flags.some(f => /4 requests in 90 days/.test(f)), JSON.stringify(h.flags));
  ok('an undecided Jotform row says so', h.history.every(r => r.status === 'Decision not recorded'));
  const byPol = post(env, { action: 'aprHistory', token: pat, first: 'Someone', last: 'Else', policy: '8000000001' });
  ok('a shared policy number matches whatever the name', byPol.history.length === 1 && /Dev Madeup/.test(byPol.history[0].client));
  const none = post(env, { action: 'aprHistory', token: pat, first: 'Brand', last: 'New' });
  ok('a client never seen has no history', none.ok && none.history.length === 0 && none.summary.count === 0);
}

/* ── the request ───────────────────────────────────────────────────── */
{
  const env = world();
  const pat = login(env, 'PAT1');
  const base = { action: 'aprSubmit', token: pat, first: 'Anika', last: 'Pretend', type: 'Cash Collection',
                 policy: '5009990001', amount: '700', reasonCategory: 'Card problem',
                 reason: 'Her card was declined twice at the bank this week.' };
  let r = post(env, Object.assign({}, base, { reason: 'card' }));
  ok('a one-word reason is refused', !r.ok && /own words/.test(r.error));
  r = post(env, base);
  ok('history on file: the tick and "what is different" are required',
     !r.ok && /history/.test(r.error) && /different this time/.test(r.error));
  r = post(env, Object.assign({}, base, { historySeen: true, different: 'The bank has now issued a new card, arriving Friday.' }));
  ok('a complete request is filed', r.ok && /^APR-261015-/.test(r.ref), r.error || '');
  ok('it is flagged: 4 in 90 days (the one 400 days back not counted), same reason, same amount',
     r.flags.some(f => /^4 requests in 90 days/.test(f)) && r.flags.includes('Same reason given before') &&
     r.flags.includes('Same amount already requested'), JSON.stringify(r.flags));
  const row = env.__sheets['Approval Requests']._grid[1];
  ok('the row is Pending with the agent and their e-mail', row.includes('Pending') && row.includes('pat@example.com'));
  ok('the manager is told, in test mode only the test inbox', env.__mail.length === 1 &&
     env.__mail[0].to === 'test@example.com' && /\[TEST\] Approval request/.test(env.__mail[0].subject));
  const first = post(env, { action: 'aprSubmit', token: pat, first: 'Brand', last: 'New', type: 'Cash Collection',
    policy: '5001112223', amount: '250', reasonCategory: 'No bank account', reason: 'Client is new to the branch and has no bank account yet.' });
  ok('a client with no history needs no second answer', first.ok && first.prior === 0 && first.flags.length === 0);
  const mine = post(env, { action: 'aprMine', token: pat });
  ok('the agent sees their own requests', mine.ok && mine.requests.length === 2);
}

/* ── the decision and the e-mails ──────────────────────────────────── */
{
  const env = world();
  const pat = login(env, 'PAT1'), mgr = login(env, 'MGR9');
  const a = post(env, { action: 'aprSubmit', token: pat, first: 'Anika', last: 'Pretend', type: 'Cash Collection',
    policy: '5009990001', amount: '650', reasonCategory: 'Card problem', historySeen: true,
    reason: 'Her card was declined twice at the bank this week.', different: 'New card issued, arriving next week.' });
  const b = post(env, { action: 'aprSubmit', token: pat, first: 'Brand', last: 'New', type: 'Cash Collection',
    policy: '5001112223', amount: '250', reasonCategory: 'No bank account', reason: 'Client is new to the branch and has no bank account yet.' });
  env.__mail = [];

  const q = post(env, { action: 'aprQueue', token: mgr });
  ok('the queue holds both, with history beside each', q.ok && q.open.length === 2 &&
     q.open.find(x => x.ref === a.ref).history.length === 4 && q.open.find(x => x.ref === b.ref).history.length === 0);

  const pv = post(env, { action: 'aprPreview', token: mgr, ref: a.ref });
  ok('preview: the history template, every earlier request in the table', pv.ok && pv.template === 'History' &&
     /Approval history/.test(pv.html) && (pv.html.match(/<tr style="background:#(f7f9fc|ffffff)/g) || []).length === 4 &&
     /4 earlier requests/.test(pv.html));
  const pv2 = post(env, { action: 'aprPreview', token: mgr, ref: b.ref });
  ok('preview: the first-time template', pv2.template === 'First-time' && /first cash collection request on record/.test(pv2.html) &&
     !/Approval history/.test(pv2.html));

  let d = post(env, { action: 'aprDecide', token: mgr, ref: b.ref, decision: 'decline' });
  ok('a decline needs a reason', !d.ok && /reason for declining/.test(d.error));
  d = post(env, { action: 'aprDecide', token: pat, ref: b.ref, decision: 'approve' });
  ok('an agent cannot approve', !d.ok && /Only the Branch Manager/.test(d.error));

  d = post(env, { action: 'aprDecide', token: mgr, ref: a.ref, decision: 'approve', note: 'Last cash approval until the new card arrives.' });
  ok('approved in test mode: one e-mail, to the test inbox', d.ok && d.template === 'History' && env.__mail.length === 1 &&
     env.__mail[0].to === 'test@example.com' && !env.__mail[0].cc, JSON.stringify(d));
  ok('no Microsoft 365 yet: the test copy comes by Gmail, replies to support@, and says so',
     env.__mail[0].replyTo === 'support@rickyrampersadbranch.com' && /from <b>support@rickyrampersadbranch\.com<\/b>/.test(env.__mail[0].htmlBody) &&
     /Gmail: support@rickyrampersadbranch\.com not set up yet/.test(d.email), d.email);
  ok('the note is in the GL e-mail', /Last cash approval until the new card arrives/.test(env.__mail[0].htmlBody));
  const sh = env.__sheets['Approval Requests'], hd = sh._grid[0], ra = sh._grid.find(r => r[0] === a.ref);
  ok('the row records the decision, who and the template', ra[hd.indexOf('Status')] === 'Approved' &&
     ra[hd.indexOf('Decided By')] === 'Mo Manager' && ra[hd.indexOf('Template')] === 'History' &&
     /^Test copy sent/.test(ra[hd.indexOf('GL Email')]));
  d = post(env, { action: 'aprDecide', token: mgr, ref: a.ref, decision: 'approve' });
  ok('a decided request cannot be decided again', !d.ok && /Already approved/.test(d.error));

  const h = post(env, { action: 'aprHistory', token: pat, first: 'Anika', last: 'Pretend' });
  ok('the approval now shows in the history as Approved', h.history[0].status === 'Approved' && h.history[0].source === 'RR Operations');

  d = post(env, { action: 'aprDecide', token: mgr, ref: b.ref, decision: 'info', note: 'How will the client pay next month?' });
  ok('more info goes back to the agent', d.ok && env.__mail.length === 2 && /More information needed/.test(env.__mail[1].subject));
  const r1 = post(env, { action: 'aprReply', token: pat, ref: b.ref, reply: 'She is opening an account at the credit union this month.' });
  ok('the agent answers; it returns to the queue', r1.ok && post(env, { action: 'aprQueue', token: mgr }).open.some(x => x.ref === b.ref && x.status === 'Pending'));
}

/* ── live, from support@ through Microsoft Graph ──────────────────── */
function graph(env) {
  env.__graph = [];
  env.UrlFetchApp = { fetch: (u, o) => {
    if (/login\.microsoftonline\.com/.test(u)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ access_token: 'ms', expires_in: 3600 }) };
    const m = u.match(/graph\.microsoft\.com\/v1\.0\/users\/([^/]+)\/sendMail/);
    if (m) { env.__graph.push({ from: decodeURIComponent(m[1]), body: JSON.parse(o.payload) }); return { getResponseCode: () => 202, getContentText: () => '' }; }
    throw new Error('unexpected ' + u);
  } };
}
{
  const env = world({ APR_MODE: 'live', APR_GL_CS_TO: 'glcs@example.com' });
  graph(env);
  const pat = login(env, 'PAT1'), mgr = login(env, 'MGR9');
  const a = post(env, { action: 'aprSubmit', token: pat, first: 'Brand', last: 'New', type: 'Cash Collection',
    policy: '5001112223', amount: '250', reasonCategory: 'No bank account', reason: 'Client is new to the branch and has no bank account yet.' });
  ok('live without Microsoft 365: the manager is not e-mailed by Gmail', env.__mail.length === 0 && env.__graph.length === 0);
  let d = post(env, { action: 'aprDecide', token: mgr, ref: a.ref, decision: 'approve' });
  ok('live approval refused until support@ is set up, nothing decided',
     !d.ok && /support@rickyrampersadbranch\.com is not set up/.test(d.error) && env.__sheets['Approval Requests']._grid[1].includes('Pending'), d.error);
  const p = env.PropertiesService.getScriptProperties();
  p.setProperty('MS_TENANT', 't'); p.setProperty('MS_CLIENT', 'c'); p.setProperty('MS_SECRET', 's');
  p.deleteProperty('APR_GL_CS_TO');
  d = post(env, { action: 'aprDecide', token: mgr, ref: a.ref, decision: 'approve' });
  ok('live approval refused while the GL address is unset', !d.ok && /APR_GL_CS_TO/.test(d.error));
  p.setProperty('APR_GL_CS_TO', 'glcs@example.com');
  d = post(env, { action: 'aprDecide', token: mgr, ref: a.ref, decision: 'approve' });
  const g = env.__graph[0], msg = g && g.body.message;
  ok('live: sent from support@ through Microsoft 365, kept in Sent Items',
     d.ok && g.from === 'support@rickyrampersadbranch.com' && msg.from.emailAddress.address === 'support@rickyrampersadbranch.com' &&
     g.body.saveToSentItems === true && env.__mail.length === 0, JSON.stringify(d));
  ok('to GL Customer Service, the agent and the manager copied, replies to support@',
     msg.toRecipients[0].emailAddress.address === 'glcs@example.com' &&
     msg.ccRecipients.map(x => x.emailAddress.address).join(',') === 'pat@example.com,Ricky.Rampersad@myguardiangroup.com' &&
     msg.replyTo[0].emailAddress.address === 'support@rickyrampersadbranch.com');
  ok('live subject has no TEST mark', !/TEST/.test(msg.subject) && /^Approved: Cash Collection/.test(msg.subject));
  const row = env.__sheets['Approval Requests']._grid[1], hd = env.__sheets['Approval Requests']._grid[0];
  ok('the row says where it went from', row[hd.indexOf('GL Email')] === 'Sent from support@rickyrampersadbranch.com');
}
{
  const env = world({ MS_TENANT: 't', MS_CLIENT: 'c', MS_SECRET: 's' });
  graph(env);
  const pat = login(env, 'PAT1');
  post(env, { action: 'aprSubmit', token: pat, first: 'Brand', last: 'New', type: 'Cash Collection',
    policy: '5001112223', amount: '250', reasonCategory: 'No bank account', reason: 'Client is new to the branch and has no bank account yet.' });
  const m = env.__graph[0] && env.__graph[0].body.message;
  ok('test mode with Microsoft 365: from support@, to the test inbox only', m && env.__graph[0].from === 'support@rickyrampersadbranch.com' &&
     m.toRecipients.length === 1 && m.toRecipients[0].emailAddress.address === 'test@example.com' && !m.ccRecipients && /^\[TEST\]/.test(m.subject));
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall approvals checks pass');
process.exit(fails ? 1 : 0);
