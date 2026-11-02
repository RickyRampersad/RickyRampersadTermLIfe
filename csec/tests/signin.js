const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const B='http://127.0.0.1:8899/csec/', MOCK='http://127.0.0.1:8901/exec';
const errs=[]; let pass=0;
const step=async(n,f)=>{try{await f();console.log('✓ '+n);pass++;}catch(e){console.log('✗ '+n+' — '+e.message);errs.push(n+': '+e.message);}};
(async()=>{
  const br=await chromium.launch();
  const mk=async()=>{
    const c=await br.newContext({viewport:{width:1280,height:1000}});
    await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await c.route('**/assets/csec-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',
      body:'window.CSEC_SYNC_URL='+JSON.stringify(MOCK)+';'}));
    const p=await c.newPage();
    p.on('console',m=>{const t=m.text(); if(m.type()==='error'&&!/ERR_FAILED|ERR_CONNECTION_REFUSED/.test(t))errs.push('CONSOLE: '+t);});
    p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
    return p;
  };
  const pg=await mk();
  /* index.html sends a signed-in visitor straight to their desk, so the session
     has to be dropped before the front door can be tested again. */
  const leave=async(page)=>{ try{ await page.evaluate(()=>CSEC.signOut()); }catch(e){} };

  await step('a student is created with NO password and is straight in',async()=>{
    await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.click('[data-role="student"]'); await pg.click('#si-new');
    if(await pg.locator('#c-pin').count()) throw new Error('a PIN field still exists on the create form');
    await pg.fill('#c-name','Anaya'); await pg.click('#c-form-primary button[data-f="5"]');
    await pg.click('#c-go');
    await pg.waitForURL('**/student.html',{timeout:10000});
    console.log('   created and signed in with no password, no recovery screen');
  });

  await step('signing out and back in needs only the name',async()=>{
    await leave(pg);
    await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.click('[data-role="student"]');
    await pg.waitForSelector('#si-has:not(.hidden)');
    if(!await pg.locator('#si-pinwrap').isHidden()) throw new Error('a PIN box is showing');
    const sub=await pg.locator('#si-sub').textContent();
    if(!/no password/i.test(sub)) throw new Error('sub='+sub);
    await pg.click('#si-go'); await pg.waitForURL('**/student.html',{timeout:10000});
    console.log('   "'+sub.trim()+'"');
  });

  await step('a teacher works the same way',async()=>{
    await leave(pg);
    await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.click('[data-role="teacher"]'); await pg.click('#si-new');
    await pg.fill('#c-name','Mr Ramkissoon'); await pg.click('#c-go');
    await pg.waitForURL('**/teacher.html',{timeout:10000});
    console.log('   teacher created and in, no password');
  });

  await step('every sign-in is recorded on the device',async()=>{
    const log=await pg.evaluate(()=>CSEC.signInLog());
    if(log.length<3) throw new Error('log entries='+log.length);
    const bad=log.filter(e=>!e.name||!e.how||typeof e.ok!=='boolean'||!e.date);
    if(bad.length) throw new Error('incomplete entries: '+JSON.stringify(bad[0]));
    console.log('   '+log.length+' entries, newest: '+log[0].name+' ('+log[0].role+') by '+log[0].how+' on '+log[0].date);
  });

  await step('with an address and a group, the code door appears',async()=>{
    await pg.evaluate(()=>{
      CSEC_SYNC.setGroup({code:'TEST-0001',label:'Family'});
      const p=CSEC.profiles().find(x=>x.role==='student');
      CSEC.updateProfile(p.id,{email:'parent@example.com'});
    });
    await leave(pg);
    await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.click('[data-role="student"]');
    await pg.waitForSelector('#si-sendcode:not(.hidden)',{timeout:5000});
    console.log('   "E-mail me a code instead" offered');
  });

  await step('asking sends a code, and the address is masked back',async()=>{
    await pg.click('#si-sendcode');
    await pg.waitForSelector('#si-ok:not(.hidden)',{timeout:8000});
    const ok=await pg.locator('#si-ok').textContent();
    if(/parent@example\.com/.test(ok)) throw new Error('the full address was echoed back: '+ok);
    if(!/…@example\.com/.test(ok)) throw new Error('not masked: '+ok);
    if(await pg.locator('#si-codewrap').isHidden()) throw new Error('code box did not appear');
    console.log('   '+ok.trim());
  });

  await step('a wrong code is refused and logged, a right one signs in',async()=>{
    await pg.fill('#si-code','111111'); await pg.click('#si-go');
    await pg.waitForFunction(()=>document.getElementById('si-err').textContent.length>0,{timeout:8000});
    const err=await pg.locator('#si-err').textContent();
    if(!/does not match/i.test(err)) throw new Error('err='+err);
    if(!/index\.html/.test(pg.url())) throw new Error('signed in on a wrong code!');
    await pg.fill('#si-code','424242'); await pg.click('#si-go');
    await pg.waitForURL('**/student.html',{timeout:10000});
    const log=await pg.evaluate(()=>CSEC.signInLog(4));
    const fail=log.filter(e=>!e.ok);
    if(!fail.length) throw new Error('the wrong code was not logged as a failure');
    console.log('   refused "'+err.trim()+'", then in; failure logged as: '+fail[0].note);
  });

  await step('no group means the code door is not offered at all',async()=>{
    const fresh=await mk();
    await fresh.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await fresh.click('[data-role="student"]'); await fresh.click('#si-new');
    await fresh.fill('#c-name','Solo'); await fresh.fill('#c-email','x@example.com');
    await fresh.click('#c-form-primary button[data-f="4"]');
    await fresh.click('#c-go'); await fresh.waitForURL('**/student.html',{timeout:10000});
    await leave(fresh);
    await fresh.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await fresh.click('[data-role="student"]');
    await fresh.waitForSelector('#si-has:not(.hidden)');
    if(!await fresh.locator('#si-sendcode').isHidden()) throw new Error('code offered with no group');
    await fresh.click('#si-go'); await fresh.waitForURL('**/student.html',{timeout:10000});
    console.log('   falls back to name-only, as it must with no service');
  });

  await step('Settings shows who signed in, and when',async()=>{
    await pg.goto(B+'settings.html',{waitUntil:'networkidle'});
    const rows=await pg.locator('#si-log tr').count();
    if(rows<2) throw new Error('log rows='+rows);
    const txt=await pg.locator('#si-log').textContent();
    if(!/signed in/i.test(txt)) throw new Error('no outcome shown');
    if(!/refused/i.test(txt)) throw new Error('the refused attempt is not shown');
    console.log('   '+(rows-1)+' entries, successes and refusals both shown');
  });

  await step('the year picker offers the five primary years and actually saves',async()=>{
    /* The product is for SEA alone, so the ladder is Standard 1 to Standard 5 and
       nothing above it is offered anywhere. */
    const opts=await pg.locator('#p-form option').allTextContents();
    if(opts.length!==5) throw new Error('years offered='+opts.length+': '+opts.join(','));
    if(!opts.some(o=>/Standard 1/.test(o))||!opts.some(o=>/Standard 5/.test(o)))
      throw new Error('ladder not complete: '+opts.join(','));
    if(opts.some(o=>/Form/.test(o))) throw new Error('a Form is still offered: '+opts.join(','));
    await pg.selectOption('#p-form','4');
    await pg.click('#save-prof');
    await pg.waitForTimeout(400);
    const lvl=await pg.evaluate(()=>CSEC.current().level);
    if(lvl!==4) throw new Error('level after save='+lvl+' (expected 4) — the year still does not save');
    console.log('   '+opts.length+' years offered; saved and read back as level '+lvl);
  });

  await step('a PIN can be added and removed again',async()=>{
    await pg.fill('#p-pin','2468'); await pg.click('#save-prof'); await pg.waitForTimeout(350);
    if(!await pg.evaluate(()=>CSEC.hasPin(CSEC.current().id))) throw new Error('PIN not set');
    await pg.fill('#p-pin','none'); await pg.click('#save-prof'); await pg.waitForTimeout(350);
    if(await pg.evaluate(()=>CSEC.hasPin(CSEC.current().id))) throw new Error('PIN not removed by "none"');
    console.log('   added, then removed with "none"');
  });

  await step('mobile: the front door fits a phone',async()=>{
    const m=await br.newContext({viewport:{width:390,height:844}});
    await m.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const mp=await m.newPage();
    await mp.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    const ov=await mp.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    if(ov) throw new Error('overflow at 390px');
    await m.close(); console.log('   clean at 390px');
  });

  console.log('\n================ RESULT ================');
  console.log(errs.length?('FAILURES ('+errs.length+'):\n  '+errs.join('\n  ')):('ALL '+pass+' SIGN-IN CHECKS PASSED — no console errors, no page errors.'));
  await br.close(); process.exit(errs.length?1:0);
})();
