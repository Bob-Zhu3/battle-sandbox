import type { Team, Unit } from "../simulation.ts";
import { ARMIES } from "../battlefield.ts";
import { eventFade, type CharacterPose } from "../character-pose.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "../units.ts";
import type { Pens } from "../ink.ts";
import { ink, segment, stamp } from "./stamps.ts";

const coat = [
  "....KKKKKKK....", "..KKddcccchKK..", ".KddchhhccchcK.", "KddchhhcccccfK.", "KddchhccFFcFFK.",
  "KdmcccFFfccffK.", ".KmddFFfcccdK..", ".KddYycccccdK..", ".KbbYYbbbbbK...", ".KdccbbcccdK...",
  "KddccccchccK...", "KddccKKcccdK...", ".KKKK..KKKK....",
];
const boot = ["KKKK.", "KmmK.", "KbmmK", "KKKKK"];
const helmet = [
  "..KKKK.......", ".KhhhcKKK....", "KcccdKSSSKK..", "KddKKmSIISmK.",
  ".KKKmmSSSSSmK", "...KmSSmmSSmK", "..KKKKKKKKKKK", "..KmSSSmmmSIK", "...KmSSSKKIIK", "....KmmSmmSmK", ".....KKKKKKK.",
];
const hood = [
  "..KKK..........", ".KYyyKK........", "..KYYYYK.......", "...KKYYyKKKK...", ".KKKddKKchhcK..",
  "KdddccchhhcccK.", ".KddcccddKKKKK.", "..KdcddKffffFK.", "...KddKffFFFFK.", "...KdKKfffFffKK", "....KddKffrrrK.", ".....KddKKKKK..",
];
const lancerHelm = [
  "KKKKKK.......", ".KhhhcKK.....", "..KhhccKKKK..", "...KKdcmSISKK", "....KKmmSISmK",
  "....KmSSSISmK", "...KmmKKKKKKKK", "...KmKfFFFFfK", "....KmKfFFFFK", ".....KmmmffK.", "......KKKKK..",
];
const hat = [
  "KYKK..............", ".KYYYK............", "..KyYYKKKKK.......", "...KKYdchhcK......", "....KdcccccdK.....",
  "....KddccccdK..KK.", ".KKKKYYyyyyYKKKSK.", "KmmmddddcccccddK..", ".KKKKKKKKKKKKK...", ".....KbrffFFFfK...", ".....KbfffffffK...", "......KrrKKffK....", ".......KKKKKK.....",
];
const bascinet = [
  ".....KKKKK....", "...KKmmSISK...", "..KmSSSSISmK..", ".KmSSSSSSSSmK.", ".KmSSmmmSSSmK.",
  "KKKKKKKKKKKKKK", "KmmmSmmKKfffK.", ".KmmmSmKfFFFfK", "..KmmmSKffrrK.", "...KKKKKKKKK..",
];
const medicCap = [
  "...KKKKKKK...", ".KKIIWIIISK..", "KIIWWWchISmK.", "KWWWWcccWISmK", ".KIIWWchWIISK",
  "..KSSSSSSSSK.", "..KbbKfffFFK.", "..KbbffFFFFK.", "...KbrfffffK.", "....KKrrffK..", "......KKKK...",
];
const shield = [
  "..KKKKKKK..", ".KYYhhccyK.", "KYhcccccdyK", "KYcccYccdyK", "KychYYYcdyK", "KydccYccdyK",
  ".KyccYcdK..", ".KyccYcdK..", "..KydddK...", "...KyydK...", "....KKK....",
];
const wall = [
  "..KKKKKKKKK..", ".KSIIIIISSmK.", "KISccYcccSSmK", "KScccYcccdSmK", "KScccYcccdSmK", "KScccYcccdSmK",
  "KSccYYYccdSmK", "KScccYcccdSmK", "KScccYcccdSmK", "KSdccYccddSmK", ".KSddYdddmSK.", ".KSSSYSSSSmK.", "..KKKKKKKKK..",
];
const glove = ["KKK.", "KFFK", "KffK", ".KK."];
const pack = ["..KKKK.", ".KYYYYK", "KyyIIyK", "KyIIIIK", "KyyIIyK", ".KyyyK.", "..KKK.."];
const head = {warrior:helmet, archer:hood, lancer:lancerHelm, musketeer:hat, shieldbearer:bascinet, medic:medicCap};

export function infantryKind(kind: UnitKind): kind is keyof typeof head {
  return Object.hasOwn(head, kind);
}
export function fallenHead(c: Pens, team: Team, kind: "warrior"|"archer") {
  stamp(c,team,head[kind],-6,-8);
}
export function infantry(c: Pens, team: Team, kind: keyof typeof head, p: CharacterPose, u: Unit|undefined, tick: number) {
  const age = tick-(u?.lastAttackTick ?? -Infinity);
  const jab = eventFade(tick,u?.lastAttackTick,12);
  const brace = kind === "shieldbearer" ? Math.max(eventFade(tick,u?.lastBraceTick,16),eventFade(tick,u?.lastBlockTick,12)) : 0;
  const charge = kind === "lancer" && tick >= (u?.stunnedUntil ?? 0) ? Math.min(1,(u?.runUp??0)/UNIT_DEFINITIONS.lancer.runUp) : 0;
  const wrap = kind === "medic" && u?.wrappingSince !== undefined ? 1 : 0;
  const dye = ARMIES[team], stride = Math.round(p.step*3);
  const crouch = Math.round(p.duck*3+brace*2+wrap*2-p.peek*2);
  const lean = Math.round(p.strike*3+charge*2-p.hurt*2-p.loose*2+wrap*2);
  stamp(c,team,boot,-6+stride,5-Math.max(0,Math.sign(stride)));
  stamp(c,team,boot,2-stride,5-Math.max(0,-Math.sign(stride)));
  c.save();
  c.translate(lean,crouch-Math.round(p.lift*1.6+p.breath*.8));
  if (kind==="archer") {
    segment(c,-7,-12,-3,1,ink,3); segment(c,-6,-11,-3,1,"#bd7746");
    segment(c,-9,-12,-7,-10,"#fff2c4",2); segment(c,-6,-14,-5,-12,"#ffc660",2);
  }
  stamp(c,team,coat,-7,-7);
  const hx = (kind==="musketeer"?-9:-7)+Math.round(p.peek*2+p.lookX*.5);
  const hy = kind==="musketeer"?-16:kind==="archer"?-15:kind==="shieldbearer"?-13:-14;
  stamp(c,team,head[kind],hx,hy);
  const ex=hx+(kind==="musketeer"?11:kind==="archer"?11:kind==="warrior"?9:10);
  const ey=hy+(kind==="musketeer"?9:kind==="warrior"?8:7);
  const shut=p.blink>.66 || p.hurt>.72, pupil=p.lookX<0?0:1;
  c.fillStyle=ink;
  c.fillRect(ex-1,ey,4,shut?1:2);
  if (!shut) {
    c.fillStyle=kind==="warrior"?"#83c9f2":"#fff2c4";
    c.fillRect(ex+pupil,ey,1,1);
  }
  if (kind==="archer") {
    const hand=9+Math.round(p.ready*2+p.loose*2), pull=hand-3-Math.round(p.ready*6);
    c.translate(1,Math.round(-p.peek));
    const tilt=Math.round(p.pitch*3);
    segment(c,hand-3+tilt,-11,hand+2,-5,"#684856",2); segment(c,hand+2,-5,hand+2,2,"#684856",2);
    segment(c,hand+2,2,hand-3-tilt,8,"#684856",2);
    segment(c,hand-2+tilt,-10,hand+2,-4,"#ffc660"); segment(c,hand+2,1,hand-2-tilt,7,"#ffc660");
    segment(c,hand-3+tilt,-11,pull,-2,"#516077"); segment(c,pull,-2,hand-3-tilt,8,"#516077");
    if (p.ready>.25 && p.loose<.2) { segment(c,pull-2,-2,hand+7,-2+tilt,ink); c.fillRect(hand+6,-3+tilt,2,2); }
    stamp(c,team,glove,hand-2,-3); stamp(c,team,glove,p.loose>.3?-3:pull-3,-4);
  } else if (kind==="warrior") {
    const gripX=5+Math.round(p.strike*4), gripY=-1-Math.round(p.ready*2);
    const tipX=gripX+Math.round(3+p.strike*12-p.ready*5), tipY=gripY-Math.round(15-p.strike*13);
    segment(c,gripX,gripY,tipX,tipY,ink,3); segment(c,gripX+1,gripY,tipX+1,tipY,"#d6f0e9");
    segment(c,gripX-2,gripY-2,gripX+3,gripY+1,"#bd7746",2); stamp(c,team,glove,gripX-1,gripY);
    stamp(c,team,shield,-9+Math.round(p.duck*5),-2-Math.round(p.guard+3*p.duck));
  } else if (kind==="shieldbearer") {
    stamp(c,team,wall,-2+Math.round(brace*3),-6-Math.round(brace*3));
  } else if (kind==="lancer") {
    const forward=Math.max(charge,jab), y=Math.round(-15+forward*13+p.pitch*5);
    segment(c,-9,3,20,y,ink,2); segment(c,-8,3,19,y,dye.light);
    segment(c,16,y+1,22,y-1,ink,2); segment(c,17,y+1,22,y-1,"#d4edef");
    segment(c,11,y+3,10,y+6,dye.coat,2); stamp(c,team,glove,0,-1);
  } else if (kind==="musketeer") {
    const reload=age>8 && age<43 ? Math.sin(Math.PI*(age-8)/35) : 0;
    const y=Math.round(-4+p.pitch*7-4*p.loose+reload*7);
    segment(c,-4,1,6,-3,ink,3); segment(c,-3,2,6,-2,"#bd7746",2);
    segment(c,5,-3,18,y,ink,3); segment(c,6,-3,18,y,"#91acb4");
    stamp(c,team,glove,2,-2); stamp(c,team,glove,10-Math.round(reload*6),y+1);
  } else {
    stamp(c,team,pack,-8,-1); stamp(c,team,glove,3+3*wrap,-1+wrap);
    if (wrap) segment(c,6,2,10,1,"#e4eee4",2);
  }
  c.restore();
}
