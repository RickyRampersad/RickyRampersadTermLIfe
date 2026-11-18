/* What the Branch Manager actually receives: fill the application, mark the
   form, submit against a mocked backend, print the section he reads. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/user/RickyRampersadTermLIfe';
const T={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
(async()=>{
const srv=http.createServer((rq,rs)=>{let f=path.join(ROOT,decodeURIComponent(rq.url.split('?')[0]));
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
 if(!fs.existsSync(f)){rs.writeHead(404);return rs.end()}
 rs.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});rs.end(fs.readFileSync(f))}).listen(0);
const br=await chromium.launch({args:['--no-sandbox']});
const pg=await br.newPage({viewport:{width:1366,height:900}});
let sent=null;
await pg.route('https://script.google.com/**', async r=>{
  try{ sent=JSON.parse(r.request().postData()||'{}') }catch(e){ sent={raw:r.request().postData()} }
  await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,ref:'QB-261107-001'})});
});
await pg.goto(`http://localhost:${srv.address().port}/buildwithus/`,{waitUntil:'domcontentloaded'});
await pg.waitForSelector('#fixgrid:not([hidden])');

for(const k of ['date','total','dept','receipt','print','onefm']) await pg.click(`#fix .spot[data-f="${k}"]`);
await pg.fill('#mList li:nth-child(2) textarea','the three lines are right there, it should add them');
await pg.click('#mElse'); await pg.fill('#mElseT','nothing on it says who approved the payment');

/* fill every required field the page insists on */
await pg.evaluate(()=>{
  const f=document.getElementById('jf');
  const put=(n,v)=>{const e=f.querySelector(`[name="${n}"]`); if(!e)return;
    /* a radio's value is its answer: setting .value on one blanks the group,
       which is what made this look like a validation bug for ten minutes */
    if(e.type==='radio'||e.type==='checkbox'){e.checked=true}
    else if(e.tagName==='SELECT'){e.value=[...e.options].map(o=>o.value).filter(Boolean)[0]||v}
    else e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));};
  put('name','Jay Sample'); put('phone','868 555 0101'); put('email','jay@example.com');
  put('town','Couva'); put('travel',''); put('when','');
  put('exp',''); put('emp_co','A Company Ltd'); put('emp_role','Office administrator');
  put('emp_dates','March 2023 – now');
  put('emp_changed','I built the sheet that tracks every renewal, because we kept missing them.');
  put('edu','CXC, plus a short Excel course');
  put('pay_now',''); put('pay_want',''); put('start','');
  put('w_built','A WhatsApp reminder for the team that I keep running myself.');
  put('w_slim','I would ask what the form is for, then delete two thirds of it.');
  f.querySelectorAll('[name="tool"]').forEach((c,i)=>{if(i<2){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}))}});
  ['travel','exp','start'].forEach(n=>{const r=f.querySelector(`[name="${n}"]`);
    if(r){r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}))}});
  put('w_cv','The licence renewals would never be late again, and nobody would type a client name twice.');
});
await pg.click('#jSend');
await pg.waitForTimeout(3000);
if(!sent){
  const miss=await pg.evaluate(()=>{
    const f=document.getElementById('jf');
    return (window.__REQ||[]).length? window.__REQ : [...f.querySelectorAll('[required]')]
      .filter(e=>e.type==='radio'? !f.querySelector(`[name="${e.name}"]:checked`) : !String(e.value||'').trim())
      .map(e=>e.name+' ('+e.tagName.toLowerCase()+(e.type?'/'+e.type:'')+')');
  });
  console.log('NOTHING SENT. unfilled required:', [...new Set(miss)].join(', '));
  console.log('error shown:', (await pg.textContent('#jErr').catch(()=>''))||'(none)');
}
else {
  const f=(sent.fields||[]).filter(x=>x.section==='The form');
  console.log('--- what he reads, under "The form" ---\n');
  f.forEach(x=>console.log(x.label+':\n  '+String(x.value).split('\n').join('\n  ')+'\n'));
}
await br.close();srv.close();
})();
