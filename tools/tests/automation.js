const H=require('./e2e.js'),fs=require('fs');const{ctx,sheets}=H;
const get=p=>JSON.parse(ctx.doGet({parameter:p}).getContent());
let pass=0,fail=0;const ok=(c,m,e)=>{c?pass++:fail++;console.log(`   ${c?'PASS':'** FAIL **'}  ${m}${!c&&e?'  -> '+e:''}`)};

/* stub the trigger service: start with nothing scheduled */
let triggers=[];
ctx.ScriptApp={
  getProjectTriggers:()=>triggers.map(h=>({getHandlerFunction:()=>h})),
  deleteTrigger:t=>{triggers=triggers.filter(h=>h!==t.getHandlerFunction());},
  newTrigger:h=>({timeBased:()=>({atHour:()=>({everyDays:()=>({create:()=>{triggers.push(h);}})})})}),
};

console.log('=== nothing scheduled ===');
ok(ctx.automationOn_()===false,'automationOn_ reports off');
ok(get({action:'ping'}).automation===false,'the ping says automation is off');

console.log('\n=== install it ===');
ctx.installTriggers_();
ok(ctx.automationOn_()===true,'automationOn_ reports on');
ok(get({action:'ping'}).automation===true,'the ping says automation is on');
console.log('   triggers now:',JSON.stringify(triggers));

console.log('\n=== installing twice does not double up ===');
ctx.installTriggers_(); ctx.installTriggers_();
ok(triggers.length===1,'still exactly one daily trigger',String(triggers.length));

console.log('\n=== the wall reports it too ===');
const bank=sheets[ctx.SVC.TEAM_SHEET]||(sheets[ctx.SVC.TEAM_SHEET]=(()=>{ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet(ctx.SVC.TEAM_SHEET);return sheets[ctx.SVC.TEAM_SHEET]})());
bank.appendRow(['Agent','Agent no.','Email','Skills & strengths','Availability','Languages','Active','Portal code']);
bank.appendRow(['Fawaaz','0417','f@x.com','Family','Weekdays','English','Yes','FM7788']);
ok(get({action:'wall',code:'FM7788'}).automation===true,'wall says on');
triggers=[];
ok(get({action:'wall',code:'FM7788'}).automation===false,'wall says off once the trigger is gone');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail?1:0);
