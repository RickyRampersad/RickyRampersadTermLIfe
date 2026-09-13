// The address key, against the real spellings it has to survive.
//
// Every string below is a genuine Guardian mailing address, copied from one
// agent's book. Exact matching on these found 3 shared addresses; the key is
// supposed to find 14. Loads the real .gs with Apps Script's globals shimmed.
//
//   node tools/tests/address-key.js
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC  = fs.readFileSync(path.join(ROOT, 'apps-script', 'ServiceSalesforce.gs'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m, e) => { c ? pass++ : fail++; console.log(`   ${c ? 'PASS' : '** FAIL **'}  ${m}${!c && e ? '  -> ' + e : ''}`); };

const sandbox = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
  UrlFetchApp: { fetch: () => { throw new Error('no network in this test'); } },
  SpreadsheetApp: { getUi: () => { throw new Error('no UI in this test'); } },
  Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
  module: { exports: {} }, console,
};
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox);
const K = sandbox.svcAddrKey_;

// Real variants that are one house. Each group must collapse to one key.
const SAME = [
  ['8 Raphia Drive, Roystonia, Couva', [
    '# 8 RAPHIA DRIVE  \r\nROYSTONIA', '#8 Raphia Drive Roystonia',
    '8 RAPHIA DRIVE \r\nROYSTONIA', '8 RAPHIA DRIVE   \r\nROYSTONIA']],
  ['64 Lapwing Crescent, Edinburgh', [
    '#64 LAPWING  EDINBURGH 50', '#64 LAPWING CRESENT EDINB',
    '#64 LAPWING CRESENT EDINBURGH', '64 LAPWING CRESENT EDINBURGH']],
  ['115 Edinburgh Gardens', ['115 EDINBURGH GARDENS', '115 EDINBURGH GARDENS   \r\nN/A']],
  ['20 Montrose Place', ['#20 MONTROSE PLACE \r\nLANGE PARK', '#20 MONTROSE PLACE       \r\nLANGE PARK']],
  ['128 Immortelle Crescent', ['128 IMMORTELLE CRESCENT',
    '128 IMMORTELLE CRESCENT     \r\nNORTH EASTERN SETTLEMENT    \r\nOJOE ROAD']],
  ['22 Seventh Street', ['22 SEVENTH ST', '22 SEVENTH STREET']],
  ['26 Keskidee Drive', ['#26 KESKIDEE DRIVE MALONE, D`ABADIE, AROUCA, TRINIDAD & TOBAGO,',
    '26 KESKIDEE DRIVE, MALONEY,']],
  ['LP 129 Little Cora Road', ['LP 129 LITTLE CORA ROAD      \r\nCUNARIPO',
    'LP 129 LITTLE CORA ROAD          \r\nCUNARIPO']],
  ['LP 145 Red Hill', ['LP 145   \r\nRED HILL', 'LP 145 RED HILL']],
  ['LP 4/32 Adrian Trace', ['LP 4/32 ADRIAN TRACE  \r\nMOUNT PLEASANT',
    'LP 4/32 ADRIAN TRACE     \r\n MOUNT PLEASANT']],
  ['LP 53 Pope Avenue', ['LP 53 POPE AVE    \r\nTUMPUNA RD', 'LP53 POPE AVENUE    \r\nTUMPUNA ROAD']],
];

console.log('=== one house, however it was typed ===');
SAME.forEach(([name, variants]) => {
  const keys = variants.map(K);
  const uniq = [...new Set(keys)];
  ok(uniq.length === 1 && uniq[0] !== '', `${name} — ${variants.length} spellings, one key`,
     JSON.stringify(keys));
});

console.log('\n=== a short first word is a prefix, not the street ===');
ok(K('7 MT HOPE ROAD EXTENSION') === '7 MT HOPE', 'MT HOPE is kept whole', K('7 MT HOPE ROAD EXTENSION'));
ok(K('15 ST. JOHN STREET') === '15 ST JOHN', 'ST JOHN is kept whole', K('15 ST. JOHN STREET'));
ok(K('7 MT HOPE ROAD') !== K('7 MT PLEASANT ROAD'), 'and two different MT streets stay apart');

console.log('\n=== different houses must not collide ===');
ok(K('36 MISSION ROAD') !== K('181 MISSION ROAD   \r\nPREYSAL VILLAGE'), 'same street, different numbers');
ok(K('22 SEVENTH STREET') !== K('28 SEVENTH STREET'), 'neighbours are not the same house');
ok(K('LP 53 POPE AVENUE') !== K('LP 56 DENNIS STREET        \r\nCLEAVER ROAD'), 'unrelated addresses differ');
ok(K('110 SADDLE ROAD') !== K('11 RAILWAY ROAD'), 'a number prefix is not a match');

console.log('\n=== it refuses rather than guesses ===');
ok(K('') === '', 'nothing in, nothing out');
ok(K(null) === '' && K(undefined) === '', 'null and undefined do not throw');
ok(K('PINTO ROAD') === '', 'no house number means no key');
ok(K('BRICKFIELD ROAD') === '', 'a street on its own is not an address');
ok(K('ADELPHI ESTATE  \r\nMASON HALL') === '', 'an estate name alone is not an address');
ok(K('MALONEY HIGH RISE-BLDG 2') === '', 'a building with no number is not keyed');

console.log('\n=== the prefixes Trinidad addresses actually use ===');
ok(K('LP 145 RED HILL') === '145 RED HILL', 'LP is dropped, its number kept', K('LP 145 RED HILL'));
ok(K('L P 42 JEFFERS LANE') === '42 JEFFERS', 'L P spaced apart is still LP', K('L P 42 JEFFERS LANE'));
ok(K('LOT 65 FOURTH STREET      \r\nTUMPUNA ROAD') === '65 FOURTH', 'LOT is dropped');
ok(K('EP #59 SAMNATH STREET\r\nFIVE RIVERS') === '59 SAMNATH', 'EP is dropped');
ok(K('$18 2ND STREET EAST\r\nCASSLETON AVENUE') === '18 2ND STREET', 'a stray $ does not break it',
   K('$18 2ND STREET EAST\r\nCASSLETON AVENUE'));

console.log('\n=== a unit letter is not a street name ===');
// Found by running this over a real book: both of these keyed to "12 C",
// merging a Gasparillo house with a Point Fortin apartment.
ok(K('12 C GUARACARA STREET') !== K('BUILDING 12 UNIT C           \r\nLAKEVIEW HOUSING DEVELOP'),
   'a Gasparillo house and a Point Fortin flat are not one household',
   K('12 C GUARACARA STREET') + ' vs ' + K('BUILDING 12 UNIT C           \r\nLAKEVIEW HOUSING DEVELOP'));
ok(K('12 C GUARACARA STREET') === '12 C GUARACARA', 'the key runs on to the real street word');
ok(K('LP 22/2 SEECHARAN STREET      \r\nPERSEVERANCE/ WATERLOO') === '22/2 SEECHARAN',
   'a slashed house number keeps both halves and the street',
   K('LP 22/2 SEECHARAN STREET      \r\nPERSEVERANCE/ WATERLOO'));
ok(K('LP 4/32 ADRIAN TRACE  \r\nMOUNT PLEASANT') === '4/32 ADRIAN', 'and so does 4/32');
ok(K('LP 22/2 SEECHARAN STREET') !== K('LP 22/3 SEECHARAN STREET'), 'neighbours in a slashed pair differ');

console.log('\n=== the guard that stops a bank becoming a household ===');
ok(/HH_MAX/.test(SRC) && /RecordType/.test(SRC), 'the household read checks the record type and a size cap');
const hh = String(sandbox.svcHouseholdFor_);
ok(/!==\s*'HOUSEHOLD'/.test(hh), 'anything not on the HOUSEHOLD record type is refused');
ok(/HH_MAX/.test(hh), 'and an implausible member count is refused too');
ok(sandbox.svcHouseholdFor_(null) === null, 'no account id returns nothing, without a query');

console.log('\n=== THE BOUNDARY: none of it reaches the client ===');
const red = sandbox.svcRedactForClient_({ ok: true, found: 2, householdName: 'SMITH, JOHN HH',
  householdMembers: 4, addressKey: '8 RAPHIA', policyNumbers: 'L0099123' });
const asText = JSON.stringify(red);
['SMITH', 'HH', 'RAPHIA', 'L0099123', '4'].forEach((leak) =>
  ok(asText.indexOf(leak) < 0, `the client payload does not contain "${leak}"`, asText));
ok(!/Account|household|address/i.test(String(sandbox.svcRedactForClient_)),
   'the boundary function does not even mention them');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
