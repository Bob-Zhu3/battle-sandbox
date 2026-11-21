import { ARENA } from "./battlefield.ts";
import { battleCues, soundGaps, type Cue, type CueKind } from "./sound-events.ts";
import type { World } from "./room-protocol.ts";

function instrument(ctx: AudioContext, output: AudioNode) {
  const buffer = ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let bits = 731027;
  for (let i=0; i<samples.length; i++) {
    bits = (Math.imul(bits,1664525)+1013904223) >>> 0;
    samples[i] = bits/2147483648-1;
  }
  return function play(cue: Cue) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-.72,Math.min(.72,(cue.x/ARENA.width-.5)*1.44));
    pan.connect(output);
    const now = ctx.currentTime+.004;
    const variation = ((Math.imul(cue.seed,2654435761) >>> 0)%101)/100;
    const pitch = .93+.14*variation;
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
      case "place": tone(410,210,.059,.10,"sine"); noise(1250,690,.045,.075); break;
      case "bow": noise(3500,1500,.07,.095); tone(640,280,.105,.071,"triangle"); break;
      case "shot": noise(3400,660,.105,.29); tone(185,72,.145,.15,"triangle"); break;
      case "hit": noise(1540,660,.057,.17); tone(191,96,.085,.14,"triangle"); break;
      case "block": tone(1050,875,.09,.082,"triangle"); tone(560,390,.10,.13); break;
      case "thunder": noise(4900,960,.12,.24); noise(3100,480,.085,.17,.004,.047); break;
      case "smash": tone(153,59,.22,.26); noise(800,230,.16,.22); break;
      case "rain": tone(870,690,.15,.072); tone(1190,960,.13,.056,"sine",.075); break;
      case "gust": noise(530,2450,.25,.19,.076); break;
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
  const storage = "battle.sound.muted";
  let muted = false;
  try { muted = localStorage.getItem(storage) === "true"; } catch { /* Optional preference. */ }
  let ctx: AudioContext | undefined, master: GainNode | undefined, play: ReturnType<typeof instrument> | undefined;
  let lastOrdinary = -Infinity;
  const last = new Map<CueKind,number>();
  function unlock() {
    if (muted || document.hidden || typeof AudioContext === "undefined") return;
    if (!ctx) {
      ctx = new AudioContext({latencyHint:"interactive"});
      master = ctx.createGain(); master.gain.value = .62;
      const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -15; compressor.ratio.value = 6;
      master.connect(compressor); compressor.connect(ctx.destination);
      play = instrument(ctx,master);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  }
  function label() {
    button.setAttribute("aria-pressed",String(muted));
    button.title = (muted ? "Unmute sound" : "Mute sound") + " (M)";
  }
  function toggle() {
    muted = !muted; label(); unlock();
    if (ctx && master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(muted ? 0 : .62,ctx.currentTime,.008); }
    try { localStorage.setItem(storage,String(muted)); } catch { /* Optional preference. */ }
  }
  label(); button.addEventListener("click",toggle);
  window.addEventListener("pointerdown",unlock,{capture:true,passive:true});
  window.addEventListener("keydown",e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable=true]")) return;
    if (e.key.toLowerCase() === "m" && !e.repeat) { e.preventDefault(); toggle(); }
    else unlock();
  });
  return function hear(before: World | undefined, world: World) {
    if (!ctx || !play || ctx.state !== "running" || muted || document.hidden) return;
    let voices = 0;
    for (const cue of battleCues(before,world)) {
      const now = ctx.currentTime, landmark = cue.kind === "impact" || cue.kind === "fall";
      if (now-(last.get(cue.kind) ?? -Infinity) < soundGaps[cue.kind] || (!landmark && now-lastOrdinary < .046)) continue;
      last.set(cue.kind,now);
      if (!landmark) lastOrdinary = now;
      play(cue);
      if (++voices === 2) break;
    }
  };
}
