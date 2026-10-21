// The motor quote — apps-script/MotorQuote.gs and motor-quote/index.html.
//
// What it promises, held here:
//   - a client signs in with their e-mail and a six-digit code, never a password;
//   - an existing client is read from Salesforce by that e-mail: contact, motor
//     policies, vehicles (two years of one vehicle merge, a blank never erasing);
//   - a new e-mail signs in too, with nothing filled in;
//   - a request missing what the quote needs is refused whole;
//   - the signed-in e-mail is the client's e-mail whatever the form says;
//   - in test mode nothing reaches the quotes desk and Salesforce is never written;
//   - live, one e-mail goes to CRMSQuotes from support@ with the branch copied and
//     the documents attached, a Contact is created for a new client, a task opens;
//   - the client's own requests come back on sign-in;
//   - the page and the home page point at the new address, not the JotForm.
//
// Invented names and numbers throughout. The repository is public.
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/MotorQuote.gs');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

/* ── a fake Salesforce and a fake Microsoft ───────────────────────── */
function world(props) {
  const SF = {
    contacts: [{ Id: '003000000000001AAA', Name: 'Anika Pretend', FirstName: 'Anika', LastName: 'Pretend', Email: 'anika@example.com',
      Preferred_Email__c: null, MobilePhone: '868-555-0101', Phone: null, Title: 'TEACHER', Birthdate: '1988-04-12', Contact_Type__c: 'Client' }],
    portfolios: [{ POLICY__c: 'TTMV00000001', Product_Name__c: 'Private Motor', Expiry_Date__c: '2027-01-31', Date_Of_Birth__c: '1988-04-12',
      Occupation__c: null, Contact__c: '003000000000001AAA', RecordType: { Name: 'MOTOR' } }],
    risks: [
      { Policy__c: 'TTMV00000001', Vehicle__c: 'PDX 1234', Vehicle_Make__c: 'Toyota', Model__c: 'Aqua', Year_of_Manufacture__c: 2019, Chassis__c: null,
        Engine__c: null, Motor_Vehicle_Coverage_Type__c: 'Comprehensive', Cover1__c: 95000, Windscreen__c: 'Yes', Carrier__c: 'Guardian General',
        From__c: '2026-02-01', To__c: '2027-01-31', Vehicle_Status__c: 'Active' },
      { Policy__c: 'TTMV00000001', Vehicle__c: 'PDX1234', Vehicle_Make__c: null, Model__c: null, Year_of_Manufacture__c: null, Chassis__c: 'CH-SAMPLE-1',
        Engine__c: 'EN-1', Motor_Vehicle_Coverage_Type__c: null, Cover1__c: null, Windscreen__c: null, Carrier__c: null,
        From__c: '2025-02-01', To__c: '2026-01-31', Vehicle_Status__c: null },
    ],
    created: [], queries: [],
  };
  const MS = { sent: [] };
  const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body) });
  const env = makeEnv({ props });
  env.UrlFetchApp = { fetch: (url, o) => {
    o = o || {};
    if (/login\.microsoftonline/.test(url)) return res(200, { access_token: 'ms' });
    if (/graph\.microsoft\.com/.test(url)) { MS.sent.push(JSON.parse(o.payload)); return res(202, ''); }
    if (/oauth2\/token/.test(url)) return res(200, { access_token: 'tok', instance_url: 'https://sf.example' });
    const m = url.match(/\/services\/data\/v[\d.]+(\/.*)$/); const p = m[1];
    if (p.startsWith('/query?q=')) {
      const q = decodeURIComponent(p.slice(9)); SF.queries.push(q);
      const email = (q.match(/Email(?:__c)? = '([^']+)'/) || [])[1];
      if (/FROM Contact/.test(q)) return res(200, { records: SF.contacts.filter(c => c.Email === email) });
      if (/FROM CLIENT_PORTFOLIO__c/.test(q)) { const ids = (q.match(/Contact__c IN \(([^)]*)\)/) || [, ''])[1];
        return res(200, { records: SF.portfolios.filter(r => ids.indexOf(r.Contact__c) > -1) }); }
      if (/FROM Risk_Details__c/.test(q)) { const ids = (q.match(/Insured__c IN \(([^)]*)\)/) || [, ''])[1];
        return res(200, { records: ids ? SF.risks : [] }); }
      return res(400, [{ message: 'unexpected query ' + q }]);
    }
    if (p === '/sobjects/Contact' && o.method === 'post') { const b = JSON.parse(o.payload); SF.created.push({ obj: 'Contact', body: b }); return res(201, { id: '003000000000009AAA' }); }
    if (p === '/sobjects/Task' && o.method === 'post') { const b = JSON.parse(o.payload); SF.created.push({ obj: 'Task', body: b }); return res(201, { id: '00T000000000001AAA' }); }
    return res(404, [{ message: 'no route ' + p }]);
  } };
  /* What the harness does not fake and the script uses. */
  env.Utilities.DigestAlgorithm = { SHA_256: 'sha256' }; env.Utilities.Charset = { UTF_8: 'utf8' };
  env.Utilities.computeDigest = (alg, s) => Array.from(require('crypto').createHash('sha256').update(String(s)).digest());
  env.Utilities.base64Decode = s => Array.from(Buffer.from(String(s), 'base64'));
  env.Utilities.newBlob = (bytes, type, name) => ({ getBytes: () => bytes, getContentType: () => type, getName: () => name });
  env.Utilities.base64Encode = b => Buffer.from(Array.isArray(b) ? b : String(b)).toString('base64');
  /* The harness's formatDate knows a few patterns; the reference needs yyMMdd and the Drive folder yyyy. */
  const fmt0 = env.Utilities.formatDate;
  env.Utilities.formatDate = (d, tz, f) => { const p = n => String(n).padStart(2, '0');
    if (f === 'yyMMdd') return String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate());
    if (f === 'yyyy') return String(d.getFullYear());
    return fmt0(d, tz, f); };
  const drive = { files: [] };
  const folder = name => ({ getId: () => 'f-' + name, getUrl: () => 'https://drive.example/' + encodeURIComponent(name),
    getFoldersByName: () => ({ hasNext: () => false }), createFolder: n => folder(n),
    createFile: b => { drive.files.push(b.getName()); return { getId: () => 'file-' + drive.files.length }; } });
  env.DriveApp = { getFoldersByName: () => ({ hasNext: () => false }), createFolder: n => folder(n), getFolderById: id => folder(id) };
  env.Math.random = () => 0.123456;                 // the code is always 211110
  const mails = [];
  env.MailApp = { sendEmail: o => mails.push(o) };
  return { env, SF, MS, mails, drive };
}
const post = (env, body) => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(Object.assign({ siteKey: 'rrb-motor-quote-1' }, body)) } }).getContent());
const SFPROPS = { SF_KEY: 'k', SF_SECRET: 's', SF_LOGIN_URL: 'https://sf.example', MQ_TEST_INBOX: 'test@example.com' };
const GOOD = { name: 'Anika Pretend', mobile: '868-555-0101', gender: 'Female', dob: '1988-04-12', occupation: 'Teacher', ownerType: 'Individual',
  reg: 'pdx 1234', make: 'Toyota', model: 'Aqua', year: '2019', body: 'Hatchback', seating: '5', cc: '1500', value: '95,000', condition: 'Used',
  mortgaged: 'Yes', institution: 'Sample Credit Union', cover: 'Comprehensive', windscreen: 'Yes', ncd: '3 years', drivingYears: '9',
  prevInsurer: 'Another Insurer', permit: 'DP-000000', permitIssued: '2017-05-01', permitExpires: '2027-05-01', accidents: 'No',
  email: 'someone-else@example.com' };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');

/* ── the gate ────────────────────────────────────────────────────── */
{
  const { env } = world(SFPROPS);
  const bad = JSON.parse(env.doPost({ postData: { contents: JSON.stringify({ action: 'ping', siteKey: 'wrong' }) } }).getContent());
  ok('a stale page (wrong site key) is refused', bad.ok === false && /out of date/.test(bad.error));
  const p = post(env, { action: 'ping' });
  ok('ping says test mode, Salesforce linked, Graph not', p.ok && p.mode === 'test' && p.salesforce === true && p.graph === false);
  ok('ping names the quotes desk', p.quotesTo === 'CRMSQuotes@guardianonline.onmicrosoft.com');
}

/* ── sign-in ─────────────────────────────────────────────────────── */
{
  const { env, mails } = world(SFPROPS);
  ok('a half e-mail gets no code', post(env, { action: 'requestCode', email: 'anika@' }).ok === false);
  const r = post(env, { action: 'requestCode', email: 'Anika@Example.com' });
  ok('a code is sent and the answer names the inbox', r.ok && r.sent && /anika@example.com/.test(r.message));
  ok('in test mode the code goes to the test inbox, subject marked', mails.length === 1 && mails[0].to === 'test@example.com' && /^\[TEST\] 211110 is your/.test(mails[0].subject));
  ok('the test banner says who it was for', /would go to <b>anika@example.com/.test(mails[0].htmlBody));
  for (let i = 0; i < 5; i++) post(env, { action: 'requestCode', email: 'anika@example.com' });
  ok('at most four codes an hour: the fifth and sixth send nothing, same answer', mails.length === 4);
  const wrong = post(env, { action: 'verifyCode', email: 'anika@example.com', code: '000000' });
  ok('a wrong code is refused', wrong.ok === false && /did not match/.test(wrong.error));
  const v = post(env, { action: 'verifyCode', email: 'anika@example.com', code: '211 110' });
  ok('the right code (digits only) opens a session', v.ok && typeof v.token === 'string' && v.token.length >= 20);
  ok('an existing client is found: name, mobile, occupation in title case, date of birth', v.me.found && v.me.name === 'Anika Pretend' && v.me.mobile === '868-555-0101' && v.me.occupation === 'Teacher' && v.me.dob === '1988-04-12');
  ok('one motor policy comes back', v.me.policies.length === 1 && v.me.policies[0].policy === 'TTMV00000001');
  ok('two years of one vehicle merge into one, newest cover first, blanks never erasing', v.me.vehicles.length === 1 &&
    v.me.vehicles[0].make === 'Toyota' && v.me.vehicles[0].cover === 'Comprehensive' && v.me.vehicles[0].chassis === 'CH-SAMPLE-1' && v.me.vehicles[0].to === '2027-01-31');
  ok('no requests yet', Array.isArray(v.requests) && v.requests.length === 0);
  const again = post(env, { action: 'verifyCode', email: 'anika@example.com', code: '211110' });
  ok('a code works once', again.ok === false && /expired/.test(again.error));
  const me = post(env, { action: 'me', token: v.token });
  ok('the session reads the client again', me.ok && me.me.found);
  ok('sign out ends it', post(env, { action: 'signOut', token: v.token }).ok && post(env, { action: 'me', token: v.token }).signedOut === true);
  ok('a token nobody issued is refused', post(env, { action: 'me', token: 'x'.repeat(48) }).signedOut === true);

  post(env, { action: 'requestCode', email: 'newperson@example.com' });
  const n = post(env, { action: 'verifyCode', email: 'newperson@example.com', code: '211110' });
  ok('a new e-mail signs in with nothing filled in', n.ok && n.me.found === false && n.me.vehicles.length === 0 && n.me.name === '');
}

/* ── no Salesforce at all ────────────────────────────────────────── */
{
  const { env } = world({ MQ_TEST_INBOX: 'test@example.com' });
  post(env, { action: 'requestCode', email: 'anika@example.com' });
  const v = post(env, { action: 'verifyCode', email: 'anika@example.com', code: '211110' });
  ok('without SF_* the sign-in still opens, nothing pre-filled, and says Salesforce is not linked', v.ok && v.me.found === false && v.me.salesforce === false);
}

/* ── the request, test mode ─────────────────────────────────────── */
{
  const { env, SF, MS, mails, drive } = world(SFPROPS);
  post(env, { action: 'requestCode', email: 'anika@example.com' });
  const tok = post(env, { action: 'verifyCode', email: 'anika@example.com', code: '211110' }).token;
  mails.length = 0;
  const miss = post(env, { action: 'submit', token: tok, quote: { name: 'Anika Pretend' } });
  ok('a request missing what the quote needs is refused, naming the fields', miss.ok === false && /Mobile/.test(miss.error) && /Vehicle #/.test(miss.error) && /Cover type/.test(miss.error));
  const co = post(env, { action: 'submit', token: tok, quote: Object.assign({}, GOOD, { ownerType: 'Company' }) });
  ok('a company-owned vehicle needs the company name', co.ok === false && /company name/.test(co.error));
  const badf = post(env, { action: 'submit', token: tok, quote: GOOD, files: [{ kind: 'permit', name: 'x.exe', type: 'application/x-msdownload', data: PNG }] });
  ok('a file that is not a photo or a PDF is refused whole, nothing filed', badf.ok === false && /not a photo/.test(badf.error) && env.__sheets['Motor Quotes'].getLastRow() === 1);
  const r = post(env, { action: 'submit', token: tok, quote: GOOD, files: [{ kind: 'permit', name: 'permit.jpg', type: 'image/jpeg', data: PNG }] });
  ok('a full request is accepted with a reference', r.ok && /^MQ-\d{6}-001$/.test(r.ref), r.error || '');
  ok('test mode says so, and the contact would be created, not created', r.mode === 'test' && /Existing/.test(r.contact));
  const sh = env.__sheets['Motor Quotes'], hdr = sh._grid[0], row = sh._grid[1], col = n => row[hdr.indexOf(n)];
  ok('one row on Motor Quotes: the signed-in e-mail, not the form\'s', col('Email') === 'anika@example.com' && col('Client') === 'Anika Pretend');
  ok('the registration is upper-cased and the value is a number', col('Vehicle #') === 'PDX 1234' && col('Value') === '95000');
  ok('the status says where it is', col('Status') === 'Sent to quotes desk' && col('Sent to') === 'CRMSQuotes@guardianonline.onmicrosoft.com');
  ok('the document is in Drive and on Quote Files', drive.files.length === 1 && col('Files') === 'permit: permit.jpg' && env.__sheets['Quote Files'].getLastRow() === 2);
  const desk = mails.find(m => /Motor quote request/.test(m.subject)), rcpt = mails.find(m => /We have your motor quote request/.test(m.subject));
  ok('two e-mails: the desk\'s and the client\'s receipt', mails.length === 2 && desk && rcpt);
  ok('in test mode both go to the test inbox only, marked', desk.to === 'test@example.com' && rcpt.to === 'test@example.com' && /^\[TEST\]/.test(desk.subject) && !desk.cc);
  ok('the desk e-mail names who it would have gone to, with the copies', /CRMSQuotes@guardianonline.onmicrosoft.com/.test(desk.htmlBody) && /rickyrampersadsalessupport@myguardiangroup.com/.test(desk.htmlBody));
  ok('the desk e-mail carries the facts and the attachment', /Sample Credit Union/.test(desk.htmlBody) && /TT\$ 95,000/.test(desk.htmlBody) && desk.attachments && desk.attachments.length === 1);
  ok('the desk e-mail carries the hosted gold shield, never a data URI', /rickyrampersadbranch\.com\/logo-mark\.png/.test(desk.htmlBody) && !/data:image/.test(desk.htmlBody));
  ok('the receipt carries the reference and what happens next', new RegExp(r.ref).test(rcpt.htmlBody) && /What happens next/.test(rcpt.htmlBody));
  ok('Salesforce was read, never written, in test mode', SF.created.length === 0 && MS.sent.length === 0 && col('SF task') === '');
  ok('the client\'s requests come back with the new one first', r.requests.length === 1 && r.requests[0].ref === r.ref && r.requests[0].status === 'Sent to quotes desk');
  const r2 = post(env, { action: 'submit', token: tok, quote: GOOD });
  ok('the next request of the day is -002', r2.ok && /-002$/.test(r2.ref));
  const log = env.__sheets['Quote Log']._grid.map(x => x[2]);
  ok('the log has the sign-in, the receipt and the send', log.indexOf('client-signed-in') > -1 && log.indexOf('received') > -1 && log.indexOf('sent') > -1);
}

/* ── the request, live, a new client, support@ through Graph ─────── */
{
  const props = Object.assign({}, SFPROPS, { MQ_MODE: 'live', MS_TENANT: 't', MS_CLIENT: 'c', MS_SECRET: 's', MQ_SF_OWNER: '005000000000001AAA' });
  const { env, SF, MS, mails } = world(props);
  post(env, { action: 'requestCode', email: 'newperson@example.com' });
  ok('live, the code goes to the client through Graph from support@', MS.sent.length === 1 && MS.sent[0].message.toRecipients[0].emailAddress.address === 'newperson@example.com' && mails.length === 0);
  const tok = post(env, { action: 'verifyCode', email: 'newperson@example.com', code: '211110' }).token;
  MS.sent.length = 0;
  const r = post(env, { action: 'submit', token: tok, quote: Object.assign({}, GOOD, { name: 'Dev Madeup', agentEmail: 'agent@example.com', agent: 'An Agent' }),
    files: [{ kind: 'permit', name: 'permit.jpg', type: 'image/jpeg', data: PNG }, { kind: 'certified', name: 'copy.pdf', type: 'application/pdf', data: PNG }] });
  ok('live request accepted', r.ok, r.error || '');
  const contact = SF.created.find(c => c.obj === 'Contact'), task = SF.created.find(c => c.obj === 'Task');
  ok('a new client becomes a Contact when the request is sent: name split, e-mail, mobile, owner', contact && contact.body.FirstName === 'Dev' && contact.body.LastName === 'Madeup' &&
    contact.body.Email === 'newperson@example.com' && contact.body.MobilePhone === '868-555-0101' && contact.body.OwnerId === '005000000000001AAA' && r.contact === 'Created');
  ok('a task opens on the new Contact, due two working days on, naming the vehicle', task && task.body.WhoId === '003000000000009AAA' && /Motor quote MQ-.*2019 Toyota Aqua \(PDX 1234\)/.test(task.body.Subject) &&
    /^\d{4}-\d{2}-\d{2}$/.test(task.body.ActivityDate) && task.body.Status === 'In Progress');
  const desk = MS.sent.find(m => /Motor quote request/.test(m.message.subject)), rcpt = MS.sent.find(m => /We have your motor quote request/.test(m.message.subject));
  ok('two e-mails through Graph, nothing through Gmail', MS.sent.length === 2 && desk && rcpt && mails.length === 0);
  ok('the desk e-mail goes to CRMSQuotes, copied to sales support, support@ and the agent, reply-to support@',
    desk.message.toRecipients.map(x => x.emailAddress.address).join() === 'CRMSQuotes@guardianonline.onmicrosoft.com' &&
    desk.message.ccRecipients.map(x => x.emailAddress.address).sort().join() === ['agent@example.com', 'rickyrampersadsalessupport@myguardiangroup.com', 'support@rickyrampersadbranch.com'].join() &&
    desk.message.replyTo[0].emailAddress.address === 'support@rickyrampersadbranch.com');
  ok('both documents travel on the desk e-mail as attachments', desk.message.attachments.length === 2 && desk.message.attachments.every(a => a['@odata.type'] === '#microsoft.graph.fileAttachment' && a.contentBytes));
  ok('no test banner live', !/TEST MODE/.test(desk.message.body.content) && !/^\[TEST\]/.test(desk.message.subject));
  ok('the receipt goes to the client alone', rcpt.message.toRecipients[0].emailAddress.address === 'newperson@example.com' && rcpt.message.ccRecipients.length === 0);
  const sh = env.__sheets['Motor Quotes'], hdr = sh._grid[0], row = sh._grid[1];
  ok('the row holds the Contact id, the task id and the mail result', row[hdr.indexOf('Contact Id')] === '003000000000009AAA' && row[hdr.indexOf('SF task')] === '00T000000000001AAA' && /support@/.test(row[hdr.indexOf('Mail result')]));
}

/* ── live, a client already on file is never created twice ───────── */
{
  const { env, SF } = world(Object.assign({}, SFPROPS, { MQ_MODE: 'live' }));
  post(env, { action: 'requestCode', email: 'anika@example.com' });
  const tok = post(env, { action: 'verifyCode', email: 'anika@example.com', code: '211110' }).token;
  const r = post(env, { action: 'submit', token: tok, quote: GOOD });
  ok('an existing client keeps their Contact; only the task is created', r.ok && r.contact === 'Existing' && SF.created.length === 1 && SF.created[0].obj === 'Task');
}

/* ── the pages ───────────────────────────────────────────────────── */
{
  const page = fs.readFileSync(path.join(ROOT, 'motor-quote/index.html'), 'utf8');
  const gs = fs.readFileSync(path.join(ROOT, 'apps-script/MotorQuote.gs'), 'utf8');
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const key = (gs.match(/SITE_KEY: '([^']+)'/) || [])[1];
  ok('the page and the script share one site key', key && page.indexOf('SITE_KEY: "' + key + '"') > -1);
  ok('the page carries the gold shield and the view beacon', /logo-mark\.png/.test(page) && /rrb-views/.test(page) && /script\.google\.com\/macros\/s\//.test(page));
  ok('the page sends every request as text/plain (no CORS preflight)', /text\/plain;charset=utf-8/.test(page));
  ok('the home page points at the new address, and the Motor Quotation JotForm is gone from it', home.indexOf('href="/motor-quote/"') > -1 && home.indexOf('jotform.com/223376649264061') < 0);
  ok('the short address forwards', /location\.replace\('\/motor-quote\/'/.test(fs.readFileSync(path.join(ROOT, 'motorquote/index.html'), 'utf8')));
  const jot = ['Client Name', 'Client Email', 'How Long have you been driving', 'no claim discount', 'Mobile', 'Cover Type', 'Vehicle #', 'Vehicle Value', 'Previous Insurer',
    'Make', 'Model', 'Body Type', 'Seating', 'CC', 'Gender', 'Occupation', 'Permit Issue', 'Permit Expiry', 'Accidents', 'existing vehicles', 'Other Notes', 'Certified Copy',
    'DP', 'permit #', 'Year of Manufacture', 'Mortgage', 'Financial Institution', 'Agent Name', 'Windscreen', 'existing Motor Policy', 'Company Owned', 'Company Name', 'Company Email'];
  const keys = ['name', 'email', 'drivingYears', 'ncd', 'mobile', 'cover', 'reg', 'value', 'prevInsurer', 'make', 'model', 'body', 'seating', 'cc', 'gender', 'occupation',
    'permitIssued', 'permitExpires', 'accidents', 'existingVehicles', 'notes', 'certified', 'permit', 'permit', 'year', 'mortgaged', 'institution', 'agent', 'windscreen', 'existingPolicy', 'ownerType', 'company', 'companyEmail'];
  const missing = keys.filter(k => page.indexOf("'" + k + "'") < 0 && page.indexOf('"' + k + '"') < 0);
  ok('every question the JotForm asked is asked on the page', missing.length === 0, missing.join(', '));
  ok('no client name in the script or the page', !/Rampersad\b(?! Branch)/.test(gs.replace(/Ricky Rampersad Branch/g, '')) && !/@gmail\.com|@hotmail\.com|@yahoo\.com/.test(gs + page));
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
