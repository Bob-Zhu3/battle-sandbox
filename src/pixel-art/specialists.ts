import { ARMIES, type Team } from "../battlefield.ts";
import { eventFade, type CharacterPose } from "../character-pose.ts";
import { crystalFocus, crystalLift } from "../prism-art.ts";
import type { Unit } from "../simulation.ts";
import type { Pens } from "../ink.ts";
import { UNIT_DEFINITIONS } from "../units.ts";
import { ink, segment, stamp } from "./stamps.ts";

const robe = [
  ".......KKKKKKKK.....","......KSSIIIIIISK...","......KSIIhhhWSmK...",".....KSIWIchIWISmK..",".....KSIWdcchIWISK..",
  "....KSIISdccchWISK..","....KSIIcdccchIISmK.","...KSIIcddccchIWISmK","..KSIIcddcchhIWIIISmK",
  ".KSIIcdddcchIWIIIISmK","KSIISddddchIWSIIIISmK","KSSSmddcchISSSSSmmKK.",".KKKmmSSSmmKKKKK....","....KKKKKK..........",
];
const tiara = [
  "..K...K.....K......","..Ka.KaK...KaK.....","..KIKSIK..KISK.....","..KIIWIIKKIISKK....","...KjSIWIWWISSK....",
  "...KjajSSWIIISmK...","..KSIWWIIIIIIISmK..",".KSIWIWWISIIIIISmK.","KSIWIIISIKSSIIIISK.",
  "KSIIISSSKfKrrSIISK.","KSISKKffffFFFfWISK.","KSSIKffFFFFFffISjK.","KjSISfffFFFffSSIjmK",
  ".KSISmffrrrffSIImK.",".KSIISKfFFFfKSIISK.","..KSIKmKKKKKjISISmK","...KSIK.....KSIISK.","....KK.......KKKK..",
];
const shard = ["...K...","..KIK..",".KIWaK.","KIWWajK",".KajSK.","..KjK..","...K..."];
const droneBody = [
  "....KKKKKKKKKK....","..KKmSIIhhhhccKK..",".KmcchhhcccccccmK.","KmccchcccKKKKccmSK",
  "KdcccccKKIaaIKdSmK","KddcddcKaaIKIKdSmK",".KmdddcKjaaajKdSK.","..KKmmddKKKKKSmK..","....KKSmSSSmmKK...","......KKKKKKK.....",
];
const base = [
  "...KKKKKKKKKKKK...","..KSSIIIIIIIIIISK.",".KSISmSSISmmSSSmSK","KISSmSKcccSKmSSSmK",
  "KSSmmmKchcKmmmmmmK","KmmmmSKchcKmmSmmmK",".KmmmmmcdKmmmmmmK.",".KKKKKKKKKKKKKKKK.",
];
const jewel = [
  ".......K.......","......KIK......",".....KWaSK.....","....KIWaSmK....","...KIWWaSSmK...",
  "..KIWWWaaSSmK..",".KIIWWWaaSSmmK.","KIIIIWWaaSSmmmK","KjSSSIIaaaSSSmK",".KjjjSIdcccSmK.",
  "..KjjjSddccmK..","...KjjjdddSK...","....KjjddSK....",".....KjjmK.....","......KmK......",".......K.......",
];
export function frostRoyal(c: Pens, team: Team, p: CharacterPose, u: Unit|undefined, tick: number) {
  const cast=eventFade(tick,u?.lastAttackTick,19), sway=Math.sin((tick+(u?.id??0)*17)*.061);
  const float=Math.round(-2-1.3*sway-p.pace);
  c.save(); c.translate(Math.round(cast*2-p.ready),float);
  const tip=13+Math.round(cast*5), staffY=-22+Math.round(cast*4-p.ready*3);
  segment(c,10,8,tip,staffY,ink,2); segment(c,11,7,tip+1,staffY,"#74d0ce");
  stamp(c,team,shard,tip-2,staffY-4);
  stamp(c,team,robe,-13, -3);
  stamp(c,team,tiara,-8, -19+Math.round(p.ready));
  c.fillStyle=ink; c.fillRect(2,-8+Math.round(p.ready),3,p.blink>.5||p.ready>.7?1:2);
  c.fillStyle="#fff5db"; c.fillRect(2,-8+Math.round(p.ready),1,1);
  segment(c,4,-2,tip-2,-5-cast*3,ARMIES[team].light,3);
  c.restore();
}
export function clockworkDrone(c: Pens, team: Team, p: CharacterPose, u: Unit|undefined, tick: number) {
  const time=tick+(u?.id??0)*13, grounded=tick<(u?.groundedUntil??0);
  const shot=u?.nextBurstTick===undefined ? u?.lastAttackTick : u.nextBurstTick-UNIT_DEFINITIONS.drone.burstGap;
  const kick=eventFade(tick,shot,6), float=grounded?1:Math.round(-4-2*Math.sin(time*.088));
  c.save(); c.translate(-Math.round(kick*3),float);
  for (const side of [-1,1]) {
    const x=side*9, y=-7+Math.round(side*p.pace);
    segment(c,side*4,-3,x,y,ink,2);
    const blade=Math.round(2+5*Math.abs(Math.cos(time*(grounded?.1:.36)+side*.7)));
    segment(c,x-blade,y-2,x+blade,y-2,ink,2); segment(c,x,y-2,x+blade-1,y-2,"#91acb4");
    c.fillStyle="#ffc660"; c.fillRect(x,y-2,2,2);
  }
  stamp(c,team,droneBody,-9,-5);
  segment(c,1,4,9-kick*3,4+p.pitch*4,ink,2);
  segment(c,2,4,8-kick*3,4+p.pitch*4,"#91acb4");
  c.restore();
}
export function prismSpire(c: Pens, team: Team, u: Unit|undefined, tick: number) {
  const age=u?.targetId!=null && u.focusSince!==undefined ? tick-u.focusSince : -1;
  const focus=age>=0?crystalFocus(age):0;
  const lift=u?crystalLift(tick,u.id,focus):0;
  stamp(c,team,base,-9,1);
  for (const side of [-1,1]) {
    segment(c,side*5,1,side*9,-5-lift,ink,2);
    segment(c,side*9,-5-lift,side*(11-focus),-11-lift,ink,2);
    segment(c,side*5+1,0,side*9+1,-5-lift,"#bd7746");
  }
  stamp(c,team,jewel,-7,-19-lift);
  if (age>=0) {
    const reach=1+Math.round(focus*3), y=Math.round(-11.2-lift);
    segment(c,-reach,y,reach,y,"#fff2c4"); segment(c,0,y-reach,0,y+reach,"#fff2c4");
  }
}
