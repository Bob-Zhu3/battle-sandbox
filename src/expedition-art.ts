import { eventFade, type CharacterPose } from "./character-pose.ts";
import { cut, eye, FACE, INK, IRON, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export type ExpeditionKind = "wrestler" | "liondancers" | "rhinorider" | "trojanhorse" |
  "windmill" | "harpoon" | "prism" | "snowman";

const brass = "#dfaa52", ivory = "#fff0cb", leather = "#936544", oak = "#c59158", grain = "#795640";
const hide = "#99a49d", farHide = "#76847f", snow = "#f5fbf7", ice = "#bad4d5";

function boot(c: Pens, hip: number, knee: number, foot: number, floor: number, color: string) {
  limb(c, hip, 1, knee, 4, color, 2.8);
  limb(c, knee, 4, foot, floor - 1, color, 2.5);
  line(c, foot - 1.5, floor, foot + 2.8, floor, INK, 3);
}

function palm(c: Pens, x: number, y: number, turn: number, dye: Dye) {
  c.save(); c.translate(x, y); c.rotate(turn);
  cut(c, "M-2.2 1 Q-3.45 -.2 -2.4 -1.75 L-1.2 -1.25 L-.9 -3.75 Q-.45 -4.7 .35 -3.55 L.55 -1.85 L1.35 -3.3 Q2 -4.1 2.35 -2.8 L2 -1.1 L3.1 -2 Q4 -2.35 3.7 -.95 L2.25 1.75 Q.6 3.45 -1.45 2.6Z", FACE, .95);
  line(c, -1.9, 2.2, .65, 3, dye.light, 1.1);
  c.restore();
}

function wrestler(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const release = eventFade(tick, u?.lastAttackTick, 17);
  const stumble = u?.knockback ? release : 0;
  const throwPose = release * (1 - stumble);
  const grasp = .85 * p.ready * (1 - release);
  boot(c, -4.4, -6.2 - p.step, -6.3 - 3 * p.step, 8.4 - 1.6 * Math.max(0, p.step), d.hem);
  boot(c, 4.3, 6.8 + p.step, 6.2 + 3 * p.step, 8.6 - 1.6 * Math.max(0, -p.step), d.coat);
  c.translate(2 * grasp - 1.6 * throwPose - p.hurt - 2.3 * stumble, 2 * grasp - 2.3 * throwPose - p.lift - .6 * p.breath);
  c.rotate(.1 * grasp - .21 * throwPose - .3 * stumble);
  const farX = 5.4 + 6 * grasp - 8.5 * throwPose, farY = -.7 - 11.7 * throwPose;
  limb(c, -5.2, -5.3, -7.4, -1.2, FACE, 3.8);
  limb(c, -7.4, -1.2, farX, farY, FACE, 3.2);
  palm(c, farX, farY, .6 - throwPose, d);
  cut(c, "M-9 -5.2 C-8.5 -10.5 -2.9 -9.6 .3 -8.2 Q5 -10.6 8.1 -7.8 Q10.55 -5.45 8.15 -2.35 L5.5 4 Q.1 7.1 -6.8 4.25 Q-7.05 1.1 -8.4 -.8Z", FACE, 1.3);
  cut(c, "M-8 -6.9 L-5.8 -7.9 Q-5.2 -2 1.2 .6 Q5.2 -.15 7.2 -3.2 L6.3 1.45 L5.7 4.3 Q-.25 7.35 -6.9 4.25 L-7.6 .5Z", d.coat, 1.05);
  cut(c, "M-6.8 1.55 Q-.7 4.2 6.6 1.1 L5.95 3.7 Q-.55 6.4 -6.7 3.95Z", d.hem, .65);
  cut(c, "M-1 2.3 L2.55 2 L3.3 4.25 L.75 5.4 L-1.5 4.25Z", brass, .7);
  c.save(); c.translate(.65 * grasp, -.8 * throwPose); c.rotate(.07 * p.pitch);
  cut(c, "M-4.8 -11.4 Q-5.4 -16.55 -.05 -18.15 Q5.15 -19.4 7.15 -15.3 L7.75 -12.85 L9.5 -11.1 Q9.7 -9.85 7.9 -9.35 Q7.3 -5.2 3 -5.6 Q-3.35 -5.65 -4.8 -11.4Z", d.coat, 1.2);
  cut(c, "M.4 -17.65 L3.3 -18 L4.7 -14.6 L7.5 -15.1 L7.55 -12.45 Q5.1 -13.2 3.8 -11.65 L1.7 -13.6 L-1.3 -11.8Z", d.light, .7);
  eye(c, 4.8, -12.25, 2.1, 1.43 - .55 * grasp - 1.18 * p.blink + .5 * stumble, p.lookX, p.lookY);
  cut(c, "M1.5 -8.7 Q3.9 -7.4 6.75 -9.15 Q6.15 -6.5 4.05 -6.4 Q2.2 -6.5 1.5 -8.7Z", FACE, .7);
  c.restore();
  const elbowX = 5.5 + 4 * grasp + 4 * throwPose, elbowY = 1 - 9 * throwPose;
  const handX = 8.7 + 4.3 * grasp + 1.5 * throwPose, handY = -4.8 + 3 * grasp - 15.5 * throwPose;
  limb(c, 4.8, -5.2, elbowX, elbowY, FACE, 4.1);
  limb(c, elbowX, elbowY, handX, handY, FACE, 3.5);
  line(c, handX - .8, handY + 2, handX + 1.8, handY + 1, d.coat, 2);
  palm(c, handX, handY, .45 + grasp * .8 - throwPose, d);
}

function dancerFeet(c: Pens, hip: number, beat: number, kick: number, color: string) {
  const heel = hip - 2.5 - 2 * beat - 9 * kick;
  limb(c, hip - 1, 0, heel, 6 - 8 * kick, color, 2.2);
  line(c, heel - 2 - kick, 7 - 8 * kick, heel + 1.5, 7.4 - 7 * kick, INK, 2.5);
  line(c, heel - 1.7 - kick, 7 - 8 * kick, heel - .3, 7.25 - 7.3 * kick, ivory, .8);
  const toe = hip + 2.45 + 2.6 * beat;
  limb(c, hip + 1.5, .25, toe, 6.2 - Math.max(0, beat) * 2, color, 2.5);
  line(c, toe - .8, 7.6 - Math.max(0, beat) * 2, toe + 3.2, 7 - Math.max(0, beat) * 2, INK, 2.7);
  line(c, toe + 1.45, 7.25 - Math.max(0, beat) * 2, toe + 3.15, 7 - Math.max(0, beat) * 2, ivory, .85);
}

function lionDancers(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const kick = eventFade(tick, u?.lastKickTick, 16);
  const bite = eventFade(tick, u?.lastAttackTick, 15);
  const sway = Math.sin((tick + (u?.id ?? 0) * 17) * .072);
  dancerFeet(c, -7.3, -p.step, kick, d.light);
  dancerFeet(c, 5, p.step, 0, d.coat);
  c.translate(0, -.8 * p.lift - .32 * p.breath);
  c.save(); c.translate(-10, -3.3); c.rotate(.18 * sway - .6 * kick);
  cut(c, "M2.2 1.3 Q-5.2 2.1 -8.8 -3.4 Q-5.4 -2.4 -6.6 -6.5 Q-2.65 -5.5 -2.25 -2.75 Q-.4 -5 2.35 -4.3Z", brass, 1.15);
  c.restore();
  cut(c, "M-12.3 -.95 Q-14.3 -7.5 -9.8 -10.25 Q-7.3 -12.1 -5.2 -10.8 Q-2.8 -13.4 .3 -12.1 Q4.2 -13.5 8.25 -9.3 L8.55 2 Q6.75 4.35 4.7 2.5 Q2.2 5.3 -.2 3.1 Q-3 5.6 -5.25 3.5 Q-8.1 5.15 -9.65 2.55 Q-11.8 3.1 -12.3 -.95Z", d.coat, 1.3);
  cut(c, "M-12.7 -.3 Q-9.9 .6 -9.1 -.65 Q-6.7 1.9 -4.5 -.25 Q-2.45 1.55 -.4 -.65 Q1.5 1.3 4.1 -1.15 L6.8 .3 L7.4 1.95 Q5 4.5 3.45 2.7 Q1.15 4.95 -.6 3.25 Q-3.55 5.65 -5.45 3.5 Q-8.6 5.1 -9.75 2.4 Q-12.15 2.5 -12.7 -.3Z", brass, .75);
  cut(c, "M-9.85 -8.4 Q-7.3 -10.5 -4.8 -7.8 Q-2.3 -11.9 1.15 -9.05 Q-1.6 -8.25 -2.85 -5.65 Q-5.15 -7.5 -7.8 -5.9Z", d.light, .65);
  // The front dancer lifts the head by its handle; a face and sleeve briefly
  // show beneath the jaw. The back dancer's trousers move in counterstep.
  cut(c, "M5.2 2.5 Q5 -1.6 7 -2.45 L8.45 -3.4 L10 -2.4 L8.75 .2 L7.8 2.5Z", d.hem, .8);
  oval(c, 7.6, -2.6, 1.95, 2.1, INK); oval(c, 8, -2.4, 1.45, 1.55, FACE);
  line(c, 6.25, -3.5, 8.7, -3.4, d.light, .85);
  limb(c, 8.4, -.65, 10.25, -4.55, FACE, 1.15);
  c.save(); c.translate(1.7 * bite, -1.7 * kick - 1.7 * p.ready - 1.65 * bite); c.rotate(-.09 * kick + .075 * p.step);
  c.save(); c.translate(5.4, -7.5); c.rotate(.13 + .53 * p.ready - .31 * bite);
  cut(c, "M-.6 -.65 Q5.65 -.15 12.85 -1.9 Q13.25 1 9.8 2.1 Q8.1 4.1 6.65 2.75 Q4.75 4.25 3.65 2.75 Q1.15 2.65 -.6 -.65Z", ivory, 1.1);
  cut(c, "M1.2 -.55 Q6.4 -1.3 12.3 -1.8 L12.25 -.55 Q6.3 1.35 2.5 .6Z", "#a94b45", .55);
  c.restore();
  oval(c, 11.25, -16.65, 3.65, 3.85, INK); oval(c, 11.4, -16.75, 2.95, 3.05, ivory);
  oval(c, 12.45, -16.9, 1.45, 1.65, INK);
  cut(c, "M.8 -8.2 Q-1.4 -12.2 1.15 -15.15 Q-.65 -18.05 2.8 -18.3 Q3 -21.35 6.6 -19.05 Q10 -21.25 11.8 -17.5 Q15.2 -18.05 15.3 -13.35 Q19.15 -13.25 18.75 -10.1 Q18.3 -7.65 15.4 -7.35 Q11.6 -5.8 8.8 -7.25 Q6 -5.2 4.25 -6.7 L2.5 -4.6Z", brass, 1.25);
  cut(c, "M1.7 -15.25 Q-.15 -16.85 -3.75 -16 Q-2.65 -18.35 .15 -18.75 Q-.1 -21.25 2.65 -21.75 Q4.95 -21.4 5.05 -19.1Z", d.coat, 1);
  oval(c, 9.25, -13.1, 4.45, 4.4, INK);
  eye(c, 9.25, -13.05, 3.85, 3.65 - .7 * bite - 2.65 * p.blink, p.lookX, p.lookY);
  cut(c, "M4.35 -15 Q4.65 -19.55 8.35 -19.5 Q11.85 -19.6 13.65 -16.7 Q10.25 -18.2 8.55 -16.55 Q6.2 -17.35 4.35 -15Z", d.coat, .95);
  cut(c, "M10.45 -9.3 Q11.75 -12.05 14.75 -10.7 Q17.55 -12.1 19.3 -10.95 Q19.7 -9.25 17.35 -8.3 Q15.05 -7.85 13.75 -8.65 Q12.2 -7.7 10.45 -9.3Z", ivory, .8);
  oval(c, 16.1, -10.85, 2.25, 1.45, d.hem);
  cut(c, "M4.05 -10.45 Q3.05 -6.45 4.2 -4.2 L5.3 -5.85 L6.1 -2.95 L7 -6.55 L8.35 -5.3 L8.25 -8.3Z", ivory, .75);
  oval(c, 5.25, -19.1, 1.9, 1.75, INK);
  oval(c, 5.25, -19.1, 1.3, 1.15, "#bde3dd");
  c.restore();
}

function rhinoLeg(c: Pens, hip: number, stride: number, color: string) {
  const foot = hip + stride * 3, floor = 8.5 - Math.max(0, -stride) * 2.7;
  limb(c, hip, 0, foot - .8, floor - 1.9, color, 3.7);
  line(c, foot - 1.9, floor, foot + 2.25, floor, INK, 2.5);
}

function rhinoRider(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const rush = Math.min(1, (u?.runUp ?? 0) / UNIT_DEFINITIONS.rhinorider.runUp);
  const jab = eventFade(tick, u?.lastAttackTick, 16);
  const tuck = Math.max(rush, p.ready * .67);
  rhinoLeg(c, -8.2, -p.step, farHide); rhinoLeg(c, 7.4, p.step, farHide);
  c.translate(1.2 * jab, -p.lift * 1.6 - .35 * p.breath);
  c.save(); c.translate(-11, -3); c.rotate(.14 * p.step + .4 * tuck);
  line(c, 0, 0, -5.3, 2.1, INK, 1.3); oval(c, -5.45, 2.25, 1.55, 1.15, farHide); c.restore();
  cut(c, "M-13.65 -2.35 C-14.2 -8.25 -9.5 -11.1 -5.25 -10.7 Q-1.5 -12.3 3.1 -10.45 Q8.25 -13.05 11 -8.5 L12 .2 Q9.4 4.8 3.6 4.9 Q-.3 6.6 -4.75 4.5 Q-11.95 5.75 -13.65 -2.35Z", hide, 1.3);
  rhinoLeg(c, -8.75, p.step, hide); rhinoLeg(c, 4.9, -p.step, hide);
  cut(c, "M-8.9 -9.1 Q-5.4 -10.8 -1.6 -10.25 L.3 -4.1 L-2 .25 Q-6.65 .85 -9.35 -1.95Z", d.coat, 1);
  cut(c, "M-8.4 -2.55 Q-4.35 -.45 -1 -.95 L-2 .35 Q-6.35 1 -8.95 -1Z", d.light, .6);
  c.save(); c.translate(7.9, -5.75); c.rotate(.2 * tuck - .4 * jab + .065 * p.pitch);
  cut(c, "M-2.95 -2.2 Q-5.95 -7.35 -3.5 -10.8 Q-.75 -10.1 .1 -6.6 Q2.2 -8.1 4.65 -6.95 Q8 -6.2 8.45 -3.25 Q12.55 -3.9 13.15 -.85 Q14 2.9 10.3 3.8 Q5.4 5.1 1.65 2.65 Q-2.5 2.3 -2.95 -2.2Z", hide, 1.2);
  cut(c, "M7.7 -3.15 Q9.2 -7.15 9.05 -9.65 Q11.35 -7.1 11.05 -3.25Z", "#e6d8b6", .8);
  cut(c, "M10.35 -2.55 Q16.1 -6.25 18.1 -11.3 Q18.75 -4.15 13.35 -.95Z", ivory, 1.1);
  eye(c, 4.25, -3.1, 1.8, 1.44 - .55 * tuck - 1.22 * p.blink, p.lookX, p.lookY);
  oval(c, 11.7, 1.15, .85, .65, INK); c.restore();
  c.save(); c.translate(-3.8, -9.9); c.rotate(.28 * tuck + .07 * p.step - .16 * jab);
  cut(c, "M-4.1 -.1 Q-4.2 -4.85 -.9 -6.1 Q2.65 -7.25 4.35 -3.75 L5.25 .9 L2.1 2.65Z", d.hem, .95);
  limb(c, 1.4, .8, 4.7, 3.65, leather, 2.15); line(c, 4.65, 3.65, 6.65, 3.65, INK, 1.9);
  oval(c, .8, -8.25, 3, 3.2, INK); oval(c, 1.25, -8.15, 2.55, 2.75, FACE);
  cut(c, "M-2.8 -8.85 Q-3.15 -12.55 .15 -12.8 Q3.45 -13.6 4.25 -10.1 L5.35 -9.5 Q2.35 -9.4 .75 -9.95 Q-1 -8.4 -2.8 -8.85Z", d.coat, .9);
  oval(c, 2.75, -8, .75, .8, INK);
  cut(c, "M-2 -6.85 Q-5.45 -6.1 -8.7 -9.15 Q-7.55 -5 -5.75 -4.4 L-2 -5.1Z", d.light, .7);
  limb(c, 2.15, -3.15, 6.1 + 1.75 * tuck, -2.15, FACE, 1.5);
  c.restore();
  c.strokeStyle = leather; c.lineWidth = .95; c.beginPath();
  c.moveTo(3 + tuck, -11.9); c.quadraticCurveTo(8.6, -5.2 + 1.3 * p.step, 18.5, -5.4 + 2.1 * tuck - 3.7 * jab); c.stroke();
}

function wheel(c: Pens, x: number, y: number, radius: number, spin: number, trim: string) {
  c.save(); c.translate(x, y); c.rotate(spin);
  oval(c, 0, 0, radius, radius, INK); oval(c, 0, 0, radius - .95, radius - .95, oak);
  for (let i = 0; i < 3; i++) {
    line(c, -radius + 1.2, 0, radius - 1.2, 0, grain, .73);
    c.rotate(Math.PI / 3);
  }
  oval(c, 0, 0, 1.05, 1.05, trim); c.restore();
}

function trojanHorse(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const distance = u?.walkDistance ?? 0;
  const age = u?.openedTick == null ? -1 : tick - u.openedTick;
  const open = age < 0 ? 0 : Math.min(1, (age + 1) / 12);
  wheel(c, -8.4, 5.9, 4, distance / 5, d.light); wheel(c, 7.7, 5.9, 4, distance / 5, d.light);
  const ram = eventFade(tick, u?.lastAttackTick, 17);
  c.translate(1.9 * ram, -.5 * p.lift - .85 * Math.sin(open * Math.PI));
  c.rotate(.1 * ram);
  cut(c, "M-13.8 1.45 Q-7.25 .8 -2.2 1.45 L13.7 1.1 L13 4.6 L-13.3 4.75Z", grain, 1.2);
  limb(c, -8.55, -3.6, -9.3, 2.65, oak, 2.65); limb(c, 5.7, -3.6, 7.05, 2.55, oak, 2.65);
  c.save(); c.translate(-10.2, -8.15); c.rotate(p.step * .085);
  cut(c, "M1.5 -1.8 Q-3.55 -3.9 -7.45 .65 L-6.5 -.2 L-8.1 3.8 Q-3.25 2.7 -2.15 0 L.8 1.3Z", grain, 1);
  c.restore();
  cut(c, "M-12.25 -8.2 L-9.75 -13.25 Q-3 -13.65 2 -12.5 L5.15 -18.2 L7.85 -19.7 L9.45 -15.9 L7.65 -6.2 L5.65 -1.4 Q-1 1.65 -9.45 -1.25Z", oak, 1.4);
  cut(c, "M3.8 -12.35 L7 -22.15 L9.85 -22.7 L10.2 -26.2 L12.4 -23.3 L14.7 -23.9 L14.9 -21.15 L18.45 -17.3 Q19.8 -15.9 17.6 -14.5 L13.25 -15.35 L9.2 -7.05Z", oak, 1.25);
  cut(c, "M3.95 -12.3 L3.65 -16.5 L5.2 -16.95 L5.05 -19.55 L6.45 -19.4 L6.65 -22.15 L9.1 -23.2 L8.85 -18Z", d.coat, .9);
  line(c, 12.2, -18.35, 17.1, -16.05, grain, .75);
  oval(c, 12.7, -20.05, 1.1, .95, INK); oval(c, 12.92, -20.35, .32, .28, ivory);
  line(c, -9.25, -11.85, 2, -10.85, grain, .75);
  cut(c, "M-7.45 -9.75 L2.45 -9.25 L1.15 -.9 L-6.8 -1.15Z", INK, 1);
  if (open < .55) {
    oval(c, -4.7, -7.95, .8, .62, ivory); oval(c, -2.4, -7.85, .8, .62, ivory);
  }
  c.save(); c.translate(-3, -.9); c.scale(1, 1 - 1.65 * open);
  cut(c, "M-3.75 -.25 L4.15 -.2 L5.1 -5.65 L-3.85 -5.9Z", oak, .85);
  line(c, -3.2, -4.95, 3.3, -1.05, grain, .85);
  line(c, -2.4, -1.05, 3.15, -4.85, grain, .75); c.restore();
  cut(c, "M-9.3 -13 L-5.75 -13.3 L-6.05 -9.75 L-7.55 -8.6 L-9.25 -10.1Z", d.coat, .7);
  oval(c, -10, -5.8, .95, .82, brass); oval(c, 5.2, -6.1, .95, .82, brass);
}

function masonry(c: Pens, d: Dye) {
  cut(c, "M-10.9 4.65 L-8.95 2.65 L7.7 2.7 L10.4 4.15 L10 7.85 Q2.4 9.3 -8.25 8.45 L-11 7.15Z", "#a3aaa0", 1.2);
  line(c, -9.25, 5.1, 7.9, 5.15, "#d9dcc7", .85);
  cut(c, "M-2.3 4.75 L2 4.7 L1.65 7.45 L-.35 8.35 L-2.25 7.3Z", d.coat, .65);
}

function windmill(c: Pens, d: Dye, u: Unit | undefined, tick: number) {
  masonry(c, d);
  cut(c, "M-7.65 3.85 L-5.4 -10.3 Q-.9 -12.75 4.65 -10.15 L8 3.65 Q.45 5.45 -7.65 3.85Z", "#dac6a0", 1.2);
  cut(c, "M-7.7 -8.5 L-5.4 -12 L-.5 -16.5 L5.5 -12.55 L8.6 -8.35 Q1.2 -7 -7.7 -8.5Z", d.coat, 1.15);
  cut(c, "M-4.4 3.75 L-4.15 1 Q-3.7 -1.9 -1.45 -1 Q-.1 -.7 -.25 1.2 L-.25 4Z", grain, .75);
  const fire = u?.lastAttackTick ?? -Infinity, block = u?.lastBlockTick ?? -Infinity;
  const age = tick - Math.max(fire <= tick ? fire : -Infinity, block <= tick ? block : -Infinity);
  const whipping = age >= 0 && age < 22 ? 1 - (1 - age / 22) ** 3 : 1;
  const duration = UNIT_DEFINITIONS.windmill.spinTicks;
  const gust = u?.millFastUntil === undefined ? 0 : Math.max(0, Math.min(1, (tick - u.millFastUntil + duration) / duration));
  const turn = .37 + (u ? tick * .036 + u.id * .46 : 0) + (whipping - 1) * Math.PI + 4 * Math.PI * gust;
  c.save(); c.translate(.3, -9.2); c.rotate(turn);
  for (let sail = 0; sail < 4; sail++) {
    limb(c, 0, 0, 0, -13.35, oak, 1.15);
    cut(c, "M.15 -5.1 L3.65 -6.15 L4.75 -13.5 L.15 -13Z", ivory, .9);
    cut(c, "M.4 -11.55 L4.45 -12.15 L4.75 -13.5 L.15 -13Z", d.coat, .4);
    line(c, .4, -8.7, 3.8, -9.45, oak, .65);
    c.rotate(Math.PI / 2);
  }
  c.restore();
  oval(c, .3, -9.2, 2.55, 2.55, INK); oval(c, .3, -9.2, 1.7, 1.7, brass);
}

function harpoon(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const recoil = eventFade(tick, u?.lastAttackTick, 16);
  const age = tick - (u?.lastAttackTick ?? -Infinity);
  const winding = age >= 0 && age < 36 ? age / 36 : 1;
  masonry(c, d);
  cut(c, "M-9.3 3.35 L-4.05 -7.65 Q-2.2 -10.15 .05 -8.65 L4.8 3.35 L1.65 3.95 L-2.25 -2.85 L-5.85 3.4Z", oak, 1.15);
  c.save(); c.translate(-1.3, -7.4); c.rotate(-.16 + .65 * p.pitch - .12 * recoil);
  c.translate(-3.5 * recoil, 0);
  cut(c, "M-6.1 -2.75 L9.6 -3.05 L13.4 -1.85 L13 .2 L-1.75 1.2 L-4.1 2.65 L-7.1 1.25Z", "#7a897f", 1.2);
  line(c, -4.5, -.7, 10.6, -1.05, "#d0d9c9", 1);
  cut(c, "M6.35 -3.45 L8.55 -3.5 L8.7 .75 L6.4 .8Z", d.coat, .65);
  if (age < 0 || age >= 19) {
    line(c, -5.9, -3.6, 15.45, -4, INK, 1.45);
    cut(c, "M11.25 -4.25 L16.1 -4.9 L14.7 -8.05 L21 -4.7 Q16.6 -2.95 14.35 -.6 L15.35 -3.25 L11.25 -3.3Z", IRON, .85);
  }
  c.restore();
  c.save(); c.translate(-3.5, -.15); c.rotate(winding * 2 * Math.PI);
  oval(c, 0, 0, 4.9, 4.85, INK); oval(c, 0, 0, 3.95, 3.9, "#cba675");
  c.strokeStyle = grain; c.lineWidth = .8; c.beginPath();
  c.arc(0, 0, 2.95, .3, 5.85); c.moveTo(1.8, .4); c.arc(0, 0, 1.8, .2, 4.4); c.stroke();
  limb(c, .1, .15, 3, 1.35, d.hem, .95); oval(c, 3.2, 1.5, .85, .85, brass); c.restore();
  cut(c, "M4.6 .5 L8.45 .2 L8.1 3.3 L6.65 4.2 L4.85 3.15Z", d.coat, .75);
}

function prism(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const discharge = eventFade(tick, u?.lastAttackTick, 19);
  const breath = u ? Math.sin((tick + u.id * 13) * .063) : 0;
  masonry(c, d);
  cut(c, "M-7.9 3.35 L-5.1 -1.05 L-.45 -3.5 L4.5 -1.35 L7.8 3.3 Q.5 5.3 -7.9 3.35Z", brass, 1.15);
  c.save(); c.translate(0, -.55 * breath - 1.8 * discharge);
  for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1); c.translate(4.25, -4.2); c.rotate(.23 * p.ready + .48 * discharge);
    cut(c, "M.25 2.95 Q3.9 -.5 4.75 -4.85 Q4.8 -7.55 4.3 -9.55 Q7.1 -7.85 7.2 -4.15 Q6.45 .75 2.95 3.85Z", oak, .95);
    cut(c, "M4.5 -4.65 L5.6 -10.25 L7.1 -6.9 L6.65 -4.1Z", side > 0 ? "#db8c9e" : "#8abfaf", .75);
    c.restore();
  }
  c.save(); c.translate(0, -11.65); c.rotate(.055 * breath + .09 * p.pitch - .1 * discharge);
  cut(c, "M-.75 -9.35 L8.3 2.65 L.75 7.2 L-7.85 2.2Z", "#ace2de", 1.4);
  cut(c, "M-.75 -9.35 L.15 1.2 L-7.85 2.2Z", "#d9f6ea", .65);
  cut(c, "M-.75 -9.35 L8.3 2.65 L.15 1.2Z", "#89abc8", .65);
  cut(c, "M.15 1.2 L8.3 2.65 L.75 7.2Z", "#bb9fca", .65);
  line(c, -3.5, -2.5, -1.55, -5.95, "#fff9de", 1.25);
  if (discharge > 0) {
    c.save(); c.globalAlpha *= discharge;
    cut(c, "M.1 -3.25 L.8 -.45 L3.2 .65 L.85 1.1 L.25 3.05 L-.6 1.25 L-2.9 .55 L-.65 -.35Z", "#fffce4", 0);
    c.restore();
  }
  c.restore(); c.restore();
  limb(c, -1.3, -3.2, -.4, -5.1, brass, 1.5);
}

function snowOrb(c: Pens, x: number, y: number, w: number, h: number) {
  oval(c, x, y, w + 1.05, h + 1.05, INK);
  oval(c, x, y, w, h, ice);
  oval(c, x - w * .12, y - h * .17, w * .85, h * .78, snow);
}

function snowman(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const stock = Math.max(0, Math.min(3, u?.snowStock ?? 3));
  const amount = stock / 3;
  const throwPose = eventFade(tick, u?.lastAttackTick, 17);
  const beat = u ? Math.sin((tick + u.id * 7) * .092) : 0;
  const scoop = (1 - amount) * (.55 + .45 * beat) * (1 - throwPose);
  const bottomH = 3.2 + 3.6 * amount, bottomW = 4.8 + 3.65 * amount;
  const middleY = 6 - 1.65 * bottomH, headY = middleY - 7.65;
  snowOrb(c, -.6, 7.4 - bottomH, bottomW, bottomH);
  c.save(); c.translate(0, middleY); c.rotate(-.15 * throwPose + .11 * scoop);
  limb(c, -4.2, -.45, -7.75, -1.15 + 1.6 * scoop, grain, 1.2);
  limb(c, -7.75, -1.15 + 1.6 * scoop, -10.2, -4.95 + 5.4 * scoop, grain, 1.05);
  line(c, -8.7, -2.7 + 3.2 * scoop, -10.85, -3 + 3.6 * scoop, grain, .85);
  snowOrb(c, -.15, 0, 5.05 + .85 * amount, 4.4 + .45 * amount);
  oval(c, 2.55, -.5, .84, .84, INK); oval(c, 2.1, 1.8, .74, .74, INK);
  c.restore();
  c.save(); c.translate(.4 - throwPose, headY + scoop); c.rotate(-.19 * throwPose + .14 * scoop + .09 * p.pitch);
  snowOrb(c, 0, 0, 5.35, 5.15);
  eye(c, 2.15, -1.05, 1.65, 1.32 - .55 * p.ready - 1.15 * p.blink, p.lookX, p.lookY);
  cut(c, "M3.35 -.25 Q4.25 -1.1 5.55 -.3 L10.2 .95 Q7.25 2 3.75 1.7Z", "#ee9753", .75);
  oval(c, .8, 2.1, .52, .5, INK); oval(c, 2.35, 2.6, .48, .45, INK);
  c.save(); c.translate(-.3, -4.05); c.rotate(-.13 - .22 * throwPose);
  cut(c, "M-4.3 -.65 L-4.55 -6.7 Q-.25 -7.9 3.7 -6.9 L3.55 -.7 L6.15 -.15 L6.05 1.2 Q0 2 -6.4 .9 L-6.1 -.3Z", "#49595b", .95);
  cut(c, "M-4.35 -2.8 Q-.6 -2.05 3.6 -2.9 L3.55 -1.15 Q.25 -.35 -4.25 -1.1Z", d.light, .5); c.restore();
  cut(c, "M-4.95 3.45 Q-.6 5.7 4.8 3.45 L5.2 5.3 Q-.6 7.8 -5.6 5.4Z", d.coat, .8);
  c.save(); c.translate(-4.25, 4.65); c.rotate(.12 * beat - .27 * throwPose);
  cut(c, "M0 -.65 Q-4.1 -.15 -6.4 2.75 L-4.85 2.4 L-5.95 4.2 Q-2.65 4.15 .8 .9Z", d.hem, .7); c.restore();
  c.restore();
  const wristX = 7.1 + 5.8 * throwPose - 2.1 * p.ready;
  const wristY = middleY - 2.2 - 5.1 * throwPose - 4.7 * p.ready + 5.6 * scoop;
  limb(c, 3.85, middleY + .35, 6.8, middleY + 1.05 + 2.75 * scoop, grain, 1.25);
  limb(c, 6.8, middleY + 1.05 + 2.75 * scoop, wristX, wristY, grain, 1.15);
  line(c, wristX, wristY, wristX + 1.9, wristY - 1.05, grain, 1);
  if (stock && throwPose < .44) snowOrb(c, wristX + 1.1, wristY - 1.45, 2.1, 2);
  if (!stock && scoop > .5) {
    oval(c, wristX + 1, 7.05, 2.7, 1.15, ice);
    oval(c, wristX + .75, 6.65, 2.15, .9, snow);
  }
}

export function drawExpedition(c: Pens, d: Dye, p: CharacterPose, kind: ExpeditionKind, u: Unit | undefined, tick: number) {
  c.save();
  switch (kind) {
    case "wrestler": wrestler(c, d, p, u, tick); break;
    case "liondancers": lionDancers(c, d, p, u, tick); break;
    case "rhinorider": rhinoRider(c, d, p, u, tick); break;
    case "trojanhorse": trojanHorse(c, d, p, u, tick); break;
    case "windmill": windmill(c, d, u, tick); break;
    case "harpoon": harpoon(c, d, p, u, tick); break;
    case "prism": prism(c, d, p, u, tick); break;
    case "snowman": snowman(c, d, p, u, tick); break;
  }
  c.restore();
}
