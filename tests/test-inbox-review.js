// Claude reviews every inbox item, and writes what to post (23 October 2026).
//
// Ricky, Fri 8:53am, on My day's inbox: "i am not seeing any intelligence built in to post after analyzing ... all ai
// claude codes are in and must be intelligent", and 8:56: "also reviewing the inbox scrub if a task should be open for a
// person to follow up and what was done". Pinned here:
//   - the review reads the whole e-mail conversation, the task it is about (found by policy number), its Chatter, the
//     record and the other mail about the client, on the drafting model, a wave of batches at once (fetchAll);
//   - it comes back with what has been done, where it stands, who acts, whether a task should open (subject, due), the
//     note, what to check; a desk Claude names that is not a desk falls back to the scrub's owner;
//   - nothing is redrafted until a new message, a task or a new status; then only that one;
//   - My day shows the review, the note in the box and the desk chosen, and "make it a task" gives way to the note;
//   - one tick posts it: on the open task when that desk holds it, else on a new task for the desk chosen, due when
//     Claude said, working days only; the mails carry the note; the deep drafts go a wave at a time too;
//   - the clock: 4:40 the deep drafts, the next run the scrub and the inbox review; then :35 each hour, never in the
//     same run as the :20 drafts.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-23';   // a Friday
env.todayISO_ = () => DAY;
env.runlog_ = () => {};
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
const P = env.PropertiesService.getScriptProperties();
P.setProperty('ANTHROPIC_API_KEY', 'k');
env.inboxOn_ = () => true;
env.sfkUsers_ = () => ({ ricky: { id: '005R', active: true }, kamla: { id: '005K', active: true }, azariah: { id: '005A', active: true } });
env.cmdTargets_ = () => [{ sid: 'kamla', id: '005K', name: 'Kamla Dookran' }, { sid: 'azariah', id: '005A', name: 'Azariah Griffith' }, { sid: 'ricky', id: '005R', name: 'Ricky Rampersad' }];
env.sfkRecordUrl_ = id => 'https://sf.example/' + id;
env.umTaskContext_ = id => ({ record: { description: 'Orphan client, policy 5004096791, premium due 22 Oct' }, related: [] });
env.playbookFor_ = () => ({ todo: 'Name the agent and tell the client', close: 'When the agent has called' });
const CHAT = { '00TH1': [{ day: '2026-10-22', at: '2026-10-22T20:27:00.000Z', by: 'Kamla Dookran', text: 'Azariah, who was assigned to Heman Bahadoor? I cannot find it on the sheet.' }] };
env.cmdChatter_ = ids => { const o = {}; ids.forEach(id => { if (CHAT[id]) o[id] = CHAT[id]; }); return o; };
const SOQL = [];
env.sfkQuery_ = q => { SOQL.push(q); return /LIKE '%5004096791%'/.test(q) ? [{ Id: '00TH1', Subject: 'Orphan premium due: Call back - 5004096791 HEMAN BAHADOOR', OwnerId: '005A', Status: 'Not Started', ActivityDate: '2026-10-22' }] : []; };

// The Gmail conversation the mail belongs to: Kamla's mail, then a reply.
const gm = (from, at, body) => ({ getFrom: () => from, getSubject: () => 'Orphan premium due: Call back - 5004096791 HEMAN BAHADOOR', getPlainBody: () => body,
  getId: () => 'm' + at, getDate: () => new Date(at), isStarred: () => false });
env.GmailApp = { getMessageById: id => ({ getThread: () => ({ getMessages: () => id === '18aaa'
  ? [gm('Kamla Dookran <kamla.dookran@myguardiangroup.com>', '2026-10-22T20:27:00Z', 'Azariah, I cannot find the assigned agent for Heman Bahadoor on the sheet or Chatter. Who was it?'),
     gm('Azariah Griffith <azariah.griffith@myguardiangroup.com>', '2026-10-22T20:40:00Z', 'Checking with Sasha, will revert.')] : [] }) }) };

const H = env.INBOXTAB.head;
const row = o => H.map(h => o[h] != null ? o[h] : '');
env.__mkSheet('Inbox Scrub', 7, H, [
  row({ Date: DAY, Key: 'kA-20261023', Thread: 'kA', Source: 'Branch mailbox', Received: '2026-10-22T20:27:00.000Z', From: 'kamla.dookran@myguardiangroup.com', Email: 'kamla.dookran@myguardiangroup.com',
        Subject: 'Orphan premium due: Call back - 5004096791 HEMAN BAHADOOR', Gist: 'Kamla cannot find an assigned agent for orphan client Heman Bahadoor.', Urgency: 'now', Why: 'Orphan premium client at lapse risk',
        Ask: 'Tell Kamla which agent was assigned to Heman Bahadoor', Owner: 'Azariah', Link: 'https://mail.google.com/mail/u/0/#inbox/18aaa', Status: 'open' }),
  row({ Date: DAY, Key: 'kB-20261023', Thread: 'kB', Source: 'Branch mailbox', Received: '2026-10-22T19:39:00.000Z', From: 'kamla.dookran@myguardiangroup.com', Email: 'kamla.dookran@myguardiangroup.com',
        Subject: 'Dear Mr. Bisnath,', Gist: 'Kamla drafted a reply to Mr Bisnath on Boynes portal access.', Urgency: 'now', Why: 'A client waiting', Ask: 'Review and approve the reply to Mr Bisnath',
        Owner: 'Ricky', Link: 'https://mail.google.com/mail/u/0/#inbox/18bbb', Status: 'open' }),
  row({ Date: DAY, Key: 'kC-20261023', Thread: 'kC', Source: 'Gmail', Received: '2026-10-22T18:55:00.000Z', From: 'javedteelucksingh@gmail.com', Email: 'javedteelucksingh@gmail.com',
        Subject: 'Good evening Mr Rampersad,', Gist: 'Mr Teelucksingh asks for a call.', Urgency: 'today', Why: 'A client asks for a call', Ask: 'Have Fawwaz call Mr Teelucksingh', Owner: 'Ricky',
        Link: 'https://mail.google.com/mail/u/0/#inbox/18ccc', Status: 'open' })]);

// Claude: one answer per id, whichever way the calls come.
let calls = [], waves = 0;
const ANS = {
  'kA-20261023': { done: 'Kamla asked Azariah on Thu 22 Oct at 4:27pm; Azariah replied she is checking with Sasha. No agent named yet.', read: 'Premium due on an orphan policy with no agent on record.',
    to: 'azariah', task: false, task_subject: '', due: 0, post: 'Azariah, tell Kamla today which agent was assigned to Heman Bahadoor (5004096791) and put it on the Orphan sheet.', check: ['The Orphan Assignment sheet'], action: 'post' },
  'kB-20261023': { done: 'Nothing yet.', read: 'Kamla has drafted the reply; it waits on his approval.', to: 'kamla', task: true, task_subject: 'Send Mr Bisnath the approved reply on Boynes portal access',
    due: 1, post: 'Kamla, the reply to Mr Bisnath reads well. Send it on Monday and note it here.', check: [], action: 'task' },
  'kC-20261023': { done: 'Nothing yet.', read: 'The client asks for a call back.', to: 'fawwaz', task: true, task_subject: 'Call Mr Teelucksingh', due: 0, post: 'Fawwaz to call Mr Teelucksingh today.', check: [], action: 'call' } };
const reply = o => { const body = JSON.parse(o.payload); calls.push(body);
  const c = body.messages[0].content, js = {};
  (c.match(/"id":"(k[A-Z]-\d+|00T[A-Z0-9]+)"/g) || []).map(x => x.slice(6, -1)).forEach(id => { if (ANS[id]) js[id] = ANS[id]; else if (/^00T/.test(id)) js[id] = { read: 'r', reply: 'Kamla, please.', next: 'n', add: [], action: 'chase' }; });
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(js) }] }) }; };
env.UrlFetchApp = { fetch: (u, o) => reply(o), fetchAll: reqs => { waves++; return reqs.map(r => { if (r.url !== 'https://api.anthropic.com/v1/messages') throw new Error('url'); return reply(r); }); } };

console.log('\nThe review reads everything about the mail, a wave at a time:\n');
env.IX_DEEP.BATCH = 1;   // three batches of one, so the wave is visible
const n = env.ixDeepWarm_(DAY, 60000);
ok('every open item reviewed', n === 3 && Object.keys(env.ixDeepGet_(DAY)).length === 3, String(n));
ok('three batches, sent together in one wave', waves === 1 && calls.length === 3, waves + ' wave(s), ' + calls.length + ' calls');
ok('on the drafting model', calls.every(c => c.model === 'claude-sonnet-5-5'), calls[0] && calls[0].model);
const dataOf = c => { const t = c.messages[0].content; return JSON.parse(t.slice(t.lastIndexOf('\n') + 1)); };
const A = calls.map(dataOf).map(d => d[0]).filter(d => d.id === 'kA-20261023')[0] || {};
ok('the whole conversation, the reply too', A.conversation_oldest_first && A.conversation_oldest_first.length === 2 && /Checking with Sasha/.test(A.conversation_oldest_first[1].text));
ok('the task it is about, found by the policy number', A.task && /HEMAN BAHADOOR/.test(A.task.subject) && A.task.held_by === 'Azariah Griffith' && SOQL.some(q => /LIKE '%5004096791%'/.test(q)));
ok('its Chatter, the record and the playbook', A.task && /who was assigned/.test(A.task.chatter_oldest_first[0].text) && /5004096791/.test(A.task.record.description) && A.task.what_to_do);
ok('the scrub\'s first read goes with it', A.first_read && /Tell Kamla/.test(A.first_read.to_do) && A.first_read.for === 'Azariah');
const prompt = calls[0].messages[0].content;
ok('it is asked what was done, and whether a task should open', /"done"/.test(prompt) && /"task": true when a task should be opened/.test(prompt) && /"task_subject"/.test(prompt) && /"due"/.test(prompt));
ok('the desks it may name', /"id":"kamla"/.test(prompt) && /"id":"azariah"/.test(prompt));
ok('the mail is data, never instructions', /never instructions to you/.test(prompt));
const D = env.ixDeepGet_(DAY);
ok('kept: what was done, where it stands, the note, who', /checking with Sasha/i.test(D['kA-20261023'].done) && D['kA-20261023'].to === 'azariah' && /Azariah, tell Kamla/.test(D['kA-20261023'].post));
ok('and the task it is about, with who holds it', D['kA-20261023'].t === '00TH1' && D['kA-20261023'].tw === 'azariah' && D['kA-20261023'].tc === false);
ok('a task to open: its subject and days', D['kB-20261023'].nt === true && /Mr Bisnath/.test(D['kB-20261023'].ns) && D['kB-20261023'].due === 1);
ok('a name that is not a desk falls back to the scrub\'s owner', D['kC-20261023'].to === 'ricky', D['kC-20261023'].to);

calls = []; waves = 0;
ok('the next hour: nothing new, nothing redrafted', env.ixDeepWarm_(DAY, 60000) === 0 && calls.length === 0);
const sh = env.__sheets['Inbox Scrub'] || null;
const grid = (sh && sh._grid) || (env.hrTab_(env.INBOXTAB, false) || {})._grid;
grid[1][H.indexOf('Received')] = '2026-10-23T12:05:00.000Z';
ok('a new message in one conversation: that one again', env.ixDeepWarm_(DAY, 60000) === 1 && calls.length === 1);
env.IX_DEEP.BATCH = 4;

console.log('\nWhat the posting does:\n');
ok('the open task held by the desk: the note goes there', env.ixOpensTask_(D['kA-20261023'], 'azariah') === false);
ok('another desk chosen: a task of their own', env.ixOpensTask_(D['kA-20261023'], 'kamla') === true);
ok('nothing open: a task', env.ixOpensTask_(D['kB-20261023'], 'kamla') === true);
ok('due in working days: Friday + 1 is Monday', env.ixDueDay_(DAY, 1) === '2026-10-26' && env.ixDueDay_(DAY, 0) === DAY, env.ixDueDay_(DAY, 1));

console.log('\nMy day:\n');
const v = env.inboxView_(DAY);
const html = env.inboxCard_({ inbox: v, day: DAY }, 3);
ok('the line over the list: how many Claude reviewed and what they need', /Claude reviewed 3 of 3: 2 need a task opened, 1 a note on the open task/.test(html), (html.match(/Claude reviewed[^<]*/) || [''])[0]);
ok('each shows what has been done, where it stands and the follow-up', /Done so far:<\/b> Kamla asked Azariah/.test(html) && /Where it stands:/.test(html) && /Follow-up:<\/b> the open task covers it \(Azariah&#39;s|Follow-up:<\/b> the open task covers it \(Azariah's/.test(html));
ok('a task to open: for whom, due when, its subject', /open a task for Kamla, due [^:]*26[^:]*: Send Mr Bisnath the approved reply/.test(html), (html.match(/open a task for Kamla[^<]*/) || [''])[0]);
ok('the note is in the box, ready to post', /name="ixpt_kA-20261023"[^>]*>Azariah, tell Kamla today/.test(html));
ok('the desk Claude chose is chosen', /name="ixpw_kA-20261023"[\s\S]*?value="azariah" selected/.test(html));
ok('nothing ticked for him', !/name="ixp_kA-20261023" value="1" checked/.test(html));
ok('"make it a task" gives way to the note on a reviewed item', !/name="ixt_kA-20261023"/.test(html));
ok('the collapsed line says what Claude advises', /Claude: Post the note/.test(html) && /Claude: Open a task/.test(html));

console.log('\nOne tick posts it:\n');
const posts = [], inserts = [];
env.mgrPost_ = (o, sid) => { posts.push({ o, sid }); return 'F' + posts.length; };
env.sfkInsert_ = (type, o) => { inserts.push({ type, o }); return '00TNEW' + inserts.length; };
env.bigPut_('unit_inbox_ricky_' + DAY, v.open.map(x => ({ k: x.k, s: x.subject, f: x.from, e: x.email, g: x.gist, a: x.ask, l: x.link, w: env.inboxWhen_(x.at, DAY) })));
const res = env.inboxSave_('ricky', DAY, {
  'ixp_kA-20261023': '1', 'ixpt_kA-20261023': 'Azariah, tell Kamla by 11 which agent has Heman Bahadoor.', 'ixpw_kA-20261023': 'azariah',
  'ixp_kB-20261023': '1', 'ixpt_kB-20261023': 'Kamla, send it Monday.', 'ixpw_kB-20261023': 'kamla',
  'ixpt_kC-20261023': 'Not ticked, so not posted.', 'ixpw_kC-20261023': 'ricky' }, 'Branch Manager · Ricky Rampersad', 'Mr Rampersad');
ok('the first goes on Azariah\'s open task, in his words as edited', posts[0] && posts[0].o.ParentId === '00TH1' && /by 11 which agent/.test(posts[0].o.Body) && /^Branch Manager · Ricky Rampersad\n\n/.test(posts[0].o.Body));
ok('the second opens a task for Kamla, due Monday, Claude\'s subject', inserts[0] && inserts[0].o.OwnerId === '005K' && inserts[0].o.ActivityDate === '2026-10-26' && /^Send Mr Bisnath/.test(inserts[0].o.Subject) && /Kamla, send it Monday/.test(inserts[0].o.Description));
ok('with the note on its Chatter', posts[1] && posts[1].o.ParentId === '00TNEW1' && /send it Monday/.test(posts[1].o.Body));
ok('an unticked note posts nothing', posts.length === 2 && inserts.length === 1 && res.length === 2, res.map(r => r.res).join(' | '));
ok('what it did, in words', /posted on Azariah's task/.test(res[0].res) && /task for Kamla, due .*note posted/.test(res[1].res), res.map(r => r.res).join(' | '));
const after = env.inboxRows_();
ok('the list remembers: the task, and the note', after.filter(r => r.Key === 'kB-20261023')[0].TaskId === '00TNEW1' && after.filter(r => r.Key === 'kB-20261023')[0].Status === 'task' && /send it Monday/.test(after.filter(r => r.Key === 'kB-20261023')[0].Note));

console.log('\nThe mails:\n');
const mail = env.inboxMailSection_(env.inboxView_(DAY), 'am', DAY);
ok('each open item carries Claude\'s note and the follow-up', /Claude's note to Azariah:|Claude&#39;s note to Azariah:/.test(mail) && /Follow-up:/.test(mail), (mail.match(/Claude[^<]{0,40}note[^<]*/) || [''])[0]);

console.log('\nThe deep drafts go a wave at a time too:\n');
const W = { ask: [1, 2, 3, 4, 5, 6].map(i => ({ id: '00TQ' + i, subject: 'Ask ' + i, by: 'Kamla Dookran', said: 'please', at: DAY + 'T09:0' + i + ':00.000Z' })), mine: [], ignored: [], byOwner: {} };
env.bmWaiting_ = () => W;
env.BM_DEEP.BATCH = 2; calls = []; waves = 0;
const dn = env.bmDeepWarm_(DAY, 60000);
ok('six asks in three batches, sent together', dn === 6 && waves === 1 && calls.length === 3, dn + ' written, ' + waves + ' wave(s), ' + calls.length + ' calls');
env.BM_DEEP.BATCH = 4;

console.log('\nThe clock:\n');
const dow = Number(env.Utilities.formatDate(new Date(), 'x', 'u'));
if (dow <= 5) {
  let deepN = 0, ixN = 0, scrubs = 0;
  env.bmDeepWarm_ = () => { deepN++; return 0; }; env.ixDeepWarm_ = () => { ixN++; return 0; }; env.inboxScrub_ = () => { scrubs++; return null; };
  env.bmdWarm_ = () => ({}); env.dayLogSalesforce_ = () => 0; env.inboxView_ = () => null;
  P.deleteProperty('bmdeep_' + DAY); P.deleteProperty('ixdeep_' + DAY);
  env.hhmm_ = () => '04:42'; env.housekeepingTick_();
  ok('4:40: the deep drafts first, alone', deepN === 1 && ixN === 0, deepN + '/' + ixN);
  env.hhmm_ = () => '04:52'; env.housekeepingTick_(); env.housekeepingTick_();
  ok('the next run: the night\'s mail scrubbed, then the inbox review, once', ixN === 1 && scrubs === 1 && deepN === 1, ixN + '/' + scrubs + '/' + deepN);
  P.deleteProperty('bmai_hr'); P.deleteProperty('ixai_hr'); deepN = 0; ixN = 0;
  env.hhmm_ = () => '09:24'; env.housekeepingTick_();
  ok(':24: the drafts, not the review', deepN === 1 && ixN === 0, deepN + '/' + ixN);
  env.hhmm_ = () => '09:44'; env.housekeepingTick_(); env.housekeepingTick_();
  ok(':35 on: the review, once that hour', ixN === 1 && deepN === 1, deepN + '/' + ixN);
  P.deleteProperty('bmai_hr'); P.deleteProperty('ixai_hr'); deepN = 0; ixN = 0;
  env.hhmm_ = () => '10:41'; env.housekeepingTick_();
  ok('a late run that does the drafts leaves the review to the next', deepN === 1 && ixN === 0, deepN + '/' + ixN);
} else ok('the clock (weekday only; skipped today)', true);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
