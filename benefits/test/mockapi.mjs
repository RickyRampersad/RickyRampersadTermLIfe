/* The Apps Script contract, run locally.

   Lived in a session scratchpad until the container was reclaimed and took
   163 assertions with it. It is in the repository now, same actions, same
   auth rules, so the wired pages can be driven end to end without touching
   the live script.

   EVERY NAME, COMPANY AND SCHEME NUMBER IN THIS FILE IS INVENTED. It has to
   be: the repository root publishes to rickyrampersadbranch.com, so this file
   is served at a public URL, and a fixture built out of the real book would
   put a named administrator, her members and their scheme numbers on the open
   web. It was built that way once — 13 September 2026, when the benches moved
   in from the scratchpad — and replaced the same day. If a bench ever needs a
   real record to prove something, the bench is wrong.

   Started by benefits/test/run.sh on 8940; state is readable on 8944. */
import http from 'http';

const state = { comments: [], leavers: [], mails: [], feed: [] };

/* One client on the access list, and the branch codes. */
const CLIENT = { code: 'MH001', pw: '1', name: 'Anisa Boodram',
                 company: 'MERIDIAN HARDWARE LIMITED' };
const STAFF = { 'RRB2026': 'Branch staff', 'A00427': 'Ricky Rampersad' };
const DESK = 'Branch service desk';

const LEDGER = [
  { month: 'September 2026', billed: 28813, paid: 0,     open: 28813, state: 'outstanding',
    lines: [{ line: 'Group Health', invoice: 'TPG9002', billed: 28813, paid: 0 }] },
  { month: 'August 2026',    billed: 28813, paid: 28813, open: 0,     state: 'settled',
    lines: [{ line: 'Group Health', invoice: 'TPG9002', billed: 28813, paid: 28813 }] },
  { month: 'July 2026',      billed: 28400, paid: 14000, open: 14400, state: 'part paid',
    lines: [{ line: 'Group Health', invoice: 'TPG9001', billed: 28400, paid: 14000 }] }
];

const QUERIES = () => ([
  { source: 'billing', ref: 'S1', month: 'August 2026',
    subject: 'Query on the August 2026 billing',
    reasons: ['Someone on this billing has left us', 'A premium looks wrong'],
    note: 'Alleyne left on 31 July but is still charged on health.',
    status: 'With the branch', open: true, reply: null, repliedAt: null,
    at: 'Mon Aug 24 2026',
    thread: state.comments.filter(c => c.thread === 'S1') },
  { source: 'billing', ref: 'S0', month: 'July 2026',
    subject: 'July 2026 billing confirmed as correct',
    reasons: [], note: '', status: 'Confirmed', open: false,
    reply: null, repliedAt: null, at: 'Fri Jul 25 2026',
    thread: state.comments.filter(c => c.thread === 'S0') },
  { source: 'branch', ref: '00T1',
    subject: 'T- PENSIONS GROUP- Renewal Date - 9/1/2026 - MERIDIAN HARDWARE LIMITED',
    status: 'Waiting on someone else', open: true, withWhom: DESK,
    due: '2026-09-08', at: '2026-08-28',
    thread: state.comments.filter(c => c.thread === '00T1') },
  { source: 'branch', ref: '00T2',
    subject: 'T-HEALTH GROUP- Billing Date - 9/1/2026 - MERIDIAN HARDWARE LIMITED',
    status: 'Completed', open: false, withWhom: DESK,
    due: '2026-08-28', at: '2026-08-26',
    thread: state.comments.filter(c => c.thread === '00T2') }
]);

/* ── the account ──
   Guardian's own renewal records. Shaped exactly as the org returns them,
   including the part that matters most: a group renewal carries payments and
   carries NO billed figure. Two of these deliberately hold a task the
   allow-list must strip before it leaves the engine. */
const TXNS = [
  { ref: 'a03A1', name: 'TRANS-280820260015061', line: 'life',
    type: 'T-LIFE GROUP', year: 2026, month: 9, renewal: '2026-09-01',
    next: '2027-09-01', issued: '2007-01-01', bill: 'TGM 4400',
    portfolio: 'CLIENT-0099001', recordType: 'life group',
    status: 'Premium Paying', state: 'inforce',
    billed: null, received: 0, daysOut: 12,
    payments: [],
    tasks: [
      { ref: '00TA1', subject: 'T-LIFE GROUP- Renewal Date - 9/1/2026 - MERIDIAN HARDWARE LIMITED',
        status: 'Waiting on someone else', open: true, withWhom: DESK,
        contact: 'Anisa Boodram', due: '2026-09-17', at: '2026-08-28',
        daysOpen: 16, daysToClose: null },
      { ref: '00TA2', subject: 'Email: T-LIFE GROUP- Renewal Date - 9/1/2026 - MERIDIAN HARDWARE LIMITED',
        status: 'Completed', open: false, withWhom: DESK,
        contact: 'Anisa Boodram', due: '2026-08-28', at: '2026-08-28',
        daysOpen: null, daysToClose: 0 }
    ] },
  { ref: 'a03A2', name: 'TRANS-280820260015062', line: 'health',
    type: 'T-HEALTH GROUP', year: 2026, month: 9, renewal: '2026-09-01',
    next: '2027-09-01', issued: '2007-01-01', bill: '01_MERID001',
    portfolio: 'INSURE-0009901', recordType: 'health group',
    status: 'Premium Paying', state: 'inforce',
    billed: null, received: 0, daysOut: 12,
    payments: [],
    tasks: [
      { ref: '00TA3', subject: 'T-HEALTH GROUP- Billing Date - 9/1/2026 - MERIDIAN HARDWARE LIMITED',
        status: 'Waiting on someone else', open: true, withWhom: DESK,
        contact: 'Anisa Boodram', due: '2026-09-17', at: '2026-08-28',
        daysOpen: 16, daysToClose: null }
    ] },
  { ref: 'a03A3', name: 'TRANS-300620260014896', line: 'pension',
    type: 'T- PENSIONS GROUP', year: 2026, month: 7, renewal: '2026-07-01',
    next: '2027-07-01', issued: '2011-04-01', bill: 'M310',
    portfolio: 'CLIENT-0099002', recordType: 'pension',
    status: 'Premium Paying', state: 'inforce',
    billed: null, received: 40814.46, daysOut: 74,
    payments: [
      { ref: 'PMT09001', amount: 40814.46, on: '2026-09-02', how: 'Wire Transfer',
        bank: '', cheque: '', receipt: '' }
    ],
    tasks: [
      { ref: '00TA4', subject: 'T- PENSIONS GROUP- Renewal Date - 7/1/2026 - MERIDIAN HARDWARE LIMITED',
        status: 'Completed', open: false, withWhom: DESK,
        contact: 'Anisa Boodram', due: '2026-07-30', at: '2026-06-30',
        daysOpen: null, daysToClose: 30 }
    ] },
  { ref: 'a03A4', name: 'TRANS-270720260014974', line: 'life',
    type: 'T-LIFE GROUP', year: 2026, month: 8, renewal: '2026-08-01',
    next: '2027-08-01', issued: '2007-01-01', bill: 'TGM 4400',
    portfolio: 'CLIENT-0099001', recordType: 'life group',
    status: 'Premium Paying', state: 'inforce',
    billed: null, received: 15903.10, daysOut: 43,
    payments: [
      { ref: 'PMT09002', amount: 15903.10, on: '2026-08-14', how: 'Cheque',
        bank: 'Republic', cheque: '004412', receipt: 'RC-9002' }
    ],
    tasks: [] }
];

/* Nothing here carries a keyperson task or an individual's renewal, because
   the engine's allow-list strips those before they leave it and this file
   stands in for the engine. The bench proves it by asserting their absence
   from the page, which is the only place a leak would show. */
const ACCOUNT = (year, month) => {
  const years = [...new Set(TXNS.map(t => t.year))].sort((a, b) => b - a);
  const monthsByYear = {};
  TXNS.forEach(t => {
    (monthsByYear[t.year] = monthsByYear[t.year] || []);
    if (!monthsByYear[t.year].includes(t.month)) monthsByYear[t.year].push(t.month);
  });
  Object.keys(monthsByYear).forEach(y => monthsByYear[y].sort((a, b) => b - a));

  const y = year || years[0];
  const m = month || 0;
  const shown = TXNS.filter(t => t.year === y && (!m || t.month === m));
  const ledger = LEDGER.filter(l => {
    const d = new Date(l.month + ' 1');
    return d.getFullYear() === y && (!m || d.getMonth() + 1 === m);
  });
  const received = shown.reduce((s, t) => s + (t.received || 0), 0);
  const billed = ledger.reduce((s, l) => s + l.billed, 0);
  let open = 0, closed = 0;
  shown.forEach(t => t.tasks.forEach(k => k.open ? open++ : closed++));

  return { ok: true, group: CLIENT.company, shown: true, read: '2026-09-13T10:00:00Z',
    from: y, years, monthsByYear, year: y, month: m,
    transactions: shown, ledger,
    totals: { renewals: shown.length,
      received: Math.round(received * 100) / 100,
      /* Never a zero. Guardian holds no billed figure on a group renewal, so
         where the branch log has nothing either the answer is "we do not
         know", not "nothing". */
      billed: ledger.length ? Math.round(billed * 100) / 100 : null,
      billedFrom: ledger.length ? 'branch' : null,
      open, closed },
    chatter: true };
};

const GROUPVIEW = () => ({
  ok: true, group: CLIENT.company, shown: true, read: '2026-09-13T10:00:00Z',
  inForce: { life: 67, health: 67, pension: 38 }, stale: 3,
  pension: { monthly: 12480.50, priced: 14, owned: 17, unclear: 19, personal: 2, total: 38 },
  billsByLine: { life: ['TGM 4400'], health: ['01_MERID00'], pension: ['M310', 'B915'] },
  bills: [{ bill: 'TGM 4400', records: 62 }, { bill: '01_MERID00', records: 67 }],
  ledger: LEDGER,
  queries: QUERIES(),
  members: [
    { name: 'Terrence Alleyne', lines: ['life','health'], certs: ['172','TPG9002-00176-00'],
      plans: [], inForce: true, pending: false, lifeCover: 150000, adndCover: 150000,
      healthCover: null, monthly: 96.5, statusClash: null,
      holds: { life: true, adnd: true, health: false, monthly: true } },
    { name: 'Farida Hosein', lines: ['health'], certs: ['TPG9002-00092-00'], plans: [],
      inForce: true, pending: false, lifeCover: null, adndCover: null, healthCover: null,
      monthly: 412, statusClash: null,
      holds: { life: false, adnd: false, health: false, monthly: true } },
    { name: 'Devon Marcelle', lines: ['life'], certs: ['TPG 231'], plans: [],
      inForce: true, pending: false, lifeCover: null, adndCover: null, healthCover: null,
      monthly: 40, statusClash: null,
      holds: { life: false, adnd: false, health: false, monthly: true } },
    { name: 'Renuka Balgobin', lines: ['health'], certs: ['TPG9002-00311-00'], plans: [],
      inForce: true, pending: false, lifeCover: null, adndCover: null, healthCover: null,
      monthly: null, statusClash: 'Lapsed / Premium paying',
      holds: { life: false, adnd: false, health: false, monthly: false } }
  ],
  pending: [
    { name: 'Curtis Ramkissoon', line: 'life', policy: 'TGM - Curtis Ramkissoon',
      status: 'Pending', since: '2023-09-07', days: 1102, statusAt: null,
      modified: '2024-01-04', stale: true },
    { name: 'Shivanie Persad', line: 'life', policy: '212', status: 'Pending',
      since: '2023-10-13', days: 1066, statusAt: null, modified: '2023-10-20', stale: true },
    { name: 'Aaron Mohammed', line: 'health', policy: 'TPG9004-00023-00', status: 'Pending',
      since: '2024-07-31', days: 774, statusAt: null, modified: '2026-03-27', stale: true }
  ],
  tracked: [
    { id: 'T1', group: CLIENT.company, member: 'Terrence Alleyne', line: 'life',
      lastDay: '2026-07-31', reason: 'Resignation', by: 'Anisa Boodram', at: '2026-08-03',
      state: 'SENT', sentAt: '2026-08-04', actionedAt: '', settledAt: '' },
    { id: 'T2', group: CLIENT.company, member: 'Nigel Baptiste', line: 'life',
      lastDay: '2026-07-31', reason: 'Resignation', by: 'Anisa Boodram', at: '2026-08-03',
      state: 'ACTIONED', sentAt: '2026-08-04', actionedAt: '2026-08-20', settledAt: '' },
    { id: 'T3', group: CLIENT.company, member: 'Camille Sookoo', line: 'life',
      lastDay: '2026-07-31', reason: 'End of contract', by: 'Anisa Boodram', at: '2026-07-30',
      state: 'SETTLED', sentAt: '2026-07-31', actionedAt: '2026-08-15', settledAt: '2026-08-26' }
  ],
  ended: [
    { name: 'Wendell Charles', line: 'health', policy: '', status: 'Not taken',
      since: '2024-02-01', days: 956, statusAt: '2025-08-27', modified: '2025-08-27', stale: true }
  ]
});

http.createServer((req, res) => {
  const hdr = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const send = o => { res.writeHead(200, hdr); res.end(JSON.stringify(o)); };
  if (req.method === 'GET') return send({ ok: false, error: 'Unknown action.' });

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    let b = {}; try { b = JSON.parse(body); } catch (e) {}
    const isClient = String(b.code || '').toUpperCase() === CLIENT.code && b.password === CLIENT.pw;
    const staff = STAFF[String(b.auth || '').toUpperCase()];

    if (b.action === 'signin') {
      const c = String(b.code || '').toUpperCase();
      if (c === CLIENT.code && b.password === CLIENT.pw)
        return send({ ok: true, role: 'client', name: CLIENT.name, company: CLIENT.company,
          title: 'Administrator', rows: LEDGER.flatMap(m => m.lines.map(l => ({
            month: m.month, line: l.line, invoice: l.invoice, billed: l.billed,
            paid: l.paid, paidOn: l.paid ? '2026-08-20' : '', method: l.paid ? 'Cheque' : '',
            receipt: l.paid ? 'RC-9001' : '', note: '' }))) });
      if (c === 'A00427' && b.password === 'SHEETPW')
        return send({ ok: true, name: 'Ricky Rampersad', role: 'manager', title: 'Branch Manager' });
      return send({ ok: false, error: 'Not on the access list — check the login and password.' });
    }

    if (b.action === 'groupview') {
      if (!isClient && !staff)
        return send({ ok: false, error: 'Not on the access list — check the login and password.' });
      return send(GROUPVIEW());
    }

    if (b.action === 'account') {
      if (!isClient && !staff)
        return send({ ok: false, error: 'Not on the access list — check the login and password.' });
      return send(ACCOUNT(Number(b.year) || 0, Number(b.month) || 0));
    }

    /* The thread. The group is read off the access row, never off the
       request — the rule the real engine enforces, mirrored here so the
       bench can prove a client cannot write onto another company. */
    if (b.action === 'querycomment') {
      if (!isClient && !staff)
        return send({ ok: false, error: 'Not on the access list — check the login and password.' });
      const thread = String(b.thread || '').trim();
      const text = String(b.text || '').trim();
      if (!thread) return send({ ok: false, error: 'Which query?' });
      if (!text) return send({ ok: false, error: 'Nothing to say?' });
      if (text.length > 4000) return send({ ok: false, error: 'That is longer than a comment — send it to us by email.' });
      const by = staff || CLIENT.name;
      const role = staff ? 'branch' : 'client';
      const at = new Date().toISOString().slice(0, 16).replace('T', ' ');
      state.comments.push({ at, thread, group: CLIENT.company, by, role, text });
      if (role === 'client') state.mails.push({ to: 'staff@branch', subject: 'Query comment: ' + CLIENT.company });

      /* Only onto records the engine will post onto — a Task or a
         transaction. A billing query of ours has no Salesforce record, so
         nothing is attempted and the reply says so. */
      const feed = { attempted: /^(00T|a03)/.test(thread), ok: false };
      if (feed.attempted) {
        /* One ref is rigged to fail, so the bench can prove the page tells
           the employer when a comment did not reach Guardian. */
        feed.ok = thread !== '00TA3';
        if (feed.ok) state.feed.push({ at, subjectId: thread, by, text });
        else feed.why = 'INSUFFICIENT_ACCESS';
      }
      return send({ ok: true, at, by, role, feed });
    }

    if (b.action === 'reportleaver') {
      if (!isClient) return send({ ok: false, error: 'Not on the access list — check the login and password.' });
      const members = [].concat(b.member || b.members || []);
      if (!members.length) return send({ ok: false, error: 'Who has left?' });
      const day = m => String((m && m.lastDay) || b.lastDay || '').trim();
      const why = m => String((m && m.reason) || b.reason || '');
      const death = s => /death|deceased|passed away/i.test(String(s || ''));
      if (death(b.reason) || members.some(m => death(why(m))))
        return send({ ok: false, error: 'A death in service is a claim, not a termination — call the branch on 678-5921.' });
      const undated = members.filter(m => !day(m)).map(m => String(m && m.name ? m.name : m).trim() || 'one unnamed entry');
      if (undated.length) return send({ ok: false,
        error: 'A termination needs the last day — the premium stops from that date. Missing for ' + undated.join(', ') + '.' });
      const made = members.map(m => ({ name: String(m && m.name ? m.name : m).trim(),
        line: String((m && m.line) || b.line || 'life'), lastDay: day(m), reason: why(m) }));
      state.leavers.push(...made);
      state.mails.push({ to: 'staff@branch', subject: 'Leaver reported: ' + (b.group || '') + ' — ' + made.length });
      return send({ ok: true, made: made.length });
    }

    send({ ok: false, error: 'Unknown action.' });
  });
}).listen(8940, () => console.log('mock api on 8940'));

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(state));
}).listen(8944);
