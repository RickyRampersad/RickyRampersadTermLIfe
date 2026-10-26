// Recruiting.gs — the branch workbook behind the Recruit Tracker.
//
// The tracker arrived from the Project as a Netlify bundle that kept every
// candidate in the browser and carried the branch's production figures, POP
// scores and coaching notes inside the page. This script is what replaced
// that: candidates, their files and the figures live in a private workbook and
// a private Drive folder, and reach a browser only after a sign-in.
//
// Everything below runs against the fake Sheets and Drive in harness.js with
// strictGrid on, so Google's real limits apply — a new sheet is 26 columns
// wide, a getRange past the grid throws rather than growing it, and a cell
// holds 50,000 characters. The eighteen-chunk bug this found would not have
// shown up any other way: it needs a record over about 765 KB, and there was
// no such record until somebody wrote a long enough coaching note.
//
// The fixtures here are invented. The real branch data is private and is not
// in this repository; point RRB_SEED_DIR at a folder holding the seed JSON to
// exercise the same paths against it.
const { makeEnv } = require('./harness');
const fs = require('fs'), path = require('path');

const GS = __dirname + '/../apps-script/Recruiting.gs';
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ok   ' + m); } else { failed++; console.log('  FAIL ' + m); } return c; };
const section = m => console.log('\n' + m);

// A two-page PDF, small enough to read in a diff and real enough to decode.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n').toString('base64');
const BIG_PDF = Buffer.from('%PDF-1.4\n' + 'A'.repeat(300000) + '\n%%EOF\n').toString('base64');

function env(opts = {}) {
  const g = makeEnv(Object.assign({ gs: GS, strictGrid: true, now: '2026-09-13T10:00:00Z' }, opts));
  g.setup();
  const acc = g.__sheets['Access'];
  acc._grid.length = 1;                       // drop the change-me row setup() seeds
  [['Ricky Rampersad', 'Branch Manager', 'bm-pass', 'ricky@example.com', 'Yes'],
   ['Kerwyn Ramroach', 'Assit Branch Mgr', 'abm-pass', '', 'Yes'],
   ['Gary Sookdeo', 'Unit Mgr', 'gary-pass', '', 'Yes'],
   ['Akaash Kalladeen', 'Unit Manager', 'ak-pass', '', 'Yes'],
   ['Kamla', 'Branch Mgr Assistant', 'bma-pass', '', 'Yes'],
   ['Former Staffer', 'Unit Manager', 'x', '', 'No']].forEach(r => acc.appendRow(r));
  return g;
}

function candidate(id, name, rm, uploads = {}, pop = null) {
  return {
    id, created: '2026-01-02T00:00:00.000Z', updated: '2026-09-01T00:00:00.000Z',
    meta: { name, recruitingManager: rm, currentStage: 'selectionFile', phone: '000-0000' },
    stages: {
      firstInterview: { date: '2026-01-12', outcome: 'proceed' },
      pop7Review: { finalRating: 3, uploadedReport: pop || { filename: '', sizeKB: 0, base64: '', mediaType: '' } },
      selectionFile: { documentUploads: uploads, filePrepChecklist: {} },
      induction: { coachingNotes: '' }
    }
  };
}
const upload = (fname, b64) => ({ filename: fname, sizeKB: Math.round(b64.length * 0.75 / 1024),
  uploadedAt: '2026-09-01T00:00:00.000Z', base64: b64, mediaType: 'application/pdf', uploadedBy: 'Test' });

// ---------------------------------------------------------------------------
section('setup() builds the workbook');
{
  const g = makeEnv({ gs: GS, strictGrid: true });
  g.setup();
  const tabs = ['Access', 'Candidates', 'Documents', 'Production', 'Cohort', 'ManagerPulse', 'Variance', 'MarketSurveys', 'AiLog'];
  ok(tabs.every(t => g.__sheets[t]), 'all nine tabs are created');
  ok(g.__sheets['Candidates']._grid[0].join(',') === 'Id,Name,Stage,RecruitingManager,Updated,Created,CreatedBy,Chunks,Json1', 'the Candidates header is written');
  ok(g.__drive.roots.some(f => f.name === 'RRB Recruit Tracker — Documents'), 'the Drive folder is created');
  ok(g.__props['RT_DOC_FOLDER'], 'and its id is remembered in Script Properties');
  ok(g.__rows('Access').length === 1 && g.__rows('Access')[0].Password === 'change-me', 'one Access row is seeded, with a password to change');
  ok(g.__logs.some(l => /No ANTHROPIC_API_KEY/.test(l)), 'the log says the AI key is not set yet');
  const before = JSON.stringify(Object.values(g.__sheets).map(s => s._grid));
  g.setup();
  ok(JSON.stringify(Object.values(g.__sheets).map(s => s._grid)) === before, 'running it twice changes nothing');
}

section('who may sign in');
{
  const g = env();
  const bm = g.login_('Ricky Rampersad', 'bm-pass');
  ok(bm.ok && bm.profile.role === 'BM' && bm.profile.scope === 'all', 'the Branch Manager signs in and sees everything');
  const abm = g.login_('Kerwyn Ramroach', 'abm-pass');
  ok(abm.ok && abm.profile.role === 'RM' && abm.profile.scope === 'all', '"Assit Branch Mgr" is understood as the ABM, who also sees everything');
  ok(abm.profile.title === 'Assistant Branch Manager', 'and is called one');
  const um = g.login_('Gary Sookdeo', 'gary-pass');
  ok(um.ok && um.profile.role === 'RM' && um.profile.scope === 'own', 'a Unit Manager signs in scoped to his own');
  ok(g.login_('Kamla', 'bma-pass').profile.role === 'BMA', 'the BMA is a BMA, not a Branch Manager, despite the word in the title');
  ok(g.login_('ricky@example.com', 'bm-pass').ok, 'an email address works as an identity too');
  ok(!g.login_('Former Staffer', 'x').ok, 'an inactive row cannot sign in');
  ok(!g.login_('Nobody At All', 'x').ok, 'nor can a name that is not there');
  ok(!g.login_('Ricky Rampersad', 'wrong').ok, 'nor the right name with the wrong password');
  ok(!JSON.stringify(bm).includes('bm-pass') && !JSON.stringify(bm.roster).includes('gary-pass'),
     'no password appears anywhere in what leaves the server');
}

section('five wrong tries, and how long a session lasts');
{
  const g = env();
  for (let i = 0; i < 5; i++) g.login_('Gary Sookdeo', 'wrong');
  const locked = g.login_('Gary Sookdeo', 'gary-pass');
  ok(!locked.ok && /Too many attempts/.test(locked.error), 'five wrong tries locks the name even against the right password');
  g.__advance(901);
  ok(g.login_('Gary Sookdeo', 'gary-pass').ok, 'and the lock lifts after fifteen minutes');

  const tok = g.login_('Ricky Rampersad', 'bm-pass').token;
  ok(g.readToken_(tok).name === 'Ricky Rampersad', 'a token reads back as the person who signed in');
  g.__advance(6 * 3600 + 10);
  // Google caps a cache entry at six hours whatever is asked for, so the
  // session is six hours and the page has to say so.
  ok(g.readToken_(tok) === null, 'the session is gone after six hours');
  ok(g.handle_('list', {}, tok).authRequired === true, 'and the page is told to sign in again rather than shown an error');
  ok(g.handle_('list', {}, 'forged').authRequired === true, 'a made-up token gets the same answer');
}

section('the figures, scoped to who is asking');
{
  const g = env();
  g.__sheets['Cohort'].appendRow(['Recruit One', 2025, 'Gary Sookdeo', 51, 31, -11, 24, 37, 38, 40, 5, 'caution', 45, 'hired', 'contracted', 'A001', '2025-03-01', '', 'active', 'Marginal.']);
  g.__sheets['Cohort'].appendRow(['Recruit Two', 2025, 'Akaash Kalladeen', '', '', '', '', '', '', '', '', '', '', 'no_show', 'no_contract', '', '', '', 'never_contracted', 'Full file, never came.']);
  g.__sheets['Production'].appendRow(['A001', 'Recruit One', 7, 22506, 0, 0, 'A note.', '']);
  g.__sheets['Production'].appendRow(['A002', 'Someone Else', 14, 61391, 1, 500, '', 'Yes']);
  g.__sheets['ManagerPulse'].appendRow(['Gary Sookdeo', 7, 1, 4, 2, 1, '2026-01-13', 'One on One', 'Recruit One, Recruit Three', 'Recruit One', 'Names the same agents.']);
  g.__sheets['ManagerPulse'].appendRow(['Akaash Kalladeen', 4, 2, 1, 1, 0, '2026-02-04', 'Online', 'Recruit Two', '', 'Reports late.']);
  g.__sheets['MarketSurveys'].appendRow(['Recruit One', 25, 6, 14, '0-10', 'Gary Sookdeo', 'red', 'Volume without effort.']);
  g.__sheets['Variance'].appendRow(['Recruit One (Jan 2025)', 'Recruit One', 'Jan 2025', 'Gary Sookdeo', 12000, 0, -100, 120, 76, -37, 35, 23, -34, 10, 4, -60, 5, 2, 16500, 'Did not settle.']);

  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  const d = g.handle_('datasets', {}, BM).datasets;
  ok(d.cohort.length === 2 && Object.keys(d.production).length === 2, 'the Branch Manager gets the whole branch');
  ok(d.cohort[0].PS === 51 && typeof d.cohort[0].PS === 'number', 'scores come back as numbers');
  ok(d.cohort[1].PS === null && d.cohort[1].finalRating === null, 'a recruit with no scores gives nulls, not zeros — a blank is not a nought');
  ok(d.cohort[1].agentId === null, 'and a blank agent number is null, not an empty string');
  ok(Array.isArray(d.managerPulse['Gary Sookdeo'].agents_named) && d.managerPulse['Gary Sookdeo'].agents_named.length === 2,
     'a comma-separated cell becomes an array');
  ok(d.managerPulse['Akaash Kalladeen'].repeat_offenders.length === 0, 'and an empty one becomes an empty array, not [""]');
  ok(d.production['A001'].note === 'A note.' && d.production['A002'].terminated === 'Yes', 'production keeps its note and its terminated flag');
  ok(d.variance['Recruit One (Jan 2025)'].income_var_pct === -100, 'a variance row keeps its negative percentage');

  const UM = g.login_('Gary Sookdeo', 'gary-pass').token;
  const u = g.handle_('datasets', {}, UM).datasets;
  ok(u.cohort.length === 1 && u.cohort[0].rm === 'Gary Sookdeo', 'a Unit Manager gets only his own recruits');
  ok(Object.keys(u.managerPulse).length === 1 && u.managerPulse['Gary Sookdeo'], 'and only his own coaching summary');
  ok(Object.keys(u.production).length === 1 && u.production['A001'], 'and production only for agents in his own cohort');
  ok(Object.keys(u.marketSurveys).length === 1, 'and market surveys only for his');
  ok(g.handle_('datasets', {}, g.login_('Kamla', 'bma-pass').token).datasets.cohort.length === 2, 'the BMA sees the branch');
}

section('a candidate, and where the files go');
{
  const g = env();
  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  const rec = candidate('cand_1', 'A Candidate', 'Gary Sookdeo',
    { '3': upload('3 Form A.pdf', PDF), '6.a': upload('6a Quals.pdf', BIG_PDF) },
    { filename: 'POP.pdf', sizeKB: 400, base64: BIG_PDF, mediaType: 'application/pdf' });
  const raw = JSON.stringify(rec);
  ok(g.handle_('save', { id: 'cand_1', json: raw }, BM).ok, `a ${(raw.length / 1024).toFixed(0)} KB record with three files saves`);

  const row = g.__rows('Candidates')[0];
  ok(row.Id === 'cand_1' && row.Name === 'A Candidate', 'the index columns are filled from the record');
  ok(row.RecruitingManager === 'Gary Sookdeo' && row.CreatedBy === 'Ricky Rampersad', 'along with who recruits and who created it');
  const stored = Object.keys(row).filter(k => /^Json\d+$/.test(k)).reduce((n, k) => n + String(row[k]).length, 0);
  ok(stored < raw.length / 5, `only ${(stored / 1024).toFixed(0)} KB reached the sheet — the files went elsewhere`);
  ok(!/"base64":"[A-Za-z0-9+/]{200,}/.test(JSON.stringify(row)), 'no base64 payload is left in any cell');
  ok(g.__rows('Documents').length === 3, 'each file has a Documents row');
  ok(g.__rows('Documents').some(r => r.DocKey === 'pop'), 'including the POP report, under its own key');
  ok([...g.__drive.files.values()].filter(f => !f.trashed).length === 3, 'and each is in Drive');
  const folder = g.__drive.folders.get(g.__props['RT_DOC_FOLDER']);
  ok(folder.folders.length === 1 && folder.folders[0].name === 'cand_1', 'filed in a folder named for the candidate');

  const back = JSON.parse(g.handle_('get', { id: 'cand_1' }, BM).json);
  ok(back.meta.name === 'A Candidate' && back.stages.firstInterview.outcome === 'proceed', 'the record reads back whole');
  ok(back.stages.selectionFile.documentUploads['3'].base64 === '' && back.stages.selectionFile.documentUploads['3'].hasBlob === true,
     'each upload is marked hasBlob with its payload gone');
  ok(back.stages.selectionFile.documentUploads['3'].filename === '3 Form A.pdf', 'and keeps its filename');
  const blob = g.handle_('docGet', { candidateId: 'cand_1', docKey: '6.a' }, BM);
  ok(blob.ok && blob.base64 === BIG_PDF, 'a 300 KB file comes back from Drive byte-for-byte');
  ok(blob.mediaType === 'application/pdf', 'with its media type');
  ok(g.handle_('docGet', { candidateId: 'cand_1', docKey: 'never-uploaded' }, BM).missing === true,
     'a file that was never there reports missing rather than failing');

  const listed = g.handle_('list', {}, BM);
  ok(listed.list.length === 1 && listed.list[0].name === 'A Candidate', 'the pipeline list shows it');
  ok(listed.candidates['cand_1'], 'and the same reply carries the record, so the page needs one round trip, not two');
}

section('replacing and removing a file');
{
  const g = env();
  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  g.handle_('save', { id: 'c', json: JSON.stringify(candidate('c', 'X', 'Gary Sookdeo')) }, BM);
  const first = Buffer.from('first').toString('base64');
  g.handle_('docPut', { candidateId: 'c', docKey: '12', base64: first, mediaType: 'application/pdf', filename: 'a.pdf' }, BM);
  const firstId = g.__rows('Documents').find(r => r.DocKey === '12').FileId;
  g.handle_('docPut', { candidateId: 'c', docKey: '12', base64: Buffer.from('second').toString('base64'), mediaType: 'application/pdf', filename: 'b.pdf' }, BM);
  ok(g.__rows('Documents').filter(r => r.DocKey === '12').length === 1, 'replacing a file keeps one row, not two');
  ok(g.__drive.files.get(firstId).trashed, 'and the old file is trashed rather than left behind');
  ok(Buffer.from(g.handle_('docGet', { candidateId: 'c', docKey: '12' }, BM).base64, 'base64').toString() === 'second',
     'the new one is what comes back');
  g.handle_('docDelete', { candidateId: 'c', docKey: '12' }, BM);
  ok(g.__rows('Documents').filter(r => r.DocKey === '12').length === 0, 'deleting removes the row');
  ok(g.handle_('docGet', { candidateId: 'c', docKey: '12' }, BM).missing === true, 'and the file with it');
}

section('a record longer than one cell, and wider than the sheet');
{
  const g = env();
  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  const rec = candidate('long', 'Long Record', 'Gary Sookdeo');

  rec.stages.induction.coachingNotes = 'x'.repeat(120000);
  ok(g.handle_('save', { id: 'long', json: JSON.stringify(rec) }, BM).ok, 'a 120 KB record saves');
  const row = () => g.__rows('Candidates').find(r => r.Id === 'long');
  ok(Number(row().Chunks) >= 3, `it is split across ${row().Chunks} cells`);
  ok(Object.keys(row()).filter(k => /^Json\d+$/.test(k)).every(k => String(row()[k]).length <= 45000),
     'no cell is near Google\'s 50,000 character limit');
  ok(JSON.parse(g.handle_('get', { id: 'long' }, BM).json).stages.induction.coachingNotes.length === 120000, 'and it reassembles exactly');

  rec.stages.induction.coachingNotes = 'y'.repeat(40000);
  g.handle_('save', { id: 'long', json: JSON.stringify(rec) }, BM);
  ok(JSON.parse(g.handle_('get', { id: 'long' }, BM).json).stages.induction.coachingNotes === 'y'.repeat(40000),
     'shrinking it leaves no stale tail in the cells it no longer needs');
  ok(g.__rows('Candidates').filter(r => r.Id === 'long').length === 1, 'and still one row after three saves');

  // Nine headers plus eighteen chunks fills a new sheet's 26 columns exactly.
  // Before ensureJsonColumns_ widened the sheet first, this threw "exceeds
  // grid limits" — which reads like a fault in the script and is really a
  // sheet that needs widening.
  rec.stages.induction.coachingNotes = 'z'.repeat(900000);
  const wide = g.handle_('save', { id: 'long', json: JSON.stringify(rec) }, BM);
  ok(wide.ok, 'a 900 KB record, needing more columns than a new sheet has, saves: ' + (wide.error || 'ok'));
  ok(g.__sheets['Candidates'].getMaxColumns() > 26, `the tab was widened to ${g.__sheets['Candidates'].getMaxColumns()} columns to hold it`);
  ok(JSON.parse(g.handle_('get', { id: 'long' }, BM).json).stages.induction.coachingNotes.length === 900000, 'and it reassembles');
}

section('what one unit may not see of another');
{
  const g = env();
  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  g.handle_('save', { id: 'gary1', json: JSON.stringify(candidate('gary1', 'Gary Recruit', 'Gary Sookdeo', { '3': upload('f.pdf', PDF) })) }, BM);
  const GARY = g.login_('Gary Sookdeo', 'gary-pass').token;
  const AK = g.login_('Akaash Kalladeen', 'ak-pass').token;
  const KAMLA = g.login_('Kamla', 'bma-pass').token;

  ok(g.handle_('list', {}, GARY).list.length === 1, 'Gary sees the candidate he recruits');
  ok(g.handle_('list', {}, AK).list.length === 0, 'Akaash does not see her at all');
  ok(!g.handle_('get', { id: 'gary1' }, AK).ok, 'and cannot fetch her by id');
  ok(!g.handle_('docGet', { candidateId: 'gary1', docKey: '3' }, AK).ok, 'nor pull her documents');
  ok(!g.handle_('save', { id: 'gary1', json: JSON.stringify(candidate('gary1', 'Renamed', 'Akaash Kalladeen')) }, AK).ok,
     'nor take her over by saving over the record');
  ok(g.__rows('Candidates')[0].Name === 'Gary Recruit', 'and the record is untouched by the attempt');
  ok(g.handle_('list', {}, KAMLA).list.length === 1, 'the BMA sees her, because assembling the file is her job');
  ok(!g.handle_('delete', { id: 'gary1' }, GARY).ok, 'a Unit Manager cannot delete a candidate');
  ok(!g.handle_('delete', { id: 'gary1' }, KAMLA).ok, 'nor can the BMA');
  ok(g.handle_('delete', { id: 'gary1' }, BM).ok, 'the Branch Manager can');
  ok([...g.__drive.files.values()].every(f => !f.trashed), 'and the files stay in Drive — a deleted row is a click, a police certificate is not');

  // A new candidate has no recruiting manager yet, so the person who made it
  // has to be able to see it, or it vanishes the moment it is created.
  const fresh = candidate('fresh', '', '');
  g.handle_('save', { id: 'fresh', json: JSON.stringify(fresh) }, GARY);
  ok(g.handle_('list', {}, GARY).list.length === 1, 'a candidate Gary has just created, with no manager set, is still his');
}

section('Salesforce — where the production figures come from');
{
  // A stand-in Salesforce. The shape is the one WallBoard.gs already queries:
  // CLIENT_PORTFOLIO__c, settled rows, summed on Total_API__c, grouped by
  // AGENT__r.Name. Rajiv's figures are the branch's real ones, already in
  // board/dashboard.html — the newest recruit, producing, with nothing last year.
  // Settled new business on CLIENT_PORTFOLIO__c, and increases on their own
  // object with their own picked-up date — the two things the branch counts
  // toward a probation quota.
  const SETTLED = {
    THIS_YEAR:  [{ a: 'Rajiv Soodoo', n: 3, api: 89303 }, { a: 'Recruit One', n: 7, api: 22506 }],
    THIS_MONTH: [{ a: 'Rajiv Soodoo', n: 3, api: 89303 }],
    THIS_WEEK:  [{ a: 'Rajiv Soodoo', n: 2, api: 10155 }]
  };
  const INCREASES = {
    THIS_YEAR:  [{ a: 'Rajiv Soodoo', n: 1, api: 5000 }],
    THIS_MONTH: [{ a: 'Rajiv Soodoo', n: 1, api: 5000 }],
    THIS_WEEK:  []
  };
  let logins = 0, queries = 0;
  const salesforce = (url) => {
    if (/oauth2\/token/.test(url)) {
      logins++;
      return { code: 200, body: JSON.stringify({ access_token: 'tok-' + logins, instance_url: 'https://x.my.salesforce.com' }) };
    }
    queries++;
    const q = decodeURIComponent(url.split('q=')[1] || '');
    const win = ['THIS_WEEK', 'THIS_MONTH', 'THIS_YEAR'].find(w => q.includes(w)) || 'THIS_YEAR';
    const src = /Policy_Increases__c/.test(q) ? INCREASES : SETTLED;
    return { code: 200, body: JSON.stringify({ records: src[win] || [] }) };
  };
  const SFPROPS = { SF_KEY: 'k', SF_SECRET: 's', SF_USER: 'u', SF_PASS: 'p' };

  // The Production tab is the roster of agent numbers. Rajiv has one; the
  // figures on it are stale, because somebody pasted them a month ago.
  function withProduction(g) {
    g.__sheets['Production'].appendRow(['A9001', 'Rajiv Soodoo', 0, 0, 0, 0, 'Pasted before he settled anything.', '']);
    g.__sheets['Production'].appendRow(['A0001', 'Recruit One', 1, 999, 0, 0, '', '']);
    g.__sheets['Cohort'].appendRow(['Rajiv Soodoo', 2026, 'Akaash Kalladeen', 55, 35, 5, 10, 45, 50, 45, 4, 'proceed', 60, 'hired', 'contracted', 'A9001', '2026-07-01', '', 'active', 'Newest recruit.']);
    g.__sheets['Cohort'].appendRow(['Recruit One', 2025, 'Gary Sookdeo', 51, 31, -11, 24, 37, 38, 40, 5, 'caution', 45, 'hired', 'contracted', 'A0001', '2025-03-01', '', 'active', '']);
    return g;
  }

  {
    const g = withProduction(env());
    const d = g.handle_('datasets', {}, g.login_('Ricky Rampersad', 'bm-pass').token).datasets;
    ok(d.productionSource.source === 'sheet', 'with no Salesforce set up the figures come from the tab, as before');
    ok(d.production['A9001'].settledAPI === 0, 'and they are whatever was pasted there');
    ok(!d.productionByName || !Object.keys(d.productionByName).length, 'and nothing is keyed by name either');
    ok(/not set up/.test(d.productionSource.reason), 'and the page is told why');
  }
  {
    const g = withProduction(env({ properties: SFPROPS, fetchHandler: salesforce }));
    const d = g.handle_('datasets', {}, g.login_('Ricky Rampersad', 'bm-pass').token).datasets;
    ok(d.productionSource.source === 'salesforce', 'with Salesforce set up the figures come from Salesforce');
    ok(d.production['A9001'].settledAPI === 94303 && d.production['A9001'].apps === 4,
       "the newest recruit's production is live — $89,303 settled plus a $5,000 increase, not the stale nought on the tab");
    ok(d.production['A9001'].weekApps === 2 && d.production['A9001'].weekAPI === 10155,
       'this week comes through, with no increase in it to add');
    ok(d.production['A9001'].monthAPI === 94303, 'and this month carries its increase too');
    ok(d.production['A9001'].live === true, 'the figure is marked live, so a screen can say so');
    ok(d.production['A0001'].settledAPI === 22506,
       'an agent with no increases is his settled figure alone, and the stale 999 is gone');
    ok(d.productionSource.matched === 2, 'both agents matched');
    ok(d.productionSource.countsIncreases === true,
       'policy increases count toward probation — the branch decided so on 13 September 2026');
    ok(logins === 1, 'one Salesforce login, not one per query');
    ok(queries === 6, 'six queries: the year, month and week, each for new business and increases');
  }
  {
    // The case that actually bites: a newly contracted recruit is producing in
    // Salesforce before anybody adds him to the Production tab. He has no agent
    // number here, so nothing can look him up — say so rather than lose him.
    const g = env({ properties: SFPROPS, fetchHandler: salesforce });
    g.__sheets['Production'].appendRow(['A0001', 'Recruit One', 1, 999, 0, 0, '', '']);
    g.__sheets['Cohort'].appendRow(['Recruit One', 2025, 'Gary Sookdeo', 51, 31, -11, 24, 37, 38, 40, 5, 'caution', 45, 'hired', 'contracted', 'A0001', '2025-03-01', '', 'active', '']);
    const d = g.handle_('datasets', {}, g.login_('Ricky Rampersad', 'bm-pass').token).datasets;
    ok(d.productionSource.unplaced.includes('Rajiv Soodoo'),
       'an agent settling business with no row on the Production tab is named, not dropped');
    ok(!d.production['A9001'], 'and no row is invented for him');
  }
  {
    const g = withProduction(env({ properties: SFPROPS, fetchHandler: salesforce }));
    const d = g.handle_('datasets', {}, g.login_('Gary Sookdeo', 'gary-pass').token).datasets;
    ok(Object.keys(d.production).length === 1 && d.production['A0001'],
       "a Unit Manager's live figures cover his own agents and nobody else's");
    ok(!d.production['A9001'], "and Akaash's newest recruit is not among them");
  }
  {
    const g = withProduction(env({ properties: SFPROPS, fetchHandler: (u, p) => {
      if (/oauth2\/token/.test(u)) return { code: 200, body: JSON.stringify({ access_token: 't', instance_url: 'https://x' }) };
      return { code: 503, body: 'Salesforce is down' };
    } }));
    const d = g.handle_('datasets', {}, g.login_('Ricky Rampersad', 'bm-pass').token).datasets;
    ok(d.productionSource.source === 'sheet', 'when Salesforce is down the tab is used instead');
    ok(/did not answer/.test(d.productionSource.reason), 'and the page is told that is what happened');
    ok(d.production['A9001'].settledAPI === 0, 'with the pasted figures intact');
    ok(d.cohort.length === 2, 'and nothing else on the screen is lost to it');
  }
  {
    // A token that dies mid-flight is the ordinary case after fifty minutes.
    let first = true;
    const g = withProduction(env({ properties: SFPROPS, fetchHandler: (u, p) => {
      if (/oauth2\/token/.test(u)) return { code: 200, body: JSON.stringify({ access_token: 't', instance_url: 'https://x' }) };
      if (first) { first = false; return { code: 401, body: 'expired' }; }
      return salesforce(u, p);
    } }));
    const d = g.handle_('datasets', {}, g.login_('Ricky Rampersad', 'bm-pass').token).datasets;
    ok(d.productionSource.source === 'salesforce', 'an expired token is retried once rather than shown to anybody');
  }
  {
    const g = withProduction(env({ properties: SFPROPS, fetchHandler: salesforce }));
    // Signing in already builds the datasets, so the login IS the first screen.
    const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
    const afterFirst = g.__fetches.length;
    ok(afterFirst === 7, `the first screen costs one login and six queries (${afterFirst})`);
    g.handle_('datasets', {}, BM);
    g.handle_('datasets', {}, BM);
    ok(g.__fetches.length === afterFirst, 'and the next two come out of the ten-minute cache, not out of Salesforce');
  }
  {
    const g = withProduction(env({ properties: SFPROPS, fetchHandler: salesforce }));
    // The tab and Salesforce will not always spell a name the same way.
    g.__sheets['Production']._grid[1][1] = 'Rajiv  Soodoo';
    const d = g.handle_('datasets', {}, g.login_('Ricky Rampersad', 'bm-pass').token).datasets;
    ok(d.production['A9001'].settledAPI === 94303, 'a double space between the names still matches');
    const h = withProduction(env({ properties: SFPROPS, fetchHandler: salesforce }));
    h.__sheets['Production']._grid[1][1] = 'Rajiv K. Soodoo';
    const d2 = h.handle_('datasets', {}, h.login_('Ricky Rampersad', 'bm-pass').token).datasets;
    ok(d2.production['A9001'].settledAPI === 94303, 'and so does a middle initial on one side only');
  }
}

section('a recruit contracted before anybody typed their agent number');
{
  // The case Rajiv is: contracted, settling business, and not yet on the
  // Production tab. The induction screen looks production up by agent number,
  // so without a fallback his figures were invisible exactly when somebody
  // most wanted to see them.
  const SETTLED = { THIS_YEAR: [{ a: 'Rajiv Soodoo', n: 3, api: 89303 }], THIS_MONTH: [], THIS_WEEK: [] };
  const salesforce = (url) => {
    if (/oauth2\/token/.test(url)) return { code: 200, body: JSON.stringify({ access_token: 't', instance_url: 'https://x' }) };
    const q = decodeURIComponent(url.split('q=')[1] || '');
    if (/Policy_Increases__c/.test(q)) return { code: 200, body: JSON.stringify({ records: [] }) };
    const win = ['THIS_WEEK', 'THIS_MONTH', 'THIS_YEAR'].find(w => q.includes(w)) || 'THIS_YEAR';
    return { code: 200, body: JSON.stringify({ records: SETTLED[win] || [] }) };
  };
  const SFPROPS = { SF_KEY: 'k', SF_SECRET: 's', SF_USER: 'u', SF_PASS: 'p' };

  const g = env({ properties: SFPROPS, fetchHandler: salesforce });
  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  const rec = candidate('rajiv', 'Rajiv Soodoo', 'Akaash Kalladeen');
  rec.meta.currentStage = 'induction';
  g.handle_('save', { id: 'rajiv', json: JSON.stringify(rec) }, BM);

  const d = g.handle_('datasets', {}, BM).datasets;
  ok(d.productionByName['rajiv soodoo'], 'his figures are sent keyed by name, with no agent number anywhere');
  ok(d.productionByName['rajiv soodoo'].settledAPI === 89303, 'and they are the real ones');
  ok(!Object.keys(d.production).length, 'while nothing is invented on the agent-number side');

  // Scope still holds: this is Akaash's recruit, not Gary's.
  const gary = g.handle_('datasets', {}, g.login_('Gary Sookdeo', 'gary-pass').token).datasets;
  ok(!gary.productionByName['rajiv soodoo'], "a Unit Manager does not get another unit's recruit by name either");
  const ak = g.handle_('datasets', {}, g.login_('Akaash Kalladeen', 'ak-pass').token).datasets;
  ok(ak.productionByName['rajiv soodoo'], 'the manager who recruits him does');
}

section('addRecruit, for somebody already contracted');
{
  const salesforce = (url) => {
    if (/oauth2\/token/.test(url)) return { code: 200, body: JSON.stringify({ access_token: 't', instance_url: 'https://x' }) };
    const q = decodeURIComponent(url.split('q=')[1] || '');
    const rows = /Policy_Increases__c/.test(q) || !/THIS_YEAR/.test(q) ? [] : [{ a: 'Rajiv Soodoo', n: 3, api: 89303 }];
    return { code: 200, body: JSON.stringify({ records: rows }) };
  };
  const g = env({ properties: { SF_KEY: 'k', SF_SECRET: 's', SF_USER: 'u', SF_PASS: 'p' }, fetchHandler: salesforce });
  const id = g.addRecruit('Rajiv Soodoo', 'Akaash Kalladeen', { stage: 'induction' });
  ok(/^cand_/.test(id), 'it returns the new record id');
  const row = g.__rows('Candidates')[0];
  ok(row.Name === 'Rajiv Soodoo' && row.RecruitingManager === 'Akaash Kalladeen', 'the row carries the name and the manager');
  ok(row.Stage === 'induction', 'at the stage asked for');
  const rec = JSON.parse(g.handle_('get', { id }, g.login_('Ricky Rampersad', 'bm-pass').token).json);
  ok(rec.stages.onboarding.agentNumber === '', 'the agent number is left blank rather than invented');
  ok(rec.stages.induction.contract.probationStart === '', 'and so are the contract dates');
  ok(g.__logs.some(l => /Still blank/.test(l)), 'and the log says which fields still need somebody');
  ok(g.__logs.some(l => /89303|89,303/.test(l)), 'it also reports the production Salesforce already has for the name');
  const again = g.addRecruit('Rajiv  Soodoo', 'Akaash Kalladeen', { stage: 'induction' });
  ok(again === id && g.__rows('Candidates').length === 1, 'running it twice does not make a second Rajiv');
  const withDates = g.addRecruit('Someone New', 'Gary Sookdeo', { stage: 'induction', agentNumber: 'A9999', probationStart: '2026-08-01', probationEnd: '2027-03-01' });
  const rec2 = JSON.parse(g.handle_('get', { id: withDates }, g.login_('Ricky Rampersad', 'bm-pass').token).json);
  ok(rec2.stages.onboarding.agentNumber === 'A9999' && rec2.stages.induction.contract.probationEnd === '2027-03-01',
     'what is passed is written');
  let threw = false;
  try { g.addRecruit('', 'Gary Sookdeo'); } catch (e) { threw = true; }
  ok(threw, 'a nameless recruit is refused');
}

section('the Claude proxy');
{
  const g = env();
  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  const noKey = g.handle_('ai', { kind: 'brief', profile: {} }, BM);
  ok(!noKey.ok && /ANTHROPIC_API_KEY/.test(noKey.error), 'with no key it says which property to set, and nothing else breaks');

  const k = env({ properties: { ANTHROPIC_API_KEY: 'sk-ant-test' },
    fetchHandler: () => ({ code: 200, body: JSON.stringify({ model: 'claude-opus-5', stop_reason: 'end_turn',
      usage: { input_tokens: 11, output_tokens: 22 }, content: [{ type: 'text', text: 'the brief' }] }) }) });
  const K = k.login_('Ricky Rampersad', 'bm-pass').token;
  const brief = k.handle_('ai', { kind: 'brief', profile: { name: 'X' }, candidateName: 'X' }, K);
  ok(brief.ok && brief.text === 'the brief', 'the coaching brief comes back');
  const call = k.__fetches[0], body = JSON.parse(call.params.payload);
  ok(call.url === 'https://api.anthropic.com/v1/messages', 'it calls the Messages API');
  ok(call.params.headers['x-api-key'] === 'sk-ant-test', 'with the key from Script Properties, never from the page');
  ok(call.params.headers['anthropic-version'] === '2023-06-01', 'and the version header');
  ok(body.model === 'claude-opus-5', 'on claude-opus-5');
  ok(body.fallbacks === 'default' && call.params.headers['anthropic-beta'] === 'server-side-fallback-2026-07-01',
     'with the server-side fallback and the beta header that gates it, paired');
  ok(call.params.muteHttpExceptions === true, 'muting HTTP exceptions, so an error can be read instead of thrown');
  ok(k.__rows('AiLog')[0].Who === 'Ricky Rampersad' && k.__rows('AiLog')[0].OutputTokens === 22,
     'and the call is logged with who asked and what it cost');

  const pdf = k.handle_('ai', { kind: 'popPdf', base64: PDF, mediaType: 'application/pdf', candidateName: 'X', recruitingManager: 'Y' }, K);
  const pb = JSON.parse(k.__fetches[1].params.payload);
  ok(pdf.ok && pb.messages[0].content[0].type === 'document' && pb.messages[0].content[0].source.data === PDF,
     'a POP report goes up as a document block with the PDF attached');
  ok(/pages 7-14/.test(pb.messages[0].content[1].text), 'alongside the drill-down prompt');
  ok(!k.handle_('ai', { kind: 'popText', text: '   ' }, K).ok, 'empty pasted text is refused before any call is made');
  ok(!k.handle_('ai', { kind: 'nonsense' }, K).ok, 'an unknown kind is refused');
  ok(k.__fetches.length === 2, 'and neither of those spent a request');

  const refused = env({ properties: { ANTHROPIC_API_KEY: 'k' },
    fetchHandler: () => ({ code: 200, body: JSON.stringify({ stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'cyber', explanation: 'no' }, content: [], usage: {} }) }) });
  const R = refused.login_('Ricky Rampersad', 'bm-pass').token;
  const r = refused.handle_('ai', { kind: 'brief', profile: {} }, R);
  ok(!r.ok && /declined/.test(r.error), 'a refusal is reported as one, not as empty text');
  ok(refused.__rows('AiLog')[0].Status === 'refusal', 'and logged as one');

  const broke = env({ properties: { ANTHROPIC_API_KEY: 'k' }, fetchHandler: () => ({ code: 500, body: 'upstream boom' }) });
  const B = broke.login_('Ricky Rampersad', 'bm-pass').token;
  ok(!broke.handle_('ai', { kind: 'brief', profile: {} }, B).ok, 'a 500 from Anthropic is an error, not a crash');
  ok(broke.__rows('AiLog')[0].Status === 'HTTP 500', 'and is logged with its status');
}

section('the door');
{
  const g = env();
  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  const post = g.doPost({ postData: { contents: JSON.stringify({ action: 'ping' }) } });
  ok(JSON.parse(post.getContent()).version && post.getMimeType() === 'application/json', 'doPost answers ping as JSON');
  const bad = JSON.parse(g.doPost({ postData: { contents: 'not json' } }).getContent());
  ok(!bad.ok && /not readable JSON/.test(bad.error), 'an unreadable body is said to be unreadable, not answered with a cheerful ok');
  ok(/is running/.test(g.doGet({ parameter: {} }).getContent()), 'a bare GET says the backend is running');
  ok(JSON.parse(g.doGet({ parameter: { action: 'ping' } }).getContent()).ok, 'and doGet routes an action');
  ok(g.handle_('nonsense', {}, BM).error.includes('Unknown action'), 'an unknown action is named in the error');
  const corrupt = g.handle_('save', { id: 'x', json: '{not json' }, BM);
  ok(!corrupt.ok && /valid JSON/.test(corrupt.error), 'a corrupt record is refused with a clear message');
  ok(!g.handle_('save', { id: 'a', json: JSON.stringify({ id: 'b' }) }, BM).ok, 'a record whose id disagrees with the request is refused');
  ok(!g.handle_('save', { id: '', json: '' }, BM).ok, 'and an empty save is refused');
  ok(!g.__lockHeld(), 'no lock is left held after all of that');
}

// ---------------------------------------------------------------------------
// The real seed, if somebody has it. It is not in this repository.
const SEED = process.env.RRB_SEED_DIR;
if (SEED && fs.existsSync(path.join(SEED, 'felicia-seed-part1.json'))) {
  section('the real seeded candidate (RRB_SEED_DIR is set)');
  const g = env();
  const BM = g.login_('Ricky Rampersad', 'bm-pass').token;
  const rec = JSON.parse(fs.readFileSync(path.join(SEED, 'felicia-seed-part1.json'), 'utf8')).candidates[0];
  for (const p of [2, 3]) {
    const f = path.join(SEED, `felicia-seed-part${p}.json`);
    if (!fs.existsSync(f)) continue;
    const e = JSON.parse(fs.readFileSync(f, 'utf8')).candidates[0];
    Object.assign(rec.stages.selectionFile.documentUploads, e.stages.selectionFile.documentUploads);
  }
  const withBytes = Object.keys(rec.stages.selectionFile.documentUploads).filter(k => rec.stages.selectionFile.documentUploads[k].base64);
  ok(g.handle_('save', { id: rec.id, json: JSON.stringify(rec) }, BM).ok, 'the real 5 MB record saves');
  ok(g.__rows('Documents').length === withBytes.length + 1, `every file with bytes is filed (${withBytes.length} uploads plus the POP report)`);
  const back = JSON.parse(g.handle_('get', { id: rec.id }, BM).json);
  ok(Object.values(back.stages.selectionFile.documentUploads).every(u => !u.base64), 'and no payload is left on any upload entry');
  // Item 10 is the POP report itself, marked sharedWithPop by whoever built
  // the export. It has no bytes of its own; the page falls back to the pop key.
  ok(back.stages.selectionFile.documentUploads['10'].sharedWithPop === true, 'item 10 keeps its sharedWithPop flag');
  ok(g.handle_('docGet', { candidateId: rec.id, docKey: 'pop' }, BM).ok, 'and the PDF the page falls back to is there under pop');
} else {
  console.log('\nthe real seed is not here (set RRB_SEED_DIR to run against it) — skipped');
}

console.log(`\n${failed ? 'FAILED' : 'OK'} — ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
