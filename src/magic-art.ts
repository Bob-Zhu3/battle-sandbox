import { ARMIES } from "./battlefield.ts";
import { INK, cut, line, oval, type Pens } from "./ink.ts";
import { SPELLS, type FieldSpell, type SpellKind } from "./spells.ts";
import { drawSiegeSpell, siegeSpellIcon } from "./siege-magic-art.ts";

function meteorIcon(c: Pens) {
  c.lineJoin="round";
  cut(c,"M-4.8 -1.6 Q-6.5 -6.7 -5.4 -12.8 Q-2.7 -10.15 -2.3 -8.3 Q.1 -13.05 -.8 -17 Q4.5 -12.1 4.9 -4.0 L3.7 -1Z","#f4ae58",1);
  cut(c,"M-6.25 -.55 Q-5.95 -5.35 -1.95 -6.55 Q2.5 -7.3 5.55 -3.6 Q7.55 .25 5.1 4.45 Q2.1 7.3 -2.85 5.85 Q-6.3 4.05 -6.25 -.55Z","#e7924c",1.55);
  cut(c,"M-4.55 -.5 Q-2.95 1.1 -.6 2.1 Q1.7 2.4 2.8 4.1 Q.4 5.6 -2.1 4.3 Q-4.45 2.95 -4.55 -.5Z","#b86946",0);
  oval(c,2.65,-2.5,1.55,1.12,"#ffe799");
}

export function drawSpellIcon(c: Pens, kind: SpellKind) {
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
  } else siegeSpellIcon(c,kind);
  c.restore();
}

export function drawFieldSpell(c: Pens, spell: FieldSpell, tick: number, sx: number, sy: number) {
  const age=tick-spell.startTick, spec=SPELLS[spell.kind], r=spec.radius;
  if (age < 0) return;
  const scale=Math.min(sx,sy);
  c.save(); c.translate(spell.x*sx,spell.y*sy);
  const after=Math.max(0,age-spec.delay), life=Math.max(0,1-age/spec.duration);
  c.beginPath();c.ellipse(0,0,r*sx,r*sy,0,0,2*Math.PI);
  const spent=spell.kind==="mirror" && (spell.reflection?.count??0)>=SPELLS.mirror.panes;
  if(!spent) {
    const colors={meteor:"#cc7541",rain:"#71b4af",gust:"#d6eed1",briar:"#69a454",fault:"#ad8c5c",mirror:"#91c8d1"};
    c.fillStyle=colors[spell.kind]+"20";c.fill();c.strokeStyle=ARMIES[spell.team].hem;c.globalAlpha=.55*life;
    c.lineWidth=1.6*scale;c.setLineDash([5*scale,6*scale]);c.stroke();c.setLineDash([]);
  }
  c.globalAlpha=1;
  if(spell.kind==="meteor") {
    if (age < spec.delay) {
      const t = age / spec.delay;
      oval(c,0,0,(5+10*t*t)*sx,(3+5*t*t)*sy,"#805d485a");
    }
  } else if(spell.kind==="gust") {
    const t=Math.min(1,(after+2)/21);c.strokeStyle="#fcffe9";c.globalAlpha=.85*life;c.lineWidth=2.4*scale;
    for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,r*sx*t,r*sy*t,0,i*2.1+age*.025,i*2.1+1.4+age*.025);c.stroke();}
  } else if (spell.kind==="rain") {
    c.globalAlpha=Math.min(1,life*4);c.lineWidth=1.6*scale;c.strokeStyle="#377f8a";
    for(let i=0;i<11;i++){
      const dx=Math.cos(i*2.4)*r*Math.sqrt((i+1)/12);
      const dy=Math.sin(i*2.4)*r*Math.sqrt((i+1)/12);
      const lift=(tick*2+i*11)%19;
      line(c,dx*sx+2*scale,dy*sy-(20-lift)*scale,dx*sx,dy*sy-(15-lift)*scale,"#6babae",1.5*scale);
    }
    const dye=ARMIES[spell.team];
    for (const pulse of [SPELLS.rain.delay,48,84]) {
      const elapsed=age-pulse;
      if(elapsed<0 || elapsed>29) continue;
      for(let i=0;i<5;i++) {
        const t=(elapsed-i*1.2)/24;
        if(t<0 || t>=1) continue;
        const angle=i*2.4+pulse*.07, distance=r*(i===0?.1:.45+.12*(i%3));
        const x=Math.cos(angle)*distance*sx, y=Math.sin(angle)*distance*sy;
        c.save(); c.translate(x+Math.sin(t*3+i)*2*scale,y-(2+22*t)*scale); c.scale(scale,scale);
        c.globalAlpha=Math.min(1,t*8+.28,(1-t)*4);
        cut(c,"M-1.6 -5 L1.6 -5 L1.6 -1.6 L5 -1.6 L5 1.6 L1.6 1.6 L1.6 5 L-1.6 5 L-1.6 1.6 L-5 1.6 L-5 -1.6 L-1.6 -1.6Z",dye.coat,1.1);
        line(c,-.7,-3.6,-.7,-1.5,dye.light,1);
        c.restore();
      }
    }
  } else drawSiegeSpell(c,spell,tick,sx,sy);
  c.restore();
}
