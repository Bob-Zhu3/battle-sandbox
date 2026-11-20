import { ARMIES } from "./battlefield.ts";
import type { CharacterPose } from "./character-pose.ts";
import { INK, cut, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export function cyclops(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const lift = u?.windup?.kind === "smash" ? Math.min(1, (tick-u.windup.since+1)/18) : 0;
  const swing = Math.max(0, 1 - (tick-(u?.lastSmashTick ?? -100))/18);
  const scoop = u?.windup?.kind === "swallow" ? Math.min(1,(tick-u.windup.since+1)/13) : 0;
  const chew = Math.max(0, 1-(tick-(u?.lastSwallow?.tick ?? -100))/22);
  const hide = "#a69a99", shadow = "#736978", horn = "#f5d7a2";
  // The far fist and forearm disappear behind the shoulder and chest.
  limb(c,-6,-6,-13,1,shadow,4.4);
  oval(c,-12,2,3.5,4,INK); oval(c,-12,2,2.6,3.1,shadow);
  for (const sign of [-1,1]) {
    const foot = sign * (5+p.step*2);
    limb(c,sign*4,2,foot,8,shadow,3.1); line(c,foot-2,8,foot+1.8,8,INK,3);
  }
  c.translate(-p.hurt,-p.lift-p.breath+lift*.8+scoop);
  cut(c,"M-11 -5 Q-12 -11 -5 -12 Q2 -14 8 -8 L10 -1 L7 5 L-7 6 L-11 2Z",hide,1.8);
  cut(c,"M-11 -8 L-8 -13 L-6 -11 L-4 -14 L0 -10 L-3 -7 L-6 -6Z","#574958",1);
  cut(c,"M-10 -8 L-5 -12 L6 1 L5 6 L-1 5Z",d.coat);
  cut(c,"M-3 -5 L0 -6 L3 -3 L1 0 L-2 -1Z","#cfac70",.9);
  cut(c,"M-8 1 Q-2 4 8 1 L7 7 L2 5 L-2 8 L-4 5 L-9 6Z",d.hem);
  line(c,-4,2,6,2,"#d5b67e",1.2);
  cut(c,"M-7 -13 L-9 -19 L-6 -17 L-3 -22 L0 -19 L5 -21 L6 -17 Q10 -15 9 -9 L11 -6 L6 -3 L-2 -4 L-7 -9Z",hide,1.6);
  cut(c,"M-8 -14 L-10 -19 L-7 -18 L-5 -22 L-1 -20 L2 -23 L6 -20 L8 -17 L2 -17 L-2 -16Z","#504754");
  cut(c,"M-6 -18 Q-11 -20 -10 -26 L-6 -22 L-3 -20Z",horn,1);
  cut(c,"M-3 -13 Q1 -17 7 -14 Q7 -9 2 -8 Q-1 -8 -3 -13Z","#fff0b2",1.15);
  const glance=(tick-(u?.lastStartleTick ?? -100)<14)?1:0;
  oval(c,2.7,-12.3+glance,2.35,2.7,"#e79948"); oval(c,3.2,-12.25+glance,1.25,2.1,INK);
  oval(c,3.8,-13.7,.65,.65,"#fffce9"); line(c,-3.7,-15,5,-13.9,INK,1.7);
  cut(c,"M-5 -9 L-1 -8 L-2 -6 L-5 -7Z","#806c79",0);
  const gape = scoop + chew*.5;
  c.save(); c.translate(0,gape*.5); c.scale(1,1+gape*.16);
  cut(c,"M0 -6 Q4 -4 9 -7 L8 -4 Q4 -1 0 -5Z","#533648",1);
  cut(c,"M1 -4 L1 -7 L3 -5Z",horn,.65); cut(c,"M6 -4 L8 -8 L8 -4Z",horn,.65);
  c.restore();
  c.save(); c.translate(7,-3+scoop);
  c.rotate(-.2 - 1.05*lift + 1.4*swing + .32*scoop);
  limb(c,0,2,7,1,hide,4.2);
  limb(c,5,5,12,-13,"#ae7950",2.6);
  cut(c,"M8 -10 L7 -15 L9 -21 L14 -22 L17 -18 L16 -12 L12 -9Z","#745a50",1.5);
  cut(c,"M8 -14 L4 -17 L8 -17Z M9 -20 L8 -25 L12 -21Z M15 -20 L19 -23 L17 -17Z M16 -14 L21 -14 L16 -11Z",horn,1.1);
  line(c,8.5,-13.5,15,-12,"#ddd2a9",1.7); oval(c,6.2,1.2,2.4,2,hide);
  c.restore();
  if (chew && u?.lastSwallow) {
    c.save(); c.globalAlpha=chew;
    cut(c,"M6 -5 L13 -6 L11 -3 L14 -2 Q9 -1 6 -4Z",ARMIES[u.lastSwallow.team].coat,1); c.restore();
  }
}

export function frostQueen(c: Pens, d: Dye, u: Unit | undefined, tick: number) {
  const sway = Math.sin((tick+(u?.id ?? 0)*17)*.061);
  const cast = Math.max(0,1-(tick-(u?.lastAttackTick ?? -90))/19);
  c.translate(0,-1.8-sway*.7);
  // Train, face-framing curls and dark bodice have separate silhouettes.
  cut(c,"M-5 -8 Q-12 -5 -13 2 Q-15 6 -20 8 Q-17 12 -12 11 L-14 13 Q-6 13 1 8 L8 7 L5 -7Z","#94b1d0",1.25);
  cut(c,"M-9 -2 Q-12 7 -17 9 Q-12 10 -7 5Z","#c2e1eb",0);
  cut(c,"M-4 -7 Q-1 -10 4 -7 L4 -1 Q6 4 13 8 L7 10 L3 8 L0 11 L-5 9 L-11 10 L-6 3Z","#e9f5f9",1.45);
  cut(c,"M-2 -7 L3 -6 L4 -1 L8 7 L3 6 L1 3 L-3 8 L-7 8 L-3 -1Z",d.coat,1);
  cut(c,"M-5 -8 Q0 -12 5 -7 L3 -1 L0 1 L-3 -2Z","#293747",1);
  cut(c,"M-9 -11 Q-13 -17 -8 -23 Q-2 -28 6 -24 Q13 -22 13 -14 L10 -10 Q14 -8 11 -5 L7 -3 L7 -7 L-7 -5 L-12 -6Z","#94b4d4",1.1);
  cut(c,"M-7 -9 L-7 -18 Q-4 -24 3 -23 Q10 -22 10 -16 L9 -10 Q5 -6 1 -6Z","#bb9c91",1.25);
  cut(c,"M-11 -14 Q-12 -22 -4 -24 Q3 -29 8 -23 Q13 -20 11 -14 L7 -11 L7 -16 L3 -20 Q1 -15 -4 -15 Q-8 -14 -7 -9 Q-3 -8 -4 -5 Q-9 -4 -11 -9 L-8 -9Z","#d7ebf6",1.4);
  cut(c,"M-8 -18 Q-7 -23 0 -24 Q-3 -22 -5 -17 L-7 -13Z","#fffdf4",0);
  cut(c,"M7 -22 Q13 -19 12 -13 L9 -9 Q12 -8 10 -5 Q7 -5 7 -8 L7 -12 L9 -16Z","#b1d0e8",1);
  // Two downturned lids and white brows keep the face readable against pale hair.
  cut(c,"M-3 -14 L1.8 -13.6 L1.8 -11.7 Q-.2 -10.8 -2.2 -12Z","#faf4ef",.55);
  cut(c,"M4 -13.7 L8.6 -14.5 L7.8 -12 Q6 -11 4.4 -12Z","#faf4ef",.55);
  oval(c,.25,-12.7,1.05,1.12,"#7187b4"); oval(c,6.3,-12.8,.95,1.05,"#7187b4");
  line(c,-3.6,-15.2,1.4,-14.5,"#fff7e9",1.55); line(c,4.3,-14.7,8.3,-15.7,"#fff7e9",1.4);
  line(c,2,-8.5,4,-8.9,"#755763",.8);
  cut(c,"M-8 -14 Q-12 -8 -6 -7 Q-3 -7 -4 -4 Q-7 -2 -9 -4 Q-7 -4 -7 -5 Q-12 -5 -12 -9Z","#e4f3f6",1);
  cut(c,"M8 -11 Q13 -8 10 -4 Q8 -1 5 -3 Q8 -3 8 -6 Q6 -7 8 -11Z","#d3e8f4",.9);
  cut(c,"M-7 -23 L-10 -28 L-5 -26 L-4 -30 L-1 -26 L2 -32 L4 -26 L8 -28 L7 -23 L1 -22Z","#99dbe6",1);
  cut(c,"M0 -25 L2 -29 L3 -25 L2 -23Z","#fffce8",.6);
  cut(c,"M-9 -9 Q-5 -10 -1 -6 L1 -5 L0 -2 L-3 -3 L-4 -2 L-7 -4 L-10 -3Z M1 -5 Q3 -9 8 -10 Q10 -10 9 -8 L11 -7 L9 -5 L7 -5 L5 -3 L2 -3Z","#fffdf1",.95);
  cut(c,"M-6 -1 Q-4 1 0 2 L3 0 L4 2 L1 4 L-4 3 L-6 2Z","#c1d9eb",.7);
  cut(c,"M-8 6 L-11 9 L-7 9 L-2 5 L-3 8 L2 6 L1 10 L-3 11 L-5 9 L-12 11Z","#f9faf0",.65);
  oval(c,0,-5.9,1.5,1.9,d.hem);
  c.save(); c.translate(6,-2); c.rotate(cast*.42);
  limb(c,0,0,6,-2,"#e7eef7",2.4); limb(c,6,6,8,-15,"#6684a9",1.55);
  cut(c,"M8 -22 L11 -16 L8 -12 L5 -16Z","#98e2f2",1); line(c,8,-20,8,-15,"#fffdf0",1);
  c.restore();
}

export function phoenix(c: Pens, d: Dye, u: Unit | undefined, tick: number) {
  const time=tick+(u?.id ?? 0)*11;
  if (u?.emberUntil !== undefined) {
    const glow=.5+.5*Math.sin(time*.2), near=1-Math.min(1,(u.emberUntil-tick)/UNIT_DEFINITIONS.phoenix.hatchTicks);
    oval(c,0,5,11,3,"#865a49"); line(c,-8,5,6,7,"#4f4441",2); line(c,-5,7,8,3,"#5b423c",2);
    c.translate(0,-near*1.6);
    cut(c,"M-7 2 Q-9 -3 -5 -8 Q-4 -12 0 -15 Q6 -11 8 -5 Q10 2 5 5 Q-4 8 -7 2Z","#8c4545",1.5);
    cut(c,"M-5 2 L0 -2 L-2 -6 L3 -11 L1 -5 L4 -2 L-3 4Z","#ffd26a",.5);
    oval(c,4,-5,1,1,"#ffeaa3");
    for(let i=0;i<3;i++){const phase=(time*.035+i/3)%1; oval(c,-6+i*5+Math.sin(time*.09+i),-7-phase*11,1.2,1.4,"#ffb64e");}
    c.strokeStyle="#ffeab1"; c.lineWidth=1; c.globalAlpha=.5+glow*.4; c.beginPath(); c.arc(0,0,10,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,near)); c.stroke();
    return;
  }
  const beat=Math.sin(time*.108);
  const rake=Math.max(0,1-(tick-(u?.lastAttackTick ?? -80))/12);
  c.translate(0,-4.4-beat*1.6); c.rotate(rake*.15);
  c.save(); c.scale(.86,.9); c.rotate(.45+beat*.22);
  cut(c,"M0 0 Q-8 -9 -11 -23 L-7 -18 L-7 -24 L-3 -17 L0 -20 L4 -6Z","#a6494a",1.3); c.restore();
  cut(c,"M-1 0 Q-11 -5 -18 3 Q-21 7 -25 6 Q-21 12 -12 7 L-16 12 Q-8 12 -2 6 L-4 10 Q3 7 6 1Z","#e97148",1.3);
  cut(c,"M-4 2 Q-13 0 -21 7 Q-14 6 -9 4 L-13 8Z","#ffd275",.6);
  c.save(); c.translate(-2,0); c.rotate(beat*.39);
  cut(c,"M4 2 Q-3 -3 -10 -8 Q-19 -14 -19 -23 L-13 -18 L-14 -25 L-6 -17 L-6 -21 Q2 -16 5 -8 L7 -3Z",d.coat,1.5);
  cut(c,"M-17 -20 L-8 -12 L-11 -19 L-4 -12 L-4 -16 L2 -8 L1 -5 Q-9 -10 -17 -20Z","#ffb04f",.8);
  cut(c,"M-4 -8 Q0 -5 4 -5 L3 0 L0 2 L-2 0Z",d.light,.8); c.restore();
  cut(c,"M-6 2 Q0 -3 3 -6 L5 -12 L7 -14 L6 -18 L10 -16 L14 -18 L12 -14 L15 -14 L12 -10 L12 -7 L16 -5 L12 -3 Q9 4 3 5 L-2 4Z","#ffc668",1.45);
  cut(c,"M3 -9 Q9 -17 15 -14 L12 -10 L8 -7 L4 -6Z","#b24a42",.8);
  cut(c,"M6.5 -10.6 Q9 -13 13 -12 L11 -9 Q8 -8 6.5 -10.6Z","#ffefab",.8);
  oval(c,10.5,-10.4,1.3,1.55,INK);oval(c,10.9,-11,.47,.47,"#fffaf0");
  cut(c,"M5 -12 L8 -15 L14 -15 L12 -13 L8 -12Z","#ffda74",.75);
  cut(c,"M12 -8 L17 -6 L15 -3 L14 -5 L11 -5Z","#ffdf95",.95);
  cut(c,"M1 -5 L6 -6 L5 -3 L8 -4 L5 0 L1 2 L2 -1 L-1 0Z","#ffdf88",.6);
  cut(c,"M-1 2 L6 -3 L6 1 L2 5 L-2 4Z",d.coat,.8);
  line(c,2,4,2+3*rake,7,"#844b38",1.3); line(c,5,3,6+4*rake,6,"#844b38",1.2);
}

export function kirin(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const live = u?.arc && tick-u.arc.tick<19;
  c.translate(0,-1.8-Math.sin((tick+(u?.id ?? 0)*7)*.063));
  for(const side of [-1,1]) {
    limb(c,side*5,1,side*7+p.step*2,8,"#82bbaa",2);
    line(c,side*7+p.step*2,8,side*7+2+p.step*2,8,"#354f55",2.5);
  }
  cut(c,"M-8 0 Q-16 -3 -16 -13 L-19 -16 L-13 -16 L-11 -13 L-13 -19 Q-8 -17 -9 -10 L-4 -5Z",d.light,1.2);
  cut(c,"M-10 -4 Q-5 -9 1 -6 L4 -14 L8 -17 L12 -14 L12 -11 L17 -8 L14 -5 L8 -7 L6 0 Q1 6 -8 3Z","#75ad9f",1.5);
  cut(c,"M-6 -5 L0 -6 L4 -4 L1 2 L-5 3 L-8 0Z",d.coat,1);
  cut(c,"M-3 -4 L0 -3 L-2 0 L-4 -1Z","#e6d59a",.65);
  cut(c,"M4 -16 L1 -19 L2 -14 L-3 -13 L0 -11 L-4 -8 L1 -8 L-2 -4 L5 -6 L8 -13Z","#e6deb1",1.1);
  for(const [x,end] of [[6,0],[9,14]]) {
    limb(c,x,-15,end,-25,"#d4a96c",1.5); limb(c,(x+end)/2,-20,(x+end)/2-3,-24,"#f0d89b",1);
  }
  cut(c,"M2 -16 Q-2 -21 -5 -21 L-4 -17 L-7 -18 L-2 -13Z","#a1d6c2",.8);
  cut(c,"M6 -13.4 Q10 -15.8 13 -12.8 L10 -9.7 L7 -10.5Z","#fff2bc",.85);
  oval(c,10.2,-12.4,1.35,1.55,"#23423e"); oval(c,10.65,-13,.42,.42,"#fff9d6");
  line(c,3,-16,9,-14,"#426776",1.25);
  if(live) {line(c,1,-25,5,-27,"#fff8b1",1.6);line(c,5,-27,8,-24,"#fff8b1",1.6);}
}
