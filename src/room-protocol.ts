import type { PlacementCommand } from "./deployment.ts";
import type { Battle, Outcome, Team } from "./simulation.ts";

export const ROOM_SOCKET = "/room/socket";
export const TEAM_LIMIT = 100;
export const SNAPSHOT_EVERY = 3;
export type World = Pick<Battle, "tick" | "units" | "arrows">;
export type RoomAction = PlacementCommand | { type: "ready" | "undo" | "clear" | "new-round" };
export type RoomPhase = "deploy" | "running" | "finished";
export interface Seat { connected: boolean; ready: boolean }
export interface Snapshot {
  type: "snapshot";
  round: number;
  revision: number;
  phase: RoomPhase;
  seats: Record<Team, Seat>;
  world: World;
  outcome: Outcome | null;
}
export interface ClientMessage { round: number; seq: number; action: RoomAction }
export type ServerMessage = Snapshot | { type: "joined"; team: Team } | { type: "error"; message: string };
