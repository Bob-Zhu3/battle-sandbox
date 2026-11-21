import { MATCHES, type MatchMode, type Team } from "../src/battlefield.ts";
import { CLOSE, type OnlineExchange as Exchange } from "../src/room-protocol.ts";
import { TICKS_PER_SECOND } from "../src/simulation.ts";
import { Room, record, type RoomCheckpoint } from "./room.ts";
import { applyRoomMessage } from "./room-message.ts";

export interface MatchStore {
  read(key: string): Promise<{version:number; data:string} | null>;
  save(key: string, previous: number | null, data: string, now: number): Promise<boolean>;
}
interface Lease { client: string; token: string; seen: number; seq: number; disconnected?: number }
interface SavedMatch { room: RoomCheckpoint; clock: number; leases: Partial<Record<Team,Lease>> }
const slot = (ms: number) => Math.floor(ms*TICKS_PER_SECOND/1000);
const SILENT_MS = 15_000, RESERVE_MS = 60_000;
const active = (r: Room) => r.phase === "running" || r.phase === "countdown";
const error = (message: string, close?: number): Exchange => ({events:[{type:"error",message}],close});
const empty = (): Exchange => ({events:[]});

export async function exchange(store: MatchStore, mode: MatchMode, id: string, input: unknown, time = Date.now): Promise<Exchange> {
  if (!record(input) || typeof input.client !== "string" || !/^[a-f0-9-]{36}$/.test(input.client)) return error("Invalid connection.",1008);
  const {op,client} = input;
  if (op !== "join" && op !== "sync" && op !== "leave" && op !== "disconnect") return error("Unknown match request.",1008);
  const commands = input.commands ?? [];
  if (!Array.isArray(commands) || commands.length > 32) return error("Send up to 32 commands at a time.",1008);
  const hello = input.hello;
  if (op === "join" && (!record(hello) || hello.type !== "join" ||
    (hello.resumeToken !== undefined && typeof hello.resumeToken !== "string") ||
    (hello.remembered !== undefined && (!Array.isArray(hello.remembered) || hello.remembered.length > MATCHES[mode].teams.length ||
      !hello.remembered.every(v => typeof v === "string"))))) return error("Invalid join request.",1008);

  const key = mode + "/" + id;
  for (let attempt=0; attempt<8; attempt++) {
    const row = await store.read(key), now = time(), wall = slot(now);
    if (!row && op !== "join") return error("Your seat reservation has ended.",CLOSE.expired);
    const saved: SavedMatch | null = row ? JSON.parse(row.data) : null;
    const room = saved ? Room.restore(saved.room) : new Room(mode);
    const leases = saved?.leases ?? {};
    let revision = saved?.room.state.revision ?? 0, clock = saved?.clock ?? wall, dirty = false;
    const start = clock;
    function advance(until: number) {
      while (clock < until && active(room)) { room.advance(); clock++; revision++; }
      clock = Math.max(until,clock);
    }

    // A reconnect includes all elapsed game time, even if the host put the room to sleep.
    // Bound one request's work. Longer gaps resume from the committed checkpoint on the next request.
    const occupied = room.sides.filter(team => leases[team]);
    const overdue = (lease: Lease) => (lease.disconnected ?? lease.seen + SILENT_MS) + RESERVE_MS;
    if (occupied.length && occupied.every(team => overdue(leases[team]!) <= now)) {
      for (const team of occupied) { room.leave(team); delete leases[team]; revision++; }
      clock = wall; dirty = true;
    }
    const through = active(room) ? Math.min(wall,clock+180) : wall;
    const timeouts = room.sides.flatMap(team => {
      const l = leases[team];
      if (!l) return [];
      const marks = [{team,at:overdue(l),release:true}];
      if (l.disconnected === undefined) marks.push({team,at:l.seen+SILENT_MS,release:false});
      return marks;
    }).sort((a,b) => a.at-b.at);
    for (const mark of timeouts) {
      if (slot(mark.at) > through) break;
      advance(slot(mark.at));
      if (mark.release) { room.leave(mark.team); delete leases[mark.team]; }
      else { room.disconnect(mark.team); leases[mark.team]!.disconnected = mark.at; }
      revision++; dirty = true;
    }
    const wasActive = active(room);
    advance(through);
    const result: Exchange = empty();
    if (clock < wall && active(room)) {
      result.retry = true; dirty = true;
    } else {
      clock = Math.max(clock,wall);
      const side = room.sides.find(team => leases[team]?.client === client);
      const lease = side && leases[side];
      if (op === "join" && record(hello)) {
        const joined = lease && side ? room.join(lease.token) :
          room.join(hello.resumeToken as string | undefined,hello.remembered as string[] | undefined);
        if (!joined) return hello.resumeToken !== undefined ? error("Your seat reservation has ended.",CLOSE.expired) :
          error(room.phase === "deploy" ? "All seats are taken." : "This round is already under way.",CLOSE.full);
        leases[joined.team] = {client,token:joined.resumeToken,seen:now,seq:lease?.seq ?? 0};
        result.events.push(joined); revision++; dirty = true;
      } else if (!lease || !side) {
        return op === "disconnect" || op === "leave" ? empty() : error("This connection no longer holds the seat.",CLOSE.replaced);
      } else if (op === "leave") {
        room.leave(side); delete leases[side]; revision++; dirty = true;
      } else if (op === "disconnect") {
        if (lease.disconnected === undefined) {
          room.disconnect(side); lease.disconnected = now; revision++; dirty = true;
        }
      } else {
        if (lease.disconnected !== undefined) {
          room.join(lease.token); delete lease.disconnected; revision++; dirty = true;
        }
        if (now-lease.seen >= 4000) dirty = true;
        for (const message of commands) {
          const applied = applyRoomMessage(room,side,message,lease.seq);
          if (applied.changed) revision++;
          if (applied.changed || lease.seq !== applied.seq) dirty = true;
          lease.seq = applied.seq;
          if (applied.reply) result.events.push(applied.reply);
        }
        lease.seen = now;
      }
      if (op === "sync" || op === "join") {
        if (input.after !== revision || op === "join") result.events.push(room.snapshot(revision));
      }
    }
    if (!dirty && !(wasActive && (clock-start >= 45 || !active(room)))) return result;
    const data: SavedMatch = {room:room.checkpoint(revision),clock,leases};
    if (await store.save(key,row?.version ?? null,JSON.stringify(data),now)) return result;
  }
  return {events:[],retry:true};
}
