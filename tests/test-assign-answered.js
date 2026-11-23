// "Who do I assign?" answered once is answered (23 Nov 2026). Ricky: "reply to the chatter trail ... ask why is this still being asked of me
// if I did ask ... ensure this rule is fixed, ensuring replying from the trail".
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
const DAY = '2026-11-23';

console.log('\nAn AGENT NAMED post answers the ask; a later ask still waits:\n');
env.bmSfId_ = () => '005ME';
env.nameFor_ = s => s;
env.roster_ = () => [];
env.sfkUsers_ = () => ({ azariah: { id: '005AZ' }, sasha: { id: '005SA' } });
const posts = [
  { Id: '0D5A1', ParentId: '00TNAMED', CreatedById: '005AZ', CreatedDate: '2026-11-19T19:17:00.000+0000', Body: 'Hi Mr Rampersad, Reminder to assign an agent for the below please.' },
  { Id: '0D5A1', ParentId: '00TNAMED', CreatedById: '005ME', CreatedDate: '2026-11-19T23:59:00.000+0000', Body: 'AGENT NAMED: Darryl Manick, 18 Nov 2026 (by Ricky Rampersad).' },
  { Id: '0D5B1', ParentId: '00TOPEN', CreatedById: '005AZ', CreatedDate: '2026-11-20T16:45:00.000+0000', Body: 'Hi Mr Rampersad, Please advise who to assign this to' },
  { Id: '0D7C2', FeedItemId: '0D5C1', ParentId: '00TREPLY', CreatedById: '005SA', CreatedDate: '2026-11-20T15:30:00.000+0000', CommentBody: 'Hi Mr. Rampersad, Gentle reminder to let me know who to assign client to' }
];
const qs = [];
env.sfkQuery_ = q => {
  qs.push(q);
  if (/FROM FeedComment/.test(q)) return posts.filter(p => p.CommentBody);
  if (/FROM FeedItem/.test(q)) return posts.filter(p => !p.CommentBody);
  if (/FROM Task WHERE Id IN/.test(q)) return ['00TNAMED', '00TOPEN', '00TREPLY'].map(Id => ({ Id, Subject: 'Orphan response ' + Id, IsClosed: false }));
  return [];
};
const w = env.bmWaiting_(DAY);
const ids = w.ask.map(a => a.id);
ok('the task an agent was named on is off his list', ids.indexOf('00TNAMED') < 0, JSON.stringify(ids));
ok('an ask nobody answered still waits', ids.indexOf('00TOPEN') > -1);
ok('each ask carries the thread that asked: the post itself', (w.ask.filter(a => a.id === '00TOPEN')[0] || {}).thread === '0D5B1', JSON.stringify(w.ask));
ok('or, for a reply, the post it replied under', (w.ask.filter(a => a.id === '00TREPLY')[0] || {}).thread === '0D5C1', JSON.stringify(w.ask));
ok('the reply question asks for FeedItemId', qs.some(q => /SELECT Id, FeedItemId, ParentId/.test(q) && /FROM FeedComment/.test(q)), qs.join('\n'));

console.log('\nHis answer goes under the post that asked:\n');
const ins = [];
env.sfkInsert_ = (o, b) => { ins.push({ o, b }); return o === 'FeedComment' ? '0D7NEW' : '0D5NEW'; };
env.sfkQuery_ = () => [{ Id: '0D5LIVE', CreatedById: '005X', CreatedDate: new Date().toISOString().replace('Z', '+0000'), Body: 'Live post.' }];
env.sfNote_({ ParentId: '00TOPEN', Body: 'Branch Manager · Ricky Rampersad · Mon 23 Nov\n\nAzariah, Darryl was named on 18 Nov.', under: '0D5B1' });
ok('a reply under the asking post, not the newest one', ins[0] && ins[0].o === 'FeedComment' && ins[0].b.FeedItemId === '0D5B1', JSON.stringify(ins[0]));
ok('and no stray field reaches Salesforce', ins[0] && Object.keys(ins[0].b).sort().join() === 'CommentBody,FeedItemId', JSON.stringify(ins[0]));
env.sfNote_({ ParentId: '00TOPEN', Body: 'A plain note.' });
ok('without one, the live trail as before', ins[1] && ins[1].b.FeedItemId === '0D5LIVE', JSON.stringify(ins[1]));

console.log('\nThe agent already named goes into Claude\'s draft:\n');
env.sfkQuery_ = q => {
  if (/FROM Task WHERE Id IN/.test(q) && /WhatId/.test(q)) return [{ Id: '00TOPEN', WhatId: 'a02PF1', WhoId: '003C1' }];
  if (/FROM CLIENT_PORTFOLIO__c/.test(q)) return [{ Id: 'a02PF1', POLICY__c: '5004108374', Contact__c: '003C1', Assigned_Agent__r: { Name: 'Darryl Manick' }, Date_Assigned_to_Agent__c: '2026-11-18' }];
  return [];
};
const nm = env.taskAgentNamed_(['00TOPEN']);
ok('the naming is read off the policy record the task sits on', nm['00TOPEN'] && nm['00TOPEN'].agent === 'Darryl Manick' && nm['00TOPEN'].on === '2026-11-18' && nm['00TOPEN'].policy === '5004108374', JSON.stringify(nm));
env.umTaskContext_ = () => ({ record: null, related: [] });
env.playbookFor_ = () => ({});
const pr = env.bmDeepPrompt_('2026-11-23', [{ id: '00TOPEN', k: 'ask', s: 'Orphan response', by: 'Azariah Griffith', said: 'Please advise who to assign this to', named: nm['00TOPEN'], askedAfter: true }], '', {}, []);
ok('Claude is told who was named, when, and on which policy', /"agent_already_named":\{"agent":"Darryl Manick","named_on":"2026-11-18","policy_record":"5004108374","asked_after_it_was_named":true\}/.test(pr.prompt), pr.prompt.slice(-400));
ok('and to ask for an official response, never to put the naming back to him', /official response/.test(pr.prompt) && /never leave the naming as a \[blank\]/.test(pr.prompt));
const plain = env.namedAskNote_({ by: 'Azariah Griffith', named: nm['00TOPEN'], askedAfter: true });
ok('without Claude, a plain note says it and asks why', /^Azariah: this was decided\. Darryl Manick was named on .+5004108374/.test(plain) && /official response/.test(plain), plain);
ok('an ask before the naming is not asked why', !/official response/.test(env.namedAskNote_({ by: 'Sasha L', named: nm['00TOPEN'], askedAfter: false })));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
