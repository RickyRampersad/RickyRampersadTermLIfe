// Branch Intelligence shares the tracker's script project and its deployment.
//
// A script project may declare doGet and doPost exactly once, and the second
// declaration silently wins. Intelligence.gs therefore declares neither — its
// entry points are intelDoGet_/intelDoPost_ and the tracker's router hands over
// to them. Both halves of that were learned the hard way on 7 September: first
// every wall screen got "Session expired. Sign in again." because nothing handed
// intel.* actions past the tracker's token check (a television has nobody to
// sign it in); then the file was pasted whole, its own doPost won, and staff
// sign-in answered "Unknown action: login".
//
// This drives the tracker's own doPost with the bodies the wall and the app
// actually send.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
// The two files are separate in the repository and one project at runtime.
const both = path.join(os.tmpdir(), 'kpi-intel-' + process.pid + '.gs');
const intel = fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8');
// Pasted whole, as a person does: concatenated after KPI.gs exactly as Apps
// Script loads a project. If a doGet or doPost ever comes back into
// Intelligence.gs, the tracker tests below fail the way the branch did.
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' + intel);
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
['iActWall45_', 'iActDelivery_', 'iActLicence_', 'iActPossession_', 'iActBook_', 'iActDay_'].forEach(fn => {
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

console.log('\nThe branch\'s own day is a wall read too — no token, aggregates only:\n');
const day = post({ action: 'intel.day' });
ok('it answers without a token', day.ok && !day.authRequired, JSON.stringify(day).slice(0, 90));
ok('and it is the day handler that answered', asked.indexOf('iActDay_') > -1, asked.join());

console.log('\nIntelligence.gs can be pasted whole, because it declares no router of its own:\n');
ok('no doGet or doPost anywhere in it', !/^function do(Get|Post)\(/m.test(intel));
ok('its entry points are intelDoGet_ and intelDoPost_', /^function intelDoGet_\(/m.test(intel) && /^function intelDoPost_\(/m.test(intel));
ok('and they answer', typeof env.intelDoGet_ === 'function' && JSON.parse(env.intelDoGet_({ parameter: {} }).getContent()).service === 'Branch Intelligence');
ok('the file says what a project with no router adds', /function doGet\(e\)\s*\{ return intelDoGet_\(e\); \}/.test(intel));
const iping = post({ action: 'intel.ping' });
ok('and intel.ping says which build is in the project, with no token', iping.ok && iping.version === env.INTEL_VERSION && iping.service === 'Branch Intelligence', JSON.stringify(iping));
ok('and nothing else', Object.keys(iping).sort().join() === 'built,ok,service,version,workbook', JSON.stringify(iping));

console.log('\nIt reads the branch workbook from inside the tracker\'s project, with nothing set:\n');
// Every web request is a fresh execution, so the memo starts empty each time;
// here one environment stands in for several requests, so it is emptied by hand.
// props() is "the next request": a property value, an empty memo, and the
// harness's record of openById calls wiped, since the sign-in above already
// opened the workbook once.
const props = v => { env.PropertiesService.getScriptProperties = () => ({ getProperty: k => k === 'INTEL_WORKBOOK_ID' ? v : null, setProperty: () => {} }); env._intelSs = null; env.__calls.openById = []; };
props(null);
env.iSs_(); env.iSs_(); env.iTz_();
ok('the branch workbook is named in the file', /^[A-Za-z0-9_-]{30,}$/.test(env.INTEL.WORKBOOK), env.INTEL.WORKBOOK);
ok('and with nothing set, that is the one it opens', (env.__calls.openById || []).join() === env.INTEL.WORKBOOK, JSON.stringify(env.__calls.openById));
ok('once per request, not once per read', (env.__calls.openById || []).length === 1);
ok('and intel.ping says so', post({ action: 'intel.ping' }).workbook === 'default');
props('the-other-workbook'); env.iSs_();
ok('INTEL_WORKBOOK_ID points it at another', (env.__calls.openById || []).slice(-1)[0] === 'the-other-workbook' && post({ action: 'intel.ping' }).workbook === 'by id');
props('bound'); env.iSs_();
ok('and "bound" reads the attached one without opening anything', env.__calls.openById.length === 0 && post({ action: 'intel.ping' }).workbook === 'bound');
props(null); env.iSs_(); env.iSs_();
ok('and the next request opens it again, once', env.__calls.openById.join() === env.INTEL.WORKBOOK);

console.log('\nSalesforce goes through whichever helper the project has:\n');
// In the tracker's project there is no SalesforceSync.gs, so no sfQuery_ —
// the possession and book screens said "sfQuery_ is not defined" on 7 September.
const seen = [];
env.sfkQuery_ = soql => { seen.push('sfk:' + soql); return [{ Id: 'a' }]; };
env.sfkToken_ = () => ({ instance_url: 'https://k', access_token: 'k' });
ok('no sfQuery_ in the tracker\'s project', typeof env.sfQuery_ !== 'function');
ok('so it asks the tracker\'s sfkQuery_', env.iSfQuery_('SELECT Id FROM Task')[0].Id === 'a' && seen.join() === 'sfk:SELECT Id FROM Task', seen.join());
ok('and the tracker\'s token', env.iSfToken_().instance_url === 'https://k');
ok('and the self test names it', env.iSfHelper_() === 'sfkQuery_ (KPI.gs)', env.iSfHelper_());
env.sfQuery_ = soql => { seen.push('sf:' + soql); return [{ Id: 'b' }]; };
ok('with SalesforceSync.gs present, that one comes first', env.iSfQuery_('x')[0].Id === 'b' && seen[seen.length - 1] === 'sf:x');
// A function declaration is a non-configurable global, so delete is a no-op
// on the tracker's real sfkQuery_; blanking it is what "neither" looks like.
env.sfQuery_ = undefined; env.sfkQuery_ = undefined;
let noHelper = '';
try { env.iSfQuery_('x'); } catch (e) { noHelper = e.message; }
ok('with neither, it says so in words', /No Salesforce helper in this project/.test(noHelper), noHelper);

console.log('\nBoth installers fit under the twenty-trigger limit together:\n');
env.installTriggers();
env.intelInstallTriggers();
const all = env.ScriptApp.getProjectTriggers();
ok('seventeen triggers in all — the tracker\'s six, the intelligence\'s six, and the wall\'s five nightly builds', all.length === 17, String(all.length));
ok('which leaves room, where seventeen plus six did not', all.length <= 20);
ok('every intelligence trigger made it in, the fourth included', all.some(t => t.getHandlerFunction() === 'intelHorizonWatch') && all.some(t => t.getHandlerFunction() === 'intelSurveyFollowUp'));
ok('and each wall feed has its own night-time build', ['intelRebuildWall45','intelRebuildDelivery','intelRebuildLicence','intelRebuildPossession','intelRebuildBook'].every(fn => all.some(t => t.getHandlerFunction() === fn)));
// All five used to fire at three and compete; the 155-second one lost and
// served a two-day-old copy while the other four rebuilt around it.
const wallHours = all.filter(t => /^intelRebuild(Wall45|Possession|Licence|Delivery|Book)$/.test(t.getHandlerFunction()))
  .map(t => (t.chain.join().match(/atHour\((\d+)\)/) || [])[1]);
ok('and no two of them share an hour', new Set(wallHours).size === 5, wallHours.join(','));
// And "before the branch opens" has to mean it. Spreading them into an hour
// each put the last one at seven, which is when the branch signs in — on
// 10 September the whole floor met "the sheet did not answer" instead of a
// tracker. Apps Script fires anywhere inside the hour it is given, so the
// last of these must be given an hour that ends well before seven.
ok('the slowest goes first, and every one of them is finished before six',
   wallHours.every(h => Number(h) >= 0 && Number(h) <= 5), wallHours.join(','));

fs.unlinkSync(both);
console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
