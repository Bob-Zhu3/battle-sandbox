import { battleCues, pausedPlacementCues, spellOpening, createCueMixer, type Cue } from "./sound-events.ts";
import type { FieldSpell } from "./spells.ts";
import { prepareRecordings, stereoPosition } from "./recordings.ts";
import type { World } from "./room-protocol.ts";

function instrument(ctx: AudioContext, output: AudioNode, recordings: ReturnType<typeof prepareRecordings>) {
  const noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const samples=noise.getChannelData(0);
  let bits=731027;
  for(let i=0;i<samples.length;i++){
    bits=(Math.imul(bits,1664525)+1013904223)>>>0;
    samples[i]=bits/2147483648-1;
  }
  return function play(cue: Cue) {
    const variation=((Math.imul(cue.seed,2654435761)>>>0)%101)/100;
    if(cue.kind!=="place" && recordings.play(cue,ctx,output,.96+.08*variation))return;

    const pan=ctx.createStereoPanner(), at=ctx.currentTime+.004;
    pan.pan.value=stereoPosition(cue.x); pan.connect(output);
    let playing=0;
    function envelope(src: AudioScheduledSourceNode, signal: AudioNode, seconds: number, peak: number, attack: number) {
      const gain=ctx.createGain();
      gain.gain.setValueAtTime(.0001,at); gain.gain.exponentialRampToValueAtTime(peak,at+attack);
      gain.gain.exponentialRampToValueAtTime(.0001,at+seconds);
      signal.connect(gain); gain.connect(pan); playing++;
      src.onended=()=>{src.disconnect();if(signal!==src)signal.disconnect();gain.disconnect();if(--playing===0)pan.disconnect();};
    }
    function filteredNoise(from: number,to: number,seconds: number,volume: number,attack: number,offset: number) {
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
      source.buffer=noise; filter.type="bandpass"; filter.Q.value=.78;
      filter.frequency.setValueAtTime(from,at); filter.frequency.exponentialRampToValueAtTime(to,at+seconds);
      source.connect(filter); envelope(source,filter,seconds,volume,attack);
      source.start(at,offset*(1-seconds)); source.stop(at+seconds);
    }
    if(cue.kind==="place"){
      // The original 59 ms brush tap. Team, troop, and stroke length use the same sound.
      const tap=ctx.createOscillator();
      tap.type="sine"; tap.frequency.setValueAtTime(410,at); tap.frequency.exponentialRampToValueAtTime(210,at+.059);
      envelope(tap,tap,.059,.10,.004); tap.start(at); tap.stop(at+.059);
      filteredNoise(1250,690,.045,.075,.004,.5);
      return;
    }
    // A cold or unavailable recording should acknowledge the current action immediately.
    // Keep it unpitched and short, so an old attack never needs to be played later.
    switch(cue.kind){
      case "impact": case "lightning": case "bombBlast": case "keepFall": case "smash":
        filteredNoise(1600,170,.28,.80,.005,variation);break;
      case "fall": case "gust": case "rain":
        filteredNoise(520,1900,.42,.22,.10,variation);break;
      case "bowDraw": case "fireBreath": case "scythe": case "sails":
        filteredNoise(900,2300,.18,.24,.045,variation);break;
      case "glass": case "freeze": case "frostLand": case "thunder":
        filteredNoise(6200,1400,.11,.42,.002,variation);break;
      default:
        filteredNoise(950,320,.075,.27,.004,variation);
    }
  };
}

export function createBattleSound(button: HTMLButtonElement) {
  const recordings = prepareRecordings();
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
    const play = instrument(ctx,master,recordings), mix = createCueMixer();
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
