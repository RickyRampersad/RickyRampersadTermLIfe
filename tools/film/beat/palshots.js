/* The same three frames in every palette, for the branch to choose from.
   Three looks have been turned down; the fourth gets picked, not guessed. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const HERE=__dirname, FILM='bwagent', SHAPE='w';
const PALS=process.argv.slice(2);
const SZ={width:1920,height:1080};
const T={'.html':'text/html','.svg':'image/svg+xml','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.b64':'text/plain'};
(async()=>{
const srv=http.createServer((rq,rs)=>{const f=path.join(HERE,decodeURIComponent(rq.url.split('?')[0]));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);return rs.end()}
 rs.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});rs.end(fs.readFileSync(f))}).listen(0);
const br=await chromium.launch({args:['--no-sandbox']});
for(const pal of PALS){
  const pg=await br.newPage({viewport:SZ,deviceScaleFactor:1});
  await pg.addInitScript(k=>{window.__CFG=k},FILM);
  await pg.route('**/engine.js', async r=>{
    const cfg=fs.readFileSync(path.join(HERE,'cfg-'+FILM+'.js'),'utf8');
    const eng=fs.readFileSync(path.join(HERE,'engine.js'),'utf8');
    await r.fulfill({status:200,contentType:'text/javascript',body:cfg+'\n'+eng});
  });
  await pg.goto(`http://localhost:${srv.address().port}/engine.html?film=${FILM}&shape=${SHAPE}&pal=${pal}`,{waitUntil:'domcontentloaded'});
  await pg.waitForFunction(()=>window.FILM_READY===true,null,{timeout:30000});
  const dur=await pg.evaluate(()=>window.FILM_DUR), cuts=await pg.evaluate(()=>window.FILM_CUTS);
  const marks=[0].concat(cuts);
  /* a light scene with a ledger, a dark scene with a list, and the close */
  const pick=[0,5,marks.length-1];
  for(let i=0;i<pick.length;i++){
    const m=pick[i], a=marks[m], b=(m+1<marks.length?marks[m+1]:dur);
    await pg.evaluate(x=>window.SEEK(x), a+(b-a)*0.75);
    await pg.screenshot({path:`pal-${pal}-${i}.jpg`,type:'jpeg',quality:88});
  }
  await pg.close(); console.log('shot',pal);
}
await br.close();srv.close();
})();
