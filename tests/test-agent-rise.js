// The agents' Rise look (3 November 2026, 2026-11-03b): Ricky approved building the Strava-style home into the agents' real
// screens. Pinned: the morning, midday and 5:30 mails and the coach's morning render for a sample agent without throwing; they
// carry the hero (month, week, streak, the bell, fact finds with clients) in the preview's palette with no saturated blue;
// the day starts at 7:00am and closes off by 6pm; no service questionnaire and no staff KPI in an agent's screen.
const { makeEnv } = require('./harness');
const fs = require('fs');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-11-03';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.PropertiesService.getScriptProperties().setProperty('AGENT_COACH', 'off');   // the plain morning, which this test covers
const row = (d, at) => [d, 'a-maya-sample', 'maya@example.com', '', 'plan', 'calls', 'Calls', '5', '', '', at];
env.__mkSheet('Agent Day', 1, env.AGDAY.head, [row('2026-11-02', '07:05'), row('2026-11-03', '07:10')]);
const mails = []; env.mailSend_ = o => { mails.push(o); return 'relay'; };
const A = { key: 'a-maya-sample', name: 'Maya Sample', agentName: 'Maya Sample', agentId: 'A99999', code: 'A99999', email: 'maya@example.com', manager: '' };
env.agentPeople_ = () => ({ [A.key]: A });
env.goalFor_ = () => ({ q: [0, 0, 0, 0], api: 300000, title: 'MDRT', contactsWk: 20, apptsWk: 6, ffWk: 4, appsWk: 2, weeksIn: 5, last: null });
env.ff360Feed_ = () => ({});
env.ff360Agent_ = () => ({ week: 2, month: 3, year: 11, pickedUp: 9000, pipeline: 21000, known: true });
env.iLoadCache_ = () => null;
env.agentBook_ = () => ({ urgent: [{ client: 'Dev Client', days: 70 }], slipped: [], lapsed: [], chase: [], pend: [], follow: [] });
env.agFFCases_ = () => ({ n: 6, last: '2026-10-28', openN: 2, open: [{ c: 'Ravi Testman', sub: '2026-10-06', out: 'said yes, not confirmed', chased: '2026-10-30', n: 2 }, { c: 'Lena Example', sub: '2026-10-28', out: '', chased: '', n: 0 }] });
env.agMonths_ = () => ({ known: true, key: '2026-11', name: 'November', wd: { all: 21, gone: 2 }, mtd: 3200, target: 24500, exp: 2333, prev: '2026-10', prevName: 'October', prevApi: 15000, prevApps: 3, prevTarget: 25000, usual: 12000, lastYear: 144000, best: null, fyApi: 18200, fyApps: 4 });
env.sfkQuery_ = () => [];
env.cmdChatter_ = () => ({});
env.ffResponses_ = () => ({});
env.umNotesUnsent_ = () => [{ by: 'Akaash', day: DAY, text: 'Call Ravi first today.' }];
const data = { open: { [A.key]: [{ id: '00T1', subject: 'Orphan response: call me - 5000000001 SAMPLE CLIENT', owner: 'Sasha Lalla-Jagassar', due: '2026-11-01', late: true }, { id: '00T2', subject: 'Contract to deliver - 5000000002 OTHER SAMPLE', owner: 'Elizabeth Lee', due: DAY, late: false }] },
  closed: { [A.key]: [{ id: '00T3', subject: 'Beneficiary change - 5000000003 DONE SAMPLE', owner: 'Azariah Griffith' }] },
  ff: { [A.key]: [] }, f360: { [A.key]: { week: 2, month: 3, year: 11, pickedUp: 9000, pipeline: 21000, known: true } },
  goal: { [A.key]: env.goalFor_() }, q: { [A.key]: [] }, orphan: { [A.key]: { households: 3, callbacks: 1 } } };

const blue = /#0EA5C9|#0ea5c9|#141C4A|#1C2A6E|#A5F3FC/;
const check = (label, html) => {
  ok(label + ': the hero is there (month, week, streak, the bell)', /November/.test(html) && /This week/.test(html) && /Streak/.test(html) && /Waiting on you/.test(html));
  ok(label + ': no service questionnaire, no staff KPI', !/service questionnaire/i.test(html) && !/\bSQ\b/.test(html) && !/staff KPI/i.test(html));
  ok(label + ': no saturated blue', !blue.test(html), (html.match(blue) || [])[0]);
  ok(label + ': nobody who left, nobody excluded', !/Javid|Aleema|Kerwyn|Gary Sookdeo/.test(html));
};
console.log('\nThe morning:\n');
env.agentMorningMail_(A, DAY, data, null);
const am = mails.pop(); ok('sent', !!am);
check('morning', am.htmlBody);
ok('morning: 7:00am start and close off by 6pm', /7:00am/.test(am.htmlBody) && /6pm/.test(am.htmlBody));
ok('morning: fact finds with clients, days waiting and times chased', /Ravi Testman/.test(am.htmlBody) && /waiting 28 days/.test(am.htmlBody) && /chased 2 times/.test(am.htmlBody));
ok('morning: the streak counts her plans since going live', /2 days<\/div>/.test(am.htmlBody), (am.htmlBody.match(/Streak<\/div><div[^>]*>([^<]*)/) || [])[1]);
ok('morning: the manager\'s note is in the bell', /note from your manager/.test(am.htmlBody));
ok('morning: kudos only for what was earned', /Kudos/.test(am.htmlBody) && /2 fact finds this week/.test(am.htmlBody) && /ahead of pace for November/.test(am.htmlBody));
ok('morning: the existing parts stay (list, book, projection)', /What the branch is actioning for you today/i.test(am.htmlBody) && /Your projection for today/i.test(am.htmlBody));
console.log('\nMidday and 5:30:\n');
env.agentMiddayMail_(A, DAY, data); const md = mails.pop(); check('midday', md.htmlBody);
env.agentEveningMail_(A, DAY, data); const pm = mails.pop(); check('5:30', pm.htmlBody);
ok('5:30: close off by 6pm', /by 6pm/.test(pm.htmlBody));
console.log('\nThe coach\'s morning:\n');
let co = null; try { co = env.agentMorningMail2_(A, DAY, data); } catch (e) { ok('coach morning renders', false, e.message); }
if (co) { ok('coach morning renders', true); check('coach', co.html); }
console.log('\nThe page hero:\n');
let pg = ''; try { pg = env.agRisePage_(A, DAY, data.open[A.key], false); } catch (e) {}
ok('page hero renders', /Waiting on you/.test(pg));
if (process.env.RISE_OUT) { fs.writeFileSync(process.env.RISE_OUT + '/rise-am.html', am.htmlBody); fs.writeFileSync(process.env.RISE_OUT + '/rise-md.html', md.htmlBody); fs.writeFileSync(process.env.RISE_OUT + '/rise-pm.html', pm.htmlBody); fs.writeFileSync(process.env.RISE_OUT + '/rise-page.html', pg); }
console.log(fails ? '\n' + fails + ' failed' : '\nall green');
process.exit(fails ? 1 : 0);
