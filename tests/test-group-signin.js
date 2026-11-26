// The group's sign-in: its list bill and its code. Run: node tests/test-group-signin.js
// Invented list bills and codes only; nothing here is a real group's.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'GroupClients.gs'), 'utf8');

function fn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error('unbalanced ' + name);
}

const tries = {};
const ctx = {
  GCM: { TRIES: 8, MIN_CODE: 10 },
  tTries_: k => tries[k] || 0, tTriesAdd_: k => { tries[k] = (tries[k] || 0) + 1; }, tTriesClear_: k => { delete tries[k]; },
};
vm.createContext(ctx);
['gcmBillKey_', 'gcmCodeKey_', 'gcmSignKey_', 'gcmSignMatch_', 'gcmClientAuth_'].forEach(n => vm.runInContext(fn(n), ctx));

const reg = [
  { name: 'Harbour Point Logistics Ltd', bills: ['01_HARPO00', 'H123', 'TGM 9001'], code: 'HARB-ABCD-EF12-GH34' },
  { name: 'Coral Bay Traders', bills: ['01_CORBA00'], code: 'CORA-WXYZ-9876-QRST' },
  { name: 'No list bill yet', bills: [], code: 'NOLB-AAAA-BBBB-CCCC' },
].map(g => Object.assign(g, { billKeys: g.bills.map(ctx.gcmBillKey_) }));
const L = { reg };

let pass = 0, fail = 0;
function ok(cond, what) { if (cond) pass++; else { fail++; console.log('FAIL:', what); } }
const auth = (lb, code) => ctx.gcmClientAuth_(L, lb, code);
const who = (lb, code) => { const a = auth(lb, code); return a.ok ? a.g.name : ''; };

ok(who('01_HARPO00', 'HARB-ABCD-EF12-GH34') === 'Harbour Point Logistics Ltd', 'list bill as on the register');
ok(who('01_HARPO001', 'HARB-ABCD-EF12-GH34') === 'Harbour Point Logistics Ltd', 'Group ID as printed on the health bill');
ok(who('01 harpo 001', 'harb abcd ef12 gh34') === 'Harbour Point Logistics Ltd', 'spaces and lower case');
ok(who('0l_HARP0001'.replace('l', '1'), 'HARB-ABCD-EF12-GH34') === 'Harbour Point Logistics Ltd', 'a zero typed for the letter O');
ok(who('H123', 'HARB-ABCD-EF12-GH34') === 'Harbour Point Logistics Ltd', 'the branch list bill');
ok(who('TGM9001', 'HARB-ABCD-EF12-GH34') === 'Harbour Point Logistics Ltd', 'the life list bill');
ok(who('H1231', 'HARB-ABCD-EF12-GH34') === '', 'a trailing 1 is only for the health form');
ok(who('TGM90011', 'HARB-ABCD-EF12-GH34') === '', 'a trailing 1 on a life list bill opens nothing');
ok(who('01_HARPO002', 'HARB-ABCD-EF12-GH34') === '', 'another digit opens nothing');
ok(who('01_HARPO0011', 'HARB-ABCD-EF12-GH34') === '', 'two extra digits open nothing');
ok(who('01_HARPO001', 'CORA-WXYZ-9876-QRST') === '', 'one group\'s bill with another\'s code');
ok(who('01_CORBA001', 'HARB-ABCD-EF12-GH34') === '', 'the other way round');
ok(who('01_CORBA001', 'CORA-WXYZ-9876-QRST') === 'Coral Bay Traders', 'second group by its printed Group ID');
ok(who('', 'NOLB-AAAA-BBBB-CCCC') === '', 'a group with no list bill cannot sign in');
ok(/match/.test(auth('01_HARPO001', 'WRONG-CODE-0000').error), 'a wrong code says the pair does not match');
for (let i = 0; i < 9; i++) auth('01_CORBA00', 'WRONG-CODE-' + i);
ok(/Too many tries/.test(auth('01_CORBA00', 'CORA-WXYZ-9876-QRST').error || ''), 'eight wrong tries close the list bill');

console.log(fail ? `${pass} passed, ${fail} failed` : `${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
