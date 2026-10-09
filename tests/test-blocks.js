/* FIVE BLOCKS, FIVE TO MIDNIGHT — and who is owed which.
 *
 * "The time blocks need to be adjusted consistent with the wall, because the
 * wall is streaming. The wall starts from five to ten and it goes until twelve
 * a.m. Five time blocks." (17 September 2026.) The wall's fifth band was read
 * from Salesforce and filed by nobody; it is a real block now, because the
 * person who asked for it works into it.
 *
 * The trap this pins: support staff work eight to four. A fifth block counted
 * against everybody would have the whole branch a block short every evening,
 * which is the fastest way to have a tracker ignored. Owed comes from a
 * person's own schedule, never from the length of the block list.
 */
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'], []);

console.log('\nThe day is five blocks now:\n');
ok('five of them', env.BLOCK_IDS.length === 5, env.BLOCK_IDS.join(', '));
ok('the fifth is the after-four band, and it is last',
   env.BLOCK_IDS[4] === 'EVE', env.BLOCK_IDS.join(', '));
ok('the first four are unchanged',
   env.BLOCK_IDS.slice(0, 4).join(',') === 'KPI1,KPI2,PM1,PM2', env.BLOCK_IDS.join(', '));
ok('it falls due at midnight, not four', env.BLOCK_DUE_HOUR.EVE === 24, String(env.BLOCK_DUE_HOUR.EVE));

console.log('\nOwed is the person\'s own schedule, not the list:\n');
/* The Branch Manager is the only day on the schedule that runs the whole
   envelope, because it is the only one that does. */
ok('the Branch Manager is owed all five', env.blocksOwed_('ricky') === 5, String(env.blocksOwed_('ricky')));
ok('his day starts at five', /^5\s*[–-]\s*10am$/.test(env.SCHEDULE.ricky.blocks.KPI1.time),
   env.SCHEDULE.ricky.blocks.KPI1.time);
ok('and runs to midnight', /12am/.test(env.SCHEDULE.ricky.hours), env.SCHEDULE.ricky.hours);
ok('support staff are owed four', env.blocksOwed_('sasha') === 4, String(env.blocksOwed_('sasha')));
ok('and are not scheduled into the evening', !env.SCHEDULE.sasha.blocks.EVE);
ok('somebody not on the schedule is owed four, not five',
   env.blocksOwed_('nobody-yet') === 4, String(env.blocksOwed_('nobody-yet')));

console.log('\nA four-block sheet gains the fifth block\'s own columns:\n');
/* ensureLogColumns_ used to add only the derived columns — _At, _Quality,
   _Plan, _Met — because the four original blocks were already in the branch's
   sheet when the script first ran. The fifth is not, so without this a filed
   evening block had a timestamp and nowhere to write the work. */
const FOUR = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a, p) =>
    a.concat([p, p+'_Actioned', p+'_Resolved', p+'_Open', p+'_Blocker']), []))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes']);
env.__mkSheet('KPI Log', 2, FOUR, []);
env.__mkSheet('KPI Training', 3, ['TrainingDate','StaffId','Trainer','Block'], []);
env.ensureLogColumns_(env.__sheets['KPI Log']);
const head = env.__sheets['KPI Log']._grid[0];
['EVE','EVE_Actioned','EVE_Resolved','EVE_Open','EVE_Blocker','EVE_At','EVE_Quality','EVE_Plan','EVE_Met']
  .forEach(c => ok('added: ' + c, head.indexOf(c) > -1));
ok('and nothing that was there was moved',
   head.slice(0, FOUR.length).join(',') === FOUR.join(','));

console.log('\nAnd the evening block saves like any other:\n');
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
const res = env.saveBlock_({ date: '2026-09-17', block: 'EVE',
  data: { kpi: 'Opportunity', actioned: 'Two opportunities moved after six', met: 'Met' } },
  { staffId: 'ricky', name: 'Ricky Rampersad', manager: true });
ok('it saves', res.ok, JSON.stringify(res.ok ? '' : res));
const row = env.__sheets['KPI Log']._grid[1], hd = env.__sheets['KPI Log']._grid[0];
ok('the work landed in the evening column',
   row[hd.indexOf('EVE_Actioned')] === 'Two opportunities moved after six');
ok('and it counts as a block done', res.blocksDone === 1, 'got ' + res.blocksDone);

console.log(fails ? '\n' + fails + ' failed\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
