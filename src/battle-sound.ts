import { ARENA } from "./battlefield.ts";
import { battleCues, pausedPlacementCues, spellOpening, createCueMixer, type Cue } from "./sound-events.ts";
import type { FieldSpell } from "./spells.ts";
import { FOLEY_RATE, renderScore, type Score } from "./audio/foley.ts";
import { scoreForCue } from "./audio/scorebook.ts";
import { prepareRecordings } from "./recordings.ts";
import type { World } from "./room-protocol.ts";

const stereoPosition=(x: number)=>Math.max(-.72,Math.min(.72,(x/ARENA.width-.5)*1.44));

function instrument(ctx: AudioContext, output: AudioNode, recordings: ReturnType<typeof prepareRecordings>, sounds: Map<Score,AudioBuffer>) {
  const buffer = ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let bits = 731027;
  for (let i=0; i<samples.length; i++) {
    bits = (Math.imul(bits,1664525)+1013904223) >>> 0;
    samples[i] = bits/2147483648-1;
  }
  return function play(cue: Cue) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = stereoPosition(cue.x);
    pan.connect(output);
    const now = ctx.currentTime+.004;
    const variation = ((Math.imul(cue.seed,2654435761) >>> 0)%101)/100;
    const pitch = .93+.14*variation;
    const score=scoreForCue(cue);
    if(score){
      let sample=sounds.get(score);
      if(!sample){
        const pcm=renderScore(score);
        sample=ctx.createBuffer(1,pcm.length,FOLEY_RATE);
        sample.getChannelData(0).set(pcm); sounds.set(score,sample);
      }
      const level=cue.kind==="place" ? .64 : cue.kind==="spellSet" ? .56 : cue.unit ? .54 : .77;
      const steps=cue.chain?.length || 1;
      for(let i=0;i<steps;i++){
        const at=now+i*.055, src=ctx.createBufferSource(), gain=ctx.createGain();
        const position=i===0 ? pan : ctx.createStereoPanner();
        if(i>0)position.connect(output);
        if(cue.chain?.length)position.pan.value=stereoPosition(cue.chain[i]);
        src.buffer=sample;
        src.playbackRate.value=pitch*2**(((cue.level??1)-1+i)*2/12);
        gain.gain.value=level/(1+i*.26);
        src.connect(gain); gain.connect(position);
        src.onended=()=>{src.disconnect();gain.disconnect();position.disconnect();};
        src.start(at);
      }
      return;
    }
    if(recordings.play(cue,ctx,pan,pitch))return;
    let layers = 0;
    function envelope(node: AudioScheduledSourceNode, source: AudioNode, at: number, duration: number, peak: number, attack: number) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(.0001,at); gain.gain.exponentialRampToValueAtTime(peak,at+attack);
      gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
      source.connect(gain); gain.connect(pan); layers++;
      node.onended = () => { node.disconnect(); source.disconnect(); gain.disconnect(); if (--layers === 0) pan.disconnect(); };
    }
    function tone(hz: number, end: number, duration: number, peak: number, type: OscillatorType = "sine", offset = 0, attack = .004) {
      const at = now+offset, osc = ctx.createOscillator(); osc.type = type;
      osc.frequency.setValueAtTime(hz*pitch,at); osc.frequency.exponentialRampToValueAtTime(end*pitch,at+duration);
      envelope(osc,osc,at,duration,peak,attack); osc.start(at); osc.stop(at+duration);
    }
    function noise(hz: number, end: number, duration: number, peak: number, attack = .004, offset = 0) {
      const at = now+offset, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      src.buffer = buffer; filter.type = "bandpass"; filter.Q.value = .78; src.connect(filter);
      filter.frequency.setValueAtTime(hz*pitch,at); filter.frequency.exponentialRampToValueAtTime(end*pitch,at+duration);
      envelope(src,filter,at,duration,peak,attack); src.start(at,variation*(1-duration)); src.stop(at+duration);
    }
    switch (cue.kind) {
      case "portalOpen":
        noise(480,2300,.27,.18,.085);tone(280,550,.22,.14,"sine",0,.065);tone(414,818,.19,.075,"sine",.035,.06);break;
      case "wormhole":
        tone(930,284,.13,.18,"triangle");tone(306,1050,.22,.19,"sine",.10,.033);
        noise(1700,4600,.14,.13,.035,.13);break;
      case "prism":
        tone(490,704,.22,.073,"sine",0,.048);
        tone(849,1060,.17,.032,"sine",.058,.044); break;
      case "stoneGaze":
        noise(2900,970,.21,.24,.064);tone(760,307,.19,.10,"triangle",.035,.032);noise(1370,850,.10,.19,.004,.16);break;
      case "fireBreath":
        noise(410,1200,.38,.43,.058);noise(2800,760,.31,.35,.042,.08);tone(109,62,.34,.12,"triangle",.02,.065);break;
      case "breach":
        noise(350,160,.32,.38,.038);noise(1370,485,.22,.26,.021,.045);
        for(let i=0;i<3;i++) noise(1100+i*260,460,.052,.13,.005,.13+i*.055);break;
      case "snow":
        noise(2140,900,.10,.26,.016);noise(4100,2450,.06,.14,.011,.022);break;
      case "squelch":
        tone(170,459,.079,.17,"sine",0,.016);tone(427,95,.12,.19,"triangle",.052);noise(920,340,.085,.12,.009,.057);break;
      case "cymbals":
        noise(6100,3350,.27,.31);tone(1920,1850,.18,.07,"triangle");tone(2961,2870,.13,.065);break;
      case "flutter":
        for(let i=0;i<3;i++) noise(1520,620,.058,.15-i*.018,.019,i*.055);
        break;
      case "fan":
        noise(720,2400,.16,.15,.046); noise(2050,1100,.16,.095,.028,.065);
        tone(315,495,.13,.035,"sine",.012,.04); break;
      case "hatch":
        tone(250,475,.17,.07,"sawtooth",0,.034);noise(960,471,.08,.25,.008,.155);tone(205,117,.095,.12,"triangle",.15);break;
      case "anvil":
        tone(415,397,.29,.16,"triangle");tone(1178,1130,.21,.095);tone(1749,1696,.13,.06);noise(2750,870,.061,.22);break;
      case "place": tone(410,210,.059,.10,"sine"); noise(1250,690,.045,.075); break;
      case "bowDraw": noise(690,2220,.26,.25,.115);noise(1250,850,.12,.13,.042,.09);break;
      case "bow": tone(238,183,.20,.20,"triangle");tone(728,525,.095,.10);noise(5400,2600,.042,.16);break;
      case "shot": noise(3400,660,.105,.29); tone(185,72,.145,.15,"triangle"); break;
      case "hit": case "beastHurt": noise(580,320,.14,.34,.018);tone(156,93,.16,.18,"sawtooth",.01,.017);break;
      case "clash": case "block": tone(1180,1160,.23,.18);tone(2910,2840,.14,.12);noise(4200,2900,.035,.21);break;
      case "wood": noise(850,430,.085,.33);tone(210,165,.10,.13,"triangle");break;
      case "metal": tone(712,682,.24,.18);tone(1593,1570,.15,.13);noise(3200,1580,.043,.24);break;
      case "bolt": noise(3000,1350,.06,.32);tone(540,360,.045,.10,"square");break;
      case "glass":
        noise(7000,3100,.065,.38);for(const [i,hz] of [1640,2460,3210,1970,4700].entries())tone(hz,hz*.985,.19-i*.014,.155/(1+i*.16),"sine",i*i*.007);break;
      case "charge": case "roar": case "groan":
        tone(135,77,.33,.13,"sawtooth",.015,.04);noise(960,380,.30,.31,.045);break;
      case "howl": tone(290,826,.34,.18,"triangle",0,.11);tone(800,423,.36,.17,"sine",.23,.055);break;
      case "whisper": noise(600,1840,.35,.28,.065);break;
      case "squeal": case "squeak": tone(1350,2230,.067,.13);tone(2110,990,.13,.15,"triangle",.045);break;
      case "screech": case "birdHurt": {
        const long=cue.kind==="screech";
        tone(1320,2380,.115,.17,"triangle",0,.021);tone(2110,1240,long?.25:.115,.17,"sine",.068);
        noise(4300,2500,long?.24:.14,.24,.031);if(long)tone(1700,2260,.075,.10,"sine",.24);break;
      }
      case "lightning":
        noise(8600,700,.09,.83);noise(5300,300,.19,.74,.004,.043);noise(630,120,.49,.64,.045,.08);
        tone(105,42,.46,.35,"triangle",.065,.028);break;
      case "smash": tone(153,59,.22,.26); noise(800,230,.16,.22); break;
      case "reflect": tone(1440,980,.19,.105); tone(870,1290,.095,.07,"triangle"); break;
      case "fall":
        noise(650,2900,.72,.24,.40);
        tone(700,247,.64,.041,"sine",.02,.28); break;
      case "impact":
        tone(162,45,.38,.43); tone(254,97,.20,.17,"triangle");
        noise(2400,360,.27,.54); noise(1400,510,.14,.17,.005,.09); break;
    }
  };
}

export function createBattleSound(button: HTMLButtonElement) {
  const recordings = prepareRecordings();
  const sounds = new Map<Score,AudioBuffer>();
  const storage = "battle.sound.muted";
  let muted = false;
  let paused = false;
  const heldSpells = new WeakSet<FieldSpell>();
  try { muted = localStorage.getItem(storage) === "true"; } catch { /* Optional preference. */ }
  function createOutput() {
    const ctx = new AudioContext({latencyHint:"interactive"});
    const master = ctx.createGain();
    master.gain.value = .9;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -11; compressor.ratio.value = 5;
    master.connect(compressor); compressor.connect(ctx.destination);
    recordings.unlock(ctx);
    const play = instrument(ctx,master,recordings,sounds), mix = createCueMixer();
    function hear(cues: readonly Cue[]) {
      for (const cue of mix(cues,ctx.currentTime)) play(cue);
    }
    return {ctx, master, hear};
  }
  let battle: ReturnType<typeof createOutput> | undefined;
  let pausedBrush: ReturnType<typeof createOutput> | undefined;
  function wake(ctx: AudioContext) {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  }
  function unlock() {
    if (muted || document.hidden || typeof AudioContext === "undefined") return;
    if (!paused) {
      battle ??= createOutput();
      wake(battle.ctx);
    }
    if (pausedBrush) wake(pausedBrush.ctx);
  }
  function label() {
    button.setAttribute("aria-pressed",String(muted));
    button.setAttribute("aria-description",(muted ? "Unmute sound" : "Mute sound")+" (M)");
  }
  function toggle() {
    muted = !muted; label(); unlock();
    for (const output of [battle, pausedBrush]) {
      if (!output) continue;
      const now = output.ctx.currentTime;
      output.master.gain.cancelScheduledValues(now);
      output.master.gain.setTargetAtTime(muted ? 0 : .9,now,.008);
    }
    try { localStorage.setItem(storage,String(muted)); } catch { /* Optional preference. */ }
  }
  label(); button.addEventListener("click",toggle);
  window.addEventListener("pointerdown",unlock,{capture:true,passive:true});
  // On touch screens a first tap can unlock audio only when the finger lifts.
  window.addEventListener("pointerup",unlock,{capture:true,passive:true});
  window.addEventListener("keydown",e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable=true]")) return;
    if (e.key.toLowerCase() === "m" && !e.repeat) { e.preventDefault(); toggle(); }
    else unlock();
  });
  function hear(before: World | undefined, world: World, signals: readonly Cue[]=[]) {
    if (muted || document.hidden) return;
    if (paused) {
      const cues = pausedPlacementCues(before,world);
      if (!cues.length || typeof AudioContext === "undefined") return;
      for(const spell of world.spells??[])
        if(before?.tick===world.tick && !before.spells?.some(s=>s.id===spell.id))heldSpells.add(spell);
      // A separate audio clock lets the brush play while a roar or spell is held mid-sound.
      pausedBrush ??= createOutput();
      wake(pausedBrush.ctx);
      pausedBrush.hear(cues);
    } else if (battle) {
      const battleEvents=battleCues(before,world);
      const cues=signals.length ? [...signals,...battleEvents] : battleEvents;
      if(battle.ctx.state==="running")battle.hear(cues);
      else if(navigator.userActivation?.isActive)battle.hear(cues.filter(c=>c.kind==="place" || before?.tick===world.tick));
    }
  }
  function pauseSound(hold: boolean, world: World) {
    if (hold === paused) return;
    paused = hold;
    if (hold) { void battle?.ctx.suspend().catch(() => {}); return; }
    unlock();
    const launches: Cue[]=[];
    for(const spell of world.spells??[]) if(heldSpells.delete(spell)){
      const opening=spellOpening(spell);
      if(opening.kind!=="spellSet")launches.push(opening);
    }
    if(!muted && !document.hidden)battle?.hear(launches);
  }
  return {hear, pauseSound};
}
