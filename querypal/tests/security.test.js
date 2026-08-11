/* Security behaviour: server-side routing, HTML escaping, rate limiting,
   password hashing and session tokens. Apps Script services are stubbed. */
const _fs = require('fs'), _p = require('path');
const _gs = _p.join(__dirname, '..', 'QueryPal_Backend_v10.gs');
if (!_fs.existsSync(_gs)) {
  console.log('  SKIPPED — needs QueryPal_Backend_v10.gs in querypal/.');
  console.log('  The archive this repo started from carried v6.9; production runs v10.2.');
  console.log('  Export the live script from the Apps Script editor to run this suite.');
  process.exit(0);
}

const fs = require('fs'), path = require('path'), crypto = require('crypto');
const gs = fs.readFileSync(path.join(__dirname, '..', 'QueryPal_Backend_v10.gs'), 'utf8');

// ---- stub the Apps Script surface these helpers touch ----
const cache = new Map();
global.CacheService = { getScriptCache: () => ({
  get: k => (cache.has(k) ? cache.get(k) : null),
  put: (k, v) => cache.set(k, v)
})};
const props = new Map();
global.PropertiesService = { getScriptProperties: () => ({
  getProperty: k => (props.has(k) ? props.get(k) : null),
  setProperty: (k, v) => props.set(k, v)
})};
global.Utilities = {
  getUuid: () => crypto.randomUUID(),
  base64Encode: b => Buffer.from(b).toString('base64'),
  computeDigest: (_a, s) => crypto.createHash('sha256').update(s).digest(),
  DigestAlgorithm: { SHA_256: 'sha256' }
};
global.Logger = { log: () => {} };

const take = re => gs.match(re)[0].replace(/^const /, 'var ');
eval(take(/const QUERY_ROUTES = \{[\s\S]*?\n\};/));
eval(take(/const DEPT_NAMES = \{[\s\S]*?\n\};/));
eval(take(/const AGENT_ACCESS = \{[\s\S]*?\n\};/));
eval(take(/const REQUIRE_AGENT_PASSWORD = [^\n]*/));
eval(take(/const PW_PROP  = [^\n]*/)); eval(take(/const PW_SALT  = [^\n]*/));
eval(take(/const AUTH_MAX_TRIES = [^\n]*/)); eval(take(/const AUTH_WINDOW    = [^\n]*/));
eval(take(/const TOKEN_TTL      = [^\n]*/));
// pull the helpers out of the .gs and evaluate them here, in this scope
eval(['routeFor_','esc_','rateLimit_','pwSalt_','pwHash_','pwStore_','pwSave_',
      'setAgentPassword','bootstrapAgentPasswords','issueToken_']
  .map(fn => gs.match(new RegExp('function ' + fn + '\\([\\s\\S]*?\\n\\}'))[0])
  .join('\n'));

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+label+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

// ── server-side routing: the browser no longer picks the recipient ──
t('known type routes to its real department',
  routeFor_('Bounce Cheque').email, 'gloc.premiumquery@myguardiangroup.com');
t('turnaround comes from the catalog, not the client', routeFor_('Bounce Cheque').tat, '5 days');
t('single-day turnaround reads naturally', routeFor_('Embassy letters').tat, '1 day');
t('category comes from the catalog too', routeFor_('Surrenders').group, 'My Money & Payouts');
t('department display name resolved', routeFor_('Surrenders').dept, 'Customer Service – Chaguanas');
t('case drift tolerated', routeFor_('bounce cheque').email, 'gloc.premiumquery@myguardiangroup.com');
t('unknown type is refused, not relayed', routeFor_('Pay attacker@evil.com'), null);
t('empty type refused', routeFor_(''), null);
t('all 48 catalog types are routable', Object.keys(QUERY_ROUTES).length, 48);
t('doPost rejects an unroutable query',
  /if \(!route\) return json\(\{ ok: false, error: 'Unknown query type/.test(gs), true);
t('doPost overwrites the posted department',
  /d\.departmentEmail = route\.email;/.test(gs), true);

// ── HTML escaping ──
t('script tag neutralised', esc_('<script>alert(1)</script>'),
  '&lt;script&gt;alert(1)&lt;/script&gt;');
t('attribute break neutralised', esc_('" onmouseover="x'), '&quot; onmouseover=&quot;x');
t('ampersand escaped first (no double-encoding)', esc_('Tom & <b>'), 'Tom &amp; &lt;b&gt;');
t('null-safe', esc_(null), '');
t('normal text untouched', esc_('Change of address - Chaguanas'), 'Change of address - Chaguanas');
t('description is escaped in the email', /white-space:pre-wrap;">'\+ esc_\(d\.description\)/.test(gs), true);

// ── rate limiting ──
cache.clear();
const hits = Array.from({length: 8}, () => rateLimit_('k1', 5, 600));
t('first 5 allowed, rest blocked', hits, [true,true,true,true,true,false,false,false]);
t('a different key is unaffected', rateLimit_('k2', 5, 600), true);
t('auth attempts are throttled per code', /rateLimit_\('auth_' \+ tried/.test(gs), true);
t('assistant proxy is throttled', /rateLimit_\('rai_all', 200, 3600\)/.test(gs), true);
t('submissions are throttled', /rateLimit_\('post', 30, 60\)/.test(gs), true);

// ── passwords ──
props.clear();
setAgentPassword('AE101', 'Sunshine1');
const store = pwStore_();
t('password is not stored in clear text',
  JSON.stringify(store).includes('Sunshine1'), false);
t('hash verifies the right password', store['AE101'] === pwHash_('AE101', 'Sunshine1'), true);
t('hash rejects the wrong password', store['AE101'] === pwHash_('AE101', 'Sunshine2'), false);
t('same password differs per agent code', pwHash_('AE101','x') === pwHash_('AJ102','x'), false);
props.delete(PW_SALT); pwSalt_();
t('a new salt changes the hash', store['AE101'] === pwHash_('AE101', 'Sunshine1'), false);

props.clear(); cache.clear();
const printed = bootstrapAgentPasswords();
// skip the "CODE\tAGENT\tPASSWORD" header, which also matches a code-shaped row
const rows = printed.split('\n').filter(l => /^[A-Z0-9]+\t/.test(l) && !l.startsWith('CODE\t'));
t('bootstrap covers every code', rows.length, Object.keys(AGENT_ACCESS).length);
t('bootstrap stores a hash per code', Object.keys(pwStore_()).length, Object.keys(AGENT_ACCESS).length);
const pwds = rows.map(r => r.split('\t')[2]);
t('generated passwords are 8 chars', [...new Set(pwds.map(p => p.length))], [8]);
t('generated passwords are unique', new Set(pwds).size, pwds.length);
t('no ambiguous characters (0/O/1/I)', pwds.some(p => /[01OI]/.test(p)), false);
t('stored hashes match the printed passwords',
  rows.every(r => { const [c,,p] = r.split('\t'); return pwStore_()[c.toUpperCase()] === pwHash_(c, p); }), true);

// ── session tokens ──
cache.clear();
const tok = issueToken_({ code:'AE101', name:'Aidan', email:'a@b.c', role:'agent' });
t('token is long and random', tok.length >= 32, true);
t('token does not contain the agent code', tok.toUpperCase().includes('AE101'), false);
t('two sign-ins get different tokens',
  tok === issueToken_({ code:'AE101', name:'Aidan', email:'a@b.c', role:'agent' }), false);
t('token maps back to the agent', JSON.parse(cache.get('tok_'+tok)).code, 'AE101');
t('dashboard prefers the token', /agentFromToken_\(token\) \|\| \(REQUIRE_AGENT_PASSWORD \? null : findAgent_\(code\)\)/.test(gs), true);
t('sign-in is served over POST', /if \(d\.action === 'agentauth'\) return agentAuthPost_\(d\)/.test(gs), true);

// ── concurrency ──
t('reference number is taken under a lock that spans the append',
  /lock\.waitLock\(20000\);[\s\S]*?runNo = nextRunNo\(sh\);[\s\S]*?sh\.appendRow\(\[[\s\S]*?finally \{ lock\.releaseLock\(\); \}/.test(gs), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
