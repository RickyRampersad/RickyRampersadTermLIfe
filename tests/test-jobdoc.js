// The job document, and the quarter measured against it.
//
// Two things here are not conveniences. The documents are Guardian Group's
// internal HR papers and live in the workbook, never in this repository, which
// is public — so the script has to read them from a tab and cope with the tab
// not being there yet. And an appraisal where the manager can write the
// self-assessment is not a self-assessment, so each side writes its own half
// and only its own half.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const LOGH = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes','UpdatedAt','Revision'])
  .concat(['KPI1_At','KPI2_At','PM1_At','PM2_At'])
  .concat(['KPI1_Quality','KPI2_Quality','PM1_Quality','PM2_Quality'])
  .concat(['KPI1_Plan','KPI2_Plan','PM1_Plan','PM2_Plan'])
  .concat(['KPI1_Met','KPI2_Met','PM1_Met','PM2_Met']);
const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];

const logRow = (date, va, innov, met) => {
  const r = new Array(LOGH.length).fill('');
  const set = (h, v) => { r[LOGH.indexOf(h)] = v; };
  set('Date', date); set('StaffId', 'sasha'); set('Name', 'Sasha Lalla');
  set('ValueAdded', va); set('Innovation', innov);
  set('KPI1_Actioned', 'Premium dues — 14 processed'); set('KPI1_Met', met);
  return r;
};

function boot(withJobTab) {
  const env = makeEnv();
  env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
    [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
     ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
  env.__mkSheet('KPI Log', 2, LOGH, [
    logRow('2026-08-04', 'Rebuilt the arrears macro, saves an hour a week', 'None today', 'met'),
    logRow('2026-08-19', 'None today', 'Suggested one checklist for new applications', 'partly'),
    logRow('2026-05-02', 'Out of the quarter entirely', 'Also out of it', 'met'),
  ]);
  env.__mkSheet('KPI Training', 3, TRH, []);
  if (withJobTab) env.__mkSheet('Job Docs', 4, ['Role','Section','Order','Item','Detail'], [
    ['ssa','Core value',1,'Continuous Improvement','Be better today than yesterday'],
    ['ssa','Core value',2,'Curiosity','Question answers. Learn and be curious'],
    ['ssa','Responsibility',1,'New Application Process','Check applications for completeness'],
    ['ssa','Responsibility',2,'Reporting','Weekly Branch Report to Head Office'],
    ['bma','Responsibility',1,'People Management','Close performance gaps through coaching'],
  ]);
  return env;
}

console.log('\nThe documents live in the workbook, so the tab may not be there yet:\n');
{
  const env = boot(false);
  const r = env.jobDocFor_({ staffId:'sasha', role:'ssa', manager:false }, {});
  ok('a missing tab is a plain answer, not a crash', r.ok === false && /Job Docs/.test(r.error), r.error);
}

console.log('\nWith it in place, each role gets its own paper:\n');
const env = boot(true);
{
  const mine = env.jobDocFor_({ staffId:'sasha', role:'ssa', manager:false }, {});
  ok('the document comes back', mine.ok === true);
  ok('grouped by section', !!(mine.doc && mine.doc['Responsibility'] && mine.doc['Core value']));
  ok('in the order the paper is in',
     mine.doc['Responsibility'][0].item === 'New Application Process');
  ok('and only their role', mine.doc['Responsibility'].length === 2);

  const asStaff = env.jobDocFor_({ staffId:'sasha', role:'ssa', manager:false }, { role:'bma' });
  ok('staff cannot fetch another role', asStaff.doc['Responsibility'][0].item === 'New Application Process');
  const asMgr = env.jobDocFor_({ staffId:'ricky', role:'bm', manager:true }, { role:'bma' });
  ok('the manager can, for a one-to-one', asMgr.doc['Responsibility'][0].item === 'People Management');
}

console.log('\nThe quarter gathers what was written, and only that quarter:\n');
{
  const a = env.appraisal_('sasha', '2026-Q3', 'ssa');
  ok('it runs July to September', a.from === '2026-07-01' && a.to === '2026-10-01', a.from + '→' + a.to);
  ok('two days in the quarter', a.days === 2, 'got ' + a.days);
  ok('value added is evidence for Continuous Improvement', a.evidence.valueAdded.length === 1,
     JSON.stringify(a.evidence.valueAdded));
  ok('innovation is evidence for Curiosity', a.evidence.innovation.length === 1);
  ok('"None today" is honest but is not evidence',
     !a.evidence.valueAdded.concat(a.evidence.innovation).some(e => /none/i.test(e.text)));
  ok('the May entries stay out of Q3',
     !JSON.stringify(a.evidence).includes('Out of the quarter'));
  ok('and it counts how the blocks landed', a.evidence.met.met === 1 && a.evidence.met.partly === 1,
     JSON.stringify(a.evidence.met));
}

console.log('\nEach side writes its own half, and only its own:\n');
{
  env.saveAppraisal_({ quarter:'2026-Q3', value:'Curiosity', rating:'3',
                       note:'Asked for the arrears format to change' },
                     { staffId:'sasha', role:'ssa', manager:false });
  env.saveAppraisal_({ staffId:'sasha', quarter:'2026-Q3', value:'Curiosity',
                       rating:'4', note:'Agreed — and she was right' },
                     { staffId:'ricky', role:'bm', manager:true });

  const a = env.appraisal_('sasha', '2026-Q3', 'ssa');
  const c = a.ratings['Curiosity'] || {};
  ok('her own words are hers', c.selfRating === '3' && /arrears format/.test(c.selfNote), JSON.stringify(c));
  ok('his sit beside them, not over them', c.mgrRating === '4' && /she was right/.test(c.mgrNote));
  ok('one row per value, not one per save',
     env.__sheets['Appraisals']._grid.length === 2, 'rows=' + (env.__sheets['Appraisals']._grid.length - 1));

  const bad = env.saveAppraisal_({ staffId:'ricky', quarter:'2026-Q3',
                                   value:'Curiosity', rating:'5' },
                                 { staffId:'sasha', role:'ssa', manager:false });
  ok('nobody writes somebody else\'s self-assessment', bad.ok === false, JSON.stringify(bad));
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
