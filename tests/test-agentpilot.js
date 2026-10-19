// The agents' 5am pilot, as set on 19 October 2026: Neil Ramnanan and Fawaz Mohammed only,
// live at 5am, copied to their manager (Neil under Ricky, Fawaz under Akaash) and sales support.
// The plan asks what they intend today; the mail opens on one line from their own behaviour and
// goals, and reads their fact finds since September, their clients' birthdays and reviews.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes'],
   ['Akaash Kalladeen','akaash','akaash@example.com','1','Unit Manager','Akaash','Yes']]);
const DAY = '2026-10-19';
const H = ['Submission ID','Status','Submitted At','App Type','Client Name','Advisor Name','Agent Code','Agent Email','DOB','Marital Status','Occupation',
  'Spouse Name','Child 1 Name','Dependant 1 Name','Client Signed As','Budget Annual','Budget Single','Ins 1 Co','Final Decision','Case Outcome','Journey Stage','Closed Reason','debtOther1 Bal'];
const row = (o) => H.map(h => o[h] == null ? '' : o[h]);
env.__mkSheet('FFRevised', 1, H, [
  row({ Status: 'approved', 'Submitted At': '2026-09-08 10:00', 'App Type': 'full', 'Client Name': 'Ann Able', 'Advisor Name': 'Neil Ramnanan', 'Agent Code': 'A10024', DOB: '1990-03-01', 'Marital Status': 'Married', Occupation: 'Teacher', 'Final Decision': 'proceed', 'Budget Annual': 1200 }),
  row({ Status: 'approved', 'Submitted At': '2026-09-09 10:00', 'App Type': 'full', 'Client Name': 'Ben Bell', 'Advisor Name': 'Neil Ramnanan', 'Agent Code': 'A10024', DOB: '1985-06-01', 'Marital Status': 'Single', Occupation: 'Teacher', 'Final Decision': 'proceed', 'Case Outcome': 'Picked up', 'Client Signed As': 'Ben Bell' }),
  row({ Status: 'pending_review', 'Submitted At': '2026-10-13 09:00', 'App Type': 'full', 'Client Name': 'Cy Cole', 'Advisor Name': 'Neil Ramnanan', 'Agent Code': '10024', DOB: '1979-01-01', 'Marital Status': 'Married', Occupation: 'Police officer', 'Final Decision': 'proceed' }),
  row({ Status: 'approved', 'Submitted At': '2026-10-05 09:00', 'App Type': 'full', 'Client Name': 'Dee Dunn', 'Advisor Name': 'Fawwaz Mohamed', 'Agent Code': 'A12397', 'Final Decision': 'proceed' }),
  row({ Status: 'approved', 'Submitted At': '2026-09-20 09:00', 'App Type': 'advice', 'Client Name': 'Test Case', 'Advisor Name': 'Neil Ramnanan', 'Agent Code': 'A10024', 'Closed Reason': 'Opened during testing' }),
  row({ Status: 'advice_given', 'Submitted At': '2026-09-15 09:00', 'App Type': 'advice', 'Client Name': 'Eve East', 'Advisor Name': 'Varun Seegolam', 'Agent Code': 'A11111' })
]);

const people = {
  'a-neil-ramnanan': { key: 'a-neil-ramnanan', name: 'Neil Ramnanan', agentName: 'Neil Ramnanan', agentId: 'A10024', code: 'A10024', email: 'neil@example.com', manager: 'akaash@example.com', unit: 'Akaash' },
  'a-fawwaz-mohamed': { key: 'a-fawwaz-mohamed', name: 'Fawwaz Mohamed', agentName: 'Fawwaz Mohamed', agentId: 'A12397', code: 'A12397', email: 'fawaz@example.com', manager: '', unit: 'Akaash' },
  'a-varun-seegolam': { key: 'a-varun-seegolam', name: 'Varun Seegolam', agentName: 'Varun Seegolam', agentId: 'A11111', code: 'A11111', email: 'varun@example.com', manager: '', unit: '' }
};
env.agentPeople_ = () => people;
env.PropertiesService.getScriptProperties().deleteProperty('AGENT_DAY');

console.log('\nWho gets it:\n');
ok('unset, the agents\' mail runs as the pilot', env.agentMode_() === 'pilot');
const pilot = env.agentPilotPeople_();
ok('the pilot is Neil and Fawaz, however Fawaz is spelt', Object.keys(pilot).sort().join() === 'a-fawwaz-mohamed,a-neil-ramnanan', Object.keys(pilot).join());
ok('Neil is copied under Ricky, not his unit', pilot['a-neil-ramnanan'].manager === 'ricky@example.com', pilot['a-neil-ramnanan'].manager);
ok('Fawaz is copied under Akaash', pilot['a-fawwaz-mohamed'].manager === 'akaash@example.com');
const cc = env.agentCc_(pilot['a-neil-ramnanan']);
ok('copied: the manager and sales support', cc.join() === 'ricky@example.com,rickyrampersadsalessupport@myguardiangroup.com', cc.join());
ok('the morning mail goes at 5am', env.AGENT_AM_AT === 300);

console.log('\nThe fact finds since September:\n');
const f = env.agFactFinds_(pilot['a-neil-ramnanan'], DAY);
ok('three real ones since 1 September, the test case left out', f.since === 3, JSON.stringify({ since: f.since, all: f.all }));
ok('agent code with or without the A matches', f.all === 3);
ok('last one six days ago', f.sinceLast === 6 && f.last === '2026-10-13');
ok('one waiting on review, one picked up', f.review === 1 && f.pickedUp === 1);
ok('said yes and nothing closed: Ann and Cy, oldest first', f.openYes.map(x => x.client).join() === 'Ann Able,Cy Cole', f.openYes.map(x => x.client).join());
ok('the gaps: signature blank on two of three, most-blank first', f.gaps.some(g => g.k === 'signature' && g.p === 67) && f.gaps[0].p === 100, JSON.stringify(f.gaps));
ok('spouse blank on both married clients', f.gaps.some(g => g.k === 'spouse' && g.p === 100));
ok('who he writes: teachers first', f.topOcc[0].label === 'Teacher' && f.topOcc[0].n === 2);
ok('the longest gap counts up to today', f.longestGap === 34, String(f.longestGap));
const br = env.agFfBranch_(DAY);
ok('the branch: three agents, five real fact finds', br.agents === 3 && br.total === 5, JSON.stringify(br));

console.log('\nThe one line at the top:\n');
const lines = env.agMotivate_(pilot['a-neil-ramnanan'], DAY, f, { ffWk: 2, appsWk: 1, contactsWk: 20, apptsWk: 5, api: 120000, paceApi: 6900, weeksIn: 3 }, { birthdays: [], reviews: [], lapsed: [] }, null);
ok('it leads with the clients who said yes', /said yes/.test(lines[0].head), lines[0].head);
const hero = env.agHero_(lines);
ok('the hero names the oldest', /Ann Able/.test(hero));
const s = env.agSuggest_({ contactsWk: 20, apptsWk: 5, ffWk: 2, appsWk: 1 });
ok('suggested for today: a fifth of the week', s.calls === 4 && s.appts === 1 && s.ff === 1 && s.apps === 1, JSON.stringify(s));

console.log('\nTheir clients in Salesforce:\n');
env.sfkConfigured_ = () => true;
let soql = '';
env.sfkQuery_ = (q) => { soql = q; return [
  { FIRST_NAME__c: 'Gail', LAST_NAME__c: 'Gee', Date_Of_Birth__c: '1980-10-21', ISSUE_DATE__c: '2015-10-25', PLAN_NAME__c: 'Flexi Term', Policy_Status_Description__c: 'PREMIUM PAYING', Contact__c: 'c1' },
  { FIRST_NAME__c: 'Hal', LAST_NAME__c: 'Ho', Date_Of_Birth__c: '1970-03-01', ISSUE_DATE__c: '2012-01-01', PLAN_NAME__c: 'Liberator', Policy_Status_Description__c: 'LAPSE W/VALUE', Contact__c: 'c2' }
]; };
const cl = env.agClients_(pilot['a-neil-ramnanan'], DAY);
ok('asks by his agent number', /AgentName__c LIKE 'A10024%'/.test(soql), soql);
ok('Gail\'s birthday in two days', cl.birthdays.length === 1 && cl.birthdays[0].inDays === 2 && cl.birthdays[0].age === 46, JSON.stringify(cl.birthdays));
ok('Gail\'s 11th policy anniversary is a review', cl.reviews.length === 1 && cl.reviews[0].years === 11, JSON.stringify(cl.reviews));
ok('Hal is lapsed with value', cl.lapsed.length === 1);

console.log('\nThe send:\n');
const sent = [];
env.MailApp.sendEmail = (m) => sent.push(m);
env.agentBook_ = () => null;
env.agLetter_ = () => '';
env.goalFor_ = () => null;
env.sfkToken_ = () => ({ instance_url: 'https://sf.example' });
env.hrRows_ = () => [];
const data = { open: {}, closed: {}, ff: {}, f360: {}, q: {}, goal: {}, orphan: {}, feed: null };
env.agentMorningMail_(pilot['a-neil-ramnanan'], DAY, data, null);
ok('one mail, to Neil', sent.length === 1 && sent[0].to === 'neil@example.com', JSON.stringify(sent.map(m => m.to)));
ok('copied to Ricky and sales support', sent[0] && sent[0].cc === 'ricky@example.com,rickyrampersadsalessupport@myguardiangroup.com', sent[0] && sent[0].cc);
ok('it opens on the one that moves him', sent[0] && /the one that moves you/i.test(sent[0].htmlBody) && sent[0].htmlBody.indexOf('the one that moves you') < sent[0].htmlBody.indexOf('Good morning, Neil'));
ok('the plan is what he intends', sent[0] && /Calls you will make today/.test(sent[0].htmlBody) && /New people you will meet/.test(sent[0].htmlBody));
ok('fact finds, clients and coaching are in it', sent[0] && /since September/.test(sent[0].htmlBody) && /Birthdays/.test(sent[0].htmlBody) && /what help to ask for/.test(sent[0].htmlBody));
sent.length = 0;
env.agentMorningMail_(people['a-varun-seegolam'], DAY, data, null);
ok('an agent outside the pilot gets nothing', sent.length === 0);

console.log('\nProduction against the FY27 goal:\n');
const goal = { api: 120000, apps: 24, q: [30000, 30000, 30000, 30000], ffWk: 2, appsWk: 1, contactsWk: 20, apptsWk: 5, weeksIn: 3, paceApi: 6900 };
const cache = { tag: 'c' };
env.iScope_ = () => ({ production: { byAgent: [{ agentId: '10024', months: { 9: 50000, 10: 5000 } }],
  rows: [ { settled: '2026-09-20', apps: 1, api: 50000 }, { settled: '2026-10-08', apps: 1, api: 3000 }, { settled: '2026-10-16', apps: 1, api: 2000 } ] } });
const prod = env.agProduction_(pilot['a-neil-ramnanan'], DAY, cache, goal, null, f, { pend: [1, 2] });
ok('only FY27 counts: October, not September', prod.api === 5000 && prod.apps === 2, JSON.stringify({ api: prod.api, apps: prod.apps }));
ok('target is his goal\'s API', prod.target === 120000 && prod.pct === 4);
ok('Q1 is October to December, from the goal\'s Q1', prod.q.n === 1 && prod.q.to === '2026-12-31' && prod.qTarget === 30000);
ok('pace on 19 Oct is 19 days of 365', prod.pace === Math.round(120000 * 19 / 365), String(prod.pace));
ok('behind pace by the difference', prod.gap === 5000 - prod.pace);
ok('the last 7 days', prod.week === 2000);
ok('applications needed for the quarter, at his average', prod.avgApp === 2500 && prod.qAppsNeeded === 10, JSON.stringify({ avg: prod.avgApp, n: prod.qAppsNeeded }));
ok('pipeline: said yes and pendings', prod.pipeYes === 2 && prod.pipePend === 2);
const card = env.agProdCard_(prod);
ok('the card shows the API, the goal and behind', /\$5k/.test(card) && /\$120k/.test(card) && /behind/.test(card) && /Q1/.test(card), card.slice(0, 300));
const top = env.agMotivate_(pilot['a-neil-ramnanan'], DAY, f, goal, null, null, prod);
ok('behind the goal, production leads the morning', /behind your FY27 API goal/.test(top[0].head), top[0].head);
const q2 = env.agFyQuarter_('2027-02-10'); ok('February is Q2', q2.n === 2 && q2.from === '2027-01-01');
const ahead = env.agProduction_(pilot['a-neil-ramnanan'], DAY, { tag: 'd' }, { api: 10000, q: [] }, null, null, null);
ok('ahead of the goal says so', env.agProdLine_(ahead).head.indexOf('ahead') > -1 && ahead.qTarget === 2500);
const nogoal = env.agProdCard_(env.agProduction_(pilot['a-neil-ramnanan'], DAY, cache, null, null, null, null));
ok('no goal on record: says to set it', /No FY27 API goal/.test(nogoal));

console.log('\nThe midday check-in:\n');
sent.length = 0;
env.goalFor_ = () => goal;
env.agentBook_ = () => null;
env.agentMiddayMail_(pilot['a-neil-ramnanan'], DAY, Object.assign({}, data, { goal: { 'a-neil-ramnanan': goal } }), cache);
ok('a check-in mail to Neil, copied', sent.length === 1 && /Check in/.test(sent[0].subject) && sent[0].cc === 'ricky@example.com,rickyrampersadsalessupport@myguardiangroup.com', sent[0] && sent[0].subject);
ok('it carries the check-in link and his production', sent[0] && /f=agm/.test(sent[0].htmlBody) && /FY27/.test(sent[0].htmlBody));
const pg = env.agReplyPage_({ agent: pilot['a-neil-ramnanan'] }, DAY, 'agm', '');
const pgs = typeof pg === 'string' ? pg : (pg.getContent ? pg.getContent() : JSON.stringify(pg));
ok('the check-in page asks "so far"', /so far/.test(pgs) && /Check in/.test(pgs));
const written = [];
env.agWrite_ = (a, d, kind, rows) => written.push({ kind, n: rows.length });
env.agCopy_ = () => {};
const form = {}; env.AGENT_METRICS.forEach(m => { form['m_' + m.id] = '1'; });
env.agReplySave_({ agent: pilot['a-neil-ramnanan'] }, DAY, 'agm', form);
ok('saved as a check-in', written.length === 1 && written[0].kind === 'check', JSON.stringify(written));

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
