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
  cut(c, "M-6.8 -4.6 Q-4.7 -7.45 -.25 -6.7 Q4.8 -7.05 6.15 -3.4 L7 3.9 Q6.75 5.65 3.45 6 Q-.45 7.1 -6.65 5.65 Q-7.8 4.75 -7.05 2.35Z", d.coat);
  cut(c, "M-6.55 3.8 Q-.7 5.4 6.75 3.4 L6.6 4.95 Q.9 7.15 -6.6 5.3Z", d.hem, 0);
  cut(c, "M-4.75 -7.3 Q-5.15 -12.4 .35 -12.9 Q5.3 -13.3 6.05 -9.5 L7.15 -7.65 Q7.1 -6.75 5.85 -6.5 Q5.25 -3.35 1.9 -2.85 Q-3.35 -2.45 -4.75 -7.3Z", FACE, 1.15);
  oval(c, 3.6, -7.35 + .5 * p.pitch, 1, Math.max(.35, 1.23 - p.blink), INK);
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
  c.save(); c.translate(6 + 2 * brace, 1 - 4 * brace); c.rotate(-.18 + .24 * brace + .22 * clang);
  cut(c, "M-6.55 -9.85 Q-6.55 -11.65 -4.6 -12.2 Q.2 -13.6 5.1 -11.95 Q6.65 -11.45 6.65 -9.75 L6.7 2.25 Q6.7 7.65 1.55 11.3 Q-3.95 9.9 -5.8 6.95 Q-6.8 5.35 -6.65 1Z", d.coat, 1.65);
  cut(c, "M-5 -9.4 Q-3.85 -10.25 -2.05 -10.35 L-1.85 2.55 Q-1.65 5.9 .1 7.75 Q-3.8 6.45 -4.45 3.65Z", d.light, 0);
  cut(c, "M-5.4 -7.4 Q-.1 -9.1 5.7 -7.9 L5.7 -6.35 Q.1 -7.3 -5.4 -5.8Z M-4.4 4.3 Q0 5.1 5.45 3.15 Q5.25 4.35 4.55 5.35 Q.1 6.9 -3.6 6Z", IRON, 0);
  ring(c, .65, -.35, 2.7, brass);
  if (clang > .32) { line(c, 7, -6, 12, -10, linen, 1.8); line(c, 9, -3, 13, -3, brass, 1.5); }
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
    cut(c, "M-6.8 -8.4 Q-7.9 -14.8 -.75 -15.25 Q5.4 -15.6 6.45 -11 Q7.8 -10.65 8.05 -9.35 Q4.9 -9.15 1.9 -10.0 Q-2.7 -10.3 -6.8 -8.4Z", IRON);
    line(c,-6,-9,5,-11,d.hem,2.2);
    shield(c,d,brace,block);
  } else if (kind==="lancer") {
    cut(c, "M-6.15 -9.4 Q-6.6 -14.9 -.6 -15.8 Q5 -16.4 6.5 -12.2 L7.8 -10.45 Q4.9 -10.7 2.8 -10.05 Q-.35 -11.25 -2.1 -10.45 L-4.2 -8.6Z", IRON, 1.2);
    c.save(); c.translate(0,-14); c.rotate(-.34*charge+p.step*.12+.18*strike);
    cut(c, "M1.35 -.85 C-.75 -6.65 -7.45 -8.1 -12.4 -4.45 Q-9.65 -4.9 -7.55 -3.1 Q-9.15 -3.05 -10.05 -2.05 Q-6.4 -2.2 -4.25 -1.0 Q-1.9 .1 1.35 -.85Z", d.light, 1.05); c.restore();
    const stagger = (u?.stunnedUntil ?? 0)>tick ? 1 : 0;
    c.save(); c.translate(1+5.5*strike-2*stagger,0);
    c.rotate(-.75+.50*charge+.52*strike-.36*stagger+p.pitch*.45);
    limb(c,-8,1,17,1,WOOD,1.5); cut(c, "M14.55 .15 Q16.15 -.4 16.8 -1.2 L23.25 .75 Q19.25 2.05 16.05 3.15 L14.5 2.05Z", IRON, 1);
    c.save(); c.translate(12.6, 1); c.rotate(.16 * charge - .15 * strike + .08 * p.step);
    cut(c, "M0 0 L.15 3.95 Q-3.05 3.05 -5.6 4.7 Q-7.1 5.5 -8.8 4.85 Q-6.45 3.7 -6.2 2.25 Q-3.5 .95 0 0Z", d.coat, .8); c.restore();
    limb(c,-2,-1,3,1,FACE,2); oval(c,6,1,1.65,1.45,FACE); c.restore();
  } else if (kind==="bomber") {
    cut(c, "M-7.3 -9.2 Q-8.15 -16.65 -1.05 -17.0 Q5.65 -17.4 7.25 -12.05 Q7.65 -10 9.9 -9.45 Q10.2 -8.2 8.4 -8.1 Q2.15 -9.65 -3.95 -8.3 L-5.75 -6.5 Q-7.5 -7 -7.3 -9.2Z", d.hem);
    cut(c, "M-6.25 -11.2 Q1 -13.3 6.8 -11.65 L7.15 -9.55 Q.45 -11.1 -5.85 -9.0Z", "#a97e55", .75);
    oval(c,2,-10,2.4,2.1,INK); oval(c,2,-10,1.5,1.2,"#bfe2df");
    cut(c, "M-6.7 -3.9 Q-5.6 -5.35 -3.8 -5.65 Q-.2 -.75 5.95 3.25 L3.95 5.25 Q-2.5 2.15 -6.7 -3.9Z", leather, .95);
    const handX=6-12*p.ready+7*strike, handY=-1-10*p.ready-5*strike;
    limb(c,0,-2,handX*.47,handY+3,FACE,2.5); limb(c,handX*.47,handY+3,handX,handY,FACE,2.3);
    if (strike<.44) drawBomb(c,handX+1,handY-1.7,.86,tick);
  } else if (kind==="musketeer") {
    cut(c, "M-10.75 -11.55 Q-7.6 -10.75 -5.95 -12.5 Q-5.45 -17.65 -2.9 -18.25 Q1.15 -19.25 3.65 -17.25 L6.2 -12.7 Q9.6 -12.2 12.15 -14.1 Q12.25 -10.95 8.1 -9.9 Q3.75 -8.8 -.5 -10.1 Q-7.25 -8.65 -10.75 -11.55Z", d.hem, 1.25);
    c.save(); c.translate(-4,-16); c.rotate(.35*strike+.08*p.step);
    cut(c, "M.9 .9 C-1.3 -5.6 -7.55 -7.5 -11.45 -4.05 Q-8.75 -4.4 -7 -1.9 Q-4.75 .15 -2.35 -.25 L-3 1.25 Q-.85 1.75 .9 .9Z", d.light, .9); c.restore();
    line(c,-5,-2,1,4,"#f4d695",2.2);
    const age=tick-(u?.lastAttackTick??-Infinity);
    const reload=age>8 && age<43 ? Math.sin(Math.PI*(age-8)/35) : 0;
    c.save(); c.translate(4-3*strike,-1+2*reload); c.rotate(p.pitch*.65-.22*strike+.65*reload);
    cut(c, "M-7.1 .05 Q-4.9 -.5 -1.35 -2.2 Q.75 -3.4 3.6 -3.05 L7.35 -2.95 L7.45 -.4 L1.3 .05 Q-1 .1 -2.6 1.65 L-5.3 3.05 Q-6.55 2.95 -7.1 .05Z", "#a57448", 1.05);
    limb(c,5,-2,16,-2,"#b0bec2",2); oval(c,3,0,2,1.4,FACE); oval(c,9-7*reload,-1,1.6,1.4,FACE);
    if(strike>.6) cut(c,"M17 -2 L20 -5 L20 -3 L24 -2 L20 -1 L20 1Z","#ffe28c",.75);
    c.restore();
  } else if (kind==="scout") {
    cut(c, "M-8.2 -9.25 Q-8.15 -15.85 -.75 -16.35 Q4.9 -16.55 6.65 -12.35 Q7.35 -10.95 8.65 -9.7 Q5.05 -9.8 2.55 -10.3 Q-2.75 -10.65 -6.5 -7.75Z", "#536753", 1.2);
    cut(c, "M-3.7 -11.65 Q-6.9 -18.2 -13.85 -16.75 Q-12.55 -12.9 -7.95 -11.8 Q-5.25 -11.15 -3.7 -11.65Z", d.light, .9);
    c.save(); c.translate(0,-5); c.scale(1+.19*p.ready,1+.4*p.ready);
    cut(c, "M-5.4 -1.9 Q-.25 -3.55 6.25 -2.95 Q6.65 -.05 4.45 1.55 Q1.6 3.7 -.4 3.15 Q-3.55 2.7 -6.15 .85Z", "#715779", .9); c.restore();
    limb(c,3,-5,14+2.4*strike,-5+p.pitch*3-strike,"#777c56",1.3);
    oval(c,-5,2,2.6,3,INK); oval(c,-5,2,1.6,2,"#c786be");
  } else if (kind==="medic") {
    cut(c, "M-7.55 -8.5 Q-8.4 -10.5 -7.45 -13.3 Q-4.25 -17.6 1.9 -16.5 Q5.2 -16.65 6.8 -14.0 Q7.8 -11.95 5.8 -10.2 Q3.05 -9.1 .65 -10.4 Q-3.6 -9.2 -7.55 -8.5Z", linen, 1.2);
    line(c,-6,-12,3,-14,d.coat,2);
    limb(c,-4,-4,3,4,linen,2);
    cut(c, "M-10.2 -.15 Q-7.95 -1.3 -4.4 -1 Q-3.15 -.85 -3.15 .55 L-3.1 4.5 Q-5.0 6.0 -8.65 5.7 Q-10.0 5.4 -10.0 3.9Z", leather, 1);
    line(c, -8.7, 2.35, -5.3, 2.1, linen, 1); line(c, -7.1, .85, -6.85, 3.9, linen, 1);
    const turn=u?.wrappingSince===undefined ? 0 : Math.sin((tick-u.wrappingSince)*.47)*wrap;
    const hand=5+6*wrap+2.7*turn, height=1+2*wrap-2.7*turn;
    limb(c,-2,-2,5+3*wrap-2*turn,1+3*wrap+turn,FACE,1.9);
    limb(c,1,-1,hand,height,FACE,2.2); oval(c,hand,height,3.2,2.1,linen);
    line(c,hand-1,height+turn,hand+1,height-turn,leather,.85);
  } else {
    cut(c, "M-7.25 -9.25 Q-7.1 -15.85 -.55 -16.65 Q5.65 -17.1 6.7 -12.15 Q9 -12.2 9.95 -10.65 Q9.1 -9.2 6.25 -9.5 Q-.75 -10.6 -6.3 -8.35Z", brass, 1.2);
    line(c,-3,-8,6,-9,INK,2.4); oval(c,3.5,-8.6,2.2,1.5,"#bfe3d9");
    cut(c, "M-8.3 -2 Q-5.9 -2.95 -3.2 -2.15 L-2.4 3.85 Q-4.25 5.85 -7.9 5.0Z", leather, .95);
    c.save(); c.translate(4,0); c.rotate(-.6+(work+wrap)*.6*Math.sin(tick*.6)+strike);
    limb(c,0,1,5,-8,IRON,2); cut(c, "M2.9 -7.2 Q.8 -10.4 3.35 -12.95 L4.7 -10.25 L7.6 -11.35 Q8.85 -8.6 6.85 -6.8 Q4.5 -5.1 2.9 -7.2Z", IRON, 1);
    c.restore();
  }
}
function zombie(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const bite = eventFade(tick, u?.lastAttackTick, 14), rising = eventFade(tick, u?.zombified?.tick, 15);
  const drag = Math.max(0, p.step), stagger = Math.sin(tick * .07 + (u?.id ?? 0)) * .75;
  limb(c, -3, 1, -5 - p.step * 1.7, 8, "#687e6b", 2.1);
  line(c, -5 - p.step * 1.7, 8, -2 - p.step * 1.7, 8, INK, 2.6);
  limb(c, 3, 2, 5 + p.step * 3.9, 8 - drag * 3, leather, 2.2);
  c.translate(3.5 * bite + drag, 3 * rising + 1.5 * drag);
  c.rotate(.13 + p.step * .11 + stagger * .035 + .09 * bite);
  limb(c, -4.35, -3.25, 4 + 3 * drag, -5 + 2 * p.step, "#6e876f", 2.35);
  cut(c, "M-7.65 -3 C-7.6 -7.65 -1.7 -9.15 2.4 -6.05 Q5.9 -5.1 6.45 -1.85 L6.7 4.4 Q4.55 4.75 2.85 2.95 L.95 6.65 Q-.7 6.45 -2.1 4.5 Q-4.35 7.2 -6.45 7.5 Q-6.05 4.75 -7.5 3.5Z", d.coat, 1.25);
  cut(c, "M-5.45 -4.25 Q-2.8 -6.45 -.15 -5.65 L1.9 -3.45 L-.2 -3.65 L-.15 -1.65 Q-3.55 -1.85 -5.45 -4.25Z", d.hem, 0);
  c.save(); c.translate(2 * bite, -1.7 * p.ready); c.rotate(-.15 * p.ready + .16 * bite - .045 * p.step);
  cut(c, "M-6.5 -8.9 C-8.1 -13.8 -5.05 -17.3 .55 -17.15 Q5.95 -17.25 7 -13.45 Q7.4 -11.55 6.8 -10.2 L8.8 -8.55 Q9.25 -7.1 6.7 -6.45 Q5.6 -4.1 2.45 -4.25 Q-1.3 -4.05 -4.5 -6.15 Q-6.0 -6.9 -6.5 -8.9Z", "#9db481", 1.3);
  cut(c, "M-6.4 -10.9 Q-8.65 -13.3 -6.95 -16.2 Q-5.75 -18.4 -3.65 -17.35 Q-2.35 -19.2 1 -17.75 Q3.2 -17.0 4.8 -17.8 Q4.7 -15.65 2.4 -15.15 Q.1 -14.65 -1.4 -15.35 Q-1.8 -13.65 -4.4 -13.35Z", "#4f675c", .95);
  if (u?.zombified) oldHeadgear(c, u.zombified);
  oval(c, 4.0, -10.6, 2.15, 1.85, INK); oval(c, 4.35, -10.7, .94, 1.12, "#f3e393");
  line(c, -3.2, -10.3, -1.35, -8, "#6d8168", .9);
  c.save(); c.translate(1.0, -6.75); c.rotate(.48 * p.ready - .16 * bite);
  cut(c, "M-.45 .45 Q2.4 1.45 6.8 -.55 Q6.9 1.9 4.75 3.25 Q1.65 4.7 -.35 2.1Z", "#788e6c", .85);
  cut(c, "M3.8 .85 L5.2 .35 L4.75 2.05Z", FACE, 0); c.restore(); c.restore();
  const handX = 9.9 + 4 * bite + 2 * p.step, handY = -4 - 3 * bite + stagger;
  limb(c, 3, -2.2, handX, handY, "#9db481", 2.45);
  c.save(); c.translate(handX, handY);
  cut(c, "M-1 -.9 Q.8 -1.45 2.3 -.58 L3.6 -.85 Q3.95 .25 2.7 .65 Q3.3 1.15 3.05 1.9 Q.6 2 -.9 .75Z", "#9db481", .7);
  c.restore();
}
function mouse(c: Pens, d: Dye, p: CharacterPose, t: number, squeak: number) {
  c.translate(0, -Math.abs(p.step) * 2.2 - 2.5 * squeak); c.rotate(.1 * p.step - .18 * squeak);
  c.strokeStyle = leather; c.lineWidth = 1.7;
  c.beginPath(); c.moveTo(-7.2, 2.4); c.bezierCurveTo(-10.8, 5.2, -16.3, 3.5 + 2 * Math.sin(t * .17), -14.25, -1.9); c.stroke();
  cut(c, "M-9 2.3 Q-9.45 -5.55 -2.35 -7.15 Q3.2 -8.4 6.9 -3.7 Q8.8 -1.25 12.85 .25 Q13.65 1.7 11.45 2.8 Q7.2 5.7 .45 5.75 Q-6.65 6 -9 2.3Z", brass, 1.35);
  cut(c, "M-7.4 -2.5 Q-6 -5.75 -1.65 -6.45 Q.65 -6.55 1.65 -5.6 Q.55 -2.65 2.6 2.35 Q-.3 4.4 -3.2 4.6 Q-6.05 2.5 -7.4 -2.5Z", d.coat, .9);
  ring(c, 3.8 - squeak * 1.4, -6.65 - squeak * 1.7, 3.9, d.light);
  oval(c, 7.95, -1.6, 1.05, 1.18, INK); oval(c, 12.4 + squeak, .75 - squeak * .6, 1.25, 1.15, INK);
  limb(c, -4.35, -5.3, -5.4, -10.05, brass, 1.15);
  const turn = .25 + .75 * Math.abs(Math.cos(t * .13));
  c.save(); c.translate(-5.45, -10.4); c.scale(turn, 1);
  for (const side of [-1, 1]) {
    c.beginPath(); c.ellipse(side * 2, -.55, 2.05, 1.6, side * -.25, 0, 2 * Math.PI);
    c.strokeStyle = INK; c.lineWidth = 1.1; c.stroke();
  }
  c.restore();
  line(c, -4, 5.75, -2 + p.step * 2, 7, INK, 1.5); line(c, 4, 4.85, 6 - p.step * 2, 6, INK, 1.5);
}
function building(c: Pens,d: Dye,kind: UnitKind,p: CharacterPose,u: Unit|undefined,tick: number) {
  if(kind==="post") {
    for(const x of [-6,6]) limb(c,x,-7,x*1.4,9,WOOD,2.4);
    limb(c,-7,5,6,-4,leather,1.2);
    cut(c, "M-9.4 -10.95 Q-4.3 -11.65 -.5 -14 Q3.2 -11.75 9.4 -10.3 L8.1 -5.65 Q.5 -4.15 -8.15 -5.3Z", d.coat, 1.25);
    const kick=eventFade(tick,u?.lastAttackTick,11);
    c.save(); c.translate(-3*kick,-11); c.rotate(p.pitch*.55-.18*kick);
    limb(c,-3,0,11,0,IRON,2);
    line(c,9,-3.8,7,0,WOOD,1.6); line(c,7,0,9,3.8,WOOD,1.6);
    line(c,9,-3.8,7-6*p.ready,0,linen,.9); line(c,7-6*p.ready,0,9,3.8,linen,.9); c.restore();
    return;
  }
  cut(c, "M-9.8 -6.5 L8.7 -6.15 L9.3 6.5 Q8.95 7.85 6.45 7.95 L-9.75 7.95Z", "#d6ab74", 1.35);
  cut(c, "M-13.05 -5.95 Q-9.7 -8.9 -4.1 -14.4 Q-3.15 -15.35 -1.6 -15 L8.45 -13.65 Q9.65 -11.3 13.05 -5.45 Q10.4 -4.4 7.1 -5.5 Q1.75 -7.35 -2.4 -6.65 Q-8.1 -5.15 -13.05 -5.95Z", d.coat, 1.45);
  cut(c, "M-6.1 7.25 L-6.05 2.3 Q-5.3 -2.9 -1.45 -2.9 Q2.15 -2.65 2.5 1.4 L2.8 7.2Z", INK, .7);
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
  cut(c, "M-9.15 -.9 Q-9.35 -4.2 -5.35 -5.65 Q.6 -7.75 5.85 -4.9 Q8.75 -3.45 9 .3 Q9.15 3.2 5.05 4.8 Q.1 6.55 -5.5 4.6 Q-8.6 3.35 -9.15 -.9Z", d.coat, 1.35);
  cut(c, "M-7.6 .2 Q-5.65 2.25 -.4 2.9 Q-1 4.1 .6 4.95 Q-5 4.65 -6.9 2.7Z", d.hem, 0);
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
