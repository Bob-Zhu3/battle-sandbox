import assert from "node:assert/strict";
import test from "node:test";
import { battleOutcome, createBattle, stepBattle } from "../src/simulation.ts";
import { archerScreen, battleFromDeployment } from "../src/deployment.ts";

function archer(id, team, x, y = 150) {
  return { id, kind: "archer", team, x, y };
}

test("one arrow leaves a stationary enemy at full health until its first and only impact", () => {
  let battle = createBattle([archer(1, "red", 240), archer(2, "blue", 340)]);
  // Two Archers already in range stand still. Only the red one is ready to fire.
  battle.units[1].nextAttackTick = 1000;
  let lastHp = battle.units[1].hp;
  const changes = [];
  for (let tick = 1; tick <= 48; tick++) {
    battle = stepBattle(battle);
    const target = battle.units[1];
    assert.deepEqual([target.x, target.y], [340, 150]);
    if (target.hp !== lastHp) changes.push([tick, lastHp, target.hp]);
    lastHp = target.hp;
    if (tick === 1) {
      assert.equal(target.hp, 20);
      assert.equal(target.lastHitTick, null);
      assert.equal(battle.arrows[0].x, 240, "release leaves the arrow at the bow");
    }
    if (tick < 19) assert.equal(target.hp, 20);
    assert.equal(battle.arrows.length, tick < 19 ? 1 : 0);
  }
  assert.deepEqual(changes, [[19, 20, 12]]);
  battle = stepBattle(battle);
  assert.equal(battle.arrows.length, 1, "the next cooldown expires on tick 49");
  assert.equal(battle.units[1].hp, 12);
});

test("Archers approach at their own speed, stop in reach, and use the Warrior targeting tie-break", () => {
  let battle = createBattle([archer(1, "red", 200), archer(2, "blue", 350)]);
  battle = stepBattle(battle);
  assert.equal(battle.units[0].x, 201.2);
  assert.equal(battle.arrows.length, 0);
  while (!battle.arrows.length && battle.tick < 100) battle = stepBattle(battle);
  assert.equal(battle.arrows.length, 2);
  const positions = battle.units.map(({ x, y }) => [x, y]);
  assert.ok(positions[1][0] - positions[0][0] <= 120);
  assert.deepEqual(stepBattle(battle).units.map(({ x, y }) => [x, y]), positions);

  const choices = [archer(1, "red", 300), archer(8, "blue", 420), archer(4, "blue", 180), archer(3, "blue", 335)];
  for (const order of [choices, [...choices].reverse()]) {
    battle = createBattle(order);
    battle.units.find(unit => unit.id === 3).hp = 0;
    const shot = stepBattle(battle).arrows.find(arrow => arrow.team === "red");
    assert.ok(shot.vx < 0, "the Archer should fire at ID 4, exactly 120 units away");
    assert.equal(shot.vy, 0);
  }
});

test("a swept arrow ignores allies and hits only the first enemy along the segment", () => {
  let battle = createBattle([archer(1, "red", 130), archer(2, "red", 165), archer(30, "blue", 241), archer(40, "blue", 199)]);
  for (const unit of battle.units) unit.nextAttackTick = 1000;
  // Both ends of this deliberately long step are clear of every circle.
  battle.arrows.push({ team: "red", x: 132, y: 150, vx: 140, vy: 0, damage: 8, releasedTick: 0 });
  battle = stepBattle(battle);
  assert.deepEqual(battle.units.map(unit => unit.hp), [20, 20, 20, 12]);
  assert.equal(battle.arrows.length, 0);
  assert.deepEqual(stepBattle(battle).units.map(unit => unit.hp), [20, 20, 20, 12]);
});

test("a released arrow continues after its Archer falls and can turn the result into a draw", () => {
  let battle = createBattle([archer(1, "red", 240), { id: 2, team: "blue", x: 270, y: 150 }]);
  battle.units[0].hp = 10;
  battle.units[1].hp = 8;
  battle = stepBattle(battle);
  assert.deepEqual(battle.units.map(unit => unit.hp), [0, 8]);
  assert.equal(battle.arrows.length, 1);
  assert.equal(battleOutcome(battle), null);
  while (battleOutcome(battle) === null && battle.tick < 50) battle = stepBattle(battle);
  assert.equal(battleOutcome(battle), "draw");
  assert.equal(battle.arrows.length, 0);
});

test("an enemy can walk into an arrow's path between two clear endpoints", () => {
  const battle = createBattle([archer(1, "red", 200, 80), { id: 2, team: "blue", x: 200, y: 161.8 }]);
  battle.units[0].nextAttackTick = 1000;
  battle.arrows.push({ team: "red", x: 164, y: 150, vx: 60, vy: 0, damage: 8, releasedTick: 0 });
  const next = stepBattle(battle);
  assert.ok(next.units[1].y < 161);
  assert.equal(next.units[1].hp, 22);
  assert.equal(next.arrows.length, 0);
});

test("melee and arrow impacts add together while both Warriors get their swing", () => {
  const battle = createBattle([{ id: 1, team: "red", x: 200, y: 150 }, { id: 2, team: "blue", x: 228, y: 150 }]);
  battle.units[0].hp = 10;
  battle.units[1].hp = 18;
  battle.arrows.push({ team: "red", x: 212, y: 150, vx: 8, vy: 0, damage: 8, releasedTick: 0 });
  const next = stepBattle(battle);
  assert.deepEqual(next.units.map(u => u.hp), [0, 0]);
  assert.equal(battleOutcome(next), "draw");
  assert.deepEqual(battle.units.map(u => u.hp), [10, 18]);
  assert.equal(next.arrows.length, 0);
});

test("a shot keeps its release direction when the target moves aside and clears the far edge", () => {
  let battle = createBattle([
    archer(1, "red", 100), { id: 2, team: "blue", x: 210, y: 150 }, { id: 3, team: "red", x: 210, y: 235 },
  ]);
  // The blue Warrior walks south toward the closer red Warrior.
  battle.units[1].nextAttackTick = battle.units[2].nextAttackTick = 1000;
  battle = stepBattle(battle);
  battle.units[0].nextAttackTick = 1000;
  assert.equal(battle.arrows.length, 1);
  while (battle.arrows.length && battle.tick < 200) {
    const [arrow] = battle.arrows;
    assert.equal(arrow.x, 100 + 5 * (battle.tick - 1));
    assert.equal(arrow.y, 150);
    battle = stepBattle(battle);
  }
  assert.equal(battle.tick, 174);
  assert.equal(battle.arrows.length, 0);
  assert.equal(battle.units[1].hp, 30);
  assert.ok(battle.units[1].y > 170);
});

test("the screen meets the enemy while five protected Archers deliver two volleys", () => {
  let battle = battleFromDeployment(archerScreen());
  let volleys = 0, metWithArrowsInFlight = false;
  while (volleys < 2 && battle.tick < 150) {
    battle = stepBattle(battle);
    const archers = battle.units.filter(u => u.kind === "archer");
    const screen = battle.units.filter(u => u.team === "red" && u.kind === "warrior" && u.hp > 0);
    const opposing = battle.units.filter(u => u.team === "blue" && u.hp > 0);
    const released = battle.arrows.filter(arrow => arrow.releasedTick === battle.tick);
    if (released.length) {
      assert.equal(released.length, 5);
      assert.equal(screen.length, 5);
      assert.ok(archers.every(a => a.hp === 20 && screen.every(w => w.x > a.x)));
      volleys++;
    }
    if (battle.arrows.length && screen.some(w => opposing.some(b => Math.hypot(w.x - b.x, w.y - b.y) <= 22.05))) {
      metWithArrowsInFlight = true;
    }
  }
  assert.equal(volleys, 2);
  assert.ok(metWithArrowsInFlight);
});
