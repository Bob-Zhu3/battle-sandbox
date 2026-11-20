import type { PlacementCommand } from "./deployment.ts";
import type { Battle, Outcome, Team } from "./simulation.ts";

export const ROOM_SOCKET = "/room/socket";
export const TEAM_LIMIT = 100;
export const SNAPSHOT_EVERY = 3;
export type World = Pick<Battle, "tick" | "units" | "arrows">;
export type ControlAction = { type: "ready" | "undo" | "clear" | "new-round" };
export type RoomAction = PlacementCommand | ControlAction;
export type RoomPhase = "deploy" | "running" | "finished";
export interface Seat { connected: boolean; reserved: boolean; ready: boolean }
export interface Snapshot {
  type: "snapshot";
  round: number;
  revision: number;
  phase: RoomPhase;
  seats: Record<Team, Seat>;
  world: World;
  outcome: Outcome | null;
}
export interface PlacementMessage { round: number; commandId: number; action: PlacementCommand }
export interface PlacementAck { type: "placement-ack"; round: number; commandId: number; unitIds: number[] }
export interface Joined { type: "joined"; team: Team; resumeToken: string }
export type ClientMessage = { type: "join"; resumeToken?: string; remembered?: string[] } | PlacementMessage | { round: number; seq: number; action: ControlAction };
export type ServerMessage = Snapshot | Joined | PlacementAck | { type: "error"; message: string; round?: number; commandId?: number };

export const CLOSE = { leave: 4000, full: 4001, expired: 4002, replaced: 4003 } as const;
