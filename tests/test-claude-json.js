// Claude's answer, read even when it is untidy or cut short (22 October 2026, 2026-10-22d). Ricky, 9:07am: "Draft my reply"
// said "Branch Intelligence came back empty". Pinned: words or a fence around the JSON, a raw line break inside the reply, an
// answer cut off at its limit (the finished parts kept, an unfinished reply never), a batch cut off (each finished entry kept).
const { makeEnv } = require('./harness'); const env = makeEnv(); let f = 0;
const ok = (l, c, x='') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) f++; };
const P = env.claudeJsonParse_;
ok('clean', P('{"reply":"Kamla, send it.","next":"today"}').reply === 'Kamla, send it.');
ok('words around it, and a fence', P('Here it is:\n```json\n{"reply":"Kamla, send it."}\n```\nHope this helps {sic}').reply === 'Kamla, send it.');
ok('a raw line break inside the reply', P('{"read":"Open 9 days.","reply":"Shivonne, thank you.\nPlease send the letter by Friday.","action":"chase"}').reply === 'Shivonne, thank you.\nPlease send the letter by Friday.');
const cut = P('{"read":"Open 44 days.","reply":"Shivonne, the cancellation letter is with us. Please confirm by Fri 23 Oct.","next":"Kamla calls Friday","add":["Check the Delivery Book for the original","Che');
ok('cut off at the end: the reply and the next step kept, the unfinished list dropped', cut && /cancellation letter/.test(cut.reply) && cut.next === 'Kamla calls Friday' && !('add' in cut), JSON.stringify(cut));
ok('a reply itself cut off is never kept', !(P('{"read":"x","reply":"Shivonne, the canc') || {}).reply);
const batch = P('{"00TA":{"act":"reply","why":"ok","note":"Liz, thank you."},"00TB":{"act":"note","why":"x","note":"Where does th');
ok('a batch cut off: every finished entry kept', batch && batch['00TA'] && batch['00TA'].note === 'Liz, thank you.' && !batch['00TB']);
ok('nothing like JSON: null', P('Sorry, I cannot help with that.') === null);
console.log(f ? f + ' FAILED' : 'All passed'); process.exit(f ? 1 : 0);
