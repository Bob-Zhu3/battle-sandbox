import { ARMIES } from "./battlefield.ts";
import { eventFade, type CharacterPose } from "./character-pose.ts";
import { INK, cut, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";

export function cyclops(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const lift = u?.windup?.kind === "smash" ? Math.min(1, (tick-u.windup.since+1)/18) : 0;
  const swing = eventFade(tick,u?.lastSmashTick,18);
  const startle = eventFade(tick,u?.lastStartleTick,24);
  const scoop = u?.windup?.kind === "swallow" ? Math.min(1,(tick-u.windup.since+1)/13) : 0;
  const chew = Math.max(0, 1-(tick-(u?.lastSwallow?.tick ?? -100))/22);
  const hide = "#a69a99", shadow = "#736978", horn = "#f5d7a2";
  for (const sign of [-1,1]) {
    const stride = sign*p.step, foot = sign*(5+lift)+stride*3;
    const floor = 8-Math.max(0,stride)*3-(sign>0 ? startle*6 : 0);
    limb(c,sign*4,2,foot+1,5,shadow,3.2); limb(c,foot+1,5,foot,floor,shadow,2.9);
    line(c,foot-2,floor,foot+2.4,floor,INK,3.2);
  }
  c.translate(p.step*1.4 - 2*lift + 2.9*swing - 2.8*startle - p.hurt,
    -p.lift*1.6 - p.breath - lift*1.5 + 3*swing + scoop - 2*startle);
  c.rotate(.085*p.step - .15*lift + .17*swing - .13*startle);
  // The far fist swings behind the chest and lifts clear when a mouse squeaks.
  const fistY = 2+p.step*2.3-startle*6;
  limb(c,-6,-6,-12-p.step, fistY-1,shadow,4.4);
  oval(c,-12-p.step,fistY,3.5,4,INK); oval(c,-12-p.step,fistY,2.6,3.1,shadow);
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
  const glance=startle*1.9;
  oval(c,2.7,-12.3+glance,2.35,2.7,"#e79948"); oval(c,3.2,-12.25+glance,1.25,2.1,INK);
  oval(c,3.8,-13.7,.65,.65,"#fffce9"); line(c,-3.7,-15,5,-13.9,INK,1.7);
  cut(c,"M-5 -9 L-1 -8 L-2 -6 L-5 -7Z","#806c79",0);
  const gape = scoop + chew*.5;
  c.save(); c.translate(0,gape*.5); c.scale(1,1+gape*.16);
  cut(c,"M0 -6 Q4 -4 9 -7 L8 -4 Q4 -1 0 -5Z","#533648",1);
  cut(c,"M1 -4 L1 -7 L3 -5Z",horn,.65); cut(c,"M6 -4 L8 -8 L8 -4Z",horn,.65);
  c.restore();
  c.save(); c.translate(7,-3+scoop);
  c.rotate(-.2 - 1.05*lift + 1.4*swing + .32*scoop - .40*startle - .10*p.step);
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

export function frostQueen(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const sway = Math.sin((tick+(u?.id ?? 0)*17)*.061);
  const cast = eventFade(tick,u?.lastAttackTick,19);
  c.translate(2.8*cast-p.ready,-1.8-sway*1.35-p.pace);
  c.rotate(.025*sway+.08*cast-.06*p.ready);
  // Train, face-framing curls and dark bodice have separate silhouettes.
  c.save(); c.translate(-4,-6); c.rotate(.135*sway+.22*p.pace-.13*cast); c.translate(4,6);
  cut(c,"M-5 -8 Q-12 -5 -13 2 Q-15 6 -20 8 Q-17 12 -12 11 L-14 13 Q-6 13 1 8 L8 7 L5 -7Z","#94b1d0",1.25);
  cut(c,"M-9 -2 Q-12 7 -17 9 Q-12 10 -7 5Z","#c2e1eb",0);
  c.restore();
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
  // Her wrist lifts the crystal overhead, then sweeps it ahead of her face at release.
  c.save(); c.translate(6+3*cast,-2-2*p.ready); c.rotate(-.12-.62*p.ready+1.03*cast+.055*sway);
  limb(c,0,0,6,-2,"#e7eef7",2.4); limb(c,6,6,8,-15,"#6684a9",1.55);
  cut(c,"M8 -22 L11 -16 L8 -12 L5 -16Z","#98e2f2",1); line(c,8,-20,8,-15,"#fffdf0",1);
  c.restore();
}

export function kirin(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const rear = eventFade(tick,u?.arc?.tick,19);
  const swish = Math.sin((tick+(u?.id ?? 0)*7)*.082);
  c.translate(0,-1.4-p.lift*1.8);
  for (const far of [true,false]) {
    for (const front of [false,true]) {
      const hip = (front ? 5 : -5) - (far ? 2 : 0);
      const step = (front !== far ? 1 : -1)*p.step;
      const reach = front ? rear : 0, hoofX = hip+step*4.7+reach*4;
      const floor = 8-Math.max(0,step)*3.7-reach*7.5;
      const kneeX = hip+(front ? 2 : -2)+step*1.5+reach*4, kneeY = 4-reach*7;
      const shade = far ? "#588c84" : "#95c9b1";
      limb(c,hip,1-reach*4,kneeX,kneeY,shade,1.8);
      limb(c,kneeX,kneeY,hoofX,floor,shade,1.55);
      line(c,hoofX-.6,floor,hoofX+1.5,floor,"#354f55",2.25);
    }
  }
  c.translate(-5,1); c.rotate(-.32*rear+.08*p.ready-.045*p.step); c.translate(5,-1);
  c.save();c.translate(-7,-1);c.rotate(.23*swish+.22*rear);c.translate(7,1);
  cut(c,"M-8 0 Q-16 -3 -16 -13 L-19 -16 L-13 -16 L-11 -13 L-13 -19 Q-8 -17 -9 -10 L-4 -5Z",d.light,1.2);
  c.restore();
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
  if(rear>0) {line(c,1,-25,5,-27,"#fff8b1",1.6);line(c,5,-27,8,-24,"#fff8b1",1.6);}
}
