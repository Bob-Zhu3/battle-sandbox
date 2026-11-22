import { circleEntry, projectileContacts, type Arrow } from "./arrows.ts";
import type { Target } from "./simulation.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";
import type { FanContact } from "./windmill.ts";

// Catch arrows where they enter the rim. A defender standing in front of the rim can still take the hit.
export function reflectAtWards(shots: readonly Arrow[], wards: FieldSpell[], from: readonly Target[], to: readonly Target[], tick: number, fans?: ReadonlyMap<Arrow,FanContact>) {
  const turned = new Map<Arrow,Arrow>();
  if (!wards.length) return turned;
  const crossings: {shot: Arrow; ward: FieldSpell; time: number}[] = [];
  const {radius,panes} = SPELLS.mirror;
  for (const shot of shots) {
    if (shot.reflectedTick !== undefined || (shot.kind !== undefined && shot.kind !== "dart" && shot.kind !== "bolt")) continue;
    let firstBody: number | undefined;
    for (const ward of wards) {
      if (shot.team === ward.team || (ward.reflection?.count ?? 0) >= panes) continue;
      const x = shot.x-ward.x, y = shot.y-ward.y;
      if (x*x+y*y < radius*radius || x*shot.vx+y*shot.vy >= 0) continue;
      const time = circleEntry(x,y,shot.vx,shot.vy,radius);
      if (time === undefined) continue;
      firstBody ??= Math.min(projectileContacts(shot,from,to)[0]?.time ?? Infinity,fans?.get(shot)?.time ?? Infinity);
      if (time <= firstBody) crossings.push({shot,ward,time});
    }
  }
  // When the last pane has two claimants, the actual crossing time wins, then stable spell and shooter IDs.
  crossings.sort((a,b)=>a.time-b.time || a.ward.id-b.ward.id || a.shot.releasedTick-b.shot.releasedTick ||
    (a.shot.casterId ?? 0)-(b.shot.casterId ?? 0) || a.shot.x-b.shot.x || a.shot.y-b.shot.y ||
    a.shot.vx-b.shot.vx || a.shot.vy-b.shot.vy);
  for (const {shot,ward,time} of crossings) {
    const count = ward.reflection?.count ?? 0;
    if (turned.has(shot) || count >= panes) continue;
    const x = shot.x+time*shot.vx, y = shot.y+time*shot.vy;
    ward.reflection = {count:count+1,tick,x,y};
    const returned = {...shot, x,y, team:ward.team, vx:-shot.vx, vy:-shot.vy, reflectedTick:tick, releasedTick:tick};
    delete returned.casterId;
    turned.set(shot,returned);
  }
  return turned;
}
