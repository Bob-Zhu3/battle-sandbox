import assert from "node:assert/strict";
import test from "node:test";
import { attachDeploymentBrush } from "../src/brush-input.ts";
import { battleFromDeployment, pointerToArena } from "../src/deployment.ts";
import { stepBattle } from "../src/simulation.ts";

// Supply pointer samples to the same listeners as the browser, with a known canvas rectangle.
function inputFixture() {
  const canvas = new EventTarget();
  const rect = { left: 35, top: 15, width: 480, height: 180 };
  const captures = new Set();
  canvas.getBoundingClientRect = () => rect;
  canvas.setPointerCapture = (id) => captures.add(id);
  canvas.hasPointerCapture = (id) => captures.has(id);
  canvas.releasePointerCapture = (id) => captures.delete(id);
  const commands = [];
  attachDeploymentBrush(canvas, { canDraw: () => true, preview() {}, commit: (command) => commands.push(command) });
  function clientPoint(x, y) {
    return { clientX: rect.left + x / 2, clientY: rect.top + y / 2 };
  }
  function send(type, x, y, coalesced) {
    const event = Object.assign(new Event(type), { pointerId: 1, isPrimary: true, button: 0, ...clientPoint(x, y) });
    if (coalesced) event.getCoalescedEvents = () => coalesced.map(([sx, sy]) => clientPoint(sx, sy));
    canvas.dispatchEvent(event);
  }
  return { commands, send };
}

test("a 96-unit drag commits the same five positions once with two or twenty pointer positions", () => {
  const positions = [120, 144, 168, 192, 216].map((x) => ({ x, y: 120 }));
  for (const count of [2, 20]) {
    const { commands, send } = inputFixture();
    send("pointerdown", 120, 120);
    for (let i = 1; i < count - 1; i++) send("pointermove", 120 + 96 * i / (count - 1), 120);
    assert.equal(commands.length, 0, "the preview must not commit units");
    send("pointerup", 216, 120);
    assert.deepEqual(commands, [{ type: "place-warriors", positions }]);
  }
});

test("clicks place one Warrior, cancelled strokes place none, and capture loss after release adds nothing", () => {
  const { commands, send } = inputFixture();
  send("pointerdown", 300, 100);
  send("pointermove", 348, 100);
  send("pointercancel", 348, 100);
  send("pointerup", 348, 100);
  assert.equal(commands.length, 0);
  send("pointerdown", 520, 100);
  send("pointermove", 520, 100);
  send("pointerup", 520, 100);
  send("lostpointercapture", 520, 100);
  assert.deepEqual(commands, [{ type: "place-warriors", positions: [{ x: 520, y: 100 }] }]);
});

test("coalesced movement carries spacing around a corner and skips a short tail", () => {
  const { commands, send } = inputFixture();
  send("pointerdown", 100, 100);
  send("pointermove", 110, 142, [[110, 100], [110, 142]]);
  send("pointerup", 110, 142);
  assert.deepEqual(commands[0].positions, [{ x: 100, y: 100 }, { x: 110, y: 114 }, { x: 110, y: 138 }]);
});

test("each mark gets its own side and replay rebuilds the original health, positions, and IDs", () => {
  const { commands, send } = inputFixture();
  send("pointerdown", 432, 120);
  send("pointerup", 528, 120);
  const opening = battleFromDeployment(commands);
  assert.deepEqual(opening.warriors.map(({ id, team, x }) => [id, team, x]), [
    [1, "red", 432], [2, "red", 456], [3, "blue", 480], [4, "blue", 504], [5, "blue", 528],
  ]);
  const played = stepBattle(opening);
  assert.notDeepEqual(played.warriors, opening.warriors);
  assert.deepEqual(battleFromDeployment(commands), opening);
});

test("the same relative location maps to the same arena coordinates after resizing", () => {
  const small = { left: 50, top: 20, width: 320, height: 200 };
  const large = { left: 10, top: 80, width: 960, height: 360 };
  assert.deepEqual(pointerToArena(130, 170, small), { x: 240, y: 270 });
  assert.deepEqual(pointerToArena(250, 350, large), { x: 240, y: 270 });
  assert.deepEqual(pointerToArena(-10, 600, small), { x: 0, y: 360 });
});
