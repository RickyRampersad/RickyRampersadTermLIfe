// The three lines are stretches, and the letters are joined by client number.
//
// Until 16 September 2026 "the 60-day line" on the wall was the policies that
// were exactly sixty days unpaid that morning — fifteen of them — and said
// nothing about the four hundred sitting between sixty and ninety. This file
// holds the band edges to the day: 44 is in no band, 59 is still in 45, 60
// opens the next one, 89 closes it, 90 opens the last one and nothing closes
// that.
//
// It also holds the join. The survey tab has one row per client per letter
// and the client number is the key — a client with three policies on the line
// got ONE letter. A join on the policy column finds it for one of the three
// and calls the other two silent, so this fixture plants a live row whose
// policy number matches a dues row and whose client number matches nothing,
// and asserts it joins nowhere.
//
// And it holds the contract the wall lives under: the feed is read by a screen
// with no sign-in, so nothing finer than a count, a premium, an agent's name
// or a band may leave the server.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Intelligence.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv({ props: { INTEL_EXCLUDE_AGENTS: 'Gone Away' } });
const NOW = new Date('2026-09-16T10:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

/* Paid To Date as the extract writes it, N days before the fixed today. */
const DAY = 86400000;
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = n => iso(new Date(NOW.getTime() - n * DAY));

/* ── 1. The dues tab: twelve pretend rows across the bands ──────────────── */
const DUESH = ['Agent', 'Number', 'Client Number', 'Client', 'Premium', 'Issue Date', 'Status',
               'Status(2)', 'Days', 'Insurance Type', 'Paid To Date', 'Sum Assured', 'Plan Code',
               'Billing type', 'Mode', 'Status Description', 'Projected Lapse Date', 'Phone', 'email'];
const due = (agent, pol, clientNo, days, prem, status, lapse) =>
  [agent, pol, clientNo, 'Zed Pretend-Client', prem, '2015-03-01', status || '2', '', days || 0, '2',
   days ? ago(days) : '', 250000, 'ECT65 1', 'Direct Bill', '', status === '1' ? 'Lapsed' : 'Premium Paying',
   lapse || '', '868-000-0000', 'nobody@example.invalid'];
env.__mkSheet('Dues', 9, DUESH, [
  due('Anand Pretend',   'P-1',  'C001', 44,  100),            // one day short of the first line
  due('Anand Pretend',   'P-2',  'C002', 45,  200),            // on it
  due('Beena Sample',    'P-3',  'C003', 59,  300),            // last day of the 45 stretch
  due('Beena Sample',    'P-4',  'C003', 50,  50),             // the same client, a second policy
  due('Carl Fictitious', 'P-5',  'C004', 60,  400),            // first day of 60
  due('Anand Pretend',   'P-6',  'C005', 89,  500),            // last day of 60
  due('Beena Sample',    'P-7',  'C006', 90,  600),            // first day of 90
  due('Carl Fictitious', 'P-8',  'C007', 400, 700),            // deep in 90
  due('Gone Away',       'P-9',  'C008', 61,  1000),           // excluded agent, in 60
  due('Carl Fictitious', 'P-12', 'C011', 75,  150),            // middle of 60; the policy-join trap
  due('Anand Pretend',   'P-10', 'C009', 0,   80,  '1', '2026-09-05'),   // lapsed this month
  due('Beena Sample',    'P-11', 'C010', 0,   90,  '1', '2026-08-20'),   // lapsed last month
  due('Gone Away',       'P-13', 'C012', 0,   70,  '1', '2026-09-10'),   // lapsed this month, excluded
  due('Carl Fictitious', 'P-14', 'C013', 0,   60)                        // overdue with no paid-to date
]);

/* ── 2. The survey tab: live, dry and test rows, in the tab's own 30 columns */
const SH = env.iSurveyTab_();          // creates the tab with its header row
const C = env.ISCOL;
const srow = o => {
  const r = new Array(30).fill('');
  r[C.TOKEN - 1] = 'tok-' + Math.random().toString(36).slice(2, 8);
  r[C.SENT - 1] = new realDate(o.sent + 'T09:00:00');
  r[C.CLIENTNO - 1] = o.clientNo || '';
  r[C.CLIENT - 1] = 'Zed Pretend-Client';
  r[C.EMAIL - 1] = 'nobody@example.invalid';
  r[C.POLICY - 1] = o.policy || '';
  r[C.AGENT - 1] = o.agent || 'Anand Pretend';
  r[C.MODE - 1] = o.mode;
  if (o.rating) { r[C.RATING - 1] = o.rating; r[C.RATEDAT - 1] = new realDate(o.sent + 'T18:00:00'); }
  if (o.heard) r[C.HEARD - 1] = o.heard;
  if (o.asked) { r[C.ASKED - 1] = o.asked; r[C.ASKEDAT - 1] = new realDate(o.sent + 'T19:00:00'); }
  if (o.followup) r[C.FOLLOWUP - 1] = o.followup;
  if (o.owner) r[C.OWNER - 1] = o.owner;
  if (o.closed) r[C.CLOSED - 1] = new realDate(o.closed + 'T12:00:00');
  if (o.outcome) r[C.OUTCOME - 1] = o.outcome;
  if (o.optout) r[C.OPTOUT - 1] = new realDate(o.optout + 'T12:00:00');
  return r;
};
[ // C002 rated five: a reply, and a happy one.
  srow({ clientNo: 'C002', policy: 'P-2', sent: '2026-09-01', mode: 'live · cleared abc123 by Reviewer Pretend', rating: 5 }),
  // C003 rated two: low, a follow-up was opened and the desk took it.
  srow({ clientNo: 'C003', policy: 'P-3', sent: '2026-09-02', mode: 'live · cleared abc123 by Reviewer Pretend',
         rating: 2, followup: 'rated 2 out of 5', owner: 'desk@example.invalid' }),
  // C004: the letter went out and nothing came back.
  srow({ clientNo: 'C004', policy: 'P-5', sent: '2026-08-20', mode: 'live · cleared abc123 by Reviewer Pretend' }),
  // C005 has not heard from their agent: low, follow-up opened, nobody has picked it up.
  srow({ clientNo: 'C005', policy: 'P-6', sent: '2026-08-15', mode: 'live · cleared abc123 by Reviewer Pretend',
         heard: 'No', followup: 'has not heard from their agent in a year' }),
  // C006's LATEST letter: two taps, closed with an outcome typed by staff.
  srow({ clientNo: 'C006', policy: 'P-7', sent: '2026-07-20', mode: 'live · cleared abc123 by Reviewer Pretend',
         asked: 'review, help', closed: '2026-07-24', outcome: 'Spoke to Zed Pretend-Client, all settled' }),
  // C006's OLDER letter, rated one — listed after the newer one, and must lose to it.
  srow({ clientNo: 'C006', policy: 'P-7', sent: '2026-06-01', mode: 'live · cleared abc123 by Reviewer Pretend', rating: 1 }),
  // C007 only ever had a dry run and a test send. Neither reached a client.
  srow({ clientNo: 'C007', policy: 'P-8', sent: '2026-09-10', mode: 'dry', rating: 1 }),
  srow({ clientNo: 'C007', policy: 'P-8', sent: '2026-09-11', mode: 'test', rating: 1 }),
  // The trap: a live row whose POLICY is C011's and whose client number is nobody's.
  srow({ clientNo: 'C999', policy: 'P-12', sent: '2026-09-03', mode: 'live · cleared abc123 by Reviewer Pretend', rating: 1 }),
  // A live row with no client number at all cannot be joined to anything.
  srow({ clientNo: '', policy: 'P-5', sent: '2026-09-04', mode: 'live · cleared abc123 by Reviewer Pretend', rating: 1 })
].forEach(r => SH.appendRow(r));

/* ── 3. The band edges, to the day ───────────────────────────────────────── */
console.log('\nA band is a stretch, and its edges are exact:\n');
ok('44 days is in no band',            env.iWallBandOf_(44) === null, String(env.iWallBandOf_(44)));
ok('45 opens the 45 stretch',           env.iWallBandOf_(45) === 45);
ok('59 is still in 45',                 env.iWallBandOf_(59) === 45, String(env.iWallBandOf_(59)));
ok('60 opens the 60 stretch',           env.iWallBandOf_(60) === 60);
ok('89 is still in 60',                 env.iWallBandOf_(89) === 60, String(env.iWallBandOf_(89)));
ok('90 opens the last one',             env.iWallBandOf_(90) === 90);
ok('and nothing closes it',             env.iWallBandOf_(4000) === 90);
ok('the 45 stretch is labelled 45–59 days', env.iWallBandRange_(45).label === '45–59 days', env.iWallBandRange_(45).label);
ok('the 60 stretch is labelled 60–89 days', env.iWallBandRange_(60).label === '60–89 days', env.iWallBandRange_(60).label);
ok('the 90 stretch has no upper edge',  env.iWallBandRange_(90).to === null && /over/.test(env.iWallBandRange_(90).label));
ok('ageing inside 90 tells a year from a quarter',
   env.iWallAgeingOf_(90, 90) === '90–119 days' && env.iWallAgeingOf_(90, 400) === '365+ days',
   env.iWallAgeingOf_(90, 90) + ' / ' + env.iWallAgeingOf_(90, 400));

/* ── 4. The build ────────────────────────────────────────────────────────── */
const d = env.iBuildWall45_(45);
ok('the build ran', !d.error, d.error);
const band = n => (d.bands || []).filter(b => b.band === n)[0] || {};
const B45 = band(45), B60 = band(60), B90 = band(90);

console.log('\nEach stretch carries its own policies, premium and agents:\n');
ok('45–59 holds three policies', B45.policies === 3, String(B45.policies));
ok('and TT$550 of premium', B45.premium === 550, String(B45.premium));
ok('across two clients — one of them twice', B45.clients === 2, String(B45.clients));
ok('and two agents', B45.agentCount === 2 && B45.agents.length === 2, JSON.stringify(B45.agents));
ok('44 days is in none of them', B45.policies + B60.policies + B90.policies === 8,
   [B45.policies, B60.policies, B90.policies].join('/'));
ok('60–89 holds 60, 75 and 89, and not the excluded 61', B60.policies === 3 && B60.premium === 1050,
   B60.policies + ' / ' + B60.premium);
ok('90 and over holds 90 and 400', B90.policies === 2 && B90.premium === 1300, B90.policies + ' / ' + B90.premium);
ok('the day-line is still published for the chrome and the hero', B45.onLine === 1 && B45.past === 8,
   B45.onLine + ' / ' + B45.past);
ok('the label rides along', B45.label === '45–59 days' && B60.label === '60–89 days');

console.log('\nAnd how long each has been under its line:\n');
const age = (b, k) => (b.ageing || []).filter(x => x.k === k)[0] || {};
ok('45 → one on the day, one at fifty, one at fifty-nine',
   age(B45, '45–49 days').n === 1 && age(B45, '50–54 days').n === 1 && age(B45, '55–59 days').n === 1,
   JSON.stringify(B45.ageing));
ok('60 → 60, 75 and 89 land in three different thirds',
   age(B60, '60–69 days').n === 1 && age(B60, '70–79 days').n === 1 && age(B60, '80–89 days').n === 1,
   JSON.stringify(B60.ageing));
ok('90 → ninety days and four hundred are not the same bucket',
   age(B90, '90–119 days').n === 1 && age(B90, '365+ days').n === 1 && age(B90, '120–179 days').n === 0,
   JSON.stringify(B90.ageing));
ok('the ageing keeps the table order so it reads as a timeline',
   B90.ageing.map(x => x.k).join('|') === '90–119 days|120–179 days|180–364 days|365+ days');

/* ── 5. The letters, joined by client number ─────────────────────────────── */
console.log('\nThe letters are joined by client number, never by policy:\n');
ok('the tab was read: ten rows', d.letters.rows === 10, String(d.letters.rows));
ok('seven of them live with a client number', d.letters.live === 7, String(d.letters.live));
ok('the dry run, the test send and the blank client are set aside', d.letters.ignored === 3, String(d.letters.ignored));
ok('six clients hold a live letter — C006 once, not twice', d.letters.clients === 6, String(d.letters.clients));
const S45 = B45.survey, S60 = B60.survey, S90 = B90.survey;
ok('45 → two letters for two clients, though one client has two policies', S45.sent === 2 && S45.clients === 2,
   JSON.stringify(S45));
ok('45 → both came back', S45.cameBack === 2 && S45.silent === 0);
ok('60 → the trap policy joins nothing: C011 has no letter', S60.sent === 2 && S60.clients === 3, JSON.stringify(S60));
const carl60 = (B60.agents || []).filter(a => a.k === 'Carl Fictitious')[0] || {};
ok('60 → Carl carries two policies there and one letter', carl60.n === 2 && carl60.sent === 1, JSON.stringify(carl60));
ok('90 → C007 had only a dry run and a test, so one letter for two clients', S90.sent === 1 && S90.clients === 2,
   JSON.stringify(S90));
ok('90 → C006 is judged on the latest letter, not the older one rated one', S90.low === 0 && S90.cameBack === 1,
   JSON.stringify(S90));

console.log('\nSentiment, silence and what the branch recorded:\n');
ok('a two out of five is low', S45.low === 1, String(S45.low));
ok('not having heard from the agent is low too', S60.low === 1 && S60.why.notHeard === 1, JSON.stringify(S60.why));
ok('a five is not', S45.low === 1 && S45.cameBack === 2);
ok('the why is split by rating and by hearing', S45.why.rating === 1 && S45.why.notHeard === 0, JSON.stringify(S45.why));
ok('60 → one letter went out and nothing came back', S60.silent === 1, String(S60.silent));
ok('contacted is derived from OWNER: the desk took C003', S45.contacted === 1 && S45.notContacted === 1,
   S45.contacted + ' / ' + S45.notContacted);
ok('contacted is derived from CLOSED: C006 was closed', S90.contacted === 1, String(S90.contacted));
ok('and a low answer nobody picked up counts as not contacted', S60.contacted === 0 && S60.notContacted === 2,
   S60.contacted + ' / ' + S60.notContacted);
ok('90 → the taps are counted by kind', S90.askedAny === 1 && S90.asked.review === 1 && S90.asked.help === 1
   && S90.asked.issue === 0, JSON.stringify(S90.asked));
ok('90 → an outcome is counted, not quoted', S90.outcomes === 1, String(S90.outcomes));
ok('open follow-ups: C003 and C005 are open, C006 is closed', S45.open === 1 && S60.open === 1 && S90.open === 0,
   [S45.open, S60.open, S90.open].join('/'));
ok('the per-agent rows carry the same story', (B45.agents || []).every(a => 'sent' in a && 'silent' in a && 'contacted' in a));
ok('and so do the ageing buckets', (B60.ageing || []).every(a => 'sent' in a && 'silent' in a));

/* ── 6. What the exclusion removed, said out loud ───────────────────────── */
console.log('\nAn exclusion is never silent:\n');
ok('one policy removed from the stretches', d.excluded.policies === 1 && d.excluded.prem === 1000,
   JSON.stringify(d.excluded));
ok('and the screen knows it came out of the 60 stretch', B60.excluded.policies === 1 && B60.excluded.prem === 1000
   && B45.excluded.policies === 0 && B90.excluded.policies === 0, JSON.stringify(B60.excluded));
ok('the same per band under excluded', (d.excluded.bands || []).filter(b => b.band === 60)[0].policies === 1);
ok('one lapse removed too', d.excluded.lapsed === 1, String(d.excluded.lapsed));
ok('the excluded name is counted, never written', d.excluded.names === 1 && !/Gone Away/.test(JSON.stringify(d)));

/* ── 7. Lapsed this month — the link to the lapses slide ────────────────── */
console.log('\nLapsed this month:\n');
ok('one policy lapsed in September; August and the excluded agent do not count',
   d.lapsedThisMonth.policies === 1 && d.lapsedThisMonth.prem === 80, JSON.stringify(d.lapsedThisMonth));
ok('and the month is named', d.lapsedThisMonth.month === 'September', d.lapsedThisMonth.month);

/* ── 8. Nothing finer than a count leaves the server ────────────────────── */
console.log('\nThe wall is unauthenticated, so the payload is aggregates only:\n');
const flat = JSON.stringify(d);
ok('no client number', !/C0\d\d|C999/.test(flat));
ok('no policy number', !/P-\d/.test(flat));
ok('no client name', !/Pretend-Client/.test(flat));
ok('no phone and no e-mail', !/868-000|example\.invalid/.test(flat));
ok('no outcome text and no follow-up text', !/Spoke to|rated 2 out of|has not heard/.test(flat));
ok('no survey token', !/tok-/.test(flat));
const keys = new Set();
(function walk(v) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.keys(v).forEach(k => { keys.add(k); walk(v[k]); }); })(d);
const rowLevel = ['clientNo', 'client', 'policy', 'email', 'phone', 'token', 'byClient', 'followup', 'outcome', 'owner', 'comment'];
ok('no row-level field is a key anywhere in it', rowLevel.every(k => !keys.has(k)),
   rowLevel.filter(k => keys.has(k)).join(','));
ok('agent names are the only names', (B60.agents || []).map(a => a.k).sort().join('|') === 'Anand Pretend|Carl Fictitious',
   (B60.agents || []).map(a => a.k).join('|'));

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + '\n');
process.exit(fails ? 1 : 0);
