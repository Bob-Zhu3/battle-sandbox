import { randomUUID } from "node:crypto";
import { SPELLS, spellKind } from "../src/spells.ts";
import { BRUSH_SPACING, type ArenaPoint } from "../src/deployment.ts";
import { Battle, battleOutcome, createBattle, stepBattle, TICKS_PER_SECOND, ARENA, type Outcome, type Placement, type Team } from "../src/simulation.ts";
import { type Joined, type PlacementAck, type RoomPhase, type Seat, type Snapshot } from "../src/room-protocol.ts";

import { campFor, inCamp, makeBase, COUNTDOWN_TICKS, GOLD_PER_SECOND, MATCHES, STARTING_GOLD, type MatchMode } from "../src/battlefield.ts";
import { UNIT_DEFINITIONS, placementKind } from "../src/units.ts";

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface Stroke { team: Team; units: Placement[] }
interface Receipt { ack: PlacementAck; type: string; points: readonly ArenaPoint[] }
interface Player { token: string; receipts: Map<number, Receipt> }

export class Room {
  round = 1;
  phase: RoomPhase = "deploy";
  countdownTicks = 0;
  readonly mode: MatchMode;
  readonly sides: readonly Team[];
  readonly seats: Partial<Record<Team, Seat>> = {};
  readonly gold: Partial<Record<Team, number>> = {};
  world = createBattle([]);
  outcome: Outcome | null = null;
  private players: Partial<Record<Team, Player>> = {};
  private strokes: Stroke[] = [];
  private nextId = 1;

  constructor(mode: MatchMode = "duel") {
    this.mode = mode;
    this.sides = MATCHES[mode].teams;
    for (const team of this.sides) {
      this.seats[team] = { connected: false, reserved: false, ready: false };
      this.gold[team] = STARTING_GOLD;
    }
  }

  private startWhenReady() {
    const roster = this.sides.filter(team => this.players[team]);
    if (this.phase === "deploy" && roster.length >= MATCHES[this.mode].minimum &&
        roster.every(team => this.seats[team]!.connected && this.seats[team]!.ready)) {
      this.countdownTicks = COUNTDOWN_TICKS;
      this.phase = "countdown";
    }
  }

  join(resumeToken?: string, remembered: readonly string[] = []): Joined | undefined {
    const sides = this.sides;
    // A fresh tab can reclaim a remembered, disconnected seat without displacing a live tab.
    const team = resumeToken !== undefined ? sides.find(side => this.players[side]?.token === resumeToken)
      : sides.find(side => this.seats[side]!.reserved && remembered.some(token => this.players[side]?.token === token))
        ?? (this.phase === "deploy" ? sides.find(side => !this.players[side]) : undefined);
    if (!team) return;
    const isNew = !this.players[team];
    const player = this.players[team] ??= { token: randomUUID(), receipts: new Map() };
    this.seats[team]!.connected = true;
    this.seats[team]!.reserved = false;
    if (isNew) this.rebuild();
    this.startWhenReady();
    return { type: "joined", team, resumeToken: player.token };
  }

  disconnect(team: Team) {
    this.seats[team]!.connected = false;
    this.seats[team]!.reserved = true;
  }

  leave(team: Team) {
    delete this.players[team];
    this.seats[team]!.connected = this.seats[team]!.reserved = false;
    const occupied = this.sides.some(side => this.players[side]);
    // Once combat starts, a departing player leaves their base and army on the field.
    if (occupied && (this.phase === "running" || this.phase === "finished")) return;
    this.strokes = occupied ? this.strokes.filter(stroke => stroke.team !== team) : [];
    if (!occupied) this.nextId = 1;
    this.resetRound();
  }

  private rebuild() {
    const placements = this.strokes.flatMap(stroke => stroke.units);
    for (const team of this.sides) this.gold[team] = STARTING_GOLD;
    for (const unit of placements) this.gold[unit.team]! -= UNIT_DEFINITIONS[unit.kind ?? "warrior"].cost;
    this.world = createBattle(placements);
    this.world.bases = this.sides.filter(team => this.players[team]).map(team => makeBase(this.mode, team));
  }

  private resetRound() {
    this.round++;
    this.countdownTicks = 0;
    this.phase = "deploy";
    this.outcome = null;
    for (const team of this.sides) this.seats[team]!.ready = false;
    for (const player of Object.values(this.players)) player.receipts.clear();
    this.rebuild();
  }

  private editProblem(team: Team) {
    if (this.phase !== "deploy") return "Deployment has ended.";
    if (this.seats[team]!.ready) return "Your formation is already ready.";
  }

  place(team: Team, round: number, commandId: number, action: unknown): string | { ack: PlacementAck; fresh: boolean } {
    const player = this.players[team];
    if (!player || !this.seats[team]!.connected) return "Your seat is not connected.";
    if (round !== this.round) return "That round has ended.";
    if (!Number.isSafeInteger(commandId) || commandId < 1) return "Invalid placement command ID.";
    if (!record(action)) return "Unknown placement command.";
    const kind = placementKind(action.type);
    const spell = spellKind(action.type);
    if (!kind && !spell) return "Unknown placement command.";
    const points = action.positions;
    if (!Array.isArray(points) || !points.length) return "A stroke needs at least one position.";

    const saved = player.receipts.get(commandId);
    if (saved) {
      if (saved.type !== (spell ? SPELLS[spell].command : UNIT_DEFINITIONS[kind!].command) || saved.points.length !== points.length || !saved.points.every((unit, i) => {
        const point = points[i];
        return record(point) && unit.x === point.x && unit.y === point.y;
      })) return "That placement ID already belongs to a different stroke.";
      return { ack: saved.ack, fresh: false };
    }

    const live = this.phase === "running";
    if (live) {
      if (!this.world.bases?.some(base => base.team === team && base.hp > 0)) return "Your base has fallen.";
    } else {
      const problem = this.editProblem(team);
      if (problem) return problem;
    }
    if (spell) {
      if (!live) return "Spells unlock when battle begins.";
      if (points.length !== 1) return "Choose one spot for the spell.";
      const point = points[0];
      if (!record(point) || typeof point.x !== "number" || typeof point.y !== "number" ||
          !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 ||
          point.x > ARENA.width || point.y > ARENA.height) return "Choose a spot inside the arena.";
      const price = SPELLS[spell].cost;
      if (price > this.gold[team]!) return "This spell costs " + price + " gold. You have " + this.gold[team] + ".";
      const { x, y } = point;
      const id = this.nextId++;
      const cast = { id, kind: spell, team, x, y, startTick: this.world.tick };
      const ack: PlacementAck = { type: "placement-ack", round, commandId, unitIds: [], spellId: id };
      this.gold[team]! -= price;
      this.world = new Battle(this.world.tick, this.world.units, this.world.arrows, this.world.bases, [...(this.world.spells ?? []), cast], this.world.effects);
      player.receipts.set(commandId, { ack, type: SPELLS[spell].command, points: [{x, y}] });
      return { ack, fresh: true };
    }
    if (!kind) return "Unknown placement command.";
    const price = points.length * UNIT_DEFINITIONS[kind].cost;
    const remaining = this.gold[team]!;
    if (price > remaining) return "This stroke costs " + price + " gold. You have " + remaining + ".";
    const units: Placement[] = [];
    for (const point of points) {
      if (!record(point) || typeof point.x !== "number" || typeof point.y !== "number" ||
          !Number.isFinite(point.x) || !Number.isFinite(point.y)) return "Use finite arena coordinates.";
      const { x, y } = point;
      if (x < 0 || x > ARENA.width || y < 0 || y > ARENA.height) return "Keep the stroke inside the arena.";
      if (!inCamp(this.mode, team, x, y)) return "Keep the whole stroke in your " + campFor(this.mode, team).label + ".";
      const last = units.at(-1);
      if (last && Math.hypot(x - last.x, y - last.y) > BRUSH_SPACING + 0.00001) return "A squad must be one continuous stroke.";
      units.push({ x, y, team, kind, id: this.nextId + units.length });
    }
    const stroke = { team, units };
    const ack: PlacementAck = { type: "placement-ack", round, commandId, unitIds: units.map(unit => unit.id) };
    this.nextId += units.length;
    player.receipts.set(commandId, { ack, type: UNIT_DEFINITIONS[kind].command, points: units });
    if (live) {
      this.gold[team]! -= price;
      const recruits = createBattle(units).units;
      this.world = new Battle(this.world.tick, [...this.world.units, ...recruits], this.world.arrows, this.world.bases, this.world.spells, this.world.effects);
    } else {
      this.strokes.push(stroke);
      this.rebuild();
    }
    return { ack, fresh: true };
  }

  control(team: Team, action: unknown): string | undefined {
    if (!this.seats[team]?.connected) return "Your seat is not connected.";
    if (!record(action)) return "Unknown room command.";
    if (action.type === "new-round" && this.phase === "finished") {
      this.strokes = [];
      this.resetRound();
      return;
    }
    const problem = this.editProblem(team);
    if (problem) return problem;
    const hasSquad = this.strokes.some(stroke => stroke.team === team);
    switch (action.type) {
      case "ready":
        if (!hasSquad) return "Place a squad before pressing Ready.";
        this.seats[team]!.ready = true;
        this.startWhenReady();
        return;
      case "undo":
      case "clear":
        if (!hasSquad) return "Your field is empty.";
        if (action.type === "clear") this.strokes = this.strokes.filter(stroke => stroke.team !== team);
        else this.strokes.splice(this.strokes.map(stroke => stroke.team).lastIndexOf(team), 1);
        this.rebuild();
        return;
      default: return "Unknown room command.";
    }
  }

  advance(): boolean {
    if (this.phase === "countdown") {
      this.countdownTicks--;
      if (!this.countdownTicks) this.phase = "running";
      return this.countdownTicks % TICKS_PER_SECOND === 0;
    }
    if (this.phase !== "running") return false;
    const previous = this.world;
    this.world = stepBattle(previous);
    let paid = false;
    for (const [index, unit] of this.world.units.entries()) {
      if (!unit.killedBy || unit.hp > 0 || (previous.units[index]?.hp ?? 0) <= 0) continue;
      this.gold[unit.killedBy]! += UNIT_DEFINITIONS[unit.kind].bounty;
      paid = true;
    }
    if (this.world.tick % TICKS_PER_SECOND === 0) {
      for (const base of this.world.bases!) if (base.hp > 0) this.gold[base.team]! += GOLD_PER_SECOND;
      paid = true;
    }
    this.outcome = battleOutcome(this.world);
    if (this.outcome !== null) this.phase = "finished";
    return paid || this.outcome !== null;
  }

  snapshot(revision: number): Snapshot {
    const seats: Snapshot["seats"] = {};
    for (const team of this.sides) seats[team] = { ...this.seats[team]! };
    return { type: "snapshot", mode: this.mode, countdown: Math.ceil(this.countdownTicks / TICKS_PER_SECOND), round: this.round, revision, phase: this.phase, seats, gold: { ...this.gold }, world: this.world, outcome: this.outcome };
  }
}
