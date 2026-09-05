const H=require('./e2e.js'),fs=require('fs');const{ctx,sheets}=H;
const post=p=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(p)}}).getContent());
const get=p=>JSON.parse(ctx.doGet({parameter:p}).getContent());
let pass=0,fail=0;const ok=(c,m,e)=>{c?pass++:fail++;console.log(`   ${c?'PASS':'** FAIL **'}  ${m}${!c&&e?'  -> '+e:''}`)};

const bank=sheets[ctx.SVC.TEAM_SHEET]||(sheets[ctx.SVC.TEAM_SHEET]=(()=>{ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet(ctx.SVC.TEAM_SHEET);return sheets[ctx.SVC.TEAM_SHEET]})());
bank.appendRow(['Agent','Agent no.','Email','Skills & strengths','Availability','Languages','Active','Portal code']);
[['Fawaaz','0417','f@x.com','Family','Weekdays','English','Yes','FM7788'],
 ['Renee','0422','r@x.com','Group','Weekdays','English','Yes','RS1122'],
 ['Dinesh','0431','d@x.com','Claims','Evenings','English','Yes','DP3344']].forEach(r=>bank.appendRow(r));

console.log('=== unset target: it says so, it does not invent one ===');
let w=get({action:'wall',code:'FM7788'});
ok(w.campaign.set===false,'campaign.set is false');
ok(w.campaign.pct===0 && w.campaign.target===0,'no fabricated target or percentage');
ok(w.campaign.name==='The Orphan Campaign','the campaign is still named');

console.log('\n=== set the target and file some reviews ===');
ctx.SVC.CAMPAIGN={name:'The Orphan Campaign',agreed:'Agreed at the branch meeting',
  book:1200,target:300,endsOn:'2026-12-31',perAgentWeek:5};
const D=JSON.parse(fs.readFileSync('payload-dhaa.json','utf8'));
['Fawaaz','Fawaaz','Fawaaz','Renee'].forEach((who,i)=>{
  const B=JSON.parse(JSON.stringify(D)); B.core.clientName='Client '+i;
  B.sentBy={name:who,email:'x@x.com'}; H.reset(); post(B);
});
w=get({action:'wall',code:'FM7788'});
const C=w.campaign;
console.log('   campaign:',JSON.stringify({set:C.set,book:C.book,target:C.target,reached:C.reached,pct:C.pct,
  daysLeft:C.daysLeft,endsOn:C.endsOn,week:C.week,needWeek:C.needWeek,onTrack:C.onTrack,met:C.agentsMet}));
ok(C.set===true,'campaign is configured');
ok(C.reached===4,'every filed review counts toward the campaign',String(C.reached));
ok(C.week===4,'and toward this week',String(C.week));
ok(C.remaining===296,'remaining is target minus reached',String(C.remaining));
ok(C.daysLeft!==null && C.endsOn==='31 December','the deadline is read and formatted',JSON.stringify([C.daysLeft,C.endsOn]));
ok(typeof C.needWeek==='number' && C.needWeek>0,'a required weekly pace is derived',String(C.needWeek));
ok(C.onTrack===false,'behind, because 4 is under the pace needed');

console.log('\n=== per agent ===');
const fa=w.agents.find(a=>a.name==='Fawaaz'), di=w.agents.find(a=>a.name==='Dinesh');
console.log('   Fawaaz week:',fa.week,'| Dinesh week:',di.week);
ok(fa.week===3,'the agent who filed three is credited three',String(fa.week));
ok(di.week===0,'the agent who filed none is credited none',String(di.week));
ok(C.agentsShort.some(a=>a.name==='Dinesh' && a.needs===5),'Dinesh is listed as needing the full five');
ok(C.agentsMet===0,'nobody has hit five yet',String(C.agentsMet));

console.log('\n=== no client detail leaks onto the campaign block ===');
ok(JSON.stringify(C).indexOf('@')<0 && JSON.stringify(C).indexOf('Client ')<0,'names and emails stay off it');
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail?1:0);
