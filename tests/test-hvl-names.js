// The health bill against the life bill (26 November 2026): one person spelt a letter or two apart on Guardian's two
// bills, or with a first name the reader lost, is one person; two people are still two. Every name is invented.
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0;
const ok = (l, c) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l); if (!c) fails++; };
const sb = { console, Math, JSON, String, Number, Object, Array, RegExp, Error, Date };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/GroupBilling.gs'), 'utf8'), sb, { filename: 'GroupBilling.gs' });
const same = sb.gblSameMember_;
ok('a first name one letter apart', same('KOWLESHAR, MIRELEE', 'KOWLESHAR ; MIRELIE'));
ok('a surname two letters apart (six letters or more)', same('SOOKMARAN, DEVI', 'SUKMARAN ; DEVI'));
ok('a long double surname with the first name lost', same('FIELDSTONE-HARGROVE,', 'FIELDSTONE HARGROVE ; ANNALISE'));
ok('a hyphen against a space', same('SAMUEL-CROFT, HELENA', 'SAMUEL CROFT ; HELENA'));
ok('what gblSamePerson_ already took still matches', same('BROOKS, CINDY-ANN NORVA', 'BROOKS ; CINDY-ANN'));
ok('two first names that are not near stay apart', !same('FIELDER, DANIEL', 'FIELDER ; ANGELO'));
ok('a surname that is only part of another stays apart', !same('MARKS, KION', 'OTHER-MARKS ; LORNA'));
ok('the first name in the surname field stays apart', !same('BABCOCK-RAMLAL, USHA', 'BABCOCK ; RAMLAL'));
ok('two family members stay apart', !same('LEGRAND, MIKHAIL', 'LEGRAND ; MELISSA'));
ok('a short surname a letter apart is not the same', !same('ALI, ANNA', 'ALO ; ANNA'));
ok('a short surname with no first name matches nobody', !same('ALI,', 'ALI ; ANNA'));
ok('one letter on a four-letter first name', same('PERSAUD, JOHN', 'PERSAUD ; JOHM'));
ok('the subject-line matcher is unchanged', !sb.gblSamePerson_('KOWLESHAR, MIRELEE', 'KOWLESHAR ; MIRELIE'));
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
