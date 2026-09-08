// Branch Intelligence shares the tracker's script project and its deployment.
//
// A script project may declare doGet and doPost exactly once, so Intelligence.gs
// ships with its own pair at the foot of the file, to be deleted when it joins a
// project that already has a router. On 7 September it was pasted into the
// tracker's project and its block correctly removed — and then every wall screen
// got "Session expired. Sign in again." from the tracker's token check, because
// nothing handed intel.* actions over. A television has nobody to sign it in.
//
// This drives the tracker's own doPost with the bodies the wall and the app
// actually send.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
// The two files are separate in the repository and one project at runtime.
const both = path.join(os.tmpdir(), 'kpi-intel-' + process.pid + '.gs');
const intel = fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8');
// As deployed: the marked block at the foot of Intelligence.gs is deleted when
// it joins a project that already has a router. Left in, its doGet and doPost
// are declared second and silently win, and the tracker's own sign-in stops
// working — which is what this concatenation showed the first time it ran.
const CUT = intel.indexOf('   WEB APP ENTRY POINTS');
if (CUT < 0) throw new Error('Intelligence.gs no longer marks its web app entry points — check the block this test removes.');
const head = intel.lastIndexOf('/* ═', CUT);
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' + intel.slice(0, head));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes']]);
env.__mkSheet('KPI Log', 2, ['Timestamp','Date','StaffId','Name','Grade','Status'], []);

// Each wall read is stubbed: this is about the routing, not about what the
// branch's figures happen to be today.
const asked = [];
['iActWall45_', 'iActDelivery_', 'iActLicence_', 'iActPossession_', 'iActBook_'].forEach(fn => {
  env[fn] = b => { asked.push(fn); return env.iOk_({ from: fn, data: { rows: [] } }); };
});
const post = body => {
  const out = env.doPost({ postData: { contents: JSON.stringify(body) } });
  try { return JSON.parse(out.getContent()); } catch (e) { return { unparsed: String(out) }; }
};
const get = param => {
  const out = env.doGet({ parameter: param });
  try { return JSON.parse(out.getContent()); } catch (e) { return { unparsed: String(out) }; }
};

console.log('\nThe five wall reads carry no token, and must not need one:\n');
[['intel.wall','iActWall45_'], ['intel.delivery','iActDelivery_'], ['intel.licence','iActLicence_'],
 ['intel.possession','iActPossession_'], ['intel.book','iActBook_']].forEach(([action, fn]) => {
  asked.length = 0;
  const r = post({ action });
  ok(action + ' is answered, not refused', r.ok === true && r.from === fn && !r.authRequired, JSON.stringify(r).slice(0, 90));
  ok('  and it reached ' + fn, asked.join() === fn, asked.join());
});

console.log('\nWhat is not a wall read still needs a session:\n');
const priv = post({ action: 'intel.data', token: 'nonsense' });
ok('an intelligence action with a bad token is refused', priv.ok === false && /session/i.test(priv.error || ''), JSON.stringify(priv));
ok('and it is the intelligence refusal, not the tracker\'s', !priv.authRequired, JSON.stringify(priv));

console.log('\nThe tracker is untouched:\n');
ok('ping still answers with the version', get({ action: 'ping' }).version === env.SCRIPT_VERSION);

console.log('\nAnd ping says which files the project is carrying:\n');
const withIntel = get({ action: 'ping' }).has;
ok('it reports the four parts', withIntel && ['write','waiting','intel','salesforce'].every(k => k in withIntel), JSON.stringify(withIntel));
ok('intelligence is in this one', withIntel.intel === true);
ok('and the write path is not, because KPI-Write.gs is a separate file', withIntel.write === false, JSON.stringify(withIntel));
const noTok = post({ action: 'rows' });
ok('a tracker action with no token is still refused', noTok.ok === false && noTok.authRequired === true, JSON.stringify(noTok));
const login = post({ action: 'login', who: 'sasha@example.com', password: '1' });
ok('and signing in still works', login.ok === true && !!login.token, JSON.stringify(login).slice(0, 70));
ok('an unknown action is still the tracker\'s to refuse', /Unknown|not/i.test(JSON.stringify(post({ action: 'nonsense', token: login.token }))));

console.log('\nWith no Intelligence.gs in the project at all:\n');
process.env.GS_PATH = path.join(ROOT, 'apps-script/KPI.gs');   // the tracker on its own
const alone = makeEnv();
process.env.GS_PATH = both;
alone.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'], []);
alone.__mkSheet('KPI Log', 2, ['Timestamp','Date','StaffId','Name','Grade','Status'], []);
const aloneHas = JSON.parse(alone.doGet({ parameter: { action: 'ping' } }).getContent());
ok('the tracker still answers ping', aloneHas.ok === true);
ok('and says the intelligence code is not here', aloneHas.has && aloneHas.has.intel === false, JSON.stringify(aloneHas.has));
ok('and an intel action falls through to the token check',
   JSON.parse(alone.doPost({ postData: { contents: '{"action":"intel.book"}' } }).getContent()).authRequired === true);

console.log('\nAnd the block that must be deleted is still marked and self-contained:\n');
ok('Intelligence.gs marks its web app entry points', CUT > 0);
ok('it says to delete them when the project already has a router', /DELETE THESE TWO FUNCTIONS/.test(intel));
// It is not the last thing in the file — thousands of lines follow it — so
// what matters is that the block is self-contained: between its banner and the
// next one there are exactly doGet and doPost, and deleting to there is safe.
const block = intel.slice(CUT, intel.indexOf('/* ═', CUT + 40));
ok('the block holds exactly doGet and doPost',
   (block.match(/^function \w+/gm) || []).join(' ') === 'function doGet function doPost',
   (block.match(/^function \w+/gm) || []).join(' '));
// It sits four thousand lines from the end, so it has to say where it stops.
ok('and it says where it ends, because it is not at the end of the file', /NOT at the end of the file/.test(intel));
ok('and the banner it names is really the next one',
   /WHAT IS IN OUR POSSESSION/.test(intel.slice(intel.indexOf('/* ═', CUT + 40), intel.indexOf('/* ═', CUT + 40) + 120)));
ok('and what to add to the host instead', /var hit = intelRoute_\(b\); if \(hit\) return hit;/.test(intel));

fs.unlinkSync(both);
console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
