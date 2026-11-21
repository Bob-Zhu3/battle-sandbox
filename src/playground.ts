import { Battle, createBattle, stepBattle, type Team } from "./simulation.ts";
import { type SpellKind } from "./spells.ts";
import { placementKind } from "./units.ts";
import type { PlacementCommand } from "./deployment.ts";

export class Playground {
  world = createBattle([]);
  private nextId = 1;
  private strokes: number[][] = [];
  private resting = false;

  get canUndo() { return this.strokes.length > 0; }

  place(team: Team, command: PlacementCommand, extendStroke = false) {
    if (!command.positions.length) return;
    const kind = placementKind(command.type);
    const recruits = createBattle(command.positions.map(point => ({ ...point, team, kind, id: this.nextId++ })), this.world.tick).units;
    const ids = recruits.map(unit => unit.id);
    const stroke = extendStroke ? this.strokes.at(-1) : undefined;
    if (stroke) stroke.push(...ids);
    else this.strokes.push(ids);
    this.world = new Battle(this.world.tick, [...this.world.units, ...recruits], this.world.arrows, undefined, this.world.spells, this.world.effects);
    this.resting = false;
  }

  cast(team: Team, kind: SpellKind, x: number, y: number) {
    const id = this.nextId++;
    const spell = {id, kind, team, x, y, startTick: this.world.tick};
    this.strokes.push([id]);
    this.world = new Battle(this.world.tick, this.world.units, this.world.arrows, undefined, [...(this.world.spells ?? []), spell], this.world.effects);
    this.resting = false;
  }

  undo() {
    const ids = new Set(this.strokes.pop());
    this.world = new Battle(this.world.tick, this.world.units.filter(u => !ids.has(u.id) && !(u.makerId !== undefined && ids.has(u.makerId))), this.world.arrows,
      undefined, this.world.spells?.filter(spell => !ids.has(spell.id)), this.world.effects);
    this.resting = false;
  }

  clear() {
    this.world = createBattle([]);
    this.strokes = [];
    this.nextId = 1;
    this.resting = false;
  }

  advance() {
    const from = this.world;
    if (!from.units.length && !from.arrows.length && !from.spells?.length && !from.effects?.length) return;
    // A quiet field needs only the clock for breathing and blinks. Placing a
    // squad wakes the simulation, including separation of coincident allies.
    if (this.resting) {
      this.world = new Battle(from.tick + 1, from.units, from.arrows);
      return;
    }
    const next = stepBattle(from);
    const units = next.units.filter(u => u.hp > 0 || next.tick - (u.lastHitTick ?? next.tick) < 48);
    this.world = new Battle(next.tick, units, next.arrows, undefined, next.spells, next.effects);
    this.resting = !next.spells?.length && !next.effects?.length && !next.arrows.length && units.every(u =>
      u.hp > 0 && u.targetId === null && u.pace < .001 && u.emberUntil === undefined &&
      !u.windup && !u.burstLeft && !u.burn && !u.poison && !u.hex && !u.tunnel && !u.trail && !u.knockback &&
      (u.aidReadyTick ?? 0) <= next.tick && (u.rootedUntil ?? 0) <= next.tick &&
      (u.stunnedUntil ?? 0) <= next.tick && (u.fogUntil ?? 0) <= next.tick && (u.frozenUntil ?? 0) <= next.tick && !u.raging);
  }
}
