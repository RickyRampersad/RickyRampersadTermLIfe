// Performance: the form's arithmetic, the two halves, and the evidence.
//
// The scores are checked against a real signed form from this branch, with
// its ten weights and its ratings typed in: People Leader goal score 0.8375,
// competency score 0.84375, overall 0.83875; employee 0.875, 1.0, 0.9. If the
// arithmetic here ever drifts from the paper, this file says so before a
// person is told a number the form would not have given them.
//
// The halves: a person writes their own ratings and only their own; the
// People Leader — whoever they report to, or the Branch Manager — writes the
// other column and only that column. The People Leader cannot rate
// themselves. Nobody else sees the review at all.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const near = (a, b) => Math.abs(a - b) < 0.00005;

const LOGH = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes','UpdatedAt','Revision'])
  .concat(['KPI1_At','KPI2_At','PM1_At','PM2_At'])
  .concat(['KPI1_Quality','KPI2_Quality','PM1_Quality','PM2_Quality'])
  .concat(['KPI1_Plan','KPI2_Plan','PM1_Plan','PM2_Plan'])
  .concat(['KPI1_Met','KPI2_Met','PM1_Met','PM2_Met']);
const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];

// A day: KPI1 was renewals and premium dues, planned 90 minutes, and landed.
const day = (date, kpi, plan, met, actioned) => {
  const r = new Array(LOGH.length).fill('');
  const set = (h, v) => { r[LOGH.indexOf(h)] = v; };
  set('Date', date); set('StaffId', 'sasha'); set('Name', 'Sasha Lalla');
  set('KPI1', kpi); set('KPI1_Plan', plan); set('KPI1_Met', met); set('KPI1_Actioned', actioned);
  return r;
};

// The ten goals from the Administration v8.3 form, weights as on the paper.
const GOALS = [
  ['ssa',1,'New Applications & Increase Applications Processing','','Increasing',15,0.9,'New Application Process, Pendings'],
  ['ssa',2,'Group Applications / Group Changes / Dependent Enrollments','','Increasing',10,0.9,'New Application Process, Renewa/PDl/Bill'],
  ['ssa',3,'Policy Contract and Scripts / Clawback Management','','Increasing',10,0.95,'Scripts/CB'],
  ['ssa',4,'Premium Dues / Lapse Management','','Increasing',15,0.95,'Renewa/PDl/Bill, Pendings'],
  ['ssa',5,'Reinstatements / Alterations Processing','','Increasing',10,0.9,'Pendings'],
  ['ssa',6,'Existing Individual Health and Group Plans Management','','Increasing',5,0.9,'Renewa/PDl/Bill'],
  ['ssa',7,'Mail / Transmittal Management','','Increasing',10,0.95,'Mail Management / Contracts'],
  ['ssa',8,'Administrative Support','','Increasing',10,0.9,'Administrative Support'],
  ['ssa',9,'Campaigns / Projects','','Increasing',5,0.9,'RR Operations'],
  ['ssa',10,'Reporting','','Increasing',10,0.95,'Reporting'],
];
const COMPS = ['Courtesy & Interpersonal Skills','Customer Service','Growth','Innovation',
               'Positive Energy','Quality','Reliability','Responsiveness']
  .map((c, i) => [i + 1, c, 'definition of ' + c, 'one · two · three']);

function boot(withTabs) {
  const env = makeEnv();
  env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
    [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
     ['Kamla Dookran','kamla','kamla@example.com','1',"Branch Manager's Assistant",'Branch','Yes'],
     ['Pawan Probhu','pawan','pawan@example.com','1','Personal Assistant','Branch','Yes'],
     ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
  env.__mkSheet('KPI Log', 2, LOGH, [
    day('2026-04-20', 'Renewa/PDl/Bill', 90, 'met', 'Premium dues — 14 processed, 2 back to the advisor'),
    day('2026-05-11', 'Renewa/PDl/Bill, Pendings', 120, 'partly', '9 pending cases chased, 6 replied'),
    day('2026-06-02', 'Reporting', 40, 'met', 'Weekly production to Sales Admin'),
    day('2026-07-15', 'Renewa/PDl/Bill', 60, 'met', 'Out of the period'),
  ]);
  env.__mkSheet('KPI Training', 3, TRH, []);
  if (withTabs) {
    env.__mkSheet('Goals', 4, ['Role','Order','Goal','Description','TargetType','Weight','Target','KpiTypes'], GOALS);
    env.__mkSheet('Competencies', 5, ['Order','Competency','Definition','Behaviours'], COMPS);
  }
  env.sfkMetricsSafe_ = () => ({ ok:false, reason:'notConfigured' });
  env.sfkClosedInPeriodSafe_ = () => null;
  return env;
}
const SASHA = { staffId:'sasha', name:'Sasha Lalla', role:'ssa', manager:false };
const KAMLA = { staffId:'kamla', name:'Kamla Dookran', role:'bma', manager:false };
const PAWAN = { staffId:'pawan', name:'Pawan Probhu', role:'pa',  manager:false };
const RICKY = { staffId:'ricky', name:'Ricky Rampersad', role:'bm', manager:true };

console.log('\nThe form lives in the workbook, so the tabs may not be there yet:\n');
{
  const env = boot(false);
  const b = env.hrBundle_(SASHA);
  ok('the bundle says so plainly', b.ok && b.setup.goals === false && b.setup.competencies === false);
  const r = env.openReview_({ staffId:'sasha', type:'Mid Probation', from:'2026-04-13', to:'2026-06-13' }, KAMLA);
  ok('a review can still be opened', r.ok, JSON.stringify(r));
  const v = env.review_(KAMLA, r.id);
  ok('but reading it names the missing tab', v.ok === false && /Goals/.test(v.error), v.error);
}

console.log('\nWho leads whom:\n');
const env = boot(true);
// The title on the paper is "Sales Support Assistant". It contains the word
// assistant; it is not the Branch Manager's Assistant.
ok('a Sales Support Assistant is a support desk, not a BMA',
   env.roleFor_({ role:'Sales Support Assistant', unit:'Support', grade:'', staffId:'' }) === 'ssa');
ok('and a Branch Manager\'s Assistant still is one',
   env.roleFor_({ role:"Branch Manager's Assistant", unit:'Branch', grade:'', staffId:'' }) === 'bma');
ok('the BMA leads the support desks', env.leads_(KAMLA).sort().join() === 'sasha');
ok('the Branch Manager leads everyone but himself', env.leads_(RICKY).sort().join() === 'kamla,pawan,sasha');
ok('a support desk leads nobody', env.leads_(SASHA).length === 0);
ok('a person is their own "self"', env.sideFor_(SASHA, 'sasha') === 'self');
ok('their People Leader is "pl"', env.sideFor_(KAMLA, 'sasha') === 'pl');
ok('the Branch Manager is "pl" to all', env.sideFor_(RICKY, 'sasha') === 'pl' && env.sideFor_(RICKY, 'kamla') === 'pl');
ok('a colleague is nothing at all', env.sideFor_(PAWAN, 'sasha') === '');
ok('and nobody is "pl" to themselves', env.sideFor_(KAMLA, 'kamla') === 'self');

console.log('\nOpening a review:\n');
ok('a colleague cannot', env.openReview_({ staffId:'sasha', type:'Mid Probation', from:'2026-04-13', to:'2026-06-13' }, PAWAN).ok === false);
ok('nor the person themselves', env.openReview_({ staffId:'sasha', type:'Mid Probation', from:'2026-04-13', to:'2026-06-13' }, SASHA).ok === false);
ok('an unknown type is refused, naming the choices',
   /Mid Probation/.test(env.openReview_({ staffId:'sasha', type:'Annual', from:'2026-04-13', to:'2026-06-13' }, KAMLA).error || ''));
env.resetRequestMemo_();
const opened = env.openReview_({ staffId:'sasha', type:'Mid Probation', from:'2026-04-13', to:'2026-06-13' }, KAMLA);
ok('the People Leader can', opened.ok, JSON.stringify(opened));
env.resetRequestMemo_();
ok('opening it twice is the same review', env.openReview_({ staffId:'sasha', type:'Mid Probation', from:'2026-04-13', to:'2026-06-13' }, KAMLA).existed === true);

console.log('\nThe evidence, per goal, from the daily record:\n');
env.resetRequestMemo_();
let v = env.review_(KAMLA, opened.id);
ok('the review reads', v.ok, JSON.stringify(v.ok ? '' : v));
ok('ten goals, in order', v.goals.length === 10 && v.goals[0].goal.indexOf('New Applications') === 0);
ok('the weights sum to a hundred', v.goals.reduce((n, g) => n + g.weight, 0) === 100);
ok('eight competencies', v.competencies.length === 8);
const pd = v.goals.find(g => /Premium Dues/.test(g.goal));
ok('premium dues sees the two blocks in the period, not the one outside it', pd.evidence.blocks === 2, String(pd.evidence.blocks));
ok('with the minutes planned', pd.evidence.planned === 210);
ok('and how many landed', pd.evidence.met.met === 1 && pd.evidence.met.partly === 1);
ok('and a line of what was actioned', /14 processed/.test(pd.evidence.lines[0].text));
const rp = v.goals.find(g => g.goal === 'Reporting');
ok('reporting sees its one block', rp.evidence.blocks === 1);
ok('no Salesforce here, so closed is unknown rather than zero', pd.evidence.closed === null && v.salesforce === false);
ok('the People Leader is told which half is theirs', v.side === 'pl');
ok('and the person, theirs', env.review_(SASHA, opened.id).side === 'self');
ok('a colleague cannot read it', env.review_(PAWAN, opened.id).ok === false);

console.log('\nEach side writes its own half, and only its own:\n');
const rate = (who, name, rating, note, kind) =>
  env.saveReviewRating_({ reviewId: opened.id, kind: kind || 'goal', name, rating, note }, who);
ok('a colleague cannot rate', rate(PAWAN, 'Reporting', 4, '').ok === false);
ok('a rating of 6 is refused', /1 to 5/.test(rate(SASHA, 'Reporting', 6, '').error || ''));
ok('the person rates their goal', rate(SASHA, 'Reporting', 4, 'Weekly production out every Friday').ok);
ok('the People Leader rates the same goal', rate(KAMLA, 'Reporting', 3, 'Late twice in June').ok);
env.resetRequestMemo_();
v = env.review_(RICKY, opened.id);
const g = v.goals.find(x => x.goal === 'Reporting');
ok('both halves are kept apart', g.selfRating === '4' && g.plRating === '3' && /Friday/.test(g.selfNote) && /June/.test(g.plNote));
ok('the person writing again does not touch the other column', rate(SASHA, 'Reporting', 5, 'revised').ok &&
   (env.resetRequestMemo_(), env.review_(RICKY, opened.id).goals.find(x => x.goal === 'Reporting').plRating === '3'));

console.log('\nThe arithmetic, against the signed form:\n');
// People Leader ratings on the paper, goal by goal: 3,2,4,4,3,3,4,3,3,4. Employee: 4,2,4,4,3,3,4,3,3,4.
const PL   = [3,2,4,4,3,3,4,3,3,4], SELF = [4,2,4,4,3,3,4,3,3,4];
const GW   = [15,10,10,15,10,5,10,10,5,10];
const goals = GW.map((w, i) => ({ weight: w, selfRating: SELF[i], plRating: PL[i] }));
// Competencies on the paper: People Leader 4,4,3,2,4,3,4,3; employee all 4.
const comps = [4,4,3,2,4,3,4,3].map(r => ({ selfRating: 4, plRating: r }));
const sc = env.scoreReview_(goals, comps);
ok('People Leader goal score 0.8375',      near(sc.pl.goalScore, 0.8375),  String(sc.pl.goalScore));
ok('People Leader competency score 0.84375', near(sc.pl.compScore, 0.84375), String(sc.pl.compScore));
ok('People Leader overall 0.83875',        near(sc.pl.opr, 0.83875),       String(sc.pl.opr));
ok('employee goal score 0.875',            near(sc.self.goalScore, 0.875));
ok('employee competency score 1.0',        near(sc.self.compScore, 1));
ok('employee overall 0.9',                 near(sc.self.opr, 0.9));
ok('the standard is 72, and this meets it', sc.standard === 0.72 && sc.pl.meetsStandard === true);
const low = env.scoreReview_(GW.map(w => ({ weight: w, plRating: 2 })), comps.map(() => ({ plRating: 3 })));
ok('twos across the board does not', low.pl.meetsStandard === false && near(low.pl.opr, 0.55));
ok('an unrated goal counts nothing, as on the paper',
   near(env.scoreReview_([{ weight: 50, plRating: 4 }, { weight: 50, plRating: '' }], []).pl.goalScore, 0.5));

console.log('\nSigning:\n');
ok('the person signs their half', env.saveReviewComment_({ reviewId: opened.id, comment: 'A good two months', sign: true }, SASHA).ok);
env.resetRequestMemo_();
ok('and the review is half signed', env.review_(SASHA, opened.id).review.status === 'self-signed');
ok('the People Leader signs theirs', env.saveReviewComment_({ reviewId: opened.id, comment: 'Agreed', sign: true }, KAMLA).ok);
env.resetRequestMemo_();
ok('and now it is signed', env.review_(SASHA, opened.id).review.status === 'signed');
ok('after which nothing on it changes', /signed off/.test(rate(KAMLA, 'Reporting', 5, 'late change').error || ''));

console.log('\nDevelopment on 70-20-10, and the training plan:\n');
ok('an action needs what, why and success', /what they will do/.test(
   env.saveDevelopment_({ staffId:'sasha', source:'Social', action:'Fortnightly coaching' }, KAMLA).error || ''));
ok('the person cannot write one', env.saveDevelopment_({ staffId:'sasha', source:'Social', action:'x', why:'y', success:'z' }, SASHA).ok === false);
const dv = env.saveDevelopment_({ staffId:'sasha', reviewId: opened.id, source:'Social',
  action:'Fortnightly coaching with the BMA', why:'Group business is not yet independent',
  success:'One group application processed end to end without help' }, KAMLA);
ok('the People Leader writes it', dv.ok, JSON.stringify(dv));
env.resetRequestMemo_();
const dev = env.hrBundle_(SASHA).me.development;
ok('and the person sees it', dev.length === 1 && /coaching/.test(dev[0].action));
ok('a colleague cannot mark it done by guessing its id',
   env.saveDevelopment_({ staffId:'pawan', id: dev[0].id, status:'done' }, PAWAN).ok === false);
ok('the person can mark it done', env.saveDevelopment_({ staffId:'sasha', id: dev[0].id, status:'done' }, SASHA).ok);
ok('a colleague cannot keep the training plan', env.saveTraining_({ staffId:'sasha', order:1, activity:'x' }, PAWAN).ok === false);
ok('the People Leader can', env.saveTraining_({ staffId:'sasha', order:1, activity:'AS400 / Ingenium', objective:'All screens', signedoff:'' }, KAMLA).ok);
env.resetRequestMemo_();
ok('and the person sees the row', env.hrBundle_(SASHA).me.training.length === 1);

console.log('\nWhat the bundle carries for a lead:\n');
env.resetRequestMemo_();
const kb = env.hrBundle_(KAMLA);
ok('her own goals, from her role', Array.isArray(kb.me.goals));
ok('her reports, with the latest review', kb.reports.length === 1 && kb.reports[0].staffId === 'sasha' && kb.reports[0].latest.status === 'signed');
ok('and the whole list of their reviews', Array.isArray(kb.reports[0].reviews) && kb.reports[0].reviews.length === 1);
const sb = env.hrBundle_(SASHA);
ok('a support desk has no reports', sb.reports.length === 0);
ok('and its own ten goals', sb.me.goals.length === 10);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
