import { ARMIES } from "./battlefield.ts";
import { eventFade, type CharacterPose } from "./character-pose.ts";
import { FACE, INK, cut, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";

export function cyclops(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const lift = u?.windup?.kind === "smash" ? Math.min(1, (tick - u.windup.since + 1) / 18) : 0;
  const scoop = u?.windup?.kind === "swallow" ? Math.min(1, (tick - u.windup.since + 1) / 13) : 0;
  const swing = eventFade(tick, u?.lastSmashTick, 18), flinch = eventFade(tick, u?.lastStartleTick, 24);
  const chew = eventFade(tick, u?.lastSwallow?.tick, 22);
  const hide = "#a79896", shade = "#786d77", hair = "#514956", ivory = "#f6d6a1";
  for (const side of [-1, 1]) {
    const stride = side * p.step, x = side * (5.3 + lift) + stride * 3;
    const floor = 8 - Math.max(0, stride) * 3 - (side > 0 ? flinch * 5.8 : 0);
    limb(c, side * 4, 2, x, floor - 2, shade, 3.8);
    c.save(); c.translate(x, floor);
    cut(c, "M-2.7 -2.8 Q-.6 -4 1 -2.7 Q1.5 -1.5 3.3 -.9 Q4.1 .1 3.6 1 Q1.2 2 -2.9 1.1 Q-3.5 .3 -2.7 -2.8Z", "#665d62", 1.05);
    c.restore();
  }
  c.translate(p.step * 1.3 - 2 * lift + 2.8 * swing - 2.8 * flinch - p.hurt,
    -p.lift * 1.5 - p.breath - lift * 1.6 + 2.8 * swing + scoop - 2 * flinch);
  c.rotate(.08 * p.step - .14 * lift + .16 * swing - .13 * flinch);

  // The far hand stays behind the shoulder and snatches up out of a mouse's way.
  c.save(); c.translate(-7.8, -7.1); c.rotate(.13 * p.step + .52 * flinch);
  cut(c, "M.5 -2.4 C-3.5 -4.7 -5.4 -.5 -5.5 3.4 Q-7.1 6 -6.7 8.1 Q-5.9 10.4 -3.4 9.5 Q-1.7 10 -1.2 8.2 Q-.2 7.5 -.6 5.7 L2.2 .7Z", shade, 1.45);
  c.restore();
  cut(c, "M-10.6 -6.9 C-10.6 -12.6 -5.3 -14.7 -.8 -13.2 C3.1 -13.3 7.1 -11.5 9.2 -8.3 Q12.1 -4.1 10 1 Q8.5 5.6 3.2 6.5 Q-3.3 7.7 -8.1 5 C-11.5 3.1 -12.2 -2.5 -10.6 -6.9Z", hide, 1.65);
  cut(c, "M-10 -8.1 Q-8.4 -11.4 -5.8 -12.1 Q-.6 -5 7.9 -1 L6.6 2.4 Q-2.5 -.6 -10 -8.1Z", d.coat, 1);
  cut(c, "M-7.9 1.4 Q-.4 4.2 8.6 1.1 Q8.6 4.6 7.4 7.1 Q4.9 6.9 3.5 6.2 Q1.7 8 -.7 8.5 L-3.5 6.4 Q-7.8 7.9 -9.2 6.3Z", d.hem, 1.25);
  cut(c, "M-8.5 .65 Q-1.1 3.1 8.6 .45 L8.4 2.45 Q-.9 5.1 -8.75 2.7Z", "#805b43", .75);
  cut(c, "M-.7 1.7 Q.5 1.3 2 1.8 L2.3 4 Q.7 4.6 -.8 4Z", "#e4bb77", .65);

  c.save(); c.translate(.55 * scoop, .5 * swing - .8 * flinch);
  cut(c, "M-7.6 -13.5 C-8.6 -19 -4.5 -21.2 .7 -21.1 Q6.2 -21.1 8.8 -16.6 Q9.9 -14.5 9 -11.9 Q8.5 -10.1 10.2 -8.7 Q11.2 -6.6 8.9 -5.7 Q7 -3 2.7 -3.15 C-2.7 -2.9 -6.2 -6.1 -7.4 -9.6Z", hide, 1.45);
  cut(c, "M-7.7 -11 Q-10.5 -11.2 -10.3 -13.8 Q-10 -16 -7.8 -14.4Z", shade, .95);
  cut(c, "M-8 -15 C-9.1 -19 -6.5 -22 -2.9 -22.2 Q-1.1 -22.4 -.4 -24.2 Q2.6 -23.7 2.6 -21.8 Q6.9 -22.5 8.2 -18.5 Q5.9 -19.7 2.8 -18.8 Q-1 -17.4 -4.3 -18 Q-5.8 -16.1 -8 -15Z", hair, 1.2);
  cut(c, "M-5.9 -18.8 Q-10.2 -19.6 -9.9 -25.9 Q-8.1 -22.3 -3.4 -21.7 Q-3.45 -20 -5.9 -18.8Z", ivory, 1);
  cut(c, "M-3.3 -13.9 Q-.5 -17.2 4.4 -16.4 Q6.4 -16.1 7.6 -14.5 Q6.9 -10.3 2.7 -9.4 Q-1.8 -8.8 -3.3 -13.9Z", "#fff0b5", 1.05);
  const eyeX = 2.65 + .48 * Math.cos(p.pitch), eyeY = -13.05 + .55 * Math.sin(p.pitch) + 1.65 * flinch;
  oval(c, eyeX, eyeY, 2.35, 2.65, "#dd9854"); oval(c, eyeX + .35, eyeY, 1.25, 1.8, INK);
  oval(c, eyeX + .78, eyeY - .9, .52, .49, FACE);
  cut(c, "M-4.7 -15.8 Q-3.3 -18.1 -.4 -17.55 Q3.45 -16.55 7.65 -15.45 Q8.1 -14.6 7.25 -13.85 Q2.55 -14 -1.45 -15.25 Q-3.1 -15.78 -4.7 -15.1Z", hair, .8);
  c.save(); c.translate(0, scoop * .7 + chew * .45); c.scale(1, 1 + scoop * .12);
  cut(c, "M.25 -5.7 Q3.45 -8.35 8.4 -7.55 Q9.05 -6.75 8.25 -5.4 Q5.05 -6.25 2.7 -5.25 Q1.1 -4.55 .25 -5.7Z", "#55424a", .75);
  cut(c, "M6.2 -5.75 Q6.75 -7.3 7.55 -8.25 Q8.25 -7.1 7.6 -5.65Z", ivory, .6);
  c.restore(); c.restore();

  c.save(); c.translate(6.6 + 2 * lift, -3 + scoop - 4.3 * lift);
  c.rotate(-.25 - .84 * lift + 1.72 * swing + .31 * scoop - .42 * flinch - .09 * p.step);
  limb(c, 4.8, 4.5, 11.6, -14, "#a87a4c", 2.35);
  cut(c, "M8.1 -10.2 Q6.7 -12.9 7.9 -17.4 Q8.8 -21.9 12.8 -22.9 Q16.8 -23.3 18 -19.8 Q19.7 -15 14.6 -10.6 L12.2 -8.5Z", "#866651", 1.5);
  cut(c, "M8.3 -14.8 Q5.2 -15.7 3.3 -19.0 Q7.1 -18.6 9.15 -17Z M11.45 -21.05 Q10.9 -24.0 12 -27 Q14.1 -24.5 14.5 -22Z M15.95 -15.75 Q18.75 -16.85 21.1 -16.7 Q19.15 -13.5 16.1 -12.8Z", ivory, 1);
  cut(c, "M9.7 -13.5 Q10.4 -18.55 14.8 -20.6 Q11.6 -17.7 10.95 -13.7Z", "#b58b61", 0);
  cut(c, "M8.1 -12.1 Q11.1 -11.2 14.4 -10.9 L13 -8.95 Q10.1 -9.1 7.9 -10.25Z", "#cec9ae", .7);
  limb(c, -.25, 1.4, 5.1, 1.05, hide, 3.7);
  cut(c, "M3.7 .8 Q3.6 -1.15 5.1 -1.7 Q7.3 -2.5 8.7 -.9 Q9.6 .7 8.15 2.1 Q6.7 3.15 4.8 2.4Z", hide, 1);
  c.restore();
  if (chew && u?.lastSwallow) {
    c.save(); c.globalAlpha = chew;
    cut(c, "M6.8 -5.5 Q9.3 -6.5 12.9 -6.1 L11.3 -3.65 L13.1 -2.7 Q9.7 -2.1 6.8 -4.6Z", ARMIES[u.lastSwallow.team].coat, .9);
    c.restore();
  }
}

export function frostQueen(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const sway = Math.sin((tick + (u?.id ?? 0) * 17) * .061);
  const cast = eventFade(tick, u?.lastAttackTick, 19);
  c.translate(2.4 * cast - p.ready, -1.8 - sway * 1.35 - p.pace);
  c.rotate(.024 * sway + .075 * cast - .055 * p.ready);

  // The heavy train follows the shoulders a little late as the staff rises.
  c.save(); c.translate(-3.4, -6.5); c.rotate(.13 * sway + .19 * p.pace - .14 * cast); c.translate(3.4, 6.5);
  cut(c, "M-4.5 -8.1 C-9.8 -8.1 -10.1 -2.1 -12.5 2.3 C-14.6 6.3 -18 8.1 -20.2 7.7 Q-18.5 11.9 -12.2 11.35 Q-8.9 11.2 -5.1 9.1 Q-1 7 3.3 6.2 L4 -6.8Z", "#98b8cf", 1.3);
  cut(c, "M-7.5 -3.3 Q-10.1 6.8 -16.8 8.8 Q-10.2 9.15 -6 2.7Z", "#d5e9ed", 0);
  c.restore();
  cut(c, "M-4.5 -7.3 Q.5 -9.5 4 -6.6 Q4.6 .4 7.6 3.4 Q10.5 6.8 13.2 7.5 Q11.2 10.9 6.3 9.7 Q3.8 12.1 -.1 10.6 Q-4.4 12.2 -7.3 10.5 Q-10.2 11.4 -12.35 9.3 C-7.7 6.2 -4.3 -.35 -4.5 -7.3Z", "#edf4f3", 1.45);
  cut(c, "M-2.6 -6.7 Q.1 -7.6 2.8 -6.45 Q3.4 -.9 4.9 2.95 L7.2 7.6 Q4.8 7.7 3.2 6.35 Q.7 9.3 -3.3 9.5 Q-.8 4.65 -.6 1.05 Q-2.2 1.9 -3.9 2.05 Q-2.2 -1.9 -2.6 -6.7Z", d.coat, .95);
  cut(c, "M-4.6 -7.3 Q0 -10.8 5.3 -7.1 Q4.1 -3.8 1.3 -2 Q-2.3 -3.1 -4.6 -7.3Z", "#354455", .9);
  cut(c, "M-10.8 -10.6 C-14 -17.2 -9.7 -24.5 -3.1 -25.3 C4.6 -27.4 11 -23 11.8 -17.1 Q13.2 -12.2 10.4 -9.2 Q13.6 -6.9 10.1 -4.7 Q8 -3.4 6.7 -5 Q2.7 -7.9 -2 -6.15 Q-8 -3 -11.35 -6.65 Q-12.9 -8.6 -10.8 -10.6Z", "#a4bfd5", 1.15);
  cut(c, "M-6.7 -14.3 Q-6.2 -22 1.2 -22.8 Q9.6 -22.7 9.8 -15 Q10 -10.3 6.2 -8.1 Q3.65 -6.8 .6 -7 Q-5.65 -7.5 -6.7 -14.3Z", "#bb9d94", 1.05);
  cut(c, "M-10.7 -12.65 C-12.2 -18.8 -8.4 -24.2 -2.8 -24.9 Q3.2 -27.1 6.8 -23.6 Q10.6 -22.3 11.4 -18 Q12.4 -14.3 9.4 -11.6 Q10 -16 6.2 -18.7 Q4.2 -20.1 3.1 -21 Q1.8 -18.1 -1.2 -16.65 C-4.7 -15.2 -7.2 -15.1 -7.4 -12 Q-8 -9.3 -5.4 -8.3 Q-2.6 -7.3 -4.25 -5.15 Q-5.95 -3.5 -8.45 -4.75 Q-5.65 -5.15 -6.4 -6.75 Q-10.9 -7.85 -10.7 -12.65Z", "#dcecf4", 1.3);
  cut(c, "M-8.95 -16.5 Q-7.9 -22.2 -2 -23.3 Q-5.9 -21.15 -7.4 -17.45Z", "#fffdf3", 0);
  cut(c, "M8.8 -17 C10.8 -15.9 11.85 -13.15 10 -10.5 Q8.7 -8.7 9.9 -7.25 Q11.8 -4.7 9.25 -3.7 Q7.6 -3.1 6.55 -4.1 Q8.4 -4.4 7.9 -6.1 Q6.8 -8.7 8.35 -10.9 Q10 -12.85 8.8 -17Z", "#c5dce9", 1);
  cut(c, "M-3.65 -13.9 Q-.9 -13.7 1.8 -13.2 Q1.6 -11.45 -.2 -11.6 Q-2.2 -11.9 -3.65 -13.9Z M4.25 -13.2 Q6.65 -13.8 8.5 -14.1 Q7.9 -11.9 6.3 -11.6 Q4.75 -11.35 4.25 -13.2Z", "#fff9ef", 0);
  oval(c, .35, -12.8, 1, 1.1, "#60779c"); oval(c, 6.2, -12.75, .93, 1.04, "#60779c");
  line(c, -3.4, -13.85, 1.65, -13.2, "#705f6a", .62); line(c, 4.4, -13.18, 8.3, -14, "#705f6a", .62);
  line(c, -3.2, -15.1, 1.55, -14.3, "#fff6e9", 1.1); line(c, 4.5, -14.35, 8.4, -15.35, "#fff6e9", 1.1);
  line(c, 2.5, -8.7, 4.05, -8.9, "#785e60", .7);
  // Three crystal tips stay sharp against the large, soft locks below them.
  cut(c, "M-6 -23.45 Q-7.3 -25.2 -7.8 -28.4 L-3.45 -25.7 Q-1.6 -27.1 .1 -31.4 Q2.05 -28.35 2.65 -25.7 L6.95 -28.3 Q6.6 -25.7 5.75 -23.55 Q.5 -22.5 -6 -23.45Z", "#94d8e3", 1.05);
  cut(c, "M-.95 -25.5 L.15 -28 L1.35 -25.35 L.25 -24.3Z", "#fffcee", 0);
  cut(c, "M-8.75 -9.1 Q-5.8 -10.6 -.25 -6.65 Q4.05 -9.85 8.4 -9.15 Q9.65 -5.6 5.65 -4.25 Q5.2 -2.65 2.7 -3.3 L-.05 -4.75 Q-2.05 -2.5 -4.35 -3.25 Q-5.8 -3.5 -6.3 -4.65 Q-10.5 -5 -8.75 -9.1Z", "#fffaf0", 1.05);
  oval(c, .0, -5.6, 1.45, 1.65, d.hem);
  c.save(); c.translate(6.5 + 2.85 * cast + 3.6 * p.ready, -2.2 - 3.3 * p.ready); c.rotate(.025 - .18 * p.ready + .92 * cast + .045 * sway);
  limb(c, -.4, .3, 6, -2, "#e4edf1", 2.5); limb(c, 6.6, 6.45, 8.7, -15.6, "#7892ae", 1.5);
  cut(c, "M8.9 -22 L11.45 -16.8 L8.4 -12.65 L5.8 -16.45Z", "#9fdce8", 1);
  line(c, 8.85, -20.1, 8.55, -16.1, "#fffcee", .85);
  c.restore();
}

function kirinLeg(c: Pens, x: number, stride: number, front: boolean, far: boolean, rear: number) {
  const kneeX = x + (front ? 1.65 : -2.35) + 2.1 * stride + 5.3 * rear;
  const kneeY = 4.2 - 6.1 * rear;
  const hoofX = x + (front ? 1 : -1) + 4.65 * stride + 1.1 * rear;
  const hoofY = 8.5 - 3.5 * Math.max(0, stride) - 7.0 * rear;
  const hide = far ? "#648d84" : "#98c8ae";
  limb(c, x, .05, kneeX, kneeY, hide, far ? 1.65 : 2.0);
  limb(c, kneeX, kneeY, hoofX, hoofY - .55, hide, 1.42);
  c.save(); c.translate(hoofX, hoofY);
  cut(c, "M-1.3 -1.6 Q.2 -2.1 1.05 -1.35 L2.2 .1 Q.5 .95 -1.8 .45Z", "#435655", .65); c.restore();
}

export function kirin(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const rear = eventFade(tick, u?.arc?.tick, 19);
  const swish = Math.sin((tick + (u?.id ?? 0) * 7) * .082);
  c.translate(0, -1.35 - p.lift * 1.6);
  kirinLeg(c, -7.5, p.step, false, true, 0); kirinLeg(c, -4.5, -p.step, false, false, 0);
  c.translate(-6, 1); c.rotate(-.33 * rear + .075 * p.ready - .04 * p.step); c.translate(6, -1);
  kirinLeg(c, 2, -p.step, true, true, rear * .83); kirinLeg(c, 5.45, p.step, true, false, rear);
  c.save(); c.translate(-7.6, -.65); c.rotate(.20 * swish + .27 * rear);
  cut(c, "M1.6 1.85 C-3.5 3.1 -7.05 -.45 -7.45 -6 C-7.9 -10.4 -9.7 -12.9 -12.7 -12.3 Q-11.6 -15 -8.2 -14.45 Q-6.35 -14 -5.2 -12.5 Q-5.4 -15.5 -7.15 -17.2 Q-2.35 -16.35 -2.3 -10.2 C-2.75 -6.4 -2.9 -3.5 1.7 -1.3Z", d.light, 1.25);
  c.restore();
  cut(c, "M-10.2 -1.1 C-10.75 -5.1 -7.35 -7.55 -3 -7.2 Q.25 -6.95 2.05 -8.75 C4.05 -11.25 3.4 -15.4 6.45 -17.45 Q10.15 -20 13.05 -17.0 Q14.1 -15.7 13.75 -13.35 Q14.15 -11.6 17.25 -10.3 Q18.05 -8.15 15.6 -7.5 Q12.9 -7.9 10.2 -8.85 C7.4 -8.1 8.6 -2.55 5.55 .65 Q2 5.6 -5.6 4.0 Q-9.35 3.45 -10.2 -1.1Z", "#80b4a5", 1.5);
  cut(c, "M-6.85 -6.0 Q-2.75 -6.9 1.25 -6.55 Q2.45 -5.7 3.35 -4.35 Q2.4 -.7 .2 1.85 Q-3.15 2.15 -6.25 -.25 Q-7.65 -3 -6.85 -6Z", d.coat, 1);
  cut(c, "M-5.3 -4.55 Q-2.5 -5.2 .35 -4.55 Q-1 -4.05 -1.8 -2.35Z", "#ead69a", 0);
  c.save(); c.translate(6, -16.5); c.rotate(.055 * swish + .16 * rear); c.translate(-6, 16.5);
  cut(c, "M6.0 -17.65 Q2.3 -18.05 -.4 -21 Q-.75 -17.65 1.65 -15.55 Q-1.75 -15.8 -4.25 -14.1 Q-1.7 -13.35 -.65 -12.2 Q-1.6 -10.15 -5.75 -9.0 Q-3.0 -7.35 .35 -8.75 Q-.75 -6.45 -4.1 -5.65 C.45 -4.6 3.3 -7.65 4.6 -10.15 Q6.5 -13.25 8.1 -15.55Z", "#eee2b7", 1.05);
  c.restore();
  // Two tapered, branching antlers emerge from separate roots above the ears.
  cut(c, "M8.35 -16.6 Q10.75 -19.2 12.45 -22.1 Q13.5 -23.75 14.4 -25.9 Q14.6 -23.65 13.75 -21.8 Q15.95 -22.4 17.5 -24.2 Q16.9 -21.5 13.2 -19.6 L10.25 -16.3Z", "#bd966a", .85);
  cut(c, "M6.3 -16.85 C5.75 -19.95 3.9 -21.0 2.5 -23.25 Q.95 -25.45 1.5 -28.65 Q2.25 -25.8 4.4 -24.1 Q4.15 -26.3 5.35 -28.15 Q5 -25.15 6.2 -23.05 Q8.1 -21.05 8.1 -18.0Z", "#e7c38a", .95);
  cut(c, "M6.15 -16.6 Q2.25 -19.45 -.75 -18.95 Q.25 -15.45 4.85 -14.5Z", "#a5cdb4", .85);
  cut(c, "M7.25 -13.85 Q9.55 -15.5 12.65 -14.0 Q12.25 -11.5 10.1 -10.95 Q8.15 -11.25 7.25 -13.85Z", "#fff0c4", .8);
  oval(c, 10.7, -13.05, 1, 1.35, INK); oval(c, 11.0, -13.55, .35, .38, FACE);
  line(c, 6.9, -15.2, 10.45, -14.6, "#526b68", 1.05);
  oval(c, 16.25, -9.5, .65, .48, INK);
  if (rear > 0) {
    c.save(); c.globalAlpha *= rear;
    cut(c, "M4.6 -26.1 L8.25 -24.15 L9.9 -26.25 L14.05 -24.45 L10.1 -24.55 L8.8 -22.4Z", "#fff1a3", .45);
    c.restore();
  }
}
