/* The Apps Script contract, run locally.

   Lived in a session scratchpad until the container was reclaimed and took
   163 assertions with it. It is in the repository now, same actions, same
   auth rules, so the wired pages can be driven end to end without touching
   the live script.

   Started by benefits/test/run.sh on 8940; state is readable on 8944. */
import http from 'http';

const state = { comments: [], leavers: [], mails: [] };

/* One client on the access list, and the branch codes. */
const CLIENT = { code: 'VK001', pw: '1', name: 'Veena Kanhai-Gowdhan',
                 company: 'D RAMPERSAD & COMPANY LTD' };
const STAFF = { 'RRB2026': 'Branch staff', 'A00427': 'Ricky Rampersad' };

const LEDGER = [
  { month: 'September 2026', billed: 28813, paid: 0,     open: 28813, state: 'outstanding',
    lines: [{ line: 'Group Health', invoice: 'TPG0278', billed: 28813, paid: 0 }] },
  { month: 'August 2026',    billed: 28813, paid: 28813, open: 0,     state: 'settled',
    lines: [{ line: 'Group Health', invoice: 'TPG0278', billed: 28813, paid: 28813 }] },
  { month: 'July 2026',      billed: 28400, paid: 14000, open: 14400, state: 'part paid',
    lines: [{ line: 'Group Health', invoice: 'TPG0277', billed: 28400, paid: 14000 }] }
];

const QUERIES = () => ([
  { source: 'billing', ref: 'S1', month: 'August 2026',
    subject: 'Query on the August 2026 billing',
    reasons: ['Someone on this billing has left us', 'A premium looks wrong'],
    note: 'Ramdath left on 31 July but is still charged on health.',
    status: 'With the branch', open: true, reply: null, repliedAt: null,
    at: 'Mon Aug 24 2026',
    thread: state.comments.filter(c => c.thread === 'S1') },
  { source: 'billing', ref: 'S0', month: 'July 2026',
    subject: 'July 2026 billing confirmed as correct',
    reasons: [], note: '', status: 'Confirmed', open: false,
    reply: null, repliedAt: null, at: 'Fri Jul 25 2026',
    thread: state.comments.filter(c => c.thread === 'S0') },
  { source: 'branch', ref: '00T1',
    subject: 'T- PENSIONS GROUP- Renewal Date - 9/1/2026 - D RAMPERSAD & COMPANY LTD',
    status: 'Waiting on someone else', open: true, withWhom: 'Kamla Dookran',
    due: '2026-09-08', at: '2026-08-28',
    thread: state.comments.filter(c => c.thread === '00T1') },
  { source: 'branch', ref: '00T2',
    subject: 'T-HEALTH GROUP- Billing Date - 9/1/2026 - D RAMPERSAD & COMPANY LTD',
    status: 'Completed', open: false, withWhom: 'Kamla Dookran',
    due: '2026-08-28', at: '2026-08-26',
    thread: state.comments.filter(c => c.thread === '00T2') }
]);

const GROUPVIEW = () => ({
  ok: true, group: CLIENT.company, shown: true, read: '2026-09-13T10:00:00Z',
  inForce: { life: 67, health: 67, pension: 38 }, stale: 3,
  pension: { monthly: 12480.50, priced: 14, owned: 17, unclear: 19, personal: 2, total: 38 },
  billsByLine: { life: ['TGM 1099'], health: ['01_DRACO00'], pension: ['D041', 'B087'] },
  bills: [{ bill: 'TGM 1099', records: 62 }, { bill: '01_DRACO00', records: 67 }],
  ledger: LEDGER,
  queries: QUERIES(),
  members: [
    { name: 'Harripersad Ramdath', lines: ['life','health'], certs: ['172','TPG0278-00176-00'],
      plans: [], inForce: true, pending: false, lifeCover: 150000, adndCover: 150000,
      healthCover: null, monthly: 96.5, statusClash: null,
      holds: { life: true, adnd: true, health: false, monthly: true } },
    { name: 'Nadira Khan', lines: ['health'], certs: ['TPG0278-00092-00'], plans: [],
      inForce: true, pending: false, lifeCover: null, adndCover: null, healthCover: null,
      monthly: 412, statusClash: null,
      holds: { life: false, adnd: false, health: false, monthly: true } },
    { name: 'Vedish Roopchand', lines: ['life'], certs: ['TPG 231'], plans: [],
      inForce: true, pending: false, lifeCover: null, adndCover: null, healthCover: null,
      monthly: 40, statusClash: null,
      holds: { life: false, adnd: false, health: false, monthly: true } },
    { name: 'Anand Maloney', lines: ['health'], certs: ['TPG0278-00311-00'], plans: [],
      inForce: true, pending: false, lifeCover: null, adndCover: null, healthCover: null,
      monthly: null, statusClash: 'Lapsed / Premium paying',
      holds: { life: false, adnd: false, health: false, monthly: false } }
  ],
  pending: [
    { name: 'Jeanmarc Rampersad', line: 'life', policy: 'TGM - Jeanmarc Rampersad',
      status: 'Pending', since: '2023-09-07', days: 1102, statusAt: null,
      modified: '2024-01-04', stale: true },
    { name: 'Reynold Daron Isaacs', line: 'life', policy: '212', status: 'Pending',
      since: '2023-10-13', days: 1066, statusAt: null, modified: '2023-10-20', stale: true },
    { name: 'Dwaine John', line: 'health', policy: 'TPG0864-00023-00', status: 'Pending',
      since: '2024-07-31', days: 774, statusAt: null, modified: '2026-03-27', stale: true }
  ],
  tracked: [
    { id: 'T1', group: CLIENT.company, member: 'Harripersad Ramdath', line: 'life',
      lastDay: '2026-07-31', reason: 'Resignation', by: 'Veena Kanhai', at: '2026-08-03',
      state: 'SENT', sentAt: '2026-08-04', actionedAt: '', settledAt: '' },
    { id: 'T2', group: CLIENT.company, member: 'Rajesh Jadoonanan', line: 'life',
      lastDay: '2026-07-31', reason: 'Resignation', by: 'Veena Kanhai', at: '2026-08-03',
      state: 'ACTIONED', sentAt: '2026-08-04', actionedAt: '2026-08-20', settledAt: '' },
    { id: 'T3', group: CLIENT.company, member: 'Suraj Roopchand', line: 'life',
      lastDay: '2026-07-31', reason: 'End of contract', by: 'Veena Kanhai', at: '2026-07-30',
      state: 'SETTLED', sentAt: '2026-07-31', actionedAt: '2026-08-15', settledAt: '2026-08-26' }
  ],
  ended: [
    { name: 'Mark Gunness', line: 'health', policy: '', status: 'Not taken',
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
            receipt: l.paid ? 'RC-1001' : '', note: '' }))) });
      if (c === 'A00427' && b.password === 'SHEETPW')
        return send({ ok: true, name: 'Ricky Rampersad', role: 'manager', title: 'Branch Manager' });
      return send({ ok: false, error: 'Not on the access list — check the login and password.' });
    }

    if (b.action === 'groupview') {
      if (!isClient && !staff)
        return send({ ok: false, error: 'Not on the access list — check the login and password.' });
      return send(GROUPVIEW());
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
      return send({ ok: true, at, by, role });
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
