/* The product is for SEA and nothing else. This walks every page as a student,
   a parent and a teacher and fails on any visible trace of the secondary ladder:
   CSEC, CXC, the SBA, a Form, lower or upper secondary. "Secondary school" on its
   own is allowed, because SEA is the examination that places a child into one,
   and "Secondary Entrance Assessment" is the examination's name. It reads what a
   person reads — the rendered text, the title, the description — never the
   script, where CSEC.esc and window.CSEC_GUIDES are code names, not copy. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const B='http://127.0.0.1:8899/csec/';
const errs=[]; let pass=0;
const step=async(n,f)=>{try{await f();console.log('✓ '+n);pass++;}catch(e){console.log('✗ '+n+' — '+e.message);errs.push(n+': '+e.message);}};

const LEAK=/\bCSEC\b|\bCXC\b|\bSBA\b|\bForms? [1-5]\b|\bForm [1-5]\b|lower secondary|upper secondary|\bO'?Levels?\b/i;

const visible=async(pg)=>pg.evaluate(()=>({
  title:document.title,
  desc:(document.querySelector('meta[name=description]')||{}).content||'',
  og:(document.querySelector('meta[property="og:description"]')||{}).content||'',
  text:document.body.innerText
}));

const leaks=(v)=>{
  const out=[];
  [['title',v.title],['description',v.desc],['og:description',v.og]].forEach(([k,s])=>{ const m=s.match(LEAK); if(m) out.push(k+': "'+m[0]+'"'); });
  const lines=v.text.split('\n').map(l=>l.trim()).filter(Boolean);
  lines.forEach(l=>{ const m=l.match(LEAK); if(m) out.push('"'+l.slice(0,90)+'"'); });
  return out;
};

const fresh=async(pg)=>{ await pg.goto(B+'index.html',{waitUntil:'networkidle'}); await pg.evaluate(()=>{try{localStorage.clear();}catch(e){}}); };
const asStudent=async(pg)=>{
  await fresh(pg); await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
  await pg.click('[data-role="student"]'); await pg.click('#si-new'); await pg.fill('#c-name','Student');
  await pg.click('#c-form-primary button[data-f="5"]'); await pg.click('#c-go'); await pg.waitForURL('**/student.html',{timeout:10000});
};
const asRole=async(pg,role)=>{
  await fresh(pg); await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
  await pg.click('[data-role="'+role+'"]'); await pg.click('#si-new'); await pg.fill('#c-name',role==='parent'?'Parent':'Teacher');
  await pg.click('#c-go'); await pg.waitForURL('**/'+role+'.html',{timeout:10000});
};

(async()=>{
  const br=await chromium.launch();
  const c=await br.newContext({viewport:{width:1280,height:1000}});
  await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await c.newPage();
  const pageErrs=[];
  pg.on('pageerror',e=>pageErrs.push(e.message));
  pg.on('console',m=>{const t=m.text(); if(m.type()==='error'&&!/ERR_FAILED|ERR_CONNECTION_REFUSED|favicon/.test(t))pageErrs.push('CONSOLE: '+t);});

  await step('the data itself carries nothing secondary',async()=>{
    await pg.goto(B+'guides.html',{waitUntil:'networkidle'});
    const r=await pg.evaluate(()=>{
      const C=CSEC.curriculum;
      return {
        scope:window.CSEC_SCOPE,
        subj:Object.keys(C.subjects).filter(k=>!/^p-/.test(k)),
        levels:(C.levels||[]).map(l=>l.n),
        stages:(C.stages||[]).map(s=>s.key),
        road:(C.roadmap||[]).filter(r=>r.level>5).length,
        q:CSEC.questions.filter(q=>!/^p-/.test(q.subj)).length,
        g:(window.CSEC_GUIDES||[]).filter(g=>!/^p-/.test(g.subj)).length,
        exam:(CSEC.nextExam(3)||{}).exam
      };
    });
    if(r.scope!=='sea') throw new Error('scope is '+r.scope);
    if(r.subj.length) throw new Error('secondary subjects: '+r.subj.join(','));
    if(r.levels.join(',')!=='1,2,3,4,5') throw new Error('levels: '+r.levels.join(','));
    if(r.stages.join(',')!=='primary') throw new Error('stages: '+r.stages.join(','));
    if(r.road||r.q||r.g) throw new Error('secondary roadmap '+r.road+', questions '+r.q+', guides '+r.g);
    if(r.exam!=='SEA') throw new Error('next exam for a Standard 3 is '+r.exam);
    console.log('   scope sea · 5 levels · 1 stage · '+r.q+' secondary questions · next exam SEA');
  });

  await step('the front door offers primary years only',async()=>{
    await fresh(pg); await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.click('[data-role="student"]'); await pg.click('#si-new');
    const sec=await pg.locator('#c-form, [data-f="6"], [data-f="7"], [data-f="8"], [data-f="9"], [data-f="10"]').count();
    if(sec) throw new Error(sec+' secondary year control(s) still on the create form');
    const prim=await pg.locator('#c-form-primary button').count();
    if(prim!==5) throw new Error(prim+' primary buttons');
  });

  /* every page a visitor or a student reaches */
  const STUDENT_PAGES=['index.html','index.html?signin','start.html','flyer.html','journey.html','guides.html',
                       'planner.html','papers.html','kpi.html','student.html','practice.html','test.html','sea.html','settings.html'];
  await asStudent(pg);
  for(const p of STUDENT_PAGES){
    await step('no secondary trace on '+p+' (student)',async()=>{
      pageErrs.length=0;
      await pg.goto(B+p,{waitUntil:'networkidle'}); await pg.waitForTimeout(150);
      const v=await visible(pg); const l=leaks(v);
      if(!/SEA/.test(v.title)) l.unshift('title does not say SEA: "'+v.title+'"');
      if(pageErrs.length) l.unshift('page error: '+pageErrs[0].slice(0,120));
      if(l.length) throw new Error(l.length+' — '+l.slice(0,3).join(' | '));
    });
  }

  await asRole(pg,'parent');
  for(const p of ['parent.html','journey.html','guides.html','planner.html','papers.html','kpi.html','sea.html','settings.html']){
    await step('no secondary trace on '+p+' (parent)',async()=>{
      pageErrs.length=0;
      await pg.goto(B+p,{waitUntil:'networkidle'}); await pg.waitForTimeout(150);
      const v=await visible(pg); const l=leaks(v);
      if(pageErrs.length) l.unshift('page error: '+pageErrs[0].slice(0,120));
      if(l.length) throw new Error(l.length+' — '+l.slice(0,3).join(' | '));
    });
  }

  await asRole(pg,'teacher');
  for(const p of ['teacher.html','journey.html','guides.html','planner.html','papers.html','kpi.html','settings.html']){
    await step('no secondary trace on '+p+' (teacher)',async()=>{
      pageErrs.length=0;
      await pg.goto(B+p,{waitUntil:'networkidle'}); await pg.waitForTimeout(150);
      const v=await visible(pg); const l=leaks(v);
      if(pageErrs.length) l.unshift('page error: '+pageErrs[0].slice(0,120));
      if(l.length) throw new Error(l.length+' — '+l.slice(0,3).join(' | '));
    });
  }

  await step('the branch homepage tile is for SEA',async()=>{
    await pg.goto('http://127.0.0.1:8899/index.html',{waitUntil:'networkidle'});
    const t=await pg.evaluate(()=>{ const a=document.querySelector('a[href="csec/start.html"]'); return a?a.innerText:''; });
    if(!t) throw new Error('no tile links to csec/start.html');
    const m=t.match(LEAK); if(m) throw new Error('tile says "'+m[0]+'": '+t.slice(0,100));
    if(!/SEA/.test(t)) throw new Error('tile does not say SEA');
  });

  await br.close();
  console.log('\n================ RESULT ================');
  if(errs.length){ console.log('FAILURES ('+errs.length+'):'); errs.forEach(e=>console.log('  • '+e)); process.exit(1); }
  console.log('ALL '+pass+' SCOPE CHECKS PASSED — no console errors, no page errors.');
})();
