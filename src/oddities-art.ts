import { FACE, INK, IRON, WOOD, cut, eye, limb, line, oval, type Pens, type Dye } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { eventFade, type CharacterPose } from "./character-pose.ts";
import { ARMIES } from "./battlefield.ts";

const bone = "#f8eacb", plum = "#6c426e", brass = "#d6a452";

function shoes(c: Pens, p: CharacterPose, color: string, wide = 1) {
  for (const side of [-1, 1]) {
    const x = side * 3.8, step = x + side * p.step * 2.6;
    limb(c, x, 1, step, 6, color, 2.4);
    oval(c, step + 1, 7, 3.1 * wide, 1.9, INK);
  }
}
function star(c: Pens, x: number, y: number, size: number, color: string) {
  c.save(); c.translate(x, y); c.scale(size, size);
  cut(c, "M0 -3.4 Q.7 -1 3.1 0 Q.8 .65 0 3.25 Q-.75 .65 -3.2 0 Q-.7 -.8 0 -3.4Z", color, .7);
  c.restore();
}

export function minerArt(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const strike = eventFade(tick, u?.lastAttackTick, 18), rise = eventFade(tick, u?.emergedTick, 12);
  c.translate(-p.hurt * 1.5, 4 * rise - p.lift);
  shoes(c, p, "#815f45");
  cut(c, "M-7.7 -3.5 Q-7.4 -7.2 -.8 -7.4 Q4.9 -7.5 6.2 -3.6 L7 3.1 Q6.2 6 -1.1 6 Q-6.6 6.1 -7.5 3.8Z", d.coat);
  cut(c, "M-4.4 -6.25 L-2.75 -6.55 L-1.45 -2.05 Q.6 -1.1 2.8 -2 L3.7 -5.85 L5.35 -5.1 L4.75 3.7 Q1.4 5 -4.6 4.1Z", "#67716c", 1);
  line(c, -4, 2.7, 4.75, 2.4, brass, 1.1);
  cut(c, "M-5.4 -10.1 Q-5.85 -16.15 1.1 -16 Q6.45 -16.05 7 -11.75 L8.55 -9.1 Q8.25 -7.75 6.8 -7.6 Q5.85 -4.6 1.75 -4.3 Q-3.8 -4.15 -5.4 -10.1Z", FACE, 1.15);
  cut(c, "M-4.9 -8.3 Q-2.45 -6.35 -.65 -6.8 Q1.25 -8.1 3.05 -6.85 Q4.8 -7.75 6.75 -7.3 Q6.55 -3.55 2.8 -2.45 Q-.6 -1.7 -3.15 -4 Q-5.3 -4.7 -4.9 -8.3Z", "#805d43", .9);
  eye(c, 3.7, -9.65, 2.1, 1.43 + .43 * rise - .4 * strike - 1.35 * p.blink, p.lookX, p.lookY * (1 - rise) - .65 * rise);
  cut(c, "M-7.75 -11.4 C-7.9 -16.4 -4.45 -19.25 .7 -19.3 Q7 -19.1 8.05 -13.9 Q10.4 -13.65 10.8 -12.55 Q9.45 -11.25 5.7 -11.6 Q-.1 -11.85 -5.8 -9.95 Q-7.8 -9.6 -7.75 -11.4Z", "#dfaf62", 1.35);
  cut(c, "M-7.15 -12.55 Q-1.05 -14.65 6.85 -14.35 L7.45 -12.8 Q.15 -12.9 -6.9 -10.9Z", d.hem, .7);
  oval(c, 4.65, -15.8, 3, 2.85, INK); oval(c, 4.65, -15.8, 2.1, 1.95, "#ffe893"); oval(c, 5.05, -16.35, .72, .65, "#fff8da");
  c.save(); c.translate(7.5 + 1.5 * strike, -.4 - p.ready * 2); c.rotate(.19 - .72 * p.ready + strike * 1.3 + p.step * .07);
  limb(c, -2, 4, 3.8, -11, WOOD, 1.9);
  cut(c, "M-4.5 -8.3 C-3.65 -12.25 .2 -15.2 4.2 -15.1 Q9.2 -14.9 11.7 -9.65 Q7.5 -12.55 4.6 -11.8 Q.2 -12 -4.5 -8.3Z", IRON, 1.05);
  limb(c, -3, 1, .35, -.25, FACE, 1.75); c.restore();
}

export function poisonBottle(c: Pens, x: number, y: number, size: number, turn = -.16) {
  c.save(); c.translate(x,y); c.scale(size,size); c.rotate(turn);
  cut(c,"M-1.8 -5.2 L2 -5.2 L2 -2.5 Q6.4 .2 4.8 4 Q4 6.2 .2 6.1 Q-4.8 6 -5.1 3.1 Q-5.7 .3 -1.8 -2.5Z","#c1e1ce",1.15);
  cut(c,"M-4.4 1 Q-1 2.5 1.5 1.3 Q3.5 .5 4.5 1.7 Q5.1 5.1 .5 5.3 Q-4.1 5.6 -4.4 2.8Z","#975997",0);
  cut(c,"M-2.3 -7 L2.3 -7 L1.9 -4.8 L-2 -4.8Z","#bd8854",.8);
  line(c,-3.3,.3,-2.1,-1.2,"#fffdf0",1.15); c.restore();
}

export function clownArt(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const beat = tick * .095 + (u?.id ?? 0), toss = eventFade(tick, u?.lastAttackTick, 18);
  const catchX = -10.5 + 3 * Math.cos(beat), hop = Math.abs(Math.sin(beat));
  shoes(c, p, "#704a62", 1.35); c.translate(2.3 * toss - p.ready, -p.lift - p.breath * .45);
  c.rotate(.035 * Math.sin(beat) - .16 * p.ready + .17 * toss);
  cut(c, "M-5.9 -4.65 Q0 -8.1 5.8 -4.4 Q8.65 -.2 7 4.4 Q6.2 6.3 2.95 5.4 Q.75 4.3 -.45 3.8 Q-2.1 6.7 -5.15 5.8 Q-8.25 4.7 -7.7 1.3Z", d.coat);
  cut(c, "M-7.7 -6.4 Q-3.7 -8.7 .1 -6.85 Q4 -8.4 7.6 -6.35 Q7.15 -3.65 4.3 -3.6 Q3.85 -1.1 .9 -2.4 L-.7 -3.25 Q-3.8 -.8 -5.05 -3.5 Q-7.9 -3.2 -7.7 -6.4Z", bone, .95);
  oval(c, .1, -.05, 1.25, 1.25, "#f8cd71"); oval(c, .9, 3, .86, .86, "#f8cd71");
  cut(c, "M-4 -12.5 Q-5.7 -15.15 -7.55 -13.3 Q-10.2 -13 -9.2 -10.45 Q-10.05 -7.8 -7.15 -7.55 Q-4.95 -6.45 -3.6 -9Z M4.4 -13 Q7.2 -15.05 8.6 -12.9 Q10.5 -12.6 9.45 -10.55 Q10.2 -8.15 7.75 -8Z", "#77ada3", 1);
  cut(c, "M-5.4 -11.7 Q-5.65 -16.55 .9 -16.4 Q7.3 -16.4 7.3 -11.5 Q7.1 -7.5 3.2 -5.9 Q.45 -4.8 -2.7 -6.55 Q-5.4 -8.05 -5.4 -11.7Z", "#fff3dd", 1.15);
  c.save(); c.translate(0, -13); c.rotate(-.07 * Math.sin(beat - .3) - .13 * toss);
  cut(c, "M-6.8 .35 Q-6.4 -3.8 -8.7 -6.15 Q-10.3 -7.6 -11.3 -5.1 Q-11.95 -9.4 -8.25 -9.65 Q-4.25 -9.85 -1.2 -4.2 Q.2 -10 4.05 -9.2 Q7.2 -8.5 6.46 -4.7 Q4.55 -7.35 3.6 -5.35 Q2.9 -3.25 6.0 .05 Q.1 -1.2 -6.8 .35Z", d.hem, 1.1);
  oval(c, -11.4, -4.9, 1.45, 1.4, brass); oval(c, 6.65, -4.4, 1.3, 1.25, brass); c.restore();
  cut(c, "M-.8 -12.1 Q.25 -13 .8 -14.35 Q1.8 -13.1 2.15 -11.8 Q.7 -11.25 -.8 -12.1Z", plum, 0);
  const juggling = u?.targetId === null && toss === 0;
  eye(c, 3.3, -11.8, 1.86, 1.3 + .4 * toss - 1.2 * p.blink,
    juggling ? -.95 : p.lookX, juggling ? .65 - 1.5 * hop : p.lookY * (1 - toss) - toss);
  oval(c, 6.85, -10, 2.28, 2.05, INK); oval(c, 6.95, -10.2, 1.7, 1.49, "#d75b51");
  c.beginPath(); c.moveTo(-1.15 - .8 * toss, -8.9 - .7 * toss);
  c.quadraticCurveTo(1.2, -6.65 + toss, 4.7, -8.35 - .75 * toss);
  c.strokeStyle = "#98495a"; c.lineWidth = 1.23; c.stroke();
  limb(c, -4, -2, catchX, -2 - 2 * hop, FACE, 1.7);
  const handX = 9 - 8 * p.ready + 4 * toss, handY = -4 - 6 * p.ready - 4 * toss;
  limb(c, 4, -2, handX, handY, FACE, 1.8);
  poisonBottle(c, catchX, -7 - 8 * hop, .63, hop*.8-.3);
  if (toss < .45) poisonBottle(c, handX + 1.7, handY - 3, .69);
}

export function reaperArt(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const beat = tick * .08 + (u?.id ?? 0), swing = eventFade(tick, u?.lastAttackTick, 17);
  const soul = eventFade(tick, u?.soul?.tick, 34);
  c.translate(3.3 * swing - 1.5 * p.ready, -2 - Math.sin(beat) * 1.75);
  c.rotate(.1 * p.pace - .13 * p.ready + .13 * swing);
  c.save(); c.translate(-3, -6); c.rotate(.13 * Math.sin(beat - .6) + .20 * p.pace - .13 * swing); c.translate(3, 6);
  cut(c, "M-7.35 -11 C-11 -8.6 -10.2 -.5 -14.75 4.7 Q-16.1 6 -17.2 6.2 Q-15.3 9 -10.35 6.6 Q-9.55 8.65 -11.3 10.5 Q-5.6 10.2 -2.55 6.8 Q1.65 9.4 6.6 6.3 Q10 3.45 7.3 -2.65 L4.1 -9Z", "#494657", 1.4);
  cut(c, "M-5.8 -7 C-7.4 -3.15 -8.7 3.05 -12.45 5.45 Q-7.5 4.15 -5.3 1.25 Q-4.9 2.85 -5.6 4.35 Q-2.2 1.75 -.8 -4.45Z", "#615d72", 0);
  c.restore();
  cut(c, "M-4.8 -6.65 Q.35 -4.4 4 -7.15 Q4.4 -2.7 7.2 3.9 Q5.3 6.5 1.45 5.95 Q-.1 8.3 -2.85 8.35 Q-4.85 6.7 -4.35 4.6 Q-6.25 5.9 -8.05 5.55 Q-5.25 .8 -4.8 -6.65Z", d.hem, 1.1);
  c.save(); c.translate(-1.6 * soul, -6 + .8 * soul); c.rotate(-.27 * soul); c.translate(0, 6);
  cut(c, "M-9.5 -10.2 C-10 -17.05 -5.9 -22.15 -.2 -23.4 Q4.3 -24.1 5.6 -21.6 Q3.7 -21.65 3.7 -20.1 Q7.75 -17.7 8.7 -12.45 Q9.6 -8.1 6.05 -5.35 Q1.9 -2.75 -2.85 -4.9 Q-8.95 -5.55 -9.5 -10.2Z", "#60586e", 1.5);
  cut(c, "M-5.6 -10.15 Q-5.5 -16.45 .7 -19.65 Q5.5 -17.8 6.8 -13.6 Q7.45 -10.45 5.45 -7.7 Q1.15 -5.6 -3.15 -7.3 Q-5.4 -8.2 -5.6 -10.15Z", INK, 0);
  cut(c, "M-3.55 -12.25 C-3.6 -16.4 3.25 -17.35 5.35 -14.05 Q6.55 -11.9 4.4 -10.2 L3.65 -8.55 Q.8 -7.8 -.75 -9.1 L-1.25 -10.1 Q-3.6 -10.45 -3.55 -12.25Z", bone, .55);
  cut(c, "M-2.6 -13.2 Q-1.25 -13.45 .65 -12 Q.15 -10.6 -1.2 -10.65 Q-2.8 -10.85 -2.6 -13.2Z M1.95 -12.25 Q3.2 -13.3 4.7 -13.9 Q5.25 -12.2 3.95 -11.4 Q2.65 -10.65 1.95 -12.25Z", INK, 0);
  cut(c, "M.65 -10.65 L1.4 -11.45 L1.9 -10.37Z", INK, 0);
  if (soul > .1) {
    oval(c, -1.48, -11.83, .93 * soul, .81 * soul, "#acffdb");
    oval(c, 3.15, -12, .82 * soul, .72 * soul, "#acffdb");
  }
  c.restore();
  cut(c, "M-5.15 -5.7 Q-.2 -4.8 4.4 -6 Q3.7 -4.4 .55 -3.7 Q-3.55 -3.8 -5.15 -5.7Z", d.light, .55);

  c.save(); c.translate(-6.5 - 1.8 * soul, -1.2 * soul); c.rotate(.25 * Math.sin(beat - .5) + .43 * swing - .28 * soul);
  limb(c, -.2, -4, -2.7, -1.7, bone, 1.35);
  c.strokeStyle = brass; c.lineWidth = 1; c.beginPath(); c.arc(-3, .85, 1.65, Math.PI, 2 * Math.PI); c.stroke();
  cut(c, "M-6.3 1.8 Q-3.45 -.25 .15 1.45 L-.4 5.85 Q-1.25 8.1 -3.2 8.4 Q-5.35 7.6 -5.8 5.85Z", "#75988f", .95);
  oval(c, -3, 4.65, 1.3 + .45 * soul, 1.85 + .2 * soul, "#aef0cc");
  line(c, -5.9, 2.05, -.3, 1.9, brass, .9); c.restore();

  // The blade hooks forward of the skull. It clears the face on the backswing.
  c.save(); c.translate(9.2 + 1.8 * swing, -.85 - p.ready * 1.8); c.rotate(.055 - .45 * p.ready + 1.32 * swing + p.pitch * .16);
  limb(c, -1.35, 8.9, 3.95, -18.8, "#987b57", 1.65);
  cut(c, "M2.55 -17.3 Q3.05 -21.4 5.2 -22.2 C11.5 -24.9 19.5 -21.6 20.35 -14.6 C16 -19.35 10.5 -19.75 6 -17 Q4.75 -15.9 4.15 -14.7Z", "#bcd5cb", 1.15);
  cut(c, "M6.35 -21.35 C11 -23.2 16 -21.55 18.25 -18.3 Q12.9 -21.9 6.1 -19.95Z", "#eff5df", 0);
  limb(c, -4, .4, 1.5, -2.35, bone, 1.6); c.restore();
}

export function witchArt(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const cast = eventFade(tick, u?.lastAttackTick, 24);
  c.translate(1.7 * cast - p.ready, -p.lift * .85 - p.breath * .6); c.rotate(-.065 * p.ready + .09 * cast);
  shoes(c, p, "#58465c");
  cut(c, "M-4.45 -8.3 Q.35 -9.05 3.55 -6.65 Q4 -1.5 7.45 4.95 Q5.45 7.4 1.8 6.65 Q-.75 8.65 -3.3 7 Q-6.25 8.6 -10.9 6.45 Q-7 3.7 -6.05 .4Z", d.hem, 1.25);
  cut(c, "M-2.85 -6.7 Q.3 -7.5 3 -6.65 Q3.55 -1 5.6 3.45 Q3.6 5.1 .7 5.25 Q1.55 2.2 .6 .7 Q-1.55 3.5 -5.1 3.55 Q-2.6 -1.9 -2.85 -6.7Z", d.coat, .8);
  cut(c, "M-6.7 -11.6 Q-7.1 -17.7 .6 -17.35 Q6.45 -17.05 6.6 -12.1 Q6.9 -10.55 8.9 -10.2 Q8.65 -8.55 6.35 -8.65 Q5.2 -5.75 1 -5.45 Q-4.4 -5.65 -6.7 -11.6Z", FACE, 1.15);
  cut(c, "M-7.7 -13.45 Q-4.75 -15.45 -.45 -13.65 Q-2.75 -12.45 -2.55 -9.85 Q-2.5 -7.8 -.75 -7.8 Q-2.1 -5.45 -4.15 -6.6 Q-6 -7.2 -5.55 -9.6 Q-7.7 -7.8 -7.2 -6.35 Q-9.95 -8.95 -7.7 -13.45Z", "#ab80ad", .95);
  eye(c, 3.25, -10.9, 2.18, 1.37 - .48 * p.ready + .37 * cast - 1.3 * p.blink, p.lookX, p.lookY);
  line(c, 1.05, -12.45 - .68 * p.ready, 5.1, -12.85 + .63 * p.ready - .75 * cast, INK, .97);
  c.beginPath(); c.moveTo(.95, -7.8 - .7 * cast); c.quadraticCurveTo(2.5, -7.25 + .53 * cast, 4.8, -7.9 - .5 * cast);
  c.strokeStyle = "#825366"; c.lineWidth = .93; c.stroke();
  c.save(); c.translate(0, -13); c.rotate(.06 * p.step - .14 * cast + .06 * p.ready);
  cut(c, "M-13.3 -.65 Q-9.65 -.75 -6.25 -3.25 C-5.3 -7.15 -4.55 -11.5 -8.5 -12.45 Q-6.9 -15.3 -3.15 -14.65 Q.2 -14.05 1.35 -10.35 Q2.8 -5.75 6.05 -3.3 Q10.1 -3.25 13.15 -1.65 Q11.7 1.25 4.5 .85 Q-2.75 .05 -8.2 1.25 Q-12 1.55 -13.3 -.65Z", "#584c62", 1.4);
  cut(c, "M-5.2 -5.2 Q-.95 -6.15 3.45 -5.15 L5.3 -3.55 Q.05 -4.1 -5.65 -3.15Z", d.coat, .7);
  cut(c, "M-.95 -5.6 Q.45 -6 1.9 -5.65 L2.5 -3.35 L-.55 -3.15Z", "#ecc271", .58);
  line(c, .1, -4.8, 1.35, -4.9, plum, .6); c.restore();
  c.save(); c.translate(4.2, -3.2); c.rotate(-.3 * p.ready + .28 * cast);
  cut(c, "M-1.6 -2.15 Q1.75 -2.45 4.45 -.85 L4.2 2.45 Q.1 2.8 -1.9 .9Z", d.coat, .9);
  limb(c, 3.7, .05, 6.25, -.8 - 2.6 * cast, FACE, 1.55);
  c.translate(6.25, -2 - 2.6 * cast); c.rotate(.16 - .65 * p.ready + .95 * cast);
  limb(c, -.6, 3.55, 4, -8.5, WOOD, 1.18); star(c, 4.1, -9.45, 1, "#efb2d8"); c.restore();
}

export function pigArt(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const buck = eventFade(tick, u?.lastAttackTick, 11);
  const startle = eventFade(tick, u?.hex?.since, 16);
  c.translate(2 * buck, -p.lift * 1.6 - 2 * startle); c.rotate(-.07 + .17 * buck - .13 * startle);
  for (const side of [-1, 1]) limb(c, side * 5, 2, side * (5 + p.step * 2.8), 6.5, "#9f655e", 1.75);
  c.beginPath(); c.moveTo(-7.8, .1); c.bezierCurveTo(-14.3, .05, -14.2, -7.25, -10.65, -5.6); c.bezierCurveTo(-8.25, -4.15, -10.8, -2.4, -12, -3.8);
  c.strokeStyle = INK; c.lineWidth = 1.25; c.stroke();
  cut(c, "M-9.55 -.9 C-9.5 -6.8 -3.4 -9.0 1.95 -7.85 Q8 -9.15 10.15 -4.35 Q12.1 1.9 6.25 4.25 Q2.55 5.7 -.85 5 Q-8.4 6 -9.55 -.9Z", "#edaa99", 1.35);
  c.save(); c.translate(4, -6.7); c.rotate(-.82 * buck + .36 * startle); c.translate(-4, 6.7);
  cut(c, "M1.75 -7 Q.35 -11.6 2.25 -12.9 Q5.65 -11.85 6.45 -7.15 Q5.3 -5.8 4 -5.9Z", "#df948c", .95); c.restore();
  cut(c, "M-5.6 -6.9 Q-3.85 -8.05 -1.25 -7.85 Q-1.1 -4.75 .55 -3.35 Q-.7 -.95 -2.75 -.55 L-4.65 -3.9 L-6.55 -2.05Z", d.coat, .9);
  eye(c, 6.75, -4.4, 1.95, 1.45 + .65 * startle - .63 * buck - 1.35 * p.blink,
    p.lookX * (1 - startle) - .8 * startle, p.lookY);
  cut(c, "M8.25 -2.7 Q9.8 -4.4 12.15 -3.75 Q14.35 -3.15 14.15 -.7 Q13.9 1.9 11 2.25 Q8.5 2.2 8.05 .25Z", "#da8b83", .95);
  oval(c, 10.75, -.65, .55, .85, INK); oval(c, 12.75, -1.05, .5, .8, INK);
}

export function oldHeadgear(c: Pens, u: NonNullable<Unit["zombified"]>) {
  const dye = ARMIES[u.team];
  if (u.kind === "clown") { oval(c, 7, -8.5, 1.8, 1.5, "#d85753"); oval(c, -7, -12, 2.2, 2.2, "#68a295"); return; }
  if (u.kind === "medic" || u.kind === "archer" || u.kind === "scout" || u.kind === "musketeer") {
    cut(c, "M-8.2 -13 Q-7.45 -17.9 -.55 -18 Q3.8 -18.3 6 -14.9 Q7.6 -14.8 8.5 -13.6 Q5.45 -12.5 1.65 -13.7 Q-3.25 -14.9 -8.2 -13Z", dye.hem, .95);
    cut(c, "M-3.25 -15.3 Q-9.7 -22.6 -12.2 -18.7 Q-9.25 -18.9 -8.4 -16.85 Q-6.05 -15.05 -3.25 -15.3Z", "#e5bb7b", .7);
  } else {
    cut(c, "M-7.5 -12.8 Q-7.75 -18 0 -18.35 Q4.45 -18.55 6.35 -15.3 Q8 -14.8 8.4 -13.6 Q6.35 -12.8 3.25 -13.6 Q-2.05 -15 -7.5 -12.8Z", IRON, 1);
    line(c, -7.1, -12.65, -2, -14, dye.hem, 1.25);
    if (u.kind === "miner" || u.kind === "engineer") oval(c, 4, -16, 1.7, 1.6, "#ffe58b");
    if (u.kind === "lancer") cut(c, "M.7 -17.4 Q-3 -22.15 -8.75 -20.2 Q-6.7 -17.9 -3.1 -18Z", dye.light, .8);
  }
}
