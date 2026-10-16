const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const B='http://127.0.0.1:8899/csec/';
const errs=[]; let pass=0;
const step=async(n,f)=>{try{await f();console.log('✓ '+n);pass++;}catch(e){console.log('✗ '+n+' — '+e.message);errs.push(n+': '+e.message);}};
(async()=>{
  const br=await chromium.launch();
  const c=await br.newContext({viewport:{width:1280,height:1000}});
  await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await c.newPage();
  pg.on('console',m=>{const t=m.text(); if(m.type()==='error'&&!/ERR_FAILED|ERR_CONNECTION_REFUSED/.test(t))errs.push('CONSOLE: '+t);});
  pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));

  await step('sign in as Standard 5',async()=>{
    await pg.goto(B+'index.html?signin',{waitUntil:'networkidle'});
    await pg.click('[data-role="student"]'); await pg.click('#si-new');
    await pg.fill('#c-name','Reg');
    await pg.click('#c-form-primary button[data-f="5"]');
    await pg.click('#c-go'); await pg.waitForURL('**/student.html',{timeout:10000});
  });
  await step('Maths paper still builds to blueprint and scores',async()=>{
    await pg.goto(B+'sea.html',{waitUntil:'networkidle'});
    await pg.click('#papers .pp[data-n="1"]');
    await pg.waitForSelector('#paper:not(.hidden)');
    const map=await pg.locator('#q-map .nb').count();
    if(map!==40) throw new Error('items='+map);
    for(let i=0;i<3;i++){ await pg.locator('#q-opts .opt').first().click(); await pg.waitForTimeout(170); }
    await pg.click('#q-submit'); await pg.waitForSelector('#result:not(.hidden)');
    const t=await pg.locator('#r-title').textContent();
    if(!/out of 75 marks/.test(t)) throw new Error('title='+t);
    console.log('   '+map+' items → '+t);
  });
  await step('ELA paper still opens with its sections',async()=>{
    await pg.click('#r-back'); await pg.waitForSelector('#index:not(.hidden)');
    await pg.click('#tabs button[data-s="p-ela"]'); await pg.waitForTimeout(200);
    await pg.click('#papers .pp[data-n="1"]');
    await pg.waitForSelector('#paper:not(.hidden)');
    const n=await pg.locator('#q-map .nb').count();
    const sec=await pg.locator('#q-sec').textContent();
    if(n<30) throw new Error('ela items='+n);
    console.log('   '+n+' items, opens on '+sec.trim());
    await pg.click('#q-quit');
  });
  await step('all three tabs still list 14 papers with 2 mocks',async()=>{
    for(const s of ['p-mathematics','p-ela','p-ela-writing']){
      await pg.click('#tabs button[data-s="'+s+'"]'); await pg.waitForTimeout(200);
      const n=await pg.locator('#papers .pp').count();
      const m=await pg.locator('#papers .pp.mock').count();
      if(n!==14||m!==2) throw new Error(s+': papers='+n+' mocks='+m);
    }
    console.log('   14 papers / 2 mocks on each of the three');
  });
  await step('the honesty note still states the real paper depth',async()=>{
    await pg.click('#tabs button[data-s="p-mathematics"]'); await pg.waitForTimeout(200);
    const d=await pg.locator('#depth').textContent();
    if(!/completely separate/i.test(d)) throw new Error('note missing');
    console.log('   '+d.replace(/\s+/g,' ').trim().slice(0,110));
  });
  console.log('\n================ RESULT ================');
  console.log(errs.length?('FAILURES ('+errs.length+'):\n  '+errs.join('\n  ')):('ALL '+pass+' REGRESSION CHECKS PASSED — no console errors, no page errors.'));
  await br.close(); process.exit(errs.length?1:0);
})();
