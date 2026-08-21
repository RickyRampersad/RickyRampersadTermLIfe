// Assembles the three cuts. Music is side-chained off the narration so it
// lifts between sentences and gets out of the way under them.
const fs = require('fs');
const { execFileSync } = require('child_process');
const S = '/tmp/claude-0/-home-user-RickyRampersadTermLIfe/203562d4-c614-5eed-b728-644df21311be/scratchpad/';
const DUR = JSON.parse(fs.readFileSync(S + 'vid/dur.json', 'utf8'));

const FULL = ['S00','S0W','S0R','S01','S1A','S02','S2B','S2C','S2H','S2F','S2I','S2G','S2D','S2E','S2P',
  'S03','S04','S05','S06','S07','S08','S18','S09','S10','S11','S12','S12B','S13','S13B',
  'S20','S16','S14','S21','S19','S15'];
const SHORT = ['S00','S0W','S2F','S2G','S12','S21','S15'];

const ff = a => execFileSync('ffmpeg', ['-nostdin', '-y', '-v', 'error', ...a], { stdio: ['ignore', 'pipe', 'pipe'] });
const mb = f => (fs.statSync(f).size / 1048576).toFixed(1);

function build(list, name, target) {
  const total = list.reduce((s, id) => s + DUR[id], 0);
  const lst = S + 'vid/' + name + '.txt';
  fs.writeFileSync(lst, list.map(id => `file 'seg/${id}.mp4'`).join('\n') + '\n');
  const raw = S + 'vid/' + name + '_raw.mp4';
  ff(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', raw]);

  const mus = S + 'vid/' + name + '_music.wav';
  execFileSync('python3', [S + 'music_gen.py', String(total + 1), mus], { stdio: 'pipe' });

  ff(['-i', raw, '-i', mus, '-filter_complex',
    '[0:a]dynaudnorm=f=250:g=7:p=0.9[voc];' +
    '[voc]asplit=2[voc1][key];' +
    '[1:a]volume=0.34[mus];' +
    "[mus][key]sidechaincompress=threshold=0.045:ratio=11:attack=15:release=420:makeup=1[duck];" +
    '[voc1][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,' +
    'alimiter=limit=0.94[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', target]);
  fs.unlinkSync(raw); fs.unlinkSync(mus);
  console.log(name, total.toFixed(1) + 's', mb(target) + 'MB', '->', target.split('/').pop());
  return total;
}

const full = S + 'vid/factfind360-tour.mp4';
const t = build(FULL, 'concat', full);
build(SHORT, 'short', S + 'vid/tour_60s.mp4');

// a share cut small enough to travel on WhatsApp
ff(['-i', full, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
  '-vf', 'scale=960:540:flags=lanczos', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', S + 'vid/tour_whatsapp.mp4']);
console.log('whatsapp', mb(S + 'vid/tour_whatsapp.mp4') + 'MB');
console.log('FILM DONE', Math.floor(t / 60) + 'm' + Math.round(t % 60) + 's');
