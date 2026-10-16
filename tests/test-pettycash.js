// Petty Cash — apps-script/PettyCash.gs, inside the RR Operations project.
//
// What it promises, held here:
//   - only people with petty-cash on the Access tab reach it, through the
//     same sign-in as the Delivery Book;
//   - an entry is refused whole or recorded whole: a spend needs a category,
//     who was paid, what for, and a receipt photo or a reason there is none;
//     a top-up needs the cash counted first;
//   - the book keeps a running balance per holder (an imprest float): a
//     count resets it to the cash there, and the difference is kept as a
//     shortage or a surplus; own-money spends are owed back, not taken from
//     the float;
//   - over-limit spends and requests wait for a reviewer; staff cannot
//     review; a query is answered by the holder;
//   - the analytics flag split purchases, missing receipts, late logging,
//     the float going below zero and a receipt number used twice;
//   - the Jotform history comes across once, with guessed categories said
//     to be guessed and the typed "balance at hand" as each top-up's count;
//   - the Monday report reconciles every float and lists what needs a look.
//
// Invented names and figures throughout. The repository is public.
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/DeliveryBook.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : e.message; } };

function world(props) {
  const env = makeEnv({ props: Object.assign({ PC_FLOAT: '500', PC_SPEND_LIMIT: '300' }, props || {}) });
  new vm.Script(fs.readFileSync(path.join(ROOT, 'apps-script/PettyCash.gs'), 'utf8'), { filename: 'PettyCash.gs' }).runInContext(env);
  env.__mail = [];
  env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 50 };
  env.__files = [];
  const folder = { getId: () => 'f1', createFile: b => { env.__files.push(b); return { getUrl: () => 'https://drive.example/r' + env.__files.length }; } };
  env.DriveApp = { getFolderById: () => folder, createFolder: () => folder };
  env.Utilities.newBlob = (bytes, type, name) => ({ bytes, type, name });
  env.Utilities.base64Decode = s => Array.from(Buffer.from(s, 'base64'));
  env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'], [
    ['Pat Runner', 'pat@example.com', 'PAT1', 'Staff', '', 'Yes', 'delivery-book, petty-cash'],
    ['Mo Manager', 'mo@example.com', 'MGR9', 'Branch Manager', '', 'Yes', ''],
    ['Kim Helper', 'kim@example.com', 'KIM2', 'Staff', '', 'Yes', 'delivery-book'],
    ['Ann Assist', 'ann@example.com', 'ANN3', 'Assistant', '', 'Yes', 'petty-cash'],
  ]);
  return env;
}
const post = (env, body) => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
const login = (env, code) => post(env, { action: 'login', code }).token;
const RECEIPT = 'data:image/jpeg;base64,' + Buffer.from('receipt').toString('base64');
const days = n => new Date(Date.now() - n * 86400000).toISOString();
const spend = (o) => Object.assign({ type: 'spend', amount: 40, category: 'Refreshments & meals', sub: 'Staff meals',
  paidTo: 'Corner Shop', purpose: 'Lunch for the office', receipt: RECEIPT, receiptNo: '' }, o);

/* ── access ─────────────────────────────────────────────────────── */
console.log('access');
let env = world();
const PAT = login(env, 'PAT1'), MO = login(env, 'MGR9'), KIM = login(env, 'KIM2');
{
  const l = post(env, { action: 'login', code: 'PAT1' });
  ok('the launcher shows Petty Cash as live', l.apps.some(a => a.id === 'petty-cash' && a.status === 'live'));
  const k = post(env, { action: 'pc.init', token: KIM });
  ok('someone without petty-cash is refused by the server', !k.ok && /not on your access/.test(k.error));
  const p = post(env, { action: 'pc.init', token: PAT });
  ok('a holder gets the categories, limits and lists', p.ok && p.categories.length >= 10 && p.limit === 300 && p.float === 500);
  ok('staff are not reviewers; a Manager role is', !p.me.reviewer && post(env, { action: 'pc.init', token: MO }).me.reviewer);
  ok('the holders are the people with petty-cash', p.holders.join() === 'Pat Runner,Mo Manager,Ann Assist', p.holders.join());
  const e2 = world({ PC_REVIEWERS: 'Ann Assist' });
  ok('PC_REVIEWERS makes a named person a reviewer', post(e2, { action: 'pc.init', token: login(e2, 'ANN3') }).me.reviewer);
  ok('signed out is signed out', post(env, { action: 'pc.ledger', token: 'nope' }).error === 'signed-out');
}

/* ── refused whole ──────────────────────────────────────────────── */
console.log('refused whole');
{
  const r = e => post(env, { action: 'pc.submit', token: PAT, entry: e });
  ok('no category', /category/.test(r(spend({ category: '' })).error));
  ok('a category needs its kind', /what kind/.test(r(spend({ sub: '' })).error));
  ok('who was paid', /who was paid/.test(r(spend({ paidTo: '' })).error));
  ok('what for', /what it was for/.test(r(spend({ purpose: 'x' })).error));
  ok('no receipt and no reason', /receipt/.test(r(spend({ receipt: '' })).error));
  ok('a vehicle spend names the vehicle', /which vehicle/.test(r(spend({ category: 'Vehicle', sub: 'Repairs & parts' })).error));
  ok('recover from someone names them', /recovered from/.test(r(spend({ charged: 'Recover from someone' })).error));
  ok('a zero amount', /amount/.test(r(spend({ amount: 0 })).error));
  ok('a date in the future', /future/.test(r(spend({ when: new Date(Date.now() + 86400000).toISOString() })).error));
  ok('staff cannot go back more than 45 days', /45 days/.test(r(spend({ when: days(60) })).error));
  ok('a top-up needs the cash counted first', /Count the cash/.test(r({ type: 'topup', amount: 300, from: 'Mo Manager' }).error));
  ok('a count needs the count', /cash counted/.test(r({ type: 'count' }).error));
  ok('nothing was written', !env.__sheets['Petty Cash Ledger'] || env.__sheets['Petty Cash Ledger']._grid.length === 1);
}

/* ── the float ──────────────────────────────────────────────────── */
console.log('the float');
let refs = {};
{
  const r = e => post(env, { action: 'pc.submit', token: PAT, entry: e });
  const a = r({ type: 'topup', amount: 500, from: 'Mo Manager', method: 'Cash', counted: 0, when: days(10) });
  ok('a first top-up: counted 0, plus 500', a.ok && a.float.balance === 500 && a.entry.variance === null, JSON.stringify(a.float));
  const b = r(spend({ amount: 26, when: days(9), category: 'Vehicle', sub: 'Repairs & parts', vehicle: 'Branch van', paidTo: 'Parts Place', purpose: 'Glue for the trim', receiptNo: '203' }));
  ok('a spend comes off the float', b.ok && b.float.balance === 474);
  ok('the receipt photo goes to Drive', b.entry.receipt === 'https://drive.example/r1' && env.__files.length === 1);
  const dup = r(spend({ amount: 26, when: days(9), paidTo: 'Parts Place', receiptNo: '203', category: 'Vehicle', sub: 'Repairs & parts', vehicle: 'Branch van', purpose: 'Glue for the trim' }));
  ok('the same receipt from the same shop is refused', /already on the ledger/.test(dup.error));
  const c = r(spend({ amount: 42, receipt: '', noReceipt: 'Street vendor', purpose: 'Doubles for the office', when: days(8) }));
  ok('no receipt is allowed with a reason, and flagged', c.ok && c.entry.flags.includes('No receipt'), c.entry && c.entry.flags.join('|'));
  const d = r(spend({ amount: 200, category: 'Personal (Branch Manager)', sub: 'School & tuition', charged: 'Branch', paidTo: 'A teacher', purpose: 'Lessons paid for the manager', receipt: '', noReceipt: 'Paid to a person', when: days(7) }));
  ok('a personal category is charged personal whatever is chosen', d.entry.charged === 'Branch Manager (personal)');
  const e = r(spend({ amount: 60, payment: 'Own money (to be repaid)', when: days(6) }));
  ok('own money does not touch the float and is owed back', e.float.balance === 232 && e.float.owed === 60, JSON.stringify(e.float));
  const f = r({ type: 'count', counted: 200, when: days(5), denoms: { 100: 1, 50: 1, 20: 2, 10: 1 } });
  ok('a count records the shortage and resets the book', f.entry.variance === -32 && f.float.balance === 200 && f.float.shortage === 32, JSON.stringify(f.entry));
  ok('the notes counted are kept', env.__sheets['Petty Cash Ledger']._grid.some(row => row.includes('100x1, 50x1, 20x2, 10x1')));
  ok('a shortage over the variance is flagged', f.entry.flags.some(x => /Short TT\$32\.00/.test(x)));
  ok('…and a reviewer is told', env.__mail.some(m => /mo@example\.com/.test(m.to) && /needs a look/.test(m.subject)));
  const g = r({ type: 'topup', amount: 300, from: 'Mo Manager', counted: 200, forWhat: 'Float top-up', when: days(4) });
  ok('a top-up after a matching count has no variance', g.entry.variance === 0 && g.float.balance === 500);
  ok('top-up suggestion brings it back to the float', g.float.topUp === 0);
  const h = r({ type: 'topup', amount: 60, from: 'Mo Manager', forWhat: 'Repayment of own money', when: days(3) });
  ok('a repayment clears what is owed, not the float', h.float.owed === 0 && h.float.balance === 500);
  refs.c = c.ref; refs.d = d.ref;
}

/* ── approval, review, query ────────────────────────────────────── */
console.log('approval and review');
{
  const big = post(env, { action: 'pc.submit', token: PAT, entry: spend({ amount: 350, paidTo: 'Hardware Hub', category: 'Repairs & maintenance', sub: 'Building', purpose: 'Lock for the back door', receiptNo: 'HH-9' }) });
  ok('a spend over the limit waits for approval', big.status === 'Awaiting approval');
  const req = post(env, { action: 'pc.submit', token: PAT, entry: { type: 'request', amount: 250, purpose: 'Supplies for the Friday meeting', category: 'Branch events & meetings' } });
  ok('a request waits for approval', req.status === 'Awaiting approval');
  ok('staff cannot approve', /Only a reviewer/.test(post(env, { action: 'pc.review', token: PAT, ref: req.ref, act: 'approve' }).error));
  ok('a decline needs a reason', /why/.test(post(env, { action: 'pc.review', token: MO, ref: req.ref, act: 'decline' }).error));
  const ap = post(env, { action: 'pc.review', token: MO, ref: req.ref, act: 'approve' });
  ok('a reviewer approves', ap.ok && ap.status === 'Approved');
  ok('the holder is told', env.__mail.some(m => m.to === 'pat@example.com' && /approved/.test(m.subject)));
  const tu = post(env, { action: 'pc.submit', token: MO, entry: { type: 'topup', holder: 'Pat Runner', amount: 250, from: 'Mo Manager', counted: 150, requestRef: req.ref } });
  ok('a reviewer records a top-up for a holder against the request', tu.ok && tu.entry.holder === 'Pat Runner');
  const l1 = post(env, { action: 'pc.ledger', token: MO });
  ok('the request is closed by the top-up', l1.entries.find(e => e.ref === req.ref).status === 'Topped up');
  const q = post(env, { action: 'pc.review', token: MO, ref: refs.c, act: 'query', note: 'Who were the doubles for?' });
  ok('a query', q.review === 'Queried');
  ok('only the holder (or a reviewer) answers', /not yours/.test(post(env, { action: 'pc.answer', token: login(env, 'ANN3'), ref: refs.c, note: 'x' }).error));
  const an = post(env, { action: 'pc.answer', token: PAT, ref: refs.c, note: 'Staff on the Friday' });
  ok('the holder answers, and the reviewer hears', an.review === 'Answered' && env.__mail.some(m => /answered/.test(m.subject)));
  const v = post(env, { action: 'pc.review', token: MO, ref: refs.d, act: 'void', note: 'Paid from the manager\'s own account instead' });
  ok('a void needs a reason and keeps the row', v.status === 'Void');
  const l2 = post(env, { action: 'pc.ledger', token: MO });
  const pf = l2.floats.find(f => f.holder === 'Pat Runner');
  ok('a void is out of the balance', l2.entries.find(e => e.ref === refs.d).flags[0] === 'Void');
}

/* ── who sees what ──────────────────────────────────────────────── */
console.log('who sees what');
{
  post(env, { action: 'pc.submit', token: login(env, 'ANN3'), entry: { type: 'topup', amount: 100, from: 'Mo Manager', counted: 0 } });
  const p = post(env, { action: 'pc.ledger', token: PAT }), m = post(env, { action: 'pc.ledger', token: MO });
  ok('staff see their own float only', p.floats.length === 1 && p.floats[0].holder === 'Pat Runner' && p.entries.every(e => e.holder === 'Pat Runner'));
  ok('a reviewer sees every float, an empty one included', m.floats.length === 3, m.floats.map(f => f.holder).join());
}

/* ── red flags ──────────────────────────────────────────────────── */
console.log('red flags');
{
  const e3 = world();
  const t = login(e3, 'PAT1');
  const r = e => post(e3, { action: 'pc.submit', token: t, entry: e });
  r({ type: 'topup', amount: 500, from: 'Mo Manager', counted: 0, when: days(3) });
  r(spend({ amount: 200, paidTo: 'Big Store', receiptNo: 'A1', when: days(2) }));
  const s2 = r(spend({ amount: 180, paidTo: 'Big Store', receiptNo: 'A2', when: new Date(Date.now() - 2 * 86400000 + 60000).toISOString() }));
  ok('two spends under the limit at one shop on one day, over it together: possible split', s2.entry.flags.some(f => /Possible split/.test(f)), s2.entry.flags.join('|'));
  const late = r(spend({ amount: 30, receiptNo: 'L1', when: days(5) }));
  ok('logged days after the spend', late.entry.flags.some(f => /Logged 5 days after/.test(f)), late.entry.flags.join('|'));
  const neg = r(spend({ amount: 200, receiptNo: 'N1', paidTo: 'Other Shop' }));
  ok('the float going below zero', neg.entry.flags.includes('Float below zero after this') && neg.float.balance < 0, String(neg.float.balance));
  const rnd = r(spend({ amount: 100, receipt: '', noReceipt: 'Receipt lost', paidTo: 'Third Shop' }));
  ok('a round amount with no receipt', rnd.entry.flags.includes('Round amount, no receipt'));
  const late2 = r({ type: 'topup', amount: 500, from: 'Mo Manager', counted: -30 });
  ok('a negative count is refused', /Count the cash/.test(late2.error));
}

/* ── the category guess ─────────────────────────────────────────── */
console.log('categories');
{
  const g = s => env.pcGuessCategory_(s);
  ok('doubles → refreshments', g('Doubles for office') === 'Refreshments & meals');
  ok('glue for the car → vehicle', g('To purchase crazy glue for the car') === 'Vehicle');
  ok('a teacher → personal', g('To pay the teacher') === 'Personal (Branch Manager)');
  ok('a mop for the household → personal', g('mop and garbage bags for the household') === 'Personal (Branch Manager)');
  ok('bucket and cleaning supplies → office', g('bucket and cleaning supplies') === 'Office supplies');
  ok('nothing → other', g('zzz') === 'Other');
}

/* ── the Jotform history ────────────────────────────────────────── */
console.log('the Jotform history');
{
  const e4 = world();
  e4.__mkSheet('Form responses', 2, ['Submission Date', 'Request Type', 'Date', 'Cash Balance at hand', 'Staff Spending Cash', 'Amount Spent ',
    'Request Amount ', 'Amount Received', 'Received From:', 'Received by:', 'Request by:', 'Paid To', 'Vehicle #', 'Purpose of Transaction ',
    'Receipt # or Reference ID ', 'Copy of Receipt Upload', 'Submission ID'], [
    [new Date(2026, 7, 18, 15, 30), 'Cash Spent', '08-18-2026', '', 'Pat Runnr', 26, '', '', '', '', '', 'A pharmacy', '', 'Glue for the car', '203', 'https://jot.example/1.jpg', '1001'],
    [new Date(2026, 7, 27, 15, 23), 'Cash Spent', '08-27-2026', '', 'Pat Runnr', 42, '', '', '', '', '', '', '', 'Doubles for office', '', '', '1002'],
    [new Date(2026, 7, 27, 15, 24), 'Cash Recieved', '08-27-2026', 5, '', '', '', 300, 'Mo Manager', 'Pat Runnr', '', '', '', '', '', '', '1003'],
    [new Date(2026, 8, 9, 11, 31), 'Cash Recieved', '09-09-2026', 20, '', '', '', 200, 'Mo Manager', 'Pat Runnr', '', '', '', '', '', '', '1004'],
  ]);
  const msg = e4.pcImportJotform();
  ok('four entries come across', /Imported 4/.test(msg), msg);
  ok('running it again copies nothing', /Imported 0/.test(e4.pcImportJotform()));
  const m = post(e4, { action: 'pc.ledger', token: login(e4, 'MGR9') });
  const es = m.entries;
  ok('a name spelt differently is matched to the Access tab', es.every(e => e.holder === 'Pat Runner'), es.map(e => e.holder).join());
  ok('categories are guessed and said to be guessed', es.find(e => e.ref === 'JF-1002').cat === 'Refreshments & meals' &&
    es.find(e => e.ref === 'JF-1002').flags.some(f => /guessed/.test(f)));
  ok('the spend and the top-up on one afternoon keep their order', es.find(e => e.ref === 'JF-1003').before === -68);
  ok('the balance typed at a top-up is its count', es.find(e => e.ref === 'JF-1003').counted === 5);
  const s = es.find(e => e.ref === 'JF-1004');
  ok('the cash that went unlogged shows as a shortage', s.variance === -285, String(s.variance));
  ok('a missing Jotform receipt is a missing receipt', es.find(e => e.ref === 'JF-1002').flags.includes('No receipt'));
  ok('nothing is e-mailed by the import', e4.__mail.length === 0);
}

/* ── the weekly report ──────────────────────────────────────────── */
console.log('the weekly report');
{
  const e5 = world();
  const t = login(e5, 'PAT1');
  const r = e => post(e5, { action: 'pc.submit', token: t, entry: e });
  const mon = e5.pcWeekStart_(new Date());
  const at = (dAgo, h) => new Date(mon.getTime() - dAgo * 86400000 + h * 3600000).toISOString();
  r({ type: 'topup', amount: 500, from: 'Mo Manager', counted: 0, when: at(6, 9) });
  r(spend({ amount: 120, paidTo: 'Stationers', category: 'Office supplies', sub: 'Stationery & printing', purpose: 'Paper and toner', receiptNo: 'S1', when: at(5, 10) }));
  r(spend({ amount: 80, category: 'Personal (Branch Manager)', sub: 'Household', paidTo: 'Grocer', purpose: 'Household shopping', receiptNo: 'G1', when: at(4, 10) }));
  r({ type: 'count', counted: 290, when: at(3, 16) });
  e5.__mail.length = 0;
  const out = e5.pcWeeklyNow();
  const mail = e5.__mail[0];
  ok('it goes to the reviewers', mail && /mo@example\.com/.test(mail.to), out);
  ok('the subject carries the spend and the shortage', /TT\$200\.00 spent · TT\$10\.00 short/.test(mail.subject), mail.subject);
  ok('branch and personal apart', /TT\$120\.00/.test(mail.htmlBody) && /TT\$80\.00 personal/.test(mail.htmlBody));
  ok('every float reconciled, with what tops it up', /Pat Runner/.test(mail.htmlBody) && /Top up by/.test(mail.htmlBody));
  ok('by category', /Office supplies/.test(mail.htmlBody) && /Personal \(Branch Manager\)/.test(mail.htmlBody));
  ok('what stands out leads with the shortage', /short<\/b> of the book/.test(mail.htmlBody));
  ok('it is logged on the weekly tab', e5.__sheets['Petty Cash Weekly']._grid.length === 2);
  e5.pcWeeklyOn(); e5.pcWeeklyOn();
  const trig = e5.ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction() === 'pcWeeklyReport');
  ok('switching it on twice leaves one Monday trigger', trig.length === 1 && trig[0].chain.join().includes('MONDAY'));
  const pv = e5.pcWeeklyPreview();
  ok('the preview goes only to the script owner', e5.__mail.slice(-1)[0].to === 'ricky@example.com' && /PREVIEW/.test(e5.__mail.slice(-1)[0].subject));
}

/* ── the Delivery Book still works beside it ───────────────────── */
console.log('beside the Delivery Book');
{
  ok('the delivery book still answers its own actions', post(env, { action: 'apps', token: PAT }).ok);
  ok('an unknown action is still refused', post(env, { action: 'nope', token: PAT }).error === 'Unknown action');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
