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
  started=false; startMusic(); paintSound();
  if(audioReady()) begin();
  else { var g=document.getElementById('gate'); if(g) g.classList.add('on'); }
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
/* The stage is 1920x1080 in landscape and 1080x1620 in portrait, both set in
   CSS. Reading its own box means the scale is right for whichever applies, and
   there is no second place for the dimensions to be wrong. */
/* THE FRAME TAKES THE SHAPE OF THE SCREEN IT IS ON.
   A fixed portrait stage still letterboxes, because no two phones agree on a
   ratio: 1080x1620 filled 69% of a 390x844 handset and left a navy band top and
   bottom that reads exactly like something failing to load. So in portrait the
   stage is 1080 wide by whatever the device's own ratio makes it, and the film
   fills the screen edge to edge. The clamp is the whole judgement here — below
   1.45 the composition would have to crop, and past 2.25 a centred group is
   swimming in margin, so the two extremes letterbox slightly on purpose rather
   than deform. Landscape and desktop keep the 16:9 frame the film was cut for;
   clearing the inline height is what hands them back. */
const PORTRAIT = '(orientation:portrait) and (max-width:1080px)';
function fit(){
  const st=document.getElementById('stage');
  if (matchMedia(PORTRAIT).matches){
    const r = Math.min(Math.max(innerHeight/innerWidth, 1.30), 2.25);
    st.style.height = Math.round(1080*r)+'px';
  } else {
    st.style.height = '';
  }
  const w=st.offsetWidth||1920, h=st.offsetHeight||1080;
  const s=Math.min(innerWidth/w,innerHeight/h);
  st.style.transform='translate(-50%,-50%) scale('+s+')';
}
addEventListener('resize',fit);
addEventListener('orientationchange',fit);

/* ══════════════════════════════════════════════════════════════════════════
   DO NOT START THE CLOCK UNTIL THERE IS SOUND
   ══════════════════════════════════════════════════════════════════════════
   This film used to start its timeline the moment it loaded. Every browser
   blocks audio on a page the visitor has not yet clicked, so what actually
   happened was: the clock ran, the opening cues fired into an <audio> element
   whose play() had been rejected, those lines were LOST, and the film played
   on in silence with the music context suspended. Clicking later resumed the
   context but could never replay what had already gone past — so the film was
   silent for the first few lines and then partially silent for the rest.

   It was invisible in testing because the test browser was launched with
   --autoplay-policy=no-user-gesture-required, which is the one condition a real
   browser never gives you. Tested without that flag it reproduces every time.

   So the film now holds on frame one until the browser has actually granted
   audio, and only then starts the clock. Nothing is ever missed, because
   nothing has begun. */
let started = false;

function audioReady(){ return !!actx && actx.state === 'running'; }

function begin(){
  if (started) return;
  started = true;
  var g = document.getElementById('gate'); if (g) g.classList.remove('on');
  t0 = null; pausedAt = 0; fired = new Set();
  paintSound();
  raf = requestAnimationFrame(tick);
}

/* Called from a real user gesture, which is the only place the unlocking works.
   The <audio> elements are primed muted inside the gesture so that the later
   play() calls the cues make are already permitted. */
function unlock(){
  soundBlocked = false;
  try {
    if (!actx) startMusic();
    else if (actx.state === 'suspended') actx.resume();
  } catch (e) {}
  Object.keys(audio).forEach(function (k) {
    var a = audio[k];
    try {
      a.muted = true;
      var pr = a.play();
      if (pr && pr.then) pr.then(function(){ a.pause(); a.currentTime = 0; a.muted = false; })
                           .catch(function(){ a.muted = false; });
      else { a.pause(); a.currentTime = 0; a.muted = false; }
    } catch (e) { a.muted = false; }
  });
  paintSound();
  begin();
}

['click','touchstart','keydown'].forEach(function (ev) {
  document.addEventListener(ev, function () { if (!started) unlock(); }, { passive: true });
});

function boot(){
  fit();
  startMusic();
  paintSound();
  /* Some contexts DO grant audio straight away — the film opened from a click
     on the page that embeds it, or a screen the branch has already touched. In
     those, start immediately and never show the gate. */
  if (audioReady()) { begin(); return; }
  var g = document.getElementById('gate'); if (g) g.classList.add('on');
  /* A suspended context can resume on its own once the page gets a gesture
     anywhere, so keep checking briefly rather than demanding the tap. */
  var tries = 0;
  var poll = setInterval(function () {
    if (started || tries++ > 40) return clearInterval(poll);
    if (audioReady()) { clearInterval(poll); begin(); }
  }, 250);
}
boot();

