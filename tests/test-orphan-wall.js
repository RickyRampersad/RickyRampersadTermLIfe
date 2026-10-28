// The orphan campaign's stop on the Branch Intelligence wall (28 October 2026): Transition.gs tOrphanWall_, asked as
// GET action=board&who=wall with no code. Salesforce and the stream are made up here. Checks the counts, today's lists
// and what each desk did on them, the agents (still with the branch, named since 9 September), and that the answer
// carries no client, no task id, no former agent and nothing the stream holds by name.
// Run: node tests/test-orphan-wall.js
const path = require('path');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c || !x ? '' : '  ' + x)); if (!c) fails++; };

delete require.cache[require.resolve('./harness')];
process.env.GS_PATH = path.join(__dirname, '..', 'apps-script', 'Transition.gs');
const { makeEnv } = require('./harness');
const e = makeEnv({ props: {} });

/* dates as Apps Script writes them, in the zone asked for */
const TZ = 'America/Port_of_Spain';
e.Utilities.formatDate = (d, tz, f) => {
  const z = tz === 'UTC' ? 'UTC' : TZ;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(p => [p.type, p.value]));
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const H = +parts.hour, h12 = (H % 12) || 12, ap = H < 12 ? 'AM' : 'PM';
  if (f === 'yyyy-MM-dd') return parts.year + '-' + parts.month + '-' + parts.day;
  if (f === 'H') return String(H);
  if (f === 'h:mm a') return h12 + ':' + parts.minute + ' ' + ap;
  if (f === 'd MMM, h:mm a') return (+parts.day) + ' ' + MON[+parts.month - 1] + ', ' + h12 + ':' + parts.minute + ' ' + ap;
  if (f === "yyyy-MM-dd'T'HH:mm:ss'Z'") return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second + 'Z';
  return d.toISOString();
};
e.tTz_ = () => TZ;
e.svcSoqlLit_ = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const TODAY = e.Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
const shift = (n) => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* a moment today, in Trinidad, as Salesforce writes it (UTC) */
const at = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(TODAY + 'T00:00:00Z'); d.setUTCHours(h + 4, m); return d.toISOString().replace('Z', '+0000'); };

/* the stream: names everywhere it has them, so the test can show none of them reaches the wall */
let streamBuilds = 0;
e.tStream_ = () => { streamBuilds++; return {
  ok: true, stream: 1, at: '28 Oct 2026 14:30', waitDays: 2,
  clients: { all: 2473, answered: 512, asked: 340, wrote: 61, stage: { done: 40, named: 90, spoken: 60, waiting: 150 } },
  hh: { all: 2168, answered: 470, asked: 300, toReach: 120, stage: { done: 35, named: 80, spoken: 55, waiting: 130 }, agent: { one: 70, split: 5, none: 225 } },
  auto: { letters: 1477, reminders: 1199, afterReminder: 128, waiting: 900, holds: { mail: true } },
  people: { late: 210, lateHh: 190, firstTouch: { median: 3, within2: 41, n: 96, waiting: 180 },
            team: [{ name: 'Sasha L.', today: 4 }, { name: 'Kerwyn R.', today: 1 }] },
  sf: { on: true, people: [{ name: 'Elizabeth L.' }] },
  agents: [{ name: 'Kerwyn R.', clients: 3 }, { name: 'Neil R.', clients: 9 }],
  said: { risk: [{ label: 'Client words about Jane Doe' }] },
  lines: ['Jane Doe Client wrote in on 27 Oct'] }; };
e.tServeCached_ = (cfg, build) => build();

/* Salesforce, made up: answers by the query asked */
const T1 = '00T000000000001AAA', T2 = '00T000000000002AAA', T3 = '00T000000000003AAA', T4 = '00T000000000004AAA', T5 = '00T000000000005AAA', T6 = '00T000000000006AAA';
const LIST = (who, n, of) => 'ON YOUR LIST TODAY — ' + who + ', #' + n + ' of ' + of + '<p>Client: Jane Doe Client, policy 1234567890</p>';
const asked = [];
e.tSfOn_ = () => true;
e.tSfQuery_ = (q) => {
  asked.push(q);
  if (/FROM Task WHERE IsClosed = false/.test(q)) return [
    { Id: T1, ActivityDate: shift(-3), Owner: { Name: 'Sasha Lalla-Jagassar' } },
    { Id: T2, ActivityDate: TODAY, Owner: { Name: 'Sasha Lalla-Jagassar' } },
    { Id: T3, ActivityDate: shift(2), Owner: { Name: 'Elizabeth Lee' } },
    { Id: T4, ActivityDate: shift(-1), Owner: { Name: 'Elizabeth Lee' } },
    { Id: 'x1', ActivityDate: shift(-9), Owner: { Name: 'Ricky Rampersad' } },
    { Id: 'x2', ActivityDate: shift(5), Owner: { Name: 'Some Other User' } }];
  if (/FROM Task WHERE IsClosed = true/.test(q)) return [{ Id: T5, Owner: { Name: 'Sasha Lalla-Jagassar' } }];
  if (/FROM TaskFeed/.test(q)) return [
    /* this morning's lists, posted by the branch manager's user */
    { ParentId: T1, Type: 'TextPost', Body: LIST('Sasha Lalla-Jagassar', 1, 4), CreatedDate: at('06:47'), CreatedBy: { Name: 'Ricky Rampersad' } },
    { ParentId: T2, Type: 'TextPost', Body: LIST('Sasha Lalla-Jagassar', 2, 4), CreatedDate: at('06:47'), CreatedBy: { Name: 'Ricky Rampersad' } },
    { ParentId: T5, Type: 'TextPost', Body: LIST('Sasha Lalla-Jagassar', 3, 4), CreatedDate: at('06:47'), CreatedBy: { Name: 'Ricky Rampersad' } },
    { ParentId: T6, Type: 'TextPost', Body: LIST('Sasha Lalla-Jagassar', 4, 4), CreatedDate: at('06:47'), CreatedBy: { Name: 'Ricky Rampersad' } },
    { ParentId: T3, Type: 'TextPost', Body: LIST('Elizabeth Lee', 1, 2), CreatedDate: at('06:47'), CreatedBy: { Name: 'Ricky Rampersad' } },
    { ParentId: T4, Type: 'TextPost', Body: LIST('Elizabeth Lee', 2, 2), CreatedDate: at('06:47'), CreatedBy: { Name: 'Ricky Rampersad' } },
    /* a list for someone who is not on staff is never shown */
    { ParentId: 'x9', Type: 'TextPost', Body: LIST('Kerwyn Ramroach', 1, 1), CreatedDate: at('06:47'), CreatedBy: { Name: 'Ricky Rampersad' } },
    /* what the desks did */
    { ParentId: T1, Type: 'TextPost', Body: '<p>Spoke to the client, wants a call from an agent on Friday.</p>', CreatedDate: at('09:12'), CreatedBy: { Name: 'Sasha Lalla-Jagassar' } },
    { ParentId: T2, Type: 'TextPost', Body: '<p>Called 3pm, no answer, sent WhatsApp.</p>', CreatedDate: at('10:05'), CreatedBy: { Name: 'Sasha Lalla-Jagassar' } },
    { ParentId: T5, Type: 'TrackedChange', Body: '', CreatedDate: at('13:40'), CreatedBy: { Name: 'Sasha Lalla-Jagassar' },
      FeedTrackedChanges: { records: [{ FieldName: 'Task.Status', NewValue: 'Completed' }] } },
    /* Liz moved a date with no note: that is nothing */
    { ParentId: T3, Type: 'TrackedChange', Body: '', CreatedDate: at('08:30'), CreatedBy: { Name: 'Elizabeth Lee' },
      FeedTrackedChanges: { records: [{ FieldName: 'Task.ActivityDate', NewValue: shift(3) }] } },
    /* a note the tracker wrote under the branch's user, headed with Liz's name */
    { ParentId: T4, Type: 'TextPost', Body: 'Sales Support · Elizabeth Lee · Wed 28 Oct: Left a message, will try again tomorrow.', CreatedDate: at('11:20'), CreatedBy: { Name: 'Ricky Rampersad' } },
    /* a "not touched" line under the branch's user is never someone's entry */
    { ParentId: T3, Type: 'TextPost', Body: 'Sales Support · Elizabeth Lee · not touched today', CreatedDate: at('15:00'), CreatedBy: { Name: 'Ricky Rampersad' } }];
  if (/FROM FeedComment/.test(q)) return [
    { ParentId: T6, CommentBody: 'Reassigning to Neil as discussed.', CreatedDate: at('14:02'), CreatedBy: { Name: 'Sasha Lalla-Jagassar' } }];
  if (/FROM CLIENT_PORTFOLIO__c/.test(q)) return [
    { Contact__c: 'C1', Assigned_Agent__r: { Name: 'Neil Ramnanan', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: TODAY, Campain_Feedback_Update__c: 'Met the client.' },
    { Contact__c: 'C1', Assigned_Agent__r: { Name: 'Neil Ramnanan', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: TODAY, Campain_Feedback_Update__c: '' },
    { Contact__c: 'C2', Assigned_Agent__r: { Name: 'Neil Ramnanan', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: shift(-20), Campain_Feedback_Update__c: '' },
    { Contact__c: 'C3', Assigned_Agent__r: { Name: 'Narissa (Agent) Mohammed', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: shift(-2), Campain_Feedback_Update__c: '' },
    { Contact__c: 'C4', Assigned_Agent__r: { Name: 'Kerwyn Ramroach', Employment_Status__c: 'Resigned' }, Date_Assigned_to_Agent__c: shift(-2), Campain_Feedback_Update__c: '' },
    { Contact__c: 'C5', Assigned_Agent__r: { Name: 'Ricky Rampersad', Employment_Status__c: 'Active' }, Date_Assigned_to_Agent__c: shift(-2), Campain_Feedback_Update__c: '' }];
  throw new Error('unexpected query: ' + q);
};

const d = e.transitionBoard_({ action: 'board', who: 'wall' });
const body = JSON.stringify(d);

console.log('\nThe route:');
ok('who=wall opens with no code', d.ok === true && d.wall === 1, body.slice(0, 200));
ok('it is not the board and not the stream', !d.clients && !d.silent && d.stream !== 1);

console.log('\nThe campaign (from the stream):');
const C = d.campaign || {};
ok('households: all, answered, asked', C.households && C.households.all === 2168 && C.households.answered === 470 && C.households.asked === 300);
ok('how far the households that asked have got', JSON.stringify(C.households.stage) === JSON.stringify({ done: 35, named: 80, spoken: 55, waiting: 130 }));
ok('letters, reminders, answered after a reminder', C.auto && C.auto.letters === 1477 && C.auto.reminders === 1199 && C.auto.afterReminder === 128);
ok('households past the line, and the first call', C.lateHh === 190 && C.firstTouch.median === 3 && C.firstTouch.within2 === 41 && C.firstTouch.n === 96);
ok('none of the stream\'s lists by name comes through', !C.team && !C.agents && !C.said && !C.lines && !C.sf);

console.log('\nOpen tasks, by who holds them:');
const P = Object.fromEntries((d.tasks.people || []).map(p => [p.name, p]));
ok('every open orphan task is counted', d.tasks.open === 6 && d.tasks.closedToday === 1, JSON.stringify(d.tasks));
ok('Sasha: 2 open, 1 past its date, 1 due today, 1 closed today', P.Sasha && P.Sasha.open === 2 && P.Sasha.overdue === 1 && P.Sasha.dueToday === 1 && P.Sasha.closedToday === 1, JSON.stringify(P.Sasha));
ok('Elizabeth reads Liz', P.Liz && P.Liz.open === 2 && P.Liz.overdue === 1, JSON.stringify(P.Liz));
ok('the branch manager reads Branch Manager, anyone else Others', P['Branch Manager'] && P['Branch Manager'].open === 1 && P.Others && P.Others.open === 1, Object.keys(P).join(','));
ok('the overdue total', d.tasks.overdue === 3, String(d.tasks.overdue));

console.log('\nToday\'s lists:');
const L = Object.fromEntries((d.lists || []).map(l => [l.name, l]));
ok('two lists: Sasha\'s and Liz\'s, nobody else\'s', Object.keys(L).sort().join(',') === 'Liz,Sasha', Object.keys(L).join(','));
ok('Sasha: 1 done, 1 reached, 1 tried, 1 moved (noted), of 4', L.Sasha && L.Sasha.size === 4 && L.Sasha.posted === 4 && L.Sasha.done === 1 && L.Sasha.reached === 1 && L.Sasha.tried === 1 && L.Sasha.noted === 1 && L.Sasha.nothing === 0, JSON.stringify(L.Sasha));
ok('Liz: a date moved with no note is nothing; the tracker\'s note under her name is a try', L.Liz && L.Liz.nothing === 1 && L.Liz.tried === 1, JSON.stringify(L.Liz));
ok('first and last entry today, in Trinidad time', L.Sasha.first === '9:12 AM' && L.Sasha.last === '2:02 PM', L.Sasha.first + ' – ' + L.Sasha.last);
ok('a "not touched" line is never an entry', L.Liz.last === '11:20 AM', L.Liz.first + ' – ' + L.Liz.last);
const DY = Object.fromEntries((d.day || []).map(x => [x.name, x]));
ok('every desk has a line for the day, with or without a list', ['Sasha', 'Liz', 'Azariah', 'Kamla', 'Pawan'].every(n => DY[n]), Object.keys(DY).join(','));
ok('Azariah: no entry today', DY.Azariah && DY.Azariah.entries === 0 && DY.Azariah.first === '');

console.log('\nClients named to an agent:');
const G = d.agents || {};
const A = Object.fromEntries((G.people || []).map(p => [p.name, p]));
ok('only agents still with the branch, never the branch manager', Object.keys(A).sort().join(',') === 'Narissa M.,Neil R.', Object.keys(A).join(','));
ok('a client counts once per agent', A['Neil R.'].clients === 2 && A['Neil R.'].today === 1 && A['Neil R.'].feedback === 1, JSON.stringify(A['Neil R.']));
ok('the bracketed label in a Salesforce name is dropped', !!A['Narissa M.']);
ok('totals: clients, this week, today', G.clients === 3 && G.week === 2 && G.today === 1, JSON.stringify({ c: G.clients, w: G.week, t: G.today }));
const cp = asked.find(q => /CLIENT_PORTFOLIO__c/.test(q)) || '';
ok('only namings since 9 September are asked for', /Date_Assigned_to_Agent__c >= 2026-09-09/.test(cp), cp);

console.log('\nNothing about a client, and nobody who has left:');
['Jane Doe', 'Client:', '1234567890', 'C1', 'C2', T1, T2, 'Kerwyn', 'Ramroach', 'Resigned', 'Met the client', 'Spoke to the client', 'no answer', 'Reassigning', 'Some Other User']
  .forEach(s => ok('no "' + s + '"', body.indexOf(s) < 0));
ok('no full staff surname', !/Lalla|Jagassar|Griffith|Dookran|Probhu|Ramnanan|Mohammed\b/.test(body));

console.log('\nWithout Salesforce, and when it fails:');
e.tSfOn_ = () => false;
let d2 = e.transitionBoard_({ action: 'board', who: 'wall' });
ok('the campaign still comes, and the page is told Salesforce is not linked', d2.ok && d2.campaign && d2.sf && d2.sf.on === false && !d2.tasks);
e.tSfOn_ = () => true;
const real = e.tSfQuery_; e.tSfQuery_ = () => { throw new Error('INVALID_SESSION_ID'); };
d2 = e.transitionBoard_({ action: 'board', who: 'wall' });
ok('a Salesforce error is said, and the campaign still comes', d2.ok && d2.campaign && d2.sf && /did not answer/.test(d2.sf.error || ''));
e.tSfQuery_ = real;
e.tStream_ = () => ({ ok: false, error: 'The board could not be read.' });
d2 = e.transitionBoard_({ action: 'board', who: 'wall' });
ok('a stream that fails leaves an error on the campaign, not a dead stop', d2.ok && d2.campaign && d2.campaign.error && d2.lists);

console.log('\nThe cache:');
ok('the wall\'s answer has its own key, apart from the stream\'s and the board\'s', e.T_OWALL.KEY !== e.T_STREAM.KEY && e.T_OWALL.FRESH_S === 300);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
