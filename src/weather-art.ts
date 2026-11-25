import { ARMIES } from "./battlefield.ts";
import { drawEffect } from "./pixel-art/effect-player.ts";
import { cut, line, oval, type Pens } from "./ink.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";

const tau = 2*Math.PI;
function flake(c: Pens, r: number) {
  for (let i=0;i<6;i++) {
    c.save();c.rotate(i*tau/6);
    line(c,0,0,0,-r,"#48687c",r*.25);
    line(c,0,0,0,-r,"#c9f4ed",r*.13);
    for (const side of [-1,1]) line(c,0,-r*.43,side*r*.24,-r*.68,"#88c8d7",r*.17);
    c.restore();
  }
}
export function weatherIcon(c: Pens, kind: "freeze"|"lightning"|"rage") {
  if (kind==="freeze") {
    cut(c,"M0 -12.5 L8.1 -6.8 L8.7 5.2 L0 12.4 L-8.1 6.1 L-8.7 -5.2Z","#76b9d1",1.25);
    cut(c,"M0 -11.5 L.3 -2 L-7.7 4.6 L-7.7 -4.8Z","#b9e9e7",0);flake(c,9.5);
  } else if (kind==="lightning") {
    cut(c,"M-.6 -12.2 L7.5 -12 L2 -2.5 L9.5 -3.7 L-4.7 13 L-1.6 2 L-9.5 3.7Z","#efb449",1.5);
    cut(c,"M.2 -10.8 L4.6 -10.9 L-3.1 -.7 L-6.4 1Z","#fff5bd",0);
  } else {
    cut(c,"M-10.7 6.5 Q-9.4 1 -10.9 -2.3 Q-6.8 -.6 -5.7 1.2 Q-4.3 -3.3 -5.7 -7.5 Q-1.4 -6.7 1.2 -2 Q4.1 -7.5 2.7 -12 Q12.7 -6.3 10.1 2.6 Q7.4 10.6 -.2 11.4 Q-6.3 12.2 -10.7 6.5Z","#bc5970",1.25);
    cut(c,"M-6.6 6.1 L.9 .5 L1.5 3.6 L6.5 .8 L-.5 8.7 L-1 5.6Z","#ffe4a3",.8);
  }
}

export function drawWeatherField(c: Pens,s: FieldSpell,tick: number,sx: number,sy: number) {
  const age=tick-s.startTick, rule=SPELLS[s.kind], t=age-rule.delay, k=Math.min(sx,sy);
  c.save();c.lineCap="round";c.lineJoin="round";
  if (s.kind==="lightning") {
    if (t<0) {
      c.globalAlpha=.4+.4*age/rule.delay;c.scale(k,k);
      for(let i=0;i<3;i++){c.save();c.rotate(i*tau/3+age*.04);line(c,0,-(17-age*.35),0,-(12-age*.35),"#b38c43",1.8);c.restore();}
    } else if (t<17) {
      const strikes=s.strikes?.length?s.strikes:[s];
      c.globalAlpha=Math.max(0,1-t/17);
      const originX=(.5-s.id%2)*27*k, originY=-s.y*sy;
      for(const [i,end] of strikes.entries()) {
        const ex=(end.x-s.x)*sx,ey=(end.y-s.y)*sy-5*k;
        c.beginPath();c.moveTo(originX,originY);
        for(let j=1;j<8;j++) {
          const f=j/8, split=(j+i+s.id)%2?1:-1;
          c.lineTo(originX+(ex-originX)*f+split*(4+(j*7%13))*k,originY+(ey-originY)*f);
        }
        c.lineTo(ex,ey);c.strokeStyle="#9471ab";c.lineWidth=4.8*k;c.stroke();c.strokeStyle="#fff2aa";c.lineWidth=2.25*k;c.stroke();
        if (drawEffect(c,"zap",ex,ey,t,17,45*k)) continue;
        for(let j=0;j<5;j++){const a=j*tau/5+.3+i;line(c,ex+Math.cos(a)*(3+t*.45)*k,ey+Math.sin(a)*(3+t*.45)*k,
          ex+Math.cos(a)*(8+t*.55)*k,ey+Math.sin(a)*(8+t*.55)*k,"#fff3bc",1.7*k);}
      }
    }
  } else if (s.kind==="freeze") {
    if (t>=0 && drawEffect(c,"snow",0,0,t,rule.duration-rule.delay,rule.radius*2*k)) { c.restore(); return; }
    const spread=t<0?.20+age*.009:Math.min(1,(t+4)/13);
    for(let i=0;i<6;i++) {
      const a=i*tau/6+s.id*.31;
      c.save();c.translate(Math.cos(a)*rule.radius*.73*spread*sx,Math.sin(a)*rule.radius*.73*spread*sy);
      c.globalAlpha=Math.min(.86,(rule.duration-age)/12);c.scale(k,k);c.rotate(a);flake(c,(t<0?3.3:5.4)*spread+1);c.restore();
    }
  } else {
    const dye=ARMIES[s.team];
    c.globalAlpha=Math.min(.8,(rule.duration-age)/16)*(t<0?.5:1);
    for(let i=0;i<8;i++) {
      const a=i*tau/8+s.id*.3+age*.011;
      c.save();c.translate(Math.cos(a)*rule.radius*.94*sx,Math.sin(a)*rule.radius*.94*sy);
      c.scale(k,k);c.rotate(a);cut(c,"M-2.8 -5 L2.5 -.6 L-.8 4.1 L-.8 .8 L-3 -1Z",i%2?dye.light:"#d16a79",.7);c.restore();
    }
  }
  c.restore();
}

export function iceShell(c: Pens,x: number,y: number,r: number,remaining: number) {
  c.save();c.translate(x,y);c.scale(r/12,r/12);c.globalAlpha=Math.min(1,.35+remaining/9);
  cut(c,"M-12.7 3.7 L-13.5 -9 L-6.7 -18 L3.9 -20 L12.5 -12.5 L13.4 1.4 L7.1 7.5 L-7.4 8.4Z","#b7e7ee4d",0);
  c.beginPath();c.moveTo(-9,4.6);c.lineTo(-12.3,-7.7);c.lineTo(-6.3,-16.1);c.lineTo(1.9,-18.6);c.strokeStyle="#ecfaf0";c.lineWidth=1.55;c.stroke();
  cut(c,"M5.4 6 L9 -.2 L10.1 2.4 L12.2 -4.2 L13.4 1.7 L8.4 6.9Z","#77bcd4",.72);
  if(remaining<14){c.beginPath();c.moveTo(5,-17.5);c.lineTo(2,-11);c.lineTo(4.6,-9);c.lineTo(1.8,-4);c.strokeStyle="#6da9bd";c.lineWidth=1;c.stroke();}
  c.restore();
}
export function rageRibbons(c: Pens,x: number,y: number,r: number,tick: number,id: number,side: number) {
  c.save();c.translate(x,y);c.scale(side*r/12,r/12);c.translate(-7,1);c.rotate(.09*Math.sin(tick*.2+id));
  cut(c,"M3 -3 Q-3.6 -.9 -8.4 -4.4 L-5.3 -1.2 L-12 -2.7 Q-5.3 3 2 -.2Z","#d65e72",.8);
  line(c,-4.6,-.7,-.5,-.8,"#ffe1a2",.78);c.restore();
}
