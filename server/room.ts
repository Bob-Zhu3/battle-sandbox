import { randomUUID } from "node:crypto";
import { BRUSH_SPACING, teamAt } from "../src/deployment.ts";
import { battleOutcome, createBattle, stepBattle, ARENA, type Outcome, type Placement, type Team } from "../src/simulation.ts";
import { TEAM_LIMIT, type Joined, type PlacementAck, type RoomPhase, type Seat, type Snapshot } from "../src/room-protocol.ts";

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface Stroke { team: Team; units: Placement[] }
interface Receipt { ack: PlacementAck; stroke: Stroke }
interface Player { token: string; receipts: Map<number, Receipt> }

export class Room {
  round = 1;
  phase: RoomPhase = "deploy";
  seats: Record<Team, Seat> = {
    red: { connected: false, reserved: false, ready: false },
    blue: { connected: false, reserved: false, ready: false },
  };
  world = createBattle([]);
  outcome: Outcome | null = null;
  private players: Partial<Record<Team, Player>> = {};
  private strokes: Stroke[] = [];
  private nextId = 1;

  join(resumeToken?: string, remembered: readonly string[] = []): Joined | undefined {
    const sides = ["red", "blue"] as const;
    // A fresh tab can reclaim a remembered, disconnected seat without displacing a live tab.
    const team = resumeToken !== undefined ? sides.find(side => this.players[side]?.token === resumeToken)
      : sides.find(side => this.seats[side].reserved && remembered.some(token => this.players[side]?.token === token))
        ?? sides.find(side => !this.players[side]);
    if (!team) return;
    const player = this.players[team] ??= { token: randomUUID(), receipts: new Map() };
    this.seats[team].connected = true;
    this.seats[team].reserved = false;
    return { type: "joined", team, resumeToken: player.token };
  }

  disconnect(team: Team) {
    this.seats[team].connected = false;
    this.seats[team].reserved = true;
  }

  leave(team: Team) {
    delete this.players[team];
    this.seats[team].connected = this.seats[team].reserved = false;
    this.strokes = this.strokes.filter(stroke => stroke.team !== team);
    if (!this.players.red && !this.players.blue) this.nextId = 1;
    this.resetRound();
  }

  private rebuild() {
    this.world = createBattle(this.strokes.flatMap(stroke => stroke.units));
  }

  private resetRound() {
    this.round++;
    this.phase = "deploy";
    this.outcome = null;
    this.seats.red.ready = this.seats.blue.ready = false;
    for (const player of Object.values(this.players)) player.receipts.clear();
    this.rebuild();
  }

  private editProblem(team: Team) {
    if (this.phase !== "deploy") return "Deployment has ended.";
    if (this.seats[team].ready) return "Your formation is already ready.";
  }

  place(team: Team, round: number, commandId: number, action: unknown): string | { ack: PlacementAck; fresh: boolean } {
    const player = this.players[team];
    if (!player || !this.seats[team].connected) return "Your seat is not connected.";
    if (round !== this.round) return "That round has ended.";
    if (!Number.isSafeInteger(commandId) || commandId < 1) return "Invalid placement command ID.";
    if (!record(action) || (action.type !== "place-warriors" && action.type !== "place-archers")) return "Unknown placement command.";
    const kind = action.type === "place-warriors" ? "warrior" : "archer";
    const points = action.positions;
    if (!Array.isArray(points) || !points.length) return "A stroke needs at least one position.";

    const saved = player.receipts.get(commandId);
    if (saved) {
      const { units } = saved.stroke;
      if (units[0].kind !== kind || units.length !== points.length || !units.every((unit, i) => {
        const point = points[i];
        return record(point) && unit.x === point.x && unit.y === point.y;
      })) return "That placement ID already belongs to a different stroke.";
      return { ack: saved.ack, fresh: false };
    }

    const problem = this.editProblem(team);
    if (problem) return problem;
    const ownCount = this.world.units.filter(unit => unit.team === team).length;
    if (points.length + ownCount > TEAM_LIMIT) return "Each team can place up to " + TEAM_LIMIT + " units.";
    const units: Placement[] = [];
    for (const point of points) {
      if (!record(point) || typeof point.x !== "number" || typeof point.y !== "number" ||
          !Number.isFinite(point.x) || !Number.isFinite(point.y)) return "Use finite arena coordinates.";
      const { x, y } = point;
      if (x < 0 || x > ARENA.width || y < 0 || y > ARENA.height) return "Keep the stroke inside the arena.";
      if (teamAt(x) !== team) return "Keep the whole stroke on your " + (team === "red" ? "left" : "right") + " half.";
      const last = units.at(-1);
      if (last && Math.hypot(x - last.x, y - last.y) > BRUSH_SPACING + 0.00001) return "A squad must be one continuous stroke.";
      units.push({ x, y, team, kind, id: this.nextId + units.length });
    }
    const stroke = { team, units };
    const ack: PlacementAck = { type: "placement-ack", round, commandId, unitIds: units.map(unit => unit.id) };
    this.nextId += units.length;
    this.strokes.push(stroke);
    player.receipts.set(commandId, { ack, stroke });
    this.rebuild();
    return { ack, fresh: true };
  }

  control(team: Team, action: unknown): string | undefined {
    if (!this.seats[team].connected) return "Your seat is not connected.";
    if (!record(action)) return "Unknown room command.";
    if (action.type === "new-round" && this.phase === "finished") {
      this.resetRound();
      return;
    }
    const problem = this.editProblem(team);
    if (problem) return problem;
    const hasSquad = this.strokes.some(stroke => stroke.team === team);
    switch (action.type) {
      case "ready":
        if (!hasSquad) return "Place a squad before pressing Ready.";
        this.seats[team].ready = true;
        if (this.seats.red.ready && this.seats.blue.ready) this.phase = "running";
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

  advance() {
    if (this.phase !== "running") return;
    this.world = stepBattle(this.world);
    this.outcome = battleOutcome(this.world);
    if (this.outcome !== null) this.phase = "finished";
  }

  snapshot(revision: number): Snapshot {
    const seats = { red: { ...this.seats.red }, blue: { ...this.seats.blue } };
    return { type: "snapshot", round: this.round, revision, phase: this.phase, seats, world: this.world, outcome: this.outcome };
  }
}
