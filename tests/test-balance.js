// The agent's morning is a projection, and the close balances against it (19 October 2026).
//
// Ricky: "if the agents are planning their day, you can't say calls made. It's
// projected calls to be made and project. So it's projection. So they balance
// off at the end of the day."
//
// Pinned here: the morning mail and page ask for what is to be done ("Calls to
// make"), never what was done; the 5:30 page asks for what was done and shows
// each line's projection with a balance that moves as the agent types; the
// saved close shows the day balanced, line by line; the copy to the manager and
// sales support carries projected, done and balance, and its subject the total;
// the managers' table shows the balance; the arithmetic is right.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-19';
env.todayISO_ = () => DAY;

const A = { key: 'a-neil', name: 'Neil Ramnanan', agentName: 'Neil Ramnanan', email: 'neil@example.com', manager: 'akaash@example.com' };
const PLAN = { calls: { Planned: 8 }, appts: { Planned: 3 }, ff: { Planned: 2 }, close: { Planned: 0 }, apps: { Planned: 1 }, dues: { Planned: 5 }, pend: { Planned: 2 } };
let CLOSE = {};
env.agRows_ = (k, d, kind) => kind === 'plan' ? PLAN : CLOSE;
const written = [];
env.agWrite_ = (a, d, kind, rows) => written.push([kind, rows]);
env.skillBank_ = () => ({});
env.goalFor_ = () => null;
env.ff360Feed_ = () => null;
env.cmdChatter_ = () => ({});
env.managerEmails_ = () => ['ricky@example.com'];
const mails = [];
env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
env.sfkInsert_ = () => 'FEED';
env.bigPut_('ag_items_a-neil_' + DAY, []);

console.log('\nThe arithmetic:\n');
const b = env.agBalance_(PLAN, { calls: { Done: 9 }, appts: { Done: 2 }, ff: { Done: 2 }, close: { Done: 0 }, apps: { Done: 0 }, dues: { Done: 5 }, pend: { Done: 3 } });
ok('projected 21, done 21, balance even', b.proj === 21 && b.done === 21 && b.bal === 0, JSON.stringify([b.proj, b.done, b.bal]));
ok('met counts only up to each projection: 19 of 21 is 90%', b.pct === 90, String(b.pct));
ok('line by line: calls +1, appointments −1, applications −1, pendings +1', b.rows.find(r => r.id === 'calls').bal === 1 && b.rows.find(r => r.id === 'appts').bal === -1 && b.rows.find(r => r.id === 'apps').bal === -1 && b.rows.find(r => r.id === 'pend').bal === 1);
ok('the words: +1, −1, even', env.agBalText_(1) === '+1' && env.agBalText_(-1) === '−1' && env.agBalText_(0) === 'even');

console.log('\nThe morning is a projection:\n');
env.agentBatchData_ = () => ({ open: {}, ff: {}, closed: {}, f360: {}, goal: {}, q: {}, orphan: {} });
env.agentBook_ = () => null;
env.agentMode_ = () => 'live';
env.agSend_ = (a, subject, html) => { mails.push({ subject, htmlBody: html }); return true; };
env.agentMorningMail_(A, DAY, env.agentBatchData_(), null);
const am = mails.pop().htmlBody;
ok('the mail asks what is to be done', /Your projection for today/.test(am) && /Calls to make/.test(am) && /Appointments to set/.test(am) && /Fact finds to do/.test(am));
ok('and never what was done', !/Calls made/.test(am) && !/Appointments set</.test(am));
ok('it says the day balances at 5:30', /balances against your projection/.test(am) && /Project my day/.test(am));
const pg = env.agReplyPage_({ agent: A }, DAY, 'ag').getContent();
ok('the page: projection wording on every line', /Your projection for today/.test(pg) && /Calls to make/.test(pg) && /Premium due and lapse clients to call/.test(pg) && !/Calls made/.test(pg) && /Save my projection/.test(pg));

console.log('\nThe close is what was done, against the projection:\n');
const pc = env.agReplyPage_({ agent: A }, DAY, 'agc').getContent();
ok('done wording, with each projection beside it', /Calls made/.test(pc) && /you projected 8/.test(pc) && /you projected 3/.test(pc) && !/Calls to make/.test(pc));
ok('a balance beside each number, worked out as they type', (pc.match(/class="agbal"/g) || []).length === 7 && /data-proj="8"/.test(pc) && /addEventListener\("input"/.test(pc));
const saved = env.agReplySave_({ agent: A }, DAY, 'agc', { m_calls: '9', m_appts: '2', m_ff: '2', m_close: '0', m_apps: '0', m_dues: '5', m_pend: '3', summary: 'Good day in Chaguanas' }).getContent();
ok('saved as done, in done wording', written.length && written[0][0] === 'close' && written[0][1][0].Question === 'Calls made' && written[0][1][0].Done === '9');
ok('the saved page shows the day balanced, a bar a line', /Your day balanced/.test(saved) && /Projected this morning <b>21<\/b> · done <b>21<\/b> · balance <b[^>]*>even<\/b>/.test(saved) && /Calls · <b[^>]*>\+1<\/b>[^]*9 of 8</.test(saved) && /Appointments · <b[^>]*>−1<\/b>[^]*2 of 3</.test(saved) && !/Closing interviews · /.test(saved) && /90%<\/b> of the projection met/.test(saved));
const copy = mails.filter(m => /Day closed off/.test(m.subject)).pop();
ok('the copy says it in the subject', !!copy && /21 done of 21 projected, even/.test(copy.subject), copy && copy.subject);
ok('and carries projected, done and balance', !!copy && /Projected<\/td><td[^>]*>Done<\/td><td[^>]*>Balance/.test(copy.htmlBody) && />\+1<\/td>/.test(copy.htmlBody) && />−1<\/td>/.test(copy.htmlBody), '');
const morningSave = env.agReplySave_({ agent: A }, DAY, 'ag', { m_calls: '8', m_appts: '3', m_ff: '2', m_close: '0', m_apps: '1', m_dues: '5', m_pend: '2' }).getContent();
ok('the morning save is a projection', /Your projection is in/.test(morningSave) && written[1][1][0].Question === 'Calls to make' && written[1][1][0].Planned === '8');
const pcopy = mails.filter(m => /Projection received/.test(m.subject)).pop();
ok('and its copy says so', !!pcopy && /The agent's projection/.test(pcopy.htmlBody));

CLOSE = { calls: { Done: 9 }, appts: { Done: 2 } };
const again = env.agReplyPage_({ agent: A }, DAY, 'agc').getContent();
ok('opened again after the close, the balance is already there', /class="agbal"[^>]*>\+1</.test(again) && /class="agbal"[^>]*>\u22121</.test(again));

console.log('\nThe managers see the balance:\n');
const t = env.agentSummaryTable_([{ name: 'Neil Ramnanan', status: 'closed off', planned: 21, done: 18, ff: 2, apps: 0, hasPlan: true, hasClose: true },
  { name: 'Rajiv Soodoo', status: 'projection in', planned: 12, done: 0, ff: 0, apps: 0, hasPlan: true, hasClose: false }]);
ok('projected · done · balance', /Projected · done · balance/.test(t) && /21 · 18 · <b[^>]*>−3<\/b>/.test(t) && /12 · —</.test(t));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
