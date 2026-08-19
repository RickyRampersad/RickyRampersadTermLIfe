// Re-cuts the narration AND its subtitle timing in one pass. edge-tts hands
// back sentence-level cues with real millisecond boundaries, so the captions
// land on the word being spoken instead of being guessed at.
const fs = require('fs');
const { execFileSync } = require('child_process');
const S = '/tmp/claude-0/-home-user-RickyRampersadTermLIfe/203562d4-c614-5eed-b728-644df21311be/scratchpad/';
const VOICE = 'en-US-AndrewNeural';

const LINES = {};
['vid/lines.txt','vid/newlines.txt','vid/newlines2.txt','vid/newlines3.txt',
 'vid/newlines4.txt','vid/newlines5.txt','vid/newlines6.txt']
  .forEach(f => fs.readFileSync(S + f, 'utf8').trim().split('\n').forEach(l => {
    const i = l.indexOf('|'); if (i > 0) LINES[l.slice(0, i)] = l.slice(i + 1); }));

const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const ids = Object.keys(LINES).filter(id => !ONLY.length || ONLY.includes(id));
fs.mkdirSync(S + 'vid/nvoice', { recursive: true });

for (const id of ids) {
  const mp3 = S + 'vid/nvoice/' + id + '.mp3';
  const vtt = S + 'vid/nvoice/' + id + '.vtt';
  let ok = false;
  for (let t = 0; t < 3 && !ok; t++) {
    try {
      execFileSync('edge-tts', ['-v', VOICE, '-t', LINES[id],
        '--write-media', mp3, '--write-subtitles', vtt], { stdio: 'pipe', timeout: 90000 });
      ok = fs.existsSync(mp3) && fs.statSync(mp3).size > 2000;
    } catch (e) { console.log(id, 'retry', t + 1, String(e.message).slice(0, 70)); }
  }
  if (!ok) { console.log('FAILED', id); continue; }
  execFileSync('ffmpeg', ['-nostdin', '-y', '-i', mp3, '-ar', '44100', '-ac', '2',
    S + 'vid/nvoice/' + id + '.wav'], { stdio: 'pipe' });
  console.log(id, 'ok', (fs.statSync(mp3).size / 1024).toFixed(0) + 'kb');
}
console.log('TTS DONE', ids.length);
