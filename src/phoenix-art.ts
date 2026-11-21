import { phoenixFlight, type CharacterPose } from "./character-pose.ts";
import { FACE, INK, WOOD, cut, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

const plumage = "#df8a51", emberRed = "#bf6048", gold = "#f2c476";

function fillAndOutline(c: Pens, fill: string, width: number) {
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = width;
  c.stroke();
}

// The wrist flexes the three outer feathers. The leading edge stays attached to the shoulder.
function wing(c: Pens, dye: Dye, stroke: number, wrist: number, tuck: number, far: boolean) {
  c.save();
  c.translate(far ? -1 : -1.9, far ? -3.6 : -1.3);
  c.rotate(far ? .22 + .39 * stroke - .15 * wrist : -.06 + .76 * stroke);
  const span = far ? .91 : 1;
  c.scale(span * (1 - .24 * tuck), span * (1 - .16 * tuck));
  const tip = 4.8 * wrist;
  c.beginPath();
  c.moveTo(3.8, 1);
  c.bezierCurveTo(4.8, -4.1, .6, -7, -5.4, -7.8);
  c.bezierCurveTo(-11.8, -8.8, -17.6, -7.1 + tip * .55, -25.2, -11.2 + tip);
  c.quadraticCurveTo(-23.5, -6 + tip, -15.4, -2.6 + tip * .35);
  c.quadraticCurveTo(-18.7, -2.75 + tip * .62, -21.9, -4 + tip * .82);
  c.quadraticCurveTo(-19.2, .6 + tip * .45, -11.5, 1.1 + tip * .16);
  c.quadraticCurveTo(-13.9, 1.6 + tip * .32, -15.9, 1.3 + tip * .4);
  c.bezierCurveTo(-12.2, 5.1, -2.8, 6.5, 1.3, 3.9);
  c.closePath();
  fillAndOutline(c, far ? dye.hem : dye.coat, far ? 1.25 : 1.55);
  if (!far) {
    // One warm band sweeps into the primaries, following the joint.
    cut(c, "M2.9 .8 Q4.1 -4.8 -4.8 -7.1 Q-7.4 -7.8 -10.9 -7.4 Q-8.7 -4.9 -4.9 -3.5 Q-6.8 -3.1 -9.2 -3.5 Q-6.3 -.8 -3.1 0 Q-.6 1.2 1.8 2.4 Q2.5 2 2.9 .8Z", plumage, 0);
  }
  c.restore();
}

function tail(c: Pens, sway: number, tip: number, lift: number, tuck: number) {
  c.save();
  c.translate(-6, .7);
  c.save();
  c.rotate(-.14 - .16 * sway - .17 * lift);
  cut(c, "M2 -1 C-4.6 -3.6 -9.4 2.2 -13.6 4.7 Q-18.9 7.7 -22.9 4 Q-19.3 11.8 -11.5 8.4 Q-6.7 5.9 -3 3.3 L2 2Z", emberRed, 1.25);
  c.restore();
  c.rotate(.06 + .14 * sway + .12 * tuck);
  const curl = 2.4 * tip;
  c.beginPath();
  c.moveTo(2.5, -2.2);
  c.bezierCurveTo(-3.4, -4.8, -7.8, -4.4, -12.8, -1.7);
  c.bezierCurveTo(-17.4, 1.1, -20.8, 1.2 + curl, -22.7, -4.4 + curl);
  c.quadraticCurveTo(-23.9, -.2 + curl, -21.2, 2.4 + curl);
  c.quadraticCurveTo(-24.6, 2.6 + curl, -27, -.9 + curl);
  c.bezierCurveTo(-25.3, 5.9 + curl, -19.2, 8.7 + curl * .5, -13.2, 5.8);
  c.quadraticCurveTo(-6.3, 2.5, 1.8, 2.7);
  c.closePath();
  fillAndOutline(c, plumage, 1.35);
  c.beginPath();
  c.moveTo(.5, -1.1);
  c.quadraticCurveTo(-6.3, -3.4, -13.4, .1);
  c.quadraticCurveTo(-17, 2 + curl * .55, -19.6, .85 + curl);
  c.quadraticCurveTo(-17, 4.9 + curl * .55, -12.1, 2.65);
  c.quadraticCurveTo(-4.8, -.25, .5, .4);
  c.fillStyle = gold;
  c.fill();
  c.restore();
}

function claw(c: Pens, x: number, y: number, rake: number, far: boolean) {
  const toeX = x + 5.7 * rake, toeY = y + 2.6 + 4.1 * rake;
  const paint = far ? "#b38454" : WOOD;
  limb(c, x, y, toeX, toeY, paint, far ? 1.35 : 1.7);
  c.save();
  c.translate(toeX, toeY);
  c.rotate(-.48 * rake);
  cut(c, "M-1.7 -.7 Q.8 -1.3 3.3 -.9 Q4.9 -.3 4.6 1.7 L3 .5 L.9 .8 Q1.3 2.1 .3 3.1 L-.5 1.5 Q-2 .8 -2.4 -.2Z", paint, .9);
  c.restore();
}

function body(c: Pens, gaze: number, pose: CharacterPose, call: number) {
  cut(c, "M-10.4 -.8 Q-7.5 -5.8 -1.5 -5.3 Q3.4 -5.6 4.8 -10.7 L5.2 -13.4 L11.3 -12.7 Q12.7 -8.4 10.7 -3 Q8.6 4.7 2.6 5.7 Q-4.5 6.9 -10.4 -.8Z", plumage, 1.55);
  cut(c, "M-.9 4.6 Q6.4 4 7.3 -3 L10.7 -7 Q11 -1.3 7.3 2.9 Q4.4 5.9 -.9 4.6Z", gold, 0);
  c.save();
  c.translate(5.7, -7.3);
  c.rotate(gaze);
  // A swept flame crest and a short hooked bill leave the face open at playing size.
  cut(c, "M-3.5 2.8 Q-3.8 .1 -2.4 -3.4 Q-5.2 -3.1 -7.4 -4.9 Q-5.3 -4.9 -3.5 -5.9 Q-8.4 -6.5 -11.4 -11 Q-7.3 -9.6 -2.6 -10.1 Q-4 -11.4 -4.9 -13.5 Q-1.9 -11.9 1.9 -11.5 Q7.2 -11.1 8.4 -7.1 Q10 -4.1 7.1 -1.1 Q5.2 1 3.4 1.4 L.2 4.5 L.5 2.0 L-3.6 4.3Z", emberRed, 1.4);
  cut(c, "M-7.5 -9.3 Q-4.1 -8.4 -1.7 -9 Q1.3 -9.8 4.1 -8.7 Q1.3 -8.6 -.4 -7.6 Q-4.5 -6.7 -7.5 -9.3Z", gold, 0);
  cut(c, "M-1.8 -5.7 Q2.4 -7.45 7.85 -6.1 Q7.8 -3.6 5.4 -2.3 Q2.8 -.9 .65 .9 L1.45 -1.7 Q-.9 -.5 -3.1 .15 Q-1.1 -2.6 -1.5 -4.2 L-2.8 -3.9Z", FACE, 0);
  const eyeHeight = Math.max(.22, 1.45 - .39 * pose.ready - 1.18 * pose.blink);
  const eyeX = 3.8 + .75 * pose.lookX, eyeY = -4.65 + .55 * pose.lookY + .55 * pose.ready;
  oval(c, eyeX, eyeY, 1.2, eyeHeight, INK);
  oval(c, eyeX + .35, eyeY - eyeHeight * .48, .35, eyeHeight * .24, FACE);
  line(c, 1.15, -6.9 - .52 * pose.ready, 6.7, -6 + .65 * pose.ready, INK, .95);
  if (call > .05) {
    c.save(); c.translate(7, -3.6); c.rotate(.55 * call);
    cut(c, "M-.8 -.65 Q1.5 -.75 4 -.75 Q3.8 .8 1.4 1.2 Q-.55 1.15 -.8 -.65Z", "#da9b61", .85); c.restore();
  }
  cut(c, "M7.2 -6.7 Q10.7 -6.3 11.9 -4.7 Q12.5 -3.8 11.0 -2.0 L10.3 -3.5 Q8.5 -3.8 6.7 -3.6Z", gold, 1.05);
  c.restore();
}

function ember(c: Pens, unit: Unit, tick: number, until: number) {
  const time = tick + unit.id*11, glow = .5 + .5*Math.sin(time*.2);
  const near = 1-Math.min(1,(until-tick)/UNIT_DEFINITIONS.phoenix.hatchTicks);
  oval(c,0,5,11,3,"#865a49"); line(c,-8,5,6,7,"#4f4441",2); line(c,-5,7,8,3,"#5b423c",2);
  c.translate(0,3); c.rotate(Math.sin(time*.42)*near*near*.24); c.translate(0,-3-near*1.6);
  cut(c,"M-7 2 Q-9 -3 -5 -8 Q-4 -12 0 -15 Q6 -11 8 -5 Q10 2 5 5 Q-4 8 -7 2Z","#8c4545",1.5);
  cut(c,"M-5 2 L0 -2 L-2 -6 L3 -11 L1 -5 L4 -2 L-3 4Z","#ffd26a",.5);
  oval(c,4,-5,1,1,"#ffeaa3");
  for (let i=0;i<3;i++) {
    const phase=(time*.035+i/3)%1;
    oval(c,-6+i*5+Math.sin(time*.09+i),-7-phase*11,1.2,1.4,"#ffb64e");
  }
  c.strokeStyle="#ffeab1"; c.lineWidth=1; c.globalAlpha=.5+glow*.4; c.beginPath();
  c.arc(0,0,10,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,near)); c.stroke();
}

export function phoenix(c: Pens, dye: Dye, pose: CharacterPose, unit: Unit | undefined, tick: number) {
  if (unit?.emberUntil !== undefined) {
    ember(c, unit, tick, unit.emberUntil);
    return;
  }
  const flight = phoenixFlight(unit, pose, tick);
  const stroke = unit ? flight.wing : .82;
  c.translate(2.8 * flight.talons, -flight.height);
  c.rotate(flight.pitch);
  wing(c, dye, stroke, flight.wrist, flight.talons, true);
  tail(c, flight.tail, flight.tailTip, flight.pullUp, flight.talons);
  claw(c, .2, 2.2, flight.talons * .72, true);
  claw(c, 4, 2.2, flight.talons, false);
  body(c, .17 * pose.pitch - .38 * flight.pitch + .14 * pose.ready, pose, Math.max(flight.talons, flight.takeoff * .75));
  wing(c, dye, stroke, flight.wrist, flight.talons, false);
}
