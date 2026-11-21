import { ARENA } from "./battlefield.ts";
import { battleCues, createCueMixer, type Cue } from "./sound-events.ts";
import { prepareRecordings } from "./recordings.ts";
import type { World } from "./room-protocol.ts";

function instrument(ctx: AudioContext, output: AudioNode, recordings: ReturnType<typeof prepareRecordings>) {
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
      case "place": tone(410,210,.059,.10,"sine"); noise(1250,690,.045,.075); break;
      case "bowDraw": noise(690,2220,.26,.25,.115);noise(1250,850,.12,.13,.042,.09);break;
      case "bow": tone(238,183,.20,.20,"triangle");tone(728,525,.095,.10);noise(5400,2600,.042,.16);break;
      case "shot": noise(3400,660,.105,.29); tone(185,72,.145,.15,"triangle"); break;
      case "hit": case "beastHurt": noise(580,320,.14,.34,.018);tone(156,93,.16,.18,"sawtooth",.01,.017);break;
      case "clash": case "block": tone(1180,1160,.23,.18);tone(2910,2840,.14,.12);noise(4200,2900,.035,.21);break;
      case "wood": noise(850,430,.085,.33);tone(210,165,.10,.13,"triangle");break;
      case "metal": tone(712,682,.24,.18);tone(1593,1570,.15,.13);noise(3200,1580,.043,.24);break;
      case "bolt": noise(3000,1350,.06,.32);tone(540,360,.045,.10,"square");break;
      case "toss": noise(540,1500,.12,.13,.055);break;
      case "fuse": noise(3800,6200,.17,.21,.028);noise(4900,2200,.05,.15,.003,.07);break;
      case "dart": noise(1300,3500,.11,.24,.025);break;
      case "shard": tone(1430,2050,.15,.11);tone(2050,2310,.095,.08);break;
      case "hex": tone(480,250,.22,.13,"triangle");tone(610,375,.19,.09,"sine",.055);break;
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
      case "freeze":
        noise(5600,2400,.37,.24,.07);for(const [i,hz] of [1850,2480,3350,2780].entries())tone(hz,hz*1.016,.24,.14-i*.013,"sine",i*.032,.007);break;
      case "lightning":
        noise(8600,700,.09,.83);noise(5300,300,.19,.74,.004,.043);noise(630,120,.49,.64,.045,.08);
        tone(105,42,.46,.35,"triangle",.065,.028);break;
      case "rage":
        tone(221,290,.21,.22,"sawtooth",0,.047);tone(332,428,.31,.14,"triangle",.095,.046);
        noise(590,2000,.34,.22,.085);break;
      case "thunder": noise(4900,960,.12,.24); noise(3100,480,.085,.17,.004,.047); break;
      case "smash": tone(153,59,.22,.26); noise(800,230,.16,.22); break;
      case "toll": tone(325,307,.48,.17); tone(823,787,.28,.083); tone(1214,1184,.14,.04); break;
      case "lens": tone(520,760,.12,.065,"triangle"); tone(1030,1460,.085,.03); break;
      case "sling": noise(800,2200,.10,.15); tone(244,125,.12,.085,"triangle"); break;
      case "fault": noise(760,160,.31,.24,.02); tone(110,45,.29,.21); break;
      case "briar": noise(1900,960,.12,.13); tone(305,540,.10,.075,"triangle"); break;
      case "mirror": tone(750,980,.22,.065); tone(1100,1440,.18,.04,"sine",.04); break;
      case "reflect": tone(1440,980,.19,.105); tone(870,1290,.095,.07,"triangle"); break;
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
  const recordings=prepareRecordings(), mix=createCueMixer();
  const storage = "battle.sound.muted";
  let muted = false;
  try { muted = localStorage.getItem(storage) === "true"; } catch { /* Optional preference. */ }
  let ctx: AudioContext | undefined, master: GainNode | undefined, play: ReturnType<typeof instrument> | undefined;
  function unlock() {
    if (muted || document.hidden || typeof AudioContext === "undefined") return;
    if (!ctx) {
      ctx = new AudioContext({latencyHint:"interactive"});
      master = ctx.createGain(); master.gain.value = .9;
      const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -11; compressor.ratio.value = 5;
      master.connect(compressor); compressor.connect(ctx.destination);
      recordings.unlock(ctx);play = instrument(ctx,master,recordings);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  }
  function label() {
    button.setAttribute("aria-pressed",String(muted));
    button.title = (muted ? "Unmute sound" : "Mute sound") + " (M)";
  }
  function toggle() {
    muted = !muted; label(); unlock();
    if (ctx && master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(muted ? 0 : .9,ctx.currentTime,.008); }
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
    for (const cue of mix(battleCues(before,world),ctx.currentTime)) play(cue);
  };
}
