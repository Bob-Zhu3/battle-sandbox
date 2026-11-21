import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { matchDatabase } from "../server/match-database.ts";
import worker from "../dist/server/index.js";
import { sqliteBinding } from "./sqlite-binding.mjs";

// Only the local demo forks this process. The published server has no crash switch.
const [filename, port, match, fault] = process.argv.slice(2);
if (!process.send || !["before", "after", "off"].includes(fault)) throw Error("Run npm run demo:crash.");
const sqlite = new DatabaseSync(filename);
sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name = 'online_rooms'").get()) {
  sqlite.exec(readFileSync(new URL("../drizzle/0000_online_rooms.sql", import.meta.url), "utf8"));
}
const db = sqliteBinding(sqlite);
const path = "/api/matches/duel/" + match;
let armed = fault !== "off";

async function stopAtWrite(sql, write) {
  if (!armed || !sql.startsWith("UPDATE online_rooms SET")) return write();
  if (fault === "after") {
    const result = write();
    if (!result.meta.changes) return result; // Wait for the purchase's successful version check.
  }
  armed = false;
  process.send({type: "boundary", fault, pid: process.pid});
  // Withhold the HTTP response. The parent now kills this process without running cleanup.
  await new Promise(() => {});
}
async function evidence() {
  const saved = await matchDatabase(db).read("duel/" + match);
  if (!saved) return null;
  const {room} = JSON.parse(saved.data);
  const red = room.players.find(player => player.team === "red");
  return {
    ids: room.state.world.units.map(unit => unit.id),
    gold: room.state.gold.red,
    receipts: (red?.receipts ?? []).map(([id, receipt]) => [id, receipt.ack.unitIds]),
  };
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, "http://127.0.0.1:" + server.address().port);
    const chunks = [];
    for await (const part of incoming) chunks.push(part);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    let binding = db;
    if (armed && body && url.pathname === path) {
      const packet = JSON.parse(body);
      if (packet.op === "sync" && packet.commands?.some(command => command.action?.type === "place-warriors")) {
        binding = sqliteBinding(sqlite, stopAtWrite);
      }
    }
    const request = new Request(url, {method: incoming.method, headers: incoming.headers, body});
    const reply = await worker.fetch(request, {DB: binding}, {waitUntil() {}});
    outgoing.writeHead(reply.status, Object.fromEntries(reply.headers));
    outgoing.end(Buffer.from(await reply.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500).end();
  }
});
// Exercise the shipping HTTP match transport with the real browser client and Worker.
server.on("upgrade", (_, socket) => socket.end("HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\n\r\n"));
process.on("disconnect", () => process.exit(0));
process.on("message", async message => {
  if (message === "inspect") process.send({type: "state", value: await evidence()});
});
server.listen(Number(port), "127.0.0.1", async () => {
  process.send({type: "listening", port: server.address().port, pid: process.pid, value: await evidence()});
});
