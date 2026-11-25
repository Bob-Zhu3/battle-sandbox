import { drawEffect } from "./pixel-art/effect-player.ts";
import { segment } from "./pixel-art/stamps.ts";
import { ARMIES } from "./battlefield.ts";
import { cut, line, oval, type Pens } from "./ink.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";

const tau = Math.PI*2;
export function siegeSpellIcon(c: Pens, kind: "fault"|"briar"|"mirror") {
  if(kind === "fault") {
    cut(c,"M-13 4 L-10 -.8 L-3 -4.8 L-.4 -3.4 L-3.8 .9 L.2 2.1 L-5.5 7.6 L-11 6.5Z","#aa8d69",1.2);
    cut(c,"M.7 -4.7 L7.4 -7.3 L12.4 -4 L12.8 .4 L7 2.7 L1.6 6.5 L3.5 1.5 L.6 .4 L4 -3Z","#c4a77a",1.2);
    cut(c,"M3.8 -10.6 L.8 -5.4 L3.2 -4.1 L-2.5 .6 L-.8 -3.2 L-3.3 -3.9Z","#ffd778",.75);
    line(c,-9,2.8,-5.5,.6,"#e5cf99",1.1);
  } else if(kind === "briar") {
    segment(c,-6,9,-2,5,"#244531",3);
    segment(c,-2,5,3,-2,"#244531",3);
    segment(c,3,-2,2,-8,"#244531",3);
    segment(c,-5,9,3,-2,"#83b65a",2);
    cut(c,"M-1 5 L-8 4 L-12 -2 L-6 -3 L-2 0Z","#52834c",1.2);
    cut(c,"M1 0 L4 -6 L12 -8 L11 -2 L6 1Z","#69a950",1.2);
    cut(c,"M3 -5 L-2 -8 L-4 -14 L1 -13 L4 -10Z","#91c964",1.2);
    segment(c,4,-1,9,-5,"#c3df83",1);
  } else {
    for(const [x,y,angle,size] of [[-7.3,1.7,-.39,.71],[7.1,.2,.42,.7],[0,-1,0,1]]) {
      c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);
      cut(c,"M0 -10 L6.1 -4.3 L5.1 4.5 L-.6 10.5 L-5.8 3.8 L-5.1 -5.7Z","#87c8cf",1.25);
      cut(c,"M0 -9 L-1 1 L4.7 -4.2Z","#e3f8e5",0);
      cut(c,"M-.9 1 L4.2 4 L-.5 8.7Z","#5e9da8",0); c.restore();
    }
  }
}

export function drawSiegeSpell(c: Pens, spell: FieldSpell, tick: number, sx: number, sy: number) {
  const rule=SPELLS[spell.kind], age=tick-spell.startTick, hit=age-rule.delay;
  if (hit<0) return;
  const k=Math.min(sx,sy), r=rule.radius;
  if (spell.kind==="fault") {
    // The second tremor advances the very same fissure. Both pulses use one anchor and one strip.
    const split=SPELLS.fault.aftershock-rule.delay, remaining=rule.duration-SPELLS.fault.aftershock;
    const rise=(p:number)=>1-(1-p)**2;
    const frame=hit<split ? .04+.45*rise(hit/split) : .52+.47*rise((hit-split)/remaining);
    c.save(); c.scale(1,1.5);
    drawEffect(c,"fault",0,0,frame,1,2*r*k);
    c.restore();
  } else if (spell.kind==="briar") {
    // The outer tendrils spread from the catch point, then their leaves unfurl.
    for (const side of [-1,1]) {
      const lag=side===1 ? 2 : 0;
      drawEffect(c,"tendril",-side*r*.32*sx,side*5*sy,hit-lag,rule.duration-rule.delay-lag,1.35*r*k,side);
    }
  } else if (spell.kind==="mirror") {
    const used=spell.reflection?.count ?? 0, left=SPELLS.mirror.panes-used;
    if (left) {
      c.save(); c.globalAlpha*=Math.min(1,(rule.duration-age)/14);
      drawEffect(c,"glass",0,18*k,(hit%86),86,2*r*k);
      for (let i=0;i<left;i++) {
        const a=age*.018+i*tau/3+spell.id*.29;
        const x=Math.cos(a)*r*sx, y=Math.sin(a)*r*sy;
        c.save(); c.translate(x,y); c.scale(k,k);
        segment(c,-3,0,0,-4,"#365f77",2); segment(c,0,-4,3,0,"#365f77",2);
        segment(c,3,0,0,4,"#527e91",2); segment(c,0,4,-3,0,"#527e91",2);
        segment(c,-1,0,1,-2,"#d1f9f2",2); c.restore();
      }
      c.restore();
    }
    if (spell.reflection) {
      const point=spell.reflection;
      drawEffect(c,"shards",(point.x-spell.x)*sx,(point.y-spell.y)*sy,tick-point.tick,17,(left ? 38 : 65)*k);
    }
  }
}

export function stoneMarker(c: Pens, x: number, y: number, tick: number, land: number, sx: number, sy: number, team: keyof typeof ARMIES) {
  const progress=Math.max(0,1-(land-tick)/44);
  c.save();c.translate(x*sx,y*sy);c.scale(sx,sy);c.lineWidth=1.15;c.globalAlpha=.47+.29*progress;
  c.strokeStyle=ARMIES[team].hem;
  for(let i=0;i<4;i++){c.beginPath();const a=i*tau/4+.12;c.arc(0,0,5+5*(1-progress),a,a+.76);c.stroke();}
  c.restore();
}
