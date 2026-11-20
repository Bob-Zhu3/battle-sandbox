import type { Server } from "node:net";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { ROOM_SOCKET, SNAPSHOT_EVERY, type ServerMessage } from "../src/room-protocol.ts";
import { TICKS_PER_SECOND, type Team } from "../src/simulation.ts";
import { Room, record } from "./room.ts";

export function attachRoom(server: Server) {
  const room = new Room();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, clientTracking: false });
  const players = new Map<WebSocket, Team>();
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

  function register(socket: WebSocket) {
    const send = (event: ServerMessage) => socket.send(JSON.stringify(event));
    const error = (message: string) => send({ type: "error", message });
    socket.on("error", () => socket.terminate());
    const team = room.join();
    if (!team) {
      error("Both seats are taken.");
      socket.close(4001, "Room full");
      return;
    }
    players.set(socket, team);
    let lastSeq = 0;
    send({ type: "joined", team });
    publish();

    socket.on("message", (raw, binary) => {
      if (!players.has(socket) || socket.readyState !== WebSocket.OPEN) return;
      if (binary) return error("Send a JSON room command.");
      let message: unknown;
      try { message = JSON.parse(raw.toString()); }
      catch { return error("Send a JSON room command."); }
      if (!record(message) || typeof message.seq !== "number" || !Number.isSafeInteger(message.seq) || message.seq < 1) return error("Invalid command number.");
      if (message.round !== room.round) return error("That round has ended.");
      if (message.seq <= lastSeq) return error("That command was already received.");
      lastSeq = message.seq;
      const problem = room.apply(team, message.action);
      if (problem) return error(problem);
      publish();
      startClock();
    });
    socket.on("close", () => {
      if (!players.delete(socket)) return;
      stopClock();
      room.leave(team);
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
    for (const socket of players.keys()) socket.terminate();
    players.clear();
    sockets.close();
  }
  server.once("close", close);
  return close;
}
