// The task cards: reminder templates, Claude, and closing on the fly (20 October 2026, 2026-10-20n).
//
// Ricky, 7:02pm: "I want the reminder templates cards closing on the fly
// posting to chatter and integration of AI that speeds up our productivity!!"
//
// Pinned here: every task on the day page has templates for its kind (each
// saying whether it closes, moves or notes), a Draft with Claude button, and
// Close now / Move now / Post note; the page carries the cards' own signature.
// cardAct() refuses a wrong or missing signature, another day, and a task not
// on that person's list; a close posts the note with Save's head line, closes
// the task and writes the change log; a move needs a date and writes Due Moves;
// a thin note, a [blank] left in, and a close while the client wants an agent
// are refused; a Save after a card acted does not post or close twice; Claude
// writes the note from their words and the task's Chatter, keeps a client who
// wants an agent from being closed, and a missing key says so and calls nobody.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-20';
const env = makeEnv();
env.PropertiesService.getScriptProperties().setProperty('STAFF_AI', 'on');   // the switched-on path; off by default since 27 Oct 2026 (test-staff-ai)
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
env.__mkSheet('Due Moves', 7, env.DUEMOVES.head, []);
env.__mkSheet('Task Changes', 8, env.TASKCHG.head, []);
const P = env.PropertiesService.getScriptProperties();
P.setProperty('ANTHROPIC_API_KEY', 'sk-test');

const T = {
  prem:  { id: '00TCARD00000000001', s: 'Premium due - 5001816653 REENA SEEPARSAN', ty: 'Renewa/PDl/Bill', due: DAY },
  uw:    { id: '00TCARD00000000002', s: 'Follow up with UW - 1000894223 RAVI', ty: 'Pendings', due: '2026-10-18', late: true },
  agent: { id: '00TCARD00000000003', s: 'Servicing - 2000111222 MOHAMMED', ty: 'Servicing', due: DAY },
  claim: { id: '00TCARD00000000004', s: 'Death claim - 7000000001 DOE', ty: 'Claims/ Mat', due: DAY },
  orph:  { id: '00TCARD00000000005', s: 'Orphan adoption - 3000222333 KHAN', ty: 'Servicing', due: DAY }
};
const LIST = Object.values(T);
env.sdList_ = () => LIST.map(t => Object.assign({}, t));
const CHAT = { [T.agent.id]: [{ day: '2026-10-19', by: 'Elizabeth Lee', text: 'Client called: she wants an agent to come and explain the policy before she decides.' }],
               [T.uw.id]: [{ day: '2026-10-17', by: 'Sasha Lalla-Jagassar', text: 'Underwriting asked for the ECG.' }] };
env.cmdChatter_ = ids => { const o = {}; ids.forEach(id => { if (CHAT[id]) o[id] = CHAT[id]; }); return o; };
env.sfkTaskStates_ = () => ({});
env.dueMovesByTask_ = () => ({});
env.signedInAt_ = () => '07:02';
env.yesterdayOpen_ = () => null;
env.sdCheckin_ = () => ({ first: false, at: '07:02' });
env.sdQueries_ = () => [{ ref: 'QP/2026/0101', client: 'Leila Jailal', subject: 'Statement', type: 'Servicing', days: 3, over: false }];
env.intelModel_ = () => null;
env.gameOn_ = () => false;
env.middayAt_ = () => 11 * 60 + 30;
const posts = [], patches = [];
env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'NEW' + posts.length; };
env.sfkPatchTask_ = (id, b) => { patches.push([id, b]); return true; };
let asked = [], reply = null;
env.UrlFetchApp = { fetch: (url, o) => { const body = JSON.parse(o.payload); asked.push(body);
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: reply }] }) }; } };

const person = { staffId: 'sasha', name: 'Sasha Lalla-Jagassar' };
const page = env.sdPage_(person, DAY).getContent();
const card = id => { const a = page.indexOf('id="w' + id + '"'); const b = page.indexOf('</details>', a); return page.slice(a, b); };

console.log('\nThe cards on the page:\n');
ok('every task has its templates, Claude, and the three buttons', LIST.every(t => { const c = card(t.id);
  return (c.match(/onclick="cardTpl\(/g) || []).length >= 3 && /cardGo\('[^']+','draft'\)/.test(c) && /Close now/.test(c) && /Move now/.test(c) && /Post note/.test(c); }));
ok('a premium due gets the premium reminders', /reminded them the premium is due/.test(card(T.prem.id)) && /Reminder e-mailed to the agent/.test(card(T.prem.id)));
ok('underwriting gets the underwriting chases', /E-mailed underwriting for where it stands/.test(card(T.uw.id)));
ok('a claim gets the Claims notes', /Complete file sent to Claims/.test(card(T.claim.id)));
ok('an orphan adoption gets the introduction', /introduced \[agent\] as their new agent/.test(card(T.orph.id)));
ok('each template says what it does', /<i class="c">closes<\/i>/.test(card(T.prem.id)) && /<i class="m">moves<\/i>/.test(card(T.prem.id)) && /<i>note<\/i>/.test(card(T.prem.id)));
ok('a closing template ticks Done; a moving one opens the date', /data-a="close"/.test(page) && /data-a="move"/.test(page) && /x\.checked=a==="close"/.test(page) && /showPicker/.test(page));
ok('Query Pal gets its note templates too', /onclick="cardTplQ\(0,this\)"/.test(page));
ok('the page carries the cards\' own signature', page.includes('"k":"' + env.replySig_('sasha', DAY, 'card') + '"') && /google\.script\.run/.test(page) && /\.cardAct\(o\)/.test(page));
ok('Save still there, and the old fields kept for it', /<button type="submit">Save<\/button>/.test(page) && page.includes('name="x_' + T.prem.id + '"') && page.includes('name="m_' + T.prem.id + '"') && page.includes('name="n_' + T.prem.id + '"'));
ok('wanting an agent, and not', env.tcardWantsAgent_({ s: 'x' }, [{ text: 'She would like a new agent to visit.' }]) && env.tcardWantsAgent_({ s: 'Client wants an agent - 123' }, []) &&
  env.tcardWantsAgent_({ s: 'Who is my new agent' }, []) && !env.tcardWantsAgent_({ s: 'x' }, [{ text: 'Underwriting needs the agent\'s signature on the form.' }]) &&
  !env.tcardWantsAgent_({ s: 'x' }, [{ text: 'Reminder e-mailed to the agent with the amount.' }]) && !env.tcardWantsAgent_({ s: 'x' }, [{ text: 'The form needs agent to sign.' }]));
ok('the kinds', env.tcardKind_({ s: 'Premium due' }, { k: 'paidto' }) === 'premium' && env.tcardKind_({ s: 'x', ty: 'Pendings' }, { k: 'pend' }) === 'pend' &&
  env.tcardKind_({ s: 'Client asked for a call back' }, { k: 'callme' }) === 'call' && env.tcardKind_({ s: 'Who is my new agent' }, { k: 'newagent' }) === 'orphan' &&
  env.tcardKind_({ s: 'Query Pal follow-up' }, { k: 'other' }) === 'query' && env.tcardKind_({ s: 'Book the review', ty: 'Opportunity' }, { k: 'opp' }) === 'newbiz' && env.tcardKind_({ s: 'zzz' }, { k: 'other' }) === 'other');

console.log('\nOn the fly:\n');
const K = env.replySig_('sasha', DAY, 'card');
const act = o => env.cardAct(Object.assign({ rs: 'sasha', d: DAY, k: K }, o));
ok('a wrong signature is refused', /expired/.test(act({ k: 'nope', id: T.prem.id, act: 'close', note: 'Called the client; paid at the branch today, receipt on file.' }).error) && !posts.length);
ok('no signature is refused', /expired/.test(env.cardAct({ rs: 'sasha', d: DAY, id: T.prem.id, act: 'note', note: 'x' }).error));
ok('the Save signature is not the cards\' one', /expired/.test(act({ k: env.replySig_('sasha', DAY, 'plan'), id: T.prem.id, act: 'note', note: 'Called the client today about it.' }).error));
ok('another day is refused', /This page is for/.test(env.cardAct({ rs: 'sasha', d: '2026-10-19', k: env.replySig_('sasha', '2026-10-19', 'card'), id: T.prem.id, act: 'note', note: 'Called the client.' }).error));
ok('a task not on their list is refused', /not on your day/.test(act({ id: '00TOTHER0000000099', act: 'close', note: 'Called the client; it is all sorted now with them.' }).error) && !posts.length);
ok('a thin note does not close', /Too thin/.test(act({ id: T.prem.id, act: 'close', note: 'done' }).error) && !posts.length && !patches.length);
ok('a [blank] left in is refused', /Fill in the \[blanks\]/.test(act({ id: T.prem.id, act: 'close', note: 'Called the client: reminded them the premium is due; they are paying by [date].' }).error) && !posts.length);

const NOTE1 = 'Called Ms Seeparsan: the premium was paid at the branch this morning; the receipt is on file.';
const r1 = act({ id: T.prem.id, act: 'close', note: NOTE1 });
ok('Close now: the note on Chatter with Save\'s head line', r1.ok && posts.length === 1 && posts[0][0] === 'FeedItem' && posts[0][1].ParentId === T.prem.id &&
  /^Sales Support · Sasha Lalla-Jagassar · [^\n]+\n\nCalled Ms Seeparsan/.test(posts[0][1].Body), JSON.stringify(r1));
ok('and the task closed in Salesforce', patches.length === 1 && patches[0][0] === T.prem.id && patches[0][1].Status === 'Completed');
ok('and the change log written', env.__sheets['Task Changes']._grid.some(r => r.includes(T.prem.id) && r.includes('Completed') && r.includes(NOTE1)));
ok('the card is told what to show', /^Closed .* · note on Chatter$/.test(r1.msg) && r1.act === 'close');
ok('pressed twice: not closed twice', act({ id: T.prem.id, act: 'close', note: NOTE1 }).already === true && posts.length === 1 && patches.length === 1);

ok('Move now needs a date', /Choose the new date/.test(act({ id: T.uw.id, act: 'move', note: 'Underwriting still needs the ECG; chasing the clinic.' }).error) && posts.length === 1);
ok('and not today', /Choose the new date/.test(act({ id: T.uw.id, act: 'move', to: DAY, note: 'Underwriting still needs the ECG; chasing the clinic.' }).error));
const r2 = act({ id: T.uw.id, act: 'move', to: '2026-10-23', note: 'E-mailed underwriting: they still need the ECG. Clinic booked for Thursday; chasing again Friday.' });
ok('Move now: note, new date, Due Moves', r2.ok && /^Moved to /.test(r2.msg) && patches.length === 2 && patches[1][1].ActivityDate === '2026-10-23' &&
  env.__sheets['Due Moves']._grid.some(r => r.includes(T.uw.id) && r.includes('2026-10-23') && r.includes('yes')), JSON.stringify(r2));

ok('the client wants an agent: no close', /wants an agent/.test(act({ id: T.agent.id, act: 'close', note: 'Called the client and went through what the policy holds with her.' }).error) && posts.length === 2);
const r3 = act({ id: T.agent.id, act: 'close', note: 'Neil Ramnanan is assigned as her agent; she has his name and number and he calls her tomorrow.' });
ok('once the agent is given, it may close', r3.ok && r3.act === 'close' && patches.length === 3);

const NOTE4 = 'Called the claimant: the death certificate is still needed; bringing it in Thursday.';
const r4 = act({ id: T.claim.id, act: 'note', note: NOTE4 });
ok('Post note: on Chatter, nothing else changes', r4.ok && posts.length === 4 && patches.length === 3 && /^Note on Chatter /.test(r4.msg));

console.log('\nSave after the cards:\n');
const ps = { ['n_' + T.prem.id]: NOTE1, ['x_' + T.prem.id]: '1', ['n_' + T.claim.id]: NOTE4, ['n_' + T.orph.id]: 'Called the client: introduced Neil as their new agent; they have his name and number in writing.', ['x_' + T.orph.id]: '1' };
const all = () => [];
const saved = env.sdSave_(person, DAY, ps, all).getContent();
const orphPosts = posts.filter(x => x[1].ParentId === T.orph.id);
ok('Save: the card already closed is not posted or closed again', posts.filter(x => x[1].ParentId === T.prem.id).length === 1 && patches.filter(x => x[0] === T.prem.id).length === 1);
ok('the same note already posted from its card is not posted again', posts.filter(x => x[1].ParentId === T.claim.id).length === 1);
ok('everything else saves as before', orphPosts.length === 1 && patches.some(x => x[0] === T.orph.id && x[1].Status === 'Completed'));
ok('and the page says so', /closed earlier from its card/.test(saved) && /already saved from its card/.test(saved));

console.log('\nClaude:\n');
reply = JSON.stringify({ note: 'Called Mr Ravi: the ECG is booked at the clinic for [date]; I will send the results to underwriting after.', action: 'move', warn: '' });
const d1 = act({ id: T.uw.id, act: 'draft', note: 'called ravi ecg booked thursday will send to uw' });
ok('Draft with Claude: the note comes back, nothing posted', d1.ok && /ECG is booked/.test(d1.note) && d1.action === 'move' && posts.length === 5);
const sent = asked[asked.length - 1], prompt = sent.messages[0].content;
ok('their words and the task\'s Chatter went to Claude', /"they_said":"called ravi ecg booked thursday will send to uw"/.test(prompt) && /Underwriting asked for the ECG/.test(prompt) && /Only "they_said" comes from them/.test(prompt));
ok('the branch standard and no invented facts', /what was done, who was contacted, the outcome, and the next step/.test(prompt) && /Never invent an amount, a date, a policy number, a name/.test(prompt) && /\[blank\]/.test(prompt));
ok('a fast model by default', sent.model === env.CLAUDE_READ.MODEL && sent.max_tokens <= 600);
reply = JSON.stringify({ note: 'Spoke to the client and explained the policy.', action: 'close', warn: '' });
const d2 = act({ id: T.agent.id, act: 'draft', note: 'spoke to her, explained' });
ok('a client who wants an agent: Claude\'s close becomes a move, with the reason', d2.ok && d2.action === 'move' && /agent/.test(d2.warn) && /"client_wants_agent":true/.test(asked[asked.length - 1].messages[0].content));
reply = 'Called the client: the statement request is with Customer Service.';
const d3 = act({ id: T.claim.id, act: 'draft', note: '' });
ok('a plain answer is used as the note', d3.ok && /statement request/.test(d3.note) && d3.action === 'note');
P.setProperty('ANTHROPIC_API_KEY', '');
const n0 = asked.length, d4 = act({ id: T.claim.id, act: 'draft', note: 'x' });
ok('no Claude key: says so, calls nobody', !d4.ok && /Claude is not set up/.test(d4.error) && asked.length === n0);

console.log('\nThe day\'s record of the cards:\n');
const rec = JSON.parse(P.getProperty('tcard_sasha_' + DAY) || '{}');
ok('kept for the day, by task', rec[T.prem.id].a === 'close' && rec[T.uw.id].a === 'move' && rec[T.uw.id].to === '2026-10-23' && rec[T.claim.id].a === 'note');
P.setProperty('tcard_sasha_2026-09-01', '{}');
env.sdPrune_(DAY);
ok('and pruned with the rest after three weeks', P.getProperty('tcard_sasha_2026-09-01') == null && P.getProperty('tcard_sasha_' + DAY) != null);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
