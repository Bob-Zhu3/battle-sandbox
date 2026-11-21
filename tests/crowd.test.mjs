import assert from "node:assert/strict";
import test from "node:test";
import { ARENA, TICKS_PER_SECOND, WARRIOR, battleOutcome, createBattle, stepBattle } from "../src/simulation.ts";
import { battleFromDeployment, twentyVsTwenty } from "../src/deployment.ts";

function separation(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test("crowd cells preserve exact pair corrections across borders, corners and coincident centers", () => {
  const cluster = [[79,78],[80,82],[94,78],[79,78],[1,1],[22,22]]
    .map(([x,y],i) => ({id:i+1, team:"red", kind:i%2 ? "warrior" : "cyclops", x,y}));
  const distant = Array.from({length:64}, (_,i) => ({
    id:100+i, team:"red", x:410 + i%8*32, y:40 + Math.floor(i/8)*37,
  }));
  let small = createBattle(cluster), crowd = createBattle([...cluster, ...distant]);
  for (let tick = 0; tick < 36; tick++) {
    small = stepBattle(small);
    crowd = stepBattle(crowd);
    assert.deepEqual(crowd.units.slice(0,cluster.length), small.units);
  }
  assert.ok(separation(small.units[0],small.units[3]) > 20);
});

test("two allies on the exact same point separate and keep pursuing their opponent", () => {
  const opening = createBattle([
    { id: 1, team: "red", x: 180, y: 180 },
    { id: 2, team: "red", x: 180, y: 180 },
    { id: 3, team: "blue", x: 800, y: 180 },
  ]);
  let battle = stepBattle(opening);
  assert.ok(separation(...battle.warriors.slice(0, 2)) > 0, "both allies still occupy the same center after one tick");
  for (let i = 0; i < 90; i++) {
    const next = stepBattle(battle);
    for (const [index, unit] of next.warriors.entries()) {
      assert.ok(separation(unit, battle.warriors[index]) <= WARRIOR.speed / TICKS_PER_SECOND + 1e-8);
    }
    battle = next;
  }
  const [first, second] = battle.warriors;
  assert.ok(separation(first, second) >= 2 * WARRIOR.radius - 0.1);
  assert.ok(Math.min(first.x, second.x) > 260, "both allies must make forward progress");
  assert.equal(separation(...opening.warriors.slice(0, 2)), 0);
});

test("whole circles stay inside the arena when stacked at its four corners", () => {
  const placements = [];
  for (const x of [-1, ARENA.width + 1]) {
    for (const y of [-1, ARENA.height + 1]) {
      for (let i = 0; i < 3; i++) placements.push({ id: placements.length, team: "red", x, y });
    }
  }
  let battle = createBattle(placements);
  for (let tick = 0; tick <= 120; tick++) {
    for (const { x, y } of battle.warriors) {
      assert.ok(x >= WARRIOR.radius && x <= ARENA.width - WARRIOR.radius);
      assert.ok(y >= WARRIOR.radius && y <= ARENA.height - WARRIOR.radius);
    }
    battle = stepBattle(battle);
  }
  for (let i = 0; i < battle.warriors.length; i++) {
    for (let j = i + 1; j < battle.warriors.length; j++) {
      assert.ok(separation(battle.warriors[i], battle.warriors[j]) >= 2 * WARRIOR.radius - 0.1);
    }
  }
});

test("the 20-vs-20 front lines touch with both armies present and units remain distinguishable", () => {
  let battle = battleFromDeployment(twentyVsTwenty());
  for (const team of ["red", "blue"]) assert.equal(battle.warriors.filter((unit) => unit.team === team).length, 20);
  const diameter = 2 * WARRIOR.radius;
  let sawContact = false;
  while (battleOutcome(battle) === null && battle.tick < 1200) {
    battle = stepBattle(battle);
    const living = battle.warriors.filter((unit) => unit.hp > 0);
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const gap = separation(living[i], living[j]);
        assert.ok(gap >= 0.9 * diameter, `more than 10% overlap at tick ${battle.tick}`);
        if (living.length === 40 && living[i].team !== living[j].team && gap <= diameter + 0.05) sawContact = true;
      }
    }
  }
  assert.ok(sawContact, "the opposing front ranks never reached one another at full strength");
  assert.notEqual(battleOutcome(battle), null);
  assert.equal(battle.tick, 297, "the reinforced Warrior formation keeps its replay timing");
});
