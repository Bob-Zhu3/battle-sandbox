import { eventFade, type CharacterPose } from "./character-pose.ts";
import { FACE, INK, cut, eye, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import { horseman, ironGolem, medusa, vampire, werewolf } from "./beast-figures.ts";
import type { Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

export type BeastKind = "hydra" | "medusa" | "vampire" | "sandworm" | "slime" | "horseman" |
  "werewolf" | "cerberus" | "kraken" | "firedragon" | "irongolem";

// Draw the outside and then the inside of the same curved neck or tentacle.
function tube(c: Pens, color: string, width: number) {
  c.strokeStyle = INK; c.lineWidth = width + 1.8; c.stroke();
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}

const hydraHeads = [
  [[8,-15]], [[-4,-22],[12,-12]], [[-10,-14],[2,-25],[13,-11]], [[-12,-13],[-4,-25],[8,-21],[15,-9]],
] as const;

function hydra(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const bite = eventFade(tick, u?.lastAttackTick, 13);
  const heads = hydraHeads[Math.max(1, Math.min(4, u?.heads ?? 2)) - 1];
  const phase = (tick + (u?.id ?? 0) * 13) * .065;
  const sage = "#78aa88", deep = "#528575";
  c.translate(0, -.7 * p.lift - .4 * p.breath);
  // The foremost neck is shortest. The others wind clear of its silhouette.
  for (let i = 0; i < heads.length; i++) {
    const [x, y] = heads[i], near = i === heads.length - 1;
    const wave = Math.sin(phase + i * 1.9);
    const jaw = bite * (near ? 1 : .55);
    const hx = x + wave * 1.2 + jaw * (near ? 4.2 : 2.2), hy = y - .8 * wave + jaw * 2;
    c.beginPath(); c.moveTo(-2 + i * 1.7, .7);
    c.bezierCurveTo(1 + i * 2, -6, hx - 7, hy + 6.1, hx, hy + .2);
    tube(c, near ? sage : deep, near ? 4.8 : 3.8);
    c.save(); c.translate(hx, hy); c.rotate(-.07 + .06 * wave + .16 * jaw + .09 * p.pitch);
    cut(c, "M-4 -1 Q-5 -4 -6.4 -6 Q-3 -5.8 -1.25 -4.05 Q-.65 -6.1 1 -6.85 Q1.3 -5.1 2.45 -4.65 Q5.2 -4.7 6.1 -2.5 Q7.1 -1.75 8.8 -1.85 Q9.9 -.5 8.45 1 Q6.3 2.4 2.1 1.65 Q-.8 3.45 -3 .95Z", near ? sage : "#86b497", 1.1);
    c.save(); c.translate(2.55, .9); c.rotate(.45 * jaw);
    cut(c, "M-.8 -.4 Q2.5 .3 5.6 -.9 Q5.7 1.15 2.6 1.95 Q.1 2.3 -.8 .7Z", "#d6ca91", .72); c.restore();
    eye(c, 2.15, -2.04, 1.6, 1.12 - .5 * jaw - .65 * p.blink, p.lookX, p.lookY);
    c.restore();
  }
  c.save(); c.translate(-5.6, 3); c.rotate(.1 * Math.sin(phase - .7) - .12 * p.pace);
  cut(c, "M3 -3.1 Q-3.6 -3.7 -7.2 .4 Q-13 5.8 -20 1.05 Q-17.2 8.2 -9 6.8 Q-4.6 6.55 1.2 2.6Z", sage, 1.2); c.restore();
  cut(c, "M-10 -.5 Q-8.6 -6.2 -1.8 -6.1 Q4.5 -6.5 8 -3.9 Q11.4 -1.1 10.1 2.65 Q7.25 7.2 -.8 6.7 Q-10.9 7.3 -10 -.5Z", sage, 1.4);
  cut(c, "M-7.7 1.45 Q-1.9 3.2 4.75 -.95 Q8 -3.2 10 -2.75 Q11.5 -.5 9.75 2.55 Q5.95 6.55 -.25 5.85 Q-5.5 5.65 -7.7 3.85Z", d.coat, .9);
  line(c, -3.7, 3.4, 1.2, 3, d.light, 1.05);
  cut(c, "M-8.5 -3.25 Q-8.2 -5.75 -6.25 -7.35 L-4.95 -4.55 Q-3.45 -6.45 -1.85 -6.85 L-1.2 -4.35Z", "#bbca99", .69);
  line(c, -6.1,-.9,-4.8,-.15,deep,.85); line(c, -3.8,-1.6,-2.35,-1.05,deep,.78);
}

function sandworm(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const lunge = eventFade(tick, u?.lastAttackTick, 15);
  const dive = u?.windup?.kind === "breach" ? Math.max(0, Math.min(1, (tick-u.windup.since)/UNIT_DEFINITIONS.sandworm.windup)) : 0;
  const rumble = Math.sin((tick + (u?.id ?? 0) * 7) * .12);
  const sand = "#ca9d62", plate = "#e6bf7f", clay = "#93694f";
  // Three low ridges travel into the segment that actually breaches the surface.
  for (let i = 0; i < 3; i++) {
    const x = -15 - 4.7 * i, size = 4.1 - .8 * i, ripple = Math.sin(tick * .15 - i);
    oval(c, x - 2 * lunge, 6.6, size + .4 * ripple, .7 + .3 * ripple + .3 * dive, "#c8ad83");
  }
  c.save(); c.translate(-5, 4.4); c.rotate(-.12 + .12 * rumble + .13 * lunge);
  cut(c, "M-13 1.9 Q-11.5 -3.7 -6.35 -4.55 Q-.4 -5.2 2.4 -.45 Q-1.8 3.65 -11 3.6Z", sand, 1.1); c.restore();
  c.translate(2.8 * lunge, 3.3 - 5.2 * lunge + rumble * .6 + 1.8 * dive);
  c.scale(1, 1 - .68 * dive);
  c.rotate(-.25 - .19 * p.ready + .33 * lunge);
  cut(c, "M-17.4 5.3 C-18.1 1.05 -15.05 -3.4 -10.65 -3.8 Q-7.0 -4.1 -5.05 -2.7 C-1.45 -1.3 -2.85 -7.85 1.35 -11.7 Q5.15 -15.35 10.8 -13.7 L12.05 -3.35 Q6.65 -3.55 4.85 2 C2.95 7.6 -2.25 8.65 -7.8 5.7 Q-12.9 3.0 -14.85 7.05Z", sand, 1.45);
  cut(c, "M-15.8 -.65 Q-14.7 -3 -12.05 -3.3 Q-10.15 -.95 -10.7 3.85 L-12.65 3.7 Q-12.1 1.2 -15.8 -.65Z", plate, .82);
  cut(c, "M-8.7 -3.05 Q-6.8 -3.05 -5.25 -2.15 Q-3.85 .85 -5.65 5.95 L-7.5 5.5 Q-5.8 1.15 -8.7 -3.05Z", plate, .8);
  cut(c, "M-3.4 -6 Q-.8 -8.4 2.2 -9.45 Q5.5 -8.4 7.1 -3.05 L4.65 -.9 Q2.25 -5.35 -3.4 -6Z", d.coat, .9);
  c.save(); c.translate(10.15 + 2.4 * lunge, -7 - lunge); c.rotate(.12 + p.pitch * .12);
  c.scale(1 + .24 * lunge, 1 + .16 * lunge);
  cut(c, "M-6.8 -.5 Q-8.05 -6.55 -3.5 -9 Q.3 -11.1 4.2 -7.55 Q7.65 -5.1 7.25 .1 Q7.1 5.7 2.4 7.75 Q-2.25 9.4 -5.45 5.6Z", plate, 1.35);
  cut(c, "M-6.4 -4.2 Q-4.8 -7.9 -.35 -8.2 Q3.5 -8.35 5.35 -5.55 Q1.95 -7 -1.3 -6.1 Q-3.4 -5.15 -4.5 -2.15 Q-5.75 1.55 -3.1 5.5 Q-6.8 3.25 -6.4 -4.2Z", d.coat, .62);
  cut(c, "M-3.65 -4.2 Q-.8 -8.15 2.25 -6 Q5.65 -4.25 5.3 .15 Q4.95 4.25 .95 5.55 Q-3.4 6.15 -4.35 .65Z", "#593e42", .85);
  oval(c, .35, -.1, 2.05,2.5,"#ad736b"); oval(c,.36,-.12,1.04,1.4,"#513f43");
  cut(c, "M-4.35 -4.45 L-1.5 -6.55 L-.45 -2.1Z M1.55 -6.9 L4.35 -5.1 L1.55 -2.6Z M4.8 1.8 L3.25 4.65 L1.05 2.45Z M-.35 5.1 L-3.1 4.2 L-1.4 1.85Z", FACE, .52);
  cut(c, "M-4.8 -1.7 L-4.35 .95 L-2.5 -.1Z M4.9 -3.35 L5.45 -.75 L3.3 -1.25Z", "#f5d399", .42);
  line(c, -4.95, -1.25, -5.3, 1.4, clay, 1); c.restore();
}

function slime(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const squash = eventFade(tick, u?.lastAttackTick, 13), small = !!u?.smallSlime;
  const wave = Math.sin((tick + (u?.id ?? 0) * 15) * .095);
  const bounce = p.lift * 2.2 + .9 * (1 + wave);
  c.translate(0, 7.6 - bounce);
  c.scale(1 + .24 * squash - .035 * wave, 1 - .24 * squash + .06 * wave + (small ? .12 : 0));
  cut(c, "M-14 -2.2 C-14.4 -6.1 -10.1 -9.1 -9.1 -13.5 Q-7.2 -19.2 -1.3 -18.8 Q5.3 -19.1 8.1 -12 Q9.45 -8.3 12.8 -5.7 Q16.5 -2.8 12.6 -.9 Q8.8 1 5.9 -.1 Q2.7 2.05 -.8 .4 Q-4.65 2.25 -7.9 .4 Q-12.3 1.3 -14 -2.2Z", d.coat, 1.45);
  cut(c, "M-10.6 -2.3 Q-6.5 -.35 -3 -2.4 Q.2 -.85 3.8 -3.05 Q7.1 -1.45 11.8 -3.9 Q11.05 -.9 6.65 -.8 L5.3 -1.3 Q1.25 .75 -.65 -.65 Q-6.35 1.3 -10.6 -2.3Z", d.hem, 0);
  cut(c, "M-7.75 -12.7 Q-6.75 -16.5 -3.1 -16.7 Q-1.7 -16.8 -2.35 -15.65 Q-5.35 -14.85 -7.75 -12.7Z", "#fff5d7", 0);
  eye(c, .2, -9.45, 1.7, 1.75 - .65 * squash - 1.1 * p.blink, p.lookX, p.lookY);
  eye(c, 5.85, -10.05, 1.53, 1.59 - .6 * squash - p.blink, p.lookX, p.lookY);
  if (small) oval(c, -3.6,-7.1,1.2,.69,d.light);
  if (squash > .32) oval(c, 3.1, -6.5, 1.58, 1.3 * squash, INK);
  else { c.beginPath(); c.moveTo(1.35, -6.15); c.quadraticCurveTo(3.05, -4.55, 4.95, -6.6); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); }
}

function houndHead(c: Pens, d: Dye, p: CharacterPose, x: number, y: number, size: number, turn: number, bite: number, facing = 1) {
  c.save(); c.translate(x + bite * 2 * facing, y); c.scale(facing,1); c.rotate(turn - .13 * bite); c.scale(size, size);
  cut(c, "M-4.8 -1.2 L-7.1 -4.95 L-4.8 -4.45 Q-6.05 -8.1 -5.35 -10.35 Q-2.2 -9.35 -.5 -6.1 Q1.25 -7.15 3.6 -6.4 L5.4 -8.5 Q6.2 -6.45 5.65 -4.2 L6.5 -2.35 L10.05 -1.95 Q11.7 -.05 10.05 1.4 L5.9 2.1 Q3.35 5.6 -.3 4.55 Q-3.5 4.2 -4.8 1.75Z", "#71636a", 1.25);
  cut(c, "M3.6 -.6 Q6.4 -2.9 9.75 -1.65 L10.35 -.1 L6.9 1.7 L4.65 1.7Z", "#c69b81", .66);
  oval(c, 10.05, -.97, 1.15, .88, INK);
  c.save(); c.translate(3.6, 1.4); c.rotate(.55 * bite);
  cut(c, "M-.25 -.35 Q2.15 1.1 6.05 -1.3 Q6.1 1.5 3.5 2.55 Q.95 3.25 -.25 1.8Z", "#ad8278", .79);
  cut(c, "M3.6 .45 L5.3 -.4 L4.6 1.65Z", FACE, .35); c.restore();
  eye(c, 2.2, -2.95, 1.76, 1.3 - .48 * bite - .87 * p.blink, p.lookX, p.lookY);
  line(c, -.55, -4.63, 3.92, -4.22 + .62 * bite, INK, .91);
  cut(c, "M-4.7 1.75 Q-.35 5.55 4.45 3.25 L3.8 5.25 Q-.45 6.85 -4.9 3.85Z", d.coat, .72);
  c.restore();
}

function cerberus(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const bite = eventFade(tick, u?.lastAttackTick, 15);
  const near = Math.sin((tick + (u?.id ?? 0) * 11) * .075);
  const hide = "#594f58";
  c.translate(2.5 * bite, -p.lift - .5 * p.breath);
  for (const side of [-1, 1]) {
    const x = side * 7.4, step = p.step * side * 3.1;
    limb(c, x, .6, x - 2.55 + step, 6.75, hide, 2.55);
    limb(c, x - 2.55 + step, 6.75, x + step + .65, 7.7, hide, 2);
  }
  c.save(); c.translate(-8, -.9); c.rotate(.1 * near + .15 * bite);
  cut(c, "M2.7 2.5 Q-4.2 4.8 -8.95 .7 Q-13.15 -2.7 -12 -8.4 Q-10.4 -5.3 -8 -5.85 Q-8.25 -3 -5.6 -2.35 Q-2.1 -1.3 2.15 -1.85Z", hide, 1.15); c.restore();
  cut(c, "M-12.3 -.1 Q-12.5 -6.2 -7.95 -7.05 Q-4.2 -7.75 -.6 -6.55 Q3.15 -10.1 8 -7.75 Q13.35 -5.3 11.55 .7 Q9.4 5.2 3.35 4.55 Q.25 3.15 -4.05 4.4 Q-9.55 5.35 -12.3 -.1Z", hide, 1.5);
  cut(c, "M-5 -6.5 Q-2.5 -6.4 -.5 -6.25 Q1.2 -2.8 5.2 .9 L3.6 3.75 Q-1.65 .25 -5 -6.5Z", d.coat, 1);
  houndHead(c,d,p,-7.1,-7.3 + .55 * near,.84,-.27,.17 * bite,-1);
  houndHead(c,d,p,3 + 2.35 * bite,-15.15 - .4 * near,.99,-.13,bite);
  houndHead(c,d,p,10,-4.85 + .35 * near,1.04,.08 + .1 * p.pitch,.24 * bite);
  for (const side of [-1,1]) {
    const x = side * 6.1, step = p.step * side * 3.3;
    const plant = side > 0 ? bite * 3.1 : 0;
    limb(c, x, 2, x + step + plant, 7.4 - plant, "#79696c", 2.55);
    line(c, x - .45 + step + plant, 7.65 - plant, x + 2.35 + step + plant, 7.65 - plant, INK, 2.45);
  }
}

function kraken(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const grab = eventFade(tick, u?.lastAttackTick, 19);
  const wave = Math.sin((tick + (u?.id ?? 0) * 13) * .077);
  const plum = "#a36c89", pink = "#ddb395", dark = "#7d5a77";
  c.translate(-p.hurt * 1.4, -.7 * p.lift - .5 * p.breath);
  c.beginPath(); c.moveTo(-4, -.5); c.bezierCurveTo(-10, 2, -8.8, 9.6, -15, 8.4);
  c.bezierCurveTo(-20.1, 7.6, -20.8, 1 + wave * 2, -17.8, .2 + wave * 2); tube(c, dark, 2.55);
  c.beginPath(); c.moveTo(4.8, -.1); c.bezierCurveTo(11.3, 2.6, 10.6, 8, 16.2, 7);
  c.quadraticCurveTo(22, 6 - wave, 21.4, 1.1 - wave); tube(c, dark, 2.9);
  c.save(); c.translate(-.3, -2); c.rotate(.07 * wave - .15 * grab); c.translate(.3, 2);
  cut(c, "M-8.5 -10 Q-10.8 -16.6 -7.35 -23 Q-4.75 -27.65 -1.85 -25.2 Q-.75 -23.75 2 -23 C7.3 -21.3 9.75 -17 9.25 -11.8 Q10.65 -8.4 8.3 -5.9 L-6.4 -4.25Z", plum, 1.35);
  cut(c, "M-6.95 -20.6 Q-4.8 -23.25 -2.65 -22.1 Q5.25 -20.45 7 -15.3 Q1 -19.05 -2.1 -18.5 Q-4.8 -18.65 -6.95 -17.35Z", d.coat, .92);
  cut(c, "M-7.9 -14.05 Q-10.4 -15.35 -12.8 -13.4 Q-13.15 -10.55 -8.1 -9.35Z", dark, .85);
  cut(c, "M-8 -13.55 Q-3.8 -17.15 3.25 -14.75 Q9.1 -14.05 9.85 -8.5 Q11.15 -3.4 6.15 -.1 Q.55 3.65 -6.35 .5 Q-11.25 -3 -9.6 -7.8Z", plum, 1.4);
  eye(c, -3.85, -7.1, 2.72, 2.25 - .6 * grab - 1.45 * p.blink, p.lookX, p.lookY);
  eye(c, 4.45, -8.25, 2.95, 2.46 - .68 * grab - 1.6 * p.blink, p.lookX, p.lookY);
  line(c, 1.4, -11.08, 6.9, -11.3 + .66 * grab, dark, 1.15);
  cut(c, "M-.7 -3.2 Q1.35 -4.5 3.2 -3.9 Q3.6 -1.65 1.15 -1.05Z", "#554751", .64); c.restore();
  c.beginPath(); c.moveTo(-3.15, -.1); c.bezierCurveTo(-8.65, 3.4, -8.75, 11.7, -2.6, 10.55);
  c.quadraticCurveTo(1.3, 9.7, -.4, 6 - wave); tube(c, plum, 3.05);
  const tipX = 15.15 + 10 * grab, tipY = -7.9 - 3.7 * grab - wave * 1.3;
  c.beginPath(); c.moveTo(4.3, -.25); c.bezierCurveTo(9.8, 9.45 - 4 * grab, 18.5 + 5 * grab, 4.85 - 14 * grab, tipX, tipY);
  c.quadraticCurveTo(tipX - 2, tipY - 3.55, tipX - 4, tipY - 1); tube(c, plum, 3.05);
  oval(c, 7.3, 2.9 - grab, 1.1, .83, pink); oval(c, 10.45 + 1.15 * grab, 4.0 - 2.8 * grab, .97, .76, pink);
}

function dragonWing(c: Pens, d: Dye, flap: number, far: boolean, folded: boolean) {
  c.save(); c.translate(far ? -1 : -3, far ? -6 : -3.9);
  c.rotate((far ? -.22 : .13) + flap * (far ? .37 : .49)); c.scale(far ? .77 : 1, far ? .84 : 1);
  if (folded) c.scale(.72,.53);
  cut(c, "M2.05 1.5 Q.45 -6.6 -6 -17 Q-6.65 -18.55 -7.75 -17.25 Q-16.7 -18.35 -25.4 -11.85 Q-21.25 -12.7 -18.75 -10.3 Q-15.2 -8.4 -15.15 -3.85 Q-10.35 -6.3 -7.65 -3.75 Q-5.4 -1.85 -4.65 1.65 Q-1.95 -.15 2.05 1.5Z", far ? d.hem : d.coat, 1.35);
  line(c, -6.75, -16.75, -15.2, -4.6, far ? "#775853" : d.light, .95);
  line(c, -6.75, -16.75, -5.4, -.15, "#a26f56", 1.02);
  cut(c, "M-7.8 -17.1 Q-8.8 -19.55 -7.1 -21.35 Q-7.05 -19.05 -5.6 -16.8Z", FACE, .75); c.restore();
}

function firedragon(c: Pens, d: Dye, p: CharacterPose, u: Unit | undefined, tick: number) {
  const exhale = eventFade(tick, u?.lastAttackTick, 19);
  const heat = u?.windup?.kind === "breath" ? Math.max(0, Math.min(1, (tick - u.windup.since + 1) / UNIT_DEFINITIONS.firedragon.windup)) : 0;
  const elapsed = tick - (u?.lastAttackTick ?? -Infinity);
  const pant = elapsed > 12 && elapsed < 48 ? .5 - .5 * Math.cos((elapsed - 12) * Math.PI / 9) : 0;
  const grounded = tick < (u?.groundedUntil ?? 0);
  const phase = (tick + (u?.id ?? 0) * 19) * .093;
  const flap = grounded ? -.5 : Math.sin(phase) * (1 - .65 * heat) - .3 * exhale;
  const rust = "#b66d54", scale = "#cc8965", belly = "#e8ba7f";
  c.translate(2 * exhale - 1.2 * heat, grounded ? .4 : -2.5 + 1.25 * Math.sin(phase - .8) - p.lift);
  dragonWing(c, d, flap, true, grounded);
  c.save(); c.translate(-6, -.5); c.rotate(.17 * Math.sin(phase - .9) + .16 * heat);
  cut(c, "M2.6 -3.2 Q-5.05 -4.5 -10 1.45 Q-14.6 7.25 -21.1 4.5 Q-18.45 8.45 -14.65 8.75 Q-11 9.1 -7.35 5.6 Q-3.2 1.45 2.25 2.55Z", rust, 1.28);
  cut(c, "M-7.35 -.75 L-8.95 -4.05 Q-6.05 -3.45 -4.45 -2.3Z M-12.5 3.2 L-14.55 .9 Q-12.25 .85 -10.5 1.75Z", belly, .66);
  cut(c, "M-17 5.45 Q-19 2.65 -22 1.7 Q-21.1 4.4 -24.1 5.15 Q-20.8 5.45 -20 7.8Z", belly, .85); c.restore();
  for (const side of [-1, 1]) {
    const x = side * 6.15;
    limb(c, x, 1.5, x - 1.8 + p.step * side * 1.5, 6.65 + flap, rust, 2.45);
    line(c, x - 2 + p.step * side * 1.5, 6.6 + flap, x + .7, 7.7 + flap, INK, 1.95);
  }
  cut(c, "M-11.5 -3.8 Q-11.3 -8.4 -5.25 -8.95 Q.6 -10 4.2 -8.25 Q8.25 -10.35 8.1 -14.4 L13.45 -13.85 Q15.05 -5.05 9.1 .25 Q5.45 4.05 -.4 4.55 Q-7 5.25 -10 .85Z", scale, 1.55);
  cut(c, "M-.45 3.5 Q8.3 1.75 8.95 -6.15 L11.35 -12.6 L13.5 -11.5 Q14.15 -5.5 10.15 -1.55 Q7.15 2.9 2.3 3.7Z", belly, .75);
  if (heat > 0 || exhale > .1) {
    c.save(); c.globalAlpha *= Math.max(heat, .8 * exhale);
    cut(c, "M5.55 1.05 Q8.75 -1.5 9.45 -4.85 L11.15 -10.55 L12.8 -9.85 Q12.15 -2.55 7.55 -.2Z", "#ffe082", 0);
    line(c, 8.65, -2.0, 10.9, -1.65, "#f59b43", .87); c.restore();
  }
  c.save(); c.translate(10.55, -11.25); c.rotate(.16 * p.pitch - .26 * heat + .21 * exhale);
  cut(c, "M-4.75 -3.1 Q-7.4 -5.55 -11 -5.5 Q-9.35 -2.65 -5.6 -.95 Q-8 -.85 -8.9 .55 Q-5.8 2.7 -3.55 1.45Z", rust, 1);
  cut(c, "M-3.4 -5.85 Q-6.05 -9.95 -7.6 -12.15 Q-4.05 -11.45 -.65 -7.25Z M.75 -6.65 Q-.35 -10.7 1.1 -12.55 Q2.15 -9.6 4.15 -7.25Z", FACE, .9);
  cut(c, "M-4.65 -3.85 Q-4.85 -7.55 .15 -7.9 Q5.55 -8.2 6.8 -4.55 Q7.95 -2.9 11.85 -3.55 Q14.3 -3.5 14.35 -1.15 Q14.1 1.25 10.45 1.5 L5.45 1.65 Q2.75 4.85 -1.05 3.4 Q-4.15 2.35 -4.65 -3.85Z", scale, 1.35);
  if (heat > .12) {
    c.save();c.translate(-.6,1.6);c.scale(1+.26*heat,1+.53*heat);
    cut(c, "M-2.65 -1.2 Q-2.1 -.15 1.3 -.65 Q3.25 -.65 3.3 .65 Q2.95 2.65 .25 2.85 Q-2.75 2.75 -2.65 -1.2Z", "#edb271", .67);c.restore();
  }
  c.save(); c.translate(3.4, 1.1); c.rotate(.17 * heat + .56 * exhale + .22 * pant);
  cut(c, "M-.9 -.05 Q4.15 1.2 9.75 -.85 Q10.25 1.1 7.85 2.35 Q4.35 4.1 .15 2.65Z", belly, .96);
  cut(c, "M5.85 1 L7.25 .55 L6.7 -.9Z M2.2 .75 L3.5 .8 L2.7 -.45Z", FACE, .48); c.restore();
  eye(c, 2.0, -3.65, 2.2, 1.64 - .56 * heat - 1.08 * p.blink, p.lookX, p.lookY);
  line(c, -.65, -5.5, 4.05, -5.1 + .65 * heat, INK, 1.06);
  oval(c, 11.95, -1.7, .8, .55, INK);
  if (heat > .3) { c.save(); c.globalAlpha *= heat; oval(c, 12.05, -1.75, .5, .33, "#fff4af"); c.restore(); }
  c.restore(); dragonWing(c, d, flap, false, grounded);
}

export function drawBeast(c: Pens, d: Dye, p: CharacterPose, kind: BeastKind, u: Unit | undefined, tick: number) {
  switch (kind) {
    case "hydra": hydra(c,d,p,u,tick); break;
    case "medusa": medusa(c,d,p,u,tick); break;
    case "vampire": vampire(c,d,p,u,tick); break;
    case "sandworm": sandworm(c,d,p,u,tick); break;
    case "slime": slime(c,d,p,u,tick); break;
    case "horseman": horseman(c,d,p,u,tick); break;
    case "werewolf": werewolf(c,d,p,u,tick); break;
    case "cerberus": cerberus(c,d,p,u,tick); break;
    case "kraken": kraken(c,d,p,u,tick); break;
    case "firedragon": firedragon(c,d,p,u,tick); break;
    case "irongolem": ironGolem(c,d,p,u,tick); break;
  }
}

export function fallenBeast(c: Pens, d: Dye, kind: UnitKind): boolean {
  switch (kind) {
    case "irongolem":
      cut(c,"M-6.4 -2.5 L-3.3 -5.15 L3.6 -4.65 L6.65 -1.55 L4.65 3.65 L-2.25 4.4 L-6.15 1.55Z","#83999d",1.17);
      cut(c,"M-4.5 -2.7 L2.6 -3.6 L4.1 -1.9 L-3 -1.1Z",d.coat,.66);
      oval(c,2.1,1,1.12,1.04,"#d6b273"); break;
    case "slime":
      cut(c,"M-8.15 .35 Q-8.15 -2.65 -4.9 -2.95 Q-2.9 -3.85 .5 -2.2 Q3.85 -3.25 5.55 -1.55 Q9.2 -.5 7.15 1.65 Q4.3 3.15 1.45 2.25 Q-2.65 3.95 -6.7 2.4Z",d.coat,.9);
      oval(c,-3.15,-.95,1.65,.51,d.light); break;
    case "horseman":
      cut(c,"M-4.15 -3.75 Q-6.65 -.85 -5.1 2.8 Q-3.8 5.9 .45 5.65 Q5.5 5.25 6.1 1 Q6.4 -1.75 4.05 -4.1 L2.1 -2.8 Q5 .95 2.55 2.95 Q.5 4.4 -1.6 2.8 Q-3.45 .9 -2.1 -1.9Z","#9ca9a3",1);
      line(c,-4.5,.2,-4.55,1.4,INK,.74); line(c,4.58,-.3,4.55,.8,INK,.74); break;
    case "kraken":
      cut(c,"M-7.4 1.35 Q-5.35 -3.5 -1.15 -2.65 Q2.15 -1.9 3.65 -2.9 Q5.55 -4.4 4.65 -5.95 Q7.95 -4.75 7 -1.4 Q5.9 2.5 1.55 1.6 Q-3.8 .15 -5.85 3.55Z","#a36c89",1.04);
      oval(c,2.5,.4,.92,.72,"#e3bca4"); break;
    case "cerberus":
      cut(c,"M-7.3 -1.75 Q-.85 .95 6.4 -2.9 L6.7 .25 Q.25 4.9 -7.3 1.55Z",d.coat,.98);
      for (const x of [-3.85,.4,4.25]) oval(c,x,.3-Math.abs(x)*.12,.68,.69,"#e5bb72"); break;
    case "vampire":
      cut(c,"M-7.15 .5 L-4.85 -4.3 L-1.35 -2.2 L2.7 -4.55 L6.9 -.65 L3.6 1.65 L.85 1.25 L-.2 3.2 L-2.5 1.85 L-5.7 3.05Z",d.hem,1);
      line(c,-3.8,-2.45,-.9,-.85,"#bb7688",1); break;
    case "werewolf":
      cut(c,"M-6.9 1.55 Q-5.3 -3.3 -.9 -3.4 L3.15 -4.65 L2.55 -2.65 L7.15 -2.45 L4.2 .5 L5.15 1.2 L.05 2.9 L-1.8 1.85 L-4.5 3.3Z","#839299",.95);
      oval(c,-2.5,-.7,1.08,.95,"#d1b47d"); break;
    case "hydra": case "firedragon":
      cut(c,"M-6.95 2.6 Q-2.55 .05 .35 -5.7 Q.85 -3.55 .3 -1.2 Q3.25 -1.65 5.5 -3.8 Q4.55 .1 1.15 2.1 Q-2.25 4.25 -6.95 2.6Z",kind==="hydra"?"#9bb18c":"#e3be87",.96); break;
    case "medusa": case "sandworm":
      cut(c,"M-5.6 .9 Q-.55 -2.05 4.75 -1.15 L5.65 1.7 Q1.2 1.05 -4.7 3.55Z",kind==="medusa"?"#dcb766":"#cba46b",1); break;
    default: return false;
  }
  return true;
}
