// What the SERVER sends, not what the screen draws.
//
// The rows response carries four Salesforce reads. Three of them were being
// sent unfiltered: every member of staff received the whole branch's overdue
// book and billing book on every sign-in — client names, policy numbers,
// account names — and nobody saw it, because the screen only ever renders
// your own. A screen that does not draw the data is not a server that does
// not send it.
//
// So this file reads the wire, not the page.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const LOG = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes']);
const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Kamla Dookran','kamla','kamla@example.com','1',"Branch Manager's Assistant",'Branch','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
env.__mkSheet('KPI Log', 2, LOG, []);
env.__mkSheet('KPI Training', 3, TRH, []);

// Kamla's rows carry the things that must never reach Sasha's browser.
const SECRETS = ['XTRA FOODS', 'Salary review', 'a private maturity'];
env.sfkNeedsReasonSafe_ = () => ({
  sasha: [{ id: '1', subject: 'Follow up with UW - 1000893219', type: 'Pendings', age: 9 }],
  kamla: [{ id: '2', subject: 'Salary review - staffing matter', type: 'Lic/Staffing/SA/HR', age: 40 }] });
env.sfkBillingCheckSafe_ = () => ({
  sasha: { items: [{ id: '3', account: 'R&C ENTERPRISES' }] },
  kamla: { items: [{ id: '4', account: 'XTRA FOODS' }] } });
env.sfkOpenBookSafe_ = () => ({
  sasha: { Pendings: [{ id: '5', subject: 'ANNUITY 8004298001 KEISHA MASON' }] },
  kamla: { 'Claims/ Mat': [{ id: '6', subject: 'a private maturity' }] } });
env.sfkMetricsSafe_ = () => ({ ok: false, reason: 'notConfigured' });

const STAFF = { staffId: 'sasha', name: 'Sasha Lalla', manager: false };
const BOSS = { staffId: 'ricky', name: 'Ricky Rampersad', manager: true };
env.readToken_ = t => (t === 'staff' ? STAFF : t === 'boss' ? BOSS : null);

console.log('\nA member of staff signs in and asks for their days:\n');
env.resetRequestMemo_();
const mine = env.handle_('rows', {}, 'staff');
ok('the response comes back', mine.ok, JSON.stringify(mine.ok ? '' : mine));
ok('her own open book is there', !!(mine.openBook && mine.openBook.sasha));
ok('her own overdue list is there', !!(mine.needsReason && mine.needsReason.sasha));
ok('her own billing is there', !!(mine.billing && mine.billing.sasha));
ok('and nobody else’s book', !(mine.openBook && mine.openBook.kamla));
ok('nor anybody else’s overdue', !(mine.needsReason && mine.needsReason.kamla));
ok('nor anybody else’s billing', !(mine.billing && mine.billing.kamla));

// The assertion that survives a new field being added to the response.
const wire = JSON.stringify(mine);
SECRETS.forEach(sec =>
  ok('"' + sec + '" is nowhere on the wire', wire.indexOf(sec) === -1));

console.log('\nThe Branch Manager asks the same question:\n');
env.resetRequestMemo_();
const all = env.handle_('rows', {}, 'boss');
ok('he sees the branch’s open book', !!(all.openBook && all.openBook.kamla && all.openBook.sasha));
ok('and the branch’s overdue', !!(all.needsReason && all.needsReason.kamla));
ok('and the branch’s billing', !!(all.billing && all.billing.kamla));

console.log('\nAnd the standalone actions answer the same way as the rows response:\n');
env.resetRequestMemo_();
ok('openBook, staff', !env.handle_('openBook', {}, 'staff').book.kamla);
ok('openBook, manager', !!env.handle_('openBook', {}, 'boss').book.kamla);
ok('needsReason, staff', !env.handle_('needsReason', {}, 'staff').needsReason.kamla);
ok('needsReason, manager', !!env.handle_('needsReason', {}, 'boss').needsReason.kamla);
ok('billing, staff', !env.handle_('billing', {}, 'staff').billing.kamla);
ok('billing, manager', !!env.handle_('billing', {}, 'boss').billing.kamla);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
