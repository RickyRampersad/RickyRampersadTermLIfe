const CUES = [
  /*__CUES__*/
];
/* Scene boundaries sit just before their first line, so the picture is already
   there when the voice arrives rather than catching up with it. */
const SCENES = [
  /*__SCENES__*/
];
const DUR = /*__DUR__*/;

let muted=false, fired=new Set(), audio={}, actx=null, music=null, soundBlocked=false;

Object.keys(IMGS).forEach(function(k){
  var el=document.getElementById('i-'+k); if(el) el.src=IMGS[k];
});
/* The branch mark appears on the opening and closing cards. */
['i-mark1','i-mark2'].forEach(function(id){
  var el=document.getElementById(id); if(el && IMGS.mark) el.src=IMGS.mark;
});
Object.keys(VO_DATA).forEach(function(k){
  if(!VO_DATA[k]) return;
  var a=new Audio(VO_DATA[k]); a.preload='auto'; audio[k]=a;
});

/* ── the bed ──
   The branch theme on soft pads: two detuned saws through a 900Hz low-pass for
   warmth, a triangle an octave up for air, a sine underneath for weight.
   ELEVEN chords rather than the eight the shorter films use, because this one
   runs to ninety five seconds and the progression has to LAND. Eleven takes
   D F#m Bm G D A G D and adds Bm G D, so the last chord is home instead of the
   bed being cut off mid-phrase.
   The overlap is 2.8s because the release is 2.4s — at 1.6s the outgoing chord
   has finished dying before the incoming one is audible and the bed drops into
   a hole at every change. */
const CH_D=[146.83,220.00,293.66], CH_Fsm=[185.00,277.18,369.99],
      CH_Bm=[123.47,185.00,246.94], CH_G=[196.00,293.66,392.00],
      CH_A=[220.00,329.63,440.00];
const PROG=[CH_D,CH_Fsm,CH_Bm,CH_G,CH_D,CH_A,CH_G,CH_D,CH_Bm,CH_G,CH_D];
const CHORD=/*__CHORD__*/;

function startMusic(){
  if(music) return;
  try{
    actx=new (window.AudioContext||window.webkitAudioContext)();
    const bus=actx.createGain(); bus.gain.value=0;
    const lp=actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; lp.Q.value=0.4;
    bus.connect(lp); lp.connect(actx.destination);
    const t0=actx.currentTime+0.05;
    PROG.forEach(function(chord,ci){
      const on=t0+ci*CHORD, off=on+CHORD+2.8;
      chord.forEach(function(f,vi){
        [['sawtooth',-6,0.055],['sawtooth',7,0.055],['triangle',0,0.030]].forEach(function(v){
          const o=actx.createOscillator(), g=actx.createGain();
          o.type=v[0]; o.frequency.value = v[0]==='triangle' ? f*2 : f; o.detune.value=v[1];
          g.gain.setValueAtTime(0.0001,on);
          g.gain.exponentialRampToValueAtTime(v[2]/(vi+1.4), on+2.4);
          g.gain.setValueAtTime(v[2]/(vi+1.4), off-2.4);
          g.gain.exponentialRampToValueAtTime(0.0001, off);
          o.connect(g); g.connect(bus); o.start(on); o.stop(off+0.1);
        });
      });
      const sub=actx.createOscillator(), sg=actx.createGain();
      sub.type='sine'; sub.frequency.value=chord[0]/2;
      sg.gain.setValueAtTime(0.0001,on);
      sg.gain.exponentialRampToValueAtTime(0.075,on+2.6);
      sg.gain.setValueAtTime(0.075,off-2.4);
      sg.gain.exponentialRampToValueAtTime(0.0001,off);
      sub.connect(sg); sg.connect(bus); sub.start(on); sub.stop(off+0.1);
    });
    /* Under the voice throughout; up only where the picture carries the line on
       its own — the announcement, the Act, and the close. Those are the three
       places a bed like this should be noticed and nowhere else. */
    const g=bus.gain, T=actx.currentTime;
    const at=(v,s,r)=>g.linearRampToValueAtTime(v,T+s+(r||0));
    g.setValueAtTime(0,T);
    at(0.30, 0, 2.4);  at(0.30, 5.0); at(0.16, 6.8);
    at(0.16,13.6); at(0.38,15.2); at(0.38,18.4); at(0.17,19.9);
    at(0.17,59.8); at(0.34,61.2); at(0.34,65.0); at(0.17,66.4);
    at(0.17,86.2); at(0.40,87.8); at(0.40,92.6); at(0.0, 95.2);
    music={bus,lp};
    if(actx.state==='suspended') soundBlocked=true;
  }catch(e){ music=null; }
}
function stopMusic(){ try{ actx&&actx.close(); }catch(e){} actx=null; music=null; }
function say(k){
  if(muted) return;
  const a=audio[k]; if(!a) return;
  try{ a.currentTime=0; const p=a.play();
       if(p&&p.catch) p.catch(()=>{soundBlocked=true;paintSound();}); }catch(e){}
}
function hush(){ Object.values(audio).forEach(a=>{try{a.pause();a.currentTime=0;}catch(e){}}); }
function paintSound(){
  const b=document.getElementById('mute'), l=document.getElementById('voice');
  b.textContent = muted?'\uD83D\uDD07':'\uD83D\uDD0A';
  l.textContent = muted?'sound off':soundBlocked?'tap for sound'
                : Object.keys(audio).length?'Andrew':'music only';
}
document.getElementById('mute').onclick=function(){
  muted=!muted;
  if(muted){ hush(); if(music) music.bus.gain.value=0; }
  else { soundBlocked=false; try{ actx&&actx.state==='suspended'&&actx.resume(); }catch(e){} }
  paintSound();
};
document.addEventListener('click',function(){
  soundBlocked=false;
  try{ actx&&actx.state==='suspended'&&actx.resume(); }catch(e){}
  paintSound();
});

let t0=null,paused=false,pausedAt=0,raf=null,ended=false;
function tick(ts){
  if(paused) return;
  if(!t0) t0=ts-pausedAt*1000;
  const t=(ts-t0)/1000;
  document.getElementById('prog').style.width=Math.min(100,t/DUR*100)+'%';
  SCENES.forEach(([id,a,b])=>document.getElementById(id).classList.toggle('on',t>=a&&t<b));
  CUES.forEach((c,i)=>{ if(t>=c.at&&!fired.has(i)){ fired.add(i); say(c.key); } });
  if(t>=DUR){
    ended=true;
    document.getElementById('replay').style.display='grid';
    document.getElementById('hint').textContent='';
    try{ parent!==window && parent.postMessage({film:'ended'},'*'); }catch(e){}
    return;
  }
  raf=requestAnimationFrame(tick);
}
function restart(){
  hush(); stopMusic();
  fired=new Set(); t0=null; pausedAt=0; paused=false; ended=false;
  document.getElementById('replay').style.display='none';
  document.getElementById('hint').textContent='space pauses · R replays';
  startMusic(); paintSound(); raf=requestAnimationFrame(tick);
}
document.addEventListener('keydown',function(e){
  if(e.key===' '){
    e.preventDefault(); if(ended) return;
    paused=!paused;
    if(paused){ pausedAt=(performance.now()-t0)/1000; hush();
                try{actx&&actx.suspend();}catch(e2){} }
    else { t0=null; try{actx&&actx.resume();}catch(e2){} raf=requestAnimationFrame(tick); }
  }
  if(e.key==='r'||e.key==='R') restart();
});
function fit(){
  const s=Math.min(innerWidth/1920,innerHeight/1080);
  document.getElementById('stage').style.transform='translate(-50%,-50%) scale('+s+')';
}
addEventListener('resize',fit); fit();
paintSound(); startMusic(); raf=requestAnimationFrame(tick);
