// The household question — captured, filed, briefed, and never handed back.
//
// Loads the real Service.gs with Apps Script's globals shimmed, and reads the
// real review.html, so this tests what ships rather than a copy of it.
//
//   node tools/tests/household.js
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GS   = fs.readFileSync(path.join(ROOT, 'apps-script', 'Service.gs'), 'utf8');
const FORM = fs.readFileSync(path.join(ROOT, 'donthaveanagent', 'review.html'), 'utf8');
const SVC  = fs.readFileSync(path.join(ROOT, 'service', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m, e) => { c ? pass++ : fail++; console.log(`   ${c ? 'PASS' : '** FAIL **'}  ${m}${!c && e ? '  -> ' + e : ''}`); };

// Apps Script globals, enough to load the file. Any real call would throw.
const sandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error('no sheet in this test'); },
                    getUi: () => { throw new Error('no UI in this test'); } },
  UrlFetchApp: { fetch: () => { throw new Error('no network in this test'); } },
  MailApp: {}, GmailApp: {}, DriveApp: {}, HtmlService: {}, ContentService: {}, ScriptApp: {},
  Session: { getScriptTimeZone: () => 'America/Port_of_Spain' },
  Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
  module: { exports: {} }, console,
};
vm.createContext(sandbox);
vm.runInContext(GS, sandbox);
const G = sandbox;

// A review as the front end actually posts it.
const sub = (householdOther, householdWho, extra) => ({
  core: { clientName: 'A Client', lastContact: 'Within the last year' },
  fields: [].concat(
    householdOther === undefined ? [] : [{
      section: 'Your records', id: 'householdOther', flag: 'household',
      label: 'Does anyone else in your home hold a policy with this same company?', value: householdOther }],
    householdWho === undefined ? [] : [{
      section: 'Your records', id: 'householdWho', flag: 'household',
      label: 'Who, and how are they related to you?', value: householdWho }],
    extra || []),
});

console.log('=== the form asks it, in the client\'s own step ===');
const qBlock = FORM.slice(FORM.indexOf('id: "householdOther"'), FORM.indexOf('id: "otherPolicies"'));
ok(/id: "householdOther"/.test(FORM) && /id: "householdWho"/.test(FORM), 'both household questions exist on the form');
ok((qBlock.match(/flag: "household"/g) || []).length === 2, 'both carry the household flag, not the records flag');
ok(/showIf: \{ id: "householdOther", not: "No" \}/.test(qBlock), 'the follow-up only appears when they did not say No');
ok(FORM.indexOf('id: "householdOther"') > FORM.indexOf('id: "otherGuardian"') &&
   FORM.indexOf('id: "householdOther"') < FORM.indexOf('id: "otherPolicies"'),
   'it sits with the other policy questions, in Your records');
ok(/flag: q\.flag \|\| ""/.test(FORM), 'the front end forwards the flag with the answer');

console.log('\n=== both front doors ask it, or the column lies ===');
// A Household column populated by only one of the two forms cannot tell "no
// household" apart from "we never asked this person".
ok(/id: "householdOther"/.test(SVC) && /id: "householdWho"/.test(SVC),
   'the branch Service Questionnaire asks it too');
ok((SVC.slice(SVC.indexOf('id: "householdOther"'), SVC.indexOf('id: "otherCompany"'))
      .match(/flag: "household"/g) || []).length === 2, 'and flags both the same way');
ok(/flag: q\.flag \|\| ""/.test(SVC), 'the branch form forwards the flag too');

// Form 2000-03-147 is reproduced exactly and page 1 must fit one US Legal
// sheet. A question with no `paper:` key cannot reach page 1 — it goes to the
// addendum — so this is the assertion that keeps the printed form safe.
const hhBlock = SVC.slice(SVC.indexOf('id: "householdOther"'), SVC.indexOf('id: "otherCompany"'));
ok(!/paper:/.test(hhBlock), 'neither household question is mapped onto the printed form');
ok((SVC.match(/paper: "/g) || []).length === 46,
   'the printed form still carries exactly its 46 mapped questions',
   String((SVC.match(/paper: "/g) || []).length));

console.log('\n=== what lands in the sortable column ===');
ok(G.householdSummary_(sub()) === '', 'unanswered files as blank, never "undefined"');
ok(G.householdSummary_(sub('No')) === 'No', 'a plain No files as No');
ok(G.householdSummary_(sub('Yes', 'my wife Anne, my son Mark')) === 'Yes — my wife Anne, my son Mark',
   'a Yes carries who they named', G.householdSummary_(sub('Yes', 'my wife Anne, my son Mark')));
ok(G.householdSummary_(sub('Not sure', 'maybe my mother')) === 'Not sure — maybe my mother',
   'Not sure is kept as Not sure, not rounded up to Yes');
ok(G.householdSummary_(sub('Yes')) === 'Yes', 'a Yes with nobody named still files as Yes');
ok(G.householdSummary_(sub('Yes', '  my   wife\n  Anne ')) === 'Yes — my wife Anne', 'whitespace is tidied');
ok(G.householdSummary_(sub('Yes', 'x'.repeat(400))).length <= 210, 'a runaway answer is capped');
ok(G.householdSummary_({}) === '', 'a submission with no fields at all does not throw');

console.log('\n=== it must not change the priority of the review ===');
ok(G.computePriority_(sub('Yes', 'my wife Anne')) === 'NORMAL',
   'a household answer on its own stays NORMAL — it is not an action to process',
   G.computePriority_(sub('Yes', 'my wife Anne')));
ok(!/record change/.test(G.priorityReason_(sub('Yes', 'my wife Anne'))),
   'and it is never counted as a record change to process');
const withRec = sub('Yes', 'my wife Anne', [{ section: 'Your records', id: 'newAddress', flag: 'records',
  label: 'Your correct address', value: '12 Someplace' }]);
ok(G.computePriority_(withRec) === 'ACTION', 'a real record change still raises it, exactly as before');

console.log('\n=== the agent reads it before they call ===');
ok(/f\.flag === 'household'/.test(GS), 'the brief has a branch for the household flag');
ok(/badge_\('HOUSEHOLD'/.test(GS), 'and gives it its own badge');

console.log('\n=== the worklist carries a column to sort a book by ===');
ok(/'Household',/.test(GS), 'Household is in the sheet header');
ok(/'Household': householdSummary_\(body\)/.test(GS), 'and every row writes it');

console.log('\n=== THE BOUNDARY: it is capture only ===');
const body = G.householdSummary_.toString();
ok(!/UrlFetchApp|svcSf|Salesforce|CLIENT_PORTFOLIO/i.test(body),
   'the summary reads the client\'s answer and nothing else — no Salesforce call');
// Comments are allowed to name the Salesforce objects — explaining why we do
// not touch them is the point. Code is not, so strip comments before looking.
const CODE = GS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/Relationship_Group|Family_Role/.test(CODE),
   'nothing in the backend code writes to the Salesforce household objects',
   (CODE.match(/.*(Relationship_Group|Family_Role).*/) || [])[0]);
// The review page is public and unauthenticated: what we know must not come back.
const redact = (GS.match(/function svcRedactForClient_[\s\S]*?\n\}/) || [''])[0];
ok(!/household/i.test(redact), 'the client payload has no household in it');
ok(!/householdSummary_|Household/.test((GS.match(/function clientPayload_[\s\S]*?\n\}/) || [''])[0] || ''),
   'and nothing hands it to the browser');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
