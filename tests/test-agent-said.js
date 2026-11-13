// What we did with what you told us (13 November 2026, 2026-11-13b).
//
// Ricky: "Cases that they have been commented on, have that at the top to say what we've done for you ... It is unfair to the
// agents to be posting ... and there is no responses." The midday e-mail opens with each case the agent commented on and the
// first word from the branch after it, or that nobody has answered.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
const DAY = '2026-11-13';
const a = { key: 'a-malcolm-sooknanan', name: 'Malcolm Sooknanan', agentName: 'Malcolm Sooknanan' };
const open = { 'a-malcolm-sooknanan': [
  { id: 'T1', subject: 'Orphan Project: follow up re client one', owner: 'Sasha Lalla-Jagassar' },
  { id: 'T2', subject: 'Pendings: medical outstanding', owner: 'Azariah Griffith' },
  { id: 'T4', subject: 'Servicing: nothing said here', owner: 'Elizabeth Lee' }] };
env.sfkUsers_ = () => ({ sasha: { id: 'U1' } });
env.nameFor_ = s => ({ sasha: 'Sasha Lalla-Jagassar' })[s] || s;
env.sfkQuery_ = q => {
  if (/FROM Task/.test(q)) return [{ Id: 'T3', Subject: 'Claim: client three', Owner: { Name: 'Elizabeth Lee' }, Agent__c: 'C1', CompletedDateTime: '2026-11-12T19:00:00.000+0000' }];
  if (/FROM FeedItem/.test(q)) return [
    { ParentId: 'T1', CreatedById: 'U0', CreatedDate: '2026-11-12T14:10:00.000+0000', Body: 'From the assignment board · Malcolm Sooknanan (Agent), 12 Nov 2026 10:10:\n\nSpoke to the client, SQ signed.' },
    { ParentId: 'T1', CreatedById: 'U1', CreatedDate: '2026-11-12T16:00:00.000+0000', Body: 'Thank you Malcolm, submitted to Customer Service.' },
    { ParentId: 'T2', CreatedById: 'U0', CreatedDate: '2026-11-12T13:00:00.000+0000', Body: 'Agent · Malcolm Sooknanan · Thu 12 Nov 9:00am\n\nClient did the medical on Tuesday.' },
    { ParentId: 'T2', CreatedById: 'U0', CreatedDate: '2026-11-12T15:00:00.000+0000', Body: 'Branch Intelligence · Thu 12 Nov: this task has had no note for 3 days.' },
    { ParentId: 'T3', CreatedById: 'U0', CreatedDate: '2026-11-12T12:00:00.000+0000', Body: 'Agent · Malcolm Sooknanan · Thu 12 Nov 8:00am\n\nClaim form handed in.' },
    { ParentId: 'T4', CreatedById: 'U1', CreatedDate: '2026-11-12T12:00:00.000+0000', Body: 'Working on it.' }];
  return [];
};
const said = env.agSaid_([a], DAY, ["Agent__c IN ('C1')"], () => 'a-malcolm-sooknanan', open)['a-malcolm-sooknanan'];
ok('three cases he commented on (not the one he did not)', said.length === 3, JSON.stringify(said.map(x => x.id)));
ok('unanswered first', said[0].id === 'T2', said[0].id);
const t1 = said.find(x => x.id === 'T1'), t2 = said.find(x => x.id === 'T2'), t3 = said.find(x => x.id === 'T3');
ok('T1 answered by Sasha', t1.resp && t1.resp.by === 'Sasha', JSON.stringify(t1.resp));
ok('his words without the board heading', t1.said === 'Spoke to the client, SQ signed.', t1.said);
ok('a Branch Intelligence note is not an answer', !t2.resp && !t2.closed);
ok('a task closed after his comment counts as done', !!t3.closed && !t3.resp);
const html = env.agSaidHtml_(said);
ok('the section names what we did', /What we have done with what you told us/.test(html) && /1 waiting on us/.test(html) && /2 answered/.test(html), html.slice(0, 400));
ok('the time is local: 12 Nov 12:00pm', /answered 12 Nov 12:00pm/.test(html) || /answered Thu 12 Nov 12:00pm/.test(html), (html.match(/answered [^:]*:\d\d[ap]m/) || [''])[0]);
ok('the wait says who has it', /No reply yet · with Azariah/.test(html));
ok('nothing to say, nothing shown', env.agSaidHtml_([]) === '');
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
