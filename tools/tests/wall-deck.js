const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs'); const DATA=fs.readFileSync('wall-data.json','utf8');
let pass=0,fail=0; const ok=(c,m,e)=>{c?pass++:fail++;console.log(`   ${c?'PASS':'** FAIL **'}  ${m}${!c&&e?'  -> '+e:''}`)};
const which = p => p.evaluate(()=>{
  const d=document.getElementById('deck');
  return Math.round(d.scrollTop / innerHeight) + 1;
});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1920,height:1080}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.route('**/macros/s/**', r=>r.fulfill({status:200,contentType:'application/json',body:DATA}));
  await p.goto('file:///home/user/RickyRampersadTermLIfe/donthaveanagent/wall.html');
  await p.fill('#code','FM7788'); await p.click('#go'); await p.waitForTimeout(1200);

  console.log('=== it advances on its own ===');
  const a = await which(p);
  await p.waitForTimeout(14500);
  const bb = await which(p);
  ok(bb === a + 1, `slide ${a} advanced to ${bb} without a touch`);

  console.log('\n=== it wraps back round at the end ===');
  // walk past the last slide however many there are, and check it comes round
  const n = await p.evaluate(()=>SLIDES);
  await p.evaluate(k=>{ go(k-1); }, n);          // land on the final slide
  await p.waitForTimeout(700);
  const last = await which(p);
  await p.evaluate(()=>{ go(at+1); });           // one more should wrap to the first
  await p.waitForTimeout(900);
  const wrapped = await which(p);
  ok(last === n && wrapped === 1,
     `slide ${n} is last and wraps to 1 (saw ${last} then ${wrapped})`);

  console.log('\n=== a hand on it pauses the carousel ===');
  await p.evaluate(()=>go(0)); await p.waitForTimeout(900);
  await p.mouse.wheel(0, 40); await p.waitForTimeout(300);
  const c1 = await which(p);
  await p.waitForTimeout(15000);
  ok(await which(p) === c1, 'it holds still for a minute after somebody scrolls', 'slide moved to '+await which(p));

  console.log('\n=== arrow keys drive it ===');
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(800);
  const d1 = await which(p);
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(800);
  ok(await which(p) === d1 - 1, 'up and down step through the deck');

  console.log('\n   js errors:', errs.length?errs.join(' | '):'none');
  ok(errs.length===0,'no page errors through the whole cycle');
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  await b.close();
  process.exit(fail?1:0);
})();
