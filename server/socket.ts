import type { Server } from "node:net";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { CLOSE, ROOM_SOCKET, SNAPSHOT_EVERY, type ServerMessage } from "../src/room-protocol.ts";
import { TICKS_PER_SECOND, type Team } from "../src/simulation.ts";
import { Room, record } from "./room.ts";

export function attachRoom(server: Server, { rejoinGraceMs = 60_000 } = {}) {
  const room = new Room();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
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

  function startClock() {
    if (timer || room.phase !== "running") return;
    const start = performance.now();
    timer = setInterval(() => {
      const due = Math.floor((performance.now() - start) * TICKS_PER_SECOND / 1000);
      const through = Math.min(due, room.world.tick + 8);
      while (room.world.tick < through && room.phase === "running") {
        room.advance();
        if (room.outcome !== null || room.world.tick % SNAPSHOT_EVERY === 0) publish();
      }
      if (room.phase !== "running") stopClock();
    }, 1000 / TICKS_PER_SECOND);
    timer.unref();
  }

  function release(team: Team) {
    expiry.delete(team);
    stopClock();
    room.leave(team);
    publish();
  }

  function register(socket: WebSocket) {
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
        if (!Array.isArray(remembered) || remembered.length > 2 || !remembered.every(value => typeof value === "string")) return error("Invalid remembered seats.");
        const joined = room.join(token, remembered);
        if (!joined) {
          const reason = token === undefined ? "Both seats are taken." : "Your seat reservation has ended.";
          error(reason);
          socket.close(token === undefined ? CLOSE.full : CLOSE.expired, reason);
          return;
        }
        team = joined.team;
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
        return;
      }
      if (!players.has(socket)) return;
      const { action, commandId, round, seq } = message;
      if (record(action) && (action.type === "place-warriors" || action.type === "place-archers")) {
        if (typeof round !== "number" || typeof commandId !== "number") return error("A placement needs its round and command ID.");
        const result = room.place(team, round, commandId, action);
        if (typeof result === "string") return send({ type: "error", message: result, round, commandId });
        if (result.fresh) publish();
        send(result.ack);
        return;
      }
      if (round !== room.round) return error("That round has ended.");
      if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 1) return error("Invalid command number.");
      if (seq <= lastSeq) return error("That command was already received.");
      lastSeq = seq;
      const problem = room.control(team, action);
      if (problem) return error(problem);
      publish();
      startClock();
    });
    socket.on("close", code => {
      if (!team || !players.delete(socket)) return;
      if (code === CLOSE.leave) { release(team); return; }
      const side = team;
      room.disconnect(side);
      expiry.set(side, setTimeout(() => release(side), rejoinGraceMs).unref());
      publish();
    });
  }

  function upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    if (req.url !== ROOM_SOCKET) return;
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) { socket.destroy(); return; }
      } catch { socket.destroy(); return; }
    }
    sockets.handleUpgrade(req, socket, head, register);
  }
  server.on("upgrade", upgrade);
  function close() {
    stopClock();
    server.off("close", close);
    server.off("upgrade", upgrade);
    for (const timeout of expiry.values()) clearTimeout(timeout);
    expiry.clear();
    players.clear();
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
  }
  server.once("close", close);
  return close;
}
