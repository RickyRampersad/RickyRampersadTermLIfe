// The Unit Manager, 19 October 2026: he is not a Salesforce user, so nothing links him to Salesforce and every
// task he sees has a box that posts to its Chatter; and his mail shows each agent's FY27 goal, production, fact
// finds and day. Made-up clients only.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Akaash Kalladeen','akaash','akaash@example.com','1','Unit Manager','Akaash','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
const DAY = '2026-10-19';
env.__mkSheet('FFRevised', 1, ['Status','Submitted At','App Type','Client Name','Advisor Name','Agent Code','Final Decision','Case Outcome'], [
  ['approved', '2026-10-13 09:00', 'full', 'Ann Able', 'Fawwaz Mohamed', 'A12397', 'proceed', ''],
  ['approved', '2026-09-02 09:00', 'full', 'Ben Bell', 'Darryl Manick', 'A11238', 'proceed', 'Picked up']
]);
env.unitAgents_ = () => ['Akaash Kalladeen', 'Fawwaz Mohamed', 'Darryl Manick'];
env.agentPeople_ = () => ({
  'a-fawwaz-mohamed': { key: 'a-fawwaz-mohamed', name: 'Fawwaz Mohamed', agentName: 'Fawwaz Mohamed', agentId: 'A12397', code: 'A12397', email: 'f@example.com' },
  'a-darryl-manick': { key: 'a-darryl-manick', name: 'Darryl Manick', agentName: 'Darryl Manick', agentId: 'A11238', code: 'A11238', email: 'd@example.com' }
});
env.skillBank_ = () => ({ 'akaash kalladeen': { code: 'A06869', name: 'Akaash Kalladeen', isAgent: false, active: true } });
const goals = { 'Akaash Kalladeen': 4000000, 'Fawwaz Mohamed': 2000000 };
env.goalFor_ = (n) => goals[n] ? { api: goals[n], q: [], apps: 100, weeksIn: 3, paceApi: 1 } : null;
env.iScope_ = (c, s) => ({ production: { byAgent: [{ months: { 10: s.agentName === 'Fawwaz Mohamed' ? 50000 : 0 } }], rows: [] } });
env.hrRows_ = () => [
  { Date: DAY, Agent: 'a-fawwaz-mohamed', Kind: 'plan', Item: 'calls', Planned: 12 },
  { Date: DAY, Agent: 'a-fawwaz-mohamed', Kind: 'plan', Item: 'ff', Planned: 2 },
  { Date: DAY, Agent: 'a-fawwaz-mohamed', Kind: 'check', Item: 'calls', Done: 7 }
];

console.log('\nHis agents in his mail:\n');
const card = env.umAgentsCard_('akaash', DAY, { c: 1 }, 13 * 60);
ok('a row for him and each agent', /Akaash Kalladeen/.test(card) && /Fawwaz Mohamed/.test(card) && /Darryl Manick/.test(card));
ok('production against the goal, behind pace', /\$50k<\/b> of \$2\.0m/.test(card) && /behind pace/.test(card), card.slice(0, 600));
ok('an agent with no goal plan is named', /no FY27 goal plan/.test(card) && /No FY27 goal plan on FactFind360:<\/b> Darryl/.test(card));
ok('fact finds since September, from FFRevised', /<b>1<\/b> · last Tue 13 Oct/.test(card));
ok('Darryl has written none in 14 days', /No fact find in 14 days or more:<\/b> Darryl \(47d\)/.test(card), (card.match(/No fact find[^<]*<\/b>[^.]*/) || [''])[0]);
ok('today: plan, and the midday check-in', /plan in: 12 calls, 2 FF/.test(card) && /checked in · 7 calls so far/.test(card));
ok('no plan is called out after 10:30', /No plan today:<\/b> Darryl/.test(card));

console.log('\nNot a Salesforce user:\n');
env.sfkToken_ = () => ({ instance_url: 'https://rickyrampersadbranch.my.salesforce.com' });
const t = { id: '00T1', subject: 'Quote for a client', agent: 'Fawwaz Mohamed', due: '', late: false, touched: 400, ty: 'Opportunity' };
const line = env.umTaskLine_(t, DAY, 'https://rickyrampersadbranch.my.salesforce.com/', 'akaash');
ok('a task in his mail links to his page, never Salesforce', !/salesforce\.com/.test(line) && /comment &rarr;/.test(line) && /#t-00T1/.test(line), line);
const day = env.umDayItems_('akaash', DAY, { open: [t] });
ok('the day items link to his page too', day.every(i => !/salesforce\.com/.test(i.html)) && day.some(i => /#t-00T1/.test(i.html)));
const items = env.umPageItems_([{ k: 'pend', list: [] }], { open: [t] }, DAY);
ok('a quiet task outside every section still gets a box', items.length === 1 && items[0].id === '00T1');
const big = Array.from({ length: 400 }, (_, i) => ({ id: '00T' + i, s: 'x'.repeat(60), a: 'Fawwaz', due: DAY, late: true, k: 'pend' }));
const fit = env.umFitJson_(big);
ok('a long list is kept as whole JSON under 9 KB', fit.length <= 8900 && Array.isArray(JSON.parse(fit)) && JSON.parse(fit).length > 50);
env.PropertiesService.getScriptProperties().setProperty(env.umItemsKey_('akaash', DAY), JSON.stringify(items));
const page = env.umReplyPage_({ staffId: 'akaash', name: 'Akaash Kalladeen' }, DAY, '');
const html = typeof page === 'string' ? page : (page.getContent ? page.getContent() : JSON.stringify(page));
ok('his page has the box, anchored, and no Salesforce link', /id="t-00T1"/.test(html) && /name="c_00T1"/.test(html) && !/salesforce\.com/.test(html));
ok('his page says no Salesforce login is needed', /do not need a Salesforce login/.test(html));
const posted = [];
env.sfkInsert_ = (o, rec) => { posted.push(rec); return {}; };
env.signInFromPage_ = () => null; env.umCopy_ = () => {};
env.umReplySave_({ staffId: 'akaash', name: 'Akaash Kalladeen' }, DAY, { c_00T1: 'Spoke to the client, quote going Thursday.' });
ok('what he types goes onto that task\'s Chatter in his name', posted.length === 1 && posted[0].ParentId === '00T1' && /Unit Manager · Akaash Kalladeen/.test(posted[0].Body) && /quote going Thursday/.test(posted[0].Body), JSON.stringify(posted));

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
