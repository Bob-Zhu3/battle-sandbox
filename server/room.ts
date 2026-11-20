import { BRUSH_SPACING, teamAt } from "../src/deployment.ts";
import { battleOutcome, createBattle, stepBattle, ARENA, type Outcome, type Placement, type Team } from "../src/simulation.ts";
import { TEAM_LIMIT, type RoomPhase, type Seat, type Snapshot } from "../src/room-protocol.ts";

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class Room {
  round = 1;
  phase: RoomPhase = "deploy";
  seats: Record<Team, Seat> = { red: { connected: false, ready: false }, blue: { connected: false, ready: false } };
  world = createBattle([]);
  outcome: Outcome | null = null;
  private strokes: { team: Team; units: Placement[] }[] = [];
  private nextId = 1;

  join(): Team | undefined {
    for (const team of ["red", "blue"] as const) {
      if (!this.seats[team].connected) {
        this.seats[team].connected = true;
        return team;
      }
    }
  }

  leave(team: Team) {
    this.seats[team].connected = false;
    this.strokes = this.strokes.filter(stroke => stroke.team !== team);
    if (!this.seats.red.connected && !this.seats.blue.connected) this.nextId = 1;
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
    this.rebuild();
  }

  apply(team: Team, action: unknown): string | undefined {
    if (!this.seats[team].connected) return "Your seat is not connected.";
    if (!record(action)) return "Unknown room command.";
    if (action.type === "new-round" && this.phase === "finished") {
      this.resetRound();
      return;
    }
    if (this.phase !== "deploy") return "Deployment has ended.";
    if (this.seats[team].ready) return "Your formation is already ready.";
    const ownCount = this.world.units.filter(unit => unit.team === team).length;
    switch (action.type) {
      case "ready":
        if (!ownCount) return "Place a squad before pressing Ready.";
        this.seats[team].ready = true;
        if (this.seats.red.ready && this.seats.blue.ready) this.phase = "running";
        return;
      case "undo":
      case "clear": {
        if (!ownCount) return "Your field is empty.";
        if (action.type === "clear") this.strokes = this.strokes.filter(stroke => stroke.team !== team);
        else this.strokes.splice(this.strokes.map(stroke => stroke.team).lastIndexOf(team), 1);
        this.rebuild();
        return;
      }
      case "place-warriors":
      case "place-archers": {
        const points = action.positions;
        if (!Array.isArray(points) || points.length < 1) return "A stroke needs at least one position.";
        if (points.length + ownCount > TEAM_LIMIT) return "Each team can place up to " + TEAM_LIMIT + " units.";
        const kind = action.type === "place-warriors" ? "warrior" : "archer";
        const units: Placement[] = [];
        for (const point of points) {
          if (!record(point) || typeof point.x !== "number" || typeof point.y !== "number" ||
              !Number.isFinite(point.x) || !Number.isFinite(point.y)) return "Use finite arena coordinates.";
          const { x, y } = point;
          if (x < 0 || x > ARENA.width || y < 0 || y > ARENA.height) return "Keep the stroke inside the arena.";
          if (teamAt(x) !== team) return "Keep the whole stroke on your " + (team === "red" ? "left" : "right") + " half.";
          const last = units.at(-1);
          if (last && Math.hypot(x - last.x, y - last.y) > BRUSH_SPACING + 0.00001) return "A squad must be one continuous stroke.";
          // Copy only coordinates. Identity, allegiance and combat stats are server-owned.
          units.push({ x, y, team, kind, id: this.nextId + units.length });
        }
        this.nextId += units.length;
        this.strokes.push({ team, units });
        this.rebuild();
        return;
      }
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
