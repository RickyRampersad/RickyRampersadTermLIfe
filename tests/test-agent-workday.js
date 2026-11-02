// The agent's day on My day (29 October 2026, 2026-10-29e).
//
// Ricky, 12:41pm, with the agents' midday e-mail opening the white projection page: "my trigger at 12 is showing this". Pinned
// here:
//   - an agent's own e-mail link opens their day on My day; a preview copy (an agent not yet in the pilot) opens it too, marked
//     preview; the branch app sign-in for an agent outside the pilot still says it is coming;
//   - the day as data: the tiles, the seven lines with what was projected and done, the tasks being worked with their last notes
//     and the agent's name, what the branch closed for them today; the close-off opens at noon;
//   - the projection and the close-off save from the screen with every line needed, the same rows and copy as the page; the
//     balance comes back; an update posts on the task's Chatter as the agent; a task not on their list is refused;
//   - the morning, midday and 5:30 e-mails open My day at the projection, a task, the close-off, with the full page below.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-29';
const env = makeEnv();
env.todayISO_ = () => DAY;
const realDate = env.Date; let NOW = new Date(DAY + 'T12:41:00');
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); }, get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
env.__mkSheet('Agent Day', 1, env.AGDAY.head, []);
const P = env.PropertiesService.getScriptProperties();
P.setProperty('MANAGER_EMAIL', 'ricky@example.com');
const mails = []; env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const AG = {
  'a-neil-ramnanan': { key: 'a-neil-ramnanan', name: 'Neil Ramnanan', agentName: 'Neil Ramnanan', agentId: 'A10024', code: 'A10024', email: 'neil@example.com', manager: 'akaash@example.com' },
  'a-faizal-mohammed': { key: 'a-faizal-mohammed', name: 'Faizal Mohammed', agentName: 'Faizal Mohammed', agentId: 'A99999', code: 'A99999', email: 'faizal@example.com', manager: '' } };
env.agentPeople_ = () => AG;
env.agentManagerEmail_ = a => a.manager;
env.bigPut_('ag_items_a-neil-ramnanan_' + DAY, [
  { id: '00TAG1', s: 'Premium due - Marcus Bailey', o: 'Sasha Lalla-Jagassar', due: '2026-10-27', late: true },
  { id: '00TAG2', s: 'Pending - medicals - Ann Ali', o: 'Azariah Griffith', due: DAY, late: false }]);
env.cmdChatter_ = ids => ({ '00TAG1': [{ text: 'Sales Support · Sasha Lalla-Jagassar · Wed 28 Oct 9:02am\n\nCalled, no answer; trying again tomorrow.', by: 'Ricky Rampersad', day: '2026-10-28' },
  { text: 'Left a voicemail.', by: 'Sasha Lalla-Jagassar', day: '2026-10-27' }, { text: 'Older', by: 'X', day: '2026-10-20' }] });
let queries = [];
env.sfkQuery_ = q => { queries.push(q); return /IsClosed = true AND Agent__r.Name IN/.test(q) ? [{ Id: '00TAG2', Subject: 'Pending - medicals - Ann Ali', Owner: { Name: 'Azariah Griffith' } }] : []; };
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'FEED' + posts.length; };
const link = key => ({ wd: key, k: env.workSig_(key) });

console.log('\nOpening it:\n');
let m = env.workdayGet_(link('a-neil-ramnanan'));
ok('Neil\'s own e-mail link opens his day, on this screen', m.ok && m.agent && m.on && m.native && !m.preview && m.first === 'Neil', JSON.stringify(m).slice(0, 160));
const fz = env.workdayGet_(link('a-faizal-mohammed'));
ok('a preview copy (Faizal, not yet in the pilot) opens too, marked preview', fz.ok && fz.agent && fz.on && fz.preview === true);
ok('a link that is not right is refused', !env.workdayGet_({ wd: 'a-neil-ramnanan', k: 'nope' }).ok);
env.wdOpsWho_ = () => ({ name: 'Faizal Mohammed', role: 'Agent', agentNo: 'A99999', email: 'faizal@example.com' });
const viaApp = env.workdayGet_({ wd: 'app', ops: 'T'.repeat(32) });
ok('from the branch app, an agent outside the pilot is still told it is coming', viaApp.ok && viaApp.agent && viaApp.on === false && !viaApp.native, JSON.stringify(viaApp).slice(0, 120));

console.log('\nThe day, as data:\n');
ok('the seven lines, nothing projected yet', m.metrics.length === 7 && m.metrics.every(x => x.planned === '' && x.done === '') && m.metrics[0].p === 'Calls to make' && m.metrics[0].d === 'Calls made');
ok('the tasks being worked: who has each, overdue, its last two notes and how many more', m.items.length === 2 && m.items[0].o === 'Sasha' && m.items[0].late && m.items[0].notes.length === 2 && m.items[0].more === 1 && m.items[0].notes[0].who === 'Sasha' && /Called, no answer/.test(m.items[0].notes[0].s), JSON.stringify(m.items[0]));
ok('what the branch closed for him today, ticked on the list', m.closedToday.length === 1 && m.closedToday[0].o === 'Azariah' && m.items[1].done === true);
ok('the tiles: 1 still being worked, 1 overdue, 1 closed', m.tiles.worked === 1 && m.tiles.late === 1 && m.tiles.closed === 1, JSON.stringify(m.tiles));
ok('past 10:30 with no projection: said so', m.lateForPlan === true && m.absentAt === '10:30am');
ok('the close-off is open from noon', m.close.open === true && !m.close.done);

console.log('\nSaving from the screen:\n');
const post = (key, o) => env.workdayPost_(Object.assign(link(key), o));
let r = post('a-neil-ramnanan', { act: 'agplan', m_calls: '10', n_calls: 'Book review clients' });
ok('a projection with lines left blank is refused, and says how many', !r.ok && /6 left blank/.test(r.error), JSON.stringify(r));
const full = (kind, nums) => Object.assign({ act: kind, summary: kind === 'agplan' ? 'Seeing the Alis at 2' : 'Good day' }, ...['calls', 'appts', 'ff', 'close', 'apps', 'dues', 'pend'].map((k, i) => ({ ['m_' + k]: String(nums[i]), ['n_' + k]: '' })));
r = post('a-neil-ramnanan', full('agplan', [10, 3, 2, 1, 1, 5, 2]));
ok('the projection saves: rows written, the day comes back with it set', r.ok && r.saved.act === 'agplan' && r.project.done && r.metrics[0].planned === '10' && r.summary.plan === 'Seeing the Alis at 2', JSON.stringify(r.saved));
ok('his manager gets the copy, as from the page', mails.some(x => /^Projection received · Neil Ramnanan/.test(x.subject) && /akaash@example.com/.test(x.to)), mails.map(x => x.subject).join(' | '));
r = post('a-neil-ramnanan', full('agclose', [12, 2, 2, 1, 0, 5, 2]));
ok('the close-off saves, and the balance comes back: 24 projected, 24 done', r.ok && r.close.done && r.balance && r.balance.proj === 24 && r.balance.done === 24 && r.balance.text === 'even' && r.metrics[0].done === '12', JSON.stringify(r.balance));
const pn = posts.length;
r = post('a-neil-ramnanan', { act: 'agnote', id: '00TAG1', text: 'Mr Bailey says he pays Friday at the bank.' });
ok('an update posts on the task\'s Chatter, headed with his name', r.ok && posts.length === pn + 1 && posts[pn][1].ParentId === '00TAG1' && /^Agent · Neil Ramnanan · /.test(posts[pn][1].Body) && /pays Friday/.test(posts[pn][1].Body), JSON.stringify(posts[pn]));
ok('a task not on his list is refused', !post('a-neil-ramnanan', { act: 'agnote', id: '00TNOPE', text: 'x' }).ok && posts.length === pn + 1);
ok('nor anything else', !post('a-neil-ramnanan', { act: 'checkin' }).ok);

console.log('\nThe e-mails open it:\n');
const data = { open: { 'a-neil-ramnanan': [{ id: '00TAG1', subject: 'Premium due - Marcus Bailey', owner: 'Sasha Lalla-Jagassar', due: '2026-10-27', late: true }] }, closed: { 'a-neil-ramnanan': [] }, ff: { 'a-neil-ramnanan': [] }, f360: {}, goal: {}, q: {}, orphan: {} };
env.agentLiveFor_ = () => true;
mails.length = 0; env.agentMiddayMail_(AG['a-neil-ramnanan'], DAY, data);
const md = mails[0].htmlBody;
ok('midday: My day at the projection, the full page below', /myworkday\/\?p=a-neil-ramnanan&(amp;)?k=[^"&]+&(amp;)?go=agplan/.test(md) && /the same on the full page/.test(md) && /f=ag&/.test(md.replace(/&amp;/g, '&')), (md.match(/href="[^"]+"/g) || []).join(' '));
mails.length = 0; env.agentEveningMail_(AG['a-neil-ramnanan'], DAY, data);
ok('5:30: My day at the close-off', /go=agclose/.test(mails[0].htmlBody) && /f=agc/.test(mails[0].htmlBody));
mails.length = 0; env.agentMorningMail_(AG['a-neil-ramnanan'], DAY, data, null);
ok('morning: the projection, and each task opens on My day', /go=agplan/.test(mails[0].htmlBody) && /go=agitems&(amp;)?t=00TAG1/.test(mails[0].htmlBody), (mails[0].htmlBody.match(/href="[^"]+"/g) || []).slice(0, 6).join(' '));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
