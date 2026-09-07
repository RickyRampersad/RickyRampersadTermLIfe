const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
    args:['--autoplay-policy=no-user-gesture-required','--force-device-scale-factor=1'] });
  const ctx = await b.newContext({ viewport:{width:1280,height:720},
    recordVideo:{ dir:'wallcap', size:{width:1280,height:720} } });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await p.goto('file:///home/user/RickyRampersadTermLIfe/donthaveanagent/wall-film.html');
  await p.waitForTimeout(1500);
  await p.click('#playBtn');
  await p.addStyleTag({content:'#ctrl{display:none!important}#poster{display:none!important}'});
  const DUR = 122000, t0 = Date.now();
  await p.waitForTimeout(2400);
  await p.screenshot({ path:'wall-poster.jpg', type:'jpeg', quality:92 });
  await p.waitForTimeout(DUR - (Date.now()-t0));
  await ctx.close(); await b.close();
  console.log('recorded', ((Date.now()-t0)/1000).toFixed(1),'s · errors:', errs.length?errs:'none');
})();
