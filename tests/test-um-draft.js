// Branch Intelligence writes his replies on the comment page (21 October 2026).
//
// Ricky, 9:14am, on his My branch comment page: "how do you build the Intelligence
// response from me instead of me typing to send in chatter, as this is supposed to
// analyze for a response, and you are to guide and advise what can be added to make
// responding for me easy using all the tools and resources I have".
// And on the same screen, every one of his own notes in the history read
// "Unit Manager · Ricky Rampersad · Tue 20 Oct:" with nothing after it.
//
// Pinned here: a note's words show in the history whether its lines were kept or
// joined; every task on the page has Draft my reply and the page has Draft replies
// for all, with its own signature; umDraft() refuses a wrong signature and a task
// not on the page, reads the whole history (oldest first), the record and its other
// open tasks, and the branch's tools; it returns where it stands, the reply, the
// next step, what would make it stronger and the action; Firmer / Shorter / Kinder
// and his own words reach Claude; it posts nothing; no key says so and calls nobody.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-21';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Support', 'Yes'],
   ['Akaash Kalladeen', 'akaash', 'akaash@example.com', '1', 'Unit Manager', 'Akaash', 'Yes']]);
const P = env.PropertiesService.getScriptProperties();
P.setProperty('ANTHROPIC_API_KEY', 'sk-test');

console.log('\nThe history keeps the words of a note posted from the tracker:\n');
const one = env.noteParts_('Unit Manager · Ricky Rampersad · Tue 20 Oct 9:14am Shivonne, please confirm by Friday whether the client accepts the quote.');
ok('joined into one line: the words after the head are the note', one.ours && one.who === 'Unit Manager · Ricky Rampersad' && /^Shivonne, please confirm/.test(one.body), JSON.stringify(one));
const two = env.noteParts_('Branch Manager · Mon 19 Oct 3:05pm\n\nCall the client today.');
ok('with its lines kept: the same', two.ours && two.who === 'Branch Manager' && two.body === 'Call the client today.', JSON.stringify(two));
const plain = env.noteParts_('Email sent to Shivonne for an update.');
ok('a note typed in Salesforce is left as it is', !plain.ours && plain.body === 'Email sent to Shivonne for an update.');
const ID = '00TUMAI00000000001', ID2 = '00TUMAI00000000002';
const CHAT = { [ID]: [
  { day: '2026-10-20', by: 'Ricky Rampersad', text: 'Unit Manager · Ricky Rampersad · Tue 20 Oct 4:10pm Kamla, where does this stand?' },
  { day: '2026-10-14', by: 'Kamla Dookran', text: 'Email sent by Mr. Rampersad for intervention. Task is now escalated to him as no feedback is being received by Shivonne.', reply: true },
  { day: '2026-10-13', by: 'Kamla Dookran', text: 'Email sent to Shivonne for an update.', reply: true },
  { day: '2026-09-08', by: 'Kamla Dookran', text: 'Spoke to Shivonne and advised to review email as well as update us when we can deliver original and collect payments.', reply: true } ] };
const html = env.chatterNotes_(CHAT, ID, true);
ok('his note shows its words in the history', /Unit Manager · Ricky Rampersad · Tue 20 Oct: Kamla, where does this stand\?/.test(html), html.slice(0, 200));

console.log('\nOn the page:\n');
env.bigPut_(env.umItemsKey_('ricky', DAY), [
  { id: ID, s: 'Premium follow up - New Quote: Risk Location - 36-27 Millenium Lakes - Shivonne Sammy', a: '', due: '2026-10-20', late: true, k: 'new' },
  { id: ID2, s: 'Investment Discussions - Neal Balroop', a: '', due: '2026-10-20', late: true, k: 'new' }]);
env.cmdChatter_ = ids => { const o = {}; ids.forEach(id => { if (CHAT[id]) o[id] = CHAT[id]; }); return o; };
env.mgrRows_ = () => ({});
env.noSfLogin_ = () => false;
env.sfkToken_ = () => ({ instance_url: 'https://example.my.salesforce.com' });
const page = env.umReplyPage_({ staffId: 'ricky', name: 'Ricky Rampersad' }, DAY, '', {}).getContent();
ok('each task has Draft my reply', (page.match(/onclick="umAI\('00TUMAI0000000000[12]',''\)"/g) || []).length === 2);
ok('and the page has Draft replies for all 2', /Draft replies for all 2/.test(page));
const k = env.replySig_('ricky', DAY, 'um');
ok('the page carries its own signature', page.indexOf('"k":"' + k + '"') > -1);
const scripts = (page.match(/<script>([\s\S]*?)<\/script>/g) || []).map(s => s.replace(/^<script>|<\/script>$/g, ''));
let parsed = true; scripts.forEach(s => { try { new Function(s); } catch (e) { parsed = false; console.log('    ' + e.message); } });
ok('its scripts parse', scripts.length >= 2 && parsed);
ok('his own notes show their words on the page', /Tue 20 Oct: Kamla, where does this stand/.test(page));

console.log('\numDraft():\n');
let asked = [], reply = '';
env.UrlFetchApp = { fetch: (url, o) => { asked.push(JSON.parse(o.payload));
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: reply }] }) }; } };
const soql = [];
env.sfkQuery_ = q => { soql.push(q);
  if (/FROM Task WHERE Id =/.test(q)) return [{ Id: ID, Subject: 'Premium follow up - New Quote', Status: 'Open', ActivityDate: '2026-10-20', WhatId: '001ACC0000000001', What: { Name: 'Shivonne Sammy' }, Owner: { Name: 'Kamla Dookran' }, CreatedBy: { Name: 'Kamla Dookran' }, Description: 'Quote sent; awaiting acceptance and payment.' }];
  if (/WhatId =/.test(q)) return [{ Subject: 'Collect original signed quote', ActivityDate: '2026-10-22', Status: 'Open', Owner: { Name: 'Kamla Dookran' } }];
  return []; };
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'X'; };
ok('a wrong signature is refused', /expired/.test(env.umDraft({ rs: 'ricky', d: DAY, k: 'nope', id: ID }).error) && !asked.length);
ok('a task not on the page is refused', /no longer on this page/.test(env.umDraft({ rs: 'ricky', d: DAY, k, id: '00TOTHER' }).error) && !asked.length);
reply = '```json\n' + JSON.stringify({ read: 'Overdue since 20 Oct; Kamla has chased Shivonne four times since 8 Sep with no answer.',
  reply: 'Shivonne, Kamla has written to you four times since 8 September. Please confirm by Friday 23 October whether the client accepts the quote and when the payment will be collected, or I will reassign it.',
  next: 'Shivonne to confirm acceptance and payment by Fri 23 Oct.', add: ['Check the Premium Due Desk for any payment', 'Ask Kamla for the date of the last e-mail', 'Call the client', 'one too many'], action: 'Escalate' }) + '\n```';
const r = env.umDraft({ rs: 'ricky', d: DAY, k, id: ID });
ok('it answers: where it stands, the reply, the next step', r.ok && /four times/.test(r.read) && /^Shivonne,/.test(r.reply) && /Fri 23 Oct/.test(r.next), JSON.stringify(r).slice(0, 160));
ok('at most three things to make it stronger', r.add.length === 3);
ok('the action, in lower case', r.action === 'escalate');
const prompt = asked[0].messages[0].content;
ok('Claude reads the whole history, oldest first', prompt.indexOf('Spoke to Shivonne and advised') < prompt.indexOf('Email sent to Shivonne for an update') && /Kamla, where does this stand/.test(prompt));
ok('and the record and its other open tasks', /Quote sent; awaiting acceptance/.test(prompt) && /Collect original signed quote/.test(prompt) && /"on":"Shivonne Sammy"/.test(prompt));
ok('and the branch\'s tools', /Log Book/.test(prompt) && /Delivery Book/.test(prompt) && /Premium Due Desk/.test(prompt) && /Query Pal/.test(prompt) && /FactFind360/.test(prompt));
ok('in his voice, as the Branch Manager', /Ricky Rampersad, the Branch Manager/.test(prompt));
ok('on the drafting model', asked[0].model === env.claudeDraftModel_());
ok('Salesforce is only read', soql.every(q => /^SELECT /.test(q)) && !posts.length);
asked = [];
env.umDraft({ rs: 'ricky', d: DAY, k, id: ID, tone: 'firmer', said: 'tell her friday latest or I move it to Akaash', was: 'old draft' });
const p2 = asked[0].messages[0].content;
ok('Firmer reaches Claude', /Make this version firmer/.test(p2));
ok('and his own words are the substance', /tell her friday latest or I move it to Akaash/.test(p2));
reply = 'not json at all';
ok('an answer that is not JSON says so', /came back empty/.test(env.umDraft({ rs: 'ricky', d: DAY, k, id: ID }).error));
P.setProperty('ANTHROPIC_API_KEY', ''); asked = [];
ok('no key: says so and calls nobody', /not set up/.test(env.umDraft({ rs: 'ricky', d: DAY, k, id: ID }).error) && !asked.length);


console.log('\nThe BMA is a manager too: her day page has the same:\n');
P.setProperty('ANTHROPIC_API_KEY', 'sk-test');
const KT = { id: '00TBMA000000000001', s: 'Renewal - Leemar Marketing Limited - two instalments outstanding', ty: 'Renewa/PDl/Bill', due: '2026-10-19' };
env.sdList_ = () => [Object.assign({}, KT)];
env.sfkTaskStates_ = () => ({}); env.dueMovesByTask_ = () => ({}); env.signedInAt_ = () => '08:01'; env.yesterdayOpen_ = () => null;
env.sdQueries_ = () => []; env.intelModel_ = () => null; env.gameOn_ = () => false; env.middayAt_ = () => 12 * 60 + 30;
CHAT[KT.id] = [{ day: '2026-10-13', by: 'Kamla Dookran', text: 'Client advised he will pay the two outstanding instalments by cheque, collected on Friday.' }];
const kpage = env.sdPage_({ staffId: 'kamla', name: 'Kamla Dookran' }, DAY).getContent();
ok('Kamla\'s card has Draft my reply', /onclick="umAI\('00TBMA000000000001',''\)"/.test(kpage));
ok('and her page the Intelligence card, with the note box wording', /Branch Intelligence writes your replies/.test(kpage) && /then Close now, Move now or Post note/.test(kpage));
const kk = env.replySig_('kamla', DAY, 'card');
ok('her page says it is a card page, filling the note box', kpage.indexOf('"k":"' + kk + '","via":"card","f":"n_","mode":"reply"') > -1);
let kparsed = true; (kpage.match(/<script>([\s\S]*?)<\/script>/g) || []).forEach(x => { try { new Function(x.replace(/^<script>|<\/script>$/g, '')); } catch (e) { kparsed = false; console.log('    ' + e.message); } });
ok('its scripts parse', kparsed);
const spage = env.sdPage_({ staffId: 'sasha', name: 'Sasha Lalla-Jagassar' }, DAY).getContent();
ok('Sasha\'s day page has Brief me instead, not the manager\'s reply', />&#128161;<\/span> Brief me</.test(spage) && !/Draft my reply/.test(spage) && /Branch Intelligence briefs you/.test(spage) && /"mode":"brief"/.test(spage));
let sparsed = true; (spage.match(/<script>([\s\S]*?)<\/script>/g) || []).forEach(x => { try { new Function(x.replace(/^<script>|<\/script>$/g, '')); } catch (e) { sparsed = false; console.log('    ' + e.message); } });
ok('its scripts parse', sparsed);
asked = [];
reply = JSON.stringify({ read: 'Overdue since 19 Oct; the cheques were due Friday.', reply: 'Collected the two instalment cheques from [blank] on [date]; receipts to follow. Next step: deposit and update the policy by Friday.', next: 'Kamla to confirm the cheques by Fri.', add: ['Record the cheques in the Delivery Book'], action: 'wait' });
const kr = env.umDraft({ rs: 'kamla', d: DAY, k: kk, via: 'card', id: KT.id });
ok('umDraft on her card answers', kr.ok && /instalment cheques/.test(kr.reply), JSON.stringify(kr).slice(0, 120));
const kp = asked[0].messages[0].content;
ok('in her voice, as the BMA and a manager', /Kamla Dookran, the Branch Manager's Assistant \(BMA\), a manager/.test(kp));
ok('and when she is the one to act, it is her own note', /when the writer is the one who must act/.test(kp));
ok('the card page\'s signature is checked', /expired/.test(env.umDraft({ rs: 'kamla', d: DAY, k: env.replySig_('kamla', DAY, 'um'), via: 'card', id: KT.id }).error));
ok('a task not on her list is refused', /no longer on this page/.test(env.umDraft({ rs: 'kamla', d: DAY, k: kk, via: 'card', id: '00TNOPE' }).error));

console.log('\nStaff get the brief: where it stands, what next, what to check; the note is still theirs:\n');
const sk = env.replySig_('sasha', DAY, 'card');
asked = [];
reply = JSON.stringify({ read: 'Overdue since 19 Oct; underwriting has not answered.', next: 'Chase underwriting today for the decision.', add: ['Check the Log Book for the medical', 'x', 'y', 'z'], action: 'chase',
  reply: 'Underwriting, please confirm the decision on this renewal by Friday 23 October; the client is waiting.' });
const sb = env.umDraft({ rs: 'sasha', d: DAY, k: sk, via: 'card', id: KT.id });
ok('a staff desk gets the brief', sb.ok && sb.mode === 'brief' && /underwriting/.test(sb.read) && /Chase underwriting/.test(sb.next) && sb.add.length === 3, JSON.stringify(sb).slice(0, 140));
ok('with the chase, which says nothing was done', /^Underwriting, please confirm/.test(sb.reply));
const bp = asked[0].messages[0].content;
ok('Claude is told never to write a note that reports work as done', /Never write a note that reports work as done/.test(bp) && /a member of the support staff/.test(bp));
reply = JSON.stringify({ read: 'Due today.', next: 'Call the client.', add: [], action: 'call', reply: 'Called the client and confirmed payment by Friday.' });
ok('a "reply" that reports work done is dropped', env.umDraft({ rs: 'sasha', d: DAY, k: sk, via: 'card', id: KT.id }).reply === '');
reply = JSON.stringify({ read: 'Due today.', next: 'Call the client.', add: [], action: 'call', reply: 'I have spoken to the client.' });
ok('in either form', env.umDraft({ rs: 'sasha', d: DAY, k: sk, via: 'card', id: KT.id }).reply === '');
P.setProperty('INTEL_REPLY_DESKS', 'kamla, sasha'); asked = [];
reply = JSON.stringify({ read: 'r', reply: 'Sasha note', next: 'n', add: [], action: 'wait' });
ok('INTEL_REPLY_DESKS gives a desk the full reply', env.umDraft({ rs: 'sasha', d: DAY, k: sk, via: 'card', id: KT.id }).reply === 'Sasha note' && /when the writer is the one who must act/.test(asked[0].messages[0].content));
P.setProperty('INTEL_REPLY_DESKS', '');

console.log('\nAkaash\'s evening page, and whose name heads his comments:\n');
env.bigPut_(env.umItemsKey_('akaash', DAY) + '_eve', [{ id: ID2, s: 'Investment Discussions - Neal Balroop', a: 'Marcus', due: '2026-10-20', late: true, k: 'new' }]);
env.mgrRows_ = () => ({}); env.umDraftsKey_ = env.umDraftsKey_ || (() => 'x');
const epage = env.umEveReplyPage_({ staffId: 'akaash', name: 'Akaash Kalladeen' }, DAY, '', {}).getContent();
const ek = env.replySig_('akaash', DAY, 'umeve');
ok('his evening page has Draft my reply and its script', /umAI\('00TUMAI00000000002',''\)/.test(epage) && epage.indexOf('"k":"' + ek + '","via":"umeve"') > -1);
asked = []; reply = JSON.stringify({ read: 'r', reply: 'Marcus, where does this stand?', next: 'n', add: [], action: 'chase' });
const er = env.umDraft({ rs: 'akaash', d: DAY, k: ek, via: 'umeve', id: ID2 });
ok('and it answers there, as a Unit Manager', er.ok && /Akaash Kalladeen, a Unit Manager/.test(asked[0].messages[0].content), JSON.stringify(er).slice(0, 100));
const mposts = []; env.mgrPost_ = (b, sid) => { mposts.push(b.Body); };
env.umReplySave_({ staffId: 'ricky', name: 'Ricky Rampersad' }, DAY, { ['c_' + ID]: 'Kamla, please call the client today.' });
ok('his comments are headed Branch Manager, not Unit Manager', /^Branch Manager · Ricky Rampersad · /.test(mposts[0] || ''), mposts[0]);
env.umEveReplySave_ && env.umEveReplySave_({ staffId: 'akaash', name: 'Akaash Kalladeen' }, DAY, { ['c_' + ID2]: 'Marcus, call him today.', only: '1' });
ok('Akaash\'s are headed Unit Manager', mposts.some(b => /^Unit Manager · Akaash Kalladeen · /.test(b)), mposts.join(' | '));
ok('and his page is called My branch', /<title>My branch · /.test(env.umReplyPage_({ staffId: 'ricky', name: 'Ricky Rampersad' }, DAY, '', {}).getContent()));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
