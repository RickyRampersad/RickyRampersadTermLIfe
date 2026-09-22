// ServiceSalesforce.gs — the match, and the boundary it must never cross.
//
// Loads the real .gs file with Apps Script's globals shimmed, so this tests
// the code that actually ships rather than a copy of it.
//
//   node tools/tests/sf-match.js
const fs = require('fs'), path = require('path'), vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '..', '..', 'apps-script', 'ServiceSalesforce.gs'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m, e) => { c ? pass++ : fail++; console.log(`   ${c ? 'PASS' : '** FAIL **'}  ${m}${!c && e ? '  -> ' + e : ''}`); };

// Apps Script globals, enough to load the file. Any real call would throw.
const sandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty(){}, deleteProperty(){} }) },
  UrlFetchApp: { fetch: () => { throw new Error('no network in this test'); } },
  SpreadsheetApp: { getUi: () => { throw new Error('no UI in this test'); } },
  Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
  module: { exports: {} }, console,
};
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox);
const G = sandbox;

console.log('=== a date of birth is required, and two signals minimum ===');
ok(G.svcMatchQueries_({ email: 'a@b.com', firstName: 'Marcia', lastName: 'Baptiste' }).length === 0,
   'no date of birth means no query at all');
ok(G.svcMatchQueries_({ dob: '1979-04-12' }).length === 0,
   'a date of birth on its own matches nobody');
const both = G.svcMatchQueries_({ dob: '1979-04-12', email: 'm@example.com', firstName: 'Marcia', lastName: 'Baptiste' });
ok(both.length === 2, 'email+DOB and name+DOB are both tried', 'got ' + both.length);
ok(/Email__c = 'm@example\.com'/.test(both[0].soql) && /Date_Of_Birth__c = 1979-04-12/.test(both[0].soql),
   'the email query pins both the address and the date of birth');
ok(/Birthdate__c = 1979-04-12/.test(both[0].soql),
   'it tries the second date-of-birth field the object carries too');
ok(/LIMIT 25/.test(both[0].soql), 'the query is bounded');

console.log('\n=== a typed surname cannot become a query ===');
const evil = G.svcMatchQueries_({
  dob: '1979-04-12',
  lastName: "O'Brien' OR Name != '",             // a real surname, and an injection
});
ok(evil.length === 1, 'a surname and a date of birth is still a valid pair');
ok(/LAST_NAME__c = 'O\\'Brien\\' OR Name != \\''/.test(evil[0].soql),
   'every quote in it is escaped, so the clause stays one literal', evil[0].soql);
const quotes = (evil[0].soql.match(/(?<!\\)'/g) || []).length;
ok(quotes % 2 === 0, 'the query has balanced unescaped quotes', 'found ' + quotes);
ok(G.svcSoqlLit_("a\\'b") === "a\\\\\\'b", 'a backslash is escaped before the quote, not after');

console.log('\n=== a date of birth must actually be a date ===');
ok(G.svcSoqlDate_('1979-04-12') === '1979-04-12', 'an ISO date passes through');
ok(G.svcSoqlDate_('not a date') === null, 'nonsense is refused');
ok(G.svcMatchQueries_({ dob: "1979-04-12' OR '1'='1", email: 'a@b.com' }).length === 0 ||
   !/OR '1'='1/.test(G.svcMatchQueries_({ dob: "1979-04-12' OR '1'='1", email: 'a@b.com' })[0].soql),
   'a date field cannot smuggle a clause');

console.log('\n=== names split sensibly ===');
ok(G.svcSplitName_('Marcia Anne Baptiste').lastName === 'Baptiste', 'the last word is the surname');
ok(G.svcSplitName_('Baptiste').firstName === '' && G.svcSplitName_('Baptiste').lastName === 'Baptiste',
   'one word is treated as a surname, never as a first name');

console.log('\n=== THE BOUNDARY: nothing found ever reaches the client ===');
const trace = G.svcSummarise_([{
  POLICY__c: 'L0099123', PLAN_NAME__c: 'Term Life 20', Life_Coverage__c: 250000,
  Critical_Illness_Coverage__c: 50000, PREMIUM_OWING__c: 1200, BILLING_PREMIUM__c: 430,
  Writing_Agent__c: 'A Former Agent', Client_ID__c: 'C-55512', Email__c: 'm@example.com',
}], 'email and date of birth');
ok(trace.found === 1 && /L0099123/.test(trace.policyNumbers), 'the branch summary carries the policy');
ok(trace.coverTraced === '$300,000', 'cover is totalled across the benefits', trace.coverTraced);
ok(trace.agentOnRecord === 'A Former Agent', 'the agent on record is surfaced to the branch');

const forClient = G.svcRedactForClient_(trace);
const asText = JSON.stringify(forClient);
const leaks = ['L0099123', 'Term Life 20', '250000', '300,000', '1200', '430',
               'A Former Agent', 'C-55512', 'm@example.com', 'Life_Coverage'];
leaks.forEach(s => ok(asText.indexOf(s) === -1, `the client payload does not contain "${s}"`, asText));
ok(Object.keys(forClient).join() === 'traced,count', 'it answers only whether a record was found', asText);
ok(forClient.traced === true && forClient.count === 1, 'and says so plainly');
ok(JSON.stringify(G.svcRedactForClient_({ ok: false, why: 'Salesforce query failed: SELECT ...' })) === '{"traced":false}',
   'a failure tells the client nothing, not even that it failed');

console.log('\n=== an outage never costs a client their review ===');
ok(G.svcTraceReview_({ dob: '1979-04-12', email: 'a@b.com' }).ok === false,
   'with no credentials it declines rather than throwing');
ok(G.svcTraceReview_({ dob: '1979-04-12' }).configured === false,
   'and says it is simply not configured');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
