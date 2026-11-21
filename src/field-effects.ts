import { ARMIES } from "./battlefield.ts";
import type { GroundEffect } from "./conditions.ts";
import type { Unit } from "./simulation.ts";
import { TRAILS, TRAIL_TICKS } from "./trails.ts";
import { cut, line, oval, type Pens } from "./ink.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export function drawTrail(c: Pens,u: Unit,tick: number,sx: number,sy: number) {
  if (!u.trail || !(u.kind in TRAILS)) return;
  const kind=TRAILS[u.kind as keyof typeof TRAILS].kind, scale=Math.min(sx,sy);
  // The Queen leaves a broken sheet of ice between crystals. The newest
  // section is bright enough to read against grass even at phone size.
  if(kind==="frost") {
    for(let i=1;i<u.trail.length;i++){
      const left=u.trail[i-1], right=u.trail[i], age=tick-left.tick;
      if(age<0 || age>=TRAIL_TICKS || Math.hypot(left.x-right.x,left.y-right.y)>24)continue;
      c.save();c.globalAlpha=.72*(1-age/TRAIL_TICKS);c.lineCap="round";
      const ax=left.x*sx,ay=left.y*sy+5*scale,bx=right.x*sx,by=right.y*sy+5*scale;
      line(c,ax,ay,bx,by,"#569bb0",4.25*scale);
      line(c,ax,ay-.55*scale,bx,by-.55*scale,"#bceef2",2.55*scale);c.restore();
    }
  }
  for(const mark of u.trail) {
    const age=tick-mark.tick;
    if(age<0 || age>=TRAIL_TICKS) continue;
    const fade=1-age/TRAIL_TICKS, side=mark.side;
    c.save(); c.translate(mark.x*sx,mark.y*sy+4*scale); c.scale(scale,scale);
    c.globalAlpha=Math.min(.97,fade*1.42);
    if(kind==="frost") {
      c.translate(0,2.3*side);
      cut(c,"M-6 0 L-2 -2 L3 -1 L7 1 L2 3 L-3 2Z","#68a7bc",0);
      line(c,-4,.3,4,.8,"#e6fcfa",1.25);
      c.translate(-3,0);c.scale(.68+fade*.57,.75+fade*.6);
      cut(c,"M-3 0 L-4 -4 L-1 -2 L1 -7 L2 -1 L4 -2 L3 1Z","#c7f3ff",.75);
    } else if(kind==="fire") {
      c.translate(side*2,-5-age*.2);c.rotate(.28*side);c.scale(.67+.52*fade,.7+.52*fade);
      cut(c,"M-3 1 Q-4 -1 -2 -4 L-1 -2 L2 -9 Q5 -5 3 -2 Q5 -2 4 0 Q2 3 -3 1Z","#ed7438",.75);
      cut(c,"M-1 1 L0 -2 L2 -4 L2 0Z","#fff09a",0);oval(c,4,-6-age*.055,1.25,.95,"#eba136");
    } else if(kind==="spark") {
      c.translate(0,side*3); line(c,-4,1,-1,-1,"#528b98",1.7);line(c,-1,-1,1,.2,"#528b98",1.7);line(c,1,.2,4,-3,"#528b98",1.7);
      line(c,-1,-1,1,.2,"#fff4ad",.95);line(c,1,.2,4,-3,"#fff4ad",.95);
    } else if(kind==="track" || kind==="shuffle") {
      c.translate(0,side*(kind==="track"?4:2.6));c.rotate(side*.23);
      oval(c,0,1,kind==="track"?5.2:3.2,kind==="track"?2.15:1.35,kind==="track"?"#aa9270":"#899967");
      if(kind==="track")for(const i of [-1,0,1])oval(c,2+i*2,-1,1.15,1,"#aa9270");
    } else if(kind==="wisp") {
      c.translate(Math.sin(age*.12+side)*2,-age*.19);
      cut(c,"M-2 2 Q-4 0 -1 -3 L1 -7 Q0 -4 2 -2 Q4 1 1 2Z","#6ba995",.55);
      oval(c,0,0,.95,1.2,"#ceefd5");
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
  const infection=stamp===bite;
  c.save();c.translate(x,y-6*k);c.scale(k,k);c.globalAlpha=1-age/25;
  const radius=5+age*.68;
  c.strokeStyle=infection?"#65964e":"#aa6ba2";c.lineWidth=1.65;
  c.beginPath();c.ellipse(0,3,radius,radius*.46,-.22,Math.PI*.1,Math.PI*1.8);c.stroke();
  for(const sign of [-1,1]){
    c.save();c.translate(sign*(5+age*.37),-3-age*.24);c.rotate(sign*age*.045);
    if(infection)cut(c,"M-2 -2 L1 -3 L1 1 L-1 3Z","#bada80",.6);
    else cut(c,"M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1Z","#f1acd4",.6);
    c.restore();
  }
  c.restore();
}
export function drawSoul(c: Pens,u: Unit,x: number,y: number,tick: number,sx: number,sy: number) {
  if(!u.soul || !u.hp || u.kind!=="reaper")return;
  const age=tick-u.soul.tick;
  if(age<0 || age>=33)return;
  const t=age/32,k=Math.min(sx,sy);
  const ex=x-(u.aimX<0?-1:1)*9*k,ey=y-3*k;
  const ox=u.soul.x*sx,oy=u.soul.y*sy;
  const px=ox+(ex-ox)*t,py=oy+(ey-oy)*t-(6+13*Math.sin(Math.PI*t))*k;
  c.save();c.globalAlpha=.9;c.translate(px,py);c.scale(k,k);
  cut(c,"M-3 2 Q-4 -2 0 -4 L1 -8 Q1 -4 3 -3 Q6 1 2 3Z","#81d4be",.7);
  oval(c,0,0,1.4,1.7,"#edffda");c.restore();
}
export function drawMiasma(c: Pens,e: GroundEffect,tick: number,sx: number,sy: number) {
  const age=tick-e.tick, life=UNIT_DEFINITIONS.clown.cloudTicks;
  if(age<0 || age>=life)return;
  const size=Math.min(1,(age+5)/14), fade=Math.min(1,(life-age)/16);
  c.save();c.translate(e.x*sx,e.y*sy);c.scale(sx*size,sy*size);
  c.globalAlpha=fade*.16;oval(c,0,0,e.radius,e.radius,"#996b9f");
  c.globalAlpha=fade*.43;
  for(let i=0;i<7;i++){
    const a=i*2.39996, p=((age+i*12)%41)/41, r=e.radius*(i%3===0?.65:.43);
    const x=Math.cos(a)*r+Math.sin(age*.04+i)*2, y=Math.sin(a)*r-6*p;
    oval(c,x,y,5+3*p,4+3*p,"#b184b2");
    if(i%2===0){c.strokeStyle="#795783";c.lineWidth=1;c.beginPath();c.arc(x,y,4+p,2.7,4.7);c.stroke();}
  }
  c.restore();
}
