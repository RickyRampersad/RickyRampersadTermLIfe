const { chromium } = require('playwright'); const path=require('path');
(async()=>{ const b=await chromium.launch();
  const pg=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+path.resolve('film.html'));
  await pg.waitForFunction(()=>window.SEEK&&document.fonts.status==='loaded');
  await pg.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
  const ts=[1.0,3.4,5.9,8.3,10.8,13.2,16.2];
  for(let i=0;i<ts.length;i++){ await pg.evaluate(t=>window.SEEK(t),ts[i]);
    await pg.screenshot({path:'c'+i+'.jpg',type:'jpeg',quality:88}); }
  console.log('errors:',errs.length?errs:'none');
  await b.close(); })();
