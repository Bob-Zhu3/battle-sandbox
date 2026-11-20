import { ARMIES } from "./battlefield.ts";
import { INK, cut, line, oval, type Pens } from "./ink.ts";
import { SPELLS, type FieldSpell, type SpellKind } from "./spells.ts";

export function drawSpellIcon(c: Pens, kind: SpellKind) {
  c.save(); c.lineCap="round"; c.lineJoin="round";
  if (kind === "meteor") {
    line(c,-8,-10,2,2,"#bc6746",5); line(c,-1,-13,7,0,"#f0bc61",2.6);
    oval(c,4,4,6.2,6.2,INK); oval(c,4,4,4.8,4.8,"#e7924c"); oval(c,5,3,1.8,1.5,"#ffe799");
  } else if (kind === "gust") {
    const curls=new Path2D("M-11 -4 Q-4 -7 2 -4 Q10 0 9 -6 M-12 2 Q-6 -1 1 2 Q8 5 12 1 M-6 7 Q0 5 5 8");
    c.strokeStyle=INK;c.lineWidth=3.3;c.stroke(curls);c.strokeStyle="#a6d9c5";c.lineWidth=1.65;c.stroke(curls);
  } else {
    oval(c,-3,-3,7,5,INK);oval(c,3,-5,6,5,INK);oval(c,6,-2,6,4,INK);
    oval(c,0,-3,8,3.6,"#addad4");oval(c,4,-5,4.3,3.4,"#d8eee3");
    for (const x of [-6,0,6]) line(c,x,4,x-2,8,"#418b96",1.8);
  }
  c.restore();
}

export function drawFieldSpell(c: Pens, spell: FieldSpell, tick: number, sx: number, sy: number) {
  const age=tick-spell.startTick, spec=SPELLS[spell.kind], r=spec.radius;
  const scale=Math.min(sx,sy);
  c.save(); c.translate(spell.x*sx,spell.y*sy);
  const after=Math.max(0,age-spec.delay), life=Math.max(0,1-age/spec.duration);
  c.beginPath();c.ellipse(0,0,r*sx,r*sy,0,0,2*Math.PI);
  const fill=spell.kind==="meteor"?"#cc7541":spell.kind==="rain"?"#71b4af":"#d6eed1";
  c.fillStyle=fill+"20";c.fill();c.strokeStyle=ARMIES[spell.team].hem;c.globalAlpha=.55*life;
  c.lineWidth=1.6*scale;c.setLineDash([5*scale,6*scale]);c.stroke();c.setLineDash([]);
  c.globalAlpha=1;
  if(spell.kind==="meteor") {
    if(age<spec.delay) {
      const t=age/spec.delay;
      oval(c,0,0,(5+10*t)*sx,(3+5*t)*sy,"#805d485a");
      c.save();c.translate(-(1-t)*40*sx,-(1-t)*112*scale);c.scale(scale,scale);drawSpellIcon(c,"meteor");c.restore();
    } else {
      c.strokeStyle="#fff0b7";c.lineWidth=4*scale*(1-after/(spec.duration-spec.delay));c.beginPath();
      c.ellipse(0,0,r*sx*Math.min(1,(after+1)/11),r*sy*Math.min(1,(after+1)/11),0,0,Math.PI*2);c.stroke();
    }
  } else if(spell.kind==="gust") {
    const t=Math.min(1,(after+2)/21);c.strokeStyle="#fcffe9";c.globalAlpha=.85*life;c.lineWidth=2.4*scale;
    for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,r*sx*t,r*sy*t,0,i*2.1+age*.025,i*2.1+1.4+age*.025);c.stroke();}
  } else {
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
  }
  c.restore();
}
