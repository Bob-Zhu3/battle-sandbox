export const ARENA = { width: 960, height: 360 } as const;
export const TEAMS = ["red", "blue", "violet", "amber"] as const;
export type Team = typeof TEAMS[number];
export type MatchMode = "duel" | "ffa";

export const ARMIES = {
  red: { name: "Red", coat: "#d95340", hem: "#963a32", light: "#ffab79", facing: 1 },
  blue: { name: "Blue", coat: "#387fc1", hem: "#30577f", light: "#9ed5ec", facing: -1 },
  violet: { name: "Violet", coat: "#8c61b4", hem: "#604482", light: "#dfb6ee", facing: 1 },
  amber: { name: "Amber", coat: "#d5962d", hem: "#906222", light: "#ffe194", facing: -1 },
} as const;

export const MATCHES: Record<MatchMode, { name: string; teams: readonly Team[]; minimum: number; socket: string }> = {
  duel: { name: "Duel", teams: ["red", "blue"], minimum: 2, socket: "/room/socket" },
  ffa: { name: "Free-for-all", teams: TEAMS, minimum: 3, socket: "/ffa/socket" },
};
export const STARTING_GOLD = 120;

// Camps stay put when another player joins. Upper/right boundaries belong to
// exactly one camp, including at the center seam of the arena.
export function campFor(mode: MatchMode, team: Team) {
  const left = ARMIES[team].facing === 1;
  const upper = team === "red" || team === "blue";
  const height = mode === "duel" ? ARENA.height : ARENA.height / 2;
  const side = left ? "left" : "right";
  return {
    x: left ? 0 : ARENA.width / 2, y: mode === "duel" || upper ? 0 : height,
    width: ARENA.width / 2, height,
    label: mode === "duel" ? side + " half" : (upper ? "upper " : "lower ") + side + " camp",
  };
}

export function inCamp(mode: MatchMode, team: Team, x: number, y: number) {
  const camp = campFor(mode, team);
  const right = camp.x + camp.width, bottom = camp.y + camp.height;
  return x >= camp.x && y >= camp.y && x <= ARENA.width && y <= ARENA.height
    && (x < right || right === ARENA.width) && (y < bottom || bottom === ARENA.height);
}

export const COUNTDOWN_TICKS = 180;
export const GOLD_PER_SECOND = 4;
export const BASE_HP = 160;
export const BASE_RADIUS = 22;

export const TOWER = { range: 160, sightTicks: 18, cooldownTicks: 72, damage: 6, boltSpeed: 300 } as const;

export interface Base {
  kind: "base"; id: number; team: Team; x: number; y: number; hp: number;
  lastHitTick: number | null; targetId: number | null; acquiredTick: number | null;
  lastShotTick: number | null; aimX: number; aimY: number; stunnedUntil?: number;
}
export function makeBase(mode: MatchMode, team: Team): Base {
  const camp = campFor(mode, team);
  return { kind: "base", id: -1 - TEAMS.indexOf(team), team,
    x: ARMIES[team].facing > 0 ? 104 : ARENA.width - 104,
    y: camp.y + camp.height / 2, hp: BASE_HP, lastHitTick: null, targetId: null, acquiredTick: null,
    lastShotTick: null, aimX: ARMIES[team].facing, aimY: 0 };
}
