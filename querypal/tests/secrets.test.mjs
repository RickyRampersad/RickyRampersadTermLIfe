/* Nothing that unlocks the branch may sit in a file the public can fetch.

   On 9 October 2026, hours after the site was posted on Facebook, the branch
   master codes were found in plain text in two published pages — index.html,
   as an offline sign-in bypass so a slow Apps Script could never lock the
   branch out, and 404.html, a stale 310 KB copy of the whole app nobody had
   noticed was still being served.

   They were not decoration. The backend honoured them:

     GET …/exec?action=agentauth&num=<code>
       -> {"ok":true,"name":"Ricky Rampersad","role":"branch"}
     GET …/exec?action=myqueries&code=<code>
       -> 99 cases, every client name, every agent, every request type

   So anyone who opened View Source on a public insurance site could read the
   branch's whole case log. A credential in the page is a published
   credential, whatever it is guarding — sign-in is the server's job alone.

   Run: node secrets.test.mjs
*/
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SITE = path.join(HERE, '..');

/* Everything a drag-and-drop deploy puts on the web and a browser can fetch
   by name — the WHOLE tree, subfolders included.

   This list used to be the top level only, and only a few extensions. It was
   wrong twice over, and on 11 October 2026 it was caught passing while seven
   files in the deploy folder carried the codes: PATCH-INSTRUCTIONS.md and six
   test fixtures.

     - It skipped `tests/` on the belief that the `_redirects` catch-all
       (`/*  /index.html  200`) swallowed it. It does not. A 200 rewrite only
       applies where no real file matches, so every real file wins. The proof
       was already in hand: 404.html was reachable at querymypolicy.com/404.html,
       which is exactly how its stale 310 KB app copy was found.
     - It skipped `.md` and `.gs`, so the patch instructions and the backend
       source were never looked at.

   If a file ends up in the folder that gets dragged onto Netlify, it is
   public. That is the only rule that matters here. */
const EXT = /\.(html|js|mjs|cjs|json|webmanifest|txt|css|md|gs|svg)$/i;
const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(d => {
    const rel = base ? base + '/' + d.name : d.name;
    if (d.isDirectory()) return walk(path.join(dir, d.name), rel);
    return (EXT.test(d.name) || d.name === '_redirects') ? [rel] : [];
  });
const PUBLISHED = walk(SITE);

/* A credential is anything that, handed to the backend, answers role:branch.
   Keep the patterns shaped, not literal — a test that names the code would be
   one more file with the code in it. */
const SHAPES = [
  { what: 'a six-digit branch code used as a sign-in literal',
    rx: /===\s*'[0-9]{6}'|==\s*'[0-9]{6}'|toUpperCase\(\)\s*===\s*'[0-9]{6}'/ },
  { what: 'an RRB-prefixed shared master code',
    rx: /'RRB[0-9]{4}'|"RRB[0-9]{4}"|\?code=RRB[0-9]{4}/ },
  { what: 'a client-side call to gatePass with a hard-coded branch role',
    rx: /gatePass\([^)]*'branch'\s*\)/ },

  /* The shapes below are what a test fixture looks like. A fixture is still a
     working credential if it is byte-identical to the real one, and a fixture
     in the deploy folder is as public as the app. Tests need *a* branch code,
     never *the* branch code — QP_TEST_BRANCH_CODE supplies it. */
  { what: 'a six-digit code assigned as a sign-in value',
    rx: /\b(code|num|pwd)\s*:\s*'[0-9]{6}'/ },
  { what: 'an AGENT_ACCESS entry keyed on a six-digit code',
    rx: /'[0-9]{6}'\s*:\s*\[/ },
  { what: 'a sign-in form filled with a six-digit code',
    rx: /\.fill\(\s*'#g[A-Za-z]+'\s*,\s*'[0-9]{6}'\s*\)/ },
  { what: 'a six-digit code passed straight to a sign-in helper',
    rx: /(agentAuth\w*|authSecure_|findAgent_)\(\s*'[0-9]{6}'/ },
];

let fail = 0;
const t = (label, ok, detail) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (!ok && detail ? '\n          ' + detail : ''));
  if (!ok) fail++;
};

console.log('\n' + PUBLISHED.length + ' published files scanned\n');

for (const shape of SHAPES) {
  const hits = PUBLISHED.filter(f => shape.rx.test(fs.readFileSync(path.join(SITE, f), 'utf8')));
  t('no published file carries ' + shape.what,
    hits.length === 0,
    hits.length ? 'found in: ' + hits.join(', ') : '');
}

/* The specific mistake: a sign-in path that succeeds without the server. */
const offline = PUBLISHED.filter(f => {
  const s = fs.readFileSync(path.join(SITE, f), 'utf8');
  const i = s.indexOf('function gateOffline');
  if (i < 0) return false;
  const body = s.slice(i, i + 700);
  return /gatePass\(/.test(body);
});
t('the offline sign-in path cannot let anybody in',
  offline.length === 0,
  offline.length ? 'gateOffline calls gatePass in: ' + offline.join(', ')
                 : '');

/* 404.html was a whole second app. A 404 page has no business being large. */
const p404 = path.join(SITE, '404.html');
if (fs.existsSync(p404)) {
  const kb = fs.statSync(p404).size / 1024;
  t('404.html is a 404 page, not a second copy of the app',
    kb < 50, Math.round(kb) + ' KB — a stale app copy is a page nobody maintains');
}

/* The wall is open to the office TV with no sign-in, so it must never carry a
   credential either. */
for (const f of ['wall.html', 'qpwall.html']) {
  const fp = path.join(SITE, f);
  if (!fs.existsSync(fp)) continue;
  const s = fs.readFileSync(fp, 'utf8');
  t(f + ' holds no sign-in literal',
    !/toUpperCase\(\)\s*===\s*'[A-Z0-9]{6,8}'/.test(s));
}

console.log();
process.exit(fail ? 1 : 0);
