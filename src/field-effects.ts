import { ARMIES } from "./battlefield.ts";
import type { Unit } from "./simulation.ts";
import { TRAILS, TRAIL_TICKS } from "./trails.ts";
import { cut, line, oval, type Pens } from "./ink.ts";
import { drawEffect } from "./pixel-art/effect-player.ts";

export function drawTrail(c: Pens,u: Unit,tick: number,sx: number,sy: number) {
  if (!u.trail || !(u.kind in TRAILS)) return;
  const kind=TRAILS[u.kind as keyof typeof TRAILS].kind, scale=Math.min(sx,sy);
  for(const mark of u.trail) {
    const age=tick-mark.tick;
    if(age<0 || age>=TRAIL_TICKS) continue;
    const fade=1-age/TRAIL_TICKS, side=mark.side;
    c.save(); c.translate(mark.x*sx,mark.y*sy+4*scale); c.scale(scale,scale);
    c.globalAlpha=Math.min(.97,fade*1.42);
    if(kind==="frost") {
      // Each cluster sprouts at a sampled footfall and crumbles there as the Queen moves on.
      drawEffect(c,"rime",0,side*2,age,TRAIL_TICKS,15,side);
    } else if(kind==="fire") {
      const lift=age*.16;
      drawEffect(c,"cinder",side*2,-3-lift,(age+mark.tick%19)%40,40,4+12*fade,side);
    } else if(kind==="spark") {
      drawEffect(c,"zap",0,side*3,age,TRAIL_TICKS,15,side);
    } else if(kind==="dust") {
      // A hoof print stays on the ground while three pieces of turf lift off it.
      const p = Math.min(1,age/23);
      c.globalAlpha = (1-p)*.85;
      c.translate(side*3,2);
      c.fillStyle="#a68c70"; c.fillRect(-3,0,5,2);
      const lift=Math.round(8*Math.sin(Math.PI*p)), spread=Math.round(p*6);
      c.fillStyle="#bda585"; c.fillRect(-3-spread,-lift,4,3); c.fillRect(2+spread,-lift-2,3,3);
      c.fillStyle="#dcc5a0"; c.fillRect(-2-spread,-lift-1,3,2);
    } else if(kind==="track" || kind==="shuffle") {
      c.translate(0,side*(kind==="track"?4:2.6));c.rotate(side*.23);
      oval(c,0,1,kind==="track"?5.2:3.2,kind==="track"?2.15:1.35,kind==="track"?"#aa9270":"#899967");
      if(kind==="track")for(const i of [-1,0,1])oval(c,2+i*2,-1,1.15,1,"#aa9270");
    } else if(kind==="wisp") {
      drawEffect(c,"wisp",side*1.4,-age*.18,(age+mark.tick%17)%40,40,4+6*fade,side);
    } else {
      c.translate(0,-age*.11+side*2);c.rotate(side*.3);
      cut(c,"M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1Z","#c28cbe",.55);
    }
    c.restore();
  }
}

export function drawTunnel(c: Pens,u: Unit,x: number,y: number,tick: number,sx: number,sy: number) {
  const route=u.tunnel!;
  const k=Math.min(sx,sy), d=ARMIES[u.team];
  c.save();c.translate(route.toX*sx,route.toY*sy);c.scale(k,k);
  c.strokeStyle=d.hem;c.lineWidth=1.15;c.setLineDash([3,3]);c.beginPath();c.ellipse(0,2,8,3,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  line(c,-6,1,-6,-7,"#795c41",1.15);cut(c,"M-6 -8 L1 -7 L-3 -4 L-6 -5Z",d.coat,.7);c.restore();
  c.save();c.translate(x,y);c.scale(k,k);
  const dx=route.toX-route.fromX,dy=route.toY-route.fromY,len=Math.hypot(dx,dy)||1;
  const traveled=Math.hypot(u.x-route.fromX,u.y-route.fromY);
  for(let i=1;i<=4 && i*6<traveled;i++) {
    const tx=-dx*sx/(k*len)*i*6,ty=-dy*sy/(k*len)*i*6;
    oval(c,tx,ty+3,4.5-i*.5,1.8-i*.18,"#ae926e");
    line(c,tx-1.5,ty+2,tx+.4,ty+1,"#dcc397",.9);
  }
  const bob=tick<route.start?0:Math.sin(tick*.37+u.id)*.7;
  c.translate(0,bob);oval(c,0,3,9,2.4,"#9a8869");
  cut(c,"M-8 2 L-6 -1 L-3 -1 L-2 -4 L1 -5 L4 -2 L6 -2 L9 2Z","#b39167",.95);
  line(c,-2,-2,1,-3,"#e3c18e",1.1);
  for(const s of [-1,1])oval(c,s*(7+Math.abs(bob)*2),-.5-Math.abs(bob)*3,1.35,1,"#977658");
  c.restore();
}

export function drawChange(c: Pens,u: Unit,x: number,y: number,k: number,tick: number) {
  const hexStart=u.hex?.since ?? -Infinity, bite=u.zombified?.tick ?? -Infinity;
  const stamp=Math.max(hexStart,bite), age=tick-stamp;
  if(age<0 || age>24) return;
  if (stamp===bite) {
    drawEffect(c,"infection",x,y+2*k,age,25,36*k);
  } else {
    drawEffect(c,"hexSeal",x,y-8*k,age,25,32*k,u.id%2 ? 1 : -1);
  }
}
export function drawSoul(c: Pens,u: Unit,x: number,y: number,tick: number,sx: number,sy: number) {
  if(!u.soul || !u.hp || u.kind!=="reaper")return;
  const age=tick-u.soul.tick;
  if(age<0 || age>=33)return;
  const t=age/32,k=Math.min(sx,sy);
  const ex=x-(u.aimX<0?-1:1)*9*k,ey=y-3*k;
  const ox=u.soul.x*sx,oy=u.soul.y*sy;
  const px=ox+(ex-ox)*t,py=oy+(ey-oy)*t-(6+13*Math.sin(Math.PI*t))*k;
  drawEffect(c,"wisp",px,py,age,33,(13+4*Math.sin(Math.PI*t))*k);
}
