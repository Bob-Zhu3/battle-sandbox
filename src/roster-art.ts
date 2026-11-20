import { FACE, INK, IRON, WOOD, line, oval, shape, type Dye, type Pens } from "./ink.ts";
import type { CharacterPose } from "./character-pose.ts";
import type { Unit } from "./simulation.ts";
import type { UnitKind } from "./units.ts";

const linen = "#fff5d9", leather = "#865836", brass = "#e3ad59", jade = "#7bb4a0";
const paths = new Map<string, Path2D>();
function cut(c: Pens, path: string, paint: string, width = 1.35) {
  let cached = paths.get(path);
  if (!cached) { cached = new Path2D(path); paths.set(path, cached); }
  shape(c, cached, paint, width);
}
function ring(c: Pens, x: number, y: number, r: number, color: string) {
  oval(c,x,y,r,r,INK); oval(c,x,y,r-1.2,r-1.2,color);
}
function limb(c: Pens, x: number, y: number, ex: number, ey: number, paint: string, width = 3) {
  line(c,x,y,ex,ey,INK,width+1.5); line(c,x,y,ex,ey,paint,width);
}
function boots(c: Pens, step: number, spread = 4) {
  for (const sign of [-1,1]) {
    const x = sign * spread, foot = x + sign * step * 3;
    limb(c,x,2,foot,8,leather,2); line(c,foot-1,8,foot+2,8,INK,3);
  }
}
function tunic(c: Pens, d: Dye, p: CharacterPose) {
  cut(c,"M-7 -5 Q0 -8 6 -4 L7 5 Q0 8 -7 5Z",d.coat);
  oval(c,1,-7,5.4,5.3,INK); oval(c,1.3,-7,4.6,4.3,FACE);
  oval(c,3.6,-7.3+p.pitch*.5,1,Math.max(.35,1.2-p.blink),INK);
}
export function drawBarrel(c: Pens, x: number, y: number, tilt: number, scale = 1) {
  c.save(); c.translate(x,y); c.rotate(tilt); c.scale(scale,scale);
  cut(c,"M-7 -6 Q-1 -9 6 -6 Q9 0 6 6 Q0 9 -7 6 Q-9 0 -7 -6Z","#bd8145");
  line(c,-4,-6,-4,6,IRON,2); line(c,4,-6,4,6,IRON,2);
  line(c,-2,-3,2,-3,"#eac386",1.1); oval(c,0,2,1.1,1.1,leather);
  c.restore();
}
const fade = (tick: number, then: number | undefined | null, duration: number) =>
  then == null ? 0 : Math.max(0, 1 - Math.max(0,tick-then)/duration);

function shield(c: Pens, d: Dye, brace: number, clang: number) {
  c.save(); c.translate(6 + 2*brace,1 - 4*brace); c.rotate(-.18 + .24*brace + .22*clang);
  cut(c,"M-6 -11 Q0 -14 6 -11 L7 5 L2 11 L-5 8Z",d.coat,1.8);
  cut(c,"M-5 -9 L-2 -10 L0 7 L-3 7Z",d.light,0);
  line(c,-4,-7,5,-9,IRON,1.6); line(c,-3,5,5,4,IRON,1.4);
  ring(c,1,0,2.8,brass);
  if (clang>.32) { line(c,7,-6,12,-10,linen,1.8); line(c,9,-3,13,-3,brass,1.5); }
  c.restore();
}
function human(c: Pens, d: Dye, kind: UnitKind, p: CharacterPose, u: Unit | undefined, tick: number) {
  const wrap = u?.wrappingSince !== undefined ? Math.min(1,(tick-u.wrappingSince+3)/12) : 0;
  const work = u?.constructingSince !== undefined ? 1 : 0;
  const strike = fade(tick,u?.lastAttackTick,13);
  boots(c,p.step,kind==="shieldbearer"?5:3.5);
  c.translate(-p.hurt*2,-p.lift*1.3-p.breath+3*wrap+work);
  tunic(c,d,p);
  if (kind==="shieldbearer") {
    cut(c,"M-6 -8 L-6 -12 Q0 -17 6 -12 L7 -9 L1 -10Z",IRON);
    line(c,-6,-9,5,-11,d.hem,2.2);
    shield(c,d,fade(tick,u?.lastBraceTick,16),fade(tick,u?.lastBlockTick,12));
  } else if (kind==="lancer") {
    cut(c,"M-5 -10 L-5 -13 L1 -16 L6 -12 L7 -10Z",IRON);
    cut(c,"M0 -15 Q-4 -22 -10 -18 L-5 -17 L-7 -15Z",d.light);
    const charge=Math.min(1,(u?.runUp??0)/50);
    c.save(); c.translate(1+4*strike,0); c.rotate(-.44 + .4*charge + .35*strike + p.pitch*.45);
    limb(c,-8,1,17,1,WOOD,1.5); cut(c,"M15 -1 L23 1 L15 3Z",IRON);
    cut(c,"M12 1 L12 5 L5 4 L8 2Z",d.coat,1); c.restore();
  } else if (kind==="cooper") {
    cut(c,"M-6 -10 Q-7 -16 1 -15 Q6 -15 7 -10 L9 -9 L-6 -8Z",d.hem);
    cut(c,"M-4 -3 L3 -5 L5 5 L-4 5Z",leather,1);
    if (strike<.42) drawBarrel(c,6,1,-.18,.8);
    limb(c,-1,0,5+8*strike,1+3*strike,FACE,2.4);
  } else if (kind==="medic") {
    cut(c,"M-7 -8 L-8 -12 Q-3 -18 4 -15 L7 -11 L4 -9 L-1 -11Z",linen);
    line(c,-6,-12,3,-14,d.coat,2);
    limb(c,-4,-4,3,4,linen,2);
    cut(c,"M-10 0 L-4 -1 L-3 5 L-9 6Z",leather);
    const hand=5+6*wrap;
    limb(c,1,-1,hand,1+3*wrap,FACE,2.4);
    oval(c,hand,1+3*wrap,3.4,2.3,linen);
    line(c,hand-1,1+3*wrap,hand+1,1+3*wrap,leather,.85);
  } else {
    cut(c,"M-6 -10 Q-5 -17 2 -16 Q7 -15 6 -11 L9 -10 L-7 -8Z",brass);
    line(c,-3,-8,6,-9,INK,2.4); oval(c,3.5,-8.6,2.2,1.5,"#bfe3d9");
    cut(c,"M-8 -2 L-3 -2 L-2 5 L-8 6Z",leather);
    c.save(); c.translate(4,0); c.rotate(-.6+(work+wrap)*.6*Math.sin(tick*.6)+strike);
    limb(c,0,1,5,-8,IRON,2); cut(c,"M2 -8 L3 -13 L5 -10 L8 -11 L8 -8 L5 -6Z",IRON,1);
    c.restore();
  }
}
function giant(c: Pens,d: Dye,p: CharacterPose,u: Unit|undefined,tick: number) {
  const fear=u?.fearId!==undefined, held=!!u?.barrel;
  const shove=fade(tick,u?.lastAttackTick,16);
  boots(c,p.step*(fear?1.7:1),5);
  c.translate(-p.hurt,-p.lift*(fear?2.5:1)-p.breath);
  cut(c,"M-10 -6 Q-6 -11 1 -9 L8 -6 L9 4 L5 7 L-9 6Z",d.coat,1.5);
  cut(c,"M-9 -5 L-6 -9 L2 5 L-2 6Z",leather,1);
  cut(c,"M-6 -14 Q-1 -18 5 -14 L7 -10 L9 -9 L8 -4 Q4 -1 -3 -4 L-6 -8Z","#e7b188");
  cut(c,"M-7 -10 L-8 -15 L-6 -14 L-4 -18 L0 -16 L3 -18 L6 -15 L4 -12 L-2 -13Z","#785945");
  oval(c,fear?1.8:4.5,-9.6+(fear?1:0),fear?1.5:1,fear?1.9:1.2,INK);
  if (fear) oval(c,6,-6,1.5,1.9,INK);
  const y=held?-17:fear?-12:2, front=held?7:fear?9:8+3*shove;
  limb(c,-7,-4,-9,y,FACE,3.1); limb(c,6,-3,front,y,FACE,3.7);
  if (held) drawBarrel(c,2,-21.5,-.15,.94);
  if (fear) { line(c,-8,-15,-11,-18,linen,1.2); line(c,-10,-13,-14,-14,linen,1); }
}
function mouse(c: Pens,d: Dye,p: CharacterPose,t: number) {
  c.translate(0,-Math.abs(p.step)*1.4);
  c.strokeStyle=leather; c.lineWidth=1.8;
  c.beginPath(); c.moveTo(-7,2); c.quadraticCurveTo(-15,4+2*Math.sin(t*.17),-13,-2); c.stroke();
  cut(c,"M-9 3 Q-9 -6 -2 -7 Q4 -8 7 -3 L13 1 L8 4 Q1 7 -7 5Z",brass);
  cut(c,"M-7 -3 Q-3 -7 1 -6 L3 3 L-3 5Z",d.coat,1);
  ring(c,4,-7,4.1,d.light); oval(c,8,-1.6,1,1.2,INK); oval(c,12,1,1.3,1.2,INK);
  line(c,-4,-6,-5,-11,INK,1.6);
  const width=2+Math.abs(Math.cos(t*.13))*2;
  oval(c,-5,-11,width,1.7,INK); oval(c,-5,-11,width*.53,.7,brass);
  line(c,-4,6,-2+p.step*2,7,INK,1.5); line(c,4,5,6-p.step*2,6,INK,1.5);
}
function building(c: Pens,d: Dye,kind: UnitKind,u: Unit|undefined,tick: number) {
  if(kind==="post") {
    for(const x of [-6,6]) limb(c,x,-7,x*1.4,9,WOOD,2.4);
    limb(c,-7,5,6,-4,leather,1.2);
    cut(c,"M-9 -11 L0 -14 L9 -10 L8 -5 L-8 -5Z",d.coat);
    c.save(); c.translate(0,-11); c.rotate((u?.aimY??0)*.55);
    limb(c,-3,0,11,0,IRON,2); line(c,7,-3,7,3,WOOD,2); c.restore();
    return;
  }
  cut(c,"M-10 -6 L8 -6 L10 7 L-10 8Z","#d6ab74");
  cut(c,"M-13 -6 L-3 -15 L9 -13 L13 -5 L0 -7Z",d.coat);
  cut(c,"M-5 7 L-5 2 Q-2 -4 2 0 L3 7Z",INK);
  const open=fade(tick,u?.lastSpawnTick,23);
  line(c,-6,1-open*3,2,1-open*3,WOOD,2.3);
  c.save();c.translate(6,-3);c.rotate(u?.constructingSince!==undefined?tick*.11:.25);
  for(let i=0;i<4;i++){line(c,-3,0,3,0,INK,1.8);c.rotate(Math.PI/4);}
  ring(c,0,0,2.3,brass);c.restore();
  for(let i=0;i<3;i++)oval(c,3+i*2.4,5,1,1,i<3-(u?.builtCount??0)?linen:leather);
}
function drone(c: Pens,d: Dye,u: Unit|undefined,t: number) {
  c.translate(0,-3-Math.sin(t*.09)*1.6);
  for(const s of [-1,1]) {
    limb(c,s*3,-1,s*9,-6,IRON,1.7);
    const spin=4+Math.abs(Math.sin(t*.6))*4;
    line(c,s*10-spin,-7,s*10+spin,-7,INK,1.6);
  }
  cut(c,"M-8 -3 Q-1 -9 7 -4 L9 1 L4 5 L-5 5 L-9 1Z",d.coat);
  ring(c,4,-1,3.3,"#a3e3dd"); oval(c,5,-1,1.1,1.1,INK);
  limb(c,-1,5,7-fade(t,u?.lastAttackTick,9)*2,5,IRON,2);
}
function kirin(c: Pens,d: Dye,p: CharacterPose,u: Unit|undefined,t: number) {
  c.translate(0,-2.5-Math.sin(t*.065)*1.3);
  for(const s of [-1,1]) { limb(c,s*4,2,s*5+p.step,7,jade,1.6); line(c,s*5+p.step,7,s*5+2+p.step,7,INK,1.9); }
  cut(c,"M-8 -4 Q-3 -8 2 -4 L4 -11 L7 -14 L9 -11 L13 -8 L11 -6 L7 -7 L5 0 Q1 6 -7 3Z",jade);
  cut(c,"M-8 -3 Q-11 -12 -15 -9 L-12 -5 L-15 -5 L-9 2Z",d.light);
  cut(c,"M-5 -4 Q0 -6 4 -4 L3 1 L-2 2Z",d.coat,1);
  limb(c,6,-12,5,-20,WOOD,1.3); limb(c,5,-16,2,-18,WOOD,1);
  limb(c,8,-12,11,-18,WOOD,1.2); oval(c,9,-10,1,1.1,INK);
  if(fade(t,u?.arc?.tick,9)) line(c,4,-20,10,-20,"#fff8b2",1.7);
}
function phoenix(c: Pens,d: Dye,u: Unit|undefined,t: number) {
  if(u?.emberUntil!==undefined) {
    oval(c,0,5,6,2.5,"#866a52"); const pulse=1+Math.sin(t*.23)*.5;
    cut(c,"M-4 5 Q-6 0 -2 -1 L0 -5 L2 -1 Q7 1 4 5Z","#ee8753");
    oval(c,1,2,1.5,pulse,"#fff4af"); return;
  }
  const flap=Math.sin(t*.115); c.translate(0,-3-flap*1.4);
  cut(c,"M0 1 Q-9 -1 -15 5 L-9 5 L-12 9 L-3 5Z","#ed8757");
  c.save(); c.rotate(flap*.44);
  cut(c,"M2 -2 Q-5 -8 -13 -15 L-12 -8 L-15 -10 L-10 -3 Q-5 2 2 1Z",d.coat);
  line(c,-9,-8,-4,-3,"#ffd879",1.25); c.restore();
  cut(c,"M-5 1 Q-1 -5 4 -5 L7 -10 L9 -8 L9 -4 L13 -3 L9 -1 Q4 5 -3 4Z","#ffc56b");
  oval(c,7,-5,1,1,INK); cut(c,"M-2 1 L3 -2 L6 -1 L1 4Z",d.coat,1);
}
export function drawSpecialist(c: Pens,d: Dye,kind: UnitKind,p: CharacterPose,u?: Unit,tick=0) {
  const t=tick+(u?.id??0)*11;
  switch(kind) {
    case "giant": giant(c,d,p,u,tick); break;
    case "mouse":
      mouse(c,d,p,t);
      if(fade(tick,u?.lastSqueakTick,20)>.1) {
        line(c,10,-4,15,-9,linen,1.8);line(c,12,-2,19,-3,brass,1.7);
      }
      break;
    case "workshop": case "post": building(c,d,kind,u,tick); break;
    case "drone": drone(c,d,u,tick); break;
    case "kirin": kirin(c,d,p,u,tick); break;
    case "phoenix": phoenix(c,d,u,t); break;
    default: human(c,d,kind,p,u,tick);
  }
}
export function fallenSpecialist(c: Pens,d: Dye,kind: UnitKind) {
  if(kind==="cooper") drawBarrel(c,0,0,.2,.75);
  else if(kind==="shieldbearer") shield(c,d,0,0);
  else if(kind==="medic" || kind==="engineer") cut(c,"M-6 -3 L4 -4 L6 3 L-5 4Z",leather);
  else if(kind==="mouse" || kind==="drone" || kind==="post" || kind==="workshop") ring(c,0,0,4,brass);
  else if(kind==="phoenix" || kind==="kirin") cut(c,"M-7 3 Q-4 -4 6 -6 Q4 0 -7 3Z",d.light);
  else cut(c,"M-7 -1 Q-2 -5 5 -1 L4 3 L-5 4Z",d.coat);
}
