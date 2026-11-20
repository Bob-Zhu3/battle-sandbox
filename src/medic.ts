import type { Unit, Target } from "./simulation.ts";
import { isMachine, UNIT_DEFINITIONS } from "./units.ts";

const kit = UNIT_DEFINITIONS.medic;

export function medicDuty(medic: Unit, units: readonly Unit[], enemy: Target | undefined, tick: number) {
  let patient: Unit | undefined, escort: Unit | undefined;
  let patientDistance: number = kit.sight ** 2, escortDistance = Infinity;
  for (const ally of units) {
    if (ally.team !== medic.team || ally.id === medic.id || ally.hp <= 0) continue;
    const distance = (ally.x - medic.x) ** 2 + (ally.y - medic.y) ** 2;
    if (ally.kind !== "medic" && ally.kind !== "workshop" && ally.kind !== "post" && (distance < escortDistance || (distance === escortDistance && ally.id < escort!.id))) {
      escort = ally;
      escortDistance = distance;
    }
    if (isMachine(ally.kind) !== (medic.kind === "engineer") || ally.emberUntil !== undefined || tick < (medic.aidReadyTick ?? 0) || ally.hp >= UNIT_DEFINITIONS[ally.kind].maxHp || distance > kit.sight ** 2) continue;
    if (medic.wrappingSince !== undefined && ally.id === medic.targetId) {
      patient = ally;
      break;
    }
    if (distance < patientDistance || (distance === patientDistance && (!patient || ally.id < patient.id))) {
      patient = ally;
      patientDistance = distance;
    }
  }
  if (patient) return { ally: patient, x: patient.x, y: patient.y, stopAt: kit.aidReach - 3, treating: true };
  if (medic.kind === "engineer" || !enemy || !escort || Math.hypot(enemy.x - medic.x, enemy.y - medic.y) <= kit.reach) return;
  const dx = enemy.x - escort.x, dy = enemy.y - escort.y;
  const distance = Math.hypot(dx, dy) || 1;
  return { ally: escort, x: escort.x - kit.escortGap * dx / distance, y: escort.y - kit.escortGap * dy / distance,
    stopAt: 2, treating: false };
}

// Check the medic and patient after all simultaneous damage and base losses.
// Completed wraps are collected first so two medics finishing together see
// the same patient and cannot depend on unit array order.
export function finishTreatments(units: Unit[], byId: ReadonlyMap<number, Unit>, tick: number, healing: Map<number, number>) {
  for (const medic of units) {
    if (medic.kind !== "medic" && medic.kind !== "engineer") continue;
    if (medic.lastHitTick === tick) {
      delete medic.wrappingSince;
      medic.aidReadyTick = Math.max(medic.aidReadyTick ?? 0, tick + kit.flinchTicks);
    }
    if (medic.hp <= 0 || medic.wrappingSince === undefined) continue;
    const patient = medic.targetId === null ? undefined : byId.get(medic.targetId);
    if (!patient || patient.hp <= 0 || patient.emberUntil !== undefined || Math.hypot(patient.x - medic.x, patient.y - medic.y) > kit.aidReach + 0.001) {
      delete medic.wrappingSince;
      continue;
    }
    if (tick - medic.wrappingSince < kit.wrapTicks) continue;
    delete medic.wrappingSince;
    if (patient.hp >= UNIT_DEFINITIONS[patient.kind].maxHp) continue;
    medic.lastHealTick = tick;
    medic.aidReadyTick = tick + kit.recoveryTicks;
    healing.set(patient.id, (healing.get(patient.id) ?? 0) + kit.aidAmount);
  }
  for (const [id, amount] of healing) {
    const patient = byId.get(id)!;
    if (patient.hp <= 0 || patient.emberUntil !== undefined || patient.hp >= UNIT_DEFINITIONS[patient.kind].maxHp) continue;
    patient.hp = Math.min(UNIT_DEFINITIONS[patient.kind].maxHp, patient.hp + amount);
    patient.lastTreatedTick = tick;
  }
}
