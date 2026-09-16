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
const igs = fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8');
const page = fs.readFileSync(path.join(ROOT, 'redeploy/index.html'), 'utf8');
const setup = fs.readFileSync(path.join(ROOT, 'KPI-SETUP.md'), 'utf8');

const scriptVersion = (gs.match(/var SCRIPT_VERSION = '([^']+)';/) || [])[1];
const want = (page.match(/const WANT="([^"]+)";/) || [])[1];

console.log('\nOne version, everywhere it is named:\n');
ok('the script names its version', !!scriptVersion, 'no SCRIPT_VERSION in KPI.gs');
ok('the redeploy page names the one it expects', !!want, 'no WANT in redeploy/index.html');
ok('and they are the same', scriptVersion === want, scriptVersion + ' vs ' + want);
ok('the version reads as a date with a letter', /^\d{4}-\d{2}-\d{2}[a-z]$/.test(scriptVersion || ''), scriptVersion);
ok('the setup notes say to bump both in one commit', /Bump it in the same\s+commit/.test(setup));

// The wall's data script is a second file with a second build, and on 8
// September the tracker was current while it was a night behind — every
// light green, every wall screen empty. The page has to know both.
const intelVersion = (igs.match(/var INTEL_VERSION = '([^']+)';/) || [])[1];
const wantIntel = (page.match(/const WANT_INTEL="([^"]+)";/) || [])[1];
console.log('\nAnd the wall\'s data script, separately:\n');
ok('Intelligence.gs names its build', !!intelVersion, 'no INTEL_VERSION');
ok('the redeploy page names the one it expects', !!wantIntel, 'no WANT_INTEL in redeploy/index.html');
ok('and they are the same', intelVersion === wantIntel, intelVersion + ' vs ' + wantIntel);
ok('the page links both files to paste', /apps-script\/KPI\.gs/.test(page) && /apps-script\/Intelligence\.gs/.test(page));

/* THE WALL ITSELF, which is the screen a stale deployment is actually seen on.
   Twice in September the birthday strip named the wrong people on two
   consecutive mornings, both times because the fix was written and never
   pasted, and nothing on screen said so: the data rebuilds nightly, so the
   wall read "built today" while running three-week-old logic. all.html now
   pings intel.ping and puts a red bar across the foot when the served build
   is not the one these screens were written for. That bar is only true if
   WANT_SCRIPT is kept level with INTEL_VERSION, so it is pinned here — a
   staleness warning that is itself stale is worse than none. */
const wall = fs.readFileSync(path.join(ROOT, 'intelligence/wall/all.html'), 'utf8');
const wantScript = (wall.match(/var WANT_SCRIPT = '([^']+)';/) || [])[1];
console.log('\nAnd the wall says so on screen when the script is behind:\n');
ok('the wall names the build it was written for', !!wantScript, 'no WANT_SCRIPT in all.html');
ok('and it is the same build', intelVersion === wantScript, intelVersion + ' vs ' + wantScript);
ok('it asks the script rather than assuming', /action:\s*'intel\.ping'/.test(wall));
ok('there is somewhere to show it', /id="stale"/.test(wall) &&
   /id="staleGot"/.test(wall) && /id="staleWant"/.test(wall));
ok('it names both builds in the bar, not just "out of date"',
   /staleGot'\)\.textContent = got/.test(wall) && /staleWant'\)\.textContent = WANT_SCRIPT/.test(wall));
ok('it hides itself again once the paste is done', /el\.hidden = !bad/.test(wall));
ok('it tells the reader what to actually do',
   /Paste Intelligence\.gs/.test(wall) && /New version/.test(wall));
ok('a feed that cannot be reached does not raise it',
   /\.catch\(function \(\) \{\}\)/.test(wall));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
