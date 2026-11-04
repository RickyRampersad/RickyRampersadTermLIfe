// The trail rule for the tracker's own Chatter (Ricky, 3 Nov 2026: "chatter on the trails"; 2026-11-03c).
// Pinned: a service rating opened five times by a mail scanner posts nothing, and once confirmed posts ONE reply on
// the task's trail; a rating changed later edits that note, never adds one; a task with no Chatter gets a new post;
// a thread older than 14 days gets a new post; the assignment board's line goes on ONE of a client's open tasks
// (the orphan assignment task first), as a reply under the Branch Manager's latest post.
const path = require('path');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

// ---- KPI.gs: sfTrailPost_ ------------------------------------------------------------------
{
  delete process.env.GS_PATH;
  delete require.cache[require.resolve('./harness')];
  const { makeEnv } = require('./harness');
  const env = makeEnv();
  const now = Date.now(), iso = ms => new Date(ms).toISOString().replace('Z', '+0000');
  const FEED = {
    '00TLIVE': [{ Id: '0D5A', CreatedById: '005RICKY', CreatedDate: iso(now - 3600e3), Body: 'Branch Manager · Ricky Rampersad · Tue 3 Nov\n\nLiz, please post...' },
                { Id: '0D5B', CreatedById: '005LIZ', CreatedDate: iso(now - 7200e3), Body: 'Called the client.' }],
    '00TOLD': [{ Id: '0D5C', CreatedById: '005LIZ', CreatedDate: iso(now - 20 * 86400e3), Body: 'Old note.' }],
    '00TNONE': []
  };
  const posts = [];
  env.sfkQuery_ = q => { const m = q.match(/ParentId = '([^']+)'/); return m ? (FEED[m[1]] || []) : []; };
  env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'ID' + posts.length; };
  let r = env.sfTrailPost_('00TLIVE', 'SERVICE RATING · 4 of 5', { authorId: '005LIZ' });
  ok('a live thread: a reply, under the rated person\'s latest post', r.kind === 'comment' && posts[0][0] === 'FeedComment' && posts[0][1].FeedItemId === '0D5B', JSON.stringify(posts));
  posts.length = 0;
  r = env.sfTrailPost_('00TLIVE', 'x', {});
  ok('no author asked: under the latest post', posts[0][0] === 'FeedComment' && posts[0][1].FeedItemId === '0D5A');
  posts.length = 0;
  r = env.sfTrailPost_('00TNONE', 'x', {});
  ok('no Chatter on the task: a new post', r.kind === 'post' && posts[0][0] === 'FeedItem' && posts[0][1].ParentId === '00TNONE');
  posts.length = 0;
  r = env.sfTrailPost_('00TOLD', 'x', {});
  ok('latest post older than 14 days: a new post', r.kind === 'post' && posts[0][0] === 'FeedItem');
  posts.length = 0;
  env.sfkInsert_ = (o, b) => { if (o === 'FeedComment') throw new Error('refused'); posts.push([o, b]); return 'P'; };
  r = env.sfTrailPost_('00TLIVE', 'x', {});
  ok('a reply refused: one new post instead, never lost', r.kind === 'post' && posts.length === 1 && posts[0][0] === 'FeedItem');

  // rateChatter_: the same row confirmed twice -> one note, then an edit
  posts.length = 0;
  env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'C' + posts.length; };
  const patched = []; env.sfkPatch_ = (o, id, b) => { patched.push([o, id, b]); return true; };
  env.sfkUsers_ = () => ({ elizabeth: { id: '005LIZ' } });
  env.gameFirst_ = s => 'Elizabeth';
  const row = { Token: 'rTEST1', Kind: 'agent', ToName: 'Neil Ramnanan', Closer: 'elizabeth', TaskId: '00TLIVE' };
  env.rateChatter_(row, 3, '');
  env.rateChatter_(Object.assign({}, row), 5, '');
  ok('one rating confirmed, then changed: one reply, then that reply edited', posts.length === 1 && posts[0][0] === 'FeedComment' && patched.length === 1 && patched[0][0] === 'FeedComment' && /5 of 5/.test(patched[0][2].CommentBody), JSON.stringify({ posts, patched }));
}

// ---- Transition.gs: the board's line on ONE task, on the trail ----------------------------------
{
  process.env.GS_PATH = path.join(__dirname, '..', 'apps-script', 'Transition.gs');
  delete require.cache[require.resolve('./harness')];
  const { makeEnv } = require('./harness');
  const e = makeEnv({ props: {} });
  const now = Date.now(), iso = ms => new Date(ms).toISOString().replace('Z', '+0000');
  const sent = [];
  e.tSfOn_ = () => true;
  e.tSfOpenTasks_ = () => ({ recs: [{ id: 'a01', contact: '003X' }], open: [
    { Id: '00TRESP', Subject: 'Orphan response: confirm what the policy pays - 5002897487 AVENASH DHANIRAM', Owner: { Name: 'Sasha' } },
    { Id: '00TASSIGN', Subject: 'Orphan assignment: Neil Ramnanan to contact client - 5002897487 AVENASH DHANIRAM', Owner: { Name: 'Sasha' } }] });
  e.tSfQuery_ = q => /ParentId = '00TASSIGN'/.test(q) ? [
    { Id: '0D5NEW', CreatedDate: iso(now - 60e3), Body: 'From the assignment board · Neil (Agent): Called' },
    { Id: '0D5BM', CreatedDate: iso(now - 86400e3), Body: 'Branch Manager · Ricky Rampersad · Mon 2 Nov\n\nSasha, I have assigned Neil...' }] : [];
  e.tSfSend_ = (m, p, b) => { sent.push([p, b]); return { id: 'X' }; };
  const res = e.tSfNoteTasks_('tok', 'c1', null, 'From the assignment board · Neil Ramnanan (Agent), 3 Nov 2026 12:32: Closed · Service questionnaire submitted');
  ok('two open tasks for one client: the line goes on one only', res.posted === 1 && sent.length === 1, JSON.stringify(sent));
  ok('the orphan assignment task, as a reply under the Branch Manager\'s latest post', sent[0][0] === '/sobjects/FeedComment' && sent[0][1].FeedItemId === '0D5BM', JSON.stringify(sent));
  sent.length = 0;
  e.tSfQuery_ = () => [];
  e.tSfNoteTasks_('tok', 'c1', null, 'From the assignment board · x');
  ok('a task with no Chatter: a new post', sent.length === 1 && sent[0][0] === '/sobjects/FeedItem' && sent[0][1].ParentId === '00TASSIGN');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
