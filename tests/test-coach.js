// The day's coach, what is new for you, and Claude for the managers only (29 October 2026, 2026-10-29b).
//
// Ricky, 6:45am: "remind them about the lunchtime, and we can put a note on top there. Remember, 30 minutes, the progress update
// before you leave to lunch ... built-in intelligence will tell you 30 minutes before you need to scrub ... letting them know the
// expectations when you set in", "what things came in during the morning and routed, and new task open, sensing the urgency with the
// chatter tasks", and "Claude AI, it's only for the branch manager and the unit manager ... and the BMA so far, right? Not the staff."
// Pinned here:
//   coach   the stops come from the desk's own hours (check in, scrub, the update 30 minutes before lunch, lunch, the scrub after,
//           close my day, the finish), each done or not from what happened; one line for each stretch of the day, none overlapping,
//           with the numbers: what lunch needs, what is left; a flexible lunch has a midday update and no lunch; before check-in, not
//           checked in, absent and closed each say so;
//   news    routed to them today (never their own scrub or their own task); notes on their open tasks by anyone else, who wrote it
//           and whether they answered; the urgent and unanswered first; the chase counted, not listed; the tracker's follow-ups left
//           out, ACTION REQUIRED kept; one read of Salesforce for every desk, kept three minutes;
//   claude  a desk's card, its day page and Brief me have no Claude; Kamla, Akaash and Mr Rampersad keep it;
//   marks   createTask_ marks a task as the desk's own, and a scrub's time.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
const DAY = '2026-10-29';
env.todayISO_ = () => DAY;
const H = (h, m) => h * 60 + (m || 0);
const base = { closed: 3, target: 10, unnoted: 1, overdue: 4, dueToday: 5, proj: 9, sf: true, late: 0 };
const coach = (sid, now, o) => env.wdCoach_(sid, DAY, now, Object.assign({}, base, o || {}));
const line = (c, now) => c.lines.find(l => now >= l.from && now < l.to);

console.log('\nThe stops, from the desk\'s own hours (Azariah: 8 to 4, lunch 1 to 2):\n');
let c = coach('azariah', H(9), { inM: H(7, 58), scrubs: [H(8, 20)] });
ok('check in, scrub, update, lunch, scrub, close my day, the finish', c.stops.map(s => s.k + '@' + s.t).join() === 'in@8:00am,scrub@8:15am,update@12:30pm,lunch@1:00pm,scrub2@2:00pm,close@3:15pm,end@4:00pm', c.stops.map(s => s.k + '@' + s.t).join());
ok('in and the morning scrub done; the afternoon one not yet', c.stops[0].done && c.stops[1].done && !c.stops[4].done);
ok('lunch is done when it is over, never missed', c.stops[3].doneAt === H(14) && c.stops[3].miss === null);
const windows = c.lines.map(l => l.k + '[' + l.from + ',' + l.to + ')').join(' ');
ok('one line for each stretch, in order, none overlapping', c.lines.every((l, i) => l.from < l.to && (i === 0 || l.from === c.lines[i - 1].to)) && c.lines[0].from === 0 && c.lines[c.lines.length - 1].to === 1440, windows);
ok('the stretches: start, morning, update, lunch, back, afternoon, close, late', c.lines.map(l => l.k).join() === 'start,morning,update,lunch,back,afternoon,close,late', windows);

console.log('\nThe lines, with the numbers:\n');
let l = line(c, H(8, 10));
ok('at check-in: what today asks, the expectations listed', l.k === 'start' && /close 10/.test(l.h) && l.items.length === 5 && /Update by 12:30pm, before lunch at 1:00pm/.test(l.items.join('|')) && /Close your day by 4:00pm: tap Close my day/.test(l.items.join('|')), JSON.stringify(l));
ok('scrubbed already: it says so', /^Scrubbed/.test(l.s));
c = coach('azariah', H(10), { inM: H(7, 58), scrubs: [] });
l = line(c, H(10));
ok('the morning: what lunch needs (10 by the end of the day is 8 by lunch: 5 more)', l.k === 'morning' && /3 of 10 closed · 5 more by lunch/.test(l.h) && c.byLunch === 8, JSON.stringify(l));
ok('not scrubbed yet: it says so, then overdue first, then the close with no note', /not scrubbed yet/.test(l.s) && /Overdue first: 4 left/.test(l.s) && /1 closed with no note/.test(l.s), l.s);
l = line(c, H(12, 31));
ok('30 minutes before lunch: update now, in amber', l.k === 'update' && l.tone === 'warn' && l.h === 'Lunch at 1:00pm: update now', JSON.stringify(l));
ok('it says what to do: close 5 more, the note on the 1 with none, scrub', /Close 5 more to be on pace \(3 of 8 by lunch\)/.test(l.s) && /note on the 1 closed with none/.test(l.s) && /scrub what came in this morning/.test(l.s), l.s);
ok('and a checklist, each ticked from what was done', l.items.length === 4 && l.items.every(x => x.done === false), JSON.stringify(l.items));
c = coach('azariah', H(12, 45), { inM: H(7, 58), closed: 8, unnoted: 0, lastM: H(12, 40), scrubs: [H(12, 35)] });
l = line(c, H(12, 45));
ok('updated, on pace, noted and scrubbed: every box ticked', l.items.every(x => x.done) && /on pace \(8 closed\)/.test(l.s), JSON.stringify(l.items));
ok('and the update stop is done', c.stops.find(s => s.k === 'update').done);
l = line(c, H(13, 20));
ok('at lunch: until when, and what comes after', l.k === 'lunch' && l.h === 'Lunch until 2:00pm' && /scrub what came in over lunch, then 2 to go/.test(l.s), JSON.stringify(l));
l = line(c, H(14, 5));
ok('back from lunch: scrub first, in amber', l.k === 'back' && l.tone === 'warn' && /Welcome back: scrub first/.test(l.h));
c = coach('azariah', H(14, 10), { inM: H(7, 58), closed: 8, scrubs: [H(8, 20), H(14, 6)] });
ok('scrubbed after lunch: the line moves on, the stop is done', line(c, H(14, 10)).h === 'Scrubbed: the afternoon' && c.stops.find(s => s.k === 'scrub2').done);
l = line(c, H(15));
ok('the afternoon: what is left to reach the day\'s number', l.k === 'afternoon' && l.h === '2 to go to reach 10' && /On pace for 9/.test(l.s), JSON.stringify(l));
l = line(c, H(15, 20));
ok('the close-out time: close your day, tap Close my day', l.k === 'close' && l.tone === 'warn' && l.h === 'Close your day by 4:00pm' && /tap Close my day/.test(l.s));
l = line(c, H(16, 10));
ok('past the finish and not closed: red, with when the register says so', l.k === 'late' && l.tone === 'bad' && /4:30pm/.test(l.s) && /Did not close the day/.test(l.s), JSON.stringify(l));

console.log('\nBefore, not in, absent, closed:\n');
c = coach('azariah', H(7, 30), {});
ok('before the start, not in: your day starts at 8, with the expectations', line(c, H(7, 30)).k === 'before' && line(c, H(7, 30)).h === 'Your day starts at 8:00am' && line(c, H(7, 30)).items.length === 5);
ok('after the start, not in: red, check in now', line(c, H(8, 10)).k === 'notin' && line(c, H(8, 10)).tone === 'bad');
ok('the check-in stop is missed five minutes after the start', c.stops[0].miss === H(8, 5));
c = coach('azariah', H(9), { absent: true });
ok('marked absent: one line, all day', c.lines.length === 1 && c.lines[0].k === 'absent');
c = coach('azariah', H(16, 5), { inM: H(8), outM: H(16, 2), closed: 11 });
ok('closed: one line, thank you, the close and the finish done', c.lines.length === 1 && c.lines[0].h === 'Day closed at 4:02pm' && /11 closed today of 10/.test(c.lines[0].s) && c.stops.find(s => s.k === 'close').done && c.stops.find(s => s.k === 'end').done);
c = coach('azariah', H(10, 5), { inM: H(9, 40) });
ok('in late at 9:40: what today asks stays up half an hour', line(c, H(10, 5)).k === 'start' && line(c, H(10, 15)).k === 'morning');

console.log('\nOther hours:\n');
c = coach('kamla', H(11, 40), { inM: H(8) });
ok('a flexible lunch (Kamla this week): a midday update at 11:30, no lunch stop', c.stops.find(s => s.k === 'update').t === '11:30am' && c.stops.find(s => s.k === 'update').l === 'Midday update' && !c.stops.some(s => s.k === 'lunch'), c.stops.map(s => s.k + '@' + s.t).join());
ok('its update line says midday', line(c, H(11, 40)).h === 'Midday: update now', JSON.stringify(line(c, H(11, 40))));
ok('the afternoon from noon, the scrub at one, her close at 4:15', line(c, H(12, 30)).k === 'afternoon' && line(c, H(13, 10)).k === 'back' && c.stops.find(s => s.k === 'close').t === '4:15pm' && c.stops.find(s => s.k === 'end').t === '5:00pm');
c = coach('sasha', H(9), { inM: H(8) });
ok('Sasha this week (8 to 4, lunch 2 to 3): the update at 1:30, her close at 3:15', c.stops.find(s => s.k === 'update').t === '1:30pm' && c.stops.find(s => s.k === 'lunch').t === '2:00pm' && c.stops.find(s => s.k === 'close').t === '3:15pm', c.stops.map(s => s.k + '@' + s.t).join());
ok('nothing on the coach is about anyone else', !/team|others|innovat/i.test(JSON.stringify(coach('sasha', H(9), { inM: H(8) }))));

console.log('\nWhat is new for you:\n');
const U = { sasha: 'U_SASHA', elizabeth: 'U_LIZ', azariah: 'U_AZ', kamla: 'U_KAM', pawan: 'U_PAW', akaash: 'U_AKA', ricky: 'U_RICKY' };
env.sfkUsers_ = () => Object.fromEntries(Object.entries(U).map(([k, v]) => [k, { id: v }]));
env.bmSfId_ = () => U.ricky;
const NM = { sasha: 'Sasha Lalla-Jagassar', elizabeth: 'Elizabeth Lee', azariah: 'Azariah Griffith', kamla: 'Kamla Dookran', pawan: 'Pawan Probhu', akaash: 'Akaash Kalladeen', ricky: 'Ricky Rampersad' };
env.nameFor_ = s => NM[s] || s;
env.roster_ = () => Object.keys(NM).map(s => ({ staffId: s, name: NM[s], active: true }));
const at = (h, m) => '2026-10-29T' + String(h + 4).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0') + ':00.000+0000';
const T = (Id, o) => Object.assign({ Id, Subject: 'A task', OwnerId: U.sasha, CreatedById: U.sasha, CreatedDate: '2026-10-20T12:00:00.000+0000', Task_Type__c: 'Servicing', ActivityDate: DAY, IsClosed: false }, o);
const CREATED = [
  T('00TNEW1', { Subject: 'Inbox · Agent Persad · Mohammed medicals', CreatedById: U.ricky, CreatedDate: at(8, 40) }),
  T('00TNEW2', { Subject: 'Client wants to cancel - call Mrs Ali', CreatedById: U.kamla, CreatedDate: at(9, 30) }),
  T('00TOWN1', { Subject: 'My own scrub line', CreatedById: U.ricky, CreatedDate: at(9, 0) }),
  T('00TOWN2', { Subject: 'Made by her in Salesforce', CreatedById: U.sasha, CreatedDate: at(9, 5) }),
  T('00TSHUT', { Subject: 'Routed and closed', CreatedById: U.ricky, CreatedDate: at(8, 0), IsClosed: true })];
const OLD = [T('00TOLD1', { Subject: 'Pending - 1000123456 RAMLAL' }), T('00TOLD2', { Subject: 'Servicing - ALI' }), T('00TOLD3', { Subject: 'Statement - KHAN' }),
  T('00TOLD4', { Subject: 'Survey - BOODRAM' }), T('00TLIZ', { OwnerId: U.liz || 'U_LIZ', Subject: 'Liz task' }),
  ...['00TCH1', '00TCH2', '00TCH3', '00TCH4'].map(id => T(id, { Subject: 'Quiet ' + id }))];
const P = (ParentId, CreatedById, h, m, Body) => ({ Id: 'F' + ParentId + h + m, ParentId, CreatedById, CreatedDate: at(h, m), Body });
const POSTS = [
  P('00TOLD1', U.ricky, 9, 5, '<p>Please call the client back today about the medicals.</p>'),
  P('00TOLD1', U.ricky, 10, 5, 'Sales Support · Sasha Lalla-Jagassar · Thu 29 Oct 10:05am\n\nCalled her: the medicals are booked for Monday.'),
  P('00TOLD2', U.ricky, 9, 12, 'Agent · Neil Ramnanan · Thu 29 Oct 9:12am\n\nThe client is upset, still waiting on her refund.'),
  P('00TOLD3', U.ricky, 8, 0, 'FOLLOW-UP: no note for five days.'),
  P('00TOLD4', U.ricky, 9, 50, 'ACTION REQUIRED: the client called twice this morning.'),
  P('00TLIZ', U.ricky, 9, 0, 'Please do this, Liz.'),
  P('00TOLD3', U.ricky, -5, 0, 'Yesterday evening\'s note.'),
  ...['00TCH1', '00TCH2', '00TCH3', '00TCH4'].map((id, i) => P(id, U.ricky, 7, i, 'Where does this stand?'))];
const COMMENTS = [{ Id: 'C1', ParentId: '00TOLD3', CreatedById: U.akaash, CreatedDate: at(11, 0), CommentBody: 'Can you send me the statement for my client?' }];
let asked = [];
env.sfkQuery_ = q => { asked.push(q);
  if (/FROM FeedItem/.test(q)) return POSTS; if (/FROM FeedComment/.test(q)) return COMMENTS; if (/FROM User/.test(q)) return [];
  if (/FROM Task WHERE CreatedDate/.test(q)) return CREATED; if (/FROM Task WHERE Id IN/.test(q)) return OLD; return []; };
env.PropertiesService.getScriptProperties().setProperty('wdday_sasha_' + DAY, JSON.stringify({ own: ['00TOWN1'], scrub: [] }));
const n = env.wdNews_('sasha', DAY, H(9));
const by = id => n.items.filter(x => x.id === id);
ok('routed from the inbox today: a new task, from the inbox', by('00TNEW1').length === 1 && by('00TNEW1')[0].k === 'new' && by('00TNEW1')[0].by === 'Routed from the inbox', JSON.stringify(by('00TNEW1')));
ok('given to her by Kamla, about a cancellation: urgent, from Kamla', by('00TNEW2')[0].by === 'Kamla' && by('00TNEW2')[0].u === 2);
ok('never her own scrub, her own task, or one already closed', !by('00TOWN1').length && !by('00TOWN2').length && !by('00TSHUT').length);
const rk = by('00TOLD1')[0];
ok('Mr Rampersad\'s note on her task, answered by her note after it; hers is not news', by('00TOLD1').length === 1 && rk.by === 'Mr Rampersad' && rk.role === 'bm' && rk.answered === true && rk.u === 2, JSON.stringify(by('00TOLD1')));
const ag = by('00TOLD2')[0];
ok('an agent\'s note, by the agent\'s name, urgent from its words, not answered', ag.by === 'Neil' && ag.role === 'agent' && ag.u === 2 && !ag.answered && /still waiting on her refund/.test(ag.said) && !/Agent · Neil/.test(ag.said), JSON.stringify(ag));
ok('a reply from Akaash in his own login: the unit manager, by name', by('00TOLD3').length === 1 && by('00TOLD3')[0].by === 'Akaash' && by('00TOLD3')[0].role === 'um' && by('00TOLD3')[0].reply, JSON.stringify(by('00TOLD3')));
ok('the tracker\'s follow-up is left out, ACTION REQUIRED is kept as urgent', by('00TOLD4')[0].role === 'sys' && by('00TOLD4')[0].u === 2 && !n.items.some(x => /FOLLOW-UP/.test(x.said || '')));
ok('yesterday\'s note is not today\'s news', !n.items.some(x => /Yesterday/.test(x.said || '')));
ok('the morning chase is counted, not listed', n.chase === 4 && !n.items.some(x => /^00TCH/.test(x.id)), String(n.chase));
ok('Liz\'s task is hers, not Sasha\'s', !by('00TLIZ').length);
ok('the urgent and unanswered first, the answered last', n.items[0].u === 2 && !n.items[0].answered && n.items[n.items.length - 1].answered === true, n.items.map(x => x.id + ':' + x.u + (x.answered ? 'a' : '')).join());
ok('since she checked in at 9: counted', n.fresh === n.items.filter(x => x.m >= H(9)).length && n.fresh === 5 && by('00TNEW1')[0].fresh === false, String(n.fresh));
ok('the urgent still to answer, counted: Kamla\'s cancellation, the agent, ACTION REQUIRED', n.urgent === 3, String(n.urgent));
ok('one read of the day: tasks, notes, replies, the older tasks', asked.length === 4 && asked.every(q => /2026-10-29T04:00:00Z|Id IN/.test(q)), asked.join(' / '));
asked = [];
const liz = env.wdNews_('elizabeth', DAY, H(8));
ok('the next desk reads its slice from the copy: no Salesforce', asked.length === 0 && liz.items.length === 1 && liz.items[0].by === 'Mr Rampersad', JSON.stringify(liz));

env.CacheService.getScriptCache().remove('wd_news_sasha_' + DAY);
const MANY = Array.from({ length: 90 }, (_, i) => P('00TOLD1', U.kamla, 10, i % 60, 'Kamla Dookran note ' + i));
const keepPosts = POSTS.slice(); POSTS.push(...MANY);
const big = env.wdNews_('sasha', DAY, H(9));
ok('a busy day: the most pressing 60 kept, all of them counted', JSON.parse(env.CacheService.getScriptCache().get('wd_news_sasha_' + DAY)).items.length === 60 && big.total > 90 && big.items.length === 12 && big.more === big.total - 12, String(big.total));
POSTS.length = 0; POSTS.push(...keepPosts);

console.log('\nClaude for the managers and the BMA:\n');
ok('Mr Rampersad, Kamla and Akaash; not the desks', env.claudeFor_('ricky') && env.claudeFor_('kamla') && env.claudeFor_('akaash') && !['sasha', 'azariah', 'elizabeth', 'pawan'].some(env.claudeFor_));
env.replyPerson_ = sid => ({ staffId: sid, name: NM[sid] });
env.bigPut_('sd_list_sasha_' + DAY, [{ id: '00TOLD1', s: 'Pending - 1000123456 RAMLAL', ty: 'Pendings' }]);
let calls = 0; env.UrlFetchApp = { fetch: () => { calls++; return { getResponseCode: () => 200, getContentText: () => '{}' }; } };
env.PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', 'sk-test');
let r = env.cardAct_({ rs: 'sasha', d: DAY, k: env.replySig_('sasha', DAY, 'card'), id: '00TOLD1', act: 'draft', note: 'called her' });
ok('a desk\'s card: no Claude, and nobody is called', !r.ok && /own words/.test(r.error) && calls === 0, JSON.stringify(r));
const pb = { todo: 'x', label: 'Pending', close: '' };
ok('her day page card has no Draft with Claude', !/Draft with Claude/.test(env.tcardHtml_({ id: '00T1', s: 'x', ty: 'Pendings' }, pb, DAY, 'sasha')) && /own words/.test(env.tcardHtml_({ id: '00T1', s: 'x' }, pb, DAY, 'sasha')));
ok('Kamla\'s does', /Draft with Claude/.test(env.tcardHtml_({ id: '00T1', s: 'x', ty: 'Pendings' }, pb, DAY, 'kamla')));
r = env.umDraft_({ rs: 'sasha', d: DAY, k: env.replySig_('sasha', DAY, 'card'), id: '00TOLD1', via: 'card' });
ok('Brief me on her day page: not for a desk', !r.ok && /managers and the BMA/.test(r.error) && calls === 0, JSON.stringify(r));
ok('the page is told who has Claude', /m\.claude = claudeFor_\(sid\)/.test(env.workdayModel_.toString()));

console.log('\nWhat createTask_ marks:\n');
env.sfkInsert_ = () => '00TMADE1';
env.sfkForgetDay_ = () => {}; env.takeLock_ = () => null; env.audit_ = () => {}; env.sfkConfigured_ = () => true;
env.createTask_({ staffId: 'azariah', subject: 'Agent Persad asked for the medicals', type: 'Pendings', due: DAY, scrub: 1 }, { staffId: 'azariah', name: 'Azariah Griffith' });
env.createTask_({ staffId: 'azariah', subject: 'An idea for the meeting', type: 'Pendings', due: DAY }, { staffId: 'azariah', name: 'Azariah Griffith' });
const mk = env.wdDayGet_('azariah', DAY);
ok('every task made for her is hers; only the scrub line is a scrub', mk.own.length === 2 && mk.own[0] === '00TMADE1' && mk.scrub.length === 1 && /^\d{2}:\d{2}$/.test(mk.scrub[0]), JSON.stringify(mk));
ok('kept three days, with the other short-lived copies', env.STORE.SHORT.test('wdday_azariah_' + DAY));
ok('the three scrubs (this page, the day page, the plan page) say they are scrubs', (env.wdScrub_.toString().match(/scrub: 1/g) || []).length === 1 && (env.sdSave_.toString().match(/scrub: 1/g) || []).length === 1);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
