import { phoenixFlight, type CharacterPose } from "../character-pose.ts";
import type { Team, Unit } from "../simulation.ts";
import type { Pens } from "../ink.ts";
import { UNIT_DEFINITIONS } from "../units.ts";
import { ink, segment, stamp } from "./stamps.ts";

// Separate pinions fold through three silhouettes. Long tail streamers lag behind the body.
const wingHigh = [
  "K................", "KRK..............","KROK...K.........",".KRYK..ROK.......",".KROYK.KRYK..K...",
  "..KROOKKOYYKROK..","..KRROOYOOYYOYK..","...KvROOYYYYYOK..","...KvRRROYYYOK...",
  "....KvcRROOOK....",".....KdcccOK.....","......KdhhK......",".......KKK.......",
];
const wingLevel = [
  "KK.................","KRYKK..............",".KOOYKKKK..........","..KRROYYYKKKK......",
  "...KRRROOYYYYKK....","....KvRRROOYYYYKK..","....KRRROOOYOOOOK..","......KvRROOdhhcK..","........KKKcddcK...","............KKK....",
];
const wingLow = [
  "........KcccKK...","......KKchhhhK...","....KKcROYYOdK...","...KvRROYYYYOK...",
  "..KvROYYYYYOK....","..KRROYYOOYK.....",".KRROOYKRROK.....",".KROOOK.KRK......",
  "KROOK...KK.......","KROK.............","KRK..............","KK...............",
];
const body = [
  "...................KK...","..................KYK.K.",".................KYOOKK.","................KYYOYOK.",
  "...............KYYOOYOK.",".............KROYYKKYYK.","..........KKKROYYKWWKYKK",".........KROOYYYFFfKyyyy",
  "......KKKROYYYYYYFFK..KK","...KKKccROYYYcccYOK.....","KKKvvROORROchhhcOK......",
  "KRRRROOORRccchccK.......",".KKRRROORccccddK........","...KKKROOddddKK.........","......KKKKKKK...........",
];
const egg = [
  ".....KKK.....","....KYOOK....","...KYYYROK...","..KOYORROvK..","..KOORYRRvK..",
  ".KROORROORvK.",".KvORRROORvK.","KvRROOORRRvvK","KvRROORRRvvvK","KvvRROORvvvmK",
  ".KvvRROvvvmK.","..KvvROvvmK..","...KKKKKKK...",
];
export function firebird(c: Pens, team: Team, p: CharacterPose, unit: Unit|undefined, tick: number) {
  if (unit?.emberUntil !== undefined) {
    const hatch=1-Math.min(1,(unit.emberUntil-tick)/UNIT_DEFINITIONS.phoenix.hatchTicks);
    const rock=Math.round(hatch*hatch*2*Math.sin(tick*.43));
    segment(c,-8,7,7,7,"#684856",2); stamp(c,team,egg,-6+rock,-6);
    if (hatch>.32) segment(c,rock-1,3,rock+2,-1,"#ffc660");
    if (hatch>.67) segment(c,rock+2,-1,rock,-3,"#fff2c4");
    const rise=Math.floor((tick+unit.id)%11);
    c.fillStyle=rise<6?"#ff793d":"#ffc660"; c.fillRect(rise<6?-2:1,-4-rise,2,2);
    return;
  }
  const flight=phoenixFlight(unit,p,tick);
  const beat=unit?flight.wing:.85;
  const lift=Math.round(flight.height), dive=Math.round(flight.talons*3);
  c.save(); c.translate(dive,-lift);
  const wing=beat>.36?wingHigh:beat<-.28?wingLow:wingLevel;
  const wy=(beat>.36?-16:beat<-.28?-4:-11)-Math.round(2*beat);
  stamp(c,team,wing,-9,wy-3);
  for (let i=0;i<3;i++) {
    const bend=Math.round(flight.tail*(3+i)), tip=Math.round(flight.tailTip*(4+i));
    const endX=-23+i*3, endY=-2+i*3;
    segment(c,-3,0,-13,endY+bend,ink,3); segment(c,-13,endY+bend,endX,endY+tip,ink,2);
    segment(c,-3,0,-13,endY+bend,i===1?"#ffc660":"#ff793d",2);
    segment(c,-13,endY+bend,endX,endY+tip,i===1?"#ffc660":"#c43b45");
  }
  for (const x of [-1,3]) {
    segment(c,x,2,x+dive,5+dive,ink,2);
    segment(c,x+dive+1,5+dive,x+dive+3,4+dive,"#bd7746");
  }
  stamp(c,team,body,-11,-12-dive);
  stamp(c,team,wing,-12,wy);
  if (flight.takeoff>.1) {
    const spread=Math.round(9*(1-flight.takeoff));
    c.fillStyle="#ffc660"; c.fillRect(-10-spread,8+spread,2,2); c.fillRect(5+spread,7+spread,2,2);
  }
  c.restore();
}
