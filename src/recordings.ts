import type { Cue } from "./sound-events.ts";
import { fieldTakes } from "./audio/field-takes.ts";
import { soundFor } from "./audio/sound-design.ts";
import { ARENA } from "./battlefield.ts";

export const stereoPosition=(x: number)=>Math.max(-.72,Math.min(.72,(x/ARENA.width-.5)*1.44));

export function prepareRecordings() {
  const bytes = fetch(new URL("./audio/field-sounds.mp3",import.meta.url))
    .then(response=>response.ok ? response.arrayBuffer() : undefined).catch(()=>undefined);
  let audio: AudioBuffer | undefined;
  let decoding: Promise<void> | undefined;
  function decode(ctx: BaseAudioContext) {
    if(!decoding)decoding=(async()=>{
      const data=await bytes;
      if(data)audio=await ctx.decodeAudioData(data.slice(0));
    })().catch(()=>{decoding=undefined;});
    return decoding;
  }
  // Decode once, ahead of the first gesture when possible. Both playground clocks share it.
  const warm=Promise.resolve().then(()=>{
    if(typeof OfflineAudioContext!=="undefined")return decode(new OfflineAudioContext(1,1,32000));
  }).catch(()=>{});

  return {
    unlock(ctx: AudioContext){void warm.then(()=>{if(!audio)void decode(ctx);});},
    play(cue: Cue,ctx: AudioContext,output: AudioNode,pitch: number) {
      if(!audio)return false;
      const layers=soundFor(cue);
      if(!layers?.length)return false;
      const now=ctx.currentTime+.004;
      const hops=cue.chain?.length || 1;
      for(let i=0;i<hops;i++){
        const pan=ctx.createStereoPanner();
        pan.pan.value=stereoPosition(cue.chain?.[i]??cue.x);
        pan.connect(output);
        let playing=layers.length;
        for(const layer of layers){
          // Keep each human's hurt voice. Mix the high bits for other repeated motions
          // so a cooldown divisible by the number of takes doesn't always pick one.
          const choice=cue.kind==="hit" ? cue.seed : Math.imul(cue.seed,2654435761)>>>16;
          const name=typeof layer.take==="string" ? layer.take : layer.take[choice%layer.take.length];
          const [offsetMs,takeMs]=fieldTakes[name];
          const length=Math.min(takeMs/1000,layer.limit??Infinity);
          const at=now+i*.047+layer.delay;
          const src=ctx.createBufferSource(), gain=ctx.createGain();
          src.buffer=audio;
          src.playbackRate.value=pitch*layer.speed*(1+i*.024);
          const end=at+length/src.playbackRate.value;
          const level=layer.gain*(cue.kind==="facet" ? 1+.065*((cue.level??1)-1) : 1)/(1+i*.25);
          gain.gain.setValueAtTime(level,at);
          gain.gain.setValueAtTime(level,Math.max(at,end-.009));
          gain.gain.linearRampToValueAtTime(0,end);
          src.connect(gain);gain.connect(pan);
          src.onended=()=>{src.disconnect();gain.disconnect();if(--playing===0)pan.disconnect();};
          src.start(at,offsetMs/1000,length);
        }
      }
      return true;
    },
  };
}
