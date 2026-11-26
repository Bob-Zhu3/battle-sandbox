// Short mono performances. Each score is rendered once, then a hit costs one buffer voice.
export const FOLEY_RATE = 24000;
export interface Layer {
  kind: "wood" | "iron" | "glass" | "stone" | "hide" | "string" | "air" | "note" | "voice";
  at: number; hz: number; end: number; length: number; gain: number; texture: number;
}
export type Score = readonly Layer[];

function material(kind: Layer["kind"]) {
  return (at: number, hz: number, length: number, gain: number): Layer =>
    ({kind,at,hz,end:hz,length,gain,texture:0});
}
export const wood=material("wood"), iron=material("iron"), glass=material("glass");
export const stone=material("stone"), hide=material("hide"), string=material("string");
export const air=(at: number,hz: number,end: number,length: number,gain: number,pulses=0): Layer =>
  ({kind:"air",at,hz,end,length,gain,texture:pulses});
export const note=(at: number,hz: number,end: number,length: number,gain: number,vibrato=0): Layer =>
  ({kind:"note",at,hz,end,length,gain,texture:vibrato});
export const voice=(at: number,hz: number,end: number,length: number,gain: number,mouth: "chest"|"nose"|"jaw"|"beak"): Layer =>
  ({kind:"voice",at,hz,end,length,gain,texture:{chest:0,nose:1,jaw:2,beak:3}[mouth]});

// Frequency ratios, relative amplitudes and decay times of struck materials.
const modes = {
  wood:  [[1,.84,.8],[2.82,.48,.48],[5.18,.23,.20]],
  iron:  [[1,.66,1],[2.73,.51,.82],[4.17,.40,.51],[6.83,.19,.34]],
  glass: [[1,.72,1],[2.32,.42,.76],[3.91,.34,.64],[6.16,.17,.4]],
  stone: [[1,.70,.75],[1.41,.48,.6],[2.84,.41,.36],[4.70,.21,.18]],
  hide:  [[1,1,1],[1.59,.39,.54],[2.14,.26,.30]],
} as const;
const formants=[[370,980,1780],[720,1770,2590],[540,1190,2180],[1100,2580,3890]];
const tau=2*Math.PI;

function noiseSource(seed: number) {
  return () => {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/2147483648-1;
  };
}

function ring(out: Float32Array, start: number, n: number, layer: Layer, partials: readonly (readonly number[])[]) {
  for (const [ratio,weight,tail] of partials) {
    const omega=tau*layer.hz*ratio/FOLEY_RATE;
    if (omega>Math.PI*.92) continue;
    const decay=Math.exp(-5/(n*tail));
    const a=2*decay*Math.cos(omega), b=decay*decay;
    let last=0, value=Math.sin(omega)*weight*layer.gain;
    for (let i=0;i<n;i++) {
      out[start+i]+=value;
      const next=a*value-b*last;
      last=value; value=next;
    }
  }
}

function pluck(out: Float32Array, start: number, n: number, l: Layer, random: () => number) {
  const delay=new Float32Array(Math.max(3,Math.round(FOLEY_RATE/l.hz-.5)));
  for (let i=0;i<delay.length;i++) delay[i]=random();
  const decay=Math.exp(-3*delay.length/n);
  let head=0;
  for (let i=0;i<n;i++) {
    const value=delay[head], next=(head+1)%delay.length;
    delay[head]=(.54*value+.46*delay[next])*decay;
    out[start+i]+=value*l.gain*Math.min(1,(n-i)/100);
    head=next;
  }
}

// A damped bandpass shapes breaths, cloth, wind and vowel resonances.
function band(hz: number, q: number) {
  let a=0,b=0,g=0,y1=0,y2=0,x1=0,x2=0;
  function tune(f: number) {
    const w=tau*Math.min(FOLEY_RATE*.45,f)/FOLEY_RATE, alpha=Math.sin(w)/(2*q);
    a=2*Math.cos(w)/(1+alpha); b=(1-alpha)/(1+alpha); g=alpha/(1+alpha);
  }
  tune(hz);
  return {tune, sample(value: number) {
    const y=g*(value-x2)+a*y1-b*y2;
    x2=x1; x1=value; y2=y1; y1=y;
    return y;
  }};
}

function sustained(out: Float32Array, start: number, n: number, l: Layer, random: () => number) {
  const sweep=Math.pow(l.end/l.hz,1/n), wind=band(l.hz,1.2);
  const vowels=l.kind==="voice" ? formants[l.texture].map(f=>band(f,3.4)) : [];
  const attack=Math.min(n*.24,FOLEY_RATE*(l.kind==="voice" ? .032 : .015));
  const release=Math.min(n*.42,FOLEY_RATE*.11);
  let hz=l.hz, phase=0, jitter=0;
  for (let i=0;i<n;i++,hz*=sweep) {
    const t=i/FOLEY_RATE, env=Math.min(1,i/attack,(n-i)/release);
    let value=0;
    if (l.kind==="air") {
      if ((i&31)===0) wind.tune(hz);
      const grain=l.texture ? .60+.40*Math.cos(t*tau*l.texture) : 1;
      value=2*wind.sample(random())*grain;
    } else if (l.kind==="voice") {
      if ((i&63)===0) jitter=random()*.017;
      phase=(phase+hz*(1+jitter+.032*Math.sin(t*tau*6))/FOLEY_RATE)%1;
      const excitation=(phase<.29 ? Math.sin(Math.PI*phase/.29) : 0)+.095*random();
      value=3.8*(vowels[0].sample(excitation)+.65*vowels[1].sample(excitation)+.34*vowels[2].sample(excitation));
    } else {
      phase+=hz*(1+l.texture*Math.sin(t*tau*6))/FOLEY_RATE;
      value=.84*Math.sin(tau*phase)+.16*Math.sin(tau*phase*2);
    }
    out[start+i]+=value*l.gain*env;
  }
}

export function renderScore(score: Score): Float32Array {
  const duration=Math.max(...score.map(l=>l.at+l.length));
  const out=new Float32Array(Math.ceil(duration*FOLEY_RATE)+2);
  score.forEach((l,index)=>{
    const start=Math.round(l.at*FOLEY_RATE), n=Math.round(l.length*FOLEY_RATE);
    const random=noiseSource(378+index*4729+Math.round(l.hz*37));
    if (l.kind==="string") pluck(out,start,n,l,random);
    else if (l.kind==="air" || l.kind==="voice" || l.kind==="note") sustained(out,start,n,l,random);
    else ring(out,start,n,l,modes[l.kind]);
  });
  // Match the loudest 20 ms, preserving the sharp crest of glass and the body of a growl.
  let peak=0, sum=0, loudest=0;
  for (let i=0;i<out.length;i++) {
    const value=out[i];
    peak=Math.max(peak,Math.abs(value)); sum+=value*value;
    if (i>=480) sum-=out[i-480]*out[i-480];
    loudest=Math.max(loudest,sum);
  }
  const gain=Math.min(3,.82/Math.max(.01,peak),.215/Math.max(.01,Math.sqrt(loudest/480)));
  for (let i=0;i<out.length;i++) out[i]*=gain*Math.min(1,(out.length-1-i)/72);
  return out;
}
