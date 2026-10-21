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
function world(props, opts) {
  opts = opts || {};
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
  if (opts.risks) SF.risks = opts.risks;
  const AI = { calls: [], answer: opts.ai || null, code: opts.aiCode || 200 };
  const MS = { sent: [] };
  const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body) });
  const env = makeEnv({ props });
  env.UrlFetchApp = { fetch: (url, o) => {
    o = o || {};
    if (/api\.anthropic\.com/.test(url)) { AI.calls.push({ headers: o.headers, body: JSON.parse(o.payload) });
      return AI.code !== 200 ? res(AI.code, { error: { message: 'overloaded' } }) : res(200, { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(AI.answer) }] }); }
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
      if (/FROM Risk_Details__c/.test(q) && opts.noRenewFields && /Next_Renewal_Date__c/.test(q)) return res(400, [{ message: "No such column 'Next_Renewal_Date__c'" }]);
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
  return { env, SF, MS, mails, drive, AI };
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
  ok('the desk e-mail carries the hosted blue shield, never a data URI', /rickyrampersadbranch\.com\/orphan-transition\/board-mark\.png/.test(desk.htmlBody) && !/data:image/.test(desk.htmlBody));
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

/* ── the invoice: read by Claude, the document is data ──────────────── */
const INVOICE = { docType: 'dealer quotation', dealer: 'Sample Motors Ltd', documentNo: 'Q-1001', documentDate: '2026-10-15', make: 'MG', model: 'ZS HEV Lux',
  year: '2026 MODEL', bodyType: 'SUV', engineCc: '1,498', fuel: 'HEV', condition: 'new', value: '212,644.50', valueBasis: 'Sub-total before fees',
  reg: '', chassis: '', engineNo: '', seats: '5', colour: '', buyerName: 'MADE UP BUYER', buyerPhone: '754-0000', buyerAddress: '1 Pretend Road', lender: '', notes: '' };
const signIn = (env, email) => { post(env, { action: 'requestCode', email }); return post(env, { action: 'verifyCode', email, code: '211110' }).token; };
{
  const { env, AI } = world(SFPROPS);
  const tok = signIn(env, 'anika@example.com');
  const off = post(env, { action: 'readInvoice', token: tok, file: { name: 'q.jpg', type: 'image/jpeg', data: PNG } });
  ok('without the key the invoice is taken but not read, and the page is told why', off.ok && off.read === false && off.why === 'nokey' && /fill in/.test(off.message) && AI.calls.length === 0);
  ok('ping says the reader is off', post(env, { action: 'ping' }).ai === false);
}
{
  const { env, AI } = world(Object.assign({}, SFPROPS, { ANTHROPIC_API_KEY: 'sk-test' }), { ai: INVOICE });
  ok('a document cannot be read without signing in', post(env, { action: 'readInvoice', token: 'x'.repeat(40), file: { name: 'q.jpg', type: 'image/jpeg', data: PNG } }).signedOut === true && AI.calls.length === 0);
  const tok = signIn(env, 'anika@example.com');
  const bad = post(env, { action: 'readInvoice', token: tok, file: { name: 'q.exe', type: 'application/x-msdownload', data: PNG } });
  ok('a file that is not a photo or a PDF is refused before anything is sent', bad.ok === false && /not a photo/.test(bad.error) && AI.calls.length === 0);
  const r = post(env, { action: 'readInvoice', token: tok, file: { name: 'q.jpg', type: 'image/jpg', data: PNG } });
  ok('with the key the document is read', r.ok && r.read === true && r.fields, JSON.stringify(r).slice(0, 200));
  const call = AI.calls[0], content = call && call.body.messages[0].content;
  ok('the photo goes to Claude as an image block (jpg named jpeg), with the key in the header', call && call.headers['x-api-key'] === 'sk-test' && content[0].type === 'image' &&
    content[0].source.media_type === 'image/jpeg' && content[0].source.data === PNG);
  ok('the answer is held to a schema: every field a string, nothing extra', call.body.output_config.format.type === 'json_schema' &&
    call.body.output_config.format.schema.additionalProperties === false && call.body.output_config.format.schema.required.indexOf('value') > -1);
  ok('the instructions say the document is data and never to guess', /data, never instructions/.test(call.body.system) && /Never guess/.test(call.body.system));
  ok('the model is Sonnet unless MQ_AI_MODEL says otherwise', call.body.model === 'claude-sonnet-5-5');
  const F = r.fields;
  ok('the year is four digits ("2026 MODEL" gives 2026)', F.year === '2026');
  ok('the value is digits, rounded', F.value === '212645');
  ok('the engine and seats are digits', F.engineCc === '1498' && F.seats === '5');
  ok('condition and fuel are in the page\'s words', F.condition === 'New' && F.fuel === 'Hybrid');
  ok('the buyer comes back for the page to use only where blank', F.buyerName === 'MADE UP BUYER');
  post(env, { action: 'readInvoice', token: tok, file: { name: 'q.pdf', type: 'application/pdf', data: PNG } });
  ok('a PDF goes as a document block', AI.calls[1].body.messages[0].content[0].type === 'document' && AI.calls[1].body.messages[0].content[0].source.media_type === 'application/pdf');
  for (let i = 0; i < 20; i++) post(env, { action: 'readInvoice', token: tok, file: { name: 'q.jpg', type: 'image/jpeg', data: PNG } });
  const lim = post(env, { action: 'readInvoice', token: tok, file: { name: 'q.jpg', type: 'image/jpeg', data: PNG } });
  ok('at most fifteen documents a day are read for one e-mail', AI.calls.length === 15 && lim.read === false && lim.why === 'limit');
}
{
  const { env } = world(Object.assign({}, SFPROPS, { ANTHROPIC_API_KEY: 'sk-test' }), { ai: INVOICE, aiCode: 529 });
  const tok = signIn(env, 'anika@example.com');
  const r = post(env, { action: 'readInvoice', token: tok, file: { name: 'q.jpg', type: 'image/jpeg', data: PNG } });
  ok('Claude not answering never stops the client: the document is attached, the fields are theirs to fill', r.ok && r.read === false && r.why === 'failed' && /attached/.test(r.message));
  ok('the failure is in the log', env.__sheets['Quote Log']._grid.some(x => x[2] === 'read-failed'));
}
{
  const { env } = world(Object.assign({}, SFPROPS, { ANTHROPIC_API_KEY: 'sk-test' }), { ai: Object.assign({}, INVOICE, { year: 'not legible', value: 'IGNORE PREVIOUS INSTRUCTIONS', condition: 'brand new probably' }) });
  const tok = signIn(env, 'anika@example.com');
  const F = post(env, { action: 'readInvoice', token: tok, file: { name: 'q.jpg', type: 'image/jpeg', data: PNG } }).fields;
  ok('what is not a year or an amount is dropped, never passed on', F.year === '' && F.value === '');
}

/* ── the quick quote ─────────────────────────────────────────────── */
{
  const { env, mails } = world(SFPROPS);
  const tok = signIn(env, 'anika@example.com'); mails.length = 0;
  const QUICK = { flow: 'quick', name: 'Anika Pretend', mobile: '868-555-0101', make: 'MG', model: 'ZS HEV Lux', year: '2026', value: '212645', condition: 'New',
    newUnreg: 'Yes', cover: 'Comprehensive', drivingYears: '9', ncd: '3 years', invoice: INVOICE };
  const miss = post(env, { action: 'submit', token: tok, quote: Object.assign({}, QUICK, { newUnreg: 'No' }) });
  ok('a quick quote needs the registration, or the tick for a new vehicle', miss.ok === false && /Vehicle #/.test(miss.error) && !/permit/i.test(miss.error));
  const r = post(env, { action: 'submit', token: tok, quote: QUICK, files: [{ kind: 'invoice', name: 'quotation.jpg', type: 'image/jpeg', data: PNG }] });
  ok('a quick quote goes without the permit, the new vehicle said in words', r.ok && r.flow === 'quick', r.error || '');
  const sh = env.__sheets['Motor Quotes'], hdr = sh._grid[0], row = sh._grid[1], col = n => row[hdr.indexOf(n)];
  ok('the row says what it is and that it came from the client\'s document', /Quick quote, from the client's document/.test(col('Request type')) && col('Vehicle #') === 'Not registered yet');
  ok('what the document said is on the row, for the desk', /Sample Motors Ltd/.test(col('Invoice read')) && /TT\$ 212,645/.test(col('Invoice read')) && /Hybrid|HEV/.test(col('Invoice read')));
  const desk = mails.find(m => /Motor quote request/.test(m.subject));
  ok('the desk e-mail says quick quote, attaches the document, and says it was read by machine and checked by the client',
    /quick quote/.test(desk.subject) && /quick quote/.test(desk.htmlBody) && /read by machine and checked by the client/.test(desk.htmlBody) && desk.attachments.length === 1);
  const rcpt = mails.find(m => /We have your motor quote request/.test(m.subject));
  ok('the receipt says the permit comes when the quote is taken', /driver's permit/.test(rcpt.htmlBody.replace(/&#39;/g, "'")));
  const full = post(env, { action: 'submit', token: tok, quote: Object.assign({}, GOOD, { flow: 'full', permit: '' }) });
  ok('the full door still needs the permit', full.ok === false && /permit/i.test(full.error));
}

/* ── the renewal: first, with its history, read again at the send ─── */
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const RISKS = [
  { Policy__c: 'TTMV00000001', Vehicle__c: 'PDX 1234', Vehicle_Make__c: 'Toyota', Model__c: 'Aqua', Year_of_Manufacture__c: 2019, Motor_Vehicle_Coverage_Type__c: 'Comprehensive',
    Cover1__c: 95000, Windscreen__c: null, Carrier__c: 'Guardian General', From__c: day(-345), To__c: day(20), Next_Renewal_Date__c: day(21), Premium_Due__c: 4321.5 },
  { Policy__c: 'TTMV00000001', Vehicle__c: 'PDX1234', Motor_Vehicle_Coverage_Type__c: 'Comprehensive', Cover1__c: 95000, From__c: day(-345), To__c: day(20) },   // the same term twice
  { Policy__c: 'TTMV00000001', Vehicle__c: 'PDX 1234', Motor_Vehicle_Coverage_Type__c: 'Comprehensive', Cover1__c: 95000, From__c: day(-710), To__c: day(-346), Premium_Due__c: 4100 },
  { Policy__c: 'TTMV00000001', Vehicle__c: 'PDX 1234', Motor_Vehicle_Coverage_Type__c: 'Third Party', Cover1__c: 0, From__c: day(-1075), To__c: day(-711) },
  { Policy__c: 'TTMV00000002', Vehicle__c: 'TDA 77', Vehicle_Make__c: 'Nissan', Model__c: 'Note', Year_of_Manufacture__c: 2016, Motor_Vehicle_Coverage_Type__c: 'Third Party',
    Cover1__c: 40000, Windscreen__c: 'Yes', From__c: day(-100), To__c: day(265) },
];
{
  const { env } = world(SFPROPS, { risks: RISKS });
  const v = post(env, { action: 'verifyCode', email: 'anika@example.com', code: (post(env, { action: 'requestCode', email: 'anika@example.com' }), '211110') });
  const vs = v.me.vehicles, a = vs[0];
  ok('the vehicle due comes first, the later one after', vs.length === 2 && a.reg === 'PDX 1234' && a.renewState === 'due' && vs[1].renewState === 'later');
  ok('it renews on Next_Renewal_Date__c when that sits by the end date, in so many days', a.renewOn === day(21) && a.renewIn === 21 && /\d+ \w+ \d{4}/.test(a.renewOnText));
  ok('the same term twice on file counts once: three terms, newest first', a.terms.length === 3 && a.terms[0].to === day(20) && a.terms[2].cover === 'Third Party');
  ok('the premium on file comes with the term', a.lastPremium === 4321.5 && a.terms[1].premium === 4100);
  const f = a.facts.join(' | ');
  ok('the record shows: with us since, the vehicle\'s age, the same value two terms running', /With us since \d{4}: 3 terms on file/.test(f) && /A 2019 vehicle: \d+ years old at renewal/.test(f) && /TT\$ 95,000 on each of the last 2 terms/.test(f));
  ok('the record shows: the cover change, the premium, no windscreen cover', /cover changed from Third Party to Comprehensive/.test(f) && /Premium on file for this term: TT\$ 4,322/.test(f) && /No windscreen cover on file/.test(f));
  ok('every line is a fact, never advice', !/should|recommend|advise|must/i.test(f));
  ok('a vehicle with windscreen cover is not told it has none', !/windscreen/i.test(vs[1].facts.join(' ')));

  const tok = v.token;
  const none = post(env, { action: 'submit', token: tok, quote: { flow: 'renew', name: 'Anika Pretend', mobile: '868-555-0101', reg: 'PDX 1234' } });
  ok('a renewal needs the choice', none.ok === false && /client asks/.test(none.error));
  const chg = post(env, { action: 'submit', token: tok, quote: { flow: 'renew', name: 'Anika Pretend', mobile: '868-555-0101', reg: 'PDX 1234', renewChoice: 'Renew with changes' } });
  ok('with changes needs the changes', chg.ok === false && /changed/.test(chg.error));
}
{
  const { env, mails } = world(Object.assign({}, SFPROPS, { MQ_RENEW_TO: 'renewals@example.com' }), { risks: RISKS });
  const tok = signIn(env, 'anika@example.com'); mails.length = 0;
  const r = post(env, { action: 'submit', token: tok, quote: { flow: 'renew', name: 'Anika Pretend', mobile: '868-555-0101', reg: 'pdx1234', renewChoice: 'Renew as it is',
    renewOnText: '1 January 1999', lastPremium: 1 } });
  ok('a renewal goes as it is, with nothing else typed', r.ok && r.flow === 'renew' && r.sentTo === 'renewals@example.com', r.error || '');
  const desk = mails.find(m => /Motor renewal request/.test(m.subject));
  ok('the subject says renewal, the vehicle, when it renews and what the client asks', desk && /2019 Toyota Aqua \(PDX 1234\) · renews \d+ \w+ \d{4} · Renew as it is · Anika Pretend/.test(desk.subject));
  ok('the date and the premium come from Salesforce, never from the page', !/1999/.test(desk.htmlBody) && /TT\$ 4,322/.test(desk.htmlBody));
  ok('the desk gets every term on file and what the record shows', /Third Party/.test(desk.htmlBody) && /With us since/.test(desk.htmlBody) && /TT\$ 95,000/.test(desk.htmlBody));
  ok('MQ_RENEW_TO is named in the test banner', /renewals@example.com/.test(desk.htmlBody));
  const rcpt = mails.find(m => /We have your renewal request/.test(m.subject));
  ok('the receipt is a renewal receipt with the date', rcpt && /renews on <b>\d+ \w+ \d{4}<\/b>/.test(rcpt.htmlBody));
  const sh = env.__sheets['Motor Quotes'], hdr = sh._grid[0], row = sh._grid[1], col = n => row[hdr.indexOf(n)];
  ok('the row holds the renewal: type, date, choice, premium, policy', col('Request type') === 'Renewal' && /\d{4}/.test(col('Renewal date')) && col('Renewal choice') === 'Renew as it is' &&
    col('Last premium') === 'TT$ 4,322' && col('Existing policy') === 'TTMV00000001');
  const other = post(env, { action: 'submit', token: tok, quote: { flow: 'renew', name: 'Anika Pretend', mobile: '868-555-0101', reg: 'ZZZ 999', renewChoice: 'Renew as it is' } });
  const d2 = mails.filter(m => /Motor renewal request/.test(m.subject))[1];
  ok('a vehicle not on file for this e-mail still goes, flagged for a check', other.ok && /not found on file/.test(d2.htmlBody));
}
{
  const { env } = world(SFPROPS, { risks: RISKS, noRenewFields: true });
  const v = post(env, { action: 'verifyCode', email: 'anika@example.com', code: (post(env, { action: 'requestCode', email: 'anika@example.com' }), '211110') });
  ok('an org without the renewal fields still gives the vehicles, renewing the day after the cover ends', v.me.vehicles.length === 2 && v.me.vehicles[0].renewOn === day(21) &&
    env.__sheets['Quote Log']._grid.some(x => x[2] === 'renewal-fields-failed'));
}

/* ── a tab made by the first version gains the new columns on the end ─ */
{
  const { env } = world(SFPROPS);
  const OLD = ['Ref', 'Received', 'Status', 'Client', 'Email', 'Mobile', 'Contact Id', 'Contact action', 'Agent', 'Agent e-mail', 'Owner type', 'Company', 'Company e-mail',
    'Vehicle #', 'Make', 'Model', 'Year', 'Body type', 'Seating', 'CC', 'Value', 'New or used', 'Mortgaged', 'Institution', 'Cover', 'Windscreen', 'Existing policy',
    'Existing GG vehicles', 'Previous insurer', 'NCD', 'Driving years', 'Gender', 'Date of birth', 'Occupation', 'Permit #', 'Permit issued', 'Permit expires', 'Accidents',
    'Accident details', 'Notes', 'Files', 'Drive folder', 'SF task', 'Sent to', 'Mail result', 'Quoted on', 'Quoted premium', 'Staff note'];
  env.__mkSheet('Motor Quotes', 1, OLD, [OLD.map((h, i) => i === 0 ? 'MQ-261020-001' : 'old')]);
  const tok = signIn(env, 'anika@example.com');
  const r = post(env, { action: 'submit', token: tok, quote: GOOD });
  const sh = env.__sheets['Motor Quotes'], hdr = sh._grid[0];
  ok('the old tab keeps its columns and gains the new ones on the end', r.ok && hdr.slice(0, OLD.length).join() === OLD.join() && hdr.indexOf('Request type') === OLD.length);
  const row = sh._grid[2];
  ok('the new row lands under the right headers, the old row untouched', row[hdr.indexOf('Vehicle #')] === 'PDX 1234' && row[hdr.indexOf('Request type')] === 'Quote, full details' && sh._grid[1][0] === 'MQ-261020-001');
}

/* ── taking the quote: the quotation, the certified copy, the permit read; the proposal sent ── */
const QUOTE_READ = { policyNo: 'TT APG 0000001', quoteNo: 'TTQT0000', insuredName: 'Anika Pretend', insuredAddress: '#1 Pretend Street, Couva', periodFrom: '2026-10-16',
  periodTo: '2027-10-15', cover: 'C', year: '2026', make: 'MG', model: 'ZS LUX', body: 'Crossover/ Crossover SUV/ CUV', seating: '5', cc: '1600', reg: '.', chassis: '.', engine: '.',
  sumInsured: '$ 213,387', premium: '8,270.51', tax: '496.23', total: '$8,766.74', ncd: '40%', discounts: '10% Anti-Theft, 40% NCD', antiTheft: 'yes', specialPerils: 'Yes',
  windscreenAll: 'Yes', windscreenLimit: '$10,000', windscreenFrontBack: '', windscreenFrontBackLimit: '', paPassengers: 'Yes', courtesyCar: 'Yes', agreedDepreciation: '',
  hospitalisation: '', excessWaiver: 'Yes', mechanical: '', mechanicalLevel: '', survivors: '', evBattery: 'maybe', evBatteryLimit: '', notes: '' };
const CERT_READ = { reg: 'pdz 9999', make: 'Jeep', model: 'Wrangler', description: '4DR GAS A/T 4WD', colour: 'Black', chassis: '1abcd23efg4567890', engine: 'eb0000000',
  cc: '1,956', seating: '5 INCL. DRIVER', year: '2020', body: 'SUV', fuel: 'GAS', ownerName: 'Anika Pretend', ownerAddress: '1 Pretend Street', notes: '' };
{
  const { env, AI } = world(Object.assign({}, SFPROPS, { ANTHROPIC_API_KEY: 'sk-test' }), { ai: QUOTE_READ });
  const tok = signIn(env, 'anika@example.com');
  const q = post(env, { action: 'readDoc', kind: 'quote', token: tok, file: { name: 'quote.pdf', type: 'application/pdf', data: PNG } });
  const F = q.fields || {};
  ok('the quotation is read with its own fields, and the instructions name it', q.ok && q.read && q.kind === 'quote' && /Quotation Schedule/.test(AI.calls[0].body.system) &&
    AI.calls[0].body.output_config.format.schema.required.indexOf('policyNo') > -1);
  ok('the quotation: "Cover : C" is Comprehensive, dates kept, money as numbers', F.cover === 'Comprehensive' && F.periodFrom === '2026-10-16' && F.total === '8766.74' && F.sumInsured === '213387' && F.windscreenLimit === '10000');
  ok('the quotation: a dot is no registration, chassis or engine', F.reg === '' && F.chassis === '' && F.engine === '');
  ok('the quotation: a benefit is Yes only when it says yes', F.specialPerils === 'Yes' && F.antiTheft === 'Yes' && F.evBattery === '' && F.hospitalisation === '');
  ok('an unknown kind of document is refused', post(env, { action: 'readDoc', kind: 'passport', token: tok, file: { name: 'p.jpg', type: 'image/jpeg', data: PNG } }).ok === false);
}
{
  const { env, AI } = world(Object.assign({}, SFPROPS, { ANTHROPIC_API_KEY: 'sk-test' }), { ai: CERT_READ });
  const tok = signIn(env, 'anika@example.com');
  const c = post(env, { action: 'readDoc', kind: 'certified', token: tok, file: { name: 'cc.pdf', type: 'application/pdf', data: PNG } }).fields || {};
  ok('the certified copy: chassis and engine exactly, upper-cased; seating as a number', c.chassis === '1ABCD23EFG4567890' && c.engine === 'EB0000000' && c.seating === '5' && c.cc === '1956' && c.reg === 'PDZ 9999');
  ok('the certified copy: GAS is the proposal\'s Gas, and only the current owner is asked for', c.fuel === 'Gas' && /CURRENT registered owner/.test(AI.calls[0].body.output_config.format.schema.properties.ownerName.description) &&
    /Never any earlier owner/.test(AI.calls[0].body.output_config.format.schema.properties.ownerName.description));
}
const PA = { title: 'Ms', first: 'Anika', surname: 'Pretend', dob: '1988-04-12', pob: 'San Fernando', nationality: 'Trinidad and Tobago', residence: 'Trinidad and Tobago', marital: 'Married',
  address: '1 Pretend Street, Couva', phone: '868-555-0101', occupation: 'Teacher', employer: 'A school', pep: 'No', permitNo: 'DP000000', permitIssued: '2010-05-01', permitClass: '1',
  otherGG: 'No', q3a: 'No', q3b: 'No', q4: 'Yes', fuel: 'Hybrid', reg: 'Not registered yet', makeModel: 'MG ZS LUX', chassis: 'LSJ000', engine: 'EN000', year: '2026', cc: '1600', seating: '5',
  body: 'SUV', sumInsured: '213387', acc: 'No', q6: 'No', cond: 'New', q7b: 'Yes', q7c: 'No', q7d: 'No', q7e: 'No', q8: 'Yes', q9: 'Yes', q9d: 'Factory immobiliser, October 2026',
  q10: 'Locked garage', q11: 'No', q12: 'No', q13: 'Yes', q13d: 'PDX 1234 with Another Insurer', q14a: 'No', q14b: 'No', q14c: 'No', q15: 'Yes',
  accidents: [{ date: '2024-06-01', cost: '3500', driver: 'Anika Pretend', details: 'A small bump in a car park.' }], q16a: 'No', q16b: 'No', q16c: 'Yes',
  cover: 'Comprehensive', from: '2026-10-16', to: '2027-10-15', b19a: 'Yes', b19b: 'Yes', b19bLimit: '10000', b19c: 'No', b19d: 'Yes', b19e: 'Yes', b19f: 'No', b19g: 'No', b19h: 'Yes',
  b19i: 'No', b19j: 'No', b19k: 'No', signDate: '2026-10-21', policyNo: 'TT APG 0000001', quoteTotal: '8766.74', email: 'someone-else@example.com' };
for (let i = 1; i <= 17; i++) PA['k' + i] = i === 4 ? 'No' : 'Yes';
const PDF = Buffer.from('%PDF-1.4 sample').toString('base64');
const PFILES = [{ kind: 'quote', name: 'quote.pdf', type: 'application/pdf', data: PDF }, { kind: 'certified', name: 'cc.jpg', type: 'image/jpeg', data: PNG },
  { kind: 'permit', name: 'permit.jpg', type: 'image/jpeg', data: PNG }, { kind: 'proposal', name: 'proposal.pdf', type: 'application/pdf', data: PDF },
  { kind: 'kyp', name: 'kyp.pdf', type: 'application/pdf', data: PDF }];
{
  const { env, mails, SF } = world(Object.assign({}, SFPROPS, { MQ_BIND_TO: 'binding@example.com' }));
  const tok = signIn(env, 'anika@example.com');
  const qr = post(env, { action: 'submit', token: tok, quote: GOOD }).ref;
  mails.length = 0;
  const none = post(env, { action: 'propose', token: tok, answers: Object.assign({}, PA, { pep: '', q12: 'maybe', k9: '' }), files: PFILES });
  ok('a proposal missing a declaration is refused whole, naming what is missing, nothing filed', none.ok === false && none.missing.indexOf('pep') > -1 && none.missing.indexOf('q12') > -1 &&
    none.missing.indexOf('Know Your Policy point 9') > -1 && !env.__sheets['Motor Proposals']);
  const det = post(env, { action: 'propose', token: tok, answers: Object.assign({}, PA, { q9d: '', q15: 'Yes', accidents: [] }), files: PFILES });
  ok('a Yes that asks for details needs them', det.ok === false && det.missing.indexOf('the anti-theft device and when it was fitted') > -1 && det.missing.indexOf('the accidents or claims') > -1);
  const nopdf = post(env, { action: 'propose', token: tok, answers: PA, files: PFILES.filter(f => f.kind !== 'kyp') });
  ok('without the signed forms nothing goes', nopdf.ok === false && /did not come through/.test(nopdf.error));
  const noq = post(env, { action: 'propose', token: tok, answers: PA, files: PFILES.filter(f => f.kind !== 'quote') });
  ok('without the quotation nothing goes', noq.ok === false && /quotation/.test(noq.error));
  const r = post(env, { action: 'propose', token: tok, quoteRef: qr, answers: PA, files: PFILES });
  ok('a complete proposal is accepted with an MP reference', r.ok && /^MP-\d{6}-001$/.test(r.ref) && r.sentTo === 'binding@example.com', r.error || '');
  const sh = env.__sheets['Motor Proposals'], hdr = sh._grid[0], row = sh._grid[1], col = n => row[hdr.indexOf(n)];
  ok('the row: the signed-in e-mail, the vehicle, the policy number, the quote it takes', col('Email') === 'anika@example.com' && col('Chassis') === 'LSJ000' && col('Policy number') === 'TT APG 0000001' && col('Quote ref') === qr);
  ok('the row says what needs attention and what the client did not understand', /Accidents or claims/.test(col('Needs attention')) && /4\. The representative explained the excesses/.test(col('KYP not understood')));
  const desk = mails.find(m => /Motor proposal MP-/.test(m.subject)), rcpt = mails.find(m => /Your motor proposal is in/.test(m.subject));
  ok('the desk gets one e-mail with all five documents', desk && /Anika Pretend · MG ZS LUX 2026 \(Not registered yet\) · TT APG 0000001 · taking the quote/.test(desk.subject) && desk.attachments.length === 5);
  ok('the desk e-mail puts what to read first at the top', /Read first/.test(desk.htmlBody) && /Accidents or claims in the past three years/.test(desk.htmlBody) && /Call the client before cover is placed/.test(desk.htmlBody));
  ok('the client gets their own signed proposal and Know Your Policy form', rcpt && rcpt.attachments.length === 2 && /Cover starts once the premium is paid/.test(rcpt.htmlBody));
  ok('the quote request is marked as taken', env.__sheets['Motor Quotes']._grid[1][env.__sheets['Motor Quotes']._grid[0].indexOf('Status')] === 'Accepted: proposal ' + r.ref + ' sent');
  ok('in test mode nothing is written to Salesforce', SF.created.length === 0);
}
{
  const { env } = world(SFPROPS);
  const t1 = signIn(env, 'anika@example.com'), qr = post(env, { action: 'submit', token: t1, quote: GOOD }).ref;
  const t2 = signIn(env, 'newperson@example.com');
  const r = post(env, { action: 'propose', token: t2, quoteRef: qr, answers: PA, files: PFILES });
  ok('a proposal never marks someone else\'s quote request', r.ok && env.__sheets['Motor Quotes']._grid[1][env.__sheets['Motor Quotes']._grid[0].indexOf('Status')] === 'Sent to quotes desk');
}

/* ── Guardian's own forms, filled where their blanks are ──────────── */
{
  const forms = require(path.join(ROOT, 'motor-quote/forms.js'));
  let PDFLib = null; try { PDFLib = require(path.join(ROOT, 'motor-quote/vendor/pdf-lib-1.17.1.min.js')); } catch (e) {}
  ok('the filler knows every key the script checks', ['pep', 'otherGG', 'q3a', 'q3b', 'q4', 'acc', 'q6', 'q7b', 'q7c', 'q7d', 'q7e', 'q8', 'q9', 'q11', 'q12', 'q13', 'q14a', 'q14b', 'q14c', 'q15', 'q16a', 'q16b', 'q16c',
    'b19a', 'b19b', 'b19c', 'b19d', 'b19e', 'b19f', 'b19g', 'b19h', 'b19i', 'b19j', 'b19k'].every(k => forms.PROPOSAL[k] && forms.PROPOSAL[k].t === 'yn') && forms.KYP.length === 17);
  if (PDFLib) {
    const done = (async () => {
      const tp = fs.readFileSync(path.join(ROOT, 'motor-quote/forms/gg-private-motor-proposal.pdf')), tk = fs.readFileSync(path.join(ROOT, 'motor-quote/forms/gg-know-your-policy-private-motor.pdf'));
      const kypDoc = await PDFLib.PDFDocument.load(tk), names = kypDoc.getForm().getFields().map(f => f.getName());
      ok('Guardian\'s Know Your Policy form has every box the filler ticks', forms.KYP.every(q => names.indexOf(q[1]) > -1 && names.indexOf(q[2]) > -1) && ['I', 'Text1', 'Text2', 'Text4', 'Text5'].every(n => names.indexOf(n) > -1));
      const P = await forms.fillProposal(PDFLib, tp, PA, null), K = await forms.fillKyp(PDFLib, tk, PA, null);
      const pd = await PDFLib.PDFDocument.load(P), kd = await PDFLib.PDFDocument.load(K), kf = kd.getForm();
      ok('the proposal stays Guardian\'s four US Legal pages', pd.getPageCount() === 4 && pd.getPages().every(pg => pg.getHeight() === 1008 && pg.getWidth() === 612));
      ok('Know Your Policy: each answer ticks its own box, a No its NO box', kf.getCheckBox('ChkBox').isChecked() && !kf.getCheckBox('ChkBox-0').isChecked() &&
        !kf.getCheckBox('ChkBox-4').isChecked() && kf.getCheckBox('ChkBox-5').isChecked());
      ok('Know Your Policy: the name in block letters, the date as the form asks', kf.getTextField('Text1').getText() === 'ANIKA PRETEND' && kf.getTextField('Text2').getText() === '10/21/26');
      ok('the representative\'s half is left for the branch', !kf.getTextField('Text6').getText() && !kf.getTextField('Text8').getText());
      ok('dates go on the form as MM/DD/YY', forms.mdy('2026-10-16') === '10/16/26');
    })();
    module.exports = done;
  } else ok('pdf-lib is in motor-quote/vendor', false);
}

/* ── the pages ───────────────────────────────────────────────────── */
{
  const page = fs.readFileSync(path.join(ROOT, 'motor-quote/index.html'), 'utf8');
  const gs = fs.readFileSync(path.join(ROOT, 'apps-script/MotorQuote.gs'), 'utf8');
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const key = (gs.match(/SITE_KEY: '([^']+)'/) || [])[1];
  ok('the page and the script share one site key', key && page.indexOf('SITE_KEY: "' + key + '"') > -1);
  ok('the page carries the blue shield and the view beacon', /orphan-transition\/board-mark\.png/.test(page) && /rrb-views/.test(page) && /script\.google\.com\/macros\/s\//.test(page));
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

Promise.resolve(module.exports && module.exports.then ? module.exports : null).catch(e => { console.log('  FAIL  ' + e.message); fails++; }).then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
