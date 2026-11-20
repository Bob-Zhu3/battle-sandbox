import { FACE, INK, IRON, WOOD, cut, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import { eventFade, type CharacterPose } from "./character-pose.ts";
import type { Unit } from "./simulation.ts";
import { clownArt, minerArt, oldHeadgear, pigArt, reaperArt, witchArt } from "./oddities-art.ts";
import { cyclops, frostQueen, kirin } from "./mythical-art.ts";
import { phoenix } from "./phoenix-art.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

const linen = "#fff5d9", leather = "#865836", brass = "#e3ad59";
function ring(c: Pens, x: number, y: number, r: number, color: string) {
  oval(c,x,y,r,r,INK); oval(c,x,y,r-1.2,r-1.2,color);
}
function boots(c: Pens, step: number, spread = 4, reach = 3) {
  for (const sign of [-1,1]) {
    const x = sign*spread, foot = x+sign*step*reach;
    const lift = Math.max(0,-sign*step)*2.5;
    limb(c,x,2,foot+.7,5-lift,leather,2); limb(c,foot+.7,5-lift,foot,8-lift,leather,1.7);
    line(c,foot-1,8-lift,foot+2.2,8-lift,INK,3);
  }
}
function tunic(c: Pens, d: Dye, p: CharacterPose) {
  cut(c,"M-7 -5 Q0 -8 6 -4 L7 5 Q0 8 -7 5Z",d.coat);
  oval(c,1,-7,5.4,5.3,INK); oval(c,1.3,-7,4.6,4.3,FACE);
  oval(c,3.6,-7.3+p.pitch*.5,1,Math.max(.35,1.2-p.blink),INK);
}
export function drawBomb(c: Pens, x: number, y: number, size: number, tick: number) {
  c.save(); c.translate(x,y); c.scale(size,size);
  oval(c,0,0,5.3,5.2,INK); oval(c,.3,-.3,4.25,3.9,"#56636a");
  oval(c,-1.3,-1.7,1.3,.9,"#c5d0c4");
  line(c,1,-4,3,-7,"#8b683e",1.6);
  const spark=1.3+Math.sin(tick*.65)*.45;
  oval(c,3,-7,spark+1,spark+1,"#e67a3f"); oval(c,3,-7,spark,spark,"#fff1a3");
  c.restore();
}
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
  const strike = eventFade(tick,u?.lastAttackTick,13);
  const brace = kind==="shieldbearer" ? eventFade(tick,u?.lastBraceTick,16) : 0;
  const block = kind==="shieldbearer" ? eventFade(tick,u?.lastBlockTick,12) : 0;
  const charge = kind==="lancer" ? Math.min(1,(u?.runUp??0)/UNIT_DEFINITIONS.lancer.runUp) : 0;
  boots(c,p.step,kind==="shieldbearer" ? 5+2*brace : 3.5,3+2*charge);
  c.translate(-p.hurt*2,-p.lift*1.3-p.breath+3*wrap+work);
  if (kind==="shieldbearer") { c.translate(-1.8*brace-2.1*block,2.2*brace); c.rotate(-.12*block); }
  else if (kind==="lancer") { c.translate(2*charge+2.6*strike,.85*charge); c.rotate(.24*charge+.15*strike); }
  else if (kind==="bomber") { c.translate(-1.4*p.ready+2.8*strike,1.4*p.ready); c.rotate(-.18*p.ready+.18*strike); }
  else if (kind==="musketeer") { c.translate(-2.6*strike,strike); c.rotate(-.13*strike); }
  tunic(c,d,p);
  if (kind==="shieldbearer") {
    cut(c,"M-6 -8 L-6 -12 Q0 -17 6 -12 L7 -9 L1 -10Z",IRON);
    line(c,-6,-9,5,-11,d.hem,2.2);
    shield(c,d,brace,block);
  } else if (kind==="lancer") {
    cut(c,"M-5 -10 L-5 -13 L1 -16 L6 -12 L7 -10Z",IRON);
    c.save(); c.translate(0,-14); c.rotate(-.34*charge+p.step*.12+.18*strike);
    cut(c,"M0 -1 Q-4 -8 -11 -4 L-6 -3 L-8 -1Z",d.light); c.restore();
    const stagger = (u?.stunnedUntil ?? 0)>tick ? 1 : 0;
    c.save(); c.translate(1+5.5*strike-2*stagger,0);
    c.rotate(-.75+.50*charge+.52*strike-.36*stagger+p.pitch*.45);
    limb(c,-8,1,17,1,WOOD,1.5); cut(c,"M15 -1 L23 1 L15 3Z",IRON);
    cut(c,"M12 1 L12 5 L5 4 L8 2Z",d.coat,1);
    limb(c,-2,-1,3,1,FACE,2); oval(c,6,1,1.65,1.45,FACE); c.restore();
  } else if (kind==="bomber") {
    cut(c,"M-7 -10 Q-7 -17 1 -16 Q7 -15 7 -10 L10 -8 L-6 -8Z",d.hem);
    cut(c,"M-5 -10 Q1 -13 7 -11 L7 -8 L-5 -8Z","#a97e55",1);
    oval(c,2,-10,2.4,2.1,INK); oval(c,2,-10,1.5,1.2,"#bfe2df");
    cut(c,"M-7 -4 L-3 -6 L6 3 L3 6Z",leather,1);
    const handX=6-12*p.ready+7*strike, handY=-1-10*p.ready-5*strike;
    limb(c,0,-2,handX*.47,handY+3,FACE,2.5); limb(c,handX*.47,handY+3,handX,handY,FACE,2.3);
    if (strike<.44) drawBomb(c,handX+1,handY-1.7,.86,tick);
  } else if (kind==="musketeer") {
    cut(c,"M-6 -12 L-4 -18 L3 -18 L7 -12 Q11 -13 13 -12 Q6 -7 -10 -10Z",d.hem);
    c.save(); c.translate(-4,-16); c.rotate(.35*strike+.08*p.step);
    cut(c,"M0 0 Q-5 -7 -10 -4 L-7 0 L-3 0 L-4 3Z",d.light,1); c.restore();
    line(c,-5,-2,1,4,"#f4d695",2.2);
    const age=tick-(u?.lastAttackTick??-Infinity);
    const reload=age>8 && age<43 ? Math.sin(Math.PI*(age-8)/35) : 0;
    c.save(); c.translate(4-3*strike,-1+2*reload); c.rotate(p.pitch*.65-.22*strike+.65*reload);
    cut(c,"M-7 0 L1 -3 L7 -3 L8 0 L0 1 L-5 3Z","#a57448",1.1);
    limb(c,5,-2,16,-2,"#b0bec2",2); oval(c,3,0,2,1.4,FACE); oval(c,9-7*reload,-1,1.6,1.4,FACE);
    if(strike>.6) cut(c,"M17 -2 L20 -5 L20 -3 L24 -2 L20 -1 L20 1Z","#ffe28c",.75);
    c.restore();
  } else if (kind==="scout") {
    cut(c,"M-8 -9 Q-6 -16 1 -16 L6 -13 L8 -9 L2 -10Z","#536351");
    cut(c,"M-4 -12 Q-9 -19 -14 -16 Q-12 -12 -6 -11Z",d.light,1);
    c.save(); c.translate(0,-5); c.scale(1+.19*p.ready,1+.4*p.ready);
    cut(c,"M-4 -2 L6 -3 L5 1 L0 3 L-6 1Z","#715779",1); c.restore();
    limb(c,3,-5,14+2.4*strike,-5+p.pitch*3-strike,"#777c56",1.3);
    oval(c,-5,2,2.6,3,INK); oval(c,-5,2,1.6,2,"#c786be");
  } else if (kind==="medic") {
    cut(c,"M-7 -8 L-8 -12 Q-3 -18 4 -15 L7 -11 L4 -9 L-1 -11Z",linen);
    line(c,-6,-12,3,-14,d.coat,2);
    limb(c,-4,-4,3,4,linen,2);
    cut(c,"M-10 0 L-4 -1 L-3 5 L-9 6Z",leather);
    const turn=u?.wrappingSince===undefined ? 0 : Math.sin((tick-u.wrappingSince)*.47)*wrap;
    const hand=5+6*wrap+2.7*turn, height=1+2*wrap-2.7*turn;
    limb(c,-2,-2,5+3*wrap-2*turn,1+3*wrap+turn,FACE,1.9);
    limb(c,1,-1,hand,height,FACE,2.2); oval(c,hand,height,3.2,2.1,linen);
    line(c,hand-1,height+turn,hand+1,height-turn,leather,.85);
  } else {
    cut(c,"M-6 -10 Q-5 -17 2 -16 Q7 -15 6 -11 L9 -10 L-7 -8Z",brass);
    line(c,-3,-8,6,-9,INK,2.4); oval(c,3.5,-8.6,2.2,1.5,"#bfe3d9");
    cut(c,"M-8 -2 L-3 -2 L-2 5 L-8 6Z",leather);
    c.save(); c.translate(4,0); c.rotate(-.6+(work+wrap)*.6*Math.sin(tick*.6)+strike);
    limb(c,0,1,5,-8,IRON,2); cut(c,"M2 -8 L3 -13 L5 -10 L8 -11 L8 -8 L5 -6Z",IRON,1);
    c.restore();
  }
}
function zombie(c: Pens, d: Dye, p: CharacterPose, u: Unit|undefined, tick: number) {
  const bite=eventFade(tick,u?.lastAttackTick,14), rising=eventFade(tick,u?.zombified?.tick,15);
  const drag=Math.max(0,p.step), stagger=Math.sin(tick*.07+(u?.id??0))*.75;
  limb(c,-3,1,-5-p.step*1.7,8,"#647c69",2);
  line(c,-5-p.step*1.7,8,-2-p.step*1.7,8,INK,2.6);
  limb(c,3,2,5+p.step*3.9,8-drag*3,leather,2.2);
  c.translate(3.5*bite+drag,3*rising+1.5*drag);
  c.rotate(.13+p.step*.11+stagger*.035+.09*bite);
  limb(c,-4,-3,4+3*drag,-5+2*p.step,"#647c69",2.4);
  cut(c,"M-7 -5 L1 -7 L6 -4 L6 4 L3 3 L1 6 L-2 4 L-5 7 L-7 3Z",d.coat);
  c.save();c.translate(2*bite,-1.7*p.ready);c.rotate(-.15*p.ready+.16*bite-.045*p.step);
  cut(c,"M-6 -9 Q-7 -15 -1 -16 L5 -15 L7 -12 L7 -8 L9 -7 L6 -4 L2 -4 L-4 -6Z","#9db481",1.35);
  cut(c,"M-6 -11 L-7 -15 L-4 -14 L-3 -17 L2 -16 L4 -17 L6 -14 L0 -14 L-3 -12Z","#4c6459",1);
  if (u?.zombified) oldHeadgear(c,u.zombified);
  oval(c,4,-10,2,1.6,INK); oval(c,4.3,-10,.85,1,"#f3e393");
  line(c,-3,-10,-1,-7,"#677a62",1);
  c.save();c.translate(1,-6);c.rotate(.48*p.ready-.13*bite);
  cut(c,"M0 0 L7 -1 L6 2 L2 2Z","#728c67",.8);line(c,4,0,4.6,1,"#fff1ba",.9);c.restore();c.restore();
  limb(c,3,-2,10+4*bite+2*p.step,-4-3*bite+stagger,"#9db481",2.5);
  line(c,10+4*bite+2*p.step,-4-3*bite+stagger,13+4*bite+2*p.step,-3-3*bite,INK,1);
}
function mouse(c: Pens,d: Dye,p: CharacterPose,t: number,squeak: number) {
  c.translate(0,-Math.abs(p.step)*2.2-2.5*squeak); c.rotate(.1*p.step-.18*squeak);
  c.strokeStyle=leather; c.lineWidth=1.8;
  c.beginPath(); c.moveTo(-7,2); c.quadraticCurveTo(-15,4+2*Math.sin(t*.17),-13,-2); c.stroke();
  cut(c,"M-9 3 Q-9 -6 -2 -7 Q4 -8 7 -3 L13 1 L8 4 Q1 7 -7 5Z",brass);
  cut(c,"M-7 -3 Q-3 -7 1 -6 L3 3 L-3 5Z",d.coat,1);
  ring(c,4-squeak*1.4,-7-squeak*1.7,4.1,d.light);
  oval(c,8,-1.6,1,1.2,INK); oval(c,12+squeak,1-squeak*.6,1.3,1.2,INK);
  line(c,-4,-6,-5,-11,INK,1.6);
  const width=2+Math.abs(Math.cos(t*.13))*2;
  oval(c,-5,-11,width,1.7,INK); oval(c,-5,-11,width*.53,.7,brass);
  line(c,-4,6,-2+p.step*2,7,INK,1.5); line(c,4,5,6-p.step*2,6,INK,1.5);
}
function building(c: Pens,d: Dye,kind: UnitKind,p: CharacterPose,u: Unit|undefined,tick: number) {
  if(kind==="post") {
    for(const x of [-6,6]) limb(c,x,-7,x*1.4,9,WOOD,2.4);
    limb(c,-7,5,6,-4,leather,1.2);
    cut(c,"M-9 -11 L0 -14 L9 -10 L8 -5 L-8 -5Z",d.coat);
    const kick=eventFade(tick,u?.lastAttackTick,11);
    c.save(); c.translate(-3*kick,-11); c.rotate(p.pitch*.55-.18*kick);
    limb(c,-3,0,11,0,IRON,2);
    line(c,9,-3.8,7,0,WOOD,1.6); line(c,7,0,9,3.8,WOOD,1.6);
    line(c,9,-3.8,7-6*p.ready,0,linen,.9); line(c,7-6*p.ready,0,9,3.8,linen,.9); c.restore();
    return;
  }
  cut(c,"M-10 -6 L8 -6 L10 7 L-10 8Z","#d6ab74");
  cut(c,"M-13 -6 L-3 -15 L9 -13 L13 -5 L0 -7Z",d.coat);
  cut(c,"M-5 7 L-5 2 Q-2 -4 2 0 L3 7Z",INK);
  const open=eventFade(tick,u?.lastSpawnTick,23);
  line(c,-6,1-open*3,2,1-open*3,WOOD,2.3);
  c.save();c.translate(6,-3);c.rotate(u?.constructingSince!==undefined?tick*.11:.25);
  for(let i=0;i<4;i++){line(c,-3,0,3,0,INK,1.8);c.rotate(Math.PI/4);}
  ring(c,0,0,2.3,brass);c.restore();
  for(let i=0;i<3;i++)oval(c,3+i*2.4,5,1,1,i<3-(u?.builtCount??0)?linen:leather);
}
function drone(c: Pens,d: Dye,p: CharacterPose,u: Unit|undefined,tick: number) {
  const t=tick+(u?.id??0)*13;
  const shot=u?.nextBurstTick===undefined ? u?.lastAttackTick : u.nextBurstTick-UNIT_DEFINITIONS.drone.burstGap;
  const recoil=eventFade(tick,shot,6);
  c.translate(-2.8*recoil,-4-Math.sin(t*.088)*2.4+1.1*recoil);
  c.rotate(.18*p.pace-.17*recoil+Math.sin(t*.061)*.045);
  for(const s of [-1,1]) {
    limb(c,s*3,-1,s*9,-6,IRON,1.7);
    c.save(); c.translate(s*10,-7); c.rotate(-.12*p.pace+s*.09*recoil);
    const blade=Math.cos(t*.36+s*.7)*7.9;
    line(c,-blade,-.7,blade,.7,INK,1.85);
    line(c,.25*blade,.35,blade,.7,"#d1d8bd",1); oval(c,0,0,1.65,1.35,"#b89258"); c.restore();
  }
  cut(c,"M-8 -3 Q-1 -9 7 -4 L9 1 L4 5 L-5 5 L-9 1Z",d.coat);
  ring(c,4,-1,3.3,"#a3e3dd"); oval(c,5,-1,1.1,1.1,INK);
  c.save();c.translate(0,4);c.rotate(p.pitch*.43);
  limb(c,-1,1,8-recoil*3.5,1,IRON,2);c.restore();
}
export function drawSpecialist(c: Pens,d: Dye,kind: UnitKind,p: CharacterPose,u?: Unit,tick=0) {
  const t=tick+(u?.id??0)*11;
  switch(kind) {
    case "miner": minerArt(c,d,p,u,tick); break;
    case "clown": clownArt(c,d,p,u,tick); break;
    case "reaper": reaperArt(c,d,p,u,tick); break;
    case "witch": witchArt(c,d,p,u,tick); break;
    case "pig": pigArt(c,d,p,u,tick); break;
    case "cyclops": cyclops(c,d,p,u,tick); break;
    case "frostqueen": frostQueen(c,d,p,u,tick); break;
    case "zombie": zombie(c,d,p,u,tick); break;
    case "mouse": {
      const squeak=eventFade(tick,u?.lastSqueakTick,20);
      mouse(c,d,p,t,squeak);
      if(squeak>.1) {
        line(c,10,-4,15,-9,linen,1.8);line(c,12,-2,19,-3,brass,1.7);
      }
      break;
    }
    case "workshop": case "post": building(c,d,kind,p,u,tick); break;
    case "drone": drone(c,d,p,u,tick); break;
    case "kirin": kirin(c,d,p,u,tick); break;
    case "phoenix": phoenix(c,d,p,u,tick); break;
    default: human(c,d,kind,p,u,tick);
  }
}
export function fallenSpecialist(c: Pens,d: Dye,kind: UnitKind) {
  if(kind==="bomber") cut(c,"M-6 0 Q0 -7 5 0 L7 2 L-6 2Z",d.hem);
  else if(kind==="shieldbearer") shield(c,d,0,0);
  else if(kind==="medic" || kind==="engineer") cut(c,"M-6 -3 L4 -4 L6 3 L-5 4Z",leather);
  else if(kind==="mouse" || kind==="drone" || kind==="post" || kind==="workshop") ring(c,0,0,4,brass);
  else if(kind==="phoenix" || kind==="kirin") cut(c,"M-7 3 Q-4 -4 6 -6 Q4 0 -7 3Z",d.light);
  else cut(c,"M-7 -1 Q-2 -5 5 -1 L4 3 L-5 4Z",d.coat);
}
