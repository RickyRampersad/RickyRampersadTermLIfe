/* Asking the agent whether the service worked.

   The branch had one satisfaction measure and it pointed at the client:
   sendSurvey_ asks whose policy it was whether the OUTCOME was good. Nothing
   asked the agent whether the SERVICE was good — whether logging it once and
   forgetting it actually worked. That is the promise the whole thing is sold
   on, and it had never been measured.

   This sends real mail, so the guards matter more than the email does:
   recently-closed cases only, a cap per run, never without a servicing agent,
   and never twice for the same case.

   Run: node agent-survey.test.mjs
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

const AGENT = 'fawwaz.mohamed@myguardiangroup.com';
const day = (n) => new Date(Date.now() - n * 86400000);

/* row[]: 0 ref · 3 status · 5 client · 9 agent · 10 agent mail · 12 type
   13 dept · 15 tat · 20 date closed · 21 days · 22 chases */
function row(o) {
  const r = Array(29).fill('');
  r[0] = o.ref || 'RRB/2026/105/Rakesh Lochan/Rakesh Lochan 8004206085';
  r[3] = o.status === undefined ? 'Closed' : o.status;
  r[5] = 'Rakesh Lochan';
  r[9] = o.agent === undefined ? 'Fawwaz Mohamed' : o.agent;
  r[10] = o.mail === undefined ? AGENT : o.mail;
  r[12] = 'Statements – tax and csv'; r[13] = 'Customer Service – Chaguanas';
  r[15] = '1 day';
  r[20] = o.closed === undefined ? day(1) : o.closed;
  r[21] = o.days === undefined ? 2 : o.days;
  r[22] = o.chases === undefined ? 1 : o.chases;
  return r;
}

/* Comments rows that make qpTouchMap_ report a given human/system split.
   Stubbing qpTouchMap_ itself does not work: it is declared in the patch, and
   a function declaration overrides a parameter of the same name. So the real
   one runs, and it has to be given a real Comments sheet to read. */
const comments = (ref, human, sys) => {
  const out = [];
  for (let i = 0; i < human; i++) out.push([new Date(), ref, 'Azariah Griffith', 'staff', 'looked at it', 'internal']);
  for (let i = 0; i < sys; i++) out.push([new Date(), ref, 'System', 'system', 'Follow-up sent', 'internal']);
  return out;
};

function load(opts) {
  const o = opts || {};
  const mails = [];
  const ROWS = o.rows || [];
  const TAB = o.tab || [];               // rows already in the ratings tab
  const CMT = o.comments || [];
  const sheet = (rows) => ({
    getLastRow: () => rows.length + 1,
    getMaxColumns: () => 29,
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const block = [];
      for (let i = 0; i < nr; i++) {
        const src = rows[r - 2 + i] || [];
        const cells = [];
        for (let j = 0; j < nc; j++) cells.push(src[c - 1 + j] === undefined ? '' : src[c - 1 + j]);
        block.push(cells);
      }
      return { getValues: () => block, getValue: () => block[0][0],
               setValue: (v) => { if (rows[r - 2]) rows[r - 2][c - 1] = v; } };
    },
    appendRow: (x) => rows.push(x),
  });
  const sandbox = {
    SHEET_NAME: 'Queries', BRANCH_SUPPORT: 'support@rickyrampersadbranch.com',
    TEST_EMAIL: 'rampersadricky@gmail.com', TEST_MODE: false,
    Logger: { log() {} },
    HtmlService: { createHtmlOutput: (h) => ({ _h: h }) },
    surveyPage_: (title, msg) => ({ _title: title, _msg: msg }),
    outSheet_: () => sheet(TAB),
    cmtSheet_: () => sheet(CMT),
    qpEsc_: (s) => String(s == null ? '' : s),
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
    MailApp: { sendEmail: (m) => { if (o.sendThrows) throw new Error('quota'); mails.push(m); } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({
      getSheetByName: () => { if (o.ownerThrows) throw new Error('sheet unreadable'); return sheet(ROWS); },
      insertSheet: () => sheet(TAB) }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpAgentSurveySweep', 'qpAgentSurvey_', 'qpAutoRate_', 'qpHandledBy_',
                'qpAutomationScore', 'QP_AGENT_RATE_MAX', 'QP_AGENT_RATE_WINDOW_D'];
  const api = new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
  return { api, mails, ROWS, TAB };
}

/* ---------- the guards, which matter most ------------------------------- */
console.log('\nwho gets asked\n');
{
  const { api, mails, TAB } = load({ rows: [row({})] });
  api.qpAgentSurveySweep();
  t('a recently closed case asks its agent', mails.length === 1 && mails[0].to === AGENT,
    JSON.stringify(mails.map(m => m.to)));
  t('and it is recorded so it is never asked twice', TAB.length === 1);
}
{
  const { api, mails } = load({ rows: [row({})], tab: [[new Date(), 'RRB/2026/105/Rakesh Lochan/Rakesh Lochan 8004206085']] });
  api.qpAgentSurveySweep();
  t('a case already asked about is not asked again', mails.length === 0);
}
{
  const { api, mails } = load({ rows: [row({ status: 'Open' })] });
  api.qpAgentSurveySweep();
  t('an open case is never asked about', mails.length === 0);
}
{
  const { api, mails } = load({ rows: [row({ mail: '', agent: '' })] });
  api.qpAgentSurveySweep();
  t('a case with no servicing agent is skipped, not guessed at', mails.length === 0,
    '27 of 115 rows have no agent — they must not land on anybody');
}
{
  const { api, mails } = load({ rows: [row({ closed: day(30) })] });
  api.qpAgentSurveySweep();
  t('a case closed a month ago is not asked about', mails.length === 0,
    'switching this on must not email every agent about 110 historical cases');
}
{
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push(row({ ref: 'RRB/2026/1' + (i + 10) + '/X/Y' }));
  const { api, mails } = load({ rows });
  api.qpAgentSurveySweep();
  t('a run is capped so it cannot drain the sending day',
    mails.length === api.QP_AGENT_RATE_MAX, mails.length + ' sent');
}
{
  const { api, mails, TAB } = load({ rows: [row({})], sendThrows: true });
  api.qpAgentSurveySweep();
  t('a failed send is not recorded as asked', mails.length === 0 && TAB.length === 0,
    'otherwise the agent is never asked at all');
}

/* ---------- what the email actually says -------------------------------- */
console.log('\nwhat it tells them\n');
{
  const { api, mails } = load({
    rows: [row({ days: 2, chases: 3 })],
    comments: comments('RRB/2026/105/Rakesh Lochan/Rakesh Lochan 8004206085', 0, 7),
  });
  api.qpAgentSurveySweep();
  const h = mails[0].htmlBody;
  t('it says the system carried it alone', /start to finish/.test(h) && /Nobody at the branch had to touch it/.test(h));
  t('it shows the real numbers', /2 days/.test(h) && />3</.test(h), 'days and chases');
  t('it rates the service, not the client outcome',
    /about <b>the branch service<\/b>/.test(h) && /not about the client/.test(h));
  t('the rating links carry the reference and the score',
    /action=autorate&ref=[^"]*&score=1/.test(h) && /score=5/.test(h));
  t('the plain-text part works too', /Rate the branch service 1-5/.test(mails[0].body));
}
{
  const { api, mails } = load({
    rows: [row({})],
    comments: comments('RRB/2026/105/Rakesh Lochan/Rakesh Lochan 8004206085', 4, 3),
  });
  api.qpAgentSurveySweep();
  t('when staff had to step in, it says so plainly',
    /4 staff actions<\/b> were needed/.test(mails[0].htmlBody)
    && /where the system still leaves work behind/.test(mails[0].htmlBody),
    'a case staff rescued is the system failing, and the rating must tell them apart');
}
{
  const { api } = load({});
  t('no touch record reads as carried by the system', api.qpHandledBy_(null).solo === true);
  t('one human action is counted honestly', api.qpHandledBy_({ human: 1 }).solo === false);
}

/* ---------- the tap ------------------------------------------------------ */
console.log('\nthe rating\n');
{
  const REF = 'RRB/2026/105/Rakesh Lochan/Rakesh Lochan 8004206085';
  const tab = [[new Date(), REF, 'Fawwaz Mohamed', AGENT, '', '', 'Query Pal, start to finish', 1, 2, '1 day']];
  const { api } = load({ tab, rows: [row({ ref: REF })] });
  api.qpAutoRate_({ parameter: { ref: REF, score: '4' } });
  t('the score lands on the row that was asked', tab[0][4] === 4, JSON.stringify(tab[0]));
  api.qpAutoRate_({ parameter: { ref: REF, score: '2' } });
  t('a changed mind overwrites rather than duplicating', tab.length === 1 && tab[0][4] === 2);
}
{
  const { api } = load({ tab: [] });
  const r = api.qpAutoRate_({ parameter: { ref: '', score: '5' } });
  t('a link with no reference is refused politely', /not found/i.test(r._title || ''));
}
{
  const tab = [];
  const { api } = load({ tab, rows: [row({})] });
  api.qpAutoRate_({ parameter: { ref: row({})[0], score: '9' } });
  t('a score out of range is clamped to 5', tab.length === 1 && tab[0][4] === 5);
  t('a first rating records who the case belonged to',
    tab[0][2] === 'Fawwaz Mohamed' && tab[0][3] === AGENT,
    JSON.stringify(tab[0]) + ' — blank agent columns made the tab unreadable');
}

/* This endpoint answers on the public /exec URL, which is in the page source.
   Before the existence check, any reference at all appended a row. */
console.log('\nthe rating link is public\n');
{
  const tab = [];
  const { api } = load({ tab, rows: [row({})] });
  const r = api.qpAutoRate_({ parameter: { ref: 'RRB/2026/999/Made/Up', score: '5' } });
  t('a reference that is not a real case writes nothing',
    tab.length === 0, JSON.stringify(tab));
  t('and it is refused the same way an empty one is', /not found/i.test(r._title || ''));
}
{
  const tab = [];
  const { api } = load({ tab, rows: [] });
  api.qpAutoRate_({ parameter: { ref: 'RRB/2026/105/Rakesh Lochan/Rakesh Lochan 8004206085', score: '5' } });
  t('an empty log cannot be rated into', tab.length === 0);
}
{
  /* A sheet that will not answer must refuse, not write. A row written on a
     bad read is indistinguishable from a real rating afterwards. */
  const tab = [];
  const sandbox = { rows: [row({})], tab };
  const { api } = load(sandbox);
  const r = api.qpAutoRate_({ parameter: { ref: row({})[0], score: '3' } });
  t('a readable sheet still records normally', tab.length === 1 && tab[0][4] === 3);
}
{
  const tab = [];
  const { api } = load({ tab, rows: [row({})], ownerThrows: true });
  const r = api.qpAutoRate_({ parameter: { ref: row({})[0], score: '3' } });
  t('a sheet that throws refuses rather than writing a rating it cannot trust',
    tab.length === 0 && /not found/i.test(r._title || ''), JSON.stringify(tab));
}

/* ---------- the shape --------------------------------------------------- */
console.log('\nthe patch\n');
const S18 = PATCH.slice(PATCH.indexOf('18. ASK THE AGENT HOW THE AUTOMATION DID'));
t('section 18 exists', S18.length > 1000);
t('it writes to its own tab, never the autopilot columns',
  !/getRange\([^)]*,\s*2[0-9]\)\s*\.setValue/.test(S18),
  'columns 23-29 belong to the chase loop');
t('it runs on its own trigger, so Code.gs needs one router line only',
  /ScriptApp\.newTrigger\('qpAgentSurveySweep'\)/.test(S18));
t('the window and the cap are named constants, not buried numbers',
  /QP_AGENT_RATE_WINDOW_D/.test(S18) && /QP_AGENT_RATE_MAX/.test(S18));

console.log();
process.exit(fail ? 1 : 0);
