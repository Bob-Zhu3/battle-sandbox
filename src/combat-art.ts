import { poisonBottle } from "./oddities-art.ts";
import { drawMiasma } from "./field-effects.ts";
import type { Unit } from "./simulation.ts";
import type { GroundEffect } from "./conditions.ts";
import type { Arrow } from "./arrows.ts";
import { cut, INK, line, oval, type Pens } from "./ink.ts";
import { drawBomb } from "./roster-art.ts";

export function drawGroundEffect(c: Pens, e: GroundEffect, tick: number, sx: number, sy: number) {
  if (e.kind==="miasma") { drawMiasma(c,e,tick,sx,sy); return; }
  if (e.kind==="glass") {
    const age=tick-e.tick;
    if (age>=0 && age<19) {
      const t=age/19, k=Math.min(sx,sy);
      for (let i=0;i<6;i++) {
        const a=i*2.4+.5, reach=6+17*t;
        c.save();c.translate((e.x+Math.cos(a)*reach)*sx,(e.y+Math.sin(a)*reach*.65)*sy-11*Math.sin(t*Math.PI)*k);
        c.scale(k,k);c.rotate(a+t*4);c.globalAlpha=1-t;
        cut(c,"M-1.7 -2.2 L2.1 -.7 L-.6 2.3Z",i%2?"#c4eee4":"#fff8e3",.72);c.restore();
      }
    }
    return;
  }
  const age=tick-e.tick;
  if (age<0 || age>=34) return;
  const k=Math.min(sx,sy), fade=1-age/34, expand=Math.min(1,(age+2)/13);
  c.save(); c.translate(e.x*sx,e.y*sy); c.scale(sx,sy);
  c.globalAlpha=fade;
  c.beginPath(); c.arc(0,0,e.radius*expand,0,Math.PI*2);
  c.strokeStyle=e.kind==="toll"?"#c69c55":e.kind==="smash" || e.kind==="stonefall"?"#8c6d51":e.kind==="blast"?"#d98045":"#72bac7";
  c.lineWidth=e.kind==="smash"?2.4:2; c.stroke();
  if (e.kind==="toll") {
    for(let i=1;i<=2;i++){c.beginPath();c.arc(0,0,e.radius*Math.max(.02,Math.min(1,(age+2-i*4)/16)),0,Math.PI*2);c.strokeStyle=i===1?"#fff0ae":"#d1a75f";c.lineWidth=i===1?2:1;c.stroke();}
  } else if(e.kind==="stonefall") {
    for(let i=0;i<9;i++){const a=i*2.4,r=(.55+.09*(i%4))*e.radius*expand;
      oval(c,Math.cos(a)*r,Math.sin(a)*r-6*Math.sin(age/34*Math.PI),2+2*fade,1.8+fade,i%3?"#ac916f":"#858478");}
  } else if (e.kind==="frost") {
    c.fillStyle="#b1e7f24a"; c.fill();
    for(let i=0;i<6;i++){
      c.save();c.rotate(i*Math.PI/3);line(c,1,0,e.radius*expand*.8,0,"#edfbef",1.6);
      line(c,e.radius*expand*.5,0,e.radius*expand*.62,-4,"#d2f3f5",1.3);c.restore();
    }
  } else if(e.kind==="smash") {
    for(let i=0;i<6;i++){
      c.save();c.rotate(i*1.05+.42);c.beginPath();c.moveTo(4,0);c.lineTo(e.radius*.32*expand,2.5);
      c.lineTo(e.radius*.52*expand,-1.8);c.lineTo(e.radius*.8*expand,1);c.strokeStyle="#796a54";c.lineWidth=1.4;c.stroke();c.restore();
    }
  } else {
    c.fillStyle="#e89a4e29";c.fill();
    for(let i=0;i<8;i++){
      const a=i*2.4, r=(5+Math.min(17,age)*1.35)*(i%2?.75:1);
      oval(c,Math.cos(a)*r,Math.sin(a)*r-4*fade,(2.5+4*fade),(1.6+4*fade),i%2?"#f9c967":"#9c8070");
    }
    if(age<10){c.scale(k/sx,k/sy);cut(c,"M-11 2 L-5 -2 L-8 -10 L-2 -7 L1 -15 L4 -6 L11 -8 L8 -1 L15 2 L6 4 L4 11 L-1 6 L-7 8 L-5 4Z","#fff2b1",1);}
  }
  c.restore();
}

export function drawStun(c: Pens, x: number, y: number, size: number, tick: number, id: number) {
  c.save(); c.translate(x,y); c.scale(size,size);
  for(let i=0;i<2;i++) {
    const a=tick*.17+id+i*Math.PI;
    c.save(); c.translate(Math.cos(a)*7,Math.sin(a)*2); c.rotate(a*.3);
    cut(c,"M0 -3.4 L1 -1 L3.3 0 L1 1 L0 3 L-1 1 L-3.3 0 L-1 -1Z","#ffdc70",.85); c.restore();
  }
  c.restore();
}
export function drawConditions(c: Pens, u: Unit, x: number, y: number, r: number, scale: number, tick: number) {
  c.save(); c.translate(x,y); c.scale(scale,scale);
  const radius=r/scale;
  if ((u.rootedUntil??0)>tick) {
    cut(c,"M-9 4 Q-6 5.5 -5.4 3.6 L-7 -1.6 Q-3.8 -.5 -3.2 3.9 Q-1 5.1 3.5 4 L6.5 -.7 L5.9 3.6 L9 .9 Q8.3 8.4 2.5 7.1 Q-6 9.8 -9 4Z","#7a9b58",1);
    line(c,-5.7,5.3,1.8,6.2,"#b7c87d",1);
  }
  if ((u.slowUntil??0)>tick) {
    cut(c,"M-9 4 L-10 -2 L-6 0 L-5 -4 L-2 3 L3 4 L6 -1 L8 -4 L9 4 L5 7 L-4 7Z","#b8ecf1",1);
    line(c,-6,4,-3,5,"#ffffff",1.1);
  }
  if (u.burn && u.hp>0) {
    c.save(); c.translate(-radius*.38,3);
    c.scale(1,1+Math.sin(tick*.32+u.id)*.16);
    cut(c,"M-4 3 Q-7 -2 -4 -6 L-3 -3 L0 -11 Q5 -7 3 -3 L6 -4 Q8 2 3 4Z","#ed814a",1);
    cut(c,"M-2 3 Q-3 0 0 -5 L2 -1 L3 -2 Q5 2 1 3Z","#ffe58a",0); c.restore();
  }
  if(u.poison && u.hp>0){
    for(let i=0;i<2;i++){
      const p=((tick+u.id*5+i*12)%25+25)%25/25;
      oval(c,radius*.72+i*3,-radius*.45-p*8,2.4-p,2.4-p,"#71567f");
      oval(c,radius*.72+i*3-.5,-radius*.45-p*8-.5,.9,.9,"#ecbde8");
    }
  }
  c.restore();
  if ((u.stunnedUntil??0)>tick && u.hp>0) drawStun(c,x,y-r*1.8-4*scale,scale,tick,u.id);
}

export function drawChain(c: Pens, arc: NonNullable<Unit["arc"]>, tick: number, sx: number, sy: number) {
  const age=tick-arc.tick, k=Math.min(sx,sy);
  if (age<0 || age>=21) return;
  c.save(); c.lineJoin="round";c.lineCap="round";
  for(let i=1;i<arc.path.length;i++) {
    const phase=age-(i-1)*1.5;
    if(phase<0) continue;
    const from=arc.path[i-1], to=arc.path[i];
    const x=from.x*sx, y=from.y*sy-(i===1?20:9)*k;
    const dx=to.x*sx-x,dy=to.y*sy-9*k-y,length=Math.hypot(dx,dy)||1;
    const nx=-dy/length,ny=dx/length;
    c.beginPath();c.moveTo(x,y);
    for(let n=1;n<5;n++){
      const t=n/5,zig=(n%2?1:-1)*(2+.5*((i+n)%3))*k;
      c.lineTo(x+t*dx+zig*nx,y+t*dy+zig*ny);
    }
    c.lineTo(x+dx,y+dy);
    c.globalAlpha=Math.max(0,1-phase/22);
    c.strokeStyle="#436d82";c.lineWidth=4*k;c.stroke();
    c.strokeStyle="#fff7af";c.lineWidth=2*k;c.stroke();
    if(phase<10){oval(c,x+dx,y+dy,(4-phase*.22)*k,(4-phase*.22)*k,"#fff9c2");}
  }
  c.restore();
}

export function drawSpecialShot(c: Pens, shot: Arrow, x: number, y: number, angle: number, k: number, tick: number) {
  c.save(); c.translate(x,y); c.scale(k,k);
  if(shot.kind==="stone") {
    const t=Math.max(0,Math.min(1,(tick-shot.releasedTick)/(shot.landTick!-shot.releasedTick)));
    oval(c,0,1.5,4.7,1.9,"#59634b50");c.translate(0,-7*(1-t)-42*Math.sin(Math.PI*t));c.rotate(t*5.9);
    cut(c,"M-5 -.8 Q-5.2 -4.9 -.7 -5.4 L3.5 -4 Q5.7 -3.1 5 1.9 L2 5 L-2.7 4.1Z","#93988a",1.2);
    line(c,-3.1,-2.1,-.8,-3.6,"#e1dfbe",1.25);
  } else if(shot.kind==="bomb" || shot.kind==="balloon") {
    const progress=Math.max(0,Math.min(1,(tick-shot.releasedTick)/(shot.landTick!-shot.releasedTick)));
    const height=8*(1-progress)+30*Math.sin(Math.PI*progress);
    oval(c,0,2,4.6,1.6,"#4a554841"); if (shot.kind==="balloon") poisonBottle(c,0,-height,1.04,progress*5.3-.4); else drawBomb(c,0,-height,.9,tick);
  } else {
    c.translate(0,-8); c.rotate(angle);
    if(shot.kind==="bullet"){
      line(c,-12,0,0,0,"#ab8745",2);line(c,-8,0,0,0,"#fff1a9",1.1);
      oval(c,0,0,2.8,1.8,INK);oval(c,.4,-.2,1.85,1.05,"#f3cc78");
    } else if(shot.kind==="hex"){
      line(c,-10,0,-4,0,"#b287b6",1.5);
      c.rotate(tick*.17);c.strokeStyle="#765182";c.lineWidth=1.6;c.beginPath();c.arc(0,0,3.9,.3,5.9);c.stroke();
      cut(c,"M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1Z","#ffc4e2",.7);
    } else if(shot.kind==="ice"){
      cut(c,"M-10 0 L-2 -3.4 L5 0 L-2 3.4Z","#a5e6f1",1);
      line(c,-6,0,2,0,"#fff9da",1);
    } else {line(c,-7,0,1,0,"#715b7d",1.5);oval(c,0,0,1.8,1.5,"#bc80bf");}
  }
  c.restore();
}
