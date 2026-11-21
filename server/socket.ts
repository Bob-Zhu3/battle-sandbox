import type { Server } from "node:net";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { CLOSE, SNAPSHOT_EVERY, type ServerMessage } from "../src/room-protocol.ts";
import { TICKS_PER_SECOND, type Team } from "../src/simulation.ts";
import { isMatchId } from "../src/match-link.ts";
import { applyRoomMessage } from "./room-message.ts";
import { Room, record } from "./room.ts";

import { MATCHES, type MatchMode } from "../src/battlefield.ts";

export function attachRoom(server: Server, { rejoinGraceMs = 60_000 } = {}) {
  const sockets = new WebSocketServer({noServer:true,maxPayload:16*1024});
  const matches = new Map<string,ReturnType<typeof createMatch>>();
  function upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    let url: URL;
    try { url = new URL(req.url ?? "/","http://localhost"); }
    catch { socket.destroy(); return; }
    const mode = url.pathname === MATCHES.duel.socket ? "duel" : url.pathname === MATCHES.ffa.socket ? "ffa" : null;
    if (!mode) return;
    const id = url.searchParams.get("match");
    if (id !== null && !isMatchId(id)) { socket.destroy(); return; }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { socket.destroy(); return; } }
      catch { socket.destroy(); return; }
    }
    const key = mode + "/" + (id ?? "");
    if (!matches.has(key) && matches.size >= 256) { socket.destroy(); return; }
    sockets.handleUpgrade(req,socket,head,ws => {
      let match = matches.get(key);
      if (!match) {
        match = createMatch(mode,rejoinGraceMs,() => matches.delete(key));
        matches.set(key,match);
      }
      match.register(ws);
    });
  }
  server.on("upgrade",upgrade);
  function close() {
    server.off("close",close);
    server.off("upgrade",upgrade);
    for (const match of matches.values()) match.close();
    matches.clear();
    sockets.close();
  }
  server.once("close",close);
  return close;
}

function createMatch(mode: MatchMode, rejoinGraceMs: number, remove: () => void) {
  const room = new Room(mode);
  const connections = new Set<WebSocket>();
  const players = new Map<WebSocket, Team>();
  const expiry = new Map<Team, NodeJS.Timeout>();
  let revision = 0;
  let timer: NodeJS.Timeout | undefined;

  function publish() {
    const frame = JSON.stringify(room.snapshot(++revision));
    for (const socket of players.keys()) if (socket.readyState === WebSocket.OPEN) socket.send(frame);
  }

  function stopClock() {
    clearInterval(timer);
    timer = undefined;
  }

  const ticking = () => room.phase === "countdown" || room.phase === "running";
  function startClock() {
    if (timer || !ticking()) return;
    const start = performance.now();
    let elapsedTicks = 0;
    timer = setInterval(() => {
      const due = Math.floor((performance.now() - start) * TICKS_PER_SECOND / 1000);
      const through = Math.min(due, elapsedTicks + 8);
      while (elapsedTicks < through && ticking()) {
        elapsedTicks++;
        const changed = room.advance();
        if (changed || (room.phase === "running" && room.world.tick % SNAPSHOT_EVERY === 0)) publish();
      }
      if (!ticking()) stopClock();
    }, 1000 / TICKS_PER_SECOND);
    timer.unref();
  }

  function release(team: Team) {
    expiry.delete(team);
    room.leave(team);
    if (!ticking()) stopClock();
    publish();
    if (!connections.size && !expiry.size) { stopClock(); remove(); }
  }

  function register(socket: WebSocket) {
    connections.add(socket);
    const joinDeadline = setTimeout(() => socket.close(1008,"Join timed out."),10_000).unref();
    const send = (event: ServerMessage) => socket.send(JSON.stringify(event));
    const error = (message: string) => send({ type: "error", message });
    let team: Team | undefined;
    let lastSeq = 0;
    socket.on("error", () => socket.terminate());
    socket.on("message", (raw, binary) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (binary) return error("Send a JSON room command.");
      let message: unknown;
      try { message = JSON.parse(raw.toString()); }
      catch { return error("Send a JSON room command."); }
      if (!record(message)) return error("Send a JSON room command.");
      if (!team) {
        if (message.type !== "join") return error("Join the room first.");
        const token = message.resumeToken;
        if (token !== undefined && typeof token !== "string") return error("Invalid seat token.");
        const remembered = message.remembered ?? [];
        if (!Array.isArray(remembered) || remembered.length > room.sides.length || !remembered.every(value => typeof value === "string")) return error("Invalid remembered seats.");
        const joined = room.join(token, remembered);
        if (!joined) {
          const reason = token !== undefined ? "Your seat reservation has ended." : room.phase !== "deploy" ? "This round is already under way." : "All seats are taken.";
          error(reason);
          socket.close(token === undefined ? CLOSE.full : CLOSE.expired, reason);
          return;
        }
        team = joined.team;
        clearTimeout(joinDeadline);
        clearTimeout(expiry.get(team));
        expiry.delete(team);
        for (const [previous, side] of players) {
          if (side !== team) continue;
          players.delete(previous);
          previous.close(CLOSE.replaced, "Seat reopened in another tab.");
        }
        players.set(socket, team);
        send(joined);
        publish();
        startClock();
        return;
      }
      if (!players.has(socket)) return;
      const result = applyRoomMessage(room,team,message,lastSeq);
      lastSeq = result.seq;
      if (result.changed) { publish(); startClock(); }
      if (result.reply) send(result.reply);
    });
    socket.on("close", code => {
      clearTimeout(joinDeadline);
      connections.delete(socket);
      if (!team || !players.delete(socket)) {
        if (!connections.size && !expiry.size) { stopClock(); remove(); }
        return;
      }
      if (code === CLOSE.leave) { release(team); return; }
      const side = team;
      room.disconnect(side);
      expiry.set(side, setTimeout(() => release(side), rejoinGraceMs).unref());
      publish();
    });
  }

  function close() {
    stopClock();
    for (const timeout of expiry.values()) clearTimeout(timeout);
    expiry.clear();
    players.clear();
    for (const socket of connections) socket.terminate();
  }
  return {register,close};
}
