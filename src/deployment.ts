import { ARENA, createBattle, type Placement, type Team } from "./simulation.ts";

import { placementKind, type PlacementType, type RecruitKind } from "./units.ts";

export const BRUSH_SPACING = 24;
export const windmillField: readonly (readonly [Team, RecruitKind, number, number])[] = [
  ["red","windmill",508,245], ["blue","archer",622,218], ["blue","warrior",580,278],
  ["red","sandworm",171,120], ["blue","post",356,115],
  ["red","prism",651,99], ["blue","irongolem",760,99], ["blue","snowman",790,73], ["blue","belltower",790,125],
  ["red","shieldbearer",713,113],
];
export const reinforcements: readonly (readonly [Team, RecruitKind, number, number])[] = [
  ["red","trojanhorse",220,111], ["blue","werewolf",321,112], ["blue","archer",347,104],
  ["red","monk",202,245], ["blue","warrior",249,241],
  ["red","harpoon",519,132], ["blue","firedragon",655,135],
  ["red","liondancers",567,245], ["blue","slime",636,243], ["blue","warrior",665,261],
];
export type ArenaPoint = Pick<Placement, "x" | "y">;

export interface PlacementCommand {
  type: PlacementType;
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
    const kind = placementKind(command.type);
    for (const point of command.positions) {
      placements.push({ id: placements.length + 1, kind, team: teamAt(point.x), ...point });
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

export function archerScreen(): PlacementCommand[] {
  const screen: ArenaPoint[] = [], archers: ArenaPoint[] = [], opponents: ArenaPoint[] = [];
  for (const y of [96, 138, 180, 222, 264]) {
    archers.push({ x: 322, y: y + 6 });
    screen.push({ x: 398, y });
    opponents.push({ x: 543, y: y - 2 }, { x: 655, y: y + 5 });
  }
  return [
    { type: "place-warriors", positions: screen },
    { type: "place-archers", positions: archers },
    { type: "place-warriors", positions: opponents },
  ];
}

export function overTheShoulder(): PlacementCommand[] {
  return [
    { type: "place-warriors", positions: [{ x: 414, y: 155 }, { x: 343, y: 210 }, { x: 602, y: 160 }, { x: 655, y: 212 }] },
    { type: "place-archers", positions: [{ x: 334, y: 151 }, { x: 688, y: 208 }] },
  ];
}
