import type { ServerMessage } from "../src/room-protocol.ts";
import { placementKind } from "../src/units.ts";
import { spellKind } from "../src/spells.ts";
import type { Team } from "../src/battlefield.ts";
import { record, type Room } from "./room.ts";

interface Result { changed: boolean; seq: number; reply?: ServerMessage }

export function applyRoomMessage(room: Room, team: Team, message: unknown, lastSeq: number): Result {
  const error = (reason: string): Result => ({changed:false,seq:lastSeq,reply:{type:"error",message:reason}});
  if (!record(message)) return error("Send a JSON room command.");
  const {action, commandId, round, seq} = message;
  if (record(action) && (placementKind(action.type) || spellKind(action.type))) {
    if (typeof round !== "number" || typeof commandId !== "number") return error("A placement needs its round and command ID.");
    const result = room.place(team,round,commandId,action);
    if (typeof result === "string") return {changed:false,seq:lastSeq,reply:{type:"error",message:result,round,commandId}};
    return {changed:result.fresh,seq:lastSeq,reply:result.ack};
  }
  if (round !== room.round) return error("That round has ended.");
  if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 1) return error("Invalid command number.");
  if (seq <= lastSeq) return error("That command was already received.");
  const problem = room.control(team,action);
  return {changed:!problem,seq,reply:problem ? {type:"error",message:problem} : undefined};
}
