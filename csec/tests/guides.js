/* The guide library is level-scoped: a child sitting SEA must be shown SEA
   methods and nothing from the secondary ladder. Before this, guides.html
   listed all of them, so a Standard 5 was offered the CSEC argumentative
   essay and the literature paragraph — which is what "want SEA only" meant. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const B='http://127.0.0.1:8899/csec/';
const errs=[]; let pass=0;
const step=async(n,f)=>{try{await f();console.log('✓ '+n);pass++;}catch(e){console.log('✗ '+n+' — '+e.message);errs.push(n+': '+e.message);}};

const signIn=async(pg,tab,lvl)=>{
  await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
  await pg.evaluate(()=>{try{localStorage.clear();}catch(e){}});
  await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
  await pg.click('[data-role="student"]'); await pg.click('#si-new');
  await pg.fill('#c-name','Student');
  await pg.click(tab+' button[data-f="'+lvl+'"]');
  await pg.click('#c-go'); await pg.waitForURL('**/student.html',{timeout:10000});
};

(async()=>{
  const br=await chromium.launch();
  const c=await br.newContext({viewport:{width:1280,height:1100}});
  await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await c.newPage();
  pg.on('console',m=>{const t=m.text(); if(m.type()==='error'&&!/ERR_FAILED|ERR_CONNECTION_REFUSED/.test(t))errs.push('CONSOLE: '+t);});
  pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));

  /* ---------- the data itself ---------- */

  await step('every guide is well formed',async()=>{
    await pg.goto(B+'guides.html',{waitUntil:'networkidle'});
    const bad=await pg.evaluate(()=>{
      const out=[];
      (window.CSEC_GUIDES||[]).forEach(g=>{
        const miss=['id','subj','strand','level','title','when','steps','worked','pitfalls']
          .filter(k=>g[k]===undefined||g[k]===null||g[k]==='');
        if(miss.length) out.push(g.id+' missing '+miss.join(','));
        if(!Array.isArray(g.steps)||g.steps.length<3) out.push(g.id+' too few steps');
        if(!g.worked||!g.worked.problem||!(g.worked.lines||[]).length) out.push(g.id+' no worked example');
        if(!Array.isArray(g.pitfalls)||g.pitfalls.length<2) out.push(g.id+' too few pitfalls');
        (g.steps||[]).forEach((s,i)=>{ if(!s.do||!s.note) out.push(g.id+' step '+(i+1)+' incomplete'); });
      });
      return out;
    });
    if(bad.length) throw new Error(bad.slice(0,4).join(' | '));
  });

  await step('no two guides share an id',async()=>{
    const dup=await pg.evaluate(()=>{
      const seen={},d=[];
      (window.CSEC_GUIDES||[]).forEach(g=>{ if(seen[g.id]) d.push(g.id); seen[g.id]=1; });
      return d;
    });
    if(dup.length) throw new Error('duplicate ids: '+dup.join(','));
  });

  await step('every guide sits on a strand its subject really has',async()=>{
    const orphan=await pg.evaluate(()=>{
      const C=CSEC.curriculum, out=[];
      (window.CSEC_GUIDES||[]).forEach(g=>{
        const s=C.subjects[g.subj];
        if(!s) return out.push(g.id+' unknown subject '+g.subj);
        if(!s.strands.some(t=>t.id===g.strand)) out.push(g.id+' strand '+g.strand+' not in '+g.subj);
      });
      return out;
    });
    if(orphan.length) throw new Error(orphan.join(' | '));
  });

  await step('a guide is never pitched above the level its strand is taught at',async()=>{
    const early=await pg.evaluate(()=>{
      const C=CSEC.curriculum, out=[];
      (window.CSEC_GUIDES||[]).forEach(g=>{
        const s=C.subjects[g.subj]; if(!s) return;
        const t=s.strands.filter(x=>x.id===g.strand)[0]; if(!t||!t.levels) return;
        if(!t.levels.some(l=>l<=g.level)) out.push(g.id+' at level '+g.level+' but strand taught '+t.levels.join('/'));
      });
      return out;
    });
    if(early.length) throw new Error(early.join(' | '));
  });

  /* ---------- the SEA writing module ---------- */

  await step('no SEA guide is written above Standard 5',async()=>{
    const over=await pg.evaluate(()=>(window.CSEC_GUIDES||[])
      .filter(g=>/^p-/.test(g.subj)&&g.level>5).map(g=>g.id+'@L'+g.level));
    if(over.length) throw new Error('primary guides pitched at secondary levels: '+over.join(','));
  });

  await step('no SEA guide mentions a secondary examination',async()=>{
    const slip=await pg.evaluate(()=>{
      const out=[];
      (window.CSEC_GUIDES||[]).filter(g=>/^p-/.test(g.subj)).forEach(g=>{
        const t=JSON.stringify(g);
        if(/CSEC|CXC|Form [1-5]|O'?Level/i.test(t)) out.push(g.id);
      });
      return out;
    });
    if(slip.length) throw new Error('secondary exam named in: '+slip.join(','));
  });

  /* ---------- what each child is actually shown ---------- */

  await step('a Standard 5 is shown SEA methods only',async()=>{
    await signIn(pg,'#c-form-primary',5);
    await pg.goto(B+'guides.html',{waitUntil:'networkidle'});
    const r=await pg.evaluate(()=>{
      const shown=[...document.querySelectorAll('#list details')].map(d=>d.id.replace(/^g-/,''));
      const by={}; (window.CSEC_GUIDES||[]).forEach(g=>by[g.id]=g);
      return {n:shown.length, over:shown.filter(id=>by[id]&&by[id].level>5)};
    });
    if(!r.n) throw new Error('no guides listed at all');
    if(r.over.length) throw new Error('a Standard 5 was shown '+r.over.join(',')+' — beyond SEA');
    console.log('   '+r.n+' methods listed, none above Standard 5');
  });

  await step('the subject filter offers a Standard 5 no secondary subject',async()=>{
    const opts=await pg.evaluate(()=>[...document.querySelectorAll('#filt option')].map(o=>o.value));
    const sec=opts.filter(v=>v!=='all'&&!/^p-/.test(v));
    if(sec.length) throw new Error('secondary subjects in the filter: '+sec.join(','));
    const head=await pg.locator('#filt option').first().textContent();
    const n=(head.match(/(\d+)/)||[])[1];
    const shown=await pg.evaluate(()=>document.querySelectorAll('#list details').length);
    if(Number(n)!==shown) throw new Error('header says '+n+' methods, list shows '+shown);
    console.log('   '+head.trim());
  });

  await step('a Form 3 still gets the CSEC methods',async()=>{
    await signIn(pg,'#c-form',8);   /* Form 3 is level 8 on the ten-rung ladder */
    await pg.goto(B+'guides.html',{waitUntil:'networkidle'});
    const r=await pg.evaluate(()=>{
      const shown=[...document.querySelectorAll('#list details')].map(d=>d.id.replace(/^g-/,''));
      const by={}; (window.CSEC_GUIDES||[]).forEach(g=>by[g.id]=g);
      return {n:shown.length, sec:shown.filter(id=>by[id]&&!/^p-/.test(by[id].subj)).length};
    });
    if(!r.sec) throw new Error('a Form 3 was shown no secondary methods');
    console.log('   '+r.n+' methods listed, '+r.sec+' of them secondary');
  });

  await step('a teacher keeps the whole ladder',async()=>{
    await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.evaluate(()=>{try{localStorage.clear();}catch(e){}});
    await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.click('[data-role="teacher"]'); await pg.click('#si-new');
    await pg.fill('#c-name','Teacher'); await pg.click('#c-go');
    await pg.waitForURL('**/teacher.html',{timeout:10000});
    await pg.goto(B+'guides.html',{waitUntil:'networkidle'});
    const r=await pg.evaluate(()=>({
      shown:document.querySelectorAll('#list details').length,
      total:(window.CSEC_GUIDES||[]).length
    }));
    if(r.shown!==r.total) throw new Error('teacher sees '+r.shown+' of '+r.total);
    console.log('   all '+r.total+' methods');
  });

  await step('a signed-out visitor sees the whole library',async()=>{
    await pg.evaluate(()=>{try{localStorage.clear();}catch(e){}});
    await pg.goto(B+'guides.html',{waitUntil:'networkidle'});
    const r=await pg.evaluate(()=>({
      shown:document.querySelectorAll('#list details').length,
      total:(window.CSEC_GUIDES||[]).length
    }));
    if(r.shown!==r.total) throw new Error('visitor sees '+r.shown+' of '+r.total);
  });

  await step('a writing guide sends the child to the real papers, not to multiple choice',async()=>{
    await signIn(pg,'#c-form-primary',5);
    await pg.goto(B+'guides.html?strand=pw-narrative',{waitUntil:'networkidle'});
    const hrefs=await pg.evaluate(()=>{
      const by={}; (window.CSEC_GUIDES||[]).forEach(g=>by[g.id]=g);
      const out={write:[],other:[]};
      [...document.querySelectorAll('#list details')].forEach(d=>{
        const g=by[d.id.replace(/^g-/,'')]; if(!g) return;
        const a=d.querySelector('a.btn.sm'); if(!a) return;
        (g.subj==='p-ela-writing'?out.write:out.other).push(a.getAttribute('href'));
      });
      return out;
    });
    if(!hrefs.write.length) throw new Error('no writing guides on the page');
    const wrong=hrefs.write.filter(h=>!/^sea\.html/.test(h));
    if(wrong.length) throw new Error('writing guide points at '+wrong[0]);
    const alsoWrong=hrefs.other.filter(h=>!/^practice\.html/.test(h));
    if(alsoWrong.length) throw new Error('non-writing guide points at '+alsoWrong[0]);
    console.log('   '+hrefs.write.length+' writing \u2192 papers, '+hrefs.other.length+' others \u2192 question bank');
  });

  await step('that link really opens the writing papers',async()=>{
    await pg.goto(B+'sea.html?s=p-ela-writing',{waitUntil:'networkidle'});
    const on=await pg.locator('#tabs button.on').getAttribute('data-s');
    if(on!=='p-ela-writing') throw new Error('landed on '+on);
    const n=await pg.evaluate(()=>document.querySelectorAll('#papers .pp').length);
    if(!n) throw new Error('writing tab listed no papers');
    console.log('   opens on ELA Writing with '+n+' papers');
  });

  await step('mobile: a guide opens cleanly on a phone',async()=>{
    await pg.setViewportSize({width:390,height:844});
    await signIn(pg,'#c-form-primary',5);
    await pg.goto(B+'guides.html',{waitUntil:'networkidle'});
    await pg.locator('#list details summary').first().click();
    await pg.waitForTimeout(250);
    const over=await pg.evaluate(()=>{
      const d=document.documentElement;
      return d.scrollWidth-d.clientWidth;
    });
    if(over>2) throw new Error('page overflows by '+over+'px');
    console.log('   clean at 390px');
  });

  await br.close();
  console.log('\n================ RESULT ================');
  if(errs.length){ console.log('FAILURES ('+errs.length+'):'); errs.forEach(e=>console.log('  • '+e)); process.exit(1); }
  console.log('ALL '+pass+' GUIDE CHECKS PASSED — no console errors, no page errors.');
})();
