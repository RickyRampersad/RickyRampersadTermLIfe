// The redeploy page and the script must agree on the version.
//
// rickyrampersadbranch.com/redeploy asks the workbook which version is
// answering and compares it with WANT. When WANT lags SCRIPT_VERSION the
// page tells a person their redeploy took while the old code is still
// running — which is exactly what happened on 6 September, three bumps in
// a row. This fails the suite the moment the two drift.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const gs = fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8');
const page = fs.readFileSync(path.join(ROOT, 'redeploy/index.html'), 'utf8');
const setup = fs.readFileSync(path.join(ROOT, 'KPI-SETUP.md'), 'utf8');

const scriptVersion = (gs.match(/var SCRIPT_VERSION = '([^']+)';/) || [])[1];
const want = (page.match(/const WANT="([^"]+)";/) || [])[1];

console.log('\nOne version, everywhere it is named:\n');
ok('the script names its version', !!scriptVersion, 'no SCRIPT_VERSION in KPI.gs');
ok('the redeploy page names the one it expects', !!want, 'no WANT in redeploy/index.html');
ok('and they are the same', scriptVersion === want, scriptVersion + ' vs ' + want);
ok('the version reads as a date with a letter', /^\d{4}-\d{2}-\d{2}[a-z]$/.test(scriptVersion || ''), scriptVersion);
ok('the setup notes say to bump both in one commit', /Bump it in the same commit/.test(setup));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
