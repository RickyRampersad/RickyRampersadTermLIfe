// Who the branch's e-mail says it is from.
//
// Run: node tests/test-sender.js
const { makeEnv } = require('./harness');
const env = makeEnv();

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (cond ? '' : '  — ' + (extra === undefined ? '' : JSON.stringify(extra)))); if (!cond) fails++; };

const sent = [];
env.MailApp = { sendEmail: m => sent.push(m) };

console.log('\nThe name on every e-mail:\n');
env.rrbMail_({ to: 'someone@example.com', subject: 'A report', htmlBody: '<p>hi</p>' });
ok('it sends', sent.length === 1, sent.length);
ok('signed by the branch, not by whoever owns the script',
   sent[0].name === 'Ricky Rampersad Branch', sent[0].name);
ok('and nothing else about it changes',
   sent[0].to === 'someone@example.com' && sent[0].subject === 'A report' && sent[0].htmlBody === '<p>hi</p>', sent[0]);

env.rrbMail_({ to: 'a@example.com', subject: 'Already named', htmlBody: 'x', name: 'Branch Intelligence' });
ok('a name already given is left alone', sent[1].name === 'Branch Intelligence', sent[1].name);

console.log('\nRenaming it without a paste:\n');
env.PropertiesService.getScriptProperties().setProperty('KPI_FROM_NAME', 'Chaguanas Branch');
env.rrbMail_({ to: 'a@example.com', subject: 'x', htmlBody: 'x' });
ok('the script property wins', sent[2].name === 'Chaguanas Branch', sent[2].name);
env.PropertiesService.getScriptProperties().deleteProperty('KPI_FROM_NAME');

console.log('\nThe address it goes out from:\n');
ok('without a verified alias it stays the account\'s own, and nothing claims otherwise',
   env.fromAlias_() === '' && sent[0].from === undefined, sent[0].from);

console.log('\nEvery report goes through it:\n');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../apps-script/KPI.gs', 'utf8');
const direct = (src.match(/MailApp\.sendEmail\(/g) || []).length;
ok('one call to MailApp in the whole file, inside the sender itself', direct === 1, direct);
ok('and seven reports routed through it', (src.match(/rrbMail_\(\{/g) || []).length === 7);

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
