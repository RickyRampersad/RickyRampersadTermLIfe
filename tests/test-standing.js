// Your quarter: the appraisal, written as you go.
//
// The form asks what was delivered against each weighted goal and how each
// competency showed. This proves the tracker answers both from what it
// already holds — the blocks and whether they landed, what Salesforce
// closed, the days in and not, the value-added and innovation lines, the
// training given and received — and that a moment the record cannot see can
// be noted by the person or their People Leader, against a competency on
// the form and nobody else's.
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

// A day of Sasha's: blocks as {KPI1:{kpi, plan, met, actioned}, …}, plus the
// day-level lines.
const day = (date, blocks, valueAdded, innovation) => {
  const r = new Array(LOGH.length).fill('');
  const set = (h, v) => { r[LOGH.indexOf(h)] = v; };
  set('Date', date); set('StaffId', 'sasha'); set('Name', 'Sasha Lalla');
  Object.keys(blocks).forEach(b => { const x = blocks[b];
    set(b, x.kpi); set(b + '_Plan', x.plan); set(b + '_Met', x.met); set(b + '_Actioned', x.actioned); });
  set('ValueAdded', valueAdded || ''); set('Innovation', innovation || '');
  return r;
};

const GOALS = [
  ['ssa',1,'New Applications & Increase Applications Processing','','Increasing',15,0.9,'New Application Process, Pendings'],
  ['ssa',4,'Premium Dues / Lapse Management','','Increasing',15,0.95,'Renewa/PDl/Bill, Pendings'],
  ['ssa',10,'Reporting','','Increasing',10,0.95,'Reporting'],
];
const COMPS = ['Courtesy & Interpersonal Skills','Customer Service','Growth','Innovation',
               'Positive Energy','Quality','Reliability','Responsiveness']
  .map((c, i) => [i + 1, c, 'definition of ' + c, 'one · two · three']);

// The clock: Wednesday 19 August 2026, seven weeks into the third quarter.
const env = makeEnv();
let NOW = new Date('2026-08-19T11:00:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Azariah Gomes','azariah','az@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Kamla Dookran','kamla','kamla@example.com','1',"Branch Manager's Assistant",'Branch','Yes'],
   ['Pawan Probhu','pawan','pawan@example.com','1','Personal Assistant','Branch','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
env.__mkSheet('KPI Log', 2, LOGH, [
  day('2026-06-30', { KPI1: { kpi:'Renewa/PDl/Bill', plan:90, met:'met', actioned:'Last quarter — must not count' } }),
  day('2026-08-18', { KPI1: { kpi:'Renewa/PDl/Bill', plan:90, met:'met', actioned:'Premium dues — 14 processed, 2 back to the advisor' } },
      'Walked a client through the reinstatement forms by phone', 'Built a macro for the dues list'),
  day('2026-08-19', { KPI1: { kpi:'Renewa/PDl/Bill', plan:60, met:'no', actioned:'Dues — server down all morning' },
                      KPI2: { kpi:'Reporting', plan:60, met:'met', actioned:'Weekly report sent' } }),
]);
env.__mkSheet('KPI Training', 3, TRH, [
  ['2026-08-12','kamla','Kamla Dookran','PM1','Sasha','AS400 screens','','','','','',''],
  ['2026-08-13','sasha','Sasha Lalla','PM2','Azariah','The dues list','','','','','',''],
  ['2026-06-12','kamla','Kamla Dookran','PM1','Sasha','Last quarter — must not count','','','','','',''],
]);
env.__mkSheet('Goals', 4, ['Role','Order','Goal','Description','TargetType','Weight','Target','KpiTypes'], GOALS);
env.__mkSheet('Competencies', 5, ['Order','Competency','Definition','Behaviours'], COMPS);
env.__mkSheet('Attendance', 6, env.ATT.head, [
  ['2026-08-19','sasha','Sasha Lalla','08:04','08:04','in','','sasha',''],
  ['2026-08-18','sasha','Sasha Lalla','08:31','09:00','in','','sasha',''],
  ['2026-08-17','sasha','Sasha Lalla','','','absent','sick','sasha',''],
]);
env.__mkSheet('Development', 7, env.HR.DEVELOP.head, [
  ['d1','sasha','','Social','Fortnightly coaching','the gap','one group application alone','done',''],
  ['d2','sasha','','Experiential','Run the dues list alone','the gap','four clean weeks','planned',''],
]);
env.sfkClosedInPeriodSafe_ = (sid, from, to) => sid === 'sasha' ? { 'Renewa/PDl/Bill': 40, Servicing: 3, Reporting: 5 } : {};
env.sfkMetricsSafe_ = () => ({ ok:true, staff: { sasha: { open:9, needs:2, overdue:1, byType: { 'Renewa/PDl/Bill': { open:5, needs:2, overdue:1 } } } } });
env.sfkNeedsReasonSafe_ = () => ({ sasha: [{ id:'00T1' }] });
env.sfkBillingCheckSafe_ = () => ({ sasha: { items: [] } });
env.sfkOpenBookSafe_ = () => ({});

const SASHA = { staffId:'sasha', name:'Sasha Lalla', role:'ssa', manager:false };
const KAMLA = { staffId:'kamla', name:'Kamla Dookran', role:'bma', manager:false };
const PAWAN = { staffId:'pawan', name:'Pawan Probhu', role:'pa', manager:false };
const RICKY = { staffId:'ricky', name:'Ricky Rampersad', role:'bm', manager:true };

console.log('\nThe quarter so far:\n');
ok('today is 19 August, in the third quarter', env.todayISO_() === '2026-08-19' && env.quarterOf_(env.todayISO_()) === '2026-Q3', env.todayISO_());
ok('working days in: 36', env.workdays_('2026-07-01', '2026-08-20') === 36, String(env.workdays_('2026-07-01', '2026-08-20')));
ok('working days left: 30', env.workdays_('2026-08-20', '2026-10-01') === 30, String(env.workdays_('2026-08-20', '2026-10-01')));

console.log('\nA moment the record cannot see:\n');
ok('needs a competency on the form', /competencies on the form/.test(env.noteMoment_({ competency:'Bravery', what:'Faced down a very long queue' }, SASHA).error || ''));
ok('and a line, not a word', /a line/.test(env.noteMoment_({ competency:'Customer Service', what:'Great' }, SASHA).error || ''));
ok('a colleague cannot note one for somebody else', env.noteMoment_({ staffId:'sasha', competency:'Customer Service', what:'Was very nice to everyone' }, PAWAN).ok === false);
const m1 = env.noteMoment_({ competency:'Customer Service', what:'Calmed a client who had been told three different things' }, SASHA);
ok('the person can', m1.ok && m1.by === 'sasha' && m1.date === '2026-08-19', JSON.stringify(m1));
const m2 = env.noteMoment_({ staffId:'sasha', competency:'Customer Service', what:'Stayed past five for a widow with the claim forms', date:'2026-08-14' }, KAMLA);
ok('and so can their People Leader, dated', m2.ok && m2.by === 'kamla' && m2.date === '2026-08-14', JSON.stringify(m2));
env.resetRequestMemo_();

console.log('\nWhere Sasha stands:\n');
ok('not for a colleague to see', env.standing_(PAWAN, 'sasha').ok === false);
const st = env.standing_(SASHA, 'sasha');
ok('the quarter, the days in and left', st.ok && st.quarter === '2026-Q3' && st.from === '2026-07-01' && st.to === '2026-08-20' && st.daysIn === 36 && st.daysLeft === 30, JSON.stringify([st.quarter, st.from, st.to, st.daysIn, st.daysLeft]));
ok('every goal on the form for the role', st.goals.length === 3 && st.setup.goals && st.setup.competencies);
const dues = st.goals.find(g => /Premium Dues/.test(g.goal)), rep = st.goals.find(g => g.goal === 'Reporting');
ok('premium dues: two blocks this quarter, not three', dues.evidence.blocks === 2 && dues.evidence.met.met === 1 && dues.evidence.met.no === 1, JSON.stringify(dues.evidence));
ok('landed one of two: 50% against 95%', dues.landed === 0.5 && dues.target === 0.95);
ok('closed in Salesforce, by the goal\'s task types', dues.evidence.closed === 40);
ok('open, untouched, late — now', dues.evidence.open === 5 && dues.evidence.needs === 2 && dues.evidence.late === 1);
ok('with a line of what was actioned', dues.evidence.lines.length === 2 && /14 processed/.test(dues.evidence.lines[0].text));
ok('reporting: one block, landed', rep.evidence.blocks === 1 && rep.landed === 1 && rep.evidence.closed === 5);
ok('a goal with no blocks has no landed rate', st.goals.find(g => /New Applications/.test(g.goal)).landed === null);

console.log('\nWhat the record says about each competency:\n');
const comp = n => st.competencies.find(c => c.competency === n);
const sig = (n, label) => { const x = (comp(n).signals || []).find(s => s.label === label); return x ? String(x.value) + (x.tone ? '/' + x.tone : '') : '(none)'; };
ok('reliability reads the register: days in, not in, after the start', sig('Reliability', 'Days in') === '2' && sig('Reliability', 'Not in') === '1/amber' && sig('Reliability', 'After your start') === '1/amber', JSON.stringify(comp('Reliability').signals));
ok('and the blocks against the days in', sig('Reliability', 'Blocks submitted') === '3 of 8/amber');
ok('responsiveness reads untouched, late, no reason', sig('Responsiveness', 'Untouched 7+ days') === '2/amber' && sig('Responsiveness', 'Late') === '1/amber' && sig('Responsiveness', 'Late with no reason') === '1/amber', JSON.stringify(comp('Responsiveness').signals));
ok('and what closed', sig('Responsiveness', 'Closed this quarter') === '48');
ok('quality reads landed and the billing flags', sig('Quality', 'Blocks landed') === '67%/amber' && sig('Quality', 'Billing flags') === '0/green', JSON.stringify(comp('Quality').signals));
ok('customer service reads value added and servicing', sig('Customer Service', 'Value-added lines') === '1' && sig('Customer Service', 'Servicing closed') === '3', JSON.stringify(comp('Customer Service').signals));
ok('with the value-added line itself', comp('Customer Service').lines.length === 1 && /reinstatement forms/.test(comp('Customer Service').lines[0].text));
ok('and both moments, newest first', comp('Customer Service').moments.length === 2 && comp('Customer Service').moments[0].by === 'sasha' && comp('Customer Service').moments[1].by === 'kamla', JSON.stringify(comp('Customer Service').moments));
ok('growth reads training received and actions done', sig('Growth', 'Training received') === '1' && sig('Growth', 'Development actions done') === '1 of 2/amber', JSON.stringify(comp('Growth').signals));
ok('innovation reads the innovation line', sig('Innovation', 'Innovation lines') === '1/green' && /macro/.test(comp('Innovation').lines[0].text));
ok('courtesy reads training given', sig('Courtesy & Interpersonal Skills', 'Training given') === '1');
ok('positive energy has the same, and no moments yet', sig('Positive Energy', 'Training given') === '1' && comp('Positive Energy').moments.length === 0);
ok('last quarter\'s training did not count', sig('Growth', 'Training received') === '1');

console.log('\nWho sees it:\n');
env.resetRequestMemo_();
const byLead = env.standing_(KAMLA, 'sasha');
ok('the People Leader sees it, on the other side', byLead.ok && byLead.side === 'pl' && byLead.goals.length === 3);
env.resetRequestMemo_();
ok('the Branch Manager too', env.standing_(RICKY, 'sasha').ok);
env.resetRequestMemo_();
const own = env.standing_(PAWAN, 'pawan');
ok('somebody with no goals on file gets a plain answer, not an error', own.ok && own.goals.length === 0 && own.setup.goals === true, JSON.stringify(own.setup));

console.log('\nThe review carries the same, for its period:\n');
env.resetRequestMemo_();
const opened = env.openReview_({ staffId:'sasha', type:'Quarterly', from:'2026-07-01', to:'2026-10-01' }, KAMLA);
ok('a review opened for the quarter', opened.ok, JSON.stringify(opened));
env.resetRequestMemo_();
const rv = opened.ok ? env.review_(KAMLA, opened.id) : { ok:false };
const rc = rv.ok ? rv.competencies.find(c => c.competency === 'Customer Service') : null;
ok('its competencies carry the moments in the period', !!rc && rc.moments.length === 2, rv.ok ? JSON.stringify(rc && rc.moments) : JSON.stringify(rv));
ok('and what the record says', !!rc && rc.signals.some(s => s.label === 'Value-added lines' && String(s.value) === '1'));
const rr = rv.ok ? rv.competencies.find(c => c.competency === 'Reliability') : null;
ok('reliability reads the register for the review period too', !!rr && rr.signals.some(s => s.label === 'Days in' && String(s.value) === '2'));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
