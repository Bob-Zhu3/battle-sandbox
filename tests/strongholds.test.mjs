import assert from "node:assert/strict";
import test from "node:test";
import { Room } from "../server/room.ts";
import { BASE_HP, makeBase, TEAMS } from "../src/battlefield.ts";
import { createBattle } from "../src/simulation.ts";

function advance(room, ticks) {
  for (let i = 0; i < ticks; i++) room.advance();
}
function liveRoom(teams, units) {
  const room = new Room(teams === 2 ? "duel" : "ffa");
  for (let i = 0; i < teams; i++) room.join();
  room.phase = "running";
  room.world = createBattle(units);
  room.world.bases = TEAMS.slice(0, teams).map(team => makeBase(room.mode, team));
  return room;
}
const warrior = (id, team, x, y) => ({ id, team, x, y, kind: "warrior" });
const archer = (id, team, x, y) => ({ id, team, x, y, kind: "archer" });

test("three seconds lock the opening formation; income then buys a live reinforcement exactly once", () => {
  const room = new Room();
  const red = room.join(); room.join();
  const ten = Array.from({length: 10}, (_, i) => ({ x: 140, y: 60 + 24 * i }));
  room.place("red", 1, 1, { type: "place-warriors", positions: ten });
  room.place("blue", 1, 1, { type: "place-archers", positions: [{ x: 870, y: 170 }] });
  room.control("red", {type: "ready"}); room.control("blue", {type: "ready"});
  const opening = structuredClone(room.snapshot(0));
  const recruit = {type: "place-archers", positions: [{x: 400, y: 180}]};
  for (let t = 0; t < 180; t++) {
    assert.equal(room.snapshot(t).countdown, 3 - Math.floor(t / 60));
    assert.equal(room.phase, "countdown");
    assert.deepEqual(structuredClone(room.world), opening.world);
    assert.deepEqual(room.gold, {red: 0, blue: 112});
    room.advance();
    if (t === 10) assert.match(room.place("red", 1, 2, recruit), /ended/);
  }
  assert.equal(room.phase, "running"); assert.equal(room.world.tick, 0);
  advance(room, 59);
  assert.deepEqual(room.gold, {red: 0, blue: 112});
  room.advance();
  assert.equal(room.gold.red, 4);
  assert.match(room.place("red", 1, 2, recruit), /8 gold/);
  advance(room, 60);
  assert.deepEqual(room.gold, {red: 8, blue: 120});
  assert.match(room.place("red", 1, 2, {...recruit, positions: [{x: 700, y: 180}]}), /left half/);
  const before = structuredClone(room.world);
  const reply = room.place("red", 1, 2, recruit);
  assert.deepEqual(reply.ack.unitIds, [12]);
  assert.equal(room.gold.red, 0);
  assert.equal(room.world.tick, before.tick);
  assert.deepEqual(room.world.units.slice(0, -1), before.units);
  assert.deepEqual(room.world.bases, before.bases);
  assert.deepEqual(room.world.arrows, before.arrows);
  assert.equal(room.world.units.at(-1).hp, 20);
  room.disconnect("red");
  advance(room, 8);
  assert.deepEqual(room.join(red.resumeToken), red);
  assert.deepEqual(room.place("red", 1, 2, recruit), {ack: reply.ack, fresh: false});
  assert.equal(room.world.units.length, 12);
  assert.equal(room.world.tick, 128);
  assert.equal(room.gold.red, 0);
  assert.match(room.control("red", {type: "undo"}), /ended/);
  assert.match(room.control("red", {type: "clear"}), /ended/);
});

test("the killer receives the victim's bounty once on the melee or arrow impact tick", () => {
  const room = liveRoom(2, [warrior(1, "red", 420, 180), archer(2, "blue", 462, 180)]);
  room.world.units[1].nextAttackTick = 1000;
  room.advance();
  assert.equal(room.world.units[1].hp, 10);
  assert.equal(room.gold.red, 120);
  advance(room, 30);
  assert.equal(room.world.units[1].hp, 0);
  assert.equal(room.world.units[1].killedBy, "red");
  assert.deepEqual(room.gold, {red: 124, blue: 120});
  advance(room, 20);
  assert.equal(room.gold.red, 124);

  const ranged = liveRoom(2, [archer(1, "red", 360, 180), warrior(2, "blue", 460, 180)]);
  ranged.world.units[1].hp = 8;
  ranged.advance();
  assert.equal(ranged.world.arrows.length, 1);
  assert.equal(ranged.world.units[1].hp, 8);
  while (ranged.world.units[1].hp > 0 && ranged.world.tick < 40) {
    assert.equal(ranged.gold.red, 120);
    ranged.advance();
  }
  assert.ok(ranged.world.tick > 1 && ranged.world.tick < 40);
  assert.equal(ranged.world.units[1].hp, 0);
  assert.equal(ranged.world.units[1].lastHitTick, ranged.world.tick);
  assert.equal(ranged.world.units[1].killedBy, "red");
  assert.equal(ranged.gold.red, 126);
  advance(ranged, 12);
  assert.equal(ranged.gold.red, 126);
});

test("fatal damage from several players pays one bounty regardless of unit array order", () => {
  for (const extra of [false, true]) for (const reverse of [false, true]) {
    const troops = [warrior(1, "red", 352, 130), warrior(2, "violet", 428, 123), warrior(3, "blue", 390, 130)];
    if (extra) troops.push(warrior(4, "violet", 428, 140));
    const room = liveRoom(3, reverse ? troops.reverse() : troops);
    const target = room.world.units.find(unit => unit.team === "blue");
    target.hp = 10; target.nextAttackTick = 1000;
    room.advance();
    const winner = extra ? "violet" : "red";
    assert.equal(room.world.units.find(u => u.id === target.id).killedBy, winner);
    assert.equal(room.gold[winner], 126);
    assert.equal(room.gold[extra ? "red" : "violet"], 120);
    assert.equal(room.gold.blue, 120);
  }
});

test("an Archer can shoot a base from its edge range and a new defender can intercept the arrow", () => {
  for (const defend of [false, true]) {
    const room = liveRoom(2, [archer(9, "red", 725, 180)]);
    room.advance();
    assert.equal(room.world.units[0].x, 725);
    assert.equal(room.world.units[0].targetId, room.world.bases[1].id);
    assert.equal(room.world.arrows.length, 1);
    assert.equal(room.world.bases[1].hp, BASE_HP);
    if (defend) {
      assert.ok(room.place("blue", 1, 1, {type: "place-warriors", positions: [{x: 802, y: 180}]}).fresh);
      assert.equal(room.world.arrows.length, 1);
    }
    advance(room, 24);
    assert.deepEqual(room.world.arrows.map(shot => [shot.team, shot.kind]), [["blue", "bolt"]]);
    assert.equal(room.world.bases[1].hp, defend ? BASE_HP : BASE_HP - 8);
    if (defend) assert.equal(room.world.units[1].hp, 22);
    assert.equal(room.gold.red, 120);
  }
});

test("losing a base routes its army, ends its income and recruitment, and leaves the other players fighting", () => {
  const room = liveRoom(3, [warrior(1, "red", 810, 90), warrior(2, "blue", 650, 270)]);
  room.world.bases[1].hp = 10;
  room.world.arrows.push({team: "blue", x: 170, y: 260, vx: 5, vy: 0, damage: 8, releasedTick: 0});
  room.advance();
  assert.equal(room.world.bases[1].hp, 0);
  assert.equal(room.world.units[1].hp, 0);
  assert.equal(room.world.units[1].killedBy, undefined);
  assert.deepEqual(room.world.arrows, []);
  assert.equal(room.gold.red, 120);
  assert.equal(room.phase, "running");
  assert.match(room.place("blue", 1, 2, {type: "place-archers", positions: [{x: 790, y: 90}]}), /fallen/);
  advance(room, 59);
  assert.deepEqual([room.gold.red, room.gold.blue, room.gold.violet], [124, 120, 124]);
});

test("empty armies can rebuild; losing the last two bases simultaneously draws and a rematch restores both", () => {
  const idle = liveRoom(2, []);
  advance(idle, 180);
  assert.equal(idle.phase, "running");
  assert.deepEqual(idle.gold, {red: 132, blue: 132});

  const room = liveRoom(2, [warrior(1, "red", 810, 180), warrior(2, "blue", 150, 180)]);
  room.world.bases.forEach(base => { base.hp = 10; });
  room.advance();
  assert.equal(room.phase, "finished");
  assert.equal(room.outcome, "draw");
  assert.deepEqual(room.world.bases.map(b => b.hp), [0, 0]);
  assert.deepEqual(room.gold, {red: 120, blue: 120});
  room.control("red", {type: "new-round"});
  assert.equal(room.phase, "deploy");
  assert.equal(room.world.tick, 0);
  assert.deepEqual(room.world.bases.map(b => b.hp), [BASE_HP, BASE_HP]);
});
