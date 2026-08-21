// Builds one mp4 per scene. The page is recorded 1280x624 and padded out to
// 1280x720, so the caption bar sits in its own 96px strip UNDERNEATH the page
// — it can no longer cover the dashboard it is describing.
const fs = require('fs');
const { execFileSync } = require('child_process');
const S = '/tmp/claude-0/-home-user-RickyRampersadTermLIfe/203562d4-c614-5eed-b728-644df21311be/scratchpad/';
const PAGE_H = 624, BAR_H = 96, W = 1280, H = 720;
const CUES = JSON.parse(fs.readFileSync(S + 'vid/caps/cues.json', 'utf8'));
const DUR = JSON.parse(fs.readFileSync(S + 'vid/dur.json', 'utf8'));

const probe = f => parseFloat(execFileSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
fs.mkdirSync(S + 'vid/seg', { recursive: true });

for (const id of Object.keys(DUR)) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  const dur = DUR[id];
  const rec = S + 'vid/rec/' + id + '.webm';
  const wav = S + 'vid/nvoice/' + id + '.wav';
  // playwright records from context creation, so the action window is the LAST
  // `dur` seconds of the file — trim the setup off the front
  const off = Math.max(0, probe(rec) - dur);

  // make the cues contiguous across the scene so the bar never blinks out
  const raw = (CUES[id] || []).slice().sort((x, y) => x.a - y.a);
  const cue = raw.map((c, i) => ({
    f: c.f,
    a: i === 0 ? 0 : raw[i - 1].b,
    b: Math.min(dur, i === raw.length - 1 ? dur : c.b),
  })).filter(c => c.b > c.a + 0.02);

  const args = ['-nostdin', '-y', '-v', 'error', '-ss', off.toFixed(3), '-i', rec];
  cue.forEach(c => args.push('-loop', '1', '-i', S + 'vid/caps/' + c.f));
  args.push('-i', wav);

  const fc = [`[0:v]setpts=PTS-STARTPTS,fps=30,pad=${W}:${H}:0:0:color=0x0A1120[v0]`];
  cue.forEach((c, i) => {
    fc.push(`[${i + 1}:v]scale=${W}:${BAR_H}[c${i}]`);
    fc.push(`[v${i}][c${i}]overlay=0:${PAGE_H}:enable='between(t,${c.a.toFixed(3)},${c.b.toFixed(3)})'[v${i + 1}]`);
  });
  const vout = `[v${cue.length}]`;
  fc.push(`[${cue.length + 1}:a]aresample=44100,apad=whole_dur=${dur},atrim=0:${dur},asetpts=N/SR/TB[a]`);

  args.push('-filter_complex', fc.join(';'),
    '-map', vout, '-map', '[a]',
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
    '-movflags', '+faststart', S + 'vid/seg/' + id + '.mp4');

  execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(id, 'segment', dur + 's', cue.length + ' captions');
}
console.log('SEGMENTS DONE');
