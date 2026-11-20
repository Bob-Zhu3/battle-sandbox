import { Battle, createBattle, stepBattle, type Team } from "./simulation.ts";
import type { PlacementCommand } from "./deployment.ts";

export class Playground {
  world = createBattle([]);
  private nextId = 1;
  private strokes: number[][] = [];
  private resting = false;

  get canUndo() { return this.strokes.length > 0; }

  place(team: Team, command: PlacementCommand, extendStroke = false) {
    if (!command.positions.length) return;
    const kind = command.type === "place-archers" ? "archer" : "warrior";
    const recruits = createBattle(command.positions.map(point => ({ ...point, team, kind, id: this.nextId++ }))).units;
    const ids = recruits.map(unit => unit.id);
    const stroke = extendStroke ? this.strokes.at(-1) : undefined;
    if (stroke) stroke.push(...ids);
    else this.strokes.push(ids);
    this.world = new Battle(this.world.tick, [...this.world.units, ...recruits], this.world.arrows);
    this.resting = false;
  }

  undo() {
    const ids = new Set(this.strokes.pop());
    this.world = new Battle(this.world.tick, this.world.units.filter(u => !ids.has(u.id)), this.world.arrows);
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
    if (!from.units.length && !from.arrows.length) return;
    // A quiet field needs only the clock for breathing and blinks. Placing a
    // squad wakes the simulation, including separation of coincident allies.
    if (this.resting) {
      this.world = new Battle(from.tick + 1, from.units, from.arrows);
      return;
    }
    const next = stepBattle(from);
    const units = next.units.filter(u => u.hp > 0 || next.tick - (u.lastHitTick ?? next.tick) < 48);
    this.world = new Battle(next.tick, units, next.arrows);
    this.resting = !next.arrows.length && units.every(u => u.hp > 0 && u.targetId === null && u.pace < .001);
  }
}
