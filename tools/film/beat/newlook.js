const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const HERE=__dirname, FILM=process.argv[2]||'bwagent', SHAPE=process.argv[3]||'w', PAL=process.argv[4]||'blue';
const SZ={v:{width:1080,height:1920},f:{width:1080,height:1350},w:{width:1920,height:1080}}[SHAPE];
const T={'.html':'text/html','.svg':'image/svg+xml','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.b64':'text/plain'};
(async()=>{
const srv=http.createServer((rq,rs)=>{const f=path.join(HERE,decodeURIComponent(rq.url.split('?')[0]));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);return rs.end()}
 rs.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});rs.end(fs.readFileSync(f))}).listen(0);
const br=await chromium.launch({args:['--no-sandbox']});
const pg=await br.newPage({viewport:SZ,deviceScaleFactor:1});
const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
await pg.addInitScript(k=>{window.__CFG=k},FILM);
await pg.route('**/engine.js', async r=>{
  const cfg=fs.readFileSync(path.join(HERE,'cfg-'+FILM+'.js'),'utf8');
  const eng=fs.readFileSync(path.join(HERE,'engine.js'),'utf8');
  await r.fulfill({status:200,contentType:'text/javascript',body:cfg+'\n'+eng});
});
await pg.goto(`http://localhost:${srv.address().port}/engine.html?film=${FILM}&shape=${SHAPE}&pal=${PAL}`,{waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>window.FILM_READY===true,null,{timeout:30000});
const dur=await pg.evaluate(()=>window.FILM_DUR), cuts=await pg.evaluate(()=>window.FILM_CUTS);
const marks=[0].concat(cuts);
for(let i=0;i<marks.length;i++){
  const a=marks[i], b=(i+1<marks.length?marks[i+1]:dur);
  await pg.evaluate(x=>window.SEEK(x), a+(b-a)*0.78);
  await pg.screenshot({path:`nl-${FILM}-${SHAPE}-${String(i).padStart(2,'0')}.jpg`,type:'jpeg',quality:88});
}
console.log(FILM,SHAPE,PAL,'errors:',errs.length?errs[0]:'none');
await br.close();srv.close();
})();
