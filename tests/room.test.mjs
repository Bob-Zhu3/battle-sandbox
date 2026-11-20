import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { Room } from "../server/room.ts";
import { attachRoom } from "../server/socket.ts";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { ROOM_SOCKET, TEAM_LIMIT } from "../src/room-protocol.ts";

const place = (...positions) => ({ type: "place-warriors", positions });
const at = (x, y = 180) => ({ x, y });

test("a room rejects a whole invalid stroke and assigns authoritative units only after validation", () => {
  const room = new Room();
  room.join();
  room.join();
  assert.match(room.apply("red", { type: "ready" }), /Place a squad/);
  for (const bad of [
    null, { type: "place-mages", positions: [at(100)] }, place(), place(at(470), at(480)),
    place(at(-1)), place(at(230, 361)), place(at(Infinity)), place(at(10, NaN)), place(at("20")),
    place(at(10), at(100)), place(...Array.from({ length: TEAM_LIMIT + 1 }, () => at(100))),
  ]) {
    assert.equal(typeof room.apply("red", bad), "string");
    assert.equal(room.world.units.length, 0);
  }
  assert.match(room.apply("blue", place(at(479.9))), /half/);
  assert.equal(room.apply("red", place({ ...at(456), id: 4000, team: "blue", hp: 900, kind: "archer" })), undefined);
  assert.equal(room.apply("blue", { type: "place-archers", positions: [at(480)] }), undefined);
  assert.deepEqual(room.world.units.map(u => [u.id, u.x, u.kind, u.team, u.hp]), [[1,456,"warrior","red",30],[2,480,"archer","blue",20]]);

  room.apply("red", { type: "undo" });
  assert.deepEqual(room.world.units.map(u => u.id), [2]);
  room.apply("red", place(at(24)));
  room.apply("blue", { type: "clear" });
  assert.deepEqual(room.world.units.map(u => u.id), [3]);
});

test("departing players release their seat and reset readiness without moving the other player's squad", () => {
  const room = new Room();
  assert.equal(room.join(), "red");
  assert.equal(room.join(), "blue");
  assert.equal(room.join(), undefined);
  room.apply("blue", place(at(550)));
  room.apply("red", place(at(410)));
  room.apply("red", { type: "ready" });
  room.apply("blue", { type: "ready" });
  room.advance();
  assert.equal(room.world.tick, 1);
  room.leave("blue");
  assert.deepEqual([room.round, room.phase, room.world.tick, room.seats.red.ready], [2,"deploy",0,false]);
  assert.deepEqual(room.world.units.map(u => [u.id, u.team, u.x]), [[2,"red",410]]);
  assert.equal(room.join(), "blue");
  assert.equal(room.seats.blue.ready, false);
});

function client(url) {
  const socket = new WebSocket(url);
  const messages = [];
  socket.on("message", raw => messages.push(JSON.parse(raw.toString())));
  async function wait(predicate, after = 0) {
    const deadline = performance.now() + 4500;
    while (performance.now() < deadline) {
      const event = messages.slice(after).find(predicate);
      if (event) return event;
      await delay(8);
    }
    throw Error("Timed out waiting for a room message. Last event: " + JSON.stringify(messages.at(-1)));
  }
  function send(seq, round, action) { socket.send(JSON.stringify({ seq, round, action })); }
  return { socket, messages, wait, send };
}

test("two WebSockets receive the same deployment, authoritative battle ticks and simultaneous duel result", async (t) => {
  const server = createServer();
  const stop = attachRoom(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { stop(); await new Promise(resolve => server.close(resolve)); });
  const url = "ws://127.0.0.1:" + server.address().port + ROOM_SOCKET;
  const red = client(url);
  assert.equal((await red.wait(e => e.type === "joined")).team, "red");
  const blue = client(url);
  assert.equal((await blue.wait(e => e.type === "joined")).team, "blue");
  const third = client(url);
  const [code] = await once(third.socket, "close");
  assert.equal(code, 4001);
  const connected = await red.wait(e => e.type === "snapshot" && e.seats.blue.connected);
  const { round } = connected;
  red.send(1, round, place(at(460)));
  blue.send(1, round, place(at(500)));
  const placed = e => e.type === "snapshot" && e.phase === "deploy" && e.world.units.length === 2;
  const [a, b] = await Promise.all([red.wait(placed), blue.wait(placed)]);
  assert.deepEqual(a, b);

  red.send(1, round, place(at(200)));
  await red.wait(e => e.type === "error" && e.message.includes("already received"));
  red.send(2, round, { type: "ready" });
  const waiting = await blue.wait(e => e.type === "snapshot" && e.seats.red.ready);
  assert.deepEqual([waiting.phase,waiting.world.tick], ["deploy",0]);
  red.send(3, round, { type: "clear" });
  await red.wait(e => e.type === "error" && e.message.includes("already ready"));
  blue.send(2, round, { type: "ready" });
  const ended = e => e.type === "snapshot" && e.phase === "finished";
  const [endA, endB] = await Promise.all([red.wait(ended),blue.wait(ended)]);
  assert.deepEqual(endA, endB);
  assert.deepEqual([endA.outcome,endA.world.tick], ["draw",61]);

  const frames = red.messages.filter(e => e.type === "snapshot" && e.phase !== "deploy");
  assert.ok(frames.length > 10);
  let expected = createBattle(a.world.units);
  for (const frame of frames) {
    while (expected.tick < frame.world.tick) expected = stepBattle(expected);
    assert.deepEqual(frame.world, JSON.parse(JSON.stringify(expected)));
    assert.deepEqual(blue.messages.find(e => e.revision === frame.revision), frame);
  }
  red.send(4, round, { type: "new-round" });
  const next = await blue.wait(e => e.type === "snapshot" && e.round === round + 1);
  assert.deepEqual(next.world, a.world);
  blue.send(3, round, { type: "ready" });
  await blue.wait(e => e.type === "error" && e.message.includes("round has ended"));
  blue.socket.close();
  await red.wait(e => e.type === "snapshot" && e.round === round + 2 && !e.seats.blue.connected);
});
