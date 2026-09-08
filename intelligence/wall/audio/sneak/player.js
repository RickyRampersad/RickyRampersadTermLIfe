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
let paused=false, started=false, startedAt=0;

/* Addressed by attribute, not by id, because a wall now appears three times in
   this film — once whole to place it, then zoomed into two different panels —
   and ids cannot repeat. */
document.querySelectorAll('[data-shot]').forEach(function(el){
  var k=el.getAttribute('data-shot'); if(IMGS[k]) el.src=IMGS[k];
});
/* The branch mark appears on the opening and closing cards. */
document.querySelectorAll('.mark img').forEach(function(el){
  if(IMGS.mark) el.src=IMGS.mark;
});
Object.keys(VO_DATA).forEach(function(k){
  if(!VO_DATA[k]) return;
  var a=new Audio(VO_DATA[k]); a.preload='auto'; audio[k]=a;
});

/* ── the bed ──
   SOFTER, AND IT MOVES. The first cut was pads only, held flat under the whole
   read at a level that competed with the voice. Three changes, all from the
   same note back — nice, soft, motivational, and let him be heard.

   WARMER. The low-pass comes down from 900Hz to 680, which takes the edge off
   the saws; what is left is body rather than buzz.

   A PLUCK, NOT JUST A PAD. Four soft triangle notes per chord, fast attack and
   a long decay through their own gentle filter. A pad alone is atmosphere; it
   is the pluck that gives a bed forward motion, which is the whole difference
   between "ambient" and "motivational".

   AND IT DUCKS AROUND THE VOICE AUTOMATICALLY. The gain used to be a hand-typed
   list of times that had to be re-tuned every time a line changed length — and
   was therefore wrong the moment the script moved. It is now computed from the
   cue list the build measured: low while a line is being spoken, up in every
   gap longer than 1.7s, and open for the close. The swell cannot drift out of
   sync with the read because it is derived from it. */
const CH_D=[146.83,220.00,293.66], CH_Fsm=[185.00,277.18,369.99],
      CH_Bm=[123.47,185.00,246.94], CH_G=[196.00,293.66,392.00],
      CH_A=[220.00,329.63,440.00];
/* Six chords, not five: the fifth wall added a line and the bed had to grow
   by one chord rather than by a longer one. It still lands home on D — twice,
   so the last card rings out. */
const PROG=[CH_D,CH_Fsm,CH_Bm,CH_G,CH_D,CH_D];
const CHORD=/*__CHORD__*/;

/* Low while he speaks, up in the gaps. Both numbers are quiet on purpose: a
   bed a room notices is a bed that is too loud. */
const BED_LO = 0.085, BED_HI = 0.30;
function bedGain(g, T){
  const pts = [[0, 0], [Math.max(0.35, (CUES[0] ? CUES[0].at : 1) - 0.35), BED_HI]];
  CUES.forEach(function(c, i){
    const end  = c.at + (c.dur || 2.2);
    const next = (i + 1 < CUES.length) ? CUES[i + 1].at : DUR;
    pts.push([c.at + 0.15, BED_LO]);
    pts.push([end   + 0.15, BED_LO]);
    if (next - end > 1.7){ pts.push([end + 1.0, BED_HI]); pts.push([next - 0.6, BED_HI]); }
  });
  pts.push([DUR - 4.0, BED_HI], [DUR - 0.9, BED_HI], [DUR - 0.05, 0]);
  let last = -1;
  pts.forEach(function(pt){
    if (pt[0] > last){ g.linearRampToValueAtTime(pt[1], T + pt[0]); last = pt[0]; }
  });
}

function startMusic(){
  if(music) return;
  try{
    actx=new (window.AudioContext||window.webkitAudioContext)();
    const bus=actx.createGain(); bus.gain.value=0;
    const lp=actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=680; lp.Q.value=0.4;
    bus.connect(lp); lp.connect(actx.destination);
    /* the pluck has its own path so the pad filter does not swallow it */
    const plk=actx.createGain(); plk.gain.value=1;
    const plp=actx.createBiquadFilter(); plp.type='lowpass'; plp.frequency.value=2200; plp.Q.value=0.5;
    plk.connect(plp); plp.connect(bus);
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
      sg.gain.exponentialRampToValueAtTime(0.070,on+2.6);
      sg.gain.setValueAtTime(0.070,off-2.4);
      sg.gain.exponentialRampToValueAtTime(0.0001,off);
      sub.connect(sg); sg.connect(bus); sub.start(on); sub.stop(off+0.1);

      /* four notes across the chord — root, third, fifth, root an octave up */
      const notes=[chord[0]*2, chord[1]*2, chord[2]*2, chord[0]*4];
      notes.forEach(function(f,ni){
        const when=on+0.35+ni*(CHORD/4.2);
        const o=actx.createOscillator(), g=actx.createGain();
        o.type='triangle'; o.frequency.value=f;
        g.gain.setValueAtTime(0.0001,when);
        g.gain.exponentialRampToValueAtTime(0.026/(1+ni*0.25), when+0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, when+1.9);
        o.connect(g); g.connect(plk); o.start(when); o.stop(when+2.0);
      });
    });
    bedGain(bus.gain, actx.currentTime);
    music={bus,lp};
    if(actx.state==='suspended') soundBlocked=true;
  }catch(e){ music=null; }
}
function stopMusic(){ try{ actx&&actx.close(); }catch(e){} actx=null; music=null; }
/* ONE VOICE AT A TIME, ALWAYS.
   Nothing in the layout should ever start a second line over the top of one
   already speaking, and the timeline is laid out so that it cannot — but a
   phone that stalls arrives at the next frame with the clock already past two
   or three cues, and firing all of them is exactly what "scrambled voices"
   sounds like. Stopping everything before speaking makes overlap impossible
   whatever the clock does; the cue loop below stops the backlog happening at
   all. Two guards for one fault, because the fault is the film sounding
   broken to a room of executives. */
function say(k){
  if(muted) return;
  hush();
  const a=audio[k]; if(!a) return;
  try{ a.muted=false; a.currentTime=0; const p=a.play();
       if(p&&p.catch) p.catch(()=>{soundBlocked=true;paintSound();}); }catch(e){}
}
function hush(){ Object.values(audio).forEach(a=>{try{a.pause();a.currentTime=0;}catch(e){}}); }
/* No name on the screen. The chrome is two controls and nothing else. */
function paintSound(){
  const m=document.getElementById('mute'), p=document.getElementById('pp'),
        h=document.getElementById('hint');
  if(m){ m.classList.toggle('off',muted); m.title = muted?'Sound on':'Sound off'; }
  if(p){ p.classList.toggle('paused',paused||!started); p.title = paused?'Play':'Pause'; }
  if(h && soundBlocked && !muted) h.textContent='tap for sound';
}
document.getElementById('mute').onclick=function(e){
  e.stopPropagation();
  muted=!muted;
  if(muted){ hush(); if(music) music.bus.gain.value=0; }
  else { soundBlocked=false; try{ actx&&actx.state==='suspended'&&actx.resume(); }catch(e2){} }
  paintSound();
};
document.addEventListener('click',function(){
  soundBlocked=false;
  try{ actx&&actx.state==='suspended'&&actx.resume(); }catch(e){}
  paintSound();
});
/* Tapping the picture pauses, the way every player behaves — but NOT the tap
   that starts it. The gate carries its own inline onclick, and an inline
   handler on the target runs before any listener on the document, so the
   opening tap arrived here with started already true and paused the film on
   frame one. Every scene and every line was lost behind that. Half a second is
   longer than any real double-tap and shorter than anyone's second thought. */
document.addEventListener('click',function(){
  if(started && !paused && performance.now()-startedAt < 500) return;
  if(started) togglePause();
});

let t0=null,pausedAt=0,raf=null,ended=false;
function tick(ts){
  if(paused) return;
  if(!t0) t0=ts-pausedAt*1000;
  const t=(ts-t0)/1000;
  document.getElementById('prog').style.width=Math.min(100,t/DUR*100)+'%';
  SCENES.forEach(([id,a,b])=>document.getElementById(id).classList.toggle('on',t>=a&&t<b));
  /* Collapse a backlog rather than playing it. If the clock has jumped — a
     phone waking, a tab coming back, a slow first frame — several cues can be
     due in the same tick. Speak only the one the film has actually reached and
     count the rest as gone; a line half a second late is worth hearing, three
     lines together is not worth anything. */
  let due=-1;
  CUES.forEach((c,i)=>{ if(t>=c.at && !fired.has(i)){ fired.add(i); due=i; } });
  if(due>=0) say(CUES[due].key);
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
  stopLoop(); hush(); stopMusic();
  fired=new Set(); t0=null; pausedAt=0; paused=false; ended=false;
  document.getElementById('replay').style.display='none';
  document.getElementById('hint').textContent='space or tap pauses · R replays';
  started=false; startMusic(); paintSound();
  if(audioReady()) begin();
  else { var g=document.getElementById('gate'); if(g) g.classList.add('on'); }
}
/* Pause and play, from the button or the space bar — one implementation, so
   the two can never disagree about what state the film is in. */
function togglePause(){
  if(!started || ended) return;
  paused=!paused;
  if(paused){ stopLoop(); pausedAt=(performance.now()-t0)/1000; hush();
              try{actx&&actx.suspend();}catch(e){} }
  else { t0=null; try{actx&&actx.resume();}catch(e){}
         stopLoop(); raf=requestAnimationFrame(tick); }
  paintSound();
}
document.getElementById('pp').onclick=function(e){ e.stopPropagation(); togglePause(); };
document.addEventListener('keydown',function(e){
  if(e.key===' '){ e.preventDefault(); togglePause(); }
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
function audioReady(){ return !!actx && actx.state === 'running'; }

/* Never leave a second clock running. Two rAF loops both calling say() is the
   other half of what a duplicated voice sounds like. */
function stopLoop(){ if(raf) cancelAnimationFrame(raf); raf=null; }

function begin(){
  if (started) return;
  started = true;
  startedAt = performance.now();
  var g = document.getElementById('gate'); if (g) g.classList.remove('on');
  t0 = null; pausedAt = 0; fired = new Set();
  stopLoop();
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
      /* The primer leaves every line MUTED and say() unmutes the one it is
         about to speak. Handing the mute back here opened a window in which a
         primed element that had not finished pausing was audible — thirteen of
         them, at once, on the tap. */
      if (pr && pr.then) pr.then(function(){ a.pause(); a.currentTime = 0; })
                           .catch(function(){});
      else { a.pause(); a.currentTime = 0; }
    } catch (e) {}
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

