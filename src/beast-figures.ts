import { eventFade, type CharacterPose } from "./character-pose.ts";
import { FACE, INK, cut, eye, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export function medusa(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const gaze = eventFade(tick, u?.lastAttackTick, 21);
  const waking = u?.windup?.kind === "gaze" ? Math.max(0, Math.min(1,(tick-u.windup.since+1)/UNIT_DEFINITIONS.medusa.windup)) : 0;
  const alert = Math.max(waking,gaze);
  const coil = Math.sin((tick + (u?.id ?? 0) * 17) * .075);
  const jade = "#8bb79b", scales = "#669987", hair = "#4f8075", gold = "#e7b65e";
  c.translate(.85 * gaze - .9 * p.hurt, -.45 * p.lift - .6 * p.breath);
  c.save(); c.translate(-4, 3); c.rotate(.1 * coil - .12 * gaze);
  cut(c, "M4.55 -4.65 Q-1.45 -6.1 -4.15 -1.45 Q-8.6 -3 -12.55 -.1 Q-15.6 2.25 -13.55 4.35 Q-10.45 7.1 -4.6 4.8 Q-1.15 5.9 3.85 3.85 Q6.25 1.45 4.55 -4.65Z", scales, 1.35);
  line(c, -9.75, 1.9, -5.6, 1.7, "#a8c8a7", 1.1); c.restore();
  cut(c, "M-5.35 -7.65 Q-1.75 -10.4 3.15 -8.05 Q6.15 -2.25 7.8 4.65 Q3.35 7.8 -.95 6.3 Q-4.65 7.95 -8.05 5.7 Q-5.5 1.15 -5.35 -7.65Z", "#f4e5c0", 1.3);
  cut(c, "M-5.55 -7.75 Q-3.85 -9.65 -1.75 -9.1 Q-.75 -3.5 5.5 .5 L6.45 3.65 Q-1.55 .2 -5.4 -5.35Z", d.coat, .91);
  line(c, -5.65, 1.4, 5.4, .8, gold, 1.48);
  // The snakes uncoil toward the same victim as their keeper's gaze.
  for (let i = 0; i < 4; i++) {
    const x = -8.6 + i * 5.15, h = i === 1 || i === 2 ? -24.5 : -20.8;
    const sway = Math.sin((tick + (u?.id ?? 0) * 11) * .085 + i * 1.8);
    const facing = i < 2 && !u?.windup && gaze < .3 ? -1 : 1;
    const hx = x - (i < 2 ? 2.4 : -1.9) + 2 * alert + sway * 1.25, hy = h - 2 * alert + sway;
    c.beginPath(); c.moveTo(x * .72, -11.5);
    c.bezierCurveTo(x * 1.25 - 4, -17, hx + 2.5, hy + 5, hx, hy);
    c.strokeStyle = INK; c.lineWidth = 3.8; c.stroke(); c.strokeStyle = hair; c.lineWidth = 2.2; c.stroke();
    c.save();c.translate(hx,hy);c.scale(facing,1);
    cut(c,"M-1.45 -.75 Q-.7 -2.45 1.6 -2.05 L3.65 -1.1 L3.45 .2 Q2 .95 .25 .75 L-1.4 1.45Z",jade,.71);
    oval(c, 1.3, -.9, .52, .45, INK);
    if(i===0 || i===3){line(c,3.4,-.2,5.05+alert,-.15,"#b66764",.55);line(c,4.65+alert,-.15,5.55+alert,-1.05,"#b66764",.48);}
    c.restore();
  }
  c.save(); c.translate(.9 * gaze, -.8 * gaze);
  cut(c, "M-7.55 -13.75 Q-8.05 -19.15 -3.4 -21 Q3.05 -23.1 7.25 -18.15 Q9.35 -14.6 7.3 -11.65 Q6.25 -8.45 2.55 -8 Q-3.8 -7.4 -7.05 -10.65Z", jade, 1.22);
  cut(c, "M-7.45 -14.35 Q-8.25 -18.25 -4.75 -20.85 Q-.1 -23.4 4.35 -21.35 Q1.6 -21.05 -.15 -18.3 Q-2.1 -16.15 -5.2 -16.75 Q-3.75 -12.65 -5.8 -9.95 Q-8.65 -8.8 -9.9 -11.3 Q-7.8 -10.7 -7.45 -14.35Z", hair, .9);
  eye(c, -.95, -14.7, 1.95, 1.38 + .55 * gaze - .95 * p.blink, p.lookX, p.lookY);
  eye(c, 4.75, -15, 1.85, 1.33 + .56 * gaze - .95 * p.blink, p.lookX, p.lookY);
  line(c, -3.15, -16.6, .8, -15.9 + gaze * .25, "#506c5c", .92);
  cut(c, "M-5.85 -19.35 Q-.5 -17.05 6.5 -19.4 L7.25 -18.1 Q1.3 -15.75 -5.45 -17.7Z", gold, .65);
  oval(c, 6.9, -10.3, 1.0, 1.32, gold); c.restore();
  limb(c, 2.8, -5.55, 6.6 + 1.5 * gaze, -3.9 - 2 * gaze, jade, 1.95);
  limb(c, 6.6 + 1.5 * gaze, -3.9 - 2 * gaze, 9.45 + 2.8 * gaze, -7.55 - 3.55 * gaze, jade, 1.7);
  line(c, 9.45 + 2.8 * gaze, -7.55 - 3.55 * gaze, 10.2 + 3 * gaze, -9.45 - 4.1 * gaze, INK, .85);
}

export function vampire(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const bite = eventFade(tick, u?.lastAttackTick, 14), savor = eventFade(tick, u?.lastHealTick, 23);
  const sway = Math.sin((tick + (u?.id ?? 0) * 7) * .09);
  const coat = "#494352", skin = "#ddd9cc", wine = "#945666";
  for (const side of [-1,1]) {
    const step = side * p.step * 2.7, x = side * 2.4 + step;
    limb(c, side * 2.5, 1.9, x, 6.95 - Math.max(0,step) * .4, coat, 2);
    line(c, x - 1.3, 7.3 - Math.max(0,step) * .4, x + 1.5, 7.3 - Math.max(0,step) * .4, INK, 2.25);
  }
  c.translate(2.8 * bite - p.hurt, -p.lift - .6 * p.breath); c.rotate(.18 * bite - .09 * p.ready);
  c.save(); c.translate(-3,-7.2); c.rotate(.095 * sway + .27 * bite); c.translate(3,7.2);
  cut(c, "M-5.7 -10.2 Q-8.6 -9.7 -10.1 -1.55 Q-12.2 4.05 -16.75 5.05 Q-15.15 8.15 -12.1 6.85 Q-10.15 5.95 -9.15 7.3 Q-7.85 9.45 -5.6 7.45 Q-2.8 5.35 -.1 5.9 L4.45 -5.85Z", coat, 1.4);
  cut(c, "M-6.25 -6.1 Q-7.65 .55 -11.9 4.75 Q-6.15 3.35 -2.15 -2.65Z", d.hem, .7); c.restore();
  cut(c, "M-4.75 -7.2 Q.2 -9.95 4.85 -6.7 L5.75 4.6 Q2.65 6.5 .5 4 L-1.7 6.4 Q-4.25 5.8 -6.05 4.25Z", d.coat, 1.18);
  cut(c, "M-2.7 -7.5 L3.65 -7.55 L1.6 .77Z", "#f5e5cf", .8);
  cut(c, "M-5.6 -7.55 Q-10.85 -10.45 -12.25 -17.25 Q-5.3 -14.85 -2.7 -10.95 L1.2 -8.7 Q4.45 -12.35 9.1 -14.2 Q7.2 -9.1 4.4 -6.5Z", wine, 1.04);
  c.save(); c.translate(1.8 + 2.3 * bite, -11.65 - p.ready); c.rotate(.16 * bite - .09 * savor);
  cut(c, "M-5.65 -4.75 Q-5.4 -9.75 -.65 -10.1 Q4.8 -10.55 6.1 -6.05 L6.15 -4.05 L8.15 -2.0 L6.3 -1.0 Q5.45 2.7 1.65 3.9 Q-1.7 3.05 -3.6 1 L-5.6 -1.7 L-8.8 -4.8 Q-7.3 -5.4 -5.65 -4.75Z", skin, 1.13);
  cut(c, "M-6.65 -3.7 Q-8.3 -9.7 -4.4 -12.1 Q-1.25 -14.45 2.6 -11.25 Q4.65 -9.2 7.1 -9.65 Q6.4 -7.4 3.65 -7 L1.1 -7.65 L-.3 -4.9 L-2.4 -7 Q-4.55 -6.75 -3.55 -2.5Z", coat, 1.08);
  eye(c, 3.15, -4.45, 1.95, 1.45 - .42 * p.ready - .65 * savor - .9 * p.blink, p.lookX, p.lookY);
  line(c,.65,-6.3,4.85,-6 + .4 * bite,wine,.96);
  cut(c, "M1.75 -.9 Q4.05 .25 6.45 -1.45 Q6.55 1.25 4.25 2.1 Q2.35 2.1 1.75 -.9Z", "#764555", .62);
  cut(c, "M2.65 -.45 L4.35 -.6 L3.6 2.3Z M5.2 -.65 L6.25 -.95 L5.65 .85Z", "#fffae7", .42); c.restore();
  limb(c, -2.5,-4.35,2.1 + 4.75*bite,-2.9-2*bite,coat,2.25);
  limb(c, 2.1+4.75*bite,-2.9-2*bite,4.2+6.1*bite,-5.5-2.8*bite,skin,1.8);
}

export function horseman(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const toss = eventFade(tick, u?.lastAttackTick, 18);
  const released = u?.lastAttackTick == null || tick >= u.lastAttackTick;
  const away = released && (u?.headSpot !== undefined || tick < (u?.headUntil ?? 0));
  const hide = "#73594f", mane = "#514851", rider = "#595364";
  const step = p.step, bob = p.lift * 1.65;
  for (const sign of [-1,1]) {
    const hip=sign*5.4, hoof=hip-1.45-sign*step*3.95;
    limb(c,hip-.7,.5-bob,hoof-1.9,3.65-bob,"#5c4c4e",1.6);
    limb(c,hoof-1.9,3.65-bob,hoof,7.15-Math.max(0,-sign*step)*2.2,"#5c4c4e",1.45);
  }
  for (const sign of [-1, 1]) {
    const hip = sign * 6.2, hoof = hip + sign * step * 4.35;
    limb(c, hip, .65 - bob, hoof - 1.9, 4.2 - bob, hide, 2.05);
    limb(c, hoof - 1.9, 4.2 - bob, hoof + .6, 8.2 - Math.max(0, sign * step) * 2.55, "#655052", 1.8);
  }
  c.translate(0,-bob);
  c.save(); c.translate(-9.2,-2.1); c.rotate(.15 * step + .16 * p.pace);
  cut(c, "M1.45 -.85 Q-1.8 -3.05 -5.45 -1.95 Q-7.8 -.65 -8.15 2.4 Q-9.1 5.25 -12.2 4.7 Q-10.75 7.6 -7.4 6.7 Q-6.3 7.55 -7.15 8.65 Q-3.85 8.75 -3.1 6 Q-3.05 2.9 -.3 2.15Z", mane, 1.08); c.restore();
  cut(c, "M-12.55 -.75 Q-13.55 -5.4 -9.5 -6.65 Q-5.5 -8.1 1.1 -5.8 Q5.75 -4.95 7.15 -9.35 Q8.95 -13.7 10.95 -16.35 Q11.7 -17.3 13.45 -16.65 L16 -18.45 L16.55 -15.5 Q18.45 -15.15 18.25 -12.95 L22.05 -8.3 Q22.45 -6.8 20.55 -5.95 L17.6 -6.1 L13.6 -9.35 Q12.2 -7.45 12.2 -4.2 Q11.15 2.85 7.55 4.15 Q.95 3.65 -4.15 4.45 Q-10.1 5.3 -12.55 -.75Z", hide, 1.4);
  cut(c, "M8.3 -11.05 Q8.45 -16.4 13.05 -17.2 L13.8 -15.35 Q11.4 -12.75 11.75 -10.8 L10.05 -11.4 Q10.6 -7 8.3 -6.1Z", mane, .93);
  eye(c, 15.7, -12.85, 1.52, 1.1 - .52 * p.blink, p.lookX, p.lookY);
  line(c, 18.1,-9.5,20.3,-10.8, "#e5bc84", 1.05);
  cut(c, "M-8.15 -5.8 Q-4.1 -7.35 3.65 -5.45 L4.35 .7 Q1.25 2.7 -2.65 2.75 Q-6.9 2.5 -8.15 -.4Z", d.coat, 1.05);
  line(c,-7.05,.65,-2.9,1.65,d.light,1.06);
  const reinX = 4.1 + 1.3 * toss;
  c.beginPath(); c.moveTo(19.9,-8.75); c.quadraticCurveTo(14,-3.25 + step,reinX,-8.05);
  c.strokeStyle="#615044"; c.lineWidth=.87; c.stroke();
  c.save(); c.translate(-1,-7.2); c.rotate(.11*toss+.04*step); c.translate(1,7.2);
  cut(c, "M-5.35 -16.3 Q-2.2 -17.5 1.65 -15.95 Q2.8 -11.7 4.55 -8.35 L4.1 -5.8 Q-.55 -7 -3.25 -4 Q-5.4 -2.6 -8.8 -2.45 Q-6.35 -5.3 -8.2 -5.1 Q-12.1 -3.2 -15.4 -4.75 Q-9.35 -6.05 -8.35 -11.75Z", rider, 1.2);
  cut(c, "M-6.75 -14.1 Q-8.6 -16.15 -8.45 -18.15 L-2.1 -16.3 L2.8 -18.3 L2.55 -14.6 Q-2.45 -12.6 -6.75 -14.1Z", d.coat, .97);
  if (!away) {
    c.save(); c.translate(-1.25-p.ready*.5,-21.4-p.ready); c.rotate(-.07 + .055 * step);
    cut(c, "M-.7 -4.85 Q-2.4 -6.55 -.6 -8.15 L.8 -7.95 L.4 -5Z", "#758454", .65);
    cut(c, "M-6.2 -.75 Q-6.25 -5.55 -3.4 -5.55 Q-1.8 -6.75 .1 -5.7 Q2 -6.65 3.7 -5.35 Q6.5 -5.7 6.7 -1.85 Q7.4 2.6 4.3 4.15 Q1.85 5.25 .2 4.6 Q-2.05 5.4 -4.45 3.95 Q-6.15 2.5 -6.2 -.75Z", "#d98b4e", 1.12);
    cut(c, "M-3.8 -2.65 L-.75 -1.2 L-3.45 -.15Z M1.75 -1.35 L4.9 -3.05 L4.55 -.35Z", "#654537", .55);
    line(c,-3.05,-1.65,-2.3,-1.25,"#ffe28a",.62); line(c,3.3,-1.2,4.1,-1.7,"#ffe28a",.62);
    cut(c, "M-3.25 1.15 L-.75 1.9 L.15 1.15 L1.25 2.05 L4.5 .75 Q2.05 4.25 -1.05 3.05Z", "#624737", .48); c.restore();
  } else {
    oval(c,-2.4,-15.9,2.8,.97,INK);
    oval(c,-2.25,-16.15,1.45,.48,"#e5b773");
  }
  limb(c, -1.2,-11.3,3 + 2.1 * toss,-9.85 - 2*toss,rider,2.05);
  limb(c, 3 + 2.1 * toss,-9.85 - 2*toss,reinX + 4.7 * toss,-8.35-6*toss,"#967a65",1.65);
  limb(c, -1.15,-6.7,1.85,-4.15,rider,2.45); limb(c,1.85,-4.15,-.55,.65,"#5b4d49",2.1); c.restore();
}

export function werewolf(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const until = u?.wolfUntil ?? 0;
  const feral = !u || (tick < until && tick >= until - UNIT_DEFINITIONS.werewolf.wolfTicks);
  const claw = eventFade(tick, u?.lastAttackTick, 13);
  const fur = "#839299", shade = "#5b6975", muzzle = "#c6bbb0";
  c.translate(feral ? 2.5 * claw : -1.15 * p.hurt, -p.lift - .55 * p.breath);
  if (!feral) {
    for (const sign of [-1,1]) {
      const x = sign * (3 + 2.7 * p.step);
      limb(c,sign*2.5,1.55,x,7.3,shade,2.2); line(c,x-1,7.5,x+1.9,7.5,INK,2.2);
    }
    cut(c, "M-5.4 -9.25 Q-1.35 -12.65 4.15 -9.6 Q4.65 -4.55 6.5 .85 Q8 4.1 10.2 4.6 Q7.25 6.8 3.3 5.5 Q1.15 8.45 -2.8 6.6 Q-6.05 7.65 -9.35 5.15 Q-6.6 .2 -5.4 -9.25Z", d.hem, 1.35);
    cut(c, "M-3.1 -8.05 Q-.45 -10.0 3.6 -8.95 L6 2.45 Q3.75 4.2 .3 4.35 L-2.45 5.8 Q-1.2 .3 -3.1 -8.05Z", d.coat, .82);
    cut(c, "M-7.25 -13.05 L-8.05 -20.35 L-4.2 -17.85 Q-.45 -20.65 3.15 -18.45 L6.75 -20.25 L6.15 -16.8 Q8.1 -14.8 7.6 -12.9 L9.45 -10.2 Q7.3 -7 4.65 -7.6 L1.7 -4.75 Q.1 -6.4 -1.6 -5.05 L-3.5 -7.35 L-7.8 -6.5 Q-6.65 -9.85 -7.25 -13.05Z", fur, 1.2);
    cut(c, "M-.9 -12.25 Q3 -14.45 6.4 -12.5 Q7.05 -8.85 4.15 -7.75 Q1.65 -6.2 -.9 -8.65Z", FACE, .86);
    eye(c,3.75,-10.4,1.55,1.15-.85*p.blink,p.lookX,p.lookY);
    oval(c, 2.25,-4.35,1.23,1.18,"#d4bb7c");
    limb(c,-2.95,-3.9,3.9 + 3.4*claw,-2.2 - 1.6*claw,shade,2); return;
  }
  c.rotate(.13 * p.pace);
  for (const sign of [-1,1]) {
    const foot = sign * 5.1 + sign * p.step * 2.95;
    limb(c,sign*3.6,1.3,foot-2.2,5.55,shade,2.75);
    limb(c,foot-2.2,5.55,foot+1,8.25-Math.max(0,sign*p.step)*2.1,fur,2.08);
  }
  c.save();c.translate(-5.8,-.25);c.rotate(.14*p.step+.19*claw);
  cut(c, "M2.1 -2.2 Q-3.3 -4.2 -6.6 -1.6 Q-11.2 1.2 -15.95 -2.2 Q-15.55 1.45 -12.25 3.9 L-13.5 4.6 Q-8.5 7.45 -4.1 4.75 Q-1.6 3.55 2.15 1.4Z", fur, 1.2);c.restore();
  cut(c, "M-7.8 -1.7 Q-9.25 -7.1 -5.15 -11.1 Q-1.4 -15.2 4.35 -12.5 Q9.4 -10.5 9.35 -5.95 L11.15 -4.95 L8.25 -3.35 Q9.15 -1.05 9.15 1.5 L5.75 .3 Q4.5 4.2 .8 4.65 Q-5.0 5.45 -7.8 -1.7Z", fur, 1.4);
  cut(c, "M-8.35 -8.65 Q-4.85 -12.35 -.15 -12.45 Q.3 -7.5 6.85 -4.4 L5.75 -2.5 Q.5 -3.45 -1.85 -5.75 L-3.05 -3.9 L-5.0 -6.05 L-7.6 -5.05Z", d.coat, .92);
  c.save();c.translate(3.8+2*claw+1.9*p.pace,-12.5+2*p.pace);c.rotate(.13*p.pitch+.15*claw);
  cut(c, "M-6.35 -1.4 L-8.95 -3.95 L-6.1 -4.1 Q-7.5 -7.7 -7.3 -11.2 Q-4.8 -10.05 -2.65 -7.1 Q-.7 -7.9 1.25 -7.5 L4.4 -10.3 L4.55 -6.3 Q6.45 -5.0 6.35 -2.8 L12.0 -1.1 Q13.1 .7 11.3 2 L6.3 3.35 Q3.8 6.65 .25 5.35 L-1.15 6.5 L-3.4 4.05 L-6.6 4.65Z", fur, 1.3);
  cut(c, "M3.75 -.15 Q5.8 -2.05 7.8 -1.75 L11.6 -.8 Q12.1 .8 10.15 1.85 L5.4 3.15 L3.55 2.2Z", muzzle, .7);
  oval(c,11.55,-.65,1.35,.93,INK);
  cut(c, "M6.1 1.75 L7.55 1.9 L6.65 4.1Z", FACE, .52);
  eye(c,2.35,-3.4,1.95,1.4-.55*claw-.9*p.blink,p.lookX,p.lookY);
  line(c,-.25,-5.45,4.6,-4.65+.5*claw,shade,1.13);c.restore();
  const hand=10.2+6.3*claw+1.9*p.step, height=.8-5.3*claw+4.8*p.pace-1.5*Math.max(0,p.step);
  limb(c,2.55,-5.9,hand-4.1,height+.9,shade,3.2);limb(c,hand-4.1,height+.9,hand,height,fur,2.35);
  cut(c, "M-4.8 2.35 L-3.25 3.15 L-4.45 5Z", d.hem, .55);
  for (let i=0;i<3;i++) line(c,hand+i*.65-1.1,height+i*.6-.65,hand+1.65+i*.55,height+i*.65-.95,INK,.72);
}

export function ironGolem(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const punch = eventFade(tick, u?.lastAttackTick, 16), weld = eventFade(tick, u?.lastTreatedTick, 25);
  const battered = u && u.hp < UNIT_DEFINITIONS.irongolem.maxHp * .65;
  const iron = "#81969a", shadow = "#60767c", steel = "#bac0ae", brass = "#d5ae69";
  for (const sign of [-1,1]) {
    const x = sign * 5.55 + sign * p.step * 1.8, knee = sign * 3.8;
    const footY = 6.8 - Math.max(0, sign*p.step)*2.1;
    limb(c, knee, 1, x, footY - 1.25, shadow, 2.8);
    c.save(); c.translate(x, footY);
    cut(c, "M-3.05 -2.6 L.75 -3.05 L2.2 -1.5 L4 .05 L3.55 1.85 L-3.55 1.85 L-3.65 .1Z", iron, 1.05); c.restore();
  }
  c.translate(-1.2 * p.hurt + 1.65 * punch, -.85 * p.lift - .35 * p.breath);
  c.rotate(.038 * p.step + .075 * punch);
  c.save(); c.translate(-8.8, -9.45); c.rotate(.1 * p.step - .24 * punch);
  cut(c, "M-3.85 -2.55 L1.7 -3.35 L3.4 -.95 L2.15 4.7 L-2.95 5.1 L-4.65 3.4Z", shadow, 1.12);
  limb(c,-1.15,3.95,-3.2,9.05,steel,2.55);
  cut(c, "M-6.1 6.85 L-1.35 6.45 L.55 8.45 L-.1 12.75 L-5.65 13.45 L-8.1 11.4 L-7.8 8.55Z", iron, 1.15); c.restore();
  cut(c, "M-6.85 -12.4 L4.85 -13.0 L9.2 -10.05 L8.6 -.15 L5.55 2.95 L3.15 4.5 L-4.8 4.45 L-7.45 1.2 L-9.35 -8.55Z", iron, 1.4);
  cut(c, "M-7.8 -.05 L5.95 -.75 L5.4 2.55 L2.8 4.15 L-4.7 3.8Z", shadow, .67);
  cut(c, "M-7.75 -11.25 L-4.85 -13.75 L5.1 -14.05 L8.65 -11.3 L6.8 -6.55 L-3.45 -3.3 L-7.85 -6.15Z", d.coat, 1.13);
  cut(c, "M-5.85 -11.1 L-3.8 -12.43 L3.2 -12.6 L4.2 -11.55 L-3.7 -10.1Z", d.light, 0);
  oval(c,-5,-7.55,1.15,1.1,brass); oval(c,5.65,-9.25,1.1,1,brass);
  if (u?.spareUsed) {
    cut(c,"M-3.4 -10.65 L.35 -11.3 L2.65 -9.3 L1.55 -6.95 L-1.35 -6.8 L-3.25 -8Z",steel,.8);
    oval(c, -.3,-9.1,.65,.6,brass);
  }
  if (battered || weld > 0) {
    line(c,-1.75,-11.15,.55,-9.15,INK,.91); line(c,.55,-9.15,-.1,-7.45,INK,.9);
    line(c,-.1,-7.45,2.05,-6.9,INK,.89);
  }
  c.save(); c.translate(.85 + .72 * punch, -15.3 + .3 * p.step + .88 * weld);
  cut(c, "M-6.75 -4.7 L-4.8 -7.2 L3.95 -7.2 L6.7 -4.55 L6.75 .55 L4.35 2.95 L-3.6 3.25 L-6.55 .85Z", steel, 1.22);
  cut(c, "M-5.7 -3.75 L4.75 -4.75 L5.75 -2.1 L-3.95 -.85 L-5.7 -1.3Z", "#384b50", .74);
  line(c,-1.55 + .85 * p.lookX,-2.6 + .36 * p.lookY,3.2 + .8*p.lookX,-3.12 + .36*p.lookY,weld>.35?"#bdffdf":"#f3cf7e",1.02);
  line(c,-3.65,-5.6,.55,-6.0,"#e1ded0",.77); c.restore();
  c.save(); c.translate(6.75,-9.15); c.rotate(-.12 * p.step - .47 * punch + .34 * weld);
  cut(c, "M-1.8 -3.3 L2.55 -5.0 L6.55 -3.3 L7.5 .45 L5.4 2.6 L.2 2.25 L-2.35 .45Z", d.hem, 1.13);
  const fistX = 4.1 + 6.8*punch - 4.3*weld, fistY = 7.35 - 5.2*punch - 4.2*weld;
  limb(c,2.8,1.1,fistX,fistY-1,steel,2.75);
  c.translate(fistX,fistY);c.rotate(-.18*punch);
  cut(c, "M-3.45 -2.8 L1.75 -3.55 L4.35 -1.25 L4.3 2.75 L2.45 4.1 L-2.95 4.4 L-4.65 2.6 L-4.85 -.95Z", iron,1.22);
  line(c,-.85,1.8,.05,3.75,shadow,.83);line(c,1.2,1.35,2.05,3.25,shadow,.86);c.restore();
  if(weld > 0) {
    c.save();c.globalAlpha *= weld;
    // The patch draws itself tight around the old dent as the repair arrives.
    c.translate(-.5,-8.7);c.scale(.65+.36*weld,.65+.36*weld);
    cut(c,"M-3.5 -.3 L-1 -.95 L-.15 -3.8 L.85 -1.05 L3.5 -.4 L1.05 .55 L.25 3.3 L-.85 .7Z","#e0fff0",.61);
    line(c,-2.6-2.8*weld,-2.45*weld,-3.65-3.1*weld,-3.5*weld,brass,.91);
    c.restore();
  }
}
