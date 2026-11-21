import { BASE_RADIUS } from "./battlefield.ts";
import { disabledUntil, interrupt, stun, type Hit } from "./conditions.ts";
import type { Target, Unit } from "./simulation.ts";
import { insideSpell, SPELLS, type FieldSpell } from "./spells.ts";
import { exposed } from "./targeting.ts";
import { isBuilding } from "./units.ts";

// Called on the opening snapshot's working copies, before windups or attacks can finish.
export function strikeField(spell: FieldSpell, targets: readonly Target[], tick: number, hit: Hit) {
  if (spell.kind !== "freeze" && spell.kind !== "lightning") return;
  const seen = targets.filter(t => t.team !== spell.team && exposed(t) && insideSpell(spell,t,t.kind === "base" ? BASE_RADIUS : 0));
  if (spell.kind === "freeze") {
    for (const target of seen) {
      const base = target.kind === "base";
      if (!base && tick >= (target.frozenUntil ?? 0)) target.frozenAt = tick;
      target.frozenUntil = Math.max(target.frozenUntil ?? 0,tick+(base ? SPELLS.freeze.baseHold : SPELLS.freeze.hold));
      if (!base) { delete target.burn; interrupt(target); }
    }
    return;
  }
  const distance = (t: Target) => (t.x-spell.x)**2+(t.y-spell.y)**2;
  seen.sort((a,b) => b.hp-a.hp || distance(a)-distance(b) || a.id-b.id);
  const struck = seen.slice(0,SPELLS.lightning.targets);
  spell.strikes = struck.map(({id,x,y}) => ({id,x,y}));
  for (const target of struck) {
    const until = tick+SPELLS.lightning.stunTicks;
    if (target.kind === "base") target.stunnedUntil = Math.max(target.stunnedUntil ?? 0,until);
    else stun(target,until);
    hit(target,target.kind === "base" ? SPELLS.lightning.baseDamage : SPELLS.lightning.damage,spell.team);
  }
}

export function applyRage(unit: Unit, rings: readonly FieldSpell[], tick: number) {
  if (unit.tunnel || unit.emberUntil !== undefined || isBuilding(unit.kind) || !rings.some(s => s.team === unit.team && insideSpell(s,unit))) {
    delete unit.raging;
    return;
  }
  unit.raging = true;
  // Each two ticks inside the field earn one extra tick of recovery. Leaving preserves time already earned.
  if (!(tick % 2) && unit.nextAttackTick > tick && tick >= disabledUntil(unit)) unit.nextAttackTick--;
}
