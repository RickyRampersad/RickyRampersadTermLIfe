// Every open task reaches the agent, not only what is due today (16 November 2026, 2026-11-16a).
//
// Randolph, 9:00am: "Not seeing the staff has any tasks OPEN or 'being worked on' for my pending cases to assist with
// settlement." His two settlements were open with Azariah, dated Wednesday; the feed asked only for ActivityDate <= today.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
const DAY = '2026-11-16';
const a = { key: 'a-randolph', name: 'Randolph Gonzales', agentName: 'Randolph Gonzales', email: 'r@example.com' };
let asked = [];
env.ff360Feed_ = () => null; env.ff360Agent_ = () => null; env.openQueries_ = () => [];
env.goalFor_ = () => null; env.orphanFor_ = () => null;
env.sfkQuery_ = q => {
  asked.push(q);
  if (/FROM Contact/.test(q)) return [{ Id: 'C1', Name: 'Randolph Gonzales' }];
  if (/FROM Task WHERE IsClosed = false/.test(q)) return [
    { Id: 'T1', Subject: 'Orphan Project: follow up', Task_Type__c: 'Servicing', ActivityDate: '2026-11-16', Owner: { Name: 'Azariah Griffith' }, Agent__c: 'C1' },
    { Id: 'T0', Subject: 'Renewal payment', Task_Type__c: 'Renewa/PDl/Bill', ActivityDate: '2026-11-12', Owner: { Name: 'Azariah Griffith' }, Agent__c: 'C1' },
    { Id: 'T2', Subject: 'Settlement - client one', Task_Type__c: 'Pendings', ActivityDate: '2026-11-18', Owner: { Name: 'Azariah Griffith' }, Agent__c: 'C1' },
    { Id: 'T3', Subject: 'Orphan response: what it pays', Task_Type__c: 'Servicing', ActivityDate: '2026-11-17', Owner: { Name: 'Azariah Griffith' }, Agent__c: 'C1' },
    { Id: 'T4', Subject: 'SQ - client two', Task_Type__c: 'Servicing', ActivityDate: null, Owner: { Name: 'Kamla Dookran' }, Agent__c: 'C1' }];
  return [];
};
const d = env.agentBatchData_([a], DAY);
const tq = asked.find(q => /FROM Task WHERE IsClosed = false/.test(q)) || '';
ok('the open-task query no longer stops at today', !/ActivityDate <=/.test(tq), tq);
ok('due today and overdue stay in open', d.open['a-randolph'].map(t => t.id).sort().join() === 'T0,T1', JSON.stringify(d.open['a-randolph'].map(t => t.id)));
ok('later and undated go to ahead', d.ahead['a-randolph'].map(t => t.id).sort().join() === 'T2,T3,T4');
const ah = env.agAheadSort_(d.ahead['a-randolph']);
ok('the settlement comes first', ah[0].id === 'T2', ah.map(t => t.id).join());
const items = env.agItemsOf_(d.open['a-randolph'], ah);
ok('My day gets all five', items.length === 5 && items.filter(i => i.ahead).length === 3);
const html = env.agAheadHtml_(a, ah);
ok('the e-mail says what is being worked, who has it and the next step', /Also being worked for your clients \(3\)/.test(html) && /Azariah<\/b> · Settlement - client one/.test(html) && /next step 18 Nov|next step Wed 18 Nov/.test(html), html.slice(0, 500));
ok('nothing ahead, no section', env.agAheadHtml_(a, []) === '');
console.log(fails ? fails + ' FAILED' : 'all green'); process.exit(fails ? 1 : 0);
