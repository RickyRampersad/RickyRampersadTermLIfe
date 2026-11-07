/* The broken form: does it work, does it fit a phone, and does what the
   Branch Manager receives say what the candidate actually did? */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/RickyRampersadTermLIfe';
const T={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg',
         '.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.webmanifest':'application/json'};
let pass=0,fail=0;
const ok=(c,m)=>{c?(pass++):(fail++,console.log('  FAIL '+m));};
(async()=>{
const srv=http.createServer((rq,rs)=>{
  let f=path.join(ROOT,decodeURIComponent(rq.url.split('?')[0]));
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
  if(!fs.existsSync(f)){rs.writeHead(404);return rs.end()}
  rs.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});
  rs.end(fs.readFileSync(f));
}).listen(0);
const port=srv.address().port;
const br=await chromium.launch({args:['--no-sandbox']});

for(const vp of [{width:1366,height:900,n:'laptop'},{width:390,height:844,n:'phone'}]){
  const pg=await br.newPage({viewport:vp});
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(`http://localhost:${port}/buildwithus/`,{waitUntil:'domcontentloaded'});
  await pg.waitForSelector('#fixgrid:not([hidden])',{timeout:10000});
  ok(errs.length===0, vp.n+' no page errors: '+errs[0]);

  const spots=await pg.$$('#fix .spot');
  ok(spots.length===14, vp.n+' 14 tappable spots, got '+spots.length);

  // nothing marked yet
  ok((await pg.textContent('#mN')).includes('Nothing marked'), vp.n+' starts empty');
  ok(await pg.isHidden('#mSend'), vp.n+' send hidden until something is marked');

  // mark three, one of them a name field
  for(const k of ['date','total','name3']) await pg.click(`#fix .spot[data-f="${k}"]`);
  ok((await pg.textContent('#mN')).includes('3 things'), vp.n+' counts 3');
  ok(await pg.isVisible('#mSend'), vp.n+' send appears');
  ok((await pg.getAttribute('#fix .spot[data-f="date"]','aria-pressed'))==='true', vp.n+' marked state is announced');

  // the three name fields are ONE fault
  await pg.click('#fix .spot[data-f="name3b"]');
  await pg.click('#fix .spot[data-f="name3c"]');
  ok((await pg.textContent('#mN')).includes('3 things'), vp.n+' three name fields still count once');

  // the count of what is there is never shown
  const body=await pg.textContent('#fix');
  ok(!/of 1[24]/.test(body) && !body.includes('12 things'), vp.n+' never reveals how many faults there are');
  ok(!body.toLowerCase().includes('no format') && !body.toLowerCase().includes('typed about 90 ways'),
     vp.n+' never prints the answers on screen');

  // a note travels with a mark
  await pg.fill('#mList li:first-child textarea','two dates in one');
  const fx=await pg.evaluate(()=>window.__rrbFix());
  ok(fx.n===3, vp.n+' report counts 3, got '+fx.n);
  ok(fx.found.includes('two dates in one'), vp.n+' their words reach the report');
  ok(fx.found.includes('[No format'), vp.n+' the branch note is attached for him');
  ok(fx.missed.includes('The reason box'), vp.n+' what they walked past is listed');

  // unmark
  await pg.click('#mList li:first-child .mx');
  ok((await pg.evaluate(()=>window.__rrbFix())).n===2, vp.n+' a mark can be taken back');

  // something else
  await pg.click('#mElse'); await pg.fill('#mElseT','it never asks who approved it');
  ok((await pg.evaluate(()=>window.__rrbFix())).other.includes('approved'), vp.n+' off-script finds are kept');

  // no sideways scroll
  const over=await pg.evaluate(()=>{window.scrollTo(9999,0);const x=window.scrollX;window.scrollTo(0,0);return x});
  ok(over===0, vp.n+' no sideways scroll, got '+over+'px');

  // it survives a reload, because people scroll away and come back
  await pg.reload({waitUntil:'domcontentloaded'});
  await pg.waitForSelector('#fixgrid:not([hidden])');
  ok((await pg.evaluate(()=>window.__rrbFix())).n===2, vp.n+' marks survive a reload');

  await pg.close();
}

// with no script at all, the page still asks for an application
const pg=await br.newPage({viewport:{width:390,height:844},javaScriptEnabled:false});
await pg.goto(`http://localhost:${port}/buildwithus/`,{waitUntil:'domcontentloaded'});
ok(await pg.isHidden('#fixgrid'), 'no JS: the marking is hidden rather than broken');
ok((await pg.textContent('#fix')).includes('blocking it'), 'no JS: it says so');
ok(await pg.isVisible('#apply form'), 'no JS: the application is still there');
await pg.close();

await br.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
})();
