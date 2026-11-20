import { ARENA, createBattle, type Placement, type Team } from "./simulation.ts";

export const BRUSH_SPACING = 24;
export type ArenaPoint = Pick<Placement, "x" | "y">;

export interface PlacementCommand {
  type: "place-warriors";
  positions: readonly ArenaPoint[];
}

export function teamAt(x: number): Team {
  return x < ARENA.width / 2 ? "red" : "blue";
}

export function pointerToArena(clientX: number, clientY: number, rect: Pick<DOMRect, "left" | "top" | "width" | "height">): ArenaPoint {
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * ARENA.width,
    y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) * ARENA.height,
  };
}

function placementPoint(x: number, y: number): ArenaPoint {
  // Remove interpolation noise at the team boundary without rounding the path length.
  return { x: Math.round(x * 1e6) / 1e6, y: Math.round(y * 1e6) / 1e6 };
}

export class PlacementStroke {
  readonly positions: ArenaPoint[];
  private last: ArenaPoint;
  private distanceToNext = BRUSH_SPACING;

  constructor(start: ArenaPoint) {
    this.last = start;
    this.positions = [placementPoint(start.x, start.y)];
  }

  extend(end: ArenaPoint) {
    const dx = end.x - this.last.x;
    const dy = end.y - this.last.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;

    let along = this.distanceToNext;
    // Include an endpoint when floating-point addition lands just shy of a mark.
    while (along <= length + 1e-9) {
      const fraction = Math.min(1, along / length);
      this.positions.push(placementPoint(this.last.x + fraction * dx, this.last.y + fraction * dy));
      along += BRUSH_SPACING;
    }
    this.distanceToNext = along - length;
    this.last = end;
  }
}

export function battleFromDeployment(commands: readonly PlacementCommand[]) {
  const placements: Placement[] = [];
  for (const command of commands) {
    for (const point of command.positions) {
      placements.push({ id: placements.length + 1, team: teamAt(point.x), ...point });
    }
  }
  return createBattle(placements);
}

export function twentyVsTwenty(): PlacementCommand[] {
  const red: ArenaPoint[] = [];
  const blue: ArenaPoint[] = [];
  for (let rank = 0; rank < 4; rank++) {
    for (let row = 0; row < 5; row++) {
      const x = 328 - rank * 32 - Math.abs(row - 2);
      const y = 180 + (row - 2) * 46 + (rank % 2) * 5;
      red.push({ x, y });
      blue.push({ x: ARENA.width - x, y });
    }
  }
  return [{ type: "place-warriors", positions: red }, { type: "place-warriors", positions: blue }];
}
