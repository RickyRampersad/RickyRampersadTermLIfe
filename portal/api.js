/* ============================================================
   BRANCH PORTAL — API client
   Ricky Rampersad Branch · Chaguanas Regional Centre

   Talks to apps-script/branch-portal-api.gs.

   Until you paste the /exec URL into API.BASE below, the portal
   runs in DEMO MODE against a sample branch held in this file —
   so you can click through every screen, as a recruit and as a
   manager, before setting anything up. Demo data lives only in
   this browser tab and is thrown away on refresh.
   ============================================================ */
window.API = {

  /* Paste your Apps Script web app /exec URL here to go live. */
  BASE: '',

  get live() { return !!this.BASE; },

  async call(action, body) {
    if (!this.live) return DEMO.call(action, body);
    const res = await fetch(this.BASE, {
      method: 'POST',
      /* text/plain keeps this a simple request, so the browser never
         sends a preflight that Apps Script cannot answer. */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body })
    });
    if (!res.ok) throw new Error('The portal is not responding. Try again in a moment.');
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || 'Something went wrong.');
    return out;
  },

  login(email, pin)          { return this.call('login', { email, pin }); },
  recruitDashboard(token)    { return this.call('recruitDashboard', { token }); },
  managerDashboard(token)    { return this.call('managerDashboard', { token }); },
  recruitDetail(token, id)   { return this.call('recruitDetail', { token, recruitId: id }); },
  submitDebrief(token, p)    { return this.call('submitDebrief', { token, ...p }); },
  markSession(token, p)      { return this.call('markSession', { token, ...p }); },
  assignSession(token, p)    { return this.call('assignSession', { token, ...p }); },
  reviewSubmission(token, p) { return this.call('reviewSubmission', { token, ...p }); },
  setStage(token, p)         { return this.call('setStage', { token, ...p }); }
};

/* ============================================================
   DEMO BRANCH — three recruits at three different points, so
   every screen has something real-shaped to show.
   ============================================================ */
const DEMO = (() => {
  const day = 86400000;
  const ago = d => new Date(Date.now() - d * day).toISOString();

  const people = [
    { id:'m_bm',  role:'BM',      name:'Ricky Rampersad',  email:'bm@demo',      pin:'0000', managerId:'' },
    { id:'m_gary',role:'RM',      name:'Gary Sookdeo',     email:'rm@demo',      pin:'0000', managerId:'m_bm' },
    { id:'r_1',   role:'recruit', name:'Anisa Mohammed',   email:'recruit@demo', pin:'0000', managerId:'m_gary', phone:'868 777 5544' },
    { id:'r_2',   role:'recruit', name:'Kevon Ramlal',     email:'kevon@demo',   pin:'0000', managerId:'m_gary', phone:'868 333 4455' },
    { id:'r_3',   role:'recruit', name:'Shivani Persad',   email:'shivani@demo', pin:'0000', managerId:'m_gary', phone:'868 222 9911' }
  ];

  const recruits = {
    r_1: { ref:'RRB-K4M2XP', track:'inexperienced', stage:'discovery',
           stageEnteredAt:ago(23), startedAt:ago(41), rmName:'Gary Sookdeo', bmName:'Ricky Rampersad' },
    r_2: { ref:'RRB-29TUZ8', track:'experienced', stage:'pop7Review',
           stageEnteredAt:ago(4), startedAt:ago(12), rmName:'Gary Sookdeo', bmName:'Ricky Rampersad' },
    r_3: { ref:'RRB-7QW3RD', track:'inexperienced', stage:'selectionFile',
           stageEnteredAt:ago(9), startedAt:ago(68), rmName:'Gary Sookdeo', bmName:'Ricky Rampersad' }
  };

  /* Anisa is mid-Discovery: modules 1 and 2 done, module 3 running. */
  const progress = {
    r_1: [
      { moduleId:'m1', sessionId:'s1_1', assignedAt:ago(23), completedAt:ago(22), managerScore:3, managerNotes:'Engaged, asked good questions about the diary.' },
      { moduleId:'m1', sessionId:'s1_2', assignedAt:ago(22), completedAt:ago(20), managerScore:3, managerNotes:'Understood the evening/weekend reality without flinching.' },
      { moduleId:'m1', sessionId:'s1_3', assignedAt:ago(20), completedAt:ago(18), managerScore:2, managerNotes:'Self-assessment was generous to herself. Flagged.' },
      { moduleId:'m1', sessionId:'s1_4', assignedAt:ago(18), completedAt:ago(16), managerScore:3, managerNotes:'' },
      { moduleId:'m2', sessionId:'s2_1', assignedAt:ago(16), completedAt:ago(15), managerScore:3, managerNotes:'' },
      { moduleId:'m2', sessionId:'s2_2', assignedAt:ago(15), completedAt:ago(13), managerScore:4, managerNotes:'Strong grasp of centres of influence. Named eight without prompting.' },
      { moduleId:'m2', sessionId:'s2_3', assignedAt:ago(13), completedAt:ago(9),  managerScore:3, managerNotes:'Project 100 at 112 names.' },
      { moduleId:'m2', sessionId:'s2_4', assignedAt:ago(9),  completedAt:ago(7),  managerScore:3, managerNotes:'' },
      { moduleId:'m3', sessionId:'s3_1', assignedAt:ago(7),  completedAt:ago(5),  managerScore:3, managerNotes:'' },
      { moduleId:'m3', sessionId:'s3_2', assignedAt:ago(5),  completedAt:ago(2),  managerScore:2, managerNotes:'Telephone approach is stiff. Needs another rehearsal before live calls.' },
      { moduleId:'m3', sessionId:'s3_3', assignedAt:ago(2),  dueAt:ago(-5), completedAt:'', managerScore:null, managerNotes:'' }
    ],
    r_2: [], r_3: []
  };

  const submissions = {
    r_1: [
      { id:'sub_a', moduleId:'m3', sessionId:'s3_2', submittedAt:ago(2), selfConfidence:3,
        payload:{ q1:'12', q2:'2', q3:'A man I have known since school told me he was not interested before I finished the second sentence. I said sorry and hung up. I felt stupid for the rest of the evening.',
                  q4:'Stop apologising for calling. Ask the question I planned instead of trailing off.',
                  confidence:3, nextStep:'Twenty more calls before Friday, and I will write the opening line down first.' },
        managerScore:null, managerComments:'', released:false },
      { id:'sub_b', moduleId:'m2', sessionId:'s2_3', submittedAt:ago(9), selfConfidence:4,
        payload:{ q1:'112', q2:'My old head of department, my pastor, and the woman who runs the pharmacy by my mother. All three know I keep my word.',
                  q3:'Family friends. It feels like I am using the relationship.',
                  confidence:4, nextStep:'Get the list to 130 and sort it by who I would call first.' },
        managerScore:3, managerComments:'Good list. The discomfort about family friends is normal and we will work on it — it usually means you are thinking about them as a sale rather than a conversation.',
        released:true, reviewedBy:'Gary Sookdeo', reviewedAt:ago(8) }
    ],
    r_2: [], r_3: []
  };

  const scores = {
    r_1: [
      { key:'formA',  label:'Selection Form A', value:43, max:80, band:'Panel route if unchanged', updatedAt:ago(20) },
      { key:'pop7',   label:'POP 7.0 probability', value:'62%', max:'', band:'Above average', updatedAt:ago(26) },
      { key:'session',label:'Discovery session average', value:'2.9', max:'4', band:'Acceptable — trending up', updatedAt:ago(2) }
    ],
    r_2: [ { key:'pop7', label:'POP 7.0 probability', value:'78%', max:'', band:'Above average', updatedAt:ago(3) } ],
    r_3: [ { key:'formA', label:'Selection Form A', value:61, max:80, band:'BM recommendation (60–80)', updatedAt:ago(10) } ]
  };

  const events = {
    r_1: [
      { at:ago(41), actor:'Branch careers site', type:'intake',   detail:'Branch intake RRB-K4M2XP submitted' },
      { at:ago(39), actor:'Gary Sookdeo',        type:'stage',    detail:'moved to firstInterview' },
      { at:ago(35), actor:'Gary Sookdeo',        type:'stage',    detail:'moved to bmApproval' },
      { at:ago(30), actor:'Ricky Rampersad',     type:'decision', detail:'POP 7.0 authorised' },
      { at:ago(26), actor:'Gary Sookdeo',        type:'score',    detail:'pop7 = 62%' },
      { at:ago(23), actor:'Gary Sookdeo',        type:'stage',    detail:'moved to discovery' },
      { at:ago(9),  actor:'Anisa Mohammed',      type:'debrief',  detail:'s2_3 submitted' },
      { at:ago(2),  actor:'Anisa Mohammed',      type:'debrief',  detail:'s3_2 submitted' }
    ],
    r_2: [
      { at:ago(12), actor:'Branch careers site', type:'intake', detail:'Branch intake RRB-29TUZ8 submitted' },
      { at:ago(9),  actor:'Gary Sookdeo',        type:'stage',  detail:'moved to firstInterview' },
      { at:ago(4),  actor:'Gary Sookdeo',        type:'stage',  detail:'moved to pop7Review' }
    ],
    r_3: [
      { at:ago(68), actor:'Walk-in',         type:'intake', detail:'Referred by Kerwyn Ramroach' },
      { at:ago(20), actor:'Gary Sookdeo',    type:'stage',  detail:'Discovery complete' },
      { at:ago(9),  actor:'Kamla',           type:'stage',  detail:'moved to selectionFile' }
    ]
  };

  let session = null;
  const daysSince = d => d ? Math.max(0, Math.floor((Date.now() - new Date(d)) / day)) : null;

  function payloadFor(id, asManager) {
    const p = people.find(x => x.id === id);
    const r = recruits[id];
    return {
      person: { id, name: p.name, email: p.email, phone: p.phone },
      recruit: { ...r, daysSinceStart: daysSince(r.startedAt), daysInStage: daysSince(r.stageEnteredAt) },
      progress: (progress[id] || []).map(x => ({ ...x, checkpointsDone: x.checkpointsDone || [] })),
      submissions: (submissions[id] || []).map(s => asManager ? s : ({
        id: s.id, moduleId: s.moduleId, sessionId: s.sessionId, submittedAt: s.submittedAt,
        selfConfidence: s.selfConfidence,
        managerScore: s.released ? s.managerScore : null,
        managerComments: s.released ? s.managerComments : '',
        reviewed: s.released
      })),
      scores: scores[id] || [],
      timeline: events[id] || []
    };
  }

  return {
    async call(action, body) {
      await new Promise(r => setTimeout(r, 180));   /* so loading states are visible */
      switch (action) {
        case 'login': {
          const email = String(body.email || '').trim().toLowerCase();
          const p = people.find(x => x.email === email);
          if (!p) throw new Error('In demo mode, sign in as recruit@demo or rm@demo (any PIN).');
          session = p;
          return { ok: true, token: 'demo', person: { id: p.id, name: p.name, role: p.role, email: p.email } };
        }
        case 'recruitDashboard': return { ok: true, data: payloadFor(session.id, false) };
        case 'managerDashboard': {
          const rows = Object.keys(recruits).map(id => {
            const p = people.find(x => x.id === id), r = recruits[id];
            const sess = progress[id] || [];
            return {
              id, name: p.name, email: p.email, phone: p.phone, ref: r.ref, track: r.track,
              stage: r.stage, daysInStage: daysSince(r.stageEnteredAt), daysSinceStart: daysSince(r.startedAt),
              sessionsDone: sess.filter(s => s.completedAt).length, sessionsTotal: 21,
              awaitingReview: (submissions[id] || []).filter(s => !s.released).length,
              overdue: sess.filter(s => !s.completedAt && s.dueAt && new Date(s.dueAt) < new Date()).length,
              rmName: r.rmName
            };
          });
          return { ok: true, data: { me: { id: session.id, name: session.name, role: session.role }, recruits: rows } };
        }
        case 'recruitDetail': return { ok: true, data: payloadFor(body.recruitId, true) };
        case 'submitDebrief': {
          (submissions[session.id] = submissions[session.id] || []).unshift({
            id: 'sub_' + Date.now(), moduleId: body.moduleId, sessionId: body.sessionId,
            submittedAt: new Date().toISOString(), selfConfidence: body.selfConfidence,
            payload: body.answers, managerScore: null, managerComments: '', released: false
          });
          const row = (progress[session.id] || []).find(p => p.sessionId === body.sessionId);
          if (row) row.checkpointsDone = body.checkpointsDone || [];
          (events[session.id] = events[session.id] || []).push({
            at: new Date().toISOString(), actor: session.name, type: 'debrief', detail: body.sessionId + ' submitted' });
          return { ok: true };
        }
        case 'markSession': {
          const list = progress[body.recruitId] = progress[body.recruitId] || [];
          let row = list.find(p => p.sessionId === body.sessionId);
          if (!row) { row = { moduleId: body.moduleId, sessionId: body.sessionId, assignedAt: new Date().toISOString() }; list.push(row); }
          row.completedAt = body.completed ? new Date().toISOString() : '';
          row.managerScore = body.managerScore;
          row.managerNotes = body.managerNotes || '';
          row.checkpointsDone = body.checkpointsDone || row.checkpointsDone || [];
          return { ok: true };
        }
        case 'assignSession': {
          const list = progress[body.recruitId] = progress[body.recruitId] || [];
          let row = list.find(p => p.sessionId === body.sessionId);
          if (!row) { row = { moduleId: body.moduleId, sessionId: body.sessionId }; list.push(row); }
          row.assignedAt = new Date().toISOString();
          row.dueAt = body.dueAt || '';
          return { ok: true };
        }
        case 'reviewSubmission': {
          for (const id of Object.keys(submissions)) {
            const s = (submissions[id] || []).find(x => x.id === body.submissionId);
            if (s) {
              s.managerScore = body.managerScore;
              s.managerComments = body.managerComments || '';
              s.released = !!body.release;
              s.reviewedBy = session.name;
              s.reviewedAt = new Date().toISOString();
            }
          }
          return { ok: true };
        }
        case 'setStage': {
          recruits[body.recruitId].stage = body.stage;
          recruits[body.recruitId].stageEnteredAt = new Date().toISOString();
          (events[body.recruitId] = events[body.recruitId] || []).push({
            at: new Date().toISOString(), actor: session.name, type: 'stage', detail: 'moved to ' + body.stage });
          return { ok: true };
        }
      }
      throw new Error('Not available in demo mode.');
    }
  };
})();
