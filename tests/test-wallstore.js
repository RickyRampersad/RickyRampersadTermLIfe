// The wall store: five screens built once a night and read in a second.
//
// On 8 September the five wall feeds were computed on every request — 25 to
// 155 seconds each, and the birthdays screen never finished, because
// fifty-four thousand portfolio rows do not fit in one web request. A
// television reloading five of them every half hour would have spent the
// project's daily runtime by lunch and taken the tracker's sign-in down with
// it. This drives the tracker's real doPost with the wall's real bodies, the
// builders stubbed, and counts how often each is actually built.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'kpi-intel-store-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'], []);
env.__mkSheet('KPI Log', 2, ['Timestamp','Date','StaffId','Name','Grade','Status'], []);
const post = body => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());

// Each builder answers with a payload that says which build it was, and counts.
const built = {};
const stub = (fn, key, extra) => { built[key] = 0; env[fn] = () => { built[key]++; return Object.assign({ from: key, build: built[key], generatedAt: '2026-09-08' }, extra || {}); }; };
stub('iBuildWall45_', 'wall45', { headline: { policies: 63 } });
stub('iBuildDelivery_', 'delivery');
stub('iBuildLicence_', 'licence', { configured: true, roster: { active: 32 } });
stub('iBuildPossession_', 'possession', { configured: true, total: 730 });
stub('iBuildBook_', 'book', { configured: true, today: { n: 9 } });
const fresh = () => { env._intelSs = null; env._intelTabMemo = {}; env._intelHeadMemo = {}; };

console.log('\nA screen asks, and the feed is built once and kept:\n');
fresh();
let r = post({ action: 'intel.wall' });
ok('the first request builds it', r.ok && r.data.from === 'wall45' && built.wall45 === 1, JSON.stringify(r).slice(0, 120));
ok('and there is no stored stamp yet, because this was the build', !r.stored);
fresh();
r = post({ action: 'intel.wall' });
ok('the second request is served from the store', r.ok && r.data.from === 'wall45' && built.wall45 === 1, 'built ' + built.wall45 + ' times');
ok('and says when that copy was built', /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(r.stored || ''), r.stored);
ok('the store is one hidden-able tab in the workbook', !!env.__sheets['_Intel Wall']);
fresh();
r = post({ action: 'intel.wall', band: 60 });
ok('another band is its own feed, built on its own', r.ok && built.wall45 === 2 && env.__sheets['_Intel Wall']._grid.length === 2);

console.log('\nThe other four, the same way:\n');
for (const [action, key] of [['intel.delivery','delivery'], ['intel.licence','licence'], ['intel.possession','possession'], ['intel.book','book']]) {
  fresh(); post({ action }); fresh(); const again = post({ action });
  ok(action + ' builds once and then reads the store', again.ok && again.data.from === key && built[key] === 1 && !!again.stored, 'built ' + built[key]);
}

console.log('\nThe night\'s rebuild replaces the copy, and the screen sees the new one:\n');
const line = env.intelRebuildWall45();
ok('the rebuild says what it did', /^wall45 built at \d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}\S* in \d+s$/.test(line), line);
fresh(); r = post({ action: 'intel.wall' });
ok('the next request carries the rebuilt copy', r.data.build === 3 && built.wall45 === 3, JSON.stringify(r.data));
const all = env.intelRebuildWall().split('\n');
ok('intelRebuildWall does all five, in order, the birthdays last', all.length === 5 && /^wall45/.test(all[0]) && /^book/.test(all[4]), all.join(' | '));

console.log('\nA bad night never pins a bad screen:\n');
env.iBuildDelivery_ = () => ({ error: 'No in-force tab found.' });
let threw = '';
try { env.intelRebuildDelivery(); } catch (e) { threw = e.message; }
ok('a build that errors is refused by the rebuild, in words', /delivery: No in-force tab found/.test(threw), threw);
fresh(); r = post({ action: 'intel.delivery' });
ok('and the screen still gets last night\'s good copy', r.ok && r.data.from === 'delivery' && !!r.stored);
env.iBuildPossession_ = () => ({ configured: false, error: 'Salesforce login failed' });
threw = ''; try { env.intelRebuildPossession(); } catch (e) { threw = e.message; }
ok('"not configured" is refused the same way', /possession: Salesforce login failed/.test(threw), threw);
// With nothing stored at all, what the screen gets is the live answer, unstored.
env.__sheets['_Intel Wall']._grid.length = 0;
fresh(); r = post({ action: 'intel.possession' });
ok('with no copy at all, a not-configured answer reaches the screen, unstored', r.ok && r.data.configured === false && !r.stored && env.__sheets['_Intel Wall']._grid.length === 0);
fresh(); r = post({ action: 'intel.delivery' });
ok('and an error reaches the screen as an error', !r.ok && /No in-force tab found/.test(r.error), JSON.stringify(r));

console.log('\nA payload bigger than one cell round-trips:\n');
const big = { from: 'wall45', filler: 'x'.repeat(120000), tail: 'end' };
env.iBuildWall45_ = () => big;
env.intelRebuildWall45();
const row = env.__sheets['_Intel Wall']._grid.find(x => x[0] === 'wall45');
ok('it is chunked across cells of at most 45,000 characters', row.length >= 6 && row.slice(3).every(c => c === '' || String(c).length <= 45000), 'cells ' + row.length);
fresh(); r = post({ action: 'intel.wall' });
ok('and comes back whole', r.ok && r.data.tail === 'end' && r.data.filler.length === 120000);
env.iBuildWall45_ = () => ({ from: 'wall45', small: true });
env.intelRebuildWall45();
fresh(); r = post({ action: 'intel.wall' });
ok('a smaller copy over a bigger one leaves no tail behind', r.ok && r.data.small === true && !('filler' in r.data));

console.log('\nThe tab lookup asks the workbook once per execution:\n');
fresh();
env.__mkSheet('Branch Portfolio', 50, ['Agent','Client Number','Premium','Status Description'], [['a','1','2','Active']]);
const before = env.__calls.getLastColumn;
env.iTabDues_(); const once = env.__calls.getLastColumn - before;
env.iTabDues_(); env.iTabDues_();
ok('the first lookup reads the headers', once > 0, String(once));
ok('the second and third read nothing', env.__calls.getLastColumn - before === once, String(env.__calls.getLastColumn - before));


console.log('\nWho is left off the wall — set from the editor, no name in the repo:\n');
// A settable in-memory Script Properties store, since the helper reads and writes it.
const store = {};
env.PropertiesService.getScriptProperties = () => ({
  getProperty: k => (k in store ? store[k] : null),
  setProperty: (k, v) => { store[k] = String(v); }
});
env._intelSs = null;
ok('nobody is off to begin with', /Nobody is excluded/.test(env.intelExcluded()));
let out = env.intelExclude('Anne Mohammed-Ali, Kiran Ali');
ok('two names go on, and the store holds them', store.INTEL_EXCLUDE_AGENTS === 'Anne Mohammed-Ali, Kiran Ali', store.INTEL_EXCLUDE_AGENTS);
ok('and setting them rebuilt the wall', /wall45 built at/.test(out));
ok('the book spelling with the code prefix is caught too', env.iExcludes_(env.iExcluded_(), 'A00001 - Anne Mohammed-Ali') && env.iExcludes_(env.iExcluded_(), 'A00002 - Kiran Ali'));
ok('the two do not catch each other, though they share a surname', !env.iExcludes_({ 'anne mohammed ali': true }, 'Kiran Ali') && !env.iExcludes_({ 'kiran ali': true }, 'Anne Mohammed-Ali'));
env.intelExclude('Kiran Ali');
ok('adding one already there does not double it', store.INTEL_EXCLUDE_AGENTS === 'Anne Mohammed-Ali, Kiran Ali', store.INTEL_EXCLUDE_AGENTS);
env.intelExclude('Pat Example');
ok('a third, different name is added', /Pat Example/.test(store.INTEL_EXCLUDE_AGENTS) && env.intelExcluded().indexOf('(3)') > -1, store.INTEL_EXCLUDE_AGENTS);
env.intelExcludeClear();
ok('and the list clears', !store.INTEL_EXCLUDE_AGENTS && /Nobody is excluded/.test(env.intelExcluded()));

console.log('\nThe birthdays query no longer joins the contact onto all 54,000 rows:\n');
const intel = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script/Intelligence.gs'), 'utf8');
const bookQ = intel.slice(intel.indexOf('function iBuildBook_'), intel.indexOf('function iBuildBook_') + 6000);
ok('the book query drops Contact__r.FirstName / LastName', !/Contact__r\.FirstName/.test(bookQ) && !/Contact__r\.LastName/.test(bookQ));
ok('and does not join the contact in the 54k-row pull at all', !/Contact__r\.MailingCity ' \+/.test(bookQ) && !/FROM ' \+ IBOOK\.OBJECT[\s\S]{0,40}Contact__r/.test(bookQ));
ok('town is fetched for today\'s birthdays alone, from Contact', /SELECT Id, MailingCity FROM Contact WHERE Id IN/.test(intel));
ok('in chunks, so a long list does not overflow one query', /ti \+= 200/.test(intel));
ok('and a town that never arrives does not fail the screen', /leave the towns blank rather than fail/.test(intel));


console.log('\nOur own birthdays — the person in the room, big on the wall:\n');
const asked = [];
env.iSfQuery_ = soql => { asked.push(soql); return [
  { Name: 'Pat Example', Agent__c: 'A00001', Birthdate: '1980-09-08' },     // today
  { Name: 'Sam Sample',  Agent__c: 'A00002', Birthdate: '1975-03-08' },     // another month, same day
  { Name: 'Lee Placeholder', Agent__c: 'A00003', Birthdate: '1990-09-08' } // today, but not on the roster map: still named
]; };
store.INTEL_TEAM_BIRTHDAYS = '09-08 Kim Support, 12-25 Someone Else, 9/8 Pat Example';
const roster = { A00001: 'Pat Example', A00002: 'Sam Sample' }, units = { A00001: 'Unit One', A00002: 'Unit Two' };
const team = env.iBookTeam_(new Date(2026, 8, 8), roster, units);
ok('the roster is asked in one query, by agent code', asked.length === 1 && /Agent__c IN \('A00001','A00002'\)/.test(asked[0]) && /Birthdate != null/.test(asked[0]), asked[0]);
ok('the agent whose birthday is today is named, with their unit', team.some(t => t.name === 'Pat Example' && t.unit === 'Unit One' && t.agent));
ok('a birthday on the same day of another month is not', !team.some(t => t.name === 'Sam Sample'));
ok('a support name from the property counts too, and is not an agent', team.some(t => t.name === 'Kim Support' && !t.agent));
ok('the property\'s other date does not', !team.some(t => t.name === 'Someone Else'));
ok('and a name in both places is one person, not two', team.filter(t => /Pat Example/.test(t.name)).length === 1, JSON.stringify(team));
ok('no age travels to the wall', team.every(t => !('turning' in t) && !('age' in t)));
ok('the book feed ships it', /out\.team = iBookTeam_\(today, personOfCode, unitOfCode\);/.test(intel));
const book = require('fs').readFileSync(require('path').join(__dirname, '..', 'intelligence/wall/book.html'), 'utf8');
ok('the birthdays screen has the gold band and tells the player', /id="cake"/.test(book) && /rrb:"celebrate"/.test(book) && /Happy birthday, /.test(book));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
