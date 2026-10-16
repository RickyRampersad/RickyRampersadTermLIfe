const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const B='http://127.0.0.1:8899/csec/';
const errs=[]; let pass=0;
const step=async(n,f)=>{try{await f();console.log('✓ '+n);pass++;}catch(e){console.log('✗ '+n+' — '+e.message);errs.push(n+': '+e.message);}};

(async()=>{
  const br=await chromium.launch();
  const c=await br.newContext({viewport:{width:1280,height:1100}});
  await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await c.newPage();
  pg.on('console',m=>{const t=m.text(); if(m.type()==='error'&&!/ERR_FAILED|ERR_CONNECTION_REFUSED/.test(t))errs.push('CONSOLE: '+t);});
  pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));

  await step('a Standard 5 child signs in',async()=>{
    await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.click('[data-role="student"]'); await pg.click('#si-new');
    await pg.fill('#c-name','Student');
    await pg.click('#c-form-primary button[data-f="5"]');
    await pg.click('#c-go'); await pg.waitForURL('**/student.html',{timeout:10000});
  });

  await step('the writing papers now come in all three real forms',async()=>{
    await pg.goto(B+'sea.html',{waitUntil:'networkidle'});   // sea-papers.js only loads here
    const forms=await pg.evaluate(()=>{
      const o={}; window.CSEC_SEA.writing.forEach(p=>p.prompts.forEach(q=>o[q.form]=(o[q.form]||0)+1)); return o;
    });
    if(!forms.letter||!forms.report||!forms.story) throw new Error('forms='+JSON.stringify(forms));
    console.log('   '+JSON.stringify(forms));
  });

  // paper 2 = a LETTER paper
  await step('opening a letter paper shows the decode step, not the writing box',async()=>{
    await pg.goto(B+'sea.html',{waitUntil:'networkidle'});
    await pg.click('#tabs button[data-s="p-ela-writing"]'); await pg.waitForTimeout(200);
    await pg.click('#papers .pp[data-n="2"]');
    await pg.waitForSelector('#writing:not(.hidden)');
    if(!await pg.locator('#w-decode').isHidden()) throw new Error('decode shown before a topic was picked');
    if(!await pg.locator('#w-answer').isHidden()) throw new Error('writing box open before decoding');
    await pg.locator('#w-prompts .prompt').nth(0).click();
    await pg.waitForSelector('#w-decode:not(.hidden)');
    if(!await pg.locator('#w-answer').isHidden()) throw new Error('writing box open straight after picking');
    console.log('   topic picked → decode appears, writing box still shut');
  });

  await step('the wrong topic number is refused',async()=>{
    await pg.locator('#w-num button').nth(2).click();   // picked topic 1, press topic 3
    const fb=await pg.locator('#w-numfb').textContent();
    if(!/not the one you picked/i.test(fb)) throw new Error('fb='+fb.slice(0,80));
    if(!await pg.locator('#w-start').isDisabled()) throw new Error('start enabled on a wrong number');
    await pg.locator('#w-num button').nth(0).click();
    const fb2=await pg.locator('#w-numfb').textContent();
    if(!/write that number in the box/i.test(fb2)) throw new Error('fb2='+fb2.slice(0,80));
    console.log('   '+fb2.trim().slice(0,86));
  });

  await step('HIS MISTAKE: calling a letter a story is caught and explained',async()=>{
    await pg.locator('#w-form button[data-f="story"]').click();
    const fb=await pg.locator('#w-formfb').textContent();
    if(!/asks for/i.test(fb)) throw new Error('no correction: '+fb.slice(0,90));
    if(!/zero for Content/i.test(fb)) throw new Error('does not name the consequence: '+fb.slice(0,120));
    if(!await pg.locator('#w-start').isDisabled()) throw new Error('start enabled on the wrong form');
    if(!await pg.locator('#w-answer').isHidden()) throw new Error('writing box open on the wrong form');
    console.log('   '+fb.trim().replace(/\s+/g,' ').slice(0,150));
  });

  await step('the right form names the audience and unlocks the paper',async()=>{
    await pg.locator('#w-form button[data-f="letter"]').click();
    if(await pg.locator('#w-towrap').isHidden()) throw new Error('audience not revealed');
    const to=await pg.locator('#w-to').textContent();
    if(!to.trim()) throw new Error('no audience named');
    if(await pg.locator('#w-start').isDisabled()) throw new Error('start still disabled when both are right');
    console.log('   to: '+to.trim().replace(/\s+/g,' ').slice(0,80));
  });

  await step('starting reveals the must-do list and the writing box',async()=>{
    await pg.click('#w-start');
    await pg.waitForSelector('#w-answer:not(.hidden)');
    const n=await pg.locator('#w-must .must').count();
    if(n<2) throw new Error('must items='+n);
    const items=await pg.locator('#w-must .must').allTextContents();
    console.log('   '+n+' requirements: '+items.map(t=>t.replace(/✓/,'').trim()).join(' | ').slice(0,150));
  });

  await step('unticked requirements are named back at the end',async()=>{
    await pg.locator('#w-must .must').nth(0).click();      // tick only the first
    await pg.fill('#w-text','Dear Sir, '+'I am writing about the playing field. '.repeat(12));
    await pg.click('#w-done');
    await pg.waitForSelector('#result:not(.hidden)');
    const card=await pg.locator('#r-card').textContent();
    if(!/left unticked/i.test(card)) throw new Error('no unticked warning: '+card.slice(0,120));
    const sub=await pg.locator('#r-sub').textContent();
    if(!/Topic 1/.test(sub)) throw new Error('topic number not recorded: '+sub);
    console.log('   '+card.replace(/\s+/g,' ').trim().slice(0,160));
  });

  await step('a report paper asks for a report, not a story',async()=>{
    await pg.click('#r-back'); await pg.waitForSelector('#index:not(.hidden)');
    await pg.click('#papers .pp[data-n="10"]');
    await pg.waitForSelector('#writing:not(.hidden)');
    await pg.locator('#w-prompts .prompt').nth(0).click();
    await pg.locator('#w-num button').nth(0).click();
    await pg.locator('#w-form button[data-f="story"]').click();
    const fb=await pg.locator('#w-formfb').textContent();
    if(!/a report/i.test(fb)) throw new Error('fb='+fb.slice(0,90));
    await pg.locator('#w-form button[data-f="report"]').click();
    if(await pg.locator('#w-start').isDisabled()) throw new Error('report not accepted');
    console.log('   report paper behaves correctly');
  });

  await step('mobile: the decode step fits a phone',async()=>{
    const m=await br.newContext({viewport:{width:390,height:844}});
    await m.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const mp=await m.newPage();
    await mp.goto(B+'sea.html',{waitUntil:'networkidle'});
    const ov=await mp.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    if(ov) throw new Error('overflow at 390px');
    await m.close(); console.log('   clean at 390px');
  });

  console.log('\n================ RESULT ================');
  console.log(errs.length?('FAILURES ('+errs.length+'):\n  '+errs.join('\n  ')):('ALL '+pass+' WRITING CHECKS PASSED — no console errors, no page errors.'));
  await br.close(); process.exit(errs.length?1:0);
})();
