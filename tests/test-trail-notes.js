// The Chatter trail and Claude for the Branch Manager alone (19 Nov 2026).
// Ricky: "only I have that privilege and no others, as I do not want to waste my credits"; "continue the trails on the chatter";
// "I need to see the chatter trails, and so does the agents viewing their logs".
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
const NOW = new Date().toISOString().replace('Z', '+0000');

console.log('\nClaude is his alone:\n');
ok('Mr Rampersad, nobody else', env.claudeFor_('ricky') && !['kamla', 'akaash', 'sasha', 'elizabeth', 'azariah', 'pawan'].some(env.claudeFor_));
ok('the tracker\'s own background reads are off unless CLAUDE_SYSTEM reads on', !env.claudeSystemOn_());
env.PropertiesService.getScriptProperties().setProperty('CLAUDE_SYSTEM', 'on');
ok('and on when it does', env.claudeSystemOn_());
env.PropertiesService.getScriptProperties().setProperty('CLAUDE_SYSTEM', '');
const r = env.umDraft_({ rs: 'akaash', d: '2026-11-19', k: env.replySig_('akaash', '2026-11-19', 'um'), id: '00T1' });
ok('Draft my reply refuses the Unit Manager', !r.ok && /Branch Manager's alone/.test(r.error), JSON.stringify(r));

console.log('\nA note goes on the trail:\n');
const ins = [], qs = [];
let feed = [{ Id: '0D5LIVE', CreatedById: '005X', CreatedDate: NOW, Body: 'Client called back.' }];
env.sfkQuery_ = q => { qs.push(q); return /FROM FeedItem WHERE ParentId = '00TTRAIL/.test(q) ? feed : /FROM FeedComment/.test(q) ? [{ ParentId: '00TA', CreatedById: '005ME', CreatedDate: NOW, CommentBody: 'His reply.' }] : /FROM FeedItem/.test(q) ? [{ ParentId: '00TA', CreatedById: '005Y', CreatedDate: NOW, Body: 'Her ask.' }] : []; };
env.sfkInsert_ = (o, b) => { ins.push({ o, b }); return o === 'FeedComment' ? '0D7NEW' : '0D5NEW'; };
let id = env.sfNote_({ ParentId: '00TTRAIL', Body: 'Sales Support · Liz Lee · Thu 19 Nov 7:10am\n\nCalled, will pay online on 30 Nov.' });
ok('a reply under the task\'s live post, not a new post', ins[0].o === 'FeedComment' && ins[0].b.FeedItemId === '0D5LIVE' && /will pay online/.test(ins[0].b.CommentBody) && id === '0D7NEW', JSON.stringify(ins[0]));
feed = [];
env.sfNote_({ ParentId: '00TTRAIL', Body: 'First note.' });
ok('a new post only when the task has no Chatter yet', ins[1].o === 'FeedItem' && ins[1].b.ParentId === '00TTRAIL');
env.sfNote_({ ParentId: '001ACCOUNT', Body: 'On an account.' });
ok('anything not a task is posted as before', ins[2].o === 'FeedItem' && ins[2].b.ParentId === '001ACCOUNT');

console.log('\nEvery count of notes reads the replies too:\n');
qs.length = 0;
const rows = env.sfkNotes_("SELECT ParentId, CreatedById, CreatedDate, Body FROM FeedItem WHERE Type = 'TextPost' AND CreatedDate >= 2026-11-19T00:00:00Z ORDER BY CreatedDate ASC LIMIT 2000");
ok('posts and replies together, a reply carrying Body', rows.length === 2 && rows.some(x => x.Body === 'His reply.') && rows.some(x => x.Body === 'Her ask.'));
ok('the reply question is FeedComment, CommentBody, no Type', /SELECT ParentId, CreatedById, CreatedDate, CommentBody FROM FeedComment WHERE CreatedDate >= /.test(qs[1]) && !/Type/.test(qs[1]), qs[1]);
qs.length = 0;
env.sfkNotes_("SELECT CreatedDate FROM FeedItem WHERE CreatedById = '005A' AND CreatedDate >= X AND CreatedDate < Y AND Type IN ('TextPost','ContentPost','LinkPost') LIMIT 500");
ok('a Type IN clause comes off too', /FROM FeedComment WHERE CreatedById = '005A' AND CreatedDate >= X AND CreatedDate < Y LIMIT 500$/.test(qs[1]), qs[1]);

console.log('\nHis waiting list carries the trail and the quick read:\n');
env.bmDeepGet_ = () => ({});
env.ixDeepGet_ = () => ({});
env.CacheService.getScriptCache().put('bmd_adv_2026-11-19', JSON.stringify({ 'a:00TQ': { act: 'reply', why: 'Liz asks you', note: 'Liz, noted. Close it once the payment shows.', ai: true } }));
env.cmdChatter_ = () => ({ '00TQ': [{ day: '2026-11-18', by: 'Elizabeth Lee', text: 'Paid?', reply: true }, { day: '2026-11-17', by: 'Elizabeth Lee', text: 'Called the client.' }] });
const w = env.leadWaiting_('2026-11-19', [{ k: 'ask', t: '00TQ', s: 'Courtesy Reminder', by: 'Elizabeth Lee', said: 'will pay online' }]);
ok('the quick draft where the full read has not reached it', w[0].draft === 'Liz, noted. Close it once the payment shows.' && w[0].depth === 'quick', JSON.stringify(w[0]));
ok('the whole trail, oldest first', w[0].trail.length === 2 && w[0].trail[0].text === 'Called the client.' && w[0].trail[1].reply, JSON.stringify(w[0].trail));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
