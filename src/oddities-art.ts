import { FACE, INK, IRON, WOOD, cut, limb, line, oval, type Pens, type Dye } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { eventFade, type CharacterPose } from "./character-pose.ts";
import { ARMIES } from "./battlefield.ts";

const bone = "#f8eacb", plum = "#6c426e", brass = "#d6a452";

function shoes(c: Pens, p: CharacterPose, color: string, wide = 1) {
  for (const side of [-1,1]) {
    const x = side*3.8, step = x+side*p.step*2.6;
    limb(c,x,1,step,6,color,2.4);
    oval(c,step+1,7,3.1*wide,1.9,INK);
  }
}
function star(c: Pens,x: number,y: number,size: number,color: string) {
  c.save(); c.translate(x,y); c.scale(size,size);
  cut(c,"M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1Z",color,.65); c.restore();
}

export function minerArt(c: Pens,d: Dye,p: CharacterPose,u: Unit|undefined,tick: number) {
  const hit=eventFade(tick,u?.lastAttackTick,18), rise=eventFade(tick,u?.emergedTick,12);
  c.translate(-p.hurt*1.5,4*rise-p.lift);
  shoes(c,p,"#815f45");
  cut(c,"M-8 -4 Q-3 -8 4 -5 L7 4 L3 6 L-6 5Z",d.coat);
  cut(c,"M-5 -6 L-3 -6 L-1 -1 L3 -1 L4 -5 L6 -4 L5 4 L-4 4Z","#666e68",1);
  line(c,-4,3,5,2,brass,1.4);
  cut(c,"M-4 -13 Q1 -17 6 -13 L8 -9 L7 -6 L4 -4 L-3 -5 L-6 -9Z",FACE);
  cut(c,"M-3 -7 Q-1 -5 2 -6 L3 -4 L5 -6 L7 -7 L6 -3 L2 -1 L-2 -3Z","#705640",1);
  oval(c,4.4,-9,1.05,1.2,INK);
  cut(c,"M-8 -11 Q-7 -19 1 -19 Q6 -19 8 -14 L10 -12 L5 -11 L-6 -9Z","#d6a653");
  cut(c,"M-7 -12 L8 -15 L9 -12 L-7 -10Z",d.hem,1);
  oval(c,5,-15.3,3.2,3,INK); oval(c,5,-15.3,2.2,2.15,"#fff09d"); oval(c,5.5,-16,.85,.7,"#fffbe0");
  c.save(); c.translate(8+1.5*hit,-p.ready*2); c.rotate(.19-.72*p.ready+hit*1.3+p.step*.07);
  limb(c,-2,4,4,-11,WOOD,1.8);
  cut(c,"M-4 -8 Q0 -17 7 -14 L12 -10 Q7 -12 5 -11 Q0 -12 -4 -8Z",IRON,1.15);
  limb(c,-3,1,0,0,FACE,1.6); oval(c,0,0,2,1.8,FACE); c.restore();
}

export function balloon(c: Pens,x: number,y: number,size: number) {
  c.save(); c.translate(x,y); c.scale(size,size);
  cut(c,"M0 5 C-2 3 -5 1 -4.4 -2.5 Q-4 -6 0 -6 Q5 -6 5 -2 Q5 2 1 5 L2 7 L-1 7Z","#bd80b3",1.1);
  cut(c,"M-3 -3 Q0 -5 4 -4 L5 -2 Q1 -3 -3 0Z","#e7dc8e",0);
  oval(c,-2,-3,.8,1,"#fff5df"); c.restore();
}
export function clownArt(c: Pens,d: Dye,p: CharacterPose,u: Unit|undefined,tick: number) {
  const beat = tick*.095 + (u?.id??0), toss=eventFade(tick,u?.lastAttackTick,18);
  shoes(c,p,"#704a62",1.35); c.translate(2.3*toss-p.ready,-p.lift-p.breath*.45);
  c.rotate(.035*Math.sin(beat)-.16*p.ready+.17*toss);
  cut(c,"M-6 -5 Q1 -8 6 -4 L8 3 L5 6 L1 3 L-2 6 L-7 4Z",d.coat);
  cut(c,"M-7 -6 L-2 -8 L0 -6 L4 -8 L7 -6 L4 -2 L1 -4 L-3 -2Z",bone,.95);
  oval(c,0,0,1.2,1.2,"#ffd66b"); oval(c,1,3,1,1,"#ffd66b");
  for(const side of [-1,1]) {
    oval(c,side*5.5,-10,3.7,3.7,INK); oval(c,side*5.8,-10,2.9,2.8,"#6da89f");
  }
  cut(c,"M-5 -12 Q-5 -17 1 -16 Q7 -16 7 -12 L6 -8 Q3 -4 -1 -6 Q-5 -7 -5 -12Z","#fff4df");
  cut(c,"M-7 -13 L-9 -21 Q-5 -20 -1 -15 L2 -21 L6 -15 L6 -13Z",d.hem,1.15);
  oval(c,-9,-21,1.7,1.7,"#f3c35d"); oval(c,2,-21,1.3,1.3,"#f3c35d");
  cut(c,"M0 -13 L1 -15 L2 -12Z","#614966",.65);
  oval(c,4.5,-12,1,1.25,INK); oval(c,6.9,-10.3,2.4,2.1,INK); oval(c,7,-10.6,1.85,1.6,"#db584e");
  line(c,.4,-8.7,3,-8,"#95525f",1.1);
  const catchX=-10.5+3*Math.cos(beat), hop=Math.abs(Math.sin(beat));
  limb(c,-4,-2,catchX,-2-2*hop,FACE,1.7);
  const handX=9-8*p.ready+4*toss, handY=-4-6*p.ready-4*toss;
  limb(c,4,-2,handX,handY,FACE,1.8);
  balloon(c,catchX,-7-8*hop,.63);
  if (toss<.45) balloon(c,handX+1.7,handY-3,.69);
}

export function reaperArt(c: Pens,d: Dye,p: CharacterPose,u: Unit|undefined,tick: number) {
  const beat=tick*.08+(u?.id??0), swing=eventFade(tick,u?.lastAttackTick,17), soul=eventFade(tick,u?.soul?.tick,34);
  c.translate(3.3*swing-1.5*p.ready,-2-Math.sin(beat)*1.75);
  c.rotate(.1*p.pace-.13*p.ready+.13*swing);
  c.save();c.translate(-3,-6);c.rotate(.12*Math.sin(beat-.6)+.20*p.pace-.13*swing);c.translate(3,6);
  cut(c,"M-7 -10 Q-12 -2 -14 7 L-9 6 L-10 10 L-4 8 L1 10 L4 6 L9 7 L7 -4Z","#393a4d");
  c.restore();
  cut(c,"M-5 -7 Q-2 -5 2 -7 L5 5 L0 7 L-3 5 L-8 7Z",d.hem,1.1);
  cut(c,"M-9 -11 Q-9 -20 -2 -23 Q3 -23 7 -16 L9 -11 L6 -5 L-3 -6Z","#565169",1.6);
  cut(c,"M-5 -12 Q-3 -18 1 -19 Q6 -17 6 -12 L5 -7 L2 -7 L0 -6 L-3 -8Z",INK,.7);
  cut(c,"M-3 -13 Q0 -16 5 -14 L6 -11 L4 -10 L3 -8 L0 -8 L-1 -10 L-3 -10Z",bone,.65);
  cut(c,"M-3 -13 L0 -12 L-1 -10 L-3 -11Z M2 -12 L5 -13 L4 -10 L2 -10Z",INK,0);
  line(c,-4,-5,3,-4,d.light,1.35);
  c.save(); c.translate(-6-2*soul,-2*soul); c.rotate(.28*Math.sin(beat-.5)+.43*swing-.28*soul);
  line(c,0,-2,-2,1,brass,1.15);cut(c,"M-5 2 L1 1 L2 6 L-2 8 L-5 6Z","#718d86",1);
  oval(c,-1.5,4.6,1.4+soul*.6,2.1,"#a7efcf");c.restore();
  c.save();c.translate(8.5+1.8*swing,-.8-p.ready*1.8);c.rotate(.13-.67*p.ready+swing*1.45+p.pitch*.2);
  limb(c,-1,9,5,-19,"#987a57",1.55);
  cut(c,"M4 -19 Q-1 -25 -12 -20 Q-9 -27 -1 -27 Q7 -26 8 -20 L8 -15Z","#c4ded2",1.05);
  line(c,-5,-24,1,-23,"#effced",.95);
  limb(c,-3,1,2,-3,bone,1.55);c.restore();
}

export function witchArt(c: Pens,d: Dye,p: CharacterPose,u: Unit|undefined,tick: number) {
  const cast=eventFade(tick,u?.lastAttackTick,24);
  c.translate(1.8*cast-p.ready,-p.lift*.85-p.breath*.6); c.rotate(-.065*p.ready+.09*cast);
  shoes(c,p,"#58465c");
  cut(c,"M-4 -9 Q-3 -5 -6 0 L-10 6 Q-6 9 -2 6 L1 8 L7 5 L4 -5Z",d.hem);
  cut(c,"M-2 -5 L3 -6 L6 4 L1 6 L-4 4Z",d.coat,1);
  cut(c,"M-8 -13 Q-4 -20 2 -16 Q6 -16 6 -11 L9 -10 L7 -8 L4 -8 L3 -5 L-2 -6 L-5 -9Z",FACE);
  cut(c,"M-8 -13 Q-9 -6 -4 -5 L-6 -9 Q-1 -5 0 -9 L-2 -13Z","#aa7ab3",1.05);
  line(c,2,-12,5,-12.8,INK,1.1);oval(c,4.2,-11,1,1,INK);
  c.save();c.translate(0,-13);c.rotate(.065*p.step-.15*cast+.06*p.ready);c.translate(0,13);
  cut(c,"M-13 -13 Q-8 -15 -5 -16 L-4 -23 L-8 -26 Q-3 -30 1 -26 L4 -21 L7 -16 Q12 -16 13 -13 Q2 -10 -13 -13Z","#514559",1.55);
  cut(c,"M-4 -18 L4 -19 L6 -16 L-5 -15Z",d.coat,.7);
  cut(c,"M-1 -18 L3 -18.7 L3.6 -15.7 L-.5 -15.3Z","#f8c867",.65);line(c,.3,-17,1.8,-17.3,plum,.65);
  c.restore();
  cut(c,"M-8 1 L-4 0 L-3 5 L-7 6Z",plum,.9);
  limb(c,4,-3,8,-4-3*cast,FACE,1.8);
  c.save();c.translate(8,-5-3*cast);c.rotate(-.15-.8*p.ready+1.08*cast);
  limb(c,-1,4,3,-8,WOOD,1.2);star(c,3,-9,1.1,"#f8b9e0");c.restore();
}

export function pigArt(c: Pens,d: Dye,p: CharacterPose,u: Unit|undefined,tick: number) {
  const buck=eventFade(tick,u?.lastAttackTick,11);
  c.translate(2*buck,-p.lift*1.6);c.rotate(-.07+.17*buck);
  for (const side of [-1,1]) limb(c,side*5,2,side*(5+p.step*2.8),6.5,"#9f655e",1.6);
  c.beginPath();c.moveTo(-7,0);c.bezierCurveTo(-15,-2,-12,-8,-9,-5);c.quadraticCurveTo(-8,-2,-11,-3);
  c.strokeStyle=INK;c.lineWidth=1.35;c.stroke();
  cut(c,"M-9 0 Q-10 -6 -3 -8 Q3 -9 7 -7 L10 -5 L9 2 Q5 6 -1 5 Q-7 6 -9 0Z","#edaa99",1.4);
  cut(c,"M2 -7 L1 -13 L6 -10 L7 -6Z","#de958e",1);
  cut(c,"M-5 -7 L-1 -8 L1 -3 L-2 0 L-4 -3 L-6 -1Z",d.coat,1);
  oval(c,7,-4,1.2,1.45,INK);cut(c,"M8 -3 Q14 -5 14 0 Q13 3 8 2Z","#d78584",1);
  oval(c,11,-.5,.65,1,INK);oval(c,13,-1,.55,.85,INK);
}
export function oldHeadgear(c: Pens,u: NonNullable<Unit["zombified"]>) {
  const dye=ARMIES[u.team];
  if (u.kind==="clown") { oval(c,7,-8.5,1.8,1.5,"#d85753"); oval(c,-7,-12,2.2,2.2,"#68a295"); return; }
  if (u.kind==="medic" || u.kind==="archer" || u.kind==="scout" || u.kind==="musketeer") {
    cut(c,"M-8 -13 L-5 -17 L2 -17 L6 -14 L8 -13 L2 -13 L-1 -14Z",dye.hem,1);
    cut(c,"M-4 -15 Q-10 -23 -12 -19 L-9 -16Z","#debb7c",.75);
  } else {
    cut(c,"M-7 -12 L-7 -15 Q-4 -19 2 -18 L6 -15 L8 -14 L5 -13 L1 -15 L-2 -13Z",IRON,1.05);
    line(c,-7,-12,-2,-14,dye.hem,1.35);
    if(u.kind==="miner" || u.kind==="engineer") oval(c,4,-16,1.7,1.6,"#ffe58b");
    if(u.kind==="lancer") cut(c,"M0 -18 Q-4 -23 -9 -20 L-5 -19Z",dye.light,.85);
  }
}
