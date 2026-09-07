const H=require('./e2e.js'),fs=require('fs');const{ctx,mail}=H;
const post=p=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(p)}}).getContent());
let pass=0,fail=0;const ok=(c,m,e)=>{c?pass++:fail++;console.log(`   ${c?'PASS':'** FAIL **'}  ${m}${!c&&e?'  -> '+e:''}`)};

const B=JSON.parse(fs.readFileSync('payload-dhaa.json','utf8'));
const wl=(B.fields||[]).find(f=>f.id==='wantLocator');
console.log('payload wantLocator =', JSON.stringify(wl && (wl.raw||wl.value)));

console.log('\n=== they asked for it ===');
H.reset(); mail.length=0; post(B);
let cl=mail.find(m=>/thank|review is in|policy review/i.test(m.subject||''));
let names=(cl.attachments||[]).map(a=>a.getName?a.getName():String(a));
console.log('   client email attachments:', names.join(' | '));
ok(names.some(n=>/Policy Location Record/i.test(n)), 'the locator reaches the client');

console.log('\n=== they did not ask ===');
const B2=JSON.parse(JSON.stringify(B));
B2.fields=B2.fields.filter(f=>f.id!=='wantLocator');
H.reset(); mail.length=0; post(B2);
cl=mail.find(m=>/thank|review is in|policy review/i.test(m.subject||''));
names=(cl.attachments||[]).map(a=>a.getName?a.getName():String(a));
ok(!names.some(n=>/Policy Location Record/i.test(n)), 'no locator when it was not requested', names.join(','));

console.log('\n=== staff copy is unchanged ===');
const st=mail.filter(m=>!/thank|review is in|policy review/i.test(m.subject||''));
ok(st.length>0, 'customer service still receives its email');

/* capture the HTML for a layout check */
const B3=JSON.parse(fs.readFileSync('payload-dhaa.json','utf8'));
let html=null; const real=ctx.toPdf_; ctx.toPdf_=(h,n)=>{ if(/Location Record/.test(n)) html=h; return real(h,n); };
H.reset(); post(B3); ctx.toPdf_=real;
fs.writeFileSync('PROOF-locator.html', html||'');
console.log('\n   captured', (html||'').length, 'bytes of locator HTML');
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail?1:0);
