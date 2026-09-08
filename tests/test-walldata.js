// The wall's live feed. The masking rule is the part that must not slip:
// a subject about somebody's pay is counted and aged, never quoted.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l,c,x='') => { console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:'')); if(!c) fails++; };

console.log('\nSubjects that must never reach a screen in an open office:\n');
[
  'Request for Salary Review- Sasha Lalla-Jagassar',
  'Salary review — pending',
  'Disciplinary meeting notes',
  'Grievance raised by staff member',
  'Warning letter to be issued',
  'Probation review — new starter',
  'Contract review for administrator',
  'Termination paperwork',
].forEach(s => ok('masked: "'+s.slice(0,44)+'"', env.maskSubject_(s) === null));

console.log('\nAnd the ordinary work that must still read plainly:\n');
[
  'Premium- :Leila Jailal - 8004023177',
  'Confirm funds-8004141188 Ralna Romany-Thomas',
  'Pre-approval for Health Claim - Susan Bhagwansingh',
  'Follow up with UW- 1000894223',
  'XTRA Foods - August 2026 Group Health and Group Life Billings',
  'Investment Discussions - Neal Balroop',
].forEach(s => ok('shown: "'+s.slice(0,44)+'"', env.maskSubject_(s) === s));

console.log('\nAges are counted, never summed:\n');
const iso = d => { const x=new Date(); x.setDate(x.getDate()-d); return x.toISOString().slice(0,10); };
ok('yesterday is one day', env.daysSince_(iso(1)) === 1, String(env.daysSince_(iso(1))));
ok('ninety days is ninety', env.daysSince_(iso(90)) === 90, String(env.daysSince_(iso(90))));
ok('an empty date is nothing, not NaN', env.daysSince_(null) === 0);
ok('a long subject is trimmed, not wrapped',
   env.shorten_('x'.repeat(200), 40).length === 40);

console.log('\nIt must never take the wall down:\n');
ok('an unreachable Salesforce returns null, not an exception',
   env.wallDataSafe_() === null);

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
