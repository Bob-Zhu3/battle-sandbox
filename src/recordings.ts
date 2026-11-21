import type { Cue, CueKind } from "./sound-events.ts";

// The recordings share one download. Each take names its slot and its unpadded length in seconds.
const takes = {
  draw: [0,.305], loose: [1,.180], gruntA: [2,.357], yelpA: [3,.350], gruntB: [4,.440],
  shoutA: [5,.440], shoutB: [6,.396], glassA: [7,.820], glassB: [8,.970], howl: [9,.850],
  roar: [10,.510], groan: [11,.536], growl: [12,.500], squeal: [13,.420], sword: [14,.400],
  shield: [15,.390], breath: [16,.420], yelpB: [17,.490], whine: [18,.419],
} as const;
type Take = keyof typeof takes;
const cuts = {
  bowDraw:[.49,["draw"]], bow:[.76,["loose"]], hit:[.48,["gruntA","yelpA","gruntB","yelpB"]],
  charge:[.72,["shoutA","shoutB"]], glass:[.77,["glassA","glassB"]], howl:[.60,["howl"]],
  roar:[.70,["roar"]], groan:[.51,["groan"]], beastHurt:[.50,["growl","whine"]], squeal:[.45,["squeal"]],
  clash:[.43,["sword","shield"]], block:[.74,["shield","sword"]], whisper:[.63,["breath"]],
} as const satisfies Partial<Record<CueKind,readonly [number,readonly Take[]]>>;

export function prepareRecordings() {
  const bytes = fetch(new URL("./audio/field-sounds.mp3",import.meta.url))
    .then(response => response.ok ? response.arrayBuffer() : undefined).catch(() => undefined);
  let audio: AudioBuffer | undefined;
  async function decode(ctx: BaseAudioContext) {
    const data = await bytes;
    if (data && !audio) audio = await ctx.decodeAudioData(data.slice(0));
  }
  // Decode ahead of the first gesture wherever the browser supports silent offline decoding.
  const warm = Promise.resolve().then(() => {
    if (typeof OfflineAudioContext !== "undefined") return decode(new OfflineAudioContext(1,1,32000));
  }).catch(() => {});
  return {
    unlock(ctx: AudioContext) {
      void warm.then(() => { if (!audio) return decode(ctx); }).catch(() => {});
    },
    play(cue: Cue,ctx: AudioContext,pan: StereoPannerNode,pitch: number) {
      if (!audio || !Object.hasOwn(cuts,cue.kind)) return false;
      const [volume,options] = cuts[cue.kind as keyof typeof cuts];
      const [slot,duration] = takes[options[cue.seed % options.length]];
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = audio;
      source.playbackRate.value = pitch;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(pan);
      source.onended = () => { source.disconnect(); gain.disconnect(); pan.disconnect(); };
      source.start(ctx.currentTime + .003,slot * 1.25,duration);
      return true;
    },
  };
}
