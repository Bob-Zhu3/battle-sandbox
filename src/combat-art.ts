import { poisonBottle } from "./oddities-art.ts";
import type { Unit } from "./simulation.ts";
import { effectLifetime, type GroundEffect } from "./conditions.ts";
import { drawBeam, drawEffect } from "./pixel-art/effect-player.ts";
import { effects } from "./pixel-art/effects.ts";
import { eventFade } from "./character-pose.ts";
import { UNIT_DEFINITIONS } from "./units.ts";
import type { Arrow } from "./arrows.ts";
import { cut, INK, line, oval, type Pens } from "./ink.ts";
import { drawBomb } from "./roster-art.ts";
import { TOWER_ART_SCALE } from "./tower-art.ts";

const groundAnimations = { blast:"bomb", smash:"smash", frost:"shards", miasma:"poison",
  stonefall:"rubble", breach:"sandBreach", glass:"bottleShards" } as const;

export function drawGroundEffect(c: Pens, e: GroundEffect, tick: number, sx: number, sy: number) {
  const age=tick-e.tick;
  if (e.kind==="toll") {
    // The sound wave follows the circular shove area even on a tall, narrow screen.
    const row=effects.bellWave;
    c.save(); c.translate(e.x*sx,e.y*sy); c.scale(sx,sy);
    drawEffect(c,"bellWave",0,0,age,effectLifetime(e),e.radius*row.w/row.radius);
    c.restore();
    return;
  }
  const name=groundAnimations[e.kind as keyof typeof groundAnimations];
  if (!name) return;
  const scale=Math.min(sx,sy);
  // The bottle breaks at its landing point. Its full-sized gas cloud draws separately.
  const width=e.kind==="glass" ? 33 : e.radius*2;
  drawEffect(c,name,e.x*sx,e.y*sy,age,effectLifetime(e),width*scale);
}

export function drawStun(c: Pens, x: number, y: number, size: number, tick: number, id: number) {
  drawEffect(c,"daze",x,y,(tick+id*7)%42,42,25*size);
}

export function drawConditions(c: Pens, u: Unit, from: Unit, x: number, y: number, r: number, scale: number, tick: number) {
  c.save(); c.translate(x,y); c.scale(scale,scale);
  const radius=r/scale;
  if ((u.rootedUntil??0)>tick) {
    // Hold the author's cinched frame around the feet of each troop the simulation actually rooted.
    const left=u.rootedUntil!-tick;
    const bind=left<12 ? .56+.40*(1-left/12) : .33+.15*(.5+.5*Math.sin((tick+u.id)*.09));
    drawEffect(c,"vines",0,5,bind,1,Math.max(20,radius*2.5));
  }
  if ((u.slowUntil??0)>tick) {
    const left=u.slowUntil!-tick;
    const frame=left<12 ? .65+.34*(1-left/12) : .27+.24*(.5+.5*Math.sin((tick+u.id)*.1));
    drawEffect(c,"rime",0,5,frame,1,Math.max(14,radius*1.85));
  }
  // Snapshots can contain a refresh a few ticks ahead of the displayed clock.
  const burn=u.burn && tick>=u.burn.applied ? u.burn : from.burn;
  const poison=u.poison && tick>=u.poison.applied ? u.poison : from.poison;
  if (burn && tick>=burn.applied && tick<burn.until) {
    const phase=(tick+u.id*7)%48;
    drawEffect(c,"cinder",-radius*.44,3,phase,48,Math.max(12,Math.min(21,radius*1.5)),u.id%2 ? 1 : -1);
  }
  if (poison && tick>=poison.applied && tick<poison.until) {
    drawEffect(c,"venom",radius*.60,-radius*.34,(tick+u.id*9)%54,54,14);
  }
  c.restore();
  if ((u.stunnedUntil??0)>tick && u.hp>0) drawStun(c,x,y-r*1.8-4*scale,scale,tick,u.id);
}

export function drawChain(c: Pens, arc: NonNullable<Unit["arc"]>, tick: number, sx: number, sy: number,
  bodyScale: number, teamFacing: number) {
  const {radius,stunTicks}=UNIT_DEFINITIONS.kirin, age=tick-arc.tick;
  if (age<0 || age>=stunTicks || arc.path.length<2) return;
  const [caster,first]=arc.path;
  const dx=first.x-caster.x, dy=first.y-caster.y;
  const facing=Math.abs(dx)>.08*Math.hypot(dx,dy) ? Math.sign(dx) : teamFacing;
  const rear=eventFade(tick,arc.tick,19), mount=radius/11*bodyScale;
  let x=caster.x*sx+facing*(13-9*rear)*mount, y=caster.y*sy-(25+6*rear)*mount;
  for (let i=1;i<arc.path.length;i++) {
    const to=arc.path[i], toX=to.x*sx, toY=to.y*sy-9*bodyScale;
    // Damage is simultaneous. All contacts flash on the cast tick, then
    // the return strokes flicker outward through the recorded hit positions.
    const lag=(i-1)*.9, progress=Math.max(0,age-lag)/(stunTicks-lag);
    drawBeam(c,(arc.tick+i)%2===0 ? "kirinFork" : "kirinArc",x,y,toX,toY,progress,1.25*bodyScale);
    x=toX; y=toY;
  }
}

export function drawSpecialShot(c: Pens, shot: Arrow, x: number, y: number, angle: number, k: number, tick: number) {
  c.save(); c.translate(x,y); c.scale(k,k);
  if(shot.kind==="stone") {
    const t=Math.max(0,Math.min(1,(tick-shot.releasedTick)/(shot.landTick!-shot.releasedTick)));
    oval(c,0,1.5,4.7,1.9,"#59634b50");c.translate(0,-7*TOWER_ART_SCALE*(1-t)-42*Math.sin(Math.PI*t));c.rotate(t*5.9);
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
