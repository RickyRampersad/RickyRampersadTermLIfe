#!/usr/bin/env python3
"""The upright phone cut of a wide film (1080x1920), for WhatsApp and a phone held upright.

    python3 phonecut.py <key> <wide.mp4> <phone.mp4> "<EYEBROW>" "<Title>" ["<footer>"]

The wide film's stage (the top 1280x616, above its caption strip) sits at 1080x520 over a blurred copy of
itself; the film's own captions (captions-<key>.ass, written by mixany.py) are restyled large under the
picture; the eyebrow and title sit above it and the footer below. Poster: <phone>.jpg at 2.4s.
"""
import pathlib, re, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
key, wide, phone, eyebrow, title = sys.argv[1:6]
footer = sys.argv[6] if len(sys.argv) > 6 else 'Ricky Rampersad Branch · FY27'

src = (HERE / ('captions-%s.ass' % key)).read_text()
events = [l for l in src.splitlines() if l.startswith('Dialogue:')]
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wide]).decode().strip())
end = '0:%02d:%05.2f' % (int(dur // 60), dur % 60)

ass = HERE / ('captions-%s-phone.ass' % key)
ass.write_text('\n'.join([
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920', 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    'Style: Cap,DejaVu Sans,50,&H00ECDFD2,&H00ECDFD2,&H00000000,&H80000000,-1,0,0,0,100,100,0.4,0,1,0,2,8,90,90,1250,1',
    'Style: Eye,DejaVu Sans,30,&H003CB2E3,&H003CB2E3,&H00000000,&H00000000,-1,0,0,0,100,100,6,0,1,0,0,8,60,60,330,1',
    'Style: Ttl,DejaVu Sans,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,-1,0,1,0,0,8,60,60,390,1',
    'Style: Ftr,DejaVu Sans,30,&H00A0ABA4,&H00A0ABA4,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,2,60,60,150,1', '',
    '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
    'Dialogue: 0,0:00:00.00,%s,Eye,,0,0,0,,{\\fad(400,0)}%s' % (end, eyebrow),
    'Dialogue: 0,0:00:00.00,%s,Ttl,,0,0,0,,{\\fad(500,0)}%s' % (end, title),
    'Dialogue: 0,0:00:00.00,%s,Ftr,,0,0,0,,%s' % (end, footer)] + events) + '\n')

subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', wide, '-filter_complex',
    '[0:v]crop=1280:616:0:0,split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=40:2,eq=brightness=-0.22:saturation=0.8[bg];'
    '[b]scale=1080:520[fg];[bg][fg]overlay=0:640,ass=%s[v]' % ass,
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-movflags', '+faststart', phone])
poster = re.sub(r'\.mp4$', '.jpg', phone)
subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-ss', '2.4', '-i', phone, '-frames:v', '1', '-q:v', '3', poster])
print('wrote %s (%.1fs) and %s' % (phone, dur, poster))
