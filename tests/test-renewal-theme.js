// The renewal experience's one theme (26 October 2026): renewal/theme.css and
// renewal/theme.js, folded into apps-script/RenewalTheme.html for the Apps
// Script pages. Held here: the copy is never stale, every renewal page carries
// the theme and the blue shield, and none carries the old dark ground, the gold,
// an old webfont or an emoji.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const built = read('apps-script/RenewalTheme.html');
const css = read('renewal/theme.css'), js = read('renewal/theme.js');
ok('RenewalTheme.html is built from theme.css and theme.js, unchanged', built.indexOf(css) > -1 && built.indexOf(js) > -1 && built.length < css.length + js.length + 400);
ok('the theme has no gold and no near-black ground', !/#efc24b|#c9942c|#07131f|#0d2137|#070F26/i.test(css));
ok('every motion stops under reduced motion', /prefers-reduced-motion:reduce\)\{\s*\.rr \*/.test(css.replace(/\n/g, '')));
ok('the theme script parses', (() => { try { new Function(js); return true; } catch (e) { return false; } })());
ok('Code.gs serves the theme to the Apps Script pages', /function rrTheme_\(\)/.test(read('apps-script/Code.gs')));

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2194}-\u{21FF}]/u;
const GAS = ['apps-script/Portal.html', 'apps-script/PropertyPortal.html', 'apps-script/Staff.html', 'apps-script/Board.html'];
const SITE = ['renewal/index.html', 'renewal/motor-policy.html', 'renewal/corporate.html'];
GAS.forEach(f => {
  const s = read(f);
  ok(f + ' takes the theme', s.indexOf('<?!= rrTheme_() ?>') > -1);
  ok(f + ' carries the blue shield, never the gold one', /orphan-transition\/board-mark\.png/.test(s) && !/logo-mark\.(png|svg)/.test(s));
  ok(f + ' has no old webfont, no gold, no near-black ground, no emoji', !/fonts\.googleapis/.test(s) && !/#efc24b|#c9942c|#07131f|#0d2137/i.test(s) && !EMOJI.test(s), (s.match(EMOJI) || [''])[0]);
});
SITE.forEach(f => {
  const s = read(f);
  ok(f + ' links the theme', /href="theme\.css"/.test(s) && /src="theme\.js"/.test(s));
  ok(f + ' carries the blue shield', /orphan-transition\/board-mark\.png/.test(s));
  ok(f + ' has no old webfont, no gold, no near-black ground, no emoji', !/fonts\.googleapis/.test(s) && !/#efc24b|#c9942c|#07131f|#0d2137/i.test(s) && !EMOJI.test(s), (s.match(EMOJI) || [''])[0]);
});
const find = (read('apps-script/Code.gs').match(/function findPage_[\s\S]*?\n}\n/) || [''])[0];
ok('Track your renewal takes the theme and the blue shield', /rrTheme_\(\)/.test(find) && /board-mark\.png/.test(find) && !/#07131f|#efc24b|fonts\.googleapis/.test(find));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
