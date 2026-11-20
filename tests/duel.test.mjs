import assert from "node:assert/strict";
import test from "node:test";
import { battleOutcome, createBattle, stepBattle } from "../src/simulation.ts";

test("Warriors in reach hit together on ticks 1, 31 and 61, then both die", () => {
  let battle = createBattle([
    { id: 1, team: "red", x: 100, y: 100 },
    { id: 2, team: "blue", x: 148, y: 100 },
  ]);
  const hits = [];
  for (let tick = 1; tick <= 61; tick++) {
    const before = battle;
    battle = stepBattle(battle);
    assert.equal(battle.tick, tick);
    const [red, blue] = battle.warriors;
    assert.equal(red.hp, blue.hp, `unequal health on tick ${tick}`);
    if (red.hp !== before.warriors[0].hp) hits.push([tick, red.hp, blue.hp]);
    if (tick < 61) assert.equal(battleOutcome(battle), null);
  }
  assert.deepEqual(hits, [[1, 20, 20], [31, 10, 10], [61, 0, 0]]);
  assert.equal(battleOutcome(battle), "draw");
});

test("equal-distance targets resolve by ID even when storage order is reversed", () => {
  const placements = [
    { id: 1, team: "red", x: 100, y: 100 },
    { id: 9, team: "blue", x: 140, y: 100 },
    { id: 4, team: "blue", x: 60, y: 100 },
  ];
  for (const order of [placements, [...placements].reverse()]) {
    const battle = stepBattle(createBattle(order));
    const health = new Map(battle.warriors.map((unit) => [unit.id, unit.hp]));
    assert.equal(health.get(4), 20);
    assert.equal(health.get(9), 30);
    assert.equal(health.get(1), 10, "both incoming hits are applied");
  }
});

test("movement closes on the nearest living enemy at the fixed speed", () => {
  const start = createBattle([
    { id: 10, team: "red", x: 200, y: 100 },
    { id: 11, team: "red", x: 197, y: 100 },
    { id: 3, team: "blue", x: 195, y: 100 },
    { id: 2, team: "blue", x: 80, y: 100 },
    { id: 9, team: "blue", x: 290, y: 100 },
  ]);
  start.warriors[2].hp = 0;
  const next = stepBattle(start);
  assert.equal(next.warriors[0].x, 201.5);
  assert.equal(next.warriors[0].y, 100);
  assert.equal(next.warriors[0].hp, 30);
  assert.equal(next.warriors[2].x, 195);
  assert.equal(start.warriors[0].x, 200, "the previous frame stays available for drawing");
});
