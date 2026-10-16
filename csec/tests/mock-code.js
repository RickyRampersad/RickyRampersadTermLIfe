/* Mock of the code half of gs/csec-sync.gs: action=code / verify / signin / signins. */
const http=require('http');
let OTP=null, sent=[], log=[], tries=0;
const body=req=>new Promise(r=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>r(b));});
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  const send=o=>res.end(JSON.stringify(o));
  if(req.method==='GET'){
    const a=u.searchParams.get('action');
    if(a==='ping') return send({ok:true,service:'rrb-csec-sync',version:1});
    if(a==='pull') return send({ok:true,records:[]});
    if(a==='signins') return send({ok:true,signins:log.slice().reverse()});
    return send({ok:false,error:'unknown_action'});
  }
  let b={}; try{ b=JSON.parse(await body(req)); }catch(e){}
  if(b.action==='create') return send({ok:true,code:'TEST-0001'});
  if(b.action==='code'){
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email||'')) return send({ok:false,msg:'bad address'});
    OTP='424242'; tries=0; sent.push(b.email);
    log.push({at:Date.now(),name:b.name,how:'code',result:'code sent'});
    const at=b.email.indexOf('@');
    return send({ok:true,sentTo:b.email.slice(0,2)+'…'+b.email.slice(at)});
  }
  if(b.action==='verify'){
    tries++;
    if(!OTP) return send({ok:false,msg:'Ask for a code first.'});
    if(tries>5){ OTP=null; return send({ok:false,msg:'Too many wrong tries. Ask for a new code.'}); }
    if(String(b.otp)!==OTP){ log.push({at:Date.now(),how:'code',result:'failed'}); return send({ok:false,msg:'That code does not match.'}); }
    OTP=null; log.push({at:Date.now(),how:'code',result:'signed in'});
    return send({ok:true});
  }
  if(b.action==='signin'){ log.push({at:Date.now(),how:b.how,result:'signed in'}); return send({ok:true}); }
  if(b.action==='push') return send({ok:true});
  send({ok:false,error:'unknown_action'});
}).listen(8901,()=>console.log('mock code service on 8901'));
