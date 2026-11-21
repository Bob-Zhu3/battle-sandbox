import { ARMIES } from "./battlefield.ts";
import { cut, line, oval, type Pens } from "./ink.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";

const tau = Math.PI*2, leaf = "#71a56a", bark = "#426247";
export function siegeSpellIcon(c: Pens, kind: "fault"|"briar"|"mirror") {
  if(kind === "fault") {
    cut(c,"M-13 4 L-10 -.8 L-3 -4.8 L-.4 -3.4 L-3.8 .9 L.2 2.1 L-5.5 7.6 L-11 6.5Z","#aa8d69",1.2);
    cut(c,"M.7 -4.7 L7.4 -7.3 L12.4 -4 L12.8 .4 L7 2.7 L1.6 6.5 L3.5 1.5 L.6 .4 L4 -3Z","#c4a77a",1.2);
    cut(c,"M3.8 -10.6 L.8 -5.4 L3.2 -4.1 L-2.5 .6 L-.8 -3.2 L-3.3 -3.9Z","#ffd778",.75);
    line(c,-9,2.8,-5.5,.6,"#e5cf99",1.1);
  } else if(kind === "briar") {
    cut(c,"M-11 5 Q-6.6 11 2 6.2 Q8 3.1 5 -2.2 Q3 -6 -1 -3 Q-.4 -8.3 4.5 -8.4 Q11 -8.7 10.2 -.8 Q10 7.8 1.1 10 Q-7.8 12 -11 5Z",leaf,1.35);
    cut(c,"M-6.5 7 Q-7.8 1 -12.3 -.4 Q-5.4 -2 -3.3 5.6Z","#88b465",1);
    cut(c,"M5.4 -7 Q1.5 -11.6 5.4 -13 Q6.9 -10.2 7.4 -7.7Z","#b2cd75",.85);
    cut(c,"M6.9 4.7 L12.7 3.7 L8.3 7.1Z",bark,.65);
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
  const age=tick-spell.startTick, rule=SPELLS[spell.kind], radius=rule.radius, k=Math.min(sx,sy);
  const t=age-rule.delay;
  c.save();c.lineCap="round";c.lineJoin="round";
  if(spell.kind === "fault") {
    c.scale(sx,sy);
    const later=age>=SPELLS.fault.aftershock, elapsed=later?age-SPELLS.fault.aftershock:t;
    const grow=Math.min(1,Math.max(.16,(t+2)/8)), fade=Math.min(1,(rule.duration-age)/15);
    c.globalAlpha=(t<0?.34:.9)*fade;c.rotate((spell.id%7-3)*.085);
    for(let i=0;i<5;i++) {
      const a=i*tau/5+.23, length=radius*(.65+.28*((i+1)%3)/2)*grow;
      c.save();c.rotate(a);c.beginPath();c.moveTo(0,1);c.lineTo(length*.33,-4);c.lineTo(length*.46,1.2);c.lineTo(length*.76,-3);c.lineTo(length,.7);
      c.strokeStyle="#836441";c.lineWidth=t<0?1.1:2.5;c.stroke();
      if(t>=0) {line(c,length*.49,1.2,length*.70,6,"#9a7954",1.2);line(c,length*.17,-1,length*.32,-3,"#f2d995",1);}
      if(elapsed>=0 && elapsed<16) {const n=elapsed/16;c.globalAlpha*=(1-n);oval(c,length*.78+n*5,-4-12*Math.sin(n*Math.PI),2.6,1.8,"#a98b68");}
      c.restore();
    }
    if(elapsed>=0 && elapsed<15){c.globalAlpha=.6*(1-elapsed/15);c.strokeStyle="#e6cd91";c.lineWidth=2;c.beginPath();c.arc(0,0,radius*(elapsed+1)/15,0,tau);c.stroke();}
  } else if(spell.kind === "briar") {
    const grow=t<0?.18:.2+.8*Math.min(1,(t+1)/8);
    for(let i=0;i<7;i++) {
      const a=i*tau/7+spell.id*.19, d=radius*(i===0?.15:.6+.18*(i%2));
      c.save();c.translate(Math.cos(a)*d*sx,Math.sin(a)*d*sy);
      const size=k*grow*(i%3===0?1.07:.76);
      c.scale(Math.cos(a)<0?-size:size,size);c.globalAlpha=Math.min(.92,(rule.duration-age)/12);
      oval(c,0,.8,5.4,1.3,"#58664142");
      c.rotate(Math.sin(a)*.24);
      cut(c,"M-5.5 .6 Q-1 1.4 1.5 -3 Q5.9 -10 1.7 -11 Q-.2 -11.4 -1.5 -8.7 Q-2.8 -13.5 1.7 -14 Q7 -14.3 6.1 -8.6 L8.2 -9.7 L5.3 -5.6 Q2.8 1.8 -2.4 2.1Z",leaf,.9);
      cut(c,"M-.5 -1.2 Q-2.9 -5.4 -6.1 -6.1 Q-1.8 -7.1 1.1 -3Z","#aac777",.65);c.restore();
    }
  } else {
    const used=spell.reflection?.count ?? 0;
    const since=tick-(spell.reflection?.tick ?? -1000), broken=used>=SPELLS.mirror.panes;
    c.globalAlpha=Math.min(1,(rule.duration-age)/15)*(t<0?.45:1);
    if(!broken){
      c.save();c.scale(sx,sy);
      c.beginPath();c.arc(0,0,radius,0,tau);c.fillStyle="#9ad6d72a";c.fill();
      c.strokeStyle="#649da49c";c.lineWidth=1.3;c.stroke();c.restore();
      for(let i=0;i<SPELLS.mirror.panes-used;i++){
        const a=age*.019+i*tau/3+spell.id*.29, x=Math.cos(a)*radius*sx,y=Math.sin(a)*radius*sy;
        c.save();c.translate(x,y-3*k);c.scale(k,k);c.rotate(Math.sin(a)*.33);
        cut(c,"M0 -7 L3.9 -2.6 L3.2 2.4 L-.7 6.5 L-3.7 1.6 L-3 -3.6Z","#95d5d5",.9);
        line(c,-1.7,-2.9,.4,-4.6,"#effbe4",1.2);c.restore();
      }
    }
    if(spell.reflection && since>=0 && since<17) {
      c.translate((spell.reflection.x-spell.x)*sx,(spell.reflection.y-spell.y)*sy-6*k);c.scale(k,k);
      c.globalAlpha*=1-since/17;
      for(let i=0;i<6;i++){c.save();c.rotate(i*tau/6+.4);const d=3+since*(broken?.97:.6);line(c,d,0,d+3.8,0,"#538d99",2);line(c,d,0,d+2.7,0,"#e8fff1",1.3);c.restore();}
    }
  }
  c.restore();
}

export function stoneMarker(c: Pens, x: number, y: number, tick: number, land: number, sx: number, sy: number, team: keyof typeof ARMIES) {
  const progress=Math.max(0,1-(land-tick)/44);
  c.save();c.translate(x*sx,y*sy);c.scale(sx,sy);c.lineWidth=1.15;c.globalAlpha=.47+.29*progress;
  c.strokeStyle=ARMIES[team].hem;
  for(let i=0;i<4;i++){c.beginPath();const a=i*tau/4+.12;c.arc(0,0,5+5*(1-progress),a,a+.76);c.stroke();}
  c.restore();
}
