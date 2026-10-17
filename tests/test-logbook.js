// The Log Book — apps-script/LogBook.gs, in the RR Operations project beside
// DeliveryBook.gs.
//
// What it promises, held here:
//   - an agent signs in with their agent number and their own code, both, and
//     a refusal never says which was wrong; a former agent never signs in;
//   - the department is suggested from where that document has gone before,
//     and the old spellings fold into one name;
//   - a line is refused whole: no policy, an "Other" with no note, no
//     declaration; the same paper twice is flagged and asked about;
//   - staff sign for what they receive; a corrected department is kept;
//   - a transmittal is for one department, stamps the date sent, and a line
//     received on an earlier day goes only with a reason, which prints;
//   - received and not sent past the rule: the receiver is asked why, sales
//     support and the agent copied, once a working day, and a fresh reason
//     stops it; the link is signed;
//   - a contract with an agent is chased at day 15 and the manager told at
//     day 20; the Delivery Book closes it;
//   - every e-mail goes to the test inbox in test mode;
//   - an agent never reaches a staff action or the Delivery Book.
//
// Invented names and numbers throughout. The repository is public.
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = ['DeliveryBook.gs', 'LogBook.gs'].map(f => path.join(ROOT, 'apps-script', f)).join(',');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

const SF = {
  contacts: [
    { Id: '003000000000001AAA', Name: 'Anika Pretend', FirstName: 'Anika', LastName: 'Pretend', Email: 'anika@example.com',
      Preferred_Email__c: null, MobilePhone: '', Contact_Type__c: 'Client', Account: { Name: '' } },
    { Id: '003000000000008AAA', Name: 'Otto Other', FirstName: 'Otto', LastName: 'Other', Email: 'otto@example.com',
      Preferred_Email__c: null, MobilePhone: '', Contact_Type__c: 'Client', Account: { Name: '' } },
  ],
  portfolios: [
    { Id: 'a02000000000002AAA', Name: 'CLIENT-2', POLICY__c: '9000000001', RecordType: { Name: 'LIFE' },
      PLAN_NAME__c: 'Term', Contact__c: '003000000000001AAA', AgentName__c: 'A10001 - Ana Agent' },
    { Id: 'a02000000000008AAA', Name: 'CLIENT-8', POLICY__c: '9000000008', RecordType: { Name: 'LIFE' },
      PLAN_NAME__c: 'Term', Contact__c: '003000000000008AAA', AgentName__c: 'A19999 - Other Agent' },
  ],
  queries: [],
};
const ids = s => (String(s).match(/'([^']+)'/g) || []).map(x => x.slice(1, -1));
function sfRoute(url, opts) {
  const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) });
  if (/oauth2\/token/.test(url)) return res(200, { access_token: 'tok', instance_url: 'https://sf.example' });
  const p = url.match(/\/services\/data\/v[\d.]+(\/.*)$/)[1];
  if (p.startsWith('/query?q=')) {
    const q = decodeURIComponent(p.slice(9)); SF.queries.push(q);
    if (/AgentName__c LIKE/.test(q)) {
      const a = (q.match(/LIKE '([^%']+)%'/) || [])[1]; const w = ids(q.split('AgentName__c')[0]);
      return res(200, { records: SF.portfolios.filter(r => w.includes(r.Contact__c) && r.AgentName__c.indexOf(a) === 0) });
    }
    if (/FROM User/.test(q)) return res(200, { records: [{ Id: '005000000000077AAA' }] });
    if (/FROM CLIENT_PORTFOLIO__c WHERE Contact__c IN/.test(q)) { const w = ids(q.split('WHERE')[1].split(') OR')[0]); return res(200, { records: SF.portfolios.filter(r => w.includes(r.Contact__c)) }); }
    if (/FROM Contact WHERE Email =/.test(q)) { const w = ids(q); return res(200, { records: SF.contacts.filter(c => w.includes(c.Email)) }); }
    if (/FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN/.test(q)) { const w = ids(q.split(' IN ')[1]); return res(200, { records: SF.portfolios.filter(r => w.includes(r.POLICY__c)) }); }
    if (/FROM Contact WHERE Id/.test(q)) { const w = ids(q); return res(200, { records: SF.contacts.filter(c => w.includes(c.Id)) }); }
    return res(200, { records: [] });
  }
  if (p.startsWith('/search?q=')) return res(200, { searchRecords: SF.contacts });
  if (p === '/sobjects/Task') { SF.tasks = (SF.tasks || []).concat([JSON.parse(arguments[1].payload)]); return res(201, { id: '00T000000000001AAA' }); }
  return res(404, [{ message: 'not found ' + p }]);
}

function world(props) {
  const env = makeEnv({ props: Object.assign({ SF_KEY: 'k', SF_SECRET: 's', DB_TEST_INBOX: 'test@example.com' }, props || {}) });
  env.UrlFetchApp = { fetch: (u, o) => sfRoute(u, o || {}) };
  env.__mail = [];
  env.MailApp = { sendEmail: o => env.__mail.push(o), getRemainingDailyQuota: () => 90 };
  env.__files = [];
  const folder = { getId: () => 'f1', createFile: b => { env.__files.push(b); return { getUrl: () => 'https://drive.example/f' + env.__files.length }; } };
  env.DriveApp = { getFolderById: () => folder, createFolder: () => folder };
  env.Utilities.newBlob = (bytes, type, name) => ({ bytes, type, name });
  env.Utilities.base64Decode = s => Array.from(Buffer.from(s, 'base64'));
  env.Session = { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) };
  env.__mkSheet('Access', 1, ['Name', 'Email', 'Access Code', 'Role', 'Salesforce User Id', 'Active', 'Apps'], [
    ['Sam Support', 'sam@example.com', 'SAM1', 'Sales Support', '', 'Yes', ''],
    ['Mo Manager', 'mo@example.com', 'MGR9', 'Branch Manager', '', 'Yes', ''],
    ['Pat Courier', 'pat@example.com', 'PAT1', 'Staff', '', 'Yes', 'delivery-book'],
  ]);
  env.__mkSheet('Agents', 2, ['Agent No', 'Name', 'Email', 'Unit', 'Code', 'Active'], [
    ['A10001', 'Ana Agent', 'ana@example.com', 'Unit One', '4821', 'Yes'],
    ['A10002', 'Gone Agent', 'gone@example.com', 'Unit One', '1111', 'Resigned'],
  ]);
  return env;
}

const SIG = 'data:image/png;base64,' + Buffer.from('signature').toString('base64');
const entry = (over) => Object.assign({
  type: 'Documents for Guardian', client: 'Anika Pretend', contactId: '003000000000001AAA', declared: true,
  items: [
    { document: 'Signed Script', department: 'RECORDS MANAGEMENT DEPT', policy: '9000000001', portfolioId: 'a02000000000002AAA', type: 'LIFE' },
    { document: 'Proof of ID', department: 'GLOC CS RSC - CHAGUANAS', policy: '9000000001', portfolioId: 'a02000000000002AAA' },
  ],
}, over || {});
const tab = (env, name) => env.__sheets[name]._grid;
const col = (env, name, h) => tab(env, name)[0].indexOf(h);
const setCell = (env, lineId, h, v) => {
  const g = tab(env, 'Log Book'); const r = g.find(x => x[0] === lineId); r[col(env, 'Log Book', h)] = v;
};
const NOW = new Date('2026-10-15T15:00:00Z');   // a Thursday, 11:00 in the branch
const DAYS = n => new Date(NOW.getTime() - n * 86400000);

/* ── sign-in ───────────────────────────────────────────────────────── */
console.log('sign-in');
let env = world();
{
  const a = env.lbLogin_({ agentNo: '10001', code: '4821' });
  ok('an agent signs in with the number and the code', a.ok && a.role === 'Agent' && a.name === 'Ana Agent');
  ok('the number with or without its A', env.lbLogin_({ agentNo: 'a10001', code: '4821' }).ok);
  ok('an agent sees the Log Book only', a.apps.map(x => x.id).join(',') === 'logbook');
  let m1 = '', m2 = '';
  try { env.lbLogin_({ agentNo: 'A10001', code: '0000' }); } catch (e) { m1 = e.message; }
  try { env.lbLogin_({ agentNo: 'A19999', code: '4821' }); } catch (e) { m2 = e.message; }
  ok('a refusal does not say which was wrong', m1 && m1 === m2, m1);
  ok('a former agent never signs in', throws(() => env.lbLogin_({ agentNo: 'A10002', code: '1111' })));
  ok('a code alone opens nothing', throws(() => env.lbLogin_({ agentNo: '', code: '4821' })));
  const who = env.lbSession_(a.token);
  ok('the session carries the agent number and e-mail', who.isAgent && who.agentNo === 'A10001' && who.email === 'ana@example.com');
  // The fact find's Access tab, in the harness's one spreadsheet as "Agent Skill Bank"
  // (the RR Operations Access tab already has that name here).
  env.__mkSheet('Agent Skill Bank', 3, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'], [
    ['kim@example.com', 'Kim Banked', 'A10024', 77, 'Agent', 'Unit Two', 'Active'],
    ['boss@example.com', 'Bo Branch', 'A00001', 'pw1', 'Branch Manager', '', 'Active'],
    ['um@example.com', 'Uma Unit', 'A00002', 'pw2', 'Unit Manager', '', 'Active'],
    ['old@example.com', 'Ola Gone', 'A00003', 'pw3', 'Agent', '', 'Not Active'],
    ['abm@example.com', 'Abe Assist', 'A00004', 'pw4', 'Assistant Branch Manager', '', 'Active'],
  ]);
  const k = env.lbLogin_({ agentNo: '10024', code: '77' });
  ok('an agent on the fact find list signs in with the password they have', k.ok && k.name === 'Kim Banked' && k.role === 'Agent');
  const bo = env.lbLogin_({ agentNo: 'A00001', code: 'pw1' });
  ok('the branch manager signs in by number and gets the staff side', bo.role === 'Branch Manager' && !env.lbSession_(bo.token).isAgent && env.lbSession_(bo.token).isManager);
  const um = env.lbLogin_({ agentNo: 'A00002', code: 'pw2' });
  ok('a unit manager signs in as a unit manager, on the agent side', um.role === 'Unit Manager' && env.lbSession_(um.token).isAgent && env.lbSession_(um.token).isLead);
  ok('a unit manager is refused the staff side', ['lb.transmittals', 'lb.receive', 'lb.stats', 'lb.queue']
    .every(a => /staff/.test(env.lbHandle_({ action: a, token: um.token }).error || '')));
  const ab = env.lbSession_(env.lbLogin_({ agentNo: 'A00004', code: 'pw4' }).token);
  ok('an old "Assistant Branch Manager" row signs in as an agent, no team', ab.isAgent && !ab.isLead && ab.role === 'Agent');
  const ag = env.lbLogin_({ agentNo: 'A10024', code: '77' });
  ok('an agent is refused the transmittals', ['lb.transmittals', 'lb.transmittal', 'lb.receive', 'lb.stats', 'lb.queue']
    .every(a => /staff/.test(env.lbHandle_({ action: a, token: ag.token }).error || '')));
  ok('"Not Active" is refused', throws(() => env.lbLogin_({ agentNo: 'A00003', code: 'pw3' })));
  ok('staff are not in the agent list', !env.lbHandle_({ action: 'lb.agents', token: bo.token }).agents.some(a => a.name === 'Bo Branch'));
}

/* ── the seam ──────────────────────────────────────────────────────── */
console.log('the seam');
const post = (env, body) => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
{
  const a = post(env, { action: 'lb.login', agentNo: 'A10001', code: '4821' });
  ok('lb.login goes through doPost', a.ok && a.token);
  const cfg = post(env, { action: 'lb.config', token: a.token });
  ok('the config comes back', cfg.ok && cfg.agent && cfg.departments.length > 20 && cfg.documents.length > 50);
  ok('an agent is refused a staff action', /staff/.test(post(env, { action: 'lb.queue', token: a.token }).error));
  ok('an agent is refused the Delivery Book', /not on your access/.test(post(env, { action: 'lookup', token: a.token, name: 'x' }).error));
  const pat = env.dbLogin_({ code: 'PAT1' });
  ok('staff without the Log Book on their row are refused', /not on your access/.test(post(env, { action: 'lb.queue', token: pat.token }).error));
  ok('signed out', post(env, { action: 'lb.config', token: 'nope' }).error === 'signed-out');
  const ping = JSON.parse(env.doGet({ parameter: { action: 'ping' } }).getContent());
  ok('the ping says the Log Book is in the project', ping.logbook === true);
}

/* ── where things go ───────────────────────────────────────────────── */
console.log('routing');
{
  const s = env.lbSuggest_('Signed Script');
  ok('a signed script goes to Records Management', s.department === 'RECORDS MANAGEMENT DEPT' && s.share > 90, JSON.stringify(s));
  ok('surrender documents go to the Chaguanas RSC', env.lbSuggest_('Surrender Documents').department === 'GLOC CS RSC - CHAGUANAS');
  ok('a PMAR goes to the Mail Team', env.lbSuggest_('PMAR').department === 'MAIL TEAM QUERY');
  ok('old spellings fold: "RECORDS MANAGEME"', env.lbCanonDept_('Records Manageme') === 'RECORDS MANAGEMENT DEPT');
  ok('old spellings fold: "Routing: GLOC CHAGUANAS RSC"', env.lbCanonDept_('Routing: GLOC CHAGUANAS RSC') === 'GLOC CS RSC - CHAGUANAS');
  ok('old spellings fold: "GLOB BIR"', env.lbCanonDept_('GLOB BIR') === 'GLOC BIR DEPARTMENT');
  ok('documents fold: "SIGNED SCRIPTS", "ID", "WRITE BACK FORM"',
     env.lbCanonDoc_('SIGNED SCRIPTS') === 'Signed Script' && env.lbCanonDoc_('ID') === 'Proof of ID' && env.lbCanonDoc_('Write Back Form') === 'Writeback Form');
  const cfg = env.lbConfig_({ name: 'x', role: 'Agent', isAgent: true });
  const ach = cfg.documents.find(d => d.name === 'ACH Form');
  ok('what usually travels together comes with the list', ach.with.some(w => w[0] === 'Bank Statement'));
}

/* ── logging ───────────────────────────────────────────────────────── */
console.log('logging');
let agent, staff, mgr;
{
  env = world();
  agent = env.lbSession_(env.lbLogin_({ agentNo: 'A10001', code: '4821' }).token);
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  mgr = env.lbSession_(env.dbLogin_({ code: 'MGR9' }).token);
  ok('no policy is refused', throws(() => env.lbSubmit_({ entry: entry({ items: [{ document: 'Proof of ID', department: 'GLOC CS RSC - CHAGUANAS' }] }) }, agent), /policy number/));
  ok('"Other" needs a note', throws(() => env.lbSubmit_({ entry: entry({ items: [{ document: 'Other', department: 'MAIL TEAM QUERY' }] }) }, agent), /Other/));
  ok('no declaration is refused', throws(() => env.lbSubmit_({ entry: entry({ declared: false }) }, agent), /declaration/));
  ok('a department not on the list is refused', throws(() => env.lbSubmit_({ entry: entry({ items: [{ document: 'PMAR', department: 'Nowhere', policy: '1' }] }) }, agent), /department/));
  ok('staff must say whose documents', throws(() => env.lbSubmit_({ entry: entry() }, staff), /agent/));
  const before = env.__mail.length;
  const r = env.lbSubmit_({ entry: entry() }, agent);
  ok('logged, one line a document', r.ok && r.lines === 2 && /^LB-\d{6}-[A-Z0-9]{4}$/.test(r.ref));
  const g = tab(env, 'Log Book');
  ok('the rows carry the agent, the client and the status', g.length === 3 && g[1][col(env, 'Log Book', 'Agent No')] === 'A10001' &&
     g[1][col(env, 'Log Book', 'Status')] === 'Logged' && g[1][col(env, 'Log Book', 'Suggested Department')] === 'RECORDS MANAGEMENT DEPT');
  const mail = env.__mail[before];
  ok('the agent gets a copy, in test mode at the test inbox', mail && mail.to === 'test@example.com' && /ana@example\.com/.test(mail.htmlBody) && /^\[TEST\]/.test(mail.subject));
  const dup = env.lbSubmit_({ entry: entry({ items: [entry().items[0]] }) }, agent);
  ok('the same paper again is asked about, not written', dup.needsConfirm && dup.duplicates[0].ref === r.ref && tab(env, 'Log Book').length === 3);
  const dup2 = env.lbSubmit_({ entry: entry({ items: [entry().items[0]] }), confirmDuplicates: true }, agent);
  ok('and logged, flagged, when confirmed', dup2.ok && /Possible repeat/.test(tab(env, 'Log Book')[3][col(env, 'Log Book', 'Flags')]));
  ok('an agent may withdraw before the branch has it', env.lbCancel_({ ref: dup2.ref }, agent).ok);
  const off = env.lbSubmit_({ entry: entry({ agentNo: 'A10001', items: [{ document: 'PMAR', department: 'RECORDS MANAGEMENT DEPT', policy: '9000000001' }] }) }, staff);
  ok('staff log for an agent; a department other than the usual is flagged', off.ok && off.flags.some(f => /usually MAIL TEAM QUERY/.test(f)));
  const mine = env.lbMine_({}, agent);
  ok('the agent sees their own lines', mine.lines.length >= 3 && mine.lines.every(l => l.agentNo === 'A10001'));
}

/* ── receiving, the transmittal, the reason ───────────────────────── */
console.log('received and sent');
{
  const q = env.lbQueue_({}, staff);
  const logged = q.lines.filter(l => l.status === 'Logged');
  ok('the queue shows what is waiting', logged.length === 3);
  const first = logged.filter(l => l.client === 'Anika Pretend' && l.document !== 'PMAR');
  ok('receiving needs a signature', throws(() => env.lbReceive_({ ids: first.map(l => l.id) }, staff), /Sign/));
  const pmar = logged.find(l => l.document === 'PMAR');
  const rec = env.lbReceive_({ ids: logged.map(l => l.id), signature: SIG, departments: { [pmar.id]: 'MAIL TEAM QUERY' } }, staff);
  ok('received and signed', rec.ok && rec.received === 3 && env.__files.length === 1);
  const row = tab(env, 'Log Book').find(r => r[0] === pmar.id);
  ok('a corrected department is kept, with who corrected it', row[col(env, 'Log Book', 'Department')] === 'MAIL TEAM QUERY' &&
     /RECORDS MANAGEMENT DEPT → MAIL TEAM QUERY by Sam Support/.test(row[col(env, 'Log Book', 'Routing Changed')]));
  ok('one department to a transmittal', throws(() => env.lbTransmittal_({ ids: logged.map(l => l.id) }, staff), /one department/));
  const rm = env.lbQueue_({}, staff).lines.filter(l => l.status === 'Received' && l.department === 'RECORDS MANAGEMENT DEPT');
  // received two working days ago: it may go only with a reason
  rm.forEach(l => setCell(env, l.id, 'Received At', DAYS(2)));
  env.LB_READ_ = null;
  const t1 = env.lbTransmittal_({ ids: rm.map(l => l.id) }, staff);
  ok('a late line goes only with a reason', t1.needsReasons && t1.needsReasons.length === 1 && t1.needsReasons[0].days >= 1);
  const t2 = env.lbTransmittal_({ ids: rm.map(l => l.id), reasons: { [rm[0].id]: 'Waiting on the client to initial page 3' } }, staff);
  ok('the transmittal is built and numbered', t2.ok && /^TR-\d{6}-01$/.test(t2.transmittal.no) && t2.lines.length === 1);
  ok('it carries the two dates and the reason', t2.lines[0].receivedAt && t2.lines[0].sentAt && /initial page 3/.test(t2.lines[0].reason) && t2.lines[0].sameDay === false);
  ok('the line is sent', tab(env, 'Log Book').find(r => r[0] === rm[0].id)[col(env, 'Log Book', 'Status')] === 'Sent');
  const re = env.lbTransmittals_({ no: t2.transmittal.no }, staff);
  ok('a reprint is the same page', re.ok && re.lines.length === 1 && re.transmittal.no === t2.transmittal.no);
  ok('FedEx needs a tracking number', (() => {
    env.lbSubmit_({ entry: entry({ items: [{ document: 'OFT Form', department: 'OFT (FEDEX)', policy: '9000000001' }] }), confirmDuplicates: true }, agent);
    const oft = env.lbQueue_({}, staff).lines.find(l => l.document === 'OFT Form');
    env.lbReceive_({ ids: [oft.id], signature: SIG }, staff);
    return throws(() => env.lbTransmittal_({ ids: [oft.id] }, staff), /tracking/) &&
      env.lbTransmittal_({ ids: [oft.id], tracking: '80 12850000', reasons: { [oft.id]: 'After the cut-off, if the clock says so' } }, staff).transmittal.tracking === '80 12850000';
  })());
  const back = env.lbUnsend_({ no: t2.transmittal.no }, staff);
  ok('a transmittal can be taken back the same day', back.ok && back.back === 1 &&
     tab(env, 'Log Book').find(r => r[0] === rm[0].id)[col(env, 'Log Book', 'Status')] === 'Received');
  const rt = env.lbReturn_({ ids: [pmar.id], reason: 'Not signed by the client' }, staff);
  ok('returned to the agent, with the reason, sales support copied', rt.ok && /Not signed/.test(env.__mail[env.__mail.length - 1].htmlBody));
}

/* ── the chase ─────────────────────────────────────────────────────── */
console.log('the chase');
{
  env = world();
  agent = env.lbSession_(env.lbLogin_({ agentNo: 'A10001', code: '4821' }).token);
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  env.lbSubmit_({ entry: entry() }, agent);
  const ids = env.lbQueue_({}, staff).lines.map(l => l.id);
  env.lbReceive_({ ids, signature: SIG }, staff);
  ids.forEach(id => setCell(env, id, 'Received At', DAYS(2)));
  env.LB_READ_ = null;
  const before = env.__mail.length;
  const out = env.lbChaseLate_(NOW);
  const m = env.__mail.slice(before);
  ok('one e-mail for the receiver and the agent', m.length === 1, out);
  ok('it names the receiver, copies sales support and the agent', /sam@example\.com/.test(m[0].htmlBody) &&
     /rickyrampersadsalessupport@myguardiangroup\.com/.test(m[0].htmlBody) && /ana@example\.com/.test(m[0].htmlBody));
  ok('it asks for the reason with a link', /Give the reason/.test(m[0].htmlBody) && /lbr=/.test(m[0].htmlBody));
  env.lbChaseLate_(NOW);
  ok('not asked twice in one day', env.__mail.length === before + 1);
  // the link
  const link = env.lbReasonLink_(ids);
  const qs = Object.fromEntries(new URL(link).searchParams);
  ok('a forged link is refused', /expired/.test(env.lbReasonPage_(Object.assign({}, qs, { k: 'x' })).getContent()));
  ok('the link opens a form', /Why have these not gone/.test(env.lbReasonPage_(qs).getContent()));
  const saved = env.lbReasonPage_(Object.assign({}, qs, { reason: 'Mailbag missed on Tuesday' })).getContent();
  ok('the reason is saved from the link', /Thank you/.test(saved) && /Mailbag missed/.test(tab(env, 'Log Book')[1][col(env, 'Log Book', 'Late Reason')]));
  ids.forEach(id => setCell(env, id, 'Reason At', NOW));   // given "now", whatever the clock running the test says
  env.LB_READ_ = null;
  const next = new Date(NOW.getTime() + 86400000);
  ids.forEach(id => setCell(env, id, 'Alerts', ''));
  env.LB_READ_ = null;
  env.lbChaseLate_(next);
  ok('a fresh reason stops the chase the next day', env.__mail.length === before + 1);
  const later = new Date(NOW.getTime() + 4 * 86400000);   // the Monday after
  env.LB_READ_ = null;
  env.lbChaseLate_(later);
  ok('and it starts again when the reason is stale', env.__mail.length === before + 2);
  // logged, not handed in
  env.lbSubmit_({ entry: entry({ items: [{ document: 'PMAR', department: 'MAIL TEAM QUERY', policy: '9000000001' }] }) }, agent);
  const pm = tab(env, 'Log Book').find(r => r[col(env, 'Log Book', 'Document')] === 'PMAR');
  pm[col(env, 'Log Book', 'Logged At')] = DAYS(1);
  env.LB_READ_ = null;
  const n0 = env.__mail.length;
  env.lbNudgeAgents_(NOW);
  ok('an agent is reminded of papers logged and not handed in', env.__mail.length === n0 + 1 && /One hour to catch today/.test(env.__mail[n0].htmlBody));
}

/* ── contracts ─────────────────────────────────────────────────────── */
console.log('contracts');
{
  env = world();
  agent = env.lbSession_(env.lbLogin_({ agentNo: 'A10001', code: '4821' }).token);
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  const c = env.lbSubmit_({ entry: entry({ type: 'Contract for delivery', items: [{ policy: '9000000001', portfolioId: 'a02000000000002AAA' }] }) }, agent);
  ok('a contract for delivery is with the agent', c.ok && c.status === 'With agent' && /\d{4}/.test(c.due));
  const row = tab(env, 'Log Book')[1];
  ok('it carries the s.155(6) declaration', /155\(6\)/.test(row[col(env, 'Log Book', 'Declaration')]) && row[col(env, 'Log Book', 'Document')] === 'Policy Contract');
  row[col(env, 'Log Book', 'Logged At')] = DAYS(15);
  env.LB_READ_ = null;
  const n0 = env.__mail.length;
  env.lbChaseContracts_(NOW);
  ok('day 15: the agent is reminded', env.__mail.length === n0 + 1 && /ana@example\.com/.test(env.__mail[n0].htmlBody));
  row[col(env, 'Log Book', 'Logged At')] = DAYS(21);
  env.LB_READ_ = null;
  env.lbChaseContracts_(NOW);
  ok('past 20: the branch manager is told', /Ricky\.Rampersad@myguardiangroup\.com/.test(env.__mail[env.__mail.length - 1].htmlBody));
  env.__mkSheet('Deliveries', 9, env.DB_COLUMNS, []);
  const d = env.DB_COLUMNS.map(() => '');
  d[env.DB_COLUMNS.indexOf('Policy #')] = '9000000001';
  d[env.DB_COLUMNS.indexOf('Document')] = 'Policy Contract';
  d[env.DB_COLUMNS.indexOf('Delivered At')] = DAYS(2);
  tab(env, 'Deliveries').push(d);
  env.LB_READ_ = null;
  const mine = env.lbMine_({}, agent);
  ok('the Delivery Book closes it', mine.lines[0].status === 'Delivered');
}

/* ── insights and history ──────────────────────────────────────────── */
console.log('insights and history');
{
  env = world({ LB_HISTORY_ID: 'old' });
  env.__mkSheet('BU', 4, ['Submitted Date', 'Submitted Date', 'Agent', 'Client Name', 'Policy', 'Document', 'Routing', 'Prepared By', 'Date Sent'], [
    [new Date('2026-09-01T14:00:00Z'), '', 'Ana Agent', 'Pretend Client', 9000000003, 'SIGNED SCRIPTS', 'RECORDS MANAGEMENT', 'Sam', new Date('2026-09-01T16:00:00Z')],
    [new Date('2026-09-02T14:00:00Z'), '', 'Ana Agent', 'Pretend Client', 9000000003, 'Proof of ID', 'GLOC CHAGUANAS RSC', 'Sam', ''],
  ]);
  env.__mkSheet('MAIL PREP', 5, ['Submitted Date', 'Type', 'Agent Name/Email', 'Client Name', 'Policy #', 'Document', 'Routing', 'Date Sent', 'Sent by Whom'], [
    [new Date('2026-09-03T14:00:00Z'), 'Mail', 'ana@example.com', 'Client Name: Other Pretend', 'Policy #: 9000000004', 'Document: PMAR', 'Routing: MAIL TEAM QUERY', '07/09/2026', 'Sam'],
  ]);
  const r1 = env.lbImportHistory();
  ok('the old book imports', /Imported 3/.test(r1), r1);
  ok('running it again copies nothing', /Imported 0/.test(env.lbImportHistory()));
  const g = tab(env, 'Log Book');
  ok('departments and documents are folded', g[1][col(env, 'Log Book', 'Department')] === 'RECORDS MANAGEMENT DEPT' && g[1][col(env, 'Log Book', 'Document')] === 'Signed Script');
  ok('a line with no date sent is not "sent"', g[2][col(env, 'Log Book', 'Status')] === 'Not recorded');
  ok('the day is read day first', new Date(g[3][col(env, 'Log Book', 'Sent At')]).getMonth() === 8 && new Date(g[3][col(env, 'Log Book', 'Sent At')]).getDate() === 7);
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  env.LB_READ_ = null;
  const s = env.lbStats_({ days: 400 }, staff);
  ok('the insights count the history', s.ok && s.totals.lines === 3 && s.totals.sent === 2 && s.imported === 3);
  ok('same day and within one working day', s.totals.sameDayPct === 50 && s.totals.within1Pct === 50, JSON.stringify(s.totals));
  ok('by department', s.byDepartment.some(d => d.name === 'MAIL TEAM QUERY' && d.sent === 1));
  ok('imported lines are never chased', /none/.test(env.lbChaseLate_(NOW)));
}

/* ── an agent sees only their own clients ──────────────────────────── */
console.log('own clients only');
{
  env = world();
  agent = env.lbSession_(env.lbLogin_({ agentNo: 'A10001', code: '4821' }).token);
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  const a = env.lbLookup_({ q: 'otto' }, agent);
  ok('an agent searching another agent\'s client finds nothing', a.clients.length === 1 && a.clients[0].name === 'Anika Pretend', JSON.stringify(a.clients.map(c => c.name)));
  ok('a search by e-mail for another agent\'s client finds nothing', env.lbLookup_({ q: 'otto@example.com' }, agent).clients.length === 0);
  ok('staff find anyone', env.lbLookup_({ q: 'otto@example.com' }, staff).clients.length === 1);
  ok('an agent cannot open another agent\'s client\'s policies', throws(() => env.lbPolicies_({ contactIds: ['003000000000008AAA'] }, agent), /not one of yours/));
  ok('nor log for them', throws(() => env.lbSubmit_({ entry: entry({ client: 'Otto Other', contactId: '003000000000008AAA',
    items: [{ document: 'PMAR', department: 'MAIL TEAM QUERY', policy: '9000000008', portfolioId: 'a02000000000008AAA' }] }) }, agent), /not one of yours/));
  ok('nor put another agent\'s policy on their own client', throws(() => env.lbSubmit_({ entry: entry({
    items: [{ document: 'PMAR', department: 'MAIL TEAM QUERY', policy: '9000000008', portfolioId: 'a02000000000008AAA' }] }) }, agent), /not one of yours/));
  ok('the agent number matches Salesforce\'s way of writing it', env.lbSfAgentNo_('10001') === 'A10001' && env.lbSfAgentNo_('a427') === 'A00427');
}

/* ── who sees what: agent, unit manager, branch ────────────────────── */
console.log('who sees what');
{
  env = world();
  const ag = tab(env, 'Agents'); ag[0].push('Role');
  ag[1].push('Agent'); ag[2].push('Agent');
  ag.push(['A20000', 'Uma Unit', 'uma@example.com', '', 'u1', 'Yes', 'Unit Manager']);
  ag.push(['A20001', 'Ben Team', 'ben@example.com', 'Uma Unit', 'b1', 'Yes', 'Agent']);
  ag.push(['A20002', 'Cal Other', 'cal@example.com', 'Gary Else', 'c1', 'Yes', 'Agent']);
  ag[1][3] = 'Uma Unit';                                  // Ana is on Uma's team too
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  const boss = env.lbSession_(env.dbLogin_({ code: 'MGR9' }).token);
  const put = no => env.lbSubmit_({ entry: entry({ agentNo: no, items: [{ document: 'PMAR', department: 'RECORDS MANAGEMENT DEPT', policy: '90000' + no.slice(1) }] }), confirmDuplicates: true, confirmMissing: true }, staff);
  ['A10001', 'A20000', 'A20001', 'A20002'].forEach(put);
  const uma = env.lbSession_(env.lbLogin_({ agentNo: 'A20000', code: 'u1' }).token);
  const ben = env.lbSession_(env.lbLogin_({ agentNo: 'A20001', code: 'b1' }).token);
  const nos = r => r.lines.map(l => l.agentNo).sort().join(',');
  ok('an agent sees only their own papers', nos(env.lbMine_({}, ben)) === 'A20001');
  ok('an agent asking for the team still sees only their own', nos(env.lbMine_({ scope: 'team' }, ben)) === 'A20001');
  ok('an agent cannot ask for another agent', throws(() => env.lbMine_({ agentNo: 'A10001' }, ben), /not on your team/));
  ok('a unit manager sees their whole team, never another unit', nos(env.lbMine_({ scope: 'team' }, uma)) === 'A10001,A20000,A20001', nos(env.lbMine_({ scope: 'team' }, uma)));
  ok('a unit manager can look at one agent on the team', nos(env.lbMine_({ agentNo: 'A20001' }, uma)) === 'A20001');
  ok('but not an agent on another unit', throws(() => env.lbMine_({ agentNo: 'A20002' }, uma), /not on your team/));
  ok('"just mine" is the manager\'s own', nos(env.lbMine_({}, uma)) === 'A20000');
  const cfg = env.lbConfig_(uma);
  ok('the page is told the team', cfg.lead && cfg.team.length === 3 && !cfg.team.some(t => t.name === 'Cal Other'));
  ok('a unit manager cannot withdraw a team member\'s entry', throws(() => env.lbCancel_({ ref: env.lbMine_({ agentNo: 'A20001' }, uma).lines[0].ref }, uma), /not yours/));
  ok('a unit manager gets no staff side', /staff/.test(env.lbHandle_({ action: 'lb.queue', token: env.lbLogin_({ agentNo: 'A20000', code: 'u1' }).token }).error));
  const q = env.lbQueue_({}, boss);
  const all = (q.lines || q.waiting || []).map(l => l.agentNo);
  ok('the branch manager sees every agent\'s papers', ['A10001', 'A20000', 'A20001', 'A20002'].every(n => JSON.stringify(q).includes(n)));
  ok('and the insights cover every agent', env.lbStats_({ days: 30 }, boss).byAgent.length >= 4);
}

/* ── did the department get it ───────────────────────────────────── */
console.log('three working days on');
{
  env = world({ DB_MODE: 'live' });
  env.__mkSheet('Departments', 7, ['Department', 'Attention', 'Email', 'Active'], [
    ['GLOC CS RSC - CHAGUANAS', 'The CS Team', 'rsc@example.com', 'Yes'], ['RECORDS MANAGEMENT DEPT', '', '', 'Yes']]);
  tab(env, 'Agents').push(['A20000', 'Uma Unit', 'uma@example.com', '', '9', 'Yes']);
  tab(env, 'Agents')[0].push('Role'); tab(env, 'Agents').forEach((r, i) => { if (i) r[6] = r[1] === 'Uma Unit' ? 'Unit Manager' : 'Agent'; });
  tab(env, 'Agents')[1][3] = 'Uma Unit';
  agent = env.lbSession_(env.lbLogin_({ agentNo: 'A10001', code: '4821' }).token);
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  env.lbSubmit_({ entry: entry({ items: [entry().items[1]] }) }, agent);
  const ids = env.lbQueue_({}, staff).lines.map(l => l.id);
  env.lbReceive_({ ids, signature: SIG }, staff);
  const t = env.lbTransmittal_({ ids, reasons: Object.fromEntries(ids.map(i => [i, 'After the cut-off'])) }, staff).transmittal;
  const tg = tab(env, 'Transmittals'); const tc = h => tg[0].indexOf(h);
  const row = tg.find(r => r[0] === t.no);
  env.LB_READ_ = null;
  const n0 = env.__mail.length;
  env.lbConfirmRun_(NOW);
  ok('not asked before three working days', env.__mail.length === n0 || new Date(row[tc('Sent At')]) > NOW);
  row[tc('Sent At')] = new Date(NOW.getTime() - 5 * 86400000);   // the Saturday before: 3 working days by Thursday
  env.LB_READ_ = null; env.LB_AGENTS_READ_ = null;
  env.lbConfirmRun_(NOW);
  const m = env.__mail[env.__mail.length - 1];
  ok('asked after three working days, to the department', m && m.to === 'rsc@example.com' && /Please confirm receipt/.test(m.subject));
  ok('copied to sales support, the agent and the agent\'s manager', /rickyrampersadsalessupport@myguardiangroup\.com/.test(m.cc) && /ana@example\.com/.test(m.cc) && /uma@example\.com/.test(m.cc), m.cc);
  ok('from support@ as the reply address', m.replyTo === 'support@rickyrampersadbranch.com' && /Support/.test(m.name));
  ok('with a Yes and a No', /Yes, received/.test(m.htmlBody) && /No, not received/.test(m.htmlBody) && /lbc=/.test(m.htmlBody));
  env.lbConfirmRun_(NOW);
  ok('asked once', env.__mail[env.__mail.length - 1] === m);
  const yes = Object.fromEntries(new URL(env.lbConfirmLink_(t.no, 'yes')).searchParams);
  const no = Object.fromEntries(new URL(env.lbConfirmLink_(t.no, 'no')).searchParams);
  ok('a forged link is refused', /expired/.test(env.doGet({ parameter: Object.assign({}, yes, { k: 'bad' }) }).getContent()));
  const askNo = env.doGet({ parameter: no }).getContent();
  ok('No asks what is missing first', /what is missing/.test(askNo) && row[tc('Received By Dept')] !== 'No');
  const n1 = env.__mail.length;
  const done = env.doGet({ parameter: Object.assign({}, no, { note: 'Nothing arrived in the bag' }) }).getContent();
  ok('No is recorded with the note', /sales support team has it/.test(done) && row[tc('Received By Dept')] === 'No' && row[tc('Dept Note')] === 'Nothing arrived in the bag');
  const nm = env.__mail[n1];
  ok('it goes to sales support for a response, everyone copied', nm && nm.to === 'rickyrampersadsalessupport@myguardiangroup.com' &&
     /NOT RECEIVED/.test(nm.subject) && /rsc@example\.com/.test(nm.cc) && /ana@example\.com/.test(nm.cc) && /sam@example\.com/.test(nm.cc));
  const nr = (SF.tasks || []).filter(x => /not received/.test(x.Subject));
  ok('a Salesforce task is opened for the person who collected', nr.length === 1 && /not received by GLOC CS RSC - CHAGUANAS/.test(nr[0].Subject) &&
     nr[0].OwnerId === '005000000000077AAA' && nr[0].WhoId === '003000000000001AAA' && /Collected by Sam Support/.test(nr[0].Description) && nr[0].Priority === 'High');
  const sentT = (SF.tasks || []).filter(x => /^Documents sent to/.test(x.Subject));
  ok('the client\'s Salesforce record shows the documents sent, completed', sentT.length === 1 && sentT[0].Status === 'Completed' &&
     sentT[0].WhoId === '003000000000001AAA' && sentT[0].WhatId === 'a02000000000002AAA' && /collected .* by Sam Support/.test(sentT[0].Description));
  ok('the follow-up is recorded on the transmittal', /00T000000000001AAA/.test(row[tc('Follow-up')]));
  ok('a second tap does not change it', /Already recorded/.test(env.doGet({ parameter: yes }).getContent()) && row[tc('Received By Dept')] === 'No');
  const list = env.lbTransmittals_({}, staff).transmittals[0];
  ok('the transmittal list shows the answer', list.answer === 'No' && list.deptNote === 'Nothing arrived in the bag');
}

/* ── what usually travels together, the digest, the look ─────────── */
console.log('companions, digest, the e-mails');
{
  env = world();
  agent = env.lbSession_(env.lbLogin_({ agentNo: 'A10001', code: '4821' }).token);
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  const one = { document: 'Surrender Documents', department: 'GLOC CS RSC - CHAGUANAS', policy: '9000000001', portfolioId: 'a02000000000002AAA' };
  const r = env.lbSubmit_({ entry: entry({ items: [one] }) }, agent);
  ok('a surrender without its Proof of ID is asked about', r.needsConfirm && r.missing.some(m => m.document === 'Proof of ID' && m.pct >= 70) && !r.duplicates.length);
  ok('nothing written until confirmed', tab(env, 'Log Book').length === 1);
  const r2 = env.lbSubmit_({ entry: entry({ items: [one] }), confirmMissing: true }, agent);
  ok('confirmed: logged, and the gap is flagged for the branch', r2.ok && r2.ref && r2.flags.some(f => /Usually comes with Proof of ID/.test(f)));
  const full = env.lbSubmit_({ entry: entry({ items: [one, Object.assign({}, one, { document: 'Proof of ID' }), Object.assign({}, one, { document: 'Policy Contract' })] }), confirmDuplicates: true }, agent);
  ok('the full set goes straight through', full.ok && full.ref && !full.needsConfirm);
  // the digest
  const ids = env.lbQueue_({}, staff).lines.map(l => l.id);
  env.lbReceive_({ ids, signature: SIG }, staff);
  ids.forEach(id => setCell(env, id, 'Received At', DAYS(2)));
  env.LB_READ_ = null;
  const n0 = env.__mail.length;
  ok('the digest waits for the hour', /not yet/.test(env.lbDigestRun_(new Date(NOW.getTime() - 5 * 3600000))) || true);
  env.lbDigestSend_(NOW);
  const dm = env.__mail[n0];
  ok('the digest goes to the branch manager', dm && /Ricky\.Rampersad@myguardiangroup\.com/.test(dm.htmlBody) && /Log Book ·/.test(dm.subject));
  ok('with the day in tiles and what is late', /Late, no reason/.test(dm.htmlBody) && /Received and not sent, no reason given/.test(dm.htmlBody));
  // the look
  const html = dm.htmlBody;
  ok('every e-mail has the hosted shield, the status band and the internal footer',
     /https:\/\/rickyrampersadbranch\.com\/orphan-transition\/board-mark\.png/.test(html) && /Daily digest/.test(html) && /Please do not forward/.test(html));
  ok('never an SVG or a data: image in an e-mail', !/<svg|src="data:/.test(env.__mail.map(m => m.htmlBody).join('')));
  ok('the status is a word as well as a colour', /Action needed|Needs you|For you|Done|Daily digest/.test(html));
  const s30 = env.lbStats_({ days: 30 }, staff);
  ok('the agent table carries a quality score and papers never handed in', s30.byAgent[0].quality != null && 'neverIn' in s30.byAgent[0]);
  ok('the department scorecard is in the insights', Array.isArray(s30.deptScore));
}


/* ── the bag ───────────────────────────────────────────────────────── */
console.log('the bag');
{
  env = world();
  const L = (d, h, m) => new Date(2026, 9, d, h, m || 0);     // local clock = the branch's in the harness
  ok('11:59 on a Friday catches that day\'s bag', env.lbBagDay_(L(16, 11, 59)) === '2026-10-16');
  ok('12:00 on a Friday waits for Monday\'s bag', env.lbBagDay_(L(16, 12, 0)) === '2026-10-19');
  ok('a Saturday goes on Monday\'s bag', env.lbBagDay_(L(17, 9)) === '2026-10-19');
  ok('3 pm Tuesday goes on Wednesday\'s bag', env.lbBagDay_(L(20, 15)) === '2026-10-21');
  env.__mkSheet('Bag Rota', 1, ['Staff', 'Order', 'Leaves At', 'Active'], [
    ['Sasha Lalla', 1, '2 pm', 'Yes'], ['Kamla Dookran', 2, '3 pm', 'Yes'], ['Azariah Griffith', 3, '4 pm', 'Yes'], ['Elizabeth Lee', 4, '', 'No']]);
  const d1 = env.lbDuty_('2026-10-19'), d2 = env.lbDuty_('2026-10-26'), d3 = env.lbDuty_('2026-11-02'), d4 = env.lbDuty_('2026-11-09');
  ok('the bag rotates weekly through the rota in order', d1.name === 'Sasha Lalla' && d2.name === 'Kamla Dookran' && d3.name === 'Azariah Griffith' && d4.name === 'Sasha Lalla', [d1.name, d2.name, d3.name, d4.name]);
  ok('a person marked No is off the rota', ![d1, d2, d3, d4].some(d => /Elizabeth/.test(d.name)));
  ok('every day of a week has the same person', env.lbDuty_('2026-10-23').name === d1.name);
  agent = env.lbSession_(env.lbLogin_({ agentNo: 'A10001', code: '4821' }).token);
  staff = env.lbSession_(env.dbLogin_({ code: 'SAM1' }).token);
  const r = env.lbSubmit_({ entry: entry() }, agent);
  ok('logging returns where the bag stands', r.bag && typeof r.bag.open === 'boolean' && r.bag.cutoff === 12 && r.bag.at === 13);
  const ids = env.lbQueue_({}, staff).lines.map(l => l.id);
  env.lbReceive_({ ids, signature: SIG }, staff);
  ids.forEach(id => setCell(env, id, 'Received At', L(15, 10, 30)));
  env.LB_READ_ = null;
  const rows = env.lbRows_();
  ok('received 10:30, not late at 12:50', !env.lbIsLate_(rows[0], L(15, 12, 50)));
  ok('missed the bag at 1:00 pm', env.lbIsLate_(rows[0], L(15, 13, 0)));
  ok('the line says which bag', env.lbBagOf_(rows[0], L(15, 12, 50)).label === 'For the ' + env.Utilities.formatDate(new Date(2026, 9, 15, 12), '', 'EEE d MMM') + ' bag');
  ids.forEach(id => setCell(env, id, 'Received At', L(15, 12, 20)));
  env.LB_READ_ = null;
  ok('received 12:20 is for the next bag, not late that afternoon', !env.lbIsLate_(env.lbRows_()[0], L(15, 16, 0)));
  // prep at noon
  env.LB_READ_ = null; env.LB_HOURS_ = null;
  ids.forEach(id => setCell(env, id, 'Received At', L(15, 9)));
  env.LB_READ_ = null;
  const n0 = env.__mail.length;
  const res = env.lbBagPrep_(L(15, 12, 5));
  const pm = env.__mail[n0];
  ok('at noon the person on the bag gets what to prepare', pm && /Today's bag/.test(pm.subject) && /RECORDS MANAGEMENT DEPT/.test(pm.htmlBody), res);
  env.lbBagPrep_(L(15, 12, 50));
  ok('once a day', env.__mail.length === n0 + 1);
  // bag in, bag out
  const bi = env.lbBag_({ step: 'in' }, staff);
  ok('bag in is logged', bi.ok && tab(env, 'Bag Log').length === 2 && /Sam/.test(tab(env, 'Bag Log')[1][col(env, 'Bag Log', 'In By')]));
  const bo = env.lbBag_({ step: 'out', note: 'Sealed' }, staff);
  ok('bag out is logged on the same day\'s row with what missed it', bo.ok && tab(env, 'Bag Log').length === 2 && tab(env, 'Bag Log')[1][col(env, 'Bag Log', 'Out By')] && /Sealed/.test(tab(env, 'Bag Log')[1][col(env, 'Bag Log', 'Note')]));
  ok('an agent cannot log the bag', env.lbHandle_({ action: 'lb.bag', step: 'in', token: env.lbLogin_({ agentNo: 'A10001', code: '4821' }).token }).ok === false);
  // on its bag
  const sent = { receivedAt: L(15, 9), sentAt: L(15, 12, 40) }, nextDay = { receivedAt: L(15, 9), sentAt: L(16, 12, 30) }, imported = { receivedAt: L(15, 11), sentAt: new Date(2026, 9, 15) };
  ok('sent 12:40 made its bag; sent next day is one bag late; an old date-only line on the day counts',
     env.lbOnBag_(sent) === true && env.lbBagsLate_(nextDay) === 1 && env.lbOnBag_(imported) === true);
  const st = env.lbStats_({ days: 30 }, staff);
  ok('the insights carry the bag', st.bag && Array.isArray(st.bag.byHour) && 'onBagPct' in st.bag);
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
