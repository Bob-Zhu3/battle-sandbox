import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { Room } from "../server/room.ts";
import { attachRoom } from "../server/socket.ts";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { CLOSE, ROOM_SOCKET, TEAM_LIMIT } from "../src/room-protocol.ts";

const place = (...positions) => ({ type: "place-warriors", positions });
const at = (x, y = 180) => ({ x, y });

test("a room rejects a whole invalid stroke and assigns authoritative units only after validation", () => {
  const room = new Room();
  room.join();
  room.join();
  assert.match(room.control("red", { type: "ready" }), /Place a squad/);
  for (const bad of [
    null, { type: "place-mages", positions: [at(100)] }, place(), place(at(470), at(480)),
    place(at(-1)), place(at(230, 361)), place(at(Infinity)), place(at(10, NaN)), place(at("20")),
    place(at(10), at(100)), place(...Array.from({ length: TEAM_LIMIT + 1 }, () => at(100))),
  ]) {
    assert.equal(typeof room.place("red", 1, 1, bad), "string");
    assert.equal(room.world.units.length, 0);
  }
  for (const badId of [undefined, 0, -1, 1.2, "1", 2 ** 53]) {
    assert.match(room.place("red", 1, badId, place(at(456))), /command ID/);
  }
  assert.match(room.place("blue", 1, 1, place(at(479.9))), /half/);
  assert.deepEqual(room.place("red", 1, 1, place({ ...at(456), id: 4000, team: "blue", hp: 900, kind: "archer" })).ack.unitIds, [1]);
  assert.deepEqual(room.place("blue", 1, 1, { type: "place-archers", positions: [at(480)] }).ack.unitIds, [2]);
  assert.deepEqual(room.world.units.map(u => [u.id, u.x, u.kind, u.team, u.hp]), [[1,456,"warrior","red",40],[2,480,"archer","blue",27]]);

  room.control("red", { type: "undo" });
  assert.deepEqual(room.world.units.map(u => u.id), [2]);
  room.place("red", 1, 2, place(at(24)));
  room.control("blue", { type: "clear" });
  assert.deepEqual(room.world.units.map(u => u.id), [3]);
});

test("receipts are scoped to a player and round, and survive Undo, a full field, and Ready", () => {
  const room = new Room();
  room.join();
  const blue = room.join();
  const first = { type: "place-archers", positions: [at(100)] };
  const accepted = room.place("red", 1, 1, first);
  assert.ok(accepted.fresh);
  assert.deepEqual(room.place("blue", 1, 1, place(at(700))).ack.unitIds, [2]);
  assert.match(room.place("red", 1, 1, place(at(100))), /different stroke/);
  assert.match(room.place("red", 1, 1, { ...first, positions: [at(101)] }), /different stroke/);
  room.control("red", { type: "undo" });
  const retry = () => assert.deepEqual(room.place("red", 1, 1, first), { ack: accepted.ack, fresh: false });
  retry();
  assert.deepEqual(room.world.units.map(u => u.id), [2]);
  assert.ok(room.place("red", 1, 2, { type: "place-archers", positions: Array.from({ length: TEAM_LIMIT }, () => at(200)) }).fresh);
  assert.equal(room.gold.red, 0);
  retry();
  room.control("red", { type: "ready" });
  retry();
  assert.equal(room.world.units.length, TEAM_LIMIT + 1);

  room.leave("blue");
  assert.equal(room.join(blue.resumeToken), undefined);
  assert.equal(room.join().team, "blue");
  assert.match(room.place("red", 1, 1, first), /round has ended/);
  room.control("red", { type: "clear" });
  const next = room.place("red", 2, 1, first);
  assert.equal(next.fresh, true);
  assert.notDeepEqual(next.ack.unitIds, accepted.ack.unitIds);
});

test("a fresh tab reclaims its remembered team only when that player is disconnected", () => {
  const room = new Room();
  const red = room.join();
  const blue = room.join(undefined, [red.resumeToken]);
  assert.equal(blue.team, "blue");
  assert.equal(room.join(undefined, [red.resumeToken, blue.resumeToken]), undefined);
  room.leave("red");
  room.place("blue", room.round, 1, place(at(620)));
  room.disconnect("blue");
  assert.deepEqual(room.join(undefined, [red.resumeToken, blue.resumeToken]), blue);
  assert.deepEqual(room.world.units.map(u => u.id), [1]);
  assert.notEqual(room.join().resumeToken, red.resumeToken);
});

test("departing players release their seat and reset readiness without moving the other player's squad", () => {
  const room = new Room();
  assert.equal(room.join().team, "red");
  assert.equal(room.join().team, "blue");
  assert.equal(room.join(), undefined);
  room.place("blue", 1, 1, place(at(550)));
  room.place("red", 1, 1, place(at(410)));
  room.control("red", { type: "ready" });
  room.control("blue", { type: "ready" });
  room.advance();
  assert.equal(room.phase, "countdown");
  assert.equal(room.world.tick, 0);
  room.leave("blue");
  assert.deepEqual([room.round, room.phase, room.world.tick, room.seats.red.ready], [2,"deploy",0,false]);
  assert.deepEqual(room.world.units.map(u => [u.id, u.team, u.x]), [[2,"red",410]]);
  assert.equal(room.join().team, "blue");
  assert.equal(room.seats.blue.ready, false);
});

async function serve(t, options) {
  const server = createServer();
  const stop = attachRoom(server, options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { stop(); await new Promise(resolve => server.close(resolve)); });
  return "ws://127.0.0.1:" + server.address().port + ROOM_SOCKET;
}

function client(url, { resumeToken, drop } = {}) {
  const socket = new WebSocket(url);
  const messages = [];
  socket.on("open", () => socket.send(JSON.stringify({ type: "join", resumeToken })));
  socket.on("message", raw => {
    const event = JSON.parse(raw.toString());
    if (!drop?.(event, socket)) messages.push(event);
  });
  async function wait(predicate, after = 0) {
    const deadline = performance.now() + 16000;
    while (performance.now() < deadline) {
      const event = messages.slice(after).find(predicate);
      if (event) return event;
      await delay(8);
    }
    throw Error("Timed out waiting for a room message. Last event type: " + messages.at(-1)?.type);
  }
  function send(id, round, action) {
    const key = "positions" in action ? "commandId" : "seq";
    socket.send(JSON.stringify({ [key]: id, round, action }));
  }
  return { socket, messages, wait, send };
}

test("deployment survives a lost five-Warrior receipt and retries return the original five IDs", async t => {
  const url = await serve(t);
  let dropped;
  const red = client(url, { drop(event, socket) {
    if (event.type !== "placement-ack") return false;
    dropped = event;
    socket.terminate();
    return true;
  } });
  const seat = await red.wait(e => e.type === "joined");
  const blue = client(url);
  await blue.wait(e => e.type === "joined");
  const stroke = place(...[120, 144, 168, 192, 216].map(x => at(x)));
  red.send(1, 1, stroke);
  const held = await blue.wait(e => e.type === "snapshot" && e.seats.red.reserved);
  assert.deepEqual([held.round, held.world.tick, held.phase, held.seats.red.connected], [1, 0, "deploy", false]);
  const ids = held.world.units.map(u => u.id);
  assert.deepEqual(ids, [1, 2, 3, 4, 5]);
  assert.deepEqual(dropped.unitIds, ids);
  assert.equal(red.messages.some(e => e.type === "placement-ack"), false);
  const newcomer = client(url);
  assert.equal((await once(newcomer.socket, "close"))[0], CLOSE.full);

  const again = client(url, { resumeToken: seat.resumeToken });
  assert.deepEqual(await again.wait(e => e.type === "joined"), seat);
  again.send(1, 1, stroke);
  assert.deepEqual(await again.wait(e => e.type === "placement-ack"), dropped);
  again.send(1, 1, { type: "ready" }); // A fresh snapshot from the server after the retry.
  const done = e => e.type === "snapshot" && e.seats.red.ready;
  const [a, b] = await Promise.all([again.wait(done), blue.wait(done)]);
  assert.deepEqual(a, b);
  assert.deepEqual(a.world, held.world);
  assert.deepEqual([a.round, a.phase, a.world.tick], [1, "deploy", 0]);
});

test("a superseded connection cannot release a seat, and expiry invalidates its token", async t => {
  const url = await serve(t, { rejoinGraceMs: 150 });
  const red = client(url);
  const seat = await red.wait(e => e.type === "joined");
  const blue = client(url);
  await blue.wait(e => e.type === "joined");
  const closed = once(red.socket, "close");
  const replacement = client(url, { resumeToken: seat.resumeToken });
  assert.deepEqual(await replacement.wait(e => e.type === "joined"), seat);
  assert.equal((await closed)[0], CLOSE.replaced);
  replacement.send(1, 1, place(at(300)));
  await blue.wait(e => e.type === "snapshot" && e.world.units.length === 1 && e.seats.red.connected);
  replacement.socket.terminate();
  await blue.wait(e => e.type === "snapshot" && e.seats.red.reserved && e.round === 1);
  const expired = await blue.wait(e => e.type === "snapshot" && e.round === 2);
  assert.deepEqual(expired.world.units, []);
  assert.equal(expired.seats.red.reserved, false);
  const stale = client(url, { resumeToken: seat.resumeToken });
  assert.equal((await once(stale.socket, "close"))[0], CLOSE.expired);
  const fresh = client(url);
  const joined = await fresh.wait(e => e.type === "joined");
  assert.equal(joined.team, "red");
  assert.notEqual(joined.resumeToken, seat.resumeToken);
});

test("Blue misses a hit while disconnected, rejoins the live duel, and gets the same final result as Red", async t => {
  const url = await serve(t);
  const red = client(url);
  await red.wait(e => e.type === "joined");
  const blue = client(url);
  const seat = await blue.wait(e => e.type === "joined");
  assert.equal(seat.team, "blue");
  const { round } = await red.wait(e => e.type === "snapshot" && e.seats.blue.connected);
  red.send(1, round, place(at(325)));
  await blue.wait(e => e.type === "snapshot" && e.world.units.length === 1);
  blue.send(1, round, place(at(640)));
  await red.wait(e => e.type === "snapshot" && e.world.units.length === 2);
  red.send(1, round, { type: "ready" });
  blue.send(1, round, { type: "ready" });

  function checkWarriors(frame, hp, hitTick) {
    assert.equal(frame.round, round);
    assert.deepEqual(frame.world.units.map(u => [u.id, u.team, u.hp, u.lastHitTick]),
      [[1, "red", hp, hitTick], [2, "blue", hp, hitTick]]);
  }
  const hit = await blue.wait(e => e.type === "snapshot" && e.world.units.some(u => u.lastHitTick !== null));
  checkWarriors(hit, 30, 90);
  blue.socket.terminate();
  const reserved = await red.wait(e => e.type === "snapshot" && e.seats.blue.reserved);
  checkWarriors(reserved, 30, 90);
  const missed = await red.wait(e => e.type === "snapshot" && e.seats.blue.reserved && e.world.tick > reserved.world.tick && e.world.units[0].hp === 20);
  assert.deepEqual([missed.phase, missed.seats.blue.connected, missed.seats.red.connected], ["running", false, true]);
  checkWarriors(missed, 20, 120);

  const returned = client(url, { resumeToken: seat.resumeToken });
  assert.deepEqual(await returned.wait(e => e.type === "joined"), seat);
  const catchUp = await returned.wait(e => e.type === "snapshot");
  assert.equal(catchUp.phase, "running");
  assert.ok(catchUp.world.tick >= missed.world.tick);
  assert.deepEqual(catchUp.seats.blue, { connected: true, reserved: false, ready: true });
  checkWarriors(catchUp, 20, 120);
  const wipe = await red.wait(e => e.type === "snapshot" && e.world.tick === 180);
  checkWarriors(wipe, 0, 180);
  assert.equal(wipe.phase,"running");
  assert.deepEqual(wipe.gold,{red:126,blue:126});
  red.send(2,round,place(...[132,156,180,204,228].map(y=>at(468,y))));
  const finished = e => e.type === "snapshot" && e.phase === "finished";
  const [a, b] = await Promise.all([red.wait(finished), returned.wait(finished)]);
  assert.deepEqual(a, b);
  assert.equal(a.outcome,"red");
  assert.equal(a.world.bases.find(base=>base.team==="blue").hp,0);
  assert.deepEqual(a.world.units.slice(0,2).map(u=>u.hp),[0,0]);
  const shared = e => e.type === "snapshot" && e.revision >= catchUp.revision;
  assert.deepEqual(returned.messages.filter(shared), red.messages.filter(shared));
});

test("two WebSockets receive the same deployment, authoritative battle ticks and the base result", async (t) => {
  const url = await serve(t);
  const red = client(url);
  assert.equal((await red.wait(e => e.type === "joined")).team, "red");
  const blue = client(url);
  assert.equal((await blue.wait(e => e.type === "joined")).team, "blue");
  const third = client(url);
  const [code] = await once(third.socket, "close");
  assert.equal(code, CLOSE.full);
  const connected = await red.wait(e => e.type === "snapshot" && e.seats.blue.connected);
  const { round } = connected;
  red.send(1, round, place(at(460,168),at(460,192)));
  blue.send(1, round, place(at(500)));
  const placed = e => e.type === "snapshot" && e.phase === "deploy" && e.world.units.length === 3;
  const [a, b] = await Promise.all([red.wait(placed), blue.wait(placed)]);
  assert.deepEqual(a, b);

  red.send(1, round, place(at(200)));
  await red.wait(e => e.type === "error" && e.message.includes("different stroke"));
  red.send(2, round, { type: "ready" });
  const waiting = await blue.wait(e => e.type === "snapshot" && e.seats.red.ready);
  assert.deepEqual([waiting.phase,waiting.world.tick], ["deploy",0]);
  red.send(2, round, { type: "clear" });
  await red.wait(e => e.type === "error" && e.message.includes("already received"));
  red.send(3, round, { type: "clear" });
  await red.wait(e => e.type === "error" && e.message.includes("already ready"));
  blue.send(2, round, { type: "ready" });
  const ended = e => e.type === "snapshot" && e.phase === "finished";
  const [endA, endB] = await Promise.all([red.wait(ended),blue.wait(ended)]);
  assert.deepEqual(endA, endB);
  assert.equal(endA.outcome, "red");
  assert.equal(endA.world.bases[1].hp, 0);

  const frames = red.messages.filter(e => e.type === "snapshot" && e.phase !== "deploy");
  assert.ok(frames.length > 10);
  let expected = createBattle(a.world.units);
  expected.bases = structuredClone(a.world.bases);
  for (const frame of frames) {
    while (expected.tick < frame.world.tick) expected = stepBattle(expected);
    assert.deepEqual(frame.world, JSON.parse(JSON.stringify(expected)));
    assert.deepEqual(blue.messages.find(e => e.revision === frame.revision), frame);
  }
  red.send(4, round, { type: "new-round" });
  const next = await blue.wait(e => e.type === "snapshot" && e.round === round + 1);
  assert.deepEqual(next.world, { tick: 0, units: [], arrows: [], bases: a.world.bases });
  assert.deepEqual(next.gold, connected.gold);
  blue.send(3, round, { type: "ready" });
  await blue.wait(e => e.type === "error" && e.message.includes("round has ended"));
  blue.socket.close(CLOSE.leave, "Left room");
  await red.wait(e => e.type === "snapshot" && e.round === round + 2 && !e.seats.blue.connected);
});
