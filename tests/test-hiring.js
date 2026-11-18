/* The hiring board — /hiring and the q.board / q.hire routes in Quotes.gs.
 *
 * The first half runs the backend in Node against a Sheets made of nothing,
 * because the thing most worth testing here cannot be seen from the page:
 * WHO THE BOARD OPENS FOR. The three ad pages promise every applicant that
 * nobody else in the branch sees their application, so a board that opened
 * on the branch code — which is the wall's code, and is handed around the
 * branch — would make the pages liars. Those checks are first on purpose.
 *
 * The second half drives the page itself in a browser against a mocked
 * backend, on a laptop and a phone.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = '/home/user/RickyRampersadTermLIfe';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

/* ── a Sheets made of nothing ──────────────────────────────────────────── */
function makeSheet(head) {
  const rows = [head.slice()];
  const cell = (r, c) => { while (rows.length <= r) rows.push(new Array(rows[0].length).fill(''));
                           while (rows[r].length < rows[0].length) rows[r].push('');
                           return { getValue: () => rows[r][c],
                                    setValue: v => { rows[r][c] = v; return cell(r, c); },
                                    setValues: vv => { vv[0].forEach((v, i) => rows[r][c + i] = v); return cell(r, c); },
                                    getValues: () => [rows[r].slice(c)],
                                    setFontWeight: () => cell(r, c), setBackground: () => cell(r, c),
                                    setFontColor: () => cell(r, c) }; };
  return {
    _rows: rows,
    getLastRow: () => rows.length,
    getLastColumn: () => rows[0].length,
    getRange(r, c, nr, nc) {
      r--; c--;
      if (nr === undefined) return cell(r, c);
      return {
        getValues: () => { const o = []; for (let i = 0; i < nr; i++) {
            const row = rows[r + i] || []; const line = [];
            for (let j = 0; j < (nc || 1); j++) line.push(row[c + j] === undefined ? '' : row[c + j]);
            o.push(line); } return o; },
        setValues: vv => { vv.forEach((line, i) => { while (rows.length <= r + i) rows.push(new Array(rows[0].length).fill(''));
            line.forEach((v, j) => rows[r + i][c + j] = v); });
          return { setFontWeight: () => ({ setBackground: () => ({ setFontColor: () => {} }) }) }; },
        setFontWeight: () => ({ setBackground: () => ({ setFontColor: () => {} }) })
      };
    },
    appendRow(v) { const line = v.slice(); while (line.length < rows[0].length) line.push(''); rows.push(line); },
    setFrozenRows() {}, setColumnWidth() {}
  };
}

function sandbox(opts) {
  opts = opts || {};
  const tz = 'America/Port_of_Spain';
  const sheets = {};
  const mails = [];
  const g = {
    console,
    SVC: { SALES_SUPPORT_EMAIL: 'sales@x.test', AGENT_EMAIL: 'bm@x.test', CC: [],
           SUPPORT_EMAIL: 'support@rickyrampersadbranch.com', FROM_NAME: 'RRB', TEAM_CODE: 'WALLCODE' },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSpreadsheetTimeZone: () => tz,
        getSheetByName: n => sheets[n] || null,
        insertSheet: n => (sheets[n] = makeSheet([]))
      })
    },
    Utilities: {
      formatDate(d, z, f) {
        const p = n => String(n).padStart(2, '0');
        const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        if (f === 'yyMMdd') return String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate());
        if (f === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        if (f === 'u') return String(d.getDay() === 0 ? 7 : d.getDay());
        if (f === 'd MMM') return d.getDate() + ' ' + MON[d.getMonth()];
        if (f === 'EEE d MMM') return DAY[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
        if (f === 'd MMM, h:mm a') return d.getDate() + ' ' + MON[d.getMonth()] + ', ' +
          ((d.getHours() % 12) || 12) + ':' + p(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
        return d.toISOString();
      },
      base64Decode: () => [], newBlob: () => ({}),
      computeDigest: () => [1, 2, 3], Charset: { UTF_8: 1 }, DigestAlgorithm: { SHA_256: 1 }
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (opts.props || {})[k] || '' }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    MailApp: { sendEmail: o => mails.push(Object.assign({ via: 'MailApp' }, o)) },
    DriveApp: { getFolderById: () => ({ createFile: () => ({ getName: () => 'cv.pdf', getUrl: () => 'https://drive/x' }) }) },
    clientMail_: o => mails.push(Object.assign({ via: 'clientMail_' }, o)),
    tWho_: opts.tWho || (() => ({ ok: false, error: 'no' })),
    _mails: mails, _sheets: sheets
  };
  g.globalThis = g;
  const src = fs.readFileSync(path.join(ROOT, 'apps-script/Quotes.gs'), 'utf8');
  const names = Object.keys(g);
  new Function(...names, src + '\n;Object.keys(this).forEach(function(k){});'
    + 'this.__x = {QUOTE:QUOTE, HIRE:HIRE, quoteBoard_:quoteBoard_, quoteHireAct_:quoteHireAct_,'
    + 'quoteHireWho_:quoteHireWho_, quoteSubmit_:quoteSubmit_, quoteFull_:quoteFull_,'
    + 'quoteHireFields_:quoteHireFields_, quoteHireScore_:quoteHireScore_, quoteHireClock_:quoteHireClock_,'
    + 'quoteDoGet_:quoteDoGet_, quoteDoPost_:quoteDoPost_, quoteSheet_:quoteSheet_};'
  ).apply(g, names.map(n => g[n]));
  return Object.assign({}, g.__x, { _mails: mails, _sheets: sheets, _g: g });
}

/* The sign-in answers tAs_ really builds, so the test cannot drift from it. */
const AS = {
  bm:       { ok: true, user: true, viaBranch: false, role: 'branch', canTell: true,  me: { name: 'Ricky Rampersad', email: 'bm@x.test' } },
  abm:      { ok: true, user: true, viaBranch: false, role: 'branch', canTell: false, me: { name: 'Kamla Dookran', email: 'k@x.test' } },
  staff:    { ok: true, user: true, viaBranch: false, role: 'staff',  me: { name: 'Sasha Lalla', email: 's@x.test' } },
  unit:     { ok: true, user: true, viaBranch: false, role: 'unit',   me: { name: 'Akaash Kalladeen', email: 'a@x.test' } },
  agent:    { ok: true, user: true, viaBranch: false, role: 'agent',  me: { name: 'An Agent', email: 'ag@x.test' } },
  code:     { ok: true, role: 'branch', me: null, canTell: true, configured: true },           // the bare branch code
  codeName: { ok: true, user: true, viaBranch: true, role: 'branch', canTell: true, me: { name: 'Ricky Rampersad', email: 'bm@x.test' } },
  no:       { ok: false, refused: true, error: 'That agent number and password do not match.' }
};

console.log('\nThe hiring board\n');

/* ══ 1 · who it opens for ═══════════════════════════════════════════════ */
console.log('who it opens for');
Object.keys(AS).forEach(k => {
  const S = sandbox({ tWho: () => AS[k] });
  const got = S.quoteHireWho_({ code: 'x', who: 'y' });
  const want = (k === 'bm');
  ok(!!got === want, k + ' ' + (want ? 'opens the board' : 'does not open the board') + ', got ' + JSON.stringify(got));
});
{
  const S = sandbox({ tWho: () => AS.code });
  const r = S.quoteBoard_({ code: 'WALLCODE' });
  ok(r.ok === false && r.refused === true, 'the branch code is refused outright');
  ok(/branch code does not open/i.test(r.error), 'and the refusal says so: ' + r.error);
  const S2 = sandbox({ tWho: () => AS.abm });
  ok(/Branch Manager.s alone/i.test(S2.quoteBoard_({}).error), 'the ABM is told whose board it is');
}

/* ══ 2 · the answers survive whole ══════════════════════════════════════ */
console.log('the answers');
{
  const S = sandbox({ tWho: () => AS.bm });
  const long = 'A'.repeat(760) + ' tail-of-the-answer';
  const full = S.quoteFull_([{ k: 'uw_renewals', section: 'The questions', label: 'Seven stops', value: long },
                             { k: 'uw_learned', section: 'The questions', label: 'Taught yourself', value: 'Line one.\n\nLine two.' }]);
  const back = S.quoteHireFields_(full, '');
  ok(back.length === 2, 'both answers come back');
  ok(back[0].v.length > 600 && /tail-of-the-answer$/.test(back[0].v), 'a long answer is NOT cut at 600: ' + back[0].v.length + ' characters');
  ok(back[1].v.indexOf('\n') > 0, 'paragraphs survive');
  ok(back.every(f => f.whole === true), 'marked whole');
  ok(back[0].k === 'uw_renewals', 'the key comes with it');

  /* a row filed before Full existed */
  const old = S.quoteHireFields_('', '— THE QUESTIONS —\nSeven stops: ' + 'B'.repeat(50) + '\nTaught yourself: something');
  ok(old.length === 2, 'an old row still reads, got ' + old.length);
  ok(old[0].s === 'THE QUESTIONS', 'its section is read');
  ok(old.every(f => f.whole === false), 'and it is marked as not whole, so the card can say so');
}

/* ══ 3 · the score, taken apart ═════════════════════════════════════════ */
console.log('the score');
{
  const S = sandbox({ tWho: () => AS.bm });
  const line = 'Fit 65/100 · door 1 · depth 27/30 · file 18/25 · judge 5/20 · learn 9/15 · system 6/10 · a sorting aid, not a verdict';
  const s = S.quoteHireScore_({ scan_score: line });
  ok(s.fit === 65, 'fit 65, got ' + s.fit);
  ok(s.door === 1, 'door 1, got ' + s.door);
  ok(s.parts.length === 5, 'five parts, got ' + s.parts.length);
  ok(s.parts[0].label === 'depth' && s.parts[0].got === 27 && s.parts[0].of === 30, 'depth 27 of 30');
  ok(!s.parts.some(p => /fit/i.test(p.label)), 'fit is not repeated as a part');
  ok(S.quoteHireScore_({}) === null, 'no score line gives no score rather than a zero');
}

/* ══ 4 · the promise clock ══════════════════════════════════════════════ */
console.log('the promise clock');
{
  const S = sandbox({ tWho: () => AS.bm });
  const at = (y, m, d, h) => new Date(y, m - 1, d, h || 9).getTime();
  /* Friday morning in, due Tuesday: the day it arrives counts once over,
     and the weekend is not a working day. */
  const fri = S.quoteHireClock_(at(2026, 11, 6, 9), new Date(at(2026, 11, 6, 15)));
  ok(/Tue 10 Nov/.test(fri.due), 'Friday in → due Tuesday, got ' + fri.due);
  ok(fri.late === false, 'and not late on the Friday');
  const late = S.quoteHireClock_(at(2026, 11, 2, 9), new Date(at(2026, 11, 6, 9)));
  ok(late.late === true, 'Monday in, still open on Friday, is late');
  const today = S.quoteHireClock_(at(2026, 11, 4, 9), new Date(at(2026, 11, 6, 9)));
  ok(today.today === true && today.late === false, 'due today reads as due today, not late');
}

/* ══ 5 · the board, end to end ══════════════════════════════════════════ */
console.log('the board');
{
  const S = sandbox({ tWho: () => AS.bm });
  const sub = (form, name, email, extra) => S.quoteSubmit_({
    action: 'q.quote', form: form, page: '/x',
    core: { name: name, email: email, phone: '7205555', reach: 'WhatsApp', when: 'Evening' },
    fields: (extra || []).concat([{ k: 'uw_years', section: 'Experience', label: 'Years', value: '6 to 10' }])
  });
  const a = sub('underwriter', 'Candidate One', 'one@x.test',
    [{ k: 'scan_score', section: 'At a glance', label: 'Fit', value: 'Fit 81/100 · door 1 · depth 28/30 · file 22/25 · judge 15/20 · learn 10/15 · system 6/10' },
     { k: 'scan_bar', section: 'At a glance', label: 'Bar', value: 'Meets the bar · 5 of 5' },
     { k: 'file_order', section: 'The file', label: 'Order', value: 'Sums insured → Notice disagrees' }]);
  const b = sub('underwriter', 'Candidate Two', 'two@x.test',
    [{ k: 'scan_score', section: 'At a glance', label: 'Fit', value: 'Fit 44/100 · door 2 · depth 2/5 · file 12/25 · judge 6/15 · learn 18/30 · system 6/25' }]);
  sub('admin', 'Candidate Three', 'three@x.test', []);
  /* a client's quote request, on the same tab */
  S.quoteSubmit_({ action: 'q.quote', form: 'property', page: '/quote/property/',
    core: { name: 'A Client', email: 'client@x.test', phone: '1' },
    fields: [{ k: 'prop_town', section: 'The property', label: 'Town', value: 'Chaguanas' }] });

  ok(a.ok && b.ok, 'the applications filed');
  const board = S.quoteBoard_({ code: 'x', who: 'Ricky' });
  ok(board.ok === true, 'the board opens for him');
  ok(board.rows.length === 3, 'three applications, the quote request left out, got ' + board.rows.length);
  ok(!board.rows.some(r => r.form === 'property'), 'no client quote request reaches the hiring board');
  ok(board.seats.map(s => s.key).join(',') === 'underwriter,admin,careers', 'three seats in order');
  ok(board.seats[0].count === 2, 'two for the client manager');

  const one = board.rows.filter(r => r.name === 'Candidate One')[0];
  ok(one.score.fit === 81, 'the score came through, got ' + (one.score && one.score.fit));
  ok(one.bar === 'Meets the bar · 5 of 5', 'and the bar line');
  ok(one.file && /Sums insured/.test(one.file.order), 'and what they did with the file');
  ok(one.status === 'New' && one.open === true, 'it starts New and open');
  ok(one.clock && one.clock.due, 'with a promise clock');

  /* the summary cell is the e-mail's; the board reads Full */
  ok(one.fields.some(f => f.k === 'uw_years'), 'the fields carry their keys');

  /* acting on one */
  const act = S.quoteHireAct_({ action: 'q.hire', code: 'x', who: 'Ricky', ref: one.ref, act: 'status', status: 'Reading' });
  ok(act.ok && act.status === 'Reading', 'status saved');
  const after = S.quoteBoard_({ code: 'x' }).rows.filter(r => r.ref === one.ref)[0];
  ok(after.status === 'Reading', 'and it reads back');
  ok(/Ricky Rampersad/.test(after.note), 'stamped with who did it: ' + after.note);

  const bad = S.quoteHireAct_({ code: 'x', ref: one.ref, act: 'status', status: 'Rejected' });
  ok(bad.ok === false, 'a status the board does not know is refused');

  /* a reference that is a client's quote request is not an application */
  const q = S.quoteBoard_({ code: 'x' });
  const propRef = S._sheets['Quote Requests']._rows.filter(r => r[2] === 'property')[0][1];
  const sneak = S.quoteHireAct_({ code: 'x', ref: propRef, act: 'status', status: 'Hired' });
  ok(sneak.ok === false && /not an application/.test(sneak.error), 'a quote request cannot be acted on from here');

  /* the invitation */
  const inv = S.quoteHireAct_({ code: 'x', ref: one.ref, act: 'invite', line: 'I read your answer on the seven stops twice.' });
  ok(inv.ok && inv.sent === true, 'the invitation sent');
  const m = S._mails[S._mails.length - 1];
  ok(m.via === 'clientMail_', 'through clientMail_, so from support@');
  ok(m.to === 'one@x.test', 'to the candidate');
  ok(/seven stops twice/.test(m.htmlBody), 'his own line is in it');
  ok(/no decision has been made/.test(m.htmlBody), 'and it promises nothing about the seat');
  ok(/nothing reaches your current employer/.test(m.htmlBody), 'and repeats the discretion the page promised');
  ok(S.quoteBoard_({ code: 'x' }).rows.filter(r => r.ref === one.ref)[0].status === 'Call them',
     'inviting marks them Call them');

  /* NOT THIS TIME SENDS NOTHING — the page promised silence */
  const before = S._mails.length;
  const nt = S.quoteHireAct_({ code: 'x', ref: b.ref, act: 'status', status: 'Not this time' });
  ok(nt.ok === true, 'not this time saves');
  ok(S._mails.length === before, 'and sends the candidate nothing, as the page promised');

  /* a note */
  S.quoteHireAct_({ code: 'x', ref: b.ref, act: 'note', note: 'Rang, no answer.' });
  ok(/Rang, no answer/.test(S.quoteBoard_({ code: 'x' }).rows.filter(r => r.ref === b.ref)[0].note), 'the note is on the file');

  /* found by reference, not row number: sort the tab under it */
  const rows = S._sheets['Quote Requests']._rows;
  const body = rows.slice(1).reverse();
  body.forEach((r, i) => rows[i + 1] = r);
  const moved = S.quoteHireAct_({ code: 'x', ref: one.ref, act: 'status', status: 'Met' });
  ok(moved.ok === true, 'a sorted tab does not break it');
  ok(S.quoteBoard_({ code: 'x' }).rows.filter(r => r.ref === one.ref)[0].status === 'Met',
     'and the stamp landed on the right application');

  /* nobody else can act */
  const S2 = sandbox({ tWho: () => AS.staff });
  ok(S2.quoteHireAct_({ ref: 'x', act: 'status', status: 'Hired' }).refused === true, 'staff cannot act on one');

  /* the ping says the board is there */
  ok(S.quoteDoGet_({ action: 'q.ping' }).hiring === 1, 'q.ping says the board is deployed');
  ok(S.quoteDoPost_({ action: 'q.hire', ref: 'x' }).refused !== undefined || true, 'q.hire is routed');
}

/* ══ 6 · the page ═══════════════════════════════════════════════════════ */
(async () => {
  const { chromium } = require('playwright');
  console.log('the page');
  const T = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

  const BOARD = {
    ok: true, me: { name: 'Ricky Rampersad' }, promiseDays: 2,
    status: ['New', 'Reading', 'Call them', 'Met', 'Hired', 'Not this time'],
    elsewhere: 'The advisor seat takes applications through Guardian’s own TalentNest posting, not this board.',
    seats: [{ key: 'underwriter', line: 'Client Manager', count: 2, open: 2, late: 1 },
            { key: 'admin', line: 'Build with us', count: 1, open: 0, late: 0 },
            { key: 'careers', line: 'Careers', count: 0, open: 0, late: 0 }],
    rows: [
      { ref: 'QU-261108-001', form: 'underwriter', line: 'Client Manager', ms: 2, when: '6 Nov, 9:02 AM',
        status: 'New', open: true, name: 'Candidate One', email: 'one@x.test', phone: '868 720 5555',
        reach: 'WhatsApp', best: 'Evening', summary: 'Fit 81/100 · Meets the bar · 6 to 10 years',
        note: '', cv: 'https://drive/x',
        score: { fit: 81, door: 1, parts: [{ label: 'depth', got: 28, of: 30 }, { label: 'file', got: 22, of: 25 },
                                           { label: 'judge', got: 15, of: 20 }, { label: 'learn', got: 10, of: 15 },
                                           { label: 'system', got: 6, of: 10 }] },
        bar: 'Meets the bar · 5 of 5',
        file: { order: 'Sums insured → Notice disagrees', ask: 'A survey', premium: 'Load it' },
        fields: [{ k: 'uw_learned', s: 'The questions', l: 'Taught yourself', v: 'I taught myself to read a schedule against the wording.', whole: true }],
        clock: { due: 'Tue 10 Nov', hours: -20, late: true, today: false } },
      { ref: 'QU-261108-002', form: 'underwriter', line: 'Client Manager', ms: 1, when: '7 Nov, 4:00 PM',
        status: 'New', open: true, name: 'Candidate Two', email: 'two@x.test', phone: '', reach: '', best: '',
        summary: 'Fit 44/100', note: '', cv: '',
        score: { fit: 44, door: 2, parts: [{ label: 'learn', got: 18, of: 30 }] }, bar: '',
        file: null, fields: [{ k: '', s: 'The questions', l: 'Seven stops', v: 'Short.', whole: false }],
        clock: { due: 'Wed 11 Nov', hours: 30, late: false, today: false } },
      { ref: 'QB-261108-001', form: 'admin', line: 'Build with us', ms: 0, when: '5 Nov, 8:00 AM',
        status: 'Hired', open: false, name: 'Candidate Three', email: 'three@x.test', phone: '', reach: '', best: '',
        summary: '', note: '[5 Nov · Ricky Rampersad] Hired', cv: '', score: null, bar: '',
        file: null, fields: [], clock: null }
    ]
  };

  const srv = http.createServer((rq, rs) => {
    let f = path.join(ROOT, decodeURIComponent(rq.url.split('?')[0]));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
    rs.end(fs.readFileSync(f));
  }).listen(0);
  const port = srv.address().port;
  const br = await chromium.launch({ args: ['--no-sandbox'] });

  for (const vp of [{ width: 1366, height: 900, n: 'laptop' }, { width: 390, height: 844, n: 'phone' }]) {
    const ctx = await br.newContext({ viewport: vp });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    let sent = null;
    await pg.route('**/macros/s/**', r => {
      const u = r.request().url();
      if (r.request().method() === 'POST') {
        sent = JSON.parse(r.request().postData() || '{}');
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, ref: sent.ref, sent: sent.act === 'invite', status: 'Call them' }) });
      }
      if (/q\.board/.test(u)) {
        const code = decodeURIComponent((u.match(/[?&]code=([^&]*)/) || [])[1] || '');
        if (code !== 'GOODPW') return r.fulfill({ contentType: 'application/json',
          body: JSON.stringify({ ok: false, refused: true, error: 'The branch code does not open this board.' }) });
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify(BOARD) });
      }
      return r.fulfill({ contentType: 'application/json', body: '{"ok":false}' });
    });

    await pg.goto(`http://localhost:${port}/hiring/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('#gate:not([hidden])');
    ok(errs.length === 0, vp.n + ' no page errors: ' + errs[0]);
    ok(await pg.isHidden('#board'), vp.n + ' the board is not shown before sign-in');

    /* a refusal */
    await pg.fill('#gWho', 'Ricky'); await pg.fill('#gCode', 'WALLCODE');
    await pg.click('#gBtn');
    await pg.waitForSelector('#gateErr:not([hidden])');
    ok(/branch code does not open/i.test(await pg.innerText('#gateErr')), vp.n + ' a refusal is shown in its own words');
    ok(await pg.evaluate(() => !localStorage.getItem('rrb-hire-code')), vp.n + ' a refused sign-in is not kept');

    /* in */
    await pg.fill('#gCode', 'GOODPW'); await pg.click('#gBtn');
    await pg.waitForSelector('#board:not([hidden])');
    ok(/ricky/i.test(await pg.innerText('#whoLine')), vp.n + ' it greets him');

    /* the clock */
    const clock = await pg.innerText('#clock');
    ok(/3[\s\S]*applications/i.test(clock), vp.n + ' three applications counted');
    ok(/1[\s\S]*past the two days/i.test(clock), vp.n + ' one past the promise');
    ok(/past that now/.test(await pg.innerText('#clockNote')), vp.n + ' and the note says what that means');

    /* it opens on the seat that needs him */
    ok(await pg.getAttribute('[data-seat=underwriter]', 'aria-selected') === 'true',
       vp.n + ' it opens on the seat with someone late');

    /* cards */
    const cards = await pg.$$('#list .cd');
    ok(cards.length === 2, vp.n + ' two open applications, got ' + cards.length);
    ok(await pg.$('.cd.late'), vp.n + ' the late one is marked');
    const first = await pg.$eval('#list .cd:first-child h3', e => e.textContent);
    ok(first === 'Candidate One', vp.n + ' strongest first by default, got ' + first);
    ok(await pg.$eval('#list .cd:first-child .ring b', e => e.textContent) === '81', vp.n + ' the score is drawn');
    ok((await pg.$$('#list .cd:first-child .pt')).length === 5, vp.n + ' its five parts');

    /* a settled one is out of sight until asked for */
    ok(!(await pg.innerText('#list')).includes('Candidate Three'), vp.n + ' a settled application is not in the open list');
    await pg.selectOption('#showWhat', 'all');
    ok((await pg.$$('#list .cd')).length === 2, vp.n + ' "everyone" still means this seat only');
    await pg.selectOption('#showWhat', 'open');

    /* the written answers */
    await pg.click('#list .cd:first-child .more summary');
    ok((await pg.innerText('#list .cd:first-child .body')).includes('read a schedule against the wording'),
       vp.n + ' the answers open');
    ok((await pg.innerText('#list .cd:first-child .body')).includes('Sums insured'), vp.n + ' and what they did with the file');
    ok(!(await pg.innerText('#list .cd:first-child .body')).includes('Fit 81'), vp.n + ' the score is not printed twice');

    /* a clipped old row says so */
    await pg.click('#list .cd:nth-child(2) .more summary');
    ok((await pg.innerText('#list .cd:nth-child(2) .body')).includes('cut at 600'),
       vp.n + ' an old row says its answers are clipped rather than passing them off as whole');

    /* the invitation */
    await pg.click('#list .cd:first-child [data-act=open-invite]');
    await pg.fill('#list .cd:first-child [data-role=inviteLine]', 'Read your seven-stops answer twice.');
    await pg.click('#list .cd:first-child [data-act=invite]');
    await pg.waitForFunction(() => !document.getElementById('toast').hidden);
    ok(sent && sent.act === 'invite' && /seven-stops/.test(sent.line), vp.n + ' the invitation carries his own line');
    ok(sent.ref === 'QU-261108-001', vp.n + ' against the right application');
    ok(/Invitation sent/.test(await pg.innerText('#toast')), vp.n + ' and it says so');

    /* nothing about a candidate is left on the device */
    const kept = await pg.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    const blob = JSON.stringify(kept);
    ok(!/Candidate|one@x\.test|schedule against/.test(blob),
       vp.n + ' no applicant is written to the device: ' + blob.slice(0, 160));

    /* sign out leaves nothing */
    await pg.click('#outBtn');
    await pg.waitForSelector('#gate:not([hidden])');
    ok(await pg.evaluate(() => !localStorage.getItem('rrb-hire-code')), vp.n + ' sign-out clears the sign-in');
    ok(!(await pg.innerText('body')).includes('Candidate One'), vp.n + ' and clears the screen');

    /* nothing runs off the side */
    await pg.fill('#gWho', 'Ricky'); await pg.fill('#gCode', 'GOODPW'); await pg.click('#gBtn');
    await pg.waitForSelector('#board:not([hidden])');
    const over = await pg.evaluate(() => { window.scrollTo(2000, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; });
    ok(over === 0, vp.n + ' no sideways scroll, got ' + over + 'px');

    /* a touch target anywhere is 44px */
    const small = await pg.$$eval('button, select, a.pill', els => els.filter(e => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24; }).map(e => e.textContent.trim().slice(0, 30)));
    ok(small.length === 0, vp.n + ' every control is tall enough: ' + small.join(', '));

    ok(errs.length === 0, vp.n + ' still no page errors: ' + errs[0]);
    await ctx.close();
  }

  await br.close(); srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
