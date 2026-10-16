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

  await step('the SEA writing module covers the paper as it is actually set',async()=>{
    const w=await pg.evaluate(()=>(window.CSEC_GUIDES||[])
      .filter(g=>g.subj==='p-ela-writing')
      .map(g=>({id:g.id,level:g.level,strand:g.strand})));
    if(w.length<10) throw new Error('only '+w.length+' writing guides');
    const ids=w.map(g=>g.id);
    /* Six of the fifteen real topics were letters and three were reports, so a module
       that only teaches free story writing meets most of the paper for the first time
       in the hall. These are the pieces that have to be there. */
    [['g-pw-topic','reading the topic before writing — the Content mark'],
     ['g-pw-letter','the letter form'],
     ['g-pw-report','the report form'],
     ['g-pw-given','sentences that must be used word for word'],
     ['g-pw-opening','opening without the memorised template'],
     ['g-pw-middle','building the middle'],
     ['g-pw-ending','an ending that lands'],
     ['g-pw-shape','how long it should be and how to spend the fifty minutes']
    ].forEach(([id,what])=>{ if(ids.indexOf(id)===-1) throw new Error('nothing teaches '+what+' ('+id+' missing)'); });
    console.log('   '+w.length+' writing guides: '+ids.map(i=>i.replace('g-pw-','')).join(', '));
  });

  /* Four rounds of drafting broke these, so they are nailed down here. Each one is a
     decision about the set, not a matter of taste: a child copies the worked examples
     letter for letter, and two guides disagreeing about how long to plan for is worse
     than either answer on its own. */
  await step('the writing guides hold to one house style',async()=>{
    const bad=await pg.evaluate(()=>{
      const out=[];
      const W=(window.CSEC_GUIDES||[]).filter(g=>g.subj==='p-ela-writing');
      const text=g=>JSON.stringify(g);

      /* one name for one thing */
      [[/speech marks/i,'"speech marks" — the set says quotation marks'],
       [/rough page|jotting page|working page/i,'a second name for the plan page'],
       [/Yours respectfully/i,'"Yours respectfully" — not used in this set'],
       [/rubbish bin/i,'"rubbish bin" — a Trinidadian child writes garbage bin'],
       [/\bthe marker\b|person who marks/i,'a second name for the examiner'],
       [/\bcriterion\b|\bexemplar\b|\bpreamble\b/i,'examiner jargon']
      ].forEach(([re,why])=>{ W.forEach(g=>{ if(re.test(text(g))) out.push(g.id+': '+why); }); });

      /* no invented mark arithmetic */
      [/half the Content mark/i, /costs? you a mark/i, /lose a mark/i,
       /does not earn you anything/i, /\bzero for (Content|Organisation)\b/i
      ].forEach(re=>{ W.forEach(g=>{ if(re.test(text(g))) out.push(g.id+': prices a mark consequence — '+re); }); });

      /* One guide owns the clock. Three phrases are allowed anywhere, because they
         name the check and the topic pass rather than budget them: strip every one
         of those, and whatever numbered minutes remain are a second budget. */
      const ALLOWED=/two-minute check|last two minutes|plan-page minute/ig;
      const NUMBERED=/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*(planning |quiet |whole )?minutes?\b/i;
      const owners=W.filter(g=>NUMBERED.test(text(g).replace(ALLOWED,'')))
                    .map(g=>g.id).filter(id=>id!=='g-pw-shape');
      if(owners.length) out.push('states its own minutes budget instead of deferring to g-pw-shape: '+owners.join(', '));

      /* no line count invented for a booklet nobody has measured */
      W.forEach(g=>{ if(/\b\d+\s*(lines|words)\b/i.test(text(g))) out.push(g.id+': states a line or word count'); });

      /* the renderer wraps, but a 600-character worked line is still unreadable */
      W.forEach(g=>g.worked.lines.forEach((l,i)=>{
        if(l.work.length>420) out.push(g.id+' worked line '+(i+1)+' is '+l.work.length+' characters');
      }));

      /* a pitfall that is a step turned negative is wasted space */
      W.forEach(g=>{
        const seen={};
        g.pitfalls.forEach(p=>{
          const k=p.toLowerCase().replace(/[^a-z ]/g,'').split(' ').filter(x=>x.length>4).slice(0,4).join(' ');
          if(k&&seen[k]) out.push(g.id+': two pitfalls make the same point');
          seen[k]=1;
        });
      });
      return out;
    });
    if(bad.length) throw new Error(bad.length+' breaches: '+bad.slice(0,5).join(' | '));
    console.log('   one name per thing, no priced marks, one clock, no invented counts');
  });

  await step('the letter heading and sign-off are identical wherever they appear',async()=>{
    const r=await pg.evaluate(()=>{
      const W=(window.CSEC_GUIDES||[]).filter(g=>g.subj==='p-ela-writing');
      const heads=[], signs=[];
      W.forEach(g=>g.worked.lines.forEach(l=>{
        /* an address block: two or more lines before a date */
        const m=l.work.match(/^([^\n]+,)\n([^\n]+\.)\n(\d{1,2}(st|nd|rd|th) [A-Z][a-z]+, \d{4}\.)/);
        if(m) heads.push({id:g.id, head:m[0]});
        const s=l.work.match(/Yours (sincerely|faithfully|respectfully),|Your friend,|Love,/g);
        if(s) s.forEach(x=>signs.push({id:g.id, sign:x}));
      }));
      return {heads:heads, signs:signs};
    });
    /* The module teaches the letter, so a letter heading must be here to check. Zero
       means the line breaks were lost between the data and the page — which is what
       happened the first time, when the emitter turned every newline into a space. */
    if(!r.heads.length) throw new Error('no address block found in any writing guide — were the newlines flattened?');
    /* every address block must use the same punctuation pattern: commas, then a full
       stop on the last line of the address, then the date with a full stop */
    r.heads.forEach(h=>{
      if(!/,\n.+\.\n\d{1,2}(st|nd|rd|th) [A-Z][a-z]+, \d{4}\.$/.test(h.head))
        throw new Error(h.id+' heading punctuation differs: '+JSON.stringify(h.head));
    });
    const resp=r.signs.filter(s=>/respectfully/.test(s.sign));
    if(resp.length) throw new Error(resp[0].id+' closes "Yours respectfully"');
    console.log('   '+r.heads.length+' address block(s), '+r.signs.length+' sign-off(s), all to one pattern');
  });

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

  /* A letter and a report are laid out down the page, so a worked line carries
     real newlines and can run long. The work column used to be flex:none with no
     white-space rule: newlines collapsed into one run-on line and a long line
     pushed the card off the side of a laptop. Both are fixed; this holds them. */
  await step('a worked example keeps its line breaks and stays on the screen',async()=>{
    /* Appended to the real data file on the way through, because paint() closes
       over its own filtered copy of the list. */
    const PROBE = 'window.CSEC_GUIDES.push({id:"g-zz-probe",subj:"p-ela-writing",strand:"pw-expository",level:5,'+
      'title:"Probe",when:"Never \u2014 a test fixture.",'+
      'steps:[{do:"a",note:"b"},{do:"c",note:"d"},{do:"e",note:"f"},{do:"g",note:"h"}],'+
      'worked:{problem:"A topic with bulleted instructions:\\n\u2022 the date, time and place\\n\u2022 who was involved",'+
      'lines:[{work:"14 Pump Trace,\\nSangre Grande.\\n20th March, 2026.\\n\\nDear Mr. Ramkissoon,",note:"An address block."},'+
      '{work:"'+'X'.repeat(390)+'",note:"A long one."},{work:"short",note:"ok"}]},'+
      'pitfalls:["one","two"]});';
    const h=async(route)=>{
      const res=await route.fetch();
      route.fulfill({response:res, body:(await res.text())+'\n'+PROBE});
    };
    await pg.route('**/data/guides.js',h);
    try{
      await signIn(pg,'#c-form-primary',5);
      await pg.goto(B+'guides.html',{waitUntil:'networkidle'});
      const r=await pg.evaluate(()=>{
        const d=document.getElementById('g-g-zz-probe');
        if(!d) return {err:'probe guide did not render'};
        d.open=true;
        const w=d.querySelectorAll('.wline .w'), prob=d.querySelector('.wprob'), root=document.documentElement;
        return {
          ws:getComputedStyle(w[0]).whiteSpace,
          probWs:prob?getComputedStyle(prob).whiteSpace:null,
          addrH:w[0].getBoundingClientRect().height,
          shortH:w[2].getBoundingClientRect().height,
          longRight:Math.round(w[1].getBoundingClientRect().right),
          cardRight:Math.round(d.getBoundingClientRect().right),
          overflow:root.scrollWidth-root.clientWidth
        };
      });
      if(r.err) throw new Error(r.err);
      if(!/pre-line|pre-wrap|^pre$/.test(r.ws)) throw new Error('work column white-space is '+r.ws+' — newlines will collapse');
      if(!/pre-line|pre-wrap|^pre$/.test(r.probWs)) throw new Error('topic paragraph white-space is '+r.probWs);
      if(r.addrH < r.shortH*3) throw new Error('a five-line address rendered '+Math.round(r.addrH)+'px against '+Math.round(r.shortH)+'px for one line — still collapsing');
      if(r.longRight > r.cardRight+1) throw new Error('a long worked line runs '+(r.longRight-r.cardRight)+'px past the card edge');
      if(r.overflow > 2) throw new Error('page overflows by '+r.overflow+'px on a laptop');
      console.log('   newlines kept ('+Math.round(r.addrH)+'px for 5 lines vs '+Math.round(r.shortH)+'px for 1), long line contained');
    } finally { await pg.unroute('**/data/guides.js',h); }
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
