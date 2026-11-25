import { eventFade, type CharacterPose } from "./character-pose.ts";
import { INK, WOOD, cut, limb, line, oval, type Dye, type Pens } from "./ink.ts";
import type { Target, Unit } from "./simulation.ts";
import { isBuilding, UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

const brass = "#e5af59", bronze = "#95653e", stone = "#b0b3a0", shade = "#7c887c";

export const TOWER_ART_SCALE = 1.2;
const spriteSize: Partial<Record<UnitKind,number>> = {
  bomber:.90, monk:.75, warrior:1.22, archer:1.22, shieldbearer:1.16, medic:1.2, lancer:1.18,
  musketeer:1.18, phoenix:1.2, frostqueen:1.22, drone:1.08,
};
export function unitArtScale(kind: UnitKind | "base") {
  return kind === "base" || isBuilding(kind) ? TOWER_ART_SCALE : spriteSize[kind] ?? 1;
}

function plinth(c: Pens, d: Dye) {
  cut(c,"M-10 3 Q-8.8 1.4 -6 1.5 L7 1.5 Q9.6 2.1 10.3 4 L10.7 7.1 Q10.1 8.8 7.4 8.8 L-8.3 8.8 Q-10.7 8.4 -10.7 6.8Z",stone);
  cut(c,"M-9.9 5.8 Q0 7.2 10 5.5 L10 7.2 Q8 9 -8 8 Q-10 8 -9.9 5.8Z",shade,0);
  cut(c,"M-3.4 2.3 L3.6 2.3 L3.4 7.1 L.4 8.7 L-3.1 7.2Z",d.coat,.85);
}

export function stoneLobber(c: Pens, d: Dye, p: CharacterPose, u: Unit|undefined, tick: number) {
  const release = eventFade(tick,u?.lastAttackTick,33);
  plinth(c,d);
  limb(c,-8,4,-2,-7,"#8d673e",3.2); limb(c,7,4,1,-7,WOOD,3.1);
  c.save(); c.translate(0,-6); c.rotate(1.25*release-.12*p.ready);
  limb(c,-11,-2.6,8,2.2,WOOD,2.7);
  cut(c,"M4 1 Q6 -1 10 1 L10.8 5.5 Q7.4 7.2 4.7 5.2Z",shade,1.1);
  if(release<.52) {
    cut(c,"M-14.1 -4.2 Q-13.9 -7.8 -10.8 -8.1 Q-8.1 -8.1 -7.7 -5.2 L-8.7 -2.5 L-12 -2.3Z","#8e9690",1);
    line(c,-12.7,-5.7,-10.8,-6.7,"#d3d4b9",1.1);
  }
  cut(c,"M-15 -4.6 Q-11.3 -2.8 -7.6 -4 L-8.5 -1.4 Q-12 .3 -14.6 -1.9Z",d.hem,1);
  c.restore();
  cut(c,"M-7.4 4.2 L-2.8 -6.8 Q-.6 -9.1 1.6 -7.8 L4.5 4.4 L1.3 4.4 L-.9 -2.9 L-4.5 4.8Z",WOOD,1.2);
  oval(c,-.4,-6.1,2.4,2.4,INK); oval(c,-.5,-6.4,1.5,1.5,brass);
  line(c,6.7,2.5,7.7,-7.5,INK,1.15);
  cut(c,"M7.6 -7.5 Q10.4 -8.8 13 -7.4 L11 -5.3 L12 -4.4 Q9.2 -5.6 7.1 -4.5Z",d.coat,.85);
}

export function sunLens(c: Pens, d: Dye, p: CharacterPose, u: Unit|undefined, tick: number) {
  const fog = (u?.fogUntil ?? 0)>tick, focus = u?.focusSince;
  const tiers = focus === undefined || tick<focus || fog ? 0 : Math.min(3,1+Math.floor((tick-focus)/UNIT_DEFINITIONS.sunlens.tierTicks));
  const pulse = eventFade(tick,u?.beam?.tick,12);
  plinth(c,d);
  cut(c,"M-5.6 3 L-4.3 -4.4 L-1.9 -9.6 L2.3 -9.5 L4.6 -3.8 L5.6 3.1 Q1 5.1 -5.6 3Z",brass,1.25);
  cut(c,"M-4.35 -3 Q-.8 -1.5 4.4 -3 L5.1 .2 Q.2 2 -4.9 .3Z",d.coat,.8);
  c.save(); c.translate(.9,-11.6); c.rotate(-.12+p.pitch*.2+.09*Math.sin((tick+(u?.id??0)*11)*.043));
  for(const a of [-2.55,-1.64,-.72]){
    c.save();c.rotate(a);cut(c,"M6 -1.2 L9.8 0 L6 1.2Z",brass,1);c.restore();
  }
  oval(c,0,0,7.6,7.5,INK); oval(c,0,0,6.3,6.2,brass);
  oval(c,.65,-.25,4.8,5.15,fog?"#b9d4cd":tiers?"#ffbf55":"#e38847");
  cut(c,"M-2 -3.6 Q1.1 -5.4 3.4 -3.2 L1.1 -.6 L-2.8 .1Z",fog?"#f1f6e7":"#fff2b3",0);
  if(tiers) oval(c,1.5,.4,1.2+1.1*pulse,1.4+1.1*pulse,"#fffbd9");
  if(fog) {line(c,-2.5,1,2,.5,"#e8f7e6",1.2);oval(c,2.2,2.4,.8,1.3,"#70a6b2");}
  c.restore();
  for(let i=0;i<3;i++) oval(c,-3.2+i*3.2,2.5,1.2,1.1,i<tiers?"#fff2a1":bronze);
}

export function bellTower(c: Pens, d: Dye, u: Unit|undefined, tick: number) {
  const age = tick-(u?.lastAttackTick ?? -1000);
  const swing = age>=0 && age<36 ? Math.cos(age*.38)*.53*(1-age/36)**2 : .032*Math.sin((tick+(u?.id??0)*7)*.08);
  plinth(c,d);
  limb(c,-7.3,4,-6.7,-11.8,WOOD,2.6); limb(c,7.2,4,6.6,-11.8,"#bd8952",2.6);
  c.save();c.translate(0,-10.8);c.rotate(swing);
  line(c,0,1,-swing*3,10.1,INK,1.1); oval(c,-swing*3,10.5,1.8,1.85,brass);
  cut(c,"M-6.1 7.8 Q-4.35 6.6 -4.1 3.7 Q-3.9 .1 -1.5 -.5 Q0 -1.8 1.7 -.5 Q4.3 .2 4.3 4 Q4.4 6.5 6.1 7.8 Q6.8 9.2 4.6 9.5 Q-.6 10.6 -5.6 9.2 Q-6.9 8.7 -6.1 7.8Z",brass,1.15);
  cut(c,"M1.2 .4 Q3.7 1.2 3.6 4.7 Q3.7 7 5.1 8 Q2.4 8.7 .6 8.2 Q2.4 4.3 1.2 .4Z",bronze,0);
  line(c,-4.1,7.9,4.4,8.1,"#ffe197",.9); c.restore();
  cut(c,"M-10.2 -10.7 Q-7.1 -13.8 -2 -18.2 Q-.4 -19.4 1.3 -18.3 L10 -11.4 Q10.7 -10.2 8.9 -9.8 L-8.9 -9.4Z",d.coat,1.35);
  cut(c,"M.4 -17.7 L8 -11.2 L2.4 -11Z",d.hem,0);
  oval(c,-.35,-18.6,1.55,1.3,brass);
}

export function sunbeam(c: Pens, u: Unit, target: Target|undefined, tick: number, sx: number, sy: number) {
  if (!u.hp || u.focusSince === undefined || tick<u.focusSince || !target || (u.fogUntil??0)>tick) return;
  const k=Math.min(sx,sy), pulse=u.beam && u.beam.tick>=u.focusSince && tick>=u.beam.tick && tick-u.beam.tick<9 ? u.beam : undefined;
  const lensScale=k*TOWER_ART_SCALE*UNIT_DEFINITIONS.sunlens.radius/11;
  const fromX=u.x*sx+(u.aimX<0?-1:1)*.9*lensScale, fromY=u.y*sy-11.6*lensScale;
  const end=pulse ?? target, x=end.x*sx, y=end.y*sy-7*k*unitArtScale(target.kind);
  c.save();c.lineCap="round";
  if(pulse) {
    const strength=1-(tick-pulse.tick)/9; c.globalAlpha=strength;
    line(c,fromX,fromY,x,y,"#eb934b9c",(2.8+pulse.level*1.25)*k);
    line(c,fromX,fromY,x,y,"#fff3ae",(1+.49*pulse.level)*k);
    oval(c,x,y,(2+pulse.level)*k,(2+pulse.level)*k,"#fff9ce");
  } else {
    c.setLineDash([2*k,5*k]);c.globalAlpha=.52;
    line(c,fromX,fromY,x,y,"#c78843",1.25*k);
  }
  c.restore();
}
