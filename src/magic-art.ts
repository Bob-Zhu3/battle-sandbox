import { indexPixels } from "./pixel-art/palette.ts";
import { segment } from "./pixel-art/stamps.ts";
import { drawEffect } from "./pixel-art/effect-player.ts";
import { ARMIES } from "./battlefield.ts";
import { INK, cut, line, oval, type Pens } from "./ink.ts";
import { SPELLS, type FieldSpell, type SpellKind } from "./spells.ts";
import { drawSiegeSpell, siegeSpellIcon } from "./siege-magic-art.ts";
import { drawWeatherField, weatherIcon } from "./weather-art.ts";
import { drawWormhole, wormholeIcon } from "./legend-effects.ts";

function meteorIcon(c: Pens) {
  c.lineJoin="round";
  cut(c,"M-4.8 -1.6 Q-6.5 -6.7 -5.4 -12.8 Q-2.7 -10.15 -2.3 -8.3 Q.1 -13.05 -.8 -17 Q4.5 -12.1 4.9 -4.0 L3.7 -1Z","#f4ae58",1);
  cut(c,"M-6.25 -.55 Q-5.95 -5.35 -1.95 -6.55 Q2.5 -7.3 5.55 -3.6 Q7.55 .25 5.1 4.45 Q2.1 7.3 -2.85 5.85 Q-6.3 4.05 -6.25 -.55Z","#e7924c",1.55);
  cut(c,"M-4.55 -.5 Q-2.95 1.1 -.6 2.1 Q1.7 2.4 2.8 4.1 Q.4 5.6 -2.1 4.3 Q-4.45 2.95 -4.55 -.5Z","#b86946",0);
  oval(c,2.65,-2.5,1.55,1.12,"#ffe799");
}

function paintIcon(c: Pens, kind: SpellKind) {
  c.save(); c.lineCap="round"; c.lineJoin="round";
  if (kind === "meteor") {
    c.translate(3.5,4);c.rotate(-Math.PI/4);meteorIcon(c);
  } else if (kind === "gust") {
    const curls=new Path2D("M-11 -4 Q-4 -7 2 -4 Q10 0 9 -6 M-12 2 Q-6 -1 1 2 Q8 5 12 1 M-6 7 Q0 5 5 8");
    c.strokeStyle=INK;c.lineWidth=3.3;c.stroke(curls);c.strokeStyle="#a6d9c5";c.lineWidth=1.65;c.stroke(curls);
  } else if (kind === "rain") {
    oval(c,-3,-3,7,5,INK);oval(c,3,-5,6,5,INK);oval(c,6,-2,6,4,INK);
    oval(c,0,-3,8,3.6,"#addad4");oval(c,4,-5,4.3,3.4,"#d8eee3");
    for (const x of [-6,0,6]) line(c,x,4,x-2,8,"#418b96",1.8);
  } else if (kind==="wormhole") wormholeIcon(c);
  else if (kind==="freeze" || kind==="lightning" || kind==="rage") weatherIcon(c,kind);
  else siegeSpellIcon(c,kind);
  c.restore();
}

// Each icon has one native drawing. Repeated toolbar repaints and team changes reuse it.
const icons=new Map<SpellKind,HTMLCanvasElement>();
export function drawSpellIcon(c: Pens,kind: SpellKind) {
  let icon=icons.get(kind);
  if (!icon) {
    icon=document.createElement("canvas"); icon.width=icon.height=32;
    const p=icon.getContext("2d")!; p.translate(16,16); paintIcon(p,kind);
    const image=p.getImageData(0,0,32,32); indexPixels(image); p.putImageData(image,0,0);
    icons.set(kind,icon);
  }
  c.imageSmoothingEnabled=false; c.drawImage(icon,-16,-16);
}

const cues: Record<Exclude<SpellKind,"wormhole">,string> = {
  meteor:"#ac6945",rain:"#589ca6",gust:"#75a38d",briar:"#618941",fault:"#907150",
  mirror:"#659aac",freeze:"#5da8c9",lightning:"#8064ae",rage:"#aa586a",
};
export function drawFieldSpell(c: Pens, spell: FieldSpell, tick: number, sx: number, sy: number) {
  if (spell.kind==="wormhole") { drawWormhole(c,spell,tick,sx,sy); return; }
  const age=tick-spell.startTick, spec=SPELLS[spell.kind], r=spec.radius;
  if (age<0 || age>=spec.duration) return;
  const k=Math.min(sx,sy), after=age-spec.delay;
  c.save(); c.translate(spell.x*sx,spell.y*sy);
  if (after<0 || spell.kind==="rage" || (spell.kind==="mirror" && (spell.reflection?.count??0)<3)) {
    // The outer pips are in arena coordinates, even when the viewport stretches vertically.
    const p=Math.min(1,age/Math.max(1,spec.delay));
    c.save(); c.globalAlpha*=after<0 ? .45+.43*p : .53;
    c.scale(k,k);
    for (let i=0;i<12;i++) {
      const a=i*Math.PI/6, x=Math.cos(a)*r*sx/k, y=Math.sin(a)*r*sy/k;
      segment(c,x,y,x-Math.sin(a)*3,y+Math.cos(a)*3,cues[spell.kind],2);
    }
    c.restore();
  }
  if (spell.kind==="meteor" && after<0) {
    const t=age/spec.delay, width=(5+13*t*t)*k;
    c.fillStyle="#765b5466"; c.fillRect(-width,-2*k,width*2,4*k);
    c.fillStyle="#59435144"; c.fillRect(-width*.62,-4*k,width*1.24,8*k);
  } else if (spell.kind==="gust" && after>=0) {
    // A fan of leaves crosses the radius at the same moment the spell shoves outwards.
    const p=Math.min(1,(after+2)/14);
    c.save(); c.globalAlpha*=Math.min(1,(spec.duration-age)/8);
    c.translate(0,7*k); c.scale(1,.65);
    drawEffect(c,"gust",0,0,after,spec.duration-spec.delay,r*(.64+1.22*p)*k);
    c.restore();
  } else if (spell.kind==="rain") {
    drawEffect(c,"shower",0,-2*k,age%52,52,2*r*k);
    const dye=ARMIES[spell.team];
    for (const pulse of [SPELLS.rain.delay,48,84]) {
      const elapsed=age-pulse;
      if (elapsed<0 || elapsed>=26) continue;
      drawEffect(c,"heal",0,3*k,elapsed,26,r*1.52*k);
      for (let i=0;i<5;i++) {
        const t=(elapsed-i*1.15)/21;
        if (t<0 || t>=1) continue;
        const a=i*2.4+pulse*.07, reach=r*(i===0?.14:.46+.10*(i%3));
        c.save(); c.translate(Math.cos(a)*reach*sx,Math.sin(a)*reach*sy-(3+22*t)*k);
        c.scale(k,k); c.globalAlpha*=Math.min(1,(1-t)*4);
        c.fillStyle=dye.hem; c.fillRect(-2,-5,4,10); c.fillRect(-5,-2,10,4);
        c.fillStyle=dye.coat; c.fillRect(-1,-4,2,8); c.fillRect(-4,-1,8,2);
        c.fillStyle=dye.light; c.fillRect(-1,-4,1,3); c.restore();
      }
    }
  } else if (spell.kind==="freeze" || spell.kind==="rage") drawWeatherField(c,spell,tick,sx,sy);
  else if (spell.kind==="fault" || spell.kind==="briar" || spell.kind==="mirror") drawSiegeSpell(c,spell,tick,sx,sy);
  c.restore();
}
